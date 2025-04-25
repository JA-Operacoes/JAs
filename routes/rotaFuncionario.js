const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB");

// GET todas ou por descrição
router.get("/", async (req, res) => {
  const { descFuncao } = req.query;

  try {
    if (descFuncao) {
      const result = await pool.query(
        "SELECT * FROM funcionario WHERE nmFuncionario ILIKE $1 LIMIT 1",
        [descFuncao]
      );
      return result.rows.length
        ? res.json(result.rows[0])
        : res.status(404).json({ message: "Funcionario não encontrada" });
    } else {
      const result = await pool.query("SELECT * FROM funcionario ORDER BY nmFuncionario ASC");
      return result.rows.length
        ? res.json(result.rows)
        : res.status(404).json({ message: "Nenhuma função encontrada" });
    }
  } catch (error) {
    console.error("Erro ao buscar funcionario:", error);
    res.status(500).json({ message: "Erro ao buscar funcionario" });
  }
});

// PUT atualizar
router.put("/:id", async (req, res) => {
  const id = req.params.id;
  const { descFuncao, vlrCusto, vlrVenda } = req.body;

  try {
    const result = await pool.query(
      `UPDATE Funcionario SET nmFuncionario = $1, apelido = $2, imgFuncionario = $3 WHERE idFuncionario = $4 RETURNING *`,
      [descFuncao, vlrCusto, vlrVenda, id]
    );

    return result.rowCount
      ? res.json({ message: "Funcionario atualizado com sucesso!", funcao: result.rows[0] })
      : res.status(404).json({ message: "Funcionario não encontrado para atualizar." });
  } catch (error) {
    console.error("Erro ao atualizar funcionario:", error);
    res.status(500).json({ message: "Erro ao atualizar funcionario." });
  }
});

// POST criar nova função
router.post("/", async (req, res) => {
  const { descFuncao, vlrCusto, vlrVenda } = req.body;

  try {
    const result = await pool.query(
      "INSERT INTO funcionario (nmFuncionario, apelido, imgFuncionario) VALUES ($1, $2, $3) RETURNING *",
      [descFuncao, vlrCusto, vlrVenda]
    );
    res.json({ mensagem: "Funcionario salva com sucesso!", funcao: result.rows[0] });
  } catch (error) {
    console.error("Erro ao salvar funcionario:", error);
    res.status(500).json({ erro: "Erro ao salvar funcionario" });
  }
});

module.exports = router;