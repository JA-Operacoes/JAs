-- Migration: nova_permissao_camisetas
-- Criada em: 2026-09-25T23:00:00.000Z
--
-- Escreva abaixo o SQL da mudanca de ESTRUTURA (uma migration = uma mudanca).
-- Roda dentro de uma transacao; se der erro, nada deste arquivo e aplicado.
-- Depois de escrever: 'npm run migrate' pra aplicar no seu banco local.

-- Camisetas (local do Almoxarifado Geral) deixa de depender da flag `financeiro`
-- e passa a ter flag propria. Sem backfill de proposito: quem so tinha
-- `financeiro` perde o acesso ate a nova flag ser marcada na tela de usuarios.
ALTER TABLE permissoes
ADD COLUMN IF NOT EXISTS camisetas BOOLEAN DEFAULT FALSE;
