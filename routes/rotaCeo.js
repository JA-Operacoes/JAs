// Rota do CeoMode: análise de rentabilidade por cliente -> eventos.
// Compara o lucro esperado (orçamento) com o custo real executado (staff),
// para indicar se o contrato fechado de cada evento "valeu a pena".
const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB");

// Monta a query de agregação por evento. `filtro` é um trecho extra de WHERE
// (ex: "AND o.idcliente = $2") e `ordem` define a ordenação final.
// Sempre agrega TODOS os orçamentos não recusados (status <> 'R') de cada evento.
function queryAnalise(filtro, ordem) {
  return `
    WITH orcs AS (
      SELECT
        o.idevento, o.idcliente, o.idorcamento, o.nrorcamento,
        COALESCE(o.totgeralvda, 0) AS totgeralvda,
        COALESCE(o.totgeralcto, 0) AS totgeralcto,
        COALESCE(o.totajdcto, 0)   AS totajdcto,
        COALESCE(o.lucroreal, 0)   AS lucroreal,
        COALESCE(o.vlrcliente, 0)  AS vlrcliente,
        o.dtinirealizacao, o.dtfimrealizacao
      FROM orcamentos o
      JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
      WHERE oe.idempresa = $1
        AND o.status <> 'R'
        AND o.idevento IS NOT NULL
        ${filtro}
    ),
    staff_orcado AS (
      SELECT oi.idorcamento, SUM(COALESCE(oi.totgeralitem, 0)) AS custo_staff_orcado
      FROM orcamentoitens oi
      WHERE oi.idfuncao IS NOT NULL
      GROUP BY oi.idorcamento
    ),
    staff_real AS (
      -- Por idorcamento (não idevento!): um evento recorrente (ex: mesma feira todo ano) repete
      -- o idevento em orçamentos de anos diferentes — agrupar por idevento vazava staff de OUTRO
      -- ano/orçamento pro ano filtrado (ex: staff já pago em 2026 aparecendo no 2027 do mesmo evento).
      SELECT se.idorcamento,
             SUM(COALESCE(se.vlrtotcache, 0)
               + COALESCE(se.vlrtotajdcusto, 0)) AS custo_staff_real,
             COUNT(se.idstaffevento) AS qtd_staff_real
      FROM staffeventos se
      GROUP BY se.idorcamento
    ),
    ajustes_pagos AS (
      -- Crédito/Débito avulso (staffajustefinanceiro) só entra no custo real quando 'Pago' —
      -- antes disso não tem evento definitivo (pode ainda mudar de evento/ser rejeitado).
      -- Atribuído ao orçamento onde foi de fato confirmado (idstaffeventopago), não ao de origem.
      -- Crédito = empresa paga a mais ao funcionário (aumenta custo); Débito = funcionário deve
      -- à empresa (reduz custo).
      SELECT se.idorcamento,
             SUM(CASE WHEN af.tipo = 'Credito' THEN af.valor ELSE -af.valor END) AS saldo_ajustefinanceiro
      FROM staffajustefinanceiro af
      JOIN staffeventos se ON se.idstaffevento = af.idstaffeventopago
      WHERE af.status = 'Pago'
      GROUP BY se.idorcamento
    )
    SELECT
      o.idevento,
      e.nmevento,
      c.nmfantasia AS nomecliente,
      array_agg(DISTINCT o.nrorcamento ORDER BY o.nrorcamento) AS nrorcamentos,
      COUNT(DISTINCT o.idorcamento) AS qtd_orcamentos,
      SUM(o.totgeralvda) AS totgeralvda,
      SUM(o.totgeralcto) AS totgeralcto,
      SUM(o.totajdcto)   AS totajdcto,
      SUM(o.lucroreal)   AS lucroreal,
      SUM(o.vlrcliente)  AS vlrcliente,
      SUM(o.totgeralcto + o.totajdcto) AS custo_previsto,
      MIN(o.dtinirealizacao) AS dtinirealizacao,
      MAX(o.dtfimrealizacao) AS dtfimrealizacao,
      SUM(COALESCE(so.custo_staff_orcado, 0)) AS custo_staff_orcado,
      SUM(COALESCE(sr.custo_staff_real, 0)) + SUM(COALESCE(aj.saldo_ajustefinanceiro, 0)) AS custo_staff_real,
      SUM(COALESCE(sr.qtd_staff_real, 0))     AS qtd_staff_real
    FROM orcs o
    JOIN eventos e   ON e.idevento  = o.idevento
    LEFT JOIN clientes c ON c.idcliente = o.idcliente
    LEFT JOIN staff_orcado so ON so.idorcamento = o.idorcamento
    LEFT JOIN staff_real  sr ON sr.idorcamento  = o.idorcamento
    LEFT JOIN ajustes_pagos aj ON aj.idorcamento = o.idorcamento
    GROUP BY o.idevento, e.nmevento, c.nmfantasia
    ${ordem};
  `;
}

// Monta dinamicamente a cláusula AND + params para /filtrar, na mesma convenção
// de queryAnalise ($1 sempre é idempresa, os demais em ordem de inclusão).
function buildFiltro(idempresa, { idcliente, idevento, ano, datainicio, datafim }) {
  const clausulas = [];
  const params = [idempresa];
  let i = 2;

  if (idcliente) { clausulas.push(`o.idcliente = $${i++}`); params.push(idcliente); }
  if (idevento) { clausulas.push(`o.idevento = $${i++}`); params.push(idevento); }
  if (ano) { clausulas.push(`EXTRACT(YEAR FROM o.dtinirealizacao) = $${i++}`); params.push(ano); }
  if (datainicio) { clausulas.push(`o.dtfimrealizacao >= $${i++}`); params.push(datainicio); }
  if (datafim) { clausulas.push(`o.dtinirealizacao <= $${i++}`); params.push(datafim); }

  const filtro = clausulas.length ? `AND ${clausulas.join(" AND ")}` : "";
  return { filtro, params };
}

// GET /ceo/clientes — clientes que têm orçamentos não recusados na empresa.
router.get("/clientes", async (req, res) => {
  try {
    const idempresa = req.idempresa;
    if (!idempresa) return res.status(400).json({ error: "idempresa obrigatório." });

    const { rows } = await pool.query(
      `SELECT DISTINCT c.idcliente, c.nmfantasia
       FROM clientes c
       JOIN orcamentos o ON o.idcliente = c.idcliente
       JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
       WHERE oe.idempresa = $1 AND o.status <> 'R'
       ORDER BY c.nmfantasia ASC`,
      [idempresa]
    );
    res.json(rows);
  } catch (error) {
    console.error("ERRO CEO /clientes:", error);
    res.status(500).json({ error: "Erro ao listar clientes." });
  }
});

// GET /ceo/eventos — lista leve de eventos (todos os clientes) para o seletor de comparação.
router.get("/eventos", async (req, res) => {
  try {
    const idempresa = req.idempresa;
    if (!idempresa) return res.status(400).json({ error: "idempresa obrigatório." });

    const { rows } = await pool.query(
      `SELECT DISTINCT o.idevento, e.nmevento, c.nmfantasia AS nomecliente
       FROM orcamentos o
       JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
       JOIN eventos e ON e.idevento = o.idevento
       LEFT JOIN clientes c ON c.idcliente = o.idcliente
       WHERE oe.idempresa = $1 AND o.status <> 'R' AND o.idevento IS NOT NULL
       ORDER BY c.nmfantasia ASC, e.nmevento ASC`,
      [idempresa]
    );
    res.json(rows);
  } catch (error) {
    console.error("ERRO CEO /eventos:", error);
    res.status(500).json({ error: "Erro ao listar eventos." });
  }
});

// GET /ceo/analise?idcliente=ID — total geral por evento de um cliente.
router.get("/analise", async (req, res) => {
  try {
    const idempresa = req.idempresa;
    const idcliente = parseInt(req.query.idcliente, 10);
    if (!idempresa) return res.status(400).json({ error: "idempresa obrigatório." });
    if (!idcliente) return res.status(400).json({ error: "idcliente obrigatório." });

    const { rows } = await pool.query(
      queryAnalise("AND o.idcliente = $2", "ORDER BY e.nmevento ASC"),
      [idempresa, idcliente]
    );
    res.json({ eventos: rows });
  } catch (error) {
    console.error("ERRO CEO /analise:", error);
    res.status(500).json({ error: "Erro ao carregar análise de rentabilidade." });
  }
});

// GET /ceo/destaque-semana?dias=7 — eventos cuja realização toca os próximos N dias,
// ordenados pelo maior gasto previsto (custo + ajudas). Abertura padrão do painel.
router.get("/destaque-semana", async (req, res) => {
  try {
    const idempresa = req.idempresa;
    if (!idempresa) return res.status(400).json({ error: "idempresa obrigatório." });
    const dias = parseInt(req.query.dias, 10) || 7;

    const filtro = `
      AND o.dtfimrealizacao >= CURRENT_DATE
      AND o.dtinirealizacao <= CURRENT_DATE + $2::int`;
    const { rows } = await pool.query(
      queryAnalise(filtro, "ORDER BY custo_previsto DESC NULLS LAST"),
      [idempresa, dias]
    );
    res.json({ eventos: rows, dias });
  } catch (error) {
    console.error("ERRO CEO /destaque-semana:", error);
    res.status(500).json({ error: "Erro ao carregar destaque da semana." });
  }
});

