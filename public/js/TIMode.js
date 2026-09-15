// ===== TI Mode: gerenciamento de equipamentos, estoque e manutenção =====
import { fetchComToken } from '/utils/utils.js';
import { ligarBuscaComSugestoes } from './Formataçoes.js';

let painelMontado = false;
let cacheEquipamentos = [];
let cacheConsumiveis = []; // itens do almoxarifado — usado pelo Swal de detalhe (repor/consumir/editar/histórico)
let filtroLocalEstoqueTI = "todos"; // 'todos' | 'JA' | 'Galpao' — filtro da aba Estoque

async function fetchTI(caminho, opcoes = {}) {
  const resp = await fetchComToken(`/ti${caminho}`, opcoes);
  if (!resp) throw new Error("Falha na requisição ao módulo TI.");
  return resp;
}

function escaparHtml(texto) {
  const div = document.createElement("div");
  div.textContent = texto ?? "";
  return div.innerHTML;
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
      <button type="button" class="ti-aba-btn" data-aba="custodia"><span class="material-symbols-outlined">badge</span>Alocação</button>
      <button type="button" class="ti-aba-btn" data-aba="manutencao"><span class="material-symbols-outlined">build</span>Manutenção</button>
      <button type="button" class="ti-aba-btn" data-aba="almoxarifado"><span class="material-symbols-outlined">inventory</span>Almoxarifado</button>
      <button type="button" class="ti-aba-btn" data-aba="E-mails"><span class="material-symbols-outlined">email</span>E-mails corporativos</button>
    </div>
    <div id="ti-aba-dashboard" class="ti-aba-conteudo"></div>
    <div id="ti-aba-eventos" class="ti-aba-conteudo" style="display:none;"></div>
    <div id="ti-aba-equipamentos" class="ti-aba-conteudo" style="display:none;"></div>
    <div id="ti-aba-estoque" class="ti-aba-conteudo" style="display:none;"></div>
    <div id="ti-aba-custodia" class="ti-aba-conteudo" style="display:none;"></div>
    <div id="ti-aba-manutencao" class="ti-aba-conteudo" style="display:none;"></div>
    <div id="ti-aba-almoxarifado" class="ti-aba-conteudo" style="display:none;"></div>
    <div id="ti-aba-E-mails" class="ti-aba-conteudo" style="display:none;"></div>
  `;
  conteudo.appendChild(panel);

  panel.querySelectorAll(".ti-aba-btn").forEach((btn) => {
    btn.addEventListener("click", () => trocarAbaTI(btn.dataset.aba));
  });

  trocarAbaTI("dashboard");
}

function trocarAbaTI(aba) {
  ["dashboard", "eventos", "equipamentos", "estoque", "custodia", "manutencao", "almoxarifado", "E-mails"].forEach((nome) => {
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
  if (aba === "almoxarifado") renderAbaAlmoxarifado();
  if (aba === "E-mails") renderAbaEmails();
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

// Até quando dá pra navegar no calendário — combina com o backend, que só busca a
// edição do ano corrente (e janeiro do ano seguinte, a partir de novembro). Antes de
// novembro, o limite é dezembro do ano corrente; de novembro em diante, libera até
// janeiro do ano seguinte (mesCalendarioTI é 0-based, então janeiro = 0).
function limiteMaximoCalendarioTI() {
  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const mesAtual = hoje.getMonth() + 1;
  if (mesAtual >= 11) return { ano: anoAtual + 1, mes: 0 };
  return { ano: anoAtual, mes: 11 };
}

async function renderAbaDashboard() {
  const container = document.getElementById("ti-aba-dashboard");
  if (!container) return;
  container.innerHTML = tiLoading("Carregando dashboard...");

  try {
    const dash = await fetchTI("/dashboard");

    container.innerHTML = `
      <div class="ti-dashboard-card">
        <div class="ti-resumo">
          <div class="ti-resumo-card">
            <span>Em estoque</span>
            <strong>${dash.total_estoque}</strong>
          </div>
          <div class="ti-resumo-card">
            <span>Em manutenção</span>
            <strong class="${dash.total_manutencao > 0 ? 'neg' : ''}">${dash.total_manutencao}</strong>
          </div>
          <div class="ti-resumo-card">
            <span>Equipamentos em eventos</span>
            <strong>${dash.total_alocado}</strong>
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

  // Mapa dia -> eventos que ocupam aquele dia. Cobre da montagem até a desmontagem
  // (não só o período de realização) — é a janela real em que o equipamento fica
  // fora do estoque. Cai pra realização se faltar data de montagem/desmontagem.
  const mapaDias = {};
  eventos.forEach((ev) => {
    const inicioStr = ev.dtinimontagem || ev.dtinirealizacao;
    const fimStr = ev.dtfimdesmontagem || ev.dtfimmontagem || ev.dtfimrealizacao;
    if (!inicioStr || !fimStr) return;
    const inicio = new Date(inicioStr);
    const fim = new Date(fimStr);
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

  // Dias seguidos com exatamente 1 evento e o MESMO evento viram um bloco só (período
  // corrido), sem quebrar a linha da semana. Qualquer variação (mais de 1 evento, evento
  // diferente, dia vazio ou fim de semana/linha) quebra o agrupamento.
  const diasDoMes = [];
  for (let dia = 1; dia <= ultimoDia; dia++) {
    const dataDia = new Date(anoCalendarioTI, mesCalendarioTI, dia);
    const key = dataDia.toISOString().split("T")[0];
    const eventosDoDia = mapaDias[key] || [];
    diasDoMes.push({
      dia, key, eventosDoDia,
      weekday: dataDia.getDay(),
      soloIdEvento: eventosDoDia.length === 1 ? eventosDoDia[0].idevento : null,
    });
  }

  diasDoMes.forEach((d, i) => {
    const anterior = diasDoMes[i - 1];
    const continuaGrupo = d.soloIdEvento !== null && d.weekday !== 0
      && anterior && anterior.soloIdEvento === d.soloIdEvento;
    d.grupoInicio = !continuaGrupo && d.soloIdEvento !== null;
    if (continuaGrupo) anterior.temProximo = true;
  });
  diasDoMes.forEach((d, i) => {
    if (!d.grupoInicio) return;
    let fim = i;
    while (diasDoMes[fim].temProximo) fim++;
    for (let j = i; j <= fim; j++) {
      diasDoMes[j].posicaoGrupo = i === fim ? null : (j === i ? "inicio" : j === fim ? "fim" : "meio");
    }
  });

  let celulas = "";
  for (let i = 0; i < primeiroDiaSemana; i++) {
    celulas += `<div class="ti-cal-dia ti-cal-vazio"></div>`;
  }
  diasDoMes.forEach(({ dia, key, eventosDoDia, posicaoGrupo }) => {
    const hoje = key === hojeKey ? "ti-cal-hoje" : "";
    const comEvento = eventosDoDia.length ? "ti-cal-com-evento" : "";
    const classeGrupo = posicaoGrupo ? `ti-cal-merge-${posicaoGrupo}` : "";
    // Sinaleiro de dificuldade de gerenciamento: 1 evento = tranquilo, 2 = atenção, 3+ = difícil.
    const nivelDia = eventosDoDia.length === 1 ? "ti-cal-nivel-facil"
      : eventosDoDia.length === 2 ? "ti-cal-nivel-medio"
      : eventosDoDia.length >= 3 ? "ti-cal-nivel-dificil"
      : "";
    // Num bloco mesclado, o número só aparece uma vez (senão a barra dá impressão de dias soltos).
    const mostraBadge = eventosDoDia.length && posicaoGrupo !== "meio" && posicaoGrupo !== "inicio";

    celulas += `
      <div class="ti-cal-dia ${hoje} ${comEvento} ${classeGrupo}" data-dia="${key}">
        <span class="ti-cal-numero">${dia}</span>
        ${mostraBadge ? `<span class="ti-cal-badge ${nivelDia}">${eventosDoDia.length}</span>` : ""}
      </div>
    `;
  });

  const proximosEventos = [...eventos]
    .sort((a, b) => new Date(a.dtfimrealizacao) - new Date(b.dtfimrealizacao))
    .slice(0, 6);

  const limiteMax = limiteMaximoCalendarioTI();
  const noLimiteMaximo = anoCalendarioTI > limiteMax.ano
    || (anoCalendarioTI === limiteMax.ano && mesCalendarioTI >= limiteMax.mes);

  wrapper.innerHTML = `
    <div class="ti-calendario-linha">
      <div class="ti-calendario-card">
        <div class="ti-calendario-header">
          <button type="button" id="ti-cal-prev">‹</button>
          <strong>${nomesMeses[mesCalendarioTI]} / ${anoCalendarioTI}</strong>
          <button type="button" id="ti-cal-next" ${noLimiteMaximo ? "disabled" : ""} title="${noLimiteMaximo ? "Ainda não dá pra ver mais pra frente que isso" : ""}">›</button>
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
    const limite = limiteMaximoCalendarioTI();
    const jaNoLimite = anoCalendarioTI > limite.ano || (anoCalendarioTI === limite.ano && mesCalendarioTI >= limite.mes);
    if (jaNoLimite) return;
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
      const [equipamentos, staff] = await Promise.all([
        fetchTI(`/eventos/${ev.idevento}/equipamentos`),
        fetchTI(`/eventos/${ev.idevento}/staff`),
      ]);
      return { ev, equipamentos, staff };
    } catch {
      return { ev, equipamentos: [], staff: [] };
    }
  }));

  painel.innerHTML = `
    <strong>Eventos em ${dataFormatada}</strong>
    ${detalhes.map(({ ev, equipamentos, staff }) => `
      <div class="ti-cal-evento-detalhe">
        <div class="ti-cal-evento-titulo">${ev.nmevento}</div>
        <ul>
          ${equipamentos.map((eq) => `
            <li>${eq.descequip}: ${eq.qtdorcada} orçado(s)</li>
          `).join("") || "<li>Nenhum equipamento orçado.</li>"}
        </ul>
        <div class="ti-cal-evento-staff-titulo">Equipe de TI escalada (${staff.length})</div>
        <ul class="ti-cal-evento-staff-lista">
          ${staff.map((s) => `
            <li>${s.nmfuncionario}${s.nmfuncao ? ` — ${s.nmfuncao}` : ""}</li>
          `).join("") || "<li>Ninguém escalado ainda.</li>"}
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
const STATUS_ORCAMENTO_COR = { A: "#4FC3F7", P: "#FFC107", E: "#FF8C00", F: "#16A34A", R: "#9CA3AF" };
const STATUS_ORCAMENTO_LABEL = { A: "Aberto", P: "Proposta", E: "Em Andamento", F: "Fechado", R: "Recusado" };
const STATUS_CONTROLE_LABEL = { confirmado: "Confirmado", incerto: "Incerto", cancelado: "Cancelado" };
const STATUS_UNIDADE_LABEL = { estoque: "Estoque", com_funcionario: "Com funcionário", evento: "Em evento", manutencao: "Manutenção", baixado: "Baixado" };
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
    const totalSeparado = Number(ev.qtd_separada);
    let nivel = "nivel-nenhum";
    if (totalSeparado > 0 && totalSeparado < totalAlocado) nivel = "nivel-parcial";
    if (totalSeparado > 0 && totalSeparado >= totalAlocado) nivel = "nivel-total";

    const dtfim = ev.dtfimrealizacao ? new Date(ev.dtfimrealizacao).toLocaleDateString("pt-BR") : "-";
    const dtinicio = ev.dtinirealizacao ? new Date(ev.dtinirealizacao) : null;
    // Evento pode ter orçamentos de ocorrências diferentes (uma já passada, outra futura) —
    // dtinirealizacao é o MIN de todos, então usa dtinirealizacao_futura (a próxima ocorrência
    // que ainda não começou) quando existir, em vez de só olhar a data mais antiga do lote.
    const dtinicioFutura = ev.dtinirealizacao_futura ? new Date(ev.dtinirealizacao_futura) : null;
    const aindaNaoIniciou = (dtinicio && dtinicio > new Date()) || !!dtinicioFutura;
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
          ${ev.qtd_equipamentos_distintos} equipamento(s) / ${totalAlocado} unidade(s) — ${totalSeparado} já separada(s)
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
          <button type="button" class="ti-btn-ir-separacao" data-idevento="${ev.idevento}" data-nmevento="${ev.nmevento}">
            🎒 Ir para Separação
          </button>
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

  lista.querySelectorAll(".ti-btn-ir-separacao").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      abrirSeparacaoEventoTI(btn.dataset.idevento, btn.dataset.nmevento);
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

// Monta o HTML da lista de categorias/unidades da separação (reaproveitado no render inicial e nos refreshes pós-scan)
function montarHtmlSeparacaoCategorias(categorias) {
  return categorias.map((c) => `
    <div class="ti-separacao-categoria" data-qtdorcada="${c.qtdorcada}">
      <div class="ti-separacao-categoria-titulo">
        <strong>${c.descequip}</strong>
        <span class="ti-separacao-contador">${c.qtdseparada}/${c.qtdorcada} separado(s)</span>
      </div>
      ${c.modelos.map((m) => `
        <div class="ti-separacao-modelo">
          <em>${m.marca}${m.modelo ? ' / ' + m.modelo : ''}</em>
          ${!m.unidades.length ? '<div class="ti-separacao-vazio">Nenhuma unidade em estoque.</div>' : m.unidades.map((u) => `
            <label class="ti-swal-check-linha ti-separacao-linha">
              <input type="checkbox" class="ti-check-separacao-unidade" value="${u.idunidade}" ${u.separado ? "checked" : ""}> ${u.patrimonio}
              <span class="ti-badge-local">${u.local === 'Galpao' ? 'Galpão' : 'JA'}</span>
            </label>
          `).join("")}
        </div>
      `).join("")}
    </div>
  `).join("");
}

// Tela de Separação: escolher, por modelo orçado, quais unidades (patrimônio) em estoque
// vão para este evento. Ao confirmar, a unidade é enviada de fato ao evento (status muda
// para 'evento', sai do estoque) — mesmo efeito de /custodia/enviar-evento — e fica marcada
// como separada; remover a separação já confirmada devolve a unidade ao estoque.
// Tem um campo de leitura de QR code/patrimônio no topo: o leitor (código de barras/QR)
// digita o código e dá Enter, identificando a unidade e marcando/desmarcando na hora — mas
// nada é salvo no backend até clicar em "Confirmar vínculos", pra dar chance de conferir
// tudo antes de gravar (e permitir cancelar sem sujar o banco a cada leitura).
async function abrirSeparacaoEventoTI(idevento, nmevento) {
  let categorias = [];
  try {
    categorias = await fetchTI(`/eventos/${idevento}/separacao`);
  } catch (erro) {
    console.error("Erro ao carregar separação do evento:", erro);
    Swal.fire("Erro", "Erro ao carregar dados de separação.", "error");
    return;
  }

  if (!categorias.length) {
    Swal.fire("Aviso", "Nenhum equipamento orçado para este evento.", "info");
    return;
  }

  // Estado original (vindo do backend) x pendências ainda não confirmadas.
  const original = new Map();
  categorias.forEach((c) => c.modelos.forEach((m) => m.unidades.forEach((u) => original.set(u.idunidade, u.separado))));
  const pendentes = new Map(); // idunidade -> true (separar) | false (remover), só quando difere do original

  const html = `
    <div class="ti-swal-form ti-separacao-swal">
      <label class="ti-swal-label">Ler QR code / patrimônio
        <input type="text" id="ti-separacao-scan" class="swal2-input" placeholder="Aponte o leitor ou digite o patrimônio..." autocomplete="off" style="margin:4px 0 0;">
      </label>
      <div id="ti-separacao-scan-msg" class="ti-separacao-scan-msg"></div>
      <div id="ti-separacao-lista" class="ti-swal-form-scroll ti-separacao-lista">
        ${montarHtmlSeparacaoCategorias(categorias)}
      </div>
      <div id="ti-separacao-pendencias" class="ti-separacao-pendencias ti-separacao-pendencias--vazio">Nenhuma alteração pendente.</div>
    </div>
  `;

  const atualizarContadorPendencias = () => {
    const contador = document.getElementById("ti-separacao-pendencias");
    if (!contador) return;
    if (!pendentes.size) {
      contador.textContent = "Nenhuma alteração pendente.";
      contador.classList.add("ti-separacao-pendencias--vazio");
      return;
    }
    const aSeparar = [...pendentes.values()].filter((v) => v).length;
    const aRemover = pendentes.size - aSeparar;
    contador.textContent = `${pendentes.size} alteração(ões) pendente(s) — ${aSeparar} para separar, ${aRemover} para remover. Clique em "Confirmar vínculos" para salvar.`;
    contador.classList.remove("ti-separacao-pendencias--vazio");
  };

  // Recalcula o "X/Y separado(s)" da categoria em tempo real, contando os checkboxes
  // marcados no DOM agora — não depende de recarregar nada do servidor.
  const atualizarContadorCategoria = (checkbox) => {
    const categoriaEl = checkbox?.closest(".ti-separacao-categoria");
    if (!categoriaEl) return;
    const contador = categoriaEl.querySelector(".ti-separacao-contador");
    if (!contador) return;
    const qtdorcada = categoriaEl.dataset.qtdorcada;
    const qtdmarcada = categoriaEl.querySelectorAll(".ti-check-separacao-unidade:checked").length;
    contador.textContent = `${qtdmarcada}/${qtdorcada} separado(s)`;
  };

  const marcarPendencia = (idunidade, desejado) => {
    if (desejado === original.get(idunidade)) {
      pendentes.delete(idunidade);
    } else {
      pendentes.set(idunidade, desejado);
    }
    atualizarContadorPendencias();
  };

  const ligarCheckboxes = (popup) => {
    popup.querySelectorAll(".ti-check-separacao-unidade").forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        marcarPendencia(Number(checkbox.value), checkbox.checked);
        atualizarContadorCategoria(checkbox);
      });
    });
  };

  const resultado = await Swal.fire({
    title: `Separação — ${nmevento}`,
    width: 700,
    html,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: "Confirmar vínculos",
    cancelButtonText: "Cancelar",
    didOpen: () => {
      const popup = Swal.getPopup();
      ligarCheckboxes(popup);

      const input = document.getElementById("ti-separacao-scan");
      const msg = document.getElementById("ti-separacao-scan-msg");
      input?.focus();

      const mostrarMsg = (texto, cor) => {
        if (!msg) return;
        msg.textContent = texto;
        msg.style.color = cor;
      };

      input?.addEventListener("keydown", async (e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        const patrimonio = input.value.trim();
        if (!patrimonio) return;
        input.value = "";
        input.disabled = true;
        mostrarMsg("Procurando...", "#888");

        try {
          const resultados = await fetchTI(`/estoque/busca?busca=${encodeURIComponent(patrimonio)}`);
          // Modal pode ter sido fechado (Cancelar/Esc) enquanto essa busca estava em
          // andamento — sem isso, o código continuaria mexendo num DOM já desmontado.
          if (!Swal.isVisible()) return;

          // O QR code traz só a tag final (ex: "0001"), não o patrimônio completo
          // (ex: "NTB-HP-PROBOOK-0001") — compara com o último trecho após o "-".
          const tagLida = patrimonio.toLowerCase();
          const candidatos = resultados.filter((u) => {
            const partes = (u.patrimonio || "").split("-");
            return partes[partes.length - 1]?.toLowerCase() === tagLida;
          });

          if (!candidatos.length) {
            mostrarMsg(`Nenhuma unidade em estoque encontrada para a tag "${patrimonio}".`, "#b50000");
            return;
          }
          if (candidatos.length > 1) {
            mostrarMsg(`Tag "${patrimonio}" ambígua: encontrada em mais de um patrimônio (${candidatos.map((c) => c.patrimonio).join(", ")}). Digite o patrimônio completo.`, "#b50000");
            return;
          }
          const exato = candidatos[0];

          const checkboxExistente = popup.querySelector(`.ti-check-separacao-unidade[value="${exato.idunidade}"]`);
          const atual = pendentes.has(exato.idunidade) ? pendentes.get(exato.idunidade) : (original.get(exato.idunidade) || false);
          const desejado = !atual;

          if (checkboxExistente) {
            checkboxExistente.checked = desejado;
            atualizarContadorCategoria(checkboxExistente);
          }
          marcarPendencia(exato.idunidade, desejado);

          mostrarMsg(
            desejado
              ? `✔ ${exato.patrimonio} (${exato.descEquip}) marcado para separar. Confirme os vínculos para salvar.`
              : `${exato.patrimonio} desmarcado. Confirme os vínculos para salvar.`,
            desejado ? "#046800" : "#a53603"
          );
        } catch (erro) {
          console.error("Erro ao ler patrimônio na separação:", erro);
          mostrarMsg(erro.message || "Erro ao processar leitura.", "#b50000");
        } finally {
          input.disabled = false;
          input.focus();
        }
      });
    },
    preConfirm: async () => {
      if (!pendentes.size) return true;

      const idsSeparar = [...pendentes.entries()].filter(([, v]) => v).map(([id]) => id);
      const idsRemover = [...pendentes.entries()].filter(([, v]) => !v).map(([id]) => id);

      try {
        const naoVinculados = [];

        if (idsSeparar.length) {
          const resp = await fetchTI(`/eventos/${idevento}/separacao`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idunidades: idsSeparar, acao: "separar" }),
          });
          const vinculadas = new Set((resp.unidades || []).map((u) => u.idunidade));
          idsSeparar.filter((id) => !vinculadas.has(id)).forEach((id) => naoVinculados.push(id));
        }
        if (idsRemover.length) {
          const resp = await fetchTI(`/eventos/${idevento}/separacao`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idunidades: idsRemover, acao: "remover" }),
          });
          const removidas = new Set((resp.unidades || []).map((u) => u.idunidade));
          idsRemover.filter((id) => !removidas.has(id)).forEach((id) => naoVinculados.push(id));
        }

        if (naoVinculados.length) {
          Swal.showValidationMessage(
            `${naoVinculados.length} unidade(s) não puderam ser atualizadas (podem já ter sido movidas por outra ação). Recarregue e tente novamente.`
          );
          return false;
        }

        return true;
      } catch (erro) {
        console.error("Erro ao confirmar vínculos de separação:", erro);
        Swal.showValidationMessage(erro.message || "Erro ao confirmar vínculos.");
        return false;
      }
    },
  });

  // A lista de eventos (cards com "X já separada(s)") só reflete o que estava em
  // cacheEventosAtivos na última busca — sem isso, só atualizava ao trocar filtro/mês.
  if (resultado.isConfirmed) {
    try {
      cacheEventosAtivos = await fetchTI(`/eventos-ativos?filtro=${filtroEventosTI.escopo}`);
      renderListaEventosTI();
    } catch (erro) {
      console.error("Erro ao atualizar lista de eventos após separação:", erro);
    }
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
        <thead><tr><th>Equipamento</th><th>Orçado</th></tr></thead>
        <tbody>
          ${equipamentos.map((eq) => `
            <tr>
              <td>${eq.descequip}</td>
              <td>${eq.qtdorcada}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  } catch (erro) {
    console.error("Erro ao carregar equipamentos do evento:", erro);
    detalhe.innerHTML = tiVazio("Erro ao carregar equipamentos do evento.", "error");
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
      <div id="ti-cards-equipamentos" class="ti-grid-quadrado">
        ${equipamentos.map((e) => `
          <div class="ti-card-quadrado ti-card-clicavel" data-idequip="${e.idequip}"
               data-busca="${e.descequip} ${(e.modelos || []).map((m) => `${m.marca} ${m.modelo || ''}`).join(' ')}"
               title="Clique para ver os modelos cadastrados">
            <span class="ti-card-quadrado-nome">${e.descequip}</span>
            <strong class="ti-card-quadrado-qtd">${e.qtdtotalCategoria}</strong>
          </div>
        `).join("")}
      </div>
    `;

    ativarBuscaClientSide("ti-busca-equipamentos", "#ti-cards-equipamentos .ti-card-quadrado", (card) => card.dataset.busca || "");

    container.querySelectorAll(".ti-card-quadrado").forEach((card) =>
      card.addEventListener("click", () => abrirModelosCategoriaTI(Number(card.dataset.idequip)))
    );
  } catch (erro) {
    console.error("Erro ao carregar equipamentos (TI):", erro);
    container.innerHTML = tiVazio("Erro ao carregar equipamentos.", "error");
  }
}

// ===== Estoque (cards por categoria — clicar mostra todos os modelos) =====
async function renderAbaEstoque() {
  const container = document.getElementById("ti-aba-estoque");
  if (!container) return;
  container.innerHTML = tiLoading("Carregando estoque...");

  try {
    const equipamentos = await fetchTI("/equipamentos");
    cacheEquipamentos = equipamentos;

    if (!equipamentos.length) {
      container.innerHTML = tiVazio("Nenhum equipamento cadastrado. Cadastre marcas/modelos no cadastro de equipamentos.", "inventory_2");
      return;
    }

    const qtdModeloPorLocal = (m) => {
      if (filtroLocalEstoqueTI === "JA") return Number(m.qtdeestoque_ja) || 0;
      if (filtroLocalEstoqueTI === "Galpao") return Number(m.qtdeestoque_galpao) || 0;
      return Number(m.qtdeestoque) || 0;
    };
    const legendaLocal = filtroLocalEstoqueTI === "todos" ? "em estoque" : `em estoque — ${filtroLocalEstoqueTI === "JA" ? "JA" : "Galpão"}`;

    const locais = [
      { valor: "todos", label: "Todos" },
      { valor: "JA", label: "JA" },
      { valor: "Galpao", label: "Galpão" },
    ];

    container.innerHTML = `
      <div class="Evt-container">
        <div style="display:flex; gap:20px; flex-wrap:wrap; align-items:flex-end;">
          <div class="filtro-grupo">
            <label class="label-select">Local</label>
            <div class="wrapper" style="width:215px;">
              ${locais.map((op) => `
                <div class="option" style="width:65px;">
                  <input ${filtroLocalEstoqueTI === op.valor ? "checked" : ""} value="${op.valor}" name="ti-localEstoque" type="radio" class="input">
                  <div class="btn"><span class="span">${op.label}</span></div>
                </div>
              `).join("")}
            </div>
          </div>
          <div class="filtro-grupo">
            <label class="label-select">Buscar</label>
            <div class="wrapper select-wrapper busca-evento-wrapper" style="width:260px;">
              <input type="text" id="ti-busca-estoque" class="busca-evento-input" placeholder="Buscar equipamento ou marca..." autocomplete="off">
            </div>
          </div>
        </div>
      </div>
      <div id="ti-cards-estoque" class="ti-grid-quadrado" style="margin-top:20px;">
        ${equipamentos.map((e) => {
          const totalEstoque = (e.modelos || []).reduce((soma, m) => soma + qtdModeloPorLocal(m), 0);
          return `
            <div class="ti-card-quadrado ti-card-clicavel" data-idequip="${e.idequip}"
                 data-busca="${e.descequip} ${(e.modelos || []).map((m) => `${m.marca} ${m.modelo || ''}`).join(' ')}"
                 title="Clique para ver os modelos cadastrados">
              <span class="ti-card-quadrado-nome">${e.descequip}</span>
              <strong class="ti-card-quadrado-qtd">${totalEstoque}</strong>
              <span class="ti-card-quadrado-legenda">${legendaLocal}</span>
            </div>
          `;
        }).join("")}
      </div>
    `;

    ativarBuscaClientSide("ti-busca-estoque", "#ti-cards-estoque .ti-card-quadrado", (card) => card.dataset.busca || "");

    container.querySelectorAll(".ti-card-quadrado").forEach((card) =>
      card.addEventListener("click", () => abrirModelosCategoriaTI(Number(card.dataset.idequip)))
    );

    container.querySelectorAll('input[name="ti-localEstoque"]').forEach((radio) => {
      radio.addEventListener("change", () => {
        filtroLocalEstoqueTI = radio.value;
        renderAbaEstoque();
      });
    });
  } catch (erro) {
    console.error("Erro ao carregar estoque (TI):", erro);
    container.innerHTML = tiVazio("Erro ao carregar estoque.", "error");
  }
}

async function abrirModelosCategoriaTI(idequip) {
  const equipamento = cacheEquipamentos.find((e) => e.idequip === idequip);
  if (!equipamento) return;
  await montarSwalModelosCategoria(equipamento);
}

// Reabre o modal com dados atualizados (chamado depois de entrada/baixa feitas de dentro dele)
async function reabrirModelosCategoriaTI(idequip) {
  try {
    const equipamentos = await fetchTI("/equipamentos");
    cacheEquipamentos = equipamentos;
    const equipamento = equipamentos.find((e) => e.idequip === idequip);
    if (equipamento) await montarSwalModelosCategoria(equipamento);
  } finally {
    renderAbaEstoque();
  }
}

async function montarSwalModelosCategoria(equipamento) {
  const modelos = equipamento.modelos || [];

  await Swal.fire({
    title: equipamento.descequip,
    width: 800,
    html: `
      <div class="ti-swal-modelos-grid">
        ${!modelos.length ? "<p>Nenhum modelo cadastrado para esta categoria.</p>" : modelos.map((m) => `
          <div class="ti-swal-modelo-card" data-idmodelo="${m.id}">
            <span class="ti-swal-modelo-titulo">${m.marca}${m.modelo ? ' / ' + m.modelo : ''}</span>
            <div class="ti-swal-modelo-numeros">
              <div><strong>${m.qtdeestoque}</strong><span>em estoque</span></div>
              <div><strong>${m.qtdtotal}</strong><span>no total</span></div>
            </div>
            <div class="ti-swal-modelo-locais">
              <span class="ti-badge-local">JA: ${m.qtdeestoque_ja}</span>
              <span class="ti-badge-local">Galpão: ${m.qtdeestoque_galpao}</span>
            </div>
            <div class="ti-swal-modelo-acoes">
              <button type="button" class="ti-btn-entrada" data-idmodelo="${m.id}" data-marca="${m.marca || ''}" data-modelo="${m.modelo || ''}">Entrada</button>
              <button type="button" class="ti-btn-saida secundario" data-idmodelo="${m.id}">Baixa</button>
              <button type="button" class="ti-btn-ver-unidades secundario" data-idmodelo="${m.id}">Ver unidades</button>
            </div>
            <div class="ti-swal-modelo-detalhe ti-linha-unidades" data-idmodelo-unidades="${m.id}" style="display:none;"></div>
          </div>
        `).join("")}
      </div>
    `,
    showConfirmButton: false,
    showCancelButton: true,
    cancelButtonText: "Fechar",
    didOpen: () => {
      const popup = Swal.getPopup();
      popup.querySelectorAll(".ti-btn-entrada").forEach((btn) =>
        btn.addEventListener("click", () => abrirEntradaEstoqueTI(
          equipamento.idequip,
          btn.dataset.idmodelo,
          () => reabrirModelosCategoriaTI(equipamento.idequip),
          { descequip: equipamento.descequip, marca: btn.dataset.marca, modelo: btn.dataset.modelo }
        ))
      );
      popup.querySelectorAll(".ti-btn-saida").forEach((btn) =>
        btn.addEventListener("click", () => abrirBaixaEstoqueTI(equipamento.idequip, btn.dataset.idmodelo, () => reabrirModelosCategoriaTI(equipamento.idequip)))
      );
      popup.querySelectorAll(".ti-btn-ver-unidades").forEach((btn) =>
        btn.addEventListener("click", () => toggleUnidadesModelo(equipamento.idequip, btn.dataset.idmodelo))
      );
    },
  });
}

async function toggleUnidadesModelo(idequip, idmodelo) {
  const linha = document.querySelector(`.ti-linha-unidades[data-idmodelo-unidades="${idmodelo}"]`);
  if (!linha) return;
  const cardPai = linha.closest(".ti-swal-modelo-card");

  const aberta = linha.style.display !== "none";
  if (aberta) {
    linha.style.display = "none";
    cardPai?.classList.remove("ti-swal-modelo-expandido");
    return;
  }

  linha.style.display = "block";
  cardPai?.classList.add("ti-swal-modelo-expandido");
  const celula = linha;
  celula.innerHTML = "Carregando unidades...";

  try {
    let unidades = await fetchTI(`/equipamentos/${idequip}/modelos/${idmodelo}/unidades`);
    if (!unidades.length) {
      celula.innerHTML = "<em>Nenhuma unidade cadastrada ainda.</em>";
      return;
    }

    // O filtro de local da aba Estoque só faz sentido pra quem está em estoque de
    // fato — unidades com funcionário/evento/manutenção continuam sempre visíveis.
    const unidadesFiltradas = filtroLocalEstoqueTI === "todos"
      ? unidades
      : unidades.filter((u) => u.status !== 'estoque' || u.local === filtroLocalEstoqueTI);

    if (!unidadesFiltradas.length) {
      celula.innerHTML = `<em>Nenhuma unidade em estoque no local "${filtroLocalEstoqueTI === 'JA' ? 'JA' : 'Galpão'}".</em>`;
      return;
    }
    unidades = unidadesFiltradas;

    celula.innerHTML = `
      <table class="ti-tabela ti-tabela-unidades">
        <thead><tr><th>Patrimônio</th><th>Status</th><th>Local</th><th>Com quem / evento</th><th>Ações</th></tr></thead>
        <tbody>
          ${unidades.map((u) => `
            <tr data-idunidade="${u.idunidade}">
              <td>${u.patrimonio}</td>
              <td><span class="ti-badge-status ti-badge-status-${u.status}">${STATUS_UNIDADE_LABEL[u.status] || u.status}</span></td>
              <td>
                ${u.status === 'estoque' ? `
                  <select class="ti-select-local-unidade" data-idunidade="${u.idunidade}">
                    <option value="JA" ${u.local === 'JA' ? "selected" : ""}>JA</option>
                    <option value="Galpao" ${u.local === 'Galpao' ? "selected" : ""}>Galpão</option>
                  </select>
                ` : (u.local || "-")}
              </td>
              <td>${u.nome_funcionario_atual || u.nmevento_atual || "-"}</td>
              <td>
                <div class="ti-acoes-unidade">
                  ${u.status === 'estoque' ? `<button type="button" class="ti-btn-entregar" data-idunidade="${u.idunidade}">Entregar</button>` : ""}
                  ${u.status === 'com_funcionario' ? `<button type="button" class="ti-btn-devolver" data-idunidade="${u.idunidade}">Devolver</button>
                    <button type="button" class="ti-btn-transferir" data-idunidade="${u.idunidade}">Transferir</button>` : ""}
                  ${['estoque', 'com_funcionario'].includes(u.status) ? `<button type="button" class="ti-btn-enviar-evento" data-idunidade="${u.idunidade}">Enviar a evento</button>` : ""}
                  ${u.status === 'evento' ? `<button type="button" class="ti-btn-retornar-evento" data-idunidade="${u.idunidade}">Retornar de evento</button>` : ""}
                  ${u.status === 'estoque' ? `<button type="button" class="ti-btn-manutencao secundario" data-idunidade="${u.idunidade}">Manutenção</button>` : ""}
                  <button type="button" class="ti-btn-historico-unidade secundario" data-idunidade="${u.idunidade}" data-patrimonio="${u.patrimonio}">Histórico</button>
                </div>
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
    celula.querySelectorAll(".ti-btn-manutencao").forEach((btn) => btn.addEventListener("click", () => enviarParaManutencaoTI(btn.dataset.idunidade)));
    celula.querySelectorAll(".ti-select-local-unidade").forEach((select) => {
      select.addEventListener("change", async () => {
        select.disabled = true;
        try {
          await fetchTI("/equipamentos/unidades/local", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idunidades: [Number(select.dataset.idunidade)], local: select.value }),
          });
        } catch (erro) {
          console.error("Erro ao mover unidade de local:", erro);
          Swal.fire("Erro", erro.message || "Erro ao mover unidade de local.", "error");
          await reabrirUnidadesModelo(idequip, idmodelo);
        } finally {
          select.disabled = false;
        }
      });
    });
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

// Abreviações conhecidas de equipamento para deixar o patrimônio mais curto (ex: Notebook -> NTB).
// Equipamentos fora dessa lista caem no fallback de montarPrefixoPatrimonio (iniciais das palavras).
const ABREVIACOES_EQUIPAMENTO = {
  "NOTEBOOK": "NTB",
  "DESKTOP": "DSK",
  "COMPUTADOR": "PC",
  "MONITOR": "MNT",
  "IMPRESSORA": "IMP",
  "PROJETOR": "PROJ",
  "ROTEADOR": "RTD",
  "SWITCH": "SW",
  "NOBREAK": "NBK",
  "TABLET": "TAB",
  "CELULAR": "CEL",
  "TECLADO": "TEC",
  "MOUSE": "MOU",
  "CAMERA": "CAM",
  "CÂMERA": "CAM",
  "CABO": "CBO",
  "CAIXA DE SOM": "CXS",
  "MICROFONE": "MIC",
  "HD EXTERNO": "HDE",
  "PENDRIVE": "PEN",
};

// Abrevia o nome do equipamento: usa o mapa conhecido ou, na ausência, as iniciais de cada palavra (máx. 4 letras)
function abreviarEquipamento(descequip) {
  const nome = (descequip || "").trim().toUpperCase();
  if (!nome) return "";
  if (ABREVIACOES_EQUIPAMENTO[nome]) return ABREVIACOES_EQUIPAMENTO[nome];
  const palavras = nome.split(/\s+/).filter(Boolean);
  if (palavras.length === 1) return palavras[0].slice(0, 4);
  return palavras.map((p) => p[0]).join("").slice(0, 4);
}

// Monta o prefixo padrão do patrimônio a partir do equipamento/marca/modelo, ex: NTB-HP-PROBOOK
function montarPrefixoPatrimonio({ descequip, marca, modelo } = {}) {
  return [abreviarEquipamento(descequip), marca, modelo]
    .map((p) => (p || "").trim())
    .filter(Boolean)
    .join("-")
    .toUpperCase()
    .replace(/\s+/g, "");
}

// Entrada: uma tag por linha no textarea (uma unidade física por linha).
// O patrimônio final é montado como ${equipamento}-${marca}-${modelo}-${tag} para facilitar buscas futuras.
async function abrirEntradaEstoqueTI(idequip, idmodelo, aoConcluir = renderAbaEstoque, infoModelo = {}) {
  const prefixo = montarPrefixoPatrimonio(infoModelo);

  const { value: formValues } = await Swal.fire({
    title: "Registrar entrada de estoque",
    html: `
      <div class="ti-swal-form">
        <label class="ti-swal-label">Tags/códigos (um por linha)${prefixo ? ` — prefixo: <strong>${prefixo}-</strong>` : ""}
          <textarea id="swal-ti-patrimonios" class="swal2-textarea" rows="6" placeholder="Ex:\n0001\n0002\n0003" style="margin:4px 0 0;"></textarea>
        </label>
        <label class="ti-swal-label">Local
          <select id="swal-ti-local" class="swal2-select" style="margin:4px 0 0; width:100%;">
            <option value="JA">JA (escritório)</option>
            <option value="Galpao">Galpão</option>
          </select>
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
      const local = document.getElementById("swal-ti-local").value;
      const motivo = document.getElementById("swal-ti-mov-motivo").value.trim();
      const tags = texto.split("\n").map((l) => l.trim()).filter(Boolean);
      if (!tags.length) {
        Swal.showValidationMessage("Informe ao menos uma tag/código.");
        return false;
      }
      const patrimonios = tags.map((tag) => (prefixo ? `${prefixo}-${tag}` : tag));
      const duplicados = patrimonios.filter((p, i) => patrimonios.indexOf(p) !== i);
      if (duplicados.length) {
        Swal.showValidationMessage(`Patrimônio repetido na lista: ${duplicados[0]}`);
        return false;
      }
      return { patrimonios, local, motivo };
    }
  });

  if (!formValues) return;

  try {
    const resp = await fetchTI(`/equipamentos/${idequip}/modelos/${idmodelo}/estoque`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo: "entrada", patrimonios: formValues.patrimonios, local: formValues.local, motivo: formValues.motivo }),
    });
    await Swal.fire("Sucesso!", resp.message || "Entrada registrada.", "success");
    aoConcluir();
  } catch (erro) {
    console.error("Erro ao registrar entrada:", erro);
    Swal.fire("Erro", erro.message || "Erro ao registrar entrada.", "error");
  }
}

