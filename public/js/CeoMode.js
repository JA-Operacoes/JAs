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

// Explicação em linguagem simples de cada valor exibido — vira tooltip nativo (title) ao
// passar o mouse no rótulo, pra quem não conhece a fórmula de cor não precisar perguntar.
const EXPLICACOES = {
    gastoPrevisto: "Custo total orçado do orçamento: staff + equipamento + suprimento.",
    valorFechado: "Valor Total do Cliente, já líquido de desconto/acréscimo (ou o total de venda, se não houver valor fechado registrado).",
    lucroEsperado: "Lucro calculado no próprio orçamento: venda menos custo, ajuda de custo, imposto e custo fixo.",
    lucroRealizado: "Lucro esperado ajustado pela diferença entre staff orçado e staff cadastrado (só depois que o evento termina de verdade).",
    margem: "Lucro realizado dividido pelo Valor fechado.",
    staffOrcado: "Custo orçado (cachê + ajuda de custo) só dos itens de função do orçamento — não inclui equipamento/suprimento.",
    staffReal: "O que já foi de fato cadastrado em Staff (cachê + ajuda de custo, já com ajuste de custo/caixinha quando autorizados), mais ajustes financeiros (crédito/débito) já pagos.",
    saldoStaff: "Staff orçado menos Staff cadastrado (real). Positivo = sobrou orçamento; negativo = estourou.",
    eventos: "Quantidade de eventos que aparecem no filtro atual.",
    demaisCustos: "Não é um custo único: é o que sobra do Valor fechado depois de tirar o Custo de staff (real) e o Lucro realizado. Mistura equipamento, suprimento, imposto, custo fixo e eventual resíduo da fórmula.",
};

// Monta um <span> com tooltip nativo (title) explicando o valor — some ao passar o mouse.
// Nome "explicarValor" (não "dica") de propósito: renderEventos() já usa uma variável local
// "dica" pro texto "comparar anos ›" — nomes iguais dariam shadowing e chamariam a errada.
const explicarValor = (texto, chave) => `<span title="${EXPLICACOES[chave] || ""}">${texto}</span>`;

// Formata a lista de números de orçamento de um evento, cada um como botão clicável que abre
// o orçamento no módulo (ver abrirOrcamento): "Orçamentos: #1394, #1402 (2)".
function formatarOrcamentos(nrorcamentos) {
    const lista = Array.isArray(nrorcamentos) ? nrorcamentos.filter((n) => n != null) : [];
    if (lista.length === 0) return "Sem orçamento";
    const botoes = lista
        .map((n) => `<button type="button" class="ceo-link-orcamento" data-nrorcamento="${n}" title="Abrir orçamento #${n}">#${n}</button>`)
        .join(", ");
    return `Orçamentos: ${botoes} (${lista.length})`;
}

// Abre um orçamento existente no módulo de Orçamento — mesmo mecanismo já usado em Main.js
// (aciona o link do menu, espera o form montar dentro do modal e preenche via
// preencherFormularioComOrcamento, já que o disparo de Enter sozinho não garante o preenchimento).
async function abrirOrcamento(nrOrcamento) {
    if (window.temPermissao && !window.temPermissao("Orcamentos", "pesquisar")) {
        alert("Você não tem permissão para abrir orçamentos.");
        return;
    }
    const linkModal = document.querySelector('.abrir-modal[data-modulo="Orcamentos"]');
    if (!linkModal) {
        alert("Módulo de Orçamento não está disponível nesta tela.");
        return;
    }
    // Avisa o fecharModal() (Index.js) que veio do CEO Mode, pra ele não dar reload geral da
    // página ao fechar (perderia os filtros/posição do painel) — mesmo padrão já usado pelo Aside.
    sessionStorage.setItem("origemAbertura", "ceo");
    linkModal.click();

    // Espera não só o #nrOrcamento existir, mas o módulo ter terminado o setup
    // assíncrono: Flatpickr de Marcação já anexado ao elemento (senão o loop de
    // preenchimento de datas em preencherFormularioComOrcamento roda sobre um
    // flatpickrInstances vazio) e os selects de Local de Montagem/Empresa Emissora
    // já com as <option> carregadas (senão select.value = idMontagem não encontra
    // a option correspondente e fica vazio). Mesmo mecanismo já usado em Aside.js.
    const aguardarModalPronto = () => new Promise((resolve) => {
        const tentativa = setInterval(() => {
            const input = document.getElementById("nrOrcamento");
            const campoMarcacao = document.getElementById("periodoMarcacao");
            const selectMontagem = document.querySelector(".idMontagem");
            const selectEmpresaEmissora = document.querySelector(".idEmpresaEmissora");
            if (
                input &&
                typeof window.preencherFormularioComOrcamento === "function" &&
                campoMarcacao && campoMarcacao._flatpickr &&
                selectMontagem && selectMontagem.options.length > 1 &&
                selectEmpresaEmissora && selectEmpresaEmissora.options.length > 1
            ) {
                clearInterval(tentativa);
                resolve(input);
            }
        }, 50);
        setTimeout(() => {
            clearInterval(tentativa);
            resolve(document.getElementById("nrOrcamento") || null);
        }, 5000);
    });

    const inputNr = await aguardarModalPronto();
    if (!inputNr || typeof window.preencherFormularioComOrcamento !== "function") {
        console.warn("⚠️ Modal não ficou pronto a tempo (campo ou função de preenchimento ausentes).");
        return;
    }

    inputNr.value = nrOrcamento;
    inputNr.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, bubbles: true }));
    try {
        const orcDet = await fetchComToken(`orcamentos?nrOrcamento=${nrOrcamento}`);
        // Usa window.preencherFormularioComOrcamento (exposta pelo próprio
        // script do módulo já injetado no modal) em vez de `import("./Orcamentos.js")`:
        // esse import dinâmico cria uma SEGUNDA instância do módulo, cujo
        // `flatpickrInstances` nunca foi populado (nunca rodou o setup do modal),
        // então os campos de período (Marcação/Montagem/Realização/Desmontagem)
        // ficavam sempre vazios mesmo com o resto do formulário preenchido.
        if (!orcDet || Array.isArray(orcDet) || !orcDet.idorcamento) {
            console.warn("Orçamento não encontrado ao abrir pelo CEO Mode:", nrOrcamento);
            return;
        }
        window.preencherFormularioComOrcamento?.(orcDet);
    } catch (err) {
        console.error("Erro ao abrir orçamento (CEO):", err);
    }
}

// Formata o período de realização do evento: "12/08/2026 a 15/08/2026".
function formatarPeriodo(dtInicio, dtFim) {
    const fmt = (d) => new Date(d).toLocaleDateString("pt-BR");
    if (dtInicio && dtFim) return `${fmt(dtInicio)} a ${fmt(dtFim)}`;
    if (dtInicio || dtFim) return fmt(dtInicio || dtFim);
    return "Sem período definido";
}

