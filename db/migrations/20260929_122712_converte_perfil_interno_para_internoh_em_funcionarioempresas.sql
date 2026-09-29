-- Migration: converte perfil Interno para InternoH em funcionarioempresas
-- Criada em: 2026-09-29T15:27:12.150Z
--
-- Escreva abaixo o SQL da mudanca de ESTRUTURA (uma migration = uma mudanca).
-- Roda dentro de uma transacao; se der erro, nada deste arquivo e aplicado.
-- Depois de escrever: 'npm run migrate' pra aplicar no seu banco local.
--
-- O perfil 'Interno' (sem holerite/RH) deixou de existir como valor "vale-tudo":
-- agora o par correto e Interno/InternoH, espelhando Externo/ExternoH. Todo
-- funcionario que ja estava salvo como 'Interno' contava com holerite/RH sob a
-- regra antiga (perfilTemRH = perfil === 'Interno' || perfil === 'ExternoH'),
-- entao precisa virar 'InternoH' pra nao perder o acesso ao modulo de RH.

UPDATE funcionarioempresas SET perfil = 'InternoH' WHERE perfil = 'Interno';
