-- Migration: empreiteira_ciclo_pagamento_fornecedor
-- Criada em: 2026-09-29T12:00:00.000Z
--
-- Escreva abaixo o SQL da mudanca de ESTRUTURA (uma migration = uma mudanca).
-- Roda dentro de uma transacao; se der erro, nada deste arquivo e aplicado.
-- Depois de escrever: 'npm run migrate' pra aplicar no seu banco local.
--
-- Freelancer pago via empreiteira: o staff continua lancado um a um (staffeventos), mas quem
-- esta vinculado a um fornecedor da categoria EMPREITEIRA sai do bloco Staff de Vencimentos e
-- entra como UMA conta do fornecedor por ciclo de pagamento (Contas a Pagar > Fornecedor).
--
-- fornecedorempresas (por empresa: o mesmo fornecedor pode ser quinzenal numa empresa e mensal
-- em outra, ex. EP):
--   categoria      EMPREITEIRA libera o vinculo no cadastro de funcionarios
--   envianf        exige a NF do ciclo antes de pagar (coordenador pessoa fisica nao emite)
--   tipopgto       EVENTO    = vence no vencimento de cache do evento (fim da desmontagem + 2)
--                  INTERVALO = a cada intervalodias a partir de dtbasepgto (quinzenal = 14),
--                              sempre no mesmo dia da semana da data base, feriado nao muda
--                  MENSAL    = todo dia diamespgto (mes curto cai no ultimo dia)
--   Um evento entra no primeiro ciclo cuja data e >= vencimento de cache dele.
--
-- funcionarioempresas.idfornecedorvinculo: vinculo padrao do cadastro.
-- staffeventos.idfornecedor: copia do vinculo no momento do lancamento, pra historico nao mudar
--   quando o cadastro mudar. staffeventos.dtciclofornecedor: data do ciclo gravada ao pagar,
--   pra trocar a regra do fornecedor depois nao reorganizar o que ja foi pago.
ALTER TABLE fornecedorempresas ADD COLUMN IF NOT EXISTS categoria VARCHAR(30);
ALTER TABLE fornecedorempresas ADD COLUMN IF NOT EXISTS envianf BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE fornecedorempresas ADD COLUMN IF NOT EXISTS tipopgto VARCHAR(15);
ALTER TABLE fornecedorempresas ADD COLUMN IF NOT EXISTS intervalodias INTEGER;
ALTER TABLE fornecedorempresas ADD COLUMN IF NOT EXISTS dtbasepgto DATE;
ALTER TABLE fornecedorempresas ADD COLUMN IF NOT EXISTS diamespgto INTEGER;

ALTER TABLE fornecedorempresas DROP CONSTRAINT IF EXISTS fornecedorempresas_tipopgto_check;
ALTER TABLE fornecedorempresas ADD CONSTRAINT fornecedorempresas_tipopgto_check
    CHECK (tipopgto IS NULL OR tipopgto IN ('EVENTO', 'INTERVALO', 'MENSAL'));
ALTER TABLE fornecedorempresas DROP CONSTRAINT IF EXISTS fornecedorempresas_intervalodias_check;
ALTER TABLE fornecedorempresas ADD CONSTRAINT fornecedorempresas_intervalodias_check
    CHECK (intervalodias IS NULL OR intervalodias > 0);
ALTER TABLE fornecedorempresas DROP CONSTRAINT IF EXISTS fornecedorempresas_diamespgto_check;
ALTER TABLE fornecedorempresas ADD CONSTRAINT fornecedorempresas_diamespgto_check
    CHECK (diamespgto IS NULL OR diamespgto BETWEEN 1 AND 31);

ALTER TABLE funcionarioempresas ADD COLUMN IF NOT EXISTS idfornecedorvinculo INTEGER
    REFERENCES fornecedores(idfornecedor);

ALTER TABLE staffeventos ADD COLUMN IF NOT EXISTS idfornecedor INTEGER
    REFERENCES fornecedores(idfornecedor);
ALTER TABLE staffeventos ADD COLUMN IF NOT EXISTS dtciclofornecedor DATE;

CREATE INDEX IF NOT EXISTS idx_staffeventos_idfornecedor
    ON staffeventos (idfornecedor) WHERE idfornecedor IS NOT NULL;
