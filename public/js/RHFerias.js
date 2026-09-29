import { fetchComToken } from '/utils/utils.js';

// ===== RH — Férias a vencer =====
// Listagem por período, FORA da conferência da folha (botão "Férias" na barra do RH, carregado
// sob demanda — mesmo padrão de Aliquotas.js). Os períodos aquisitivos saem da admissão; o
// saldo, do que foi gozado/lançado em feriasgozos (ver GET /rh/ferias/a-vencer em rotaRH.js).
// Também é por aqui que se lança o HISTÓRICO de férias de antes do sistema: sem ele, quem foi
// admitido há anos aparece com todos os períodos "vencidos".

const fmtData = (iso) => (iso ? String(iso).slice(0, 10).split("-").reverse().join("/") : "—");
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const hojeIso = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
// Mensagem limpa do backend: as rotas do RH respondem { error }, que o fetchComToken não
// reconhece (só erro/message) e embrulha como 'Erro na requisição: {"error":"..."}'.
const msgErro = (err) => err?.corpo?.error || err?.corpo?.erro || err?.corpo?.message || err?.message || "";
const somarDias = (iso, n) => {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
};

// Filtros ficam guardados entre aberturas (e entre o modal principal e o de histórico, que
// substitui o principal enquanto está aberto — o Swal só mostra um por vez).
const filtros = { de: null, ate: null, filtro: "limite", vencidas: true };

// Status → rótulo + cores semânticas do Roots.css (têm versão Dark Mode).
function badgeStatus(l) {
  const estilo = (tom) => `background:var(--status-${tom}-bg);color:var(--status-${tom}-fg);`;
  if (l.status === "vencida") {
    return `<span class="rhf-badge" style="${estilo("erro")}" title="Passou do limite sem gozar — a lei manda pagar em dobro (art. 137 CLT)">Vencida · em dobro</span>`;
  }
  if (l.status === "em_aquisicao") {
    return `<span class="rhf-badge" style="${estilo("neutro")}" title="Ainda não completou os 12 meses do período aquisitivo">Em aquisição</span>`;
  }
  const urgente = l.diasParaLimite <= 60;
  return `<span class="rhf-badge" style="${estilo(urgente ? "alerta" : "info")}" title="Direito adquirido — conceder até ${fmtData(l.limite)}">A vencer · ${l.diasParaLimite} dia(s)</span>`;
}

function montarHtmlFiltros() {
  return `
    <div class="rhf-filtros">
      <label>De <input type="date" id="rhf-de" value="${filtros.de}"></label>
      <label>Até <input type="date" id="rhf-ate" value="${filtros.ate}"></label>
      <div class="rhf-atalhos">
        <button type="button" data-rhf-dias="30">30 dias</button>
        <button type="button" data-rhf-dias="60">60 dias</button>
        <button type="button" data-rhf-dias="90">90 dias</button>
      </div>
      <label>Filtrar por
        <select id="rhf-filtro">
          <option value="limite" ${filtros.filtro === "limite" ? "selected" : ""}>Data limite para conceder</option>
          <option value="aquisicao" ${filtros.filtro === "aquisicao" ? "selected" : ""}>Data em que adquire o direito</option>
        </select>
      </label>
      <label class="rhf-check" title="Mostra também as que já passaram do limite (qualquer data)">
        <input type="checkbox" id="rhf-vencidas" ${filtros.vencidas ? "checked" : ""}> Incluir vencidas
      </label>
      <button type="button" id="rhf-buscar" class="rhf-btn">Buscar</button>
      <button type="button" id="rhf-imprimir" class="rhf-btn rhf-btn-ghost">Imprimir</button>
    </div>
    <div id="rhf-resultado"><p class="rhf-vazio">Carregando...</p></div>`;
}

