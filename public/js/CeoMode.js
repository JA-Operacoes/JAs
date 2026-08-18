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

    let tentativas = 0;
    const intervalo = setInterval(async () => {
        const inputNr = document.getElementById("nrOrcamento");
        tentativas++;
        if (inputNr) {
            clearInterval(intervalo);
            inputNr.value = nrOrcamento;
            inputNr.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, bubbles: true }));
            try {
                const orcDet = await fetchComToken(`orcamentos?nrOrcamento=${nrOrcamento}`);
                const modulo = await import("./Orcamentos.js");
                if (modulo.preencherFormularioComOrcamento) modulo.preencherFormularioComOrcamento(orcDet);
            } catch (err) {
                console.error("Erro ao abrir orçamento (CEO):", err);
            }
        } else if (tentativas >= 20) {
            clearInterval(intervalo);
        }
    }, 100);
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

    const main = document.getElementById("conteudo");
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
    ["chart-rentabilidade", "chart-staff", "chart-margem", "chart-rosca"].forEach((id) => {
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

// ===== Toggle do CeoMode =====
// Acesso restrito a quem tem a flag especial "supremo" (ver docs/PERMISSOES.md).
// O backend (rotas /ceo/*) é quem realmente bloqueia; isto aqui é só UX.
// "CEO MODE" no menu é só o gatilho do dropdown (mesmo padrão hover de Devs/Cadastro);
// quem abre/fecha o painel é o item do submenu ("Rentabilidade por Evento") — deixa a
// estrutura pronta pra outras telas entrarem no mesmo dropdown no futuro.
function initCeoMode() {
    const li = document.querySelector("li.Ceo");
    const linkPrincipal = li?.querySelector(":scope > a");
    const item = document.getElementById("ceo-item-rentabilidade");
    if (!li || !linkPrincipal || !item) return;

    const temAcesso = window.temPermissao?.("Staff", "supremo") ?? false;
    if (!temAcesso) {
        li.style.display = "none";
        return;
    }
    li.style.display = "";

    const icone = linkPrincipal.querySelector(".material-symbols-outlined");

    item.addEventListener("click", (e) => {
        e.preventDefault();
        const ativo = document.body.classList.toggle("ceo-mode");
        if (icone) icone.textContent = ativo ? "logout" : "finance";
        linkPrincipal.title = ativo ? "Sair do CEO Mode" : "CEO Mode";
        if (ativo) montarPainel();
    });
}

// Espera window.permissoes estar disponível antes de checar temPermissao (evita
// esconder o CEO Mode por engano por causa do carregamento assíncrono em Index.js).
document.addEventListener("DOMContentLoaded", () => {
    if (Array.isArray(window.permissoes)) initCeoMode();
    else document.addEventListener("permissoesCarregadas", initCeoMode, { once: true });
});
