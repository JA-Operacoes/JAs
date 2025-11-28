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
  const ano = req.query.ano;
  const mes = req.query.mes;

  if (!idempresa) return res.status(400).json({ error: "idempresa não fornecido" });
  if (!ano || !mes) return res.status(400).json({ error: "ano e mes são obrigatórios" });

  // Busca todos os eventos do mês/ano informado, incluindo idevento
  const { rows: eventos } = await pool.query(`
  SELECT DISTINCT ON (e.idevento, o.dtiniinframontagem, o.dtfiminframontagem,
   o.dtinimarcacao, o.dtfimmarcacao,
   o.dtinimontagem, o.dtfimmontagem,
   o.dtinirealizacao, o.dtfimdesmontagem,
   o.dtinidesmontagem, o.dtfimdesmontagem,
   o.dtiniinfradesmontagem, o.dtfiminfradesmontagem)
   e.idevento,
   e.nmevento || 
   CASE 
   WHEN COUNT(*) OVER (PARTITION BY e.idevento, o.dtiniinframontagem, o.dtfiminframontagem,
   o.dtinimarcacao, o.dtfimmarcacao,
   o.dtinimontagem, o.dtfimmontagem,
   o.dtinirealizacao, o.dtfimdesmontagem,
   o.dtinidesmontagem, o.dtfimdesmontagem,
   o.dtiniinfradesmontagem, o.dtfiminfradesmontagem) > 1 
   THEN ' - ' || COALESCE(o.nomenclatura, '') 
   ELSE '' 
   END AS evento_nome,
   o.dtiniinframontagem, o.dtfiminframontagem,
   o.dtinimarcacao, o.dtfimmarcacao,
   o.dtinimontagem, o.dtfimmontagem,
   o.dtinirealizacao, o.dtfimdesmontagem,
   o.dtinidesmontagem, o.dtfimdesmontagem,
   o.dtiniinfradesmontagem, o.dtfiminfradesmontagem
  FROM orcamentos o
  JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
  JOIN eventos e ON e.idevento = o.idevento
  WHERE oe.idempresa = $1
  AND (
  (EXTRACT(YEAR FROM o.dtiniinframontagem) = $2 AND EXTRACT(MONTH FROM o.dtiniinframontagem) = $3) OR
  (EXTRACT(YEAR FROM o.dtfiminframontagem) = $2 AND EXTRACT(MONTH FROM o.dtfiminframontagem) = $3) OR
  (EXTRACT(YEAR FROM o.dtinimarcacao) = $2 AND EXTRACT(MONTH FROM o.dtinimarcacao) = $3) OR
  (EXTRACT(YEAR FROM o.dtfimmarcacao) = $2 AND EXTRACT(MONTH FROM o.dtfimmarcacao) = $3) OR
  (EXTRACT(YEAR FROM o.dtinimontagem) = $2 AND EXTRACT(MONTH FROM o.dtinimontagem) = $3) OR
  (EXTRACT(YEAR FROM o.dtfimmontagem) = $2 AND EXTRACT(MONTH FROM o.dtfimmontagem) = $3) OR
  (EXTRACT(YEAR FROM o.dtinirealizacao) = $2 AND EXTRACT(MONTH FROM o.dtinirealizacao) = $3) OR
  (EXTRACT(YEAR FROM o.dtfimdesmontagem) = $2 AND EXTRACT(MONTH FROM o.dtfimdesmontagem) = $3) OR
  (EXTRACT(YEAR FROM o.dtinidesmontagem) = $2 AND EXTRACT(MONTH FROM o.dtinidesmontagem) = $3) OR
  (EXTRACT(YEAR FROM o.dtfimdesmontagem) = $2 AND EXTRACT(MONTH FROM o.dtfimdesmontagem) = $3) OR
  (EXTRACT(YEAR FROM o.dtiniinfradesmontagem) = $2 AND EXTRACT(MONTH FROM o.dtiniinfradesmontagem) = $3) OR
  (EXTRACT(YEAR FROM o.dtfiminfradesmontagem) = $2 AND EXTRACT(MONTH FROM o.dtfiminfradesmontagem) = $3)
  )
  ORDER BY e.idevento, o.dtiniinframontagem, o.dtinimarcacao;
  `, [idempresa, ano, mes]);

  if (!eventos || eventos.length === 0) return res.json({ eventos: [] });

  const resposta = [];

  eventos.forEach(ev => {
  const fases = [
  { tipo: "Montagem Infra", inicio: ev.dtiniinframontagem, fim: ev.dtfiminframontagem },
  { tipo: "Marcação", inicio: ev.dtinimarcacao, fim: ev.dtfimmarcacao },
  { tipo: "Montagem", inicio: ev.dtinimontagem, fim: ev.dtfimmontagem },
  { tipo: "Realização", inicio: ev.dtinirealizacao, fim: ev.dtfimdesmontagem },
  { tipo: "Desmontagem",   inicio: ev.dtinidesmontagem, fim: ev.dtfimdesmontagem },
  { tipo: "Desmontagem Infra", inicio: ev.dtiniinfradesmontagem, fim: ev.dtfiminfradesmontagem },
  ];

  fases.forEach(f => {
  if (f.inicio) {
  resposta.push({
  idevento: ev.idevento,
  nome: ev.evento_nome,
  inicio: f.inicio.toISOString().split("T")[0],
  fim: f.fim ? f.fim.toISOString().split("T")[0] : f.inicio.toISOString().split("T")[0],
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
  const idempresa = req.headers.idempresa || req.query.idempresa;
  const idevento = req.query.idevento;

  if (!idempresa) return res.status(400).json({ error: "idempresa não fornecido" });
  if (!idevento) return res.status(400).json({ error: "idevento não fornecido" });

  const { rows } = await pool.query(
  `SELECT DISTINCT
  e.nmevento,
  se.nmfuncionario AS funcionario,
  se.nmfuncao AS funcao
  FROM staffeventos se
  JOIN staffempresas sem ON se.idstaff = sem.idstaff
  JOIN eventos e ON e.idevento = se.idevento
  WHERE sem.idempresa = $1
  AND se.idevento = $2
  ORDER BY se.nmfuncionario`,
  [idempresa, idevento]
  );

  if (rows.length === 0) {
  return res.json({ staff: null });
  }

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
  res.status(500).json({ error: "Erro interno do servidor" });
  }
});
// =======================================


// =======================================
// EVENTOS EM ABERTOS E FECHADOS
// =======================================
router.get("/eventos-abertos", async (req, res) => {
  try {
  // Validação e setup
  const idempresa = req.headers.idempresa || req.query.idempresa;
  // Assume ano atual se não fornecido
  const ano = req.query.ano ? Number(req.query.ano) : new Date().getFullYear();

  if (!idempresa) return res.status(400).json({ error: "idempresa não fornecido" });

  const params = [idempresa, ano];

  // SQL base com CTEs - Focada em Orçamentos e Vagas
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
  MIN(o.dtiniinframontagem) AS dtiniinframontagem,
  MAX(o.dtfiminframontagem) AS dtfiminframontagem,
  MIN(o.dtiniinfradesmontagem) AS dtiniinfradesmontagem,
  MAX(o.dtfiminfradesmontagem) AS dtfiminfradesmontagem,
  array_agg(DISTINCT f.idequipe) FILTER (WHERE f.idequipe IS NOT NULL) AS equipes_ids,
  array_agg(DISTINCT eq.nmequipe) FILTER (WHERE eq.nmequipe IS NOT NULL) AS equipes_nomes,
  array_agg(DISTINCT p.nmpavilhao) FILTER (WHERE p.nmpavilhao IS NOT NULL) AS pavilhoes_nomes,
  (
  SELECT json_agg(row_to_json(t))
  FROM (
  SELECT 
  eq2.idequipe,
  eq2.nmequipe AS equipe,
  i2.idfuncao, -- << ADICIONE AQUI O ID DA FUNÇÃO
  f2.descfuncao AS nome_funcao, -- << TALVEZ VOCÊ PRECISE DO NOME DA FUNÇÃO AQUI
  SUM(i2.qtditens) AS total_vagas
  FROM orcamentoitens i2
  JOIN funcao f2 ON f2.idfuncao = i2.idfuncao
  JOIN equipe eq2 ON eq2.idequipe = f2.idequipe
  JOIN orcamentos o2 ON o2.idorcamento = i2.idorcamento
  WHERE o2.idevento = o.idevento
  -- ✅ FILTRO CORRIGIDO: i2.categoria = 'Produto(s)' (SUBQUERY)
  AND i2.categoria = 'Produto(s)' 
  --GROUP BY eq2.nmequipe, lm.descmontagem, o.idmontagem
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
  -- ✅ FILTRO CORRIGIDO: i.categoria = 'Produto(s)' (MAIN QUERY)
  AND i.categoria = 'Produto(s)' 
  GROUP BY o.idevento, lm.descmontagem, o.idmontagem
  ),
  staff_contagem AS (
  SELECT 
  se.idevento,
  COUNT(se.idstaffevento) AS total_staff
  FROM staffeventos se
  JOIN orcamentos o ON se.idevento = o.idevento
  JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
  WHERE oe.idempresa = $1
  AND EXISTS (
  SELECT 1
  FROM jsonb_array_elements_text(se.datasevento) AS d(dt)
  WHERE (d.dt)::date BETWEEN o.dtinimontagem AND o.dtfimdesmontagem
  )
  GROUP BY se.idevento
  ),
  staff_por_equipe AS (
  SELECT 
  se.idevento,
  eq.nmequipe,
  COUNT(se.idstaffevento) AS preenchidas
  FROM staffeventos se
  JOIN funcao f ON f.idfuncao = se.idfuncao
  JOIN equipe eq ON eq.idequipe = f.idequipe
  JOIN orcamentos o ON o.idevento = se.idevento
  JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
  WHERE oe.idempresa = $1 
  GROUP BY se.idevento, eq.nmequipe
  ),
  staff_datas_por_funcao AS (
  SELECT
  se.idevento,
  se.idfuncao,
  array_agg(DISTINCT d.dt) AS datas_staff
  FROM staffeventos se
  LEFT JOIN LATERAL jsonb_array_elements_text(se.datasevento) AS d(dt) 
  ON TRUE
  JOIN orcamentos o ON se.idevento = o.idevento
  JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
  WHERE oe.idempresa = $1
  GROUP BY se.idevento, se.idfuncao
  ),
  cliente_info AS (
  -- CTE para buscar o idcliente e nmfantasia (nome do cliente)
  SELECT DISTINCT ON (o.idevento)
  o.idevento,
  c.idcliente,
  c.nmfantasia
  FROM orcamentos o
  JOIN clientes c ON c.idcliente = o.idcliente
  WHERE o.idevento IS NOT NULL
  ORDER BY o.idevento, o.dtinirealizacao DESC 
  )
  SELECT 
  e.idevento,
  e.nmevento,
  vo.nmlocalmontagem,
  vo.idmontagem,
  vo.nrorcamento,
  ci.idcliente, 
  ci.nmfantasia,
  COALESCE(vo.pavilhoes_nomes, ARRAY[]::text[]) AS pavilhoes_nomes,  
  COALESCE(vo.dtinirealizacao, CURRENT_DATE) AS dtinirealizacao,
  COALESCE(vo.dtfimrealizacao, CURRENT_DATE) AS dtfimrealizacao,
  COALESCE(vo.dtinimarcacao, CURRENT_DATE) AS dtinimarcacao,
  COALESCE(vo.dtfimdesmontagem, CURRENT_DATE) AS dtfimdesmontagem,
  COALESCE(vo.total_vagas, 0) AS total_vagas,
  COALESCE(sc.total_staff, 0) AS total_staff,
  (COALESCE(vo.total_vagas, 0) - COALESCE(sc.total_staff, 0)) AS vagas_restantes,
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
  'preenchidas', COALESCE(sp.preenchidas, 0),
  'datas_staff', COALESCE(sdf.datas_staff, ARRAY[]::text[])
  )
  )
  FROM json_array_elements(vo.equipes_detalhes_base) AS b
  LEFT JOIN staff_por_equipe sp ON sp.idevento = e.idevento AND sp.nmequipe = b->>'equipe'
  LEFT JOIN staff_datas_por_funcao sdf ON sdf.idevento = e.idevento AND sdf.idfuncao = (b->>'idfuncao')::int
  ) AS equipes_detalhes,
  'aberto' AS status_evento
  FROM eventos e
  INNER JOIN vagas_orc vo ON vo.idevento = e.idevento
  LEFT JOIN staff_contagem sc ON sc.idevento = e.idevento
  LEFT JOIN cliente_info ci ON ci.idevento = e.idevento
  `;

  // CLÁUSULA WHERE para eventos ABERTOS (data futura OU vagas restantes)
  const whereClause = `
  WHERE (vo.dtfimdesmontagem IS NULL OR vo.dtfimdesmontagem >= CURRENT_DATE) 
  `;

  // Ordem crescente para próximos eventos
  const orderClause = ` ORDER BY COALESCE(vo.dtinirealizacao, CURRENT_DATE) ASC;`;

  const finalSql = baseSql + "\n" + whereClause + "\n" + orderClause;

  const { rows } = await pool.query(finalSql, params);
  return res.json(rows);
  } catch (err) {
  console.error("Erro em /eventos-abertos:", err);
  // Não expõe detalhes do erro em produção
  res.status(500).json({ error: "Erro interno ao buscar eventos abertos." });
  }
});

router.get("/eventos-fechados", async (req, res) => {
  try {
  // Validação e setup
  const idempresa = req.headers.idempresa || req.query.idempresa;
  // Assume ano atual se não fornecido
  const ano = req.query.ano ? Number(req.query.ano) : new Date().getFullYear();

  if (!idempresa) {
  return res.status(400).json({ error: "idempresa não fornecido." });
  }

  const params = [idempresa, ano];

  // SQL base com CTEs - Focada em Orçamentos e Vagas
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
  MIN(o.dtiniinframontagem) AS dtiniinframontagem,
  MAX(o.dtfiminframontagem) AS dtfiminframontagem,
  MIN(o.dtiniinfradesmontagem) AS dtiniinfradesmontagem,
  MAX(o.dtfiminfradesmontagem) AS dtfiminfradesmontagem,
  array_agg(DISTINCT f.idequipe) FILTER (WHERE f.idequipe IS NOT NULL) AS equipes_ids,
  array_agg(DISTINCT eq.nmequipe) FILTER (WHERE eq.nmequipe IS NOT NULL) AS equipes_nomes,
  array_agg(DISTINCT p.nmpavilhao) FILTER (WHERE p.nmpavilhao IS NOT NULL) AS pavilhoes_nomes,
  (
  SELECT json_agg(row_to_json(t))
  FROM (
  SELECT 
  eq2.idequipe,
  eq2.nmequipe AS equipe,
  i2.idfuncao, -- << ADICIONE AQUI O ID DA FUNÇÃO
  f2.descfuncao AS nome_funcao, -- << TALVEZ VOCÊ PRECISE DO NOME DA FUNÇÃO AQUI
  SUM(i2.qtditens) AS total_vagas,
  MIN(i2.periododiariasinicio) AS dtini_vaga,
  MAX(i2.periododiariasfim) AS dtfim_vaga
  FROM orcamentoitens i2
  JOIN funcao f2 ON f2.idfuncao = i2.idfuncao
  JOIN equipe eq2 ON eq2.idequipe = f2.idequipe
  JOIN orcamentos o2 ON o2.idorcamento = i2.idorcamento
  WHERE o2.idevento = o.idevento
  -- 🛑 FILTRO APLICADO: CATEGORIA 'Produto(s)' (SUBQUERY)
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
  -- 🛑 FILTRO APLICADO: CATEGORIA 'Produto(s)' (MAIN QUERY)
  AND i.categoria = 'Produto(s)'
  GROUP BY o.idevento, o.idmontagem, lm.descmontagem
  ),
  staff_contagem AS (
  SELECT 
  se.idevento,
  COUNT(se.idstaffevento) AS total_staff
  FROM staffeventos se
  JOIN orcamentos o ON se.idevento = o.idevento
  JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
  WHERE oe.idempresa = $1
  AND EXISTS (
  SELECT 1
  FROM jsonb_array_elements_text(se.datasevento) AS d(dt)
  WHERE (d.dt)::date BETWEEN o.dtinimontagem AND o.dtfimdesmontagem
  )
  GROUP BY se.idevento
  ),
  staff_por_equipe AS (
  SELECT 
  se.idevento,
  eq.nmequipe,
  COUNT(se.idstaffevento) AS preenchidas
  FROM staffeventos se
  JOIN funcao f ON f.idfuncao = se.idfuncao
  JOIN equipe eq ON eq.idequipe = f.idequipe
  JOIN orcamentos o ON o.idevento = se.idevento
  JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
  WHERE oe.idempresa = $1
  GROUP BY se.idevento, eq.nmequipe
  ),
  staff_datas_por_funcao AS (
  SELECT
  se.idevento,
  se.idfuncao,
  -- ✅ CORRIGIDO: Agrega as colunas retornadas pelo LATERAL JOIN
  array_agg(DISTINCT d.dt) AS datas_staff
  FROM staffeventos se
  -- ✅ NOVO: Usa LATERAL para expandir o array JSON em linhas
  LEFT JOIN LATERAL jsonb_array_elements_text(se.datasevento) AS d(dt) 
  ON TRUE
  JOIN orcamentos o ON se.idevento = o.idevento
  JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
  WHERE oe.idempresa = $1
  GROUP BY se.idevento, se.idfuncao
  ),  
  cliente_info AS (
  -- CTE para buscar o idcliente e nmfantasia (nome do cliente)
  SELECT DISTINCT ON (o.idevento)
  o.idevento,
  c.idcliente,
  c.nmfantasia
  FROM orcamentos o
  JOIN clientes c ON c.idcliente = o.idcliente
  WHERE o.idevento IS NOT NULL
  ORDER BY o.idevento, o.dtinirealizacao DESC 
  )
  SELECT 
  e.idevento,
  e.nmevento,
  vo.idmontagem,
  vo.nmlocalmontagem,
  vo.nrorcamento,
  ci.idcliente, 
  ci.nmfantasia,
  COALESCE(vo.pavilhoes_nomes, ARRAY[]::text[]) AS pavilhoes_nomes,
  COALESCE(vo.pavilhoes_nomes, ARRAY[]::text[]) AS pavilhoes_nomes,  
  COALESCE(vo.dtinirealizacao, CURRENT_DATE) AS dtinirealizacao,
  COALESCE(vo.dtfimrealizacao, CURRENT_DATE) AS dtfimrealizacao,
  COALESCE(vo.dtinimarcacao, CURRENT_DATE) AS dtinimarcacao,
  COALESCE(vo.dtfimdesmontagem, CURRENT_DATE) AS dtfimdesmontagem,
  COALESCE(vo.total_vagas, 0) AS total_vagas,
  COALESCE(sc.total_staff, 0) AS total_staff,
  (COALESCE(vo.total_vagas, 0) - COALESCE(sc.total_staff, 0)) AS vagas_restantes,
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
  'preenchidas', COALESCE(sp.preenchidas, 0),
  'dtini_vaga', b->>'dtini_vaga',
  'dtfim_vaga', b->>'dtfim_vaga',
  'datas_staff', COALESCE(sdf.datas_staff, ARRAY[]::text[])
  )
  )
  FROM json_array_elements(vo.equipes_detalhes_base) AS b
  LEFT JOIN staff_por_equipe sp ON sp.idevento = e.idevento AND sp.nmequipe = b->>'equipe'
  LEFT JOIN staff_datas_por_funcao sdf ON sdf.idevento = e.idevento AND sdf.idfuncao = (b->>'idfuncao')::int
  ) AS equipes_detalhes,
  'fechado' AS status_evento
  FROM eventos e
  -- CHAVE DE CORREÇÃO: Usar INNER JOIN para garantir que o evento tenha orçamento
  INNER JOIN vagas_orc vo ON vo.idevento = e.idevento
  LEFT JOIN staff_contagem sc ON sc.idevento = e.idevento
  LEFT JOIN cliente_info ci ON ci.idevento = e.idevento -- NOVO JOIN para cliente
  `;

  // CLÁUSULA WHERE para eventos FECHADOS:
  const whereClause = `
  -- Eventos com data de desmontagem anterior à data atual OU eventos com vagas completas
  WHERE (vo.dtfimdesmontagem IS NOT NULL AND vo.dtfimdesmontagem < CURRENT_DATE) 
  `;

  // Ordem decrescente para eventos mais recentes
  const orderClause = ` ORDER BY COALESCE(vo.dtinirealizacao, CURRENT_DATE) DESC;`;

  const finalSql = baseSql + "\n" + whereClause + "\n" + orderClause;

  const { rows } = await pool.query(finalSql, params);

  return res.json(rows);
  } catch (err) {
  console.error("Erro em /eventos-fechados:", err);
  res.status(500).json({ error: "Erro interno ao buscar eventos fechados." });
  }
});

router.get("/detalhes-eventos-abertos", async (req, res) => {
  try {
  const idevento = req.query.idevento || req.headers.idevento;
  const idempresa = req.query.idempresa || req.headers.idempresa;

  if (!idevento || !idempresa) {
  return res.status(400).json({ error: "idevento e idempresa são obrigatórios." });
  }

  // 1️⃣ Busca orçamento vinculado
  const { rows: orcamentos } = await pool.query(
  `SELECT o.nrorcamento, o.idcliente, o.idmontagem
   FROM orcamentos o
   JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
   WHERE o.idevento = $1 AND oe.idempresa = $2
   LIMIT 1`,
  [idevento, idempresa]
  );

  if (!orcamentos.length) {
  return res.status(200).json({ equipes: [] });
  }

  const { nrorcamento, idcliente, idmontagem } = orcamentos[0];



  // 2️⃣ Busca equipes e funções previstas
  const { rows: itensOrcamento } = await pool.query(
  `SELECT 
   e.idequipe,
   e.nmequipe AS equipe,
   f.idfuncao,
   f.descfuncao AS funcao,
   COALESCE(SUM(oi.qtditens), 0) AS qtd_orcamento,
   MIN(oi.periododiariasinicio) AS dtini_vaga,
   MAX(oi.periododiariasfim) AS dtfim_vaga
   FROM orcamentoitens oi
   LEFT JOIN funcao f ON f.idfuncao = oi.idfuncao
   LEFT JOIN equipe e ON e.idequipe = f.idequipe
   LEFT JOIN orcamentos o ON o.idorcamento = oi.idorcamento
   JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
   WHERE o.idevento = $1 AND oe.idempresa = $2
   GROUP BY e.idequipe, e.nmequipe, f.idfuncao, f.descfuncao
   ORDER BY e.nmequipe, f.descfuncao`,
  [idevento, idempresa]
  );

  if (!itensOrcamento.length) {
  return res.status(200).json({ equipes: [] });
  }

  // 3️⃣ Busca quantidades cadastradas
  const { rows: staff } = await pool.query(
  `SELECT 
   se.idfuncao,
   COUNT(se.idstaffevento) AS qtd_cadastrada
   FROM staffeventos se
   WHERE se.idevento = $1 AND se.idcliente = $2
   GROUP BY se.idfuncao`,
  [idevento, idcliente]
  );

  // 4️⃣ Agrupa por equipe
  // const equipesMap = {};
  // for (const item of itensOrcamento) {
  //   const equipeNome = item.equipe || "Sem equipe";
  //   if (!equipesMap[equipeNome]) equipesMap[equipeNome] = [];

  //   const cadastrado = staff.find(s => s.idfuncao === item.idfuncao);
  //   const qtd_cadastrada = cadastrado ? Number(cadastrado.qtd_cadastrada) : 0;

  //   equipesMap[equipeNome].push({
  //   nome: item.funcao,
  //   qtd_orcamento: Number(item.qtd_orcamento) || 0,
  //   qtd_cadastrada,
  //   concluido: qtd_cadastrada >= (Number(item.qtd_orcamento) || 0)
  //   });
  // }

  // // 5️⃣ Monta retorno final
  // const equipesDetalhes = Object.entries(equipesMap).map(([nome, funcoes]) => ({
  //   equipe: nome,
  //   funcoes
  // }));

  // res.status(200).json({ equipes: equipesDetalhes });


  // 4️⃣ Busca Datas de Staff por Função
  const { rows: datasStaffRaw } = await pool.query(
  `SELECT
  se.idfuncao,
  -- Expande o array JSON em linhas e agrega novamente (resolvendo o problema 0A000)
  array_agg(DISTINCT d.dt ORDER BY d.dt) AS datas_staff
  FROM staffeventos se
  LEFT JOIN LATERAL jsonb_array_elements_text(se.datasevento) AS d(dt) 
  ON TRUE
  WHERE se.idevento = $1 AND se.idcliente = $2 AND se.datasevento IS NOT NULL
  GROUP BY se.idfuncao`,
  [idevento, idcliente]
  );

  // Mapeia para fácil acesso (idfuncao -> array de datas)
  const datasStaffMap = datasStaffRaw.reduce((acc, row) => {
  acc[String(row.idfuncao)] = row.datas_staff;
  return acc;
  }, {});

  // 5️⃣ Agrupa por equipe
  // 🚨 CORREÇÃO: Usar idequipe como chave e preservar idfuncao
  const equipesMap = {};
  for (const item of itensOrcamento) {
  const idequipe = item.idequipe; // Objeto item tem idequipe (do SELECT)
  const idequipeKey = idequipe || "SEM_EQUIPE"; // Chave de agrupamento robusta

  // 1. Inicializa o objeto de equipe se ainda não existir
  if (!equipesMap[idequipeKey]) {
  equipesMap[idequipeKey] = {
  equipe: item.equipe || "Sem equipe",
  idequipe: idequipe, // ✅ idequipe incluído
  funcoes: [],
  };
  }

  // 2. Encontra a quantidade de staff já cadastrada
  const cadastrado = staff.find(s => String(s.idfuncao) === String(item.idfuncao)); 
  const qtd_cadastrada = cadastrado ? Number(cadastrado.qtd_cadastrada) : 0;

  // 3. Obtém as datas preenchidas
  const datas_staff = datasStaffMap[String(item.idfuncao)] || [];

  // 4. Adiciona a função com todos os detalhes
  equipesMap[idequipeKey].funcoes.push({
  idfuncao: item.idfuncao, // ✅ idfuncao incluído
  nome: item.funcao,
  qtd_orcamento: Number(item.qtd_orcamento) || 0,
  qtd_cadastrada,
  concluido: qtd_cadastrada >= (Number(item.qtd_orcamento) || 0),
  // ✅ ADICIONADO: Datas da Vaga (do itensOrcamento)
  dtini_vaga: item.dtini_vaga,
  dtfim_vaga: item.dtfim_vaga,

  // ✅ ADICIONADO: Datas Staff (do datasStaffMap)
  datas_staff: datas_staff
  });
  }

  // 6️⃣ Monta retorno final
  // Usa Object.values para obter a lista de equipes já com idequipe
  const equipesDetalhes = Object.values(equipesMap);

  // 7 Retorna o objeto completo com os IDs
  res.status(200).json({ equipes: equipesDetalhes, idmontagem });
  // // ...

  } catch (err) {
  console.error("Erro ao buscar detalhes dos eventos abertos:", err);
  res.status(500).json({ error: "Erro interno ao buscar detalhes dos eventos abertos." });
  }
});

router.get("/ListarFuncionarios", async (req, res) => {

  console.log("entrou na ListarFuncionarios");

  // 🛑 ATUALIZAÇÃO 1: Coleta IDs de Evento/Equipe de req.query (como o frontend envia)
  const { idEvento, idEquipe } = req.query;

  // 🛑 ATUALIZAÇÃO 2: Coleta idempresa de forma flexível (como o /eventos-fechados)
  // Prioriza o que vem do middleware (req.idempresa) ou, em fallback, da query string.
  const idempresa = req.idempresa || req.query.idempresa; 

  if (!idEvento || !idEquipe || !idempresa) {
  return res.status(400).json({ erro: 'IDs de Evento, Equipe e Empresa são obrigatórios.' });
  }

  console.log("IDs recebidos - Evento:", idEvento, "Equipe:", idEquipe, "Empresa:", idempresa);

  // Conversão para inteiro e validação de segurança
  const ideventoNum = parseInt(idEvento);
  const idequipeNum = parseInt(idEquipe);
  const idempresaNum = parseInt(idempresa);

  if (isNaN(ideventoNum) || isNaN(idequipeNum) || isNaN(idempresaNum)) {
  return res.status(400).json({ erro: 'Um ou mais IDs fornecidos não são válidos (devem ser numéricos).' });
  }

  try {
  // idevento é $1, idequipe é $2, idempresa é $3
  const query = `
  SELECT 
  se.idstaffevento,
  se.idfuncionario,
  se.nmfuncionario AS nome,
  se.nmevento AS evento,
  se.nmequipe AS equipe,
  se.nmfuncao AS funcao,  
  se.nivelexperiencia,
  se.vlrtotal,
  se.statuspgto AS status_pagamento, 
  se.setor,
  se.qtdpessoaslote
  FROM 
  public.staffeventos se

  INNER JOIN 
  orcamentos o ON o.idevento = se.idevento
  INNER JOIN
  orcamentoempresas oe ON oe.idorcamento = o.idorcamento

  WHERE 
  se.idevento = $1   
  AND se.idequipe = $2   
  AND oe.idempresa = $3 
  ORDER BY 
  se.nmfuncao, se.nmfuncionario; 
  `;

  const { rows } = await pool.query(query, [ideventoNum, idequipeNum, idempresaNum]);

  res.status(200).json(rows);

  } catch (erro) {
  console.error('❌ Erro ao buscar funcionários por equipe:', erro);
  res.status(500).json({ erro: 'Erro interno ao listar funcionários da equipe.' });
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

router.get('/notificacoes-financeiras', async (req, res) => {
  try {
  const idempresa = req.idempresa || req.headers.idempresa;
  const idusuario = req.usuario?.idusuario || req.headers.idusuario;

  if (!idempresa) return res.status(400).json({ error: 'Empresa não informada' });
  if (!idusuario) return res.status(400).json({ error: 'Usuário não informado' });

  // Checa se o usuário é Master no Staff via tabela de permissões (mantido por segurança, embora a query retorne tudo)
  const { rows: permissoes } = await pool.query(`
  SELECT * FROM permissoes 
  WHERE idusuario = $1 AND modulo = 'Staff' AND master = 'true'
  `, [idusuario]);
  const ehMasterStaff = permissoes.length > 0;

  // Se o usuário não for Master Staff, você pode querer retornar um erro 403 (Proibido)
  if (!ehMasterStaff) {
   return res.status(403).json({ error: 'Acesso negado. Necessária permissão Master Staff.' });
  }


  // Consulta SQL Otimizada e Corrigida
  const { rows } = await pool.query(`
  WITH OriginalExecutor AS (
  -- 1. Encontra o ID do executor (solicitante) e a data de criação (criado_em) mais antigos
  SELECT DISTINCT ON (idregistroalterado)
  idregistroalterado AS idstaffevento,
  idexecutor,
  criado_em
  FROM
  logs
  WHERE
  modulo = 'staffeventos'
  AND idempresa = $1 -- 🎯 FILTRO DA EMPRESA
  ORDER BY
  idregistroalterado,
  criado_em ASC
  )

  SELECT DISTINCT ON (se.idstaffevento) -- Desduplicando pelo ID Único do Pedido (se.idstaffevento)
  se.idstaffevento AS id,
  oe.idexecutor, 
  (u.nome || ' ' || u.sobrenome) AS nomesolicitante,
  f.nome AS nomefuncionario,
  e.nmevento AS evento,

  se.vlrcaixinha::text,
  se.desccaixinha,
  se.statuscaixinha,

  se.vlrajustecusto::text,
  se.descajustecusto,
  se.statusajustecusto,

  se.dtdiariadobrada::text,
  se.descdiariadobrada,
  se.statusdiariadobrada,

  se.dtmeiadiaria::text,
  se.descmeiadiaria,
  se.statusmeiadiaria,

  se.datasevento::text,
  oe.criado_em, 
  se.idfuncionario AS idusuarioalvo,
  COALESCE(o.dtfiminfradesmontagem, o.dtfimdesmontagem) AS dtfimrealizacao

  FROM
  staffeventos se
  LEFT JOIN -- LEFT JOIN para não perder registros sem log
  OriginalExecutor oe ON oe.idstaffevento = se.idstaffevento 
  LEFT JOIN
  funcionarios f ON f.idfuncionario = se.idfuncionario
  LEFT JOIN
  usuarios u ON u.idusuario = oe.idexecutor 
  LEFT JOIN
  eventos e ON e.idevento = se.idevento
  LEFT JOIN
  orcamentos o ON o.idevento = e.idevento

  WHERE
  -- FILTRO DE STATUS: Pelo menos UM dos status precisa ter sido definido (diferente de NULL)
  (
  se.statuscaixinha IS NOT NULL OR
  se.statusajustecusto IS NOT NULL OR
  se.statusdiariadobrada IS NOT NULL OR
  se.statusmeiadiaria IS NOT NULL
  )
  AND
  -- FILTRO DE VALOR/DATA: Pelo menos UM dos valores/datas precisa ser relevante
  (
  (se.vlrcaixinha IS NOT NULL AND se.vlrcaixinha != 0) OR
  (se.vlrajustecusto IS NOT NULL AND se.vlrajustecusto != 0) OR
  se.dtdiariadobrada IS NOT NULL OR
  se.dtmeiadiaria IS NOT NULL
  )

  ORDER BY
  se.idstaffevento, -- Necessário para DISTINCT ON
  oe.criado_em DESC;
  `, [idempresa]); // A query usa apenas $1 (idempresa)

  // Monta os pedidos (Lógica de transformação mantida da sua rota original)
  const pedidos = rows.map(r => {
  let dados = {};
  // A query agora prioriza os dados de staffeventos, o log.dadosnovos é menos relevante
  // mas mantemos o parse por segurança
  try { dados = JSON.parse(r.dadosnovos); } catch { /* ignore */ }  

  function parseValor(v) {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  // O valor já é string (se.vlrcaixinha::text), então pode ser float diretamente
  return parseFloat(String(v).replace(',', '.')) || 0;
  }

  function montarCampo(info, valorRaw, descricaoRaw, datasRaw) {
  // Se o status for NULL (caso não tenha log correspondente), ignora o campo
  if (info === null) return null; 

  const valor = parseValor(valorRaw);
  const descricao = descricaoRaw && descricaoRaw !== '-' ? descricaoRaw : null;
  let datas = [];
  if (datasRaw) {
  // Se o campo for de data (dtdiariadobrada/dtmeiadiaria), o valorRaw é uma data e não um array.
  // Para diárias, a lógica é diferente do valor monetário.
  if (datasRaw && String(datasRaw).startsWith('[')) {
   try { datas = JSON.parse(datasRaw); } catch {}
  }
  }

  // status normalizado + cor
  let status = 'Pendente';
  let cor = '#facc15';
  if (info && typeof info === 'string') {
  const lower = info.toLowerCase();
  if (lower === 'aprovado' || lower === 'autorizado') { status = 'Autorizado'; cor = '#16a34a'; }
  else if (lower === 'rejeitado') { status = 'Rejeitado'; cor = '#dc2626'; }
  else status = info;
  }

  // O campo só é relevante se for valor > 0 OU tiver descrição OU tiver datas (para diárias)
  // O filtro WHERE no SQL já garante isso, mas este é o filtro final
  if (valor > 0 || descricao || (datas && datas.length > 0) || datasRaw) {
  return { status, cor, valor, descricao, datas: datas.length > 0 ? datas : (datasRaw ? [datasRaw] : []) };
  }
  return null;
  }

  return {
      idpedido: r.id,
      solicitante: r.idexecutor || null, // Pode ser NULL se não achou log
      nomeSolicitante: r.nomesolicitante || '-',
      funcionario: r.nomefuncionario || '-',
      evento: r.evento,
      tipopedido: 'Financeiro',
      criado_em: r.criado_em,
      datasevento: r.datasevento || '-',
      dtfimrealizacao: r.dtfimrealizacao || null,
      // vlrtotal e descricao são consolidações, não mudam a lógica
      vlrtotal: parseValor(r.vlrcaixinha || r.vlrajustecusto),
      descricao: r.desccaixinha || r.descajustecusto || r.descdiariadobrada || r.descmeiadiaria || '-',

      // Note: Para diárias, você deve passar o campo de data (dtdiariadobrada/dtmeiadiaria) no lugar do valorRaw,
      // e o campo de valor monetário fica nulo (a menos que a diária tenha valor fixo na tabela)
      statuscaixinha: montarCampo(r.statuscaixinha, r.vlrcaixinha, r.desccaixinha),
      statusajustecusto: montarCampo(r.statusajustecusto, r.vlrajustecusto, r.descajustecusto),

      // Diárias: Usamos a data para relevância, valorRaw é 0
      statusdiariadobrada: montarCampo(r.statusdiariadobrada, 0, r.descdiariadobrada, r.dtdiariadobrada),
      statusmeiadiaria: montarCampo(r.statusmeiadiaria, 0, r.descmeiadiaria, r.dtmeiadiaria)
      };
  })
  .filter(p => {
    const campos = ['statuscaixinha', 'statusajustecusto', 'statusdiariadobrada', 'statusmeiadiaria'];

  // Relevância: Mantém apenas se tiver algum campo com status/valor/data preenchido (SQL já fez isso, mas repetimos para o filtro final)
    const temRelevancia = campos.some(c => p[c] !== null);
    if (!temRelevancia) return false;

    /*
    // Lógica de Prazo (10 dias após o fim do evento) - DESATIVADO PARA TESTE
    if (p.dtfimrealizacao) {
    const fim = new Date(p.dtfimrealizacao);

    if (!isNaN(fim.getTime())) {
    const limite = new Date(fim);
    limite.setDate(fim.getDate() + 10); // Mantém o prazo de 10 dias

    if (new Date() > limite) return false; // Passou do prazo -> remove
    }
    }
    */

    return true;
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

// router.get('/aditivoextra/pendentes', async (req, res) => {

//   // 💡 CORREÇÃO 1: Utiliza a mesma lógica robusta para obter ID da Empresa e do Usuário
//   const idEmpresa = req.idempresa || req.headers.idempresa; 
//   const idUsuario = req.usuario?.idusuario || req.headers.idusuario; 

//   if (!idEmpresa) return res.status(400).json({ erro: 'Empresa não informada' });
//   if (!idUsuario) return res.status(400).json({ erro: 'Usuário não informado' });


//   // 1. Checa se o usuário é Master no Staff
//   // Agora idUsuario deve estar preenchido corretamente
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
//   func.nome AS nomeFuncionario,
//   f.descfuncao AS funcao,
//   e.nmevento AS evento,
//   s.nome || ' ' || s.sobrenome AS nomesolicitante
//   FROM 
//   AditivoExtra ae
//   JOIN 
//   Funcao f ON ae.idFuncao = f.idFuncao
//   JOIN 
//   Funcionarios func ON ae.idFuncionario = func.idFuncionario
//   JOIN 
//   Orcamentos o ON ae.idOrcamento = o.idOrcamento
//   JOIN 
//   Eventos e ON o.idEvento = e.idEvento
//   JOIN 
//   Usuarios s ON ae.idUsuarioSolicitante = s.idUsuario
//   WHERE 
//   ae.idEmpresa = $1 AND ae.status = 'Pendente'
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
// =======================================



// =======================================
// VENCIMENTOS
// =======================================

// router.get("/vencimentos", async (req, res) => {
//   try {
//   const idempresa = req.idempresa;
//   if (!idempresa) {
//   return res.status(400).json({ error: "idempresa obrigatório." });
//   }

//   // filtros
//   const periodo = (req.query.periodo || 'diario').toLowerCase();
//   const data = req.query.data;
//   const mes = parseInt(req.query.mes, 10);
//   const ano = parseInt(req.query.ano, 10) || new Date().getFullYear();
//   const trimestre = parseInt(req.query.trimestre, 10);
//   const semestre = parseInt(req.query.semestre, 10);

//   // formatador
//   const fmt = d => {
//   const yyyy = d.getFullYear();
//   const mm = String(d.getMonth() + 1).padStart(2, '0');
//   const dd = String(d.getDate()).padStart(2, '0');
//   return `${yyyy}-${mm}-${dd}`;
//   };

//   let startDate, endDate;
//   let filtroDiario = false;

//   // ------------------------
//   // 🎯 REGRA DIÁRIO AJUSTADA
//   // ------------------------
//   if (periodo === "diario") {
//   filtroDiario = true;

//   const diaEscolhido = data ? new Date(data) : new Date();
//   startDate = fmt(diaEscolhido);
//   endDate = fmt(diaEscolhido);
//   }

//   else if (periodo === "mensal") {
//   const m = (!isNaN(mes) ? mes : new Date().getMonth() + 1);
//   const first = new Date(ano, m - 1, 1);
//   const last = new Date(ano, m, 0);
//   startDate = fmt(first);
//   endDate = fmt(last);
//   }

//   else if (periodo === "trimestral") {
//   const t = (!isNaN(trimestre) ? trimestre : 1);
//   const startM = (t - 1) * 3;
//   const first = new Date(ano, startM, 1);
//   const last = new Date(ano, startM + 3, 0);
//   startDate = fmt(first);
//   endDate = fmt(last);
//   }

//   else if (periodo === "semestral") {
//   const s = (!isNaN(semestre) ? semestre : 1);
//   const startM = s === 1 ? 0 : 6;
//   const first = new Date(ano, startM, 1);
//   const last = new Date(ano, startM + 6, 0);
//   startDate = fmt(first);
//   endDate = fmt(last);
//   }

//   else if (periodo === "anual") {
//   const first = new Date(ano, 0, 1);
//   const last = new Date(ano, 11, 31);
//   startDate = fmt(first);
//   endDate = fmt(last);
//   }

//   // ------------------------
//   // SQL DIFERENTE PARA DIÁRIO
//   // ------------------------
//   const whereVencimento = filtroDiario
//   ? `
//   -- Evento está acontecendo neste dia
//   torc.dtinimarcacao::date <= $2::date
//   AND
//   torc.dtfimdesmontagem::date >= $2::date
//   `
//   : `
//   -- Vencimento por ajuda ou cachê
//   ((torc.dtinimarcacao + INTERVAL '2 days')::date BETWEEN $2 AND $3)
//   OR
//   ((torc.dtfimrealizacao + INTERVAL '10 days')::date BETWEEN $2 AND $3)
//   `;

//   const query = `
//   SELECT
//   tse.idevento,
//   tse.nmevento,

//   COUNT(*) AS total_registros_evento,
//   COUNT(*) FILTER (WHERE tse.statuspgto = 'Pendente') AS qtd_pendentes_registros,
//   COUNT(*) FILTER (WHERE tse.statuspgto != 'Pendente') AS qtd_pagos_registros,

//   -- ajuda custo
//   SUM(
//   (COALESCE(tse.vlralmoco,0) + COALESCE(tse.vlralimentacao,0) + COALESCE(tse.vlrtransporte,0))
//   * GREATEST(jsonb_array_length(tse.datasevento), 1)
//   ) AS ajuda_total,

//   SUM(
//   (COALESCE(tse.vlralmoco,0) + COALESCE(tse.vlralimentacao,0) + COALESCE(tse.vlrtransporte,0))
//   * GREATEST(jsonb_array_length(tse.datasevento), 1)
//   ) FILTER (WHERE tse.statuspgto = 'Pendente') AS ajuda_pendente,

//   -- cache
//   SUM(
//   COALESCE(tse.vlrcache,0) * GREATEST(jsonb_array_length(tse.datasevento), 1)
//   ) AS cache_total,

//   SUM(
//   COALESCE(tse.vlrcache,0) * GREATEST(jsonb_array_length(tse.datasevento), 1)
//   ) FILTER (WHERE tse.statuspgto = 'Pendente') AS cache_pendente

//   FROM staffeventos tse
//   JOIN staffempresas semp ON tse.idstaff = semp.idstaff
//   JOIN orcamentos torc ON tse.idevento = torc.idevento
//   WHERE semp.idempresa = $1
//   AND (${whereVencimento})
//   GROUP BY tse.idevento, tse.nmevento
//   ORDER BY tse.nmevento;
//   `;

//   const params = filtroDiario
//   ? [idempresa, startDate]  // diário só usa 2 parâmetros
//   : [idempresa, startDate, endDate];

//   const { rows } = await pool.query(query, params);

//   // monta resposta
//   const eventos = rows.map(r => ({
//   idevento: r.idevento,
//   nomeEvento: r.nmevento,
//   ajuda: {
//   total: r.ajuda_total,
//   pendente: r.ajuda_pendente,
//   pagos: r.total_registros_evento - r.qtd_pendentes_registros
//   },
//   cache: {
//   total: r.cache_total,
//   pendente: r.cache_pendente,
//   pagos: r.total_registros_evento - r.qtd_pendentes_registros
//   }
//   }));

//   return res.json({
//   periodo,
//   startDate,
//   endDate,
//   eventos
//   });

//   } catch (error) {
//   console.error("Erro em /vencimentos:", error);
//   return res.status(500).json({ error: error.message });
//   }
// });

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

// router.get("/vencimentos", async (req, res) => {
    
//     // Função auxiliar de data (DD/MM/YYYY)
//     const formatarData = (data) => {
//         if (!data) return 'N/A';
//         // A data pode vir como string do SQL que o JS interpreta como UTC.
//         // Adicionar um ajuste de fuso horário pode ser necessário dependendo da sua configuração, 
//         // mas o new Date(data) geralmente é suficiente se a entrada for um DATE válido.
//         const d = new Date(data); 
        
//         const dia = String(d.getDate()).padStart(2, '0');
//         const mes = String(d.getMonth() + 1).padStart(2, '0');
//         const ano = d.getFullYear();
//         return `${dia}/${mes}/${ano}`;
//     };

//     console.log("🔥 Rota /vencimentos acessada com query:", req.query);
//     try {
//         const idempresa = req.idempresa;
//         // ⚠️ Assumindo que 'pool' está acessível no escopo (e.g., importado/definido antes).
//         // ⚠️ Assumindo que 'router' está acessível no escopo (e.g., const router = require('express').Router();)
        
//         if (!idempresa) {
//             return res.status(400).json({ error: "idempresa obrigatório." });
//         }

//         // Filtros de período (mantendo a lógica original)
//         const periodo = (req.query.periodo || 'diario').toLowerCase();
//         const dataInicioQuery = req.query.dataInicio;
//         const dataFimQuery = req.query.dataFim;
//         const mes = parseInt(req.query.mes, 10);
//         const ano = parseInt(req.query.ano, 10) || new Date().getFullYear();
//         const trimestre = parseInt(req.query.trimestre, 10);
//         const semestre = parseInt(req.query.semestre, 10);

//         // formatador de data para o SQL (YYYY-MM-DD)
//         const fmt = d => {
//             const yyyy = d.getFullYear();
//             const mm = String(d.getMonth() + 1).padStart(2, '0');
//             const dd = String(d.getDate()).padStart(2, '0');
//             return `${yyyy}-${mm}-${dd}`;
//         };

//         let startDate, endDate;

//         // ------------------------
//         // LÓGICA DE DATAS (Define o range de filtro: $2 e $3)
//         // ------------------------
//         if (periodo === "diario") {
//             if (dataInicioQuery && dataFimQuery) {
//                 startDate = dataInicioQuery;
//                 endDate = dataFimQuery;
//             } else {
//                 const hoje = new Date();
//                 startDate = fmt(hoje);
//                 endDate = fmt(hoje);
//             }
//         }
//         else if (periodo === "semanal") { // ✅ NOVO: Lógica Semanal
//             const hoje = new Date();
//             let dataBase = (dataInicioQuery ? new Date(dataInicioQuery) : hoje);
            
//             // Pega o dia da semana (0 = Domingo, 6 = Sábado)
//             const diaSemana = dataBase.getDay();

//             // Calcula o início da semana (Domingo)
//             const primeiroDiaSemana = new Date(dataBase);
//             primeiroDiaSemana.setDate(dataBase.getDate() - diaSemana); // Volta para Domingo
//             startDate = fmt(primeiroDiaSemana);

//             // Calcula o fim da semana (Sábado)
//             const ultimoDiaSemana = new Date(primeiroDiaSemana);
//             ultimoDiaSemana.setDate(primeiroDiaSemana.getDate() + 6); // Avança 6 dias
//             endDate = fmt(ultimoDiaSemana);
//         }
//         else if (periodo === "mensal") {
//             const m = (!isNaN(mes) ? mes : new Date().getMonth() + 1);
//             const first = new Date(ano, m - 1, 1);
//             const last = new Date(ano, m, 0);
//             startDate = fmt(first);
//             endDate = fmt(last);
//         }
//         else if (periodo === "trimestral") {
//             const t = (!isNaN(trimestre) ? trimestre : 1);
//             const startM = (t - 1) * 3;
//             const first = new Date(ano, startM, 1);
//             const last = new Date(ano, startM + 3, 0);
//             startDate = fmt(first);
//             endDate = fmt(last);
//         }
//         else if (periodo === "semestral") {
//             const s = (!isNaN(semestre) ? semestre : 1);
//             const startM = s === 1 ? 0 : 6;
//             const first = new Date(ano, startM, 1);
//             const last = new Date(ano, startM + 6, 0);
//             startDate = fmt(first);
//             endDate = fmt(last);
//         }
//         else if (periodo === "anual") {
//             const first = new Date(ano, 0, 1);
//             const last = new Date(ano, 11, 31);
//             startDate = fmt(first);
//             endDate = fmt(last);
//         }
//         if (!startDate || !endDate) {
//             const hoje = new Date();
//             startDate = fmt(hoje);
//             endDate = fmt(hoje);
//         }

//         // ------------------------
//         // REGRA DE NEGÓCIO DE VENCIMENTO (FINAL)
//         // ------------------------
//         const whereVencimento = `
//             ((torc.dtinimarcacao + INTERVAL '2 days')::date BETWEEN $2 AND $3)
//             OR
//             (torc.dtfimrealizacao IS NOT NULL AND (torc.dtfimrealizacao + INTERVAL '10 days')::date BETWEEN $2 AND $3)
//         `.trim();

//         // ----------------------------------------------------
//         // 1. PRIMEIRA QUERY: TOTAIS AGREGADOS POR EVENTO
//         // ----------------------------------------------------
//         const queryAgregacao = `
//             SELECT
//                 tse.idevento,
//                 tse.nmevento,
//                 MAX(torc.dtinimarcacao) AS max_data_inicio_orcamento,
//                 MAX(torc.dtfimrealizacao) AS max_data_fim_realizacao_orcamento,
//                 COUNT(*) AS total_registros_evento,
//                 COUNT(*) FILTER (WHERE tse.statuspgto = 'Pendente') AS qtd_pendentes_registros,
//                 COUNT(*) FILTER (WHERE tse.statuspgto != 'Pendente') AS qtd_pagos_registros,

//                 -- ajuda custo total
//                 SUM(
//                     (COALESCE(tse.vlralmoco,0) + COALESCE(tse.vlralimentacao,0) + COALESCE(tse.vlrtransporte,0))
//                     * GREATEST(jsonb_array_length(tse.datasevento), 1)
//                 ) AS ajuda_total,

//                 -- ajuda custo pendente
//                 SUM(
//                     (COALESCE(tse.vlralmoco,0) + COALESCE(tse.vlralimentacao,0) + COALESCE(tse.vlrtransporte,0))
//                     * GREATEST(jsonb_array_length(tse.datasevento), 1)
//                 ) FILTER (WHERE tse.statuspgto = 'Pendente') AS ajuda_pendente,

//                 -- cache total
//                 SUM(
//                     COALESCE(tse.vlrcache,0) * GREATEST(jsonb_array_length(tse.datasevento), 1)
//                 ) AS cache_total,

//                 -- cache pendente
//                 SUM(
//                     COALESCE(tse.vlrcache,0) * GREATEST(jsonb_array_length(tse.datasevento), 1)
//                 ) FILTER (WHERE tse.statuspgto = 'Pendente') AS cache_pendente

//             FROM staffeventos tse
//             JOIN staffempresas semp ON tse.idstaff = semp.idstaff
//             JOIN orcamentos torc ON tse.idevento = torc.idevento
//             WHERE semp.idempresa = $1
//             AND (${whereVencimento})
//             GROUP BY tse.idevento, tse.nmevento
//             ORDER BY tse.nmevento;
//         `;

//         const params = [idempresa, startDate, endDate];
//         const { rows: eventosAgregados } = await pool.query(queryAgregacao, params);

//         // Se não houver eventos, retorna vazio
//         if (eventosAgregados.length === 0) {
//             return res.json({ periodo, startDate, endDate, eventos: [] });
//         }

//         // ----------------------------------------------------
//         // 2. SEGUNDA QUERY: DETALHES INDIVIDUAIS DOS FUNCIONÁRIOS
//         // ----------------------------------------------------
//         const idsEventosFiltrados = eventosAgregados.map(e => e.idevento);

//         const queryDetalhes = `
//             SELECT
//                 tse.idevento,
//                 tse.nmfuncionario AS nome,
//                 tse.nmfuncao AS funcao,
//                 jsonb_array_length(tse.datasevento) AS qtdDiarias,
//                 COALESCE(tse.vlrcache, 0) * GREATEST(jsonb_array_length(tse.datasevento), 1) AS totalCache,
//                 (COALESCE(tse.vlralmoco, 0) + COALESCE(tse.vlralimentacao, 0) + COALESCE(tse.vlrtransporte, 0))
//                     * GREATEST(jsonb_array_length(tse.datasevento), 1) AS totalAjudaCusto,
//                 (
//                     COALESCE(tse.vlrcache, 0) + 
//                     COALESCE(tse.vlralmoco, 0) + 
//                     COALESCE(tse.vlralimentacao, 0) + 
//                     COALESCE(tse.vlrtransporte, 0)
//                 ) * GREATEST(jsonb_array_length(tse.datasevento), 1) AS totalPagar,
//                 tse.statuspgto AS statusPgto
//             FROM staffeventos tse
//             WHERE tse.idevento = ANY($1) 
//             ORDER BY tse.idevento, tse.nmfuncionario;
//         `;

//         // Executa a query de detalhes, usando os IDs de evento da primeira query
//         const { rows: detalhesFuncionarios } = await pool.query(queryDetalhes, [idsEventosFiltrados]); 

//         // ----------------------------------------------------
//         // 3. PROCESSAMENTO E ANINHAMENTO DOS DADOS
//         // ----------------------------------------------------

//         // A. Cria um mapa de funcionários agrupados por idevento
//         const funcionariosPorEvento = detalhesFuncionarios.reduce((acc, func) => {
//             const idevento = func.idevento;
//             if (!acc[idevento]) {
//                 acc[idevento] = [];
//             }
            
//             // Tratamento e aninhamento dos dados do funcionário
//             acc[idevento].push({
//                 // ✅ MAPEAMENTO CRÍTICO: Renomeando de minúsculas para camelCase
//                 idevento: func.idevento,
//                 nome: func.nome,
//                 funcao: func.funcao,
//                 statusPgto: func.statuspgto,

//                 // ✅ CORREÇÃO DE NOME E CONVERSÃO
//                 qtdDiarias: parseInt(func.qtddiarias, 10) || 0,
//                 totalCache: parseFloat(func.totalcache) || 0,
//                 totalAjudaCusto: parseFloat(func.totalajudacusto) || 0,
//                 totalPagar: parseFloat(func.totalpagar) || 0,

//             });
//             return acc;
//         }, {});


//         // B. Mapeia os eventos agregados, adicionando a lista de funcionários
//         const eventosComDetalhes = eventosAgregados.map(r => {
//             // 1. Converter valores para float e calcular totalGeral
//             const ajudaTotal = parseFloat(r.ajuda_total) || 0;
//             const cacheTotal = parseFloat(r.cache_total) || 0;
//             const totalGeral = ajudaTotal + cacheTotal;

//             // 2. Cálculo de Vencimentos e Datas (Baseado no r.max_data_inicio/fim_orcamento)
//             const dataInicioEvento = formatarData(r.max_data_inicio_orcamento); 
//             const dataFimEvento = formatarData(r.max_data_fim_realizacao_orcamento);

//             const maxDataInicio = new Date(r.max_data_inicio_orcamento);
//             const vencimentoAjudaCusto = new Date(maxDataInicio.getTime());
//             vencimentoAjudaCusto.setDate(maxDataInicio.getDate() + 2);
//             const dataVencimentoAjuda = formatarData(vencimentoAjudaCusto);

//             let dataVencimentoCache = 'N/A';
//             if (r.max_data_fim_realizacao_orcamento) {
//                 const maxDataFim = new Date(r.max_data_fim_realizacao_orcamento);
//                 const vencimentoCache = new Date(maxDataFim.getTime());
//                 vencimentoCache.setDate(maxDataFim.getDate() + 10);
//                 dataVencimentoCache = formatarData(vencimentoCache);
//             }
            
//             const idevento = r.idevento;

//             return {
//                 idevento: idevento,
//                 nomeEvento: r.nmevento,
//                 totalGeral: totalGeral,

//                 dataInicioEvento,   
//                 dataFimEvento,      
//                 dataVencimentoAjuda,
//                 dataVencimentoCache,

//                 ajuda: {
//                     total: ajudaTotal,
//                     pendente: parseFloat(r.ajuda_pendente) || 0,
//                     // Pagos é o total - o que está pendente
//                     pagos: ajudaTotal - (parseFloat(r.ajuda_pendente) || 0) 
//                 },
//                 cache: {
//                     total: cacheTotal,
//                     pendente: parseFloat(r.cache_pendente) || 0,
//                     // Pagos é o total - o que está pendente
//                     pagos: cacheTotal - (parseFloat(r.cache_pendente) || 0)
//                 },
                
//                 // ⬅️ ANINHAMENTO FINAL: Lista de funcionários
//                 funcionarios: funcionariosPorEvento[idevento] || []
//             }
//         });

//         // 4. Retornar a resposta final
//         return res.json({
//             periodo,
//             startDate,
//             endDate,
//             eventos: eventosComDetalhes
//         });

//     } catch (error) {
//         console.error("Erro em /vencimentos:", error);
//         // Retorna o erro 500 para o frontend
//         return res.status(500).json({ error: error.message });
//     }
// });



// =======================================
// AGENDA PESSOAL DO USUÁRIO
// =======================================

router.get("/vencimentos", async (req, res) => {
    
    // ... [SUA FUNÇÃO formatarData (DD/MM/YYYY) É MANTIDA AQUI] ...
    const formatarData = (data) => {
        if (!data) return 'N/A';
        const d = new Date(data); 
        const dia = String(d.getDate()).padStart(2, '0');
        const mes = String(d.getMonth() + 1).padStart(2, '0');
        const ano = d.getFullYear();
        return `${dia}/${mes}/${ano}`;
    };

    console.log("🔥 Rota /vencimentos acessada com query:", req.query);
    try {
        const idempresa = req.idempresa;
        if (!idempresa) {
            return res.status(400).json({ error: "idempresa obrigatório." });
        }

        // Filtros de período (mantendo a lógica original)
        const periodo = (req.query.periodo || 'diario').toLowerCase();
        const dataInicioQuery = req.query.dataInicio;
        // const dataFimQuery = req.query.dataFim; // Não é usado diretamente, pois dataFim é calculado
        const mes = parseInt(req.query.mes, 10);
        const ano = parseInt(req.query.ano, 10) || new Date().getFullYear();
        const trimestre = parseInt(req.query.trimestre, 10);
        const semestre = parseInt(req.query.semestre, 10);

        // formatador de data para o SQL (YYYY-MM-DD)
        const fmt = d => {
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`;
        };

        let startDate, endDate;
        let dataBase; // Variável auxiliar para a data de início

        // ------------------------
        // LÓGICA DE DATAS (Define o range de filtro: $2 e $3)
        // ------------------------
        
        // --- DIÁRIO ---
        if (periodo === "diario") {
            // Se veio do query, use a string (Ex: '2025-01-20'), se não, use hoje
            dataBase = dataInicioQuery ? new Date(dataInicioQuery + 'T00:00:00') : new Date();
            startDate = fmt(dataBase);
            endDate = fmt(dataBase);
        }
        
        // --- SEMANAL (CORRIGIDO) ---
        else if (periodo === "semanal") {
            // Usa T00:00:00 para garantir que o fuso horário local não altere o dia.
            dataBase = dataInicioQuery ? new Date(dataInicioQuery + 'T00:00:00') : new Date();
            
            // Pega o dia da semana (0 = Domingo, 6 = Sábado)
            const diaSemana = dataBase.getDay();

            // Calcula o início da semana (Domingo)
            const primeiroDiaSemana = new Date(dataBase);
            // .getDate() - diaSemana garante que voltamos para o Domingo
            primeiroDiaSemana.setDate(dataBase.getDate() - diaSemana);
            startDate = fmt(primeiroDiaSemana);

            // Calcula o fim da semana (Sábado)
            const ultimoDiaSemana = new Date(primeiroDiaSemana);
            ultimoDiaSemana.setDate(primeiroDiaSemana.getDate() + 6); // Avança 6 dias
            endDate = fmt(ultimoDiaSemana);
        }
        
        // --- MENSAL ---
        else if (periodo === "mensal") {
            const m = (!isNaN(mes) ? mes : new Date().getMonth() + 1);
            const first = new Date(ano, m - 1, 1);
            const last = new Date(ano, m, 0); // Dia 0 do próximo mês = último dia do mês atual
            startDate = fmt(first);
            endDate = fmt(last);
        }
        
        // --- TRIMESTRAL ---
        else if (periodo === "trimestral") {
            const t = (!isNaN(trimestre) ? trimestre : Math.ceil((new Date().getMonth() + 1) / 3));
            const startM = (t - 1) * 3;
            const first = new Date(ano, startM, 1);
            const last = new Date(ano, startM + 3, 0);
            startDate = fmt(first);
            endDate = fmt(last);
        }
        
        // --- SEMESTRAL ---
        else if (periodo === "semestral") {
            const currentMonth = new Date().getMonth();
            const defaultSemestre = currentMonth <= 5 ? 1 : 2; // 0-5 é 1º sem, 6-11 é 2º sem
            const s = (!isNaN(semestre) ? semestre : defaultSemestre);
            const startM = s === 1 ? 0 : 6;
            const first = new Date(ano, startM, 1);
            const last = new Date(ano, startM + 6, 0);
            startDate = fmt(first);
            endDate = fmt(last);
        }
        
        // --- ANUAL ---
        else if (periodo === "anual") {
            const first = new Date(ano, 0, 1);
            const last = new Date(ano, 11, 31);
            startDate = fmt(first);
            endDate = fmt(last);
        }
        
        // Fallback: Se por algum motivo as datas não foram definidas
        if (!startDate || !endDate) {
            const hoje = new Date();
            startDate = fmt(hoje);
            endDate = fmt(hoje);
        }

        // ------------------------
        // REGRA DE NEGÓCIO DE VENCIMENTO (FINAL)
        // ------------------------
        // A sua WHERE CLAUSE está correta para usar $2 e $3 (startDate e endDate)
        const whereVencimento = `
            ((torc.dtinimarcacao + INTERVAL '2 days')::date BETWEEN $2 AND $3)
            OR
            (torc.dtfimrealizacao IS NOT NULL AND (torc.dtfimrealizacao + INTERVAL '10 days')::date BETWEEN $2 AND $3)
        `.trim();

        // ----------------------------------------------------
        // 1. PRIMEIRA QUERY: TOTAIS AGREGADOS POR EVENTO
        // ----------------------------------------------------
        // ... [Sua queryAgregacao é mantida] ...
        const queryAgregacao = `
            SELECT
                tse.idevento,
                tse.nmevento,
                MAX(torc.dtinimarcacao) AS max_data_inicio_orcamento,
                MAX(torc.dtfimrealizacao) AS max_data_fim_realizacao_orcamento,
                COUNT(*) AS total_registros_evento,
                COUNT(*) FILTER (WHERE tse.statuspgto = 'Pendente') AS qtd_pendentes_registros,
                COUNT(*) FILTER (WHERE tse.statuspgto != 'Pendente') AS qtd_pagos_registros,

                -- ajuda custo total
                SUM(
                    (COALESCE(tse.vlralmoco,0) + COALESCE(tse.vlralimentacao,0) + COALESCE(tse.vlrtransporte,0))
                    * GREATEST(jsonb_array_length(tse.datasevento), 1)
                ) AS ajuda_total,

                -- ajuda custo pendente
                SUM(
                    (COALESCE(tse.vlralmoco,0) + COALESCE(tse.vlralimentacao,0) + COALESCE(tse.vlrtransporte,0))
                    * GREATEST(jsonb_array_length(tse.datasevento), 1)
                ) FILTER (WHERE tse.statuspgto = 'Pendente') AS ajuda_pendente,

                -- cache total
                SUM(
                    COALESCE(tse.vlrcache,0) * GREATEST(jsonb_array_length(tse.datasevento), 1)
                ) AS cache_total,

                -- cache pendente
                SUM(
                    COALESCE(tse.vlrcache,0) * GREATEST(jsonb_array_length(tse.datasevento), 1)
                ) FILTER (WHERE tse.statuspgto = 'Pendente') AS cache_pendente

            FROM staffeventos tse
            JOIN staffempresas semp ON tse.idstaff = semp.idstaff
            JOIN orcamentos torc ON tse.idevento = torc.idevento
            WHERE semp.idempresa = $1
            AND (${whereVencimento})
            GROUP BY tse.idevento, tse.nmevento
            ORDER BY tse.nmevento;
        `;

        const params = [idempresa, startDate, endDate];
        // ⚠️ ASSUMIR QUE pool.query ESTÁ DEFINIDO E DISPONÍVEL
        const { rows: eventosAgregados } = await pool.query(queryAgregacao, params); 

        if (eventosAgregados.length === 0) {
            return res.json({ periodo, startDate, endDate, eventos: [] });
        }

        // ----------------------------------------------------
        // 2. SEGUNDA QUERY: DETALHES INDIVIDUAIS DOS FUNCIONÁRIOS
        // ----------------------------------------------------
        // ... [Sua queryDetalhes e o resto do código de aninhamento são mantidos] ...
        const idsEventosFiltrados = eventosAgregados.map(e => e.idevento);

        const queryDetalhes = `
            SELECT
                tse.idevento,
                tse.nmfuncionario AS nome,
                tse.nmfuncao AS funcao,
                jsonb_array_length(tse.datasevento) AS qtdDiarias,
                COALESCE(tse.vlrcache, 0) * GREATEST(jsonb_array_length(tse.datasevento), 1) AS totalCache,
                (COALESCE(tse.vlralmoco, 0) + COALESCE(tse.vlralimentacao, 0) + COALESCE(tse.vlrtransporte, 0))
                    * GREATEST(jsonb_array_length(tse.datasevento), 1) AS totalAjudaCusto,
                (
                    COALESCE(tse.vlrcache, 0) + 
                    COALESCE(tse.vlralmoco, 0) + 
                    COALESCE(tse.vlralimentacao, 0) + 
                    COALESCE(tse.vlrtransporte, 0)
                ) * GREATEST(jsonb_array_length(tse.datasevento), 1) AS totalPagar,
                tse.statuspgto AS statusPgto
            FROM staffeventos tse
            WHERE tse.idevento = ANY($1) 
            ORDER BY tse.idevento, tse.nmfuncionario;
        `;

        const { rows: detalhesFuncionarios } = await pool.query(queryDetalhes, [idsEventosFiltrados]); 

        // ----------------------------------------------------
        // 3. PROCESSAMENTO E ANINHAMENTO DOS DADOS
        // ----------------------------------------------------

        // A. Cria um mapa de funcionários agrupados por idevento
        const funcionariosPorEvento = detalhesFuncionarios.reduce((acc, func) => {
            const idevento = func.idevento;
            if (!acc[idevento]) {
                acc[idevento] = [];
            }
            
            acc[idevento].push({
                idevento: func.idevento,
                nome: func.nome,
                funcao: func.funcao,
                statusPgto: func.statuspgto,
                qtdDiarias: parseInt(func.qtddiarias, 10) || 0,
                totalCache: parseFloat(func.totalcache) || 0,
                totalAjudaCusto: parseFloat(func.totalajudacusto) || 0,
                totalPagar: parseFloat(func.totalpagar) || 0,

            });
            return acc;
        }, {});


        // B. Mapeia os eventos agregados, adicionando a lista de funcionários
        const eventosComDetalhes = eventosAgregados.map(r => {
            const ajudaTotal = parseFloat(r.ajuda_total) || 0;
            const cacheTotal = parseFloat(r.cache_total) || 0;
            const totalGeral = ajudaTotal + cacheTotal;

            // ... [Lógica de cálculo de vencimentos é mantida e está OK] ...
            const dataInicioEvento = formatarData(r.max_data_inicio_orcamento); 
            const dataFimEvento = formatarData(r.max_data_fim_realizacao_orcamento);

            const maxDataInicio = new Date(r.max_data_inicio_orcamento);
            const vencimentoAjudaCusto = new Date(maxDataInicio.getTime());
            vencimentoAjudaCusto.setDate(maxDataInicio.getDate() + 2);
            const dataVencimentoAjuda = formatarData(vencimentoAjudaCusto);

            let dataVencimentoCache = 'N/A';
            if (r.max_data_fim_realizacao_orcamento) {
                const maxDataFim = new Date(r.max_data_fim_realizacao_orcamento);
                const vencimentoCache = new Date(maxDataFim.getTime());
                vencimentoCache.setDate(maxDataFim.getDate() + 10);
                dataVencimentoCache = formatarData(vencimentoCache);
            }
            
            const idevento = r.idevento;

            return {
                idevento: idevento,
                nomeEvento: r.nmevento,
                totalGeral: totalGeral,

                dataInicioEvento,   
                dataFimEvento,      
                dataVencimentoAjuda,
                dataVencimentoCache,

                ajuda: {
                    total: ajudaTotal,
                    pendente: parseFloat(r.ajuda_pendente) || 0,
                    pagos: ajudaTotal - (parseFloat(r.ajuda_pendente) || 0) 
                },
                cache: {
                    total: cacheTotal,
                    pendente: parseFloat(r.cache_pendente) || 0,
                    pagos: cacheTotal - (parseFloat(r.cache_pendente) || 0)
                },
                
                funcionarios: funcionariosPorEvento[idevento] || []
            }
        });

        // 4. Retornar a resposta final
        return res.json({
            periodo,
            startDate,
            endDate,
            eventos: eventosComDetalhes
        });

    } catch (error) {
        console.error("Erro em /vencimentos:", error);
        return res.status(500).json({ error: error.message });
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



router.get('/aditivoextra', async (req, res) => {

  // 💡 CORREÇÃO 1: Utiliza a mesma lógica robusta para obter ID da Empresa e do Usuário
  const idEmpresa = req.idempresa || req.headers.idempresa; 
  const idUsuario = req.usuario?.idusuario || req.headers.idusuario; 

  if (!idEmpresa) return res.status(400).json({ erro: 'Empresa não informada' });
  if (!idUsuario) return res.status(400).json({ erro: 'Usuário não informado' });


  // 1. Checa se o usuário é Master no Staff
  const { rows: permissoes } = await pool.query(`
  SELECT * FROM permissoes 
  WHERE idusuario = $1 AND modulo = 'Staff' AND master = 'true'
  `, [idUsuario]);

  const ehMasterStaff = permissoes.length > 0;

  // Mantendo o bloqueio de acesso à rota para usuários sem permissão
  if (!ehMasterStaff) {
  return res.status(403).json({ erro: 'Permissão negada. Você não é Master Staff no módulo de Staff.' }); 
  }

  try {
  const query = `
  SELECT 
  ae.idAditivoExtra,
  ae.tipoSolicitacao,
  ae.justificativa,
  ae.status,
  ae.qtdSolicitada,
  ae.dtSolicitacao AS criado_em,
  ae.idFuncionario, -- Adicionando idFuncionario para o front-end
  func.nome AS nomeFuncionario,
  f.descfuncao AS funcao,
  e.nmevento AS evento,
  s.nome || ' ' || s.sobrenome AS nomesolicitante
  FROM 
  AditivoExtra ae
  -- CORREÇÃO: Usar LEFT JOIN para incluir registros mesmo que a Funcao esteja ausente (ou seja um pedido genérico)
  LEFT JOIN 
  Funcao f ON ae.idFuncao = f.idFuncao
  -- CORREÇÃO: Usar LEFT JOIN para incluir registros mesmo que o Funcionario esteja ausente (pedidos de Funções)
  LEFT JOIN 
  Funcionarios func ON ae.idFuncionario = func.idFuncionario
  -- Assumimos que Orcamentos, Eventos e Usuarios Solicitantes sempre existem
  JOIN 
  Orcamentos o ON ae.idOrcamento = o.idOrcamento
  JOIN 
  Eventos e ON o.idEvento = e.idEvento
  JOIN 
  Usuarios s ON ae.idUsuarioSolicitante = s.idUsuario
  WHERE 
  ae.idEmpresa = $1 --AND ae.status = 'Pendente'
  ORDER BY 
  e.nmevento, f.descfuncao, ae.tipoSolicitacao;
  `;

  const resultado = await pool.query(query, [idEmpresa]); 

  // 2. INJETA a flag ehMasterStaff em CADA linha antes de retornar.
  const dadosComPermissao = resultado.rows.map(row => ({
  ...row,
  ehMasterStaff: ehMasterStaff // Passa o valor booleano calculado (TRUE)
  }));

  res.json({
  sucesso: true,
  dados: dadosComPermissao // Retorna o array modificado
  });

  } catch (error) {
  console.error("Erro ao listar AditivoExtra pendentes:", error);
  res.status(500).json({ sucesso: false, erro: "Erro interno ao buscar solicitações Aditivo/Extra." });
  }
});

module.exports = router;