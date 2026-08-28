// ===== TI Mode: gerenciamento de equipamentos, estoque e manutenção =====
import { fetchComToken } from '/utils/utils.js';

let painelMontado = false;
let cacheEquipamentos = [];

async function fetchTI(caminho, opcoes = {}) {
  const resp = await fetchComToken(`/ti${caminho}`, opcoes);
  if (!resp) throw new Error("Falha na requisição ao módulo TI.");
  return resp;
}

function tiLoading(texto = "Carregando...") {
  return `
    <div class="ti-loading">
      <span class="ti-spinner"></span>
      <span>${texto}</span>
    </div>
  `;
}

function tiVazio(texto, icone = "inbox") {
  return `
    <div class="ti-card-vazio">
      <span class="material-symbols-outlined">${icone}</span>
      <span>${texto}</span>
    </div>
  `;
}

function montarPainelTI() {
  if (painelMontado) return;
  painelMontado = true;

  const conteudo = document.getElementById("conteudo");
  if (!conteudo) return;

  const panel = document.createElement("div");
  panel.id = "ti-panel";
  panel.innerHTML = `
    <div class="ti-abas">
      <button type="button" class="ti-aba-btn" data-aba="dashboard"><span class="material-symbols-outlined">dashboard</span>Dashboard</button>
      <button type="button" class="ti-aba-btn" data-aba="eventos"><span class="material-symbols-outlined">event</span>Eventos</button>
      <button type="button" class="ti-aba-btn" data-aba="equipamentos"><span class="material-symbols-outlined">inventory_2</span>Equipamentos</button>
      <button type="button" class="ti-aba-btn" data-aba="estoque"><span class="material-symbols-outlined">warehouse</span>Estoque</button>
      <button type="button" class="ti-aba-btn" data-aba="custodia"><span class="material-symbols-outlined">badge</span>Custódia</button>
      <button type="button" class="ti-aba-btn" data-aba="manutencao"><span class="material-symbols-outlined">build</span>Manutenção</button>
    </div>
    <div id="ti-aba-dashboard" class="ti-aba-conteudo"></div>
    <div id="ti-aba-eventos" class="ti-aba-conteudo" style="display:none;"></div>
    <div id="ti-aba-equipamentos" class="ti-aba-conteudo" style="display:none;"></div>
    <div id="ti-aba-estoque" class="ti-aba-conteudo" style="display:none;"></div>
    <div id="ti-aba-custodia" class="ti-aba-conteudo" style="display:none;"></div>
    <div id="ti-aba-manutencao" class="ti-aba-conteudo" style="display:none;"></div>
  `;
  conteudo.appendChild(panel);

  panel.querySelectorAll(".ti-aba-btn").forEach((btn) => {
    btn.addEventListener("click", () => trocarAbaTI(btn.dataset.aba));
  });

  trocarAbaTI("dashboard");
}

function trocarAbaTI(aba) {
  ["dashboard", "eventos", "equipamentos", "estoque", "custodia", "manutencao"].forEach((nome) => {
    const el = document.getElementById(`ti-aba-${nome}`);
    if (el) el.style.display = nome === aba ? "block" : "none";
  });

  document.querySelectorAll("#ti-panel .ti-aba-btn").forEach((btn) => {
    btn.classList.toggle("ativo", btn.dataset.aba === aba);
  });

  if (aba === "dashboard") renderAbaDashboard();
  if (aba === "eventos") renderAbaEventos();
  if (aba === "equipamentos") renderAbaEquipamentos();
  if (aba === "estoque") renderAbaEstoque();
  if (aba === "custodia") renderAbaCustodia();
  if (aba === "manutencao") renderAbaManutencao();
}

// ===== Busca (mesmo padrão visual do #ceo-busca) =====
function montarCampoBusca(idInput, placeholder, onFiltrar) {
  return `
    <input type="text" id="${idInput}" class="busca-funcionario-input" placeholder="${placeholder}" autocomplete="off" style="margin-bottom:12px; width:100%; max-width:320px;">
  `;
}

function ativarBuscaClientSide(idInput, seletorLinhas, textoDaLinha) {
  const input = document.getElementById(idInput);
  if (!input) return;
  input.addEventListener("input", () => {
    const termo = input.value.trim().toLowerCase();
    document.querySelectorAll(seletorLinhas).forEach((linha) => {
      const texto = textoDaLinha(linha).toLowerCase();
      linha.style.display = !termo || texto.includes(termo) ? "" : "none";
    });
  });
}

// ===== Dashboard =====
let mesCalendarioTI = new Date().getMonth();
let anoCalendarioTI = new Date().getFullYear();

async function renderAbaDashboard() {
  const container = document.getElementById("ti-aba-dashboard");
  if (!container) return;
  container.innerHTML = tiLoading("Carregando dashboard...");

  try {
    const dash = await fetchTI("/dashboard");

    const avisoPredestinado = dash.qtd_itens_predestinados > 0
      ? `<div class="ti-chip-aviso">⚠ ${dash.qtd_itens_predestinados} predestinação(ões) pendente(s) — ${dash.total_predestinado} unidade(s) já direcionadas</div>`
      : "";

    container.innerHTML = `
      <div class="ti-dashboard-card">
        ${avisoPredestinado}
        <div class="ti-resumo">
          <div class="ti-resumo-card">
            <span>Total de equipamentos</span>
            <strong>${dash.total_equipamentos}</strong>
          </div>
          <div class="ti-resumo-card">
            <span>Em estoque</span>
            <strong>${dash.total_estoque}</strong>
          </div>
          <div class="ti-resumo-card">
            <span>Em manutenção</span>
            <strong class="${dash.total_manutencao > 0 ? 'neg' : ''}">${dash.total_manutencao}</strong>
          </div>
          <div class="ti-resumo-card">
            <span>Alocados em eventos ativos</span>
            <strong>${dash.total_alocado}</strong>
          </div>
          <div class="ti-resumo-card">
            <span>Predestinados</span>
            <strong class="${dash.total_predestinado > 0 ? 'pos' : ''}">${dash.total_predestinado}</strong>
          </div>
        </div>
        <div id="ti-calendario-wrapper"></div>
      </div>
    `;

    await renderCalendarioTI();
  } catch (erro) {
    console.error("Erro ao carregar dashboard (TI):", erro);
    container.innerHTML = tiVazio("Erro ao carregar dashboard.", "error");
  }
}

