-- Migration: criar_almoxarifado_geral
-- Criada em: 2026-09-16T09:00:00.000Z
--
-- Almoxarifado geral: mesmo modelo do almoxarifadoti (itens consumíveis, só
-- quantidade — vai sendo consumido e precisa ser reposto), mas para qualquer
-- setor da empresa, não só TI. Por isso o campo `setor` a mais (Ex: TI, Limpeza,
-- Escritório, Eventos...) pra segmentar a listagem.

CREATE TABLE IF NOT EXISTS almoxarifadogeral (
    iditem SERIAL PRIMARY KEY,
    idempresa INTEGER NOT NULL,
    setor VARCHAR(60) NOT NULL DEFAULT 'Geral',
    descricao VARCHAR(120) NOT NULL,
    unidade_medida VARCHAR(20) NOT NULL DEFAULT 'unidade',
    quantidade_atual INTEGER NOT NULL DEFAULT 0 CHECK (quantidade_atual >= 0),
    estoque_minimo INTEGER NOT NULL DEFAULT 0 CHECK (estoque_minimo >= 0),
    idusuario INTEGER,
    criado_em TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS almoxarifadogeralhistorico (
    idmovimentacao SERIAL PRIMARY KEY,
    iditem INTEGER NOT NULL REFERENCES almoxarifadogeral(iditem),
    tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('entrada', 'saida')),
    quantidade INTEGER NOT NULL CHECK (quantidade > 0),
    motivo VARCHAR(255),
    idusuario INTEGER,
    idfuncionario_solicitante INTEGER REFERENCES funcionarios(idfuncionario),
    criado_em TIMESTAMP DEFAULT NOW()
);



-- Cadastra o módulo no grid de permissões (mesmo mecanismo do POST /modulo), pra
-- já aparecer disponível pra liberar acesso aos usuários sem passo manual extra.
INSERT INTO modulos (modulo)
SELECT 'Almoxarifado'
WHERE NOT EXISTS (SELECT 1 FROM modulos WHERE LOWER(modulo) = 'almoxarifado');
