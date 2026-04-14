const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB");
const { autenticarToken, contextoEmpresa } = require('../middlewares/authMiddlewares');
const { verificarPermissao } = require('../middlewares/permissaoMiddleware');

// router.get("/", autenticarToken(), contextoEmpresa,
//         verificarPermissao('Relatorios', 'pesquisar'), async (req, res) => {
//             console.log("ENTROU NA ROTA PARA RELATORIOS", req.query);
//             const { tipo, dataInicio, dataFim, evento, cliente, equipe, pendentes, pagos} = req.query;
//             //const fasesSelecionadas = fases ? fases.split(',').map(f => f.trim()) : [];

//             const idempresa = req.idempresa;
//             const eventoEhTodos = !evento || evento === "todos";  
            
//             // 2. Validações
//             if (!tipo || !dataInicio || !dataFim ) {
//                 return res.status(400).json({ error: 'Parâmetros tipo, dataInicio, dataFim e evento são obrigatórios.' });
//             }
            
//             const tiposPermitidos = ['ajuda_custo', 'cache', 'operacional', 'cache_ajuda'];
//             if (!tiposPermitidos.includes(tipo)) {
//                 return res.status(400).json({ error: 'Tipo de relatório inválido.' });
//             }
            
//         let phaseFilterSql = `s.date_value::date >= $2::date AND s.date_value::date <= $3::date`;

//         const whereEventos = `
//             AND CASE
//                 WHEN $2::date = $3::date THEN
//                     (tse.datasevento ? $2::text AND jsonb_array_length(tse.datasevento) = 1)
//                 ELSE
//                     NOT EXISTS (
//                         SELECT 1
//                         FROM jsonb_array_elements_text(tse.datasevento) AS event_date
//                         WHERE event_date::date < $2::date OR event_date::date > $3::date
//                     )
//             END
//         `;

//         try {
//             const relatorio = {};

//             // 1. DEFINIÇÃO FIXA DOS PARÂMETROS ($1 até $6)
//             const params = [
//                 idempresa,                                        // $1
//                 dataInicio,                                       // $2
//                 dataFim,                                          // $3
//                 (evento && evento !== "todos" && evento !== "") ? evento.toString() : null,   // $4
//                 (cliente && cliente !== "todos" && cliente !== "") ? cliente.toString() : null, // $5
//                 (equipe && equipe !== "todos" && equipe !== "") ? equipe.toString() : null    // $6
//             ];

//             // 2. FILTROS EXTRAS COM CAST PARA TEXT (Isso resolve o erro globalmente onde usar wherePeriodoFinal)
//             const sqlFiltrosExtras = `
//                 AND ($4::text IS NULL OR $4::text = '' OR tse.idevento::text = $4::text)
//                 AND ($5::text IS NULL OR $5::text = '' OR tse.idcliente::text = $5::text)
//                 AND ($6::text IS NULL OR $6::text = '' OR tse.idequipe::text = $6::text)
//             `;

//             // 3. Unificamos na variável que as queries abaixo utilizam
//             let wherePeriodoFinal = whereEventos + sqlFiltrosExtras;

//                 console.log("ATENÇÃO PAGOS/PENDENTES",pagos, pendentes)

//                 let whereStatus = '';
//                 const incluirPendentes = pendentes === 'true';
//                 const incluirPagos = pagos === 'true';

//                 if (incluirPendentes || incluirPagos) {
//                     let statusConditions = [];

//                     if (tipo === 'ajuda_custo') {
//                     // Filtro de Ajuda de Custo usa comppgtoajdcusto (100%) e comppgtoajdcusto50 (50%)
//                         if (incluirPagos) {
//                     // Pago: Se houver comprovante de 100% OU 50%
//                             statusConditions.push(`(tse.comppgtoajdcusto IS NOT NULL AND tse.comppgtoajdcusto != '') OR (tse.comppgtoajdcusto50 IS NOT NULL AND tse.comppgtoajdcusto50 != '')`);
//                         }
//                         if (incluirPendentes) {
//                     // Pendente: Se NÃO houver comprovante de 100% E NÃO houver de 50%
//                             statusConditions.push(`(tse.comppgtoajdcusto IS NULL OR tse.comppgtoajdcusto = '') AND (tse.comppgtoajdcusto50 IS NULL OR tse.comppgtoajdcusto50 = '')`);
//                         }
//                     } else if (tipo === 'cache') {
//                             // CORREÇÃO: Forçar a conversão para TEXT (::TEXT) antes do TRIM().
//                         // Isso resolve o erro "função pg_catalog.btrim(numeric) não existe".
//                         const vlrcaixinhaNumericoSeguro = `CAST(COALESCE(NULLIF(TRIM(tse.vlrcaixinha::TEXT), ''), '0') AS NUMERIC)`;
                        
//                         // Condição para vlrcaixinha ser "Devido" (Valor > 0)
//                         const vlrcaixinhaDevido = `(${vlrcaixinhaNumericoSeguro} > 0)`;
//                         // Condição para vlrcaixinha ser "Não Devido" (Valor <= 0 ou vazio/nulo/com espaços)
//                         const vlrcaixinhaNaoDevido = `(${vlrcaixinhaNumericoSeguro} <= 0)`;

//                         const comprovanteCachePreenchido = `(tse.comppgtocache IS NOT NULL AND tse.comppgtocache != '')`;
//                         const comprovanteCachePendente = `(tse.comppgtocache IS NULL OR tse.comppgtocache = '')`;
                        
//                         const comprovanteCaixinhaPreenchido = `(tse.comppgtocaixinha IS NOT NULL AND tse.comppgtocaixinha != '')`;
//                         const comprovanteCaixinhaPendente = `(tse.comppgtocaixinha IS NULL OR tse.comppgtocaixinha = '')`;

//                         if (incluirPagos) {
//                             // PAGO: Se o cachê está pago E a caixinha está paga (ou não é devida).
//                             const condicaoPago = `(
//                                 ${comprovanteCachePreenchido} 
//                                 AND 
//                                 (
//                                     ${vlrcaixinhaNaoDevido} 
//                                     OR 
//                                     (${vlrcaixinhaDevido} AND ${comprovanteCaixinhaPreenchido})
//                                 )
//                             )`;
//                             statusConditions.push(condicaoPago);
//                         }
                        
//                         if (incluirPendentes) {
//                             // PENDENTE: Se o cachê está pendente OU a caixinha é devida E está pendente.
//                             const condicaoPendente = `(
//                                 ${comprovanteCachePendente} 
//                                 OR 
//                                 (${vlrcaixinhaDevido} AND ${comprovanteCaixinhaPendente})
//                             )`;
//                             statusConditions.push(condicaoPendente);
//                         }
//                         } else if (tipo === 'cache_ajuda') {
//                             // Para cache_ajuda, consideramos "Pago" apenas se AMBOS (cachê e ajuda) estiverem com comprovante
//                             const comprovanteCacheOk = `(tse.comppgtocache IS NOT NULL AND tse.comppgtocache != '')`;
//                             const comprovanteAjudaOk = `(tse.comppgtoajdcusto IS NOT NULL AND tse.comppgtoajdcusto != '')`;

//                             if (incluirPagos) {
//                                 // PAGO: Tem os dois comprovantes anexados
//                                 statusConditions.push(`(${comprovanteCacheOk} AND ${comprovanteAjudaOk})`);
//                             }
//                             if (incluirPendentes) {
//                                 // PENDENTE: Se faltar qualquer um dos dois
//                                 statusConditions.push(`(${comprovanteCacheOk} IS FALSE OR ${comprovanteAjudaOk} IS FALSE)`);
//                             }
//                         }
//                     
//                     console.log("CONDICAO STATUS", statusConditions);
//                     if (statusConditions.length > 0) {
//                         // Se houver condições, adiciona ' AND (condicao1 OR condicao2)'
//                         whereStatus = ` AND (${statusConditions.join(' OR ')})`;
//                     }
//                 }       

//             //  wherePeriodo = wherePeriodo || "AND 1=1";
//             //  whereStatus = whereStatus || "AND 1=1";
//             //  phaseFilterSql = phaseFilterSql || "1=1";

//                 console.log("STATUS PAGTO", whereStatus, wherePeriodoFinal, phaseFilterSql);
            
//                 let queryFechamentoPrincipal = ''; // Variável para armazenar a query principal
                
//                 // **LÓGICA CONDICIONAL PARA O TIPO DE RELATÓRIO PRINCIPAL**
//                 if (tipo === 'ajuda_custo') {
//                     queryFechamentoPrincipal = `
//                         SELECT
//                             tse.idevento AS "idevento",
//                             tbf.perfil AS "PERFIL_STAFF",
//                             tse.nmevento AS "nomeEvento",
//                             tse.nmfuncao AS "FUNÇÃO",
//                             tse.idcliente AS "idcliente",
//                             tse.nmcliente AS "nomeCliente",
//                             tse.idequipe AS "idequipe",
//                             tse.nmequipe AS "nmequipe",
//                             tbf.nome AS "NOME",
//                             tbf.pix AS "PIX",                    
//                             (SELECT MIN(date_value::date) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value))::text AS "INÍCIO",
//                             (SELECT MAX(date_value::date) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value))::text AS "TÉRMINO",                   
                        
//                             CAST((COALESCE(tse.vlralimentacao, 0) + COALESCE(tse.vlrtransporte, 0)) AS NUMERIC(10,2)) AS "VLR DIÁRIA",
//                             jsonb_array_length(
//                                 (SELECT jsonb_agg(date_value) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value))
//                             ) AS "QTD",
//                             -- TOT DIÁRIAS (Valor total bruto)
//                             CAST((COALESCE(tse.vlralimentacao, 0) + COALESCE(tse.vlrtransporte, 0)) * (CASE WHEN tse.qtdpessoaslote IS NULL OR tse.qtdpessoaslote = 0 THEN 1 ELSE tse.qtdpessoaslote END) * jsonb_array_length(
//                                 (SELECT jsonb_agg(date_value) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value))
//                             ) AS NUMERIC(10,2)) AS "TOT DIÁRIAS",
//                             -- TOT GERAL (Mesmo valor do TOT DIÁRIAS para este relatório)
//                             CAST((COALESCE(tse.vlralimentacao, 0) + COALESCE(tse.vlrtransporte, 0)) * (CASE WHEN tse.qtdpessoaslote IS NULL OR tse.qtdpessoaslote = 0 THEN 1 ELSE tse.qtdpessoaslote END) * jsonb_array_length(
//                                 (SELECT jsonb_agg(date_value) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value))
//                             ) AS NUMERIC(10,2)) AS "TOT GERAL",
//                             -- STATUS PGTO baseado na coluna de status                    
//                             CASE
//                                 WHEN (COALESCE(tse.vlralimentacao, 0) + COALESCE(tse.vlrtransporte, 0)) = 0 THEN '--'
//                                 WHEN tse.statuspgtoajdcto = 'Pago' THEN 'Pago 100%'
//                                 WHEN tse.statuspgtoajdcto = 'Pago50' THEN 'Pago 50%'
//                                 ELSE COALESCE(tse.statuspgtoajdcto, 'Pendente')
//                             END AS "STATUS PGTO",    
//                             CASE 
//                                 WHEN (COALESCE(tse.vlralimentacao, 0) = 0 AND COALESCE(tse.vlrtransporte, 0) = 0) THEN 'Isento'
//                                 WHEN (tse.comppgtoajdcusto IS NOT NULL AND tse.comppgtoajdcusto != '') 
//                                     OR (tse.comppgtoajdcusto50 IS NOT NULL AND tse.comppgtoajdcusto50 != '' AND tse.comppgtoajdcusto IS NOT NULL AND tse.comppgtoajdcusto != '') THEN 'Anexado'
//                                 WHEN (tse.comppgtoajdcusto50 IS NOT NULL AND tse.comppgtoajdcusto50 != '') THEN '50% Anexado'
//                                 ELSE 'Pendente'
//                             END AS "COMP STATUS",                
//                             CAST(CASE
//                                 WHEN (COALESCE(tse.vlralimentacao, 0) + COALESCE(tse.vlrtransporte, 0)) = 0 THEN 0.00
//                                 WHEN tse.statuspgtoajdcto = 'Pago' THEN 0.00                        
//                                 WHEN tse.statuspgtoajdcto = 'Pago50' THEN 
//                                     ((COALESCE(tse.vlralimentacao, 0) + COALESCE(tse.vlrtransporte, 0)) * (CASE WHEN tse.qtdpessoaslote <= 0 THEN 1 ELSE tse.qtdpessoaslote END) * jsonb_array_length((SELECT jsonb_agg(date_value) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value)))
//                                     ) / 2.0
//                                 ELSE 
//                                     (COALESCE(tse.vlralimentacao, 0) + COALESCE(tse.vlrtransporte, 0)) * (CASE WHEN tse.qtdpessoaslote <= 0 THEN 1 ELSE tse.qtdpessoaslote END) * jsonb_array_length((SELECT jsonb_agg(date_value) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value)))
//                             END AS NUMERIC(10,2)) AS "TOT PAGAR"                   
//                         FROM
//                             staffeventos tse
//                         JOIN
//                             funcionarios tbf ON tse.idfuncionario = tbf.idfuncionario
//                         JOIN 
//                             staffempresas semp ON tse.idstaff = semp.idstaff
//                         WHERE semp.idempresa = $1
//                             ${whereStatus} 
//                             ${wherePeriodoFinal} 
//                             AND jsonb_array_length(
//                                 (SELECT jsonb_agg(date_value) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value)
//                                 WHERE ${phaseFilterSql})
//                             ) > 0
//                         ORDER BY
//                             tse.nmevento,
//                             tse.nmcliente,
//                             tbf.nome;
//                     `;

                
//                 } else if (tipo === 'cache') {
//                     queryFechamentoPrincipal = `
//                     WITH
//                     ano_evento AS (
//                         SELECT DISTINCT EXTRACT(YEAR FROM (date_value::date))::int AS ano
//                         FROM staffeventos tse,
//                             jsonb_array_elements_text(tse.datasevento) AS s(date_value)
//                         WHERE tse.idstaff IN (SELECT idstaff FROM staffempresas WHERE idempresa = $1)
//                     ),
//                     feriados AS (
//                         SELECT data::date FROM (
//                             SELECT make_date(a.ano, 1, 1) FROM ano_evento a UNION
//                             SELECT make_date(a.ano, 1, 25) FROM ano_evento a UNION
//                             SELECT make_date(a.ano, 4, 21) FROM ano_evento a UNION
//                             SELECT make_date(a.ano, 5, 1) FROM ano_evento a UNION
//                             SELECT make_date(a.ano, 7, 9) FROM ano_evento a UNION
//                             SELECT make_date(a.ano, 9, 7) FROM ano_evento a UNION
//                             SELECT make_date(a.ano, 10, 12) FROM ano_evento a UNION
//                             SELECT make_date(a.ano, 11, 2) FROM ano_evento a UNION
//                             SELECT make_date(a.ano, 11, 15) FROM ano_evento a UNION
//                             SELECT make_date(a.ano, 11, 20) FROM ano_evento a UNION
//                             SELECT make_date(a.ano, 12, 25) FROM ano_evento a UNION

