-- Migration: remove_areas_do_almoxarifado_geral
-- Criada em: 2026-09-16T16:00:00.000Z
--
-- A ideia de segmentar o almoxarifado geral por área (tabela almoxarea, coluna
-- idarea) acabou se mostrando desnecessária — volta a ser uma lista simples de
-- itens, sem setor/área, igual ao almoxarifado de TI.

ALTER TABLE almoxarifadogeral DROP COLUMN IF EXISTS idarea;
DROP TABLE IF EXISTS almoxarea;
