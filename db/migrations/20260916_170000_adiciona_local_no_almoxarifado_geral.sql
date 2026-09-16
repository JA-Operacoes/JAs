-- Migration: adiciona_local_no_almoxarifado_geral
-- Criada em: 2026-09-16T17:00:00.000Z
--
-- Em vez de área cadastrável (removida na migration anterior), o almoxarifado
-- geral passa a ter locais fixos pré-definidos, viram abas na tela: itens
-- consumíveis (escritório), consumíveis do pavilhão, e camisetas.

ALTER TABLE almoxarifadogeral
    ADD COLUMN IF NOT EXISTS local VARCHAR(40) NOT NULL DEFAULT 'Consumíveis'
        CHECK (local IN ('Consumíveis', 'Consumíveis Pavilhão', 'Camisetas'));