//                             -- 2. FERIADOS MÓVEIS (Lógica simplificada para evitar ambiguidade)
//                             SELECT (calc.data_pascoa + (m.deslocamento || ' days')::interval)::date
//                             FROM (
//                                 SELECT 
//                                     make_date(ano, 
//                                             (h + l - 7 * m + 114) / 31, 
//                                             ((h + l - 7 * m + 114) % 31) + 1
//                                     ) AS data_pascoa
//                                 FROM (
//                                     SELECT 
//                                         ano, h, m, 
//                                         ((2 * (ano % 4) + 2 * ((ano % 100) / 4) - (ano % 100 % 4) + 32 - h) % 7) AS l
//                                     FROM (
//                                         SELECT 
//                                             ano, h, 
//                                             (( (ano % 19) + 11 * h + 22 * ((2 * (ano % 4) + 2 * ((ano % 100) / 4) - (ano % 100 % 4) + 32 - h) % 7) ) / 451) AS m
//                                         FROM (
//                                             SELECT 
//                                                 ano,
//                                                 ((19 * (ano % 19) + (ano / 100) - (ano / 400) - ((8 * (ano / 100) + 13) / 25) + 15) % 30) AS h
//                                             FROM ano_evento
//                                         ) AS sub_h
//                                     ) AS sub_m
//                                 ) AS sub_l
//                             ) AS calc
//                             CROSS JOIN (
//                                 VALUES 
//                                     (-48, 'Segunda Carnaval'),
//                                     (-47, 'Terça Carnaval'),
//                                     (-2,  'Sexta Santa'),
//                                     (0,   'Páscoa'),
//                                     (60,  'Corpus Christi')
//                             ) AS m(deslocamento, nome)

//                         ) f(data)
//                     ),
//                     diarias_autorizadas AS (
//                         SELECT
//                         tse.idstaffevento,
//                         -- DOBRAS
//                         COALESCE((
//                             SELECT SUM(
//                                 CASE
//                                     WHEN tbf.perfil ILIKE '%Free%' OR tbf.perfil ILIKE '%Lote%'
//                                         THEN COALESCE(tse.vlrcache, 0) + COALESCE(tse.vlralimentacao, 0)
//                                     WHEN EXTRACT(DOW FROM d.data::date) IN (0,6) OR d.data::date IN (SELECT data FROM feriados)
//                                         THEN COALESCE(tse.vlrcache, 0) + COALESCE(tse.vlralimentacao, 0)
//                                     ELSE COALESCE(tse.vlralimentacao, 0)
//                                 END
//                             )
//                             FROM jsonb_to_recordset(COALESCE(tse.dtdiariadobrada, '[]'::jsonb)) AS d(data text, status text)
//                             WHERE d.status = 'Autorizado'
//                         ), 0) AS vlr_dobras,
//                         -- MEIAS
//                         COALESCE((
//                             SELECT SUM(
//                                 CASE
//                                     WHEN tbf.perfil ILIKE '%Free%' OR tbf.perfil ILIKE '%Lote%'
//                                         THEN (COALESCE(tse.vlrcache, 0) / 2.0) + COALESCE(tse.vlralimentacao, 0)
//                                     WHEN EXTRACT(DOW FROM m.data::date) IN (0,6) OR m.data::date IN (SELECT data FROM feriados)
//                                         THEN (COALESCE(tse.vlrcache, 0) / 2.0) + COALESCE(tse.vlralimentacao, 0)
//                                     ELSE COALESCE(tse.vlralimentacao, 0)
//                                 END
//                             )
//                             FROM jsonb_to_recordset(COALESCE(tse.dtmeiadiaria, '[]'::jsonb)) AS m(data text, status text)
//                             WHERE m.status = 'Autorizado'
//                         ), 0) AS vlr_meias

//                         FROM staffeventos tse
//                         JOIN funcionarios tbf ON tbf.idfuncionario = tse.idfuncionario
//                         JOIN staffempresas semp ON tse.idstaff = semp.idstaff                        
//                         WHERE semp.idempresa = $1 ${wherePeriodoFinal}
//                     )
//                     SELECT 
//                         *,
//                         -- Correção: Forçando CAST e tratando QTDPESSOAS para evitar zerar o cálculo
//                         CAST(
//                             (COALESCE("VLR DIÁRIA", 0) * (CASE WHEN COALESCE("QTDPESSOAS", 0) <= 0 THEN 1 ELSE "QTDPESSOAS" END) * COALESCE("QTD", 0)) 
//                         AS NUMERIC(10,2)) AS "TOT DIÁRIAS",
                        
//                         CAST(
//                             ((COALESCE("VLR DIÁRIA", 0) * (CASE WHEN COALESCE("QTDPESSOAS", 0) <= 0 THEN 1 ELSE "QTDPESSOAS" END) * COALESCE("QTD", 0)) + COALESCE("VLR ADICIONAL", 0)) 
//                         AS NUMERIC(10,2)) AS "TOT GERAL"
//                     FROM (
//                         SELECT
//                             tse.idevento,
//                             tbf.perfil AS "PERFIL_STAFF",
//                             tse.nmevento AS "nomeEvento",
//                             tse.idcliente,
//                             tse.nmcliente AS "nomeCliente",
//                             tse.idequipe,
//                             tse.nmequipe AS "nmequipe",
//                             COALESCE(tse.qtdpessoaslote, 1) AS "QTDPESSOAS", -- Garante valor mínimo 1
//                             tse.nmfuncao AS "FUNÇÃO",
//                             tse.statuspgtocaixinha AS "STATUS CAIXINHA",
//                             tbf.nome AS "NOME",
//                             tbf.pix AS "PIX",
//                             tbf.perfil AS "PERFIL_FUNC",
//                             (SELECT MIN(d_val::date) FROM jsonb_array_elements_text(tse.datasevento) AS d_val)::text AS "INÍCIO",
//                             (SELECT MAX(d_val::date) FROM jsonb_array_elements_text(tse.datasevento) AS d_val)::text AS "TÉRMINO",
                            
//                             (
//                                 SELECT COUNT(*)::int
//                                 FROM jsonb_array_elements_text(tse.datasevento) AS s(date_val)
//                                 WHERE date_val::date >= $2::date AND date_val::date <= $3::date
//                                 AND (
//                                     tbf.perfil ILIKE '%Free%' 
//                                     OR 
//                                     ((tbf.perfil ILIKE '%Interno%' OR tbf.perfil ILIKE '%Externo%') 
//                                     AND (EXTRACT(DOW FROM date_val::date) IN (0, 6) OR date_val::date IN (SELECT data FROM feriados)))
//                                 )
//                             ) AS "QTD",

//                             CAST(COALESCE(tse.vlrcache, 0) AS NUMERIC(10,2)) AS "VLR DIÁRIA",

//                             CAST((
//                                 COALESCE(CASE WHEN tse.statusajustecusto = 'Autorizado' THEN tse.vlrajustecusto ELSE 0 END, 0) +
//                                 COALESCE(CASE WHEN tse.statuscaixinha = 'Autorizado' THEN tse.vlrcaixinha ELSE 0 END, 0) +
//                                 COALESCE(da.vlr_dobras, 0) +
//                                 COALESCE(da.vlr_meias, 0)
//                             ) AS NUMERIC(10, 2)) AS "VLR ADICIONAL",

//                             -- STATUS PGTO com a sua regra para exibir '---' quando não houver valor
//                             CASE
//                                 WHEN COALESCE(tse.vlrcache, 0) = 0 THEN '---'
//                                 WHEN (tse.comppgtocache IS NOT NULL AND tse.comppgtocache != '')
//                                 AND (CAST(COALESCE(NULLIF(TRIM(tse.vlrcaixinha::TEXT), ''), '0') AS NUMERIC) <= 0
//                                     OR (CAST(COALESCE(NULLIF(TRIM(tse.vlrcaixinha::TEXT), ''), '0') AS NUMERIC) > 0 AND (tse.comppgtocaixinha IS NOT NULL AND tse.comppgtocaixinha != '')))
//                                 THEN 'Pago' ELSE 'Pendente'
//                             END AS "STATUS PGTO",                    
//                             CASE 
//                                 -- 1. ISENTO
//                                 WHEN (COALESCE(tse.vlrcache, 0) <= 0 AND COALESCE(tse.vlrcaixinha, 0) <= 0) THEN 'Isento'

//                                 -- 2. TUDO PENDENTE (Cachê > 0 e Caixinha > 0, mas ambos sem comprovante)
//                                 WHEN (COALESCE(tse.vlrcache, 0) > 0 AND (tse.comppgtocache IS NULL OR tse.comppgtocache = ''))
//                                     AND (COALESCE(tse.vlrcaixinha, 0) > 0 AND (tse.comppgtocaixinha IS NULL OR tse.comppgtocaixinha = ''))
//                                     THEN 'Cachê e Caixinha Pendentes'

//                                 -- 3. CACHÊ PENDENTE (Mas Caixinha está OK ou é Isenta)
//                                 WHEN (COALESCE(tse.vlrcache, 0) > 0 AND (tse.comppgtocache IS NULL OR tse.comppgtocache = ''))
//                                     AND (COALESCE(tse.vlrcaixinha, 0) <= 0 OR (tse.comppgtocaixinha IS NOT NULL AND tse.comppgtocaixinha != ''))
//                                     THEN 'Cachê Pendente'

//                                 -- 4. CAIXINHA PENDENTE (Mas Cachê está OK ou é Isento)
//                                 WHEN (COALESCE(tse.vlrcaixinha, 0) > 0 AND (tse.comppgtocaixinha IS NULL OR tse.comppgtocaixinha = ''))
//                                     AND (COALESCE(tse.vlrcache, 0) <= 0 OR (tse.comppgtocache IS NOT NULL AND tse.comppgtocache != ''))
//                                     THEN 'Caixinha Pendente'

//                                 -- 5. AMBOS ANEXADOS
//                                 WHEN (COALESCE(tse.vlrcache, 0) > 0 AND tse.comppgtocache IS NOT NULL AND tse.comppgtocache != '') 
//                                     AND (COALESCE(tse.vlrcaixinha, 0) > 0 AND tse.comppgtocaixinha IS NOT NULL AND tse.comppgtocaixinha != '') 
//                                     THEN 'Cachê e Caixinha Anexados'

//                                 -- 6. CACHÊ ANEXADO (Mas tem valor de Caixinha faltando ou Caixinha é isenta)
//                                 WHEN (COALESCE(tse.vlrcache, 0) > 0 AND tse.comppgtocache IS NOT NULL AND tse.comppgtocache != '') 
//                                     THEN CASE 
//                                             WHEN COALESCE(tse.vlrcaixinha, 0) > 0 AND (tse.comppgtocaixinha IS NULL OR tse.comppgtocaixinha = '') 
//                                             THEN 'Cachê Anexado (Falta Caixinha)'
//                                             ELSE 'Cachê Anexado'
//                                         END

//                                 -- 7. CAIXINHA ANEXADA (Caso o cachê seja zero e a caixinha tenha valor e comprovante)
//                                 WHEN (COALESCE(tse.vlrcaixinha, 0) > 0 AND tse.comppgtocaixinha IS NOT NULL AND tse.comppgtocaixinha != '') 
//                                     AND COALESCE(tse.vlrcache, 0) <= 0
//                                     THEN 'Caixinha Anexada'

//                                 ELSE 'Comprovantes Pendentes'
//                             END AS "COMP STATUS",
//                             CAST((
//                                 CASE 
//                                     WHEN tse.statuspgto IS DISTINCT FROM 'Pago'
//                                     THEN (COALESCE(tse.vlrcache, 0) * (CASE WHEN COALESCE(tse.qtdpessoaslote, 0) <= 0 THEN 1 ELSE tse.qtdpessoaslote END) * (
//                                         SELECT COUNT(*)::int
//                                         FROM jsonb_array_elements_text(tse.datasevento) AS s(date_val)
//                                         WHERE date_val::date >= $2::date AND date_val::date <= $3::date
//                                         AND (
//                                             tbf.perfil ILIKE '%Free%' 
//                                             OR 
//                                             ((tbf.perfil ILIKE '%Interno%' OR tbf.perfil ILIKE '%Externo%') 
//                                             AND (EXTRACT(DOW FROM date_val::date) IN (0, 6) OR date_val::date IN (SELECT data FROM feriados)))
//                                         )
//                                     ))
//                                     ELSE 0 
//                                 END +
//                                 CASE WHEN (tse.statuspgto IS DISTINCT FROM 'Pago') AND tse.statusajustecusto = 'Autorizado' THEN COALESCE(tse.vlrajustecusto, 0) ELSE 0 END +
//                                 CASE WHEN (tse.statuspgtocaixinha IS DISTINCT FROM 'Pago') AND tse.statuscaixinha = 'Autorizado' THEN COALESCE(tse.vlrcaixinha, 0) ELSE 0 END +
//                                 CASE WHEN tse.statuspgto IS DISTINCT FROM 'Pago' THEN 
//                                     COALESCE(da.vlr_dobras, 0) + COALESCE(da.vlr_meias, 0)
//                                     ELSE 0 
//                                 END
//                             ) AS NUMERIC(10,2)) AS "TOT PAGAR"

//                         FROM staffeventos tse
//                         JOIN funcionarios tbf ON tse.idfuncionario = tbf.idfuncionario
//                         JOIN staffempresas semp ON tse.idstaff = semp.idstaff
//                         LEFT JOIN diarias_autorizadas da ON tse.idstaffevento = da.idstaffevento
//                         WHERE semp.idempresa = $1 
//                             ${whereStatus} 
//                             ${wherePeriodoFinal} 
//                             AND jsonb_array_length(
//                                 (SELECT jsonb_agg(date_value) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value)
//                                 WHERE ${phaseFilterSql})
//                             ) > 0
//                     ) AS subquery
//                     WHERE ("QTD" > 0 OR "VLR ADICIONAL" != 0)
//                     ORDER BY "nomeEvento", "NOME";
//                     `;


//                 } else if (tipo === 'operacional') {
//                     queryFechamentoPrincipal = `
//                     WITH ano_evento AS (
//                         SELECT DISTINCT EXTRACT(YEAR FROM (date_value::date))::int AS ano
//                         FROM staffeventos tse,
//                             jsonb_array_elements_text(tse.datasevento) AS s(date_value)
//                         WHERE tse.idstaff IN (SELECT idstaff FROM staffempresas WHERE idempresa = $1)
//                     ),
//                     feriados AS (
//                         SELECT data::date FROM (
//                             SELECT make_date(a.ano, 1, 1) FROM ano_evento a UNION
//                             SELECT make_date(a.ano, 1, 25) FROM ano_evento a UNION
//                             SELECT make_date(a.ano, 4, 21) FROM ano_evento a UNION
//                             SELECT make_date(a.ano, 5, 1) FROM ano_evento a UNION
//                             SELECT make_date(a.ano, 7, 9) FROM ano_evento a UNION --Revolução Constitucionalista de 1932
//                             SELECT make_date(a.ano, 9, 7) FROM ano_evento a UNION
//                             SELECT make_date(a.ano, 10, 12) FROM ano_evento a UNION
//                             SELECT make_date(a.ano, 11, 2) FROM ano_evento a UNION
//                             SELECT make_date(a.ano, 11, 15) FROM ano_evento a UNION
//                             SELECT make_date(a.ano, 11, 20) FROM ano_evento a UNION
//                             SELECT make_date(a.ano, 12, 25) FROM ano_evento a UNION

