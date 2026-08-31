const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB"); // Seu pool de conexão com o PostgreSQL
const { autenticarToken, contextoEmpresa } = require('../middlewares/authMiddlewares');
const { verificarPermissao } = require('../middlewares/permissaoMiddleware');
const logMiddleware = require('../middlewares/logMiddleware');

// --- Importações e Configuração do Multer ---
const multer = require('multer');
const path = require('path');
const fs = require('fs'); // Para manipulação de arquivos (apagar antigos)

const uploadDir = path.join(__dirname, '../uploads/fotos_funcionarios');

// Garante que o diretório de uploads existe
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Tipo de arquivo não suportado! Apenas imagens são permitidas.'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // Limite de 5MB
    }
});
// --- Fim da Configuração do Multer ---


router.get("/bancos", verificarPermissao('Bancos', 'pesquisar'), async (req, res) => {
  const { nmBanco, codBanco } = req.query;
  const idempresa = req.idempresa;
  console.log("nmBanco NA ROTA FUNCIONARIOS", nmBanco, codBanco, idempresa);
  try {
    let result;

        if (codBanco) { // Priorize a busca por código do banco se ele existir
            result = await pool.query(
                `SELECT b.idbanco, b.codbanco, b.nmbanco
                 FROM bancos b
                 INNER JOIN bancoempresas be ON be.idbanco = b.idbanco
                 WHERE be.idempresa = $1 AND b.codbanco = $2`, // Use = para correspondência exata do código
                [idempresa, codBanco]
            );
            console.log("RESULTADO QUERY POR CODIGO", result.rows);
            return result.rows.length > 0
                ? res.json(result.rows[0]) // Retorna o primeiro encontrado, já que o código deve ser único
                : res.status(404).json({ message: "Banco não encontrado com o código fornecido para esta empresa." });
        } else if (nmBanco) { // Se não tem codBanco, verifica nmBanco
            result = await pool.query(
                `SELECT b.idbanco, b.codbanco, b.nmbanco
                 FROM bancos b
                 INNER JOIN bancoempresas be ON be.idbanco = b.idbanco
                 WHERE be.idempresa = $1 AND b.nmbanco ILIKE $2 LIMIT 1`,
                [idempresa, `%${nmBanco}%`]
            );
            console.log("RESULTADO QUERY POR NOME", result.rows);
            return result.rows.length > 0
                ? res.json(result.rows[0])
                : res.status(404).json({ message: "Banco não encontrado com o nome fornecido para esta empresa." });
        } 
    } catch (error) {
        console.error("❌ Erro ao buscar bancos:", error);
        return res.status(500).json({ error: "Erro ao buscar bancos." });
    }
});

// Aplica autenticação em todas as rotas
router.use(autenticarToken());
router.use(contextoEmpresa);

// ===== Busca de CBO (Classificação Brasileira de Ocupações) =====
// Base oficial (MTE/CBO2002) hospedada localmente em /data — sem depender de API externa.
// Carrega 1x em memória: ocupações + sinônimos, apontando todos para o título oficial.
let cboIndice = null;
function carregarCBO() {
  if (cboIndice) return cboIndice;
  const ler = (arquivo) => JSON.parse(fs.readFileSync(path.join(__dirname, "../data", arquivo), "utf8"));
  const ocupacoes = ler("cbo_ocupacao.json");      // [{ code, name }]
  const sinonimos = ler("cbo_sinonimo.json");      // [{ code, name }]
  const tituloPorCodigo = new Map(ocupacoes.map((o) => [o.code, o.name]));
  // Lista de termos pesquisáveis: ocupação + sinônimos (todos resolvem p/ o título oficial).
  const termos = [
    ...ocupacoes.map((o) => ({ code: o.code, termo: o.name })),
    ...sinonimos.map((s) => ({ code: s.code, termo: s.name })),
  ];
  cboIndice = { tituloPorCodigo, termos };
  return cboIndice;
}
const semAcento = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// Campos financeiros/RH ficam ocultos (e sem 'required') para perfis sem acesso ao
// fieldset Financeiro (ex.: Freelancer), então chegam como string vazia. Colunas
// numeric/date do Postgres rejeitam '' com erro de sintaxe — convertemos para NULL.
const vazioParaNull = (v) => (v === '' || v === undefined ? null : v);

