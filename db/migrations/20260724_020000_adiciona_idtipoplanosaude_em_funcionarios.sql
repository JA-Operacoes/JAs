-- Migration: adiciona-idtipoplanosaude-em-funcionarios
-- Criada em: 2026-07-24
--
-- Escreva abaixo o SQL da mudanca de ESTRUTURA (uma migration = uma mudanca).
-- Roda dentro de uma transacao; se der erro, nada deste arquivo e aplicado.
-- Depois de escrever: 'npm run migrate' pra aplicar no seu banco local.

-- O funcionario passa a apontar para o TIPO de plano escolhido (tabela
-- tipoplanosaude), em vez do texto livre da antiga coluna tipoplanosaude.
-- ON DELETE SET NULL: se o tipo for removido/recriado, o vinculo apenas zera.
ALTER TABLE funcionarios
    ADD COLUMN IF NOT EXISTS idtipoplanosaude INTEGER
        REFERENCES tipoplanosaude (idtipoplanosaude) ON DELETE SET NULL;
