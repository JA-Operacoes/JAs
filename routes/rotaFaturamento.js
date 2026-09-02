// routes/rotaFaturamento.js
// Faturamento / Emissão de Nota Fiscal — Fase A (painel semi-automatico).
//
// Esta rota:
//   1) mostra quais orçamentos fechados ainda têm saldo a faturar;
//   2) gera e assina o XML do RPS individual (GET /:id/xml — usado pra
//      inspeção/conferência, "Ver XML");
//   3) ENVIA de verdade o lote assinado pro Web Service síncrono da
//      prefeitura (POST /xml-lote/enviar — descobrimos que não há upload
//      manual de arquivo pra layout com CBS/IBS, só Online ou Web Service,
//      então esse é o único caminho pra emitir de fato através do sistema);
//   4) registra o resultado (número da nota, tributos, status) de volta,
//      pra manter o controle de faturamento visível dentro do JA System.
//
// Os valores de tributos (ISS, IRRF, PIS/COFINS/CSLL, CBS, IBS) são
// calculados no front a partir dos parâmetros vigentes e enviados prontos —
// aqui só são congelados na tabela, sem recálculo no backend.

const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { autenticarToken, contextoEmpresa } = require('../middlewares/authMiddlewares');
const { verificarPermissao, exigirFlag } = require('../middlewares/permissaoMiddleware');
const logMiddleware = require('../middlewares/logMiddleware');
const { gerarXmlPedidoEnvioLoteRPS } = require('../utils/gerarXmlRpsLote');
const { obterCertificadoEmpresa } = require('../utils/certificadoEmpresa');
const { carregarCertificado } = require('../utils/assinarXmlRpsLote');
const { enviarLoteRPS } = require('../utils/enviarLoteWebService');
const { montarXmlCancelamentoNFe } = require('../utils/gerarXmlCancelamentoNFe');
const { enviarEmailComAnexo } = require('../utils/enviarEmail');
const { buscarCodigoIbge } = require('../utils/buscarMunicipioIbge');
const { buscarSimplesNacional } = require('../utils/buscarSimplesNacional');
const registrarLog = require('../utils/logger');

router.use(autenticarToken());
router.use(contextoEmpresa);

// --- Upload do PDF/comprovante baixado do portal ---------------------------
const dirNotasFiscais = path.join(__dirname, '../uploads/notasfiscais');
if (!fs.existsSync(dirNotasFiscais)) {
  fs.mkdirSync(dirNotasFiscais, { recursive: true });
}

// --- Cópia dos XMLs gerados, pra não depender só do download do navegador --
const dirNotasParaEnvio = path.join(__dirname, '../uploads/notasparaenvio');
if (!fs.existsSync(dirNotasParaEnvio)) {
  fs.mkdirSync(dirNotasParaEnvio, { recursive: true });
}

// --- 2ª cópia, numa pasta separada (fora do uploads/, que é versionado pelo
// git) pensada pra ser compartilhada em rede com a máquina do financeiro —
// ele copia o XML direto dali pra subir no portal da prefeitura. Se esse
// compartilhamento cair ou o arquivo sumir de lá por qualquer motivo, a
// cópia em uploads/notasparaenvio continua intacta como backup.
const dirXmlParaEnviarRede = path.join(__dirname, '../xmlparaenviar');
if (!fs.existsSync(dirXmlParaEnviarRede)) {
  fs.mkdirSync(dirXmlParaEnviarRede, { recursive: true });
}

// --- Rastro de cada tentativa de envio pro Web Service (pedido + resposta),
// independente do resultado — serve pra conferência manual quando o desfecho
// for "Rejeitada"/"Envio Incerto", não é a cópia que o financeiro usa.
const dirEnviosWebService = path.join(__dirname, '../uploads/notasparaenvio/envios-webservice');
if (!fs.existsSync(dirEnviosWebService)) {
  fs.mkdirSync(dirEnviosWebService, { recursive: true });
}

// Só avisa no log se essa 2ª cópia falhar (ex.: pasta de rede fora do ar) —
// nunca derruba a geração do XML por causa disso, já que uploads/notasparaenvio
// (gravado separado, ver chamadas abaixo) é a cópia que garante o backup.
function salvarCopiaParaRede(nomeArquivo, xml) {
  try {
    fs.writeFileSync(path.join(dirXmlParaEnviarRede, nomeArquivo), xml, 'utf8');
  } catch (err) {
    console.error(`Não consegui salvar cópia de ${nomeArquivo} em xmlparaenviar/:`, err.message);
  }
}

const storageNotaFiscal = multer.diskStorage({
  destination: (req, file, cb) => cb(null, dirNotasFiscais),
  filename: (req, file, cb) => {
    const id = req.params.id || '0';
    const dataHoje = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `nf-ID${id}-${dataHoje}${ext}`);
  }
});

const uploadNotaFiscal = multer({
  storage: storageNotaFiscal,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Apenas PDF ou imagem são permitidos!'), false);
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }
}).single('arquivo');

// GET /faturamento/pendentes — orçamentos fechados da empresa, com faturado/saldo
// Filtros opcionais via querystring: idcliente, idevento, idempresaemissora,
// dtRealizacaoDe/dtRealizacaoAte, dtVencimentoDe/dtVencimentoAte. Com só uma
// ponta de um período preenchida, filtra a data exata; com as duas, filtra o
// intervalo. Vencimento é da PARCELA (orcamentoparcelas), não do orçamento —
// um orçamento parcelado casa se QUALQUER parcela vencer dentro do período.
router.get("/pendentes", verificarPermissao('faturamento', 'pesquisar'), async (req, res) => {
  const idempresa = req.idempresa;
  const { idcliente, idevento, idempresaemissora, statusFatura } = req.query;
  let { dtRealizacaoDe, dtRealizacaoAte, dtVencimentoDe, dtVencimentoAte } = req.query;

  if (dtRealizacaoDe && !dtRealizacaoAte) dtRealizacaoAte = dtRealizacaoDe;
  if (dtRealizacaoAte && !dtRealizacaoDe) dtRealizacaoDe = dtRealizacaoAte;
  if (dtVencimentoDe && !dtVencimentoAte) dtVencimentoAte = dtVencimentoDe;
  if (dtVencimentoAte && !dtVencimentoDe) dtVencimentoDe = dtVencimentoAte;

  try {
    const result = await pool.query(
      `SELECT
         o.idorcamento, o.nrorcamento, o.vlrcliente,
         o.idcliente, c.razaosocial AS cliente_nome, c.nmfantasia AS cliente_nmfantasia,
         o.idevento, e.nmevento AS evento_nome,
         o.idempresaemissora, em.nmfantasia AS emissora_nome,
         o.dtinirealizacao, o.dtfimrealizacao,
         o.formapagamento,
         lm.cidademontagem AS evento_cidade, lm.ufmontagem AS evento_uf,
         COALESCE(nf.faturado, 0) AS faturado,
         (o.vlrcliente - COALESCE(nf.faturado, 0)) AS saldo,
         prox.proximovencimento,
         COALESCE(parc.totalparcelas, 0) AS totalparcelas,
         COALESCE(parc.parcelaspagas, 0) AS parcelaspagas,
         COALESCE(recb.pago, 0) AS pago,
         COALESCE(recb.atrasadorecebimento, 0) AS atrasadorecebimento,
         (oe.idempresa = $1) AS proprioambiente,
         oe_emp.nmfantasia AS ambienteorigem_nome
       FROM orcamentos o
       -- Empréstimo entre ambientes (2026-08-26): o ambiente 1 (JA-OPER) é
       -- historicamente onde a maioria dos orçamentos/notas é processada de
       -- verdade, mesmo quando a empresa emissora é outra (2, 3, 4, 5, 6...).
       -- Pra quem está logado num ambiente diferente de 1, além do que é
       -- realmente dele (oe.idempresa = $1), também mostramos (só visualização,
       -- "Emitir nota" fica oculto — ver proprioambiente acima) os orçamentos
       -- presos no ambiente 1 cuja empresa emissora bate com o ambiente atual.
       -- Quem está no próprio ambiente 1 não é afetado (a 2ª condição já fica
       -- redundante quando $1 = 1).
       JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
         AND (oe.idempresa = $1 OR (oe.idempresa = 1 AND o.idempresaemissora = $1))
       LEFT JOIN empresas oe_emp ON oe_emp.idempresa = oe.idempresa
       LEFT JOIN clientes c ON c.idcliente = o.idcliente
       LEFT JOIN eventos e ON e.idevento = o.idevento
       LEFT JOIN empresas em ON em.idempresa = o.idempresaemissora
       LEFT JOIN localmontagem lm ON lm.idmontagem = o.idmontagem
       LEFT JOIN (
         -- "Faturado" exige status = 'Emitida' (confirmado pela prefeitura),
         -- não basta "Pronta para Envio" — essa é registrada localmente mas
         -- pode nunca ter sido enviada de verdade; contar como faturado
         -- daria um saldo zerado falso pro financeiro (2026-08-26).
         SELECT idorcamento, SUM(valorservico) AS faturado
         FROM notasfiscais
         WHERE status = 'Emitida'
         GROUP BY idorcamento
       ) nf ON nf.idorcamento = o.idorcamento
       LEFT JOIN (
         -- Vencimento da PRÓXIMA parcela ainda aberta. Parcelado e à vista
         -- usam a mesma orcamentoparcelas (à vista fecha com uma linha só,
         -- valor cheio) — não tem coluna de vencimento separada em
         -- orcamentos de propósito, pra não duplicar essa informação.
         SELECT idorcamento, MIN(dtvencimento) AS proximovencimento
         FROM orcamentoparcelas
         WHERE status = 'Aberta'
         GROUP BY idorcamento
       ) prox ON prox.idorcamento = o.idorcamento
       LEFT JOIN (
         SELECT idorcamento,
                COUNT(*) AS totalparcelas,
                COUNT(*) FILTER (WHERE status = 'Faturada') AS parcelaspagas
         FROM orcamentoparcelas
         GROUP BY idorcamento
       ) parc ON parc.idorcamento = o.idorcamento
       LEFT JOIN (
         -- Recebimento (regime de caixa) é sobre a NOTA já Emitida, não sobre
         -- o orçamento — "pago" soma o que já foi confirmado recebido;
         -- "atrasadorecebimento" soma o que ainda não foi confirmado E cujo
         -- vencimento (da parcela ligada à nota) já passou. Mesma distinção
         -- de "Emissão NF atrasada" (que é sobre não ter emitido a tempo) —
         -- aqui é sobre ter emitido mas o cliente não ter pago a tempo.
         SELECT nf.idorcamento,
                SUM(nf.valorservico) FILTER (WHERE nf.recebido = true) AS pago,
                SUM(nf.valorservico) FILTER (WHERE nf.recebido = false AND op.dtvencimento < CURRENT_DATE) AS atrasadorecebimento
         FROM notasfiscais nf
         LEFT JOIN orcamentoparcelas op ON op.idparcela = nf.idparcela
         WHERE nf.status = 'Emitida'
         GROUP BY nf.idorcamento
       ) recb ON recb.idorcamento = o.idorcamento
       WHERE o.status = 'F'
         AND ($2::int IS NULL OR o.idcliente = $2::int)
         AND ($3::int IS NULL OR o.idevento = $3::int)
         AND ($4::int IS NULL OR o.idempresaemissora = $4::int)
         AND ($5::date IS NULL OR o.dtinirealizacao BETWEEN $5::date AND $6::date)
         AND ($7::date IS NULL OR EXISTS (
               SELECT 1 FROM orcamentoparcelas op
                WHERE op.idorcamento = o.idorcamento
                  AND op.dtvencimento BETWEEN $7::date AND $8::date
             ))
         AND (
           $9::text IS NULL
           OR ($9 = 'faturada' AND (o.vlrcliente - COALESCE(nf.faturado, 0)) <= 0.009)
           OR ($9 = 'aberto' AND (o.vlrcliente - COALESCE(nf.faturado, 0)) > 0.009)
           OR ($9 = 'emissao-atrasada' AND (o.vlrcliente - COALESCE(nf.faturado, 0)) > 0.009
               AND prox.proximovencimento < CURRENT_DATE)
           OR ($9 = 'parcial' AND COALESCE(nf.faturado, 0) > 0
               AND (o.vlrcliente - COALESCE(nf.faturado, 0)) > 0.009)
         )
       ORDER BY prox.proximovencimento ASC NULLS LAST, o.nrorcamento DESC`,
      [
        idempresa,
        idcliente || null,
        idevento || null,
        idempresaemissora || null,
        dtRealizacaoDe || null,
        dtRealizacaoAte || null,
        dtVencimentoDe || null,
        dtVencimentoAte || null,
        statusFatura || null,
      ]
    );
    return res.json(result.rows);
  } catch (error) {
    console.error("Erro ao buscar orçamentos pendentes de faturamento:", error);
    res.status(500).json({ message: "Erro ao buscar orçamentos pendentes de faturamento." });
  }
});

