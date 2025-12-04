const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB");
const { autenticarToken, contextoEmpresa } = require('../middlewares/authMiddlewares');
const { verificarPermissao } = require('../middlewares/permissaoMiddleware');

router.get("/", autenticarToken(), contextoEmpresa,
verificarPermissao('Relatorios', 'pesquisar'), async (req, res) => {
    console.log("ENTROU NA ROTA PARA RELATORIOS", req.query);
    const { tipo, dataInicio, dataFim, evento, cliente, equipe, pendentes, pagos} = req.query;
    //const fasesSelecionadas = fases ? fases.split(',').map(f => f.trim()) : [];

    const idempresa = req.idempresa;
    const eventoEhTodos = !evento || evento === "todos";  
    
    // 2. Validações
    if (!tipo || !dataInicio || !dataFim ) {
        return res.status(400).json({ error: 'Parâmetros tipo, dataInicio, dataFim e evento são obrigatórios.' });
    }
    
    const tiposPermitidos = ['ajuda_custo', 'cache'];
    if (!tiposPermitidos.includes(tipo)) {
        return res.status(400).json({ error: 'Tipo de relatório inválido.' });
    }
    
    let phaseFilterSql = `s.date_value::date >= $2::date AND s.date_value::date <= $3::date`; // Filtro interno das subqueries de staff (s.date_value::date ...)

    const whereEventos = `
        AND CASE
            -- 1. Se o período de busca for de UM ÚNICO DIA ($2 = $3)
            WHEN $2::date = $3::date THEN
                (
                    -- Verifica se a data exata existe
                    tse.datasevento ? $2::text 
                    AND 
                    -- E verifica se o evento tem APENAS um dia
                    jsonb_array_length(tse.datasevento) = 1
                )
            
            -- 2. Se o período de busca for de MÚLTIPLOS DIAS ($2 != $3)
            ELSE
                -- Verifica se o array de datas do evento é EXATAMENTE igual ao array de datas gerado
                NOT EXISTS (
                SELECT 1
                FROM jsonb_array_elements_text(tse.datasevento) AS event_date
                WHERE event_date::date < $2::date OR event_date::date > $3::date
            )
        END
    `;

  
    let wherePeriodo = whereEventos;        
    

    try {
        const relatorio = {};

        let paramCount = 4; // Começa a contagem para os parâmetros dinâmicos
        const params = [idempresa, dataInicio, dataFim];
        
        // Aplica o filtro de Evento (tem prioridade máxima sobre o filtro de fase/período)
        if (evento && evento !== "todos") {
            wherePeriodo += ` AND tse.idevento = $${paramCount}`;
            params.push(evento);
            paramCount++;
        }
        // REMOVIDO: Bloco 'else if (whereEventosFase)' não é mais necessário

        if (cliente && cliente !== "todos") {
            wherePeriodo += ` AND tse.idcliente = $${paramCount}`;
            params.push(cliente);
            paramCount++;
        }

        if (equipe && equipe !== "todos") {
            wherePeriodo += ` AND tse.idequipe = $${paramCount}`;
            params.push(equipe);
            paramCount++; // Incrementa o contador para o próximo parâmetro
        }

        console.log("ATENÇÃO PAGOS/PENDENTES",pagos, pendentes)

        let whereStatus = '';
        const incluirPendentes = pendentes === 'true';
        const incluirPagos = pagos === 'true';

        if (incluirPendentes || incluirPagos) {
            let statusConditions = [];

            if (tipo === 'ajuda_custo') {
            // Filtro de Ajuda de Custo usa comppgtoajdcusto (100%) e comppgtoajdcusto50 (50%)
                if (incluirPagos) {
            // Pago: Se houver comprovante de 100% OU 50%
                    statusConditions.push(`(tse.comppgtoajdcusto IS NOT NULL AND tse.comppgtoajdcusto != '') OR (tse.comppgtoajdcusto50 IS NOT NULL AND tse.comppgtoajdcusto50 != '')`);
                }
                if (incluirPendentes) {
            // Pendente: Se NÃO houver comprovante de 100% E NÃO houver de 50%
                    statusConditions.push(`(tse.comppgtoajdcusto IS NULL OR tse.comppgtoajdcusto = '') AND (tse.comppgtoajdcusto50 IS NULL OR tse.comppgtoajdcusto50 = '')`);
                }
            } else if (tipo === 'cache') {
                    // CORREÇÃO: Forçar a conversão para TEXT (::TEXT) antes do TRIM().
                // Isso resolve o erro "função pg_catalog.btrim(numeric) não existe".
                const vlrcaixinhaNumericoSeguro = `CAST(COALESCE(NULLIF(TRIM(tse.vlrcaixinha::TEXT), ''), '0') AS NUMERIC)`;
                
                // Condição para vlrcaixinha ser "Devido" (Valor > 0)
                const vlrcaixinhaDevido = `(${vlrcaixinhaNumericoSeguro} > 0)`;
                // Condição para vlrcaixinha ser "Não Devido" (Valor <= 0 ou vazio/nulo/com espaços)
                const vlrcaixinhaNaoDevido = `(${vlrcaixinhaNumericoSeguro} <= 0)`;

                const comprovanteCachePreenchido = `(tse.comppgtocache IS NOT NULL AND tse.comppgtocache != '')`;
                const comprovanteCachePendente = `(tse.comppgtocache IS NULL OR tse.comppgtocache = '')`;
                
                const comprovanteCaixinhaPreenchido = `(tse.comppgtocaixinha IS NOT NULL AND tse.comppgtocaixinha != '')`;
                const comprovanteCaixinhaPendente = `(tse.comppgtocaixinha IS NULL OR tse.comppgtocaixinha = '')`;

                if (incluirPagos) {
                    // PAGO: Se o cachê está pago E a caixinha está paga (ou não é devida).
                    const condicaoPago = `(
                        ${comprovanteCachePreenchido} 
                        AND 
                        (
                            ${vlrcaixinhaNaoDevido} 
                            OR 
                            (${vlrcaixinhaDevido} AND ${comprovanteCaixinhaPreenchido})
                        )
                    )`;
                    statusConditions.push(condicaoPago);
                }
                
                if (incluirPendentes) {
                    // PENDENTE: Se o cachê está pendente OU a caixinha é devida E está pendente.
                    const condicaoPendente = `(
                        ${comprovanteCachePendente} 
                        OR 
                        (${vlrcaixinhaDevido} AND ${comprovanteCaixinhaPendente})
                    )`;
                    statusConditions.push(condicaoPendente);
                }
            }
            
            console.log("CONDICAO STATUS", statusConditions);
            if (statusConditions.length > 0) {
                // Se houver condições, adiciona ' AND (condicao1 OR condicao2)'
                whereStatus = ` AND (${statusConditions.join(' OR ')})`;
            }
        }       

      //  wherePeriodo = wherePeriodo || "AND 1=1";
      //  whereStatus = whereStatus || "AND 1=1";
      //  phaseFilterSql = phaseFilterSql || "1=1";

        console.log("STATUS PAGTO", whereStatus, wherePeriodo, phaseFilterSql);
    
        let queryFechamentoPrincipal = ''; // Variável para armazenar a query principal
        
        // **LÓGICA CONDICIONAL PARA O TIPO DE RELATÓRIO PRINCIPAL**
        if (tipo === 'ajuda_custo') {
            queryFechamentoPrincipal = `
                SELECT
                    tse.idevento AS "idevento",
                    tse.nmevento AS "nomeEvento",
                    tse.nmfuncao AS "FUNÇÃO",
                    tse.idcliente AS "idcliente",
                    tse.nmcliente AS "nomeCliente",
                    tse.idequipe AS "idequipe",
                    tse.nmequipe AS "nmequipe",
                    tbf.nome AS "NOME",
                    tbf.pix AS "PIX",                    
                    (SELECT MIN(date_value::date) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value))::text AS "INÍCIO",
                    (SELECT MAX(date_value::date) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value))::text AS "TÉRMINO",                   
                    0 AS "VLR ADICIONAL",
                    (COALESCE(tse.vlralimentacao, 0) + COALESCE(tse.vlrtransporte, 0)) AS "VLR DIÁRIA",
                    jsonb_array_length(
                        (SELECT jsonb_agg(date_value) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value))
                    ) AS "QTD",
                    (COALESCE(tse.vlralimentacao, 0) + COALESCE(tse.vlrtransporte, 0)) * (CASE WHEN tse.qtdpessoaslote IS NULL OR tse.qtdpessoaslote = 0 THEN 1 ELSE tse.qtdpessoaslote END) * jsonb_array_length(
                        (SELECT jsonb_agg(date_value) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value))
                    ) AS "TOT DIÁRIAS",
                    --tse.statuspgto AS "STATUS PGTO"
                    (COALESCE(tse.vlralimentacao, 0) + COALESCE(tse.vlrtransporte, 0)) * (CASE WHEN tse.qtdpessoaslote IS NULL OR tse.qtdpessoaslote = 0 THEN 1 ELSE tse.qtdpessoaslote END) * jsonb_array_length(
                        (SELECT jsonb_agg(date_value) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value))
                    ) AS "TOT GERAL",
                    CASE
                        WHEN tse.comppgtoajdcusto IS NOT NULL AND tse.comppgtoajdcusto != '' THEN 'Pago 100%'
                        WHEN tse.comppgtoajdcusto50 IS NOT NULL AND tse.comppgtoajdcusto50 != '' THEN 'Pago 50%'
                        ELSE tse.statuspgto
                    END AS "STATUS PGTO",
                    CASE
                        WHEN tse.comppgtoajdcusto IS NOT NULL AND tse.comppgtoajdcusto != '' THEN 0.00                        
                        WHEN tse.comppgtoajdcusto50 IS NOT NULL AND tse.comppgtoajdcusto50 != '' THEN 
                            -- TOT PAGAR (UNFILTERED no cálculo): Usa a QTD total de diárias (dividida por 2 no caso de 50%)
                            (COALESCE(tse.vlralimentacao, 0) + COALESCE(tse.vlrtransporte, 0)) * (CASE WHEN tse.qtdpessoaslote IS NULL OR tse.qtdpessoaslote = 0 THEN 1 ELSE tse.qtdpessoaslote END) * jsonb_array_length(
                                (SELECT jsonb_agg(date_value) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value))
                            ) / 2
                        ELSE 
                            -- TOT PAGAR (UNFILTERED no cálculo): Usa a QTD total de diárias
                            (COALESCE(tse.vlralimentacao, 0) + COALESCE(tse.vlrtransporte, 0)) * (CASE WHEN tse.qtdpessoaslote IS NULL OR tse.qtdpessoaslote = 0 THEN 1 ELSE tse.qtdpessoaslote END) * jsonb_array_length(
                                (SELECT jsonb_agg(date_value) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value))
                            )
                    END AS "TOT PAGAR"                   
                FROM
                    staffeventos tse
                JOIN
                    funcionarios tbf ON tse.idfuncionario = tbf.idfuncionario
                JOIN 
                    staffempresas semp ON tse.idstaff = semp.idstaff
                WHERE
                    semp.idempresa = $1 ${whereStatus} --${wherePeriodo} 
                    AND jsonb_array_length(
                        (SELECT jsonb_agg(date_value) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value)
                        WHERE ${phaseFilterSql})
                    ) > 0
                ORDER BY
                    tse.nmevento,
                    tse.nmcliente,
                    tbf.nome;
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
                        semp.idempresa = $1 ${wherePeriodo}                   
                )
                SELECT
                    "idevento",
                    "nomeEvento",
                    "idcliente",
                    "nomeCliente",
                    "idequipe",
                    "nmequipe",
                    "FUNÇÃO",
                    "NOME",
                    "PIX",
                    "INÍCIO",
                    "TÉRMINO",
                    "VLR ADICIONAL",
                    "VLR DIÁRIA",
                    "QTD",
                    "QTDPESSOAS",
                    "TOT DIÁRIAS",
                    CAST(("TOT DIÁRIAS" + "VLR ADICIONAL") AS NUMERIC(10, 2)) AS "TOT GERAL",
                    "STATUS PGTO",
                    "TOT PAGAR"
                FROM
                    (
                        SELECT
                            tse.idevento AS "idevento",
                            tse.nmevento AS "nomeEvento",
                            tse.idcliente AS "idcliente",
                            tse.nmcliente AS "nomeCliente",
                            tse.idequipe AS "idequipe",
                            tse.nmequipe AS "nmequipe",
                            tse.qtdpessoaslote AS "QTDPESSOAS",
                            tse.nmfuncao AS "FUNÇÃO",
                            tbf.nome AS "NOME",
                            tbf.pix AS "PIX",                            
                            (SELECT MIN(date_value::date) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value))::text AS "INÍCIO",
                            (SELECT MAX(date_value::date) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value))::text AS "TÉRMINO",
                            CAST(
                                (
                                    COALESCE(CASE WHEN tse.statusajustecusto = 'Autorizado' THEN tse.vlrajustecusto ELSE 0.00 END, 0.00) +
                                    COALESCE(CASE WHEN tse.statuscaixinha = 'Autorizado' THEN tse.vlrcaixinha ELSE 0.00 END, 0.00) +
                                    (COALESCE(tse.vlrcache, 0) + COALESCE(tse.vlralimentacao, 0)) * COALESCE(da.qtd_diarias_dobradas_autorizadas, 0) +
                                    ((COALESCE(tse.vlrcache, 0) / 2) + COALESCE(tse.vlralimentacao, 0)) * COALESCE(da.qtd_meias_diarias_autorizadas, 0)
                                ) AS NUMERIC(10, 2)
                            ) AS "VLR ADICIONAL",
                            COALESCE(tse.vlrcache, 0) AS "VLR DIÁRIA",
                            jsonb_array_length(
                                    (SELECT jsonb_agg(date_value) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value))
                                ) AS "QTD",
                                
                            (COALESCE(tse.vlrcache, 0) * (CASE WHEN tse.qtdpessoaslote IS NULL OR tse.qtdpessoaslote = 0 THEN 1 ELSE tse.qtdpessoaslote END) * jsonb_array_length(
                                    (SELECT jsonb_agg(date_value) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value))
                                )) AS "TOT DIÁRIAS",

                            (CAST(COALESCE(NULLIF(TRIM(tse.vlrcaixinha::TEXT), ''), '0') AS NUMERIC)) AS vlrcaixinha_num,            
                         
                            CASE
                                WHEN (tse.comppgtocache IS NOT NULL AND tse.comppgtocache != '') -- Comprovante de Cachê Preenchido
                                AND (
                                    (CAST(COALESCE(NULLIF(TRIM(tse.vlrcaixinha::TEXT), ''), '0') AS NUMERIC) <= 0) -- Caixinha Não Devida (<= 0)
                                    OR 
                                    (
                                        (CAST(COALESCE(NULLIF(TRIM(tse.vlrcaixinha::TEXT), ''), '0') AS NUMERIC) > 0) -- Caixinha Devida (> 0)
                                        AND (tse.comppgtocaixinha IS NOT NULL AND tse.comppgtocaixinha != '') -- E Comprovante de Caixinha Preenchido
                                    )
                                ) THEN 'Pago'
                                ELSE 'Pendente' -- Se não for TUDO PAGO, é Pendente
                            END AS "STATUS PGTO",  

                            CAST(
                                (
                                    -- 1. Total Diárias (Base): Pendente se o comprovante de CACHÊ estiver vazio
                                    (CASE WHEN tse.comppgtocache IS NULL OR tse.comppgtocache = '' THEN (COALESCE(tse.vlrcache, 0) * (CASE WHEN tse.qtdpessoaslote IS NULL OR tse.qtdpessoaslote = 0 THEN 1 ELSE tse.qtdpessoaslote END) * jsonb_array_length((SELECT jsonb_agg(date_value) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value) WHERE ${phaseFilterSql}))) ELSE 0.00 END)
                                    +
                                    -- 2. VLR Adicional (Ajuste): Pendente se o comprovante de CACHÊ estiver vazio
                                    (CASE WHEN tse.comppgtocache IS NULL OR tse.comppgtocache = '' THEN COALESCE(CASE WHEN tse.statusajustecusto = 'Autorizado' THEN tse.vlrajustecusto ELSE 0.00 END, 0.00) ELSE 0.00 END)
                                    +
                                    -- 3. VLR Caixinha: Pendente se a CAIXINHA é devida E o comprovante de CAIXINHA estiver vazio
                                    (CASE WHEN (CAST(COALESCE(NULLIF(TRIM(tse.vlrcaixinha::TEXT), ''), '0') AS NUMERIC) > 0) AND (tse.comppgtocaixinha IS NULL OR tse.comppgtocaixinha = '') THEN COALESCE(CASE WHEN tse.statuscaixinha = 'Autorizado' THEN tse.vlrcaixinha ELSE 0.00 END, 0.00) ELSE 0.00 END)
                                    +
                                    -- 4. VLR Diárias Dobradas (Adicional): Pendente se o comprovante de CACHÊ estiver vazio
                                    (CASE WHEN tse.comppgtocache IS NULL OR tse.comppgtocache = '' THEN (COALESCE(tse.vlrcache, 0) + COALESCE(tse.vlralimentacao, 0)) * COALESCE(da.qtd_diarias_dobradas_autorizadas, 0) ELSE 0.00 END)
                                    +
                                    -- 5. VLR Meias Diárias (Adicional): Pendente se o comprovante de CACHÊ estiver vazio
                                    (CASE WHEN tse.comppgtocache IS NULL OR tse.comppgtocache = '' THEN ((COALESCE(tse.vlrcache, 0) / 2) + COALESCE(tse.vlralimentacao, 0)) * COALESCE(da.qtd_meias_diarias_autorizadas, 0) ELSE 0.00 END)
                                ) AS NUMERIC(10, 2)
                            ) AS "TOT PAGAR"
                        FROM
                            staffeventos tse
                        JOIN
                            funcionarios tbf ON tse.idfuncionario = tbf.idfuncionario
                        JOIN
                            staffempresas semp ON tse.idstaff = semp.idstaff
                        JOIN
                            diarias_autorizadas da ON tse.idstaffevento = da.idstaffevento
                        WHERE
                            semp.idempresa = $1 ${wherePeriodo} ${whereStatus}
                            AND jsonb_array_length(
                                (SELECT jsonb_agg(date_value) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value)
                                WHERE ${phaseFilterSql})
                            ) > 0                            
                    ) AS subquery
                ORDER BY
                    "nomeEvento",
                    "NOME";
            `;
        }
        // }else if (tipo === 'cache') {
        //     queryFechamentoPrincipal = `
        //         WITH
        //         -- 🔹 1) Pega o ano das datas do evento
        //         ano_evento AS (
        //             SELECT DISTINCT EXTRACT(YEAR FROM (date_value::date))::int AS ano
        //             FROM staffeventos tse,
        //                 jsonb_array_elements_text(tse.datasevento) AS s(date_value)
        //         ),

        //         -- 🔹 2) Lista completa de feriados fixos + móveis
        //         feriados AS (
        //             SELECT f.data FROM (
        //                 SELECT make_date(a.ano, 1, 1) AS data FROM ano_evento a UNION
        //                 SELECT make_date(a.ano, 4, 21) AS data FROM ano_evento a UNION
        //                 SELECT make_date(a.ano, 5, 1) AS data FROM ano_evento a UNION
        //                 SELECT make_date(a.ano, 9, 7) AS data FROM ano_evento a UNION
        //                 SELECT make_date(a.ano, 10, 12) AS data FROM ano_evento a UNION
        //                 SELECT make_date(a.ano, 11, 2) AS data FROM ano_evento a UNION
        //                 SELECT make_date(a.ano, 11, 15) AS data FROM ano_evento a UNION
        //                 SELECT make_date(a.ano, 11, 20) AS data FROM ano_evento a UNION
        //                 SELECT make_date(a.ano, 12, 25) AS data FROM ano_evento a UNION

        //                 -- 🟡 MÓVEIS COM ALIAS "data"
        //                 SELECT calcular_pascoa(a.ano) AS data FROM ano_evento a UNION
        //                 SELECT calcular_pascoa(a.ano) - INTERVAL '2 day' AS data FROM ano_evento a UNION
        //                 SELECT calcular_pascoa(a.ano) - INTERVAL '47 day' AS data FROM ano_evento a UNION
        //                 SELECT calcular_pascoa(a.ano) - INTERVAL '48 day' AS data FROM ano_evento a UNION
        //                 SELECT calcular_pascoa(a.ano) - INTERVAL '49 day' AS data FROM ano_evento a UNION
        //                 SELECT calcular_pascoa(a.ano) + INTERVAL '60 day' AS data FROM ano_evento a
        //             ) f
                

        //         ),

        //         diarias_autorizadas AS (
        //             SELECT
        //                 tse.idstaffevento,
        //                 (SELECT COUNT(*) FROM jsonb_to_recordset(tse.dtdiariadobrada) AS d(data text, status text)
        //                     WHERE d.status = 'Autorizado') AS qtd_diarias_dobradas_autorizadas,
        //                 (SELECT COUNT(*) FROM jsonb_to_recordset(tse.dtmeiadiaria) AS m(data text, status text)
        //                     WHERE m.status = 'Autorizado') AS qtd_meias_diarias_autorizadas
        //             FROM
        //                 staffeventos tse
        //             JOIN
        //                 staffempresas semp ON tse.idstaff = semp.idstaff
        //             WHERE
        //                 semp.idempresa = $1 ${wherePeriodo}
        //         )

        //         SELECT
        //             "idevento",
        //             "nomeEvento",
        //             "idcliente",
        //             "nomeCliente",
        //             "idequipe",
        //             "nmequipe",
        //             "FUNÇÃO",
        //             "NOME",
        //             "PIX",
        //             "INÍCIO",
        //             "TÉRMINO",
        //             "VLR ADICIONAL",
        //             "VLR DIÁRIA",
        //             "QTD",
        //             "QTDPESSOAS",
        //             "TOT DIÁRIAS",
        //             CAST(("TOT DIÁRIAS" + "VLR ADICIONAL") AS NUMERIC(10, 2)) AS "TOT GERAL",
        //             "STATUS PGTO",
        //             "TOT PAGAR"
        //         FROM (
        //             SELECT
        //                 tse.idevento AS "idevento",
        //                 tse.nmevento AS "nomeEvento",
        //                 tse.idcliente AS "idcliente",
        //                 tse.nmcliente AS "nomeCliente",
        //                 tse.idequipe AS "idequipe",
        //                 tse.nmequipe AS "nmequipe",
        //                 tse.qtdpessoaslote AS "QTDPESSOAS",
        //                 tse.nmfuncao AS "FUNÇÃO",
        //                 tbf.nome AS "NOME",
        //                 tbf.pix AS "PIX",

        //                 (SELECT MIN(date_value::date)
        //                 FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value))::text AS "INÍCIO",

        //                 (SELECT MAX(date_value::date)
        //                 FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value))::text AS "TÉRMINO",

        //                 CAST((
        //                     COALESCE(CASE WHEN tse.statusajustecusto = 'Autorizado' THEN tse.vlrajustecusto ELSE 0 END, 0) +
        //                     COALESCE(CASE WHEN tse.statuscaixinha = 'Autorizado' THEN tse.vlrcaixinha ELSE 0 END, 0) +
        //                     (COALESCE(tse.vlrcache, 0) + COALESCE(tse.vlralimentacao, 0)) * da.qtd_diarias_dobradas_autorizadas +
        //                     ((COALESCE(tse.vlrcache, 0) / 2) + COALESCE(tse.vlralimentacao, 0)) * da.qtd_meias_diarias_autorizadas
        //                 ) AS NUMERIC(10, 2)) AS "VLR ADICIONAL",

        //                 COALESCE(tse.vlrcache, 0) AS "VLR DIÁRIA",

        //                 jsonb_array_length((
        //                     SELECT jsonb_agg(date_value)
        //                     FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value)
        //                     WHERE
        //                         EXTRACT(DOW FROM date_value::date) IN (0, 6)  -- DOM ou SAB
        //                         OR date_value::date IN (SELECT data FROM feriados)
        //                 )) AS "QTD",

        //                 (COALESCE(tse.vlrcache, 0) *
        //                     (CASE WHEN tse.qtdpessoaslote IS NULL OR tse.qtdpessoaslote = 0
        //                         THEN 1 ELSE tse.qtdpessoaslote END) *
        //                     jsonb_array_length((
        //                         SELECT jsonb_agg(date_value)
        //                         FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value)
        //                         WHERE
        //                             EXTRACT(DOW FROM date_value::date) IN (0, 6)
        //                             OR date_value::date IN (SELECT data FROM feriados)
        //                     ))
        //                 ) AS "TOT DIÁRIAS",

        //                 CAST(COALESCE(NULLIF(TRIM(tse.vlrcaixinha::TEXT), ''), '0') AS NUMERIC) AS vlrcaixinha_num,

        //                 CASE
        //                     WHEN (tse.comppgtocache IS NOT NULL AND tse.comppgtocache != '')
        //                     AND (
        //                         CAST(COALESCE(NULLIF(TRIM(tse.vlrcaixinha::TEXT), ''), '0') AS NUMERIC) <= 0
        //                         OR (
        //                             CAST(COALESCE(NULLIF(TRIM(tse.vlrcaixinha::TEXT), ''), '0') AS NUMERIC) > 0
        //                             AND (tse.comppgtocaixinha IS NOT NULL AND tse.comppgtocaixinha != '')
        //                         )
        //                     )
        //                     THEN 'Pago'
        //                     ELSE 'Pendente'
        //                 END AS "STATUS PGTO",

        //                 CAST((
        //                     -- 1. Total de diárias sobre finais de semana + feriados
        //                     CASE
        //                         WHEN tse.comppgtocache IS NULL OR tse.comppgtocache = ''
        //                         THEN (
        //                             COALESCE(tse.vlrcache, 0) *
        //                             (CASE WHEN tse.qtdpessoaslote IS NULL OR tse.qtdpessoaslote = 0
        //                                 THEN 1 ELSE tse.qtdpessoaslote END) *
        //                             jsonb_array_length((
        //                                 SELECT jsonb_agg(date_value)
        //                                 FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value)
        //                                 WHERE
        //                                     (EXTRACT(DOW FROM date_value::date) IN (0, 6)
        //                                     OR date_value::date IN (SELECT data FROM feriados))
        //                                     AND ${phaseFilterSql}
        //                             ))
        //                         )
        //                         ELSE 0
        //                     END +

        //                     -- 2. Ajuste autorizado
        //                     CASE
        //                         WHEN tse.comppgtocache IS NULL OR tse.comppgtocache = ''
        //                         THEN COALESCE(CASE WHEN tse.statusajustecusto = 'Autorizado'
        //                                         THEN tse.vlrajustecusto ELSE 0 END, 0)
        //                         ELSE 0
        //                     END +

        //                     -- 3. Caixinha (se devida e sem comprovante)
        //                     CASE
        //                         WHEN CAST(COALESCE(NULLIF(TRIM(tse.vlrcaixinha::TEXT), ''), '0') AS NUMERIC) > 0
        //                         AND (tse.comppgtocaixinha IS NULL OR tse.comppgtocaixinha = '')
        //                         THEN COALESCE(CASE WHEN tse.statuscaixinha = 'Autorizado'
        //                                         THEN tse.vlrcaixinha ELSE 0 END, 0)
        //                         ELSE 0
        //                     END +

        //                     -- 4. Diárias dobradas
        //                     CASE
        //                         WHEN tse.comppgtocache IS NULL OR tse.comppgtocache = ''
        //                         THEN (COALESCE(tse.vlrcache, 0) + COALESCE(tse.vlralimentacao, 0))
        //                             * da.qtd_diarias_dobradas_autorizadas
        //                         ELSE 0
        //                     END +

        //                     -- 5. Meias diárias
        //                     CASE
        //                         WHEN tse.comppgtocache IS NULL OR tse.comppgtocache = ''
        //                         THEN ((COALESCE(tse.vlrcache, 0) / 2) + COALESCE(tse.vlralimentacao, 0))
        //                             * da.qtd_meias_diarias_autorizadas
        //                         ELSE 0
        //                     END
        //                 ) AS NUMERIC(10,2)) AS "TOT PAGAR"

        //             FROM staffeventos tse
        //             JOIN funcionarios tbf ON tse.idfuncionario = tbf.idfuncionario
        //             JOIN staffempresas semp ON tse.idstaff = semp.idstaff
        //             JOIN diarias_autorizadas da ON tse.idstaffevento = da.idstaffevento

        //             WHERE
        //                 semp.idempresa = $1
        //                 ${wherePeriodo}
        //                 ${whereStatus}

        //                 -- SOMENTE datas que são finais de semana ou feriados
        //                 AND jsonb_array_length((
        //                     SELECT jsonb_agg(date_value)
        //                     FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value)
        //                     WHERE
        //                         (EXTRACT(DOW FROM date_value::date) IN (0, 6)
        //                         OR date_value::date IN (SELECT data FROM feriados))
        //                         AND ${phaseFilterSql}
        //                 )) > 0

        //         ) AS subquery

        //         ORDER BY "nomeEvento", "NOME";
        //     `;
        // }

    
        const resultFechamentoPrincipal = await pool.query(queryFechamentoPrincipal, params);
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
                    totalTotalGeral: 0,
                    totalTotalPagar: 0
                };
            }
            
            totaisPorEvento[eventoId].totalVlrAdicional += parseFloat(item["VLR ADICIONAL"] || 0);
            totaisPorEvento[eventoId].totalVlrDiarias += parseFloat(item["VLR DIÁRIA"] || 0);
            totaisPorEvento[eventoId].totalTotalDiarias += parseFloat(item["TOT DIÁRIAS"] || 0);
            totaisPorEvento[eventoId].totalTotalGeral += parseFloat(item["TOT GERAL"] || 0);
            totaisPorEvento[eventoId].totalTotalPagar += parseFloat(item["TOT PAGAR"] || 0);
           // console.log('Item:', totaisPorEvento[eventoId]);
        });
        relatorio.fechamentoCacheTotaisPorEvento = totaisPorEvento;

        let whereEventosExiste = whereEventos.replace(' AND ', '');
            // 2. Substitui o alias 'tse.' pelo alias 'inner_tse.' nas subqueries (se for o caso da queryUtilizacaoDiarias)
            whereEventosExiste = whereEventosExiste.replace(/tse\./g, 'inner_tse.');

        // MODIFICAÇÃO 3: Ajustar a query `queryUtilizacaoDiarias` 
        // para usar a string `whereEventosFase` nas subqueries.

        // Prepara os filtros em string, ajustando os aliases (tse. ou inner_tse.)
        // const whereEventosFaseTd = whereEventosFase; 
        // const whereEventosFaseInner = whereEventosFase.replace(/tse\./g, 'inner_tse.');
        
        // // Determina os placeholders de cliente e equipe, que são dinâmicos nos params.
        // const clientePlaceholder = (cliente && cliente !== "todos") ? `$${params.indexOf(cliente) + 1}` : null;
        // const equipePlaceholder = (equipe && equipe !== "todos") ? `$${params.indexOf(equipe) + 1}` : null;
        
        // const clienteFilterTd = clientePlaceholder ? `AND tse.idcliente = ${clientePlaceholder}` : '';
        // const equipeFilterTd = equipePlaceholder ? `AND tse.idequipe = ${equipePlaceholder}` : '';
        
        // const clienteFilterInner = clientePlaceholder ? `AND inner_tse.idcliente = ${clientePlaceholder}` : '';
        // const equipeFilterInner = equipePlaceholder ? `AND inner_tse.idequipe = ${equipePlaceholder}` : '';


        // Utilização de Diárias (não filtra por evento)
        const queryUtilizacaoDiarias = `
            SELECT
                o.idevento,
                o.nrorcamento,
                oi.produto AS "INFORMAÇÕES EM PROPOSTA",
                SUM(oi.qtditens) AS "QTD PROFISSIONAIS",
                SUM(oi.qtditens * oi.qtddias) AS "DIÁRIAS CONTRATADAS",
                COALESCE(MAX(td.diarias_utilizadas_por_funcao), 0) AS "DIÁRIAS UTILIZADAS",
                SUM(oi.qtditens * oi.qtddias) - COALESCE(MAX(td.diarias_utilizadas_por_funcao), 0) AS "SALDO"
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
                         WHERE ${phaseFilterSql})
                    )) AS diarias_utilizadas_por_funcao
                FROM
                    staffeventos tse
                JOIN staffempresas semp ON semp.idstaff = tse.idstaff
                WHERE
                    semp.idempresa = $1 ${wherePeriodo}
                    --AND EXISTS (
                    --    SELECT 1 FROM jsonb_array_elements_text(tse.datasevento) AS s_check(date_value_check)
                    --    WHERE s_check.date_value_check::date >= $2::date AND s_check.date_value_check::date <= $3::date
                    --)
                    ${evento && evento !== "todos" ? `AND tse.idevento = $${params.indexOf(evento) + 1}` : ''}
                    ${cliente && cliente !== "todos" ? `AND tse.idcliente = $${params.indexOf(cliente) + 1}` : ''}
                    ${equipe && equipe !== "todos" ? `AND tse.idequipe = $${params.indexOf(equipe) + 1}` : ''}
                  

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
                    ${evento && evento !== "todos" ? `AND inner_tse.idevento = $${params.indexOf(evento) + 1}` : ''}
                    ${cliente && cliente !== "todos" ? `AND inner_tse.idcliente = $${params.indexOf(cliente) + 1}` : ''}
                    ${equipe && equipe !== "todos" ? `AND inner_tse.idequipe = $${params.indexOf(equipe) + 1}` : ''}                  
                
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
        //const resultUtilizacaoDiarias = await pool.query(queryUtilizacaoDiarias, [idempresa, dataInicio, dataFim]);
        const resultUtilizacaoDiarias = await pool.query(queryUtilizacaoDiarias, params);
        relatorio.utilizacaoDiarias = resultUtilizacaoDiarias.rows;        

        const queryContingencia = `
            WITH calculos_adicionais AS (
                SELECT
                    tse.idstaffevento,
                    tse.idfuncionario,
                    (COALESCE(tse.vlrcache, 0) + COALESCE(tse.vlralimentacao, 0)) * COALESCE(jsonb_array_length(tse.dtdiariadobrada), 0) AS valor_dobrada,
                    ((COALESCE(tse.vlrcache, 0) / 2) + COALESCE(tse.vlralimentacao, 0)) * COALESCE(jsonb_array_length(tse.dtmeiadiaria), 0) AS valor_meia_diaria
                FROM
                    staffeventos tse
                JOIN
                    staffempresas semp ON tse.idstaff = semp.idstaff
                
                WHERE
                    semp.idempresa = $1 ${wherePeriodo}
            )
            SELECT
                tse.idevento,
                tbf.nome AS "Profissional",
                'Diária Dobrada - R$' || CAST(ca.valor_dobrada AS TEXT) || ' (' || CAST(jsonb_array_length(tse.dtdiariadobrada) AS TEXT)|| ' dia(s) autorizado(s))' AS "Informacao",
                tse.descdiariadobrada AS "Observacao"
            FROM
                staffeventos tse
            JOIN
                funcionarios tbf ON tse.idfuncionario = tbf.idfuncionario
            JOIN 
                staffempresas semp ON tse.idstaff = semp.idstaff
            JOIN
                calculos_adicionais ca ON ca.idstaffevento = tse.idstaffevento
            WHERE
                semp.idempresa = $1 ${wherePeriodo}
                AND jsonb_array_length(tse.dtdiariadobrada) > 0
            
            UNION ALL
            
            SELECT
                tse.idevento,
                tbf.nome AS "Profissional",
                'Meia Diária - R$' || CAST(ca.valor_meia_diaria AS TEXT) || ' (' ||CAST(jsonb_array_length(tse.dtmeiadiaria) AS TEXT) || ' dia(s) autorizado(s))' AS "Informacao",
                tse.descmeiadiaria AS "Observacao"
            FROM
                staffeventos tse
            JOIN
                funcionarios tbf ON tse.idfuncionario = tbf.idfuncionario
            JOIN 
                staffempresas semp ON tse.idstaff = semp.idstaff
            JOIN
                calculos_adicionais ca ON ca.idstaffevento = tse.idstaffevento
            WHERE
                semp.idempresa = $1 ${wherePeriodo}
                AND jsonb_array_length(tse.dtmeiadiaria) > 0

            UNION ALL
            
            SELECT
                tse.idevento,
                tbf.nome AS "Profissional",
                'Ajuste de Custo - R$' || CAST(tse.vlrajustecusto AS TEXT) AS "Informacao",
                tse.descajustecusto AS "Observacao"
            FROM
                staffeventos tse
            JOIN
                funcionarios tbf ON tse.idfuncionario = tbf.idfuncionario
            JOIN 
                staffempresas semp ON tse.idstaff = semp.idstaff
            WHERE
                semp.idempresa = $1 ${wherePeriodo}
                AND tse.statusajustecusto = 'Autorizado' 
                AND tse.vlrajustecusto IS NOT NULL 
                AND tse.vlrajustecusto != 0

            UNION ALL
            
            SELECT
                tse.idevento,
                tbf.nome AS "Profissional",
                'Caixinha - R$' || CAST(tse.vlrcaixinha AS TEXT) AS "Informacao",
                tse.desccaixinha AS "Observacao"
            FROM
                staffeventos tse
            JOIN
                funcionarios tbf ON tse.idfuncionario = tbf.idfuncionario
            JOIN 
                staffempresas semp ON semp.idstaff = tse.idstaff
            WHERE
                semp.idempresa = $1 ${wherePeriodo}
                AND tse.statuscaixinha = 'Autorizado' 
                AND tse.vlrcaixinha IS NOT NULL 
                AND tse.vlrcaixinha > 0
            ORDER BY
                idevento, "Profissional", "Informacao";
        `;
       // const resultContingencia = await pool.query(queryContingencia, paramsContingencia);
       const resultContingencia = await pool.query(queryContingencia, params);
        relatorio.contingencia = resultContingencia.rows;

        return res.json(relatorio);
        
    } catch (error) {
        console.error("❌ Erro ao buscar relatório:", error);
        return res.status(500).json({ error: error.message || "Erro ao gerar relatório" });
    }
});

// ROTA PARA BUSCAR EVENTOS NO PERÍODO
router.get('/eventos', autenticarToken(), async (req, res) => {
    try {
        const { inicio, fim } = req.query;
        if (!inicio || !fim) {
            return res.status(400).json({ error: "Parâmetros inicio e fim são obrigatórios." });
        }
        const idempresa = req.idempresa;
        const query = `
            SELECT o.idevento, e.nmevento, o.nomenclatura, o.idcliente, c.nmfantasia AS cliente,
                   o.dtiniinframontagem, o.dtfiminframontagem,      
                   o.dtinimontagem, o.dtfimmontagem,
                   o.dtinimarcacao, o.dtfimmarcacao,
                   o.dtinirealizacao, o.dtfimrealizacao,
                   o.dtinidesmontagem, o.dtfimdesmontagem,                   
                   o.dtiniinfradesmontagem, o.dtfiminfradesmontagem                   
            FROM orcamentos o
            JOIN orcamentoempresas oe ON o.idorcamento = oe.idorcamento
            JOIN clientes c ON o.idcliente = c.idcliente
            JOIN eventos e ON o.idevento = e.idevento
            WHERE  oe.idempresa = $3 AND (
                (o.dtinimontagem IS NOT NULL AND o.dtinimontagem <= $2 AND o.dtfimmontagem >= $1)
            OR (o.dtinirealizacao IS NOT NULL AND o.dtinirealizacao <= $2 AND o.dtfimrealizacao >= $1)
            OR (o.dtinidesmontagem IS NOT NULL AND o.dtinidesmontagem <= $2 AND o.dtfimdesmontagem >= $1)
            OR (o.dtiniinframontagem IS NOT NULL AND o.dtiniinframontagem <= $2 AND o.dtfiminframontagem >= $1)
            OR (o.dtiniinfradesmontagem IS NOT NULL AND o.dtiniinfradesmontagem <= $2 AND o.dtfiminfradesmontagem >= $1)
            OR (o.dtinimarcacao IS NOT NULL AND o.dtinimarcacao <= $2 AND o.dtfimmarcacao >= $1)
            )
            GROUP BY o.idevento, e.nmevento, o.nomenclatura, o.idcliente, c.nmfantasia, 
                   o.dtiniinframontagem, o.dtfiminframontagem,      
                   o.dtinimontagem, o.dtfimmontagem,
                   o.dtinimarcacao, o.dtfimmarcacao,
                   o.dtinirealizacao, o.dtfimrealizacao,
                   o.dtinidesmontagem, o.dtfimdesmontagem,                   
                   o.dtiniinfradesmontagem, o.dtfiminfradesmontagem
            ORDER BY e.nmevento;
        `;

        const { rows } = await pool.query(query, [inicio, fim, idempresa]);
        return res.json(rows);
    } catch (err) {
        console.error("❌ Erro ao buscar eventos:", err);
        return res.status(500).json({ error: err.message });
    }
});

router.get('/equipe', autenticarToken(), async (req, res) => {
    try {
        
        const idempresa = req.idempresa;

        const query = `
            SELECT e.idequipe, e.nmequipe
            FROM equipe e
            JOIN equipeempresas ee ON e.idequipe = ee.idequipe
            WHERE  ee.idempresa = $1             
            ORDER BY e.nmequipe;
        `;
        const { rows } = await pool.query(query, [idempresa]);
        console.log("rows:", rows);
        return res.json(rows);
    } catch (err) {
        console.error("❌ Erro ao buscar eventos:", err);
        return res.status(500).json({ error: err.message });
    }
});

module.exports = router;