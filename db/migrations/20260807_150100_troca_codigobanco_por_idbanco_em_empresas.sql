-- Migration: troca codigobanco (texto livre) por idbanco (FK) em empresas
--
-- codigobanco (VARCHAR) foi adicionado ha poucas horas (migration
-- 20260807_150000) mas ainda esta vazio em todas as empresas -- seguro
-- trocar direto em vez de manter as duas colunas. Ja existe cadastro de
-- Bancos (tabela bancos) usado no financeiro, entao faz mais sentido
-- referenciar de la (idbanco) do que deixar o usuario digitar o codigo do
-- banco a mao de novo (risco de erro de digitacao, e nome do banco nao
-- aparece em lugar nenhum).

ALTER TABLE empresas ADD COLUMN IF NOT EXISTS idbanco INTEGER REFERENCES bancos(idbanco);
ALTER TABLE empresas DROP COLUMN IF EXISTS codigobanco;