async function renderCalendarioTI() {
  const wrapper = document.getElementById("ti-calendario-wrapper");
  if (!wrapper) return;

  let eventos = [];
  try {
    eventos = await fetchTI("/eventos-ativos");
  } catch (erro) {
    console.error("Erro ao carregar eventos para o calendário (TI):", erro);
    wrapper.innerHTML = tiVazio("Erro ao carregar calendário de eventos.", "error");
    return;
  }

  // Mapa dia -> eventos que ocupam aquele dia (inclui período completo de realização)
  const mapaDias = {};
  eventos.forEach((ev) => {
    if (!ev.dtinirealizacao || !ev.dtfimrealizacao) return;
    const inicio = new Date(ev.dtinirealizacao);
    const fim = new Date(ev.dtfimrealizacao);
    for (let d = new Date(inicio); d <= fim; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().split("T")[0];
      if (!mapaDias[key]) mapaDias[key] = [];
      mapaDias[key].push(ev);
    }
  });

  const nomesMeses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const diasSemana = ["D","S","T","Q","Q","S","S"];
  const primeiroDiaSemana = new Date(anoCalendarioTI, mesCalendarioTI, 1).getDay();
  const ultimoDia = new Date(anoCalendarioTI, mesCalendarioTI + 1, 0).getDate();
  const hojeKey = new Date().toISOString().split("T")[0];

  let celulas = "";
  for (let i = 0; i < primeiroDiaSemana; i++) {
    celulas += `<div class="ti-cal-dia ti-cal-vazio"></div>`;
  }
  for (let dia = 1; dia <= ultimoDia; dia++) {
    const dataDia = new Date(anoCalendarioTI, mesCalendarioTI, dia);
    const key = dataDia.toISOString().split("T")[0];
    const eventosDoDia = mapaDias[key] || [];
    const hoje = key === hojeKey ? "ti-cal-hoje" : "";
    const comEvento = eventosDoDia.length ? "ti-cal-com-evento" : "";

    celulas += `
      <div class="ti-cal-dia ${hoje} ${comEvento}" data-dia="${key}">
        <span class="ti-cal-numero">${dia}</span>
        ${eventosDoDia.length ? `<span class="ti-cal-badge">${eventosDoDia.length}</span>` : ""}
      </div>
    `;
  }

  const proximosEventos = [...eventos]
    .sort((a, b) => new Date(a.dtfimrealizacao) - new Date(b.dtfimrealizacao))
    .slice(0, 6);

  wrapper.innerHTML = `
    <div class="ti-calendario-linha">
      <div class="ti-calendario-card">
        <div class="ti-calendario-header">
          <button type="button" id="ti-cal-prev">‹</button>
          <strong>${nomesMeses[mesCalendarioTI]} / ${anoCalendarioTI}</strong>
          <button type="button" id="ti-cal-next">›</button>
        </div>
        <div class="ti-calendario-grid ti-calendario-semana">
          ${diasSemana.map((d) => `<div class="ti-cal-dia-semana">${d}</div>`).join("")}
        </div>
        <div class="ti-calendario-grid">${celulas}</div>
      </div>
      <div id="ti-cal-detalhe" class="ti-cal-detalhe">
        <strong>Próximos eventos com equipamentos</strong>
        <ul class="ti-cal-lista-proximos">
          ${proximosEventos.map((ev) => `
            <li data-idevento="${ev.idevento}">
              <span>${ev.nmevento}</span>
              <small>${new Date(ev.dtfimrealizacao).toLocaleDateString("pt-BR")} — ${ev.qtd_total_alocada} unidade(s)</small>
            </li>
          `).join("") || "<li>Nenhum evento com equipamentos no momento.</li>"}
        </ul>
      </div>
    </div>
  `;

  document.getElementById("ti-cal-prev").addEventListener("click", () => {
    mesCalendarioTI--;
    if (mesCalendarioTI < 0) { mesCalendarioTI = 11; anoCalendarioTI--; }
    renderCalendarioTI();
  });
  document.getElementById("ti-cal-next").addEventListener("click", () => {
    mesCalendarioTI++;
    if (mesCalendarioTI > 11) { mesCalendarioTI = 0; anoCalendarioTI++; }
    renderCalendarioTI();
  });

  wrapper.querySelectorAll(".ti-cal-com-evento").forEach((celula) => {
    celula.addEventListener("click", () => {
      exibirDetalheDiaTI(celula.dataset.dia, mapaDias[celula.dataset.dia] || []);
    });
  });

  wrapper.querySelectorAll(".ti-cal-lista-proximos li[data-idevento]").forEach((li) => {
    li.addEventListener("click", () => {
      const ev = eventos.find((e) => String(e.idevento) === li.dataset.idevento);
      if (ev) exibirDetalheEventoTI(ev);
    });
  });
}

async function exibirDetalheDiaTI(diaKey, eventosDoDia) {
  const painel = document.getElementById("ti-cal-detalhe");
  if (!painel) return;
  const dataFormatada = new Date(diaKey + "T00:00:00").toLocaleDateString("pt-BR");

  painel.innerHTML = `<strong>Eventos em ${dataFormatada}</strong><p>Carregando detalhes...</p>`;

  const detalhes = await Promise.all(eventosDoDia.map(async (ev) => {
    try {
      const equipamentos = await fetchTI(`/eventos/${ev.idevento}/equipamentos`);
      return { ev, equipamentos };
    } catch {
      return { ev, equipamentos: [] };
    }
  }));

  painel.innerHTML = `
    <strong>Eventos em ${dataFormatada}</strong>
    ${detalhes.map(({ ev, equipamentos }) => `
      <div class="ti-cal-evento-detalhe">
        <div class="ti-cal-evento-titulo">${ev.nmevento}</div>
        <ul>
          ${equipamentos.map((eq) => `
            <li>${eq.descequip}: ${eq.qtdorcada} orçado(s)${eq.qtdpredestinada > 0 ? ` — ${eq.qtdpredestinada} predestinado(s)` : ""}</li>
          `).join("") || "<li>Nenhum equipamento orçado.</li>"}
        </ul>
      </div>
    `).join("")}
    <button type="button" id="ti-cal-ir-eventos">Ver na aba Eventos</button>
  `;

  document.getElementById("ti-cal-ir-eventos").addEventListener("click", () => trocarAbaTI("eventos"));
}

async function exibirDetalheEventoTI(ev) {
  await exibirDetalheDiaTI(ev.dtfimrealizacao.split("T")[0], [ev]);
}

// ===== Eventos =====
// Escala "temperatura": frio (aberto, ainda esfriado) -> quente (fechado, no forno).
const STATUS_ORCAMENTO_COR = { A: "#4FC3F7", P: "#FFC107", E: "#FF8C00", F: "#DC2626", R: "#9CA3AF" };
const STATUS_ORCAMENTO_LABEL = { A: "Aberto", P: "Proposta", E: "Em Andamento", F: "Fechado", R: "Recusado" };
const STATUS_CONTROLE_LABEL = { confirmado: "Confirmado", incerto: "Incerto", cancelado: "Cancelado" };
const STATUS_CONTROLE_COR = { confirmado: "var(--Aproved)", incerto: "var(--Pending)", cancelado: "var(--Reject)" };

const COR_FINALIZADO = "#9CA3AF";

let cacheEventosAtivos = [];
const filtroEventosTI = {
  busca: "",
  periodo: "mensal",
  mes: new Date().getMonth() + 1,
  ano: new Date().getFullYear(),
  escopo: "abertos", // 'abertos' | 'finalizados' | 'todos'
};

function formatarIntervaloData(inicio, fim) {
  if (!inicio && !fim) return "ND";
  const fmt = (d) => new Date(d).toLocaleDateString("pt-BR");
  if (inicio && fim && fmt(inicio) !== fmt(fim)) return `${fmt(inicio)} a ${fmt(fim)}`;
  return fmt(inicio || fim);
}

function eventoNoPeriodo(ev) {
  const inicio = ev.dtinirealizacao ? new Date(ev.dtinirealizacao) : null;
  const fim = ev.dtfimrealizacao ? new Date(ev.dtfimrealizacao) : inicio;
  if (!inicio || !fim) return true;

  if (filtroEventosTI.periodo === "semanal") {
    const hoje = new Date();
    const diaSemana = hoje.getDay();
    const inicioSemana = new Date(hoje);
    inicioSemana.setDate(hoje.getDate() - diaSemana);
    inicioSemana.setHours(0, 0, 0, 0);
    const fimSemana = new Date(inicioSemana);
    fimSemana.setDate(inicioSemana.getDate() + 6);
    fimSemana.setHours(23, 59, 59, 999);
    return inicio <= fimSemana && fim >= inicioSemana;
  }

  if (filtroEventosTI.periodo === "mensal") {
    const inicioMes = new Date(filtroEventosTI.ano, filtroEventosTI.mes - 1, 1);
    const fimMes = new Date(filtroEventosTI.ano, filtroEventosTI.mes, 0, 23, 59, 59);
    return inicio <= fimMes && fim >= inicioMes;
  }

  // anual
  const inicioAno = new Date(filtroEventosTI.ano, 0, 1);
  const fimAno = new Date(filtroEventosTI.ano, 11, 31, 23, 59, 59);
  return inicio <= fimAno && fim >= inicioAno;
}

