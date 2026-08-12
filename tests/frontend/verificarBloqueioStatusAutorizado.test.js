const { loadStaffFunctions } = require("./helpers/loadStaffFunctions");

/**
 * Testa isoladamente verificarBloqueioStatusAutorizado (Staff.js), responsável por avisar e
 * reprovar automaticamente a solicitação ativa de Cachê Fechado/Liberado (Autorizada ou
 * Pendente) sempre que o usuário troca de nível de experiência — tanto entre Fechado <-> Liberado
 * quanto para um nível padrão (Base/Junior/Pleno/Senior/Senior 2).
 *
 * IMPORTANTE: '#statusCustoFechado' (hidden) NÃO existe no CadStaff.html real — só existem
 * '#selectStatusCustoFechado' (visível pra Master/Financeiro) e '#statusCustoFechadoTexto'
 * (visível pros demais usuários). Por isso os testes cobrem os dois casos: o valor populado
 * no <select> (usuário com permissão) e o valor populado só no input de texto (usuário comum).
 */
describe("verificarBloqueioStatusAutorizado", () => {
  let verificarBloqueioStatusAutorizado;

  // usarSelect=true simula um usuário Master/Financeiro (o valor real está no <select>).
  // usarSelect=false simula um usuário comum (<select> fica em 'none', valor real só no texto).
  function setupDom({ statusCustoFechado, nivelOriginal, isFormLoadedFromDoubleClick = false, usarSelect = true }) {
    document.body.innerHTML = `
      <select id="selectStatusCustoFechado">
        <option value="none">none</option>
        <option value="Pendente">Pendente</option>
        <option value="Autorizado">Autorizado</option>
        <option value="Rejeitado">Rejeitado</option>
      </select>
      <input id="statusCustoFechadoTexto" type="text" />
      <textarea id="descCustoFechado"></textarea>
      <input id="Fechadocheck" type="checkbox" />
      <input id="Liberadocheck" type="checkbox" />
      <input id="Basecheck" type="checkbox" />
      <input id="Juniorcheck" type="checkbox" />
      <input id="Plenocheck" type="checkbox" />
      <input id="Seniorcheck" type="checkbox" />
      <input id="Seniorcheck2" type="checkbox" />
    `;

    const selectEl = document.getElementById("selectStatusCustoFechado");
    const textoEl = document.getElementById("statusCustoFechadoTexto");
    if (usarSelect) {
      selectEl.value = statusCustoFechado || "none";
      textoEl.value = "";
    } else {
      selectEl.value = "none";
      textoEl.value = statusCustoFechado || "";
    }

    global.baseCheck = document.getElementById("Basecheck");
    global.juniorCheck = document.getElementById("Juniorcheck");
    global.plenoCheck = document.getElementById("Plenocheck");
    global.seniorCheck = document.getElementById("Seniorcheck");
    global.seniorCheck2 = document.getElementById("Seniorcheck2");
    global.fechadoCheck = document.getElementById("Fechadocheck");
    global.liberadoCheck = document.getElementById("Liberadocheck");
    global.descCustoFechadoTextarea = document.getElementById("descCustoFechado");

    global.isFormLoadedFromDoubleClick = isFormLoadedFromDoubleClick;
    global.currentEditingStaffEvent = { nivelexperiencia: nivelOriginal };

    global.aplicarCorNoSelect = jest.fn();
    global.aplicarCorStatusInput = jest.fn();
    global.Swal = { fire: jest.fn() };

    window.__bypassBloqueioCustoFechado = false;
    window.forcarNovaSolicitacaoCustoFechado = false;
    window.forcarRejeicaoCustoFechadoNivelPadrao = false;

    // Marca o nível original como já estando "checked", como fica após o load real do form.
    const idOriginal = nivelOriginal === "FECHADO" ? "Fechadocheck" : nivelOriginal === "LIBERADO" ? "Liberadocheck" : null;
    if (idOriginal) document.getElementById(idOriginal).checked = true;
  }

  // Lê o status "efetivo" nos campos reais, com o mesmo critério usado pela função (select
  // se preenchido e diferente de 'none', senão o texto) — usado pelas asserções dos testes.
  function statusEfetivo() {
    const selectEl = document.getElementById("selectStatusCustoFechado");
    const textoEl = document.getElementById("statusCustoFechadoTexto");
    if (selectEl.value && selectEl.value !== "none") return selectEl.value;
    return textoEl.value;
  }

  beforeEach(() => {
    ({ verificarBloqueioStatusAutorizado } = loadStaffFunctions(["verificarBloqueioStatusAutorizado"]));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe.each([true, false])("usarSelect=%s (Master/Financeiro vs usuário comum)", (usarSelect) => {
    describe("não deve interceptar quando não há solicitação ativa", () => {
      test.each(["", "Rejeitado", "none"])("status='%s' retorna false e não chama Swal", (status) => {
        setupDom({ statusCustoFechado: status, nivelOriginal: "FECHADO", usarSelect });
        const liberadoCheck = document.getElementById("Liberadocheck");

        const bloqueou = verificarBloqueioStatusAutorizado(liberadoCheck);

        expect(bloqueou).toBe(false);
        expect(global.Swal.fire).not.toHaveBeenCalled();
      });
    });

    test("não intercepta durante o carregamento inicial do form (isFormLoadedFromDoubleClick=true)", () => {
      setupDom({ statusCustoFechado: "Autorizado", nivelOriginal: "FECHADO", isFormLoadedFromDoubleClick: true, usarSelect });
      const liberadoCheck = document.getElementById("Liberadocheck");

      const bloqueou = verificarBloqueioStatusAutorizado(liberadoCheck);

      expect(bloqueou).toBe(false);
      expect(global.Swal.fire).not.toHaveBeenCalled();
    });

    test("respeita o bypass de reentrada (__bypassBloqueioCustoFechado)", () => {
      setupDom({ statusCustoFechado: "Autorizado", nivelOriginal: "FECHADO", usarSelect });
      window.__bypassBloqueioCustoFechado = true;
      const liberadoCheck = document.getElementById("Liberadocheck");

      const bloqueou = verificarBloqueioStatusAutorizado(liberadoCheck);

      expect(bloqueou).toBe(false);
      expect(global.Swal.fire).not.toHaveBeenCalled();
    });

    describe.each([
      ["Autorizado", "AUTORIZADA"],
      ["Pendente", "PENDENTE"],
    ])("com status atual = %s", (statusAtual, statusLabel) => {
      describe("troca Fechado -> Liberado (e vice-versa)", () => {
        test(`Fechado (${statusAtual}) -> Liberado: mostra swal de confirmação + swal de nova justificativa, e ao confirmar ambos rejeita a antiga e abre pendente`, async () => {
          setupDom({ statusCustoFechado: statusAtual, nivelOriginal: "FECHADO", usarSelect });
          const liberadoCheck = document.getElementById("Liberadocheck");
          const changeSpy = jest.fn();
          liberadoCheck.addEventListener("change", changeSpy);

          global.Swal.fire
            .mockResolvedValueOnce({ isConfirmed: true }) // confirmação da troca
            .mockResolvedValueOnce({ isConfirmed: true, value: "Motivo da nova solicitação" }); // nova justificativa

          const bloqueou = verificarBloqueioStatusAutorizado(liberadoCheck);
          expect(bloqueou).toBe(true);
          // 1. Desmarca imediatamente até a decisão do usuário
          expect(liberadoCheck.checked).toBe(false);

          await Promise.resolve();
          await Promise.resolve();
          await Promise.resolve();

          expect(global.Swal.fire).toHaveBeenCalledTimes(2);
          expect(global.Swal.fire.mock.calls[0][0].title).toContain(statusLabel);
          expect(global.Swal.fire.mock.calls[1][0].title).toContain("Justificativa da nova solicitação");

          expect(statusEfetivo()).toBe("Pendente");
          expect(document.getElementById("descCustoFechado").value).toBe("Motivo da nova solicitação");
          expect(window.forcarNovaSolicitacaoCustoFechado).toBe(true);
          expect(liberadoCheck.checked).toBe(true);
          expect(changeSpy).toHaveBeenCalledTimes(1);
        });

        test(`Liberado (${statusAtual}) -> Fechado: mesmo fluxo, na direção inversa`, async () => {
          setupDom({ statusCustoFechado: statusAtual, nivelOriginal: "LIBERADO", usarSelect });
          const fechadoCheck = document.getElementById("Fechadocheck");
          const changeSpy = jest.fn();
          fechadoCheck.addEventListener("change", changeSpy);

          global.Swal.fire
            .mockResolvedValueOnce({ isConfirmed: true })
            .mockResolvedValueOnce({ isConfirmed: true, value: "Motivo 2" });

          const bloqueou = verificarBloqueioStatusAutorizado(fechadoCheck);
          expect(bloqueou).toBe(true);
          expect(fechadoCheck.checked).toBe(false);

          await Promise.resolve();
          await Promise.resolve();
          await Promise.resolve();

          expect(global.Swal.fire.mock.calls[0][0].title).toContain(statusLabel);
          expect(statusEfetivo()).toBe("Pendente");
          expect(window.forcarNovaSolicitacaoCustoFechado).toBe(true);
          expect(fechadoCheck.checked).toBe(true);
          expect(changeSpy).toHaveBeenCalledTimes(1);
        });

        test("cancelar a 1ª confirmação restaura o checkbox original e não altera nada", async () => {
          setupDom({ statusCustoFechado: statusAtual, nivelOriginal: "FECHADO", usarSelect });
          const liberadoCheck = document.getElementById("Liberadocheck");
          const fechadoCheck = document.getElementById("Fechadocheck");

          global.Swal.fire.mockResolvedValueOnce({ isConfirmed: false });

          verificarBloqueioStatusAutorizado(liberadoCheck);
          await Promise.resolve();
          await Promise.resolve();

          expect(global.Swal.fire).toHaveBeenCalledTimes(1);
          expect(fechadoCheck.checked).toBe(true);
          expect(liberadoCheck.checked).toBe(false);
          expect(window.forcarNovaSolicitacaoCustoFechado).toBe(false);
          expect(statusEfetivo()).toBe(statusAtual);
        });

        test("confirmar a troca mas cancelar a justificativa também restaura o checkbox original", async () => {
          setupDom({ statusCustoFechado: statusAtual, nivelOriginal: "FECHADO", usarSelect });
          const liberadoCheck = document.getElementById("Liberadocheck");
          const fechadoCheck = document.getElementById("Fechadocheck");

          global.Swal.fire
            .mockResolvedValueOnce({ isConfirmed: true })
            .mockResolvedValueOnce({ isConfirmed: false });

          verificarBloqueioStatusAutorizado(liberadoCheck);
          await Promise.resolve();
          await Promise.resolve();
          await Promise.resolve();

          expect(fechadoCheck.checked).toBe(true);
          expect(liberadoCheck.checked).toBe(false);
          expect(window.forcarNovaSolicitacaoCustoFechado).toBe(false);
          expect(statusEfetivo()).toBe(statusAtual);
        });
      });

      describe.each([
        ["Basecheck", "baseCheck"],
        ["Juniorcheck", "juniorCheck"],
        ["Plenocheck", "plenoCheck"],
        ["Seniorcheck", "seniorCheck"],
        ["Seniorcheck2", "seniorCheck2"],
      ])("troca Fechado -> nível padrão (%s)", (checkboxId) => {
        test(`Fechado (${statusAtual}) -> ${checkboxId}: mostra 1 swal só, ao confirmar marca Rejeitado e libera o checkbox`, async () => {
          setupDom({ statusCustoFechado: statusAtual, nivelOriginal: "FECHADO", usarSelect });
          const targetCheck = document.getElementById(checkboxId);
          const changeSpy = jest.fn();
          targetCheck.addEventListener("change", changeSpy);

          global.Swal.fire.mockResolvedValueOnce({ isConfirmed: true });

          const bloqueou = verificarBloqueioStatusAutorizado(targetCheck);
          expect(bloqueou).toBe(true);
          expect(targetCheck.checked).toBe(false);

          await Promise.resolve();
          await Promise.resolve();

          // Só UM swal (nenhuma etapa de justificativa nova, pois não abre nova solicitação)
          expect(global.Swal.fire).toHaveBeenCalledTimes(1);
          expect(global.Swal.fire.mock.calls[0][0].title).toContain(statusLabel);

          expect(statusEfetivo()).toBe("Rejeitado");
          expect(window.forcarRejeicaoCustoFechadoNivelPadrao).toBe(true);
          expect(window.forcarNovaSolicitacaoCustoFechado).toBe(false);
          expect(targetCheck.checked).toBe(true);
          expect(changeSpy).toHaveBeenCalledTimes(1);
        });

        test(`cancelar a troca pra ${checkboxId} restaura o Fechadocheck original`, async () => {
          setupDom({ statusCustoFechado: statusAtual, nivelOriginal: "FECHADO", usarSelect });
          const targetCheck = document.getElementById(checkboxId);
          const fechadoCheck = document.getElementById("Fechadocheck");

          global.Swal.fire.mockResolvedValueOnce({ isConfirmed: false });

          verificarBloqueioStatusAutorizado(targetCheck);
          await Promise.resolve();
          await Promise.resolve();

          expect(fechadoCheck.checked).toBe(true);
          expect(targetCheck.checked).toBe(false);
          expect(window.forcarRejeicaoCustoFechadoNivelPadrao).toBe(false);
          expect(statusEfetivo()).toBe(statusAtual);
        });
      });
    });
  });
});
