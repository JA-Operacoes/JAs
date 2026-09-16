-- Migration: adiciona_solicitante_almoxarifado
-- Criada em: 2026-09-15T10:00:00.000Z
--
-- idusuario no histórico é sempre quem de fato registrou a movimentação (usuário
-- logado). idfuncionario_solicitante é opcional: usado quando o usuário retira o
-- item a pedido de um funcionário (quem vai usar o item, não quem fez o registro).

ALTER TABLE almoxarifadotihistorico
    ADD COLUMN IF NOT EXISTS idfuncionario_solicitante INTEGER REFERENCES funcionarios(idfuncionario);
