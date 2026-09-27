// ===== Almoxarifado geral: itens consumíveis de qualquer setor (não só TI) =====
// Mesmo modelo do almoxarifado de TI (public/js/TIMode.js, routes/rotaTI.js): item
// vai sendo consumido aos poucos e precisa ser reposto de tempos em tempos.
const express = require("express");
const router = express.Router();
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const pool = require("../db/conexaoDB");
const { verificarPermissao } = require("../middlewares/permissaoMiddleware");
const logMiddleware = require("../middlewares/logMiddleware");

// Foto do item — mesmo padrão de empresas.logo (routes/rotaEmpresa.js): nome
// fixo por item, um novo upload sobrescreve o anterior em vez de acumular.
const dirFotosItens = path.join(__dirname, "..", "uploads", "almoxarifado");
if (!fs.existsSync(dirFotosItens)) fs.mkdirSync(dirFotosItens, { recursive: true });

const storageFoto = multer.diskStorage({
  destination: (req, file, cb) => cb(null, dirFotosItens),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `item_${req.params.id}${ext}`);
  },
});

const uploadFoto = multer({
  storage: storageFoto,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) return cb(null, true);
    cb(new Error("Envie um arquivo de imagem (PNG, JPG, etc.)."));
  },
});

// Locais fixos do almoxarifado geral — viram abas na tela (ver AlmoxarifadoMode.js).
// Mesma lista precisa bater com o CHECK da coluna `local` (ver migrations).
const LOCAIS = ["Escritório", "Consumíveis Pavilhão", "Camisetas"];

// Editar o cadastro do item (nome, local, unidade, mínimo) é sensível em qualquer
// local — continua nas flags administrativas de sempre.
const FLAGS_EDICAO_ITEM = ["supremo", "master", "financeiro", "devs"];

// "Camisetas" é sensível (custo/estoque de brinde) e tem flag PRÓPRIA — saiu do
// `financeiro` (ver migration nova_permissao_camisetas). Sem `camisetas` marcada,
// nem financeiro nem master enxergam o local; só o supremo passa por cima.
// Mesmo padrão de exigirFlag em permissaoMiddleware.js, mas condicional ao `local`.
const FLAGS_CAMISETAS = ["supremo", "camisetas"];

// Quem aprova a lista de compras, cotações e recebimento (ver seção Compras).
const FLAGS_APROVACAO = ["master", "supremo"];

async function temAlgumaFlag(idusuario, idempresa, flags) {
  if (!idusuario || !idempresa) return false;
  const condicao = flags.map((f) => `${f} = true`).join(" OR ");
  const { rows } = await pool.query(
    `SELECT 1 FROM permissoes WHERE idusuario = $1 AND idempresa = $2 AND (${condicao}) LIMIT 1`,
    [idusuario, idempresa]
  );
  return rows.length > 0;
}

// Quem enxerga/mexe no local "Camisetas".
function podeVerCamisetas(idusuario, idempresa) {
  return temAlgumaFlag(idusuario, idempresa, FLAGS_CAMISETAS);
}

// Quem pode editar o cadastro de qualquer item do almoxarifado.
function podeEditarItem(idusuario, idempresa) {
  return temAlgumaFlag(idusuario, idempresa, FLAGS_EDICAO_ITEM);
}

function podeAprovarCompras(idusuario, idempresa) {
  return temAlgumaFlag(idusuario, idempresa, FLAGS_APROVACAO);
}

// Middleware: exige uma das flags administrativas sempre, sem depender do `local`
// — usado na edição do item (nome, local, unidade, mínimo), que é sensível
// independente de o item estar ou não em Camisetas.
async function exigirFlagsEdicaoItem(req, res, next) {
  try {
    const liberado = await podeEditarItem(req.usuario?.idusuario, req.idempresa);
    if (!liberado) {
      return res.status(403).json({ message: "Você não tem permissão para editar itens do almoxarifado." });
    }
    next();
  } catch (error) {
    console.error("Erro ao verificar flags de edição de item:", error);
    res.status(500).json({ message: "Erro ao verificar permissões." });
  }
}

// Middleware: bloqueia quando o `local` (body ou query) for "Camisetas" e o
// usuário não tiver a flag `camisetas` (ou `supremo`).
async function bloquearCamisetasSemFlag(req, res, next) {
  const local = req.body?.local || req.query?.local;
  if (local !== "Camisetas") return next();

  try {
    const liberado = await podeVerCamisetas(req.usuario?.idusuario, req.idempresa);
    if (!liberado) {
      return res.status(403).json({ message: "Você não tem permissão para acessar Camisetas." });
    }
    next();
  } catch (error) {
    console.error("Erro ao verificar flags de Camisetas:", error);
    res.status(500).json({ message: "Erro ao verificar permissões." });
  }
}

// Mesma checagem de "Camisetas", só que resolvendo o local pelo item da URL
// (rotas de movimentação/histórico não recebem `local` no body/query).
async function bloquearCamisetasPorItem(req, res, next) {
  try {
    const item = await pool.query(`SELECT local FROM almoxarifadogeral WHERE iditem = $1 AND idempresa = $2`, [req.params.id, req.idempresa]);
    if (item.rows[0]?.local !== "Camisetas") return next();

    const liberado = await podeVerCamisetas(req.usuario?.idusuario, req.idempresa);
    if (!liberado) {
      return res.status(403).json({ message: "Você não tem permissão para acessar Camisetas." });
    }
    next();
  } catch (error) {
    console.error("Erro ao verificar flags de Camisetas:", error);
    res.status(500).json({ message: "Erro ao verificar permissões." });
  }
}

// GET locais disponíveis (pra montar as abas no front sem hardcodar duas vezes)
// — "Camisetas" só entra na lista pra quem tem as flags especiais.
router.get("/locais", verificarPermissao("Almoxarifado", "pesquisar"), async (req, res) => {
  try {
    const liberado = await podeVerCamisetas(req.usuario?.idusuario, req.idempresa);
    res.json(liberado ? LOCAIS : LOCAIS.filter((l) => l !== "Camisetas"));
  } catch (error) {
    console.error("Erro ao verificar flags de Camisetas:", error);
    res.status(500).json({ message: "Erro ao listar locais do almoxarifado." });
  }
});

// GET lista de itens de um local, com flag de quem está abaixo do mínimo
router.get("/", verificarPermissao("Almoxarifado", "pesquisar"), bloquearCamisetasSemFlag, async (req, res) => {
  const idempresa = req.idempresa;
  const { local } = req.query;

  if (!local || !LOCAIS.includes(local)) {
    return res.status(400).json({ message: "Local inválido." });
  }

  try {
    const result = await pool.query(
      `SELECT * FROM almoxarifadogeral WHERE idempresa = $1 AND local = $2 ORDER BY descricao ASC`,
      [idempresa, local]
    );
    const itens = result.rows.map((item) => ({
      ...item,
      abaixo_minimo: item.quantidade_atual < item.estoque_minimo,
    }));
    res.json(itens);
  } catch (error) {
    console.error("Erro ao listar almoxarifado:", error);
    res.status(500).json({ message: "Erro ao listar almoxarifado." });
  }
});