// Versão enxuta ("05/05-09/05", sem ano) só pro rótulo do eixo dos gráficos — o ano já
// aparece no título do gráfico, e a versão completa (com ano) ficava longa demais e as
// datas de barras vizinhas se grudavam quando o texto não é rotacionado.
function formatarPeriodoCurto(dtInicio, dtFim) {
    const fmt = (d) => {
        const x = new Date(d);
        return `${String(x.getDate()).padStart(2, "0")}/${String(x.getMonth() + 1).padStart(2, "0")}`;
    };
    if (dtInicio && dtFim) return `${fmt(dtInicio)}-${fmt(dtFim)}`;
    if (dtInicio || dtFim) return fmt(dtInicio || dtFim);
    return "";
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

    const main = document.getElementById("ceo-panel-wrapper") || document.getElementById("conteudo");
    if (!main) return;

    const panel = document.createElement("div");
    panel.id = "ceo-panel";
    panel.innerHTML = `
        <div class="ceo-header">
            <h2>CEO Mode — Rentabilidade por Evento</h2>
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
                <select id="ceo-select-periodo-rapido" style="display:none;">
                    <option value="">Período rápido...</option>
                    <optgroup label="Mensal">
                        <option value="mensal-1">Janeiro</option>
                        <option value="mensal-2">Fevereiro</option>
                        <option value="mensal-3">Março</option>
                        <option value="mensal-4">Abril</option>
                        <option value="mensal-5">Maio</option>
                        <option value="mensal-6">Junho</option>
                        <option value="mensal-7">Julho</option>
                        <option value="mensal-8">Agosto</option>
                        <option value="mensal-9">Setembro</option>
                        <option value="mensal-10">Outubro</option>
                        <option value="mensal-11">Novembro</option>
                        <option value="mensal-12">Dezembro</option>
                    </optgroup>
                    <optgroup label="Bimestral">
                        <option value="bimestral-1">1º Bimestre (Jan-Fev)</option>
                        <option value="bimestral-2">2º Bimestre (Mar-Abr)</option>
                        <option value="bimestral-3">3º Bimestre (Mai-Jun)</option>
                        <option value="bimestral-4">4º Bimestre (Jul-Ago)</option>
                        <option value="bimestral-5">5º Bimestre (Set-Out)</option>
                        <option value="bimestral-6">6º Bimestre (Nov-Dez)</option>
                    </optgroup>
                    <optgroup label="Trimestral">
                        <option value="trimestral-1">1º Trimestre (Jan-Mar)</option>
                        <option value="trimestral-2">2º Trimestre (Abr-Jun)</option>
                        <option value="trimestral-3">3º Trimestre (Jul-Set)</option>
                        <option value="trimestral-4">4º Trimestre (Out-Dez)</option>
                    </optgroup>
                    <optgroup label="Semestral">
                        <option value="semestral-1">1º Semestre (Jan-Jun)</option>
                        <option value="semestral-2">2º Semestre (Jul-Dez)</option>
                    </optgroup>
                </select>
                <select id="ceo-select-ordem">
                    <option value="">Ordenar por: gasto previsto</option>
                    <option value="lucro-desc">Ordenar por lucro: maior primeiro</option>
                    <option value="lucro-asc">Ordenar por lucro: menor primeiro</option>
                    <option value="periodo-asc">Ordenar por período: mais cedo primeiro</option>
                    <option value="periodo-desc">Ordenar por período: mais tarde primeiro</option>
                </select>
                <button id="ceo-btn-limpar-filtros" type="button" class="secundario">Limpar filtros</button>
                <button id="ceo-btn-comparar" type="button">Comparar eventos</button>
            </div>
            <div class="ceo-status-filtro">
                <span class="ceo-status-label">Status:</span>
                <button type="button" class="ceo-status-chip ceo-status-chip-todos ativo" data-nivel="todos">Todos</button>
                <button type="button" class="ceo-status-chip ativo" data-nivel="otimo">✅ Valeu a pena</button>
                <button type="button" class="ceo-status-chip ativo" data-nivel="ok">⚠️ Aceitável</button>
                <button type="button" class="ceo-status-chip ativo" data-nivel="andamento">🔄 Em andamento</button>
                <button type="button" class="ceo-status-chip ativo" data-nivel="pendente">⏳ Ainda não realizado</button>
                <button type="button" class="ceo-status-chip ativo" data-nivel="ruim">❌ Não valeu</button>
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
        <div class="ceo-titulo-linha">
            <button id="ceo-btn-voltar-anos" type="button" class="ceo-btn-voltar" style="display:none;">← Voltar</button>
            <h3 id="ceo-titulo" class="ceo-titulo"></h3>
        </div>
        <div id="ceo-anos-filtro" class="ceo-anos-filtro" style="display:none;"></div>
        <div id="ceo-eventos" class="ceo-eventos">
            <p class="ceo-vazio">Carregando destaque da semana...</p>
        </div><br>
        <div id="ceo-resumo" class="ceo-resumo" style="display:none;"></div>
        <div id="ceo-graficos-header" class="ceo-graficos-header" style="display:none;">
            <button id="ceo-btn-expandir-graficos" type="button" class="ceo-btn-voltar">⤢ Expandir gráficos</button>
        </div>
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
        .addEventListener("change", () => {
            atualizarVisibilidadePeriodoRapido();
            aplicarFiltros();
        });
    document.getElementById("ceo-data-inicio")
        .addEventListener("change", () => {
            document.getElementById("ceo-select-periodo-rapido").value = ""; // data digitada na mão substitui o período rápido
            aplicarFiltros();
        });
    document.getElementById("ceo-data-fim")
        .addEventListener("change", () => {
            document.getElementById("ceo-select-periodo-rapido").value = "";
            aplicarFiltros();
        });
    document.getElementById("ceo-select-periodo-rapido")
        .addEventListener("change", (e) => {
            const valor = e.target.value;
            const ano = parseInt(document.getElementById("ceo-select-ano")?.value || "", 10);
            if (!valor || !ano) return;
            const periodo = calcularPeriodoRapido(valor, ano);
            if (!periodo) return;
            document.getElementById("ceo-data-inicio").value = periodo.dtInicio;
            document.getElementById("ceo-data-fim").value = periodo.dtFim;
            aplicarFiltros();
        });
    document.getElementById("ceo-select-ordem")
        .addEventListener("change", aplicarFiltroStatusEOrdenacao);
    const chipTodos = document.querySelector(".ceo-status-chip-todos");
    const chipsDeStatus = Array.from(document.querySelectorAll(".ceo-status-chip:not(.ceo-status-chip-todos)"));
    if (chipTodos) {
        chipTodos.addEventListener("click", () => {
            chipsDeStatus.forEach((c) => c.classList.add("ativo"));
            chipTodos.classList.add("ativo");
            aplicarFiltroStatusEOrdenacao();
        });
    }
    chipsDeStatus.forEach((chip) => {
        chip.addEventListener("click", () => {
            chip.classList.toggle("ativo");
            // "Todos" só fica marcado quando TODOS os status individuais estão ativos.
            if (chipTodos) chipTodos.classList.toggle("ativo", chipsDeStatus.every((c) => c.classList.contains("ativo")));
            aplicarFiltroStatusEOrdenacao();
        });
    });
    document.getElementById("ceo-btn-voltar-anos")
        .addEventListener("click", voltarDaComparacaoPorAno);
    document.getElementById("ceo-btn-expandir-graficos")
        .addEventListener("click", alternarExpandirGraficos);
    // Delegado no container (os botões "#nrOrcamento" são recriados a cada renderEventos).
    document.getElementById("ceo-eventos").addEventListener("click", (e) => {
        const btn = e.target.closest(".ceo-link-orcamento");
        if (!btn) return;
        e.stopPropagation(); // não deixa o clique "vazar" pro card (que abriria comparar-anos)
        abrirOrcamento(btn.dataset.nrorcamento);
    });

    carregarClientes();
    carregarEventosFiltro();
    // O painel abre já filtrado no ano vigente (assim que a lista de anos carrega), pra o CEO
    // ver de cara o panorama do ano corrente em vez de só o destaque da semana.
    carregarAnosDisponiveis().then(() => {
        definirAnoVigente();
        atualizarVisibilidadePeriodoRapido();
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

// O período rápido (mensal/bimestral/trimestral/semestral) só faz sentido com um ano
// específico selecionado — com "Todos os anos" não dá pra saber de qual ano é o mês/trimestre.
function atualizarVisibilidadePeriodoRapido() {
    const ano = document.getElementById("ceo-select-ano")?.value || "";
    const sel = document.getElementById("ceo-select-periodo-rapido");
    if (sel) sel.style.display = ano ? "" : "none";
}

// Formata uma data local como "AAAA-MM-DD" pro <input type="date"> — sem usar toISOString(),
// que converte pra UTC e pode voltar um dia dependendo do fuso horário.
function paraInputDate(d) {
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, "0");
    const dia = String(d.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
}

// Traduz "mensal-3", "trimestral-2" etc. no intervalo De/Até daquele pedaço do ano informado.
function calcularPeriodoRapido(valor, ano) {
    const [tipo, indiceStr] = valor.split("-");
    const TAMANHO_EM_MESES = { mensal: 1, bimestral: 2, trimestral: 3, semestral: 6 };
    const tamanho = TAMANHO_EM_MESES[tipo];
    const indice = parseInt(indiceStr, 10);
    if (!tamanho || !indice) return null;

    const mesInicio = (indice - 1) * tamanho; // 0-based (Date usa mês 0-11)
    const dtInicio = new Date(ano, mesInicio, 1);
    const dtFim = new Date(ano, mesInicio + tamanho, 0); // dia 0 do mês seguinte = último dia do período
    return { dtInicio: paraInputDate(dtInicio), dtFim: paraInputDate(dtFim) };
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
    document.getElementById("ceo-select-periodo-rapido").value = "";
    definirAnoVigente(); // seta ANTES dos triggers abaixo, pra já valer no aplicarFiltros deles
    atualizarVisibilidadePeriodoRapido();

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
// Guarda o que estava na tela antes de entrar na comparação por ano, pra o botão "Voltar"
// restaurar exatamente aquilo (destaque da semana, um filtro aplicado, ou comparação manual).
let estadoAntesDeAnos = null;

function voltarDaComparacaoPorAno() {
    if (!estadoAntesDeAnos) { carregarDestaque(); return; }
    ultimaAnalise = estadoAntesDeAnos;
    estadoAntesDeAnos = null;
    aplicarFiltroStatusEOrdenacao();
}

async function carregarEventoAnos(idevento, nome) {
    estadoAntesDeAnos = ultimaAnalise;
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
    const h = document.getElementById("ceo-graficos-header");
    if (r) r.style.display = "none";
    if (g) g.style.display = "none";
    if (h) h.style.display = "none";
}

// Renderiza um conjunto de eventos já carregados (resumo + gráficos + cards).
// Cache do último resultado bruto vindo do servidor — filtro de status e ordenação por
// lucro reaplicam em cima dele sem precisar buscar de novo (são derivados, não vêm da API).
let ultimaAnalise = null;

function renderAnalise(eventos, titulo, modo) {
    ultimaAnalise = { eventos, titulo, modo };
    aplicarFiltroStatusEOrdenacao();
}

// Lê os chips de status marcados/desmarcados no DOM.
function statusSelecionados() {
    const ativos = new Set();
    document.querySelectorAll(".ceo-status-chip.ativo:not(.ceo-status-chip-todos)").forEach((chip) => ativos.add(chip.dataset.nivel));
    return ativos;
}

// Reaplica o filtro de status e a ordenação por lucro sobre o último resultado carregado,
// e re-renderiza resumo/gráficos/cards — sem nova busca ao servidor.
function aplicarFiltroStatusEOrdenacao() {
    if (!ultimaAnalise) return;
    const { eventos, titulo, modo } = ultimaAnalise;
    const cont = document.getElementById("ceo-eventos");
    const resumoEl = document.getElementById("ceo-resumo");
    document.getElementById("ceo-titulo").textContent = titulo || "";

    const btnVoltar = document.getElementById("ceo-btn-voltar-anos");
    if (btnVoltar) btnVoltar.style.display = modo === "anos" ? "inline-block" : "none";

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

    const statusAtivos = statusSelecionados();
    let analises = eventos
        .map((ev) => ({ ev, a: analisarEvento(ev) }))
        .filter((x) => statusAtivos.has(x.a.nivel));

    const ordem = document.getElementById("ceo-select-ordem")?.value || "";
    const dataInicioMs = (x) => x.ev.dtinirealizacao ? new Date(x.ev.dtinirealizacao).getTime() : Infinity;
    if (ordem === "lucro-desc") analises.sort((x, y) => y.a.lucroRealizado - x.a.lucroRealizado);
    else if (ordem === "lucro-asc") analises.sort((x, y) => x.a.lucroRealizado - y.a.lucroRealizado);
    else if (ordem === "periodo-asc") analises.sort((x, y) => dataInicioMs(x) - dataInicioMs(y));
    else if (ordem === "periodo-desc") analises.sort((x, y) => dataInicioMs(y) - dataInicioMs(x));

    if (analises.length === 0) {
        cont.innerHTML = '<p class="ceo-vazio">Nenhum evento com os status selecionados.</p>';
        ocultarResultados();
        return;
    }

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
    if (!inst) {
        inst = echarts.init(el);
        // O ECharts só re-mede o container sozinho no evento de resize da JANELA — trocar de
        // modo/Exibição, ligar "Dividir tela" etc. muda a largura via CSS (grid/flex) sem disparar
        // esse evento, então o gráfico ficava preso no tamanho medido na primeira renderização
        // (esticado ou espremido conforme o container mudasse depois). ResizeObserver cobre
        // qualquer mudança de layout, não só a janela.
        if (typeof ResizeObserver !== "undefined") {
            new ResizeObserver(() => inst.resize()).observe(el);
        }
    }
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

// Guarda o último conjunto de análises usado nos gráficos, pra poder redesenhar os rótulos
// do eixo (com/sem período) quando o botão "Expandir" muda o modo, sem refazer a busca.
let analisesGraficoAtual = null;

function renderGraficos(analises) {
    analisesGraficoAtual = analises;
    const graficosEl = document.getElementById("ceo-graficos");
    if (!graficosEl) return;
    graficosEl.style.display = "grid";
    const headerEl = document.getElementById("ceo-graficos-header");
    if (headerEl) headerEl.style.display = "flex";
    atualizarTitulosGraficos();

    if (typeof echarts === "undefined") {
        graficosEl.innerHTML = '<p class="ceo-vazio">Biblioteca de gráficos (ECharts) não carregada.</p>';
        return;
    }

    // Na versão expandida (mais espaço por gráfico) mostra o período junto do nome, numa
    // segunda linha, sem ano (já está no título) — na grade compacta fica só o nome, curto,
    // pra não espremer demais.
    const expandido = graficosEl.classList.contains("expandido");
    const nomes = analises.map((x) => expandido
        ? `${nomeCurto(x.ev.nmevento, 30)}\n${formatarPeriodoCurto(x.ev.dtinirealizacao, x.ev.dtfimrealizacao)}`
        : nomeCurto(x.ev.nmevento));
    const tooltipMoeda = {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        valueFormatter: (v) => moeda(v),
    };
    // Com muitos eventos no filtro (ex.: ano inteiro), espremer todas as barras na largura
    // deixa os nomes ilegíveis — em vez disso mostra só um recorte inicial e deixa
    // rolar/dar zoom (slider embaixo + zoom por scroll do mouse) pra ver o resto. Expandido
    // mostra menos barras de cada vez (rótulo de 2 linhas precisa de mais espaço horizontal).
    const QTD_VISIVEL_PADRAO = expandido ? 12 : 20;
    const fimZoom = analises.length > QTD_VISIVEL_PADRAO
        ? (QTD_VISIVEL_PADRAO / analises.length) * 100
        : 100;
    // Só o slider (sem "inside"): o tipo "inside" captura a rolagem do mouse como zoom, então
    // rolar a página com o cursor em cima do gráfico zoomava sem querer numa fatia minúscula.
    const dataZoom = [
        { type: "slider", xAxisIndex: 0, start: 0, end: fimZoom, height: 14, bottom: 6 },
    ];
    const grid = { left: 70, right: 20, top: 40, bottom: 96 };
    const gridSemLegenda = { left: 70, right: 40, top: 40, bottom: 66 };
    // Rotacionado na grade compacta (nome curto, 1 linha); reto na expandida (nome + período,
    // 2 linhas — rotacionar um bloco de 2 linhas fica ilegível, sobrepondo texto).
    const xAxis = { type: "category", data: nomes, axisLabel: { rotate: expandido ? 0 : 30, interval: 0, fontSize: expandido ? 9 : 10 } };
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
        tooltip: {
            trigger: "item",
            formatter: (params) => {
                let texto = `${params.marker} ${params.name}: <strong>${moeda(params.value)}</strong> (${params.percent}%)`;
                const explicacao = params.name === "Demais custos" ? EXPLICACOES.demaisCustos : null;
                if (explicacao) texto += `<br/><span style="font-size:11px;color:#888;max-width:220px;display:inline-block;white-space:normal;">${explicacao}</span>`;
                return texto;
            },
        },
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

// Força o ECharts a recalcular o tamanho de cada gráfico (janela mudou, ou o layout mudou
// por causa do botão "Expandir").
function redimensionarGraficos() {
    if (typeof echarts === "undefined") return;
    ["chart-rentabilidade", "chart-staff", "chart-margem", "chart-rosca",
     "chart-geral-contratado", "chart-geral-provisao", "chart-contas-contratado", "chart-contas-provisao",
     "chart-contas-receber-contratado", "chart-contas-receber-provisao", "chart-contas-receber-eventos"].forEach((id) => {
        const el = document.getElementById(id);
        const inst = el && echarts.getInstanceByDom(el);
        if (inst) inst.resize();
    });
}

window.addEventListener("resize", redimensionarGraficos);

// Alterna entre a grade padrão (vários gráficos lado a lado, mais compacto) e um layout
// expandido (um gráfico por linha, ocupando a largura toda) — ajuda a ler o eixo/zoom quando
// tem muitos eventos no filtro (ex.: ano inteiro).
function alternarExpandirGraficos() {
    const graficosEl = document.getElementById("ceo-graficos");
    const btn = document.getElementById("ceo-btn-expandir-graficos");
    if (!graficosEl || !btn) return;
    const expandido = graficosEl.classList.toggle("expandido");
    btn.textContent = expandido ? "⤡ Recolher gráficos" : "⤢ Expandir gráficos";
    // Espera o navegador terminar de aplicar o novo layout (grid 1 coluna x 4 colunas) antes de
    // redesenhar — lendo a largura do container "no meio" da troca, o ECharts trava com o
    // tamanho antigo e o gráfico fica ocupando só metade do espaço, com rótulos embolados.
    requestAnimationFrame(() => {
        if (analisesGraficoAtual) {
            // Redesenha com os rótulos certos pro modo novo (expandido mostra o período junto
            // do nome do evento).
            renderGraficos(analisesGraficoAtual);
        }
        // setOption() (chamado dentro de renderGraficos) NÃO remede o container sozinho — só
        // resize() faz o ECharts adotar o tamanho novo do card. Sem isso, o gráfico redesenha
        // com os dados certos mas preso no tamanho antigo (ocupa só um pedaço do espaço).
        redimensionarGraficos();
    });
}

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
        <div class="ceo-resumo-card">${explicarValor("Eventos", "eventos")}<strong>${analises.length}</strong></div>
        <div class="ceo-resumo-card">${explicarValor("Staff orçado", "staffOrcado")}<strong>${moeda(totStaffOrcado)}</strong></div>
        <div class="ceo-resumo-card">${explicarValor("Staff cadastrado (real)", "staffReal")}<strong>${moeda(totStaffReal)}</strong></div>
        <div class="ceo-resumo-card">${explicarValor("Saldo de staff", "saldoStaff")}<strong class="${saldoStaff < 0 ? "neg" : "pos"}">${moeda(saldoStaff)}</strong></div>
        <div class="ceo-resumo-card">${explicarValor("Faturamento fechado", "valorFechado")}<strong>${moeda(totVenda)}</strong></div>
        <div class="ceo-resumo-card">${explicarValor("Lucro esperado", "lucroEsperado")}<strong>${moeda(totEsperado)}</strong></div>
        <div class="ceo-resumo-card">${explicarValor("Lucro realizado", "lucroRealizado")}<strong>${moeda(totRealizado)}</strong></div>
        <div class="ceo-resumo-card">${explicarValor("Margem média", "margem")}<strong>${pct(margemMedia)}</strong></div>
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
                <div>${explicarValor("Gasto previsto", "gastoPrevisto")}<strong>${moeda(a.custoPrevisto)}</strong></div>
                <div>${explicarValor("Valor fechado", "valorFechado")}<strong>${moeda(a.fechado)}</strong></div>
                <div>${explicarValor("Lucro esperado", "lucroEsperado")}<strong>${moeda(a.lucroEsperado)}</strong></div>
                <div>${explicarValor("Lucro realizado", "lucroRealizado")}<strong>${moeda(a.lucroRealizado)}</strong></div>
                <div>${explicarValor("Margem realizada", "margem")}<strong>${pct(a.margemRealizada)}</strong></div>
                <div>${explicarValor("Staff orçado", "staffOrcado")}<strong>${moeda(a.staffOrcado)}</strong></div>
                <div>${explicarValor("Staff real", "staffReal")}<strong>${moeda(a.staffReal)}</strong></div>
                <div>${explicarValor("Saldo de Staff", "saldoStaff")}<strong class="${a.saldoStaff < 0 ? "neg" : "pos"}">${moeda(a.saldoStaff)}</strong></div>
            </div>
        `;
        cont.appendChild(card);
    });
}

// ===== Visão Geral (todas as empresas) — remuneração de funcionários =====
const moedaGeral = moeda; // mesmo formatador; alias só p/ deixar claro que é usado aqui também

function statusClasse(status) {
    return status === "Pago" ? "pos" : (status === "Pendente" ? "neg" : "");
}

// Cor de marca por empresa: em vez de mapear manualmente, aplica a classe .tema-<nmfantasia> já
// definida em Roots.css (mesmo valor usado em aplicarTema(empresa.nmfantasia) noutras telas) —
// isso escopa as custom properties --primary-color/--font-color naquele elemento, e o CSS lê
// var(--primary-color) direto. nmfantasia PRECISA virar um nome de classe válido: espaço quebra
// em duas classes (className = "tema-SN FOODS" gera as classes "tema-SN" e "FOODS", nenhuma bate
// com ".tema-SN-FOODS" do Roots.css) — por isso troca espaço por hífen antes de montar a classe.
const classeTemaEmpresa = (nmfantasia) => `tema-${String(nmfantasia).trim().replace(/\s+/g, "-")}`;

// ECharts desenha em canvas — não lê classe CSS nem var(--primary-color) direto. Pra usar a MESMA
// cor de marca dos chips (Roots.css) nos gráficos, resolve o valor computado da variável uma vez
// (cria um elemento temporário com a classe .tema-X, lê getComputedStyle, cacheia o resultado).
// Empresa sem tema cadastrado no Roots.css (ex.: cadastrada recentemente, ainda sem identidade
// visual definida) cai numa cor gerada a partir do próprio nome — assim pelo menos fica
// consistente entre uma renderização e outra, e diferente de outra empresa igualmente sem tema
// (em vez de todas caírem no mesmo cinza genérico e ficarem indistinguíveis).
const corPrimariaEmpresaCache = new Map();
function corFallbackPorNome(nmfantasia) {
    let hash = 0;
    for (let i = 0; i < nmfantasia.length; i++) hash = (hash * 31 + nmfantasia.charCodeAt(i)) >>> 0;
    const hue = hash % 360;
    return `hsl(${hue}, 55%, 42%)`;
}
function corPrimariaEmpresa(nmfantasia) {
    if (corPrimariaEmpresaCache.has(nmfantasia)) return corPrimariaEmpresaCache.get(nmfantasia);
    const el = document.createElement("div");
    el.className = classeTemaEmpresa(nmfantasia);
    el.style.display = "none";
    document.body.appendChild(el);
    const corDoTema = getComputedStyle(el).getPropertyValue("--primary-color").trim();
    document.body.removeChild(el);
    const cor = corDoTema || corFallbackPorNome(nmfantasia);
    corPrimariaEmpresaCache.set(nmfantasia, cor);
    return cor;
}

// Mesma cor da empresa, mas com transparência — usado pro segmento "Pendente" dentro da barra
// empilhada, pra distinguir visualmente do segmento "sólido" (Pago/Recebido) sem precisar de uma
// segunda cor por empresa.
function corPrimariaEmpresaAlpha(nmfantasia, alpha) {
    const cor = corPrimariaEmpresa(nmfantasia);
    // Fallback gerado (corFallbackPorNome) já vem como "hsl(h, s%, l%)" — só troca pra hsla.
    if (cor.startsWith("hsl(")) return cor.replace("hsl(", "hsla(").replace(")", `, ${alpha})`);
    const hex = cor.replace("#", "");
    if (hex.length !== 6) return `rgba(90,107,123,${alpha})`; // último recurso, se a var vier num formato inesperado
    const r = parseInt(hex.substring(0, 2), 16), g = parseInt(hex.substring(2, 4), 16), b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}

let empresasGeral = [];              // todas as empresas cadastradas: [{idempresa, nmfantasia}]
let empresasSelecionadasGeral = null; // Set de idempresa ativos nas colunas (null = ainda não carregou)

