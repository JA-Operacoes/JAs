const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB");
const { autenticarToken, contextoEmpresa } = require('../middlewares/authMiddlewares');
const { verificarPermissao } = require('../middlewares/permissaoMiddleware');

// Aplica autenticação em todas as rotas
router.use(autenticarToken());
router.use(contextoEmpresa);

// GET todas ou por descrição
router.get("/", verificarPermissao('FuncCargo', 'pesquisar'), async (req, res) => {
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
        : res.status(404).json({ message: "FuncCargo não encontrada" });
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
router.put("/:id", verificarPermissao('FuncCargo', 'alterar'), async (req, res) => {
  const id = req.params.id;
  const { descFuncao, custo, venda, ajcfuncao, obsfuncao } = req.body;

  try {
    const result = await pool.query(
      `UPDATE FuncCargo SET descFuncao = $1, ctofuncao = $2, vdafuncao = $3, ajcfuncao = $4, obsfuncao = $5 WHERE idFuncao = $6 RETURNING *`,
      [descFuncao, custo, venda, ajcfuncao, obsfuncao, id]
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
router.post("/", verificarPermissao('FuncCargo', 'cadastrar'), async (req, res) => {
  const { descFuncao, custo, venda, ajcfuncao, obsfuncao } = req.body;
 
  
  try {
    const result = await pool.query(
      "INSERT INTO funcao (descFuncao, ctofuncao, vdafuncao, ajcfuncao, obsfuncao) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [descFuncao, custo, venda, ajcfuncao, obsfuncao]
    );
    res.json({ mensagem: "Função salva com sucesso!", funcao: result.rows[0] });
  } catch (error) {
    console.error("Erro ao salvar função:", error);
    res.status(500).json({ erro: "Erro ao salvar função" });
  }
});

module.exports = router;