// POST cadastrar novo item
router.post("/",
  verificarPermissao("Almoxarifado", "cadastrar"),
  bloquearCamisetasSemFlag,
  logMiddleware("Almoxarifado", { buscarDadosAnteriores: async () => ({ dadosanteriores: null, idregistroalterado: null }) }),
  async (req, res) => {
    const idempresa = req.idempresa;
    const idusuario = req.usuario?.idusuario;
    const { local, descricao, unidade_medida, quantidade_atual, estoque_minimo } = req.body;

    if (!descricao || !descricao.trim()) {
      return res.status(400).json({ message: "Descreva o item." });
    }
    if (!local || !LOCAIS.includes(local)) {
      return res.status(400).json({ message: "Local inválido." });
    }

    try {
      const result = await pool.query(
        `INSERT INTO almoxarifadogeral (idempresa, local, descricao, unidade_medida, quantidade_atual, estoque_minimo, idusuario)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [
          idempresa,
          local,
          descricao.trim(),
          unidade_medida || "unidade",
          Number(quantidade_atual) || 0,
          Number(estoque_minimo) || 0,
          idusuario || null,
        ]
      );

      const novo = result.rows[0];
      res.locals.acao = "cadastrou item no almoxarifado";
      res.locals.idregistroalterado = novo.iditem;
      res.locals.idusuarioAlvo = null;
      res.locals.dadosnovos = novo;

      res.status(201).json({ message: "Item cadastrado com sucesso!", item: novo });
    } catch (error) {
      console.error("Erro ao cadastrar item do almoxarifado:", error);
      res.status(500).json({ message: "Erro ao cadastrar item do almoxarifado." });
    }
  }
);

// PUT editar cadastro (descrição, unidade, mínimo) — não mexe em quantidade_atual
// Editar o cadastro do item (nome/descrição, local, unidade, mínimo) é restrito
// às flags administrativas (FLAGS_EDICAO_ITEM) — não é sobre local aqui, é sobre
// a ação de editar em si, então roda sempre, pra qualquer item.
router.put("/:id",
  verificarPermissao("Almoxarifado", "alterar"),
  exigirFlagsEdicaoItem,
  logMiddleware("Almoxarifado", { buscarDadosAnteriores: async () => ({ dadosanteriores: null, idregistroalterado: null }) }),
  async (req, res) => {
    const idempresa = req.idempresa;
    const { local, descricao, unidade_medida, estoque_minimo } = req.body;

    if (!descricao || !descricao.trim()) {
      return res.status(400).json({ message: "Descreva o item." });
    }
    if (!local || !LOCAIS.includes(local)) {
      return res.status(400).json({ message: "Local inválido." });
    }

    try {
      const result = await pool.query(
        `UPDATE almoxarifadogeral
           SET local = $1, descricao = $2, unidade_medida = $3, estoque_minimo = $4
           WHERE iditem = $5 AND idempresa = $6 RETURNING *`,
        [local, descricao.trim(), unidade_medida || "unidade", Number(estoque_minimo) || 0, req.params.id, idempresa]
      );

      if (!result.rowCount) {
        return res.status(404).json({ message: "Item não encontrado." });
      }

      res.locals.acao = "atualizou item do almoxarifado";
      res.locals.idregistroalterado = req.params.id;
      res.locals.idusuarioAlvo = null;
      res.locals.dadosnovos = result.rows[0];

      res.json({ message: "Item atualizado com sucesso!", item: result.rows[0] });
    } catch (error) {
      console.error("Erro ao atualizar item do almoxarifado:", error);
      res.status(500).json({ message: "Erro ao atualizar item do almoxarifado." });
    }
  }
);

// POST enviar/trocar a foto do item
router.post("/:id/foto", verificarPermissao("Almoxarifado", "alterar"), bloquearCamisetasPorItem, (req, res) => {
  uploadFoto.single("foto")(req, res, async (err) => {
    if (err) {
      console.error("Erro no upload da foto do item:", err);
      return res.status(400).json({ message: "Erro ao enviar a foto." });
    }
    if (!req.file) {
      return res.status(400).json({ message: "Envie um arquivo de imagem." });
    }

    const caminhoRelativo = `uploads/almoxarifado/${req.file.filename}`;
    try {
      const result = await pool.query(
        `UPDATE almoxarifadogeral SET foto = $1 WHERE iditem = $2 AND idempresa = $3 RETURNING iditem, foto`,
        [caminhoRelativo, req.params.id, req.idempresa]
      );
      if (!result.rowCount) {
        return res.status(404).json({ message: "Item não encontrado." });
      }
      res.json({ message: "Foto salva com sucesso.", foto: caminhoRelativo });
    } catch (error) {
      console.error("Erro ao salvar foto do item do almoxarifado:", error);
      res.status(500).json({ message: "Erro ao salvar a foto." });
    }
  });
});

// PUT movimentar quantidade (entrada = reposição, saída = consumo)
router.put("/:id/movimentacao",
  verificarPermissao("Almoxarifado", "alterar"),
  bloquearCamisetasPorItem,
  logMiddleware("Almoxarifado", { buscarDadosAnteriores: async () => ({ dadosanteriores: null, idregistroalterado: null }) }),
  async (req, res) => {
    const idempresa = req.idempresa;
    const idusuario = req.usuario?.idusuario;
    const { tipo, quantidade, motivo, idfuncionario_solicitante } = req.body;

    if (!["entrada", "saida"].includes(tipo)) {
      return res.status(400).json({ message: "Tipo de movimentação inválido." });
    }
    if (!Number.isInteger(quantidade) || quantidade <= 0) {
      return res.status(400).json({ message: "Quantidade inválida." });
    }

    let client;
    try {
      client = await pool.connect();
      await client.query("BEGIN");

      const itemResult = await client.query(
        `SELECT * FROM almoxarifadogeral WHERE iditem = $1 AND idempresa = $2 FOR UPDATE`,
        [req.params.id, idempresa]
      );
      if (!itemResult.rowCount) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Item não encontrado." });
      }

      const item = itemResult.rows[0];
      if (tipo === "saida" && quantidade > item.quantidade_atual) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: `Quantidade maior que a disponível (${item.quantidade_atual} ${item.unidade_medida}).` });
      }

      const novaQuantidade = tipo === "entrada" ? item.quantidade_atual + quantidade : item.quantidade_atual - quantidade;
      const updateResult = await client.query(
        `UPDATE almoxarifadogeral SET quantidade_atual = $1 WHERE iditem = $2 RETURNING *`,
        [novaQuantidade, item.iditem]
      );

      await client.query(
        `INSERT INTO almoxarifadogeralhistorico (iditem, tipo, quantidade, motivo, idusuario, idfuncionario_solicitante)
           VALUES ($1, $2, $3, $4, $5, $6)`,
        [item.iditem, tipo, quantidade, motivo || null, idusuario || null, idfuncionario_solicitante || null]
      );

      await client.query("COMMIT");

      res.locals.acao = tipo === "entrada" ? "repôs item do almoxarifado" : "consumiu item do almoxarifado";
      res.locals.idregistroalterado = item.iditem;
      res.locals.idusuarioAlvo = null;
      res.locals.dadosnovos = updateResult.rows[0];

      res.json({ message: "Movimentação registrada com sucesso!", item: updateResult.rows[0] });
    } catch (error) {
      if (client) await client.query("ROLLBACK");
      console.error("Erro ao movimentar item do almoxarifado:", error);
      res.status(500).json({ message: "Erro ao movimentar item do almoxarifado." });
    } finally {
      if (client) client.release();
    }
  }
);

// GET histórico de movimentações de um item
router.get("/:id/movimentacoes", verificarPermissao("Almoxarifado", "pesquisar"), bloquearCamisetasPorItem, async (req, res) => {
  const idempresa = req.idempresa;

  try {
    const itemResult = await pool.query(
      `SELECT iditem FROM almoxarifadogeral WHERE iditem = $1 AND idempresa = $2`,
      [req.params.id, idempresa]
    );
    if (!itemResult.rowCount) {
      return res.status(404).json({ message: "Item não encontrado." });
    }

    const { data_inicio, data_fim, idusuario, idfuncionario_solicitante } = req.query;
    const condicoes = ["h.iditem = $1"];
    const valores = [req.params.id];

    if (data_inicio) {
      valores.push(data_inicio);
      condicoes.push(`h.criado_em >= $${valores.length}`);
    }
    if (data_fim) {
      valores.push(data_fim);
      condicoes.push(`h.criado_em < ($${valores.length}::date + interval '1 day')`);
    }
    if (idusuario) {
      valores.push(idusuario);
      condicoes.push(`h.idusuario = $${valores.length}`);
    }
    if (idfuncionario_solicitante) {
      valores.push(idfuncionario_solicitante);
      condicoes.push(`h.idfuncionario_solicitante = $${valores.length}`);
    }

    const result = await pool.query(
      `SELECT h.*, u.nome AS nome_usuario, f.nome AS nome_funcionario_solicitante
         FROM almoxarifadogeralhistorico h
         LEFT JOIN usuarios u ON u.idusuario = h.idusuario
         LEFT JOIN funcionarios f ON f.idfuncionario = h.idfuncionario_solicitante
        WHERE ${condicoes.join(" AND ")}
        ORDER BY h.criado_em DESC`,
      valores
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Erro ao buscar movimentações do item:", error);
    res.status(500).json({ message: "Erro ao buscar movimentações do item." });
  }
});

// GET autocomplete de funcionário (mesmo padrão de /ti/funcionarios/busca)
router.get("/funcionarios/busca", verificarPermissao("Almoxarifado", "pesquisar"), async (req, res) => {
  const idempresa = req.idempresa;
  const busca = (req.query.busca || "").trim();

  if (!busca) return res.json([]);

  try {
    const result = await pool.query(
      `SELECT DISTINCT f.idfuncionario, f.nome
         FROM funcionarios f
         INNER JOIN funcionarioempresas fe ON fe.idfuncionario = f.idfuncionario
         WHERE fe.idempresa = $1 AND fe.ativo = true
           AND fe.perfil IN ('Interno', 'ExternoH', 'Externo')
           AND f.nome ILIKE $2
         ORDER BY f.nome ASC LIMIT 20`,
      [idempresa, `%${busca}%`]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Erro ao buscar funcionários (Almoxarifado):", error);
    res.status(500).json({ message: "Erro ao buscar funcionários." });
  }
});

// GET autocomplete de usuário (pra filtro de histórico)
router.get("/usuarios/busca", verificarPermissao("Almoxarifado", "pesquisar"), async (req, res) => {
  const idempresa = req.idempresa;
  const busca = (req.query.busca || "").trim();

  if (!busca) return res.json([]);

  try {
    const result = await pool.query(
      `SELECT idusuario, nome, sobrenome, email
         FROM usuarios
         WHERE idempresadefault = $1 AND ativo = true
           AND (nome ILIKE $2 OR sobrenome ILIKE $2 OR email ILIKE $2)
         ORDER BY nome ASC LIMIT 20`,
      [idempresa, `%${busca}%`]
    );
    res.json(result.rows.map((u) => ({ idusuario: u.idusuario, nome: `${u.nome}${u.sobrenome ? " " + u.sobrenome : ""} (${u.email})` })));
  } catch (error) {
    console.error("Erro ao buscar usuários (Almoxarifado):", error);
    res.status(500).json({ message: "Erro ao buscar usuários." });
  }
});

// =============================================================================
// ===== COMPRAS =====
// Fecha o ciclo do item consumível: acima ficou o que já existia (entrada/saída
// manual), aqui entra o que vem ANTES da entrada:
//
//   sugestão de reposição → pedido (lista) → aprovação item a item do master →
//   cotação de fornecedores → recebimento confirmado (que aí sim vira entrada).
//
// Rotas com prefixo /compras — os dois segmentos evitam colisão com as rotas
// "/:id/..." do bloco de itens acima.
//
// Acesso: listar/criar pedido = Almoxarifado/pesquisar (solicitar não é cadastro
// de item, é pedido). Aprovar, cotar, receber e cancelar = master/supremo.
// Pedido do local "Camisetas" herda a mesma restrição da flag `camisetas`.
// =============================================================================

// Janela usada pra estimar consumo médio diário (sugestão de reposição e
// cobertura em dias). 90 dias dilui pico de evento.
const JANELA_CONSUMO_DIAS = 90;

// Quanto o estoque precisa estar perto do mínimo pra entrar na lista sugerida
// (1.3 = "já dá pra ir pensando em comprar"; abaixo de 1.0 é crítico).
const FATOR_ALERTA = 1.3;

// Referência de "estoque cheio" pra sugerir quanto comprar — mesma régua da
// barra de progresso do card no front (3x o mínimo).
const FATOR_IDEAL = 3;

// Middleware: só master/supremo passam (aprovação, cotação, recebimento).
async function exigirAprovadorCompras(req, res, next) {
  try {
    const liberado = await podeAprovarCompras(req.usuario?.idusuario, req.idempresa);
    if (!liberado) {
      return res.status(403).json({ message: "Só um master pode aprovar ou fechar compras." });
    }
    next();
  } catch (error) {
    console.error("Erro ao verificar permissão de aprovação de compras:", error);
    res.status(500).json({ message: "Erro ao verificar permissões." });
  }
}

// Mesma checagem de "Camisetas" do bloco de itens, resolvendo o local pelo pedido.
async function bloquearCamisetasPorPedido(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT local FROM almoxarifadopedido WHERE idpedido = $1 AND idempresa = $2`,
      [req.params.id, req.idempresa]
    );
    if (!rows.length) return res.status(404).json({ message: "Pedido não encontrado." });
    if (rows[0].local !== "Camisetas") return next();

    const liberado = await podeVerCamisetas(req.usuario?.idusuario, req.idempresa);
    if (!liberado) {
      return res.status(403).json({ message: "Você não tem permissão para acessar Camisetas." });
    }
    next();
  } catch (error) {
    console.error("Erro ao verificar flags de Camisetas (pedido):", error);
    res.status(500).json({ message: "Erro ao verificar permissões." });
  }
}

// Status do pedido é DERIVADO dos itens — não existe status "solto" que possa
// divergir do que o master decidiu item a item.
async function recalcularStatusPedido(client, idpedido) {
  const { rows: itens } = await client.query(
    `SELECT pi.status,
            EXISTS (SELECT 1 FROM almoxarifadocotacao c WHERE c.idpedidoitem = pi.idpedidoitem AND c.escolhida) AS tem_cotacao
       FROM almoxarifadopedidoitem pi
      WHERE pi.idpedido = $1`,
    [idpedido]
  );

  let status = "pendente";
  if (itens.length) {
    const pendentes = itens.filter((i) => i.status === "pendente");
    const aprovados = itens.filter((i) => i.status === "aprovado");
    const recebidos = itens.filter((i) => i.status === "recebido");

    if (pendentes.length) status = "pendente";
    else if (!aprovados.length && !recebidos.length) status = "recusado";
    else if (!aprovados.length) status = "recebido";
    else if (recebidos.length) status = "parcial";
    else status = aprovados.every((i) => i.tem_cotacao) ? "comprado" : "aprovado";
  }

  // O cast explícito é obrigatório: sem ele o Postgres tenta deduzir $1 como
  // varchar no SET e como text na comparação do CASE, e recusa (42P08).
  await client.query(
    `UPDATE almoxarifadopedido
        SET status = $1::text,
            dt_recebimento = CASE WHEN $1::text = 'recebido' AND dt_recebimento IS NULL THEN NOW() ELSE dt_recebimento END
      WHERE idpedido = $2 AND status <> 'cancelado'`,
    [status, idpedido]
  );

  return status;
}

// GET sugestão de reposição: itens abaixo do mínimo ou chegando perto dele, já
// com quanto comprar e quantos dias o estoque aguenta no ritmo atual.
router.get("/compras/sugestoes", verificarPermissao("Almoxarifado", "pesquisar"), bloquearCamisetasSemFlag, async (req, res) => {
  const { local } = req.query;
  if (!local || !LOCAIS.includes(local)) {
    return res.status(400).json({ message: "Local inválido." });
  }

  try {
    // Os fatores/janela entram como literais numéricos (constantes do próprio
    // arquivo, não entrada do usuário) — como parâmetro o Postgres inferiria
    // text e quebraria as multiplicações.
    const result = await pool.query(
      `WITH consumo AS (
         SELECT h.iditem, SUM(h.quantidade)::numeric AS total_saida
           FROM almoxarifadogeralhistorico h
          WHERE h.tipo = 'saida'
            AND h.criado_em >= NOW() - make_interval(days => ${Number(JANELA_CONSUMO_DIAS)})
          GROUP BY h.iditem
       )
       SELECT i.iditem,
              i.descricao,
              i.unidade_medida,
              i.quantidade_atual,
              i.estoque_minimo,
              i.foto,
              (i.quantidade_atual < i.estoque_minimo) AS abaixo_minimo,
              ROUND(COALESCE(c.total_saida, 0) / ${Number(JANELA_CONSUMO_DIAS)}::numeric, 2) AS consumo_dia,
              GREATEST(i.estoque_minimo * ${Number(FATOR_IDEAL)} - i.quantidade_atual, 1) AS quantidade_sugerida,
              (SELECT MAX(cp.dt_compra) FROM almoxarifadocompra cp WHERE cp.iditem = i.iditem) AS ultima_compra,
              EXISTS (
                SELECT 1
                  FROM almoxarifadopedidoitem pi
                  JOIN almoxarifadopedido p ON p.idpedido = pi.idpedido
                 WHERE pi.iditem = i.iditem
                   AND pi.status IN ('pendente', 'aprovado')
                   AND p.status NOT IN ('cancelado', 'recebido')
              ) AS ja_solicitado
         FROM almoxarifadogeral i
         LEFT JOIN consumo c ON c.iditem = i.iditem
        WHERE i.idempresa = $1
          AND i.local = $2
          AND i.quantidade_atual <= GREATEST(i.estoque_minimo * ${Number(FATOR_ALERTA)}, i.estoque_minimo + 1)
        ORDER BY (i.quantidade_atual < i.estoque_minimo) DESC, i.descricao ASC`,
      [req.idempresa, local]
    );

    const sugestoes = result.rows.map((item) => {
      const consumoDia = Number(item.consumo_dia) || 0;
      return {
        ...item,
        consumo_dia: consumoDia,
        // Quantos dias o que está na prateleira ainda cobre no ritmo atual.
        dias_cobertura: consumoDia > 0 ? Math.floor(item.quantidade_atual / consumoDia) : null,
      };
    });

    res.json(sugestoes);
  } catch (error) {
    console.error("Erro ao montar sugestões de compra:", error);
    res.status(500).json({ message: "Erro ao montar sugestões de compra." });
  }
});

// GET lista de pedidos (com resumo dos itens e valor já cotado)
router.get("/compras/pedidos", verificarPermissao("Almoxarifado", "pesquisar"), async (req, res) => {
  const { local, status, data_inicio, data_fim } = req.query;
  const condicoes = ["p.idempresa = $1"];
  const valores = [req.idempresa];

  try {
    // Sem flag especial o usuário nem enxerga pedidos de Camisetas na listagem.
    const liberado = await podeVerCamisetas(req.usuario?.idusuario, req.idempresa);
    if (!liberado) condicoes.push(`p.local <> 'Camisetas'`);

    if (local) {
      valores.push(local);
      condicoes.push(`p.local = $${valores.length}`);
    }
    if (status && status !== "todos") {
      valores.push(status);
      condicoes.push(`p.status = $${valores.length}`);
    }
    if (data_inicio) {
      valores.push(data_inicio);
      condicoes.push(`p.criado_em >= $${valores.length}`);
    }
    if (data_fim) {
      valores.push(data_fim);
      condicoes.push(`p.criado_em < ($${valores.length}::date + interval '1 day')`);
    }

    const result = await pool.query(
      `SELECT p.*,
              u.nome AS nome_solicitante,
              ua.nome AS nome_aprovador,
              COUNT(pi.idpedidoitem) AS total_itens,
              COUNT(*) FILTER (WHERE pi.status = 'pendente') AS itens_pendentes,
              COUNT(*) FILTER (WHERE pi.status = 'recusado') AS itens_recusados,
              COUNT(*) FILTER (WHERE pi.status = 'recebido') AS itens_recebidos,
              COALESCE(SUM(
                COALESCE(pi.quantidade_aprovada, pi.quantidade_solicitada) *
                (SELECT c.valor_unitario FROM almoxarifadocotacao c
                  WHERE c.idpedidoitem = pi.idpedidoitem AND c.escolhida LIMIT 1)
              ), 0) AS valor_estimado
         FROM almoxarifadopedido p
         LEFT JOIN almoxarifadopedidoitem pi ON pi.idpedido = p.idpedido
         LEFT JOIN usuarios u ON u.idusuario = p.idusuario_solicitante
         LEFT JOIN usuarios ua ON ua.idusuario = p.idusuario_aprovador
        WHERE ${condicoes.join(" AND ")}
        GROUP BY p.idpedido, u.nome, ua.nome
        ORDER BY p.criado_em DESC`,
      valores
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Erro ao listar pedidos de compra:", error);
    res.status(500).json({ message: "Erro ao listar pedidos de compra." });
  }
});

// GET detalhe do pedido (itens + cotações de cada item)
router.get("/compras/pedidos/:id", verificarPermissao("Almoxarifado", "pesquisar"), bloquearCamisetasPorPedido, async (req, res) => {
  try {
    const pedidoResult = await pool.query(
      `SELECT p.*, u.nome AS nome_solicitante, ua.nome AS nome_aprovador
         FROM almoxarifadopedido p
         LEFT JOIN usuarios u ON u.idusuario = p.idusuario_solicitante
         LEFT JOIN usuarios ua ON ua.idusuario = p.idusuario_aprovador
        WHERE p.idpedido = $1 AND p.idempresa = $2`,
      [req.params.id, req.idempresa]
    );
    if (!pedidoResult.rowCount) {
      return res.status(404).json({ message: "Pedido não encontrado." });
    }

    const itensResult = await pool.query(
      `SELECT pi.*,
              i.quantidade_atual,
              i.estoque_minimo,
              i.foto,
              COALESCE(
                (SELECT json_agg(json_build_object(
                          'idcotacao', c.idcotacao,
                          'idfornecedor', c.idfornecedor,
                          'fornecedor', COALESCE(f.nmfantasia, c.fornecedor_nome),
                          'valor_unitario', c.valor_unitario,
                          'prazo_entrega_dias', c.prazo_entrega_dias,
                          'observacao', c.observacao,
                          'escolhida', c.escolhida
                        ) ORDER BY c.valor_unitario ASC)
                   FROM almoxarifadocotacao c
                   LEFT JOIN fornecedores f ON f.idfornecedor = c.idfornecedor
                  WHERE c.idpedidoitem = pi.idpedidoitem),
                '[]'::json
              ) AS cotacoes
         FROM almoxarifadopedidoitem pi
         LEFT JOIN almoxarifadogeral i ON i.iditem = pi.iditem
        WHERE pi.idpedido = $1
        ORDER BY pi.idpedidoitem ASC`,
      [req.params.id]
    );

    res.json({
      ...pedidoResult.rows[0],
      itens: itensResult.rows,
      // Front usa isso pra mostrar/esconder os botões de aprovação (o bloqueio
      // real continua rota a rota no back).
      pode_aprovar: await podeAprovarCompras(req.usuario?.idusuario, req.idempresa),
    });
  } catch (error) {
    console.error("Erro ao buscar pedido de compra:", error);
    res.status(500).json({ message: "Erro ao buscar pedido de compra." });
  }
});

// POST criar pedido (lista de compra)
router.post("/compras/pedidos",
  verificarPermissao("Almoxarifado", "pesquisar"),
  bloquearCamisetasSemFlag,
  logMiddleware("Almoxarifado", { buscarDadosAnteriores: async () => ({ dadosanteriores: null, idregistroalterado: null }) }),
  async (req, res) => {
    const { local, dt_necessidade, observacao, itens } = req.body;

    if (!local || !LOCAIS.includes(local)) {
      return res.status(400).json({ message: "Local inválido." });
    }
    if (!Array.isArray(itens) || !itens.length) {
      return res.status(400).json({ message: "Inclua pelo menos um item na lista." });
    }
    for (const item of itens) {
      if (!item.descricao || !String(item.descricao).trim()) {
        return res.status(400).json({ message: "Todo item precisa de descrição." });
      }
      if (!Number.isInteger(item.quantidade_solicitada) || item.quantidade_solicitada <= 0) {
        return res.status(400).json({ message: `Quantidade inválida para "${item.descricao}".` });
      }
    }

    let client;
    try {
      client = await pool.connect();
      await client.query("BEGIN");

      const pedidoResult = await client.query(
        `INSERT INTO almoxarifadopedido (idempresa, local, dt_necessidade, observacao, idusuario_solicitante)
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [req.idempresa, local, dt_necessidade || null, observacao || null, req.usuario?.idusuario || null]
      );
      const pedido = pedidoResult.rows[0];

      for (const item of itens) {
        // Item já cadastrado é validado contra a empresa; senão vira item avulso
        // (iditem null), que só é cadastrado no recebimento.
        let iditem = null;
        if (item.iditem) {
          const { rows } = await client.query(
            `SELECT iditem FROM almoxarifadogeral WHERE iditem = $1 AND idempresa = $2`,
            [item.iditem, req.idempresa]
          );
          if (!rows.length) {
            await client.query("ROLLBACK");
            return res.status(400).json({ message: `Item ${item.descricao} não pertence a esta empresa.` });
          }
          iditem = rows[0].iditem;
        }

        await client.query(
          `INSERT INTO almoxarifadopedidoitem
             (idpedido, iditem, descricao, unidade_medida, quantidade_solicitada, justificativa)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            pedido.idpedido,
            iditem,
            String(item.descricao).trim().slice(0, 120),
            (item.unidade_medida || "unidade").slice(0, 20),
            item.quantidade_solicitada,
            item.justificativa ? String(item.justificativa).slice(0, 255) : null,
          ]
        );
      }

      await client.query("COMMIT");

      res.locals.acao = "criou pedido de compra no almoxarifado";
      res.locals.idregistroalterado = pedido.idpedido;
      res.locals.idusuarioAlvo = null;
      res.locals.dadosnovos = pedido;

      res.status(201).json({ message: "Lista de compra enviada para aprovação!", pedido });
    } catch (error) {
      if (client) await client.query("ROLLBACK");
      console.error("Erro ao criar pedido de compra:", error);
      res.status(500).json({ message: "Erro ao criar pedido de compra." });
    } finally {
      if (client) client.release();
    }
  }
);