// GET /faturamento/orcamento/:idorcamento — dados pra pré-popular a emissão
router.get("/orcamento/:idorcamento", verificarPermissao('faturamento', 'pesquisar'), async (req, res) => {
  const idempresa = req.idempresa;
  const { idorcamento } = req.params;

  try {
    const result = await pool.query(
      `SELECT
         o.idorcamento, o.nrorcamento, o.vlrcliente, o.formapagamento,
         o.dtinirealizacao, o.dtfimrealizacao,
         c.idcliente, c.razaosocial, c.nmfantasia AS cliente_nmfantasia, c.cnpj, c.tpcliente, c.inscricaomunicipal,
         c.rua, c.numero, c.complemento, c.bairro, c.cidade, c.estado, c.cep,
         ce.emailnfe,
         e.nmevento,
         lm.idmontagem, lm.descmontagem, lm.rua AS montagem_rua, lm.numero AS montagem_numero,
         lm.bairro AS montagem_bairro, lm.cep AS montagem_cep,
         lm.cidademontagem AS montagem_cidade, lm.ufmontagem AS montagem_uf,
         em.nmfantasia AS emissora_nome,
         b.nmbanco AS emissora_banconome,
         b.codbanco AS emissora_bancocodigo,
         em.agencia AS emissora_agencia,
         em.digitoagencia AS emissora_digitoagencia,
         em.numeroconta AS emissora_numeroconta,
         em.digitoconta AS emissora_digitoconta,
         em.tipoconta AS emissora_tipoconta,
         em.pix AS emissora_pix,
         COALESCE(fat.faturado, 0) AS faturado,
         (o.vlrcliente - COALESCE(fat.faturado, 0)) AS saldo
       FROM orcamentos o
       JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento AND oe.idempresa = $2
       LEFT JOIN clientes c ON c.idcliente = o.idcliente
       LEFT JOIN clienteempresas ce ON ce.idcliente = c.idcliente AND ce.idempresa = oe.idempresa
       LEFT JOIN eventos e ON e.idevento = o.idevento
       LEFT JOIN localmontagem lm ON lm.idmontagem = o.idmontagem
       LEFT JOIN empresas em ON em.idempresa = o.idempresaemissora
       LEFT JOIN bancos b ON b.idbanco = em.idbanco
       LEFT JOIN (
         -- "Faturado" exige status = 'Emitida' (confirmado pela prefeitura),
         -- não basta "Pronta para Envio" — essa é registrada localmente mas
         -- pode nunca ter sido enviada de verdade; contar como faturado
         -- daria um saldo zerado falso pro financeiro (2026-08-26).
         SELECT idorcamento, SUM(valorservico) AS faturado
         FROM notasfiscais
         WHERE status = 'Emitida'
         GROUP BY idorcamento
       ) fat ON fat.idorcamento = o.idorcamento
       WHERE o.idorcamento = $1`,
      [idorcamento, idempresa]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Orçamento não encontrado para esta empresa." });
    }
    return res.json(result.rows[0]);
  } catch (error) {
    console.error("Erro ao buscar dados do orçamento para emissão:", error);
    res.status(500).json({ message: "Erro ao buscar dados do orçamento." });
  }
});

// GET /faturamento/cliente/:idcliente/regime-simples — consulta ao vivo (BrasilAPI)
// se o cliente é optante do Simples Nacional, pra ajudar a decidir a
// retenção de IRRF/PIS-COFINS-CSLL na hora de emitir. Nunca falha com erro
// 500 nem bloqueia nada — na pior hipótese devolve optanteSimples:null e o
// front trata como "não deu pra saber, decida manualmente" (comportamento
// de hoje, sem automação).
router.get("/cliente/:idcliente/regime-simples", verificarPermissao('faturamento', 'pesquisar'), async (req, res) => {
  const idempresa = req.idempresa;
  const { idcliente } = req.params;

  try {
    const result = await pool.query(
      `SELECT c.cnpj
         FROM clientes c
         INNER JOIN clienteempresas ce ON ce.idcliente = c.idcliente AND ce.idempresa = $2
        WHERE c.idcliente = $1`,
      [idcliente, idempresa]
    );
    if (!result.rows.length) {
      return res.json({ optanteSimples: null, erro: "Cliente não encontrado." });
    }
    const { optanteSimples, erro } = await buscarSimplesNacional(result.rows[0].cnpj);
    return res.json({ optanteSimples, erro });
  } catch (error) {
    console.error("Erro ao consultar regime Simples Nacional do cliente:", error);
    return res.json({ optanteSimples: null, erro: "Erro interno ao consultar." });
  }
});

// GET /faturamento/orcamento/:idorcamento/historico — notas já registradas
router.get("/orcamento/:idorcamento/historico", verificarPermissao('faturamento', 'pesquisar'), async (req, res) => {
  const idempresa = req.idempresa;
  const { idorcamento } = req.params;

  try {
    const result = await pool.query(
      `SELECT nf.*, op.numparcela, op.dtvencimento,
              (SELECT COUNT(*) FROM orcamentoparcelas WHERE idorcamento = nf.idorcamento) AS totalparcelas
         FROM notasfiscais nf
         LEFT JOIN orcamentoparcelas op ON op.idparcela = nf.idparcela
        WHERE nf.idorcamento = $1 AND nf.idempresa = $2
        ORDER BY nf.dtregistro ASC`,
      [idorcamento, idempresa]
    );
    return res.json(result.rows);
  } catch (error) {
    console.error("Erro ao buscar histórico de notas do orçamento:", error);
    res.status(500).json({ message: "Erro ao buscar histórico de notas." });
  }
});

// GET /faturamento/orcamento/:idorcamento/parcelas — parcelas de pagamento
// (vazio quando o orçamento é à vista — front continua com o valor manual)
router.get("/orcamento/:idorcamento/parcelas", verificarPermissao('faturamento', 'pesquisar'), async (req, res) => {
  const idempresa = req.idempresa;
  const { idorcamento } = req.params;

  try {
    // "Rejeitada" NÃO conta como nota ativa pra travar a parcela — a
    // prefeitura confirmadamente não emitiu (mesma lógica de podeMarcarEmitida
    // no front), então bloquear um novo registro aqui só atrapalha sem
    // proteger nada. "Envio Incerto" continua travando de propósito — não
    // se sabe se foi processado, então registrar de novo sem conferir no
    // portal antes arriscaria duplicar (2026-09-01).
    const result = await pool.query(
      `SELECT op.*,
         (SELECT nf.idnotafiscal FROM notasfiscais nf
           WHERE nf.idparcela = op.idparcela AND nf.status NOT IN ('Cancelada', 'Rejeitada')
           ORDER BY nf.dtregistro DESC LIMIT 1) AS notaativaid,
         (SELECT nf.status FROM notasfiscais nf
           WHERE nf.idparcela = op.idparcela AND nf.status NOT IN ('Cancelada', 'Rejeitada')
           ORDER BY nf.dtregistro DESC LIMIT 1) AS notaativastatus
         FROM orcamentoparcelas op
         JOIN orcamentoempresas oe ON oe.idorcamento = op.idorcamento AND oe.idempresa = $2
        WHERE op.idorcamento = $1
        ORDER BY op.numparcela`,
      [idorcamento, idempresa]
    );
    return res.json(result.rows);
  } catch (error) {
    console.error("Erro ao buscar parcelas do orçamento:", error);
    res.status(500).json({ message: "Erro ao buscar parcelas do orçamento." });
  }
});

// PATCH /faturamento/parcela/:idparcela — corrige o vencimento da parcela
// aberta antes de gerar a nota (o financeiro percebe a data errada só na
// hora de emitir). Só mexe em parcela ainda 'Aberta' — depois de faturada
// o vencimento já virou histórico da nota emitida.
router.patch("/parcela/:idparcela", verificarPermissao('faturamento', 'alterar'), async (req, res) => {
  const idempresa = req.idempresa;
  const { idparcela } = req.params;
  const { dtvencimento } = req.body;

  if (!dtvencimento) {
    return res.status(400).json({ message: "Data de vencimento é obrigatória." });
  }

  try {
    const result = await pool.query(
      `UPDATE orcamentoparcelas op
          SET dtvencimento = $1
         FROM orcamentoempresas oe
        WHERE op.idparcela = $2
          AND oe.idorcamento = op.idorcamento
          AND oe.idempresa = $3
          AND op.status = 'Aberta'
        RETURNING op.*`,
      [dtvencimento, idparcela, idempresa]
    );

    if (!result.rowCount) {
      return res.status(404).json({ message: "Parcela não encontrada ou não está mais aberta." });
    }
    return res.json({ message: "Vencimento atualizado.", parcela: result.rows[0] });
  } catch (error) {
    console.error("Erro ao atualizar vencimento da parcela:", error);
    res.status(500).json({ message: "Erro ao atualizar vencimento da parcela." });
  }
});

