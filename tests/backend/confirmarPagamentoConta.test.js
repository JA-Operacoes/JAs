// POST /confirmar-pagamento-conta (routes/rotaMain.js:4129-4223)
// Grava/atualiza uma parcela em `pagamentos` (contas a pagar). Cobre a correção
// de 2026-09-01: a rota lia `req.headers.idempresa` (cru, não validado) em vez de
// `req.idempresa` (já validado pelo autenticarToken contra as empresas do usuário
// no token) — um header `idempresa` divergente do `x-id-empresa` usado na
// autenticação permitia gravar o pagamento em outra empresa. O default de
// `statusFinal` também foi trocado de 'pago' para 'pendente' quando o corpo não
// envia `status`.
jest.mock("../../db/conexaoDB", () => ({ query: jest.fn(), connect: jest.fn() }));
jest.mock("../../middlewares/authMiddlewares", () => ({
  autenticarToken: () => (req, res, next) => {
    // Simula o autenticarToken real: já validou a empresa contra o token do
    // usuário e resolveu req.idempresa. Um eventual header "idempresa" no
    // corpo da requisição de teste representa um valor NÃO validado.
    req.idempresa = 5;
    req.usuario = { idusuario: 99 };
    next();
  },
  contextoEmpresa: (req, res, next) => next(),
}));
jest.mock("../../utils/logger", () => jest.fn().mockResolvedValue());

const express = require("express");
const request = require("supertest");
const pool = require("../../db/conexaoDB");
const { autenticarToken } = require("../../middlewares/authMiddlewares");
const rotaMain = require("../../routes/rotaMain");

// server.js monta o router com `app.use("/Main", autenticarToken(), require("./routes/rotaMain"))`
// — a rota /confirmar-pagamento-conta não chama autenticarToken() internamente (diferente de
// outras rotas deste arquivo), então precisamos reproduzir esse mesmo mount aqui.
const app = express();
app.use(express.json());
app.use(autenticarToken(), rotaMain);

const normalizar = (sql) => sql.replace(/\s+/g, " ").trim();

function mockarBanco({ registroExistente = null } = {}) {
  pool.query.mockReset();
  pool.query.mockImplementation((sql) => {
    const s = normalizar(sql);
    if (s.startsWith("SELECT idpagamento, status, vlrpago")) {
      // buscarDadosAnteriores do logMiddleware — não afeta a resposta.
      return Promise.resolve({ rows: registroExistente ? [registroExistente] : [] });
    }
    return Promise.resolve({ rows: [] });
  });

  const client = {
    query: jest.fn((sql) => {
      const s = normalizar(sql);
      if (s === "BEGIN" || s === "COMMIT" || s === "ROLLBACK") return Promise.resolve();
      if (s.startsWith("SELECT idpagamento FROM pagamentos WHERE idlancamento")) {
        return Promise.resolve({ rows: registroExistente ? [registroExistente] : [] });
      }
      if (s.startsWith("INSERT INTO pagamentos")) {
        return Promise.resolve({ rows: [{ idpagamento: 555 }] });
      }
      if (s.startsWith("UPDATE pagamentos")) {
        return Promise.resolve({ rowCount: 1 });
      }
      return Promise.resolve({ rows: [] });
    }),
    release: jest.fn(),
  };
  pool.connect.mockReset();
  pool.connect.mockResolvedValue(client);
  return client;
}

function chamadaInsert(client) {
  return client.query.mock.calls.find(([sql]) => normalizar(sql).startsWith("INSERT INTO pagamentos"));
}

function chamadaUpdate(client) {
  return client.query.mock.calls.find(([sql]) => normalizar(sql).startsWith("UPDATE pagamentos"));
}

describe("POST /confirmar-pagamento-conta", () => {
  let logSpy, errorSpy;
  beforeAll(() => {
    logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterAll(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });
  afterEach(() => jest.clearAllMocks());

  test("grava com req.idempresa (validado), ignorando um header 'idempresa' manipulado", async () => {
    const client = mockarBanco();

    const res = await request(app)
      .post("/confirmar-pagamento-conta")
      .set("idempresa", "999") // valor cru/não validado, diferente da empresa do token (5)
      .send({ idlancamento: 10, dtvcto: "2026-09-05", vlrpago: 100, status: "pago" });

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);

    const insert = chamadaInsert(client);
    expect(insert).toBeDefined();
    const idempresaGravado = insert[1][1]; // params: [idlancamento, idempresa, vlrpago, dtvcto, status, ...]
    expect(idempresaGravado).toBe(5);
    expect(idempresaGravado).not.toBe(999);
  });

  test("sem 'status' no corpo, grava como 'pendente' (não assume pago)", async () => {
    const client = mockarBanco();

    const res = await request(app)
      .post("/confirmar-pagamento-conta")
      .send({ idlancamento: 10, dtvcto: "2026-09-05", vlrpago: 100 });

    expect(res.status).toBe(200);

    const insert = chamadaInsert(client);
    const statusGravado = insert[1][4];
    expect(statusGravado).toBe("pendente");
  });

  test("quando já existe pagamento para o vencimento, atualiza (UPDATE) usando req.idempresa validado", async () => {
    const client = mockarBanco({ registroExistente: { idpagamento: 42 } });

    const res = await request(app)
      .post("/confirmar-pagamento-conta")
      .set("idempresa", "999")
      .send({ idlancamento: 10, dtvcto: "2026-09-05", vlrpago: 200, status: "pago" });

    expect(res.status).toBe(200);
    expect(res.body.idpagamento).toBe(42);

    const update = chamadaUpdate(client);
    expect(update).toBeDefined();
    // params: [status, vlrpago, dtpagamento, observacao, vlratraso, vlrdesconto, idFinal, idempresa]
    expect(update[1][7]).toBe(5);
    expect(chamadaInsert(client)).toBeUndefined();
  });
});