function montarPainelGeral() {
    if (document.getElementById("ceo-panel-geral")) return;

    const main = document.getElementById("ceo-panel-wrapper") || document.getElementById("conteudo");
    if (!main) return;

    const panel = document.createElement("div");
    panel.id = "ceo-panel-geral";
    panel.style.display = "none";
    panel.innerHTML = `
        <div class="ceo-header">
            <h2>CEO Mode — Visão Geral</h2>
        </div>
        <div class="filtros ceo-geral-filtros">
            <div class="filtro-grupo">
                <label class="label-select">Visão</label>
                <div class="wrapper">
                    <div class="option">
                        <input class="input" type="radio" name="ceo-geral-modo" id="ceo-geral-modo-funcionarios" value="funcionarios" checked>
                        <label class="btn" for="ceo-geral-modo-funcionarios"><span class="span">👤 Funcionários</span></label>
                    </div>
                    <div class="option">
                        <input class="input" type="radio" name="ceo-geral-modo" id="ceo-geral-modo-contas" value="contas">
                        <label class="btn" for="ceo-geral-modo-contas"><span class="span">💰 Contas a pagar</span></label>
                    </div>
                    <div class="option">
                        <input class="input" type="radio" name="ceo-geral-modo" id="ceo-geral-modo-contas-receber" value="contas_receber">
                        <label class="btn" for="ceo-geral-modo-contas-receber"><span class="span">🧾 Contas a receber</span></label>
                    </div>
                    <div class="option">
                        <input class="input" type="radio" name="ceo-geral-modo" id="ceo-geral-modo-comparativo" value="comparativo">
                        <label class="btn" for="ceo-geral-modo-comparativo"><span class="span">⚖️ Comparar A Receber × A Pagar</span></label>
                    </div>
                </div>
            </div>
            <div class="filtro-grupo" id="ceo-geral-exibicao-grupo">
                <label class="label-select">Exibição</label>
                <div class="wrapper wrapper-exibicao">
                    <div class="option">
                        <input class="input" type="radio" name="ceo-geral-view" id="ceo-geral-view-lista" value="lista">
                        <label class="btn" for="ceo-geral-view-lista"><span class="span">📋 Lista</span></label>
                    </div>
                    <div class="option">
                        <input class="input" type="radio" name="ceo-geral-view" id="ceo-geral-view-graficos" value="graficos" checked>
                        <label class="btn" for="ceo-geral-view-graficos"><span class="span">📊 Gráficos</span></label>
                    </div>
                    <div class="option">
                        <input class="input" type="radio" name="ceo-geral-view" id="ceo-geral-view-split" value="split">
                        <label class="btn" for="ceo-geral-view-split"><span class="span">🗂️ Dividir tela</span></label>
                    </div>
                </div>
            </div>
            <div class="filtro-grupo">
                <label class="label-select">Ano</label>
                <div class="wrapper select-wrapper">
                    <select id="ceo-geral-select-ano" class="select-simples"></select>
                </div>
            </div>
            <div class="filtro-grupo filtro-grupo-empresas">
                <label class="label-select">Empresas</label>
                <div class="wrapper ceo-geral-empresas-filtro" id="ceo-geral-empresas-filtro">
                    <button type="button" class="ceo-status-chip ceo-status-chip-todos ativo" data-id="todos">Todas</button>
                </div>
            </div>
        </div>

        <div id="ceo-geral-busca-funcionario-wrap" class="ceo-geral-secao filtros" style="margin-bottom:14px;">
            <div class="filtro-grupo">
                <label class="label-select">&nbsp;</label>
                <div class="wrapper select-wrapper busca-funcionario-wrapper">
                    <input type="text" id="ceo-busca-funcionario" class="busca-funcionario-input" placeholder="Buscar funcionário..." autocomplete="off">
                    <i class="ri-search-line"></i>
                    <ul id="ceo-busca-funcionario-lista" class="busca-funcionario-lista" style="display:none;"></ul>
                </div>
            </div>
            <div class="filtro-grupo">
                <label class="label-select">Mês</label>
                <div class="wrapper select-wrapper">
                    <select id="ceo-func-select-mes" class="select-simples">
                        <option value="">Todos os meses</option>
                        <option value="1">Janeiro</option><option value="2">Fevereiro</option>
                        <option value="3">Março</option><option value="4">Abril</option>
                        <option value="5">Maio</option><option value="6">Junho</option>
                        <option value="7">Julho</option><option value="8">Agosto</option>
                        <option value="9">Setembro</option><option value="10">Outubro</option>
                        <option value="11">Novembro</option><option value="12">Dezembro</option>
                    </select>
                </div>
            </div>
        </div>

        <div id="ceo-geral-pagar-filtros-wrap" class="ceo-geral-secao filtros" style="display:none; margin-bottom:14px;">
            <div class="filtro-grupo">
                <label class="label-select">Mês</label>
                <div class="wrapper select-wrapper">
                    <select id="ceo-pagar-select-mes" class="select-simples">
                        <option value="">Todos os meses</option>
                        <option value="1">Janeiro</option><option value="2">Fevereiro</option>
                        <option value="3">Março</option><option value="4">Abril</option>
                        <option value="5">Maio</option><option value="6">Junho</option>
                        <option value="7">Julho</option><option value="8">Agosto</option>
                        <option value="9">Setembro</option><option value="10">Outubro</option>
                        <option value="11">Novembro</option><option value="12">Dezembro</option>
                    </select>
                </div>
            </div>
        </div>

        <div id="ceo-geral-receber-filtros-wrap" class="ceo-geral-secao filtros" style="display:none; margin-bottom:14px;">
            <div class="filtro-grupo">
                <label class="label-select">Mês</label>
                <div class="wrapper select-wrapper">
                    <select id="ceo-receber-select-mes" class="select-simples">
                        <option value="">Todos os meses</option>
                        <option value="1">Janeiro</option><option value="2">Fevereiro</option>
                        <option value="3">Março</option><option value="4">Abril</option>
                        <option value="5">Maio</option><option value="6">Junho</option>
                        <option value="7">Julho</option><option value="8">Agosto</option>
                        <option value="9">Setembro</option><option value="10">Outubro</option>
                        <option value="11">Novembro</option><option value="12">Dezembro</option>
                    </select>
                </div>
            </div>
        </div>

        <div id="ceo-geral-split-wrap" class="ceo-geral-split-wrap" style="display:none;"></div>

        <div id="ceo-geral-func-lista" class="ceo-geral-secao" style="display:none;">
            <p id="ceo-geral-vazio" class="ceo-vazio">Busque e selecione um funcionário para ver, empresa por empresa, tudo que ele já recebeu ou vai receber no ano.</p>
            <h3 id="ceo-geral-titulo" class="ceo-titulo" style="display:none;"></h3>
            <div id="ceo-geral-colunas" class="ceo-geral-resultado"></div>
        </div>

        <div id="ceo-geral-func-graficos" class="ceo-geral-secao">
            <p class="ceo-vazio-sutil" id="ceo-geral-graficos-legenda">Panorama do grupo inteiro (todos os funcionários) no ano — o que já é certo (contratado, pago ou pendente de pagamento) e a provisão de custo acumulada.</p>
            <p class="ceo-geral-empresas-resumo" id="ceo-func-empresas-resumo"></p>
            <div class="ceo-geral-graficos">
                <div class="ceo-chart-card">
                    <h3>Contratado no ano — Pago × Pendente</h3>
                    <div id="chart-geral-contratado" class="ceo-chart"></div>
                </div>
                <div class="ceo-chart-card">
                    <h3>Provisão de custo (acumulada no ano)</h3>
                    <div id="chart-geral-provisao" class="ceo-chart"></div>
                </div>
            </div>
        </div>

        <div id="ceo-geral-contas-lista" class="ceo-geral-secao" style="display:none;">
            <p class="ceo-vazio-sutil">Despesa real do grupo: Fornecedores/Outros (lançamentos de Contas a Pagar, inclusive parcelas futuras ainda não confirmadas) + Funcionários (folha/staff/ajustes). "Paga" = já confirmado; "Pendente" = ainda em aberto ou só previsto (ex.: lançamento recorrente sem parcela do mês ainda lançada).</p>
            <div id="ceo-geral-colunas-contas" class="ceo-geral-resultado"></div>
        </div>

        <div id="ceo-geral-contas-graficos" class="ceo-geral-secao" style="display:none;">
            <p class="ceo-vazio-sutil">Dado bruto de saída (fornecedores/outros + folha de funcionários) — sem cálculo de lucro/saldo aqui, isso já existe na aba Rentabilidade.</p>
            <p class="ceo-geral-empresas-resumo" id="ceo-pagar-empresas-resumo"></p>
            <div class="filtros" style="margin-bottom:14px;">
                <div class="filtro-grupo">
                    <label class="label-select">Agrupar por</label>
                    <div class="wrapper">
                        <div class="option">
                            <input class="input" type="radio" name="ceo-pagar-agrupamento" id="ceo-pagar-agrupamento-mensal" value="mensal" checked>
                            <label class="btn" for="ceo-pagar-agrupamento-mensal"><span class="span">Mensal</span></label>
                        </div>
                        <div class="option">
                            <input class="input" type="radio" name="ceo-pagar-agrupamento" id="ceo-pagar-agrupamento-anual" value="anual">
                            <label class="btn" for="ceo-pagar-agrupamento-anual"><span class="span">Anual</span></label>
                        </div>
                    </div>
                </div>
            </div>
            <div class="ceo-geral-graficos">
                <div class="ceo-chart-card">
                    <h3>Despesa — Paga × Pendente</h3>
                    <div id="chart-contas-contratado" class="ceo-chart"></div>
                </div>
                <div class="ceo-chart-card">
                    <h3>Despesa acumulada no período</h3>
                    <div id="chart-contas-provisao" class="ceo-chart"></div>
                </div>
            </div>
        </div>

        <div id="ceo-geral-contas-receber-lista" class="ceo-geral-secao" style="display:none;">
            <p class="ceo-vazio-sutil">Valor total do cliente (vlrcliente) por orçamento, partido pelo status real de faturamento (nota fiscal) e negociação: Recebido, A Receber, Recebimento Atrasado, A Faturar e Em Negociação.</p>
            <div id="ceo-geral-colunas-contas-receber" class="ceo-geral-resultado"></div>
        </div>

        <div id="ceo-geral-contas-receber-graficos" class="ceo-geral-secao" style="display:none;">
            <p class="ceo-vazio-sutil">Dado bruto de entrada (valor do cliente) — sem cálculo de lucro/saldo aqui, isso já existe na aba Rentabilidade.</p>
            <p class="ceo-geral-empresas-resumo" id="ceo-receber-empresas-resumo"></p>
            <div class="filtros" style="margin-bottom:14px;">
                <div class="filtro-grupo">
                    <label class="label-select">Agrupar por</label>
                    <div class="wrapper">
                        <div class="option">
                            <input class="input" type="radio" name="ceo-receber-agrupamento" id="ceo-receber-agrupamento-mensal" value="mensal" checked>
                            <label class="btn" for="ceo-receber-agrupamento-mensal"><span class="span">Mensal</span></label>
                        </div>
                        <div class="option">
                            <input class="input" type="radio" name="ceo-receber-agrupamento" id="ceo-receber-agrupamento-anual" value="anual">
                            <label class="btn" for="ceo-receber-agrupamento-anual"><span class="span">Anual</span></label>
                        </div>
                    </div>
                </div>
                <div class="filtro-grupo">
                    <label class="label-select">Comparar evento entre anos</label>
                    <div class="wrapper select-wrapper busca-funcionario-wrapper" style="width:300px;">
                        <input type="text" id="ceo-busca-evento-receber" class="busca-funcionario-input" placeholder="Buscar evento..." autocomplete="off">
                        <ul id="ceo-busca-evento-receber-lista" class="busca-funcionario-lista" style="display:none;"></ul>
                    </div>
                    <button type="button" id="ceo-receber-evento-limpar" class="secundario" style="display:none;">Limpar</button>
                </div>
            </div>
            <div class="ceo-geral-graficos">
                <div class="ceo-chart-card">
                    <h3>A receber — Recebido / A Receber / Atrasado / A Faturar / Em Negociação</h3>
                    <div id="chart-contas-receber-contratado" class="ceo-chart"></div>
                </div>
                <div class="ceo-chart-card">
                    <h3>A receber acumulado no período</h3>
                    <div id="chart-contas-receber-provisao" class="ceo-chart"></div>
                </div>
                <div class="ceo-chart-card">
                    <h3>Previsão de recebimento por mês (líquido, ainda não recebido)</h3>
                    <div id="chart-contas-receber-previsao" class="ceo-chart"></div>
                </div>
            </div>
            <button type="button" id="ceo-receber-detalhar" class="secundario" style="margin-top:14px; display:none;">🔍 Detalhar por empresa</button>
            <div id="ceo-receber-detalhe" style="display:none; margin-top:18px;">
                <div id="ceo-receber-ranking" class="ceo-resumo"></div>
                <div class="ceo-chart-card">
                    <h3>Recebido × Pendente por empresa (ordem cronológica)</h3>
                    <div id="chart-contas-receber-eventos" class="ceo-chart" style="height:380px;"></div>
                </div>
            </div>
        </div>

        <div id="ceo-geral-comparativo" class="ceo-geral-secao" style="display:none;">
            <p class="ceo-vazio-sutil">Cruza Contas a receber × Contas a pagar em duas versões — "Disponível pra investir" (só o que já é certo: recebido de verdade × já pago de verdade) e "Provisão de Disponível a Investir" (somando também o que ainda está previsto dos dois lados: a receber + atrasado + a faturar de um lado, pendente do outro). "Em Negociação" aparece à parte, entre parênteses — ainda não é previsão confiável (orçamento não fechado), mas fica visível como alerta pra correr atrás.</p>
            <p class="ceo-geral-empresas-resumo" id="ceo-comparativo-empresas-resumo"></p>
            <div class="filtros" style="margin-bottom:14px;">
                <div class="filtro-grupo">
                    <label class="label-select">Mês</label>
                    <div class="wrapper select-wrapper">
                        <select id="ceo-comparativo-select-mes" class="select-simples">
                            <option value="">Todos os meses</option>
                            <option value="1">Janeiro</option><option value="2">Fevereiro</option>
                            <option value="3">Março</option><option value="4">Abril</option>
                            <option value="5">Maio</option><option value="6">Junho</option>
                            <option value="7">Julho</option><option value="8">Agosto</option>
                            <option value="9">Setembro</option><option value="10">Outubro</option>
                            <option value="11">Novembro</option><option value="12">Dezembro</option>
                        </select>
                    </div>
                </div>
            </div>
            <div id="ceo-comparativo-resultado" class="ceo-resumo" style="margin-bottom:18px;"></div>
            <div class="ceo-geral-graficos">
                <div class="ceo-chart-card">
                    <h3>A Receber × A Pagar (certo) por mês</h3>
                    <div id="chart-comparativo-certo" class="ceo-chart"></div>
                </div>
                <div class="ceo-chart-card">
                    <h3>A Receber × A Pagar (previsão) por mês</h3>
                    <div id="chart-comparativo-previsao" class="ceo-chart"></div>
                </div>
            </div>
        </div>

        <p class="ceo-nota">Contas a pagar já usa dado real (lançamentos + folha) de todas as empresas. Contas a receber ainda depende da marcação manual de "recebido" em Faturamento (sem conciliação bancária automática).</p>
    `;
    main.appendChild(panel);

    mostrarSecaoGeral(); // sincroniza a visibilidade das seções com o estado padrão (Gráficos)
    carregarEmpresasGeral();
    carregarAnosGeral();

    panel.querySelectorAll('input[name="ceo-geral-modo"]').forEach((r) =>
        r.addEventListener("change", (e) => { if (e.target.checked) trocarModoGeral(e.target.value); }));
    panel.querySelectorAll('input[name="ceo-geral-view"]').forEach((r) =>
        r.addEventListener("change", (e) => { if (e.target.checked) trocarVisualizacaoGeral(e.target.value); }));
    panel.querySelectorAll('input[name="ceo-receber-agrupamento"]').forEach((r) =>
        r.addEventListener("change", (e) => {
            if (!e.target.checked) return;
            agrupamentoReceberGeral = e.target.value;
            carregarGraficosContasReceberGeral();
        }));

    document.getElementById("ceo-receber-select-mes").addEventListener("change", (e) => {
        mesReceberGeral = e.target.value;
        atualizarConteudoAtivoGeral(); // recarrega Lista e/ou Gráficos, conforme a exibição ativa
    });

    const inputEvento = document.getElementById("ceo-busca-evento-receber");
    let timeoutBuscaEvento = null;
    inputEvento.addEventListener("input", () => {
        clearTimeout(timeoutBuscaEvento);
        timeoutBuscaEvento = setTimeout(() => buscarEventosReceberGeral(inputEvento.value.trim()), 250);
    });
    inputEvento.addEventListener("focus", () => { if (inputEvento.value.trim()) buscarEventosReceberGeral(inputEvento.value.trim()); });
    document.addEventListener("click", (e) => {
        const listaEvento = document.getElementById("ceo-busca-evento-receber-lista");
        if (listaEvento && !listaEvento.contains(e.target) && e.target !== inputEvento) listaEvento.style.display = "none";
    });
    document.getElementById("ceo-receber-evento-limpar").addEventListener("click", limparEventoReceberGeral);
    document.getElementById("ceo-receber-detalhar").addEventListener("click", alternarDetalheReceberGeral);
    panel.querySelectorAll('input[name="ceo-pagar-agrupamento"]').forEach((r) =>
        r.addEventListener("change", (e) => {
            if (!e.target.checked) return;
            agrupamentoPagarGeral = e.target.value;
            carregarGraficosContasGeral();
        }));
    document.getElementById("ceo-pagar-select-mes").addEventListener("change", (e) => {
        mesPagarGeral = e.target.value;
        atualizarConteudoAtivoGeral(); // recarrega Lista e/ou Gráficos, conforme a exibição ativa
    });

    document.getElementById("ceo-geral-select-ano").addEventListener("change", () => {
        if (modoAtivoGeral === "funcionarios" && funcionarioSelecionadoGeral) {
            carregarDetalheFuncionarioGeral(funcionarioSelecionadoGeral); // recarrega e já re-renderiza a view ativa
        } else {
            atualizarConteudoAtivoGeral();
        }
    });

    const input = document.getElementById("ceo-busca-funcionario");
    let timeoutBusca = null;
    input.addEventListener("input", () => {
        funcionarioSelecionadoGeral = null;
        clearTimeout(timeoutBusca);
        timeoutBusca = setTimeout(() => buscarFuncionariosGeral(input.value.trim()), 250);
    });
    input.addEventListener("focus", () => { if (input.value.trim()) buscarFuncionariosGeral(input.value.trim()); });
    document.addEventListener("click", (e) => {
        const lista = document.getElementById("ceo-busca-funcionario-lista");
        if (lista && !lista.contains(e.target) && e.target !== input) lista.style.display = "none";
    });

    document.getElementById("ceo-func-select-mes").addEventListener("change", (e) => {
        mesFuncionariosGeral = e.target.value;
        if (funcionarioSelecionadoGeral) carregarDetalheFuncionarioGeral(funcionarioSelecionadoGeral);
        else atualizarConteudoAtivoGeral();
    });

    document.getElementById("ceo-comparativo-select-mes").addEventListener("change", (e) => {
        mesComparativoGeral = e.target.value;
        atualizarConteudoAtivoGeral();
    });
}