// POST /notafiscal — registra uma nota (rascunho ou já emitida no portal)
// Restrito a "master" (pedido explícito) — igual ao resto do ciclo de vida
// da nota (enviar/cancelar).
router.post("/", verificarPermissao('faturamento', 'cadastrar'), exigirFlag('master'),
  logMiddleware('NotaFiscal', {
    buscarDadosAnteriores: async () => ({ dadosanteriores: null, idregistroalterado: null })
  }),
  async (req, res) => {
    const idempresa = req.idempresa;
    const {
      idorcamento, idcliente, idservico, idparcela, descricaoparcela, descricaoservico, municipioprestacao,
      valorservico, aliquotaiss, valoriss, valorirrf, valorpiscofinscsll, valorcbs, valoribs,
      meiopagamento, descricaomeiopagamento, observacao, status
    } = req.body;

    if (!idorcamento || !idcliente || !valorservico) {
      return res.status(400).json({ message: "Orçamento, cliente e valor do serviço são obrigatórios." });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      if (idparcela) {
        const parcela = await client.query(
          `SELECT idparcela FROM orcamentoparcelas
            WHERE idparcela = $1 AND idorcamento = $2 AND status = 'Aberta'`,
          [idparcela, idorcamento]
        );
        if (!parcela.rowCount) {
          throw new Error("Essa parcela não está mais aberta para faturamento.");
        }

        // A parcela em si só vira "Faturada" quando a nota é confirmada
        // Emitida (de propósito, pra não travar à toa por causa de um
        // rascunho descartável) — mas isso abre brecha pra registrar uma
        // 2ª nota pra mesma parcela enquanto a 1ª ainda está "Pronta para Envio".
        // Bloqueia aqui, direto pela tabela de notas.
        //
        // "Rejeitada" NÃO bloqueia mais (2026-09-01) — a prefeitura
        // confirmadamente não emitiu, então é só substituir; a nota antiga é
        // cancelada automaticamente mais abaixo, depois que a nova é criada
        // (evita depender de alguém lembrar de cancelar manualmente). "Envio
        // Incerto" continua bloqueando: não se sabe se foi processado,
        // então precisa resolver (conferir no portal, marcar Emitida ou
        // cancelar manualmente) antes de arriscar duplicar.
        const notaAtivaExistente = await client.query(
          `SELECT idnotafiscal FROM notasfiscais WHERE idparcela = $1 AND status NOT IN ('Cancelada', 'Rejeitada')`,
          [idparcela]
        );
        if (notaAtivaExistente.rowCount) {
          throw new Error("Essa parcela já tem uma nota ativa (Pronta para Envio, Emitida ou Envio Incerto). Resolva a nota existente antes de registrar outra.");
        }
      }

      const result = await client.query(
        `INSERT INTO notasfiscais (
           idempresa, idorcamento, idcliente, idservico, idparcela, descricaoparcela, descricaoservico,
           municipioprestacao, valorservico, aliquotaiss, valoriss, valorirrf, valorpiscofinscsll,
           valorcbs, valoribs, meiopagamento, descricaomeiopagamento, observacao,
           status, idusuarioregistro
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
         RETURNING *`,
        [
          idempresa, idorcamento, idcliente, idservico || null, idparcela || null, descricaoparcela || null, descricaoservico || null,
          municipioprestacao || null, valorservico, aliquotaiss || null, valoriss || null, valorirrf || null,
          valorpiscofinscsll || null, valorcbs || null, valoribs || null, meiopagamento || null,
          descricaomeiopagamento || null, observacao || null, status || 'Pronta para Envio', req.usuario.idusuario
        ]
      );

      // A parcela só vira "Faturada" quando a nota for confirmada como
      // Emitida (PUT /:id) — registrar aqui só gera o XML, e o financeiro
      // pode descartar/refazer sem a parcela ficar travada à toa.

      // Marca automaticamente qualquer nota Rejeitada antiga da mesma
      // parcela como "substituída" — de propósito NÃO muda o status pra
      // Cancelada: essa nota nunca foi cancelada de verdade, foi rejeitada
      // pela prefeitura, e "Canceladas" é pra cancelamento real (local ou na
      // prefeitura). dtsubstituicao só tira ela da fila de "precisa de
      // atenção" (aba Rejeitadas) sem apagar o motivo original — pedido
      // explícito pra manter histórico correto por status (2026-09-01).
      if (idparcela) {
        await client.query(
          `UPDATE notasfiscais
              SET dtsubstituicao = now(),
                  observacao = COALESCE(observacao || E'\n', '') ||
                    'Substituída automaticamente por nova nota registrada em ' || to_char(now(), 'DD/MM/YYYY HH24:MI') ||
                    '. Estava Rejeitada pela prefeitura' || COALESCE(': ' || mensagemenvio, '.')
            WHERE idparcela = $1 AND status = 'Rejeitada' AND dtsubstituicao IS NULL`,
          [idparcela]
        );
      }

      await client.query("COMMIT");

      const novaNota = result.rows[0];
      res.locals.acao = 'cadastrou';
      res.locals.idregistroalterado = novaNota.idnotafiscal;
      res.locals.dadosnovos = novaNota;

      res.status(201).json({ message: "Nota fiscal registrada com sucesso!", notafiscal: novaNota });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Erro ao registrar nota fiscal:", error);
      res.status(500).json({ message: "Erro ao registrar nota fiscal." });
    } finally {
      client.release();
    }
  });

// PUT /faturamento/:id — atualiza status/número da nota após emissão manual no portal
router.put("/:id", verificarPermissao('faturamento', 'alterar'),
  logMiddleware('NotaFiscal', {
    buscarDadosAnteriores: async (req) => {
      const result = await pool.query(
        `SELECT * FROM notasfiscais WHERE idnotafiscal = $1 AND idempresa = $2`,
        [req.params.id, req.idempresa]
      );
      const linha = result.rows[0] || null;
      return { dadosanteriores: linha, idregistroalterado: linha?.idnotafiscal || null };
    }
  }),
  async (req, res) => {
    const { id } = req.params;
    const idempresa = req.idempresa;
    const { status, numeronota, chaveacesso, codigoverificacao, observacao, dtemissao, justificativa } = req.body;

    // Mesma trava do "Cancelar NF na Prefeitura": cancelar sem querer aqui
    // também libera a parcela de volta pra "Aberta", então exige justificativa
    // antes — evita um clique errado destravar/perder o controle de uma
    // parcela sem deixar rastro do motivo.
    if (status === 'Cancelada' && !(justificativa || '').trim()) {
      return res.status(400).json({ message: "Informe a justificativa do cancelamento." });
    }

    // Cancelar é restrito a "master" (pedido explícito) — mas essa rota
    // também serve "Marcar emitida" e outras atualizações, então a checagem é
    // só aqui dentro, não na rota inteira (verificarPermissao/exigirFlag de
    // rota toda bloquearia ações que continuam liberadas pro financeiro comum).
    if (status === 'Cancelada') {
      const acessoMaster = await pool.query(
        `SELECT 1 FROM permissoes WHERE idusuario = $1 AND idempresa = $2 AND master = true LIMIT 1`,
        [req.usuario.idusuario, idempresa]
      );
      if (!acessoMaster.rowCount) {
        return res.status(403).json({ message: "Só usuários com permissão Master podem cancelar notas fiscais." });
      }
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const result = await client.query(
        `UPDATE notasfiscais
         SET status = COALESCE($1, status),
             numeronota = COALESCE($2, numeronota),
             chaveacesso = COALESCE($3, chaveacesso),
             codigoverificacao = COALESCE($4, codigoverificacao),
             observacao = COALESCE($5, observacao),
             -- Data de emissão: usa a informada manualmente (nota emitida
             -- direto no portal, marcada aqui depois do fato — "agora" seria
             -- errado); só cai pra now() se ninguém informou nada.
             dtemissao = COALESCE($8::date, CASE WHEN $1 = 'Emitida' AND dtemissao IS NULL THEN now() ELSE dtemissao END),
             -- Mesma coluna usada pelo cancelamento via Web Service (só muda
             -- de fato quando o status virando aqui é 'Cancelada'). Se a nota
             -- estava Rejeitada/Envio Incerto antes desse cancelamento manual,
             -- concatena esse motivo original na justificativa — senão o
             -- rastro em Canceladas só mostra o texto digitado na hora, sem
             -- contexto de que a prefeitura já tinha recusado/travado antes.
             justificativacancelamento = CASE WHEN $1 = 'Cancelada' THEN
               $9 || COALESCE(
                 (SELECT CASE WHEN status IN ('Rejeitada', 'Envio Incerto')
                              THEN E'\n[Estava como "' || status || '" pela prefeitura' || COALESCE(': ' || mensagemenvio, '') || ']'
                         END
                  FROM notasfiscais WHERE idnotafiscal = $6 AND idempresa = $7),
                 ''
               )
             ELSE justificativacancelamento END,
             dtcancelamento = CASE WHEN $1 = 'Cancelada' THEN now() ELSE dtcancelamento END
         WHERE idnotafiscal = $6 AND idempresa = $7
         RETURNING *`,
        [status || null, numeronota || null, chaveacesso || null, codigoverificacao || null, observacao || null, id, idempresa, dtemissao || null, justificativa || null]
      );

      if (!result.rowCount) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Nota fiscal não encontrada para atualizar." });
      }

      const notaAtualizada = result.rows[0];

      // Só agora, confirmada como Emitida de verdade (não no registro,
      // que só gera o XML), a parcela trava como "Faturada".
      if (status === 'Emitida' && notaAtualizada.idparcela) {
        await client.query(
          `UPDATE orcamentoparcelas SET status = 'Faturada' WHERE idparcela = $1`,
          [notaAtualizada.idparcela]
        );
      }

      // Nota cancelada libera a parcela de volta pra "Aberta", pra poder
      // faturar de novo (ex.: nota emitida com valor errado no portal).
      if (status === 'Cancelada' && notaAtualizada.idparcela) {
        await client.query(
          `UPDATE orcamentoparcelas SET status = 'Aberta' WHERE idparcela = $1`,
          [notaAtualizada.idparcela]
        );
      }

      await client.query("COMMIT");

      res.locals.acao = 'atualizou';
      res.locals.idregistroalterado = notaAtualizada.idnotafiscal;
      res.locals.dadosnovos = notaAtualizada;

      return res.json({ message: "Nota fiscal atualizada com sucesso!", notafiscal: notaAtualizada });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Erro ao atualizar nota fiscal:", error);
      res.status(500).json({ message: "Erro ao atualizar nota fiscal." });
    } finally {
      client.release();
    }
  });

