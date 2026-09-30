-- Migration: adiciona_idevento_em_almoxarifadopedido
-- Criada em: 2026-09-30T13:00:00.000Z
--
-- Escreva abaixo o SQL da mudanca de ESTRUTURA (uma migration = uma mudanca).
-- Roda dentro de uma transacao; se der erro, nada deste arquivo e aplicado.
-- Depois de escrever: 'npm run migrate' pra aplicar no seu banco local.

-- Pedido de compra do local "Consumíveis Pavilhão" precisa dizer PRA QUAL
-- evento é a compra (consumo de pavilhão é sempre por evento) — os demais
-- locais (Escritório, Camisetas) não usam essa coluna, por isso fica opcional.
ALTER TABLE almoxarifadopedido
ADD COLUMN IF NOT EXISTS idevento INTEGER REFERENCES eventos(idevento);

CREATE INDEX IF NOT EXISTS idx_almoxpedido_evento ON almoxarifadopedido (idevento);
