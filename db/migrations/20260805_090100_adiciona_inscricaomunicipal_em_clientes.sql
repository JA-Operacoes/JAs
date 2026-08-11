-- Migration: adiciona inscricaomunicipal em clientes
--
-- Necessario para a emissao de Nota Fiscal (NFS-e): a inscricao municipal
-- do tomador do servico e exigida pela NFS-e Nacional. O campo tpcliente
-- ja distingue Fisica/Juridica, entao so falta a inscricao municipal.

ALTER TABLE clientes ADD COLUMN IF NOT EXISTS inscricaomunicipal VARCHAR(20);
