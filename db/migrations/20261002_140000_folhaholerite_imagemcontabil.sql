-- Migration: Holerite-ImagemContabil
-- Criada em: 2026-10-02
--
-- Adiciona a coluna que guarda o nome do arquivo (imagem/PDF/JFIF) emitido pela
-- contabilidade para o holerite: salario, ferias, rescisao, 13o... Um arquivo por
-- holerite (folhaholerite ja tem uma linha por tipo); independe do status de pagamento.
-- Roda dentro de uma transacao; se der erro, nada deste arquivo e aplicado.
-- Depois de escrever: 'npm run migrate' pra aplicar no seu banco local.

ALTER TABLE IF EXISTS public.folhaholerite
    ADD COLUMN IF NOT EXISTS imagemcontabil character varying(255);
