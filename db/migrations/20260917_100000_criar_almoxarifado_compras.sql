-- Migration: criar_almoxarifado_compras
-- Criada em: 2026-09-17T10:00:00.000Z
--
-- Compras do almoxarifado: fecha o ciclo do item consumível que hoje só tem
-- entrada/saída manual (almoxarifadogeral + almoxarifadogeralhistorico).
--
-- Fluxo:
--   1. Qualquer usuário com acesso ao módulo monta um PEDIDO (lista de compra),
--      seja a partir da sugestão automática (itens abaixo/perto do mínimo), seja
--      pedindo item avulso — inclusive item que ainda não existe no cadastro.
--   2. Quem tem master/supremo aprova ITEM A ITEM (pode cortar quantidade ou
--      recusar só um item) — por isso o status vive no item, e o do pedido é
--      derivado.
--   3. Cada item aprovado recebe N COTAÇÕES (fornecedor + valor unitário +
--      prazo); uma é marcada como escolhida.
--   4. No recebimento a quantidade é CONFIRMADA (pode chegar mais ou menos que o
--      pedido), e só então vira entrada no estoque + registro em
--      almoxarifadocompra — que é a base do histórico de preço por fornecedor e
--      do cálculo de "quanto tempo o estoque durou".

CREATE TABLE IF NOT EXISTS almoxarifadopedido (
    idpedido SERIAL PRIMARY KEY,
    idempresa INTEGER NOT NULL,
    -- Mesmo `local` de almoxarifadogeral (Escritório / Consumíveis Pavilhão /
    -- Camisetas) — herda a restrição de quem pode ver Camisetas.
    local VARCHAR(60) NOT NULL,
    -- Derivado dos itens (ver recalc_status_pedido_almoxarifado): pendente enquanto
    -- houver item sem decisão; aprovado/recusado/parcial depois da análise do master;
    -- comprado quando tem cotação escolhida; recebido quando tudo que foi aprovado
    -- já entrou no estoque.
    status VARCHAR(20) NOT NULL DEFAULT 'pendente'
        CHECK (status IN ('pendente', 'aprovado', 'parcial', 'recusado', 'comprado', 'recebido', 'cancelado')),
    -- Data em que a lista precisa estar na mão (prazo combinado de recebimento).
    dt_necessidade DATE,
    observacao TEXT,
    idusuario_solicitante INTEGER,
    idusuario_aprovador INTEGER,
    dt_aprovacao TIMESTAMP,
    dt_recebimento TIMESTAMP,
    criado_em TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_almoxpedido_empresa_status ON almoxarifadopedido (idempresa, status);

CREATE TABLE IF NOT EXISTS almoxarifadopedidoitem (
    idpedidoitem SERIAL PRIMARY KEY,
    idpedido INTEGER NOT NULL REFERENCES almoxarifadopedido(idpedido) ON DELETE CASCADE,
    -- NULL = item que ainda não existe no almoxarifado; ele é cadastrado
    -- automaticamente no recebimento e o vínculo é preenchido ali.
    iditem INTEGER REFERENCES almoxarifadogeral(iditem),
    -- Snapshot da descrição: pro item avulso é o texto digitado, pro item
    -- cadastrado é a descrição no momento do pedido (não muda se renomearem).
    descricao VARCHAR(120) NOT NULL,
    unidade_medida VARCHAR(20) NOT NULL DEFAULT 'unidade',
    quantidade_solicitada INTEGER NOT NULL CHECK (quantidade_solicitada > 0),
    -- Preenchida na aprovação: master pode cortar a quantidade pedida.
    quantidade_aprovada INTEGER CHECK (quantidade_aprovada >= 0),
    -- Somatório do que efetivamente entrou (pode ser maior ou menor que a aprovada).
    quantidade_recebida INTEGER NOT NULL DEFAULT 0 CHECK (quantidade_recebida >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'pendente'
        CHECK (status IN ('pendente', 'aprovado', 'recusado', 'recebido')),
    -- Por que o solicitante está pedindo (ou observação livre do item).
    justificativa VARCHAR(255),
    -- Motivo da recusa / observação de quem aprovou.
    observacao_aprovacao VARCHAR(255),
    criado_em TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_almoxpedidoitem_pedido ON almoxarifadopedidoitem (idpedido);
CREATE INDEX IF NOT EXISTS idx_almoxpedidoitem_item ON almoxarifadopedidoitem (iditem);

CREATE TABLE IF NOT EXISTS almoxarifadocotacao (
    idcotacao SERIAL PRIMARY KEY,
    idpedidoitem INTEGER NOT NULL REFERENCES almoxarifadopedidoitem(idpedidoitem) ON DELETE CASCADE,
    -- Fornecedor cadastrado quando existir; senão só o nome digitado (loja
    -- avulsa, marketplace, etc.) — por isso os dois campos e nenhum NOT NULL.
    idfornecedor INTEGER REFERENCES fornecedores(idfornecedor),
    fornecedor_nome VARCHAR(120),
    valor_unitario NUMERIC(14, 2) NOT NULL CHECK (valor_unitario >= 0),
    prazo_entrega_dias INTEGER CHECK (prazo_entrega_dias >= 0),
    observacao VARCHAR(255),
    escolhida BOOLEAN NOT NULL DEFAULT FALSE,
    idusuario INTEGER,
    criado_em TIMESTAMP DEFAULT NOW(),
    CONSTRAINT chk_almoxcotacao_fornecedor CHECK (idfornecedor IS NOT NULL OR NULLIF(TRIM(fornecedor_nome), '') IS NOT NULL)
);

-- Só uma cotação escolhida por item (as outras ficam guardadas como comparativo).
CREATE UNIQUE INDEX IF NOT EXISTS idx_almoxcotacao_escolhida_unica
    ON almoxarifadocotacao (idpedidoitem) WHERE escolhida;

CREATE INDEX IF NOT EXISTS idx_almoxcotacao_pedidoitem ON almoxarifadocotacao (idpedidoitem);

-- Compra efetivada: uma linha por recebimento confirmado. É a tabela que responde
-- "quando comprei, de quem, por quanto" e, cruzada com as saídas do histórico,
-- "quanto tempo esse estoque durou".
CREATE TABLE IF NOT EXISTS almoxarifadocompra (
    idcompra SERIAL PRIMARY KEY,
    idempresa INTEGER NOT NULL,
    iditem INTEGER REFERENCES almoxarifadogeral(iditem),
    idpedidoitem INTEGER REFERENCES almoxarifadopedidoitem(idpedidoitem),
    descricao VARCHAR(120) NOT NULL,
    idfornecedor INTEGER REFERENCES fornecedores(idfornecedor),
    fornecedor_nome VARCHAR(120),
    quantidade INTEGER NOT NULL CHECK (quantidade > 0),
    valor_unitario NUMERIC(14, 2) CHECK (valor_unitario >= 0),
    dt_compra DATE NOT NULL DEFAULT CURRENT_DATE,
    -- Entrada gerada no estoque por esta compra (rastreabilidade dos dois lados).
    idmovimentacao INTEGER REFERENCES almoxarifadogeralhistorico(idmovimentacao),
    idusuario INTEGER,
    criado_em TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_almoxcompra_item_data ON almoxarifadocompra (iditem, dt_compra);
CREATE INDEX IF NOT EXISTS idx_almoxcompra_fornecedor ON almoxarifadocompra (idfornecedor);
