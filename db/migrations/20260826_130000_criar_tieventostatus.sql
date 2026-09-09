-- Migration: criar_tieventostatus
-- Criada em: 2026-08-26T13:00:00.000Z
--
-- Status de controle da equipe de TI sobre o evento (independente do status
-- do orcamento): confirmado/incerto/cancelado, e flag de equipamentos ja
-- separados para o evento.

CREATE TABLE IF NOT EXISTS tieventostatus (
    idevento INTEGER NOT NULL REFERENCES eventos(idevento),
    idempresa INTEGER NOT NULL,
    status_controle VARCHAR(20) NOT NULL DEFAULT 'incerto'
        CHECK (status_controle IN ('confirmado', 'incerto', 'cancelado')),
    separado BOOLEAN NOT NULL DEFAULT FALSE,
    separado_em TIMESTAMP,
    separado_por INTEGER,
    atualizado_em TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (idevento, idempresa)
);
