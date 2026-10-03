-- Migration: cria_emprestimosfolha
-- Criada em: 2026-10-03
--
-- RH > Empréstimo consignado descontado em folha. O empréstimo em si é feito pelo funcionário
-- (carteira de trabalho/banco/gov.br) e a CONTABILIDADE controla juros, teto, quitação e
-- renegociação; o RH só replica aqui o que vem no holerite da contabilidade — por isso o cadastro
-- é só valor mensal + quantidade de parcelas + mês de início, sem aprovação nem juros.
--
-- Multiempresa: o empréstimo pertence ao VÍNCULO (idempresa + idfuncionario), ou seja, à empresa
-- cujo holerite desconta. Cada empresa tem os seus, isolados; o mesmo funcionário pode ter
-- empréstimos independentes em empresas diferentes.
--
-- emprestimosfolha: o contrato (um por empréstimo).
-- emprestimosfolhaparcelas: UMA LINHA POR COMPETÊNCIA, criadas já no cadastro. Cada linha é
-- editável (valor / nº da parcela / "sem desconto neste mês") pelo bloco "Empréstimos" do
-- holerite — mês sem desconto (ex.: férias) o RH zera só aquela linha. O holerite mensal lê a
-- linha da competência e monta o item "Empréstimo (n/N)" automaticamente (como o plano de saúde).
-- idempresa repetido na parcela de propósito: a folha lê as parcelas do mês de todos os
-- funcionários da empresa de uma vez, sem depender de join com o contrato.
-- mes/ano = mês de VENCIMENTO, mesma convenção de folhaholerite (o RH informa o mês TRABALHADO
-- da contabilidade e a tela soma 1 mês).
CREATE TABLE IF NOT EXISTS emprestimosfolha (
  idemprestimo  SERIAL PRIMARY KEY,
  idempresa     INTEGER NOT NULL REFERENCES empresas(idempresa),
  idfuncionario INTEGER NOT NULL REFERENCES funcionarios(idfuncionario),
  descricao     VARCHAR(120) NOT NULL DEFAULT 'Empréstimo consignado',
  valorparcela  NUMERIC(12,2) NOT NULL CHECK (valorparcela > 0),
  qtdparcelas   SMALLINT NOT NULL CHECK (qtdparcelas BETWEEN 1 AND 120),
  mesinicio     SMALLINT NOT NULL CHECK (mesinicio BETWEEN 1 AND 12),
  anoinicio     SMALLINT NOT NULL,
  obs           TEXT,
  ativo         BOOLEAN NOT NULL DEFAULT true,
  idusuario     INTEGER REFERENCES usuarios(idusuario),
  criadoem      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS emprestimosfolhaparcelas (
  idparcela     SERIAL PRIMARY KEY,
  idemprestimo  INTEGER NOT NULL REFERENCES emprestimosfolha(idemprestimo) ON DELETE CASCADE,
  idempresa     INTEGER NOT NULL REFERENCES empresas(idempresa),
  idfuncionario INTEGER NOT NULL REFERENCES funcionarios(idfuncionario),
  mes           SMALLINT NOT NULL CHECK (mes BETWEEN 1 AND 12),
  ano           SMALLINT NOT NULL,
  numparcela    SMALLINT NOT NULL,
  valor         NUMERIC(12,2) NOT NULL DEFAULT 0,
  semdesconto   BOOLEAN NOT NULL DEFAULT false,
  idusuario     INTEGER REFERENCES usuarios(idusuario),
  atualizadoem  TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (idemprestimo, mes, ano)
);

CREATE INDEX IF NOT EXISTS idx_emprestimosfolhaparcelas_competencia
  ON emprestimosfolhaparcelas (idempresa, ano, mes, idfuncionario);
CREATE INDEX IF NOT EXISTS idx_emprestimosfolha_func
  ON emprestimosfolha (idempresa, idfuncionario);
