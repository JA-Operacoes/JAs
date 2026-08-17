-- Migration: criar table orcamentoparcelas
--
-- Estrutura o parcelamento do orcamento (hoje so existe como texto livre em
-- orcamentos.formapagamento, ex.: "R$ 11.575,67 - ato / 10/02/26 / ..."). So
-- existe linha aqui quando o orcamento e de fato parcelado: orcamento a
-- vista continua sem nenhuma linha, e o fluxo de faturamento manual (valor
-- digitado direto na emissao da nota) continua igual.
--
-- Preenchida no fechamento do orcamento (rotaOrcamento /fechar/:id) e
-- consumida pela emissao de Nota Fiscal pra pre-preencher o valor de cada
-- parcela aberta. O percentual (%) e so conveniencia de digitacao no front —
-- aqui so fica o valor em R$, que e o dado real.
--
-- status Aberta -> Faturada quando uma notasfiscais.idparcela aponta pra ela;
-- volta pra Aberta se a nota for cancelada (ver coluna idparcela em
-- notasfiscais, migration seguinte).

CREATE TABLE IF NOT EXISTS orcamentoparcelas (
  idparcela      SERIAL PRIMARY KEY,
  idorcamento    INTEGER NOT NULL REFERENCES orcamentos(idorcamento) ON DELETE CASCADE,
  numparcela     INTEGER NOT NULL,
  descricao      VARCHAR(60),
  vlrparcela     NUMERIC(12,2) NOT NULL CHECK (vlrparcela > 0),
  dtvencimento   DATE,
  status         VARCHAR(10) NOT NULL DEFAULT 'Aberta'
                   CHECK (status IN ('Aberta', 'Faturada', 'Cancelada')),
  dtregistro     TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (idorcamento, numparcela)
);

CREATE INDEX IF NOT EXISTS idx_orcamentoparcelas_orcamento
  ON orcamentoparcelas (idorcamento);
