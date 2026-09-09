-- Migration: criar_predestinacao_equipamentos
-- Criada em: 2026-08-24T16:00:00.000Z
--
-- Permite definir, antes do fim do evento, o destino de equipamentos
-- alocados (outro evento, destino livre em texto, ou volta pro estoque).
-- idmodelo identifica de qual marca/modelo especifico a unidade sai/entra
-- quando o destino for 'estoque' (a quantidade orcada em si e por categoria,
-- o orcamento nao sabe marca).

CREATE TABLE IF NOT EXISTS equipamentopredestinacao (
    idpredestinacao SERIAL PRIMARY KEY,
    idequip INTEGER NOT NULL REFERENCES equipamentos(idequip),
    idmodelo INTEGER REFERENCES equipamentomodelo(idmodelo),
    idempresa INTEGER NOT NULL,
    idevento_origem INTEGER NOT NULL REFERENCES eventos(idevento),
    idorcamento_origem INTEGER REFERENCES orcamentos(idorcamento),
    quantidade INTEGER NOT NULL CHECK (quantidade > 0),
    tipo_destino VARCHAR(10) NOT NULL CHECK (tipo_destino IN ('estoque', 'evento', 'livre')),
    idevento_destino INTEGER REFERENCES eventos(idevento),
    destino_livre VARCHAR(255),
    observacao VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'executada', 'cancelada')),
    idusuario INTEGER,
    criado_em TIMESTAMP DEFAULT NOW(),
    executado_em TIMESTAMP
);
