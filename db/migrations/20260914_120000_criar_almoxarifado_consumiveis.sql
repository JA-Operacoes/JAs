-- Migration: criar_almoxarifado_consumiveis
-- Criada em: 2026-09-14T12:00:00.000Z
--
-- Almoxarifado de itens consumíveis do TI (ribbon, etiqueta, papel A4, tinta etc):
-- diferente de equipamentounidade (unidades únicas com patrimônio), aqui é só
-- quantidade — item vai sendo consumido e precisa ser reposto de tempos em tempos.

CREATE TABLE IF NOT EXISTS almoxarifadoti (
    idconsumivel SERIAL PRIMARY KEY,
    idempresa INTEGER NOT NULL,
    descricao VARCHAR(120) NOT NULL,
    unidade_medida VARCHAR(20) NOT NULL DEFAULT 'unidade',
    quantidade_atual INTEGER NOT NULL DEFAULT 0 CHECK (quantidade_atual >= 0),
    estoque_minimo INTEGER NOT NULL DEFAULT 0 CHECK (estoque_minimo >= 0),
    idusuario INTEGER,
    criado_em TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS almoxarifadotihistorico (
    idmovimentacao SERIAL PRIMARY KEY,
    idconsumivel INTEGER NOT NULL REFERENCES almoxarifadoti(idconsumivel),
    tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('entrada', 'saida')),
    quantidade INTEGER NOT NULL CHECK (quantidade > 0),
    motivo VARCHAR(255),
    idusuario INTEGER,
    criado_em TIMESTAMP DEFAULT NOW()
);
