-- Migration: adiciona coluna obsbonificado em orcamentoitens
-- Criada em: 2026-07-16T17:24:34.428Z
--
-- Escreva abaixo o SQL da mudanca de ESTRUTURA (uma migration = uma mudanca).
-- Roda dentro de uma transacao; se der erro, nada deste arquivo e aplicado.
-- Depois de escrever: 'npm run migrate' pra aplicar no seu banco local.

ALTER TABLE orcamentoitens ADD COLUMN IF NOT EXISTS obsbonificado TEXT;
