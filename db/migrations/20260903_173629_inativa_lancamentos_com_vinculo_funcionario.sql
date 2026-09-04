-- Migration: inativa_lancamentos_com_vinculo_funcionario
-- Criada em: 2026-09-03T20:36:29.485Z
--
-- Escreva abaixo o SQL da mudanca de ESTRUTURA (uma migration = uma mudanca).
-- Roda dentro de uma transacao; se der erro, nada deste arquivo e aplicado.
-- Depois de escrever: 'npm run migrate' pra aplicar no seu banco local.
--
-- Decisao do Financeiro (2026-09-03): daqui pra frente o RH alimenta o
-- financeiro com valores de funcionario mensalmente (fluxo separado), entao
-- os lancamentos manuais com tipovinculo='funcionario' deixam de ser
-- necessarios. Nao apaga nada (so ativo=false) e nao mexe nos pagamentos ja
-- registrados (pagos ou pendentes) desses lancamentos.
--
-- Verificado antes de escrever (node -e contra db/conexaoDB.js, banco local):
--   lancamentos com tipovinculo='funcionario' e ativo=true => 72 linhas
--   pagamentos desses lancamentos, por status => 54 'pago', 38 'pendente'
--   (os 38 pendentes somem da tela de Vencimentos ao inativar o lancamento,
--   pois GET /main/contas-pagar filtra por l.ativo=true - ciente e aceito)
--
-- WHERE ativo=true faz a migration ser idempotente (rodar de novo nao afeta
-- linhas ja inativadas nem lancamentos de funcionario criados/reativados
-- manualmente depois).

UPDATE lancamentos
SET ativo = false
WHERE tipovinculo = 'funcionario'
  AND ativo = true;
