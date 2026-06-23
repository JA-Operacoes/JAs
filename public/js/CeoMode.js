import { fetchComToken } from '/utils/utils.js';

// ===== Configuração das faixas de margem (ajustável) =====
// margem realizada (%) -> veredito
const FAIXAS = {
    otimo: 30,  // >= 30% => ótimo (verde)
    ok: 15,     // 15% a 30% => ok (amarelo)
    // < 15% => ruim (vermelho)
};

const moeda = (v) =>
    (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (v) => `${(Number(v) || 0).toFixed(1)}%`;

// Formata a lista de números de orçamento de um evento: "Orçamentos: #1394, #1402 (2)".
function formatarOrcamentos(nrorcamentos) {
    const lista = Array.isArray(nrorcamentos) ? nrorcamentos.filter((n) => n != null) : [];
    if (lista.length === 0) return "Sem orçamento";
    const numeros = lista.map((n) => `#${n}`).join(", ");
    return `Orçamentos: ${numeros} (${lista.length})`;
}

// Calcula os números derivados e o veredito de um evento.
function analisarEvento(ev) {
    const venda = Number(ev.totgeralvda) || 0;
    const fechado = Number(ev.vlrcliente) > 0 ? Number(ev.vlrcliente) : venda;
    const lucroEsperado = Number(ev.lucroreal) || 0;
    const staffOrcado = Number(ev.custo_staff_orcado) || 0;
    const staffReal = Number(ev.custo_staff_real) || 0;
    const custoPrevisto = Number(ev.custo_previsto) || 0;

    // Saldo de Staff (orçado - real). Positivo = sobrou orçamento (economia); negativo = estourou.
    const saldoStaff = staffOrcado - staffReal;
    // Lucro realizado: lucro esperado ajustado pelo saldo de staff (economia soma, estouro reduz).
    const lucroRealizado = lucroEsperado + saldoStaff;
    const margemRealizada = fechado > 0 ? (lucroRealizado / fechado) * 100 : 0;

    let nivel, label;
    if (margemRealizada >= FAIXAS.otimo) { nivel = "otimo"; label = "✅ Valeu a pena"; }
    else if (margemRealizada >= FAIXAS.ok) { nivel = "ok"; label = "⚠️ Aceitável"; }
    else { nivel = "ruim"; label = "❌ Não valeu"; }

    return { venda, fechado, lucroEsperado, staffOrcado, staffReal, custoPrevisto, saldoStaff, lucroRealizado, margemRealizada, nivel, label };
}

// ===== Montagem do painel (lazy, só na primeira ativação) =====
function montarPainel() {
    if (document.getElementById("ceo-panel")) return;

    const main = document.getElementById("conteudo");
    if (!main) return;

    const panel = document.createElement("div");
    panel.id = "ceo-panel";
    panel.innerHTML = `
        <div class="ceo-header">
            <h2>Painel CEO — Rentabilidade</h2>
            <div class="ceo-controls">
                <span class="material-symbols-outlined">search</span>
                <select id="ceo-select-cliente">
                    <option value="">Carregando clientes...</option>
                </select>
                <button id="ceo-btn-comparar" type="button">Comparar eventos</button>
            </div>
        </div>
        <div id="ceo-comparador" class="ceo-comparador" style="display:none;">
            <label>Selecione os eventos (qualquer cliente) — Ctrl/Shift para vários:</label>
            <select id="ceo-multi-eventos" multiple size="8"></select>
            <div class="ceo-comparador-acoes">
                <button id="ceo-btn-ver-comparacao" type="button">Ver comparação</button>
                <button id="ceo-btn-fechar-comparador" type="button" class="secundario">Fechar</button>
            </div>
        </div>
        <h3 id="ceo-titulo" class="ceo-titulo"></h3>
        <div id="ceo-anos-filtro" class="ceo-anos-filtro" style="display:none;"></div>
        <div id="ceo-eventos" class="ceo-eventos">
            <p class="ceo-vazio">Carregando destaque da semana...</p>
        </div><br>
        <div id="ceo-resumo" class="ceo-resumo" style="display:none;"></div>
        <div id="ceo-graficos" class="ceo-graficos" style="display:none;">
            <div class="ceo-chart-card">
                <h3>Rentabilidade por evento</h3>
                <div id="chart-rentabilidade" class="ceo-chart"></div>
            </div>
            <div class="ceo-chart-card">
                <h3>Contratação de staff (orçado × real)</h3>
                <div id="chart-staff" class="ceo-chart"></div>
            </div>
            <div class="ceo-chart-card">
                <h3>Margem por evento</h3>
                <div id="chart-margem" class="ceo-chart"></div>
            </div>
            <div class="ceo-chart-card">
                <h3>Composição do total do cliente</h3>
                <div id="chart-rosca" class="ceo-chart"></div>
            </div>
        </div>
        <p class="ceo-nota">Custo real considera o staff escalado/pago (cachê + ajuda + caixinha) por evento. Fornecedores/contas ainda não são vinculados por evento.</p>
    `;
    main.appendChild(panel);

    document.getElementById("ceo-btn-comparar")
        .addEventListener("click", abrirComparador);
    document.getElementById("ceo-btn-fechar-comparador")
        .addEventListener("click", () => { document.getElementById("ceo-comparador").style.display = "none"; });
    document.getElementById("ceo-btn-ver-comparacao")
        .addEventListener("click", verComparacao);

    carregarClientes();
    carregarDestaque(); // abre já mostrando o evento de maior gasto da semana
}

// Reage à seleção de cliente (chamado tanto pelo select nativo quanto pelo select2).
function onClienteChange(id) {
    if (id) carregarAnalise(id);
    else carregarDestaque(); // sem cliente volta ao destaque da semana
}

async function carregarClientes() {
    const select = document.getElementById("ceo-select-cliente");
    try {
        const clientes = await fetchComToken("/ceo/clientes");
        select.innerHTML = '<option value="">Selecione o cliente...</option>';
        (clientes || []).forEach((c) => {
            const opt = document.createElement("option");
            opt.value = c.idcliente;
            opt.textContent = c.nmfantasia;
            select.appendChild(opt);
        });
        // Torna o seletor de cliente pesquisável por digitação (select2 já carregado no sistema).
        if (window.jQuery && jQuery.fn && jQuery.fn.select2) {
            const $sel = jQuery(select);
            $sel.select2({ width: "260px", placeholder: "Buscar cliente...", allowClear: true });
            $sel.off("change.ceo").on("change.ceo", function () { onClienteChange(this.value); });
        } else {
            select.addEventListener("change", (e) => onClienteChange(e.target.value));
        }
    } catch (err) {
        console.error("Erro ao carregar clientes (CEO):", err);
        select.innerHTML = '<option value="">Erro ao carregar clientes</option>';
    }
}

// ===== Comparação do mesmo evento por ano (os anos são um filtro) =====
let anosDataset = null;       // todos os anos do evento atual (objetos crus p/ analisarEvento)
let anosSelecionados = null;  // Set de anos ativos no filtro
let anosTituloEvento = "";

// Abre a comparação por ano de um evento (acionada ao clicar num card de evento).
async function carregarEventoAnos(idevento, nome) {
    const cont = document.getElementById("ceo-eventos");
    cont.innerHTML = '<p class="ceo-vazio">Carregando comparação por ano...</p>';
    try {
        const data = await fetchComToken(`/ceo/evento-anos?idevento=${idevento}`);
        const anos = (data && data.anos) || [];
        anosTituloEvento = data?.nmevento || nome || "Evento";
        anosDataset = anos.map((r) => ({ ...r, nmevento: `Ano ${r.ano}` }));
        anosSelecionados = new Set(anos.map((r) => r.ano)); // começa com todos marcados
        renderFiltroAnos();
        renderAnosSelecionados();
    } catch (err) {
        console.error("Erro ao carregar comparação por ano (CEO):", err);
        cont.innerHTML = '<p class="ceo-vazio">Erro ao carregar a comparação por ano.</p>';
        ocultarResultados();
    }
}

// Chips de ano: cada um liga/desliga aquele ano da comparação.
function renderFiltroAnos() {
    const box = document.getElementById("ceo-anos-filtro");
    if (!box) return;
    if (!anosDataset || anosDataset.length === 0) { box.style.display = "none"; box.innerHTML = ""; return; }
    box.style.display = "flex";
    box.innerHTML = `<span class="ceo-anos-label">Comparar anos:</span>` +
        anosDataset.map((r) =>
            `<button type="button" class="ceo-ano-chip ${anosSelecionados.has(r.ano) ? "ativo" : ""}" data-ano="${r.ano}">${r.ano}</button>`
        ).join("");
    box.querySelectorAll(".ceo-ano-chip").forEach((chip) => {
        chip.addEventListener("click", () => {
            const ano = parseInt(chip.dataset.ano, 10);
            if (anosSelecionados.has(ano)) {
                if (anosSelecionados.size > 1) anosSelecionados.delete(ano); // mantém ao menos 1 ano
            } else {
                anosSelecionados.add(ano);
            }
            renderFiltroAnos();
            renderAnosSelecionados();
        });
    });
}

function renderAnosSelecionados() {
    const eventos = anosDataset.filter((r) => anosSelecionados.has(r.ano));
    renderAnalise(eventos, `📅 ${anosTituloEvento} — comparação por ano`, "anos");
}

// Esconde as seções de resultado (resumo + gráficos).
function ocultarResultados() {
    const r = document.getElementById("ceo-resumo");
    const g = document.getElementById("ceo-graficos");
    if (r) r.style.display = "none";
    if (g) g.style.display = "none";
}

// Renderiza um conjunto de eventos já carregados (resumo + gráficos + cards).
function renderAnalise(eventos, titulo, modo) {
    const cont = document.getElementById("ceo-eventos");
    const resumoEl = document.getElementById("ceo-resumo");
    document.getElementById("ceo-titulo").textContent = titulo || "";

    // Fora do modo "anos", esconde os chips de filtro de ano.
    if (modo !== "anos") {
        const box = document.getElementById("ceo-anos-filtro");
        if (box) { box.style.display = "none"; box.innerHTML = ""; }
    }

    if (!eventos || eventos.length === 0) {
        cont.innerHTML = '<p class="ceo-vazio">Nenhum evento encontrado.</p>';
        ocultarResultados();
        return;
    }
    const analises = eventos.map((ev) => ({ ev, a: analisarEvento(ev) }));
    renderResumo(resumoEl, analises);
    renderGraficos(analises);
    renderEventos(cont, analises, modo);
}

// Busca genérica num endpoint que retorna { eventos: [...] }.
async function carregarDe(url, titulo, modo, msgCarregando) {
    const cont = document.getElementById("ceo-eventos");
    cont.innerHTML = `<p class="ceo-vazio">${msgCarregando}</p>`;
    try {
        const data = await fetchComToken(url);
        renderAnalise((data && data.eventos) || [], titulo, modo);
    } catch (err) {
        console.error("Erro ao carregar análise (CEO):", err);
        cont.innerHTML = '<p class="ceo-vazio">Erro ao carregar a análise.</p>';
        ocultarResultados();
    }
}

// Análise por cliente.
async function carregarAnalise(idcliente) {
    const select = document.getElementById("ceo-select-cliente");
    const nomeCliente = select?.selectedOptions?.[0]?.textContent || "Cliente";
    await carregarDe(`/ceo/analise?idcliente=${idcliente}`, nomeCliente, "cliente", "Carregando análise...");
}

// Destaque da semana: eventos dos próximos 7 dias por maior gasto previsto.
async function carregarDestaque() {
    await carregarDe("/ceo/destaque-semana?dias=7", "🔥 Destaque da semana — próximos 7 dias (maior gasto)", "destaque", "Carregando destaque da semana...");
}

// Abre o seletor de comparação e popula a lista de eventos (uma vez).
async function abrirComparador() {
    const box = document.getElementById("ceo-comparador");
    box.style.display = "block";
    const select = document.getElementById("ceo-multi-eventos");
    if (select.dataset.carregado) return;
    select.innerHTML = '<option disabled>Carregando eventos...</option>';
    try {
        const eventos = await fetchComToken("/ceo/eventos");
        select.innerHTML = "";
        (eventos || []).forEach((ev) => {
            const opt = document.createElement("option");
            opt.value = ev.idevento;
            opt.textContent = `${ev.nomecliente || "—"} — ${ev.nmevento}`;
            select.appendChild(opt);
        });
        select.dataset.carregado = "1";
    } catch (err) {
        console.error("Erro ao carregar eventos para comparar (CEO):", err);
        select.innerHTML = '<option disabled>Erro ao carregar eventos</option>';
    }
}

// Carrega a comparação dos eventos selecionados manualmente.
async function verComparacao() {
    const select = document.getElementById("ceo-multi-eventos");
    const ids = Array.from(select.selectedOptions).map((o) => o.value).filter(Boolean);
    if (ids.length === 0) {
        alert("Selecione pelo menos um evento para comparar.");
        return;
    }
    document.getElementById("ceo-select-cliente").value = ""; // sai do modo cliente
    await carregarDe(`/ceo/comparar?ids=${ids.join(",")}`, `Comparação de ${ids.length} evento(s)`, "comparacao", "Carregando comparação...");
}

// ===== Gráficos (ECharts) =====
// Inicializa (ou reaproveita) uma instância ECharts num container.
function obterChart(id) {
    const el = document.getElementById(id);
    if (!el || typeof echarts === "undefined") return null;
    let inst = echarts.getInstanceByDom(el);
    if (!inst) inst = echarts.init(el);
    return inst;
}

const corNivel = { otimo: "#1e9e54", ok: "#e0a106", ruim: "#dc2e2e" };
// Encurta nomes longos de evento para o eixo dos gráficos.
const nomeCurto = (s, n = 18) => {
    const t = String(s || "Evento");
    return t.length > n ? t.slice(0, n - 1) + "…" : t;
};
const fmtMoedaCurta = (v) => "R$ " + (Number(v) || 0).toLocaleString("pt-BR");

function renderGraficos(analises) {
    const graficosEl = document.getElementById("ceo-graficos");
    if (!graficosEl) return;
    graficosEl.style.display = "grid";

    if (typeof echarts === "undefined") {
        graficosEl.innerHTML = '<p class="ceo-vazio">Biblioteca de gráficos (ECharts) não carregada.</p>';
        return;
    }

    const nomes = analises.map((x) => nomeCurto(x.ev.nmevento));
    const tooltipMoeda = {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        valueFormatter: (v) => moeda(v),
    };
    const grid = { left: 70, right: 20, top: 40, bottom: 70 };
    const xAxis = { type: "category", data: nomes, axisLabel: { rotate: 30, interval: 0, fontSize: 10 } };
    const yMoeda = { type: "value", axisLabel: { formatter: fmtMoedaCurta } };

    // 1) Rentabilidade: fechado x lucro esperado x lucro realizado
    const cRent = obterChart("chart-rentabilidade");
    if (cRent) cRent.setOption({
        tooltip: tooltipMoeda,
        legend: { bottom: 0, data: ["Valor fechado", "Lucro esperado", "Lucro realizado"] },
        grid, xAxis, yAxis: yMoeda,
        series: [
            { name: "Valor fechado", type: "bar", color: "#5a6b7b", data: analises.map((x) => x.a.fechado) },
            { name: "Lucro esperado", type: "bar", color: "#1f6fc4", data: analises.map((x) => x.a.lucroEsperado) },
            { name: "Lucro realizado", type: "bar", color: "#1e9e54", data: analises.map((x) => x.a.lucroRealizado) },
        ],
    }, true);

    // 2) Contratação de staff: orçado x real
    const cStaff = obterChart("chart-staff");
    if (cStaff) cStaff.setOption({
        tooltip: tooltipMoeda,
        legend: { bottom: 0, data: ["Staff orçado", "Staff real"] },
        grid, xAxis, yAxis: yMoeda,
        series: [
            { name: "Staff orçado", type: "bar", color: "#b0b6bd", data: analises.map((x) => x.a.staffOrcado) },
            { name: "Staff real", type: "bar", color: "#942123", data: analises.map((x) => x.a.staffReal) },
        ],
    }, true);

    // 3) Margem por evento (cor por faixa do veredito)
    const cMargem = obterChart("chart-margem");
    if (cMargem) cMargem.setOption({
        tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (v) => pct(v) },
        grid, xAxis,
        yAxis: { type: "value", axisLabel: { formatter: "{value}%" } },
        series: [{
            name: "Margem realizada", type: "bar",
            data: analises.map((x) => ({ value: Number(x.a.margemRealizada.toFixed(1)), itemStyle: { color: corNivel[x.a.nivel] } })),
            markLine: {
                silent: true, symbol: "none",
                data: [
                    { yAxis: FAIXAS.ok, lineStyle: { color: "#e0a106", type: "dashed" }, label: { formatter: "Mín. aceitável" } },
                    { yAxis: FAIXAS.otimo, lineStyle: { color: "#1e9e54", type: "dashed" }, label: { formatter: "Ótimo" } },
                ],
            },
        }],
    }, true);

    // 4) Composição do total do cliente (rosca)
    const totFechado = analises.reduce((s, x) => s + x.a.fechado, 0);
    const totStaffReal = analises.reduce((s, x) => s + x.a.staffReal, 0);
    const totLucro = analises.reduce((s, x) => s + x.a.lucroRealizado, 0);
    const outros = Math.max(0, totFechado - totStaffReal - totLucro);
    const cRosca = obterChart("chart-rosca");
    if (cRosca) cRosca.setOption({
        tooltip: { trigger: "item", valueFormatter: (v) => moeda(v) },
        legend: { bottom: 0 },
        series: [{
            type: "pie", radius: ["45%", "70%"], center: ["50%", "45%"],
            avoidLabelOverlap: true,
            label: { formatter: "{b}\n{d}%" },
            data: [
                { name: "Lucro realizado", value: Math.max(0, totLucro), itemStyle: { color: "#1e9e54" } },
                { name: "Custo de staff (real)", value: totStaffReal, itemStyle: { color: "#942123" } },
                { name: "Demais custos", value: outros, itemStyle: { color: "#b0b6bd" } },
            ],
        }],
    }, true);
}

