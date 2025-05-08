const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB");

// GET todas ou por descrição
router.get("/", async (req, res) => {
  const { descFuncao } = req.query;
  console.log("descFuncao na ROTAFUNCAO", descFuncao);
  try {
    if (descFuncao) {
      const result = await pool.query(
        "SELECT * FROM funcao WHERE descFuncao ILIKE $1 LIMIT 1",
        [descFuncao]
      );
      return result.rows.length
        ? res.json(result.rows[0])
        : res.status(404).json({ message: "Função não encontrada" });
    } else {
      const result = await pool.query("SELECT * FROM funcao ORDER BY descFuncao ASC");
      return result.rows.length
        ? res.json(result.rows)
        : res.status(404).json({ message: "Nenhuma função encontrada" });
    }
  } catch (error) {
    console.error("Erro ao buscar função:", error);
    res.status(500).json({ message: "Erro ao buscar função" });
  }
});

// PUT atualizar
router.put("/:id", async (req, res) => {
  const id = req.params.id;
  const { descFuncao, custo, venda } = req.body;

  // const custo = parseFloat(String(vlrCusto).replace(",", "."));
  // const venda = parseFloat(String(vlrVenda).replace(",", "."));

  try {
    const result = await pool.query(
      `UPDATE Funcao SET descFuncao = $1, ctofuncao = $2, vdafuncao = $3 WHERE idFuncao = $4 RETURNING *`,
      [descFuncao, custo, venda, id]
    );

    return result.rowCount
      ? res.json({ message: "Função atualizada com sucesso!", funcao: result.rows[0] })
      : res.status(404).json({ message: "Função não encontrada para atualizar." });
  } catch (error) {
    console.error("Erro ao atualizar função:", error);
    res.status(500).json({ message: "Erro ao atualizar função." });
  }
});

// POST criar nova função
router.post("/", async (req, res) => {
  const { descFuncao, custo, venda } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO funcao (descFuncao, ctofuncao, vdafuncao) VALUES ($1, $2, $3) RETURNING *",
      [descFuncao, custo, venda]
    );
    res.json({ mensagem: "Função salva com sucesso!", funcao: result.rows[0] });
  } catch (error) {
    console.error("Erro ao salvar função:", error);
    res.status(500).json({ erro: "Erro ao salvar função" });
  }
});

module.exports = router;