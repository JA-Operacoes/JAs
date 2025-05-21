const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB");
const { autenticarToken } = require('../middlewares/authMiddlewares');
const { verificarPermissao } = require('../middlewares/permissaoMiddleware');

// Aplica autenticação em todas as rotas
router.use(autenticarToken);

// GET todas ou por descrição
router.get("/", autenticarToken, verificarPermissao('Profissional', 'pesquisar'), async (req, res) => {
  const { descFuncao } = req.query;

  try {
    if (descFuncao) {
      const result = await pool.query(
        "SELECT * FROM orcamento WHERE descFuncao ILIKE $1 LIMIT 1",
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
router.put("/:id", autenticarToken, verificarPermissao('Profissional', 'alterar'), async (req, res) => {
  const id = req.params.id;
  const { descFuncao, vlrCusto, vlrVenda } = req.body;

  try {
    const result = await pool.query(
      `UPDATE Funcao SET descFuncao = $1, vlrCusto = $2, vlrVenda = $3 WHERE idFuncao = $4 RETURNING *`,
      [descFuncao, vlrCusto, vlrVenda, id]
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
router.post("/", autenticarToken, verificarPermissao('Profissional', 'cadastrar'), async (req, res) => {
  const { descFuncao, vlrCusto, vlrVenda } = req.body;

  try {
    const result = await pool.query(
      "INSERT INTO funcao (descFuncao, vlrCusto, vlrVenda) VALUES ($1, $2, $3) RETURNING *",
      [descFuncao, vlrCusto, vlrVenda]
    );
    res.json({ mensagem: "Função salva com sucesso!", funcao: result.rows[0] });
  } catch (error) {
    console.error("Erro ao salvar função:", error);
    res.status(500).json({ erro: "Erro ao salvar função" });
  }
});

module.exports = router;