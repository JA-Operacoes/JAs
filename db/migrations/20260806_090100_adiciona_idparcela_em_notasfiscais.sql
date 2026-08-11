-- Migration: adiciona idparcela em notasfiscais
--
-- Vincula (opcionalmente) uma nota registrada a uma parcela especifica de
-- orcamentoparcelas. Nao e obrigatorio: orcamento a vista ou faturamento
-- manual continuam registrando nota sem parcela nenhuma.

ALTER TABLE notasfiscais
  ADD COLUMN IF NOT EXISTS idparcela INTEGER REFERENCES orcamentoparcelas(idparcela);

CREATE INDEX IF NOT EXISTS idx_notasfiscais_parcela
  ON notasfiscais (idparcela)
  WHERE idparcela IS NOT NULL;