// ===== Modo (Funcionários/Contas) e visualização (Lista/Gráficos) da Visão Geral =====
let modoAtivoGeral = "funcionarios";
let visualizacaoAtivaGeral = "graficos"; // padrão de abertura — precisa bater com o "checked" do radio no HTML
let mesFuncionariosGeral = ""; // "" (ano inteiro) | "1".."12" — quanto o funcionário (ou o grupo) recebeu num mês específico

const SECOES_GERAL = {
    "funcionarios:lista": "ceo-geral-func-lista",
    "funcionarios:graficos": "ceo-geral-func-graficos",
    "contas:lista": "ceo-geral-contas-lista",
    "contas:graficos": "ceo-geral-contas-graficos",
    "contas_receber:lista": "ceo-geral-contas-receber-lista",
    "contas_receber:graficos": "ceo-geral-contas-receber-graficos",
};

// Devolve lista/gráficos pro lugar original (logo antes do wrapper de split) — os 3 wraps de
// filtro sempre visíveis (busca de funcionário, Mês de Pagar, Mês de Receber) ficam TODOS antes do
// splitWrap no HTML (igual a busca de funcionário já era), então "antes do splitWrap" continua
// sendo a posição certa pra qualquer um dos 3 pares Lista/Gráficos, sem depender de qual modo é.
// (Colocar algum desses filtros DEPOIS do splitWrap — como cheguei a fazer com Pagar/Receber — faz
// ele só aparecer abaixo do conteúdo quando "Dividir tela" está ativo, porque o splitWrap, sendo
// anterior no DOM, desenha ali mesmo antes de chegar no filtro.)
function devolverSecoesDoSplitGeral(splitWrap) {
    Object.values(SECOES_GERAL).forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (splitWrap && el.parentElement === splitWrap) splitWrap.before(el);
        el.style.display = "none";
    });
}

function mostrarSecaoGeral() {
    const splitWrap = document.getElementById("ceo-geral-split-wrap");
    const comparativoEl = document.getElementById("ceo-geral-comparativo");

    // "Comparar A Receber × A Pagar" não participa de Lista/Gráficos/Dividir tela — é uma seção única,
    // sempre com cards + gráfico mensal próprio, então a Exibição some pra não sugerir uma escolha
    // que não faz efeito nenhum.
    const exibicaoGrupo = document.getElementById("ceo-geral-exibicao-grupo");
    if (exibicaoGrupo) exibicaoGrupo.style.display = modoAtivoGeral === "comparativo" ? "none" : "";

    if (modoAtivoGeral === "comparativo") {
        if (splitWrap) splitWrap.style.display = "none";
        devolverSecoesDoSplitGeral(splitWrap);
        if (comparativoEl) comparativoEl.style.display = "";
        const buscaWrap = document.getElementById("ceo-geral-busca-funcionario-wrap");
        if (buscaWrap) buscaWrap.style.display = "none";
        const pagarFiltrosWrapOculto = document.getElementById("ceo-geral-pagar-filtros-wrap");
        if (pagarFiltrosWrapOculto) pagarFiltrosWrapOculto.style.display = "none";
        const receberFiltrosWrapOculto = document.getElementById("ceo-geral-receber-filtros-wrap");
        if (receberFiltrosWrapOculto) receberFiltrosWrapOculto.style.display = "none";
        return;
    }
    if (comparativoEl) comparativoEl.style.display = "none";

    const idLista = SECOES_GERAL[`${modoAtivoGeral}:lista`];
    const idGraficos = SECOES_GERAL[`${modoAtivoGeral}:graficos`];
    const elLista = document.getElementById(idLista);
    const elGraficos = document.getElementById(idGraficos);

    // Sempre devolve lista/gráficos pro lugar original antes de decidir o que mostrar — evita que
    // uma seção fique "presa" dentro do wrapper depois de trocar de modo (Funcionários -> Contas,
    // por ex.) enquanto Dividir Tela estava ativo.
    devolverSecoesDoSplitGeral(splitWrap);

    if (visualizacaoAtivaGeral === "split" && splitWrap && elLista && elGraficos) {
        splitWrap.appendChild(elLista);
        splitWrap.appendChild(elGraficos);
        elLista.style.display = "";
        elGraficos.style.display = "";
        splitWrap.style.display = "flex";
    } else {
        if (splitWrap) splitWrap.style.display = "none";
        const ativa = document.getElementById(SECOES_GERAL[`${modoAtivoGeral}:${visualizacaoAtivaGeral}`]);
        if (ativa) ativa.style.display = "";
    }

    // Busca de funcionário e os filtros de Mês (Funcionários/Pagar/Receber) ficam visíveis nas
    // três visualizações (Lista/Gráficos/Dividir tela) do modo correspondente — não só dentro de
    // Gráficos, senão o filtro "some" pra quem está na Lista e o Mês escolhido nunca chega lá.
    const buscaWrap = document.getElementById("ceo-geral-busca-funcionario-wrap");
    if (buscaWrap) buscaWrap.style.display = modoAtivoGeral === "funcionarios" ? "" : "none";
    const pagarFiltrosWrap = document.getElementById("ceo-geral-pagar-filtros-wrap");
    if (pagarFiltrosWrap) pagarFiltrosWrap.style.display = modoAtivoGeral === "contas" ? "" : "none";
    const receberFiltrosWrap = document.getElementById("ceo-geral-receber-filtros-wrap");
    if (receberFiltrosWrap) receberFiltrosWrap.style.display = modoAtivoGeral === "contas_receber" ? "" : "none";
}

// Redesenha o conteúdo da combinação modo+visualização atual, sem duplicar a lógica de troca
// nos chips de empresa/ano (eles só chamam isto).
// "Valores referentes a: Todas as Empresas" (ou a lista de nomes, quando é um subconjunto) —
// mostrado acima dos gráficos de cada aba, pra nunca ficar em dúvida se o filtro de empresas
// (chips no topo) está restringindo o que está sendo exibido.
function atualizarResumoEmpresasGeral() {
    let texto = "Valores referentes a: nenhuma empresa selecionada";
    if (empresasSelecionadasGeral && empresasGeral.length > 0) {
        const todas = empresasGeral.every((e) => empresasSelecionadasGeral.has(e.idempresa));
        if (todas) {
            texto = "Valores referentes a: Todas as Empresas";
        } else {
            const nomes = empresasGeral
                .filter((e) => empresasSelecionadasGeral.has(e.idempresa))
                .map((e) => e.nmfantasia);
            if (nomes.length > 0) texto = `Valores referentes a: ${nomes.join(", ")}`;
        }
    }
    ["ceo-func-empresas-resumo", "ceo-pagar-empresas-resumo", "ceo-receber-empresas-resumo", "ceo-comparativo-empresas-resumo"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.textContent = texto;
    });
}

// Com 0 empresas selecionadas, "idempresas=" vazio na querystring NÃO significa "nenhuma" pro
// back-end — significa "sem filtro" (ele ignora o parâmetro e devolve TODAS as empresas). Por
// isso não dá pra só deixar a busca de cada aba seguir normal: precisa interceptar aqui, antes de
// qualquer fetch, e limpar visualmente tudo (senão a tela mantém o último resultado carregado,
// como se ainda estivesse filtrando por alguma empresa).
function limparConteudoGeralSemEmpresa() {
    ["ceo-geral-colunas", "ceo-geral-colunas-contas", "ceo-geral-colunas-contas-receber", "ceo-comparativo-resultado"]
        .forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = "";
        });

    const vazioFunc = document.getElementById("ceo-geral-vazio");
    if (vazioFunc) { vazioFunc.textContent = "Nenhuma empresa selecionada."; vazioFunc.style.display = ""; }
    const tituloFunc = document.getElementById("ceo-geral-titulo");
    if (tituloFunc) tituloFunc.style.display = "none";

    [
        "chart-geral-contratado", "chart-geral-provisao",
        "chart-contas-contratado", "chart-contas-provisao",
        "chart-contas-receber-contratado", "chart-contas-receber-provisao", "chart-contas-receber-previsao",
        "chart-contas-receber-eventos",
        "chart-comparativo-certo", "chart-comparativo-previsao",
    ].forEach((id) => {
        const c = obterChart(id);
        if (c) c.clear();
    });

    const detalheReceber = document.getElementById("ceo-receber-detalhe");
    if (detalheReceber) detalheReceber.style.display = "none";
}

function atualizarConteudoAtivoGeral() {
    atualizarResumoEmpresasGeral();
    if (empresasSelecionadasGeral && empresasSelecionadasGeral.size === 0) {
        limparConteudoGeralSemEmpresa();
        return;
    }
    // "Dividir tela" renderiza os dois lados de uma vez — nenhuma das duas chamadas depende
    // da outra, cada uma só preenche o próprio container por id.
    const mostraLista = visualizacaoAtivaGeral === "lista" || visualizacaoAtivaGeral === "split";
    const mostraGraficos = visualizacaoAtivaGeral === "graficos" || visualizacaoAtivaGeral === "split";
    if (modoAtivoGeral === "funcionarios") {
        if (mostraLista) renderColunasGeral();
        if (mostraGraficos) carregarGraficosFuncionariosGeral();
    } else if (modoAtivoGeral === "contas") {
        if (mostraLista) renderColunasContasGeral();
        if (mostraGraficos) carregarGraficosContasGeral();
    } else if (modoAtivoGeral === "contas_receber") {
        if (mostraLista) renderColunasContasReceberGeral();
        if (mostraGraficos) carregarGraficosContasReceberGeral();
    } else if (modoAtivoGeral === "comparativo") {
        carregarComparativoGeral();
        carregarGraficosComparativoGeral();
    }
}

function trocarModoGeral(modo) {
    modoAtivoGeral = modo;
    mostrarSecaoGeral();
    atualizarConteudoAtivoGeral();
}

function trocarVisualizacaoGeral(view) {
    visualizacaoAtivaGeral = view;
    mostrarSecaoGeral();
    atualizarConteudoAtivoGeral();
}

// Renderiza os chips de empresa (uma cor por marca) + "Todas". Clicar numa empresa liga/desliga
// aquela coluna do resultado; "Todas" religa todas de uma vez (mesmo padrão dos chips de status
// da aba Rentabilidade).
function renderFiltroEmpresasGeral() {
    const box = document.getElementById("ceo-geral-empresas-filtro");
    if (!box) return;
    const chipsEmpresa = empresasGeral.map((e) => {
        const ativo = empresasSelecionadasGeral.has(e.idempresa) ? "ativo" : "";
        return `<button type="button" class="ceo-status-chip ${classeTemaEmpresa(e.nmfantasia)} ${ativo}" data-id="${e.idempresa}">${e.nmfantasia}</button>`;
    }).join("");
    box.innerHTML = `<button type="button" class="ceo-status-chip ceo-status-chip-todos ativo" data-id="todos">Todas</button>${chipsEmpresa}`;

    const chipTodos = box.querySelector(".ceo-status-chip-todos");
    const chipsIndividuais = Array.from(box.querySelectorAll(".ceo-status-chip:not(.ceo-status-chip-todos)"));

    // "Todas" agora é on/off de verdade: se já estão todas selecionadas, o clique desmarca tudo
    // (mostra o estado vazio); senão, marca todas — mesmo gesto de clique dos chips individuais.
    chipTodos.addEventListener("click", () => {
        const todasSelecionadas = empresasGeral.every((e) => empresasSelecionadasGeral.has(e.idempresa));
        if (todasSelecionadas) {
            empresasSelecionadasGeral.clear();
            chipsIndividuais.forEach((chip) => chip.classList.remove("ativo"));
            chipTodos.classList.remove("ativo");
        } else {
            empresasGeral.forEach((e) => empresasSelecionadasGeral.add(e.idempresa));
            chipsIndividuais.forEach((chip) => chip.classList.add("ativo"));
            chipTodos.classList.add("ativo");
        }
        atualizarConteudoAtivoGeral();
    });
    chipsIndividuais.forEach((chip) => {
        chip.addEventListener("click", () => {
            const id = parseInt(chip.dataset.id, 10);
            if (empresasSelecionadasGeral.has(id)) {
                if (empresasSelecionadasGeral.size > 1) empresasSelecionadasGeral.delete(id); // mantém ao menos 1
            } else {
                empresasSelecionadasGeral.add(id);
            }
            chip.classList.toggle("ativo", empresasSelecionadasGeral.has(id));
            chipTodos.classList.toggle("ativo", empresasGeral.every((e) => empresasSelecionadasGeral.has(e.idempresa)));
            atualizarConteudoAtivoGeral();
        });
    });
}

async function carregarEmpresasGeral() {
    try {
        empresasGeral = (await fetchComToken("/ceo/geral/empresas")) || [];
        empresasSelecionadasGeral = new Set(empresasGeral.map((e) => e.idempresa)); // começa com todas ligadas
        renderFiltroEmpresasGeral();
        atualizarConteudoAtivoGeral();
    } catch (err) {
        console.error("Erro ao carregar empresas (CEO Geral):", err);
    }
}

async function carregarAnosGeral() {
    const select = document.getElementById("ceo-geral-select-ano");
    try {
        const anos = await fetchComToken("/ceo/geral/anos-disponiveis");
        const anoAtual = new Date().getFullYear();
        const lista = (anos && anos.length) ? anos : [anoAtual];
        select.innerHTML = lista.map((a) => `<option value="${a}">${a}</option>`).join("");
        if (Array.from(select.options).some((o) => o.value === String(anoAtual))) select.value = String(anoAtual);
    } catch (err) {
        console.error("Erro ao carregar anos (CEO Geral):", err);
    }
}

let funcionarioSelecionadoGeral = null;

function refazerBuscaFuncionarioGeral() {
    const input = document.getElementById("ceo-busca-funcionario");
    if (input.value.trim()) buscarFuncionariosGeral(input.value.trim());
}

async function buscarFuncionariosGeral(busca) {
    const lista = document.getElementById("ceo-busca-funcionario-lista");
    if (!busca) { lista.style.display = "none"; lista.innerHTML = ""; return; }

    // Busca sempre entre todas as empresas — quem filtra o que é EXIBIDO são os chips de coluna.
    const params = new URLSearchParams({ busca });

    try {
        const funcionarios = await fetchComToken(`/ceo/geral/funcionarios?${params.toString()}`);
        if (!funcionarios || funcionarios.length === 0) {
            lista.innerHTML = '<li class="vazio">Nenhum funcionário encontrado.</li>';
        } else {
            lista.innerHTML = funcionarios.map((f) =>
                `<li data-id="${f.idfuncionario}" data-nome="${f.nome}">${f.nome} <small>${(f.empresas || []).join(", ")}</small></li>`
            ).join("");
            lista.querySelectorAll("li[data-id]").forEach((li) => {
                li.addEventListener("click", () => {
                    document.getElementById("ceo-busca-funcionario").value = li.dataset.nome;
                    lista.style.display = "none";
                    funcionarioSelecionadoGeral = { idfuncionario: li.dataset.id, nome: li.dataset.nome };
                    carregarDetalheFuncionarioGeral(funcionarioSelecionadoGeral);
                });
            });
        }
        lista.style.display = "block";
    } catch (err) {
        console.error("Erro ao buscar funcionários (CEO Geral):", err);
    }
}

