-- Migration: cria-tabela-planosaude
-- Criada em: 2026-07-23
--
-- Escreva abaixo o SQL da mudanca de ESTRUTURA (uma migration = uma mudanca).
-- Roda dentro de uma transacao; se der erro, nada deste arquivo e aplicado.
-- Depois de escrever: 'npm run migrate' pra aplicar no seu banco local.

-- Um plano de saude por linha. Os tipos (Enfermaria, Apartamento, ...) e suas
-- faixas de valor por idade ficam num unico campo `tipos` do tipo JSONB[]
-- (array de objetos jsonb), evitando tabelas separadas de tipos/faixas.
--
-- Formato de cada elemento de `tipos`:
--   { "nome": "Enfermaria",
--     "faixas": [ { "de": 0, "ate": 18, "valor": 120.5 },
--                 { "de": 19, "ate": null, "valor": 250.0 } ] }
CREATE TABLE IF NOT EXISTS planosaude (
    idplanosaude SERIAL PRIMARY KEY,
    idempresa    INTEGER NOT NULL,
    nome         VARCHAR(150) NOT NULL,
    tipos        JSONB[] NOT NULL DEFAULT '{}',
    criadoem     TIMESTAMP NOT NULL DEFAULT now(),
    atualizadoem TIMESTAMP NOT NULL DEFAULT now(),
    ativo BOOLEAN NOT NULL DEFAULT true
);

-- Evita nome de plano repetido dentro da mesma empresa (case-insensitive).
CREATE UNIQUE INDEX IF NOT EXISTS ux_planosaude_empresa_nome
    ON planosaude (idempresa, lower(nome));