function montarSubFiltroPeriodo() {
  const anoAtual = new Date().getFullYear();
  const opcoesAno = Array.from({ length: 5 }, (_, i) => anoAtual - 1 + i)
    .map((a) => `<option value="${a}" ${a === filtroEventosTI.ano ? "selected" : ""}>${a}</option>`).join("");

  if (filtroEventosTI.periodo === "semanal") {
    return `<label class="label-select">Período</label><div class="wrapper select-wrapper" style="width:155px;"><span class="anual-info">Semana atual</span></div>`;
  }
  if (filtroEventosTI.periodo === "anual") {
    return `<label class="label-select">Ano</label><div class="wrapper select-wrapper" style="width:110px;"><select id="ti-filtro-ano" class="select-simples">${opcoesAno}</select></div>`;
  }
  const nomesMeses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const opcoesMes = nomesMeses.map((nome, i) => `<option value="${i + 1}" ${i + 1 === filtroEventosTI.mes ? "selected" : ""}>${nome} / ${filtroEventosTI.ano}</option>`).join("");
  return `<label class="label-select">Mês</label><div class="wrapper select-wrapper" style="width:155px;"><select id="ti-filtro-mes" class="select-simples">${opcoesMes}</select></div>`;
}

async function renderAbaEventos() {
  const container = document.getElementById("ti-aba-eventos");
  if (!container) return;
  container.innerHTML = tiLoading("Carregando eventos...");

  try {
    cacheEventosAtivos = await fetchTI(`/eventos-ativos?filtro=${filtroEventosTI.escopo}`);
  } catch (erro) {
    console.error("Erro ao carregar eventos ativos (TI):", erro);
    container.innerHTML = tiVazio("Erro ao carregar eventos ativos.", "error");
    return;
  }

  const escopos = [
    { valor: "abertos", label: "Abertos" },
    { valor: "finalizados", label: "Encerrados" },
    { valor: "todos", label: "Todos" },
  ];
  const periodos = ["semanal", "mensal", "anual"];

  container.innerHTML = `
    <div class="Evt-container">
      <div style="display:flex; gap:20px; flex-wrap:wrap; align-items:flex-end;">
        <div class="filtro-grupo">
          <label class="label-select">Visualizar Eventos</label>
          <div class="wrapper" style="width:300px;">
            ${escopos.map((op) => `
              <div class="option" style="width:88px;">
                <input ${filtroEventosTI.escopo === op.valor ? "checked" : ""} value="${op.valor}" name="ti-statusEvt" type="radio" class="input">
                <div class="btn"><span class="span">${op.label}</span></div>
              </div>
            `).join("")}
          </div>
        </div>
        <div class="filtro-grupo">
          <label class="label-select">Período</label>
          <div class="wrapper" style="width:230px;">
            ${periodos.map((p) => `
              <div class="option" style="width:70px;">
                <input ${filtroEventosTI.periodo === p ? "checked" : ""} value="${p}" name="ti-periodoEvt" type="radio" class="input">
                <div class="btn"><span class="span">${p.charAt(0).toUpperCase() + p.slice(1)}</span></div>
              </div>
            `).join("")}
          </div>
        </div>
        <div class="filtro-grupo" id="ti-subfiltro-periodo">${montarSubFiltroPeriodo()}</div>
        <div class="filtro-grupo">
          <label class="label-select">Buscar Evento</label>
          <div class="wrapper select-wrapper busca-evento-wrapper" style="width:260px;">
            <input type="text" id="ti-busca-eventos" class="busca-evento-input" placeholder="Buscar evento..." autocomplete="off">
          </div>
        </div>
      </div>
    </div>
    <div id="ti-lista-eventos" style="margin-top:20px;"></div>
  `;

  document.getElementById("ti-busca-eventos").addEventListener("input", (e) => {
    filtroEventosTI.busca = e.target.value.trim().toLowerCase();
    renderListaEventosTI();
  });

  container.querySelectorAll('input[name="ti-statusEvt"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      filtroEventosTI.escopo = radio.value;
      renderAbaEventos();
    });
  });

  container.querySelectorAll('input[name="ti-periodoEvt"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      filtroEventosTI.periodo = radio.value;
      document.getElementById("ti-subfiltro-periodo").innerHTML = montarSubFiltroPeriodo();
      ligarEventosSubFiltro();
      renderListaEventosTI();
    });
  });

  ligarEventosSubFiltro();
  renderListaEventosTI();
}

function ligarEventosSubFiltro() {
  const selMes = document.getElementById("ti-filtro-mes");
  const selAno = document.getElementById("ti-filtro-ano");
  if (selMes) selMes.addEventListener("change", () => { filtroEventosTI.mes = Number(selMes.value); renderListaEventosTI(); });
  if (selAno) selAno.addEventListener("change", () => { filtroEventosTI.ano = Number(selAno.value); renderListaEventosTI(); });
}

function renderListaEventosTI() {
  const lista = document.getElementById("ti-lista-eventos");
  if (!lista) return;

  let eventos = cacheEventosAtivos.filter(eventoNoPeriodo);
  if (filtroEventosTI.busca) {
    eventos = eventos.filter((ev) => ev.nmevento.toLowerCase().includes(filtroEventosTI.busca));
  }
  // Cancelados sempre por último, independente da data.
  eventos = [...eventos].sort((a, b) => {
    const aCancelado = a.status_controle === "cancelado" ? 1 : 0;
    const bCancelado = b.status_controle === "cancelado" ? 1 : 0;
    return aCancelado - bCancelado;
  });

  if (!eventos.length) {
    lista.innerHTML = tiVazio("Nenhum evento encontrado para esse filtro.", "search_off");
    return;
  }

  lista.innerHTML = eventos.map((ev) => {
    const totalAlocado = Number(ev.qtd_total_alocada);
    const totalPredestinado = Number(ev.qtd_predestinada);
    let nivel = "nivel-nenhum";
    if (totalPredestinado > 0 && totalPredestinado < totalAlocado) nivel = "nivel-parcial";
    if (totalPredestinado > 0 && totalPredestinado >= totalAlocado) nivel = "nivel-total";

    const dtfim = ev.dtfimrealizacao ? new Date(ev.dtfimrealizacao).toLocaleDateString("pt-BR") : "-";
    const dtinicio = ev.dtinirealizacao ? new Date(ev.dtinirealizacao) : null;
    const aindaNaoIniciou = dtinicio && dtinicio > new Date();
    const corStatus = ev.finalizado ? COR_FINALIZADO : (STATUS_ORCAMENTO_COR[ev.status_orcamento_avancado] || "#ccc");
    const labelStatus = ev.finalizado ? "Finalizado" : (STATUS_ORCAMENTO_LABEL[ev.status_orcamento_avancado] || "-");
    const corControle = STATUS_CONTROLE_COR[ev.status_controle] || "#ccc";
    const labelControle = STATUS_CONTROLE_LABEL[ev.status_controle] || "Incerto";
    const cancelado = ev.status_controle === "cancelado";
    const montagem = formatarIntervaloData(ev.dtinimontagem, ev.dtfimmontagem);

    return `
      <div class="ti-evento-card ${nivel} ${cancelado ? "ti-evento-cancelado" : ""}" data-idevento="${ev.idevento}" style="border-left-color:${corStatus};">
        <div class="ti-evento-cabecalho">
          <strong>${ev.nmevento}</strong>
          <span class="ti-badge-status-orc" style="color:${corStatus};">${labelStatus}</span>
        </div>
        <div class="ti-evento-resumo">
          Montagem: ${montagem} — Fim da realização: ${dtfim}<br>
          ${ev.qtd_equipamentos_distintos} equipamento(s) / ${totalAlocado} unidade(s) — ${totalPredestinado} já predestinada(s)
        </div>
        <div class="ti-evento-controles">
          <select class="ti-select-controle" data-idevento="${ev.idevento}" style="color:${corControle}; border-color:${corControle};">
            ${Object.entries(STATUS_CONTROLE_LABEL).map(([valor, label]) => `<option value="${valor}" ${ev.status_controle === valor ? "selected" : ""}>${label}</option>`).join("")}
          </select>
          <span class="ti-check-separado">
            <label class="ios-checkbox blue">
              <input type="checkbox" class="ti-check-separado-input" data-idevento="${ev.idevento}" ${ev.separado ? "checked" : ""}>
              <div class="checkbox-wrapper">
                <div class="checkbox-bg"></div>
                <svg fill="none" viewBox="0 0 24 24" class="checkbox-icon">
                  <path stroke-linejoin="round" stroke-linecap="round" stroke-width="3" stroke="currentColor" d="M4 12L10 18L20 6" class="check-path"></path>
                </svg>
              </div>
            </label>
            Equipamentos separados
          </span>
        </div>
        ${aindaNaoIniciou ? `
          <button type="button" class="ti-btn-listagem-separacao" data-idevento="${ev.idevento}" data-nmevento="${ev.nmevento}">
            📋 Gerar listagem de separação
          </button>
        ` : ""}
        <div class="ti-evento-detalhe" style="display:none;"></div>
      </div>
    `;
  }).join("");

  lista.querySelectorAll(".ti-evento-card").forEach((card) => {
    card.querySelector(".ti-evento-cabecalho").addEventListener("click", () => {
      toggleDetalheEvento(card);
    });
  });

  lista.querySelectorAll(".ti-btn-listagem-separacao").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      gerarListagemSeparacao(btn.dataset.idevento, btn.dataset.nmevento);
    });
  });

  lista.querySelectorAll(".ti-select-controle").forEach((select) => {
    select.addEventListener("click", (e) => e.stopPropagation());
    select.addEventListener("change", async () => {
      try {
        await fetchTI(`/eventos/${select.dataset.idevento}/status-controle`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status_controle: select.value }),
        });
        const ev = cacheEventosAtivos.find((e) => String(e.idevento) === select.dataset.idevento);
        if (ev) ev.status_controle = select.value;
        renderListaEventosTI();
      } catch (erro) {
        console.error("Erro ao atualizar status de controle:", erro);
        Swal.fire("Erro", "Erro ao atualizar status de controle.", "error");
      }
    });
  });

  lista.querySelectorAll(".ti-check-separado-input").forEach((checkbox) => {
    checkbox.addEventListener("click", (e) => e.stopPropagation());
    checkbox.addEventListener("change", async () => {
      try {
        await fetchTI(`/eventos/${checkbox.dataset.idevento}/separado`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ separado: checkbox.checked }),
        });
        const ev = cacheEventosAtivos.find((e) => String(e.idevento) === checkbox.dataset.idevento);
        if (ev) ev.separado = checkbox.checked;
      } catch (erro) {
        console.error("Erro ao atualizar separado:", erro);
        checkbox.checked = !checkbox.checked;
        Swal.fire("Erro", "Erro ao atualizar status de separação.", "error");
      }
    });
  });
}

