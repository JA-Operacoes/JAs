-- Migration: modelos_e_complementos_equipamentos
-- Criada em: 2026-08-25T17:27:37.937Z
--
-- Modelos (marca/modelo/estoque) e complementos (itens acessorios, ex:
-- Notebook -> Mouse/Mousepad/Carregador) passam a viver como JSONB direto
-- em equipamentos, no lugar da tabela relacional equipamentomodelo.

ALTER TABLE equipamentos ADD COLUMN IF NOT EXISTS modelos JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE equipamentos ADD COLUMN IF NOT EXISTS complementos JSONB NOT NULL DEFAULT '[]'::jsonb;

-- movimentacao/manutencao perdem o FK para equipamentomodelo (tabela removida)
-- e passam a guardar idequip (FK real) + idmodelo (texto = id do objeto no JSONB)
ALTER TABLE equipamentomovimentacao DROP COLUMN IF EXISTS idmodelo;
ALTER TABLE equipamentomovimentacao ADD COLUMN idequip INTEGER REFERENCES equipamentos(idequip);
ALTER TABLE equipamentomovimentacao ADD COLUMN idmodelo TEXT;

ALTER TABLE equipamentomanutencao DROP COLUMN IF EXISTS idmodelo;
ALTER TABLE equipamentomanutencao ADD COLUMN idequip INTEGER REFERENCES equipamentos(idequip);
ALTER TABLE equipamentomanutencao ADD COLUMN idmodelo TEXT;

ALTER TABLE equipamentopredestinacao DROP CONSTRAINT IF EXISTS equipamentopredestinacao_idmodelo_fkey;
ALTER TABLE equipamentopredestinacao ALTER COLUMN idmodelo TYPE TEXT USING idmodelo::text;

DROP TABLE IF EXISTS equipamentomodelo;
