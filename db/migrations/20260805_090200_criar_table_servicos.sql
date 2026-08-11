-- Migration: criar table servicos
--
-- Cadastro de servicos fiscais por empresa, usado na Emissao de Nota Fiscal.
-- Escopado por idempresa (cada empresa do grupo cadastra os codigos que usa
-- de fato) em vez de uma lista fixa global, ja que empresas de segmentos
-- diferentes (eventos, construcao, alimentacao) usam codigos diferentes.
--
-- nbs, cindop e classificacaotributaria ficam junto do codigo de servico
-- porque sao derivados dele (tabela de correlacao oficial da Receita) — o
-- usuario escolhe so o codigo de servico na tela de emissao, o resto vem
-- daqui automaticamente.

CREATE TABLE IF NOT EXISTS servicos (
  idservico                SERIAL PRIMARY KEY,
  idempresa                INTEGER NOT NULL REFERENCES empresas(idempresa),
  codigoservico             VARCHAR(20) NOT NULL,
  descricao                 VARCHAR(255) NOT NULL,
  nbs                       VARCHAR(20),
  cindop                    VARCHAR(10),
  classificacaotributaria   VARCHAR(10),
  aliquotaissref            NUMERIC(5,2),
  ativo                     BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (idempresa, codigoservico)
);