// Gerado em Python (public/python/ChecklistSeparacao.py, python-docx), seguindo
// o layout do modelo "checklist_separacao_equipamentos.docx" — mesmo padrão de
// geração de documentos usado em Proposta/Contrato (Node chama Python, recebe
// uma fileUrl, e o frontend baixa o .docx via fetch+blob).
async function gerarListagemSeparacao(idevento, nmevento) {
  Swal.fire({
    title: "Gerando checklist...",
    text: "Isso pode levar alguns segundos.",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
  });

  try {
    const resp = await fetchTI(`/eventos/${idevento}/checklist-separacao`);
    Swal.close();

    const respostaBlob = await fetch(resp.fileUrl, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });
    if (!respostaBlob.ok) throw new Error("Erro ao baixar o arquivo gerado.");

    const blob = await respostaBlob.blob();
    const nomeArquivo = decodeURIComponent(resp.fileUrl.split("/").pop());

    const link = document.createElement("a");
    link.href = window.URL.createObjectURL(blob);
    link.download = nomeArquivo;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (erro) {
    console.error("Erro ao gerar listagem de separação:", erro);
    Swal.fire("Erro", erro.message || "Não foi possível gerar o checklist.", "error");
  }
}

async function toggleDetalheEvento(card) {
  const detalhe = card.querySelector(".ti-evento-detalhe");
  if (!detalhe) return;

  const aberto = detalhe.style.display !== "none";
  if (aberto) {
    detalhe.style.display = "none";
    return;
  }

  detalhe.style.display = "block";
  await carregarDetalheEvento(card);
}

async function carregarDetalheEvento(card) {
  const detalhe = card.querySelector(".ti-evento-detalhe");
  detalhe.innerHTML = tiLoading("Carregando equipamentos do evento...");

  const idevento = card.dataset.idevento;
  try {
    const equipamentos = await fetchTI(`/eventos/${idevento}/equipamentos`);
    if (!equipamentos.length) {
      detalhe.innerHTML = tiVazio("Nenhum equipamento orçado para este evento.", "inventory_2");
      return;
    }

    detalhe.innerHTML = `
      <table class="ti-tabela">
        <thead><tr><th>Equipamento</th><th>Orçado</th><th>Predestinado</th><th>Livre</th><th>Ação</th></tr></thead>
        <tbody>
          ${equipamentos.map((eq) => `
            <tr>
              <td>${eq.descequip}</td>
              <td>${eq.qtdorcada}</td>
              <td>${eq.qtdpredestinada}</td>
              <td>${eq.qtdlivre}</td>
              <td>
                ${eq.qtdlivre > 0
                  ? `<button type="button" class="ti-btn-destino" data-idequip="${eq.idequip}" data-idorcamento="${eq.idorcamento}" data-idevento="${idevento}" data-qtdlivre="${eq.qtdlivre}">Definir destino</button>`
                  : ""}
              </td>
            </tr>
            ${eq.predestinacoes.length ? `
              <tr>
                <td colspan="5" class="ti-predestinacoes-lista">
                  ${eq.predestinacoes.map((p) => `
                    <span class="ti-chip-predestinado">
                      ${p.quantidade}x → ${p.tipo_destino === 'estoque' ? 'Estoque' : (p.tipo_destino === 'evento' ? p.nmevento_destino : p.destino_livre)}
                    </span>
                  `).join(" ")}
                </td>
              </tr>
            ` : ""}
          `).join("")}
        </tbody>
      </table>
    `;

    detalhe.querySelectorAll(".ti-btn-destino").forEach((btn) => {
      const equipamento = equipamentos.find((eq) => String(eq.idequip) === btn.dataset.idequip);
      btn.addEventListener("click", () => abrirFormDestino(btn, card, equipamento));
    });
  } catch (erro) {
    console.error("Erro ao carregar equipamentos do evento:", erro);
    detalhe.innerHTML = tiVazio("Erro ao carregar equipamentos do evento.", "error");
  }
}

