// GET /main/notificacoes-financeiras (routes/rotaMain.js) monta o card combinado
// "Aditivo - Limite Financeiro da Equipe Excedido" + "FuncExcedido + Estouro Financeiro"
// mesclando linhas do mesmo idstaffevento. O GROUP BY da query base inclui s.status,
// então uma solicitação multi-data com status misto vira 2 linhas SQL (uma por status,
// cada uma só com as datas daquele status) — este teste garante que o merge concatena
// as datas das duas linhas em vez de descartar uma delas.
jest.mock("../../db/conexaoDB", () => ({ query: jest.fn() }));
jest.mock("../../middlewares/authMiddlewares", () => ({
  autenticarToken: () => (req, res, next) => {
    req.idempresa = 2;
    req.usuario = { idusuario: 99 };
    next();
  },
  contextoEmpresa: (req, res, next) => next(),
}));

const express = require("express");
const request = require("supertest");
const pool = require("../../db/conexaoDB");
const rotaMain = require("../../routes/rotaMain");

const app = express();
app.use(express.json());
app.use(rotaMain);

function linhaSql({ idsolicitacao, tiposolicitacao, status, data, idstaffevento = 500 }) {
  return {
    id_log: idsolicitacao,
    idstaffevento,
    idexecutor: 1,
    descfuncao: "FISCAL DIURNO",
    descfuncao_original: "FISCAL DIURNO",
    tiposolicitacao,
    nomesolicitante: "Marcia Lima",
    nomeaprovador: null,
    datadecisao: null,
    nomefuncionario: "HAILANDER PACHECO DOS SANTOS",
    evento: "ITAJAÍ BOAT SHOW",
    datasevento: [],
    criado_em: "2026-08-01T10:00:00.000Z",
    categoria: "aditivoextra",
    status_atual: status,
    vlrsolicitado: 0,
    desccaixinha: "",
    dtsolicitada_agrupada: [
      { idsolicitacao, data: [data], status, justificativa: "", tiposolicitacao },
    ],
    dtfimrealizacao: null,
    idusuarioalvo: 768,
    vlralimentacao: 0,
    vlrtransporte: 0,
    vlrcache: 0,
    dtdiariadobrada: null,
    dtmeiadiaria: null,
    nmfuncao_destino: "FISCAL DIURNO",
    vagasreaproveitadas_raw: null,
    idorcamento_sol: null,
    idequipe_sol: null,
  };
}

describe("GET /notificacoes-financeiras — merge do combo FuncExcedido+Aditivo", () => {
  afterEach(() => jest.clearAllMocks());

  test("solicitação multi-data com status misto: mescla as 2 linhas SQL em 1 card com todas as datas", async () => {
    pool.query.mockReset();
    pool.query.mockResolvedValueOnce({ rows: [{ modulo: "Staff", master: true, supremo: false }] }); // permissoes
    pool.query.mockResolvedValueOnce({
      rows: [
        linhaSql({ idsolicitacao: 1, tiposolicitacao: "Aditivo - Limite Financeiro da Equipe Excedido", status: "Autorizado", data: "2026-08-01" }),
        linhaSql({ idsolicitacao: 2, tiposolicitacao: "Aditivo - Limite Financeiro da Equipe Excedido", status: "Pendente", data: "2026-08-02" }),
        linhaSql({ idsolicitacao: 3, tiposolicitacao: "FuncExcedido + Estouro Financeiro", status: "Autorizado", data: "2026-08-01" }),
        linhaSql({ idsolicitacao: 4, tiposolicitacao: "FuncExcedido + Estouro Financeiro", status: "Pendente", data: "2026-08-02" }),
      ],
    }); // queryBase

    const res = await request(app).get("/notificacoes-financeiras");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);

    const card = res.body[0];
    expect(card.isComboFuncExcedidoAditivo).toBe(true);

    const datasAditivo = card.dadosAditivo.solicitacoes_individuais.map((s) => s.data[0]).sort();
    const datasFuncExcedido = card.dadosFuncExcedido.solicitacoes_individuais.map((s) => s.data[0]).sort();
    expect(datasAditivo).toEqual(["2026-08-01", "2026-08-02"]);
    expect(datasFuncExcedido).toEqual(["2026-08-01", "2026-08-02"]);

    // cada data mantém o próprio status, não foi sobrescrita pela outra
    const porData = (sols) => Object.fromEntries(sols.map((s) => [s.data[0], s.status]));
    expect(porData(card.dadosAditivo.solicitacoes_individuais)).toEqual({
      "2026-08-01": "Autorizado",
      "2026-08-02": "Pendente",
    });
    expect(porData(card.dadosFuncExcedido.solicitacoes_individuais)).toEqual({
      "2026-08-01": "Autorizado",
      "2026-08-02": "Pendente",
    });
  });

  test("solicitação de data única (sem status misto): continua funcionando igual antes", async () => {
    pool.query.mockReset();
    pool.query.mockResolvedValueOnce({ rows: [{ modulo: "Staff", master: true, supremo: false }] });
    pool.query.mockResolvedValueOnce({
      rows: [
        linhaSql({ idsolicitacao: 10, tiposolicitacao: "Aditivo - Limite Financeiro da Equipe Excedido", status: "Pendente", data: "2026-09-01" }),
        linhaSql({ idsolicitacao: 11, tiposolicitacao: "FuncExcedido + Estouro Financeiro", status: "Pendente", data: "2026-09-01" }),
      ],
    });

    const res = await request(app).get("/notificacoes-financeiras");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].dadosAditivo.solicitacoes_individuais).toHaveLength(1);
    expect(res.body[0].dadosFuncExcedido.solicitacoes_individuais).toHaveLength(1);
  });
});