// GET /funcionarios/cbo?q=termo  → [{ codigo, titulo }] (até 20). Busca por código ou nome/sinônimo.
router.get("/cbo", (req, res) => {
  try {
    const q = semAcento(req.query.q);
    if (q.length < 2) return res.json([]);
    const { tituloPorCodigo, termos } = carregarCBO();
    const soDigitos = q.replace(/\D/g, "");
    // Busca por TODAS as palavras (ignora conectivos), além de match por código.
    const palavras = q.split(/\s+/).filter((p) => p.length >= 2 && !["de", "da", "do", "e", "em"].includes(p));
    const vistos = new Set();
    const resultado = [];
    for (const t of termos) {
      if (resultado.length >= 20) break;
      const nome = semAcento(t.termo);
      const casaCodigo = soDigitos.length >= 2 && t.code.startsWith(soDigitos);
      const casaNome = palavras.length > 0 && palavras.every((p) => nome.includes(p));
      if (!casaCodigo && !casaNome) continue;
      if (vistos.has(t.code)) continue;
      vistos.add(t.code);
      resultado.push({ codigo: t.code, titulo: tituloPorCodigo.get(t.code) || t.termo });
    }
    res.json(resultado);
  } catch (error) {
    console.error("ERRO /funcionarios/cbo:", error);
    res.status(500).json({ error: "Erro ao buscar CBO." });
  }
});

// GET verifica se o CPF já existe (em qualquer empresa) — usado no cadastro para
// detectar funcionário já cadastrado em outra empresa e oferecer importação dos dados.
router.get("/verificar-cpf/:cpf", verificarPermissao('Funcionarios', 'cadastrar'), async (req, res) => {
    const { cpf } = req.params;
    const idempresa = req.idempresa;

    try {
        const result = await pool.query(
            `SELECT idfuncionario, foto, nome, cpf, rg, fluencia, idiomasadicionais,
                    celularpessoal, celularfamiliar, email, site, codigobanco, pix,
                    numeroconta, digitoconta, agencia, digitoagencia, tipoconta,
                    cep, rua, numero, complemento, bairro, cidade, estado, pais,
                    datanascimento, nomefamiliar, apelido, pcd
             FROM funcionarios WHERE cpf = $1`,
            [cpf]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "CPF não encontrado." });
        }

        const funcionario = result.rows[0];

        const vinculoAtual = await pool.query(
            `SELECT 1 FROM funcionarioempresas WHERE idfuncionario = $1 AND idempresa = $2`,
            [funcionario.idfuncionario, idempresa]
        );

        if (vinculoAtual.rowCount > 0) {
            return res.json({
                existeNaEmpresaAtual: true,
                idfuncionario: funcionario.idfuncionario,
                dados: funcionario
            });
        }

        const empresasVinculadas = await pool.query(
            `SELECT e.nmfantasia FROM funcionarioempresas fe
             INNER JOIN empresas e ON e.idempresa = fe.idempresa
             WHERE fe.idfuncionario = $1`,
            [funcionario.idfuncionario]
        );

        // Sugestão de vínculo (perfil, dados de contrato etc.) vinda do vínculo já
        // existente mais recente — não é "verdade" pra empresa nova, é só ponto de
        // partida editável, já que na maioria dos casos esses dados se repetem entre
        // empresas do grupo. O usuário confere e ajusta antes de salvar.
        const vinculoExemplo = await pool.query(
            `SELECT perfil, lote, ativo, bonificado, mei, funcao, cbo, admissao, salario,
                    dependentes, dependentesdados, valealim, valetrnsp, adesaoplanosaude, tipoplanosaude
             FROM funcionarioempresas
             WHERE idfuncionario = $1
             ORDER BY id DESC LIMIT 1`,
            [funcionario.idfuncionario]
        );

        return res.json({
            existeNaEmpresaAtual: false,
            idfuncionario: funcionario.idfuncionario,
            empresasVinculadas: empresasVinculadas.rows.map(r => r.nmfantasia),
            dados: { ...funcionario, ...(vinculoExemplo.rows[0] || {}) }
        });
    } catch (error) {
        console.error("Erro ao verificar CPF do funcionário:", error);
        res.status(500).json({ message: "Erro ao verificar CPF." });
    }
});
// Planos de saude para o cadastro de funcionarios. Usa a permissao de Funcionarios
// (quem cadastra funcionario pode listar planos/tipos, sem precisar do modulo PlanoSaude).
router.get("/planos-saude", verificarPermissao('Funcionarios', 'pesquisar'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT nomeplano AS nome, COUNT(*)::int AS qtdtipos
         FROM tipoplanosaude
        WHERE idempresa = $1 AND ativo = true
        GROUP BY nomeplano
        ORDER BY lower(nomeplano)`,
      [req.idempresa]
    );
    res.json(rows);
  } catch (error) {
    console.error("Erro ao listar planos de saude (funcionarios):", error);
    res.status(500).json({ message: "Erro ao listar planos de saude." });
  }
});

// Tipos (com id) de um plano especifico, para o segundo select.
router.get("/planos-saude/:nome/tipos", verificarPermissao('Funcionarios', 'pesquisar'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT idtipoplanosaude, nometipo
         FROM tipoplanosaude
        WHERE idempresa = $1 AND lower(nomeplano) = lower($2) AND ativo = true
        ORDER BY lower(nometipo)`,
      [req.idempresa, req.params.nome]
    );
    res.json(rows);
  } catch (error) {
    console.error("Erro ao listar tipos de plano (funcionarios):", error);
    res.status(500).json({ message: "Erro ao listar tipos de plano." });
  }
});