async function abrirFormDestino(btn, card, equipamento) {
  const { idequip, idorcamento, idevento, qtdlivre } = btn.dataset;

  let eventosAtivos = [];
  try {
    eventosAtivos = (await fetchTI("/eventos-ativos")).filter((ev) => String(ev.idevento) !== idevento);
  } catch (erro) {
    console.error("Erro ao carregar eventos ativos para destino:", erro);
  }

  const modelos = equipamento?.modelos || [];
  const opcoesModelos = modelos.map((m) => `<option value="${m.id}">${m.marca}${m.modelo ? ' / ' + m.modelo : ''} (estoque atual: ${m.qtdeestoque})</option>`).join("");
  const opcoesEventos = eventosAtivos.map((ev) => `<option value="${ev.idevento}">${ev.nmevento}</option>`).join("");

  const { value: formValues } = await Swal.fire({
    title: "Definir destino do equipamento",
    html: `
      <div class="ti-swal-form">
        <label class="ti-swal-label">Quantidade (livre: ${qtdlivre})
          <input type="number" id="swal-ti-quantidade" class="swal2-input" min="1" max="${qtdlivre}" value="1" style="margin:4px 0 0;">
        </label>
        <label class="ti-swal-label">Destino
          <select id="swal-ti-tipo-destino" class="swal2-select" style="margin:4px 0 0; width:100%;">
            <option value="estoque">Volta para o Estoque</option>
            <option value="evento">Outro evento cadastrado</option>
            <option value="livre">Outro / texto livre</option>
          </select>
        </label>
        <div id="swal-ti-campo-evento" style="display:none;">
          <label class="ti-swal-label">Evento de destino
            <select id="swal-ti-select-evento" style="width:100%; margin-top:4px;">
              <option value=""></option>
              ${opcoesEventos}
            </select>
          </label>
        </div>
        <div id="swal-ti-campo-livre" style="display:none;">
          <label class="ti-swal-label">Destino (texto livre)
            <input type="text" id="swal-ti-destino-livre" class="swal2-input" placeholder="Ex: Sede - Almoxarifado 2" style="margin:4px 0 0;">
          </label>
        </div>
        <div id="swal-ti-campo-modelo">
          <label class="ti-swal-label">Qual modelo recebe esse estoque de volta?
            <select id="swal-ti-select-modelo" class="swal2-select" style="margin:4px 0 0; width:100%;">
              <option value="">Selecione...</option>
              ${opcoesModelos}
            </select>
          </label>
        </div>
        <label class="ti-swal-label">Observação (opcional)
          <input type="text" id="swal-ti-observacao" class="swal2-input" style="margin:4px 0 0;">
        </label>
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: "Definir destino",
    cancelButtonText: "Cancelar",
    reverseButtons: true,
    didOpen: () => {
      const selectTipo = document.getElementById("swal-ti-tipo-destino");
      const campoEvento = document.getElementById("swal-ti-campo-evento");
      const campoLivre = document.getElementById("swal-ti-campo-livre");
      const campoModelo = document.getElementById("swal-ti-campo-modelo");

      if (window.jQuery && jQuery.fn && jQuery.fn.select2) {
        jQuery("#swal-ti-select-evento").select2({
          width: "100%",
          placeholder: "Buscar evento...",
          allowClear: true,
          dropdownParent: jQuery(".swal2-popup"),
        });
      }

      const atualizarCampos = () => {
        const tipo = selectTipo.value;
        campoEvento.style.display = tipo === "evento" ? "block" : "none";
        campoLivre.style.display = tipo === "livre" ? "block" : "none";
        campoModelo.style.display = tipo === "estoque" ? "block" : "none";
      };
      selectTipo.addEventListener("change", atualizarCampos);
      atualizarCampos();
    },
    preConfirm: () => {
      const quantidade = parseInt(document.getElementById("swal-ti-quantidade").value, 10);
      const tipo_destino = document.getElementById("swal-ti-tipo-destino").value;
      const idevento_destino = document.getElementById("swal-ti-select-evento").value || null;
      const destino_livre = document.getElementById("swal-ti-destino-livre").value.trim() || null;
      const idmodelo = document.getElementById("swal-ti-select-modelo").value || null;
      const observacao = document.getElementById("swal-ti-observacao").value.trim();

      if (!Number.isInteger(quantidade) || quantidade <= 0 || quantidade > Number(qtdlivre)) {
        Swal.showValidationMessage(`Quantidade inválida (máximo livre: ${qtdlivre}).`);
        return false;
      }
      if (tipo_destino === "evento" && !idevento_destino) {
        Swal.showValidationMessage("Selecione o evento de destino.");
        return false;
      }
      if (tipo_destino === "livre" && !destino_livre) {
        Swal.showValidationMessage("Informe o destino livre.");
        return false;
      }
      if (tipo_destino === "estoque" && !idmodelo) {
        Swal.showValidationMessage("Selecione o modelo que vai receber o estoque.");
        return false;
      }

      return { quantidade, tipo_destino, idevento_destino, destino_livre, idmodelo, observacao };
    }
  });

  if (!formValues) return;

  try {
    const resp = await fetchTI("/predestinacao", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idequip: Number(idequip),
        idmodelo: formValues.idmodelo || null,
        idevento_origem: Number(idevento),
        idorcamento_origem: Number(idorcamento),
        quantidade: formValues.quantidade,
        tipo_destino: formValues.tipo_destino,
        idevento_destino: formValues.idevento_destino ? Number(formValues.idevento_destino) : null,
        destino_livre: formValues.destino_livre,
        observacao: formValues.observacao,
      }),
    });
    await Swal.fire("Sucesso!", resp.message || "Destino definido com sucesso!", "success");
    await carregarDetalheEvento(card);
    renderAbaDashboard();
  } catch (erro) {
    console.error("Erro ao definir destino:", erro);
    Swal.fire("Erro", erro.message || "Erro ao definir destino.", "error");
  }
}

// ===== Equipamentos (categorias + modelos) =====
async function renderAbaEquipamentos() {
  const container = document.getElementById("ti-aba-equipamentos");
  if (!container) return;
  container.innerHTML = tiLoading("Carregando equipamentos...");

  try {
    const equipamentos = await fetchTI("/equipamentos");
    cacheEquipamentos = equipamentos;

    if (!equipamentos.length) {
      container.innerHTML = tiVazio("Nenhum equipamento cadastrado.", "inventory_2");
      return;
    }

    container.innerHTML = `
      ${montarCampoBusca("ti-busca-equipamentos", "Buscar equipamento ou marca...")}
      <div id="ti-cards-equipamentos">
        ${equipamentos.map((e) => `
          <div class="ti-card-linha ti-card-categoria" data-busca="${e.descequip} ${(e.modelos || []).map((m) => `${m.marca} ${m.modelo || ''}`).join(' ')}">
            <div class="ti-card-linha-topo">
              <span class="ti-card-linha-titulo">${e.descequip}</span>
              <span class="ti-card-linha-stat"><strong>${e.qtdtotalCategoria}</strong> no total</span>
            </div>
            ${e.modelos.length ? `
              <div class="ti-card-linha-detalhe">
                ${e.modelos.map((m) => `
                  <div class="ti-modelo-linha">
                    <span>${m.marca}${m.modelo ? ' / ' + m.modelo : ''}</span>
                    <span>${m.qtdeestoque} em estoque / ${m.qtdtotal} total</span>
                  </div>
                `).join("")}
              </div>
            ` : `<div class="ti-card-linha-sub"><em>Nenhum modelo cadastrado</em></div>`}
          </div>
        `).join("")}
      </div>
    `;

    ativarBuscaClientSide("ti-busca-equipamentos", "#ti-cards-equipamentos .ti-card-linha", (card) => card.dataset.busca || "");
  } catch (erro) {
    console.error("Erro ao carregar equipamentos (TI):", erro);
    container.innerHTML = tiVazio("Erro ao carregar equipamentos.", "error");
  }
}

// ===== Estoque (por modelo) =====
async function renderAbaEstoque() {
  const container = document.getElementById("ti-aba-estoque");
  if (!container) return;
  container.innerHTML = tiLoading("Carregando estoque...");

  try {
    const equipamentos = await fetchTI("/equipamentos");
    cacheEquipamentos = equipamentos;
    const modelos = equipamentos.flatMap((e) => e.modelos.map((m) => ({ ...m, idequip: e.idequip, descequip: e.descequip })));

    if (!modelos.length) {
      container.innerHTML = tiVazio("Nenhum modelo cadastrado. Cadastre marcas/modelos no cadastro de equipamentos.", "inventory_2");
      return;
    }

    container.innerHTML = `
      ${montarCampoBusca("ti-busca-estoque", "Buscar equipamento ou marca...")}
      <div id="ti-cards-estoque">
        ${modelos.map((m) => `
          <div class="ti-card-linha" data-busca="${m.descequip} ${m.marca} ${m.modelo || ''}">
            <div class="ti-card-linha-topo">
              <span class="ti-card-linha-titulo">${m.descequip} — ${m.marca}${m.modelo ? ' / ' + m.modelo : ''}</span>
              <span class="ti-card-linha-stat">${m.qtdeestoque} em estoque / ${m.qtdtotal} total</span>
            </div>
            <div class="ti-card-linha-acoes">
              <button type="button" class="ti-btn-entrada" data-idequip="${m.idequip}" data-idmodelo="${m.id}">Entrada</button>
              <button type="button" class="ti-btn-saida" data-idequip="${m.idequip}" data-idmodelo="${m.id}">Baixa</button>
              <button type="button" class="ti-btn-manutencao" data-idequip="${m.idequip}" data-idmodelo="${m.id}">Manutenção</button>
              <button type="button" class="ti-btn-ver-unidades" data-idequip="${m.idequip}" data-idmodelo="${m.id}">Ver unidades</button>
            </div>
            <div class="ti-card-linha-detalhe ti-linha-unidades" data-idmodelo-unidades="${m.id}" style="display:none;"></div>
          </div>
        `).join("")}
      </div>
    `;

    ativarBuscaClientSide("ti-busca-estoque", "#ti-cards-estoque .ti-card-linha", (card) => card.dataset.busca || "");

    container.querySelectorAll(".ti-btn-entrada").forEach((btn) =>
      btn.addEventListener("click", () => abrirEntradaEstoqueTI(btn.dataset.idequip, btn.dataset.idmodelo))
    );
    container.querySelectorAll(".ti-btn-saida").forEach((btn) =>
      btn.addEventListener("click", () => abrirBaixaEstoqueTI(btn.dataset.idequip, btn.dataset.idmodelo))
    );
    container.querySelectorAll(".ti-btn-manutencao").forEach((btn) =>
      btn.addEventListener("click", () => enviarParaManutencaoTI(btn.dataset.idequip, btn.dataset.idmodelo))
    );
    container.querySelectorAll(".ti-btn-ver-unidades").forEach((btn) =>
      btn.addEventListener("click", () => toggleUnidadesModelo(btn.dataset.idequip, btn.dataset.idmodelo))
    );
  } catch (erro) {
    console.error("Erro ao carregar estoque (TI):", erro);
    container.innerHTML = tiVazio("Erro ao carregar estoque.", "error");
  }
}

async function toggleUnidadesModelo(idequip, idmodelo) {
  const linha = document.querySelector(`.ti-linha-unidades[data-idmodelo-unidades="${idmodelo}"]`);
  if (!linha) return;

  const aberta = linha.style.display !== "none";
  if (aberta) {
    linha.style.display = "none";
    return;
  }

  linha.style.display = "block";
  const celula = linha;
  celula.innerHTML = "Carregando unidades...";

  try {
    const unidades = await fetchTI(`/equipamentos/${idequip}/modelos/${idmodelo}/unidades`);
    if (!unidades.length) {
      celula.innerHTML = "<em>Nenhuma unidade cadastrada ainda.</em>";
      return;
    }

    celula.innerHTML = `
      <table class="ti-tabela ti-tabela-unidades">
        <thead><tr><th>Patrimônio</th><th>Status</th><th>Com quem / evento</th><th>Ações</th></tr></thead>
        <tbody>
          ${unidades.map((u) => `
            <tr data-idunidade="${u.idunidade}">
              <td>${u.patrimonio}</td>
              <td>${u.status}</td>
              <td>${u.nome_funcionario_atual || u.nmevento_atual || "-"}</td>
              <td>
                ${u.status === 'estoque' ? `<button type="button" class="ti-btn-entregar" data-idunidade="${u.idunidade}">Entregar</button>` : ""}
                ${u.status === 'com_funcionario' ? `<button type="button" class="ti-btn-devolver" data-idunidade="${u.idunidade}">Devolver</button>
                  <button type="button" class="ti-btn-transferir" data-idunidade="${u.idunidade}">Transferir</button>` : ""}
                ${['estoque', 'com_funcionario'].includes(u.status) ? `<button type="button" class="ti-btn-enviar-evento" data-idunidade="${u.idunidade}">Enviar a evento</button>` : ""}
                ${u.status === 'evento' ? `<button type="button" class="ti-btn-retornar-evento" data-idunidade="${u.idunidade}">Retornar de evento</button>` : ""}
                <button type="button" class="ti-btn-historico-unidade" data-idunidade="${u.idunidade}" data-patrimonio="${u.patrimonio}">Histórico</button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;

    celula.querySelectorAll(".ti-btn-entregar").forEach((btn) => btn.addEventListener("click", () => abrirEntregarTI(btn.dataset.idunidade, idequip, idmodelo)));
    celula.querySelectorAll(".ti-btn-devolver").forEach((btn) => btn.addEventListener("click", () => devolverUnidadeTI(btn.dataset.idunidade, idequip, idmodelo)));
    celula.querySelectorAll(".ti-btn-transferir").forEach((btn) => btn.addEventListener("click", () => abrirTransferirTI(btn.dataset.idunidade, idequip, idmodelo)));
    celula.querySelectorAll(".ti-btn-enviar-evento").forEach((btn) => btn.addEventListener("click", () => abrirEnviarEventoTI(btn.dataset.idunidade, idequip, idmodelo)));
    celula.querySelectorAll(".ti-btn-retornar-evento").forEach((btn) => btn.addEventListener("click", () => retornarEventoTI(btn.dataset.idunidade, idequip, idmodelo)));
    celula.querySelectorAll(".ti-btn-historico-unidade").forEach((btn) => btn.addEventListener("click", () => verHistoricoUnidadeTI(btn.dataset.idunidade, btn.dataset.patrimonio)));
  } catch (erro) {
    console.error("Erro ao carregar unidades do modelo:", erro);
    celula.innerHTML = "Erro ao carregar unidades.";
  }
}

async function reabrirUnidadesModelo(idequip, idmodelo) {
  const linha = document.querySelector(`.ti-linha-unidades[data-idmodelo-unidades="${idmodelo}"]`);
  if (linha) linha.style.display = "none";
  await toggleUnidadesModelo(idequip, idmodelo);
}

// Entrada: um patrimônio por linha no textarea (uma unidade física por linha)
async function abrirEntradaEstoqueTI(idequip, idmodelo) {
  const { value: formValues } = await Swal.fire({
    title: "Registrar entrada de estoque",
    html: `
      <div class="ti-swal-form">
        <label class="ti-swal-label">Patrimônios (um por linha)
          <textarea id="swal-ti-patrimonios" class="swal2-textarea" rows="6" placeholder="Ex:\nHP-0001\nHP-0002\nHP-0003" style="margin:4px 0 0;"></textarea>
        </label>
        <label class="ti-swal-label">Motivo (opcional)
          <input type="text" id="swal-ti-mov-motivo" class="swal2-input" style="margin:4px 0 0;">
        </label>
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: "Registrar entrada",
    cancelButtonText: "Cancelar",
    reverseButtons: true,
    preConfirm: () => {
      const texto = document.getElementById("swal-ti-patrimonios").value;
      const motivo = document.getElementById("swal-ti-mov-motivo").value.trim();
      const patrimonios = texto.split("\n").map((l) => l.trim()).filter(Boolean);
      if (!patrimonios.length) {
        Swal.showValidationMessage("Informe ao menos um patrimônio.");
        return false;
      }
      const duplicados = patrimonios.filter((p, i) => patrimonios.indexOf(p) !== i);
      if (duplicados.length) {
        Swal.showValidationMessage(`Patrimônio repetido na lista: ${duplicados[0]}`);
        return false;
      }
      return { patrimonios, motivo };
    }
  });

  if (!formValues) return;

  try {
    const resp = await fetchTI(`/equipamentos/${idequip}/modelos/${idmodelo}/estoque`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo: "entrada", patrimonios: formValues.patrimonios, motivo: formValues.motivo }),
    });
    await Swal.fire("Sucesso!", resp.message || "Entrada registrada.", "success");
    renderAbaEstoque();
  } catch (erro) {
    console.error("Erro ao registrar entrada:", erro);
    Swal.fire("Erro", erro.message || "Erro ao registrar entrada.", "error");
  }
}

