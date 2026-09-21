-- Migration: adiciona_tema_no_usuario
-- Criada em: 2026-09-16T20:00:00.000Z
--
-- Preferência de modo claro/escuro por usuário (não por navegador): quem trabalha
-- em mais de uma máquina — escritório e pavilhão, por exemplo — encontra o sistema
-- do mesmo jeito em qualquer login. O localStorage continua sendo usado no front,
-- mas só como cache pra pintar a tela antes da resposta do servidor (anti-flash).
--
-- Default 'light' porque é como o sistema é hoje: ninguém tem o tema trocado sem pedir.

ALTER TABLE usuarios
    ADD COLUMN IF NOT EXISTS tema VARCHAR(5) NOT NULL DEFAULT 'light'
        CHECK (tema IN ('light', 'dark'));
