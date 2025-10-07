const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB");
const { autenticarToken, contextoEmpresa } = require('../middlewares/authMiddlewares');
const { verificarPermissao } = require('../middlewares/permissaoMiddleware');


// ROTA PRINCIPAL DE RELATÓRIOS
// router.get("/", autenticarToken(), contextoEmpresa,
// verificarPermissao('Relatorios', 'pesquisar'), async (req, res) => {
//     console.log("ENTROU NA ROTA PARA RELATORIOS", req.query);
//     const { tipo, dataInicio, dataFim, evento, cliente, equipe, pendentes, pagos, eventoFilter} = req.query;
//     const idempresa = req.idempresa;
//     const eventoEhTodos = evento === "todos";
//    // const clienteEhTodos = !cliente || cliente === "todos";
    
//     if (!tipo || !dataInicio || !dataFim || !evento) {
//         return res.status(400).json({ error: 'Parâmetros tipo, dataInicio, dataFim e evento são obrigatórios.' });
//     }
    
//     const tiposPermitidos = ['ajuda_custo', 'cache'];
//     if (!tiposPermitidos.includes(tipo)) {
//         return res.status(400).json({ error: 'Tipo de relatório inválido.' });
//     }

//     try {
//         const relatorio = {};

//         const whereEventosFase = eventoFilter || ''; // Contém: ` AND tse.idevento IN (id1, id2, ...)` ou ''

//         let paramCount = 4; // Começa a contagem para os parâmetros dinâmicos
//         const params = [idempresa, dataInicio, dataFim];
//         let wherePeriodoPadrao = `
//             EXISTS (
//                 SELECT 1
//                 FROM jsonb_array_elements_text(tse.datasevento) AS event_date
//                 WHERE event_date::date >= $2::date
//                 AND event_date::date <= $3::date
//             )
//         `;

//         // let wherePeriodo = ` AND ${wherePeriodoPadrao}`; // Filtro padrão de datasevento
//         // wherePeriodo += whereEventosFase;

//         let wherePeriodo = ` AND ${wherePeriodoPadrao}`; 
//         // 2. Aplica o filtro de Evento:
//         if (evento && evento !== "todos") {
//             // Prioridade 1: Se um evento individual foi selecionado, filtra por ele.
//             // NOTE: Este bloco NÃO usa whereEventosFase (lista de fases)
//             wherePeriodo += ` AND tse.idevento = $${paramCount}`;
//             params.push(evento);
//             paramCount++;
//         } else if (whereEventosFase) {
//             // Prioridade 2: Se 'Todos' está selecionado, mas o JS enviou a lista de IDs de fases, aplica essa lista.
//             wherePeriodo += whereEventosFase;
//         }     


//         // if (evento && evento !== "todos") {
//         //     wherePeriodo += ` AND tse.idevento = $4`;
//         //     params.push(evento);
//         //     paramCount++;
//         // } 

//         if (cliente && cliente !== "todos") {
//             wherePeriodo += ` AND tse.idcliente = $${paramCount}`;
//             params.push(cliente);
//             paramCount++;
//         }

//         if (equipe && equipe !== "todos") {
//             wherePeriodo += ` AND tse.idequipe = $${paramCount}`;
//             params.push(equipe);
//             paramCount++; // Incrementa o contador para o próximo parâmetro
//         }

//         console.log("ATENÇÃO PAGOS/PENDENTES",pagos, pendentes)

//         let whereStatus = '';
//         const incluirPendentes = pendentes === 'true';
//         const incluirPagos = pagos === 'true';

//         if (incluirPendentes || incluirPagos) {
//             let statusConditions = [];