let dadosFuncionarioGeral = null; // { holerites, staff, ajustes } cru da última busca — colunas são um recorte disso

async function carregarDetalheFuncionarioGeral(funcionario) {
    const vazio = document.getElementById("ceo-geral-vazio");
    const ano = document.getElementById("ceo-geral-select-ano")?.value || new Date().getFullYear();

    vazio.style.display = "none";
    document.getElementById("ceo-geral-titulo").style.display = "block";
    const sufixoPeriodo = mesFuncionariosGeral ? MESES_NOME_COMPLETO_GERAL[parseInt(mesFuncionariosGeral, 10) - 1] : ano;
    document.getElementById("ceo-geral-titulo").textContent = `${funcionario.nome} — ${sufixoPeriodo}`;

    // Busca sempre todas as empresas de uma vez (sem idempresa) — os chips filtram no cliente,
    // sem precisar refazer a requisição a cada clique numa coluna.
    const params = new URLSearchParams({ idfuncionario: funcionario.idfuncionario, ano });
    if (mesFuncionariosGeral) params.set("mes", mesFuncionariosGeral);

    try {
        dadosFuncionarioGeral = await fetchComToken(`/ceo/geral/funcionario?${params.toString()}`) || { holerites: [], staff: [], ajustes: [] };
        atualizarConteudoAtivoGeral(); // re-renderiza a view ativa (Lista ou Gráficos) com o dado novo
    } catch (err) {
        console.error("Erro ao carregar detalhamento do funcionário (CEO Geral):", err);
    }
}

// Sub-aba ativa por empresa (idempresa -> "holerite"|"staff"|"ajustes"); começa em "holerite".
const abaAtivaGeral = new Map();

const ABAS_GERAL = [
    { chave: "holerite", label: "Holerite" },
    { chave: "staff", label: "Eventos" },
    { chave: "ajustes", label: "Ajustes financeiros" },
];

// Calcula os totais + as 3 tabelas de detalhe (Holerite/Staff/Ajustes) de UMA empresa pro
// funcionário selecionado — separado do render pra poder somar o "total geral" (todas as
// empresas) sem duplicar a conta linha a linha.
function calcularTotaisEmpresaGeral(empresa, { holerites, staff, ajustes }) {
    const holeritesEmp = holerites.filter((h) => h.idempresa === empresa.idempresa);
    const staffEmp = staff.filter((s) => s.idempresa === empresa.idempresa);
    const ajustesEmp = ajustes.filter((a) => a.idempresa === empresa.idempresa);

    // Salário e Benefícios (VA/VT) conferem/pagam em momentos diferentes (mesma regra de
    // Vencimentos): "origem" só vira "real" (podendo contar como Pago) depois de conferido pelo
    // RH — antes disso a linha é sempre exibida como Previsão, mesmo já existindo no banco.
    let totPagoHolerite = 0, totPrevHolerite = 0;
    const linhasHolerite = holeritesEmp.flatMap((h) => {
        const competencia = `${String(h.mes).padStart(2, "0")}/${h.ano} ${h.tipo === "13" ? "(13º)" : ""}`;
        const linhas = [];

        const valorSalario = (Number(h.proventos) || 0) - (Number(h.descontos) || 0);
        const statusSalario = h.origem === "real" ? h.status : "Previsão";
        totPrevHolerite += valorSalario;
        if (h.origem === "real" && h.status === "Pago") totPagoHolerite += valorSalario;
        linhas.push(`<tr>
            <td>${competencia}</td>
            <td class="${statusClasse(statusSalario)}">${statusSalario}</td>
            <td>${moedaGeral(h.proventos)}</td>
            <td>${moedaGeral(h.descontos)}</td>
        </tr>`);

        const valorBeneficios = Number(h.beneficios) || 0;
        if (valorBeneficios) {
            const statusBeneficios = h.origemBeneficios === "real" ? h.status_beneficios : "Previsão";
            totPrevHolerite += valorBeneficios;
            if (h.origemBeneficios === "real" && h.status_beneficios === "Pago") totPagoHolerite += valorBeneficios;
            linhas.push(`<tr>
                <td>${competencia} (Benefícios)</td>
                <td class="${statusClasse(statusBeneficios)}">${statusBeneficios}</td>
                <td>${moedaGeral(valorBeneficios)}</td>
                <td>${moedaGeral(0)}</td>
            </tr>`);
        }

        return linhas;
    }).join("") || '<tr><td colspan="4" class="ceo-vazio">Sem holerites.</td></tr>';

    let totPagoStaff = 0, totPrevStaff = 0;
    const linhasStaff = staffEmp.map((s) => {
        const valor = (Number(s.vlrcache) || 0) + (Number(s.vlrajdcusto) || 0) + (Number(s.vlrcaixinha) || 0);
        totPrevStaff += valor;
        const pagoCache = s.statuspgto === "Pago" ? Number(s.vlrcache) || 0 : 0;
        const pagoAjd = s.statuspgtoajdcto === "Pago" ? Number(s.vlrajdcusto) || 0 : 0;
        const pagoCaix = s.statuspgtocaixinha === "Pago" ? Number(s.vlrcaixinha) || 0 : 0;
        totPagoStaff += pagoCache + pagoAjd + pagoCaix;
        const statusResumo = (pagoCache + pagoAjd + pagoCaix) >= valor && valor > 0 ? "Pago" : "Pendente";
        return `<tr>
            <td>${s.nmcliente ? s.nmcliente + " — " : ""}${s.nmevento || "Evento"}</td>
            <td>${moedaGeral(valor)}</td>
            <td class="${statusClasse(statusResumo)}">${statusResumo}</td>
        </tr>`;
    }).join("") || '<tr><td colspan="3" class="ceo-vazio">Sem staff cadastrado.</td></tr>';

    // Ajustes só entram aqui quando "Pago" (regra do backend) — não existe "pendente" pra eles.
    let totAjuste = 0;
    const linhasAjustes = ajustesEmp.map((a) => {
        const valor = a.tipo === "Credito" ? (Number(a.valor) || 0) : -(Number(a.valor) || 0);
        totAjuste += valor;
        return `<tr>
            <td>${a.nmevento || "—"}</td>
            <td>${a.tipo}</td>
            <td class="${valor < 0 ? "neg" : "pos"}">${moedaGeral(valor)}</td>
        </tr>`;
    }).join("") || '<tr><td colspan="3" class="ceo-vazio">Sem ajustes pagos.</td></tr>';

    return {
        empresa,
        totalPago: totPagoHolerite + totPagoStaff + totAjuste,
        totalPrevisto: totPrevHolerite + totPrevStaff + totAjuste,
        TOTAIS_ABA: {
            holerite: { pago: totPagoHolerite, previsto: totPrevHolerite, linhas: linhasHolerite,
                cabecalho: "<th>Competência</th><th>Status</th><th>Proventos</th><th>Descontos</th>" },
            staff: { pago: totPagoStaff, previsto: totPrevStaff, linhas: linhasStaff,
                cabecalho: "<th>Evento</th><th>Valor</th><th>Status</th>" },
            ajustes: { pago: totAjuste, previsto: totAjuste, linhas: linhasAjustes,
                cabecalho: "<th>Evento</th><th>Tipo</th><th>Valor</th>" },
        },
    };
}

// Empresas com a linha de detalhe expandida (clicou na linha da tabela) — Set de idempresa.
const empresasExpandidasGeral = new Set();

// Monta a linha (+ linha de detalhe expansível logo abaixo) de UMA empresa na tabela horizontal.
function montarLinhaEmpresaGeral({ empresa, totalPago, totalPrevisto, TOTAIS_ABA }) {
    const expandido = empresasExpandidasGeral.has(empresa.idempresa);
    const linhaPrincipal = `
        <tr class="ceo-geral-linha-empresa ${expandido ? "expandida" : ""}" data-idempresa="${empresa.idempresa}">
            <td><span class="ceo-geral-empresa-tag ${classeTemaEmpresa(empresa.nmfantasia)}">${empresa.nmfantasia}</span></td>
            <td>${moedaGeral(TOTAIS_ABA.holerite.previsto)}</td>
            <td>${moedaGeral(TOTAIS_ABA.staff.previsto)}</td>
            <td>${moedaGeral(TOTAIS_ABA.ajustes.previsto)}</td>
            <td class="pos">${moedaGeral(totalPago)}</td>
            <td>${moedaGeral(totalPrevisto)}</td>
            <td class="ceo-geral-expandir">${expandido ? "▲" : "▼"}</td>
        </tr>`;

    if (!expandido) return linhaPrincipal;

    const abaAtiva = abaAtivaGeral.get(empresa.idempresa) || "holerite";
    const abaAtual = TOTAIS_ABA[abaAtiva];
    const abasHtml = ABAS_GERAL.map(({ chave, label }) => {
        const t = TOTAIS_ABA[chave];
        return `<button type="button" class="ceo-geral-subaba ${chave === abaAtiva ? "ativo" : ""}" data-idempresa="${empresa.idempresa}" data-aba="${chave}">
            <span>${label}</span><strong>${moedaGeral(t.previsto)}</strong>
        </button>`;
    }).join("");

    const linhaDetalhe = `
        <tr class="ceo-geral-linha-detalhe">
            <td colspan="7">
                <div class="ceo-geral-subabas">${abasHtml}</div>
                <table class="ceo-geral-tabela">
                    <thead><tr>${abaAtual.cabecalho}</tr></thead>
                    <tbody>${abaAtual.linhas}</tbody>
                </table>
            </td>
        </tr>`;

    return linhaPrincipal + linhaDetalhe;
}

// Lista (sem funcionário buscado ainda): todo mundo com atividade no ano, agregado por
// funcionário (holerite + staff em eventos + ajustes pagos — mesma regra de /geral/panorama,
// só que por pessoa em vez de por mês). Clicar num nome entra no detalhe de sempre (mesmo
// caminho de buscarFuncionariosGeral). Refeita a cada troca de ano/chip de empresa.
async function renderTodosFuncionariosGeral(cont) {
    const ano = document.getElementById("ceo-geral-select-ano")?.value || new Date().getFullYear();
    const todasSelecionadas = !empresasSelecionadasGeral || empresasGeral.every((e) => empresasSelecionadasGeral.has(e.idempresa));
    const idsFiltro = todasSelecionadas ? [] : empresasGeral.filter((e) => empresasSelecionadasGeral.has(e.idempresa)).map((e) => e.idempresa);

    cont.innerHTML = '<p class="ceo-vazio-sutil">Carregando...</p>';
    try {
        const params = new URLSearchParams({ ano });
        if (idsFiltro.length) params.set("idempresas", idsFiltro.join(","));
        if (mesFuncionariosGeral) params.set("mes", mesFuncionariosGeral);
        const resp = await fetchComToken(`/ceo/geral/funcionarios-resumo?${params.toString()}`);
        const lista = resp?.funcionarios || [];

        if (!lista.length) {
            cont.innerHTML = `<p class="ceo-vazio">Nenhum funcionário com valor ${textoPeriodoFuncionariosGeral()}/empresas selecionadas.</p>`;
            return;
        }

        const linhas = lista.map((f) => {
            const pago = Number(f.pago) || 0;
            const previsto = pago + (Number(f.pendente) || 0);
            return `<tr class="ceo-geral-linha-funcionario-geral" data-id="${f.idfuncionario}" data-nome="${f.nome}">
                <td>${f.nome}</td>
                <td class="pos">${moedaGeral(pago)}</td>
                <td>${moedaGeral(previsto)}</td>
            </tr>`;
        }).join("");

        cont.innerHTML = `
            <p class="ceo-vazio-sutil">Todos os funcionários com valor ${textoPeriodoFuncionariosGeral()} — clique num nome pra ver o detalhe por empresa (ou busque um específico acima).</p>
            <div class="ceo-geral-tabela-wrap">
                <table class="ceo-geral-tabela-empresas">
                    <thead><tr><th>Funcionário</th><th>Pago</th><th>Previsto</th></tr></thead>
                    <tbody>${linhas}</tbody>
                </table>
            </div>`;

        cont.querySelectorAll(".ceo-geral-linha-funcionario-geral").forEach((tr) => {
            tr.addEventListener("click", () => {
                const input = document.getElementById("ceo-busca-funcionario");
                if (input) input.value = tr.dataset.nome;
                funcionarioSelecionadoGeral = { idfuncionario: tr.dataset.id, nome: tr.dataset.nome };
                carregarDetalheFuncionarioGeral(funcionarioSelecionadoGeral);
            });
        });
    } catch (err) {
        console.error("Erro ao carregar resumo de todos os funcionários (CEO Geral):", err);
        cont.innerHTML = '<p class="ceo-vazio">Erro ao carregar a lista de funcionários.</p>';
    }
}

// Redesenha a tabela horizontal (total geral + uma linha por empresa) conforme os chips ativos —
// sem buscar de novo (dadosFuncionarioGeral já tem tudo, o filtro por empresa é só um recorte no
// cliente). Empresa sem NENHUM registro (nem holerite, nem staff, nem ajuste pago) pro
// funcionário/ano atual não entra na tabela — nada a mostrar.
function renderColunasGeral() {
    const cont = document.getElementById("ceo-geral-colunas");
    const vazio = document.getElementById("ceo-geral-vazio");
    if (!cont) return;

    // Sem funcionário buscado ainda: mesma paridade que o modo Gráfico já tem (mostra o grupo
    // inteiro por padrão) — em vez do aviso "busque um funcionário", lista todo mundo com
    // atividade no ano/empresas selecionadas; clicar num nome abre o detalhe de sempre.
    if (!funcionarioSelecionadoGeral) {
        if (vazio) vazio.style.display = "none";
        renderTodosFuncionariosGeral(cont);
        return;
    }

    if (!dadosFuncionarioGeral || !empresasSelecionadasGeral) { cont.innerHTML = ""; return; }

    const { holerites, staff, ajustes } = dadosFuncionarioGeral;
    const empresasComDados = new Set([
        ...holerites.map((h) => h.idempresa),
        ...staff.map((s) => s.idempresa),
        ...ajustes.map((a) => a.idempresa),
    ]);

    const empresasVisiveis = empresasGeral.filter((e) => empresasSelecionadasGeral.has(e.idempresa) && empresasComDados.has(e.idempresa));

    if (empresasVisiveis.length === 0) {
        cont.innerHTML = '<p class="ceo-vazio">Nenhum registro para este funcionário nas empresas selecionadas.</p>';
        return;
    }

    const totaisPorEmpresa = empresasVisiveis.map((e) => calcularTotaisEmpresaGeral(e, dadosFuncionarioGeral));
    const totalGeralPago = totaisPorEmpresa.reduce((s, t) => s + t.totalPago, 0);
    const totalGeralPrevisto = totaisPorEmpresa.reduce((s, t) => s + t.totalPrevisto, 0);

    cont.innerHTML = `
        <div class="ceo-resumo ceo-geral-total-geral">
            <div class="ceo-resumo-card"><span>Recebido (todas as empresas)</span><strong class="pos">${moedaGeral(totalGeralPago)}</strong></div>
            <div class="ceo-resumo-card"><span>Previsto (todas as empresas)</span><strong>${moedaGeral(totalGeralPrevisto)}</strong></div>
            <div class="ceo-resumo-card"><span>Ainda a receber</span><strong>${moedaGeral(totalGeralPrevisto - totalGeralPago)}</strong></div>
        </div>
        <div class="ceo-geral-tabela-wrap">
            <table class="ceo-geral-tabela-empresas">
                <thead>
                    <tr>
                        <th>Empresa</th><th>Holerite</th><th>Staff (eventos)</th><th>Ajustes</th>
                        <th>Pago</th><th>Previsto</th><th></th>
                    </tr>
                </thead>
                <tbody>${totaisPorEmpresa.map(montarLinhaEmpresaGeral).join("")}</tbody>
            </table>
        </div>`;

    cont.querySelectorAll(".ceo-geral-linha-empresa").forEach((tr) => {
        tr.addEventListener("click", () => {
            const id = parseInt(tr.dataset.idempresa, 10);
            if (empresasExpandidasGeral.has(id)) empresasExpandidasGeral.delete(id);
            else empresasExpandidasGeral.add(id);
            renderColunasGeral();
        });
    });
    cont.querySelectorAll(".ceo-geral-subaba").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation(); // não deixa "vazar" pro clique da linha (que colapsaria de novo)
            abaAtivaGeral.set(parseInt(btn.dataset.idempresa, 10), btn.dataset.aba);
            renderColunasGeral();
        });
    });
}

