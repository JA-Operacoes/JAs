-- Migration: cria pagina EP-RH e migra orcamentos e staff para EP
-- Criada em: 2026-09-17T20:57:18.000Z
--
-- Continuação do plano de ambiente duplo EP/EP-RH (ver memória
-- project_ep_ep_rh_ambiente_duplo, discutido em 2026-09-15): idempresa=2 já
-- tinha sido renomeada de "EP" pra "EP-RH" (mantém RH/holerite, que não se
-- mexe aqui), e idempresa=15 é a "EP Engenharia" nova (mesmo CNPJ), que passa
-- a ser dona dos orçamentos/staff daqui pra frente. Essa migration completa a
-- separação: dá página própria pra EP-RH (public/EPRH-index.html) e move os
-- registros de orçamento/staff que ainda estavam em idempresa=2 (de antes da
-- separação) pra idempresa=15.
--
-- Verificado antes de escrever (node -e contra db/conexaoDB.js, banco local):
--   orcamentoempresas WHERE idempresa=2 → 2 linhas (0 em idempresa=15)
--   staffempresas     WHERE idempresa=2 → 1 linha  (0 em idempresa=15)
--   funcionarioempresas WHERE idempresa=2 → 50 linhas (fica em EP-RH, não mexe)
--   folhaholerite       WHERE idempresa=2 → 518 linhas (fica em EP-RH, não mexe)
--   staffeventos não tem idempresa direto — a empresa vem via orcamentoempresas,
--   então migrar as 2 linhas de orcamentoempresas já move o staff vinculado junto.

UPDATE empresas SET urlindex = 'EPRH-index.html' WHERE idempresa = 2;

UPDATE orcamentoempresas SET idempresa = 15 WHERE idempresa = 2;
UPDATE staffempresas     SET idempresa = 15 WHERE idempresa = 2;