// PUT decisão do master em UM item do pedido (aprovar com quantidade ajustada ou recusar)
router.put("/compras/pedidos/:id/itens/:idpedidoitem",
  verificarPermissao("Almoxarifado", "pesquisar"),
  exigirAprovadorCompras,
  bloquearCamisetasPorPedido,
  logMiddleware("Almoxarifado", { buscarDadosAnteriores: async () => ({ dadosanteriores: null, idregistroalterado: null }) }),
  async (req, res) => {
    const { status, quantidade_aprovada, observacao_aprovacao } = req.body;

    if (!["aprovado", "recusado"].includes(status)) {
      return res.status(400).json({ message: "Decisão inválida." });
    }

    let client;
    try {
      client = await pool.connect();
      await client.query("BEGIN");

      const itemResult = await client.query(
        `SELECT pi.* FROM almoxarifadopedidoitem pi
           JOIN almoxarifadopedido p ON p.idpedido = pi.idpedido
          WHERE pi.idpedidoitem = $1 AND pi.idpedido = $2 AND p.idempresa = $3 FOR UPDATE`,
        [req.params.idpedidoitem, req.params.id, req.idempresa]
      );
      if (!itemResult.rowCount) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Item do pedido não encontrado." });
      }
      if (itemResult.rows[0].status === "recebido") {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Item já recebido — não dá mais pra mudar a aprovação." });
      }

      // Quantidade aprovada só existe pra item aprovado; sem valor informado,
      // vale o que foi solicitado.
      const qtdAprovada =
        status === "aprovado"
          ? Number.isInteger(quantidade_aprovada) && quantidade_aprovada > 0
            ? quantidade_aprovada
            : itemResult.rows[0].quantidade_solicitada
          : null;

      const atualizado = await client.query(
        `UPDATE almoxarifadopedidoitem
            SET status = $1, quantidade_aprovada = $2, observacao_aprovacao = $3
          WHERE idpedidoitem = $4 RETURNING *`,
        [status, qtdAprovada, observacao_aprovacao ? String(observacao_aprovacao).slice(0, 255) : null, req.params.idpedidoitem]
      );

      await client.query(
        `UPDATE almoxarifadopedido SET idusuario_aprovador = $1, dt_aprovacao = NOW() WHERE idpedido = $2`,
        [req.usuario?.idusuario || null, req.params.id]
      );

      const statusPedido = await recalcularStatusPedido(client, req.params.id);
      await client.query("COMMIT");

      res.locals.acao = status === "aprovado" ? "aprovou item de compra" : "recusou item de compra";
      res.locals.idregistroalterado = req.params.id;
      res.locals.idusuarioAlvo = null;
      res.locals.dadosnovos = atualizado.rows[0];

      res.json({ message: "Decisão registrada.", item: atualizado.rows[0], status_pedido: statusPedido });
    } catch (error) {
      if (client) await client.query("ROLLBACK");
      console.error("Erro ao aprovar item do pedido:", error);
      res.status(500).json({ message: "Erro ao registrar a decisão." });
    } finally {
      if (client) client.release();
    }
  }
);