// GET /ceo/evento-anos?idevento=X — compara o MESMO evento ano a ano.
// Agrupa os orçamentos não recusados do evento por ano da realização (dtinirealizacao);
// staff orçado/real são amarrados por idorcamento (cada orçamento pertence a um ano).
router.get("/evento-anos", async (req, res) => {
  try {
    const idempresa = req.idempresa;
    const idevento = parseInt(req.query.idevento, 10);
    if (!idempresa) return res.status(400).json({ error: "idempresa obrigatório." });
    if (!idevento) return res.status(400).json({ error: "idevento obrigatório." });

    const query = `
      WITH orcs AS (
        SELECT
          EXTRACT(YEAR FROM o.dtinirealizacao)::int AS ano,
          o.idorcamento, o.nrorcamento,
          COALESCE(o.totgeralvda, 0) AS totgeralvda,
          COALESCE(o.totgeralcto, 0) AS totgeralcto,
          COALESCE(o.totajdcto, 0)   AS totajdcto,
          COALESCE(o.lucroreal, 0)   AS lucroreal,
          COALESCE(o.vlrcliente, 0)  AS vlrcliente,
          o.dtinirealizacao, o.dtfimrealizacao
        FROM orcamentos o
        JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
        WHERE oe.idempresa = $1
          AND o.idevento = $2
          AND o.status <> 'R'
          AND o.dtinirealizacao IS NOT NULL
      ),
      staff_orcado AS (
        SELECT oi.idorcamento, SUM(COALESCE(oi.totgeralitem, 0)) AS custo_staff_orcado
        FROM orcamentoitens oi
        WHERE oi.idfuncao IS NOT NULL
        GROUP BY oi.idorcamento
      ),
      staff_real AS (
        SELECT se.idorcamento,
               SUM(COALESCE(se.vlrtotcache, 0)
                 + COALESCE(se.vlrtotajdcusto, 0)) AS custo_staff_real,
               COUNT(se.idstaffevento) AS qtd_staff_real
        FROM staffeventos se
        GROUP BY se.idorcamento
      ),
      ajustes_pagos AS (
        -- Mesma regra da queryAnalise: só 'Pago', atribuído ao evento onde foi confirmado.
        SELECT se.idorcamento,
               SUM(CASE WHEN af.tipo = 'Credito' THEN af.valor ELSE -af.valor END) AS saldo_ajustefinanceiro
        FROM staffajustefinanceiro af
        JOIN staffeventos se ON se.idstaffevento = af.idstaffeventopago
        WHERE af.status = 'Pago'
        GROUP BY se.idorcamento
      )
      SELECT
        o.ano,
        array_agg(DISTINCT o.nrorcamento) AS nrorcamentos,
        COUNT(DISTINCT o.idorcamento) AS qtd_orcamentos,
        SUM(o.totgeralvda) AS totgeralvda,
        SUM(o.totgeralcto) AS totgeralcto,
        SUM(o.totajdcto)   AS totajdcto,
        SUM(o.lucroreal)   AS lucroreal,
        SUM(o.vlrcliente)  AS vlrcliente,
        SUM(o.totgeralcto + o.totajdcto) AS custo_previsto,
        SUM(COALESCE(so.custo_staff_orcado, 0)) AS custo_staff_orcado,
        SUM(COALESCE(sr.custo_staff_real, 0)) + SUM(COALESCE(aj.saldo_ajustefinanceiro, 0)) AS custo_staff_real,
        SUM(COALESCE(sr.qtd_staff_real, 0))     AS qtd_staff_real,
        MIN(o.dtinirealizacao) AS dtinirealizacao,
        MAX(o.dtfimrealizacao) AS dtfimrealizacao
      FROM orcs o
      LEFT JOIN staff_orcado so ON so.idorcamento = o.idorcamento
      LEFT JOIN staff_real  sr ON sr.idorcamento = o.idorcamento
      LEFT JOIN ajustes_pagos aj ON aj.idorcamento = o.idorcamento
      GROUP BY o.ano
      ORDER BY o.ano ASC;
    `;

    const nome = await pool.query("SELECT nmevento FROM eventos WHERE idevento = $1", [idevento]);
    const { rows } = await pool.query(query, [idempresa, idevento]);
    res.json({ nmevento: nome.rows[0]?.nmevento || "Evento", anos: rows });
  } catch (error) {
    console.error("ERRO CEO /evento-anos:", error);
    res.status(500).json({ error: "Erro ao comparar evento por ano." });
  }
});

// GET /ceo/comparar?ids=1,2,3 — agrega os eventos informados (de quaisquer clientes).
router.get("/comparar", async (req, res) => {
  try {
    const idempresa = req.idempresa;
    if (!idempresa) return res.status(400).json({ error: "idempresa obrigatório." });

    const ids = String(req.query.ids || "")
      .split(",")
      .map((n) => parseInt(n, 10))
      .filter((n) => Number.isInteger(n));
    if (ids.length === 0) return res.status(400).json({ error: "ids obrigatório." });

    const { rows } = await pool.query(
      queryAnalise("AND o.idevento = ANY($2::int[])", "ORDER BY custo_previsto DESC NULLS LAST"),
      [idempresa, ids]
    );
    res.json({ eventos: rows });
  } catch (error) {
    console.error("ERRO CEO /comparar:", error);
    res.status(500).json({ error: "Erro ao comparar eventos." });
  }
});

// GET /ceo/anos-disponiveis — anos (dtinirealizacao) com orçamento não recusado, p/ seletor de ano.
router.get("/anos-disponiveis", async (req, res) => {
  try {
    const idempresa = req.idempresa;
    if (!idempresa) return res.status(400).json({ error: "idempresa obrigatório." });

    const { rows } = await pool.query(
      `SELECT DISTINCT EXTRACT(YEAR FROM o.dtinirealizacao)::int AS ano
       FROM orcamentos o
       JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
       WHERE oe.idempresa = $1 AND o.status <> 'R' AND o.idevento IS NOT NULL
         AND o.dtinirealizacao IS NOT NULL
       ORDER BY ano DESC`,
      [idempresa]
    );
    res.json(rows.map((r) => r.ano));
  } catch (error) {
    console.error("ERRO CEO /anos-disponiveis:", error);
    res.status(500).json({ error: "Erro ao listar anos disponíveis." });
  }
});

// GET /ceo/filtrar — dashboard: combina idcliente/idevento/ano/datainicio/datafim (todos opcionais).
router.get("/filtrar", async (req, res) => {
  try {
    const idempresa = req.idempresa;
    if (!idempresa) return res.status(400).json({ error: "idempresa obrigatório." });

    const { idcliente, idevento, ano, datainicio, datafim } = req.query;
    const { filtro, params } = buildFiltro(idempresa, {
      idcliente: idcliente ? parseInt(idcliente, 10) : null,
      idevento: idevento ? parseInt(idevento, 10) : null,
      ano: ano ? parseInt(ano, 10) : null,
      datainicio: datainicio || null,
      datafim: datafim || null,
    });

    const { rows } = await pool.query(
      queryAnalise(filtro, "ORDER BY custo_previsto DESC NULLS LAST"),
      params
    );
    res.json({ eventos: rows });
  } catch (error) {
    console.error("ERRO CEO /filtrar:", error);
    res.status(500).json({ error: "Erro ao filtrar eventos." });
  }
});

// ===== Visão Geral (todas as empresas) — remuneração de funcionários entre empresas =====
// Diferente do resto do arquivo (uma empresa por vez, via req.idempresa/contextoEmpresa):
// aqui o CEO precisa ver o panorama entre TODAS as empresas do grupo, então estes endpoints
// ignoram req.idempresa e recebem "idempresa" como filtro OPCIONAL na query string.

// GET /ceo/geral/empresas — todas as empresas cadastradas, p/ filtro "Todas" / uma específica.
router.get("/geral/empresas", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT idempresa, nmfantasia FROM empresas ORDER BY nmfantasia ASC`
    );
    res.json(rows);
  } catch (error) {
    console.error("ERRO CEO /geral/empresas:", error);
    res.status(500).json({ error: "Erro ao listar empresas." });
  }
});

// GET /ceo/geral/funcionarios?busca=&idempresa= — lista pesquisável de funcionários (qualquer
// perfil, qualquer empresa) para o seletor da Visão Geral.
router.get("/geral/funcionarios", async (req, res) => {
  try {
    const busca = (req.query.busca || "").trim();
    const idempresa = req.query.idempresa ? parseInt(req.query.idempresa, 10) : null;
    const params = [];
    let where = "1=1";
    if (busca) { params.push(`%${busca}%`); where += ` AND f.nome ILIKE $${params.length}`; }
    if (idempresa) { params.push(idempresa); where += ` AND fe.idempresa = $${params.length}`; }

    const { rows } = await pool.query(
      `SELECT f.idfuncionario, f.nome,
              array_agg(DISTINCT emp.nmfantasia ORDER BY emp.nmfantasia) AS empresas
       FROM funcionarios f
       JOIN funcionarioempresas fe ON fe.idfuncionario = f.idfuncionario
       JOIN empresas emp ON emp.idempresa = fe.idempresa
       WHERE ${where}
       GROUP BY f.idfuncionario, f.nome
       ORDER BY f.nome ASC
       LIMIT 50`,
      params
    );
    res.json(rows);
  } catch (error) {
    console.error("ERRO CEO /geral/funcionarios:", error);
    res.status(500).json({ error: "Erro ao listar funcionários." });
  }
});

// GET /ceo/geral/anos-disponiveis — anos com holerite OU staff cadastrado, p/ seletor de ano
// da Visão Geral (independe de empresa/funcionário — só pra popular o select).
router.get("/geral/anos-disponiveis", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ano FROM (
         SELECT DISTINCT ano FROM folhaholerite
         UNION
         SELECT DISTINCT EXTRACT(YEAR FROM o.dtinirealizacao)::int AS ano
         FROM staffeventos se JOIN orcamentos o ON o.idorcamento = se.idorcamento
         WHERE o.dtinirealizacao IS NOT NULL
       ) x
       WHERE ano IS NOT NULL
       ORDER BY ano DESC`
    );
    res.json(rows.map((r) => r.ano));
  } catch (error) {
    console.error("ERRO CEO /geral/anos-disponiveis:", error);
    res.status(500).json({ error: "Erro ao listar anos disponíveis." });
  }
});

