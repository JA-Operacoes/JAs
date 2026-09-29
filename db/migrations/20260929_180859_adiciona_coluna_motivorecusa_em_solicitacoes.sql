-- Migration: adiciona coluna motivorecusa em solicitacoes
-- Criada em: 2026-09-29T18:08:59.000Z
--
-- Escreva abaixo o SQL da mudanca de ESTRUTURA (uma migration = uma mudanca).
-- Roda dentro de uma transacao; se der erro, nada deste arquivo e aplicado.
-- Depois de escrever: 'npm run migrate' pra aplicar no seu banco local.

-- Justificativa da RECUSA de uma solicitacao (Pedidos > Rejeitar), digitada pelo
-- aprovador no momento da rejeicao. Separada de `justificativa` porque essa coluna
-- ja guarda a justificativa ORIGINAL do pedido (e textos de cascata automatica),
-- entao nao da pra reaproveitar sem sobrescrever/misturar as duas informacoes.
ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS motivorecusa TEXT;
