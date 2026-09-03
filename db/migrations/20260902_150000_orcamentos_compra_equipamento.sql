CREATE TABLE IF NOT EXISTS equipamentoorcamentocompra (
    idorcamento SERIAL PRIMARY KEY,
    idequip INTEGER NOT NULL REFERENCES equipamentos(idequip),
    idempresa INTEGER NOT NULL,
    descricao TEXT,
    fornecedor VARCHAR(150),
    valor NUMERIC(12,2),
    arquivo TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'reprovado')),
    idusuario_solicitante INTEGER,
    idusuario_decisao INTEGER,
    data_decisao TIMESTAMP,
    motivo_recusa TEXT,
    token_aprovacao TEXT UNIQUE,
    enviado_email_em TIMESTAMP,
    criado_em TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_equipamentoorcamentocompra_status ON equipamentoorcamentocompra (idempresa, status);
