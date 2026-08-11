// routes/rotaNotaFiscal.js
// Emissao de Nota Fiscal — Fase A (painel semi-automatico).
//
// O sistema NAO emite a NFS-e junto ao portal da prefeitura/ADN Nacional —
// isso continua manual, feito pelo financeiro. Esta rota só:
//   1) mostra quais orçamentos fechados ainda têm saldo a faturar;
//   2) monta os dados prontos pra copiar na emissão manual;
//   3) registra o resultado (número da nota, tributos, status) de volta,
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
const { verificarPermissao } = require('../middlewares/permissaoMiddleware');
const logMiddleware = require('../middlewares/logMiddleware');
const { gerarXmlPedidoEnvioLoteRPS } = require('../utils/gerarXmlRpsLote');

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

// GET /notafiscal/pendentes — orçamentos fechados da empresa, com faturado/saldo
// Filtros opcionais via querystring: idcliente, idevento, idempresaemissora,
// dtRealizacaoDe/dtRealizacaoAte, dtVencimentoDe/dtVencimentoAte. Com só uma
// ponta de um período preenchida, filtra a data exata; com as duas, filtra o
// intervalo. Vencimento é da PARCELA (orcamentoparcelas), não do orçamento —
// um orçamento parcelado casa se QUALQUER parcela vencer dentro do período.
router.get("/pendentes", verificarPermissao('notafiscal', 'pesquisar'), async (req, res) => {
  const idempresa = req.idempresa;
  const { idcliente, idevento, idempresaemissora } = req.query;
  let { dtRealizacaoDe, dtRealizacaoAte, dtVencimentoDe, dtVencimentoAte } = req.query;

  if (dtRealizacaoDe && !dtRealizacaoAte) dtRealizacaoAte = dtRealizacaoDe;
  if (dtRealizacaoAte && !dtRealizacaoDe) dtRealizacaoDe = dtRealizacaoAte;
  if (dtVencimentoDe && !dtVencimentoAte) dtVencimentoAte = dtVencimentoDe;
  if (dtVencimentoAte && !dtVencimentoDe) dtVencimentoDe = dtVencimentoAte;

  try {
    const result = await pool.query(
      `SELECT
         o.idorcamento, o.nrorcamento, o.vlrcliente,
         o.idcliente, c.razaosocial AS cliente_nome,
         o.idevento, e.nmevento AS evento_nome,
         o.idempresaemissora, em.nmfantasia AS emissora_nome,
         o.dtinirealizacao, o.dtfimrealizacao,
         o.formapagamento,
         COALESCE(nf.faturado, 0) AS faturado,
         (o.vlrcliente - COALESCE(nf.faturado, 0)) AS saldo,
         prox.proximovencimento
       FROM orcamentos o
       JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento AND oe.idempresa = $1
       LEFT JOIN clientes c ON c.idcliente = o.idcliente
       LEFT JOIN eventos e ON e.idevento = o.idevento
       LEFT JOIN empresas em ON em.idempresa = o.idempresaemissora
       LEFT JOIN (
         SELECT idorcamento, SUM(valorservico) AS faturado
         FROM notasfiscais
         WHERE status <> 'Cancelada'
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
      ]
    );
    return res.json(result.rows);
  } catch (error) {
    console.error("Erro ao buscar orçamentos pendentes de faturamento:", error);
    res.status(500).json({ message: "Erro ao buscar orçamentos pendentes de faturamento." });
  }
});

// GET /notafiscal/orcamento/:idorcamento — dados pra pré-popular a emissão
router.get("/orcamento/:idorcamento", verificarPermissao('notafiscal', 'pesquisar'), async (req, res) => {
  const idempresa = req.idempresa;
  const { idorcamento } = req.params;

  try {
    const result = await pool.query(
      `SELECT
         o.idorcamento, o.nrorcamento, o.vlrcliente, o.formapagamento,
         o.dtinirealizacao, o.dtfimrealizacao,
         c.idcliente, c.razaosocial, c.cnpj, c.tpcliente, c.inscricaomunicipal,
         c.rua, c.numero, c.complemento, c.bairro, c.cidade, c.estado, c.cep,
         ce.emailnfe,
         e.nmevento,
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
       LEFT JOIN empresas em ON em.idempresa = o.idempresaemissora
       LEFT JOIN bancos b ON b.idbanco = em.idbanco
       LEFT JOIN (
         SELECT idorcamento, SUM(valorservico) AS faturado
         FROM notasfiscais
         WHERE status <> 'Cancelada'
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

// GET /notafiscal/orcamento/:idorcamento/historico — notas já registradas
router.get("/orcamento/:idorcamento/historico", verificarPermissao('notafiscal', 'pesquisar'), async (req, res) => {
  const idempresa = req.idempresa;
  const { idorcamento } = req.params;

  try {
    const result = await pool.query(
      `SELECT nf.*, op.numparcela, op.dtvencimento
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

// GET /notafiscal/orcamento/:idorcamento/parcelas — parcelas de pagamento
// (vazio quando o orçamento é à vista — front continua com o valor manual)
router.get("/orcamento/:idorcamento/parcelas", verificarPermissao('notafiscal', 'pesquisar'), async (req, res) => {
  const idempresa = req.idempresa;
  const { idorcamento } = req.params;

  try {
    const result = await pool.query(
      `SELECT op.*,
         (SELECT nf.idnotafiscal FROM notasfiscais nf
           WHERE nf.idparcela = op.idparcela AND nf.status <> 'Cancelada'
           ORDER BY nf.dtregistro DESC LIMIT 1) AS notaativaid,
         (SELECT nf.status FROM notasfiscais nf
           WHERE nf.idparcela = op.idparcela AND nf.status <> 'Cancelada'
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

// PATCH /notafiscal/parcela/:idparcela — corrige o vencimento da parcela
// aberta antes de gerar a nota (o financeiro percebe a data errada só na
// hora de emitir). Só mexe em parcela ainda 'Aberta' — depois de faturada
// o vencimento já virou histórico da nota emitida.
router.patch("/parcela/:idparcela", verificarPermissao('notafiscal', 'alterar'), async (req, res) => {
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
router.post("/", verificarPermissao('notafiscal', 'cadastrar'),
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
        // 2ª nota pra mesma parcela enquanto a 1ª ainda está "XML Gerada".
        // Bloqueia aqui, direto pela tabela de notas.
        const notaAtivaExistente = await client.query(
          `SELECT idnotafiscal FROM notasfiscais WHERE idparcela = $1 AND status <> 'Cancelada'`,
          [idparcela]
        );
        if (notaAtivaExistente.rowCount) {
          throw new Error("Essa parcela já tem uma nota registrada (XML Gerada ou Emitida). Cancele a nota existente antes de registrar outra.");
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
          descricaomeiopagamento || null, observacao || null, status || 'XML Gerada', req.usuario.idusuario
        ]
      );

      // A parcela só vira "Faturada" quando a nota for confirmada como
      // Emitida (PUT /:id) — registrar aqui só gera o XML, e o financeiro
      // pode descartar/refazer sem a parcela ficar travada à toa.

      await client.query("COMMIT");

      const novaNota = result.rows[0];
      res.locals.acao = 'cadastrou';
      res.locals.idregistroalterado = novaNota.idnotafiscal;
      res.locals.dadosnovos = novaNota;

      res.status(201).json({ message: "Nota fiscal registrada com sucesso!", notafiscal: novaNota });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Erro ao registrar nota fiscal:", error);
      res.status(500).json({ message: "Erro ao registrar nota fiscal.", detail: error.message });
    } finally {
      client.release();
    }
  });

// PUT /notafiscal/:id — atualiza status/número da nota após emissão manual no portal
router.put("/:id", verificarPermissao('notafiscal', 'alterar'),
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
    const { status, numeronota, identificadornacional, codigoverificacao, observacao } = req.body;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const result = await client.query(
        `UPDATE notasfiscais
         SET status = COALESCE($1, status),
             numeronota = COALESCE($2, numeronota),
             identificadornacional = COALESCE($3, identificadornacional),
             codigoverificacao = COALESCE($4, codigoverificacao),
             observacao = COALESCE($5, observacao),
             dtemissao = CASE WHEN $1 = 'Emitida' AND dtemissao IS NULL THEN now() ELSE dtemissao END
         WHERE idnotafiscal = $6 AND idempresa = $7
         RETURNING *`,
        [status || null, numeronota || null, identificadornacional || null, codigoverificacao || null, observacao || null, id, idempresa]
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

// POST /notafiscal/:id/anexo — anexa o PDF/comprovante baixado do portal
router.post("/:id/anexo", verificarPermissao('notafiscal', 'alterar'), (req, res) => {
  uploadNotaFiscal(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ message: err.message });
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

// GET /notafiscal/:id/xml — gera na hora (nada é gravado) o XML do "Pedido de
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
            nf.valorpiscofinscsll,
            em.cnpj AS emissora_cnpj, em.inscricaomunicipal AS emissora_inscricaomunicipal,
            cl.cnpj AS cliente_cnpj, cl.inscricaomunicipal AS cliente_inscricaomunicipal,
            ce.emailnfe AS cliente_email,
            s.codigoservico, s.nbs, s.cindop, s.classificacaotributaria
       FROM notasfiscais nf
       JOIN orcamentos o ON o.idorcamento = nf.idorcamento
       LEFT JOIN empresas em ON em.idempresa = o.idempresaemissora
       LEFT JOIN clientes cl ON cl.idcliente = nf.idcliente
       LEFT JOIN clienteempresas ce ON ce.idcliente = cl.idcliente AND ce.idempresa = nf.idempresa
       LEFT JOIN servicos s ON s.idservico = nf.idservico
      WHERE nf.idnotafiscal = ANY($1::int[]) AND nf.idempresa = $2`,
    [idsNotasFiscais, idempresa]
  );
  return result.rows;
}

// Retorna uma mensagem de erro se a nota não tiver os dados mínimos pro XML,
// ou null se estiver tudo certo.
function validarNotaParaXml(nf) {
  if (!nf.emissora_cnpj || !nf.emissora_inscricaomunicipal) {
    return `Nota #${nf.idnotafiscal}: a empresa emissora do orçamento não tem CNPJ/Inscrição Municipal cadastrados (cadastre em Empresas).`;
  }
  if (!nf.codigoservico || !nf.nbs || !nf.cindop || !nf.classificacaotributaria) {
    return `Nota #${nf.idnotafiscal}: o serviço não tem Código/NBS/CIndOp/Classificação Tributária cadastrados (cadastre em Serviços).`;
  }
  return null;
}

function montarNotaParaGerador(nf) {
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
    nbs: nf.nbs,
    cIndOp: nf.cindop,
    classificacaoTributaria: nf.classificacaotributaria
  };
}

router.get("/:id/xml", verificarPermissao('notafiscal', 'pesquisar'), async (req, res) => {
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
      return res.status(400).json({ message: erro });
    }

    const xml = gerarXmlPedidoEnvioLoteRPS({
      empresaEmissora: {
        cnpj: nf.emissora_cnpj,
        inscricaomunicipal: nf.emissora_inscricaomunicipal
      },
      notas: [montarNotaParaGerador(nf)]
    });

    // Nome fixo por nota (não leva data/hora) — gerar de novo a mesma nota
    // SOBRESCREVE o arquivo anterior em vez de duplicar na pasta.
    const nomeArquivo = `RPS-${nf.idnotafiscal}.xml`;
    const caminhoRelativo = `uploads/notasparaenvio/${nomeArquivo}`;
    fs.writeFileSync(path.join(dirNotasParaEnvio, nomeArquivo), xml, 'utf8');

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
    res.status(500).json({ message: "Erro ao gerar XML.", detail: error.message });
  }
});

// GET /notafiscal/prontas-envio — todas as notas "XML Gerada" da empresa (de
// qualquer orçamento), pra escolher quais entram no lote a baixar juntas.
router.get("/prontas-envio", verificarPermissao('notafiscal', 'pesquisar'), async (req, res) => {
  const idempresa = req.idempresa;

  try {
    const result = await pool.query(
      `SELECT nf.idnotafiscal, nf.idorcamento, nf.descricaoservico, nf.valorservico, nf.dtregistro,
              o.nrorcamento, c.razaosocial AS cliente_nome,
              op.numparcela, op.dtvencimento,
              em.nmfantasia AS emissora_nome, o.idempresaemissora
         FROM notasfiscais nf
         JOIN orcamentos o ON o.idorcamento = nf.idorcamento
         LEFT JOIN clientes c ON c.idcliente = nf.idcliente
         LEFT JOIN orcamentoparcelas op ON op.idparcela = nf.idparcela
         LEFT JOIN empresas em ON em.idempresa = o.idempresaemissora
        WHERE nf.idempresa = $1 AND nf.status = 'XML Gerada'
        ORDER BY nf.dtregistro ASC`,
      [idempresa]
    );
    return res.json(result.rows);
  } catch (error) {
    console.error("Erro ao buscar notas prontas para envio:", error);
    res.status(500).json({ message: "Erro ao buscar notas prontas para envio." });
  }
});

// POST /notafiscal/xml-lote — gera UM único XML de "Envio de RPS em Lote"
// com várias notas juntas (o layout já suporta isso — é pra isso que serve
// o lote). Máximo 50 por lote (limite do XSD), e todas precisam ser da MESMA
// empresa emissora, já que o Cabecalho do envelope só tem um CPFCNPJRemetente.
router.post("/xml-lote", verificarPermissao('notafiscal', 'pesquisar'), async (req, res) => {
  const idempresa = req.idempresa;
  const { idsNotasFiscais } = req.body;

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
      if (erro) return res.status(400).json({ message: erro });
    }

    const emissorasDistintas = new Set(linhas.map((nf) => nf.emissora_cnpj));
    if (emissorasDistintas.size > 1) {
      return res.status(400).json({ message: "As notas selecionadas são de empresas emissoras diferentes — selecione notas de uma única empresa emissora por lote." });
    }

    const xml = gerarXmlPedidoEnvioLoteRPS({
      empresaEmissora: {
        cnpj: linhas[0].emissora_cnpj,
        inscricaomunicipal: linhas[0].emissora_inscricaomunicipal
      },
      notas: linhas.map(montarNotaParaGerador)
    });

    // Aqui NÃO dá pra usar um nome fixo (o mesmo conjunto de ids poderia
    // legitimamente ser baixado de novo, mas um lote diferente de notas
    // também vira "Lote-RPS" — sem hora teria risco de um sobrescrever o
    // outro por engano). Carimbo com data E hora deixa cada geração única.
    const carimbo = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
    const nomeArquivo = `Lote-RPS-${carimbo}-${linhas.length}notas.xml`;
    fs.writeFileSync(path.join(dirNotasParaEnvio, nomeArquivo), xml, 'utf8');

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${nomeArquivo}"`);
    return res.send(xml);
  } catch (error) {
    console.error("Erro ao gerar XML do lote:", error);
    res.status(500).json({ message: "Erro ao gerar XML do lote.", detail: error.message });
  }
});

// GET /notafiscal/parametros?ano=2026 — alíquotas de CBS/IBS/retenções vigentes no ano
// (tabela própria do módulo Nota Fiscal — não confundir com `aliquotas`, que é do RH/folha)
router.get("/parametros", verificarPermissao('notafiscal', 'pesquisar'), async (req, res) => {
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

// PUT /notafiscal/parametros/:ano — cadastra/atualiza as alíquotas do ano (upsert)
router.put("/parametros/:ano", verificarPermissao('notafiscal', 'alterar'),
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
