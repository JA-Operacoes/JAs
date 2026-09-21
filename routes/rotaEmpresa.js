const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const pool = require('../db'); // ajuste o caminho conforme seu projeto
const { autenticarToken, contextoEmpresa } = require('../middlewares/authMiddlewares');
const { verificarPermissao, exigirFlag } = require('../middlewares/permissaoMiddleware');
const logMiddleware = require('../middlewares/logMiddleware');
const { normalizarSigla, resolverSiglaCertificado, certificadoConfigurado } = require('../utils/certificadoEmpresa');
const { definirVariavelEnv } = require('../utils/envFile');

router.use(autenticarToken());
router.use(contextoEmpresa);

// Duas empresas com a mesma sigla de certificado (derivada do nome fantasia,
// ou de um override manual em empresas.siglacertificado) usariam sem querer
// o mesmo par de variáveis NFE_CERTIFICADO_<SIGLA>_* — ou seja, uma
// assinaria nota com o certificado (CNPJ) da outra. Barra isso já no
// cadastro/edição, antes de chegar a esse ponto (ver também a checagem de
// segurança que roda de novo na subida do servidor, em server.js, pra pegar
// quem já estava no banco antes dessa validação existir).
//
// siglaCertificadoOverride: quando o front já reenviou uma sigla manual
// (resolvendo um conflito anterior), ela é o que vale — se ELA também
// colidir, quem chamar decide se pede outra de novo.
async function buscarConflitoDeSigla(nmFantasia, siglaCertificadoOverride, idempresaAtual) {
  const siglaNova = resolverSiglaCertificado({ nmfantasia: nmFantasia, siglacertificado: siglaCertificadoOverride });
  if (!siglaNova) return null;

  const { rows } = await pool.query(
    'SELECT idempresa, nmfantasia, siglacertificado FROM empresas WHERE idempresa IS DISTINCT FROM $1',
    [idempresaAtual || null]
  );
  const conflito = rows.find((e) => resolverSiglaCertificado(e) === siglaNova);
  return conflito ? { sigla: siglaNova, conflito } : null;
}

// "ordem" (posição fixa na barra "Trocar empresa", ver migration
// adiciona_ordem_fixa_nas_empresas) não pode se repetir — duas empresas com o mesmo
// número embaralhariam a posição exibida. Não tem UNIQUE na coluna (já nasceu com
// várias linhas em NULL, pras empresas sem posição definida ainda), então valida aqui.
async function buscarConflitoDeOrdem(ordem, idempresaAtual) {
  if (!ordem) return null;
  const { rows } = await pool.query(
    'SELECT idempresa, nmfantasia FROM empresas WHERE ordem = $1 AND idempresa IS DISTINCT FROM $2',
    [ordem, idempresaAtual || null]
  );
  return rows[0] || null;
}

// Próximo número livre no fim da sequência (não preenche buracos no meio de
// propósito — a ordem sempre cresceu 1,2,3... até agora, e um buraco só existiria
// se alguém apagasse uma empresa do meio, caso raro que pode ser resolvido manualmente).
async function proximaOrdemDisponivel() {
  const { rows } = await pool.query('SELECT COALESCE(MAX(ordem), 0) + 1 AS proxima FROM empresas');
  return rows[0].proxima;
}

// --- Upload do certificado A1 da empresa (só quem tem a flag "master") ----
const dirCertificados = path.join(__dirname, '..', 'certs');
if (!fs.existsSync(dirCertificados)) fs.mkdirSync(dirCertificados, { recursive: true });

