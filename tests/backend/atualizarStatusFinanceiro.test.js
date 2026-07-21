// POST /main/notificacoes-financeiras/atualizar-status (routes/rotaMain.js:2025-2614)
// é o único lugar que transiciona uma solicitação de Pendente -> Autorizado/Rejeitado
// para as 4 categorias abaixo. Ele roda 2 "fluxos" dependendo da categoria:
//   FLUXO A (aditivoextra / statusvagaexcedida): mexe em staffeventos.datasevento
//            e staffeventos.vagasreaproveitadas.
//   FLUXO B (statuscustofechado / statusdiariadobrada): grava direto na coluna
//            correspondente de staffeventos (statuscustofechado, ou o JSONB
//            dtdiariadobrada com o status daquela data específica alterado).
// Em ambos os fluxos, a tabela `solicitacoes` também é sempre atualizada
// (status = Autorizado/Rejeitado) antes de mexer em staffeventos.
jest.mock("../../db/conexaoDB", () => ({ query: jest.fn() }));
jest.mock("../../middlewares/authMiddlewares", () => ({
  autenticarToken: () => (req, res, next) => {
    req.idempresa = 2;
    req.usuario = { idusuario: 99 };
    next();
  },
  contextoEmpresa: (req, res, next) => next(),
}));
// utils/logger grava um log assíncrono em `res.on('finish', ...)`, fora do ciclo
// da resposta — não faz parte do que estamos testando aqui, e sem mockar ele
// tentaria abrir uma conexão real via `require('../db')`.
jest.mock("../../utils/logger", () => jest.fn().mockResolvedValue());

const express = require("express");
const request = require("supertest");
const pool = require("../../db/conexaoDB");
const rotaMain = require("../../routes/rotaMain");

const app = express();
app.use(express.json());
app.use(rotaMain);

const normalizar = (sql) => sql.replace(/\s+/g, " ").trim();

function encontrarChamada(padraoSql) {
  return pool.query.mock.calls.find(([sql]) => normalizar(sql).includes(padraoSql));
}

/**
 * pool.query é chamado várias vezes, em ordem, com SQLs bem diferentes entre si
 * (busca de dados anteriores do logMiddleware, busca da solicitação, o UPDATE
 * genérico de solicitacoes, a busca do registro mestre de staffeventos, checagem
 * de pendências e por fim o UPDATE final). Em vez de encadear mockResolvedValueOnce
 * na ordem exata (frágil), despachamos pela própria query SQL.
 */
function mockarBanco({ dadosSol, registro, temOutrasPendencias = false }) {
  pool.query.mockReset();
  pool.query.mockImplementation((sql) => {
    const s = normalizar(sql);

    if (s.includes("OR idstaffevento = (SELECT idregistroalterado FROM solicitacoes")) {
      // buscarDadosAnteriores do logMiddleware — não afeta a resposta.
      return Promise.resolve({ rows: [registro] });
    }
    if (s.startsWith("SELECT dtsolicitada, tiposolicitacao FROM public.solicitacoes")) {
      return Promise.resolve({ rows: dadosSol ? [dadosSol] : [] });
    }
    if (s.startsWith("UPDATE public.solicitacoes")) {
      return Promise.resolve({ rowCount: 1 });
    }
    if (s.includes("SELECT se.*, f.perfil")) {
      return Promise.resolve({ rows: registro ? [registro] : [] });
    }
    if (s.includes("idregistroalterado = $1 AND status = 'Pendente'")) {
      return Promise.resolve({ rows: temOutrasPendencias ? [{ ok: 1 }] : [] });
    }
    if (s.startsWith("UPDATE staffeventos") && s.includes("SET datasevento")) {
      return Promise.resolve({ rows: [{ ...registro, atualizado: true }], rowCount: 1 });
    }
    if (s.startsWith("UPDATE staffeventos SET dtdiariadobrada")) {
      return Promise.resolve({ rows: [{}], rowCount: 1 });
    }
    if (s.startsWith("UPDATE staffeventos se")) {
      return Promise.resolve({ rows: [{ ...registro, atualizado: true }], rowCount: 1 });
    }
    return Promise.resolve({ rows: [] });
  });
}

