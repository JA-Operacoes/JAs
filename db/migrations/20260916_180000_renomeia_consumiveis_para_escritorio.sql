-- Migration: renomeia_consumiveis_para_escritorio
-- Criada em: 2026-09-16T18:00:00.000Z
--
-- O local "Consumíveis" do almoxarifado geral passa a se chamar "Escritório"
-- (mais claro sobre o que é: consumíveis do escritório, em contraste com os do
-- pavilhão).

ALTER TABLE almoxarifadogeral DROP CONSTRAINT IF EXISTS almoxarifadogeral_local_check;

UPDATE almoxarifadogeral SET local = 'Escritório' WHERE local = 'Consumíveis';

ALTER TABLE almoxarifadogeral ALTER COLUMN local SET DEFAULT 'Escritório';
ALTER TABLE almoxarifadogeral
    ADD CONSTRAINT almoxarifadogeral_local_check
        CHECK (local IN ('Escritório', 'Consumíveis Pavilhão', 'Camisetas'));
