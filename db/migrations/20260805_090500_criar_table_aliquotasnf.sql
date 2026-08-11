-- Migration: criar table aliquotasnf
--
-- Parametros fiscais da Nota Fiscal (CBS/IBS da Reforma Tributaria +
-- retencoes federais de servico), versionados por ano — mesma ideia da
-- tabela `aliquotas`, mas separada de proposito: `aliquotas` e do modulo RH
-- (servida por /rh/parametros, so INSS/IRRF/FGTS de folha de pagamento);
-- `aliquotasnf` e do modulo Nota Fiscal (Financeiro), evita misturar os
-- dois dominios numa rota que nao devia conhecer o outro assunto.
--
-- CBS/IBS mudam de valor todo ano ate 2033 (LC 214/2025) — por isso
-- versionado por ano em vez de fixo no codigo.

CREATE TABLE IF NOT EXISTS aliquotasnf (
  ano                       INTEGER PRIMARY KEY,
  cbsaliq                   NUMERIC(6,4) NOT NULL,
  ibsaliq                   NUMERIC(6,4) NOT NULL,
  irrfservicoaliq           NUMERIC(6,4) NOT NULL,
  piscofinscsllservicoaliq  NUMERIC(6,4) NOT NULL
);

INSERT INTO aliquotasnf (ano, cbsaliq, ibsaliq, irrfservicoaliq, piscofinscsllservicoaliq)
VALUES (2026, 0.0090, 0.0010, 0.0150, 0.0465)
ON CONFLICT (ano) DO NOTHING;
