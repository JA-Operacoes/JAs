-- Migration: cria funcoes sql auxiliares de caixinha
-- Criada em: 2026-08-18T21:04:28.474Z
--
-- Escreva abaixo o SQL da mudanca de ESTRUTURA (uma migration = uma mudanca).
-- Roda dentro de uma transacao; se der erro, nada deste arquivo e aplicado.
-- Depois de escrever: 'npm run migrate' pra aplicar no seu banco local.

-- Toda query que precisa do "resumo" de uma caixinha (valor autorizado, status
-- agregado, se tem comprovante) repetia a mesma lógica jsonb_array_elements em
-- vários arquivos (rotaStaff.js, rotaMain.js, rotaRelatorio.js) — centraliza aqui.
CREATE OR REPLACE FUNCTION caixinha_valor_autorizado(itens jsonb)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(SUM((elem->>'valor')::numeric), 0)
  FROM jsonb_array_elements(COALESCE(itens, '[]'::jsonb)) elem
  WHERE elem->>'status' = 'Autorizado'
$$;

CREATE OR REPLACE FUNCTION caixinha_status_agregado(itens jsonb)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(itens,'[]'::jsonb)) e WHERE e->>'status' = 'Pendente')   THEN 'Pendente'
    WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(itens,'[]'::jsonb)) e WHERE e->>'status' = 'Autorizado') THEN 'Autorizado'
    WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(itens,'[]'::jsonb)) e WHERE e->>'status' = 'Rejeitado')  THEN 'Rejeitado'
    ELSE NULL
  END
$$;

CREATE OR REPLACE FUNCTION caixinha_tem_comprovante(itens jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(itens,'[]'::jsonb)) e
    WHERE e->>'comprovante' IS NOT NULL AND e->>'comprovante' <> ''
  )
$$;
