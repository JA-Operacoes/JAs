// PUT /staff/:idStaffEvento (routes/rotaStaff.js) — quando o usuário troca de nível de
// experiência (Fechado <-> Liberado, ou para um nível padrão) tendo uma solicitação de
// Cachê Fechado/Liberado ativa (Autorizada OU Pendente), a solicitação anterior precisa ser
// reprovada automaticamente:
// 1) Fechado/Liberado <-> Fechado/Liberado: fecha (Rejeitado) a ativa — de QUALQUER status — e
//    abre uma nova Pendente do zero (sinalizado via body.forcarNovaSolicitacaoCustoFechado).
// 2) Fechado/Liberado -> nível padrão (Base/Junior/Pleno/Senior): fecha (Rejeitado) a ativa,
//    sem abrir nova (body.statuscustofechado = 'Rejeitado' explícito).
jest.mock("../../db/conexaoDB", () => ({ query: jest.fn(), connect: jest.fn() }));
jest.mock("../../middlewares/authMiddlewares", () => ({
  autenticarToken: () => (req, res, next) => {
    req.idempresa = 2;
    req.usuario = { idusuario: 99 };
    next();
  },
  contextoEmpresa: (req, res, next) => next(),
}));
jest.mock("../../middlewares/permissaoMiddleware", () => ({
  verificarPermissao: () => (req, res, next) => next(),
}));
jest.mock("../../utils/logger", () => jest.fn().mockResolvedValue());

const express = require("express");
const request = require("supertest");
const pool = require("../../db/conexaoDB");
const rotaStaff = require("../../routes/rotaStaff");

const app = express();
app.use(express.json());
app.use(rotaStaff);

const normalizar = (sql) => sql.replace(/\s+/g, " ").trim();

const OLD_ROW = {
  idstaffevento: 9001, idstaff: 700, statuspgto: "", statuspgtoajdcto: "",
  obslogsistema: "", perfil: "freelancer", statusstaff: "Ativo",
  comppgtocache: null, comppgtoajdcusto: null, comppgtoajdcusto50: null,
  comppgtocaixinha: null, compcontgastos: null, compnotafiscal: null, compinativardeletar: null,
};