describe("POST /notificacoes-financeiras/atualizar-status", () => {
  let logSpy;
  beforeAll(() => {
    logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  });
  afterAll(() => logSpy.mockRestore());
  afterEach(() => jest.clearAllMocks());

  test("400 quando faltam dados obrigatórios", async () => {
    const res = await request(app)
      .post("/notificacoes-financeiras/atualizar-status")
      .send({ categoria: "statuscustofechado", acao: "Autorizado" }); // sem idpedido

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Dados incompletos");
  });

  test("404 quando o registro mestre em staffeventos não é encontrado", async () => {
    mockarBanco({ dadosSol: { dtsolicitada: null, tiposolicitacao: "" }, registro: null });

    const res = await request(app)
      .post("/notificacoes-financeiras/atualizar-status")
      .send({ idpedido: 1, categoria: "statuscustofechado", acao: "Autorizado", idlog_origem: 1 });

    expect(res.status).toBe(404);
  });

  describe("aditivoextra (FLUXO A)", () => {
    function registroBase() {
      return {
        idstaffevento: 500,
        datasevento: ["2026-08-01"],
        dtdiariadobrada: [],
        vagasreaproveitadas: [{ data: "2026-08-10", status: "Pendente", idfuncao_origem: 1 }],
        obsgeral: "",
        vlrcache: 100,
        vlrtransporte: 10,
        vlralimentacao: 20,
        qtdpessoaslote: 1,
        perfil: "freelancer",
        statuspgtoajdcto: "",
        vlrtotcache: 0,
        vlrtotajdcusto: 0,
      };
    }

    test("autorizar: soma a data à agenda e mantém staffstaff Pendente até inclusão no orçamento", async () => {
      mockarBanco({
        dadosSol: { dtsolicitada: ["2026-08-10"], tiposolicitacao: "Aditivo - Vaga Excedida" },
        registro: registroBase(),
      });

      const res = await request(app)
        .post("/notificacoes-financeiras/atualizar-status")
        .send({ idpedido: 601, categoria: "statusaditivoextra", acao: "Autorizado", idlog_origem: 900 });

      expect(res.status).toBe(200);
      expect(res.body).toEqual(
        expect.objectContaining({ sucesso: true, idlog_origem: 900, category: "statusaditivoextra" })
      );

      const chamadaSolicitacoes = encontrarChamada("UPDATE public.solicitacoes");
      expect(chamadaSolicitacoes[1]).toEqual(["Autorizado", 99, 601, 2]);

      const chamadaStaff = encontrarChamada("SET datasevento");
      const [datasEventoJson, , , , statusStaff] = chamadaStaff[1];
      expect(JSON.parse(datasEventoJson)).toEqual(["2026-08-01", "2026-08-10"]);
      // aditivo/extra autorizado só vira Ativo quando a vaga entra no orçamento:
      expect(statusStaff).toBe("Pendente");
    });

    test("rejeitar: remove a entrada correspondente de vagasreaproveitadas e libera o funcionário (Ativo)", async () => {
      mockarBanco({
        dadosSol: { dtsolicitada: ["2026-08-10"], tiposolicitacao: "Aditivo - Vaga Excedida" },
        registro: registroBase(),
      });

      const res = await request(app)
        .post("/notificacoes-financeiras/atualizar-status")
        .send({ idpedido: 601, categoria: "statusaditivoextra", acao: "Rejeitado", idlog_origem: 900 });

      expect(res.status).toBe(200);

      const chamadaStaff = encontrarChamada("SET datasevento");
      const [, , , , statusStaff, , , vagasJson] = chamadaStaff[1];
      expect(JSON.parse(vagasJson)).toEqual([]); // a única entrada (data 2026-08-10) foi removida
      expect(statusStaff).toBe("Ativo"); // sem outras pendências
    });
  });

  describe("statusvagaexcedida (mesmo FLUXO A do aditivoextra)", () => {
    test("autorizar também grava em datasevento (não na coluna statuscustofechado)", async () => {
      mockarBanco({
        dadosSol: { dtsolicitada: ["2026-09-20"], tiposolicitacao: "Aditivo - Vaga Excedida" },
        registro: {
          idstaffevento: 501,
          datasevento: [],
          dtdiariadobrada: [],
          vagasreaproveitadas: [],
          obsgeral: "",
          vlrcache: 50,
          vlrtransporte: 0,
          vlralimentacao: 0,
          qtdpessoaslote: 1,
          perfil: "freelancer",
          statuspgtoajdcto: "",
          vlrtotcache: 0,
          vlrtotajdcusto: 0,
        },
      });

      const res = await request(app)
        .post("/notificacoes-financeiras/atualizar-status")
        .send({ idpedido: 602, categoria: "statusvagaexcedida", acao: "Autorizado", idlog_origem: 901 });

      expect(res.status).toBe(200);
      expect(encontrarChamada("SET datasevento")).toBeDefined();
      expect(encontrarChamada("SET statuscustofechado")).toBeUndefined();
    });

    test("autorizar 'FuncExcedido + Vaga Excedida' mantém statusstaff Pendente (tem Aditivo/Extra vinculado, precisa entrar no orçamento)", async () => {
      mockarBanco({
        dadosSol: { dtsolicitada: ["2026-09-21"], tiposolicitacao: "FuncExcedido + Vaga Excedida" },
        registro: {
          idstaffevento: 502,
          datasevento: [],
          dtdiariadobrada: [],
          vagasreaproveitadas: [],
          obsgeral: "",
          vlrcache: 50,
          vlrtransporte: 0,
          vlralimentacao: 0,
          qtdpessoaslote: 1,
          perfil: "freelancer",
          statuspgtoajdcto: "",
          vlrtotcache: 0,
          vlrtotajdcusto: 0,
        },
      });

      const res = await request(app)
        .post("/notificacoes-financeiras/atualizar-status")
        .send({ idpedido: 603, categoria: "statusvagaexcedida", acao: "Autorizado", idlog_origem: 902 });

      expect(res.status).toBe(200);
      const chamadaStaff = encontrarChamada("SET datasevento");
      const [, , , , statusStaff] = chamadaStaff[1];
      expect(statusStaff).toBe("Pendente");
    });
  });

  describe("statuscustofechado (FLUXO B)", () => {
    test("autorizar grava 'Autorizado' direto na coluna statuscustofechado de staffeventos", async () => {
      mockarBanco({
        dadosSol: { dtsolicitada: null, tiposolicitacao: "" },
        registro: {
          idstaffevento: 700,
          nivelexperiencia: "Fechado",
          vlrcache: 500,
          vlrtransporte: 0,
          vlralimentacao: 0,
          statuspgtoajdcto: "",
          vlrtotcache: 0,
          vlrtotajdcusto: 0,
          obspospgto: null,
          datasevento: [],
          vagasreaproveitadas: [],
          dtdiariadobrada: [],
        },
      });

      const res = await request(app)
        .post("/notificacoes-financeiras/atualizar-status")
        .send({ idpedido: 701, categoria: "statuscustofechado", acao: "Autorizado", idlog_origem: 950 });

      expect(res.status).toBe(200);

      const chamada = encontrarChamada("SET statuscustofechado = $1");
      expect(chamada).toBeDefined();
      const [valorColuna, total, totalCache, totalAjdCusto, statusStaff, idStaffAlvo] = chamada[1];
      expect(valorColuna).toBe("Autorizado");
      expect(totalCache).toBe(500); // cachê fechado = vlrcache
      expect(totalAjdCusto).toBe(0);
      expect(total).toBe(500);
      expect(statusStaff).toBe("Ativo");
      expect(idStaffAlvo).toBe(700);
    });
  });

  describe("statusdiariadobrada (FLUXO B)", () => {
    test("autorizar uma data específica atualiza só aquela entrada do JSONB dtdiariadobrada", async () => {
      mockarBanco({
        dadosSol: { dtsolicitada: ["2026-09-05"], tiposolicitacao: "Diária Dobrada" },
        registro: {
          idstaffevento: 800,
          dtdiariadobrada: [
            { data: "2026-09-05", status: "Pendente", vlr_cache: 150, vlr_alimentacao: 30 },
            { data: "2026-09-06", status: "Pendente", vlr_cache: 150, vlr_alimentacao: 30 },
          ],
          statuspgtoajdcto: "",
          vlrtotcache: 1000,
          vlrtotajdcusto: 200,
          vlrcache: 100,
          vlrtransporte: 10,
          vlralimentacao: 20,
          vagasreaproveitadas: [],
          datasevento: ["2026-09-01"],
          obspospgto: null,
        },
      });

      const res = await request(app)
        .post("/notificacoes-financeiras/atualizar-status")
        .send({ idpedido: 900, categoria: "statusdiariadobrada", acao: "Autorizado", data: "2026-09-05", idlog_origem: 950 });

      expect(res.status).toBe(200);

      const chamada = encontrarChamada("SET dtdiariadobrada = $1");
      expect(chamada).toBeDefined();
      const [dtDiariaDobradaJson, total, totalCache, totalAjdCusto] = chamada[1];

      const diarias = JSON.parse(dtDiariaDobradaJson);
      expect(diarias.find((d) => d.data === "2026-09-05").status).toBe("Autorizado");
      expect(diarias.find((d) => d.data === "2026-09-06").status).toBe("Pendente"); // não mexe na outra data

      // vlr_cache (150) soma sempre em totalCache; vlr_alimentacao (30) só em totalAjdCusto
      // porque ajuda de custo ainda não foi paga:
      expect(totalCache).toBe(1000 + 150);
      expect(totalAjdCusto).toBe(200 + 30);
      expect(total).toBe(totalCache + totalAjdCusto);
    });

    test("rejeitar uma data específica só marca aquela entrada como Rejeitado, sem somar valores", async () => {
      mockarBanco({
        dadosSol: { dtsolicitada: ["2026-09-05"], tiposolicitacao: "Diária Dobrada" },
        registro: {
          idstaffevento: 801,
          dtdiariadobrada: [{ data: "2026-09-05", status: "Pendente", vlr_cache: 150, vlr_alimentacao: 30 }],
          statuspgtoajdcto: "",
          vlrtotcache: 1000,
          vlrtotajdcusto: 200,
          vlrcache: 100,
          vlrtransporte: 10,
          vlralimentacao: 20,
          vagasreaproveitadas: [],
          datasevento: ["2026-09-01"],
          obspospgto: null,
        },
      });

      const res = await request(app)
        .post("/notificacoes-financeiras/atualizar-status")
        .send({ idpedido: 901, categoria: "statusdiariadobrada", acao: "Rejeitado", data: "2026-09-05", idlog_origem: 951 });

      expect(res.status).toBe(200);
      const chamada = encontrarChamada("SET dtdiariadobrada = $1");
      const [dtDiariaDobradaJson, total, totalCache, totalAjdCusto] = chamada[1];

      expect(JSON.parse(dtDiariaDobradaJson)[0].status).toBe("Rejeitado");
      expect(totalCache).toBe(1000); // nada foi somado (rejeitado)
      expect(totalAjdCusto).toBe(200);
      expect(total).toBe(1200);
    });
  });
});
