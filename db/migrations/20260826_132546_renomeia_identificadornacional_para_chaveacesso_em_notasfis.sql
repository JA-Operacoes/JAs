-- Migration: renomeia identificadornacional para chaveacesso em notasfiscais
-- Criada em: 2026-08-26T13:25:46.844Z
--
-- Escreva abaixo o SQL da mudanca de ESTRUTURA (uma migration = uma mudanca).
-- Roda dentro de uma transacao; se der erro, nada deste arquivo e aplicado.
-- Depois de escrever: 'npm run migrate' pra aplicar no seu banco local.
--
-- "identificadornacional" não bate com o nome do campo que a prefeitura
-- realmente devolve (ChaveNotaNacional, ver utils/enviarLoteWebService.js)
-- nem com o termo já conhecido no mercado ("chave de acesso"). Renomeando
-- pra facilitar a identificação de quem for consultar a tabela direto.

ALTER TABLE notasfiscais RENAME COLUMN identificadornacional TO chaveacesso;
