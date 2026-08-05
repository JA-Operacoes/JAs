-- Migration: adiciona visualizacao em staffajustefinanceiro
-- Criada em: 2026-08-04T19:57:53.115Z
--
-- Escreva abaixo o SQL da mudanca de ESTRUTURA (uma migration = uma mudanca).
-- Roda dentro de uma transacao; se der erro, nada deste arquivo e aplicado.
-- Depois de escrever: 'npm run migrate' pra aplicar no seu banco local.
--
-- Permite "dispensar" a notificacao de um ajuste financeiro automatico no card de Pedidos
-- sem mexer no status do lancamento em si (que so muda quando o financeiro efetivamente
-- processa o pagamento na tela de Vencimentos). Distinto de status: um ajuste pode estar
-- Pendente E ja visualizado (usuario clicou "Lido"), ou Pendente e ainda nao visualizado
-- (aparece como notificacao nova).

ALTER TABLE staffajustefinanceiro ADD COLUMN IF NOT EXISTS idusuariovisualizacao INTEGER REFERENCES usuarios(idusuario);
ALTER TABLE staffajustefinanceiro ADD COLUMN IF NOT EXISTS dtvisualizacao TIMESTAMP;
