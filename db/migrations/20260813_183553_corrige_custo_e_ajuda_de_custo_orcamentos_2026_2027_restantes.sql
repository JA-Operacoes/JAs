-- Migration: corrige custo e ajuda de custo dos orcamentos de 2026/2027 restantes
-- Criada em: 2026-08-13T18:35:53.000Z
--
-- Continuacao da migration 20260724_140152 (que so cobriu os orcamentos de 2026
-- ainda "ativos" naquela data). Esta aqui recalcula o restante: orcamentos de
-- 2026 com evento ja encerrado antes do corte anterior, e os de 2027 (que ja
-- nascem com o valor antigo, provavelmente por terem sido criados/copiados
-- antes da mudanca de codigo). 2025 fica de fora de proposito: os valores de
-- cacherecadastrados em categoriafuncao mudaram ano a ano por edicao manual
-- (sem passar pelo fluxo de aplicar indices anuais, que preservaria historico),
-- entao hoje nao ha como saber com confianca qual era o valor "maximo" vigente
-- em 2025 - so os logs, sem estrutura pra recalcular direito.
--
-- Mesma logica da migration anterior, sem a restricao de janela de atividade:
--   - ctodiaria = maior valor cadastrado em categoriafuncao (Senior > Pleno > Junior > Base)
--   - ajuda de custo = regra de local de montagem (mesma do Staff.js): so e
--     "dentro de SP" quando UF = 'SP' E cidade = 'SAO PAULO'; fora de SP usa
--     alimentacao x2.5 e transporte zerado, dentro de SP usa os valores normais
--     (com transporte usando transpsenior quando ha custo senior cadastrado).
--
-- Itens SEM funcao (equipamento/suprimento) NAO sao tocados. Venda nao e
-- alterada, so custo e ajuda de custo. Idempotente para itens que ja estao
-- corretos (recalcula pro mesmo valor, sem efeito).

-- 1) Itens de funcao: recalcula custo e ajuda de custo
WITH alvo AS (
  SELECT o.idorcamento,
    NOT (
      UPPER(TRIM(lm.ufmontagem)) = 'SP'
      AND translate(UPPER(TRIM(lm.cidademontagem)), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'AAAAAEEEEIIIIOOOOOUUUUC') = 'SAO PAULO'
    ) AS forasp
  FROM orcamentos o
  LEFT JOIN localmontagem lm ON lm.idmontagem = o.idmontagem
  WHERE EXTRACT(YEAR FROM o.dtinirealizacao) IN (2026, 2027)
),
novos_valores AS (
  SELECT
    oi.idorcamentoitem,
    CASE
      WHEN COALESCE(cf.ctofuncaosenior,0) > 0 THEN cf.ctofuncaosenior
      WHEN COALESCE(cf.ctofuncaopleno,0) > 0 THEN cf.ctofuncaopleno
      WHEN COALESCE(cf.ctofuncaojunior,0) > 0 THEN cf.ctofuncaojunior
      ELSE COALESCE(cf.ctofuncaobase,0)
    END AS cto_novo,
    CASE
      WHEN a.forasp THEN COALESCE(cf.alimentacao,0) * 2.5
      ELSE COALESCE(cf.alimentacao,0)
    END AS alim_novo,
    CASE
      WHEN a.forasp THEN 0
      WHEN COALESCE(cf.ctofuncaosenior,0) > 0 AND COALESCE(cf.transpsenior,0) > 0 THEN cf.transpsenior
      ELSE COALESCE(cf.transporte,0)
    END AS transp_novo,
    oi.qtditens,
    oi.qtddias
  FROM orcamentoitens oi
  JOIN alvo a ON a.idorcamento = oi.idorcamento
  JOIN funcao f ON f.idfuncao = oi.idfuncao
  LEFT JOIN categoriafuncao cf ON cf.idcategoriafuncao = f.idcategoriafuncao
  WHERE oi.idfuncao IS NOT NULL
)
UPDATE orcamentoitens oi
SET
  ctodiaria = nv.cto_novo,
  vlrajdctoalimentacao = nv.alim_novo,
  vlrajdctotransporte = nv.transp_novo,
  totctodiaria = ROUND((nv.cto_novo * nv.qtditens * nv.qtddias)::numeric, 2),
  totajdctoitem = ROUND(((nv.alim_novo + nv.transp_novo) * nv.qtditens * nv.qtddias)::numeric, 2),
  totgeralitem = ROUND((nv.cto_novo * nv.qtditens * nv.qtddias)::numeric, 2)
                 + ROUND(((nv.alim_novo + nv.transp_novo) * nv.qtditens * nv.qtddias)::numeric, 2)
FROM novos_valores nv
WHERE oi.idorcamentoitem = nv.idorcamentoitem;

-- 2) Totais do orcamento: reagrega a partir dos itens ja atualizados acima
WITH alvo AS (
  SELECT o.idorcamento
  FROM orcamentos o
  WHERE EXTRACT(YEAR FROM o.dtinirealizacao) IN (2026, 2027)
),
totais AS (
  SELECT idorcamento, SUM(totctodiaria) AS totgeralcto, SUM(totajdctoitem) AS totajdcto
  FROM orcamentoitens
  WHERE idorcamento IN (SELECT idorcamento FROM alvo)
  GROUP BY idorcamento
)
UPDATE orcamentos o
SET
  totgeralcto = t.totgeralcto,
  totajdcto = t.totajdcto,
  lucrobruto = ROUND((o.totgeralvda - t.totgeralcto - t.totajdcto)::numeric, 2),
  percentlucro = CASE WHEN o.totgeralvda > 0
    THEN ROUND(((o.totgeralvda - t.totgeralcto - t.totajdcto) / o.totgeralvda * 100)::numeric, 2)
    ELSE 0 END,
  lucroreal = ROUND((o.totgeralvda - t.totgeralcto - t.totajdcto - o.vlrimposto - o.vlrctofixo)::numeric, 2),
  percentlucroreal = CASE WHEN o.totgeralvda > 0
    THEN ROUND(((o.totgeralvda - t.totgeralcto - t.totajdcto - o.vlrimposto - o.vlrctofixo) / o.totgeralvda * 100)::numeric, 2)
    ELSE 0 END
FROM totais t
WHERE o.idorcamento = t.idorcamento;
