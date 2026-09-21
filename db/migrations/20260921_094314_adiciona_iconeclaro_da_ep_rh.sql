-- Migration: adiciona_iconeclaro_da_ep_rh
-- Criada em: 2026-09-21T12:43:14.000Z
--
-- Barra "Trocar empresa" e os chips de "Empresa Padrão" do CadUsuarios usam
-- iconeescuro/iconeclaro (não "logo") pra escolher o ícone — EP-RH tinha os dois
-- NULL, por isso não aparecia mesmo já com o logo certo. Só existe a versão clara
-- (img/icons/RHfaviconBranco.ico, "branco" = ícone claro pra fundo escuro); não há
-- ainda um "RHfavicon.ico" escuro — iconeescuro fica NULL até esse arquivo existir
-- (o código já cai pro iconeclaro nesse caso, ver Index.js/usuarios.js).

UPDATE empresas SET iconeclaro = 'img/icons/RHfaviconBranco.ico' WHERE idempresa = 2;
