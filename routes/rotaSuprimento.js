const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB");
const { autenticarToken } = require('../middlewares/authMiddlewares');
const { verificarPermissao } = require('../middlewares/permissaoMiddleware');

// Aplica autenticação em todas as rotas
router.use(autenticarToken);

// GET todas ou por descrição
router.get("/", autenticarToken, verificarPermissao('Suprimentos', 'pesquisar'), async (req, res) => {
  const { descSup } = req.query;

  try {
    if (descSup) {
      const result = await pool.query(
        "SELECT * FROM suprimentos WHERE descSup ILIKE $1 LIMIT 1",
        [descSup]
      );
      return result.rows.length
        ? res.json(result.rows[0])
        : res.status(404).json({ message: "Suprimento não encontrada" });
    } else {
      const result = await pool.query("SELECT * FROM suprimentos ORDER BY descSup ASC");
      return result.rows.length
        ? res.json(result.rows)
        : res.status(404).json({ message: "Nenhuma suprimento encontrado" });
    }
  } catch (error) {
    console.error("Erro ao buscar suprimentos:", error);
    res.status(500).json({ message: "Erro ao buscar suprimentos" });
  }
});

// PUT atualizar
router.put("/:id", autenticarToken, verificarPermissao('Suprimentos', 'alterar'), async (req, res) => {
  const id = req.params.id;
  const { descSup, custo, venda } = req.body;

  try {
    const result = await pool.query(
      `UPDATE suprimentos SET descSup = $1, ctosup = $2, vdasup = $3 WHERE idSup = $4 RETURNING *`,
      [descSup, custo, venda, id]
    );

    return result.rowCount
      ? res.json({ message: "Suprimento atualizado com sucesso!", suprimento: result.rows[0] })
      : res.status(404).json({ message: "Suprimento não encontrado para atualizar." });
  } catch (error) {
    console.error("Erro ao atualizar suprimento:", error);
    res.status(500).json({ message: "Erro ao atualizar suprimento." });
  }
});

// POST criar nova função
router.post("/", autenticarToken, verificarPermissao('Suprimentos', 'cadastrar'), async (req, res) => {
  const { descSup, custo, venda } = req.body;

  try {
    const result = await pool.query(
      "INSERT INTO suprimentos (descSup, ctoSup, vdaSup) VALUES ($1, $2, $3) RETURNING *",
      [descSup, custo, venda]
    );
    res.json({ mensagem: "Suprimento salvo com sucesso!", suprimento: result.rows[0] });
  } catch (error) {
    console.error("Erro ao salvar suprimento:", error);
    res.status(500).json({ erro: "Erro ao salvar suprimento" });
  }
});

module.exports = router;