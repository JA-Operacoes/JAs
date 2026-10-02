-- Migration: reverte_custodia_freelancer
-- Criada em: 2026-10-01T15:00:00.000Z
--
-- Reverte a 20261001_110000 (status com_freelancer + nome livre): descoberto que
-- "Freelancer" ja existe como perfil de verdade em funcionarioempresas (gente
-- cadastrada normalmente, so com vinculo diferente) -- nao precisa de um status
-- nem de colunas paralelas, o emprestimo pra freelancer passa a ser o mesmo
-- fluxo de funcionario (status 'com_funcionario', idfuncionario_atual), so com
-- a busca restrita a perfil='Freelancer' (ver routes/rotaTI.js).

ALTER TABLE equipunidadehistorico DROP COLUMN IF EXISTS nome_freelancer_origem;
ALTER TABLE equipunidadehistorico DROP COLUMN IF EXISTS nome_freelancer_destino;

ALTER TABLE equipamentounidade DROP COLUMN IF EXISTS nome_freelancer_atual;
ALTER TABLE equipamentounidade DROP CONSTRAINT IF EXISTS equipamentounidade_status_check;
ALTER TABLE equipamentounidade ADD CONSTRAINT equipamentounidade_status_check
  CHECK (status IN ('estoque', 'com_funcionario', 'manutencao', 'evento', 'baixado'));
