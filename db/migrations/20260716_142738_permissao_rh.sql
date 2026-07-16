-- Migration: Permissao-RH
-- Criada em: 2026-07-16T17:27:38.044Z
--
-- Escreva abaixo o SQL da mudanca de ESTRUTURA (uma migration = uma mudanca).
-- Roda dentro de uma transacao; se der erro, nada deste arquivo e aplicado.
-- Depois de escrever: 'npm run migrate' pra aplicar no seu banco local.

ALTER TABLE permissoes ADD COLUMN IF NOT EXISTS rh BOOLEAN DEFAULT FALSE;