// PUT aprovar de uma vez todos os itens pendentes da lista
router.put("/compras/pedidos/:id/aprovar-tudo",
  verificarPermissao("Almoxarifado", "pesquisar"),
  exigirAprovadorCompras,
  bloquearCamisetasPorPedido,
  logMiddleware("Almoxarifado", { buscarDadosAnteriores: async () => ({ dadosanteriores: null, idregistroalterado: null }) }),
  async (req, res) => {
    let client;
    try {
      client = await pool.connect();
      await client.query("BEGIN");

      const pedido = await client.query(
        `SELECT idpedido FROM almoxarifadopedido
          WHERE idpedido = $1 AND idempresa = $2 AND status <> 'cancelado' FOR UPDATE`,
        [req.params.id, req.idempresa]
      );
      if (!pedido.rowCount) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Pedido não encontrado." });
      }

      const { rowCount } = await client.query(
        `UPDATE almoxarifadopedidoitem
            SET status = 'aprovado', quantidade_aprovada = COALESCE(quantidade_aprovada, quantidade_solicitada)
          WHERE idpedido = $1 AND status = 'pendente'`,
        [req.params.id]
      );

      await client.query(
        `UPDATE almoxarifadopedido SET idusuario_aprovador = $1, dt_aprovacao = NOW() WHERE idpedido = $2`,
        [req.usuario?.idusuario || null, req.params.id]
      );

      const statusPedido = await recalcularStatusPedido(client, req.params.id);
      await client.query("COMMIT");

      res.locals.acao = "aprovou lista de compra do almoxarifado";
      res.locals.idregistroalterado = req.params.id;
      res.locals.idusuarioAlvo = null;
      res.locals.dadosnovos = { itens_aprovados: rowCount };

      res.json({ message: `${rowCount} item(ns) aprovado(s).`, status_pedido: statusPedido });
    } catch (error) {
      if (client) await client.query("ROLLBACK");
      console.error("Erro ao aprovar lista de compra:", error);
      res.status(500).json({ message: "Erro ao aprovar a lista." });
    } finally {
      if (client) client.release();
    }
  }
);

