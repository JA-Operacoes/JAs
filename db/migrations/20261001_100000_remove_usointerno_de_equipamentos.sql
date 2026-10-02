-- Migration: remove_usointerno_de_equipamentos
-- Criada em: 2026-10-01T13:00:00.000Z
--
-- Reverte a 20260930_180000 (usointerno por categoria inteira): decidido com o
-- usuario que "uso interno" precisa ser por MODELO (marca/modelo), nao pela
-- categoria toda -- uma mesma categoria pode ter um modelo so de evento e outro
-- so de uso interno. O flag passa a viver dentro de cada objeto do JSONB
-- `equipamentos.modelos` (campo usointerno por modelo, sem mudanca de estrutura
-- de banco pra isso -- ver routes/rotaEquipamento.js e TIMode.js).
ALTER TABLE equipamentos DROP COLUMN IF EXISTS usointerno;