// GET /ceo/geral/funcionario?idfuncionario=X&ano=YYYY&idempresa=(opcional)
// Consolida tudo que o funcionário já recebeu (Pago) ou vai receber (Pendente) no ano, por
// origem: Holerite (RH), Staff em eventos (cachê/ajuda de custo/caixinha) e Ajustes financeiros
// avulsos (créditos/débitos de staff, só quando pagos — mesma regra do detector de rentabilidade).
// Sem idempresa, soma todas as empresas onde o funcionário atua.
router.get("/geral/funcionario", async (req, res) => {
  try {
    const idfuncionario = parseInt(req.query.idfuncionario, 10);
    const ano = parseInt(req.query.ano, 10) || new Date().getFullYear();
    const idempresa = req.query.idempresa ? parseInt(req.query.idempresa, 10) : null;
    if (!idfuncionario) return res.status(400).json({ error: "idfuncionario obrigatório." });

    const mesFiltro = parseInt(req.query.mes, 10);
    const temMesFiltro = Number.isInteger(mesFiltro) && mesFiltro >= 1 && mesFiltro <= 12;
    const filtroMesHolerite = temMesFiltro ? `AND h.mes = ${mesFiltro}` : "";
    const filtroMesStaff = temMesFiltro ? `AND EXTRACT(MONTH FROM o.dtinirealizacao) = ${mesFiltro}` : "";
    const filtroMesAjuste = temMesFiltro ? `AND EXTRACT(MONTH FROM af.dtlancamento) = ${mesFiltro}` : "";

    const filtroEmpresaHolerite = idempresa ? "AND h.idempresa = $3" : "";
    const filtroEmpresaStaff = idempresa ? "AND oe.idempresa = $3" : "";
    const filtroEmpresaAjuste = idempresa ? "AND af.idempresa = $3" : "";
    const params = idempresa ? [idfuncionario, ano, idempresa] : [idfuncionario, ano];

    // conferido/conferido_beneficios seguem a mesma regra do Financeiro > Contas a Pagar
    // (Vencimentos): enquanto o RH não confere a competência, ela só existe como previsão —
    // mesmo já tendo linha gravada em folhaholerite com status 'Pendente'. Salário e Benefícios
    // (VA/VT) conferem e pagam em momentos diferentes, por isso a origem é calculada em separado
    // pra cada um (rotaMain.js/rotaRH.js já fazem o mesmo em Vencimentos).
    const holeritesRaw = await pool.query(
      `SELECT h.idholerite, h.idempresa, emp.nmfantasia AS nomeempresa, h.mes, h.ano, h.tipo,
              h.status, h.salariobase, h.dtpagamento, h.conferido,
              h.status_beneficios, h.dtpagamento_beneficios, h.conferido_beneficios,
              COALESCE(SUM(CASE WHEN i.tipo = 'P' THEN i.valor ELSE 0 END), 0) AS proventos,
              COALESCE(SUM(CASE WHEN i.tipo = 'B' THEN i.valor ELSE 0 END), 0) AS beneficios,
              COALESCE(SUM(CASE WHEN i.tipo = 'D' THEN i.valor ELSE 0 END), 0) AS descontos
       FROM folhaholerite h
       JOIN empresas emp ON emp.idempresa = h.idempresa
       LEFT JOIN folhaitens i ON i.idholerite = h.idholerite
       WHERE h.idfuncionario = $1 AND h.ano = $2 ${filtroEmpresaHolerite} ${filtroMesHolerite}
       GROUP BY h.idholerite, h.idempresa, emp.nmfantasia, h.mes, h.ano, h.tipo, h.status, h.salariobase,
                h.dtpagamento, h.conferido, h.status_beneficios, h.dtpagamento_beneficios, h.conferido_beneficios
       ORDER BY h.mes ASC`,
      params
    );
    const holerites = {
      rows: holeritesRaw.rows.map((h) => ({
        ...h,
        origem: h.conferido ? "real" : "previsao",
        origemBeneficios: h.conferido_beneficios ? "real" : "previsao",
      })),
    };

    const staff = await pool.query(
      `SELECT se.idstaffevento, se.idevento, se.nmevento, se.nmcliente, o.idorcamento,
              oe.idempresa, emp.nmfantasia AS nomeempresa, o.dtinirealizacao, o.dtfimrealizacao,
              COALESCE(se.vlrtotcache, 0)    AS vlrcache,
              COALESCE(se.vlrtotajdcusto, 0) AS vlrajdcusto,
              COALESCE(se.vlrcaixinha, 0)    AS vlrcaixinha,
              se.statuspgto, se.statuspgtoajdcto, se.statuspgtocaixinha, se.statusstaff
       FROM staffeventos se
       JOIN orcamentos o ON o.idorcamento = se.idorcamento
       JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
       JOIN empresas emp ON emp.idempresa = oe.idempresa
       WHERE se.idfuncionario = $1
         AND EXTRACT(YEAR FROM o.dtinirealizacao) = $2
         AND se.statusstaff <> 'Deletado'
         ${filtroEmpresaStaff} ${filtroMesStaff}
       ORDER BY o.dtinirealizacao ASC`,
      params
    );

    const ajustes = await pool.query(
      `SELECT af.idajustefinanceiro, af.tipo, af.valor, af.status, af.dtlancamento,
              af.idempresa, emp.nmfantasia AS nomeempresa, se.idevento, se.nmevento
       FROM staffajustefinanceiro af
       JOIN empresas emp ON emp.idempresa = af.idempresa
       LEFT JOIN staffeventos se ON se.idstaffevento = af.idstaffeventopago
       WHERE af.idfuncionario = $1
         AND EXTRACT(YEAR FROM af.dtlancamento) = $2
         AND af.status = 'Pago'
         ${filtroEmpresaAjuste} ${filtroMesAjuste}
       ORDER BY af.dtlancamento ASC`,
      params
    );

    res.json({ holerites: holerites.rows, staff: staff.rows, ajustes: ajustes.rows });
  } catch (error) {
    console.error("ERRO CEO /geral/funcionario:", error);
    res.status(500).json({ error: "Erro ao carregar dados do funcionário." });
  }
});

