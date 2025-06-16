const express = require('express');
const router = express.Router();
const db = require('../db'); // ajuste o caminho conforme seu projeto
const { autenticarToken, contextoEmpresa } = require('../middlewares/authMiddlewares');
const { verificarPermissao } = require('../middlewares/permissaoMiddleware');
// Aplica autenticação em todas as rotas

router.use(autenticarToken());
router.use(contextoEmpresa);

router.get('/', verificarPermissao('Usuarios', 'pesquisar'), async (req, res) => {
   console.log("✅ ROTA /modulos ACESSADA");
   const idempresa = req.idempresa;
  try {
    const { rows } = await db.query(`
      SELECT m.modulo 
      FROM modulos m
      INNER JOIN moduloempresas me ON m.idmodulo = me.idmodulo
      WHERE me.idempresa = $1
      ORDER BY modulo`, [idempresa]);

    res.json(rows);
    console.log("Modulos",rows )
  } catch (err) {
    console.error('Erro ao buscar módulos:', err);
    res.status(500).json({ erro: 'Erro ao buscar módulos' });
  }
});

module.exports = router;
