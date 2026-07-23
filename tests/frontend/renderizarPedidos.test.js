const { loadMainFunctions } = require("./helpers/loadMainFunctions");

// Aguarda o event loop "drenar" (microtasks das Promises + o setTimeout(…,300)
// que o Main.js usa para o fade-out dos cards depois de uma ação aprovada/rejeitada).
const aguardarFluxoAssincrono = () => new Promise((resolve) => setTimeout(resolve, 350));

describe("renderizarPedidos (public/js/Main.js)", () => {
  let fns;

  beforeEach(() => {
    global.Swal = { fire: jest.fn().mockResolvedValue({ isConfirmed: true }) };
    global.fetchComToken = jest.fn().mockResolvedValue({ sucesso: true });
    global.atualizarContadoresGlobais = jest.fn();
    global.atualizarBadgeDeStatus = jest.fn();
    global.atualizarStatusAditivoExtra = jest.fn().mockResolvedValue(true);
    global.atualizarStatusPedido = jest.fn().mockResolvedValue(true);
    global.ehMasterOuSupremo = false;
    document.body.innerHTML = '<div id="lista"></div>';
    fns = loadMainFunctions();
  });

  function render(pedidosCompletos, { categoria = "funcionario", status = "pendente", podeAprovar = true } = {}) {
    fns.renderizarPedidos(pedidosCompletos, "lista", categoria, status, podeAprovar);
    return document.getElementById("lista");
  }

  // ── 1. Caso de sucesso: pedido pendente comum (campo statuscaixinha) ─────
  describe("pedido simples pendente", () => {
    function pedidoBase(overrides = {}) {
      return [
        {
          funcionario: "João Silva",
          registrosOriginais: [
            {
              id_log: 501,
              nomeSolicitante: "Maria Souza",
              funcionario: "João Silva",
              evento: "Feira XYZ",
              statuscaixinha: [{ status: "pendente", valor: 150 }],
              ...overrides,
            },
          ],
        },
      ];
    }

    test("renderiza título, valor formatado e botões de ação", () => {
      const container = render(pedidoBase());

      expect(container.textContent).toContain("João Silva");
      expect(container.textContent).toContain("Maria Souza");
      expect(container.innerHTML).toContain("Caixinha (R$ 150,00)");
      expect(container.innerHTML).toContain("R$ 150,00");
      expect(container.textContent).toContain("Pendente");

      const acoes = container.querySelector(".AcoesPedido");
      expect(acoes).not.toBeNull();
      expect(acoes.getAttribute("data-campo")).toBe("statuscaixinha");
      expect(acoes.querySelector(".aprovar")).not.toBeNull();
      expect(acoes.querySelector(".negar")).not.toBeNull();

      expect(global.atualizarBadgeDeStatus).toHaveBeenCalledWith("pendente", 1, "funcionario");
    });

    test("clicar em Autorizar chama atualizarStatusPedido e remove o card", async () => {
      const container = render(pedidoBase());
      const cardAntes = container.querySelectorAll(".pedido-card").length;
      expect(cardAntes).toBe(1);

      container.querySelector(".aprovar").dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await aguardarFluxoAssincrono();

      expect(global.Swal.fire).toHaveBeenCalled();
      expect(global.atualizarStatusPedido).toHaveBeenCalledWith(
        "501", "statuscaixinha", "autorizado", expect.anything(), "", "501"
      );
      expect(container.querySelectorAll(".pedido-card").length).toBe(0);
    });

    test("clicar em Rejeitar chama atualizarStatusPedido com status 'rejeitado'", async () => {
      const container = render(pedidoBase());

      container.querySelector(".negar").dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await aguardarFluxoAssincrono();

      expect(global.atualizarStatusPedido).toHaveBeenCalledWith(
        "501", "statuscaixinha", "rejeitado", expect.anything(), "", "501"
      );
    });
  });

  // ── 2. Autorizado / Rejeitado: sem botões, mostra quem aprovou ──────────
  describe.each([
    ["autorizado", "#16a34a"],
    ["rejeitado", "#dc2626"],
  ])("status já resolvido: %s", (statusDesejado, corEsperada) => {
    test(`renderiza sem botões de ação e exibe o aprovador (cor ${corEsperada})`, () => {
      const pedidos = [
        {
          funcionario: "Ana Paula",
          registrosOriginais: [
            {
              id_log: 601,
              nomeSolicitante: "Pedro Lima",
              funcionario: "Ana Paula",
              nomeAprovador: "Carlos Gestor",
              statuscaixinha: [{ status: statusDesejado, valor: 200 }],
            },
          ],
        },
      ];
      const container = render(pedidos, { status: statusDesejado });

      expect(container.querySelector(".AcoesPedido")).toBeNull();
      expect(container.textContent).toContain("Carlos Gestor");
      expect(container.innerHTML).toContain(corEsperada);
    });
  });

  // ── 3. Vaga Reaproveitada (aditivo-extra com lote + individual) ─────────
  describe("vaga reaproveitada", () => {
    function pedidoVagaReaproveitada() {
      return [
        {
          nmfuncao: "Operador de Empilhadeira",
          registrosOriginais: [
            {
              id_log: 777,
              nomefuncionario: "Bruno Alves",
              nomeSolicitante: "Equipe Operações",
              statusaditivoextra: [
                { status: "pendente", data: "2026-07-20", idsolicitacao: 850, tipoSolicitacao: "Vaga Reaproveitada" },
              ],
              solicitacoes_individuais: [{ idsolicitacao: 850, data: "2026-07-20", status: "pendente" }],
            },
          ],
        },
      ];
    }

    test("renderiza o card com título 'Vaga Reaproveitada' e botões de lote/individual", () => {
      const container = render(pedidoVagaReaproveitada(), { categoria: "funcao" });

      expect(container.textContent).toContain("Vaga Reaproveitada - Diária de Outra Função");

      const loteAprovar = container.querySelector(".aprovar-lote-aditivo");
      expect(loteAprovar).not.toBeNull();
      expect(loteAprovar.getAttribute("data-ids")).toBe("850");
      expect(loteAprovar.getAttribute("data-logid")).toBe("777");

      const individualAprovar = container.querySelector(".aprovar-individual-aditivo");
      expect(individualAprovar).not.toBeNull();
      expect(individualAprovar.getAttribute("data-data")).toBe("2026-07-20");
      expect(individualAprovar.getAttribute("data-categoria")).toBe("statusvagasreaproveitadas");
    });

    test("autorizar em lote chama atualizarStatusAditivoExtra e remove o card", async () => {
      const container = render(pedidoVagaReaproveitada(), { categoria: "funcao" });

      container.querySelector(".aprovar-lote-aditivo").dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await aguardarFluxoAssincrono();

      expect(global.atualizarStatusAditivoExtra).toHaveBeenCalledWith("850", "autorizado", null, "777", true);
      expect(container.querySelectorAll(".pedido-card").length).toBe(0);
      expect(global.atualizarContadoresGlobais).toHaveBeenCalled();
    });

    test("autorizar uma data individual chama atualizarStatusAditivoExtra apenas para aquela data", async () => {
      const container = render(pedidoVagaReaproveitada(), { categoria: "funcao" });

      container.querySelector(".aprovar-individual-aditivo").dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await aguardarFluxoAssincrono();

      expect(global.atualizarStatusAditivoExtra).toHaveBeenCalledWith(
        "850", "autorizado", "2026-07-20", "777", true, "statusaditivoextra"
      );
    });
  });

  // ── 4. Orçamento: saldo ok vs. estouro (ajuste de custo positivo) ───────
  describe("saldo financeiro da equipe", () => {
    function pedidoAjusteCusto({ vlrOrcadoEquipe, vlrGastoEquipe, vlrPendenteEquipe, valorAjuste }) {
      return [
        {
          funcionario: "Equipe Montagem",
          registrosOriginais: [
            {
              id_log: 301,
              nomeSolicitante: "Fiscal de Obra",
              funcionario: "Equipe Montagem",
              vlrOrcadoEquipe,
              vlrGastoEquipe,
              vlrPendenteEquipe,
              statusajustecusto: [{ status: "pendente", valor: valorAjuste }],
            },
          ],
        },
      ];
    }

    test("dentro do orçamento: mostra saldo positivo em verde, sem aviso de estouro", () => {
      global.ehMasterOuSupremo = true;
      const container = render(
        pedidoAjusteCusto({ vlrOrcadoEquipe: 1000, vlrGastoEquipe: 300, vlrPendenteEquipe: 100, valorAjuste: 200 })
      );

      expect(container.innerHTML).toContain("Saldo atual:");
      expect(container.innerHTML).toContain("#16a34a");
      expect(container.innerHTML).not.toContain("Estoura o limite");
    });

    test("orçamento excedido: mostra saldo negativo em vermelho com aviso de estouro", () => {
      global.ehMasterOuSupremo = true;
      // Nota: vlrGastoEquipe já inclui o valor de ajustes de custo Pendentes (ver
      // memória "vlrajustecusto entra em vlr_gasto mesmo Pendente"), por isso o
      // saldoApos exibido é sempre orcado - gasto, independente do valor do ajuste.
      const container = render(
        pedidoAjusteCusto({ vlrOrcadoEquipe: 1000, vlrGastoEquipe: 1200, vlrPendenteEquipe: 200, valorAjuste: 150 })
      );

      // saldoApos = 1000 - 1200 = -200 (estouro)
      expect(container.innerHTML).toContain("Estoura o limite");
      expect(container.innerHTML).toContain("#dc2626");
      expect(container.innerHTML).toContain("-R$ 200,00");
    });
  });

  // ── 5. Combo Extra Bonificado + Diária Dobrada ──────────────────────────
  describe("combo Extra Bonificado + Diária Dobrada", () => {
    function pedidoCombo() {
      return [
        {
          funcionario: "Rafael Nunes",
          registrosOriginais: [
            {
              id_log: 900,
              isComboExtraDobrada: true,
              nomefuncionario: "Rafael Nunes",
              dadosBonificado: {
                id_log: 910,
                status_aprovacao: "pendente",
                solicitacoes_individuais: [{ idsolicitacao: 701, data: "2026-07-10", status: "pendente" }],
              },
              dadosDobrada: {
                id_log: 920,
                status_aprovacao: "pendente",
                solicitacoes_individuais: [{ idsolicitacao: 702, data: "2026-07-10", status: "pendente" }],
              },
            },
          ],
        },
      ];
    }

    test("renderiza bloqueado: Diária Dobrada aguarda resolução do Extra Bonificado", () => {
      const container = render(pedidoCombo());

      expect(container.innerHTML).toContain("combo-edb-card");
      expect(container.innerHTML).toContain("Extra Bonificado");
      expect(container.innerHTML).toContain("Bloqueado");

      const btnDobrada = container.querySelector(".aprovar-edb-dobrada-ind");
      expect(btnDobrada.disabled).toBe(true);
    });

    test("autorizar o Extra Bonificado desbloqueia a Diária Dobrada", async () => {
      const container = render(pedidoCombo());

      container.querySelector(".aprovar-edb-bonif-ind").dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await aguardarFluxoAssincrono();

      expect(global.fetchComToken).toHaveBeenCalledWith(
        "/main/notificacoes-financeiras/atualizar-status",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            idpedido: "701", categoria: "statusaditivoextra", acao: "Autorizado", idlog_origem: "910", data: "2026-07-10",
          }),
        })
      );

      const secao2 = container.querySelector(".combo-edb-secao-dobrada");
      expect(secao2.querySelector(".aprovar-edb-dobrada-ind").disabled).toBe(false);
      expect(secao2.textContent).toContain("Autorizar Diária Dobrada");
    });

    test("rejeitar o Extra Bonificado cancela automaticamente a Diária Dobrada", async () => {
      const container = render(pedidoCombo());

      container.querySelector(".rejeitar-edb-bonif-ind").dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await aguardarFluxoAssincrono();

      expect(global.atualizarStatusAditivoExtra).toHaveBeenCalledWith(
        "702", "rejeitado", null, "920", true, "statusdiariadobrada"
      );
      const secao2 = container.querySelector(".combo-edb-secao-dobrada");
      expect(secao2.textContent).toContain("cancelada automaticamente");
    });
  });

  // ── 6. Combo Funcionário Excedido + Estouro Financeiro (Aditivo) ────────
  describe("combo Aditivo (Estouro Financeiro) + Funcionário Excedido", () => {
    function pedidoCombo() {
      return [
        {
          funcionario: "Equipe Segurança",
          registrosOriginais: [
            {
              id_log: 1000,
              isComboFuncExcedidoAditivo: true,
              nomefuncionario: "Equipe Segurança",
              dadosAditivo: {
                id_log: 1010,
                status_aprovacao: "pendente",
                solicitacoes_individuais: [{ idsolicitacao: 851, data: "2026-08-01", status: "pendente" }],
              },
              dadosFuncExcedido: {
                id_log: 1020,
                status_aprovacao: "pendente",
                solicitacoes_individuais: [{ idsolicitacao: 852, data: "2026-08-01", status: "pendente" }],
              },
            },
          ],
        },
      ];
    }

    test("renderiza bloqueado: funcionário excedido aguarda o Aditivo", () => {
      const container = render(pedidoCombo());

      expect(container.innerHTML).toContain("combo-fe-card");
      expect(container.innerHTML).toContain("Limite Financeiro Excedido");
      expect(container.querySelector(".aprovar-fe-func-ind").disabled).toBe(true);
    });

    test("autorizar o Aditivo desbloqueia a autorização do funcionário excedido", async () => {
      const container = render(pedidoCombo());

      container.querySelector(".aprovar-fe-aditivo-ind").dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await aguardarFluxoAssincrono();

      expect(global.fetchComToken).toHaveBeenCalledWith(
        "/main/notificacoes-financeiras/atualizar-status",
        expect.objectContaining({
          body: JSON.stringify({
            idpedido: "851", categoria: "statusaditivoextra", acao: "Autorizado", idlog_origem: "1010", data: "2026-08-01",
          }),
        })
      );

      const secao2 = container.querySelector(".combo-fe-secao-func");
      expect(secao2.querySelector(".aprovar-fe-func-ind").disabled).toBe(false);
    });

    function pedidoComboMultiData() {
      return [
        {
          funcionario: "Equipe Segurança",
          registrosOriginais: [
            {
              id_log: 1000,
              isComboFuncExcedidoAditivo: true,
              nomefuncionario: "Equipe Segurança",
              dadosAditivo: {
                id_log: 1010,
                status_aprovacao: "pendente",
                solicitacoes_individuais: [
                  { idsolicitacao: 851, data: "2026-08-01", status: "pendente" },
                  { idsolicitacao: 853, data: "2026-08-02", status: "pendente" },
                ],
              },
              dadosFuncExcedido: {
                id_log: 1020,
                status_aprovacao: "pendente",
                solicitacoes_individuais: [
                  { idsolicitacao: 852, data: "2026-08-01", status: "pendente" },
                  { idsolicitacao: 854, data: "2026-08-02", status: "pendente" },
                ],
              },
            },
          ],
        },
      ];
    }

    function linhaPorData(container, data) {
      return [...container.querySelectorAll(".combo-fe-secao-func .linha-data-aditivo")]
        .find((el) => el.getAttribute("data-data") === data);
    }

    test("autorizar só uma data do Aditivo desbloqueia só a linha correspondente do FuncExcedido", async () => {
      const container = render(pedidoComboMultiData());

      const botoesAditivo = [...container.querySelectorAll(".aprovar-fe-aditivo-ind")];
      const botaoData01 = botoesAditivo.find((b) => b.getAttribute("data-data") === "2026-08-01");
      botaoData01.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await aguardarFluxoAssincrono();

      expect(global.fetchComToken).toHaveBeenCalledWith(
        "/main/notificacoes-financeiras/atualizar-status",
        expect.objectContaining({
          body: JSON.stringify({
            idpedido: "851", categoria: "statusaditivoextra", acao: "Autorizado", idlog_origem: "1010", data: "2026-08-01",
          }),
        })
      );

      expect(linhaPorData(container, "2026-08-01").querySelector(".aprovar-fe-func-ind").disabled).toBe(false);
      expect(linhaPorData(container, "2026-08-02").querySelector(".aprovar-fe-func-ind").disabled).toBe(true);
    });

    test("rejeitar uma data do Aditivo cancela só a data correspondente do FuncExcedido", async () => {
      const container = render(pedidoComboMultiData());

      const botoesRejeitar = [...container.querySelectorAll(".rejeitar-fe-aditivo-ind")];
      const botaoData01 = botoesRejeitar.find((b) => b.getAttribute("data-data") === "2026-08-01");
      botaoData01.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await aguardarFluxoAssincrono();

      expect(global.atualizarStatusAditivoExtra).toHaveBeenCalledWith(
        "852", "rejeitado", "2026-08-01", "1020", true, "statusvagaexcedida"
      );
      expect(global.atualizarStatusAditivoExtra).not.toHaveBeenCalledWith(
        "854", "rejeitado", expect.anything(), "1020", true, "statusvagaexcedida"
      );

      expect(linhaPorData(container, "2026-08-01").textContent).toContain("Cancelado");
      // a outra data não foi tocada — segue bloqueada aguardando sua própria data do Aditivo
      expect(linhaPorData(container, "2026-08-02").querySelector(".aprovar-fe-func-ind").disabled).toBe(true);
    });

    test("data do FuncExcedido sem par correspondente no Aditivo permanece bloqueada", () => {
      const pedidos = pedidoComboMultiData();
      // remove o par da segunda data do lado Aditivo — vira uma data órfã do lado FuncExcedido
      pedidos[0].registrosOriginais[0].dadosAditivo.solicitacoes_individuais =
        pedidos[0].registrosOriginais[0].dadosAditivo.solicitacoes_individuais.filter((s) => s.data !== "2026-08-02");
      const container = render(pedidos);

      expect(linhaPorData(container, "2026-08-02").querySelector(".aprovar-fe-func-ind").disabled).toBe(true);
    });
  });

  // ── 6b. Combo Funcionário Excedido + Vaga Excedida (Aditivo ou Extra Bonificado) ──
  describe("combo Vaga Excedida (Aditivo/Extra Bonificado) + Funcionário Excedido", () => {
    function pedidoComboVaga({ isAditivo = true } = {}) {
      return [
        {
          funcionario: "Equipe Segurança",
          registrosOriginais: [
            {
              id_log: 2000,
              isComboFuncExcedidoVaga: true,
              isComboAditivoFuncVaga: isAditivo,
              nomefuncionario: "Equipe Segurança",
              dadosAditivo: {
                id_log: 2010,
                status_aprovacao: "pendente",
                solicitacoes_individuais: [
                  { idsolicitacao: 951, data: "2026-08-01", status: "pendente" },
                  { idsolicitacao: 953, data: "2026-08-02", status: "pendente" },
                ],
              },
              dadosFuncExcedido: {
                id_log: 2020,
                status_aprovacao: "pendente",
                solicitacoes_individuais: [
                  { idsolicitacao: 952, data: "2026-08-01", status: "pendente" },
                  { idsolicitacao: 954, data: "2026-08-02", status: "pendente" },
                ],
              },
            },
          ],
        },
      ];
    }

    function linhaPorData(container, data) {
      return [...container.querySelectorAll(".combo-fev-secao-func .linha-data-aditivo")]
        .find((el) => el.getAttribute("data-data") === data);
    }

    test("natureza Aditivo: renderiza bloqueado com o rótulo 'Aditivo'", () => {
      const container = render(pedidoComboVaga({ isAditivo: true }));

      expect(container.innerHTML).toContain("combo-fev-card");
      expect(container.innerHTML).toContain("Vaga Excedida");
      expect(container.querySelector(".combo-fev-secao-aditivo").textContent).toContain("Aditivo");
      expect(container.querySelector(".aprovar-fev-func-ind").disabled).toBe(true);
    });

    test("natureza Extra Bonificado: renderiza bloqueado com o rótulo 'Extra Bonificado'", () => {
      const container = render(pedidoComboVaga({ isAditivo: false }));

      expect(container.querySelector(".combo-fev-secao-aditivo").textContent).toContain("Extra Bonificado");
    });

    test("autorizar só uma data da Solicitação 1 desbloqueia só a linha correspondente do FuncExcedido", async () => {
      const container = render(pedidoComboVaga());

      const botoesAditivo = [...container.querySelectorAll(".aprovar-fev-aditivo-ind")];
      const botaoData01 = botoesAditivo.find((b) => b.getAttribute("data-data") === "2026-08-01");
      botaoData01.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await aguardarFluxoAssincrono();

      expect(global.fetchComToken).toHaveBeenCalledWith(
        "/main/notificacoes-financeiras/atualizar-status",
        expect.objectContaining({
          body: JSON.stringify({
            idpedido: "951", categoria: "statusaditivoextra", acao: "Autorizado", idlog_origem: "2010", data: "2026-08-01",
          }),
        })
      );

      expect(linhaPorData(container, "2026-08-01").querySelector(".aprovar-fev-func-ind").disabled).toBe(false);
      expect(linhaPorData(container, "2026-08-02").querySelector(".aprovar-fev-func-ind").disabled).toBe(true);
    });

    test("rejeitar uma data da Solicitação 1 cancela só a data correspondente do FuncExcedido", async () => {
      const container = render(pedidoComboVaga());

      const botoesRejeitar = [...container.querySelectorAll(".rejeitar-fev-aditivo-ind")];
      const botaoData01 = botoesRejeitar.find((b) => b.getAttribute("data-data") === "2026-08-01");
      botaoData01.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await aguardarFluxoAssincrono();

      expect(global.atualizarStatusAditivoExtra).toHaveBeenCalledWith(
        "952", "rejeitado", "2026-08-01", "2020", true, "statusvagaexcedida"
      );
      expect(global.atualizarStatusAditivoExtra).not.toHaveBeenCalledWith(
        "954", "rejeitado", expect.anything(), "2020", true, "statusvagaexcedida"
      );

      expect(linhaPorData(container, "2026-08-01").textContent).toContain("Cancelado");
      expect(linhaPorData(container, "2026-08-02").querySelector(".aprovar-fev-func-ind").disabled).toBe(true);
    });

    test("data do FuncExcedido sem par correspondente na Solicitação 1 permanece bloqueada", () => {
      const pedidos = pedidoComboVaga();
      pedidos[0].registrosOriginais[0].dadosAditivo.solicitacoes_individuais =
        pedidos[0].registrosOriginais[0].dadosAditivo.solicitacoes_individuais.filter((s) => s.data !== "2026-08-02");
      const container = render(pedidos);

      expect(linhaPorData(container, "2026-08-02").querySelector(".aprovar-fev-func-ind").disabled).toBe(true);
    });
  });

  // ── 7. Lista vazia ───────────────────────────────────────────────────────
  test("sem pedidos: mostra mensagem e zera o badge", () => {
    const container = render([]);
    expect(container.textContent).toContain("Não há pedidos");
    expect(global.atualizarBadgeDeStatus).toHaveBeenCalledWith("pendente", 0, "funcionario");
  });
});
