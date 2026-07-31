-- Migration: corrige indice unico solicitacoes pendentes
-- Criada em: 2026-07-31T12:44:11.000Z
--
-- Escreva abaixo o SQL da mudanca de ESTRUTURA (uma migration = uma mudanca).
-- Roda dentro de uma transacao; se der erro, nada deste arquivo e aplicado.
-- Depois de escrever: 'npm run migrate' pra aplicar no seu banco local.
--
-- idx_solicitacao_pendente_unica foi criado originalmente SEM o filtro
-- "WHERE status = 'Pendente'", entao ele tratava qualquer status
-- (Rejeitado, Autorizado, Pendente) como parte da chave unica. Isso bloqueava
-- uma nova solicitacao (ex: Aditivo) quando ja existia uma solicitacao anterior
-- Rejeitada com o mesmo idregistroalterado/categoria_log/dtsolicitada/idfuncionario
-- (ex: uma Vaga Reaproveitada rejeitada impedindo o Aditivo seguinte).
-- O ambiente local ja tinha sido corrigido manualmente em 2026-07-23; esta
-- migration leva a mesma correcao (index parcial, so entre linhas Pendentes)
-- para todos os bancos, incluindo producao.

DROP INDEX IF EXISTS idx_solicitacao_pendente_unica;

CREATE UNIQUE INDEX idx_solicitacao_pendente_unica
  ON public.solicitacoes (idregistroalterado, categoria_log, dtsolicitada, idfuncionario)
  WHERE status = 'Pendente';
