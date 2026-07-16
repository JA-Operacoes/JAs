// GET /detalhes-eventos-abertos (routes/rotaMain.js) roda 7 queries em sequência
// (orcamentos, itensOrcamento, staffCount, datasStaffRaw, gastoEquipeRows,
// reaproveitadasRows, aditivosPendentesRows) e depois faz toda a agregação/saldo
// em JS. Mockamos o pool nessa ordem exata para testar essa agregação sem banco real.
jest.mock("../../db/conexaoDB", () => ({ query: jest.fn() }));

const express = require("express");
const request = require("supertest");
const pool = require("../../db/conexaoDB");
const rotaMain = require("../../routes/rotaMain");

const app = express();
app.use(express.json());
app.use(rotaMain);

function mockQueriesEmOrdem(rowsPorQuery) {
  pool.query.mockReset();
  rowsPorQuery.forEach((rows) => {
    pool.query.mockResolvedValueOnce({ rows });
  });
}

const QUERY_VAZIA = [];

describe("GET /detalhes-eventos-abertos", () => {
  afterEach(() => jest.clearAllMocks());

  test("400 quando faltam idevento/idempresa", async () => {
    const res = await request(app).get("/detalhes-eventos-abertos").query({ idevento: 1 });
    expect(res.status).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test("200 com equipes vazias quando não há orçamentos para o evento/empresa/ano", async () => {
    mockQueriesEmOrdem([QUERY_VAZIA]);

    const res = await request(app)
      .get("/detalhes-eventos-abertos")
      .query({ idevento: 1, idempresa: 2, ano: 2026 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ equipes: [] });
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  function baseItensOrcamento(overrides = {}) {
    return {
      idequipe: 1,
      equipe: "Equipe A",
      idfuncao: 100,
      funcao: "Operador",
      setor_orcamento: "A",
      qtd_orcamento: "5",
      qtddias_orcamento: "3",
      total_diarias_orcadas: "15",
      dtini_vaga: "2026-07-01",
      dtfim_vaga: "2026-07-03",
      tem_cache_fechado: false,
      idorcamento: 10,
      contratarstaff: true,
      vlr_orcado_item: "1000",
      vlr_bonificado_item: "0",
      vlrdiaria: "100",
      vlrajdctoalimentacao: "20",
      vlrajdctotransporte: "10",
      ...overrides,
    };
  }

  function montarCenario({ itensOrcamento, gastoEquipeRows = [], reaproveitadasRows = [], staffCount = [] }) {
    mockQueriesEmOrdem([
      [{ idorcamento: 10, status: "F", idcliente: 5, idmontagem: 1 }], // orcamentos
      itensOrcamento, // itensOrcamento
      staffCount, // staffCount
      QUERY_VAZIA, // datasStaffRaw
      gastoEquipeRows, // gastoEquipeRows
      reaproveitadasRows, // reaproveitadasRows
      QUERY_VAZIA, // aditivosPendentesRows
    ]);
  }

  test("caso de sucesso: saldo dentro do orçamento", async () => {
    montarCenario({
      itensOrcamento: [baseItensOrcamento()],
      gastoEquipeRows: [{ idequipe: 1, vlr_gasto_equipe: "300" }],
      staffCount: [
        { idfuncao: 100, idorcamento: 10, localizacao: "A", qtd_cadastrada_pessoas: "3", qtd_pendente: "0", diarias_consumidas: "9", dobras_pendentes: "0", dobras_autorizadas: "0" },
      ],
    });

    const res = await request(app)
      .get("/detalhes-eventos-abertos")
      .query({ idevento: 1, idempresa: 2, ano: 2026 });

    expect(res.status).toBe(200);
    const equipe = res.body.equipes[0];
    expect(equipe.vlr_orcado_equipe).toBe(1000);
    expect(equipe.vlr_gasto_equipe).toBe(300);
    expect(equipe.saldo_fin_equipe).toBe(700);
    expect(equipe.funcoes[0].qtd_cadastrada).toBe(3);
    expect(equipe.funcoes[0].concluido).toBe(false);
  });

  test("orçamento excedido: gasto maior que o orçado gera saldo negativo", async () => {
    montarCenario({
      itensOrcamento: [baseItensOrcamento()],
      gastoEquipeRows: [{ idequipe: 1, vlr_gasto_equipe: "1300" }],
    });

    const res = await request(app)
      .get("/detalhes-eventos-abertos")
      .query({ idevento: 1, idempresa: 2, ano: 2026 });

    const equipe = res.body.equipes[0];
    expect(equipe.saldo_fin_equipe).toBe(-300);
    expect(equipe.saldo_fin_equipe).toBeLessThan(0);
  });

  test("Extra Bonificado (adicional=true e vlrdiaria=0): valor bonificado fica separado e não conta no saldo", async () => {
    // Simula o resultado já agregado pelo CASE do SQL (rotaMain.js): o item
    // bonificado cai em vlr_bonificado_item, nunca em vlr_orcado_item.
    montarCenario({
      itensOrcamento: [baseItensOrcamento({ vlr_orcado_item: "800", vlr_bonificado_item: "200" })],
      gastoEquipeRows: [{ idequipe: 1, vlr_gasto_equipe: "300" }],
    });

    const res = await request(app)
      .get("/detalhes-eventos-abertos")
      .query({ idevento: 1, idempresa: 2, ano: 2026 });

    const equipe = res.body.equipes[0];
    expect(equipe.vlr_orcado_equipe).toBe(800);
    expect(equipe.vlr_bonificado_equipe).toBe(200);
    // saldo usa só o orçado "real" (800 - 300), o bonificado não entra na conta:
    expect(equipe.saldo_fin_equipe).toBe(500);
  });

  test("vagas reaproveitadas: mapeia origem→destino e ignora quando origem === destino", async () => {
    montarCenario({
      itensOrcamento: [baseItensOrcamento()],
      gastoEquipeRows: [{ idequipe: 1, vlr_gasto_equipe: "300" }],
      reaproveitadasRows: [
        // reaproveitamento válido: função 100/setor A → função 200/setor B
        { idfuncao_origem: 100, setor_origem: "A", idorcamento_origem: 10, idfuncao_destino: 200, setor_destino: "B", idorcamento_destino: 10, nome_funcao_destino: "Segurança", qtd: "2" },
        // linha "self" (mesma função/setor/orçamento na origem e destino) deve ser ignorada
        { idfuncao_origem: 100, setor_origem: "A", idorcamento_origem: 10, idfuncao_destino: 100, setor_destino: "A", idorcamento_destino: 10, nome_funcao_destino: "Operador", qtd: "1" },
      ],
    });

    const res = await request(app)
      .get("/detalhes-eventos-abertos")
      .query({ idevento: 1, idempresa: 2, ano: 2026 });

    const funcao = res.body.equipes[0].funcoes[0];
    expect(funcao.vagas_usadas_em).toEqual([
      { idfuncao_destino: 200, setor_destino: "B", nome_funcao_destino: "Segurança (B)", qtd: 2 },
    ]);
  });

  test("erro no banco retorna 500", async () => {
    pool.query.mockReset();
    pool.query.mockRejectedValueOnce(new Error("boom"));

    const res = await request(app)
      .get("/detalhes-eventos-abertos")
      .query({ idevento: 1, idempresa: 2, ano: 2026 });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("boom");
  });
});
