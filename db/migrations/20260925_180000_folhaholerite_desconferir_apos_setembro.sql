-- Migration: folhaholerite_desconferir_apos_setembro
-- Criada em: 2026-09-25T21:00:00.000Z
--
-- Escreva abaixo o SQL da mudanca de ESTRUTURA (uma migration = uma mudanca).
-- Roda dentro de uma transacao; se der erro, nada deste arquivo e aplicado.
-- Depois de escrever: 'npm run migrate' pra aplicar no seu banco local.
--
-- RH > Holerite Virtual: a lista mostrava "conferido" em competencia que ninguem
-- conferiu. Nao e bug de codigo -- e heranca de dado.
--
-- A migration 20260904_150000 criou folhaholerite.conferido com DEFAULT true de
-- proposito (holerite antigo ja era usado pelo financeiro sem esse conceito e
-- sumiria de Contas a Pagar da noite pro dia) e logo em seguida trocou o default
-- pra false. So que, quando ela rodou (2026-09-09), o ano de 2026 INTEIRO ja
-- tinha sido pre-gerado por garantirHoleriteMensal -- abrir Contas a Pagar cria
-- os 12 meses de uma vez. Resultado: 1050 holerites nasceram "conferidos", ate
-- os de meses que ainda nem venceram, e nenhum deles tem conferido_em /
-- conferido_por (so PUT /holerite/:id/conferir preenche essas duas colunas).
--
-- Corte definido pelo RH (2026-09): vale a marca retroativa ate o VENCIMENTO de
-- setembro/2026 -- esses meses ja foram processados e pagos, mexer neles so
-- tiraria conta real do financeiro. De outubro/2026 em diante a competencia
-- ainda vai ser revisada, entao volta pro estado honesto: botao "Conferir" na
-- lista e, em Contas a Pagar, PREVISAO em vez de conta pronta pra pagar (ver
-- GET /contas-pagar em rotaMain.js, que decide isso pelo campo `conferido`).
--
-- Nao toca em quem tem carimbo de gente (conferido_em/conferido_por) -- hoje
-- ninguem tem, mas se alguem conferir de verdade antes desta migration rodar em
-- outro ambiente, a conferencia dele continua valendo.
UPDATE folhaholerite
   SET conferido = false
 WHERE conferido = true
   AND conferido_em IS NULL
   AND conferido_por IS NULL
   AND (ano > 2026 OR (ano = 2026 AND mes > 9));
