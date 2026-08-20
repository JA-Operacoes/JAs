-- Migration: renomeia dtcaixinha para caixinha em staffeventos
-- Criada em: 2026-08-18T21:04:28.433Z
--
-- Escreva abaixo o SQL da mudanca de ESTRUTURA (uma migration = uma mudanca).
-- Roda dentro de uma transacao; se der erro, nada deste arquivo e aplicado.
-- Depois de escrever: 'npm run migrate' pra aplicar no seu banco local.

-- Descontinuamos vlrcaixinha/statuscaixinha/desccaixinha/comppgtocaixinha (colunas
-- soltas antigas) em favor deste array — "dtcaixinha" não fazia mais sentido como
-- nome já que não sobra nenhuma outra coluna de caixinha pra distinguir dela.
ALTER TABLE staffeventos RENAME COLUMN dtcaixinha TO caixinha;
