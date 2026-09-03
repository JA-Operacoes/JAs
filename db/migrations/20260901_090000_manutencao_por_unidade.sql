ALTER TABLE equipamentomanutencao ADD COLUMN IF NOT EXISTS idunidade INTEGER REFERENCES equipamentounidade(idunidade);
