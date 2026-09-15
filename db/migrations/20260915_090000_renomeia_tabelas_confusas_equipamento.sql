-- Migration: renomeia_tabelas_confusas_equipamento
-- Criada em: 2026-09-15T09:00:00.000Z
--
-- Nomes antigos ficaram confusos sobre o que a tabela guarda:
-- - equipamentoorcamentocompra: apesar do nome, hoje so existe presa a uma
--   manutencao (idmanutencao NOT NULL) — nao serve pra compra de equipamento
--   novo avulso. Renomeada para almoxaticompras.
-- - equipamentocustodiahistorico: renomeada para equipunidadehistorico,
--   no mesmo padrao de equipamentoconsumivelhistorico (historico da unidade).

ALTER TABLE IF EXISTS equipamentoorcamentocompra RENAME TO almoxaticompras;
ALTER TABLE IF EXISTS equipamentocustodiahistorico RENAME TO equipunidadehistorico;

ALTER INDEX IF EXISTS idx_equipamentoorcamentocompra_status RENAME TO idx_almoxaticompras_status;
