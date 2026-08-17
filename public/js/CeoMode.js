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

// Formata o período de realização do evento: "12/08/2026 a 15/08/2026".
function formatarPeriodo(dtInicio, dtFim) {
    const fmt = (d) => new Date(d).toLocaleDateString("pt-BR");
    if (dtInicio && dtFim) return `${fmt(dtInicio)} a ${fmt(dtFim)}`;
    if (dtInicio || dtFim) return fmt(dtInicio || dtFim);
    return "Sem período definido";
}

// Calcula os números derivados e o veredito de um evento.
function analisarEvento(ev) {
    const venda = Number(ev.totgeralvda) || 0;
    const fechado = Number(ev.vlrcliente) > 0 ? Number(ev.vlrcliente) : venda;
    const lucroEsperado = Number(ev.lucroreal) || 0;
    const staffOrcado = Number(ev.custo_staff_orcado) || 0;
    const staffReal = Number(ev.custo_staff_real) || 0;
    const custoPrevisto = Number(ev.custo_previsto) || 0;
    // custo_staff_real pode ser 0 tanto por "ainda não escalou ninguém" quanto por "escalou de
    // graça"; qtd_staff_real distingue os dois casos e evita ler "ninguém escalado ainda" como
    // "economizamos 100% do staff".
    const staffCadastrado = (Number(ev.qtd_staff_real) || 0) > 0;
    // O evento só está "concluído" quando a data final de realização já passou — enquanto isso,
    // o staff cadastrado ainda pode estar incompleto (faltando gente pra escalar/pagar), então
    // Staff real ainda não é comparável com o orçado.
    const eventoConcluido = ev.dtfimrealizacao ? new Date(ev.dtfimrealizacao) < new Date() : false;
    const staffJaRealizado = staffCadastrado && eventoConcluido;

    // Saldo de Staff (orçado - real). Positivo = sobrou orçamento (economia); negativo = estourou.
    // Sem staff realizado ainda (ou evento não concluído), não há o que comparar — saldo fica 0.
    const saldoStaff = staffJaRealizado ? (staffOrcado - staffReal) : 0;
    // Lucro realizado: lucro esperado ajustado pelo saldo de staff (economia soma, estouro reduz).
    const lucroRealizado = lucroEsperado + saldoStaff;
    const margemRealizada = fechado > 0 ? (lucroRealizado / fechado) * 100 : 0;

    let nivel, label;
    if (!staffCadastrado) { nivel = "pendente"; label = "⏳ Ainda não realizado"; }
    else if (!eventoConcluido) { nivel = "andamento"; label = "🔄 Em andamento"; }
    else if (margemRealizada >= FAIXAS.otimo) { nivel = "otimo"; label = "✅ Valeu a pena"; }
    else if (margemRealizada >= FAIXAS.ok) { nivel = "ok"; label = "⚠️ Aceitável"; }
    else { nivel = "ruim"; label = "❌ Não valeu"; }

    return { venda, fechado, lucroEsperado, staffOrcado, staffReal, custoPrevisto, staffJaRealizado, saldoStaff, lucroRealizado, margemRealizada, nivel, label };
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
                <select id="ceo-select-evento">
                    <option value="">Carregando eventos...</option>
                </select>
                <select id="ceo-select-ano">
                    <option value="">Todos os anos</option>
                </select>
                <label class="ceo-filtro-data">De
                    <input type="date" id="ceo-data-inicio">
                </label>
                <label class="ceo-filtro-data">Até
                    <input type="date" id="ceo-data-fim">
                </label>
                <button id="ceo-btn-limpar-filtros" type="button" class="secundario">Limpar filtros</button>
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
                <h3 id="titulo-chart-rentabilidade">Rentabilidade por evento</h3>
                <div id="chart-rentabilidade" class="ceo-chart"></div>
            </div>
            <div class="ceo-chart-card">
                <h3 id="titulo-chart-staff">Contratação de staff (orçado × real)</h3>
                <div id="chart-staff" class="ceo-chart"></div>
            </div>
            <div class="ceo-chart-card">
                <h3 id="titulo-chart-margem">Margem por evento</h3>
                <div id="chart-margem" class="ceo-chart"></div>
            </div>
            <div class="ceo-chart-card">
                <h3 id="titulo-chart-rosca">Composição do total do cliente</h3>
                <div id="chart-rosca" class="ceo-chart"></div>
            </div>
        </div>
        <p class="ceo-nota">Custo real considera o cachê (já com ajuste de custo e caixinha, quando autorizados) + ajuda de custo do staff escalado/pago por evento. Fornecedores/contas e ajustes financeiros avulsos (staffajustefinanceiro) ainda não são vinculados por evento.</p>
    `;
    main.appendChild(panel);

    document.getElementById("ceo-btn-comparar")
        .addEventListener("click", abrirComparador);
    document.getElementById("ceo-btn-fechar-comparador")
        .addEventListener("click", () => { document.getElementById("ceo-comparador").style.display = "none"; });
    document.getElementById("ceo-btn-ver-comparacao")
        .addEventListener("click", verComparacao);
    document.getElementById("ceo-btn-limpar-filtros")
        .addEventListener("click", limparFiltros);
    document.getElementById("ceo-select-ano")
        .addEventListener("change", aplicarFiltros);
    document.getElementById("ceo-data-inicio")
        .addEventListener("change", aplicarFiltros);
    document.getElementById("ceo-data-fim")
        .addEventListener("change", aplicarFiltros);

    carregarClientes();
    carregarEventosFiltro();
    // O painel abre já filtrado no ano vigente (assim que a lista de anos carrega), pra o CEO
    // ver de cara o panorama do ano corrente em vez de só o destaque da semana.
    carregarAnosDisponiveis().then(() => {
        definirAnoVigente();
        aplicarFiltros();
    });
}

// Deixa o select de ano no ano corrente, se ele estiver disponível na lista (silencioso —
// não dispara busca sozinho, quem chama decide quando aplicar o filtro).
function definirAnoVigente() {
    const selAno = document.getElementById("ceo-select-ano");
    const anoAtual = String(new Date().getFullYear());
    if (selAno && Array.from(selAno.options).some((o) => o.value === anoAtual)) {
        selAno.value = anoAtual;
    }
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
            $sel.select2({ width: "220px", placeholder: "Buscar cliente...", allowClear: true });
            $sel.off("change.ceo").on("change.ceo", aplicarFiltros);
        } else {
            select.addEventListener("change", aplicarFiltros);
        }
    } catch (err) {
        console.error("Erro ao carregar clientes (CEO):", err);
        select.innerHTML = '<option value="">Erro ao carregar clientes</option>';
    }
}

// Cache de /ceo/eventos (Promise) — reaproveitada pelo select de evento do filtro
// e pelo comparador manual, para não buscar a mesma lista duas vezes.
let eventosPromise = null;

function carregarEventosFiltro() {
    const select = document.getElementById("ceo-select-evento");
    eventosPromise = fetchComToken("/ceo/eventos").catch((err) => {
        console.error("Erro ao carregar eventos (CEO):", err);
        select.innerHTML = '<option value="">Erro ao carregar eventos</option>';
        return [];
    });

    eventosPromise.then((eventos) => {
        select.innerHTML = '<option value="">Selecione o evento...</option>';
        (eventos || []).forEach((ev) => {
            const opt = document.createElement("option");
            opt.value = ev.idevento;
            opt.textContent = `${ev.nomecliente || "—"} — ${ev.nmevento}`;
            select.appendChild(opt);
        });
        if (window.jQuery && jQuery.fn && jQuery.fn.select2) {
            const $sel = jQuery(select);
            $sel.select2({ width: "260px", placeholder: "Buscar evento...", allowClear: true });
            $sel.off("change.ceo").on("change.ceo", aplicarFiltros);
        } else {
            select.addEventListener("change", aplicarFiltros);
        }
    });
}

async function carregarAnosDisponiveis() {
    const select = document.getElementById("ceo-select-ano");
    try {
        const anos = await fetchComToken("/ceo/anos-disponiveis");
        select.innerHTML = '<option value="">Todos os anos</option>' +
            (anos || []).map((a) => `<option value="${a}">${a}</option>`).join("");
    } catch (err) {
        console.error("Erro ao carregar anos disponíveis (CEO):", err);
        select.innerHTML = '<option value="">Todos os anos</option>';
    }
}

// Lê os filtros ativos (cliente/evento/ano/período) e busca o resultado combinado.
// Sem nenhum filtro selecionado, volta ao destaque da semana (comportamento padrão).
function aplicarFiltros() {
    const selCliente = document.getElementById("ceo-select-cliente");
    const selEvento = document.getElementById("ceo-select-evento");
    const idcliente = selCliente?.value || "";
    const idevento = selEvento?.value || "";
    const ano = document.getElementById("ceo-select-ano")?.value || "";
    const datainicio = document.getElementById("ceo-data-inicio")?.value || "";
    const datafim = document.getElementById("ceo-data-fim")?.value || "";

    if (!idcliente && !idevento && !ano && !datainicio && !datafim) {
        carregarDestaque();
        return;
    }

    const params = new URLSearchParams();
    if (idcliente) params.set("idcliente", idcliente);
    if (idevento) params.set("idevento", idevento);
    if (ano) params.set("ano", ano);
    if (datainicio) params.set("datainicio", datainicio);
    if (datafim) params.set("datafim", datafim);

    const partesTitulo = [];
    if (idcliente) partesTitulo.push(selCliente.selectedOptions[0]?.textContent || "Cliente");
    if (idevento) partesTitulo.push(selEvento.selectedOptions[0]?.textContent || "Evento");
    if (ano) partesTitulo.push(`Ano ${ano}`);
    if (datainicio || datafim) partesTitulo.push(`${datainicio || "…"} a ${datafim || "…"}`);
    const titulo = partesTitulo.join(" · ") || "Resultado do filtro";

    carregarDe(`/ceo/filtrar?${params.toString()}`, titulo, "filtro", "Carregando...");
}

// Limpa cliente/evento/período e volta pro ano vigente (o padrão do painel), não pra vazio.
function limparFiltros() {
    const cliente = document.getElementById("ceo-select-cliente");
    const evento = document.getElementById("ceo-select-evento");
    const dataInicio = document.getElementById("ceo-data-inicio");
    const dataFim = document.getElementById("ceo-data-fim");

    if (dataInicio) dataInicio.value = "";
    if (dataFim) dataFim.value = "";
    definirAnoVigente(); // seta ANTES dos triggers abaixo, pra já valer no aplicarFiltros deles

    if (window.jQuery && jQuery.fn && jQuery.fn.select2) {
        // Dispara "change" (select2 usa o change nativo pra atualizar a UI e já
        // aciona aplicarFiltros pelo listener "change.ceo" registrado acima).
        if (cliente) jQuery(cliente).val("").trigger("change");
        if (evento) jQuery(evento).val("").trigger("change");
    } else {
        if (cliente) cliente.value = "";
        if (evento) evento.value = "";
        aplicarFiltros();
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

// Destaque da semana: eventos dos próximos 7 dias por maior gasto previsto.
async function carregarDestaque() {
    await carregarDe("/ceo/destaque-semana?dias=7", "🔥 Destaque da semana — próximos 7 dias (maior gasto)", "destaque", "Carregando destaque da semana...");
}

// Abre o seletor de comparação e popula a lista de eventos (reaproveita a mesma
// busca /ceo/eventos já disparada em carregarEventosFiltro, uma vez só).
async function abrirComparador() {
    const box = document.getElementById("ceo-comparador");
    box.style.display = "block";
    const select = document.getElementById("ceo-multi-eventos");
    if (select.dataset.carregado) return;
    select.innerHTML = '<option disabled>Carregando eventos...</option>';
    const eventos = await (eventosPromise || Promise.resolve([]));
    select.innerHTML = "";
    (eventos || []).forEach((ev) => {
        const opt = document.createElement("option");
        opt.value = ev.idevento;
        opt.textContent = `${ev.nomecliente || "—"} — ${ev.nmevento}`;
        select.appendChild(opt);
    });
    select.dataset.carregado = "1";
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

const corNivel = { otimo: "#1e9e54", ok: "#e0a106", ruim: "#dc2e2e", pendente: "#888", andamento: "#1f6fc4" };
// Encurta nomes longos de evento para o eixo dos gráficos.
const nomeCurto = (s, n = 18) => {
    const t = String(s || "Evento");
    return t.length > n ? t.slice(0, n - 1) + "…" : t;
};
const fmtMoedaCurta = (v) => "R$ " + (Number(v) || 0).toLocaleString("pt-BR");

// Título base de cada card de gráfico — o ano do filtro (quando selecionado) é
// acrescentado neles em renderGraficos(), pra ficar claro qual período está em tela.
const TITULOS_GRAFICOS = {
    "titulo-chart-rentabilidade": "Rentabilidade por evento",
    "titulo-chart-staff": "Contratação de staff (orçado × real)",
    "titulo-chart-margem": "Margem por evento",
    "titulo-chart-rosca": "Composição do total do cliente",
};

function atualizarTitulosGraficos() {
    const ano = document.getElementById("ceo-select-ano")?.value || "";
    const sufixo = ano ? ` — ${ano}` : "";
    Object.entries(TITULOS_GRAFICOS).forEach(([id, base]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = base + sufixo;
    });
}

function renderGraficos(analises) {
    const graficosEl = document.getElementById("ceo-graficos");
    if (!graficosEl) return;
    graficosEl.style.display = "grid";
    atualizarTitulosGraficos();

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
    // Com muitos eventos no filtro (ex.: ano inteiro), espremer todas as barras na largura
    // deixa os nomes ilegíveis — em vez disso mostra só um recorte inicial e deixa
    // rolar/dar zoom (slider embaixo + zoom por scroll do mouse) pra ver o resto.
    const QTD_VISIVEL_PADRAO = 20;
    const fimZoom = analises.length > QTD_VISIVEL_PADRAO
        ? (QTD_VISIVEL_PADRAO / analises.length) * 100
        : 100;
    const dataZoom = [
        { type: "inside", xAxisIndex: 0, start: 0, end: fimZoom },
        { type: "slider", xAxisIndex: 0, start: 0, end: fimZoom, height: 14, bottom: 6 },
    ];
    const grid = { left: 70, right: 20, top: 40, bottom: 96 };
    const gridSemLegenda = { left: 70, right: 40, top: 40, bottom: 66 };
    const xAxis = { type: "category", data: nomes, axisLabel: { rotate: 30, interval: 0, fontSize: 10 } };
    const yMoeda = { type: "value", axisLabel: { formatter: fmtMoedaCurta } };

    // 1) Rentabilidade: fechado x lucro esperado x lucro realizado
    const cRent = obterChart("chart-rentabilidade");
    if (cRent) cRent.setOption({
        tooltip: tooltipMoeda,
        legend: { bottom: 26, data: ["Valor fechado", "Lucro esperado", "Lucro realizado"] },
        grid, xAxis, yAxis: yMoeda, dataZoom,
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
        legend: { bottom: 26, data: ["Staff orçado", "Staff real"] },
        grid, xAxis, yAxis: yMoeda, dataZoom,
        series: [
            { name: "Staff orçado", type: "bar", color: "#b0b6bd", data: analises.map((x) => x.a.staffOrcado) },
            { name: "Staff real", type: "bar", color: "#942123", data: analises.map((x) => x.a.staffReal) },
        ],
    }, true);

    // 3) Margem por evento (cor por faixa do veredito)
    const cMargem = obterChart("chart-margem");
    if (cMargem) cMargem.setOption({
        tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (v) => pct(v) },
        grid: gridSemLegenda, xAxis, dataZoom,
        yAxis: { type: "value", axisLabel: { formatter: "{value}%" } },
        series: [{
            name: "Margem realizada", type: "bar",
            data: analises.map((x) => ({ value: Number(x.a.margemRealizada.toFixed(1)), itemStyle: { color: corNivel[x.a.nivel] } })),
            markLine: {
                silent: true, symbol: "none",
                data: [
                    { yAxis: FAIXAS.ok, lineStyle: { color: "#e0a106", type: "dashed" }, label: { formatter: "Mínimo", position: "insideEndTop" } },
                    { yAxis: FAIXAS.otimo, lineStyle: { color: "#1e9e54", type: "dashed" }, label: { formatter: "Ótimo", position: "insideEndTop" } },
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
    // Orçado x cadastrado (staffeventos) — o núcleo do que o dashboard responde.
    const totStaffOrcado = analises.reduce((s, x) => s + x.a.staffOrcado, 0);
    const totStaffReal = analises.reduce((s, x) => s + x.a.staffReal, 0);
    const saldoStaff = totStaffOrcado - totStaffReal;

    el.style.display = "grid";
    el.innerHTML = `
        <div class="ceo-resumo-card"><span>Eventos</span><strong>${analises.length}</strong></div>
        <div class="ceo-resumo-card"><span>Staff orçado</span><strong>${moeda(totStaffOrcado)}</strong></div>
        <div class="ceo-resumo-card"><span>Staff cadastrado (real)</span><strong>${moeda(totStaffReal)}</strong></div>
        <div class="ceo-resumo-card"><span>Saldo de staff</span><strong class="${saldoStaff < 0 ? "neg" : "pos"}">${moeda(saldoStaff)}</strong></div>
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
                    <small>${formatarOrcamentos(ev.nrorcamentos)} · ${formatarPeriodo(ev.dtinirealizacao, ev.dtfimrealizacao)}</small>
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
// Acesso restrito a quem tem a flag especial "supremo" (ver docs/PERMISSOES.md).
// O backend (rotas /ceo/*) é quem realmente bloqueia; isto aqui é só UX.
function initCeoMode() {
    const li = document.querySelector("li.Ceo");
    const link = li?.querySelector("a");
    if (!li || !link) return;

    const temAcesso = window.temPermissao?.("Staff", "supremo") ?? false;
    if (!temAcesso) {
        li.style.display = "none";
        return;
    }
    li.style.display = "";

    const icone = link.querySelector(".material-symbols-outlined");

    link.addEventListener("click", (e) => {
        e.preventDefault();
        const ativo = document.body.classList.toggle("ceo-mode");
        if (icone) icone.textContent = ativo ? "logout" : "finance";
        link.title = ativo ? "Sair do CEO Mode" : "CEO Mode";
        if (ativo) montarPainel();
    });
}

// Espera window.permissoes estar disponível antes de checar temPermissao (evita
// esconder o CEO Mode por engano por causa do carregamento assíncrono em Index.js).
document.addEventListener("DOMContentLoaded", () => {
    if (Array.isArray(window.permissoes)) initCeoMode();
    else document.addEventListener("permissoesCarregadas", initCeoMode, { once: true });
});
