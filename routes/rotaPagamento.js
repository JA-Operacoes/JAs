const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB");
const { autenticarToken, contextoEmpresa } = require('../middlewares/authMiddlewares');
const { verificarPermissao } = require('../middlewares/permissaoMiddleware');
const logMiddleware = require('../middlewares/logMiddleware');

// Aplica autenticação e contexto em todas as rotas de lançamentos
router.use(autenticarToken());
router.use(contextoEmpresa);


// Rota para listar lançamentos simplificados para o Select de Pagamentos
router.get("/lancamentos", async (req, res) => {
    try {
        // Exemplo de query SQL: busca lançamentos ativos
        // Ajuste os nomes das colunas conforme seu banco (ex: idlancamento, descricao)
        const sql = `SELECT idlancamento, descricao, vlrestimado, vctobase 
                     FROM lancamentos 
                     WHERE ativo = true 
                     ORDER BY vctobase ASC`;
        
        const resultado = await pool.query(sql); // Use seu objeto de conexão aqui
        res.json(resultado.rows);
    } catch (error) {
        console.error("Erro ao buscar lançamentos para select:", error);
        res.status(500).json({ error: "Erro interno ao buscar dados." });
    }
});

router.get("/ultimo/:idLancamento", async (req, res) => {
    try {
        const { idLancamento } = req.params;
        const idEmpresa = req.idempresa || (req.user && req.user.idempresa);

        const sql = `
            SELECT numparcela, dtvcto 
            FROM pagamentos 
            WHERE idlancamento = $1 AND idempresa = $2
            ORDER BY numparcela DESC 
            LIMIT 1
        `;

        const resultado = await pool.query(sql, [idLancamento, idEmpresa]);

        if (resultado.rows.length === 0) {
            // Se não houver pagamento, retornamos null para o front usar o vctobase do lançamento
            return res.json({ numparcela: 0, dtvcto: null });
        }

        res.json(resultado.rows[0]);
    } catch (error) {
        console.error("Erro ao buscar último pagamento:", error);
        res.status(500).json({ error: "Erro interno" });
    }
});

router.get("/historico/:idLancamento", async (req, res) => {
    try {
        const { idLancamento } = req.params;
        const idEmpresa = req.idempresa || req.user.idempresa;

        const sql = `
            SELECT idpagamento, numparcela, dtvcto, vlrpago, dtpgto, observacao, status 
            FROM pagamentos 
            WHERE idlancamento = $1 AND idempresa = $2
            ORDER BY numparcela DESC`; // Alterado para DESC

        const resultado = await pool.query(sql, [idLancamento, idEmpresa]);
        res.json(resultado.rows);
    } catch (error) {
        res.status(500).json({ error: "Erro ao buscar histórico" });
    }
});

// Rota para recalcular a média de pagamentos e atualizar o lançamento
// router.get("/recalcular-media/:idLancamento", async (req, res) => {
//     try {
//         const { idLancamento } = req.params;
//         const idEmpresa = req.idempresa || req.user.idempresa;

//         // 1. Busca a média real dos pagamentos já realizados
//         const sqlMedia = `
//             SELECT AVG(vlrpago) as media 
//             FROM pagamentos 
//             WHERE idlancamento = $1 AND idempresa = $2 AND vlrpago > 0
//         `;
//         const resMedia = await pool.query(sqlMedia, [idLancamento, idEmpresa]);
//         const novaMedia = resMedia.rows[0].media;

//         if (novaMedia) {
//             // 2. SALVA o novo valor estimado na tabela de LANÇAMENTOS
//             const sqlUpdate = `
//                 UPDATE lancamentos 
//                 SET vlrestimado = $1 
//                 WHERE idlancamento = $2 AND idempresa = $3
//             `;
//             await pool.query(sqlUpdate, [parseFloat(novaMedia).toFixed(2), idLancamento, idEmpresa]);
            
//             res.json({ success: true, novaMedia: parseFloat(novaMedia).toFixed(2) });
//         } else {
//             res.json({ success: false, message: "Sem pagamentos para calcular média" });
//         }

//     } catch (error) {
//         console.error("Erro ao recalcular média:", error);
//         res.status(500).json({ error: "Erro interno no servidor" });
//     }
// });


// Rota para atualizar um pagamento existente (PUT)
router.put("/:id", 
    verificarPermissao('Pagamentos', 'alterar'), // Verifica permissão de alterar
    logMiddleware('Pagamentos', { 
        buscarDadosAnteriores: async (req) => {
            const result = await pool.query('SELECT * FROM pagamentos WHERE idpagamento = $1', [req.params.id]);
            return { 
                dadosanteriores: result.rows[0], 
                idregistroalterado: req.params.id 
            };
        } 
    }),
    async (req, res) => {
        const { id } = req.params;
        const idempresa = req.idempresa;
        const { 
            vlrpago, dtvcto, dtpgto, observacao, status 
        } = req.body;

        try {
            const sql = `
                UPDATE pagamentos 
                SET vlrpago = $1, 
                    dtvcto = $2, 
                    dtpgto = $3, 
                    observacao = $4, 
                    status = $5
                WHERE idpagamento = $6 AND idempresa = $7
                RETURNING *`;

            const valores = [
                vlrpago || 0, 
                dtvcto, 
                dtpgto || null, 
                observacao, 
                status || 'pago', 
                id, 
                idempresa
            ];

            const resultado = await pool.query(sql, valores);

            if (resultado.rows.length === 0) {
                return res.status(404).json({ message: "Pagamento não encontrado ou sem permissão para esta empresa." });
            }

            res.json({ message: "Pagamento atualizado com sucesso!", data: resultado.rows[0] });
        } catch (error) {
            console.error("Erro ao atualizar pagamento:", error);
            res.status(500).json({ message: "Erro interno ao atualizar pagamento." });
        }
    }
);

router.post("/", 
    verificarPermissao('Pagamentos', 'cadastrar'),
    logMiddleware('Pagamentos', { 
        buscarDadosAnteriores: async () => ({ dadosanteriores: null, idregistroalterado: null }) 
    }),
    async (req, res) => {
    const idempresa = req.idempresa;
    const { 
        idlancamento, numparcela, vlrprevisto, vlrpago, 
        dtvcto, dtpgto, observacao, status // status também pode vir do body
    } = req.body;

    console.log("DEBUG BODY:", req.body); 

    try {
        const result = await pool.query(
            `INSERT INTO pagamentos (
                idlancamento, idempresa, numparcela, vlrprevisto, 
                vlrpago, dtvcto, dtpgto, status, observacao
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
            RETURNING *`,
            [
                idlancamento, 
                idempresa, 
                numparcela || 1, 
                vlrprevisto || 0, 
                vlrpago || 0, 
                dtvcto,   
                dtpgto || null,   
                status || 'pago', // Usa o status do front ou 'pago' por padrão
                observacao        // Agora como o 9º parâmetro ($9)
            ]
        );

        res.status(201).json({ message: "Pagamento registrado com sucesso!", data: result.rows[0] });
    } catch (error) {
        console.error("Erro no INSERT:", error);
        res.status(500).json({ message: "Erro ao registrar pagamento." });
    }
});

module.exports = router;