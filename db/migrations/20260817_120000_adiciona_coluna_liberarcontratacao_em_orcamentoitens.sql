-- Migration: adiciona coluna liberarcontratacao em orcamentoitens
-- Criada em: 2026-08-17T12:00:00.000Z
--
-- Escreva abaixo o SQL da mudanca de ESTRUTURA (uma migration = uma mudanca).
-- Roda dentro de uma transacao; se der erro, nada deste arquivo e aplicado.
-- Depois de escrever: 'npm run migrate' pra aplicar no seu banco local.

-- Libera/bloqueia a contratação de staff item a item. O checkbox de
-- "liberar contratação" do orçamento (orcamentos.contratarstaff) continua
-- liberando TODOS os itens de uma vez; esta coluna permite desmarcar um
-- item específico (ex.: um aditivo/bonificado ainda não autorizado pelo
-- cliente) sem afetar o restante do orçamento.
ALTER TABLE orcamentoitens ADD COLUMN IF NOT EXISTS liberarcontratacao BOOLEAN NOT NULL DEFAULT true;