//             if (tipo === 'ajuda_custo') {
//                 // Filtro de Ajuda de Custo usa comppgtoajdcusto (100%) e comppgtoajdcusto50 (50%)
//                 if (incluirPagos) {
//                     // Pago: Se houver comprovante de 100% OU 50%
//                     statusConditions.push(`(tse.comppgtoajdcusto IS NOT NULL AND tse.comppgtoajdcusto != '') OR (tse.comppgtoajdcusto50 IS NOT NULL AND tse.comppgtoajdcusto50 != '')`);
//                 }
//                 if (incluirPendentes) {
//                     // Pendente: Se NÃO houver comprovante de 100% E NÃO houver de 50%
//                     statusConditions.push(`(tse.comppgtoajdcusto IS NULL OR tse.comppgtoajdcusto = '') AND (tse.comppgtoajdcusto50 IS NULL OR tse.comppgtoajdcusto50 = '')`);
//                 }
//             } else if (tipo === 'cache') {
//                 // CORREÇÃO: Forçar a conversão para TEXT (::TEXT) antes do TRIM().
//                 // Isso resolve o erro "função pg_catalog.btrim(numeric) não existe".
//                 const vlrcaixinhaNumericoSeguro = `CAST(COALESCE(NULLIF(TRIM(tse.vlrcaixinha::TEXT), ''), '0') AS NUMERIC)`;
                
//                 // Condição para vlrcaixinha ser "Devido" (Valor > 0)
//                 const vlrcaixinhaDevido = `(${vlrcaixinhaNumericoSeguro} > 0)`;
//                 // Condição para vlrcaixinha ser "Não Devido" (Valor <= 0 ou vazio/nulo/com espaços)
//                 const vlrcaixinhaNaoDevido = `(${vlrcaixinhaNumericoSeguro} <= 0)`;

//                 const comprovanteCachePreenchido = `(tse.comppgtocache IS NOT NULL AND tse.comppgtocache != '')`;
//                 const comprovanteCachePendente = `(tse.comppgtocache IS NULL OR tse.comppgtocache = '')`;
                
//                 const comprovanteCaixinhaPreenchido = `(tse.comppgtocaixinha IS NOT NULL AND tse.comppgtocaixinha != '')`;
//                 const comprovanteCaixinhaPendente = `(tse.comppgtocaixinha IS NULL OR tse.comppgtocaixinha = '')`;

//                 if (incluirPagos) {
//                     // PAGO: Se o cachê está pago E a caixinha está paga (ou não é devida).
//                     const condicaoPago = `(
//                         ${comprovanteCachePreenchido} 
//                         AND 
//                         (
//                             ${vlrcaixinhaNaoDevido} 
//                             OR 
//                             (${vlrcaixinhaDevido} AND ${comprovanteCaixinhaPreenchido})
//                         )
//                     )`;
//                     statusConditions.push(condicaoPago);
//                 }
                
//                 if (incluirPendentes) {
//                     // PENDENTE: Se o cachê está pendente OU a caixinha é devida E está pendente.
//                     const condicaoPendente = `(
//                         ${comprovanteCachePendente} 
//                         OR 
//                         (${vlrcaixinhaDevido} AND ${comprovanteCaixinhaPendente})
//                     )`;
//                     statusConditions.push(condicaoPendente);
//                 }
//             }
//             
//             console.log("CONDICAO STATUS", statusConditions);
//             if (statusConditions.length > 0) {
//                 // Se houver condições, adiciona ' AND (condicao1 OR condicao2)'
//                 whereStatus = ` AND (${statusConditions.join(' OR ')})`;
//             }
//         }
        

//         // let wherePeriodo = `
//         //     EXISTS (
//         //         SELECT 1
//         //         FROM jsonb_array_elements_text(tse.datasevento) AS event_date
//         //         WHERE event_date::date >= $2::date
//         //         AND event_date::date <= $3::date
//         //     ) AND tse.idevento = $4
//         // `;          

