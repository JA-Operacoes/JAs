-- Migration: remove_predestinacao_e_movimentacao_equipamento
-- Criada em: 2026-09-11T10:00:00.000Z
--
-- equipamentopredestinacao e equipamentomovimentacao ficaram redundantes e sem uso
-- real (0 linhas em produção) depois que a tela de Separação passou a cobrir o
-- planejamento de destino por unidade/patrimônio de forma mais direta. Removidas
-- para reduzir o número de tabelas do módulo de TI.

DROP TABLE IF EXISTS equipamentopredestinacao;
DROP TABLE IF EXISTS equipamentomovimentacao;