// Baixa: escolher quais unidades (em estoque) sair definitivamente
async function abrirBaixaEstoqueTI(idequip, idmodelo, aoConcluir = renderAbaEstoque) {
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
    aoConcluir();
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

// ===== Alocação (todos os funcionários e quem está com qual equipamento) =====
const TI_PERFIL_LABEL = { Interno: "Interno", ExternoH: "Externo c/ Holerite", Externo: "Externo" };

async function renderAbaCustodia() {
  const container = document.getElementById("ti-aba-custodia");
  if (!container) return;
  container.innerHTML = tiLoading("Carregando funcionários...");

  try {
    await carregarListaAlocacao("");
  } catch (erro) {
    console.error("Erro ao carregar alocação:", erro);
    container.innerHTML = tiVazio("Erro ao carregar alocação.", "error");
  }
}

async function carregarListaAlocacao(perfil) {
  const container = document.getElementById("ti-aba-custodia");
  if (!container) return;

  const query = perfil ? `?perfil=${encodeURIComponent(perfil)}` : "";
  const funcionarios = await fetchTI(`/custodia/funcionarios${query}`);

  container.innerHTML = `
    <div class="ti-custodia-filtros">
      ${montarCampoBusca("ti-busca-custodia", "Buscar funcionário...")}
    </div>
    <div id="ti-lista-custodia">
      ${!funcionarios.length ? tiVazio("Nenhum funcionário encontrado.", "badge") : funcionarios.map((f, idx) => `
        <div class="ti-card-linha" data-busca="${f.nome}">
          <div class="ti-card-linha-topo ti-func-nome" data-idx="${idx}" title="Clique para ver as ações">
            <span class="ti-card-linha-titulo">
              <span class="material-symbols-outlined ti-func-seta">expand_more</span>${f.nome}
            </span>
            <span class="ti-card-linha-stat">${TI_PERFIL_LABEL[f.perfil] || f.perfil || "-"} · ${f.equipamentos.length} equipamento(s)</span>
          </div>
          <div class="ti-func-acoes" data-idx="${idx}" style="display:none;">
            <button type="button" class="ti-func-btn-adicionar" ${f.equipamentos.length ? "disabled" : ""}>
              <span class="material-symbols-outlined">add_circle</span>Adicionar equipamento
            </button>
            <button type="button" class="ti-func-btn-troca secundario" ${!f.equipamentos.length ? "disabled" : ""}>
              <span class="material-symbols-outlined">sync_alt</span>Procedimento de troca
            </button>
            <button type="button" class="ti-func-btn-manutencao secundario" ${!f.equipamentos.length ? "disabled" : ""}>
              <span class="material-symbols-outlined">build</span>Manutenção + máquina temporária
            </button>
          </div>
          ${f.equipamentos.length ? `
            <div class="ti-card-linha-detalhe">
              ${f.equipamentos.map((eq) => `
                <div class="ti-modelo-linha">
                  <span>
                    ${eq.descequip} — ${eq.patrimonio}
                    ${eq.substituida_por_idunidade ? `<span class="ti-badge-aguardando-troca" title="Já foi entregue um equipamento novo; esse aqui está pendente de devolução">⏳ substituída por ${eq.substituida_por_patrimonio}</span>` : ""}
                  </span>
                  <span class="ti-card-linha-acoes">
                    <button type="button" class="ti-btn-devolver" data-idunidade="${eq.idunidade}" data-idequip="${eq.idequip}" data-idmodelo="${eq.idmodelo}">Devolver</button>
                    <button type="button" class="ti-btn-transferir" data-idunidade="${eq.idunidade}" data-idequip="${eq.idequip}" data-idmodelo="${eq.idmodelo}">Transferir</button>
                    <button type="button" class="ti-btn-historico-unidade" data-idunidade="${eq.idunidade}" data-patrimonio="${eq.patrimonio}">Histórico</button>
                  </span>
                </div>
              `).join("")}
            </div>
          ` : `<div class="ti-card-linha-sub">Nenhum equipamento no momento.</div>`}
        </div>
      `).join("")}
    </div>
  `;

  ativarBuscaClientSide("ti-busca-custodia", "#ti-lista-custodia .ti-card-linha", (card) => card.dataset.busca || "");

  container.querySelectorAll(".ti-btn-devolver").forEach((btn) =>
    btn.addEventListener("click", () => devolverUnidadeTI(btn.dataset.idunidade, btn.dataset.idequip, btn.dataset.idmodelo))
  );
  container.querySelectorAll(".ti-btn-transferir").forEach((btn) =>
    btn.addEventListener("click", () => abrirTransferirTI(btn.dataset.idunidade, btn.dataset.idequip, btn.dataset.idmodelo))
  );
  container.querySelectorAll(".ti-btn-historico-unidade").forEach((btn) =>
    btn.addEventListener("click", () => verHistoricoUnidadeTI(btn.dataset.idunidade, btn.dataset.patrimonio))
  );
  container.querySelectorAll(".ti-func-nome").forEach((el) =>
    el.addEventListener("click", () => toggleAcoesFuncionarioTI(el.dataset.idx))
  );
  container.querySelectorAll(".ti-func-btn-adicionar").forEach((btn) => {
    const idx = Number(btn.closest(".ti-func-acoes").dataset.idx);
    btn.addEventListener("click", () => abrirAdicionarEquipamentoFuncionarioTI(funcionarios[idx]));
  });
  container.querySelectorAll(".ti-func-btn-troca").forEach((btn) => {
    const idx = Number(btn.closest(".ti-func-acoes").dataset.idx);
    btn.addEventListener("click", () => abrirTrocaEquipamentoFuncionarioTI(funcionarios[idx]));
  });
  container.querySelectorAll(".ti-func-btn-manutencao").forEach((btn) => {
    const idx = Number(btn.closest(".ti-func-acoes").dataset.idx);
    btn.addEventListener("click", () => abrirManutencaoComTemporariaTI(funcionarios[idx]));
  });
}

function toggleAcoesFuncionarioTI(idx) {
  const bloco = document.querySelector(`.ti-func-acoes[data-idx="${idx}"]`);
  const seta = document.querySelector(`.ti-func-nome[data-idx="${idx}"] .ti-func-seta`);
  if (!bloco) return;
  const aberto = bloco.style.display !== "none";
  bloco.style.display = aberto ? "none" : "flex";
  if (seta) seta.textContent = aberto ? "expand_more" : "expand_less";
}

// Busca padrão (mesmo modelo do #rh-busca-func): input de texto + lista suspensa filtrada
function montarCampoEquipamentoEstoqueSwal(idBase, placeholder = "Buscar equipamento por descrição, marca, modelo ou patrimônio...") {
  return `
    <div class="ti-swal-busca">
      <input type="text" id="${idBase}-input" class="swal2-input" placeholder="${placeholder}" autocomplete="off" style="margin:4px 0 0;">
      <input type="hidden" id="${idBase}-id" value="">
      <ul id="${idBase}-lista" class="ti-swal-busca-lista" style="display:none;"></ul>
    </div>
  `;
}

let tiBuscaEquipamentoDebounce = null;
function ativarAutocompleteEquipamentoEstoqueSwal(idBase) {
  const input = document.getElementById(`${idBase}-input`);
  const hidden = document.getElementById(`${idBase}-id`);
  const lista = document.getElementById(`${idBase}-lista`);
  if (!input || !hidden || !lista) return;

  const renderLista = (resultados) => {
    lista.innerHTML = "";
    if (!resultados.length) {
      lista.innerHTML = "<li>Nenhum equipamento encontrado.</li>";
    } else {
      resultados.forEach((u) => {
        const li = document.createElement("li");
        li.textContent = `${u.descEquip}${u.marca ? ' — ' + u.marca : ''}${u.modelo ? '/' + u.modelo : ''} (${u.patrimonio})`;
        li.addEventListener("mousedown", (e) => {
          e.preventDefault();
          input.value = li.textContent;
          hidden.value = u.idunidade;
          lista.style.display = "none";
        });
        lista.appendChild(li);
      });
    }
    lista.style.display = "block";
  };

  input.addEventListener("input", () => {
    hidden.value = "";
    clearTimeout(tiBuscaEquipamentoDebounce);
    const termo = input.value.trim();
    if (termo.length < 2) {
      lista.style.display = "none";
      return;
    }
    tiBuscaEquipamentoDebounce = setTimeout(async () => {
      try {
        const resultados = await fetchTI(`/estoque/busca?busca=${encodeURIComponent(termo)}`);
        renderLista(resultados);
      } catch (erro) {
        console.error("Erro ao buscar equipamento em estoque:", erro);
      }
    }, 250);
  });

  // Leitores de código de barras/tag digitam o código e enviam Enter em seguida —
  // sem esse tratamento o Enter só confirmaria o modal sem nada selecionado.
  input.addEventListener("keydown", async (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    clearTimeout(tiBuscaEquipamentoDebounce);
    const termo = input.value.trim();
    if (!termo) return;

    try {
      const resultados = await fetchTI(`/estoque/busca?busca=${encodeURIComponent(termo)}`);
      // O leitor de QR/código de barras só traz a tag final (ex: "0001"), não o
      // patrimônio completo com o prefixo (ex: "NTB-HP-PROBOOK-0001") — compara
      // com o patrimônio inteiro OU só com o trecho após o último "-".
      const termoLower = termo.toLowerCase();
      const candidatos = resultados.filter((u) => {
        const patrimonio = (u.patrimonio || "").toLowerCase();
        if (patrimonio === termoLower) return true;
        const partes = patrimonio.split("-");
        return partes[partes.length - 1] === termoLower;
      });

      if (candidatos.length === 1) {
        const exato = candidatos[0];
        input.value = `${exato.descEquip}${exato.marca ? ' — ' + exato.marca : ''}${exato.modelo ? '/' + exato.modelo : ''} (${exato.patrimonio})`;
        hidden.value = exato.idunidade;
        lista.style.display = "none";
      } else if (candidatos.length > 1) {
        Swal.showValidationMessage(`Tag "${termo}" ambígua: encontrada em mais de um patrimônio (${candidatos.map((c) => c.patrimonio).join(", ")}). Digite o patrimônio completo.`);
        renderLista(candidatos);
        return;
      } else {
        renderLista(resultados);
        return;
      }
    } catch (erro) {
      console.error("Erro ao buscar equipamento em estoque:", erro);
      return;
    }

    Swal.getConfirmButton()?.click();
  });

  input.addEventListener("blur", () => setTimeout(() => { lista.style.display = "none"; }, 150));
}

function lerEquipamentoEstoqueSwal(idBase) {
  const valor = document.getElementById(`${idBase}-id`)?.value;
  return valor ? Number(valor) : null;
}

async function avisarTagNaoCadastradaSwal(idBase) {
  const termo = document.getElementById(`${idBase}-input`)?.value.trim();
  const { isConfirmed } = await Swal.fire({
    icon: "warning",
    title: "Tag não cadastrada",
    text: termo
      ? `Nenhuma unidade em estoque encontrada para "${termo}".`
      : "Nenhuma unidade em estoque encontrada para esse código.",
    showCancelButton: true,
    confirmButtonText: "Cadastrar",
    cancelButtonText: "Cancelar",
    reverseButtons: true,
  });
  if (isConfirmed) trocarAbaTI("estoque");
}

// Campo de upload padronizado (botão com ícone, nas cores do Roots, no lugar do
// <input type="file"> cru do navegador). O input real fica escondido; o botão
// visível só dispara o seletor de arquivo por cima dele.
function montarCampoUploadSwal(idBase, label = "Anexar arquivo") {
  return `
    <div class="ti-upload-wrap">
      <label for="${idBase}" class="ti-upload-btn">
        <svg aria-hidden="true" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path stroke-width="2" stroke="currentColor" d="M13.5 3H12H8C6.34315 3 5 4.34315 5 6V18C5 19.6569 6.34315 21 8 21H11M13.5 3L19 8.625M13.5 3V7.625C13.5 8.17728 13.9477 8.625 14.5 8.625H19M19 8.625V11.8125" stroke-linejoin="round" stroke-linecap="round"></path>
          <path stroke-linejoin="round" stroke-linecap="round" stroke-width="2" stroke="currentColor" d="M17 15V18M17 21V18M17 18H14M17 18H20"></path>
        </svg>
        ${label}
      </label>
      <input type="file" id="${idBase}" accept="image/*,application/pdf" style="display:none;">
      <span id="${idBase}-nome" class="ti-upload-nome">Nenhum arquivo selecionado</span>
    </div>
  `;
}

function ativarCampoUploadSwal(idBase) {
  const input = document.getElementById(idBase);
  const nome = document.getElementById(`${idBase}-nome`);
  if (!input || !nome) return;
  input.addEventListener("change", () => {
    nome.textContent = input.files[0]?.name || "Nenhum arquivo selecionado";
  });
}

// Busca padrão de funcionário (mesmo modelo do #rh-busca-func): input de texto + lista suspensa
function montarCampoFuncionarioBuscaSwal(idBase, placeholder = "Buscar funcionário por nome...") {
  return `
    <div class="ti-swal-busca">
      <input type="text" id="${idBase}-input" class="swal2-input" placeholder="${placeholder}" autocomplete="off" style="margin:4px 0 0;">
      <input type="hidden" id="${idBase}-id" value="">
      <ul id="${idBase}-lista" class="ti-swal-busca-lista" style="display:none;"></ul>
    </div>
  `;
}

let tiBuscaFuncionarioDebounce = null;
function ativarBuscaFuncionarioSwal(idBase) {
  const input = document.getElementById(`${idBase}-input`);
  const hidden = document.getElementById(`${idBase}-id`);
  const lista = document.getElementById(`${idBase}-lista`);
  if (!input || !hidden || !lista) return;

  input.addEventListener("input", () => {
    hidden.value = "";
    clearTimeout(tiBuscaFuncionarioDebounce);
    const termo = input.value.trim();
    if (termo.length < 2) {
      lista.style.display = "none";
      return;
    }
    tiBuscaFuncionarioDebounce = setTimeout(async () => {
      try {
        const resultados = await fetchTI(`/funcionarios/busca?busca=${encodeURIComponent(termo)}`);
        lista.innerHTML = "";
        if (!resultados.length) {
          lista.innerHTML = "<li>Nenhum funcionário encontrado.</li>";
        } else {
          resultados.forEach((f) => {
            const li = document.createElement("li");
            li.textContent = f.nome;
            li.addEventListener("mousedown", (e) => {
              e.preventDefault();
              input.value = f.nome;
              hidden.value = f.idfuncionario;
              lista.style.display = "none";
            });
            lista.appendChild(li);
          });
        }
        lista.style.display = "block";
      } catch (erro) {
        console.error("Erro ao buscar funcionário:", erro);
      }
    }, 250);
  });

  input.addEventListener("blur", () => setTimeout(() => { lista.style.display = "none"; }, 150));
}

function lerFuncionarioBuscaSwal(idBase) {
  const valor = document.getElementById(`${idBase}-id`)?.value;
  return valor ? Number(valor) : null;
}

// Busca padrão de usuário do sistema (mesmo modelo da busca de funcionário)
function montarCampoUsuarioBuscaSwal(idBase, placeholder = "Buscar usuário por nome ou e-mail...") {
  return `
    <div class="ti-swal-busca">
      <input type="text" id="${idBase}-input" class="swal2-input" placeholder="${placeholder}" autocomplete="off" style="margin:4px 0 0;">
      <input type="hidden" id="${idBase}-id" value="">
      <ul id="${idBase}-lista" class="ti-swal-busca-lista" style="display:none;"></ul>
    </div>
  `;
}

let tiBuscaUsuarioDebounce = null;
function ativarBuscaUsuarioSwal(idBase) {
  const input = document.getElementById(`${idBase}-input`);
  const hidden = document.getElementById(`${idBase}-id`);
  const lista = document.getElementById(`${idBase}-lista`);
  if (!input || !hidden || !lista) return;

  input.addEventListener("input", () => {
    hidden.value = "";
    clearTimeout(tiBuscaUsuarioDebounce);
    const termo = input.value.trim();
    if (termo.length < 2) {
      lista.style.display = "none";
      return;
    }
    tiBuscaUsuarioDebounce = setTimeout(async () => {
      try {
        const resultados = await fetchTI(`/usuarios/busca?busca=${encodeURIComponent(termo)}`);
        lista.innerHTML = "";
        if (!resultados.length) {
          lista.innerHTML = "<li>Nenhum usuário encontrado.</li>";
        } else {
          resultados.forEach((u) => {
            const li = document.createElement("li");
            li.textContent = u.nome;
            li.addEventListener("mousedown", (e) => {
              e.preventDefault();
              input.value = u.nome;
              hidden.value = u.idusuario;
              lista.style.display = "none";
            });
            lista.appendChild(li);
          });
        }
        lista.style.display = "block";
      } catch (erro) {
        console.error("Erro ao buscar usuário:", erro);
      }
    }, 250);
  });

  input.addEventListener("blur", () => setTimeout(() => { lista.style.display = "none"; }, 150));
}

function lerUsuarioBuscaSwal(idBase) {
  const valor = document.getElementById(`${idBase}-id`)?.value;
  return valor ? Number(valor) : null;
}

// Ao sair do campo de e-mail no cadastro: se esse endereço já é login de algum usuário
// do sistema, vincula sozinho (sem precisar de um campo de busca separado).
async function sincronizarUsuarioPorEmailTI() {
  const input = document.getElementById("swal-ti-email-endereco");
  const hidden = document.getElementById("swal-ti-email-idusuario-auto");
  const status = document.getElementById("swal-ti-email-status-usuario");
  if (!input || !hidden || !status) return;

  const email = input.value.trim();
  hidden.value = "";
  status.style.color = "#777";
  if (!email) {
    status.textContent = "Se esse e-mail já for o login de algum usuário do sistema, ele é vinculado automaticamente (dá pra ajustar depois).";
    return;
  }

  const idfuncionario = lerFuncionarioBuscaSwal("swal-ti-email-funcionario");
  const query = `/usuarios/por-email?email=${encodeURIComponent(email)}${idfuncionario ? `&idfuncionario=${idfuncionario}` : ""}`;

  try {
    const usuario = await fetchTI(query);
    if (usuario?.idusuario && usuario.compativel === false) {
      status.textContent = `❌ Esse e-mail já é login de ${usuario.nome}, que parece ser outra pessoa — não vou vincular ao funcionário selecionado. Confira o e-mail ou o funcionário.`;
      status.style.color = "#942123";
    } else if (usuario?.idusuario) {
      hidden.value = usuario.idusuario;
      status.textContent = `✅ Vinculado automaticamente ao usuário: ${usuario.nome}`;
      status.style.color = "#2e7d32";
    } else {
      status.textContent = "⚠ Usuário não identificado — cadastro seguirá sem vínculo (dá pra ajustar depois).";
      status.style.color = "#777";
    }
  } catch (erro) {
    console.error("Erro ao sincronizar usuário pelo e-mail:", erro);
  }
}

// Checkbox padrão (mesmo "ios-checkbox" usado no restante do TI Mode)
function montarCheckboxPadraoSwal(idInput, label) {
  return `
    <label class="ti-swal-check">
      <span class="ios-checkbox">
        <input type="checkbox" id="${idInput}">
        <div class="checkbox-wrapper">
          <div class="checkbox-bg"></div>
          <svg fill="none" viewBox="0 0 24 24" class="checkbox-icon">
            <path stroke-linejoin="round" stroke-linecap="round" stroke-width="3" stroke="currentColor" d="M4 12L10 18L20 6" class="check-path"></path>
          </svg>
        </div>
      </span>
      ${label}
    </label>
  `;
}

// Opção 1: adicionar equipamento a um funcionário que ainda não tem nenhum
async function abrirAdicionarEquipamentoFuncionarioTI(f) {
  const { value: formValues } = await Swal.fire({
    title: `Adicionar equipamento — ${f.nome}`,
    html: `
      <div class="ti-swal-form">
        <label class="ti-swal-label">Equipamento
          ${montarCampoEquipamentoEstoqueSwal("swal-ti-equip-add")}
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
    didOpen: () => ativarAutocompleteEquipamentoEstoqueSwal("swal-ti-equip-add"),
    preConfirm: async () => {
      const idunidade = lerEquipamentoEstoqueSwal("swal-ti-equip-add");
      const observacao = document.getElementById("swal-ti-observacao").value.trim();
      if (!idunidade) {
        const termo = document.getElementById("swal-ti-equip-add-input")?.value.trim();
        if (termo) {
          await avisarTagNaoCadastradaSwal("swal-ti-equip-add");
        } else {
          Swal.showValidationMessage("Selecione um equipamento.");
        }
        return false;
      }
      return { idunidade, observacao };
    }
  });

  if (!formValues) return;

  try {
    await fetchTI("/custodia/entregar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idfuncionario: f.idfuncionario, ...formValues }),
    });
    await Swal.fire("Sucesso!", "Equipamento entregue.", "success");
    renderAbaCustodia();
  } catch (erro) {
    console.error("Erro ao entregar equipamento:", erro);
    Swal.fire("Erro", erro.message || "Erro ao entregar equipamento.", "error");
  }
}

// Opção 2: procedimento de troca — entrega um equipamento novo mantendo o(s) atual(is)
// com o funcionário (fica com os 2 ao mesmo tempo até ele migrar tudo pro novo e devolver
// o antigo manualmente depois, sem prazo fixo).
async function abrirTrocaEquipamentoFuncionarioTI(f) {
  const { value: formValues } = await Swal.fire({
    title: `Procedimento de troca — ${f.nome}`,
    html: `
      <div class="ti-swal-form">
        <p style="margin:0; font-size:13px; color:#666;">
          O funcionário vai ficar com o equipamento atual e o novo ao mesmo tempo, até migrar
          tudo e devolver o antigo (sem prazo fixo). Depois, devolva o equipamento antigo
          normalmente pela lista de equipamentos dele.
        </p>
        <label class="ti-swal-label">Equipamento que será substituído (referência)
          <select id="swal-ti-substituido" style="width:100%; margin-top:4px;">
            ${f.equipamentos.map((eq) => `<option value="${eq.idunidade}">${eq.descequip} — ${eq.patrimonio}</option>`).join("")}
          </select>
        </label>
        <label class="ti-swal-label">Novo equipamento (do estoque)
          ${montarCampoEquipamentoEstoqueSwal("swal-ti-equip-novo")}
        </label>
        <label class="ti-swal-label">Observação (opcional)
          <input type="text" id="swal-ti-observacao" class="swal2-input" style="margin:4px 0 0;">
        </label>
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: "Entregar novo equipamento",
    cancelButtonText: "Cancelar",
    reverseButtons: true,
    didOpen: () => ativarAutocompleteEquipamentoEstoqueSwal("swal-ti-equip-novo"),
    preConfirm: async () => {
      const idunidadeAntiga = Number(document.getElementById("swal-ti-substituido").value);
      const idunidadeNovo = lerEquipamentoEstoqueSwal("swal-ti-equip-novo");
      const observacao = document.getElementById("swal-ti-observacao").value.trim();
      if (!idunidadeNovo) {
        const termo = document.getElementById("swal-ti-equip-novo-input")?.value.trim();
        if (termo) {
          await avisarTagNaoCadastradaSwal("swal-ti-equip-novo");
        } else {
          Swal.showValidationMessage("Selecione o novo equipamento.");
        }
        return false;
      }
      return { idunidadeAntiga, idunidadeNovo, observacao };
    }
  });

  if (!formValues) return;

  try {
    // Numa transação só: entrega a nova unidade e marca a antiga como "aguardando
    // devolução, substituída por" — vínculo real no banco, não só uma observação.
    await fetchTI("/custodia/trocar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idunidade_antiga: formValues.idunidadeAntiga,
        idunidade_nova: formValues.idunidadeNovo,
        idfuncionario: f.idfuncionario,
        observacao: formValues.observacao,
      }),
    });
    await Swal.fire("Sucesso!", "Novo equipamento entregue. O equipamento antigo continua com ele até ser devolvido.", "success");
    renderAbaCustodia();
  } catch (erro) {
    console.error("Erro ao realizar troca:", erro);
    Swal.fire("Erro", erro.message || "Erro ao realizar troca.", "error");
  }
}

