-- Migration: adiciona_foto_no_almoxarifado_geral
-- Criada em: 2026-09-16T19:00:00.000Z
--
-- Foto do item (mesmo padrão de empresas.logo): guarda o caminho relativo do
-- arquivo em uploads/almoxarifado, servido estaticamente em /uploads.

ALTER TABLE almoxarifadogeral ADD COLUMN IF NOT EXISTS foto VARCHAR(255);