router.get("/", autenticarToken(), contextoEmpresa,
verificarPermissao('Relatorios', 'pesquisar'), async (req, res) => {
    console.log("ENTROU NA ROTA PARA RELATORIOS", req.query);
    const { tipo, dataInicio, dataFim, evento, cliente, equipe, pendentes, pagos, fases} = req.query;
    const fasesSelecionadas = fases ? fases.split(',').map(f => f.trim()) : [];

    // 1. Mapeamento de Fases (Ajustado para usar 'ini' e 'fim')
    const phaseKeyMap = { // Renomeado de phaseKeys para phaseKeyMap
        'montagem_infra': { ini: 'dtiniinframontagem', fim: 'dtfiminframontagem' },
        'marcacao': { ini: 'dtinimarcacao', fim: 'dtfimmarcacao' },
        'realizacao': { ini: 'dtinirealizacao', fim: 'dtfimrealizacao' },
        'desmontagem_infra': { ini: 'dtiniinfradesmontagem', fim: 'dtfiminfradesmontagem' },
        'montagem': { ini: 'dtinimontagem', fim: 'dtfimmontagem' },
        'desmontagem': { ini: 'dtinidesmontagem', fim: 'dtfimdesmontagem' }
    };
    
    const idempresa = req.idempresa;
    const eventoEhTodos = evento === "todos";
    
    // 2. Validações
    if (!tipo || !dataInicio || !dataFim || !evento) {
        return res.status(400).json({ error: 'Parâmetros tipo, dataInicio, dataFim e evento são obrigatórios.' });
    }
    
    const tiposPermitidos = ['ajuda_custo', 'cache'];
    if (!tiposPermitidos.includes(tipo)) {
        return res.status(400).json({ error: 'Tipo de relatório inválido.' });
    }

    // =======================================================
    // 3. NOVA LÓGICA DE FILTRO DE FASE/PERÍODO CONSOLIDADO
    // =======================================================
    let whereEventos = ''; // Filtro principal do evento (AND ...)
    let phaseFilterSql = null; // Filtro interno das subqueries de staff (s.date_value::date ...)

    if (fasesSelecionadas.length > 0) {
        
        const startCols = fasesSelecionadas.map(fase => {
            const key = phaseKeyMap[fase];
            return key ? `tse.${key.ini}` : null;
        }).filter(c => c).join(', ');

        const endCols = fasesSelecionadas.map(fase => {
            const key = phaseKeyMap[fase];
            return key ? `tse.${key.fim}` : null;
        }).filter(c => c).join(', ');

        if (startCols.length > 0 && endCols.length > 0) {
            // Encontra o INÍCIO mais antigo e o FIM mais recente
            const sqlMinDate = `LEAST(${startCols})`;
            const sqlMaxDate = `GREATEST(${endCols})`;
            
            // 1. FILTRO DE EVENTO: Garante que o período consolidado se sobrepõe ao período do relatório ($2/$3)
            whereEventos = `
                AND COALESCE(${sqlMinDate}, '9999-12-31'::date)::date <= $3::date
                AND COALESCE(${sqlMaxDate}, '1900-01-01'::date)::date >= $2::date
            `;
            
            // 2. FILTRO DE STAFF: Força a contagem APENAS dentro do Período Consolidado da Fase
            phaseFilterSql = `
                s.date_value::date >= ${sqlMinDate}::date 
                AND s.date_value::date <= ${sqlMaxDate}::date
            `;
        }
    } 

    if (!whereEventos) {
        // Se não há filtro de fase, usa o filtro de datasevento padrão.
        whereEventos = `
            AND EXISTS (
                SELECT 1
                FROM jsonb_array_elements_text(tse.datasevento) AS event_date
                WHERE event_date::date >= $2::date
                AND event_date::date <= $3::date
            )
        `;
        
        // O filtro de staff, neste caso, é o período do relatório ($2 e $3)
        phaseFilterSql = `s.date_value::date >= $2::date AND s.date_value::date <= $3::date`;
    }

    // 4. Inicializa wherePeriodo com o filtro de período/fase
    let wherePeriodo = whereEventos; 
    
    // =======================================================
    // 5. CONFIGURAÇÃO DE PARÂMETROS E FILTROS ADICIONAIS
    // =======================================================

    try {
        const relatorio = {};

        // REMOVIDA: const whereEventosFase = eventoFilter || ''; (Não é mais necessária)
        // REMOVIDA: let wherePeriodoPadrao = ... (Agora é coberto por whereEventos/phaseFilterSql)

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

    // Lembre-se de USAR `phaseFilterSql` na sua `queryFechamentoPrincipal`
    // substituindo a antiga condição de data `s.date_value::date >= $2::date AND s.date_value::date <= $3::date`
    // por ` ${phaseFilterSql} ` em todas as subqueries de INÍCIO, TÉRMINO e QTD/Diárias.
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
                    --jsonb_array_element_text(tse.datasevento, 0) AS "INÍCIO",
                    --jsonb_array_element_text(tse.datasevento, jsonb_array_length(tse.datasevento) - 1) AS "TÉRMINO",
                    (SELECT MIN(date_value::date) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value) WHERE s.date_value::date >= $2::date AND s.date_value::date <= $3::date)::text AS "INÍCIO",
                    (SELECT MAX(date_value::date) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value) WHERE s.date_value::date >= $2::date AND s.date_value::date <= $3::date)::text AS "TÉRMINO",
                    --(
                    --    COALESCE(CASE WHEN tse.statusajustecusto = 'Autorizado' THEN tse.vlrajustecusto ELSE 0.00 END, 0.00) +
                    --    COALESCE(CASE WHEN tse.statuscaixinha = 'Autorizado' THEN tse.vlrcaixinha ELSE 0.00 END, 0.00)
                    --) AS "VLR ADICIONAL",
                    0 AS "VLR ADICIONAL",
                    (COALESCE(tse.vlralimentacao, 0) + COALESCE(tse.vlrtransporte, 0)) AS "VLR DIÁRIA",
                    jsonb_array_length(
                        (SELECT jsonb_agg(date_value) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value)
                         WHERE s.date_value::date >= $2::date AND s.date_value::date <= $3::date)
                    ) AS "QTD",
                    (COALESCE(tse.vlralimentacao, 0) + COALESCE(tse.vlrtransporte, 0))  *  (CASE WHEN tse.qtdpessoaslote IS NULL OR tse.qtdpessoaslote = 0 THEN 1 ELSE tse.qtdpessoaslote END) * jsonb_array_length(
                        (SELECT jsonb_agg(date_value) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value)
                         WHERE s.date_value::date >= $2::date AND s.date_value::date <= $3::date)
                    ) AS "TOT DIÁRIAS",
                    --tse.statuspgto AS "STATUS PGTO"
                    CASE
                        WHEN tse.comppgtoajdcusto IS NOT NULL AND tse.comppgtoajdcusto != '' THEN 'Pago 100%'
                        WHEN tse.comppgtoajdcusto50 IS NOT NULL AND tse.comppgtoajdcusto50 != '' THEN 'Pago 50%'
                        ELSE tse.statuspgto
                    END AS "STATUS PGTO",
                    CASE
                        WHEN tse.comppgtoajdcusto IS NOT NULL AND tse.comppgtoajdcusto != '' THEN 0.00
                        WHEN tse.comppgtoajdcusto50 IS NOT NULL AND tse.comppgtoajdcusto50 != '' THEN 
                            (COALESCE(tse.vlralimentacao, 0) + COALESCE(tse.vlrtransporte, 0))  *  (CASE WHEN tse.qtdpessoaslote IS NULL OR tse.qtdpessoaslote = 0 THEN 1 ELSE tse.qtdpessoaslote END) * jsonb_array_length(
                                (SELECT jsonb_agg(date_value) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value)
                                WHERE s.date_value::date >= $2::date AND s.date_value::date <= $3::date)
                            ) / 2
                        ELSE 
                            (COALESCE(tse.vlralimentacao, 0) + COALESCE(tse.vlrtransporte, 0)) *  (CASE WHEN tse.qtdpessoaslote IS NULL OR tse.qtdpessoaslote = 0 THEN 1 ELSE tse.qtdpessoaslote END) * jsonb_array_length(
                                (SELECT jsonb_agg(date_value) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value)
                                WHERE s.date_value::date >= $2::date AND s.date_value::date <= $3::date)
                            )
                    END AS "TOT PAGAR"
                FROM
                    staffeventos tse
                JOIN
                    funcionarios tbf ON tse.idfuncionario = tbf.idfuncionario
                JOIN 
                    staffempresas semp ON tse.idstaff = semp.idstaff
                WHERE
                    semp.idempresa = $1 ${wherePeriodo} ${whereStatus}
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
                    CAST(("TOT DIÁRIAS" + "VLR ADICIONAL") AS NUMERIC(10, 2)) AS "TOTAL GERAL",
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
                            jsonb_array_element_text(tse.datasevento, 0) AS "INÍCIO",
                            jsonb_array_element_text(tse.datasevento, jsonb_array_length(tse.datasevento) - 1) AS "TÉRMINO",
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
                                (SELECT jsonb_agg(date_value) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value)
                                WHERE s.date_value::date >= $2::date AND s.date_value::date <= $3::date)
                            ) AS "QTD",
                            (COALESCE(tse.vlrcache, 0) *  (CASE WHEN tse.qtdpessoaslote IS NULL OR tse.qtdpessoaslote = 0 THEN 1 ELSE tse.qtdpessoaslote END) * jsonb_array_length(
                                (SELECT jsonb_agg(date_value) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value)
                                WHERE s.date_value::date >= $2::date AND s.date_value::date <= $3::date)
                            )) AS "TOT DIÁRIAS",
                            (CAST(COALESCE(NULLIF(TRIM(tse.vlrcaixinha::TEXT), ''), '0') AS NUMERIC)) AS vlrcaixinha_num,
            
                            -- 2. Define a condição de TUDO PAGO (incluindo a nova lógica)
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
                            
                            -- CÁLCULO DO TOTAL A PAGAR (somente o que está pendente)
                            CAST(
                                (
                                    -- 1. Total Diárias (Base): Pendente se o comprovante de CACHÊ estiver vazio
                                    (CASE WHEN tse.comppgtocache IS NULL OR tse.comppgtocache = '' THEN (COALESCE(tse.vlrcache, 0) * (CASE WHEN tse.qtdpessoaslote IS NULL OR tse.qtdpessoaslote = 0 THEN 1 ELSE tse.qtdpessoaslote END) * jsonb_array_length((SELECT jsonb_agg(date_value) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value) WHERE s.date_value::date >= $2::date AND s.date_value::date <= $3::date))) ELSE 0.00 END)
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
                            
                    ) AS subquery
                ORDER BY
                    "nomeEvento",
                    "NOME";
            `;
        }
    
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
                    totalTotalPagar: 0
                };
            }
            
            totaisPorEvento[eventoId].totalVlrAdicional += parseFloat(item["VLR ADICIONAL"] || 0);
            totaisPorEvento[eventoId].totalVlrDiarias += parseFloat(item["VLR DIÁRIA"] || 0);
            totaisPorEvento[eventoId].totalTotalDiarias += parseFloat(item["TOT DIÁRIAS"] || 0);
            totaisPorEvento[eventoId].totalTotalPagar += parseFloat(item["TOT PAGAR"] || 0);
            console.log('Item:', totaisPorEvento[eventoId]);
        });
        relatorio.fechamentoCacheTotaisPorEvento = totaisPorEvento;

        // MODIFICAÇÃO 3: Ajustar a query `queryUtilizacaoDiarias` 
        // para usar a string `whereEventosFase` nas subqueries.

        // Prepara os filtros em string, ajustando os aliases (tse. ou inner_tse.)
        const whereEventosFaseTd = whereEventosFase; 
        const whereEventosFaseInner = whereEventosFase.replace(/tse\./g, 'inner_tse.');
        
        // Determina os placeholders de cliente e equipe, que são dinâmicos nos params.
        const clientePlaceholder = (cliente && cliente !== "todos") ? `$${params.indexOf(cliente) + 1}` : null;
        const equipePlaceholder = (equipe && equipe !== "todos") ? `$${params.indexOf(equipe) + 1}` : null;
        
        const clienteFilterTd = clientePlaceholder ? `AND tse.idcliente = ${clientePlaceholder}` : '';
        const equipeFilterTd = equipePlaceholder ? `AND tse.idequipe = ${equipePlaceholder}` : '';
        
        const clienteFilterInner = clientePlaceholder ? `AND inner_tse.idcliente = ${clientePlaceholder}` : '';
        const equipeFilterInner = equipePlaceholder ? `AND inner_tse.idequipe = ${equipePlaceholder}` : '';


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
                    ${evento && evento !== "todos" ? `AND tse.idevento = $${params.indexOf(evento) + 1}` : ''}
                    ${cliente && cliente !== "todos" ? `AND tse.idcliente = $${params.indexOf(cliente) + 1}` : ''}
                    ${equipe && equipe !== "todos" ? `AND tse.idequipe = $${params.indexOf(equipe) + 1}` : ''}
                   -- ${whereEventosFaseTd} 
                   -- ${clienteFilterTd} 
                   -- ${equipeFilterTd}

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

                    --${whereEventosFaseTd} 
                    --${clienteFilterTd} 
                    --${equipeFilterTd}
                
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
                AND tse.vlrajustecusto > 0

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