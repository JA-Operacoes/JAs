// PUT /orcamento/:id (routes/rotaOrcamento.js) ativa o staffevento (statusstaff='Ativo')
// quando a solicitação incluída no orçamento é 'Autorizado'. Antes da correção, isso
// acontecia mesmo que existisse OUTRA solicitação ainda 'Pendente' pro mesmo staffevento
// (ex: o lado FuncExcedido de um combo, ainda não resolvido) — este teste garante que o
// guard `temOutrasPendencias` mantém statusstaff='Pendente' nesse caso, e só ativa
// quando não há mais nenhuma pendência.
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
const rotaOrcamento = require("../../routes/rotaOrcamento");

const app = express();
app.use(express.json());
app.use(rotaOrcamento);

const normalizar = (sql) => sql.replace(/\s+/g, " ").trim();

function montarClienteMock({ temOutraPendente }) {
  const query = jest.fn((sql, params) => {
    const s = normalizar(sql);

    // Preflight do logMiddleware (buscarDadosAnteriores) — dado anterior do orçamento
    if (s.includes("json_agg(oi.*)")) {
      return Promise.resolve({ rows: [{ idorcamento: 900, idempresa: 2 }] });
    }
    // Query-chave do "Path aditivoextra": encontra a solicitação Autorizada incluída
    if (s.includes("categoria_log = 'aditivoextra'") && s.includes("status = 'Autorizado'")) {
      return Promise.resolve({ rows: [{ idregistroalterado: 3400, status: "Autorizado", categoria_log: "aditivoextra" }] });
    }
    // O guard em si: existe OUTRA solicitação Pendente pro mesmo staffevento?
    if (s.includes("status = 'Pendente' AND idsolicitacao != ALL")) {
      return Promise.resolve({ rows: temOutraPendente ? [{ x: 1 }] : [] });
    }
    // Todo o resto (UPDATE orcamentos, pavilhões, itens existentes, INSERT orcamentoitens,
    // o próprio UPDATE staffeventos, etc.) — respostas neutras/vazias, não afetam o guard.
    return Promise.resolve({ rows: [] });
  });
  return { query, release: jest.fn() };
}

function corpoBase() {
  return {
    status: "F",
    idCliente: 184, idEvento: 55, idMontagem: 1,
    itensPavilhoes: [], idsPavilhoes: [],
    ignorarDuplicata: true,
    itensSemSetorPermitidos: [5],
    itens: [
      {
        idfuncao: 5, adicional: true, setor: "", categoria: "Produto(s)",
        qtditens: 1, qtdDias: 1, ids_solicitacoes: [901],
        vlrdiaria: 200, totvdadiaria: 200, ctodiaria: 100, totctodiaria: 100,
        totajdctoitem: 0, totgeralitem: 100, cachefechado: false,
      },
    ],
  };
}

describe("PUT /orcamento/:id — guard de outras pendências antes de ativar staffevento", () => {
  afterEach(() => jest.clearAllMocks());

  test("sem outra solicitação pendente: staffevento é ativado", async () => {
    const cliente = montarClienteMock({ temOutraPendente: false });
    pool.connect.mockResolvedValue(cliente);

    const res = await request(app).put("/900").send(corpoBase());

    expect(res.status).toBe(200);
    const chamadaAtivacao = cliente.query.mock.calls.find(([sql]) =>
      normalizar(sql).includes("UPDATE staffeventos") && normalizar(sql).includes("statusstaff = $3")
    );
    expect(chamadaAtivacao).toBeDefined();
    expect(chamadaAtivacao[1]).toEqual([3400, 2, "Ativo"]);
  });

  test("com outra solicitação pendente pro mesmo staffevento: statusstaff continua Pendente", async () => {
    const cliente = montarClienteMock({ temOutraPendente: true });
    pool.connect.mockResolvedValue(cliente);

    const res = await request(app).put("/900").send(corpoBase());

    expect(res.status).toBe(200);
    const chamadaAtivacao = cliente.query.mock.calls.find(([sql]) =>
      normalizar(sql).includes("UPDATE staffeventos") && normalizar(sql).includes("statusstaff = $3")
    );
    expect(chamadaAtivacao).toBeDefined();
    expect(chamadaAtivacao[1]).toEqual([3400, 2, "Pendente"]);
  });
});
