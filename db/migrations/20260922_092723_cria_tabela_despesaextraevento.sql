-- Migration: cria tabela despesaextraevento
-- Criada em: 2026-09-22T09:27:23.000Z
--
-- Novo lançamento financeiro pra imprevisto do evento (equipamento quebrado, multa,
-- reposição de suprimento, etc.) -- despesa REAL que hoje não tem onde entrar. Espelha
-- staffajustefinanceiro (Crédito/Débito de funcionário), mas escopado por EVENTO, não
-- por funcionário ou orçamento: um evento pode ter vários orçamentos (cliente pede pra
-- separar em mais de uma fatura -- comum, já visto até 8 orçamentos pro mesmo evento no
-- mesmo período), então idorcamento sozinho obrigaria escolher um dos irmãos sem sentido.
-- idevento + dtreferencia é a mesma dupla já usada noutras consultas do CEO Mode pra
-- distinguir edições de um evento recorrente (mesmo idevento, anos diferentes) sem vazar
-- custo de um ano pro outro -- idevento sozinho teria esse mesmo problema.
--
-- idorcamento fica como referência OPCIONAL (rastreio/nota fiscal), nunca usado pra
-- escopar o custo.
--
-- tipo 'Despesa' aumenta o custo do evento; 'Estorno' reduz (ex: seguro reembolsou parte).

CREATE TABLE despesaextraevento (
    iddespesaextra        SERIAL PRIMARY KEY,
    idevento              INTEGER NOT NULL REFERENCES eventos(idevento),
    dtreferencia          DATE NOT NULL,
    idorcamento           INTEGER REFERENCES orcamentos(idorcamento),
    idempresa             INTEGER NOT NULL,
    categoria             VARCHAR(60) NOT NULL,
    tipo                  VARCHAR(20) NOT NULL CHECK (tipo IN ('Despesa', 'Estorno')),
    valor                 NUMERIC(12,2) NOT NULL CHECK (valor > 0),
    justificativa          TEXT NOT NULL,
    comprovante           TEXT,
    status                VARCHAR(20) NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Pago')),
    idfuncionario         INTEGER REFERENCES funcionarios(idfuncionario),
    idusuariolancamento   INTEGER,
    dtlancamento          TIMESTAMP NOT NULL DEFAULT now(),
    idusuarioaprovacao    INTEGER,
    dtaprovacao           TIMESTAMP,
    dtpagamento           TIMESTAMP
);

CREATE INDEX idx_despesaextraevento_idevento ON despesaextraevento(idevento);
CREATE INDEX idx_despesaextraevento_idorcamento ON despesaextraevento(idorcamento);
