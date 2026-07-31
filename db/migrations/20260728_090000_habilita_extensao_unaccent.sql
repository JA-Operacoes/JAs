-- Migration: habilita extensao unaccent
-- Criada em: 2026-07-28T09:00:00.000Z
--
-- Usada na busca de funcionario por nome (GET /funcionarios?nome=) pra ignorar
-- acento (ex.: buscar "Marcia" tambem encontra "Márcia"). Extensao padrao do
-- Postgres (contrib), so precisa ser habilitada uma vez por banco.

CREATE EXTENSION IF NOT EXISTS unaccent;
