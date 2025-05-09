const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB");

// GET todas ou por descrição
router.get("/", async (req, res) => {
  const { descEquip } = req.query;

  try {
    if (descEquip) {
      const result = await pool.query(
        "SELECT * FROM equipamentos WHERE descEquip ILIKE $1 LIMIT 1",
        [descEquip]
      );
      return result.rows.length
        ? res.json(result.rows[0])
        : res.status(404).json({ message: "Equipamento não encontrada" });
    } else {
      const result = await pool.query("SELECT * FROM equipamentos ORDER BY descEquip ASC");
      return result.rows.length
        ? res.json(result.rows)
        : res.status(404).json({ message: "Nenhuma equipamento encontrada" });
    }
  } catch (error) {
    console.error("Erro ao buscar equipamento:", error);
    res.status(500).json({ message: "Erro ao buscar equipamento" });
  }
});

// PUT atualizar
router.put("/:id", async (req, res) => {
  const id = req.params.id;
  const { descEquip, custo, venda } = req.body;

  try {
    const result = await pool.query(
      `UPDATE equipamentos SET descEquip = $1, ctoEquip = $2, vdaEquip = $3 WHERE idequip = $4 RETURNING *`,
      [descEquip, custo, venda, id]
    );

    return result.rowCount
      ? res.json({ message: "Equipamento atualizado com sucesso!", equipamentos: result.rows[0] })
      : res.status(404).json({ message: "Equipamento não encontrado para atualizar." });
  } catch (error) {
    console.error("Erro ao atualizar equipamento:", error);
    res.status(500).json({ message: "Erro ao atualizar equipamentos." });
  }
});

// POST criar nova equipamentos
router.post("/", async (req, res) => {
  const { descEquip, custo, venda } = req.body;

  console.log("Dados recebidos:", req.body);
  try {
    const result = await pool.query(
      "INSERT INTO equipamentos (descEquip, ctoEquip, vdaEquip) VALUES ($1, $2, $3) RETURNING *",
      [descEquip, custo, venda]
    );
    res.json({ mensagem: "Equipamento salvo com sucesso!", equipamentos: result.rows[0] });
  } catch (error) {
    console.error("Erro ao salvar equipamentos:", error);
    res.status(500).json({ erro: "Erro ao salvar equipamentos" });
  }
});

module.exports = router;