// GET todas ou por descrição
router.get("/", verificarPermissao("Funcionarios", "pesquisar"), async (req, res) => {
    const { nome } = req.query;
    const idempresa = req.idempresa;

    console.log("ROTA FUNCIONARIOS", nome, idempresa);
    try {
        const camposSelect = `
                func.idfuncionario, func.foto, func.nome, func.cpf, func.rg, func.fluencia, func.idiomasadicionais,
                func.celularpessoal, func.celularfamiliar, func.email, func.site, func.codigobanco, func.pix,
                func.numeroconta, func.digitoconta, func.agencia, func.digitoagencia, func.tipoconta,
                func.cep, func.rua, func.numero, func.complemento, func.bairro, func.cidade, func.estado, func.pais,
                func.datanascimento, func.nomefamiliar, func.apelido, func.pcd,
                funce.perfil, funce.lote, funce.ativo, funce.bonificado, funce.mei, funce.salario, funce.funcao, funce.cbo,
                funce.dependentes, funce.admissao, funce.valealim, funce.valetrnsp, funce.adesaoplanosaude,
                funce.tipoplanosaude, funce.dependentesdados`;

        if (nome) {
            // Busca funcionário por nome na empresa específica, ignorando acento (unaccent) —
            // "Marcia" também acha "Márcia". Sem LIMIT: se duas pessoas diferentes baterem
            // (ex.: "Marcia" e "Márcia" cadastradas separadamente), não adivinha qual é —
            // devolve as opções pro front pedir pra escolher em vez de carregar a errada.
            const result = await pool.query(
                `SELECT ${camposSelect}, tp.nomeplano AS nomeplanosaude, tp.nometipo AS nometiposaude
                 FROM funcionarios func
                 INNER JOIN funcionarioempresas funce ON funce.idfuncionario = func.idfuncionario
                 LEFT JOIN tipoplanosaude tp ON tp.idtipoplanosaude = func.idtipoplanosaude
                 WHERE funce.idempresa = $1 AND  unaccent(func.nome) ILIKE unaccent($2)
                 ORDER BY func.nome ASC`,
                [idempresa, nome] // Use % para pesquisa parcial se for o caso
                // [idempresa, `%${nome}%`]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ message: "Funcionário não encontrado." });
            }
            if (result.rows.length > 1) {
                return res.json({
                    ambiguous: true,
                    opcoes: result.rows.map(r => ({
                        idfuncionario: r.idfuncionario,
                        nome: r.nome,
                        apelido: r.apelido
                    }))
                });
            }
            return res.json(result.rows[0]);
        } else {
            // Busca TODOS os funcionários associados à empresa do usuário logado
            const result = await pool.query(
                `SELECT ${camposSelect} FROM funcionarios func
                 INNER JOIN funcionarioempresas funce ON funce.idfuncionario = func.idfuncionario
                 WHERE funce.idempresa = $1 ORDER BY func.nome ASC`,
                [idempresa]
            );
            return result.rows.length
                ? res.json(result.rows)
                : res.status(404).json({ message: "Nenhum funcionário encontrado para esta empresa." });
        }
    } catch (error) {
        console.error("Erro ao buscar funcionário:", error);
        res.status(500).json({ message: "Erro ao buscar funcionário." });
    }
});


