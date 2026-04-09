const express = require('express');
const router = express.Router();
const db = require('../db'); // ajuste o caminho conforme seu projeto
const { autenticarToken, contextoEmpresa } = require('../middlewares/authMiddlewares');
const { verificarPermissao } = require('../middlewares/permissaoMiddleware');
const logMiddleware = require('../middlewares/logMiddleware');


// router.get('/empresasTema/:idempresa', async (req, res) => {
//   const { idempresa } = req.params;
//   console.log(`🔍 Buscando empresa por ID na Rota Aside: ${idempresa}`);

//   try {
//     const result = await db.query(
//       `SELECT * FROM empresas WHERE idempresa = $1`,
//       [idempresa]
//     );

//     if (result.rows.length === 0) {
//       return res.status(404).json({ message: "Empresa não encontrada" });
//     }

//     res.json(result.rows[0]);
//   } catch (error) {
//     console.error("❌ Erro ao buscar empresa por ID:", error);
//     res.status(500).json({ message: "Erro ao buscar empresa" });
//   }
// });

router.use(autenticarToken());
router.use(contextoEmpresa);

router.get('/empresasTema/:idempresa', async (req, res) => {
  const { idempresa } = req.params;
  console.log(`🔍 Buscando empresa por ID na Rota Aside: ${idempresa}`);

  try {
    const result = await db.query(
      `SELECT * FROM empresas WHERE idempresa = $1`,
      [idempresa]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Empresa não encontrada" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("❌ Erro ao buscar empresa por ID:", error);
    res.status(500).json({ message: "Erro ao buscar empresa" });
  }
});

router.get('/eventos', async (req,res)=>{
    const idempresa = req.idempresa;
    try {
        const result = await db.query(`
            SELECT DISTINCT e.idevento, e.nmevento
            FROM eventos e
            INNER JOIN eventoempresas ee ON e.idevento = ee.idevento
            WHERE ee.idempresa = $1
            ORDER BY e.nmevento
        `,[idempresa]);
        res.json(result.rows);
    } catch(err){ res.status(500).json({erro:"Erro ao buscar eventos"}); }
});

router.get('/clientes', async (req,res)=>{
    const { eventoId } = req.query;
    if(!eventoId) return res.status(400).json({erro:"eventoId obrigatório"});
    try {
        const result = await db.query(`
            SELECT DISTINCT c.idcliente, c.nmfantasia
            FROM clientes c
            INNER JOIN orcamentos o ON o.idcliente = c.idcliente
            WHERE o.idevento = $1
            ORDER BY c.nmfantasia
        `,[eventoId]);
        res.json(result.rows);
    } catch(err){ res.status(500).json({erro:"Erro ao buscar clientes do evento"});}
});

router.get('/orcamento', async (req,res)=>{
    const { eventoId, clienteId } = req.query;
    if(!eventoId || !clienteId) return res.status(400).json({erro:"eventoId e clienteId obrigatórios"});
    try {
        const result = await db.query(`
            SELECT idorcamento, nrorcamento, status, nomenclatura, edicao
            FROM orcamentos
            WHERE idevento = $1 AND idcliente = $2
            ORDER BY edicao DESC, datacriacao DESC
        `,[eventoId, clienteId]);
        res.json(result.rows);
    } catch(err){ res.status(500).json({erro:"Erro ao buscar orçamentos"});}
});


router.get('/empresas', async (req, res) => {
  console.log('✅ [GET /empresas] Rota Empresa do Aside acessada com sucesso');
  const { nmFantasia } = req.query;  
  
  try {
    if (nmFantasia) {
      console.log("🔍 Buscando empresa por nmFantasia:", nmFantasia);
      const result = await db.query(
        `SELECT * 
        FROM empresas        
        WHERE nmfantasia ILIKE $1
        ORDER BY nmfantasia ASC LIMIT 1`,
        [`%${nmFantasia}%`]
      );
      console.log("✅ Consulta por nmFantasia retornou:", result.rows.length, "linhas.");
      return result.rows.length
        ? res.json(result.rows[0])
        : res.status(404).json({ message: "Empresa não encontrada" });
    } else {
      
      console.log("🔍 Buscando todas as empresas:");
      const result = await db.query(
        `SELECT * 
        FROM empresas        
        ORDER BY nmfantasia`
        );
      console.log("✅ Consulta de todos as empresas retornou:", result.rows.length, "linhas.");
      return result.rows.length
        ? res.json(result.rows)
        : res.status(404).json({ message: "Nenhuma Empresa encontrada" });
    }
  } catch (error) {
    console.error("❌ Erro ao buscar empresas:", error);
    res.status(500).json({ message: "Erro ao buscar nome fantasia" });
  }
});

// router.get('/empresas/:idempresa', async (req, res) => {
//   const { idempresa } = req.params;
//   console.log(`🔍 Buscando empresa por ID na Rota Aside: ${idempresa}`);

//   try {
//     const result = await db.query(
//       `SELECT * FROM empresas WHERE idempresa = $1`,
//       [idempresa]
//     );

//     if (result.rows.length === 0) {
//       return res.status(404).json({ message: "Empresa não encontrada" });
//     }

//     res.json(result.rows[0]);
//   } catch (error) {
//     console.error("❌ Erro ao buscar empresa por ID:", error);
//     res.status(500).json({ message: "Erro ao buscar empresa" });
//   }
// });



module.exports = router;
