-- Migration: criar_unidades_e_custodia_equipamentos
-- Criada em: 2026-08-26T09:00:00.000Z
--
-- Cada modelo (marca/modelo, dentro do JSONB equipamentos.modelos) passa a
-- ter unidades fisicas individuais com patrimonio, cada uma com seu status
-- e dono atual (funcionario). Permite entrega/devolucao/transferencia entre
-- funcionarios e envio/retorno de evento, com historico completo.

CREATE TABLE IF NOT EXISTS equipamentounidade (
    idunidade SERIAL PRIMARY KEY,
    idequip INTEGER NOT NULL REFERENCES equipamentos(idequip),
    idmodelo TEXT NOT NULL,
    idempresa INTEGER NOT NULL,
    patrimonio VARCHAR(60) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'estoque'
        CHECK (status IN ('estoque', 'com_funcionario', 'manutencao', 'evento', 'baixado')),
    idfuncionario_atual INTEGER REFERENCES funcionarios(idfuncionario),
    idevento_atual INTEGER REFERENCES eventos(idevento),
    criado_em TIMESTAMP DEFAULT NOW(),
    UNIQUE (idempresa, patrimonio)
);

CREATE TABLE IF NOT EXISTS equipamentocustodiahistorico (
    idhistorico SERIAL PRIMARY KEY,
    idunidade INTEGER NOT NULL REFERENCES equipamentounidade(idunidade),
    tipo VARCHAR(20) NOT NULL
        CHECK (tipo IN ('entrega', 'devolucao', 'transferencia', 'envio_evento', 'retorno_evento')),
    idfuncionario_origem INTEGER REFERENCES funcionarios(idfuncionario),
    idfuncionario_destino INTEGER REFERENCES funcionarios(idfuncionario),
    idevento INTEGER REFERENCES eventos(idevento),
    observacao VARCHAR(255),
    idusuario INTEGER,
    criado_em TIMESTAMP DEFAULT NOW()
);
