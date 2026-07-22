-- Migration: Funcionarios-dependentes-jsonb
-- Criada em: 2026-07-22
--
-- Escreva abaixo o SQL da mudanca de ESTRUTURA (uma migration = uma mudanca).
-- Roda dentro de uma transacao; se der erro, nada deste arquivo e aplicado.
-- Depois de escrever: 'npm run migrate' pra aplicar no seu banco local.

-- Armazena os dados de cada dependente (nome + data de nascimento) num unico
-- campo JSONB. Formato esperado: [{ "nome": "...", "nascimento": "YYYY-MM-DD" }, ...]
ALTER TABLE funcionarios
    ADD COLUMN IF NOT EXISTS dependentesdados JSONB NOT NULL DEFAULT '[]'::jsonb;
