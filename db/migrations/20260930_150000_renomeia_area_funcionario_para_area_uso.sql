-- Migration: renomeia_area_funcionario_para_area_uso
-- Criada em: 2026-09-30T18:00:00.000Z
--
-- Escreva abaixo o SQL da mudanca de ESTRUTURA (uma migration = uma mudanca).
-- Roda dentro de uma transacao; se der erro, nada deste arquivo e aplicado.
-- Depois de escrever: 'npm run migrate' pra aplicar no seu banco local.

-- Correção de rumo (coluna nova de minutos atrás, sem dado real gravado
-- ainda): não é a área do FUNCIONÁRIO que retirou, é pra ONDE o item vai —
-- ele pode retirar pra si (uso próprio) e o item ainda assim ter destino
-- Pavilhão ou Interno. Renomeia e troca o valor 'Escritório' por 'Interno'
-- pra bater com o vocabulário usado no pedido de compra.
ALTER TABLE almoxarifadogeralhistorico DROP CONSTRAINT IF EXISTS almoxarifadogeralhistorico_area_funcionario_check;
ALTER TABLE almoxarifadogeralhistorico RENAME COLUMN area_funcionario TO area_uso;
ALTER TABLE almoxarifadogeralhistorico
ADD CONSTRAINT almoxarifadogeralhistorico_area_uso_check CHECK (area_uso IN ('Pavilhão', 'Interno'));
