const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB");
const { autenticarToken, contextoEmpresa } = require('../middlewares/authMiddlewares');
const { verificarPermissao } = require('../middlewares/permissaoMiddleware');
const logMiddleware = require("../middlewares/logMiddleware");

const multer = require('multer');
const path = require('path');
const fs = require('fs');


// Normaliza "setor" (texto livre do orçamento, ex: "1") e "pavilhão" (nome
// oficial do local, ex: "Pavilhão 1") para o mesmo formato antes de comparar
// — remove acentos, caixa e o prefixo "PAV"/"PAVILHAO" — sem exigir que o
// usuário digite o nome oficial do pavilhão no setor do orçamento.
function normalizarSetorPavilhao(valor) {
    const SEM_ACENTO = new RegExp('[̀-ͯ]', 'g');
    return (valor || '')
        .toString()
        .normalize('NFD').replace(SEM_ACENTO, '')
        .toUpperCase()
        .trim()
        .replace(/^PAV(ILHAO)?\.?\s*/, '')
        .trim();
}

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
        MIN(o.dtinimarcacao) as dtinimarcacao, 
        MIN(o.dtinimontagem) as dtinimontagem, 
        MIN(o.dtinirealizacao) as dtinirealizacao
    FROM orcamentos o
    JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
    JOIN eventos e ON e.idevento = o.idevento
    WHERE oe.idempresa = $1
        AND (o.dtinimarcacao >= CURRENT_DATE OR o.dtinirealizacao >= CURRENT_DATE)
    GROUP BY e.nmevento
    ORDER BY dtinimarcacao ASC`,
    [idempresa]
    );

    // Formatação para o Frontend entender as fases
    const respostaFormatada = eventos.map(ev => {
        return {
            nmevento: ev.nmevento,
            data: ev.dtinimarcacao || ev.dtinimontagem || ev.dtinirealizacao, 
            fases: {
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
    const ano = parseInt(req.query.ano, 10);
    const mes = parseInt(req.query.mes, 10);

    if (!idempresa) {
      return res.status(400).json({ error: "idempresa não fornecido" });
    }

    if (!ano || !mes) {
      return res.status(400).json({ error: "ano e mes são obrigatórios" });
    }

    const inicioMes = new Date(ano, mes - 1, 1);
    const fimMes = new Date(ano, mes, 0, 23, 59, 59, 999);

    const { rows: eventos } = await pool.query(
      `
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
          (o.dtiniinframontagem, o.dtfiminframontagem) OVERLAPS ($2::date, $3::date)
          OR (o.dtinimarcacao, o.dtfimmarcacao) OVERLAPS ($2::date, $3::date)
          OR (o.dtinimontagem, o.dtfimmontagem) OVERLAPS ($2::date, $3::date)
          OR (o.dtinirealizacao, o.dtfimrealizacao) OVERLAPS ($2::date, $3::date)
          OR (o.dtinidesmontagem, o.dtfimdesmontagem) OVERLAPS ($2::date, $3::date)
          OR (o.dtiniinfradesmontagem, o.dtfiminfradesmontagem) OVERLAPS ($2::date, $3::date)
        )
      ORDER BY COALESCE(o.dtinimarcacao, o.dtinimontagem, o.dtinirealizacao, o.dtinidesmontagem, o.dtiniinframontagem, o.dtiniinfradesmontagem) ASC
      `,
      [idempresa, inicioMes, fimMes]
    );

    const formatDate = (date) => {
      if (!date) return null;
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };

    const resposta = [];

    eventos.forEach((ev) => {
      const fasesConfig = [
        { tipo: "Montagem Infra", ini: ev.dtiniinframontagem, fim: ev.dtfiminframontagem },
        { tipo: "Marcação", ini: ev.dtinimarcacao, fim: ev.dtfimmarcacao },
        { tipo: "Montagem", ini: ev.dtinimontagem, fim: ev.dtfimmontagem },
        { tipo: "Realização", ini: ev.dtinirealizacao, fim: ev.dtfimrealizacao },
        { tipo: "Desmontagem", ini: ev.dtinidesmontagem, fim: ev.dtfimdesmontagem },
        { tipo: "Desmontagem Infra", ini: ev.dtiniinfradesmontagem, fim: ev.dtfiminfradesmontagem },
      ];

      fasesConfig.forEach((f) => {
        if (!f.ini) return;

        resposta.push({
          idevento: ev.idevento,
          nome: ev.nomenclatura ? `${ev.evento_nome} - ${ev.nomenclatura}` : ev.evento_nome,
          inicio: formatDate(f.ini),
          fim: formatDate(f.fim || f.ini),
          tipo: f.tipo
        });
      });
    });

    res.json({ eventos: resposta });
  } catch (err) {
    console.error("Erro em /eventos-calendario:", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

router.get("/export-eventos-calendario", async (req, res) => {
  try {
    const idempresa = req.headers.idempresa || req.query.idempresa;
    const ano = parseInt(req.query.ano, 10);
    const mes = parseInt(req.query.mes, 10);

    if (!idempresa) {
      return res.status(400).json({ error: "idempresa não fornecido" });
    }

    if (!ano || !mes) {
      return res.status(400).json({ error: "ano e mes são obrigatórios" });
    }

    const inicioMes = new Date(ano, mes - 1, 1);
    const fimMes = new Date(ano, mes, 0, 23, 59, 59, 999);

    const { rows: eventos } = await pool.query(
      `
      SELECT 
            e.idevento,
            e.nmevento AS evento_nome, -- Mantemos apenas o nome do evento
            
            -- Agregação das datas para consolidar o período total de todos os orçamentos do evento
            MIN(o.dtiniinframontagem) AS dtiniinframontagem, MAX(o.dtfiminframontagem) AS dtfiminframontagem,
            MIN(o.dtinimarcacao) AS dtinimarcacao, MAX(o.dtfimmarcacao) AS dtfimmarcacao,
            MIN(o.dtinimontagem) AS dtinimontagem, MAX(o.dtfimmontagem) AS dtfimmontagem,
            MIN(o.dtinirealizacao) AS dtinirealizacao, MAX(o.dtfimrealizacao) AS dtfimrealizacao,
            MIN(o.dtinidesmontagem) AS dtinidesmontagem, MAX(o.dtfimdesmontagem) AS dtfimdesmontagem,
            MIN(o.dtiniinfradesmontagem) AS dtiniinfradesmontagem, MAX(o.dtfiminfradesmontagem) AS dtfiminfradesmontagem
        FROM orcamentos o
        JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
        JOIN eventos e ON e.idevento = o.idevento
        WHERE oe.idempresa = $1
        AND o.status != 'R'
        AND (
            (o.dtiniinframontagem, o.dtfiminframontagem) OVERLAPS ($2::date, $3::date)
            OR (o.dtinimarcacao, o.dtfimmarcacao) OVERLAPS ($2::date, $3::date)
            OR (o.dtinimontagem, o.dtfimmontagem) OVERLAPS ($2::date, $3::date)
            OR (o.dtinirealizacao, o.dtfimrealizacao) OVERLAPS ($2::date, $3::date)
            OR (o.dtinidesmontagem, o.dtfimdesmontagem) OVERLAPS ($2::date, $3::date)
            OR (o.dtiniinfradesmontagem, o.dtfiminfradesmontagem) OVERLAPS ($2::date, $3::date)
        )
        GROUP BY e.idevento, e.nmevento
        ORDER BY COALESCE(
            MIN(o.dtinimarcacao), 
            MIN(o.dtinimontagem), 
            MIN(o.dtinirealizacao), 
            MIN(o.dtinidesmontagem), 
            MIN(o.dtiniinframontagem), 
            MIN(o.dtiniinfradesmontagem)
        ) ASC;
      `,
      [idempresa, inicioMes, fimMes]
    );

    const formatDate = (date) => {
      if (!date) return null;
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };

    const resposta = [];

    eventos.forEach((ev) => {
      const fasesConfig = [
        { tipo: "Montagem Infra", ini: ev.dtiniinframontagem, fim: ev.dtfiminframontagem },
        { tipo: "Marcação", ini: ev.dtinimarcacao, fim: ev.dtfimmarcacao },
        { tipo: "Montagem", ini: ev.dtinimontagem, fim: ev.dtfimmontagem },
        { tipo: "Realização", ini: ev.dtinirealizacao, fim: ev.dtfimrealizacao },
        { tipo: "Desmontagem", ini: ev.dtinidesmontagem, fim: ev.dtfimdesmontagem },
        { tipo: "Desmontagem Infra", ini: ev.dtiniinfradesmontagem, fim: ev.dtfiminfradesmontagem },
      ];

      fasesConfig.forEach((f) => {
        if (!f.ini) return;

        resposta.push({
          idevento: ev.idevento,
          nome: ev.nomenclatura ? `${ev.evento_nome} - ${ev.nomenclatura}` : ev.evento_nome,
          inicio: formatDate(f.ini),
          fim: formatDate(f.fim || f.ini),
          tipo: f.tipo
        });
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

// Lista enxuta de TODOS os eventos/edições (uma linha por orçamento) pra alimentar a busca da
// tela "Eventos em Aberto" — não recalcula vagas/staff (isso é caro), só o necessário pra localizar
// o evento e já deixar o filtro (Abertos/Encerrados + Anual/ano) apontando pro lugar certo.
// "Aberto"/"Encerrado" usa a mesma regra de /eventos-abertos: sem dtfimdesmontagem ainda no futuro.
router.get("/eventos-busca", async (req, res) => {
    try {
        const idempresa = req.headers.idempresa || req.query.idempresa;
        if (!idempresa) return res.status(400).json({ error: "idempresa não fornecido" });

        // nrorcamento entra no retorno porque o mesmo evento pode ter mais de um orçamento no
        // mesmo ano (ex: duas montagens/revisões diferentes) — sem isso, a busca mostraria
        // "Evento X (2026)" duas vezes de forma indistinguível.
        const { rows } = await pool.query(`
            SELECT 
            e.idevento,
            e.nmevento,
            EXTRACT(YEAR FROM o.dtinirealizacao)::int AS ano,
            STRING_AGG(o.idorcamento::text, ', ') AS idsorcamento,
            STRING_AGG(o.nrorcamento::text, ', ') AS nrosorcamento,
            BOOL_OR(o.dtfimdesmontagem IS NULL OR o.dtfimdesmontagem >= CURRENT_DATE) AS aberto
        FROM orcamentos o
        JOIN eventos e ON e.idevento = o.idevento
        JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
        WHERE oe.idempresa = $1 AND o.status <> 'R'
        GROUP BY 
            e.idevento,
            e.nmevento,
            EXTRACT(YEAR FROM o.dtinirealizacao)
        ORDER BY 
            e.nmevento ASC, 
            ano DESC;
        `, [idempresa]);

        res.json(rows);
    } catch (err) {
        console.error("Erro em /eventos-busca:", err);
        res.status(500).json({ error: "Erro interno.", message: err.message });
    }
});

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
                -- 🚀 NOVA LÓGICA DO CACHE FECHADO NO TOTALIZADOR: 
                -- Se o cachefechado, a meta de diárias é o próprio campo qtddias.
                -- Se NÃO cachefechado, multiplica a quantidade de itens pelos dias.
                SUM(CASE 
                    WHEN i.cachefechado = true THEN i.qtddias
                    ELSE (i.qtditens * i.qtddias)
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
                        i2.qtditens, -- Enviado explicitamente para o front
                        i2.qtddias,   -- Enviado explicitamente para o front
                        CASE 
                            WHEN i2.cachefechado = true THEN i2.qtddias
                            ELSE (i2.qtditens * i2.qtddias)
                        END AS total_vagas,
                        bool_and(i2.cachefechado) as cache_fechado,
                        MAX(i2.qtddias) as qtddias,
                        COALESCE(i2.setor, '') AS setor
                    FROM orcamentoitens i2
                    JOIN funcao f2 ON f2.idfuncao = i2.idfuncao
                    JOIN equipe eq2 ON eq2.idequipe = f2.idequipe
                    JOIN orcamentos o2 ON o2.idorcamento = i2.idorcamento
                    WHERE o2.idevento = o.idevento AND i2.categoria = 'Produto(s)' AND o2.status <> 'R'
                    AND (o2.status = 'F' OR (o2.status IN ('P', 'E') AND o2.contratarstaff = true))
                    GROUP BY eq2.idequipe, eq2.nmequipe, i2.idfuncao, f2.descfuncao, i2.qtditens, i2.qtddias, i2.cachefechado, COALESCE(i2.setor, '')
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
            -- Consolida as diárias dobradas autorizadas por função alvo
            dobras_autorizadas AS (
                SELECT 
                    se.idevento,
                    (dobra->>'idfuncaodobra')::int AS idfuncao,
                    COUNT(*) AS qtd_dobras
                FROM staffeventos se,
                jsonb_array_elements(
                    CASE 
                        WHEN jsonb_typeof(se.dtdiariadobrada) = 'array' THEN se.dtdiariadobrada 
                        ELSE '[]'::jsonb 
                    END
                ) AS dobra
                WHERE (dobra->>'status') = 'Autorizado' 
                  AND (dobra->>'idfuncaodobra') IS NOT NULL 
                  AND (dobra->>'idfuncaodobra') <> 'null'
                  AND (dobra->>'data')::date BETWEEN $2 AND $3
                GROUP BY se.idevento, (dobra->>'idfuncaodobra')::int
            ),
            staff_por_funcao AS (
                SELECT 
                    se.idevento, 
                    se.idfuncao, 
                    COUNT(DISTINCT se.idstaff) AS preenchidas,
                    COUNT(DISTINCT CASE WHEN se.statusstaff = 'Pendente' THEN se.idstaff END) AS pendentes,
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
                        'cachefechado', (b->>'cache_fechado')::boolean,
                        --'preenchidas', COALESCE(spf.preenchidas, 0),
                        -- 🌟 SOMA: Vagas preenchidas originais + as diárias dobradas autorizadas consumidas nesta função
                        'preenchidas', COALESCE(spf.preenchidas, 0) + COALESCE(
                            (SELECT da.qtd_dobras FROM dobras_autorizadas da 
                             WHERE da.idevento = e.idevento AND da.idfuncao = (b->>'idfuncao')::int), 0
                        ),
                        'qtd_pendente', COALESCE(spf.pendentes, 0),
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
                if (!acc[nomeEquipe]) acc[nomeEquipe] = { total: 0, preenchido: 0, pendentes: 0 };
                acc[nomeEquipe].total += (func.total_vagas || 0);
                acc[nomeEquipe].preenchido += (func.preenchidas || 0);
                acc[nomeEquipe].pendentes += (func.qtd_pendente || 0);
                return acc;
            }, {});

            const resumoFormatado = Object.entries(resumoEquipesMap).map(([equipe, dados]) => {
                const confirmadosReal = dados.preenchido - dados.pendentes;
                const restante = dados.total - confirmadosReal;
                //const restante = dados.total - dados.preenchido;
                let cor = "🟢"; 
                if (dados.total === 0) cor = "⚪"; 
                else if (dados.preenchido === 0) cor = "🔴"; 
                else if (restante > 0) cor = "🟡"; 
                //return `${equipe}: ${cor} ${dados.preenchido}/${dados.total}`;

                // Exibe: Equipe: 🟢 2/2 (+1 ⏳)
                let texto = `${equipe}: ${cor} ${confirmadosReal}/${dados.total}`;
                if (dados.pendentes > 0) texto += ` (+${dados.pendentes} ⏳)`;
                return texto;

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
                            MAX(i2.periododiariasfim) AS dtfim_vaga,
                            COALESCE(i2.setor, '') AS setor
                        FROM orcamentoitens i2
                        JOIN funcao f2 ON f2.idfuncao = i2.idfuncao
                        JOIN equipe eq2 ON eq2.idequipe = f2.idequipe
                        JOIN orcamentos o2 ON o2.idorcamento = i2.idorcamento
                        WHERE o2.idevento = o.idevento AND i2.categoria = 'Produto(s)' 
                        GROUP BY eq2.idequipe, eq2.nmequipe, i2.idfuncao, f2.descfuncao, COALESCE(i2.setor, '')
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
    const idmontagem = req.query.idmontagem ? Number(req.query.idmontagem) : null;

    if (!idevento || !idempresa) {
      return res.status(400).json({ error: "Parâmetros 'idevento' e 'idempresa' são obrigatórios." });
    }

    // 1️⃣ Busca Orçamentos
    const { rows: orcamentos } = await pool.query(
      `SELECT o.idorcamento, o.status, o.idcliente, o.idmontagem
        FROM orcamentos o
        JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
        WHERE o.idevento = $1 AND oe.idempresa = $2 AND EXTRACT(YEAR FROM o.dtinirealizacao) = $3
          AND ($4::int IS NULL OR o.idmontagem = $4)
          AND o.status <> 'R'
        ORDER BY o.dtinirealizacao DESC;`,
      [idevento, idempresa, ano, idmontagem]
    );

    if (!orcamentos.length) return res.status(200).json({ equipes: [] });

    const idsOrcamentos = orcamentos.map(o => o.idorcamento);
    const idclienteOrc = orcamentos[0].idcliente;
    const idmontagemOrc = orcamentos[0].idmontagem;

    // 2️⃣ Busca Vagas (Ajuste na sintaxe do CASE)
    const { rows: itensOrcamento } = await pool.query(
        `SELECT f.idequipe, eq.nmequipe AS equipe, i.idfuncao, f.descfuncao AS funcao,
          COALESCE(i.setor, '') AS setor_orcamento,
          SUM(i.qtditens) AS qtd_orcamento,
          MAX(i.qtddias) AS qtddias_orcamento,
          SUM(i.qtditens * i.qtddias) AS total_diarias_orcadas,
          MIN(i.periododiariasinicio) AS dtini_vaga,
          MAX(i.periododiariasfim) AS dtfim_vaga,
          bool_or(i.cachefechado = true) as tem_cache_fechado,
          i.idorcamento,
          o.contratarstaff,
          bool_and(COALESCE(i.liberarcontratacao, true)) AS liberarcontratacao,
          COALESCE(SUM(CASE
            WHEN i.adicional = true AND COALESCE(i.vlrdiaria, 0) = 0
            THEN 0 ELSE i.totgeralitem END), 0) AS vlr_orcado_item,
          COALESCE(SUM(CASE
            WHEN i.adicional = true AND COALESCE(i.vlrdiaria, 0) = 0
            THEN i.totgeralitem ELSE 0 END), 0) AS vlr_bonificado_item,
          MAX(i.vlrdiaria) AS vlrdiaria,
          MAX(i.vlrajdctoalimentacao) AS vlrajdctoalimentacao,
          MAX(i.vlrajdctotransporte) AS vlrajdctotransporte
        FROM orcamentoitens i
        JOIN funcao f ON f.idfuncao = i.idfuncao
        JOIN equipe eq ON eq.idequipe = f.idequipe
        JOIN orcamentos o ON o.idorcamento = i.idorcamento
        WHERE i.idorcamento = ANY($1) AND i.categoria = 'Produto(s)'
        GROUP BY f.idequipe, eq.nmequipe, i.idfuncao, f.descfuncao, i.setor, i.idorcamento, o.contratarstaff`,
        [idsOrcamentos]
    );
    // trecho original
    // 3️⃣ Busca Realizado (Adicionada vírgula e diarias_consumidas)
    // const { rows: staffCount } = await pool.query(
    //   `SELECT se.idfuncao, 
    //           COALESCE(NULLIF(se.pavilhao, ''), se.setor, '') AS localizacao,
    //           COUNT(DISTINCT se.idstaff) AS qtd_cadastrada_pessoas,
    //           SUM(jsonb_array_length(se.datasevento)) AS diarias_consumidas
    //    FROM staffeventos se
    //    WHERE se.idevento = $1 
    //      AND se.idcliente = $2
    //      AND EXISTS (
    //          SELECT 1 FROM jsonb_array_elements_text(se.datasevento) AS d(dt)
    //          WHERE EXTRACT(YEAR FROM (d.dt)::date) = $3
    //      )
    //    GROUP BY se.idfuncao, localizacao`,
    //   [idevento, idcliente, ano]
    // );
    

    // const { rows: staffCount } = await pool.query(
    //   `SELECT se.idfuncao, 
    //           COALESCE(NULLIF(se.pavilhao, ''), se.setor, '') AS localizacao,
    //           COUNT(DISTINCT se.idstaff) AS qtd_cadastrada_pessoas,
    //           -- ✅ Conta quantos são pendentes
    //           COUNT(DISTINCT CASE WHEN se.statusstaff = 'Pendente' THEN se.idstaff END) AS qtd_pendente,
    //           SUM(jsonb_array_length(se.datasevento)) AS diarias_consumidas
    //    FROM staffeventos se
    //    WHERE se.idevento = $1 
    //      AND se.idcliente = $2
    //      AND EXISTS (
    //          SELECT 1 FROM jsonb_array_elements_text(se.datasevento) AS d(dt)
    //          WHERE EXTRACT(YEAR FROM (d.dt)::date) = $3
    //      )
    //    GROUP BY se.idfuncao, localizacao`,
    //   [idevento, idcliente, ano]
    // );

    // 3️⃣ Busca Realizado - Lógica de Status Ativo vs Outros
    // const { rows: staffCount } = await pool.query(
    //     `SELECT se.idfuncao, se.idorcamento,
    //             COALESCE(NULLIF(se.pavilhao, ''), se.setor, '') AS localizacao,
    //             -- ✅ Conta APENAS quem está Ativo para bater com o orçamento
    //             --COUNT(DISTINCT CASE WHEN se.statusstaff = 'Ativo' THEN se.idstaff END) AS qtd_cadastrada_pessoas,
    //             COUNT(DISTINCT CASE 
    //                 WHEN se.statusstaff IN ('Ativo', 'Pendente') THEN se.idstaff 
    //             END) AS qtd_cadastrada_pessoas,
    //             -- ✅ Conta quantos são pendentes (para exibição visual apenas)
    //             COUNT(DISTINCT CASE WHEN se.statusstaff = 'Pendente' THEN se.idstaff END) AS qtd_pendente,
    //             -- ✅ Diárias consumidas também devem considerar apenas os Ativos para o cálculo de Cache Fechado?
    //             -- Se sim, usamos a lógica abaixo:
    //             --SUM(CASE WHEN se.statusstaff = 'Ativo' THEN jsonb_array_length(se.datasevento) ELSE 0 END) AS diarias_consumidas
    //             SUM(CASE 
    //                 WHEN se.statusstaff IN ('Ativo', 'Pendente') THEN jsonb_array_length(se.datasevento) 
    //                 ELSE 0 
    //             END)
    //                 +
    //             -- ✅ Soma as diárias dobradas com status Pendente ou Autorizado
    //             COALESCE(SUM(CASE 
    //                 WHEN se.statusstaff IN ('Ativo', 'Pendente') THEN (
    //                     SELECT COUNT(*)
    //                     FROM jsonb_array_elements(se.dtdiariadobrada) AS dd
    //                     WHERE (dd->>'status') IN ('Pendente', 'Autorizado')
    //                 )
    //                 ELSE 0 
    //             END), 0) AS diarias_consumidas
    //     FROM staffeventos se
    //     WHERE se.idevento = $1 
    //         AND se.idcliente = $2
    //         AND se.statusstaff NOT IN ('Inativo', 'Deletado')
    //         AND EXISTS (
    //             SELECT 1 FROM jsonb_array_elements_text(se.datasevento) AS d(dt)
    //             WHERE EXTRACT(YEAR FROM (d.dt)::date) = $3
    //         )
    //     GROUP BY se.idfuncao, localizacao, se.idorcamento`,
    //     [idevento, idcliente, ano]
    // );

    // 3️⃣ Busca Realizado - Lógica de Status Ativo vs Outros (Atualizada com Diárias Dobradas por dia)
    const { rows: staffCount } = await pool.query(
        `WITH dias_ocupados AS (
            -- Subquery A: Pega as diárias normais dos funcionários ativos/pendentes
            SELECT 
                se.idfuncao, 
                se.idorcamento,
                COALESCE(NULLIF(se.pavilhao, ''), se.setor, '') AS localizacao,
                se.idstaff,
                se.statusstaff,
                d.dt::date AS data_trabalho,
                'NORMAL' AS tipo_registro,
                NULL::text AS status_dobra -- 🚀 Alinhamento obrigatório para o UNION ALL
            FROM staffeventos se
            CROSS JOIN LATERAL jsonb_array_elements_text(se.datasevento) AS d(dt)
            WHERE se.idevento = $1 
            AND se.idcliente = $2
            AND se.statusstaff IN ('Ativo', 'Pendente')
            AND NOT EXISTS (
                SELECT 1 FROM jsonb_array_elements(
                    CASE WHEN jsonb_typeof(se.vagasreaproveitadas) = 'array' 
                        THEN se.vagasreaproveitadas ELSE '[]'::jsonb END
                ) AS vr
                WHERE (vr->>'data') = d.dt
            )

            UNION ALL

            -- Subquery B: Adiciona as Diárias Dobradas Pendentes ou Autorizadas
            SELECT 
                CASE 
                    WHEN jsonb_typeof(dd.item) = 'object' AND (dd.item->>'idfuncaodobra') IS NOT NULL 
                    THEN (dd.item->>'idfuncaodobra')::int
                    ELSE se.idfuncao
                END AS idfuncao,
                CASE 
                    WHEN jsonb_typeof(dd.item) = 'object' AND (dd.item->>'idorcamento') IS NOT NULL 
                    THEN (dd.item->>'idorcamento')::int
                    ELSE se.idorcamento
                END AS idorcamento,
                CASE
                    WHEN jsonb_typeof(dd.item) = 'object' AND TRIM(COALESCE(dd.item->>'setordobra', '')) <> ''
                    THEN TRIM(dd.item->>'setordobra')
                    ELSE COALESCE(NULLIF(se.pavilhao, ''), se.setor, '')
                END AS localizacao,
                se.idstaff,
                se.statusstaff,
                CASE
                    WHEN jsonb_typeof(dd.item) = 'object' THEN (dd.item->>'data')::date
                    ELSE dd.item::text::date
                END AS data_trabalho,
                'DOBRA' AS tipo_registro,
                CASE 
                    WHEN jsonb_typeof(dd.item) = 'object' THEN COALESCE(dd.item->>'status', 'Pendente')
                    ELSE 'Pendente'
                END AS status_dobra
            FROM staffeventos se
            CROSS JOIN LATERAL jsonb_array_elements(se.dtdiariadobrada) AS dd(item)
            WHERE se.idevento = $1 
            AND se.idcliente = $2
            AND se.statusstaff IN ('Ativo', 'Pendente')
            AND (
                jsonb_typeof(dd.item) <> 'object' 
                OR (dd.item->>'status') IN ('Pendente', 'Autorizado')
            )

            UNION ALL

            -- Subquery C: Vagas Reaproveitadas — credita no orçamento/função de origem
            SELECT 
                (vr->>'idfuncao_origem')::int AS idfuncao,
                (vr->>'idorcamento_origem')::int AS idorcamento,
                COALESCE(NULLIF(TRIM(vr->>'setor_origem'), ''), '') AS localizacao,
                se.idstaff,
                se.statusstaff,
                (vr->>'data')::date AS data_trabalho,
                'REAPROVEITADA' AS tipo_registro,
                NULL::text AS status_dobra
            FROM staffeventos se
            CROSS JOIN LATERAL jsonb_array_elements(
                CASE 
                    WHEN jsonb_typeof(se.vagasreaproveitadas) = 'array' THEN se.vagasreaproveitadas
                    ELSE '[]'::jsonb
                END
            ) AS vr
            WHERE se.idevento = $1
            AND se.idcliente = $2
            AND se.statusstaff IN ('Ativo', 'Pendente')
            AND (vr->>'idfuncao_origem') IS NOT NULL
        ),
        pico_por_dia AS (
            -- Descobre quantas pessoas/vagas estão ocupadas em cada dia do evento
            SELECT 
                idfuncao, 
                idorcamento, 
                localizacao,
                data_trabalho,
                COUNT(DISTINCT idstaff) AS total_pessoas_no_dia,
                COUNT(DISTINCT CASE WHEN statusstaff = 'Pendente' THEN idstaff END) AS total_pendente_no_dia
            FROM dias_ocupados
            GROUP BY idfuncao, idorcamento, localizacao, data_trabalho
        )
        -- Agrupa tudo de volta para o formato esperado pelo seu front-end (SELECT único e corrigido)
        SELECT 
            d_oc.idfuncao, 
            d_oc.idorcamento, 
            d_oc.localizacao,
            COUNT(DISTINCT d_oc.idstaff) AS qtd_cadastrada_pessoas,
            COALESCE(MAX(p_dia.total_pendente_no_dia), 0) AS qtd_pendente,
           COUNT(*) FILTER (
                WHERE d_oc.tipo_registro = 'NORMAL' 
                OR (d_oc.tipo_registro = 'DOBRA' AND d_oc.status_dobra = 'Autorizado')
                OR d_oc.tipo_registro = 'REAPROVEITADA'
            ) AS diarias_consumidas,
            
            -- Conta as dobras pendentes
            COUNT(*) FILTER (WHERE d_oc.tipo_registro = 'DOBRA' AND d_oc.status_dobra = 'Pendente') AS dobras_pendentes,
            
            -- Conta as dobras autorizadas
            COUNT(*) FILTER (WHERE d_oc.tipo_registro = 'DOBRA' AND d_oc.status_dobra = 'Autorizado') AS dobras_autorizadas

        FROM dias_ocupados d_oc
        LEFT JOIN pico_por_dia p_dia 
        ON d_oc.idfuncao = p_dia.idfuncao 
        AND d_oc.idorcamento = p_dia.idorcamento 
        AND d_oc.localizacao = p_dia.localizacao 
        AND d_oc.data_trabalho = p_dia.data_trabalho
        WHERE EXTRACT(YEAR FROM d_oc.data_trabalho) = $3
        GROUP BY d_oc.idfuncao, d_oc.idorcamento, d_oc.localizacao`,
        [idevento, idclienteOrc, ano]
    );

 // 🛑 PAUSE FORÇADO AQUI:
   // console.log("\n\n##################################################");
  //  console.log("              DADOS DO STAFFCOUNT                 ");
   // console.log("##################################################\n");
    
   // console.dir(staffCount, { depth: null });
    
   // console.log("\n##################################################");
    
    // Isso vai parar o Node.js imediatamente para o terminal não correr:
    //throw new Error("🛑 PAUSE MANUAL: Analise o objeto acima no terminal.");

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
      [idevento, ano, idclienteOrc]
    );

    const datasStaffMap = datasStaffRaw.reduce((acc, row) => {
      const key = `${row.idfuncao}_${normalizarSetorPavilhao(row.localizacao)}`;
      acc[key] = row.datas_staff;
      return acc;
    }, {});

    // 5️⃣-A Gasto financeiro por equipe (Parte A: diárias normais + benefícios)
    // Filtra pelos mesmos orçamentos do orcado para evitar que staffeventos de outras
    // montagens/orçamentos do mesmo evento inflem o gasto e causem falso "Limite Excedido"
    const { rows: gastoEquipeRows } = await pool.query(
        `SELECT f.idequipe,
                COALESCE(SUM(
                    se.vlrtotcache
                    + COALESCE(se.vlrtotajdcusto, 0)
                    + COALESCE(se.vlrajustecusto, 0)
                ), 0) AS vlr_gasto_equipe
         FROM staffeventos se
         JOIN funcao f ON f.idfuncao = se.idfuncao
         WHERE se.idevento = $1
           AND se.idcliente = $2
           AND se.idorcamento = ANY($3)
           AND se.ativo = true
           AND se.statusstaff NOT IN ('Inativo', 'Deletado')
         GROUP BY f.idequipe`,
        [idevento, idclienteOrc, idsOrcamentos]
    );
    const gastoEquipeMap = gastoEquipeRows.reduce((acc, row) => {
        acc[Number(row.idequipe)] = Number(row.vlr_gasto_equipe || 0);
        return acc;
    }, {});

    // 5️⃣-B Vagas reaproveitadas por função de origem → função destino (com setor e orcamento)
    const { rows: reaproveitadasRows } = await pool.query(`
        SELECT
            (vr->>'idfuncao_origem')::int                                          AS idfuncao_origem,
            UPPER(TRIM(COALESCE(vr->>'setor_origem', '')))                         AS setor_origem,
            COALESCE((vr->>'idorcamento_origem')::int, 0)                          AS idorcamento_origem,
            se.idfuncao                                                            AS idfuncao_destino,
            UPPER(TRIM(COALESCE(NULLIF(se.pavilhao, ''), se.setor, '')))           AS setor_destino,
            se.idorcamento                                                         AS idorcamento_destino,
            fn.descfuncao                                                          AS nome_funcao_destino,
            COUNT(*)                                                               AS qtd
        FROM staffeventos se
        CROSS JOIN LATERAL jsonb_array_elements(
            CASE WHEN jsonb_typeof(se.vagasreaproveitadas) = 'array'
                 THEN se.vagasreaproveitadas ELSE '[]'::jsonb END
        ) AS vr
        JOIN funcao fn ON fn.idfuncao = se.idfuncao
        WHERE se.idevento = $1
          AND se.idcliente = $2
          AND se.statusstaff IN ('Ativo', 'Pendente')
          AND (vr->>'idfuncao_origem') IS NOT NULL
          AND COALESCE(vr->>'status', 'Pendente') <> 'Rejeitado'
        GROUP BY
            (vr->>'idfuncao_origem')::int,
            UPPER(TRIM(COALESCE(vr->>'setor_origem', ''))),
            COALESCE((vr->>'idorcamento_origem')::int, 0),
            se.idfuncao,
            UPPER(TRIM(COALESCE(NULLIF(se.pavilhao, ''), se.setor, ''))),
            se.idorcamento,
            fn.descfuncao
    `, [idevento, idclienteOrc]);

    // Map: "idfuncao_origem_SETOR_ORIGEM_idorcamento_origem" → [{...destino}]
    // Ignora quando origem e destino são a mesma linha de orçamento (data fora do período no mesmo item)
    const reaproveitadasMap = {};
    for (const r of reaproveitadasRows) {
        const setorOrigemNorm  = normalizarSetorPavilhao(r.setor_origem);
        const setorDestinoNorm = normalizarSetorPavilhao(r.setor_destino);
        const isSelf = Number(r.idfuncao_origem)    === Number(r.idfuncao_destino)
                    && setorOrigemNorm                === setorDestinoNorm
                    && Number(r.idorcamento_origem)  === Number(r.idorcamento_destino);
        if (isSelf) continue;

        const key = `${Number(r.idfuncao_origem)}_${setorOrigemNorm}_${Number(r.idorcamento_origem)}`;
        if (!reaproveitadasMap[key]) reaproveitadasMap[key] = [];
        const isSameFuncao    = Number(r.idfuncao_origem) === Number(r.idfuncao_destino);
        const isSameSetor     = setorOrigemNorm === setorDestinoNorm;
        const isDiffOrcamento = Number(r.idorcamento_origem) !== Number(r.idorcamento_destino);
        const labelDestino = (isSameFuncao && isSameSetor && isDiffOrcamento)
            ? `${r.nome_funcao_destino} (outro orçamento)`
            : r.setor_destino
                ? `${r.nome_funcao_destino} (${r.setor_destino})`
                : `${r.nome_funcao_destino} (sem setor)`;
        reaproveitadasMap[key].push({
            idfuncao_destino: Number(r.idfuncao_destino),
            setor_destino: r.setor_destino,
            nome_funcao_destino: labelDestino,
            qtd: Number(r.qtd)
        });
    }

    // 5️⃣-C Solicitações de aditivo pendentes por função/orçamento/SETOR — precisa do setor (via join
    // com staffeventos, já que solicitacoes não guarda essa coluna), senão a mesma contagem é
    // replicada em toda variação de setor da função (PAV 1, PAV 2, CERTIFICADO etc.), que é o bug
    // relatado: a solicitação é de UM staffevento específico, não da função inteira.
    const { rows: aditivosPendentesRows } = await pool.query(`
        SELECT
            sol.idfuncao,
            sol.idorcamento,
            UPPER(TRIM(COALESCE(NULLIF(se.pavilhao, ''), se.setor, ''))) AS setor_solicitacao,
            COUNT(DISTINCT sol.idregistroalterado) AS qtd_aditivo_pendente,
            COUNT(DISTINCT CASE WHEN sol.tiposolicitacao ILIKE '%Limite Excedido%' THEN sol.idregistroalterado END) AS qtd_limite_pendente
        FROM solicitacoes sol
        LEFT JOIN staffeventos se ON se.idstaffevento = sol.idregistroalterado
        WHERE sol.idorcamento = ANY($1::int[])
          AND sol.idempresa = $2
          AND sol.categoria_log = 'aditivoextra'
          AND sol.status = 'Pendente'
          AND (sol.tiposolicitacao ILIKE '%Aditivo%' OR sol.tiposolicitacao ILIKE '%Bonificado%')
        GROUP BY sol.idfuncao, sol.idorcamento, UPPER(TRIM(COALESCE(NULLIF(se.pavilhao, ''), se.setor, '')))
    `, [idsOrcamentos, idempresa]);

    const aditivosPendentesMap = aditivosPendentesRows.reduce((acc, row) => {
        const key = `${Number(row.idfuncao)}_${Number(row.idorcamento)}_${normalizarSetorPavilhao(row.setor_solicitacao)}`;
        acc[key] = {
            qtd: Number(row.qtd_aditivo_pendente || 0),
            qtd_limite: Number(row.qtd_limite_pendente || 0)
        };
        return acc;
    }, {});

    // 5️⃣-C-bis Aditivos já Autorizados mas ainda não incluídos nos itens do orçamento — enquanto
    // isso não acontece, o staffevento continua com statusstaff='Pendente' (por isso ainda soma em
    // qtd_pendente), mas a solicitação em si já foi decidida — não é mais "aguardando autorização".
    // Também precisa do setor, pelo mesmo motivo do bloco de aditivos pendentes acima.
    const { rows: aguardandoInclusaoRows } = await pool.query(`
        SELECT
            sol.idfuncao,
            sol.idorcamento,
            UPPER(TRIM(COALESCE(NULLIF(se.pavilhao, ''), se.setor, ''))) AS setor_solicitacao,
            COUNT(DISTINCT sol.idregistroalterado) AS qtd_aguardando_inclusao
        FROM solicitacoes sol
        LEFT JOIN staffeventos se ON se.idstaffevento = sol.idregistroalterado
        WHERE sol.idorcamento = ANY($1::int[])
          AND sol.idempresa = $2
          AND sol.categoria_log = 'aditivoextra'
          AND sol.status = 'Autorizado'
          AND (sol.tiposolicitacao ILIKE '%Aditivo%' OR sol.tiposolicitacao ILIKE '%Bonificado%')
          AND NOT EXISTS (
              SELECT 1 FROM orcamentoitens oi WHERE sol.idsolicitacao = ANY(oi.idsolicitacao)
          )
        GROUP BY sol.idfuncao, sol.idorcamento, UPPER(TRIM(COALESCE(NULLIF(se.pavilhao, ''), se.setor, '')))
    `, [idsOrcamentos, idempresa]);

    const aguardandoInclusaoMap = aguardandoInclusaoRows.reduce((acc, row) => {
        const key = `${Number(row.idfuncao)}_${Number(row.idorcamento)}_${normalizarSetorPavilhao(row.setor_solicitacao)}`;
        acc[key] = Number(row.qtd_aguardando_inclusao || 0);
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
          vlr_orcado_equipe: 0,
          vlr_bonificado_equipe: 0,
          funcoes: [],
        };
      }
      equipesMap[idequipeKey].vlr_orcado_equipe    += Number(item.vlr_orcado_item    || 0);
      equipesMap[idequipeKey].vlr_bonificado_equipe += Number(item.vlr_bonificado_item || 0);

      const setorNormalizado = normalizarSetorPavilhao(item.setor_orcamento);
      const cadastrado = staffCount.find(s =>
        String(s.idfuncao) === String(item.idfuncao) &&
        normalizarSetorPavilhao(s.localizacao) === setorNormalizado &&
        Number(s.idorcamento) === Number(item.idorcamento)
      );

      // --- LÓGICA DE TRANSIÇÃO ---
      // Se for cache fechado, pegamos a soma de diárias, senão a contagem de pessoas
      let qtd_cadastrada = 0;
      let qtd_pendente = 0;
      let diarias_consumidas = 0;
      let dobras_pendentes = 0;
      let dobras_autorizadas = 0;
     
    //   if (cadastrado) {
    //     qtd_cadastrada = item.tem_cache_fechado 
    //       ? Number(cadastrado.diarias_consumidas) 
    //       : Number(cadastrado.qtd_cadastrada_pessoas);

    //     diarias_consumidas = Number(cadastrado.diarias_consumidas) || 0;
    //     qtd_pendente = Number(cadastrado.qtd_pendente) || 0;
    //   }

    if (cadastrado) {
        qtd_cadastrada    = Number(cadastrado.qtd_cadastrada_pessoas) || 0;
        diarias_consumidas = Number(cadastrado.diarias_consumidas) || 0;
        qtd_pendente      = Number(cadastrado.qtd_pendente) || 0;
        dobras_pendentes   = Number(cadastrado.dobras_pendentes) || 0;
        dobras_autorizadas = Number(cadastrado.dobras_autorizadas) || 0;
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
        qtddias_orcamento: Number(item.qtddias_orcamento) || 1,
        total_diarias_orcadas: item.total_diarias_orcadas != null ? Number(item.total_diarias_orcadas) : null,
        qtd_cadastrada, // Agora reflete ou pessoas ou diárias
        diarias_consumidas,
        dobras_pendentes,
        dobras_autorizadas,
        qtd_pendente,
        concluido: qtd_cadastrada >= (Number(item.qtd_orcamento) || 0),
        dtini_vaga: item.dtini_vaga,
        dtfim_vaga: item.dtfim_vaga,
        datas_staff: datas_staff,
        tem_cache_fechado: item.tem_cache_fechado,
        contratarstaff: item.contratarstaff,
        liberarcontratacao: item.liberarcontratacao !== false,
        vagas_usadas_em: reaproveitadasMap[`${Number(item.idfuncao)}_${setorNormalizado}_${Number(item.idorcamento)}`] || [],
        qtd_aditivo_pendente: aditivosPendentesMap[`${Number(item.idfuncao)}_${Number(item.idorcamento)}_${setorNormalizado}`]?.qtd || 0,
        qtd_limite_pendente: aditivosPendentesMap[`${Number(item.idfuncao)}_${Number(item.idorcamento)}_${setorNormalizado}`]?.qtd_limite || 0,
        qtd_aguardando_inclusao: aguardandoInclusaoMap[`${Number(item.idfuncao)}_${Number(item.idorcamento)}_${setorNormalizado}`] || 0,
        vlrdiaria: parseFloat(item.vlrdiaria || 0),
        vlrajdctoalimentacao: parseFloat(item.vlrajdctoalimentacao || 0),
        vlrajdctotransporte: parseFloat(item.vlrajdctotransporte || 0)
      });
    }

    // Enriquece cada equipe com saldo financeiro
    for (const key of Object.keys(equipesMap)) {
      const vlrOrcado     = equipesMap[key].vlr_orcado_equipe;  // já exclui itens BONIFICADO
      const vlrGasto      = gastoEquipeMap[Number(key)] || 0;
      const vlrBonificado = equipesMap[key].vlr_bonificado_equipe || 0;  // apenas para exibição
      equipesMap[key].vlr_gasto_equipe      = vlrGasto;
      equipesMap[key].vlr_bonificado_equipe = vlrBonificado;
      equipesMap[key].saldo_fin_equipe      = vlrOrcado - vlrGasto;
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
        f.cpf AS cpf,
        se.nmfuncao AS funcao,
        se.vlrtotal,
        se.statuspgto AS status_pagamento,
        se.statuspgtoajdcto AS status_ajuda_custo,
        COALESCE(NULLIF(se.setor, ''), NULLIF(se.pavilhao, ''), '') AS setor,
        se.nivelexperiencia,
        se.statusstaff,
        se.datasevento AS datas,
        
        -- 🚀 Trazendo os dados da dobra que já estão na tabela de staff
        se.statusdiariadobrada,
        se.dtdiariadobrada
      FROM public.staffeventos se
      INNER JOIN orcamentoempresas oe ON oe.idorcamento = se.idorcamento
      LEFT JOIN public.funcionarios f ON f.idfuncionario = se.idfuncionario
      WHERE se.idevento = $1
        AND se.idequipe = $2
        AND oe.idempresa = $3
        AND se.statusstaff NOT IN ('Deletado', 'Inativado')
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

router.get("/orcamentos-busca", async (req, res) => {
    try {
        const idempresa = req.headers.idempresa || req.query.idempresa;
        if (!idempresa) return res.status(400).json({ error: "idempresa não fornecido" });

        // nrorcamento entra no retorno porque o mesmo evento pode ter mais de um orçamento no
        // mesmo ano (ex: duas montagens/revisões diferentes) — sem isso, a busca mostraria
        // "Evento X (2026)" duas vezes de forma indistinguível.
        const { rows } = await pool.query(`
            SELECT o.idorcamento, o.nrorcamento, e.idevento, e.nmevento,
                   EXTRACT(YEAR FROM o.dtinirealizacao)::int AS ano,
                   (o.dtfimdesmontagem IS NULL OR o.dtfimdesmontagem >= CURRENT_DATE) AS aberto
            FROM orcamentos o
            JOIN eventos e ON e.idevento = o.idevento
            JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
            WHERE oe.idempresa = $1 AND o.status <> 'R'
            ORDER BY e.nmevento ASC, o.dtinirealizacao DESC
        `, [idempresa]);

        res.json(rows);
    } catch (err) {
        console.error("Erro em /eventos-busca:", err);
        res.status(500).json({ error: "Erro interno.", message: err.message });
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

router.get('/notificacoes-financeiras', autenticarToken(), contextoEmpresa, async (req, res) => {
    try {
        const idempresa = req.idempresa;
        const idusuario = req.usuario?.idusuario;
        const statusBruto = req.query.status || 'todos';

        if (!idempresa) return res.status(400).json({ error: 'Empresa não identificada.' });

        const { rows: allPermissoes } = await pool.query(
            `SELECT modulo, master, supremo FROM permissoes WHERE idusuario = $1`,
            [idusuario]
        );

        const ehMasterStaff = allPermissoes.some(p => p.modulo === 'Staff' && p.master === true);
        const ehSupremoStaff = allPermissoes.some(p => p.modulo === 'Staff' && p.supremo === true);
        const podeVerTodos = ehMasterStaff || ehSupremoStaff;

        const params = [idempresa];
        let filtroStatus = '';

        if (statusBruto.toLowerCase() !== 'todos') {
            const statusFiltro = statusBruto.charAt(0).toUpperCase() + statusBruto.slice(1).toLowerCase();
            params.push(statusFiltro);
            filtroStatus += ` AND s.status = $${params.length}`;
        }

        if (!podeVerTodos) {
            params.push(idusuario);
            filtroStatus += ` AND s.idusuariosolicitante = $${params.length}`;
        }

        const queryBase = `
            SELECT 
                MIN(s.idsolicitacao)   AS id_log,
                s.idregistroalterado   AS idstaffevento,
                s.idusuariosolicitante AS idexecutor,
                fn.descfuncao          AS descfuncao,
                fn_orig.descfuncao     AS descfuncao_original,
                s.tiposolicitacao,
                (u.nome || ' ' || u.sobrenome)       AS nomesolicitante,
                (resp.nome || ' ' || resp.sobrenome) AS nomeaprovador,
                MAX(s.dtresposta)      AS datadecisao,
                f.nome                 AS nomefuncionario,
                e.nmevento             AS evento,
                se.datasevento,
                MIN(s.dtsolicitacao)   AS criado_em,
                s.categoria_log        AS categoria,
                s.chaveitem            AS chaveitem,
                s.status               AS status_atual,
                SUM(s.vlrsolicitado)   AS vlrsolicitado,
                MIN(s.justificativa)   AS desccaixinha,
                jsonb_agg(
                    jsonb_build_object('idsolicitacao', s.idsolicitacao,
                                       'data', s.dtsolicitada,
                                       'status', s.status,
                                       'justificativa', s.justificativa,
                                       'tiposolicitacao', s.tiposolicitacao)
                    ORDER BY s.dtsolicitada
                ) AS dtsolicitada_agrupada,
                COALESCE(o.dtfiminfradesmontagem, o.dtfimdesmontagem) AS dtfimrealizacao,
                s.idfuncionario        AS idusuarioalvo,
                se.vlralimentacao,
                se.vlrtransporte,
                se.vlrcache,
                se.dtdiariadobrada::text AS dtdiariadobrada,
                se.dtmeiadiaria::text    AS dtmeiadiaria,
                MIN(se.nmfuncao)        AS nmfuncao_destino,
                MIN(se.vagasreaproveitadas::text) AS vagasreaproveitadas_raw,
                COALESCE(MIN(s.idorcamento), MIN(se.idorcamento)) AS idorcamento_sol,
                COALESCE(MIN(fn_orig.idequipe), MIN(fn.idequipe)) AS idequipe_sol
            FROM public.solicitacoes s
            LEFT JOIN public.staffeventos se ON s.idregistroalterado = se.idstaffevento
            LEFT JOIN public.usuarios u      ON u.idusuario = s.idusuariosolicitante
            LEFT JOIN public.usuarios resp   ON resp.idusuario = s.idusuarioresponsavel
            LEFT JOIN public.funcionarios f  ON f.idfuncionario = s.idfuncionario
            LEFT JOIN public.orcamentos o    ON o.idorcamento = s.idorcamento
            LEFT JOIN public.eventos e       ON e.idevento = o.idevento
            LEFT JOIN public.funcao fn       ON fn.idfuncao = s.idfuncao
            LEFT JOIN public.funcao fn_orig  ON fn_orig.idfuncao = se.idfuncao
            WHERE s.idempresa = $1
            ${filtroStatus}
            GROUP BY
                s.idregistroalterado, s.idusuariosolicitante, fn.descfuncao, fn_orig.descfuncao, s.tiposolicitacao,
                u.nome, u.sobrenome, resp.nome, resp.sobrenome, f.nome, e.nmevento,
                se.datasevento, s.categoria_log, s.chaveitem, s.status, o.dtfiminfradesmontagem,
                o.dtfimdesmontagem, s.idfuncionario, se.vlralimentacao, se.vlrtransporte,
                se.vlrcache, se.dtdiariadobrada, se.dtmeiadiaria
            ORDER BY MIN(s.dtsolicitacao) DESC
        `;

        const { rows } = await pool.query(queryBase, params);

        // Enriquecimento FuncExcedido: descobre a OUTRA alocação ativa do funcionário que
        // realmente colide nas mesmas datas (evento/função "Já Contratado"). Sem isso o card
        // só tem o evento/função do próprio registro pendente (o "Sendo Solicitado") e acaba
        // repetindo essa mesma informação, sem nunca revelar contra o que ele está excedendo.
        const conflitoFuncExcedidoPorGrupo = new Map(); // idstaffevento (registro mestre) -> { evento, funcao }
        const linhasFuncExcedido = rows.filter(r => (r.tiposolicitacao || '').toLowerCase().includes('funcexcedido'));
        if (linhasFuncExcedido.length > 0) {
            const idsFuncionarios = [...new Set(linhasFuncExcedido.map(r => r.idusuarioalvo).filter(Boolean))];
            const idsStaffEventoExcluir = [...new Set(linhasFuncExcedido.map(r => r.idstaffevento).filter(Boolean))];
            try {
                const { rows: outrasAlocacoes } = await pool.query(`
                    SELECT se2.idstaffevento, se2.idfuncionario, se2.datasevento,
                           ev2.nmevento, fn2.descfuncao AS nmfuncao
                    FROM staffeventos se2
                    LEFT JOIN eventos ev2 ON ev2.idevento = se2.idevento
                    LEFT JOIN funcao fn2  ON fn2.idfuncao = se2.idfuncao
                    WHERE se2.idfuncionario = ANY($1::int[])
                      AND se2.idstaffevento <> ALL($2::int[])
                      AND se2.ativo = true
                `, [idsFuncionarios, idsStaffEventoExcluir]);

                linhasFuncExcedido.forEach(r => {
                    const datasExcedidas = new Set(
                        (r.dtsolicitada_agrupada || [])
                            .flatMap(sol => Array.isArray(sol.data) ? sol.data : [sol.data])
                            .filter(Boolean)
                            .map(d => String(d).substring(0, 10))
                    );
                    const conflito = outrasAlocacoes.find(oa => {
                        if (oa.idfuncionario !== r.idusuarioalvo) return false;
                        const datasOA = (Array.isArray(oa.datasevento) ? oa.datasevento : []).map(d => String(d).substring(0, 10));
                        return datasOA.some(d => datasExcedidas.has(d));
                    });
                    if (conflito) {
                        conflitoFuncExcedidoPorGrupo.set(r.idstaffevento, {
                            evento: conflito.nmevento || '',
                            funcao: conflito.nmfuncao || ''
                        });
                    }
                });
            } catch (errConflitoFuncExcedido) {
                console.error('⚠️ Erro ao buscar alocação conflitante do FuncExcedido:', errConflitoFuncExcedido);
            }
        }

        // Saldo financeiro por equipe — para Ajuste de Custo positivo e Extra Bonificado
        const saldoEquipeMap = new Map();
        const paresFinanceiros = new Set();
        rows.forEach(r => {
            if (r.categoria !== 'statuscaixinha' && r.idorcamento_sol && r.idequipe_sol) {
                paresFinanceiros.add(`${r.idorcamento_sol}|${r.idequipe_sol}`);
            }
        });
        if (paresFinanceiros.size > 0) {
            const idOrcs = [...new Set([...paresFinanceiros].map(p => parseInt(p.split('|')[0])))];
            const idEqs  = [...new Set([...paresFinanceiros].map(p => parseInt(p.split('|')[1])))];
            try {
                const { rows: saldoRows } = await pool.query(`
                    SELECT
                        oi.idorcamento,
                        f.idequipe,
                        COALESCE(SUM(oi.totgeralitem) FILTER (
                            WHERE oi.categoria = 'Produto(s)'
                              AND NOT (oi.adicional = true AND COALESCE(oi.vlrdiaria, 0) = 0)
                        ), 0) AS vlr_orcado,
                        COALESCE((
                            SELECT SUM(se2.vlrtotcache + COALESCE(se2.vlrtotajdcusto,0))
                            FROM staffeventos se2
                            JOIN funcao f2 ON se2.idfuncao = f2.idfuncao
                            WHERE se2.idorcamento = oi.idorcamento
                              AND f2.idequipe = f.idequipe
                              AND se2.ativo = true
                              AND se2.statusstaff NOT IN ('Inativo', 'Deletado', 'Pendente')
                        ), 0) AS vlr_gasto,
                        COALESCE((
                            SELECT SUM(sl.vlrsolicitado)
                            FROM solicitacoes sl
                            JOIN funcao f3 ON sl.idfuncao = f3.idfuncao
                            WHERE sl.idorcamento = oi.idorcamento
                              AND f3.idequipe = f.idequipe
                              AND sl.status = 'Pendente'
                              AND (
                                  sl.categoria_log = 'statusajustecusto'
                                  OR sl.categoria_log = 'statuscaixinha'
                                  OR (sl.categoria_log = 'aditivoextra' AND (
                                      sl.tiposolicitacao ILIKE '%BONIFICADO%'
                                      OR sl.tiposolicitacao ILIKE '%VAGA EXCEDIDA%'
                                      OR sl.tiposolicitacao = 'FUNCEXCEDIDO'
                                  ))
                              )
                        ), 0) AS vlr_pendente
                    FROM orcamentoitens oi
                    JOIN funcao f ON oi.idfuncao = f.idfuncao
                    WHERE oi.idorcamento = ANY($1::int[])
                      AND f.idequipe    = ANY($2::int[])
                    GROUP BY oi.idorcamento, f.idequipe
                `, [idOrcs, idEqs]);
                saldoRows.forEach(s => {
                    saldoEquipeMap.set(`${s.idorcamento}|${s.idequipe}`, {
                        vlr_orcado:   parseFloat(s.vlr_orcado)   || 0,
                        vlr_gasto:    parseFloat(s.vlr_gasto)    || 0,
                        vlr_pendente: parseFloat(s.vlr_pendente) || 0
                    });
                });
            } catch (errSaldo) {
                console.error('⚠️ Erro ao buscar saldo financeiro:', errSaldo);
            }
        }

        const parseValor = (v) => {
            if (!v) return 0;
            if (typeof v === 'number') return v;
            return parseFloat(String(v).replace(',', '.')) || 0;
        };

        let resultadoFinal = rows.map(r => {
            // 1. Determina a Categoria Única para evitar duplicidade no front
            // aditivoextra é o único valor salvo no BD para todos os subtipos de aditivo/bonificado.
            // statusvagaexcedida é o campo que o frontend sabe renderizar corretamente.
            // O tiposolicitacao distingue os subtipos dentro do card.
            const categoriaReal = r.categoria === 'aditivoextra' ? 'statusvagaexcedida' : r.categoria;
              
            // 2. Título formatado conforme sua regra
            const tituloExibicao = obterTituloFormatado(r);

            // 3. Montagem do valor formatado (o front espera isso em string JSON por causa do seu legado)
            const dadosFinanceiros = {
                status: r.status_atual,
                valor: parseValor(r.vlrsolicitado),
                descricao: r.desccaixinha,
                vlralimentacao: parseValor(r.vlralimentacao),
                vlrtransporte: parseValor(r.vlrtransporte),
                tipoSolicitacao: r.tiposolicitacao,
                titulo: tituloExibicao
            };
            const valorFormatado = JSON.stringify([dadosFinanceiros]);

            const getDiaria = () => r.dtsolicitada_agrupada ? JSON.stringify(r.dtsolicitada_agrupada) : null;

            // Extrai nome da função de origem e custo da diária do JSON vagasreaproveitadas
            let nmfuncaoOrigem = '';
            let vlrCacheJson = 0, vlrAlimJson = 0, vlrTranspJson = 0;
            if (r.vagasreaproveitadas_raw) {
                try {
                    const parsedVagas = JSON.parse(r.vagasreaproveitadas_raw);
                    if (Array.isArray(parsedVagas) && parsedVagas.length > 0) {
                        nmfuncaoOrigem = parsedVagas[0].nmfuncao_origem || '';
                        vlrCacheJson  = parseFloat(parsedVagas[0].vlr_cache_executado || 0);
                        vlrAlimJson   = parseFloat(parsedVagas[0].vlralimentacao || 0);
                        vlrTranspJson = parseFloat(parsedVagas[0].vlrtransporte   || 0);
                    }
                } catch(e) {}
            }

            // 4. Retorno do objeto limpo
            return {
                id_log: r.id_log,
                idpedido: r.id_log, // Importante: usar o mesmo ID único
                titulo_formatado: tituloExibicao,
                solicitante: r.idexecutor,
                nomeSolicitante: r.nomesolicitante || '',
                descFuncao: r.descfuncao || '',
                descFuncaoOriginal: r.descfuncao_original || '',
                nmfuncaoOrigem,
                nmfuncaoDestino: r.nmfuncao_destino || r.descfuncao_original || '',
                justificativaSolicitacao: r.desccaixinha || '',
                nomeAprovador: r.nomeaprovador || '',
                dataDecisao: r.datadecisao,
                funcionario: (categoriaReal === 'statusvagaexcedida' && r.tiposolicitacao !== 'FuncExcedido') ? null : (r.nomefuncionario || '-'),
                nomefuncionario: r.nomefuncionario,
                evento: r.evento || '-',
                dtCriacao: r.criado_em,
                dtsolicitada: r.dtsolicitada_agrupada,
                datasevento: r.datasevento || '-',
                dtfimrealizacao: r.dtfimrealizacao,
                ehMasterStaff,
                podeVerTodos,
                categoria: r.categoria,
                categoria_item: categoriaReal,
                status_aprovacao: r.status_atual.toLowerCase(),
                
                // Mapeamento dinâmico: apenas a categoria correspondente recebe o valor
                statuscaixinha: r.categoria === 'statuscaixinha' ? valorFormatado : null,
                statusajustecusto: r.categoria === 'statusajustecusto' ? valorFormatado : null,
                statuscustofechado: r.categoria === 'statuscustofechado' ? valorFormatado : null,
                statusdiariadobrada: r.categoria === 'statusdiariadobrada' ? getDiaria() : null,
                statusmeiadiaria: r.categoria === 'statusmeiadiaria' ? getDiaria() : null,
                statusaditivoextra: categoriaReal === 'statusaditivoextra' ? valorFormatado : null,
                statusvagaexcedida: categoriaReal === 'statusvagaexcedida' ? valorFormatado : null,
                statusvagasreaproveitadas: r.categoria === 'statusvagasreaproveitadas' ? getDiaria() : null,

                solicitacoes_individuais: (r.dtsolicitada_agrupada || []).map(sol => ({
                    idsolicitacao: sol.idsolicitacao,
                    data: Array.isArray(sol.data) ? sol.data : [sol.data],
                    status: sol.status,
                    justificativa: sol.justificativa || ''
                })),

                // Campos auxiliares para merge de combo FuncExcedido + Estouro Financeiro
                idstaffevento: r.idstaffevento,
                tiposolicitacao_raw: r.tiposolicitacao,

                // Evento/função onde o funcionário JÁ está contratado e que colide com esta
                // solicitação de FuncExcedido (distinto do evento/função "Sendo Solicitado"
                // acima, que é o próprio registro pendente).
                conflitoJaContratado: conflitoFuncExcedidoPorGrupo.get(r.idstaffevento) || null,

                // Custo por diária — staffevento direto ou fallback no JSON de vagasreaproveitadas
                vlrCacheSol:  parseFloat(r.vlrcache  || 0) || vlrCacheJson,
                vlrAlimSol:   parseFloat(r.vlralimentacao || 0) || vlrAlimJson,
                vlrTranspSol: parseFloat(r.vlrtransporte  || 0) || vlrTranspJson,

                // Detalhe por data do JSON vagasreaproveitadas: função origem + custo por dia
                vagasReaproveitadasDetalhes: (() => {
                    if (!r.vagasreaproveitadas_raw) return null;
                    try {
                        const parsed = JSON.parse(r.vagasreaproveitadas_raw);
                        if (!Array.isArray(parsed) || parsed.length === 0) return null;
                        return parsed.map(v => ({
                            data:               String(v.data || '').substring(0, 10),
                            nmfuncao_origem:    v.nmfuncao_origem    || '',
                            vlr_cache_executado: parseFloat(v.vlr_cache_executado || 0),
                            vlr_cache_origem:    parseFloat(v.vlr_cache_origem    || 0),
                            vlralimentacao:      v.vlralimentacao !== undefined ? parseFloat(v.vlralimentacao) : null,
                            vlrtransporte:       v.vlrtransporte  !== undefined ? parseFloat(v.vlrtransporte)  : null,
                            setor_origem:        v.setor_origem || '',
                        }));
                    } catch(e) { return null; }
                })(),

                // Dados financeiros da equipe (Master/Supremo)
                ...(() => {
                    const saldo = saldoEquipeMap.get(`${r.idorcamento_sol}|${r.idequipe_sol}`);
                    return {
                        vlrOrcadoEquipe:    saldo?.vlr_orcado   || 0,
                        vlrGastoEquipe:     saldo?.vlr_gasto    || 0,
                        vlrPendenteEquipe:  saldo?.vlr_pendente || 0
                    };
                })()
            };
        });

        // --- Merge de pares FuncExcedido + Estouro Financeiro em um único card ---
        // O GROUP BY da query base inclui s.status, então uma solicitação multi-data com
        // status misto (algumas datas Autorizadas, outras Pendentes) vira 2 linhas SQL pro
        // mesmo idstaffevento+tiposolicitacao — cada uma só com as datas daquele status.
        // Por isso, ao invés de sobrescrever o slot quando já existe um item ali, mescla os
        // dois (concatena as datas) — senão as datas do status-group anterior somem do card.
        const mesclarStatusGroups = (base, extra) => {
            const individuaisBase  = base.solicitacoes_individuais  || [];
            const individuaisExtra = extra.solicitacoes_individuais || [];
            const idsVistos = new Set(individuaisBase.map(s => s.idsolicitacao));
            const individuaisMerged = [
                ...individuaisBase,
                ...individuaisExtra.filter(s => !idsVistos.has(s.idsolicitacao))
            ];

            const dtsolicitadaBase  = base.dtsolicitada  || [];
            const dtsolicitadaExtra = extra.dtsolicitada || [];
            const idsDtVistos = new Set(dtsolicitadaBase.map(s => s.idsolicitacao));
            const dtsolicitadaMerged = [
                ...dtsolicitadaBase,
                ...dtsolicitadaExtra.filter(s => !idsDtVistos.has(s.idsolicitacao))
            ];

            const statusUnicos = new Set(individuaisMerged.map(s => (s.status || 'pendente').toLowerCase().trim()));
            const statusAgregado = statusUnicos.has('pendente')
                ? 'pendente'
                : (statusUnicos.size === 1 ? [...statusUnicos][0] : 'misto');

            return {
                ...base,
                id_log: Math.min(base.id_log, extra.id_log),
                // Guarda todos os id_log absorvidos nesta mesclagem — o dedupe abaixo
                // (comboLogIds) precisa remover TODAS as linhas originais do resultado
                // final, não só a de id_log menor.
                _idLogsMesclados: [...(base._idLogsMesclados || [base.id_log]), extra.id_log],
                solicitacoes_individuais: individuaisMerged,
                dtsolicitada: dtsolicitadaMerged,
                status_aprovacao: statusAgregado,
            };
        };

        // Config das combinações "Aditivo/Extra Bonificado + FuncExcedido" que viram
        // um único card. Cada entrada casa o(s) tipo(s) possíveis da Solicitação 1
        // (tipo1Variants) com o tipo fixo da Solicitação 2 (tipo2), agrupando por
        // idstaffevento — mesmo mecanismo pros dois pares, só a config muda.
        const combosConfig = [
            {
                tipo1Variants: ['Aditivo - Limite Financeiro da Equipe Excedido'],
                tipo2: 'FuncExcedido + Estouro Financeiro',
                comboFlag: 'isComboFuncExcedidoAditivo',
                categoriaItem: 'funcexcedido_estouro',
            },
            {
                tipo1Variants: ['Aditivo - Vaga Excedida', 'Extra Bonificado - Vaga Excedida'],
                tipo2: 'FuncExcedido + Vaga Excedida',
                comboFlag: 'isComboFuncExcedidoVaga',
                categoriaItem: 'funcexcedido_vagaexcedida',
            },
        ];

        combosConfig.forEach(({ tipo1Variants, tipo2, comboFlag, categoriaItem }) => {
            const comboByStaff = new Map();
            resultadoFinal.forEach(item => {
                const tipo = item.tiposolicitacao_raw;
                if (tipo1Variants.includes(tipo) || tipo === tipo2) {
                    if (!comboByStaff.has(item.idstaffevento)) {
                        comboByStaff.set(item.idstaffevento, { aditivoItem: null, funcExcItem: null });
                    }
                    const entry = comboByStaff.get(item.idstaffevento);
                    const slot = tipo1Variants.includes(tipo) ? 'aditivoItem' : 'funcExcItem';
                    entry[slot] = entry[slot] ? mesclarStatusGroups(entry[slot], item) : item;
                }
            });

            const comboPairs = new Map([...comboByStaff.entries()].filter(([, v]) => v.aditivoItem && v.funcExcItem));
            if (comboPairs.size > 0) {
                const comboLogIds = new Set();
                const comboMerged = [];
                comboPairs.forEach(({ aditivoItem, funcExcItem }) => {
                    (aditivoItem._idLogsMesclados || [aditivoItem.id_log]).forEach(id => comboLogIds.add(id));
                    (funcExcItem._idLogsMesclados || [funcExcItem.id_log]).forEach(id => comboLogIds.add(id));
                    comboMerged.push({
                        ...aditivoItem,
                        [comboFlag]: true,
                        // Distingue Aditivo x Extra Bonificado quando a Solicitação 1 admite os dois tipos.
                        isComboAditivoFuncVaga: (aditivoItem.tiposolicitacao_raw || '').toLowerCase().includes('aditivo'),
                        titulo_formatado: tipo2,
                        categoria_item: categoriaItem,
                        dadosAditivo: aditivoItem,
                        dadosFuncExcedido: funcExcItem,
                    });
                });
                resultadoFinal = [
                    ...resultadoFinal.filter(item => !comboLogIds.has(item.id_log)),
                    ...comboMerged
                ];
            }
        });

        // --- Merge de pares Extra Bonificado + Diária Dobrada em um único card ---
        const comboEDB = new Map();
        resultadoFinal.forEach(item => {
            const cat  = item.categoria || '';
            const tipo = (item.tiposolicitacao_raw || '').toLowerCase();
            if (cat === 'aditivoextra' && (tipo.includes('bonificado') || tipo.includes('aditivo'))) {
                if (!comboEDB.has(item.idstaffevento)) comboEDB.set(item.idstaffevento, { bonifItem: null, dobradaItem: null });
                const entry = comboEDB.get(item.idstaffevento);
                const novoStatus   = (item.status_aprovacao || '').toLowerCase();
                const atualStatus  = (entry.bonifItem?.status_aprovacao || 'autorizado').toLowerCase();
                // Preferir item Pendente: garante que aditivo/bonif já resolvido não sobreponha o pendente
                if (!entry.bonifItem || novoStatus === 'pendente' || atualStatus !== 'pendente') {
                    entry.bonifItem = item;
                }
            } else if (cat === 'statusdiariadobrada') {
                if (!comboEDB.has(item.idstaffevento)) comboEDB.set(item.idstaffevento, { bonifItem: null, dobradaItem: null });
                const entry = comboEDB.get(item.idstaffevento);
                const novoStatus  = (item.status_aprovacao || '').toLowerCase();
                const atualStatus = (entry.dobradaItem?.status_aprovacao || 'autorizado').toLowerCase();
                if (!entry.dobradaItem || novoStatus === 'pendente' || atualStatus !== 'pendente') {
                    entry.dobradaItem = item;
                }
            }
        });
        // Só forma o combo se as datas das duas solicitações realmente se relacionarem —
        // duas solicitações do mesmo staffevento podem ser totalmente independentes
        // (ex.: Aditivo pra um dia isolado + Diária Dobrada pra outros dias, sem nenhum
        // vínculo). Sem essa checagem, uma rejeição vira "cancelamento automático" de uma
        // Diária Dobrada que não tem nada a ver com o Aditivo/Bonificado.
        const extrairDatasItem = (item) => new Set(
            (item.solicitacoes_individuais || [])
                .flatMap(s => Array.isArray(s.data) ? s.data : [s.data])
                .filter(Boolean)
                .map(d => String(d).substring(0, 10))
        );
        const datasSeIntersectam = (a, b) => {
            const datasA = extrairDatasItem(a);
            for (const d of extrairDatasItem(b)) if (datasA.has(d)) return true;
            return false;
        };

        const comboPairsEDB = new Map([...comboEDB.entries()].filter(([, v]) =>
            v.bonifItem && v.dobradaItem && datasSeIntersectam(v.bonifItem, v.dobradaItem)
        ));
        if (comboPairsEDB.size > 0) {
            const comboLogIdsEDB = new Set();
            const comboMergedEDB = [];
            comboPairsEDB.forEach(({ bonifItem, dobradaItem }) => {
                comboLogIdsEDB.add(bonifItem.id_log);
                comboLogIdsEDB.add(dobradaItem.id_log);
                const tipoBonus = (bonifItem.tiposolicitacao_raw || '').toLowerCase();
                const isAditivo = tipoBonus.includes('aditivo') && !tipoBonus.includes('bonificado');
                comboMergedEDB.push({
                    ...bonifItem,
                    isComboExtraDobrada: true,
                    isComboAditivoDobrada: isAditivo,
                    titulo_formatado: isAditivo ? 'Aditivo + Diária Dobrada' : 'Extra Bonificado + Diária Dobrada',
                    categoria_item: 'extrabonificado_dobrada',
                    dadosBonificado: bonifItem,
                    dadosDobrada: dobradaItem,
                });
            });
            resultadoFinal = [
                ...resultadoFinal.filter(item => !comboLogIdsEDB.has(item.id_log)),
                ...comboMergedEDB
            ];
        }

        // console.log(`TOTAL ENVIADO PARA FRONT: ${resultadoFinal.length}, resultadoFinal:`, resultadoFinal);
        res.json(resultadoFinal);
       

    } catch (err) {
        console.error('ERRO:', err.message);
        res.status(500).json({ error: 'Erro interno' });
    }
});

// 1. Coloque a função auxiliar fora da rota
const obterTituloFormatado = (r) => {
    if ((r.tiposolicitacao || '').toUpperCase() === 'FUNCEXCEDIDO') return "Funcionário Excedido";

    let natureza = "";
    const categoria = (r.categoria || "").toLowerCase();
    const tipo = (r.tiposolicitacao || "").toUpperCase();

    if (categoria === 'aditivoextra' || tipo.includes('ADITIVO')) {
        natureza = "Aditivo";
    } else if (tipo.includes('EXTRA') || tipo.includes('BONIFICADO')) {
        natureza = "Extra Bonificado";
    }

    let motivo = (tipo.includes('VAGA EXCEDIDA') || tipo.includes('VAGA')) 
        ? "Vaga Excedida" 
        : "Datas fora do Orçamento";

    return natureza && motivo ? `${natureza} - ${motivo}` : "Solicitação Financeira";
};



// Saldos de Inativação pendentes: solicitações soltas em `solicitacoes` (categoria_log =
// 'saldoinativacao') que não têm coluna correspondente em staffeventos, então ficam de fora
// do painel genérico de Pedidos e Solicitações (aquele é todo baseado em colunas do staffeventos).
router.get('/saldos-inativacao-pendentes', autenticarToken(), contextoEmpresa, async (req, res) => {
    try {
        const idempresa = req.idempresa;
        const { rows } = await pool.query(`
            SELECT s.idsolicitacao, s.idfuncionario, s.vlrsolicitado, s.justificativa, s.dtsolicitacao,
                   f.nome AS nomefuncionario, se.idevento, e.nmevento,
                   se.datasevento, caixinha_valor_autorizado(se.caixinha) AS vlrcaixinha,
                   se.vlrtotcache, se.vlrtotajdcusto,
                   se.statuspgto, se.statuspgtoajdcto, se.statuspgtocaixinha AS statuscaixinha
            FROM solicitacoes s
            LEFT JOIN funcionarios f ON f.idfuncionario = s.idfuncionario
            LEFT JOIN staffeventos se ON se.idstaffevento = s.idregistroalterado
            LEFT JOIN eventos e ON e.idevento = se.idevento
            WHERE s.categoria_log = 'saldoinativacao' AND s.status = 'Pendente' AND s.idempresa = $1
            ORDER BY s.dtsolicitacao DESC
        `, [idempresa]);
        res.json({ itens: rows });
    } catch (e) {
        console.error('❌ Erro em /saldos-inativacao-pendentes:', e);
        res.status(500).json({ error: e.message });
    }
});

router.post('/notificacoes-financeiras/atualizar-status',
    autenticarToken(),
    contextoEmpresa,
    logMiddleware('staffeventos', {
        buscarDadosAnteriores: async (req) => {
            const { idpedido } = req.body;
            if (!idpedido) return null;
            const { rows } = await pool.query(`
                SELECT * FROM staffeventos 
                WHERE idstaffevento = $1 
                OR idstaffevento = (SELECT idregistroalterado FROM solicitacoes WHERE idsolicitacao = $1 LIMIT 1)
            `, [idpedido]);
            return rows[0] ? { dadosanteriores: rows[0], idregistroalterado: rows[0].idstaffevento } : null;
        }
    }),
    async (req, res) => {
        try {
            let { idpedido, categoria, acao, data: dataEspecifica, idlog_origem } = req.body; 
            const idempresa = req.idempresa;
            const idUsuarioResponsavel = req.usuario?.idusuario;

            if (!idpedido || !categoria || !acao) return res.status(400).json({ error: 'Dados incompletos' });

            const statusParaAtualizar0 = acao.charAt(0).toUpperCase() + acao.slice(1).toLowerCase();

            // Saldo de Inativação: fluxo próprio, fora do mapeamento de colunas de staffeventos.
            // Autorizar exige que o financeiro tenha marcado quais dias (`diasTrabalhados`) o
            // funcionário de fato trabalhou — o crédito/débito é calculado aqui, com base nisso,
            // nunca confiando cegamente em nenhum valor pré-calculado na Inativação.
            // Rejeitar só encerra a solicitação, sem lançamento nenhum.
            if (categoria === 'saldoinativacao') {
                const { rows: solRows } = await pool.query(
                    `SELECT s.idsolicitacao, s.idfuncionario, s.idregistroalterado,
                            se.datasevento, se.vlrtotcache, se.vlrtotajdcusto,
                            caixinha_valor_autorizado(se.caixinha) AS vlrcaixinha,
                            se.statuspgto, se.statuspgtoajdcto, se.statuspgtocaixinha
                     FROM solicitacoes s
                     LEFT JOIN staffeventos se ON se.idstaffevento = s.idregistroalterado
                     WHERE s.idsolicitacao = $1 AND s.idempresa = $2 AND s.status = 'Pendente'`,
                    [idpedido, idempresa]
                );
                if (solRows.length === 0) {
                    return res.status(404).json({ error: 'Solicitação não encontrada ou já respondida.' });
                }
                const sol = solRows[0];

                await pool.query(
                    `UPDATE solicitacoes SET status = $1, idusuarioresponsavel = $2, dtresposta = NOW()
                     WHERE idsolicitacao = $3 AND idempresa = $4`,
                    [statusParaAtualizar0, idUsuarioResponsavel, idpedido, idempresa]
                );

                let idAjusteGerado = null;
                let tipoAjusteGerado = null;
                let valorAjusteGerado = null;

                if (statusParaAtualizar0 === 'Autorizado') {
                    const calcPagoBase = (status, amount) => {
                        if (!status || !String(status).toLowerCase().startsWith('pago')) return 0;
                        const match = String(status).match(/(\d+)/);
                        return match ? amount * (Number(match[1]) / 100) : amount;
                    };

                    const datasEvento = Array.isArray(sol.datasevento) ? sol.datasevento : [];
                    const totalDias = datasEvento.length;
                    const diasTrabalhadosRecebidos = Array.isArray(req.body.diasTrabalhados) ? req.body.diasTrabalhados : [];
                    // Só considera dias que de fato pertencem ao evento (evita contaminação por payload externo).
                    const qtdDiasTrabalhados = diasTrabalhadosRecebidos.filter(d => datasEvento.includes(d)).length;

                    const vlrTotCache = parseFloat(sol.vlrtotcache) || 0;
                    const vlrTotAjdCusto = parseFloat(sol.vlrtotajdcusto) || 0;
                    const vlrCaixinha = parseFloat(sol.vlrcaixinha) || 0;

                    const cachePorDia = totalDias > 0 ? vlrTotCache / totalDias : 0;
                    const ajudaPorDia = totalDias > 0 ? vlrTotAjdCusto / totalDias : 0;
                    // Caixinha é valor único do evento (não por dia): só devida se houve ao menos 1 dia trabalhado.
                    const caixinhaDevida = qtdDiasTrabalhados > 0 ? vlrCaixinha : 0;

                    const valorDevido = qtdDiasTrabalhados * (cachePorDia + ajudaPorDia) + caixinhaDevida;

                    const valorJaPago = calcPagoBase(sol.statuspgto, vlrTotCache)
                        + calcPagoBase(sol.statuspgtoajdcto, vlrTotAjdCusto)
                        + calcPagoBase(sol.statuspgtocaixinha, vlrCaixinha);

                    // > 0: empresa pagou a mais (Débito do funcionário) | < 0: empresa ainda deve (Crédito ao funcionário)
                    const saldo = valorJaPago - valorDevido;

                    if (Math.abs(saldo) > 0.01) {
                        const tipo = saldo > 0 ? 'Debito' : 'Credito';
                        const valorAjuste = Math.abs(saldo);
                        const justificativaAjuste = `[Saldo de Inativação] Dias trabalhados confirmados pelo financeiro: ${qtdDiasTrabalhados}/${totalDias}. `
                            + `Devido: R$ ${valorDevido.toFixed(2)} | Já pago: R$ ${valorJaPago.toFixed(2)} | `
                            + `${tipo === 'Debito' ? 'Saldo a favor da empresa' : 'Saldo a favor do funcionário'}: R$ ${valorAjuste.toFixed(2)}`;

                        const { rows: ajusteRows } = await pool.query(
                            `INSERT INTO staffajustefinanceiro (
                                idfuncionario, idempresa, idstaffeventoorigem, tipo, valor,
                                justificativa, status, idusuariolancamento, dtlancamento
                             ) VALUES ($1, $2, $3, $4, $5, $6, 'Pendente', $7, NOW())
                             RETURNING idajustefinanceiro`,
                            [sol.idfuncionario, idempresa, sol.idregistroalterado, tipo, valorAjuste, justificativaAjuste, idUsuarioResponsavel]
                        );
                        idAjusteGerado = ajusteRows[0]?.idajustefinanceiro || null;
                        tipoAjusteGerado = tipo;
                        valorAjusteGerado = valorAjuste;
                    }
                }

                res.locals.acao = 'atualizou';
                res.locals.idregistroalterado = sol.idregistroalterado;
                return res.json({
                    sucesso: true,
                    idsolicitacao: idpedido,
                    gerouAjuste: !!idAjusteGerado,
                    tipoAjuste: tipoAjusteGerado,
                    valorAjuste: valorAjusteGerado,
                    idajustefinanceiro: idAjusteGerado
                });
            }

            if (dataEspecifica === 'undefined' || !dataEspecifica) {
                dataEspecifica = null;
            }

            const statusParaAtualizar = statusParaAtualizar0;

            console.log("========================================================");
            console.log("📥 DETECTADO CLIQUE DE ATUALIZAÇÃO FINANCEIRA");
            console.log(`> Categoria recebida: "${categoria}"`);
            console.log(`> Ação / Status: "${statusParaAtualizar}"`);
            console.log(`> ID Pedido/Solicitação enviado: ${idpedido}`);
            console.log(`> Data específica informada:`, dataEspecifica);
            console.log("========================================================");

            // 1. RECUPERA AS DATAS E O TIPO DA SOLICITAÇÃO
            let datasDaSolicitacao = [];
            const { rows: dadosSol } = await pool.query(`
                SELECT dtsolicitada, tiposolicitacao, chaveitem, vlrsolicitado FROM public.solicitacoes
                WHERE idsolicitacao = $1 AND idempresa = $2
            `, [idpedido, idempresa]);

            if (dadosSol.length > 0 && dadosSol[0].dtsolicitada) {
                const rawDts = dadosSol[0].dtsolicitada;
                
                const formatarParaISO = (v) => {
                    if (!v) return null;
                    const d = new Date(v);
                    if (isNaN(d.getTime())) return String(v).trim();
                    return d.toISOString().split('T')[0];
                };

                if (Array.isArray(rawDts)) {
                    datasDaSolicitacao = rawDts.map(d => formatarParaISO(d)).filter(Boolean);
                } else if (typeof rawDts === 'string') {
                    datasDaSolicitacao = rawDts.replace(/[{}]/g, '').split(',').map(d => formatarParaISO(d.trim())).filter(Boolean);
                }
            }

            // 2. 🎯 ATUALIZA EXCLUSIVAMENTE A SOLICITAÇÃO ESPECÍFICA (Ex: ID 672)
            let querySolicitacoes = `
                UPDATE public.solicitacoes 
                SET status = $1, idusuarioresponsavel = $2, dtresposta = NOW() 
                WHERE idsolicitacao = $3 
                AND idempresa = $4 
                AND status = 'Pendente'
            `;
            const paramsSolicitacoes = [statusParaAtualizar, idUsuarioResponsavel, idpedido, idempresa];

            if (dataEspecifica) {
                querySolicitacoes += " AND ($5::date = ANY(dtsolicitada) OR (dtsolicitada::text LIKE '%' || $5 || '%'))";
                paramsSolicitacoes.push(dataEspecifica);
            }
            
            const resUpSolicitacoes = await pool.query(querySolicitacoes, paramsSolicitacoes);
            console.log(`[SOLICITAÇÃO ESPECÍFICA] Linhas atualizadas com o ID ${idpedido}: ${resUpSolicitacoes.rowCount}`);

            // 3. BUSCA O REGISTRO MESTRE DO STAFF (Ex: ID 3028)
            const { rows: rowsMestre } = await pool.query(`
                SELECT se.*, fe.perfil
                FROM staffeventos se
                INNER JOIN funcionarios f ON se.idfuncionario = f.idfuncionario
                INNER JOIN funcionarioempresas fe ON fe.idfuncionario = f.idfuncionario AND fe.idempresa = $2
                WHERE se.idstaffevento = (SELECT idregistroalterado FROM solicitacoes WHERE idsolicitacao = $1 LIMIT 1)
                AND EXISTS (SELECT 1 FROM staffempresas sem WHERE sem.idstaff = se.idstaff AND sem.idempresa = $2)
            `, [idpedido, idempresa]);

            if (!rowsMestre.length) {
                console.log("❌ ERRO: Registro mestre de staffeventos não foi encontrado para esta solicitação!");
                return res.status(404).json({ error: 'Registro mestre não encontrado.' });
            }

            let registro = rowsMestre[0];
            const idStaffAlvo = registro.idstaffevento; 
            
            console.log(`[REGISTRO MESTRE ANCORADO] Encontrado Staff ID: ${idStaffAlvo}`);

            const mapCategorias = {
                'statuscaixinha': 'caixinha',
                'statusajustecusto': 'statusajustecusto',
                'statusdiariadobrada': 'dtdiariadobrada', 
                'statusmeiadiaria': 'dtmeiadiaria',
                'statuscustofechado': 'statuscustofechado', 
                'statuscacheliberado': 'statuscustofechado',
                'statusvagasreaproveitadas': 'vagasreaproveitadas'
            };

            // 🚀 INTERCEPTAÇÃO INTELIGENTE: Se vier genérico de aditivos, mas for Vaga Reaproveitada, corrige a rota!
            let categoriaEfetiva = categoria;
            const tipoSolicitacaoOriginal = dadosSol[0]?.tiposolicitacao || '';

            if (tipoSolicitacaoOriginal.toLowerCase().includes('vaga reaproveitada') || 
                tipoSolicitacaoOriginal.toLowerCase().includes('reaproveitada')) {
                categoriaEfetiva = 'statusvagasreaproveitadas';
            }

            const colunaDB = mapCategorias[categoriaEfetiva];

            // Define se deve ir para o fluxo genérico de Aditivo de Datas (Fluxo A)
            const isAditivoOuExtra = (categoriaEfetiva.toLowerCase().includes('aditivo') || 
                                     categoriaEfetiva.toLowerCase().includes('vaga') || 
                                     categoriaEfetiva.toLowerCase().includes('extra') ||
                                     categoriaEfetiva.toLowerCase().includes('excedido')) && 
                                     categoriaEfetiva !== 'statusvagasreaproveitadas';

            const isAjudaCustoPaga = (registro.statuspgtoajdcto || '').toLowerCase() === 'pago';

            // Variável local para acumular strings JSON processadas sem sofrer mutação ou quebra de const
            let varObjetoJsonFinal = null;
            // Só usada pelo FLUXO B/statusvagasreaproveitadas: quando a data reaproveitada
            // é Rejeitada, essa data precisa sair de datasevento também (ela entrou lá de
            // forma otimista, junto com a criação/edição do staffevento, antes da aprovação).
            let novoDatasEventoJson = null;

            // ==========================================
            // 🔥 FLUXO A: TRATAMENTO CASO SEJA ADITIVO OU VAGA EXCEDIDA
            // ==========================================
            if (isAditivoOuExtra && !colunaDB) { 
                console.log("🚀 ENTRANDO NO FLUXO A (ADITIVOS / EXCEDIDOS)");

                const converterParaISO = (v) => {
                    if (!v) return null;
                    const d = new Date(v);
                    if (isNaN(d.getTime())) {
                        if (String(v).includes('/')) {
                            const partes = String(v).split('/');
                            if (partes.length === 3) return `${partes[2]}-${partes[1]}-${partes[0]}`;
                        }
                        return String(v).trim();
                    }
                    return d.toISOString().split('T')[0];
                };

                let datasAtuaisRaw = Array.isArray(registro.datasevento) ? registro.datasevento : [];
                let datasAtuais = datasAtuaisRaw.map(d => converterParaISO(d)).filter(Boolean);

                let datasParaProcessar = dataEspecifica ? [dataEspecifica] : datasDaSolicitacao;
                datasParaProcessar = datasParaProcessar.map(d => converterParaISO(d)).filter(Boolean);

                // Datas de diária dobrada vivem em dtdiariadobrada, nunca em datasevento.
                // Separa para não adicionar/remover datas dobradas do campo de eventos.
                let dtDobradaRaw = registro.dtdiariadobrada;
                if (typeof dtDobradaRaw === 'string') { try { dtDobradaRaw = JSON.parse(dtDobradaRaw); } catch(e) { dtDobradaRaw = []; } }
                const dtDobradaArr = Array.isArray(dtDobradaRaw) ? dtDobradaRaw : [];
                const dtDobradaDatesSet = new Set(dtDobradaArr.map(e => String(e.data || '').substring(0, 10)));

                const datasParaEventos = datasParaProcessar.filter(d => !dtDobradaDatesSet.has(d));
                const datasParaDobrada = datasParaProcessar.filter(d => dtDobradaDatesSet.has(d));

                let dataRespostaBR = dataEspecifica || (datasDaSolicitacao[0] || '');
                if (dataRespostaBR && dataRespostaBR.includes('-')) {
                    dataRespostaBR = dataRespostaBR.split('-').reverse().join('/');
                }

                const dataFormatadaTexto = dataRespostaBR || new Date().toLocaleDateString('pt-BR');
                const stringRespostaNova = `${dataFormatadaTexto} - ${statusParaAtualizar}`;

                if (statusParaAtualizar === 'Autorizado') {
                    datasParaEventos.forEach(dStr => {
                        if (dStr && !datasAtuais.includes(dStr)) {
                            datasAtuais.push(dStr);
                        }
                    });
                } else if (statusParaAtualizar === 'Rejeitado') {
                    datasParaEventos.forEach(dStr => {
                        datasAtuais = datasAtuais.filter(d => d !== dStr);
                    });
                }

                datasAtuais = [...new Set(datasAtuais)].sort();

                // Atualiza vagasreaproveitadas conforme o resultado da autorização
                let vagasReaproveitadasAtualizadas = null;
                if (statusParaAtualizar === 'Rejeitado') {
                    const datasRejeitadasSet = new Set(datasParaProcessar);
                    let vagasAtuals = registro.vagasreaproveitadas || [];
                    if (typeof vagasAtuals === 'string') {
                        try { vagasAtuals = JSON.parse(vagasAtuals); } catch(e) { vagasAtuals = []; }
                    }
                    if (Array.isArray(vagasAtuals) && vagasAtuals.length > 0) {
                        const vagasFiltradas = vagasAtuals.filter(
                            v => !datasRejeitadasSet.has(String(v.data).split('T')[0])
                        );
                        vagasReaproveitadasAtualizadas = JSON.stringify(vagasFiltradas);
                        console.log(`🗑️ [REJEIÇÃO] ${vagasAtuals.length - vagasFiltradas.length} entrada(s) removida(s) de vagasreaproveitadas`);
                    }
                } else if (statusParaAtualizar === 'Autorizado') {
                    let vagasAtuals = registro.vagasreaproveitadas || [];
                    if (typeof vagasAtuals === 'string') {
                        try { vagasAtuals = JSON.parse(vagasAtuals); } catch(e) { vagasAtuals = []; }
                    }
                    if (Array.isArray(vagasAtuals) && vagasAtuals.length > 0) {
                        const datasAutorizadasSet = new Set(datasParaProcessar);
                        const vagasAtualizadas = vagasAtuals.map(v => {
                            if (datasAutorizadasSet.has(String(v.data).split('T')[0]) && v.status === 'Pendente') {
                                return { ...v, status: 'Autorizado' };
                            }
                            return v;
                        });
                        const houveMudanca = vagasAtualizadas.some((v, i) => v.status !== vagasAtuals[i].status);
                        if (houveMudanca) {
                            vagasReaproveitadasAtualizadas = JSON.stringify(vagasAtualizadas);
                            console.log(`✅ [AUTORIZAÇÃO] vagasreaproveitadas atualizadas para 'Autorizado' nas datas: ${datasParaProcessar.join(', ')}`);
                        }
                    }
                }

                let obsModificada = registro.obslogsistema || '';
                obsModificada = obsModificada.trim();
                if (obsModificada.startsWith('.')) obsModificada = obsModificada.replace(/^\.+/, '').trim();
                if (obsModificada.endsWith('.')) obsModificada = obsModificada.slice(0, -1).trim();

                if (!obsModificada.includes(stringRespostaNova)) {
                    if (obsModificada.includes('Resposta da Solicitação:')) {
                        obsModificada = `${obsModificada}, ${stringRespostaNova}`;
                    } else if (obsModificada.length > 0) {
                        obsModificada = `${obsModificada}. Resposta da Solicitação: ${stringRespostaNova}`;
                    } else {
                        obsModificada = `Resposta da Solicitação: ${stringRespostaNova}`;
                    }
                }
                if (!obsModificada.endsWith('.')) obsModificada += '.';

                const { rows: pendenciasReais } = await pool.query(`
                    SELECT 1 FROM public.solicitacoes 
                    WHERE idregistroalterado = $1 AND status = 'Pendente' LIMIT 1
                `, [idStaffAlvo]);

                // Aditivo e Extra Bonificado só viram Ativo ao ser incluídos no orçamento.
                // FuncExcedido simples não tem etapa de orçamento → vira Ativo direto na autorização.
                // FuncExcedido + Estouro Financeiro tem Aditivo vinculado → deve permanecer Pendente
                // até a vaga ser incluída no orçamento (mesma regra do Aditivo).
                const ehAditivoOuExtra = tipoSolicitacaoOriginal.toLowerCase().includes('aditivo') ||
                                         tipoSolicitacaoOriginal.toLowerCase().includes('extra bonificado') ||
                                         tipoSolicitacaoOriginal.toLowerCase().includes('extra') ||
                                         tipoSolicitacaoOriginal.toLowerCase().includes('funcexcedido + estouro') ||
                                         tipoSolicitacaoOriginal.toLowerCase().includes('funcexcedido + vaga');

                const statusFinalStaff = (datasAtuais.length === 0)
                    ? 'Deletado'
                    : (ehAditivoOuExtra && statusParaAtualizar === 'Autorizado')
                        ? 'Pendente'
                        : (pendenciasReais.length > 0) ? 'Pendente' : 'Ativo';
                
                console.log(`> Lista final de datas para salvar:`, datasAtuais);

                let totalCache = 0;
                let totalAjdCusto = isAjudaCustoPaga ? (parseFloat(registro.vlrtotajdcusto) || 0) : 0;

                const vlrCusto = parseFloat(registro.vlrcache) || 0;
                const vlrTransp = parseFloat(registro.vlrtransporte) || 0;
                const vlrAlim = parseFloat(registro.vlralimentacao) || 0;
                const qtdp = parseInt(registro.qtdpessoaslote) || 1;
                const perfil = (registro.perfil || '').toLowerCase();

                datasAtuais.forEach(dStr => {
                    const d = new Date(dStr + 'T12:00:00');
                    const isFDS = d.getDay() === 0 || d.getDay() === 6; 
                    let vlrDiariaCache = 0;
                    let vlrDiariaAjdCusto = 0;

                    if (perfil === 'lote') {
                        vlrDiariaCache = vlrCusto * qtdp;
                        vlrDiariaAjdCusto = (vlrTransp + vlrAlim) * qtdp;
                    } else if (perfil === 'freelancer') {
                        vlrDiariaCache = vlrCusto;
                        vlrDiariaAjdCusto = vlrTransp + vlrAlim;
                    } else if (perfil === 'interno') {
                        vlrDiariaAjdCusto = vlrTransp + vlrAlim;
                        if (isFDS) vlrDiariaCache = vlrCusto;
                    } else if (perfil === 'externo') {
                        vlrDiariaAjdCusto = vlrTransp + vlrAlim;
                    } else {
                        vlrDiariaAjdCusto = vlrTransp + vlrAlim;
                        if (isFDS) vlrDiariaCache = vlrCusto;
                    }

                    totalCache += vlrDiariaCache;
                    if (!isAjudaCustoPaga) totalAjdCusto += vlrDiariaAjdCusto;
                });

                let extrasDobra = registro.dtdiariadobrada;
                if (typeof extrasDobra === 'string') { try { extrasDobra = JSON.parse(extrasDobra); } catch(e){ extrasDobra = []; } }
                (Array.isArray(extrasDobra) ? extrasDobra : []).forEach(item => {
                    if (item.status === 'Autorizado') {
                        const customCache = item.vlr_cache != null ? item.vlr_cache : (item.vlrcache != null ? item.vlrcache : null);
                        totalCache += customCache != null ? parseFloat(customCache) : vlrCusto;
                        if (isAjudaCustoPaga) totalCache += (parseFloat(registro.vlralimentacaodobra) || vlrAlim);
                        else totalAjdCusto += (parseFloat(registro.vlralimentacaodobra) || vlrAlim);
                    }
                });

                let totalFinal = totalCache + totalAjdCusto;

                // Quando o registro vai ser Deletado, preserva datasevento como estava —
                // se ficou sem datas é porque a solicitação era a única, não há necessidade de limpar.
                const finalUpAditivo = await pool.query(`
                    UPDATE staffeventos
                    SET datasevento     = CASE WHEN $5 = 'Deletado' THEN datasevento ELSE $1::jsonb END,
                        vlrtotcache     = CASE WHEN $5 = 'Deletado' THEN 0            ELSE $2       END,
                        vlrtotajdcusto  = CASE WHEN $5 = 'Deletado' THEN 0            ELSE $3       END,
                        vlrtotal        = CASE WHEN $5 = 'Deletado' THEN 0            ELSE $4       END,
                        statusstaff = $5,
                        obslogsistema = $6,
                        vagasreaproveitadas = CASE WHEN $8::text IS NOT NULL THEN $8::jsonb ELSE vagasreaproveitadas END
                    WHERE idstaffevento = $7
                    RETURNING *;
                `, [JSON.stringify(datasAtuais), totalCache, totalAjdCusto, totalFinal, statusFinalStaff, obsModificada, idStaffAlvo, vagasReaproveitadasAtualizadas]);

                console.log(`✅ [FLUXO A] Linhas alteradas com sucesso no staffeventos: ${finalUpAditivo.rowCount}`);

                // Cascata: marcar como Rejeitado no JSONB dtdiariadobrada as datas do aditivo rejeitado.
                // Mantém o histórico — apenas atualiza o status, nunca remove a entrada.
                // Datas já Autorizadas não são rebaixadas.
                if (statusParaAtualizar === 'Rejeitado' && datasParaDobrada.length > 0) {
                    try {
                        const datasRejSet = new Set(datasParaDobrada);
                        let houveMudancaDobra = false;
                        const dtDobradaAtualizada = dtDobradaArr.map(entry => {
                            const dataEntry = String(entry.data || '').substring(0, 10);
                            if (datasRejSet.has(dataEntry) && entry.status !== 'Autorizado') {
                                houveMudancaDobra = true;
                                return { ...entry, status: 'Rejeitado' };
                            }
                            return entry;
                        });
                        if (houveMudancaDobra) {
                            await pool.query(
                                `UPDATE staffeventos SET dtdiariadobrada = $1::jsonb WHERE idstaffevento = $2`,
                                [JSON.stringify(dtDobradaAtualizada), idStaffAlvo]
                            );
                            console.log(`📅 [FLUXO A] dtdiariadobrada: datas ${datasParaDobrada.join(',')} marcadas como Rejeitado`);
                        }
                    } catch (errCascataDobra) {
                        console.error('[FLUXO A] Erro ao atualizar dtdiariadobrada na rejeição:', errCascataDobra);
                    }
                }

                // Cascata: rejeitar Aditivo/Extra Bonificado/Vaga Reaproveitada também rejeita
                // a(s) solicitação(ões) de FuncExcedido vinculada(s) (mesmo staffevento + mesma
                // data) que ainda estejam Pendentes. Sem isso, o FuncExcedido fica esquecido como
                // Pendente pra sempre — a vaga/aditivo que o gerou já foi cancelada, então não há
                // mais o que autorizar. Roda no backend (não depende do front chamar 2 endpoints
                // em sequência) pra não divergir se a segunda chamada falhar no meio do caminho.
                // Direção inversa (rejeitar só o FuncExcedido) NÃO cascateia de volta — o
                // funcionário fica inativo, mas a vaga já criada no orçamento permanece válida.
                if (statusParaAtualizar === 'Rejeitado'
                    && !tipoSolicitacaoOriginal.toLowerCase().includes('funcexcedido')
                    && datasParaProcessar.length > 0) {
                    try {
                        const { rows: funcExcedidoRejeitados } = await pool.query(`
                            UPDATE public.solicitacoes
                            SET status = 'Rejeitado', idusuarioresponsavel = $1, dtresposta = NOW()
                            WHERE idregistroalterado = $2
                              AND idempresa = $3
                              AND status = 'Pendente'
                              AND tiposolicitacao ILIKE '%funcexcedido%'
                              AND dtsolicitada && $4::date[]
                            RETURNING idsolicitacao, tiposolicitacao, dtsolicitada
                        `, [idUsuarioResponsavel, idStaffAlvo, idempresa, datasParaProcessar]);

                        if (funcExcedidoRejeitados.length > 0) {
                            console.log(`🔗 [CASCATA FUNCEXCEDIDO] ${funcExcedidoRejeitados.length} solicitação(ões) de FuncExcedido rejeitada(s) junto com "${tipoSolicitacaoOriginal}":`,
                                funcExcedidoRejeitados.map(r => r.idsolicitacao));
                        }
                    } catch (errCascataFuncExcedido) {
                        console.error('[FLUXO A] Erro ao cascatear rejeição para FuncExcedido:', errCascataFuncExcedido);
                    }
                }

                res.locals.idlog_origem = idlog_origem;
                res.locals.acao = 'atualizou';
                res.locals.idregistroalterado = idStaffAlvo;
                res.locals.dadosnovos = finalUpAditivo.rows[0];

                return res.json({ sucesso: true, updated: finalUpAditivo.rows[0], idlog_origem, category: categoria });
            }
            
            // ==========================================
            // 🔥 FLUXO B: TRATAMENTO DAS OUTRAS CATEGORIAS
            // ==========================================
            console.log("➡️ ADITIVO FALSE: ENTRANDO NO FLUXO B");
            if (!colunaDB) return res.status(400).json({ error: "Categoria inválida para atualização financeira" });

            if (categoriaEfetiva === 'statusdiariadobrada' || categoriaEfetiva === 'statusmeiadiaria') {
                let rawColuna = registro[colunaDB];
                if (typeof rawColuna === 'string') {
                    try { rawColuna = JSON.parse(rawColuna); } catch(e) { rawColuna = []; }
                }
                const arrayDiarias = Array.isArray(rawColuna) ? rawColuna : [];
                const novasDiarias = arrayDiarias.map(item => {
                    if (item.data === dataEspecifica) return { ...item, status: statusParaAtualizar };
                    return item;
                });
                varObjetoJsonFinal = JSON.stringify(novasDiarias);

            } else if (categoriaEfetiva === 'statuscaixinha') {
                // Múltiplas caixinhas por registro: casa pelo chaveitem da PRÓPRIA solicitação
                // (não por data — duas caixinhas podem nascer no mesmo dia), atualiza só o item
                // certo dentro do array, preservando os outros intactos.
                let rawCaixinha = registro.caixinha;
                if (typeof rawCaixinha === 'string') {
                    try { rawCaixinha = JSON.parse(rawCaixinha); } catch(e) { rawCaixinha = []; }
                }
                const arrayCaixinha = Array.isArray(rawCaixinha) ? rawCaixinha : [];
                const chaveItemSolicitacao = dadosSol[0]?.chaveitem;
                const novaCaixinha = arrayCaixinha.map(item => {
                    if (chaveItemSolicitacao && item.iditem === chaveItemSolicitacao) {
                        return { ...item, status: statusParaAtualizar };
                    }
                    return item;
                });
                varObjetoJsonFinal = JSON.stringify(novaCaixinha);

            } else if (categoriaEfetiva === 'statusvagasreaproveitadas') {
                let rawVagas = registro.vagasreaproveitadas;
                let arrayVagas = [];

                if (typeof rawVagas === 'string' && rawVagas.trim().length > 0) {
                    try {
                        let stringLimpa = rawVagas.replace(/""/g, '"');
                        if (stringLimpa.startsWith('"') && stringLimpa.endsWith('"')) {
                            stringLimpa = stringLimpa.slice(1, -1);
                        }
                        arrayVagas = JSON.parse(stringLimpa);
                    } catch(e) { 
                        console.error("⚠️ Falha ao processar string de vagasreaproveitadas, tentando fallback:", e.message);
                        try { arrayVagas = JSON.parse(rawVagas); } catch(err) { arrayVagas = []; }
                    }
                } else if (Array.isArray(rawVagas)) {
                    arrayVagas = rawVagas;
                }
                
                const arrayVagasTratado = Array.isArray(arrayVagas) ? arrayVagas : [];
                const listaDatasProc = (datasDaSolicitacao || []).map(d => d.split('T')[0]);

                const novoArrayVagas = arrayVagasTratado.map(item => {
                    const deveAtualizar = dataEspecifica ? (item.data === dataEspecifica) : listaDatasProc.includes(item.data);
                    if (deveAtualizar) {
                        return { ...item, status: statusParaAtualizar };
                    }
                    return item;
                });
                varObjetoJsonFinal = JSON.stringify(novoArrayVagas);

                // A data de uma Vaga Reaproveitada entra em datasevento de forma otimista,
                // já na criação/edição do staffevento, antes de qualquer aprovação — ao
                // contrário do Aditivo/Extra (FLUXO A), que só entra quando Autorizado.
                // Por isso, ao Rejeitar, precisa sair de datasevento explicitamente aqui;
                // não existe um "nunca foi adicionado" pra essa categoria.
                if (statusParaAtualizar === 'Rejeitado') {
                    const datasRejeitadasSet = new Set(dataEspecifica ? [dataEspecifica] : listaDatasProc);
                    const datasEventoAtuais = (Array.isArray(registro.datasevento) ? registro.datasevento : [])
                        .map(d => String(d).split('T')[0]);
                    const datasEventoFiltradas = datasEventoAtuais.filter(d => !datasRejeitadasSet.has(d));
                    if (datasEventoFiltradas.length !== datasEventoAtuais.length) {
                        novoDatasEventoJson = JSON.stringify(datasEventoFiltradas);
                        console.log(`🗑️ [VAGA REAPROVEITADA REJEITADA] Removendo de datasevento:`, [...datasRejeitadasSet]);
                    }
                }
            }

            let totalCache = parseFloat(registro.vlrtotcache) || 0;
            let totalAjdCusto = parseFloat(registro.vlrtotajdcusto) || 0;
            let total = 0;
            let obsDobraLog = null;

            const vlrCusto = parseFloat(registro.vlrcache) || 0;
            const vlrTransp = parseFloat(registro.vlrtransporte) || 0;
            const vlrAlim = parseFloat(registro.vlralimentacao) || 0;
            const vlrAlimDobra = parseFloat(registro.vlralimentacaodobra) || vlrAlim;
            const vlrAjuste = parseFloat(registro.vlrajustecusto) || 0;
            // vlrcaixinha (coluna legado) foi descontinuada — o valor relevante aqui é o
            // DESTA solicitação específica (vlrsolicitado), não uma soma congelada do registro.
            const vlrCaixinhaDestaSolicitacao = parseFloat(dadosSol[0]?.vlrsolicitado) || 0;

            if (categoriaEfetiva === 'statusdiariadobrada' || categoriaEfetiva === 'statusmeiadiaria') {
                let arrayExtras = (categoriaEfetiva === 'statusdiariadobrada') ? registro.dtdiariadobrada : registro.dtmeiadiaria;
                if (typeof arrayExtras === 'string') { try { arrayExtras = JSON.parse(arrayExtras); } catch(e) { arrayExtras = []; } }
                
                const itemModificado = (arrayExtras || []).find(item => item.data === dataEspecifica);
                // if (itemModificado && statusParaAtualizar === 'Autorizado') {
                //     const customCache = itemModificado.vlr_cache != null ? itemModificado.vlr_cache : (itemModificado.vlrcache != null ? itemModificado.vlrcache : null);
                //     const vlrBaseExtra = customCache != null ? parseFloat(customCache) : (vlrCusto / (categoriaEfetiva === 'statusmeiadiaria' ? 2 : 1));
                //     const customAlim = itemModificado.vlr_alimentacao != null ? itemModificado.vlr_alimentacao : (itemModificado.vlralimentacao != null ? itemModificado.vlralimentacao : null);
                //     const vlrAlimExtra = customAlim != null ? parseFloat(customAlim) : vlrAlimDobra;

                //     totalCache += vlrBaseExtra;
                //     if (isAjudaCustoPaga) totalCache += vlrAlimExtra;
                //     else totalAjdCusto += vlrAlimExtra;
                // }
                if (itemModificado && statusParaAtualizar === 'Autorizado' && tipoSolicitacaoOriginal !== 'Dobrada - Estouro Financeiro') {
                    const vlrItemCache = itemModificado.vlr_cache != null ? parseFloat(itemModificado.vlr_cache)
                                      : itemModificado.vlrcache != null ? parseFloat(itemModificado.vlrcache) : 0;
                    const vlrItemAlim  = itemModificado.vlr_alimentacao != null ? parseFloat(itemModificado.vlr_alimentacao)
                                      : itemModificado.vlralimentacao  != null ? parseFloat(itemModificado.vlralimentacao) : 0;

                    totalCache += vlrItemCache;
                    if (isAjudaCustoPaga) totalCache    += vlrItemAlim;
                    else                  totalAjdCusto += vlrItemAlim;

                    if (isAjudaCustoPaga && categoriaEfetiva === 'statusdiariadobrada') {
                        const dataFormatada = dataEspecifica ? dataEspecifica.split('-').reverse().join('/') : '';
                        const dataHora = new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
                        obsDobraLog = `[${dataHora}] Diária Dobrada ${dataFormatada} Autorizada Valores ${vlrItemCache.toFixed(2)} (cachê) + ${vlrItemAlim.toFixed(2)} (alimentação) refletidos ao total do cachê pois AJUDA DE CUSTO já está PAGO`;
                    }
                }
                total = totalCache + totalAjdCusto;

            } else if (categoriaEfetiva === 'statusvagasreaproveitadas') {
                let arrayVagasTemp = [];
                try {
                    let sLimpa = (registro.vagasreaproveitadas || '[]').replace(/""/g, '"');
                    if (sLimpa.startsWith('"') && sLimpa.endsWith('"')) sLimpa = sLimpa.slice(1, -1);
                    arrayVagasTemp = JSON.parse(sLimpa);
                } catch(e) { arrayVagasTemp = []; }

                const vagaModificada = (arrayVagasTemp || []).find(item => item.data === dataEspecifica);
                if (vagaModificada && statusParaAtualizar === 'Autorizado') {
                    const difFinanceira = parseFloat(vagaModificada.diferenca_financeira) || 0;
                    totalCache += difFinanceira;
                }
                total = totalCache + totalAjdCusto;

            } else if (categoriaEfetiva === 'statuscustofechado' || categoriaEfetiva === 'statuscacheliberado') {
                if (registro.nivelexperiencia === 'Fechado') {
                    totalCache = vlrCusto;
                    if (isAjudaCustoPaga) {
                        totalCache += (vlrTransp + vlrAlim);
                        totalAjdCusto = parseFloat(registro.vlrtotajdcusto) || 0;
                    } else {
                        totalAjdCusto = vlrTransp + vlrAlim;
                    }
                } else {
                    totalCache = 0;
                    totalAjdCusto = isAjudaCustoPaga ? (parseFloat(registro.vlrtotajdcusto) || 0) : 0;
                    const datas = Array.isArray(registro.datasevento) ? registro.datasevento : [];
                    const qtdp = parseInt(registro.qtdpessoaslote) || 1;
                    const perfil = (registro.perfil || '').toLowerCase();

                    datas.forEach(dStr => {
                        const d = new Date(dStr + 'T12:00:00');
                        const isFDS = d.getDay() === 0 || d.getDay() === 6; 
                        let vlrDiariaCache = 0;
                        let vlrDiariaAjdCusto = 0;

                        if (perfil === 'lote') {
                            vlrDiariaCache = vlrCusto * qtdp;
                            vlrDiariaAjdCusto = (vlrTransp + vlrAlim) * qtdp;
                        } else if (perfil === 'freelancer') {
                            vlrDiariaCache = vlrCusto;
                            vlrDiariaAjdCusto = vlrTransp + vlrAlim;
                        } else if (perfil === 'interno') {
                            vlrDiariaAjdCusto = vlrTransp + vlrAlim;
                            if (isFDS) vlrDiariaCache = vlrCusto;
                        } else if (perfil === 'externo') {
                            vlrDiariaAjdCusto = vlrTransp + vlrAlim;
                        } else {
                            vlrDiariaAjdCusto = vlrTransp + vlrAlim;
                            if (isFDS) vlrDiariaCache = vlrCusto;
                        }

                        totalCache += vlrDiariaCache;
                        if (!isAjudaCustoPaga) totalAjdCusto += vlrDiariaAjdCusto;
                    });
                }
                total = totalCache + totalAjdCusto;

            } else {
                if (categoriaEfetiva === 'statusajustecusto' && statusParaAtualizar === 'Autorizado') { totalCache += vlrAjuste; }
                total = totalCache + totalAjdCusto;
                if (categoriaEfetiva === 'statuscaixinha' && statusParaAtualizar === 'Autorizado') { total += vlrCaixinhaDestaSolicitacao; }
            }

            // ==========================================
            // 🛠️ MONTAGEM E DEFESA DO UPDATE FINAL (FLUXO B)
            // ==========================================
            let colunaDestinoBanco = colunaDB;
            if (categoriaEfetiva === 'statusvagasreaproveitadas') {
                colunaDestinoBanco = 'vagasreaproveitadas';
            }

            let valorFinalColuna;
            if (['dtdiariadobrada', 'dtmeiadiaria', 'vagasreaproveitadas', 'caixinha'].includes(colunaDestinoBanco)) {
                valorFinalColuna = varObjetoJsonFinal;
            } else {
                valorFinalColuna = statusParaAtualizar;
            }

            const { rows: pendenciasFluxoB } = await pool.query(`
                SELECT 1 FROM public.solicitacoes 
                WHERE idregistroalterado = $1 AND status = 'Pendente' LIMIT 1
            `, [idStaffAlvo]);

            const ehEstouroFinanceiroDobra = tipoSolicitacaoOriginal === 'Dobrada - Estouro Financeiro';
            const statusStaffCalculado = (pendenciasFluxoB.length > 0 || (ehEstouroFinanceiroDobra && statusParaAtualizar === 'Autorizado'))
                ? 'Pendente'
                : 'Ativo';

            const novaObsPosPgto = obsDobraLog
                ? ((registro.obspospgto ? registro.obspospgto + '\n' : '') + obsDobraLog)
                : (registro.obspospgto || null);

            const ativoCalculado = statusStaffCalculado === 'Ativo';
            const queryUpdate = `
                UPDATE staffeventos se
                SET ${colunaDestinoBanco} = $1,
                    vlrtotal = $2, vlrtotcache = $3, vlrtotajdcusto = $4,
                    statusstaff = $5, obspospgto = $7,
                    ativo = ($8 OR ativo),
                    datasevento = CASE WHEN $9::jsonb IS NOT NULL THEN $9::jsonb ELSE datasevento END
                WHERE se.idstaffevento = $6
                RETURNING se.*;
            `;

            console.log(`💾 [FLUXO B] Gravando com sucesso na coluna [${colunaDestinoBanco}]`);

            const finalResult = await pool.query(queryUpdate, [
                valorFinalColuna,
                total,
                totalCache,
                totalAjdCusto,
                statusStaffCalculado,
                idStaffAlvo,
                novaObsPosPgto,
                ativoCalculado,
                novoDatasEventoJson
            ]);
            
            console.log(`✅ [FLUXO B] Linhas alteradas com sucesso no staffeventos: ${finalResult.rowCount}`);

            res.locals.idlog_origem = idlog_origem;
            res.locals.acao = 'atualizou';
            res.locals.idregistroalterado = idStaffAlvo;
            res.locals.dadosnovos = finalResult.rows[0];

            return res.json({ sucesso: true, updated: finalResult.rows[0], idlog_origem, category: categoria });

        } catch (dbError) {
            console.error('❌ ERRO CRÍTICO NO BANCO DE DADOS:', dbError.message);
            return res.status(500).json({ error: 'Erro ao processar atualização no banco de dados', detalhe: dbError.message });
        }
    }
);

function parseValor(v) {
    if (!v) return 0;
    if (typeof v === 'number') return v;
    return parseFloat(String(v).replace(',', '.')) || 0;
}

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
            MIN(o.dtiniinframontagem) AS dtiniinframontagem,
            MIN(o.dtinimontagem) AS dtinimontagem,
            MAX(o.dtfimdesmontagem) AS dtfimdesmontagem,
            MAX(o.dtfiminfradesmontagem) AS dtfiminfradesmontagem
        FROM orcamentos o
        JOIN orcamentoempresas oe ON o.idorcamento = oe.idorcamento
        JOIN eventos e ON o.idevento = e.idevento
        WHERE oe.idempresa = $1
        AND (
            -- Vencimento da Ajuda (2 dias após início da montagem infra, ou montagem)
            (COALESCE(o.dtiniinframontagem, o.dtinimontagem) + INTERVAL '2 days')::date BETWEEN $2 AND $3
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
          tse.idfuncionario,
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
          COALESCE(caixinha_valor_autorizado(tse.caixinha), 0) AS vlrcaixinha,
          COALESCE(caixinha_valor_autorizado(tse.caixinha), 0) AS totalcaixinha_full,
          tse.caixinha,
          tse.statuspgto,
          tse.statuspgtoajdcto,
          tse.statuspgtocaixinha AS statuscaixinha,
          tse.statusstaff,
          tse.comppgtocache,
          tse.comppgtocache50,
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
        AND tse.statusstaff != 'Deletado'
        ORDER BY tse.idstaffevento
      ) AS sub
      ORDER BY nome ASC;
    `;

    const { rows: staffRows } = await pool.query(queryDetalhes, [eventosRaw.map(e => e.idevento), startDate, endDate]);

    // statusstaff='Pendente' é ambíguo: pode ser (a) ainda aguardando decisão do
    // Aditivo/Extra/FuncExcedido, OU (b) já Autorizado mas ainda não incluído no
    // orçamento (statusstaff só vira 'Ativo' depois dessa inclusão). Só dá pra saber
    // olhando a(s) solicitação(ões) vinculada(s) — se TODAS já estão Autorizado, é o
    // caso (b); senão (nenhuma vinculada, ou alguma ainda Pendente), é o caso (a).
    const idsStaffPendentes = staffRows.filter(s => s.statusstaff === 'Pendente').map(s => s.idstaffevento);
    const mapaAguardandoOrcamento = new Map();
    const mapaJustificativaPendencia = new Map();
    if (idsStaffPendentes.length > 0) {
        const { rows: solicitacoesVagaEtc } = await pool.query(
            `SELECT idregistroalterado, status, justificativa
             FROM public.solicitacoes
             WHERE idregistroalterado = ANY($1) AND categoria_log IN ('aditivoextra', 'statusvagaexcedida')`,
            [idsStaffPendentes]
        );
        const porRegistro = new Map();
        solicitacoesVagaEtc.forEach(s => {
            if (!porRegistro.has(s.idregistroalterado)) porRegistro.set(s.idregistroalterado, []);
            porRegistro.get(s.idregistroalterado).push(s);
        });
        porRegistro.forEach((linhas, idregistroalterado) => {
            mapaAguardandoOrcamento.set(idregistroalterado, linhas.every(l => l.status === 'Autorizado'));
            // Pode haver mais de uma solicitação (1 por data de exceção) — junta as
            // justificativas distintas, sem repetir, pra exibir no lugar dos botões.
            const justificativasUnicas = [...new Set(linhas.map(l => (l.justificativa || '').trim()).filter(Boolean))];
            mapaJustificativaPendencia.set(idregistroalterado, justificativasUnicas.join(' | '));
        });
    }

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
        let ajT = 0, ajP = 0, ajS = 0, ajR = 0,
            chT = 0, chP = 0, chS = 0, chR = 0,
            cxT = 0, cxP = 0, cxS = 0, cxR = 0;

        // Variáveis para capturar a escala real do staff
        let minEscalaStaff = null;
        let maxEscalaStaff = null;

        // Datas oficiais do orçamento para o "Período do Evento"
        const dtInicioMarcacao = normalizarParaDate(ev.dtinimarcacao);
        const dtInicioInfraMontagem = normalizarParaDate(ev.dtiniinframontagem);
        const dtInicioMontagem = normalizarParaDate(ev.dtinimontagem);
        const dtFimDesmontagem = normalizarParaDate(ev.dtfimdesmontagem);
        const dtFimInfraDesmontagem = normalizarParaDate(ev.dtfiminfradesmontagem);
        // Base para ajuda de custo: montagem infra tem prioridade sobre montagem
        const dtBaseAjuda = dtInicioInfraMontagem ?? dtInicioMontagem;

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

            const calcSuspenso = (status, amount) => {
                if (!status) return 0;
                return String(status).toLowerCase() === 'suspenso' ? amount : 0;
            };

            const calcRecusado = (status, amount) => {
                if (!status) return 0;
                return String(status).toLowerCase() === 'rejeitado' ? amount : 0;
            };

            chP += calcPago(s.statuspgto, vC);
            ajP += calcPago(s.statuspgtoajdcto, vA);
            cxP += calcPago(s.statuscaixinha, vX);

            chS += calcSuspenso(s.statuspgto, vC);
            ajS += calcSuspenso(s.statuspgtoajdcto, vA);
            cxS += calcSuspenso(s.statuscaixinha, vX);

            chR += calcRecusado(s.statuspgto, vC);
            ajR += calcRecusado(s.statuspgtoajdcto, vA);
            cxR += calcRecusado(s.statuscaixinha, vX);

            // --- LÓGICA DE ESCALA REAL (VENCIMENTOS) ---
            const startD = normalizarParaDate(s.periodo_eventoini_all);
            const endD = normalizarParaDate(s.periodo_eventofim_all);
            
            if (startD && (!minEscalaStaff || startD < minEscalaStaff)) minEscalaStaff = startD;
            if (endD && (!maxEscalaStaff || endD > maxEscalaStaff)) maxEscalaStaff = endD;

            // Itens de caixinha (autorizados + pendentes) pra exibir individualmente nos
            // Vencimentos, com a justificativa de cada um — Rejeitado não representa mais
            // valor em aberto, então não precisa aparecer aqui.
            const caixinhaArray = Array.isArray(s.caixinha) ? s.caixinha : [];
            const itensCaixinha = caixinhaArray
                .filter(it => it.status === 'Autorizado' || it.status === 'Pendente')
                .map(it => ({
                    valor: parseFloat(it.valor) || 0,
                    status: it.status,
                    justificativa: it.justificativa || '',
                    comprovante: it.comprovante || null
                }));

            const { caixinha, ...sSemCaixinhaRaw } = s;

            return {
                ...sSemCaixinhaRaw,
                periodo_eventoini_fmt: formatarDDMMYYYY(s.periodo_eventoini_all),
                periodo_eventofim_fmt: formatarDDMMYYYY(s.periodo_eventofim_all),
                totalpagar: vC + vA + vX,
                itens_caixinha: itensCaixinha,
                aguardandoInclusaoOrcamento: mapaAguardandoOrcamento.get(s.idstaffevento) || false,
                justificativaPendencia: mapaJustificativaPendencia.get(s.idstaffevento) || ''
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
            dataInicioInfraMontagem: formatarDDMMYYYY(dtInicioInfraMontagem),
            // Regra de Negócio: Baseada na Escala do Staff
            dataVencimentoAjuda: dtBaseAjuda ? new Date(dtBaseAjuda.getTime() + 2*86400000).toLocaleDateString('pt-BR') : '---',
            dataVencimentoCache: dtFimDesmontagem ? new Date(dtFimDesmontagem.getTime() + 2*86400000).toLocaleDateString('pt-BR') : '---',
            dataVencimentoCaixinha: dtFimDesmontagem ? new Date(dtFimDesmontagem.getTime() + 2*86400000).toLocaleDateString('pt-BR') : '---',
            ajuda:   { total: ajT, pendente: ajT - ajP - ajS - ajR, pago: ajP, suspenso: ajS, recusado: ajR },
            cache:   { total: chT, pendente: chT - chP - chS - chR, pago: chP, suspenso: chS, recusado: chR },
            caixinha:{ total: cxT, pendente: cxT - cxP - cxS - cxR, pago: cxP, suspenso: cxS, recusado: cxR },
            funcionarios: staffsProcessados,
            // Datas cruas (não formatadas) do fim real do evento — usadas só internamente
            // pra decidir se um crédito/débito ainda "cabe" nesta ocorrência (ver bloco de
            // ajustes financeiros abaixo). Não removidas do JSON, mas irrelevantes pro front.
            _dtFimDesmontagemRaw: dtFimDesmontagem,
            _dtFimInfraDesmontagemRaw: dtFimInfraDesmontagem
        };
    });

    // --- Ajustes financeiros (crédito/débito de funcionário) ---
    // Enquanto Pendente/Suspenso, o lançamento aparece em TODAS as ocorrências do
    // funcionário dentro da janela consultada — independente de cachê/ajuda/caixinha já
    // estarem pagos ali ou não, já que o crédito/débito é um ajuste à parte. EXCEÇÃO (só
    // vale pro broadcast, nunca pro evento de origem): não aparece numa ocorrência de
    // OUTRO evento cujo fim (desmontagem ou desmontagem infra, o que for mais tarde) já
    // tinha passado ANTES da data da solicitação — não faz sentido empurrar o lançamento
    // pra um evento que já tinha acabado quando ele foi criado. O evento de origem sempre
    // mostra, mesmo se o lançamento tiver sido feito depois do fim dele.
    //
    // Uma vez resolvido, NÃO some — continua aparecendo (travado, com o status final),
    // igual Cachê/Ajuda/Caixinha já fazem:
    //   - 'Pago': aparece no evento onde foi confirmado (idstaffeventopago) E também no
    //     evento de origem, se forem diferentes — pra consulta rápida de onde foi pago
    //     sem precisar sair do card de origem. Na ocorrência de origem, mostra uma nota
    //     "Pago no evento X" em vez dos botões de ação.
    //   - 'Rejeitado': só no evento de origem, como registro histórico.
    const { rows: ajustesTodos } = await pool.query(
        `SELECT a.idajustefinanceiro, a.idfuncionario, a.tipo, a.valor, a.justificativa, a.status,
                a.comprovante, a.dtlancamento, a.idstaffeventopago,
                seOrigem.nmevento AS nmevento_origem, seOrigem.idevento AS idevento_origem,
                sePago.nmevento AS nmevento_pago
         FROM staffajustefinanceiro a
         LEFT JOIN staffeventos seOrigem ON seOrigem.idstaffevento = a.idstaffeventoorigem
         LEFT JOIN staffeventos sePago ON sePago.idstaffevento = a.idstaffeventopago
         WHERE a.idempresa = $1`,
        [idempresa]
    );

    if (ajustesTodos.length > 0) {
        const ajustesPorFuncionario = new Map();
        ajustesTodos.forEach(a => {
            if (!ajustesPorFuncionario.has(a.idfuncionario)) ajustesPorFuncionario.set(a.idfuncionario, []);
            ajustesPorFuncionario.get(a.idfuncionario).push(a);
        });

        ajustesPorFuncionario.forEach((listaAjustes, idfuncionario) => {
            resultado.forEach(ev => {
                const fimDesmontagem = ev._dtFimDesmontagemRaw;
                const fimInfraDesmontagem = ev._dtFimInfraDesmontagemRaw;
                const dataFimReal = (fimDesmontagem && fimInfraDesmontagem)
                    ? (fimDesmontagem > fimInfraDesmontagem ? fimDesmontagem : fimInfraDesmontagem)
                    : (fimDesmontagem || fimInfraDesmontagem || null);

                // Um funcionário pode ter mais de uma função/registro dentro do MESMO evento
                // (ex: Fiscal de Marcação + Fiscal Diurno) — o crédito/débito deve aparecer só
                // uma vez por evento, não uma vez por registro, senão duplica na tela e no total.
                // Fica no ÚLTIMO registro do funcionário no evento (não no primeiro), pra aparecer
                // depois de todos os pagamentos dele na tela.
                let fComAjusteNesteEvento = null;

                ev.funcionarios.forEach(f => {
                    if (f.idfuncionario !== idfuncionario) return;

                    const ajustesValidosAqui = listaAjustes.filter(a => {
                        if (a.status === 'Pago') {
                            const pagoAqui = a.idstaffeventopago != null && String(a.idstaffeventopago) === String(f.idstaffevento);
                            const origemAqui = a.idevento_origem === ev.idevento;
                            return pagoAqui || origemAqui;
                        }
                        if (a.status === 'Rejeitado') {
                            return a.idevento_origem === ev.idevento;
                        }
                        // Pendente/Suspenso: ainda em aberto — broadcast (origem sempre + demais dentro da data)
                        if (a.idevento_origem === ev.idevento) return true;
                        if (!dataFimReal) return true;
                        const dtSolicitacao = normalizarParaDate(a.dtlancamento);
                        if (!dtSolicitacao) return true;
                        return dataFimReal >= dtSolicitacao;
                    });
                    if (ajustesValidosAqui.length === 0) return;

                    // Limpa do registro anterior (se houver) antes de mover pro atual —
                    // ao final do loop, sobra só no último registro deste funcionário no evento.
                    if (fComAjusteNesteEvento) delete fComAjusteNesteEvento.ajustes_financeiros;

                    f.ajustes_financeiros = ajustesValidosAqui.map(a => {
                        const ehOrigemAqui = a.idevento_origem === ev.idevento;
                        const ehPagoAqui = a.status === 'Pago'
                            && a.idstaffeventopago != null && String(a.idstaffeventopago) === String(f.idstaffevento);

                        // Nunca referencia o próprio evento que já está sendo exibido — só o "outro":
                        // se estamos no evento de origem (e foi pago em outro lugar), mostra onde pagou;
                        // caso contrário (evento diferente da origem — pago aqui ou ainda pendente em
                        // broadcast), mostra de onde veio. Quando origem e pagamento são o mesmo evento,
                        // não precisa de nenhuma nota.
                        let notaEventoRelacionado = null;
                        if (a.status === 'Pago') {
                            if (ehPagoAqui && !ehOrigemAqui) {
                                notaEventoRelacionado = { tipo: 'origem', nomeEvento: a.nmevento_origem };
                            } else if (!ehPagoAqui) {
                                notaEventoRelacionado = { tipo: 'pago', nomeEvento: a.nmevento_pago };
                            }
                        } else if (!ehOrigemAqui) {
                            notaEventoRelacionado = { tipo: 'origem', nomeEvento: a.nmevento_origem };
                        }

                        return {
                            idajustefinanceiro: a.idajustefinanceiro,
                            tipo: a.tipo,
                            valor: parseFloat(a.valor) || 0,
                            justificativa: a.justificativa,
                            status: a.status,
                            comprovante: a.comprovante,
                            notaEventoRelacionado
                        };
                    });
                    fComAjusteNesteEvento = f;
                });
            });
        });
    }

    res.json({ eventos: resultado });

  } catch (error) {
    console.error("ERRO ROTA VENCIMENTOS:", error);
    res.status(500).json({ error: error.message });
  }
});

// Saldo a receber de um funcionário DENTRO DE UM EVENTO ESPECÍFICO, pra decidir se cobre um
// Débito sendo pago. Cachê/Ajuda/Caixinha/Crédito contam pelo valor TOTAL, independente de já
// estarem Pagos ou não (exceto Rejeitado) — esse dinheiro já foi destinado ao funcionário naquele
// evento de qualquer forma, pago ou não, então continua "disponível" pra fins de comparação com
// o débito. Já os OUTROS Débitos do mesmo evento só entram na conta se JÁ estiverem Pagos — um
// débito ainda Pendente não consumiu nada do saldo até ser efetivamente pago (evita que dois
// débitos pendentes simultâneos "brigem" pelo mesmo saldo antes de qualquer um deles ser decidido).
// Escopo por evento, não pelo funcionário inteiro — mesma granularidade do "Total do Funcionário".
async function calcularSaldoAReceberPendente(idfuncionario, idempresa, excluirIdAjuste = null, idevento = null) {
    const totalExpr = (colStatus, colValor) => `SUM(CASE
        WHEN ${colStatus} = 'Rejeitado' THEN 0
        ELSE COALESCE(${colValor}, 0)
    END)`;

    const { rows } = await pool.query(`
        SELECT
            COALESCE((
                SELECT ${totalExpr('se.statuspgto', 'se.vlrtotcache')}
                FROM staffeventos se
                JOIN staffempresas sem ON sem.idstaff = se.idstaff
                WHERE se.idfuncionario = $1 AND sem.idempresa = $2
                  AND se.statusstaff NOT IN ('Inativo', 'Deletado')
                  AND ($4::int IS NULL OR se.idevento = $4::int)
            ), 0) AS cache_total,
            COALESCE((
                SELECT ${totalExpr('se.statuspgtoajdcto', 'se.vlrtotajdcusto')}
                FROM staffeventos se
                JOIN staffempresas sem ON sem.idstaff = se.idstaff
                WHERE se.idfuncionario = $1 AND sem.idempresa = $2
                  AND se.statusstaff NOT IN ('Inativo', 'Deletado')
                  AND ($4::int IS NULL OR se.idevento = $4::int)
            ), 0) AS ajuda_total,
            COALESCE((
                SELECT ${totalExpr('se.statuspgtocaixinha', 'se.vlrcaixinha')}
                FROM staffeventos se
                JOIN staffempresas sem ON sem.idstaff = se.idstaff
                WHERE se.idfuncionario = $1 AND sem.idempresa = $2
                  AND se.statusstaff NOT IN ('Inativo', 'Deletado')
                  AND ($4::int IS NULL OR se.idevento = $4::int)
            ), 0) AS caixinha_total,
            COALESCE((
                SELECT SUM(a.valor) FROM staffajustefinanceiro a
                LEFT JOIN staffeventos seOrigem ON seOrigem.idstaffevento = a.idstaffeventoorigem
                WHERE a.idfuncionario = $1 AND a.idempresa = $2 AND a.tipo = 'Credito' AND a.status <> 'Rejeitado'
                  AND ($4::int IS NULL OR seOrigem.idevento = $4::int)
            ), 0) AS creditos_total,
            COALESCE((
                SELECT SUM(a.valor) FROM staffajustefinanceiro a
                LEFT JOIN staffeventos seOrigem ON seOrigem.idstaffevento = a.idstaffeventoorigem
                WHERE a.idfuncionario = $1 AND a.idempresa = $2 AND a.tipo = 'Debito' AND a.status = 'Pago'
                  AND ($3::int IS NULL OR a.idajustefinanceiro <> $3::int)
                  AND ($4::int IS NULL OR seOrigem.idevento = $4::int)
            ), 0) AS debitos_pagos
    `, [idfuncionario, idempresa, excluirIdAjuste, idevento]);

    const r = rows[0];
    const saldo = Number(r.cache_total) + Number(r.ajuda_total) + Number(r.caixinha_total)
                + Number(r.creditos_total) - Number(r.debitos_pagos);
    return { saldo, detalhe: r };
}

router.post("/vencimentos/update-status",
    logMiddleware("Vencimentos", {
        buscarDadosAnteriores: async (req) => {
            const { idStaff } = req.body;
            const query = `SELECT idstaffevento, statuspgto, statuspgtoajdcto, statuspgtocaixinha FROM staffeventos WHERE idstaffevento = $1`;
            const result = await pool.query(query, [idStaff]);
            return result.rows[0] ? { dadosanteriores: result.rows[0], idregistroalterado: idStaff } : null;
        }
    }), 
    async (req, res) => {
        let { idStaff, tipo, novoStatus, idlog_origem, idEventoContexto, confirmarDiferenca } = req.body;

        const idempresa = req.idempresa;
        const idUsuarioLogado = req.usuario?.idusuario;
        if (!idempresa) {
            return res.status(400).json({ success: false, error: "idempresa obrigatório na requisição." });
        }

        // 0. Crédito/Débito de funcionário não é uma coluna de staffeventos —
        // vive na tabela própria staffajustefinanceiro. Ao marcar como 'Pago', grava em
        // idstaffeventopago o evento em cujo contexto (aba de Vencimentos) a confirmação
        // aconteceu — pode ser diferente do evento onde o lançamento foi originado.
        if (tipo === 'AjusteFin') {
            try {
                // Antes de fechar um Débito, confere se o total destinado ao funcionário neste
                // evento (pago ou não) é suficiente pra "cobrir" esse valor. Se não tiver, devolve 409 com a diferença pro
                // front mostrar o aviso — só gera o Débito compensatório se vier confirmarDiferenca=true.
                let diferencaParaGerar = 0;
                let idfuncionarioAjuste = null;

                if (novoStatus === 'Pago') {
                    const { rows: ajusteRows } = await pool.query(
                        `SELECT idfuncionario, tipo, valor, status FROM staffajustefinanceiro
                         WHERE idajustefinanceiro = $1 AND idempresa = $2`,
                        [idStaff, idempresa]
                    );
                    const ajusteAtual = ajusteRows[0];

                    if (ajusteAtual && ajusteAtual.tipo === 'Debito' && ajusteAtual.status !== 'Pago') {
                        idfuncionarioAjuste = ajusteAtual.idfuncionario;

                        // idEventoContexto é, na verdade, o idstaffevento da linha do card onde o
                        // usuário clicou "Pagar" — precisa resolver o idevento real pra escopar o
                        // saldo só a este evento (mesma granularidade do "Total do Funcionário" na tela).
                        let ideventoContexto = null;
                        if (idEventoContexto) {
                            const { rows: eventoRows } = await pool.query(
                                `SELECT idevento FROM staffeventos WHERE idstaffevento = $1`,
                                [idEventoContexto]
                            );
                            ideventoContexto = eventoRows[0]?.idevento ?? null;
                        }

                        const { saldo } = await calcularSaldoAReceberPendente(
                            ajusteAtual.idfuncionario, idempresa, idStaff, ideventoContexto
                        );
                        const valorDebito = parseFloat(ajusteAtual.valor) || 0;
                        const diferenca = valorDebito - saldo;

                        if (diferenca > 0.01) {
                            if (!confirmarDiferenca) {
                                return res.status(409).json({
                                    success: false,
                                    diferencaDetectada: true,
                                    saldo,
                                    valorDebito,
                                    diferenca
                                });
                            }
                            diferencaParaGerar = diferenca;
                        }
                    }
                }

                const resultAjuste = await pool.query(
                    `UPDATE staffajustefinanceiro
                     SET status = $1::varchar,
                         dtpagamento = CASE WHEN $1::varchar = 'Pago' THEN now() ELSE dtpagamento END,
                         idstaffeventopago = CASE WHEN $1::varchar = 'Pago' THEN $4::integer ELSE idstaffeventopago END
                     WHERE idajustefinanceiro = $2 AND idempresa = $3
                     RETURNING *`,
                    [novoStatus, idStaff, idempresa, idEventoContexto || null]
                );

                if (resultAjuste.rowCount === 0) {
                    return res.status(404).json({ success: false, error: "Ajuste financeiro não encontrado." });
                }

                if (diferencaParaGerar > 0.01) {
                    // idEventoContexto já é um idstaffevento (a linha/função onde o débito original
                    // estava) — reaproveita como origem do novo ajuste, senão o card de notificação
                    // fica sem saber de qual evento/função essa diferença veio.
                    await pool.query(
                        `INSERT INTO staffajustefinanceiro
                            (idfuncionario, idempresa, idstaffeventoorigem, tipo, valor, justificativa, status, idusuariolancamento)
                         VALUES ($1, $2, $3, 'Debito', $4, $5, 'Pendente', $6)`,
                        [
                            idfuncionarioAjuste, idempresa, idEventoContexto || null, diferencaParaGerar,
                            `[Diferença de valor] Total destinado ao funcionário neste evento insuficiente para cobrir este débito — diferença de R$ ${diferencaParaGerar.toFixed(2)} gerada automaticamente na confirmação do pagamento.`,
                            idUsuarioLogado
                        ]
                    );
                }

                res.locals.idlog_origem = idlog_origem;
                res.locals.acao = 'atualizou';
                res.locals.idregistroalterado = idStaff;
                res.locals.dadosnovos = resultAjuste.rows[0];
                return res.json({ success: true, statusSalvo: novoStatus, ajusteDiferencaGerado: diferencaParaGerar > 0.01 });
            } catch (error) {
                console.error("Erro ao atualizar status do ajuste financeiro:", error);
                return res.status(500).json({ success: false, error: error.message });
            }
        }

        // 1. Mapeamento da Coluna (Corrigido para incluir Caixinha)
        let coluna = "";
        if (tipo === 'Cache') {
            coluna = 'statuspgto';
        } else if (tipo === 'Ajuda') {
            coluna = 'statuspgtoajdcto';
        } else if (tipo === 'Caixinha') {
            // Bug corrigido: isto é status de PAGAMENTO ("Pago"/"Suspenso"/"Rejeitado"), não de
            // autorização — statuscaixinha (autorização: Pendente/Autorizado/Rejeitado, hoje
            // descontinuada em favor do array `caixinha`) nunca deveria receber esses valores.
            coluna = 'statuspgtocaixinha';
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
        const { idStaff, tipo } = req.body;
        if (tipo === 'ajustefin') {
            const resultAjuste = await pool.query(
                `SELECT idajustefinanceiro, comprovante FROM staffajustefinanceiro WHERE idajustefinanceiro = $1`,
                [idStaff]
            );
            return resultAjuste.rows[0] ? { dadosanteriores: resultAjuste.rows[0], idregistroalterado: idStaff } : null;
        }
        const query = `SELECT idstaffevento, comppgtocache, comppgtocache50, comppgtocaixinha, comppgtoajdcusto50, comppgtoajdcusto FROM staffeventos WHERE idstaffevento = $1`;
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

    // Crédito/Débito de funcionário vive em staffajustefinanceiro, não em staffeventos —
    // trata à parte, antes do mapeamento de coluna usado pelos demais tipos.
    if (tipo === 'ajustefin') {
        try {
            const resultAjuste = await pool.query(
                `UPDATE staffajustefinanceiro SET comprovante = $1 WHERE idajustefinanceiro = $2 AND idempresa = $3 RETURNING *`,
                [pathArquivo, idStaff, idempresa]
            );

            if (resultAjuste.rowCount === 0) {
                return res.status(404).json({ error: "Ajuste financeiro não encontrado." });
            }

            res.locals.acao = 'cadastrou';
            res.locals.idregistroalterado = idStaff;
            res.locals.dadosnovos = resultAjuste.rows[0];

            return res.json({ success: true, path: pathArquivo, colunaDestino: 'comprovante' });
        } catch (error) {
            console.error("Erro no upload de comprovante do ajuste financeiro:", error);
            return res.status(500).json({ error: "Erro interno ao salvar comprovante." });
        }
    }

    try {
        let coluna = "";

        // Mapeamento direto dos tipos vindo do frontend
        if (tipo === 'cache_50') {
            coluna = 'comppgtocache50';
        }
        else if (tipo === 'cache_100' || tipo === 'cache') {
            coluna = 'comppgtocache';
        }
        else if (tipo === 'caixinha') {
            // comppgtocaixinha (comprovante único pro registro) foi descontinuada — cada
            // caixinha agora tem seu próprio comprovante dentro do array `caixinha`, e essa
            // tela não sabe pra qual item específico este upload seria. Envie item a item
            // pela tela do Staff.
            return res.status(400).json({ error: "Envie o comprovante de cada caixinha individualmente pela tela do Staff (uma por item)." });
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
                -- -------------------------------------------
                COALESCE(p.dtvcto, l.vctobase) AS data_referencia,
                -- Lançamento tipovinculo='funcionario' só entra no grupo especial "funcionario"
                -- (com toda a lógica de holerite/RH) se o perfil do funcionário for Interno ou
                -- Externo C/Holerite (ExternoH) — Externo comum e Freelancer não têm direito a
                -- 13º/holerite e caem no grupo "outros", como qualquer outro lançamento genérico.
                CASE
                    WHEN LOWER(TRIM(l.tipovinculo)) = 'funcionario' AND COALESCE(fe.perfil, '') NOT IN ('Interno', 'ExternoH')
                        THEN 'outros'
                    ELSE COALESCE(NULLIF(LOWER(TRIM(l.tipovinculo)), ''), 'outros')
                END AS tipovinculo,
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
                COALESCE(forn.nmfantasia, func.nome, cli.nmfantasia, 'Lançamento Geral') AS nome_vinculo,
                -- Id do funcionário vinculado (quando tipovinculo = funcionário), pra casar
                -- com o holerite do mês efetivamente exibido/projetado no Front-end.
                func.idfuncionario AS idfuncionario_vinculo
            FROM lancamentos l
            LEFT JOIN pagamentos p ON l.idlancamento = p.idlancamento
            LEFT JOIN fornecedores forn ON (LOWER(TRIM(l.tipovinculo)) = 'fornecedor' AND l.idvinculo = forn.idfornecedor)
            LEFT JOIN funcionarios func ON (LOWER(TRIM(l.tipovinculo)) = 'funcionario' AND l.idvinculo = func.idfuncionario)
            LEFT JOIN funcionarioempresas fe ON (fe.idfuncionario = func.idfuncionario AND fe.idempresa = l.idempresa)
            LEFT JOIN clientes cli ON (LOWER(TRIM(l.tipovinculo)) = 'cliente' AND l.idvinculo = cli.idcliente)
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

        // Holerites (RH) do ano inteiro, por funcionário/mês — sempre uma linha por
        // competência (real quando já existe holerite salvo, ou PREVISÃO calculada na hora,
        // igual ao /rh/folha) pra casar com o mês efetivamente projetado na tela de Vencimentos.
        const { obterParametros, contarDiasUteis, computarLinhaFolha, garantirHoleriteMensal, computarLinha13, garantirHolerite13, PERFIS_FOLHA } = require('./rotaRH').helpersFolha;

        const funcsFolha = (await pool.query(
            `SELECT f.idfuncionario, f.nome, fe.salario, fe.dependentes, fe.valealim, fe.valetrnsp
               FROM funcionarios f
               JOIN funcionarioempresas fe ON fe.idfuncionario = f.idfuncionario
              WHERE fe.idempresa = $1
                AND fe.perfil = ANY($2)
                AND COALESCE(fe.ativo, true) = true`,
            [idEmpresa, PERFIS_FOLHA]
        )).rows;

        const paramsFolha = await obterParametros(anoFiltro);

        const holerites = [];
        for (const f of funcsFolha) {
            for (let mes = 1; mes <= 12; mes++) {
                const diasUteis = contarDiasUteis(anoFiltro, mes);
                // Gera e persiste o holerite mensal automaticamente (réplica do mês anterior +
                // INSS/IRRF recalculado) — o RH não precisa mais entrar todo mês pra salvar; só
                // quando precisar ajustar algo. Meses sequenciais dentro do mesmo loop (await),
                // então o mês N já pode replicar o mês N-1 recém-persistido.
                await garantirHoleriteMensal(idEmpresa, f, mes, anoFiltro, paramsFolha, diasUteis);
                const linha = await computarLinhaFolha(idEmpresa, f, mes, anoFiltro, paramsFolha, diasUteis);
                holerites.push({ ...linha, mes, ano: anoFiltro });
            }
        }

        // 13º salário: geral e no mesmo período pra todo mundo, por isso é gerado
        // automaticamente pra todo o ano filtrado (1ª parcela, vence 20/11; 2ª parcela,
        // vence 30/12) — diferente de férias/rescisão, que só aparecem quando o RH gera
        // manualmente na tela de RH. Não depende mais da data real do servidor: quem
        // filtrar novembro/dezembro em qualquer época do ano já vê (e persiste) o 13º
        // daquela competência — o filtro de período (mensal/semanal/etc) na tela é quem
        // decide se a linha aparece ou não, não a data de hoje.

        const eventos13 = [];
        for (const f of funcsFolha) {
            await garantirHolerite13(idEmpresa, f, 11, anoFiltro, "1", paramsFolha);
            const parcela1 = await computarLinha13(idEmpresa, f, 11, anoFiltro, "1", paramsFolha);
            if (parcela1.idholerite) {
                eventos13.push({
                    ...parcela1, mes: 11, ano: anoFiltro, dtvcto: `${anoFiltro}-11-20`,
                });
            }

            await garantirHolerite13(idEmpresa, f, 12, anoFiltro, "2", paramsFolha);
            const parcela2 = await computarLinha13(idEmpresa, f, 12, anoFiltro, "2", paramsFolha);
            if (parcela2.idholerite) {
                eventos13.push({
                    ...parcela2, mes: 12, ano: anoFiltro, dtvcto: `${anoFiltro}-12-30`,
                });
            }
        }

        res.json({ sucesso: true, anoReferencia: anoFiltro, contas: rows, holerites, eventos13 });
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
    const idempresa = req.idempresa;

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
        // res.json({ 
        //     success: true, 
        //     path: nomeArquivoNoBanco, // Retorna o nome para o Swal e para atualizar a tela
        //     colunaDestino: coluna 
        // });

        res.json({ 
            success: true, 
            // Ajuste o prefixo conforme sua estrutura de pastas (ex: /uploads/contas/)
            path: `/uploads/contas/${nomeArquivoNoBanco}`, 
            colunaDestino: coluna 
        });

    } catch (error) {
        console.error("Erro crítico no upload:", error);
        res.status(500).json({ error: "Erro interno ao salvar no banco de dados." });
    }
});

// =======================================
// AGENDA DE EVENTOS (Agenda)
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
    async (req, res) => {
        const idSolicitacao = req.params.idAditivoExtra;
        const { novoStatus } = req.body;
        const idUsuarioAprovador = req.usuario?.idusuario;
        const idEmpresa = req.idempresa;

        if (!novoStatus || !idUsuarioAprovador) {
            return res.status(400).json({ sucesso: false, erro: "Dados incompletos." });
        }

        const statusPermitidos = ['Autorizado', 'Rejeitado'];
        if (!statusPermitidos.includes(novoStatus)) {
            return res.status(400).json({ sucesso: false, erro: "Status inválido." });
        }

        try {
            const check = await pool.query(
                `SELECT status FROM public.solicitacoes 
                 WHERE idsolicitacao = $1 AND idempresa = $2 AND categoria_log = 'aditivoextra'`,
                [idSolicitacao, idEmpresa]
            );

            if (check.rows.length === 0) {
                return res.status(404).json({ sucesso: false, erro: "Solicitação não encontrada." });
            }

            if (check.rows[0].status !== 'Pendente') {
                return res.status(400).json({
                    sucesso: false,
                    erro: `Não pode ser alterada. Status atual: ${check.rows[0].status}.`
                });
            }

            const { rows } = await pool.query(
                `UPDATE public.solicitacoes
                 SET status = $1, idusuarioresponsavel = $2, dtresposta = NOW()
                 WHERE idsolicitacao = $3 AND idempresa = $4
                 RETURNING *`,
                [novoStatus, idUsuarioAprovador, idSolicitacao, idEmpresa]
            );

            const solAtualizada = rows[0];

            // Quando Extra Bonificado é rejeitado, rejeita automaticamente a Diária Dobrada vinculada
            if (novoStatus === 'Rejeitado' && solAtualizada?.idregistroalterado) {
                const idStaffEvento = solAtualizada.idregistroalterado;

                // Datas do Extra Bonificado rejeitado (para marcar no JSONB)
                const datasRejeitadas = Array.isArray(solAtualizada.dtsolicitada)
                    ? solAtualizada.dtsolicitada.map(d => String(d).substring(0, 10))
                    : [];

                try {
                    // Buscar estado atual do staffevento
                    const seRes = await pool.query(
                        `SELECT dtdiariadobrada, obslogsistema FROM staffeventos WHERE idstaffevento = $1`,
                        [idStaffEvento]
                    );

                    if (seRes.rows.length > 0) {
                        const seRow = seRes.rows[0];

                        // Marcar as datas como Rejeitado no JSONB dtdiariadobrada
                        let dtDobrada = Array.isArray(seRow.dtdiariadobrada) ? seRow.dtdiariadobrada : [];
                        if (datasRejeitadas.length > 0) {
                            dtDobrada = dtDobrada.map(entry => {
                                const dataEntry = String(entry.data || '').substring(0, 10);
                                return datasRejeitadas.includes(dataEntry)
                                    ? { ...entry, status: 'Rejeitado' }
                                    : entry;
                            });
                        }

                        // Registrar rejeição em obslogsistema (log automático, protegido)
                        const hoje = new Date().toLocaleDateString('pt-BR');
                        const obsRejeicao = `[${hoje}] Extra Bonificado rejeitado — Diária Dobrada cancelada automaticamente.`;
                        const obsAtual = (seRow.obslogsistema || '').trim();
                        const novaObs = obsAtual ? `${obsAtual}\n${obsRejeicao}` : obsRejeicao;

                        await pool.query(
                            `UPDATE staffeventos SET dtdiariadobrada = $1::jsonb, obslogsistema = $2 WHERE idstaffevento = $3`,
                            [JSON.stringify(dtDobrada), novaObs, idStaffEvento]
                        );

                        // Rejeitar a solicitação de Diária Dobrada vinculada (se ainda Pendente)
                        await pool.query(
                            `UPDATE public.solicitacoes
                             SET status = 'Rejeitado', idusuarioresponsavel = $1, dtresposta = NOW()
                             WHERE idregistroalterado = $2
                               AND categoria_log = 'statusdiariadobrada'
                               AND status = 'Pendente'
                               AND idempresa = $3`,
                            [idUsuarioAprovador, idStaffEvento, idEmpresa]
                        );
                    }
                } catch (errCascata) {
                    // Loga mas não falha a requisição principal
                    console.error('[aditivoextra] Erro ao cascatear rejeição para Diária Dobrada:', errCascata);
                }
            }

            res.json({
                sucesso: true,
                mensagem: `Solicitação ${novoStatus.toLowerCase()} com sucesso.`,
                dados: solAtualizada
            });

        } catch (error) {
            console.error("Erro ao atualizar AditivoExtra:", error);
            res.status(500).json({ sucesso: false, erro: "Erro interno." });
        }
    }
);


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