// GET /ceo/geral/panorama?ano=YYYY&idempresas=1,2,3 — visão agregada de TODOS os funcionários
// (não um só): quanto já está contratado por mês (pago x pendente) e a base pra "provisão de
// custo" do ano — alimenta o modo Gráfico da Visão Geral quando abre (sem precisar buscar um
// funcionário específico primeiro). idempresas filtra por uma ou mais empresas; sem ele, soma
// o grupo inteiro.
router.get("/geral/panorama", async (req, res) => {
  try {
    const ano = parseInt(req.query.ano, 10) || new Date().getFullYear();
    const idempresas = String(req.query.idempresas || "")
      .split(",")
      .map((n) => parseInt(n, 10))
      .filter((n) => Number.isInteger(n));
    const temFiltro = idempresas.length > 0;

    const mesFiltro = parseInt(req.query.mes, 10);
    const temMesFiltro = Number.isInteger(mesFiltro) && mesFiltro >= 1 && mesFiltro <= 12;
    const filtroMesHolerite = temMesFiltro ? `AND h.mes = ${mesFiltro}` : "";
    const filtroMesStaff = temMesFiltro ? `AND EXTRACT(MONTH FROM o.dtinirealizacao) = ${mesFiltro}` : "";
    const filtroMesAjuste = temMesFiltro ? `AND EXTRACT(MONTH FROM af.dtlancamento) = ${mesFiltro}` : "";

    const filtroHolerite = temFiltro ? "AND h.idempresa = ANY($2::int[])" : "";
    const filtroStaff = temFiltro ? "AND oe.idempresa = ANY($2::int[])" : "";
    const filtroAjuste = temFiltro ? "AND af.idempresa = ANY($2::int[])" : "";
    const params = temFiltro ? [ano, idempresas] : [ano];

    // Salário (P - D) e Benefícios (B) conferem/pagam em separado (mesmas colunas usadas em
    // Vencimentos): só entra como "pago" quando conferido E status correspondente = 'Pago';
    // caso contrário é previsão, mesmo já existindo a linha em folhaholerite.
    const holerite = await pool.query(
      `WITH itens AS (
         SELECT idholerite,
                COALESCE(SUM(CASE WHEN tipo = 'P' THEN valor ELSE 0 END), 0) AS proventos,
                COALESCE(SUM(CASE WHEN tipo = 'B' THEN valor ELSE 0 END), 0) AS beneficios,
                COALESCE(SUM(CASE WHEN tipo = 'D' THEN valor ELSE 0 END), 0) AS descontos
         FROM folhaitens
         GROUP BY idholerite
       )
       SELECT h.mes,
              COALESCE(SUM(
                (CASE WHEN h.conferido AND h.status = 'Pago' THEN COALESCE(it.proventos,0) - COALESCE(it.descontos,0) ELSE 0 END) +
                (CASE WHEN h.conferido_beneficios AND h.status_beneficios = 'Pago' THEN COALESCE(it.beneficios,0) ELSE 0 END)
              ), 0) AS pago,
              COALESCE(SUM(
                (CASE WHEN NOT (h.conferido AND h.status = 'Pago') THEN COALESCE(it.proventos,0) - COALESCE(it.descontos,0) ELSE 0 END) +
                (CASE WHEN NOT (h.conferido_beneficios AND h.status_beneficios = 'Pago') THEN COALESCE(it.beneficios,0) ELSE 0 END)
              ), 0) AS pendente
       FROM folhaholerite h
       LEFT JOIN itens it ON it.idholerite = h.idholerite
       WHERE h.ano = $1 ${filtroHolerite} ${filtroMesHolerite}
       GROUP BY h.mes`,
      params
    );

    const staff = await pool.query(
      `SELECT EXTRACT(MONTH FROM o.dtinirealizacao)::int AS mes,
              COALESCE(SUM(
                (CASE WHEN se.statuspgto = 'Pago' THEN COALESCE(se.vlrtotcache, 0) ELSE 0 END) +
                (CASE WHEN se.statuspgtoajdcto = 'Pago' THEN COALESCE(se.vlrtotajdcusto, 0) ELSE 0 END) +
                (CASE WHEN se.statuspgtocaixinha = 'Pago' THEN COALESCE(se.vlrcaixinha, 0) ELSE 0 END)
              ), 0) AS pago,
              COALESCE(SUM(
                (CASE WHEN se.statuspgto <> 'Pago' THEN COALESCE(se.vlrtotcache, 0) ELSE 0 END) +
                (CASE WHEN se.statuspgtoajdcto <> 'Pago' THEN COALESCE(se.vlrtotajdcusto, 0) ELSE 0 END) +
                (CASE WHEN se.statuspgtocaixinha <> 'Pago' THEN COALESCE(se.vlrcaixinha, 0) ELSE 0 END)
              ), 0) AS pendente
       FROM staffeventos se
       JOIN orcamentos o ON o.idorcamento = se.idorcamento
       JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
       WHERE EXTRACT(YEAR FROM o.dtinirealizacao) = $1
         AND se.statusstaff <> 'Deletado'
         AND o.dtinirealizacao IS NOT NULL
         ${filtroStaff} ${filtroMesStaff}
       GROUP BY EXTRACT(MONTH FROM o.dtinirealizacao)`,
      params
    );

    // Ajustes financeiros só entram quando 'Pago' (mesma regra do detector de rentabilidade e do
    // /geral/funcionario) — não há "pendente" comparável aqui.
    const ajustes = await pool.query(
      `SELECT EXTRACT(MONTH FROM af.dtlancamento)::int AS mes,
              COALESCE(SUM(CASE WHEN af.tipo = 'Credito' THEN af.valor ELSE -af.valor END), 0) AS pago
       FROM staffajustefinanceiro af
       WHERE EXTRACT(YEAR FROM af.dtlancamento) = $1 AND af.status = 'Pago' ${filtroAjuste} ${filtroMesAjuste}
       GROUP BY EXTRACT(MONTH FROM af.dtlancamento)`,
      params
    );

    res.json({ ano, holerite: holerite.rows, staff: staff.rows, ajustes: ajustes.rows });
  } catch (error) {
    console.error("ERRO CEO /geral/panorama:", error);
    res.status(500).json({ error: "Erro ao carregar panorama geral." });
  }
});

// GET /ceo/geral/funcionarios-resumo?ano=YYYY&idempresas=1,2,3 — mesma agregação de
// /geral/panorama (holerite + staff em eventos + ajustes pagos), só que por FUNCIONÁRIO em vez
// de por mês — alimenta a "Lista" da Visão Geral quando nenhum funcionário específico foi
// buscado ainda, pro modo Lista deixar de exigir seleção antes de mostrar algo (mesma paridade
// que o modo Gráfico já tem: mostra o grupo inteiro por padrão, e um funcionário só quando
// buscado). Um funcionário só aparece aqui se tiver QUALQUER atividade no ano (holerite, staff
// ou ajuste pago) — não é a lista de cadastro inteira, é só quem tem valor a mostrar.
router.get("/geral/funcionarios-resumo", async (req, res) => {
  try {
    const ano = parseInt(req.query.ano, 10) || new Date().getFullYear();
    const idempresas = String(req.query.idempresas || "")
      .split(",")
      .map((n) => parseInt(n, 10))
      .filter((n) => Number.isInteger(n));
    const temFiltro = idempresas.length > 0;

    const mesFiltro = parseInt(req.query.mes, 10);
    const temMesFiltro = Number.isInteger(mesFiltro) && mesFiltro >= 1 && mesFiltro <= 12;
    const filtroMesHolerite = temMesFiltro ? `AND h.mes = ${mesFiltro}` : "";
    const filtroMesStaff = temMesFiltro ? `AND EXTRACT(MONTH FROM o.dtinirealizacao) = ${mesFiltro}` : "";
    const filtroMesAjuste = temMesFiltro ? `AND EXTRACT(MONTH FROM af.dtlancamento) = ${mesFiltro}` : "";

    const filtroHolerite = temFiltro ? "AND h.idempresa = ANY($2::int[])" : "";
    const filtroStaff = temFiltro ? "AND oe.idempresa = ANY($2::int[])" : "";
    const filtroAjuste = temFiltro ? "AND af.idempresa = ANY($2::int[])" : "";
    const params = temFiltro ? [ano, idempresas] : [ano];

    const { rows } = await pool.query(
      `WITH itens AS (
         SELECT idholerite,
                COALESCE(SUM(CASE WHEN tipo = 'P' THEN valor ELSE 0 END), 0) AS proventos,
                COALESCE(SUM(CASE WHEN tipo = 'B' THEN valor ELSE 0 END), 0) AS beneficios,
                COALESCE(SUM(CASE WHEN tipo = 'D' THEN valor ELSE 0 END), 0) AS descontos
         FROM folhaitens
         GROUP BY idholerite
       ),
       holerite_func AS (
         SELECT h.idfuncionario,
                COALESCE(SUM(
                  (CASE WHEN h.conferido AND h.status = 'Pago' THEN COALESCE(it.proventos,0) - COALESCE(it.descontos,0) ELSE 0 END) +
                  (CASE WHEN h.conferido_beneficios AND h.status_beneficios = 'Pago' THEN COALESCE(it.beneficios,0) ELSE 0 END)
                ), 0) AS pago,
                COALESCE(SUM(
                  (CASE WHEN NOT (h.conferido AND h.status = 'Pago') THEN COALESCE(it.proventos,0) - COALESCE(it.descontos,0) ELSE 0 END) +
                  (CASE WHEN NOT (h.conferido_beneficios AND h.status_beneficios = 'Pago') THEN COALESCE(it.beneficios,0) ELSE 0 END)
                ), 0) AS pendente
         FROM folhaholerite h
         LEFT JOIN itens it ON it.idholerite = h.idholerite
         WHERE h.ano = $1 ${filtroHolerite} ${filtroMesHolerite}
         GROUP BY h.idfuncionario
       ),
       staff_func AS (
         SELECT se.idfuncionario,
                COALESCE(SUM(
                  (CASE WHEN se.statuspgto = 'Pago' THEN COALESCE(se.vlrtotcache, 0) ELSE 0 END) +
                  (CASE WHEN se.statuspgtoajdcto = 'Pago' THEN COALESCE(se.vlrtotajdcusto, 0) ELSE 0 END) +
                  (CASE WHEN se.statuspgtocaixinha = 'Pago' THEN COALESCE(se.vlrcaixinha, 0) ELSE 0 END)
                ), 0) AS pago,
                COALESCE(SUM(
                  (CASE WHEN se.statuspgto <> 'Pago' THEN COALESCE(se.vlrtotcache, 0) ELSE 0 END) +
                  (CASE WHEN se.statuspgtoajdcto <> 'Pago' THEN COALESCE(se.vlrtotajdcusto, 0) ELSE 0 END) +
                  (CASE WHEN se.statuspgtocaixinha <> 'Pago' THEN COALESCE(se.vlrcaixinha, 0) ELSE 0 END)
                ), 0) AS pendente
         FROM staffeventos se
         JOIN orcamentos o ON o.idorcamento = se.idorcamento
         JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
         WHERE EXTRACT(YEAR FROM o.dtinirealizacao) = $1
           AND se.statusstaff <> 'Deletado' AND o.dtinirealizacao IS NOT NULL
           ${filtroStaff} ${filtroMesStaff}
         GROUP BY se.idfuncionario
       ),
       ajuste_func AS (
         SELECT af.idfuncionario,
                COALESCE(SUM(CASE WHEN af.tipo = 'Credito' THEN af.valor ELSE -af.valor END), 0) AS pago
         FROM staffajustefinanceiro af
         WHERE EXTRACT(YEAR FROM af.dtlancamento) = $1 AND af.status = 'Pago' ${filtroAjuste} ${filtroMesAjuste}
         GROUP BY af.idfuncionario
       ),
       todos AS (
         SELECT idfuncionario FROM holerite_func
         UNION SELECT idfuncionario FROM staff_func
         UNION SELECT idfuncionario FROM ajuste_func
       )
       SELECT f.idfuncionario, f.nome,
              COALESCE(hf.pago,0) + COALESCE(sf.pago,0) + COALESCE(aj.pago,0) AS pago,
              COALESCE(hf.pendente,0) + COALESCE(sf.pendente,0) AS pendente
       FROM todos
       JOIN funcionarios f ON f.idfuncionario = todos.idfuncionario
       LEFT JOIN holerite_func hf ON hf.idfuncionario = todos.idfuncionario
       LEFT JOIN staff_func sf ON sf.idfuncionario = todos.idfuncionario
       LEFT JOIN ajuste_func aj ON aj.idfuncionario = todos.idfuncionario
       ORDER BY f.nome ASC`,
      params
    );

    res.json({ ano, funcionarios: rows });
  } catch (error) {
    console.error("ERRO CEO /geral/funcionarios-resumo:", error);
    res.status(500).json({ error: "Erro ao carregar resumo de funcionários." });
  }
});

