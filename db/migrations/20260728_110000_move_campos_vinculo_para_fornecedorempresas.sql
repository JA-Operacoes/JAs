-- Migration: move campos de vinculo por-empresa para fornecedorempresas
-- Criada em: 2026-07-28T11:00:00.000Z
--
-- Mesmo padrao aplicado antes em funcionarios/funcionarioempresas
-- (20260727_140000_move_campos_vinculo_para_funcionarioempresas.sql). Ate aqui,
-- ativo/dados bancarios/dados de contato moravam em `fornecedores` (uma linha
-- por CNPJ, compartilhada entre TODAS as empresas onde o fornecedor atua).
-- Isso impedia, por exemplo, o mesmo fornecedor estar ativo numa empresa do
-- grupo e inativo em outra, ou ter dados bancarios/contato diferentes por
-- empresa.
--
-- Esta migration SO ADICIONA as colunas em `fornecedorempresas` e copia o
-- valor atual de `fornecedores` pra cada vinculo ja existente. As colunas
-- antigas em `fornecedores` NAO sao removidas aqui de proposito: as rotas
-- (rotaFornecedores, rotaLancamento, rotaConta) serao migradas e validadas
-- antes de uma migration de limpeza separada remover as colunas antigas.

-- 1. Colunas novas em fornecedorempresas (mesmo tipo/default de fornecedores)
ALTER TABLE fornecedorempresas ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT true;
ALTER TABLE fornecedorempresas ADD COLUMN IF NOT EXISTS nmcontato VARCHAR(255);
ALTER TABLE fornecedorempresas ADD COLUMN IF NOT EXISTS celcontato VARCHAR(20);
ALTER TABLE fornecedorempresas ADD COLUMN IF NOT EXISTS emailcontato VARCHAR(255);
ALTER TABLE fornecedorempresas ADD COLUMN IF NOT EXISTS observacao TEXT;
ALTER TABLE fornecedorempresas ADD COLUMN IF NOT EXISTS codbanco INTEGER;
ALTER TABLE fornecedorempresas ADD COLUMN IF NOT EXISTS agencia VARCHAR(20);
ALTER TABLE fornecedorempresas ADD COLUMN IF NOT EXISTS digitoagencia VARCHAR(5);
ALTER TABLE fornecedorempresas ADD COLUMN IF NOT EXISTS conta VARCHAR(20);
ALTER TABLE fornecedorempresas ADD COLUMN IF NOT EXISTS digitoconta VARCHAR(5);

-- 2. Copia o valor atual de fornecedores pra cada vinculo ja existente
UPDATE fornecedorempresas fe
SET
    ativo = f.ativo,
    nmcontato = f.nmcontato,
    celcontato = f.celcontato,
    emailcontato = f.emailcontato,
    observacao = f.observacao,
    codbanco = f.codbanco,
    agencia = f.agencia,
    digitoagencia = f.digitoagencia,
    conta = f.conta,
    digitoconta = f.digitoconta
FROM fornecedores f
WHERE f.idfornecedor = fe.idfornecedor;