// Baixa: escolher quais unidades (em estoque) sair definitivamente
async function abrirBaixaEstoqueTI(idequip, idmodelo) {
  let unidadesEmEstoque = [];
  try {
    unidadesEmEstoque = (await fetchTI(`/equipamentos/${idequip}/modelos/${idmodelo}/unidades`))
      .filter((u) => u.status === 'estoque');
  } catch (erro) {
    console.error("Erro ao carregar unidades para baixa:", erro);
  }

  if (!unidadesEmEstoque.length) {
    Swal.fire("Aviso", "Não há unidades em estoque disponíveis para baixa.", "info");
    return;
  }

  const opcoesCheckbox = unidadesEmEstoque.map((u) => `
    <label class="ti-swal-check-linha">
      <input type="checkbox" class="swal-ti-check-unidade" value="${u.idunidade}"> ${u.patrimonio}
    </label>
  `).join("");

  const { value: formValues } = await Swal.fire({
    title: "Dar baixa em unidades",
    html: `
      <div class="ti-swal-form ti-swal-form-scroll">
        ${opcoesCheckbox}
      </div>
      <label style="display:block; text-align:left; margin-top:10px;">Motivo (opcional)
        <input type="text" id="swal-ti-mov-motivo" class="swal2-input" style="margin:4px 0 0;">
      </label>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: "Dar baixa",
    cancelButtonText: "Cancelar",
    reverseButtons: true,
    preConfirm: () => {
      const idunidades = Array.from(document.querySelectorAll(".swal-ti-check-unidade:checked")).map((el) => Number(el.value));
      const motivo = document.getElementById("swal-ti-mov-motivo").value.trim();
      if (!idunidades.length) {
        Swal.showValidationMessage("Selecione ao menos uma unidade.");
        return false;
      }
      return { idunidades, motivo };
    }
  });

  if (!formValues) return;

  try {
    const resp = await fetchTI(`/equipamentos/${idequip}/modelos/${idmodelo}/estoque`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo: "saida", idunidades: formValues.idunidades, motivo: formValues.motivo }),
    });
    await Swal.fire("Sucesso!", resp.message || "Baixa registrada.", "success");
    renderAbaEstoque();
  } catch (erro) {
    console.error("Erro ao registrar baixa:", erro);
    Swal.fire("Erro", erro.message || "Erro ao registrar baixa.", "error");
  }
}

// ===== Autocomplete de funcionário reutilizável dentro de um Swal =====
function montarCampoFuncionarioSwal(idSelect) {
  return `<select id="${idSelect}" style="width:100%; margin-top:4px;"><option value=""></option></select>`;
}

function ativarAutocompleteFuncionarioSwal(idSelect) {
  if (!(window.jQuery && jQuery.fn && jQuery.fn.select2)) return;
  jQuery(`#${idSelect}`).select2({
    width: "100%",
    placeholder: "Buscar funcionário por nome...",
    allowClear: true,
    dropdownParent: jQuery(".swal2-popup"),
    minimumInputLength: 2,
    ajax: {
      transport: async (params, success, failure) => {
        try {
          const resultados = await fetchTI(`/funcionarios/busca?busca=${encodeURIComponent(params.data.term || "")}`);
          success(resultados);
        } catch (erro) {
          failure(erro);
        }
      },
      processResults: (data) => ({
        results: data.map((f) => ({ id: f.idfuncionario, text: f.nome }))
      })
    }
  });
}

