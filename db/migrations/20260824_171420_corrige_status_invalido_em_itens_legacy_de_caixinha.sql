-- Migration: corrige status invalido em itens legacy de caixinha
-- Criada em: 2026-08-24T17:14:20.000Z
--
-- Escreva abaixo o SQL da mudanca de ESTRUTURA (uma migration = uma mudanca).
-- Roda dentro de uma transacao; se der erro, nada deste arquivo e aplicado.
-- Depois de escrever: 'npm run migrate' pra aplicar no seu banco local.

-- Corrige um bug de dados herdado da migration 20260818_145149 (backfill dos itens
-- "legacy-<idstaffevento>"): ela copiou a coluna antiga `statuscaixinha` direto pro
-- campo `status` do item, assumindo que sempre continha um valor de AUTORIZAÇÃO
-- (Pendente/Autorizado/Rejeitado). Só que em 13 registros bem antigos essa coluna na
-- verdade guardava um valor de PAGAMENTO ("Pago"/"Suspenso") — sobra de uma época
-- anterior à existência de statuspgtocaixinha. Resultado: 13 itens ficaram com
-- status="Pago"/"Suspenso" (inválido pra autorização) e, por consequência, a migration
-- de hoje (20260824_161051, que só promovia statuspgto quando status='Autorizado')
-- deixou o pagamento desses itens incorretamente como 'Pendente', mesmo a maioria
-- já tendo comprovante de pagamento anexado.
--
-- Fix: qualquer item com status fora do enum válido tinha, na verdade, um valor de
-- pagamento — status vira 'Autorizado' (só se paga o que foi autorizado) e statuspgto
-- recebe o valor original que estava (incorretamente) em status.
UPDATE staffeventos
SET caixinha = (
    SELECT jsonb_agg(
        CASE WHEN elem->>'status' NOT IN ('Pendente', 'Autorizado', 'Rejeitado')
             THEN elem || jsonb_build_object('status', 'Autorizado', 'statuspgto', elem->>'status')
             ELSE elem
        END
    )
    FROM jsonb_array_elements(caixinha) elem
)
WHERE jsonb_typeof(caixinha) = 'array'
  AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(caixinha) e
      WHERE e->>'status' NOT IN ('Pendente', 'Autorizado', 'Rejeitado')
  );
