// const express = require("express");
// const router = express.Router();
// const pool = require("../db/conexaoDB"); // Seu pool de conexão com o PostgreSQL
// const { autenticarToken, contextoEmpresa } = require('../middlewares/authMiddlewares');
// const { verificarPermissao } = require('../middlewares/permissaoMiddleware');

// //verificarPermissao('Relatorios', 'pesquisar')
// // GET Relatório de Ajuda de Custo ou Cachê
// router.get("/", autenticarToken(), contextoEmpresa,
// verificarPermissao('Relatorios', 'pesquisar'), async (req, res) => {
//     console.log("ENTROU NA ROTA PARA RELATORIOS");
//     const { tipo, data } = req.query; 
//     const idempresa = req.idempresa;
    
//     if (!tipo || !data) {
//         return res.status(400).json({ error: 'Parâmetros tipo e data são obrigatórios.' });
//     }
    
//     const tiposPermitidos = ['ajuda_custo', 'cache'];
//     if (!tiposPermitidos.includes(tipo)) {
//         return res.status(400).json({ error: 'Tipo de relatório inválido.' });
//     }

//     try {
//         let queryText = '';
        
//         // Formata a data para ser um array de texto, compatível com a sua query @>
//         // Ex: '2025-07-30' se torna '{"2025-07-30"}'
//        const dataFormatadaParaJson = `[${JSON.stringify(data)}]`;
        
//         if (tipo === 'ajuda_custo') {
//             queryText = `
//                 SELECT
//                     tse.nmevento AS Evento,
//                     tbc.nmfantasia AS Cliente,
//                     CASE 
//                         WHEN tse.statuspgto = 'Pago' THEN '100%' 
//                         ELSE '0%' 
//                     END AS "Percentual Pgto",
//                     tbf.nome AS "Nome do Funcionario",
//                     tse.datasevento AS Periodo,
//                     CONCAT(bc.nmbanco, ' - ', tbf.agencia, ' - ', tbf.numeroconta, ' - ', tbf.tipoconta) AS "Dados Bancarios",
//                     (COALESCE(tse.vlralmoco, 0) + COALESCE(tse.vlrjantar, 0) + COALESCE(tse.vlrtransporte, 0)) AS "Valor Ajuda de Custo (dia)",
//                     jsonb_array_length(tse.datasevento) AS "Qtde Dias",
//                     (COALESCE(tse.vlralmoco, 0) + COALESCE(tse.vlrjantar, 0) + COALESCE(tse.vlrtransporte, 0)) * jsonb_array_length(tse.datasevento) AS "Total Ajuda de Custo",
//                     1 AS "Ordem"
//                 FROM
//                     staffeventos tse
//                 JOIN
//                     clientes tbc ON tse.idcliente = tbc.idcliente
//                 JOIN
//                     funcionarios tbf ON tse.idfuncionario = tbf.idfuncionario
//                 JOIN
//                     bancos bc ON tbf.codigobanco = bc.codbanco
//                 WHERE
//                     semp.idempresa = $1 AND tse.datasevento @> $2::jsonb
//             `;
//         } else if (tipo === 'cache') {
//             // Assumindo que a estrutura do cache é similar, mas com a coluna de valor
//             queryText = `
//                 SELECT
//                     tse.nmevento AS "Evento",
//                     tbc.nmfantasia AS "Cliente",
//                     CASE
//                         WHEN tse.statuspgto = 'Pago' THEN '100%'
//                         ELSE '0%'
//                     END AS "Percentual Pgto",
//                     tbf.nome AS "Nome do Funcionario",
//                     tse.datasevento AS "Periodo",
//                     CONCAT(bc.nmbanco, ' - ', tbf.agencia, ' - ', tbf.numeroconta, ' - ', tbf.tipoconta) AS "Dados Bancarios",
//                     tse.valorcache AS "Valor do Cachê"
//                 FROM
//                     staffeventos tse
//                 JOIN
//                     staffempresas semp ON tse.idstaff = semp.idstaff
//                 JOIN
//                     clientes tbc ON tse.idcliente = tbc.idcliente
//                 JOIN
//                     funcionarios tbf ON tse.idfuncionario = tbf.idfuncionario
//                 JOIN
//                     bancos bc ON tbf.codigobanco = bc.codbanco
//                 WHERE
//                     semp.idempresa = $1 AND tse.datasevento @> $2::jsonb
//             `;
//         }
        
//          const result = await pool.query(queryText, [idempresa, dataFormatadaParaJson]);
//         const reportData = result.rows;

//         if (reportData.length === 0) {
//             const totalRow = { "Evento": "TOTAL GERAL", "Cliente": "", "Percentual Pgto": "", "Nome do Funcionario": "", "Periodo": "", "Dados Bancarios": "" };
//             if (tipo === 'ajuda_custo') totalRow["Valor Ajuda de Custo"] = 0;
//             if (tipo === 'cache') totalRow["Valor do Cachê"] = 0;
//             return res.json([totalRow]);
//         }
        
//         let totalValue = 0;
//         if (tipo === 'ajuda_custo') {
//             totalValue = reportData.reduce((sum, item) => sum + item['Valor Ajuda de Custo'], 0);
//         } else { // 'cache'
//             totalValue = reportData.reduce((sum, item) => sum + item['Valor do Cachê'], 0);
//         }
        
