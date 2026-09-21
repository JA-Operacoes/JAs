-- Migration: adiciona ordem fixa nas empresas
-- Criada em: 2026-09-18T12:48:21.000Z
--
-- Barra "Trocar empresa" (topo de cada *-index.html) usava ORDER BY nmfantasia
-- (alfabético) — como cada página exclui a própria empresa da lista, a ordem
-- alfabética das restantes mudava de posição relativa dependendo de qual
-- página você estava, dando impressão de ícones "pulando de lugar" ao trocar.
-- Ordem fixa pedida pela usuária: JA-OPER, JA-EXPO, EA, ED, ES, EP, EP-RH,
-- SN FOODS, CJG, TSD, EventDrive (não mencionada — combinado deixar por
-- último). NULLS LAST na query cobre qualquer empresa futura sem valor aqui.

ALTER TABLE empresas ADD COLUMN IF NOT EXISTS ordem INTEGER;

UPDATE empresas SET ordem = 1  WHERE idempresa = 1;  -- JA-OPER
UPDATE empresas SET ordem = 2  WHERE idempresa = 5;  -- JA-EXPO
UPDATE empresas SET ordem = 3  WHERE idempresa = 6;  -- EA
UPDATE empresas SET ordem = 4  WHERE idempresa = 12; -- ED
UPDATE empresas SET ordem = 5  WHERE idempresa = 14; -- ES
UPDATE empresas SET ordem = 6  WHERE idempresa = 15; -- EP
UPDATE empresas SET ordem = 7  WHERE idempresa = 2;  -- EP-RH
UPDATE empresas SET ordem = 8  WHERE idempresa = 4;  -- SN FOODS
UPDATE empresas SET ordem = 9  WHERE idempresa = 11; -- CJG
UPDATE empresas SET ordem = 10 WHERE idempresa = 13; -- TSD
UPDATE empresas SET ordem = 11 WHERE idempresa = 3;  -- EVENTDRIVE
