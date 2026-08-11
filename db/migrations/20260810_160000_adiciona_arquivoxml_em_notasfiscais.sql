-- Migration: adiciona arquivoxml em notasfiscais
--
-- Mesmo padrao ja usado em arquivopdf: guarda o caminho relativo do XML
-- salvo em uploads/notasparaenvio/ (ver rotaNotaFiscal.js, GET /:id/xml).
-- Serve pra tela saber que o arquivo ja existe e oferecer "Ver XML" (abre o
-- que ja foi gerado, sem precisar gerar de novo) em vez de só "Baixar XML".

ALTER TABLE notasfiscais ADD COLUMN IF NOT EXISTS arquivoxml VARCHAR(255);