function montarTabela(linhas) {
  if (!linhas.length) return `<p class="rhf-vazio">Nenhum funcionário com férias nesse período.</p>`;
  return `
    <table class="rhf-tab">
      <thead>
        <tr>
          <th>Funcionário</th>
          <th>Admissão</th>
          <th>Período aquisitivo</th>
          <th>Limite p/ conceder</th>
          <th class="rhf-num">Saldo</th>
          <th>Status</th>
          <th class="rhf-nao-imprime"></th>
        </tr>
      </thead>
      <tbody>
        ${linhas.map((l, i) => `
          <tr>
            <td><strong>${esc(l.nome)}</strong>${l.funcao ? `<br><small>${esc(l.funcao)}</small>` : ""}</td>
            <td>${fmtData(l.admissao)}</td>
            <td>${fmtData(l.aquisitivo_inicio)} a ${fmtData(l.aquisitivo_fim)}</td>
            <td>${fmtData(l.limite)}</td>
            <td class="rhf-num">${l.saldo} dia(s)${l.diasGozados ? `<br><small>${l.diasGozados} já usado(s)</small>` : ""}</td>
            <td>${badgeStatus(l)}</td>
            <td class="rhf-nao-imprime rhf-acoes">
              ${l.status !== "em_aquisicao" ? `<button type="button" class="rhf-btn" data-rhf-programar="${i}" title="Programar as férias deste período (gera o recibo)">Programar</button>` : ""}
              <button type="button" class="rhf-btn rhf-btn-ghost" data-rhf-historico="${i}" title="Marcar como férias já gozadas antes do sistema">Já gozadas</button>
            </td>
          </tr>`).join("")}
      </tbody>
    </table>
    <small class="rhf-nota">Os períodos saem da data de admissão. "Já gozadas" serve pra registrar férias tiradas antes do sistema — sem isso o período continua aparecendo como pendente.</small>`;
}

let ultimasLinhas = [];

async function buscar() {
  const cont = document.getElementById("rhf-resultado");
  if (!cont) return;
  cont.innerHTML = `<p class="rhf-vazio">Carregando...</p>`;
  try {
    const qs = new URLSearchParams({
      de: filtros.de, ate: filtros.ate, filtro: filtros.filtro, vencidas: filtros.vencidas ? "1" : "0",
    });
    const { linhas = [] } = await fetchComToken(`/rh/ferias/a-vencer?${qs}`);
    ultimasLinhas = linhas;
    cont.innerHTML = montarTabela(linhas);
    cont.querySelectorAll("[data-rhf-historico]").forEach((b) =>
      b.addEventListener("click", () => lancarHistorico(ultimasLinhas[Number(b.dataset.rhfHistorico)])));
    // Programar a partir da listagem: já abre no período da linha; ao terminar volta pra lista.
    cont.querySelectorAll("[data-rhf-programar]").forEach((b) =>
      b.addEventListener("click", () => {
        const l = ultimasLinhas[Number(b.dataset.rhfProgramar)];
        abrirProgramarFerias(l.idfuncionario, l.nome, null, l.aquisitivo_inicio, abrirFeriasAVencer);
      }));
  } catch (err) {
    console.error("Erro ao buscar férias a vencer:", err);
    cont.innerHTML = `<p class="rhf-vazio">Erro ao carregar as férias.</p>`;
  }
}

function lerFiltros() {
  filtros.de = document.getElementById("rhf-de").value || filtros.de;
  filtros.ate = document.getElementById("rhf-ate").value || filtros.ate;
  filtros.filtro = document.getElementById("rhf-filtro").value;
  filtros.vencidas = document.getElementById("rhf-vencidas").checked;
}

export async function abrirFeriasAVencer() {
  if (!filtros.de) {
    filtros.de = hojeIso();
    filtros.ate = somarDias(filtros.de, 90);
  }
  await Swal.fire({
    title: "Férias a Vencer/Vencidas",
    html: montarHtmlFiltros(),
    width: "min(1100px, 96vw)",
    showConfirmButton: false,
    showCloseButton: true,
    customClass: { popup: "rhf-popup" },
    didOpen: () => {
      document.getElementById("rhf-buscar").addEventListener("click", () => {
        lerFiltros();
        if (filtros.de > filtros.ate) {
          document.getElementById("rhf-resultado").innerHTML = `<p class="rhf-vazio">A data inicial é depois da final.</p>`;
          return;
        }
        buscar();
      });
      document.querySelectorAll("[data-rhf-dias]").forEach((b) => b.addEventListener("click", () => {
        filtros.de = hojeIso();
        filtros.ate = somarDias(filtros.de, Number(b.dataset.rhfDias));
        document.getElementById("rhf-de").value = filtros.de;
        document.getElementById("rhf-ate").value = filtros.ate;
        lerFiltros();
        buscar();
      }));
      document.getElementById("rhf-imprimir").addEventListener("click", imprimir);
      buscar();
    },
  });
}

