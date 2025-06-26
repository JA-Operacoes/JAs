const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB");
const { autenticarToken, contextoEmpresa } = require("../middlewares/authMiddlewares");
const { verificarPermissao } = require("../middlewares/permissaoMiddleware");
const logMiddleware = require("../middlewares/logMiddleware");

// Middleware global: aplica a todos
router.use(autenticarToken());
router.use(contextoEmpresa);

// GET: Buscar todos os bancos ou por nome (nmBanco)
router.get("/", verificarPermissao("bancos", "pesquisar"), async (req, res) => {
  try {
    const { nmBanco } = req.query;
    console.log("📥 nmBanco recebido:", nmBanco);

    if (nmBanco) {
      const result = await pool.query(
        `SELECT idbanco, codbanco, nmbanco
         FROM bancos
         WHERE nmbanco ILIKE $1
         ORDER BY nmbanco ASC
         LIMIT 1`,
        [`%${nmBanco}%`]
      );

      if (result.rows.length > 0) {
        return res.json(result.rows[0]);
      } else {
        return res.status(404).json({ message: "Banco não encontrado" });
      }
    }

    const result = await pool.query(
      `SELECT idbanco, codbanco, nmbanco
       FROM bancos
       ORDER BY nmbanco ASC`
    );

    return res.json(result.rows);
  } catch (error) {
    console.error("❌ Erro ao buscar bancos:", error);
    return res.status(500).json({ error: error.message || "Erro ao buscar bancos" });
  }
});


// POST: Criar novo banco
router.post("/", verificarPermissao("bancos", "cadastrar"), async (req, res) => {
  console.log("📦 Corpo recebido:", req.body); // <-- log importante

  const { codBanco, nmBanco } = req.body;
  console.log(" entrou no codBanco", codBanco)

  try {
    const result = await pool.query(
      "INSERT INTO bancos (codbanco, nmbanco) VALUES ($1, $2) RETURNING *",
      [codBanco, nmBanco]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("❌ Erro ao inserir banco:", error);
    res.status(500).json({ error: "Erro ao cadastrar banco" });
  }
});

// PUT: Atualizar banco existente
router.put("/:id", verificarPermissao("Bancos", "alterar"), 
 logMiddleware('Bancos', {
        buscarDadosAnteriores: async (req) => {
            return { dadosanteriores: null, idregistroalterado: null };
        }
  }),
async (req, res) => {
  const { codBanco, nmBanco } = req.body;
  const id = req.params.id;

  try {
    const result = await pool.query(
      "UPDATE bancos SET codbanco = $1, nmbanco = $2 WHERE idbanco = $3 RETURNING *",
      [codBanco, nmBanco, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Banco não encontrado para atualizar" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Erro ao atualizar banco:", error);
    res.status(500).json({ error: "Erro ao atualizar banco" });
  }
});

module.exports = router;
