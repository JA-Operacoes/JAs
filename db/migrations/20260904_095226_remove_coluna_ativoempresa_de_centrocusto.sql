-- Migration: remove_coluna_ativoempresa_de_centrocusto
-- Criada em: 2026-09-04T12:52:26.425Z
--
-- Escreva abaixo o SQL da mudanca de ESTRUTURA (uma migration = uma mudanca).
-- Roda dentro de uma transacao; se der erro, nada deste arquivo e aplicado.
-- Depois de escrever: 'npm run migrate' pra aplicar no seu banco local.
--
-- centrocusto.ativoempresa e coluna morta: nao e lida/escrita em nenhuma rota
-- ou tela do sistema (grep em routes/*.js e public/**/*.js/html sem nenhuma
-- ocorrencia), sem constraint ou indice dependendo dela. Provavel resquicio
-- de uma tentativa anterior de status por vinculo empresa-entidade (como
-- funcionarioempresas.ativo), nunca implementada para Centro de Custo.
--
-- Verificado antes de escrever (node -e contra db/conexaoDB.js, banco local):
--   centrocusto total          => 329 linhas
--   ativoempresa = true        => 0 linhas (sempre no default 'false')
--   constraints/indices na coluna => nenhum

ALTER TABLE centrocusto DROP COLUMN ativoempresa;