// POST /faturamento/:id/cancelar-webservice — cancela de verdade, via Web
// Service (CancelamentoNFe), uma nota já Emitida — diferente do botão
// "Cancelar" comum (PUT /:id com status='Cancelada'), que só mexe no banco
// local e serve pra quando a nota nunca chegou a ser emitida de fato (ex.:
// gerada com dado errado, nem chegou a sair pro Web Service). Aqui a
// prefeitura É avisada. NÃO EXISTE "TesteCancelamentoNFe" — toda chamada
// aqui já é definitiva, sem como simular antes (confirmado na lista
// completa de operações do WSDL — ver utils/enviarLoteWebService.js).
// Loga direto (não via logMiddleware) porque precisa registrar quem tentou
// cancelar mesmo quando a prefeitura rejeita ou a resposta fica incerta —
// logMiddleware só loga em respostas 2xx, e aqui uma tentativa que falhou é
// tão importante pro histórico quanto uma que deu certo (mesmo padrão de
// POST /xml-lote/enviar).
// Restrito a "master" — cancelamento na prefeitura é definitivo, sem modo de
// teste, então só quem tem a flag especial pode disparar.
router.post("/:id/cancelar-webservice", verificarPermissao('faturamento', 'alterar'), exigirFlag('master'),
  async (req, res) => {
    const { id } = req.params;
    const idempresa = req.idempresa;
    const justificativa = (req.body?.justificativa || '').trim();

    if (!justificativa) {
      return res.status(400).json({ message: "Informe a justificativa do cancelamento." });
    }

    try {
      const result = await pool.query(
        `SELECT nf.idnotafiscal, nf.idparcela, nf.status, nf.numeronota, nf.codigoverificacao, nf.chaveacesso,
                o.nrorcamento, op.numparcela,
                em.cnpj AS emissora_cnpj, em.inscricaomunicipal AS emissora_inscricaomunicipal,
                em.nmfantasia AS emissora_nmfantasia, em.siglacertificado AS emissora_siglacertificado
           FROM notasfiscais nf
           JOIN orcamentos o ON o.idorcamento = nf.idorcamento
           LEFT JOIN orcamentoparcelas op ON op.idparcela = nf.idparcela
           LEFT JOIN empresas em ON em.idempresa = o.idempresaemissora
          WHERE nf.idnotafiscal = $1 AND nf.idempresa = $2`,
        [id, idempresa]
      );
      const nf = result.rows[0];
      if (!nf) return res.status(404).json({ message: "Nota fiscal não encontrada." });
      if (nf.status !== 'Emitida') {
        return res.status(400).json({ message: `Só é possível cancelar na prefeitura uma nota Emitida (status atual: ${nf.status}).` });
      }
      if (!nf.numeronota) {
        return res.status(400).json({ message: "Nota sem número (NumeroNFe) registrado — não é possível cancelar na prefeitura." });
      }

      let certificado;
      try {
        certificado = carregarCertificadoDaNota(nf);
      } catch (errCert) {
        console.error("Erro ao carregar certificado digital da empresa emissora:", errCert);
        return res.status(400).json({ message: "Não consegui abrir o certificado digital da empresa emissora. Verifique se o certificado está configurado corretamente para esta empresa." });
      }

      const xml = montarXmlCancelamentoNFe({
        cnpjPrestador: nf.emissora_cnpj,
        notas: [{
          inscricaoMunicipalPrestador: nf.emissora_inscricaomunicipal,
          numeroNFe: nf.numeronota,
          codigoVerificacao: nf.codigoverificacao,
          chaveNotaNacional: nf.chaveacesso,
        }],
        certificado,
      });

      const resultado = await enviarLoteRPS({
        xmlAssinado: xml,
        certificado,
        metodo: 'CancelamentoNFe',
      });

      const carimbo = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
      const nomeLogEnvio = `Cancelamento-${carimbo}-nf${nf.idnotafiscal}.log.xml`;
      try {
        fs.writeFileSync(
          path.join(dirEnviosWebService, nomeLogEnvio),
          `<!-- ENVIADO -->\n${resultado.envelopeEnviado || ''}\n\n<!-- RECEBIDO -->\n${resultado.xmlRetorno || '(sem resposta — falha de rede)'}`,
          'utf8'
        );
      } catch (errLog) {
        console.error('Não consegui salvar o log do cancelamento no Web Service:', errLog.message);
      }

      if (resultado.tipo === 'sucesso') {
        const notaAtualizada = await pool.query(
          `UPDATE notasfiscais
              SET status = 'Cancelada', mensagemenvio = NULL,
                  justificativacancelamento = $3, dtcancelamento = now()
            WHERE idnotafiscal = $1 AND idempresa = $2
            RETURNING *`,
          [nf.idnotafiscal, idempresa, justificativa]
        );
        if (nf.idparcela) {
          await pool.query(`UPDATE orcamentoparcelas SET status = 'Aberta' WHERE idparcela = $1`, [nf.idparcela]);
        }

        registrarLog({
          idexecutor: req.usuario.idusuario,
          idempresa,
          acao: 'cancelou na prefeitura',
          modulo: 'NotaFiscal',
          idregistroalterado: nf.idnotafiscal,
          dadosnovos: { justificativa, tipo: resultado.tipo, mensagem: resultado.mensagem }
        }).catch((errLog) => console.error('Erro ao logar cancelamento de nota fiscal na prefeitura:', errLog));

        return res.json({ tipo: 'sucesso', mensagem: 'Nota cancelada com sucesso na prefeitura.', notafiscal: notaAtualizada.rows[0] });
      }

      // 'rejeitado' (a prefeitura recusou o cancelamento), 'incerto' (falha de
      // rede/timeout) ou 'falha_soap' — em nenhum desses casos o status muda
      // aqui: só sabemos que a nota está cancelada quando a prefeitura confirma.
      // Mesmo assim registra a TENTATIVA no log — quem tentou cancelar e o que
      // a prefeitura respondeu importa pro histórico tanto quanto um sucesso.
      const mensagem = resultado.tipo === 'rejeitado'
        ? (resultado.erros?.[0]?.descricao || 'A prefeitura rejeitou o cancelamento.')
        : resultado.mensagem;

      registrarLog({
        idexecutor: req.usuario.idusuario,
        idempresa,
        acao: 'tentou cancelar na prefeitura',
        modulo: 'NotaFiscal',
        idregistroalterado: nf.idnotafiscal,
        dadosnovos: { justificativa, tipo: resultado.tipo, mensagem }
      }).catch((errLog) => console.error('Erro ao logar tentativa de cancelamento de nota fiscal na prefeitura:', errLog));

      return res.status(422).json({ message: mensagem, tipo: resultado.tipo, erros: resultado.erros || [] });
    } catch (error) {
      console.error("Erro ao cancelar nota fiscal na prefeitura:", error);
      res.status(500).json({ message: "Erro ao cancelar nota na prefeitura." });
    }
  });

// POST /faturamento/:id/anexo — anexa o PDF/comprovante baixado do portal
router.post("/:id/anexo", verificarPermissao('faturamento', 'alterar'), (req, res) => {
  uploadNotaFiscal(req, res, async (err) => {
    if (err) {
      console.error("Erro ao processar anexo da nota fiscal:", err);
      return res.status(400).json({ message: "Erro ao processar o arquivo enviado. Verifique se é um PDF ou imagem de até 10MB." });
    }
    if (!req.file) {
      return res.status(400).json({ message: "Nenhum arquivo enviado." });
    }

    const { id } = req.params;
    const idempresa = req.idempresa;
    const caminhoRelativo = `uploads/notasfiscais/${req.file.filename}`;

    try {
      const result = await pool.query(
        `UPDATE notasfiscais SET arquivopdf = $1 WHERE idnotafiscal = $2 AND idempresa = $3 RETURNING *`,
        [caminhoRelativo, id, idempresa]
      );
      if (!result.rowCount) {
        return res.status(404).json({ message: "Nota fiscal não encontrada." });
      }
      return res.json({ message: "Arquivo anexado com sucesso!", notafiscal: result.rows[0] });
    } catch (error) {
      console.error("Erro ao anexar arquivo à nota fiscal:", error);
      res.status(500).json({ message: "Erro ao anexar arquivo." });
    }
  });
});

// POST /faturamento/:id/remover-anexo — desfaz um PDF anexado errado, pra
// poder anexar o certo no lugar ("Anexar PDF" só aparece quando arquivopdf
// está vazio). Restrito a "master" e exige justificativa (mesma trava do
// cancelamento) — apagar o comprovante de uma nota já emitida não é uma
// ação qualquer.
router.post("/:id/remover-anexo", verificarPermissao('faturamento', 'alterar'), exigirFlag('master'), async (req, res) => {
  const { id } = req.params;
  const idempresa = req.idempresa;
  const justificativa = (req.body?.justificativa || '').trim();

  if (!justificativa) {
    return res.status(400).json({ message: "Informe a justificativa da remoção." });
  }

  try {
    const result = await pool.query(
      `SELECT idnotafiscal, arquivopdf, observacao FROM notasfiscais WHERE idnotafiscal = $1 AND idempresa = $2`,
      [id, idempresa]
    );
    const nf = result.rows[0];
    if (!nf) return res.status(404).json({ message: "Nota fiscal não encontrada." });
    if (!nf.arquivopdf) return res.status(400).json({ message: "Essa nota não tem PDF anexado." });

    try {
      fs.unlinkSync(path.join(__dirname, '..', nf.arquivopdf));
    } catch (errArquivo) {
      console.error('Não consegui apagar o arquivo antigo do PDF (removendo a referência mesmo assim):', errArquivo.message);
    }

    const observacaoNova = `${nf.observacao ? nf.observacao + '\n' : ''}PDF removido manualmente por usuário Master em ${new Date().toLocaleString('pt-BR')} — motivo: ${justificativa}.`;

    const notaAtualizada = await pool.query(
      `UPDATE notasfiscais SET arquivopdf = NULL, observacao = $1 WHERE idnotafiscal = $2 AND idempresa = $3 RETURNING *`,
      [observacaoNova, id, idempresa]
    );

    registrarLog({
      idexecutor: req.usuario.idusuario,
      idempresa,
      acao: 'removeu PDF anexado',
      modulo: 'NotaFiscal',
      idregistroalterado: nf.idnotafiscal,
      dadosnovos: { justificativa }
    }).catch((errLog) => console.error('Erro ao logar remoção de PDF anexado:', errLog));

    return res.json({ message: "PDF removido com sucesso!", notafiscal: notaAtualizada.rows[0] });
  } catch (error) {
    console.error("Erro ao remover PDF anexado:", error);
    res.status(500).json({ message: "Erro ao remover o PDF anexado." });
  }
});

// PUT /faturamento/:id/recebido — confirma (ou desfaz) que o cliente pagou de
// verdade essa nota já Emitida. Nota emitida = obrigação fiscal existe;
// recebido = dinheiro realmente entrou (regime de caixa) — são coisas
// diferentes, essa rota controla só a segunda. Restrito a Master (pedido
// explícito), como cancelar/enviar/registrar.
//
// dtrecebimento vem do financeiro (Swal no front, ver marcarRecebido em
// Faturamento.js) em vez de sempre usar o momento do clique — o dinheiro
// pode ter entrado numa sexta à noite e só ser conferido/confirmado no
// sistema na segunda-feira; sem isso, ficaria registrado como recebido
// depois do vencimento sem ter sido de verdade.
router.put("/:id/recebido", verificarPermissao('faturamento', 'alterar'), exigirFlag('master'), async (req, res) => {
  const { id } = req.params;
  const idempresa = req.idempresa;
  const recebido = !!req.body?.recebido;
  const dtrecebimentoInformado = req.body?.dtrecebimento;
  const dtrecebimento = /^\d{4}-\d{2}-\d{2}$/.test(dtrecebimentoInformado || '') ? dtrecebimentoInformado : null;

  if (recebido && dtrecebimento && new Date(`${dtrecebimento}T00:00:00`) > new Date()) {
    return res.status(400).json({ message: "A data de recebimento não pode ser no futuro." });
  }

  try {
    const result = await pool.query(
      `UPDATE notasfiscais
          SET recebido = $1,
              dtrecebimento = CASE WHEN $1 THEN COALESCE($4::date, now()) ELSE NULL END
        WHERE idnotafiscal = $2 AND idempresa = $3 AND status = 'Emitida'
        RETURNING *`,
      [recebido, id, idempresa, dtrecebimento]
    );
    if (!result.rowCount) {
      return res.status(404).json({ message: "Nota fiscal não encontrada ou não está Emitida." });
    }
    return res.json({ message: recebido ? "Marcado como recebido!" : "Marcação de recebido desfeita.", notafiscal: result.rows[0] });
  } catch (error) {
    console.error("Erro ao atualizar recebimento da nota fiscal:", error);
    res.status(500).json({ message: "Erro ao atualizar recebimento." });
  }
});

// Saudação pelo horário de Brasília, não do servidor (que pode rodar em
// UTC) — hourCycle 'h23' evita o "24h" que hour12:false às vezes devolve.
function saudacaoPorHorario() {
  const hora = parseInt(
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', hourCycle: 'h23', hour: '2-digit' }).format(new Date()),
    10
  );
  if (hora < 12) return 'Bom dia!';
  if (hora < 18) return 'Boa tarde!';
  return 'Boa noite!';
}

// Texto padrão (assunto + corpo) do e-mail de envio de nota — usado tanto na
// prévia (GET /:id/preview-email, pro financeiro ver/editar antes de mandar)
// quanto no envio de verdade (POST /:id/enviar-email, como fallback quando
// nada é digitado por cima). Um lugar só pra não desalinhar os dois.
function montarEmailPadraoNota(nf) {
  const assunto = `Nota Fiscal${nf.numeronota ? ` Nº ${nf.numeronota}` : ''} — Orçamento #${nf.nrorcamento}${nf.evento_nome ? ` — ${nf.evento_nome}` : ''}`;
  const corpoTexto = `${saudacaoPorHorario()}\n\nSegue em anexo a nota fiscal referente ao Orçamento #${nf.nrorcamento}${nf.evento_nome ? ` (${nf.evento_nome})` : ''}.\n\nAtenciosamente,\n${nf.emissora_nome || 'JA System'}`;
  return { assunto, corpoTexto };
}

