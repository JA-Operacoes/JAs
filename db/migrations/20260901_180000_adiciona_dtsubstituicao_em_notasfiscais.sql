-- dtsubstituicao: marca quando uma nota Rejeitada foi substituída por uma
-- nota nova registrada pra mesma parcela. NÃO muda o status (continua
-- 'Rejeitada' pra sempre — é a verdade do que a prefeitura respondeu), só
-- some da aba "Rejeitadas" (que é uma fila de "precisa de atenção", não um
-- histórico) enquanto o histórico completo continua disponível em "Emitir
-- nota" > histórico do orçamento.
ALTER TABLE notasfiscais ADD COLUMN IF NOT EXISTS dtsubstituicao TIMESTAMP;