// GET /ceo/geral/receber?agrupamento=mensal|anual|empresa&ano=YYYY&idempresas=1,2
// Contas a receber = valor total do cliente por orçamento (vlrcliente), partido em 5 categorias
// (sempre mutuamente exclusivas, cobrindo o vlrcliente inteiro de cada orçamento não Rejeitado):
//   - recebido            : notasfiscais Emitida + recebido=true.
//   - a_receber           : Emitida + recebido=false, dentro do prazo (ou sem parcela vinculada,
//                           caso em que não dá pra provar atraso).
//   - recebimento_atrasado: Emitida + recebido=false, com orcamentoparcelas.dtvencimento vencido.
//   - a_faturar           : só orçamentos Fechados (status='F') — o que falta faturar (vlrcliente
//                           menos o que já foi Emitida, cobre fechamento parcial também).
//   - em_negociacao       : orçamentos ainda não fechados nem rejeitados (status IN 'A'/'P'/'E' —
//                           Aberto/Proposta/Em Fechamento) — valor inteiro, ainda não há o que faturar.
// Também traz lucro (lucroreal) e despesa (custo orçado: totgeralcto + totajdcto) agregados.
router.get("/geral/receber", async (req, res) => {
  try {
    const agrupamento = ["mensal", "anual", "empresa", "evento"].includes(req.query.agrupamento) ? req.query.agrupamento : "mensal";
    const ano = parseInt(req.query.ano, 10) || new Date().getFullYear();
    const idempresas = String(req.query.idempresas || "")
      .split(",")
      .map((n) => parseInt(n, 10))
      .filter((n) => Number.isInteger(n));
    const temFiltroEmpresa = idempresas.length > 0;

    const mes = parseInt(req.query.mes, 10); // opcional — 1-12, filtra pra um mês específico em QUALQUER agrupamento
    const filtros = ["o.status <> 'R'", "o.idevento IS NOT NULL", "o.dtinirealizacao IS NOT NULL"];
    const params = [];
    if (temFiltroEmpresa) { params.push(idempresas); filtros.push(`ee.idempresa = ANY($${params.length}::int[])`); }
    // "anual" mostra todos os anos disponíveis (não filtra); mensal/empresa são sempre de um ano.
    if (agrupamento !== "anual") { params.push(ano); filtros.push(`EXTRACT(YEAR FROM o.dtinirealizacao) = $${params.length}`); }
    if (Number.isInteger(mes) && mes >= 1 && mes <= 12) { params.push(mes); filtros.push(`EXTRACT(MONTH FROM o.dtinirealizacao) = $${params.length}`); }

    let selectChave, groupBy, extraJoin = "", extraSelect = "", orderBy = "chave";
    if (agrupamento === "anual") {
      selectChave = "EXTRACT(YEAR FROM o.dtinirealizacao)::int";
      groupBy = selectChave;
    } else if (agrupamento === "empresa") {
      selectChave = "ee.idempresa";
      groupBy = "ee.idempresa, emp.nmfantasia";
      extraJoin = "JOIN empresas emp ON emp.idempresa = ee.idempresa";
      extraSelect = ", emp.nmfantasia";
    } else if (agrupamento === "evento") {
      // Detalhe por evento (não por período) — pra achar onde está a maior despesa e o
      // maior/menor lucro dentro do recorte de ano/mês/empresas já filtrado.
      selectChave = "o.idevento";
      groupBy = "o.idevento, e.nmevento, c.nmfantasia";
      extraJoin = "JOIN eventos e ON e.idevento = o.idevento LEFT JOIN clientes c ON c.idcliente = o.idcliente";
      extraSelect = ", e.nmevento, c.nmfantasia AS nomecliente, MIN(o.dtinirealizacao) AS dtinirealizacao";
      orderBy = "dtinirealizacao ASC";
    } else {
      selectChave = "EXTRACT(MONTH FROM o.dtinirealizacao)::int";
      groupBy = selectChave;
    }

    // porEmpresa=1 (só válido com mensal/anual) quebra cada período também por empresa — usado
    // pelos gráficos pra empilhar visualmente "o que é de cada empresa" dentro da mesma barra.
    if (req.query.porEmpresa === "1" && (agrupamento === "mensal" || agrupamento === "anual")) {
      extraJoin = "JOIN empresas emp ON emp.idempresa = ee.idempresa";
      extraSelect = ", ee.idempresa, emp.nmfantasia";
      groupBy += ", ee.idempresa, emp.nmfantasia";
      orderBy = "chave, emp.nmfantasia";
    }

    const { rows } = await pool.query(
      `WITH empresa_efetiva AS (
         -- A quem esse orçamento pertence de fato: idempresaemissora quando preenchido (ex.:
         -- orçamento processado no ambiente JA-OPER mas emitido/faturado por outra empresa —
         -- ver "empréstimo entre ambientes"), senão a empresa vinculada normalmente
         -- (orcamentoempresas). MIN() é só uma trava determinística pro caso raro de mais de um
         -- vínculo — na prática cada orçamento tem só um.
         SELECT o.idorcamento, COALESCE(o.idempresaemissora, MIN(oe.idempresa)) AS idempresa
         FROM orcamentos o
         LEFT JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
         GROUP BY o.idorcamento, o.idempresaemissora
       ),
       notas_por_orcamento AS (
         -- Recebido/A receber/Atrasado usam o valor LÍQUIDO (valorservico menos ISS/IRRF/
         -- PIS-COFINS-CSLL retidos na fonte) — é o que realmente cai na conta, não o valor bruto
         -- do serviço. "a_faturar" continua em cima do bruto (comparado com vlrcliente, que
         -- também é bruto — mesma base dos dois lados).
         SELECT
           nf.idorcamento,
           SUM(CASE WHEN nf.status = 'Emitida' AND nf.recebido = true
             THEN nf.valorservico - COALESCE(nf.valoriss,0) - COALESCE(nf.valorirrf,0) - COALESCE(nf.valorpiscofinscsll,0)
             ELSE 0 END) AS recebido,
           SUM(CASE WHEN nf.status = 'Emitida' AND nf.recebido = false
                     AND (op.dtvencimento IS NULL OR op.dtvencimento >= CURRENT_DATE)
             THEN nf.valorservico - COALESCE(nf.valoriss,0) - COALESCE(nf.valorirrf,0) - COALESCE(nf.valorpiscofinscsll,0)
             ELSE 0 END) AS a_receber,
           SUM(CASE WHEN nf.status = 'Emitida' AND nf.recebido = false AND op.dtvencimento < CURRENT_DATE
             THEN nf.valorservico - COALESCE(nf.valoriss,0) - COALESCE(nf.valorirrf,0) - COALESCE(nf.valorpiscofinscsll,0)
             ELSE 0 END) AS recebimento_atrasado,
           SUM(CASE WHEN nf.status = 'Emitida' THEN nf.valorservico ELSE 0 END) AS total_faturado
         FROM notasfiscais nf
         LEFT JOIN orcamentoparcelas op ON op.idparcela = nf.idparcela
         GROUP BY nf.idorcamento
       )
       SELECT ${selectChave} AS chave ${extraSelect},
              SUM(COALESCE(np.recebido, 0)) AS recebido,
              SUM(COALESCE(np.a_receber, 0)) AS a_receber,
              SUM(COALESCE(np.recebimento_atrasado, 0)) AS recebimento_atrasado,
              SUM(CASE WHEN o.status = 'F'
                THEN GREATEST(COALESCE(o.vlrcliente, 0) - COALESCE(np.total_faturado, 0), 0)
                ELSE 0 END) AS a_faturar,
              SUM(CASE WHEN o.status IN ('A', 'P', 'E') THEN COALESCE(o.vlrcliente, 0) ELSE 0 END) AS em_negociacao,
              SUM(COALESCE(o.lucroreal, 0)) AS lucro,
              SUM(COALESCE(o.totgeralcto, 0) + COALESCE(o.totajdcto, 0)) AS despesa,
              SUM(CASE WHEN o.dtfimrealizacao < CURRENT_DATE
                THEN COALESCE(o.totgeralcto, 0) + COALESCE(o.totajdcto, 0) ELSE 0 END) AS despesapaga,
              SUM(CASE WHEN o.dtfimrealizacao >= CURRENT_DATE OR o.dtfimrealizacao IS NULL
                THEN COALESCE(o.totgeralcto, 0) + COALESCE(o.totajdcto, 0) ELSE 0 END) AS despesapendente
       FROM orcamentos o
       JOIN empresa_efetiva ee ON ee.idorcamento = o.idorcamento
       LEFT JOIN notas_por_orcamento np ON np.idorcamento = o.idorcamento
       ${extraJoin}
       WHERE ${filtros.join(" AND ")}
       GROUP BY ${groupBy}
       ORDER BY ${orderBy}`,
      params
    );

    res.json({ agrupamento, ano, linhas: rows });
  } catch (error) {
    console.error("ERRO CEO /geral/receber:", error);
    res.status(500).json({ error: "Erro ao carregar contas a receber." });
  }
});

