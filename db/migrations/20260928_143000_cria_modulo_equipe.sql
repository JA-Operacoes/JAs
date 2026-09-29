-- Migration: cria_modulo_equipe
-- Criada em: 2026-09-28T17:30:00.000Z
--
-- Equipes ganham tela própria (aba "Equipes" dentro do modal de Funções, na mesma
-- unificação que trouxe Categoria de Função pra lá). Duas coisas aqui:
--
-- 1) equipe/equipeempresas já existem no banco de produção, mas nunca passaram por
--    migration -- banco novo (teste/CI) subia sem elas e a aba quebraria. O IF NOT
--    EXISTS deixa a migration idempotente: em quem já tem, não faz nada.
--    nmequipe é UNIQUE global (não por empresa), então a rota trata "nome já existe
--    noutra empresa" vinculando a equipe existente em vez de duplicar.
--
-- 2) Módulo 'Equipe' em `modulos`, pra aparecer na tela de permissões e ter
--    cadastrar/alterar/pesquisar próprios -- separado de Funcao e Categoriafuncao.
--    Sem backfill de propósito: ninguém ganha a permissão automaticamente, ela é
--    marcada por usuário na tela de Usuários.

CREATE TABLE IF NOT EXISTS equipe (
    idequipe  SERIAL PRIMARY KEY,
    nmequipe  VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS equipeempresas (
    idequipe   INTEGER NOT NULL REFERENCES equipe(idequipe) ON DELETE CASCADE,
    idempresa  INTEGER NOT NULL REFERENCES empresas(idempresa) ON DELETE CASCADE,
    PRIMARY KEY (idequipe, idempresa)
);

INSERT INTO modulos (modulo)
SELECT 'Equipe'
WHERE NOT EXISTS (SELECT 1 FROM modulos WHERE LOWER(modulo) = 'equipe');