//         const totalRow = {
//             "Evento": "TOTAL GERAL", "Cliente": "", "Percentual Pgto": "", "Nome do Funcionario": "", "Periodo": "", "Dados Bancarios": ""
//         };
//         if (tipo === 'ajuda_custo') totalRow["Valor Ajuda de Custo"] = totalValue;
//         if (tipo === 'cache') totalRow["Valor do Cachê"] = totalValue;
        
//         reportData.push(totalRow);
        
//         return res.json(reportData);
        
//     } catch (error) {
//         console.error("❌ Erro ao buscar relatório:", error);
//         return res.status(500).json({ error: error.message || "Erro ao gerar relatório" });
//     }
// });

// module.exports = router;


const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB"); // Seu pool de conexão com o PostgreSQL
const { autenticarToken, contextoEmpresa } = require('../middlewares/authMiddlewares');
const { verificarPermissao } = require('../middlewares/permissaoMiddleware');

router.get("/", autenticarToken(), contextoEmpresa,
verificarPermissao('Relatorios', 'pesquisar'), async (req, res) => {
    console.log("ENTROU NA ROTA PARA RELATORIOS");
    const { tipo, data } = req.query; 
    const idempresa = req.idempresa;
    
    if (!tipo || !data) {
        return res.status(400).json({ error: 'Parâmetros tipo e data são obrigatórios.' });
    }
    
    const tiposPermitidos = ['ajuda_custo', 'cache'];
    if (!tiposPermitidos.includes(tipo)) {
        return res.status(400).json({ error: 'Tipo de relatório inválido.' });
    }

    try {
        // Objeto para consolidar todos os resultados do relatório
        const relatorio = {};
        const dataFormatadaParaJson = `[${JSON.stringify(data)}]`;
        
        // **1. Query para a Seção Principal: FECHAMENTO CACHÊ**
        // A sua query já estava bem estruturada. Apenas a ajustamos para o layout da imagem.
        const queryFechamentoCache = `
            SELECT
                tse.nmevento AS "nomeEvento",
                tse.nmfuncao AS "FUNÇÃO",
                tbf.nome AS "NOME",
                tbf.pix AS "PIX",
                jsonb_array_element(tse.datasevento, 0) AS "INÍCIO",
                jsonb_array_element(tse.datasevento, jsonb_array_length(tse.datasevento) - 1) AS "TÉRMINO",
                (
                    COALESCE(CASE WHEN tse.statusajustecusto = 'Autorizado' THEN tse.vlrajustecusto ELSE 0 END, 0) +
                    COALESCE(CASE WHEN tse.statuscaixinha = 'Autorizado' THEN tse.vlrcaixinha ELSE 0 END, 0)
                ) AS "VLR ADICIONAL",
                (COALESCE(tse.vlralmoco, 0) + COALESCE(tse.vlrjantar, 0) + COALESCE(tse.vlrtransporte, 0)) AS "VLR DIÁRIA",
                jsonb_array_length(tse.datasevento) AS "QTD",
                (COALESCE(tse.vlralmoco, 0) + COALESCE(tse.vlrjantar, 0) + COALESCE(tse.vlrtransporte, 0)) * jsonb_array_length(tse.datasevento) AS "TOTAL DIÁRIAS",
                tse.statuspgto AS "STATUS PAGAMENTO"
            FROM
                staffeventos tse
            JOIN
                funcionarios tbf ON tse.idfuncionario = tbf.idfuncionario
            JOIN 
                staffempresas semp ON tse.idstaff = semp.idstaff
            WHERE
                semp.idempresa = $1 AND tse.datasevento @> $2::jsonb;
        `;
        const resultFechamentoCache = await pool.query(queryFechamentoCache, [idempresa, dataFormatadaParaJson]);
        relatorio.fechamentoCache = resultFechamentoCache.rows;
        
        // **2. Query para a Seção: RELATÓRIO UTILIZAÇÃO DE DIÁRIAS**
        // Esta query resume o uso de diárias e contratação. Você precisará ajustar a lógica de DIÁRIAS CONTRATADAS
        // para buscar da sua tabela de orçamentos se for o caso. O exemplo abaixo está com a lógica que você forneceu.
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
                semp.idempresa = $1 
                AND tse.datasevento @> $2::jsonb
            GROUP BY
                tse.nmfuncao;
        `;
        const resultUtilizacaoDiarias = await pool.query(queryUtilizacaoDiarias, [idempresa, dataFormatadaParaJson]);
        relatorio.utilizacaoDiarias = resultUtilizacaoDiarias.rows[0];
        
        // **3. Query para a Seção: CONTINGÊNCIA**
        // Esta query agrega os dados de contingência.
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
                semp.idempresa = $1 AND tse.datasevento @> $2::jsonb AND
                (tse.dtdiariadobrada IS NOT NULL OR tse.dtmeiadiaria IS NOT NULL);
        `;

        const resultContingencia = await pool.query(queryContingencia, [idempresa, dataFormatadaParaJson]);
        relatorio.contingencia = resultContingencia.rows[0];

        // **Retorna o objeto JSON completo com todas as seções**
        return res.json(relatorio);
        
    } catch (error) {
        console.error("❌ Erro ao buscar relatório:", error);
        return res.status(500).json({ error: error.message || "Erro ao gerar relatório" });
    }
});

module.exports = router;