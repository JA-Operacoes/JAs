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
            ) AND tse.idevento = $4
        `;          

        let queryFechamentoPrincipal = ''; // Variável para armazenar a query principal
        
        // **LÓGICA CONDICIONAL PARA O TIPO DE RELATÓRIO PRINCIPAL**
        if (tipo === 'ajuda_custo') {
            queryFechamentoPrincipal = `
                SELECT
                    tse.idevento AS "idevento",
                    tse.nmevento AS "nomeEvento",
                    tse.nmfuncao AS "FUNÇÃO",
                    tbf.nome AS "NOME",
                    tbf.pix AS "PIX",
                    --jsonb_array_element_text(tse.datasevento, 0) AS "INÍCIO",
                    --jsonb_array_element_text(tse.datasevento, jsonb_array_length(tse.datasevento) - 1) AS "TÉRMINO",
                    (SELECT MIN(date_value::date) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value) WHERE s.date_value::date >= $2::date AND s.date_value::date <= $3::date)::text AS "INÍCIO",
                    (SELECT MAX(date_value::date) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value) WHERE s.date_value::date >= $2::date AND s.date_value::date <= $3::date)::text AS "TÉRMINO",
                    --(
                    --    COALESCE(CASE WHEN tse.statusajustecusto = 'Autorizado' THEN tse.vlrajustecusto ELSE 0.00 END, 0.00) +
                    --    COALESCE(CASE WHEN tse.statuscaixinha = 'Autorizado' THEN tse.vlrcaixinha ELSE 0.00 END, 0.00)
                    --) AS "VLR ADICIONAL",
                    0 AS "VLR ADICIONAL",
                    (COALESCE(tse.vlralmoco, 0) + COALESCE(tse.vlralimentacao, 0) + COALESCE(tse.vlrtransporte, 0)) AS "VLR DIÁRIA",
                    jsonb_array_length(
                        (SELECT jsonb_agg(date_value) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value)
                         WHERE s.date_value::date >= $2::date AND s.date_value::date <= $3::date)
                    ) AS "QTD",
                    (COALESCE(tse.vlralmoco, 0) + COALESCE(tse.vlralimentacao, 0) + COALESCE(tse.vlrtransporte, 0)) * jsonb_array_length(
                        (SELECT jsonb_agg(date_value) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value)
                         WHERE s.date_value::date >= $2::date AND s.date_value::date <= $3::date)
                    ) AS "TOT DIÁRIAS",
                    --tse.statuspgto AS "STATUS PGTO"
                    CASE
                        WHEN tse.comppgtoajdcusto IS NOT NULL AND tse.comppgtoajdcusto != '' THEN 'Pago 100%'
                        WHEN tse.comppgtoajdcusto50 IS NOT NULL AND tse.comppgtoajdcusto50 != '' THEN 'Pago 50%'
                        ELSE tse.statuspgto
                    END AS "STATUS PGTO"
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
            // Query para "Fechamento de Cachê" (usa vlrCache)            
            queryFechamentoPrincipal = `
                WITH diarias_autorizadas AS (
                    SELECT
                        tse.idstaffevento,
                        (SELECT COUNT(*) FROM jsonb_to_recordset(tse.dtdiariadobrada) AS d(data text, status text) WHERE d.status = 'Autorizado') AS qtd_diarias_dobradas_autorizadas,
                        (SELECT COUNT(*) FROM jsonb_to_recordset(tse.dtmeiadiaria) AS m(data text, status text) WHERE m.status = 'Autorizado') AS qtd_meias_diarias_autorizadas
                    FROM
                        staffeventos tse
                    JOIN
                        staffempresas semp ON tse.idstaff = semp.idstaff
                    WHERE
                        semp.idempresa = $1 AND ${wherePeriodo}
                        -- AND EXISTS (
                        --     SELECT 1
                        --     FROM jsonb_array_elements_text(tse.datasevento) AS event_date
                        --     WHERE event_date::date >= $2::date AND event_date::date <= $3::date
                        -- )
                )
                SELECT
                    "idevento",
                    "nomeEvento",
                    "FUNÇÃO",
                    "NOME",
                    "PIX",
                    "INÍCIO",
                    "TÉRMINO",
                    "VLR ADICIONAL",
                    "VLR DIÁRIA",
                    "QTD",
                    "TOT DIÁRIAS",
                    CAST(("TOT DIÁRIAS" + "VLR ADICIONAL") AS NUMERIC(10, 2)) AS "TOTAL GERAL",
                    "STATUS PGTO",
                    "TOT PAGAR"
                FROM
                    (
                    SELECT
                        tse.idevento AS "idevento",
                        tse.nmevento AS "nomeEvento",
                        tse.nmfuncao AS "FUNÇÃO",
                        tbf.nome AS "NOME",
                        tbf.pix AS "PIX",
                        jsonb_array_element_text(tse.datasevento, 0) AS "INÍCIO",
                        jsonb_array_element_text(tse.datasevento, jsonb_array_length(tse.datasevento) - 1) AS "TÉRMINO",
                        CAST(
                            (
                                COALESCE(CASE WHEN tse.statusajustecusto = 'Autorizado' THEN tse.vlrajustecusto ELSE 0.00 END, 0.00) +
                                COALESCE(CASE WHEN tse.statuscaixinha = 'Autorizado' THEN tse.vlrcaixinha ELSE 0.00 END, 0.00) +
                                (COALESCE(tse.vlrcache, 0) + COALESCE(tse.vlralmoco, 0) + COALESCE(tse.vlralimentacao, 0)) * COALESCE(da.qtd_diarias_dobradas_autorizadas, 0) +
                                ((COALESCE(tse.vlrcache, 0) / 2) + COALESCE(tse.vlralimentacao, 0)) * COALESCE(da.qtd_meias_diarias_autorizadas, 0)
                            ) AS NUMERIC(10, 2)
                        ) AS "VLR ADICIONAL",
                        COALESCE(tse.vlrcache, 0) AS "VLR DIÁRIA",
                        jsonb_array_length(
                            (SELECT jsonb_agg(date_value) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value)
                            WHERE s.date_value::date >= $2::date AND s.date_value::date <= $3::date)
                        ) AS "QTD",
                        (COALESCE(tse.vlrcache, 0) * jsonb_array_length(
                            (SELECT jsonb_agg(date_value) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value)
                            WHERE s.date_value::date >= $2::date AND s.date_value::date <= $3::date)
                        )) AS "TOT DIÁRIAS",
                        CASE
                            WHEN tse.comppgtoajdcusto IS NOT NULL AND tse.comppgtoajdcusto != '' THEN 'Pago 100%'
                            WHEN tse.comppgtoajdcusto50 IS NOT NULL AND tse.comppgtoajdcusto50 != '' THEN 'Pago 50%'
                            ELSE tse.statuspgto
                        END AS "STATUS PGTO",
                        CASE
                            WHEN (tse.comppgtoajdcusto50 IS NOT NULL AND tse.comppgtoajdcusto50 != '') AND (tse.comppgtoajdcusto IS NULL OR tse.comppgtoajdcusto = '') 
                                THEN ((COALESCE(tse.vlrcache, 0) * jsonb_array_length( (SELECT jsonb_agg(date_value) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value)
                                    WHERE s.date_value::date >= $2::date AND s.date_value::date <= $3::date) )) + CAST( (COALESCE(CASE WHEN tse.statusajustecusto = 'Autorizado' 
                                        THEN tse.vlrajustecusto ELSE 0.00 END, 0.00) + COALESCE(CASE WHEN tse.statuscaixinha = 'Autorizado' 
                                        THEN tse.vlrcaixinha ELSE 0.00 END, 0.00) + (COALESCE(tse.vlrcache, 0) + COALESCE(tse.vlralimentacao, 0)) * COALESCE(da.qtd_diarias_dobradas_autorizadas, 0) + ((COALESCE(tse.vlrcache, 0) / 2) + COALESCE(tse.vlralimentacao, 0)) * COALESCE(da.qtd_meias_diarias_autorizadas, 0) ) AS NUMERIC(10, 2)) ) * 0.50
                            WHEN (tse.comppgtoajdcusto IS NULL OR tse.comppgtoajdcusto = '') AND (tse.comppgtoajdcusto50 IS NULL OR tse.comppgtoajdcusto50 = '') 
                                THEN ((COALESCE(tse.vlrcache, 0) * jsonb_array_length( (SELECT jsonb_agg(date_value) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value) 
                                    WHERE s.date_value::date >= $2::date AND s.date_value::date <= $3::date) )) + CAST( (COALESCE(CASE WHEN tse.statusajustecusto = 'Autorizado' 
                                       THEN tse.vlrajustecusto ELSE 0.00 END, 0.00) + COALESCE(CASE WHEN tse.statuscaixinha = 'Autorizado' 
                                       THEN tse.vlrcaixinha ELSE 0.00 END, 0.00) + (COALESCE(tse.vlrcache, 0) + COALESCE(tse.vlralimentacao, 0)) * COALESCE(da.qtd_diarias_dobradas_autorizadas, 0) + ((COALESCE(tse.vlrcache, 0) / 2) + COALESCE(tse.vlralimentacao, 0)) * COALESCE(da.qtd_meias_diarias_autorizadas, 0) ) AS NUMERIC(10, 2)) )
                            ELSE 0.00
                        END AS "TOT PAGAR"
                    FROM
                        staffeventos tse
                    JOIN
                        funcionarios tbf ON tse.idfuncionario = tbf.idfuncionario
                    JOIN
                        staffempresas semp ON tse.idstaff = semp.idstaff
                    JOIN
                        diarias_autorizadas da ON tse.idstaffevento = da.idstaffevento
                    WHERE
                        semp.idempresa = $1 AND ${wherePeriodo}
                    ) AS subquery
                ORDER BY
                    "nomeEvento",
                    "NOME";
            `;
        }

        const resultFechamentoPrincipal = await pool.query(queryFechamentoPrincipal, [idempresa, dataInicio, dataFim, evento]);
       // relatorio.fechamentoCache = resultFechamentoPrincipal.rows; 
         relatorio.fechamentoCache = resultFechamentoPrincipal.rows.map(item => {
            if (item.datasevento && typeof item.datasevento === 'string') {
                try {
                    // 1. Converte a string JSON para um array JavaScript
                    const datasArray = JSON.parse(item.datasevento);
                    
                    // 2. Filtra e ordena as datas
                    // Filtra para garantir que são strings de data válidas antes de ordenar
                    const datasOrdenadas = datasArray
                        .filter(dateStr => /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) // Regex simples para 'YYYY-MM-DD'
                        .sort((a, b) => new Date(a) - new Date(b)); // Ordena em ordem crescente

                    item.datasevento = JSON.stringify(datasOrdenadas); // Opcional: converte de volta para JSON string
                                                                       // Ou você pode deixar como array de JS
                } catch (e) {
                    console.error("Erro ao fazer parse ou ordenar datasevento:", e, item.datasevento);
                    // Deixa como estava se houver erro ou seta para um default
                    item.datasevento = '[]'; 
                }
            }
            return item;
        });
        
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
                    totalTotalDiarias: 0,
                    totalTotalPagar: 0
                };
            }
            totaisPorEvento[eventoId].totalVlrAdicional += parseFloat(item["VLR ADICIONAL"] || 0);
            totaisPorEvento[eventoId].totalVlrDiarias += parseFloat(item["VLR DIÁRIA"] || 0);
            totaisPorEvento[eventoId].totalTotalDiarias += parseFloat(item["TOT DIÁRIAS"] || 0);
            totaisPorEvento[eventoId].totalTotalPagar += parseFloat(item["TOT PAGAR"] || 0);
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