// PUT atualizar
router.put("/:id",
    verificarPermissao('Funcionarios', 'alterar'),
    upload.single('foto'), // Middleware do Multer para o campo 'foto'
    logMiddleware('Funcionarios', {
        buscarDadosAnteriores: async (req) => {
            const idFuncionario = req.params.id;
            const idempresa = req.idempresa;
            if (!idFuncionario) {
                return { dadosanteriores: null, idregistroalterado: null };
            }
            try {
                const result = await pool.query(
                    `SELECT func.idfuncionario, func.foto, func.nome, func.cpf, func.rg, func.fluencia, func.idiomasadicionais,
                            func.celularpessoal, func.celularfamiliar, func.email, func.site, func.codigobanco, func.pix,
                            func.numeroconta, func.digitoconta, func.agencia, func.digitoagencia, func.tipoconta,
                            func.cep, func.rua, func.numero, func.complemento, func.bairro, func.cidade, func.estado, func.pais,
                            func.datanascimento, func.nomefamiliar, func.apelido, func.pcd,
                            funce.perfil, funce.lote, funce.ativo, funce.bonificado, funce.mei, funce.salario, funce.funcao, funce.cbo,
                            funce.dependentes, funce.admissao, funce.valealim, funce.valetrnsp, funce.adesaoplanosaude,
                            funce.tipoplanosaude, funce.dependentesdados
                     FROM funcionarios func
                     INNER JOIN funcionarioempresas funce ON funce.idfuncionario = func.idfuncionario
                     WHERE func.idfuncionario = $1 AND funce.idempresa = $2`,
                    [idFuncionario, idempresa]
                );
                const linha = result.rows[0] || null;
                return {
                    dadosanteriores: linha,
                    idregistroalterado: linha?.idfuncionario || null
                };
            } catch (error) {
                console.error("Erro ao buscar dados anteriores do funcionário para log:", error);
                return { dadosanteriores: null, idregistroalterado: null };
            }
        }
    }),
    async (req, res) => {
        const id = req.params.id;
        const idempresa = req.idempresa;
       
        const {
            perfil, nome, cpf, rg, nivelFluenciaLinguas, idiomasAdicionais,
            celularPessoal, celularFamiliar, email, site, codigoBanco, pix, // ADICIONADO 'banco'
            numeroConta, digitoConta, agencia, digitoAgencia, tipoConta, cep, rua, numero, complemento, bairro,
            cidade, estado, pais, dataNascimento, nomeFamiliar, apelido, pcd, lote, ativo, bonificado, mei, salario, funcao, cbo, dependentes, admissao, valealim, valetrnsp,
            adesaoPlanoSaude, tipoPlanoSaude, idTipoPlanoSaude, dependentesDados
        } = req.body;

        // dependentesDados chega como string JSON (FormData). Normaliza para um
        // array válido antes de gravar no JSONB; qualquer coisa inesperada vira [].
        let dependentesDadosJson = '[]';
        try {
            const parsed = typeof dependentesDados === 'string' ? JSON.parse(dependentesDados || '[]') : (dependentesDados || []);
            dependentesDadosJson = JSON.stringify(Array.isArray(parsed) ? parsed : []);
        } catch (e) {
            dependentesDadosJson = '[]';
        }

        let fotoPathParaBD = null;
        let client; // Usaremos um cliente do pool para transação

        try {
            client = await pool.connect();
            await client.query('BEGIN'); // Inicia a transação

            // Adicione console.logs para depurar os valores recebidos
            console.log('--- Início da requisição PUT ---');
            console.log('req.body:', req.body);
            console.log('req.file:', req.file);
            console.log('ID do funcionário (param):', id);
            console.log('ID da empresa (req.idempresa):', idempresa);
            console.log('Valor de "perfil" após desestruturação:', perfil);

            // 1. Lógica para determinar o caminho da foto
            if (req.file) {
                // Se um novo arquivo foi enviado, use o caminho do novo arquivo
                // E converta barras invertidas para barras normais para compatibilidade de caminho
                fotoPathParaBD = path.join('uploads/fotos_funcionarios', req.file.filename).replace(/\\/g, '/');

                // Apagar foto antiga se uma nova for enviada
                const resultFotoAntiga = await client.query( // Usar 'client' para manter na transação
                    `SELECT foto FROM funcionarios WHERE idfuncionario = $1`,
                    [id]
                );
                if (resultFotoAntiga.rows.length > 0 && resultFotoAntiga.rows[0].foto) {
                    const fotoAntigaPath = path.join(__dirname, '..', resultFotoAntiga.rows[0].foto);
                    // Verifique se o arquivo existe antes de tentar apagar
                    if (fs.existsSync(fotoAntigaPath)) {
                        fs.unlink(fotoAntigaPath, (err) => {
                            if (err) console.error("Erro ao apagar foto antiga:", err);
                        });
                    }
                }
            } else {
                // Se nenhum novo arquivo foi enviado, MANTENHA o caminho da foto existente no BD
                // OU defina como NULL se a intenção for remover a foto sem upload de nova
                const resultFotoExistente = await client.query( // Usar 'client' para manter na transação
                    `SELECT foto FROM funcionarios WHERE idfuncionario = $1`,
                    [id]
                );
                fotoPathParaBD = resultFotoExistente.rows[0]?.foto || null;
            }

            // --- Validação do campo 'perfil' ---
            // Se 'perfil' não é permitido ser nulo ou vazio no BD, force um erro aqui.
            if (!perfil || perfil.trim() === '') {
                // Se chegar aqui, significa que o frontend enviou um valor inválido,
                // ou o Multer/Express o transformou em vazio/nulo.
                // Reverter a transação e enviar erro 400.
                if (req.file) { // Se um arquivo foi carregado, apaga ele antes de sair
                    fs.unlink(req.file.path, (err) => {
                        if (err) console.error("Erro ao apagar upload de PUT falho (perfil inválido):", err);
                    });
                }
                await client.query('ROLLBACK');
                return res.status(400).json({ message: "O campo 'perfil' é obrigatório e não pode ser vazio." });
            }


            // 2. Atualiza os dados PESSOAIS em `funcionarios`
            // (perfil/lote/ativo/bonificado/mei/salario/funcao/cbo/dependentes/admissao/
            // valealim/valetrnsp/adesaoplanosaude/tipoplanosaude/dependentesdados moram em
            // `funcionarioempresas` desde a migration 20260727_140000 e foram removidas de
            // `funcionarios` na 20260727_150000 — quem grava esses campos é o UPDATE abaixo.)
            const queryPessoal = `
                UPDATE funcionarios func
                SET foto = $1, nome = $2, cpf = $3, rg = $4, fluencia = $5, idiomasadicionais = $6,
                    celularpessoal = $7, celularfamiliar = $8, email = $9, site = $10, codigobanco = $11,
                    pix = $12, numeroconta = $13, digitoConta = $14, agencia = $15, digitoAgencia = $16, tipoconta = $17, cep = $18, rua = $19, numero = $20,
                    complemento = $21, bairro = $22, cidade = $23, estado = $24, pais = $25, datanascimento = $26, nomefamiliar = $27, apelido = $28, pcd = $29, idtipoplanosaude = $30
                WHERE func.idfuncionario = $31
                  AND EXISTS (SELECT 1 FROM funcionarioempresas fe WHERE fe.idfuncionario = func.idfuncionario AND fe.idempresa = $32)
                RETURNING func.idfuncionario, func.foto;
            `;

            const valuesPessoal = [
                fotoPathParaBD, nome, cpf, rg, nivelFluenciaLinguas, idiomasAdicionais,
                celularPessoal, celularFamiliar, email, site, codigoBanco,
                pix, numeroConta, digitoConta, agencia, digitoAgencia, tipoConta, cep, rua, numero,
                complemento, bairro, cidade, estado, pais,
                dataNascimento, nomeFamiliar, apelido, pcd,
                vazioParaNull(idTipoPlanoSaude),
                id, idempresa, // ID do funcionário e empresa para a cláusula WHERE
            ];

            const result = await client.query(queryPessoal, valuesPessoal);

            if (result.rowCount) {
                // 3. Atualiza os dados de VÍNCULO (por empresa) em `funcionarioempresas`
                await client.query(
                    `UPDATE funcionarioempresas
                     SET perfil = $1, lote = $2, ativo = $3, bonificado = $4, mei = $5, salario = $6, funcao = $7,
                         cbo = $8, dependentes = $9, admissao = $10, valealim = $11, valetrnsp = $12,
                         adesaoplanosaude = $13, tipoplanosaude = $14, dependentesdados = $15
                     WHERE idfuncionario = $16 AND idempresa = $17`,
                    [
                        perfil, lote, ativo, bonificado, mei,
                        vazioParaNull(salario), funcao, vazioParaNull(cbo), vazioParaNull(dependentes), vazioParaNull(admissao), vazioParaNull(valealim), vazioParaNull(valetrnsp),
                        adesaoPlanoSaude, tipoPlanoSaude, dependentesDadosJson,
                        id, idempresa
                    ]
                );

                const funcionarioAtualizadoId = result.rows[0].idfuncionario;

                await client.query("COMMIT"); // Confirma a transação

                res.locals.acao = "atualizou";
                res.locals.idregistroalterado = funcionarioAtualizadoId;
                res.locals.idusuarioAlvo = null;
                res.locals.dadosnovos = req.body;

                return res.json({
                    message: "Funcionário atualizado com sucesso!",
                    id: funcionarioAtualizadoId,
                    fotoPath: result.rows[0].foto // Retorna o caminho da foto que foi salvo
                });
            } else {
                // Se nenhum funcionário foi encontrado ou não pertence à empresa do usuário
                if (req.file) { // Se houve upload mas a atualização falhou, apaga o arquivo
                    fs.unlink(req.file.path, (err) => {
                        if (err) console.error("Erro ao apagar arquivo de upload (PUT falho):", err);
                    });
                }
                await client.query("ROLLBACK"); // Reverte a transação
                return res.status(404).json({ message: "Funcionário não encontrado ou você não tem permissão para atualizá-lo." });
            }
        } catch (error) {
            if (client) {
                await client.query('ROLLBACK'); // Reverte a transação em caso de erro
            }
            console.error("Erro ao atualizar funcionário:", error);
            if (req.file) { // Se houve upload e erro, apaga o arquivo
                fs.unlink(req.file.path, (err) => {
                    if (err) console.error("Erro ao apagar arquivo de upload (PUT erro):", err);
                });
            }
            // Mensagem de erro mais específica para não-nulo
            if (error.code === '23502') { // PostgreSQL error code for not-null constraint violation
                 return res.status(400).json({ message: `Campo obrigatório faltando ou inválido: ${error.column}. Por favor, verifique os dados e tente novamente.` });
            }
            if (error.code === '22007') { // Código PostgreSQL para sintaxe de data inválida
                return res.status(400).json({
                    message: "A Data de Nascimento é obrigatória ou está em um formato inválido. Por favor, verifique.",
                    field: "dataNascimento" // Adiciona um campo para identificar qual input
                });
            }
            res.status(500).json({ message: "Erro ao atualizar funcionário." });
        } finally {
            if (client) {
                client.release(); // Libera o cliente de volta para o pool
            }
            console.log('--- Fim da requisição PUT ---');
        }
    }
);

