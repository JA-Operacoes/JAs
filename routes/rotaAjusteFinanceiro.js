const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB");
const { verificarPermissao } = require('../middlewares/permissaoMiddleware');
const logMiddleware = require('../middlewares/logMiddleware');

const parseFloatOrNull = (v) => {
    if (v === undefined || v === null || v === '' || v === 'NaN' || v === 'null') return 0;
    const n = parseFloat(String(v).replace(',', '.'));
    return Number.isNaN(n) ? 0 : n;
};

// GET /ajustefinanceiro/:idFuncionario — histórico de lançamentos do funcionário
router.get("/:idFuncionario",
    verificarPermissao('AjusteFinanceiro', 'pesquisar'),
    async (req, res) => {
        const idempresa = req.idempresa;
        const idFuncionario = req.params.idFuncionario;

        try {
            const result = await pool.query(
                `SELECT
                    a.idajustefinanceiro, a.idfuncionario, a.idstaffevento_origem,
                    a.tipo, a.valor, a.justificativa, a.status,
                    a.dtlancamento, a.dtpagamento,
                    se.nmcliente, se.nmevento, se.nmlocalmontagem, se.nmfuncao
                 FROM staffajustefinanceiro a
                 LEFT JOIN staffeventos se ON se.idstaffevento = a.idstaffevento_origem
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
    logMiddleware('AjusteFinanceiro', {
        buscarDadosAnteriores: async () => ({ dadosanteriores: null, idregistroalterado: null })
    }),
    async (req, res) => {
        const idempresa = req.idempresa;
        const idUsuarioLogado = req.usuario.idusuario;
        const { idfuncionario, idstaffevento_origem, tipo, valor, justificativa } = req.body;

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

            const result = await pool.query(
                `INSERT INTO staffajustefinanceiro
                    (idfuncionario, idempresa, idstaffevento_origem, tipo, valor, justificativa, idusuariolancamento)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 RETURNING *`,
                [idfuncionario, idempresa, idstaffevento_origem || null, tipo, valorNumerico, String(justificativa).trim(), idUsuarioLogado]
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
        const idAjusteFinanceiro = req.params.idAjusteFinanceiro;
        const { idfuncionario, idstaffevento_origem, tipo, valor, justificativa } = req.body;

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
            const atual = await pool.query(
                `SELECT status FROM staffajustefinanceiro WHERE idajustefinanceiro = $1 AND idempresa = $2`,
                [idAjusteFinanceiro, idempresa]
            );
            if (atual.rowCount === 0) {
                return res.status(404).json({ erro: "Lançamento não encontrado." });
            }
            if (atual.rows[0].status !== 'Pendente') {
                return res.status(409).json({ erro: "Só é possível editar lançamentos com status Pendente." });
            }

            const result = await pool.query(
                `UPDATE staffajustefinanceiro
                    SET idfuncionario = $1, idstaffevento_origem = $2, tipo = $3, valor = $4, justificativa = $5
                 WHERE idajustefinanceiro = $6 AND idempresa = $7
                 RETURNING *`,
                [idfuncionario, idstaffevento_origem || null, tipo, valorNumerico, String(justificativa).trim(), idAjusteFinanceiro, idempresa]
            );

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
