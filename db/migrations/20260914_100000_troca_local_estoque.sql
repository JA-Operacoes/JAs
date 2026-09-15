-- Migration: troca_local_estoque
-- Criada em: 2026-09-14T10:00:00.000Z
--
-- 1) Vincula formalmente a troca de equipamento: a unidade antiga fica marcada
--    com qual unidade nova a substituiu, até ser devolvida de fato.
-- 2) Local físico do estoque: JA (escritorio) ou Galpao.

ALTER TABLE equipamentounidade
    ADD COLUMN IF NOT EXISTS substituida_por_idunidade INTEGER REFERENCES equipamentounidade(idunidade),
    ADD COLUMN IF NOT EXISTS local VARCHAR(20) NOT NULL DEFAULT 'JA'
        CHECK (local IN ('JA', 'Galpao'));
