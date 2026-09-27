-- Migration: folhaholerite_desconferir_apos_agosto
-- Criada em: 2026-09-25T22:00:00.000Z
--
-- Escreva abaixo o SQL da mudanca de ESTRUTURA (uma migration = uma mudanca).
-- Roda dentro de uma transacao; se der erro, nada deste arquivo e aplicado.
-- Depois de escrever: 'npm run migrate' pra aplicar no seu banco local.
--
-- Ajusta o corte da 20260925_180000 (que parou em setembro) e completa o que
-- faltou nela: a conferencia de BENEFICIOS.
--
-- Contexto: tanto `conferido` (20260904_150000) quanto `conferido_beneficios`
-- (20260904_180000) foram criadas com DEFAULT true pra nao tirar holerite antigo
-- de Contas a Pagar, e so depois tiveram o default trocado pra false. Quando
-- essas migrations rodaram, 2026 inteiro ja estava pre-gerado por
-- garantirHoleriteMensal (abrir Contas a Pagar cria os 12 meses de uma vez), e
-- todo mundo nasceu "conferido" sem que ninguem tivesse conferido nada -- nenhum
-- desses registros tem conferido_em / conferido_beneficios_em, que so o
-- PUT /holerite/:id/conferir[-beneficios] preenche.
--
-- Corte definido pelo RH (2026-09): a marca retroativa vale ate o VENCIMENTO de
-- AGOSTO/2026 -- meses ja processados e pagos, mexer neles so tiraria conta real
-- do financeiro. De SETEMBRO/2026 em diante, salario E beneficios voltam pro
-- estado honesto: botao "Conferir" nas duas colunas da lista e, em Contas a
-- Pagar, PREVISAO em vez de conta pronta pra pagar (ver GET /contas-pagar em
-- rotaMain.js, que decide isso por esses mesmos campos).
--
-- As duas condicoes preservam quem tem carimbo de gente: se alguem ja conferiu
-- de verdade uma competencia dessa faixa (ha 1 caso de beneficios em set/2026),
-- a conferencia continua valendo -- desfazer isso e decisao de quem confere, na
-- tela, nao de uma migration.
UPDATE folhaholerite
   SET conferido = false
 WHERE conferido = true
   AND conferido_em IS NULL
   AND conferido_por IS NULL
   AND (ano > 2026 OR (ano = 2026 AND mes > 8));

UPDATE folhaholerite
   SET conferido_beneficios = false
 WHERE conferido_beneficios = true
   AND conferido_beneficios_em IS NULL
   AND conferido_beneficios_por IS NULL
   AND (ano > 2026 OR (ano = 2026 AND mes > 8));
