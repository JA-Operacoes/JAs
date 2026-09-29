-- Migration: adiciona coluna motivoinativado em funcionarioempresas
-- Criada em: 2026-09-29T14:43:14.396Z
--
-- Escreva abaixo o SQL da mudanca de ESTRUTURA (uma migration = uma mudanca).
-- Roda dentro de uma transacao; se der erro, nada deste arquivo e aplicado.
-- Depois de escrever: 'npm run migrate' pra aplicar no seu banco local.

ALTER TABLE funcionarioempresas ADD COLUMN IF NOT EXISTS motivoinativado TEXT;
