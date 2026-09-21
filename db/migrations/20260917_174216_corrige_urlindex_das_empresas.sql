-- Migration: corrige urlindex das empresas
-- Criada em: 2026-09-17T20:42:16.000Z
--
-- "urlindex" já existia mas estava incompleta/desatualizada — necessário
-- corrigir agora porque a barra "Trocar empresa" (topo de cada *-index.html)
-- vai passar a ser montada dinamicamente a partir dela, em vez de HTML
-- estático com um <a href="XXX-index.html"> por empresa.
--
-- Verificado antes de escrever (node -e contra db/conexaoDB.js, banco local):
--   SELECT idempresa, nmfantasia, urlindex FROM empresas ORDER BY idempresa
--   → ED(12), TSD(13), ES(14) e EP(15) estavam com urlindex NULL, mesmo tendo
--   página própria confirmada em public/ (ED-index.html, TSD-index.html,
--   ES-index.html, EP-index.html existem). EP-RH(2) apontava pra
--   'EP-index.html' — resquício de antes da empresa ser renomeada de "EP"
--   pra "EP-RH" (a real "EP" hoje é a linha 15, cadastrada depois); EP-RH não
--   tem página própria (faz parte do plano futuro, ainda pausado, de ambiente
--   duplo EP/EP-RH), então fica NULL de propósito.

UPDATE empresas SET urlindex = 'ED-index.html'  WHERE idempresa = 12; -- ED
UPDATE empresas SET urlindex = 'TSD-index.html' WHERE idempresa = 13; -- TSD
UPDATE empresas SET urlindex = 'ES-index.html'  WHERE idempresa = 14; -- ES
UPDATE empresas SET urlindex = 'EP-index.html'  WHERE idempresa = 15; -- EP (real)
UPDATE empresas SET urlindex = NULL             WHERE idempresa = 2;  -- EP-RH (resquício, sem página própria ainda)