//                             -- 2. FERIADOS MÓVEIS (Lógica simplificada para evitar ambiguidade)
//                             SELECT (calc.data_pascoa + (m.deslocamento || ' days')::interval)::date
//                             FROM (
//                                 SELECT 
//                                     make_date(ano, 
//                                             (h + l - 7 * m + 114) / 31, 
//                                             ((h + l - 7 * m + 114) % 31) + 1
//                                     ) AS data_pascoa
//                                 FROM (
//                                     SELECT 
//                                         ano, h, m, 
//                                         ((2 * (ano % 4) + 2 * ((ano % 100) / 4) - (ano % 100 % 4) + 32 - h) % 7) AS l
//                                     FROM (
//                                         SELECT 
//                                             ano, h, 
//                                             (( (ano % 19) + 11 * h + 22 * ((2 * (ano % 4) + 2 * ((ano % 100) / 4) - (ano % 100 % 4) + 32 - h) % 7) ) / 451) AS m
//                                         FROM (
//                                             SELECT 
//                                                 ano,
//                                                 ((19 * (ano % 19) + (ano / 100) - (ano / 400) - ((8 * (ano / 100) + 13) / 25) + 15) % 30) AS h
//                                             FROM ano_evento
//                                         ) AS sub_h
//                                     ) AS sub_m
//                                 ) AS sub_l
//                             ) AS calc
//                             CROSS JOIN (
//                                 VALUES 
//                                     (-48, 'Segunda Carnaval'),
//                                     (-47, 'Terça Carnaval'),
//                                     (-2,  'Sexta Santa'),
//                                     (0,   'Páscoa'),
//                                     (60,  'Corpus Christi')
//                             ) AS m(deslocamento, nome)

//                         ) f(data)
//                     )
//                     SELECT
//                         tse.idevento,
//                         tbf.perfil AS "PERFIL_STAFF",
//                         tse.nmevento AS "nomeEvento",
//                         tse.idcliente,
//                         tse.nmcliente AS "nomeCliente",
//                         tse.idequipe,
//                         tse.nmequipe,
//                         tse.nmfuncao AS "FUNÇÃO",
//                         tbf.nome AS "NOME",
//                         tbf.cpf AS "CPF",
//                         (SELECT MIN(date_value::date) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value))::text AS "INÍCIO",
//                         (SELECT MAX(date_value::date) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value))::text AS "TÉRMINO",
                        
//                         -- Coluna QTD
//                         (SELECT COUNT(*) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_val)
//                         WHERE date_val::date BETWEEN $2::date AND $3::date
//                         AND (
//                             tbf.perfil ILIKE '%Free%'
//                             OR (
//                                 (tbf.perfil ILIKE '%Interno%' OR tbf.perfil ILIKE '%Externo%')
//                                 AND (EXTRACT(DOW FROM date_val::date) IN (0, 6) OR date_val::date IN (SELECT data FROM feriados))
//                             )
//                         )) AS "QTD",

//                         -- Coluna VLR ADICIONAL
//                         CAST(
//                             COALESCE(CASE WHEN tse.statusajustecusto = 'Autorizado' THEN tse.vlrajustecusto ELSE 0 END, 0.00) +
//                             COALESCE(CASE WHEN tse.statuscaixinha = 'Autorizado' THEN tse.vlrcaixinha ELSE 0 END, 0.00)
//                         AS NUMERIC(10, 2)) AS "VLR ADICIONAL",

//                         -- Coluna TOT GERAL
//                         CAST(
//                             (COALESCE(tse.vlrcache, 0.00) * (CASE WHEN tse.qtdpessoaslote IS NULL OR tse.qtdpessoaslote = 0 THEN 1 ELSE tse.qtdpessoaslote END) * (
//                                 SELECT COUNT(*)
//                                 FROM jsonb_array_elements_text(tse.datasevento) AS s(date_val)
//                                 WHERE date_val::date BETWEEN $2::date AND $3::date
//                                 AND (
//                                     tbf.perfil ILIKE '%Free%' 
//                                     OR 
//                                     ((tbf.perfil ILIKE '%Interno%' OR tbf.perfil ILIKE '%Externo%') 
//                                     AND (EXTRACT(DOW FROM date_val::date) IN (0, 6) OR date_val::date IN (SELECT data FROM feriados)))
//                                 )
//                             )) +
//                             COALESCE(CASE WHEN tse.statusajustecusto = 'Autorizado' THEN tse.vlrajustecusto ELSE 0 END, 0.00) +
//                             COALESCE(CASE WHEN tse.statuscaixinha = 'Autorizado' THEN tse.vlrcaixinha ELSE 0 END, 0.00)
//                         AS NUMERIC(10, 2)) AS "TOT GERAL",

//                         -- Coluna STATUS PGTO
//                         CASE
//                             WHEN (tse.comppgtocache IS NOT NULL AND tse.comppgtocache != '')
//                             AND (CAST(COALESCE(NULLIF(TRIM(tse.vlrcaixinha::TEXT), ''), '0') AS NUMERIC) <= 0
//                                 OR (CAST(COALESCE(NULLIF(TRIM(tse.vlrcaixinha::TEXT), ''), '0') AS NUMERIC) > 0 AND (tse.comppgtocaixinha IS NOT NULL AND tse.comppgtocaixinha != '')))
//                             THEN 'Pago' ELSE 'Pendente'
//                         END AS "STATUS PGTO"

//                     FROM staffeventos tse
//                     JOIN funcionarios tbf ON tse.idfuncionario = tbf.idfuncionario
//                     JOIN staffempresas semp ON tse.idstaff = semp.idstaff
//                     WHERE semp.idempresa = $1
//                         ${whereStatus} 
//                         ${wherePeriodoFinal} 
//                         AND jsonb_array_length(
//                             (SELECT jsonb_agg(date_value) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value)
//                             WHERE ${phaseFilterSql})
//                         ) > 0
//                     ORDER BY tse.nmevento, tbf.nome;
//                     `;
//                 } else if (tipo === 'cache_ajuda') {
//                     queryFechamentoPrincipal = `
//                     WITH ano_evento AS (
//                             SELECT DISTINCT EXTRACT(YEAR FROM (date_value::date))::int AS ano
//                             FROM staffeventos tse,
//                                 jsonb_array_elements_text(tse.datasevento) AS s(date_value)
//                             WHERE tse.idstaff IN (SELECT idstaff FROM staffempresas WHERE idempresa = $1)
//                         ),
//                         feriados AS (
//                             SELECT data::date FROM (
//                                 SELECT make_date(a.ano, 1, 1) FROM ano_evento a UNION
//                                 SELECT make_date(a.ano, 1, 25) FROM ano_evento a UNION
//                                 SELECT make_date(a.ano, 4, 21) FROM ano_evento a UNION
//                                 SELECT make_date(a.ano, 5, 1) FROM ano_evento a UNION
//                                 SELECT make_date(a.ano, 7, 9) FROM ano_evento a UNION
//                                 SELECT make_date(a.ano, 9, 7) FROM ano_evento a UNION
//                                 SELECT make_date(a.ano, 10, 12) FROM ano_evento a UNION
//                                 SELECT make_date(a.ano, 11, 2) FROM ano_evento a UNION
//                                 SELECT make_date(a.ano, 11, 15) FROM ano_evento a UNION
//                                 SELECT make_date(a.ano, 11, 20) FROM ano_evento a UNION
//                                 SELECT make_date(a.ano, 12, 25) FROM ano_evento a UNION

//                                 -- 2. FERIADOS MÓVEIS (Lógica simplificada para evitar ambiguidade)
//                                 SELECT (calc.data_pascoa + (m.deslocamento || ' days')::interval)::date
//                                 FROM (
//                                     SELECT 
//                                         make_date(ano, 
//                                                 (h + l - 7 * m + 114) / 31, 
//                                                 ((h + l - 7 * m + 114) % 31) + 1
//                                         ) AS data_pascoa
//                                     FROM (
//                                         SELECT 
//                                             ano, h, m, 
//                                             ((2 * (ano % 4) + 2 * ((ano % 100) / 4) - (ano % 100 % 4) + 32 - h) % 7) AS l
//                                         FROM (
//                                             SELECT 
//                                                 ano, h, 
//                                                 (( (ano % 19) + 11 * h + 22 * ((2 * (ano % 4) + 2 * ((ano % 100) / 4) - (ano % 100 % 4) + 32 - h) % 7) ) / 451) AS m
//                                             FROM (
//                                                 SELECT 
//                                                     ano,
//                                                     ((19 * (ano % 19) + (ano / 100) - (ano / 400) - ((8 * (ano / 100) + 13) / 25) + 15) % 30) AS h
//                                                 FROM ano_evento
//                                             ) AS sub_h
//                                         ) AS sub_m
//                                     ) AS sub_l
//                                 ) AS calc
//                                 CROSS JOIN (
//                                     VALUES 
//                                         (-48, 'Segunda Carnaval'),
//                                         (-47, 'Terça Carnaval'),
//                                         (-2,  'Sexta Santa'),
//                                         (0,   'Páscoa'),
//                                         (60,  'Corpus Christi')
//                                 ) AS m(deslocamento, nome)

//                             ) f(data)
//                         ),
//                         diarias_autorizadas AS (
//                             SELECT
//                                 tse.idstaffevento,
//                                 -- DOBRAS
//                                 COALESCE((
//                                     SELECT SUM(
//                                         CASE
//                                             WHEN tbf.perfil ILIKE '%Free%' OR tbf.perfil ILIKE '%Lote%'
//                                                 THEN COALESCE(tse.vlrcache, 0) + COALESCE(tse.vlralimentacao, 0)
//                                             WHEN EXTRACT(DOW FROM d.data::date) IN (0,6) OR d.data::date IN (SELECT data FROM feriados)
//                                                 THEN COALESCE(tse.vlrcache, 0) + COALESCE(tse.vlralimentacao, 0)
//                                             ELSE COALESCE(tse.vlralimentacao, 0)
//                                         END
//                                     )
//                                     FROM jsonb_to_recordset(COALESCE(tse.dtdiariadobrada, '[]'::jsonb)) AS d(data text, status text)
//                                     WHERE d.status = 'Autorizado'
//                                 ), 0) AS vlr_dobras,
//                                 -- MEIAS
//                                 COALESCE((
//                                     SELECT SUM(
//                                         CASE
//                                             WHEN tbf.perfil ILIKE '%Free%' OR tbf.perfil ILIKE '%Lote%'
//                                                 THEN (COALESCE(tse.vlrcache, 0) / 2.0) + COALESCE(tse.vlralimentacao, 0)
//                                             WHEN EXTRACT(DOW FROM m.data::date) IN (0,6) OR m.data::date IN (SELECT data FROM feriados)
//                                                 THEN (COALESCE(tse.vlrcache, 0) / 2.0) + COALESCE(tse.vlralimentacao, 0)
//                                             ELSE COALESCE(tse.vlralimentacao, 0)
//                                         END
//                                     )
//                                     FROM jsonb_to_recordset(COALESCE(tse.dtmeiadiaria, '[]'::jsonb)) AS m(data text, status text)
//                                     WHERE m.status = 'Autorizado'
//                                 ), 0) AS vlr_meias
//                             FROM staffeventos tse
//                             JOIN funcionarios tbf ON tbf.idfuncionario = tse.idfuncionario
//                             JOIN staffempresas semp ON tse.idstaff = semp.idstaff
//                             WHERE semp.idempresa = $1 ${wherePeriodoFinal}
//                         )
//                         SELECT 
//                             sub.*,
//                             CAST(COALESCE(sub.vlrtotcache, 0) AS NUMERIC(10,2)) AS "TOT DIÁRIAS",
//                             CAST(COALESCE(sub.vlrtotajdcusto, 0) AS NUMERIC(10,2)) AS "TOT AJUDA",
//                             CAST((sub."VLR CACHÊ" * sub."QTD") + (sub."VLR AJUDA" * sub."QTD_AJUDA") + sub."VLR ADICIONAL" AS NUMERIC(10,2)) AS "TOT GERAL",
//                             CAST(CASE 
//                                 WHEN (sub."STATUS CACHÊ" = 'Pago' AND sub."STATUS AJUDA" = 'Pago') THEN 0 
//                                 WHEN (sub."STATUS CACHÊ" = 'Pago') THEN (sub."VLR AJUDA" * sub."QTD_AJUDA")
//                                 WHEN (sub."STATUS AJUDA" = 'Pago') THEN (sub."VLR CACHÊ" * sub."QTD") + sub."VLR ADICIONAL"
//                                 ELSE (sub."VLR CACHÊ" * sub."QTD") + (sub."VLR AJUDA" * sub."QTD_AJUDA") + sub."VLR ADICIONAL"
//                             END AS NUMERIC(10,2)) AS "TOT PAGAR"
//                         FROM (
//                             SELECT 
//                                 tse.idevento, 
//                                 tse.nmcliente AS "nomeCliente",
//                                 tse.nmevento AS "nomeEvento", 
//                                 tse.nmfuncao AS "FUNÇÃO",
//                                 tbf.nome AS "NOME", 
//                                 tse.vlrtotcache,  
//                                 tse.vlrtotajdcusto, 
//                                 tbf.pix AS "PIX",
//                                 tbf.perfil AS "PERFIL_STAFF",
//                                 (SELECT MIN(d_val::date) FROM jsonb_array_elements_text(tse.datasevento) AS d_val)::text AS "INÍCIO",
//                                 (SELECT MAX(d_val::date) FROM jsonb_array_elements_text(tse.datasevento) AS d_val)::text AS "TÉRMINO",
                                
//                                 -- QTD_CACHE: Regra de negócio (Interno/Externo só ganha FDS e Feriado)
//                                 (SELECT COUNT(*)::int
//                                 FROM jsonb_array_elements_text(tse.datasevento) AS s(date_val)
//                                 WHERE date_val::date >= $2::date AND date_val::date <= $3::date
//                                 AND (
//                                     tbf.perfil ILIKE '%Free%' 
//                                     OR ((tbf.perfil ILIKE '%Interno%' OR tbf.perfil ILIKE '%Externo%') 
//                                     AND (EXTRACT(DOW FROM date_val::date) IN (0, 6) OR date_val::date IN (SELECT data FROM feriados)))
//                                 )
//                                 ) AS "QTD",

//                                 -- QTD_AJUDA: Todos os dias trabalhados
//                                 (SELECT COUNT(*)::int
//                                 FROM jsonb_array_elements_text(tse.datasevento) AS s(date_val)
//                                 WHERE date_val::date >= $2::date AND date_val::date <= $3::date
//                                 ) AS "QTD_AJUDA",

