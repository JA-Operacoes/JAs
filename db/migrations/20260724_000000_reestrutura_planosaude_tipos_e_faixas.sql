-- Migration: planosaude-tipos-e-faixas
-- Criada em: 2026-07-24
--
-- Escreva abaixo o SQL da mudanca de ESTRUTURA (uma migration = uma mudanca).
-- Roda dentro de uma transacao; se der erro, nada deste arquivo e aplicado.
-- Depois de escrever: 'npm run migrate' pra aplicar no seu banco local.

-- Substitui o modelo antigo (tabela unica planosaude com tipos em jsonb[]) por
-- um modelo relacional em 2 tabelas:
--   tipoplanosaude  -> cada tipo de um plano (o nome do plano repete entre os tipos)
--   faixasplanosaude -> faixas etarias (de/ate) e valor de cada tipo

CREATE TABLE IF NOT EXISTS tipoplanosaude (
    idtipoplanosaude SERIAL PRIMARY KEY,
    idempresa        INTEGER NOT NULL,
    nomeplano        VARCHAR(150) NOT NULL,   -- repete entre os tipos do mesmo plano
    nometipo         VARCHAR(150) NOT NULL,   -- ex: Enfermaria, Apartamento
    ativo            BOOLEAN NOT NULL DEFAULT true,
    criadoem         TIMESTAMP NOT NULL DEFAULT now(),
    atualizadoem     TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS faixasplanosaude (
    idfaixaplano     SERIAL PRIMARY KEY,
    idtipoplanosaude INTEGER NOT NULL
        REFERENCES tipoplanosaude (idtipoplanosaude) ON DELETE CASCADE,
    de               INTEGER,               -- idade inicial da faixa
    ate              INTEGER,               -- idade final; null = idade em diante
    valor            NUMERIC(10,2) NOT NULL
);

-- Acelera a montagem de um plano (agrupar tipos por nome) e o join das faixas.
CREATE INDEX IF NOT EXISTS ix_tipoplanosaude_empresa_plano
    ON tipoplanosaude (idempresa, lower(nomeplano));
CREATE INDEX IF NOT EXISTS ix_faixasplanosaude_tipo
    ON faixasplanosaude (idtipoplanosaude);
