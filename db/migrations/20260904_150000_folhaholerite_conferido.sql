-- Migration: folhaholerite_conferido
-- Criada em: 2026-09-04T18:00:00.000Z
--
-- Escreva abaixo o SQL da mudanca de ESTRUTURA (uma migration = uma mudanca).
-- Roda dentro de uma transacao; se der erro, nada deste arquivo e aplicado.
-- Depois de escrever: 'npm run migrate' pra aplicar no seu banco local.
--
-- RH > Holerite Virtual: Master (e futuramente outros perfis sem acesso a tela
-- individual) passa a enxergar so a LISTA, com um botao "Conferir" por linha.
-- Essa marca fica separada do status Pendente/Pago porque o holerite mensal ja
-- nasce sozinho (garantirHoleriteMensal, em rotaRH.js) com status Pendente sem
-- ninguem ter revisado nada -- "conferido" registra que alguem de fato bateu o
-- olho nos valores daquela competencia antes de ir pro financeiro.
--
-- Default true na criacao da coluna: holerites ja existentes vinham sendo
-- usados pelo financeiro (GET /contas-pagar) sem esse conceito, entao ficam
-- retroativamente marcados como conferidos pra nao sumirem de Contas a Pagar
-- da noite pro dia. So DEPOIS troca o default pra false, valendo so pra
-- holerites novos (criados automaticamente todo mes, ou reabertos/editados).
ALTER TABLE folhaholerite ADD COLUMN IF NOT EXISTS conferido BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE folhaholerite ADD COLUMN IF NOT EXISTS conferido_em TIMESTAMP;
ALTER TABLE folhaholerite ADD COLUMN IF NOT EXISTS conferido_por INTEGER REFERENCES usuarios(idusuario);
ALTER TABLE folhaholerite ALTER COLUMN conferido SET DEFAULT false;