// Opção 3: enviar equipamento do funcionário para manutenção, com opção de máquina temporária
async function abrirManutencaoComTemporariaTI(f) {
  const { value: formValues } = await Swal.fire({
    title: `Manutenção — ${f.nome}`,
    html: `
      <div class="ti-swal-form">
        <div style="text-align:right;">
          <button type="button" id="ti-ver-historico-manutencao" class="secundario" style="font-size:12px; padding:4px 10px;">Histórico de manutenção deste funcionário</button>
        </div>
        <label class="ti-swal-label">Equipamento com problema
          <select id="swal-ti-manut-unidade" style="width:100%; margin-top:4px;">
            ${f.equipamentos.map((eq) => `<option value="${eq.idunidade}">${eq.descequip} — ${eq.patrimonio}</option>`).join("")}
          </select>
        </label>
        <label class="ti-swal-label">Justificativa / descrição do problema
          <textarea id="swal-ti-problema" class="swal2-textarea" rows="3" style="margin:4px 0 0;"></textarea>
        </label>
        <label class="ti-swal-label">Tipo de manutenção
          <select id="swal-ti-tipo-manutencao" class="swal2-select" style="margin:4px 0 0; width:100%;">
            <option value="interna">Interna (feita no escritório)</option>
            <option value="externa">Externa (assistência técnica)</option>
          </select>
        </label>
        ${montarCheckboxPadraoSwal("swal-ti-orcamento-feito", "Orçamento da manutenção já foi realizado")}
        <div id="swal-ti-orcamento-wrap" style="display:none; flex-direction:column; gap:14px;">
          <label class="ti-swal-label">Valor do orçamento
            <input type="text" id="swal-ti-orcamento-valor" class="swal2-input" oninput="formatReais(this)" style="margin:4px 0 0;">
          </label>
          <label class="ti-swal-label">Fornecedor / observações do orçamento
            <textarea id="swal-ti-orcamento-obs" class="swal2-textarea" rows="2" style="margin:4px 0 0;"></textarea>
          </label>
        </div>
        ${montarCheckboxPadraoSwal("swal-ti-temp-feito", `Atribuir máquina temporária a ${f.nome}`)}
        <label class="ti-swal-label" id="swal-ti-temp-wrap" style="display:none;">Máquina temporária (do estoque)
          ${montarCampoEquipamentoEstoqueSwal("swal-ti-equip-temp")}
        </label>
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: "Enviar para manutenção",
    cancelButtonText: "Cancelar",
    reverseButtons: true,
    didOpen: () => {
      document.getElementById("ti-ver-historico-manutencao")?.addEventListener("click", () => verHistoricoManutencaoFuncionarioTI(f.idfuncionario, f.nome));
      document.getElementById("swal-ti-orcamento-feito").addEventListener("change", (e) => {
        document.getElementById("swal-ti-orcamento-wrap").style.display = e.target.checked ? "flex" : "none";
      });
      document.getElementById("swal-ti-temp-feito").addEventListener("change", (e) => {
        document.getElementById("swal-ti-temp-wrap").style.display = e.target.checked ? "block" : "none";
        if (e.target.checked) ativarAutocompleteEquipamentoEstoqueSwal("swal-ti-equip-temp");
      });
    },
    preConfirm: async () => {
      const idunidade = document.getElementById("swal-ti-manut-unidade").value;
      const descricaoproblema = document.getElementById("swal-ti-problema").value.trim();
      const tipo_manutencao = document.getElementById("swal-ti-tipo-manutencao").value;
      const orcamento_realizado = document.getElementById("swal-ti-orcamento-feito").checked;
      const orcamento_valor = orcamento_realizado ? window.desformatarReais(document.getElementById("swal-ti-orcamento-valor").value) || null : null;
      const orcamento_obs = document.getElementById("swal-ti-orcamento-obs").value.trim();
      const temTemporaria = document.getElementById("swal-ti-temp-feito").checked;
      const idunidadeTemp = temTemporaria ? lerEquipamentoEstoqueSwal("swal-ti-equip-temp") : null;
      if (!idunidade) {
        Swal.showValidationMessage("Selecione o equipamento com problema.");
        return false;
      }
      if (!descricaoproblema) {
        Swal.showValidationMessage("Descreva o problema do equipamento.");
        return false;
      }
      if (temTemporaria && !idunidadeTemp) {
        const termo = document.getElementById("swal-ti-equip-temp-input")?.value.trim();
        if (termo) {
          await avisarTagNaoCadastradaSwal("swal-ti-equip-temp");
        } else {
          Swal.showValidationMessage("Selecione a máquina temporária ou desmarque a opção.");
        }
        return false;
      }
      return {
        idunidade: Number(idunidade), descricaoproblema, tipo_manutencao, orcamento_realizado, orcamento_valor, orcamento_obs,
        idunidadeTemp,
      };
    }
  });

  if (!formValues) return;

  try {
    // Manutenção + entrega da temporária acontecem numa transação só no backend —
    // se a temporária não puder ser entregue, a manutenção nem chega a ser registrada.
    await fetchTI("/manutencao", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idunidade: formValues.idunidade,
        descricaoproblema: formValues.descricaoproblema,
        tipo_manutencao: formValues.tipo_manutencao,
        orcamento_realizado: formValues.orcamento_realizado,
        orcamento_valor: formValues.orcamento_valor,
        orcamento_obs: formValues.orcamento_obs,
        idunidade_temporaria: formValues.idunidadeTemp,
      }),
    });

    await Swal.fire("Sucesso!", "Equipamento enviado para manutenção.", "success");
    renderAbaCustodia();
  } catch (erro) {
    console.error("Erro ao enviar para manutenção:", erro);
    Swal.fire("Erro", erro.message || "Erro ao enviar para manutenção.", "error");
  }
}

async function verHistoricoManutencaoFuncionarioTI(idfuncionario, nome) {
  try {
    const historico = await fetchTI(`/custodia/funcionario/${idfuncionario}/historico-manutencao`);
    const linhasHtml = historico.map((h) => {
      const dataFormatada = new Date(h.criado_em).toLocaleString("pt-BR");
      return `<li>${dataFormatada} — ${h.descequip} (${h.patrimonio})${h.observacao ? `: ${h.observacao}` : ""}</li>`;
    }).join("");

    Swal.fire({
      title: `Histórico de manutenção — ${nome}`,
      html: `<ul style="text-align:left; max-height:300px; overflow-y:auto;">${linhasHtml || "<li>Nenhuma máquina desse funcionário foi para manutenção ainda.</li>"}</ul>`,
    });
  } catch (erro) {
    console.error("Erro ao carregar histórico de manutenção do funcionário:", erro);
    Swal.fire("Erro", "Erro ao carregar histórico de manutenção do funcionário.", "error");
  }
}

async function enviarParaManutencaoTI(idunidade) {
  const { value: descricaoproblema, isConfirmed } = await Swal.fire({
    title: "Enviar para manutenção",
    input: "text",
    inputLabel: "Descrição do problema",
    showCancelButton: true,
    confirmButtonText: "Enviar",
    cancelButtonText: "Cancelar",
    reverseButtons: true,
    inputValidator: (valor) => (!valor || !valor.trim()) ? "Descreva o problema do equipamento." : undefined,
  });

  if (!isConfirmed) return;

  try {
    await fetchTI("/manutencao", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idunidade: Number(idunidade), descricaoproblema }),
    });
    await Swal.fire("Sucesso!", "Equipamento enviado para manutenção.", "success");
    renderAbaEstoque();
  } catch (erro) {
    console.error("Erro ao enviar para manutenção:", erro);
    Swal.fire("Erro", erro.message || "Erro ao enviar para manutenção.", "error");
  }
}

// ===== Manutenção =====
async function renderAbaManutencao(subaba = "fila") {
  const container = document.getElementById("ti-aba-manutencao");
  if (!container) return;

  container.innerHTML = `
    <div class="ti-subabas">
      <button type="button" class="ti-subaba-btn ${subaba === "fila" ? "ativo" : ""}" data-subaba="fila">Fila de manutenção</button>
      <button type="button" class="ti-subaba-btn ${subaba === "pendente" ? "ativo" : ""}" data-subaba="pendente">Orçamentos</button>
      <button type="button" class="ti-subaba-btn ${subaba === "aprovado" ? "ativo" : ""}" data-subaba="aprovado">Aprovados</button>
      <button type="button" class="ti-subaba-btn ${subaba === "reprovado" ? "ativo" : ""}" data-subaba="reprovado">Reprovados</button>
    </div>
    <div id="ti-manutencao-conteudo"></div>
  `;

  container.querySelectorAll(".ti-subaba-btn").forEach((btn) =>
    btn.addEventListener("click", () => renderAbaManutencao(btn.dataset.subaba))
  );

  if (subaba === "fila") await renderManutencaoFila();
  else await renderManutencaoOrcamentos(subaba);
}

async function renderManutencaoFila() {
  const container = document.getElementById("ti-manutencao-conteudo");
  if (!container) return;
  container.innerHTML = tiLoading("Carregando fila de manutenção...");

  try {
    const fila = await fetchTI("/manutencao");

    const statusLabel = { aguardando: "Aguardando", em_andamento: "Em andamento", concluida: "Concluída" };

    container.innerHTML = `
      <div class="ti-custodia-filtros">
        <button type="button" id="ti-btn-manutencao-manual">+ Enviar equipamento para manutenção</button>
      </div>
      <div id="ti-lista-manutencao">
        ${!fila.length ? tiVazio("Nenhum equipamento em manutenção.", "build") : fila.map((m) => `
          <div class="ti-card-linha ti-card-manutencao-${m.status}">
            <div class="ti-card-linha-topo">
              <span class="ti-card-linha-titulo">${m.descequip} — ${m.marca}${m.modelo ? ' / ' + m.modelo : ''}${m.patrimonio ? ' (' + m.patrimonio + ')' : ''}</span>
              <span>
                <span class="ti-badge-tipo-manutencao ti-badge-tipo-manutencao-${m.tipo_manutencao}">${m.tipo_manutencao === 'interna' ? 'Interna' : 'Externa'}</span>
                <span class="ti-badge-manutencao ti-badge-manutencao-${m.status}">${statusLabel[m.status] || m.status}</span>
              </span>
            </div>
            ${m.descricaoproblema ? `<div class="ti-card-linha-sub">${m.descricaoproblema}</div>` : ""}
            <div class="ti-card-linha-sub ${m.orcamento_realizado ? 'ti-orcamento-ok' : 'ti-orcamento-pendente'}">${m.orcamento_realizado
              ? `✅ Orçamento já realizado${m.orcamento_valor != null ? ' — R$ ' + Number(m.orcamento_valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : ''}${m.orcamento_obs ? ' — ' + m.orcamento_obs : ''}`
              : "⚠ Orçamento ainda não realizado"}</div>
            <div class="ti-card-linha-acoes">
              <button type="button" class="ti-btn-anexar-orcamento secundario" data-id="${m.idmanutencao}">Anexar orçamento</button>
              ${m.status !== "concluida" ? `<button type="button" class="ti-btn-concluir" data-id="${m.idmanutencao}">Concluir</button>` : ""}
            </div>
          </div>
        `).join("")}
      </div>
    `;

    document.getElementById("ti-btn-manutencao-manual")?.addEventListener("click", abrirManutencaoManualTI);

    container.querySelectorAll(".ti-btn-concluir").forEach((btn) =>
      btn.addEventListener("click", () => concluirManutencaoTI(btn.dataset.id))
    );
    container.querySelectorAll(".ti-btn-anexar-orcamento").forEach((btn) =>
      btn.addEventListener("click", () => abrirAnexarOrcamentoTI(btn.dataset.id))
    );
  } catch (erro) {
    console.error("Erro ao carregar fila de manutenção:", erro);
    container.innerHTML = tiVazio("Erro ao carregar fila de manutenção.", "error");
  }
}

// Anexa um orçamento (imagem/PDF) a uma manutenção, pra comparar entre fornecedores depois
async function abrirAnexarOrcamentoTI(idmanutencao) {
  const { value: formValues } = await Swal.fire({
    title: "Anexar orçamento de manutenção",
    html: `
      <div class="ti-swal-form">
        <label class="ti-swal-label">Fornecedor
          <input type="text" id="swal-ti-orc-fornecedor" class="swal2-input" style="margin:4px 0 0;">
        </label>
        <label class="ti-swal-label">Valor
          <input type="text" id="swal-ti-orc-valor" value="R$ 0,00" class="swal2-input" oninput="formatReais(this)" style="margin:4px 0 0;">
        </label>
        <label class="ti-swal-label">Descrição (opcional)
          <textarea id="swal-ti-orc-descricao" class="swal2-textarea" rows="2" style="margin:4px 0 0;"></textarea>
        </label>
        <label class="ti-swal-label">Arquivo (imagem ou PDF)
          ${montarCampoUploadSwal("swal-ti-orc-arquivo")}
        </label>
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: "Salvar orçamento",
    cancelButtonText: "Cancelar",
    reverseButtons: true,
    didOpen: () => ativarCampoUploadSwal("swal-ti-orc-arquivo"),
    preConfirm: () => {
      const fornecedor = document.getElementById("swal-ti-orc-fornecedor").value.trim();
      const valor = window.desformatarReais(document.getElementById("swal-ti-orc-valor").value) || null;
      const descricao = document.getElementById("swal-ti-orc-descricao").value.trim();
      const arquivo = document.getElementById("swal-ti-orc-arquivo").files[0];
      if (!arquivo) {
        Swal.showValidationMessage("Anexe o arquivo do orçamento.");
        return false;
      }
      return { fornecedor, valor, descricao, arquivo };
    }
  });

  if (!formValues) return;

  try {
    const dados = new FormData();
    dados.append("idmanutencao", idmanutencao);
    dados.append("fornecedor", formValues.fornecedor);
    if (formValues.valor != null) dados.append("valor", formValues.valor);
    dados.append("descricao", formValues.descricao);
    dados.append("arquivo", formValues.arquivo);

    await fetchTI("/orcamentos-compra", { method: "POST", body: dados });
    await Swal.fire("Sucesso!", "Orçamento anexado.", "success");
    renderAbaManutencao("pendente");
  } catch (erro) {
    console.error("Erro ao anexar orçamento:", erro);
    Swal.fire("Erro", erro.message || "Erro ao anexar orçamento.", "error");
  }
}

// ===== Orçamentos de manutenção (Orçamentos / Aprovados / Reprovados) =====

function podeAprovarOrcamentoTI() {
  return (window.temPermissao?.("Staff", "master") ?? false) || (window.temPermissao?.("Staff", "supremo") ?? false);
}

function montarCheckboxOrcamentoTI(idorcamento) {
  return `
    <label class="ios-checkbox ti-check-orcamento-wrap">
      <input type="checkbox" class="ti-check-orcamento" data-id="${idorcamento}">
      <div class="checkbox-wrapper">
        <div class="checkbox-bg"></div>
        <svg fill="none" viewBox="0 0 24 24" class="checkbox-icon">
          <path stroke-linejoin="round" stroke-linecap="round" stroke-width="3" stroke="currentColor" d="M4 12L10 18L20 6" class="check-path"></path>
        </svg>
      </div>
    </label>
  `;
}

async function renderManutencaoOrcamentos(status) {
  const container = document.getElementById("ti-manutencao-conteudo");
  if (!container) return;
  container.innerHTML = tiLoading("Carregando orçamentos...");

  try {
    const orcamentos = await fetchTI(`/orcamentos-compra?status=${status}`);
    const podeAprovar = podeAprovarOrcamentoTI();

    const tituloVazio = { pendente: "Nenhum orçamento aguardando aprovação.", aprovado: "Nenhum orçamento aprovado ainda.", reprovado: "Nenhum orçamento reprovado." };

    // Agrupa por manutenção — várias cotações do mesmo equipamento ficam juntas pra comparar.
    const grupos = [];
    const grupoPorManutencao = new Map();
    orcamentos.forEach((o) => {
      if (!grupoPorManutencao.has(o.idmanutencao)) {
        const grupo = { idmanutencao: o.idmanutencao, descequip: o.descequip, patrimonio: o.patrimonio, marca: o.marca, modelo: o.modelo, itens: [] };
        grupoPorManutencao.set(o.idmanutencao, grupo);
        grupos.push(grupo);
      }
      grupoPorManutencao.get(o.idmanutencao).itens.push(o);
    });

    container.innerHTML = `
      ${status === "pendente" ? `
        <div class="ti-custodia-filtros">
          <button type="button" id="ti-btn-enviar-aprovacao" class="secundario" disabled>Enviar selecionados para aprovação</button>
        </div>
      ` : ""}
      <div id="ti-lista-orcamentos">
        ${!orcamentos.length ? tiVazio(tituloVazio[status], "request_quote") : grupos.map((g) => `
          <div class="ti-card-linha">
            <div class="ti-card-linha-topo">
              <span class="ti-card-linha-titulo">${g.descequip}${g.patrimonio ? ' (' + g.patrimonio + ')' : ''}${g.marca ? ' — ' + g.marca : ''}${g.modelo ? '/' + g.modelo : ''}</span>
              <span class="ti-card-linha-stat">${g.itens.length} orçamento(s)</span>
            </div>
            <div class="ti-card-linha-acoes">
              <button type="button" class="ti-btn-novo-orcamento secundario" data-idmanutencao="${g.idmanutencao}">+ Novo orçamento</button>
            </div>
            <div class="ti-card-linha-detalhe">
              ${g.itens.map((o) => `
                <div class="ti-modelo-linha">
                  <span>
                    ${status === "pendente" ? montarCheckboxOrcamentoTI(o.idorcamento) : ""}
                    <strong>${o.fornecedor || "Fornecedor não informado"}</strong>
                    — ${o.valor != null ? "R$ " + Number(o.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "valor não informado"}
                    ${o.descricao ? " — " + o.descricao : ""}
                    · <a href="/uploads/ti/orcamentos-equipamento/${o.arquivo}" target="_blank">Ver arquivo</a>
                  </span>
                  <span class="ti-orcamento-linha-acoes">
                    ${status === "aprovado" ? `<span class="ti-orcamento-ok">✅ Aprovado por ${o.nome_decisao || "e-mail"} em ${new Date(o.data_decisao).toLocaleDateString("pt-BR")}</span>` : ""}
                    ${status === "reprovado" ? `<span class="ti-orcamento-pendente">⚠ Recusado por ${o.nome_decisao || "e-mail"}${o.motivo_recusa ? " — " + o.motivo_recusa : ""}</span>` : ""}
                    ${status === "pendente" ? (podeAprovar ? `
                      <button type="button" class="ti-btn-aprovar-orcamento" data-id="${o.idorcamento}">Aprovar</button>
                      <button type="button" class="ti-btn-recusar-orcamento secundario" data-id="${o.idorcamento}">Recusar</button>
                    ` : `<span class="ti-badge-manutencao ti-badge-manutencao-aguardando">Aguardando resposta de um master/supremo</span>`) : ""}
                  </span>
                </div>
              `).join("")}
            </div>
          </div>
        `).join("")}
      </div>
    `;

    if (status === "pendente") {
      const btnEnviar = document.getElementById("ti-btn-enviar-aprovacao");
      container.querySelectorAll(".ti-check-orcamento").forEach((chk) =>
        chk.addEventListener("change", () => {
          const marcados = container.querySelectorAll(".ti-check-orcamento:checked").length;
          btnEnviar.disabled = marcados === 0;
        })
      );
      btnEnviar?.addEventListener("click", () => {
        const ids = Array.from(container.querySelectorAll(".ti-check-orcamento:checked")).map((c) => Number(c.dataset.id));
        abrirEnviarAprovacaoTI(ids);
      });

      container.querySelectorAll(".ti-btn-aprovar-orcamento").forEach((btn) =>
        btn.addEventListener("click", () => decidirOrcamentoTI(btn.dataset.id, "aprovado"))
      );
      container.querySelectorAll(".ti-btn-recusar-orcamento").forEach((btn) =>
        btn.addEventListener("click", () => decidirOrcamentoTI(btn.dataset.id, "reprovado"))
      );
    }

    container.querySelectorAll(".ti-btn-novo-orcamento").forEach((btn) =>
      btn.addEventListener("click", () => abrirAnexarOrcamentoTI(btn.dataset.idmanutencao))
    );
  } catch (erro) {
    console.error("Erro ao carregar orçamentos:", erro);
    container.innerHTML = tiVazio("Erro ao carregar orçamentos.", "error");
  }
}

async function decidirOrcamentoTI(idorcamento, status) {
  let motivo_recusa = null;

  if (status === "reprovado") {
    const { value, isConfirmed } = await Swal.fire({
      title: "Recusar orçamento",
      input: "text",
      inputLabel: "Motivo (opcional)",
      showCancelButton: true,
      confirmButtonText: "Recusar",
      cancelButtonText: "Cancelar",
      reverseButtons: true,
    });
    if (!isConfirmed) return;
    motivo_recusa = value;
  } else {
    const { isConfirmed } = await Swal.fire({
      title: "Aprovar este orçamento?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sim, aprovar",
      cancelButtonText: "Cancelar",
      reverseButtons: true,
    });
    if (!isConfirmed) return;
  }

  try {
    await fetchTI(`/orcamentos-compra/${idorcamento}/decisao`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, motivo_recusa }),
    });
    await Swal.fire("Sucesso!", "Decisão registrada.", "success");
    renderAbaManutencao("pendente");
  } catch (erro) {
    console.error("Erro ao registrar decisão do orçamento:", erro);
    Swal.fire("Erro", erro.message || "Erro ao registrar decisão. Só master/supremo pode decidir por aqui.", "error");
  }
}