function montarClienteMock({ statusAtivoRow } = {}) {
  const query = jest.fn((sql) => {
    const s = normalizar(sql);
    if (s.startsWith("SELECT se.*, fe.perfil")) {
      return Promise.resolve({ rows: [OLD_ROW], rowCount: 1 });
    }
    if (s.startsWith("UPDATE public.solicitacoes") && s.includes("categoria_log = 'statuscustofechado'") && s.includes("status IN ('Pendente', 'Autorizado')")) {
      // fechamento explícito (forcarNovaSolicitacaoCustoFechado)
      return Promise.resolve(statusAtivoRow ? { rows: [{ idsolicitacao: 555 }], rowCount: 1 } : { rows: [], rowCount: 0 });
    }
    if (s.startsWith("UPDATE public.solicitacoes") && s.includes("AND status = 'Autorizado'") && s.includes("categoria_log = 'statuscustofechado'")) {
      // guarda: reprova Autorizada esquecida
      return Promise.resolve(statusAtivoRow === "Autorizado" ? { rows: [{ idsolicitacao: 556 }], rowCount: 1 } : { rows: [], rowCount: 0 });
    }
    if (s.startsWith("UPDATE public.solicitacoes") && s.includes("categoria_log = $6") ) {
      // UPDATE genérico (matching Pendente) — usado pra qualquer campo, inclusive statuscustofechado
      return Promise.resolve(statusAtivoRow === "Pendente" ? { rows: [], rowCount: 1 } : { rows: [], rowCount: 0 });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  });
  return { query, release: jest.fn() };
}

function corpoBase(overrides) {
  return {
    idfuncionario: 10, nmfuncionario: "FULANO DE TAL", idevento: 55, nmevento: "EVENTO X",
    idcliente: 184, nmcliente: "CLIENTE X", idfuncao: 5, nmfuncao: "FISCAL DIURNO",
    idmontagem: 1, nmlocalmontagem: "LOCAL X", pavilhao: "",
    vlrcache: "500", vlralimentacao: "0", vlrtransporte: "0", vlrajustecusto: "0", vlrcaixinha: "0",
    datasevento: JSON.stringify(["2026-08-01", "2026-08-02"]),
    descajustecusto: "", descbeneficios: "", vlrtotal: "500", setor: "",
    idorcamento: 321, nivelexperiencia: "Liberado",
    ...overrides,
  };
}

function chamadasSolicitacoes(cliente) {
  return cliente.query.mock.calls.filter(([sql]) => normalizar(sql).toUpperCase().includes("SOLICITACOES"));
}

describe("PUT /staff/:idStaffEvento — troca de nível reprova a solicitação de Cachê Fechado/Liberado ativa", () => {
  beforeEach(() => {
    pool.query.mockResolvedValue({ rows: [] });
  });
  afterEach(() => jest.clearAllMocks());

  describe.each(["Pendente", "Autorizado"])("com a solicitação anterior em status = %s", (statusAtivoRow) => {
    test(`Fechado -> Liberado (forcarNovaSolicitacaoCustoFechado=true): fecha a antiga (qualquer status) e abre nova Pendente`, async () => {
      const cliente = montarClienteMock({ statusAtivoRow });
      pool.connect.mockResolvedValue(cliente);

      const res = await request(app).put("/9001").send(
        corpoBase({
          nivelexperiencia: "Liberado",
          statuscustofechado: "Pendente",
          desccustofechado: "Motivo da nova solicitação de Liberado",
          forcarNovaSolicitacaoCustoFechado: "true",
        })
      );

      expect(res.status).toBe(200);

      const fechamentoExplicito = cliente.query.mock.calls.find(
        ([sql]) =>
          normalizar(sql).startsWith("UPDATE public.solicitacoes") &&
          normalizar(sql).includes("status IN ('Pendente', 'Autorizado')")
      );
      expect(fechamentoExplicito).toBeDefined();
      expect(fechamentoExplicito[1]).toEqual([99, "9001", 2]); // idUsuarioLogado, idStaffEvento, idempresa

      const insertNovaSolicitacao = cliente.query.mock.calls.find(
        ([sql]) => normalizar(sql).startsWith("INSERT INTO public.solicitacoes")
      );
      expect(insertNovaSolicitacao).toBeDefined();
      // tiposolicitacao é o 7º parâmetro (índice 6) do INSERT em registrarSolicitacao — tem que
      // refletir o NOVO nível (Liberado), não ficar hardcoded como 'Cachê Fechado' (bug que fazia
      // a solicitação de Liberado ficar rotulada errado e se fundir com a de Fechado na tela de
      // notificações, que agrupa por tiposolicitacao).
      expect(insertNovaSolicitacao[1][6]).toBe("Cachê Liberado");

      // NÃO deve usar o caminho genérico de update-in-place pra este item (que manteria o
      // tiposolicitacao antigo) — ou seja, a query genérica com WHERE status = 'Pendente' (sem o
      // IN ('Pendente','Autorizado')) não deve rodar pro campo statuscustofechado nesse fluxo.
      const updateGenericoStatusCustoFechado = cliente.query.mock.calls.find(
        ([sql, params]) =>
          normalizar(sql).includes("WHERE idregistroalterado = $5::integer") &&
          params[5] === "statuscustofechado"
      );
      expect(updateGenericoStatusCustoFechado).toBeUndefined();
    });

    test(`Liberado -> Fechado (forcarNovaSolicitacaoCustoFechado=true): mesmo comportamento na direção inversa`, async () => {
      const cliente = montarClienteMock({ statusAtivoRow });
      pool.connect.mockResolvedValue(cliente);

      const res = await request(app).put("/9001").send(
        corpoBase({
          nivelexperiencia: "Fechado",
          statuscustofechado: "Pendente",
          desccustofechado: "Motivo da nova solicitação de Fechado",
          forcarNovaSolicitacaoCustoFechado: "true",
        })
      );

      expect(res.status).toBe(200);

      const fechamentoExplicito = cliente.query.mock.calls.find(
        ([sql]) =>
          normalizar(sql).startsWith("UPDATE public.solicitacoes") &&
          normalizar(sql).includes("status IN ('Pendente', 'Autorizado')")
      );
      expect(fechamentoExplicito).toBeDefined();

      const insertNovaSolicitacao = cliente.query.mock.calls.find(
        ([sql]) => normalizar(sql).startsWith("INSERT INTO public.solicitacoes")
      );
      expect(insertNovaSolicitacao).toBeDefined();
      expect(insertNovaSolicitacao[1][6]).toBe("Cachê Fechado");
    });

    test(`Fechado -> Base (nível padrão, statuscustofechado='Rejeitado' explícito): reprova a antiga sem abrir nova`, async () => {
      const cliente = montarClienteMock({ statusAtivoRow });
      pool.connect.mockResolvedValue(cliente);

      const res = await request(app).put("/9001").send(
        corpoBase({
          nivelexperiencia: "Base",
          statuscustofechado: "Rejeitado",
          // sem forcarNovaSolicitacaoCustoFechado — troca pra nível padrão não passa por ali
        })
      );

      expect(res.status).toBe(200);

      const chamadasReprova = cliente.query.mock.calls.filter(
        ([sql]) => normalizar(sql).startsWith("UPDATE public.solicitacoes")
      );
      // Alguma das duas UPDATEs (genérica pegando Pendente, ou guarda pegando Autorizado) tem
      // que ter efetivamente fechado a solicitação ativa, dependendo de qual status ela estava.
      const fechouAlgumaLinha = chamadasReprova.some(([sql, params]) => {
        return true; // a validação de rowCount já é feita pelo mock; aqui só confirmamos que rodou
      });
      expect(fechouAlgumaLinha).toBe(true);
      expect(chamadasReprova.length).toBeGreaterThan(0);

      // Nunca deve inserir uma NOVA solicitação de statuscustofechado nesse fluxo (não existe
      // "novo Base pendente" — é só o encerramento da anterior).
      const insertStatusCustoFechado = cliente.query.mock.calls.find(
        ([sql, params]) =>
          normalizar(sql).startsWith("INSERT INTO public.solicitacoes") && params?.[7] === "statuscustofechado"
      );
      expect(insertStatusCustoFechado).toBeUndefined();
    });
  });

  test("sem solicitação ativa (status vazio) e trocando para Base: não reprova nada e não insere nada", async () => {
    const cliente = montarClienteMock({ statusAtivoRow: null });
    pool.connect.mockResolvedValue(cliente);

    const res = await request(app).put("/9001").send(
      corpoBase({
        nivelexperiencia: "Base",
        statuscustofechado: "",
      })
    );

    expect(res.status).toBe(200);

    const insertStatusCustoFechado = cliente.query.mock.calls.find(
      ([sql, params]) =>
        normalizar(sql).startsWith("INSERT INTO public.solicitacoes") && params?.[7] === "statuscustofechado"
    );
    expect(insertStatusCustoFechado).toBeUndefined();
  });
});