// ===== Modo Gráfico (Funcionários e Contas) — panorama do ano inteiro, sem depender de ter
// buscado um funcionário/conta específico. Reaproveita obterChart()/moeda()/fmtMoedaCurta() já
// usados nos gráficos de Rentabilidade. =====
const MESES_GERAL = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MESES_NOME_COMPLETO_GERAL = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
// "no ano" (sem filtro) ou "em <Mês>" (com o filtro de Mês da aba Funcionários aplicado) — usado
// nos textos descritivos da Lista/Gráficos pra deixar claro qual período está em tela.
function textoPeriodoFuncionariosGeral() {
    return mesFuncionariosGeral ? `em ${MESES_NOME_COMPLETO_GERAL[parseInt(mesFuncionariosGeral, 10) - 1]}` : "no ano";
}

// Junta as 3 origens (holerite/staff/ajustes) em dois arrays de 12 posições (Pago/Pendente).
// Ajuste financeiro só entra como "Pago" (mesma regra do backend — só conta quando confirmado).
function mesclarMesesGeral({ holerite, staff, ajustes }) {
    const pago = Array(12).fill(0);
    const pendente = Array(12).fill(0);
    const acumular = (linhas, comPendente) => {
        (linhas || []).forEach((r) => {
            const idx = (parseInt(r.mes, 10) || 1) - 1;
            if (idx < 0 || idx > 11) return;
            pago[idx] += Number(r.pago) || 0;
            if (comPendente) pendente[idx] += Number(r.pendente) || 0;
        });
    };
    acumular(holerite, true);
    acumular(staff, true);
    acumular(ajustes, false);
    return { pago, pendente };
}

// Desenha os 2 gráficos padrão (Contratado Pago×Pendente + Provisão acumulada) nos ids
// informados — usado tanto pelo modo Funcionários quanto (com dados mockados) pelo modo Contas.
// descontosPorMes (opcional, só quando um funcionário está selecionado) soma em vermelho o que
// ele perde de desconto (INSS/IRRF etc.) por mês — ajuda a enxergar se compensa trocar o
// regime dele (CLT × PJ/MEI) sem precisar abrir cada holerite.
function renderGraficosPanoramaGeral(idContratado, idProvisao, dados, descontosPorMes = null) {
    if (typeof echarts === "undefined") return;
    const { pago, pendente } = mesclarMesesGeral(dados || {});

    const seriesContratado = [
        { name: "Pago", type: "bar", stack: "total", color: "#1e9e54", data: pago },
        { name: "Pendente", type: "bar", stack: "total", color: "#e0a106", data: pendente },
    ];
    const legendaContratado = ["Pago", "Pendente"];
    if (descontosPorMes) {
        seriesContratado.push({ name: "Descontos", type: "bar", color: "#dc2e2e", data: descontosPorMes });
        legendaContratado.push("Descontos");
    }

    const cContratado = obterChart(idContratado);
    if (cContratado) cContratado.setOption({
        tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (v) => moeda(v) },
        legend: { bottom: 0, data: legendaContratado },
        grid: { left: 95, right: 20, top: 30, bottom: 50 },
        xAxis: { type: "category", data: MESES_GERAL },
        yAxis: { type: "value", axisLabel: { formatter: fmtMoedaCurta } },
        series: seriesContratado,
    }, true);

    const acumulado = [];
    let soma = 0;
    for (let i = 0; i < 12; i++) { soma += pago[i] + pendente[i]; acumulado.push(soma); }

    const seriesProvisao = [{ name: "Provisão acumulada", type: "line", areaStyle: {}, color: "#1f6fc4", data: acumulado }];
    const legendaProvisao = ["Provisão acumulada"];
    if (descontosPorMes) {
        const acumuladoDescontos = [];
        let somaDescontos = 0;
        for (let i = 0; i < 12; i++) { somaDescontos += descontosPorMes[i]; acumuladoDescontos.push(somaDescontos); }
        seriesProvisao.push({ name: "Descontos acumulados", type: "line", color: "#dc2e2e", data: acumuladoDescontos });
        legendaProvisao.push("Descontos acumulados");
    }

    const cProvisao = obterChart(idProvisao);
    if (cProvisao) cProvisao.setOption({
        tooltip: { trigger: "axis", valueFormatter: (v) => moeda(v) },
        legend: { bottom: 0, data: legendaProvisao },
        grid: { left: 95, right: 20, top: 30, bottom: 50 },
        xAxis: { type: "category", data: MESES_GERAL },
        yAxis: { type: "value", axisLabel: { formatter: fmtMoedaCurta } },
        series: seriesProvisao,
    }, true);
}

// Mesmos 2 gráficos, mas quebrando CADA período por empresa — cada empresa vira seu próprio
// segmento dentro da barra (cor de marca sólida = labelA, mesma cor com transparência = labelB),
// e o acumulado vira uma linha por empresa em vez de uma soma única. "linhasPorEmpresa" é um
// array de { idempresa, nomeempresa, chave, a, b } (a=valor de labelA, b=valor de labelB na chave).
function renderGraficosBrutoPorEmpresaGeral(idBarras, idAcumulado, categorias, linhasPorEmpresa, labelA, labelB) {
    if (typeof echarts === "undefined") return;
    const tooltipMoeda = { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (v) => moeda(v) };
    const yMoeda = { type: "value", axisLabel: { formatter: fmtMoedaCurta } };
    const xAxis = { type: "category", data: categorias };

    const empresas = new Map(); // idempresa -> { nome, a: number[], b: number[] }
    linhasPorEmpresa.forEach((r) => {
        if (!empresas.has(r.idempresa)) empresas.set(r.idempresa, { nome: r.nomeempresa, a: Array(categorias.length).fill(0), b: Array(categorias.length).fill(0) });
        const dest = empresas.get(r.idempresa);
        dest.a[r.idx] = r.a;
        dest.b[r.idx] = r.b;
    });

    const seriesBarras = [];
    empresas.forEach(({ nome, a, b }) => {
        const cor = corPrimariaEmpresa(nome);
        seriesBarras.push({ name: nome, type: "bar", stack: `emp-${nome}`, color: cor, data: a });
        seriesBarras.push({ name: `${nome} (${labelB})`, type: "bar", stack: `emp-${nome}`, color: corPrimariaEmpresaAlpha(nome, 0.4), data: b, itemStyle: { borderColor: cor, borderWidth: 1 } });
    });

    const cBarras = obterChart(idBarras);
    if (cBarras) cBarras.setOption({
        tooltip: tooltipMoeda,
        legend: { bottom: 0, data: Array.from(empresas.values()).map((e) => e.nome) },
        grid: { left: 95, right: 20, top: 30, bottom: 50 },
        xAxis, yAxis: yMoeda,
        series: seriesBarras,
    }, true);

    const seriesAcumulado = [];
    empresas.forEach(({ nome, a, b }) => {
        const acumulado = [];
        let soma = 0;
        for (let i = 0; i < categorias.length; i++) { soma += (a[i] || 0) + (b[i] || 0); acumulado.push(soma); }
        seriesAcumulado.push({ name: nome, type: "line", color: corPrimariaEmpresa(nome), data: acumulado });
    });

    const cAcumulado = obterChart(idAcumulado);
    if (cAcumulado) cAcumulado.setOption({
        tooltip: { trigger: "axis", valueFormatter: (v) => moeda(v) },
        legend: { bottom: 0, data: Array.from(empresas.values()).map((e) => e.nome) },
        grid: { left: 95, right: 20, top: 30, bottom: 50 },
        xAxis, yAxis: yMoeda,
        series: seriesAcumulado,
    }, true);
}

// As 5 categorias reais de Contas a Receber (ver /ceo/geral/receber em rotaCeo.js) — cor conta
// uma história de progressão: verde = já caiu na conta, azul = a caminho no prazo, vermelho =
// atrasado (mesmo tom de "erro/rejeitado" já usado no resto do app — atraso É um alerta de
// verdade aqui), âmbar = fechado mas ainda sem nota emitida, cinza = nem fechou ainda.
const CATEGORIAS_RECEBER_GERAL = [
    { chave: "recebido", label: "Recebido", cor: "#1e9e54" },
    { chave: "a_receber", label: "A Receber", cor: "#1f6fc4" },
    { chave: "recebimento_atrasado", label: "Recebimento Atrasado", cor: "#dc2e2e" },
    { chave: "a_faturar", label: "A Faturar", cor: "#e0a106" },
    { chave: "em_negociacao", label: "Em Negociação", cor: "#8a8f98" },
];

// Mesmos 2 gráficos (barras empilhadas + acumulado), mas com N categorias em vez de 2 fixas —
// usado só por Contas a Receber (Contas a Pagar continua com renderGraficosBrutoGeral, 2 séries).
// "series" = array de { label, cor, data } (data alinhado com "categorias").
function renderGraficosCategoriasGeral(idBarras, idAcumulado, categorias, series) {
    if (typeof echarts === "undefined") return;
    const tooltipMoeda = { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (v) => moeda(v) };
    const yMoeda = { type: "value", axisLabel: { formatter: fmtMoedaCurta } };
    const xAxis = { type: "category", data: categorias };

    const cBarras = obterChart(idBarras);
    if (cBarras) cBarras.setOption({
        tooltip: tooltipMoeda,
        legend: { bottom: 0, data: series.map((s) => s.label) },
        grid: { left: 95, right: 20, top: 30, bottom: 50 },
        xAxis, yAxis: yMoeda,
        series: series.map((s) => ({ name: s.label, type: "bar", stack: "total", color: s.cor, data: s.data })),
    }, true);

    const acumulado = [];
    let soma = 0;
    for (let i = 0; i < categorias.length; i++) {
        soma += series.reduce((s, serie) => s + (serie.data[i] || 0), 0);
        acumulado.push(soma);
    }

    const cAcumulado = obterChart(idAcumulado);
    if (cAcumulado) cAcumulado.setOption({
        tooltip: { trigger: "axis", valueFormatter: (v) => moeda(v) },
        grid: { left: 95, right: 20, top: 30, bottom: 30 },
        xAxis, yAxis: yMoeda,
        series: [{ name: "Acumulado", type: "line", areaStyle: {}, color: "#1f6fc4", data: acumulado }],
    }, true);
}

// Agrupa por mês os dados CRUS de um funcionário (já carregados em dadosFuncionarioGeral) no
// mesmo formato { holerite, staff, ajustes: [{mes, pago, pendente}] } que renderGraficosPanoramaGeral
// espera — usado quando um funcionário está selecionado, pra trocar o panorama do GRUPO pelo dele.
function agruparPorMesDoFuncionarioGeral({ holerites, staff, ajustes }, empresasSelecionadas) {
    const descontos = Array(12).fill(0);
    const holerite = [];
    // Salário e Benefícios contam como "pago" só quando conferidos (mesma regra de Vencimentos) —
    // ver calcularTotaisEmpresaGeral, que aplica exatamente essa mesma lógica na lista/detalhe.
    (holerites || [])
        .filter((h) => empresasSelecionadas.has(h.idempresa))
        .forEach((h) => {
            const idx = (parseInt(h.mes, 10) || 1) - 1;
            if (idx >= 0 && idx <= 11) descontos[idx] += Number(h.descontos) || 0;

            const valorSalario = (Number(h.proventos) || 0) - (Number(h.descontos) || 0);
            const pagoSalario = h.origem === "real" && h.status === "Pago";
            holerite.push({ mes: h.mes, pago: pagoSalario ? valorSalario : 0, pendente: pagoSalario ? 0 : valorSalario });

            const valorBeneficios = Number(h.beneficios) || 0;
            if (valorBeneficios) {
                const pagoBeneficios = h.origemBeneficios === "real" && h.status_beneficios === "Pago";
                holerite.push({ mes: h.mes, pago: pagoBeneficios ? valorBeneficios : 0, pendente: pagoBeneficios ? 0 : valorBeneficios });
            }
        });

    const staffAgrupado = (staff || [])
        .filter((s) => empresasSelecionadas.has(s.idempresa))
        .map((s) => {
            const mes = s.dtinirealizacao ? new Date(s.dtinirealizacao).getMonth() + 1 : 1;
            const vCache = Number(s.vlrcache) || 0, vAjd = Number(s.vlrajdcusto) || 0, vCaix = Number(s.vlrcaixinha) || 0;
            const pago = (s.statuspgto === "Pago" ? vCache : 0) + (s.statuspgtoajdcto === "Pago" ? vAjd : 0) + (s.statuspgtocaixinha === "Pago" ? vCaix : 0);
            return { mes, pago, pendente: (vCache + vAjd + vCaix) - pago };
        });

    const ajustesAgrupado = (ajustes || [])
        .filter((a) => empresasSelecionadas.has(a.idempresa))
        .map((a) => ({
            mes: a.dtlancamento ? new Date(a.dtlancamento).getMonth() + 1 : 1,
            pago: a.tipo === "Credito" ? (Number(a.valor) || 0) : -(Number(a.valor) || 0),
        }));

    return { holerite, staff: staffAgrupado, ajustes: ajustesAgrupado, descontos };
}

// Funcionários / Gráficos: com um funcionário selecionado, mostra o panorama DELE (a partir do
// que já foi buscado em dadosFuncionarioGeral, sem nova requisição); sem seleção, mostra o
// panorama REAL do grupo inteiro via /ceo/geral/panorama. Respeita os chips de empresa ativos.
async function carregarGraficosFuncionariosGeral() {
    if (!empresasSelecionadasGeral) return;
    const legenda = document.getElementById("ceo-geral-graficos-legenda");

    if (funcionarioSelecionadoGeral && dadosFuncionarioGeral) {
        if (legenda) legenda.textContent = `Panorama de ${funcionarioSelecionadoGeral.nome} ${textoPeriodoFuncionariosGeral()} — o que já é certo (pago ou pendente), a provisão de custo acumulada e os descontos (em vermelho) — dá pra comparar se ainda compensa manter o regime dele (CLT × PJ/MEI).`;
        const dados = agruparPorMesDoFuncionarioGeral(dadosFuncionarioGeral, empresasSelecionadasGeral);
        renderGraficosPanoramaGeral("chart-geral-contratado", "chart-geral-provisao", dados, dados.descontos);
        return;
    }

    if (legenda) legenda.textContent = `Panorama do grupo inteiro (todos os funcionários) ${textoPeriodoFuncionariosGeral()} — o que já é certo (contratado, pago ou pendente de pagamento) e a provisão de custo acumulada.`;
    const ano = document.getElementById("ceo-geral-select-ano")?.value || new Date().getFullYear();
    const todas = empresasGeral.length > 0 && empresasGeral.every((e) => empresasSelecionadasGeral.has(e.idempresa));
    const params = new URLSearchParams({ ano });
    if (!todas) params.set("idempresas", Array.from(empresasSelecionadasGeral).join(","));
    if (mesFuncionariosGeral) params.set("mes", mesFuncionariosGeral);

    try {
        const data = await fetchComToken(`/ceo/geral/panorama?${params.toString()}`);
        renderGraficosPanoramaGeral("chart-geral-contratado", "chart-geral-provisao", data || {});
    } catch (err) {
        console.error("Erro ao carregar panorama de funcionários (CEO Geral):", err);
    }
}

