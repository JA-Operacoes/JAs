-- Migration: altera idsolicitacao para array em orcamentoitens
-- Criada em: 2026-07-22T19:09:46.000Z
--
-- Escreva abaixo o SQL da mudanca de ESTRUTURA (uma migration = uma mudanca).
-- Roda dentro de uma transacao; se der erro, nada deste arquivo e aplicado.
-- Depois de escrever: 'npm run migrate' pra aplicar no seu banco local.

ALTER TABLE orcamentoitens
  ALTER COLUMN idsolicitacao TYPE integer[]
  USING CASE WHEN idsolicitacao IS NULL THEN NULL ELSE ARRAY[idsolicitacao] END;
