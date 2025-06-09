const express = require('express');
const router = express.Router();
const pool = require("../db/conexaoDB");
const { autenticarToken, contextoEmpresa } = require('../middlewares/authMiddlewares');
const { verificarPermissao } = require('../middlewares/permissaoMiddleware');


// Aplica autenticação em todas as rotas
//router.use(autenticarToken);
//router.use(contextoEmpresa);


// GET todas ou por id
router.get("/", autenticarToken(), contextoEmpresa,/*verificarPermissao('Orcamentos', 'pesquisar'),*/ async (req, res) => {
  console.log("✅ Entrou na rota /orcamentos");
  const { idOrcamento } = req.query;

  try {
    if (idOrcamento) {
      const result = await pool.query(
        "SELECT * FROM orcamentos WHERE id = $1 LIMIT 1",
        [idOrcamento]
      );
      return result.rows.length
        ? res.json(result.rows[0])
        : res.status(404).json({ message: "Orçamento não encontrado" });
    } else {
      const result = await pool.query("SELECT * FROM orcamentos");
      return result.rows.length
        ? res.json(result.rows)
        : res.status(404).json({ message: "Nenhum orçamento encontrado" });
    }
  } catch (error) {
    console.error("Erro ao buscar orçamento:", error);
    res.status(500).json({ message: "Erro ao buscar orçamento" });
  }
});

// GET /orcamento/clientes
router.get('/clientes', async (req, res) => {
  
  console.log("🔥 Rota /orcamentos/clientes acessada");

  const idempresa = req.idempresa;

  try {
     
    const resultado = await pool.query(`
      SELECT c.*
      FROM clientes c
      INNER JOIN clienteempresas ce ON ce.idcliente = c.idcliente
      WHERE ce.idempresa = $1
      ORDER BY c.nmfantasia
    `, [idempresa]);

    res.json(resultado.rows);

  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao buscar clientes' });
  }

});

// GET /orcamento/eventos
router.get('/eventos', async (req, res) => {
  
 console.log("🔥 Rota /orcamentos/eventos acessada");

  const idempresa = req.idempresa;

  try {
     
    const resultado = await pool.query(`
      SELECT e.*
      FROM eventos e
      INNER JOIN eventoempresas ee ON ee.idevento = e.idevento
      WHERE ee.idempresa = $1
      ORDER BY e.nmevento
    `, [idempresa]);

    res.json(resultado.rows);

  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao buscar clientes' });
  }
});

// GET /orcamento/localmontagem
router.get('/localmontagem', async (req, res) => {
  
 console.log("🔥 Rota /orcamentos/localmontagem acessada");

  const idempresa = req.idempresa;

  try {
     
    const resultado = await pool.query(`
      SELECT l.*
      FROM localmontagem l
      INNER JOIN localmontempresas le ON le.idmontagem = l.idmontagem
      WHERE le.idempresa = $1
      ORDER BY l.descmontagem
    `, [idempresa]);

    res.json(resultado.rows);

  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao buscar clientes' });
  }

});

// GET /orcamento/funcao
router.get('/funcao', async (req, res) => {
  
 console.log("🔥 Rota /orcamentos/funcao acessada");

  const idempresa = req.idempresa;

  try {
     
    const resultado = await pool.query(`
      SELECT f.*
      FROM funcao f
      INNER JOIN funcaoempresas fe ON fe.idfuncao = f.idfuncao
      WHERE fe.idempresa = $1
      ORDER BY f.descfuncao
    `, [idempresa]);

    res.json(resultado.rows);

  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao buscar clientes' });
  }

});

// GET /orcamento/equipamentos
router.get('/equipamentos', async (req, res) => {
  
 console.log("🔥 Rota /orcamentos/equipamentos acessada");

  const idempresa = req.idempresa;

  try {
     
    const resultado = await pool.query(`
      SELECT eq.*
      FROM equipamentos eq
      INNER JOIN equipamentoempresas eqe ON eqe.idequip = eq.idequip
      WHERE eqe.idempresa = $1
      ORDER BY eq.descequip
    `, [idempresa]);

    res.json(resultado.rows);

  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao buscar clientes' });
  }

});

// GET /orcamento/suprimentos
router.get('/suprimentos', async (req, res) => {
  
 console.log("🔥 Rota /orcamentos/suprimentos acessada");

  const idempresa = req.idempresa;

  try {
     
    const resultado = await pool.query(`
      SELECT s.*
      FROM suprimentos s
      INNER JOIN suprimentoempresas se ON se.idsup = s.idsup
      WHERE se.idempresa = $1
      ORDER BY s.descsup
    `, [idempresa]);

    res.json(resultado.rows);

  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao buscar clientes' });
  }

});


// POST criar novo orçamento com itens
router.post("/", autenticarToken(), contextoEmpresa,/*autenticarToken, verificarPermissao('Orcamentos', 'cadastrar'),*/ async (req, res) => {
  const client = await pool.connect();
  const dados = req.body;

    try {
        await client.query('BEGIN');

        const insertOrcamento = `
            INSERT INTO orcamentos (
                cliente, evento, local, data_inicio, data_fim,
                montagem_infra, periodo_marcacao, periodo_montagem,
                periodo_realizacao, periodo_desmontagem, desmontagem_infra
            ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8, $9, $10, $11
            ) RETURNING id
        `;

        const {
            cliente, evento, local, data_inicio, data_fim,
            montagem_infra, periodo_marcacao, periodo_montagem,
            periodo_realizacao, periodo_desmontagem, desmontagem_infra
        }=dados;

        const result = await client.query(insertOrcamento, values);
        const orcamentoId = result.rows[0].id;

        for (const item of itens) {
            await client.query(`
                INSERT INTO itens_orcamento (
                    orcamento_id, categoria, produto, quantidade, dias
                ) VALUES ($1, $2, $3, $4, $5)
            `, [orcamentoId, item.categoria, item.produto, item.quantidade, item.dias]);
        }

        await client.query('COMMIT');
        res.json({ success: true, id: orcamentoId });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erro ao salvar orçamento:', error);
        res.status(500).json({ error: 'Erro ao salvar orçamento' });
    } finally {
        client.release();
    }
});

module.exports = router;
