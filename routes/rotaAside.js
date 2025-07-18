const express = require('express');
const router = express.Router();
const pool = require('../db'); // ajuste o caminho conforme seu projeto
const { autenticarToken, contextoEmpresa } = require('../middlewares/authMiddlewares');
const { verificarPermissao } = require('../middlewares/permissaoMiddleware');
const logMiddleware = require('../middlewares/logMiddleware');

router.use(autenticarToken());
router.use(contextoEmpresa);

router.get('/eventos', async (req, res) => {
  const { clienteId } = req.query;

  console.log("idcliente", clienteId);
  
  if (!clienteId) {
    return res.status(400).json({ erro: "clienteId é obrigatório" });
  }

  try {
    const query = `
      SELECT DISTINCT e.idevento, e.nmevento
      FROM orcamentos o
      JOIN eventos e ON e.idevento = o.idevento
      WHERE o.idcliente = $1 AND o.status = 'A'
    `;
    const { rows } = await pool.query(query, [clienteId]);

    console.log("evento:", rows);

    res.json(rows);
  } catch (err) {
    console.error('Erro ao buscar eventos do cliente:', err);
    res.status(500).json({ erro: 'Erro interno ao buscar eventos' });
  }
});

router.get('/orcamento', async (req, res) => {
  const { clienteId, eventoId } = req.query;

  console.log("🔎 Buscando orçamentos de cliente:", clienteId, "e evento:", eventoId);

  if (!clienteId || !eventoId) {
    return res.status(400).json({ erro: "clienteId e eventoId são obrigatórios" });
  }

  try {
    const query = `
      SELECT idorcamento, nrorcamento, status
      FROM orcamentos
      WHERE idcliente = $1 AND idevento = $2 AND status = 'A'
      ORDER BY datacriacao DESC
    `;
    const { rows } = await pool.query(query, [clienteId, eventoId]);

    console.log("🧾 Orçamentos encontrados:", rows);

    res.json(rows);
  } catch (err) {
    console.error('❌ Erro ao buscar orçamentos:', err);
    res.status(500).json({ erro: 'Erro interno ao buscar orçamentos' });
  }
});

module.exports = router;