async function abrirEnviarAprovacaoTI(idorcamentos) {
  let sugeridos = [];
  try {
    sugeridos = await fetchTI("/orcamentos-compra/aprovadores-sugeridos");
  } catch (erro) {
    console.error("Erro ao buscar aprovadores sugeridos:", erro);
  }

  const { value: emailsTexto } = await Swal.fire({
    title: `Enviar ${idorcamentos.length} orçamento(s) para aprovação`,
    html: `
      <div class="ti-swal-form">
        <label class="ti-swal-label">E-mails dos aprovadores (separados por vírgula)
          <textarea id="swal-ti-emails-aprovacao" class="swal2-textarea" rows="3" style="margin:4px 0 0;">${sugeridos.map((s) => s.email).join(", ")}</textarea>
        </label>
        <p style="font-size:12px; color:#777; margin:0;">Cada aprovador recebe um link para aprovar ou recusar cada orçamento direto do e-mail, sem precisar logar no sistema.</p>
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: "Enviar",
    cancelButtonText: "Cancelar",
    reverseButtons: true,
    preConfirm: () => {
      const texto = document.getElementById("swal-ti-emails-aprovacao").value.trim();
      const emails = texto.split(",").map((e) => e.trim()).filter(Boolean);
      if (!emails.length) {
        Swal.showValidationMessage("Informe ao menos um e-mail.");
        return false;
      }
      return emails;
    }
  });

  if (!emailsTexto) return;

  try {
    await fetchTI("/orcamentos-compra/enviar-aprovacao", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idorcamentos, emails: emailsTexto }),
    });
    await Swal.fire("Sucesso!", "E-mail de aprovação enviado.", "success");
    renderAbaManutencao("pendente");
  } catch (erro) {
    console.error("Erro ao enviar orçamentos para aprovação:", erro);
    Swal.fire("Erro", erro.message || "Erro ao enviar e-mail.", "error");
  }
}

async function abrirManutencaoManualTI() {
  const { value: formValues } = await Swal.fire({
    title: "Enviar equipamento para manutenção",
    html: `
      <div class="ti-swal-form">
        <label class="ti-swal-label">Equipamento
          ${montarCampoEquipamentoEstoqueSwal("swal-ti-equipamento")}
        </label>
        <label class="ti-swal-label">Justificativa / descrição do problema
          <textarea id="swal-ti-problema" class="swal2-textarea" rows="3" style="margin:4px 0 0;"></textarea>
        </label>
        <label class="ti-swal-label">Tipo de manutenção
          <select id="swal-ti-tipo-manutencao" class="swal2-select" style="margin:4px 0 0; width:100%;">
            <option value="interna">Interna (feita no escritório)</option>
            <option value="externa">Externa (assistência técnica)</option>
          </select>
        </label>
        ${montarCheckboxPadraoSwal("swal-ti-orcamento-feito", "Orçamento da manutenção já foi realizado")}
        <div id="swal-ti-orcamento-wrap" style="display:none; flex-direction:column; gap:14px;">
          <label class="ti-swal-label">Valor do orçamento
            <input type="text" id="swal-ti-orcamento-valor" class="swal2-input" oninput="formatReais(this)" style="margin:4px 0 0;">
          </label>
          <label class="ti-swal-label">Fornecedor / observações do orçamento
            <textarea id="swal-ti-orcamento-obs" class="swal2-textarea" rows="2" style="margin:4px 0 0;"></textarea>
          </label>
        </div>
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: "Enviar",
    cancelButtonText: "Cancelar",
    reverseButtons: true,
    didOpen: () => {
      ativarAutocompleteEquipamentoEstoqueSwal("swal-ti-equipamento");
      document.getElementById("swal-ti-orcamento-feito").addEventListener("change", (e) => {
        document.getElementById("swal-ti-orcamento-wrap").style.display = e.target.checked ? "flex" : "none";
      });
    },
    preConfirm: async () => {
      const idunidade = lerEquipamentoEstoqueSwal("swal-ti-equipamento");
      const descricaoproblema = document.getElementById("swal-ti-problema").value.trim();
      const tipo_manutencao = document.getElementById("swal-ti-tipo-manutencao").value;
      const orcamento_realizado = document.getElementById("swal-ti-orcamento-feito").checked;
      const orcamento_valor = orcamento_realizado ? window.desformatarReais(document.getElementById("swal-ti-orcamento-valor").value) || null : null;
      const orcamento_obs = document.getElementById("swal-ti-orcamento-obs").value.trim();
      if (!idunidade) {
        const termo = document.getElementById("swal-ti-equipamento-input")?.value.trim();
        if (termo) {
          await avisarTagNaoCadastradaSwal("swal-ti-equipamento");
        } else {
          Swal.showValidationMessage("Selecione o equipamento.");
        }
        return false;
      }
      if (!descricaoproblema) {
        Swal.showValidationMessage("Descreva o problema do equipamento.");
        return false;
      }
      return { idunidade, descricaoproblema, tipo_manutencao, orcamento_realizado, orcamento_valor, orcamento_obs };
    }
  });

  if (!formValues) return;

  try {
    await fetchTI("/manutencao", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formValues),
    });
    await Swal.fire("Sucesso!", "Equipamento enviado para manutenção.", "success");
    renderAbaManutencao();
  } catch (erro) {
    console.error("Erro ao enviar para manutenção:", erro);
    Swal.fire("Erro", erro.message || "Erro ao enviar para manutenção.", "error");
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

// ===== Almoxarifado (consumíveis de TI: ribbon, etiqueta, papel A4, tinta etc) =====
// Diferente de Estoque (unidades únicas com patrimônio), aqui é só quantidade —
// item vai sendo consumido aos poucos e precisa ser reposto de tempos em tempos.
async function renderAbaAlmoxarifado() {
  const container = document.getElementById("ti-aba-almoxarifado");
  if (!container) return;
  container.innerHTML = tiLoading("Carregando almoxarifado...");

  try {
    const itens = await fetchTI("/almoxarifado");
    cacheConsumiveis = itens;

    const renderGrid = (lista) => `
      ${!lista.length ? tiVazio("Nenhum item encontrado.", "inventory") : `
        <div id="ti-cards-almoxarifado" class="ti-grid-quadrado">
          ${lista.map((item) => `
            <div class="ti-card-quadrado ti-card-clicavel" data-idconsumivel="${item.idconsumivel}"
                 data-busca="${item.descricao}" title="Clique para repor, consumir ou ver o histórico">
              <span class="ti-card-quadrado-nome">${item.abaixo_minimo ? "⚠ " : ""}${item.descricao}</span>
              <strong class="ti-card-quadrado-qtd">${item.quantidade_atual}</strong>
              <span class="ti-card-quadrado-legenda">${item.unidade_medida}(s) — mín: ${item.estoque_minimo}</span>
            </div>
          `).join("")}
        </div>
      `}
    `;

    const bindCards = () => {
      container.querySelectorAll(".ti-card-quadrado").forEach((card) =>
        card.addEventListener("click", () => abrirDetalheConsumivelTI(Number(card.dataset.idconsumivel)))
      );
    };

    container.innerHTML = `
      <div class="ti-custodia-filtros">
        <input type="text" id="ti-busca-almoxarifado" class="ti-input-busca" placeholder="Buscar item pelo nome...">
        <button type="button" id="ti-btn-novo-consumivel">+ Cadastrar item</button>
      </div>
      <div id="ti-lista-almoxarifado" style="margin-top:20px;">${renderGrid(itens)}</div>
    `;

    document.getElementById("ti-btn-novo-consumivel")?.addEventListener("click", abrirCadastroConsumivelTI);
    bindCards();

    document.getElementById("ti-busca-almoxarifado")?.addEventListener("input", (e) => {
      const termo = e.target.value.trim().toLowerCase();
      const filtrados = itens.filter((item) => item.descricao.toLowerCase().includes(termo));
      document.getElementById("ti-lista-almoxarifado").innerHTML = renderGrid(filtrados);
      bindCards();
    });
  } catch (erro) {
    console.error("Erro ao carregar almoxarifado:", erro);
    container.innerHTML = tiVazio("Erro ao carregar almoxarifado.", "error");
  }
}

async function abrirCadastroConsumivelTI() {
  const { value: formValues } = await Swal.fire({
    title: "Cadastrar item no almoxarifado",
    html: `
      <div class="ti-swal-form">
        <label class="ti-swal-label">Descrição
          <input type="text" id="swal-ti-consumivel-descricao" class="swal2-input" placeholder="Ex: Ribbon, Etiqueta, Papel A4..." style="margin:4px 0 0;">
        </label>
        <label class="ti-swal-label">Unidade de medida
          <input type="text" id="swal-ti-consumivel-unidade" class="swal2-input" placeholder="Ex: unidade, caixa, rolo, folha..." value="unidade" style="margin:4px 0 0;">
        </label>
        <label class="ti-swal-label">Quantidade inicial
          <input type="number" id="swal-ti-consumivel-qtd" class="swal2-input" min="0" value="0" style="margin:4px 0 0;">
        </label>
        <label class="ti-swal-label">Estoque mínimo (dispara alerta quando bater)
          <input type="number" id="swal-ti-consumivel-minimo" class="swal2-input" min="0" value="0" style="margin:4px 0 0;">
        </label>
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: "Cadastrar",
    cancelButtonText: "Cancelar",
    reverseButtons: true,
    preConfirm: () => {
      const descricao = document.getElementById("swal-ti-consumivel-descricao").value.trim();
      const unidade_medida = document.getElementById("swal-ti-consumivel-unidade").value.trim() || "unidade";
      const quantidade_atual = parseInt(document.getElementById("swal-ti-consumivel-qtd").value, 10) || 0;
      const estoque_minimo = parseInt(document.getElementById("swal-ti-consumivel-minimo").value, 10) || 0;
      if (!descricao) {
        Swal.showValidationMessage("Descreva o item.");
        return false;
      }
      return { descricao, unidade_medida, quantidade_atual, estoque_minimo };
    }
  });

  if (!formValues) return;

  try {
    await fetchTI("/almoxarifado", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formValues),
    });
    await Swal.fire("Sucesso!", "Item cadastrado no almoxarifado.", "success");
    renderAbaAlmoxarifado();
  } catch (erro) {
    console.error("Erro ao cadastrar item do almoxarifado:", erro);
    Swal.fire("Erro", erro.message || "Erro ao cadastrar item.", "error");
  }
}

async function abrirEditarConsumivelTI(id, descricaoAtual, unidadeAtual, minimoAtual) {
  const { value: formValues } = await Swal.fire({
    title: "Editar item do almoxarifado",
    html: `
      <div class="ti-swal-form">
        <label class="ti-swal-label">Descrição
          <input type="text" id="swal-ti-consumivel-descricao" class="swal2-input" value="${descricaoAtual}" style="margin:4px 0 0;">
        </label>
        <label class="ti-swal-label">Unidade de medida
          <input type="text" id="swal-ti-consumivel-unidade" class="swal2-input" value="${unidadeAtual}" style="margin:4px 0 0;">
        </label>
        <label class="ti-swal-label">Estoque mínimo
          <input type="number" id="swal-ti-consumivel-minimo" class="swal2-input" min="0" value="${minimoAtual}" style="margin:4px 0 0;">
        </label>
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: "Salvar",
    cancelButtonText: "Cancelar",
    reverseButtons: true,
    preConfirm: () => {
      const descricao = document.getElementById("swal-ti-consumivel-descricao").value.trim();
      const unidade_medida = document.getElementById("swal-ti-consumivel-unidade").value.trim() || "unidade";
      const estoque_minimo = parseInt(document.getElementById("swal-ti-consumivel-minimo").value, 10) || 0;
      if (!descricao) {
        Swal.showValidationMessage("Descreva o item.");
        return false;
      }
      return { descricao, unidade_medida, estoque_minimo };
    }
  });

  if (!formValues) return;

  try {
    await fetchTI(`/almoxarifado/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formValues),
    });
    renderAbaAlmoxarifado();
  } catch (erro) {
    console.error("Erro ao editar item do almoxarifado:", erro);
    Swal.fire("Erro", erro.message || "Erro ao editar item.", "error");
  }
}

// Detalhe do item de almoxarifado — igual ao clique numa categoria do Estoque
// (montarSwalModelosCategoria), mas com as ações do consumível.
async function abrirDetalheConsumivelTI(idconsumivel) {
  const item = cacheConsumiveis.find((i) => i.idconsumivel === idconsumivel);
  if (!item) return;

  await Swal.fire({
    title: item.descricao,
    html: `
      <div class="ti-swal-modelo-numeros">
        <div><strong>${item.quantidade_atual}</strong><span>${item.unidade_medida}(s) em estoque</span></div>
        <div><strong>${item.estoque_minimo}</strong><span>estoque mínimo</span></div>
      </div>
      ${item.abaixo_minimo ? '<p style="color:#a11919; font-weight:600; text-align:center; margin:10px 0 0;">⚠ Abaixo do estoque mínimo</p>' : ""}
      <div class="ti-swal-modelo-acoes" style="justify-content:center; margin-top:16px;">
        <button type="button" id="ti-detalhe-repor">Repor</button>
        <button type="button" id="ti-detalhe-consumir" class="secundario">Consumir</button>
        <button type="button" id="ti-detalhe-editar" class="secundario">Editar</button>
        <button type="button" id="ti-detalhe-historico" class="secundario">Histórico</button>
      </div>
    `,
    showConfirmButton: false,
    showCloseButton: true,
    didOpen: () => {
      document.getElementById("ti-detalhe-repor").addEventListener("click", () => {
        Swal.close();
        abrirMovimentacaoConsumivelTI(item.idconsumivel, item.descricao, item.unidade_medida, "entrada");
      });
      document.getElementById("ti-detalhe-consumir").addEventListener("click", () => {
        Swal.close();
        abrirMovimentacaoConsumivelTI(item.idconsumivel, item.descricao, item.unidade_medida, "saida", item.quantidade_atual);
      });
      document.getElementById("ti-detalhe-editar").addEventListener("click", () => {
        Swal.close();
        abrirEditarConsumivelTI(item.idconsumivel, item.descricao, item.unidade_medida, item.estoque_minimo);
      });
      document.getElementById("ti-detalhe-historico").addEventListener("click", () => {
        Swal.close();
        verHistoricoConsumivelTI(item.idconsumivel, item.descricao);
      });
    },
  });
}

async function abrirMovimentacaoConsumivelTI(id, descricao, unidade, tipo, quantidadeAtual) {
  const titulo = tipo === "entrada" ? `Repor — ${descricao}` : `Consumir — ${descricao}`;
  const { value: formValues } = await Swal.fire({
    title: titulo,
    html: `
      <div class="ti-swal-form">
        <label class="ti-swal-label">Quantidade (${unidade})${tipo === "saida" ? ` — disponível: ${quantidadeAtual}` : ""}
          <input type="number" id="swal-ti-consumivel-mov-qtd" class="swal2-input" min="1" value="1" style="margin:4px 0 0;">
        </label>
        <label class="ti-swal-label">Retirando para (opcional — deixe em branco se for para uso próprio)
          <input type="text" id="swal-ti-consumivel-mov-funcionario-busca" class="swal2-input" placeholder="Buscar funcionário por nome..." autocomplete="off" style="margin:4px 0 0;">
          <input type="hidden" id="swal-ti-consumivel-mov-funcionario">
        </label>
        <label class="ti-swal-label">Motivo (opcional)
          <input type="text" id="swal-ti-consumivel-mov-motivo" class="swal2-input" style="margin:4px 0 0;">
        </label>
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: tipo === "entrada" ? "Repor" : "Consumir",
    cancelButtonText: "Cancelar",
    reverseButtons: true,
    didOpen: () => {
      const inputBusca = document.getElementById("swal-ti-consumivel-mov-funcionario-busca");
      const inputOculto = document.getElementById("swal-ti-consumivel-mov-funcionario");
      ligarBuscaComSugestoes(
        inputBusca,
        "swal-ti-consumivel-mov-funcionario-lista",
        (termo) => fetchTI(`/funcionarios/busca?busca=${encodeURIComponent(termo)}`),
        (f) => f.nome,
        (f) => {
          inputBusca.value = f.nome;
          inputOculto.value = f.idfuncionario;
        },
        { mensagemVazia: "Nenhum funcionário encontrado" }
      );
      inputBusca.addEventListener("input", () => {
        if (!inputBusca.value.trim()) inputOculto.value = "";
      });
    },
    preConfirm: () => {
      const quantidade = parseInt(document.getElementById("swal-ti-consumivel-mov-qtd").value, 10);
      const motivo = document.getElementById("swal-ti-consumivel-mov-motivo").value.trim();
      const idfuncionario_solicitante = document.getElementById("swal-ti-consumivel-mov-funcionario").value || null;
      if (!Number.isInteger(quantidade) || quantidade <= 0) {
        Swal.showValidationMessage("Informe uma quantidade válida.");
        return false;
      }
      return { quantidade, motivo, idfuncionario_solicitante };
    }
  });

  if (!formValues) return;

  try {
    await fetchTI(`/almoxarifado/${id}/movimentacao`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo,
        quantidade: formValues.quantidade,
        motivo: formValues.motivo,
        idfuncionario_solicitante: formValues.idfuncionario_solicitante,
      }),
    });
    renderAbaAlmoxarifado();
  } catch (erro) {
    console.error("Erro ao movimentar item do almoxarifado:", erro);
    Swal.fire("Erro", erro.message || "Erro ao registrar movimentação.", "error");
  }
}