// ===== Ações de custódia por unidade =====

async function abrirEntregarTI(idunidade, idequip, idmodelo) {
  const { value: formValues } = await Swal.fire({
    title: "Entregar equipamento a um funcionário",
    html: `
      <div class="ti-swal-form">
        <label class="ti-swal-label">Funcionário
          ${montarCampoFuncionarioSwal("swal-ti-funcionario")}
        </label>
        <label class="ti-swal-label">Observação (opcional)
          <input type="text" id="swal-ti-observacao" class="swal2-input" style="margin:4px 0 0;">
        </label>
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: "Entregar",
    cancelButtonText: "Cancelar",
    reverseButtons: true,
    didOpen: () => ativarAutocompleteFuncionarioSwal("swal-ti-funcionario"),
    preConfirm: () => {
      const idfuncionario = document.getElementById("swal-ti-funcionario").value;
      const observacao = document.getElementById("swal-ti-observacao").value.trim();
      if (!idfuncionario) {
        Swal.showValidationMessage("Selecione um funcionário.");
        return false;
      }
      return { idfuncionario: Number(idfuncionario), observacao };
    }
  });

  if (!formValues) return;

  try {
    const resp = await fetchTI("/custodia/entregar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idunidade: Number(idunidade), ...formValues }),
    });
    await Swal.fire("Sucesso!", resp.message || "Equipamento entregue.", "success");
    reabrirUnidadesModelo(idequip, idmodelo);
    renderAbaCustodia();
  } catch (erro) {
    console.error("Erro ao entregar equipamento:", erro);
    Swal.fire("Erro", erro.message || "Erro ao entregar equipamento.", "error");
  }
}

async function devolverUnidadeTI(idunidade, idequip, idmodelo) {
  const { isConfirmed } = await Swal.fire({
    title: "Devolver ao estoque?",
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Sim, devolver",
    cancelButtonText: "Cancelar",
    reverseButtons: true,
  });
  if (!isConfirmed) return;

  try {
    await fetchTI("/custodia/devolver", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idunidade: Number(idunidade) }),
    });
    reabrirUnidadesModelo(idequip, idmodelo);
    renderAbaCustodia();
  } catch (erro) {
    console.error("Erro ao devolver equipamento:", erro);
    Swal.fire("Erro", erro.message || "Erro ao devolver equipamento.", "error");
  }
}

async function abrirTransferirTI(idunidade, idequip, idmodelo) {
  const { value: formValues } = await Swal.fire({
    title: "Transferir para outro funcionário",
    html: `
      <div class="ti-swal-form">
        <label class="ti-swal-label">Novo funcionário
          ${montarCampoFuncionarioSwal("swal-ti-funcionario")}
        </label>
        <label class="ti-swal-label">Observação (opcional)
          <input type="text" id="swal-ti-observacao" class="swal2-input" style="margin:4px 0 0;">
        </label>
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: "Transferir",
    cancelButtonText: "Cancelar",
    reverseButtons: true,
    didOpen: () => ativarAutocompleteFuncionarioSwal("swal-ti-funcionario"),
    preConfirm: () => {
      const idfuncionario_novo = document.getElementById("swal-ti-funcionario").value;
      const observacao = document.getElementById("swal-ti-observacao").value.trim();
      if (!idfuncionario_novo) {
        Swal.showValidationMessage("Selecione um funcionário.");
        return false;
      }
      return { idfuncionario_novo: Number(idfuncionario_novo), observacao };
    }
  });

  if (!formValues) return;

  try {
    const resp = await fetchTI("/custodia/transferir", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idunidade: Number(idunidade), ...formValues }),
    });
    await Swal.fire("Sucesso!", resp.message || "Equipamento transferido.", "success");
    reabrirUnidadesModelo(idequip, idmodelo);
    renderAbaCustodia();
  } catch (erro) {
    console.error("Erro ao transferir equipamento:", erro);
    Swal.fire("Erro", erro.message || "Erro ao transferir equipamento.", "error");
  }
}