// GET /faturamento/:id/preview-email — texto padrão que seria enviado, pra
// mostrar num swal editável antes de confirmar o envio de verdade.
router.get("/:id/preview-email", verificarPermissao('faturamento', 'pesquisar'),
  async (req, res) => {
    const { id } = req.params;
    const idempresa = req.idempresa;
    try {
      const result = await pool.query(
        `SELECT nf.numeronota,
                o.nrorcamento, e.nmevento AS evento_nome,
                em.nmfantasia AS emissora_nome
           FROM notasfiscais nf
           JOIN orcamentos o ON o.idorcamento = nf.idorcamento
           LEFT JOIN eventos e ON e.idevento = o.idevento
           LEFT JOIN empresas em ON em.idempresa = o.idempresaemissora
          WHERE nf.idnotafiscal = $1 AND nf.idempresa = $2`,
        [id, idempresa]
      );
      const nf = result.rows[0];
      if (!nf) return res.status(404).json({ message: "Nota fiscal não encontrada." });
      return res.json(montarEmailPadraoNota(nf));
    } catch (error) {
      console.error("Erro ao montar prévia do e-mail:", error);
      res.status(500).json({ message: "Erro ao montar prévia do e-mail." });
    }
  });

// POST /faturamento/:id/enviar-email — manda o PDF da nota já Emitida pro
// e-mail do cliente, por SMTP (ver utils/enviarEmail.js — usa os mesmos
// dados de servidor de saída já configurados no Outlook de vocês). Só libera
// depois de anexar o PDF (arquivopdf), igual pedido: sem o comprovante
// escaneado/baixado do portal não tem o que mandar. Assunto/corpo podem vir
// customizados no body (editados no swal de prévia do front); sem eles, cai
// no texto padrão de montarEmailPadraoNota.
router.post("/:id/enviar-email", verificarPermissao('faturamento', 'alterar'),
  logMiddleware('NotaFiscal', { acao: 'enviou por e-mail' }),
  async (req, res) => {
    const { id } = req.params;
    const idempresa = req.idempresa;
    const destinatario = (req.body?.destinatario || '').trim();

    if (!destinatario) {
      return res.status(400).json({ message: "Informe o e-mail de destino." });
    }

    try {
      const result = await pool.query(
        `SELECT nf.idnotafiscal, nf.arquivopdf, nf.numeronota, nf.status,
                o.nrorcamento, e.nmevento AS evento_nome,
                em.nmfantasia AS emissora_nome
           FROM notasfiscais nf
           JOIN orcamentos o ON o.idorcamento = nf.idorcamento
           LEFT JOIN eventos e ON e.idevento = o.idevento
           LEFT JOIN empresas em ON em.idempresa = o.idempresaemissora
          WHERE nf.idnotafiscal = $1 AND nf.idempresa = $2`,
        [id, idempresa]
      );
      const nf = result.rows[0];
      if (!nf) return res.status(404).json({ message: "Nota fiscal não encontrada." });
      if (nf.status !== 'Emitida') {
        return res.status(400).json({ message: `Só é possível enviar por e-mail uma nota Emitida (status atual: ${nf.status}).` });
      }
      if (!nf.arquivopdf) {
        return res.status(400).json({ message: "Anexe o PDF da nota antes de enviar por e-mail." });
      }

      const padrao = montarEmailPadraoNota(nf);
      const assunto = (req.body?.assunto || '').trim() || padrao.assunto;
      const corpoTexto = (req.body?.corpoTexto || '').trim() || padrao.corpoTexto;

      const resultadoEnvio = await enviarEmailComAnexo({
        para: destinatario,
        assunto,
        corpoTexto,
        anexo: { nome: `NotaFiscal-${nf.numeronota || nf.idnotafiscal}.pdf`, caminhoRelativo: nf.arquivopdf },
      });

      const notaAtualizada = await pool.query(
        `UPDATE notasfiscais SET dtenvioemailcliente = now() WHERE idnotafiscal = $1 AND idempresa = $2 RETURNING *`,
        [nf.idnotafiscal, idempresa]
      );

      res.locals.idregistroalterado = nf.idnotafiscal;
      res.locals.dadosnovos = { destinatario, notafiscal: notaAtualizada.rows[0] };

      return res.json({
        message: "E-mail enviado com sucesso!",
        notafiscal: notaAtualizada.rows[0],
        salvouEmEnviados: resultadoEnvio.salvouEmEnviados,
        caixaEnviados: resultadoEnvio.caixaEnviados,
      });
    } catch (error) {
      console.error("Erro ao enviar nota fiscal por e-mail:", error);
      // Mostra a causa de verdade (ex.: "Arquivo do anexo não encontrado",
      // erro de autenticação SMTP etc.) — antes caía sempre na mesma
      // mensagem genérica, escondendo o motivo real de quem ia investigar.
      res.status(500).json({ message: `Erro ao enviar e-mail: ${error.message}` });
    }
  });

// GET /faturamento/:id/xml — gera na hora (nada é gravado) o XML do "Pedido de
// Envio de Lote de RPS" dessa nota, pro financeiro baixar e subir no portal
// da prefeitura (Envio de RPS em Lote). AINDA NÃO ASSINADO — ver
// utils/gerarXmlRpsLote.js: falta o certificado A1 pra assinar de verdade,
// então por enquanto o arquivo serve só de conferência/adiantamento.
// Busca os dados de uma ou várias notas prontos pra virar entrada do gerador
// de XML — compartilhado pelo download de uma nota só e pelo lote (mesma
// query, só muda quantos ids entram no ANY($1)).
async function buscarNotasParaXml(idsNotasFiscais, idempresa) {
  const result = await pool.query(
    `SELECT nf.idnotafiscal, nf.descricaoservico, nf.valorservico, nf.aliquotaiss,
            nf.valorpiscofinscsll, nf.valoriss, nf.valorirrf, nf.valorcbs, nf.valoribs,
            nf.meiopagamento, nf.descricaomeiopagamento,
            o.nrorcamento, op.numparcela,
            (SELECT COUNT(*) FROM orcamentoparcelas WHERE idorcamento = nf.idorcamento) AS totalparcelas,
            em.cnpj AS emissora_cnpj, em.inscricaomunicipal AS emissora_inscricaomunicipal,
            em.nmfantasia AS emissora_nmfantasia, em.siglacertificado AS emissora_siglacertificado,
            cl.cnpj AS cliente_cnpj, cl.inscricaomunicipal AS cliente_inscricaomunicipal,
            cl.nmfantasia AS cliente_nmfantasia,
            ce.emailnfe AS cliente_email,
            s.codigoservico, s.nbs, s.cindop, s.classificacaotributaria,
            e.nmevento AS evento_nome, o.dtinirealizacao AS evento_datainicio, o.dtfimrealizacao AS evento_datafim,
            lm.rua AS evento_rua, lm.numero AS evento_numero, lm.bairro AS evento_bairro, lm.cep AS evento_cep,
            lm.cidademontagem AS evento_cidade, lm.ufmontagem AS evento_uf
       FROM notasfiscais nf
       JOIN orcamentos o ON o.idorcamento = nf.idorcamento
       LEFT JOIN orcamentoparcelas op ON op.idparcela = nf.idparcela
       LEFT JOIN empresas em ON em.idempresa = o.idempresaemissora
       LEFT JOIN clientes cl ON cl.idcliente = nf.idcliente
       LEFT JOIN clienteempresas ce ON ce.idcliente = cl.idcliente AND ce.idempresa = nf.idempresa
       LEFT JOIN servicos s ON s.idservico = nf.idservico
       LEFT JOIN eventos e ON e.idevento = o.idevento
       LEFT JOIN localmontagem lm ON lm.idmontagem = o.idmontagem
      WHERE nf.idnotafiscal = ANY($1::int[]) AND nf.idempresa = $2`,
    [idsNotasFiscais, idempresa]
  );
  return result.rows;
}

