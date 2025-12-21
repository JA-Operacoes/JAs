const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB");
const { autenticarToken, contextoEmpresa } = require('../middlewares/authMiddlewares');
const { verificarPermissao } = require('../middlewares/permissaoMiddleware');
const logMiddleware = require("../middlewares/logMiddleware");

router.get("/", async (req, res) => {
  const idempresa = req.headers.idempresa || req.query.idempresa;
  console.log("ROTA MAIN - idempresa recebido:", idempresa);

  // Total de orçamentos
  const { rows: orcamentosTotal } = await pool.query(
  `SELECT COUNT(*)::int AS total
   FROM orcamentos o
   JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
   WHERE oe.idempresa = $1`, [idempresa]
  );

  // Orçamentos abertos (status = 'A')
  const { rows: orcamentosAbertos } = await pool.query(
  `SELECT COUNT(*)::int AS total
   FROM orcamentos o
   JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
   WHERE oe.idempresa = $1 AND o.status = 'A'`, [idempresa]
  );

  const { rows: orcamentosProposta } = await pool.query(
  `SELECT COUNT(*)::int AS total
   FROM orcamentos o
   JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
   WHERE oe.idempresa = $1 AND o.status = 'P'`, [idempresa]
  );

  const { rows: orcamentosRecusados } = await pool.query(
  `SELECT COUNT(*)::int AS total
   FROM orcamentos o
   JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
   WHERE oe.idempresa = $1 AND o.status = 'R'`, [idempresa]
  );

  const { rows: orcamentosEmAndamento } = await pool.query(
  `SELECT COUNT(*)::int AS total
   FROM orcamentos o
   JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
   WHERE oe.idempresa = $1 AND o.status = 'E'`, [idempresa]
  );

  // Orçamentos fechados (status = 'F')
  const { rows: orcamentosFechados } = await pool.query(
  `SELECT COUNT(*)::int AS total
   FROM orcamentos o
   JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
   WHERE oe.idempresa = $1 AND o.status = 'F'`, [idempresa]
  );

  // ... (demais queries para eventos, clientes, etc)

  res.json({
  orcamentos: orcamentosTotal[0].total,
  orcamentosAbertos: orcamentosAbertos[0].total,
  orcamentosProposta: orcamentosProposta[0].total,
  orcamentosEmAndamento: orcamentosEmAndamento[0].total,
  orcamentosRecusados: orcamentosRecusados[0].total,
  orcamentosFechados: orcamentosFechados[0].total,
  // eventos, clientes, pedidos, pedidosPendentes...
  });
});

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

  // Busca todos os eventos da empresa nos próximos 5 dias (inclusive hoje)
  const { rows: eventos } = await pool.query(
  `SELECT e.nmevento, o.dtinimontagem
  FROM orcamentos o
  JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
  JOIN eventos e ON e.idevento = o.idevento
  WHERE oe.idempresa = $1
  AND o.dtinimontagem >= CURRENT_DATE
  AND o.dtinimontagem <= CURRENT_DATE + INTERVAL '5 days'
  ORDER BY o.dtinimontagem`,
  [idempresa]
  );

  if (!eventos || eventos.length === 0) {
  return res.json({ eventos: [] });
  }

  // Monta resposta agrupando por data para facilitar o frontend
  const eventosPorData = {};
  eventos.forEach(ev => {
  const dataStr = ev.dtinimontagem.toISOString().split("T")[0]; // "YYYY-MM-DD"
  if (!eventosPorData[dataStr]) eventosPorData[dataStr] = [];
  eventosPorData[dataStr].push({ nmevento: ev.nmevento, data: ev.dtinimontagem });
  });

  // Flatten em um array para o frontend processar
  const respostaFormatada = [];
  Object.keys(eventosPorData).sort().forEach(data => {
  eventosPorData[data].forEach(ev => respostaFormatada.push(ev));
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
router.get("/eventos-abertos", async (req, res) => {
    try {
        const idempresa = req.headers.idempresa || req.query.idempresa;
        const ano = req.query.ano ? Number(req.query.ano) : new Date().getFullYear();

        if (!idempresa) return res.status(400).json({ error: "idempresa não fornecido" });
        const params = [idempresa, ano];

        const baseSql = `
        WITH vagas_orc AS (
            SELECT 
                o.idevento,
                lm.descmontagem AS nmlocalmontagem,
                o.idmontagem, 
                MAX(o.nrorcamento) AS nrorcamento,
                SUM(i.qtditens) AS total_vagas,
                MIN(o.dtinimarcacao) AS dtinimarcacao,
                MAX(o.dtfimmarcacao) AS dtfimmarcacao,
                MIN(o.dtinimontagem) AS dtinimontagem,
                MAX(o.dtfimmontagem) AS dtfimmontagem,
                MIN(o.dtinirealizacao) AS dtinirealizacao,
                MAX(o.dtfimrealizacao) AS dtfimrealizacao,
                MIN(o.dtinidesmontagem) AS dtinidesmontagem,
                MAX(o.dtfimdesmontagem) AS dtfimdesmontagem,
                array_agg(DISTINCT f.idequipe) FILTER (WHERE f.idequipe IS NOT NULL) AS equipes_ids,
                array_agg(DISTINCT eq.nmequipe) FILTER (WHERE eq.nmequipe IS NOT NULL) AS equipes_nomes,
                array_agg(DISTINCT p.nmpavilhao) FILTER (WHERE p.nmpavilhao IS NOT NULL) AS pavilhoes_nomes,
                (
                    SELECT json_agg(row_to_json(t))
                    FROM (
                        SELECT 
                            eq2.idequipe,
                            eq2.nmequipe AS equipe,
                            i2.idfuncao, 
                            f2.descfuncao AS nome_funcao, 
                            SUM(i2.qtditens) AS total_vagas,
                            MIN(i2.periododiariasinicio) AS dtini_vaga,
                            MAX(i2.periododiariasfim) AS dtfim_vaga
                        FROM orcamentoitens i2
                        JOIN funcao f2 ON f2.idfuncao = i2.idfuncao
                        JOIN equipe eq2 ON eq2.idequipe = f2.idequipe
                        JOIN orcamentos o2 ON o2.idorcamento = i2.idorcamento
                        WHERE o2.idevento = o.idevento
                        AND EXTRACT(YEAR FROM o2.dtinirealizacao) = $2
                        AND i2.categoria = 'Produto(s)' 
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
            AND EXTRACT(YEAR FROM o.dtinirealizacao) = $2
            AND i.categoria = 'Produto(s)' 
            GROUP BY o.idevento, lm.descmontagem, o.idmontagem
        ),
        staff_por_funcao AS ( 
            SELECT 
                se.idevento,
                se.idfuncao,
                COUNT(DISTINCT se.idstaff) AS preenchidas 
            FROM staffeventos se
            JOIN orcamentos o ON o.idevento = se.idevento
            JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
            WHERE oe.idempresa = $1 
            AND EXTRACT(YEAR FROM o.dtinirealizacao) = $2
            AND EXISTS (
                SELECT 1 FROM jsonb_array_elements_text(se.datasevento) AS d(dt)
                WHERE EXTRACT(YEAR FROM d.dt::date) = $2
            )
            GROUP BY se.idevento, se.idfuncao
        ),
        staff_contagem AS (
            SELECT 
                vo.idevento,
                COALESCE(SUM(spf.preenchidas), 0) AS total_staff_preenchido
            FROM vagas_orc vo
            LEFT JOIN staff_por_funcao spf ON spf.idevento = vo.idevento
            GROUP BY vo.idevento
        ),
        staff_datas_por_funcao AS (
            SELECT
                se.idevento,
                se.idfuncao,
                array_agg(DISTINCT d.dt) AS datas_staff
            FROM staffeventos se
            LEFT JOIN LATERAL jsonb_array_elements_text(se.datasevento) AS d(dt) ON TRUE
            JOIN orcamentos o ON se.idevento = o.idevento
            JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
            WHERE oe.idempresa = $1
            AND EXTRACT(YEAR FROM o.dtinirealizacao) = $2
            AND EXTRACT(YEAR FROM d.dt::date) = $2
            GROUP BY se.idevento, se.idfuncao
        ),
        cliente_info AS (
            SELECT DISTINCT ON (o.idevento)
                o.idevento, c.idcliente, c.nmfantasia
            FROM orcamentos o
            JOIN clientes c ON c.idcliente = o.idcliente
            WHERE o.idevento IS NOT NULL
            AND EXTRACT(YEAR FROM o.dtinirealizacao) = $2
            ORDER BY o.idevento, o.dtinirealizacao DESC 
        )
        SELECT 
            e.idevento, e.nmevento, vo.nmlocalmontagem, vo.idmontagem, vo.nrorcamento,
            ci.idcliente, ci.nmfantasia,
            COALESCE(vo.pavilhoes_nomes, ARRAY[]::text[]) AS pavilhoes_nomes,
            COALESCE(vo.dtinirealizacao, CURRENT_DATE) AS dtinirealizacao,
            COALESCE(vo.dtfimrealizacao, CURRENT_DATE) AS dtfimrealizacao,
            COALESCE(vo.dtinimarcacao, CURRENT_DATE) AS dtinimarcacao,
            COALESCE(vo.dtfimdesmontagem, CURRENT_DATE) AS dtfimdesmontagem,
            COALESCE(vo.total_vagas, 0) AS total_vagas,
            COALESCE(sc.total_staff_preenchido, 0) AS total_staff,
            (COALESCE(vo.total_vagas, 0) - COALESCE(sc.total_staff_preenchido, 0)) AS vagas_restantes,
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
            'aberto' AS status_evento
        FROM eventos e
        INNER JOIN vagas_orc vo ON vo.idevento = e.idevento
        LEFT JOIN staff_contagem sc ON sc.idevento = e.idevento
        LEFT JOIN cliente_info ci ON ci.idevento = e.idevento
        WHERE (vo.dtfimdesmontagem IS NULL OR vo.dtfimdesmontagem >= CURRENT_DATE)
        ORDER BY COALESCE(vo.dtinirealizacao, CURRENT_DATE) ASC;
        `;

        const { rows } = await pool.query(baseSql, params);
        
        const mappedRows = rows.map(evt => {
            const resumoEquipesMap = (evt.equipes_detalhes || []).reduce((acc, func) => {
                const nomeEquipe = func.equipe;
                const totalVagas = func.total_vagas || 0;
                const preenchidas = func.preenchidas || 0;
                if (!acc[nomeEquipe]) acc[nomeEquipe] = { total: 0, preenchido: 0 };
                acc[nomeEquipe].total += totalVagas;
                acc[nomeEquipe].preenchido += preenchidas;
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

            return { ...evt, resumoEquipes: resumoFormatado };
        });

        return res.json(mappedRows);
    } catch (err) {
        console.error("Erro em /eventos-abertos:", err);
        res.status(500).json({ error: "Erro interno ao buscar eventos abertos." });
    }
});

router.get("/eventos-fechados", async (req, res) => {
    try {
        const idempresa = req.headers.idempresa || req.query.idempresa;
        const ano = req.query.ano ? Number(req.query.ano) : new Date().getFullYear();

        if (!idempresa) return res.status(400).json({ error: "idempresa não fornecido." });
        const params = [idempresa, ano];

        const baseSql = `
        WITH vagas_orc AS (
            SELECT 
                o.idevento, o.idmontagem,
                lm.descmontagem AS nmlocalmontagem,
                MAX(o.nrorcamento) AS nrorcamento,
                SUM(i.qtditens) AS total_vagas,
                MIN(o.dtinimarcacao) AS dtinimarcacao,
                MAX(o.dtfimmarcacao) AS dtfimmarcacao,
                MIN(o.dtinimontagem) AS dtinimontagem,
                MAX(o.dtfimmontagem) AS dtfimmontagem,
                MIN(o.dtinirealizacao) AS dtinirealizacao,
                MAX(o.dtfimrealizacao) AS dtfimrealizacao,
                MIN(o.dtinidesmontagem) AS dtinidesmontagem,
                MAX(o.dtfimdesmontagem) AS dtfimdesmontagem,
                array_agg(DISTINCT f.idequipe) FILTER (WHERE f.idequipe IS NOT NULL) AS equipes_ids,
                array_agg(DISTINCT eq.nmequipe) FILTER (WHERE eq.nmequipe IS NOT NULL) AS equipes_nomes,
                array_agg(DISTINCT p.nmpavilhao) FILTER (WHERE p.nmpavilhao IS NOT NULL) AS pavilhoes_nomes,
                (
                    SELECT json_agg(row_to_json(t))
                    FROM (
                        SELECT 
                            eq2.idequipe, eq2.nmequipe AS equipe,
                            i2.idfuncao, f2.descfuncao AS nome_funcao, 
                            SUM(i2.qtditens) AS total_vagas,
                            MIN(i2.periododiariasinicio) AS dtini_vaga,
                            MAX(i2.periododiariasfim) AS dtfim_vaga
                        FROM orcamentoitens i2
                        JOIN funcao f2 ON f2.idfuncao = i2.idfuncao
                        JOIN equipe eq2 ON eq2.idequipe = f2.idequipe
                        JOIN orcamentos o2 ON o2.idorcamento = i2.idorcamento
                        WHERE o2.idevento = o.idevento
                        AND EXTRACT(YEAR FROM o2.dtinirealizacao) = $2
                        AND i2.categoria = 'Produto(s)' 
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
            AND EXTRACT(YEAR FROM o.dtinirealizacao) = $2
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
            AND EXTRACT(YEAR FROM o.dtinirealizacao) = $2
            AND EXISTS (
                SELECT 1 FROM jsonb_array_elements_text(se.datasevento) AS d(dt)
                WHERE EXTRACT(YEAR FROM d.dt::date) = $2
            )
            GROUP BY se.idevento, se.idfuncao
        ),
        staff_contagem AS (
            SELECT 
                vo.idevento,
                COALESCE(SUM(spf.preenchidas), 0) AS total_staff_preenchido
            FROM vagas_orc vo
            LEFT JOIN staff_por_funcao spf ON spf.idevento = vo.idevento
            GROUP BY vo.idevento
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
            AND EXTRACT(YEAR FROM o.dtinirealizacao) = $2
            AND EXTRACT(YEAR FROM d.dt::date) = $2
            GROUP BY se.idevento, se.idfuncao
        ), 
        cliente_info AS ( 
            SELECT DISTINCT ON (o.idevento)
                o.idevento, c.idcliente, c.nmfantasia
            FROM orcamentos o
            JOIN clientes c ON c.idcliente = o.idcliente
            WHERE o.idevento IS NOT NULL
            AND EXTRACT(YEAR FROM o.dtinirealizacao) = $2
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
            COALESCE(sc.total_staff_preenchido, 0) AS total_staff,
            (COALESCE(vo.total_vagas, 0) - COALESCE(sc.total_staff_preenchido, 0)) AS vagas_restantes,
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
        LEFT JOIN staff_contagem sc ON sc.idevento = e.idevento
        LEFT JOIN cliente_info ci ON ci.idevento = e.idevento
        WHERE (vo.dtfimdesmontagem IS NOT NULL AND vo.dtfimdesmontagem < CURRENT_DATE)
        ORDER BY COALESCE(vo.dtinirealizacao, CURRENT_DATE) DESC;
        `;

        const { rows } = await pool.query(baseSql, params);
        
        const mappedRows = rows.map(evt => {
            const resumoEquipesMap = (evt.equipes_detalhes || []).reduce((acc, func) => {
                const nomeEquipe = func.equipe;
                const totalVagas = func.total_vagas || 0;
                const preenchidas = func.preenchidas || 0;
                if (!acc[nomeEquipe]) acc[nomeEquipe] = { total: 0, preenchido: 0 };
                acc[nomeEquipe].total += totalVagas;
                acc[nomeEquipe].preenchido += preenchidas;
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

            return { ...evt, resumoEquipes: resumoFormatado };
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
    // Pega o ano da query ou do sistema
    const ano = req.query.ano ? Number(req.query.ano) : new Date().getFullYear();

    if (!idevento || !idempresa) {
      return res.status(400).json({ error: "Parâmetros 'idevento' e 'idempresa' são obrigatórios." });
    }

    // 1️⃣ Busca orçamento principal filtrando pelo ANO de realização
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

    // 2️⃣ Busca Itens do Orçamento (Vagas) - Agora incluindo SETOR
    const { rows: itensOrcamento } = await pool.query(
      `SELECT 
        f.idequipe, 
        eq.nmequipe AS equipe, 
        i.idfuncao, 
        f.descfuncao AS funcao,
        i.setor,
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

    // 3️⃣ Busca quantidades cadastradas - TRAVA ANO com EXISTS para ignorar lixo de 2025
    const { rows: staff } = await pool.query(
      `SELECT se.idfuncao, COUNT(DISTINCT se.idstaff) AS qtd_cadastrada
       FROM staffeventos se
       WHERE se.idevento = $1 
         AND se.idcliente = $2
         AND EXISTS (
             SELECT 1 
             FROM jsonb_array_elements_text(se.datasevento) AS d(dt)
             WHERE EXTRACT(YEAR FROM (d.dt)::date) = $3
         )
       GROUP BY se.idfuncao`,
      [idevento, idcliente, ano]
    );

    // 4️⃣ Busca Datas de Staff por Função - TRAVA ANO dentro do JSON
    const { rows: datasStaffRaw } = await pool.query(
      `SELECT 
          se.idfuncao, 
          array_agg(DISTINCT d.dt ORDER BY d.dt) AS datas_staff
       FROM staffeventos se
       INNER JOIN orcamentos o ON o.idevento = se.idevento
       CROSS JOIN LATERAL (
           SELECT dt FROM jsonb_array_elements_text(se.datasevento) AS dt
           WHERE EXTRACT(YEAR FROM dt::date) = $2
       ) AS d
       WHERE se.idevento = $1 AND se.idcliente = $3
       GROUP BY se.idfuncao`,
      [idevento, ano, idcliente]
    );

    const datasStaffMap = datasStaffRaw.reduce((acc, row) => {
      acc[String(row.idfuncao)] = row.datas_staff;
      return acc;
    }, {});

    // 5️⃣ Agrupa por equipe
    const equipesMap = {};
    for (const item of itensOrcamento) {
      const idequipe = item.idequipe;
      const idequipeKey = idequipe || "SEM_EQUIPE";

      if (!equipesMap[idequipeKey]) {
        equipesMap[idequipeKey] = {
          equipe: item.equipe || "Sem equipe",
          idequipe: idequipe,
          funcoes: [],
        };
      }

      // Procura a quantidade preenchida para esta função específica
      const cadastrado = staff.find(s => String(s.idfuncao) === String(item.idfuncao)); 
      const qtd_cadastrada = cadastrado ? Number(cadastrado.qtd_cadastrada) : 0;
      const datas_staff = datasStaffMap[String(item.idfuncao)] || [];

      equipesMap[idequipeKey].funcoes.push({
        idfuncao: item.idfuncao,
        nome: item.setor ? `${item.funcao} (${item.setor})` : item.funcao,
        qtd_orcamento: Number(item.qtd_orcamento) || 0,
        qtd_cadastrada,
        concluido: qtd_cadastrada >= (Number(item.qtd_orcamento) || 0),
        dtini_vaga: item.dtini_vaga,
        dtfim_vaga: item.dtfim_vaga,
        datas_staff: datas_staff
      });
    }

    // 6️⃣ Retorno final
    res.status(200).json({ 
      equipes: Object.values(equipesMap), 
      idmontagem 
    });

  } catch (err) {
    console.error("Erro ao buscar detalhes dos eventos abertos:", err);
    res.status(500).json({ error: "Erro interno ao buscar detalhes dos eventos abertos." });
  }
});

router.get("/ListarFuncionarios", async (req, res) => {
  // Pega o idempresa da query ou do objeto de requisição (middleware)
  const idempresa = req.query.idempresa || req.idempresa;
  const { idEvento, idEquipe, ano } = req.query;
  
  const anoFiltro = ano ? Number(ano) : new Date().getFullYear();

  if (!idEvento || !idEquipe || !idempresa) {
    return res.status(400).json({ erro: "Parâmetros idEvento, idEquipe e idempresa são obrigatórios." });
  }

  try {
    const query = `
    SELECT 
        se.idstaffevento, 
        se.idfuncionario, 
        se.nmfuncionario AS nome, 
        se.nmfuncao AS funcao, 
        se.vlrtotal, 
        se.statuspgto AS status_pagamento,
        se.setor,
        se.nivelexperiencia
    FROM public.staffeventos se
    INNER JOIN orcamentos o ON o.idevento = se.idevento
    INNER JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
    WHERE se.idevento = $1 
      AND se.idequipe = $2 
      AND oe.idempresa = $3
      -- Filtro de ano baseado na data de início do orçamento
      AND EXTRACT(YEAR FROM o.dtinimarcacao) = $4 
    ORDER BY se.nmfuncao, se.nmfuncionario;`;

    const { rows } = await pool.query(query, [idEvento, idEquipe, idempresa, anoFiltro]);
    res.status(200).json(rows);
  } catch (erro) {
    console.error("Erro ListarFuncionarios:", erro);
    res.status(500).json({ erro: 'Erro interno ao listar funcionários.' });
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
// router.get('/notificacoes-financeiras', async (req, res) => {
//   try {
//   const idempresa = req.idempresa || req.headers.idempresa;
//   const idusuario = req.usuario?.idusuario || req.headers.idusuario;

//   if (!idempresa) return res.status(400).json({ error: 'Empresa não informada' });
//   if (!idusuario) return res.status(400).json({ error: 'Usuário não informado' });

//   // Checa se o usuário é Master no Staff via tabela de permissões
//   const { rows: permissoes } = await pool.query(`
//   SELECT * FROM permissoes 
//   WHERE idusuario = $1 AND modulo = 'Staff' AND master = 'true'
//   `, [idusuario]);
//   const ehMasterStaff = permissoes.length > 0;

//   // Busca logs (trazendo também status atuais da tabela staffeventos e dtfim das "ordens")
//   const { rows } = await pool.query(`
//   SELECT DISTINCT ON (
//   COALESCE(l.idusuarioalvo, (l.dadosnovos->>'idfuncionario')::int),
//   COALESCE(e.idevento, (l.dadosnovos->>'idevento')::int),
//   COALESCE(se.vlrcaixinha, (l.dadosnovos->>'vlrcaixinha')::numeric),
//   COALESCE(se.vlrajustecusto, (l.dadosnovos->>'vlrajustecusto')::numeric),
//   COALESCE(se.dtdiariadobrada::text, l.dadosnovos->>'datadiariadobrada'),
//   COALESCE(se.dtmeiadiaria::text, l.dadosnovos->>'datameiadiaria'),
//   COALESCE(se.descajustecusto, l.dadosnovos->>'descajustecusto'),
//   COALESCE(se.desccaixinha, l.dadosnovos->>'desccaixinha'),
//   COALESCE(se.descdiariadobrada, l.dadosnovos->>'descdiariadobrada'),
//   COALESCE(se.descmeiadiaria, l.dadosnovos->>'descmeiadiaria'),
//   l.idexecutor
//   )
//   l.idregistroalterado AS id,
//   l.idexecutor,
//   COALESCE(l.idusuarioalvo, (l.dadosnovos->>'idfuncionario')::int) AS idusuarioalvo,
//   COALESCE(f.nome, l.dadosnovos->>'nmfuncionario') AS nomefuncionario,
//   (u.nome || ' ' || u.sobrenome) AS nomesolicitante,

//   -- JSON completo
//   l.dadosnovos,

//   -- Datas e valores (prioriza staffeventos)
//   COALESCE(se.datasevento::text, l.dadosnovos->>'datasevento') AS datasevento,
//   COALESCE(se.vlrcaixinha::text, l.dadosnovos->>'vlrcaixinha') AS vlrcaixinha,
//   COALESCE(se.desccaixinha, l.dadosnovos->>'desccaixinha') AS desccaixinha,
//   COALESCE(se.vlrajustecusto::text, l.dadosnovos->>'vlrajustecusto') AS vlrajustecusto,
//   COALESCE(se.descajustecusto, l.dadosnovos->>'descajustecusto') AS descajustecusto,
//   COALESCE(se.dtmeiadiaria::text, l.dadosnovos->>'datameiadiaria') AS dtmeiadiaria,
//   COALESCE(se.descmeiadiaria, l.dadosnovos->>'descmeiadiaria') AS descmeiadiaria,
//   COALESCE(se.dtdiariadobrada::text, l.dadosnovos->>'datadiariadobrada') AS dtdiariadobrada,
//   COALESCE(se.descdiariadobrada, l.dadosnovos->>'descdiariadobrada') AS descdiariadobrada,

//   -- Status atualizados (prioriza staffeventos)
//   COALESCE(se.statuscaixinha::text, l.dadosnovos->>'statuscaixinha') AS statuscaixinha,
//   COALESCE(se.statusajustecusto::text, l.dadosnovos->>'statusajustecusto') AS statusajustecusto,
//   COALESCE(se.statusmeiadiaria::text, l.dadosnovos->>'statusmeiadiaria') AS statusmeiadiaria,
//   COALESCE(se.statusdiariadobrada::text, l.dadosnovos->>'statusdiariadobrada') AS statusdiariadobrada,

//   e.nmevento AS evento,
//   COALESCE(o.dtfiminfradesmontagem, o.dtfimdesmontagem) AS dtfimrealizacao,
//   l.criado_em,
//   l.modulo

//   FROM logs l
//   LEFT JOIN funcionarios f ON f.idfuncionario = l.idusuarioalvo
//   LEFT JOIN usuarios u ON u.idusuario = l.idexecutor
//   LEFT JOIN eventos e ON e.idevento = NULLIF(l.dadosnovos->>'idevento','')::int
//   LEFT JOIN staffeventos se 
//   ON se.idstaffevento = l.idregistroalterado 
//   OR se.idfuncionario = COALESCE(l.idusuarioalvo, (l.dadosnovos->>'idfuncionario')::int)
//   LEFT JOIN orcamentos o ON o.idevento = e.idevento

//   WHERE l.idempresa = $1
//   AND l.modulo IN ('staffeventos')
//   AND ($2 = TRUE OR l.idexecutor = $3)

//   -- ✅ FILTRO: só traz se algum valor for diferente de zero
//   AND (
//   COALESCE(se.vlrcaixinha, (l.dadosnovos->>'vlrcaixinha')::numeric, 0) != 0 OR
//   COALESCE(se.vlrajustecusto, (l.dadosnovos->>'vlrajustecusto')::numeric, 0) != 0 OR
//   COALESCE(se.dtdiariadobrada::text, l.dadosnovos->>'datadiariadobrada') IS NOT NULL OR
//   COALESCE(se.dtmeiadiaria::text, l.dadosnovos->>'datameiadiaria') IS NOT NULL
//   )

//   -- 🔥 O ORDER BY precisa começar com os mesmos campos do DISTINCT ON
//   ORDER BY 
//   COALESCE(l.idusuarioalvo, (l.dadosnovos->>'idfuncionario')::int),
//   COALESCE(e.idevento, (l.dadosnovos->>'idevento')::int),
//   COALESCE(se.vlrcaixinha, (l.dadosnovos->>'vlrcaixinha')::numeric),
//   COALESCE(se.vlrajustecusto, (l.dadosnovos->>'vlrajustecusto')::numeric),
//   COALESCE(se.dtdiariadobrada::text, l.dadosnovos->>'datadiariadobrada'),
//   COALESCE(se.dtmeiadiaria::text, l.dadosnovos->>'datameiadiaria'),
//   COALESCE(se.descajustecusto, l.dadosnovos->>'descajustecusto'),
//   COALESCE(se.desccaixinha, l.dadosnovos->>'desccaixinha'),
//   COALESCE(se.descdiariadobrada, l.dadosnovos->>'descdiariadobrada'),
//   COALESCE(se.descmeiadiaria, l.dadosnovos->>'descmeiadiaria'),
//   l.idexecutor,
//   l.criado_em DESC;
//   `, [idempresa, ehMasterStaff, idusuario]);

//   // Monta os pedidos
//   const pedidos = rows.map(r => {
//   let dados = {};
//   try { dados = JSON.parse(r.dadosnovos); } catch { /* ignore */ } 

//   function parseValor(v) {
//   if (!v) return 0;
//   if (typeof v === 'number') return v;
//   return parseFloat(String(v).replace(',', '.')) || 0;
//   }

//   function montarCampo(info, valorRaw, descricaoRaw, datasRaw) {
//   const valor = parseValor(valorRaw);
//   const descricao = descricaoRaw && descricaoRaw !== '-' ? descricaoRaw : null;
//   let datas = [];
//   if (datasRaw) {
//   try { datas = JSON.parse(datasRaw); } catch {}
//   }

//   // status normalizado + cor
//   let status = 'Pendente';
//   let cor = '#facc15';
//   if (info && typeof info === 'string') {
//   const lower = info.toLowerCase();
//   if (lower === 'autorizado') { status = 'Autorizado'; cor = '#16a34a'; }
//   else if (lower === 'rejeitado') { status = 'Rejeitado'; cor = '#dc2626'; }
//   else status = info;
//   }

//   if (valor > 0 || descricao || (datas && datas.length > 0)) {
//   return { evento: r.evento, status, cor, valor, descricao, datas };
//   }
//   return null;
//   }

//   return {
//   idpedido: r.id,
//   solicitante: r.idexecutor,
//   nomeSolicitante: r.nomesolicitante || '-',
//   funcionario: r.nomefuncionario || dados.nmfuncionario || '-',
//   evento: r.evento,
//   tipopedido: 'Financeiro',
//   criado_em: r.criado_em,
//   datasevento: r.datasevento || dados.datasevento || '-',
//   dtfimdesmontagem: r.dtfimdesmontagem || dados.dtfimdesmontagem || null,
//   quantidade: r.quantidade || dados.quantidade || 1,
//   vlrtotal: parseValor(r.vlrtotal || dados.vlrtotal),
//   descricao: r.desccaixinha || r.descmeiadiaria || dados.desccaixinha || dados.descmeiadiaria || '-',

//   statuscaixinha: montarCampo(r.statuscaixinha || dados.statuscaixinha, r.vlrcaixinha || dados.vlrcaixinha, r.desccaixinha || dados.desccaixinha),
//   statusajustecusto: montarCampo(r.statusajustecusto || dados.statusajustecusto, r.vlrajustecusto || dados.vlrAjusteCusto, r.descajustecusto || dados.descajustecusto),
//   statusdiariadobrada: montarCampo(r.statusdiariadobrada || dados.statusdiariadobrada, null, r.descdiariadobrada || dados.descdiariadobrada, r.vlrdiariadobrada || dados.vlrdiariadobrada),
//   statusmeiadiaria: montarCampo(r.statusmeiadiaria || dados.statusmeiadiaria, null, r.descmeiadiaria || dados.descmeiadiaria, r.vlrmeiadiaria || dados.vlrmeiadiaria)
//   };
//   })


//   .filter(p => {
//   const campos = ['statuscaixinha','statusajustecusto','statusdiariadobrada','statusmeiadiaria'];
//   // mantém apenas se tiver algum campo relevante
//   const temRelevancia = campos.some(c => p[c] !== null);
//   if (!temRelevancia) return false;

//   // se qualquer campo já está aprovado ou rejeitado -> não mostrar (regra que você pediu)
//   //  const jaFinalizado = campos.some(c => {
//   //  const st = p[c]?.status;
//   //  return st && ['Autorizado','Rejeitado'].includes(String(st).toLowerCase());
//   //  });
//   //  if (jaFinalizado) return false;

//   // se existe dtfimdesmontagem, remove 2 dias após fim do evento
//   if (p.dtfiminfradesmontagem || p.dtfimdesmontagem) {
//   const fim = new Date(p.dtfiminfradesmontagem || p.dtfimdesmontagem);

//   if (!isNaN(fim.getTime())) {
//   const limite = new Date(fim);
//   limite.setDate(fim.getDate() + 10); // mantém o prazo de 10 dias após o fim

//   if (new Date() > limite) return false; // passou do prazo -> remove
//   }
//   }


//   return true;
//   }); 

//   res.json(pedidos);

//   } catch (err) {
//   console.error('Erro ao buscar notificações financeiras:', err.stack || err);
//   res.status(500).json({ error: 'Erro ao buscar notificações financeiras' });
//   }
// });

// router.get('/notificacoes-financeiras', async (req, res) => {
//   try {
//   const idempresa = req.idempresa || req.headers.idempresa;
//   const idusuario = req.usuario?.idusuario || req.headers.idusuario;

//   if (!idempresa) return res.status(400).json({ error: 'Empresa não informada' });
//   if (!idusuario) return res.status(400).json({ error: 'Usuário não informado' });

//   // Checa se o usuário é Master no Staff via tabela de permissões (mantido por segurança, embora a query retorne tudo)
//   const { rows: permissoes } = await pool.query(`
//   SELECT * FROM permissoes 
//   WHERE idusuario = $1 AND modulo = 'Staff' AND master = 'true'
//   `, [idusuario]);
//   const ehMasterStaff = permissoes.length > 0;

//   // Se o usuário não for Master Staff, você pode querer retornar um erro 403 (Proibido)
//   if (!ehMasterStaff) {
//    return res.status(403).json({ error: 'Acesso negado. Necessária permissão Master Staff.' });
//   }


//   // Consulta SQL Otimizada e Corrigida
//   const { rows } = await pool.query(`
//   WITH OriginalExecutor AS (
//   -- 1. Encontra o ID do executor (solicitante) e a data de criação (criado_em) mais antigos
//   SELECT DISTINCT ON (idregistroalterado)
//   idregistroalterado AS idstaffevento,
//   idexecutor,
//   criado_em
//   FROM
//   logs
//   WHERE
//   modulo = 'staffeventos'
//   AND idempresa = $1 -- 🎯 FILTRO DA EMPRESA
//   ORDER BY
//   idregistroalterado,
//   criado_em ASC
//   )

//   SELECT DISTINCT ON (se.idstaffevento) -- Desduplicando pelo ID Único do Pedido (se.idstaffevento)
//   se.idstaffevento AS id,
//   oe.idexecutor, 
//   (u.nome || ' ' || u.sobrenome) AS nomesolicitante,
//   f.nome AS nomefuncionario,
//   e.nmevento AS evento,

//   se.vlrcaixinha::text,
//   se.desccaixinha,
//   se.statuscaixinha,

//   se.vlrajustecusto::text,
//   se.descajustecusto,
//   se.statusajustecusto,

//   se.dtdiariadobrada::text,
//   se.descdiariadobrada,
//   se.statusdiariadobrada,

//   se.dtmeiadiaria::text,
//   se.descmeiadiaria,
//   se.statusmeiadiaria,

//   se.datasevento::text,
//   oe.criado_em, 
//   se.idfuncionario AS idusuarioalvo,
//   COALESCE(o.dtfiminfradesmontagem, o.dtfimdesmontagem) AS dtfimrealizacao

//   FROM
//   staffeventos se
//   LEFT JOIN -- LEFT JOIN para não perder registros sem log
//   OriginalExecutor oe ON oe.idstaffevento = se.idstaffevento 
//   LEFT JOIN
//   funcionarios f ON f.idfuncionario = se.idfuncionario
//   LEFT JOIN
//   usuarios u ON u.idusuario = oe.idexecutor 
//   LEFT JOIN
//   eventos e ON e.idevento = se.idevento
//   LEFT JOIN
//   orcamentos o ON o.idevento = e.idevento

//   WHERE
//   -- FILTRO DE STATUS: Pelo menos UM dos status precisa ter sido definido (diferente de NULL)
//   (
//   se.statuscaixinha IS NOT NULL OR
//   se.statusajustecusto IS NOT NULL OR
//   se.statusdiariadobrada IS NOT NULL OR
//   se.statusmeiadiaria IS NOT NULL
//   )
//   AND
//   -- FILTRO DE VALOR/DATA: Pelo menos UM dos valores/datas precisa ser relevante
//   (
//   (se.vlrcaixinha IS NOT NULL AND se.vlrcaixinha != 0) OR
//   (se.vlrajustecusto IS NOT NULL AND se.vlrajustecusto != 0) OR
//   se.dtdiariadobrada IS NOT NULL OR
//   se.dtmeiadiaria IS NOT NULL
//   )

//   ORDER BY
//   se.idstaffevento, -- Necessário para DISTINCT ON
//   oe.criado_em DESC;
//   `, [idempresa]); // A query usa apenas $1 (idempresa)

//   // Monta os pedidos (Lógica de transformação mantida da sua rota original)
//   const pedidos = rows.map(r => {
//   let dados = {};
//   // A query agora prioriza os dados de staffeventos, o log.dadosnovos é menos relevante
//   // mas mantemos o parse por segurança
//   try { dados = JSON.parse(r.dadosnovos); } catch { /* ignore */ }  

//   function parseValor(v) {
//   if (!v) return 0;
//   if (typeof v === 'number') return v;
//   // O valor já é string (se.vlrcaixinha::text), então pode ser float diretamente
//   return parseFloat(String(v).replace(',', '.')) || 0;
//   }

//   function montarCampo(info, valorRaw, descricaoRaw, datasRaw) {
//   // Se o status for NULL (caso não tenha log correspondente), ignora o campo
//   if (info === null) return null; 

//   const valor = parseValor(valorRaw);
//   const descricao = descricaoRaw && descricaoRaw !== '-' ? descricaoRaw : null;
//   let datas = [];
//   if (datasRaw) {
//   // Se o campo for de data (dtdiariadobrada/dtmeiadiaria), o valorRaw é uma data e não um array.
//   // Para diárias, a lógica é diferente do valor monetário.
//   if (datasRaw && String(datasRaw).startsWith('[')) {
//    try { datas = JSON.parse(datasRaw); } catch {}
//   }
//   }

//   // status normalizado + cor
//   let status = 'Pendente';
//   let cor = '#facc15';
//   if (info && typeof info === 'string') {
//   const lower = info.toLowerCase();
//   if (lower === 'aprovado' || lower === 'autorizado') { status = 'Autorizado'; cor = '#16a34a'; }
//   else if (lower === 'rejeitado') { status = 'Rejeitado'; cor = '#dc2626'; }
//   else status = info;
//   }

//   // O campo só é relevante se for valor > 0 OU tiver descrição OU tiver datas (para diárias)
//   // O filtro WHERE no SQL já garante isso, mas este é o filtro final
//   if (valor > 0 || descricao || (datas && datas.length > 0) || datasRaw) {
//   return { status, cor, valor, descricao, datas: datas.length > 0 ? datas : (datasRaw ? [datasRaw] : []) };
//   }
//   return null;
//   }

//   return {
//       idpedido: r.id,
//       solicitante: r.idexecutor || null, // Pode ser NULL se não achou log
//       nomeSolicitante: r.nomesolicitante || '-',
//       funcionario: r.nomefuncionario || '-',
//       evento: r.evento,
//       tipopedido: 'Financeiro',
//       criado_em: r.criado_em,
//       datasevento: r.datasevento || '-',
//       dtfimrealizacao: r.dtfimrealizacao || null,
//       // vlrtotal e descricao são consolidações, não mudam a lógica
//       vlrtotal: parseValor(r.vlrcaixinha || r.vlrajustecusto),
//       descricao: r.desccaixinha || r.descajustecusto || r.descdiariadobrada || r.descmeiadiaria || '-',

//       // Note: Para diárias, você deve passar o campo de data (dtdiariadobrada/dtmeiadiaria) no lugar do valorRaw,
//       // e o campo de valor monetário fica nulo (a menos que a diária tenha valor fixo na tabela)
//       statuscaixinha: montarCampo(r.statuscaixinha, r.vlrcaixinha, r.desccaixinha),
//       statusajustecusto: montarCampo(r.statusajustecusto, r.vlrajustecusto, r.descajustecusto),

//       // Diárias: Usamos a data para relevância, valorRaw é 0
//       statusdiariadobrada: montarCampo(r.statusdiariadobrada, 0, r.descdiariadobrada, r.dtdiariadobrada),
//       statusmeiadiaria: montarCampo(r.statusmeiadiaria, 0, r.descmeiadiaria, r.dtmeiadiaria)
//       };
//   })
//   .filter(p => {
//     const campos = ['statuscaixinha', 'statusajustecusto', 'statusdiariadobrada', 'statusmeiadiaria'];

//   // Relevância: Mantém apenas se tiver algum campo com status/valor/data preenchido (SQL já fez isso, mas repetimos para o filtro final)
//     const temRelevancia = campos.some(c => p[c] !== null);
//     if (!temRelevancia) return false;

//     /*
//     // Lógica de Prazo (10 dias após o fim do evento) - DESATIVADO PARA TESTE
//     if (p.dtfimrealizacao) {
//     const fim = new Date(p.dtfimrealizacao);

//     if (!isNaN(fim.getTime())) {
//     const limite = new Date(fim);
//     limite.setDate(fim.getDate() + 10); // Mantém o prazo de 10 dias

//     if (new Date() > limite) return false; // Passou do prazo -> remove
//     }
//     }
//     */

//     return true;
//   }); 

//   res.json(pedidos);

//   } catch (err) {
//     console.error('Erro ao buscar notificações financeiras:', err.stack || err);
//     res.status(500).json({ error: 'Erro ao buscar notificações financeiras' });
//   }
// });


router.get('/notificacoes-financeiras', async (req, res) => {
    try {
        const idempresa = req.idempresa || req.headers.idempresa;
        const idusuario = req.usuario?.idusuario || req.headers.idusuario;

        if (!idempresa) return res.status(400).json({ error: 'Empresa não informada' });
        if (!idusuario) return res.status(400).json({ error: 'Usuário não informado' });

        // 1. Busca todas as permissões de uma vez
        const { rows: allPermissoes } = await pool.query(`
            SELECT modulo, master FROM permissoes 
            WHERE idusuario = $1
        `, [idusuario]);

        // 2. Define o acesso de Master (apenas para botões de Aprovação/Rejeição)
        const ehMasterStaff = allPermissoes.some(p => p.modulo === 'Staff' && p.master === 'true');

        // 3. Define a permissão de Visualização Total (AGORA CHECA SE O MÓDULO 'Staff' EXISTE)
        // Se o módulo Financeiro ou Aditivo Extra fosse adicionado, ele também concederia o acesso.
        const temPermissaoVisualizacaoTotal = allPermissoes.some(p => 
            p.modulo === 'Staff' || p.modulo.toLowerCase().includes('financeiro')
        );
        
        const podeVerTodos = ehMasterStaff || temPermissaoVisualizacaoTotal; 

        // 4. Lógica de Filtro Condicional
        let filtroSolicitante = '';
        const params = [idempresa]; 

        // Se PODE VER TODOS for TRUE, o filtroSolicitante será vazio.
        if (!podeVerTodos) {
            filtroSolicitante = `AND oe.idexecutor = $2`;
            params.push(idusuario); 
        }

        // DEBUG
        console.log(`[FINAL QUERY STATE] Financeiro | PodeVerTodos: ${podeVerTodos} | Filtro: "${filtroSolicitante}" | Params: ${params.join(', ')}`);


        // 5. Consulta SQL Otimizada
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
            (se.vlrcaixinha IS NOT NULL AND se.vlrcaixinha != 0) OR          
            (se.vlrajustecusto IS NOT NULL AND se.vlrajustecusto != 0) OR          
            (se.dtdiariadobrada IS NOT NULL AND se.dtdiariadobrada <> '[]'::jsonb) OR           
            (se.dtmeiadiaria IS NOT NULL AND se.dtmeiadiaria <> '[]'::jsonb)
        )
        ${filtroSolicitante} 

        ORDER BY se.idstaffevento, oe.criado_em DESC;
        `;
        
        const { rows } = await pool.query(query, params); 
        console.log(`[FINANCEIRO DEBUG] Linhas retornadas do DB: ${rows.length}`);
        // console.log("Dados retornados", rows);

        // 6. Mapeamento e Resposta
        const pedidos = rows.map(r => {
            function parseValor(v) {
                if (!v) return 0;
                if (typeof v === 'number') return v;
                return parseFloat(String(v).replace(',', '.')) || 0;
            }

            function montarCampo(info, valorRaw, descricaoRaw, datasRaw) {
                if (info === null) return null; 

                const valor = parseValor(valorRaw);
                const descricao = descricaoRaw && descricaoRaw !== '-' ? descricaoRaw : null;
                let datas = [];
                if (datasRaw) {
                    if (datasRaw && String(datasRaw).startsWith('[')) {
                        try { datas = JSON.parse(datasRaw); } catch {}
                    } else if (datasRaw) {
                        datas = [{ data: datasRaw, valor: 0 }]; 
                    }
                }

                let status = 'Pendente';
                let cor = '#facc15';
                if (info && typeof info === 'string') {
                    const lower = info.toLowerCase();
                    if (lower === 'aprovado' || lower === 'autorizado') { status = 'Autorizado'; cor = '#16a34a'; }
                    else if (lower === 'rejeitado') { status = 'Rejeitado'; cor = '#dc2626'; }
                    else status = info;
                }

                if (valor > 0 || descricao || (datas && datas.length > 0) || datasRaw) {
                    return { 
                        status, 
                        cor, 
                        valor, 
                        descricao, 
                        datas: datas.length > 0 ? datas.map(d => ({ data: d.data || d, valor: d.valor || 0 })) : (datasRaw ? [{ data: datasRaw, valor: 0 }] : []) 
                    };
                }
                return null;
            }

            return {
                idpedido: r.id,
                solicitante: r.idexecutor || null, 
                nomeSolicitante: r.nomesolicitante || '-',
                funcionario: r.nomefuncionario || '-',
                evento: r.evento,
                tipopedido: 'Financeiro',
                criado_em: r.criado_em,
                datasevento: r.datasevento || '-',
                dtfimrealizacao: r.dtfimrealizacao || null,
                vlrtotal: parseValor(r.vlrcaixinha || r.vlrajustecusto),
                descricao: r.desccaixinha || r.descajustecusto || r.descdiariadobrada || r.descmeiadiaria || '-',

                ehMasterStaff: ehMasterStaff, 
                podeVerTodos: podeVerTodos, 

                statuscaixinha: montarCampo(r.statuscaixinha, r.vlrcaixinha, r.desccaixinha),
                statusajustecusto: montarCampo(r.statusajustecusto, r.vlrajustecusto, r.descajustecusto),
                statusdiariadobrada: montarCampo(r.statusdiariadobrada, 0, r.descdiariadobrada, r.dtdiariadobrada),
                statusmeiadiaria: montarCampo(r.statusmeiadiaria, 0, r.descmeiadiaria, r.dtmeiadiaria)
                };
        })
        .filter(p => {
            const campos = ['statuscaixinha', 'statusajustecusto', 'statusdiariadobrada', 'statusmeiadiaria'];
            const temRelevancia = campos.some(c => p[c] !== null);
            return temRelevancia;
        }); 

        res.json(pedidos);

    } catch (err) {
        console.error('Erro ao buscar notificações financeiras:', err.stack || err);
        res.status(500).json({ error: 'Erro ao buscar notificações financeiras' });
    }
});

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

router.patch('/aditivoextra/:idAditivoExtra/status',
  autenticarToken(),
  contextoEmpresa,
  verificarPermissao('staff', 'cadastrar'),
  logMiddleware('aditivoextra', {
  buscarDadosAnteriores: async (req) => {
  const id = req.params.idAditivoExtra;

  // 💡 Mantida a correção de segurança para evitar erro 22P02 no log middleware
  if (!id || isNaN(parseInt(id))) return null;

  // Usa a coluna justificativa que já existe no banco
  const query = `SELECT idaditivoextra, status, tiposolicitacao, justificativa FROM AditivoExtra WHERE idAditivoExtra = $1`;
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
// =======================================



// =======================================
// VENCIMENTOS
// =======================================
router.get("/vencimentos", async (req, res) => {
    const fmt = d => {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    };

    try {
        const idempresa = req.idempresa;
        if (!idempresa) return res.status(400).json({ error: "idempresa obrigatório." });

        // --- LÓGICA DE FILTROS RESTAURADA ---
        const periodo = (req.query.periodo || 'anual').toLowerCase();
        const dataInicioQuery = req.query.dataInicio;
        const mes = parseInt(req.query.mes, 10);
        const anoFiltro = parseInt(req.query.ano, 10) || new Date().getFullYear();
        const trimestre = parseInt(req.query.trimestre, 10);
        const semestre = parseInt(req.query.semestre, 10);

        let startDate, endDate;
        let dataBase;

        if (periodo === "diario") {
            dataBase = dataInicioQuery ? new Date(dataInicioQuery + 'T00:00:00') : new Date();
            startDate = fmt(dataBase);
            endDate = fmt(dataBase);
        } else if (periodo === "semanal") {
            dataBase = dataInicioQuery ? new Date(dataInicioQuery + 'T00:00:00') : new Date();
            const diaSemana = dataBase.getDay();
            const primeiro = new Date(dataBase);
            primeiro.setDate(dataBase.getDate() - diaSemana);
            startDate = fmt(primeiro);
            const ultimo = new Date(primeiro);
            ultimo.setDate(primeiro.getDate() + 6);
            endDate = fmt(ultimo);
        } else if (periodo === "mensal") {
            const m = (!isNaN(mes) ? mes : new Date().getMonth() + 1);
            startDate = fmt(new Date(anoFiltro, m - 1, 1));
            endDate = fmt(new Date(anoFiltro, m, 0));
        } else if (periodo === "trimestral") {
            const t = (!isNaN(trimestre) ? trimestre : Math.ceil((new Date().getMonth() + 1) / 3));
            startDate = fmt(new Date(anoFiltro, (t - 1) * 3, 1));
            endDate = fmt(new Date(anoFiltro, t * 3, 0));
        } else if (periodo === "semestral") {
            const s = (!isNaN(semestre) ? semestre : (new Date().getMonth() <= 5 ? 1 : 2));
            startDate = fmt(new Date(anoFiltro, s === 1 ? 0 : 6, 1));
            endDate = fmt(new Date(anoFiltro, s === 1 ? 6 : 12, 0));
        } else { // anual
            startDate = `${anoFiltro}-01-01`;
            endDate = `${anoFiltro}-12-31`;
        }

        // --- QUERY DE AGREGAÇÃO CORRIGIDA ---
        // Removi a variável complexa 'whereVencimentoPendente' que estava causando o erro de parâmetro $4
        const queryAgregacao = `
            SELECT
                tse.idevento, e.nmevento,
                MAX(torc.dtinimarcacao) AS dt_inicio,
                MAX(torc.dtfimrealizacao) AS dt_fim,
                -- Ajuda de Custo
                COALESCE(SUM((COALESCE(tse.vlralmoco,0)+COALESCE(tse.vlralimentacao,0)+COALESCE(tse.vlrtransporte,0)) * GREATEST(jsonb_array_length(tse.datasevento), 1)), 0) AS ajuda_total,
                COALESCE(SUM((COALESCE(tse.vlralmoco,0)+COALESCE(tse.vlralimentacao,0)+COALESCE(tse.vlrtransporte,0)) * GREATEST(jsonb_array_length(tse.datasevento), 1)) 
                    FILTER (WHERE tse.statuspgtoajdcto LIKE 'Pago%'), 0) AS ajuda_paga,
                COALESCE(SUM((COALESCE(tse.vlralmoco,0)+COALESCE(tse.vlralimentacao,0)+COALESCE(tse.vlrtransporte,0)) * GREATEST(jsonb_array_length(tse.datasevento), 1)) 
                    FILTER (WHERE tse.statuspgtoajdcto = 'Pendente' OR tse.statuspgtoajdcto IS NULL), 0) AS ajuda_pendente,
                -- Cachê
                COALESCE(SUM(COALESCE(tse.vlrcache,0) * GREATEST(jsonb_array_length(tse.datasevento), 1)), 0) AS cache_total,
                COALESCE(SUM(COALESCE(tse.vlrcache,0) * GREATEST(jsonb_array_length(tse.datasevento), 1)) 
                    FILTER (WHERE tse.statuspgto LIKE 'Pago%'), 0) AS cache_pago,
                COALESCE(SUM(COALESCE(tse.vlrcache,0) * GREATEST(jsonb_array_length(tse.datasevento), 1)) 
                    FILTER (WHERE tse.statuspgto = 'Pendente' OR tse.statuspgto IS NULL), 0) AS cache_pendente
            FROM staffeventos tse
            JOIN eventos e ON tse.idevento = e.idevento
            JOIN orcamentos torc ON tse.idevento = torc.idevento
            JOIN orcamentoempresas oe ON torc.idorcamento = oe.idorcamento
            WHERE oe.idempresa = $1 
              AND torc.dtinimarcacao BETWEEN $2 AND $3
            GROUP BY tse.idevento, e.nmevento;
        `;

        const { rows: eventos } = await pool.query(queryAgregacao, [idempresa, startDate, endDate]);

        if (eventos.length === 0) return res.json({ periodo, startDate, endDate, eventos: [] });

        // --- QUERY DE DETALHES ---
        const idsEventos = eventos.map(e => e.idevento);
        const queryDetalhes = `
            SELECT
                tse.idstaffevento, tse.idevento, tse.nmfuncionario AS nome, tse.nmfuncao AS funcao,
                jsonb_array_length(tse.datasevento) AS qtddiarias,
                (COALESCE(tse.vlrcache, 0) * GREATEST(jsonb_array_length(tse.datasevento), 1)) AS totalcache,
                ((COALESCE(tse.vlralmoco, 0) + COALESCE(tse.vlralimentacao, 0) + COALESCE(tse.vlrtransporte, 0)) * GREATEST(jsonb_array_length(tse.datasevento), 1)) AS totalajudacusto,
                tse.statuspgto, 
                tse.statuspgtoajdcto
            FROM staffeventos tse
            WHERE tse.idevento = ANY($1)
            ORDER BY tse.nmfuncionario;
        `;

        const { rows: staffRows } = await pool.query(queryDetalhes, [idsEventos]);

        // --- MAPEAMENTO FINAL ---
        const resultado = eventos.map(ev => {
            const dInicio = ev.dt_inicio ? new Date(ev.dt_inicio) : null;
            const dFim = ev.dt_fim ? new Date(ev.dt_fim) : null;

            return {
                idevento: ev.idevento,
                nomeEvento: ev.nmevento,
                totalGeral: parseFloat(ev.ajuda_total) + parseFloat(ev.cache_total),
                dataInicioEvento: dInicio ? dInicio.toLocaleDateString('pt-BR') : 'N/A',
                dataFimEvento: dFim ? dFim.toLocaleDateString('pt-BR') : 'N/A',
                // Lógica de Vencimento
                dataVencimentoAjuda: dInicio ? new Date(new Date(dInicio).setDate(dInicio.getDate() + 2)).toLocaleDateString('pt-BR') : 'N/A',
                dataVencimentoCache: dFim ? new Date(new Date(dFim).setDate(dFim.getDate() + 3)).toLocaleDateString('pt-BR') : 'N/A',
                ajuda: { 
                    total: parseFloat(ev.ajuda_total), 
                    pendente: parseFloat(ev.ajuda_pendente), 
                    pagos: parseFloat(ev.ajuda_paga) 
                },
                cache: { 
                    total: parseFloat(ev.cache_total), 
                    pendente: parseFloat(ev.cache_pendente), 
                    pagos: parseFloat(ev.cache_pago) 
                },
                funcionarios: staffRows
                    .filter(s => s.idevento === ev.idevento)
                    .map(s => ({
                        idstaffevento: s.idstaffevento,
                        nome: s.nome,
                        funcao: s.funcao,
                        qtddiarias: parseInt(s.qtddiarias, 10),
                        totalcache: parseFloat(s.totalcache),
                        totalajudacusto: parseFloat(s.totalajudacusto),
                        totalpagar: parseFloat(s.totalcache) + parseFloat(s.totalajudacusto),
                        statuspgto: s.statuspgto || 'Pendente',
                        statuspgtoajdcto: s.statuspgtoajdcto || 'Pendente'
                    }))
            };
        });

        res.json({ periodo, startDate, endDate, eventos: resultado });

    } catch (error) {
        console.error("ERRO CRÍTICO NO BACKEND:", error);
        res.status(500).json({ error: error.message });
    }
});

// NOVA ROTA PARA ATUALIZAR STATUS INDIVIDUAL
router.post("/vencimentos/update-status", async (req, res) => {
    const { idStaff, tipo, novoStatus } = req.body;
    
    // Mapeia o tipo para a coluna correta do banco
    const coluna = (tipo === 'Cache') ? 'statuspgto' : 'statuspgtoajdcto';

    try {
        const result = await pool.query(
            `UPDATE staffeventos SET ${coluna} = $1 WHERE idstaffevento = $2`, 
            [novoStatus, idStaff]
        );

        if (result.rowCount > 0) {
            res.json({ success: true });
        } else {
            res.status(404).json({ success: false, error: "Registro não encontrado." });
        }
    } catch (error) {
        console.error("Erro no update:", error);
        res.status(500).json({ success: false, error: error.message });
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

// Rota para adicionar um novo evento na agenda
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


// Rota para excluir um evento específico
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
  const id = req.params.idAditivoExtra;

  // 💡 Mantida a correção de segurança para evitar erro 22P02 no log middleware
  if (!id || isNaN(parseInt(id))) return null;

  // Usa a coluna justificativa que já existe no banco
  const query = `SELECT idaditivoextra, status, tiposolicitacao, justificativa FROM AditivoExtra WHERE idAditivoExtra = $1`;
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



// router.get('/aditivoextra', async (req, res) => {

//   // 💡 CORREÇÃO 1: Utiliza a mesma lógica robusta para obter ID da Empresa e do Usuário
//   const idEmpresa = req.idempresa || req.headers.idempresa; 
//   const idUsuario = req.usuario?.idusuario || req.headers.idusuario; 

//   if (!idEmpresa) return res.status(400).json({ erro: 'Empresa não informada' });
//   if (!idUsuario) return res.status(400).json({ erro: 'Usuário não informado' });


//   // 1. Checa se o usuário é Master no Staff
//   const { rows: permissoes } = await pool.query(`
//   SELECT * FROM permissoes 
//   WHERE idusuario = $1 AND modulo = 'Staff' AND master = 'true'
//   `, [idUsuario]);

//   const ehMasterStaff = permissoes.length > 0;

//   // Mantendo o bloqueio de acesso à rota para usuários sem permissão
//   if (!ehMasterStaff) {
//   return res.status(403).json({ erro: 'Permissão negada. Você não é Master Staff no módulo de Staff.' }); 
//   }

//   try {
//   const query = `
//   SELECT 
//   ae.idAditivoExtra,
//   ae.tipoSolicitacao,
//   ae.justificativa,
//   ae.status,
//   ae.qtdSolicitada,
//   ae.dtSolicitacao AS criado_em,
//   ae.idFuncionario, -- Adicionando idFuncionario para o front-end
//   func.nome AS nomeFuncionario,
//   f.descfuncao AS funcao,
//   e.nmevento AS evento,
//   s.nome || ' ' || s.sobrenome AS nomesolicitante
//   FROM 
//   AditivoExtra ae
//   -- CORREÇÃO: Usar LEFT JOIN para incluir registros mesmo que a Funcao esteja ausente (ou seja um pedido genérico)
//   LEFT JOIN 
//   Funcao f ON ae.idFuncao = f.idFuncao
//   -- CORREÇÃO: Usar LEFT JOIN para incluir registros mesmo que o Funcionario esteja ausente (pedidos de Funções)
//   LEFT JOIN 
//   Funcionarios func ON ae.idFuncionario = func.idFuncionario
//   -- Assumimos que Orcamentos, Eventos e Usuarios Solicitantes sempre existem
//   JOIN 
//   Orcamentos o ON ae.idOrcamento = o.idOrcamento
//   JOIN 
//   Eventos e ON o.idEvento = e.idEvento
//   JOIN 
//   Usuarios s ON ae.idUsuarioSolicitante = s.idUsuario
//   WHERE 
//   ae.idEmpresa = $1 --AND ae.status = 'Pendente'
//   ORDER BY 
//   e.nmevento, f.descfuncao, ae.tipoSolicitacao;
//   `;

//   const resultado = await pool.query(query, [idEmpresa]); 

//   // 2. INJETA a flag ehMasterStaff em CADA linha antes de retornar.
//   const dadosComPermissao = resultado.rows.map(row => ({
//   ...row,
//   ehMasterStaff: ehMasterStaff // Passa o valor booleano calculado (TRUE)
//   }));

//   res.json({
//   sucesso: true,
//   dados: dadosComPermissao // Retorna o array modificado
//   });

//   } catch (error) {
//   console.error("Erro ao listar AditivoExtra pendentes:", error);
//   res.status(500).json({ sucesso: false, erro: "Erro interno ao buscar solicitações Aditivo/Extra." });
//   }
// });

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