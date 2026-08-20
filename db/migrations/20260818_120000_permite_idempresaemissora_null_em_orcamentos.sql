-- Migration: garante que idempresaemissora em orcamentos aceite NULL
--
-- Empresa Emissora deixou de ser obrigatoria ao salvar o orcamento — agora
-- so e exigida na hora de gerar a proposta (validado no frontend/backend
-- daquela rota, nao no INSERT/UPDATE do orcamento).

ALTER TABLE orcamentos
  ALTER COLUMN idempresaemissora DROP NOT NULL;
