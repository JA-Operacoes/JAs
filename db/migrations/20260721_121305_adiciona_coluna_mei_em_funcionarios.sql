-- Migration: adiciona coluna mei em funcionarios
-- Criada em: 2026-07-21T15:13:05.274Z
--
-- Escreva abaixo o SQL da mudanca de ESTRUTURA (uma migration = uma mudanca).
-- Roda dentro de uma transacao; se der erro, nada deste arquivo e aplicado.
-- Depois de escrever: 'npm run migrate' pra aplicar no seu banco local.

ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS mei BOOLEAN NOT NULL DEFAULT false;

