-- Migration: adiciona_urlindex_jd_e_joao
-- Criada em: 2026-09-18T19:01:01.200Z
--
-- JD e JOÃO tinham urlindex NULL, por isso não apareciam na barra "Trocar
-- empresa" mesmo já com ícone/permissão configurados (o filtro em Index.js
-- exige urlindex preenchido). Páginas próprias criadas (JD-index.html,
-- JOAO-index.html) — ver comentário em Roots.css sobre o JOÃO ter sido
-- pensado originalmente sem página própria; decisão revista a pedido da
-- usuária em 2026-09-18, ele passa a ser uma empresa normal.

UPDATE empresas SET urlindex = 'JD-index.html'   WHERE idempresa = 10; -- JD
UPDATE empresas SET urlindex = 'JOAO-index.html' WHERE idempresa = 9;  -- JOÃO
