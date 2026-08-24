-- Migration: adiciona endereço completo em localmontagem
--
-- Hoje só existe cidade/UF. Necessário pro endereço do evento exigido pela
-- prefeitura no XML da NFS-e (grupo <atvEvento>/<end>, obrigatório pro
-- indicador de operação "040101" que o sistema sempre usa) — sem isso a
-- prefeitura rejeita o envio (erro 637, confirmado testando de verdade).

ALTER TABLE localmontagem ADD COLUMN IF NOT EXISTS rua VARCHAR(255);
ALTER TABLE localmontagem ADD COLUMN IF NOT EXISTS numero VARCHAR(20);
ALTER TABLE localmontagem ADD COLUMN IF NOT EXISTS bairro VARCHAR(100);
ALTER TABLE localmontagem ADD COLUMN IF NOT EXISTS cep VARCHAR(9);