// Resumo A Receber × A Pagar × Saldo — aba própria "⚖️ Comparar A Receber × A Pagar". Separa o que já é
// CERTO (recebido de verdade × já pago de verdade) do que é PROVISÃO (soma também a_receber +
// recebimento_atrasado + a_faturar de Contas a receber e o pendente de Contas a pagar) — misturar
// os dois numa conta só fazia o "Disponível pra investir" comparar entrada real com saída que já
// incluía previsão, o que não fecha (não é comparação de mesma natureza). "Em Negociação" (orçamento
// ainda não fechado) não entra na soma — é informativo só, mostrado entre parênteses ao lado da
// Previsão a Receber, pra alertar o CEO a correr atrás em vez de já contar como certo.
function renderSaldoEntradaSaidaGeral(containerId, dados) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const saldoCerto = dados.recebidoReal - dados.pagoReal;
    const saldoProvisao = (dados.recebidoReal + dados.aReceberPrevisao) - (dados.pagoReal + dados.pagarPrevisao);
    const notaNegociacao = dados.emNegociacao > 0
        ? ` <small>(+ ${moedaGeral(dados.emNegociacao)} em negociação)</small>`
        : "";
    // Aqui não repete o valor de "Em Negociação" (isso já está na nota da Previsão a Receber) —
    // mostra o RESULTADO: o saldo final que a Provisão de Disponível a Investir alcançaria se toda
    // negociação em aberto fechasse (entrasse de fato na Previsão a Receber).
    const saldoProvisaoSeNegociacaoFechar = saldoProvisao + dados.emNegociacao;
    const notaNegociacaoSaldo = dados.emNegociacao > 0
        ? ` <small>(chegaria a ${moedaGeral(saldoProvisaoSeNegociacaoFechar)} se fechar as negociações em aberto)</small>`
        : "";
    el.innerHTML = `
        <div class="ceo-resumo-card"><span>Recebido (certo)</span><strong class="pos">${moedaGeral(dados.recebidoReal)}</strong></div>
        <div class="ceo-resumo-card"><span>Pago (certo)</span><strong class="neg">${moedaGeral(dados.pagoReal)}</strong></div>
        <div class="ceo-resumo-card"><span>Disponível pra investir</span><strong class="${saldoCerto < 0 ? "neg" : "pos"}">${moedaGeral(saldoCerto)}</strong></div>
        <div class="ceo-resumo-card"><span>Previsão a receber</span><strong class="pos">${moedaGeral(dados.aReceberPrevisao)}</strong>${notaNegociacao}</div>
        <div class="ceo-resumo-card"><span>Previsão a pagar</span><strong class="neg">${moedaGeral(dados.pagarPrevisao)}</strong></div>
        <div class="ceo-resumo-card"><span>Provisão de Disponível a Investir</span><strong class="${saldoProvisao < 0 ? "neg" : "pos"}">${moedaGeral(saldoProvisao)}</strong>${notaNegociacaoSaldo}</div>
    `;
}

let mesComparativoGeral = ""; // "" (ano inteiro) | "1".."12" — filtro PRÓPRIO do comparativo, não
                               // depende do "Mês" de Contas a Pagar nem de Contas a Receber (evita
                               // o bug de herdar o filtro errado conforme onde foi clicado).

// Ano/empresas selecionados no topo + o Mês próprio do comparativo (se algum estiver marcado).
function paramsAnoEmpresasGeral(agrupamento) {
    const ano = document.getElementById("ceo-geral-select-ano")?.value || new Date().getFullYear();
    const params = new URLSearchParams({ agrupamento, ano });
    const todas = empresasGeral.length > 0 && empresasSelecionadasGeral && empresasGeral.every((e) => empresasSelecionadasGeral.has(e.idempresa));
    if (empresasSelecionadasGeral && !todas) params.set("idempresas", Array.from(empresasSelecionadasGeral).join(","));
    if (mesComparativoGeral) params.set("mes", mesComparativoGeral);
    return params;
}

async function carregarComparativoGeral() {
    try {
        const params = paramsAnoEmpresasGeral("empresa");
        const [dataReceber, dataPagar] = await Promise.all([
            fetchComToken(`/ceo/geral/receber?${params.toString()}`),
            fetchComToken(`/ceo/geral/pagar?${params.toString()}`),
        ]);
        const linhasReceber = (dataReceber && dataReceber.linhas) || [];
        const linhasPagar = (dataPagar && dataPagar.linhas) || [];
        renderSaldoEntradaSaidaGeral("ceo-comparativo-resultado", {
            recebidoReal: linhasReceber.reduce((s, r) => s + (Number(r.recebido) || 0), 0),
            // "Ainda vai receber" = a_receber (dentro do prazo) + recebimento_atrasado (vencido, mas
            // ainda esperado) + a_faturar (evento já fechado, só falta emitir a NF — praticamente
            // certo). "Em Negociação" fica de fora daqui, ver emNegociacao abaixo.
            aReceberPrevisao: linhasReceber.reduce((s, r) =>
                s + (Number(r.a_receber) || 0) + (Number(r.recebimento_atrasado) || 0) + (Number(r.a_faturar) || 0), 0),
            emNegociacao: linhasReceber.reduce((s, r) => s + (Number(r.em_negociacao) || 0), 0),
            pagoReal: linhasPagar.reduce((s, r) => s + (Number(r.despesapaga) || 0), 0),
            pagarPrevisao: linhasPagar.reduce((s, r) => s + (Number(r.despesapendente) || 0), 0),
        });
    } catch (err) {
        console.error("Erro ao carregar comparativo entrada×saída (CEO Geral):", err);
    }
}

// Gráfico mensal próprio do comparativo — sempre os 12 meses do ano selecionado (não depende do
// filtro de mês de Contas a Pagar/Receber), pra dar a visão "quanto entrou × quanto saiu" mês a mês
// que antes só existia misturada dentro de cada aba individual.
async function carregarGraficosComparativoGeral() {
    if (!empresasSelecionadasGeral) return;
    try {
        const params = paramsAnoEmpresasGeral("mensal");
        const [dataReceber, dataPagar] = await Promise.all([
            fetchComToken(`/ceo/geral/receber?${params.toString()}`),
            fetchComToken(`/ceo/geral/pagar?${params.toString()}`),
        ]);
        const linhasReceber = (dataReceber && dataReceber.linhas) || [];
        const linhasPagar = (dataPagar && dataPagar.linhas) || [];

        const entradaCerta = Array(12).fill(0), entradaPrevisao = Array(12).fill(0);
        linhasReceber.forEach((r) => {
            const idx = (parseInt(r.chave, 10) || 1) - 1;
            if (idx < 0 || idx > 11) return;
            entradaCerta[idx] += Number(r.recebido) || 0;
            entradaPrevisao[idx] += (Number(r.a_receber) || 0) + (Number(r.recebimento_atrasado) || 0) + (Number(r.a_faturar) || 0);
        });

        const saidaCerta = Array(12).fill(0), saidaPrevisao = Array(12).fill(0);
        linhasPagar.forEach((r) => {
            const idx = (parseInt(r.chave, 10) || 1) - 1;
            if (idx < 0 || idx > 11) return;
            saidaCerta[idx] += Number(r.despesapaga) || 0;
            saidaPrevisao[idx] += Number(r.despesapendente) || 0;
        });

        renderGraficosComparativoGeral(entradaCerta, saidaCerta, entradaPrevisao, saidaPrevisao);
    } catch (err) {
        console.error("Erro ao carregar gráfico do comparativo entrada×saída (CEO Geral):", err);
    }
}

function renderGraficosComparativoGeral(entradaCerta, saidaCerta, entradaPrevisao, saidaPrevisao) {
    if (typeof echarts === "undefined") return;
    const tooltipMoeda = { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (v) => moeda(v) };
    const yMoeda = { type: "value", axisLabel: { formatter: fmtMoedaCurta } };
    const xAxis = { type: "category", data: MESES_GERAL };

    const cCerto = obterChart("chart-comparativo-certo");
    if (cCerto) cCerto.setOption({
        tooltip: tooltipMoeda,
        legend: { bottom: 0, data: ["Recebido", "Pago"] },
        grid: { left: 95, right: 20, top: 30, bottom: 50 },
        xAxis, yAxis: yMoeda,
        series: [
            { name: "Recebido", type: "bar", color: "#1e9e54", data: entradaCerta },
            { name: "Pago", type: "bar", color: "#dc2e2e", data: saidaCerta },
        ],
    }, true);

    const cPrevisao = obterChart("chart-comparativo-previsao");
    if (cPrevisao) cPrevisao.setOption({
        tooltip: tooltipMoeda,
        legend: { bottom: 0, data: ["Previsão a receber", "Previsão a pagar"] },
        grid: { left: 95, right: 20, top: 30, bottom: 50 },
        xAxis, yAxis: yMoeda,
        series: [
            { name: "Previsão a receber", type: "bar", color: "#1f6fc4", data: entradaPrevisao },
            { name: "Previsão a pagar", type: "bar", color: "#e0a106", data: saidaPrevisao },
        ],
    }, true);
}

// ===== Contas a pagar (REAL — custo orçado do evento, o mesmo já usado na Rentabilidade) =====
let agrupamentoPagarGeral = "mensal"; // "mensal" | "anual"
let mesPagarGeral = "";               // "" (todos) | "1".."12"

// Monta os parâmetros comuns (ano/idempresas/mês) pro endpoint /ceo/geral/pagar, respeitando os
// chips de empresa ativos e o Mês PRÓPRIO de Contas a Pagar (mesFuncionariosGeral/mesReceberGeral
// são de outras abas — usar o errado aqui já causou o gráfico filtrar e a lista não, ou vice-versa).
function paramsPagarGeral(agrupamento) {
    const ano = document.getElementById("ceo-geral-select-ano")?.value || new Date().getFullYear();
    const params = new URLSearchParams({ agrupamento, ano });
    const todas = empresasGeral.length > 0 && empresasSelecionadasGeral && empresasGeral.every((e) => empresasSelecionadasGeral.has(e.idempresa));
    if (empresasSelecionadasGeral && !todas) params.set("idempresas", Array.from(empresasSelecionadasGeral).join(","));
    if (mesPagarGeral) params.set("mes", mesPagarGeral);
    return params;
}

// Gráficos / Contas a pagar: dado bruto de saída — Paga (evento já realizado) × Pendente (ainda
// por acontecer), e o acumulado no período. Sem lucro/saldo aqui (isso é a aba Rentabilidade).
async function carregarGraficosContasGeral() {
    if (!empresasSelecionadasGeral) return;
    try {
        const params = paramsPagarGeral(agrupamentoPagarGeral);
        params.set("porEmpresa", "1");
        const data = await fetchComToken(`/ceo/geral/pagar?${params.toString()}`);
        const linhas = (data && data.linhas) || [];

        const categorias = agrupamentoPagarGeral === "anual"
            ? Array.from(new Set(linhas.map((r) => String(r.chave)))).sort()
            : MESES_GERAL;
        const indiceDaChave = (chave) => agrupamentoPagarGeral === "anual"
            ? categorias.indexOf(String(chave))
            : (parseInt(chave, 10) || 1) - 1;

        const linhasPorEmpresa = linhas
            .map((r) => ({
                idempresa: r.idempresa, nomeempresa: r.nmfantasia,
                idx: indiceDaChave(r.chave),
                a: Number(r.despesapaga) || 0, b: Number(r.despesapendente) || 0,
            }))
            .filter((r) => r.idx >= 0 && r.idx < categorias.length);

        renderGraficosBrutoPorEmpresaGeral("chart-contas-contratado", "chart-contas-provisao", categorias, linhasPorEmpresa, "Paga", "Pendente");
    } catch (err) {
        console.error("Erro ao carregar contas a pagar (CEO Geral):", err);
    }
}

// Lista / Contas a pagar: mesma tabela horizontal usada em Funcionários/Contas a receber, agora
// com dado real (despesa do evento) agrupada por empresa, sem coluna de lucro/saldo.
async function renderColunasContasGeral() {
    const cont = document.getElementById("ceo-geral-colunas-contas");
    if (!cont || !empresasSelecionadasGeral) return;

    try {
        const data = await fetchComToken(`/ceo/geral/pagar?${paramsPagarGeral("empresa").toString()}`);
        const porEmpresa = new Map((data?.linhas || []).map((r) => [r.chave, r]));
        const empresasVisiveis = empresasGeral.filter((e) => empresasSelecionadasGeral.has(e.idempresa) && porEmpresa.has(e.idempresa));

        if (empresasVisiveis.length === 0) {
            cont.innerHTML = '<p class="ceo-vazio">Nenhuma despesa (fornecedores/outros ou folha) nas empresas selecionadas.</p>';
            return;
        }

        let totPaga = 0, totPendente = 0;
        const linhasHtml = empresasVisiveis.map((e) => {
            const r = porEmpresa.get(e.idempresa);
            const paga = Number(r.despesapaga) || 0, pendente = Number(r.despesapendente) || 0;
            totPaga += paga; totPendente += pendente;
            return `<tr>
                <td><span class="ceo-geral-empresa-tag ${classeTemaEmpresa(e.nmfantasia)}">${e.nmfantasia}</span></td>
                <td class="neg">${moedaGeral(paga)}</td>
                <td>${moedaGeral(pendente)}</td>
                <td>${moedaGeral(paga + pendente)}</td>
            </tr>`;
        }).join("");

        cont.innerHTML = `
            <div class="ceo-resumo ceo-geral-total-geral">
                <div class="ceo-resumo-card"><span>Paga (todas as empresas)</span><strong class="neg">${moedaGeral(totPaga)}</strong></div>
                <div class="ceo-resumo-card"><span>Pendente (todas as empresas)</span><strong>${moedaGeral(totPendente)}</strong></div>
                <div class="ceo-resumo-card"><span>Total</span><strong>${moedaGeral(totPaga + totPendente)}</strong></div>
            </div>
            <div class="ceo-geral-tabela-wrap">
                <table class="ceo-geral-tabela-empresas">
                    <thead><tr><th>Empresa</th><th>Paga</th><th>Pendente</th><th>Total</th></tr></thead>
                    <tbody>${linhasHtml}</tbody>
                </table>
            </div>`;
    } catch (err) {
        console.error("Erro ao carregar contas a pagar - lista (CEO Geral):", err);
    }
}

// ===== Contas a receber (REAL — vlrcliente do orçamento) =====
let agrupamentoReceberGeral = "mensal"; // "mensal" | "anual" — controlado pelo radio da seção de gráficos
let mesReceberGeral = "";               // "" (todos) | "1".."12" — filtro extra, vale pros dois agrupamentos
let eventoSelecionadoReceberGeral = null; // { idevento, nome } — quando setado, os gráficos comparam esse evento por ano (ignora agrupamento/mês)

// Monta os parâmetros comuns (ano/idempresas/mês) pro endpoint /ceo/geral/receber, respeitando
// os chips de empresa ativos (mesmo critério "sem filtro = todas" usado no panorama de funcionários).
function paramsReceberGeral(agrupamento) {
    const ano = document.getElementById("ceo-geral-select-ano")?.value || new Date().getFullYear();
    const params = new URLSearchParams({ agrupamento, ano });
    const todas = empresasGeral.length > 0 && empresasSelecionadasGeral && empresasGeral.every((e) => empresasSelecionadasGeral.has(e.idempresa));
    if (empresasSelecionadasGeral && !todas) params.set("idempresas", Array.from(empresasSelecionadasGeral).join(","));
    if (mesReceberGeral) params.set("mes", mesReceberGeral);
    return params;
}

// Habilita/desabilita Agrupar-por e Mês conforme tem ou não um evento selecionado pro
// comparativo entre anos (nesse modo, esses dois filtros não fazem sentido — o comparativo já é
// por ano, de um evento só, entre TODAS as empresas onde ele apareceu).
function atualizarControlesReceberGeral() {
    const desabilitar = !!eventoSelecionadoReceberGeral;
    document.querySelectorAll('input[name="ceo-receber-agrupamento"]').forEach((r) => { r.disabled = desabilitar; });
    const selMes = document.getElementById("ceo-receber-select-mes");
    if (selMes) selMes.disabled = desabilitar;
    const btnLimpar = document.getElementById("ceo-receber-evento-limpar");
    if (btnLimpar) btnLimpar.style.display = desabilitar ? "" : "none";
    // "Detalhar por empresa" só faz sentido DEPOIS de escolher um evento (é a quebra por empresa
    // daquele evento) — some quando não há evento selecionado.
    const btnDetalhar = document.getElementById("ceo-receber-detalhar");
    if (btnDetalhar) btnDetalhar.style.display = desabilitar ? "" : "none";
    if (!desabilitar) {
        const box = document.getElementById("ceo-receber-detalhe");
        if (box) box.style.display = "none";
        if (btnDetalhar) btnDetalhar.textContent = "🔍 Detalhar por empresa";
    }
}

