-- Migration: adiciona dados bancarios em empresas
--
-- Meio de pagamento (PIX, deposito, transferencia) na Emissao de Nota Fiscal
-- e so controle interno (nao faz parte do layout da NFS-e), mas pra ser util
-- de verdade precisa mostrar pra onde o cliente deve pagar. Boleto bancario
-- fica de fora de proposito: nao e dado fixo, e um documento gerado por
-- transacao via convenio com banco/gateway, o que e uma integracao a parte.
--
-- Mesmo padrao de colunas ja usado em funcionarios/fornecedorempresas
-- (codigobanco, agencia, digitoagencia, numeroconta, digitoconta, tipoconta,
-- pix) — nada de tabela nova, empresas e uma entidade unica (nao tem vinculo
-- N:N tipo fornecedorempresas que justificasse separar).

ALTER TABLE empresas ADD COLUMN IF NOT EXISTS codigobanco VARCHAR(20);
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS agencia VARCHAR(20);
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS digitoagencia VARCHAR(2);
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS numeroconta VARCHAR(50);
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS digitoconta VARCHAR(2);
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS tipoconta VARCHAR(50);
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS pix VARCHAR(255);
