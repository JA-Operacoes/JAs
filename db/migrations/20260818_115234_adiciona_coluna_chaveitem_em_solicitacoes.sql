-- Migration: adiciona coluna chaveitem em solicitacoes
-- Criada em: 2026-08-18T14:52:34.155Z
--
-- Escreva abaixo o SQL da mudanca de ESTRUTURA (uma migration = uma mudanca).
-- Roda dentro de uma transacao; se der erro, nada deste arquivo e aplicado.
-- Depois de escrever: 'npm run migrate' pra aplicar no seu banco local.

-- Chave de correlação por item pra categorias que sincronizam array-de-itens com
-- solicitacoes sem ter uma data única natural pra casar (ex.: statuscaixinha, onde
-- duas caixinhas podem nascer no mesmo dia). Diária Dobrada/Meia Diária continuam
-- casando por dtsolicitada (data); chaveitem é usada só quando a data não é única.
ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS chaveitem VARCHAR;
