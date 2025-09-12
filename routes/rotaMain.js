const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB");
const { autenticarToken, contextoEmpresa } = require('../middlewares/authMiddlewares');

// Aplica autenticação/contexto em todas as rotas deste arquivo
router.use(autenticarToken());   // <-- precisa chamar aqui
router.use(contextoEmpresa);     // <-- sem parênteses

// GET /Main (resumo dos cards)
router.get('/', async (req, res) => {
  try {
    const idempresa = req.idempresa;

    const { rows: orcamentos } = await pool.query(
      'SELECT COUNT(*)::int AS total FROM orcamentoempresas WHERE idempresa = $1',
      [idempresa]
    );
    // const { rows: eventos } = await pool.query(
    //   'SELECT COUNT(*)::int AS total FROM eventos WHERE idempresa = $1',
    //   [idempresa]
    // );
    // const { rows: clientes } = await pool.query(
    //   'SELECT COUNT(*)::int AS total FROM clientes WHERE idempresa = $1',
    //   [idempresa]
    // );
    // const { rows: pedidos } = await pool.query(
    //   'SELECT COUNT(*)::int AS total FROM pedidos WHERE idempresa = $1',
    //   [idempresa]
    // );
    // const { rows: pedidosPendentes } = await pool.query(
    //   "SELECT COUNT(*)::int AS total FROM pedidos WHERE idempresa = $1 AND status = 'pendente'",
    //   [idempresa]
    // );

    res.json({
      orcamentos: orcamentos[0].total,
      // eventos: eventos[0].total,
      // clientes: clientes[0].total,
      // pedidos: pedidos[0].total,
      // pedidosPendentes: pedidosPendentes[0].total
    });
  } catch (err) {
    console.error('Erro ao buscar resumo:', err);
    res.status(500).json({ error: 'Erro ao buscar resumo' });
  }
});

module.exports = router;
