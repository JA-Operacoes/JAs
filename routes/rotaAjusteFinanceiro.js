const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB");
const { verificarPermissao } = require('../middlewares/permissaoMiddleware');
const logMiddleware = require('../middlewares/logMiddleware');

const multer = require('multer');
const path = require('path');
const fs = require('fs');

const parseFloatOrNull = (v) => {
    if (v === undefined || v === null || v === '' || v === 'NaN' || v === 'null') return 0;
    const n = parseFloat(String(v).replace(',', '.'));
    return Number.isNaN(n) ? 0 : n;
};

// Reaproveita a mesma pasta dos demais comprovantes do sistema (staffeventos)
const comprovantesUploadDir = path.join(__dirname, '../uploads/staff_comprovantes');
if (!fs.existsSync(comprovantesUploadDir)) {
    fs.mkdirSync(comprovantesUploadDir, { recursive: true });
}

const deletarArquivoAntigo = (relativePath) => {
    if (!relativePath) return;
    const absolutePath = path.join(__dirname, '..', relativePath);
    fs.unlink(absolutePath, (err) => {
        if (err && err.code !== 'ENOENT') console.error('Erro ao deletar comprovante antigo:', err);
    });
};

const storageComprovanteAjuste = multer.diskStorage({
    destination: (req, file, cb) => cb(null, comprovantesUploadDir),
    filename: (req, file, cb) => {
        const id = req.params.idAjusteFinanceiro || 'novo';
        const nomeOriginalLimpo = path.parse(file.originalname).name
            .replace(/\s+/g, '')
            .replace(/[^a-zA-Z0-9]/g, '');
        const dataHoje = new Date().toISOString().split('T')[0].replace(/-/g, '');
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `comprovanteajuste-ID${id}-${dataHoje}-${nomeOriginalLimpo}${ext}`);
    }
});

const fileFilterComprovanteAjuste = (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
        cb(null, true);
    } else {
        cb(new Error('Tipo de arquivo não suportado! Apenas imagens e PDFs são permitidos.'), false);
    }
};

const uploadComprovanteAjuste = multer({
    storage: storageComprovanteAjuste,
    fileFilter: fileFilterComprovanteAjuste,
    limits: { fileSize: 10 * 1024 * 1024 }
}).single('comprovanteajuste');

// GET /ajustefinanceiro/notificacoes/pendentes — ajustes automáticos (ex: gerados na remoção de
// data com ajuda de custo paga) ainda não vistos pelo financeiro. Alimenta o aviso no card de
// Pedidos do Main. Precisa vir ANTES de /:idFuncionario, senão "notificacoes" seria capturado
// como se fosse um idFuncionario.
router.get("/notificacoes/pendentes",
    verificarPermissao('AjusteFinanceiro', 'pesquisar'),
    async (req, res) => {
        const idempresa = req.idempresa;
        try {
            const { rows } = await pool.query(
                `SELECT
                    a.idajustefinanceiro, a.idfuncionario, a.tipo, a.valor, a.justificativa, a.dtlancamento,
                    f.nome AS nomefuncionario,
                    se.nmevento, se.nmfuncao
                 FROM staffajustefinanceiro a
                 LEFT JOIN funcionarios f ON f.idfuncionario = a.idfuncionario
                 LEFT JOIN staffeventos se ON se.idstaffevento = a.idstaffeventoorigem
                 WHERE a.idempresa = $1 AND a.status = 'Pendente' AND a.dtvisualizacao IS NULL
                 ORDER BY a.dtlancamento DESC`,
                [idempresa]
            );
            res.json(rows);
        } catch (error) {
            console.error("Erro ao buscar notificações de ajuste financeiro:", error);
            res.status(500).json({ erro: "Erro ao buscar notificações de ajuste financeiro." });
        }
    }
);

