-- Migration: adiciona totaditivo e totbonificado em orcamentos
-- Criada em: 2026-09-21T17:29:41.000Z
--
-- Duas colunas novas, no mesmo padrao de totgeralvda/totgeralcto: calculadas no
-- front (recalcularTotaisGerais, Orcamentos.js) e salvas na propria linha do
-- orcamento, pra rota do CEO Mode so ler o total pronto (SUM direto), sem
-- precisar reagregar orcamentoitens por adicional/vlrdiaria a cada consulta.
--
-- totaditivo    = soma de totvdadiaria dos itens adicional=true COM vlrdiaria>0
--                 (cliente paga a mais). Ja esta embutido em totgeralvda hoje,
--                 essa coluna e so a QUEBRA, nao um valor a somar por cima.
-- totbonificado = soma de totgeralitem (custo + ajuda de custo) dos itens
--                 adicional=true COM vlrdiaria=0 (cliente nao paga). Ja esta
--                 embutido em totgeralcto/totajdcto hoje, mesma logica -- usa
--                 totgeralitem (nao so totctodiaria) pra bater com a mesma
--                 granularidade de Gasto Previsto (totgeralcto + totajdcto).
--
-- Backfill abaixo cobre todo o historico (nao so 2026/2027): CEO Mode filtra
-- por ano/periodo livremente, orcamento antigo sem essas colunas populadas
-- apareceria com Faturamento Extra/Despesas Extras zerados mesmo tendo tido.

ALTER TABLE orcamentos
  ADD COLUMN IF NOT EXISTS totaditivo    numeric(12,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS totbonificado numeric(12,2) NOT NULL DEFAULT 0.00;

WITH agregado AS (
  SELECT
    idorcamento,
    SUM(CASE WHEN adicional = true AND COALESCE(vlrdiaria,0) > 0 THEN COALESCE(totvdadiaria,0) ELSE 0 END) AS totaditivo,
    SUM(CASE WHEN adicional = true AND COALESCE(vlrdiaria,0) = 0 THEN COALESCE(totgeralitem,0) ELSE 0 END) AS totbonificado
  FROM orcamentoitens
  WHERE adicional = true
  GROUP BY idorcamento
)
UPDATE orcamentos o
SET totaditivo = a.totaditivo,
    totbonificado = a.totbonificado
FROM agregado a
WHERE o.idorcamento = a.idorcamento;