//                                 CAST(COALESCE(tse.vlrcache, 0) AS NUMERIC(10,2)) AS "VLR CACHÊ",
//                                 CAST((COALESCE(tse.vlralimentacao, 0) + COALESCE(tse.vlrtransporte, 0)) AS NUMERIC(10,2)) AS "VLR AJUDA",

//                                 CAST((
//                                     COALESCE(CASE WHEN tse.statusajustecusto = 'Autorizado' THEN tse.vlrajustecusto ELSE 0 END, 0) +
//                                     COALESCE(CASE WHEN tse.statuscaixinha = 'Autorizado' THEN tse.vlrcaixinha ELSE 0 END, 0) +
//                                     COALESCE(da.vlr_dobras, 0) +
//                                     COALESCE(da.vlr_meias, 0)
//                                 ) AS NUMERIC(10, 2)) AS "VLR ADICIONAL",

//                                 COALESCE(tse.statuspgto, 'Pendente') AS "STATUS CACHÊ",
//                                 COALESCE(tse.statuspgtoajdcto, 'Pendente') AS "STATUS AJUDA",
//                                 CASE WHEN (tse.comppgtocache IS NOT NULL AND tse.comppgtocache != '') THEN 'Anexado' ELSE 'Pendente' END AS "COMP CACHÊ",
//                                 CASE WHEN (tse.comppgtoajdcusto IS NOT NULL AND tse.comppgtoajdcusto != '') THEN 'Anexado' ELSE 'Pendente' END AS "COMP AJUDA"
//                             FROM staffeventos tse
//                             JOIN funcionarios tbf ON tse.idfuncionario = tbf.idfuncionario
//                             JOIN staffempresas semp ON tse.idstaff = semp.idstaff
//                             LEFT JOIN diarias_autorizadas da ON tse.idstaffevento = da.idstaffevento
//                             WHERE semp.idempresa = $1 ${wherePeriodoFinal} ${whereStatus}
//                             AND jsonb_array_length((SELECT jsonb_agg(date_value) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value) WHERE ${phaseFilterSql})) > 0
//                         ) AS sub
//                         ORDER BY sub."nomeEvento", sub."NOME";
//             `;
//                 }
//             console.log("QUERY FECHAMENTO PRINCIPAL:", queryFechamentoPrincipal);
            
//             const resultFechamentoPrincipal = await pool.query(queryFechamentoPrincipal, params);
//             const fechamentoCache = resultFechamentoPrincipal.rows; 
//             relatorio.fechamentoCache = fechamentoCache;

//             // --- CALCULA TOTAIS PARA FECHAMENTO CACHÊ / AJUDA DE CUSTO POR EVENTO ---
//             const totaisPorEvento = {};
//             fechamentoCache.forEach(item => {
//                 const eventoId = item.idevento;
//                 if (!totaisPorEvento[eventoId]) {
//                     totaisPorEvento[eventoId] = {
//                         totalVlrAdicional: 0,
//                         totalQtdDiarias: 0,
//                         totalQtdAjuda:0,
//                         totalVlrDiarias:0,
//                         totalTotalQtdDiarias:0,
//                         totalTotalQtdAjuda:0,
//                         totalTotalAdicional:0,
//                         totalTotalDiarias: 0,
//                         totalTotalAjuda:0,
//                         totalTotalGeral: 0,
//                         totalTotalPagar: 0
//                     };
//                 }
                
//                 totaisPorEvento[eventoId].totalVlrAdicional += parseFloat(item["VLR ADICIONAL"] || 0);
//                 totaisPorEvento[eventoId].totalQtdDiarias += parseInt(item["QTD"] || 0);
//                 totaisPorEvento[eventoId].totalQtdAjuda += parseInt(item["QTD_AJUDA"] || 0);
//                 totaisPorEvento[eventoId].totalVlrDiarias += parseFloat(item["VLR DIÁRIA"] || 0);
//                 totaisPorEvento[eventoId].totalTotalQtdDiarias += parseInt(item["QTD"] || 0);
//                 totaisPorEvento[eventoId].totalTotalQtdAjuda += parseInt(item["QTD_AJUDA"] || 0);
//                 totaisPorEvento[eventoId].totalTotalAdicional += parseFloat(item["VLR ADICIONAL"] || 0);  
//                 totaisPorEvento[eventoId].totalTotalDiarias += parseFloat(item["TOT DIÁRIAS"] || 0);                
//                 totaisPorEvento[eventoId].totalTotalAjuda += parseFloat(item["TOT AJUDA"] || 0);
//                 totaisPorEvento[eventoId].totalTotalGeral += parseFloat(item["TOT GERAL"] || 0);
//                 totaisPorEvento[eventoId].totalTotalPagar += parseFloat(item["TOT PAGAR"] || 0);
//             // console.log('Item:', totaisPorEvento[eventoId]);
//             });
//             relatorio.fechamentoCacheTotaisPorEvento = totaisPorEvento;

//             let whereEventosExiste = whereEventos.replace(' AND ', '');
//                 // 2. Substitui o alias 'tse.' pelo alias 'inner_tse.' nas subqueries (se for o caso da queryUtilizacaoDiarias)
//                 whereEventosExiste = whereEventosExiste.replace(/tse\./g, 'inner_tse.');

//             const queryUtilizacaoDiarias = `
//                 SELECT
//                         o.idevento,
//                         o.nrorcamento,
//                         oi.produto AS "INFORMAÇÕES EM PROPOSTA",
//                         SUM(oi.qtditens) AS "QTD PROFISSIONAIS",
//                         SUM(oi.qtditens * oi.qtddias) AS "DIÁRIAS CONTRATADAS",
//                         -- Usamos a contagem seletiva que funcionou no pgAdmin
//                         COALESCE(MAX(td.diarias_utilizadas_no_periodo), 0) AS "DIÁRIAS UTILIZADAS",
//                         SUM(oi.qtditens * oi.qtddias) - COALESCE(MAX(td.diarias_utilizadas_no_periodo), 0) AS "SALDO"
//                     FROM
//                         orcamentos o
//                     JOIN orcamentoitens oi ON oi.idorcamento = o.idorcamento
//                     JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
//                     LEFT JOIN (
//                         SELECT
//                             tse.idevento,
//                             tse.idcliente,
//                             semp.idempresa,
//                             tse.nmfuncao,
//                             -- AQUI ESTÁ A CORREÇÃO: Conta apenas os dias do período solicitado
//                             SUM((
//                                 SELECT COUNT(*) 
//                                 FROM jsonb_array_elements_text(tse.datasevento) AS s(date_val)
//                                 WHERE date_val::date >= $2::date AND date_val::date <= $3::date
//                             )) AS diarias_utilizadas_no_periodo
//                         FROM
//                             staffeventos tse
//                         JOIN staffempresas semp ON semp.idstaff = tse.idstaff
//                         WHERE
//                             semp.idempresa = $1
//                         GROUP BY
//                             tse.idevento, tse.idcliente, semp.idempresa, tse.nmfuncao
//                     ) AS td ON td.idevento = o.idevento
//                             AND td.idcliente = o.idcliente
//                             AND td.idempresa = oe.idempresa
//                             AND td.nmfuncao = oi.produto
//                     WHERE
//                         oe.idempresa = $1
//                         -- ESTA É A TRAVA REAL: O orçamento deve estar dentro do ano/período selecionado
//                         -- Se o filtro é 2026, orçamentos de 2025 morrem aqui.
//                         AND o.dtinirealizacao >= $2::date 
//                         AND o.dtinirealizacao <= $3::date
                        
//                         AND EXISTS (
//                             SELECT 1
//                             FROM staffeventos inner_tse
//                             JOIN staffempresas inner_semp ON inner_semp.idstaff = inner_tse.idstaff 
//                                 AND inner_semp.idempresa = oe.idempresa
//                             CROSS JOIN jsonb_array_elements_text(inner_tse.datasevento) AS inner_event_date
//                             WHERE 
//                                 inner_tse.idevento = o.idevento
//                                 AND inner_tse.idcliente = o.idcliente
//                                 -- Garante que o staff também tenha diárias nesse período
//                                 AND inner_event_date::date >= $2::date
//                                 AND inner_event_date::date <= $3::date
                                
//                                 -- Filtros opcionais dos selects da tela
//                                 AND ($4::text IS NULL OR $4::text = '' OR inner_tse.idevento::text = $4::text)
//                                 AND ($5::text IS NULL OR $5::text = '' OR inner_tse.idcliente::text = $5::text)
//                                 AND ($6::text IS NULL OR $6::text = '' OR inner_tse.idequipe::text = $6::text)
//                         )
//                     GROUP BY
//                         o.idevento, o.nrorcamento, oi.produto
//                     ORDER BY
//                         o.idevento, o.nrorcamento, oi.produto;
//             `;
//         //const resultUtilizacaoDiarias = await pool.query(queryUtilizacaoDiarias, [idempresa, dataInicio, dataFim]);
//         const resultUtilizacaoDiarias = await pool.query(queryUtilizacaoDiarias, params);
//         relatorio.utilizacaoDiarias = resultUtilizacaoDiarias.rows;        

//         const queryContingencia = `
//             WITH calculos_adicionais AS (
//                 SELECT
//                     tse.idstaffevento,
//                     tse.idfuncionario,
//                     (COALESCE(tse.vlrcache, 0) + COALESCE(tse.vlralimentacao, 0)) * COALESCE(jsonb_array_length(tse.dtdiariadobrada), 0) AS valor_dobrada,
//                     ((COALESCE(tse.vlrcache, 0) / 2) + COALESCE(tse.vlralimentacao, 0)) * COALESCE(jsonb_array_length(tse.dtmeiadiaria), 0) AS valor_meia_diaria
//                 FROM
//                     staffeventos tse
//                 JOIN
//                     staffempresas semp ON tse.idstaff = semp.idstaff
//                 WHERE
//                     semp.idempresa = $1 ${wherePeriodoFinal}
//             )
//             -- 1. DIÁRIA DOBRADA
//             SELECT
//                 tse.idevento,
//                 tbf.nome AS "Profissional",
//                 'Diária Dobrada - R$' || CAST(ca.valor_dobrada AS TEXT) || ' (' || CAST(jsonb_array_length(tse.dtdiariadobrada) AS TEXT)|| ' dia(s) autorizado(s))' AS "Informacao",
//                 tse.descdiariadobrada AS "Observacao"
//             FROM
//                 staffeventos tse
//             JOIN
//                 funcionarios tbf ON tse.idfuncionario = tbf.idfuncionario
//             JOIN 
//                 staffempresas semp ON tse.idstaff = semp.idstaff
//             JOIN
//                 calculos_adicionais ca ON ca.idstaffevento = tse.idstaffevento
//             WHERE
//                 semp.idempresa = $1 ${wherePeriodoFinal}
//                 AND jsonb_array_length(tse.dtdiariadobrada) > 0
            
//             UNION ALL
            
//             -- 2. MEIA DIÁRIA
//             SELECT
//                 tse.idevento,
//                 tbf.nome AS "Profissional",
//                 'Meia Diária - R$' || CAST(ca.valor_meia_diaria AS TEXT) || ' (' ||CAST(jsonb_array_length(tse.dtmeiadiaria) AS TEXT) || ' dia(s) autorizado(s))' AS "Informacao",
//                 tse.descmeiadiaria AS "Observacao"
//             FROM
//                 staffeventos tse
//             JOIN
//                 funcionarios tbf ON tse.idfuncionario = tbf.idfuncionario
//             JOIN 
//                 staffempresas semp ON tse.idstaff = semp.idstaff
//             JOIN
//                 calculos_adicionais ca ON ca.idstaffevento = tse.idstaffevento
//             WHERE
//                 semp.idempresa = $1 ${wherePeriodoFinal}
//                 AND jsonb_array_length(tse.dtmeiadiaria) > 0

//             UNION ALL
            
//             -- 3. AJUSTE DE CUSTO
//             SELECT
//                 tse.idevento,
//                 tbf.nome AS "Profissional",
//                 'Ajuste de Custo - R$' || CAST(tse.vlrajustecusto AS TEXT) AS "Informacao",
//                 tse.descajustecusto AS "Observacao"
//             FROM
//                 staffeventos tse
//             JOIN
//                 funcionarios tbf ON tse.idfuncionario = tbf.idfuncionario
//             JOIN 
//                 staffempresas semp ON tse.idstaff = semp.idstaff
//             WHERE
//                 semp.idempresa = $1 ${wherePeriodoFinal}
//                 AND tse.statusajustecusto = 'Autorizado' 
//                 AND tse.vlrajustecusto IS NOT NULL 
//                 AND tse.vlrajustecusto != 0

//             UNION ALL
            
//             -- 4. CAIXINHA
//             SELECT
//                 tse.idevento,
//                 tbf.nome AS "Profissional",
//                 'Caixinha - R$' || CAST(tse.vlrcaixinha AS TEXT) AS "Informacao",
//                 tse.desccaixinha AS "Observacao"
//             FROM
//                 staffeventos tse
//             JOIN
//                 funcionarios tbf ON tse.idfuncionario = tbf.idfuncionario
//             JOIN 
//                 staffempresas semp ON semp.idstaff = tse.idstaff
//             WHERE
//                 semp.idempresa = $1 ${wherePeriodoFinal}
//                 AND tse.statuscaixinha = 'Autorizado' 
//                 AND tse.vlrcaixinha IS NOT NULL 
//                 AND tse.vlrcaixinha > 0

//             UNION ALL

//             -- 5. BLOCO DE FERIADOS (CORRIGIDO PARA O CARNAVAL 17/02/2026)
//             SELECT
//                 tse.idevento,
//                 tbf.nome AS "Profissional",
//                 'Feriado em dia útil - (Somado 1 cachê a mais)' AS "Informacao",
//                 STRING_AGG(TO_CHAR(d.data_feriado, 'DD/MM') || ' (' || d.nome_feriado || '): Somado 1 cachê a mais', ' | ') AS "Observacao"
//             FROM
//                 staffeventos tse
//             JOIN
//                 funcionarios tbf ON tse.idfuncionario = tbf.idfuncionario
//             JOIN 
//                 staffempresas semp ON tse.idstaff = semp.idstaff
//             CROSS JOIN LATERAL (
//                 SELECT f.dt as data_feriado, f.nome as nome_feriado
//                 FROM (
//                     -- Cálculo manual fixo para 2026 garantir 17/02
//                     SELECT (make_date(2026, 4, 5) + (m.desloc || ' days')::interval)::date as dt, m.nome
//                     FROM (VALUES (-47, 'Terça Carnaval'), (-2, 'Sexta Santa'), (60, 'Corpus Christi')) as m(desloc, nome)
//                     UNION ALL
//                     SELECT make_date(2026, mes, dia), nome FROM (VALUES 
//                         (1,1,'Ano Novo'),(4,21,'Tiradentes'),(5,1,'Dia do Trabalho'),
//                         (9,7,'Independência'),(10,12,'Padroeira'),(11,2,'Finados'),
//                         (11,15,'Proclamação'),(11,20,'Consciência Negra'),(12,25,'Natal')
//                     ) as f(mes, dia, nome)
//                 ) f
//                 WHERE f.dt::text = ANY(SELECT jsonb_array_elements_text(tse.datasevento))
//                 AND EXTRACT(DOW FROM f.dt) NOT IN (0, 6)
//             ) d
//             WHERE
//                 semp.idempresa = $1 ${wherePeriodoFinal}
//                 AND (tbf.perfil ILIKE '%Interno%' OR tbf.perfil ILIKE '%Externo%')
//             GROUP BY
//                 tse.idevento, tbf.nome