async function buscarEventosReceberGeral(busca) {
    const lista = document.getElementById("ceo-busca-evento-receber-lista");
    if (!busca) { lista.style.display = "none"; lista.innerHTML = ""; return; }
    try {
        const eventos = await fetchComToken(`/ceo/geral/eventos?busca=${encodeURIComponent(busca)}`);
        if (!eventos || eventos.length === 0) {
            lista.innerHTML = '<li class="vazio">Nenhum evento encontrado.</li>';
        } else {
            lista.innerHTML = eventos.map((ev) =>
                `<li data-id="${ev.idevento}" data-nome="${ev.nmevento}">${ev.nmevento} <small>${(ev.clientes || []).join(", ")}</small></li>`
            ).join("");
            lista.querySelectorAll("li[data-id]").forEach((li) => {
                li.addEventListener("click", () => {
                    document.getElementById("ceo-busca-evento-receber").value = li.dataset.nome;
                    lista.style.display = "none";
                    eventoSelecionadoReceberGeral = { idevento: li.dataset.id, nome: li.dataset.nome };
                    atualizarControlesReceberGeral();
                    carregarGraficosContasReceberGeral();
                });
            });
        }
        lista.style.display = "block";
    } catch (err) {
        console.error("Erro ao buscar eventos (CEO Geral):", err);
    }
}

function limparEventoReceberGeral() {
    eventoSelecionadoReceberGeral = null;
    document.getElementById("ceo-busca-evento-receber").value = "";
    atualizarControlesReceberGeral();
    carregarGraficosContasReceberGeral();
}

let linhasEventoAnosGeral = null; // cache das linhas cruas (por ano+empresa) do evento selecionado, pro botão "Detalhar por empresa"

// Gráficos / Contas a receber (BRUTO — sem lucro/saldo, isso é papel da aba Rentabilidade) — as
// 5 categorias reais empilhadas (CATEGORIAS_RECEBER_GERAL), somadas entre as empresas
// selecionadas (o detalhe por empresa fica pra tabela abaixo — 5 categorias × N empresas na
// mesma barra ficaria ilegível). Dois modos:
// 1) Normal: por MÊS do ano selecionado ou por ANO (todos), conforme agrupamentoReceberGeral;
//    mesReceberGeral filtra um mês só.
// 2) Evento selecionado: mesma métrica, mas comparando o MESMO evento ano a ano (soma as
//    empresas por ano); as linhas cruas por empresa ficam cacheadas pro botão "Detalhar por
//    empresa", que só aparece nesse modo.
// Previsão de recebimento por mês (independe de ter um evento selecionado no comparativo —
// é sempre "quando o dinheiro do grupo/empresas filtradas é esperado", não por evento).
async function carregarPrevisaoRecebimentoGeral() {
    const ano = document.getElementById("ceo-geral-select-ano")?.value || new Date().getFullYear();
    const params = new URLSearchParams({ ano });
    const idsFiltro = empresasSelecionadasGeral && empresasGeral.length && !empresasGeral.every((e) => empresasSelecionadasGeral.has(e.idempresa))
        ? empresasGeral.filter((e) => empresasSelecionadasGeral.has(e.idempresa)).map((e) => e.idempresa)
        : [];
    if (idsFiltro.length) params.set("idempresas", idsFiltro.join(","));

    try {
        const data = await fetchComToken(`/ceo/geral/previsao-recebimento?${params.toString()}`);
        const porMes = Array(12).fill(0);
        (data?.linhas || []).forEach((r) => {
            const idx = (parseInt(r.mes, 10) || 1) - 1;
            if (idx >= 0 && idx < 12) porMes[idx] = Number(r.previsto) || 0;
        });
        const chart = obterChart("chart-contas-receber-previsao");
        if (chart) chart.setOption({
            tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (v) => moeda(v) },
            grid: { left: 95, right: 20, top: 20, bottom: 30 },
            xAxis: { type: "category", data: MESES_GERAL },
            yAxis: { type: "value", axisLabel: { formatter: fmtMoedaCurta } },
            series: [{ name: "Previsto", type: "bar", color: "#1f6fc4", data: porMes }],
        }, true);
    } catch (err) {
        console.error("Erro ao carregar previsão de recebimento (CEO Geral):", err);
    }
}

async function carregarGraficosContasReceberGeral() {
    if (!empresasSelecionadasGeral) return;
    carregarPrevisaoRecebimentoGeral();
    try {
        if (eventoSelecionadoReceberGeral) {
            const data = await fetchComToken(`/ceo/geral/evento-anos?idevento=${eventoSelecionadoReceberGeral.idevento}`);
            linhasEventoAnosGeral = (data && data.linhas) || [];

            const porAno = new Map();
            linhasEventoAnosGeral.forEach((r) => {
                const acc = porAno.get(r.ano) || Object.fromEntries(CATEGORIAS_RECEBER_GERAL.map((c) => [c.chave, 0]));
                CATEGORIAS_RECEBER_GERAL.forEach((c) => { acc[c.chave] += Number(r[c.chave]) || 0; });
                porAno.set(r.ano, acc);
            });
            const anos = Array.from(porAno.keys()).sort((a, b) => a - b);
            renderGraficosCategoriasGeral(
                "chart-contas-receber-contratado", "chart-contas-receber-provisao",
                anos.map(String),
                CATEGORIAS_RECEBER_GERAL.map((c) => ({ label: c.label, cor: c.cor, data: anos.map((a) => porAno.get(a)[c.chave]) })),
            );

            const detalheAberto = document.getElementById("ceo-receber-detalhe")?.style.display !== "none";
            if (detalheAberto) renderDetalheEmpresaEventoGeral(linhasEventoAnosGeral);
            return;
        }

        const params = paramsReceberGeral(agrupamentoReceberGeral);
        const data = await fetchComToken(`/ceo/geral/receber?${params.toString()}`);
        const linhas = (data && data.linhas) || [];

        const categorias = agrupamentoReceberGeral === "anual"
            ? Array.from(new Set(linhas.map((r) => String(r.chave)))).sort()
            : MESES_GERAL;
        const indiceDaChave = (chave) => agrupamentoReceberGeral === "anual"
            ? categorias.indexOf(String(chave))
            : (parseInt(chave, 10) || 1) - 1;

        const series = CATEGORIAS_RECEBER_GERAL.map((c) => ({ label: c.label, cor: c.cor, data: Array(categorias.length).fill(0) }));
        linhas.forEach((r) => {
            const idx = indiceDaChave(r.chave);
            if (idx < 0 || idx >= categorias.length) return;
            series.forEach((s, i) => { s.data[idx] += Number(r[CATEGORIAS_RECEBER_GERAL[i].chave]) || 0; });
        });

        renderGraficosCategoriasGeral("chart-contas-receber-contratado", "chart-contas-receber-provisao", categorias, series);
    } catch (err) {
        console.error("Erro ao carregar contas a receber (CEO Geral):", err);
    }
}

// ===== Detalhar por empresa — só aparece com um evento selecionado (comparativo entre anos).
// Quebra o mesmo evento por EMPRESA×ano, pra achar onde está a maior despesa e o maior/menor
// lucro entre as empresas que participaram dele, em vez de só ver o total somado. =====
function alternarDetalheReceberGeral() {
    const box = document.getElementById("ceo-receber-detalhe");
    const btn = document.getElementById("ceo-receber-detalhar");
    if (!box) return;
    const abrindo = box.style.display === "none";
    box.style.display = abrindo ? "" : "none";
    if (btn) btn.textContent = abrindo ? "🔍 Ocultar detalhe por empresa" : "🔍 Detalhar por empresa";
    if (abrindo) renderDetalheEmpresaEventoGeral(linhasEventoAnosGeral);
}

function renderDetalheEmpresaEventoGeral(linhas) {
    const rankingEl = document.getElementById("ceo-receber-ranking");
    if (!linhas || linhas.length === 0) {
        if (rankingEl) rankingEl.innerHTML = '<p class="ceo-vazio">Nenhum dado pra este evento.</p>';
        const c = obterChart("chart-contas-receber-eventos");
        if (c) c.clear();
        return;
    }

    const linhasOrdenadas = [...linhas].sort((a, b) => a.ano - b.ano || (a.nomeempresa || "").localeCompare(b.nomeempresa || ""));
    const itens = linhasOrdenadas.map((r) => ({
        label: `${r.nomeempresa} · ${r.ano}`,
        ...Object.fromEntries(CATEGORIAS_RECEBER_GERAL.map((c) => [c.chave, Number(r[c.chave]) || 0])),
    }));

    // Total de cada categoria somado entre todas as empresa×ano do evento — mais direto que um
    // ranking de maior/menor linha única quando são 5 categorias em vez de 2.
    if (rankingEl) rankingEl.innerHTML = CATEGORIAS_RECEBER_GERAL.map((c) => {
        const total = itens.reduce((s, i) => s + i[c.chave], 0);
        return `<div class="ceo-resumo-card"><span>${c.label}</span><strong style="color:${c.cor}">${moedaGeral(total)}</strong></div>`;
    }).join("");

    if (typeof echarts === "undefined") return;
    const nomes = itens.map((i) => nomeCurto(i.label, 24));
    const c = obterChart("chart-contas-receber-eventos");
    if (c) c.setOption({
        tooltip: { trigger: "axis", valueFormatter: (v) => moeda(v) },
        legend: { bottom: 0, data: CATEGORIAS_RECEBER_GERAL.map((cat) => cat.label) },
        grid: { left: 95, right: 20, top: 30, bottom: 90 },
        xAxis: { type: "category", data: nomes, axisLabel: { rotate: 30, interval: 0, fontSize: 10 } },
        yAxis: { type: "value", axisLabel: { formatter: fmtMoedaCurta } },
        dataZoom: itens.length > 15 ? [{ type: "slider", xAxisIndex: 0, start: 0, end: (15 / itens.length) * 100, height: 14, bottom: 60 }] : [],
        series: CATEGORIAS_RECEBER_GERAL.map((cat) => ({
            name: cat.label, type: "line", color: cat.cor, data: itens.map((i) => i[cat.chave]),
        })),
    }, true);
}

// Lista / Contas a receber: mesma tabela horizontal usada em Funcionários, agora com dado REAL
// (agrupado por empresa, no ano selecionado no filtro global).
async function renderColunasContasReceberGeral() {
    const cont = document.getElementById("ceo-geral-colunas-contas-receber");
    if (!cont || !empresasSelecionadasGeral) return;

    try {
        const data = await fetchComToken(`/ceo/geral/receber?${paramsReceberGeral("empresa").toString()}`);
        const porEmpresa = new Map((data?.linhas || []).map((r) => [r.chave, r]));
        const empresasVisiveis = empresasGeral.filter((e) => empresasSelecionadasGeral.has(e.idempresa) && porEmpresa.has(e.idempresa));

        if (empresasVisiveis.length === 0) {
            cont.innerHTML = '<p class="ceo-vazio">Nenhum orçamento com evento/data de realização para este ano nas empresas selecionadas.</p>';
            return;
        }

        const totais = Object.fromEntries(CATEGORIAS_RECEBER_GERAL.map((c) => [c.chave, 0]));
        const linhasHtml = empresasVisiveis.map((e) => {
            const r = porEmpresa.get(e.idempresa);
            const valores = CATEGORIAS_RECEBER_GERAL.map((c) => Number(r[c.chave]) || 0);
            valores.forEach((v, i) => { totais[CATEGORIAS_RECEBER_GERAL[i].chave] += v; });
            const total = valores.reduce((s, v) => s + v, 0);
            return `<tr>
                <td><span class="ceo-geral-empresa-tag ${classeTemaEmpresa(e.nmfantasia)}">${e.nmfantasia}</span></td>
                ${valores.map((v) => `<td>${moedaGeral(v)}</td>`).join("")}
                <td>${moedaGeral(total)}</td>
            </tr>`;
        }).join("");

        const totalGeral = CATEGORIAS_RECEBER_GERAL.reduce((s, c) => s + totais[c.chave], 0);
        const cardsResumo = CATEGORIAS_RECEBER_GERAL.map((c) =>
            `<div class="ceo-resumo-card"><span>${c.label}</span><strong style="color:${c.cor}">${moedaGeral(totais[c.chave])}</strong></div>`
        ).join("");

        cont.innerHTML = `
            <div class="ceo-resumo ceo-geral-total-geral">
                ${cardsResumo}
                <div class="ceo-resumo-card"><span>Total</span><strong>${moedaGeral(totalGeral)}</strong></div>
            </div>
            <div class="ceo-geral-tabela-wrap">
                <table class="ceo-geral-tabela-empresas">
                    <thead><tr><th>Empresa</th>${CATEGORIAS_RECEBER_GERAL.map((c) => `<th>${c.label}</th>`).join("")}<th>Total</th></tr></thead>
                    <tbody>${linhasHtml}</tbody>
                </table>
            </div>
            <p class="ceo-vazio-sutil" style="margin-top:12px;">Valor total do cliente (vlrcliente) por orçamento, partido pelo status real de faturamento/recebimento (routes/rotaCeo.js explica cada categoria).</p>`;
    } catch (err) {
        console.error("Erro ao carregar contas a receber - lista (CEO Geral):", err);
    }
}

// ===== Toggle do CeoMode =====
// Acesso restrito a quem tem a flag especial "supremo" (ver docs/PERMISSOES.md).
// O backend (rotas /ceo/*) é quem realmente bloqueia; isto aqui é só UX.
// Mesmo padrão de RH/T.I (public/js/RH.js, public/js/TIMode.js): um clique no item do menu
// liga/desliga o modo direto (sem dropdown); "Rentabilidade por Evento" e "Visão Geral" viram
// pílulas fixas no topo do conteúdo, dentro de #ceo-panel-wrapper. O CSS (body.ceo-mode
// #ceo-panel-wrapper) cuida de mostrar/esconder o wrapper inteiro sozinho.
function initCeoMode() {
    const li = document.querySelector("li.Ceo");
    const linkPrincipal = li?.querySelector(":scope > a");
    if (!li || !linkPrincipal) return;

    const temAcesso = window.temPermissao?.("Staff", "supremo") ?? false;
    if (!temAcesso) {
        li.style.display = "none";
        return;
    }
    li.style.display = "";

    const icone = linkPrincipal.querySelector(".material-symbols-outlined");

    linkPrincipal.addEventListener("click", (e) => {
        e.preventDefault();
        const ativo = document.body.classList.toggle("ceo-mode");
        if (ativo) {
            // Só um "modo de tela cheia" por vez — mesma regra espelhada em RH.js/TIMode.js.
            document.body.classList.remove("rh-mode", "ti-mode");
            const iconeRH = document.querySelector("li.RH .material-symbols-outlined");
            if (iconeRH) iconeRH.textContent = "";
        }
        if (icone) icone.textContent = ativo ? "logout" : "finance";
        linkPrincipal.title = ativo ? "Sair do CEO Mode" : "CEO Mode";
        if (ativo) {
            montarAbasCeo();
            trocarAbaCeo("rentabilidade");
        }
    });
}

// Barra de pílulas (Rentabilidade por Evento / Visão Geral) — mesmo padrão visual e de
// comportamento das abas do T.I. (ver montarPainelTI/trocarAbaTI em public/js/TIMode.js).
function montarAbasCeo() {
    if (document.getElementById("ceo-panel-abas")) return;
    const conteudo = document.getElementById("conteudo");
    if (!conteudo) return;

    const wrapper = document.createElement("div");
    wrapper.id = "ceo-panel-wrapper";

    const abas = document.createElement("div");
    abas.id = "ceo-panel-abas";
    abas.className = "ceo-abas";
    abas.innerHTML = `
        <button type="button" class="ceo-aba-btn" data-aba="rentabilidade"><span class="material-symbols-outlined">monitoring</span>Rentabilidade por Evento</button>
        <button type="button" class="ceo-aba-btn" data-aba="geral"><span class="material-symbols-outlined">groups</span>Visão Geral</button>
    `;
    abas.querySelectorAll(".ceo-aba-btn").forEach((btn) => {
        btn.addEventListener("click", () => trocarAbaCeo(btn.dataset.aba));
    });

    wrapper.appendChild(abas);
    conteudo.appendChild(wrapper);
}

// Monta (se preciso) e exibe a aba escolhida, marcando a pílula correspondente como ativa.
function trocarAbaCeo(nome) {
    if (nome === "rentabilidade") montarPainel();
    else montarPainelGeral();

    const panelRent = document.getElementById("ceo-panel");
    const panelGeral = document.getElementById("ceo-panel-geral");
    if (panelRent) panelRent.style.display = nome === "rentabilidade" ? "" : "none";
    if (panelGeral) panelGeral.style.display = nome === "geral" ? "" : "none";

    document.querySelectorAll("#ceo-panel-abas .ceo-aba-btn").forEach((btn) => {
        btn.classList.toggle("ativo", btn.dataset.aba === nome);
    });
}

// Espera window.permissoes estar disponível antes de checar temPermissao (evita
// esconder o CEO Mode por engano por causa do carregamento assíncrono em Index.js).
document.addEventListener("DOMContentLoaded", () => {
    if (Array.isArray(window.permissoes)) initCeoMode();
    else document.addEventListener("permissoesCarregadas", initCeoMode, { once: true });
});