// Expande as ocorrências de UM lançamento (FIXO/PARCELADO/único) dentro de um ano — mesma lógica
// de expandirOcorrenciasNoAno (public/js/Main.js), portada pro servidor porque aqui precisamos
// agregar em massa (todas as empresas do grupo de uma vez), não uma tela por vez. Necessário
// porque parcelas futuras de lançamento recorrente NÃO são pré-geradas em `pagamentos` (isso só
// acontece quando alguém confirma o pagamento) — sem essa expansão, meses futuros de um aluguel
// mensal, por exemplo, sumiriam do "pendente".
function expandirOcorrenciasLancamentoAno(l, ano) {
  const vctoBase = new Date(l.vctobase);
  if (isNaN(vctoBase.getTime())) return [];
  const ehFixo = l.tiporepeticao === "FIXO" || l.indeterminado === true;
  const ehParcelado = l.tiporepeticao === "PARCELADO";
  const maxLoop = ehParcelado ? (parseInt(l.qtdeparcelas, 10) || 1) : (ehFixo ? 12 : 1);
  const dttermino = l.dttermino ? new Date(l.dttermino) : null;
  const dia = vctoBase.getDate();
  const ocorrencias = [];
  for (let i = 0; i < maxLoop; i++) {
    let dProj;
    if (ehFixo) {
      dProj = new Date(ano, i, dia);
      if (dProj < vctoBase) continue;
      if (dttermino && dProj > dttermino) continue;
    } else {
      dProj = new Date(vctoBase.getFullYear(), vctoBase.getMonth() + i, dia);
    }
    if (dProj.getFullYear() !== ano) continue;
    ocorrencias.push(dProj);
  }
  return ocorrencias;
}

