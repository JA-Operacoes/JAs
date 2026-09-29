-- Migration: cria_feriasgozos
-- Criada em: 2026-09-28T21:00:00.000Z
--
-- Escreva abaixo o SQL da mudanca de ESTRUTURA (uma migration = uma mudanca).
-- Roda dentro de uma transacao; se der erro, nada deste arquivo e aplicado.
-- Depois de escrever: 'npm run migrate' pra aplicar no seu banco local.
--
-- RH > Ferias. Os periodos aquisitivos NAO sao gravados: saem da admissao do vinculo
-- (funcionarioempresas.admissao + N anos) -- o que se grava aqui e o que foi USADO de cada um.
-- Uma linha por GOZO: a CLT (art. 134 par.1) deixa dividir em ate 3 partes (uma >= 14 dias, as
-- outras >= 5), entao um periodo aquisitivo tem de 1 a 3 linhas.
--
-- origem:
--   'historico'  -> ferias tiradas antes de o sistema existir (folha comecou em ago/2026). So
--                   marca o periodo como usado pra listagem de "ferias a vencer" nao acusar
--                   anos de ferias "vencidas" que ja foram gozadas; datas de gozo sao opcionais
--                   (o RH pode nao ter os registros antigos) e nao gera holerite.
--   'programada' -> lancada pelo botao "Programar ferias": datas obrigatorias, gera o recibo de
--                   ferias (folhaholerite tipo 'ferias', idholerite) e desconta os dias no mensal.
--
-- abono = vendeu 10 dias (abono pecuniario, art. 143). E do periodo aquisitivo, entao so pode
-- estar marcado em UMA das linhas do mesmo periodo (validado na rota).
CREATE TABLE IF NOT EXISTS feriasgozos (
  idferias          SERIAL PRIMARY KEY,
  idempresa         INTEGER NOT NULL REFERENCES empresas(idempresa),
  idfuncionario     INTEGER NOT NULL REFERENCES funcionarios(idfuncionario),
  aquisitivo_inicio DATE NOT NULL,
  aquisitivo_fim    DATE NOT NULL,
  gozo_inicio       DATE,
  gozo_fim          DATE,
  dias              SMALLINT NOT NULL CHECK (dias BETWEEN 0 AND 30),
  abono             BOOLEAN NOT NULL DEFAULT false,
  adiantamento13    BOOLEAN NOT NULL DEFAULT false,
  origem            VARCHAR(20) NOT NULL DEFAULT 'programada' CHECK (origem IN ('historico', 'programada')),
  idholerite        INTEGER REFERENCES folhaholerite(idholerite) ON DELETE SET NULL,
  obs               TEXT,
  idusuario         INTEGER REFERENCES usuarios(idusuario),
  criado_em         TIMESTAMP NOT NULL DEFAULT NOW(),
  CHECK (gozo_fim IS NULL OR gozo_inicio IS NULL OR gozo_fim >= gozo_inicio),
  CHECK (origem = 'historico' OR (gozo_inicio IS NOT NULL AND gozo_fim IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_feriasgozos_func
  ON feriasgozos (idempresa, idfuncionario, aquisitivo_inicio);
