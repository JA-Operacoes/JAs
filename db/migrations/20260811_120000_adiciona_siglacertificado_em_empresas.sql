-- A sigla do certificado A1 (usada pra montar NFE_CERTIFICADO_<SIGLA>_*) é
-- derivada automaticamente do nmfantasia na maioria dos casos — não precisa
-- dessa coluna preenchida. Ela só existe pra resolver o caso raro de duas
-- empresas gerarem a mesma sigla derivada: aí um valor manual aqui sobrepõe
-- a derivação automática só pra essa empresa (ver utils/certificadoEmpresa.js
-- -> resolverSiglaCertificado).
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS siglacertificado VARCHAR(6);