// GET /ceo/geral/pagar?agrupamento=mensal|anual|empresa&ano=YYYY&idempresas=1,2&mes=X&porEmpresa=1
// Despesa REAL do grupo (substitui o custo orçado do evento que "Contas a Pagar" usava antes) —
// combina duas fontes bem diferentes:
//  1) Fornecedores/Outros: lancamentos + pagamentos, expandindo FIXO/PARCELADO em JS (ver
//     expandirOcorrenciasLancamentoAno acima) — parcelas ainda sem pagamento gravado usam
//     vlrestimado como pendente. Lançamentos de funcionário Interno/ExternoH ficam de fora daqui
//     (já entram pela folha, item 2) — Freelancer/Externo sem holerite continuam contando aqui,
//     mesma reclassificação que GET /contas-pagar já faz por empresa.
//  2) Funcionários: folhaholerite + staffeventos + staffajustefinanceiro, mesma regra de
//     /geral/panorama e /geral/funcionarios-resumo (conferido+status='Pago' = pago; resto =
//     pendente; ajuste só conta quando 'Pago').
// "Suspenso" fica fora dos dois buckets (não é dívida ativa agora).
router.get("/geral/pagar", async (req, res) => {
  try {
    const agrupamento = ["mensal", "anual", "empresa"].includes(req.query.agrupamento) ? req.query.agrupamento : "mensal";
    const ano = parseInt(req.query.ano, 10) || new Date().getFullYear();
    const idempresas = String(req.query.idempresas || "")
      .split(",").map((n) => parseInt(n, 10)).filter((n) => Number.isInteger(n));
    const temFiltro = idempresas.length > 0;
    const mesFiltro = parseInt(req.query.mes, 10);
    const temMesFiltro = Number.isInteger(mesFiltro) && mesFiltro >= 1 && mesFiltro <= 12;
    const porEmpresa = req.query.porEmpresa === "1";

    const { PERFIS_FOLHA } = require("./rotaRH").helpersFolha;

    // matriz[idempresa] = array de 12 posições { pago, pendente } (mes 1 no índice 0).
    const matriz = new Map();
    const bucketDe = (idempresa, mes) => {
      if (!matriz.has(idempresa)) matriz.set(idempresa, Array.from({ length: 12 }, () => ({ pago: 0, pendente: 0 })));
      return matriz.get(idempresa)[mes - 1];
    };

    // ===== 1) Fornecedores/Outros =====
    const paramsLancs = [PERFIS_FOLHA];
    let filtroLancEmpresa = "";
    if (temFiltro) { paramsLancs.push(idempresas); filtroLancEmpresa = `AND l.idempresa = ANY($${paramsLancs.length}::int[])`; }

    const lancs = (await pool.query(
      `SELECT l.idlancamento, l.idempresa, l.tiporepeticao, l.qtdeparcelas, l.indeterminado, l.dttermino, l.vctobase, l.vlrestimado
         FROM lancamentos l
         LEFT JOIN funcionarioempresas fe
           ON lower(trim(l.tipovinculo)) = 'funcionario' AND fe.idfuncionario = l.idvinculo AND fe.idempresa = l.idempresa
        WHERE l.ativo = true
          AND NOT (lower(trim(l.tipovinculo)) = 'funcionario' AND COALESCE(fe.perfil, '') = ANY($1))
          ${filtroLancEmpresa}`,
      paramsLancs
    )).rows;

    const idsLancs = lancs.map((l) => l.idlancamento);
    const pagamentosPorLanc = new Map(); // "idlancamento-mes" -> row de pagamentos
    if (idsLancs.length) {
      const pags = (await pool.query(
        `SELECT idlancamento, dtvcto, status, vlrreal, vlrprevisto
           FROM pagamentos
          WHERE idlancamento = ANY($1::int[]) AND EXTRACT(YEAR FROM dtvcto) = $2`,
        [idsLancs, ano]
      )).rows;
      pags.forEach((p) => {
        const d = new Date(p.dtvcto);
        pagamentosPorLanc.set(`${p.idlancamento}-${d.getMonth() + 1}`, p);
      });
    }

    lancs.forEach((l) => {
      expandirOcorrenciasLancamentoAno(l, ano).forEach((dProj) => {
        const mes = dProj.getMonth() + 1;
        if (temMesFiltro && mes !== mesFiltro) return;
        const real = pagamentosPorLanc.get(`${l.idlancamento}-${mes}`);
        const status = (real?.status || "").toLowerCase();
        if (status === "suspenso") return;
        const valor = real
          ? (Number(real.vlrreal) || Number(real.vlrprevisto) || Number(l.vlrestimado) || 0)
          : (Number(l.vlrestimado) || 0);
        const b = bucketDe(l.idempresa, mes);
        if (status === "pago") b.pago += valor; else b.pendente += valor;
      });
    });

    // ===== 2) Funcionários (folha + staff + ajustes) — mesma regra de /geral/panorama =====
    const filtroHolerite = temFiltro ? "AND h.idempresa = ANY($2::int[])" : "";
    const filtroStaff = temFiltro ? "AND oe.idempresa = ANY($2::int[])" : "";
    const filtroAjuste = temFiltro ? "AND af.idempresa = ANY($2::int[])" : "";
    const paramsFunc = temFiltro ? [ano, idempresas] : [ano];
    const filtroMesHolerite = temMesFiltro ? `AND h.mes = ${mesFiltro}` : "";
    const filtroMesStaff = temMesFiltro ? `AND EXTRACT(MONTH FROM o.dtinirealizacao) = ${mesFiltro}` : "";
    const filtroMesAjuste = temMesFiltro ? `AND EXTRACT(MONTH FROM af.dtlancamento) = ${mesFiltro}` : "";

    const holerite = await pool.query(
      `WITH itens AS (
         SELECT idholerite,
                COALESCE(SUM(CASE WHEN tipo = 'P' THEN valor ELSE 0 END), 0) AS proventos,
                COALESCE(SUM(CASE WHEN tipo = 'B' THEN valor ELSE 0 END), 0) AS beneficios,
                COALESCE(SUM(CASE WHEN tipo = 'D' THEN valor ELSE 0 END), 0) AS descontos
         FROM folhaitens GROUP BY idholerite
       )
       SELECT h.idempresa, h.mes,
              COALESCE(SUM(CASE WHEN h.conferido AND h.status = 'Pago' THEN COALESCE(it.proventos,0) - COALESCE(it.descontos,0) ELSE 0 END), 0)
                + COALESCE(SUM(CASE WHEN h.conferido_beneficios AND h.status_beneficios = 'Pago' THEN COALESCE(it.beneficios,0) ELSE 0 END), 0) AS pago,
              COALESCE(SUM(CASE WHEN NOT (h.conferido AND h.status = 'Pago') THEN COALESCE(it.proventos,0) - COALESCE(it.descontos,0) ELSE 0 END), 0)
                + COALESCE(SUM(CASE WHEN NOT (h.conferido_beneficios AND h.status_beneficios = 'Pago') THEN COALESCE(it.beneficios,0) ELSE 0 END), 0) AS pendente
       FROM folhaholerite h
       LEFT JOIN itens it ON it.idholerite = h.idholerite
       WHERE h.ano = $1 ${filtroHolerite} ${filtroMesHolerite}
       GROUP BY h.idempresa, h.mes`,
      paramsFunc
    );
    holerite.rows.forEach((r) => {
      const b = bucketDe(r.idempresa, r.mes);
      b.pago += Number(r.pago) || 0;
      b.pendente += Number(r.pendente) || 0;
    });

    const staff = await pool.query(
      `SELECT oe.idempresa, EXTRACT(MONTH FROM o.dtinirealizacao)::int AS mes,
              COALESCE(SUM(
                (CASE WHEN se.statuspgto = 'Pago' THEN COALESCE(se.vlrtotcache, 0) ELSE 0 END) +
                (CASE WHEN se.statuspgtoajdcto = 'Pago' THEN COALESCE(se.vlrtotajdcusto, 0) ELSE 0 END) +
                (CASE WHEN se.statuspgtocaixinha = 'Pago' THEN COALESCE(se.vlrcaixinha, 0) ELSE 0 END)
              ), 0) AS pago,
              COALESCE(SUM(
                (CASE WHEN se.statuspgto <> 'Pago' THEN COALESCE(se.vlrtotcache, 0) ELSE 0 END) +
                (CASE WHEN se.statuspgtoajdcto <> 'Pago' THEN COALESCE(se.vlrtotajdcusto, 0) ELSE 0 END) +
                (CASE WHEN se.statuspgtocaixinha <> 'Pago' THEN COALESCE(se.vlrcaixinha, 0) ELSE 0 END)
              ), 0) AS pendente
       FROM staffeventos se
       JOIN orcamentos o ON o.idorcamento = se.idorcamento
       JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
       WHERE EXTRACT(YEAR FROM o.dtinirealizacao) = $1
         AND se.statusstaff <> 'Deletado' AND o.dtinirealizacao IS NOT NULL
         ${filtroStaff} ${filtroMesStaff}
       GROUP BY oe.idempresa, EXTRACT(MONTH FROM o.dtinirealizacao)`,
      paramsFunc
    );
    staff.rows.forEach((r) => {
      const b = bucketDe(r.idempresa, r.mes);
      b.pago += Number(r.pago) || 0;
      b.pendente += Number(r.pendente) || 0;
    });

    const ajustes = await pool.query(
      `SELECT af.idempresa, EXTRACT(MONTH FROM af.dtlancamento)::int AS mes,
              COALESCE(SUM(CASE WHEN af.tipo = 'Credito' THEN af.valor ELSE -af.valor END), 0) AS pago
       FROM staffajustefinanceiro af
       WHERE EXTRACT(YEAR FROM af.dtlancamento) = $1 AND af.status = 'Pago' ${filtroAjuste} ${filtroMesAjuste}
       GROUP BY af.idempresa, EXTRACT(MONTH FROM af.dtlancamento)`,
      paramsFunc
    );
    ajustes.rows.forEach((r) => {
      bucketDe(r.idempresa, r.mes).pago += Number(r.pago) || 0; // sem "pendente" comparável
    });

    // ===== 3) Staff ainda não (ou só parcialmente) cadastrado, de evento recém-concluído =====
    // Cachê pode ser lançado em staffeventos até 2 dias depois do fim do evento (desmontagem ou
    // desmontagem-infra, o que for mais tarde) — dentro dessa janela, "sem staff cadastrado
    // ainda" é normal, não falta de fato. Só depois de 2 dias o evento é considerado encerrado
    // de verdade; o que faltar cadastrar até lá vira previsão pelo valor ORÇADO (orcamentoitens,
    // custo de staff), descontado do que já foi cadastrado (comparação por orçamento inteiro, não
    // por função individual). Conta no mês de INÍCIO da realização (dtinirealizacao), mesma
    // referência que o resto do painel já usa — não no mês da desmontagem, que pode cair no mês
    // seguinte.
    const filtroProvisaoEmpresa = temFiltro ? "AND ee.idempresa = ANY($2::int[])" : "";
    const filtroProvisaoMes = temMesFiltro ? `AND EXTRACT(MONTH FROM o.dtinirealizacao) = ${mesFiltro}` : "";
    const provisaoStaff = await pool.query(
      `WITH empresa_efetiva AS (
         SELECT o.idorcamento, COALESCE(o.idempresaemissora, MIN(oe.idempresa)) AS idempresa
         FROM orcamentos o
         LEFT JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
         GROUP BY o.idorcamento, o.idempresaemissora
       ),
       staff_orcado AS (
         SELECT idorcamento, SUM(COALESCE(totgeralitem, 0)) AS orcado
         FROM orcamentoitens WHERE idfuncao IS NOT NULL GROUP BY idorcamento
       ),
       staff_cadastrado AS (
         SELECT idorcamento, SUM(COALESCE(vlrtotcache, 0) + COALESCE(vlrtotajdcusto, 0)) AS cadastrado
         FROM staffeventos WHERE statusstaff <> 'Deletado' GROUP BY idorcamento
       )
       SELECT ee.idempresa, EXTRACT(MONTH FROM o.dtinirealizacao)::int AS mes,
              GREATEST(COALESCE(so.orcado, 0) - COALESCE(sc.cadastrado, 0), 0) AS faltante
       FROM orcamentos o
       JOIN empresa_efetiva ee ON ee.idorcamento = o.idorcamento
       LEFT JOIN staff_orcado so ON so.idorcamento = o.idorcamento
       LEFT JOIN staff_cadastrado sc ON sc.idorcamento = o.idorcamento
       WHERE o.status <> 'R'
         AND EXTRACT(YEAR FROM o.dtinirealizacao) = $1
         AND GREATEST(COALESCE(o.dtfimdesmontagem, '1900-01-01'), COALESCE(o.dtfiminfradesmontagem, '1900-01-01'))
             BETWEEN CURRENT_DATE - INTERVAL '2 days' AND CURRENT_DATE
         ${filtroProvisaoEmpresa} ${filtroProvisaoMes}`,
      temFiltro ? [ano, idempresas] : [ano]
    );
    provisaoStaff.rows.forEach((r) => {
      const faltante = Number(r.faltante) || 0;
      if (faltante > 0) bucketDe(r.idempresa, r.mes).pendente += faltante;
    });

    // ===== Reduz a matriz conforme o agrupamento pedido =====
    let linhas = [];
    if (agrupamento === "empresa") {
      const empresasInfo = (await pool.query(`SELECT idempresa, nmfantasia FROM empresas`)).rows;
      const nomePorId = new Map(empresasInfo.map((e) => [e.idempresa, e.nmfantasia]));
      linhas = Array.from(matriz.entries()).map(([idempresa, meses]) => ({
        chave: idempresa, idempresa, nmfantasia: nomePorId.get(idempresa) || "",
        despesapaga: meses.reduce((s, m) => s + m.pago, 0),
        despesapendente: meses.reduce((s, m) => s + m.pendente, 0),
      }));
    } else if (agrupamento === "anual") {
      let pago = 0, pendente = 0;
      matriz.forEach((meses) => meses.forEach((m) => { pago += m.pago; pendente += m.pendente; }));
      linhas = [{ chave: ano, despesapaga: pago, despesapendente: pendente }];
    } else if (porEmpresa) {
      const empresasInfo = (await pool.query(`SELECT idempresa, nmfantasia FROM empresas`)).rows;
      const nomePorId = new Map(empresasInfo.map((e) => [e.idempresa, e.nmfantasia]));
      matriz.forEach((meses, idempresa) => {
        meses.forEach((m, idx) => {
          if (m.pago === 0 && m.pendente === 0) return;
          linhas.push({ chave: idx + 1, idempresa, nmfantasia: nomePorId.get(idempresa) || "", despesapaga: m.pago, despesapendente: m.pendente });
        });
      });
    } else {
      const totalPorMes = Array.from({ length: 12 }, () => ({ pago: 0, pendente: 0 }));
      matriz.forEach((meses) => meses.forEach((m, idx) => { totalPorMes[idx].pago += m.pago; totalPorMes[idx].pendente += m.pendente; }));
      linhas = totalPorMes.map((m, idx) => ({ chave: idx + 1, despesapaga: m.pago, despesapendente: m.pendente }));
    }

    res.json({ agrupamento, ano, linhas });
  } catch (error) {
    console.error("ERRO CEO /geral/pagar:", error);
    res.status(500).json({ error: "Erro ao carregar contas a pagar." });
  }
});

