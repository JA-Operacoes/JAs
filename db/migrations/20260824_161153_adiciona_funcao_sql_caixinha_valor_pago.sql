-- Migration: adiciona funcao sql caixinha_valor_pago
-- Criada em: 2026-08-24T16:11:53.000Z
--
-- Escreva abaixo o SQL da mudanca de ESTRUTURA (uma migration = uma mudanca).
-- Roda dentro de uma transacao; se der erro, nada deste arquivo e aplicado.
-- Depois de escrever: 'npm run migrate' pra aplicar no seu banco local.

-- Complementa caixinha_valor_autorizado/caixinha_valor_pendente (mesma família
-- de funções, ver 20260818_180428_cria_funcoes_sql_auxiliares_de_caixinha.sql e
-- 20260819_110301_adiciona_funcao_sql_caixinha_valor_pendente.sql) — soma o
-- valor dos itens já Autorizado E efetivamente Pago (statuspgto por item,
-- substitui a antiga flag única statuspgtocaixinha do registro inteiro).
CREATE OR REPLACE FUNCTION caixinha_valor_pago(itens jsonb)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(SUM((elem->>'valor')::numeric), 0)
  FROM jsonb_array_elements(COALESCE(itens, '[]'::jsonb)) elem
  WHERE elem->>'status' = 'Autorizado' AND elem->>'statuspgto' = 'Pago'
$$;