function montarQueryHistoricoAlmoxarifado(filtros) {
  const params = new URLSearchParams();
  if (filtros.data_inicio) params.set("data_inicio", filtros.data_inicio);
  if (filtros.data_fim) params.set("data_fim", filtros.data_fim);
  if (filtros.idusuario) params.set("idusuario", filtros.idusuario);
  if (filtros.idfuncionario_solicitante) params.set("idfuncionario_solicitante", filtros.idfuncionario_solicitante);
  return params.toString();
}

function renderLinhasHistoricoAlmoxarifado(historico) {
  const tipoLabel = { entrada: "Reposição", saida: "Consumo" };
  if (!historico.length) {
    return `<tr><td colspan="5" style="text-align:center; color:#888;">Nenhuma movimentação encontrada.</td></tr>`;
  }
  return historico.map((h) => {
    const motivoResumo = h.motivo && h.motivo.length > 30 ? `${h.motivo.slice(0, 30)}…` : h.motivo;
    return `
    <tr>
      <td>${new Date(h.criado_em).toLocaleString("pt-BR")}</td>
      <td>${tipoLabel[h.tipo] || h.tipo} de ${h.quantidade}</td>
      <td>${escaparHtml(h.nome_usuario) || "—"}</td>
      <td>${escaparHtml(h.nome_funcionario_solicitante) || "—"}</td>
      <td>${h.motivo ? `<button type="button" class="ti-btn-ver-motivo secundario" data-idmovimentacao="${h.idmovimentacao}">${escaparHtml(motivoResumo)}</button>` : "—"}</td>
    </tr>
  `;
  }).join("");
}