const storageCertificado = multer.diskStorage({
  destination: (req, file, cb) => cb(null, dirCertificados),
  // Nome do arquivo é sempre <SIGLA>.pfx — nunca o nome que o usuário deu ao
  // arquivo no computador dele, evitando path traversal e mantendo o PATH
  // gravado no .env sempre previsível a partir da sigla.
  filename: async (req, file, cb) => {
    try {
      const { rows } = await pool.query('SELECT nmfantasia, siglacertificado FROM empresas WHERE idempresa = $1', [req.params.id]);
      if (!rows.length) return cb(new Error('Empresa não encontrada.'));
      const sigla = resolverSiglaCertificado(rows[0]);
      if (!sigla) return cb(new Error('Não foi possível calcular a sigla do certificado dessa empresa.'));
      req.siglaCertificado = sigla;
      cb(null, `${sigla}.pfx`);
    } catch (err) {
      cb(err);
    }
  },
});

const uploadCertificado = multer({
  storage: storageCertificado,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.pfx' || ext === '.p12') return cb(null, true);
    cb(new Error('Envie um arquivo .pfx ou .p12.'));
  },
});

// Status do certificado — nunca retorna path/senha, só se já foi configurado.
// Sem exigir 'pesquisar' de propósito: precisa rodar logo depois de CRIAR uma
// empresa (usuário só tem 'cadastrar' nesse momento) pra decidir se mostra o
// aviso de certificado pendente — e o payload não é sigiloso.
router.get('/:id/certificado', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT nmfantasia, siglacertificado FROM empresas WHERE idempresa = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Empresa não encontrada' });
    const sigla = resolverSiglaCertificado(rows[0]);
    res.json({ sigla, configurado: certificadoConfigurado(sigla) });
  } catch (err) {
    console.error('Erro ao consultar certificado da empresa:', err);
    res.status(500).json({ message: 'Erro ao consultar certificado da empresa.' });
  }
});

// Upload do certificado — a sigla vem sempre do nmfantasia já salvo no
// banco (calculada dentro do multer acima), nunca de algo enviado pelo
// cliente, pra este endpoint nunca poder sobrescrever uma variável de
// ambiente que não seja NFE_CERTIFICADO_<SIGLA>_*.
router.post('/:id/certificado', exigirFlag('master'), (req, res) => {
  uploadCertificado.single('arquivo')(req, res, (err) => {
    if (err) {
      console.error('Erro no upload do certificado:', err);
      return res.status(400).json({ message: 'Erro ao enviar o certificado.' });
    }

    const sigla = req.siglaCertificado;
    const senha = (req.body.senha || '').trim();

    if (!req.file || !sigla) {
      return res.status(400).json({ message: 'Envie o arquivo do certificado (.pfx ou .p12).' });
    }
    if (!senha) {
      return res.status(400).json({ message: 'Informe a senha do certificado.' });
    }

    try {
      definirVariavelEnv(`NFE_CERTIFICADO_${sigla}_PATH`, `certs/${sigla}.pfx`);
      definirVariavelEnv(`NFE_CERTIFICADO_${sigla}_SENHA`, senha);
      res.json({ message: 'Certificado salvo com sucesso.', configurado: true });
    } catch (err2) {
      console.error('Erro ao salvar variáveis do certificado:', err2.message);
      res.status(500).json({ message: 'Erro ao salvar o certificado.' });
    }
  });
});

// --- Upload do logo da empresa (usado no cabeçalho de relatórios/impressão,
// ex.: Faturamento > Visão Geral > Imprimir) -------------------------------
// Upload de verdade em vez de digitar o nome do arquivo: escolher visualmente
// evita erro de digitação e garante que o logo mostrado é sempre o certo.
const dirLogos = path.join(__dirname, '..', 'uploads', 'logos_empresas');
if (!fs.existsSync(dirLogos)) fs.mkdirSync(dirLogos, { recursive: true });

const storageLogo = multer.diskStorage({
  destination: (req, file, cb) => cb(null, dirLogos),
  // Nome fixo por empresa (logo_<idempresa>.<ext>) — um novo upload
  // sobrescreve o arquivo anterior em vez de acumular versões antigas (só
  // fica órfão se a extensão mudar entre um upload e outro, ex.: era .png e
  // virou .jpg — caso raro, sem tratamento especial pra isso).
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `logo_${req.params.id}${ext}`);
  },
});