// PATCH /ajustefinanceiro/:idAjusteFinanceiro/marcar-lido — dispensa a notificação sem mexer no
// status do lançamento (que só muda quando o financeiro processa o pagamento em Vencimentos).
router.patch("/:idAjusteFinanceiro/marcar-lido",
    verificarPermissao('AjusteFinanceiro', 'alterar'),
    logMiddleware('AjusteFinanceiro', {
        acao: 'visualizou',
        buscarDadosAnteriores: async (req) => {
            const result = await pool.query(
                `SELECT * FROM staffajustefinanceiro WHERE idajustefinanceiro = $1`,
                [req.params.idAjusteFinanceiro]
            );
            return {
                dadosanteriores: result.rows[0] || null,
                idregistroalterado: req.params.idAjusteFinanceiro
            };
        }
    }),
    async (req, res) => {
        const idempresa = req.idempresa;
        const idUsuarioLogado = req.usuario.idusuario;
        const idAjusteFinanceiro = req.params.idAjusteFinanceiro;
        try {
            const { rows } = await pool.query(
                `UPDATE staffajustefinanceiro
                 SET idusuariovisualizacao = $1, dtvisualizacao = NOW()
                 WHERE idajustefinanceiro = $2 AND idempresa = $3 AND dtvisualizacao IS NULL
                 RETURNING *`,
                [idUsuarioLogado, idAjusteFinanceiro, idempresa]
            );
            if (rows.length === 0) {
                return res.status(404).json({ erro: "Ajuste não encontrado ou já visualizado." });
            }

            res.locals.idregistroalterado = idAjusteFinanceiro;
            res.locals.idusuarioAlvo = rows[0].idfuncionario;
            res.locals.dadosnovos = rows[0];

            res.json({ sucesso: true });
        } catch (error) {
            console.error("Erro ao marcar ajuste financeiro como lido:", error);
            res.status(500).json({ erro: "Erro ao marcar como lido." });
        }
    }
);

// GET /ajustefinanceiro/:idFuncionario — histórico de lançamentos do funcionário
router.get("/:idFuncionario",
    verificarPermissao('AjusteFinanceiro', 'pesquisar'),
    async (req, res) => {
        const idempresa = req.idempresa;
        const idFuncionario = req.params.idFuncionario;

        try {
            const result = await pool.query(
                `SELECT
                    a.idajustefinanceiro, a.idfuncionario, a.idstaffeventoorigem, a.idstaffeventopago,
                    a.tipo, a.valor, a.justificativa, a.status, a.comprovante,
                    a.dtlancamento, a.dtpagamento,
                    se.nmcliente, se.nmevento, se.nmlocalmontagem, se.nmfuncao,
                    sePago.nmevento AS nmevento_pago
                 FROM staffajustefinanceiro a
                 LEFT JOIN staffeventos se ON se.idstaffevento = a.idstaffeventoorigem
                 LEFT JOIN staffeventos sePago ON sePago.idstaffevento = a.idstaffeventopago
                 WHERE a.idfuncionario = $1 AND a.idempresa = $2
                 ORDER BY a.dtlancamento DESC`,
                [idFuncionario, idempresa]
            );
            res.json(result.rows);
        } catch (error) {
            console.error("Erro ao buscar ajustes financeiros:", error);
            res.status(500).json({ erro: "Erro ao buscar ajustes financeiros." });
        }
    }
);

// POST /ajustefinanceiro — cria um lançamento de crédito ou débito
router.post("/",
    verificarPermissao('AjusteFinanceiro', 'cadastrar'),
    uploadComprovanteAjuste,
    logMiddleware('AjusteFinanceiro', {
        buscarDadosAnteriores: async () => ({ dadosanteriores: null, idregistroalterado: null })
    }),
    async (req, res) => {
        const idempresa = req.idempresa;
        const idUsuarioLogado = req.usuario.idusuario;
        const { idfuncionario, idstaffeventoorigem, tipo, valor, justificativa } = req.body;

        if (!idfuncionario || !tipo || !['Credito', 'Debito'].includes(tipo)) {
            return res.status(400).json({ erro: "Funcionário e tipo (Credito/Debito) são obrigatórios." });
        }
        const valorNumerico = parseFloatOrNull(valor);
        if (!valorNumerico || valorNumerico <= 0) {
            return res.status(400).json({ erro: "Valor deve ser maior que zero." });
        }
        if (!justificativa || !String(justificativa).trim()) {
            return res.status(400).json({ erro: "Justificativa é obrigatória." });
        }

        try {
            const funcionarioValido = await pool.query(
                `SELECT 1 FROM funcionarioempresas WHERE idfuncionario = $1 AND idempresa = $2`,
                [idfuncionario, idempresa]
            );
            if (funcionarioValido.rowCount === 0) {
                return res.status(404).json({ erro: "Funcionário não encontrado nesta empresa." });
            }

            const comprovantePath = req.file ? `/uploads/staff_comprovantes/${req.file.filename}` : null;

            const result = await pool.query(
                `INSERT INTO staffajustefinanceiro
                    (idfuncionario, idempresa, idstaffeventoorigem, tipo, valor, justificativa, idusuariolancamento, comprovante)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 RETURNING *`,
                [idfuncionario, idempresa, idstaffeventoorigem || null, tipo, valorNumerico, String(justificativa).trim(), idUsuarioLogado, comprovantePath]
            );

            const novoAjuste = result.rows[0];

            res.locals.acao = 'cadastrou';
            res.locals.idregistroalterado = novoAjuste.idajustefinanceiro;
            res.locals.dadosnovos = novoAjuste;

            res.status(201).json(novoAjuste);
        } catch (error) {
            console.error("Erro ao criar ajuste financeiro:", error);
            res.status(500).json({ erro: "Erro ao criar ajuste financeiro." });
        }
    }
);