// Igual ao padrão de filtro do Estoque/Equipamentos (filtro-grupo + busca-evento-input),
// só que inline dentro da própria aba Almoxarifado em vez de um Swal.
async function verHistoricoConsumivelTI(id, descricao) {
  const container = document.getElementById("ti-aba-almoxarifado");
  if (!container) return;

  container.innerHTML = `
    <div class="ti-custodia-filtros" style="margin-bottom:16px;">
      <button type="button" id="ti-hist-voltar" class="secundario">← Voltar ao almoxarifado</button>
    </div>
    <div class="Evt-container">
      <h3 style="margin:0 0 16px;">Histórico — ${descricao}</h3>
      <div style="display:flex; gap:20px; flex-wrap:wrap; align-items:flex-end;">
        <div class="filtro-grupo">
          <label class="label-select">De</label>
          <input type="date" id="ti-hist-data-inicio" class="busca-evento-input" style="width:150px;">
        </div>
        <div class="filtro-grupo">
          <label class="label-select">Até</label>
          <input type="date" id="ti-hist-data-fim" class="busca-evento-input" style="width:150px;">
        </div>
        <div class="filtro-grupo">
          <label class="label-select">Usuário</label>
          <div class="wrapper select-wrapper busca-evento-wrapper" style="width:220px;">
            <input type="text" id="ti-hist-usuario-busca" class="busca-evento-input" placeholder="Buscar usuário..." autocomplete="off">
            <input type="hidden" id="ti-hist-usuario">
          </div>
        </div>
        <div class="filtro-grupo">
          <label class="label-select">Funcionário</label>
          <div class="wrapper select-wrapper busca-evento-wrapper" style="width:220px;">
            <input type="text" id="ti-hist-funcionario-busca" class="busca-evento-input" placeholder="Buscar funcionário..." autocomplete="off">
            <input type="hidden" id="ti-hist-funcionario">
          </div>
        </div>
        <div class="ti-custodia-filtros filtro-grupo">
          <button type="button" id="ti-hist-filtrar">Filtrar</button>
          <button type="button" id="ti-hist-limpar" class="secundario">Limpar</button>
        </div>
      </div>
    </div>
    <table class="ti-tabela" style="margin-top:20px;">
      <thead><tr><th>Data</th><th>Movimentação</th><th>Usuário</th><th>Funcionário</th><th>Motivo</th></tr></thead>
      <tbody id="ti-hist-tbody"><tr><td colspan="5">Carregando...</td></tr></tbody>
    </table>
  `;

  document.getElementById("ti-hist-voltar").addEventListener("click", renderAbaAlmoxarifado);

  let historicoAtual = [];
  document.getElementById("ti-hist-tbody").addEventListener("click", (e) => {
    const btn = e.target.closest(".ti-btn-ver-motivo");
    if (!btn) return;
    const item = historicoAtual.find((h) => String(h.idmovimentacao) === btn.dataset.idmovimentacao);
    if (!item) return;
    Swal.fire({ title: "Motivo", html: `<p style="text-align:left; white-space:pre-wrap;">${escaparHtml(item.motivo)}</p>` });
  });

  const tbody = document.getElementById("ti-hist-tbody");
  const inputUsuarioBusca = document.getElementById("ti-hist-usuario-busca");
  const inputUsuarioOculto = document.getElementById("ti-hist-usuario");
  const inputFuncionarioBusca = document.getElementById("ti-hist-funcionario-busca");
  const inputFuncionarioOculto = document.getElementById("ti-hist-funcionario");

  ligarBuscaComSugestoes(
    inputUsuarioBusca,
    "ti-hist-usuario-lista",
    (termo) => fetchTI(`/usuarios/busca?busca=${encodeURIComponent(termo)}`),
    (u) => u.nome,
    (u) => { inputUsuarioBusca.value = u.nome; inputUsuarioOculto.value = u.idusuario; },
    { mensagemVazia: "Nenhum usuário encontrado" }
  );
  inputUsuarioBusca.addEventListener("input", () => { if (!inputUsuarioBusca.value.trim()) inputUsuarioOculto.value = ""; });

  ligarBuscaComSugestoes(
    inputFuncionarioBusca,
    "ti-hist-funcionario-lista",
    (termo) => fetchTI(`/funcionarios/busca?busca=${encodeURIComponent(termo)}`),
    (f) => f.nome,
    (f) => { inputFuncionarioBusca.value = f.nome; inputFuncionarioOculto.value = f.idfuncionario; },
    { mensagemVazia: "Nenhum funcionário encontrado" }
  );
  inputFuncionarioBusca.addEventListener("input", () => { if (!inputFuncionarioBusca.value.trim()) inputFuncionarioOculto.value = ""; });

  const carregar = async () => {
    tbody.innerHTML = `<tr><td colspan="5">Carregando...</td></tr>`;
    try {
      const query = montarQueryHistoricoAlmoxarifado({
        data_inicio: document.getElementById("ti-hist-data-inicio").value,
        data_fim: document.getElementById("ti-hist-data-fim").value,
        idusuario: inputUsuarioOculto.value,
        idfuncionario_solicitante: inputFuncionarioOculto.value,
      });
      const historico = await fetchTI(`/almoxarifado/${id}/movimentacoes${query ? `?${query}` : ""}`);
      historicoAtual = historico;
      tbody.innerHTML = renderLinhasHistoricoAlmoxarifado(historico);
    } catch (erro) {
      console.error("Erro ao carregar histórico do consumível:", erro);
      tbody.innerHTML = `<tr><td colspan="5" style="color:#a11919;">Erro ao carregar histórico.</td></tr>`;
    }
  };

  document.getElementById("ti-hist-filtrar").addEventListener("click", carregar);
  document.getElementById("ti-hist-limpar").addEventListener("click", () => {
    document.getElementById("ti-hist-data-inicio").value = "";
    document.getElementById("ti-hist-data-fim").value = "";
    inputUsuarioBusca.value = "";
    inputUsuarioOculto.value = "";
    inputFuncionarioBusca.value = "";
    inputFuncionarioOculto.value = "";
    carregar();
  });

  carregar();
}

