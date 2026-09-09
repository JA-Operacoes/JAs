ALTER TABLE equipamentocustodiahistorico DROP CONSTRAINT IF EXISTS equipamentocustodiahistorico_tipo_check;
ALTER TABLE equipamentocustodiahistorico ADD CONSTRAINT equipamentocustodiahistorico_tipo_check
  CHECK (tipo IN ('entrega', 'devolucao', 'transferencia', 'envio_evento', 'retorno_evento', 'manutencao'));
