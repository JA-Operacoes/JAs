-- Migration: Holerite-Comprovante
-- Criada em: 2026-07-18
--
-- Adiciona a coluna que guarda o nome do arquivo do comprovante de pagamento
-- do holerite (imagem/PDF/JFIF). Um comprovante por holerite.
-- Roda dentro de uma transacao; se der erro, nada deste arquivo e aplicado.
-- Depois de escrever: 'npm run migrate' pra aplicar no seu banco local.

ALTER TABLE IF EXISTS public.folhaholerite
    ADD COLUMN IF NOT EXISTS comprovante character varying(255);
