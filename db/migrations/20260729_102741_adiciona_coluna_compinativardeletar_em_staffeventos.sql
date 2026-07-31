-- Migration: adiciona coluna compinativardeletar em staffeventos
-- Criada em: 2026-07-29T13:27:41.675Z
--
-- Escreva abaixo o SQL da mudanca de ESTRUTURA (uma migration = uma mudanca).
-- Roda dentro de uma transacao; se der erro, nada deste arquivo e aplicado.
-- Depois de escrever: 'npm run migrate' pra aplicar no seu banco local.
--
-- Comprovante (imagem/PDF) anexado quando o registro e Inativado ou Deletado.
-- Essas acoes sempre chegam por solicitacao via WhatsApp de um usuario ou
-- gerente de equipe, e so devs tem permissao pra executa-las — o comprovante
-- fica como complemento da justificativa (justificativaCascata) e de facil
-- acesso, sem precisar procurar a conversa original.

ALTER TABLE staffeventos ADD COLUMN IF NOT EXISTS compinativardeletar TEXT;

