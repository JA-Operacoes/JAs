-- Migration: remove campos de vinculo legado de funcionarios
-- Criada em: 2026-07-27T15:00:00.000Z
--
-- Etapa final da migracao de campos de vinculo empregaticio (perfil, ativo,
-- salario, funcao, etc.) para funcionarioempresas. Todas as rotas que liam ou
-- gravavam essas colunas em `funcionarios` (rotaFuncionario, rotaRH,
-- rotaLancamento, rotaConta, rotaRelatorio, rotaMain, rotaStaff) ja foram
-- migradas e validadas para usar `funcionarioempresas` no lugar. As colunas
-- abaixo estao congeladas desde a migration
-- 20260727_140000_move_campos_vinculo_para_funcionarioempresas (ninguem mais
-- grava nelas) -- esta migration so remove o que ja era morto.

ALTER TABLE funcionarios DROP COLUMN IF EXISTS perfil;
ALTER TABLE funcionarios DROP COLUMN IF EXISTS lote;
ALTER TABLE funcionarios DROP COLUMN IF EXISTS ativo;
ALTER TABLE funcionarios DROP COLUMN IF EXISTS bonificado;
ALTER TABLE funcionarios DROP COLUMN IF EXISTS salario;
ALTER TABLE funcionarios DROP COLUMN IF EXISTS funcao;
ALTER TABLE funcionarios DROP COLUMN IF EXISTS cbo;
ALTER TABLE funcionarios DROP COLUMN IF EXISTS dependentes;
ALTER TABLE funcionarios DROP COLUMN IF EXISTS admissao;
ALTER TABLE funcionarios DROP COLUMN IF EXISTS valealim;
ALTER TABLE funcionarios DROP COLUMN IF EXISTS valetrnsp;
ALTER TABLE funcionarios DROP COLUMN IF EXISTS mei;
ALTER TABLE funcionarios DROP COLUMN IF EXISTS adesaoplanosaude;
ALTER TABLE funcionarios DROP COLUMN IF EXISTS tipoplanosaude;
ALTER TABLE funcionarios DROP COLUMN IF EXISTS dependentesdados;
