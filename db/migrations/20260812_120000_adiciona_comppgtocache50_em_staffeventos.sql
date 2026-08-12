-- Migration: adiciona comppgtocache50 em staffeventos
-- Criada em: 2026-08-12T15:00:00.000Z
--
-- Escreva abaixo o SQL da mudanca de ESTRUTURA (uma migration = uma mudanca).
-- Roda dentro de uma transacao; se der erro, nada deste arquivo e aplicado.
-- Depois de escrever: 'npm run migrate' pra aplicar no seu banco local.
--
-- Cache (statuspgto) ganha o mesmo esquema de pagamento em 2 parcelas que a
-- Ajuda de Custo ja tem (Pago50 -> Pago). comppgtocache guarda o comprovante
-- da 1a parcela (50%) quando houver 2a parcela, ou o comprovante integral
-- quando o pagamento for direto em 100% (mesma logica do comppgtoajdcusto50
-- / comppgtoajdcusto para Ajuda de Custo).

ALTER TABLE staffeventos ADD COLUMN IF NOT EXISTS comppgtocache50 TEXT;
