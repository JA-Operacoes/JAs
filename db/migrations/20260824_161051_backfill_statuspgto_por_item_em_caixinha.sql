-- Migration: backfill statuspgto por item em caixinha
-- Criada em: 2026-08-24T16:10:51.000Z
--
-- Escreva abaixo o SQL da mudanca de ESTRUTURA (uma migration = uma mudanca).
-- Roda dentro de uma transacao; se der erro, nada deste arquivo e aplicado.
-- Depois de escrever: 'npm run migrate' pra aplicar no seu banco local.

-- Pagamento de caixinha deixa de ser UMA flag por registro (statuspgtocaixinha)
-- e passa a ser POR ITEM (campo `statuspgto` dentro de cada elemento do array
-- `caixinha`) — sem isso, pagar 1 item autorizado marcava o registro inteiro
-- como Pago e liberava indevidamente ações (ex.: upload de comprovante) nos
-- itens ainda Pendente do mesmo registro.
--
-- Este backfill aplica o valor antigo de statuspgtocaixinha (congelado a partir
-- de agora, não é mais escrito) nos itens já Autorizado — é neles que o
-- pagamento fazia sentido. Itens Pendente/Rejeitado ganham 'Pendente'.
-- Pago50 não existe pra caixinha (sem pagamento parcial) e vira 'Pago'.
UPDATE staffeventos
SET caixinha = (
  SELECT jsonb_agg(
    CASE WHEN elem->>'status' = 'Autorizado'
         THEN elem || jsonb_build_object('statuspgto',
           CASE
             WHEN statuspgtocaixinha ILIKE 'pago%' THEN 'Pago'
             WHEN statuspgtocaixinha = 'Suspenso'  THEN 'Suspenso'
             ELSE 'Pendente'
           END)
         ELSE elem || jsonb_build_object('statuspgto', 'Pendente')
    END
  )
  FROM jsonb_array_elements(caixinha) elem
)
WHERE jsonb_typeof(caixinha) = 'array' AND jsonb_array_length(caixinha) > 0;