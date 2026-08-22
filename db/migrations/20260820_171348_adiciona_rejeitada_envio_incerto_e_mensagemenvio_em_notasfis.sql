-- Migration: adiciona status 'Rejeitada'/'Envio Incerto' e coluna mensagemenvio em notasfiscais
--
-- Preparação pro envio automático via Web Service da prefeitura (SOAP,
-- EnvioLoteRPS/TesteEnvioLoteRPS). Além de 'Emitida' (sucesso), agora existem
-- dois desfechos novos que a resposta da prefeitura pode gerar:
--   'Rejeitada'     — a prefeitura respondeu e recusou o lote (erro de
--                     validação). Como o XML manda <transacao>true</transacao>,
--                     um erro em qualquer RPS invalida o lote inteiro.
--   'Envio Incerto' — a conexão caiu/deu timeout ANTES de recebermos
--                     resposta. Não dá pra saber se a prefeitura processou
--                     ou não — nunca marcar como Emitida nem Rejeitada nesse
--                     caso, precisa conferir manualmente no portal antes de
--                     tentar de novo.
--
-- mensagemenvio guarda o motivo (erro específico da nota, ou explicação do
-- "incerto") — coluna separada de `observacao` pra não conflitar com
-- anotações manuais da financeiro.

ALTER TABLE notasfiscais DROP CONSTRAINT notasfiscais_status_check;

ALTER TABLE notasfiscais ADD CONSTRAINT notasfiscais_status_check
  CHECK (status IN ('Pronta para Envio', 'Emitida', 'Cancelada', 'Rejeitada', 'Envio Incerto'));

ALTER TABLE notasfiscais ADD COLUMN mensagemenvio TEXT;
