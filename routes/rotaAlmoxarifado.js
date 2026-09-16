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

// "Camisetas" é sensível (custo/estoque de brinde) — só quem tem uma das flags
// especiais vê ou mexe nesse local (ver docs/PERMISSOES.md, mesmo padrão de
// exigirFlag em permissaoMiddleware.js, mas aqui é condicional ao `local`).
const FLAGS_ESPECIAIS = ["supremo", "master", "financeiro", "devs"];

async function temFlagsEspeciais(idusuario, idempresa) {
  const condicao = FLAGS_ESPECIAIS.map((f) => `${f} = true`).join(" OR ");
  const { rows } = await pool.query(
    `SELECT 1 FROM permissoes WHERE idusuario = $1 AND idempresa = $2 AND (${condicao}) LIMIT 1`,
    [idusuario, idempresa]
  );
  return rows.length > 0;
}

// Middleware: exige uma das flags especiais sempre, sem depender do `local`
// — usado na edição do item (nome, local, unidade, mínimo), que é sensível
// independente de o item estar ou não em Camisetas.
async function exigirFlagsEspeciais(req, res, next) {
  try {
    const liberado = await temFlagsEspeciais(req.usuario?.idusuario, req.idempresa);
    if (!liberado) {
      return res.status(403).json({ message: "Você não tem permissão para editar itens do almoxarifado." });
    }
    next();
  } catch (error) {
    console.error("Erro ao verificar flags especiais:", error);
    res.status(500).json({ message: "Erro ao verificar permissões." });
  }
}

// Middleware: bloqueia quando o `local` (body ou query) for "Camisetas" e o
// usuário não tiver nenhuma das flags especiais.
async function bloquearCamisetasSemFlag(req, res, next) {
  const local = req.body?.local || req.query?.local;
  if (local !== "Camisetas") return next();

  try {
    const liberado = await temFlagsEspeciais(req.usuario?.idusuario, req.idempresa);
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

    const liberado = await temFlagsEspeciais(req.usuario?.idusuario, req.idempresa);
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
    const liberado = await temFlagsEspeciais(req.usuario?.idusuario, req.idempresa);
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
// às mesmas flags especiais de Camisetas — não é sobre local aqui, é sobre a
// ação de editar em si, então roda sempre, pra qualquer item.
router.put("/:id",
  verificarPermissao("Almoxarifado", "alterar"),
  exigirFlagsEspeciais,
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

module.exports = router;