const uploadLogo = multer({
  storage: storageLogo,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) return cb(null, true);
    cb(new Error('Envie um arquivo de imagem (PNG, JPG, etc.).'));
  },
});

router.post('/:id/logo', exigirFlag('devs', 'supremo'), (req, res) => {
  uploadLogo.single('logo')(req, res, async (err) => {
    if (err) {
      console.error('Erro no upload do logo:', err);
      return res.status(400).json({ message: 'Erro ao enviar o logo.' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'Envie um arquivo de imagem.' });
    }

    const caminhoRelativo = `uploads/logos_empresas/${req.file.filename}`;
    try {
      const { rows } = await pool.query(
        'UPDATE empresas SET logo = $1 WHERE idempresa = $2 RETURNING idempresa, logo',
        [caminhoRelativo, req.params.id]
      );
      if (!rows.length) return res.status(404).json({ message: 'Empresa não encontrada.' });
      res.json({ message: 'Logo salvo com sucesso.', logo: caminhoRelativo });
    } catch (err2) {
      console.error('Erro ao salvar logo da empresa:', err2.message);
      res.status(500).json({ message: 'Erro ao salvar o logo.' });
    }
  });
});

// --- Upload de logoclaro/iconeescuro/iconeclaro (variantes usadas na barra
// "Trocar empresa" e no seletor de "Empresa Padrão" do Usuários — ver
// migration adiciona_icone_em_empresas) --------------------------------
// Uma rota genérica em vez de triplicar a de /logo acima: o nome da coluna
// (":campo") só pode ser um dos 3 abaixo — nunca é interpolado na query sem
// passar por essa whitelist antes (mesmo padrão do FLAGS_ESPECIAIS em
// permissaoMiddleware.js).
const CAMPOS_IMAGEM_EMPRESA = {
  logoclaro:   { dir: 'logos_empresas',  prefixo: 'logoclaro' },
  iconeescuro: { dir: 'icones_empresas', prefixo: 'iconeescuro' },
  iconeclaro:  { dir: 'icones_empresas', prefixo: 'iconeclaro' },
};

const dirIconesEmpresas = path.join(__dirname, '..', 'uploads', 'icones_empresas');
if (!fs.existsSync(dirIconesEmpresas)) fs.mkdirSync(dirIconesEmpresas, { recursive: true });

