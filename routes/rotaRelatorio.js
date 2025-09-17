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
    const eventoEhTodos = evento === "todos";
    
    if (!tipo || !dataInicio || !dataFim || !evento) {
        return res.status(400).json({ error: 'Parâmetros tipo, dataInicio, dataFim e evento são obrigatórios.' });
    }
    
    const tiposPermitidos = ['ajuda_custo', 'cache'];
    if (!tiposPermitidos.includes(tipo)) {
        return res.status(400).json({ error: 'Tipo de relatório inválido.' });
    }

    try {
        const relatorio = {};

        let wherePeriodo = `
            EXISTS (
                SELECT 1
                FROM jsonb_array_elements_text(tse.datasevento) AS event_date
                WHERE event_date::date >= $2::date
                AND event_date::date <= $3::date
            )
        `;
        if (!eventoEhTodos) {
            wherePeriodo += ` AND tse.idevento = $4`;
        }

        // Monta a query principal conforme o tipo
        let queryFechamentoPrincipal = '';
        if (tipo === 'ajuda_custo') {
            queryFechamentoPrincipal = `
                SELECT
                    tse.idevento AS "idevento",
                    tse.nmevento AS "nomeEvento",
                    tse.nmfuncao AS "FUNÇÃO",
                    tbf.nome AS "NOME",
                    tbf.pix AS "PIX",
                    jsonb_array_element_text(tse.datasevento, 0) AS "INÍCIO",
                    jsonb_array_element_text(tse.datasevento, jsonb_array_length(tse.datasevento) - 1) AS "TÉRMINO",
                    (
                        COALESCE(CASE WHEN tse.statusajustecusto = 'Autorizado' THEN tse.vlrajustecusto ELSE 0.00 END, 0.00) +
                        COALESCE(CASE WHEN tse.statuscaixinha = 'Autorizado' THEN tse.vlrcaixinha ELSE 0.00 END, 0.00)
                    ) AS "VLR ADICIONAL",
                    (COALESCE(tse.vlralmoco, 0) + COALESCE(tse.vlrjantar, 0) + COALESCE(tse.vlrtransporte, 0)) AS "VLR DIÁRIA",
                    jsonb_array_length(
                        (SELECT jsonb_agg(date_value) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value)
                         WHERE s.date_value::date >= $2::date AND s.date_value::date <= $3::date)
                    ) AS "QTD",
                    (COALESCE(tse.vlralmoco, 0) + COALESCE(tse.vlrjantar, 0) + COALESCE(tse.vlrtransporte, 0)) * jsonb_array_length(
                        (SELECT jsonb_agg(date_value) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value)
                         WHERE s.date_value::date >= $2::date AND s.date_value::date <= $3::date)
                    ) AS "TOTAL DIÁRIAS",
                    tse.statuspgto AS "STATUS PGTO"
                FROM
                    staffeventos tse
                JOIN
                    funcionarios tbf ON tse.idfuncionario = tbf.idfuncionario
                JOIN 
                    staffempresas semp ON tse.idstaff = semp.idstaff
                WHERE
                    semp.idempresa = $1 AND ${wherePeriodo}
                ORDER BY
                    tse.nmevento,
                    tse.nmcliente;
            `;
        } else if (tipo === 'cache') {
            queryFechamentoPrincipal = `
                SELECT
                    tse.idevento AS "idevento",
                    tse.nmevento AS "nomeEvento",
                    tse.nmfuncao AS "FUNÇÃO",
                    tbf.nome AS "NOME",
                    tbf.pix AS "PIX",
                    jsonb_array_element_text(tse.datasevento, 0) AS "INÍCIO",
                    jsonb_array_element_text(tse.datasevento, jsonb_array_length(tse.datasevento) - 1) AS "TÉRMINO",
                    (
                        COALESCE(CASE WHEN tse.statusajustecusto = 'Autorizado' THEN tse.vlrajustecusto ELSE 0.00 END, 0.00) +
                        COALESCE(CASE WHEN tse.statuscaixinha = 'Autorizado' THEN tse.vlrcaixinha ELSE 0.00 END, 0.00)
                    ) AS "VLR ADICIONAL",
                    COALESCE(tse.vlrcache, 0) AS "VLR DIÁRIA",
                    jsonb_array_length(
                        (SELECT jsonb_agg(date_value) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value)
                         WHERE s.date_value::date >= $2::date AND s.date_value::date <= $3::date)
                    ) AS "QTD",
                    COALESCE(tse.vlrcache, 0) * jsonb_array_length(
                        (SELECT jsonb_agg(date_value) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value)
                         WHERE s.date_value::date >= $2::date AND s.date_value::date <= $3::date)
                    ) AS "TOTAL DIÁRIAS",
                    tse.statuspgto AS "STATUS PGTO"
                FROM
                    staffeventos tse
                JOIN
                    funcionarios tbf ON tse.idfuncionario = tbf.idfuncionario
                JOIN 
                    staffempresas semp ON tse.idstaff = semp.idstaff
                WHERE
                    semp.idempresa = $1 AND ${wherePeriodo}
                ORDER BY
                    tse.nmevento,
                    tse.nmcliente;
            `;
        }

        // Parâmetros para fechamento principal
        const paramsFechamento = eventoEhTodos
            ? [idempresa, dataInicio, dataFim]
            : [idempresa, dataInicio, dataFim, evento];

        const resultFechamentoPrincipal = await pool.query(queryFechamentoPrincipal, paramsFechamento);
        const fechamentoCache = resultFechamentoPrincipal.rows; 
        relatorio.fechamentoCache = fechamentoCache;

        // --- CALCULA TOTAIS PARA FECHAMENTO CACHÊ / AJUDA DE CUSTO POR EVENTO ---
        const totaisPorEvento = {};
        fechamentoCache.forEach(item => {
            const eventoId = item.idevento;
            if (!totaisPorEvento[eventoId]) {
                totaisPorEvento[eventoId] = {
                    totalVlrAdicional: 0,
                    totalVlrDiarias:0,
                    totalTotalDiarias: 0
                };
            }
            totaisPorEvento[eventoId].totalVlrAdicional += parseFloat(item["VLR ADICIONAL"] || 0);
            totaisPorEvento[eventoId].totalVlrDiarias += parseFloat(item["VLR DIÁRIA"] || 0);
            totaisPorEvento[eventoId].totalTotalDiarias += parseFloat(item["TOTAL DIÁRIAS"] || 0);
        });
        relatorio.fechamentoCacheTotaisPorEvento = totaisPorEvento;

        // Utilização de Diárias (não filtra por evento)
        const queryUtilizacaoDiarias = `
            SELECT
                o.idevento,
                o.nrorcamento,
                oi.produto AS "INFORMAÇÕES EM PROPOSTA",
                SUM(oi.qtditens) AS "QTD PROFISSIONAIS",
                SUM(oi.qtddias) AS "DIÁRIAS CONTRATADAS",
                COALESCE(MAX(td.diarias_utilizadas_por_funcao), 0) AS "DIÁRIAS UTILIZADAS",
                SUM(oi.qtddias) - COALESCE(MAX(td.diarias_utilizadas_por_funcao), 0) AS "SALDO"
            FROM
                orcamentos o
            JOIN orcamentoitens oi ON oi.idorcamento = o.idorcamento
            JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
            LEFT JOIN (
                SELECT
                    tse.idevento,
                    tse.idcliente,
                    semp.idempresa,
                    tse.nmfuncao,
                    SUM(jsonb_array_length(
                        (SELECT jsonb_agg(date_value) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value)
                         WHERE s.date_value::date >= $2::date AND s.date_value::date <= $3::date)
                    )) AS diarias_utilizadas_por_funcao
                FROM
                    staffeventos tse
                JOIN staffempresas semp ON semp.idstaff = tse.idstaff
                WHERE
                    semp.idempresa = $1
                    AND EXISTS (
                        SELECT 1 FROM jsonb_array_elements_text(tse.datasevento) AS s_check(date_value_check)
                        WHERE s_check.date_value_check::date >= $2::date AND s_check.date_value_check::date <= $3::date
                    )
                GROUP BY
                    tse.idevento, tse.idcliente, semp.idempresa, tse.nmfuncao
            ) AS td ON td.idevento = o.idevento
                    AND td.idcliente = o.idcliente
                    AND td.idempresa = oe.idempresa
                    AND td.nmfuncao = oi.produto
            WHERE
                oe.idempresa = $1
                AND EXISTS (
                    SELECT 1
                    FROM staffeventos inner_tse
                    JOIN staffempresas inner_semp ON inner_semp.idstaff = inner_tse.idstaff AND inner_semp.idempresa = oe.idempresa
                    CROSS JOIN jsonb_array_elements_text(inner_tse.datasevento) AS inner_event_date
                    WHERE inner_tse.idevento = o.idevento
                    AND inner_tse.idcliente = o.idcliente
                    AND inner_event_date::date >= $2::date
                    AND inner_event_date::date <= $3::date
                )
            GROUP BY
                o.idevento,
                o.nrorcamento,
                oi.produto
            ORDER BY
                o.idevento,
                o.nrorcamento,
                oi.produto;
        `;
        const resultUtilizacaoDiarias = await pool.query(queryUtilizacaoDiarias, [idempresa, dataInicio, dataFim]);
        relatorio.utilizacaoDiarias = resultUtilizacaoDiarias.rows;

        // Contingência
        const paramsContingencia = eventoEhTodos
            ? [idempresa, dataInicio, dataFim]
            : [idempresa, dataInicio, dataFim, evento];

        const queryContingencia = `
            SELECT
                tse.idevento,
                tbf.nome AS "Profissional",
                'Diária Dobrada' AS "Informacao",
                tse.descdiariadobrada AS "Observacao"
            FROM
                staffeventos tse
            JOIN
                funcionarios tbf ON tse.idfuncionario = tbf.idfuncionario
            JOIN 
                staffempresas semp ON tse.idstaff = semp.idstaff
            WHERE
                semp.idempresa = $1 AND ${wherePeriodo}
                AND tse.dtdiariadobrada IS NOT NULL
            
            UNION ALL
            
            SELECT
                tse.idevento,
                tbf.nome AS "Profissional",
                'Meia Diária' AS "Informacao",
                tse.descmeiadiaria AS "Observacao"
            FROM
                staffeventos tse
            JOIN
                funcionarios tbf ON tse.idfuncionario = tbf.idfuncionario
            JOIN 
                staffempresas semp ON tse.idstaff = semp.idstaff
            WHERE
                semp.idempresa = $1 AND ${wherePeriodo}
                AND tse.dtmeiadiaria IS NOT NULL

            UNION ALL
            
            SELECT
                tse.idevento,
                tbf.nome AS "Profissional",
                'Ajuste de Custo' AS "Informacao",
                tse.descajustecusto AS "Observacao"
            FROM
                staffeventos tse
            JOIN
                funcionarios tbf ON tse.idfuncionario = tbf.idfuncionario
            JOIN 
                staffempresas semp ON tse.idstaff = semp.idstaff
            WHERE
                semp.idempresa = $1 AND ${wherePeriodo}
                AND tse.statusajustecusto = 'Autorizado' 
                AND tse.vlrajustecusto IS NOT NULL 
                AND tse.vlrajustecusto > 0

            UNION ALL
            
            SELECT
                tse.idevento,
                tbf.nome AS "Profissional",
                'Caixinha' AS "Informacao",
                tse.desccaixinha AS "Observacao"
            FROM
                staffeventos tse
            JOIN
                funcionarios tbf ON tse.idfuncionario = tbf.idfuncionario
            JOIN 
                staffempresas semp ON semp.idstaff = tse.idstaff
            WHERE
                semp.idempresa = $1 AND ${wherePeriodo}
                AND tse.statuscaixinha = 'Autorizado' 
                AND tse.vlrcaixinha IS NOT NULL 
                AND tse.vlrcaixinha > 0
            ORDER BY
                idevento, "Profissional", "Informacao";
        `;
        const resultContingencia = await pool.query(queryContingencia, paramsContingencia);
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