//             UNION ALL

//             SELECT
//                 tse.idevento,
//                 tbf.nome AS "Profissional",
//                 'Observação Pós-Pagamento' AS "Informacao",
//                 tse.obspospgto AS "Observacao"
//             FROM
//                 staffeventos tse
//             JOIN
//                 funcionarios tbf ON tse.idfuncionario = tbf.idfuncionario
//             JOIN 
//                 staffempresas semp ON tse.idstaff = semp.idstaff
//             WHERE
//                 semp.idempresa = $1 ${wherePeriodoFinal}
//                 AND tse.obspospgto IS NOT NULL 
//                 AND TRIM(tse.obspospgto) != ''

//             ORDER BY
//                 idevento, "Profissional", "Informacao";
//         `;
//        // const resultContingencia = await pool.query(queryContingencia, paramsContingencia);
//         const resultContingencia = await pool.query(queryContingencia, params);

//         console.log("------------------------------------------");
//         console.log("📊 DEBUG CONTINGÊNCIA:");
//         console.log("Total de linhas retornadas:", resultContingencia.rows.length);

//         if (resultContingencia.rows.length > 0) {
//             resultContingencia.rows.forEach(r => {
//                 if (r.Informacao.includes("Feriado")) {
//                     console.log(`✅ FERIADO ENCONTRADO: ${r.Profissional} | Evento: ${r.idevento}`);
//                     console.log(`📝 Detalhe: ${r.Observacao}`);
//                 }
//             });
//         } else {
//             console.log("⚠️ NENHUM dado de contingência encontrado para os filtros atuais.");
//         }
//         console.log("------------------------------------------");

//         relatorio.contingencia = resultContingencia.rows;

//         return res.json(relatorio);
        
//     } catch (error) {
//         console.error("❌ Erro ao buscar relatório:", error);
//         return res.status(500).json({ error: error.message || "Erro ao gerar relatório" });
//     }
// });

