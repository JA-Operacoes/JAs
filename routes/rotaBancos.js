const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB");
const { autenticarToken } = require("../middlewares/authMiddlewares");

// Buscar todos os bancos
router.get("/", autenticarToken(), async (req, res) => {
  try {
    const { nmBanco } = req.query;
    if (nmBanco) {
      const result = await pool.query(
        "SELECT * FROM bancos WHERE nmbanco ILIKE $1",
        [`%${nmBanco}%`]
      );
      return result.rows.length
        ? res.json(result.rows[0])
        : res.status(404).json({ message: "Banco não encontrado" });
    }

    const result = await pool.query("SELECT * FROM bancos ORDER BY nmbanco ASC");
    res.json(result.rows);
  } catch (error) {
    console.error("Erro ao buscar bancos:", error);
    res.status(500).json({ error: "Erro ao buscar bancos" });
  }
});

// Criar novo banco
router.post("/", autenticarToken(), async (req, res) => {
  const { codBanco, nmBanco } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO bancos (codbanco, nmbanco) VALUES ($1, $2) RETURNING *",
      [codBanco, nmBanco]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Erro ao inserir banco:", error);
    res.status(500).json({ error: "Erro ao cadastrar banco" });
  }
});

// Atualizar banco existente
router.put("/:id", autenticarToken(), async (req, res) => {
  const { codBanco, nmBanco } = req.body;
  const id = req.params.id;
  try {
    const result = await pool.query(
      "UPDATE bancos SET codbanco = $1, nmbanco = $2 WHERE idbanco = $3 RETURNING *",
      [codBanco, nmBanco, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Erro ao atualizar banco:", error);
    res.status(500).json({ error: "Erro ao atualizar banco" });
  }
});

module.exports = router;
