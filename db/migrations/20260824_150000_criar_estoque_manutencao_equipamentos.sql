-- Migration: criar_estoque_manutencao_equipamentos
-- Criada em: 2026-08-24T15:00:00.000Z
--
-- Estende 'equipamentos' com controle de estoque/status e cria tabelas de
-- movimentacao (entrada/saida) e fila de manutencao para o modulo TI Mode.

ALTER TABLE equipamentos ADD COLUMN IF NOT EXISTS qtdeestoque INTEGER DEFAULT 0;
ALTER TABLE equipamentos ADD COLUMN IF NOT EXISTS qtdeminima INTEGER DEFAULT 0;
ALTER TABLE equipamentos ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'disponivel';

CREATE TABLE IF NOT EXISTS equipamentomovimentacao (
    idmovimentacao SERIAL PRIMARY KEY,
    idequip INTEGER NOT NULL REFERENCES equipamentos(idequip),
    idempresa INTEGER NOT NULL,
    tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('entrada', 'saida')),
    quantidade INTEGER NOT NULL CHECK (quantidade > 0),
    motivo VARCHAR(255),
    idusuario INTEGER,
    criado_em TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS equipamentomanutencao (
    idmanutencao SERIAL PRIMARY KEY,
    idequip INTEGER NOT NULL REFERENCES equipamentos(idequip),
    idempresa INTEGER NOT NULL,
    descricaoproblema TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'aguardando' CHECK (status IN ('aguardando', 'em_andamento', 'concluida')),
    data_entrada TIMESTAMP DEFAULT NOW(),
    data_conclusao TIMESTAMP,
    observacoes TEXT,
    idusuario INTEGER
);
