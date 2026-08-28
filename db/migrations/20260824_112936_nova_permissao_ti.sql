-- Migration: nova_permissao_TI
-- Criada em: 2026-08-24T14:29:36.780Z
--
-- Escreva abaixo o SQL da mudanca de ESTRUTURA (uma migration = uma mudanca).
-- Roda dentro de uma transacao; se der erro, nada deste arquivo e aplicado.
-- Depois de escrever: 'npm run migrate' pra aplicar no seu banco local.

ALTER TABLE permissoes
ADD COLUMN ti BOOLEAN DEFAULT FALSE;