// Marca o período (e, se quiser, os anteriores) como gozado antes do sistema. Datas de gozo são
// opcionais — o RH pode não ter registro de férias de anos atrás. Ao terminar, volta pra lista.
async function lancarHistorico(l) {
  if (!l) return;
  const temAnteriores = ultimasLinhas.some((x) => x.idfuncionario === l.idfuncionario && x.aquisitivo_inicio < l.aquisitivo_inicio)
    || l.aquisitivo_inicio > l.admissao;
  const r = await Swal.fire({
    title: "Férias já gozadas",
    html: `
      <p style="margin:0 0 10px;"><strong>${esc(l.nome)}</strong><br>
      Período aquisitivo ${fmtData(l.aquisitivo_inicio)} a ${fmtData(l.aquisitivo_fim)} — saldo de ${l.saldo} dia(s).</p>
      <div class="rhf-hist-datas">
        <label>Gozo de <input type="date" id="rhf-h-ini"></label>
        <label>até <input type="date" id="rhf-h-fim"></label>
      </div>
      <small style="display:block;margin:6px 0 10px;color:var(--text-2);">Datas opcionais: se não tiver o registro, deixe em branco.</small>
      ${temAnteriores ? `
      <label class="rhf-check" style="justify-content:center;">
        <input type="checkbox" id="rhf-h-anteriores"> Marcar também todos os períodos ANTERIORES deste funcionário
      </label>` : ""}`,
    showCancelButton: true,
    confirmButtonText: "Registrar",
    cancelButtonText: "Voltar",
    focusCancel: true,
    preConfirm: () => {
      const ini = document.getElementById("rhf-h-ini").value;
      const fim = document.getElementById("rhf-h-fim").value;
      if (ini && fim && fim < ini) {
        Swal.showValidationMessage("O fim do gozo não pode ser antes do início.");
        return false;
      }
      return { ini, fim, anteriores: !!document.getElementById("rhf-h-anteriores")?.checked };
    },
  });

  if (r.isConfirmed) {
    try {
      const res = await fetchComToken("/rh/ferias/historico", {
        method: "POST",
        body: {
          idfuncionario: l.idfuncionario, aquisitivo_inicio: l.aquisitivo_inicio,
          incluirAnteriores: r.value.anteriores,
          gozo_inicio: r.value.ini || null, gozo_fim: r.value.fim || null,
        },
      });
      await Swal.fire({ icon: "success", title: "Registrado", text: `${res.quitados} período(s) marcado(s) como gozado(s).`, timer: 1800, showConfirmButton: false });
    } catch (err) {
      console.error("Erro ao lançar histórico de férias:", err);
      await Swal.fire({ icon: "error", title: "Erro", text: msgErro(err) || "Não foi possível registrar.", confirmButtonText: "Ok" });
    }
  }
  abrirFeriasAVencer(); // volta pra lista com os mesmos filtros
}

