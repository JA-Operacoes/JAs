-- Migration: criar_separacao_unidades_equipamento
-- Criada em: 2026-09-11T09:00:00.000Z
--
-- Permite marcar unidades especificas (com patrimonio) como separadas para
-- um evento, antes do envio fisico (que continua sendo feito via custodia,
-- que muda o status para 'evento'). A unidade continua com status 'estoque'
-- ate ser de fato enviada; idevento_separacao so indica o planejamento.

ALTER TABLE equipamentounidade
    ADD COLUMN IF NOT EXISTS idevento_separacao INTEGER REFERENCES eventos(idevento),
    ADD COLUMN IF NOT EXISTS separado_em TIMESTAMP,
    ADD COLUMN IF NOT EXISTS separado_por INTEGER;
