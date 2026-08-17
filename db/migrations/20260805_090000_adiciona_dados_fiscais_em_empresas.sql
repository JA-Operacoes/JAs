-- Migration: adiciona dados fiscais em empresas
--
-- Necessario para a emissao de Nota Fiscal (NFS-e): regime tributario
-- (define como calcular retencoes/CBS-IBS) e inscricao municipal (exigida
-- pela NFS-e Nacional). Nenhuma empresa tinha esses dados cadastrados.

ALTER TABLE empresas ADD COLUMN IF NOT EXISTS regimetributario VARCHAR(20)
  CHECK (regimetributario IN ('Simples Nacional','Lucro Presumido','Lucro Real'));
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS inscricaomunicipal VARCHAR(20);
