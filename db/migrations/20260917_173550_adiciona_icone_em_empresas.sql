-- Migration: adiciona icone em empresas
-- Criada em: 2026-09-17T20:35:50.870Z
--
-- Ícones/logos pequenos por empresa, em par claro/escuro — cada tela escolhe a
-- versão certa pro próprio fundo (ex.: barra "Trocar empresa" no topo de cada
-- *-index.html, hoje HTML estático — só a TSD usava ícone branco pras outras
-- empresas porque o fundo dela é escuro; as demais usam colorido porque o
-- fundo é claro; com claro/escuro cada tela decide sozinha, sem regra fixa
-- tipo "todo mundo usa branco, menos fulano"). Também usado no seletor de
-- "Empresa Padrão" do Cadastro de Usuários (fundo escuro).
--
-- "logo" já existe (usado em relatórios/documentos, uploads reais já feitos
-- via Empresas.js/"Trocar logo") — mantido sem renomear, agora tratado
-- semanticamente como a versão ESCURA/colorida do logo; "logoclaro" é novo,
-- começa vazio (upload futuro). "icone" é totalmente novo, sem dado prévio
-- pra herdar — cria os dois pares (iconeescuro/iconeclaro) direto.
--
-- Verificado antes de escrever (node -e contra db/conexaoDB.js, banco local):
--   SELECT idempresa, nmfantasia, logo FROM empresas ORDER BY idempresa
--   → 13 linhas. Das 10 que aparecem na rede de barras "Trocar empresa" hoje
--   (1,3,4,5,6,11,12,13,14,15), todas têm os dois arquivos (colorido + branco)
--   já existentes em public/img/, exceto EventDrive (idempresa 3, sem versão
--   branca — iconeclaro fica NULL de propósito pra ela, mantém só a colorida
--   nas duas colunas). As outras 3 linhas (2=EP-RH, 9=JOÃO, 10=JD) não têm
--   página *-index.html nem entram na barra hoje — sem arquivo de ícone óbvio
--   pra elas, ficam com icone* NULL de propósito (a tela de Usuários já mostra
--   as 2 primeiras letras do nome como fallback nesse caso).

ALTER TABLE empresas ADD COLUMN IF NOT EXISTS logoclaro   VARCHAR(255);
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS iconeescuro VARCHAR(255);
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS iconeclaro  VARCHAR(255);

UPDATE empresas SET iconeescuro = 'img/JA_Oper.png',  iconeclaro = 'img/JA_Oper_branco.png'  WHERE idempresa = 1;  -- JA-OPER
UPDATE empresas SET iconeescuro = 'img/EventDrive.png', iconeclaro = NULL                     WHERE idempresa = 3;  -- EVENTDRIVE (sem versão branca)
UPDATE empresas SET iconeescuro = 'img/SN_Foods.png', iconeclaro = 'img/SN_Foods_branco.png'  WHERE idempresa = 4;  -- SN FOODS
UPDATE empresas SET iconeescuro = 'img/JA_Expo.png',  iconeclaro = 'img/JA_Expo_branco.png'   WHERE idempresa = 5;  -- JA-EXPO
UPDATE empresas SET iconeescuro = 'img/JA_EA.png',    iconeclaro = 'img/JA_EA_branco.png'     WHERE idempresa = 6;  -- EA
UPDATE empresas SET iconeescuro = 'img/CJG.png',      iconeclaro = 'img/CJG_branco.png'       WHERE idempresa = 11; -- CJG
UPDATE empresas SET iconeescuro = 'img/JA_ED.png',    iconeclaro = 'img/JA_ED_branco.png'     WHERE idempresa = 12; -- ED
UPDATE empresas SET iconeescuro = 'img/logo-tsd.png', iconeclaro = 'img/logo-tsd_branco.png'  WHERE idempresa = 13; -- TSD
UPDATE empresas SET iconeescuro = 'img/JA_ES.png',    iconeclaro = 'img/JA_ES_branco.png'     WHERE idempresa = 14; -- ES
UPDATE empresas SET iconeescuro = 'img/JA_EP.png',    iconeclaro = 'img/JA_EP_branco.png'     WHERE idempresa = 15; -- EP
