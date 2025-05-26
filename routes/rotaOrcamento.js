// const express = require('express');
// const router = express.Router();
// const pool = require('../db'); // instância do pool do PostgreSQL

// // GET - Buscar todos os orçamentos
// router.get('/orcamentos1', async (req, res) => {
//     try {
//         const result = await pool.query('SELECT * FROM orcamentos1');
//         res.json(result.rows);
//     } catch (err) {
//         console.error('Erro ao buscar orçamentos:', err);
//         res.status(500).json({ error: 'Erro ao buscar orçamentos' });
//     }
// });

// // POST - Criar um novo orçamento
// router.post('/orcamentos1', async (req, res) => {
//     const {
//         cliente,
//         evento,
//         local,
//         data_inicio,
//         data_fim,
//         montagem_infra,
//         periodo_marcacao,
//         periodo_montagem,
//         periodo_realizacao,
//         periodo_desmontagem,
//         desmontagem_infra,
//         itens
//     } = req.body;

//     const client = await pool.connect();

//     try {
//         await client.query('BEGIN');

//         const insertOrcamento = `
//             INSERT INTO orcamentos1 (
//                 cliente, evento, local, data_inicio, data_fim,
//                 montagem_infra, periodo_marcacao, periodo_montagem,
//                 periodo_realizacao, periodo_desmontagem, desmontagem_infra
//             ) VALUES (
//                 $1, $2, $3, $4, $5,
//                 $6, $7, $8, $9, $10, $11
//             ) RETURNING id
//         `;

//         const values = [
//             cliente, evento, local, data_inicio, data_fim,
//             montagem_infra, periodo_marcacao, periodo_montagem,
//             periodo_realizacao, periodo_desmontagem, desmontagem_infra
//         ];

//         const result = await client.query(insertOrcamento, values);
//         const orcamentoId = result.rows[0].id;

//         for (const item of itens) {
//             await client.query(`
//                 INSERT INTO itens_orcamento (
//                     orcamento_id, categoria, produto, quantidade, dias
//                 ) VALUES ($1, $2, $3, $4, $5)
//             `, [orcamentoId, item.categoria, item.produto, item.quantidade, item.dias]);
//         }

//         await client.query('COMMIT');
//         res.json({ success: true, id: orcamentoId });

//     } catch (error) {
//         await client.query('ROLLBACK');
//         console.error('Erro ao salvar orçamento:', error);
//         res.status(500).json({ error: 'Erro ao salvar orçamento' });
//     } finally {
//         client.release();
//     }
// });

// module.exports = router;
