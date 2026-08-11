-- Migration: renomeia status 'Rascunho' para 'XML Gerada' em notasfiscais
--
-- "Rascunho" ficou generico demais depois que a Fase A passou a gerar o
-- XML da DPS junto do registro da nota (pro financeiro baixar e importar
-- manualmente no portal da prefeitura) — "XML Gerada" comunica melhor pra
-- quem le a lista o que aquele status realmente significa: o arquivo ja
-- esta pronto, falta so subir no portal e marcar como Emitida.

ALTER TABLE notasfiscais DROP CONSTRAINT notasfiscais_status_check;

UPDATE notasfiscais SET status = 'XML Gerada' WHERE status = 'Rascunho';

ALTER TABLE notasfiscais ADD CONSTRAINT notasfiscais_status_check
  CHECK (status IN ('XML Gerada', 'Emitida', 'Cancelada'));

ALTER TABLE notasfiscais ALTER COLUMN status SET DEFAULT 'XML Gerada';
