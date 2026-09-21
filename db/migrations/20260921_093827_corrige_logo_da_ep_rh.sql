-- Migration: corrige_logo_da_ep_rh
-- Criada em: 2026-09-21T12:38:27.000Z
--
-- EP-RH (idempresa=2) estava com o logo da EP (uploads/logos_empresas/logo_2.png,
-- "EP | Engenharia & Projetos") — sobra de quando o ambiente foi criado copiando
-- dados da EP. Usuária mandou o logo correto ("RH | Engenharia & Projetos"), salvo
-- como uploads/logos_empresas/logo_2.jpeg (mesmo padrão automático de nome que a
-- rota de upload usa: logo_<idempresa>.ext — arquivo antigo removido).

UPDATE empresas SET logo = 'uploads/logos_empresas/logo_2.jpeg' WHERE idempresa = 2;
