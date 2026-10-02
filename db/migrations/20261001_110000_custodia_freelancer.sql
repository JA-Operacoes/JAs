-- Migration: custodia_freelancer
-- Criada em: 2026-10-01T14:00:00.000Z
--
-- Alocacao (custodia) do TI Mode passa a aceitar emprestimo pra freelancer --
-- alguem sem cadastro formal no sistema, so um nome digitado na hora. Sem
-- tabela nova (decisao: nao vincular em `staff`), so um status novo + colunas
-- de texto livre paralelas as de funcionario (idfuncionario_atual).

ALTER TABLE equipamentounidade DROP CONSTRAINT IF EXISTS equipamentounidade_status_check;
ALTER TABLE equipamentounidade ADD CONSTRAINT equipamentounidade_status_check
  CHECK (status IN ('estoque', 'com_funcionario', 'com_freelancer', 'manutencao', 'evento', 'baixado'));
ALTER TABLE equipamentounidade ADD COLUMN IF NOT EXISTS nome_freelancer_atual TEXT;

ALTER TABLE equipunidadehistorico ADD COLUMN IF NOT EXISTS nome_freelancer_origem TEXT;
ALTER TABLE equipunidadehistorico ADD COLUMN IF NOT EXISTS nome_freelancer_destino TEXT;
