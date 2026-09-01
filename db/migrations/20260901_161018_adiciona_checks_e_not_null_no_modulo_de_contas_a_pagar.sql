-- Migration: adiciona checks e not null no modulo de contas a pagar
-- Criada em: 2026-09-01T19:10:18.641Z
--
-- Escreva abaixo o SQL da mudanca de ESTRUTURA (uma migration = uma mudanca).
-- Roda dentro de uma transacao; se der erro, nada deste arquivo e aplicado.
-- Depois de escrever: 'npm run migrate' pra aplicar no seu banco local.
--
-- Verificado antes de escrever (node -e contra db/conexaoDB.js, banco local):
--   pagamentos.status         => somente 'pendente' (118) e 'pago' (144)
--   pagamentos.idlancamento   => 0 linhas NULL
--   pagamentos.idempresa      => 0 linhas NULL
--   lancamentos.periodicidade => somente 'UNICO' e 'MENSAL' hoje, mas o front
--                                 (CadLancamentos.html) tambem oferece SEMANAL/
--                                 BIMESTRAL/TRIMESTRAL/SEMESTRAL/ANUAL — incluidos
--                                 no CHECK pra nao travar lancamento futuro valido.
--   lancamentos.tiporepeticao => somente 'FIXO' (100) e 'PARCELADO' (40)
--   lancamentos.tipovinculo   => 'funcionario' (72), 'fornecedor' (16), NULL (52,
--                                 "Lancamento Geral"); 'cliente' e opcao valida no
--                                 front mas sem uso ainda — incluida no CHECK.
--   centrocusto.idempresa     => 0 linhas NULL
--
-- CHECK constraints ignoram NULL por padrao (nao violam a constraint), entao nao
-- precisa de "IS NULL OR" pra manter tipovinculo/periodicidade/tiporepeticao
-- opcionais onde ja sao hoje.

ALTER TABLE pagamentos
  ADD CONSTRAINT pagamentos_status_check CHECK (status IN ('pendente', 'pago')),
  ALTER COLUMN idlancamento SET NOT NULL,
  ALTER COLUMN idempresa SET NOT NULL;

ALTER TABLE lancamentos
  ADD CONSTRAINT lancamentos_periodicidade_check
    CHECK (periodicidade IN ('MENSAL','UNICO','SEMANAL','BIMESTRAL','TRIMESTRAL','SEMESTRAL','ANUAL')),
  ADD CONSTRAINT lancamentos_tiporepeticao_check
    CHECK (tiporepeticao IN ('FIXO','PARCELADO')),
  ADD CONSTRAINT lancamentos_tipovinculo_check
    CHECK (tipovinculo IN ('cliente','fornecedor','funcionario'));

ALTER TABLE centrocusto
  ALTER COLUMN idempresa SET NOT NULL;
