const express = require('express');
const router = express.Router();
const db = require('../db'); // ajuste o caminho conforme seu projeto
const { autenticarToken, contextoEmpresa } = require('../middlewares/authMiddlewares');

// Aplica autenticação em todas as rotas

//router.use(autenticarToken);
router.use(contextoEmpresa);

router.get('/', async (req, res) => {
   console.log("✅ ROTA /modulos ACESSADA");
  try {
    const { rows } = await db.query('SELECT modulo FROM modulos ORDER BY modulo');
    res.json(rows);
    console.log("Modulos",rows )
  } catch (err) {
    console.error('Erro ao buscar módulos:', err);
    res.status(500).json({ erro: 'Erro ao buscar módulos' });
  }
});

module.exports = router;
