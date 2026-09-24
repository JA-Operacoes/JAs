-- Migration: backfill idorcamento em staffeventos (só os casos SEM ambiguidade)
-- Criada em: 2026-09-22T18:07:22.000Z
--
-- Achado a partir do bug "Nenhum funcionário cadastrado" em eventos de 2025 (Eventos em Aberto):
-- 2010 registros de staffeventos (106 eventos, dtregistro entre 29/07/2025 e 05/12/2025) estão
-- com idorcamento NULL. Toda consulta que precisa cruzar com orcamentoempresas pra saber a
-- empresa (INNER JOIN ... ON oe.idorcamento = se.idorcamento) -- inclusive o custo_staff_real
-- do CEO Mode -- ignora esses registros silenciosamente (NULL nunca bate em JOIN), sem erro
-- nenhum. R$524.215,47 em custo real (R$482.416,61 já Pago) ficam invisíveis pro sistema hoje.
--
-- Esta migration só resolve os casos SEM ambiguidade -- onde só existe 1 orçamento candidato
-- (mesmo idevento, mesmo ano do trabalho, status <> 'R'):
--   Passo 1: 1.344 registros com exatamente 1 candidato já no nível de ANO (a maioria).
--   Passo 2: mais alguns registros que só têm 1 candidato quando também cruza o PERÍODO
--            (datas trabalhadas dentro da janela de montagem/desmontagem, +-2 dias de folga) --
--            cobre os casos em que o mesmo evento/ano tem múltiplos orçamentos-irmãos, mas só
--            um deles bate com a data real trabalhada.
--
-- NÃO cobre (ficam NULL de propósito, decisão de negócio pendente):
--   - Eventos sem NENHUM orçamento no ano (idevento 68 "EXAGERADO CARAPINA-MAIO", 77 "FEBRAVA",
--     90 "LAAD" em 2025) -- não tem pra onde amarrar sem criar/recuperar orçamento.
--   - idevento 116 "SIC": tem orçamento batendo a data (idorcamento 146), mas está status
--     'Recusado' -- fica de fora até decisão de negócio (o filtro abaixo já exige status<>'R').
--   - Registros onde 2+ orçamentos-irmãos têm o MESMO período (mesma data de montagem/
--     desmontagem) -- não tem como saber qual dos irmãos é o certo só com os dados disponíveis
--     (orcamentoitens não guarda idequipe, não dá pra cruzar por função/equipe).
--
-- Idempotente: só toca WHERE idorcamento IS NULL, seguro de rodar de novo.

-- Passo 1: exatamente 1 candidato no mesmo idevento + ano (sem olhar período ainda)
WITH alvo AS (
  SELECT se.idstaffevento, se.idevento,
         EXTRACT(YEAR FROM (se.datasevento->>0)::date)::int AS ano_alvo
  FROM staffeventos se
  WHERE se.idorcamento IS NULL
    AND se.datasevento IS NOT NULL
    AND jsonb_array_length(se.datasevento) > 0
),
candidatos AS (
  SELECT a.idstaffevento, MIN(o.idorcamento) AS idorcamento_unico, COUNT(DISTINCT o.idorcamento) AS qtd
  FROM alvo a
  JOIN orcamentos o
    ON o.idevento = a.idevento
   AND o.status <> 'R'
   AND EXTRACT(YEAR FROM o.dtinirealizacao) = a.ano_alvo
  GROUP BY a.idstaffevento
  HAVING COUNT(DISTINCT o.idorcamento) = 1
)
UPDATE staffeventos se
SET idorcamento = c.idorcamento_unico
FROM candidatos c
WHERE se.idstaffevento = c.idstaffevento;

-- Passo 2: dos que sobraram (2+ candidatos só no ano), refina pelo período de
-- montagem/desmontagem -- só aplica quando isso resulta em exatamente 1 candidato.
WITH alvo AS (
  SELECT se.idstaffevento, se.idevento,
         (SELECT MIN((d)::date) FROM jsonb_array_elements_text(se.datasevento) d) AS dt_min,
         (SELECT MAX((d)::date) FROM jsonb_array_elements_text(se.datasevento) d) AS dt_max,
         EXTRACT(YEAR FROM (se.datasevento->>0)::date)::int AS ano_alvo
  FROM staffeventos se
  WHERE se.idorcamento IS NULL
    AND se.datasevento IS NOT NULL
    AND jsonb_array_length(se.datasevento) > 0
),
candidatos_periodo AS (
  SELECT a.idstaffevento, MIN(o.idorcamento) AS idorcamento_unico, COUNT(DISTINCT o.idorcamento) AS qtd
  FROM alvo a
  JOIN orcamentos o
    ON o.idevento = a.idevento
   AND o.status <> 'R'
   AND EXTRACT(YEAR FROM o.dtinirealizacao) = a.ano_alvo
   AND a.dt_min >= COALESCE(o.dtinimontagem, o.dtinirealizacao) - INTERVAL '2 days'
   AND a.dt_max <= COALESCE(o.dtfimdesmontagem, o.dtfimrealizacao) + INTERVAL '2 days'
  GROUP BY a.idstaffevento
  HAVING COUNT(DISTINCT o.idorcamento) = 1
)
UPDATE staffeventos se
SET idorcamento = c.idorcamento_unico
FROM candidatos_periodo c
WHERE se.idstaffevento = c.idstaffevento;