// PUT cancelar pedido
router.put("/compras/pedidos/:id/cancelar",
  verificarPermissao("Almoxarifado", "pesquisar"),
  exigirAprovadorCompras,
  bloquearCamisetasPorPedido,
  logMiddleware("Almoxarifado", { buscarDadosAnteriores: async () => ({ dadosanteriores: null, idregistroalterado: null }) }),
  async (req, res) => {
    try {
      const result = await pool.query(
        `UPDATE almoxarifadopedido SET status = 'cancelado'
          WHERE idpedido = $1 AND idempresa = $2 AND status <> 'recebido' RETURNING *`,
        [req.params.id, req.idempresa]
      );
      if (!result.rowCount) {
        return res.status(404).json({ message: "Pedido não encontrado ou já recebido." });
      }

      res.locals.acao = "cancelou pedido de compra";
      res.locals.idregistroalterado = req.params.id;
      res.locals.idusuarioAlvo = null;
      res.locals.dadosnovos = result.rows[0];

      res.json({ message: "Pedido cancelado.", pedido: result.rows[0] });
    } catch (error) {
      console.error("Erro ao cancelar pedido de compra:", error);
      res.status(500).json({ message: "Erro ao cancelar pedido." });
    }
  }
);

// POST nova cotação de um item (vários fornecedores por item, uma escolhida)
router.post("/compras/pedidos/:id/itens/:idpedidoitem/cotacoes",
  verificarPermissao("Almoxarifado", "pesquisar"),
  exigirAprovadorCompras,
  bloquearCamisetasPorPedido,
  async (req, res) => {
    const { idfornecedor, fornecedor_nome, valor_unitario, prazo_entrega_dias, observacao, escolhida } = req.body;

    const valor = Number(valor_unitario);
    if (!Number.isFinite(valor) || valor < 0) {
      return res.status(400).json({ message: "Valor unitário inválido." });
    }
    if (!idfornecedor && !(fornecedor_nome || "").trim()) {
      return res.status(400).json({ message: "Informe o fornecedor." });
    }

    let client;
    try {
      client = await pool.connect();
      await client.query("BEGIN");

      const item = await client.query(
        `SELECT pi.idpedidoitem FROM almoxarifadopedidoitem pi
           JOIN almoxarifadopedido p ON p.idpedido = pi.idpedido
          WHERE pi.idpedidoitem = $1 AND pi.idpedido = $2 AND p.idempresa = $3`,
        [req.params.idpedidoitem, req.params.id, req.idempresa]
      );
      if (!item.rowCount) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Item do pedido não encontrado." });
      }

      // Só uma escolhida por item (índice único garante) — a anterior cai.
      if (escolhida) {
        await client.query(
          `UPDATE almoxarifadocotacao SET escolhida = false WHERE idpedidoitem = $1 AND escolhida`,
          [req.params.idpedidoitem]
        );
      }

      const result = await client.query(
        `INSERT INTO almoxarifadocotacao
           (idpedidoitem, idfornecedor, fornecedor_nome, valor_unitario, prazo_entrega_dias, observacao, escolhida, idusuario)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [
          req.params.idpedidoitem,
          idfornecedor || null,
          fornecedor_nome ? String(fornecedor_nome).trim().slice(0, 120) : null,
          valor,
          Number.isInteger(prazo_entrega_dias) ? prazo_entrega_dias : null,
          observacao ? String(observacao).slice(0, 255) : null,
          Boolean(escolhida),
          req.usuario?.idusuario || null,
        ]
      );

      const statusPedido = await recalcularStatusPedido(client, req.params.id);
      await client.query("COMMIT");

      res.status(201).json({ message: "Cotação registrada.", cotacao: result.rows[0], status_pedido: statusPedido });
    } catch (error) {
      if (client) await client.query("ROLLBACK");
      console.error("Erro ao registrar cotação:", error);
      res.status(500).json({ message: "Erro ao registrar cotação." });
    } finally {
      if (client) client.release();
    }
  }
);

// PUT marcar uma cotação como a escolhida
router.put("/compras/pedidos/:id/cotacoes/:idcotacao/escolher",
  verificarPermissao("Almoxarifado", "pesquisar"),
  exigirAprovadorCompras,
  bloquearCamisetasPorPedido,
  async (req, res) => {
    let client;
    try {
      client = await pool.connect();
      await client.query("BEGIN");

      const cotacao = await client.query(
        `SELECT c.idcotacao, c.idpedidoitem FROM almoxarifadocotacao c
           JOIN almoxarifadopedidoitem pi ON pi.idpedidoitem = c.idpedidoitem
           JOIN almoxarifadopedido p ON p.idpedido = pi.idpedido
          WHERE c.idcotacao = $1 AND p.idpedido = $2 AND p.idempresa = $3`,
        [req.params.idcotacao, req.params.id, req.idempresa]
      );
      if (!cotacao.rowCount) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Cotação não encontrada." });
      }

      await client.query(
        `UPDATE almoxarifadocotacao SET escolhida = false WHERE idpedidoitem = $1 AND escolhida`,
        [cotacao.rows[0].idpedidoitem]
      );
      await client.query(`UPDATE almoxarifadocotacao SET escolhida = true WHERE idcotacao = $1`, [req.params.idcotacao]);

      const statusPedido = await recalcularStatusPedido(client, req.params.id);
      await client.query("COMMIT");

      res.json({ message: "Cotação escolhida.", status_pedido: statusPedido });
    } catch (error) {
      if (client) await client.query("ROLLBACK");
      console.error("Erro ao escolher cotação:", error);
      res.status(500).json({ message: "Erro ao escolher cotação." });
    } finally {
      if (client) client.release();
    }
  }
);

// DELETE cotação
router.delete("/compras/pedidos/:id/cotacoes/:idcotacao",
  verificarPermissao("Almoxarifado", "pesquisar"),
  exigirAprovadorCompras,
  bloquearCamisetasPorPedido,
  async (req, res) => {
    try {
      const result = await pool.query(
        `DELETE FROM almoxarifadocotacao c
          USING almoxarifadopedidoitem pi, almoxarifadopedido p
          WHERE c.idcotacao = $1
            AND pi.idpedidoitem = c.idpedidoitem
            AND p.idpedido = pi.idpedido
            AND p.idpedido = $2 AND p.idempresa = $3`,
        [req.params.idcotacao, req.params.id, req.idempresa]
      );
      if (!result.rowCount) {
        return res.status(404).json({ message: "Cotação não encontrada." });
      }
      res.json({ message: "Cotação removida." });
    } catch (error) {
      console.error("Erro ao remover cotação:", error);
      res.status(500).json({ message: "Erro ao remover cotação." });
    }
  }
);

// PUT recebimento: só aqui a compra vira estoque. A quantidade é a CONFIRMADA na
// tela (pode ter chegado mais ou menos que o aprovado), item por item.
router.put("/compras/pedidos/:id/receber",
  verificarPermissao("Almoxarifado", "pesquisar"),
  exigirAprovadorCompras,
  bloquearCamisetasPorPedido,
  logMiddleware("Almoxarifado", { buscarDadosAnteriores: async () => ({ dadosanteriores: null, idregistroalterado: null }) }),
  async (req, res) => {
    const { itens } = req.body;
    if (!Array.isArray(itens) || !itens.length) {
      return res.status(400).json({ message: "Confirme pelo menos um item." });
    }

    let client;
    try {
      client = await pool.connect();
      await client.query("BEGIN");

      const pedidoResult = await client.query(
        `SELECT * FROM almoxarifadopedido
          WHERE idpedido = $1 AND idempresa = $2 AND status <> 'cancelado' FOR UPDATE`,
        [req.params.id, req.idempresa]
      );
      if (!pedidoResult.rowCount) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Pedido não encontrado." });
      }
      const pedido = pedidoResult.rows[0];
      const recebidos = [];

      for (const confirmado of itens) {
        const quantidade = Number(confirmado.quantidade);
        if (!Number.isInteger(quantidade) || quantidade < 0) {
          await client.query("ROLLBACK");
          return res.status(400).json({ message: "Quantidade recebida inválida." });
        }
        if (quantidade === 0) continue; // item que não chegou fica como está

        const itemResult = await client.query(
          `SELECT * FROM almoxarifadopedidoitem WHERE idpedidoitem = $1 AND idpedido = $2 FOR UPDATE`,
          [confirmado.idpedidoitem, req.params.id]
        );
        if (!itemResult.rowCount) {
          await client.query("ROLLBACK");
          return res.status(400).json({ message: "Item do pedido não encontrado." });
        }
        const item = itemResult.rows[0];
        if (item.status === "recusado") {
          await client.query("ROLLBACK");
          return res.status(400).json({ message: `"${item.descricao}" foi recusado na aprovação — não pode ser recebido.` });
        }
        if (item.status === "pendente") {
          await client.query("ROLLBACK");
          return res.status(400).json({ message: `"${item.descricao}" ainda não foi aprovado.` });
        }

        // Item avulso (não existia no cadastro) só vira item do almoxarifado agora.
        let iditem = item.iditem;
        if (!iditem) {
          const novoItem = await client.query(
            `INSERT INTO almoxarifadogeral (idempresa, local, descricao, unidade_medida, quantidade_atual, estoque_minimo, idusuario)
               VALUES ($1, $2, $3, $4, 0, 0, $5) RETURNING iditem`,
            [req.idempresa, pedido.local, item.descricao, item.unidade_medida, req.usuario?.idusuario || null]
          );
          iditem = novoItem.rows[0].iditem;
          await client.query(`UPDATE almoxarifadopedidoitem SET iditem = $1 WHERE idpedidoitem = $2`, [iditem, item.idpedidoitem]);
        }

        // Entrada no estoque — mesma tabela/mesmo formato da reposição manual.
        await client.query(
          `UPDATE almoxarifadogeral SET quantidade_atual = quantidade_atual + $1 WHERE iditem = $2`,
          [quantidade, iditem]
        );
        const movimentacao = await client.query(
          `INSERT INTO almoxarifadogeralhistorico (iditem, tipo, quantidade, motivo, idusuario)
             VALUES ($1, 'entrada', $2, $3, $4) RETURNING idmovimentacao`,
          [iditem, quantidade, `Compra recebida (pedido #${pedido.idpedido})`, req.usuario?.idusuario || null]
        );

        // Sem fornecedor/valor na confirmação, herda o que veio da cotação escolhida.
        const cotacao = await client.query(
          `SELECT idfornecedor, fornecedor_nome, valor_unitario FROM almoxarifadocotacao
            WHERE idpedidoitem = $1 AND escolhida LIMIT 1`,
          [item.idpedidoitem]
        );
        const escolhida = cotacao.rows[0] || {};
        const valorInformado =
          confirmado.valor_unitario !== undefined && confirmado.valor_unitario !== null && confirmado.valor_unitario !== "";
        const valorUnitario = valorInformado ? Number(confirmado.valor_unitario) : escolhida.valor_unitario ?? null;

        if (valorInformado && (!Number.isFinite(Number(valorUnitario)) || Number(valorUnitario) < 0)) {
          await client.query("ROLLBACK");
          return res.status(400).json({ message: `Valor unitário inválido em "${item.descricao}".` });
        }

        const compra = await client.query(
          `INSERT INTO almoxarifadocompra
             (idempresa, iditem, idpedidoitem, descricao, idfornecedor, fornecedor_nome, quantidade, valor_unitario, dt_compra, idmovimentacao, idusuario)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9::date, CURRENT_DATE), $10, $11) RETURNING *`,
          [
            req.idempresa,
            iditem,
            item.idpedidoitem,
            item.descricao,
            confirmado.idfornecedor || escolhida.idfornecedor || null,
            confirmado.fornecedor_nome
              ? String(confirmado.fornecedor_nome).trim().slice(0, 120)
              : escolhida.fornecedor_nome || null,
            quantidade,
            valorUnitario,
            confirmado.dt_compra || null,
            movimentacao.rows[0].idmovimentacao,
            req.usuario?.idusuario || null,
          ]
        );

        await client.query(
          `UPDATE almoxarifadopedidoitem
              SET quantidade_recebida = quantidade_recebida + $1, status = 'recebido'
            WHERE idpedidoitem = $2`,
          [quantidade, item.idpedidoitem]
        );

        recebidos.push(compra.rows[0]);
      }

      if (!recebidos.length) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Nenhuma quantidade foi confirmada." });
      }

      const statusPedido = await recalcularStatusPedido(client, req.params.id);
      await client.query("COMMIT");

      res.locals.acao = "recebeu compra do almoxarifado";
      res.locals.idregistroalterado = req.params.id;
      res.locals.idusuarioAlvo = null;
      res.locals.dadosnovos = { itens_recebidos: recebidos.length, status: statusPedido };

      res.json({ message: `${recebidos.length} item(ns) recebido(s) e lançado(s) no estoque.`, status_pedido: statusPedido });
    } catch (error) {
      if (client) await client.query("ROLLBACK");
      console.error("Erro ao receber compra:", error);
      res.status(500).json({ message: "Erro ao registrar o recebimento." });
    } finally {
      if (client) client.release();
    }
  }
);