// Deixa um texto seguro pra usar num nome de arquivo do Windows (tira
// \ / : * ? " < > |, acento e espaço) — o portal da prefeitura só lê o
// conteúdo do XML, nunca o nome do arquivo, então isso é só pra ajudar o
// financeiro a identificar a nota de relance.
function nomeArquivoSeguro(texto) {
  return String(texto || "")
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .replace(/[\\/:*?"<>|]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 40);
}

// Identifica a nota do jeito que a tela mostra (nº do orçamento + parcela),
// não pelo idnotafiscal interno — é o que a financeiro vê na tabela, então é
// isso que precisa aparecer numa mensagem de erro pra ela achar a linha.
function rotuloNota(nf) {
  const parcela = nf.numparcela ? ` (parcela ${nf.numparcela}/${nf.totalparcelas})` : '';
  return `Orçamento #${nf.nrorcamento}${parcela}`;
}

// Maiúsculo e sem acento, só pra comparar texto livre de cidade sem depender
// de como foi digitado ("São Paulo", "SAO PAULO", "são paulo" etc.).
function normalizarTexto(texto) {
  return String(texto || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toUpperCase().trim();
}

// Retorna { curto, mensagem } se a nota não tiver os dados mínimos pro XML,
// ou null se estiver tudo certo. `curto` é um rótulo de poucas palavras (pro
// chip na tela — precisa ser visível de cara, financeiro não vai adivinhar
// que um chip genérico esconde um motivo passando o mouse em cima); `mensagem`
// é o texto completo (pros erros de geração/envio, que também dizem qual
// orçamento/parcela é).
function validarNotaParaXml(nf) {
  if (!nf.emissora_cnpj || !nf.emissora_inscricaomunicipal) {
    return { curto: "Falta CNPJ/Insc. Municipal da Emissora", mensagem: `${rotuloNota(nf)}: a empresa emissora do orçamento não tem CNPJ/Inscrição Municipal cadastrados (cadastre em Empresas).` };
  }
  if (!nf.codigoservico || !nf.nbs || !nf.cindop || !nf.classificacaotributaria) {
    return { curto: "Falta Código/NBS do Serviço", mensagem: `${rotuloNota(nf)}: o serviço não tem Código/NBS/CIndOp/Classificação Tributária cadastrados (cadastre em Serviços).` };
  }
  if (!nf.evento_nome || !nf.evento_datainicio || !nf.evento_datafim) {
    return { curto: "Falta Evento/Datas do Orçamento", mensagem: `${rotuloNota(nf)}: o orçamento não tem evento ou datas de realização cadastradas.` };
  }
  // Organização de feiras/eventos/congressos (código 07161, item 17.09/17.10
  // da lista de serviços) é uma das exceções do art. 3º da LC 116/2003: o ISS
  // é devido no MUNICÍPIO do evento, não no da empresa emissora. Continuamos
  // emitindo pelo mesmo Web Service de São Paulo (TributacaoRPS="F" +
  // MunicipioPrestacao/cLocPrestacao com o código IBGE do evento — ver
  // gerarXmlRpsLote.js), mas não existe base pública de alíquota de ISS por
  // município — o financeiro precisa digitar manualmente a cada emissão
  // (campo "ISS (%)"), consultando a lei daquele município. O recolhimento
  // em si na prefeitura de destino também é manual, fora do sistema.
  const eventoForaDeSaoPaulo = normalizarTexto(nf.evento_cidade) !== 'SAO PAULO';
  if (eventoForaDeSaoPaulo && !(Number(nf.aliquotaiss) > 0)) {
    return { curto: "Falta Alíquota de ISS", mensagem: `${rotuloNota(nf)}: o evento é em ${nf.evento_cidade || 'um município não informado'}${nf.evento_uf ? '/' + nf.evento_uf : ''}, fora de São Paulo — o ISS é devido lá (exceção do art. 3º da LC 116/2003). Informe a alíquota de ISS daquele município no campo "ISS (%)" antes de emitir.` };
  }
  if (!nf.evento_rua || !nf.evento_numero || !nf.evento_bairro || !nf.evento_cep) {
    return { curto: "Falta Endereço Local Montagem", mensagem: `${rotuloNota(nf)}: o local de montagem do evento não tem endereço completo (rua/número/bairro/CEP) — complete em Local de Montagem.` };
  }
  const certificado = obterCertificadoEmpresa({
    nmfantasia: nf.emissora_nmfantasia,
    siglacertificado: nf.emissora_siglacertificado,
  });
  if (!certificado?.caminho || !certificado?.senha) {
    return { curto: "Falta Certificado Digital", mensagem: `${rotuloNota(nf)}: a empresa emissora não tem certificado digital configurado (cadastre em Empresas).` };
  }
  return null;
}

// Carrega o certificado (chave privada + certificado, em PEM) da empresa
// emissora de uma nota já validada por validarNotaParaXml (ou seja, aqui já
// se sabe que caminho/senha existem no .env — só falta abrir o arquivo).
function carregarCertificadoDaNota(nf) {
  const certificado = obterCertificadoEmpresa({
    nmfantasia: nf.emissora_nmfantasia,
    siglacertificado: nf.emissora_siglacertificado,
  });
  return carregarCertificado(certificado.caminho, certificado.senha);
}

async function montarNotaParaGerador(nf) {
  // validarNotaParaXml já garantiu (quando fora de São Paulo) que a alíquota
  // foi preenchida — aqui só falta achar o código IBGE do município do
  // evento, pra declarar TributacaoRPS="F" + MunicipioPrestacao no XML.
  let municipioPrestacaoIbge;
  if (normalizarTexto(nf.evento_cidade) !== 'SAO PAULO') {
    municipioPrestacaoIbge = await buscarCodigoIbge(nf.evento_cidade, nf.evento_uf);
    if (!municipioPrestacaoIbge) {
      throw new Error(`${rotuloNota(nf)}: não encontrei o código IBGE do município "${nf.evento_cidade}/${nf.evento_uf}" — confira se o nome da cidade está correto em Local de Montagem.`);
    }
  }
  return {
    idnotafiscal: nf.idnotafiscal,
    dataEmissao: new Date(),
    codigoServico: nf.codigoservico,
    aliquotaIss: nf.aliquotaiss,
    cnpjTomador: nf.cliente_cnpj,
    inscricaoMunicipalTomador: nf.cliente_inscricaomunicipal,
    emailTomador: nf.cliente_email,
    discriminacaoServico: nf.descricaoservico,
    valorServico: nf.valorservico,
    valorPisCofinsCsllRetido: nf.valorpiscofinscsll,
    municipioPrestacaoIbge,
    nbs: nf.nbs,
    cIndOp: nf.cindop,
    classificacaoTributaria: nf.classificacaotributaria,
    nomeEvento: nf.evento_nome,
    dataInicioEvento: nf.evento_datainicio,
    dataFimEvento: nf.evento_datafim,
    cepEvento: nf.evento_cep,
    ruaEvento: nf.evento_rua,
    numeroEvento: nf.evento_numero,
    bairroEvento: nf.evento_bairro
  };
}

// GET /faturamento/:id/previa — resumo LEGÍVEL (não o XML cru) de tudo que
// essa nota mandaria pra prefeitura, pra conferência antes de "Enviar
// direto". Usa os MESMOS dados/regra de buscarNotasParaXml e o mesmo cálculo
// de município (fora de SP) de montarNotaParaGerador — o que aparece aqui é
// garantido bater com o que realmente seria enviado. Diferente de GET /:id/xml
// (que já bloqueia com 400 se faltar algo pra gerar), a prévia NÃO bloqueia:
// o objetivo aqui é justamente ajudar a achar o que falta antes de tentar
// enviar de verdade, então devolve o resto dos dados junto com o aviso.
router.get("/:id/previa", verificarPermissao('faturamento', 'pesquisar'), async (req, res) => {
  const { id } = req.params;
  const idempresa = req.idempresa;

  try {
    const linhas = await buscarNotasParaXml([id], idempresa);
    if (!linhas.length) {
      return res.status(404).json({ message: "Nota fiscal não encontrada." });
    }
    const nf = linhas[0];
    const erroValidacao = validarNotaParaXml(nf);

    const foraDeSaoPaulo = normalizarTexto(nf.evento_cidade) !== 'SAO PAULO';
    let municipioPrestacaoIbge = null;
    let avisoMunicipio = null;
    if (foraDeSaoPaulo && nf.evento_cidade) {
      try {
        municipioPrestacaoIbge = await buscarCodigoIbge(nf.evento_cidade, nf.evento_uf);
      } catch (errMunicipio) {
        avisoMunicipio = errMunicipio.message;
      }
      if (!municipioPrestacaoIbge && !avisoMunicipio) {
        avisoMunicipio = `Não encontrei o código IBGE de "${nf.evento_cidade}/${nf.evento_uf}".`;
      }
    }

    return res.json({
      rotulo: rotuloNota(nf),
      aviso: erroValidacao?.mensagem || avisoMunicipio || null,
      emissora: {
        nome: nf.emissora_nmfantasia || null,
        cnpj: nf.emissora_cnpj || null,
        inscricaomunicipal: nf.emissora_inscricaomunicipal || null,
      },
      cliente: {
        nome: nf.cliente_nmfantasia || null,
        cnpj: nf.cliente_cnpj || null,
        inscricaomunicipal: nf.cliente_inscricaomunicipal || null,
        email: nf.cliente_email || null,
      },
      evento: {
        nome: nf.evento_nome || null,
        datainicio: nf.evento_datainicio || null,
        datafim: nf.evento_datafim || null,
        cidade: nf.evento_cidade || null,
        uf: nf.evento_uf || null,
        rua: nf.evento_rua || null,
        numero: nf.evento_numero || null,
        bairro: nf.evento_bairro || null,
        cep: nf.evento_cep || null,
      },
      servico: {
        descricao: nf.descricaoservico || null,
        codigoservico: nf.codigoservico || null,
        nbs: nf.nbs || null,
        cindop: nf.cindop || null,
        classificacaotributaria: nf.classificacaotributaria || null,
      },
      tributacao: {
        foraDeSaoPaulo,
        municipioPrestacao: foraDeSaoPaulo ? `${nf.evento_cidade || '—'}/${nf.evento_uf || '—'}` : 'São Paulo/SP',
        municipioPrestacaoIbge,
      },
      valores: {
        valorservico: nf.valorservico,
        aliquotaiss: nf.aliquotaiss,
        valoriss: nf.valoriss,
        valorirrf: nf.valorirrf,
        valorpiscofinscsll: nf.valorpiscofinscsll,
        valorcbs: nf.valorcbs,
        valoribs: nf.valoribs,
      },
      meiopagamento: nf.descricaomeiopagamento || null,
      parcela: { numparcela: nf.numparcela || null, totalparcelas: nf.totalparcelas || null },
    });
  } catch (error) {
    console.error("Erro ao montar prévia da nota fiscal:", error);
    res.status(500).json({ message: "Erro ao montar prévia da nota." });
  }
});

router.get("/:id/xml", verificarPermissao('faturamento', 'pesquisar'), async (req, res) => {
  const { id } = req.params;
  const idempresa = req.idempresa;

  try {
    const linhas = await buscarNotasParaXml([id], idempresa);
    if (!linhas.length) {
      return res.status(404).json({ message: "Nota fiscal não encontrada." });
    }
    const nf = linhas[0];

    const erro = validarNotaParaXml(nf);
    if (erro) {
      return res.status(400).json({ message: erro.mensagem });
    }

    let certificado;
    try {
      certificado = carregarCertificadoDaNota(nf);
    } catch (errCert) {
      console.error("Erro ao carregar certificado digital da empresa emissora:", errCert);
      return res.status(400).json({ message: "Não consegui abrir o certificado digital da empresa emissora. Verifique se o certificado está configurado corretamente para esta empresa." });
    }

    let notaParaGerador;
    try {
      notaParaGerador = await montarNotaParaGerador(nf);
    } catch (errMunicipio) {
      return res.status(400).json({ message: errMunicipio.message });
    }

    const xml = gerarXmlPedidoEnvioLoteRPS({
      empresaEmissora: {
        cnpj: nf.emissora_cnpj,
        inscricaomunicipal: nf.emissora_inscricaomunicipal
      },
      notas: [notaParaGerador],
      certificado
    });

    // Nome fixo por nota (não leva data/hora) — gerar de novo a mesma nota
    // SOBRESCREVE o arquivo anterior em vez de duplicar na pasta. O nome do
    // cliente é só pra facilitar identificar de relance — se o cliente for
    // renomeado entre duas gerações da mesma nota, o arquivo antigo (com o
    // nome velho) fica órfão na pasta em vez de ser sobrescrito; raro, e
    // inofensivo (só um arquivo extra parado).
    const sufixoCliente = nomeArquivoSeguro(nf.cliente_nmfantasia);
    const nomeArquivo = sufixoCliente
      ? `RPS-${nf.idnotafiscal}-${sufixoCliente}.xml`
      : `RPS-${nf.idnotafiscal}.xml`;
    const caminhoRelativo = `uploads/notasparaenvio/${nomeArquivo}`;
    fs.writeFileSync(path.join(dirNotasParaEnvio, nomeArquivo), xml, 'utf8');
    salvarCopiaParaRede(nomeArquivo, xml);

    // Grava o caminho pra tela oferecer "Ver XML" (abrir o que já existe)
    // sem precisar gerar de novo — mesmo padrão de arquivopdf.
    await pool.query(
      `UPDATE notasfiscais SET arquivoxml = $1 WHERE idnotafiscal = $2 AND idempresa = $3`,
      [caminhoRelativo, nf.idnotafiscal, idempresa]
    );

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${nomeArquivo}"`);
    return res.send(xml);
  } catch (error) {
    console.error("Erro ao gerar XML da nota fiscal:", error);
    res.status(500).json({ message: "Erro ao gerar XML." });
  }
});

// GET /faturamento/prontas-envio — todas as notas "Pronta para Envio" da
// empresa (de qualquer orçamento), pra escolher quais entram no lote a
// baixar juntas. Traz arquivoxml/arquivopdf/numeronota também — a tela usa
// isso pra mostrar os mesmos botões (Marcar emitida/Cancelar/Baixar
// XML/Anexar PDF) que já existem em "Notas registradas", sem precisar abrir
// o orçamento pra agir sobre a nota.
router.get("/prontas-envio", verificarPermissao('faturamento', 'pesquisar'), async (req, res) => {
  const idempresa = req.idempresa;

  try {
    const result = await pool.query(
      `SELECT nf.idnotafiscal, nf.idorcamento, nf.descricaoservico, nf.valorservico, nf.aliquotaiss, nf.dtregistro,
              nf.arquivoxml, nf.arquivopdf, nf.numeronota,
              o.nrorcamento, c.razaosocial AS cliente_nome, c.nmfantasia AS cliente_nmfantasia,
              c.inscricaomunicipal AS cliente_inscricaomunicipal,
              op.numparcela, op.dtvencimento,
              (SELECT COUNT(*) FROM orcamentoparcelas WHERE idorcamento = nf.idorcamento) AS totalparcelas,
              em.nmfantasia AS emissora_nome, o.idempresaemissora,
              em.cnpj AS emissora_cnpj, em.inscricaomunicipal AS emissora_inscricaomunicipal,
              em.nmfantasia AS emissora_nmfantasia, em.siglacertificado AS emissora_siglacertificado,
              s.codigoservico, s.nbs, s.cindop, s.classificacaotributaria,
              e.nmevento AS evento_nome, o.dtinirealizacao AS evento_datainicio, o.dtfimrealizacao AS evento_datafim,
              lm.rua AS evento_rua, lm.numero AS evento_numero, lm.bairro AS evento_bairro, lm.cep AS evento_cep,
              lm.cidademontagem AS evento_cidade, lm.ufmontagem AS evento_uf
         FROM notasfiscais nf
         JOIN orcamentos o ON o.idorcamento = nf.idorcamento
         LEFT JOIN clientes c ON c.idcliente = nf.idcliente
         LEFT JOIN orcamentoparcelas op ON op.idparcela = nf.idparcela
         LEFT JOIN empresas em ON em.idempresa = o.idempresaemissora
         LEFT JOIN servicos s ON s.idservico = nf.idservico
         LEFT JOIN eventos e ON e.idevento = o.idevento
         LEFT JOIN localmontagem lm ON lm.idmontagem = o.idmontagem
        WHERE nf.idempresa = $1 AND nf.status = 'Pronta para Envio'
        ORDER BY em.nmfantasia ASC, op.dtvencimento ASC NULLS LAST, nf.dtregistro ASC`,
      [idempresa]
    );
    const notas = result.rows.map((nf) => ({ ...nf, pendencia: validarNotaParaXml(nf) }));
    return res.json(notas);
  } catch (error) {
    console.error("Erro ao buscar notas prontas para envio:", error);
    res.status(500).json({ message: "Erro ao buscar notas prontas para envio." });
  }
});

// GET /faturamento/emitidas — notas já EMITIDAS (de qualquer orçamento), pra
// achar/reabrir uma nota antiga (ver PDF/XML) sem precisar saber de cor qual
// orçamento é. Filtros opcionais: idcliente, idempresaemissora, dtDe/dtAte
// (por dtregistro — não existe uma "data de emissão" separada hoje).
router.get("/emitidas", verificarPermissao('faturamento', 'pesquisar'), async (req, res) => {
  const idempresa = req.idempresa;
  const { idcliente, idempresaemissora, statusRecebimento } = req.query;
  let { dtDe, dtAte } = req.query;
  if (dtDe && !dtAte) dtAte = dtDe;
  if (dtAte && !dtDe) dtDe = dtAte;

  try {
    const result = await pool.query(
      `SELECT nf.idnotafiscal, nf.idorcamento, nf.descricaoservico, nf.valorservico, nf.dtregistro,
              nf.arquivoxml, nf.arquivopdf, nf.numeronota, nf.dtenvioemailcliente,
              nf.recebido, nf.dtrecebimento,
              o.nrorcamento, c.razaosocial AS cliente_nome, c.nmfantasia AS cliente_nmfantasia,
              op.numparcela, op.dtvencimento,
              (SELECT COUNT(*) FROM orcamentoparcelas WHERE idorcamento = nf.idorcamento) AS totalparcelas,
              em.nmfantasia AS emissora_nome, o.idempresaemissora,
              e.nmevento AS evento_nome,
              ce.emailnfe AS cliente_email,
              (nf.idempresa = $1) AS proprioambiente,
              nf_emp.nmfantasia AS ambienteorigem_nome
         FROM notasfiscais nf
         JOIN orcamentos o ON o.idorcamento = nf.idorcamento
         LEFT JOIN clientes c ON c.idcliente = nf.idcliente
         LEFT JOIN orcamentoparcelas op ON op.idparcela = nf.idparcela
         LEFT JOIN empresas em ON em.idempresa = o.idempresaemissora
         LEFT JOIN empresas nf_emp ON nf_emp.idempresa = nf.idempresa
         LEFT JOIN eventos e ON e.idevento = o.idevento
         LEFT JOIN clienteempresas ce ON ce.idcliente = nf.idcliente AND ce.idempresa = nf.idempresa
        -- Empréstimo entre ambientes (2026-08-26): mesma regra do /pendentes —
        -- ver comentário lá. "proprioambiente" acima decide se os botões de
        -- ação (Anexar PDF/Gerar XML novamente) aparecem ou não.
        WHERE (nf.idempresa = $1 OR (nf.idempresa = 1 AND o.idempresaemissora = $1))
          AND nf.status = 'Emitida'
          AND ($2::int IS NULL OR nf.idcliente = $2::int)
          AND ($3::int IS NULL OR o.idempresaemissora = $3::int)
          AND ($4::date IS NULL OR nf.dtregistro::date BETWEEN $4::date AND $5::date)
          -- Filtro por Recebimento fica aqui (por NOTA), não em Visão Geral
          -- (por ORÇAMENTO) — pedido explícito: em Visão Geral um orçamento
          -- pode ter parcelas em estados de recebimento diferentes ao mesmo
          -- tempo, então o filtro lá não refletia a nota específica que
          -- interessa. Aqui cada linha já É uma nota, condição direta.
          AND (
            $6::text IS NULL
            OR ($6 = 'recebida' AND nf.recebido = true)
            OR ($6 = 'a-receber' AND nf.recebido = false AND (op.dtvencimento IS NULL OR op.dtvencimento >= CURRENT_DATE))
            OR ($6 = 'recebimento-atrasado' AND nf.recebido = false AND op.dtvencimento < CURRENT_DATE)
          )
        ORDER BY nf.dtregistro DESC`,
      [idempresa, idcliente || null, idempresaemissora || null, dtDe || null, dtAte || null, statusRecebimento || null]
    );
    return res.json(result.rows);
  } catch (error) {
    console.error("Erro ao buscar notas emitidas:", error);
    res.status(500).json({ message: "Erro ao buscar notas emitidas." });
  }
});

// GET /faturamento/canceladas — notas com status 'Cancelada', incluindo tanto
// as canceladas pelo botão local (nunca chegaram a ser emitidas de verdade)
// quanto as canceladas de verdade na prefeitura (via Web Service — essas têm
// justificativacancelamento/dtcancelamento preenchidos). Aba separada de
// "Emitidas" de propósito: lá só ficam notas com status realmente válido.
router.get("/canceladas", verificarPermissao('faturamento', 'pesquisar'), async (req, res) => {
  const idempresa = req.idempresa;
  const { idcliente, idempresaemissora } = req.query;
  let { dtDe, dtAte } = req.query;
  if (dtDe && !dtAte) dtAte = dtDe;
  if (dtAte && !dtDe) dtDe = dtAte;

  try {
    const result = await pool.query(
      `SELECT nf.idnotafiscal, nf.idorcamento, nf.descricaoservico, nf.valorservico, nf.dtregistro,
              nf.arquivoxml, nf.arquivopdf, nf.numeronota, nf.mensagemenvio,
              nf.justificativacancelamento, nf.dtcancelamento,
              o.nrorcamento, c.razaosocial AS cliente_nome, c.nmfantasia AS cliente_nmfantasia,
              op.numparcela, op.dtvencimento,
              (SELECT COUNT(*) FROM orcamentoparcelas WHERE idorcamento = nf.idorcamento) AS totalparcelas,
              em.nmfantasia AS emissora_nome, o.idempresaemissora,
              e.nmevento AS evento_nome,
              (nf.idempresa = $1) AS proprioambiente,
              nf_emp.nmfantasia AS ambienteorigem_nome
         FROM notasfiscais nf
         JOIN orcamentos o ON o.idorcamento = nf.idorcamento
         LEFT JOIN clientes c ON c.idcliente = nf.idcliente
         LEFT JOIN orcamentoparcelas op ON op.idparcela = nf.idparcela
         LEFT JOIN empresas em ON em.idempresa = o.idempresaemissora
         LEFT JOIN empresas nf_emp ON nf_emp.idempresa = nf.idempresa
         LEFT JOIN eventos e ON e.idevento = o.idevento
        WHERE (nf.idempresa = $1 OR (nf.idempresa = 1 AND o.idempresaemissora = $1))
          AND nf.status = 'Cancelada'
          AND ($2::int IS NULL OR nf.idcliente = $2::int)
          AND ($3::int IS NULL OR o.idempresaemissora = $3::int)
          AND ($4::date IS NULL OR nf.dtregistro::date BETWEEN $4::date AND $5::date)
        ORDER BY COALESCE(nf.dtcancelamento, nf.dtregistro) DESC`,
      [idempresa, idcliente || null, idempresaemissora || null, dtDe || null, dtAte || null]
    );
    return res.json(result.rows);
  } catch (error) {
    console.error("Erro ao buscar notas canceladas:", error);
    res.status(500).json({ message: "Erro ao buscar notas canceladas." });
  }
});

// GET /faturamento/rejeitadas — notas com status 'Rejeitada' (a prefeitura
// confirmadamente não emitiu) ou 'Envio Incerto' (falha de rede/timeout, não
// se sabe se foi processado — precisa conferir no portal da prefeitura antes
// de decidir o próximo passo). Antes só dava pra ver isso abrindo orçamento
// por orçamento em "Emitir nota"; aba própria pra achar sem precisar saber
// de cor qual orçamento falhou (pedido 2026-09-01).
router.get("/rejeitadas", verificarPermissao('faturamento', 'pesquisar'), async (req, res) => {
  const idempresa = req.idempresa;
  const { idcliente, idempresaemissora } = req.query;
  let { dtDe, dtAte } = req.query;
  if (dtDe && !dtAte) dtAte = dtDe;
  if (dtAte && !dtDe) dtDe = dtAte;

  try {
    const result = await pool.query(
      `SELECT nf.idnotafiscal, nf.idorcamento, nf.descricaoservico, nf.valorservico, nf.dtregistro,
              nf.arquivoxml, nf.status, nf.mensagemenvio,
              o.nrorcamento, c.razaosocial AS cliente_nome, c.nmfantasia AS cliente_nmfantasia,
              op.numparcela, op.dtvencimento,
              (SELECT COUNT(*) FROM orcamentoparcelas WHERE idorcamento = nf.idorcamento) AS totalparcelas,
              em.nmfantasia AS emissora_nome, o.idempresaemissora,
              e.nmevento AS evento_nome,
              (nf.idempresa = $1) AS proprioambiente,
              nf_emp.nmfantasia AS ambienteorigem_nome
         FROM notasfiscais nf
         JOIN orcamentos o ON o.idorcamento = nf.idorcamento
         LEFT JOIN clientes c ON c.idcliente = nf.idcliente
         LEFT JOIN orcamentoparcelas op ON op.idparcela = nf.idparcela
         LEFT JOIN empresas em ON em.idempresa = o.idempresaemissora
         LEFT JOIN empresas nf_emp ON nf_emp.idempresa = nf.idempresa
         LEFT JOIN eventos e ON e.idevento = o.idevento
        WHERE (nf.idempresa = $1 OR (nf.idempresa = 1 AND o.idempresaemissora = $1))
          AND nf.status IN ('Rejeitada', 'Envio Incerto')
          AND nf.dtsubstituicao IS NULL
          AND ($2::int IS NULL OR nf.idcliente = $2::int)
          AND ($3::int IS NULL OR o.idempresaemissora = $3::int)
          AND ($4::date IS NULL OR nf.dtregistro::date BETWEEN $4::date AND $5::date)
        ORDER BY nf.dtregistro DESC`,
      [idempresa, idcliente || null, idempresaemissora || null, dtDe || null, dtAte || null]
    );
    return res.json(result.rows);
  } catch (error) {
    console.error("Erro ao buscar notas rejeitadas:", error);
    res.status(500).json({ message: "Erro ao buscar notas rejeitadas." });
  }
});

// POST /faturamento/xml-lote/enviar — gera, assina e MANDA de verdade o lote
// pro Web Service síncrono da prefeitura (autenticação TLS mútua com o mesmo
// certificado usado pra assinar o XML). Máximo 50 por lote (limite do XSD), e
// todas as notas precisam ser da MESMA empresa emissora, já que o Cabecalho
// do envelope só tem um CPFCNPJRemetente.
//
// `teste: true` chama TesteEnvioLoteRPS — valida exatamente igual, mas NÃO
// substitui o RPS por NF-e de verdade (sem efeito na prefeitura, sem tocar
// no banco aqui). É o jeito seguro de testar contra o ambiente real antes de
// usar `teste: false` (EnvioLoteRPS, envio de verdade) pela primeira vez.
//
// Como o XML manda <transacao>true</transacao>, um erro em qualquer RPS
// invalida o LOTE INTEIRO — por isso um resultado "rejeitado" marca todas as
// notas enviadas como Rejeitada, não só a citada no erro.
// "Testar envio" e "Enviar direto" passam os dois por aqui (só muda o `teste`
// no body) — restrito a quem tem a flag especial "master" (pedido explícito:
// só Master mexe no envio de verdade pro Web Service, teste incluso).
router.post("/xml-lote/enviar", verificarPermissao('faturamento', 'alterar'), exigirFlag('master'), async (req, res) => {
  const idempresa = req.idempresa;
  const { idsNotasFiscais, teste } = req.body;
  const modoTeste = !!teste;

  if (!Array.isArray(idsNotasFiscais) || !idsNotasFiscais.length) {
    return res.status(400).json({ message: "Selecione ao menos uma nota." });
  }
  if (idsNotasFiscais.length > 50) {
    return res.status(400).json({ message: `Você selecionou ${idsNotasFiscais.length} notas — o máximo por lote é 50.` });
  }

  try {
    const linhas = await buscarNotasParaXml(idsNotasFiscais, idempresa);
    if (linhas.length !== idsNotasFiscais.length) {
      return res.status(404).json({ message: "Uma ou mais notas selecionadas não foram encontradas." });
    }

    for (const nf of linhas) {
      const erro = validarNotaParaXml(nf);
      if (erro) return res.status(400).json({ message: erro.mensagem });
    }

    const emissorasDistintas = new Set(linhas.map((nf) => nf.emissora_cnpj));
    if (emissorasDistintas.size > 1) {
      return res.status(400).json({ message: "As notas selecionadas são de empresas emissoras diferentes — selecione notas de uma única empresa emissora por lote." });
    }

    let certificado;
    try {
      certificado = carregarCertificadoDaNota(linhas[0]);
    } catch (errCert) {
      console.error("Erro ao carregar certificado digital da empresa emissora:", errCert);
      return res.status(400).json({ message: "Não consegui abrir o certificado digital da empresa emissora. Verifique se o certificado está configurado corretamente para esta empresa." });
    }

    let notasParaGerador;
    try {
      notasParaGerador = await Promise.all(linhas.map(montarNotaParaGerador));
    } catch (errMunicipio) {
      return res.status(400).json({ message: errMunicipio.message });
    }

    const xml = gerarXmlPedidoEnvioLoteRPS({
      empresaEmissora: {
        cnpj: linhas[0].emissora_cnpj,
        inscricaomunicipal: linhas[0].emissora_inscricaomunicipal
      },
      notas: notasParaGerador,
      certificado
    });

    const resultado = await enviarLoteRPS({
      xmlAssinado: xml,
      certificado,
      metodo: modoTeste ? 'TesteEnvioLoteRPS' : 'EnvioLoteRPS'
    });

    const carimbo = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);

    // Só grava o XML "de verdade" (o que qualquer nota do lote pode abrir via
    // "Ver XML") quando não é teste — TesteEnvioLoteRPS não mexe no banco,
    // então não tem porquê deixar arquivo pra trás. Aponta pro MESMO arquivo
    // do lote inteiro em todas as notas dele — é literalmente o que foi
    // transmitido, mais preciso do que gerar um XML novo na hora de abrir.
    let caminhoRelativoXml = null;
    if (!modoTeste) {
      const nomeArquivoLote = `Lote-RPS-${carimbo}-${linhas.length}notas.xml`;
      fs.writeFileSync(path.join(dirNotasParaEnvio, nomeArquivoLote), xml, 'utf8');
      salvarCopiaParaRede(nomeArquivoLote, xml);
      caminhoRelativoXml = `uploads/notasparaenvio/${nomeArquivoLote}`;
    }

    const nomeLogEnvio = `Envio-${modoTeste ? 'Teste-' : ''}${carimbo}-${linhas.length}notas.log.xml`;
    try {
      fs.writeFileSync(
        path.join(dirEnviosWebService, nomeLogEnvio),
        `<!-- ENVIADO -->\n${resultado.envelopeEnviado || ''}\n\n<!-- RECEBIDO -->\n${resultado.xmlRetorno || '(sem resposta — falha de rede)'}`,
        'utf8'
      );
    } catch (errLog) {
      console.error('Não consegui salvar o log do envio ao Web Service:', errLog.message);
    }

    if (modoTeste) {
      return res.json({
        teste: true,
        tipo: resultado.tipo,
        mensagem: resultado.mensagem,
        erros: resultado.erros || [],
        alertas: resultado.alertas || [],
      });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      if (resultado.tipo === 'sucesso') {
        for (const nota of resultado.notas) {
          const notaAtualizada = await client.query(
            `UPDATE notasfiscais
                SET status = 'Emitida',
                    numeronota = $1,
                    codigoverificacao = $2,
                    chaveacesso = $3,
                    mensagemenvio = NULL,
                    arquivoxml = $4,
                    dtemissao = CASE WHEN dtemissao IS NULL THEN now() ELSE dtemissao END
              WHERE idnotafiscal = $5 AND idempresa = $6
              RETURNING idparcela`,
            [nota.numeroNFe, nota.codigoVerificacao, nota.chaveNotaNacional, caminhoRelativoXml, nota.numeroRps, idempresa]
          );
          const idparcela = notaAtualizada.rows[0]?.idparcela;
          if (idparcela) {
            await client.query(`UPDATE orcamentoparcelas SET status = 'Faturada' WHERE idparcela = $1`, [idparcela]);
          }
        }
      } else if (resultado.tipo === 'rejeitado') {
        // Erro de cabeçalho do lote inteiro (sem ChaveRPS, numeroRps null —
        // ver mapEvento em enviarLoteWebService.js) não tem "outro RPS" pra
        // culpar: é a causa real, mesmo num lote de 1 nota só (ex.: timeout
        // de conexão do lado da prefeitura, código 1999). O texto genérico só
        // faz sentido quando existe de fato um erro citando OUTRO RPS.
        const erroCabecalho = (resultado.erros || []).find((e) => e.numeroRps == null);
        for (const nf of linhas) {
          const erroDaNota = (resultado.erros || []).find((e) => e.numeroRps === nf.idnotafiscal);
          const mensagem = erroDaNota
            ? erroDaNota.descricao
            : erroCabecalho
              ? `Lote rejeitado: ${erroCabecalho.descricao}`
              : "Lote rejeitado por erro em outro RPS do mesmo envio.";
          const notaAtualizada = await client.query(
            `UPDATE notasfiscais SET status = 'Rejeitada', mensagemenvio = $1, arquivoxml = $2
              WHERE idnotafiscal = $3 AND idempresa = $4
              RETURNING idparcela`,
            [mensagem, caminhoRelativoXml, nf.idnotafiscal, idempresa]
          );
          const idparcela = notaAtualizada.rows[0]?.idparcela;
          if (idparcela) {
            await client.query(`UPDATE orcamentoparcelas SET status = 'Aberta' WHERE idparcela = $1`, [idparcela]);
          }
        }
      } else {
        // 'incerto' (falha de rede/timeout) ou 'falha_soap' (a prefeitura nem
        // chegou a avaliar o lote) — nunca marcar Emitida nem Rejeitada aqui,
        // só sinalizar que precisa conferência manual antes de tentar de novo.
        for (const nf of linhas) {
          await client.query(
            `UPDATE notasfiscais SET status = 'Envio Incerto', mensagemenvio = $1, arquivoxml = $2
              WHERE idnotafiscal = $3 AND idempresa = $4`,
            [resultado.mensagem, caminhoRelativoXml, nf.idnotafiscal, idempresa]
          );
        }
      }

      await client.query("COMMIT");
    } catch (errDb) {
      await client.query("ROLLBACK");
      throw errDb;
    } finally {
      client.release();
    }

    for (const nf of linhas) {
      registrarLog({
        idexecutor: req.usuario.idusuario,
        idempresa,
        acao: 'enviou',
        modulo: 'NotaFiscal',
        idregistroalterado: nf.idnotafiscal,
        dadosnovos: { tipo: resultado.tipo, mensagem: resultado.mensagem }
      }).catch((errLog) => console.error('Erro ao logar envio de nota fiscal:', errLog));
    }

    return res.json({
      teste: false,
      tipo: resultado.tipo,
      mensagem: resultado.mensagem,
      erros: resultado.erros || [],
      alertas: resultado.alertas || [],
      notas: resultado.notas || [],
    });
  } catch (error) {
    console.error("Erro ao enviar lote pro Web Service da prefeitura:", error);
    res.status(500).json({ message: "Erro ao enviar lote." });
  }
});

// GET /faturamento/parametros?ano=2026 — alíquotas de CBS/IBS/retenções vigentes no ano
// (tabela própria do módulo Nota Fiscal — não confundir com `aliquotas`, que é do RH/folha)
router.get("/parametros", verificarPermissao('faturamento', 'pesquisar'), async (req, res) => {
  const ano = parseInt(req.query.ano, 10) || new Date().getFullYear();

  try {
    const result = await pool.query(`SELECT * FROM aliquotasnf WHERE ano = $1`, [ano]);
    if (!result.rows.length) {
      return res.status(404).json({ message: `Nenhum parâmetro fiscal cadastrado para ${ano}.` });
    }
    return res.json(result.rows[0]);
  } catch (error) {
    console.error("Erro ao buscar parâmetros fiscais:", error);
    res.status(500).json({ message: "Erro ao buscar parâmetros fiscais." });
  }
});

// PUT /faturamento/parametros/:ano — cadastra/atualiza as alíquotas do ano (upsert)
router.put("/parametros/:ano", verificarPermissao('faturamento', 'alterar'),
  logMiddleware('NotaFiscal', {
    buscarDadosAnteriores: async (req) => {
      const result = await pool.query(`SELECT * FROM aliquotasnf WHERE ano = $1`, [req.params.ano]);
      return { dadosanteriores: result.rows[0] || null, idregistroalterado: req.params.ano };
    }
  }),
  async (req, res) => {
    const { ano } = req.params;
    const { cbsaliq, ibsaliq, irrfservicoaliq, piscofinscsllservicoaliq } = req.body;

    try {
      const result = await pool.query(
        `INSERT INTO aliquotasnf (ano, cbsaliq, ibsaliq, irrfservicoaliq, piscofinscsllservicoaliq)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (ano) DO UPDATE
           SET cbsaliq = $2, ibsaliq = $3, irrfservicoaliq = $4, piscofinscsllservicoaliq = $5
         RETURNING *`,
        [ano, cbsaliq, ibsaliq, irrfservicoaliq, piscofinscsllservicoaliq]
      );

      res.locals.acao = 'atualizou';
      res.locals.idregistroalterado = ano;
      res.locals.dadosnovos = result.rows[0];

      return res.json({ message: `Parâmetros fiscais de ${ano} salvos com sucesso!`, parametros: result.rows[0] });
    } catch (error) {
      console.error("Erro ao salvar parâmetros fiscais:", error);
      res.status(500).json({ message: "Erro ao salvar parâmetros fiscais." });
    }
  });

module.exports = router;
