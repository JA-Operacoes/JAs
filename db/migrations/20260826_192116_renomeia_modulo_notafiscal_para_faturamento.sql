-- Migration: renomeia módulo "Notafiscal" para "Faturamento" em modulos/permissoes
-- Criada em: 2026-08-26T19:21:16.003Z
--
-- Escreva abaixo o SQL da mudanca de ESTRUTURA (uma migration = uma mudanca).
-- Roda dentro de uma transacao; se der erro, nada deste arquivo e aplicado.
-- Depois de escrever: 'npm run migrate' pra aplicar no seu banco local.
--
-- A tela virou "Faturamento" (menu, título, aba) há um tempo, mas o nome
-- interno do módulo (usado em `modulos`, `permissoes` e nas checagens de
-- `verificarPermissao` do backend) continuava "Notafiscal" — pouco óbvio
-- pra quem for conceder permissão sem conhecer o histórico do projeto.
-- O código (routes/rotaNotaFiscal.js, data-modulo dos menus, NotaFiscal.js)
-- já foi atualizado pra usar 'Faturamento'/'faturamento' — esta migration só
-- alinha o banco, preservando as permissões já concedidas (não perde
-- nenhuma linha, só renomeia o valor da coluna `modulo`).

UPDATE modulos SET modulo = 'Faturamento' WHERE modulo = 'Notafiscal';

UPDATE permissoes SET modulo = 'Faturamento' WHERE modulo = 'Notafiscal';
