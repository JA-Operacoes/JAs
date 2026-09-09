-- Migration: folhaholerite_conferido_beneficios
-- Criada em: 2026-09-04T21:00:00.000Z
--
-- Escreva abaixo o SQL da mudanca de ESTRUTURA (uma migration = uma mudanca).
-- Roda dentro de uma transacao; se der erro, nada deste arquivo e aplicado.
-- Depois de escrever: 'npm run migrate' pra aplicar no seu banco local.
--
-- RH > Holerite Virtual: salario e beneficios (VA/VT) sao pagos em dias diferentes -- salario
-- vence dia 5 do mes de vencimento (mes trabalhado = o anterior), beneficios vencem no ultimo
-- dia util do proprio mes vigente (trabalha e recebe no mesmo mes, sem defasagem). Por isso a
-- conferencia de um nao pode travar a do outro: fica em coluna separada da `conferido`
-- (=conferido de salario, ja existente) em vez de reaproveitar/renomear ela.
-- Mesmo raciocinio de default da migration anterior (20260904_150000): true retroativo pra nao
-- sumir holerites ja existentes de Financeiro, depois false pra valer so dai pra frente.
ALTER TABLE folhaholerite ADD COLUMN IF NOT EXISTS conferido_beneficios BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE folhaholerite ADD COLUMN IF NOT EXISTS conferido_beneficios_em TIMESTAMP;
ALTER TABLE folhaholerite ADD COLUMN IF NOT EXISTS conferido_beneficios_por INTEGER REFERENCES usuarios(idusuario);
ALTER TABLE folhaholerite ALTER COLUMN conferido_beneficios SET DEFAULT false;