// GET histórico de compras do item: quando foi, de quem, por quanto, quanto foi
// consumido até a compra seguinte e quantos dias aquele lote durou.
router.get("/compras/itens/:iditem/historico", verificarPermissao("Almoxarifado", "pesquisar"), async (req, res) => {
  try {
    const itemResult = await pool.query(
      `SELECT iditem, descricao, local, unidade_medida, quantidade_atual, estoque_minimo
         FROM almoxarifadogeral WHERE iditem = $1 AND idempresa = $2`,
      [req.params.iditem, req.idempresa]
    );
    if (!itemResult.rowCount) {
      return res.status(404).json({ message: "Item não encontrado." });
    }
    const item = itemResult.rows[0];

    if (item.local === "Camisetas" && !(await podeVerCamisetas(req.usuario?.idusuario, req.idempresa))) {
      return res.status(403).json({ message: "Você não tem permissão para acessar Camisetas." });
    }

    const result = await pool.query(
      `WITH compras AS (
         SELECT c.*,
                LEAD(c.dt_compra) OVER (ORDER BY c.dt_compra ASC, c.idcompra ASC) AS proxima_compra
           FROM almoxarifadocompra c
          WHERE c.iditem = $1 AND c.idempresa = $2
       )
       SELECT co.idcompra,
              co.dt_compra,
              co.quantidade,
              co.valor_unitario,
              (co.quantidade * COALESCE(co.valor_unitario, 0)) AS valor_total,
              COALESCE(f.nmfantasia, co.fornecedor_nome) AS fornecedor,
              pi.idpedido,
              u.nome AS nome_usuario,
              co.proxima_compra,
              COALESCE(co.proxima_compra, CURRENT_DATE) - co.dt_compra AS dias_periodo,
              (SELECT COALESCE(SUM(h.quantidade), 0)
                 FROM almoxarifadogeralhistorico h
                WHERE h.iditem = co.iditem
                  AND h.tipo = 'saida'
                  AND h.criado_em >= co.dt_compra
                  AND (co.proxima_compra IS NULL OR h.criado_em < co.proxima_compra)) AS consumo_periodo
         FROM compras co
         LEFT JOIN fornecedores f ON f.idfornecedor = co.idfornecedor
         LEFT JOIN almoxarifadopedidoitem pi ON pi.idpedidoitem = co.idpedidoitem
         LEFT JOIN usuarios u ON u.idusuario = co.idusuario
        ORDER BY co.dt_compra DESC, co.idcompra DESC`,
      [req.params.iditem, req.idempresa]
    );

    const compras = result.rows.map((compra) => {
      const dias = Number(compra.dias_periodo) || 0;
      const consumo = Number(compra.consumo_periodo) || 0;
      // Ritmo de consumo observado depois daquela compra — com ele estimamos
      // quantos dias a quantidade comprada durou (ou vai durar).
      const consumoDia = dias > 0 ? consumo / dias : 0;
      return {
        ...compra,
        consumo_periodo: consumo,
        dias_periodo: dias,
        duracao_estimada_dias: consumoDia > 0 ? Math.round(compra.quantidade / consumoDia) : null,
        // Só é duração fechada quando o lote seguinte já entrou.
        periodo_fechado: Boolean(compra.proxima_compra),
      };
    });

    res.json({ item, compras });
  } catch (error) {
    console.error("Erro ao buscar histórico de compras do item:", error);
    res.status(500).json({ message: "Erro ao buscar histórico de compras." });
  }
});

