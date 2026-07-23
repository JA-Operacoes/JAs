-- Migration: adiciona coluna obslogsistema em staffeventos e migra dados de obsgeral
-- Criada em: 2026-07-17T19:16:13.520Z
--
-- Escreva abaixo o SQL da mudanca de ESTRUTURA (uma migration = uma mudanca).
-- Roda dentro de uma transacao; se der erro, nada deste arquivo e aplicado.
-- Depois de escrever: 'npm run migrate' pra aplicar no seu banco local.

ALTER TABLE staffeventos ADD COLUMN IF NOT EXISTS obslogsistema TEXT;

-- Backfill: até aqui, obsgeral só era usado pelo sistema (tags automáticas),
-- nunca por observação livre digitada por usuário (confirmado: 100% dos
-- registros preenchidos batem no padrão "[TAG] ..." de uma linha só).
UPDATE staffeventos SET obslogsistema = obsgeral WHERE obsgeral IS NOT NULL AND trim(obsgeral) <> '';
UPDATE staffeventos SET obsgeral = NULL WHERE obsgeral IS NOT NULL AND trim(obsgeral) <> '';
