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

// Calcula os números derivados e o veredito de um evento.
function analisarEvento(ev) {
    const venda = Number(ev.totgeralvda) || 0;
    const fechado = Number(ev.vlrcliente) > 0 ? Number(ev.vlrcliente) : venda;
    const lucroEsperado = Number(ev.lucroreal) || 0;
    const staffOrcado = Number(ev.custo_staff_orcado) || 0;
    const staffReal = Number(ev.custo_staff_real) || 0;

    // Desvio de custo de staff (real - orçado). Positivo = gastou mais que o previsto.
    const desvioStaff = staffReal - staffOrcado;
    // Lucro realizado: lucro esperado ajustado pelo que o staff custou a mais/menos.
    const lucroRealizado = lucroEsperado - desvioStaff;
    const margemRealizada = fechado > 0 ? (lucroRealizado / fechado) * 100 : 0;

    let nivel, label;
    if (margemRealizada >= FAIXAS.otimo) { nivel = "otimo"; label = "✅ Valeu a pena"; }
    else if (margemRealizada >= FAIXAS.ok) { nivel = "ok"; label = "⚠️ Aceitável"; }
    else { nivel = "ruim"; label = "❌ Não valeu"; }

    return { venda, fechado, lucroEsperado, staffOrcado, staffReal, desvioStaff, lucroRealizado, margemRealizada, nivel, label };
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
            <h2>Painel CEO — Rentabilidade por Cliente</h2>
            <div class="ceo-controls">
                <span class="material-symbols-outlined">search</span>
                <select id="ceo-select-cliente">
                    <option value="">Carregando clientes...</option>
                </select>
            </div>
        </div>
        <div id="ceo-resumo" class="ceo-resumo" style="display:none;"></div>
        <div id="ceo-eventos" class="ceo-eventos">
            <p class="ceo-vazio">Selecione um cliente para ver os eventos e a análise de contratos.</p>
        </div>
        <p class="ceo-nota">Custo real considera o staff escalado/pago (cachê + ajuda + caixinha) por evento. Fornecedores/contas ainda não são vinculados por evento.</p>
    `;
    main.appendChild(panel);

    document.getElementById("ceo-select-cliente")
        .addEventListener("change", (e) => carregarAnalise(e.target.value));

    carregarClientes();
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
    } catch (err) {
        console.error("Erro ao carregar clientes (CEO):", err);
        select.innerHTML = '<option value="">Erro ao carregar clientes</option>';
    }
}

async function carregarAnalise(idcliente) {
    const cont = document.getElementById("ceo-eventos");
    const resumoEl = document.getElementById("ceo-resumo");

    if (!idcliente) {
        cont.innerHTML = '<p class="ceo-vazio">Selecione um cliente para ver os eventos e a análise de contratos.</p>';
        resumoEl.style.display = "none";
        return;
    }

    cont.innerHTML = '<p class="ceo-vazio">Carregando análise...</p>';
    try {
        const data = await fetchComToken(`/ceo/analise?idcliente=${idcliente}`);
        const eventos = (data && data.eventos) || [];

        if (eventos.length === 0) {
            cont.innerHTML = '<p class="ceo-vazio">Nenhum evento encontrado para este cliente.</p>';
            resumoEl.style.display = "none";
            return;
        }

        const analises = eventos.map((ev) => ({ ev, a: analisarEvento(ev) }));
        renderResumo(resumoEl, analises);
        renderEventos(cont, analises);
    } catch (err) {
        console.error("Erro ao carregar análise (CEO):", err);
        cont.innerHTML = '<p class="ceo-vazio">Erro ao carregar a análise.</p>';
        resumoEl.style.display = "none";
    }
}

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

function renderEventos(cont, analises) {
    cont.innerHTML = "";
    analises.forEach(({ ev, a }) => {
        const card = document.createElement("div");
        card.className = `ceo-evento nivel-${a.nivel}`;
        card.innerHTML = `
            <div class="ceo-evt-topo">
                <div class="ceo-evt-nome">${ev.nmevento || "Evento"} <small>#${ev.nrorcamento ?? "-"}</small></div>
                <span class="ceo-badge badge-${a.nivel}">${a.label}</span>
            </div>
            <div class="ceo-evt-grid">
                <div><span>Valor fechado</span><strong>${moeda(a.fechado)}</strong></div>
                <div><span>Lucro esperado</span><strong>${moeda(a.lucroEsperado)}</strong></div>
                <div><span>Lucro realizado</span><strong>${moeda(a.lucroRealizado)}</strong></div>
                <div><span>Margem realizada</span><strong>${pct(a.margemRealizada)}</strong></div>
                <div><span>Staff orçado</span><strong>${moeda(a.staffOrcado)}</strong></div>
                <div><span>Staff real</span><strong>${moeda(a.staffReal)}</strong></div>
                <div><span>Desvio de staff</span><strong class="${a.desvioStaff > 0 ? "neg" : "pos"}">${moeda(a.desvioStaff)}</strong></div>
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