// ===== E-mails corporativos (dashboard por área + cadastro/troca de senha e funcionário) =====
let cacheAreasEmail = [];

async function renderAbaEmails() {
  const container = document.getElementById("ti-aba-E-mails");
  if (!container) return;
  container.innerHTML = tiLoading("Carregando áreas...");

  try {
    const areas = await fetchTI("/emails/areas");
    cacheAreasEmail = areas;

    container.innerHTML = `
      <div class="ti-custodia-filtros">
        <button type="button" id="ti-btn-nova-area-email" class="secundario">+ Nova área</button>
        <button type="button" id="ti-btn-novo-email">+ Cadastrar e-mail</button>
      </div>
      ${!areas.length ? tiVazio("Nenhuma área cadastrada ainda.", "email") : `
        <div id="ti-cards-areas-email" class="ti-grid-quadrado">
          ${areas.map((a) => `
            <div class="ti-card-quadrado ti-card-clicavel" data-idarea="${a.idarea}" title="Clique para ver os e-mails dessa área">
              <button type="button" class="ti-card-quadrado-editar" data-idarea="${a.idarea}" data-nome="${a.nome}" title="Editar nome da área">
                <span class="material-symbols-outlined">edit</span>
              </button>
              <span class="ti-card-quadrado-nome">${a.nome}</span>
              <strong class="ti-card-quadrado-qtd">${a.total_emails}</strong>
              <span class="ti-card-quadrado-legenda">e-mail(s)</span>
            </div>
          `).join("")}
        </div>
      `}
    `;

    document.getElementById("ti-btn-nova-area-email")?.addEventListener("click", abrirNovaAreaEmailTI);
    document.getElementById("ti-btn-novo-email")?.addEventListener("click", () => abrirCadastrarEmailTI());
    container.querySelectorAll(".ti-card-quadrado").forEach((card) =>
      card.addEventListener("click", () => abrirEmailsAreaTI(Number(card.dataset.idarea)))
    );
    container.querySelectorAll(".ti-card-quadrado-editar").forEach((btn) =>
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        abrirEditarAreaEmailTI(Number(btn.dataset.idarea), btn.dataset.nome);
      })
    );
  } catch (erro) {
    console.error("Erro ao carregar áreas de e-mail:", erro);
    container.innerHTML = tiVazio("Erro ao carregar áreas.", "error");
  }
}

