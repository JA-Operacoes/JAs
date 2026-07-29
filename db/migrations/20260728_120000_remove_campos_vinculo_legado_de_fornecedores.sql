-- Migration: remove campos de vinculo legado de fornecedores
-- Criada em: 2026-07-28T12:00:00.000Z
--
-- Etapa final da migracao de campos de vinculo por-empresa (ativo, dados
-- bancarios, dados de contato) para fornecedorempresas. rotaFornecedores.js,
-- rotaLancamento.js e rotaConta.js ja foram migrados e validados para usar
-- fornecedorempresas no lugar. As colunas abaixo estao congeladas desde a
-- migration 20260728_110000_move_campos_vinculo_para_fornecedorempresas
-- (ninguem mais grava nelas) -- esta migration so remove o que ja era morto.

ALTER TABLE fornecedores DROP COLUMN IF EXISTS ativo;
ALTER TABLE fornecedores DROP COLUMN IF EXISTS nmcontato;
ALTER TABLE fornecedores DROP COLUMN IF EXISTS celcontato;
ALTER TABLE fornecedores DROP COLUMN IF EXISTS emailcontato;
ALTER TABLE fornecedores DROP COLUMN IF EXISTS observacao;
ALTER TABLE fornecedores DROP COLUMN IF EXISTS codbanco;
ALTER TABLE fornecedores DROP COLUMN IF EXISTS agencia;
ALTER TABLE fornecedores DROP COLUMN IF EXISTS digitoagencia;
ALTER TABLE fornecedores DROP COLUMN IF EXISTS conta;
ALTER TABLE fornecedores DROP COLUMN IF EXISTS digitoconta;
