-- Migration: corrige custo e ajuda de custo dos orcamentos de 2026 ainda ativos
-- Criada em: 2026-07-24T14:01:52.000Z
--
-- Generaliza a mesma correcao aplicada manualmente no orcamento 244 (migration
-- 20260724_113735) para todos os orcamentos de 2026 que ainda estao "ativos":
-- ultima data do orcamento (GREATEST de dtfimdesmontagem/dtfiminfradesmontagem/
-- dtfimposevento) maior ou igual a hoje - 15 dias (folga do prazo de pagamento).
-- Orcamentos ja encerrados ha mais de 15 dias ficam de fora, preservando o
-- historico deles como esta.
--
-- Para cada item de funcao desses orcamentos:
--   - ctodiaria = maior valor cadastrado em categoriafuncao (Senior > Pleno > Junior > Base)
--   - ajuda de custo = regra de local de montagem (mesma do Staff.js): so e
--     "dentro de SP" quando UF = 'SP' E cidade = 'SAO PAULO'; fora de SP usa
--     alimentacao x2.5 e transporte zerado, dentro de SP usa os valores normais
--     (com transporte usando transpsenior quando ha custo senior cadastrado).
--
-- Itens SEM funcao (equipamento/suprimento) NAO sao tocados — nem o valor
-- unitario nem os totais gravados, preservando qualquer ajuste manual existente.
--
-- Venda (vlrdiaria/totvdadiaria/totgeralvda/vlrcliente/desconto/acrescimo/
-- percentimposto/percentctofixo) nao e alterada, so custo e ajuda de custo.
--
-- Conferido antes de aplicar: query de comparacao rodada contra o preview
-- (99 orcamentos, delta agregado de -R$1.358.322,65 em lucroreal) bateu 100%,
-- sem nenhuma divergencia.

-- 1) Itens de funcao: recalcula custo e ajuda de custo
WITH ativos AS (
  SELECT o.idorcamento,
    NOT (
      UPPER(TRIM(lm.ufmontagem)) = 'SP'
      AND translate(UPPER(TRIM(lm.cidademontagem)), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'AAAAAEEEEIIIIOOOOOUUUUC') = 'SAO PAULO'
    ) AS forasp
  FROM orcamentos o
  LEFT JOIN localmontagem lm ON lm.idmontagem = o.idmontagem
  WHERE EXTRACT(YEAR FROM o.dtinirealizacao) = 2026
    AND GREATEST(o.dtfimdesmontagem, o.dtfiminfradesmontagem, o.dtfimposevento) >= CURRENT_DATE - INTERVAL '15 days'
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
  JOIN ativos a ON a.idorcamento = oi.idorcamento
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
WITH ativos AS (
  SELECT o.idorcamento
  FROM orcamentos o
  WHERE EXTRACT(YEAR FROM o.dtinirealizacao) = 2026
    AND GREATEST(o.dtfimdesmontagem, o.dtfiminfradesmontagem, o.dtfimposevento) >= CURRENT_DATE - INTERVAL '15 days'
),
totais AS (
  SELECT idorcamento, SUM(totctodiaria) AS totgeralcto, SUM(totajdctoitem) AS totajdcto
  FROM orcamentoitens
  WHERE idorcamento IN (SELECT idorcamento FROM ativos)
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
