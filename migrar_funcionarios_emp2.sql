-- ============================================================
-- PASSO 1: cria a linha na empresa 2 para quem ainda nao tem
-- (32, 63, 88, 976), copiando os dados da empresa 1
-- ============================================================
INSERT INTO funcionarioempresas
    (idfuncionario, idempresa, perfil, lote, ativo, bonificado,
     salario, funcao, cbo, dependentes, admissao, valealim, valetrnsp,
     adesaoplanosaude, tipoplanosaude, dependentesdados, demissao)
SELECT
    idfuncionario, 2, perfil, lote, ativo, bonificado,
    salario, funcao, cbo, dependentes, admissao, valealim, valetrnsp,
    adesaoplanosaude, tipoplanosaude, dependentesdados, demissao
FROM funcionarioempresas
WHERE idempresa = 1
  AND idfuncionario IN (32, 63, 88, 976);

-- ============================================================
-- PASSO 2: para quem ja tinha linha na empresa 2, preenche so
-- os campos que estiverem vazios na empresa 2 com o valor da
-- empresa 1 (nunca sobrescreve o que ja existe na empresa 2)
-- ============================================================
UPDATE funcionarioempresas fe2
SET
    salario          = COALESCE(fe2.salario, fe1.salario),
    funcao           = COALESCE(fe2.funcao, fe1.funcao),
    cbo              = COALESCE(fe2.cbo, fe1.cbo),
    admissao         = COALESCE(fe2.admissao, fe1.admissao),
    valealim         = COALESCE(fe2.valealim, fe1.valealim),
    valetrnsp        = COALESCE(fe2.valetrnsp, fe1.valetrnsp),
    adesaoplanosaude = COALESCE(fe2.adesaoplanosaude, fe1.adesaoplanosaude),
    tipoplanosaude   = COALESCE(fe2.tipoplanosaude, fe1.tipoplanosaude),
    demissao         = COALESCE(fe2.demissao, fe1.demissao)
FROM funcionarioempresas fe1
WHERE fe1.idfuncionario = fe2.idfuncionario
  AND fe1.idempresa = 1
  AND fe2.idempresa = 2
  AND fe1.idfuncionario IN (
      16, 39, 92, 112, 120, 121, 129, 171, 393, 396, 397, 403, 430, 532,
      705, 737, 745, 746, 747, 748, 749, 750, 751, 752, 754, 755, 757, 804
  );

-- ============================================================
-- PASSO 3: limpa os campos de cadastro trabalhista na empresa 1
-- para todos os que foram migrados (os 28 que ja tinham linha
-- na empresa 2 + os 4 que tiveram linha criada no passo 1)
-- Nao mexe em 1, 340, 756 (ja estavam vazios) nem em
-- 60, 978, 400, 22, 143, 146, 979 (devem continuar na empresa 1)
-- ============================================================
UPDATE funcionarioempresas
SET
    salario          = NULL,
    funcao           = NULL,
    cbo              = NULL,
    admissao         = NULL,
    valealim         = NULL,
    valetrnsp        = NULL,
    adesaoplanosaude = NULL,
    tipoplanosaude   = NULL,
    demissao         = NULL
WHERE idempresa = 1
  AND idfuncionario IN (
      16, 32, 39, 63, 88, 92, 112, 120, 121, 129, 171, 393, 396, 397, 403,
      430, 532, 705, 737, 745, 746, 747, 748, 749, 750, 751, 752, 754, 755,
      757, 804, 976
  );
