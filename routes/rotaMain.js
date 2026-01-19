const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB");
const { autenticarToken, contextoEmpresa } = require('../middlewares/authMiddlewares');
const { verificarPermissao } = require('../middlewares/permissaoMiddleware');
const logMiddleware = require("../middlewares/logMiddleware");
const multer = require('multer');
const path = require('path');
const fs = require('fs');



router.get("/extra-bonificado", async (req, res) => {
    
    // ✅ CORREÇÃO DE ROBUSTEZ: Garante que idEmpresa seja uma string e evita null/undefined no pool.query
    const idEmpresa = String(req.headers.idempresa || req.query.idempresa || '').trim();
    
    // DEBUG: Esta linha DEVE aparecer no seu terminal do Node.js
    console.log("DEBUG: Tentando buscar Extra Bonificado. ID Empresa Tratado:", idEmpresa);

    // 1. Verificação obrigatória antes de consultar o DB
    if (!idEmpresa) {
        console.error("🚨 ERRO 400: idEmpresa ausente/inválido.");
        return res.status(400).json({ mensagem: "ID da empresa é obrigatório." });
    }

    try {
        const sqlQuery = `
            SELECT ae.idaditivoextra,
                ae.idfuncionario, 
                ae.idfuncao, 
                ae.idorcamento, 
                f.nome AS nome_funcionario_afetado,
                e.nmevento AS nome_evento,
                o.nrorcamento,
                ae.tiposolicitacao,
                ae.justificativa,
                ae.status AS status_aditivo,
                u.nome AS nome_usuario_solicitante
            FROM aditivoextra ae
            LEFT JOIN orcamentos o ON ae.idorcamento = o.idorcamento
            LEFT JOIN funcionarios f ON ae.idfuncionario = f.idfuncionario
            LEFT JOIN eventos e ON o.idevento = e.idevento
            LEFT JOIN usuarios u ON ae.idusuariosolicitante = u.idusuario
            WHERE 
                ae.status IN ('Autorizado') 
                AND ae.tiposolicitacao ='Extra Bonificado'
                AND ae.idempresa = $1; 
        `;

        // O CRASH ESTÁ ACONTECENDO AQUI, FORA DO TRATAMENTO ASSÍNCRONO DE ERRO.
        const pedidos = await pool.query(sqlQuery, [idEmpresa]); 
        
        return res.status(200).json(pedidos.rows); 

    } catch (error) {
        // ... (Se o erro for assíncrono, como SQL inválido) ...
        console.error("🚨 ERRO ASÍNCRONO/DB NA ROTA EXTRA BONIFICADO:", error);
        return res.status(500).json({ mensagem: "Erro interno do servidor.", detalhe: error.message });
    }
});

router.get("/adicionais", async (req, res) => {
    // 1. OBTENÇÃO DO ID DA EMPRESA
    const idEmpresa = req.headers.idempresa || req.query.idempresa;

    try {
        const sqlQuery = `
            SELECT
                ae.idaditivoextra,
                ae.idfuncionario, 
                ae.idfuncao, 
                ae.idorcamento, 
                f.nome AS nome_funcionario_afetado,
                e.nmevento AS nome_evento,
                o.nrorcamento,
                ae.tiposolicitacao,
                ae.justificativa,
                ae.status AS status_aditivo,
                u.nome AS nome_usuario_solicitante
            FROM aditivoextra ae
            LEFT JOIN orcamentos o ON ae.idorcamento = o.idorcamento
            LEFT JOIN funcionarios f ON ae.idfuncionario = f.idfuncionario
            LEFT JOIN eventos e ON o.idevento = e.idevento
            LEFT JOIN usuarios u ON ae.idusuariosolicitante = u.idusuario
            WHERE 
                ae.status IN ('Autorizado') 
                AND ae.tiposolicitacao ='Aditivo'
                -- 2. FILTRO DA EMPRESA ADICIONADO AQUI
                AND ae.idempresa = $1; 
        `;

        // 3. USA pool.query E PASSA O ID DA EMPRESA
        const pedidos = await pool.query(sqlQuery, [idEmpresa]); 

        return res.status(200).json(pedidos.rows); 

    } catch (error) {
        console.error("Erro ao buscar pedidos Adicionais:", error);
        return res.status(500).json({ mensagem: "Erro interno do servidor.", detalhe: error.message });
    }
});