// Padrão do nome de área: primeira letra maiúscula, o resto minúsculo.
function capitalizarNomeAreaTI(nome) {
  const limpo = nome.trim();
  return limpo ? limpo.charAt(0).toUpperCase() + limpo.slice(1).toLowerCase() : limpo;
}

async function abrirNovaAreaEmailTI() {
  const { value: nome, isConfirmed } = await Swal.fire({
    title: "Nova área",
    input: "text",
    inputLabel: "Nome da área",
    inputPlaceholder: "Ex: Financeiro, Comercial, Marketing...",
    showCancelButton: true,
    confirmButtonText: "Cadastrar",
    cancelButtonText: "Cancelar",
    reverseButtons: true,
    inputValidator: (valor) => (!valor || !valor.trim()) ? "Informe o nome da área." : undefined,
  });
  if (!isConfirmed) return;

  try {
    await fetchTI("/emails/areas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: capitalizarNomeAreaTI(nome) }),
    });
    await Swal.fire("Sucesso!", "Área cadastrada.", "success");
    renderAbaEmails();
  } catch (erro) {
    console.error("Erro ao cadastrar área:", erro);
    Swal.fire("Erro", erro.message || "Erro ao cadastrar área.", "error");
  }
}

async function abrirEditarAreaEmailTI(idarea, nomeAtual) {
  const { value: nome, isConfirmed } = await Swal.fire({
    title: "Editar área",
    input: "text",
    inputLabel: "Nome da área",
    inputValue: nomeAtual,
    showCancelButton: true,
    confirmButtonText: "Salvar",
    cancelButtonText: "Cancelar",
    reverseButtons: true,
    inputValidator: (valor) => (!valor || !valor.trim()) ? "Informe o nome da área." : undefined,
  });
  if (!isConfirmed) return;

  try {
    await fetchTI(`/emails/areas/${idarea}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: capitalizarNomeAreaTI(nome) }),
    });
    await Swal.fire("Sucesso!", "Área atualizada.", "success");
    renderAbaEmails();
  } catch (erro) {
    console.error("Erro ao editar área:", erro);
    Swal.fire("Erro", erro.message || "Erro ao editar área.", "error");
  }
}

// Cadastro de e-mail: busca padrão de funcionário + área (cadastrada aqui mesmo, sem outro caminho) + e-mail + senha
async function abrirCadastrarEmailTI(idareaPreSelecionada) {
  if (!cacheAreasEmail.length) {
    try { cacheAreasEmail = await fetchTI("/emails/areas"); } catch (erro) { console.error(erro); }
  }
  if (!cacheAreasEmail.length) {
    Swal.fire("Aviso", "Cadastre uma área primeiro.", "info");
    return;
  }

  const { value: formValues } = await Swal.fire({
    title: "Cadastrar e-mail corporativo",
    html: `
      <div class="ti-swal-form">
        <label class="ti-swal-label">Funcionário
          ${montarCampoFuncionarioBuscaSwal("swal-ti-email-funcionario")}
        </label>
        <label class="ti-swal-label">Área
          <select id="swal-ti-email-area" class="swal2-select" style="margin:4px 0 0; width:100%;">
            ${cacheAreasEmail.map((a) => `<option value="${a.idarea}" ${idareaPreSelecionada === a.idarea ? "selected" : ""}>${a.nome}</option>`).join("")}
          </select>
        </label>
        <label class="ti-swal-label">E-mail
          <input type="email" id="swal-ti-email-endereco" class="swal2-input" style="margin:4px 0 0;">
        </label>
        <label class="ti-swal-label">Senha
          <input type="text" id="swal-ti-email-senha" class="swal2-input" style="margin:4px 0 0;">
        </label>
        <input type="hidden" id="swal-ti-email-idusuario-auto" value="">
        <p id="swal-ti-email-status-usuario" style="font-size:12px; color:#777; margin:0;">
          Se esse e-mail já for o login de algum usuário do sistema, ele é vinculado automaticamente (dá pra ajustar depois).
        </p>
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: "Cadastrar",
    cancelButtonText: "Cancelar",
    reverseButtons: true,
    didOpen: () => {
      ativarBuscaFuncionarioSwal("swal-ti-email-funcionario");
      document.getElementById("swal-ti-email-endereco").addEventListener("blur", sincronizarUsuarioPorEmailTI);
    },
    preConfirm: () => {
      const idfuncionario = lerFuncionarioBuscaSwal("swal-ti-email-funcionario");
      const idarea = document.getElementById("swal-ti-email-area").value;
      const email = document.getElementById("swal-ti-email-endereco").value.trim();
      const senha = document.getElementById("swal-ti-email-senha").value;
      const idusuarioAuto = document.getElementById("swal-ti-email-idusuario-auto").value;
      const idusuario = idusuarioAuto ? Number(idusuarioAuto) : null;
      if (!idfuncionario) {
        Swal.showValidationMessage("Selecione o funcionário.");
        return false;
      }
      if (!email) {
        Swal.showValidationMessage("Informe o e-mail.");
        return false;
      }
      if (!senha) {
        Swal.showValidationMessage("Informe a senha.");
        return false;
      }
      return { idfuncionario, idarea: Number(idarea), email, senha, idusuario };
    }
  });

  if (!formValues) return;

  try {
    await fetchTI("/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formValues),
    });
    await Swal.fire("Sucesso!", "E-mail cadastrado.", "success");
    renderAbaEmails();
  } catch (erro) {
    console.error("Erro ao cadastrar e-mail:", erro);
    Swal.fire("Erro", erro.message || "Erro ao cadastrar e-mail.", "error");
  }
}

async function abrirEmailsAreaTI(idarea) {
  const area = cacheAreasEmail.find((a) => a.idarea === idarea);

  await Swal.fire({
    title: area?.nome || "E-mails da área",
    width: 720,
    html: `<div id="swal-ti-emails-area-lista">${tiLoading("Carregando e-mails...")}</div>`,
    showConfirmButton: false,
    showCancelButton: true,
    cancelButtonText: "Fechar",
    didOpen: () => carregarListaEmailsAreaTI(idarea),
  });
}

async function carregarListaEmailsAreaTI(idarea) {
  const lista = document.getElementById("swal-ti-emails-area-lista");
  if (!lista) return;

  try {
    const emails = await fetchTI(`/emails?idarea=${idarea}`);

    lista.innerHTML = !emails.length ? tiVazio("Nenhum e-mail cadastrado nessa área ainda.", "email") : `
      <div class="ti-swal-lista-full">
        ${emails.map((e) => `
          <div class="ti-swal-email-card" data-idemail="${e.idemail}">
            <div class="ti-swal-email-cabecalho">
              <span class="material-symbols-outlined">${e.nome_funcionario ? "person" : "person_off"}</span>
              <span class="ti-swal-email-nome">${e.nome_funcionario || "Sem funcionário"}</span>
            </div>
            <div class="ti-swal-email-campos">
              <div class="ti-swal-email-campo">
                <span class="ti-swal-email-campo-label">E-mail</span>
                <span class="ti-swal-email-campo-valor">${e.email}</span>
              </div>
              <div class="ti-swal-email-campo">
                <span class="ti-swal-email-campo-label">Senha</span>
                <div class="ti-swal-email-senha">
                  <span class="ti-swal-senha-mascarada ti-swal-email-campo-valor" data-idemail="${e.idemail}">••••••••</span>
                  <span class="ti-swal-senha-real ti-swal-email-campo-valor" data-idemail="${e.idemail}" style="display:none;">${e.senha ?? "(erro ao decifrar)"}</span>
                  <button type="button" class="ti-btn-ver-senha" data-idemail="${e.idemail}" title="Mostrar senha">
                    <span class="material-symbols-outlined">visibility</span>
                  </button>
                </div>
              </div>
              <div class="ti-swal-email-campo">
                <span class="ti-swal-email-campo-label">Usuário do sistema</span>
                <span class="ti-swal-email-campo-valor">${e.nome_usuario ? `${e.nome_usuario} (${e.email_usuario})` : "Não vinculado"}</span>
              </div>
            </div>
            <div class="ti-swal-modelo-acoes">
              <button type="button" class="ti-btn-alterar-senha-email" data-idemail="${e.idemail}" data-email="${e.email}">Alterar senha</button>
              <button type="button" class="ti-btn-trocar-funcionario-email secundario" data-idemail="${e.idemail}" data-email="${e.email}">Trocar funcionário</button>
              <button type="button" class="ti-btn-vincular-usuario-email secundario" data-idemail="${e.idemail}" data-email="${e.email}">Vincular usuário</button>
              <button type="button" class="ti-btn-remover-email secundario" data-idemail="${e.idemail}" data-email="${e.email}">Remover</button>
            </div>
          </div>
        `).join("")}
      </div>
    `;

    lista.querySelectorAll(".ti-btn-ver-senha").forEach((btn) =>
      btn.addEventListener("click", () => {
        const id = btn.dataset.idemail;
        const mascarada = lista.querySelector(`.ti-swal-senha-mascarada[data-idemail="${id}"]`);
        const real = lista.querySelector(`.ti-swal-senha-real[data-idemail="${id}"]`);
        const icone = btn.querySelector(".material-symbols-outlined");
        const mostrando = real.style.display !== "none";
        mascarada.style.display = mostrando ? "inline" : "none";
        real.style.display = mostrando ? "none" : "inline";
        icone.textContent = mostrando ? "visibility" : "visibility_off";
        btn.title = mostrando ? "Mostrar senha" : "Ocultar senha";
      })
    );
    lista.querySelectorAll(".ti-btn-alterar-senha-email").forEach((btn) =>
      btn.addEventListener("click", () => abrirAlterarSenhaEmailTI(btn.dataset.idemail, btn.dataset.email, idarea))
    );
    lista.querySelectorAll(".ti-btn-trocar-funcionario-email").forEach((btn) =>
      btn.addEventListener("click", () => abrirTrocarFuncionarioEmailTI(btn.dataset.idemail, btn.dataset.email, idarea))
    );
    lista.querySelectorAll(".ti-btn-vincular-usuario-email").forEach((btn) =>
      btn.addEventListener("click", () => abrirVincularUsuarioEmailTI(btn.dataset.idemail, btn.dataset.email, idarea))
    );
    lista.querySelectorAll(".ti-btn-remover-email").forEach((btn) =>
      btn.addEventListener("click", () => removerEmailTI(btn.dataset.idemail, btn.dataset.email, idarea))
    );
  } catch (erro) {
    console.error("Erro ao carregar e-mails da área:", erro);
    lista.innerHTML = tiVazio("Erro ao carregar e-mails.", "error");
  }
}

async function abrirAlterarSenhaEmailTI(idemail, email, idarea) {
  const { value: senha, isConfirmed } = await Swal.fire({
    title: `Alterar senha — ${email}`,
    input: "text",
    inputLabel: "Nova senha",
    showCancelButton: true,
    confirmButtonText: "Salvar",
    cancelButtonText: "Cancelar",
    reverseButtons: true,
    inputValidator: (valor) => (!valor) ? "Informe a nova senha." : undefined,
  });
  if (!isConfirmed) return;

  try {
    await fetchTI(`/emails/${idemail}/senha`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ senha }),
    });
    await Swal.fire("Sucesso!", "Senha atualizada.", "success");
    abrirEmailsAreaTI(idarea);
  } catch (erro) {
    console.error("Erro ao alterar senha do e-mail:", erro);
    Swal.fire("Erro", erro.message || "Erro ao alterar senha.", "error");
  }
}

async function abrirTrocarFuncionarioEmailTI(idemail, email, idarea) {
  const { value: formValues } = await Swal.fire({
    title: `Trocar funcionário — ${email}`,
    html: `
      <div class="ti-swal-form">
        <label class="ti-swal-label">Novo funcionário
          ${montarCampoFuncionarioBuscaSwal("swal-ti-email-novo-func")}
        </label>
        <p style="font-size:12px; color:#777; margin:0;">Deixe em branco pra remover o funcionário responsável por esse e-mail.</p>
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: "Salvar",
    cancelButtonText: "Cancelar",
    reverseButtons: true,
    allowOutsideClick: false,
    allowEscapeKey: false,
    customClass: { popup: "ti-swal-altura-fixa" },
    didOpen: () => ativarBuscaFuncionarioSwal("swal-ti-email-novo-func"),
    preConfirm: () => ({ idfuncionario: lerFuncionarioBuscaSwal("swal-ti-email-novo-func") })
  });

  if (!formValues) return;

  try {
    await fetchTI(`/emails/${idemail}/funcionario`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formValues),
    });
    await Swal.fire("Sucesso!", "Funcionário atualizado.", "success");
    abrirEmailsAreaTI(idarea);
  } catch (erro) {
    console.error("Erro ao trocar funcionário do e-mail:", erro);
    Swal.fire("Erro", erro.message || "Erro ao trocar funcionário.", "error");
  }
}

async function abrirVincularUsuarioEmailTI(idemail, email, idarea) {
  const { value: formValues } = await Swal.fire({
    title: `Vincular usuário — ${email}`,
    html: `
      <div class="ti-swal-form">
        <label class="ti-swal-label">Usuário do sistema
          ${montarCampoUsuarioBuscaSwal("swal-ti-email-novo-usuario")}
        </label>
        <p style="font-size:12px; color:#777; margin:0;">Deixe em branco pra desvincular o usuário desse e-mail.</p>
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: "Salvar",
    cancelButtonText: "Cancelar",
    reverseButtons: true,
    allowOutsideClick: false,
    allowEscapeKey: false,
    customClass: { popup: "ti-swal-altura-fixa" },
    didOpen: () => ativarBuscaUsuarioSwal("swal-ti-email-novo-usuario"),
    preConfirm: () => ({ idusuario: lerUsuarioBuscaSwal("swal-ti-email-novo-usuario") })
  });

  if (!formValues) return;

  try {
    await fetchTI(`/emails/${idemail}/usuario`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formValues),
    });
    await Swal.fire("Sucesso!", "Usuário atualizado.", "success");
    abrirEmailsAreaTI(idarea);
  } catch (erro) {
    console.error("Erro ao vincular usuário ao e-mail:", erro);
    Swal.fire("Erro", erro.message || "Erro ao vincular usuário.", "error");
  }
}

async function removerEmailTI(idemail, email, idarea) {
  const { isConfirmed } = await Swal.fire({
    title: `Remover ${email}?`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Sim, remover",
    cancelButtonText: "Cancelar",
    reverseButtons: true,
  });
  if (!isConfirmed) return;

  try {
    await fetchTI(`/emails/${idemail}`, { method: "DELETE" });
    await Swal.fire("Removido!", "E-mail removido.", "success");
    abrirEmailsAreaTI(idarea);
  } catch (erro) {
    console.error("Erro ao remover e-mail:", erro);
    Swal.fire("Erro", erro.message || "Erro ao remover e-mail.", "error");
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
    if (ativo) {
      // Só um "modo de tela cheia" por vez — mesma regra espelhada em CeoMode.js/RH.js.
      document.body.classList.remove("ceo-mode", "rh-mode");
      const iconeCeo = document.querySelector("li.Ceo .material-symbols-outlined");
      if (iconeCeo) iconeCeo.textContent = "finance";
      const iconeRH = document.querySelector("li.RH .material-symbols-outlined");
      if (iconeRH) iconeRH.textContent = "";
      montarPainelTI();
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  if (Array.isArray(window.permissoes)) initTIMode();
  else document.addEventListener("permissoesCarregadas", initTIMode, { once: true });
});
