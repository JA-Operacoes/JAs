-- Migration: adiciona coluna dtcaixinha em staffeventos
-- Criada em: 2026-08-18T14:52:34.115Z
--
-- Escreva abaixo o SQL da mudanca de ESTRUTURA (uma migration = uma mudanca).
-- Roda dentro de uma transacao; se der erro, nada deste arquivo e aplicado.
-- Depois de escrever: 'npm run migrate' pra aplicar no seu banco local.

-- Suporta múltiplas caixinhas por staffevento (mesmo padrão jsonb array já usado
-- em dtdiariadobrada). Cada item: { iditem, valor, status, justificativa, data, comprovante }.
-- As colunas antigas (vlrcaixinha/statuscaixinha/desccaixinha/comppgtocaixinha) continuam
-- existindo e passam a ser calculadas a partir deste array (ver routes/rotaStaff.js).
ALTER TABLE staffeventos ADD COLUMN IF NOT EXISTS dtcaixinha JSONB NOT NULL DEFAULT '[]'::jsonb;
