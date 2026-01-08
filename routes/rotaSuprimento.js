const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB");
const { autenticarToken, contextoEmpresa } = require('../middlewares/authMiddlewares');
const { verificarPermissao } = require('../middlewares/permissaoMiddleware');
const logMiddleware = require('../middlewares/logMiddleware');

router.use(autenticarToken());
router.use(contextoEmpresa);

// GET - Pesquisa
router.get("/", verificarPermissao('Suprimentos', 'pesquisar'), async (req, res) => {
    const { descSup } = req.query;
    const idempresa = req.idempresa;
    try {
        if (descSup) {
            const result = await pool.query(
                `SELECT s.* FROM suprimentos s
                 INNER JOIN suprimentoempresas se ON se.idsup = s.idsup
                 WHERE se.idempresa = $1 AND s.descsup ILIKE $2 LIMIT 1`,
                [idempresa, `%${descSup}%`]
            );
            return result.rows.length ? res.json(result.rows[0]) : res.status(404).json({ message: "Suprimento não encontrado" });
        } else {
            const result = await pool.query(
                `SELECT s.* FROM suprimentos s
                 INNER JOIN suprimentoempresas se ON se.idsup = s.idsup
                 WHERE se.idempresa = $1 ORDER BY descsup ASC`,
                [idempresa]
            );
            return result.rows.length ? res.json(result.rows) : res.status(404).json({ message: "Nenhum suprimento encontrado" });
        }
    } catch (error) {
        res.status(500).json({ message: "Erro ao buscar suprimentos" });
    }
});

// POST - Cadastro (Com vínculo obrigatório)
router.post("/", verificarPermissao('Suprimentos', 'cadastrar'), 
    logMiddleware('Suprimentos', { buscarDadosAnteriores: async () => ({ dadosanteriores: null, idregistroalterado: null }) }),
    async (req, res) => {
    const { descSup, custo, venda } = req.body;
    const idempresa = req.idempresa;
    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');
        const resSup = await client.query(
            "INSERT INTO suprimentos (descsup, ctosup, vdasup) VALUES ($1, $2, $3) RETURNING idsup, descsup",
            [descSup.toUpperCase(), custo, venda]
        );
        const novoSup = resSup.rows[0];
        await client.query("INSERT INTO suprimentoempresas (idsup, idempresa) VALUES ($1, $2)", [novoSup.idsup, idempresa]);
        await client.query('COMMIT');
        res.locals.acao = 'cadastrou';
        res.locals.idregistroalterado = novoSup.idsup;
        res.status(201).json({ message: "Suprimento salvo com sucesso!", suprimento: novoSup });
    } catch (error) {
        if (client) await client.query('ROLLBACK');
        res.status(500).json({ message: "Erro ao salvar suprimento" });
    } finally { if (client) client.release(); }
});

// PUT - Atualizar
router.put("/:id", verificarPermissao('Suprimentos', 'alterar'), async (req, res) => {
    const { descSup, custo, venda } = req.body;
    try {
        const result = await pool.query(
            "UPDATE suprimentos SET descsup = $1, ctosup = $2, vdasup = $3 WHERE idsup = $4 RETURNING idsup",
            [descSup.toUpperCase(), custo, venda, req.params.id]
        );
        if (result.rowCount) {
            res.locals.acao = 'atualizou';
            res.locals.idregistroalterado = req.params.id;
            return res.json({ message: "Suprimento atualizado com sucesso!" });
        }
        res.status(404).json({ message: "Suprimento não encontrado" });
    } catch (error) {
        res.status(500).json({ message: "Erro ao atualizar" });
    }
});

module.exports = router;