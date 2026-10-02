const { loadRelatoriosFunctions } = require("./helpers/loadRelatoriosFunctions");

/**
 * Relatório de Fechamento de Staff (tela cheia): colunas que o usuário esconde (saem da
 * impressão/Excel, ficam esmaecidas na tela), totais alinhados, moldura por funcionário e o
 * relatório de pagamentos de empreiteira com filtro de evento/cliente.
 */
describe("Relatório de Fechamento de Staff", () => {
  let fn;

  const linha = (extra) => ({
    idevento: 10, nomeEvento: "Evento X", nomeCliente: "Cliente A",
    "FUNÇÃO": "FISCAL DIURNO", NOME: "ANA", PIX: "pix-ana", "INÍCIO": "2026-07-01", "TÉRMINO": "2026-07-02",
    "QTD CACHÊ": 2, "VLR CACHÊ": 100, "VLR ADICIONAL": 0, "VLR CAIXINHA": 0, "TOT DIÁRIAS": 200,
    QTD_AJUDA: 2, "VLR AJUDA": 40, "TOT AJUDA": 80, "TOT GERAL": 280, "CRÉDITO/DÉBITO": 0, "TOT PAGAR": 280,
    "STATUS SOLICITAÇÃO": "-", "STATUS CACHÊ": "Pendente", "STATUS AJUDA": "Pendente", "STATUS CAIXINHA": "Isento",
    "COMP CAIXINHA": "Isento", "COMP CACHÊ": "Pendente", "COMP AJUDA": "Pendente",
    nivelexperiencia: "", ...extra,
  });

  const totais = {
    totalVlrDiarias: 0, totalQtdDiarias: 4, totalTotalQtdDiarias: 4, totalTotalQtdAjuda: 4, totalTotalAdicional: 0,
    totalTotalCaixinha: 0, totalTotalDiarias: 400, totalTotalAjuda: 160, totalTotalGeral: 560, totalTotalPagar: 560,
  };

  beforeAll(() => {
    document.body.innerHTML = `
      <select id="equipeSelect"><option value="" selected>Todas as Equipes</option></select>
      <input id="reportStartDate" value="2026-07-01"><input id="reportEndDate" value="2026-07-31">`;
    fn = loadRelatoriosFunctions(
      ["BLOCO_UTIL", "BLOCO_CONT", "formatarData", "montarTabelaBody", "nomesDasColunas", "aplicarColunasOcultas",
       "montarRelatorioHtmlEvento", "montarRelatorioEmpreiteirasHtml"],
      { empresaLogoPath: "logo.png" }
    );
  });

  function montarHtml(linhas) {
    return fn.montarRelatorioHtmlEvento(
      linhas, "Evento X", "Cachê + Ajuda de Custo", "Cliente A",
      [{ nrorcamento: 1, "INFORMAÇÕES EM PROPOSTA": "FISCAL", "QTD PROFISSIONAIS": 1, "DIÁRIAS CONTRATADAS": 2, "DIÁRIAS UTILIZADAS": 2, SALDO: 0 }],
      [{ Profissional: "ANA", Informacao: "Histórico", Observacao: "obs" }],
      totais, "", true, "cache_ajuda"
    );
  }

  // Quantas colunas cada <tr> da tabela principal cobre (somando colspan) — tem que ser igual em todas.
  function larguraPorLinha(raiz) {
    const tabela = raiz.querySelector(".relatorio-evento > table.report-table");
    return Array.from(tabela.querySelectorAll("tr")).map((tr) =>
      Array.from(tr.children).reduce((s, c) => s + (c.colSpan || 1), 0));
  }

  const dados = () => [
    linha({ NOME: "ANA" }),
    linha({ NOME: "BIA", nivelexperiencia: "Fechado" }),
    linha({ NOME: "BIA", "VLR ADICIONAL": 50 }),
    linha({ NOME: "CAIO" }),
  ];

  function raizDe(html) {
    const raiz = document.createElement("div");
    raiz.innerHTML = html;
    return raiz;
  }

  test("as 23 colunas de Cachê + Ajuda e todas as linhas cobrem a mesma largura", () => {
    const raiz = raizDe(montarHtml(dados()));
    expect(fn.nomesDasColunas(raiz)).toHaveLength(23);
    const larguras = larguraPorLinha(raiz);
    expect(new Set(larguras)).toEqual(new Set([23]));
  });

  test("total geral do evento: o total a pagar fica sob TOT PAGAR, não sob CRÉDITO/DÉBITO", () => {
    const raiz = raizDe(montarHtml(dados()));
    const nomes = fn.nomesDasColunas(raiz);
    const tabela = raiz.querySelector(".relatorio-evento > table.report-table");
    const total = Array.from(tabela.querySelectorAll("tr.row-total")).pop();
    let coluna = 0, valorPorColuna = {};
    Array.from(total.children).forEach((c) => { valorPorColuna[coluna] = c.textContent.trim(); coluna += c.colSpan || 1; });
    expect(valorPorColuna[nomes.indexOf("CRÉDITO/DÉBITO")]).toBe("");
    expect(valorPorColuna[nomes.indexOf("TOT PAGAR")]).toMatch(/560,00/);
  });

  test("cores das linhas: azul (fechado), rosa (ajuste) e amarelo (aguardando)", () => {
    const html = montarHtml(dados());
    expect(html).toContain("background-color: #e6f1fd");
    expect(html).toContain("background-color: #fde4e4");
    expect(html).toContain("background-color: #fff9d6");
  });

  test("moldura por funcionário: bf-ini na primeira, bf-fim na última (o subtotal fecha quem tem 2+ linhas)", () => {
    const raiz = raizDe(montarHtml(dados()));
    const tabela = raiz.querySelector(".relatorio-evento > table.report-table");
    const linhas = Array.from(tabela.querySelectorAll("tbody tr")).filter((tr) => tr.classList.contains("bf"));
    // ANA (1 linha): ini+fim na mesma linha. BIA (2 linhas + subtotal): ini na 1ª, fim no subtotal. CAIO: ini+fim.
    expect(linhas[0].className).toMatch(/bf-ini/);
    expect(linhas[0].className).toMatch(/bf-fim/);
    expect(linhas[1].className).toMatch(/bf-ini/);
    expect(linhas[1].className).not.toMatch(/bf-fim/);
    expect(linhas[2].className).not.toMatch(/bf-ini/);
    expect(linhas[2].className).not.toMatch(/bf-fim/);
    const subtotal = tabela.querySelector("tr.row-total.bf-fim");
    expect(subtotal.textContent).toMatch(/SUBTOTAL BIA/);
  });

  test("remover: tira a coluna de TODAS as linhas (inclusive subtotal/total) e mantém a largura uniforme", () => {
    const raiz = raizDe(montarHtml(dados()));
    fn.aplicarColunasOcultas(raiz, ["PIX", "STATUS CX", "COMP CAIXINHA", "COMP CACHÊ", "COMP AJUDA"], "remover");
    const nomes = fn.nomesDasColunas(raiz);
    expect(nomes).toHaveLength(18);
    expect(nomes).not.toContain("PIX");
    expect(new Set(larguraPorLinha(raiz))).toEqual(new Set([18]));
    // o rótulo do subtotal (colspan 5) encolhe para 4 em vez de sumir
    const sub = raiz.querySelector("tr.row-total.bf-fim td");
    expect(sub.colSpan).toBe(4);
  });

  test("marcar: só esmaece, nada sai da tabela", () => {
    const raiz = raizDe(montarHtml(dados()));
    fn.aplicarColunasOcultas(raiz, ["PIX"], "marcar");
    expect(fn.nomesDasColunas(raiz)).toHaveLength(23 + 0); // texto do th agora inclui a etiqueta
    expect(new Set(larguraPorLinha(raiz))).toEqual(new Set([23]));
    expect(raiz.querySelectorAll("th.col-oculta")).toHaveLength(1);
    expect(raiz.querySelector("th.col-oculta .tag-oculta").textContent).toMatch(/oculta na impressão/);
    expect(raiz.querySelectorAll("td.col-oculta").length).toBeGreaterThan(3);
  });

  test("perfil Interno e InternoH (com holerite) recebem o mesmo selo FUNCIONÁRIO; Freelancer não", () => {
    const selos = (perfil, mei = false) =>
      (montarHtml([linha({ PERFIL_STAFF: perfil, PERFIL_MEI: mei })]).match(/FUNC - MEI|FUNCIONÁRIO|>MEI</g) || []);
    expect(selos("Interno")).toEqual(["FUNCIONÁRIO"]);
    expect(selos("InternoH")).toEqual(["FUNCIONÁRIO"]);
    expect(selos("InternoH", true)).toEqual(["FUNC - MEI"]);
    expect(selos("Freelancer")).toEqual([]);
  });

  test("blocos Utilização de Diárias e Contingência saem inteiros ao remover", () => {
    const raiz = raizDe(montarHtml(dados()));
    expect(raiz.querySelector(".tabela-resumo.diarias")).not.toBeNull();
    expect(raiz.querySelector(".tabela-resumo.contingencia")).not.toBeNull();
    fn.aplicarColunasOcultas(raiz, [fn.BLOCO_UTIL, fn.BLOCO_CONT], "remover");
    expect(raiz.querySelector(".tabela-resumo")).toBeNull();
    expect(raiz.querySelector(".resumo-par-orcamento")).toBeNull();
  });

  describe("pagamentos de empreiteira", () => {
    const pessoa = (o) => ({ idfuncionario: 1, nome: "P", funcao: "F", idevento: 1, nmevento: "Estetika", idcliente: 10, nmcliente: "GL",
      qtddiarias: 1, cache: 100, ajuda: 20, total: 120, pago: 0, quitado: false, pendente: false, suspenso: false, ...o });
    const ciclo = (o) => ({ idfornecedor: 1, nmfantasia: "ALFA", pix: "p", envianf: true, tipopgto: "INTERVALO", intervalodias: 15,
      dtciclo: "2026-09-15", dtinicio: "2026-09-01", status: "Parcial", qtdPessoas: 3, notafiscal: null, comprovante: null,
      total: 0, pago: 0, ajustes: [], pessoas: [], ...o });

    const ciclos = [ciclo({
      total: 380, pago: 120,
      pessoas: [
        pessoa({ nome: "Pedro", total: 120, pago: 120, quitado: true }),
        pessoa({ nome: "Rita", total: 120 }),
        pessoa({ nome: "Tati", idevento: 2, nmevento: "Alvorada", idcliente: 20, nmcliente: "Grupo", total: 120 }),
      ],
      ajustes: [{ nome: "Pedro", tipo: "Debito", sinal: -1, valor: 80, status: "Pendente", justificativa: "data removida",
        nmevento_origem: "Estetika", idevento_origem: 1, idcliente_origem: 10 }],
    })];
    const base = { dataInicio: "2026-07-01", dataFim: "2026-09-30" };

    const texto = (html) => { const d = document.createElement("div"); d.innerHTML = html; return d; };

    test("sem filtro: nomes dos eventos, coluna Crédito/Débito antes de Pago e Comprovante por último", () => {
      const raiz = texto(fn.montarRelatorioEmpreiteirasHtml(ciclos, base));
      const cabecalho = Array.from(raiz.querySelectorAll(".rel-emp-rolagem > table > thead th")).map((th) => th.textContent.trim());
      expect(cabecalho).toEqual(["Pagamento", "Período coberto", "Eventos", "Pessoas", "Situação", "NF / Listagem",
        "Crédito / Débito", "Pago", "Total do ciclo", "Comprovante"]);
      const linhaCiclo = raiz.querySelector("tr.rel-emp-ciclo");
      expect(linhaCiclo.children[2].textContent).toMatch(/Estetika/);
      expect(linhaCiclo.children[2].textContent).toMatch(/Alvorada/);
      expect(linhaCiclo.children[6].textContent).toMatch(/80,00/);
    });

    test("filtro de evento: coluna 'Do evento' soma as pessoas do evento + o ajuste de origem nele", () => {
      const html = fn.montarRelatorioEmpreiteirasHtml(ciclos, { ...base, filtro: { idevento: "1" } });
      const raiz = texto(html);
      const cabecalho = Array.from(raiz.querySelectorAll(".rel-emp-rolagem > table > thead th")).map((th) => th.textContent.trim());
      expect(cabecalho).toContain("Do evento");
      const doEvento = raiz.querySelector("tr.rel-emp-ciclo td.rel-emp-sel").textContent;
      expect(doEvento).toMatch(/160,00/); // 120 + 120 - 80
      expect(raiz.querySelector(".rel-emp-detalhe").textContent).not.toMatch(/Tati/);
    });

    test("filtro de outro evento: o ajuste aparece marcado e não entra na coluna do filtro", () => {
      const html = fn.montarRelatorioEmpreiteirasHtml(ciclos, { ...base, filtro: { idevento: "2" } });
      const raiz = texto(html);
      expect(raiz.querySelector("tr.rel-emp-ciclo td.rel-emp-sel").textContent).toMatch(/120,00/);
      expect(raiz.querySelector("tr.rel-emp-fora")).not.toBeNull();
      expect(raiz.querySelector(".rel-emp-nota-fora").textContent).toMatch(/outro evento/);
    });

    test("filtro sem nenhuma pessoa: devolve vazio", () => {
      expect(fn.montarRelatorioEmpreiteirasHtml(ciclos, { ...base, filtro: { idevento: "99" } })).toBe("");
    });
  });
});
