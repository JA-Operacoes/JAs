const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB"); // Seu pool de conexão com o PostgreSQL
const { autenticarToken, contextoEmpresa } = require('../middlewares/authMiddlewares');
const { verificarPermissao } = require('../middlewares/permissaoMiddleware');

//verificarPermissao('Relatorios', 'pesquisar')
// GET Relatório de Ajuda de Custo ou Cachê
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
        let queryText = '';
        
        // Formata a data para ser um array de texto, compatível com a sua query @>
        // Ex: '2025-07-30' se torna '{"2025-07-30"}'
       const dataFormatadaParaJson = `[${JSON.stringify(data)}]`;
        
        if (tipo === 'ajuda_custo') {
            queryText = `
                SELECT
                    tse.nmevento AS "Evento",
                    tbc.nmfantasia AS "Cliente",
                    CASE
                        WHEN tse.statuspgto = 'Pago' THEN '100%'
                        ELSE '0%'
                    END AS "Percentual Pgto",
                    tbf.nome AS "Nome do Funcionario",
                    tse.datasevento AS "Periodo",
                    CONCAT(bc.nmbanco, ' - ', tbf.agencia, ' - ', tbf.numeroconta, ' - ', tbf.tipoconta) AS "Dados Bancarios",
                    COALESCE(tse.vlralmoco, 0) + COALESCE(tse.vlrjantar, 0) + COALESCE(tse.vlrtransporte, 0) AS "Valor Ajuda de Custo"
                FROM
                    staffeventos tse
                JOIN
                    staffempresas semp ON tse.idstaff = semp.idstaff
                JOIN
                    clientes tbc ON tse.idcliente = tbc.idcliente
                JOIN
                    funcionarios tbf ON tse.idfuncionario = tbf.idfuncionario
                JOIN
                    bancos bc ON tbf.codigobanco = bc.codbanco
                WHERE
                    semp.idempresa = $1 AND tse.datasevento @> $2::jsonb
            `;
        } else if (tipo === 'cache') {
            // Assumindo que a estrutura do cache é similar, mas com a coluna de valor
            queryText = `
                SELECT
                    tse.nmevento AS "Evento",
                    tbc.nmfantasia AS "Cliente",
                    CASE
                        WHEN tse.statuspgto = 'Pago' THEN '100%'
                        ELSE '0%'
                    END AS "Percentual Pgto",
                    tbf.nome AS "Nome do Funcionario",
                    tse.datasevento AS "Periodo",
                    CONCAT(bc.nmbanco, ' - ', tbf.agencia, ' - ', tbf.numeroconta, ' - ', tbf.tipoconta) AS "Dados Bancarios",
                    tse.valorcache AS "Valor do Cachê"
                FROM
                    staffeventos tse
                JOIN
                    staffempresas semp ON tse.idstaff = semp.idstaff
                JOIN
                    clientes tbc ON tse.idcliente = tbc.idcliente
                JOIN
                    funcionarios tbf ON tse.idfuncionario = tbf.idfuncionario
                JOIN
                    bancos bc ON tbf.codigobanco = bc.codbanco
                WHERE
                    semp.idempresa = $1 AND tse.datasevento @> $2::jsonb
            `;
        }
        
         const result = await pool.query(queryText, [idempresa, dataFormatadaParaJson]);
        const reportData = result.rows;

        if (reportData.length === 0) {
            const totalRow = { "Evento": "TOTAL GERAL", "Cliente": "", "Percentual Pgto": "", "Nome do Funcionario": "", "Periodo": "", "Dados Bancarios": "" };
            if (tipo === 'ajuda_custo') totalRow["Valor Ajuda de Custo"] = 0;
            if (tipo === 'cache') totalRow["Valor do Cachê"] = 0;
            return res.json([totalRow]);
        }
        
        let totalValue = 0;
        if (tipo === 'ajuda_custo') {
            totalValue = reportData.reduce((sum, item) => sum + item['Valor Ajuda de Custo'], 0);
        } else { // 'cache'
            totalValue = reportData.reduce((sum, item) => sum + item['Valor do Cachê'], 0);
        }
        
        const totalRow = {
            "Evento": "TOTAL GERAL", "Cliente": "", "Percentual Pgto": "", "Nome do Funcionario": "", "Periodo": "", "Dados Bancarios": ""
        };
        if (tipo === 'ajuda_custo') totalRow["Valor Ajuda de Custo"] = totalValue;
        if (tipo === 'cache') totalRow["Valor do Cachê"] = totalValue;
        
        reportData.push(totalRow);
        
        return res.json(reportData);
        
    } catch (error) {
        console.error("❌ Erro ao buscar relatório:", error);
        return res.status(500).json({ error: error.message || "Erro ao gerar relatório" });
    }
});

module.exports = router;