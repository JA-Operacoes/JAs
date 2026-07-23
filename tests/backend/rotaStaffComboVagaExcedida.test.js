// POST /staff (routes/rotaStaff.js) grava o combo "FuncExcedido + Vaga Excedida":
// quando tipoSolicitacaoAditivo começa com esse literal, duas linhas devem ser
// gravadas em public.solicitacoes por data — Solicitação 1 (Aditivo ou Extra
// Bonificado - Vaga Excedida, categoria_log='aditivoextra') e Solicitação 2
// (FuncExcedido + Vaga Excedida, categoria_log='statusvagaexcedida', travada
// até a Solicitação 1 ser resolvida) — mesmo padrão já usado pro combo
// FuncExcedido + Estouro Financeiro.
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

function montarClienteMock() {
  const query = jest.fn((sql) => {
    const s = normalizar(sql);
    if (s.includes("FROM staff s")) {
      return Promise.resolve({ rows: [{ idstaff: 700 }] }); // staff já existe
    }
    if (s.includes("INSERT INTO staffeventos")) {
      return Promise.resolve({ rows: [{ idstaffevento: 9001 }] });
    }
    return Promise.resolve({ rows: [] });
  });
  return { query, release: jest.fn() };
}

function corpoBase(tipoSolicitacaoAditivo) {
  return {
    idfuncionario: 10, nmfuncionario: "FULANO DE TAL", idevento: 55, nmevento: "EVENTO X",
    idcliente: 184, nmcliente: "CLIENTE X", idfuncao: 5, nmfuncao: "FISCAL DIURNO",
    idmontagem: 1, nmlocalmontagem: "LOCAL X", pavilhao: "",
    vlrcache: "100", vlralimentacao: "0", vlrtransporte: "0", vlrajustecusto: "0", vlrcaixinha: "0",
    datasevento: JSON.stringify(["2026-08-01", "2026-08-02"]),
    descajustecusto: "", descbeneficios: "", vlrtotal: "200", setor: "",
    tipoSolicitacaoAditivo,
    justificativaAditivo: "conflito de agendamento e vaga excedida",
  };
}

describe("POST /staff — combo FuncExcedido + Vaga Excedida", () => {
  beforeEach(() => {
    pool.query.mockResolvedValue({ rows: [] });
  });
  afterEach(() => jest.clearAllMocks());

  test("natureza Aditivo: grava 'Aditivo - Vaga Excedida' + 'FuncExcedido + Vaga Excedida' por data", async () => {
    const cliente = montarClienteMock();
    pool.connect.mockResolvedValue(cliente);

    const res = await request(app).post("/").send(corpoBase("FuncExcedido + Vaga Excedida (Aditivo)"));

    expect(res.status).toBe(201);
    const chamadasSolicitacao = cliente.query.mock.calls.filter(([sql]) =>
      normalizar(sql).includes("INSERT INTO public.solicitacoes")
    );
    // 2 datas x 2 solicitações = 4 inserts
    expect(chamadasSolicitacao).toHaveLength(4);

    const tipos = chamadasSolicitacao.map(([, params]) => params[4]);
    const categorias = chamadasSolicitacao.map(([, params]) => params[12]);
    expect(tipos.filter(t => t === "Aditivo - Vaga Excedida")).toHaveLength(2);
    expect(tipos.filter(t => t === "FuncExcedido + Vaga Excedida")).toHaveLength(2);
    expect(categorias.filter(c => c === "aditivoextra")).toHaveLength(2);
    expect(categorias.filter(c => c === "statusvagaexcedida")).toHaveLength(2);

    // Ambas as solicitações da mesma data compartilham o mesmo idregistroalterado
    const idregistroalterados = new Set(chamadasSolicitacao.map(([, params]) => params[13]));
    expect(idregistroalterados.size).toBe(1);
    expect([...idregistroalterados][0]).toBe(9001);
  });

  test("natureza Extra Bonificado: grava 'Extra Bonificado - Vaga Excedida' + 'FuncExcedido + Vaga Excedida' por data", async () => {
    const cliente = montarClienteMock();
    pool.connect.mockResolvedValue(cliente);

    const res = await request(app).post("/").send(corpoBase("FuncExcedido + Vaga Excedida (Extra Bonificado)"));

    expect(res.status).toBe(201);
    const chamadasSolicitacao = cliente.query.mock.calls.filter(([sql]) =>
      normalizar(sql).includes("INSERT INTO public.solicitacoes")
    );
    expect(chamadasSolicitacao).toHaveLength(4);

    const tipos = chamadasSolicitacao.map(([, params]) => params[4]);
    expect(tipos.filter(t => t === "Extra Bonificado - Vaga Excedida")).toHaveLength(2);
    expect(tipos.filter(t => t === "FuncExcedido + Vaga Excedida")).toHaveLength(2);
  });
});
