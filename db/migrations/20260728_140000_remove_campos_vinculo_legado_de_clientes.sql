-- Migration: remove campos de vinculo legado de clientes
-- Criada em: 2026-07-28T14:00:00.000Z
--
-- Etapa final da migracao de campos de vinculo por-empresa (ativo, dados de
-- contato, email de nfe, responsavel pelo contrato) para clienteempresas.
-- rotaCliente.js, rotaLancamento.js, rotaConta.js, rotaStaff.js e
-- rotaOrcamento.js ja foram migrados e validados para usar clienteempresas no
-- lugar. As colunas abaixo estao congeladas desde a migration
-- 20260728_130000_move_campos_vinculo_para_clienteempresas (ninguem mais
-- grava nelas) -- esta migration so remove o que ja era morto.

ALTER TABLE clientes DROP COLUMN IF EXISTS ativo;
ALTER TABLE clientes DROP COLUMN IF EXISTS nmcontato;
ALTER TABLE clientes DROP COLUMN IF EXISTS celcontato;
ALTER TABLE clientes DROP COLUMN IF EXISTS emailcontato;
ALTER TABLE clientes DROP COLUMN IF EXISTS emailnfe;
ALTER TABLE clientes DROP COLUMN IF EXISTS responsavelcontrato;
