-- Migration: adiciona colunas adesao plano saude em funcionarios
-- Criada em: 2026-07-22T13:30:14.972Z
--
-- Escreva abaixo o SQL da mudanca de ESTRUTURA (uma migration = uma mudanca).
-- Roda dentro de uma transacao; se der erro, nada deste arquivo e aplicado.
-- Depois de escrever: 'npm run migrate' pra aplicar no seu banco local.

ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS adesaoplanosaude BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS tipoplanosaude VARCHAR(20);

