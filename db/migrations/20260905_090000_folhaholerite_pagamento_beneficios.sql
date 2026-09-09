-- Migration: folhaholerite_pagamento_beneficios
-- Criada em: 2026-09-05T12:00:00.000Z
--
-- Escreva abaixo o SQL da mudanca de ESTRUTURA (uma migration = uma mudanca).
-- Roda dentro de uma transacao; se der erro, nada deste arquivo e aplicado.
-- Depois de escrever: 'npm run migrate' pra aplicar no seu banco local.
--
-- RH > Holerite Virtual / Financeiro: beneficios (VA/VT) agora aparecem como linha propria em
-- Contas a Pagar, com vencimento no ultimo dia util do mes (diferente do salario, que vence
-- dia 5 do mes seguinte) -- ver PUT /rh/holerite/:id/pagar-beneficios em rotaRH.js. Precisam de
-- status/data de pagamento PROPRIOS, separados de status/dtpagamento (que continuam sendo so
-- do salario), porque sao pagos em datas e por meios diferentes (boleto de bilhete unico x
-- pix/cartao ticket).
ALTER TABLE folhaholerite ADD COLUMN IF NOT EXISTS status_beneficios VARCHAR(20) NOT NULL DEFAULT 'Pendente';
ALTER TABLE folhaholerite ADD COLUMN IF NOT EXISTS dtpagamento_beneficios DATE;
