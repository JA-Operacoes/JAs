-- Migration: adiciona dtenvio_atual em equipamentounidade
-- Criada em: 2026-09-24T11:07:23.000Z
--
-- idorcamento_atual (migration anterior) resolve "pra qual edição foi", mas não "desde
-- quando está fora" -- hoje isso só dá pra descobrir vasculhando equipunidadehistorico
-- (casando pares envio_evento/retorno_evento pelo criado_em). dtenvio_atual guarda direto
-- o momento em que idevento_atual foi setado, pra consulta tipo "o que está fora e desde
-- quando" sem precisar reconstruir pelo histórico -- útil pro T.I. saber disponibilidade
-- por período, separado da pergunta financeira (que já é respondida por idorcamento_atual).
--
-- Não precisa de "dtretorno": quando o equipamento volta, idevento_atual já vira NULL (não
-- está mais fora), e a data do retorno em si já fica registrada no histórico
-- (equipunidadehistorico.criado_em da linha tipo='retorno_evento').

ALTER TABLE equipamentounidade
  ADD COLUMN dtenvio_atual TIMESTAMP;
