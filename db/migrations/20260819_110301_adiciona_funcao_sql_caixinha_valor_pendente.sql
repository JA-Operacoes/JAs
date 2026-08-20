-- Migration: adiciona funcao sql caixinha_valor_pendente
-- Criada em: 2026-08-19T11:03:01.000Z
--
-- Escreva abaixo o SQL da mudanca de ESTRUTURA (uma migration = uma mudanca).
-- Roda dentro de uma transacao; se der erro, nada deste arquivo e aplicado.
-- Depois de escrever: 'npm run migrate' pra aplicar no seu banco local.

-- Complementa caixinha_valor_autorizado (mesma família de funções, ver
-- 20260818_180428_cria_funcoes_sql_auxiliares_de_caixinha.sql) — usada nos
-- relatórios pra mostrar o valor ainda pendente de autorização separado do
-- valor já autorizado, em vez de só o total autorizado.
CREATE OR REPLACE FUNCTION caixinha_valor_pendente(itens jsonb)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(SUM((elem->>'valor')::numeric), 0)
  FROM jsonb_array_elements(COALESCE(itens, '[]'::jsonb)) elem
  WHERE elem->>'status' = 'Pendente'
$$;
