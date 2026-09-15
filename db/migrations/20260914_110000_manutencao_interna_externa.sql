-- Migration: manutencao_interna_externa
-- Criada em: 2026-09-14T11:00:00.000Z
--
-- Algumas manutenções são feitas dentro do próprio escritório (interna) e
-- outras precisam ir pra assistência técnica (externa) — antes não dava pra
-- diferenciar isso na fila de manutenção.

ALTER TABLE equipamentomanutencao
    ADD COLUMN IF NOT EXISTS tipo_manutencao VARCHAR(10) NOT NULL DEFAULT 'externa'
        CHECK (tipo_manutencao IN ('interna', 'externa'));
