-- Migration: reorganiza_status_ti_por_orcamento_e_ocorrencia
-- Criada em: 2026-09-24T14:00:00.000Z
--
-- Achado real: idevento NÃO identifica "uma ocorrência" do evento -- o mesmo idevento pode
-- ter orçamentos com idcliente/idmontagem/período completamente diferentes (ex.: mesmo nome
-- de evento vendido de novo em outro período, outro local de montagem). Uma "ocorrência" é a
-- combinação idevento+idcliente+idmontagem+dtinirealizacao+dtfimrealizacao -- orçamentos-irmãos
-- de uma mesma ocorrência (cliente pediu split de fatura) sempre batem exatamente nesses 5
-- campos (confirmado nos dados reais: idevento=54, 14 orçamentos ao longo de 2 anos).
--
-- 1) status_controle (confirmado/incerto/cancelado) passa a ser por ORÇAMENTO, não por
--    evento -- cada orçamento tem seu próprio estado (Fechado/Recusado travam automaticamente
--    pro valor correspondente no backend; só Aberto/Proposta/Em Andamento guardam valor manual
--    aqui).
CREATE TABLE IF NOT EXISTS tiorcamentostatus (
    idorcamento INTEGER NOT NULL REFERENCES orcamentos(idorcamento),
    idempresa INTEGER NOT NULL,
    status_controle VARCHAR(20) NOT NULL DEFAULT 'incerto'
        CHECK (status_controle IN ('confirmado', 'incerto', 'cancelado')),
    atualizado_em TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (idorcamento, idempresa)
);

-- 2) "Equipamentos separados" continua um flag por OCORRÊNCIA (não por orçamento individual
--    dentro dela) -- mas a chave muda de idevento pro idorcamento-âncora da ocorrência (o
--    menor idorcamento do grupo), já que idevento sozinho pode abranger várias ocorrências.
--    A única linha existente hoje era de teste (idevento=177, "Evento Prospecção" -- ambíguo
--    entre a ocorrência de junho e a de dezembro), então reseta em vez de tentar adivinhar
--    qual das duas ela quis dizer.
DELETE FROM tieventostatus;
ALTER TABLE tieventostatus DROP CONSTRAINT tieventostatus_pkey;
ALTER TABLE tieventostatus DROP COLUMN status_controle;
ALTER TABLE tieventostatus DROP COLUMN idevento;
ALTER TABLE tieventostatus ADD COLUMN idorcamento_ancora INTEGER NOT NULL REFERENCES orcamentos(idorcamento);
ALTER TABLE tieventostatus ADD PRIMARY KEY (idorcamento_ancora, idempresa);
