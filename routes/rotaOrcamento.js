const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB");

// GET todas ou por descrição
router.get("/", async (req, res) => {
  const { idOrcamento } = req.query;

  try {
    if (idOrcamento) {
      const result = await pool.query(
        "SELECT * FROM orcamentos WHERE idOrcamento ILIKE $1 LIMIT 1",
        [idOrcamento]
      );
      return result.rows.length
        ? res.json(result.rows[0])
        : res.status(404).json({ message: "Orçamento não encontrada" });
    } else {
      const result = await pool.query("SELECT * FROM orcamento");
      return result.rows.length
        ? res.json(result.rows)
        : res.status(404).json({ message: "Nenhuma orçamento encontrada" });
    }
  } catch (error) {
    console.error("Erro ao buscar orçamento:", error);
    res.status(500).json({ message: "Erro ao buscar orçamento" });
  }
});

// PUT atualizar
router.put("/:id", async (req, res) => {
  const id = req.params.id;
  const { descFuncao, vlrCusto, vlrVenda } = req.body;

  try {
    const result = await pool.query(
      `UPDATE Orcamentos SET descFuncao = $1, vlrCusto = $2, vlrVenda = $3 WHERE idFuncao = $4 RETURNING *`,
      [descFuncao, vlrCusto, vlrVenda, id]
    );

    return result.rowCount
      ? res.json({ message: "Orçamento atualizado com sucesso!", funcao: result.rows[0] })
      : res.status(404).json({ message: "Orçamento não encontrado para atualizar." });
  } catch (error) {
    console.error("Erro ao atualizar orçamento:", error);
    res.status(500).json({ message: "Erro ao atualizar orçamento." });
  }
});

// POST criar nova função
router.post("/", async (req, res) => {
  const { descFuncao, vlrCusto, vlrVenda } = req.body;

  try {
    const result = await pool.query(
      "INSERT INTO Orcamentos (descFuncao, vlrCusto, vlrVenda) VALUES ($1, $2, $3) RETURNING *",
      [descFuncao, vlrCusto, vlrVenda]
    );
    res.json({ mensagem: "Função salva com sucesso!", funcao: result.rows[0] });
  } catch (error) {
    console.error("Erro ao salvar função:", error);
    res.status(500).json({ erro: "Erro ao salvar função" });
  }
});

module.exports = router;