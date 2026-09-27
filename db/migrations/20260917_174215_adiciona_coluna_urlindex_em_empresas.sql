-- Migration: adiciona coluna urlindex em empresas
-- Criada em: 2026-09-24T18:00:00.000Z (retroativa -- ver "Why" abaixo)
--
-- "urlindex" (nome do arquivo *-index.html de cada empresa, usado pra montar a
-- barra "Trocar empresa") já existia há tempos no banco LOCAL, mas nunca tinha
-- uma migration própria criando a coluna -- foi adicionada direto (ALTER TABLE
-- manual, antes da convenção de migrations pegar pra esse campo), então nunca
-- foi pro servidor. A usuária restaurou um dump do servidor localmente e
-- confirmou: a coluna não existe lá. As 3 migrations seguintes (17 e 18/09)
-- já fazem UPDATE urlindex = ... assumindo que a coluna existe -- sem essa
-- aqui rodando ANTES delas (nome escolhido de propósito pra ordenar logo
-- antes de 20260917_174216), o primeiro UPDATE quebraria em produção com
-- "column urlindex does not exist".
--
-- IF NOT EXISTS torna isso seguro mesmo já tendo sido feito manualmente aqui
-- no local (não tenta recriar, só registra a migration como aplicada).

ALTER TABLE empresas ADD COLUMN IF NOT EXISTS urlindex VARCHAR(50);