// Redimensiona os gráficos quando a janela muda de tamanho.
window.addEventListener("resize", () => {
    if (typeof echarts === "undefined") return;
    ["chart-rentabilidade", "chart-staff", "chart-margem", "chart-rosca"].forEach((id) => {
        const el = document.getElementById(id);
        const inst = el && echarts.getInstanceByDom(el);
        if (inst) inst.resize();
    });
});

function renderResumo(el, analises) {
    const totVenda = analises.reduce((s, x) => s + x.a.fechado, 0);
    const totEsperado = analises.reduce((s, x) => s + x.a.lucroEsperado, 0);
    const totRealizado = analises.reduce((s, x) => s + x.a.lucroRealizado, 0);
    const margemMedia = totVenda > 0 ? (totRealizado / totVenda) * 100 : 0;

    el.style.display = "grid";
    el.innerHTML = `
        <div class="ceo-resumo-card"><span>Eventos</span><strong>${analises.length}</strong></div>
        <div class="ceo-resumo-card"><span>Faturamento fechado</span><strong>${moeda(totVenda)}</strong></div>
        <div class="ceo-resumo-card"><span>Lucro esperado</span><strong>${moeda(totEsperado)}</strong></div>
        <div class="ceo-resumo-card"><span>Lucro realizado</span><strong>${moeda(totRealizado)}</strong></div>
        <div class="ceo-resumo-card"><span>Margem média</span><strong>${pct(margemMedia)}</strong></div>
    `;
}

