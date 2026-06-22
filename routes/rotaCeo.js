// Rota do CeoMode: análise de rentabilidade por cliente -> eventos.
// Compara o lucro esperado (orçamento) com o custo real executado (staff),
// para indicar se o contrato fechado de cada evento "valeu a pena".
const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB");

// GET /ceo/clientes
// Lista os clientes que possuem orçamentos (não recusados) na empresa do contexto.
router.get("/clientes", async (req, res) => {
  try {
    const idempresa = req.idempresa;
    if (!idempresa) return res.status(400).json({ error: "idempresa obrigatório." });

    const query = `
      SELECT DISTINCT c.idcliente, c.nmfantasia
      FROM clientes c
      JOIN orcamentos o ON o.idcliente = c.idcliente
      JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
      WHERE oe.idempresa = $1 AND o.status <> 'R'
      ORDER BY c.nmfantasia ASC;
    `;
    const { rows } = await pool.query(query, [idempresa]);
    res.json(rows);
  } catch (error) {
    console.error("ERRO CEO /clientes:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /ceo/analise?idcliente=ID
// Para o cliente informado, retorna cada evento com os números do orçamento
// vigente (maior nrorcamento não recusado) + custos de staff orçado x real.
router.get("/analise", async (req, res) => {
  try {
    const idempresa = req.idempresa;
    const idcliente = parseInt(req.query.idcliente, 10);
    if (!idempresa) return res.status(400).json({ error: "idempresa obrigatório." });
    if (!idcliente) return res.status(400).json({ error: "idcliente obrigatório." });

    const query = `
      WITH orc_evento AS (
        -- Orçamento vigente por evento: maior nrorcamento que não foi recusado
        SELECT DISTINCT ON (o.idevento)
          o.idevento, o.idorcamento, o.nrorcamento, o.status,
          o.totgeralvda, o.totgeralcto, o.totajdcto,
          o.lucroreal, o.percentlucroreal, o.vlrcliente
        FROM orcamentos o
        JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
        WHERE oe.idempresa = $1
          AND o.idcliente = $2
          AND o.status <> 'R'
          AND o.idevento IS NOT NULL
        ORDER BY o.idevento, o.nrorcamento DESC
      ),
      staff_orcado AS (
        -- Custo de staff previsto no orçamento (itens vinculados a uma função)
        SELECT oi.idorcamento,
               SUM(COALESCE(oi.totgeralitem, 0)) AS custo_staff_orcado
        FROM orcamentoitens oi
        WHERE oi.idfuncao IS NOT NULL
        GROUP BY oi.idorcamento
      ),
      staff_real AS (
        -- Custo de staff realmente escalado/pago por evento
        SELECT se.idevento,
               SUM(COALESCE(se.vlrtotcache, 0)
                 + COALESCE(se.vlrtotajdcusto, 0)
                 + COALESCE(se.vlrcaixinha, 0)) AS custo_staff_real
        FROM staffeventos se
        GROUP BY se.idevento
      )
      SELECT
        oc.idevento,
        e.nmevento,
        oc.nrorcamento,
        oc.status,
        COALESCE(oc.totgeralvda, 0)     AS totgeralvda,
        COALESCE(oc.totgeralcto, 0)     AS totgeralcto,
        COALESCE(oc.totajdcto, 0)       AS totajdcto,
        COALESCE(oc.lucroreal, 0)       AS lucroreal,
        COALESCE(oc.percentlucroreal,0) AS percentlucroreal,
        COALESCE(oc.vlrcliente, 0)      AS vlrcliente,
        COALESCE(so.custo_staff_orcado, 0) AS custo_staff_orcado,
        COALESCE(sr.custo_staff_real, 0)   AS custo_staff_real
      FROM orc_evento oc
      JOIN eventos e ON e.idevento = oc.idevento
      LEFT JOIN staff_orcado so ON so.idorcamento = oc.idorcamento
      LEFT JOIN staff_real  sr ON sr.idevento     = oc.idevento
      ORDER BY oc.nrorcamento DESC;
    `;

    const { rows } = await pool.query(query, [idempresa, idcliente]);
    res.json({ eventos: rows });
  } catch (error) {
    console.error("ERRO CEO /analise:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
