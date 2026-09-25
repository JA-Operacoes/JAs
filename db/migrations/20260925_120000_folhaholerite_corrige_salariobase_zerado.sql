-- Migration: folhaholerite_corrige_salariobase_zerado
-- Criada em: 2026-09-25T15:00:00.000Z
--
-- Escreva abaixo o SQL da mudanca de ESTRUTURA (uma migration = uma mudanca).
-- Roda dentro de uma transacao; se der erro, nada deste arquivo e aplicado.
-- Depois de escrever: 'npm run migrate' pra aplicar no seu banco local.
--
-- RH > Holerite Virtual: o salario bruto cadastrado no funcionario nao aparecia
-- no holerite. Duas causas somadas:
--
-- 1) GET /rh/holerite (rotaRH.js) devolvia sempre folhaholerite.salariobase, sem
--    aplicar a regra de rascunho que computarLinhaFolha ja aplicava (enquanto
--    conferido=false, o salario vem do cadastro). Corrigido no codigo, na mesma
--    entrega desta migration.
--
-- 2) A migration 20260904_150000 criou `conferido` com DEFAULT true pra nao
--    sumir holerites antigos de Contas a Pagar -- o que tambem marcou como
--    "conferido" holerites que ninguem conferiu de fato (conferido_em e
--    conferido_por ficaram NULL, porque so PUT /holerite/:id/conferir preenche
--    essas duas). Como esses holerites nasceram antes de o salario existir em
--    funcionarioempresas, ficaram com salariobase = 0 congelado, e o fix de
--    codigo sozinho nao os alcanca (conferido=true => usa o snapshot).
--
-- Este backfill so toca nesse caso especifico -- marcado pela migration, nunca
-- conferido por gente (conferido_em IS NULL AND conferido_por IS NULL), com
-- salario zerado/nulo -- e so quando o cadastro tem um salario positivo pra
-- copiar. Holerite conferido de verdade nao e alterado: o snapshot dele continua
-- valendo. Nao mexe em `conferido` pra nao tirar nada de Contas a Pagar.
--
-- ATENCAO: corrige apenas o salariobase do cabecalho. Os itens (INSS, IRRF,
-- VA/VT em folhaitens) desses holerites continuam como foram gerados -- pra
-- recalcula-los, reabrir a competencia e conferir de novo pela tela do RH
-- (PUT /holerite/:id/conferir regrava salario e itens a partir do cadastro).
UPDATE folhaholerite h
   SET salariobase = fe.salario
  FROM funcionarioempresas fe
 WHERE fe.idfuncionario = h.idfuncionario
   AND fe.idempresa = h.idempresa
   AND COALESCE(h.salariobase, 0) = 0
   AND COALESCE(fe.salario, 0) > 0
   AND h.conferido = true
   AND h.conferido_em IS NULL
   AND h.conferido_por IS NULL;