// Impressão da lista atual (sem a coluna de ação), numa guia própria — mesmo padrão das
// impressões do RH.js.
function imprimir() {
  if (!ultimasLinhas.length) {
    Swal.showValidationMessage?.("Nada para imprimir nessa busca.");
    return;
  }
  const rotuloFiltro = filtros.filtro === "aquisicao" ? "Adquirem o direito" : "Limite para conceder";
  const linhas = ultimasLinhas.map((l) => `
    <tr>
      <td>${esc(l.nome)}</td><td>${fmtData(l.admissao)}</td>
      <td>${fmtData(l.aquisitivo_inicio)} a ${fmtData(l.aquisitivo_fim)}</td>
      <td>${fmtData(l.limite)}</td><td style="text-align:right;">${l.saldo}</td>
      <td>${l.status === "vencida" ? "Vencida (em dobro)" : l.status === "em_aquisicao" ? "Em aquisição" : `A vencer (${l.diasParaLimite} dias)`}</td>
    </tr>`).join("");
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Férias a Vencer/Vencidas</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 12px; margin: 16px; color: #000; }
      h1 { font-size: 16px; margin: 0 0 4px; } p { margin: 0 0 12px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #999; padding: 4px 6px; text-align: left; }
      th { background: #eee; }
    </style></head><body>
    <h1>Férias a Vencer/Vencidas</h1>
    <p>${rotuloFiltro}: ${fmtData(filtros.de)} a ${fmtData(filtros.ate)}${filtros.vencidas && filtros.filtro === "limite" ? " · inclui vencidas" : ""} · emitido em ${fmtData(hojeIso())}</p>
    <table><thead><tr><th>Funcionário</th><th>Admissão</th><th>Período aquisitivo</th><th>Limite p/ conceder</th><th>Saldo (dias)</th><th>Status</th></tr></thead>
    <tbody>${linhas}</tbody></table></body></html>`);
  win.document.close();
  win.focus();
  win.onafterprint = () => win.close();
  try { win.print(); } catch (e) {}
}

// ===== Programar férias =====
// Chamado pelo holerite (RH.js, botão "Programar férias") e pela listagem ("Programar").
// Até 3 gozos (CLT art. 134 §1º) + venda de 10 dias; "Calcular prévia" mostra o recibo sem
// gravar (POST /rh/ferias/programar com simular=true) e o confirmar grava. Toda regra (saldo,
// 14/5 dias, sobreposição, mensal já conferido) é validada no backend — aqui só a prévia.
//  - aoConcluir: chamado depois de programar/cancelar (ex.: recarregar o holerite aberto)
//  - aoFechar:   chamado quando o modal fecha (ex.: voltar pra listagem de férias)
export async function abrirProgramarFerias(idfuncionario, nome, aoConcluir = null, aquisitivoInicial = null, aoFechar = null) {
  let dados;
  try {
    dados = await fetchComToken(`/rh/ferias/funcionario/${idfuncionario}`);
  } catch (err) {
    await Swal.fire({ icon: "warning", title: "Programar férias", text: msgErro(err) || "Não foi possível carregar as férias do funcionário.", confirmButtonText: "Ok" });
    if (aoFechar) aoFechar();
    return;
  }
  const periodos = (dados.periodos || []).filter((p) => p.saldo > 0);
  const programadas = (dados.periodos || []).flatMap((p) =>
    p.gozos.filter((g) => g.origem === "programada").map((g) => ({ ...g, periodo: p })));
  const reabrir = () => abrirProgramarFerias(idfuncionario, nome, aoConcluir, aquisitivoInicial, aoFechar);
  // O Swal só mostra um modal por vez: abrir a confirmação de "Cancelar" fecha este aqui, e esse
  // fechamento não é o usuário saindo — não pode disparar o aoFechar (voltar pra listagem).
  let trocouDeModal = false;

  const padrao = periodos.find((p) => p.aquisitivo_inicio === aquisitivoInicial)
    || periodos.find((p) => p.status === "vencida" || p.status === "adquirida")
    || periodos[0];
  const rotuloStatus = { vencida: "vencida — em dobro", adquirida: "adquirida", em_aquisicao: "em aquisição" };

  const htmlProgramadas = programadas.length ? `
    <div class="rhf-bloco">
      <strong>Férias já programadas</strong>
      <table class="rhf-tab">
        <thead><tr><th>Gozo</th><th>Dias</th><th>Período aquisitivo</th><th>Recibo</th><th></th></tr></thead>
        <tbody>
          ${programadas.map((g) => {
            const travado = g.recibo_status === "Pago" || g.recibo_conferido;
            return `<tr>
              <td>${fmtData(g.gozo_inicio)} a ${fmtData(g.gozo_fim)}${g.abono ? " <small>+ 10 dias vendidos</small>" : ""}</td>
              <td>${g.dias}</td>
              <td>${fmtData(g.periodo.aquisitivo_inicio)} a ${fmtData(g.periodo.aquisitivo_fim)}</td>
              <td>${g.recibo_status === "Pago" ? "Pago" : g.recibo_conferido ? "Conferido" : "Pendente"}</td>
              <td>${travado
                ? `<small title="Desfaça a conferência do recibo pra poder cancelar">travado</small>`
                : `<button type="button" class="rhf-btn rhf-btn-ghost" data-rhf-cancelar="${g.idferias}">Cancelar</button>`}</td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>` : "";

  const linhaGozo = (n) => `
    <div class="rhf-gozo" data-gozo="${n}">
      <span class="rhf-gozo-rotulo">${n}º período${n === 1 ? "" : " <small>(opcional)</small>"}</span>
      <label>Início <input type="date" class="rhf-g-ini"></label>
      <label>Fim <input type="date" class="rhf-g-fim"></label>
      <span class="rhf-g-dias">—</span>
    </div>`;

  const html = periodos.length ? `
    ${htmlProgramadas}
    <div class="rhf-bloco">
      <label class="rhf-campo">Período aquisitivo
        <select id="rhf-p-periodo">
          ${periodos.map((p) => `<option value="${p.aquisitivo_inicio}" ${p === padrao ? "selected" : ""}>
            ${fmtData(p.aquisitivo_inicio)} a ${fmtData(p.aquisitivo_fim)} · saldo ${p.saldo} dia(s) · ${rotuloStatus[p.status] || p.status}
          </option>`).join("")}
        </select>
      </label>
      ${linhaGozo(1)}${linhaGozo(2)}${linhaGozo(3)}
      <label class="rhf-check rhf-abono"><input type="checkbox" id="rhf-p-abono"> Vender 10 dias (abono pecuniário — sem INSS/IRRF)</label>
      <small class="rhf-nota">Até 3 períodos: um com pelo menos 14 dias e os outros com pelo menos 5 (CLT art. 134 §1º). O recibo vence 2 dias antes do início (art. 145) e só vai pra Vencimentos depois de conferido na lista do RH.</small>
      <button type="button" id="rhf-p-previa" class="rhf-btn rhf-btn-ghost">Calcular prévia</button>
      <div id="rhf-p-resultado"></div>
    </div>` : `${htmlProgramadas}<p class="rhf-vazio">Nenhum período aquisitivo com saldo pra programar.</p>`;

  // Lê o formulário no formato do backend.
  const lerForm = () => ({
    idfuncionario,
    aquisitivo_inicio: document.getElementById("rhf-p-periodo").value,
    abono: document.getElementById("rhf-p-abono").checked,
    gozos: Array.from(document.querySelectorAll(".rhf-gozo")).map((el) => ({
      inicio: el.querySelector(".rhf-g-ini").value, fim: el.querySelector(".rhf-g-fim").value,
    })).filter((g) => g.inicio || g.fim),
  });

  const pintarPrevia = (r) => {
    const cont = document.getElementById("rhf-p-resultado");
    const fmtR = (v) => "R$ " + (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    cont.innerHTML = `
      ${(r.avisos || []).map((a) => `<div class="rhf-aviso">${esc(a)}</div>`).join("")}
      ${(r.mensaisConferidos || []).length ? `<div class="rhf-aviso rhf-aviso-erro">Holerite(s) mensal(is) já conferido(s) nesse período: ${r.mensaisConferidos.join(", ")} — desfaça a conferência antes de programar.</div>` : ""}
      ${(r.recibos || []).map((rec) => `
        <div class="rhf-recibo">
          <strong>Recibo de férias — início em ${String(rec.mes).padStart(2, "0")}/${rec.ano}</strong> · pagar até <strong>${fmtData(rec.dtvcto)}</strong>
          <table class="rhf-tab">
            <tbody>
              ${rec.itens.map((i) => `<tr><td>${esc(i.descricao)}</td><td class="rhf-num">${i.tipo === "D" ? "− " : ""}${fmtR(i.valor)}</td></tr>`).join("")}
              <tr class="rhf-total"><td>Líquido a receber</td><td class="rhf-num">${fmtR(rec.liquido)}</td></tr>
            </tbody>
          </table>
        </div>`).join("")}
      <small class="rhf-nota">No holerite mensal do mês trabalhado os dias de férias saem do salário (já pagos aqui), e os dias úteis de férias saem do VA/VT.</small>`;
  };

  const r = await Swal.fire({
    title: `Programar férias — ${esc(nome)}`,
    html,
    width: "min(900px, 96vw)",
    showCancelButton: true,
    showConfirmButton: periodos.length > 0,
    confirmButtonText: "Programar férias",
    cancelButtonText: "Fechar",
    customClass: { popup: "rhf-popup" },
    didOpen: () => {
      // Dias de cada gozo ao vivo (datas inclusivas).
      document.querySelectorAll(".rhf-gozo").forEach((el) => {
        const atualizar = () => {
          const ini = el.querySelector(".rhf-g-ini").value, fim = el.querySelector(".rhf-g-fim").value;
          const alvo = el.querySelector(".rhf-g-dias");
          if (!ini || !fim) { alvo.textContent = "—"; return; }
          const d = Math.round((Date.parse(fim) - Date.parse(ini)) / 86400000) + 1;
          alvo.textContent = d > 0 ? `${d} dia(s)` : "datas invertidas";
        };
        el.querySelectorAll("input").forEach((i) => i.addEventListener("change", atualizar));
      });
      const selPeriodo = document.getElementById("rhf-p-periodo");
      const chkAbono = document.getElementById("rhf-p-abono");
      const travarAbono = () => {
        if (!selPeriodo) return;
        const p = periodos.find((x) => x.aquisitivo_inicio === selPeriodo.value);
        chkAbono.disabled = !!p?.abono;
        if (p?.abono) chkAbono.checked = false;
        chkAbono.parentElement.title = p?.abono ? "Esse período já tem os 10 dias vendidos" : "";
      };
      selPeriodo?.addEventListener("change", travarAbono);
      travarAbono();

      document.getElementById("rhf-p-previa")?.addEventListener("click", async () => {
        const cont = document.getElementById("rhf-p-resultado");
        cont.innerHTML = `<p class="rhf-vazio">Calculando...</p>`;
        try {
          pintarPrevia(await fetchComToken("/rh/ferias/programar", { method: "POST", body: { ...lerForm(), simular: true } }));
        } catch (err) {
          cont.innerHTML = `<div class="rhf-aviso rhf-aviso-erro">${esc(msgErro(err) || "Não foi possível calcular.")}</div>`;
        }
      });

      document.querySelectorAll("[data-rhf-cancelar]").forEach((b) => b.addEventListener("click", async () => {
        trocouDeModal = true;
        const conf = await Swal.fire({
          icon: "warning", title: "Cancelar essas férias?",
          text: "O gozo é removido e o recibo de férias é recalculado (ou apagado, se era o único). O holerite mensal volta a pagar esses dias.",
          showCancelButton: true, confirmButtonText: "Sim, cancelar", cancelButtonText: "Voltar", focusCancel: true,
        });
        if (conf.isConfirmed) {
          try {
            await fetchComToken(`/rh/ferias/programada/${b.dataset.rhfCancelar}`, { method: "DELETE" });
            if (aoConcluir) aoConcluir();
          } catch (err) {
            await Swal.fire({ icon: "error", title: "Não foi possível cancelar", text: msgErro(err) || "", confirmButtonText: "Ok" });
          }
        }
        reabrir();
      }));
    },
    preConfirm: async () => {
      try {
        return await fetchComToken("/rh/ferias/programar", { method: "POST", body: lerForm() });
      } catch (err) {
        Swal.showValidationMessage(msgErro(err) || "Não foi possível programar as férias.");
        return false;
      }
    },
  });

  if (r.isConfirmed) {
    await Swal.fire({
      icon: "success", title: "Férias programadas",
      text: "Recibo de férias gerado. Confira na lista do RH (seção Recibos de férias do mês de início) pra ele ir pra Vencimentos.",
      confirmButtonText: "Ok",
    });
    if (aoConcluir) aoConcluir();
  }
  // Cancelar um gozo reabre o modal por conta própria (reabrir) — aoFechar só no fechamento real.
  if (!trocouDeModal && aoFechar) aoFechar();
}