async function abrirEnviarEventoTI(idunidade, idequip, idmodelo) {
  let eventos = [];
  try {
    eventos = await fetchTI("/eventos-ativos");
  } catch (erro) {
    console.error("Erro ao carregar eventos para envio:", erro);
  }

  const { value: formValues } = await Swal.fire({
    title: "Enviar equipamento a um evento",
    html: `
      <div class="ti-swal-form">
        <label class="ti-swal-label">Evento
          <select id="swal-ti-select-evento" style="width:100%; margin-top:4px;">
            <option value=""></option>
            ${eventos.map((ev) => `<option value="${ev.idevento}">${ev.nmevento}</option>`).join("")}
          </select>
        </label>
        <label class="ti-swal-label">Observação (opcional)
          <input type="text" id="swal-ti-observacao" class="swal2-input" style="margin:4px 0 0;">
        </label>
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: "Enviar",
    cancelButtonText: "Cancelar",
    reverseButtons: true,
    didOpen: () => {
      if (window.jQuery && jQuery.fn && jQuery.fn.select2) {
        jQuery("#swal-ti-select-evento").select2({
          width: "100%", placeholder: "Buscar evento...", allowClear: true, dropdownParent: jQuery(".swal2-popup"),
        });
      }
    },
    preConfirm: () => {
      const idevento = document.getElementById("swal-ti-select-evento").value;
      const observacao = document.getElementById("swal-ti-observacao").value.trim();
      if (!idevento) {
        Swal.showValidationMessage("Selecione um evento.");
        return false;
      }
      return { idevento: Number(idevento), observacao };
    }
  });

  if (!formValues) return;

  try {
    const resp = await fetchTI("/custodia/enviar-evento", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idunidade: Number(idunidade), ...formValues }),
    });
    await Swal.fire("Sucesso!", resp.message || "Equipamento enviado ao evento.", "success");
    reabrirUnidadesModelo(idequip, idmodelo);
    renderAbaCustodia();
  } catch (erro) {
    console.error("Erro ao enviar equipamento a evento:", erro);
    Swal.fire("Erro", erro.message || "Erro ao enviar equipamento a evento.", "error");
  }
}

async function retornarEventoTI(idunidade, idequip, idmodelo) {
  const { isConfirmed } = await Swal.fire({
    title: "Retornar do evento?",
    text: "Volta pro estoque (ou pro funcionário, se ele ainda estiver com a unidade).",
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Sim, retornar",
    cancelButtonText: "Cancelar",
    reverseButtons: true,
  });
  if (!isConfirmed) return;

  try {
    await fetchTI("/custodia/retornar-evento", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idunidade: Number(idunidade) }),
    });
    reabrirUnidadesModelo(idequip, idmodelo);
    renderAbaCustodia();
  } catch (erro) {
    console.error("Erro ao retornar equipamento de evento:", erro);
    Swal.fire("Erro", erro.message || "Erro ao retornar equipamento de evento.", "error");
  }
}

async function verHistoricoUnidadeTI(idunidade, patrimonio) {
  try {
    const historico = await fetchTI(`/custodia/unidade/${idunidade}/historico`);
    const linhasHtml = historico.map((h) => {
      const dataFormatada = new Date(h.criado_em).toLocaleString("pt-BR");
      const descricoes = {
        entrega: `Entregue a ${h.nome_destino || '-'}`,
        devolucao: `Devolvido por ${h.nome_origem || '-'}`,
        transferencia: `Transferido de ${h.nome_origem || '-'} para ${h.nome_destino || '-'}`,
        envio_evento: `Enviado ao evento ${h.nmevento || '-'}`,
        retorno_evento: `Retornado do evento ${h.nmevento || '-'}`,
      };
      return `<li>${dataFormatada} — ${descricoes[h.tipo] || h.tipo}${h.observacao ? ` (${h.observacao})` : ""}</li>`;
    }).join("");

    Swal.fire({
      title: `Histórico — ${patrimonio}`,
      html: `<ul style="text-align:left; max-height:300px; overflow-y:auto;">${linhasHtml || "<li>Sem histórico ainda.</li>"}</ul>`,
    });
  } catch (erro) {
    console.error("Erro ao carregar histórico da unidade:", erro);
    Swal.fire("Erro", "Erro ao carregar histórico da unidade.", "error");
  }
}

// ===== Custódia atual (quem está com o quê) =====
async function renderAbaCustodia() {
  const container = document.getElementById("ti-aba-custodia");
  if (!container) return;
  container.innerHTML = tiLoading("Carregando custódia atual...");

  try {
    const unidades = await fetchTI("/custodia/atual");
    if (!unidades.length) {
      container.innerHTML = tiVazio("Nenhum equipamento com funcionário no momento.", "badge");
      return;
    }

    container.innerHTML = unidades.map((u) => `
      <div class="ti-card-linha">
        <div class="ti-card-linha-topo">
          <span class="ti-card-linha-titulo">${u.nome_funcionario_atual}</span>
          <span class="ti-card-linha-stat">${u.descequip} — ${u.patrimonio}</span>
        </div>
        <div class="ti-card-linha-acoes">
          <button type="button" class="ti-btn-historico-unidade" data-idunidade="${u.idunidade}" data-patrimonio="${u.patrimonio}">Histórico</button>
        </div>
      </div>
    `).join("");

    container.querySelectorAll(".ti-btn-historico-unidade").forEach((btn) =>
      btn.addEventListener("click", () => verHistoricoUnidadeTI(btn.dataset.idunidade, btn.dataset.patrimonio))
    );
  } catch (erro) {
    console.error("Erro ao carregar custódia atual:", erro);
    container.innerHTML = tiVazio("Erro ao carregar custódia atual.", "error");
  }
}

async function enviarParaManutencaoTI(idequip, idmodelo) {
  const { value: descricaoproblema, isConfirmed } = await Swal.fire({
    title: "Enviar para manutenção",
    input: "text",
    inputLabel: "Descrição do problema (opcional)",
    showCancelButton: true,
    confirmButtonText: "Enviar",
    cancelButtonText: "Cancelar",
    reverseButtons: true,
  });

  if (!isConfirmed) return;

  try {
    await fetchTI("/manutencao", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idequip: Number(idequip), idmodelo, descricaoproblema }),
    });
    await Swal.fire("Sucesso!", "Equipamento enviado para manutenção.", "success");
    renderAbaEstoque();
  } catch (erro) {
    console.error("Erro ao enviar para manutenção:", erro);
    Swal.fire("Erro", erro.message || "Erro ao enviar para manutenção.", "error");
  }
}

// ===== Manutenção =====
async function renderAbaManutencao() {
  const container = document.getElementById("ti-aba-manutencao");
  if (!container) return;
  container.innerHTML = tiLoading("Carregando fila de manutenção...");

  try {
    const fila = await fetchTI("/manutencao");

    if (!fila.length) {
      container.innerHTML = `<div class="ti-card-vazio">Nenhum equipamento em manutenção.</div>`;
      return;
    }

    container.innerHTML = fila.map((m) => `
      <div class="ti-card-linha">
        <div class="ti-card-linha-topo">
          <span class="ti-card-linha-titulo">${m.descequip} — ${m.marca}${m.modelo ? ' / ' + m.modelo : ''}</span>
          <span class="ti-card-linha-stat">${m.status}</span>
        </div>
        ${m.descricaoproblema ? `<div class="ti-card-linha-sub">${m.descricaoproblema}</div>` : ""}
        ${m.status !== "concluida" ? `
          <div class="ti-card-linha-acoes">
            <button type="button" class="ti-btn-concluir" data-id="${m.idmanutencao}">Concluir</button>
          </div>
        ` : ""}
      </div>
    `).join("");

    container.querySelectorAll(".ti-btn-concluir").forEach((btn) =>
      btn.addEventListener("click", () => concluirManutencaoTI(btn.dataset.id))
    );
  } catch (erro) {
    console.error("Erro ao carregar fila de manutenção:", erro);
    container.innerHTML = tiVazio("Erro ao carregar fila de manutenção.", "error");
  }
}

async function concluirManutencaoTI(idmanutencao) {
  const { isConfirmed } = await Swal.fire({
    title: "Concluir manutenção?",
    text: "O equipamento voltará ao status disponível.",
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Sim, concluir",
    cancelButtonText: "Cancelar",
    reverseButtons: true,
  });
  if (!isConfirmed) return;

  try {
    await fetchTI(`/manutencao/${idmanutencao}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "concluida" }),
    });
    renderAbaManutencao();
  } catch (erro) {
    console.error("Erro ao concluir manutenção:", erro);
    Swal.fire("Erro", erro.message || "Erro ao concluir manutenção.", "error");
  }
}

// ===== Toggle do modo TI =====
function initTIMode() {
  const li = document.querySelector("li.TI");
  const link = li?.querySelector("a");
  if (!li || !link) return;

  const temAcesso =
    (window.temPermissao?.("Staff", "ti") ?? false) ||
    (window.temPermissao?.("Staff", "supremo") ?? false);

  if (!temAcesso) {
    li.style.display = "none";
    return;
  }

  link.addEventListener("click", (e) => {
    e.preventDefault();
    const ativo = document.body.classList.toggle("ti-mode");
    if (ativo) montarPainelTI();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  if (Array.isArray(window.permissoes)) initTIMode();
  else document.addEventListener("permissoesCarregadas", initTIMode, { once: true });
});
