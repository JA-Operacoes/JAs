const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB");
const { autenticarToken, contextoEmpresa } = require('../middlewares/authMiddlewares');
const { verificarPermissao } = require('../middlewares/permissaoMiddleware');
const logMiddleware = require("../middlewares/logMiddleware");

const multer = require('multer');
const path = require('path');
const fs = require('fs');


function isFeriado(date) {
    const d = new Date(date);
    const mmdd = `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const feriadosFixos = ["01-01", "01-25", "04-21", "05-01", "07-09", "09-07", "10-12", "11-02", "11-15", "12-25"];
    if (feriadosFixos.includes(mmdd)) return true;

    // Lógica simplificada de feriados móveis (você pode copiar sua função calcularPascoa para cá)
    const ano = d.getFullYear();
    const f = Math.floor, G = ano % 19, C = f(ano / 100),
          H = (C - f(C / 4) - f((8 * C + 13) / 25) + 19 * G + 15) % 30,
          I = H - f(H / 28) * (1 - f(H / 28) * f(29 / (H + 1)) * f((21 - G) / 11)),
          J = (ano + f(ano / 4) + I + 2 - C + f(C / 4)) % 7, L = I - J,
          mes = 3 + f((L + 40) / 44), dia = L + 28 - 31 * f(mes / 4);
    const pascoa = new Date(ano, mes - 1, dia);
    const moveis = [
        new Date(pascoa.getTime() - 47 * 86400000), // Carnaval
        new Date(pascoa.getTime() - 2 * 86400000),  // Sexta Santa
        pascoa,                                     // Pascoa
        new Date(pascoa.getTime() + 60 * 86400000)  // Corpus Christi
    ];
    return moveis.some(m => m.getDate() === d.getDate() && m.getMonth() === d.getMonth());
}

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
      AND o.status != 'R'
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
                o.idevento, lm.descmontagem AS nmlocalmontagem, o.idmontagem, o.idcliente,
                MAX(o.nrorcamento) AS nrorcamento,
                -- LÓGICA MISTA: 
                -- Se o cache está fechado, contamos 1 vaga por item (independente da qtd).
                -- Se o cache NÃO está fechado, mantemos a soma da qtditens original.
                SUM(CASE 
                    WHEN i.cachefechado = true THEN 1
                    ELSE i.qtditens 
                END) AS total_vagas,
                MIN(o.dtinimarcacao) AS dtinimarcacao, MAX(o.dtfimmarcacao) AS dtfimmarcacao,
                MIN(o.dtinimontagem) AS dtinimontagem, MAX(o.dtfimmontagem) AS dtfimmontagem,
                MIN(o.dtinirealizacao) AS dtinirealizacao, MAX(o.dtfimrealizacao) AS dtfimrealizacao,
                MIN(o.dtinidesmontagem) AS dtinidesmontagem, MAX(o.dtfimdesmontagem) AS dtfimdesmontagem,
                array_agg(DISTINCT f.idequipe) FILTER (WHERE f.idequipe IS NOT NULL) AS equipes_ids,
                array_agg(DISTINCT eq.nmequipe) FILTER (WHERE eq.nmequipe IS NOT NULL) AS equipes_nomes,
                array_agg(DISTINCT p.nmpavilhao) FILTER (WHERE p.nmpavilhao IS NOT NULL) AS pavilhoes_nomes,
                (SELECT json_agg(row_to_json(t)) FROM (
                    SELECT 
                        eq2.idequipe, 
                        eq2.nmequipe AS equipe, 
                        i2.idfuncao, 
                        f2.descfuncao AS nome_funcao, 
                        -- REPETE A LÓGICA NO DETALHE DO JSON
                        SUM(CASE 
                            WHEN i2.cachefechado = true THEN 1
                            ELSE i2.qtditens 
                        END) AS total_vagas,
                        bool_and(i2.cachefechado) as cache_fechado
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
            GROUP BY o.idevento, lm.descmontagem, o.idmontagem, o.idcliente
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
                SELECT DISTINCT ON (o.idevento) o.idevento, o.idcliente, c.nmfantasia
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
                        -- ADICIONADO (SELECT ... LIMIT 1) PARA EVITAR O ERRO
                        (SELECT equipes_detalhes_base FROM vagas_orc WHERE idevento = e.idevento LIMIT 1)
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

    // 1️⃣ Busca Orçamentos (Inalterado)
    const { rows: orcamentos } = await pool.query(
      `SELECT o.idorcamento, o.status, o.idcliente, o.idmontagem
        FROM orcamentos o
        JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
        WHERE o.idevento = $1 AND oe.idempresa = $2 AND EXTRACT(YEAR FROM o.dtinirealizacao) = $3 AND o.status <> 'R'
        ORDER BY o.dtinirealizacao DESC;`,
      [idevento, idempresa, ano]
    );

    if (!orcamentos.length) return res.status(200).json({ equipes: [] });

    const idsOrcamentos = orcamentos.map(o => o.idorcamento);
    const idcliente = orcamentos[0].idcliente;
    const idmontagem = orcamentos[0].idmontagem;

    // 2️⃣ Busca Vagas (Ajuste na sintaxe do CASE)
    const { rows: itensOrcamento } = await pool.query(
        `SELECT f.idequipe, eq.nmequipe AS equipe, i.idfuncao, f.descfuncao AS funcao,
          COALESCE(i.setor, '') AS setor_orcamento,
          -- Aqui está a mágica:
          SUM(CASE 
              WHEN i.cachefechado = true THEN i.qtddias 
              ELSE i.qtditens                                     
          END) AS qtd_orcamento,
          MIN(i.periododiariasinicio) AS dtini_vaga,
          MAX(i.periododiariasfim) AS dtfim_vaga,
          -- Retornamos se QUALQUER item desse grupo é cache fechado
          bool_or(i.cachefechado = true) as tem_cache_fechado,
          i.idorcamento -- 🎯 IMPORTANTE: Adicione o idorcamento para o frontend usar
   FROM orcamentoitens i
   JOIN funcao f ON f.idfuncao = i.idfuncao
   JOIN equipe eq ON eq.idequipe = f.idequipe
   WHERE i.idorcamento = ANY($1) AND i.categoria = 'Produto(s)'
   GROUP BY f.idequipe, eq.nmequipe, i.idfuncao, f.descfuncao, i.setor, i.idorcamento`,
        [idsOrcamentos]
    );

    // 3️⃣ Busca Realizado (Adicionada vírgula e diarias_consumidas)
    const { rows: staffCount } = await pool.query(
      `SELECT se.idfuncao, 
              COALESCE(NULLIF(se.pavilhao, ''), se.setor, '') AS localizacao,
              COUNT(DISTINCT se.idstaff) AS qtd_cadastrada_pessoas,
              SUM(jsonb_array_length(se.datasevento)) AS diarias_consumidas
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

    // 4️⃣ Busca Datas (Inalterado)
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

    const datasStaffMap = datasStaffRaw.reduce((acc, row) => {
      const key = `${row.idfuncao}_${String(row.localizacao).trim().toUpperCase()}`;
      acc[key] = row.datas_staff;
      return acc;
    }, {});

    // 5️⃣ Agrupamento final (Com a lógica condicional interna)
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
      const cadastrado = staffCount.find(s => 
        String(s.idfuncao) === String(item.idfuncao) && 
        String(s.localizacao).trim().toUpperCase() === setorNormalizado
      ); 

      // --- LÓGICA DE TRANSIÇÃO ---
      // Se for cache fechado, pegamos a soma de diárias, senão a contagem de pessoas
      let qtd_cadastrada = 0;
      if (cadastrado) {
        qtd_cadastrada = item.tem_cache_fechado 
          ? Number(cadastrado.diarias_consumidas) 
          : Number(cadastrado.qtd_cadastrada_pessoas);
      }
      // ---------------------------

      const chaveDatas = `${item.idfuncao}_${setorNormalizado}`;
      const datas_staff = datasStaffMap[chaveDatas] || [];

    //   console.log("[DEBUG] item cache:", item.idfuncao, item.tem_cache_fechado);

      equipesMap[idequipeKey].funcoes.push({
        idfuncao: item.idfuncao,
        nome: item.setor_orcamento ? `${item.funcao} (${item.setor_orcamento})` : item.funcao,
        setor_orcamento: item.setor_orcamento,
        qtd_orcamento: Number(item.qtd_orcamento) || 0,
        qtd_cadastrada, // Agora reflete ou pessoas ou diárias
        concluido: qtd_cadastrada >= (Number(item.qtd_orcamento) || 0),
        dtini_vaga: item.dtini_vaga,
        dtfim_vaga: item.dtfim_vaga,
        datas_staff: datas_staff,
        cache_fechado: item.tem_cache_fechado 
      });
    }

    res.status(200).json({ 
      equipes: Object.values(equipesMap), 
      idmontagem,
      idorcamento: idsOrcamentos[0] 
    });

  } catch (err) {
    console.error("Erro ao processar detalhes:", err);
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
            WITH PedidosDetalhados AS (
                -- 1. Bloco Caixinha (Define a estrutura mestre)
                SELECT 
                    l.id AS id_log, se.idstaffevento, l.idexecutor, (u.nome || ' ' || u.sobrenome) AS nomesolicitante,
                    f.nome AS nomefuncionario, e.nmevento AS evento, se.datasevento, l.criado_em,
                    se.vlralimentacao, se.vlrtransporte,
                    'statuscaixinha' AS categoria, 
                    l.dadosnovos->>'statuscaixinha' AS status_atual,
                    se.vlrcaixinha, se.desccaixinha, se.statuscaixinha,
                    NULL::numeric AS vlrajustecusto, NULL AS descajustecusto, NULL AS statusajustecusto,
                    NULL::numeric AS vlrcache, NULL AS desccustofechado, NULL AS statuscustofechado,
                    NULL AS dtdiariadobrada, NULL AS descdiariadobrada, NULL AS statusdiariadobrada,
                    NULL AS dtmeiadiaria, NULL AS descmeiadiaria, NULL AS statusmeiadiaria,
                    se.idfuncionario AS idusuarioalvo
                FROM logs l
                JOIN staffeventos se ON l.idregistroalterado = se.idstaffevento
                LEFT JOIN usuarios u ON u.idusuario = l.idexecutor
                LEFT JOIN funcionarios f ON f.idfuncionario = se.idfuncionario
                LEFT JOIN eventos e ON e.idevento = se.idevento
                WHERE l.modulo = 'staffeventos' AND l.idempresa = $1 
                AND l.dadosnovos ? 'statuscaixinha' 
                AND (REPLACE(COALESCE(l.dadosnovos->>'vlrcaixinha', '0'), ',', '.'))::numeric <> 0
                ${filtroSolicitante}

                UNION ALL

                -- 2. Bloco Ajuste de Custo
                SELECT 
                    l.id AS id_log, se.idstaffevento, l.idexecutor, (u.nome || ' ' || u.sobrenome) AS nomesolicitante,
                    f.nome AS nomefuncionario, e.nmevento AS evento, se.datasevento, l.criado_em,
                    se.vlralimentacao, se.vlrtransporte,
                    'statusajustecusto' AS categoria, 
                    l.dadosnovos->>'statusajustecusto' AS status_atual,
                    NULL, NULL, NULL, -- Caixinha
                    se.vlrajustecusto, se.descajustecusto, se.statusajustecusto,
                    NULL, NULL, NULL, -- Cachê Fechado
                    NULL, NULL, NULL, -- Diária Dobrada
                    NULL, NULL, NULL, -- Meia Diária
                    se.idfuncionario AS idusuarioalvo
                FROM logs l
                JOIN staffeventos se ON l.idregistroalterado = se.idstaffevento
                LEFT JOIN usuarios u ON u.idusuario = l.idexecutor
                LEFT JOIN funcionarios f ON f.idfuncionario = se.idfuncionario
                LEFT JOIN eventos e ON e.idevento = se.idevento
                WHERE l.modulo = 'staffeventos' AND l.idempresa = $1 
                AND l.dadosnovos ? 'statusajustecusto' 
                AND (REPLACE(COALESCE(l.dadosnovos->>'vlrajustecusto', '0'), ',', '.'))::numeric <> 0
                ${filtroSolicitante}

                UNION ALL

                -- 3. Bloco Cachê Fechado
                SELECT 
                    l.id AS id_log, se.idstaffevento, l.idexecutor, (u.nome || ' ' || u.sobrenome) AS nomesolicitante,
                    f.nome AS nomefuncionario, e.nmevento AS evento, se.datasevento,  l.criado_em, 
                    se.vlralimentacao, se.vlrtransporte,
                    CASE 
                        WHEN se.nivelexperiencia ILIKE '%Liberado%' THEN 'statuscacheliberado'
                        ELSE 'statuscustofechado' 
                    END AS categoria, 
                    l.dadosnovos->>'statuscustofechado' AS status_atual,
                    NULL, NULL, NULL, -- Caixinha
                    NULL, NULL, NULL, -- Ajuste Custo
                    se.vlrcache, se.desccustofechado, se.statuscustofechado,
                    NULL, NULL, NULL, -- Diária Dobrada
                    NULL, NULL, NULL, -- Meia Diária
                    se.idfuncionario AS idusuarioalvo
                FROM logs l
                JOIN staffeventos se ON l.idregistroalterado = se.idstaffevento
                LEFT JOIN usuarios u ON u.idusuario = l.idexecutor
                LEFT JOIN funcionarios f ON f.idfuncionario = se.idfuncionario
                LEFT JOIN eventos e ON e.idevento = se.idevento
                WHERE l.modulo = 'staffeventos' AND l.idempresa = $1 
                AND l.dadosnovos ? 'statuscustofechado' 
                AND (REPLACE(COALESCE(l.dadosnovos->>'vlrcache', '0'), ',', '.'))::numeric <> 0
                ${filtroSolicitante}

                UNION ALL

                -- 4. Bloco Diária Dobrada
                SELECT 
                    l.id AS id_log, se.idstaffevento, l.idexecutor, (u.nome || ' ' || u.sobrenome) AS nomesolicitante,
                    f.nome AS nomefuncionario, e.nmevento AS evento, se.datasevento, l.criado_em,
                    se.vlralimentacao, se.vlrtransporte,
                    'statusdiariadobrada' AS categoria, 
                    l.dadosnovos->>'statusdiariadobrada' AS status_atual,
                    NULL, NULL, NULL, -- Caixinha
                    NULL, NULL, NULL, -- Ajuste Custo
                    NULL, NULL, NULL, -- Cachê Fechado
                    se.dtdiariadobrada::text, se.descdiariadobrada, se.statusdiariadobrada,
                    NULL, NULL, NULL, -- Meia Diária
                    se.idfuncionario AS idusuarioalvo
                FROM logs l
                JOIN staffeventos se ON l.idregistroalterado = se.idstaffevento
                LEFT JOIN usuarios u ON u.idusuario = l.idexecutor
                LEFT JOIN funcionarios f ON f.idfuncionario = se.idfuncionario
                LEFT JOIN eventos e ON e.idevento = se.idevento
                WHERE l.modulo = 'staffeventos' AND l.idempresa = $1 
                AND l.dadosnovos ? 'statusdiariadobrada'
                AND se.dtdiariadobrada IS NOT NULL AND se.dtdiariadobrada::text <> '[]'
                AND jsonb_array_length(se.dtdiariadobrada) > 0
                ${filtroSolicitante}

                UNION ALL

                -- 5. Bloco Meia Diária
                SELECT 
                    l.id AS id_log, se.idstaffevento, l.idexecutor, (u.nome || ' ' || u.sobrenome) AS nomesolicitante,
                    f.nome AS nomefuncionario, e.nmevento AS evento, se.datasevento, l.criado_em,
                    se.vlralimentacao, se.vlrtransporte,
                    'statusmeiadiaria' AS categoria, 
                    l.dadosnovos->>'statusmeiadiaria' AS status_atual,
                    NULL, NULL, NULL, -- Caixinha
                    NULL, NULL, NULL, -- Ajuste Custo
                    NULL, NULL, NULL, -- Cachê Fechado
                    NULL, NULL, NULL, -- Diária Dobrada
                    se.dtmeiadiaria::text, se.descmeiadiaria, se.statusmeiadiaria,
                    se.idfuncionario AS idusuarioalvo
                FROM logs l
                JOIN staffeventos se ON l.idregistroalterado = se.idstaffevento
                LEFT JOIN usuarios u ON u.idusuario = l.idexecutor
                LEFT JOIN funcionarios f ON f.idfuncionario = se.idfuncionario
                LEFT JOIN eventos e ON e.idevento = se.idevento
                WHERE l.modulo = 'staffeventos' AND l.idempresa = $1 
                AND l.dadosnovos ? 'statusmeiadiaria'
                AND se.dtmeiadiaria IS NOT NULL AND se.dtmeiadiaria::text <> '[]'
                AND jsonb_array_length(se.dtmeiadiaria) > 0
                ${filtroSolicitante}
            )
            SELECT DISTINCT ON (pd.idstaffevento, pd.categoria)
                pd.*,
                COALESCE(o.dtfiminfradesmontagem, o.dtfimdesmontagem) AS dtfimrealizacao,
                u2.nome || ' ' || u2.sobrenome AS nome_aprovador,
                l2.criado_em AS data_decisao
            FROM PedidosDetalhados pd
            LEFT JOIN orcamentos o ON o.idevento = (SELECT se2.idevento FROM staffeventos se2 WHERE se2.idstaffevento = pd.idstaffevento LIMIT 1)
            LEFT JOIN logs l2 ON l2.idlog_origem = pd.id_log
            LEFT JOIN usuarios u2 ON u2.idusuario = l2.idexecutor
            WHERE pd.status_atual ILIKE 'Pendente'
            ORDER BY pd.idstaffevento, pd.categoria, pd.id_log, pd.criado_em ASC;
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
            const stringifyUnico = (statusField, valorRaw, descricaoRaw, alimentacaoRaw, transporteRaw) => {
                const valor = parseValor(valorRaw);
                const vlrAlim = parseValor(alimentacaoRaw);
                const vlrTrans = parseValor(transporteRaw);
                const status = statusField || '';
                const descricao = descricaoRaw && descricaoRaw !== '-' ? descricaoRaw : null;
                if (status.trim() !== '' || valor !== 0) {
                    return JSON.stringify([{ 
                        status: status, 
                        valor: valor, 
                        descricao: descricao,
                        vlralimentacao: vlrAlim,
                        vlrtransporte: vlrTrans                     
                    }]);
                }
                return null;
            };
            // ** CORREÇÃO APLICADA AQUI **
            const diariaDobrada = isJsonbArrayEmpty(r.dtdiariadobrada) ? null : r.dtdiariadobrada;
            const meiaDiaria = isJsonbArrayEmpty(r.dtmeiadiaria) ? null : r.dtmeiadiaria;
       
            // Mapeamento que garante a estrutura de objeto principal com os campos aninhados:
            return {
                id_log: r.id_log,
                idStaffEvento: r.idstaffevento,
                idpedido: r.id, 
                solicitante: r.idexecutor || null,
                nomeSolicitante: r.nomesolicitante || r.nomeexecutor || '', // Preferencialmente o nome real do solicitante
                funcionario: r.nomefuncionario || '-',
                evento: r.evento,
                dtCriacao: r.criado_em,
                nomeAprovador: r.nome_aprovador || '-',
                dataDecisao: r.data_decisao || null,
                dataSolicitacao: r.criado_em || null,
                categoria: r.categoria,

                // CAMPOS DE STATUS ANINHADOS: 
                // Diárias (Agora só incluídas se não forem '[]')
                statusmeiadiaria: meiaDiaria, 
                statusdiariadobrada: diariaDobrada,
                statuscaixinha: stringifyUnico(r.statuscaixinha, r.vlrcaixinha, r.desccaixinha),
                statusajustecusto: stringifyUnico(r.statusajustecusto, r.vlrajustecusto, r.descajustecusto),
                statuscustofechado: stringifyUnico(r.statuscustofechado, r.vlrcache, r.desccustofechado, r.vlralimentacao, r.vlrtransporte),
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


router.post('/notificacoes-financeiras/atualizar-status',
    autenticarToken(),
    contextoEmpresa,
    logMiddleware('staffeventos', {
        buscarDadosAnteriores: async (req) => {
            const { idpedido } = req.body;
            if (!idpedido) return null;
            const { rows } = await pool.query(`SELECT * FROM staffeventos WHERE idstaffevento = $1`, [idpedido]);
            return rows[0] ? { dadosanteriores: rows[0], idregistroalterado: idpedido } : null;
        }
    }),
    async (req, res) => {
        try {
            const { idpedido, categoria, acao, data: dataEspecifica, idlog_origem } = req.body; 
            const idempresa = req.idempresa;
            

            if (!idpedido || !categoria || !acao) return res.status(400).json({ error: 'Dados incompletos' });

            const statusParaAtualizar = acao.charAt(0).toUpperCase() + acao.slice(1).toLowerCase(); 

            const mapCategorias = {
                'statuscaixinha': 'statuscaixinha',
                'statusajustecusto': 'statusajustecusto',
                'statusdiariadobrada': 'dtdiariadobrada', 
                'statusmeiadiaria': 'dtmeiadiaria',
                'statuscustofechado': 'statuscustofechado', 
                'statuscacheliberado': 'statuscustofechado'   
            };
            const colunaDB = mapCategorias[categoria];
            if (!colunaDB) return res.status(400).json({ error: "Categoria inválida" });

            // 1. BUSCA COM JOIN EM FUNCIONARIOS PARA PEGAR O PERFIL
            const queryBusca = `
                SELECT 
                    se.*, 
                    f.perfil 
                FROM staffeventos se
                INNER JOIN funcionarios f ON se.idfuncionario = f.idfuncionario
                WHERE se.idstaffevento = $1 
                AND EXISTS (SELECT 1 FROM staffempresas sem WHERE sem.idstaff = se.idstaff AND sem.idempresa = $2)
            `;
            const { rows } = await pool.query(queryBusca, [idpedido, idempresa]);
            if (!rows.length) return res.status(404).json({ error: 'Pedido não encontrado ou sem permissão.' });
            
            let registro = rows[0];

            // 2. ATUALIZAÇÃO DO STATUS NO OBJETO EM MEMÓRIA
            // É aqui que garantimos que o cálculo lerá o valor novo que veio do POST
            if (categoria === 'statusdiariadobrada' || categoria === 'statusmeiadiaria') {
                const arrayDiarias = Array.isArray(registro[colunaDB]) ? registro[colunaDB] : [];
                registro[colunaDB] = arrayDiarias.map(item => {
                    if (item.data === dataEspecifica) {
                        return { ...item, status: statusParaAtualizar };
                    }
                    return item;
                });
            } else {
                // Para statusajustecusto, statuscaixinha, statuscustofechado:
                // Atualizamos o objeto 'registro' com o novo status (Ex: 'Autorizado')
                registro[colunaDB] = statusParaAtualizar;
            }       

            // 3. Variáveis de cálculo - SEMPRE iniciamos em 0 para recalcular o estado atual completo
            let total = 0;
            let totalCache = 0;
            let totalAjdCusto = 0;

            const vlrCusto = parseFloat(registro.vlrcache) || 0;
            const vlrTransp = parseFloat(registro.vlrtransporte) || 0;
            const vlrAlim = parseFloat(registro.vlralimentacao) || 0;
            const vlrAlimDobra = parseFloat(registro.vlralimentacaodobra) || parseFloat(registro.vlralimentacao) || 0;
            const vlrAjuste = parseFloat(registro.vlrajustecusto) || 0;
            const vlrCaixinha = parseFloat(registro.vlrcaixinha) || 0;
            const qtdp = parseInt(registro.qtdpessoaslote) || 1;
            const modoExperiencia = registro.nivelexperiencia;
            const perfil = (registro.perfil || '').toLowerCase();

            // --- 4. CÁLCULO DA BASE (Fechado / Liberado) ---
            // Usamos o 'registro' que já contém o status atualizado no passo 3
            if (registro.statuscustofechado === 'Autorizado') {
                if (modoExperiencia === 'Fechado') {
                    total = vlrCusto + vlrTransp + vlrAlim;
                    totalCache = vlrCusto;
                    totalAjdCusto = vlrTransp + vlrAlim;
                } 
                else if (modoExperiencia === 'Liberado') {
                    const datas = Array.isArray(registro.datasevento) ? registro.datasevento : [];
                    datas.forEach(dStr => {
                        const d = new Date(dStr + 'T12:00:00');
                        const isFDSouFeriado = d.getDay() === 0 || d.getDay() === 6 || isFeriado(d);

                        if (perfil === 'lote') {
                            total += (vlrCusto + vlrTransp + vlrAlim) * qtdp;
                            totalCache += vlrCusto * qtdp;
                            totalAjdCusto += (vlrTransp + vlrAlim) * qtdp;
                        } 
                        else if (perfil === 'interno' || perfil === 'externo') {
                            total += vlrTransp + vlrAlim;
                            totalAjdCusto += vlrTransp + vlrAlim;
                            if (isFDSouFeriado) {
                                total += vlrCusto;
                                totalCache += vlrCusto;
                            }
                        } 
                        else {
                            total += vlrCusto + vlrTransp + vlrAlim;
                            totalCache += vlrCusto;
                            totalAjdCusto += vlrTransp + vlrAlim;
                        }
                    });
                }
            } else {
                // BASE NORMAL (Base, Junior, Pleno, Senior, Freelancer)
                const datas = Array.isArray(registro.datasevento) ? registro.datasevento : [];
                
                datas.forEach(dStr => {
                    const d = new Date(dStr + 'T12:00:00');
                    const isFDSouFeriado = d.getDay() === 0 || d.getDay() === 6 || isFeriado(d);

                    if (perfil === 'lote') {
                        total += (vlrCusto + vlrTransp + vlrAlim) * qtdp;
                        totalCache += vlrCusto * qtdp;
                        totalAjdCusto += (vlrTransp + vlrAlim) * qtdp;
                    } else if (perfil === 'freelancer') {
                        total += vlrCusto + vlrTransp + vlrAlim;
                        totalCache += vlrCusto;
                        totalAjdCusto += vlrTransp + vlrAlim;
                    } else {
                        // CLT (interno/externo/padrão): cachê só em FDS/Feriado
                        total += vlrTransp + vlrAlim;
                        totalAjdCusto += vlrTransp + vlrAlim;
                        if (isFDSouFeriado) {
                            total += vlrCusto;
                            totalCache += vlrCusto;
                        }
                    }
                });
            }

            // --- 5. SOMA DOS ADICIONAIS (Independentes da Base) ---

            // AJUSTE DE CUSTO (Aditivo)
            if (registro.statusajustecusto === 'Autorizado') {                
                total += vlrAjuste; 
                totalCache += vlrAjuste;
                // Note: Não mexe no totalAjdCusto (Ajuda de custo), mantendo o que veio da Base.
            }

            // CAIXINHA
            if (registro.statuscaixinha === 'Autorizado') {                
                total += vlrCaixinha;
            }

            // DIÁRIAS DOBRADAS
            (registro.dtdiariadobrada || []).forEach(i => {
                if ((i.status || '').toLowerCase() === 'autorizado') {
                    const d = new Date(i.data + 'T12:00:00');
                    const isFDSouFeriado = d.getDay() === 0 || d.getDay() === 6 || isFeriado(d);

                    if (perfil === 'interno' || perfil === 'externo') {
                        if (isFDSouFeriado) {
                            total += vlrCusto + vlrAlimDobra;
                            totalCache += vlrCusto + vlrAlimDobra;
                        } else {
                            total += vlrAlimDobra;
                            totalCache += vlrAlimDobra;
                        }
                    } else {
                        total += vlrCusto + vlrAlimDobra;
                        totalCache += vlrCusto + vlrAlimDobra;
                    }
                }
            });

            // MEIAS DIÁRIAS
            (registro.dtmeiadiaria || []).forEach(i => {
                if ((i.status || '').toLowerCase() === 'autorizado') {
                    const d = new Date(i.data + 'T12:00:00');
                    const isFDSouFeriado = d.getDay() === 0 || d.getDay() === 6 || isFeriado(d);

                    if (perfil === 'interno' || perfil === 'externo') {
                        if (isFDSouFeriado) {
                            total += (vlrCusto / 2) + vlrAlimDobra;
                            totalCache += (vlrCusto / 2) + vlrAlimDobra;
                        } else {
                            total += vlrAlimDobra;
                            totalCache += vlrAlimDobra;
                        }
                    } else {
                        total += (vlrCusto / 2) + vlrAlimDobra;
                        totalCache += (vlrCusto / 2) + vlrAlimDobra;
                    }
                }
            });

           
            // 6. UPDATE FINAL
            const valorFinalColuna = (categoria === 'statusdiariadobrada' || categoria === 'statusmeiadiaria') 
                ? JSON.stringify(registro[colunaDB]) 
                : statusParaAtualizar;

            const queryUpdate = `
                UPDATE staffeventos se
                SET ${colunaDB} = $1, vlrtotal = $2, vlrtotcache = $3, vlrtotajdcusto = $4
                FROM staffempresas sem
                WHERE idstaffevento = $5 AND sem.idstaff = se.idstaff AND sem.idempresa = $6                
                RETURNING *;
            `;

            const finalResult = await pool.query(queryUpdate, [valorFinalColuna, total, totalCache, totalAjdCusto, idpedido, idempresa]);

            res.locals.idlog_origem = idlog_origem;
            res.locals.acao = 'atualizou';
            res.locals.idregistroalterado = idpedido;
            res.locals.dadosnovos = finalResult.rows[0];

            res.json({ 
                sucesso: true, 
                atualizado: finalResult.rows[0],
                idlog_origem,
                categoria
            });

        } catch (err) {
            console.error('Erro:', err);
            res.status(500).json({ error: 'Erro interno ao processar' });
        }
    }
);

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


// const storage = multer.diskStorage({
//     destination: function (req, file, cb) {
//         const dir = './uploads/comprovantes/';
//         // Cria a pasta caso ela não exista
//         if (!fs.existsSync(dir)){
//             fs.mkdirSync(dir, { recursive: true });
//         }
//         cb(null, dir);
//     },
//     filename: function (req, file, cb) {
//         // Gera um nome único: idStaff-timestamp-nomeoriginal
//         const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
//         cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
//     }
// });



const storage = multer.diskStorage({
    
    destination: function (req, file, cb) {
        console.log("REQ.BODY NO STORAGE FILENAME:", req.body); // Debug para verificar o conteúdo do body
        let dir = './uploads/contas/comprovantespgto/'; // Padrão

        // 1. Se houver qualquer indício de Staff, vai para a pasta de staff
        if (req.body.idStaff || req.body.idStaffEvento || req.body.tipo === 'staff') {
            dir = './uploads/staff_comprovantes/';
        } 
        // 2. Se for explicitamente uma imagem de conta (boleto)
        else if (req.body.tipo === 'imagem') {
            dir = './uploads/contas/imagemboleto/';
        }
        // 3. Caso contrário, cai na pasta de comprovantes de conta (já definida no padrão)

        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const id = req.body.idPagamento || req.body.idStaff || '0';        
        const tipo = req.body.tipo;
        
        // 1. Definir o Prefixo (Contexto)
        let contexto = req.body.contexto;
        if (!contexto) {
            contexto = (req.body.idStaffEvento || tipo === 'staff') ? 'comppgtocache' : 
                    (tipo === 'imagem' ? 'imagemboleto' : 'comprovantePagamento');
        }

        // 2. Tratar o nome original do arquivo para remover espaços e caracteres chatos
        // Exemplo: "agua indaiatuba.jfif" -> "aguaIndaiatuba"
        const nomeOriginalLimpo = path.parse(file.originalname).name
            .replace(/\s+/g, '') // Remove espaços
            .replace(/[^a-zA-Z0-9]/g, ''); // Remove símbolos

        // 3. Criar uma data legível (AAAAMMDD) em vez de apenas o timestamp puro
        const dataHoje = new Date().toISOString().split('T')[0].replace(/-/g, ''); 

        const ext = path.extname(file.originalname).toLowerCase();
        
        // FORMATO FINAL: comprovantepgto-ID133-20260303-aguaIndaiatuba.jfif
        const nomeFinal = `${contexto}-ID${id}-${dataHoje}-${nomeOriginalLimpo}${ext}`;
        
        cb(null, nomeFinal);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        // Inclusão explícita do .jfif para compatibilidade com WhatsApp
        if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf' || ext === '.jfif') {
            cb(null, true);
        } else {
            cb(new Error("Apenas imagens (JPG/PNG/JFIF) e PDFs são permitidos."));
        }
    }
});


router.get("/vencimentos", async (req, res) => {
  try {
    const idempresa = req.idempresa;
    if (!idempresa) return res.status(400).json({ error: "idempresa obrigatório." });

    const periodo = (req.query.periodo || 'anual').toLowerCase();
    const anoFiltro = parseInt(req.query.ano, 10) || new Date().getFullYear();

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

    const queryAgregacao = `
        SELECT 
            o.idevento, 
            e.nmevento,
            MIN(o.dtinimarcacao) AS dtinimarcacao,
            MIN(o.dtinimontagem) AS dtinimontagem,
            MAX(o.dtfimdesmontagem) AS dtfimdesmontagem
        FROM orcamentos o
        JOIN orcamentoempresas oe ON o.idorcamento = oe.idorcamento
        JOIN eventos e ON o.idevento = e.idevento
        WHERE oe.idempresa = $1 
        AND (
            -- Vencimento da Ajuda (2 dias após início da montagem)
            (o.dtinimontagem + INTERVAL '2 days')::date BETWEEN $2 AND $3
            OR 
            -- Vencimento do Cachê (2 dias após fim da desmontagem)
            (o.dtfimdesmontagem + INTERVAL '2 days')::date BETWEEN $2 AND $3
            OR
            o.dtinimarcacao BETWEEN $2 AND $3
        )
        GROUP BY o.idevento, e.nmevento
        ORDER BY dtinimarcacao ASC;
    `;

    const { rows: eventosRaw } = await pool.query(queryAgregacao, [idempresa, startDate, endDate]);
    if (eventosRaw.length === 0) return res.json({ eventos: [] });

    // 2. QUERY DE DETALHES - Limpa, sem MIN/MAX para não dar erro de GROUP BY
    const queryDetalhes = `
      SELECT * FROM (
        SELECT DISTINCT ON (tse.idstaffevento)
          tse.idstaffevento, 
          tse.idevento, 
          tse.nmfuncionario AS nome, 
          tse.nmfuncao AS funcao,
          calc.qtd AS qtddiarias_filtradas, 
          calc.min_dt AS periodo_eventoini, 
          calc.max_dt AS periodo_eventofim,
          calc_full.full_min_dt AS periodo_eventoini_all, 
          calc_full.full_max_dt AS periodo_eventofim_all,
          COALESCE(tse.vlrtotcache, 0) AS totalcache_full,
          COALESCE(tse.vlrajustecusto, 0) AS totalajustecusto_full,
          
          -- NOVA SOMA: Cachê + Ajuda de Custo --
          --(COALESCE(tse.vlrtotcache, 0) + COALESCE(tse.vlrajustecusto, 0)) AS cache_com_ajuste,
          COALESCE(tse.vlrtotcache, 0) AS cache_com_ajuste,
          COALESCE(tse.vlrtotajdcusto, 0) AS totalajudacusto_full,
          COALESCE(tse.vlrcaixinha, 0) AS vlrcaixinha,       
          COALESCE(tse.vlrcaixinha, 0) AS totalcaixinha_full,
          tse.statuspgto, 
          tse.statuspgtoajdcto, 
          tse.statuscaixinha,
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
          SELECT COUNT(*)::int as full_qtd, MIN((d2.dt)::date) AS full_min_dt, MAX((d2.dt)::date) AS full_max_dt
          FROM jsonb_array_elements_text(tse.datasevento) AS d2(dt)
        ) AS calc_full
        WHERE tse.idevento = ANY($1) AND calc.qtd > 0
        ORDER BY tse.idstaffevento
      ) AS sub
      ORDER BY nome ASC;
    `;

    const { rows: staffRows } = await pool.query(queryDetalhes, [eventosRaw.map(e => e.idevento), startDate, endDate]);

    const normalizarParaDate = (val) => {
        if (!val) return null;
        if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
        const s = String(val).split('T')[0];
        const d = new Date(s + 'T00:00:00');
        return isNaN(d.getTime()) ? null : d;
    };

    const formatarDDMMYYYY = (dStr) => {
        const d = normalizarParaDate(dStr);
        return d ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}` : '---';
    };

    const resultado = eventosRaw.map(ev => {
        const staffs = staffRows.filter(s => s.idevento === ev.idevento);
        let ajT = 0, ajP = 0, chT = 0, chP = 0, cxT = 0, cxP = 0;
        
        // Variáveis para capturar a escala real do staff
        let minEscalaStaff = null;
        let maxEscalaStaff = null;

        // Datas oficiais do orçamento para o "Período do Evento"
        const dtInicioMarcacao = normalizarParaDate(ev.dtinimarcacao);
        const dtInicioMontagem = normalizarParaDate(ev.dtinimontagem);
        const dtFimDesmontagem = normalizarParaDate(ev.dtfimdesmontagem);

        const staffsProcessados = staffs.map(s => {
            const vC = parseFloat(s.totalcache_full) || 0;
            const vA = parseFloat(s.totalajudacusto_full) || 0;
            const vX = parseFloat(s.totalcaixinha_full) || 0;
            
            chT += vC; ajT += vA; cxT += vX;

            const calcPago = (status, amount) => {
                if (!status || !String(status).startsWith('Pago')) return 0;
                const match = String(status).match(/(\d+)/);
                return match ? amount * (Number(match[1]) / 100) : amount;
            };

            chP += calcPago(s.statuspgto, vC);
            ajP += calcPago(s.statuspgtoajdcto, vA);
            cxP += calcPago(s.statuscaixinha, vX);

            // --- LÓGICA DE ESCALA REAL (VENCIMENTOS) ---
            const startD = normalizarParaDate(s.periodo_eventoini_all);
            const endD = normalizarParaDate(s.periodo_eventofim_all);
            
            if (startD && (!minEscalaStaff || startD < minEscalaStaff)) minEscalaStaff = startD;
            if (endD && (!maxEscalaStaff || endD > maxEscalaStaff)) maxEscalaStaff = endD;

            return {
                ...s,
                periodo_eventoini_fmt: formatarDDMMYYYY(s.periodo_eventoini_all),
                periodo_eventofim_fmt: formatarDDMMYYYY(s.periodo_eventofim_all),
                totalpagar: vC + vA + vX
            };
        });

        // Cálculos de Vencimento baseados no Staff (Escala Real)
        // Ajuda: 2 dias após o início do primeiro staff | Cachê: 10 dias após o fim do último
        //const dataVencAjuda = minEscalaStaff ? new Date(minEscalaStaff.getTime() + 2*86400000).toLocaleDateString('pt-BR') : '---';
        //const dataVencCache = maxEscalaStaff ? new Date(maxEscalaStaff.getTime() + 10*86400000).toLocaleDateString('pt-BR') : '---';

        return {
            idevento: ev.idevento,
            nomeEvento: ev.nmevento,
            totalGeral: ajT + chT + cxT,
            // Exibição visual: Baseada no Orçamento
            periodo_evento: formatarDDMMYYYY(dtInicioMarcacao), 
            dataFimEvento: formatarDDMMYYYY(dtFimDesmontagem),
            dataInicioMontagem: formatarDDMMYYYY(dtInicioMontagem),
            // Regra de Negócio: Baseada na Escala do Staff
            dataVencimentoAjuda: dtInicioMontagem ? new Date(dtInicioMontagem.getTime() + 2*86400000).toLocaleDateString('pt-BR') : '---',
            dataVencimentoCache: dtFimDesmontagem ? new Date(dtFimDesmontagem.getTime() + 2*86400000).toLocaleDateString('pt-BR') : '---',
            dataVencimentoCaixinha: dtFimDesmontagem ? new Date(dtFimDesmontagem.getTime() + 2*86400000).toLocaleDateString('pt-BR') : '---',
            ajuda: { total: ajT, pendente: ajT - ajP, pago: ajP },
            cache: { total: chT, pendente: chT - chP, pago: chP },
            caixinha: { total: cxT, pendente: cxT - cxP, pago: cxP },
            funcionarios: staffsProcessados
        };
    });
    res.json({ eventos: resultado });

  } catch (error) {
    console.error("ERRO ROTA VENCIMENTOS:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/vencimentos/update-status",
    logMiddleware("Vencimentos", {
        buscarDadosAnteriores: async (req) => {
            const { idStaff } = req.body;
            const query = `SELECT idstaffevento, statuspgto, statuspgtoajdcto, statuscaixinha FROM staffeventos WHERE idstaffevento = $1`;
            const result = await pool.query(query, [idStaff]);
            return result.rows[0] ? { dadosanteriores: result.rows[0], idregistroalterado: idStaff } : null;
        }
    }), 
    async (req, res) => {
        let { idStaff, tipo, novoStatus, idlog_origem  } = req.body;

        const idempresa = req.idempresa; 
        if (!idempresa) {
            return res.status(400).json({ success: false, error: "idempresa obrigatório na requisição." });
        }

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
                `UPDATE staffeventos se SET ${coluna} = $1 
                 FROM staffempresas sem
                 WHERE se.idstaffevento = $2 AND sem.idstaff = se.idstaff AND sem.idempresa = $3
                 RETURNING se.*`, // Adicionado o RETURNING para preencher os dados novos no log
                [statusFinal, idStaff, idempresa]
            );        
            
            if (result.rowCount > 0) {
                res.locals.idlog_origem = idlog_origem;
                res.locals.acao = 'atualizou';
                res.locals.idregistroalterado = idStaff; 
                res.locals.dadosnovos = result.rows[0];
                res.json({ success: true, statusSalvo: statusFinal });
            } else {
                res.status(404).json({ success: false, error: "Registro não encontrado." });
            }
        } catch (error) {
            console.error("Erro ao atualizar status:", error);
            res.status(500).json({ success: false, error: error.message });
        }
});

router.post("/vencimentos/upload-comprovante", upload.single('arquivo'), logMiddleware("Vencimentos", {
    buscarDadosAnteriores: async (req) => {
        const { idStaff } = req.body;
        const query = `SELECT idstaffevento, comppgtocache, comppgtocaixinha, comppgtoajdcusto50, comppgtoajdcusto FROM staffeventos WHERE idstaffevento = $1`;
        const result = await pool.query(query, [idStaff]);
        return result.rows[0] ? { dadosanteriores: result.rows[0], idregistroalterado: idStaff } : null;
    }
}), async (req, res) => {
    const { idStaff, tipo } = req.body;
    
    if (!req.file) {
        return res.status(400).json({ error: "Nenhum arquivo enviado." });
    }

    const pathArquivo = req.file.path.replace(/\\/g, "/"); 

    const idempresa = req.idempresa;

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
            `UPDATE staffeventos se SET ${coluna} = $1 
             FROM staffempresas sem
             WHERE se.idstaffevento = $2 AND sem.idstaff = se.idstaff AND sem.idempresa = $3
             RETURNING se.*`,
            [pathArquivo, idStaff, idempresa]
        );

        res.locals.acao = 'cadastrou';
        res.locals.idregistroalterado = idStaff; 
        res.locals.dadosnovos = result.rows[0];

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


//=========CONTAS A PAGAR========//

router.get('/contas-pagar', async (req, res) => {
    try {

        const idEmpresa = String(req.headers.idempresa || req.query.idempresa || '').trim();

        // Validação básica para evitar consulta sem ID
        if (!idEmpresa) {
            return res.status(400).json({ sucesso: false, erro: "ID da empresa não fornecido." });
        }

        const anoFiltro = parseInt(req.query.ano, 10) || new Date().getFullYear();
        
        const query = `
            SELECT DISTINCT 
                l.idlancamento, 
                l.descricao, 
                l.vctobase,
                -- Campos vitais para a projeção no Front-end:
                l.tiporepeticao, 
                l.periodicidade,
                l.qtdeparcelas,
                l.indeterminado,
                l.dttermino,
                COALESCE(l.idempresapagadora, 0) AS idempresapagadora,
                COALESCE(e.nmfantasia, 'Empresa Não Informada') AS empresapagadora,
                -- -------------------------------------------
                COALESCE(p.dtvcto, l.vctobase) AS data_referencia,
                COALESCE(NULLIF(LOWER(TRIM(l.tipovinculo)), ''), 'outros') AS tipovinculo,
                CAST(L.vlrestimado AS FLOAT) AS vlrestimado,
                p.idpagamento, 
                p.numparcela,
                CAST(COALESCE(p.vlrreal, p.vlrprevisto, l.vlrestimado, 0) AS FLOAT) AS valor,
                CAST(p.vlrreal AS FLOAT) as vlrreal,
                CAST(p.vlrpago AS FLOAT) as vlrpago,             
                p.dtvcto,
                p.dtpgto,
                p.status,
                p.comprovantepgto,
                p.imagemconta,
                COALESCE(forn.nmfantasia, func.nome, cli.nmfantasia, 'Lançamento Geral') AS nome_vinculo
            FROM lancamentos l
            LEFT JOIN pagamentos p ON l.idlancamento = p.idlancamento
            LEFT JOIN fornecedores forn ON (LOWER(TRIM(l.tipovinculo)) = 'fornecedor' AND l.idvinculo = forn.idfornecedor)
            LEFT JOIN funcionarios func ON (LOWER(TRIM(l.tipovinculo)) = 'funcionario' AND l.idvinculo = func.idfuncionario)
            LEFT JOIN clientes cli ON (LOWER(TRIM(l.tipovinculo)) = 'cliente' AND l.idvinculo = cli.idcliente)
            LEFT JOIN empresas e ON l.idempresapagadora = e.idempresa
            WHERE l.ativo = true AND l.idempresa = $1
            AND (
      -- Filtra pelo ano passado como parâmetro ($2)
                EXTRACT(YEAR FROM COALESCE(p.dtvcto, l.vctobase)) = $2
                OR 
                (l.tiporepeticao = 'FIXO' AND (l.dttermino IS NULL OR EXTRACT(YEAR FROM l.dttermino) >= $2))
            ) AND EXTRACT(YEAR FROM l.vctobase) <= $2
            ORDER BY l.idlancamento, p.numparcela DESC, p.dtvcto DESC;
        `;

        const { rows } = await pool.query(query, [idEmpresa, anoFiltro]);
        // console.log("PRIMEIRA LINHA DO BANCO:", rows[0]);
        res.json({ sucesso: true, anoReferencia: anoFiltro, contas: rows });
    } catch (error) {
        res.status(500).json({ sucesso: false, erro: error.message });
    }
});


router.post('/confirmar-pagamento-conta',
    logMiddleware('pagamentos', {
        buscarDadosAnteriores: async (req) => {
            const { idlancamento, dtvcto } = req.body;
            if (!idlancamento || !dtvcto) return null;

            const query = `SELECT idpagamento, status, vlrpago, vlratraso, vlrdesconto, dtvcto, dtpgto FROM pagamentos WHERE idlancamento = $1 AND dtvcto = $2::date`;
            const result = await pool.query(query, [idlancamento, dtvcto]);
            
            return result.rows[0] ? { 
                dadosanteriores: result.rows[0], 
                idregistroalterado: result.rows[0].idpagamento 
            } : null;
        }
    }), async (req, res) => {
    const { idpagamento, idlancamento, vlrpago, vlratraso, vlrdesconto, dtvcto, dtpagamento, observacao, status } = req.body;
    const idempresa = req.headers.idempresa;
    const statusFinal = status || 'pago';
    const client = await pool.connect();

    

    // 🟦 LOG DE ENTRADA (Aparecerá com fundo azul no terminal)
    console.log("\n\x1b[44m 📥 [REQUISIÇÃO RECEBIDA] \x1b[0m");
    console.log(`> Lançamento: ${idlancamento} | Vcto: ${dtvcto} | Valor Pago: ${vlrpago} | Atraso: ${vlratraso} | Desconto: ${vlrdesconto}`);
    console.log(`> ID vindo do Front: ${idpagamento} | Status: ${statusFinal}`);

    try {
        await client.query('BEGIN');
        
        const checkPgto = await client.query(
            `SELECT idpagamento FROM pagamentos WHERE idlancamento = $1 AND dtvcto = $2::date`,
            [idlancamento, dtvcto]
        );

        const registroExistente = checkPgto.rows[0];
        let idFinal;

        if (!registroExistente) {
            // Adicionado idempresa no INSERT
            const insertQuery = `
                INSERT INTO pagamentos (
                    idlancamento, idempresa, vlrprevisto, vlrpago, dtvcto,  
                    status, numparcela, dtpgto, observacao, vlratraso, vlrdesconto
                )
                VALUES (
                    $1, $2,
                    (SELECT COALESCE(vlrestimado, 0) FROM lancamentos WHERE idlancamento = $1), 
                    $3, $4, $5, 
                    (SELECT COALESCE(MAX(numparcela), 0) + 1 FROM pagamentos WHERE idlancamento = $1), 
                    $6, $7, $8, $9
                ) RETURNING idpagamento;`;
            
            const resInsert = await client.query(insertQuery, [idlancamento, idempresa, vlrpago, dtvcto, statusFinal, dtpagamento, observacao, vlratraso, vlrdesconto]);
            idFinal = resInsert.rows[0].idpagamento;
        } else {
            idFinal = registroExistente.idpagamento;
            // 🟧 LOG DE UPDATE (Fundo laranja)
            console.log(`\x1b[43m ⚠️ [CENÁRIO: UPDATE] \x1b[0m Atualizando registro ID: ${idFinal}`);
            
            const updateQuery = `
                UPDATE pagamentos 
                SET status = $1, vlrpago = $2, dtpgto = $3, observacao = $4, vlratraso = $5, vlrdesconto = $6 
                WHERE idpagamento = $7 AND idempresa = $8;`;
            
            await client.query(updateQuery, [statusFinal, vlrpago, dtpagamento, observacao, vlratraso, vlrdesconto, idFinal, idempresa]);
        }

        await client.query('COMMIT');

        res.locals.acao = 'cadastrou';
        res.locals.idregistroalterado = idFinal; 
        res.locals.dadosnovos = { // ❌ Estava faltando
            idpagamento: idFinal,
            idlancamento,
            vlrpago,
            vlratraso,
            vlrdesconto,
            dtvcto,
            dtpagamento,
            status: statusFinal
        };

        console.log("\x1b[32m✅ SUCESSO: Transação finalizada.\x1b[0m\n");
        res.json({ sucesso: true, idpagamento: idFinal, mensagem: "Processado com sucesso" });

    } catch (error) {
        await client.query('ROLLBACK');
        console.log("\x1b[41m ❌ [ERRO CRÍTICO] \x1b[0m");
        console.error(error.message);
        res.status(500).json({ sucesso: false, erro: error.message });
    } finally {
        client.release();
    }
});


router.post("/vencimentoconta/uploads_comprovantesconta", 
    upload.single('comprovante'),
    logMiddleware('pagamentos comp.', {
        buscarDadosAnteriores: async (req) => {
            // Usamos o nome enviado pelo FormData: idPagamento
            const idPagamento = req.body.idPagamento;
            if (!idPagamento || isNaN(parseInt(idPagamento))) return null;

            const query = `SELECT idpagamento, comprovantepgto, imagemconta FROM pagamentos WHERE idpagamento = $1`;
            const result = await pool.query(query, [idPagamento]);

            return result.rows[0] ? { 
                dadosanteriores: result.rows[0], 
                idregistroalterado: idPagamento 
            } : null;
        }
    }), async (req, res) => {
    // Extraímos os dados enviados pelo frontend
    const { idPagamento, tipo } = req.body;

    console.log(`[UPLOAD] Iniciando processamento. Tipo: ${tipo} | ID: ${idPagamento}`);
    
    // 1. Verificação de segurança: arquivo existe?
    if (!req.file) {
        return res.status(400).json({ error: "Nenhum arquivo enviado." });
    }

    // 2. Definimos o que vai para o banco: APENAS o nome gerado pelo Multer
    // Isso evita caminhos duplicados como "uploads/contas/uploads/contas..."
    const nomeArquivoNoBanco = req.file.filename;

    try {
        let coluna = "";

        // 3. Mapeamento da coluna baseado no tipo (conforme seu frontend envia)
        if (tipo === 'comprovante') {
            coluna = 'comprovantepgto';
        } 
        else if (tipo === 'imagem') {
            coluna = 'imagemconta';
        } 
        
        if (!coluna) {
            console.error("Tipo de upload inválido:", tipo);
            return res.status(400).json({ error: `Tipo '${tipo}' não reconhecido.` });
        }

        // 4. Executa o UPDATE no banco de dados
        const result = await pool.query(
            `UPDATE pagamentos SET ${coluna} = $1 WHERE idpagamento = $2 AND idempresa = $3`,
            [nomeArquivoNoBanco, idPagamento, idempresa]
        );

        // 5. Verificação se o ID realmente existia
        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Pagamento não encontrado no banco de dados." });
        }

        // Configurações para o logMiddleware concluir
        res.locals.acao = 'atualizou';
        res.locals.idregistroalterado = idPagamento;
        res.locals.dadosnovos = result.rows[0]; 

        // 6. Retorno de sucesso para o frontend
        res.json({ 
            success: true, 
            path: nomeArquivoNoBanco, // Retorna o nome para o Swal e para atualizar a tela
            colunaDestino: coluna 
        });

    } catch (error) {
        console.error("Erro crítico no upload:", error);
        res.status(500).json({ error: "Erro interno ao salvar no banco de dados." });
    }
});


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

router.post("/agenda",logMiddleware('agenda', {
    buscarDadosAnteriores: async (req) => {
        const { titulo, data_evento } = req.body;
        if (!titulo || !data_evento) return null;

        const query = `SELECT idagenda, titulo, descricao, data_evento, hora_evento, tipo FROM agendas WHERE titulo = $1 AND data_evento = $2::date`;
        const result = await pool.query(query, [titulo, data_evento]);

        return result.rows[0] ? { 
            dadosanteriores: result.rows[0], 
            idregistroalterado: result.rows[0].idagenda 
        } : null;
    }
    }), async (req, res) => {
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

    res.locals.acao = 'cadastrou';
    res.locals.idregistroalterado = resultado.rows[0].idagenda;
    res.locals.dadosnovos = resultado.rows[0]; 

    res.status(201).json(resultado.rows[0]);
    } catch (err) {
        console.error("Erro ao salvar agenda:", err);
        res.status(500).json({ erro: "Erro ao salvar agenda" });
    }
});

router.delete("/agenda/:idagenda", logMiddleware('agenda', {
        buscarDadosAnteriores: async (req) => {
            const { idagenda } = req.params;
            const query = `SELECT idagenda, titulo, descricao, data_evento, hora_evento, tipo FROM agendas WHERE idagenda = $1`;
            const result = await pool.query(query, [idagenda]);
            return result.rows[0] ? { dadosanteriores: result.rows[0], idregistroalterado: idagenda } : null;
        }
    }), 
    async (req, res) => {
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

        res.locals.acao = 'excluiu';
        res.locals.idregistroalterado = idagenda 

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
    const { novoStatus, idlog_origem } = req.body; 
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

    res.locals.idlog_origem = idlog_origem || null;

    res.locals.acao = 'atualizou';
    res.locals.idregistroalterado = idAditivoExtra;
    res.locals.dadosnovos = resultado.rows[0];

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
        ae.idAditivoExtra, ae.tipoSolicitacao, ae.justificativa, ae.status, ae.qtdSolicitada, ae.dtsolicitada,
        ae.dtSolicitacao AS criado_em, ae.idFuncionario, 
        func.nome AS nomeFuncionario, f.descfuncao AS funcao,
        e.nmevento AS evento, s.nome || ' ' || s.sobrenome AS nomesolicitante,
        resp.nome || ' ' || resp.sobrenome AS nomeAprovador, dtresposta AS dataDecisao,
        f.descfuncao AS nmfuncao
        FROM 
        AditivoExtra ae
        LEFT JOIN Funcao f ON ae.idFuncao = f.idFuncao
        LEFT JOIN Funcionarios func ON ae.idFuncionario = func.idFuncionario
        JOIN Orcamentos o ON ae.idOrcamento = o.idOrcamento
        JOIN Eventos e ON o.idEvento = e.idEvento      
        JOIN Usuarios s ON ae.idUsuarioSolicitante = s.idUsuario
        LEFT JOIN Usuarios resp ON ae.idUsuarioResponsavel = resp.idUsuario
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
// Rota para retornar a versão do sistema
router.get("/versao", (req, res) => {
    try {
        // Importa o package.json dinamicamente
        const pkg = require('../package.json'); 
        res.json({ versao: pkg.version });
    } catch (err) {
        res.status(500).json({ erro: "Não foi possível ler a versão" });
    }
});

module.exports = router;