function renderEventos(cont, analises, modo) {
    cont.innerHTML = "";
    analises.forEach(({ ev, a }, idx) => {
        const card = document.createElement("div");
        card.className = `ceo-evento nivel-${a.nivel}`;

        // No destaque da semana, o 1º (maior gasto previsto) ganha um selo.
        const selo = (modo === "destaque" && idx === 0)
            ? '<span class="ceo-fogo">🔥 Maior gasto da semana</span>' : "";
        // Mostra o cliente quando a visão não é de um cliente único.
        const cliente = (modo !== "cliente" && ev.nomecliente)
            ? `<span class="ceo-evt-cliente">${ev.nomecliente}</span>` : "";

        // Fora do modo "anos", o card é clicável para comparar os anos daquele evento.
        const clicavel = modo !== "anos" && ev.idevento;
        if (clicavel) {
            card.classList.add("clicavel");
            card.title = "Clique para comparar os anos deste evento";
            card.addEventListener("click", () => carregarEventoAnos(ev.idevento, ev.nmevento));
        }
        const dica = clicavel ? '<span class="ceo-evt-dica">comparar anos ›</span>' : "";

        card.innerHTML = `
            <div class="ceo-evt-topo">
                <div class="ceo-evt-nome">
                    ${cliente}${ev.nmevento || "Evento"} ${selo}
                    <small>${formatarOrcamentos(ev.nrorcamentos)}</small>
                </div>
                <span class="ceo-badge badge-${a.nivel}">${a.label}</span>
            </div>
            ${dica}
            <div class="ceo-evt-grid">
                <div><span>Gasto previsto</span><strong>${moeda(a.custoPrevisto)}</strong></div>
                <div><span>Valor fechado</span><strong>${moeda(a.fechado)}</strong></div>
                <div><span>Lucro esperado</span><strong>${moeda(a.lucroEsperado)}</strong></div>
                <div><span>Lucro realizado</span><strong>${moeda(a.lucroRealizado)}</strong></div>
                <div><span>Margem realizada</span><strong>${pct(a.margemRealizada)}</strong></div>
                <div><span>Staff orçado</span><strong>${moeda(a.staffOrcado)}</strong></div>
                <div><span>Staff real</span><strong>${moeda(a.staffReal)}</strong></div>
                <div><span>Saldo de Staff</span><strong class="${a.saldoStaff < 0 ? "neg" : "pos"}">${moeda(a.saldoStaff)}</strong></div>
            </div>
        `;
        cont.appendChild(card);
    });
}

// ===== Toggle do CeoMode =====
function initCeoMode() {
    const link = document.querySelector("li.Ceo a");
    if (!link) return;

    const icone = link.querySelector(".material-symbols-outlined");

    link.addEventListener("click", (e) => {
        e.preventDefault();
        const ativo = document.body.classList.toggle("ceo-mode");
        if (icone) icone.textContent = ativo ? "logout" : "finance";
        link.title = ativo ? "Sair do CEO Mode" : "CEO Mode";
        if (ativo) montarPainel();
    });
}

document.addEventListener("DOMContentLoaded", initCeoMode);
