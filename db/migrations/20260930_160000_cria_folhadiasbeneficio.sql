-- Migration: cria_folhadiasbeneficio
-- Criada em: 2026-09-30T19:00:00.000Z
--
-- RH > Folha: ajuste manual da QUANTIDADE DE DIAS de VA/VT do mes, com justificativa obrigatoria.
-- Caso tipico: feriado na quinta e o RH decide emendar a sexta pra todo mundo (ou um atestado /
-- admissao no meio do mes pra uma pessoa so). Sem ajuste, vale o calendario (seg-sex sem feriado
-- de SP, ver contarDiasBeneficio em rotaRH.js).
--
-- Historico, nao sobrescrita: cada alteracao e uma linha nova e vale a MAIS RECENTE do escopo
-- (idempresa, mes, ano, idfuncionario). idfuncionario NULL = ajuste de TODOS da empresa no mes
-- (so vale pra quem nao tem ajuste individual). dias NULL = ajuste removido (volta ao
-- geral/calendario) -- a remocao tambem fica registrada, com justificativa.
-- Tabela propria (e nao colunas em folhaholerite) porque a lista tambem mostra PREVISOES, que
-- ainda nao tem holerite gravado. mes/ano = mes de VENCIMENTO, mesma convencao de folhaholerite.
CREATE TABLE IF NOT EXISTS folhadiasbeneficio (
  iddiasbeneficio SERIAL PRIMARY KEY,
  idempresa       INTEGER NOT NULL REFERENCES empresas(idempresa),
  mes             SMALLINT NOT NULL CHECK (mes BETWEEN 1 AND 12),
  ano             SMALLINT NOT NULL,
  idfuncionario   INTEGER REFERENCES funcionarios(idfuncionario),
  dias            SMALLINT CHECK (dias IS NULL OR dias BETWEEN 0 AND 31),
  justificativa   TEXT NOT NULL,
  idusuario       INTEGER REFERENCES usuarios(idusuario),
  criadoem        TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_folhadiasbeneficio_competencia
  ON folhadiasbeneficio (idempresa, ano, mes, idfuncionario, iddiasbeneficio DESC);
