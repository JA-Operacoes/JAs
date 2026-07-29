-- Migration: relaxa NOT NULL dos campos de vinculo legado em funcionarios
-- Criada em: 2026-07-27T14:05:00.000Z
--
-- Continuacao da migration anterior (move campos de vinculo para
-- funcionarioempresas). As colunas antigas em `funcionarios` ainda nao foram
-- removidas (varias rotas -- RH, Staff, Lancamentos, Relatorios,
-- notificacoes-financeiras -- ainda leem de la e serao migradas em fases
-- seguintes), mas o codigo novo (cadastro de Funcionarios) ja parou de
-- gravar nelas. As colunas que eram NOT NULL bloqueavam o INSERT/UPDATE
-- porque nao recebem mais valor nenhum. Relaxamos a restricao aqui -- os
-- valores existentes nao mudam, so deixam de ser obrigatorios para
-- escritas futuras nesta tabela.

ALTER TABLE funcionarios ALTER COLUMN perfil DROP NOT NULL;
ALTER TABLE funcionarios ALTER COLUMN mei DROP NOT NULL;
ALTER TABLE funcionarios ALTER COLUMN adesaoplanosaude DROP NOT NULL;
ALTER TABLE funcionarios ALTER COLUMN dependentesdados DROP NOT NULL;
