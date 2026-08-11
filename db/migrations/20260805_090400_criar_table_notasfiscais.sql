-- Migration: criar table notasfiscais
--
-- Registro das NFS-e emitidas (ou em preparo) a partir de um orcamento
-- fechado. A emissao final continua manual no portal da prefeitura (Fase A
-- do plano) — esta tabela e o "espelho" que da controle de faturamento
-- dentro do JA System: quanto ja foi faturado por orcamento, com que
-- tributos, e o retorno do portal (numero da nota, identificador nacional,
-- codigo de verificacao) depois que o financeiro emite de fato.
--
-- Um orcamento pode gerar varias notas (uma por parcela), por isso nao ha
-- vinculo unico orcamento->nota: idorcamento se repete, uma linha por nota.
--
-- Valores de tributos (ISS, IRRF, PIS/COFINS/CSLL, CBS, IBS) ficam
-- congelados nesta tabela no momento do registro, mesmo vindo de
-- percentuais configuraveis em `servicos`/parametros fiscais — porque
-- alíquotas mudam ano a ano (principalmente CBS/IBS, ate 2033) e a nota ja
-- emitida nao pode ser recalculada com a aliquota nova.

CREATE TABLE IF NOT EXISTS notasfiscais (
  idnotafiscal              SERIAL PRIMARY KEY,
  idempresa                 INTEGER NOT NULL REFERENCES empresas(idempresa),
  idorcamento               INTEGER NOT NULL REFERENCES orcamentos(idorcamento),
  idcliente                 INTEGER NOT NULL REFERENCES clientes(idcliente),
  idservico                 INTEGER REFERENCES servicos(idservico),

  descricaoparcela          VARCHAR(100),
  descricaoservico          TEXT,
  municipioprestacao        VARCHAR(100),

  valorservico              NUMERIC(12,2) NOT NULL CHECK (valorservico > 0),

  aliquotaiss               NUMERIC(5,2),
  valoriss                  NUMERIC(12,2),
  valorirrf                 NUMERIC(12,2),
  valorpiscofinscsll        NUMERIC(12,2),
  valorcbs                  NUMERIC(12,2),
  valoribs                  NUMERIC(12,2),

  meiopagamento             VARCHAR(2) REFERENCES meiospagamento(codigo),
  descricaomeiopagamento    VARCHAR(100),

  status                    VARCHAR(20) NOT NULL DEFAULT 'Rascunho'
                              CHECK (status IN ('Rascunho','Emitida','Cancelada')),
  numeronota                VARCHAR(20),
  identificadornacional     VARCHAR(60),
  codigoverificacao         VARCHAR(20),
  arquivopdf                VARCHAR(255),

  observacao                TEXT,
  idusuarioregistro         INTEGER,
  dtregistro                TIMESTAMP NOT NULL DEFAULT now(),
  dtemissao                 TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notasfiscais_orcamento
  ON notasfiscais (idorcamento)
  WHERE status <> 'Cancelada';
