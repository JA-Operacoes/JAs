-- Migration: renomeia despesaextraevento para despesaextras e permite despesa de escritório
-- Criada em: 2026-09-23T12:17:00.000Z
--
-- Pedido do Financeiro: além de imprevisto de EVENTO, também surgem despesas do escritório
-- (café da manhã pra cliente, aluguel de sala de reunião, conserto de microondas etc.) --
-- sem evento, sem funcionário fixo, pagas na hora (não entram em Vencimentos, igual já
-- valia pra despesa de evento). Em vez de criar tabela/tela nova, generaliza a mesma
-- despesaextraevento: idevento vira OPCIONAL -- presente = Despesa de Evento, ausente =
-- Despesa de Escritório. A tela escolhe o tipo e obriga/bloqueia o campo Evento conforme
-- a escolha; o backend nunca inventa outro discriminador, só confia em idevento IS NULL.
--
-- CEO Mode (Imprevistos por evento, routes/rotaCeo.js) já faz JOIN por idevento -- uma
-- despesa de escritório (idevento NULL) nunca casa com nenhum evento, continua de fora
-- automaticamente, sem precisar de filtro extra.

ALTER TABLE despesaextraevento RENAME TO despesaextras;
ALTER TABLE despesaextras ALTER COLUMN idevento DROP NOT NULL;

ALTER INDEX idx_despesaextraevento_idevento RENAME TO idx_despesaextras_idevento;
ALTER INDEX idx_despesaextraevento_idorcamento RENAME TO idx_despesaextras_idorcamento;
