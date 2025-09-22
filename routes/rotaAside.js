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
    const { rows } = await db.query(query, [clienteId]);

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
      SELECT idorcamento, nrorcamento, status, nomenclatura
      FROM orcamentos
      WHERE idcliente = $1 AND idevento = $2 AND status = 'A'
      ORDER BY datacriacao DESC
    `;
    const { rows } = await db.query(query, [clienteId, eventoId]);

    console.log("🧾 Orçamentos encontrados:", rows);

    res.json(rows);
  } catch (err) {
    console.error('❌ Erro ao buscar orçamentos:', err);
    res.status(500).json({ erro: 'Erro interno ao buscar orçamentos' });
  }
});

router.get("/clientes", async (req, res) => {
    
  const { nmFantasia } = req.query;
  const idempresa = req.idempresa;
  console.log("nmFantasia na Rota:", nmFantasia); // Log do valor de nmFantasia
  try {
    if (nmFantasia) {
      console.log("🔍 Buscando cliente por nmFantasia:", nmFantasia, idempresa);
      const result = await db.query(
        `SELECT c.* 
        FROM clientes c
        INNER JOIN clienteempresas ce ON ce.idcliente = c.idcliente
        WHERE ce.idempresa = $1 AND c.nmfantasia ILIKE $2
        ORDER BY c.nmfantasia ASC LIMIT 1`,
        [idempresa,`%${nmFantasia}%`]
      );
      console.log("✅ Consulta por nmFantasia retornou:", result.rows.length, "linhas.");
      return result.rows.length
        ? res.json(result.rows[0])
        : res.status(404).json({ message: "Cliente não encontrado" });
    } else {
      console.log("🔍 Buscando todos os clientes para a empresa:", idempresa);
      const result = await db.query(
        `SELECT c.* 
        FROM clientes c
        INNER JOIN clienteempresas ce ON ce.idcliente = c.idcliente
        WHERE ce.idempresa = $1 ORDER BY nmfantasia`
        , [idempresa]);
      console.log("✅ Consulta de todos os clientes retornou:", result.rows.length, "linhas.");
      return result.rows.length
        ? res.json(result.rows)
        : res.status(404).json({ message: "Nenhum Cliente encontrado" });
    }
  } catch (error) {
    console.error("❌ Erro ao buscar clientes:", error);
    res.status(500).json({ message: "Erro ao buscar nome fantasia" });
  }
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
