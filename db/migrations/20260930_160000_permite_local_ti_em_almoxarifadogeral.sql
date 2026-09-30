-- Migration: permite_local_ti_em_almoxarifadogeral
-- Criada em: 2026-09-30T19:00:00.000Z
--
-- Escreva abaixo o SQL da mudanca de ESTRUTURA (uma migration = uma mudanca).
-- Roda dentro de uma transacao; se der erro, nada deste arquivo e aplicado.
-- Depois de escrever: 'npm run migrate' pra aplicar no seu banco local.

-- TI passa a mandar lista de compra pelo MESMO fluxo de aprovação do
-- Almoxarifado Geral (almoxarifadopedido/almoxarifadopedidoitem, sem tabela
-- nova — ver rotaTI.js, seção "Compras (TI)"). No recebimento, item avulso
-- vira linha em almoxarifadogeral (routes/rotaAlmoxarifado.js, rota
-- .../receber) com `local = pedido.local` — sem essa permissão o CHECK
-- rejeita 'TI' e o recebimento quebra. Não mexe na tabela `almoxarifadoti`
-- (estoque manual do dia a dia do TI continua separado, sem relação com isso).
ALTER TABLE almoxarifadogeral DROP CONSTRAINT almoxarifadogeral_local_check;
ALTER TABLE almoxarifadogeral
ADD CONSTRAINT almoxarifadogeral_local_check
CHECK (local IN ('Escritório', 'Consumíveis Pavilhão', 'Camisetas', 'TI'));
