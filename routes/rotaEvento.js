const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB");
const { autenticarToken } = require('../middlewares/authMiddlewares');
const { verificarPermissao } = require('../middlewares/permissaoMiddleware');
// Aplica autenticação em todas as rotas
router.use(autenticarToken);

// GET todas ou por descrição
router.get("/", autenticarToken, verificarPermissao('Eventos', 'pesquisar'), async (req, res) => {
  const { nmEvento } = req.query;
  console.log("nmEvento NA ROTA", nmEvento);
  try {
    if (nmEvento) {
      const result = await pool.query(
        "SELECT * FROM eventos WHERE nmEvento ILIKE $1 LIMIT 1",
        [nmEvento]
      );
      return result.rows.length
        ? res.json(result.rows[0])
        : res.status(404).json({ message: "Evento não encontrada" });
    } else {
      const result = await pool.query("SELECT * FROM eventos ORDER BY nmevento ASC");
      return result.rows.length
        ? res.json(result.rows)
        : res.status(404).json({ message: "Nenhuma evento encontrada" });
    }
  } catch (error) {
    console.error("Erro ao buscar evento:", error);
    res.status(500).json({ message: "Erro ao buscar evento" });
  }
});

// PUT atualizar
router.put("/:id", autenticarToken, verificarPermissao('Eventos', 'atualizar'), async (req, res) => {
  const id = req.params.id;
  const { nmEvento } = req.body;

  try {
    const result = await pool.query(
      `UPDATE eventos SET nmEvento = $1  WHERE idevento = $2 RETURNING *`,
      [nmEvento, id]
    );

    return result.rowCount
      ? res.json({ message: "Evento atualizado com sucesso!", eventos: result.rows[0] })
      : res.status(404).json({ message: "Função não encontrada para atualizar." });
  } catch (error) {
    console.error("Erro ao atualizar evento:", error);
    res.status(500).json({ message: "Erro ao atualizar eventos." });
  }
});

// POST criar nova eventos
router.post("/", autenticarToken, verificarPermissao('Eventos', 'cadastrar'), async (req, res) => {
  const { nmEvento } = req.body;

  try {
    const result = await pool.query(
      "INSERT INTO eventos (nmEvento) VALUES ($1) RETURNING *",
      [nmEvento]
    );
    res.json({ mensagem: "Evento salvo com sucesso!", eventos: result.rows[0] });
  } catch (error) {
    console.error("Erro ao salvar eventos:", error);
    res.status(500).json({ erro: "Erro ao salvar eventos" });
  }
});

module.exports = router;