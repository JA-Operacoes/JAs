const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB");
const { autenticarToken, contextoEmpresa } = require('../middlewares/authMiddlewares');
const { verificarPermissao } = require('../middlewares/permissaoMiddleware');

// ROTA PRINCIPAL DE RELATÓRIOS
router.get("/", autenticarToken(), contextoEmpresa,
verificarPermissao('Relatorios', 'pesquisar'), async (req, res) => {
    console.log("ENTROU NA ROTA PARA RELATORIOS");
    const { tipo, dataInicio, dataFim, evento } = req.query; 
    const idempresa = req.idempresa;
    
    if (!tipo || !dataInicio || !dataFim || !evento) {
        return res.status(400).json({ error: 'Parâmetros tipo, dataInicio, dataFim e evento são obrigatórios.' });
    }
    
    const tiposPermitidos = ['ajuda_custo', 'cache'];
    if (!tiposPermitidos.includes(tipo)) {
        return res.status(400).json({ error: 'Tipo de relatório inválido.' });
    }

    try {
        const relatorio = {};

        // Condição WHERE para o período de datas.
        const wherePeriodo = `
            AND EXISTS (
                SELECT 1
                FROM jsonb_array_elements_text(tse.datasevento) AS event_date
                WHERE event_date::date >= $2::date
                AND event_date::date <= $3::date
            ) AND tse.idevento = $4
        `;
        
        // 1. Query para a Seção Principal: FECHAMENTO CACHÊ
        const queryFechamentoCache = `
            SELECT
                tse.nmevento AS "nomeEvento",
                tse.nmfuncao AS "FUNÇÃO",
                tbf.nome AS "NOME",
                tbf.pix AS "PIX",
                jsonb_array_element(tse.datasevento, 0) AS "INÍCIO",
                jsonb_array_element(tse.datasevento, jsonb_array_length(tse.datasevento) - 1) AS "TÉRMINO",
                (
                    COALESCE(CASE WHEN tse.statusajustecusto = 'Autorizado' THEN tse.vlrajustecusto ELSE 0.00 END, 0.00) +
                    COALESCE(CASE WHEN tse.statuscaixinha = 'Autorizado' THEN tse.vlrcaixinha ELSE 0.00 END, 0.00)
                ) AS "VLR ADICIONAL",
                (COALESCE(tse.vlralmoco, 0) + COALESCE(tse.vlrjantar, 0) + COALESCE(tse.vlrtransporte, 0)) AS "VLR DIÁRIA",
                jsonb_array_length(tse.datasevento) AS "QTD",
                (COALESCE(tse.vlralmoco, 0) + COALESCE(tse.vlrjantar, 0) + COALESCE(tse.vlrtransporte, 0)) * jsonb_array_length(tse.datasevento) AS "TOTAL DIÁRIAS",
                tse.statuspgto AS "STATUS PGTO"
            FROM
                staffeventos tse
            JOIN
                funcionarios tbf ON tse.idfuncionario = tbf.idfuncionario
            JOIN 
                staffempresas semp ON tse.idstaff = semp.idstaff
            WHERE
                semp.idempresa = $1 ${wherePeriodo}
            ORDER BY
                tse.nmevento,
                tse.nmcliente;
        `;
        const resultFechamentoCache = await pool.query(queryFechamentoCache, [idempresa, dataInicio, dataFim, evento]);
        relatorio.fechamentoCache = resultFechamentoCache.rows;
        
        // 2. Query para a Seção: RELATÓRIO UTILIZAÇÃO DE DIÁRIAS
        const queryUtilizacaoDiarias = `
            SELECT
                tse.nmfuncao AS "INFORMAÇÕES EM PROPOSTA",
                COUNT(tse.idfuncionario) AS "QTD PROFISSIONAIS",
                SUM(orc.totajdcto) AS "DIÁRIAS CONTRATADAS",
                SUM(jsonb_array_length(tse.datasevento)) AS "DIÁRIAS UTILIZADAS",
                SUM(orc.totajdcto) - SUM(jsonb_array_length(tse.datasevento)) AS "SALDO"
            FROM
                staffeventos tse
            JOIN
                orcamentos orc ON tse.idcliente = orc.idcliente
            JOIN 
                staffempresas semp ON tse.idstaff = semp.idstaff
            WHERE
                semp.idempresa = $1 ${wherePeriodo}
            GROUP BY
                tse.nmfuncao;
        `;
        const resultUtilizacaoDiarias = await pool.query(queryUtilizacaoDiarias, [idempresa, dataInicio, dataFim, evento]);
        relatorio.utilizacaoDiarias = resultUtilizacaoDiarias.rows;
        
        // 3. Query para a Seção: CONTINGÊNCIA
        const queryContingencia = `
            SELECT
                tbf.nome AS "Profissional",
                CASE
                    WHEN tse.dtdiariadobrada IS NOT NULL THEN 'Diária Dobrada' 
                    WHEN tse.dtmeiadiaria IS NOT NULL THEN 'Meia Diária' 
                ELSE NULL
                END AS "Informacao",
                '' AS "Observacao"
            FROM
                staffeventos tse
            JOIN
                funcionarios tbf ON tse.idfuncionario = tbf.idfuncionario
            JOIN 
                staffempresas semp ON tse.idstaff = semp.idstaff
            WHERE
                semp.idempresa = $1 ${wherePeriodo} AND
                (tse.dtdiariadobrada IS NOT NULL OR tse.dtmeiadiaria IS NOT NULL);
        `;
        const resultContingencia = await pool.query(queryContingencia, [idempresa, dataInicio, dataFim, evento]);
        relatorio.contingencia = resultContingencia.rows;

        return res.json(relatorio);
        
    } catch (error) {
        console.error("❌ Erro ao buscar relatório:", error);
        return res.status(500).json({ error: error.message || "Erro ao gerar relatório" });
    }
});

// ROTA PARA BUSCAR EVENTOS NO PERÍODO
router.get('/eventos', verificarPermissao('Relatorios', 'pesquisar'), async (req, res) => {
    try {
        const { inicio, fim } = req.query;
        if (!inicio || !fim) {
            return res.status(400).json({ error: "Parâmetros inicio e fim são obrigatórios." });
        }

        const query = `
            SELECT e.idevento, e.nmevento
            FROM eventos e
            JOIN orcamentos o ON o.idevento = e.idevento
            WHERE (
                (o.dtinimontagem IS NOT NULL AND o.dtinimontagem <= $2 AND o.dtfimmontagem >= $1)
            OR (o.dtinirealizacao IS NOT NULL AND o.dtinirealizacao <= $2 AND o.dtfimrealizacao >= $1)
            OR (o.dtinidesmontagem IS NOT NULL AND o.dtinidesmontagem <= $2 AND o.dtfimdesmontagem >= $1)
            OR (o.dtiniinframontagem IS NOT NULL AND o.dtiniinframontagem <= $2 AND o.dtfiminframontagem >= $1)
            OR (o.dtiniinfradesmontagem IS NOT NULL AND o.dtiniinfradesmontagem <= $2 AND o.dtfiminfradesmontagem >= $1)
            OR (o.dtinimarcacao IS NOT NULL AND o.dtinimarcacao <= $2 AND o.dtfimmarcacao >= $1)
            )
            GROUP BY e.idevento, e.nmevento
            ORDER BY e.nmevento;
        `;

        const { rows } = await pool.query(query, [inicio, fim]);
        return res.json(rows);
    } catch (err) {
        console.error("❌ Erro ao buscar eventos:", err);
        return res.status(500).json({ error: err.message });
    }
});

module.exports = router;