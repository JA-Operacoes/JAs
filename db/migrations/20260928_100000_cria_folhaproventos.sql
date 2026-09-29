-- Migration: cria_folhaproventos
-- Criada em: 2026-09-28T13:00:00.000Z
--
-- Escreva abaixo o SQL da mudanca de ESTRUTURA (uma migration = uma mudanca).
-- Roda dentro de uma transacao; se der erro, nada deste arquivo e aplicado.
-- Depois de escrever: 'npm run migrate' pra aplicar no seu banco local.
--
-- RH > Folha de Proventos a parte: bonus, premio, PLR e afins que NAO entram no holerite.
-- Decisao da usuaria (2026-09-28): hora extra/comissao/adicionais continuam em folhaitens
-- (dentro do holerite, visiveis pro RH); o que e pago a parte fica aqui, visivel so pra
-- Master/Supremo, com conferencia e pagamento proprios -- so vira conta em Contas a Pagar
-- depois de conferido.
--
-- Tabela separada (e nao uma flag em folhaitens) de proposito: toda soma que ja existe sobre
-- folhaitens (holerite, lista do RH, Vencimentos, CEO Mode) continua certa sem precisar
-- aprender a pular esses valores, e o usuario so de RH nao tem como ve-los por nenhuma rota.
-- mes/ano = mes de VENCIMENTO, mesma convencao de folhaholerite.
CREATE TABLE IF NOT EXISTS folhaproventos (
  idprovento          SERIAL PRIMARY KEY,
  idempresa           INTEGER NOT NULL REFERENCES empresas(idempresa),
  idfuncionario       INTEGER NOT NULL REFERENCES funcionarios(idfuncionario),
  mes                 SMALLINT NOT NULL CHECK (mes BETWEEN 1 AND 12),
  ano                 SMALLINT NOT NULL,
  descricao           VARCHAR(120) NOT NULL,
  valor               NUMERIC(12,2) NOT NULL DEFAULT 0,
  conferido           BOOLEAN NOT NULL DEFAULT false,
  conferido_em        TIMESTAMP,
  conferido_por       INTEGER REFERENCES usuarios(idusuario),
  status              VARCHAR(20) NOT NULL DEFAULT 'Pendente',
  dtpagamento         DATE,
  idusuariolancamento INTEGER REFERENCES usuarios(idusuario),
  criado_em           TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_folhaproventos_competencia
  ON folhaproventos (idempresa, ano, mes, idfuncionario);