// PUT /ajustefinanceiro/:idAjusteFinanceiro — edita um lançamento ainda Pendente
router.put("/:idAjusteFinanceiro",
    verificarPermissao('AjusteFinanceiro', 'alterar'),
    uploadComprovanteAjuste,
    logMiddleware('AjusteFinanceiro', {
        buscarDadosAnteriores: async (req) => {
            const idAjusteFinanceiro = req.params.idAjusteFinanceiro;
            const result = await pool.query(
                `SELECT * FROM staffajustefinanceiro WHERE idajustefinanceiro = $1`,
                [idAjusteFinanceiro]
            );
            return {
                dadosanteriores: result.rows[0] || null,
                idregistroalterado: idAjusteFinanceiro
            };
        }
    }),
    async (req, res) => {
        const idempresa = req.idempresa;
        const idUsuarioLogado = req.usuario.idusuario;
        const idAjusteFinanceiro = req.params.idAjusteFinanceiro;
        const { idfuncionario, idstaffeventoorigem, tipo, valor, justificativa, limparComprovante } = req.body;

        try {
            const atual = await pool.query(
                `SELECT status, comprovante FROM staffajustefinanceiro WHERE idajustefinanceiro = $1 AND idempresa = $2`,
                [idAjusteFinanceiro, idempresa]
            );
            if (atual.rowCount === 0) {
                return res.status(404).json({ erro: "Lançamento não encontrado." });
            }
            const statusAtual = atual.rows[0].status;

            if (statusAtual !== 'Pendente' && statusAtual !== 'Pago') {
                return res.status(409).json({ erro: "Só é possível editar lançamentos com status Pendente, ou anexar comprovante em um já Pago." });
            }

            // Devs, Admin Supremo e Master podem alterar tudo mesmo com o lançamento já Pago;
            // os demais usuários, uma vez Pago, só têm permissão de anexar/trocar o comprovante.
            const { rows: acessoTotalRows } = await pool.query(
                `SELECT 1 FROM permissoes WHERE idusuario = $1 AND idempresa = $2 AND (devs = true OR supremo = true OR master = true) LIMIT 1`,
                [idUsuarioLogado, idempresa]
            );
            const temAcessoTotal = acessoTotalRows.length > 0;
            const somenteComprovante = statusAtual === 'Pago' && !temAcessoTotal;

            if (!somenteComprovante) {
                if (!idfuncionario || !tipo || !['Credito', 'Debito'].includes(tipo)) {
                    return res.status(400).json({ erro: "Funcionário e tipo (Credito/Debito) são obrigatórios." });
                }
                if (!justificativa || !String(justificativa).trim()) {
                    return res.status(400).json({ erro: "Justificativa é obrigatória." });
                }
            }

            const comprovanteAntigo = atual.rows[0].comprovante;
            const comprovantePath = req.file
                ? `/uploads/staff_comprovantes/${req.file.filename}`
                : (limparComprovante === 'true' ? null : comprovanteAntigo);

            if (req.file || limparComprovante === 'true') {
                deletarArquivoAntigo(comprovanteAntigo);
            }

            let result;
            if (somenteComprovante) {
                result = await pool.query(
                    `UPDATE staffajustefinanceiro SET comprovante = $1
                     WHERE idajustefinanceiro = $2 AND idempresa = $3
                     RETURNING *`,
                    [comprovantePath, idAjusteFinanceiro, idempresa]
                );
            } else {
                const valorNumerico = parseFloatOrNull(valor);
                if (!valorNumerico || valorNumerico <= 0) {
                    return res.status(400).json({ erro: "Valor deve ser maior que zero." });
                }
                result = await pool.query(
                    `UPDATE staffajustefinanceiro
                        SET idfuncionario = $1, idstaffeventoorigem = $2, tipo = $3, valor = $4, justificativa = $5, comprovante = $6
                     WHERE idajustefinanceiro = $7 AND idempresa = $8
                     RETURNING *`,
                    [idfuncionario, idstaffeventoorigem || null, tipo, valorNumerico, String(justificativa).trim(), comprovantePath, idAjusteFinanceiro, idempresa]
                );
            }

            const ajusteAtualizado = result.rows[0];

            res.locals.acao = 'alterou';
            res.locals.idregistroalterado = idAjusteFinanceiro;
            res.locals.dadosnovos = ajusteAtualizado;

            res.json(ajusteAtualizado);
        } catch (error) {
            console.error("Erro ao editar ajuste financeiro:", error);
            res.status(500).json({ erro: "Erro ao editar ajuste financeiro." });
        }
    }
);

module.exports = router;
