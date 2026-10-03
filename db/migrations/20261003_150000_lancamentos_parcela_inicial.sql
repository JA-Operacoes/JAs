-- Migration: lancamentos_parcela_inicial
-- Criada em: 2026-10-03
--
-- Lançamentos parcelados (financiamento, consórcio...) que JÁ ESTÃO andando: antes a numeração
-- sempre começava na parcela 1. Agora o lançamento guarda em que parcela ele começa.
--   parcelainicial = nº da parcela que corresponde ao vctobase (ex.: 100)
--   qtdeparcelas   = total de parcelas do contrato (ex.: 300)  -> faltam 300 - 100 + 1 = 201
-- Padrão 1 = comportamento de sempre (1 de qtdeparcelas). Só vale pra tiporepeticao PARCELADO;
-- FIXO/ÚNICO ignoram.
ALTER TABLE lancamentos
  ADD COLUMN IF NOT EXISTS parcelainicial INTEGER NOT NULL DEFAULT 1 CHECK (parcelainicial >= 1);
