-- Migration: domestico_e_deducao_inss
-- Criada em: 2026-10-02
--
-- 1) funcionarioempresas.domestico: marca o empregado doméstico (por vínculo/empresa). Só escolhe o
--    MÉTODO do INSS de férias (ver calcularINSSDeducao em rotaRH.js) — não é perfil novo de
--    propósito: `perfil` (Interno/InternoH/ExternoH) controla imposto, VA/VT e acesso ao RH em
--    vários pontos da folha, e um valor novo ali mexeria em tudo isso.
-- 2) aliquotas.inssfaixas ganha `deduzir` em cada faixa (parcela a deduzir da tabela oficial do
--    INSS: alíquota × base − deduzir). Doméstico usa esse método nas férias; contabilidade, 2026-10-02:
--    3.657,33 × 12% − 111,40 = 327,47 (centavos cortados). Editável na tela de Alíquotas.
--    Preenche as faixas de 2026 já gravadas com o valor DERIVADO da própria tabela (acumulado de
--    (alíquota da faixa − alíquota da anterior) × teto da faixa anterior), arredondado a 2 casas:
--    0 / 24,32 / 111,40 / 198,49 — o 111,40 confere com o que a contabilidade usa.
ALTER TABLE funcionarioempresas
  ADD COLUMN IF NOT EXISTS domestico BOOLEAN NOT NULL DEFAULT false;

UPDATE aliquotas a
   SET inssfaixas = (
     SELECT jsonb_agg(
              f.elem || jsonb_build_object(
                'deduzir',
                COALESCE((
                  SELECT ROUND(SUM(
                           ((g.elem->>'aliquota')::numeric - COALESCE((g_prev.elem->>'aliquota')::numeric, 0))
                           * COALESCE((g_prev.elem->>'ate')::numeric, 0)
                         ), 2)
                    FROM jsonb_array_elements(a.inssfaixas) WITH ORDINALITY AS g(elem, n)
                    LEFT JOIN jsonb_array_elements(a.inssfaixas) WITH ORDINALITY AS g_prev(elem, n)
                           ON g_prev.n = g.n - 1
                   WHERE g.n <= f.n
                ), 0)
              )
              ORDER BY f.n
            )
       FROM jsonb_array_elements(a.inssfaixas) WITH ORDINALITY AS f(elem, n)
   )
 WHERE jsonb_typeof(a.inssfaixas) = 'array'
   AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(a.inssfaixas) e WHERE e ? 'deduzir');
