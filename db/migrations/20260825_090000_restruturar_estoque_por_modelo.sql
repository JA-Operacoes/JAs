-- Migration: restruturar_estoque_por_modelo
-- Criada em: 2026-08-25T09:00:00.000Z
--
-- O estoque/manutencao passa a ser controlado por marca+modelo (ex: Notebook/HP,
-- Notebook/Dell), nao pela categoria generica de equipamento usada em orcamentos.

ALTER TABLE equipamentos DROP COLUMN IF EXISTS qtdeestoque;
ALTER TABLE equipamentos DROP COLUMN IF EXISTS qtdeminima;
ALTER TABLE equipamentos DROP COLUMN IF EXISTS status;

-- equipamentos = categoria orcavel (ex: "Notebook"), como ja usado em orcamentoitens.
-- equipamentomodelo = unidade fisica real (ex: Notebook/HP/EliteBook), com estoque proprio.
CREATE TABLE IF NOT EXISTS equipamentomodelo (
    idmodelo SERIAL PRIMARY KEY,
    idequip INTEGER NOT NULL REFERENCES equipamentos(idequip),
    idempresa INTEGER NOT NULL,
    marca VARCHAR(100) NOT NULL,
    modelo VARCHAR(100),
    qtdeestoque INTEGER DEFAULT 0,
    qtdeminima INTEGER DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'disponivel' CHECK (status IN ('disponivel', 'manutencao', 'baixado')),
    criado_em TIMESTAMP DEFAULT NOW()
);

ALTER TABLE equipamentomovimentacao DROP COLUMN IF EXISTS idequip;
ALTER TABLE equipamentomovimentacao ADD COLUMN IF NOT EXISTS idmodelo INTEGER REFERENCES equipamentomodelo(idmodelo);

ALTER TABLE equipamentomanutencao DROP COLUMN IF EXISTS idequip;
ALTER TABLE equipamentomanutencao ADD COLUMN IF NOT EXISTS idmodelo INTEGER REFERENCES equipamentomodelo(idmodelo);
