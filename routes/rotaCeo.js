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
      SELECT se.idevento,
             SUM(COALESCE(se.vlrtotcache, 0)
               + COALESCE(se.vlrtotajdcusto, 0)
               + COALESCE(se.vlrcaixinha, 0)) AS custo_staff_real
      FROM staffeventos se
      GROUP BY se.idevento
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
      MAX(COALESCE(sr.custo_staff_real, 0))   AS custo_staff_real
    FROM orcs o
    JOIN eventos e   ON e.idevento  = o.idevento
    LEFT JOIN clientes c ON c.idcliente = o.idcliente
    LEFT JOIN staff_orcado so ON so.idorcamento = o.idorcamento
    LEFT JOIN staff_real  sr ON sr.idevento     = o.idevento
    GROUP BY o.idevento, e.nmevento, c.nmfantasia
    ${ordem};
  `;
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
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
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
          COALESCE(o.vlrcliente, 0)  AS vlrcliente
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
                 + COALESCE(se.vlrtotajdcusto, 0)
                 + COALESCE(se.vlrcaixinha, 0)) AS custo_staff_real
        FROM staffeventos se
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
        SUM(COALESCE(sr.custo_staff_real, 0))   AS custo_staff_real
      FROM orcs o
      LEFT JOIN staff_orcado so ON so.idorcamento = o.idorcamento
      LEFT JOIN staff_real  sr ON sr.idorcamento = o.idorcamento
      GROUP BY o.ano
      ORDER BY o.ano ASC;
    `;

    const nome = await pool.query("SELECT nmevento FROM eventos WHERE idevento = $1", [idevento]);
    const { rows } = await pool.query(query, [idempresa, idevento]);
    res.json({ nmevento: nome.rows[0]?.nmevento || "Evento", anos: rows });
  } catch (error) {
    console.error("ERRO CEO /evento-anos:", error);
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
