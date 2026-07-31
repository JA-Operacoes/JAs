-- Migration: move campos de vinculo empregaticio para funcionarioempresas
-- Criada em: 2026-07-27T14:00:00.000Z
--
-- Ate aqui, perfil/ativo/bonificado/mei/salario/funcao/cbo/admissao/valealim/
-- valetrnsp/adesaoplanosaude/tipoplanosaude/lote/dependentes/dependentesdados
-- moravam em `funcionarios` (uma linha por CPF, compartilhada entre TODAS as
-- empresas onde a pessoa esta vinculada). Isso impedia, por exemplo, a mesma
-- pessoa ser Interno numa empresa e Freelancer em outra, ou ativo numa e
-- inativo em outra, ou ter salario/banco de recebimento diferentes por
-- empresa do grupo.
--
-- Esta migration SO ADICIONA as colunas em `funcionarioempresas` e copia o
-- valor atual de `funcionarios` pra cada vinculo ja existente. As colunas
-- antigas em `funcionarios` NAO sao removidas aqui de proposito: varias rotas
-- (RH, Staff, Lancamentos, Relatorios, notificacoes-financeiras) ainda leem
-- de la e serao migradas em fases seguintes. A remocao fica pra uma migration
-- de limpeza separada, so depois de todas essas rotas atualizadas.

-- 1. Colunas novas em funcionarioempresas (mesmo tipo/default de funcionarios)
ALTER TABLE funcionarioempresas ADD COLUMN IF NOT EXISTS perfil VARCHAR(50);
ALTER TABLE funcionarioempresas ADD COLUMN IF NOT EXISTS lote BOOLEAN DEFAULT false;
ALTER TABLE funcionarioempresas ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT true;
ALTER TABLE funcionarioempresas ADD COLUMN IF NOT EXISTS bonificado BOOLEAN DEFAULT false;
ALTER TABLE funcionarioempresas ADD COLUMN IF NOT EXISTS salario NUMERIC(12,2);
ALTER TABLE funcionarioempresas ADD COLUMN IF NOT EXISTS funcao VARCHAR(100);
ALTER TABLE funcionarioempresas ADD COLUMN IF NOT EXISTS cbo NUMERIC;
ALTER TABLE funcionarioempresas ADD COLUMN IF NOT EXISTS dependentes NUMERIC;
ALTER TABLE funcionarioempresas ADD COLUMN IF NOT EXISTS admissao DATE;
ALTER TABLE funcionarioempresas ADD COLUMN IF NOT EXISTS valealim NUMERIC(12,2);
ALTER TABLE funcionarioempresas ADD COLUMN IF NOT EXISTS valetrnsp NUMERIC(12,2);
ALTER TABLE funcionarioempresas ADD COLUMN IF NOT EXISTS mei BOOLEAN DEFAULT false;
ALTER TABLE funcionarioempresas ADD COLUMN IF NOT EXISTS adesaoplanosaude BOOLEAN DEFAULT false;
ALTER TABLE funcionarioempresas ADD COLUMN IF NOT EXISTS tipoplanosaude VARCHAR(20);
ALTER TABLE funcionarioempresas ADD COLUMN IF NOT EXISTS dependentesdados JSONB DEFAULT '[]'::jsonb;

-- 2. Copia o valor atual de funcionarios pra cada vinculo ja existente
UPDATE funcionarioempresas fe
SET
    perfil = f.perfil,
    lote = f.lote,
    ativo = f.ativo,
    bonificado = f.bonificado,
    salario = f.salario,
    funcao = f.funcao,
    cbo = f.cbo,
    dependentes = f.dependentes,
    admissao = f.admissao,
    valealim = f.valealim,
    valetrnsp = f.valetrnsp,
    mei = f.mei,
    adesaoplanosaude = f.adesaoplanosaude,
    tipoplanosaude = f.tipoplanosaude,
    dependentesdados = f.dependentesdados
FROM funcionarios f
WHERE f.idfuncionario = fe.idfuncionario;

-- 3. Trava NOT NULL onde o original em funcionarios exigia (dado ja preenchido acima)
ALTER TABLE funcionarioempresas ALTER COLUMN perfil SET NOT NULL;
ALTER TABLE funcionarioempresas ALTER COLUMN mei SET NOT NULL;
ALTER TABLE funcionarioempresas ALTER COLUMN adesaoplanosaude SET NOT NULL;
ALTER TABLE funcionarioempresas ALTER COLUMN dependentesdados SET NOT NULL;
