-- Migration: permite_lancamento_sem_conta_e_backfill_planocontas
-- Criada em: 2026-09-03T15:01:22.524Z
--
-- Escreva abaixo o SQL da mudanca de ESTRUTURA (uma migration = uma mudanca).
-- Roda dentro de uma transacao; se der erro, nada deste arquivo e aplicado.
-- Depois de escrever: 'npm run migrate' pra aplicar no seu banco local.
--
-- Reestruturacao Contas a Pagar (decisao do Financeiro, 2026-09-03): o formulario
-- de Lancamentos deixa de exigir Conta/Tipo de Conta e passa a usar so Plano de
-- Contas. As tabelas contas/tipoconta NAO sao removidas agora (decisao de ir com
-- calma - so ocultar telas/selects); so paramos de exigir idconta.
--
-- Verificado antes de escrever (node -e contra db/conexaoDB.js, banco local):
--   lancamentos total            => 140 linhas
--   lancamentos.idconta          => hoje NOT NULL, 0 linhas com idplanocontas preenchido
--   lancamentos join contas      => 116 linhas cuja conta vinculada ja tem idplanocontas;
--                                    24 linhas com conta sem plano cadastrado (ficam sem
--                                    backfill possivel, ajuste manual futuro)

ALTER TABLE lancamentos ALTER COLUMN idconta DROP NOT NULL;

UPDATE lancamentos l
SET idplanocontas = c.idplanocontas
FROM contas c
WHERE l.idconta = c.idconta
  AND l.idplanocontas IS NULL
  AND c.idplanocontas IS NOT NULL;
