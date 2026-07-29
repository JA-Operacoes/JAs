-- Migration: move campos de vinculo por-empresa para clienteempresas
-- Criada em: 2026-07-28T13:00:00.000Z
--
-- Mesmo padrao aplicado antes em funcionarios/funcionarioempresas e
-- fornecedores/fornecedorempresas. Ate aqui, ativo/dados de contato/email de
-- nfe/responsavel pelo contrato moravam em `clientes` (uma linha por CNPJ,
-- compartilhada entre TODAS as empresas onde o cliente e atendido). Isso
-- impedia, por exemplo, o mesmo cliente estar ativo numa empresa do grupo e
-- inativo em outra, ou ter contato/responsavel diferentes por empresa.
--
-- Esta migration SO ADICIONA as colunas em `clienteempresas` e copia o valor
-- atual de `clientes` pra cada vinculo ja existente. As colunas antigas em
-- `clientes` NAO sao removidas aqui de proposito: as rotas (rotaCliente,
-- rotaLancamento, rotaConta, rotaStaff, rotaMain, rotaOrcamento) serao
-- migradas e validadas antes de uma migration de limpeza separada remover as
-- colunas antigas.

-- 1. Colunas novas em clienteempresas (mesmo tipo/default de clientes)
ALTER TABLE clienteempresas ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT false;
ALTER TABLE clienteempresas ADD COLUMN IF NOT EXISTS nmcontato VARCHAR(100);
ALTER TABLE clienteempresas ADD COLUMN IF NOT EXISTS celcontato VARCHAR(15);
ALTER TABLE clienteempresas ADD COLUMN IF NOT EXISTS emailcontato VARCHAR(100);
ALTER TABLE clienteempresas ADD COLUMN IF NOT EXISTS emailnfe VARCHAR(100);
ALTER TABLE clienteempresas ADD COLUMN IF NOT EXISTS responsavelcontrato VARCHAR(100);

-- 2. Copia o valor atual de clientes pra cada vinculo ja existente
UPDATE clienteempresas ce
SET
    ativo = c.ativo,
    nmcontato = c.nmcontato,
    celcontato = c.celcontato,
    emailcontato = c.emailcontato,
    emailnfe = c.emailnfe,
    responsavelcontrato = c.responsavelcontrato
FROM clientes c
WHERE c.idcliente = ce.idcliente;
