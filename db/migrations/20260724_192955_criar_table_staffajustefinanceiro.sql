-- Migration: criar table staffajustefinanceiro
--
-- Escreva abaixo o SQL da mudanca de ESTRUTURA (uma migration = uma mudanca).
-- Roda dentro de uma transacao; se der erro, nada deste arquivo e aplicado.
-- Depois de escrever: 'npm run migrate' pra aplicar no seu banco local.

CREATE TABLE IF NOT EXISTS staffajustefinanceiro (
  idajustefinanceiro    SERIAL PRIMARY KEY,
  idfuncionario         INTEGER NOT NULL REFERENCES funcionarios(idfuncionario),
  idempresa             INTEGER NOT NULL,
  idstaffevento_origem  INTEGER REFERENCES staffeventos(idstaffevento),
  tipo                  VARCHAR(10) NOT NULL CHECK (tipo IN ('Credito','Debito')),
  valor                 NUMERIC(10,2) NOT NULL CHECK (valor > 0),
  justificativa         TEXT NOT NULL,
  status                VARCHAR(20) NOT NULL DEFAULT 'Pendente',
  idusuariolancamento   INTEGER,
  dtlancamento          TIMESTAMP NOT NULL DEFAULT now(),
  dtpagamento           TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_staffajustefinanceiro_funcionario
  ON staffajustefinanceiro (idfuncionario, idempresa)
  WHERE status <> 'Pago';
