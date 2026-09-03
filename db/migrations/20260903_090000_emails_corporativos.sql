CREATE TABLE IF NOT EXISTS tiarea (
    idarea SERIAL PRIMARY KEY,
    idempresa INTEGER NOT NULL,
    nome VARCHAR(100) NOT NULL,
    criado_em TIMESTAMP DEFAULT NOW(),
    UNIQUE (idempresa, nome)
);

CREATE TABLE IF NOT EXISTS tiemailcorporativo (
    idemail SERIAL PRIMARY KEY,
    idempresa INTEGER NOT NULL,
    idfuncionario INTEGER NOT NULL REFERENCES funcionarios(idfuncionario),
    idarea INTEGER NOT NULL REFERENCES tiarea(idarea),
    email VARCHAR(150) NOT NULL,
    senha_cifrada TEXT NOT NULL,
    idusuario_cadastro INTEGER,
    criado_em TIMESTAMP DEFAULT NOW(),
    atualizado_em TIMESTAMP DEFAULT NOW(),
    UNIQUE (idempresa, email)
);

CREATE INDEX IF NOT EXISTS idx_tiemailcorporativo_area ON tiemailcorporativo (idempresa, idarea);
CREATE INDEX IF NOT EXISTS idx_tiemailcorporativo_funcionario ON tiemailcorporativo (idfuncionario);
