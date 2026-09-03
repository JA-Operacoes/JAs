ALTER TABLE equipamentomanutencao ADD COLUMN IF NOT EXISTS orcamento_realizado BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE equipamentomanutencao ADD COLUMN IF NOT EXISTS orcamento_obs TEXT;
