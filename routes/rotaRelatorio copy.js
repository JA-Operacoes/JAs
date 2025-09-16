const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB"); // Seu pool de conexão com o PostgreSQL
const { autenticarToken, contextoEmpresa } = require('../middlewares/authMiddlewares');
const { verificarPermissao } = require('../middlewares/permissaoMiddleware');

router.get("/", autenticarToken(), contextoEmpresa,
verificarPermissao('Relatorios', 'pesquisar'), async (req, res) => {
    console.log("ENTROU NA ROTA PARA RELATORIOS");
    const { tipo, dataInicio, dataFim } = req.query; 
    const idempresa = req.idempresa;
    
    if (!tipo || !dataInicio || !dataFim) {
        return res.status(400).json({ error: 'Parâmetros tipo, dataInicio e dataFim são obrigatórios.' });
    }
    
    const tiposPermitidos = ['ajuda_custo', 'cache'];
    if (!tiposPermitidos.includes(tipo)) {
        return res.status(400).json({ error: 'Tipo de relatório inválido.' });
    }

    try {
        const relatorio = {};

        // Condição WHERE para o período de datas.
        const wherePeriodo = `
            EXISTS (
                SELECT 1
                FROM jsonb_array_elements_text(tse.datasevento) AS event_date
                WHERE event_date::date >= $2::date
                AND event_date::date <= $3::date
            )`;
        
        // **1. Query para a Seção Principal: FECHAMENTO CACHÊ**
        // const queryFechamentoCache = `
        //     SELECT
        //         tse.idevento AS "idevento",
        //         tse.nmevento AS "nomeEvento",
        //         tse.nmfuncao AS "FUNÇÃO",
        //         tbf.nome AS "NOME",
        //         tbf.pix AS "PIX",
        //         jsonb_array_element(tse.datasevento, 0) AS "INÍCIO",
        //         jsonb_array_element(tse.datasevento, jsonb_array_length(tse.datasevento) - 1) AS "TÉRMINO",
        //         (
        //             COALESCE(CASE WHEN tse.statusajustecusto = 'Autorizado' THEN tse.vlrajustecusto ELSE 0.00 END, 0.00) +
        //             COALESCE(CASE WHEN tse.statuscaixinha = 'Autorizado' THEN tse.vlrcaixinha ELSE 0.00 END, 0.00)
        //         ) AS "VLR ADICIONAL",
        //         (COALESCE(tse.vlralmoco, 0) + COALESCE(tse.vlrjantar, 0) + COALESCE(tse.vlrtransporte, 0)) AS "VLR DIÁRIA",
        //         jsonb_array_length(tse.datasevento) AS "QTD",
        //         (COALESCE(tse.vlralmoco, 0) + COALESCE(tse.vlrjantar, 0) + COALESCE(tse.vlrtransporte, 0)) * jsonb_array_length(tse.datasevento) AS "TOTAL DIÁRIAS",
        //         tse.statuspgto AS "STATUS PGTO"
        //     FROM
        //         staffeventos tse
        //     JOIN
        //         funcionarios tbf ON tse.idfuncionario = tbf.idfuncionario
        //     JOIN 
        //         staffempresas semp ON tse.idstaff = semp.idstaff
        //     WHERE
        //         semp.idempresa = $1 AND ${wherePeriodo}
        //     ORDER BY
        //         tse.nmevento,
        //         tse.nmcliente;
        // `;
        // const resultFechamentoCache = await pool.query(queryFechamentoCache, [idempresa, dataInicio, dataFim]);
        // relatorio.fechamentoCache = resultFechamentoCache.rows;        
   
        // const queryUtilizacaoDiarias = `
        //     SELECT
        //         o.idevento,
        //         o.nrorcamento,
        //         oi.produto AS "INFORMAÇÕES EM PROPOSTA",
        //         SUM(oi.qtditens) AS "QTD PROFISSIONAIS",
        //         SUM(oi.qtddias) AS "DIÁRIAS CONTRATADAS",
        //         -- Usamos MAX() ou MIN() porque td.diarias_utilizadas_por_funcao já é o total para aquela função.
        //         -- SUM() estava duplicando esse valor se houvesse múltiplos orcamentoitens com o mesmo produto.
        //         COALESCE(MAX(td.diarias_utilizadas_por_funcao), 0) AS "DIÁRIAS UTILIZADAS",
        //         -- Saldo: Contratadas - Utilizadas
        //         SUM(oi.qtddias) - COALESCE(MAX(td.diarias_utilizadas_por_funcao), 0) AS "SALDO"
        //     FROM
        //         orcamentos o
        //     JOIN orcamentoitens oi ON oi.idorcamento = o.idorcamento
        //     JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
        //     LEFT JOIN (
        //         SELECT
        //             tse.idevento,
        //             tse.idcliente,
        //             semp.idempresa,
        //             tse.nmfuncao,
        //             -- A lógica aqui está correta para somar as QTDs (diárias) dos staffeventos por função
        //             SUM(jsonb_array_length(
        //                 (SELECT jsonb_agg(date_value) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value)
        //                 WHERE s.date_value::date >= $2::date AND s.date_value::date <= $3::date)
        //             )) AS diarias_utilizadas_por_funcao
        //         FROM
        //             staffeventos tse
        //         JOIN staffempresas semp ON semp.idstaff = tse.idstaff
        //         WHERE
        //             semp.idempresa = $1
        //             AND EXISTS (
        //                 SELECT 1 FROM jsonb_array_elements_text(tse.datasevento) AS s_check(date_value_check)
        //                 WHERE s_check.date_value_check::date >= $2::date AND s_check.date_value_check::date <= $3::date
        //             )
        //         GROUP BY
        //             tse.idevento, tse.idcliente, semp.idempresa, tse.nmfuncao
        //     ) AS td ON td.idevento = o.idevento
        //             AND td.idcliente = o.idcliente
        //             AND td.idempresa = oe.idempresa
        //             AND td.nmfuncao = oi.produto
        //     WHERE
        //         oe.idempresa = $1
        //         AND EXISTS (
        //             SELECT 1
        //             FROM staffeventos inner_tse
        //             JOIN staffempresas inner_semp ON inner_semp.idstaff = inner_tse.idstaff AND inner_semp.idempresa = oe.idempresa
        //             CROSS JOIN jsonb_array_elements_text(inner_tse.datasevento) AS inner_event_date
        //             WHERE inner_tse.idevento = o.idevento
        //             AND inner_tse.idcliente = o.idcliente
        //             AND inner_event_date::date >= $2::date
        //             AND inner_event_date::date <= $3::date
        //         )
        //     GROUP BY
        //         o.idevento,
        //         o.nrorcamento,
        //         oi.produto
        //     ORDER BY
        //         o.idevento,
        //         o.nrorcamento,
        //         oi.produto;
        // `;

        // const resultUtilizacaoDiarias = await pool.query(queryUtilizacaoDiarias, [idempresa, dataInicio, dataFim]);
        // console.log(resultUtilizacaoDiarias.rows);
        // // Alteração: Retorna o array completo
        // relatorio.utilizacaoDiarias = resultUtilizacaoDiarias.rows;
        // console.log("SELECT UTILZACAODIARIAS",queryUtilizacaoDiarias);
        // // **3. Query para a Seção: CONTINGÊNCIA**
        // const queryContingencia = `
        //     SELECT
        //         tse.idevento,
        //         tbf.nome AS "Profissional",
        //         'Diária Dobrada' AS "Informacao",
        //         tse.descdiariadobrada AS "Observacao"
        //     FROM
        //         staffeventos tse
        //     JOIN
        //         funcionarios tbf ON tse.idfuncionario = tbf.idfuncionario
        //     JOIN 
        //         staffempresas semp ON tse.idstaff = semp.idstaff
        //     WHERE
        //         semp.idempresa = $1 AND ${wherePeriodo}
        //         AND tse.dtdiariadobrada IS NOT NULL
            
        //     UNION ALL
            
        //     SELECT
        //         tse.idevento,
        //         tbf.nome AS "Profissional",
        //         'Meia Diária' AS "Informacao",
        //         tse.descmeiadiaria AS "Observacao"
        //     FROM
        //         staffeventos tse
        //     JOIN
        //         funcionarios tbf ON tse.idfuncionario = tbf.idfuncionario
        //     JOIN 
        //         staffempresas semp ON tse.idstaff = semp.idstaff
        //     WHERE
        //         semp.idempresa = $1 AND ${wherePeriodo}
        //         AND tse.dtmeiadiaria IS NOT NULL

        //     UNION ALL
            
        //     SELECT
        //         tse.idevento,
        //         tbf.nome AS "Profissional",
        //         'Ajuste de Custo' AS "Informacao",
        //         tse.descajustecusto AS "Observacao"
        //     FROM
        //         staffeventos tse
        //     JOIN
        //         funcionarios tbf ON tse.idfuncionario = tbf.idfuncionario
        //     JOIN 
        //         staffempresas semp ON tse.idstaff = semp.idstaff
        //     WHERE
        //         semp.idempresa = $1 AND ${wherePeriodo}
        //         AND tse.statusajustecusto = 'Autorizado' 
        //         AND tse.vlrajustecusto IS NOT NULL 
        //         AND tse.vlrajustecusto > 0

        //     UNION ALL
            
        //     SELECT
        //         tse.idevento,
        //         tbf.nome AS "Profissional",
        //         'Caixinha' AS "Informacao",
        //         tse.desccaixinha AS "Observacao"
        //     FROM
        //         staffeventos tse
        //     JOIN
        //         funcionarios tbf ON tse.idfuncionario = tbf.idfuncionario
        //     JOIN 
        //         staffempresas semp ON semp.idstaff = tse.idstaff
        //     WHERE
        //         semp.idempresa = $1 AND ${wherePeriodo}
        //         AND tse.statuscaixinha = 'Autorizado' 
        //         AND tse.vlrcaixinha IS NOT NULL 
        //         AND tse.vlrcaixinha > 0
        //     ORDER BY
        //         idevento, "Profissional", "Informacao";
        // `;
        // const resultContingencia = await pool.query(queryContingencia, [idempresa, dataInicio, dataFim]);
        // relatorio.contingencia = resultContingencia.rows;

        let queryFechamentoPrincipal = ''; // Variável para armazenar a query principal
        
        // **LÓGICA CONDICIONAL PARA O TIPO DE RELATÓRIO PRINCIPAL**
        if (tipo === 'ajuda_custo') {
            // Query para "Ajuda de Custo" (usa vlrAlmoco, vlrJantar, vlrTransporte)
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
            // Query para "Fechamento de Cachê" (usa vlrCache)
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
                    COALESCE(tse.vlrcache, 0) AS "VLR DIÁRIA", -- Usa vlrcache aqui
                    jsonb_array_length(
                        (SELECT jsonb_agg(date_value) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value)
                         WHERE s.date_value::date >= $2::date AND s.date_value::date <= $3::date)
                    ) AS "QTD",
                    COALESCE(tse.vlrcache, 0) * jsonb_array_length(
                        (SELECT jsonb_agg(date_value) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value)
                         WHERE s.date_value::date >= $2::date AND s.date_value::date <= $3::date)
                    ) AS "TOTAL DIÁRIAS", -- Calcula com vlrcache
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

        const resultFechamentoPrincipal = await pool.query(queryFechamentoPrincipal, [idempresa, dataInicio, dataFim]);
        relatorio.fechamentoCache = resultFechamentoPrincipal.rows; 
        
        // --- CALCULA TOTAIS PARA FECHAMENTO CACHÊ / AJUDA DE CUSTO POR EVENTO ---
        const totaisPorEvento = {};

        relatorio.fechamentoCache.forEach(item => {
            const eventoId = item.idevento;
            if (!totaisPorEvento[eventoId]) {
                totaisPorEvento[eventoId] = {
                    totalVlrAdicional: 0,
                    totalVlrDiarias:0,
                    totalTotalDiarias: 0
                    // Aqui não somamos "VLR DIÁRIA" (que é o valor unitário),
                    // mas sim "TOTAL DIÁRIAS" que já é VLR_UNITARIO * QTD
                };
            }
            totaisPorEvento[eventoId].totalVlrAdicional += parseFloat(item["VLR ADICIONAL"] || 0);
            totaisPorEvento[eventoId].totalVlrDiarias += parseFloat(item["VLR DIÁRIA"] || 0);
            totaisPorEvento[eventoId].totalTotalDiarias += parseFloat(item["TOTAL DIÁRIAS"] || 0);
        });

        // Adiciona os totais calculados por evento ao objeto de relatório
        relatorio.fechamentoCacheTotaisPorEvento = totaisPorEvento;


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
        const resultContingencia = await pool.query(queryContingencia, [idempresa, dataInicio, dataFim]);
        relatorio.contingencia = resultContingencia.rows;

        return res.json(relatorio);
        
    } catch (error) {
        console.error("❌ Erro ao buscar relatório:", error);
        // O cliente agora receberá uma resposta de erro JSON completa, o que facilitará a depuração
        return res.status(500).json({ error: error.message || "Erro ao gerar relatório" });
    }
});

module.exports = router;