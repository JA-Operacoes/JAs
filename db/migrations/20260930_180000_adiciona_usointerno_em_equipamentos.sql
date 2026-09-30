-- Migration: adiciona_usointerno_em_equipamentos
-- Criada em: 2026-09-30T21:00:00.000Z
--
-- Alguns equipamentos cadastrados ficam de uso fixo de funcionarios internos
-- (ex: notebook administrativo) e nunca devem aparecer como opcao ao montar
-- o orcamento de um evento. `usointerno` marca esse tipo; o filtro entra em
-- GET /orcamentos/equipamentos (routes/rotaOrcamento.js) -- o cadastro e o
-- Estoque do TI Mode continuam listando tudo normalmente.
ALTER TABLE equipamentos ADD COLUMN IF NOT EXISTS usointerno BOOLEAN NOT NULL DEFAULT false;
