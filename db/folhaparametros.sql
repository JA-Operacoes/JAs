-- Tabela de alíquotas / parâmetros fiscais da folha, por ANO.
-- Empresa-agnóstica: é lei federal, igual para todas as empresas; a chave é só o ano.
-- Lida por routes/rotaRH.js -> obterParametros(ano). PARAMS_2026 no código é só fallback.

CREATE TABLE IF NOT EXISTS aliquotas (
  ano                       INTEGER PRIMARY KEY,
  inssfaixas                JSONB    NOT NULL,  -- [{ "ate": 1621.00, "aliquota": 0.075 }, ...]
  irrffaixas                JSONB    NOT NULL,  -- [{ "ate": 2428.80, "aliquota": 0, "deduzir": 0 }, ...] (ate=null = última faixa)
  irrfdeducaodependente     NUMERIC(10,2) NOT NULL,
  irrfdescontosimplificado  NUMERIC(10,2) NOT NULL,
  irrfredutor               JSONB    NOT NULL,  -- { "isencao_ate":5000, "isencao_redutor":312.89, "phaseout_ate":7350, "coef_a":978.62, "coef_b":0.133145 }
  fgtsaliquota              NUMERIC(6,4)  NOT NULL  -- 0.08 (8%)
);

-- Seed 2026 (Receita Federal / Portaria Interm. MPS-MF nº 13; Leis 15.191 e 15.270/2025).
INSERT INTO aliquotas
  (ano, inssfaixas, irrffaixas, irrfdeducaodependente,
   irrfdescontosimplificado, irrfredutor, fgtsaliquota)
VALUES (
  2026,
  '[
    {"ate":1621.00,"aliquota":0.075},
    {"ate":2902.84,"aliquota":0.09},
    {"ate":4354.27,"aliquota":0.12},
    {"ate":8475.55,"aliquota":0.14}
  ]'::jsonb,
  '[
    {"ate":2428.80,"aliquota":0,"deduzir":0},
    {"ate":2826.65,"aliquota":0.075,"deduzir":182.16},
    {"ate":3751.05,"aliquota":0.15,"deduzir":394.16},
    {"ate":4664.68,"aliquota":0.225,"deduzir":675.49},
    {"ate":null,"aliquota":0.275,"deduzir":908.73}
  ]'::jsonb,
  189.59,
  607.20,
  '{"isencao_ate":5000,"isencao_redutor":312.89,"phaseout_ate":7350,"coef_a":978.62,"coef_b":0.133145}'::jsonb,
  0.08
)
ON CONFLICT (ano) DO NOTHING;
