-- Migration: adiciona idorcamento na custódia de equipamento (equipamentounidade + histórico)
-- Criada em: 2026-09-24T10:59:10.000Z
--
-- equipamentounidade.idevento_atual/idevento_separacao e equipunidadehistorico.idevento só
-- guardavam idevento -- mas um evento recorrente (mesma feira todo ano) repete o idevento em
-- anos diferentes, e mesmo dentro do MESMO ano um evento pode ter mais de um orçamento-irmão
-- (cliente pede pra separar em várias faturas -- já visto até 8 orçamentos pro mesmo evento
-- no mesmo período, ver despesaextraevento). Sem idorcamento, não tem como saber depois PRA
-- QUAL EDIÇÃO um equipamento foi de verdade -- mesmo problema já resolvido em staffeventos
-- (usa idorcamento, não idevento) e despesaextras (idevento+dtreferencia).
--
-- Feita agora de propósito: equipamentounidade/equipunidadehistorico ainda estão com 0
-- linhas (T.I. não usa custódia na prática ainda) -- é a hora mais barata de mudar o schema,
-- antes de acumular dado no formato antigo.

ALTER TABLE equipamentounidade
  ADD COLUMN idorcamento_atual INTEGER REFERENCES orcamentos(idorcamento),
  ADD COLUMN idorcamento_separacao INTEGER REFERENCES orcamentos(idorcamento);

ALTER TABLE equipunidadehistorico
  ADD COLUMN idorcamento INTEGER REFERENCES orcamentos(idorcamento);
