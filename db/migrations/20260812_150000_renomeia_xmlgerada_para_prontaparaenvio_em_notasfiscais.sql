-- Migration: renomeia status 'XML Gerada' para 'Pronta para Envio' em notasfiscais
--
-- "XML Gerada" virou uma inverdade: hoje o registro da nota (POST /notafiscal)
-- grava esse status na hora, ANTES de qualquer XML ter sido gerado de
-- verdade (o "Baixar XML" é uma ação separada e opcional). Isso confundia o
-- usuário, principalmente na aba "Prontas para Envio" (que lista por esse
-- status): parecia que a nota só aparecia lá depois de gerar o XML, quando
-- na real ela já aparece desde o registro. "Pronta para Envio" bate com o
-- nome da própria aba e não promete nada sobre o XML já existir.

ALTER TABLE notasfiscais DROP CONSTRAINT notasfiscais_status_check;

UPDATE notasfiscais SET status = 'Pronta para Envio' WHERE status = 'XML Gerada';

ALTER TABLE notasfiscais ADD CONSTRAINT notasfiscais_status_check
  CHECK (status IN ('Pronta para Envio', 'Emitida', 'Cancelada'));

ALTER TABLE notasfiscais ALTER COLUMN status SET DEFAULT 'Pronta para Envio';
