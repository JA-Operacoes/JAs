const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB");
const { autenticarToken } = require('../middlewares/authMiddlewares');
const { verificarPermissao } = require('../middlewares/permissaoMiddleware');

// Aplica autenticação em todas as rotas
router.use(autenticarToken);

// GET todas ou por descrição
router.get("/", autenticarToken, verificarPermissao('Localmontagem', 'pesquisar'), async (req, res) => {
  const { descmontagem } = req.query;
  console.log("descmontagem na rota", descmontagem);

  try {
    if (descmontagem) {
      const result = await pool.query(
        "SELECT * FROM localmontagem WHERE descmontagem ILIKE $1 LIMIT 1",
        [descmontagem]
      );
      return result.rows.length
        ? res.json(result.rows[0])
        : res.status(404).json({ message: "Local Montagem não encontrada" });
    } else {
      const result = await pool.query("SELECT * FROM localmontagem ORDER BY descmontagem ASC");
      return result.rows.length
        ? res.json(result.rows)
        : res.status(404).json({ message: "Nenhuma local montagem encontrada" });
    }
  } catch (error) {
    console.error("Erro ao buscar local montagem:", error);
    res.status(500).json({ message: "Erro ao buscar local montagem" });
  }
});

// PUT atualizar
router.put("/:id", autenticarToken, verificarPermissao('Localmontagem', 'alterar'),  async (req, res) => {
  const id = req.params.id;
  const { descMontagem, cidadeMontagem, ufMontagem } = req.body;
  console.log("descmontagem na rota", descMontagem);
  try {
    const result = await pool.query(
      `UPDATE localmontagem SET descmontagem = $1, cidademontagem = $2, ufmontagem = $3 WHERE idmontagem = $4 RETURNING *`,
      [descMontagem, cidadeMontagem, ufMontagem, id]
    );

    return result.rowCount
      ? res.json({ message: "Local Montagem atualizada com sucesso!", localmontagem: result.rows[0] })
      : res.status(404).json({ message: "Local Montagem não encontrada para atualizar." });
  } catch (error) {
    console.error("Erro ao atualizar local montagem:", error);
    res.status(500).json({ message: "Erro ao atualizar local montagem." });
  }
});

// POST criar nova local montagem
router.post("/", autenticarToken, verificarPermissao('Localmontagem', 'cadastrar'), async (req, res) => {
  const { descMontagem, cidadeMontagem, ufMontagem } = req.body;

  try {
    const result = await pool.query(
      "INSERT INTO localmontagem (descmontagem, cidademontagem, ufmontagem) VALUES ($1, $2, $3) RETURNING *",
      [descMontagem, cidadeMontagem, ufMontagem]
    );
    res.json({ mensagem: "Local Montagem salva com sucesso!", localmontagem: result.rows[0] });
  } catch (error) {
    console.error("Erro ao salvar local montagem:", error);
    res.status(500).json({ erro: "Erro ao salvar local montagem" });
  }
});

module.exports = router;