-- Migration: empreiteira_no_orcamento_e_itens
-- Criada em: 2026-09-30T10:00:00.000Z
--
-- Escreva abaixo o SQL da mudanca de ESTRUTURA (uma migration = uma mudanca).
-- Roda dentro de uma transacao; se der erro, nada deste arquivo e aplicado.
-- Depois de escrever: 'npm run migrate' pra aplicar no seu banco local.
--
-- Freelancer pago via empreiteira, definido no ORCAMENTO (pra nao marcar lancamento a lancamento
-- no Staff). O ITEM e a fonte da verdade: cada item de staff diz se vai via empreiteira e qual
-- (a JA mistura: carregadores via empreiteira, outras funcoes direto, ou empreiteiras diferentes).
-- O Staff pre-marca o lancamento com a empreiteira do item da funcao, e continua editavel.
--
-- orcamentos.idfornecedorempreiteira: padrao do topo do orcamento. Escolher ali marca todos os
--   itens de staff; um item de staff incluido depois ja nasce marcado com ele. Opcional.
-- orcamentoitens.empreiteira / idfornecedorempreiteira: o check e a empreiteira de cada item.
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS idfornecedorempreiteira INTEGER
    REFERENCES fornecedores(idfornecedor);

ALTER TABLE orcamentoitens ADD COLUMN IF NOT EXISTS empreiteira BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE orcamentoitens ADD COLUMN IF NOT EXISTS idfornecedorempreiteira INTEGER
    REFERENCES fornecedores(idfornecedor);