// GET comparativo de preço por fornecedor do item
router.get("/compras/itens/:iditem/precos", verificarPermissao("Almoxarifado", "pesquisar"), async (req, res) => {
  try {
    const itemResult = await pool.query(
      `SELECT local FROM almoxarifadogeral WHERE iditem = $1 AND idempresa = $2`,
      [req.params.iditem, req.idempresa]
    );
    if (!itemResult.rowCount) {
      return res.status(404).json({ message: "Item não encontrado." });
    }
    if (itemResult.rows[0].local === "Camisetas" && !(await podeVerCamisetas(req.usuario?.idusuario, req.idempresa))) {
      return res.status(403).json({ message: "Você não tem permissão para acessar Camisetas." });
    }

    const result = await pool.query(
      `SELECT COALESCE(f.nmfantasia, c.fornecedor_nome, 'Sem fornecedor') AS fornecedor,
              c.idfornecedor,
              COUNT(*) AS compras,
              MIN(c.valor_unitario) AS menor_valor,
              MAX(c.valor_unitario) AS maior_valor,
              ROUND(AVG(c.valor_unitario), 2) AS valor_medio,
              (array_agg(c.valor_unitario ORDER BY c.dt_compra DESC, c.idcompra DESC))[1] AS ultimo_valor,
              MAX(c.dt_compra) AS ultima_compra,
              SUM(c.quantidade) AS quantidade_total,
              SUM(c.quantidade * COALESCE(c.valor_unitario, 0)) AS total_gasto
         FROM almoxarifadocompra c
         LEFT JOIN fornecedores f ON f.idfornecedor = c.idfornecedor
        WHERE c.iditem = $1 AND c.idempresa = $2 AND c.valor_unitario IS NOT NULL
        GROUP BY 1, 2
        ORDER BY valor_medio ASC`,
      [req.params.iditem, req.idempresa]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Erro ao comparar preços do item:", error);
    res.status(500).json({ message: "Erro ao comparar preços por fornecedor." });
  }
});

// GET itens com histórico de compra (lista do comparativo de preços)
router.get("/compras/itens", verificarPermissao("Almoxarifado", "pesquisar"), async (req, res) => {
  try {
    const liberado = await podeVerCamisetas(req.usuario?.idusuario, req.idempresa);
    const result = await pool.query(
      `SELECT i.iditem, i.descricao, i.local, i.unidade_medida,
              COUNT(c.idcompra) AS compras,
              MAX(c.dt_compra) AS ultima_compra
         FROM almoxarifadogeral i
         LEFT JOIN almoxarifadocompra c ON c.iditem = i.iditem
        WHERE i.idempresa = $1 ${liberado ? "" : "AND i.local <> 'Camisetas'"}
        GROUP BY i.iditem
        ORDER BY COUNT(c.idcompra) DESC, i.descricao ASC`,
      [req.idempresa]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Erro ao listar itens com compras:", error);
    res.status(500).json({ message: "Erro ao listar itens." });
  }
});

// GET autocomplete de fornecedores da empresa (cotação/recebimento)
router.get("/compras/fornecedores/busca", verificarPermissao("Almoxarifado", "pesquisar"), async (req, res) => {
  const busca = (req.query.busca || "").trim();
  if (!busca) return res.json([]);

  try {
    const result = await pool.query(
      `SELECT f.idfornecedor, f.nmfantasia AS nome
         FROM fornecedores f
         INNER JOIN fornecedorempresas fe ON fe.idfornecedor = f.idfornecedor
        WHERE fe.idempresa = $1 AND f.nmfantasia ILIKE $2
        ORDER BY f.nmfantasia ASC LIMIT 20`,
      [req.idempresa, `%${busca}%`]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Erro ao buscar fornecedores (Compras):", error);
    res.status(500).json({ message: "Erro ao buscar fornecedores." });
  }
});

// GET autocomplete de itens do local (pra montar a lista de compra)
router.get("/compras/itens/busca", verificarPermissao("Almoxarifado", "pesquisar"), bloquearCamisetasSemFlag, async (req, res) => {
  const busca = (req.query.busca || "").trim();
  const { local } = req.query;
  if (!busca || !local || !LOCAIS.includes(local)) return res.json([]);

  try {
    const result = await pool.query(
      `SELECT iditem, descricao, unidade_medida, quantidade_atual, estoque_minimo
         FROM almoxarifadogeral
        WHERE idempresa = $1 AND local = $2 AND descricao ILIKE $3
        ORDER BY descricao ASC LIMIT 20`,
      [req.idempresa, local, `%${busca}%`]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Erro ao buscar itens (Compras):", error);
    res.status(500).json({ message: "Erro ao buscar itens." });
  }
});

module.exports = router;
