-- Migration: Funcionarios-dados-de-pagamentos
-- Criada em: 2026-07-16T18:13:54.171Z
--
-- Escreva abaixo o SQL da mudanca de ESTRUTURA (uma migration = uma mudanca).
-- Roda dentro de uma transacao; se der erro, nada deste arquivo e aplicado.
-- Depois de escrever: 'npm run migrate' pra aplicar no seu banco local.

ALTER TABLE funcionarios
    ADD COLUMN IF NOT EXISTS salario NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS funcao VARCHAR(100),
    ADD COLUMN IF NOT EXISTS cbo NUMERIC,
    ADD COLUMN IF NOT EXISTS dependentes NUMERIC,
    ADD COLUMN IF NOT EXISTS admissao DATE,
    ADD COLUMN IF NOT EXISTS valealim NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS valetrnsp NUMERIC(12,2);