// =======================================
// PROXIMOS EVENTOS E CALENDARIO
// =======================================
router.get("/proximo-evento", async (req, res) => {
  try {
    const idempresa = req.headers.idempresa || req.query.idempresa;
    if (!idempresa) return res.status(400).json({ error: "idempresa não fornecido" });

    const { rows: eventos } = await pool.query(
    `SELECT 
        e.nmevento, 
        o.dtinimarcacao, 
        o.dtinimontagem, 
        o.dtinirealizacao
    FROM orcamentos o
    JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
    JOIN eventos e ON e.idevento = o.idevento
    WHERE oe.idempresa = $1
    AND (o.dtinimarcacao >= CURRENT_DATE + INTERVAL '7 day' OR o.dtinirealizacao >= CURRENT_DATE)
    ORDER BY o.dtinimarcacao ASC`,
    [idempresa]
    );

    // Formatação para o Frontend entender as fases
    const respostaFormatada = eventos.map(ev => {
        return {
            nmevento: ev.nmevento,
            datas: {
                "Marcação": ev.dtinimarcacao,
                "Montagem": ev.dtinimontagem,
                "Realização": ev.dtinirealizacao
            }
        };
    });

    res.json({ eventos: respostaFormatada });

  } catch (err) {
    console.error("Erro em /proximo-evento:", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

router.get("/eventos-calendario", async (req, res) => {
  try {
    const idempresa = req.headers.idempresa || req.query.idempresa;
    const ano = parseInt(req.query.ano);
    const mes = parseInt(req.query.mes);

    if (!idempresa) return res.status(400).json({ error: "idempresa não fornecido" });
    if (!ano || !mes) return res.status(400).json({ error: "ano e mes são obrigatórios" });

    const { rows: eventos } = await pool.query(`
      SELECT 
        e.idevento,
        o.nomenclatura,
        e.nmevento AS evento_nome,
        o.dtiniinframontagem, o.dtfiminframontagem,
        o.dtinimarcacao, o.dtfimmarcacao,
        o.dtinimontagem, o.dtfimmontagem,
        o.dtinirealizacao, o.dtfimrealizacao,
        o.dtinidesmontagem, o.dtfimdesmontagem,
        o.dtiniinfradesmontagem, o.dtfiminfradesmontagem
      FROM orcamentos o
      JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
      JOIN eventos e ON e.idevento = o.idevento
      WHERE oe.idempresa = $1
      AND (
        -- Verifica se qualquer uma das datas cai dentro do mês/ano solicitado
        EXISTS (
          SELECT 1 FROM unnest(ARRAY[
            o.dtiniinframontagem, o.dtfiminframontagem,
            o.dtinimarcacao, o.dtfimmarcacao,
            o.dtinimontagem, o.dtfimmontagem,
            o.dtinirealizacao, o.dtfimrealizacao,
            o.dtinidesmontagem, o.dtfimdesmontagem,
            o.dtiniinfradesmontagem, o.dtfiminfradesmontagem
          ]) AS d(data)
          WHERE EXTRACT(YEAR FROM d.data) = $2 AND EXTRACT(MONTH FROM d.data) = $3
        )
      )
      ORDER BY o.dtinimarcacao ASC;
    `, [idempresa, ano, mes]);

    const resposta = [];

    // Função auxiliar para formatar data sem perder o dia devido ao fuso horário
    const formatDate = (date) => {
      if (!date) return null;
      const d = new Date(date);
      return d.getFullYear() + "-" + 
             String(d.getMonth() + 1).padStart(2, '0') + "-" + 
             String(d.getDate()).padStart(2, '0');
    };

    eventos.forEach(ev => {
      const fasesConfig = [
        { tipo: "Montagem Infra", ini: ev.dtiniinframontagem, fim: ev.dtfiminframontagem },
        { tipo: "Marcação", ini: ev.dtinimarcacao, fim: ev.dtfimmarcacao },
        { tipo: "Montagem", ini: ev.dtinimontagem, fim: ev.dtfimmontagem },
        { tipo: "Realização", ini: ev.dtinirealizacao, fim: ev.dtfimrealizacao },
        { tipo: "Desmontagem", ini: ev.dtinidesmontagem, fim: ev.dtfimdesmontagem },
        { tipo: "Desmontagem Infra", ini: ev.dtiniinfradesmontagem, fim: ev.dtfiminfradesmontagem },
      ];

      fasesConfig.forEach(f => {
        if (f.ini) {
          resposta.push({
            idevento: ev.idevento,
            nome: ev.nomenclatura ? `${ev.evento_nome} - ${ev.nomenclatura}` : ev.evento_nome,
            inicio: formatDate(f.ini),
            fim: formatDate(f.fim || f.ini),
            tipo: f.tipo
          });
        }
      });
    });

    res.json({ eventos: resposta });

  } catch (err) {
    console.error("Erro em /eventos-calendario:", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

router.get("/eventos-staff", async (req, res) => {
    try {
        // Captura os dados da requisição
        const idempresa = req.idempresa || req.headers.idempresa; // Prioriza o idempresa do middleware/token
        const idevento = req.query.idevento;
        const anoFiltro = parseInt(req.query.ano, 10) || new Date().getFullYear();

        if (!idempresa) return res.status(400).json({ error: "idempresa não fornecido" });
        if (!idevento) return res.status(400).json({ error: "idevento não fornecido" });

        const query = `
            SELECT DISTINCT
                e.nmevento,
                se.nmfuncionario AS funcionario,
                se.nmfuncao AS funcao
            FROM staffeventos se
            JOIN eventos e ON e.idevento = se.idevento
            JOIN orcamentos torc ON torc.idevento = e.idevento
            JOIN orcamentoempresas oe ON torc.idorcamento = oe.idorcamento
            WHERE oe.idempresa = $1 
              AND se.idevento = $2
              -- Filtro para garantir que as diárias do funcionário no JSONB pertencem ao ano escolhido
              AND EXISTS (
                  SELECT 1 
                  FROM jsonb_array_elements_text(se.datasevento) AS data_trabalho
                  WHERE EXTRACT(YEAR FROM data_trabalho::date) = $3
              )
            ORDER BY se.nmfuncionario;
        `;

        // Parâmetros: $1 = Empresa, $2 = Evento específico, $3 = Ano para o filtro JSONB
        const { rows } = await pool.query(query, [idempresa, idevento, anoFiltro]);

        if (rows.length === 0) {
            return res.json({ staff: { nmevento: "Evento não encontrado ou sem staff no ano", pessoas: [] } });
        }

        // Formata a resposta
        const resposta = {
            nmevento: rows[0].nmevento,
            pessoas: rows.map(r => ({
                funcionario: r.funcionario,
                funcao: r.funcao
            }))
        };

        res.json({ staff: resposta });

    } catch (err) {
        console.error("Erro em /eventos-staff:", err);
        res.status(500).json({ error: "Erro interno do servidor ao buscar equipe" });
    }
});
// =======================================


// =======================================
// EVENTOS EM ABERTOS E FECHADOS
// =======================================
// router.get("/eventos-abertos/semfiltros", async (req, res) => {
//     try {
//         const idempresa = req.headers.idempresa || req.query.idempresa;
//         const ano = req.query.ano ? Number(req.query.ano) : new Date().getFullYear();

//         if (!idempresa) return res.status(400).json({ error: "idempresa não fornecido" });
//         const params = [idempresa, ano];

//         const baseSql = `
//             WITH vagas_orc AS (
//                 SELECT 
//                     o.idevento,
//                     lm.descmontagem AS nmlocalmontagem,
//                     o.idmontagem, 
//                     MAX(o.nrorcamento) AS nrorcamento,
//                     SUM(i.qtditens) AS total_vagas,
//                     MIN(o.dtinimarcacao) AS dtinimarcacao,
//                     MAX(o.dtfimmarcacao) AS dtfimmarcacao,
//                     MIN(o.dtinimontagem) AS dtinimontagem,
//                     MAX(o.dtfimmontagem) AS dtfimmontagem,
//                     MIN(o.dtinirealizacao) AS dtinirealizacao,
//                     MAX(o.dtfimrealizacao) AS dtfimrealizacao,
//                     MIN(o.dtinidesmontagem) AS dtinidesmontagem,
//                     MAX(o.dtfimdesmontagem) AS dtfimdesmontagem,
//                     array_agg(DISTINCT f.idequipe) FILTER (WHERE f.idequipe IS NOT NULL) AS equipes_ids,
//                     array_agg(DISTINCT eq.nmequipe) FILTER (WHERE eq.nmequipe IS NOT NULL) AS equipes_nomes,
//                     array_agg(DISTINCT p.nmpavilhao) FILTER (WHERE p.nmpavilhao IS NOT NULL) AS pavilhoes_nomes,
//                     (
//                         SELECT json_agg(row_to_json(t))
//                         FROM (
//                             SELECT 
//                                 eq2.idequipe,
//                                 eq2.nmequipe AS equipe,
//                                 i2.idfuncao, 
//                                 f2.descfuncao AS nome_funcao, 
//                                 SUM(i2.qtditens) AS total_vagas
//                             FROM orcamentoitens i2
//                             JOIN funcao f2 ON f2.idfuncao = i2.idfuncao
//                             JOIN equipe eq2 ON eq2.idequipe = f2.idequipe
//                             JOIN orcamentos o2 ON o2.idorcamento = i2.idorcamento
//                             WHERE o2.idevento = o.idevento
//                             AND i2.categoria = 'Produto(s)'
//                             AND o2.status <> 'R'
//                             AND (
//                                 o2.status = 'F' 
//                                 OR (o2.status IN ('P', 'E') AND o2.contratarstaff = true)
//                             )
//                             GROUP BY eq2.idequipe, eq2.nmequipe, i2.idfuncao, f2.descfuncao
//                         ) AS t
//                     ) AS equipes_detalhes_base
//                 FROM orcamentoitens i
//                 JOIN orcamentos o ON i.idorcamento = o.idorcamento
//                 JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
//                 LEFT JOIN localmontagem lm ON lm.idmontagem = o.idmontagem
//                 LEFT JOIN funcao f ON f.idfuncao = i.idfuncao
//                 LEFT JOIN equipe eq ON eq.idequipe = f.idequipe
//                 LEFT JOIN orcamentopavilhoes op ON op.idorcamento = o.idorcamento
//                 LEFT JOIN localmontpavilhao p ON p.idpavilhao = op.idpavilhao
//                 WHERE o.idevento IS NOT NULL
//                 AND oe.idempresa = $1 
//                 AND EXTRACT(YEAR FROM o.dtinirealizacao) = $2
//                 AND i.categoria = 'Produto(s)' 
//                 AND o.status <> 'R'
//                 AND (
//                     o.status = 'F'
//                     OR (o.status IN ('P', 'E') AND o.contratarstaff = true)
//                 )
//                 GROUP BY o.idevento, lm.descmontagem, o.idmontagem
//             ),
//             staff_por_funcao AS ( 
//                 SELECT 
//                     se.idevento,
//                     se.idfuncao,
//                     COUNT(DISTINCT se.idstaff) AS preenchidas 
//                 FROM staffeventos se
//                 JOIN orcamentos o ON o.idevento = se.idevento
//                 JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
//                 WHERE oe.idempresa = $1 
//                 AND EXTRACT(YEAR FROM o.dtinirealizacao) = $2
//                 AND o.status <> 'R'
//                 AND (o.status = 'F' OR (o.status IN ('P', 'E') AND o.contratarstaff = true))
//                 AND EXISTS (
//                     SELECT 1 FROM jsonb_array_elements_text(se.datasevento) AS d(dt)
//                     WHERE EXTRACT(YEAR FROM d.dt::date) = $2
//                 )
//                 GROUP BY se.idevento, se.idfuncao
//             ),
//             staff_contagem AS (
//                 SELECT 
//                     vo.idevento,
//                     COALESCE(SUM(spf.preenchidas), 0) AS total_staff_preenchido
//                 FROM vagas_orc vo
//                 LEFT JOIN staff_por_funcao spf ON spf.idevento = vo.idevento
//                 GROUP BY vo.idevento
//             ),
//             staff_datas_por_funcao AS (
//                 SELECT
//                     se.idevento,
//                     se.idfuncao,
//                     array_agg(DISTINCT d.dt) AS datas_staff
//                 FROM staffeventos se
//                 LEFT JOIN LATERAL jsonb_array_elements_text(se.datasevento) AS d(dt) ON TRUE
//                 JOIN orcamentos o ON se.idevento = o.idevento
//                 JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
//                 WHERE oe.idempresa = $1
//                 AND EXTRACT(YEAR FROM o.dtinirealizacao) = $2
//                 AND EXTRACT(YEAR FROM d.dt::date) = $2
//                 AND o.status <> 'R'
//                 AND (o.status = 'F' OR (o.status IN ('P', 'E') AND o.contratarstaff = true))
//                 GROUP BY se.idevento, se.idfuncao
//             ),
//             cliente_info AS (
//                 SELECT DISTINCT ON (o.idevento)
//                     o.idevento, c.idcliente, c.nmfantasia
//                 FROM orcamentos o
//                 JOIN clientes c ON c.idcliente = o.idcliente
//                 WHERE o.idevento IS NOT NULL
//                 AND EXTRACT(YEAR FROM o.dtinirealizacao) = $2
//                 AND o.status <> 'R'
//                 AND (o.status = 'F' OR (o.status IN ('P', 'E') AND o.contratarstaff = true))
//                 ORDER BY o.idevento, o.dtinirealizacao DESC 
//             )
//             SELECT 
//                 e.idevento, e.nmevento, vo.nmlocalmontagem, vo.idmontagem, vo.nrorcamento,
//                 ci.idcliente, ci.nmfantasia,
//                 COALESCE(vo.pavilhoes_nomes, ARRAY[]::text[]) AS pavilhoes_nomes,
//                 COALESCE(vo.dtinirealizacao, CURRENT_DATE) AS dtinirealizacao,
//                 COALESCE(vo.dtfimrealizacao, CURRENT_DATE) AS dtfimrealizacao,
//                 COALESCE(vo.dtinimarcacao, CURRENT_DATE) AS dtinimarcacao,
//                 COALESCE(vo.dtfimdesmontagem, CURRENT_DATE) AS dtfimdesmontagem,
//                 COALESCE(vo.total_vagas, 0) AS total_vagas,
//                 COALESCE(sc.total_staff_preenchido, 0) AS total_staff,
//                 (COALESCE(vo.total_vagas, 0) - COALESCE(sc.total_staff_preenchido, 0)) AS vagas_restantes,
//                 COALESCE(vo.equipes_ids, ARRAY[]::int[]) AS equipes_ids,
//                 COALESCE(vo.equipes_nomes, ARRAY[]::text[]) AS equipes_nomes,
//                 (
//                     SELECT json_agg(
//                         json_build_object(
//                             'idequipe', (b->>'idequipe')::int,
//                             'equipe', b->>'equipe',
//                             'idfuncao', (b->>'idfuncao')::int,
//                             'nome_funcao', b->>'nome_funcao',
//                             'total_vagas', (b->>'total_vagas')::int,
//                             'preenchidas', COALESCE(spf.preenchidas, 0), 
//                             'datas_staff', COALESCE(sdf.datas_staff, ARRAY[]::text[])
//                         )
//                     )
//                     FROM json_array_elements(vo.equipes_detalhes_base) AS b
//                     LEFT JOIN staff_por_funcao spf ON spf.idevento = e.idevento AND spf.idfuncao = (b->>'idfuncao')::int 
//                     LEFT JOIN staff_datas_por_funcao sdf ON sdf.idevento = e.idevento AND sdf.idfuncao = (b->>'idfuncao')::int
//                 ) AS equipes_detalhes,
//                 'aberto' AS status_evento
//             FROM eventos e
//             INNER JOIN vagas_orc vo ON vo.idevento = e.idevento
//             LEFT JOIN staff_contagem sc ON sc.idevento = e.idevento
//             LEFT JOIN cliente_info ci ON ci.idevento = e.idevento
//             WHERE (vo.dtfimdesmontagem IS NULL OR vo.dtfimdesmontagem >= CURRENT_DATE)
//             ORDER BY COALESCE(vo.dtinirealizacao, CURRENT_DATE) ASC;
//         `;

//         const { rows } = await pool.query(baseSql, params);
        
//         const mappedRows = rows.map(evt => {
//             const resumoEquipesMap = (evt.equipes_detalhes || []).reduce((acc, func) => {
//                 const nomeEquipe = func.equipe;
//                 const totalVagas = func.total_vagas || 0;
//                 const preenchidas = func.preenchidas || 0;
//                 if (!acc[nomeEquipe]) acc[nomeEquipe] = { total: 0, preenchido: 0 };
//                 acc[nomeEquipe].total += totalVagas;
//                 acc[nomeEquipe].preenchido += preenchidas;
//                 return acc;
//             }, {});

//             const resumoFormatado = Object.entries(resumoEquipesMap).map(([equipe, dados]) => {
//                 const restante = dados.total - dados.preenchido;
//                 let cor = "🟢"; 
//                 if (dados.total === 0) cor = "⚪"; 
//                 else if (dados.preenchido === 0) cor = "🔴"; 
//                 else if (restante > 0) cor = "🟡"; 

//                 return `${equipe}: ${cor} ${dados.preenchido}/${dados.total}`;
//             }).join(" | ");

//             return { ...evt, resumoEquipes: resumoFormatado };
//         });

//         return res.json(mappedRows);
//     } catch (err) {
//         console.error("Erro em /eventos-abertos:", err);
//         res.status(500).json({ error: "Erro interno ao buscar eventos abertos." });
//     }
// });

router.get("/eventos-abertos", async (req, res) => {
    try {
        const idempresa = req.headers.idempresa || req.query.idempresa;
        const { periodo, valor } = req.query;

        if (!idempresa) return res.status(400).json({ error: "idempresa não fornecido" });

        // --- LÓGICA DE FILTRO DE DATA ATUALIZADA ---
        let dataInicio, dataFim;
        const hoje = new Date();
        const anoAtual = 2026; // Mantendo o padrão do seu sistema

        // Se o valor for uma data ISO (vindo do input date), usamos ela. 
        // Caso contrário (se for um número de mês/trimestre), usamos o ano base.
        const baseData = (valor && valor.includes('-')) ? new Date(valor) : new Date(anoAtual, 0, 1);

        if (periodo === 'diario') {
            dataInicio = new Date(baseData); 
            dataFim = new Date(baseData);
        } 
        else if (periodo === 'semanal') {
            dataInicio = new Date(baseData); 
            dataFim = new Date(baseData);
            dataFim.setDate(dataFim.getDate() + 7);
        } 
        else if (periodo === 'mensal') {
            const mes = isNaN(valor) ? hoje.getMonth() : parseInt(valor) - 1;
            dataInicio = new Date(anoAtual, mes, 1);
            dataFim = new Date(anoAtual, mes + 1, 0);
        } 
        else if (periodo === 'Trimestral') {
            const trim = parseInt(valor) || 1; // 1, 2, 3 ou 4
            // Trim 1: meses 0-2 | Trim 2: meses 3-5 | Trim 3: meses 6-8 | Trim 4: meses 9-11
            dataInicio = new Date(anoAtual, (trim - 1) * 3, 1);
            dataFim = new Date(anoAtual, trim * 3, 0);
        } 
        else if (periodo === 'Semestral') {
            const sem = parseInt(valor) || 1; // 1 ou 2
            // Sem 1: meses 0-5 | Sem 2: meses 6-11
            dataInicio = new Date(anoAtual, (sem - 1) * 6, 1);
            dataFim = new Date(anoAtual, sem * 6, 0);
        } 
        else { // anual
            const ano = isNaN(valor) ? anoAtual : parseInt(valor);
            dataInicio = new Date(ano, 0, 1);
            dataFim = new Date(ano, 11, 31);
        }

        const params = [
            idempresa, 
            dataInicio.toISOString().split('T')[0], 
            dataFim.toISOString().split('T')[0]
        ];

        const sql = `
            WITH vagas_orc AS (
                SELECT 
                    o.idevento, lm.descmontagem AS nmlocalmontagem, o.idmontagem, 
                    MAX(o.nrorcamento) AS nrorcamento,
                    SUM(i.qtditens) AS total_vagas,
                    MIN(o.dtinimarcacao) AS dtinimarcacao, MAX(o.dtfimmarcacao) AS dtfimmarcacao,
                    MIN(o.dtinimontagem) AS dtinimontagem, MAX(o.dtfimmontagem) AS dtfimmontagem,
                    MIN(o.dtinirealizacao) AS dtinirealizacao, MAX(o.dtfimrealizacao) AS dtfimrealizacao,
                    MIN(o.dtinidesmontagem) AS dtinidesmontagem, MAX(o.dtfimdesmontagem) AS dtfimdesmontagem,
                    array_agg(DISTINCT f.idequipe) FILTER (WHERE f.idequipe IS NOT NULL) AS equipes_ids,
                    array_agg(DISTINCT eq.nmequipe) FILTER (WHERE eq.nmequipe IS NOT NULL) AS equipes_nomes,
                    array_agg(DISTINCT p.nmpavilhao) FILTER (WHERE p.nmpavilhao IS NOT NULL) AS pavilhoes_nomes,
                    (SELECT json_agg(row_to_json(t)) FROM (
                        SELECT eq2.idequipe, eq2.nmequipe AS equipe, i2.idfuncao, f2.descfuncao AS nome_funcao, SUM(i2.qtditens) AS total_vagas
                        FROM orcamentoitens i2
                        JOIN funcao f2 ON f2.idfuncao = i2.idfuncao
                        JOIN equipe eq2 ON eq2.idequipe = f2.idequipe
                        JOIN orcamentos o2 ON o2.idorcamento = i2.idorcamento
                        WHERE o2.idevento = o.idevento AND i2.categoria = 'Produto(s)' AND o2.status <> 'R'
                        AND (o2.status = 'F' OR (o2.status IN ('P', 'E') AND o2.contratarstaff = true))
                        GROUP BY eq2.idequipe, eq2.nmequipe, i2.idfuncao, f2.descfuncao
                    ) AS t) AS equipes_detalhes_base
                FROM orcamentoitens i
                JOIN orcamentos o ON i.idorcamento = o.idorcamento
                JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
                LEFT JOIN localmontagem lm ON lm.idmontagem = o.idmontagem
                LEFT JOIN funcao f ON f.idfuncao = i.idfuncao
                LEFT JOIN equipe eq ON eq.idequipe = f.idequipe
                LEFT JOIN orcamentopavilhoes op ON op.idorcamento = o.idorcamento
                LEFT JOIN localmontpavilhao p ON p.idpavilhao = op.idpavilhao
                WHERE oe.idempresa = $1 
                AND (o.dtinirealizacao BETWEEN $2 AND $3 OR o.dtfimrealizacao BETWEEN $2 AND $3)
                AND i.categoria = 'Produto(s)' AND o.status <> 'R'
                AND (o.status = 'F' OR (o.status IN ('P', 'E') AND o.contratarstaff = true))
                GROUP BY o.idevento, lm.descmontagem, o.idmontagem
            ),
            staff_por_funcao AS (
                SELECT 
                    se.idevento, 
                    se.idfuncao, 
                    COUNT(DISTINCT se.idstaff) AS preenchidas,
                    MIN(f.idequipe) AS idequipe_staff,
                    MIN(eq.nmequipe) AS equipe_staff
                FROM staffeventos se
                LEFT JOIN funcao f ON f.idfuncao = se.idfuncao
                LEFT JOIN equipe eq ON eq.idequipe = f.idequipe
                WHERE EXISTS (
                    SELECT 1 FROM jsonb_array_elements_text(se.datasevento) AS d(dt)
                    WHERE d.dt::date BETWEEN $2 AND $3
                )
                GROUP BY se.idevento, se.idfuncao
            ),
            staff_datas_por_funcao AS (
                SELECT se.idevento, se.idfuncao, array_agg(DISTINCT d.dt) AS datas_staff
                FROM staffeventos se, jsonb_array_elements_text(se.datasevento) AS d(dt)
                WHERE d.dt::date BETWEEN $2 AND $3
                GROUP BY se.idevento, se.idfuncao
            ),
            cliente_info AS (
                SELECT DISTINCT ON (o.idevento) o.idevento, c.idcliente, c.nmfantasia
                FROM orcamentos o JOIN clientes c ON c.idcliente = o.idcliente
                WHERE o.status <> 'R' ORDER BY o.idevento, o.dtinirealizacao DESC 
            )
            SELECT e.idevento, e.nmevento, vo.*, ci.nmfantasia,
                (
                    SELECT json_agg(jsonb_build_object(
                        'idequipe', (b->>'idequipe')::int,
                        'equipe', b->>'equipe',
                        'idfuncao', (b->>'idfuncao')::int,
                        'nome_funcao', b->>'nome_funcao',
                        'total_vagas', (b->>'total_vagas')::int,
                        'preenchidas', COALESCE(spf.preenchidas, 0),
                        'datas_staff', COALESCE(sdf.datas_staff, ARRAY[]::text[])
                    ))
                    FROM json_array_elements(
                        (SELECT equipes_detalhes_base FROM vagas_orc WHERE idevento = e.idevento)
                    ) AS b
                    LEFT JOIN staff_por_funcao spf ON spf.idevento = e.idevento 
                        AND spf.idfuncao = (b->>'idfuncao')::int
                    LEFT JOIN staff_datas_por_funcao sdf ON sdf.idevento = e.idevento 
                        AND sdf.idfuncao = (b->>'idfuncao')::int
                ) AS equipes_detalhes
            FROM eventos e
            INNER JOIN vagas_orc vo ON vo.idevento = e.idevento
            LEFT JOIN cliente_info ci ON ci.idevento = e.idevento
            WHERE (vo.dtfimdesmontagem IS NULL OR vo.dtfimdesmontagem >= CURRENT_DATE)
            ORDER BY vo.dtinirealizacao ASC;
        `;

        const { rows } = await pool.query(sql, params);
        
        // DEBUG: Verificar o que vem do banco
        rows.forEach(r => {
            if (r.nmevento && (r.nmevento.includes('ABAV') || r.nmevento.includes('CIOSP'))) {
                console.log('\n=== DEBUG', r.nmevento, '===');
                console.log('equipes_detalhes_base:', JSON.stringify(r.equipes_detalhes_base, null, 2));
                console.log('equipes_detalhes (final):', JSON.stringify(r.equipes_detalhes, null, 2));
            }
        });
        
        // Função de mapeamento para o resumo visual
        const mappedRows = rows.map(evt => {
            const resumoEquipesMap = (evt.equipes_detalhes || []).reduce((acc, func) => {
                const nomeEquipe = func.equipe;
                if (!acc[nomeEquipe]) acc[nomeEquipe] = { total: 0, preenchido: 0 };
                acc[nomeEquipe].total += (func.total_vagas || 0);
                acc[nomeEquipe].preenchido += (func.preenchidas || 0);
                return acc;
            }, {});

            const resumoFormatado = Object.entries(resumoEquipesMap).map(([equipe, dados]) => {
                const restante = dados.total - dados.preenchido;
                let cor = "🟢"; 
                if (dados.total === 0) cor = "⚪"; 
                else if (dados.preenchido === 0) cor = "🔴"; 
                else if (restante > 0) cor = "🟡"; 
                return `${equipe}: ${cor} ${dados.preenchido}/${dados.total}`;
            }).join(" | ");

            // Recalcula totais para o card principal
            const totalVagas = Object.values(resumoEquipesMap).reduce((a, b) => a + b.total, 0);
            const totalStaff = Object.values(resumoEquipesMap).reduce((a, b) => a + b.preenchido, 0);

            return { 
                ...evt, 
                resumoEquipes: resumoFormatado,
                total_vagas: totalVagas,
                total_staff: totalStaff,
                vagas_restantes: totalVagas - totalStaff
            };
        });

        res.json(mappedRows);
    } catch (err) {
        console.error("ERRO DETALHADO NO BACKEND:", err);
        res.status(500).json({ error: "Erro interno.", message: err.message });
    }
});

// router.get("/eventos-fechados/semfiltros", async (req, res) => {
//     try {
//         const idempresa = req.headers.idempresa || req.query.idempresa;
//         const ano = req.query.ano ? Number(req.query.ano) : new Date().getFullYear();

//         if (!idempresa) return res.status(400).json({ error: "idempresa não fornecido." });
//         const params = [idempresa, ano];

//         const baseSql = `
//         WITH vagas_orc AS (
//             SELECT 
//                 o.idevento, o.idmontagem,
//                 lm.descmontagem AS nmlocalmontagem,
//                 MAX(o.nrorcamento) AS nrorcamento,
//                 SUM(i.qtditens) AS total_vagas,
//                 MIN(o.dtinimarcacao) AS dtinimarcacao,
//                 MAX(o.dtfimmarcacao) AS dtfimmarcacao,
//                 MIN(o.dtinimontagem) AS dtinimontagem,
//                 MAX(o.dtfimmontagem) AS dtfimmontagem,
//                 MIN(o.dtinirealizacao) AS dtinirealizacao,
//                 MAX(o.dtfimrealizacao) AS dtfimrealizacao,
//                 MIN(o.dtinidesmontagem) AS dtinidesmontagem,
//                 MAX(o.dtfimdesmontagem) AS dtfimdesmontagem,
//                 array_agg(DISTINCT f.idequipe) FILTER (WHERE f.idequipe IS NOT NULL) AS equipes_ids,
//                 array_agg(DISTINCT eq.nmequipe) FILTER (WHERE eq.nmequipe IS NOT NULL) AS equipes_nomes,
//                 array_agg(DISTINCT p.nmpavilhao) FILTER (WHERE p.nmpavilhao IS NOT NULL) AS pavilhoes_nomes,
//                 (
//                     SELECT json_agg(row_to_json(t))
//                     FROM (
//             SELECT 
//                 eq2.idequipe,
//                 eq2.nmequipe AS equipe,
//                 i2.idfuncao, 
//                 f2.descfuncao AS nome_funcao, 
//                 SUM(i2.qtditens) AS total_vagas,
//                 MIN(i2.periododiariasinicio) AS dtini_vaga,
//                 MAX(i2.periododiariasfim) AS dtfim_vaga
//             FROM orcamentoitens i2
//             JOIN funcao f2 ON f2.idfuncao = i2.idfuncao
//             JOIN equipe eq2 ON eq2.idequipe = f2.idequipe
//             JOIN orcamentos o2 ON o2.idorcamento = i2.idorcamento
//             WHERE o2.idevento = o.idevento
//             AND i2.categoria = 'Produto(s)' 
//             GROUP BY eq2.idequipe, eq2.nmequipe, i2.idfuncao, f2.descfuncao
//                     ) AS t
//                 ) AS equipes_detalhes_base
//             FROM orcamentoitens i
//             JOIN orcamentos o ON i.idorcamento = o.idorcamento
//             JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
//             LEFT JOIN localmontagem lm ON lm.idmontagem = o.idmontagem
//             LEFT JOIN funcao f ON f.idfuncao = i.idfuncao
//             LEFT JOIN equipe eq ON eq.idequipe = f.idequipe
//             LEFT JOIN orcamentopavilhoes op ON op.idorcamento = o.idorcamento
//             LEFT JOIN localmontpavilhao p ON p.idpavilhao = op.idpavilhao
//             WHERE o.idevento IS NOT NULL
//             AND oe.idempresa = $1
//             AND EXTRACT(YEAR FROM o.dtinirealizacao) = $2
//             AND i.categoria = 'Produto(s)'
//             GROUP BY o.idevento, o.idmontagem, lm.descmontagem
//         ),
//         staff_por_funcao AS ( 
//             SELECT 
//                 se.idevento, se.idfuncao,
//                 COUNT(DISTINCT se.idstaff) AS preenchidas 
//             FROM staffeventos se
//             JOIN orcamentos o ON o.idevento = se.idevento
//             JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
//             WHERE oe.idempresa = $1 
//             AND EXTRACT(YEAR FROM o.dtinirealizacao) = $2
//             AND EXISTS (
//                 SELECT 1 FROM jsonb_array_elements_text(se.datasevento) AS d(dt)
//                 WHERE EXTRACT(YEAR FROM d.dt::date) = $2
//             )
//             GROUP BY se.idevento, se.idfuncao
//         ),
//         staff_contagem AS (
//             SELECT 
//                 vo.idevento,
//                 COALESCE(SUM(spf.preenchidas), 0) AS total_staff_preenchido
//             FROM vagas_orc vo
//             LEFT JOIN staff_por_funcao spf ON spf.idevento = vo.idevento
//             GROUP BY vo.idevento
//         ),
//         staff_datas_por_funcao AS (
//             SELECT
//                 se.idevento, se.idfuncao,
//                 array_agg(DISTINCT d.dt) AS datas_staff
//             FROM staffeventos se
//             LEFT JOIN LATERAL jsonb_array_elements_text(se.datasevento) AS d(dt) ON TRUE
//             JOIN orcamentos o ON se.idevento = o.idevento
//             JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
//             WHERE oe.idempresa = $1
//             AND EXTRACT(YEAR FROM o.dtinirealizacao) = $2
//             AND EXTRACT(YEAR FROM d.dt::date) = $2
//             GROUP BY se.idevento, se.idfuncao
//         ), 
//         cliente_info AS ( 
//             SELECT DISTINCT ON (o.idevento)
//                 o.idevento, c.idcliente, c.nmfantasia
//             FROM orcamentos o
//             JOIN clientes c ON c.idcliente = o.idcliente
//             WHERE o.idevento IS NOT NULL
//             AND EXTRACT(YEAR FROM o.dtinirealizacao) = $2
//             ORDER BY o.idevento, o.dtinirealizacao DESC 
//         )
//         SELECT 
//             e.idevento, e.nmevento, vo.idmontagem, vo.nmlocalmontagem, vo.nrorcamento,
//             ci.idcliente, ci.nmfantasia,
//             COALESCE(vo.pavilhoes_nomes, ARRAY[]::text[]) AS pavilhoes_nomes,
//             COALESCE(vo.dtinirealizacao, CURRENT_DATE) AS dtinirealizacao,
//             COALESCE(vo.dtfimrealizacao, CURRENT_DATE) AS dtfimrealizacao,
//             COALESCE(vo.dtinimarcacao, CURRENT_DATE) AS dtinimarcacao,
//             COALESCE(vo.dtfimdesmontagem, CURRENT_DATE) AS dtfimdesmontagem,
//             COALESCE(vo.total_vagas, 0) AS total_vagas,
//             COALESCE(sc.total_staff_preenchido, 0) AS total_staff,
//             (COALESCE(vo.total_vagas, 0) - COALESCE(sc.total_staff_preenchido, 0)) AS vagas_restantes,
//             COALESCE(vo.equipes_ids, ARRAY[]::int[]) AS equipes_ids,
//             COALESCE(vo.equipes_nomes, ARRAY[]::text[]) AS equipes_nomes,
//             (
//                 SELECT json_agg(
//                     json_build_object(
//             'idequipe', (b->>'idequipe')::int,
//             'equipe', b->>'equipe',
//             'idfuncao', (b->>'idfuncao')::int,
//             'nome_funcao', b->>'nome_funcao',
//             'total_vagas', (b->>'total_vagas')::int,
//             'preenchidas', COALESCE(spf.preenchidas, 0), 
//             'dtini_vaga', b->>'dtini_vaga',
//             'dtfim_vaga', b->>'dtfim_vaga',
//             'datas_staff', COALESCE(sdf.datas_staff, ARRAY[]::text[])
//                     )
//                 )
//                 FROM json_array_elements(vo.equipes_detalhes_base) AS b
//                 LEFT JOIN staff_por_funcao spf ON spf.idevento = e.idevento AND spf.idfuncao = (b->>'idfuncao')::int 
//                 LEFT JOIN staff_datas_por_funcao sdf ON sdf.idevento = e.idevento AND sdf.idfuncao = (b->>'idfuncao')::int
//             ) AS equipes_detalhes,
//             'fechado' AS status_evento
//         FROM eventos e
//         INNER JOIN vagas_orc vo ON vo.idevento = e.idevento
//         LEFT JOIN staff_contagem sc ON sc.idevento = e.idevento
//         LEFT JOIN cliente_info ci ON ci.idevento = e.idevento
//         WHERE (vo.dtfimdesmontagem IS NOT NULL AND vo.dtfimdesmontagem < CURRENT_DATE)
//         ORDER BY COALESCE(vo.dtinirealizacao, CURRENT_DATE) DESC;
//         `;

//         const { rows } = await pool.query(baseSql, params);
        
//         const mappedRows = rows.map(evt => {
//             const resumoEquipesMap = (evt.equipes_detalhes || []).reduce((acc, func) => {
//                 const nomeEquipe = func.equipe;
//                 const totalVagas = func.total_vagas || 0;
//                 const preenchidas = func.preenchidas || 0;

//                 // Agrega Vagas e Staff Preenchido por NOME DA EQUIPE
//                 if (!acc[nomeEquipe]) {
//                     acc[nomeEquipe] = { total: 0, preenchido: 0 };
//                 }

//                 acc[nomeEquipe].total += totalVagas;
//                 acc[nomeEquipe].preenchido += preenchidas;

//                 return acc;
//             }, {});

//             const resumoFormatado = Object.entries(resumoEquipesMap).map(([equipe, dados]) => {
//                 const restante = dados.total - dados.preenchido;
//                 let cor = "🟢"; // Verde: Completo ou Superou

//                 if (dados.total === 0) cor = "⚪"; // Sem vagas
//                 else if (dados.preenchido === 0) cor = "🔴"; // Vermelho: 0 preenchido
//                 else if (restante > 0) cor = "🟡"; // Amarelo: Parcialmente preenchido

//                 return `${equipe}: ${cor} ${dados.preenchido}/${dados.total}`;
//             }).join(" | ");

//             return { ...evt, resumoEquipes: resumoFormatado };
//         });

//         return res.json(mappedRows);
//     } catch (err) {
//         console.error("Erro em /eventos-fechados:", err);
//         res.status(500).json({ error: "Erro interno ao buscar eventos fechados." });
//     }
// });

router.get("/eventos-fechados", async (req, res) => {
    try {
        const idempresa = req.headers.idempresa || req.query.idempresa;
        const { periodo, valor } = req.query; // Pega os filtros do frontend

        if (!idempresa) return res.status(400).json({ error: "idempresa não fornecido." });

        // --- LÓGICA DE JANELA DE TEMPO DINÂMICA ---
        let dataInicio, dataFim;
        const hoje = new Date();
        const baseData = valor && valor.includes('-') ? new Date(valor) : hoje;

        if (periodo === 'diario') {
            dataInicio = new Date(baseData); dataFim = new Date(baseData);
        } else if (periodo === 'semanal') {
            dataInicio = new Date(baseData); dataFim = new Date(baseData);
            dataFim.setDate(dataFim.getDate() + 7);
        } else if (periodo === 'mensal') {
            const mes = isNaN(valor) ? baseData.getMonth() : parseInt(valor) - 1;
            dataInicio = new Date(baseData.getFullYear(), mes, 1);
            dataFim = new Date(baseData.getFullYear(), mes + 1, 0);
        } else if (periodo === 'anual') {
            const ano = isNaN(valor) ? baseData.getFullYear() : parseInt(valor);
            dataInicio = new Date(ano, 0, 1);
            dataFim = new Date(ano, 11, 31);
        } else {
            // Fallback para o ano atual se não vier período
            dataInicio = new Date(hoje.getFullYear(), 0, 1);
            dataFim = new Date(hoje.getFullYear(), 11, 31);
        }

        const params = [
            idempresa, 
            dataInicio.toISOString().split('T')[0], 
            dataFim.toISOString().split('T')[0]
        ];

        const baseSql = `
        WITH vagas_orc AS (
            SELECT 
                o.idevento, o.idmontagem,
                lm.descmontagem AS nmlocalmontagem,
                MAX(o.nrorcamento) AS nrorcamento,
                SUM(i.qtditens) AS total_vagas,
                MIN(o.dtinimarcacao) AS dtinimarcacao, MAX(o.dtfimmarcacao) AS dtfimmarcacao,
                MIN(o.dtinimontagem) AS dtinimontagem, MAX(o.dtfimmontagem) AS dtfimmontagem,
                MIN(o.dtinirealizacao) AS dtinirealizacao, MAX(o.dtfimrealizacao) AS dtfimrealizacao,
                MIN(o.dtinidesmontagem) AS dtinidesmontagem, MAX(o.dtfimdesmontagem) AS dtfimdesmontagem,
                array_agg(DISTINCT f.idequipe) FILTER (WHERE f.idequipe IS NOT NULL) AS equipes_ids,
                array_agg(DISTINCT eq.nmequipe) FILTER (WHERE eq.nmequipe IS NOT NULL) AS equipes_nomes,
                array_agg(DISTINCT p.nmpavilhao) FILTER (WHERE p.nmpavilhao IS NOT NULL) AS pavilhoes_nomes,
                (
                    SELECT json_agg(row_to_json(t))
                    FROM (
                        SELECT 
                            eq2.idequipe, eq2.nmequipe AS equipe, i2.idfuncao, 
                            f2.descfuncao AS nome_funcao, SUM(i2.qtditens) AS total_vagas,
                            MIN(i2.periododiariasinicio) AS dtini_vaga,
                            MAX(i2.periododiariasfim) AS dtfim_vaga
                        FROM orcamentoitens i2
                        JOIN funcao f2 ON f2.idfuncao = i2.idfuncao
                        JOIN equipe eq2 ON eq2.idequipe = f2.idequipe
                        JOIN orcamentos o2 ON o2.idorcamento = i2.idorcamento
                        WHERE o2.idevento = o.idevento AND i2.categoria = 'Produto(s)' 
                        GROUP BY eq2.idequipe, eq2.nmequipe, i2.idfuncao, f2.descfuncao
                    ) AS t
                ) AS equipes_detalhes_base
            FROM orcamentoitens i
            JOIN orcamentos o ON i.idorcamento = o.idorcamento
            JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
            LEFT JOIN localmontagem lm ON lm.idmontagem = o.idmontagem
            LEFT JOIN funcao f ON f.idfuncao = i.idfuncao
            LEFT JOIN equipe eq ON eq.idequipe = f.idequipe
            LEFT JOIN orcamentopavilhoes op ON op.idorcamento = o.idorcamento
            LEFT JOIN localmontpavilhao p ON p.idpavilhao = op.idpavilhao
            WHERE o.idevento IS NOT NULL
            AND oe.idempresa = $1
            AND (o.dtinirealizacao BETWEEN $2 AND $3 OR o.dtfimrealizacao BETWEEN $2 AND $3)
            AND i.categoria = 'Produto(s)'
            GROUP BY o.idevento, o.idmontagem, lm.descmontagem
        ),
        staff_por_funcao AS ( 
            SELECT 
                se.idevento, se.idfuncao,
                COUNT(DISTINCT se.idstaff) AS preenchidas 
            FROM staffeventos se
            JOIN orcamentos o ON o.idevento = se.idevento
            JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
            WHERE oe.idempresa = $1 
            AND EXISTS (
                SELECT 1 FROM jsonb_array_elements_text(se.datasevento) AS d(dt)
                WHERE d.dt::date BETWEEN $2 AND $3
            )
            GROUP BY se.idevento, se.idfuncao
        ),
        staff_datas_por_funcao AS (
            SELECT
                se.idevento, se.idfuncao,
                array_agg(DISTINCT d.dt) AS datas_staff
            FROM staffeventos se
            LEFT JOIN LATERAL jsonb_array_elements_text(se.datasevento) AS d(dt) ON TRUE
            JOIN orcamentos o ON se.idevento = o.idevento
            JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
            WHERE oe.idempresa = $1
            AND d.dt::date BETWEEN $2 AND $3
            GROUP BY se.idevento, se.idfuncao
        ), 
        cliente_info AS ( 
            SELECT DISTINCT ON (o.idevento)
                o.idevento, c.idcliente, c.nmfantasia
            FROM orcamentos o
            JOIN clientes c ON c.idcliente = o.idcliente
            WHERE o.idevento IS NOT NULL
            AND (o.dtinirealizacao BETWEEN $2 AND $3 OR o.dtfimrealizacao BETWEEN $2 AND $3)
            ORDER BY o.idevento, o.dtinirealizacao DESC 
        )
        SELECT 
            e.idevento, e.nmevento, vo.idmontagem, vo.nmlocalmontagem, vo.nrorcamento,
            ci.idcliente, ci.nmfantasia,
            COALESCE(vo.pavilhoes_nomes, ARRAY[]::text[]) AS pavilhoes_nomes,
            COALESCE(vo.dtinirealizacao, CURRENT_DATE) AS dtinirealizacao,
            COALESCE(vo.dtfimrealizacao, CURRENT_DATE) AS dtfimrealizacao,
            COALESCE(vo.dtinimarcacao, CURRENT_DATE) AS dtinimarcacao,
            COALESCE(vo.dtfimdesmontagem, CURRENT_DATE) AS dtfimdesmontagem,
            COALESCE(vo.total_vagas, 0) AS total_vagas,
            (SELECT COALESCE(SUM(spf.preenchidas), 0) FROM staff_por_funcao spf WHERE spf.idevento = e.idevento) AS total_staff,
            COALESCE(vo.equipes_ids, ARRAY[]::int[]) AS equipes_ids,
            COALESCE(vo.equipes_nomes, ARRAY[]::text[]) AS equipes_nomes,
            (
                SELECT json_agg(
                    json_build_object(
                        'idequipe', (b->>'idequipe')::int,
                        'equipe', b->>'equipe',
                        'idfuncao', (b->>'idfuncao')::int,
                        'nome_funcao', b->>'nome_funcao',
                        'total_vagas', (b->>'total_vagas')::int,
                        'preenchidas', COALESCE(spf.preenchidas, 0), 
                        'dtini_vaga', b->>'dtini_vaga',
                        'dtfim_vaga', b->>'dtfim_vaga',
                        'datas_staff', COALESCE(sdf.datas_staff, ARRAY[]::text[])
                    )
                )
                FROM json_array_elements(vo.equipes_detalhes_base) AS b
                LEFT JOIN staff_por_funcao spf ON spf.idevento = e.idevento AND spf.idfuncao = (b->>'idfuncao')::int 
                LEFT JOIN staff_datas_por_funcao sdf ON sdf.idevento = e.idevento AND sdf.idfuncao = (b->>'idfuncao')::int
            ) AS equipes_detalhes,
            'fechado' AS status_evento
        FROM eventos e
        INNER JOIN vagas_orc vo ON vo.idevento = e.idevento
        LEFT JOIN cliente_info ci ON ci.idevento = e.idevento
        WHERE (vo.dtfimdesmontagem IS NOT NULL AND vo.dtfimdesmontagem < CURRENT_DATE)
        ORDER BY vo.dtinirealizacao DESC;
        `;

        const { rows } = await pool.query(baseSql, params);
        
        // Mapeamento para o resumo visual (Bolinhas coloridas)
        const mappedRows = rows.map(evt => {
            const resumoEquipesMap = (evt.equipes_detalhes || []).reduce((acc, func) => {
                const nomeEquipe = func.equipe;
                if (!acc[nomeEquipe]) acc[nomeEquipe] = { total: 0, preenchido: 0 };
                acc[nomeEquipe].total += (func.total_vagas || 0);
                acc[nomeEquipe].preenchido += (func.preenchidas || 0);
                return acc;
            }, {});

            const resumoFormatado = Object.entries(resumoEquipesMap).map(([equipe, dados]) => {
                const restante = dados.total - dados.preenchido;
                let cor = "🟢"; 
                if (dados.total === 0) cor = "⚪"; 
                else if (dados.preenchido === 0) cor = "🔴"; 
                else if (restante > 0) cor = "🟡"; 
                return `${equipe}: ${cor} ${dados.preenchido}/${dados.total}`;
            }).join(" | ");

            return { 
                ...evt, 
                resumoEquipes: resumoFormatado,
                vagas_restantes: (evt.total_vagas || 0) - (evt.total_staff || 0)
            };
        });

        return res.json(mappedRows);
    } catch (err) {
        console.error("Erro em /eventos-fechados:", err);
        res.status(500).json({ error: "Erro interno ao buscar eventos fechados." });
    }
});

router.get("/detalhes-eventos-abertos", async (req, res) => {
  try {
    const idevento = req.query.idevento || req.headers.idevento;
    const idempresa = req.query.idempresa || req.headers.idempresa;
    const ano = req.query.ano ? Number(req.query.ano) : new Date().getFullYear();

    if (!idevento || !idempresa) {
      return res.status(400).json({ error: "Parâmetros 'idevento' e 'idempresa' são obrigatórios." });
    }

    // 1️⃣ Busca orçamento principal
    const { rows: orcamentos } = await pool.query(
      `SELECT o.idorcamento, o.idcliente, o.idmontagem
       FROM orcamentos o
       JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
       WHERE o.idevento = $1 AND oe.idempresa = $2 
       AND EXTRACT(YEAR FROM o.dtinirealizacao) = $3
       LIMIT 1`,
      [idevento, idempresa, ano]
    );

    if (!orcamentos.length) return res.status(200).json({ equipes: [] });
    const { idorcamento, idcliente, idmontagem } = orcamentos[0];

    // 2️⃣ Busca Vagas do Orçamento (Usando o setor como local principal)
    const { rows: itensOrcamento } = await pool.query(
      `SELECT f.idequipe, eq.nmequipe AS equipe, i.idfuncao, f.descfuncao AS funcao,
              COALESCE(i.setor, '') AS setor_orcamento,
              SUM(i.qtditens) AS qtd_orcamento,
              MIN(i.periododiariasinicio) AS dtini_vaga,
              MAX(i.periododiariasfim) AS dtfim_vaga
       FROM orcamentoitens i
       JOIN funcao f ON f.idfuncao = i.idfuncao
       JOIN equipe eq ON eq.idequipe = f.idequipe
       WHERE i.idorcamento = $1 AND i.categoria = 'Produto(s)'
       GROUP BY f.idequipe, eq.nmequipe, i.idfuncao, f.descfuncao, i.setor`,
      [idorcamento]
    );

    // 3️⃣ Busca quantidades cadastradas (Lógica COALESCE para bater com o setor do orçamento)
    const { rows: staffCount } = await pool.query(
      `SELECT se.idfuncao, 
              COALESCE(NULLIF(se.pavilhao, ''), se.setor, '') AS localizacao,
              COUNT(DISTINCT se.idstaff) AS qtd_cadastrada
       FROM staffeventos se
       WHERE se.idevento = $1 
         AND se.idcliente = $2
         AND EXISTS (
             SELECT 1 FROM jsonb_array_elements_text(se.datasevento) AS d(dt)
             WHERE EXTRACT(YEAR FROM (d.dt)::date) = $3
         )
       GROUP BY se.idfuncao, localizacao`,
      [idevento, idcliente, ano]
    );

    // 4️⃣ Busca Datas (IMPORTANTE: A chave aqui deve ser idfuncao + localizacao)
    const { rows: datasStaffRaw } = await pool.query(
      `SELECT se.idfuncao, 
              COALESCE(NULLIF(se.pavilhao, ''), se.setor, '') AS localizacao,
              array_agg(DISTINCT d.dt ORDER BY d.dt) AS datas_staff
       FROM staffeventos se
       CROSS JOIN LATERAL (
           SELECT dt FROM jsonb_array_elements_text(se.datasevento) AS dt
           WHERE EXTRACT(YEAR FROM dt::date) = $2
       ) AS d
       WHERE se.idevento = $1 AND se.idcliente = $3
       GROUP BY se.idfuncao, localizacao`,
      [idevento, ano, idcliente]
    );

    // Criamos o mapa usando a string normalizada para evitar erros de case ou espaços
    const datasStaffMap = datasStaffRaw.reduce((acc, row) => {
      const key = `${row.idfuncao}_${String(row.localizacao).trim().toUpperCase()}`;
      acc[key] = row.datas_staff;
      return acc;
    }, {});

    // 5️⃣ Agrupamento por equipe e montagem do objeto final
    const equipesMap = {};
    for (const item of itensOrcamento) {
      const idequipeKey = item.idequipe || "SEM_EQUIPE";

      if (!equipesMap[idequipeKey]) {
        equipesMap[idequipeKey] = {
          equipe: item.equipe || "Sem equipe",
          idequipe: item.idequipe,
          funcoes: [],
        };
      }

      const setorNormalizado = String(item.setor_orcamento).trim().toUpperCase();

      // Busca a quantidade
      const cadastrado = staffCount.find(s => 
        String(s.idfuncao) === String(item.idfuncao) && 
        String(s.localizacao).trim().toUpperCase() === setorNormalizado
      ); 

      const qtd_cadastrada = cadastrado ? Number(cadastrado.qtd_cadastrada) : 0;
      
      // Busca as datas no mapa usando a mesma chave normalizada
      const chaveDatas = `${item.idfuncao}_${setorNormalizado}`;
      const datas_staff = datasStaffMap[chaveDatas] || [];

      equipesMap[idequipeKey].funcoes.push({
        idfuncao: item.idfuncao,
        nome: item.setor_orcamento ? `${item.funcao} (${item.setor_orcamento})` : item.funcao,
        setor_orcamento: item.setor_orcamento,
        qtd_orcamento: Number(item.qtd_orcamento) || 0,
        qtd_cadastrada,
        concluido: qtd_cadastrada >= (Number(item.qtd_orcamento) || 0),
        dtini_vaga: item.dtini_vaga,
        dtfim_vaga: item.dtfim_vaga,
        datas_staff: datas_staff // Agora as datas voltarão a aparecer
      });
    }

    res.status(200).json({ 
      equipes: Object.values(equipesMap), 
      idmontagem,
      idorcamento
    });

  } catch (err) {
    console.error("Erro ao processar detalhes dos eventos:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/ListarFuncionarios", async (req, res) => {
  const idempresa = req.query.idempresa || req.idempresa;
  const { idEvento, idEquipe, ano } = req.query;
  
  const anoFiltro = ano ? Number(ano) : new Date().getFullYear();

  if (!idEvento || !idEquipe || !idempresa) {
    return res.status(400).json({ erro: "Parâmetros idEvento, idEquipe e idempresa são obrigatórios." });
  }

  try {
    const query = `
    SELECT DISTINCT ON (se.idstaffevento)
    se.idstaffevento, 
    se.idfuncionario, 
    se.nmfuncionario AS nome, 
    se.nmfuncao AS funcao, 
    se.vlrtotal, 
    se.statuspgto AS status_pagamento,
    -- Aqui está a correção:
    COALESCE(NULLIF(se.setor, ''), NULLIF(se.pavilhao, ''), '') AS setor,
    se.nivelexperiencia
FROM public.staffeventos se
INNER JOIN orcamentoempresas oe ON oe.idorcamento = se.idorcamento
WHERE se.idevento = $1
  AND se.idequipe = $2
  AND oe.idempresa = $3
  AND EXISTS (
      SELECT 1 
      FROM jsonb_array_elements_text(se.datasevento) AS d(dt)
      WHERE EXTRACT(YEAR FROM (d.dt)::date) = $4
  )
ORDER BY se.idstaffevento, se.nmfuncao, se.nmfuncionario;`;

    const { rows } = await pool.query(query, [idEvento, idEquipe, idempresa, anoFiltro]);
    res.status(200).json(rows);
  } catch (erro) {
    console.error("Erro ListarFuncionarios:", erro);
    res.status(500).json({ erro: 'Erro interno ao listar funcionários.' });
  }
});
// =======================================

// =======================================
// ORCAMENTOS
// =======================================
router.get("/orcamentos", async (req, res) => {
    try {
        const idempresa = req.headers.idempresa || req.query.idempresa;
        const { status, periodo, dataRef, dataFim, valorFiltro, ano } = req.query;
        
        if (!idempresa) return res.status(400).json({ error: "idempresa não fornecido" });

        // --- CORREÇÃO DA LÓGICA DE CAPTURA DO ANO ---
        let anoParaBusca;
        
        if (ano) {
            // Se vier explicitamente no ?ano=
            anoParaBusca = parseInt(ano);
        } else if (periodo === 'anual' && valorFiltro) {
            // Se vier como ?periodo=anual&valorFiltro=2025 (como no seu log)
            anoParaBusca = parseInt(valorFiltro);
        } else {
            // Fallback para o ano atual do sistema
            anoParaBusca = new Date().getFullYear();
        }

        // LOG DE VERIFICAÇÃO ATUALIZADO
        console.log(`>>> LOG CORRIGIDO - Empresa: ${idempresa} | Periodo: ${periodo} | ValorFiltro: ${valorFiltro} | Ano Final: ${anoParaBusca}`);

        const mapaStatus = {
            'aberto': 'A', 'proposta': 'P', 'em andamento': 'E', 'fechado': 'F', 'recusado': 'R'
        };

        let sql = `
            SELECT o.*, e.nmevento as nome_evento,
            GREATEST(COALESCE(o.dtfimdesmontagem, '1900-01-01'), COALESCE(o.dtfiminfradesmontagem, '1900-01-01')) as data_final_ciclo
            FROM orcamentos o
            JOIN eventos e ON o.idevento = e.idevento
            JOIN orcamentoempresas oe ON o.idorcamento = oe.idorcamento
            WHERE oe.idempresa = $1 
        `;
        
        const params = [idempresa];

        // Filtro de Período
        if (periodo === 'semanal' && dataRef && dataFim) {
            params.push(dataRef, dataFim);
            sql += ` AND o.dtinimarcacao::date BETWEEN $${params.length - 1} AND $${params.length}`;
        } else {
            // Aplica o ano capturado dinamicamente
            params.push(anoParaBusca);
            sql += ` AND EXTRACT(YEAR FROM o.dtinimarcacao) = $${params.length}`;

            if (periodo === 'diario' && dataRef) {
                params.push(dataRef);
                sql += ` AND o.dtinimarcacao::date = $${params.length}`;
            } else if (periodo === 'mensal' && valorFiltro) {
                params.push(parseInt(valorFiltro));
                sql += ` AND EXTRACT(MONTH FROM o.dtinimarcacao) = $${params.length}`;
            } else if (periodo === 'trimestral' && valorFiltro) {
                params.push(parseInt(valorFiltro));
                sql += ` AND EXTRACT(QUARTER FROM o.dtinimarcacao) = $${params.length}`;
            } else if (periodo === 'semestral' && valorFiltro) {
                if (parseInt(valorFiltro) === 1) {
                    sql += ` AND EXTRACT(MONTH FROM o.dtinimarcacao) BETWEEN 1 AND 6`;
                } else {
                    sql += ` AND EXTRACT(MONTH FROM o.dtinimarcacao) BETWEEN 7 AND 12`;
                }
            }
        }

        // Filtro de Status
        if (status && status !== 'todos' && mapaStatus[status.toLowerCase()]) {
            params.push(mapaStatus[status.toLowerCase()]);
            sql += ` AND o.status = $${params.length}`;
        }

        sql += ` ORDER BY 
            CASE o.status
                WHEN 'F' THEN 1
                WHEN 'E' THEN 2
                WHEN 'P' THEN 3
                WHEN 'A' THEN 4
                WHEN 'R' THEN 5
                ELSE 6
            END ASC, 
            o.dtinimarcacao ASC`;

        const { rows } = await pool.query(sql, params);
        res.json(rows);

    } catch (err) {
        console.error("❌ ERRO SQL:", err.message);
        res.status(500).json({ error: "Erro interno no servidor." });
    }
});

router.get("/orcamentos/resumo", async (req, res) => {
  try {
    const idempresa = req.headers.idempresa || req.query.idempresa;
    
    if (!idempresa) {
      return res.status(400).json({ error: "idempresa não fornecido" });
    }

    console.log("ROTA MAIN - idempresa recebido:", idempresa);

    // Query única para performance máxima e filtro de ano atual
    const sql = `
      SELECT 
        COUNT(*)::int AS orcamentos,
        COUNT(*) FILTER (WHERE o.status = 'A')::int AS "orcamentosAbertos",
        COUNT(*) FILTER (WHERE o.status = 'P')::int AS "orcamentosProposta",
        COUNT(*) FILTER (WHERE o.status = 'E')::int AS "orcamentosEmAndamento",
        COUNT(*) FILTER (WHERE o.status = 'F')::int AS "orcamentosFechados",
        COUNT(*) FILTER (WHERE o.status = 'R')::int AS "orcamentosRecusados"
      FROM orcamentos o
      JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
      WHERE oe.idempresa = $1 
      AND EXTRACT(YEAR FROM o.dtinimarcacao) = EXTRACT(YEAR FROM CURRENT_DATE)
    `;

    const { rows } = await pool.query(sql, [idempresa]);

    // O objeto retornado já terá o formato esperado pelo seu frontend
    res.json(rows[0]);

  } catch (err) {
    console.error("❌ Erro na rota principal:", err.message);
    res.status(500).json({ error: "Erro interno no servidor." });
  }
});

// =======================================

// =======================================
// LOGS DE ATIVIDADES
// =======================================
router.get("/atividades-recentes", async (req, res) => {
  try {
  const idexecutor = req.headers.idexecutor || req.query.idexecutor;
  if (!idexecutor) {
  return res.status(400).json({ error: "Executor não informado" });
  }

  const { rows } = await pool.query(
  `SELECT acao, modulo, idregistroalterado, dadosanteriores, dadosnovos, criado_em
  FROM logs
  WHERE idexecutor = $1
  ORDER BY criado_em DESC`,
  [idexecutor]
  );

  res.json(rows);
  } catch (err) {
  console.error("Erro ao buscar atividades recentes:", err);
  res.status(500).json({ error: "Erro ao buscar atividades" });
  }
});
// =======================================


// =======================================
// NOTIFICAÇÕES FINANCEIRAS
// =======================================
router.get('/notificacoes-financeiras', async (req, res) => {
    try {
        // ... (Seções 1 a 4: Permissões, Filtro, tudo igual)
        const idempresa = req.idempresa || req.headers.idempresa;
        const idusuario = req.usuario?.idusuario || req.headers.idusuario;

        if (!idempresa) return res.status(400).json({ error: 'Empresa não informada' });
        if (!idusuario) return res.status(400).json({ error: 'Usuário não informado' });

        // 1. Busca todas as permissões de uma vez
        const { rows: allPermissoes } = await pool.query(`
            SELECT modulo, master FROM permissoes 
            WHERE idusuario = $1
        `, [idusuario]);

        // 2. Define o acesso de Master
        const ehMasterStaff = allPermissoes.some(p => p.modulo === 'Staff' && p.master === 'true');

        // 3. Define a permissão de Visualização Total
        const temPermissaoVisualizacaoTotal = allPermissoes.some(p => 
            p.modulo === 'Staff' || p.modulo.toLowerCase().includes('financeiro')
        );
        
        const podeVerTodos = ehMasterStaff || temPermissaoVisualizacaoTotal; 

        // 4. Lógica de Filtro Condicional
        let filtroSolicitante = '';
        const params = [idempresa]; 

        if (!podeVerTodos) {
            filtroSolicitante = `AND oe.idexecutor = $2`;
            params.push(idusuario); 
        }

        // DEBUG
        console.log(`[FINAL QUERY STATE] Financeiro | PodeVerTodos: ${podeVerTodos} | Filtro: "${filtroSolicitante}" | Params: ${params.join(', ')}`);


        // 5. Consulta SQL Otimizada
        // 🚨 IMPORTANTE: SEUS DADOS DE MEIA/DIÁRIA ESTÃO EM se.dtmeiadiaria E se.dtdiariadobrada.
        // A QUERY ESTÁ CORRETA NESTE PONTO.
        const query = `
        WITH OriginalExecutor AS (
            SELECT DISTINCT ON (idregistroalterado)
            idregistroalterado AS idstaffevento, idexecutor, criado_em
            FROM logs
            WHERE modulo = 'staffeventos' AND idempresa = $1 
            ORDER BY idregistroalterado, criado_em ASC
        )
        SELECT DISTINCT ON (se.idstaffevento) 
            se.idstaffevento AS id, oe.idexecutor, (u.nome || ' ' || u.sobrenome) AS nomesolicitante,
            f.nome AS nomefuncionario, e.nmevento AS evento,
            se.vlrcaixinha::text, se.desccaixinha, se.statuscaixinha, se.vlrajustecusto::text, 
            se.descajustecusto, se.statusajustecusto, se.dtdiariadobrada::text, 
            se.descdiariadobrada, se.statusdiariadobrada, se.dtmeiadiaria::text, 
            se.descmeiadiaria, se.statusmeiadiaria, se.datasevento::text, oe.criado_em, 
            se.idfuncionario AS idusuarioalvo, COALESCE(o.dtfiminfradesmontagem, o.dtfimdesmontagem) AS dtfimrealizacao
        FROM staffeventos se
        INNER JOIN staffempresas semp ON se.idstaff = semp.idstaff
        LEFT JOIN OriginalExecutor oe ON oe.idstaffevento = se.idstaffevento 
        LEFT JOIN funcionarios f ON f.idfuncionario = se.idfuncionario
        LEFT JOIN usuarios u ON u.idusuario = oe.idexecutor 
        LEFT JOIN eventos e ON e.idevento = se.idevento
        LEFT JOIN orcamentos o ON o.idevento = e.idevento
        WHERE 
        (
            (se.statuscaixinha IS NOT NULL AND se.statuscaixinha <> '') OR
            (se.statusajustecusto IS NOT NULL AND se.statusajustecusto <> '') OR
            (se.statusdiariadobrada IS NOT NULL AND se.statusdiariadobrada <> '') OR 
            (se.statusmeiadiaria IS NOT NULL AND se.statusmeiadiaria <> '')
        )
        AND 
        ( 
            (COALESCE(se.vlrcaixinha, '0')::numeric > 0) OR 
            (COALESCE(se.vlrajustecusto, '0')::numeric != 0) OR 
            (se.dtdiariadobrada IS NOT NULL AND se.dtdiariadobrada <> '[]'::jsonb) OR 
            (se.dtmeiadiaria IS NOT NULL AND se.dtmeiadiaria <> '[]'::jsonb)
        ) AND semp.idempresa = $1
        ${filtroSolicitante} 
        ORDER BY se.idstaffevento, oe.criado_em DESC;
        `;

        const { rows } = await pool.query(query, params); 
        console.log(`[FINANCEIRO DEBUG] Linhas retornadas do DB: ${rows.length}`);
        // console.log("Dados retornados", rows);

        // 6. Mapeamento e Resposta
        const parseValor = (v) => {
            if (!v) return 0;
            if (typeof v === 'number') return v;
            return parseFloat(String(v).replace(',', '.')) || 0;
        };
        
        // Novo Helper para verificar se um JSONB é vazio '[]'
        const isJsonbArrayEmpty = (jsonbString) => {
            if (!jsonbString) return true;
            // Tenta dar parse e verifica se é um array vazio. 
            // Se falhar, retorna true (para tratar como vazio e não processar).
            try {
                const parsed = JSON.parse(jsonbString);
                return Array.isArray(parsed) && parsed.length === 0;
            } catch (e) {
                return true;
            }
        };

        const pedidosConsolidados = rows.map(r => {

            // Helper para gerar a string JSON de Caixinha/Ajuste (Array de 1 Item)
            const stringifyUnico = (statusField, valorRaw, descricaoRaw) => {

                const valor = parseValor(valorRaw);
                const status = statusField || '';
                const descricao = descricaoRaw && descricaoRaw !== '-' ? descricaoRaw : null;

                // Inclui se o status ou valor não for zero/vazio
                if (status.trim() !== '' || valor !== 0) {
                    return JSON.stringify([{ 
            status: status, 
            valor: valor, 
            descricao: descricao 
                    }]);
                }
                return null;
            };

            // ** CORREÇÃO APLICADA AQUI **
            const diariaDobrada = isJsonbArrayEmpty(r.dtdiariadobrada) ? null : r.dtdiariadobrada;
            const meiaDiaria = isJsonbArrayEmpty(r.dtmeiadiaria) ? null : r.dtmeiadiaria;

            // Mapeamento que garante a estrutura de objeto principal com os campos aninhados:
            return {
                idpedido: r.id, 
                solicitante: r.idexecutor || null,
                nomeSolicitante: r.nomesolicitante || '-',
                funcionario: r.nomefuncionario || '-',
                evento: r.evento,
                dtCriacao: r.criado_em,

                // CAMPOS DE STATUS ANINHADOS: 
                // Diárias (Agora só incluídas se não forem '[]')
                statusmeiadiaria: meiaDiaria, 
                statusdiariadobrada: diariaDobrada,

                // Caixinha / Ajuste (Transformado em JSON de 1 item)
                statuscaixinha: stringifyUnico(r.statuscaixinha, r.vlrcaixinha, r.desccaixinha),
                statusajustecusto: stringifyUnico(r.statusajustecusto, r.vlrajustecusto, r.descajustecusto),

                ehMasterStaff: ehMasterStaff, 
                podeVerTodos: podeVerTodos,

                datasevento: r.datasevento || '-',
                dtfimrealizacao: r.dtfimrealizacao || null,
            };
        });


        console.log(`[FINANCEIRO DEBUG] Total de Pedidos Consolidados: ${pedidosConsolidados.length}`);

        // O front-end (buscarPedidosUsuario) receberá este array de objetos CONSOLIDADOS
        res.json(pedidosConsolidados);

    } catch (err) {
        console.error('Erro ao buscar notificações financeiras:', err.stack || err);
        res.status(500).json({ error: 'Erro ao buscar notificações financeiras' });
    }
});

router.patch('/notificacoes-financeiras/atualizar-status',
    autenticarToken(),
    contextoEmpresa,
    verificarPermissao('staff', 'cadastrar'),     
    // Log Middleware (Mantido, já está funcionando)
    logMiddleware('staffeventos', {
        buscarDadosAnteriores: async (req) => {
            console.log("⚠️ACESSOU A ROTA PATCH PEDIDOS (LOG BUSCA)");
            const id = req.body.idpedido;
            if (!id || isNaN(parseInt(id))) return null;
            const query = `
                SELECT 
                    idstaffevento, 
                    statuscaixinha, 
                    statusajustecusto, 
                    dtdiariadobrada, 
                    dtmeiadiaria
                FROM staffeventos 
                WHERE idstaffevento = $1`;
            const result = await pool.query(query, [id]);
            console.log('✅ SALVOU O LOG PEDIDOS', result );
            return result.rows[0] 
                ? { dadosanteriores: result.rows[0], idregistroalterado: id } 
                : null;
        }
    }),
    async (req, res) => {
        const { idpedido, categoria, acao, data } = req.body;
        const idempresa = req.idempresa; 
        const idUsuarioAprovador = req.usuario?.idusuario;

        console.log(`DEBUG REQ.BODY RECEBIDO: ID: ${idpedido}, Categoria: ${categoria}, Acao: ${acao}, Data: ${data}`);

        // 1. Validação
        if (!idpedido || !categoria || !acao || !idempresa) {
            return res.status(400).json({ sucesso: false, erro: "Dados de requisição incompletos." });
        }
        
        const acaoCapitalizada = acao.charAt(0).toUpperCase() + acao.slice(1);
        const statusPermitidos = ['Autorizado', 'Rejeitado'];
        if (!statusPermitidos.includes(acaoCapitalizada)) {
            return res.status(400).json({ sucesso: false, erro: "Ação inválida. Use 'Autorizado' ou 'Rejeitado'." });
        }

        // 2. Mapeamento
        const mapCategoriaToColuna = {
            'statuscaixinha': 'statuscaixinha',
            'statusajustecusto': 'statusajustecusto',
            'statusdiariadobrada': 'dtdiariadobrada', 
            'statusmeiadiaria': 'dtmeiadiaria',      
        };
        const colunaDB = mapCategoriaToColuna[categoria];

        if (!colunaDB) {
            return res.status(400).json({ sucesso: false, erro: "Categoria de atualização inválida." });
        }

        try {
            const idStaffEvento = idpedido;

            // 🛑 CRITÉRIO DE FILTRO DE EMPRESA CORRIGIDO: 
            // Usa se.idstaff para join com sem.idstaff, garantindo o filtro por empresa.
            const empresaConstraint = ` AND EXISTS (SELECT 1 FROM staffempresas sem WHERE sem.idstaff = se.idstaff AND sem.idempresa = $3) `.trim();

            // =========================================================
            // LÓGICA 1: Caixinha / Ajuste de Custo (Status Simples - STRING)
            // =========================================================
            if (categoria === 'statuscaixinha' || categoria === 'statusajustecusto') {

                const query = `
                    UPDATE staffeventos se
                    SET ${colunaDB} = $1 
                    WHERE se.idstaffevento = $2        
                    ${empresaConstraint} 
                    AND se.${colunaDB} = 'Pendente'    
                    RETURNING se.*;
                `;
                // $1 = status, $2 = idstaffevento, $3 = idempresa
                const values = [acaoCapitalizada, idStaffEvento, idempresa]; 

                const resultado = await pool.query(query, values);

                if (resultado.rows.length === 0) {
                    return res.status(400).json({ sucesso: false, erro: "A solicitação não pode ser alterada. Status atual não é Pendente, ID não encontrado ou não pertence à empresa." });
                }

                return res.json({
                    sucesso: true,
                    mensagem: `Status da ${categoria} atualizado para ${acaoCapitalizada} com sucesso.`,
                    atualizado: resultado.rows[0] 
                });

            } 

            // =========================================================
            // LÓGICA 2: Diárias (Meia/Dobra) (Status Interno - JSONB/TEXT)
            // =========================================================
            else if (categoria === 'statusdiariadobrada' || categoria === 'statusmeiadiaria') {
                console.log("É DIARIADOBRADA OU MEIADIARIA", categoria);
                if (!data) {
                    return res.status(400).json({ sucesso: false, erro: "A data da diária é obrigatória para esta atualização." });
                }
           

                // A. Busca o valor atual e faz o parse
                const checkQuery = `
                    SELECT se.${colunaDB} 
                    FROM staffeventos se 
                    JOIN staffempresas sem ON se.idstaff = sem.idstaff 
                    WHERE se.idstaffevento = $1 AND sem.idempresa = $2;
                `;
                const checkResult = await pool.query(checkQuery, [idStaffEvento, idempresa]);



                if (checkResult.rows.length === 0) {
                    return res.status(404).json({ sucesso: false, erro: "Pedido não encontrado ou não pertence à empresa." });
                }

                let arrayDiarias = checkResult.rows[0][colunaDB] || [];

                // 💡 DEIXE O NOVO DEBUG AQUI:
                console.log('ARRAYDIARIAS (APÓS CORREÇÃO DE PARSE):', arrayDiarias);
                if (!Array.isArray(arrayDiarias)) {
                    console.error('ERRO: dtdiariadobrada não é um array após consulta ao DB:', arrayDiarias);
                    arrayDiarias = [];
                }

                console.log("ARRAYDIARIAS", arrayDiarias);

                let itemAtualizado = false;

                // B. Atualiza o status do item específico no array
                const novoArrayDiarias = arrayDiarias.map(item => {
                    console.log(`>>> Item BD: Data='${(item.data || '').trim()}', Status='${(item.status || '').toLowerCase()}' | Comparando com: Data='${(data || '').trim()}', Status='pendente'`);
                    // 🚨 CORREÇÃO DE ROBUSTEZ: Compara strings de data e status em minúsculas, ignorando whitespace.
                    if (
                        (item.data || '').trim() === (data || '').trim() && 
                        (item.status || '').toLowerCase() === 'pendente'
                    ) { 
                        itemAtualizado = true;
                        return { ...item, status: acaoCapitalizada }; 
                    }
                    return item;
                });

                if (!itemAtualizado) {
                    return res.status(400).json({ sucesso: false, erro: `Diária na data ${data} não encontrada ou não está Pendente.` });
                }

                // C. Reescreve o JSON completo no banco
                const updateQuery = `UPDATE staffeventos se SET ${colunaDB} = $1 WHERE se.idstaffevento = $2 ${empresaConstraint} RETURNING se.*`;
                console.log('QUERY SQL FINAL EXECUTADA:', updateQuery);
               


                // $1 = novo JSON (string), $2 = idstaffevento, $3 = idempresa
                const updateValues = [JSON.stringify(novoArrayDiarias), idStaffEvento, idempresa];

                const resultado = await pool.query(updateQuery, updateValues);

                if (resultado.rows.length === 0) {
                    return res.status(400).json({ sucesso: false, erro: "A solicitação não pode ser alterada. ID não encontrado ou não pertence à empresa." });
                }

                // D. Resposta de Sucesso
                return res.json({
                    sucesso: true,
                    mensagem: `Status da diária em ${data} atualizado para ${acaoCapitalizada} com sucesso.`,
                    atualizado: resultado.rows[0] 
                });
            }

            return res.status(400).json({ sucesso: false, erro: "Categoria de atualização não suportada." });

        } catch (error) {
            console.error("Erro ao atualizar status do Pedido Financeiro (DENTRO DO CATCH):", error.message || error);
            res.status(500).json({
                sucesso: false,
                erro: "Erro interno do servidor ao processar a atualização do Pedido Financeiro."
            });
        }
    }
);

router.post('/notificacoes-financeiras/atualizar-status', 
  logMiddleware('main', {
  buscarDadosAnteriores: async (req) => {
  const { idpedido } = req.body;
  if (!idpedido) return { dadosanteriores: null, idregistroalterado: null };

  const { rows } = await pool.query(`
  SELECT statuscaixinha, statusajustecusto, statusdiariadobrada, statusmeiadiaria
  FROM staffeventos
  WHERE idstaffevento = $1
  `, [idpedido]);

  if (!rows.length) return { dadosanteriores: null, idregistroalterado: null };

  return {
  dadosanteriores: rows[0],
  idregistroalterado: idpedido
  };
  }
  }),
  async (req, res) => {
  try {
  const idusuario = req.usuario?.idusuario || req.headers.idusuario;
  const { idpedido, categoria, acao } = req.body; // acao = 'Aprovado' ou 'Rejeitado'

  if (!idusuario) return res.status(400).json({ error: 'Usuário não informado' });
  if (!idpedido || !categoria || !acao) return res.status(400).json({ error: 'Dados incompletos' });

  // 🔹 Verifica se o usuário é Master
  const { rows: permissoes } = await pool.query(`
  SELECT * FROM permissoes 
  WHERE idusuario = $1 AND modulo = 'Staff' AND master = 'true'
  `, [idusuario]);

  if (permissoes.length === 0) return res.status(403).json({ error: 'Permissão negada' });

  // 🔹 Mapeia categorias para colunas da tabela staffeventos
  const mapCategorias = {
  statuscaixinha: "statuscaixinha",
  statusajustecusto: "statusajustecusto",
  statusdiariadobrada: "statusdiariadobrada",
  statusmeiadiaria: "statusmeiadiaria"
  };

  const coluna = mapCategorias[categoria];
  if (!coluna) return res.status(400).json({ error: "Categoria inválida" });

  // 🔹 Atualiza apenas como string (mantendo compatibilidade com o que já existe)
  const statusParaAtualizar = acao.charAt(0).toUpperCase() + acao.slice(1).toLowerCase(); 
  // exemplo: 'Aprovado' ou 'Rejeitado'

  // 🔹 Atualiza na tabela staffeventos
  let { rows: updatedRows } = await pool.query(`
  UPDATE staffeventos
  SET ${coluna} = $2
  WHERE idstaffevento = $1
  RETURNING idstaffevento, statuscaixinha, statusajustecusto, statusdiariadobrada, statusmeiadiaria;
  `, [idpedido, statusParaAtualizar]);

  // 🔹 Se não encontrou no staffeventos, tenta atualizar na tabela staff
  if (updatedRows.length === 0) {
  const { rows: updatedStaff } = await pool.query(`
  UPDATE staff
  SET ${coluna} = $2
  WHERE idstaffevento = $1
  RETURNING idstaff, idstaffevento, statuscaixinha, statusajustecusto, statusdiariadobrada, statusmeiadiaria;
  `, [idpedido, statusParaAtualizar]);

  updatedRows = updatedStaff;
  }

  if (!updatedRows.length) return res.status(404).json({ error: 'Registro não encontrado em nenhuma tabela' });

  res.json({ sucesso: true, atualizado: updatedRows[0] });

  } catch (err) {
  console.error('Erro ao atualizar status do pedido:', err.stack || err);
  res.status(500).json({ error: 'Erro ao atualizar status do pedido', detalhe: err.message });
  }
  }
);

// router.patch('/aditivoextra/:idAditivoExtra/status',
//     autenticarToken(),
//     contextoEmpresa,
//     verificarPermissao('staff', 'cadastrar'),
//     logMiddleware('aditivoextra', {
//         buscarDadosAnteriores: async (req) => {
//           const id = req.params.idAditivoExtra;
//           if (!id || isNaN(parseInt(id))) return null;

//           const query = `SELECT idaditivoextra, status, tiposolicitacao FROM AditivoExtra WHERE idAditivoExtra = $1`;
//           const result = await pool.query(query, [id]);
//           return result.rows[0] ? { dadosanteriores: result.rows[0], idregistroalterado: id } : null;
//         }
//     }),
//     async (req, res) => {
//         const idAditivoExtra = req.params.idAditivoExtra;
        
//         // 🛑 NOVO: Extrai a justificativa
//         const { novoStatus } = req.body; 
//         const idUsuarioAprovador = req.usuario?.idusuario;

        

//         console.log(`🔥 Rota /aditivoextra/${idAditivoExtra}/status acessada: Novo Status: ${novoStatus}`, idUsuarioAprovador);

//         // 1. Validação
//         if (!novoStatus || !idUsuarioAprovador) {
//           return res.status(400).json({
//             sucesso: false,
//             erro: "Novo status e/ou ID do usuário aprovador não fornecidos."
//           });
//         }

//         const statusPermitidos = ['Autorizado', 'Rejeitado'];
//         if (!statusPermitidos.includes(novoStatus)) {
//           return res.status(400).json({
//             sucesso: false,
//             erro: "Status inválido. Use 'Autorizado' ou 'Rejeitado'."
//           });
//         }
        
//         // 🛑 NOVO: Validação de Justificativa para Rejeição
//         if (novoStatus === 'Rejeitado' && (!justificativa || justificativa.trim() === '')) {
//            return res.status(400).json({
//             sucesso: false,
//             erro: "A justificativa é obrigatória ao rejeitar a solicitação."
//           });
//         }


//         try {
//           // 2. Verifica o status atual da solicitação (Mantido)
//           const checkQuery = `SELECT status, tiposolicitacao FROM AditivoExtra WHERE idaditivoextra = $1 AND idempresa = $2`;
//           const checkResult = await pool.query(checkQuery, [idAditivoExtra, req.idempresa]);

//           if (checkResult.rows.length === 0) {
//             return res.status(404).json({ sucesso: false, erro: "Solicitação de Aditivo/Extra não encontrada para esta empresa." });
//           }
//           const currentStatus = checkResult.rows[0].status;

//           if (currentStatus !== 'Pendente') {
//             return res.status(400).json({
//               sucesso: false,
//               erro: `A solicitação não pode ser alterada. Status atual: ${currentStatus}.`
//             });
//           }

//           // 3. Comando SQL de Atualização
//           let query = `
//             UPDATE AditivoExtra
//             SET status = $1, 
//             dtresposta = NOW(), 
//             idusuarioresponsavel = $2,
//             justificativa = $3  /* 🛑 NOVO: Campo de justificativa incluído */
//             WHERE idaditivoextra = $4 AND idempresa = $5
//             RETURNING *;
//           `;
//           let values;

//           if (novoStatus === 'Autorizado') {
//             // Para Autorizado, a justificativa é nula (ou vazia)
//             values = [novoStatus, idUsuarioAprovador, null, idAditivoExtra, req.idempresa];
//           } else if (novoStatus === 'Rejeitado') {
//             // Para Rejeitado, usamos a justificativa fornecida
//             values = [novoStatus, idUsuarioAprovador, justificativa, idAditivoExtra, req.idempresa]; 
//           } else {
//             throw new Error("Erro de lógica: Status de atualização inválido.");
//           }

//           const resultado = await pool.query(query, values);

//           if (resultado.rows.length === 0) {
//             throw new Error("A atualização falhou. Nenhuma linha afetada.");
//           }

//           // 4. Resposta de Sucesso
//           res.json({
//             sucesso: true,
//             mensagem: `Status da solicitação ${idAditivoExtra} atualizado para ${novoStatus} com sucesso.`,
//             dados: resultado.rows[0]
//           });

//         } catch (error) {
//           console.error("Erro ao atualizar status AditivoExtra:", error.message || error);
//           res.status(500).json({
//             sucesso: false,
//             erro: "Erro interno do servidor ao processar a atualização do status."
//           });
//         }
//     }
// );

const formatarData = (data) => {
    if (!data) return 'N/A';
    const d = new Date(data);
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const ano = d.getFullYear();
    return `${dia}/${mes}/${ano}`;
};

/**
 * Calcula o intervalo de datas (dataInicial e dataFinal) com base nos parâmetros de filtro.
 * @param {string} periodo - Tipo de filtro (diario, semanal, mensal, trimestral, semestral, anual).
 * @param {object} params - Objeto de query string do Express (req.query).
 * @returns {object} { dataInicial: string, dataFinal: string } no formato 'YYYY-MM-DD'.
 */
function calcularIntervaloDeDatas(periodo, params) {
    let dataInicial, dataFinal;

    const ano = parseInt(params.ano) || new Date().getFullYear();
    const mes = parseInt(params.mes); // 1-12
    const trimestre = parseInt(params.trimestre); // 1-4
    const semestre = parseInt(params.semestre); // 1 ou 2

    // Função auxiliar para formatar Date para 'YYYY-MM-DD'
    const formatarData = (data) => data.toISOString().split('T')[0];

    // Lógica para cada período
    switch (periodo) {
        case 'diario':
            // dataInicio = dataFim
            dataInicial = params.dataInicio;
            dataFinal = params.dataFim;
            break;

        case 'semanal':
            // Usa dataInicio enviada (qualquer dia da semana) para calcular a semana.
            const dataBaseSemana = new Date(params.dataInicio + 'T00:00:00');
            const diaDaSemana = dataBaseSemana.getDay(); // 0 = Domingo, 6 = Sábado

            // Calcula o Domingo (início da semana)
            dataInicial = new Date(dataBaseSemana);
            dataInicial.setDate(dataBaseSemana.getDate() - diaDaSemana);

            // Calcula o Sábado (fim da semana, 6 dias depois do Domingo)
            dataFinal = new Date(dataInicial);
            dataFinal.setDate(dataInicial.getDate() + 6);

            dataInicial = formatarData(dataInicial);
            dataFinal = formatarData(dataFinal);
            break;

        case 'mensal':
            // Início do Mês (Mês é base 1-12 no frontend, mas Date é base 0-11)
            dataInicial = new Date(ano, mes - 1, 1);
            // Fim do Mês (Dia 0 do próximo mês)
            dataFinal = new Date(ano, mes, 0); 

            dataInicial = formatarData(dataInicial);
            dataFinal = formatarData(dataFinal);
            break;

        case 'trimestral':
            // Meses de início: Trimestre 1 = Jan (0), 2 = Abr (3), 3 = Jul (6), 4 = Out (9)
            const inicioMesTrimestre = (trimestre - 1) * 3;
            const fimMesTrimestre = inicioMesTrimestre + 3;

            dataInicial = new Date(ano, inicioMesTrimestre, 1);
            // Fim do Mês do Trimestre (Dia 0 do mês seguinte ao trimestre)
            dataFinal = new Date(ano, fimMesTrimestre, 0); 

            dataInicial = formatarData(dataInicial);
            dataFinal = formatarData(dataFinal);
            break;

        case 'semestral':
            // Meses de início: Semestre 1 = Jan (0), Semestre 2 = Jul (6)
            const inicioMesSemestre = (semestre === 1) ? 0 : 6;
            const fimMesSemestre = inicioMesSemestre + 6;

            dataInicial = new Date(ano, inicioMesSemestre, 1);
            // Fim do Mês do Semestre
            dataFinal = new Date(ano, fimMesSemestre, 0); 

            dataInicial = formatarData(dataInicial);
            dataFinal = formatarData(dataFinal);
            break;

        case 'anual':
            // Início e Fim do Ano
            dataInicial = formatarData(new Date(ano, 0, 1)); // Jan 1
            dataFinal = formatarData(new Date(ano, 11, 31)); // Dec 31
            break;

        default:
            // Padrão: usa o dia atual como diário
            const hoje = formatarData(new Date());
            dataInicial = hoje;
            dataFinal = hoje;
            break;
    }

    return { dataInicial, dataFinal };
}
// =======================================

// =======================================
// VENCIMENTOS
// =======================================
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = './uploads/comprovantes/';
        // Cria a pasta caso ela não exista
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        // Gera um nome único: idStaff-timestamp-nomeoriginal
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// Inicializa o middleware upload (Isso resolve o ReferenceError)
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Limite de 5MB
    fileFilter: (req, file, cb) => {
        const extensões = /jpeg|jpg|png|pdf/;
        const mimetype = extensões.test(file.mimetype);
        const extname = extensões.test(path.extname(file.originalname).toLowerCase());

        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error("Apenas imagens (JPG/PNG) e PDFs são permitidos."));
    }
});

router.get("/vencimentos", async (req, res) => {
  try {
    const idempresa = req.idempresa;
    if (!idempresa) return res.status(400).json({ error: "idempresa obrigatório." });

    const periodo = (req.query.periodo || 'anual').toLowerCase();
    const anoFiltro = parseInt(req.query.ano, 10) || 2026;

    const fmt = d => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    let startDate, endDate;
    if (periodo === 'diario') {
      const d = req.query.dataInicio ? new Date(req.query.dataInicio + 'T00:00:00') : new Date();
      startDate = fmt(d); endDate = fmt(d);
    } else if (periodo === 'mensal') {
      const m = parseInt(req.query.mes, 10) || (new Date().getMonth() + 1);
      const y = parseInt(req.query.ano, 10) || 2026;
      startDate = fmt(new Date(y, m - 1, 1));
      endDate = fmt(new Date(y, m, 0));
    } else {
      startDate = `${anoFiltro}-01-01`;
      endDate = `${anoFiltro}-12-31`;
    }

    // 1. QUERY DE AGREGAÇÃO (RESUMO)
    const queryAgregacao = `
      SELECT o.idevento, e.nmevento,
        COALESCE(SUM((COALESCE(tse.vlralmoco,0) + COALESCE(tse.vlralimentacao,0) + COALESCE(tse.vlrtransporte,0)) * calc.qtd), 0) AS ajuda_total,
        COALESCE(SUM(COALESCE(tse.vlrcache,0) * calc.qtd), 0) AS cache_total,
        COALESCE(SUM(COALESCE(tse.vlrcaixinha,0) * calc.qtd), 0) AS caixinha_total
      FROM orcamentos o
      JOIN orcamentoempresas oe ON o.idorcamento = oe.idorcamento
      JOIN eventos e ON o.idevento = e.idevento
      JOIN staffeventos tse ON e.idevento = tse.idevento
      CROSS JOIN LATERAL (
        SELECT COUNT(*)::int as qtd FROM jsonb_array_elements_text(tse.datasevento) AS d(dt)
        WHERE (d.dt)::date BETWEEN $2 AND $3
      ) AS calc
      WHERE oe.idempresa = $1 AND calc.qtd > 0
      GROUP BY o.idevento, e.nmevento;
    `;

    const { rows: eventosRaw } = await pool.query(queryAgregacao, [idempresa, startDate, endDate]);
    if (eventosRaw.length === 0) return res.json({ eventos: [] });

    // 2. QUERY DE DETALHES (LISTA COM DATAS)
    const queryDetalhes = `
      SELECT tse.idstaffevento, tse.idevento, tse.nmfuncionario AS nome, tse.nmfuncao AS funcao,
    calc.qtd AS qtddiarias_filtradas, calc.min_dt AS periodo_eventoini, calc.max_dt AS periodo_eventofim,
    calc_full.full_min_dt AS periodo_eventoini_all, calc_full.full_max_dt AS periodo_eventofim_all,
    (COALESCE(tse.vlrcache, 0) * calc.qtd) AS totalcache_filtrado,
    ((COALESCE(tse.vlralmoco, 0) + COALESCE(tse.vlralimentacao, 0) + COALESCE(tse.vlrtransporte, 0)) * calc.qtd) AS totalajudacusto_filtrado,
    (COALESCE(tse.vlrcaixinha, 0) * calc.qtd) AS totalcaixinha_filtrado,
    tse.statuspgto, tse.statuspgtoajdcto, tse.statuscaixinha,
    tse.comppgtocache, 
    tse.comppgtocaixinha, 
    tse.comppgtoajdcusto50, 
    tse.comppgtoajdcusto
  FROM staffeventos tse
  CROSS JOIN LATERAL (
    SELECT COUNT(*)::int as qtd, MIN((d.dt)::date) AS min_dt, MAX((d.dt)::date) AS max_dt
    FROM jsonb_array_elements_text(tse.datasevento) AS d(dt)
    WHERE (d.dt)::date BETWEEN $2 AND $3
  ) AS calc
  CROSS JOIN LATERAL (
    SELECT MIN((d2.dt)::date) AS full_min_dt, MAX((d2.dt)::date) AS full_max_dt
    FROM jsonb_array_elements_text(tse.datasevento) AS d2(dt)
  ) AS calc_full
  WHERE tse.idevento = ANY($1) AND calc.qtd > 0
  ORDER BY tse.nmfuncionario ASC;
    `;

    const { rows: staffRows } = await pool.query(queryDetalhes, [eventosRaw.map(e => e.idevento), startDate, endDate]);

    // Funções internas para formatar datas com segurança
    // Normaliza entrada que pode ser Date ou string e retorna Date válido ou null
    const normalizarParaDate = (val) => {
        if (!val) return null;
        if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
        try {
            // Se receber '2026-01-20T00:00:00' ou '2026-01-20', extrai parte de data
            const s = String(val).split('T')[0];
            const d = new Date(s + 'T00:00:00');
            return isNaN(d.getTime()) ? null : d;
        } catch (e) {
            return null;
        }
    };

    const formatarDDMM = (dStr) => {
        const d = normalizarParaDate(dStr);
        if (!d) return '---';
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    };

    const formatarDDMMYYYY = (dStr) => {
        const d = normalizarParaDate(dStr);
        if (!d) return '---';
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    };

    const resultado = eventosRaw.map(ev => {
      const staffs = staffRows.filter(s => s.idevento === ev.idevento);
      let ajT = 0, ajP = 0, chT = 0, chP = 0, cxT = 0, cxP = 0;
      let minEventDate = null, maxEventDate = null;

      const staffsProcessados = staffs.map(s => {
        const vC = parseFloat(s.totalcache_filtrado) || 0;
        const vA = parseFloat(s.totalajudacusto_filtrado) || 0;
        const vX = parseFloat(s.totalcaixinha_filtrado) || 0;
        
        chT += vC; ajT += vA; cxT += vX;

        // Calcula valores pagos considerando pagamentos parciais (ex: 'Pago 50%')
        const calcPago = (status, amount) => {
            if (!status) return 0;
            const s = String(status);
            if (!s.startsWith('Pago')) return 0;
            // Match any digits in the status (handles 'Pago 50%', 'Pago50', 'Pago50%')
            const match = s.match(/(\d+)/);
            if (match) return amount * (Number(match[1]) / 100);
            return amount; // 'Pago' or 'Pago 100%' => valor integral
        };

        chP += calcPago(s.statuspgto, vC);
        ajP += calcPago(s.statuspgtoajdcto, vA);
        cxP += calcPago(s.statuscaixinha, vX);

        // Normaliza e converte para string ISO (YYYY-MM-DD) para comparação/formatacao segura
        const normalizarParaISO = (val) => {
            if (!val) return null;
            if (val instanceof Date) return val.toISOString().split('T')[0];
            const s = String(val).split('T')[0];
            const d = new Date(s + 'T00:00:00');
            return isNaN(d.getTime()) ? null : s;
        };

        const startRaw = s.periodo_eventoini || s.periodo_eventoini_all;
        const endRaw = s.periodo_eventofim || s.periodo_eventofim_all;
        const startISO = normalizarParaISO(startRaw);
        const endISO = normalizarParaISO(endRaw);

        if (startISO) { const d = new Date(startISO + 'T00:00:00'); if (!minEventDate || d < minEventDate) minEventDate = d; }
        if (endISO) { const d = new Date(endISO + 'T00:00:00'); if (!maxEventDate || d > maxEventDate) maxEventDate = d; }

        return {
          ...s,
          // PERÍODO DO FUNCIONÁRIO (usa dd/mm/yyyy para evitar ambiguidade)
          periodo_eventoini_raw: startISO || null,
          periodo_eventofim_raw: endISO || null,
          periodo_eventoini_fmt: startISO ? formatarDDMMYYYY(startISO) : '---',
          periodo_eventofim_fmt: endISO ? formatarDDMMYYYY(endISO) : '---',
          periodo_evento: (startISO && endISO)
              ? (startISO === endISO ? formatarDDMMYYYY(startISO) : `${formatarDDMMYYYY(startISO)} a ${formatarDDMMYYYY(endISO)}`)
              : '---',
          totalcache_filtrado: vC,
          totalajudacusto_filtrado: vA,
          totalcaixinha_filtrado: vX,
          totalpagar: vC + vA + vX
        };
      });

      return {
        idevento: ev.idevento,
        nomeEvento: ev.nmevento,
        totalGeral: ajT + chT + cxT,
        // PERÍODO DO EVENTO (menor data/trabalhada e maior data trabalhada alcançadas pelos staff)
        periodo_evento: minEventDate ? `${String(minEventDate.getDate()).padStart(2,'0')}/${String(minEventDate.getMonth()+1).padStart(2,'0')}/${minEventDate.getFullYear()}` : '---',
        dataFimEvento: maxEventDate ? `${String(maxEventDate.getDate()).padStart(2,'0')}/${String(maxEventDate.getMonth()+1).padStart(2,'0')}/${maxEventDate.getFullYear()}` : '---',
        dataVencimentoAjuda: minEventDate ? new Date(minEventDate.getTime() + 2*86400000).toLocaleDateString('pt-BR') : '---',
        dataVencimentoCache: maxEventDate ? new Date(maxEventDate.getTime() + 10*86400000).toLocaleDateString('pt-BR') : '---',
        ajuda: { total: ajT, pendente: ajT - ajP, pago: ajP },
        cache: { total: chT, pendente: chT - chP, pago: chP },
        caixinha: { total: cxT, pendente: cxT - cxP, pago: cxP },
        funcionarios: staffsProcessados
      };
    });

    res.json({ eventos: resultado });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/vencimentos/update-status", async (req, res) => {
    let { idStaff, tipo, novoStatus } = req.body;

    // 1. Mapeamento da Coluna (Corrigido para incluir Caixinha)
    let coluna = "";
    if (tipo === 'Cache') {
        coluna = 'statuspgto';
    } else if (tipo === 'Ajuda') {
        coluna = 'statuspgtoajdcto';
    } else if (tipo === 'Caixinha') {
        coluna = 'statuscaixinha'; // Nome da coluna conforme sua query de SELECT
    }

    if (!coluna) {
        return res.status(400).json({ success: false, error: "Tipo de pagamento inválido." });
    }

    // 2. Lógica de Padronização do Banco (Ex: "Pago 50%" -> "Pago50")
    let statusFinal = novoStatus;
    if (statusFinal === "Pago 100%") {
        statusFinal = "Pago"; 
    } else if (statusFinal.includes("%")) {
        statusFinal = statusFinal.replace("%", "").replace(/\s/g, "");
    }

    try {
        const result = await pool.query(
            `UPDATE staffeventos SET ${coluna} = $1 WHERE idstaffevento = $2`, 
            [statusFinal, idStaff]
        );

        if (result.rowCount > 0) {
            res.json({ success: true, statusSalvo: statusFinal });
        } else {
            res.status(404).json({ success: false, error: "Registro não encontrado." });
        }
    } catch (error) {
        console.error("Erro ao atualizar status:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post("/vencimentos/upload-comprovante", upload.single('arquivo'), async (req, res) => {
    const { idStaff, tipo } = req.body;
    
    if (!req.file) {
        return res.status(400).json({ error: "Nenhum arquivo enviado." });
    }

    const pathArquivo = req.file.path.replace(/\\/g, "/"); 

    try {
        let coluna = "";

        // Mapeamento direto dos tipos vindo do frontend
        if (tipo === 'cache') {
            coluna = 'comppgtocache';
        } 
        else if (tipo === 'caixinha') {
            coluna = 'comppgtocaixinha';
        } 
        else if (tipo === 'ajuda_50') {
            coluna = 'comppgtoajdcusto50';
        } 
        else if (tipo === 'ajuda_100') {
            coluna = 'comppgtoajdcusto';
        }
        else if (tipo === 'ajuda') {
            // Caso receba apenas 'ajuda', mantemos sua lógica de detecção automática
            const statusRes = await pool.query(
                'SELECT comppgtoajdcusto50 FROM staffeventos WHERE idstaffevento = $1',
                [idStaff]
            );
            const jaTem50 = statusRes.rows[0]?.comppgtoajdcusto50;
            coluna = jaTem50 ? 'comppgtoajdcusto' : 'comppgtoajdcusto50';
        }

        // Se o tipo enviado não bater com nenhum acima, a coluna será vazia
        if (!coluna) {
            console.error("Tipo de upload inválido recebido:", tipo);
            return res.status(400).json({ error: `Tipo de comprovante '${tipo}' não reconhecido.` });
        }

        const result = await pool.query(
            `UPDATE staffeventos SET ${coluna} = $1 WHERE idstaffevento = $2`,
            [pathArquivo, idStaff]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Funcionário não encontrado no evento." });
        }

        res.json({ 
            success: true, 
            path: pathArquivo, 
            colunaDestino: coluna 
        });

    } catch (error) {
        console.error("Erro no processamento do upload:", error);
        res.status(500).json({ error: "Erro interno ao salvar comprovante." });
    }
});
// =======================================


// =======================================
// AGENDA
// =======================================
router.get("/agenda", async (req, res) => {
  try {
  // Tenta obter o idusuario do objeto de requisição (middleware de autenticação) ou do header
  const idusuario = req.usuario?.idusuario || req.headers.idusuario; 
  if (!idusuario) return res.status(400).json({ erro: "Usuário não informado" });

  const resultado = await pool.query(
  `SELECT idagenda, idusuario, titulo, descricao, data_evento, hora_evento, tipo
  FROM agendas
  WHERE idusuario = $1
  ORDER BY data_evento ASC, hora_evento ASC`,
  [idusuario]
);


  res.json(resultado.rows);
  } catch (err) {
  console.error("Erro ao buscar agenda:", err);
  res.status(500).json({ erro: "Erro ao buscar agenda" });
  }
});

router.post("/agenda", async (req, res) => {
  try {
  const idusuario = req.usuario?.idusuario || req.headers.idusuario;
  const { titulo, descricao, data_evento, hora_evento, tipo } = req.body;

  if (!idusuario) return res.status(400).json({ erro: "Usuário não informado" });
  if (!titulo || !data_evento)
  return res.status(400).json({ erro: "Título e data são obrigatórios" });

  const resultado = await pool.query(
  `INSERT INTO agendas (idusuario, titulo, descricao, data_evento, hora_evento, tipo)
   VALUES ($1, $2, $3, $4, $5, $6)
   RETURNING *`,
  [idusuario, titulo, descricao, data_evento, hora_evento, tipo || "Evento"]
);


  res.status(201).json(resultado.rows[0]);
  } catch (err) {
  console.error("Erro ao salvar agenda:", err);
  res.status(500).json({ erro: "Erro ao salvar agenda" });
  }
});

router.delete("/agenda/:idagenda", async (req, res) => {
  try {
  const idusuario = req.usuario?.idusuario || req.headers.idusuario;
  const { idagenda } = req.params;

  if (!idusuario) return res.status(400).json({ erro: "Usuário não informado" });

  // Garantindo que o usuário só possa excluir seus próprios eventos
  const resultado = await pool.query(
  `DELETE FROM agendas
  WHERE idagenda = $1 AND idusuario = $2
  RETURNING idagenda`,
  [idagenda, idusuario]
);


  if (resultado.rowCount === 0) {
  return res.status(404).json({ erro: "Evento não encontrado ou não pertence ao usuário." });
  }

  res.json({ sucesso: true, idagenda: idagenda });
  } catch (err) {
  console.error("Erro ao excluir evento:", err);
  res.status(500).json({ erro: "Erro ao excluir evento" });
  }
});



router.patch('/aditivoextra/:idAditivoExtra/status',
  autenticarToken(),
  contextoEmpresa,
  verificarPermissao('staff', 'cadastrar'),
  logMiddleware('aditivoextra', {
  buscarDadosAnteriores: async (req) => {
    console.log("⚠️ACESSOU A ROTA PATCH ADITIVOEXTRA");
    const id = req.params.idAditivoExtra;

    // 💡 Mantida a correção de segurança para evitar erro 22P02 no log middleware
    if (!id || isNaN(parseInt(id))) return null;

    // Usa a coluna justificativa que já existe no banco
    const query = `SELECT idaditivoextra, status, tiposolicitacao FROM AditivoExtra WHERE idAditivoExtra = $1`;
    const result = await pool.query(query, [id]);
    return result.rows[0] ? { dadosanteriores: result.rows[0], idregistroalterado: id } : null;
    }
    }),
    async (req, res) => {
    const idAditivoExtra = req.params.idAditivoExtra;
    // ⚠️ Vamos ignorar a justificativaStatus na lógica
    const { novoStatus } = req.body; 
    const idUsuarioAprovador = req.usuario?.idusuario;

    console.log(`🔥 Rota /aditivoextra/${idAditivoExtra}/status acessada: Novo Status: ${novoStatus}`, idUsuarioAprovador);

    // 1. Validação
    if (!novoStatus || !idUsuarioAprovador) {
    return res.status(400).json({
    sucesso: false,
    erro: "Novo status e/ou ID do usuário aprovador não fornecidos."
    });
    }

    console.log(`Validando novoStatus: ${novoStatus}`);

    const statusPermitidos = ['Autorizado', 'Rejeitado'];
    if (!statusPermitidos.includes(novoStatus)) {
    return res.status(400).json({
    sucesso: false,
    erro: "Status inválido. Use 'Autorizado' ou 'Rejeitado'."
    });
    }

    console.log(`Status permitido: ${novoStatus}`);


    try {
    // 2. Verifica o status atual da solicitação
    const checkQuery = `SELECT status, tiposolicitacao FROM AditivoExtra WHERE idaditivoextra = $1 AND idempresa = $2`;
    const checkResult = await pool.query(checkQuery, [idAditivoExtra, req.idempresa]);

    if (checkResult.rows.length === 0) {
    return res.status(404).json({ sucesso: false, erro: "Solicitação de Aditivo/Extra não encontrada para esta empresa." });
    }
    console.log(`Status atual da solicitação: ${checkResult.rows[0].status}`);

    const currentStatus = checkResult.rows[0].status;

    if (currentStatus !== 'Pendente') {
    return res.status(400).json({
    sucesso: false,
    erro: `A solicitação não pode ser alterada. Status atual: ${currentStatus}.`
    });
    }

    // 3. Comando SQL de Atualização
    let query;
    let values;

    console.log(`Preparando atualização para status: ${novoStatus}`, idAditivoExtra, req.idempresa);

    // A query de Autorizado já estava correta, sem a justificativa
    if (novoStatus === 'Autorizado') {
    query = `
    UPDATE AditivoExtra
    SET status = $1, 
    dtresposta = NOW(), 
    idusuarioresponsavel = $2
    WHERE idaditivoextra = $3 AND idempresa = $4
    RETURNING *;
    `;
    values = [novoStatus, idUsuarioAprovador, idAditivoExtra, req.idempresa];
    } else if (novoStatus === 'Rejeitado') {
    query = `
    UPDATE AditivoExtra
    SET status = $1, 
    dtresposta = NOW(), 
    idusuarioresponsavel = $2  
    WHERE idaditivoextra = $3 AND idempresa = $4
    RETURNING *;
    `;
    // 💡 CORREÇÃO FINAL: A lista de valores volta a ter 4 itens. O valor para justificativa é NULL.
    values = [novoStatus, idUsuarioAprovador, idAditivoExtra, req.idempresa]; 
    } else {
    throw new Error("Erro de lógica: Status de atualização inválido.");
    }

    const resultado = await pool.query(query, values);

    if (resultado.rows.length === 0) {
    throw new Error("A atualização falhou. Nenhuma linha afetada.");
    }

    // 4. Resposta de Sucesso
    res.json({
    sucesso: true,
    mensagem: `Status da solicitação ${idAditivoExtra} atualizado para ${novoStatus} com sucesso.`,
    dados: resultado.rows[0]
    });

    } catch (error) {
    console.error("Erro ao atualizar status AditivoExtra:", error.message || error);
    res.status(500).json({
    sucesso: false,
    erro: "Erro interno do servidor ao processar a atualização do status."
    });
    }
});

router.get('/aditivoextra', async (req, res) => {
    try {
        const idEmpresa = req.idempresa || req.headers.idempresa; 
        const idUsuario = req.usuario?.idusuario || req.headers.idusuario; 

        if (!idEmpresa) return res.status(400).json({ erro: 'Empresa não informada' });
        if (!idUsuario) return res.status(400).json({ erro: 'Usuário não informado' });

        // 1. Busca todas as permissões de uma vez
        const { rows: allPermissoes } = await pool.query(`
            SELECT modulo, master FROM permissoes 
            WHERE idusuario = $1
        `, [idUsuario]);

        // 2. Define o acesso de Master (apenas para botões de Aprovação/Rejeição)
        const ehMasterStaff = allPermissoes.some(p => p.modulo === 'Staff' && p.master === 'true');
        
        // 3. Define a permissão de Visualização Total (AGORA CHECA SE O MÓDULO 'Staff' EXISTE)
        const temPermissaoVisualizacaoTotal = allPermissoes.some(p => 
            p.modulo === 'Staff' || p.modulo.toLowerCase().includes('aditivoextra')
        );
        
        const podeVerTodos = ehMasterStaff || temPermissaoVisualizacaoTotal; 

        // 4. Lógica de Filtro Condicional
        let filtroSolicitante = '';
        const params = [idEmpresa]; 

        // Se PODE VER TODOS for TRUE, o filtroSolicitante será vazio.
        if (!podeVerTodos) {
            filtroSolicitante = `AND ae.idUsuarioSolicitante = $2`;
            params.push(idUsuario); 
        }

        // DEBUG
        console.log(`[FINAL QUERY STATE] Aditivo Extra | PodeVerTodos: ${podeVerTodos} | Filtro: "${filtroSolicitante}" | Params: ${params.join(', ')}`);


        // 5. Consulta SQL 
        const query = `
        SELECT 
        ae.idAditivoExtra, ae.tipoSolicitacao, ae.justificativa, ae.status, ae.qtdSolicitada,
        ae.dtSolicitacao AS criado_em, ae.idFuncionario, 
        func.nome AS nomeFuncionario, f.descfuncao AS funcao,
        e.nmevento AS evento, s.nome || ' ' || s.sobrenome AS nomesolicitante,
        f.descfuncao AS nmfuncao 
        FROM 
        AditivoExtra ae
        LEFT JOIN Funcao f ON ae.idFuncao = f.idFuncao
        LEFT JOIN Funcionarios func ON ae.idFuncionario = func.idFuncionario
        JOIN Orcamentos o ON ae.idOrcamento = o.idOrcamento
        JOIN Eventos e ON o.idEvento = e.idEvento
        JOIN Usuarios s ON ae.idUsuarioSolicitante = s.idUsuario
        WHERE 
        ae.idEmpresa = $1 
        ${filtroSolicitante} 
        ORDER BY 
        e.nmevento, f.descfuncao, ae.tipoSolicitacao;
        `;

        const resultado = await pool.query(query, params); 
        console.log(`[ADITIVO EXTRA DEBUG] Linhas retornadas do DB: ${resultado.rows.length}`);


        // 6. Mapeamento e Resposta
        const dadosComPermissao = resultado.rows.map(row => ({
            ...row,
            ehMasterStaff: ehMasterStaff, 
            podeVerTodos: podeVerTodos 
        }));

        res.json({
            sucesso: true,
            dados: dadosComPermissao 
        });

    } catch (error) {
        console.error("Erro ao listar AditivoExtra pendentes:", error);
        res.status(500).json({ sucesso: false, erro: "Erro interno ao buscar solicitações Aditivo/Extra." });
    }
});
// =======================================

module.exports = router;