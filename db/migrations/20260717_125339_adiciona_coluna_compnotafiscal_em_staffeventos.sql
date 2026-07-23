-- Migration: adiciona coluna compnotafiscal em staffeventos
-- Criada em: 2026-07-17T15:53:39.047Z
--
-- Escreva abaixo o SQL da mudanca de ESTRUTURA (uma migration = uma mudanca).
-- Roda dentro de uma transacao; se der erro, nada deste arquivo e aplicado.
-- Depois de escrever: 'npm run migrate' pra aplicar no seu banco local.

ALTER TABLE staffeventos ADD COLUMN IF NOT EXISTS compnotafiscal TEXT;
