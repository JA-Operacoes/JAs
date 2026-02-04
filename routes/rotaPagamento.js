const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB");
const { autenticarToken, contextoEmpresa } = require('../middlewares/authMiddlewares');
const { verificarPermissao } = require('../middlewares/permissaoMiddleware');
const logMiddleware = require('../middlewares/logMiddleware');


// --- Importações e Configuração do Multer ---
// --- Importações e Configuração do Multer ---
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Definição dos caminhos das pastas
const dirContas = path.join(__dirname, '../uploads/contas/imagemboleto');
const dirComprovantes = path.join(__dirname, '../uploads/contas/comprovantespgto');

// Criar pastas se não existirem
[dirContas, dirComprovantes].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

const storagePagamentos = multer.diskStorage({
    destination: (req, file, cb) => {
        // Lógica de destino baseada no nome do campo (fieldname)
        if (file.fieldname === 'imagemConta') {
            cb(null, dirContas);
        } else if (file.fieldname === 'comprovantePagamento') {
            cb(null, dirComprovantes);
        } else {
            cb(new Error('Campo de arquivo inválido'), null);
        }
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilterPagamentos = (req, file, cb) => {
    // Permite imagens e PDFs (comum para boletos e comprovantes)
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
        cb(null, true);
    } else {
        cb(new Error('Apenas imagens e PDFs são permitidos!'), false);
    }
};

const uploadPagamentosMiddleware = multer({
    storage: storagePagamentos,
    fileFilter: fileFilterPagamentos,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
}).fields([
    { name: 'imagemConta', maxCount: 1 },
    { name: 'comprovantePagamento', maxCount: 1 }
]);


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

// Rota para buscar detalhes de UM lançamento específico
router.get("/lancamentos/detalhe/:idLancamento", async (req, res) => {
    try {
        const { idLancamento } = req.params;
        const idEmpresa = req.idempresa || req.user.idempresa;

        // Query simples apenas na tabela de lancamentos
        const sql = `
            SELECT descricao, vlrestimado 
            FROM lancamentos 
            WHERE idlancamento = $1 AND idempresa = $2 
            LIMIT 1`;

        const resultado = await pool.query(sql, [idLancamento, idEmpresa]);

        if (resultado.rows.length === 0) {
            return res.status(404).json({ error: "Lançamento não encontrado" });
        }

        // Retorna apenas o objeto (rows[0]) e não o array completo
        res.json(resultado.rows[0]);
    } catch (error) {
        console.error("Erro ao buscar detalhe do lançamento:", error);
        res.status(500).json({ error: "Erro interno" });
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
            SELECT * 
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
    verificarPermissao('Pagamentos', 'alterar'),
    uploadPagamentosMiddleware,
    logMiddleware('Pagamentos', { 
        buscarDadosAnteriores: async (req) => {
            const result = await pool.query('SELECT * FROM pagamentos WHERE idpagamento = $1', [req.params.id]);
            return { dadosanteriores: result.rows[0], idregistroalterado: req.params.id };
        } 
    }),
    async (req, res) => {
        const { id } = req.params;
        const idempresa = req.idempresa;
        
        // Captura dados do corpo e as flags de limpeza do front
        const { 
            vlrpago, dtvcto, dtpgto, observacao, status, vlrreal,
            limparComprovanteImagem, limparComprovantePagto 
        } = req.body;

        try {
            let sqlArquivos = "";
            const valoresExtras = [];
            // O próximo índice começa após os 7 valores base ($1 a $7)
            let proximoIndice = 8; 

            // 1. Lógica para Imagem da Conta (Boleto)
            if (req.files && req.files['imagemConta']) {
                sqlArquivos += `, imagemconta = $${proximoIndice++}`;
                valoresExtras.push(req.files['imagemConta'][0].filename);
            } else if (limparComprovanteImagem === "true") {
                sqlArquivos += `, imagemconta = NULL`;
            }

            // 2. Lógica para Comprovante de Pagamento
            if (req.files && req.files['comprovantePagamento']) {
                sqlArquivos += `, comprovantepgto = $${proximoIndice++}`;
                valoresExtras.push(req.files['comprovantePagamento'][0].filename);
            } else if (limparComprovantePagto === "true") {
                sqlArquivos += `, comprovantepgto = NULL`;
            }

            const sql = `
                UPDATE pagamentos 
                SET vlrpago = $1, 
                    dtvcto = $2, 
                    dtpgto = $3, 
                    observacao = $4, 
                    status = $5,
                    vlrreal = $6 
                    ${sqlArquivos}
                WHERE idpagamento = $6 AND idempresa = $7
                RETURNING *`;

            const valoresBase = [
                vlrpago || 0, 
                dtvcto, 
                dtpgto || null, 
                observacao, 
                status, 
                vlrreal,
                id, 
                idempresa
            ];
            
            const resultado = await pool.query(sql, [...valoresBase, ...valoresExtras]);

            if (resultado.rows.length === 0) {
                return res.status(404).json({ message: "Registro não encontrado." });
            }

            res.json({ message: "Atualizado com sucesso!", data: resultado.rows[0] });
        } catch (error) {
            console.error("Erro ao atualizar pagamento:", error);
            res.status(500).json({ message: "Erro interno ao atualizar." });
        }
    }
);


// Rota para criar um novo pagamento (POST)
router.post("/", 
    verificarPermissao('Pagamentos', 'cadastrar'),
    uploadPagamentosMiddleware, // Middleware aqui
    logMiddleware('Pagamentos', { buscarDadosAnteriores: async () => ({ dadosanteriores: null, idregistroalterado: null }) }),
    async (req, res) => {
        const idempresa = req.idempresa;
        const { idlancamento, numparcela, vlrprevisto, vlrpago, dtvcto, dtpgto, observacao, status, vlrreal } = req.body;

        // Captura dos nomes dos arquivos salvos
        const imagemConta = req.files['imagemConta'] ? req.files['imagemConta'][0].filename : null;
        const comprovantePagamento = req.files['comprovantePagamento'] ? req.files['comprovantePagamento'][0].filename : null;

        try {
            const result = await pool.query(
                `INSERT INTO pagamentos (
                    idlancamento, idempresa, numparcela, vlrprevisto, 
                    vlrpago, dtvcto, dtpgto, status, observacao, imagemconta, comprovantepgto, vlrreal
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
                [idlancamento, idempresa, numparcela, vlrprevisto, vlrpago, dtvcto, dtpgto || null, status, observacao, imagemConta, comprovantePagamento, vlrreal]
            );
            res.status(201).json({ message: "Salvo!", data: result.rows[0] });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Erro ao inserir no banco." });
        }
    }
);

module.exports = router;