const storageImagemEmpresa = multer.diskStorage({
  destination: (req, file, cb) => {
    const config = CAMPOS_IMAGEM_EMPRESA[req.params.campo];
    cb(null, path.join(__dirname, '..', 'uploads', config.dir));
  },
  filename: (req, file, cb) => {
    const config = CAMPOS_IMAGEM_EMPRESA[req.params.campo];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${config.prefixo}_${req.params.id}${ext}`);
  },
});

const uploadImagemEmpresa = multer({
  storage: storageImagemEmpresa,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) return cb(null, true);
    cb(new Error('Envie um arquivo de imagem (PNG, JPG, etc.).'));
  },
});

router.post('/:id/imagem/:campo', exigirFlag('devs', 'supremo'), (req, res, next) => {
  if (!CAMPOS_IMAGEM_EMPRESA[req.params.campo]) {
    return res.status(400).json({ message: 'Campo de imagem inválido.' });
  }
  next();
}, (req, res) => {
  uploadImagemEmpresa.single('imagem')(req, res, async (err) => {
    if (err) {
      console.error('Erro no upload de imagem da empresa:', err);
      return res.status(400).json({ message: err.message || 'Erro ao enviar a imagem.' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'Envie um arquivo de imagem.' });
    }

    const config = CAMPOS_IMAGEM_EMPRESA[req.params.campo];
    const caminhoRelativo = `uploads/${config.dir}/${req.file.filename}`;
    try {
      const { rows } = await pool.query(
        `UPDATE empresas SET ${req.params.campo} = $1 WHERE idempresa = $2 RETURNING idempresa, ${req.params.campo}`,
        [caminhoRelativo, req.params.id]
      );
      if (!rows.length) return res.status(404).json({ message: 'Empresa não encontrada.' });
      res.json({ message: 'Imagem salva com sucesso.', [req.params.campo]: caminhoRelativo });
    } catch (err2) {
      console.error('Erro ao salvar imagem da empresa:', err2.message);
      res.status(500).json({ message: 'Erro ao salvar a imagem.' });
    }
  });
});

// Próxima posição livre na barra "Trocar empresa" — usado pra já sugerir/pré-preencher
// o campo "Ordem" ao abrir o formulário em branco (cadastro de empresa nova). Mesma
// visibilidade do campo em si: só Devs (ver atualizarVisibilidadeCampoOrdem no front).
router.get('/utilitarios/proxima-ordem', exigirFlag('devs'), async (req, res) => {
  try {
    const proximaOrdem = await proximaOrdemDisponivel();
    res.json({ proximaOrdem });
  } catch (err) {
    console.error('Erro ao calcular próxima posição disponível:', err);
    res.status(500).json({ message: 'Erro ao calcular próxima posição disponível.' });
  }
});

// Listar todas as empresas
router.get('/',  verificarPermissao('Empresas', 'pesquisar'), async (req, res) => {
  console.log('✅ [GET /empresas] Rota acessada com sucesso');
  const { nmFantasia } = req.query;  
  
  try {
    if (nmFantasia) {
      console.log("🔍 Buscando empresa por nmFantasia:", nmFantasia);
      // Igualdade exata (só sem diferenciar maiúsculas/minúsculas) — com '%...%' aqui,
      // digitar "EP" batia em "EP-RH" (contém o texto) e carregava a empresa errada,
      // impedindo cadastrar uma "EP" nova depois de renomear a antiga.
      const result = await pool.query(
        `SELECT *
        FROM empresas
        WHERE nmfantasia ILIKE $1
        ORDER BY nmfantasia ASC LIMIT 1`,
        [nmFantasia]
      );
      console.log("✅ Consulta por nmFantasia retornou:", result.rows.length, "linhas.");
      return result.rows.length
        ? res.json(result.rows[0])
        : res.status(404).json({ message: "Empresa não encontrada" });
    } else {
      
      console.log("🔍 Buscando todas as empresas:");
      const result = await pool.query(
        `SELECT * 
        FROM empresas        
        ORDER BY nmfantasia`
        );
      console.log("✅ Consulta de todos as empresas retornou:", result.rows.length, "linhas.");
      return result.rows.length
        ? res.json(result.rows)
        : res.status(404).json({ message: "Nenhuma Empresa encontrada" });
    }
  } catch (error) {
    console.error("❌ Erro ao buscar empresas:", error);
    res.status(500).json({ message: "Erro ao buscar nome fantasia" });
  }
});

router.get('/:idempresa', verificarPermissao('Empresas', 'pesquisar'), async (req, res) => {
  const { idempresa } = req.params;
  console.log(`🔍 Buscando empresa por ID: ${idempresa}`);

  try {
    const result = await pool.query(
      `SELECT * FROM empresas WHERE idempresa = $1`,
      [idempresa]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Empresa não encontrada" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("❌ Erro ao buscar empresa por ID:", error);
    res.status(500).json({ message: "Erro ao buscar empresa" });
  }
});

// Criar nova empresa
router.post('/', verificarPermissao('Empresas', 'cadastrar'), 
  logMiddleware('Empresas', { // Módulo 'Empresas'
        // Para POST, não há dados anteriores
        buscarDadosAnteriores: async (req) => {
            return { dadosanteriores: null, idregistroalterado: null };
        }
  }),
  async (req, res) => {
  const ativo = req.body.ativo === "on" ? true : false;
  const {
    nmFantasia, razaoSocial, cnpj, inscEstadual, emailEmpresa, emailNfe, site, telefone, cep, endereco, numero, complemento, bairro, cidade, estado, pais,
    regimeTributario, inscricaoMunicipal,
    idBanco, agencia, digitoAgencia, numeroConta, digitoConta, tipoConta, pix,
    siglaCertificado, ordem
  } = req.body;
  const idempresaDoUsuarioLogado = req.idempresa;
  try {
    const siglaManual = normalizarSigla(siglaCertificado) || null;
    const conflito = await buscarConflitoDeSigla(nmFantasia, siglaManual);
    if (conflito) {
      return res.status(409).json({
        message: siglaManual
          ? `A sigla "${conflito.sigla}" também já é usada pela empresa "${conflito.conflito.nmfantasia}". Digite outra sigla.`
          : `A sigla de certificado (${conflito.sigla}) derivada desse nome fantasia já é usada pela empresa "${conflito.conflito.nmfantasia}".`,
        precisaSiglaManual: true,
        sigla: conflito.sigla,
      });
    }

    const conflitoOrdem = await buscarConflitoDeOrdem(ordem || null, null);
    if (conflitoOrdem) {
      const proxima = await proximaOrdemDisponivel();
      return res.status(409).json({
        message: `A posição ${ordem} na barra "Trocar empresa" já está sendo usada pela empresa "${conflitoOrdem.nmfantasia}". Escolha a próxima posição disponível (${proxima}) ou deixe o campo em branco.`,
        proximaOrdemDisponivel: proxima,
      });
    }

    const result = await pool.query(
      `INSERT INTO empresas (
         nmfantasia, razaosocial, cnpj, inscricaoestadual, emailemp, emailnf, site, telefone, cep, endereco, numero, complemento, bairro, cidade, estado, pais, ativo,
         regimetributario, inscricaomunicipal,
         idbanco, agencia, digitoagencia, numeroconta, digitoconta, tipoconta, pix,
         siglacertificado, ordem
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28)
       RETURNING *`,
      [
        nmFantasia, razaoSocial, cnpj, inscEstadual, emailEmpresa, emailNfe, site, telefone, cep, endereco, numero, complemento, bairro, cidade, estado, pais, ativo,
        regimeTributario || null, inscricaoMunicipal || null,
        idBanco || null, agencia || null, digitoAgencia || null, numeroConta || null, digitoConta || null, tipoConta || null, pix || null,
        siglaManual, ordem || null
      ]
    );
    const novaEmpresa = result.rows[0];
          
    res.locals.acao = 'cadastrou';
    res.locals.idregistroalterado = novaEmpresa.idempresa; 
    res.locals.idusuarioAlvo = null;
    res.locals.dadosnovos = novaEmpresa;

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao criar empresa:', err);
    res.status(500).send('Erro ao criar empresa');
  }
});

// Atualizar empresa
router.put('/:id', verificarPermissao('Empresas', 'alterar'), 
  logMiddleware('Empresas', { // Módulo 'Empresas'
        buscarDadosAnteriores: async (req) => {
            const idEmpresaAAlterar = req.params.id; // ID da empresa vindo da URL
            // Aqui, a empresa do usuário logado (req.idempresa) não é relevante para buscar o registro *da* empresa.
            // A busca é por idEmpresaAAlterar.

            if (!idEmpresaAAlterar) {
                return { dadosanteriores: null, idregistroalterado: null };
            }

            try {
                const result = await pool.query(
                    'SELECT * FROM empresas WHERE idempresa = $1', // Busca a empresa pelo ID da URL
                    [idEmpresaAAlterar]
                );
                const linha = result.rows[0] || null;
                return {
                    dadosanteriores: linha,
                    idregistroalterado: linha?.idempresa || null
                };
            } catch (error) {
                console.error("Erro ao buscar dados anteriores da empresa:", error);
                return { dadosanteriores: null, idregistroalterado: null };
            }
        }
  }),
  async (req, res) => {
  const id = req.params.id; // idempresa da empresa a ser atualizado
  const idempresa = req.idempresa; // ID da empresa do usuário logado
  const ativo = req.body.ativo;
  

  console.log(`Atualizando empresa com ID: ${id} para a empresa do usuário logado: ${idempresa}`);

  const {
    nmFantasia, razaoSocial, cnpj, inscEstadual, emailEmpresa, emailNfe, site, telefone, cep, endereco, numero, complemento, bairro, cidade, estado, pais,
    regimeTributario, inscricaoMunicipal,
    idBanco, agencia, digitoAgencia, numeroConta, digitoConta, tipoConta, pix,
    siglaCertificado, ordem
  } = req.body;
  try {
    const siglaManual = normalizarSigla(siglaCertificado) || null;
    const conflito = await buscarConflitoDeSigla(nmFantasia, siglaManual, id);
    if (conflito) {
      return res.status(409).json({
        message: siglaManual
          ? `A sigla "${conflito.sigla}" também já é usada pela empresa "${conflito.conflito.nmfantasia}". Digite outra sigla.`
          : `A sigla de certificado (${conflito.sigla}) derivada desse nome fantasia já é usada pela empresa "${conflito.conflito.nmfantasia}".`,
        precisaSiglaManual: true,
        sigla: conflito.sigla,
      });
    }

    const conflitoOrdem = await buscarConflitoDeOrdem(ordem || null, id);
    if (conflitoOrdem) {
      const [proxima, { rows: linhaAtual }] = await Promise.all([
        proximaOrdemDisponivel(),
        pool.query('SELECT ordem FROM empresas WHERE idempresa = $1', [id]),
      ]);
      const ordemAtual = linhaAtual[0]?.ordem;
      const sugestaoManterAtual = ordemAtual ? ` ou mantenha a atual (${ordemAtual})` : '';
      return res.status(409).json({
        message: `A posição ${ordem} na barra "Trocar empresa" já está sendo usada pela empresa "${conflitoOrdem.nmfantasia}". Escolha a próxima posição disponível (${proxima})${sugestaoManterAtual}.`,
        proximaOrdemDisponivel: proxima,
      });
    }

    const result = await pool.query(
      `UPDATE empresas
       SET nmfantasia = $1, razaosocial = $2, cnpj = $3, inscricaoestadual = $4,
        emailemp = $5, emailnf = $6, site = $7, telefone = $8, cep = $9, endereco = $10,
        numero = $11, complemento = $12, bairro = $13, cidade= $14, estado = $15, pais = $16, ativo = $17,
        regimetributario = $18, inscricaomunicipal = $19,
        idbanco = $20, agencia = $21, digitoagencia = $22, numeroconta = $23, digitoconta = $24, tipoconta = $25, pix = $26,
        siglacertificado = COALESCE($28, siglacertificado),
        ordem = COALESCE($29, ordem)
      WHERE idempresa = $27 RETURNING idempresa, logo`,
      [
        nmFantasia, razaoSocial, cnpj, inscEstadual, emailEmpresa, emailNfe, site, telefone, cep, endereco, numero, complemento, bairro, cidade, estado, pais, ativo,
        regimeTributario || null, inscricaoMunicipal || null,
        idBanco || null, agencia || null, digitoAgencia || null, numeroConta || null, digitoConta || null, tipoConta || null, pix || null,
        id,
        siglaManual, ordem || null
      ]
    );
    if (result.rowCount) {
        const empresaAtualizada = result.rows[0];
        // --- Ponto Chave para o Log ---
        res.locals.acao = 'atualizou';
        res.locals.idregistroalterado = empresaAtualizada.idempresa; // O ID da empresa atualizada
        res.locals.idusuarioAlvo = null; // Não se aplica
        res.locals.dadosnovos = req.body;

        res.json(empresaAtualizada);
    } else {
        res.status(404).send('Empresa não encontrada ou não foi possível atualizar.');
    }
    
  } catch (err) {
    console.error('Erro ao atualizar empresa:', err);
    res.status(500).send('Erro ao atualizar empresa');
  }
});



module.exports = router;