// GET /ceo/geral/previsao-recebimento?ano=YYYY&idempresas=1,2 — quanto está "a_receber" (líquido,
// ainda não recebido) e é ESPERADO pra cada mês, segundo orcamentoparcelas.dtvencimento — diferente
// do resto de /geral/receber, que agrupa pelo mês do EVENTO (dtinirealizacao); aqui o que importa é
// quando o dinheiro é esperado, não quando o evento acontece. Nota emitida sem parcela vinculada
// (dtvencimento nulo) não entra — não tem como prever o mês.
router.get("/geral/previsao-recebimento", async (req, res) => {
  try {
    const ano = parseInt(req.query.ano, 10) || new Date().getFullYear();
    const idempresas = String(req.query.idempresas || "")
      .split(",").map((n) => parseInt(n, 10)).filter((n) => Number.isInteger(n));
    const temFiltro = idempresas.length > 0;

    const params = [ano];
    let filtroEmpresa = "";
    if (temFiltro) { params.push(idempresas); filtroEmpresa = "AND ee.idempresa = ANY($2::int[])"; }

    const { rows } = await pool.query(
      `WITH empresa_efetiva AS (
         SELECT o.idorcamento, COALESCE(o.idempresaemissora, MIN(oe.idempresa)) AS idempresa
         FROM orcamentos o
         LEFT JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
         GROUP BY o.idorcamento, o.idempresaemissora
       )
       SELECT EXTRACT(MONTH FROM op.dtvencimento)::int AS mes,
              SUM(nf.valorservico - COALESCE(nf.valoriss,0) - COALESCE(nf.valorirrf,0) - COALESCE(nf.valorpiscofinscsll,0)) AS previsto
       FROM notasfiscais nf
       JOIN orcamentoparcelas op ON op.idparcela = nf.idparcela
       JOIN empresa_efetiva ee ON ee.idorcamento = nf.idorcamento
       WHERE nf.status = 'Emitida' AND nf.recebido = false
         AND EXTRACT(YEAR FROM op.dtvencimento) = $1
         ${filtroEmpresa}
       GROUP BY EXTRACT(MONTH FROM op.dtvencimento)
       ORDER BY mes`,
      params
    );
    res.json({ ano, linhas: rows });
  } catch (error) {
    console.error("ERRO CEO /geral/previsao-recebimento:", error);
    res.status(500).json({ error: "Erro ao carregar previsão de recebimento." });
  }
});

// GET /ceo/geral/eventos?busca= — lista pesquisável de eventos entre TODAS as empresas (pro
// comparativo de anos anteriores em Contas a receber). Mesmo padrão de /geral/funcionarios.
router.get("/geral/eventos", async (req, res) => {
  try {
    const busca = (req.query.busca || "").trim();
    const params = [];
    let where = "o.status <> 'R' AND o.idevento IS NOT NULL";
    if (busca) { params.push(`%${busca}%`); where += ` AND (e.nmevento ILIKE $${params.length} OR c.nmfantasia ILIKE $${params.length})`; }

    const { rows } = await pool.query(
      `SELECT e.idevento, e.nmevento,
              array_agg(DISTINCT c.nmfantasia) FILTER (WHERE c.nmfantasia IS NOT NULL) AS clientes,
              array_agg(DISTINCT emp.nmfantasia ORDER BY emp.nmfantasia) AS empresas
       FROM orcamentos o
       JOIN eventos e ON e.idevento = o.idevento
       JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
       JOIN empresas emp ON emp.idempresa = oe.idempresa
       LEFT JOIN clientes c ON c.idcliente = o.idcliente
       WHERE ${where}
       GROUP BY e.idevento, e.nmevento
       ORDER BY e.nmevento ASC
       LIMIT 50`,
      params
    );
    res.json(rows);
  } catch (error) {
    console.error("ERRO CEO /geral/eventos:", error);
    res.status(500).json({ error: "Erro ao listar eventos." });
  }
});

// GET /ceo/geral/evento-anos?idevento=X — compara o MESMO evento ano a ano, já quebrado por
// empresa (o /ceo/evento-anos "normal" é escopado a uma empresa só) — dá pra somar por ano
// (gráfico principal) OU detalhar por empresa (botão "Detalhar", só some quando um evento está
// selecionado). Mesmas 5 categorias de /geral/receber (recebido/a_receber/recebimento_atrasado/
// a_faturar/em_negociacao) + lucro/despesa.
router.get("/geral/evento-anos", async (req, res) => {
  try {
    const idevento = parseInt(req.query.idevento, 10);
    if (!idevento) return res.status(400).json({ error: "idevento obrigatório." });

    const nome = await pool.query("SELECT nmevento FROM eventos WHERE idevento = $1", [idevento]);
    const { rows } = await pool.query(
      `WITH empresa_efetiva AS (
         -- Mesma regra de /geral/receber: idempresaemissora quando preenchido, senão a empresa
         -- vinculada normalmente (orcamentoempresas).
         SELECT o.idorcamento, COALESCE(o.idempresaemissora, MIN(oe.idempresa)) AS idempresa
         FROM orcamentos o
         LEFT JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
         GROUP BY o.idorcamento, o.idempresaemissora
       ),
       notas_por_orcamento AS (
         -- Mesmo ajuste de /geral/receber: recebido/a_receber/atrasado em valor líquido
         -- (descontando ISS/IRRF/PIS-COFINS-CSLL retidos), pra bater com a tela principal.
         SELECT
           nf.idorcamento,
           SUM(CASE WHEN nf.status = 'Emitida' AND nf.recebido = true
             THEN nf.valorservico - COALESCE(nf.valoriss,0) - COALESCE(nf.valorirrf,0) - COALESCE(nf.valorpiscofinscsll,0)
             ELSE 0 END) AS recebido,
           SUM(CASE WHEN nf.status = 'Emitida' AND nf.recebido = false
                     AND (op.dtvencimento IS NULL OR op.dtvencimento >= CURRENT_DATE)
             THEN nf.valorservico - COALESCE(nf.valoriss,0) - COALESCE(nf.valorirrf,0) - COALESCE(nf.valorpiscofinscsll,0)
             ELSE 0 END) AS a_receber,
           SUM(CASE WHEN nf.status = 'Emitida' AND nf.recebido = false AND op.dtvencimento < CURRENT_DATE
             THEN nf.valorservico - COALESCE(nf.valoriss,0) - COALESCE(nf.valorirrf,0) - COALESCE(nf.valorpiscofinscsll,0)
             ELSE 0 END) AS recebimento_atrasado,
           SUM(CASE WHEN nf.status = 'Emitida' THEN nf.valorservico ELSE 0 END) AS total_faturado
         FROM notasfiscais nf
         LEFT JOIN orcamentoparcelas op ON op.idparcela = nf.idparcela
         GROUP BY nf.idorcamento
       )
       SELECT EXTRACT(YEAR FROM o.dtinirealizacao)::int AS ano,
              ee.idempresa, emp.nmfantasia AS nomeempresa,
              SUM(COALESCE(np.recebido, 0)) AS recebido,
              SUM(COALESCE(np.a_receber, 0)) AS a_receber,
              SUM(COALESCE(np.recebimento_atrasado, 0)) AS recebimento_atrasado,
              SUM(CASE WHEN o.status = 'F'
                THEN GREATEST(COALESCE(o.vlrcliente, 0) - COALESCE(np.total_faturado, 0), 0)
                ELSE 0 END) AS a_faturar,
              SUM(CASE WHEN o.status IN ('A', 'P', 'E') THEN COALESCE(o.vlrcliente, 0) ELSE 0 END) AS em_negociacao,
              SUM(COALESCE(o.lucroreal, 0)) AS lucro,
              SUM(COALESCE(o.totgeralcto, 0) + COALESCE(o.totajdcto, 0)) AS despesa
       FROM orcamentos o
       JOIN empresa_efetiva ee ON ee.idorcamento = o.idorcamento
       JOIN empresas emp ON emp.idempresa = ee.idempresa
       LEFT JOIN notas_por_orcamento np ON np.idorcamento = o.idorcamento
       WHERE o.idevento = $1 AND o.status <> 'R' AND o.dtinirealizacao IS NOT NULL
       GROUP BY ano, ee.idempresa, emp.nmfantasia
       ORDER BY ano ASC, emp.nmfantasia ASC`,
      [idevento]
    );

    res.json({ nmevento: nome.rows[0]?.nmevento || "Evento", linhas: rows });
  } catch (error) {
    console.error("ERRO CEO /geral/evento-anos:", error);
    res.status(500).json({ error: "Erro ao comparar evento por ano entre empresas." });
  }
});

module.exports = router;