describe("GET /notificacoes-financeiras — merge do combo FuncExcedido+Vaga Excedida", () => {
  afterEach(() => jest.clearAllMocks());

  test("natureza Aditivo: mescla em 1 card com isComboAditivoFuncVaga=true", async () => {
    pool.query.mockReset();
    pool.query.mockResolvedValueOnce({ rows: [{ modulo: "Staff", master: true, supremo: false }] });
    pool.query.mockResolvedValueOnce({
      rows: [
        linhaSql({ idsolicitacao: 21, tiposolicitacao: "Aditivo - Vaga Excedida", status: "Pendente", data: "2026-08-01", idstaffevento: 600 }),
        linhaSql({ idsolicitacao: 22, tiposolicitacao: "Aditivo - Vaga Excedida", status: "Autorizado", data: "2026-08-02", idstaffevento: 600 }),
        linhaSql({ idsolicitacao: 23, tiposolicitacao: "FuncExcedido + Vaga Excedida", status: "Pendente", data: "2026-08-01", idstaffevento: 600 }),
        linhaSql({ idsolicitacao: 24, tiposolicitacao: "FuncExcedido + Vaga Excedida", status: "Autorizado", data: "2026-08-02", idstaffevento: 600 }),
      ],
    });

    const res = await request(app).get("/notificacoes-financeiras");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);

    const card = res.body[0];
    expect(card.isComboFuncExcedidoVaga).toBe(true);
    expect(card.isComboAditivoFuncVaga).toBe(true);

    const datasAditivo = card.dadosAditivo.solicitacoes_individuais.map((s) => s.data[0]).sort();
    const datasFuncExcedido = card.dadosFuncExcedido.solicitacoes_individuais.map((s) => s.data[0]).sort();
    expect(datasAditivo).toEqual(["2026-08-01", "2026-08-02"]);
    expect(datasFuncExcedido).toEqual(["2026-08-01", "2026-08-02"]);
  });

  test("natureza Extra Bonificado: mescla em 1 card com isComboAditivoFuncVaga=false", async () => {
    pool.query.mockReset();
    pool.query.mockResolvedValueOnce({ rows: [{ modulo: "Staff", master: true, supremo: false }] });
    pool.query.mockResolvedValueOnce({
      rows: [
        linhaSql({ idsolicitacao: 31, tiposolicitacao: "Extra Bonificado - Vaga Excedida", status: "Pendente", data: "2026-09-01", idstaffevento: 601 }),
        linhaSql({ idsolicitacao: 32, tiposolicitacao: "FuncExcedido + Vaga Excedida", status: "Pendente", data: "2026-09-01", idstaffevento: 601 }),
      ],
    });

    const res = await request(app).get("/notificacoes-financeiras");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);

    const card = res.body[0];
    expect(card.isComboFuncExcedidoVaga).toBe(true);
    expect(card.isComboAditivoFuncVaga).toBe(false);
  });

  test("não mistura com o combo Estouro Financeiro quando os dois existem ao mesmo tempo", async () => {
    pool.query.mockReset();
    pool.query.mockResolvedValueOnce({ rows: [{ modulo: "Staff", master: true, supremo: false }] });
    pool.query.mockResolvedValueOnce({
      rows: [
        linhaSql({ idsolicitacao: 41, tiposolicitacao: "Aditivo - Limite Financeiro da Equipe Excedido", status: "Pendente", data: "2026-10-01", idstaffevento: 700 }),
        linhaSql({ idsolicitacao: 42, tiposolicitacao: "FuncExcedido + Estouro Financeiro", status: "Pendente", data: "2026-10-01", idstaffevento: 700 }),
        linhaSql({ idsolicitacao: 43, tiposolicitacao: "Aditivo - Vaga Excedida", status: "Pendente", data: "2026-10-01", idstaffevento: 701 }),
        linhaSql({ idsolicitacao: 44, tiposolicitacao: "FuncExcedido + Vaga Excedida", status: "Pendente", data: "2026-10-01", idstaffevento: 701 }),
      ],
    });

    const res = await request(app).get("/notificacoes-financeiras");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);

    const cardFinanceiro = res.body.find((c) => c.isComboFuncExcedidoAditivo);
    const cardVaga = res.body.find((c) => c.isComboFuncExcedidoVaga);
    expect(cardFinanceiro).toBeDefined();
    expect(cardVaga).toBeDefined();
    expect(cardFinanceiro.isComboFuncExcedidoVaga).toBeFalsy();
    expect(cardVaga.isComboFuncExcedidoAditivo).toBeFalsy();
  });
});