// POST criar novo funcionário
router.post("/",
    verificarPermissao('Funcionarios', 'cadastrar'),
    upload.single('foto'), // Middleware do Multer para o campo 'foto'
    logMiddleware('Funcionarios', {
        buscarDadosAnteriores: async (req) => {
            return { dadosanteriores: null, idregistroalterado: null };
        }
    }),
    async (req, res) => {
        // req.body agora é preenchido pelo Multer para campos de texto
        // Adicione 'banco' aqui e verifique 'nivelFluenciaLinguas'
        console.log('--- Início da requisição POST ---');
        console.log('req.body:', req.body);
        const {
            perfil, nome, cpf, rg, nivelFluenciaLinguas, idiomasAdicionais, celularPessoal, celularFamiliar,
            email, site, codigoBanco, pix, numeroConta, digitoConta, agencia, digitoAgencia, tipoConta, cep, rua, numero, // ADICIONADO 'banco'
            complemento, bairro, cidade, estado, pais, dataNascimento, nomeFamiliar, apelido, pcd, lote, ativo, bonificado, mei, salario, funcao, cbo, dependentes,admissao, valealim, valetrnsp,
            adesaoPlanoSaude, tipoPlanoSaude, idTipoPlanoSaude, dependentesDados
        } = req.body;

        // dependentesDados chega como string JSON (FormData). Normaliza para array.
        let dependentesDadosJson = '[]';
        try {
            const parsed = typeof dependentesDados === 'string' ? JSON.parse(dependentesDados || '[]') : (dependentesDados || []);
            dependentesDadosJson = JSON.stringify(Array.isArray(parsed) ? parsed : []);
        } catch (e) {
            dependentesDadosJson = '[]';
        }

        const idempresa = req.idempresa;
        let client;
        let fotoPathParaBD = null; // Inicializa com null

        // Adicione console.logs para depurar os valores recebidos
        console.log('--- Início da requisição POST ---');
        console.log('req.body:', req.body);
        console.log('req.file:', req.file);
        console.log('ID da empresa (req.idempresa):', idempresa);
        console.log('Valor de "perfil" após desestruturação:', perfil);

        if (req.file) {
            // Se uma foto foi enviada, use o caminho gerado pelo Multer
            fotoPathParaBD = path.join('uploads/fotos_funcionarios', req.file.filename).replace(/\\/g, '/');
        }

        try {
            client = await pool.connect();
            await client.query('BEGIN');

            // --- Validação do campo 'perfil' para POST ---
            if (!perfil || perfil.trim() === '') {
                if (req.file) {
                    fs.unlink(req.file.path, (err) => {
                        if (err) console.error("Erro ao apagar upload de POST falho (perfil inválido):", err);
                    });
                }
                await client.query('ROLLBACK');
                return res.status(400).json({ message: "O campo 'perfil' é obrigatório e não pode ser vazio." });
            }

            // --- Funcionário com este CPF já existe (em qualquer empresa)? ---
            // A tabela Funcionarios guarda os dados pessoais de forma global (CPF/RG/e-mail
            // são UNIQUE sem escopo de empresa) — a mesma pessoa pode atuar em várias
            // empresas. Nesse caso não duplicamos o cadastro: apenas vinculamos o
            // funcionário já existente à empresa atual via FuncionarioEmpresas.
            const funcionarioExistente = await client.query(
                `SELECT idfuncionario FROM funcionarios WHERE cpf = $1`,
                [cpf]
            );

            if (funcionarioExistente.rowCount > 0) {
                const idFuncionarioExistente = funcionarioExistente.rows[0].idfuncionario;

                const vinculoExistente = await client.query(
                    `SELECT 1 FROM funcionarioempresas WHERE idfuncionario = $1 AND idempresa = $2`,
                    [idFuncionarioExistente, idempresa]
                );

                if (req.file) {
                    fs.unlink(req.file.path, (err) => {
                        if (err) console.error("Erro ao apagar upload de POST (funcionário já existente):", err);
                    });
                }

                if (vinculoExistente.rowCount > 0) {
                    await client.query('ROLLBACK');
                    return res.status(409).json({
                        message: 'Já existe um funcionário cadastrado com este CPF.',
                        field: 'cpf'
                    });
                }

                await client.query(
                    `INSERT INTO FuncionarioEmpresas (
                        idFuncionario, idEmpresa, perfil, lote, ativo, bonificado, mei, salario, funcao, cbo,
                        dependentes, admissao, valealim, valetrnsp, adesaoplanosaude, tipoplanosaude, dependentesdados
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
                    [
                        idFuncionarioExistente, idempresa,
                        perfil, lote, ativo, bonificado, mei,
                        vazioParaNull(salario), funcao, vazioParaNull(cbo), vazioParaNull(dependentes), vazioParaNull(admissao), vazioParaNull(valealim), vazioParaNull(valetrnsp),
                        adesaoPlanoSaude, tipoPlanoSaude, dependentesDadosJson
                    ]
                );
                await client.query('COMMIT');

                res.locals.acao = 'vinculou';
                res.locals.idregistroalterado = idFuncionarioExistente;
                res.locals.idusuarioAlvo = null;

                return res.status(201).json({
                    message: "Funcionário já existente vinculado à empresa com sucesso!",
                    id: idFuncionarioExistente
                });
            }

            const resultFuncionario = await client.query(
                `INSERT INTO Funcionarios (
                    foto, nome, cpf, rg, fluencia, idiomasadicionais,
                    celularpessoal, celularfamiliar, email, site, codigobanco, pix,
                    numeroconta, digitoConta, agencia, digitoAgencia, tipoconta, cep, rua, numero, complemento, bairro,
                    cidade, estado, pais, datanascimento, nomefamiliar, apelido, pcd, idtipoplanosaude
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30)
                RETURNING idFuncionario, foto`, // Retorna o ID e o caminho da foto para o frontend
                [
                    fotoPathParaBD, nome, cpf, rg, nivelFluenciaLinguas, idiomasAdicionais,
                    celularPessoal, celularFamiliar, email, site, codigoBanco, pix,
                    numeroConta, digitoConta, agencia, digitoAgencia, tipoConta, cep, rua, numero, complemento, bairro,
                    cidade, estado, pais, dataNascimento, nomeFamiliar, apelido, pcd,
                    vazioParaNull(idTipoPlanoSaude)
                ]
            );
            const novoFuncionario = resultFuncionario.rows[0];
            const idNovoFuncionario = novoFuncionario.idfuncionario;

            await client.query(
                `INSERT INTO FuncionarioEmpresas (
                    idFuncionario, idEmpresa, perfil, lote, ativo, bonificado, mei, salario, funcao, cbo,
                    dependentes, admissao, valealim, valetrnsp, adesaoplanosaude, tipoplanosaude, dependentesdados
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
                [
                    idNovoFuncionario, idempresa,
                    perfil, lote, ativo, bonificado, mei,
                    vazioParaNull(salario), funcao, vazioParaNull(cbo), vazioParaNull(dependentes), vazioParaNull(admissao), vazioParaNull(valealim), vazioParaNull(valetrnsp),
                    adesaoPlanoSaude, tipoPlanoSaude, dependentesDadosJson
                ]
            );
            await client.query('COMMIT');

            res.locals.acao = 'cadastrou';
            res.locals.idregistroalterado = idNovoFuncionario;
            res.locals.idusuarioAlvo = null;
            res.locals.dadosnovos = { // ✅ Combina ID + foto + todos os dados enviados
                idfuncionario: idNovoFuncionario,
                foto: novoFuncionario.foto,
                perfil, nome, cpf, rg, nivelFluenciaLinguas, idiomasAdicionais,
                celularPessoal, celularFamiliar, email, site, codigoBanco, pix,
                numeroConta, digitoConta, agencia, digitoAgencia, tipoConta,
                cep, rua, numero, complemento, bairro, cidade, estado, pais,
                dataNascimento, nomeFamiliar, apelido, pcd, lote, ativo, bonificado, mei, salario, funcao, cbo, dependentes, admissao, valealim, valetrnsp,
                adesaoPlanoSaude, tipoPlanoSaude
            };
            
            res.status(201).json({
                message: "Funcionário salvo e associado à empresa com sucesso!",
                id: idNovoFuncionario,
                fotoPath: novoFuncionario.foto // Retorna o caminho da foto
            });
        } catch (error) {
            if (client) {
                await client.query('ROLLBACK');
            }
            console.error("❌ Erro ao salvar funcionário e/ou associá-lo à empresa:", error);

            // Se houve upload e o banco de dados falhou, apaga o arquivo
            if (req.file && req.file.path && fs.existsSync(req.file.path)) {
                fs.unlink(req.file.path, (err) => {
                    if (err) console.error("Erro ao apagar arquivo de upload falho:", err);
                });
            }
            
            if (error.code === '23505') { // '23505' é o código para restrição de unicidade
                if (error.constraint === 'funcionarios_email_key') {
                    return res.status(409).json({
                        message: 'Já existe um funcionário cadastrado com este e-mail.',
                        field: 'email'
                    });
                }
                if (error.constraint === 'funcionarios_cpf_key') {
                    return res.status(409).json({
                        message: 'Já existe um funcionário cadastrado com este CPF.',
                        field: 'cpf'
                    });
                }
                if (error.constraint === 'funcionarios_rg_key') {
                    return res.status(409).json({
                        message: 'Já existe um funcionário cadastrado com este RG.',
                        field: 'rg'
                    });
                }
            }
            
            // Tratamento de erros de campos obrigatórios
            if (error.code === '23502') {
                return res.status(400).json({
                    message: `Campo obrigatório faltando ou inválido: ${error.column}.`
                });
            }

            // Tratamento de erro de data inválida
            if (error.code === '22007') {
                return res.status(400).json({
                    message: "A Data de Nascimento está em um formato inválido.",
                    field: "dataNascimento"
                });
            }

            res.status(500).json({ error: "Erro ao salvar funcionário." });
        } finally {
            if (client) {
                client.release();
            }
            console.log('--- Fim da requisição POST ---');
        }
    }
);

module.exports = router;

