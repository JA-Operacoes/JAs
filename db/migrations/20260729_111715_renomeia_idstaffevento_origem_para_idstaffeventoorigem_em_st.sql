-- Migration: renomeia idstaffevento_origem para idstaffeventoorigem em staffajustefinanceiro
-- Criada em: 2026-07-29T14:17:15.517Z
--
-- Escreva abaixo o SQL da mudanca de ESTRUTURA (uma migration = uma mudanca).
-- Roda dentro de uma transacao; se der erro, nada deste arquivo e aplicado.
-- Depois de escrever: 'npm run migrate' pra aplicar no seu banco local.
--
-- Padroniza o nome da coluna sem underscore no meio, pra ficar igual ao resto
-- das colunas do sistema (mais fácil de lembrar/manter).

ALTER TABLE staffajustefinanceiro RENAME COLUMN idstaffevento_origem TO idstaffeventoorigem;