// ROTA PARA BUSCAR EVENTOS NO PERÍODO




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
            
            const tiposPermitidos = ['ajuda_custo', 'cache', 'operacional', 'cache_ajuda'];
            if (!tiposPermitidos.includes(tipo)) {
                return res.status(400).json({ error: 'Tipo de relatório inválido.' });
            }
            
        let phaseFilterSql = `s.date_value::date >= $2::date AND s.date_value::date <= $3::date`;

        const whereEventos = `
            AND CASE
                WHEN $2::date = $3::date THEN
                    (tse.datasevento ? $2::text AND jsonb_array_length(tse.datasevento) = 1)
                ELSE
                    NOT EXISTS (
                        SELECT 1
                        FROM jsonb_array_elements_text(tse.datasevento) AS event_date
                        WHERE event_date::date < $2::date OR event_date::date > $3::date
                    )
            END
        `;

        try {
            const relatorio = {};

            // 1. DEFINIÇÃO FIXA DOS PARÂMETROS ($1 até $6)
            const params = [
                idempresa,                                        // $1
                dataInicio,                                       // $2
                dataFim,                                          // $3
                (evento && evento !== "todos" && evento !== "") ? evento.toString() : null,   // $4
                (cliente && cliente !== "todos" && cliente !== "") ? cliente.toString() : null, // $5
                (equipe && equipe !== "todos" && equipe !== "") ? equipe.toString() : null    // $6
            ];

            // 2. FILTROS EXTRAS COM CAST PARA TEXT (Isso resolve o erro globalmente onde usar wherePeriodoFinal)
            const sqlFiltrosExtras = `
                AND ($4::text IS NULL OR $4::text = '' OR tse.idevento::text = $4::text)
                AND ($5::text IS NULL OR $5::text = '' OR tse.idcliente::text = $5::text)
                AND ($6::text IS NULL OR $6::text = '' OR tse.idequipe::text = $6::text)
            `;

            // 3. Unificamos na variável que as queries abaixo utilizam
            let wherePeriodoFinal = whereEventos + sqlFiltrosExtras;

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
                        } else if (tipo === 'cache_ajuda') {
                            // Para cache_ajuda, consideramos "Pago" apenas se AMBOS (cachê e ajuda) estiverem com comprovante
                            const comprovanteCacheOk = `(tse.comppgtocache IS NOT NULL AND tse.comppgtocache != '')`;
                            const comprovanteAjudaOk = `(tse.comppgtoajdcusto IS NOT NULL AND tse.comppgtoajdcusto != '')`;

                            if (incluirPagos) {
                                // PAGO: Tem os dois comprovantes anexados
                                statusConditions.push(`(${comprovanteCacheOk} AND ${comprovanteAjudaOk})`);
                            }
                            if (incluirPendentes) {
                                // PENDENTE: Se faltar qualquer um dos dois
                                statusConditions.push(`(${comprovanteCacheOk} IS FALSE OR ${comprovanteAjudaOk} IS FALSE)`);
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

                console.log("STATUS PAGTO", whereStatus, wherePeriodoFinal, phaseFilterSql);
            
                let queryFechamentoPrincipal = ''; // Variável para armazenar a query principal
                
                // **LÓGICA CONDICIONAL PARA O TIPO DE RELATÓRIO PRINCIPAL**
                if (tipo === 'ajuda_custo') {
                    queryFechamentoPrincipal = `
                        SELECT
                            tse.idevento AS "idevento",
                            tbf.perfil AS "PERFIL_STAFF",
                            tse.nmevento AS "nomeEvento",
                            tse.nmfuncao AS "FUNÇÃO",
                            tse.idcliente AS "idcliente",
                            tse.nmcliente AS "nomeCliente",
                            tse.idequipe AS "idequipe",
                            tse.nmequipe AS "nmequipe",
                            tse.nivelexperiencia,
                            tbf.nome AS "NOME",
                            tbf.pix AS "PIX",                    
                            (SELECT MIN(date_value::date) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value))::text AS "INÍCIO",
                            (SELECT MAX(date_value::date) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value))::text AS "TÉRMINO",                   
                        
                            CAST((COALESCE(tse.vlralimentacao, 0) + COALESCE(tse.vlrtransporte, 0)) AS NUMERIC(10,2)) AS "VLR DIÁRIA",
                            jsonb_array_length(
                                (SELECT jsonb_agg(date_value) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value))
                            ) AS "QTD",
                            -- TOT DIÁRIAS (Valor total bruto)
                            CAST((COALESCE(tse.vlralimentacao, 0) + COALESCE(tse.vlrtransporte, 0)) * (CASE WHEN tse.qtdpessoaslote IS NULL OR tse.qtdpessoaslote = 0 THEN 1 ELSE tse.qtdpessoaslote END) * jsonb_array_length(
                                (SELECT jsonb_agg(date_value) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value))
                            ) AS NUMERIC(10,2)) AS "TOT DIÁRIAS",
                            -- TOT GERAL (Mesmo valor do TOT DIÁRIAS para este relatório)
                            CAST((COALESCE(tse.vlralimentacao, 0) + COALESCE(tse.vlrtransporte, 0)) * (CASE WHEN tse.qtdpessoaslote IS NULL OR tse.qtdpessoaslote = 0 THEN 1 ELSE tse.qtdpessoaslote END) * jsonb_array_length(
                                (SELECT jsonb_agg(date_value) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value))
                            ) AS NUMERIC(10,2)) AS "TOT GERAL",
                            -- STATUS PGTO baseado na coluna de status                    
                            CASE
                                WHEN (COALESCE(tse.vlralimentacao, 0) + COALESCE(tse.vlrtransporte, 0)) = 0 THEN '--'
                                WHEN tse.statuspgtoajdcto = 'Pago' THEN 'Pago 100%'
                                WHEN tse.statuspgtoajdcto = 'Pago50' THEN 'Pago 50%'
                                ELSE COALESCE(tse.statuspgtoajdcto, 'Pendente')
                            END AS "STATUS PGTO",    
                            CASE 
                                WHEN (COALESCE(tse.vlralimentacao, 0) = 0 AND COALESCE(tse.vlrtransporte, 0) = 0) THEN 'Isento'
                                WHEN (tse.comppgtoajdcusto IS NOT NULL AND tse.comppgtoajdcusto != '') 
                                    OR (tse.comppgtoajdcusto50 IS NOT NULL AND tse.comppgtoajdcusto50 != '' AND tse.comppgtoajdcusto IS NOT NULL AND tse.comppgtoajdcusto != '') THEN 'Anexado'
                                WHEN (tse.comppgtoajdcusto50 IS NOT NULL AND tse.comppgtoajdcusto50 != '') THEN '50% Anexado'
                                ELSE 'Pendente'
                            END AS "COMP STATUS",                
                            CAST(CASE
                                WHEN (COALESCE(tse.vlralimentacao, 0) + COALESCE(tse.vlrtransporte, 0)) = 0 THEN 0.00
                                WHEN tse.statuspgtoajdcto = 'Pago' THEN 0.00                        
                                WHEN tse.statuspgtoajdcto = 'Pago50' THEN 
                                    ((COALESCE(tse.vlralimentacao, 0) + COALESCE(tse.vlrtransporte, 0)) * (CASE WHEN tse.qtdpessoaslote <= 0 THEN 1 ELSE tse.qtdpessoaslote END) * jsonb_array_length((SELECT jsonb_agg(date_value) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value)))
                                    ) / 2.0
                                ELSE 
                                    (COALESCE(tse.vlralimentacao, 0) + COALESCE(tse.vlrtransporte, 0)) * (CASE WHEN tse.qtdpessoaslote <= 0 THEN 1 ELSE tse.qtdpessoaslote END) * jsonb_array_length((SELECT jsonb_agg(date_value) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value)))
                            END AS NUMERIC(10,2)) AS "TOT PAGAR"                   
                        FROM
                            staffeventos tse
                        JOIN
                            funcionarios tbf ON tse.idfuncionario = tbf.idfuncionario
                        JOIN 
                            staffempresas semp ON tse.idstaff = semp.idstaff
                        WHERE semp.idempresa = $1
                            ${whereStatus} 
                            ${wherePeriodoFinal} 
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
                    queryFechamentoPrincipal = `
                    WITH
                    ano_evento AS (
                        SELECT DISTINCT EXTRACT(YEAR FROM (date_value::date))::int AS ano
                        FROM staffeventos tse,
                            jsonb_array_elements_text(tse.datasevento) AS s(date_value)
                        WHERE tse.idstaff IN (SELECT idstaff FROM staffempresas WHERE idempresa = $1)
                    ),
                    feriados AS (
                        SELECT data::date FROM (
                            SELECT make_date(a.ano, 1, 1) FROM ano_evento a UNION
                            SELECT make_date(a.ano, 1, 25) FROM ano_evento a UNION
                            SELECT make_date(a.ano, 4, 21) FROM ano_evento a UNION
                            SELECT make_date(a.ano, 5, 1) FROM ano_evento a UNION
                            SELECT make_date(a.ano, 7, 9) FROM ano_evento a UNION
                            SELECT make_date(a.ano, 9, 7) FROM ano_evento a UNION
                            SELECT make_date(a.ano, 10, 12) FROM ano_evento a UNION
                            SELECT make_date(a.ano, 11, 2) FROM ano_evento a UNION
                            SELECT make_date(a.ano, 11, 15) FROM ano_evento a UNION
                            SELECT make_date(a.ano, 11, 20) FROM ano_evento a UNION
                            SELECT make_date(a.ano, 12, 25) FROM ano_evento a UNION

                            -- 2. FERIADOS MÓVEIS (Lógica simplificada para evitar ambiguidade)
                            SELECT (calc.data_pascoa + (m.deslocamento || ' days')::interval)::date
                            FROM (
                                SELECT 
                                    make_date(ano, 
                                            (h + l - 7 * m + 114) / 31, 
                                            ((h + l - 7 * m + 114) % 31) + 1
                                    ) AS data_pascoa
                                FROM (
                                    SELECT 
                                        ano, h, m, 
                                        ((2 * (ano % 4) + 2 * ((ano % 100) / 4) - (ano % 100 % 4) + 32 - h) % 7) AS l
                                    FROM (
                                        SELECT 
                                            ano, h, 
                                            (( (ano % 19) + 11 * h + 22 * ((2 * (ano % 4) + 2 * ((ano % 100) / 4) - (ano % 100 % 4) + 32 - h) % 7) ) / 451) AS m
                                        FROM (
                                            SELECT 
                                                ano,
                                                ((19 * (ano % 19) + (ano / 100) - (ano / 400) - ((8 * (ano / 100) + 13) / 25) + 15) % 30) AS h
                                            FROM ano_evento
                                        ) AS sub_h
                                    ) AS sub_m
                                ) AS sub_l
                            ) AS calc
                            CROSS JOIN (
                                VALUES 
                                    (-48, 'Segunda Carnaval'),
                                    (-47, 'Terça Carnaval'),
                                    --(-2,  'Sexta Santa'),
                                    --(0,   'Páscoa'),
                                    (60,  'Corpus Christi')
                            ) AS m(deslocamento, nome)

                        ) f(data)
                    ),
                    diarias_autorizadas AS (
                        SELECT
                        tse.idstaffevento,
                        -- DOBRAS
                        COALESCE((
                            SELECT SUM(
                                CASE
                                    WHEN tbf.perfil ILIKE '%Free%' OR tbf.perfil ILIKE '%Lote%'
                                        THEN COALESCE(tse.vlrcache, 0) + COALESCE(tse.vlralimentacao, 0)
                                    WHEN EXTRACT(DOW FROM d.data::date) IN (0,6) OR d.data::date IN (SELECT data FROM feriados)
                                        THEN COALESCE(tse.vlrcache, 0) + COALESCE(tse.vlralimentacao, 0)
                                    ELSE COALESCE(tse.vlralimentacao, 0)
                                END
                            )
                            FROM jsonb_to_recordset(COALESCE(tse.dtdiariadobrada, '[]'::jsonb)) AS d(data text, status text)
                            WHERE d.status = 'Autorizado'
                        ), 0) AS vlr_dobras,
                        -- MEIAS
                        COALESCE((
                            SELECT SUM(
                                CASE
                                    WHEN tbf.perfil ILIKE '%Free%' OR tbf.perfil ILIKE '%Lote%'
                                        THEN (COALESCE(tse.vlrcache, 0) / 2.0) + COALESCE(tse.vlralimentacao, 0)
                                    WHEN EXTRACT(DOW FROM m.data::date) IN (0,6) OR m.data::date IN (SELECT data FROM feriados)
                                        THEN (COALESCE(tse.vlrcache, 0) / 2.0) + COALESCE(tse.vlralimentacao, 0)
                                    ELSE COALESCE(tse.vlralimentacao, 0)
                                END
                            )
                            FROM jsonb_to_recordset(COALESCE(tse.dtmeiadiaria, '[]'::jsonb)) AS m(data text, status text)
                            WHERE m.status = 'Autorizado'
                        ), 0) AS vlr_meias

                        FROM staffeventos tse
                        JOIN funcionarios tbf ON tbf.idfuncionario = tse.idfuncionario
                        JOIN staffempresas semp ON tse.idstaff = semp.idstaff                        
                        WHERE semp.idempresa = $1 ${wherePeriodoFinal}
                    )
                    SELECT 
                        *,
                        -- Correção: Forçando CAST e tratando QTDPESSOAS para evitar zerar o cálculo
                        CAST(
                            (COALESCE("VLR DIÁRIA", 0) * (CASE WHEN COALESCE("QTDPESSOAS", 0) <= 0 THEN 1 ELSE "QTDPESSOAS" END) * COALESCE("QTD", 0)) 
                        AS NUMERIC(10,2)) AS "TOT DIÁRIAS",
                        
                        CAST(
                            ((COALESCE("VLR DIÁRIA", 0) * (CASE WHEN COALESCE("QTDPESSOAS", 0) <= 0 THEN 1 ELSE "QTDPESSOAS" END) * COALESCE("QTD", 0)) + COALESCE("VLR ADICIONAL", 0)) 
                        AS NUMERIC(10,2)) AS "TOT GERAL"
                    FROM (
                        SELECT
                            tse.idevento,
                            tbf.perfil AS "PERFIL_STAFF",
                            tse.nmevento AS "nomeEvento",
                            tse.idcliente,
                            tse.nmcliente AS "nomeCliente",
                            tse.idequipe,
                            tse.nmequipe AS "nmequipe",
                            COALESCE(tse.qtdpessoaslote, 1) AS "QTDPESSOAS", -- Garante valor mínimo 1
                            tse.nmfuncao AS "FUNÇÃO",
                            tse.statuspgtocaixinha AS "STATUS CAIXINHA",
                            tse.nivelexperiencia,
                            tbf.nome AS "NOME",
                            tbf.pix AS "PIX",
                            tbf.perfil AS "PERFIL_FUNC",
                            (SELECT MIN(d_val::date) FROM jsonb_array_elements_text(tse.datasevento) AS d_val)::text AS "INÍCIO",
                            (SELECT MAX(d_val::date) FROM jsonb_array_elements_text(tse.datasevento) AS d_val)::text AS "TÉRMINO",
                            
                            (
                                SELECT COUNT(*)::int
                                FROM jsonb_array_elements_text(tse.datasevento) AS s(date_val)
                                WHERE date_val::date >= $2::date AND date_val::date <= $3::date
                                AND (
                                    tse.nmfuncao ILIKE '%Ajudante de Marcação%'
                                    tbf.perfil ILIKE '%Free%' 
                                    OR 
                                    ((tbf.perfil ILIKE '%Interno%' OR tbf.perfil ILIKE '%Externo%') 
                                    AND (EXTRACT(DOW FROM date_val::date) IN (0, 6) OR date_val::date IN (SELECT data FROM feriados)))
                                )
                            ) AS "QTD",

                            CAST(COALESCE(tse.vlrcache, 0) AS NUMERIC(10,2)) AS "VLR DIÁRIA",

                            CAST((
                                COALESCE(CASE WHEN tse.statusajustecusto = 'Autorizado' THEN tse.vlrajustecusto ELSE 0 END, 0) +
                                COALESCE(CASE WHEN tse.statuscaixinha = 'Autorizado' THEN tse.vlrcaixinha ELSE 0 END, 0) +
                                COALESCE(da.vlr_dobras, 0) +
                                COALESCE(da.vlr_meias, 0)
                            ) AS NUMERIC(10, 2)) AS "VLR ADICIONAL",

                            -- STATUS PGTO com a sua regra para exibir '---' quando não houver valor
                            CASE
                                WHEN COALESCE(tse.vlrcache, 0) = 0 THEN '---'
                                WHEN (tse.comppgtocache IS NOT NULL AND tse.comppgtocache != '')
                                AND (CAST(COALESCE(NULLIF(TRIM(tse.vlrcaixinha::TEXT), ''), '0') AS NUMERIC) <= 0
                                    OR (CAST(COALESCE(NULLIF(TRIM(tse.vlrcaixinha::TEXT), ''), '0') AS NUMERIC) > 0 AND (tse.comppgtocaixinha IS NOT NULL AND tse.comppgtocaixinha != '')))
                                THEN 'Pago' ELSE 'Pendente'
                            END AS "STATUS PGTO",                    
                            CASE 
                                -- 1. ISENTO
                                WHEN (COALESCE(tse.vlrcache, 0) <= 0 AND COALESCE(tse.vlrcaixinha, 0) <= 0) THEN 'Isento'

                                -- 2. TUDO PENDENTE (Cachê > 0 e Caixinha > 0, mas ambos sem comprovante)
                                WHEN (COALESCE(tse.vlrcache, 0) > 0 AND (tse.comppgtocache IS NULL OR tse.comppgtocache = ''))
                                    AND (COALESCE(tse.vlrcaixinha, 0) > 0 AND (tse.comppgtocaixinha IS NULL OR tse.comppgtocaixinha = ''))
                                    THEN 'Cachê e Caixinha Pendentes'

                                -- 3. CACHÊ PENDENTE (Mas Caixinha está OK ou é Isenta)
                                WHEN (COALESCE(tse.vlrcache, 0) > 0 AND (tse.comppgtocache IS NULL OR tse.comppgtocache = ''))
                                    AND (COALESCE(tse.vlrcaixinha, 0) <= 0 OR (tse.comppgtocaixinha IS NOT NULL AND tse.comppgtocaixinha != ''))
                                    THEN 'Cachê Pendente'

                                -- 4. CAIXINHA PENDENTE (Mas Cachê está OK ou é Isento)
                                WHEN (COALESCE(tse.vlrcaixinha, 0) > 0 AND (tse.comppgtocaixinha IS NULL OR tse.comppgtocaixinha = ''))
                                    AND (COALESCE(tse.vlrcache, 0) <= 0 OR (tse.comppgtocache IS NOT NULL AND tse.comppgtocache != ''))
                                    THEN 'Caixinha Pendente'

                                -- 5. AMBOS ANEXADOS
                                WHEN (COALESCE(tse.vlrcache, 0) > 0 AND tse.comppgtocache IS NOT NULL AND tse.comppgtocache != '') 
                                    AND (COALESCE(tse.vlrcaixinha, 0) > 0 AND tse.comppgtocaixinha IS NOT NULL AND tse.comppgtocaixinha != '') 
                                    THEN 'Cachê e Caixinha Anexados'

                                -- 6. CACHÊ ANEXADO (Mas tem valor de Caixinha faltando ou Caixinha é isenta)
                                WHEN (COALESCE(tse.vlrcache, 0) > 0 AND tse.comppgtocache IS NOT NULL AND tse.comppgtocache != '') 
                                    THEN CASE 
                                            WHEN COALESCE(tse.vlrcaixinha, 0) > 0 AND (tse.comppgtocaixinha IS NULL OR tse.comppgtocaixinha = '') 
                                            THEN 'Cachê Anexado (Falta Caixinha)'
                                            ELSE 'Cachê Anexado'
                                        END

                                -- 7. CAIXINHA ANEXADA (Caso o cachê seja zero e a caixinha tenha valor e comprovante)
                                WHEN (COALESCE(tse.vlrcaixinha, 0) > 0 AND tse.comppgtocaixinha IS NOT NULL AND tse.comppgtocaixinha != '') 
                                    AND COALESCE(tse.vlrcache, 0) <= 0
                                    THEN 'Caixinha Anexada'

                                ELSE 'Comprovantes Pendentes'
                            END AS "COMP STATUS",
                            CAST((
                                CASE 
                                    WHEN tse.statuspgto IS DISTINCT FROM 'Pago'
                                    THEN (COALESCE(tse.vlrcache, 0) * (CASE WHEN COALESCE(tse.qtdpessoaslote, 0) <= 0 THEN 1 ELSE tse.qtdpessoaslote END) * (
                                        SELECT COUNT(*)::int
                                        FROM jsonb_array_elements_text(tse.datasevento) AS s(date_val)
                                        WHERE date_val::date >= $2::date AND date_val::date <= $3::date
                                        AND (
                                            tbf.perfil ILIKE '%Free%' 
                                            OR 
                                            ((tbf.perfil ILIKE '%Interno%' OR tbf.perfil ILIKE '%Externo%') 
                                            AND (EXTRACT(DOW FROM date_val::date) IN (0, 6) OR date_val::date IN (SELECT data FROM feriados)))
                                        )
                                    ))
                                    ELSE 0 
                                END +
                                CASE WHEN (tse.statuspgto IS DISTINCT FROM 'Pago') AND tse.statusajustecusto = 'Autorizado' THEN COALESCE(tse.vlrajustecusto, 0) ELSE 0 END +
                                CASE WHEN (tse.statuspgtocaixinha IS DISTINCT FROM 'Pago') AND tse.statuscaixinha = 'Autorizado' THEN COALESCE(tse.vlrcaixinha, 0) ELSE 0 END +
                                CASE WHEN tse.statuspgto IS DISTINCT FROM 'Pago' THEN 
                                    COALESCE(da.vlr_dobras, 0) + COALESCE(da.vlr_meias, 0)
                                    ELSE 0 
                                END
                            ) AS NUMERIC(10,2)) AS "TOT PAGAR"

                        FROM staffeventos tse
                        JOIN funcionarios tbf ON tse.idfuncionario = tbf.idfuncionario
                        JOIN staffempresas semp ON tse.idstaff = semp.idstaff
                        LEFT JOIN diarias_autorizadas da ON tse.idstaffevento = da.idstaffevento
                        WHERE semp.idempresa = $1 
                            ${whereStatus} 
                            ${wherePeriodoFinal} 
                            AND jsonb_array_length(
                                (SELECT jsonb_agg(date_value) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value)
                                WHERE ${phaseFilterSql})
                            ) > 0
                    ) AS subquery
                    WHERE ("QTD" > 0 OR "VLR ADICIONAL" != 0)
                    ORDER BY "nomeEvento", "NOME";
                    `;


                } else if (tipo === 'operacional') {
                    queryFechamentoPrincipal = `
                    WITH ano_evento AS (
                        SELECT DISTINCT EXTRACT(YEAR FROM (date_value::date))::int AS ano
                        FROM staffeventos tse,
                            jsonb_array_elements_text(tse.datasevento) AS s(date_value)
                        WHERE tse.idstaff IN (SELECT idstaff FROM staffempresas WHERE idempresa = $1)
                    ),
                    feriados AS (
                        SELECT data::date FROM (
                            SELECT make_date(a.ano, 1, 1) FROM ano_evento a UNION
                            SELECT make_date(a.ano, 1, 25) FROM ano_evento a UNION
                            SELECT make_date(a.ano, 4, 21) FROM ano_evento a UNION
                            SELECT make_date(a.ano, 5, 1) FROM ano_evento a UNION
                            SELECT make_date(a.ano, 7, 9) FROM ano_evento a UNION --Revolução Constitucionalista de 1932
                            SELECT make_date(a.ano, 9, 7) FROM ano_evento a UNION
                            SELECT make_date(a.ano, 10, 12) FROM ano_evento a UNION
                            SELECT make_date(a.ano, 11, 2) FROM ano_evento a UNION
                            SELECT make_date(a.ano, 11, 15) FROM ano_evento a UNION
                            SELECT make_date(a.ano, 11, 20) FROM ano_evento a UNION
                            SELECT make_date(a.ano, 12, 25) FROM ano_evento a UNION

                            -- 2. FERIADOS MÓVEIS (Lógica simplificada para evitar ambiguidade)
                            SELECT (calc.data_pascoa + (m.deslocamento || ' days')::interval)::date
                            FROM (
                                SELECT 
                                    make_date(ano, 
                                            (h + l - 7 * m + 114) / 31, 
                                            ((h + l - 7 * m + 114) % 31) + 1
                                    ) AS data_pascoa
                                FROM (
                                    SELECT 
                                        ano, h, m, 
                                        ((2 * (ano % 4) + 2 * ((ano % 100) / 4) - (ano % 100 % 4) + 32 - h) % 7) AS l
                                    FROM (
                                        SELECT 
                                            ano, h, 
                                            (( (ano % 19) + 11 * h + 22 * ((2 * (ano % 4) + 2 * ((ano % 100) / 4) - (ano % 100 % 4) + 32 - h) % 7) ) / 451) AS m
                                        FROM (
                                            SELECT 
                                                ano,
                                                ((19 * (ano % 19) + (ano / 100) - (ano / 400) - ((8 * (ano / 100) + 13) / 25) + 15) % 30) AS h
                                            FROM ano_evento
                                        ) AS sub_h
                                    ) AS sub_m
                                ) AS sub_l
                            ) AS calc
                            CROSS JOIN (
                                VALUES 
                                    (-48, 'Segunda Carnaval'),
                                    (-47, 'Terça Carnaval'),
                                    --(-2,  'Sexta Santa'),
                                    --(0,   'Páscoa'),
                                    (60,  'Corpus Christi')
                            ) AS m(deslocamento, nome)

                        ) f(data)
                    )
                    SELECT
                        tse.idevento,
                        tbf.perfil AS "PERFIL_STAFF",
                        tse.nmevento AS "nomeEvento",
                        tse.idcliente,
                        tse.nmcliente AS "nomeCliente",
                        tse.idequipe,
                        tse.nmequipe,
                        tse.nmfuncao AS "FUNÇÃO",
                        tse.nivelexperiencia,
                        tbf.nome AS "NOME",
                        tbf.cpf AS "CPF",
                        (SELECT MIN(date_value::date) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value))::text AS "INÍCIO",
                        (SELECT MAX(date_value::date) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value))::text AS "TÉRMINO",
                        
                        -- Coluna QTD
                        (SELECT COUNT(*) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_val)
                        WHERE date_val::date BETWEEN $2::date AND $3::date
                        AND (
                            tbf.perfil ILIKE '%Free%'
                            OR (
                                (tbf.perfil ILIKE '%Interno%' OR tbf.perfil ILIKE '%Externo%')
                                AND (EXTRACT(DOW FROM date_val::date) IN (0, 6) OR date_val::date IN (SELECT data FROM feriados))
                            )
                        )) AS "QTD",

                        -- Coluna VLR ADICIONAL
                        CAST(
                            COALESCE(CASE WHEN tse.statusajustecusto = 'Autorizado' THEN tse.vlrajustecusto ELSE 0 END, 0.00) +
                            COALESCE(CASE WHEN tse.statuscaixinha = 'Autorizado' THEN tse.vlrcaixinha ELSE 0 END, 0.00)
                        AS NUMERIC(10, 2)) AS "VLR ADICIONAL",

                        -- Coluna TOT GERAL
                        CAST(
                            (COALESCE(tse.vlrcache, 0.00) * (CASE WHEN tse.qtdpessoaslote IS NULL OR tse.qtdpessoaslote = 0 THEN 1 ELSE tse.qtdpessoaslote END) * (
                                SELECT COUNT(*)
                                FROM jsonb_array_elements_text(tse.datasevento) AS s(date_val)
                                WHERE date_val::date BETWEEN $2::date AND $3::date
                                AND (
                                    tbf.perfil ILIKE '%Free%' 
                                    OR 
                                    ((tbf.perfil ILIKE '%Interno%' OR tbf.perfil ILIKE '%Externo%') 
                                    AND (EXTRACT(DOW FROM date_val::date) IN (0, 6) OR date_val::date IN (SELECT data FROM feriados)))
                                )
                            )) +
                            COALESCE(CASE WHEN tse.statusajustecusto = 'Autorizado' THEN tse.vlrajustecusto ELSE 0 END, 0.00) +
                            COALESCE(CASE WHEN tse.statuscaixinha = 'Autorizado' THEN tse.vlrcaixinha ELSE 0 END, 0.00)
                        AS NUMERIC(10, 2)) AS "TOT GERAL",

                        -- Coluna STATUS PGTO
                        CASE
                            WHEN (tse.comppgtocache IS NOT NULL AND tse.comppgtocache != '')
                            AND (CAST(COALESCE(NULLIF(TRIM(tse.vlrcaixinha::TEXT), ''), '0') AS NUMERIC) <= 0
                                OR (CAST(COALESCE(NULLIF(TRIM(tse.vlrcaixinha::TEXT), ''), '0') AS NUMERIC) > 0 AND (tse.comppgtocaixinha IS NOT NULL AND tse.comppgtocaixinha != '')))
                            THEN 'Pago' ELSE 'Pendente'
                        END AS "STATUS PGTO"

                    FROM staffeventos tse
                    JOIN funcionarios tbf ON tse.idfuncionario = tbf.idfuncionario
                    JOIN staffempresas semp ON tse.idstaff = semp.idstaff
                    WHERE semp.idempresa = $1
                        ${whereStatus} 
                        ${wherePeriodoFinal} 
                        AND jsonb_array_length(
                            (SELECT jsonb_agg(date_value) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value)
                            WHERE ${phaseFilterSql})
                        ) > 0
                    ORDER BY tse.nmevento, tbf.nome;
                    `;
                } else if (tipo === 'cache_ajuda') {
                    queryFechamentoPrincipal = `
                    WITH ano_evento AS (
                            SELECT DISTINCT EXTRACT(YEAR FROM (date_value::date))::int AS ano
                            FROM staffeventos tse,
                                jsonb_array_elements_text(tse.datasevento) AS s(date_value)
                            WHERE tse.idstaff IN (SELECT idstaff FROM staffempresas WHERE idempresa = $1)
                        ),
                        feriados AS (
                            SELECT data::date FROM (
                                SELECT make_date(a.ano, 1, 1) FROM ano_evento a UNION
                                SELECT make_date(a.ano, 1, 25) FROM ano_evento a UNION
                                SELECT make_date(a.ano, 4, 21) FROM ano_evento a UNION
                                SELECT make_date(a.ano, 5, 1) FROM ano_evento a UNION
                                SELECT make_date(a.ano, 7, 9) FROM ano_evento a UNION
                                SELECT make_date(a.ano, 9, 7) FROM ano_evento a UNION
                                SELECT make_date(a.ano, 10, 12) FROM ano_evento a UNION
                                SELECT make_date(a.ano, 11, 2) FROM ano_evento a UNION
                                SELECT make_date(a.ano, 11, 15) FROM ano_evento a UNION
                                SELECT make_date(a.ano, 11, 20) FROM ano_evento a UNION
                                SELECT make_date(a.ano, 12, 25) FROM ano_evento a UNION

                                -- 2. FERIADOS MÓVEIS (Lógica simplificada para evitar ambiguidade)
                                SELECT (calc.data_pascoa + (m.deslocamento || ' days')::interval)::date
                                FROM (
                                    SELECT 
                                        make_date(ano, 
                                                (h + l - 7 * m + 114) / 31, 
                                                ((h + l - 7 * m + 114) % 31) + 1
                                        ) AS data_pascoa
                                    FROM (
                                        SELECT 
                                            ano, h, m, 
                                            ((2 * (ano % 4) + 2 * ((ano % 100) / 4) - (ano % 100 % 4) + 32 - h) % 7) AS l
                                        FROM (
                                            SELECT 
                                                ano, h, 
                                                (( (ano % 19) + 11 * h + 22 * ((2 * (ano % 4) + 2 * ((ano % 100) / 4) - (ano % 100 % 4) + 32 - h) % 7) ) / 451) AS m
                                            FROM (
                                                SELECT 
                                                    ano,
                                                    ((19 * (ano % 19) + (ano / 100) - (ano / 400) - ((8 * (ano / 100) + 13) / 25) + 15) % 30) AS h
                                                FROM ano_evento
                                            ) AS sub_h
                                        ) AS sub_m
                                    ) AS sub_l
                                ) AS calc
                                CROSS JOIN (
                                    VALUES 
                                        (-48, 'Segunda Carnaval'),
                                        (-47, 'Terça Carnaval'),
                                     --(-2,  'Sexta Santa'),
                                     --(0,   'Páscoa'),
                                        (60,  'Corpus Christi')
                                ) AS m(deslocamento, nome)

                            ) f(data)
                        ),
                        diarias_autorizadas AS (
                            SELECT
                                tse.idstaffevento,
                                -- DOBRAS
                                COALESCE((
                                    SELECT SUM(
                                        CASE
                                            WHEN tbf.perfil ILIKE '%Free%' OR tbf.perfil ILIKE '%Lote%'
                                                THEN COALESCE(tse.vlrcache, 0) + COALESCE(tse.vlralimentacao, 0)
                                            WHEN EXTRACT(DOW FROM d.data::date) IN (0,6) OR d.data::date IN (SELECT data FROM feriados)
                                                THEN COALESCE(tse.vlrcache, 0) + COALESCE(tse.vlralimentacao, 0)
                                            ELSE COALESCE(tse.vlralimentacao, 0)
                                        END
                                    )
                                    FROM jsonb_to_recordset(COALESCE(tse.dtdiariadobrada, '[]'::jsonb)) AS d(data text, status text)
                                    WHERE d.status = 'Autorizado'
                                ), 0) AS vlr_dobras,
                                -- MEIAS
                                COALESCE((
                                    SELECT SUM(
                                        CASE
                                            WHEN tbf.perfil ILIKE '%Free%' OR tbf.perfil ILIKE '%Lote%'
                                                THEN (COALESCE(tse.vlrcache, 0) / 2.0) + COALESCE(tse.vlralimentacao, 0)
                                            WHEN EXTRACT(DOW FROM m.data::date) IN (0,6) OR m.data::date IN (SELECT data FROM feriados)
                                                THEN (COALESCE(tse.vlrcache, 0) / 2.0) + COALESCE(tse.vlralimentacao, 0)
                                            ELSE COALESCE(tse.vlralimentacao, 0)
                                        END
                                    )
                                    FROM jsonb_to_recordset(COALESCE(tse.dtmeiadiaria, '[]'::jsonb)) AS m(data text, status text)
                                    WHERE m.status = 'Autorizado'
                                ), 0) AS vlr_meias
                            FROM staffeventos tse
                            JOIN funcionarios tbf ON tbf.idfuncionario = tse.idfuncionario
                            JOIN staffempresas semp ON tse.idstaff = semp.idstaff
                            WHERE semp.idempresa = $1 ${wherePeriodoFinal}
                        )
                        SELECT 
                            sub.*,
                            -- 1. QTD DE CACHÊS E AJUDAS REAIS (Baseadas no valor total dividido pelo unitário)
                            -- Se já foi pago/fechado, extraímos a QTD dividindo o total pelo valor unitário
                            -- Se não foi pago, usamos a contagem do array que você já fazia.
                            CAST(CASE
                                WHEN COALESCE(sub.vlrtotcache, 0) > 0 AND COALESCE(sub."VLR CACHÊ", 0) > 0
                                THEN (sub.vlrtotcache - sub."VLR ADICIONAL") / sub."VLR CACHÊ"
                                ELSE sub."QTD_CALCULADA"
                            END AS INTEGER) AS "QTD_CALCULADA",

                            CAST(CASE 
                                WHEN COALESCE(sub.vlrtotajdcusto, 0) > 0 AND COALESCE(sub."VLR AJUDA", 0) > 0 
                                THEN sub.vlrtotajdcusto / sub."VLR AJUDA"
                                ELSE sub."QTD_AJUDA_CALCULADA"
                            END AS INTEGER) AS "QTD_AJUDA",

                            -- 2. TOT DIÁRIAS (CACHE)
                            -- Prioriza o valor gravado fixo. Se for zero, faz o cálculo dinâmico.
                            CAST(COALESCE(
                                NULLIF(sub.vlrtotcache, 0), 
                                (sub."VLR CACHÊ" * sub."QTD_CALCULADA")
                            ) AS NUMERIC(10,2)) AS "TOT DIÁRIAS",

                            -- 3. TOT AJUDA
                            -- Prioriza o valor gravado fixo. Se for zero, faz o cálculo dinâmico.
                            CAST(COALESCE(
                                NULLIF(sub.vlrtotajdcusto, 0), 
                                (sub."VLR AJUDA" * sub."QTD_AJUDA_CALCULADA")
                            ) AS NUMERIC(10,2)) AS "TOT AJUDA",

                            -- 4. TOT GERAL
                            -- Soma o Cache Real + Ajuda Real + Adicionais
                            CAST(
                                COALESCE(NULLIF(sub.vlrtotcache, 0), (sub."VLR CACHÊ" * sub."QTD_CALCULADA")) + 
                                COALESCE(NULLIF(sub.vlrtotajdcusto, 0), (sub."VLR AJUDA" * sub."QTD_AJUDA_CALCULADA")) 
                                --+ sub."VLR ADICIONAL" 
                            AS NUMERIC(10,2)) AS "TOT GERAL",

                            -- 5. TOT PAGAR (Regra de Abatimento baseada nos Status de Pagamento)
                            CAST(CASE 
                                WHEN (sub."STATUS CACHÊ" = 'Pago' AND sub."STATUS AJUDA" = 'Pago') THEN 0 
                                WHEN (sub."STATUS CACHÊ" = 'Pago') THEN COALESCE(NULLIF(sub.vlrtotajdcusto, 0), (sub."VLR AJUDA" * sub."QTD_AJUDA_CALCULADA"))
                                WHEN (sub."STATUS AJUDA" = 'Pago') THEN COALESCE(NULLIF(sub.vlrtotcache, 0), (sub."VLR CACHÊ" * sub."QTD_CALCULADA")) + sub."VLR ADICIONAL"
                                ELSE 
                                    COALESCE(NULLIF(sub.vlrtotcache, 0), (sub."VLR CACHÊ" * sub."QTD_CALCULADA")) + 
                                    COALESCE(NULLIF(sub.vlrtotajdcusto, 0), (sub."VLR AJUDA" * sub."QTD_AJUDA_CALCULADA"))
                                    -- + sub."VLR ADICIONAL"
                            END AS NUMERIC(10,2)) AS "TOT PAGAR"
                        FROM (
                            SELECT 
                                tse.idevento, 
                                tse.nmcliente AS "nomeCliente",
                                tse.nmevento AS "nomeEvento", 
                                tse.nmfuncao AS "FUNÇÃO",
                                tse.nivelexperiencia,
                                tbf.nome AS "NOME", 
                                COALESCE(tse.vlrtotcache, 0) as vlrtotcache,  
                                COALESCE(tse.vlrtotajdcusto, 0) as vlrtotajdcusto, 
                                tbf.pix AS "PIX",
                                tbf.perfil AS "PERFIL_STAFF",
                                (SELECT MIN(d_val::date) FROM jsonb_array_elements_text(tse.datasevento) AS d_val)::text AS "INÍCIO",
                                (SELECT MAX(d_val::date) FROM jsonb_array_elements_text(tse.datasevento) AS d_val)::text AS "TÉRMINO",
                                
                                CAST((
                                    COALESCE(CASE WHEN tse.statusajustecusto = 'Autorizado' THEN tse.vlrajustecusto ELSE 0 END, 0) +
                                    COALESCE(CASE WHEN tse.statuscaixinha = 'Autorizado' THEN tse.vlrcaixinha ELSE 0 END, 0) +
                                    COALESCE(da.vlr_dobras, 0) +
                                    COALESCE(da.vlr_meias, 0)
                                ) AS NUMERIC(10, 2)) AS "VLR ADICIONAL",

                                -- Mantemos o cálculo dinâmico aqui como fallback (plano B)
                                (SELECT COUNT(*)::int
                                    FROM jsonb_array_elements_text(tse.datasevento) AS s(date_val)
                                    WHERE date_val::date >= $2::date AND date_val::date <= $3::date
                                    AND (
                                        tbf.perfil ILIKE '%Free%' 
                                    OR ((tbf.perfil ILIKE '%Interno%' OR tbf.perfil ILIKE '%Externo%') 
                                        AND (EXTRACT(DOW FROM date_val::date) IN (0, 6) OR date_val::date IN (SELECT data FROM feriados)))
                                    )
                                ) AS "QTD_CALCULADA",

                            

                                (SELECT COUNT(*)::int
                                FROM jsonb_array_elements_text(tse.datasevento) AS s(date_val)
                                WHERE date_val::date >= $2::date AND date_val::date <= $3::date
                                ) AS "QTD_AJUDA_CALCULADA",

                                CAST(COALESCE(tse.vlrcache, 0) AS NUMERIC(10,2)) AS "VLR CACHÊ",
                                CAST((COALESCE(tse.vlralimentacao, 0) + COALESCE(tse.vlrtransporte, 0)) AS NUMERIC(10,2)) AS "VLR AJUDA",

                                

                                COALESCE(tse.statuspgto, 'Pendente') AS "STATUS CACHÊ",
                                COALESCE(tse.statuspgtoajdcto, 'Pago') AS "STATUS AJUDA", -- Forçando o entendimento de que já foi pago
                                CASE WHEN (tse.comppgtocache IS NOT NULL AND tse.comppgtocache != '') THEN 'Anexado' ELSE 'Pendente' END AS "COMP CACHÊ",
                                CASE WHEN (tse.comppgtoajdcusto IS NOT NULL AND tse.comppgtoajdcusto != '') THEN 'Anexado' ELSE 'Pendente' END AS "COMP AJUDA"
                            FROM staffeventos tse
                            JOIN funcionarios tbf ON tse.idfuncionario = tbf.idfuncionario
                            JOIN staffempresas semp ON tse.idstaff = semp.idstaff
                            LEFT JOIN diarias_autorizadas da ON tse.idstaffevento = da.idstaffevento
                            WHERE semp.idempresa = $1 ${wherePeriodoFinal} ${whereStatus}
                            AND jsonb_array_length((SELECT jsonb_agg(date_value) FROM jsonb_array_elements_text(tse.datasevento) AS s(date_value) WHERE ${phaseFilterSql})) > 0
                        ) AS sub
                        ORDER BY sub."nomeEvento", sub."NOME";
            `;
                }
            console.log("QUERY FECHAMENTO PRINCIPAL:", queryFechamentoPrincipal);
            
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
                        totalQtdDiarias: 0,
                        totalQtdAjuda:0,
                        totalVlrDiarias:0,
                        totalTotalQtdDiarias:0,
                        totalTotalQtdAjuda:0,
                        totalTotalAdicional:0,
                        totalTotalDiarias: 0,
                        totalTotalAjuda:0,
                        totalTotalGeral: 0,
                        totalTotalPagar: 0
                    };
                }
                
                totaisPorEvento[eventoId].totalVlrAdicional += parseFloat(item["VLR ADICIONAL"] || 0);
                totaisPorEvento[eventoId].totalQtdDiarias += parseInt(item["QTD"] || 0);
                totaisPorEvento[eventoId].totalQtdAjuda += parseInt(item["QTD_AJUDA"] || 0);
                totaisPorEvento[eventoId].totalVlrDiarias += parseFloat(item["VLR DIÁRIA"] || 0);
                totaisPorEvento[eventoId].totalTotalQtdDiarias += parseInt(item["QTD"] || 0);
                totaisPorEvento[eventoId].totalTotalQtdAjuda += parseInt(item["QTD_AJUDA"] || 0);
                totaisPorEvento[eventoId].totalTotalAdicional += parseFloat(item["VLR ADICIONAL"] || 0);  
                totaisPorEvento[eventoId].totalTotalDiarias += parseFloat(item["TOT DIÁRIAS"] || 0);                
                totaisPorEvento[eventoId].totalTotalAjuda += parseFloat(item["TOT AJUDA"] || 0);
                totaisPorEvento[eventoId].totalTotalGeral += parseFloat(item["TOT GERAL"] || 0);
                totaisPorEvento[eventoId].totalTotalPagar += parseFloat(item["TOT PAGAR"] || 0);
            // console.log('Item:', totaisPorEvento[eventoId]);
            });
            relatorio.fechamentoCacheTotaisPorEvento = totaisPorEvento;

            let whereEventosExiste = whereEventos.replace(' AND ', '');
                // 2. Substitui o alias 'tse.' pelo alias 'inner_tse.' nas subqueries (se for o caso da queryUtilizacaoDiarias)
                whereEventosExiste = whereEventosExiste.replace(/tse\./g, 'inner_tse.');

            const queryUtilizacaoDiarias = `
                SELECT
                        o.idevento,
                        o.nrorcamento,
                        oi.produto AS "INFORMAÇÕES EM PROPOSTA",
                        SUM(oi.qtditens) AS "QTD PROFISSIONAIS",
                        SUM(oi.qtditens * oi.qtddias) AS "DIÁRIAS CONTRATADAS",
                        -- Usamos a contagem seletiva que funcionou no pgAdmin
                        COALESCE(MAX(td.diarias_utilizadas_no_periodo), 0) AS "DIÁRIAS UTILIZADAS",
                        SUM(oi.qtditens * oi.qtddias) - COALESCE(MAX(td.diarias_utilizadas_no_periodo), 0) AS "SALDO"
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
                            -- AQUI ESTÁ A CORREÇÃO: Conta apenas os dias do período solicitado
                            SUM((
                                SELECT COUNT(*) 
                                FROM jsonb_array_elements_text(tse.datasevento) AS s(date_val)
                                WHERE date_val::date >= $2::date AND date_val::date <= $3::date
                            )) AS diarias_utilizadas_no_periodo
                        FROM
                            staffeventos tse
                        JOIN staffempresas semp ON semp.idstaff = tse.idstaff
                        WHERE
                            semp.idempresa = $1
                        GROUP BY
                            tse.idevento, tse.idcliente, semp.idempresa, tse.nmfuncao
                    ) AS td ON td.idevento = o.idevento
                            AND td.idcliente = o.idcliente
                            AND td.idempresa = oe.idempresa
                            AND td.nmfuncao = oi.produto
                    WHERE
                        oe.idempresa = $1
                        -- ESTA É A TRAVA REAL: O orçamento deve estar dentro do ano/período selecionado
                        -- Se o filtro é 2026, orçamentos de 2025 morrem aqui.
                        AND o.dtinirealizacao >= $2::date 
                        AND o.dtinirealizacao <= $3::date
                        
                        AND EXISTS (
                            SELECT 1
                            FROM staffeventos inner_tse
                            JOIN staffempresas inner_semp ON inner_semp.idstaff = inner_tse.idstaff 
                                AND inner_semp.idempresa = oe.idempresa
                            CROSS JOIN jsonb_array_elements_text(inner_tse.datasevento) AS inner_event_date
                            WHERE 
                                inner_tse.idevento = o.idevento
                                AND inner_tse.idcliente = o.idcliente
                                -- Garante que o staff também tenha diárias nesse período
                                AND inner_event_date::date >= $2::date
                                AND inner_event_date::date <= $3::date
                                
                                -- Filtros opcionais dos selects da tela
                                AND ($4::text IS NULL OR $4::text = '' OR inner_tse.idevento::text = $4::text)
                                AND ($5::text IS NULL OR $5::text = '' OR inner_tse.idcliente::text = $5::text)
                                AND ($6::text IS NULL OR $6::text = '' OR inner_tse.idequipe::text = $6::text)
                        )
                    GROUP BY
                        o.idevento, o.nrorcamento, oi.produto
                    ORDER BY
                        o.idevento, o.nrorcamento, oi.produto;
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
                    semp.idempresa = $1 ${wherePeriodoFinal}
            )
            -- 1. DIÁRIA DOBRADA
            SELECT
                tse.idevento,
                tbf.nome AS "Profissional",
                'Diária Dobrada - R$' || CAST(CAST(ca.valor_dobrada AS NUMERIC(10,2)) AS TEXT) || ' (' || CAST(jsonb_array_length(tse.dtdiariadobrada) AS TEXT)|| ' dia(s) autorizado(s))' AS "Informacao",
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
                semp.idempresa = $1 ${wherePeriodoFinal}
                AND jsonb_array_length(tse.dtdiariadobrada) > 0
            
            UNION ALL
            
            -- 2. MEIA DIÁRIA
            SELECT
                tse.idevento,
                tbf.nome AS "Profissional",
                'Meia Diária - R$' || CAST(CAST(ca.valor_meia_diaria AS NUMERIC(10,2)) AS TEXT) || ' (' || CAST(jsonb_array_length(tse.dtmeiadiaria) AS TEXT) || ' autorizado(s) 1/2 Diária + Alimentação)' AS "Informacao",
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
                semp.idempresa = $1 ${wherePeriodoFinal}
                AND jsonb_array_length(tse.dtmeiadiaria) > 0

            UNION ALL
            
            -- 3. AJUSTE DE CUSTO
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
                semp.idempresa = $1 ${wherePeriodoFinal}
                AND tse.statusajustecusto = 'Autorizado' 
                AND tse.vlrajustecusto IS NOT NULL 
                AND tse.vlrajustecusto != 0

            UNION ALL
            
            -- 4. CAIXINHA
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
                semp.idempresa = $1 ${wherePeriodoFinal}
                AND tse.statuscaixinha = 'Autorizado' 
                AND tse.vlrcaixinha IS NOT NULL 
                AND tse.vlrcaixinha > 0

            UNION ALL

            -- 🔥 NOVO BLOCO: 5. CUSTO FECHADO
            SELECT
                tse.idevento,
                tbf.nome AS "Profissional",
                CASE 
                    WHEN tse.nivelexperiencia = 'Fechado' THEN 'Custo Fechado - R$' || CAST(tse.vlrtotal AS TEXT)
                    WHEN tse.nivelexperiencia = 'Liberado' THEN 'Custo Liberado - R$' || CAST(tse.vlrtotal AS TEXT)
                    ELSE 'Custo Especial - R$' || CAST(tse.vlrtotal AS TEXT)
                END AS "Informacao",
                tse.desccustofechado AS "Observacao"
            FROM
                staffeventos tse
            JOIN
                funcionarios tbf ON tse.idfuncionario = tbf.idfuncionario
            JOIN 
                staffempresas semp ON semp.idstaff = tse.idstaff
            WHERE
                semp.idempresa = $1 ${wherePeriodoFinal}
                AND tse.statuscustofechado = 'Autorizado'
                AND tse.nivelexperiencia IN ('Fechado', 'Liberado')
                AND tse.vlrtotal IS NOT NULL

            UNION ALL

            -- 6. BLOCO DE FERIADOS (CORRIGIDO PARA O CARNAVAL 17/02/2026)
            SELECT
                tse.idevento,
                tbf.nome AS "Profissional",
                'Feriado em dia útil - (Somado 1 cachê a mais)' AS "Informacao",
                STRING_AGG(TO_CHAR(d.data_feriado, 'DD/MM') || ' (' || d.nome_feriado || '): Somado 1 cachê a mais', ' | ') AS "Observacao"
            FROM
                staffeventos tse
            JOIN
                funcionarios tbf ON tse.idfuncionario = tbf.idfuncionario
            JOIN 
                staffempresas semp ON tse.idstaff = semp.idstaff
            CROSS JOIN LATERAL (
                SELECT f.dt as data_feriado, f.nome as nome_feriado
                FROM (
                    -- Cálculo manual fixo para 2026 garantir 17/02
                    SELECT (make_date(2026, 4, 5) + (m.desloc || ' days')::interval)::date as dt, m.nome
                    FROM (VALUES (-47, 'Terça Carnaval'), (-2, 'Sexta Santa'), (60, 'Corpus Christi')) as m(desloc, nome)
                    UNION ALL
                    SELECT make_date(2026, mes, dia), nome FROM (VALUES 
                        (1,1,'Ano Novo'),(4,21,'Tiradentes'),(5,1,'Dia do Trabalho'),
                        (9,7,'Independência'),(10,12,'Padroeira'),(11,2,'Finados'),
                        (11,15,'Proclamação'),(11,20,'Consciência Negra'),(12,25,'Natal')
                    ) as f(mes, dia, nome)
                ) f
                WHERE f.dt::text = ANY(SELECT jsonb_array_elements_text(tse.datasevento))
                AND EXTRACT(DOW FROM f.dt) NOT IN (0, 6)
            ) d
            WHERE
                semp.idempresa = $1 ${wherePeriodoFinal}
                AND (tbf.perfil ILIKE '%Interno%' OR tbf.perfil ILIKE '%Externo%')
            GROUP BY
                tse.idevento, tbf.nome

            UNION ALL

            SELECT
                tse.idevento,
                tbf.nome AS "Profissional",
                'Observação Pós-Pagamento' AS "Informacao",
                tse.obspospgto AS "Observacao"
            FROM
                staffeventos tse
            JOIN
                funcionarios tbf ON tse.idfuncionario = tbf.idfuncionario
            JOIN 
                staffempresas semp ON tse.idstaff = semp.idstaff
            WHERE
                semp.idempresa = $1 ${wherePeriodoFinal}
                AND tse.obspospgto IS NOT NULL 
                AND TRIM(tse.obspospgto) != ''

            ORDER BY
                idevento, "Profissional", "Informacao";
        `;
       // const resultContingencia = await pool.query(queryContingencia, paramsContingencia);
    //     const resultContingencia = await pool.query(queryContingencia, params);

    //     console.log("------------------------------------------");
    //     console.log("📊 DEBUG CONTINGÊNCIA:");
    //     console.log("Total de linhas retornadas:", resultContingencia.rows.length);

    //     if (resultContingencia.rows.length > 0) {
    //         resultContingencia.rows.forEach(r => {
    //             if (r.Informacao.includes("Feriado")) {
    //                 console.log(`✅ FERIADO ENCONTRADO: ${r.Profissional} | Evento: ${r.idevento}`);
    //                 console.log(`📝 Detalhe: ${r.Observacao}`);
    //             }
    //         });
    //     } else {
    //         console.log("⚠️ NENHUM dado de contingência encontrado para os filtros atuais.");
    //     }
    //     console.log("------------------------------------------");

    //     relatorio.contingencia = resultContingencia.rows;

    //     return res.json(relatorio);
        
    // } catch (error) {
    //     console.error("❌ Erro ao buscar relatório:", error);
    //     return res.status(500).json({ error: error.message || "Erro ao gerar relatório" });
    // }
    // 1. Executa a query de contingência no banco de dados
        const resultContingencia = await pool.query(queryContingencia, params);

        console.log("------------------------------------------");
        console.log("📊 DEBUG CONTINGÊNCIA:");
        console.log("Total de linhas retornadas:", resultContingencia.rows.length);

        if (resultContingencia.rows.length > 0) {
            resultContingencia.rows.forEach(r => {
                if (r.Informacao.includes("Feriado")) {
                    console.log(`✅ FERIADO ENCONTRADO: ${r.Profissional} | Evento: ${r.idevento}`);
                    console.log(`📝 Detalhe: ${r.Observacao}`);
                }
            });
        } else {
            console.log("⚠️ NENHUM dado de contingência encontrado para os filtros atuais.");
        }
        console.log("------------------------------------------");

        // 2. O PULO DO GATO: Tratando as quebras de linha no JavaScript
        // Mapeamos as linhas vindas do banco e formatamos apenas as observações desejadas
        const contingenciaFormatada = resultContingencia.rows.map(linha => {
            if (linha.Informacao === 'Observação Pós-Pagamento' && linha.Observacao) {
                linha.Observacao = linha.Observacao
                    .replace(/[\r\n]+/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim()
                    .replace(/(\[\d{2}\/\d{2},\s*\d{2}:\d{2}\])/g, '<br><br>$1')
                    .replace(/^<br><br>/, '');
            }
            return linha;
        });

        // 3. Salvamos as linhas já formatadas dentro do objeto de relatório
        relatorio.contingencia = contingenciaFormatada;

        // 4. Devolve o objeto completo já corrigido para o frontend
        return res.json(relatorio);
        
    } catch (error) {
        console.error("❌ Erro ao buscar relatório:", error);
        return res.status(500).json({ error: error.message || "Erro ao gerar relatório" });
    }
});


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

router.get('/empresas/:id', autenticarToken(), async (req, res) => {
    try {
        const idusuario = req.usuario.idusuario;
        const idempresa = req.params.id;

    const query = `
        SELECT e.idempresa, e.nmfantasia
        FROM empresas e
        INNER JOIN usuarioempresas eu ON e.idempresa = eu.idempresa
        WHERE eu.idusuario = $1 AND e.idempresa = $2 AND e.ativo = true
    `;

    const { rows } = await pool.query(query, [idusuario, idempresa]);

    if (rows.length === 0) {
        return res.status(404).json({
        error: "Acesso Negado: Você não tem permissão para acessar esta empresa ou ela não existe."
        });
    }
    return res.json(rows[0]);
    } catch (err) {
        console.error("❌ Erro ao buscar empresa:", err);
        return res.status(500).json({ error: err.message });
    }
});

module.exports = router;