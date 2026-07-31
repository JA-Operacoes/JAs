-- Migration: importa bancos ja cadastrados para a empresa EP
-- Criada em: 2026-07-28T10:00:00.000Z
--
-- A empresa EP ja estava incluida no modulo Bancos (moduloempresas) antes do
-- fix de sincronizacao do PUT /modulos/:id, entao nunca recebeu a oferta
-- automatica de importacao (essa so dispara para empresas adicionadas DEPOIS
-- do fix). Este migrate faz manualmente o mesmo que a rota POST /bancos/importar
-- faria: vincula em bancoempresas os bancos da empresa com mais bancos
-- cadastrados (hoje, JA-OPER/idempresa=1) para a empresa EP, sem duplicar
-- vinculos que porventura ja existam (bancoempresas nao tem UNIQUE(idbanco,
-- idempresa), entao o NOT EXISTS abaixo faz esse papel).

INSERT INTO bancoempresas (idbanco, idempresa)
SELECT be_origem.idbanco, ep.idempresa
FROM bancoempresas be_origem
CROSS JOIN (SELECT idempresa FROM empresas WHERE nmfantasia = 'EP') ep
WHERE be_origem.idempresa = (
    SELECT idempresa FROM bancoempresas GROUP BY idempresa ORDER BY COUNT(*) DESC LIMIT 1
)
AND NOT EXISTS (
    SELECT 1 FROM bancoempresas be_destino
    WHERE be_destino.idempresa = ep.idempresa AND be_destino.idbanco = be_origem.idbanco
);
