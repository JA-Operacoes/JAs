import { fetchComToken, aplicarTema, fetchHtmlComToken  } from '/utils/utils.js';
// Sessão do usuário (empresa ativa, identidade, permissões especiais do Staff) —
// vive em Sessao.js para poder ser usada também pelo Pedidos.js sem importar
// este arquivo, que executa muita coisa já no carregamento.
import {
    getIdEmpresa,
    getUsuarioLogado,
    getIdExecutor,
    usuarioTemPermissao,
    usuarioTemPermissaoFinanceiro,
    usuarioTemPermissaoSupremo
} from './Sessao.js';

async function carregarVersaoSistema() {
    try {
        // Usando o seu fetchComToken que já está no arquivo
        const data = await fetchComToken("/main/versao");
        if (data && data.versao) {
            document.getElementById('app-version').innerText = `v${data.versao}`;
        }
    } catch (err) {
        console.error("Erro ao carregar versão:", err);
    }
}

// Chame a função no início do carregamento ou no DOMContentLoaded
carregarVersaoSistema();

// As constantes de status dos pedidos (CAMPO_ADITIVO_EXTRA, STATUS_PENDENTE…)
// mudaram para js/Pedidos.js junto com o painel que as usa.

const getRecordIdFromUrl = (url) => {
  const parts = url.split('/');
  const lastPart = parts[parts.length - 1];
  // Retorna o último segmento se for um número, caso contrário retorna null
  return !isNaN(parseInt(lastPart)) ? lastPart : null;
};



async function abrirModalLocal(url, modulo) {
    if (!modulo) modulo = window.moduloAtual || "Staff";
    console.log("[abrirModalLocal] iniciar:", { modulo, url });

    let html;
    try {
        html = await fetchHtmlComToken(url);
    } catch (err) {
        console.error("[abrirModalLocal] Erro ao carregar modal:", err);
        return;
    }

    const container = document.getElementById("modal-container");
    if (!container) return;

    // Injeta HTML e gerencia scripts
    container.innerHTML = html;
    const scriptId = 'scriptModuloDinamico';
    const scriptAntigo = document.getElementById(scriptId);
    if (scriptAntigo) scriptAntigo.remove();

    const scriptName = modulo.charAt(0).toUpperCase() + modulo.slice(1) + ".js";
    const scriptSrc = `js/${scriptName}`;

    await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.id = scriptId;
        script.src = scriptSrc;
        script.defer = true;
        script.type = "module";
        script.onload = () => setTimeout(resolve, 50);
        script.onerror = reject;
        document.body.appendChild(script);
    });

    // =========================================================================
    // 🎯 LOGICA DE PREENCHIMENTO E DESTRAVE (Edição)
    // =========================================================================
    const recordId = getRecordIdFromUrl(url);

    if (recordId) {
        try {
            const dataUrl = `/${modulo.toLowerCase()}/data/${recordId}`;
            const staffData = await fetchComToken(dataUrl);

            if (staffData) {
                window.__modalFetchedData = staffData;

                // 🔥 PASSO 1: Injeção Imediata de IDs (Evita Erro 400 e destrava Setor)
                setTimeout(() => {
                    console.log("[abrirModalLocal] Injetando dados mestre...");
                    
                    const camposMestre = {
                        'nmevento': staffData.idevento,
                        'nmcliente': staffData.idcliente,
                        'nmlocalmontagem': staffData.idmontagem,
                        'descFuncao': staffData.idfuncao,
                    };

                    // Preenche selects normais
                    for (const [id, valor] of Object.entries(camposMestre)) {
                        const el = document.getElementById(id);
                        if (el && valor) {
                            el.value = valor;
                            el.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    }

                    // --- LÓGICA ESPECÍFICA PARA O SETOR (PAVILHÃO) ---
                    const elSetor = document.getElementById('setor') || document.querySelector('select[name="pavilhao"]');
                    if (elSetor && staffData.setor) {
                        console.log("[abrirModalLocal] Tratando setor múltiplo:", staffData.setor);
                        
                        // Converte o que vem do banco em array (ex: "AMARELO, AZUL" -> ["AMARELO", "AZUL"])
                        const setoresSalvos = String(staffData.setor).split(',').map(s => s.trim().toUpperCase());

                        Array.from(elSetor.options).forEach(opt => {
                            const match = setoresSalvos.some(s => opt.text.toUpperCase().includes(s) || opt.value === s);
                            if (match) {
                                opt.selected = true;
                            }
                        });
                        elSetor.dispatchEvent(new Event('change', { bubbles: true }));
                    }

                    if (typeof window.debouncedOnCriteriosChanged === 'function') {
                        window.debouncedOnCriteriosChanged();
                    }
                }, 300);
                // 🌟 PASSO 2: Sincronização do Flatpickr
                setTimeout(() => {
                    const datasDoStaff = staffData.datasevento;
                    if (window.datasEventoPicker && datasDoStaff && Array.isArray(datasDoStaff)) {
                        window.datasEventoPicker.setDate(datasDoStaff, true);

                        if (typeof window.atualizarContadorEDatas === 'function') {
                            window.atualizarContadorEDatas(window.datasEventoPicker.selectedDates);
                        }

                        // Garante que o texto das datas apareça no formato correto no input
                        if (window.datasEventoPicker.altInput) {
                            window.datasEventoPicker.altInput.value = window.datasEventoPicker.formatDate(
                                window.datasEventoPicker.selectedDates,
                                window.datasEventoPicker.config.altFormat
                            );
                        }
                        console.log("[abrirModalLocal] Flatpickr e contador sincronizados.");
                    }
                }, 600);
            }
        } catch (error) {
            console.error(`[abrirModalLocal] Erro ao processar prefill:`, error);
        }
    }

    // =========================================================================
    // 🚪 EXIBIÇÃO E FECHAMENTO
    // =========================================================================
    const modal = document.querySelector("#modal-container .modal");
    const overlay = document.getElementById("modal-overlay");

    if (modal && overlay) {
        modal.style.display = "block";
        overlay.style.display = "block";
        document.body.classList.add("modal-open");

        const encerrarModal = () => {
    if (typeof fecharModal === "function") {
        fecharModal();
    } else {
        overlay.style.display = "none";
        container.innerHTML = "";
        document.body.classList.remove("modal-open");
    }

    // ✅ Sempre chamado, independente do caminho acima
    if (typeof window.onStaffModalClosed === 'function') {
        window.onStaffModalClosed(false);
    }
};

        overlay.onclick = (e) => { if (e.target === overlay) encerrarModal(); };
        modal.querySelector(".close")?.addEventListener("click", encerrarModal);
    }

    // Inicialização final do módulo
    try {
        if (window.moduloHandlers?.[modulo]?.configurar) {
            window.moduloHandlers[modulo].configurar();
        } else if (typeof window.configurarEventosStaff === "function" && modulo.toLowerCase() === "staff") {
            window.configurarEventosStaff();
        }

        // Prefill genérico de fallback
        setTimeout(() => {
            if (typeof window.applyModalPrefill === "function") {
                window.applyModalPrefill(window.__modalInitialParams || "");
            }
        }, 800);
    } catch (err) {
        console.warn("[abrirModalLocal] Erro na configuração final do módulo:", err);
    }
}

window.applyModalPrefill = function(rawParams) {
    try {
        console.log("[applyModalPrefill] Iniciando processo excludente...");
        
        const raw = rawParams || window.__modalInitialParams || (window.location.search ? window.location.search.replace(/^\?/, '') : "");
        if (!raw) return false;
        
        const params = new URLSearchParams(raw);
        const prefill = {
            idevento: params.get("idevento"),
            idfuncao: params.get("idfuncao"),
            idequipe: params.get("idequipe"),
            idcliente: params.get("idcliente"),
            idmontagem: params.get("idmontagem"),
            nmequipe: params.get("nmequipe") || params.get("idequipe_nome"),
            nmfuncao: params.get("nmfuncao"),
            nmevento: params.get("nmevento"),
            nmcliente: params.get("nmcliente"),
            nmlocalmontagem: params.get("nmlocalmontagem") || params.get("idmontagem_nome"),
            cache_fechado: params.get("cache_fechado")?.toLowerCase() === "true",
            dtini_vaga: params.get("dtini_vaga"),
            dtfim_vaga: params.get("dtfim_vaga")
        };

        window.__modalDesiredPrefill = prefill;

        // --- Helpers ---
        function setHidden(id, value) {
            const el = document.getElementById(id);
            if (el && value) el.value = value;
        }

        function trySelectIfExists(selectId, value, text) {
            const sel = typeof selectId === 'string' ? document.getElementById(selectId) : selectId;
            if (!sel || !sel.options) return false;
            if (value && String(value).trim() !== "") {
                sel.value = value;
                if (sel.value === String(value)) {
                    sel.dispatchEvent(new Event('change', { bubbles: true }));
                    return true;
                }
            }
            if (text) {
                const normalized = text.trim().toUpperCase();
                for (let i = 0; i < sel.options.length; i++) {
                    const optText = sel.options[i].text.trim().toUpperCase();
                    if (optText === normalized || optText.includes(normalized)) {
                        sel.selectedIndex = i;
                        sel.dispatchEvent(new Event('change', { bubbles: true }));
                        return true;
                    }
                }
            }
            return false;
        }

        // Injeção Básica
        setHidden("idEvento", prefill.idevento);
        setHidden("idEquipe", prefill.idequipe);
        setHidden("idFuncao", prefill.idfuncao);
        setHidden("idCliente", prefill.idcliente);
        setHidden("idMontagem", prefill.idmontagem);

        const selectsToTry = [
            { id: "nmEvento", val: prefill.idevento, txt: prefill.nmevento },
            { id: "nmCliente", val: prefill.idcliente, txt: prefill.nmcliente },
            { id: "nmLocalMontagem", val: prefill.idmontagem, txt: prefill.nmlocalmontagem },
            { id: "nmEquipe", val: prefill.idequipe, txt: prefill.nmequipe },
            { id: "descFuncao", val: prefill.idfuncao, txt: prefill.nmfuncao }
        ];

        selectsToTry.forEach(s => {
            if (!trySelectIfExists(s.id, s.val, s.txt)) {
                setTimeout(() => trySelectIfExists(s.id, s.val, s.txt), 500);
            }
        });

// =========================================================================
        // 🚀 LÓGICA DE SETOR HÍBRIDA (ANTI-TRAVAMENTO DE TABELA)
        // =========================================================================
        const nmFuncaoRaw = prefill.nmfuncao || ""; 
        let setorAlvo = null;

        if (nmFuncaoRaw.includes('(')) {
            const match = nmFuncaoRaw.match(/\(([^)]+)\)/);
            if (match) setorAlvo = match[1].trim().toUpperCase();
        }

        if (setorAlvo) {
            let tentativas = 0;
            const monitorSetor = setInterval(() => {
                tentativas++;
                const modalContainer = document.getElementById("modal-container") || document.body;
                
                const selPav = Array.from(modalContainer.querySelectorAll('select')).find(s => 
                    s.id.toLowerCase().includes('setor') || s.name.toLowerCase().includes('pavilhao') || s.multiple
                );
                const inputSetor = document.getElementById('setor') || document.querySelector('input[name="setor"]');

                if (selPav && selPav.options && selPav.options.length > 0) {
                    clearInterval(monitorSetor);
                    
                    const options = Array.from(selPav.options);
                    const alvoOficial = options.find(opt => opt.text.trim().toUpperCase().includes(setorAlvo));

                    // Estilo de bloqueio visual sem desativar o elemento para o Staff.js
                    const estiloTrava = {
                        backgroundColor: "#f8f9fa",
                        cursor: "not-allowed",
                        pointerEvents: "none",
                        fontWeight: "bold"
                    };

                    if (alvoOficial) {
                        // --- CASO A: PAVILHÃO OFICIAL ---
                        const val = alvoOficial.value;
                        const txt = alvoOficial.text.trim();

                        selPav.innerHTML = ""; 
                        selPav.appendChild(new Option(txt, val, true, true));
                        Object.assign(selPav.style, estiloTrava);

                        if (inputSetor) {
                            inputSetor.value = setorAlvo;
                            inputSetor.readOnly = true;
                            inputSetor.style.display = "block";
                            Object.assign(inputSetor.style, estiloTrava);
                        }
                    } else {
                        // --- CASO B: SETOR INFORMATIVO (GERAL) ---
                        selPav.innerHTML = "";
                        // Importante: O valor e o texto devem ser idênticos ao que o Staff.js busca
                        const optLimpa = new Option(setorAlvo, setorAlvo, true, true);
                        selPav.appendChild(optLimpa);
                        Object.assign(selPav.style, estiloTrava);

                        if (inputSetor) {
                            inputSetor.value = setorAlvo;
                            inputSetor.readOnly = true;
                            inputSetor.style.display = "block";
                            Object.assign(inputSetor.style, estiloTrava);
                        }
                    }
                    
                    // 🔥 O PULO DO GATO: Timeout para garantir que o DOM atualizou antes do Staff.js ler
                    setTimeout(() => {
                        selPav.dispatchEvent(new Event('change', { bubbles: true }));
                        console.log("[DEBUG-SETOR] Evento Change disparado para sincronizar tabela.");
                    }, 100);
                }

                if (tentativas >= 25) clearInterval(monitorSetor);
            }, 250);
        }
        if(prefill.cache_fechado){
            setTimeout(() => {
                if(window.datasEventoPicker){
                    window.datasEventoPicker.clear();
                    console.log("[applyModalPrefill] cache_fechado=true: datas limpas.");
                    window.datasEventoPicker.set("enable",[{
                        from: prefill.dtini_vaga,
                        to: prefill.dtfim_vaga
                        }
                    ])
                }
            }, 300);
                
        }



        document.dispatchEvent(new CustomEvent("prefill:registered", { detail: { prefill } }));
        try { delete window.__modalInitialParams; } catch(e) { window.__modalInitialParams = null; }
        return true;

    } catch (err) {
        console.error("[applyModalPrefill] Erro Crítico:", err);
        return false;
    }
};



// Função para obter o idempresa do localStorage
// getIdEmpresa() agora vem de js/Sessao.js (ver import no topo).

// Função para buscar resumo dos cards


// getUsuarioLogado() agora vem de js/Sessao.js (ver import no topo).


// usuarioTemPermissao() agora vem de js/Sessao.js (ver import no topo).

// usuarioTemPermissaoFinanceiro() agora vem de js/Sessao.js (ver import no topo).

// usuarioTemPermissaoSupremo() agora vem de js/Sessao.js (ver import no topo).

// Evento no card financeiro
const cardFinanceiro = document.querySelector(".card-financeiro");
if (cardFinanceiro) {
  cardFinanceiro.addEventListener("click", async () => {
  await mostrarPedidosUsuario();
  await carregarSaldosInativacaoPendentes();
  await carregarNotificacoesAjusteFinanceiro();
  });
}

// ─────────────────────────────────────────────────────────────
// Saldos de Inativação Pendentes — seção própria, fora do painel
// genérico de Pedidos e Solicitações (aquele é todo baseado em
// colunas do staffeventos; saldoinativacao não tem coluna correspondente).
// Autorizar gera o Débito automático em Ajuste Financeiro; Rejeitar só encerra.
// ─────────────────────────────────────────────────────────────
function getOrCriarSecaoSaldosInativacao() {
    let secao = document.getElementById('secaoSaldosInativacao');
    if (!secao) {
        const painel = document.getElementById('painelDetalhes');
        if (!painel || !painel.parentNode) return null;
        secao = document.createElement('div');
        secao.className = 'detalhes-panel secao-notificacao-lista';
        secao.id = 'secaoSaldosInativacao';
        secao.style.marginTop = '16px';
        painel.parentNode.insertBefore(secao, painel.nextSibling);
    }
    return secao;
}

function escaparHtmlSaldoInativacao(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
}

// Cache dos itens carregados (por idsolicitacao) e o conjunto de datas marcadas como
// "trabalhou" por item — usado pra recalcular o resumo ao vivo sem precisar rebuscar o servidor.
const itensCacheSaldoInativacao = {};
const diasTrabalhadosSaldoInativacao = {};

function formatarDataSaldoInativacao(iso) {
    return new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

// Recalcula devido x já pago com base nos dias atualmente marcados como "trabalhou".
// Mesma fórmula usada no backend (rotaMain.js) — cachê e ajuda são rateados por dia,
// caixinha é valor único do evento (só devida se houve ao menos 1 dia trabalhado).
function calcularResumoSaldoInativacao(item, diasTrabalhadosSet) {
    const totalDias = (item.datasevento || []).length;
    const qtdTrabalhados = diasTrabalhadosSet.size;

    const vlrTotCache = parseFloat(item.vlrtotcache) || 0;
    const vlrTotAjdCusto = parseFloat(item.vlrtotajdcusto) || 0;
    const vlrCaixinha = parseFloat(item.vlrcaixinha) || 0;

    const cachePorDia = totalDias > 0 ? vlrTotCache / totalDias : 0;
    const ajudaPorDia = totalDias > 0 ? vlrTotAjdCusto / totalDias : 0;
    const caixinhaDevida = qtdTrabalhados > 0 ? vlrCaixinha : 0;

    const valorDevido = qtdTrabalhados * (cachePorDia + ajudaPorDia) + caixinhaDevida;

    const calcPagoBase = (status, amount) => {
        if (!status || !String(status).toLowerCase().startsWith('pago')) return 0;
        const match = String(status).match(/(\d+)/);
        return match ? amount * (Number(match[1]) / 100) : amount;
    };
    // Caixinha: pagamento agora é por item (statuspgtocaixinha do registro inteiro
    // descontinuado) — backend já manda o valor pago somado via caixinha_valor_pago().
    const valorJaPago = calcPagoBase(item.statuspgto, vlrTotCache)
        + calcPagoBase(item.statuspgtoajdcto, vlrTotAjdCusto)
        + (parseFloat(item.vlrcaixinhapago) || 0);

    return { totalDias, qtdTrabalhados, valorDevido, valorJaPago, saldo: valorJaPago - valorDevido };
}

function renderResumoSaldoInativacao(idsolicitacao) {
    const resumoEl = document.getElementById(`resumo-saldo-${idsolicitacao}`);
    if (!resumoEl) return;

    const item = itensCacheSaldoInativacao[idsolicitacao];
    const diasSet = diasTrabalhadosSaldoInativacao[idsolicitacao];
    const { qtdTrabalhados, totalDias, valorDevido, valorJaPago, saldo } = calcularResumoSaldoInativacao(item, diasSet);

    let linhaSaldo;
    if (Math.abs(saldo) <= 0.01) {
        linhaSaldo = '<span>Sem crédito ou débito a gerar</span>';
    } else if (saldo > 0) {
        linhaSaldo = `<span class="valor-debito">Débito de R$ ${saldo.toFixed(2).replace('.', ',')} (empresa pagou a mais)</span>`;
    } else {
        linhaSaldo = `<span class="valor-credito">Crédito de R$ ${Math.abs(saldo).toFixed(2).replace('.', ',')} (empresa ainda deve)</span>`;
    }

    resumoEl.innerHTML = `
        <div>Dias trabalhados: <strong>${qtdTrabalhados}/${totalDias}</strong></div>
        <div>Devido pelos dias trabalhados: R$ ${valorDevido.toFixed(2).replace('.', ',')} | Já pago: R$ ${valorJaPago.toFixed(2).replace('.', ',')}</div>
        <div>${linhaSaldo}</div>
    `;
}

async function carregarSaldosInativacaoPendentes() {
    const secao = getOrCriarSecaoSaldosInativacao();
    if (!secao) return;

    const ehMaster = usuarioTemPermissao();
    const ehSupremo = usuarioTemPermissaoSupremo();
    if (!(ehMaster || ehSupremo)) { secao.innerHTML = ''; secao.style.display = 'none'; return; }

    try {
        const dados = await fetchComToken('/main/saldos-inativacao-pendentes');
        const itens = Array.isArray(dados?.itens) ? dados.itens : [];
        // Sem itens: esconde a seção por completo — só o innerHTML='' deixava um card vazio
        // (com padding/fundo do .detalhes-panel) visível, sem nenhum conteúdo dentro.
        if (itens.length === 0) { secao.innerHTML = ''; secao.style.display = 'none'; return; }
        secao.style.display = '';

        let html = '<div class="titulo-pedidos">Saldos de Inativação Pendentes</div>';
        itens.forEach(item => {
            itensCacheSaldoInativacao[item.idsolicitacao] = item;
            // Default: todos os dias marcados como "trabalhou" — o financeiro desmarca os que não foram.
            const datasEvento = Array.isArray(item.datasevento) ? item.datasevento : [];
            if (!diasTrabalhadosSaldoInativacao[item.idsolicitacao]) {
                diasTrabalhadosSaldoInativacao[item.idsolicitacao] = new Set(datasEvento);
            }

            const justificativaEscapada = escaparHtmlSaldoInativacao(item.justificativa || '').replace(/\n/g, '<br>');
            const diasSet = diasTrabalhadosSaldoInativacao[item.idsolicitacao];

            const botoesDias = datasEvento.map(data => {
                const trabalhou = diasSet.has(data);
                return `<button type="button" class="dia-toggle-btn ${trabalhou ? 'trabalhou' : 'nao-trabalhou'}" `
                    + `data-idsolicitacao="${item.idsolicitacao}" data-data="${data}">`
                    + `${formatarDataSaldoInativacao(data)} ${trabalhou ? '✓' : '✕'}</button>`;
            }).join('');

            html += `
                <div class="pedido-card card-saldo-inativacao">
                    <div class="infoPedido" style="width:100%;">
                        <div class="event-info">
                            <strong>Evento:</strong> ${escaparHtmlSaldoInativacao(item.nmevento || '—')} - <strong>Funcionário:</strong> ${escaparHtmlSaldoInativacao(item.nomefuncionario || '—')}
                        </div><br>
                        <span class="text-xs text-gray-600" style="display:block;margin:2px 0 6px;line-height:1.5;"><strong>Detalhes:</strong> ${justificativaEscapada}</span>
                        <div><strong>Todos os dias já vêm marcados como trabalhados — clique para desmarcar os que o funcionário NÃO trabalhou:</strong></div>
                        <div class="dias-lista-toggle">${botoesDias || '<span style="color:var(--text-3);">Sem datas registradas neste evento.</span>'}</div>
                        <div class="resumo-saldo-inativacao" id="resumo-saldo-${item.idsolicitacao}"></div>
                        <div class="AcoesPedido" data-id="${item.idsolicitacao}">
                            <button class="aprovar-saldo-inativacao aprovar">Autorizar</button>
                            <button class="negar-saldo-inativacao negar">Rejeitar</button>
                        </div>
                    </div>
                </div>
            `;
        });
        secao.innerHTML = html;
        itens.forEach(item => renderResumoSaldoInativacao(item.idsolicitacao));
    } catch (err) {
        console.error('Erro ao carregar saldos de inativação pendentes:', err);
    }
}

// ─────────────────────────────────────────────────────────────
// Ajustes Financeiros gerados automaticamente (ex: ajuda de custo já paga que excedeu o
// cachê ao remover data — ver REGRA DE OURO em Staff.js) e ainda não vistos pelo financeiro.
// Seção própria, mesmo padrão de Saldos de Inativação — "Marcar como Lido" só dispensa o
// aviso aqui; o lançamento em si continua Pendente até ser processado em Vencimentos.
// ─────────────────────────────────────────────────────────────
function getOrCriarSecaoAjustesFinanceirosAutomaticos() {
    let secao = document.getElementById('secaoAjustesFinanceirosAutomaticos');
    if (!secao) {
        const painel = document.getElementById('painelDetalhes');
        if (!painel || !painel.parentNode) return null;
        secao = document.createElement('div');
        secao.className = 'detalhes-panel secao-notificacao-lista';
        secao.id = 'secaoAjustesFinanceirosAutomaticos';
        secao.style.marginTop = '16px';
        painel.parentNode.insertBefore(secao, painel.nextSibling);
    }
    return secao;
}

async function carregarNotificacoesAjusteFinanceiro() {
    const secao = getOrCriarSecaoAjustesFinanceirosAutomaticos();
    if (!secao) return;

    const ehMaster = usuarioTemPermissao();
    const ehSupremo = usuarioTemPermissaoSupremo();
    const ehFinanceiro = usuarioTemPermissaoFinanceiro();
    if (!(ehMaster || ehSupremo || ehFinanceiro)) { secao.innerHTML = ''; secao.style.display = 'none'; return; }

    try {
        const itens = await fetchComToken('/ajustefinanceiro/notificacoes/pendentes');
        // Sem itens: esconde a seção por completo — só o innerHTML='' deixava um card vazio
        // (com padding/fundo do .detalhes-panel) visível, sem nenhum conteúdo dentro.
        if (!Array.isArray(itens) || itens.length === 0) { secao.innerHTML = ''; secao.style.display = 'none'; return; }
        secao.style.display = '';

        let html = '<div class="titulo-pedidos">Ajustes Financeiros Automáticos</div>';
        itens.forEach(item => {
            const cor = item.tipo === 'Credito' ? '#16a34a' : '#dc2626';
            const label = item.tipo === 'Credito' ? 'Crédito' : 'Débito';
            const valorFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor || 0);
            const justificativaEscapada = escaparHtmlSaldoInativacao(item.justificativa || '').replace(/\n/g, '<br>');

            html += `
                <div class="pedido-card card-ajuste-financeiro-auto" style="border-left:4px solid ${cor};">
                    <div class="infoPedido" style="width:100%;">
                        <div class="title">
                            <span style="display:inline-block; width:12px; height:12px; background-color:${cor}; margin-right:6px; border-radius:2px;"></span>
                            <strong>Ajuste Automático — ${label}</strong> de <strong>${valorFmt}</strong>
                        </div><br>
                        <div class="event-info">
                            <strong>Evento:</strong> ${escaparHtmlSaldoInativacao(item.nmevento || '—')} - <strong>Funcionário:</strong> ${escaparHtmlSaldoInativacao(item.nomefuncionario || '—')} <span class="text-xs text-gray-500 font-normal">(${escaparHtmlSaldoInativacao(item.nmfuncao || '')})</span>
                        </div><br>
                        <span class="text-xs text-gray-600" style="display:block;margin-bottom:6px;line-height:1.5;"><strong>Justificativa:</strong> ${justificativaEscapada}</span>
                        <div class="AcoesPedido" data-id="${item.idajustefinanceiro}">
                            <button class="marcar-lido-ajuste-financeiro aprovar">✓ Marcar como Lido</button>
                        </div>
                    </div>
                </div>
            `;
        });
        secao.innerHTML = html;
    } catch (err) {
        console.error('Erro ao carregar notificações de ajuste financeiro:', err);
    }
}

document.addEventListener('click', async function(event) {
    const targetLido = event.target;
    if (!targetLido.classList.contains('marcar-lido-ajuste-financeiro')) return;

    const idAjusteFinanceiro = targetLido.closest('[data-id]')?.getAttribute('data-id');
    if (!idAjusteFinanceiro) return;

    targetLido.disabled = true;
    try {
        const resp = await fetchComToken(`/ajustefinanceiro/${idAjusteFinanceiro}/marcar-lido`, { method: 'PATCH' });
        if (!resp || resp.sucesso === false) {
            Swal.fire('Erro', resp?.erro || 'Não foi possível marcar como lido.', 'error');
            targetLido.disabled = false;
            return;
        }
        const secao = targetLido.closest('#secaoAjustesFinanceirosAutomaticos');
        const card = targetLido.closest('.card-ajuste-financeiro-auto');
        if (card) card.remove();
        // Se esse era o último card, esconde a seção (senão fica só o título vermelho vazio).
        if (secao && !secao.querySelector('.card-ajuste-financeiro-auto')) {
            secao.innerHTML = '';
            secao.style.display = 'none';
        }
    } catch (err) {
        console.error('Erro ao marcar ajuste financeiro como lido:', err);
        Swal.fire('Erro', 'Falha ao comunicar com o servidor.', 'error');
        targetLido.disabled = false;
    }
});

document.addEventListener('click', async function(event) {
    const target = event.target;

    // Toggle de dia trabalhado/não trabalhado
    if (target.classList.contains('dia-toggle-btn')) {
        const idsolicitacao = target.getAttribute('data-idsolicitacao');
        const data = target.getAttribute('data-data');
        const diasSet = diasTrabalhadosSaldoInativacao[idsolicitacao];
        if (!diasSet) return;

        if (diasSet.has(data)) {
            diasSet.delete(data);
            target.classList.remove('trabalhou');
            target.classList.add('nao-trabalhou');
            target.textContent = `${formatarDataSaldoInativacao(data)} ✕`;
        } else {
            diasSet.add(data);
            target.classList.remove('nao-trabalhou');
            target.classList.add('trabalhou');
            target.textContent = `${formatarDataSaldoInativacao(data)} ✓`;
        }
        renderResumoSaldoInativacao(idsolicitacao);
        return;
    }

    if (!target.classList.contains('aprovar-saldo-inativacao') && !target.classList.contains('negar-saldo-inativacao')) return;

    const isAprovar = target.classList.contains('aprovar-saldo-inativacao');
    const idSolicitacao = target.closest('[data-id]')?.getAttribute('data-id');
    if (!idSolicitacao) return;

    const htmlConfirmacao = isAprovar
        ? 'Ao <strong>autorizar</strong>, o sistema calcula o crédito ou débito com base nos dias marcados como trabalhados e lança automaticamente em Ajuste Financeiro — ficará <strong>Pendente</strong> de pagamento, visível em Vencimentos. Se não houver diferença, nenhum lançamento é criado.'
        : '<strong>Atenção:</strong> ao <strong>rejeitar</strong>, a solicitação será encerrada e nenhum lançamento financeiro será criado.';

    const result = await Swal.fire({
        title: isAprovar ? 'Autorizar Saldo de Inativação?' : 'Rejeitar Saldo de Inativação?',
        html: htmlConfirmacao,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: isAprovar ? '#16a34a' : '#dc2626',
        confirmButtonText: 'Confirmar'
    });
    if (!result.isConfirmed) return;

    try {
        const diasTrabalhados = isAprovar
            ? Array.from(diasTrabalhadosSaldoInativacao[idSolicitacao] || [])
            : undefined;

        const resp = await fetchComToken('/main/notificacoes-financeiras/atualizar-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                idpedido: idSolicitacao,
                categoria: 'saldoinativacao',
                acao: isAprovar ? 'Autorizado' : 'Rejeitado',
                diasTrabalhados
            })
        });
        if (!resp?.sucesso) {
            Swal.fire('Erro', resp?.error || 'Falha na atualização', 'error');
            return;
        }

        let mensagemSucesso = 'Rejeitado!';
        if (isAprovar) {
            mensagemSucesso = resp.gerouAjuste
                ? `${resp.tipoAjuste === 'Debito' ? 'Débito' : 'Crédito'} de R$ ${Number(resp.valorAjuste).toFixed(2).replace('.', ',')} gerado!`
                : 'Autorizado — sem diferença a lançar.';
        }
        Swal.fire({ icon: 'success', title: mensagemSucesso, timer: 1500, showConfirmButton: false });

        delete diasTrabalhadosSaldoInativacao[idSolicitacao];
        delete itensCacheSaldoInativacao[idSolicitacao];
        carregarSaldosInativacaoPendentes();
    } catch (err) {
        Swal.fire('Erro', 'Falha ao comunicar com o servidor', 'error');
    }
});

// =========================
//   Atividades
// =========================


// getIdExecutor() agora vem de js/Sessao.js (ver import no topo).

// Função para buscar todos os logs do usuário
async function buscarLogsUsuario() {
  const idexecutor = getIdExecutor();
  if (!idexecutor) throw new Error("idexecutor não definido");

  const resposta = await fetchComToken(`/Main/atividades-recentes?idexecutor=${idexecutor}`, {
  headers: { 'Content-Type': 'application/json' }
  });

  return resposta;
}

// Função para atualizar o painel de logs
async function atualizarAtividades() {
  try {
    const atividades = await buscarLogsUsuario();
    const conteudo = document.getElementById("painelDetalhes");

    if (!conteudo) return;
    conteudo.innerHTML = "";

    if (!atividades || atividades.length === 0) {
      conteudo.innerHTML = "<p>Nenhuma atividade encontrada.</p>";
      return;
    }

    // Função auxiliar para renderizar dados
    function renderizarDados(dados) {
      if (!dados) return "<em>Vazio</em>";

      // Se for array de objetos
      if (Array.isArray(dados)) {
        if (dados.length === 0) return "<em>Array vazio</em>";

        // Se os elementos forem objetos -> mostrar em mini tabela
        if (typeof dados[0] === "object") {
          let html = "<table class='mini-tabela'>";
          html += "<thead><tr>";
          Object.keys(dados[0]).forEach(key => {
          html += `<th>${key}</th>`;
          });
          html += "</tr></thead><tbody>";

          dados.forEach(obj => {
      html += "<tr>";
      Object.values(obj).forEach(val => {
      html += `<td>${val !== null && val !== undefined ? val : ""}</td>`;
      });
      html += "</tr>";
          });

          html += "</tbody></table>";
          return html;
        }

        // Se for array simples (ex: [1,2,3])
        return `<pre>${JSON.stringify(dados, null, 2)}</pre>`;
      }

      // Se for objeto simples
      if (typeof dados === "object") {
        return `<pre>${JSON.stringify(dados, null, 2)}</pre>`;
      }

      // Se for string ou outro tipo primitivo
      return `<pre>${dados}</pre>`;
    }

    // Monta tabela principal
    const tabela = document.createElement("table");
    tabela.classList.add("tabela-atividades");

    tabela.innerHTML = `
      <thead>
      <tr>
      <th>Módulo</th>
      <th>Ação</th>
      <th>Data</th>
      <th>Antes</th>
      <th>Depois</th>
      </tr>
      </thead>
      <tbody></tbody>
    `;

    const tbody = tabela.querySelector("tbody");

    atividades.forEach(ativ => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
      <td>${ativ.modulo}</td>
      <td>${ativ.acao}</td>
      <td>${new Date(ativ.criado_em).toLocaleString()}</td>
      <td>${renderizarDados(ativ.dadosanteriores)}</td>
      <td>${renderizarDados(ativ.dadosnovos)}</td>
      `;
      tbody.appendChild(tr);
    });

    conteudo.appendChild(tabela);

    } catch (err) {
      console.error("Erro ao atualizar atividades:", err);
      const conteudo = document.getElementById("conteudoDetalhes");
      if (conteudo) {
        conteudo.innerHTML = "<p>Erro ao carregar atividades.</p>";
      }
    }
}

document.addEventListener("DOMContentLoaded", function () {
  const card = document.getElementById("card-atividades");
  if (card) {
  card.addEventListener("click", atualizarAtividades);
  }
});

// =========================
//  Eventos 
// =========================

async function atualizarProximoEvento() {
  const resposta = await fetchComToken("/main/proximo-evento", {
    headers: { idempresa: getIdEmpresa() }
  });

  const nomeSpan = document.getElementById("proximoEventoNome");
  const tempoSmall = document.getElementById("proximoEventoTempo");

  if (!resposta.eventos || resposta.eventos.length === 0) {
    nomeSpan.textContent = "Sem próximos eventos agendados.";
    tempoSmall.textContent = "--";
    return;
  }

  function parseDateLocal(dateStr) {
    if (typeof dateStr === "string") {
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const [y, m, d] = dateStr.split("-").map(Number);
        return new Date(y, m - 1, d);
      }
      return new Date(dateStr);
    }
    return new Date(dateStr);
  }

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  // 1. Pega todos os eventos que ainda não passaram
let proximos = resposta.eventos
    .map(ev => {
        const dataProcessada = parseDateLocal(ev.data);
        return { ...ev, data: dataProcessada };
    })
    // Filtra apenas datas válidas e que não passaram
    .filter(ev => ev.data instanceof Date && !isNaN(ev.data) && ev.data.getTime() >= hoje.getTime())
    .sort((a, b) => a.data - b.data);

  if (proximos.length === 0) {
    nomeSpan.textContent = "Sem próximos eventos agendados.";
    tempoSmall.textContent = "--";
    return;
  }

  function formatarTempoRestante(dataEvento) {
    const hojeTmp = new Date();
    hojeTmp.setHours(0, 0, 0, 0);
    const diffDias = Math.round((dataEvento - hojeTmp) / (1000 * 60 * 60 * 24));
    if (diffDias > 0) return `(em ${diffDias} dia${diffDias > 1 ? "s" : ""})`;
    else if (diffDias === 0) return "(hoje)";
    else return "(já começou)";
  }

  // 2. Tenta filtrar eventos para a "janela de destaque" (7 dias)
  const limite = new Date();
  limite.setDate(hoje.getDate() + 7);
  const proximos7Dias = proximos.filter(ev => ev.data <= limite);

  // LÓGICA DE EXIBIÇÃO
  if (proximos7Dias.length === 0) {
    // CASO 0: Não tem nada nos próximos 7 dias? Mostra o primeiro evento futuro que encontrar
    const ev = proximos[0];
    nomeSpan.textContent = ev.nmevento;
    tempoSmall.textContent = `${ev.data.toLocaleDateString()} ${formatarTempoRestante(ev.data)}`;
    nomeSpan.style.fontSize = "1.3em";
  } 
  else if (proximos7Dias.length === 1) {
    // CASO 1: Apenas 1 evento na semana (Destaque máximo)
    const ev = proximos7Dias[0];
    nomeSpan.textContent = ev.nmevento;
    tempoSmall.textContent = `${ev.data.toLocaleDateString()} ${formatarTempoRestante(ev.data)}`;
    nomeSpan.style.fontSize = "1.5em";
  } 
  else {
    // CASO 2: Múltiplos eventos na semana (Lista compacta)
    nomeSpan.style.fontSize = "15px";
    const eventosPorData = {};
    proximos7Dias.forEach(ev => {
      const dataStr = ev.data.toLocaleDateString();
      if (!eventosPorData[dataStr]) eventosPorData[dataStr] = [];
      eventosPorData[dataStr].push(ev.nmevento);
    });

    const datas = Object.keys(eventosPorData).sort((a, b) => {
      const [da, ma, ya] = a.split("/").map(Number);
      const [db, mb, yb] = b.split("/").map(Number);
      return new Date(ya, ma - 1, da) - new Date(yb, mb - 1, db);
    });

    if (datas.length === 1) {
      // Na pílula da home cabe um evento só: mostra o primeiro e conta o resto
      // em "+N" (a lista inteira vai pro title e pro painel de Detalhes).
      const lista = eventosPorData[datas[0]];
      nomeSpan.textContent = lista.length > 1 ? `${lista[0]} +${lista.length - 1}` : lista[0];
      nomeSpan.title = lista.join(" · ");
      tempoSmall.textContent = `${datas[0]} ${formatarTempoRestante(proximos7Dias[0].data)}`;
    } else {
      // A pílula da home é de uma linha só: em vez de listar tudo (e acabar
      // cortado no meio de um nome), mostra o evento mais próximo e conta os
      // outros em "+N". A lista completa fica no title e no painel de Detalhes.
      const linhas = datas.flatMap(dataStr => {
        const [d, m, y] = dataStr.split("/").map(Number);
        const dataObj = new Date(y, m - 1, d);
        return eventosPorData[dataStr]
          .map(nome => `${nome} - ${dataStr} ${formatarTempoRestante(dataObj)}`);
      });
      nomeSpan.textContent = linhas[0];
      nomeSpan.title = linhas.join(" · ");
      tempoSmall.textContent = linhas.length > 1 ? `+${linhas.length - 1}` : "";
    }
  }
}

document.addEventListener("DOMContentLoaded", function () {
  const cardEventos = document.querySelector(".card-eventos");

  if (cardEventos) {
  cardEventos.addEventListener("click", function () {
  mostrarCalendarioEventos(); // renderiza só ao clicar
  });
  }
});

async function mostrarCalendarioEventos() {
  const lista = document.getElementById("painelDetalhes");
  lista.innerHTML = "";

  // Container
  const container = document.createElement("div");
  container.className = "calendario-container";

  // ======= CALENDÁRIO =======
  const calendario = document.createElement("div");
  calendario.className = "calendario";

  // ======= HEADER =======
  const header = document.createElement("div");
  header.className = "calendario-header";

  // Bloco de controles (ano/mês/visualização + semana)
  const controles = document.createElement("div");
  controles.className = "calendario-controles";
  controles.innerHTML = `
<div class="ano">Ano: <select id="anoSelect"></select></div>
  
  <div class="mes">Mês: <select id="mesSelect"></select></div>

  <div class="view">
    Visualização:
        <select id="viewSelect">
            <option value="semanal">Semanal</option>
            <option value="mensal" selected>Mensal</option>
            <option value="trimestral">Trimestral</option>
            <option value="semestral">Semestral</option>
            <option value="anual">Anual</option>
        </select>
  </div>

  <div class="semana-View" id="semanaWrapper" style="display:none;">
     Semana:<select id="semanaSelect"></select>
  </div>

  <div class="filtro">
    <button class="btn-filtro-eventos" id="btnFiltroEventos">🔍 Filtrar Eventos</button>
  </div>

  <div class="exportar">
    <button id="btnExportar" class="btn-Exportar">📁 Exportar CSV</button>
  </div>
  `;

  // ======= LEGENDA =======
  const legenda = document.createElement("div");
  legenda.className = "legenda";
  legenda.innerHTML = `
  <h3><strong>Legenda</strong></h3>
  <div class="items">
 <div class="legenda-item"><div class="legenda-cor" style="background:#f8a500ff"></div> Montagem infra</div>
  <div class="legenda-item"><div class="legenda-cor" style="background:#FFC657"></div> Montagem infra</div>
  <div class="legenda-item"><div class="legenda-cor" style="background:#73757A"></div> Marcação</div>
  <div class="legenda-item"><div class="legenda-cor" style="background:#F5E801"></div> Montagem</div>
  <div class="legenda-item"><div class="legenda-cor" style="background:#F46251"></div> Realização</div>
  <div class="legenda-item"><div class="legenda-cor" style="background:#23821F"></div> Desmontagem</div>
  <div class="legenda-item"><div class="legenda-cor" style="background:#704300ff"></div> Desmontagem Infra</div>
  <div class="legenda-item"><div class="legenda-cor" style="background:#5B0F85"></div> Feriado</div>
  </div>
  `;

  header.appendChild(controles);
  header.appendChild(legenda);
  calendario.appendChild(header);

  // Grid (usado para mensal e semanal)
  const grid = document.createElement("div");
  grid.className = "calendario-grid";
  calendario.appendChild(grid);

  container.appendChild(calendario);
  lista.appendChild(container);

  // ======= POPULAR SELECTS =======
  const anoSelect = header.querySelector("#anoSelect");
  const mesSelect = header.querySelector("#mesSelect");
  const viewSelect = header.querySelector("#viewSelect");
  const semanaWrapper = header.querySelector("#semanaWrapper");
  const semanaSelect = header.querySelector("#semanaSelect");

    const filtrosAtivos = new Set();
    let todosEventosDoMes = [];

    const anoAtual = new Date().getFullYear();
    for (let a = anoAtual - 2; a <= anoAtual + 2; a++) {
        const opt = document.createElement("option");
        opt.value = a;
        opt.textContent = a;
        if (a === anoAtual) opt.selected = true;
        anoSelect.appendChild(opt);
      }

  const nomesMeses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  nomesMeses.forEach((nome, idx) => {
  const opt = document.createElement("option");
  opt.value = idx + 1;
  opt.textContent = nome;
  if (idx === new Date().getMonth()) opt.selected = true;
  mesSelect.appendChild(opt);
  });

  // ======= HELPERS =======
  function getCorPeriodo(tipo) {
    const tipoNormalizado = (tipo || "").toLowerCase().trim();
  switch (tipoNormalizado) {
  case "montagem infra": return "#f8a500";
  case "marcação": return "#73757A";
  case "montagem": return "#F5E801";
  case "realização": return "#F46251";
  case "desmontagem": return "#23821F";
  case "desmontagem infra": return "#704300";
  case "feriado": return "#5B0F85";
  default: return "#ccc";
  }
  }

    function criarEventoElemento(ev) {
        const evEl = document.createElement("span");
        evEl.className = "evento";
        evEl.style.background = getCorPeriodo(ev.tipo);
        evEl.textContent = ev.nome;
        if (ev.tipo === "Feriado") evEl.style.color = "#fff";

        const idevento = ev.id || ev.idevento;
        if (idevento) {
      evEl.addEventListener("click", () => abrirPopupEvento(idevento));
        }
        return evEl;
    }

  // ======= CALCULAR SEMANAS DO MÊS =======
  function calcularSemanasDoMes(ano, mes) {
  const semanas = [];
  const ultimoDia = new Date(ano, mes, 0).getDate();
  let inicio = 1;
  while (inicio <= ultimoDia) {
  const d = new Date(ano, mes - 1, inicio);
  const fim = Math.min(inicio + (6 - d.getDay()), ultimoDia);
  semanas.push({ inicio, fim });
  inicio = fim + 1;
  }
  return semanas;
  }

  function preencherSemanas(ano, mes) {
  semanaSelect.innerHTML = "";
  const semanas = calcularSemanasDoMes(ano, mes);
  semanas.forEach((s, idx) => {
  const opt = document.createElement("option");
  opt.value = idx;
  opt.textContent = `${idx+1}ª (${s.inicio}-${s.fim})`;
  semanaSelect.appendChild(opt);
  });
  }

  function aplicarFiltro() {
  grid.querySelectorAll(".evento").forEach(evEl => {
    if (filtrosAtivos.size === 0) {
      evEl.style.opacity = "1";
      evEl.style.filter = "none";
    } else {
      const nomeEl = evEl.textContent.trim();
      const ativo = [...filtrosAtivos].some(f => nomeEl.includes(f));
      evEl.style.opacity = ativo ? "1" : "0.15";
      evEl.style.filter = ativo ? "none" : "grayscale(100%)";
    }
  });

  // Destaca e scrolla as células que têm eventos filtrados
  grid.querySelectorAll("div").forEach(cell => {
    // Remove destaque anterior
    cell.style.outline = "";
    cell.style.outlineOffset = "";

    if (filtrosAtivos.size === 0) return;

    // Verifica se a célula tem algum evento ativo
    const temEventoAtivo = [...cell.querySelectorAll(".evento")].some(evEl => {
      const nomeEl = evEl.textContent.trim();
      return [...filtrosAtivos].some(f => nomeEl.includes(f));
    });

    if (temEventoAtivo) {
      // Destaca a célula
      cell.style.outline = "2px solid var(--primary-color)";
      cell.style.outlineOffset = "-2px";

      // Rola a célula para mostrar o primeiro evento ativo
      const primeiroAtivo = [...cell.querySelectorAll(".evento")].find(evEl => {
        const nomeEl = evEl.textContent.trim();
        return [...filtrosAtivos].some(f => nomeEl.includes(f));
      });

      if (primeiroAtivo) {
        primeiroAtivo.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  });
}

function atualizarBadgeBotao() {
  const btn = header.querySelector("#btnFiltroEventos");
  if (!btn) return;
  btn.innerHTML = filtrosAtivos.size > 0
    ? `🔍 Filtrar <span class="badge-filtro">${filtrosAtivos.size}</span>`
    : `🔍 Filtrar Eventos`;
  btn.classList.toggle("btn-filtro-ativo", filtrosAtivos.size > 0);
}

function abrirFiltroSwal(eventos) {
  const nomesUnicos = [...new Set(
    eventos
      .filter(ev => ev.tipo !== "Feriado")
      .map(ev => ev.nome)
  )].sort();

  if (nomesUnicos.length === 0) {
    Swal.fire({ icon: "info", title: "Sem eventos", text: "Nenhum evento encontrado neste período." });
    return;
  }

  // Monta HTML dos chips
  const chipsHTML = nomesUnicos.map(nome => {
    const tiposPorNome = eventos.filter(ev => ev.nome === nome).map(ev => ev.tipo);
    const tipoMaisComum = tiposPorNome.sort((a, b) =>
      tiposPorNome.filter(t => t === b).length - tiposPorNome.filter(t => t === a).length
    )[0];
    const cor = getCorPeriodo(tipoMaisComum);
    const ativo = filtrosAtivos.has(nome) ? "ativo" : "";

    return `
      <span class="chip ${ativo}" data-nome="${nome}">
        <span class="chip-cor" style="background:${cor}"></span>
        ${nome}
      </span>`;
  }).join("");

  Swal.fire({
    title: "Filtrar Eventos",
    html: `
      <div style="text-align:center; margin-bottom:8px; font-size:15px; color:var(--text-1);">
        Clique nos eventos para filtrar. Múltipla seleção permitida.
      </div>
      <div class="swal-chips-grid" id="swalChipsGrid">
        ${chipsHTML}
      </div>
      <button id="swalBtnLimpar" class="chip-limpar" style="margin-top:12px; display:${filtrosAtivos.size > 0 ? 'inline-flex' : 'none'}">
        ✕ Limpar todos
      </button>
    `,
    showConfirmButton: true,
    confirmButtonText: "Aplicar",
    showCancelButton: true,
    cancelButtonText: "Cancelar",
    width: "600px",
    didOpen: () => {
      // Toggle chips dentro do Swal
      document.querySelectorAll("#swalChipsGrid .chip").forEach(chip => {
        chip.addEventListener("click", () => {
          const nome = chip.dataset.nome;
          if (chip.classList.contains("ativo")) {
            chip.classList.remove("ativo");
            filtrosAtivos.delete(nome);
          } else {
            chip.classList.add("ativo");
            filtrosAtivos.add(nome);
          }
          // Mostra/oculta botão limpar
          document.getElementById("swalBtnLimpar").style.display =
            filtrosAtivos.size > 0 ? "inline-flex" : "none";
          atualizarBadgeBotao();
          aplicarFiltro();
        });
      });

      // Botão limpar dentro do Swal
      document.getElementById("swalBtnLimpar").addEventListener("click", () => {
        filtrosAtivos.clear();
        document.querySelectorAll("#swalChipsGrid .chip").forEach(c => c.classList.remove("ativo"));
        document.getElementById("swalBtnLimpar").style.display = "none";
        atualizarBadgeBotao();
        aplicarFiltro();
      });
    },
    preConfirm: () => {
      // Sincroniza estado final antes de fechar
      filtrosAtivos.clear();
      document.querySelectorAll("#swalChipsGrid .chip.ativo").forEach(chip => {
        filtrosAtivos.add(chip.dataset.nome);
      });
    }
  });
}


  // ======= RENDER MENSAL (mantendo comportamento) =======
  async function renderMensal(ano, mes) {
    grid.innerHTML = "";
    // Cabeçalho dias da semana
    ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].forEach(d => {
        const el = document.createElement("div");
        el.className = "header-dias";
        el.innerHTML = `<strong>${d}</strong>`;
        grid.appendChild(el);
    });

    try {
        const idempresa = getIdEmpresa();
        const data = await fetchComToken(`/main/eventos-calendario?idempresa=${idempresa}&ano=${ano}&mes=${mes}`);
        const eventos = data.eventos || [];

        // Mapa de eventos por data
        const mapaEventos = {};
        eventos.forEach(ev => {
            const inicio = new Date(ev.inicio);
            const fim = new Date(ev.fim);
            for (let d = new Date(inicio); d <= fim; d.setDate(d.getDate() + 1)) {
                const key = d.toISOString().split("T")[0];
                if (!mapaEventos[key]) mapaEventos[key] = [];
                mapaEventos[key].push(ev);
            }
        });

        const hoje = new Date();
        const hojeStr = hoje.toISOString().split("T")[0];

        const primeiroDia = new Date(ano, mes - 1, 1);
        const ultimoDia = new Date(ano, mes, 0).getDate();
        const diaSemanaInicio = primeiroDia.getDay();
        todosEventosDoMes = eventos;

        const ultimoDiaMesAnterior = new Date(ano, mes - 1, 0).getDate();
        let mesAnterior = mes - 1;
        let anoAnterior = ano;
        if (mesAnterior === 0) { mesAnterior = 12; anoAnterior -= 1; }

        // Dias do mês anterior (apenas os necessários)
        for (let i = diaSemanaInicio - 1; i >= 0; i--) {
        const dia = ultimoDiaMesAnterior - i;
        const dataStr = `${anoAnterior}-${String(mesAnterior).padStart(2,"0")}-${String(dia).padStart(2,"0")}`;
        const cell = document.createElement("div");
        cell.classList.add("dia-anterior");
        cell.style.opacity = "0.4";
        cell.innerHTML = `<span class="numero-dia">${dia}</span>`;
        if (dataStr === hojeStr) { cell.style.border = "2px solid var(--primary-color)"; cell.style.borderRadius = "6px"; }
        (mapaEventos[dataStr] || []).forEach(ev => cell.appendChild(criarEventoElemento(ev)));
        grid.appendChild(cell);
        }

            // Dias do mês atual
            for (let dia = 1; dia <= ultimoDia; dia++) {
                const dataStr = `${ano}-${String(mes).padStart(2,"0")}-${String(dia).padStart(2,"0")}`;
                const cell = document.createElement("div");
                cell.innerHTML = `<span class="numero-dia">${dia}</span>`;
                if (dataStr === hojeStr) { cell.style.border = "2px solid var(--primary-color)"; cell.style.borderRadius = "6px"; }
                (mapaEventos[dataStr] || []).forEach(ev => cell.appendChild(criarEventoElemento(ev)));

                grid.appendChild(cell);
            }

        // Dias do próximo mês (apenas até completar a última semana)
        const totalCelulas = grid.children.length;
        const linhasCompletas = Math.ceil(totalCelulas / 7) * 7;
        const diasProximoMes = linhasCompletas - totalCelulas;
        let mesProximo = mes + 1;
        let anoProximo = ano;
        if (mesProximo === 13) { mesProximo = 1; anoProximo += 1; }

        for (let i = 1; i <= diasProximoMes; i++) {
        const dataStr = `${anoProximo}-${String(mesProximo).padStart(2,"0")}-${String(i).padStart(2,"0")}`;
        const cell = document.createElement("div");
        cell.classList.add("dia-proximo");
        cell.style.opacity = "0.4";
        cell.innerHTML = `<span class="numero-dia">${i}</span>`;
        if (dataStr === hojeStr) { cell.style.border = "2px solid var(--primary-color)"; cell.style.borderRadius = "6px"; }
        (mapaEventos[dataStr] || []).forEach(ev => cell.appendChild(criarEventoElemento(ev)));
        grid.appendChild(cell);
        }

        if (filtrosAtivos.size > 0) aplicarFiltro();
    } catch (err) {
    console.error("Erro ao carregar eventos do calendário (mensal):", err);
    }
  }

  async function exportarCalendario(ano, mes) {
  if (todosEventosDoMes.length === 0) {
    Swal.fire({ icon: "info", title: "Sem dados", text: "Nenhum evento para exportar." });
    return;
  }

  const btnExportar = header.querySelector("#btnExportar");
  btnExportar.disabled = true;
  btnExportar.innerHTML = `⏳ Carregando...`;

  try {
    const idempresa = getIdEmpresa();
    const mesAtual = mesSelect.options[mesSelect.selectedIndex].text;
    const anoAtual = parseInt(anoSelect.value);
    const mesAtualIdx = parseInt(mesSelect.value);

    // ======= ETAPA 1: MAPA DE EVENTOS POR DIA =======
    const mapaEventos = {};
    todosEventosDoMes.forEach(ev => {
      const inicio = new Date(ev.inicio);
      const fim = new Date(ev.fim);
      for (let d = new Date(inicio); d <= fim; d.setDate(d.getDate() + 1)) {
        const key = d.toISOString().split("T")[0];
        if (!mapaEventos[key]) mapaEventos[key] = [];
        // Evita duplicatas do mesmo evento no mesmo dia
        if (!mapaEventos[key].find(e => (e.id || e.idevento) === (ev.id || ev.idevento) && e.tipo === ev.tipo)) {
          mapaEventos[key].push(ev);
        }
      }
    });

    // ======= ETAPA 3: MONTAR HTML HORIZONTAL (ESTILO CRONOGRAMA) =======
    const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const ultimoDia = new Date(anoAtual, mesAtualIdx, 0).getDate();

    // 1. Identificar todos os eventos únicos do mês (cada um será uma linha)
    const eventosUnicosNoMes = [];
    const idsVistos = new Set();
    
    // Ordenar eventos por data de início para as linhas ficarem organizadas
    const eventosOrdenados = [...todosEventosDoMes].sort((a, b) => new Date(a.inicio) - new Date(b.inicio));

    eventosOrdenados.forEach(ev => {
        const id = ev.id || ev.idevento;
        if (!idsVistos.has(id)) {
            idsVistos.add(id);
            eventosUnicosNoMes.push(ev);
        }
    });

    // 2. Criar o Cabeçalho com os Dias (Coluna 1, 2, 3... até 31)
    let cabecalhoDias = `<th style="background:#8B0000;color:var(--on-brand);padding:6px;border:1px solid #aaa;min-width:180px;">Evento / Dia</th>`;
    
    for (let dia = 1; dia <= ultimoDia; dia++) {
        const dataObj = new Date(anoAtual, mesAtualIdx - 1, dia);
        const diaSemanaIdx = dataObj.getDay();
        const fimDeSemana = (diaSemanaIdx === 0 || diaSemanaIdx === 6);
        const bgCabecalho = fimDeSemana ? "#555" : "#8B0000"; // Cinza escuro para fds no topo
        
        cabecalhoDias += `
            <th style="background:${bgCabecalho};color:#fff;padding:4px;border:1px solid #aaa;min-width:35px;font-size:10px;text-align:center;">
                ${dia}<br><span style="font-size:8px;">${diasSemana[diaSemanaIdx]}</span>
            </th>`;
    }

    // 3. Criar as Linhas de Eventos
    let htmlLinhas = "";
    eventosUnicosNoMes.forEach(eventoPrincipal => {
        const idEvento = eventoPrincipal.id || eventoPrincipal.idevento;
        
        htmlLinhas += `<tr>`;
        // Primeira coluna fixa: Nome do Evento
        htmlLinhas += `
            <td style="background:var(--surface-3); font-weight:bold; padding:6px; border:1px solid #ddd; font-size:11px; white-space: nowrap;">
                ${eventoPrincipal.nome}
            </td>`;

        // Gerar colunas para cada dia do mês para este evento
        for (let dia = 1; dia <= ultimoDia; dia++) {
            const dataStr = `${anoAtual}-${String(mesAtualIdx).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
            const dataObj = new Date(anoAtual, mesAtualIdx - 1, dia);
            const fimDeSemana = (dataObj.getDay() === 0 || dataObj.getDay() === 6);
            
            // Verifica se este evento específico acontece neste dia
            const eventosDoDia = mapaEventos[dataStr] || [];
            const evNoDia = eventosDoDia.find(e => (e.id || e.idevento) === idEvento);

            const mapaSiglas = {
            "montagem infra": "M I",
            "montagem": "M",
            "realização": "R",
            "desmontagem": "D",
            "desmontagem infra": "D I",
            "marcação": "MAR",
            "feriado": "F"
        };

            if (evNoDia) {
                const cor = getCorPeriodo(evNoDia.tipo); // Garanta 6 dígitos sem 'ff'
                const corTexto = ["#23821F", "#704300", "#5B0F85", "#73757A"].includes(cor.toUpperCase()) ? "#ffffff" : "#000000";
                
                // Coloca a inicial do tipo (M, I, R, D) para não esticar a célula 
                const tipoNormalizado = evNoDia.tipo.toLowerCase().trim();
                const sigla = mapaSiglas[tipoNormalizado] || evNoDia.tipo.substring(0, 1).toUpperCase();

                htmlLinhas += `
                    <td style="
                        background:${cor}; 
                        color:${corTexto}; 
                        border:1px solid #ddd; 
                        text-align:center; 
                        font-size:10px; 
                        font-weight:bold;
                        width:35px;
                    ">
                        ${sigla}
                    </td>`;
        
            } else {
                // Célula vazia (com fundo cinza se for fim de semana)
                htmlLinhas += `<td style="border:1px solid #ddd; background:${fimDeSemana ? "#f0f0f0" : "#fff"}"></td>`;
            }
        }
        htmlLinhas += `</tr>`;
    });

    // ======= ETAPA 4: HTML COMPLETO =======
    const htmlCompleto = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Abel, sans-serif; }
          table { border-collapse: collapse; }
          td, th { border: 1px solid #aaa; }
        </style>
      </head>
      <body>
        <table>
          <thead>
            <tr>
              <th colspan="${ultimoDia + 1}" style="background:#8B0000; color:var(--on-brand); font-size:16px; padding:10px; text-align:center;">
                ${mesAtual.toUpperCase()} ${anoAtual}
              </th>
            </tr>
            <tr>
              <td colspan="${ultimoDia + 1}" style="background:var(--surface-1); padding:5px; border:1px solid #aaa;">
                <table style="border-collapse: collapse;">
                  <tr>
                    <td style="font-size:11px; background:#8B0000; color:var(--on-brand); font-weight:bold; padding-right:10px; border:none;">LEGENDA:</td>
                    <td class="td-legenda" style="background:#f8a500; color:var(--on-brand-escuro);">(M I) Montagem Infra</td>
                    <td class="td-legenda" style="background:#F5E801; color:var(--on-brand-escuro);">(M) Montagem</td>
                    <td class="td-legenda" style="background:#F46251; color:var(--on-brand-escuro);">(R) Realização</td>
                    <td class="td-legenda" style="background:#23821F; color:var(--on-brand);">(D) Desmontagem</td>
                    <td class="td-legenda" style="background:#704300; color:var(--on-brand);">(D I) Desmontagem Infra</td>
                    <td class="td-legenda" style="background:#73757A; color:var(--on-brand);">(MAR) Marcação</td>
                    <td class="td-legenda" style="background:#5B0F85; color:var(--on-brand);">(F) Feriado</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              ${cabecalhoDias}
            </tr>
          </thead>
          <tbody>
            ${htmlLinhas}
          </tbody>
        </table>
      </body>
      </html>
    `;

    // ======= DOWNLOAD =======
    const blob = new Blob([htmlCompleto], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `calendario_${mesAtual}_${anoAtual}.xls`;
    link.click();
    URL.revokeObjectURL(url);

  } catch (err) {
    console.error("Erro ao exportar:", err);
    Swal.fire({ icon: "error", title: "Erro", text: "Não foi possível exportar." });
  } finally {
    btnExportar.disabled = false;
    btnExportar.innerHTML = `📁 Exportar`;
  }
}

function formatarDataSimples(data) {
  const d = new Date(data);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function buscarEventosPorPeriodo(anoBase, mesInicio, totalMeses) {
  const idempresa = getIdEmpresa();
  const consultas = [];

  for (let i = 0; i < totalMeses; i++) {
    const dataRef = new Date(anoBase, (mesInicio - 1) + i, 1);
    consultas.push(
      fetchComToken(`/main/export-eventos-calendario?idempresa=${idempresa}&ano=${dataRef.getFullYear()}&mes=${dataRef.getMonth() + 1}`)
    );
  }

  const respostas = await Promise.all(consultas);
  const todosEventos = respostas.flatMap(r => r.eventos || []);

  // EM VEZ DE MAPA DE ID, VAMOS CRIAR UM MAPA DE "NOME_DO_EVENTO" -> DIAS_E_TIPOS
  // Isso garante que todas as fases do mesmo evento fiquem na mesma linha
  const consolidado = {};

  todosEventos.forEach(ev => {
    const nomeKey = ev.nome; // Nome completo do evento
    if (!consolidado[nomeKey]) {
      consolidado[nomeKey] = {
        nome: ev.nome,
        idevento: ev.idevento,
        datas: {} // Guardará cada dia e seu tipo { "2024-05-01": "Montagem" }
      };
    }

    // Preencher o mapa de datas para este evento
    let atual = new Date(ev.inicio + "T12:00:00");
    const fim = new Date(ev.fim + "T12:00:00");

    while (atual <= fim) {
      const dataStr = formatarDataSimples(atual);
      consolidado[nomeKey].datas[dataStr] = ev.tipo;
      atual.setDate(atual.getDate() + 1);
    }
  });

  return Object.values(consolidado);
}

async function exportarCalendarioMultimes(anoBase, mesInicio, totalMeses, tipoNome = "Periodico") {
  const btnExportar = document.getElementById("btnExportar");
  if (btnExportar) {
    btnExportar.disabled = true;
    btnExportar.innerHTML = `⏳ Mesclando Fases...`;
  }

  try {
    const mapaSiglas = {
      "montagem infra": "M I", "montagem": "M", "realização": "R",
      "desmontagem": "D", "desmontagem infra": "D I", "marcação": "MAR", "feriado": "F"
    };

    const eventosParaExibir = await buscarEventosPorPeriodo(anoBase, mesInicio, totalMeses);
    if (!eventosParaExibir.length) {
      Swal.fire({ icon: "info", title: "Sem dados", text: "Nenhum evento encontrado." });
      return;
    }

    let htmlFinal = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="UTF-8"><style>
        table { border-collapse: collapse; }
        td, th { border: 1px solid #aaa; text-align: center; font-family: Abel, sans serif; }
        .title-topo { background:#8B0000; color:#fff; font-size:14px; font-weight:bold; height: 30px; text-transform: uppercase; }
        .td-legenda-label { background: #8B0000; color: #fff; font-size: 10px; font-weight: bold; width: 250px; }
        .td-legenda-item { font-size: 9px; padding: 2px 5px; border: 1px solid #000; }
        .header-mes-label { background: #8B0000; color: #fff; font-weight: bold; width: 250px; }
        .header-mes-nome { background: #fff; color: #000; font-weight: bold; border-bottom: 2px solid #000; }
        .header-dias { background: #8B0000; color: #fff; font-size: 9px; font-weight: bold; height: 25px; }
        .col-evento { text-align: left; font-weight: bold; font-size: 10px; width: 250px; background: #fff; }
      </style></head><body>`;

    const mesesPorBloco = 3;

    for (let i = 0; i < totalMeses; i += mesesPorBloco) {
      let blocoMeses = [];
      let totalDiasBloco = 0;

      for (let j = i; j < i + mesesPorBloco && j < totalMeses; j++) {
        const d = new Date(anoBase, (mesInicio - 1) + j, 1);
        const ultimoDia = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        blocoMeses.push({
          nome: new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(d).toLowerCase() + "/" + String(d.getFullYear()).slice(-2),
          ano: d.getFullYear(), mesIdx: d.getMonth() + 1, dias: ultimoDia
        });
        totalDiasBloco += ultimoDia;
      }

      htmlFinal += `
        <table>
          <thead>
            <tr><th colspan="${totalDiasBloco + 1}" class="title-topo">CRONOGRAMA - ${blocoMeses[0].nome.split('/')[0].toUpperCase()} A ${blocoMeses[blocoMeses.length-1].nome.split('/')[0].toUpperCase()}</th></tr>
            <tr>
              <td class="td-legenda-label">LEGENDA:</td>
              <td colspan="${totalDiasBloco}" style="text-align: left; background: #8B0000;">
                <table style="border-collapse: collapse; margin-left: 5px; background: #8B0000;"><tr>
                  <td class="td-legenda-item" style="background:#f8a500;">(M I) Montagem Infra</td>
                  <td class="td-legenda-item" style="background:#F5E801;">(M) Montagem</td>
                  <td class="td-legenda-item" style="background:#F46251;">(R) Realização</td>
                  <td class="td-legenda-item" style="background:#23821F; color:var(--on-brand);">(D) Desmontagem</td>
                  <td class="td-legenda-item" style="background:#704300; color:var(--on-brand);">(D I) Desmontagem Infra</td>
                  <td class="td-legenda-item" style="background:#73757A; color:var(--on-brand);">(MAR) Marcação</td>
                  <td class="td-legenda-item" style="background:#5B0F85; color:var(--on-brand);">(F) Feriado</td>
                </tr></table>
              </td>
            </tr>
            <tr>
              <td class="header-mes-label">MÊS</td>
              ${blocoMeses.map(m => `<td colspan="${m.dias}" class="header-mes-nome" style="background: #8B0000; color: var(--on-brand); border-right: 2px solid #000;">${m.nome}</td>`).join("")}
            </tr>
            <tr class="header-dias">
              <td style="border-right: 2px solid #000;">EVENTO / DIA</td>
              ${blocoMeses.map(m => {
                let dHtml = "";
                for (let d = 1; d <= m.dias; d++) {
                  const borderSide = (d === m.dias) ? "border-right: 2px solid #000;" : "";
                  dHtml += `<td style="width:25px; ${borderSide}">${d}</td>`;
                }
                return dHtml;
              }).join("")}
            </tr>
          </thead>
          <tbody>`;

      // --- LÓGICA DE MESCLAGEM DE CÉLULAS ---
      eventosParaExibir.forEach(ev => {
        let temAtividade = false;
        let listaDatasBloco = [];

        // Primeiro, criamos uma lista linear de todas as datas deste bloco
        blocoMeses.forEach(m => {
          for (let d = 1; d <= m.dias; d++) {
            const dataKey = `${m.ano}-${String(m.mesIdx).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            listaDatasBloco.push({
              data: dataKey,
              tipo: ev.datas[dataKey] || null,
              ultimoDiaMes: (d === m.dias),
              ds: new Date(m.ano, m.mesIdx - 1, d).getDay()
            });
            if (ev.datas[dataKey]) temAtividade = true;
          }
        });

        if (temAtividade) {
          let linhaHtml = `<tr><td class="col-evento" style="border-right: 2px solid #000;">${ev.nome}</td>`;
          
          for (let k = 0; k < listaDatasBloco.length; k++) {
            let info = listaDatasBloco[k];
            
            // Se a célula for vazia, não mesclamos (para manter os fins de semana visíveis)
            if (!info.tipo) {
              const borderSide = info.ultimoDiaMes ? "border-right: 2px solid #000;" : "";
              const bg = (info.ds === 0 || info.ds === 6) ? "#f2f2f2" : "#fff";
              linhaHtml += `<td style="background:${bg}; ${borderSide}"></td>`;
              continue;
            }

            // Se tiver tipo, contamos quantos dias iguais existem à frente
            let span = 1;
            let mudoDeMes = info.ultimoDiaMes;
            
            while (
              k + span < listaDatasBloco.length && 
              listaDatasBloco[k + span].tipo === info.tipo &&
              !mudoDeMes // Para a mesclagem se mudar o mês (mantém a linha grossa)
            ) {
              mudoDeMes = listaDatasBloco[k + span].ultimoDiaMes;
              span++;
            }

            const cor = getCorPeriodo(info.tipo);
            const sigla = mapaSiglas[info.tipo.toLowerCase().trim()] || "?";
            const corTxt = ["#23821F", "#704300", "#5B0F85"].includes(cor.toUpperCase()) ? "#fff" : "#000";
            const borderSide = listaDatasBloco[k + span - 1].ultimoDiaMes ? "border-right: 2px solid #000;" : "";

            linhaHtml += `<td colspan="${span}" style="background:${cor}; color:${corTxt}; font-size:9px; font-weight:bold; ${borderSide}">${sigla}</td>`;
            
            k += (span - 1); // Pula as células que foram mescladas
          }
          htmlFinal += linhaHtml + "</tr>";
        }
      });

      htmlFinal += `</tbody></table><br>`;
    }

    htmlFinal += `</body></html>`;

    const blob = new Blob([htmlFinal], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Cronograma_Excel_${tipoNome}.xls`;
    link.click();

  } catch (err) {
    console.error(err);
    Swal.fire("Erro", "Falha na exportação.", "error");
  } finally {
    if (btnExportar) {
      btnExportar.disabled = false;
      btnExportar.innerHTML = `📁 Exportar`;
    }
  }
}
header.querySelector("#btnExportar").addEventListener("click", () => {
    exportarCalendario(parseInt(anoSelect.value), parseInt(mesSelect.value));
});

  // ======= RENDER SEMANAL =======
  async function renderSemanal(ano, mes, semanaIdx = 0) {
  grid.innerHTML = "";
  semanaWrapper.style.display = "flex";
  semanaWrapper.style.gap = "10px";

  // cabeçalho dias da semana
  ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].forEach(d => {
  const el = document.createElement("div");
  el.className = "header-dias";
  el.innerHTML = `<strong>${d}</strong>`;
  grid.appendChild(el);
  });

  try {
  const semanas = calcularSemanasDoMes(ano, mes);
  if (semanas.length === 0) return;
  if (semanaIdx >= semanas.length) semanaIdx = 0;
  const { inicio, fim } = semanas[semanaIdx];

  const idempresa = getIdEmpresa();
  // carrega eventos do mês atual (já traz tudo que for necessário para os dias)
  const data = await fetchComToken(`/main/eventos-calendario?idempresa=${idempresa}&ano=${ano}&mes=${mes}`);
  const eventos = data.eventos || [];

  // mapa de eventos por data
  const mapaEventos = {};
  eventos.forEach(ev => {
  const inicioEv = new Date(ev.inicio);
  const fimEv = new Date(ev.fim);
  for (let d = new Date(inicioEv); d <= fimEv; d.setDate(d.getDate() + 1)) {
  const key = d.toISOString().split("T")[0];
  if (!mapaEventos[key]) mapaEventos[key] = [];
  mapaEventos[key].push(ev);
  }
  });

  const hoje = new Date();
  const hojeStr = hoje.toISOString().split("T")[0];

  for (let dia = inicio; dia <= fim; dia++) {
  const d = new Date(ano, mes - 1, dia);
  const dataStr = d.toISOString().split("T")[0];
  const cell = document.createElement("div");
  cell.innerHTML = `<span class="numero-dia">${dia}</span>`;
  (mapaEventos[dataStr] || []).forEach(ev => cell.appendChild(criarEventoElemento(ev)));
  if (dataStr === hojeStr) {
  cell.style.border = "2px solid var(--primary-color)";
  cell.style.borderRadius = "6px";
  }
  grid.appendChild(cell);
  }
  } catch (err) {
  console.error("Erro ao carregar eventos do calendário (semanal):", err);
  }
  }

  // ======= RENDER POPUP FULLSCREEN PARA PERIODICIDADES > MÊS (3 em 3 lado a lado) =======
async function renderPopupPeriodico(ano, mes, tipoView) {
  // overlay
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.right = "0";
  overlay.style.bottom = "0";
  overlay.style.background = "rgba(0,0,0,0.6)";
  overlay.style.zIndex = "9999";
  overlay.style.display = "flex";
  overlay.style.justifyContent = "center";
  overlay.style.alignItems = "center";

  // inner fullscreen panel
  const panel = document.createElement("div");
  panel.style.width = "95%";
  panel.style.height = "92%";
  panel.style.background = "var(--surface-1)";
  panel.style.borderRadius = "8px";
  panel.style.boxShadow = "0 8px 40px rgba(0,0,0,0.5)";
  panel.style.display = "flex";
  panel.style.flexDirection = "column";
  panel.style.overflow = "hidden";

  // header
  const ph = document.createElement("div");
  ph.style.display = "flex";
  ph.style.justifyContent = "space-between";
  ph.style.alignItems = "center";
  ph.style.padding = "12px 16px";
  ph.style.borderBottom = "1px solid #eee";

  const title = document.createElement("h2");
  title.style.margin = "0";
  title.textContent = `${tipoView.charAt(0).toUpperCase() + tipoView.slice(1)} - ${ano}`;

  // select principal (Geral, Trimestre, Semestre, Ano)
  const tipoSelect = document.createElement("select");
  ["geral","trimestral","semestral","anual"].forEach(opt => {
  const o = document.createElement("option");
  o.value = opt;
  o.textContent = opt.charAt(0).toUpperCase() + opt.slice(1);
  if (opt === tipoView) o.selected = true;
  tipoSelect.appendChild(o);
  });

  // selects extras (dinâmicos)
  const trimestreSelect = document.createElement("select");
  ["1º Trimestre","2º Trimestre","3º Trimestre","4º Trimestre"].forEach((txt, idx) => {
  const o = document.createElement("option");
  o.value = idx + 1;
  o.textContent = txt;
  trimestreSelect.appendChild(o);
  });
  trimestreSelect.style.display = (tipoView === "trimestral") ? "inline-block" : "none";

  const semestreSelect = document.createElement("select");
  ["1º Semestre","2º Semestre"].forEach((txt, idx) => {
  const o = document.createElement("option");
  o.value = idx + 1;
  o.textContent = txt;
  semestreSelect.appendChild(o);
  });
  semestreSelect.style.display = (tipoView === "semestral") ? "inline-block" : "none";

   const exportCalendario = document.createElement("button");
    exportCalendario.id = "btnExportar";
    exportCalendario.textContent = "📁 Exportar";
    exportCalendario.classList.add("btn-Exportar");

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "Fechar";
  closeBtn.style.padding = "6px 10px";
  closeBtn.style.cursor = "pointer";

const leftss = document.createElement("div");
  leftss.style.display = "flex";
  leftss.style.gap = "8px";
  leftss.appendChild(title);
  leftss.appendChild(tipoSelect);
  leftss.appendChild(trimestreSelect);
  leftss.appendChild(semestreSelect);
  leftss.appendChild(exportCalendario);

  ph.appendChild(leftss);
  ph.appendChild(closeBtn);
  panel.appendChild(ph);

  // body
  const body = document.createElement("div");
  body.className = "multi-calendarios";
  body.style.display = "flex";
  body.style.flexWrap = "wrap";
  body.style.gap = "12px";
  body.style.padding = "12px";
  body.style.overflow = "auto";
  body.style.alignContent = "flex-start";
  panel.appendChild(body);

  overlay.appendChild(panel);
  document.body.appendChild(overlay);

//   closeBtn.addEventListener("click", () => overlay.remove());
//   overlay.addEventListener("click", (ev) => { if (ev.target === overlay) overlay.remove(); });

  async function renderContent(view, trimestreSel = null, semestreSel = null) {
  body.innerHTML = "";
  title.textContent = `${view.charAt(0).toUpperCase() + view.slice(1)} - ${ano}`;
  let mesesParaMostrar = [];

  if (view === "trimestral") {
  const trimestreIdx = (trimestreSel !== null ? trimestreSel - 1 : Math.floor((mes - 1) / 3));
  mesesParaMostrar = [trimestreIdx * 3 + 1, trimestreIdx * 3 + 2, trimestreIdx * 3 + 3];
  } else if (view === "semestral") {
  const semestreIdx = (semestreSel !== null ? semestreSel : (mes <= 6 ? 1 : 2));
  mesesParaMostrar = (semestreIdx === 1) ? [1, 2, 3, 4, 5, 6] : [7, 8, 9, 10, 11, 12];
  } else if (view === "anual") {
  mesesParaMostrar = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  } else { 
  // Geral = mostra o mês atual
  mesesParaMostrar = [mes];
  }

  for (let m of mesesParaMostrar) {
  const mini = document.createElement("div");
  mini.className = "mini-calendario";
  mini.style.flex = "0 0 calc(33.333% - 12px)";
  mini.style.boxSizing = "border-box";
  mini.style.border = "1px solid #eee";
  mini.style.borderRadius = "6px";
  mini.style.padding = "8px";
  mini.style.background = "var(--surface-1)";
  mini.style.minWidth = "220px";
  body.appendChild(mini);
  await renderMiniCalendario(mini, ano, m);
  }
  }

  exportCalendario.addEventListener("click", () => {
    const view = tipoSelect.value;
    let mesInicioExport;
    let totalMesesExport;

    if (view === "trimestral") {
      const triIdx = parseInt(trimestreSelect.value) - 1;
      mesInicioExport = (triIdx * 3) + 1;
      totalMesesExport = 3;
    } else if (view === "semestral") {
      const semIdx = parseInt(semestreSelect.value);
      mesInicioExport = (semIdx === 1) ? 1 : 7;
      totalMesesExport = 6;
    } else if (view === "anual") {
      mesInicioExport = 1;
      totalMesesExport = 12;
    } else {
      mesInicioExport = mes;
      totalMesesExport = 1;
    }

    exportarCalendarioMultimes(ano, mesInicioExport, totalMesesExport, view);
  });

  closeBtn.addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (ev) => { if (ev.target === overlay) overlay.remove(); });

  // eventos dos selects
  tipoSelect.addEventListener("change", () => {
  trimestreSelect.style.display = (tipoSelect.value === "trimestral") ? "inline-block" : "none";
  semestreSelect.style.display = (tipoSelect.value === "semestral") ? "inline-block" : "none";
  renderContent(tipoSelect.value, parseInt(trimestreSelect.value), parseInt(semestreSelect.value));
  });

  trimestreSelect.addEventListener("change", () => {
  renderContent("trimestral", parseInt(trimestreSelect.value));
  });

  semestreSelect.addEventListener("change", () => {
  renderContent("semestral", null, parseInt(semestreSelect.value));
  });

  // render inicial
  renderContent(tipoView);
}


  // Mini calendário (um mês) — usado no popup
async function renderMiniCalendario(container, ano, mes) {
  container.innerHTML = "";
  const titulo = document.createElement("h3");
  titulo.style.margin = "0 0 8px 0";
  titulo.textContent = nomesMeses[mes - 1] + " " + ano;
  container.appendChild(titulo);

  const gridMini = document.createElement("div");
  gridMini.style.display = "grid";
  gridMini.style.gridTemplateColumns = "repeat(7, 1fr)";
  gridMini.style.gap = "6px";
  container.appendChild(gridMini);

  // cabeçalho abreviado
  ["D","S","T","Q","Q","S","S"].forEach(d => {
  const hd = document.createElement("div");
  hd.className = "header-dias";
  hd.style.height = "22px";
  hd.style.display = "flex";
  hd.style.alignItems = "center";
  hd.style.justifyContent = "center";
  hd.innerHTML = `<strong>${d}</strong>`;
  gridMini.appendChild(hd);
  });

  try {
  const idempresa = getIdEmpresa();
  const data = await fetchComToken(`/main/eventos-calendario?idempresa=${idempresa}&ano=${ano}&mes=${mes}`);
  const eventos = data.eventos || [];

  // mapa eventos por data
  const mapaEventos = {};
  eventos.forEach(ev => {
  const inicio = new Date(ev.inicio);
  const fim = new Date(ev.fim);
  for (let d = new Date(inicio); d <= fim; d.setDate(d.getDate() + 1)) {
  const key = d.toISOString().split("T")[0];
  if (!mapaEventos[key]) mapaEventos[key] = [];
  mapaEventos[key].push(ev);
  }
  });

  const primeiroDia = new Date(ano, mes - 1, 1);
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const diaSemanaInicio = primeiroDia.getDay();

  // espaços vazios antes do 1º dia
  for (let i = 0; i < diaSemanaInicio; i++) {
  const empty = document.createElement("div");
  empty.style.minHeight = "48px";
  gridMini.appendChild(empty);
  }

  const hoje = new Date();
  const hojeStr = hoje.toISOString().split("T")[0];

  // dias do mês
  for (let dia = 1; dia <= ultimoDia; dia++) {
  const dataStr = `${ano}-${String(mes).padStart(2,"0")}-${String(dia).padStart(2,"0")}`;
  const cell = document.createElement("div");
  cell.style.minHeight = "48px";
  cell.style.padding = "2px";
  cell.style.display = "flex";
  cell.style.flexDirection = "column";

  cell.innerHTML = `<span class="numero-dia" style="font-size:12px;font-weight:600;">${dia}</span>`;
  if (dataStr === hojeStr) cell.style.outline = "1px solid var(--primary-color)";

  // container com scroll só pros eventos
  const eventosBox = document.createElement("div");
  eventosBox.className = "eventos-scroll"; // classe para estilizar no CSS
  eventosBox.style.flex = "1";
  eventosBox.style.overflowY = "auto";
  eventosBox.style.maxHeight = "70px"; // controla altura antes do scroll
  eventosBox.style.marginTop = "2px";

  (mapaEventos[dataStr] || []).forEach(ev => {
  const evEl = criarEventoElemento(ev);
  // estilo compactado para mini
  evEl.style.display = "block";
  evEl.style.padding = "2px 4px";
  evEl.style.fontSize = "8px";
  evEl.style.marginTop = "2px";
  eventosBox.appendChild(evEl);
  });

  cell.appendChild(eventosBox);
  gridMini.appendChild(cell);
  }

  // completar última linha
  const totalDayCells = diaSemanaInicio + ultimoDia;
  const faltam = (7 - (totalDayCells % 7)) % 7;
  for (let i = 0; i < faltam; i++) {
  const empty = document.createElement("div");
  empty.style.minHeight = "48px";
  gridMini.appendChild(empty);
  }

  } catch (err) {
  console.error("Erro no mini-calendário:", err);
  container.appendChild(document.createTextNode("Erro ao carregar mês"));
  }
}
  // ===== Render inicial =====
  preencherSemanas(parseInt(anoSelect.value), parseInt(mesSelect.value));
  renderMensal(parseInt(anoSelect.value), parseInt(mesSelect.value));

  // ===== Listeners =====
  anoSelect.addEventListener("change", () => {
  preencherSemanas(parseInt(anoSelect.value), parseInt(mesSelect.value));
  const view = viewSelect.value;
  if (view === "semanal") renderSemanal(parseInt(anoSelect.value), parseInt(mesSelect.value), parseInt(semanaSelect.value || 0));
  else if (view === "mensal") renderMensal(parseInt(anoSelect.value), parseInt(mesSelect.value));
  });

    header.querySelector("#btnFiltroEventos").addEventListener("click", () => {
  abrirFiltroSwal(todosEventosDoMes);
});


  mesSelect.addEventListener("change", () => {
  preencherSemanas(parseInt(anoSelect.value), parseInt(mesSelect.value));
  const view = viewSelect.value;
  if (view === "semanal") renderSemanal(parseInt(anoSelect.value), parseInt(mesSelect.value), parseInt(semanaSelect.value || 0));
  else if (view === "mensal") renderMensal(parseInt(anoSelect.value), parseInt(mesSelect.value));
  });

  viewSelect.addEventListener("change", async () => {
  const view = viewSelect.value;
  if (view === "semanal") {
  preencherSemanas(parseInt(anoSelect.value), parseInt(mesSelect.value));
  await renderSemanal(parseInt(anoSelect.value), parseInt(mesSelect.value), parseInt(semanaSelect.value || 0));
  } else if (view === "mensal") {
  semanaWrapper.style.display = "none";
  await renderMensal(parseInt(anoSelect.value), parseInt(mesSelect.value));
  } else {
  // trimestral / semestral / anual -> popup full screen
  semanaWrapper.style.display = "none";
  await renderPopupPeriodico(parseInt(anoSelect.value), parseInt(mesSelect.value), view);
  }
  });

  semanaSelect.addEventListener("change", () =>
  renderSemanal(parseInt(anoSelect.value), parseInt(mesSelect.value), parseInt(semanaSelect.value))
  );
}
// ===== Popup global de staff =====
async function abrirPopupEvento(idevento) {
  if (!idevento) {
  console.warn("idevento indefinido ao abrir popup de staff");
  return;
  }
  try {
  const idempresa = getIdEmpresa();
  const resp = await fetchComToken(`/main/eventos-staff?idempresa=${idempresa}&idevento=${idevento}`);

  const staff = resp.staff?.pessoas || [];
  if (staff.length === 0) {
  alert("Nenhum funcionário encontrado para este evento.");
  return;
  }

  // Criar popup
const popup = document.createElement("div");
popup.className = "popup-evento";
popup.innerHTML = `
    <div class="popup-header">
        <h2>Funcionários do Evento: ${resp.staff.nmevento}</h2>
        <button class="popup-close">X</button>
    </div>
    <div class="popup-body">
        <ul>
            ${staff.map(f => `<li>${f.funcionario} - ${f.funcao}</li>`).join("")}
        </ul>
    </div>
`;

  // Fechar popup
  popup.querySelector(".popup-close").addEventListener("click", () => popup.remove());

  // Tornar arrastável
  let isDragging = false, offsetX = 0, offsetY = 0;
  const header = popup.querySelector(".popup-header");

  header.addEventListener("mousedown", (e) => {
  isDragging = true;
  offsetX = e.clientX - popup.offsetLeft;
  offsetY = e.clientY - popup.offsetTop;
  popup.style.cursor = "grabbing";
  });

  document.addEventListener("mousemove", (e) => {
  if (isDragging) {
  popup.style.left = e.clientX - offsetX + "px";
  popup.style.top = e.clientY - offsetY + "px";
  popup.style.transform = "none"; // remove centralização automática
  }
  });

  document.addEventListener("mouseup", () => {
  if (isDragging) {
  isDragging = false;
  popup.style.cursor = "move";
  }
  });

  document.body.appendChild(popup);

  } catch (err) {
  console.error("Erro ao carregar staff:", err);
  }
}


// =========================
//   Eventos em Aberto  
// =========================
document.addEventListener("DOMContentLoaded", function () {
  const cardEventos = document.querySelector(".card-eventos-em-abertos");

  if (cardEventos) {
  cardEventos.addEventListener("click", function () {
  mostrarEventosEmAberto(); // renderiza só ao clicar
  });
  }
});

function criarFiltroAnoCustom() {
    const anoAtual = new Date().getFullYear();
    const anos = [anoAtual, anoAtual - 1, anoAtual - 2]; 

    const filtroContainer = document.createElement("div");
    // Mantemos as classes para o alinhamento do Flexbox e respiros
    filtroContainer.className = "filtros-fechados"; 
    filtroContainer.innerHTML = `
        <label class="label-select-fechado">Filtrar por Ano</label>
        <div class="wrapper-select-custom"> 
            <select id="filtroAnoSelect" class="select-simples">
                ${anos.map(ano => `
                    <option value="${ano}">${ano}</option>
                `).join("")}
            </select>
        </div>
    `;
    return filtroContainer;
}

async function atualizarEventosEmAberto() {
  const qtdSpan = document.getElementById("qtdEventosAbertos");
  const lista = document.querySelector(".card-eventos-em-abertos .evt-body");
  const footer = document.querySelector(".card-eventos-em-abertos .evt-footer");

  if (!qtdSpan || !lista || !footer) {
  console.warn("Elementos de eventos em aberto não encontrados no DOM.");
  return;
  }

  try {
  const idempresa = getIdEmpresa();
  const resposta = await fetchComToken("/main/eventos-abertos", {
  headers: { idempresa }
  });

  if (!resposta || !resposta.length) {
  qtdSpan.textContent = "0";
  lista.innerHTML = `<div class="evento-vazio">Nenhum evento em aberto 🎉</div>`;
  footer.style.display = "none";
  return;
  }

  // Função utilitária para converter data local
  function parseDateLocal(dateStr) {
  if (typeof dateStr === "string") {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
  }
  return new Date(dateStr);
  }
  return new Date(dateStr);
  }

  // Ordena pelo evento mais próximo
  resposta.sort((a, b) => new Date(a.data_referencia) - new Date(b.data_referencia));

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  lista.innerHTML = "";
  qtdSpan.textContent = resposta.length;

  // Mostra apenas o evento mais próximo
  const primeiroEvento = resposta[0];
  const dataEvento = parseDateLocal(primeiroEvento.data_referencia);
  const diffDias = Math.ceil((dataEvento - hoje) / (1000 * 60 * 60 * 24));

  let statusTexto = "";
  let statusClasse = "";

  if (primeiroEvento.fim_evento && new Date(primeiroEvento.fim_evento) < hoje) {
  statusTexto = "✔ Realizado com sucesso";
  statusClasse = "status-realizado";
  } else if (diffDias <= 5 && diffDias >= 0) {
  statusTexto = `⚠ Sem staff - faltam ${diffDias} dia${diffDias > 1 ? "s" : ""} p/ Realizar`;
  statusClasse = "status-urgente";
  } else if (diffDias > 5) {
  statusTexto = "Sem staff definido";
  statusClasse = "status-pendente";
  } else {
  statusTexto = "Em andamento";
  statusClasse = "status-andamento";
  }

  const item = `
  <div class="evento-nome"> Evento: ${primeiroEvento.nmevento}</div>
  <div class="evento-local">Local: ${primeiroEvento.nmlocalmontagem || "Local não informado"}</div>
  <div class="evento-status ${statusClasse}">status: ${statusTexto}</div>
  `;

  lista.insertAdjacentHTML("beforeend", item);

  // Mostra "clique para ver mais" se houver outros eventos
  if (resposta.length > 1) {
  footer.style.display = "block";
  footer.innerHTML = `<span class="verMais"> Clique para ver mais (${resposta.length - 1} outros)</span>`;
  } else {
  footer.style.display = "none";
  }

  } catch (err) {
  console.error("Erro ao carregar eventos em aberto:", err);
  lista.innerHTML = `<div class="evento-erro">Erro ao carregar eventos ⚠</div>`;
  qtdSpan.textContent = "–";
  footer.style.display = "none";
  }
}

async function mostrarEventosEmAberto() {
 const painel = document.getElementById("painelDetalhes");
 if (!painel) return;

 painel.innerHTML = "";

 // ======= CONTAINER PRINCIPAL =======
 const container = document.createElement("div");
 container.className = "painel-eventos-em-aberto";

 // ======= HEADER =======
 const header = document.createElement("div");
 header.className = "header-eventos-em-aberto";
 header.textContent = "Eventos em Aberto";
//  header.textContent = "Painel Operacional";
 container.appendChild(header);

// const FiltrosVencimentos = criarControlesDeFiltro();
// container.appendChild(FiltrosVencimentos); 

// ======= SUBSTITUIÇÃO DA SEÇÃO DE ABAS PELOS FILTROS =======

// 1. Criamos o container que receberá a lista de cards
const conteudoGeral = document.createElement("div");
conteudoGeral.className = "conteudo-geral-eventos ativo";
conteudoGeral.style.marginTop = "40px";

// 2. Criamos o componente de filtros (Status, Período e Data/Mês/Ano)
// Esta função gerencia as trocas e chama o carregamento automaticamente
const filtros = criarFiltrosEventoCompletos(conteudoGeral);

// 3. Adicionamos ao container principal
container.appendChild(filtros);
container.appendChild(conteudoGeral);
painel.appendChild(container);

// 4. Disparamos a carga inicial
carregarDetalhesEventos(conteudoGeral);

// ------------------------------------------------------------------
// ======= FUNÇÃO DE FILTROS (LÓGICA UNIFICADA) =======
// ------------------------------------------------------------------

function criarFiltrosEventoCompletos(conteudoGeral) {
    const filtrosContainer = document.createElement("div");
    filtrosContainer.className = "filtros-Evt Evt-container";

    const wrapperUnificado = document.createElement("div");
    wrapperUnificado.style.display = "flex";
    wrapperUnificado.style.gap = "20px";

    // --- FILTRO STATUS (Substitui as abas Abertos/Encerrados) ---
    const grupoStatus = document.createElement("div");
    grupoStatus.className = "filtro-grupo";
    grupoStatus.innerHTML = `
        <label class="label-select">Visualizar Eventos</label>
        <div class="wrapper" style="width: 253px;"> 
            <div class="option" style="width: 120px;">
                <input checked value="abertos" name="statusEvt" type="radio" class="input" />
                <div class="btn"><span class="span">Abertos</span></div>
            </div>
            <div class="option" style="width: 120px;">
                <input value="encerrados" name="statusEvt" type="radio" class="input" />
                <div class="btn"><span class="span">Encerrados</span></div>
            </div>
        </div>`;

    // --- FILTRO PERÍODO (Diário, Semanal, Mensal, Anual) ---
    const grupoPeriodo = document.createElement("div");
    grupoPeriodo.className = "filtro-grupo";
    grupoPeriodo.innerHTML = `
        <label class="label-select">Período</label>
        <div class="wrapper" style="width: 400px;">
            ${['diario', 'semanal', 'mensal', 'Trimestral', 'Semestral', 'anual'].map((p, i) => `
                <div class="option" style="width: 60px;">
                    <input ${i===2?'checked':''} value="${p}" name="periodoEvt" type="radio" class="input" />
                    <div class="btn"><span class="span">${p.charAt(0).toUpperCase()+p.slice(1)}</span></div>
                </div>
            `).join('')}
        </div>`;

    // Container para o sub-filtro dinâmico (Input Date ou Select Mês/Ano)
    const subFiltroWrapper = document.createElement("div");
    subFiltroWrapper.id = "sub-filtro-evt-wrapper";
    subFiltroWrapper.className = "filtro-grupo";

    // --- BUSCA POR EVENTO (todas as edições/anos) ---
    // Ao escolher, ajusta Status (Abertos/Encerrados) e Período (força Anual + ano do evento)
    // pra garantir que o evento apareça, recarrega e rola até o card correspondente.
    const grupoBusca = document.createElement("div");
    grupoBusca.className = "filtro-grupo";
    grupoBusca.innerHTML = `
        <label class="label-select">Buscar Evento</label>
        <div class="wrapper select-wrapper busca-evento-wrapper" style="width: 260px;">
            <input type="text" id="busca-evento-input" class="busca-evento-input" placeholder="Buscar evento..." autocomplete="off">
            <input type="hidden" id="busca-evento-id">
            <ul id="busca-evento-lista" class="busca-evento-lista" style="display:none;"></ul>
        </div>`;

    wrapperUnificado.appendChild(grupoStatus);
    wrapperUnificado.appendChild(grupoPeriodo);
    wrapperUnificado.appendChild(subFiltroWrapper);
    wrapperUnificado.appendChild(grupoBusca);
    filtrosContainer.appendChild(wrapperUnificado);

    // Lógica para mudar o seletor de data/mês conforme o período
    const atualizarSubFiltroInterno = (tipo) => {
        subFiltroWrapper.innerHTML = "";
        const anoAtual = 2026; // Conforme seu código base

        if (tipo === "diario" || tipo === "semanal") {
            const hoje = new Date().toISOString().split("T")[0];
            subFiltroWrapper.innerHTML = `
                <label class="label-select">Data Base</label>
                <div class="wrapper select-wrapper">
                    <input type="date" id="sub-filtro-data-evt" class="input-data-simples" value="${hoje}">
                </div>`;
        } 
        else if (tipo === "mensal") {
        let options = "";
        const mesAtual = new Date().getMonth() + 1;
        const nomes = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        nomes.forEach((nome, i) => {
            options += `<option value="${i + 1}" ${i + 1 === mesAtual ? 'selected' : ''}>${nome} / ${anoAtual}</option>`;
        });
        subFiltroWrapper.innerHTML = `<label class="label-select">Mês</label><div class="wrapper select-wrapper"><select id="sub-filtro-select-evt" class="select-simples">${options}</select></div>`;
    }
        else if (tipo === "Trimestral") {
            const trimAtual = Math.floor(new Date().getMonth() / 3) + 1;
            let options = "";
            ["1º Trimestre (Jan-Mar)", "2º Trimestre (Abr-Jun)", "3º Trimestre (Jul-Set)", "4º Trimestre (Out-Dez)"].forEach((t, i) => {
                options += `<option value="${i + 1}" ${i + 1 === trimAtual ? 'selected' : ''}>${t}</option>`;
            });
            subFiltroWrapper.innerHTML = `<label class="label-select">Trimestre</label><div class="wrapper select-wrapper"><select id="sub-filtro-select-evt" class="select-simples">${options}</select></div>`;
        } 
        else if (tipo === "Semestral") {
            const semAtual = new Date().getMonth() < 6 ? 1 : 2;
            let options = `
                <option value="1" ${semAtual === 1 ? 'selected' : ''}>1º Semestre (Jan-Jun)</option>
                <option value="2" ${semAtual === 2 ? 'selected' : ''}>2º Semestre (Jul-Dez)</option>`;
            subFiltroWrapper.innerHTML = `<label class="label-select">Semestre</label><div class="wrapper select-wrapper"><select id="sub-filtro-select-evt" class="select-simples">${options}</select></div>`;
        } 
        else if (tipo === "anual") {
            subFiltroWrapper.innerHTML = `<label class="label-select">Ano</label><div class="wrapper select-wrapper"><select id="sub-filtro-select-evt" class="select-simples"><option value="2025">2025</option><option value="2026" selected>2026</option><option value="2027">2027</option></select></div>`;
        }

        // Reatribui o evento de mudança para disparar a busca
        subFiltroWrapper.querySelectorAll("input, select").forEach(el => {
            el.addEventListener("change", () => carregarDetalhesEventos(conteudoGeral));
        });
    };

    // Eventos para rádio buttons (Status e Período)
    [grupoStatus, grupoPeriodo].forEach(g => {
        g.querySelectorAll("input").forEach(i => i.addEventListener("change", (e) => {
            if (e.target.name === 'periodoEvt') atualizarSubFiltroInterno(e.target.value);
            carregarDetalhesEventos(conteudoGeral);
        }));
    });

    // --- Inicialização da busca por evento (mesmo padrão do RH: input + lista suspensa) ---
    (async () => {
        const input = grupoBusca.querySelector("#busca-evento-input");
        const lista = grupoBusca.querySelector("#busca-evento-lista");
        const idempresa = localStorage.getItem("idempresa");
        let eventosBusca = [];

        try {
            eventosBusca = await fetchComToken(`/main/eventos-busca`, { headers: { idempresa } }) || [];
        } catch (err) {
            console.error("Erro ao carregar eventos para busca:", err);
        }

        // Um evento pode ter mais de um orçamento no mesmo ano (ex: duas montagens/revisões
        // diferentes) — só mostra o número do orçamento quando há ambiguidade real, senão o
        // nome/ano sozinho já basta e fica mais limpo.
        const contagemNomeAno = eventosBusca.reduce((acc, ev) => {
            const chave = `${ev.nmevento}|${ev.ano}`;
            acc[chave] = (acc[chave] || 0) + 1;
            return acc;
        }, {});

        const selecionarEvento = async (eventoSel) => {
            // 1. Status: Abertos/Encerrados conforme o evento
            const statusInput = filtrosContainer.querySelector(
                `input[name="statusEvt"][value="${eventoSel.aberto ? 'abertos' : 'encerrados'}"]`
            );
            if (statusInput) statusInput.checked = true;

            // 2. Período: força Anual + o ano do evento, pra garantir que ele apareça
            // independente da data exata (diário/semanal/mensal/etc. exigiriam saber a data certa).
            const periodoAnualInput = filtrosContainer.querySelector('input[name="periodoEvt"][value="anual"]');
            if (periodoAnualInput) periodoAnualInput.checked = true;
            atualizarSubFiltroInterno("anual");

            const selectAno = document.getElementById("sub-filtro-select-evt");
            if (selectAno) {
                if (![...selectAno.options].some(o => o.value === String(eventoSel.ano))) {
                    const opt = document.createElement("option");
                    opt.value = eventoSel.ano;
                    opt.textContent = eventoSel.ano;
                    selectAno.appendChild(opt);
                }
                selectAno.value = String(eventoSel.ano);
            }

            // 3. Recarrega a lista com os novos filtros
            await carregarDetalhesEventos(conteudoGeral);

            // 4. Rola até o card do evento encontrado
            const cardAlvo = conteudoGeral.querySelector(`.evento-card[data-idevento="${eventoSel.idevento}"]`);
            if (cardAlvo) {
                cardAlvo.scrollIntoView({ behavior: 'smooth', block: 'start' });
                cardAlvo.querySelector('.evento-body')?.classList.add('open');
            }

            // Limpa a busca pra já poder digitar a próxima
            input.value = "";
            lista.style.display = "none";
        };

        lista.innerHTML = "";
        eventosBusca.forEach(ev => {
            const chave = `${ev.nmevento}|${ev.ano}`;
            const nomeExibido = contagemNomeAno[chave] > 1
                ? `${ev.nmevento} (${ev.ano}) — Orç. ${ev.nrorcamento}`
                : `${ev.nmevento} (${ev.ano})`;

            const li = document.createElement("li");
            li.dataset.idorcamento = ev.idorcamento;
            li.dataset.nome = nomeExibido;
            li.textContent = nomeExibido;
            li.addEventListener("mousedown", (e) => {
                e.preventDefault(); // antes do blur, p/ registrar o clique
                selecionarEvento(ev);
            });
            lista.appendChild(li);
        });

        const filtrar = () => {
            const termo = input.value.toLowerCase().trim();
            lista.querySelectorAll("li").forEach((li) => {
                li.style.display = li.dataset.nome.toLowerCase().includes(termo) ? "block" : "none";
            });
            lista.style.display = "block";
        };
        input.addEventListener("input", filtrar);
        input.addEventListener("focus", () => { lista.style.display = "block"; });

        // Esconde ao clicar fora.
        document.addEventListener("mousedown", (e) => {
            if (e.target !== input && !lista.contains(e.target)) lista.style.display = "none";
        });
    })();

    atualizarSubFiltroInterno("mensal");
    return filtrosContainer;
}

async function carregarDetalhesEventos(targetEl) {
    const idempresa = localStorage.getItem("idempresa");
    const status = document.querySelector('input[name="statusEvt"]:checked')?.value;
    const periodo = document.querySelector('input[name="periodoEvt"]:checked')?.value;
    const subEl = document.getElementById("sub-filtro-data-evt") || document.getElementById("sub-filtro-select-evt");
    const valorSub = subEl ? subEl.value : "";

    targetEl.innerHTML = `<div class="loading-spinner">Carregando eventos...</div>`;

    try {
        // Define a rota baseada no filtro de Status
        const rota = status === "abertos" ? "/main/eventos-abertos" : "/main/eventos-fechados";
        
        const resp = await fetchComToken(`${rota}?periodo=${periodo}&valor=${valorSub}`, { headers: { idempresa } });
        const eventos = resp && typeof resp.json === 'function' ? await resp.json() : resp;

        // Reutiliza sua função de renderização existente para manter o visual dos cards
        renderizarEventos(targetEl, eventos);
        
    } catch (err) {
        console.error("Erro ao filtrar eventos:", err);
        targetEl.innerHTML = `<div class="erro-carregar">Erro ao buscar dados.</div>`;
    }
}

// FUNÇÃO AUXILIAR PARA EVITAR DUPLICAÇÃO DE CÓDIGO DE RENDERIZAÇÃO
function renderizarEventos(targetEl, eventos) {
  // 🛑 CORREÇÃO PARA O TypeError: Adiciona a checagem '!eventos'
  // Se for null/undefined, a condição é satisfeita e retorna a mensagem de erro.
  if (!eventos || !Array.isArray(eventos) || eventos.length === 0) {
    targetEl.innerHTML = `<div class="nenhum-evento">Nenhum evento encontrado</div>`;
    return;
  }

  targetEl.innerHTML = ""; // Limpa o loading

  // 🛠️ Melhoria: Usamos forEach com try...catch para isolar a renderização de cada evento.
  // Isso impede que um evento com dados malformados quebre o loop e a lista inteira (o seu problema dos 4->3).
  eventos.forEach((evt, index) => {
    try {
    // Mapeamos e criamos o card dentro do try/catch
    const eventoNormalizado = normalizarEvento(evt);
    const card = criarCard(eventoNormalizado);

    card.style.setProperty('--index', index);
        targetEl.appendChild(card);
    } catch (error) {
    // Caso um evento específico falhe (ex: JSON truncado), loga o erro e insere um alerta.
        console.error(`❌ Erro crítico ao renderizar evento ID ${evt.idevento || 'desconhecido'} (${evt.nmevento || 'Sem Nome'}).`, error);
        const erroCard = document.createElement("div");
        erroCard.className = "evento-card erro-render";
        erroCard.innerHTML = `⚠️ Erro ao carregar o evento <b>${evt.nmevento || 'Desconhecido'}</b> (ID: ${evt.idevento || '??'}).`;
        targetEl.appendChild(erroCard);
    }
  });
}

try {
    const idempresa = localStorage.getItem("idempresa");
    
    // 1. Busque o container correto (ajuste o ID 'container-eventos' para o seu ID real)
    const containerEventos = document.getElementById("container-eventos"); 

    if (!containerEventos) {
        return; // elemento estático removido; renderização agora é feita por mostrarEventosEmAberto()
    }

    const resp = await fetchComToken(`/main/eventos-abertos`, { headers: { idempresa } });
    const eventos = resp?.ok ? await resp.json() : resp;

    // Limpa o container antes de começar
    containerEventos.innerHTML = "";

    if (!Array.isArray(eventos)) {
        containerEventos.innerHTML = `<span class="erro-carregar">Erro ao carregar eventos</span>`;
        console.error("Erro backend: resposta inesperada", eventos);
        return;
    }

    if (!eventos.length) {
        containerEventos.innerHTML = `<span class="nenhum-evento">Nenhum evento em aberto 🎉</span>`;
        return;
    }

    // 2. Renderiza os cards no novo container
    eventos
        .map(evt => normalizarEvento(evt))
        .forEach(evt => {
            containerEventos.appendChild(criarCard(evt));
        });

} catch (err) {
    console.error("Erro ao carregar eventos em aberto:", err);
    // Verificação de segurança caso o erro ocorra antes de definir o container
    const containerEventos = document.getElementById("container-eventos");
    if (containerEventos) {
        containerEventos.innerHTML = `<span class="erro-carregar">Erro ao buscar eventos</span>`;
    }
}

  // ------------------------------------------------------------------
  // ======= FUNÇÕES AUXILIARES - REORGANIZADAS/SIMPLIFICADAS =======
  // ------------------------------------------------------------------

  // Movida a lógica de mapeamento para uma função separada para reuso
  function normalizarEvento(ev) {
    const inicio_realizacao = ev.dtinirealizacao || ev.dtinimontagem || ev.dtinimarcacao;
    const fim_realizacao = ev.dtfimrealizacao || ev.dtfimdesmontagem || ev.dtfimmontagem;
    const data_referencia = ev.dtinimontagem || ev.dtinirealizacao || ev.dtinimarcacao;
    const fim_evento = ev.dtfimdesmontagem || ev.dtfimrealizacao;

    // O backend já está retornando equipes_detalhes, vamos usá-lo se disponível
    let equipesDetalhes = Array.isArray(ev.equipes_detalhes) ? ev.equipes_detalhes : [];

    return {
        ...ev,
        data_referencia,
        inicio_realizacao,
        fim_realizacao,
        fim_evento,
        total_staff: ev.total_staff ?? ev.totalStaff ?? 0,
        equipes_detalhes: equipesDetalhes // Garante que o campo existe
    };
  }

  function parseDateLocal(dataISO) {
    if (!dataISO) return "";
    const data = new Date(dataISO);
    if (isNaN(data)) return dataISO; // se não for uma data válida
    // Usa o toLocaleDateString com fuso horário UTC para evitar problemas de offset
    return data.toLocaleDateString("pt-BR", { timeZone: "UTC" }); 
  }

  // Ajuste para criarCard para aceitar o formato de data no cálculo de dias
function parseDateForComparison(dateStr) {
    if (!dateStr) return null;
    if (typeof dateStr === "string") {
        // Regex simples para ISO date sem time
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            const [y, m, d] = dateStr.split("-").map(Number);
            // Cria a data no fuso zero (meia-noite UTC)
            return new Date(Date.UTC(y, m - 1, d)); 
        }
        // Tenta criar a data normal, mas ajusta para meia-noite local para comparação
        const d = new Date(dateStr);
        if (isNaN(d)) return null;
        d.setHours(0, 0, 0, 0);
        return d;
    }
    if (dateStr instanceof Date) {
        dateStr.setHours(0, 0, 0, 0);
        return dateStr;
    }
    return null;
}


  // ======= Função para criar card de evento =======
  // MANTIDA A LÓGICA DE ALERTA, MAS USANDO FUNÇÕES CORRIGIDAS PARA DATA
  function normalizarEvento(ev) {
    const inicio_realizacao = ev.dtinirealizacao || ev.dtinimontagem || ev.dtinimarcacao;
    const fim_realizacao = ev.dtfimrealizacao || ev.dtfimdesmontagem || ev.dtfimmontagem;
    const data_referencia = ev.dtinimontagem || ev.dtinirealizacao || ev.dtinimarcacao;
    const fim_evento = ev.dtfimdesmontagem || ev.dtfimrealizacao;

    let equipesDetalhes = Array.isArray(ev.equipes_detalhes) ? ev.equipes_detalhes : [];

    // 🛑 CORREÇÃO DE DADOS: Recalcula totais a partir dos detalhes das equipes para garantir consistência
    const totalVagasCalculado = equipesDetalhes.reduce((sum, item) => sum + (item.total_vagas || 0), 0);
    const totalStaffCalculado = equipesDetalhes.reduce((sum, item) => sum + (item.preenchidas || 0), 0);
    const vagasRestantesCalculado = totalVagasCalculado - totalStaffCalculado;

    return {
        ...ev,
        data_referencia,
        inicio_realizacao,
        fim_realizacao,
        fim_evento,

        // 🛑 Usa os totais calculados para o status principal
        total_vagas: totalVagasCalculado,
        total_staff: totalStaffCalculado,
        vagas_restantes: vagasRestantesCalculado,

        total_staff_api: ev.total_staff, // Mantém o valor original do backend para referência (opcional)
        equipes_detalhes: equipesDetalhes
    };
}

function criarCard(evt) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0); // Zera hora para comparação de dia

  const dataRef = parseDateForComparison(evt.data_referencia);
  const dataFimDesmontagem = parseDateForComparison(evt.fim_evento); // Usado para status
  const inicioRealizacao = parseDateForComparison(evt.inicio_realizacao);
  const fimRealizacao = parseDateForComparison(evt.fim_realizacao);

  // === Cálculo de percentual de staff preenchido ===
  const total = evt.total_vagas || 0;
  const preenchido = evt.total_staff || 0;
  const percentual = total > 0 ? Math.round((preenchido / total) * 100) : 0;

  let diasFaltam = null;
  if (dataRef) diasFaltam = Math.ceil((dataRef.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

  let alertaTexto = "";
  let alertaClasse = "";

  // === Lógica de Status do Evento (Sem alteração) ===
  if (dataFimDesmontagem && dataFimDesmontagem < hoje) {
    if (percentual === 0) {
        alertaTexto = "✔ Realizado sem staff";
        alertaClasse = "status-realizado-vermelho";
    } else if (percentual < 100) {
        alertaTexto = `✔ Realizado - Staff parcial (${percentual}% Cadastrado)`;
        alertaClasse = "status-realizado-amarelo";
    } else { // >= 100%
        alertaTexto = "✔ Realizado - Staff OK";
        alertaClasse = "status-realizado-verde";
    }

  } else if (inicioRealizacao && fimRealizacao && hoje >= inicioRealizacao && hoje <= fimRealizacao) {
    if (percentual === 0) {
        alertaTexto = "🚨 Sem staff — Realizando";
        alertaClasse = "status-realizando-vermelho";
    } else if (percentual < 100) {
        alertaTexto = `⚠️ Staff faltando - Realizando (${percentual}%)`;
        alertaClasse = "status-realizando-amarelo";
    } else { // >= 100%
        alertaTexto = "✅ Staff OK - Realizando";
        alertaClasse = "status-realizando-verde";
    }

  } else if (diasFaltam !== null && diasFaltam <= 5 && diasFaltam >= 0) {
    const diasText = `${diasFaltam} dia${diasFaltam !== 1 ? "s" : ""}`;

    if (percentual === 0) {
        alertaTexto = `🚨 Sem staff — faltam ${diasText}`;
        alertaClasse = "status-urgente-vermelho";
    } else if (percentual < 100) {
        alertaTexto = `⚠️ Staff faltando (${percentual}% Cadastrado) — faltam ${diasText} p/ realização`;
        alertaClasse = "status-urgente-amarelo";
    } else { // >= 100%
        alertaTexto = `✅ Staff OK — faltam ${diasText}`;
        alertaClasse = "status-urgente-verde";
    }

  } else {
    if (percentual === 0) {
        alertaTexto = "🚨 Sem staff";
        alertaClasse = "status-pendente-vermelho";
    } else if (percentual < 100) {
        alertaTexto = `⚠️ Staff faltando (${percentual}% Cadastrado)`;
        alertaClasse = "status-pendente-amarelo";
    } else { // >= 100%
        alertaTexto = "✅ Staff OK";
        alertaClasse = "status-pendente-verde";
    }
  }

  // Converte a data de Fim de Desmontagem para exibição (string formatada)
  const dataExibicaoFimDesmontagem = evt.fim_evento ? parseDateLocal(evt.fim_evento) : null;

  const nomeEvento = (dataFimDesmontagem && dataFimDesmontagem < hoje)
  ? `<del>${evt.nmevento || evt.nome || "Evento"}</del>`
  : `<strong>${evt.nmevento || evt.nome || "Evento"}</strong>`;

  const localEvento = evt.nmlocalmontagem || evt.local || "Local não informado";
  const clienteEvento = evt.nmfantasia || evt.cliente || evt.nmcliente || "Cliente não informado";

  const pavilhoes = evt.pavilhoes_nomes || [];
  let pavilhoesTexto = "Pavilhões não informados";

  if (pavilhoes.length > 0) {
  pavilhoesTexto = pavilhoes.join(", ");
  } else {
  // Se a lista de pavilhões estiver vazia, usa o local de montagem principal como fallback
  pavilhoesTexto = localEvento;
  }

  // 🌟 BLOCO DE PERÍODO ATUALIZADO: Montagem (Marcação) a Desmontagem
  let periodoTexto = "Período não definido";

  const inicioMarcacao = evt.dtinimarcacao ? parseDateLocal(evt.dtinimarcacao) : 'ND';
  const inicioRealizacaoFormatado = evt.dtinirealizacao ? parseDateLocal(evt.dtinirealizacao) : 'ND';
  const inicioMontagem = evt.dtinimontagem ? parseDateLocal(evt.dtinimontagem) : 'ND';
  const fimMontagem = evt.dtfimmontagem ? parseDateLocal(evt.dtfimmontagem) : 'ND';
  const inicioDesmontagem = evt.dtinidesmontagem ? parseDateLocal(evt.dtinidesmontagem) : 'ND';
  const fimRealizacaoFormatado = evt.dtfimrealizacao ? parseDateLocal(evt.dtfimrealizacao) : 'ND';
  const fimDesmontagem = evt.dtfimdesmontagem ? parseDateLocal(evt.dtfimdesmontagem) : (evt.fim_evento ? parseDateLocal(evt.fim_evento) : 'ND');

if (inicioMarcacao !== 'ND' || fimDesmontagem !== 'ND') {
  // Função auxiliar interna para formatar o intervalo
  const formatIntervalo = (ini, fim) => {
    if (ini === 'ND' && fim === 'ND') return 'ND';
    if (ini === fim || fim === 'ND') return ini;
    if (ini === 'ND') return fim;
    return `${ini} a ${fim}`;
  };

  const txtMontagem = formatIntervalo(inicioMontagem, fimMontagem);
  const txtRealizacao = formatIntervalo(inicioRealizacaoFormatado, fimRealizacaoFormatado);
  const txtDesmontagem = formatIntervalo(inicioDesmontagem, fimDesmontagem);

  periodoTexto = `🗓️ Marcação: ${inicioMarcacao} | Montagem: ${txtMontagem} | Realização: ${txtRealizacao} | Desmontagem: ${txtDesmontagem}`;
}

//   if (inicioMarcacao !== 'ND' || fimDesmontagem !== 'ND') {
//   periodoTexto = `🗓️ Marcação: ${inicioMarcacao} | Montagem: ${inicioMontagem} a ${fimMontagem} | Realização: ${inicioRealizacaoFormatado} a ${fimRealizacaoFormatado} | Desmontagem: ${inicioDesmontagem} a ${fimDesmontagem}`;
//   }
  // 🌟 FIM DO BLOCO DE PERÍODO ATUALIZADO

  // ======= Resumo das equipes/funções em uma linha (Sem alteração) =======
  const resumoEquipes = evt.resumoEquipes || "Nenhuma equipe cadastrada";


  const card = document.createElement("div");
  card.className = "evento-card";
  if (evt.idevento != null) card.dataset.idevento = evt.idevento;

  const headerEvt = document.createElement("div");
  headerEvt.className = "evento-header";
  headerEvt.innerHTML = `
  <div class="evt-info">
  <div class="evento-titulo-cliente">
  <div class="evento-nome">${nomeEvento}</div>
  <div class="evento-cliente">👤 ${clienteEvento}</div>
  </div>
  <span class="evento-status ${alertaClasse}">${alertaTexto}</span>
  </div>
  <div class="evt-local-periodo">
  <div class="evento-local" style="gap: 10px;"><i class="fa-solid fa-location-dot icon-location"></i> ${localEvento}</div>
  <div class="evento-local">Pavilhões: ${pavilhoesTexto}</div>
  </div>
  <div class="evt-periodo"><div class="evento-periodo">${periodoTexto}</div></div>
  `;

  const bodyEvt = document.createElement("div");
  bodyEvt.className = "evento-body";

  const resumoDiv = document.createElement("div");
  resumoDiv.className = "equipes-resumo";
  resumoDiv.textContent = resumoEquipes;
  bodyEvt.appendChild(resumoDiv);

  headerEvt.addEventListener("click", () => {
  bodyEvt.classList.toggle("open");
  });

  resumoDiv.addEventListener("click", () => {
  // Assumindo que abrirTelaEquipesEvento está disponível no escopo global
  if (typeof abrirTelaEquipesEvento === 'function') {
  abrirTelaEquipesEvento(evt);
  } else {
  console.warn("Função 'abrirTelaEquipesEvento' não está definida.");
  }
  });

  card.appendChild(headerEvt);
  card.appendChild(bodyEvt);
  return card;
  }
}

// async function abrirTelaEquipesEvento(evento) {

//   const painel = document.getElementById("painelDetalhes");
//   if (!painel) return;
//   painel.innerHTML = "";

//   const container = document.createElement("div");
//   container.className = "painel-equipes-evento";


//   // ===== HEADER =====
//   const header = document.createElement("div");
//   header.className = "header-equipes-evento";
//   header.innerHTML = `
//   <button class="btn-voltar" title="Voltar">←</button>
//   <div class="info-evento">
//     <h2>${evento.nmevento || "Evento sem nome"}</h2>
//     <p>📍 ${evento.local || evento.nmlocalmontagem || "Local não informado"}</p>
//     <p>📅 ${formatarPeriodo(evento.inicio_realizacao, evento.fim_realizacao)}</p>
//   </div>
//   `;
//   container.appendChild(header);

//   // ===== CORPO (LISTA DE EQUIPES) =====
//   const corpo = document.createElement("div");
//   corpo.className = "corpo-equipes";
//   corpo.innerHTML = `<div class="loading">Carregando equipes…</div>`;
//   container.appendChild(corpo);

//   // rodapé / controles
//   const rodape = document.createElement("div");
//   rodape.className = "rodape-equipes";
//   rodape.innerHTML = `
//     <button class="btn-voltar-rodape"> ← Voltar</button>
//     <button class="btn-relatorio">📄 Gerar Relatório</button>
//   `;
//   container.appendChild(rodape);

//   painel.appendChild(container);

//   // eventos de navegação
//   container.querySelector(".btn-voltar")?.addEventListener("click", mostrarEventosEmAberto);
//   container.querySelector(".btn-voltar-rodape")?.addEventListener("click", mostrarEventosEmAberto);
//   container.querySelector(".btn-relatorio")?.addEventListener("click", () => {
//     alert("Função de relatório ainda em desenvolvimento.");
//   });

//   // helper local
//   function formatarPeriodo(inicio, fim) {
//     const fmt = d => d ? new Date(d).toLocaleDateString("pt-BR") : "—";
//     return inicio && fim ? `${fmt(inicio)} a ${fmt(fim)}` : fmt(inicio || fim);
//   }

//   // utilitário simples para escapar texto antes de inserir no innerHTML
//   function escapeHtml(str) {
//     if (!str && str !== 0) return "";
//     return String(str)
//     .replace(/&/g, "&amp;")
//     .replace(/</g, "&lt;")
//     .replace(/>/g, "&gt;")
//     .replace(/"/g, "&quot;")
//     .replace(/'/g, "&#39;");
//   }

//   try {
//     const idevento = evento.idevento || evento.id || evento.id_evento;
//     const idempresa = localStorage.getItem("idempresa") || sessionStorage.getItem("idempresa");

//     if (!idevento || !idempresa) {
//         console.error("ID do evento ou empresa não encontrado:", { idevento, idempresa });
//         corpo.innerHTML = `<p class="erro">Erro: evento ou empresa não identificados.</p>`;
//         return;
//     }

//     const resp = await fetchComToken(`/main/detalhes-eventos-abertos?idevento=${idevento}&idempresa=${idempresa}`);

//     // tratar formatos possíveis do retorno (fetchComToken já retorna JSON)
//     let dados;
//     if (resp && typeof resp === "object" && (Array.isArray(resp) || resp.equipes !== undefined)) {
//         dados = resp;
//     } else if (resp && typeof resp === "object" && "ok" in resp) {
//         if (!resp.ok) throw new Error("Erro ao buscar detalhes das equipes.");
//         dados = await resp.json();
//     } else {
//         console.error("Resposta inválida ao buscar detalhes das equipes:", resp);
//         corpo.innerHTML = `<p class="erro">Erro ao carregar detalhes das equipes.</p>`;
//         return;
//     }

//     // normaliza array de equipes: suportar {equipes: [...] } ou array direto
//     const equipesRaw = Array.isArray(dados.equipes) ? dados.equipes : (Array.isArray(dados) ? dados : []);

//     // Adiciona idorcamento ao evento
//     evento.idorcamento = dados.idorcamento;

//     // CONSOLE 1: Dados Brutos do Backend
//     console.log("=================================================");
//     console.log(`[${evento.nmevento}] Dados Brutos (equipesRaw) do Backend:`);
//     console.log(equipesRaw);
//     console.log("=================================================");

//     if (!equipesRaw.length) {
//         corpo.innerHTML = `<p class="sem-equipes">Nenhuma equipe cadastrada para este evento.</p>`;
//         return;
//     }

        
//     const mapFuncoes = (funcoesArray) => {
//         if (!Array.isArray(funcoesArray)) return [];

//         return funcoesArray.map(f => {
//             // Mantemos os nomes originais do backend para não quebrar a função de detalhes
//             const qtd_orcamento = Number(f.qtd_orcamento ?? f.total ?? 0);
//             const qtd_cadastrada = Number(f.qtd_cadastrada ?? f.preenchidas ?? 0);
//             const qtd_pendente = Number(f.qtd_pendente ?? f.pendente ?? 0);
//             const diarias_consumidas = Number(f.diarias_consumidas ?? f.diarias ?? 0);

//             //const ativos    = qtd_cadastrada - qtd_pendente;
//             //const pendentes = qtd_pendente;

//             // Filtro de segurança: se não tem nada orçado nem nada cadastrado, ignora
//             // if (qtd_orcamento === 0 && qtd_cadastrada === 0) {
//             //     return null;
//             // }

//             //if (qtd_orcamento === 0 && ativos === 0 && pendentes === 0) return null;

//             if (qtd_orcamento === 0 && qtd_cadastrada === 0 && qtd_pendente === 0 && diarias_consumidas === 0) return null;

//             return {
//                 ...f, // Mantém todas as propriedades originais (idfuncao, dtini, etc)
//                 nome: f.nome ?? f.descfuncao ?? "Função",
//                 qtd_orcamento,
//                 qtd_cadastrada,
//                 qtd_pendente,
//                 diarias_consumidas,
//                 // Calculamos o concluído real (Confirmados >= Orçado)
//                 concluido: qtd_orcamento > 0 && (qtd_cadastrada - qtd_pendente) >= qtd_orcamento
//             };
//         }).filter(f => f !== null);
//     };

//     console.log("Mapeando e filtrando funções...", equipesRaw);

//     // converte e normaliza cada item
//     let equipes = equipesRaw.map(item => {
//     // Obter nome e ID da equipe
//     const equipeNome = item.equipe || item.nmequipe || item.nome || item.categoria || (`Equipe ${item.idequipe ?? ""}`);
//     const equipeId = item.idequipe;
//     let funcoesResult = [];

//     // se veio com funcoes já montadas (compatível com rota atual)
//     if (item.funcoes && Array.isArray(item.funcoes)) {
//         funcoesResult = mapFuncoes(item.funcoes);
//     }
//     // se veio como categorias agregadas (campo 'categorias' do backend)
//     else if (item.categorias && Array.isArray(item.categorias)) {
//         funcoesResult = mapFuncoes(item.categorias);
//     }
//     // item vindo como categoria direta
//     else if (item.categoria) {
//         const total = Number(item.total_vagas ?? item.total ?? item.qtd_orcamento ?? 0);
//         const preenchidas = Number(item.preenchidos ?? item.qtd_cadastrada ?? 0);

//         // Cria função apenas se houver vagas/staff
//         if (total > 0 || preenchidas > 0) { 
//             funcoesResult = [{
//                 idfuncao: item.idfuncao ?? null,
//                 nome: item.categoria || "Função",
//                 total,
//                 preenchidas,
//                 concluido: total > 0 && preenchidas >= total
//             }];
//         }
//     }
//     // fallback genérico (usando funcoes original, se houver)
//     else if (Array.isArray(item.funcoes)) {
//         funcoesResult = mapFuncoes(item.funcoes);
//     }

//     return {
//         equipe: equipeNome,
//         idequipe: equipeId,
//         funcoes: funcoesResult
//         };
//     })
//     // 🛑 NOVO FILTRO DE NOME: Remove o item que vem nomeado explicitamente como "Sem equipe"
//     .filter(eq => eq.equipe.toLowerCase() !== "sem equipe")
//     // FILTRO FINAL: Remove equipes que não contêm NENHUMA função relevante
//     .filter(eq => eq.funcoes && eq.funcoes.length > 0);

//     // CONSOLE 2: Dados Filtrados e Normalizados para Renderização
//     console.log("=================================================");
//     console.log(`[${evento.nmevento}] Dados Filtrados e Prontos (equipes):`);
//     console.log(equipes);
//     console.log("=================================================");


//     if (!equipes.length) {
//         corpo.innerHTML = `<p class="sem-equipes">Nenhuma equipe com vagas (Produto(s)) cadastrada para este evento.</p>`;
//         return;
//     }

//     // renderiza lista mantendo o visual atual mas usando total/preenchidas corretos
//     corpo.innerHTML = "";
//     equipes.forEach(eq => {

//         const equipeBox = document.createElement("div");
//         equipeBox.className = "equipe-box";

//         const totalFuncoes = eq.funcoes?.length || 0;
//         const concluidas = eq.funcoes?.filter(f => f.concluido)?.length || 0;
//         const perc = totalFuncoes > 0 ? Math.round((concluidas / totalFuncoes) * 100) : 0;    

//         const resumoItens = eq.funcoes?.map(f => {
//         const isCacheFechado = f.tem_cache_fechado === true || f.tem_cache_fechado === "true"
//                             || f.cache_fechado === true || f.cache_fechado === "true";

//         const qtdItensOrcados    = Number(f.qtd_orcamento ?? 0);
//         const qtdDiasOrcados     = Number(f.qtddias_orcamento ?? 1);
//         const pessoasCadastradas = Number(f.qtd_cadastrada ?? 0);
//         const diariasConsumidas  = Number(f.diarias_consumidas ?? 0);
//         const pendentes          = Number(f.qtd_pendente ?? 0);

//         const vagasOrcadas = isCacheFechado ? qtdItensOrcados : qtdItensOrcados * qtdDiasOrcados;
//         const disponiveis  = Math.max(0, vagasOrcadas - (diariasConsumidas + pendentes));
//         const confirmados  = pessoasCadastradas - pendentes;

//         let cor = "#4caf50";
//         if (qtdItensOrcados === 0)             cor = "#aaa";
//         else if (confirmados === 0)            cor = "#e53935";
//         else if (confirmados < qtdItensOrcados) cor = "#ff9800";

//         const sufixo = "diárias";
//         const textoPendentes = pendentes > 0 ? ` <span style="color:#e67e22">(+${pendentes} ⏳)</span>` : "";
//         const periodoVaga = formatarPeriodo(f.dtini_vaga, f.dtfim_vaga);

//         return `
//             <div style="display:flex; align-items:center; gap:8px; padding:4px 6px; border-bottom:1px solid rgba(255,255,255,0.07); font-size:0.82em;">
//                 <span style="width:10px; height:10px; border-radius:50%; background:${cor}; flex-shrink:0;"></span>
//                 <span style="flex:1; font-weight:600; color:#eee;">${escapeHtml(f.nome)}</span>
//                 <span style="color:var(--text-3); font-size:0.9em;">${periodoVaga}</span>
//                 <span style="color:#fff; font-weight:bold; min-width:60px; text-align:right;">
//                     ${diariasConsumidas}${textoPendentes} / ${vagasOrcadas} 
//                 </span>
//                 <span style="min-width:70px; text-align:right; font-weight:bold; color:${disponiveis > 0 ? '#ff9800' : '#4caf50'};">
//                     Disp: ${disponiveis} <small style="color:var(--text-2); font-weight:normal;">${sufixo}</small>
//                 </span>
                
//             </div>`;
//     }).join("");


//     equipeBox.innerHTML = `
//         <div class="equipe-header" role="button" tabindex="0">
//             <span class="equipe-nome">${escapeHtml(eq.equipe || "Equipe")}</span>
//             <span class="equipe-status">${concluidas}/${totalFuncoes} concluídas</span>
//         </div>
//         <div class="barra-progresso">
//             <div class="progresso" style="width:${perc}%;"></div>
//         </div>
//         <div class="equipe-resumo" style="padding:4px 0;">
//             ${resumoItens || "<div style='padding:6px;color:var(--text-3);'>Nenhuma função cadastrada</div>"}
//         </div>
//         <div class="equipe-actions">
//             <button type="button" class="ver-funcionarios-btn">
//                 <i class="fas fa-users"></i> Funcionários
//             </button>
//         </div>
//     `;

//         // clique / tecla Enter abre detalhes (passa evento original e equipe transformada)
//         const headerBtn = equipeBox.querySelector(".equipe-header");
//             headerBtn.addEventListener("click", () => abrirDetalhesEquipe(eq, evento));
//             headerBtn.addEventListener("keypress", (e) => {
//             if (e.key === "Enter") abrirDetalhesEquipe(eq, evento);
//         });


//         // 🛑 NOVO LISTENER: Botão 'Funcionários'
//         const funcionariosBtn = equipeBox.querySelector(".ver-funcionarios-btn");
//             if (funcionariosBtn) {
//                 // Passa o objeto equipe (eq) e o objeto evento (evento) para a função
//                 funcionariosBtn.addEventListener("click", (e) => {
//                 e.stopPropagation(); // Evita que o clique no botão ative o clique do header
//                 abrirListaFuncionarios(eq, evento); 
//                 });
//             }
//             // 🛑 FIM NOVO LISTENER

//             corpo.appendChild(equipeBox);
//         });

//     } catch (err) {
//         console.error("Erro ao buscar detalhes das equipes.", err);
//         const msg = (err && err.message) ? err.message : "Erro ao carregar detalhes das equipes.";
//         corpo.innerHTML = `<p class="erro">${escapeHtml(msg)}</p>`;
//     }
// }

async function abrirTelaEquipesEvento(evento) {

  const painel = document.getElementById("painelDetalhes");
  if (!painel) return;
  painel.innerHTML = "";

  const container = document.createElement("div");
  container.className = "painel-equipes-evento";


  // ===== HEADER =====
  const header = document.createElement("div");
  header.className = "header-equipes-evento";
  header.innerHTML = `
  <button class="btn-voltar" title="Voltar">←</button>
  <div class="info-evento">
    <h2>${evento.nmevento || "Evento sem nome"}</h2>
    <p style="display:flex; align-items:center; gap:16px; flex-wrap:wrap; margin:0;">
      <span>👤 Cliente: ${evento.nmfantasia || evento.cliente || evento.nmcliente || "Não informado"}</span>
      <span><i class="fa-solid fa-location-dot icon-location"></i> ${evento.local || evento.nmlocalmontagem || "Local não informado"}</span>
      <span>📅 ${formatarPeriodo(evento.inicio_realizacao, evento.fim_realizacao)}</span>
    </p>
  </div>
  `;
  container.appendChild(header);

  // ===== CORPO (LISTA DE EQUIPES) =====
  const corpo = document.createElement("div");
  corpo.className = "corpo-equipes";
  corpo.innerHTML = `<div class="loading">Carregando equipes…</div>`;
  container.appendChild(corpo);

  // rodapé / controles
  const rodape = document.createElement("div");
  rodape.className = "rodape-equipes";
  rodape.innerHTML = `
    <button class="btn-voltar-rodape"> ← Voltar</button>
    <button class="btn-relatorio">📄 Gerar Relatório</button>
  `;
  container.appendChild(rodape);

  painel.appendChild(container);

  // eventos de navegação
  container.querySelector(".btn-voltar")?.addEventListener("click", mostrarEventosEmAberto);
  container.querySelector(".btn-voltar-rodape")?.addEventListener("click", mostrarEventosEmAberto);
  container.querySelector(".btn-relatorio")?.addEventListener("click", () => {
    alert("Função de relatório ainda em desenvolvimento.");
  });

  // helper local
  function formatarPeriodo(inicio, fim) {
    const fmt = d => d ? new Date(d).toLocaleDateString("pt-BR") : "—";
    return inicio && fim ? `${fmt(inicio)} a ${fmt(fim)}` : fmt(inicio || fim);
  }

  // utilitário simples para escapar texto antes de inserir no innerHTML
  function escapeHtml(str) {
    if (!str && str !== 0) return "";
    return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
  }

  try {
    const idevento = evento.idevento || evento.id || evento.id_evento;
    const idempresa = localStorage.getItem("idempresa") || sessionStorage.getItem("idempresa");

    if (!idevento || !idempresa) {
        console.error("ID do evento ou empresa não encontrado:", { idevento, idempresa });
        corpo.innerHTML = `<p class="erro">Erro: evento ou empresa não identificados.</p>`;
        return;
    }

    const idmontagemEvento = evento.idmontagem || '';
    const resp = await fetchComToken(`/main/detalhes-eventos-abertos?idevento=${idevento}&idempresa=${idempresa}&idmontagem=${idmontagemEvento}`);

    // tratar formatos possíveis do retorno (fetchComToken já retorna JSON)
    let dados;
    if (resp && typeof resp === "object" && (Array.isArray(resp) || resp.equipes !== undefined)) {
        dados = resp;
    } else if (resp && typeof resp === "object" && "ok" in resp) {
        if (!resp.ok) throw new Error("Erro ao buscar detalhes das equipes.");
        dados = await resp.json();
    } else {
        console.error("Resposta inválida ao buscar detalhes das equipes:", resp);
        corpo.innerHTML = `<p class="erro">Erro ao carregar detalhes das equipes.</p>`;
        return;
    }

    // normaliza array de equipes: suportar {equipes: [...] } ou array direto
    const equipesRaw = Array.isArray(dados.equipes) ? dados.equipes : (Array.isArray(dados) ? dados : []);

    // Adiciona idorcamento ao evento
    evento.idorcamento = dados.idorcamento;

    // CONSOLE 1: Dados Brutos do Backend
    console.log("=================================================");
    console.log(`[${evento.nmevento}] Dados Brutos (equipesRaw) do Backend:`);
    console.log(equipesRaw);
    console.log("=================================================");

    if (!equipesRaw.length) {
        corpo.innerHTML = `<p class="sem-equipes">Nenhuma equipe cadastrada para este evento.</p>`;
        return;
    }

        
    // const mapFuncoes = (funcoesArray) => {
    //     if (!Array.isArray(funcoesArray)) return [];

    //     return funcoesArray.map(f => {
    //         const qtd_orcamento = Number(f.qtd_orcamento ?? f.total ?? 0);
    //         const qtd_cadastrada = Number(f.qtd_cadastrada ?? f.preenchidas ?? 0);
    //         const qtd_pendente = Number(f.qtd_pendente ?? f.pendente ?? 0);
    //         const diarias_consumidas = Number(f.diarias_consumidas ?? f.diarias ?? 0);
            
    //         // 🚀 CAPTURA DOS NOVOS CAMPOS DE DOBRAS DO BACKEND
    //         const dobras_pendentes = Number(f.dobras_pendentes ?? 0);
    //         const dobras_autorizadas = Number(f.dobras_autorizadas ?? 0);

    //         if (qtd_orcamento === 0 && qtd_cadastrada === 0 && qtd_pendente === 0 && diarias_consumidas === 0) return null;

    //         return {
    //             ...f, 
    //             nome: f.nome ?? f.descfuncao ?? "Função",
    //             qtd_orcamento,
    //             qtd_cadastrada,
    //             qtd_pendente,
    //             diarias_consumidas,
    //             dobras_pendentes,     // Injetado no objeto normalizado
    //             dobras_autorizadas,   // Injetado no objeto normalizado
    //             concluido: qtd_orcamento > 0 && (qtd_cadastrada - qtd_pendente) >= qtd_orcamento
    //         };
    //     }).filter(f => f !== null);
    // };

    const mapFuncoes = (funcoesArray) => {
        if (!Array.isArray(funcoesArray)) return [];

        return funcoesArray.map(f => {
            const qtd_orcamento = Number(f.qtd_orcamento ?? f.qtditens ?? f.total ?? 0);
            const qtd_cadastrada = Number(f.qtd_cadastrada ?? f.preenchidas ?? 0);
            const qtd_pendente = Number(f.qtd_pendente ?? f.pendente ?? 0);
            const diarias_consumidas = Number(f.diarias_consumidas ?? f.diarias ?? 0);            
            const dobras_pendentes = Number(f.dobras_pendentes ?? 0);
            const dobras_autorizadas = Number(f.dobras_autorizadas ?? 0);

            // Identifica se o cache está fechado
            const isCacheFechado = f.cache_fechado === true || f.cache_fechado === "true" ||
                                f.cachefechado === true || f.cachefechado === "true" ||
                                f.tem_cache_fechado === true || f.tem_cache_fechado === "true";

            // Obtém a quantidade de dias vinda do banco
            const qtdDiasOrcados = Number(f.qtddias ?? f.qtddias_orcamento ?? 1);

            // No cachê fechado o orçado real é qtddias (qtditens é irrelevante e pode vir 0)
            const orcadoBase = isCacheFechado ? qtdDiasOrcados : qtd_orcamento;
            if (orcadoBase === 0 && qtd_cadastrada === 0 && qtd_pendente === 0 && diarias_consumidas === 0) return null;

            // 🚀 NOVA REGRA DE CÁLCULO:
            // Se cache fechado for true: assume qtddias.
            // Se cache fechado for false: multiplica qtditens (qtd_orcamento) * qtddias.
            const vagasOrcadas = isCacheFechado
                ? qtdDiasOrcados
                : (f.total_diarias_orcadas != null ? Number(f.total_diarias_orcadas) : qtd_orcamento * qtdDiasOrcados);
            
            console.log(`[Nova Regra -> Função: ${f.nome ?? f.nome_funcao}] | Itens: ${qtd_orcamento} | Dias: ${qtdDiasOrcados} | CacheFechado: ${isCacheFechado} | Total Diárias Meta: ${vagasOrcadas}`);

            // Disp desconta consumo normal, pendentes normais e dobras pendentes
            const disponiveis = Math.max(0, vagasOrcadas - (diarias_consumidas + qtd_pendente + dobras_pendentes));

            return {
                ...f, 
                nome: f.nome ?? f.descfuncao ?? f.nome_funcao ?? "Função",
                qtd_orcamento,
                qtd_cadastrada,
                qtd_pendente,
                diarias_consumidas,
                dobras_pendentes,     
                dobras_autorizadas,   
                vagas_orcadas: vagasOrcadas,
                qtddias_orcamento: qtdDiasOrcados,
                is_cache_fechado: isCacheFechado,
                concluido: vagasOrcadas > 0 && disponiveis === 0
            };
        }).filter(f => f !== null);
    };

    console.log("Mapeando e filtrando funções...", equipesRaw);

    // converte e normaliza cada item
    let equipes = equipesRaw.map(item => {
    const equipeNome = item.equipe || item.nmequipe || item.nome || item.categoria || (`Equipe ${item.idequipe ?? ""}`);
    const equipeId = item.idequipe;
    let funcoesResult = [];

    if (item.funcoes && Array.isArray(item.funcoes)) {
        funcoesResult = mapFuncoes(item.funcoes);
    }
    else if (item.categorias && Array.isArray(item.categorias)) {
        funcoesResult = mapFuncoes(item.categorias);
    }
    else if (item.categoria) {
        const total = Number(item.total_vagas ?? item.total ?? item.qtd_orcamento ?? 0);
        const preenchidas = Number(item.preenchidos ?? item.qtd_cadastrada ?? 0);

        if (total > 0 || preenchidas > 0) { 
            funcoesResult = [{
                idfuncao: item.idfuncao ?? null,
                nome: item.categoria || "Função",
                total,
                preenchidas,
                concluido: total > 0 && preenchidas >= total
            }];
        }
    }
    else if (Array.isArray(item.funcoes)) {
        funcoesResult = mapFuncoes(item.funcoes);
    }

    return {
        equipe: equipeNome,
        idequipe: equipeId,
        funcoes: funcoesResult,
        saldo_fin_equipe: item.saldo_fin_equipe,
        vlr_orcado_equipe: item.vlr_orcado_equipe
        };
    })
    .filter(eq => eq.equipe.toLowerCase() !== "sem equipe")
    .filter(eq => eq.funcoes && eq.funcoes.length > 0);

    // CONSOLE 2: Dados Filtrados e Normalizados para Renderização
    console.log("=================================================");
    console.log(`[${evento.nmevento}] Dados Filtrados e Prontos (equipes):`);
    console.log(equipes);
    console.log("=================================================");


    if (!equipes.length) {
        corpo.innerHTML = `<p class="sem-equipes">Nenhuma equipe com vagas (Produto(s)) cadastrada para este evento.</p>`;
        return;
    }

    corpo.innerHTML = "";
    equipes.forEach(eq => {

        const equipeBox = document.createElement("div");
        equipeBox.className = "equipe-box";

        const totalFuncoes = eq.funcoes?.length || 0;
        const concluidas = eq.funcoes?.filter(f => f.concluido)?.length || 0;
        const perc = totalFuncoes > 0 ? Math.round((concluidas / totalFuncoes) * 100) : 0;

        // Totais da equipe em DIÁRIAS (soma de todas as funções) — mesma métrica exibida em
        // cada linha do resumo (ex: "14/14", "2/14"), que é cadastrado/orçado em diárias, não
        // em itens (vagas de pessoas). Somar itens aqui daria um número incoerente com as linhas.
        const totalDiariasOrcadas = eq.funcoes?.reduce((s, f) => s + (Number(f.vagas_orcadas) || 0), 0) || 0;
        const totalDiariasCadastradas = eq.funcoes?.reduce((s, f) => {
            return s + ((Number(f.diarias_consumidas) || 0) + (Number(f.dobras_pendentes) || 0));
        }, 0) || 0;

        const resumoItens = eq.funcoes?.map(f => {
        // const isCacheFechado = f.tem_cache_fechado === true || f.tem_cache_fechado === "true"
        //                     || f.cache_fechado === true || f.cache_fechado === "true";

        const isCacheFechado = f.is_cache_fechado === true;

        const qtdItensOrcados    = Number(f.qtd_orcamento ?? 0);
        const qtdDiasOrcados     = Number(f.qtddias_orcamento ?? 1);
        const pessoasCadastradas = Number(f.qtd_cadastrada ?? 0);
        const diariasConsumidas  = Number(f.diarias_consumidas ?? 0);
        const pendentes          = Number(f.qtd_pendente ?? 0);
        const dobrasPendentes    = Number(f.dobras_pendentes ?? 0);
        const aditivosPendentes  = Number(f.qtd_aditivo_pendente ?? 0);
        const limitePendentes    = Number(f.qtd_limite_pendente ?? 0);
        const aguardandoInclusao = Number(f.qtd_aguardando_inclusao ?? 0);
        const orcadoEquipe       = Number(eq.vlr_orcado_equipe ?? 0);
        const saldoEquipe        = Number(eq.saldo_fin_equipe ?? 0);
        const limiteFinExcedido  = orcadoEquipe > 0 && saldoEquipe <= 0;
        const custoDiaFuncao     = (f.vlrdiaria || 0) + (f.vlrajdctoalimentacao || 0) + (f.vlrajdctotransporte || 0);
        const limiteSaldoInferior = orcadoEquipe > 0 && saldoEquipe > 0 && custoDiaFuncao > 0 && saldoEquipe < custoDiaFuncao;


        // const vagasOrcadas = isCacheFechado ? qtdItensOrcados : qtdItensOrcados * qtdDiasOrcados;
        // const disponiveis  = Math.max(0, vagasOrcadas - (diariasConsumidas + pendentes));
        // const confirmados  = pessoasCadastradas - pendentes;

        // let cor = "#4caf50";
        // if (qtdItensOrcados === 0)             cor = "#aaa";
        // else if (confirmados === 0)            cor = "#e53935";
        // else if (confirmados < qtdItensOrcados) cor = "#ff9800";

        // const sufixo = "diárias";
        
        // let stringAlertasPendentes = "";
        // let mensagemTooltip = "";

        // if (pendentes > 0 && dobrasPendentes > 0) {
        //     // Caso 1: Ambos estão pendentes
        //     stringAlertasPendentes = ` (+${pendentes + dobrasPendentes} ⏳)`;
        //     mensagemTooltip = `${pendentes} vaga(s) e ${dobrasPendentes} diária(s) dobrada(s) aguardando liberação`;
        // } else if (pendentes > 0) {
        //     // Caso 2: Apenas vagas normais pendentes
        //     stringAlertasPendentes = ` (+${pendentes} ⏳)`;
        //     mensagemTooltip = `${pendentes} vaga(s) aguardando liberação`;
        // } else if (dobrasPendentes > 0) {
        //     // Caso 3: Apenas diárias dobradas pendentes
        //     stringAlertasPendentes = ` (+${dobrasPendentes} ⏳)`;
        //     mensagemTooltip = `${dobrasPendentes} diária(s) dobrada(s) aguardando liberação`;
        // }

        // const textoPendentes = stringAlertasPendentes !== "" 
        //     ? ` <span style="color:#e67e22; font-weight: bold;" title="${mensagemTooltip}">${stringAlertasPendentes}</span>` 
        //     : "";

        //const vagasOrcadas = isCacheFechado ? qtdItensOrcados : qtdItensOrcados * qtdDiasOrcados;

        const vagasOrcadas = f.vagas_orcadas;
        
        // 🚀 EXIBIÇÃO PRINCIPAL: Soma o que já está fixo com o que está reservado por dobra pendente
        const exibicaoDiariasVisuais = diariasConsumidas + dobrasPendentes;

        // Pendente staffeventos já são contados em diariasConsumidas (CTE inclui statusstaff='Pendente').
        // Somar pendentes aqui causaria double-counting. Apenas dobrasPendentes precisam ser somadas
        // porque dobras pendentes são excluídas do diariasConsumidas (só dobras Autorizadas entram lá).
        const disponiveis  = Math.max(0, vagasOrcadas - (diariasConsumidas + dobrasPendentes));
        const confirmados  = pessoasCadastradas - pendentes;

        // A bolinha reflete a mesma métrica exibida na linha (diárias: "X/Y" + "Disp: N diárias"),
        // não a de itens (pessoas) — senão diverge do que a própria linha mostra (e do critério de
        // "concluído" usado nos detalhes, que também é por diárias/disponiveis).
        let cor = "#4caf50";
        if (vagasOrcadas === 0)        cor = "#aaa";
        else if (confirmados === 0)    cor = "#e53935";
        else if (disponiveis > 0)      cor = "#ff9800";

        const sufixo = "diárias";
        
        // 🚀 TOOLTIPS DINÂMICOS (Mostra o status de forma transparente)
        let stringAlertasPendentes = "";
        let mensagemTooltip = "";

        if (pendentes > 0 && dobrasPendentes > 0) {
            stringAlertasPendentes = ` (+${pendentes + dobrasPendentes} ⏳)`;
            mensagemTooltip = `${pendentes} vaga(s) e ${dobrasPendentes} diária(s) dobrada(s) aguardando liberação`;
        } else if (pendentes > 0) {
            stringAlertasPendentes = ` (+${pendentes} ⏳)`;
            mensagemTooltip = `${pendentes} vaga(s) aguardando liberação`;
        } else if (dobrasPendentes > 0) {
            stringAlertasPendentes = ` (+${dobrasPendentes} ⏳)`;
            mensagemTooltip = `${dobrasPendentes} diária(s) dobrada(s) aguardando liberação`;
        }

        const textoPendentes = stringAlertasPendentes !== ""
            ? ` <span style="color:#e67e22; font-weight: bold;" title="${mensagemTooltip}">${stringAlertasPendentes}</span>`
            : "";

        const vagasUsadasEm = Array.isArray(f.vagas_usadas_em) ? f.vagas_usadas_em : [];
        const textoReaproveitadas = vagasUsadasEm.length > 0
            ? vagasUsadasEm.map(u => `⟳ ${u.qtd} diária${u.qtd > 1 ? 's' : ''} em <b>${escapeHtml(u.nome_funcao_destino)}</b>`).join(' | ')
            : '';

        const periodoVaga = formatarPeriodo(f.dtini_vaga, f.dtfim_vaga);

        // return `
        //     <div style="display:flex; align-items:center; gap:8px; padding:4px 6px; border-bottom:1px solid rgba(255,255,255,0.07); font-size:0.82em;">
        //         <span style="width:10px; height:10px; border-radius:50%; background:${cor}; flex-shrink:0;"></span>
        //         <span style="flex:1; font-weight:600; color:#eee;">${escapeHtml(f.nome)}</span>
        //         <span style="color:var(--text-3); font-size:0.9em;">${periodoVaga}</span>
        //         <span style="color:#fff; font-weight:bold; min-width:75px; text-align:right; white-space:nowrap;">
        //             ${diariasConsumidas}${textoPendentes} / ${vagasOrcadas}
        //         </span>
        //         <span style="min-width:70px; text-align:right; font-weight:bold; color:${disponiveis > 0 ? '#ff9800' : '#4caf50'};">
        //             Disp: ${disponiveis} <small style="color:var(--text-2); font-weight:normal;">${sufixo}</small>
        //         </span>

        //     </div>`;

        const labelTipoAditivo = limitePendentes > 0 && limitePendentes === aditivosPendentes
            ? 'limite excedido'
            : limitePendentes > 0
            ? 'vaga/limite excedido'
            : 'vaga excedida';
        const linhaLimiteFinanceiro = limiteFinExcedido && disponiveis > 0
            ? `<div style="padding:1px 6px 4px 24px; font-size:0.78em; color:var(--on-brand); font-weight:600; background:rgba(192,57,43,0.4); border-left:3px solid #c0392b; margin:0 4px;">
                   🚫 Limite financeiro da equipe excedido
               </div>`
            : '';
        const linhaLimiteSaldoInferior = limiteSaldoInferior && disponiveis > 0
            ? `<div style="padding:1px 6px 4px 24px; font-size:0.78em; color:var(--on-brand); font-weight:600; background:rgba(230,126,34,0.35); border-left:3px solid #e67e22; margin:0 4px;">
                   ⚠️ Limite financeiro inferior ao custo desta função
               </div>`
            : '';
        const linhaAditivo = aditivosPendentes > 0
            ? `<div style="padding:1px 6px 4px 24px; ${!pendentes && !textoReaproveitadas ? 'border-bottom:1px solid rgba(255,255,255,0.07);' : ''} font-size:0.78em; color:#fff; font-weight:600; background:rgba(192,57,43,0.55); border-left:3px solid #e74c3c; margin:0 4px;">
                   ⚠️ ${aditivosPendentes} solicitação${aditivosPendentes > 1 ? 'ões' : ''} pendente${aditivosPendentes > 1 ? 's' : ''} (${labelTipoAditivo})
               </div>`
            : '';

        // "Aguardando autorização" só faz sentido enquanto a solicitação em si está Pendente.
        // Se já foi Autorizada e só falta entrar nos itens do orçamento, o rótulo certo é outro —
        // senão o usuário lê "aguardando autorização" pra algo que já foi autorizado.
        const linhaAguardando = aditivosPendentes === 0 && aguardandoInclusao > 0
            ? `<div style="padding:1px 6px 4px 24px; ${!textoReaproveitadas ? 'border-bottom:1px solid rgba(255,255,255,0.07);' : ''} font-size:0.78em; color:#2980b9; font-style:italic;">
                   📋 ${aguardandoInclusao} aguardando inclusão no orçamento
               </div>`
            : (aditivosPendentes === 0 && pendentes > 0
                ? `<div style="padding:1px 6px 4px 24px; ${!textoReaproveitadas ? 'border-bottom:1px solid rgba(255,255,255,0.07);' : ''} font-size:0.78em; color:#e67e22; font-style:italic;">
                       ⏳ ${pendentes} aguardando autorização
                   </div>`
                : '');

        return `
            <div style="display:flex; align-items:center; gap:8px; padding:4px 6px; font-size:0.82em; ${!aditivosPendentes && !pendentes && !textoReaproveitadas ? 'border-bottom:1px solid rgba(255,255,255,0.07);' : ''}">
                <span style="width:10px; height:10px; border-radius:50%; background:${cor}; flex-shrink:0;"></span>
                <span style="flex:1; font-weight:600; color:#eee;">${escapeHtml(f.nome)}</span>
                <span style="color:#eee; font-size:0.9em;">${periodoVaga}</span>
                <span style="color:#fff; font-weight:bold; min-width:75px; text-align:right; white-space:nowrap;">
                    ${exibicaoDiariasVisuais} / ${vagasOrcadas}
                </span>
                <span style="min-width:70px; text-align:right; font-weight:bold; color:${disponiveis > 0 ? '#ff9800' : '#4caf50'};">
                    Disp: ${disponiveis} <small style="color:#eee; font-weight:normal;">${sufixo}</small>
                </span>
            </div>
            ${linhaLimiteFinanceiro}
            ${linhaLimiteSaldoInferior}
            ${linhaAditivo}
            ${linhaAguardando}
            ${textoReaproveitadas ? `<div style="padding:1px 6px 4px 24px; border-bottom:1px solid rgba(255,255,255,0.07); font-size:0.78em; color:#c39bd3; font-style:italic;">${textoReaproveitadas}</div>` : ''}`;
    }).join("");


    equipeBox.innerHTML = `
        <div class="equipe-header" role="button" tabindex="0">
            <span class="equipe-nome">${escapeHtml(eq.equipe || "Equipe")}</span>
            <span class="equipe-status">${concluidas}/${totalFuncoes} concluídas</span>
        </div>
        <div class="barra-progresso">
            <div class="progresso" style="width:${perc}%;"></div>
        </div>
        <div class="equipe-totais-resumo" style="display:flex; gap:16px; padding:4px 10px; font-size:0.8em; color:#eee; background:rgba(255,255,255,0.08); border-radius:4px; margin:4px 0;">
            <span><strong>Total Orçado:</strong> ${totalDiariasOrcadas} diárias</span>
            <span><strong>Total Cadastrado:</strong> ${totalDiariasCadastradas} diárias</span>
        </div>
        <div class="equipe-resumo" style="padding:4px 0;">
            ${resumoItens || "<div style='padding:6px;color:#aaa;'>Nenhuma função cadastrada</div>"}
        </div>
        <div class="equipe-actions">
            <button type="button" class="ver-funcionarios-btn">
                <i class="fas fa-users"></i> Funcionários
            </button>
        </div>
    `;

        const headerBtn = equipeBox.querySelector(".equipe-header");
            headerBtn.addEventListener("click", () => abrirDetalhesEquipe(eq, evento));
            headerBtn.addEventListener("keypress", (e) => {
            if (e.key === "Enter") abrirDetalhesEquipe(eq, evento);
        });


        const funcionariosBtn = equipeBox.querySelector(".ver-funcionarios-btn");
            if (funcionariosBtn) {
                funcionariosBtn.addEventListener("click", (e) => {
                e.stopPropagation(); 
                abrirListaFuncionarios(eq, evento); 
                });
            }

            corpo.appendChild(equipeBox);
        });

    } catch (err) {
        console.error("Erro ao buscar detalhes das equipes.", err);
        const msg = (err && err.message) ? err.message : "Erro ao carregar detalhes das equipes.";
        corpo.innerHTML = `<p class="erro">${escapeHtml(msg)}</p>`;
    }
}

/**
 * Abre a tela de lista de funcionários de uma equipe específica no painelDetalhes.
 * Substitui o Modal pela visualização integrada.
 * @param {object} equipe - Objeto da equipe com 'equipe' e 'idequipe'.
 * @param {object} evento - Objeto do evento com 'nmevento' e 'idevento'.
 */
// async function abrirListaFuncionarios(equipe, evento) {
//   const painel = document.getElementById("painelDetalhes");
//   if (!painel) return;
//   painel.innerHTML = "";

//   const container = document.createElement("div");
//   container.className = "painel-lista-funcionarios";

//   // --- Helpers internos ---
//   function escapeHtml(str) {
//     if (!str && str !== 0) return "";
//     return String(str)
//       .replace(/&/g, "&amp;")
//       .replace(/</g, "&lt;")
//       .replace(/>/g, "&gt;")
//       .replace(/"/g, "&quot;")
//       .replace(/'/g, "&#39;");
//   }

// //   const agruparFuncionariosPorFuncao = (lista) => {
// //     return lista.reduce((grupos, funcionario) => {
// //       const funcao = funcionario.funcao || 'Não Classificado';
// //       if (!grupos[funcao]) grupos[funcao] = [];
// //       grupos[funcao].push(funcionario);
// //       return grupos;
// //     }, {});
// //   };
// const agruparFuncionariosPorFuncao = (lista) => {
//     return lista.reduce((grupos, funcionario) => {
//       // 1. Agrupa na função nativa normalmente
//       const funcaoPrincipal = funcionario.funcao || 'Não Classificado';
//       if (!grupos[funcaoPrincipal]) grupos[funcaoPrincipal] = [];
//       grupos[funcaoPrincipal].push(funcionario);

//       // 2. Descobre se há dobras autorizadas lendo DIRETAMENTE de dentro do JSON dtdiariadobrada
//       let temDobraAutorizadaNoJson = false;
//       let nomeFuncaoDobra = null;

//       if (funcionario.dtdiariadobrada) {
//         try {
//           const dobrasJson = typeof funcionario.dtdiariadobrada === 'string' 
//             ? JSON.parse(funcionario.dtdiariadobrada) 
//             : funcionario.dtdiariadobrada;
          
//           if (Array.isArray(dobrasJson) && dobrasJson.length > 0) {
//             // Procura no array se existe o status "Autorizado" internamente
//             const dobraAtiva = dobrasJson.find(d => d.status === 'Autorizado');
            
//             if (dobraAtiva) {
//               temDobraAutorizadaNoJson = true;
              
//               // Mapeia o ID da função alvo para o nome correto do grupo
//               if (String(dobraAtiva.idfuncaodobra) === "48") {
//                 nomeFuncaoDobra = "FISCAL DE MARCAÇÃO";
//               } else if (String(dobraAtiva.idfuncaodobra) === "5") {
//                 nomeFuncaoDobra = "FISCAL DIURNO";
//               }
//             }
//           }
//         } catch (e) {
//           console.error("Erro ao processar dtdiariadobrada no agrupamento", e);
//         }
//       }

//       // 3. Se houver dobra ativa no JSON e for para um grupo diferente, faz a clonagem
//       if (temDobraAutorizadaNoJson && nomeFuncaoDobra && nomeFuncaoDobra !== funcaoPrincipal) {
//         if (!grupos[nomeFuncaoDobra]) grupos[nomeFuncaoDobra] = [];
        
//         const jaExiste = grupos[nomeFuncaoDobra].some(f => f.idfuncionario === funcionario.idfuncionario);
//         if (!jaExiste) {
//           // Clona o objeto e força uma flag indicando que este é o clone ativo da dobra
//           const funcionarioClonado = { ...funcionario, isItemDobraVisual: true, statusDobraForcado: 'Autorizado' };
//           grupos[nomeFuncaoDobra].push(funcionarioClonado);
//         }
//       }

//       return grupos;
//     }, {});
//   };

//   function formatarPeriodo(inicio, fim) {
//     const fmt = d => d ? new Date(d).toLocaleDateString("pt-BR") : "—";
//     return inicio && fim ? `${fmt(inicio)} a ${fmt(fim)}` : fmt(inicio || fim);
//   }

//   function cleanAndNormalize(str) {
//     if (!str && str !== 0) return "";
//     return String(str).normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
//   }

//   // --- Exportação CSV ---
//   function exportarParaCSV(data, nomeEquipe, nomeEvento) {
//     if (!data.length) return alert("Não há dados.");
//     const DELIMITADOR = ';';
//     const headers = ["Funcao", "Nome", "Setor", "Status Pagamento", "Valor Total", "Nivel Experiencia"];

//     const csvRows = data.map(row => {
//       const valor = row.vlrtotal ? String(row.vlrtotal).replace('.', ',') : '0';
//       return [
//         cleanAndNormalize(row.funcao),
//         cleanAndNormalize(row.nome),
//         cleanAndNormalize(row.setor),
//         cleanAndNormalize(row.status_pagamento),
//         valor,
//         cleanAndNormalize(row.nivelexperiencia)
//       ].join(DELIMITADOR);
//     });

//     const csvContent = "\uFEFF" + [headers.join(DELIMITADOR), ...csvRows].join('\n');
//     const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
//     const link = document.createElement("a");
//     link.href = URL.createObjectURL(blob);
//     link.download = `Lista_${cleanAndNormalize(nomeEquipe)}_${cleanAndNormalize(nomeEvento)}.csv`;
//     link.click();
//   }

//   // --- Construção do Layout ---
//   const header = document.createElement("div");
//   header.className = "header-equipes-evento";
//   header.innerHTML = `
//     <button class="btn-voltar-detalhe" title="Voltar">←</button>
//     <div class="info-evento">
//       <h2>${escapeHtml(equipe.equipe)}</h2>
//       <p><strong>Evento:</strong> ${escapeHtml(evento.nmevento)}</p>
//       <p>📅 ${formatarPeriodo(evento.inicio_realizacao, evento.fim_realizacao)}</p>
//     </div>
//   `;
//   container.appendChild(header);

//   const corpo = document.createElement("div");
//   corpo.className = "corpo-funcionarios";
//   corpo.innerHTML = `<div class="loading">Carregando funcionários...</div>`;
//   container.appendChild(corpo);

//   const rodape = document.createElement("div");
//   rodape.className = "rodape-equipes";
//   rodape.innerHTML = `
//     <button class="btn-voltar-rodape-detalhe"> ← Voltar</button>
//     <button class="btn-exportar-lista">📥 Exportar Lista</button>
//   `;
//   container.appendChild(rodape);
//   painel.appendChild(container);

//   // Eventos
//   const voltar = () => abrirTelaEquipesEvento(evento);
//   container.querySelector(".btn-voltar-detalhe").onclick = voltar;
//   container.querySelector(".btn-voltar-rodape-detalhe").onclick = voltar;

//   try {
//     const idevento = evento.idevento || evento.id;
//     const idequipe = equipe.idequipe;
//     const idempresa = localStorage.getItem("idempresa") || sessionStorage.getItem("idempresa");
//     const ano = new Date(evento.inicio_realizacao || new Date()).getFullYear();

//     const url = `/main/ListarFuncionarios?idEvento=${idevento}&idEquipe=${idequipe}&idempresa=${idempresa}&ano=${ano}`;
//     const funcionarios = await fetchComToken(url);
//     let listaFuncionariosCarregada = funcionarios;

//     container.querySelector(".btn-exportar-lista").onclick = () => exportarParaCSV(listaFuncionariosCarregada, equipe.equipe, evento.nmevento);

//     if (!funcionarios.length) {
//       corpo.innerHTML = `<p class="sem-funcionarios-msg">Nenhum funcionário cadastrado.</p>`;
//       return;
//     }

//     const grupos = agruparFuncionariosPorFuncao(funcionarios);
//     let html = '';

//     for (const funcao in grupos) {
//       html += `
//         <div class="funcionario-grupo-header">
//           <h4 class="grupo-titulo">${escapeHtml(funcao)}</h4>
//           <span class="grupo-badge">${grupos[funcao].length} Pessoa(s)</span>
//         </div>
//         <div class="grupo-divisor"></div>
//         <ul class="funcionario-lista">
//       `;


//     //   grupos[funcao].forEach(f => {
//     //             const mapaStatus = {
//     //         'Pago': 'status-pago',
//     //         'Rejeitado': 'status-rejeitado',
//     //         'Pendente': 'status-pendente'
//     //     };

//     //     const statusClass = mapaStatus[f.status_pagamento] || 'status-pendente';
//     //     const exibicaoDatas = formatarListaDatas(f.datas);  
        
//     //     // ✅ AQUI ESTÁ A MUDANÇA: NOME (SETOR)
//     //     const nomeComSetor = f.setor ? `${f.nome} (${f.setor})` : f.nome;
//     //     const isPendente = f.statusstaff === 'Pendente';

//     //     const obterInfoStatus = (status) => {
//     //         if (!status || status === 'Pendente') return { classe: 'status-pendente', label: 'Pendente' };
//     //         if (status === 'Pago') return { classe: 'status-pago', label: 'Pago' };
//     //         if (status === 'Pago50') return { classe: 'status-pago-parcial', label: '50%' };
//     //         if (status === 'Suspenso') return { classe: 'status-suspenso', label: 'Suspenso' };
//     //         if (status === 'Rejeitado') return { classe: 'status-rejeitado', label: 'Rejeitado' };
//     //         return { classe: 'status-pendente', label: status };
//     //     };

//     //     const ajuda = obterInfoStatus(f.status_ajuda_custo);
//     //     const cache = obterInfoStatus(f.status_cache);

//     //     // Variáveis de estilo condicional
//     //     const estiloItem = isPendente ? 'font-style: italic;' : '';
//     //     const estiloTexto = isPendente ? 'text-decoration: line-through; opacity: 0.5;' : '';
        
//     //     const badgeAutorizacao = isPendente 
//     //         ? `<span class="badge-aguardando">⏳ Aguardando Autorização</span>` 
//     //         : '';

//     //     html += `
//     //         <li class="funcionario-item" style="${estiloItem}">
//     //             <div class="funcionario-info-principal" style="margin: 0 0 10px 0;">
//     //                 <span class="funcionario-nome" style="${estiloTexto}">${escapeHtml(nomeComSetor)}</span>                        
//     //                 <div style="font-size: 0.8rem; color: var(--text-2);">
//     //                     📅 ${escapeHtml(exibicaoDatas)}
//     //                 </div>                        
//     //                 ${badgeAutorizacao}
//     //             </div>
                
//     //             <div class="status-group-horizontal" style="${isPendente ? 'opacity: 0.5;' : ''}">
//     //                 <div class="status-box" style="${estiloTexto}">
//     //                     <small>Ajuda:</small>
//     //                     <span class="funcionario-status-badge ${isPendente ? '' : ajuda.classe}">
//     //                         ${isPendente ? '—' : ajuda.label}
//     //                     </span>
//     //                 </div>
//     //                 <div class="status-box" style="${estiloTexto}">
//     //                     <small>Cachê:</small>
//     //                     <span class="funcionario-status-badge ${isPendente ? '' : cache.classe}">
//     //                         ${isPendente ? '—' : cache.label}
//     //                     </span>
//     //                 </div>
//     //             </div>                   
//     //         </li>                
//     //     `;
//     //     });
//    // 1. PRIMEIRAMENTE, AS ASSEGURAMOS AS VARIÁVEIS DE DOBRA LENDO O JSON DO FUNCIONÁRIO
// grupos[funcao].forEach(f => {
//     const mapaStatus = {
//         'Pago': 'status-pago',
//         'Rejeitado': 'status-rejeitado',
//         'Pendente': 'status-pendente'
//     };

//     const statusClass = mapaStatus[f.status_pagamento] || 'status-pendente';
//     const exibicaoDatas = formatarListaDatas(f.datas);  
    
//     // Verifica se esta linha atual é a linha clonada da dobra
//     const ehLinhaDeDobra = f.isItemDobraVisual === true;
//     let nomeComSetor = f.setor ? `${f.nome} (${f.setor})` : f.nome;
    
//     if (ehLinhaDeDobra) {
//         nomeComSetor += ` 🔃`; 
//     }

//     const isPendente = f.statusstaff === 'Pendente';

//     // 🚀 CORREÇÃO: Descobre os status reais olhando para dentro do JSON dtdiariadobrada
//     let temDobraAutorizada = false;
//     let temDobraPendente = false;

//     if (f.dtdiariadobrada) {
//         try {
//             const dobras = typeof f.dtdiariadobrada === 'string' 
//                 ? JSON.parse(f.dtdiariadobrada) 
//                 : f.dtdiariadobrada;

//             if (Array.isArray(dobras) && dobras.length > 0) {
//                 // Se houver qualquer uma autorizada no array, tratamos como ativa
//                 if (dobras.some(d => d.status === 'Autorizado')) {
//                     temDobraAutorizada = true;
//                 } else if (dobras.some(d => d.status === 'Pendente')) {
//                     temDobraPendente = true;
//                 }
//             }
//         } catch (e) {
//             console.error("Erro ao ler JSON de dobras no forEach:", e);
//         }
//     }

//     const obterInfoStatus = (status) => {
//         if (!status || status === 'Pendente') return { classe: 'status-pendente', label: 'Pendente' };
//         if (status === 'Pago') return { classe: 'status-pago', label: 'Pago' };
//         if (status === 'Pago50') return { classe: 'status-pago-parcial', label: '50%' };
//         if (status === 'Suspenso') return { classe: 'status-suspenso', label: 'Suspenso' };
//         if (status === 'Rejeitado') return { classe: 'status-rejeitado', label: 'Rejeitado' };
//         return { classe: 'status-pendente', label: status };
//     };

//     const ajuda = obterInfoStatus(f.status_ajuda_custo);
//     const cache = obterInfoStatus(f.status_cache);

//     // Estilos para funcionários pendentes de aprovação geral
//     const estiloItem = isPendente ? 'font-style: italic;' : '';
//     const estiloTexto = isPendente ? 'text-decoration: line-through; opacity: 0.5;' : '';
    
//     // Badge 1: Vaga Pendente
//     const badgeAutorizacao = isPendente 
//         ? `<span class="badge-aguardando" style="display: inline-block; font-size: 0.75rem; background: rgba(230, 126, 34, 0.1); color: #e67e22; padding: 2px 6px; border-radius: 4px; font-weight: bold; margin-top: 4px; margin-right: 6px;">⏳ Vaga Aguardando Autorização</span>` 
//         : '';

//     // Badge 2: Contexto da Diária Dobrada
//     let badgeDobra = '';
//     if (ehLinhaDeDobra) {
//         // Visual no grupo onde ele está cobrindo a dobra (Ex: FISCAL DE MARCAÇÃO)
//         badgeDobra = `<span class="badge-dobra-local" style="display: inline-block; font-size: 0.75rem; background: rgba(76, 175, 80, 0.15); color: #4caf50; padding: 2px 6px; border-radius: 4px; font-weight: bold; margin-top: 4px; margin-right: 6px;">✅ Atuando por Diária Dobrada</span>`;
//     } else if (temDobraAutorizada) {
//         // Visual verde no grupo de origem (Ex: FISCAL DIURNO) -> Agora vai mudar para verde!
//         badgeDobra = `<span class="badge-dobra-autorizada" style="display: inline-block; font-size: 0.75rem; background: rgba(76, 175, 80, 0.1); color: #4caf50; padding: 2px 6px; border-radius: 4px; font-weight: bold; margin-top: 4px; margin-right: 6px;">✅ Possui Diária Dobrada</span>`;
//     } else if (temDobraPendente) {
//         badgeDobra = `<span class="badge-dobra-pendente" style="display: inline-block; font-size: 0.75rem; background: rgba(230, 126, 34, 0.1); color: #e67e22; padding: 2px 6px; border-radius: 4px; font-weight: bold; margin-top: 4px; margin-right: 6px;">⏳ Dobra Aguardando Autorização</span>`;
//     }

//     html += `
//         <li class="funcionario-item" style="${estiloItem}">
//             <div class="funcionario-info-principal" style="margin: 0 0 10px 0; display: flex; flex-direction: column; align-items: flex-start;">
//                 <span class="funcionario-nome" style="${estiloTexto}">${escapeHtml(nomeComSetor)}</span>                        
//                 <div style="font-size: 0.8rem; color: var(--text-2); margin-top: 2px;">
//                     📅 ${escapeHtml(exibicaoDatas)}
//                 </div>                        
//                 <div class="badges-wrapper" style="display: flex; flex-wrap: wrap; gap: 2px;">
//                     ${badgeAutorizacao}
//                     ${badgeDobra}
//                 </div>
//             </div>
            
//             <div class="status-group-horizontal" style="${isPendente ? 'opacity: 0.5;' : ''}">
//                 <div class="status-box" style="${estiloTexto}">
//                     <small>Ajuda:</small>
//                     <span class="funcionario-status-badge ${isPendente ? '' : ajuda.classe}">
//                         ${isPendente ? '—' : ajuda.label}
//                     </span>
//                 </div>
//                 <div class="status-box" style="${estiloTexto}">
//                     <small>Cachê:</small>
//                     <span class="funcionario-status-badge ${isPendente ? '' : cache.classe}">
//                         ${isPendente ? '—' : cache.label}
//                     </span>
//                 </div>
//             </div>                   
//         </li>                
//     `;
// });
//         html += '</ul>';
//     }
//     corpo.innerHTML = html;

//   } catch (err) {
//     corpo.innerHTML = `<p class="erro">Erro ao carregar lista.</p>`;
//   }
// }

async function abrirListaFuncionarios(equipe, evento) {
  const painel = document.getElementById("painelDetalhes");
  if (!painel) return;
  painel.innerHTML = "";

  const container = document.createElement("div");
  container.className = "painel-lista-funcionarios";

  // --- Helpers internos ---
  function escapeHtml(str) {
    if (!str && str !== 0) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // 🚀 LOGICA DE AGRUPAMENTO DECLARADA ANTES DE QUALQUER EXECUÇÃO
  const agruparFuncionariosPorFuncao = (lista) => {
    return lista.reduce((grupos, funcionario) => {
      // 1. Agrupa na função nativa normalmente
      const funcaoPrincipal = funcionario.funcao || 'Não Classificado';
      if (!grupos[funcaoPrincipal]) grupos[funcaoPrincipal] = [];
      grupos[funcaoPrincipal].push(funcionario);

      // 2. Descobre se há dobras autorizadas lendo DIRETAMENTE de dentro do JSON dtdiariadobrada
      let temDobraAutorizadaNoJson = false;
      let nomeFuncaoDobra = null;

      if (funcionario.dtdiariadobrada) {
        try {
          const dobrasJson = typeof funcionario.dtdiariadobrada === 'string' 
            ? JSON.parse(funcionario.dtdiariadobrada) 
            : funcionario.dtdiariadobrada;
          
          if (Array.isArray(dobrasJson) && dobrasJson.length > 0) {
            // Procura no array se existe o status "Autorizado" internamente
            const dobraAtiva = dobrasJson.find(d => d.status === 'Autorizado');
            
            if (dobraAtiva) {
              temDobraAutorizadaNoJson = true;
              
              // Mapeia o ID da função alvo para o nome correto do grupo
              if (String(dobraAtiva.idfuncaodobra) === "48") {
                nomeFuncaoDobra = "FISCAL DE MARCAÇÃO";
              } else if (String(dobraAtiva.idfuncaodobra) === "5") {
                nomeFuncaoDobra = "FISCAL DIURNO";
              }
            }
          }
        } catch (e) {
          console.error("Erro ao processar dtdiariadobrada no agrupamento", e);
        }
      }

      // 3. Se houver dobra ativa no JSON e for para um grupo diferente, faz a clonagem
      if (temDobraAutorizadaNoJson && nomeFuncaoDobra && nomeFuncaoDobra !== funcaoPrincipal) {
        if (!grupos[nomeFuncaoDobra]) grupos[nomeFuncaoDobra] = [];
        
        const jaExiste = grupos[nomeFuncaoDobra].some(f => f.idfuncionario === funcionario.idfuncionario);
        if (!jaExiste) {
          // Clona o objeto e força uma flag indicando que este é o clone ativo da dobra
          const funcionarioClonado = { ...funcionario, isItemDobraVisual: true, statusDobraForcado: 'Autorizado' };
          grupos[nomeFuncaoDobra].push(funcionarioClonado);
        }
      }

      return grupos;
    }, {});
  };

  function formatarPeriodo(inicio, fim) {
    const fmt = d => d ? new Date(d).toLocaleDateString("pt-BR") : "—";
    return inicio && fim ? `${fmt(inicio)} a ${fmt(fim)}` : fmt(inicio || fim);
  }

  function cleanAndNormalize(str) {
    if (!str && str !== 0) return "";
    return String(str).normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  }

  // --- Exportação CSV ---
  function exportarParaCSV(data, nomeEquipe, nomeEvento) {
    if (!data.length) return alert("Não há dados.");
    const DELIMITADOR = ';';
    const headers = ["Funcao", "Nome", "CPF", "Setor",  "Valor Total", "Nivel Experiencia", "Datas Contratadas"];

    // Normaliza o array de datas contratadas (jsonb) em "dd/mm/aaaa, dd/mm/aaaa..."
    const formatarDatasContratadas = (datas) => {
      let lista = datas;
      if (typeof lista === "string") {
        try { lista = JSON.parse(lista); } catch { lista = [lista]; }
      }
      if (!Array.isArray(lista) || !lista.length) return "";
      return lista
        .map(d => {
          // Datas "YYYY-MM-DD" precisam ser lidas como local pra nao voltar 1 dia (fuso -03).
          const m = typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.exec(d);
          const dt = m ? new Date(+m[0].slice(0, 4), +m[0].slice(5, 7) - 1, +m[0].slice(8, 10)) : new Date(d);
          return isNaN(dt) ? String(d) : dt.toLocaleDateString("pt-BR");
        })
        .join(", ");
    };

    const csvRows = data.map(row => {
      const valor = row.vlrtotal ? String(row.vlrtotal).replace('.', ',') : '0';
      return [
        cleanAndNormalize(row.funcao),
        cleanAndNormalize(row.nome),
        cleanAndNormalize(row.cpf),
        cleanAndNormalize(row.setor),
        valor,
        cleanAndNormalize(row.nivelexperiencia),
        `"${formatarDatasContratadas(row.datas)}"`
      ].join(DELIMITADOR);
    });

    const csvContent = "\uFEFF" + [headers.join(DELIMITADOR), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Lista_${cleanAndNormalize(nomeEquipe)}_${cleanAndNormalize(nomeEvento)}.csv`;
    link.click();
  }

  // --- Construção do Layout ---
  const header = document.createElement("div");
  header.className = "header-equipes-evento";
  header.innerHTML = `
    <button class="btn-voltar-detalhe" title="Voltar">←</button>
    <div class="info-evento">
      <h2>${escapeHtml(equipe.equipe)}</h2>
      <p><strong>Evento:</strong> ${escapeHtml(evento.nmevento)}</p>
      <p>📅 ${formatarPeriodo(evento.inicio_realizacao, evento.fim_realizacao)}</p>
    </div>
  `;
  container.appendChild(header);

  const corpo = document.createElement("div");
  corpo.className = "corpo-funcionarios";
  corpo.innerHTML = `<div class="loading">Carregando funcionários...</div>`;
  container.appendChild(corpo);

  const rodape = document.createElement("div");
  rodape.className = "rodape-equipes";
  rodape.innerHTML = `
    <button class="btn-voltar-rodape-detalhe"> ← Voltar</button>
    <button class="btn-exportar-lista">📥 Exportar Lista</button>
  `;
  container.appendChild(rodape);
  painel.appendChild(container);

  // Eventos
  const voltar = () => abrirTelaEquipesEvento(evento);
  container.querySelector(".btn-voltar-detalhe").onclick = voltar;
  container.querySelector(".btn-voltar-rodape-detalhe").onclick = voltar;

  try {
    const idevento = evento.idevento || evento.id;
    const idequipe = equipe.idequipe;
    const idempresa = localStorage.getItem("idempresa") || sessionStorage.getItem("idempresa");
    const ano = new Date(evento.inicio_realizacao || new Date()).getFullYear();

    const url = `/main/ListarFuncionarios?idEvento=${idevento}&idEquipe=${idequipe}&idempresa=${idempresa}&ano=${ano}`;
    const funcionarios = await fetchComToken(url);
    let listaFuncionariosCarregada = funcionarios;

    container.querySelector(".btn-exportar-lista").onclick = () => exportarParaCSV(listaFuncionariosCarregada, equipe.equipe, evento.nmevento);

    if (!funcionarios.length) {
      corpo.innerHTML = `<p class="sem-funcionarios-msg">Nenhum funcionário cadastrado.</p>`;
      return;
    }

    // Agora sim! Executa com a função já mapeada na memória da aplicação
    const grupos = agruparFuncionariosPorFuncao(funcionarios);
    let html = '';

    for (const funcao in grupos) {
      html += `
        <div class="funcionario-grupo-header">
          <h4 class="grupo-titulo">${escapeHtml(funcao)}</h4>
          <span class="grupo-badge">${grupos[funcao].length} Pessoa(s)</span>
        </div>
        <div class="grupo-divisor"></div>
        <ul class="funcionario-lista">
      `;

      grupos[funcao].forEach(f => {
        const mapaStatus = {
            'Pago': 'status-pago',
            'Rejeitado': 'status-rejeitado',
            'Pendente': 'status-pendente'
        };

        const statusClass = mapaStatus[f.status_pagamento] || 'status-pendente';
       // const exibicaoDatas = formatarListaDatas(f.datas);  
        
        // Verifica se esta linha atual é a linha clonada da dobra
        const ehLinhaDeDobra = f.isItemDobraVisual === true;

        let exibicaoDatas = '';
        if (ehLinhaDeDobra && f.dtdiariadobrada) {
            try {
                const dobras = typeof f.dtdiariadobrada === 'string' 
                    ? JSON.parse(f.dtdiariadobrada) 
                    : f.dtdiariadobrada;
                
                if (Array.isArray(dobras) && dobras.length > 0) {
                    // Pegamos apenas as datas do JSON que pertencem a esta função específica da dobra
                    // Nota: Se no seu JSON a data estiver em um array (ex: d.datas), use d.datas. 
                    // Se for um campo string único de data (ex: d.data), colocamos em um array [d.data]
                    const datasDobra = dobras
                        .filter(d => d.status === 'Autorizado')
                        .flatMap(d => d.datas ? d.datas : (d.data ? [d.data] : []));
                    
                    if (datasDobra.length > 0) {
                        exibicaoDatas = formatarListaDatas(datasDobra);
                    } else {
                        exibicaoDatas = formatarListaDatas(f.datas); // Fallback caso não ache
                    }
                } else {
                    exibicaoDatas = formatarListaDatas(f.datas);
                }
            } catch (e) {
                console.error("Erro ao extrair datas específicas da dobra:", e);
                exibicaoDatas = formatarListaDatas(f.datas);
            }
        } else {
            // Se for a linha normal/nativa do funcionário, mostra todas as datas dele
            exibicaoDatas = formatarListaDatas(f.datas);  
        }
        
        let nomeComSetor = f.setor ? `${f.nome} (${f.setor})` : f.nome;
        
        if (ehLinhaDeDobra) {
            nomeComSetor += ` 🔃`; 
        }        

        const isPendente = f.statusstaff === 'Pendente';

        // Descobre os status reais olhando para dentro do JSON dtdiariadobrada
// --- PROCESSAMENTO DETALHADO DAS DOBRAS (CONTAGEM E DATAS) ---
        // --- PROCESSAMENTO DETALHADO DAS DOBRAS (CONTAGEM E DATAS) ---
        let temDobraAutorizada = false;
        let temDobraPendente = false;
        
        let totalAutorizadas = 0;
        let totalPendentes = 0;
        let datasAutorizadasArray = [];
        let datasPendentesArray = []; // ✅ GARANTIDO: Declarado aqui para não dar ReferenceError

        if (f.dtdiariadobrada) {
            try {
                const dobras = typeof f.dtdiariadobrada === 'string' 
                    ? JSON.parse(f.dtdiariadobrada) 
                    : f.dtdiariadobrada;

                if (Array.isArray(dobras) && dobras.length > 0) {
                    dobras.forEach(d => {
                        if (d.status === 'Autorizado') {
                            temDobraAutorizada = true;
                            totalAutorizadas++;
                            // Captura as datas dessa dobra autorizada
                            const de = d.datas ? d.datas : (d.data ? [d.data] : []);
                            datasAutorizadasArray.push(...de);
                        } else if (d.status === 'Pendente') {
                            temDobraPendente = true;
                            totalPendentes++;
                            // Captura as datas dessa dobra que está pendente
                            const dp = d.datas ? d.datas : (d.data ? [d.data] : []);
                            datasPendentesArray.push(...dp);
                        }
                    });
                }
            } catch (e) {
                console.error("Erro ao ler JSON de dobras para as badges:", e);
            }
        }

        const obterInfoStatus = (status) => {
            if (!status || status === 'Pendente') return { classe: 'status-pendente', label: 'Pendente' };
            if (status === 'Pago') return { classe: 'status-pago', label: 'Pago' };
            if (status === 'Pago50') return { classe: 'status-pago-parcial', label: '50%' };
            if (status === 'Suspenso') return { classe: 'status-suspenso', label: 'Suspenso' };
            if (status === 'Rejeitado') return { classe: 'status-rejeitado', label: 'Rejeitado' };
            return { classe: 'status-pendente', label: status };
        };

        const ajuda = obterInfoStatus(f.status_ajuda_custo);
        const cache = obterInfoStatus(f.status_cache);

        // Estilos para funcionários pendentes de aprovação geral
        const estiloItem = isPendente ? 'font-style: italic;' : '';
        const estiloTexto = isPendente ? 'text-decoration: line-through; opacity: 0.5;' : '';
        
        // Badge 1: Vaga Pendente
        const badgeAutorizacao = isPendente 
            ? `<span class="badge-aguardando" style="display: inline-block; font-size: 0.75rem; background: rgba(230, 126, 34, 0.1); color: #e67e22; padding: 2px 6px; border-radius: 4px; font-weight: bold; margin-top: 4px; margin-right: 6px;">⏳ Vaga Aguardando Autorização</span>` 
            : '';

        // Badge 2: Contexto da Diária Dobrada com contadores e datas dinâmicas
        let badgeDobra = '';
        
        if (ehLinhaDeDobra) {
            // Na linha clonada onde ele atua, mantém o indicativo visual fixo do grupo alvo
            badgeDobra = `<span class="badge-dobra-local" style="display: inline-block; font-size: 0.75rem; background: rgba(76, 175, 80, 0.15); color: #4caf50; padding: 2px 6px; border-radius: 4px; font-weight: bold; margin-top: 4px; margin-right: 6px;">✅ Atuando por Diária Dobrada</span>`;
        } else {
            // Na linha nativa/principal do funcionário, monta as informações acumuladas do JSON
            let badgesAcumuladas = [];

            if (temDobraAutorizada) {
                // Formata as datas coletadas (ex: "12/05" ou "12/05, 13/05")
                const textoDatasAut = datasAutorizadasArray.length > 0 ? ` ${formatarListaDatas(datasAutorizadasArray)}` : '';
                
                // Adiciona o contador se o funcionário tiver mais de uma dobra aprovada
                const prefixoQtdAut = totalAutorizadas > 1 ? `(${totalAutorizadas}) ` : '';
                
                badgesAcumuladas.push(`<span class="badge-dobra-autorizada" style="display: inline-block; font-size: 0.75rem; background: rgba(76, 175, 80, 0.1); color: #4caf50; padding: 2px 6px; border-radius: 4px; font-weight: bold; margin-top: 4px; margin-right: 6px;">✅ ${prefixoQtdAut}Possui Diária Dobrada${textoDatasAut}</span>`);
            }

            if (temDobraPendente) {
                // Formata e garante a exibição das datas pendentes aqui!
                const textoDatasPen = datasPendentesArray.length > 0 ? ` ${formatarListaDatas(datasPendentesArray)}` : '';
                
                // Adiciona o contador apenas se houver mais de uma dobra aguardando
                const prefixoQtdPen = totalPendentes > 1 ? `(${totalPendentes}) ` : '';
                
                badgesAcumuladas.push(`<span class="badge-dobra-pendente" style="display: inline-block; font-size: 0.75rem; background: rgba(230, 126, 34, 0.1); color: #e67e22; padding: 2px 6px; border-radius: 4px; font-weight: bold; margin-top: 4px; margin-right: 6px;">⏳ ${prefixoQtdPen}Dobra Aguardando Autorização${textoDatasPen}</span>`);
            }

            badgeDobra = badgesAcumuladas.join('');
        }

        html += `
            <li class="funcionario-item" style="${estiloItem}">
                <div class="funcionario-info-principal" style="margin: 0 0 10px 0; display: flex; flex-direction: column; align-items: flex-start;">
                    <span class="funcionario-nome" style="${estiloTexto}">${escapeHtml(nomeComSetor)}</span>                        
                    <div style="font-size: 0.8rem; color: var(--text-2); margin-top: 2px;">
                        📅 ${escapeHtml(exibicaoDatas)}
                    </div>                        
                    <div class="badges-wrapper" style="display: flex; flex-wrap: wrap; gap: 2px;">
                        ${badgeAutorizacao}
                        ${badgeDobra}
                    </div>
                </div>
                
                <div class="status-group-horizontal" style="${isPendente ? 'opacity: 0.5;' : ''}">
                    <div class="status-box" style="${estiloTexto}">
                        <small>Ajuda:</small>
                        <span class="funcionario-status-badge ${isPendente ? '' : ajuda.classe}">
                            ${isPendente ? '—' : ajuda.label}
                        </span>
                    </div>
                    <div class="status-box" style="${estiloTexto}">
                        <small>Cachê:</small>
                        <span class="funcionario-status-badge ${isPendente ? '' : cache.classe}">
                            ${isPendente ? '—' : cache.label}
                        </span>
                    </div>
                </div>                   
            </li>                
        `;
      });
      html += '</ul>';
    }
    corpo.innerHTML = html;

  } catch (err) {
    console.error(err);
    corpo.innerHTML = `<p class="erro">Erro ao carregar lista.</p>`;
  }
}

function formatarListaDatas(datas) {
  if (!datas || (Array.isArray(datas) && datas.length === 0)) return "—";
  
  // Garante que 'datas' seja tratado como array (o JSONB do Postgres já vem como array no JS)
  const lista = Array.isArray(datas) ? datas : JSON.parse(datas);
  
  return lista
    .map(d => {
      const dataObj = new Date(d + 'T00:00:00'); // T00:00:00 evita erros de fuso horário
      return dataObj.toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit' });
    })
    .join(', ');
}

function formatarPeriodo(inicio, fim) {
  const fmt = d => d ? new Date(d).toLocaleDateString("pt-BR") : "—";
  return inicio && fim ? `${fmt(inicio)} a ${fmt(fim)}` : fmt(inicio || fim);
}


function abrirDetalhesEquipe(equipe, evento) {
  const painel = document.getElementById("painelDetalhes");
  if (!painel) return;
  painel.innerHTML = "";

  const container = document.createElement("div");
  container.className = "painel-equipes-evento";

  const totalFuncoes = equipe.funcoes?.length || 0;
  // Modificado temporariamente para refletir a nova checagem real abaixo
  const concluidas = equipe.funcoes?.filter(f => f.concluido && !(Number(f.vagas_disponiveis ?? 1) > 0))?.length || 0;

  // Funções de utilidade
  function escapeHtml(str) {
    if (!str && str !== 0) return "";
    return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
  }

  function formatarPeriodo(inicio, fim) {
    const fmt = d => d ? new Date(d).toLocaleDateString("pt-BR") : "—";
    return inicio && fim ? `${fmt(inicio)} a ${fmt(fim)}` : fmt(inicio || fim);
  }

  const voltarParaEquipes = () => abrirTelaEquipesEvento(evento);

  // ===== HEADER =====
  const header = document.createElement("div");
  header.className = "header-equipes-evento";
  header.innerHTML = `
    <button class="btn-voltar" title="Voltar">←</button>
    <div class="info-evento">
      <h2>${escapeHtml(equipe.equipe || equipe.nome || "Equipe")}</h2>
      <p>${escapeHtml(evento.nmevento || "Evento sem nome")} — ${concluidas}/${totalFuncoes} concluídas</p>
      <p style="display:flex; align-items:center; gap:16px; flex-wrap:wrap; margin:0;">
        <span><i class="fa-solid fa-location-dot icon-location"></i> ${escapeHtml(evento.nmlocalmontagem || evento.local || "Local não informado")}</span>
        <span>👤 Cliente: ${escapeHtml(evento.nmfantasia || evento.cliente || evento.nmcliente || "Não informado")}</span>
      </p>
    </div>`;
  container.appendChild(header);

  // Cabeçalho "cad/orc" das colunas de itens e diárias — uma linha só, acima de toda a lista
  // (não dentro da primeira função, senão empurra só aquela linha e desalinha com as demais).
  const headerColunas = document.createElement("div");
  headerColunas.style = "display:flex; align-items:center; width:100%;";
  headerColunas.innerHTML = `
    <div style="flex:1; padding-right:15px; min-width:200px;"></div>
    <div style="flex: 0 0 auto; text-align: right; display: flex; flex-direction: row; align-items: flex-start; font-size: 0.9em; gap: 20px; margin-left: auto; margin-right: 20px;">
        <div style="min-width: 95px; width: 95px; text-align: left; font-size: 15px; color: var(--text-3);">cad/orc</div>
        <div style="min-width: 100px; width: 100px; text-align: left; font-size: 15px; color: var(--text-3);">cad/orc</div>
        <div style="min-width: 110px; width: 110px;"></div>
    </div>
    <div style="flex: 0 0 120px;"></div>
  `;
  container.appendChild(headerColunas);

  // Painel financeiro ocultado — aviso inline por função quando saldo <= 0

  // ===== LISTA DE FUNÇÕES =====
  const lista = document.createElement("ul");
  lista.className = "funcoes-lista";

  // Totais da equipe (soma de todas as funções) — pra saber de relance quantos itens
  // no total foram orçados x quantos já foram cadastrados, sem precisar somar linha a linha.
  let totalItensOrcados = 0;
  let totalItensCadastrados = 0;
  // Totais em DIÁRIAS (cadastrado/orçado) — vão pro rodapé da lista, no formato TOTAL: cad/orc.
  let totalDiariasOrcadas = 0;
  let totalDiariasCadastradas = 0;

  (equipe.funcoes || []).forEach((func, idxFuncao) => {
    // ----------------------------------------------------
    // 🎯 1. CAPTURA DE DADOS REAIS E SEGURANÇA DE CHAVES
    // ----------------------------------------------------
    const nomeFuncao = func.funcao || func.descfuncao || func.nome || func.nmfuncao || "Função";
    const isCacheFechado = func.cache_fechado === true || func.cache_fechado === "true"
                        || func.tem_cache_fechado === true || func.tem_cache_fechado === "true";

    const qtdItensOrcados = Number(func.qtd_orcamento ?? func.qtditens ?? 0); 
    const qtdDiasOrcados = Number(func.qtddias_orcamento ?? func.qtddias ?? 1); 

    console.log(`Processando função "${nomeFuncao}": isCacheFechado=${isCacheFechado}, qtdItensOrcados=${qtdItensOrcados}, qtdDiasOrcados=${qtdDiasOrcados}`);

    const pessoasCadastradas = Number(func.qtd_cadastrada_pessoas ?? func.pessoas_cadastradas ?? func.qtd_cadastrada ?? func.total_pessoas ?? 0);
    const diáriasConsumidas = Number(func.diarias_consumidas ?? func.vagas_consumidas ?? func.total_diarias ?? func.diarias ?? 0);
    const pendentes = Number(func.qtd_pendente ?? func.pendentes ?? 0);
    const aditivosPendentes = Number(func.qtd_aditivo_pendente ?? 0);
    const limitePendentes   = Number(func.qtd_limite_pendente ?? 0);
    const aguardandoInclusao = Number(func.qtd_aguardando_inclusao ?? 0);
    const orcadoEquipe      = Number(equipe.vlr_orcado_equipe ?? 0);
    const saldoEquipe       = Number(equipe.saldo_fin_equipe ?? 0);
    const limiteFinExcedido = orcadoEquipe > 0 && saldoEquipe <= 0;
    const custoDiaFuncao     = (func.vlrdiaria || 0) + (func.vlrajdctoalimentacao || 0) + (func.vlrajdctotransporte || 0);
    const limiteSaldoInferior = orcadoEquipe > 0 && saldoEquipe > 0 && custoDiaFuncao > 0 && saldoEquipe < custoDiaFuncao;

    // Captura as dobras pendentes e autorizadas enviadas pelo backend
    const dobrasPendentes = Number(func.dobras_pendentes ?? 0);
    const dobrasAutorizadas = Number(func.dobras_autorizadas ?? 0);

    // ----------------------------------------------------
    // 🎯 2. A MÁGICA DA MATEMÁTICA DAS METAS
    // ----------------------------------------------------
    let itensOrcados = 0;
    let vagasOrcadas = 0;

    if (isCacheFechado) {
        vagasOrcadas = qtdDiasOrcados;
        itensOrcados = qtdItensOrcados;
    } else {
        itensOrcados = qtdItensOrcados;
        vagasOrcadas = func.total_diarias_orcadas != null
            ? Number(func.total_diarias_orcadas)
            : qtdItensOrcados * qtdDiasOrcados;
    }

    totalItensOrcados += itensOrcados;
    totalItensCadastrados += pessoasCadastradas;

    // ----------------------------------------------------
    // 🎯 3. CONFIRMADOS REAIS E SALDO DISPONÍVEL
    // ----------------------------------------------------
    const exibicaoDiariasVisuais = diáriasConsumidas + dobrasPendentes;
    const disponiveis = Math.max(0, vagasOrcadas - (diáriasConsumidas + dobrasPendentes));

    totalDiariasOrcadas += vagasOrcadas;
    totalDiariasCadastradas += exibicaoDiariasVisuais;
    
    // 🚀 CORREÇÃO PRINCIPAL: Mesmo que venha true do banco, se houver diárias disponíveis, não está concluído!
    // const concluido = (func.concluido === true) && (disponiveis === 0);
    //const bloqueadoPorPendente = !concluido && diáriasConsumidas >= vagasOrcadas && pendentes > 0;
    const concluido = (func.concluido === true) && (disponiveis === 0) && (pendentes === 0) && (dobrasPendentes === 0);
    const bloqueadoPorPendente = !concluido && pendentes > 0 && disponiveis === 0;

    // ----------------------------------------------------
    // 🎯 4. MONTAGEM E EVITAR DUPLICIDADE VISUAL DO SETOR
    // ----------------------------------------------------
    const li = document.createElement("li");
    li.className = "funcao-item";
    if (concluido) li.classList.add("concluido");
    
    const periodoVaga = formatarPeriodo(func.dtini_vaga, func.dtfim_vaga);
    
    const setor = (func.setor_orcamento || func.localizacao || "").trim();
    let labelLocal = "";
    if (setor && !nomeFuncao.toUpperCase().includes(setor.toUpperCase())) {
        labelLocal = ` <span style="font-size:0.8em; background:var(--surface-3); padding:2px 6px; border-radius:4px; color:var(--text-1); font-weight:normal;">${escapeHtml(setor)}</span>`;
    }

    const textoUnidade = "diárias";

    // ----------------------------------------------------
    // 🎯 5. CONSTRUÇÃO DO CARD DE ESTADO (GRID ALINHADO)
    // ----------------------------------------------------
    let htmlEstado = `<div class="func-estado" style="font-weight: bold; flex: 0 0 auto; text-align: right; display: flex; flex-direction: row; align-items: flex-start; font-size: 0.9em; gap: 20px; margin-left: auto; margin-right: 20px;">`;
    
    // 1️⃣ Bloco de Itens (👥)
    htmlEstado += `  <div style="min-width: 95px; width: 95px; text-align: left; line-height: 1.3;">`;
    htmlEstado += `    <div style="font-weight: bold; color: inherit; white-space: nowrap;">👥 ${pessoasCadastradas}/${itensOrcados} <small style="font-weight: normal; color: var(--text-2);">itens</small></div>`;
    if (aditivosPendentes > 0) {
        const labelTipoAditivo = limitePendentes > 0 && limitePendentes === aditivosPendentes
            ? 'limite excedido'
            : limitePendentes > 0
            ? 'vaga/limite excedido'
            : 'vaga excedida';
        htmlEstado += `    <div style="font-size: 10px; color: #c0392b; font-weight: bold; white-space: nowrap; margin-top: 2px;">⚠️ ${aditivosPendentes} solicitação${aditivosPendentes > 1 ? 'ões' : ''} pendente${aditivosPendentes > 1 ? 's' : ''} (${labelTipoAditivo})</div>`;
    }
    // "Aguardando autorização" só faz sentido enquanto a solicitação em si está Pendente. Se já
    // foi Autorizada e só falta entrar nos itens do orçamento, mostra o rótulo certo em vez disso.
    if (aditivosPendentes === 0 && aguardandoInclusao > 0) {
        htmlEstado += `    <div style="font-size: 10px; color: #2980b9; font-weight: bold; font-style: italic; white-space: nowrap; margin-top: 2px;">📋 ${aguardandoInclusao} aguardando inclusão no orçamento</div>`;
    } else if (aditivosPendentes === 0 && pendentes > 0) {
        htmlEstado += `    <div style="font-size: 10px; color: #e67e22; font-weight: bold; font-style: italic; white-space: nowrap; margin-top: 2px;">⏳ ${pendentes} aguardando autorização</div>`;
    }
    htmlEstado += `  </div>`;

    // 2️⃣ Bloco de Diárias (📅)
    let textosDobra = [];
    if (func.dobras_pendentes > 0) {
        textosDobra.push(`${func.dobras_pendentes} Aguardando Autorização ⏳`);
    }
    if (func.dobras_autorizadas > 0) {
        const pluralAut = func.dobras_autorizadas > 1 ? 's' : '';
        textosDobra.push(`${func.dobras_autorizadas} Autorizado${pluralAut} ✅ em Diária Dobrada`);
    }
    const vagasUsadasEmDet = Array.isArray(func.vagas_usadas_em) ? func.vagas_usadas_em : [];

    htmlEstado += `  <div style="min-width: 120px; width: 120px; text-align: left; line-height: 1.3;">`;
    htmlEstado += `    <div style="font-weight: bold; color: inherit; white-space: nowrap;">📅 ${exibicaoDiariasVisuais}/${vagasOrcadas} <small style="font-weight: normal; color: var(--text-2);">${textoUnidade}</small></div>`;
    if (textosDobra.length > 0) {
        htmlEstado += `    <div style="font-size: 10px; color: #e67e22; font-weight: normal; font-style: italic; white-space: nowrap; margin-top: 2px;">(${textosDobra.join(' e ')})</div>`;
    }
    for (const u of vagasUsadasEmDet) {
        htmlEstado += `    <div style="font-size: 10px; color: #8e44ad; font-weight: normal; font-style: italic; white-space: nowrap; margin-top: 2px;">⟳ ${u.qtd} diária${u.qtd > 1 ? 's' : ''} em ${escapeHtml(u.nome_funcao_destino)}</div>`;
    }
    htmlEstado += `  </div>`;

    // 3️⃣ Bloco de Disponíveis (Disp:)
    htmlEstado += `  <div style="min-width: 110px; width: 110px; text-align: right;">`;
    htmlEstado += `    <div style="color: ${disponiveis > 0 ? '#ff9800' : '#4caf50'}; font-weight: bold;">Disp: ${disponiveis} <small style="font-weight: normal; color: var(--text-2);">diárias</small></div>`;
    if (limiteFinExcedido && disponiveis > 0) {
        htmlEstado += `    <div style="font-size: 9px; color: #c0392b; font-weight: bold; white-space: nowrap; margin-top: 2px;">🚫 Limite fin. excedido</div>`;
    } else if (limiteSaldoInferior && disponiveis > 0) {
        htmlEstado += `    <div style="font-size: 9px; color: #e67e22; font-weight: bold; white-space: nowrap; margin-top: 2px;">⚠️ Limite fin. insuficiente</div>`;
    }
    htmlEstado += `  </div>`;
         
    htmlEstado += `</div>`;
   
    // Configuração dos Botões de Ação
    let htmlBotao;
    if (concluido) {
        htmlBotao = '<span style="color: green; font-weight: bold;">✅ Completa</span>';
    } else if (bloqueadoPorPendente) {
        htmlBotao = '<span style="color: #e67e22; font-weight: bold;" title="Vagas aguardando liberação">🔒 Reservado</span>';
    } else if (func.contratarstaff === false) {
        htmlBotao = '<span style="color: var(--text-3); font-weight: bold;" title="Orçamento não habilitado para contratação de staff">🚫 Não disponível para Cadastro</span>';
    } else if (func.liberarcontratacao === false) {
        htmlBotao = '<span style="color: var(--text-3); font-weight: bold;" title="Contratação desabilitada para este item específico (ex.: aditivo/bonificado ainda não autorizado)">🚫 Item não liberado para Cadastro</span>';
    } else {
        htmlBotao = `<button class="btn-abrir-staff status-urgente-vermelho">⏳ Abrir staff</button>`;
    }

    li.innerHTML = `
        <div class="func-wrapper" style="display: flex; justify-content: space-between; align-items: center; width: 100%; padding: 4px 0;">
            <div class="func-nome" style="flex: 1; padding-right: 15px; min-width: 200px;">
                <strong style="font-size: 1.05em; color: var(--text-1);">${escapeHtml(nomeFuncao)}</strong>${labelLocal}
                <span class="func-data-vaga" style="display: block; font-size: 0.85em; color: var(--text-2); margin-top: 2px;">(${periodoVaga})</span>
            </div>
            ${htmlEstado}
            <div class="func-detalhes" style="flex: 0 0 120px; text-align: right;">
                ${htmlBotao}
            </div>
        </div>
    `;

    if (!concluido && !bloqueadoPorPendente && func.contratarstaff !== false && func.liberarcontratacao !== false) {
        const botao = li.querySelector(".btn-abrir-staff");
        if (botao) {
            botao.addEventListener("click", (e) => {
                e.stopPropagation();
                abrirStaffModal();
            });
        }
    }

    function abrirStaffModal() {
        if (concluido || bloqueadoPorPendente || func.contratarstaff === false || func.liberarcontratacao === false) return;

        const params = new URLSearchParams();
        params.set("idfuncao", func.idfuncao ?? func.idFuncao);
        params.set("nmfuncao", func.nome ?? func.nmfuncao);
        params.set("idequipe", equipe.idequipe || "");
        params.set("nmequipe", equipe.equipe || "");
        params.set("idmontagem", evento.idmontagem || "");
        params.set("nmlocalmontagem", evento.nmlocalmontagem || "");
        params.set("idcliente", evento.idcliente || "");
        params.set("nmcliente", evento.nmfantasia || evento.cliente || "");
        params.set("idevento", evento.idevento || "");
        params.set("nmevento", evento.nmevento || "");
        params.set("idorcamento", evento.idorcamento || "");

        if (Array.isArray(evento.dataeventos)) {
            params.set("dataeventos", JSON.stringify(evento.dataeventos));
        } else if (evento.dataeventos) {
            params.set("dataeventos", evento.dataeventos);
        }

        params.set("dtini_vaga", func.dtini_vaga || null);
        params.set("dtfim_vaga", func.dtfim_vaga || null);
        params.set("cache_fechado", func.cache_fechado ?? false);

        window.onStaffModalClosed = async function(modalClosedSuccessfully) {
            console.log("🔥 onStaffModalClosed chamado!");
            
            const resp = await fetchComToken(`/main/detalhes-eventos-abertos?idevento=${evento.idevento}&idempresa=${localStorage.getItem("idempresa") || sessionStorage.getItem("idempresa")}&idmontagem=${evento.idmontagem || ''}`);
            const dadosRaw = Array.isArray(resp.equipes) ? resp.equipes : [];
            
            const equipesNormalizadas = dadosRaw.map(item => {
                const mapFuncoesInterno = (funcoesArray) => {
                    if (!Array.isArray(funcoesArray)) return [];
                    return funcoesArray.map(f => {
                        // Recalcula o saldo temporariamente para evitar o bug na atualização do modal
                        const dConsumidas = Number(f.diarias_consumidas ?? f.vagas_consumidas ?? f.total_diarias ?? f.diarias ?? 0);
                        const dPendentes = Number(f.qtd_pendente ?? f.pendentes ?? 0);
                        const dobPendentes = Number(f.dobras_pendentes ?? 0);
                        const qOrcamento = Number(f.qtd_orcamento ?? f.qtditens ?? 0);
                        const dOrcamento = Number(f.qtddias_orcamento ?? f.qtddias ?? 1);
                        
                        const isCacheFechadoInterno = f.cache_fechado === true || f.cache_fechado === "true" || f.tem_cache_fechado === true || f.tem_cache_fechado === "true" || f.is_cache_fechado === true;
                        const vOrcadas = isCacheFechadoInterno
                            ? dOrcamento
                            : (f.total_diarias_orcadas != null ? Number(f.total_diarias_orcadas) : qOrcamento * dOrcamento);
                        
                        const sDisponivel = Math.max(0, vOrcadas - (dConsumidas + dPendentes + dobPendentes));

                        return {
                            ...f,
                            nome: f.nome ?? f.descfuncao ?? "Função",
                            // 🚀 Alinhado com a nova regra de segurança: Só fecha se o saldo for de fato 0
                            concluido: (f.concluido ?? false) && (sDisponivel === 0)
                        };
                    });
                };

                return {
                    equipe: item.equipe || item.nmequipe || (`Equipe ${item.idequipe ?? ""}`),
                    idequipe: item.idequipe,
                    funcoes: Array.isArray(item.funcoes) ? mapFuncoesInterno(item.funcoes) : []
                };
            });

            const equipeAtualizada = equipesNormalizadas.find(e => String(e.idequipe) === String(equipe.idequipe));
            
            if (equipeAtualizada) {
                abrirDetalhesEquipe(equipeAtualizada, evento);
            } else {
                backToEquipes();
            }
        };

        window.__modalInitialParams = params.toString();
        window.moduloAtual = "Staff";

        const targetUrl = `CadStaff.html?${params.toString()}`;

        if (typeof abrirModalLocal === "function") {
            abrirModalLocal(targetUrl, "Staff");
        } else if (typeof abrirModal === "function") {
            abrirModal(targetUrl, "Staff");
        } else {
            console.error("ERRO FATAL: Nenhuma função global para abrir o modal foi encontrada.");
        }
    }

    li.addEventListener("click", abrirStaffModal);
    li.addEventListener("keypress", (e) => { if (e.key === "Enter") abrirStaffModal(); });

    lista.appendChild(li);
  });

  container.appendChild(lista);

  // Totais da equipe (itens + diárias) — uma única linha no rodapé, cada total alinhado
  // na mesma coluna da métrica correspondente (👥 itens / 📅 diárias) de cada função.
  const totaisEquipe = document.createElement("div");
  totaisEquipe.className = "totais-equipe-detalhe";
  totaisEquipe.style = "display:flex; align-items:center; width:100%; padding:4px 0;";
  totaisEquipe.innerHTML = `
    <div style="flex:1; padding-right:15px; min-width:200px;"></div>
    <div style="flex: 0 0 auto; text-align: right; display: flex; flex-direction: row; align-items: flex-start; font-size: 0.9em; gap: 20px; margin-left: auto; margin-right: 20px;">
        <div style="min-width: 95px; width: 95px; text-align: left; color: var(--text-3); font-size: 11px; font-weight: normal;">TOTAL: ${totalItensCadastrados}/${totalItensOrcados} itens</div>
        <div style="min-width: 120px; width: 120px; text-align: left; color: var(--text-3); font-size: 11px; font-weight: normal;">TOTAL: ${totalDiariasCadastradas}/${totalDiariasOrcadas} diárias</div>
        <div style="min-width: 110px; width: 110px;"></div>
    </div>
    <div style="flex: 0 0 120px;"></div>
  `;
  container.appendChild(totaisEquipe);

  // ===== RODAPÉ =====
  const rodape = document.createElement("div");
  rodape.className = "rodape-equipes";
  rodape.innerHTML = `<button class="btn-voltar-rodape">← Voltar</button><span class="status-texto">${concluidas === totalFuncoes ? "✅ Finalizado" : "⏳ Em andamento"}</span>`;
  container.appendChild(rodape);

  painel.appendChild(container);

  container.querySelector(".btn-voltar")?.addEventListener("click", voltarParaEquipes);
  container.querySelector(".btn-voltar-rodape")?.addEventListener("click", voltarParaEquipes);
}

function montarOpcoesOrc(titulo, valores, conteudoGeral) {
    return `
        <label class="label-select">${titulo}</label>
        <div class="wrapper" style="width: ${valores.length * 90}px;">
            ${valores.map(v => `
                <div class="option" style="width: 80px;">
                    <input value="${v.value}" name="subOrc" type="radio" class="input" ${v.checked ? "checked" : ""} />
                    <div class="btn"><span class="span">${v.label}</span></div>
                </div>
            `).join("")}
        </div>`;
}

function construirParametrosOrcamentos() {
    const status = document.querySelector('input[name="statusOrc"]:checked')?.value || 'todos';
    const periodo = document.querySelector('input[name="periodoOrc"]:checked')?.value || 'diario';
    const dataInput = document.getElementById("sub-filtro-data-orc");

    let urlParams = `?status=${status}&periodo=${periodo}`;

    if (periodo === 'semanal' && dataInput && dataInput.value) {
        // Criamos a data base escolhida no input
        const dataEscolhida = new Date(dataInput.value + 'T00:00:00');
        
        // CALENDÁRIO GLOBAL: Encontrar o Domingo (início) daquela semana
        const diaDaSemana = dataEscolhida.getDay(); // 0=Dom, 1=Seg...
        const dataInicioSemana = new Date(dataEscolhida);
        dataInicioSemana.setDate(dataEscolhida.getDate() - diaDaSemana);
        
        // CALENDÁRIO GLOBAL: Encontrar o Sábado (fim) daquela semana
        const dataFimSemana = new Date(dataInicioSemana);
        dataFimSemana.setDate(dataInicioSemana.getDate() + 6);
        
        const dataRefStr = dataInicioSemana.toISOString().split('T')[0];
        const dataFimStr = dataFimSemana.toISOString().split('T')[0];
        
        urlParams += `&dataRef=${dataRefStr}&dataFim=${dataFimStr}`;
        
        console.log(`📅 Semana Global: ${dataRefStr} até ${dataFimStr}`);
    } else {
        const selectGeral = document.getElementById("sub-filtro-select-orc");
        if (selectGeral) urlParams += `&valorFiltro=${selectGeral.value}`;
        if (dataInput) urlParams += `&dataRef=${dataInput.value}`;
    }

    return urlParams;
}

// --- CORE DOS FILTROS ---

function criarFiltrosOrcamentoCompletos(conteudoGeral) {
    const filtrosContainer = document.createElement("div");
    filtrosContainer.className = "filtros-vencimentos venc-container"; 

    const wrapperUnificado = document.createElement("div");
    wrapperUnificado.style.display = "flex";
    wrapperUnificado.style.gap = "20px";

    // 1. Grupo Status
    const grupoStatus = document.createElement("div");
    grupoStatus.className = "filtro-grupo";
    grupoStatus.innerHTML = `
        <label class="label-select">Nível do Orçamento</label>
    <div class="wrapper" style="width: 420px;"> 
        ${['Todos', 'Aberto', 'Proposta', 'Em Andamento', 'Fechado', 'Recusado'].map((s, i) => `
            <div class="option" style="width: 60px;">
                <input ${i === 0 ? 'checked' : ''} value="${s === 'Todos' ? 'todos' : s.toLowerCase()}" name="statusOrc" type="radio" class="input" />
                <div class="btn"><span class="span">${s}</span></div>
            </div>
        `).join('')}
    </div>`;

    // 2. Grupo Período
    const grupoPeriodo = document.createElement("div");
    grupoPeriodo.className = "filtro-grupo";
    grupoPeriodo.innerHTML = `
        <label class="label-select">Período</label>
        <div class="wrapper" style="width: 300px;">
            <div class="option" style="width: 30px;"><input checked value="diario" name="periodoOrc" type="radio" class="input" /><div class="btn"><span class="span">Diário</span></div></div>
            <div class="option" style="width: 30px;"><input value="semanal" name="periodoOrc" type="radio" class="input" /><div class="btn"><span class="span">Semanal</span></div></div>
            <div class="option" style="width: 30px;"><input value="mensal" name="periodoOrc" type="radio" class="input" /><div class="btn"><span class="span">Mensal</span></div></div>
            <div class="option" style="width: 30px;"><input value="trimestral" name="periodoOrc" type="radio" class="input" /><div class="btn"><span class="span">Trimestral</span></div></div>
            <div class="option" style="width: 30px;"><input value="semestral" name="periodoOrc" type="radio" class="input" /><div class="btn"><span class="span">Semestral</span></div></div>
            <div class="option" style="width: 30px;"><input value="anual" name="periodoOrc" type="radio" class="input" /><div class="btn"><span class="span">Anual</span></div></div>
        </div>`;

    const subFiltroWrapper = document.createElement("div");
    subFiltroWrapper.id = "sub-filtro-orc-wrapper";
    subFiltroWrapper.className = "filtro-grupo";

    // 3. Grupo Busca por Evento — mesmo padrão (Select2 + /main/eventos-busca) de Eventos em Aberto
    const grupoBusca = document.createElement("div");
    grupoBusca.className = "filtro-grupo";
    grupoBusca.innerHTML = `
        <label class="label-select">Buscar Evento</label>
        <div class="wrapper select-wrapper busca-evento-wrapper" style="width: 260px;">
            <input type="text" id="busca-evento-input-orc" class="busca-evento-input" placeholder="Buscar evento..." autocomplete="off">
            <input type="hidden" id="busca-evento-id-orc">
            <ul id="busca-evento-lista-orc" class="busca-evento-lista" style="display:none;"></ul>
        </div>`;

    wrapperUnificado.appendChild(grupoStatus);
    wrapperUnificado.appendChild(grupoPeriodo);
    wrapperUnificado.appendChild(subFiltroWrapper);
    wrapperUnificado.appendChild(grupoBusca);
    filtrosContainer.appendChild(wrapperUnificado);

    const atualizarSubFiltroInterno = (tipo) => {
        subFiltroWrapper.innerHTML = "";
        const anoAtual = new Date().getFullYear();

        if (tipo === "diario" || tipo === "semanal") {
            const hoje = new Date().toISOString().split("T")[0];
            subFiltroWrapper.innerHTML = `
                <label class="label-select">Data Base</label>
                <div class="wrapper select-wrapper">
                    <input type="date" id="sub-filtro-data-orc" class="input-data-simples" value="${hoje}">
                </div>`;
        } 
        else if (tipo === "mensal") {
            let options = "";
            for (let i = 1; i <= 12; i++) {
                // Aqui usamos a sua função nomeDoMes global
                options += `<option value="${i}" ${i === (new Date().getMonth()+1) ? 'selected' : ''}>${nomeDoMes(i)} / ${anoAtual}</option>`;
            }
            subFiltroWrapper.innerHTML = `<label class="label-select">Mês</label><div class="wrapper select-wrapper"><select id="sub-filtro-select-orc" class="select-simples">${options}</select></div>`;
        }
        else if (tipo === "trimestral") {
        // Divisão correta: T1(Jan-Mar), T2(Abr-Jun), T3(Jul-Set), T4(Out-Dez)
        const trimes = [
            { v: 1, l: `1º Trimestre (Jan-Mar)` },
            { v: 2, l: `2º Trimestre (Abr-Jun)` },
            { v: 3, l: `3º Trimestre (Jul-Set)` },
            { v: 4, l: `4º Trimestre (Out-Dez)` }
        ];
        let options = trimes.map(t => `<option value="${t.v}">${t.l} / ${anoAtual}</option>`).join('');
        subFiltroWrapper.innerHTML = `<label class="label-select">Trimestre</label><div class="wrapper select-wrapper"><select id="sub-filtro-select-orc" class="select-simples">${options}</select></div>`;
    }
    else if (tipo === "semestral") {
        // Adição dos Semestres: S1(Jan-Jun), S2(Jul-Dez)
        const semes = [
            { v: 1, l: `1º Semestre (Jan-Jun)` },
            { v: 2, l: `2º Semestre (Jul-Dez)` }
        ];
        let options = semes.map(s => `<option value="${s.v}">${s.l} / ${anoAtual}</option>`).join('');
        subFiltroWrapper.innerHTML = `<label class="label-select">Semestre</label><div class="wrapper select-wrapper"><select id="sub-filtro-select-orc" class="select-simples">${options}</select></div>`;
    }
       else if (tipo === "anual") {
    const anoAtual = 2026; // Definido conforme seu contexto
    const anos = [anoAtual - 1, anoAtual, anoAtual + 1]; // [2025, 2026, 2027]
    
    let options = anos.map(ano => 
        `<option value="${ano}" ${ano === anoAtual ? 'selected' : ''}>${ano}</option>`
    ).join('');
    
    subFiltroWrapper.innerHTML = `
        <label class="label-select">Ano Vigente</label>
        <div class="wrapper select-wrapper">
            <select id="sub-filtro-select-orc" class="select-simples">
                ${options}
            </select>
        </div>`;
}

        subFiltroWrapper.querySelectorAll("input, select").forEach(el => {
            el.addEventListener("change", () => carregarDetalhesOrcamentos(conteudoGeral));
        });
    };

    [grupoStatus, grupoPeriodo].forEach(g => {
        g.querySelectorAll("input").forEach(i => i.addEventListener("change", (e) => {
            if(e.target.name === 'periodoOrc') atualizarSubFiltroInterno(e.target.value);
            carregarDetalhesOrcamentos(conteudoGeral);
        }));
    });

    // --- Inicialização da busca por evento (mesmo padrão do RH: input + lista suspensa) ---
    (async () => {
        const input = grupoBusca.querySelector("#busca-evento-input-orc");
        const lista = grupoBusca.querySelector("#busca-evento-lista-orc");
        const idempresa = localStorage.getItem("idempresa");
        let orcamentosBusca = [];

        try {
            orcamentosBusca = await fetchComToken(`/main/orcamentos-busca`, { headers: { idempresa } }) || [];
        } catch (err) {
            console.error("Erro ao carregar orcamentos para busca:", err);
        }

        // Um evento pode ter mais de um orçamento no mesmo ano (ex: duas montagens/revisões
        // diferentes) — só mostra o número do orçamento quando há ambiguidade real.
        const contagemNomeAno = eventosBusca.reduce((acc, ev) => {
            const chave = `${ev.nmevento}|${ev.ano}`;
            acc[chave] = (acc[chave] || 0) + 1;
            return acc;
        }, {});

        const selecionarEvento = async (eventoSel) => {
            // 1. Nível do Orçamento: "Todos", pra achar o orçamento independente do status
            // (/eventos-busca não devolve o status de 5 vias usado aqui — só aberto/encerrado).
            const statusInput = filtrosContainer.querySelector('input[name="statusOrc"][value="todos"]');
            if (statusInput) statusInput.checked = true;

            // 2. Período: força Anual + o ano do evento, pra garantir que ele apareça
            // independente da data exata.
            const periodoAnualInput = filtrosContainer.querySelector('input[name="periodoOrc"][value="anual"]');
            if (periodoAnualInput) periodoAnualInput.checked = true;
            atualizarSubFiltroInterno("anual");

            const selectAno = document.getElementById("sub-filtro-select-orc");
            if (selectAno) {
                if (![...selectAno.options].some(o => o.value === String(eventoSel.ano))) {
                    const opt = document.createElement("option");
                    opt.value = eventoSel.ano;
                    opt.textContent = eventoSel.ano;
                    selectAno.appendChild(opt);
                }
                selectAno.value = String(eventoSel.ano);
            }

            // 3. Recarrega a lista com os novos filtros
            await carregarDetalhesOrcamentos(conteudoGeral);

            // 4. Rola até o card do orçamento encontrado e já abre o acordeão
            const cardAlvo = conteudoGeral.querySelector(`.accordion-item[data-idorcamento="${eventoSel.idorcamento}"]`);
            if (cardAlvo) {
                cardAlvo.scrollIntoView({ behavior: 'smooth', block: 'start' });
                cardAlvo.classList.add('active');
            }

            // Limpa a busca pra já poder digitar a próxima
            input.value = "";
            lista.style.display = "none";
        };

        lista.innerHTML = "";
        eventosBusca.forEach(ev => {
            const chave = `${ev.nmevento}|${ev.ano}`;
            const nomeExibido = contagemNomeAno[chave] > 1
                ? `${ev.nmevento} (${ev.ano}) — Orç. ${ev.nrorcamento}`
                : `${ev.nmevento} (${ev.ano})`;

            const li = document.createElement("li");
            li.dataset.idorcamento = ev.idorcamento;
            li.dataset.nome = nomeExibido;
            li.textContent = nomeExibido;
            li.addEventListener("mousedown", (e) => {
                e.preventDefault(); // antes do blur, p/ registrar o clique
                selecionarEvento(ev);
            });
            lista.appendChild(li);
        });

        const filtrar = () => {
            const termo = input.value.toLowerCase().trim();
            lista.querySelectorAll("li").forEach((li) => {
                li.style.display = li.dataset.nome.toLowerCase().includes(termo) ? "block" : "none";
            });
            lista.style.display = "block";
        };
        input.addEventListener("input", filtrar);
        input.addEventListener("focus", () => { lista.style.display = "block"; });

        // Esconde ao clicar fora.
        document.addEventListener("mousedown", (e) => {
            if (e.target !== input && !lista.contains(e.target)) lista.style.display = "none";
        });
    })();

    atualizarSubFiltroInterno("diario");
    return filtrosContainer;
}

// --- RENDERIZAÇÃO E CLIQUE ---

function renderizarListaOrcamentos(container, lista) {
    container.innerHTML = "";

    // Captura o ano selecionado para personalizar a mensagem de erro/vazio
    const selectAno = document.getElementById("sub-filtro-select-orc");
    const periodoAtivo = document.querySelector('input[name="periodoOrc"]:checked')?.value;
    const anoExibicao = (periodoAtivo === 'anual' && selectAno) ? selectAno.value : '2026';

    if (!lista || lista.length === 0) {
        container.innerHTML = `
            <div class="alert-no-data mt-3">
                <p>Nenhum orçamento encontrado para os critérios de ${anoExibicao}.</p>
            </div>`;
        return;
    }

    const grid = document.createElement("div");
    grid.className = "orcamentos-grid mt-3";

    // Mapeamento de nomes para exibição nos Badges
    const statusTraducao = {
        'F': 'Fechado',
        'E': 'Em Andamento',
        'P': 'Proposta',
        'A': 'Aberto',
        'R': 'Recusado'
    };

    lista.forEach(orc => {
    const dIni = new Date(orc.dtinimarcacao);
    const dataInicio = !isNaN(dIni) ? dIni.toLocaleDateString('pt-BR') : "---";

    const dFimRaw = new Date(orc.data_final_ciclo);
    const dataFim = (dFimRaw.getFullYear() > 1950) 
        ? dFimRaw.toLocaleDateString('pt-BR') 
        : "Não definida";

        const statusLower = orc.status.toLowerCase();
        const nomeStatus = statusTraducao[orc.status] || orc.status;

        const item = document.createElement("div");
        item.className = `accordion-item status-border-${statusLower}`; // Borda lateral por status
        item.dataset.idorcamento = orc.idorcamento;
        item.innerHTML = `
            <div class="accordion-orc-header">
                <div class="header-main">
                    <div class="orc-header-info">
                        <label>Status:</label>
                        <span class="orc-badge status-${statusLower}">${nomeStatus}</span>
                    </div>
                    <div class="orc-header-info">
                        <label>Nº Orçamento:</label>
                        <strong>#${orc.nrorcamento}</strong> 
                    </div>
                    <div class="orc-header-info">
                        <label>Evento:</label>
                        <strong>${orc.nome_evento || 'Evento sem Nome'}</strong>
                    </div>
                    <div class="periodo-container">
                            <p><strong><i class="fa fa-calendar-alt"></i> Período Total:</strong></p>
                            <p class="data-range">${dataInicio} ➔ ${dataFim}</p>
                        </div>
                </div>
                <div class="header-sub">
                    <label>Nomenclatura:</label>
                    <small>${orc.nomenclatura || '---'}</small>
                </div>
            </div>
            <div class="accordion-content">
                <div class="accordion-orc-body">
                    <div class="details-row">
                        <div class="valor-container">
                            <p><strong>Verba de Contratação:</strong></p>
                            <p class="valor-texto">R$ ${parseFloat(orc.totgeralcto || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                        </div>
                    </div>
                    <hr>
                    <button class="btn-detalhes-orcamento" data-nrorcamento="${orc.nrorcamento}">
                        <i class="fa fa-external-link-alt"></i> Abrir Detalhes no Módulo
                    </button>
                </div>
            </div>
        `;

        // Evento de Accordion
        item.querySelector(".accordion-orc-header").onclick = () => {
            // Opcional: fechar outros abertos (estilo sanfona)
            // grid.querySelectorAll('.accordion-item').forEach(i => i !== item && i.classList.remove('active'));
            item.classList.toggle("active");
        };

        // Lógica de abertura do Modal (Polling)
        item.querySelector(".btn-detalhes-orcamento").onclick = async (e) => {
            e.stopPropagation(); // Evita fechar o accordion ao clicar no botão
            const nrOrcamento = e.currentTarget.getAttribute("data-nrorcamento");
            const linkModal = document.querySelector('.abrir-modal[data-modulo="Orcamentos"]');

            if (!linkModal) {
                console.error("❌ Link do módulo não encontrado.");
                return;
            }

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

            aguardarModalPronto().then(async (inputNr) => {
                if (inputNr && typeof window.preencherFormularioComOrcamento === "function") {
                    inputNr.value = nrOrcamento;

                    // Dispara o Enter para carregar os dados no módulo
                    const enter = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true });
                    inputNr.dispatchEvent(enter);

                    try {
                        const orcDet = await fetchComToken(`orcamentos?nrOrcamento=${nrOrcamento}`);
                        if (!orcDet || Array.isArray(orcDet) || !orcDet.idorcamento) {
                            console.warn("Orçamento não encontrado ao abrir pelo card:", nrOrcamento);
                        } else {
                            window.preencherFormularioComOrcamento?.(orcDet);
                        }
                    } catch (err) { console.warn("Aviso: Falha ao forçar preenchimento detalhado."); }
                } else {
                    console.warn("⚠️ Modal não ficou pronto a tempo (campo ou função de preenchimento ausentes).");
                }
            });
        };

        grid.appendChild(item);
    });

    container.appendChild(grid);
}
                    //  <hr class="orcamento-hr">
async function carregarDetalhesOrcamentos(conteudoGeral) {
    conteudoGeral.innerHTML = `<p class="mt-3">Buscando orçamentos...</p>`;
    const queryParams = construirParametrosOrcamentos();
    try {
        const idEmpresa = getIdEmpresa();
        const orcamentos = await fetchComToken(`/main/orcamentos${queryParams}`, { headers: { idempresa: idEmpresa } });
        renderizarListaOrcamentos(conteudoGeral, orcamentos);
    } catch (error) {
        conteudoGeral.innerHTML = `<p class="erro">Erro ao carregar dados.</p>`;
    }
}

document.getElementById("cardContainerOrcamentos").addEventListener("click", async function() {
    const painel = document.getElementById("painelDetalhes");
    if (!painel) return;
    
    painel.innerHTML = ""; 
    const container = document.createElement("div");
    container.id = "orc-container";
    container.className = "orc-container venc-container"; 

    const header = document.createElement("div");
    header.className = "orcamento-header";
    header.innerHTML = `<button id="btnVoltarorc" class="btn-voltar">←</button><h2 class="title-orc">Gestão de Orçamentos</h2>`;

    const conteudoGeral = document.createElement("div");
    conteudoGeral.className = "conteudo-geral"; 

    container.appendChild(header);
    container.appendChild(criarFiltrosOrcamentoCompletos(conteudoGeral));
    container.appendChild(conteudoGeral);
    painel.appendChild(container);
    
    document.getElementById("btnVoltarorc").onclick = () => painel.innerHTML = ""; 

    carregarDetalhesOrcamentos(conteudoGeral);
});

async function buscarResumo() {
  return await fetchComToken("/main/orcamentos/resumo");
}

async function atualizarResumo() {
    const dadosResumo = await buscarResumo();
    document.getElementById("orcamentosTotal").textContent = dadosResumo.orcamentos;
    document.getElementById("orcamentosPendentes").textContent = dadosResumo.orcamentosAbertos;
    document.getElementById("orcamentosProposta").textContent = dadosResumo.orcamentosProposta;
    document.getElementById("orcamentosEmAndamento").textContent = dadosResumo.orcamentosEmAndamento;
    document.getElementById("orcamentosFechados").textContent = dadosResumo.orcamentosFechados;
    document.getElementById("orcamentosRecusados").textContent = dadosResumo.orcamentosRecusados;
    // document.getElementById("orcamentosPedidos").textContent = dadosResumo.orcamentosPedidos;
}


// function renderizarEstruturaAbasOrcamentos(container, dadosExtra, dadosAdic) {
//     container.innerHTML = `
//         <div class="tabs-container-wrapper">
//             <div class="abas-principais">
//                 <button class="aba main-tab-btn ativa" data-categoria="extra">
//                     Extra Bonificado (${dadosExtra.length})
//                 </button>
//                 <button class="aba main-tab-btn" data-categoria="adicional">
//                     Adicional (${dadosAdic.length})
//                 </button>
//             </div>
//             <div id="orc-tab-content-render" class="painel-tabs ativo" style="display: flex; flex-direction: column;"></div>
//         </div>
//     `;

//     container.querySelectorAll('.main-tab-btn').forEach(btn => {
//         btn.addEventListener('click', function() {
//             container.querySelectorAll('.main-tab-btn').forEach(b => b.classList.remove('ativa'));
//             this.classList.add('ativa');
            
//             const cat = this.getAttribute('data-categoria');
//             const lista = (cat === 'extra') ? dadosExtra : dadosAdic;
//             const statusAtual = document.querySelector("input[name='statusOrc']:checked")?.value;
            
//             // Chama sua função original de renderização (que está comentada no seu código)
//             if (typeof renderizarPedidosorc === "function") {
//                 renderizarPedidosorc(lista, "orc-tab-content-render", cat, statusAtual, false);
//             }
//         });
//     });

//     // Clique inicial para carregar a primeira aba
//     container.querySelector('.main-tab-btn.ativa').click();
// }

// let OrcamentosExtraBonificadoUnificados = [];
// let OrcamentosAdicionaisUnificados = [];

// /**
//  * Busca a lista de orçamentos Aprovados - Extra Bonificado.
//  * ✅ CORREÇÃO DE ROBUSTEZ: Adiciona 'headers' explicitamente para garantir o idempresa.
//  */
// async function buscarOrcamentosExtraBonificado() {
//     const URL_EXTRA = '/main/extra-bonificado';
//     const options = { headers: { idempresa: getIdEmpresa() } }; 
    
//     try {
//         // ✅ CORREÇÃO: fetchComToken retorna o JSON, então chame de 'dados'
//         const dados = await fetchComToken(URL_EXTRA, options); 
        
//         console.log("Dados Extra Bonificado:", dados);
//         // Garante que a função retorna um array, mesmo que o JSON retornado seja nulo ou não seja um array
//         return Array.isArray(dados) ? dados : []; 
        
//     } catch (error) {
//         // O erro já foi capturado e logado pelo fetchComToken se for falha HTTP.
//         // Se a requisição falhar totalmente, o catch captura e retorna [].
//         console.error("Falha ao buscar Extra Bonificado:", error);
//         return []; 
//     }
// }

// /**
//  * Busca a lista de orçamentos Aprovados - Adicionais.
//  * ✅ CORREÇÃO DE ROBUSTEZ: Adiciona 'headers' explicitamente para garantir o idempresa.
//  */
// async function buscarOrcamentosAdicionais() {
//     const URL_ADICIONAL = '/main/adicionais';
//     const options = { headers: { idempresa: getIdEmpresa() } };
    
//     try {
//         // ✅ CORREÇÃO: fetchComToken retorna o JSON, então chame de 'dados'
//         const dados = await fetchComToken(URL_ADICIONAL, options); 

        
//         console.log("Dados Adicionais:", dados);
//         // Garante que a função retorna um array
//         return Array.isArray(dados) ? dados : []; 
        
//     } catch (error) {
//         console.error("Falha ao buscar Adicionais:", error);
//         return []; 
//     }
// }

// // Sua função utilitária (sem modificação)
// function formatarTitulo(camelCase) {
//     let result = camelCase.replace('status', '').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
//     return result.split(' ').map(word => 
//         word.charAt(0).toUpperCase() + word.slice(1)
//     ).join(' ');
// }

// // Sua função principal (sem modificação)
// async function mostrarOrcamentosAprovados(conteudoGeral) {
//     conteudoGeral.innerHTML = `<p>Carregando pedidos aprovados...</p>`;
    
//     try {
//         // 1. CHAMA AS DUAS ROTAS EM PARALELO (CORREÇÃO APLICADA NAS FUNÇÕES DE BUSCA)
//         const [pedidosExtraBonificado, pedidosAdicionais] = await Promise.all([
//             buscarOrcamentosExtraBonificado(),
//             buscarOrcamentosAdicionais()
//         ]);
        
//         // 2. Armazena e Contagem
//         // 🔹 CORREÇÃO A: Mapeia e define o tipo de solicitação explicitamente
//         OrcamentosExtraBonificadoUnificados = pedidosExtraBonificado.map(p => ({
//             ...p,
//             categoriaSolicitacao: 'Extra Bonificado' // Define o tipo aqui
//         }));
        
//         // 🔹 CORREÇÃO A: Mapeia e define o tipo de solicitação explicitamente
//         OrcamentosAdicionaisUnificados = pedidosAdicionais.map(p => ({
//             ...p,
//             categoriaSolicitacao: 'Adicional' // Define o tipo aqui
//         }));
        
//         const countExtraBonificado = OrcamentosExtraBonificadoUnificados.length;
//         const countAdicionais = OrcamentosAdicionaisUnificados.length;
        
//         const statusFixo = 'Autorizado'; 

//         // 3. Cria a estrutura de Abas Principais
//         conteudoGeral.innerHTML = `
//             <div class="tabs-container-wrapper">
//                 <div class="abas-principais">
//                     <button class="aba main-tab-btn ativa" 
//                         data-tab-content="tab-content-extra" data-categoria="extra">
//                         Extra Bonificado (${countExtraBonificado})
//                     </button>
//                     <button class="aba main-tab-btn" 
//                         data-tab-content="tab-content-adicional" data-categoria="adicional">
//                         Adicional (${countAdicionais})
//                     </button>
//                 </div>
                
//                 <div id="tab-content-extra" class="painel-tabs ativo" style="display: flex;"></div>
//                 <div id="tab-content-adicional" class="painel-tabs desativado" style="display: none;"></div>
//             </div>
//         `;

//         // 4. Adiciona os Listeners
//         document.querySelectorAll('.abas-principais .main-tab-btn').forEach(button => {
//             button.addEventListener('click', function() {
//                 const targetId = this.getAttribute('data-tab-content');
//                 const categoria = this.getAttribute('data-categoria');
                
//                 // Gerencia classes da aba
//                 document.querySelectorAll('.abas-principais .main-tab-btn').forEach(btn => btn.classList.remove('ativa'));
//                 this.classList.add('ativa');
                
//                 // Gerencia visibilidade dos painéis
//                 document.querySelectorAll('.painel-tabs').forEach(content => {
//                     content.style.display = 'none';
//                 });
//                 const targetContent = document.getElementById(targetId);
//                 targetContent.style.display = 'flex'; 
                
//                 // Seleciona a lista correta
//                 const listaPedidos = categoria === 'extra' 
//                     ? OrcamentosExtraBonificadoUnificados 
//                     : OrcamentosAdicionaisUnificados;
                
//                 // Renderiza o conteúdo
//                 renderizarPedidosorc(listaPedidos, targetId, categoria, statusFixo, true);
//             });
//         });

//         // 5. Simula o clique inicial
//         const btnInicial = conteudoGeral.querySelector('.main-tab-btn.ativa');
//         if (btnInicial) {
//             btnInicial.click(); 
//         }
//     } catch (error) {
//         console.error("Erro ao carregar dados de orçamento:", error);
//         conteudoGeral.innerHTML = `<p class="erro">Erro ao carregar pedidos: ${error.message || 'Falha na comunicação com o servidor.'}</p>`;
//     }
// }

// // Sua função de renderização (sem modificação)
// function renderizarPedidosorc(listaPedidos, containerId, categoria, status, isStatusFixo) {
//     console.log(`Renderizando pedidos para categoria: ${categoria}, status: ${status}, isStatusFixo: ${isStatusFixo}`);
//     const container = document.getElementById(containerId);
//     if (!container) return;
    
//     // Helper function para escapar HTML
//     const escapeHTML = (str) => {
//         if (typeof str !== 'string') return str || '';
//         return str.replace(/[&<>"']/g, function(m) {
//             return ({
//                 '&': '&amp;',
//                 '<': '&lt;',
//                 '>': '&gt;',
//                 '"': '&quot;',
//                 "'": '&#39;'
//             }[m]);
//         });
//     };
    
//     // 🛑 LIMPA O CONTAINER
//     container.innerHTML = ''; 

//     const pedidosFiltrados = listaPedidos;
//     if (pedidosFiltrados.length === 0) {
//         container.innerHTML = `<p class="mt-3">Não há pedidos autorizados nesta categoria.</p>`;
//     }

//     // GERAÇÃO DO HTML (Usando a técnica robusta de appendChild)
//     pedidosFiltrados.forEach((p, index) => {

//       console.log(`⏳ Iterando pedido ${index} para categoria: ${categoria}`, p);
//         // Variáveis de Exibição
//         const nomeTipoExibicao = escapeHTML(p.categoriaSolicitacao || p.tiposolicitacao || 'Orçamento Complementar'); 
//         const tipoInterno = escapeHTML(p.tiposolicitacao || 'N/D');
//         const nomePrincipal = escapeHTML(p.nome_funcionario_afetado || p.nome_evento || `Orçamento ${p.nrdorcamento}` || 'N/D');       
//         const titulo = `${nomeTipoExibicao} - ${nomePrincipal}`; 
//         const tipoCor = 'aditivo-extra';
//         const tipoIcone = 'fa fa-plus-circle';
//         const collapseId = `collapse-${containerId}-${index}`;

//         // Detalhes (HTML interno) - APLICANDO escapeHTML EM TODOS OS CAMPOS DE DADOS
//         const detalhesHTML = `
//             <div class= "categoria">
//               <p><strong>Categoria:</strong> ${nomeTipoExibicao}</p>
//               <p><strong>Tipo Interno:</strong> ${tipoInterno}</p>
//             </div>  
            
//             <hr class="mt-2 mb-2">

//             <div class= "FuncionarioEvento">
//               ${p.nome_funcionario_afetado 
//                   ? `<p><strong>Funcionário Afetado:</strong> ${escapeHTML(p.nome_funcionario_afetado)} (ID: ${p.idfuncionario || 'N/D'})</p>` 
//                   : ''
//               }
//               ${p.idfuncao ? `<p><strong>ID da Função:</strong> ${p.idfuncao}</p>` : ''}
//               ${p.nome_evento ? `<p><strong>Evento:</strong> ${escapeHTML(p.nome_evento)}</p>` : ''}
//             </div>

//             <hr class="mt-2 mb-2">
            
//             <p><strong>Nº Orçamento:</strong> ${p.idorcamento || p.nrorcamento || 'N/D'}</p>
//             <p><strong>Status:</strong> ${p.status_aditivo || p.status || status}</p>
//             <p><strong>Solicitante:</strong> ${escapeHTML(p.nome_usuario_solicitante || 'N/D')}</p>
//             <p><strong>Justificativa:</strong> ${escapeHTML(p.justificativa || 'N/D')}</p>
//         `;

//         console.log(`✅ Gerando item de acordeão para pedido ${index}:`, { titulo, detalhesHTML });

//         const item = document.createElement('div');
//         item.className = 'accordion-item';
        
//         item.innerHTML = `
//             <div class="accordion-header ${tipoCor}"> 
//                 <i class="${tipoIcone}"></i>
//                 <span>${titulo}</span>
//                 <i class="fa fa-chevron-down"></i>
//             </div>
//             <div id="${collapseId}" class="accordion-content">
//                 <div class="accordion-body">
//                     ${detalhesHTML}
//                 </div>
//             </div>
//         `;
        
//         container.appendChild(item);
//     });

//     console.log(`✅ Elementos anexados. Total de filhos no container: ${container.children.length}`);

//     container.addEventListener('click', function(event) {
        
//         const header = event.target.closest('.accordion-header');
        
//         if (!header) return; // Não foi um clique no cabeçalho

//         event.preventDefault(); // Garante que nenhum link ou framework interfira
        
//         const item = header.closest('.accordion-item');
        
//         if (!item) return; 
        
//         console.log(`✅✅✅ SUCESSO! CLIQUE DETECTADO. Aplicando .active em:`, item); 

//         // 1. Toggle da classe 'active' no elemento PAI
//         item.classList.toggle('active');
        
//         // 2. Toggle da classe 'active' no header (para seta)
//         header.classList.toggle('active'); 
        
//         // 3. Fechar outros itens (opcional)
//         container.querySelectorAll('.accordion-item').forEach(otherItem => {
//             if (otherItem !== item && otherItem.classList.contains('active')) {
//                 otherItem.classList.remove('active');
//                 const otherHeader = otherItem.querySelector('.accordion-header');
//                 if(otherHeader) otherHeader.classList.remove('active');
//             }
//         });
//     });
//     // Não marque o container se você for executar renderizarPedidosorc apenas uma vez por aba.
//     // Se for executada múltiplas vezes, o listener será duplicado, mas é o preço pela certeza do clique.
// }

// document.addEventListener('click', function(event) {
//     const header = event.target.closest('.accordion-header');
//     if (header) {
//         console.log(`🌟 CLIQUE NO ACORDEÃO DETECTADO PELO DOCUMENT! O PROBLEMA É A EXECUÇÃO DO SEU LISTENER.`);
//         // Remove este listener temporário após o teste
//         // document.removeEventListener('click', arguments.callee); 
//     }
// });

// Seu Listener de Evento (sem modificação)


// A seção de Pedidos e Solicitações agora vive em js/Pedidos.js.
import { mostrarPedidosUsuario, parseDateLocal } from './Pedidos.js';



// ===========================
// Vencimentos de Pagamentos
// ===========================

function formatarMoeda(valor) {
    // 1. Garante que o valor é um número (float). Se for null/undefined/NaN, usa 0.
    const num = parseFloat(valor) || 0; // ✅ CORREÇÃO: Trata null, undefined, "", e NaN como 0.

    // 2. Formata para o padrão Brasileiro
    return num.toLocaleString('pt-BR', { // .toLocaleString é apenas um alias para o Intl.NumberFormat().format()
        style: 'currency',
        currency: 'BRL',
    });
}

function formatarStatusFront(status) {
    if (!status || status === 'Pendente') return "Pendente";
    if (status === "Pago") return "Pago 100%";
    if (status.startsWith("Pago") && !status.includes("%")) {
        const valor = status.replace("Pago", "");
        return valor ? `Pago ${valor}%` : "Pago 100%";
    }
    return status;
}

//  ============== Comprovantes Dinâmicos ==============
// function gerarHTMLComprovanteDinamico(idStaff, filtro, statusTexto, htmlAtual = "") {
//     const statusLimpo = statusTexto ? statusTexto.toLowerCase().trim() : "";
//     const éPagamentoTotal = statusLimpo === "pago 100%" || statusLimpo === "pago";
//     const éPagamentoParcial = statusLimpo.includes("50");
    
//     // Filtra strings "null" vindas do banco ou do front
//     const htmlSeguro = (htmlAtual && htmlAtual !== "null" && htmlAtual !== "undefined") ? htmlAtual : "";

//     const extrairBotao = (tipo) => {
//         if (!htmlSeguro) return null;
//         const div = document.createElement('div');
//         div.innerHTML = htmlSeguro;
//         const botoes = div.querySelectorAll('.btn-ver-comp');
//         for (let b of botoes) {
//             if (b.innerText.includes(tipo)) return b.outerHTML;
//         }
//         return null;
//     };

//     if (filtro.includes('ajuda')) {
//         const btn50 = extrairBotao("50");
//         const btn100 = extrairBotao("100");

//         if (éPagamentoParcial || btn50) {
//             return `
//                 <div style="display:flex; flex-direction: column; gap:5px;">
//                     <div style="display:flex; align-items:center; gap:8px;">
//                         <span style="font-size: 10px; font-weight: bold; min-width: 40px;">1ª Parc:</span>
//                         ${btn50 || renderBotaoUploadUiverse(idStaff, 'ajuda_50')}
//                     </div>
//                     <div style="display:flex; align-items:center; gap:8px;">
//                         <span style="font-size: 10px; font-weight: bold; min-width: 40px;">2ª Parc:</span>
//                         ${btn100 || (éPagamentoTotal ? renderBotaoUploadUiverse(idStaff, 'ajuda_100') : '<span style="font-size:9px; color:var(--text-3);">Aguardando...</span>')}
//                     </div>
//                 </div>`;
//         }

//         if (éPagamentoTotal) {
//             return `
//                 <div style="display:flex; align-items:center; gap:8px;">
//                     <span style="font-size: 10px; font-weight: bold;">Total:</span>
//                     ${btn100 || renderBotaoUploadUiverse(idStaff, 'ajuda_100')}
//                 </div>`;
//         }
//         return '<span style="font-size:9px; color:var(--text-3);">Aguardando Pgto</span>';
//     }

//     return extrairBotao("Ver") || (éPagamentoTotal ? renderBotaoUploadUiverse(idStaff, filtro) : '<span style="font-size:9px; color:var(--text-3);">Aguardando Pgto</span>');
// }

function gerarHTMLComprovanteDinamico(idStaff, filtro, statusTexto, htmlAtual = "") {
    const statusLimpo = statusTexto ? statusTexto.toLowerCase().trim() : "";
    
    // CORREÇÃO: Comparar com minúsculas para bater com statusLimpo
    const pagamentoRejeitado = statusLimpo === "rejeitado" || statusLimpo === "recusado";
    const éPagamentoTotal = statusLimpo === "pago 100%" || statusLimpo === "pago";
    const éPagamentoParcial = statusLimpo.includes("50");
    
    // Filtra strings "null" vindas do banco ou do front
    const htmlSeguro = (htmlAtual && htmlAtual !== "null" && htmlAtual !== "undefined") ? htmlAtual : "";

    // Se estiver rejeitado, bloqueia imediatamente com o cadeado (independente do tipo)
    if (pagamentoRejeitado) {
        return `
            <div style="display:flex; align-items:center; justify-content: center; gap:8px;">
                <span class="check-finalizado" title="Pagamento Rejeitado"><i class="fas fa-lock"></i></span>
            </div>
        `;
    }

    const extrairBotao = (tipo) => {
        if (!htmlSeguro) return null;
        const div = document.createElement('div');
        div.innerHTML = htmlSeguro;
        const botoes = div.querySelectorAll('.btn-ver-comp');
        for (let b of botoes) {
            if (b.innerText.includes(tipo)) return b.outerHTML;
        }
        return null;
    };

    // Ajuda de Custo e Cachê usam o mesmo esquema de 2 parcelas (50% + 100%)
    if (filtro.includes('ajuda') || filtro === 'cache') {
        const prefixo = filtro === 'cache' ? 'cache' : 'ajuda';
        const btn50 = extrairBotao("50");
        const btn100 = extrairBotao("100");

        if (éPagamentoParcial || btn50) {
            return `
                <div style="display:flex; flex-direction: column; gap:5px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-size: 10px; font-weight: bold; min-width: 40px;">1ª Parc:</span>
                        ${btn50 || renderBotaoUploadUiverse(idStaff, `${prefixo}_50`)}
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-size: 10px; font-weight: bold; min-width: 40px;">2ª Parc:</span>
                        ${btn100 || (éPagamentoTotal ? renderBotaoUploadUiverse(idStaff, `${prefixo}_100`) : '<span style="font-size:9px; color:var(--text-3);">Aguardando...</span>')}
                    </div>
                </div>`;
        }

        if (éPagamentoTotal) {
            return `
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="font-size: 10px; font-weight: bold;">Total:</span>
                    ${btn100 || renderBotaoUploadUiverse(idStaff, `${prefixo}_100`)}
                </div>`;
        }
        return '<span style="font-size:9px; color:var(--text-3);">Aguardando Pgto</span>';
    }

    return extrairBotao("Ver") || (éPagamentoTotal ? renderBotaoUploadUiverse(idStaff, filtro) : '<span style="font-size:9px; color:var(--text-3);">Aguardando Pgto</span>');
}

window.handleFileUpload = async function(input, idStaff, tipo, idFuncionario = null, iditem = null) {
    const file = input.files[0];
    if (!file) return;

    const formData = new FormData();


    formData.append('idStaff', idStaff);
    formData.append('tipo', tipo);
    formData.append('contexto', tipo); // Garante que o contexto chegue preenchido
    if (iditem !== null && iditem !== undefined) formData.append('iditem', iditem); // Caixinha: identifica o item dentro do array

    // O arquivo deve ser o ÚLTIMO campo adicionado
    // Verifique se no backend você usa upload.single('arquivo') ou 'comprovante'
    formData.append('arquivo', file);

    // Captura o botão e o container para manipulação imediata
    const container = input.closest('.upload-container-uiverse');
    const btnOriginal = input.nextElementSibling;
    const textoOriginal = btnOriginal ? btnOriginal.innerHTML : '';

    try {
        if (btnOriginal) {
            btnOriginal.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Aguardando...';
            btnOriginal.disabled = true;
        }

        const response = await fetch(`/main/vencimentos/upload-comprovante`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: formData
        });

        if (response.ok) {
            const data = await response.json();
            exibirToastSucesso('Enviado com sucesso!');

            // --- MUDANÇA AQUI: Transforma o botão de Upload em botão de Ver ---
            if (container) {
                const urlCodificada = encodeURIComponent(data.path);
                const label = tipo.includes('50') ? '50%' : (tipo.includes('100') ? '100%' : 'Ver Comp.');
                
                container.outerHTML = `
                    <button class="btn-ver-comp" onclick="abrirComprovanteSwal('${urlCodificada}')" title="Ver ${label}">
                        <i class="fas fa-file-pdf"></i> <small>${label}</small>
                    </button>`;
            }

            // Atualiza os dados em segundo plano para garantir sincronia com o banco
            if (typeof carregarDetalhesVencimentos === 'function') {
                carregarDetalhesVencimentos(document.getElementById('vencimentos-conteudo'), document.getElementById('valores-resumo'));
            }
        } else {
            const err = await response.json();
            Swal.fire('Erro', err.error || 'Falha no upload.', 'error');
            if (btnOriginal) {
                btnOriginal.innerHTML = textoOriginal;
                btnOriginal.disabled = false;
            }
        }
    } catch (error) {
        console.error('Erro:', error);
        if (btnOriginal) {
            btnOriginal.innerHTML = textoOriginal;
            btnOriginal.disabled = false;
        }
    }
};


window.abrirComprovanteSwal = function(encodedUrl) {
    const url = decodeURIComponent(encodedUrl);
    const ext = (url.split('.').pop() || '').toLowerCase();

    const configBase = {
        title: 'Comprovante de Pagamento',
        icon: 'info',
        showCancelButton: true,
        cancelButtonText: 'Fechar',
        confirmButtonColor: '#3085d6',
        denyButtonColor: '#2ecc71',
    };

   // if (ext === 'pdf') {
        Swal.fire({
            ...configBase,
            text: 'Deseja visualizar o PDF ou baixar o arquivo?',
            showDenyButton: true,
            confirmButtonText: '<i class="fas fa-eye"></i> Abrir no Navegador',
            denyButtonText: '<i class="fas fa-download"></i> Baixar PDF',
        }).then(res => {
            if (res.isConfirmed) window.open(url, '_blank');
            else if (res.isDenied) triggerDownload(url);
        });
    // } else {
    //     Swal.fire({
    //         ...configBase,
    //         text: 'Este arquivo é uma imagem ou formato de download. Deseja baixar?',
    //         confirmButtonText: '<i class="fas fa-download"></i> Baixar Arquivo'
    //     }).then(res => { if (res.isConfirmed) triggerDownload(url); });
    // }
};

function triggerDownload(url) {
    const a = document.createElement('a');
    a.href = url;
    a.download = url.split('/').pop();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

window.abrirComprovantesStaff = function(idStaffEvento) {
    const params = new URLSearchParams();
    params.set('idstaffevento', idStaffEvento);
    params.set('focus', 'comprovantes');
    
    const targetUrl = `CadStaff.html?${params.toString()}`;
    if (typeof abrirModalLocal === 'function') abrirModalLocal(targetUrl, 'Staff');
    else if (typeof abrirModal === 'function') abrirModal(targetUrl, 'Staff');
    else window.open(targetUrl, '_blank');
};

window.criarHTMLComprovantes = function(f, tipo) {
    // Ajuda de Custo e Cachê usam o mesmo esquema de 2 parcelas (50% + 100%)
    if (tipo === 'ajuda_custo' || tipo === 'cache') {
        const campo50 = tipo === 'cache' ? f.comppgtocache50 : f.comppgtoajdcusto50;
        const campo100 = tipo === 'cache' ? f.comppgtocache : f.comppgtoajdcusto;

        let html = '<div style="display:flex; flex-direction:column; gap:4px;">';

        // Comprovante 50%
        if (campo50) {
            const url50 = encodeURIComponent(campo50);
            html += `
                <button class="btn-ver-comp" onclick="abrirComprovanteSwal('${url50}')" title="Ver 50%">
                    <i class="fas fa-file-pdf"></i> <small>Ver Comprovante 50%</small>
                </button>`;
        }

        // Comprovante 100%
        if (campo100) {
            const url100 = encodeURIComponent(campo100);
            html += `
                <button class="btn-ver-comp" onclick="abrirComprovanteSwal('${url100}')" title="Ver 100%">
                    <i class="fas fa-file-pdf"></i> <small>Ver Comprovante 100%</small>
                </button>`;
        }

        html += '</div>';
        return html;
    }

    if (tipo === 'ajustefin') {
        if (f.comprovante) {
            const url = encodeURIComponent(f.comprovante);
            return `
                <button class="btn-ver-comp" onclick="abrirComprovanteSwal('${url}')">
                    <i class="fas fa-file-pdf"></i> Ver Comp.
                </button>`;
        }
        return '';
    }

    // Para Caixinha
    const campo = f.comppgtocaixinha;
    if (campo) {
        const url = encodeURIComponent(campo);
        return `
            <button class="btn-ver-comp" onclick="abrirComprovanteSwal('${url}')">
                <i class="fas fa-file-pdf"></i> Ver Comp.
            </button>`;
    }

    return '';
};


function renderBotaoUploadUiverse(idStaff, tipo, idFuncionario = null, iditem = null) {
    const idInput = `file-${tipo}-${idStaff}${iditem !== null ? '-' + iditem : ''}`;
    const idFuncAttr = (idFuncionario !== null) ? idFuncionario : 'null';
    const idItemAttr = (iditem !== null) ? `'${iditem}'` : 'null';

    return `
        <div class="upload-container-uiverse" style="display: inline-block;">
            <input type="file" id="${idInput}" style="display:none"
                   onchange="handleFileUpload(this, ${idStaff}, '${tipo}', ${idFuncAttr}, ${idItemAttr})">
            <button class="btn-uiverse-comprovante"
                    onclick="document.getElementById('${idInput}').click()"
                    style="display: flex; align-items: center; background: #212121; color: var(--on-brand); border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 9px; font-weight: bold;">
                <i class="fas fa-upload" style="margin-right:5px;"></i> COMPROVANTE
            </button>
        </div>
    `;
}

// =============CONTAS A PAGAR==========

function verificarSeEventoEstaNoIntervalo(ev, inicio, fim) {
    const parseData = (dStr) => {
        if (!dStr || dStr === '---') return null;
        const [d, m, y] = dStr.split('/').map(Number);
        return new Date(y, m - 1, d);
    };

    const dAj = parseData(ev.dataVencimentoAjuda);
    const dCh = parseData(ev.dataVencimentoCache);
    
    const vencimentoNaSemana = (dAj && dAj >= inicio && dAj <= fim) || (dCh && dCh >= inicio && dCh <= fim);
    const escalaNaSemana = ev.funcionarios?.some(f => {
        const dF = parseData(f.data);
        return dF && dF >= inicio && dF <= fim;
    });

    return vencimentoNaSemana || escalaNaSemana;
}


function obterIntervaloDatasFiltro() {
    const filtroTipo = document.querySelector('input[name="periodo"]:checked')?.value || 'diario';
    const inputDataStr = document.querySelector("#sub-filtro-data")?.value;
    const mesSel = document.querySelector("#sub-filtro-select")?.value;

    // 1. Pega o ano do Card Financeiro
    const selectAno = document.getElementById('selectAno');
    const anoRef = selectAno ? parseInt(selectAno.value, 10) : new Date().getFullYear();

    let inicio, fim;

    // 2. LÓGICA DE DIA (Selecione o dia)
    if (filtroTipo === 'diario') {
        if (inputDataStr) {
            // Se o usuário escolheu um dia no calendário, usamos esse dia mas FORÇAMOS o ano do Card
            const partes = inputDataStr.split("-"); // [yyyy, mm, dd]
            inicio = new Date(anoRef, partes[1] - 1, partes[2]);
        } else {
            // Se não escolheu, usamos o dia/mês de HOJE mas no ANO do Card
            const hoje = new Date();
            inicio = new Date(anoRef, hoje.getMonth(), hoje.getDate());
        }
        fim = new Date(inicio);
    } 
    // 3. LÓGICA MENSAL
    else if (filtroTipo === "mensal") {
        const mesIndex = mesSel ? (parseInt(mesSel) - 1) : new Date().getMonth();
        inicio = new Date(anoRef, mesIndex, 1);
        fim = new Date(anoRef, mesIndex + 1, 0);
    }
    // 4. LÓGICA TRIMESTRAL
    else if (filtroTipo === "trimestral" || filtroTipo === "trimestre") {
        const mesIndex = mesSel ? (parseInt(mesSel) - 1) : new Date().getMonth();
        const trimInicio = Math.floor(mesIndex / 3) * 3;
        inicio = new Date(anoRef, trimInicio, 1);
        fim = new Date(anoRef, trimInicio + 3, 0);
    }
    // 5. LÓGICA SEMANAL
    else if (filtroTipo === "semanal" && inputDataStr) {
        const partes = inputDataStr.split("-");
        inicio = new Date(anoRef, partes[1] - 1, partes[2]);
        fim = new Date(inicio);
        fim.setDate(inicio.getDate() + 7);
    } else {
        // Fallback: Ano inteiro do Card
        inicio = new Date(anoRef, 0, 1);
        fim = new Date(anoRef, 11, 31);
    }

    inicio.setHours(0, 0, 0, 0);
    fim.setHours(23, 59, 59, 999);

    console.log(`✅ FILTRO SINCRONIZADO COM CARD (${anoRef}): ${inicio.toLocaleDateString()} até ${fim.toLocaleDateString()}`);
    return { inicio, fim };
}


async function carregarDetalhesVencimentos(conteudoGeral, valoresResumoElement) { 
    let contasProjetadas = [];
    let dados = [];
    let contasParaExibir = [];

    if (!conteudoGeral) return;
    conteudoGeral.innerHTML = '<h3>Carregando dados financeiros...</h3>';
   
    if (valoresResumoElement) valoresResumoElement.innerHTML = '';    

    
    const filtroTipo = document.querySelector('input[name="periodo"]:checked')?.value || 'diario';
    const inputDataStr = document.querySelector("#sub-filtro-data")?.value;
    const anoSelecionado = parseInt(document.getElementById('selectAno')?.value) || new Date().getFullYear();

    let dataAlvoBR = "";
    let hojeRelativo = new Date(); // Referência para saber o que é "Vencido"

    if (inputDataStr) {
        const [ano, mes, dia] = inputDataStr.split("-");
        dataAlvoBR = `${dia}/${mes}/${ano}`;
    }

    // Se o usuário está vendo um ano anterior (ex: 2025), o "hoje" para cálculos de 
    // vencimento deve ser o último dia daquele ano, ou os dados nunca aparecerão como "a vencer"
    if (anoSelecionado < new Date().getFullYear()) {
        hojeRelativo = new Date(anoSelecionado, 11, 31, 23, 59, 59);
    } else if (anoSelecionado > new Date().getFullYear()) {
        hojeRelativo = new Date(anoSelecionado, 0, 1, 0, 0, 0);
    }
    hojeRelativo.setHours(0,0,0,0);

    let params = construirParametrosFiltro();

    // 1. Removemos o ano que venha do filtro padrão para não dar conflito
    params = params.split('&').filter(p => !p.startsWith('ano=') && !p.startsWith('?ano=')).join('&');
    if (!params.startsWith('?')) params = '?' + params;

    // 2. Garante a troca de período se necessário
    if (filtroTipo === "diario" || filtroTipo === "semanal") {
        params = params.replace("periodo=diario", "periodo=mensal").replace("periodo=semanal", "periodo=mensal");
    }

    // 3. Agora sim, injeta o ano selecionado no card4
    const paramsComAno = `${params}&ano=${anoSelecionado}`;   

   // console.log("AGORA VAI:", paramsComAno);

    try {
       // const paramsComAno = params.includes("ano=") ? params : `${params}&ano=${anoSelecionado}`;

       // console.log("PARAMSCOMANO", paramsComAno);

        const [resEventos, resContas] = await Promise.all([
            fetchComToken(`/main/vencimentos${paramsComAno}`), 
            fetchComToken(`/main/contas-pagar${paramsComAno}`) // Adicione o parâmetro aqui também
        ]);

        
        dados = resEventos?.eventos || [];

        console.log("DADOS EVENTOS", dados);      

        
        dados = dados.filter(ev => {
            const ajPendente = parseFloat(ev.ajuda?.pendente) || 0;
            const chPendente = parseFloat(ev.cache?.pendente) || 0;
            
            // 1. Identificar competência do evento (Mês/Ano)
            const extrairComp = (ds) => {
                if (!ds || ds === '---') return null;
                const [d, m, a] = ds.split('/').map(Number);
                return (a * 12) + m;
            };

            const compAjuda = extrairComp(ev.dataVencimentoAjuda);
            const compCache = extrairComp(ev.dataVencimentoCache);
            const compAnoAlvo = (anoSelecionado * 12);

            // 2. Definir o Range do Filtro
            const mesInicial = parseInt(document.querySelector("#sub-filtro-select")?.value) || 1;
            const inicioFiltro = compAnoAlvo + mesInicial;
            
            let alcance = 1;
            if (filtroTipo === "trimestral") alcance = 3;
            else if (filtroTipo === "semestral") alcance = 6;
            
            const fimFiltro = inicioFiltro + alcance - 1;

            // 3. LÓGICA DE FILTRAGEM (Prioridade ao Período)
            if (["mensal", "trimestral", "semestral"].includes(filtroTipo)) {
                
                // Verifica se a competência da Ajuda ou do Cachê entra no range
                const ajudaNoPeriodo = (compAjuda >= inicioFiltro && compAjuda <= fimFiltro);
                const cacheNoPeriodo = (compCache >= inicioFiltro && compCache <= fimFiltro);

                // IMPORTANTE: Se for "Aguardando Cadastro", ele pode não ter data de vencimento ainda.
                // Verificamos se há algum indício de data no evento ou se ele pertence ao ano/mês inicial
                const semDataMasNoMes = (!compAjuda && !compCache && mesInicial === (new Date().getMonth() + 1));

                if (ajudaNoPeriodo || cacheNoPeriodo || semDataMasNoMes) {
                    return true; // Deixa passar, independente de estar liquidado ou pendente
                }
                return false; // Fora do período
            }

            // 4. Caso seja filtro Diário
            if (filtroTipo === "diario") {
                return (ev.dataVencimentoAjuda === dataAlvoBR || ev.dataVencimentoCache === dataAlvoBR);
            }

            return true;
        });

        // Configuração visual do filtro caixinha
        const totalCaixinhaGeral = dados.reduce((acc, ev) => acc + (ev.caixinha?.total || 0), 0);
        const radioCaixinhaTopo = document.querySelector('input[name="categoria"][value="caixinha"]');
        if (radioCaixinhaTopo) {
            radioCaixinhaTopo.disabled = totalCaixinhaGeral === 0;
            radioCaixinhaTopo.closest('.option').classList.toggle('disabled-option', totalCaixinhaGeral === 0);
        }

        const categoriaInicial = document.querySelector('input[name="categoria"]:checked')?.value || 'ajuda_custo';

        conteudoGeral.innerHTML = "";
        const accordionContainer = document.createElement("div");
        accordionContainer.className = "accordion-vencimentos";

        // const obterHeaderTabela = (filtro) => {
        //     const podeVerAcoes = usuarioTemPermissaoSupremo();
        //     return `<tr><th>NOME / FUNÇÃO</th><th style="text-align:center">DIÁRIAS</th><th style="text-align:center">PERÍODO</th>${podeVerAcoes ? `<th style="text-align:center">AÇÕES</th>` : ''}<th>COMPROVANTE(S)</th><th>STATUS</th><th>VALOR</th></tr>`;
        // };

        
        // const obterLinhasTabela = (evento, filtro) => {
        //     let lista = evento.funcionarios || [];
        //     if (filtro === 'caixinha') lista = lista.filter(f => (f.totalcaixinha_filtrado || 0) > 0);
        //     if (lista.length === 0) return `<tr><td colspan="10" style="text-align:center; padding: 20px;">Nenhum registro.</td></tr>`;
            
        //     const podeVerAcoes = usuarioTemPermissaoSupremo();

        //     // 1. ORDENAÇÃO: Garante que os registros do mesmo profissional fiquem sempre juntos
        //     lista.sort((a, b) => {
        //         const nomeA = a.nome || '';
        //         const nomeB = b.nome || '';
        //         return nomeA.localeCompare(nomeB);
        //     });

        //     let linhasHtml = '';
            
        //     // Acumuladores para o subtotal do funcionário
        //     let acumuladorDiarias = 0;
        //     let acumuladorValorFinanceiro = 0;

        //     // Mudamos de .map para .forEach para conseguir controlar a quebra de linha de cada funcionário
        //     lista.forEach((f, index) => {
        //         const proximoItem = lista[index + 1];

        //         console.log(`DEBUG VALORES [${f.nome}]:`, {
        //             cache_original: f.totalcache_full,
        //             ajuste_custo: f.totalajustecusto_full,
        //             soma_calculada_no_banco: f.cache_com_ajuste,
        //             caixinha_original: f.totalcaixinha_full,
        //         });

        //         const info = {
        //             'cache': { status: formatarStatusFront(f.statuspgto || "Pendente"), valor: f.cache_com_ajuste, tipoAcao: 'Cache' },
        //             'ajuda_custo': { status: formatarStatusFront(f.statuspgtoajdcto || "Pendente"), valor: f.totalajudacusto_full, tipoAcao: 'Ajuda' },
        //             'caixinha': { status: formatarStatusFront(f.statuscaixinha || "Pendente"), valor: f.totalcaixinha_full, tipoAcao: 'Caixinha' },
        //             'ajuste_custo': { status: formatarStatusFront(f.statuspgtoajstcusto || "Pendente"), valor: f.totalajustecusto_full, tipoAcao: 'Ajuste de Custo' }
        //         }[filtro];
                
        //         // Alimentando os somadores do subtotal
        //         acumuladorDiarias += parseFloat(f.qtddiarias_filtradas || 0);
        //         acumuladorValorFinanceiro += parseFloat(info.valor || 0);

        //         const estaPago = info.status.toLowerCase().startsWith('pago');
        //         const classeStatus = info.status.toLowerCase().replace(/\s+/g, '-').replace('%', '');

        //         const periodoFormatado = `${f.periodo_eventoini_fmt} a ${f.periodo_eventofim_fmt}`;
                
        //         const nomeAtual = (f.nome || '').trim();
        //         const nomeProximo = proximoItem && proximoItem.nome ? proximoItem.nome.trim() : '';
                
        //         // Verifica se o profissional vai mudar na próxima linha ou se a lista acabou
        //         const ehUltimoRegistroDoProfissional = !proximoItem || nomeAtual !== nomeProximo;

        //         // Estilização para dar uma leve separação visual entre os blocos de pessoas
        //         let estiloBordaSeparadora = '';
        //         if (ehUltimoRegistroDoProfissional) {
        //             estiloBordaSeparadora = 'border-bottom: 2px dashed #bbbbbb !important;';
        //         }

        //         // 2. Renderização da Linha Normal
        //         linhasHtml += `
        //             <tr style="${estiloBordaSeparadora}">
        //                 <td>
        //                     <strong>${f.nome}</strong><br>
        //                     <small>${f.funcao}</small>
        //                 </td>

        //                 <td style="text-align:center">
        //                     ${f.qtddiarias_filtradas || 0}
        //                 </td>

        //                 <td style="text-align:center">
        //                     <small>${periodoFormatado || '---'}</small>
        //                 </td>

        //                 ${podeVerAcoes ? `
        //                     <td style="text-align:center">
        //                         ${renderConteudoAcao(f.idstaffevento, info.tipoAcao, info.status)}
        //                     </td>
        //                 ` : ''}

        //                 <td class="comprovantes-cell">
        //                     ${estaPago 
        //                         ? gerarHTMLComprovanteDinamico(f.idstaffevento, filtro, info.status, criarHTMLComprovantes(f, filtro)) 
        //                         : '<span style="font-size:9px; color:var(--text-3);">Aguardando Pgto</span>'
        //                     }
        //                 </td>

        //                 <td class="status-celula status-${classeStatus}">
        //                     ${info.status}
        //                 </td>

        //                 <td>
        //                     ${formatarMoeda(info.valor || 0)}
        //                 </td>
        //             </tr>
        //         `;

        //         // 3. Inserção da linha de Subtotal
        //         if (ehUltimoRegistroDoProfissional) {
        //             // Só exibe a linha de subtotal se a pessoa tiver mais de 1 registro na lista
        //             const temMaisDeUmaLinha = lista.filter(item => 
        //                 (item.nome || '').trim() === nomeAtual
        //             ).length > 1;

        //             if (temMaisDeUmaLinha) {
        //                 linhasHtml += `
        //                 <tr class="row-total" style="background-color: var(--surface-3); border-bottom: 2px dashed #888888 !important;">
        //                     <td style="text-align: right; font-weight: bold; color: var(--text-1);">
        //                         SUBTOTAL ${nomeAtual}:
        //                     </td>
        //                     <td style="text-align: center; font-weight: bold;">
        //                         ${acumuladorDiarias}
        //                     </td>
        //                     <td></td>
        //                     ${podeVerAcoes ? `<td></td>` : ''}
        //                     <td></td>
        //                     <td></td>
        //                     <td style="font-weight: bold; color: var(--text-1);">
        //                         ${formatarMoeda(acumuladorValorFinanceiro)}
        //                     </td>
        //                 </tr>`;
        //             }

        //             // Reseta as variáveis acumuladoras para começar a contar o próximo funcionário
        //             acumuladorDiarias = 0;
        //             acumuladorValorFinanceiro = 0;
        //         }
        //     });

        //     return linhasHtml;
        // };

        const obterHeaderTabela = () => {
            const podeVerAcoes = usuarioTemPermissaoSupremo();
            return `
                <tr>
                    <th>NOME / FUNÇÃO</th>
                    <th style="text-align:center">CATEGORIA</th>
                    <th style="text-align:center">DIÁRIAS</th>
                    <th style="text-align:center">PERÍODO</th>
                    ${podeVerAcoes ? `<th style="text-align:center">AÇÕES</th>` : ''}
                    <th>COMPROVANTE(S)</th>
                    <th>STATUS</th>
                    <th style="text-align:right">VALOR</th>
                </tr>`;
        };

        const obterLinhasTabela = (evento) => {
            let lista = evento.funcionarios || [];
            if (lista.length === 0) {
                return `<tr><td colspan="10" style="text-align:center; padding: 20px;">Nenhum registro.</td></tr>`;
            }

            const podeVerAcoes = usuarioTemPermissaoSupremo();

            // Ordena por nome para agrupar registros do mesmo profissional
            lista.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

            // Agrupa por nome para calcular subtotais
            const grupos = {};
            lista.forEach(f => {
                const nome = (f.nome || '').trim();
                if (!grupos[nome]) grupos[nome] = [];
                grupos[nome].push(f);
            });

            let linhasHtml = '';

            // Status tipo "Pago50" (pagamento parcial em parcelas) só liquidou uma fração do valor —
            // o que ainda falta cobrar dessa linha é o total menos essa fração já paga.
            // "Pago" sem número (100%) e demais status (Pendente/Suspenso/Rejeitado) mantêm o valor cheio.
            const valorConsiderandoParcial = (statusRaw, valorTotal) => {
                const match = String(statusRaw || '').match(/^Pago(\d+)$/);
                if (!match) return valorTotal;
                const percent = Number(match[1]);
                return percent < 100 ? valorTotal * (1 - percent / 100) : valorTotal;
            };

            const CATEGORIAS = [
                {
                    key: 'ajuda_custo',
                    label: 'Ajuda de Custo',
                    badgeClass: 'badge-ajuda',
                    getStatus: f => formatarStatusFront(f.statuspgtoajdcto || 'Pendente'),
                    getValor:  f => valorConsiderandoParcial(f.statuspgtoajdcto, parseFloat(f.totalajudacusto_full || 0)),
                    getDiarias: f => f.qtddiarias_filtradas || 0,
                    tipoAcao: 'Ajuda',
                },
                {
                    key: 'cache',
                    label: 'Cachê',
                    badgeClass: 'badge-cache',
                    getStatus: f => formatarStatusFront(f.statuspgto || 'Pendente'),
                    getValor:  f => valorConsiderandoParcial(f.statuspgto, parseFloat(f.cache_com_ajuste || 0)),
                    getDiarias: f => f.qtddiarias_filtradas || 0,
                    tipoAcao: 'Cache',
                },
                // 'caixinha' saiu de CATEGORIAS — agora é renderizada item a item, num
                // bloco próprio depois deste loop (ver itens_caixinha), não mais como
                // 1 linha agregada aqui.
            ];

            const nomesOrdenados = Object.keys(grupos).sort((a, b) => a.localeCompare(b));
            const filtroSuspenso = (window._filtroEventosAtivo === 'suspenso');

            nomesOrdenados.forEach(nome => {
                const registros = grupos[nome];

                // Ajustes financeiros (crédito/débito) pendentes anexados a qualquer
                // registro deste funcionário neste evento — contam pro rowspan da
                // célula de nome, mas são renderizados uma única vez por registro.
                const totalAjustesGrupo = registros.reduce(
                    (acc, r) => acc + (r.ajustes_financeiros ? r.ajustes_financeiros.length : 0), 0
                );

                // Itens de caixinha (autorizados + pendentes) de todos os registros deste
                // funcionário — cada item ganha sua própria linha (como Crédito/Débito),
                // então conta pro rowspan da célula de nome igual totalAjustesGrupo.
                const totalCaixinhaItensGrupo = registros.reduce(
                    (acc, r) => acc + (r.itens_caixinha ? r.itens_caixinha.length : 0), 0
                );

                // registros.forEach((f, idxF) => {
                //     const periodoFormatado = `${f.periodo_eventoini_fmt} a ${f.periodo_eventofim_fmt}`;
                //     const ehUltimoRegistro = (idxF === registros.length - 1);
                //     //const rowspan = CATEGORIAS.length; // sempre 3

                //     // Antes de entrar no forEach de CATEGORIAS, calcula quantas linhas vão existir
                //     const rowspanTotal = CATEGORIAS.filter(cat => {
                //         if (cat.key === 'caixinha') {
                //             return registros.some(r => parseFloat(r.totalcaixinha_full || 0) > 0);
                //         }
                //         return true;
                //     }).length;

                //     // Acumuladores de subtotal para este funcionário neste registro
                //     // (se houver múltiplos registros por nome, somamos ao final)
                //     let linhasCats = '';

                //     CATEGORIAS.forEach((cat, idxCat) => {
                //         const valor  = cat.getValor(f);
                //         if (cat.key === 'caixinha' && valor <= 0) return;
                //         const status = cat.getStatus(f);
                        
                //         const diarias = cat.getDiarias(f);
                //         const estaPago = status.toLowerCase().startsWith('pago');
                //         const classeStatus = status.toLowerCase().replace(/\s+/g, '-').replace('%', '');

                //         // Só exibe caixinha se tiver valor
                //         const semCaixinha = (cat.key === 'caixinha' && valor <= 0);

                //         // Borda separadora: última categoria do último registro do funcionário
                //         const ehUltimaLinha = (ehUltimoRegistro && idxCat === CATEGORIAS.length - 1);
                //         const estiloBorda = ehUltimaLinha
                //             ? 'border-bottom: 2px dashed #bbbbbb !important;'
                //             : '';

                //         // Célula do nome: apenas na primeira categoria do primeiro registro
                //         const celulaNome = (idxCat === 0)
                //             ? `<td rowspan="${rowspanTotal * registros.length}"
                //                 style="vertical-align:middle; border-right:1px solid #e0e0e0;
                //                         border-bottom:2px dashed #bbbbbb;">
                //                 <strong>${f.nome}</strong><br>
                //                 <small style="color:var(--text-2);">${f.funcao}</small>
                //             </td>`
                //             : '';

                //         linhasCats += `
                //             <tr style="${estiloBorda}">
                //                 ${idxF === 0 ? celulaNome : (idxCat === 0 ? '' : '')}

                //                 <td style="text-align:center">
                //                     <span class="badge-categoria badge-${cat.key}">
                //                         ${cat.label}
                //                     </span>
                //                 </td>

                //                 <td style="text-align:center">
                //                     ${semCaixinha ? '<span style="color:var(--text-3);">—</span>' : diarias}
                //                 </td>

                //                 <td style="text-align:center">
                //                     <small>${semCaixinha ? '—' : periodoFormatado}</small>
                //                 </td>

                //                 ${podeVerAcoes ? `
                //                     <td style="text-align:center">
                //                         ${semCaixinha
                //                             ? '<span style="color:var(--text-3); font-size:11px;">—</span>'
                //                             : renderConteudoAcao(f.idstaffevento, cat.tipoAcao, status)
                //                         }
                //                     </td>
                //                 ` : ''}

                //                 <td class="comprovantes-cell">
                //                     ${semCaixinha
                //                         ? '<span style="font-size:9px; color:var(--text-3);">—</span>'
                //                         : estaPago
                //                             ? gerarHTMLComprovanteDinamico(f.idstaffevento, cat.key, status, criarHTMLComprovantes(f, cat.key))
                //                             : '<span style="font-size:9px; color:var(--text-3);">Aguardando Pgto</span>'
                //                     }
                //                 </td>

                //                 <td class="status-celula status-${classeStatus}">
                //                     ${semCaixinha ? '' : status}
                //                 </td>

                //                 <td style="text-align:right">
                //                     ${semCaixinha
                //                         ? '<span style="color:var(--text-3);">R$ 0,00</span>'
                //                         : formatarMoeda(valor)
                //                     }
                //                 </td>
                //             </tr>`;
                //     });

                //     linhasHtml += linhasCats;
                // });


                registros.forEach((f, idxF) => {
                    const periodoFormatado = `${f.periodo_eventoini_fmt} a ${f.periodo_eventofim_fmt}`;
                    const ehUltimoRegistro = (idxF === registros.length - 1);

                    // Caixinha agora é renderizada item a item (ver bloco após ajustes
                    // financeiros), não mais como 1 linha agregada dentro de CATEGORIAS —
                    // por isso não entra mais no cálculo de rowspan aqui.
                    const rowspanTotal = CATEGORIAS.length;

                    // Registro (Staff) ainda pendente — Ajuda/Cachê/Caixinha deste registro
                    // ficam travados (sem botão de pagamento) até o próprio registro virar
                    // Ativo, independente do status individual deles. "Pendente" é ambíguo
                    // (ver aguardandoInclusaoOrcamento, resolvido no backend): pode ser que
                    // ainda falte autorizar o Aditivo/Extra/FuncExcedido, ou que já esteja
                    // Autorizado e só falte a inclusão no orçamento.
                    const staffPendente = f.statusstaff === 'Pendente';
                    const staffAguardandoOrcamento = staffPendente && !!f.aguardandoInclusaoOrcamento;

                    // Justificativa do Aditivo/Extra/FuncExcedido que travou o registro —
                    // mostrada no lugar dos botões de ação enquanto staffPendente (ver abaixo).
                    const justificativaPend = f.justificativaPendencia || '';
                    const justificativaPendEscapada = justificativaPend.replace(/"/g, '&quot;');
                    const justificativaPendResumida = justificativaPend.length > 30
                        ? justificativaPend.slice(0, 30) + '…'
                        : (justificativaPend || '—');

                    let linhasCats = '';

                //     CATEGORIAS.forEach((cat, idxCat) => {
                //         const valor = cat.getValor(f);
                //         if (cat.key === 'caixinha' && !temCaixinha) return;

                //         const status       = cat.getStatus(f);
                //         const diarias      = cat.getDiarias(f);
                //         const estaPago     = status.toLowerCase().startsWith('pago');
                //         const classeStatus = status.toLowerCase().replace(/\s+/g, '-').replace('%', '');

                //         // A borda tracejada deve aparecer SEMPRE na última categoria de QUALQUER período
                //         const ehUltimaLinha = (cat.key === ultimaCatKey);

                //         // Se for a última linha, bota o tracejado. Se não for, bota uma borda invisível 
                //         // para empurrar o layout e impedir que o tracejado suba.
                //         const estiloBorda = ehUltimaLinha 
                //             ? 'border-bottom: 2px dashed #bbbbbb !important;' 
                //             : 'border-bottom: 1px solid transparent !important;';

                //         // Célula do nome só na primeira categoria do primeiro registro
                //         const celulaNome = (idxCat === 0 && idxF === 0)
                //             ? '<td rowspan="' + (rowspanTotal * registros.length) + '" '
                //                 + 'style="vertical-align:middle; border-right:1px solid #e0e0e0; border-bottom:2px dashed #bbbbbb;">'
                //                 + '<strong>' + f.nome + '</strong><br>'
                //                 + '<small style="color:var(--text-2);">' + f.funcao + '</small>'
                //                 + '</td>'
                //             : '';

                //         // Pré-computa células com lógica condicional — evita template aninhado
                //         const celulaAcoes = podeVerAcoes
                //             ? '<td style="text-align:center; ' + estiloBorda + '">'
                //                 + renderConteudoAcao(f.idstaffevento, cat.tipoAcao, status)
                //                 + '</td>'
                //             : '';

                //         const conteudoComprovante = estaPago
                //             ? gerarHTMLComprovanteDinamico(f.idstaffevento, cat.key, status, criarHTMLComprovantes(f, cat.key))
                //             : '<span style="font-size:9px; color:var(--text-3);">Aguardando Pgto</span>';

                //         linhasCats += '<tr>'
                //             + celulaNome
                //             + '<td style="text-align:center; ' + estiloBorda + '">'
                //                 + '<span class="badge-categoria badge-' + cat.key + '">' + cat.label + '</span>'
                //             + '</td>'
                //             + '<td style="text-align:center; ' + estiloBorda + '">' + diarias + '</td>'
                //             + '<td style="text-align:center; ' + estiloBorda + '"><small>' + periodoFormatado + '</small></td>'
                //             + celulaAcoes
                //             + '<td class="comprovantes-cell" style="' + estiloBorda + '">' + conteudoComprovante + '</td>'
                //             + '<td class="status-celula status-' + classeStatus + '" style="' + estiloBorda + '">' + status + '</td>'
                //             + '<td style="text-align:right; ' + estiloBorda + '">' + formatarMoeda(valor) + '</td>'
                //             + '</tr>';
                //     });

                //     linhasHtml += linhasCats;
                // });


                CATEGORIAS.forEach((cat, idxCat) => {
                        const valor = cat.getValor(f);

                        const status       = staffAguardandoOrcamento
                            ? 'Aguardando Inclusão no Orçamento'
                            : (staffPendente ? 'Pendente de Autorização' : cat.getStatus(f));
                        const diarias      = cat.getDiarias(f);
                        const estaPago     = !staffPendente && status.toLowerCase().startsWith('pago');
                        const classeStatus = staffAguardandoOrcamento
                            ? 'aguardando-orcamento'
                            : (staffPendente ? 'pendente-autorizacao' : status.toLowerCase().replace(/\s+/g, '-').replace('%', ''));

                        // ESTRATÉGIA DE BORDAS:
                        // 1. Todas as linhas ganham uma borda pontilhada sutil para não bugar o CSS da tabela.
                        // 2. A última categoria fixa (Cachê) ganha o tracejado — a menos que
                        // este registro tenha itens de caixinha depois, aí o tracejado passa
                        // pro último item de caixinha (ver bloco após ajustes financeiros).
                        const temCaixinhaRegistro = (f.itens_caixinha || []).length > 0;
                        const ehUltimaLinha = (cat.key === 'cache') && !temCaixinhaRegistro;
                        const pagRejeitado = !staffPendente && (status === 'Rejeitado');
                        
                        let estiloBorda = 'border-bottom: 1px dotted #e0e0e0 !important;'; 
                        
                        if (ehUltimaLinha) {
                            estiloBorda = 'border-bottom: 2px dashed #bbbbbb !important;';
                        }

                        // Célula do nome só na primeira categoria do primeiro registro
                        // const celulaNome = (idxCat === 0 && idxF === 0)
                        //     ? '<td rowspan="' + (rowspanTotal * registros.length) + '" '
                        //         + 'style="vertical-align:middle; border-right:1px solid #e0e0e0; border-bottom:2px dashed #bbbbbb;">'
                        //         + '<strong>' + f.nome + '</strong><br>'
                        //         + '<small style="color:var(--text-2);">' + f.funcao + '</small>'
                        //         + '</td>'
                        //     : '';
                        let celulaNome = '';
                        if (idxCat === 0 && idxF === 0) {
                            
                            // Mapeia as funções na ordem exata dos períodos
                            // e gera uma tag <small> para cada uma delas ficar em uma nova linha
                            const htmlFuncoes = registros.map(r => {
                                return `<small style="display:block; color:#2563eb; font-weight:500; margin-top:3px;">• ${r.funcao}</small>`;
                            }).join('');

                            celulaNome = '<td rowspan="' + (rowspanTotal * registros.length + totalCaixinhaItensGrupo + totalAjustesGrupo) + '" '
                                + 'style="vertical-align:middle; border-right:1px solid #e0e0e0; border-bottom:2px dashed #bbbbbb; padding: 10px;">'
                                + '<strong>' + f.nome + '</strong><br>'
                                + '<div style="margin-top:5px; line-height:1.2;">'
                                + htmlFuncoes
                                + '</div>'
                                + '</td>';
                        }

                        // Pré-computa células com lógica condicional — evita template aninhado
                        const celulaAcoes = podeVerAcoes
                            ? '<td style="text-align:center; ' + estiloBorda + '">'
                                + (staffPendente
                                    // Sem botão possível (registro travado) — em vez de repetir
                                    // "Pendente de Autorização"/"Aguardando Inclusão no Orçamento"
                                    // (já visível na coluna Status), mostra a justificativa real
                                    // do Aditivo/Extra que travou o registro, com o texto completo
                                    // disponível no tooltip.
                                    ? `<small title="${justificativaPendEscapada}">${justificativaPendResumida}</small>`
                                    : renderConteudoAcao(f.idstaffevento, cat.tipoAcao, status))
                                + '</td>'
                            : '';

                        const conteudoComprovante = staffPendente
                            ? '<span style="font-size:9px; color:var(--text-3);">—</span>'
                            : pagRejeitado
                                ? '<i class="fas fa-lock" style="color: var(--text-3);" title="Bloqueado por Rejeição"></i>'
                                : estaPago
                                    ? gerarHTMLComprovanteDinamico(f.idstaffevento, cat.key, status, criarHTMLComprovantes(f, cat.key))
                                    : '<span style="font-size:9px; color:var(--text-3);">Aguardando Pgto</span>';

                        // linhasCats += '<tr>'
                        //     + celulaNome
                        //     + '<td style="text-align:center; ' + estiloBorda + '">'
                        //         + '<span class="badge-categoria badge-' + cat.key + '">' + cat.label + '</span>'
                        //     + '</td>'
                        //     + '<td style="text-align:center; ' + estiloBorda + '">' + diarias + '</td>'
                        //     + '<td style="text-align:center; ' + estiloBorda + '"><small>' + periodoFormatado + '</small></td>'
                        //     + celulaAcoes
                        //     + '<td class="comprovantes-cell" style="' + estiloBorda + '">' + conteudoComprovante + '</td>'
                        //     + '<td class="status-celula status-' + classeStatus + '" style="' + estiloBorda + '">' + status + '</td>'
                        //     + '<td style="text-align:right; ' + estiloBorda + '">' + formatarMoeda(valor) + '</td>'
                        //     + '</tr>';

                        // Agora aplicamos o estilo direto na LINHA (tr), e não nas células (td)
                        const estiloLinha = ehUltimaLinha 
                            ? 'style="border-bottom: 2px dashed #bbbbbb !important;"' 
                            : 'style="border-bottom: 1px dotted #e0e0e0 !important;"';

                        const classeValorRejeitado = pagRejeitado ? 'valor-rejeitado' : '';
                        console.log("ClasseValorRejeitado:", classeValorRejeitado);

                        linhasCats += `<tr ${estiloLinha}>`
                            + celulaNome
                            + '<td style="text-align:center;">'
                                + '<span class="badge-categoria badge-' + cat.key + '">' + cat.label + '</span>'
                            + '</td>'
                            + '<td style="text-align:center;">' + diarias + '</td>'
                            + '<td style="text-align:center;"><small>' + periodoFormatado + '</small></td>'
                            + celulaAcoes
                            + '<td class="comprovantes-cell">' + conteudoComprovante + '</td>'
                            + '<td class="status-celula status-' + classeStatus + '">' + status + '</td>'
                            + `<td class="valor-celula ${classeValorRejeitado}" style="text-align:right;">${formatarMoeda(valor)}</td>`
                            + '</tr>';
                    });

                    // Caixinha — uma linha por item (autorizado OU pendente), com a
                    // justificativa no lugar do período (mesmo padrão de Crédito/Débito),
                    // já que cada item pode ter motivo e valor diferentes. Pagamento agora
                    // é por item (item.statuspgto) — cada item Autorizado tem seu próprio
                    // controle de Pagar/Susp/Rejeitar, independente dos demais do registro.
                    const itensCaixinha = f.itens_caixinha || [];
                    const temAlgumAutorizadoCx = itensCaixinha.some(it => it.status === 'Autorizado');

                    itensCaixinha.forEach((item, idxItem) => {
                        const ehUltimoItemCaixinha = (idxItem === itensCaixinha.length - 1);
                        const estiloLinhaCaixinha = ehUltimoItemCaixinha
                            ? 'style="border-bottom: 2px dashed #bbbbbb !important;"'
                            : 'style="border-bottom: 1px dotted #e0e0e0 !important;"';

                        const justificativaCx = item.justificativa || '';
                        const justificativaCxEscapada = justificativaCx.replace(/"/g, '&quot;');
                        const justificativaCxResumida = justificativaCx.length > 30 ? justificativaCx.slice(0, 30) + '…' : justificativaCx;

                        let statusExibidoCx, classeStatusCx, comprovanteCx;
                        if (staffAguardandoOrcamento) {
                            statusExibidoCx = 'Aguardando Inclusão no Orçamento';
                            classeStatusCx = 'aguardando-orcamento';
                            comprovanteCx = '<span style="font-size:9px; color:var(--text-3);">—</span>';
                        } else if (staffPendente || item.status === 'Pendente') {
                            statusExibidoCx = 'Pendente de Autorização';
                            classeStatusCx = 'pendente-autorizacao';
                            comprovanteCx = '<span style="font-size:9px; color:var(--text-3);">—</span>';
                        } else if (item.status === 'Rejeitado') {
                            statusExibidoCx = 'Rejeitado';
                            classeStatusCx = 'rejeitado';
                            comprovanteCx = '<i class="fas fa-lock" style="color: var(--text-3);" title="Bloqueado por Rejeição"></i>';
                        } else {
                            // Autorizado — o que importa agora é o status de PAGAMENTO
                            // DESTE item (item.statuspgto), não mais o de autorização.
                            statusExibidoCx = formatarStatusFront(item.statuspgto || 'Pendente');
                            classeStatusCx = statusExibidoCx.toLowerCase().replace(/\s+/g, '-').replace('%', '');
                            const estaPagoCx = statusExibidoCx.toLowerCase().startsWith('pago');
                            comprovanteCx = item.comprovante
                                ? `<a href="${item.comprovante}" target="_blank" class="btn-ver-comp" title="Ver comprovante"><i class="fas fa-file-invoice"></i></a>`
                                : (estaPagoCx
                                    ? renderBotaoUploadUiverse(f.idstaffevento, 'caixinha', null, item.iditem)
                                    : '<span style="font-size:9px; color:var(--text-3);">Aguardando Pgto</span>');
                        }

                        let celulaAcoesCx = '';
                        if (podeVerAcoes) {
                            let conteudoAcaoCx = '';
                            if (staffPendente) {
                                // Registro inteiro travado — em vez de repetir o status (já
                                // visível na coluna Status), mostra a justificativa do
                                // Aditivo/Extra que travou o registro, só na última linha.
                                if (ehUltimoItemCaixinha) {
                                    conteudoAcaoCx = `<small title="${justificativaPendEscapada}">${justificativaPendResumida}</small>`;
                                }
                            } else if (item.status === 'Autorizado') {
                                // Cada item Autorizado tem seu próprio controle de pagamento,
                                // independente dos outros itens do mesmo registro.
                                conteudoAcaoCx = renderConteudoAcao(f.idstaffevento, 'Caixinha', formatarStatusFront(item.statuspgto || 'Pendente'), null, item.iditem);
                            } else if (!temAlgumAutorizadoCx && ehUltimoItemCaixinha) {
                                // Nenhum item autorizado ainda — nada a pagar.
                                conteudoAcaoCx = '<span class="check-finalizado"><i class="fas fa-lock" style="color: var(--text-3);" title="Nenhuma caixinha autorizada"></i></span>';
                            }
                            celulaAcoesCx = '<td style="text-align:center;">' + conteudoAcaoCx + '</td>';
                        }

                        linhasCats += `<tr ${estiloLinhaCaixinha}>`
                            + '<td style="text-align:center;">'
                                + '<span class="badge-categoria badge-caixinha">Caixinha</span>'
                            + '</td>'
                            + '<td style="text-align:center;">—</td>'
                            + `<td style="text-align:center;" title="${justificativaCxEscapada}"><small>${justificativaCxResumida}</small></td>`
                            + celulaAcoesCx
                            + '<td class="comprovantes-cell">' + comprovanteCx + '</td>'
                            + `<td class="status-celula status-${classeStatusCx}">${statusExibidoCx}</td>`
                            + `<td class="valor-celula" style="text-align:right;">${formatarMoeda(item.valor)}</td>`
                            + '</tr>';
                    });

                    // Crédito/Débito de funcionário (staffajustefinanceiro) — anexado pelo
                    // backend à ocorrência mais próxima. Reaproveita os mesmos botões
                    // Pagar/Susp./Rejeitar via renderConteudoAcao(id, 'AjusteFin', status).
                    (f.ajustes_financeiros || []).forEach((a, idxAjuste) => {
                        const statusAjuste = formatarStatusFront(a.status || 'Pendente');
                        const classeStatusAjuste = statusAjuste.toLowerCase().replace(/\s+/g, '-').replace('%', '');
                        const ehUltimaLinhaAjuste = (idxAjuste === f.ajustes_financeiros.length - 1);
                        const estiloLinhaAjuste = ehUltimaLinhaAjuste
                            ? 'style="border-bottom: 2px dashed #bbbbbb !important;"'
                            : 'style="border-bottom: 1px dotted #e0e0e0 !important;"';
                        const corAjuste = a.tipo === 'Credito' ? '#16a34a' : '#dc2626';
                        const labelAjuste = a.tipo === 'Credito' ? 'Crédito' : 'Débito';
                        const justificativa = a.justificativa || '';
                        const justificativaEscapada = justificativa.replace(/"/g, '&quot;');
                        const justificativaResumida = justificativa.length > 30 ? justificativa.slice(0, 30) + '…' : justificativa;
                        // Nunca refere o próprio evento que já está sendo exibido — só o "outro": se
                        // este é o evento de origem (e foi pago em outro lugar), mostra onde pagou;
                        // se este é um evento diferente da origem (pago aqui, ou ainda pendente em
                        // broadcast), mostra de onde veio.
                        const nota = a.notaEventoRelacionado;
                        const notaEventoAjusteHtml = !nota ? '' : (nota.tipo === 'pago'
                            ? `<br><small style="color:#198754; font-size:0.80em; font-weight: bold;" title="Pagamento confirmado em outro evento">Pago no evento: ${nota.nomeEvento || '—'}</small>`
                            : `<br><small style="color:#e91818; font-size:0.80em; font-weight: bold;" title="Evento de origem da solicitação">Origem: ${nota.nomeEvento || '—'}</small>`);

                        const celulaAcoesAjuste = podeVerAcoes
                            ? '<td style="text-align:center;">' + renderConteudoAcao(a.idajustefinanceiro, 'AjusteFin', statusAjuste, f.idstaffevento) + '</td>'
                            : '';

                        const pagoAjuste = statusAjuste.toLowerCase().startsWith('pago');
                        const rejeitadoAjuste = statusAjuste === 'Rejeitado';
                        const conteudoComprovanteAjuste = rejeitadoAjuste
                            ? '<i class="fas fa-lock" style="color: var(--text-3);" title="Bloqueado por Rejeição"></i>'
                            : pagoAjuste
                                ? gerarHTMLComprovanteDinamico(a.idajustefinanceiro, 'ajustefin', statusAjuste, criarHTMLComprovantes(a, 'ajustefin'))
                                : '<span style="font-size:9px; color:var(--text-3);">Aguardando Pgto</span>';

                        linhasCats += `<tr ${estiloLinhaAjuste}>`
                            + '<td style="text-align:center;">'
                                + `<span style="padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;color:#fff;background:${corAjuste};">${labelAjuste}</span>`
                            + '</td>'
                            + '<td style="text-align:center;">—</td>'
                            + `<td style="text-align:center;" title="${justificativaEscapada}"><small>${justificativaResumida}</small>${notaEventoAjusteHtml}</td>`
                            + celulaAcoesAjuste
                            + '<td class="comprovantes-cell">' + conteudoComprovanteAjuste + '</td>'
                            + `<td class="status-celula status-${classeStatusAjuste}">${statusAjuste}</td>`
                            + `<td class="valor-celula" style="text-align:right; color:${corAjuste};">${a.tipo === 'Credito' ? '' : '-'}${formatarMoeda(a.valor)}</td>`
                            + '</tr>';
                    });

                    linhasHtml += linhasCats;
                });

                
                // FORA do forEach de categorias — calcula uma vez por funcionário


                
                // Subtotal por funcionário (se tiver mais de 1 registro/evento)
                // if (registros.length > 1) {
                //     const totalDiarias = registros.reduce((s, f) => s + parseFloat(f.qtddiarias_filtradas || 0), 0);
                //     const totalValor   = registros.reduce((s, f) => {
                //         return s
                //             + parseFloat(f.totalajudacusto_full || 0)
                //             + parseFloat(f.cache_com_ajuste || 0)
                //             + parseFloat(f.totalcaixinha_full || 0);
                //     }, 0);

                //     linhasHtml += `
                //         <tr class="row-total" style="background:var(--surface-3); border-bottom:2px dashed #888 !important;">
                //             <td colspan="2" style="text-align:right; font-weight:bold; color:var(--text-1);">
                //                 SUBTOTAL ${nome}:
                //             </td>
                //             <td style="text-align:center; font-weight:bold;">${totalDiarias}</td>
                //             <td></td>
                //             ${podeVerAcoes ? '<td></td>' : ''}
                //             <td></td>
                //             <td></td>
                //             <td style="text-align:right; font-weight:bold;">${formatarMoeda(totalValor)}</td>
                //         </tr>`;
                // }

                // Subtotal por funcionário (se tiver mais de 1 registro/evento)
                // if (registros.length > 1) {
                //     const totalDiarias = registros.reduce((s, f) => s + parseFloat(f.qtddiarias_filtradas || 0), 0);

                //     const totalAjuda   = registros.reduce((s, f) => s + parseFloat(f.totalajudacusto_full || 0), 0);
                //     const totalCache   = registros.reduce((s, f) => s + parseFloat(f.cache_com_ajuste || 0), 0);
                //     const totalCaixinha = registros.reduce((s, f) => s + parseFloat(f.totalcaixinha_full || 0), 0);
                //     const totalGeral   = totalAjuda + totalCache + totalCaixinha;

                //     linhasHtml += `
                //         <tr class="row-total" style="background:var(--surface-3); border-bottom:2px dashed #888 !important;">
                //             <td style="text-align:right; font-weight:bold; color:var(--text-1); font-size:12px;">
                //                 SUBTOTAL<br><small style="color:var(--text-2); font-weight:400;">${nome}</small>
                //             </td>
                //             <td colspan="${podeVerAcoes ? 5 : 4}" style="padding: 6px 10px;">
                //                 <div style="display:flex; flex-wrap:wrap; gap:10px; align-items:center; font-size:12px;">

                //                     <span style="display:inline-flex; flex-direction:column; align-items:center;
                //                                 background:#e8f0fe; border:1px solid #b4ccf8;
                //                                 border-radius:8px; padding:4px 10px; min-width:90px;">
                //                         <span style="font-size:10px; color:#1a56db; font-weight:500;">Ajuda de Custo</span>
                //                         <strong style="color:#1a56db;">${formatarMoeda(totalAjuda)}</strong>
                //                     </span>

                //                     <span style="display:inline-flex; flex-direction:column; align-items:center;
                //                                 background:#fff8e6; border:1px solid #fcd34d;
                //                                 border-radius:8px; padding:4px 10px; min-width:90px;">
                //                         <span style="font-size:10px; color:#b45309; font-weight:500;">Cachê</span>
                //                         <strong style="color:#b45309;">${formatarMoeda(totalCache)}</strong>
                //                     </span>

                //                     <span style="display:inline-flex; flex-direction:column; align-items:center;
                //                                 background:#ecfdf5; border:1px solid #6ee7b7;
                //                                 border-radius:8px; padding:4px 10px; min-width:90px;">
                //                         <span style="font-size:10px; color:#065f46; font-weight:500;">Caixinha</span>
                //                         <strong style="color:#065f46;">${formatarMoeda(totalCaixinha)}</strong>
                //                     </span>

                //                     ${totalCaixinha > 0 ? `
                //                         <span style="display:inline-flex; flex-direction:column; align-items:center; 
                //                                     background:#ecfdf5; border:1px solid #6ee7b7; 
                //                                     border-radius:8px; padding:4px 10px; min-width:90px;">
                                                    
                //                             <span style="font-size:10px; color:#065f46; font-weight:500;">
                //                                 Caixinha
                //                             </span>
                                            
                //                             <strong style="color:#065f46;">
                //                                 ${formatarMoeda(totalCaixinha)}
                //                             </strong>
                                            
                //                         </span>
                //                     ` : ''}

                                   

                //                 </div>
                //             </td>
                //             <td style="text-align:center; font-weight:bold; color:var(--text-1); font-size:12px;">
                //                 ${totalDiarias} diárias
                //             </td>
                //         </tr>`;
                // }

                // Subtotal por funcionário (se tiver mais de 1 registro/evento)
                // if (registros.length > 1) {
                //     const totalDiarias = registros.reduce((s, f) => s + parseFloat(f.qtddiarias_filtradas || 0), 0);

                //     const totalAjuda   = registros.reduce((s, f) => s + parseFloat(f.totalajudacusto_full || 0), 0);
                //     const totalCache   = registros.reduce((s, f) => s + parseFloat(f.cache_com_ajuste || 0), 0);
                //     const totalCaixinha = registros.reduce((s, f) => s + parseFloat(f.totalcaixinha_full || 0), 0);

                //     linhasHtml += `
                //         <tr class="row-total" style="background:var(--surface-3); border-bottom:3px solid #666 !important;">
                //             <td colspan="${podeVerAcoes ? 7 : 6}" style="padding: 10px 15px;">
                //                 <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; font-size: 13px;">
                                    
                //                     <span>
                //                         <strong style="color:var(--text-1);">TOTAL DO FUNCIONÁRIO:</strong> 
                //                         <span style="color:var(--text-1); font-weight: 500;">${nome}</span>
                //                         <span style="margin-left: 15px; background: var(--surface-4); padding: 2px 8px; border-radius: 4px; font-weight: bold;">
                //                             ${totalDiarias} diárias
                //                         </span>
                //                     </span>

                //                     <div style="display: flex; gap: 20px; font-weight: bold;">
                                        
                //                         <span style="color: #1a56db;">
                //                             <small style="font-weight: normal; color: var(--text-2);">Ajuda de Custo: </small>
                //                             ${formatarMoeda(totalAjuda)}
                //                         </span>

                //                         <span style="color: #b45309;">
                //                             <small style="font-weight: normal; color: var(--text-2);">Cachê: </small>
                //                             ${formatarMoeda(totalCache)}
                //                         </span>

                //                         ${totalCaixinha > 0 ? `
                //                             <span style="color: #065f46;">
                //                                 <small style="font-weight: normal; color: var(--text-2);">Caixinha: </small>
                //                                 ${formatarMoeda(totalCaixinha)}
                //                             </span>
                //                         ` : ''}
                                        
                //                     </div>
                //                 </div>
                //             </td>
                            
                //             <td></td> 
                //         </tr>`;
                // }

                // --- FORA DO FOR EACH DE REGISTROS ---
                
                // Cálculo dos totais do funcionário (aparece para TODOS). Registro com
                // statusstaff='Pendente' não entra em nenhum total — a escala ainda não
                // foi autorizada, então não é uma obrigação confirmada ainda.
                const totalDiarias = registros.reduce((s, f) => {
                    if (f.statusstaff === 'Pendente') return s;
                    return f.statuspgto === 'Rejeitado' ? s : s + parseFloat(f.qtddiarias_filtradas || 0);
                }, 0);

                const totalAjuda = registros.reduce((s, f) => {
                    if (f.statusstaff === 'Pendente') return s;
                    // Verifica status da ajuda de custo especificamente, se houver um campo próprio
                    return f.statuspgtoajdcto === 'Rejeitado' ? s : s + valorConsiderandoParcial(f.statuspgtoajdcto, parseFloat(f.totalajudacusto_full || 0));
                }, 0);

                const totalCache = registros.reduce((s, f) => {
                    if (f.statusstaff === 'Pendente') return s;
                    return f.statuspgto === 'Rejeitado' ? s : s + valorConsiderandoParcial(f.statuspgto, parseFloat(f.cache_com_ajuste || 0));
                }, 0);

                // Caixinha: pagamento por item — soma cada item Autorizado pelo seu próprio
                // statuspgto (f.statuscaixinha/f.totalcaixinha_full não refletem mais isso).
                const totalCaixinha = registros.reduce((s, f) => {
                    if (f.statusstaff === 'Pendente') return s;
                    const itensCx = f.itens_caixinha || [];
                    return s + itensCx
                        .filter(it => it.status === 'Autorizado' && it.statuspgto !== 'Rejeitado')
                        .reduce((sc, it) => sc + valorConsiderandoParcial(it.statuspgto, parseFloat(it.valor) || 0), 0);
                }, 0);

                // Crédito soma ao total (empresa deve ao funcionário), Débito subtrai (funcionário deve à empresa).
                // Só conta se ainda estiver Pendente/Suspenso (em aberto), ou se Pago E este for o evento
                // onde de fato foi pago — quando é só a referência no evento de origem (notaEventoRelacionado
                // do tipo 'pago', indicando que foi quitado em outro evento), não soma aqui pra não contar em dobro.
                const totalAjustesFinanceiros = registros.reduce((s, f) => {
                    return s + (f.ajustes_financeiros || []).reduce((sa, a) => {
                        if (a.status === 'Rejeitado') return sa;
                        if (a.notaEventoRelacionado?.tipo === 'pago') return sa;
                        const valor = parseFloat(a.valor) || 0;
                        return sa + (a.tipo === 'Credito' ? valor : -valor);
                    }, 0);
                }, 0);

                // O total geral do funcionário somando tudo
                const totalGeralFuncionario = totalAjuda + totalCache + totalCaixinha + totalAjustesFinanceiros;

                // Quanto desse total já foi de fato pago — mesma regra 100%/50% de
                // valorConsiderandoParcial, só que pro lado "já pago" em vez de "resta pagar".
                // "A Pagar" sai por subtração do Total, garantindo Total = Pagos + A Pagar
                // sempre, mesmo que uma categoria tenha alguma regra própria de exclusão.
                const calcPagoCategoria = (statusRaw, valorTotal) => {
                    const match = String(statusRaw || '').match(/^Pago(\d+)?$/);
                    if (!match) return 0; // Pendente/Suspenso/Rejeitado — nada pago ainda
                    const percent = match[1] ? Number(match[1]) : 100;
                    return valorTotal * (percent / 100);
                };

                const totalAjudaPago = registros.reduce((s, f) => {
                    if (f.statusstaff === 'Pendente') return s;
                    return s + calcPagoCategoria(f.statuspgtoajdcto, parseFloat(f.totalajudacusto_full || 0));
                }, 0);

                const totalCachePago = registros.reduce((s, f) => {
                    if (f.statusstaff === 'Pendente') return s;
                    return s + calcPagoCategoria(f.statuspgto, parseFloat(f.cache_com_ajuste || 0));
                }, 0);

                const totalCaixinhaPago = registros.reduce((s, f) => {
                    if (f.statusstaff === 'Pendente') return s;
                    const itensCx = f.itens_caixinha || [];
                    return s + itensCx
                        .filter(it => it.status === 'Autorizado')
                        .reduce((sc, it) => sc + calcPagoCategoria(it.statuspgto, parseFloat(it.valor) || 0), 0);
                }, 0);

                const totalAjustesPago = registros.reduce((s, f) => {
                    return s + (f.ajustes_financeiros || []).reduce((sa, a) => {
                        if (a.status !== 'Pago') return sa;
                        if (a.notaEventoRelacionado?.tipo === 'pago') return sa;
                        const valor = parseFloat(a.valor) || 0;
                        return sa + (a.tipo === 'Credito' ? valor : -valor);
                    }, 0);
                }, 0);

                const totalPagoFuncionario = totalAjudaPago + totalCachePago + totalCaixinhaPago + totalAjustesPago;
                const totalAPagarFuncionario = totalGeralFuncionario - totalPagoFuncionario;

                // Valor ainda sem decisão nenhuma (nem Autorizado nem Rejeitado) — registro
                // com statusstaff='Pendente' genuíno (exclui o caso "aguardando inclusão no
                // orçamento", que já foi Autorizado) soma seu valor inteiro, e item de
                // caixinha Pendente soma o próprio valor mesmo num registro Ativo.
                const totalPendenteAutorizacao = registros.reduce((s, f) => {
                    const itensPendentesCx = (f.itens_caixinha || [])
                        .filter(it => it.status === 'Pendente')
                        .reduce((si, it) => si + (parseFloat(it.valor) || 0), 0);

                    if (f.statusstaff === 'Pendente' && !f.aguardandoInclusaoOrcamento) {
                        const vAjuda = parseFloat(f.totalajudacusto_full || 0);
                        const vCache = parseFloat(f.cache_com_ajuste || 0);
                        const vCaixinhaAutorizada = parseFloat(f.totalcaixinha_full || 0);
                        return s + vAjuda + vCache + vCaixinhaAutorizada + itensPendentesCx;
                    }
                    return s + itensPendentesCx;
                }, 0);

                // Monta a linha de total (Agora sem a trava de registros.length > 1)
                linhasHtml += `
                    <tr class="row-total" style="background:var(--surface-3); border-bottom:3px solid #666 !important;">
                        <td colspan="${podeVerAcoes ? 7 : 6}" style="padding: 10px 15px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; font-size: 13px;">
                                
                                <span>
                                    <strong style="color:var(--text-1);">TOTAL DO FUNCIONÁRIO:</strong> 
                                    <span style="color:var(--text-1); font-weight: 500;">${nome}</span>
                                    <span style="margin-left: 15px; background: var(--surface-4); padding: 2px 8px; border-radius: 4px; font-weight: bold;">
                                        ${totalDiarias} diárias
                                    </span>
                                </span>

                                <div style="display: flex; gap: 20px; font-weight: bold; align-items: center;">
                                    
                                    <span style="color: #1a56db;">
                                        <small style="font-weight: normal; color: var(--text-2);">Ajuda de Custo: </small>
                                        ${formatarMoeda(totalAjuda)}
                                    </span>

                                    <span style="color: #b45309;">
                                        <small style="font-weight: normal; color: var(--text-2);">Cachê: </small>
                                        ${formatarMoeda(totalCache)}
                                    </span>

                                    ${totalCaixinha > 0 ? `
                                        <span style="color: #065f46;">
                                            <small style="font-weight: normal; color: var(--text-2);">Caixinha: </small>
                                            ${formatarMoeda(totalCaixinha)}
                                        </span>
                                    ` : ''}

                                    ${totalAjustesFinanceiros !== 0 ? `
                                        <span style="color: ${totalAjustesFinanceiros >= 0 ? '#16a34a' : '#dc2626'};">
                                            <small style="font-weight: normal; color: var(--text-2);">Créd/Déb: </small>
                                            ${formatarMoeda(totalAjustesFinanceiros)}
                                        </span>
                                    ` : ''}

                                    ${totalPendenteAutorizacao > 0 ? `
                                        <span style="color: #eab308;">
                                            <small style="font-weight: normal; color: var(--text-2);">Pendentes de Autorização: </small>
                                            ${formatarMoeda(totalPendenteAutorizacao)}
                                        </span>
                                    ` : ''}

                                    <span style="color: var(--text-1); margin-left: 10px; border-left: 1px solid #ccc; padding-left: 15px;">
                                        <small style="font-weight: normal; color: var(--text-2);">Total: </small>
                                        ${formatarMoeda(totalGeralFuncionario)}
                                    </span>

                                    <span style="color: #16a34a;">
                                        <small style="font-weight: normal; color: var(--text-2);">Pagos: </small>
                                        ${formatarMoeda(totalPagoFuncionario)}
                                    </span>

                                    <span style="color: #b91c1c;">
                                        <small style="font-weight: normal; color: var(--text-2);">A Pagar: </small>
                                        ${formatarMoeda(totalAPagarFuncionario)}
                                    </span>

                                </div>
                            </div>
                        </td>
                        
                        <td></td> 
                    </tr>`;
            });

            return linhasHtml;
        };

        if (dados.length > 0) {

            const resumoStaffMestre = dados.reduce((acc, ev) => {
                const hojeBR = hojeRelativo.toLocaleDateString('pt-BR');

                // Função auxiliar para classificar cada componente
                const classificar = (dataStr, valorPendente) => {
                    if (!dataStr || dataStr === '---' || valorPendente <= 0) return;
                    const [d, m, a] = dataStr.split('/').map(Number);
                    const dtVcto = new Date(a, m - 1, d);
                    dtVcto.setHours(0,0,0,0);

                    if (ehMesmoDia(dtVcto, hojeRelativo)) {
                        acc.hoje += valorPendente;
                    } else if (dtVcto < hojeRelativo) {
                        acc.vencido += valorPendente;
                    } else {
                        acc.aVencer += valorPendente;
                    }
                };

                // Pagos (Soma tudo)
                acc.pago += (parseFloat(ev.cache?.pago) || 0) + (parseFloat(ev.ajuda?.pago) || 0) + (parseFloat(ev.caixinha?.pago) || 0);

                // Evento sem funcionários cadastrados ainda fica na aba "Aguardando Staff" (ver
                // categoriasFiltro logo abaixo, na montagem dos itens) — o pendente dele NÃO é
                // vencido/hoje/a vencer/suspenso pra quem filtra a tela, então também não pode
                // virar nenhum desses buckets aqui, senão o header soma dinheiro que nenhuma aba
                // mostra (era essa a causa do "A Vencer" do header não bater com a aba A Vencer).
                const temFuncionarios = ev.funcionarios && ev.funcionarios.length > 0;
                if (!temFuncionarios) {
                    acc.aguardando += (parseFloat(ev.ajuda?.pendente) || 0) + (parseFloat(ev.cache?.pendente) || 0) + (parseFloat(ev.caixinha?.pendente) || 0);
                    acc.total = acc.pago + acc.vencido + acc.hoje + acc.aVencer + acc.suspenso + acc.aguardando;
                    return acc;
                }

                // Pendentes (Classifica individualmente Ajuda, Cachê e Caixinha por data própria)
                classificar(ev.dataVencimentoAjuda, parseFloat(ev.ajuda?.pendente) || 0);
                classificar(ev.dataVencimentoCache, parseFloat(ev.cache?.pendente) || 0);
                const cxPendenteMestre = parseFloat(ev.caixinha?.pendente) || 0;
                if (ev.dataVencimentoCaixinha && ev.dataVencimentoCaixinha !== '---') {
                    classificar(ev.dataVencimentoCaixinha, cxPendenteMestre);
                } else {
                    // Sem data própria pra classificar: mantém o comportamento antigo (cai em A Vencer)
                    acc.aVencer += cxPendenteMestre;
                }

                // Suspenso é campo à parte de "pendente" (ver ajSuspenso/chSuspenso mais acima
                // no arquivo) — antes não entrava em NENHUM bucket aqui (nem vencido, nem a
                // vencer, nem total), ficando invisível também pro lado de Staff.
                acc.suspenso += (parseFloat(ev.ajuda?.suspenso) || 0) + (parseFloat(ev.cache?.suspenso) || 0) + (parseFloat(ev.caixinha?.suspenso) || 0);

                acc.total = acc.pago + acc.vencido + acc.hoje + acc.aVencer + acc.suspenso + acc.aguardando;
                return acc;
            }, { pago: 0, vencido: 0, hoje: 0, aVencer: 0, total: 0, suspenso: 0, aguardando: 0 });

            const btnMestreEventos = document.createElement('button');
            btnMestreEventos.className = 'accordion-mestre-header';            
           

            btnMestreEventos.innerHTML = `
                <div class="evento-info-container-inline">
                    <div class="evento-titulo-col">
                        <span class="setinha">▶</span> 📅 Pagamentos de Staff (Eventos) 
                        <div class="qtdTotal"><small>(${dados.length} eventos)</small></div>
                    </div>
                    <div class="evento-valores-col">
                        <div class="fin-resumo-item">
                            <span class="label-categoria">PAGOS:</span>
                            <span class="pg">${formatarMoeda(resumoStaffMestre.pago)}</span>
                        </div>
                        <div class="fin-resumo-item">
                            <span class="label-categoria" style="color: #d9534f;">VENCIDOS:</span>
                            <span class="ap" style="color: #d9534f; font-weight: bold;">${formatarMoeda(resumoStaffMestre.vencido)}</span>
                        </div>
                        ${resumoStaffMestre.hoje > 0 ? `
                        <div class="fin-resumo-item">
                            <span class="label-categoria" style="color: #b8860b;">HOJE:</span>
                            <span class="ap" style="color: #b8860b; font-weight: bold;">${formatarMoeda(resumoStaffMestre.hoje)}</span>
                        </div>` : ''}
                        <div class="fin-resumo-item">
                            <span class="label-categoria" style="color: #007bff;">A VENCER:</span>
                            <span class="ap" style="color: #007bff; font-weight: bold;">${formatarMoeda(resumoStaffMestre.aVencer)}</span>
                        </div>
                        ${resumoStaffMestre.suspenso > 0 ? `
                        <div class="fin-resumo-item">
                            <span class="label-categoria" style="color: #c05621;" title="Nem vencido nem a vencer — pausado até alguém reativar ou resolver.">SUSPENSO:</span>
                            <span class="ap" style="color: #c05621; font-weight: bold;">${formatarMoeda(resumoStaffMestre.suspenso)}</span>
                        </div>` : ''}
                        ${resumoStaffMestre.aguardando > 0 ? `
                        <div class="fin-resumo-item">
                            <span class="label-categoria" style="color: var(--text-2);" title="Evento ainda sem funcionários cadastrados — não entra em Vencidos/Hoje/A Vencer até ter staff.">AGUARDANDO STAFF:</span>
                            <span class="ap" style="color: var(--text-2); font-weight: bold;">${formatarMoeda(resumoStaffMestre.aguardando)}</span>
                        </div>` : ''}
                        <div class="fin-resumo-item orcado">
                            <span class="label-categoria">TOTAL:</span>
                            <strong>${formatarMoeda(resumoStaffMestre.total)}</strong>
                        </div>
                    </div>
                </div>`;
            
            const wrapperEventos = document.createElement('div');
            wrapperEventos.id = 'container-mestre-eventos';
            wrapperEventos.style.display = 'none'; // Deixa aberto por padrão se houver dados

            btnMestreEventos.onclick = () => {
                wrapperEventos.style.display = wrapperEventos.style.display === 'block' ? 'none' : 'block';
                btnMestreEventos.classList.toggle('active');
            };
           

            accordionContainer.appendChild(btnMestreEventos);
            accordionContainer.appendChild(wrapperEventos);

            // Criar container de filtros rápidos
            const containerFiltrosRapidos = document.createElement("div");
            containerFiltrosRapidos.className = "filtros-rapidos-eventos";
            containerFiltrosRapidos.style="margin-bottom: 15px; display: flex; gap: 10px; flex-wrap: wrap; background: var(--surface-3); padding: 10px; border-radius: 8px; border: 1px solid #ddd;";

            const opcoesFiltro = [                
                { id: 'vencidos',   label: 'Vencidos',         color: '#d9534f' },
                { id: 'hoje',       label: 'Hoje',             color: '#f0ad4e' },
                { id: 'a_vencer',   label: 'A Vencer',         color: '#007bff' },
                { id: 'aguardando', label: 'Aguardando Staff', color: '#6c757d' },
                { id: 'suspenso',    label: 'Suspensos',       color: '#ff7b00' },
                { id: 'liquidado',  label: 'Liquidados',       color: '#28a745' },
                { id: 'todos',      label: 'Todos',            color: '#000000' }
            ];

            opcoesFiltro.forEach(opt => {
                const btn = document.createElement("button");
                btn.innerText = opt.label;
                btn.className = "btn-filtro-rapido";
                btn.dataset.filter = opt.id;
                btn.style=`padding: 6px 12px; border-radius: 20px; border: 1px solid ${opt.color}; background: var(--surface-1); color: ${opt.color}; cursor: pointer; font-weight: 500; transition: 0.3s;`;
                
                if(opt.id === 'hoje') {
                    btn.style.background = opt.color;
                    btn.style.color = "white";
                }

                btn.onclick = () => {
                    // Resetar estilos de todos os botões
                    containerFiltrosRapidos.querySelectorAll(".btn-filtro-rapido").forEach(b => {
                        const bColor = b.style.borderColor;
                        b.style.background = "var(--surface-1)";
                        b.style.color = bColor;
                    });
                    // Ativar botão clicado
                    btn.style.background = opt.color;
                    btn.style.color = "white";

                    window._filtroEventosAtivo = opt.id;
                    
                    filtrarEventosNaTela(opt.id);
                    wrapperEventos.querySelectorAll(".accordion-item.active").forEach(itemAberto => {
                        const eventoId = parseInt(itemAberto.dataset.eventoId);
                        const eventoObj = dados.find(ev => ev.idevento === eventoId);
                        if (!eventoObj) return;

                        const tbody = itemAberto.querySelector(".tabela-funcionarios-venc tbody");
                        if (tbody) tbody.innerHTML = obterLinhasTabela(eventoObj);
                    });
                };
                containerFiltrosRapidos.appendChild(btn);
            });

            // Busca por evento — digite o nome e pressione Enter (ou clique na opção) pra pular
            // direto pro evento, trocando automaticamente pra aba (Vencidos/Hoje/A Vencer/...) onde ele está.
            const buscaEventoWrapper = document.createElement("div");
            buscaEventoWrapper.style = "min-width: 240px;";
            buscaEventoWrapper.innerHTML = `<select id="buscaEventoVencimentos" style="width:100%;"><option value=""></option></select>`;
            containerFiltrosRapidos.appendChild(buscaEventoWrapper);

            const selectBuscaEvento = buscaEventoWrapper.querySelector("#buscaEventoVencimentos");
            dados.forEach(ev => {
                const option = document.createElement("option");
                option.value = ev.idevento;
                option.textContent = ev.nomeEvento;
                selectBuscaEvento.appendChild(option);
            });

            if ($(selectBuscaEvento).hasClass('select2-hidden-accessible')) {
                $(selectBuscaEvento).select2('destroy');
            }
            $(selectBuscaEvento).select2({
                placeholder: 'Buscar evento...',
                allowClear: true,
                width: '240px',
                matcher: function (params, data) {
                    if ($.trim(params.term) === '') return data;
                    if (typeof data.text === 'undefined') return null;
                    if (data.text.toLowerCase().indexOf(params.term.toLowerCase()) > -1) return data;
                    return null;
                }
            });

            $(selectBuscaEvento).on('select2:select', function (e) {
                const idEventoSelecionado = parseInt(e.params.data.id, 10);
                if (!idEventoSelecionado) return;

                const eventoAlvo = dados.find(ev => ev.idevento === idEventoSelecionado);
                if (!eventoAlvo) return;

                const statusAlvo = eventoAlvo._statusFiltroCalculado || 'todos';
                const botaoFiltro = containerFiltrosRapidos.querySelector(`.btn-filtro-rapido[data-filter="${statusAlvo}"]`);
                if (botaoFiltro) botaoFiltro.click();

                const cardAlvo = wrapperEventos.querySelector(`.accordion-item[data-evento-id="${idEventoSelecionado}"]`);
                if (cardAlvo) {
                    cardAlvo.style.display = "block";
                    if (!cardAlvo.classList.contains('active')) {
                        cardAlvo.querySelector('.accordion-header')?.click();
                    }
                    cardAlvo.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }

                // Limpa a busca pra já poder digitar a próxima
                $(selectBuscaEvento).val('').trigger('change');
            });

            wrapperEventos.appendChild(containerFiltrosRapidos);

            
            dados.forEach(evento => {
                const ajRecusado  = parseFloat(evento.ajuda?.recusado)  || 0;
                const chRecusado  = parseFloat(evento.cache?.recusado)  || 0;
                const temRecusado = (ajRecusado > 0 || chRecusado > 0);

                const ajPendente = parseFloat(evento.ajuda?.pendente) || 0;
                const chPendente = parseFloat(evento.cache?.pendente) || 0;
                const cxPendente = parseFloat(evento.caixinha?.pendente) || 0;

                const ajSuspenso  = parseFloat(evento.ajuda?.suspenso)  || 0;
                const chSuspenso  = parseFloat(evento.cache?.suspenso)  || 0;
                const cxSuspenso  = parseFloat(evento.caixinha?.suspenso) || 0;
                const temSuspenso = (ajSuspenso > 0 || chSuspenso > 0 || cxSuspenso > 0);

                const hojeBR = hojeRelativo.toLocaleDateString('pt-BR');

                // console.log("Evento:", evento.nomeEvento, "ajuda completa:", evento.ajuda);
                // console.log("Evento:", evento.nomeEvento,"cache completa:", evento.cache);
                // console.log("Evento:", evento.nomeEvento, "ajRecusado:", ajRecusado, "chRecusado:", chRecusado);

                let detalheVencidos = { cache: 0, ajuda: 0, caixinha: 0 };
                let detalheHoje = { cache: 0, ajuda: 0, caixinha: 0 };
                let detalheAVencer = { cache: 0, ajuda: 0, caixinha: 0 };

                let temVencido = false;
                let temHoje = false;
                let temAVencer = false;

                // --- 1. CLASSIFICAÇÃO DOS VALORES ---

                // Processar Ajuda
                if (evento.dataVencimentoAjuda && evento.dataVencimentoAjuda !== '---' && ajPendente > 0) {
                    const [d, m, a] = evento.dataVencimentoAjuda.split('/').map(Number);
                    const dtVcto = new Date(a, m - 1, d);
                    if (dtVcto < hojeRelativo) {
                        detalheVencidos.ajuda += ajPendente;
                        temVencido = true;
                    } else if (evento.dataVencimentoAjuda === hojeBR) {
                        detalheHoje.ajuda += ajPendente;
                        temHoje = true;
                    } else {
                        detalheAVencer.ajuda += ajPendente;
                        temAVencer = true;
                    }
                }

                // Processar Cachê
                if (evento.dataVencimentoCache && evento.dataVencimentoCache !== '---' && chPendente > 0) {
                    const [d, m, a] = evento.dataVencimentoCache.split('/').map(Number);
                    const dtVcto = new Date(a, m - 1, d);
                    if (dtVcto < hojeRelativo) {
                        detalheVencidos.cache += chPendente;
                        temVencido = true;
                    } else if (evento.dataVencimentoCache === hojeBR) {
                        detalheHoje.cache += chPendente;
                        temHoje = true;
                    } else {
                        detalheAVencer.cache += chPendente;
                        temAVencer = true;
                    }
                }

                // Processar Caixinha — antes essa parte era jogada direto em "a vencer" sem
                // olhar a data nem entrar em temPendente/temAVencer, então um evento só com
                // caixinha pendente (ajuda/cachê já pagos) virava "Liquidado" pra aba de
                // filtro mas ainda somava no card de A Vencer, sobrando dinheiro que nenhuma
                // aba mostrava.
                if (evento.dataVencimentoCaixinha && evento.dataVencimentoCaixinha !== '---' && cxPendente > 0) {
                    const [d, m, a] = evento.dataVencimentoCaixinha.split('/').map(Number);
                    const dtVcto = new Date(a, m - 1, d);
                    if (dtVcto < hojeRelativo) {
                        detalheVencidos.caixinha += cxPendente;
                        temVencido = true;
                    } else if (evento.dataVencimentoCaixinha === hojeBR) {
                        detalheHoje.caixinha += cxPendente;
                        temHoje = true;
                    } else {
                        detalheAVencer.caixinha += cxPendente;
                        temAVencer = true;
                    }
                } else if (cxPendente > 0) {
                    // Sem data de vencimento própria: mantém o comportamento antigo (cai em
                    // "a vencer" por padrão) só quando realmente não há data pra classificar.
                    detalheAVencer.caixinha += cxPendente;
                    temAVencer = true;
                }

                // --- 2. MONTAGEM DOS TEXTOS DE ALERTA (ACUMULATIVOS) ---
                let alertasTexto = [];

                if (temVencido) {
                    let partesV = [];
                    if (detalheVencidos.ajuda > 0) partesV.push(`Ajuda: ${formatarMoeda(detalheVencidos.ajuda)}`);
                    if (detalheVencidos.cache > 0) partesV.push(`Cachê: ${formatarMoeda(detalheVencidos.cache)}`);
                    if (detalheVencidos.caixinha > 0) partesV.push(`Caixinha: ${formatarMoeda(detalheVencidos.caixinha)}`);
                    alertasTexto.push(`
                        <span style="display: inline-flex; align-items: center; gap: 4px;">
                            <span class="dot-alerta" style="background-color: #d9534f;"></span>
                            <strong style="color:#d9534f; font-size: 16px;">VENCIDOS: ${partesV.join(' | ')}</strong>
                        </span>`);
                }

                if (temHoje) {
                    let partesH = [];
                    if (detalheHoje.ajuda > 0) partesH.push(`Ajuda: ${formatarMoeda(detalheHoje.ajuda)}`);
                    if (detalheHoje.cache > 0) partesH.push(`Cachê: ${formatarMoeda(detalheHoje.cache)}`);
                    if (detalheHoje.caixinha > 0) partesH.push(`Caixinha: ${formatarMoeda(detalheHoje.caixinha)}`);
                    alertasTexto.push(`
                        <span style="display: inline-flex; align-items: center; gap: 4px;">
                            <span class="dot-alerta" style="background-color: #ffcc00; animation: pulsar-amarelo 1.5s infinite;"></span>
                            <strong style="color:#f0ad4e; font-size: 16px;">HOJE: ${partesH.join(' | ')}</strong>
                        </span>`);
                }

                if (temAVencer) {
                    let partesA = [];
                    if (detalheAVencer.ajuda > 0) partesA.push(`Ajuda: ${formatarMoeda(detalheAVencer.ajuda)}`);
                    if (detalheAVencer.cache > 0) partesA.push(`Cachê: ${formatarMoeda(detalheAVencer.cache)}`);
                    if (detalheAVencer.caixinha > 0) partesA.push(`Caixinha: ${formatarMoeda(detalheAVencer.caixinha)}`);
                    alertasTexto.push(`
                        <span style="display: inline-flex; align-items: center; gap: 4px;">
                            <span class="dot-alerta" style="background-color: #007bff; box-shadow: none;"></span>
                            <strong style="color:#007bff; font-size: 16px;">A VENCER: ${partesA.join(' | ')}</strong>
                        </span>`);
                }

                // --- 3. LOGICA DO FILTRO (ATRIBUIÇÃO DE CATEGORIA) ---
                // Regra: Se tiver algo vencido, ele cai na categoria 'vencidos' para o botão vermelho.
                // Se não tiver vencido mas tiver algo hoje, cai na categoria 'hoje' para o botão amarelo.
               
                const temPendente = (ajPendente > 0 || chPendente > 0 || cxPendente > 0);
                const temFuncionarios = evento.funcionarios && evento.funcionarios.length > 0;



                let statusParaFiltro = "liquidado";
                let subStatusHtml = "";

                // Badge de Suspenso reaproveitável — um evento pode estar Vencido/Hoje/A Vencer
                // NUM componente e Suspenso em OUTRO ao mesmo tempo (ex.: Cachê suspenso, Ajuda
                // ainda a vencer). Antes esse badge só aparecia quando suspenso era a ÚNICA coisa
                // no evento; nos outros casos o valor suspenso ficava sem nenhuma indicação de
                // texto (só a cor laranja na grade de valores).
                const suspensoBadgeHtml = temSuspenso ? `
                        <span style="display: inline-flex; align-items: center; gap: 4px; border: 1px solid #c5b3e6; padding: 2px 8px; border-radius: 4px; background: #f3effe;">
                            <i class="fas fa-ban" style="color: #ff7b00; font-size: 12px;"></i>
                            <strong style="color:#ff7b00; font-size: 13px;">SUSPENSO</strong>
                            ${ajSuspenso > 0 ? `<span style="color:#ff7b00; font-size:12px;">— Ajuda: ${formatarMoeda(ajSuspenso)}</span>` : ''}
                            ${chSuspenso > 0 ? `<span style="color:#ff7b00; font-size:12px;">— Cachê: ${formatarMoeda(chSuspenso)}</span>` : ''}
                            ${cxSuspenso > 0 ? `<span style="color:#ff7b00; font-size:12px;">— Caixinha: ${formatarMoeda(cxSuspenso)}</span>` : ''}
                        </span>` : '';

                // if (!temFuncionarios) {
                //     statusParaFiltro = "aguardando";
                //     subStatusHtml = `
                //         <span style="display: inline-flex; align-items: center; gap: 4px; border: 1px solid #ccc; padding: 2px 8px; border-radius: 4px; background: var(--surface-3); margin-top: 4px;">
                //             <i class="fas fa-user-plus" style="color: var(--text-2); font-size: 12px;"></i>
                //             <strong style="color:var(--text-2); font-size: 13px;">AGUARDANDO CADASTRO STAFF</strong>
                //         </span>`;
                // } else if (!temPendente) {
                //     statusParaFiltro = "liquidado";
                //     // Colocando o Liquidado no mesmo formato de "tag" dos outros alertas
                //     subStatusHtml = `
                //         <div style="margin-top: 4px;">
                //             <span style="display: inline-flex; align-items: center; gap: 4px; border: 1px solid #d6e9c6; padding: 2px 8px; border-radius: 4px; background: var(--surface-3);">
                //                 <i class="fas fa-check-circle" style="color: #28a745;"></i>
                //                 <strong style="color:#28a745; font-size: 13px;">LIQUIDADO</strong>
                //             </span>
                //         </div>`;
                // } else {
                //     // Prioridade de exibição no filtro: Vencido > Hoje > A Vencer
                //     if (temVencido) statusParaFiltro = "vencidos";
                //     else if (temHoje) statusParaFiltro = "hoje";
                //     else statusParaFiltro = "a_vencer";
                //                     // Mostra as tags acumuladas (Vencidos, Hoje, A Vencer)
                //     subStatusHtml = `<div style="margin-top: 4px; display: flex; flex-wrap: wrap; gap: 10px;">${alertasTexto.join('')}</div>`;
                // }

                if (!temFuncionarios) {
                    statusParaFiltro = "aguardando";
                    subStatusHtml = `
                        <span style="display: inline-flex; align-items: center; gap: 4px; border: 1px solid #ccc; padding: 2px 8px; border-radius: 4px; background: var(--surface-3); margin-top: 4px;">
                            <i class="fas fa-user-plus" style="color: var(--text-2); font-size: 12px;"></i>
                            <strong style="color:var(--text-2); font-size: 13px;">AGUARDANDO CADASTRO STAFF</strong>
                        </span>`;

                } else if (temVencido) {
                    statusParaFiltro = "vencidos";
                    subStatusHtml = `<div style="margin-top: 4px; display: flex; flex-wrap: wrap; gap: 10px;">${alertasTexto.join('')}${suspensoBadgeHtml}</div>`;

                } else if (temHoje) {
                    statusParaFiltro = "hoje";
                    subStatusHtml = `<div style="margin-top: 4px; display: flex; flex-wrap: wrap; gap: 10px;">${alertasTexto.join('')}${suspensoBadgeHtml}</div>`;

                } else if (temAVencer) {
                    statusParaFiltro = "a_vencer";
                    subStatusHtml = `<div style="margin-top: 4px; display: flex; flex-wrap: wrap; gap: 10px;">${alertasTexto.join('')}${suspensoBadgeHtml}</div>`;

                } else if (temSuspenso && !temPendente) {
                    // Só cai aqui se não tiver NADA pendente além do suspenso
                    statusParaFiltro = "suspenso";
                    subStatusHtml = `<div style="margin-top: 4px;">${suspensoBadgeHtml}</div>`;

                } else if (!temPendente) {
                    statusParaFiltro = "liquidado";
                    subStatusHtml = `
                        <div style="margin-top: 4px;">
                            <span style="display: inline-flex; align-items: center; gap: 4px; border: 1px solid #d6e9c6; padding: 2px 8px; border-radius: 4px; background: var(--surface-3);">
                                <i class="fas fa-check-circle" style="color: #28a745;"></i>
                                <strong style="color:#28a745; font-size: 13px;">LIQUIDADO</strong>
                            </span>
                        </div>`;
                }



                // Guarda o status calculado no próprio evento pra busca por evento (mais abaixo)
                // saber pra qual aba pular sem precisar recalcular tudo de novo — esse aqui
                // continua sendo só a categoria de MAIOR prioridade (não precisa ser lista, é só
                // pra clicar num botão de aba específico).
                evento._statusFiltroCalculado = statusParaFiltro;

                // data-status-filtro (usado pelo clique nas abas, ver filtrarEventosNaTela)
                // precisa marcar TODAS as categorias que se aplicam ao evento, não só a de maior
                // prioridade — um evento com Ajuda vencida e Cachê a vencer, por exemplo, tem
                // dinheiro genuíno nos dois estados. Antes ele só ficava marcado "vencidos" e
                // sumia da aba "A Vencer" mesmo tendo uma parte real lá.
                const categoriasFiltro = [];
                if (!temFuncionarios) {
                    categoriasFiltro.push('aguardando');
                } else {
                    if (temVencido) categoriasFiltro.push('vencidos');
                    if (temHoje) categoriasFiltro.push('hoje');
                    if (temAVencer) categoriasFiltro.push('a_vencer');
                    // Suspenso é independente de ter outra parte pendente (ex.: Cachê suspenso
                    // mas Ajuda ainda a vencer) — mesmo raciocínio de vencidos/hoje/a_vencer
                    // acima. Antes só entrava aqui quando NADA mais estava pendente, escondendo
                    // o evento da aba "Suspensos" mesmo tendo dinheiro suspenso de verdade nele
                    // (o cabeçalho somava esse valor, mas nenhuma aba mostrava o evento).
                    if (temSuspenso) categoriasFiltro.push('suspenso');
                    if (!temPendente && !temSuspenso) categoriasFiltro.push('liquidado');
                }

                // --- 4. CRIAÇÃO DO ELEMENTO HTML ---
                const item = document.createElement("div");
                item.className = "accordion-item";
                item.setAttribute("data-status-filtro", categoriasFiltro.join(' '));
                item.setAttribute("data-evento-id", evento.idevento);
                

        
                // --- FUNÇÃO AUXILIAR PARA MONTAR O VALOR COLORIDO NA DIREITA ---

                const montarValorColorido = (vencido, hoje, aVencer, suspenso) => {
                    let html = [];
                    if (vencido > 0) html.push(`<span style="color:#d9534f; font-weight:bold;">${formatarMoeda(vencido)}</span>`);
                    if (hoje > 0) html.push(`<span style="color:#f0ad4e; font-weight:bold;">${formatarMoeda(hoje)}</span>`);
                    if (aVencer > 0) html.push(`<span style="color:#007bff; font-weight:bold;">${formatarMoeda(aVencer)}</span>`);
                    // Suspenso pode coexistir com vencido/hoje/a vencer no MESMO componente
                    // (ex.: Cachê suspenso e Ajuda ainda a vencer) — sem isso, esse valor ficava
                    // fora da linha de valores, mesmo o evento agora aparecendo na aba Suspensos.
                    if (suspenso > 0) html.push(`<span style="color:#ff7b00; font-weight:bold;" title="Suspenso">${formatarMoeda(suspenso)}</span>`);

                    return html.length > 0 ? html.join('<br>') : `<span style="color:var(--text-2);">${formatarMoeda(0)}</span>`;
                };

                const header = document.createElement("button");
                header.className = "accordion-header";
                header.innerHTML = `
                    <div class="evento-info-container-inline ${temVencido ? 'vencido-critico' : ''}" style="display: flex; align-items: center; width: 100%; justify-content: space-between;">
                    
                    <div class="evento-titulo-col" style="flex: 1; text-align: left;">
                        <strong style="font-size: 18px;">${evento.nomeEvento}</strong>
                        <div style="display:block; margin-top: 5px;">${subStatusHtml}</div>
                    </div>

                    <div class="evento-valores-col" style="display: flex; flex-direction: column; gap: 8px; min-width: 280px;">
                        
                        <div class="fin-resumo-item" style="display: grid; grid-template-columns: 80px 100px 100px; gap: 10px; align-items: center; text-align: right;">
                            <span class="label-categoria" style="font-size: 11px; color: var(--text-2); text-align: left;">CACHÊ:</span>
                            <span class="pg" style="color: #28a745; font-weight: 500;">${formatarMoeda(evento.cache?.pago || 0)}</span>
                            <div class="valores-detalhados-col" style="line-height: 1.1; font-size: 14px;">
                                ${montarValorColorido(detalheVencidos.cache, detalheHoje.cache, detalheAVencer.cache, chSuspenso)}
                            </div>
                        </div>

                        <div class="fin-resumo-item" style="display: grid; grid-template-columns: 80px 100px 100px; gap: 10px; align-items: center; text-align: right;">
                            <span class="label-categoria" style="font-size: 11px; color: var(--text-2); text-align: left;">AJUDA:</span>
                            <span class="pg" style="color: #28a745; font-weight: 500;">${formatarMoeda(evento.ajuda?.pago || 0)}</span>
                            <div class="valores-detalhados-col" style="line-height: 1.1; font-size: 14px;">
                                ${montarValorColorido(detalheVencidos.ajuda, detalheHoje.ajuda, detalheAVencer.ajuda, ajSuspenso)}
                            </div>
                        </div>
                        ${(evento.caixinha?.pago > 0 || cxPendente > 0) ? `
                        <div class="fin-resumo-item" style="display: grid; grid-template-columns: 80px 100px 100px; gap: 10px; align-items: center; text-align: right;">
                            <span class="label-categoria" style="font-size: 11px; color: var(--text-2); text-align: left;">CAIXINHA:</span>
                            <span class="pg" style="color: #28a745; font-weight: 500;">${formatarMoeda(evento.caixinha?.pago || 0)}</span>
                            <div class="valores-detalhados-col" style="line-height: 1.1; font-size: 14px;">
                                ${montarValorColorido(detalheVencidos.caixinha, detalheHoje.caixinha, detalheAVencer.caixinha, cxSuspenso)}
                            </div>
                        </div>` : ''}
                    </div>
                    
                    <button class="btn-foco-evento" style="
                        margin-left: 20px; 
                        padding: 6px 12px; 
                        background: #007bff; /* Azul vibrante */
                        color: white; 
                        border: none; 
                        border-radius: 4px; 
                        cursor: pointer; /* Cursor de clique normal */
                        font-weight: bold;
                        font-size: 12px;
                        white-space: nowrap;
                        display: none; /* COMEÇA TOTALMENTE OCULTO */
                    ">⛶ Visualizar em Tela Cheia</button>
                    
                </div>`;


                //header.onclick = () => item.classList.toggle("active");

                // header.onclick = () => {
                //     const estaAbrindo = !item.classList.contains("active");

                //     if (estaAbrindo) {
                //         wrapperEventos.querySelectorAll(".accordion-item").forEach(outro => {
                //             if (outro !== item) {
                //                 outro.classList.remove("active");
                //                 outro.classList.remove("foco-unico");
                //                 outro.style.display = "none";
                //             }
                //         });

                //         // ← OCULTA os cards de resumo de valores
                //         const resumoValores = document.getElementById("valores-resumo");
                //         if (resumoValores) resumoValores.style.display = "none";

                //         // ← OCULTA também o bloco mestre de totais (PAGOS, VENCIDOS, A VENCER, TOTAL)
                //         const btnMestre = document.querySelector(".accordion-mestre-header");
                //         if (btnMestre) btnMestre.style.display = "none";

                //         // const btnTituloContas = document.querySelectorAll(".accordion-mestre-header");
                //         //     btnTituloContas.forEach(btn => {
                //         //     if (btn.textContent.includes("Contas a Pagar")) btn.style.display = "none";
                //         // });

                //         const conteudoGeral = document.getElementById("vencimentos-conteudo");
                //         if (conteudoGeral) {
                //             conteudoGeral.dataset.alturaOriginal = conteudoGeral.style.maxHeight || "";
                //             conteudoGeral.style.maxHeight = "none";
                //             conteudoGeral.style.overflow = "visible";
                //         }

                //         item.classList.add("active");
                //         item.classList.add("foco-unico");

                //     } else {
                //         // ← RESTAURA os cards de resumo de valores
                //         const resumoValores = document.getElementById("valores-resumo");
                //         if (resumoValores) resumoValores.style.display = "";

                //         // ← RESTAURA o bloco mestre
                //         const btnMestre = document.querySelector(".accordion-mestre-header");
                //         if (btnMestre) btnMestre.style.display = "";

                //         // const wrapperContas = document.querySelector(".wrapper-contas-financeiro");
                //         // if (wrapperContas) wrapperContas.style.display = "block";

                //         // const btnsTituloContas = document.querySelectorAll(".accordion-mestre-header");
                //         // btnsTituloContas.forEach(btn => {
                //         //     if (btn.textContent.includes("Contas a Pagar")) btn.style.display = "";
                //         // });

                //         const filtroAtivo = window._filtroEventosAtivo || 'todos';
                //         wrapperEventos.querySelectorAll(".accordion-item").forEach(outro => {
                //             outro.classList.remove("foco-unico");
                //             const statusDoItem = outro.getAttribute("data-status-filtro");
                //             const deveAparecer = (filtroAtivo === 'todos' || statusDoItem === filtroAtivo);
                //             outro.style.display = deveAparecer ? "block" : "none";
                //         });

                //         const conteudoGeral = document.getElementById("vencimentos-conteudo");
                //         if (conteudoGeral) {
                //             conteudoGeral.style.maxHeight = conteudoGeral.dataset.alturaOriginal || "";
                //             conteudoGeral.style.overflow = "";
                //         }

                //         item.classList.remove("active");
                //         item.classList.remove("foco-unico");
                //     }
                // };

                // Removemos as buscas antigas de botaoFoco e botaoFechar daqui!

                header.onclick = (e) => {
                    const botaoFoco = header.querySelector(".btn-foco-evento");
                    const clicouNoFoco = e.target.closest(".btn-foco-evento");

                    // =========================================================================
                    // CASO 1: USUÁRIO CLICOU NO BOTÃO "FOCAR"
                    // =========================================================================
                    // if (clicouNoFoco) {
                    //         e.stopPropagation(); 
                            
                    //         item.classList.add("modo-tela-cheia");

                    //         // 1. CAPTURA O NOME DO EVENTO (Lógica de limpeza para não pegar badges)
                    //         const tituloElemento = item.querySelector(".accordion-title") || item.querySelector("h3") || item.querySelector("h4");
                    //         let nomeEvento = "Detalhes do Evento";
                            
                    //         if (tituloElemento) {
                    //             // Clonamos para limpar spans e botões antes de pegar o texto
                    //             const clone = tituloElemento.cloneNode(true);
                    //             clone.querySelectorAll('button, .badge, .status-badge, .btn-foco-evento, span[style*="background"]').forEach(el => el.remove());
                    //             nomeEvento = clone.innerText.trim();
                    //         }

                    //         // 2. BUSCA OU CRIA O ELEMENTO DE TÍTULO NA BARRA FIXA
                    //         let barraTitulo = header.querySelector(".titulo-tela-cheia");
                    //         if (!barraTitulo) {
                    //             barraTitulo = document.createElement("span");
                    //             barraTitulo.className = "titulo-tela-cheia";
                    //             header.insertBefore(barraTitulo, header.firstChild);
                    //         }
                            
                    //         // Estilização do Título na barra
                    //         Object.assign(barraTitulo.style, {
                    //             display: "inline-block",
                    //             fontSize: "18px",
                    //             fontWeight: "bold",
                    //             marginLeft: "15px",
                    //             verticalAlign: "middle",
                    //             color: "#333"
                    //         });

                    //         barraTitulo.innerText = nomeEvento;

                    //         // 3. ESCONDE ELEMENTOS GERAIS
                    //         const resumo = document.querySelector(".resumo-detalhado");
                    //         const valoresResumo = document.getElementById("valores-resumo");
                    //         const mestreContas = document.getElementById("btn-mestre-contas");
                    //         const wrapperContas = document.getElementById("wrapper-contas");
                    //         const mestreHeader = document.querySelector(".accordion-mestre-header");

                    //         if (resumo) resumo.style.display = "none";
                    //         if (valoresResumo) valoresResumo.style.display = "none";
                    //         if (mestreContas) mestreContas.style.display = "none";
                    //         if (wrapperContas) wrapperContas.style.display = "none";
                    //         if (mestreHeader) mestreHeader.style.display = "none";
                            
                    //         wrapperEventos.querySelectorAll(".accordion-item").forEach(outro => {
                    //             if (outro !== item) outro.style.display = "none";
                    //         });

                    //         // 4. CRIAÇÃO DO BOTÃO VOLTAR (Mantendo sua posição e cor original)
                    //         const botaoVoltarAntigo = document.getElementById("botao-voltar-fixo");
                    //         if (botaoVoltarAntigo) botaoVoltarAntigo.remove();

                    //         const botaoVoltar = document.createElement("button");
                    //         botaoVoltar.id = "botao-voltar-fixo";
                    //         botaoVoltar.innerHTML = "✕ Voltar para a Lista";
                            
                    //         Object.assign(botaoVoltar.style, {
                    //             position: "fixed",
                    //             top: "100px",
                    //             right: "20px",
                    //             zIndex: "9999",
                    //             padding: "10px 20px",
                    //             background: "#dc3545", // Sua cor original
                    //             color: "white",
                    //             border: "none",
                    //             borderRadius: "5px",
                    //             cursor: "pointer",
                    //             fontWeight: "bold",
                    //             fontSize: "14px",
                    //             boxShadow: "0px 4px 6px rgba(0,0,0,0.2)",
                    //             transition: "background 0.2s"
                    //         });

                    //         botaoVoltar.onmouseover = () => botaoVoltar.style.background = "#bd2130";
                    //         botaoVoltar.onmouseout = () => botaoVoltar.style.background = "#dc3545";

                    //         botaoVoltar.onclick = (e) => {
                    //             e.stopPropagation();
                    //             item.classList.remove("modo-tela-cheia");
                    //             if (barraTitulo) barraTitulo.style.display = "none";

                    //             if (resumo) resumo.style.display = "";
                    //             if (valoresResumo) valoresResumo.style.display = "";
                    //             if (mestreContas) mestreContas.style.display = "";
                    //             if (wrapperContas) wrapperContas.style.display = "";
                    //             if (mestreHeader) mestreHeader.style.display = "";
                                
                    //             const filtroAtivo = window._filtroEventosAtivo || 'todos';
                    //             wrapperEventos.querySelectorAll(".accordion-item").forEach(outro => {
                    //                 const statusDoItem = outro.getAttribute("data-status-filtro");
                    //                 const deveAparecer = (filtroAtivo === 'todos' || statusDoItem === filtroAtivo);
                    //                 outro.style.display = deveAparecer ? "block" : "none";
                    //             });

                    //             if (botaoFoco) botaoFoco.style.display = "inline-block";
                    //             botaoVoltar.remove();
                    //         };

                    //         document.body.appendChild(botaoVoltar);
                    //         if (botaoFoco) botaoFoco.style.display = "none";
                            
                    //         return;
                    //     }

                    if (clicouNoFoco) {
                        e.stopPropagation();

                        item.classList.add("modo-tela-cheia");

                        // 1. CAPTURA O NOME DO EVENTO
                        const nomeEvento = header.querySelector(".evento-titulo-col strong")?.innerText?.trim() 
                                        || "Detalhes do Evento";

                        console.log("Nome do Evento capturado para título de tela cheia:", nomeEvento);

                        // 2. CRIAÇÃO DA BARRA DE TÍTULO (COBRINDO O MENU ORIGINAL)
                        let barraTopoFoco = document.getElementById("barra-topo-foco-evento");
                        if (!barraTopoFoco) {
                            barraTopoFoco = document.createElement("div");
                            barraTopoFoco.id = "barra-topo-foco-evento";
                            document.body.appendChild(barraTopoFoco);
                        }

                        // Estilização para sobrepor o menu (Overlay)
                        Object.assign(barraTopoFoco.style, {
                            position: "fixed",
                            top: "0",
                            left: "0",
                            width: "100%",
                            height: "90px", // Aumentamos um pouco para cobrir os ícones totalmente
                            backgroundColor: "var(--primary-color, #611414)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            zIndex: "99999", // Valor extremo para garantir que fique por cima de tudo
                            boxShadow: "0 2px 10px rgba(0,0,0,0.5)",
                            margin: "0",
                            padding: "0"
                        });

                        // Título em branco para contraste no fundo escuro
                        barraTopoFoco.innerHTML = `<h2 style="margin:0; font-size:18px; color:#ffffff; font-weight:bold; text-transform:uppercase; letter-spacing:1px;">${nomeEvento}</h2>`;
                        barraTopoFoco.style.display = "flex";

                        // 3. ESCONDE ELEMENTOS GERAIS DA TELA
                        const resumo = document.querySelector(".resumo-detalhado");
                        const valoresResumo = document.getElementById("valores-resumo");
                        const mestreContas = document.getElementById("btn-mestre-contas");
                        const wrapperContas = document.getElementById("wrapper-contas");
                        const mestreHeader = document.querySelector(".accordion-mestre-header");

                        if (resumo) resumo.style.display = "none";
                        if (valoresResumo) valoresResumo.style.display = "none";
                        if (mestreContas) mestreContas.style.display = "none";
                        if (wrapperContas) wrapperContas.style.display = "none";
                        if (mestreHeader) mestreHeader.style.display = "none";

                        wrapperEventos.querySelectorAll(".accordion-item").forEach(outro => {
                            if (outro !== item) outro.style.display = "none";
                        });

                        // 4. BOTÃO VOLTAR (Posicionado sobre a nova barra)
                        const botaoVoltarAntigo = document.getElementById("botao-voltar-fixo");
                        if (botaoVoltarAntigo) botaoVoltarAntigo.remove();

                        const botaoVoltar = document.createElement("button");
                        botaoVoltar.id = "botao-voltar-fixo";
                        botaoVoltar.innerHTML = '<i class="fas fa-times" style="font-size:12px;"></i> VOLTAR';

                        Object.assign(botaoVoltar.style, {
                            position: "fixed",
                            top: "18px", // Ajustado para a nova altura de 75px
                            right: "20px",
                            zIndex: "100000",
                            padding: "8px 16px",
                            background: "transparent",
                            color: "white",
                            border: "1px solid rgba(255,255,255,0.5)",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontWeight: "bold",
                            fontSize: "12px"
                        });

                        // Efeito visual ao passar o mouse. Branco translúcido, não
                        // var(--surface-1): o botão está sobre a barra de marca (vermelha
                        // nos dois temas) — no claro, --surface-1 é branco e apagava o
                        // texto branco do próprio botão.
                        botaoVoltar.onmouseover = () => { botaoVoltar.style.background = "rgba(255,255,255,0.25)"; };
                        botaoVoltar.onmouseout = () => { botaoVoltar.style.background = "transparent"; };

                        // 5. LÓGICA DE FECHAMENTO (RESTAURAÇÃO)
                        botaoVoltar.onclick = (e) => {
                            e.stopPropagation();

                            // Remove o modo tela cheia
                            item.classList.remove("modo-tela-cheia");

                            // Esconde a barra de cobertura e remove o botão
                            if (barraTopoFoco) {
                                barraTopoFoco.style.display = "none";
                            }
                            botaoVoltar.remove();

                            // Restaura elementos globais
                            if (resumo) resumo.style.display = "";
                            if (valoresResumo) valoresResumo.style.display = "";
                            if (mestreContas) mestreContas.style.display = "";
                            if (wrapperContas) wrapperContas.style.display = "";
                            if (mestreHeader) mestreHeader.style.display = "";

                            // Restaura a lista respeitando o filtro ativo
                            const filtroAtivo = window._filtroEventosAtivo || 'todos';
                            wrapperEventos.querySelectorAll(".accordion-item").forEach(outro => {
                                const statusDoItem = outro.getAttribute("data-status-filtro");
                                const deveAparecer = (filtroAtivo === 'todos' || statusDoItem === filtroAtivo);
                                outro.style.display = deveAparecer ? "block" : "none";
                            });

                            // Mostra o botão de foco original novamente
                            if (botaoFoco) {
                                botaoFoco.style.display = "inline-block";
                            }
                        };

                        document.body.appendChild(botaoVoltar);
                        
                        // Oculta o botão que disparou o foco para limpar o visual
                        if (botaoFoco) botaoFoco.style.display = "none";

                        return;
                    }

                    // =========================================================================
                    // CASO 2: CLIQUE NORMAL NO HEADER (ABRIR / FECHAR ACCORDION)
                    // =========================================================================
                    const estaAbrindo = !item.classList.contains("active");                   

                    if (estaAbrindo) {
                        // 1. ESCONDE OS OUTROS CARDS
                        wrapperEventos.querySelectorAll(".accordion-item").forEach(outro => {
                            if (outro !== item) {
                                outro.classList.remove("active");
                                outro.classList.remove("foco-unico");
                                outro.style.display = "none"; 
                            }
                        });

                        // 2. ESCONDE OS RESUMOS GERAIS DA TELA
                        document.getElementById("valores-resumo")?.style.setProperty("display", "none");
                        document.getElementById("btn-mestre-contas")?.style.setProperty("display", "none");
                        document.getElementById("wrapper-contas")?.style.setProperty("display", "none");
                        document.querySelector(".accordion-mestre-header")?.style.setProperty("display", "none");

                        const conteudoGeral = document.getElementById("vencimentos-conteudo");
                        if (conteudoGeral) {
                            conteudoGeral.dataset.alturaOriginal = conteudoGeral.style.maxHeight || "";
                            conteudoGeral.style.maxHeight = "none";
                            conteudoGeral.style.overflow = "visible";
                        }

                        // 3. ABRE O CARD ATUAL
                        item.classList.add("active");
                        item.classList.add("foco-unico");                       

                        const botaoFocoAtual = item.querySelector(".btn-foco-evento") || item.closest(".accordion-item")?.querySelector(".btn-foco-evento");

                        if (botaoFocoAtual) {
                            // Força o display inline-block
                            botaoFocoAtual.style.setProperty("display", "inline-block", "important");
                            // Se houver qualquer bloqueio de opacidade ou cursor antigo, limpamos aqui:
                            botaoFocoAtual.style.setProperty("opacity", "1", "important");
                            botaoFocoAtual.style.setProperty("cursor", "pointer", "important");
                            
                            // Se você estava usando o atributo 'disabled' no HTML antigo, remova-o:
                            botaoFocoAtual.removeAttribute("disabled");
                        }

                    } else {
                        // CASO O USUÁRIO CLIQUE PARA FECHAR O CARD
                        document.getElementById("valores-resumo")?.style.setProperty("display", "");
                        document.getElementById("btn-mestre-contas")?.style.setProperty("display", "");
                        document.getElementById("wrapper-contas")?.style.setProperty("display", "");
                        document.querySelector(".accordion-mestre-header")?.style.setProperty("display", "");

                        const filtroAtivo = window._filtroEventosAtivo || 'todos';
                        wrapperEventos.querySelectorAll(".accordion-item").forEach(outro => {
                            outro.classList.remove("foco-unico");
                            const statusDoItem = outro.getAttribute("data-status-filtro");
                            const deveAparecer = (filtroAtivo === 'todos' || statusDoItem === filtroAtivo);
                            outro.style.display = deveAparecer ? "block" : "none";
                        });

                        const conteudoGeral = document.getElementById("vencimentos-conteudo");
                        if (conteudoGeral) {
                            conteudoGeral.style.maxHeight = conteudoGeral.dataset.alturaOriginal || "";
                            conteudoGeral.style.overflow = "";
                        }

                        item.classList.remove("active");
                        item.classList.remove("foco-unico");

                        // SE FECHOU O CARD, ESCONDE O BOTÃO DELE NOVAMENTE
                        const botaoFocoAtual = item.querySelector(".btn-foco-evento");
                        if (botaoFocoAtual) {
                            botaoFocoAtual.style.setProperty("display", "none", "important");
                        }
                    }
                };



                const body = document.createElement("div");
                
                body.className = "accordion-body";
                body.innerHTML = `
                    <div class="resumo-categorias">
                        <div class="categoria-geral">
                            <div class="categoria-bloco">
                                <h3>Ajuda de Custo</h3>
                                <p class="datas-evento">Período Evento Início Marcação a Fim Desmontagem: <strong>${evento.periodo_evento}</strong> a <strong>${evento.dataFimEvento}</strong></p>
                                <p class="vencimento">Vence em: <strong>${evento.dataVencimentoAjuda}</strong> (2 dias após ${evento.dataInicioInfraMontagem && evento.dataInicioInfraMontagem !== '---' ? `Início Montagem Infra <strong>${evento.dataInicioInfraMontagem}</strong>` : `Início Montagem <strong>${evento.dataInicioMontagem}</strong>`})</p>

                                
                                <div class="totais">
                                    <p class="pendentes-pagos"><strong>Pendente:</strong> ${formatarMoeda(ajPendente)}</p>
                                    ${ajRecusado > 0 ? `
                                        <p class="total-rejeitado" ">
                                            <strong>Rejeitado:</strong> ${formatarMoeda(ajRecusado)}
                                        </p> ` : ''}
                                </div>
                            </div>
                            <div class="categoria-bloco">
                                <h3>Cachê</h3>
                                <p class="datas-evento">Período Evento Início Marcação a Fim Desmontagem: <strong>${evento.periodo_evento}</strong> a <strong>${evento.dataFimEvento}</strong></p>
                                <p class="vencimento">Vence em: <strong>${evento.dataVencimentoCache}</strong> (2 dias após Fim Desmontagem <strong>${evento.dataFimEvento}</strong>)</p>
                            
                                <div class="totais">
                                    <p class="pendentes-pagos"><strong>Pendente:</strong> ${formatarMoeda(chPendente)}</p>
                                    ${chRecusado > 0 ? `
                                        <p class="total-rejeitado">
                                            <strong>Rejeitado:</strong> ${formatarMoeda(chRecusado)}
                                        </p> ` : ''}
                                </div>
                            </div>
                        </div>
                    <div class="container-filtro-local" style="margin: 10px 0;"></div>
                    <div class="funcionarios-scroll-container"> 
                        <table class="tabela-funcionarios-venc">
                            <thead>${obterHeaderTabela()}</thead>
                            <tbody>${obterLinhasTabela(evento)}</tbody>
                        </table>
                    </div>`;

              //  const fHtml = criarFiltroCategorias(null, null); 
              //  body.querySelector(".container-filtro-local").appendChild(fHtml);

                // const primeiroBtn = fHtml.querySelector('.categoria-wrapper .input:checked + .btn');
                // if (primeiroBtn) primeiroBtn.style.cssText = 'background-color: var(--primary-color); border-radius: 50px; display: flex; justify-content: center; align-items: center; cursor: pointer;';
                // const primeiroSpan = fHtml.querySelector('.categoria-wrapper .input:checked + .btn .span');
                // if (primeiroSpan) primeiroSpan.style.color = 'var(--font-color)';

                // fHtml.querySelectorAll('input[name="categoria"]').forEach(r => {
                //     r.addEventListener('change', (e) => {
                //         const v = e.target.value;
                //         const tab = body.querySelector(".tabela-funcionarios-venc");
                //         tab.querySelector("thead").innerHTML = obterHeaderTabela(v);
                //         tab.querySelector("tbody").innerHTML = obterLinhasTabela(evento, v);
                //     });
                // });

                item.appendChild(header);
                item.appendChild(body);
                wrapperEventos.appendChild(item);
            });
        }

        console.log("DADOS CONTAS", resContas);
        // Só existe período (dInicioComp/dFimComp) calculado dentro do bloco de contas abaixo —
        // por isso o FGTS estimado também precisa ser calculado lá dentro; aqui fica só a variável
        // pronta pra usar depois em atualizarResumoGeralEstatico (fora do bloco, sem período
        // nenhum se não houver contas).
        let fgtsEstimado = 0;
        if (resContas.sucesso && resContas.contas) {
            // const hoje = new Date();
            // hoje.setHours(0, 0, 0, 0);
            // const anoFiltro = parseInt(anoSelecionado);

            // Pega a data de hoje para referência

            // --- DEFINIÇÃO DOS LIMITES DE DATA PARA O FILTRO DE TELA ---
            const hoje = hojeRelativo || new Date(); 
            const anoFiltro = parseInt(anoSelecionado);
            
            // 1. MAPEAMENTO DE DADOS REAIS (Evita os 143,33 de diferença)
            // Guardamos o objeto INTEIRO do banco indexado por ID-ANO-MES
            const mapaDadosReais = new Map();
            resContas.contas.forEach(reg => {
                const dStr = (reg.dtvcto || reg.vctobase || "").split('T')[0];
                if (dStr) {
                    const d = new Date(dStr + 'T12:00:00');
                    const chave = `${reg.idlancamento}-${d.getFullYear()}-${d.getMonth()}`;
                    // Se houver duplicata no banco, o Map garante que ficamos com o registro mais completo
                    mapaDadosReais.set(chave, reg);
                }
            });

            // Holerites (RH) do ano, indexados por funcionário+mês, pra anexar na competência
            // efetivamente projetada (a data do lançamento não reflete o mês da folha).
            const mapaHolerites = new Map();
            (resContas.holerites || []).forEach(h => {
                if (!h.idfuncionario) return;
                mapaHolerites.set(`${h.idfuncionario}-${h.ano}-${h.mes}`, h);
            });
            // Benefícios (VA/VT): sempre linha própria, sem lançamento cadastrado equivalente
            // (nunca existiu esse conceito em Vencimentos) — por isso não passa pelo loop de
            // "casar com lançamento" acima, vai direto pro fallback logo abaixo.
            const mapaBeneficios = new Map();
            (resContas.beneficios || []).forEach(b => {
                if (!b.idfuncionario) return;
                mapaBeneficios.set(`${b.idfuncionario}-${b.ano}-${b.mes}`, b);
            });
            // Rastreia quais holerites mensais foram "encontrados" por algum lançamento
            // projetado — sobra disso vira linha própria mais abaixo (funcionário sem
            // lançamento cadastrado em Vencimentos, ex: cadastro criado só pelo RH).
            const holeritesUsados = new Set();

            const mesesProcessadosNoLoop = new Set();

            resContas.contas.forEach(c => {
                const dataOriginalStr = c.vctobase || c.dtvcto;
                const vctoBase = (typeof converterData === 'function') ? converterData(dataOriginalStr) : new Date(dataOriginalStr);
                if (!vctoBase || isNaN(vctoBase)) return;

                // Datas de vencimento projetadas desse lançamento dentro do ano filtrado (FIXO,
                // PARCELADO ou ÚNICO) — ver expandirOcorrenciasNoAno, reaproveitada também pelo
                // card lateral "Financeiro" (carregarDadosVencimentos).
                expandirOcorrenciasNoAno(c, anoFiltro).forEach(dProj => {
                    const chaveMes = `${c.idlancamento}-${dProj.getFullYear()}-${dProj.getMonth()}`;
                    if (mesesProcessadosNoLoop.has(chaveMes)) return;

                    // 2. BUSCA DADO REAL OU PROJETA
                    const dadoReal = mapaDadosReais.get(chaveMes);
                    
                    let statusFinal = "";
                    let statusFiltro = "";
                    let valorTotal = 0;
                    let valorPago = 0;

                    if (dadoReal) {
                        // 1. Normalizamos o status que vem do banco
                        const sBanco = (dadoReal.status || "").toLowerCase();
                        
                        // 2. Criamos as travas (Booleans)
                        const ehSuspenso = (sBanco === 'suspenso');
                        const foiPago = (sBanco === 'pago' || sBanco === 'liquidado' || !!dadoReal.dtpagamento);

                        // 3. DEFINIÇÃO DO STATUS (Com hierarquia de prioridade)
                        if (ehSuspenso) {
                            statusFinal = "Suspenso";
                            statusFiltro = "suspenso";
                        } else if (foiPago) {
                            statusFinal = "Pago";
                            statusFiltro = "liquidado";
                        } else {
                            // "Hoje" continua existindo como categoria própria pro FILTRO (aba
                            // "Hoje" e o total do resumo) — mas a coluna STATUS sempre mostra
                            // "Pendente" enquanto não for pago, pra não confundir com um status
                            // de fato ("Pendente"/"Pago"/"Suspenso"). O badge "HOJE" ao lado da
                            // descrição já avisa que vence hoje.
                            if (ehMesmoDia(dProj, hoje)) { statusFinal = "Pendente"; statusFiltro = "hoje"; }
                            else if (dProj < hoje) { statusFinal = "Atrasado"; statusFiltro = "vencidos"; }
                            else { statusFinal = "Pendente"; statusFiltro = "a_vencer"; }
                        }

                        // 4. VALORES
                        valorTotal = parseFloat(dadoReal.vlrreal || dadoReal.valor || dadoReal.vlrestimado || 0);
                        valorPago = (statusFinal === "Pago") ? parseFloat(dadoReal.vlrpago || valorTotal) : 0;

                    } else {
                        // Para projeções que não existem no banco ainda: "hoje" continua valendo
                        // pro filtro, mas a coluna STATUS mostra "Pendente" (ver comentário acima).
                        if (ehMesmoDia(dProj, hoje)) { statusFinal = "Pendente"; statusFiltro = "hoje"; }
                        else if (dProj < hoje) { statusFinal = "Atrasado"; statusFiltro = "vencidos"; }
                        else { statusFinal = "Projeção"; statusFiltro = "a_vencer"; }
                        // Não usa c.vlrreal aqui — é o valor REAL de outro pagamento (mês de "c"),
                        // não desse mês projetado. Só o estimado do lançamento é genérico o
                        // suficiente pra servir de fallback.
                        valorTotal = parseFloat(c.valor || c.vlrestimado || 0);
                        valorPago = 0;
                    }

                    const chaveHolerite = c.idfuncionario_vinculo
                        ? `${c.idfuncionario_vinculo}-${dProj.getFullYear()}-${dProj.getMonth() + 1}`
                        : null;
                    const holeriteMes = chaveHolerite ? mapaHolerites.get(chaveHolerite) : null;
                    if (chaveHolerite && holeriteMes) holeritesUsados.add(chaveHolerite);

                    // Campos de pagamento ("c" pode ser o registro real de OUTRO mês do mesmo
                    // lançamento recorrente, ex.: agosto já pago) só entram quando este mês tem
                    // seu próprio dadoReal — senão a data de pagamento, comprovante e imagem da
                    // conta de um mês pago vazam pra um mês diferente ainda pendente/atrasado.
                    const camposPagamentoEspecificos = dadoReal ? {} : {
                        idpagamento: null,
                        numparcela: null,
                        dtpgto: null,
                        comprovantepgto: null,
                        imagemconta: null,
                        vlrpago: null,
                        vlrreal: null,
                    };

                    contasProjetadas.push({
                        ...(dadoReal || c), // Prioriza os dados do registro real (ID 16, etc)
                        ...camposPagamentoEspecificos,
                        vencimento: dProj.toLocaleDateString('pt-BR'),
                        dtvcto: dProj.toISOString().split('T')[0],
                        valorTotal: valorTotal,
                        valorPago: valorPago,
                        status: statusFinal,
                        statusFiltro: statusFiltro,
                        // Sem dadoReal, o spread acima veio de `c` — que é o lançamento JUNTO
                        // COM o pagamento mais recente já realizado (ex: setembro pago). Sem
                        // isso, esses campos do pagamento de outro mês vazavam pra cá: a "Data
                        // Pagamento" de outubro mostrava a data de setembro, e o idpagamento
                        // vazado fazia o botão PAGAR de outubro atualizar o registro de
                        // setembro em vez de criar um novo.
                        ...(!dadoReal ? {
                            idpagamento: null,
                            dtpgto: null,
                            imagemconta: null,
                            comprovantepgto: null,
                            observacao: null,
                            numparcela: null,
                            vlrpago: null,
                            vlrreal: null,
                        } : {}),
                        idholerite: holeriteMes ? holeriteMes.idholerite : null,
                        holerite_mes: holeriteMes ? holeriteMes.mes : (dProj.getMonth() + 1),
                        holerite_ano: holeriteMes ? holeriteMes.ano : dProj.getFullYear(),
                        holerite_origem: holeriteMes ? holeriteMes.origem : null,
                        status_holerite: holeriteMes ? holeriteMes.status : null,
                        holerite_dtpagamento: holeriteMes ? holeriteMes.dtpagamento : null,
                        holerite_comprovante: holeriteMes ? holeriteMes.comprovante : null,
                        holerite_proventos: holeriteMes ? parseFloat(holeriteMes.proventos || 0) : null,
                        holerite_descontos: holeriteMes ? parseFloat(holeriteMes.descontos || 0) : null,
                        holerite_liquido: holeriteMes ? parseFloat(holeriteMes.liquido || 0) : null
                    });

                    mesesProcessadosNoLoop.add(chaveMes);
                });
            });

            // 13º salário: geral e no mesmo período pra todo mundo, por isso entra direto como
            // conta (1ª parcela 20/11, 2ª parcela 30/12) — não existe lançamento recorrente
            // pra ele, então essas linhas vêm prontas do back-end (eventos13), não da projeção
            // de lançamentos acima. Férias/rescisão não entram aqui: só aparecem quando o RH
            // já gerou o holerite manualmente na tela de RH.
            (resContas.eventos13 || []).forEach(ev => {
                // Mesma comparação de data usada acima pro caso "sem lançamento" (dProj < hoje)
                // — sem isso, um 13º de mês já passado (ex: julho, se filtro olhar meses
                // anteriores) ficava sempre em "a_vencer", nunca em "vencidos".
                const dtvctoTreze = new Date(ev.dtvcto + 'T12:00:00');
                const foiPagoTreze = ev.status === 'Pago';
                const ehHojeTreze = !foiPagoTreze && ehMesmoDia(dtvctoTreze, hoje);
                const statusFinalTreze = foiPagoTreze ? 'pago' : (ehHojeTreze ? 'pendente' : (dtvctoTreze < hoje ? 'atrasado' : 'pendente'));
                const statusFiltroTreze = foiPagoTreze ? 'liquidado' : (ehHojeTreze ? 'hoje' : (dtvctoTreze < hoje ? 'vencidos' : 'a_vencer'));
                contasProjetadas.push({
                    idlancamento: `13-${ev.idfuncionario}-${ev.mes}-${ev.ano}`,
                    idpagamento: null,
                    tipovinculo: 'funcionario',
                    holerite_tipo13: true,
                    nome_vinculo: ev.nome,
                    observacao: ev.mes === 11 ? '13º salário (1ª parcela)' : '13º salário (2ª parcela)',
                    idfuncionario_vinculo: ev.idfuncionario,
                    vencimento: ev.dtvcto.split('-').reverse().join('/'),
                    dtvcto: ev.dtvcto,
                    valorTotal: parseFloat(ev.liquido || 0),
                    valorPago: statusFinalTreze === 'pago' ? parseFloat(ev.liquido || 0) : 0,
                    status: statusFinalTreze,
                    statusFiltro: statusFiltroTreze,
                    idholerite: ev.idholerite,
                    holerite_mes: ev.mes,
                    holerite_ano: ev.ano,
                    holerite_origem: ev.origem,
                    status_holerite: ev.status,
                    holerite_dtpagamento: ev.dtpagamento,
                    holerite_comprovante: ev.comprovante,
                    holerite_proventos: parseFloat(ev.proventos || 0),
                    holerite_descontos: parseFloat(ev.descontos || 0),
                    holerite_liquido: parseFloat(ev.liquido || 0)
                });
            });

            // Funcionário de folha fixa (Interno/Externo) SEM lançamento cadastrado em
            // Vencimentos (ex: cadastro feito só pelo RH, sem gerar a conta recorrente) — o
            // holerite dele existe (computado pelo backend), mas nunca é "encontrado" pelo loop
            // acima porque não há lançamento pra projetar. Entra aqui direto, igual ao 13º,
            // senão o funcionário simplesmente some da tela mesmo tendo folha ativa.
            mapaHolerites.forEach((h, chave) => {
                if (holeritesUsados.has(chave)) return;
                // Mesma comparação de data do caso "sem lançamento" acima (dProj < hoje) — sem
                // isso, um salário de mês já passado (ex: julho, filtrando o semestre) ficava
                // sempre em "a_vencer", nunca em "vencidos".
                const dtvctoMensal = new Date(h.ano, h.mes - 1, 5, 12, 0, 0);
                const statusHol = (h.status || 'Previsão');
                const foiPagoMensal = h.origem === 'real' && String(statusHol).toLowerCase() === 'pago';
                const ehHojeMensal = !foiPagoMensal && ehMesmoDia(dtvctoMensal, hoje);
                const statusFinalMensal = foiPagoMensal ? 'pago' : (ehHojeMensal ? 'pendente' : (dtvctoMensal < hoje ? 'atrasado' : (h.origem === 'real' ? 'pendente' : 'projecao')));
                const statusFiltroMensal = foiPagoMensal ? 'liquidado' : (ehHojeMensal ? 'hoje' : (dtvctoMensal < hoje ? 'vencidos' : 'a_vencer'));
                contasProjetadas.push({
                    idlancamento: `salario-${h.idfuncionario}-${h.mes}-${h.ano}`,
                    idpagamento: null,
                    tipovinculo: 'funcionario',
                    holerite_tipo13: false,
                    nome_vinculo: h.nome,
                    observacao: 'Salário',
                    idfuncionario_vinculo: h.idfuncionario,
                    vencimento: `05/${String(h.mes).padStart(2, '0')}/${h.ano}`,
                    dtvcto: `${h.ano}-${String(h.mes).padStart(2, '0')}-05`,
                    valorTotal: parseFloat(h.liquido || 0),
                    valorPago: statusFinalMensal === 'pago' ? parseFloat(h.liquido || 0) : 0,
                    status: statusFinalMensal,
                    statusFiltro: statusFiltroMensal,
                    idholerite: h.idholerite,
                    holerite_mes: h.mes,
                    holerite_ano: h.ano,
                    holerite_origem: h.origem,
                    status_holerite: h.status,
                    holerite_dtpagamento: h.dtpagamento,
                    holerite_comprovante: h.comprovante,
                    holerite_proventos: parseFloat(h.proventos || 0),
                    holerite_descontos: parseFloat(h.descontos || 0),
                    holerite_liquido: parseFloat(h.liquido || 0)
                });
            });

            // Benefícios (VA/VT): mesmo padrão do salário avulso acima, mas com vencimento e
            // status/pagamento PRÓPRIOS (ver PUT /rh/holerite/:id/pagar-beneficios) — não reusa
            // o "Pago" do salário porque saem em data e por meio diferentes.
            mapaBeneficios.forEach((b) => {
                const dtvctoBenef = new Date(b.dtvcto + 'T12:00:00');
                const statusBenefRaw = (b.status || 'Previsão');
                const foiPagoBenef = b.origem === 'real' && String(statusBenefRaw).toLowerCase() === 'pago';
                const ehHojeBenef = !foiPagoBenef && ehMesmoDia(dtvctoBenef, hoje);
                const statusFinalBenef = foiPagoBenef ? 'pago' : (ehHojeBenef ? 'pendente' : (dtvctoBenef < hoje ? 'atrasado' : (b.origem === 'real' ? 'pendente' : 'projecao')));
                const statusFiltroBenef = foiPagoBenef ? 'liquidado' : (ehHojeBenef ? 'hoje' : (dtvctoBenef < hoje ? 'vencidos' : 'a_vencer'));
                contasProjetadas.push({
                    idlancamento: `beneficios-${b.idfuncionario}-${b.mes}-${b.ano}`,
                    idpagamento: null,
                    tipovinculo: 'funcionario',
                    holerite_tipo13: false,
                    holerite_beneficios: true,
                    nome_vinculo: b.nome,
                    observacao: 'Benefícios (VA/VT)',
                    idfuncionario_vinculo: b.idfuncionario,
                    vencimento: b.dtvcto.split('-').reverse().join('/'),
                    dtvcto: b.dtvcto,
                    valorTotal: parseFloat(b.liquido || 0),
                    valorPago: statusFinalBenef === 'pago' ? parseFloat(b.liquido || 0) : 0,
                    status: statusFinalBenef,
                    statusFiltro: statusFiltroBenef,
                    idholerite: b.idholerite,
                    holerite_mes: b.mes,
                    holerite_ano: b.ano,
                    holerite_origem: b.origem,
                    status_holerite: b.status,
                    holerite_dtpagamento: b.dtpagamento,
                    holerite_comprovante: null,
                    holerite_proventos: 0,
                    holerite_descontos: 0,
                    holerite_liquido: parseFloat(b.liquido || 0)
                });
            });

            // --- 1. DEFINIÇÃO DOS LIMITES DE DATA (Adicione isso antes de filtrar) ---
            let dInicioComp, dFimComp;
            let dataBase = inputDataStr ? new Date(inputDataStr + 'T12:00:00') : new Date();

            switch (filtroTipo) {
                case 'diario':
                    dInicioComp = new Date(dataBase);
                    dInicioComp.setHours(0,0,0,0);
                    dFimComp = new Date(dataBase);
                    dFimComp.setHours(23,59,59,999);
                    break;
                case 'semanal':
                    dInicioComp = new Date(dataBase);
                    dInicioComp.setDate(dataBase.getDate() - dataBase.getDay());
                    dInicioComp.setHours(0,0,0,0);
                    dFimComp = new Date(dInicioComp);
                    dFimComp.setDate(dInicioComp.getDate() + 6);
                    dFimComp.setHours(23,59,59,999);
                    break;
                case 'mensal':
                    const mesSel = parseInt(document.querySelector("#sub-filtro-select")?.value) - 1 || dataBase.getMonth();
                    dInicioComp = new Date(anoSelecionado, mesSel, 1, 0, 0, 0);
                    dFimComp = new Date(anoSelecionado, mesSel + 1, 0, 23, 59, 59);
                    break;
                case 'trimestral':
                    const mesInicioTrim = Math.floor(dataBase.getMonth() / 3) * 3;
                    dInicioComp = new Date(anoSelecionado, mesInicioTrim, 1, 0, 0, 0);
                    dFimComp = new Date(anoSelecionado, mesInicioTrim + 3, 0, 23, 59, 59);
                    break;
                case 'semestral':
                    const mesInicioSem = dataBase.getMonth() < 6 ? 0 : 6;
                    dInicioComp = new Date(anoSelecionado, mesInicioSem, 1, 0, 0, 0);
                    dFimComp = new Date(anoSelecionado, mesInicioSem + 6, 0, 23, 59, 59);
                    break;
                case 'anual':
                    dInicioComp = new Date(anoSelecionado, 0, 1, 0, 0, 0);
                    dFimComp = new Date(anoSelecionado, 11, 31, 23, 59, 59);
                    break;
                default:
                    dInicioComp = new Date(anoSelecionado, 0, 1, 0, 0, 0);
                    dFimComp = new Date(anoSelecionado, 11, 31, 23, 59, 59);
            }

            // --- 2. FILTRAGEM DAS CONTAS PROJETADAS ---
            
            contasParaExibir = contasProjetadas.filter(c => {
                const dataVcto = new Date(c.dtvcto + 'T12:00:00');
                const statusC = (c.status || '').toLowerCase();

                // 1. Verificações de Status
                const ehSuspenso = (statusC === "suspenso");
                const ehPago = (statusC === "pago");

                // 2. Lógica de Período
                const estaNoPeriodo = (dataVcto >= dInicioComp && dataVcto <= dFimComp);

                // 3. Lógica de Atrasados: SÓ é atrasado se NÃO estiver suspenso e NÃO estiver pago
                const ehAtrasado = (!ehSuspenso && !ehPago && statusC === "atrasado" && dataVcto < dFimComp);

                // 4. Lógica de Pagos Anteriores
                const ehPagoAnterior = (ehPago && dataVcto < dFimComp && dataVcto.getFullYear() === anoFiltro);

                // 5. Lógica de Suspensos: Queremos que eles apareçam se forem do período ou se estiverem "pendentes" (atrás)
                // Se você quer que suspensos antigos continuem aparecendo na lista:
                const ehSuspensoRelevante = (ehSuspenso && dataVcto <= dFimComp);

                // Funcionário (salário/13º) é previsão automática pra TODOS os meses do ano, não
                // uma dívida real — não deve "vazar" por estar em atraso; respeita só o período
                // selecionado no card (mensal/semanal/diário etc), igual a qualquer outro filtro.
                if ((c.tipovinculo || '').toLowerCase() === 'funcionario') return estaNoPeriodo;

                return estaNoPeriodo || ehAtrasado || ehPagoAnterior || ehSuspensoRelevante;
            });

            // --- 3. CÁLCULO DO RESUMO BASEADO NO FILTRO ---
            
            const resumo = contasParaExibir.reduce((acc, c) => {
                const v = parseFloat(c.valorTotal || 0);
                const statusC = (c.status || "").toLowerCase(); // Normaliza para evitar erro de maiúscula

                acc.total += v;

                if (statusC === "pago") {
                    acc.pago += parseFloat(c.valorPago || v);
                } 
                else if (statusC === "suspenso") {
                    acc.suspensos = (acc.suspensos || 0) + v; // Soma em categoria à parte
                } 
                else if (statusC === "atrasado") {
                    acc.vencidos += v;
                }
                else if (statusC === "hoje") {
                    acc.hoje += v;
                }
                else {
                    acc.aVencer += v;
                }
                return acc;
            }, { pago: 0, vencidos: 0, hoje: 0, aVencer: 0, total: 0, suspensos: 0 });


            // 4. RENDERIZAÇÃO
            // Usamos 'contasParaExibir' que já definimos e filtramos lá em cima
            if (contasParaExibir.length > 0) { 
                // Ordenação por data de vencimento
                contasParaExibir.sort((a, b) => new Date(a.dtvcto) - new Date(b.dtvcto));

                // Título Mestre
                const btnMestreContas = document.createElement('button');
                btnMestreContas.className = 'accordion-mestre-header';
                btnMestreContas.id = 'btn-mestre-contas';
                
                // Usamos o 'resumo' que já foi calculado lá em cima logo após o filtro
                btnMestreContas.innerHTML = `
                    <div class="evento-info-container-inline">
                        <div class="evento-titulo-col">
                            <span class="setinha">▶</span> 💸 Contas a Pagar <small>(${contasParaExibir.length})</small>
                        </div>
                        <div class="evento-valores-col">
                            <div class="fin-resumo-item">
                                <span class="label-categoria">PAGO:</span> <span class="pg">${formatarMoeda(resumo.pago)}</span>
                                <span class="label-categoria" style="margin-left:15px; color:#d9534f;">VENCIDOS:</span> <span class="ap" style="color:#d9534f;">${formatarMoeda(resumo.vencidos)}</span>
                                ${resumo.hoje > 0 ? `<span class="label-categoria" style="margin-left:15px; color:#b8860b;">HOJE:</span> <span class="ap" style="color:#b8860b;">${formatarMoeda(resumo.hoje)}</span>` : ''}
                                <span class="label-categoria" style="margin-left:15px; color:#007bff;">A VENCER:</span> <span class="ap" style="color:#007bff;">${formatarMoeda(resumo.aVencer)}</span>
                                ${resumo.suspensos > 0 ? `<span class="label-categoria" style="margin-left:15px; color:#c05621;" title="Nem vencida nem a vencer — pausada até alguém reativar ou resolver.">SUSPENSO:</span> <span class="ap" style="color:#c05621;">${formatarMoeda(resumo.suspensos)}</span>` : ''}
                                <span style="margin-left:20px; padding-left:15px; border-left: 2px solid #ddd;">
                                    <span class="label-categoria" style="color:var(--text-1);">TOTAL:</span>
                                    <strong style="color:var(--text-1); font-size: 16px;">${formatarMoeda(resumo.total)}</strong>
                                </span>
                            </div>
                        </div>
                    </div>`;

                const wrapperContas = document.createElement('div');
                wrapperContas.className = "wrapper-contas-financeiro";
                wrapperContas.style.display = 'none';
                wrapperContas.id = 'wrapper-contas';

                btnMestreContas.addEventListener('click', () => {
                    // 1. Alterna a classe active (isso fará a setinha girar via CSS)
                    btnMestreContas.classList.toggle('active');
                    
                    // 2. Alterna a visibilidade do wrapper
                    const isVisible = wrapperContas.style.display === 'block';
                    wrapperContas.style.display = isVisible ? 'none' : 'block';
                });

                // --- BOTÕES DE FILTRO (Atrasadas, Hoje, etc) ---
                const containerFiltrosContas = document.createElement("div");
                containerFiltrosContas.className = "filtros-rapidos-contas";
                containerFiltrosContas.style="margin: 10px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; background: var(--surface-3); padding: 10px; border-radius: 8px; border: 1px solid #dee2e6;";

                const opcoesContas = [
                    { id: 'todos', label: 'Tudo', color: '#343a40' },
                    { id: 'vencidos', label: 'Atrasadas', color: '#d9534f' },
                    { id: 'hoje', label: 'Hoje', color: '#f0ad4e' },
                    { id: 'a_vencer', label: 'A Vencer', color: '#007bff' },
                    { id: 'vence_5_dias', label: 'Vence em 5 dias', color: '#17a2b8' },
                    { id: 'liquidado', label: 'Pagas', color: '#28a745' }
                ];

                // Filtro de status (botões) + busca por texto (vínculo/descrição) combinados —
                // guardamos o status ativo aqui pra busca não "esquecer" a aba selecionada.
                let statusContasAtivo = 'todos';

                const inputBuscaContas = document.createElement("input");
                inputBuscaContas.type = "text";
                inputBuscaContas.id = "buscaContasAPagar";
                inputBuscaContas.placeholder = "🔎 Buscar por vínculo ou descrição...";
                inputBuscaContas.autocomplete = "off";
                inputBuscaContas.style = "flex: 1; min-width: 220px; padding: 6px 10px; border-radius: 15px; border: 1px solid #ccc; font-size: 12px;";
                inputBuscaContas.addEventListener("input", () => {
                    aplicarFiltroContas(wrapperContas, statusContasAtivo, inputBuscaContas.value);
                });

                opcoesContas.forEach(opt => {
                    const btn = document.createElement("button");
                    btn.setAttribute("data-label-base", opt.label);
                    btn.setAttribute("data-filtro-id", opt.id);
                    btn.innerText = opt.label;
                    btn.className = "btn-filtro-financeiro";
                    btn.style=`padding: 5px 12px; border-radius: 15px; border: 1px solid ${opt.color}; background: var(--surface-1); color: ${opt.color}; cursor: pointer; font-weight: bold; font-size: 12px;`;

                    btn.onclick = () => {
                        statusContasAtivo = opt.id;
                        aplicarFiltroContas(wrapperContas, statusContasAtivo, inputBuscaContas.value);
                        containerFiltrosContas.querySelectorAll("button").forEach(b => {
                            b.style.background = "var(--surface-1)"; b.style.color = b.style.borderColor;
                        });
                        btn.style.background = opt.color; btn.style.color = "white";
                    };
                    containerFiltrosContas.appendChild(btn);
                });

                containerFiltrosContas.appendChild(inputBuscaContas);
                wrapperContas.appendChild(containerFiltrosContas);
                accordionContainer.appendChild(btnMestreContas);
                accordionContainer.appendChild(wrapperContas);

                // Agrupamento por Vínculo (Usando as contas JÁ FILTRADAS para a tela)
                const agrupados = contasParaExibir.reduce((acc, c) => {
                    let tipo = (c.tipovinculo || 'OUTROS').toUpperCase();
                    if (!acc[tipo]) acc[tipo] = [];
                    acc[tipo].push(c);
                    return acc;
                }, {});

                ['FORNECEDOR', 'FUNCIONARIO', 'CLIENTE', 'OUTROS'].forEach(t => {
                    // Passamos 'hojeRelativo' em vez de 'hoje' para manter a consistência do ano
                    // Funcionário é projetado pra TODO funcionário de folha fixa, mesmo sem
                    // salário cadastrado ainda (valor 0) — nesse caso o accordion "Funcionários"
                    // não deve aparecer, senão mostra um grupo vazio (0/0) sem utilidade. O valor
                    // real do funcionário é holerite_liquido, não valorTotal (que pode vir de um
                    // lançamento antigo com vlrestimado desatualizado — mesma lógica usada no
                    // resumo do header em criarAccordionVinculo).
                    const grupo = agrupados[t];
                    const temValor = grupo && grupo.some(c => parseFloat(t === 'FUNCIONARIO' ? (c.holerite_liquido || 0) : (c.valorTotal || 0)) > 0);
                    if (grupo && (t !== 'FUNCIONARIO' || temValor)) wrapperContas.appendChild(criarAccordionVinculo(t, grupo, hojeRelativo));
                });

                setTimeout(atualizarContadoresFiltrosContas, 300);
            }

            // FGTS estimado (8% sobre salário+proventos tributáveis) dos funcionários de folha no
            // MESMO período em tela (dInicioComp/dFimComp calculados acima) — direto de
            // resContas.holerites (uma linha por funcionário/mês, sem risco de duplicar contando
            // por lançamento). Só informativo: vira conta de verdade quando alguém lançar a guia
            // (GRF) manualmente em Contas, não é gerado automaticamente aqui.
            const fgtsAliquota = Number(resContas.fgtsAliquota) || 0.08;
            fgtsEstimado = (resContas.holerites || []).reduce((soma, h) => {
                const dtHolerite = new Date(h.ano, h.mes - 1, 1, 12, 0, 0);
                if (dtHolerite < dInicioComp || dtHolerite > dFimComp) return soma;
                return soma + (Number(h.proventos) || 0) * fgtsAliquota;
            }, 0);
       }

        console.log("✅ AGORA HÁ ITENS?", contasProjetadas.length);

        conteudoGeral.appendChild(accordionContainer);

              // ✅ AQUI é o lugar certo — DOM já está montado
        const filtroAtivo = window._filtroEventosAtivo || 'hoje';

        // Marca visualmente o botão correto
        const containerFiltros = conteudoGeral.querySelector(".filtros-rapidos-eventos");
        if (containerFiltros) {
            containerFiltros.querySelectorAll(".btn-filtro-rapido").forEach(b => {
                const cor = b.style.borderColor;
                if (b.dataset.filter === filtroAtivo) {
                    b.style.background = cor;
                    b.style.color = "white";
                } else {
                    b.style.background = "var(--surface-1)";
                    b.style.color = cor;
                }
            });
        }

        // Aplica o filtro agora que os itens já estão no DOM
        filtrarEventosNaTela(filtroAtivo);

        // Certifique-se que o nome do array aqui é o mesmo que você deu o 'push' lá em cima
        atualizarResumoGeralEstatico(dados, contasParaExibir, valoresResumoElement, fgtsEstimado);
        // Como deve ser (Correto: usa apenas o que passou pelos filtros de data):

        // --- MODO FOCO: bloco escolhido nos botões de acesso rápido já abre expandido,
        // escondendo o resumo (cards/avisos) e o outro bloco pra ocupar toda a tela.
        const focoAtivo = window._focoVencimentoAtivo || null;
        const wrapperEventosEl = conteudoGeral.querySelector('#container-mestre-eventos');
        const wrapperContasEl = conteudoGeral.querySelector('#wrapper-contas');
        const btnMestreEventosEl = wrapperEventosEl?.previousElementSibling;
        const btnMestreContasEl = wrapperContasEl?.previousElementSibling;

        if (valoresResumoElement) valoresResumoElement.style.display = focoAtivo ? 'none' : '';

        // A barra do acordeão (título + totais) só aparece quando o bloco está em foco —
        // no modo normal a navegação é 100% pelos botões de acesso rápido, então repetir
        // a barra recolhida no meio da tela é redundante (pedido da usuária 2026-09-09).
        if (btnMestreEventosEl && wrapperEventosEl) {
            const abrir = focoAtivo === 'eventos';
            btnMestreEventosEl.style.display = abrir ? '' : 'none';
            wrapperEventosEl.style.display = abrir ? 'block' : 'none';
            btnMestreEventosEl.classList.toggle('active', abrir);
        }
        if (btnMestreContasEl && wrapperContasEl) {
            const abrir = focoAtivo === 'contas';
            btnMestreContasEl.style.display = abrir ? '' : 'none';
            wrapperContasEl.style.display = abrir ? 'block' : 'none';
            btnMestreContasEl.classList.toggle('active', abrir);
        }

    } catch (error) {
        console.error("Erro:", error);
        conteudoGeral.innerHTML = '<p class="alerta-erro">Erro ao carregar dados.</p>';
    }
}


function filtrarEventosNaTela(statusAlvo) {
    // 1. Seleciona todos os accordions (Staff, Grupos de Financeiro, etc)
    const itens = document.querySelectorAll(".accordion-item");
    
    console.log(`Filtrando por: ${statusAlvo}`);

    itens.forEach(item => {
        // Verifica se este item é um grupo do financeiro (tem linhas dentro)
        const linhasInternas = item.querySelectorAll(".item-financeiro-linha");

        if (linhasInternas.length > 0) {
            // --- LÓGICA PARA CONTAS A PAGAR (GRUPOS) ---
            let temFilhoVisivel = false;
            
            linhasInternas.forEach(linha => {
                const statusLinha = linha.getAttribute("data-status-filtro");
                if (statusAlvo === 'todos' || statusLinha === statusAlvo) {
                    linha.style.display = ""; // Mostra linha
                    temFilhoVisivel = true;
                } else {
                    linha.style.display = "none"; // Esconde linha
                }
            });

            // Mostra o grupo (ex: Fornecedor) apenas se sobrar alguma linha visível
            item.style.display = (statusAlvo === 'todos' || temFilhoVisivel) ? "block" : "none";

            // Refinamento por funcionário: o grupo "Funcionários" reúne VÁRIAS pessoas dentro
            // do mesmo accordion-item (cada uma com seu próprio cabeçalho de nome + linha de
            // total, ligados às categorias dela por data-func-chave) — sem isso, o cabeçalho de
            // quem não tem nenhuma categoria batendo com o filtro ficava visível do mesmo jeito,
            // um nome "órfão" sem dado nenhum embaixo. Aqui só mostra o cabeçalho/total de cada
            // funcionário se sobrou pelo menos uma categoria DELE visível.
            const chavesVisiveis = new Set();
            item.querySelectorAll(".item-financeiro-linha[data-func-chave]").forEach(linha => {
                if (linha.style.display !== "none") chavesVisiveis.add(linha.getAttribute("data-func-chave"));
            });
            item.querySelectorAll("[data-func-chave]:not(.item-financeiro-linha)").forEach(linha => {
                linha.style.display = chavesVisiveis.has(linha.getAttribute("data-func-chave")) ? "" : "none";
            });

        } else {
            // --- LÓGICA PARA STAFF (ITENS ÚNICOS) ---
            // data-status-filtro pode ter MAIS DE UMA categoria separada por espaço (ex:
            // "vencidos a_vencer", quando o evento tem Ajuda vencida e Cachê a vencer ao mesmo
            // tempo) — por isso agora checa se a categoria clicada está na lista, não igualdade
            // exata (que só batia com a categoria de maior prioridade e escondia o evento das
            // outras abas onde ele também tinha dinheiro de verdade).
            const categoriasDoItem = (item.getAttribute("data-status-filtro") || "").split(" ");
            if (statusAlvo === 'todos' || categoriasDoItem.includes(statusAlvo)) {
                item.style.display = "block";
            } else {
                item.style.display = "none";
            }
        }
    });
}

// Filtro combinado (status + busca por texto) só pra seção "Contas a Pagar" — scoped ao
// wrapperContas pra não mexer no filtro de Staff, que usa filtrarEventosNaTela globalmente.
function aplicarFiltroContas(wrapperContas, statusAlvo, termoBusca) {
    const termo = (termoBusca || "").trim().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

    wrapperContas.querySelectorAll(".accordion-item").forEach(item => {
        let temFilhoVisivel = false;

        item.querySelectorAll(".item-financeiro-linha").forEach(linha => {
            const statusLinha = linha.getAttribute("data-status-filtro");
            const bateStatus = (statusAlvo === 'todos' || statusLinha === statusAlvo);

            const textoLinha = linha.textContent.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
            const bateTexto = !termo || textoLinha.includes(termo);

            const mostrar = bateStatus && bateTexto;
            linha.style.display = mostrar ? "" : "none";
            if (mostrar) temFilhoVisivel = true;
        });

        item.style.display = temFilhoVisivel ? "block" : "none";

        // Mesmo refinamento por funcionário do filtrarEventosNaTela: só mostra o
        // cabeçalho/total de cada pessoa se sobrou alguma categoria dela visível.
        const chavesVisiveis = new Set();
        item.querySelectorAll(".item-financeiro-linha[data-func-chave]").forEach(linha => {
            if (linha.style.display !== "none") chavesVisiveis.add(linha.getAttribute("data-func-chave"));
        });
        item.querySelectorAll("[data-func-chave]:not(.item-financeiro-linha)").forEach(linha => {
            linha.style.display = chavesVisiveis.has(linha.getAttribute("data-func-chave")) ? "" : "none";
        });
    });
}

// function filtrarEventosNaTela(statusAlvo) {
//     const itens = document.querySelectorAll(".accordion-item");

//     itens.forEach(item => {
//         const linhasInternas = item.querySelectorAll(".item-financeiro-linha");

//         if (linhasInternas.length > 0) {
//             let temFilhoVisivel = false;

//             linhasInternas.forEach(linha => {
//                 const statusLinha = linha.getAttribute("data-status-filtro");
//                 const mostrar = (statusAlvo === 'todos' || statusLinha === statusAlvo);
//                 linha.style.display = mostrar ? "" : "none";
//                 if (mostrar) temFilhoVisivel = true;
//             });

//             item.style.display = temFilhoVisivel ? "block" : "none";

//         } else {
//             const statusDoItem = item.getAttribute("data-status-filtro");
//             item.style.display = (statusAlvo === 'todos' || statusDoItem === statusAlvo) ? "block" : "none";
//         }
//     });
// }

function atualizarContadoresFiltrosContas() {
    const container = document.querySelector(".filtros-rapidos-contas");
    if (!container) return;

    const contadores = {
        todos: document.querySelectorAll(".item-financeiro-linha").length,
        vencidos: document.querySelectorAll('.item-financeiro-linha[data-status-filtro="vencidos"]').length,
        hoje: document.querySelectorAll('.item-financeiro-linha[data-status-filtro="hoje"]').length,
        a_vencer: document.querySelectorAll('.item-financeiro-linha[data-status-filtro="a_vencer"]').length,
        liquidado: document.querySelectorAll('.item-financeiro-linha[data-status-filtro="liquidado"]').length
    };

    const botoes = container.querySelectorAll("button");
    botoes.forEach(btn => {
        const idFiltro = btn.getAttribute("data-filtro-id");
        const labelBase = btn.getAttribute("data-label-base");
        
        if (contadores[idFiltro] !== undefined) {
            const valor = contadores[idFiltro];
            btn.innerText = `${labelBase} (${valor})`;
            
            // Lógica de Pulsação
            if (idFiltro === 'vencidos' && valor > 0) {
                btn.classList.add('pulse-vencido');
            } else if (idFiltro === 'hoje' && valor > 0) {
                btn.classList.add('pulse-hoje');
            } else {
                btn.classList.remove('pulse-vencido', 'pulse-hoje');
            }

            // Opacidade para botões vazios
            if (valor === 0 && idFiltro !== 'todos') {
                btn.style.opacity = "0.4";
                btn.style.pointerEvents = "none";
            } else {
                btn.style.opacity = "1";
                btn.style.pointerEvents = "auto";
            }
        }
    });
}

function converterData(dataStr) {
    if (!dataStr || dataStr === '---') return null;

    // Se vier no formato ISO do banco (Ex: 2026-02-10T03:00... ou apenas 2026-02-10)
    let dataLimpa = dataStr.split('T')[0]; 
    let partes = dataLimpa.split(/[-/]/);

    if (partes.length === 3) {
        let ano, mes, dia;
        
        if (partes[0].length === 4) { // Formato YYYY-MM-DD
            ano = parseInt(partes[0]);
            mes = parseInt(partes[1]) - 1;
            dia = parseInt(partes[2]);
        } else { // Formato DD-MM-YYYY
            ano = parseInt(partes[2]);
            mes = parseInt(partes[1]) - 1;
            dia = parseInt(partes[0]);
        }
        
        // Criamos ao meio-dia para evitar que o fuso horário mude o dia
        return new Date(ano, mes, dia, 12, 0, 0);
    }
    return null;
}


function criarAccordionVinculo(tipo, lista, hoje) {
    const ehFuncionario = (tipo || '').toUpperCase() === 'FUNCIONARIO';
    const temPermissaoSupremo = temPermissao("Pagamentos", "supremo");
    // Coluna AÇÕES (pagar/suspender/reverter) só aparece pra quem tem nível master, supremo
    // ou devs — mesmo padrão já usado em AjusteFinanceiro.js. Os demais nem veem a coluna.
    const podeVerAcoesFinanceiro = temPermissao("Pagamentos", "devs")
        || temPermissao("Pagamentos", "supremo")
        || temPermissao("Pagamentos", "master");
    // Total de colunas da tabela, considerando se a coluna AÇÕES está sendo exibida — usado
    // pra manter os colspan (header do mês, "nenhum registro", linha de total) sempre certos.
    const totalColunas = (ehFuncionario ? 8 : 7) + (podeVerAcoesFinanceiro ? 1 : 0);
    const hojeISO = hoje.toLocaleDateString('sv-SE');
    const hojeBR = hoje.toLocaleDateString('pt-BR');

    const dHoje = new Date(hoje); 
    dHoje.setHours(0,0,0,0);

    const dProximos5Dias = new Date(dHoje);
    dProximos5Dias.setDate(dHoje.getDate() + 5);

    // 1. CÁLCULO DO RESUMO DO CABEÇALHO (Ignora suspensos)
    const resumoVinculo = lista.reduce((acc, c) => {
        const statusOriginal = (c.status || 'pendente').toLowerCase();
        
        if (statusOriginal === 'suspenso') return acc;

        const vPago = Math.max(0, parseFloat(c.vlrpago || 0));
        const vSaldo = Math.max(0, parseFloat(c.saldo || 0));
        // Funcionário: o valor real é o líquido calculado do holerite (mesmo usado por linha na
        // tabela) — não o valor genérico do lançamento (vlrestimado), que não reflete o salário
        // de fato cadastrado e pode inflar o total do card (ex: cadastro sem salário = R$0 real,
        // mas vlrestimado do lançamento continua com um valor antigo/estimado).
        const vTotalItem = ehFuncionario
            ? parseFloat(c.holerite_liquido || 0)
            : parseFloat(c.valorTotal || c.vlrreal || c.vlrestimado || 0);

        const dataVctoStr = c.dtvcto || (c.vencimento ? c.vencimento.split('/').reverse().join('-') : "");
        const dParcela = dataVctoStr ? new Date(dataVctoStr + "T12:00:00") : null;
        if(dParcela) dParcela.setHours(0,0,0,0);

        let statusCalculo = statusOriginal;
        if (statusOriginal !== 'pago' && dParcela && dParcela < dHoje) {
            statusCalculo = 'atrasado';
        }

        if (statusCalculo !== 'pago' && statusCalculo !== 'atrasado' && dParcela) {
            if (dParcela > dHoje && dParcela <= dProximos5Dias) {
                acc.venceEm5Dias += vSaldo || vTotalItem;
                acc.temProximos5 = true;
            }
        }

        if (statusCalculo === 'pago') {
            acc.pagos += vPago || vTotalItem;
            acc.total += vPago || vTotalItem;
        } else if (statusCalculo === 'atrasado') {
            acc.vencidos += vSaldo || vTotalItem;
            acc.total += vTotalItem;
            acc.pendente += vSaldo || vTotalItem;
            acc.temVencido = true;
        } else {
            if (dParcela && dParcela.getTime() === dHoje.getTime()) {
                acc.valorHoje += vSaldo || vTotalItem;
                acc.temHoje = true;
            } else {
                acc.aVencer += vSaldo || vTotalItem;
            }
            acc.total += vTotalItem;
            acc.pendente += vSaldo || vTotalItem;
        }
        return acc;
    }, { pagos: 0, pendente: 0, total: 0, vencidos: 0, valorHoje: 0, aVencer: 0, temVencido: false, temHoje: false, temProximos5: false });

    // 2. MONTAGEM DOS ALERTAS DO HEADER
    let alertasTexto = [];
    if (resumoVinculo.vencidos > 0) {
        alertasTexto.push(`<span style="display: inline-flex; align-items: center; gap: 4px;"><span class="dot-alerta"></span><strong style="color:#d9534f; font-size: 16px;">VENCIDOS: ${formatarMoeda(resumoVinculo.vencidos)}</strong></span>`);
    }
    if (resumoVinculo.temHoje) {
        alertasTexto.push(`<span style="display: inline-flex; align-items: center; gap: 6px; margin-right: 10px;"><span class="dot-alerta pulse-amarelo" style="background-color: #ffcc00; width: 10px; height: 10px; border-radius: 50%;"></span><strong style="color:#f0ad4e; font-size: 16px;">HOJE: ${formatarMoeda(resumoVinculo.valorHoje)}</strong></span>`);
    }
    if (resumoVinculo.aVencer > 0) {
        alertasTexto.push(`<span style="display: inline-flex; align-items: center; gap:6px; margin-right: 10px;"><span class="dot-alerta pulse-azul" style="background-color: #007bff; width: 10px; height: 10px; border-radius: 50%;"></span><strong style="color:#007bff; font-size: 16px;">A VENCER: ${formatarMoeda(resumoVinculo.aVencer)}</strong></span>`);
    }
    if (resumoVinculo.pagos > 0) {
        alertasTexto.push(`<strong style="color:#2E8B57; font-size: 16px;">PAGOS: ${formatarMoeda(resumoVinculo.pagos)}</strong>`);
    }
    if (resumoVinculo.temProximos5) {
        alertasTexto.push(`<span style="display: inline-flex; align-items: center; gap: 6px;"><span class="dot-alerta" style="background-color: #17a2b8; width: 10px; height: 10px; border-radius: 50%;"></span><strong style="color:#17a2b8; font-size: 16px;">5 DIAS: ${formatarMoeda(resumoVinculo.venceEm5Dias)}</strong></span>`);
    }

    let subStatusHtml = alertasTexto.length > 0 
        ? `<div style="margin-top: 6px; display: flex; flex-wrap: wrap; gap: 10px; align-items: center;">${alertasTexto.join(' <span style="color:#ddd">|</span> ')}</div>`
        : `<small style="color:#28a745; font-weight: bold; display:block; margin-top:4px;">✓ LIQUIDADO</small>`;

    const item = document.createElement("div");
    item.className = "accordion-item item-financeiro";
    
    let statusParaFiltro = "a_vencer";
    if (resumoVinculo.temVencido) statusParaFiltro = "vencidos";
    else if (resumoVinculo.temHoje) statusParaFiltro = "hoje";
    else if (resumoVinculo.temProximos5) statusParaFiltro = "vence_5_dias";
    else if (resumoVinculo.pendente <= 0) statusParaFiltro = "liquidado";
    item.setAttribute("data-status-filtro", statusParaFiltro);

    // Ordenação
    lista.sort((a, b) => {
        const dataA = (a.dtvcto || "").substring(0, 10);
        const dataB = (b.dtvcto || "").substring(0, 10);
        if (dataA < dataB) return -1;
        if (dataA > dataB) return 1;
        return (a.nome_vinculo || "").toLowerCase().localeCompare((b.nome_vinculo || "").toLowerCase());
    });

    
    item.innerHTML = `
    <div class="accordion-header" style="cursor: pointer; display: flex; align-items: center; width: 100%;" tabindex="0">
        <div class="evento-info-container-inline ${resumoVinculo.temVencido ? 'vencido-critico' : ''}" style="display: flex; justify-content: space-between; flex-grow: 1; align-items: center;">
            <div class="evento-titulo-col" style="text-align: left;">
                <strong style="font-size: 19px;">${tipo}</strong>
                ${subStatusHtml}
            </div>
            <div class="evento-valores-col" style="display: flex; gap: 15px; text-align: right;">
                <div class="fin-resumo-item orcado">
                    <span style="font-size: 12px; color: var(--text-2); display:block;">TOTAL DO GRUPO</span>
                    <strong style="font-size: 17px;">${formatarMoeda(resumoVinculo.total)}</strong>
                </div>
            </div>
            ${ehFuncionario ? `
            <button type="button" class="btn-imprimir-todos-holerites" title="Imprime todos os holerites que estão sendo mostrados aqui (respeita o filtro de período ativo)" style="
                margin-left: 10px; padding: 6px 12px; background-color: var(--status-ok-fg, #2E8B57); color: var(--on-brand);
                border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 12px;
                white-space: nowrap;">
                <i class="fas fa-print" style="margin-right: 5px;"></i> Imprimir todos
            </button>` : ''}
        </div>
        <button type="button" class="btn-foco-contas" style="
            margin-left: 10px; 
            padding: 6px 12px; 
            background-color: #007bff; 
            color: var(--on-brand); 
            border: none; 
            border-radius: 4px; /* Estilo arredondado dos seus cards */
            cursor: pointer; 
            font-weight: bold;
            font-size: 12px;
            transition: background 0.3s;
            display: none; /* Ele aparece apenas quando o accordion abre */
            ">
            <i class="fas fa-expand-arrows-alt" style="margin-right: 5px;"></i> Visualizar em Tela Cheia
        </button>
    </div>
   

               
        </button>
        <div class="accordion-body">
            <div class="funcionarios-scroll-container">
                <table class="tabela-funcionarios-venc">
                    <thead>
                        <tr>
                            <th>VÍNCULO / DESCRIÇÃO</th>
                            ${ehFuncionario ? '<th style="text-align:center">CATEGORIA</th>' : ''}
                            <th style="text-align:center">VENCIMENTO</th>
                            ${podeVerAcoesFinanceiro ? '<th style="text-align:center">AÇÕES</th>' : ''}
                            <th style="text-align:center">STATUS</th>
                            <th style="text-align:center">DATA PAGAMENTO</th>
                            <th style="text-align:center">${ehFuncionario ? 'HOLERITE' : 'IMAGEM CONTA'}</th>
                            <th style="text-align:center">COMPROVANTE</th>
                            <th style="text-align:right">VALOR</th>
                        </tr>
                    </thead>
                    <tbody>
                    ${(() => {
                        if (!lista || lista.length === 0) return `<tr><td colspan="${totalColunas}" style="text-align:center;">Nenhum registro encontrado.</td></tr>`;

                        const gruposPorMes = lista.reduce((acc, curr) => {
                            const dStr = curr.dtvcto || curr.vencimento || "";
                            let rotulo = "SEM DATA";
                            if (dStr) {
                                const dt = new Date(dStr + "T12:00:00");
                                const mesesNome = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
                                rotulo = `${mesesNome[dt.getMonth()]} / ${dt.getFullYear()}`;
                            }
                            if (!acc[rotulo]) acc[rotulo] = [];
                            acc[rotulo].push(curr);
                            return acc;
                        }, {});

                        return Object.keys(gruposPorMes).map(mesAno => {
                            const itens = gruposPorMes[mesAno];
                            const headerMes = `<tr class="item-financeiro-linha" style="background: var(--surface-3); border-left: 5px solid #007bff;"><td colspan="${totalColunas}" style="padding: 12px; font-weight: bold;">${mesAno}</td></tr>`;

                            const linhasObjs = itens.map(c => {
                                const statusC = (c.status || 'pendente').toLowerCase();
                                const ehSuspenso = statusC === 'suspenso';
                                
                                // Lógica do Comprovante (Movida para dentro do map)
                                const arquivoComp = c.comprovantepagto;
                                const urlComp = (arquivoComp && arquivoComp !== '---') ? `${arquivoComp}` : null;
                                const urlEncoded = urlComp ? encodeURIComponent(urlComp) : '';

                                let vExibicao = statusC === 'pago' ? parseFloat(c.vlrpago || c.vlrreal || 0) : parseFloat(c.vlrreal || c.vlrestimado || 0);
                                // Fornecedor: c.dtvcto vem de uma coluna date/timestamp do Postgres, que o
                                // pg serializa com hora (ex: "2026-07-05T00:00:00.000Z") — sem cortar isso,
                                // a comparação de string com hojeBR/hojeISO abaixo nunca bate (nem em
                                // "Hoje" nem em "Vence em 5 dias"). Funcionário já manda "YYYY-MM-DD" puro,
                                // então o slice(0,10) não muda nada pra ele.
                                const dtvctoLimpo = c.dtvcto ? String(c.dtvcto).slice(0, 10) : "";
                                const dataExibicao = dtvctoLimpo ? dtvctoLimpo.split('-').reverse().join('/') : '---';
                                const pgtoExibicao = (c.dtpgto && c.dtpgto !== '---') ? c.dtpgto.substring(0, 10).split('-').reverse().join('/') : '---';
                                const vctoISO = dtvctoLimpo;

                                let estiloVencido = ""; let avisoStatus = ""; let filterLinha = "";
                                if (ehSuspenso) { filterLinha = "suspenso"; }
                                else if (statusC === 'pago') { filterLinha = "liquidado"; }
                                else {
                                    const dParcelaLinha = vctoISO ? new Date(vctoISO + "T12:00:00") : null;
                                    if(dParcelaLinha) dParcelaLinha.setHours(0,0,0,0);

                                    if (dataExibicao === hojeBR) { filterLinha = "hoje"; estiloVencido = "color: #f0ad4e; font-weight: bold;"; avisoStatus = `<span style="background:#f0ad4e; color:var(--on-brand); padding:2px 4px; border-radius:3px; font-size:10px; margin-right:5px;">HOJE</span>`; }
                                    else if (vctoISO && vctoISO < hojeISO) { filterLinha = "vencidos"; estiloVencido = "color: #d9534f; font-weight: bold;"; avisoStatus = `<span style="background:#d9534f; color:var(--on-brand); padding:2px 4px; border-radius:3px; font-size:10px; margin-right:5px;">VENCIDO</span>`; }
                                    else if (dParcelaLinha && dParcelaLinha <= dProximos5Dias) { // AQUI
                                        filterLinha = "vence_5_dias";
                                        estiloVencido = "color: #17a2b8; font-weight: bold;";
                                        avisoStatus = `<span style="background:#17a2b8; color:var(--on-brand); padding:2px 4px; border-radius:3px; font-size:10px; margin-right:5px;">5 DIAS</span>`;
                                    }
                                    else { filterLinha = "a_vencer"; }
                                }

                                const obsParaJs = (c.observacao || c.descricao || "").replace(/'/g, "\\'").replace(/"/g, '&quot;');

                                // Chave única da LINHA (parcela), usada nos ids dos inputs de upload.
                                // Não pode ser só o idpagamento: parcela futura de lançamento recorrente
                                // ainda não tem registro em `pagamentos`, então c.idpagamento vem
                                // null/undefined em TODOS os meses seguintes — os inputs nasciam todos com
                                // id "up_img_undefined" e o getElementById do ícone sempre abria o PRIMEIRO
                                // da página (agosto), mandando o upload pra parcela errada.
                                const chaveLinha = `${c.idlancamento || 'X'}_${(vctoISO || 'semdata').replace(/-/g, '')}`;
                                const idInputImg = `up_img_${chaveLinha}`;
                                const idInputComp = `up_comp_${chaveLinha}`;

                                // Grupo Funcionário: vencimento/pagamento/valor vêm do Holerite Virtual (RH), não
                                // do plano de contas — o pagamento é feito dentro do próprio holerite.
                                const statusHolerite = (c.status_holerite || 'previsao').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
                                const dtPagtoHolerite = c.holerite_dtpagamento ? String(c.holerite_dtpagamento).substring(0, 10).split('-').reverse().join('/') : '---';
                                const idFuncBotao = c.idfuncionario_vinculo || '';
                                const mesHolerite = c.holerite_mes || (dProj.getMonth() + 1);
                                const anoHolerite = c.holerite_ano || dProj.getFullYear();

                                // Imprimir só libera depois que o comprovante já foi anexado — a impressão
                                // agora inclui o comprovante junto (ver imprimirHoleriteExterno em RH.js),
                                // então sem comprovante anexado não tem o que juntar na impressão ainda.
                                const temComprovanteHolerite = !!(c.holerite_comprovante && c.holerite_comprovante !== '---');
                                // Benefícios não tem holerite/comprovante próprio pra imprimir (é o
                                // mesmo documento do salário) — essa célula não se aplica aqui.
                                const celulaHolerite = c.holerite_beneficios ? `
                                    <td style="text-align:center;"><small style="color:var(--text-3);">—</small></td>` : ehFuncionario ? `
                                    <td class="celula-holerite-imprimir" style="text-align:center;">
                                        ${temComprovanteHolerite ? `
                                        <a href="javascript:void(0)"
                                            onclick="imprimirHoleriteRH(${idFuncBotao}, ${mesHolerite}, ${anoHolerite})"
                                            style="text-decoration: none; color: var(--status-ok-fg, #2E8B57); display: flex; flex-direction: column; align-items: center; gap: 2px;">
                                            <i class="fas fa-print" style="font-size: 18px;"></i>
                                            <span style="font-size: 10px; font-weight: bold;">Imprimir (2 vias)</span>
                                        </a>` : `
                                        <small style="color:var(--text-3); font-style: italic;" title="Disponível após anexar o comprovante">Aguardando Comprovante</small>`}
                                    </td>` : `
                                    <td style="text-align:center;">
                                        ${c.imagemconta && c.imagemconta !== '---'
                                            ? `<a href="javascript:void(0)"
                                                onclick="abrirComprovanteSwal(encodeURIComponent('/uploads/contas/imagemboleto/${c.imagemconta}'))"
                                                style="text-decoration: none; color: var(--status-ok-fg, #2E8B57); display: flex; flex-direction: column; align-items: center; gap: 2px;">
                                                <i class="fas fa-file-invoice-dollar" style="font-size: 18px;"></i>
                                                <span style="font-size: 10px; font-weight: bold;">Ver Conta</span>
                                            </a>`
                                            : `<div>
                                                <input type="file" style="display:none" id="${idInputImg}" onchange="uploadArquivoFinanceiro(this, '${c.idpagamento || ''}', 'imagem', '${c.idlancamento}', '${vctoISO}')">
                                                <i class="fas fa-upload" style="color:#f0ad4e; cursor:pointer;" title="Subir Imagem da Conta" onclick="document.getElementById('${idInputImg}').click()"></i>
                                            </div>`
                                        }
                                    </td>`;

                                // Fecha o modo tela cheia (se estiver aberto) antes de navegar pro RH —
                                // senão a barra/overlay de tela cheia fica presa por cima da tela do RH.
                                const btnAbrirHolerite = `<button type="button" onclick="document.getElementById('btn-fechar-tela-cheia')?.click(); abrirHoleriteRH(${idFuncBotao}, ${mesHolerite}, ${anoHolerite})" title="Abrir Holerite" style="cursor:pointer; background:#0d6efd; border:none; padding:5px 8px; border-radius:4px;"><i class="fas fa-file-invoice" style="color:#fff;"></i></button>`;

                                // Funcionário (mensal OU 13º) não tem "pagamento" no fluxo de contas — o
                                // pagamento é sempre do HOLERITE do RH (PUT /rh/holerite/:id/pagar),
                                // nunca do lançamento/conta genérico (que nem reflete o valor real do
                                // holerite, como visto com salários desatualizados/duplicados).
                                const jaPagoHolerite = statusHolerite === 'pago';
                                // Ainda não conferido na lista do RH (holerite_origem !== 'real') — é só
                                // projeção, não tem o que pagar de verdade ainda (ver PUT
                                // /rh/holerite/:id/conferir). Sem essa trava, o botão PAGAR aparecia mesmo
                                // pra competências futuras/nunca revisadas.
                                const conferidoHolerite = c.holerite_origem === 'real';
                                // Benefícios chama uma rota de pagamento PRÓPRIA (pagar-beneficios) —
                                // mesmo idholerite do salário, mas status/dtpagamento em colunas
                                // separadas, então marcar um não mexe no outro.
                                const funcaoPagar = c.holerite_beneficios ? 'pagarBeneficiosFuncionario' : 'pagarHoleriteFuncionario';
                                const btnPagarHolerite = jaPagoHolerite
                                    ? '<i class="fas fa-lock"></i>'
                                    : !conferidoHolerite
                                        ? `<span title="Ainda não conferido na tela de RH — some daqui até ser conferido" style="color:var(--text-3); font-size:11px; font-style:italic;">Previsto</span>`
                                        : c.idholerite
                                            ? `<button type="button" onclick="${funcaoPagar}(${c.idholerite}, this)" class="btn-pago"><i class="fas fa-money-bill-wave"></i> PAGAR</button>`
                                            : `<span title="Abra o holerite pra gerar antes de pagar" style="color:var(--text-3); font-size:11px; font-style:italic;">Gerar no holerite</span>`;

                                // Coluna inteira (header + célula) só existe pra quem tem permissão
                                // master/supremo/devs — ver podeVerAcoesFinanceiro no topo da função.
                                const celulaAcoes = !podeVerAcoesFinanceiro ? '' : (ehFuncionario ? `
                                    <td style="text-align:center;">
                                        <div style="display:flex; align-items:center; justify-content:center; gap:6px;">
                                            ${btnPagarHolerite}
                                            ${btnAbrirHolerite}
                                        </div>
                                    </td>` : `
                                    <td style="text-align:center;">
                                        ${ehSuspenso
                                            ? `<button onclick="${temPermissaoSupremo ? `reverterSuspensao('${c.idlancamento}', '${c.idpagamento}', '${vctoISO}', '${obsParaJs}')` : `Swal.fire('Negado','Acesso Supremo Requerido','warning')`}" class="btn-reverter-suspensao" style="cursor: ${temPermissaoSupremo ? 'pointer' : 'not-allowed'}; background: ${temPermissaoSupremo ? '#6c757d' : '#eee'}; border:none; padding:5px 8px; border-radius:4px;"><i class="fas fa-unlock-alt" style="color:${temPermissaoSupremo ? '#fff' : '#ccc'}"></i></button>`
                                            : (statusC === 'pago' ? '<i class="fas fa-lock"></i>' : (typeof renderBotaoPagamento === 'function' ? renderBotaoPagamento(c) : ''))}
                                    </td>`);

                                const celulaStatus = ehFuncionario
                                    ? `<td style="text-align:center;"><span class="status-pilula status-${statusHolerite}">${(c.status_holerite || 'Previsão').toUpperCase()}</span></td>`
                                    : `<td id="celula-status-${c.idlancamento}" style="text-align:center;"><span class="status-pilula status-${statusC}">${statusC.toUpperCase()}</span></td>`;

                                const celulaDataPagamento = ehFuncionario
                                    ? `<td class="celula-data-pagamento" style="text-align:center;">${dtPagtoHolerite}</td>`
                                    : `<td id="celula-data-pgto-${c.idlancamento}" style="text-align:center;">${pgtoExibicao}</td>`;

                                // Benefícios: sem upload de comprovante próprio ainda (o idholerite é o
                                // mesmo do salário — subir um comprovante aqui misturaria com o do
                                // salário). Só mostra se já foi pago ou não.
                                const celulaComprovante = c.holerite_beneficios ? `
                                    <td style="text-align:center;">
                                        <small style="color:var(--text-3); font-style: italic;">${statusHolerite === 'pago' ? 'Pago' : 'Aguardando Pagamento'}</small>
                                    </td>` : ehFuncionario ? `
                                    <td class="celula-comprovante-holerite" style="text-align:center;">
                                        ${(c.holerite_comprovante && c.holerite_comprovante !== '---')
                                            ? `<a href="javascript:void(0)"
                                                onclick="abrirComprovanteSwal(encodeURIComponent('/uploads/rh/comprovantes/${c.holerite_comprovante}'))"
                                                style="text-decoration: none; color: var(--status-ok-fg, #2E8B57); display: flex; flex-direction: column; align-items: center; gap: 2px;">
                                                <i class="fas fa-receipt" style="font-size: 18px;"></i>
                                                <span style="font-size: 10px; font-weight: bold;">Ver Comp.</span>
                                            </a>`
                                            : (statusHolerite === 'pago'
                                                ? `<div>
                                                    <input type="file" style="display:none" id="up_comp_hol_${c.idholerite}" onchange="uploadComprovanteHolerite(this, ${c.idholerite})">
                                                    <i class="fas fa-upload" style="color:#f0ad4e; cursor:pointer;" title="Enviar comprovante" onclick="document.getElementById('up_comp_hol_${c.idholerite}').click()"></i>
                                                </div>`
                                                : '<small style="color:var(--text-3); font-style: italic;">Aguardando Pagamento</small>'
                                            )
                                        }
                                    </td>` : `
                                    <td id="celula-comprovante-${chaveLinha}" class="celula-comprovante-conta" style="text-align:center;">
                                        ${(c.comprovantepgto && c.comprovantepgto !== '---')
                                            ? `<a href="javascript:void(0)"
                                                onclick="abrirComprovanteSwal(encodeURIComponent('/uploads/contas/comprovantespgto/${c.comprovantepgto}'))"
                                                style="text-decoration: none; color: var(--status-ok-fg, #2E8B57); display: flex; flex-direction: column; align-items: center; gap: 2px;">
                                                <i class="fas fa-receipt" style="font-size: 18px;"></i>
                                                <span style="font-size: 10px; font-weight: bold;">Ver Comp.</span>
                                            </a>`
                                            : (statusC === 'pago'
                                                ? `<div>
                                                    <input type="file" style="display:none" id="${idInputComp}" onchange="uploadArquivoFinanceiro(this, '${c.idpagamento || ''}', 'comprovante', '${c.idlancamento}', '${vctoISO}')">
                                                    <i class="fas fa-upload" style="color:#f0ad4e; cursor:pointer;" title="Enviar comprovante" onclick="document.getElementById('${idInputComp}').click()"></i>

                                                </div>`
                                                : '<small style="color:var(--text-3); font-style: italic;">Aguardando Pagamento</small>'
                                            )
                                        }
                                    </td>`;

                                const valorLinha = ehFuncionario ? parseFloat(c.holerite_liquido || 0) : vExibicao;

                                // Funcionário: nome vem numa linha de cabeçalho própria do grupo (ver
                                // linhaNomeHeader, montada depois deste map) — cada linha de categoria
                                // (Salário/13º) fica só com o pill + os dados dela, sem célula de nome
                                // mesclada. Isso existe pra cada categoria poder ser escondida pelo filtro
                                // rápido (Hoje/Vencidos/A Vencer...) sem depender de rowspan — o Chrome não
                                // recalculava direito um rowspan quando uma linha do meio do grupo sumia
                                // (display:none), então esse grupo inteiro ficava fora do filtro por linha
                                // (ver "sem-filtro-rapido-por-linha", removido junto com esta mudança).
                                if (ehFuncionario) {
                                    const categoriaLabel = c.holerite_beneficios ? 'Benefícios (VA/VT)' : c.holerite_tipo13 ? (c.observacao || '13º salário') : 'Salário';
                                    const categoriaClasse = c.holerite_beneficios ? 'badge-beneficios' : c.holerite_tipo13
                                        ? (c.holerite_mes === 11 ? 'badge-13-1' : 'badge-13-2')
                                        : 'badge-salario';
                                    // data-func-chave: liga essa categoria ao cabeçalho de nome e à linha de
                                    // total do MESMO funcionário NA MESMA competência (montados depois, fora
                                    // do map) — sem o mês/ano na chave, o André de julho e o André de
                                    // setembro (mesmo idfuncionario, meses diferentes) ficariam com a mesma
                                    // chave, e um cabeçalho apareceria "emprestado" do outro mês. Várias
                                    // pessoas (e vários meses da MESMA pessoa) dividem o grupo "Funcionários"
                                    // inteiro na tela — ver filtrarEventosNaTela.
                                    const funcChave = `${c.idfuncionario_vinculo || c.nome_vinculo || ''}-${mesHolerite}-${anoHolerite}`;
                                    const abreLinha = `<tr class="item-financeiro-linha ${ehSuspenso ? 'linha-suspensa' : ''}" data-status-filtro="${ehSuspenso ? 'suspenso' : filterLinha}" data-func-chave="${funcChave}" data-print-idfunc="${idFuncBotao}" data-print-mes="${mesHolerite}" data-print-ano="${anoHolerite}" data-print-tipo="${c.holerite_tipo13 ? '13' : 'mensal'}" data-print-pronto="${statusHolerite === 'pago' && temComprovanteHolerite ? '1' : '0'}">`;
                                    const nomeCel = `<td style="border-bottom: 2px solid #dee2e6; ${ehSuspenso ? 'text-decoration: none !important;' : estiloVencido}">
                                            ${ehSuspenso ? '<i class="fas fa-pause-circle" style="color: var(--text-2); margin-right: 5px;"></i>' : avisoStatus}
                                            <strong>${c.nome_vinculo || '---'}</strong><br><small style="color:var(--text-2);">${c.observacao || c.descricao || ''}</small>
                                        </td>`;
                                    const restoCels = `
                                            <td style="text-align:center;"><span class="badge-categoria ${categoriaClasse}">${categoriaLabel}</span></td>
                                            <td style="text-align:center;">
                                                ${ehSuspenso ? '<i class="fas fa-pause-circle" style="color: var(--text-2); margin-right: 5px;"></i>' : avisoStatus}${dataExibicao}
                                            </td>
                                            ${celulaAcoes}
                                            ${celulaStatus}
                                            ${celulaDataPagamento}
                                            ${celulaHolerite}
                                            ${celulaComprovante}
                                            <td style="text-align:right; ${ehSuspenso ? 'text-decoration: none !important;' : estiloVencido}"><strong>${formatarMoeda(valorLinha)}</strong></td>
                                        </tr>`;
                                    return {
                                        abreLinha, nomeCel, restoCels,
                                        idfunc: c.idfuncionario_vinculo || c.nome_vinculo || '',
                                        nomeVinculo: c.nome_vinculo || '---',
                                        mesHolerite, anoHolerite,
                                        valorLinha,
                                    };
                                }

                                return `
                                    <tr id="linha-pgto-${c.idlancamento}" class="item-financeiro-linha ${ehSuspenso ? 'linha-suspensa' : ''}" data-status-filtro="${ehSuspenso ? 'suspenso' : filterLinha}">
                                        <td style="${ehSuspenso ? 'text-decoration: none !important;' : estiloVencido}">
                                            ${ehSuspenso ? '<i class="fas fa-pause-circle" style="color: var(--text-2); margin-right: 5px;"></i>' : avisoStatus}
                                            <strong>${c.nome_vinculo || '---'}</strong><br><small style="color:var(--text-2);">${c.observacao || c.descricao || ''}</small>
                                        </td>
                                        <td style="text-align:center;">${dataExibicao}</td>
                                        ${celulaAcoes}
                                        ${celulaStatus}
                                        ${celulaDataPagamento}
                                        ${celulaHolerite}
                                        ${celulaComprovante}
                                        <td style="text-align:right; ${ehSuspenso ? 'text-decoration: none !important;' : estiloVencido}"><strong>${formatarMoeda(valorLinha)}</strong></td>
                                    </tr>`;
                            });

                            if (ehFuncionario) {
                                // Agrupa as linhas (já computadas como objetos) por funcionário, preservando
                                // a ordem de aparição.
                                const porFunc = new Map();
                                linhasObjs.forEach((l) => {
                                    if (!porFunc.has(l.idfunc)) porFunc.set(l.idfunc, []);
                                    porFunc.get(l.idfunc).push(l);
                                });

                                const linhasAgrupadas = Array.from(porFunc.values()).map((grupo) => {
                                    const temTotal = grupo.length > 1;
                                    const totalFunc = grupo.reduce((soma, l) => soma + (l.valorLinha || 0), 0);

                                    // Nome do funcionário numa linha de cabeçalho própria (SEM a classe
                                    // "item-financeiro-linha") — por isso o filtro rápido por linha
                                    // (filtrarEventosNaTela) nunca esconde ela pelo status. Em vez disso, ela
                                    // carrega o MESMO data-func-chave das categorias desse funcionário —
                                    // várias pessoas dividem o mesmo grupo "Funcionários" na tela, então
                                    // filtrarEventosNaTela usa essa chave pra saber se sobrou alguma
                                    // categoria DESTE funcionário visível, e só aí mostra o cabeçalho/total
                                    // dele (senão ficaria um nome "órfão" sem nenhum dado embaixo). Substitui
                                    // a antiga célula com rowspan, que o Chrome não recalculava direito
                                    // quando uma linha do meio do grupo era escondida por um filtro.
                                    const funcChaveGrupo = `${grupo[0].idfunc}-${grupo[0].mesHolerite}-${grupo[0].anoHolerite}`;

                                    // Sem borda entre as linhas de categoria do MESMO funcionário — quando
                                    // há total, ele fecha o grupo (border-top); sem total, a própria (única)
                                    // linha leva a borda de fechamento reforçada, pra separar bem do próximo
                                    // funcionário.
                                    const linhasCategorias = grupo.map((l) => {
                                        const linha = l.abreLinha + l.nomeCel + l.restoCels;
                                        return temTotal
                                            ? linha.replace('class="item-financeiro-linha', 'class="item-financeiro-linha grupo-funcionario-sem-borda')
                                            : linha.replace('class="item-financeiro-linha', 'class="item-financeiro-linha grupo-funcionario-fechamento');
                                    }).join('');

                                    // Total também fora de "item-financeiro-linha" — de novo, não deve ser
                                    // escondido individualmente pelo filtro rápido (ela nem tinha
                                    // data-status-filtro próprio antes, então em qualquer filtro que não
                                    // fosse "todos" já sumia sozinha, mesmo com categorias visíveis).
                                    const linhaTotal = temTotal ? `
                                        <tr class="linha-total-funcionario grupo-funcionario-fechamento" data-func-chave="${funcChaveGrupo}">
                                            <td colspan="${totalColunas - 1}" style="text-align:right; padding:8px;">TOTAL DO FUNCIONÁRIO</td>
                                            <td style="text-align:right; padding:8px;"><strong>${formatarMoeda(totalFunc)}</strong></td>
                                        </tr>` : '';

                                    return linhasCategorias + linhaTotal;
                                }).join('');

                                return headerMes + linhasAgrupadas;
                            }

                            const linhas = linhasObjs.join('');
                            return headerMes + linhas;
                        }).join('');
                    })()}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    item.querySelector('.accordion-header').onclick = () => item.classList.toggle("active");

    // 1. Referências (Importante: buscar após o innerHTML ser injetado)
    const header = item.querySelector('.accordion-header');
    const corpo = item.querySelector('.accordion-body');
    const btnFoco = item.querySelector('.btn-foco-contas');

    // 2. Função de visibilidade
    const atualizarBotaoFoco = () => {
        if (item.classList.contains("active")) {
            btnFoco.style.setProperty('display', 'inline-block', 'important');
        } else {
            btnFoco.style.display = "none";
        }
    };

    // 3. Evento Único
    header.onclick = (e) => {

        const clicouImprimirTodos = e.target.closest('.btn-imprimir-todos-holerites');
        if (clicouImprimirTodos) {
            e.stopPropagation();
            // Só imprime quem está PAGO e já tem comprovante anexado — mesma condição que
            // libera o "Imprimir (2 vias)" individual de cada linha.
            const linhas = item.querySelectorAll('tr[data-print-idfunc][data-print-pronto="1"]');
            const lista = Array.from(linhas).map(tr => ({
                idfuncionario: tr.dataset.printIdfunc,
                mes: tr.dataset.printMes,
                ano: tr.dataset.printAno,
                tipo: tr.dataset.printTipo,
            }));
            if (!lista.length) {
                Swal.fire("Nada pra imprimir", "Nenhum holerite pago e com comprovante anexado nessa lista.", "warning");
                return;
            }
            if (typeof window.imprimirHoleritesEmLote === "function") {
                window.imprimirHoleritesEmLote(lista);
            } else {
                Swal.fire("Indisponível", "Abra a tela de RH ao menos uma vez nesta sessão pra habilitar a impressão em lote.", "warning");
            }
            return;
        }

        const clicouNoBotaoTelaCheia = e.target.closest('.btn-foco-contas');

        if (clicouNoBotaoTelaCheia) {
            e.stopPropagation();

            document.body.style.overflow = "hidden";

            // 1. Identifica o título da conta (ajustado para o seu HTML de fornecedores)
            const nomeConta = item.querySelector("strong")?.innerText?.trim() || "Detalhes da Conta";

            // 2. Barra de Topo
            let barraTopoFoco = document.getElementById("barra-topo-foco-evento");
            if (!barraTopoFoco) {
                barraTopoFoco = document.createElement("div");
                barraTopoFoco.id = "barra-topo-foco-evento";
                document.body.appendChild(barraTopoFoco);
            }

            Object.assign(barraTopoFoco.style, {
                position: "fixed", top: "0", left: "0", width: "100%", height: "90px",
                backgroundColor: "var(--primary-color, #611414)", display: "flex", alignItems: "center",
                justifyContent: "center", zIndex: "99999", boxShadow: "0 2px 10px rgba(0,0,0,0.5)"
            });
            barraTopoFoco.innerHTML = `<h2 style="margin:0; font-size:18px; color:#ffffff; font-weight:bold;">${nomeConta}</h2>`;
            barraTopoFoco.style.display = "flex";

            // 3. ESCONDE O QUE ESTÁ FORA (Mas NÃO o wrapper-contas)
            const externos = [".resumo-detalhado", "#valores-resumo", "#btn-mestre-contas", ".accordion-mestre-header", ".sidebar"];
            externos.forEach(sel => {
                const el = document.querySelector(sel);
                if (el) el.style.display = "none";
            });

            // 4. ESCONDE OS OUTROS CARDS (Irmãos)
            const containerPai = item.parentElement;
            containerPai.querySelectorAll(".accordion-item").forEach(outro => {
                if (outro !== item) {
                    outro.style.display = "none";
                }
            });

            // 5. EXIBE OS DETALHES (O "CORPO")
            item.classList.add("modo-tela-cheia", "active"); // Força o active para o CSS abrir o corpo
      
            if (corpo) {
                // 1. Identifica os pais que podem estar limitando o tamanho
                const containerGeral = document.getElementById("vencimentos-conteudo");
                const accordionItem = corpo.closest('.accordion-item');

                // 2. Limpa as "travas" de altura nos níveis superiores
                [containerGeral, accordionItem].forEach(el => {
                    if (el) {
                        el.style.setProperty("max-height", "none", "important");
                        el.style.setProperty("height", "auto", "important");
                        el.style.setProperty("overflow", "visible", "important");
                    }
                });

                // 3. Aplica a Expansão Real no Corpo
                // Fundo/texto por token, não fixos: o "#fff" que estava aqui é inline e
                // vence qualquer regra de tema, então no modo escuro a tela cheia voltava
                // a ser uma folha branca com o texto claro da tabela sumindo dentro dela.
                Object.assign(corpo.style, {
                    display: "block",
                    position: "fixed",
                    top: "90px",            // Ajuste conforme sua barra superior
                    left: "0",
                    width: "100vw",
                    height: "calc(100vh - 90px)",
                    backgroundColor: "var(--surface-1)",
                    color: "var(--text-1)",
                    zIndex: "99998",        // Garante que fique acima do dashboard
                    overflowY: "auto",      // O scroll PRECISA acontecer aqui
                    overflowX: "hidden",
                    padding: "15px"
                });

                // 4. Força a visibilidade da tabela e remove o "dirty checking" visual
                const tabela = corpo.querySelector('table');
                if (tabela) {
                    tabela.style.setProperty("width", "100%", "important");
                    tabela.style.setProperty("height", "auto", "important");
                    tabela.style.setProperty("display", "table", "important");
                    tabela.style.marginBottom = "100px"; 
                }
            }

            // 6. BOTÃO VOLTAR
            const botaoVoltar = document.createElement("button");
            botaoVoltar.id = "btn-fechar-tela-cheia";
            botaoVoltar.innerHTML = '✕ FECHAR';
            // O botão fica em cima da barra de marca (vermelho JA), que não muda com o
            // tema — então o contraste dele tem que ser resolvido contra ESSA barra, não
            // contra a superfície da página: fundo translúcido branco + texto --on-brand,
            // que é branco nos dois modos. O "background: white / color: #611414" antigo
            // era um vermelho escrito à mão que ignorava tanto o tema quanto a empresa.
            Object.assign(botaoVoltar.style, {
                position: "fixed", top: "25px", right: "20px", zIndex: "100000",
                padding: "8px 20px", background: "rgba(255,255,255,0.15)", color: "var(--on-brand)",
                border: "1px solid rgba(255,255,255,0.5)", borderRadius: "20px",
                cursor: "pointer", fontWeight: "bold", transition: "background 0.2s"
            });
            botaoVoltar.onmouseover = () => { botaoVoltar.style.background = "rgba(255,255,255,0.3)"; };
            botaoVoltar.onmouseout = () => { botaoVoltar.style.background = "rgba(255,255,255,0.15)"; };

            botaoVoltar.onclick = (ev) => {
                ev.stopPropagation();
                document.body.style.overflow = "";
                item.classList.remove("modo-tela-cheia");
                if (corpo) corpo.style = ""; 
                barraTopoFoco.style.display = "none";
                botaoVoltar.remove();

                // Restaura tudo
                externos.forEach(sel => {
                    const el = document.querySelector(sel);
                    if (el) el.style.display = "";
                });
                containerPai.querySelectorAll(".accordion-item").forEach(outro => {
                    outro.style.display = "";
                });
            };
            document.body.appendChild(botaoVoltar);

        }  else {
            // === CASO: CLIQUE NORMAL (ABRIR/FECHAR) ===
            item.classList.toggle("active");
            
            // Captura o botão azul dentro deste item específico
            const btnFoco = item.querySelector('.btn-foco-evento') || item.querySelector('.btn-foco-contas');
            
            if (btnFoco) {
                // Se o card está aberto (active), o botão PRECISA aparecer
                if (item.classList.contains("active")) {
                    btnFoco.style.setProperty("display", "inline-block", "important");
                    btnFoco.style.setProperty("visibility", "visible", "important");
                    btnFoco.style.setProperty("opacity", "1", "important");
                } else {
                    btnFoco.style.display = "none";
                }
            }
        }
    }
    return item;


}


function aplicarFiltrosFinanceiros() {
    // Busca qual botão de status está "ativo" (precisamos adicionar a classe 'active' no clique)
    const statusSel = document.querySelector(".btn-filtro-financeiro.active")?.getAttribute("data-filtro-id") || "todos";

    const todasAsLinhas = document.querySelectorAll(".wrapper-contas-financeiro tr[data-status-filtro]");

    todasAsLinhas.forEach(linha => {
        const statusFiltro = linha.getAttribute("data-status-filtro");

        const bateStatus = (statusSel === "todos" || statusFiltro === statusSel);

        // Só exibe se passar pelo filtro de status
        linha.style.display = bateStatus ? "" : "none";
    });
    
    // Opcional: Se uma categoria (ex: FORNECEDORES) ficar vazia, você pode esconder o accordion dela aqui
}

function headerClickHandler(item) {
    const btn = item.querySelector('.accordion-header');
    if(btn) btn.onclick = () => item.classList.toggle("active");
}

function renderAcoesComprovante(c) {
    // Se já houver um comprovante (Conta já foi paga e arquivada)
    if (c.comprovante_url) {
        return `
            <a href="${c.comprovante_url}" target="_blank" class="btn-ver-comprovante" title="Ver Comprovante">
                <i class="fas fa-file-invoice-dollar" style="font-size: 1.2em; color: var(--status-ok-fg, #2E8B57);"></i>
            </a>
        `;
    }

    // Se o status for pago mas não tem arquivo, mostra o ícone de upload
    if (c.status.toLowerCase() === 'pago') {
        return `
            <label class="label-upload-comprovante" title="Subir Comprovante">
                <input type="file" style="display:none" onchange="uploadComprovanteConta(this, ${c.idpagamento || c.idlancamento})">
                <i class="fas fa-cloud-upload-alt" style="cursor:pointer; color:#007bff; font-size: 1.2em;"></i>
            </label>
        `;
    }

    // Caso contrário, está pendente
    return `<small style="color: var(--text-3); font-style: italic;">Aguardando Pagamento</small>`;
}


// function renderBotaoPagamento(c) {
//     // 1. Se já estiver pago, mostra o ícone de confirmação
//     if (c.status && c.status.toLowerCase() === 'pago') {
//         return `<i class="fas fa-check-double" style="color: var(--status-ok-fg, #2E8B57);" title="Lançamento Confirmado"></i>`;
//     }

//     // 2. Tratamento da observação para evitar quebra no JS
//     const textoObs = (c.observacao || c.observacao_vencimento || "")
//         .replace(/[\n\r]/g, ' ')
//         .replace(/'/g, "\\'")
//         .replace(/"/g, '\\"');

//     const dataVcto = c.dtvcto || c.vencimento || "";
//     const valorParaPagar = c.vlrprevisto || c.valor || 0;
//     const idPgto = (c.idpagamento && c.idpagamento !== 'null') ? c.idpagamento : 'null';

//     const vinculo = (c.tipovinculo || "").toLowerCase();

//     // 3. Retorno usando suas classes .btn-pago e .btn-suspenso
//     return `
//         <div class="btn-group-acoes" style="display:flex; gap:8px; justify-content:center;">
//             <button class="btn-pago" 
//                     onclick="abrirModalPagamento(${idPgto}, ${c.idlancamento}, ${valorParaPagar}, '${dataVcto}', '${textoObs}', '${vinculo}', '${c.descricao}')">
//                 <i class="fas fa-money-bill-wave"></i> PAGAR
//             </button>
            
//             <button class="btn-suspenso" 
//                     onclick="suspenderConta(${c.idlancamento}, ${idPgto}, '${dataVcto}', '${textoObs}')">
//                 <i class="fas fa-pause"></i> SUSP.
//             </button>
//         </div>
//     `;
// }

function renderBotaoPagamento(c) {
    if (c.status && c.status.toLowerCase() === 'pago') {
        return `<i class="fas fa-check-double" style="color: var(--status-ok-fg, #2E8B57);" title="Lançamento Confirmado"></i>`;
    }

    const textoObs = (c.observacao || c.observacao_vencimento || "").replace(/[\n\r]/g, ' ').replace(/'/g, "\\'").replace(/"/g, '\\"');
    const dataVcto = c.dtvcto || c.vencimento || "";
    // valorTotal é o campo já corrigido (usa vlrestimado vigente quando ainda não existe
    // pagamento pra essa parcela) — c.vlrprevisto/c.valor podem vir "contaminados" do
    // pagamento de outro mês já realizado (ver o spread em contasProjetadas.push).
    const valorParaPagar = c.valorTotal || c.vlrprevisto || c.valor || 0;
    const idPgto = (c.idpagamento && c.idpagamento !== 'null') ? c.idpagamento : 'null';
    const vinculo = (c.tipovinculo || "").toLowerCase();

    // Adicionamos o ID dinâmico: container-acoes-${c.idlancamento}
    return `
        <div id="container-acoes-${c.idlancamento}" class="btn-group-acoes" style="display:flex; gap:8px; justify-content:center;">
            <button class="btn-pago" 
                    onclick="abrirModalPagamento(${idPgto}, ${c.idlancamento}, ${valorParaPagar}, '${dataVcto}', '${textoObs}', '${vinculo}', '${c.descricao}')">
                <i class="fas fa-money-bill-wave"></i> PAGAR
            </button>
            <button class="btn-suspenso" 
                    onclick="suspenderConta(${c.idlancamento}, ${idPgto}, '${dataVcto}', '${textoObs}')">
                <i class="fas fa-pause"></i> SUSP.
            </button>
        </div>
    `;
}

async function abrirModalPagamento(idPagamento, idLancamento, valorSugerido, vencimento, obsExistente = "", tipoVinculo = "", descricao = "") {
    const dataHojeObj = new Date();
    dataHojeObj.setHours(0, 0, 0, 0);

    const isFuncionario = tipoVinculo === 'funcionario';

    function obterProximoDiaUtil(data) {
        let d = new Date(data);
        while (d.getDay() === 0 || d.getDay() === 6) {
            d.setDate(d.getDate() + 1);
        }
        return d;
    }

    // "YYYY-MM-DD" puro vira UTC-meia-noite se passado direto pro Date(), o que em
    // fusos negativos (Brasil, UTC-3) volta pro dia anterior — daí marcar como
    // atrasado um pagamento feito no próprio dia do vencimento. Força horário local.
    const dataVencimentoUtil = obterProximoDiaUtil(new Date(vencimento + 'T00:00:00'));
    const eAtrasado = isFuncionario ? false : (dataHojeObj > dataVencimentoUtil);
    const vencimentoFormatado = vencimento.split('-').reverse().join('/');

    const { value: formValues, isDismissed } = await Swal.fire({
        title: 'Confirmar Pagamento',
        html: `
            <style>
                input[type=number]::-webkit-inner-spin-button, 
                input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
                input[type=number] { -moz-appearance: textfield; }
                .swal-row { display: flex; gap: 10px; width: 95%; margin: 0 auto 10px auto; text-align: left; }
                .swal-col { flex: 1; display: flex; flex-direction: column; }
                .swal-col label { font-size: 12px; font-weight: bold; margin-bottom: 3px; }
                .swal-col input { margin: 0 !important; width: 100% !important; height: 38px !important; font-size: 14px !important; }
            </style>
            <div style="font-family: sans-serif;">
                <div class="swal-row">
                    <div class="swal-col">
                        <label>Valor Original (R$):</label>
                        <input id="swal-vlr-original" class="swal2-input" oninput="formatReais(this)" type="text" inputmode="decimal" value="R$ ${parseFloat(valorSugerido || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}" readonly style="background: var(--surface-3);">
                    </div>
                    <div class="swal-col">
                        <label>Vencimento Original:</label>
                        <input id="swal-dt-venc" class="swal2-input" type="text" value="${vencimentoFormatado}" readonly style="background: var(--surface-3);">
                    </div>
                </div>

                <div class="swal-row">
                    ${eAtrasado ? `
                    <div class="swal-col">
                        <label style="color: #d9534f;">Atraso (Juros/Multa):</label>
                        <input id="swal-vlr-atraso" class="swal2-input" oninput="formatReais(this)" type="text" inputmode="decimal" value="R$ 0,00" style="border-color: #d9534f;">
                    </div>
                    ` : `<input id="swal-vlr-atraso" type="hidden" value="0">`}

                    <div class="swal-col">
                        <label style="color: #0275d8;">Desconto (R$):</label>
                        <input id="swal-vlr-desconto" class="swal2-input" oninput="formatReais(this)" type="text" inputmode="decimal" value="R$ 0,00" style="border-color: #0275d8;">
                    </div>
                </div>

                <div class="swal-row">
                    <div class="swal-col">
                        <label style="color: #28a745;">Valor Total Pago (R$):</label>
                        <input id="swal-vlrpago" class="swal2-input" oninput="formatReais(this)" type="text" inputmode="decimal" value="R$ ${parseFloat(valorSugerido || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}" style="font-weight: bold; border-color: #28a745; color: #28a745;">
                    </div>
                    <div class="swal-col">
                        <label>Data do Pagamento:</label>
                        <input id="swal-dtpgto" class="swal2-input" type="date" value="${dataHojeObj.toISOString().split('T')[0]}">
                    </div>
                </div>

                <div class="swal-row" style="flex-direction: column;">
                    <label>Observação ${isFuncionario ? '(Opcional)' : ''}:</label>
                    <textarea id="swal-obs" class="swal2-textarea" style="width: 100%; margin: 0; height: 70px; font-size:13px;">${obsExistente}</textarea>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-check"></i> Confirmar Baixa',
        cancelButtonText: '<i class="fas fa-times"></i> Desistir',
        confirmButtonColor: '#28a745',
        cancelButtonColor: '#6c757d',
        reverseButtons: true, // Coloca o cancelar à esquerda e o confirmar à direita
        didOpen: () => {
            const inputOriginal = document.getElementById('swal-vlr-original');
            const inputAtraso = document.getElementById('swal-vlr-atraso');
            const inputDesconto = document.getElementById('swal-vlr-desconto');
            const inputTotal = document.getElementById('swal-vlrpago');

            const calcularTotal = () => {
                const original = parseFloat(window.desformatarReais(inputOriginal.value)) || 0;
                const atraso = parseFloat(window.desformatarReais(inputAtraso.value)) || 0;
                const desconto = parseFloat(window.desformatarReais(inputDesconto.value)) || 0;
                const total = original + atraso - desconto;
                inputTotal.value = "R$ " + total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            };

            if(inputAtraso) inputAtraso.addEventListener('input', calcularTotal);
            inputDesconto.addEventListener('input', calcularTotal);
        },
        preConfirm: () => {
            const vlrTotal = window.desformatarReais(document.getElementById('swal-vlrpago').value);
            const vlrOriginal = window.desformatarReais(document.getElementById('swal-vlr-original').value);
            const dataPgto = document.getElementById('swal-dtpgto').value;
            const vlrAtraso = parseFloat(window.desformatarReais(document.getElementById('swal-vlr-atraso')?.value)) || 0;
            const vlrDesconto = parseFloat(window.desformatarReais(document.getElementById('swal-vlr-desconto').value)) || 0;
            let obsFinal = document.getElementById('swal-obs').value.trim();

            if (!vlrTotal || !dataPgto) return Swal.showValidationMessage('Preencha os campos obrigatórios!');

            // Validação de Observação (Não obriga se for funcionário)
            if (!isFuncionario && (eAtrasado || vlrAtraso > 0 || vlrDesconto > 0)) {
                if (obsFinal === "" || obsFinal === obsExistente.trim()) {
                    return Swal.showValidationMessage('Justifique a alteração na observação.');
                }
            }

            let tags = "";
            if (eAtrasado) tags += " Atrasado ";
            if (vlrAtraso > 0) tags += `[Atraso: R$ ${vlrAtraso.toFixed(2)}] `;
            if (vlrDesconto > 0) tags += `[Desconto: R$ ${vlrDesconto.toFixed(2)}] `;

            if (tags && !obsFinal.includes(tags.trim())) {
                obsFinal = obsFinal !== obsExistente.trim() ? `${obsFinal} | ${tags.trim()}` : `${obsExistente.trim()} | ${tags.trim()}`;
            }

            return {
                vlrpago: vlrTotal,
                vlrreal: vlrOriginal,
                dtpagamento: dataPgto,
                observacao: obsFinal,
                vlrAtraso: vlrAtraso,
                vlrDesconto: vlrDesconto
            };
        }
    });

    // Se o usuário clicar em "Desistir" ou fora do modal, o código para aqui
    if (isDismissed) return;

    // if (formValues) {
    //     enviarBaixaPagamento(idPagamento, idLancamento, formValues.vlrpago, formValues.dtpagamento, vencimento, formValues.observacao, formValues.vlrAtraso, formValues.vlrDesconto);
    // }
    // Se o usuário clicar em "Desistir" ou fora do modal, o código para aqui
    if (formValues) {
        const { vlrpago, vlrreal, vlrAtraso, vlrDesconto, observacao, dtpagamento } = formValues;
        
        // Prepara o texto de resumo (Acréscimo ou Desconto)
        let resumoAjuste = "";
        if (vlrAtraso > 0) {
            resumoAjuste = `<br><small style="color: #d9534f;">(Incluindo R$ ${vlrAtraso.toFixed(2)} de acréscimo)</small>`;
        } else if (vlrDesconto > 0) {
            resumoAjuste = `<br><small style="color: #0275d8;">(Com R$ ${vlrDesconto.toFixed(2)} de desconto)</small>`;
        }

        // --- 3. SEGUNDO SWAL: Confirmação Efetiva ---
        const confirmacao = await Swal.fire({
            title: 'Confirmar Valor?',
            html: `
                <div style="font-size: 16px; font-family: sans-serif;">
                    Você está baixando o lançamento "${descricao}" com o pagamento do Valor Total de: <br>
                    <b style="font-size: 24px; color: #28a745;">R$ ${parseFloat(vlrpago).toLocaleString('pt-br', {minimumFractionDigits: 2})}</b>
                    ${resumoAjuste}
                </div>
            `,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#28a745',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Sim, baixar agora!',
            cancelButtonText: 'Não, revisar',
            reverseButtons: true
        });

        // --- 4. ENVIO FINAL: Só acontece se o "Sim" for clicado ---
        if (confirmacao.isConfirmed) {
            enviarBaixaPagamento(
                idPagamento,
                idLancamento,
                vlrpago,
                dtpagamento,
                vencimento,
                observacao,
                vlrAtraso,
                vlrDesconto,
                vlrreal
            );
        }
    }
}
window.abrirModalPagamento = abrirModalPagamento;


// async function enviarBaixaPagamento(idPagamento, idLancamento, vlrpago, dtpagamento, dtvcto, observacao, vlratraso, vlrdesconto) {
//     try {
//         // Garantimos que os valores numéricos sejam tratados como float para o backend
//         const corpoRequisicao = {
//             idpagamento: idPagamento,
//             idlancamento: idLancamento,
//             vlrpago: parseFloat(vlrpago),
//             dtpagamento: dtpagamento,
//             dtvcto: dtvcto,
//             observacao: observacao,
//             vlratraso: parseFloat(vlratraso),     // Novo campo
//             vlrdesconto: parseFloat(vlrdesconto)   // Novo campo
//         };

//         console.log("Corpo da requisição para baixa:", corpoRequisicao); // Log para debug

//         const dados = await fetchComToken('/main/confirmar-pagamento-conta', {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify(corpoRequisicao)
//         });

//         if (dados && dados.sucesso) {
//             Swal.fire({ 
//                 icon: 'success', 
//                 title: 'Pagamento Confirmado!', 
//                 text: isNaN(vlratraso) || vlratraso <= 0 ? '' : 'Acrescimos registrados com sucesso.',
//                 timer: 1500, 
//                 showConfirmButton: false 
//             });

//             const linha = document.getElementById(`linha-pgto-${idLancamento}`);

//             if (linha) {
//                 const tbody = linha.parentElement;
                
//                 // Efeito visual de sucesso
//                 linha.style.transition = 'all 0.4s ease';
//                 linha.style.opacity = '0';
//                 linha.style.backgroundColor = '#d4edda'; 

//                 setTimeout(() => {
//                     linha.remove(); 
                    
//                     // Verifica se o container ficou vazio para exibir mensagem amigável
//                     if (tbody && tbody.querySelectorAll('tr').length === 0) {
//                         const accordionBody = tbody.closest('.accordion-body');
//                         if (accordionBody) {
//                             accordionBody.innerHTML = '<p style="padding:20px; text-align:center; color:var(--text-3); font-style: italic;">Todas as pendências deste grupo foram pagas!</p>';
//                         }
//                     }
//                 }, 400);
//             }
//         } else {
//             Swal.fire('Erro ao Processar', (dados ? dados.erro : 'Erro desconhecido no servidor.'), 'error');
//         }
//     } catch (err) {
//         console.error("Erro na requisição de baixa:", err);
//         Swal.fire('Erro de Conexão', 'Não foi possível comunicar com o servidor.', 'error');
//     }
// }

async function enviarBaixaPagamento(idPagamento, idLancamento, vlrpago, dtpagamento, dtvcto, observacao, vlratraso, vlrdesconto, vlrreal) {
    try {
        const corpoRequisicao = {
            idpagamento: idPagamento,
            idlancamento: idLancamento,
            vlrpago: parseFloat(vlrpago),
            vlrreal: parseFloat(vlrreal) || parseFloat(vlrpago),
            dtpagamento: dtpagamento,
            dtvcto: dtvcto,
            observacao: observacao,
            vlratraso: parseFloat(vlratraso),
            vlrdesconto: parseFloat(vlrdesconto),
            status: 'pago'
        };

        const dados = await fetchComToken('/main/confirmar-pagamento-conta', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(corpoRequisicao)
        });

        if (dados && dados.sucesso) {
            // Toast rápido para não atrapalhar o fluxo
            Swal.fire({ 
                icon: 'success', 
                title: 'Confirmado!', 
                timer: 1000, 
                showConfirmButton: false,
                position: 'top-end',
                toast: true
            });

            // LOCALIZA O CONTAINER DOS BOTÕES
            const container = document.getElementById(`container-acoes-${idLancamento}`);
            const linha = document.getElementById(`linha-pgto-${idLancamento}`);

            if (container) {
                // Substitui os botões por um ícone de check (estilo "pago")
                container.innerHTML = `<i class="fas fa-check-double" style="color: var(--status-ok-fg, #2E8B57); font-size: 1.2rem;" title="Pago agora"></i>`;

                // Opcional: muda a cor da linha para indicar sucesso sem removê-la
                if (linha) {
                    linha.style.backgroundColor = '#f0fff4'; // Verde bem clarinho
                    linha.style.transition = 'background-color 0.5s ease';
                }
            }

            // Atualiza Status e Data Pagamento na hora — antes só apareciam corretos
            // depois de recarregar a página, porque essas células não eram tocadas aqui.
            const celulaStatus = document.getElementById(`celula-status-${idLancamento}`);
            if (celulaStatus) {
                celulaStatus.innerHTML = `<span class="status-pilula status-pago">PAGO</span>`;
            }
            const celulaDataPgto = document.getElementById(`celula-data-pgto-${idLancamento}`);
            if (celulaDataPgto && dtpagamento) {
                celulaDataPgto.textContent = dtpagamento.split('-').reverse().join('/');
            }

            // Antes de existir um pagamento pra essa parcela, os inputs de upload da
            // linha (up_img_/up_comp_) nasceram com id vazio/undefined (c.idpagamento
            // ainda não existia). Agora que o pagamento foi criado, reaponta esses
            // inputs pro idpagamento real — senão o upload seguinte falha (400).
            if (linha && dados.idpagamento) {
                // O id do input carrega a chave da linha (idlancamento_dtvcto) e precisa
                // continuar único — reescrevê-lo pro idpagamento puro só troca de colisão.
                // Aqui basta injetar o idpagamento real no onchange, preservando o id.
                let chaveLinhaAtual = '';
                linha.querySelectorAll('input[type="file"][id^="up_img_"], input[type="file"][id^="up_comp_"]').forEach(inp => {
                    const ehImagem = inp.id.startsWith('up_img_');
                    const prefixo = ehImagem ? 'up_img_' : 'up_comp_';
                    const tipoUpload = ehImagem ? 'imagem' : 'comprovante';
                    chaveLinhaAtual = inp.id.slice(prefixo.length);
                    const vctoLinha = (dtvcto || '');
                    inp.setAttribute('onchange', `uploadArquivoFinanceiro(this, '${dados.idpagamento}', '${tipoUpload}', '${idLancamento}', '${vctoLinha}')`);
                });

                // A célula de Comprovante só mostra o upload quando status === 'pago' —
                // até agora ela foi renderizada como "Aguardando Pagamento" (sem input
                // nenhum pra reapontar acima). Libera o upload aqui, na hora, sem reload.
                // Busca dentro da própria linha: o id da célula é por parcela, e o
                // idlancamento sozinho aparece repetido em todos os meses projetados.
                const celulaComprovante = linha.querySelector('.celula-comprovante-conta');
                if (celulaComprovante && !celulaComprovante.querySelector('a')) {
                    const novoIdComp = `up_comp_${chaveLinhaAtual || dados.idpagamento}`;
                    celulaComprovante.innerHTML = `
                        <div>
                            <input type="file" style="display:none" id="${novoIdComp}" onchange="uploadArquivoFinanceiro(this, '${dados.idpagamento}', 'comprovante', '${idLancamento}', '${dtvcto || ''}')">
                            <i class="fas fa-upload" style="color:#f0ad4e; cursor:pointer;" title="Enviar comprovante" onclick="document.getElementById('${novoIdComp}').click()"></i>
                        </div>`;
                }
            }
        } else {
            Swal.fire('Erro ao Processar', (dados ? dados.erro : 'Erro interno.'), 'error');
        }
    } catch (err) {
        console.error("Erro:", err);
        Swal.fire('Erro de Conexão', 'Não foi possível comunicar com o servidor.', 'error');
    }
}

function verificarSeAccordionVazio(container) {
    // Se o container não tiver mais filhos (itens), mostra mensagem de vazio
    if (container && container.querySelectorAll('.linha-vencimento').length === 0) {
        container.innerHTML = `
            <div style="padding: 20px; text-align: center; color: var(--text-2); font-style: italic;">
                <i class="fas fa-check-circle" style="color: #28a745; margin-bottom: 8px; display: block; font-size: 1.5em;"></i>
                Nenhum pagamento pendente neste grupo.
            </div>`;
    }
}


// async function suspenderConta(idLancamento, idPagamento, dataVcto, obsAntiga) {
//     // 1. Abre o Swal apenas com a Textarea
//     const { value: novaObservacao } = await Swal.fire({
//         title: 'Suspender Lançamento',
//         text: "Informe o motivo da suspensão:",
//         input: 'textarea',
//         inputValue: obsAntiga, 
//         inputPlaceholder: 'Digite a observação aqui...',
//         icon: 'warning',
//         showCancelButton: true,
//         confirmButtonColor: '#ffc107',
//         confirmButtonText: 'Confirmar Suspensão',
//         cancelButtonText: 'Cancelar',
//         inputValidator: (value) => {
//             if (!value) return 'A observação é obrigatória!';
//         }
//     });

//     if (novaObservacao) {
//         try {
//             // Se o idPagamento for de outro mês (como o 32 que você viu), 
//             // a rota deve ignorá-lo e procurar pelo par (idLancamento + dataVcto)
//             const pgtoIdEnviado = (idPagamento === 'null' || idPagamento === null) ? null : idPagamento;

//             const res = await fetchComToken('/main/confirmar-pagamento-conta', {
//                 method: 'POST',
//                 headers: { 'Content-Type': 'application/json' },
//                 body: JSON.stringify({
//                     idpagamento: pgtoIdEnviado,
//                     idlancamento: idLancamento,
//                     vlrpago: 0,
//                     dtvcto: dataVcto, // Essencial para o Node não errar a parcela
//                     dtpagamento: new Date().toISOString().split('T')[0],
//                     observacao: novaObservacao,
//                     status: 'suspenso'
//                 })
//             });

//             // Log para debug no console do navegador
//             console.log("Resposta da rota:", res);

//             if (res && res.sucesso) {
//                 await Swal.fire('Suspenso!', 'Status alterado para suspenso.', 'success');
//                 location.reload();
//             } else {
//                 // Se res.sucesso for false, mostra o erro que veio do Node
//                 Swal.fire('Erro', res.erro || 'Erro ao processar suspensão', 'error');
//             }
//         } catch (error) {
//             console.error("Erro técnico:", error);
//             Swal.fire('Erro', 'Falha na comunicação com o servidor', 'error');
//         }
//     }

// Marca como Pago um holerite (ex: parcela do 13º) direto da tela de Vencimentos > Contas a
// Pagar > Funcionário — usa o endpoint do RH (PUT /rh/holerite/:id/pagar), não o fluxo de
// pagamento de lançamento (essas linhas não têm lançamento por trás).
async function pagarHoleriteFuncionario(idholerite, btnEl) {
    if (!idholerite) return;
    const conf = await Swal.fire({
        title: 'Confirmar pagamento?',
        text: 'O holerite será marcado como PAGO.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Confirmar',
        cancelButtonText: 'Cancelar'
    });
    if (!conf.isConfirmed) return;

    try {
        const res = await fetchComToken(`/rh/holerite/${idholerite}/pagar`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pago: true })
        });
        if (res && res.ok) {
            Swal.fire({ icon: 'success', title: 'Pago!', timer: 1200, showConfirmButton: false, position: 'top-end', toast: true });

            // Atualiza a linha no lugar (sem recarregar a página — perderia o scroll, o
            // acordeão aberto e o modo tela cheia). Mesmo padrão do fluxo normal de pagamento
            // de contas (ver enviarBaixaPagamento).
            const linha = btnEl ? btnEl.closest('tr') : null;
            if (linha) {
                const acoesDiv = btnEl.parentElement;
                if (acoesDiv) {
                    btnEl.outerHTML = '<i class="fas fa-lock"></i>';
                }
                const pilulaStatus = linha.querySelector('.status-pilula');
                if (pilulaStatus) {
                    pilulaStatus.className = 'status-pilula status-pago';
                    pilulaStatus.textContent = 'PAGO';
                }
                const celulaData = linha.querySelector('.celula-data-pagamento');
                if (celulaData) {
                    celulaData.textContent = (res.dtpagamento ? String(res.dtpagamento).substring(0, 10) : new Date().toISOString().substring(0, 10)).split('-').reverse().join('/');
                }
                // Libera o upload de comprovante agora que foi pago — o "Imprimir (2 vias)" só
                // libera depois de anexar o comprovante (ver uploadComprovanteHolerite).
                const celulaComp = linha.querySelector('.celula-comprovante-holerite');
                if (celulaComp) {
                    celulaComp.innerHTML = `<div>
                        <input type="file" style="display:none" id="up_comp_hol_${idholerite}" onchange="uploadComprovanteHolerite(this, ${idholerite})">
                        <i class="fas fa-upload" style="color:#f0ad4e; cursor:pointer;" title="Enviar comprovante" onclick="document.getElementById('up_comp_hol_${idholerite}').click()"></i>
                    </div>`;
                }
                linha.style.transition = 'background-color 0.5s ease';
                linha.style.backgroundColor = '#f0fff4';
            }
        } else {
            Swal.fire('Erro', (res && res.error) || 'Não foi possível confirmar o pagamento.', 'error');
        }
    } catch (err) {
        Swal.fire('Erro', 'Não foi possível confirmar o pagamento.', 'error');
    }
}

// Envia o comprovante de pagamento de um holerite (Salário/13º) direto da tela de Vencimentos
// > Contas a Pagar > Funcionário — só aparece depois de pago (ver celulaComprovante).
async function uploadComprovanteHolerite(inputEl, idholerite) {
    const arquivo = inputEl.files[0];
    if (!arquivo) return;

    // Captura a linha ANTES de mexer no innerHTML — depois disso inputEl fica desanexado do
    // DOM (innerHTML destrói os filhos antigos), e inputEl.closest('tr') pararia de funcionar.
    const linha = inputEl.closest('tr');
    const container = inputEl.parentElement;
    const htmlOriginal = container.innerHTML;
    container.innerHTML = `<i class="fas fa-circle-notch fa-spin" style="color:#007bff; font-size:18px;"></i>`;

    const formData = new FormData();
    formData.append('comprovante', arquivo);

    try {
        const res = await fetchComToken(`/rh/holerite/${idholerite}/comprovante`, {
            method: 'POST',
            body: formData,
        });
        if (res && res.ok) {
            container.innerHTML = `<a href="javascript:void(0)"
                onclick="abrirComprovanteSwal(encodeURIComponent('${res.url}'))"
                style="text-decoration: none; color: var(--status-ok-fg, #2E8B57); display: flex; flex-direction: column; align-items: center; gap: 2px;">
                <i class="fas fa-receipt" style="font-size: 18px;"></i>
                <span style="font-size: 10px; font-weight: bold;">Ver Comp.</span>
            </a>`;
            Swal.fire({ icon: 'success', title: 'Comprovante anexado', timer: 1200, showConfirmButton: false, position: 'top-end', toast: true });

            // Libera o "Imprimir (2 vias)" agora que já tem comprovante pra juntar na impressão.
            const celulaHol = linha ? linha.querySelector('.celula-holerite-imprimir') : null;
            if (celulaHol) {
                celulaHol.innerHTML = `<a href="javascript:void(0)"
                    onclick="imprimirHoleriteRH(${linha.dataset.printIdfunc}, ${linha.dataset.printMes}, ${linha.dataset.printAno})"
                    style="text-decoration: none; color: var(--status-ok-fg, #2E8B57); display: flex; flex-direction: column; align-items: center; gap: 2px;">
                    <i class="fas fa-print" style="font-size: 18px;"></i>
                    <span style="font-size: 10px; font-weight: bold;">Imprimir (2 vias)</span>
                </a>`;
            }
        } else {
            container.innerHTML = htmlOriginal;
            Swal.fire('Erro', (res && res.error) || 'Não foi possível anexar o comprovante.', 'error');
        }
    } catch (err) {
        container.innerHTML = htmlOriginal;
        Swal.fire('Erro', 'Não foi possível anexar o comprovante.', 'error');
    }
}
window.uploadComprovanteHolerite = uploadComprovanteHolerite;

// Main.js é carregado como <script type="module">, então funções declaradas aqui não ficam
// no escopo global sozinhas — precisam ser expostas em window pra funcionar em onclick inline.
window.pagarHoleriteFuncionario = pagarHoleriteFuncionario;

// Marca como pago o BENEFÍCIO (VA/VT) de uma competência — rota própria (PUT
// /rh/holerite/:id/pagar-beneficios), separada do salário: mesmo idholerite, mas
// status_beneficios/dtpagamento_beneficios são colunas à parte, então não mexe no
// pagamento do salário desse mesmo holerite.
async function pagarBeneficiosFuncionario(idholerite, btnEl) {
    if (!idholerite) return;
    const conf = await Swal.fire({
        title: 'Confirmar pagamento?',
        text: 'O benefício (VA/VT) será marcado como PAGO.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Confirmar',
        cancelButtonText: 'Cancelar'
    });
    if (!conf.isConfirmed) return;

    try {
        const res = await fetchComToken(`/rh/holerite/${idholerite}/pagar-beneficios`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pago: true })
        });
        if (res && res.ok) {
            Swal.fire({ icon: 'success', title: 'Pago!', timer: 1200, showConfirmButton: false, position: 'top-end', toast: true });

            const linha = btnEl ? btnEl.closest('tr') : null;
            if (linha) {
                btnEl.outerHTML = '<i class="fas fa-lock"></i>';
                const pilulaStatus = linha.querySelector('.status-pilula');
                if (pilulaStatus) {
                    pilulaStatus.className = 'status-pilula status-pago';
                    pilulaStatus.textContent = 'PAGO';
                }
                const celulaData = linha.querySelector('.celula-data-pagamento');
                if (celulaData) {
                    celulaData.textContent = (res.dtpagamento_beneficios ? String(res.dtpagamento_beneficios).substring(0, 10) : new Date().toISOString().substring(0, 10)).split('-').reverse().join('/');
                }
                linha.style.transition = 'background-color 0.5s ease';
                linha.style.backgroundColor = '#f0fff4';
            }
        } else {
            Swal.fire('Erro', (res && res.error) || 'Não foi possível confirmar o pagamento.', 'error');
        }
    } catch (err) {
        Swal.fire('Erro', 'Não foi possível confirmar o pagamento.', 'error');
    }
}
window.pagarBeneficiosFuncionario = pagarBeneficiosFuncionario;
// }

async function suspenderConta(idLancamento, idPagamento, dataVcto, obsAntiga) {
    // 1. Abre o Swal apenas com a Textarea
    const { value: novaObservacao } = await Swal.fire({
        title: 'Suspender Lançamento',
        text: "Informe o motivo da suspensão:",
        input: 'textarea',
        inputValue: obsAntiga, 
        inputPlaceholder: 'Digite a observação aqui...',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ffc107',
        confirmButtonText: 'Confirmar Suspensão',
        cancelButtonText: 'Cancelar',
        reverseButtons: true,
        inputValidator: (value) => {
            if (!value) return 'A observação é obrigatória!';
        }
    });

    if (novaObservacao) {
        try {
            const pgtoIdEnviado = (idPagamento === 'null' || idPagamento === null) ? null : idPagamento;

            const res = await fetchComToken('/main/confirmar-pagamento-conta', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    idpagamento: pgtoIdEnviado,
                    idlancamento: idLancamento,
                    vlrpago: 0,
                    dtvcto: dataVcto, 
                    dtpagamento: new Date().toISOString().split('T')[0],
                    observacao: novaObservacao,
                    status: 'suspenso'
                })
            });

            if (res && res.sucesso) {
                // 2. Feedback rápido (Toast) que não trava a tela
                Swal.fire({
                    icon: 'success',
                    title: 'Lançamento Suspenso!',
                    timer: 1500,
                    showConfirmButton: false,
                    position: 'top-end',
                    toast: true
                });

                // 3. Atualiza o front sem Recarregar
                const container = document.getElementById(`container-acoes-${idLancamento}`);
                const linha = document.getElementById(`linha-pgto-${idLancamento}`);

                if (container) {
                    // Substitui os botões pelo status de suspenso
                    container.innerHTML = `
                        <span style="color: #856404; font-weight: bold; font-size: 0.85rem; background: #fff3cd; padding: 2px 8px; border-radius: 4px; border: 1px solid #ffeeba;">
                            <i class="fas fa-pause-circle"></i> SUSPENSO
                        </span>
                    `;
                    
                    // Aplica um estilo visual na linha para destacar a suspensão
                    if (linha) {
                        linha.style.backgroundColor = '#fffef0'; // Amarelo bem suave
                        linha.style.opacity = '0.7';
                        linha.style.transition = 'all 0.5s ease';
                    }
                }

            } else {
                Swal.fire('Erro', res.erro || 'Erro ao processar suspensão', 'error');
            }
        } catch (error) {
            console.error("Erro técnico:", error);
            Swal.fire('Erro', 'Falha na comunicação com o servidor', 'error');
        }
    }
}

window.suspenderConta = suspenderConta;

async function reverterSuspensao(idLancamento, idPagamento, dataVcto, obsAtual = "") {
    // 1. Swal de Confirmação com campo de texto para observação
    const { value: motivo } = await Swal.fire({
        title: 'Reverter Suspensão?',
        text: "O lançamento voltará para o fluxo de pagamentos pendentes.",
        input: 'textarea',
        inputLabel: 'Justificativa para a reversão:',
        inputPlaceholder: 'Digite o motivo aqui...',
        showCancelButton: true,
        confirmButtonText: 'Sim, Reativar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#28a745',
        inputValidator: (value) => {
            if (!value) {
                return 'Você precisa digitar uma justificativa!';
            }
        }
    });

    if (motivo) {
        try {
            // Prepara a observação agregada (mantém a antiga e pula linha para a nova)
            const novaObservacao = `${obsAtual}\n--- REVERSÃO SUPREMO (${new Date().toLocaleDateString()}): ${motivo}`.trim();

            const res = await fetchComToken('/main/confirmar-pagamento-conta', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    idpagamento: idPagamento,
                    idlancamento: idLancamento,
                    dtvcto: dataVcto,
                    status: 'pendente', // Retorna ao fluxo normal
                    vlrpago: 0,
                    observacao: novaObservacao 
                })
            });

            if (res.sucesso) {
                await Swal.fire('Reativado!', 'O lançamento agora consta como Pendente.', 'success');
                location.reload();
            } else {
                throw new Error(res.mensagem || 'Erro no servidor');
            }
        } catch (e) {
            Swal.fire('Erro', 'Falha ao reverter: ' + e.message, 'error');
        }
    }
}
window.reverterSuspensao = reverterSuspensao;

window.uploadArquivoFinanceiro = async function(input, id, tipoUpload = 'comprovante', idlancamento = '', dtvcto = '') {
    const arquivo = input.files[0];
    if (!arquivo) return;

    // Parcela ainda não gerada (lançamento futuro/recorrente sem pagamento próprio) —
    // sem idPagamento, precisa de idlancamento+dtvcto pro backend criar a parcela
    // (status 'pendente') na hora e aceitar o anexo mesmo sem estar pago ainda.
    const semIdPagamento = !id || id === 'undefined';
    if (semIdPagamento && (!idlancamento || idlancamento === 'undefined' || !dtvcto || dtvcto === 'undefined')) {
        Swal.fire('Erro', 'ID não identificado.', 'error');
        return;
    }

    const container = input.parentElement;
    const tdPai = container.closest('td');
    const linhaInteira = container.closest('tr');
    const htmlOriginal = container.innerHTML;

    // Feedback de carregamento
    container.innerHTML = `<i class="fas fa-circle-notch fa-spin" style="color: var(--primary-color); font-size: 18px;"></i>`;

    const formData = new FormData();
    if (!semIdPagamento) formData.append('idPagamento', id);
    if (idlancamento && idlancamento !== 'undefined') formData.append('idlancamento', idlancamento);
    if (dtvcto && dtvcto !== 'undefined') formData.append('dtvcto', dtvcto);
    formData.append('tipo', tipoUpload); // Aqui enviamos 'comprovante' ou 'imagem'
    formData.append('comprovante', arquivo);

    const contextoNome = tipoUpload === 'imagem' ? 'imagemConta' : 'comprovantePagamento';
    formData.append('contexto', contextoNome);
    

    try {
        const response = await fetch('/main/vencimentoconta/uploads_comprovantesconta', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: formData
        });

        const res = await response.json();

        if (res.success) {
            // Define o ícone baseado no que foi subido
            const icone = tipoUpload === 'imagem' ? 'fa-file-invoice-dollar' : 'fa-receipt';
            const label = tipoUpload === 'imagem' ? 'Ver Conta' : 'Ver Comp.';
            
            tdPai.innerHTML = `
                <a href="${res.path}" target="_blank" style="text-decoration: none; color: var(--status-ok-fg, #2E8B57); display: flex; flex-direction: column; align-items: center; gap: 2px;">
                    <i class="fas ${icone}" style="font-size: 18px;"></i>
                    <span style="font-size: 10px; font-weight: bold;">${label}</span>
                </a>`;

            if (linhaInteira) {
                linhaInteira.classList.add('linha-flash-sucesso');
                setTimeout(() => linhaInteira.classList.remove('linha-flash-sucesso'), 2000);
            }
        } else {
            Swal.fire('Erro', res.error || res.message || 'Não foi possível enviar o arquivo.', 'error');
            container.innerHTML = htmlOriginal;
        }
    } catch (err) {
        console.error("Erro:", err);
        Swal.fire('Erro', 'Falha ao comunicar com o servidor.', 'error');
        container.innerHTML = htmlOriginal;
    }
};


function formatarDataParaExibir(dataRaw) {
    if (!dataRaw) return '---';

    try {
        // Se vier como string ISO
        if (typeof dataRaw === 'string') {
            // Remove milissegundos
            dataRaw = dataRaw.trim();

            // Converte direto
            const d = new Date(dataRaw);
            if (!isNaN(d.getTime())) {
                const dia = String(d.getUTCDate()).padStart(2, '0');
                const mes = String(d.getUTCMonth() + 1).padStart(2, '0');
                const ano = d.getUTCFullYear();
                return `${dia}/${mes}/${ano}`;
            }

            // Fallback manual
            if (dataRaw.includes('-')) {
                const partes = dataRaw.split('T')[0].split('-');
                return `${partes[2]}/${partes[1]}/${partes[0]}`;
            }
        }

        // Se vier como Date
        if (dataRaw instanceof Date) {
            const dia = String(dataRaw.getUTCDate()).padStart(2, '0');
            const mes = String(dataRaw.getUTCMonth() + 1).padStart(2, '0');
            const ano = dataRaw.getUTCFullYear();
            return `${dia}/${mes}/${ano}`;
        }

        return '---';
    } catch (e) {
        return '---';
    }
}


// Compara só a data (ano/mês/dia), ignorando a hora — dProj/vctoBase costumam ser construídos
// com hora=12 (pra evitar problema de fuso horário virando o dia), então nunca dá pra comparar
// getTime() direto contra um "hoje" que normalmente está com hora=0.
function ehMesmoDia(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

// Expande um lançamento (FIXO/PARCELADO/ÚNICO) nas datas de vencimento projetadas DENTRO de um
// ano específico — ÚNICA implementação desse cálculo no arquivo. Reaproveitada pela montagem de
// contasProjetadas (a lista detalhada da tela) e por carregarDadosVencimentos (card lateral
// "Financeiro"), que antes tinha a própria versão com dois bugs: ignorava lançamentos
// PARCELADO por completo, e pra FIXO expandia a partir do ano do vctobase original em vez do
// ano filtrado direto — um lançamento com mais de ~11 meses nunca alcançava anos futuros.
function expandirOcorrenciasNoAno(c, anoFiltro) {
    const dataOriginalStr = c.vctobase || c.dtvcto;
    const vctoBase = (typeof converterData === 'function') ? converterData(dataOriginalStr) : new Date(dataOriginalStr);
    if (!vctoBase || isNaN(vctoBase)) return [];

    const ehFixo = (c.tiporepeticao === "FIXO" || c.indeterminado === true);
    const ehParcelado = (c.tiporepeticao === "PARCELADO");
    const maxLoop = ehParcelado ? (parseInt(c.qtdeparcelas) || 1) : (ehFixo ? 12 : 1);

    const ocorrencias = [];
    for (let i = 0; i < maxLoop; i++) {
        let dProj;
        if (ehFixo) {
            // Indeterminado/FIXO: projeta direto nos 12 meses do ANO FILTRADO, não a partir do
            // ano do vctobase original — senão um lançamento antigo nunca alcança anos futuros.
            dProj = new Date(anoFiltro, i, vctoBase.getDate(), 12, 0, 0);
            if (dProj < vctoBase) continue; // não mostra competência anterior ao início do lançamento
        } else {
            dProj = new Date(vctoBase.getFullYear(), vctoBase.getMonth() + i, vctoBase.getDate(), 12, 0, 0);
        }

        if (dProj.getFullYear() !== anoFiltro) {
            if (dProj.getFullYear() > anoFiltro) break;
            continue;
        }
        ocorrencias.push(dProj);
    }
    return ocorrencias;
}

function atualizarResumoGeralEstatico(eventosVisiveis = [], contasVisiveis = [], element, fgtsEstimado = 0) {
    if (!element) return;

    // 1. Pegamos as referências do filtro de tela
    const filtroTipo = document.querySelector('input[name="periodo"]:checked')?.value || 'diario';
    const inputDataStr = document.querySelector("#sub-filtro-data")?.value;
    
    // Data de referência (Hoje) para saber o que é ATRASADO (Vencido)
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);    

    // Data limite do que o usuário está vendo na tela agora
    let dataLimiteExibicao = new Date(hoje); 
    if (inputDataStr) {
        const [ano, mes, dia] = inputDataStr.split("-").map(Number);
        dataLimiteExibicao = new Date(ano, mes - 1, dia, 0, 0, 0);
    }

    let sVenc = 0, sAVenc = 0, sPago = 0, sSusp = 0, sHoje = 0, sAguardando = 0;
    let cVenc = 0, cAVenc = 0, cPago = 0, cSusp = 0, cHoje = 0;
    let totAditivos = 0;

    // --- PROCESSAR EVENTOS (STAFF) ---
    eventosVisiveis.forEach(ev => {
        // PAGO: Soma sempre se o evento está visível
        sPago += (parseFloat(ev.ajuda?.pago || 0) + parseFloat(ev.cache?.pago || 0) + parseFloat(ev.caixinha?.pago || 0));
        // Suspenso é campo à parte de "pendente" — antes não entrava em nenhum bucket aqui.
        sSusp += (parseFloat(ev.ajuda?.suspenso || 0) + parseFloat(ev.cache?.suspenso || 0) + parseFloat(ev.caixinha?.suspenso || 0));

        // Evento sem funcionários cadastrados fica na aba "Aguardando Staff" (mesma regra usada
        // na montagem do acordeão) — o pendente dele não é vencido/hoje/a vencer pra quem
        // filtra a tela, então não pode entrar nesses buckets aqui também, senão o card do
        // topo soma dinheiro que nenhuma aba mostra.
        const temFuncionariosEv = ev.funcionarios && ev.funcionarios.length > 0;
        if (!temFuncionariosEv) {
            sAguardando += (parseFloat(ev.ajuda?.pendente) || 0) + (parseFloat(ev.cache?.pendente) || 0) + (parseFloat(ev.caixinha?.pendente) || 0);
            return;
        }

        const classificarStaff = (dataStr, valor) => {
            if (!dataStr || dataStr === '---' || valor <= 0) return;
            const [d, m, a] = dataStr.split('/').map(Number);
            const dVcto = new Date(a, m - 1, d, 0, 0, 0);

            // FILTRO DIÁRIO: Se a data de vencimento for maior que a data selecionada, IGNORA no resumo
            if (filtroTipo === 'diario' && dVcto > dataLimiteExibicao) return;

            if (ehMesmoDia(dVcto, hoje)) {
                sHoje += valor;
            } else if (dVcto < hoje) {
                sVenc += valor;
            } else {
                sAVenc += valor;
            }
        };

        classificarStaff(ev.dataVencimentoAjuda, parseFloat(ev.ajuda?.pendente) || 0);
        classificarStaff(ev.dataVencimentoCache, parseFloat(ev.cache?.pendente) || 0);

        // Caixinha: antes ia direto pra "a vencer" sem olhar data nem o filtro diário —
        // agora usa a própria data de vencimento (mesma regra de Ajuda/Cachê acima).
        const cxPendenteEv = parseFloat(ev.caixinha?.pendente) || 0;
        if (ev.dataVencimentoCaixinha && ev.dataVencimentoCaixinha !== '---') {
            classificarStaff(ev.dataVencimentoCaixinha, cxPendenteEv);
        } else if (filtroTipo !== 'diario') {
            sAVenc += cxPendenteEv;
        }

        // Aditivos
        const tit = (ev.titulo || "").toLowerCase();
        if (tit.includes("aditivo") || tit.includes("extra bonificado")) {
            totAditivos += (parseFloat(ev.ajuda?.pendente || 0) + parseFloat(ev.cache?.pendente || 0) + (parseFloat(ev.ajuda?.pago || 0) + parseFloat(ev.cache?.pago || 0)));
        }
    });

    // --- PROCESSAR CONTAS ---
    contasVisiveis.forEach(c => {
        // Funcionário (salário/13º) usa valorTotal/valorPago, não vlrestimado/vlrreal/vlrpago
        // (esses são só dos lançamentos normais) — sem isso o custo do funcionário some do
        // resumo (soma 0) mesmo com o holerite certo e pago.
        const vBase = parseFloat(c.vlrreal || c.valor || c.vlrestimado || c.valorTotal || 0);

        // Confia em c.statusFiltro — já vem pronto ('liquidado'|'suspenso'|'vencidos'|
        // 'a_vencer'), calculado UMA VEZ só na montagem de contasProjetadas (mesmo campo que o
        // resumo do acordeão "Contas a Pagar" usa). Antes esta função recalculava vencido/a
        // vencer do zero a partir da data crua, e o "hoje" desse recálculo podia não bater
        // exatamente com o "hoje" usado lá na montagem — daí os dois números divergirem.
        if (c.statusFiltro === 'liquidado') {
            cPago += parseFloat(c.vlrpago || c.valorPago || vBase);
            return;
        }
        if (c.statusFiltro === 'suspenso') {
            // Suspensa é um terceiro estado, nem vencida nem a vencer — mas continua sendo
            // dinheiro de verdade (pode voltar a ficar ativa a qualquer momento), por isso tem
            // card próprio (ver Suspenso Geral) em vez de simplesmente desaparecer da conta.
            cSusp += vBase;
            return;
        }

        // FILTRO DIÁRIO: isso aqui é só "esse item cabe no dia selecionado na tela?" —
        // diferente de vencido/a vencer (que já vem pronto acima), por isso continua
        // comparando contra a data ESCOLHIDA na tela, não o "hoje" real.
        if (filtroTipo === 'diario') {
            const dStr = (c.dtvcto || c.vctobase || "").substring(0, 10);
            if (!dStr) return;
            const [ano, mes, dia] = dStr.split('-').map(Number);
            const dVcto = new Date(ano, mes - 1, dia, 0, 0, 0);
            if (dVcto > dataLimiteExibicao) return;
        }

        if (c.statusFiltro === 'vencidos') cVenc += vBase;
        else if (c.statusFiltro === 'hoje') cHoje += vBase;
        else cAVenc += vBase;
    });

    // --- ALERTA DE VENCIMENTO (Hoje / Próximos dias) ---
    // Contador dinâmico (não fixo em "5 dias"): pega o vencimento mais próximo dentro da
    // janela de 1 a 5 dias, separado por Staff/Contas, pra saber quem mencionar no aviso.
    let temHojeStaff = false, temHojeContas = false;
    let diasProximoStaff = null, diasProximoContas = null;
    const registrarDiasAlerta = (dVcto, ehStaff) => {
        const dias = Math.round((dVcto.getTime() - hoje.getTime()) / 86400000);
        if (dias === 0) { if (ehStaff) temHojeStaff = true; else temHojeContas = true; return; }
        if (dias > 0 && dias <= 5) {
            if (ehStaff) diasProximoStaff = (diasProximoStaff === null) ? dias : Math.min(diasProximoStaff, dias);
            else diasProximoContas = (diasProximoContas === null) ? dias : Math.min(diasProximoContas, dias);
        }
    };
    eventosVisiveis.forEach(ev => {
        const checarAlertaStaff = (dataStr, valor) => {
            if (!dataStr || dataStr === '---' || valor <= 0) return;
            const [d, m, a] = dataStr.split('/').map(Number);
            registrarDiasAlerta(new Date(a, m - 1, d, 0, 0, 0), true);
        };
        checarAlertaStaff(ev.dataVencimentoAjuda, parseFloat(ev.ajuda?.pendente) || 0);
        checarAlertaStaff(ev.dataVencimentoCache, parseFloat(ev.cache?.pendente) || 0);
    });
    contasVisiveis.forEach(c => {
        // 'hoje' também entra aqui (registrarDiasAlerta calcula dias=0 e marca temHojeContas) —
        // só vencido/pago/suspenso ficam de fora, esses não são "vencimento futuro/hoje".
        if (c.statusFiltro !== 'a_vencer' && c.statusFiltro !== 'hoje') return;
        const dStr = (c.dtvcto || c.vctobase || "").substring(0, 10);
        if (!dStr) return;
        const [ano, mes, dia] = dStr.split('-').map(Number);
        registrarDiasAlerta(new Date(ano, mes - 1, dia, 0, 0, 0), false);
    });

    const fontesHoje = [temHojeStaff && 'Staff', temHojeContas && 'Contas'].filter(Boolean);
    const alertaHojeHtml = fontesHoje.length ? `
        <div class="alerta-vencimento alerta-hoje">⚠️ Temos vencimento${fontesHoje.length > 1 ? 's' : ''} em ${fontesHoje.join(' e ')} Hoje</div>` : '';

    let alertaProximoHtml = '';
    if (diasProximoStaff !== null || diasProximoContas !== null) {
        const menorDias = Math.min(diasProximoStaff ?? Infinity, diasProximoContas ?? Infinity);
        const fontesProximo = [diasProximoStaff === menorDias && 'Staff', diasProximoContas === menorDias && 'Contas'].filter(Boolean);
        alertaProximoHtml = `
        <div class="alerta-vencimento alerta-proximo">⏳ Próximo vencimento em ${menorDias} dia${menorDias > 1 ? 's' : ''} — ${fontesProximo.join(' e ')}</div>`;
    }

    const vGeral = sVenc + cVenc;
    const hGeral = sHoje + cHoje;
    const aVGeral = sAVenc + cAVenc;
    const pGeral = sPago + cPago;

    // Cada cartão é só dado: a aparência (altura, cores, espaçamento) está em
    // .resumo-card no Main.css. `extra` é o espaço livre do meio do cartão —
    // passe HTML aí quando quiser exibir mais informação sem mexer no layout.
    const totalStaff = sVenc + sHoje + sAVenc + sPago + sSusp + sAguardando;
    const totalContas = cVenc + cHoje + cAVenc + cPago + cSusp;

    const cartoesResumo = [
        {
            classe: 'resumo-card--vencido',
            titulo: 'Vencidos Geral (no período)',
            valor: vGeral,
            detalhe: `Staff: ${formatarMoeda(sVenc)} | Contas: ${formatarMoeda(cVenc)}`
        },
        {
            classe: 'resumo-card--hoje',
            titulo: 'Hoje Geral (no período)',
            valor: hGeral,
            detalhe: `Staff: ${formatarMoeda(sHoje)} | Contas: ${formatarMoeda(cHoje)}`
        },
        {
            classe: 'resumo-card--avencer',
            titulo: 'A Vencer Geral (no período)',
            valor: aVGeral,
            detalhe: `Staff: ${formatarMoeda(sAVenc)} | Contas: ${formatarMoeda(cAVenc)}`
        },
        {
            classe: 'resumo-card--pago',
            titulo: 'Pago Geral (no período)',
            valor: pGeral,
            detalhe: `Staff: ${formatarMoeda(sPago)} | Contas: ${formatarMoeda(cPago)}`
        },
        {
            classe: 'resumo-card--suspenso',
            titulo: 'Suspenso (no período)',
            valor: sSusp + cSusp,
            detalhe: `Staff: ${formatarMoeda(sSusp)} | Contas: ${formatarMoeda(cSusp)}`,
            title: 'Nem vencida nem a vencer — pausada até alguém reativar ou resolver.'
        },
        {
            classe: 'resumo-card--total',
            titulo: 'Total Geral',
            valor: vGeral + hGeral + aVGeral + pGeral + (sSusp + cSusp) + sAguardando,
            extra: sAguardando > 0
                ? `<span style="color:var(--text-2);" title="Evento de Staff ainda sem funcionários cadastrados">Aguardando Staff: ${formatarMoeda(sAguardando)}</span>`
                : '',
            detalhe: `Staff: ${formatarMoeda(totalStaff)} | Contas: ${formatarMoeda(totalContas)}`
        },
        {
            classe: 'resumo-card--fgts',
            titulo: 'FGTS Estimado (no período)',
            valor: fgtsEstimado,
            detalhe: 'Confira contra a guia (GRF) ao lançar em Contas',
            title: '8% sobre o bruto (salário + proventos tributáveis) dos funcionários no período — não é um lançamento, é só o valor esperado pra conferir contra a guia (GRF) quando ela chegar.'
        }
    ];

    const htmlCartoes = cartoesResumo.map(cartao => `
                <div class="resumo-card ${cartao.classe}"${cartao.title ? ` title="${cartao.title}"` : ''}>
                    <h4 class="resumo-card-titulo">${cartao.titulo}</h4>
                    <div class="resumo-card-valor">${formatarMoeda(cartao.valor)}</div>
                    <div class="resumo-card-extra">${cartao.extra || ''}</div>
                    <div class="resumo-card-detalhe">${cartao.detalhe}</div>
                </div>`).join('');

    element.innerHTML = `
        <div class="resumo-detalhado">
            <div class="resumo-cards">${htmlCartoes}
            </div>
            ${alertaHojeHtml}
            ${alertaProximoHtml}
        </div>`;

    if (!document.getElementById('estilo-alerta-vencimento')) {
        const estilo = document.createElement('style');
        estilo.id = 'estilo-alerta-vencimento';
        estilo.textContent = `
            @keyframes piscar-alerta-vencimento { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
            .alerta-vencimento {
                margin-top: 10px; padding: 10px 16px; border-radius: 8px; font-weight: bold;
                text-align: center; animation: piscar-alerta-vencimento 1.2s ease-in-out infinite;
            }
            .alerta-vencimento.alerta-hoje { background: #fff8e6; color: #b45f06; border: 2px solid #f0ad4e; }
            .alerta-vencimento.alerta-proximo { background: #e8f7f9; color: #0f6674; border: 2px solid #17a2b8; }
            @media (prefers-reduced-motion: reduce) {
                .alerta-vencimento { animation: none; }
            }
        `;
        document.head.appendChild(estilo);
    }
}

function exibirToastSucesso(mensagem = 'Status atualizado!') {
    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 5000,
        timerProgressBar: true
    });
    Toast.fire({ icon: 'success', title: mensagem });
}

async function alterarStatusStaff(idStaff, tipo, novoStatus, elementoBotao, idEventoContexto = null, iditemCaixinha = null) {
    const btnClicado = elementoBotao;
    const linhaTr = btnClicado ? btnClicado.closest('tr') : null;
    let statusParaEnviar = novoStatus;

    if ((tipo === 'Ajuda' || tipo === 'Cache') && novoStatus === 'Pago') {
        const { value: opcao } = await Swal.fire({
            title: tipo === 'Ajuda' ? 'Pagamento Ajuda de Custo' : 'Pagamento de Cachê',
            text: 'Escolha a modalidade do pagamento:',
            icon: 'question',
            showDenyButton: true,
            showCancelButton: true,
            confirmButtonText: 'Pago 100%',
            denyButtonText: 'Pago 50%',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#28a745',
            denyButtonColor: '#17a2b8',
        });

        if (opcao === true) statusParaEnviar = 'Pago 100%';
        else if (Swal.getDenyButton() && opcao === false) statusParaEnviar = 'Pago 50%';
        else return;
    }

    try {
        btnClicado.disabled = true;
        const htmlOriginal = btnClicado.innerHTML;
        btnClicado.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        const enviarUpdate = (confirmarDiferenca = false) => fetch(`/main/vencimentos/update-status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ idStaff, tipo, novoStatus: statusParaEnviar, idEventoContexto, confirmarDiferenca, iditem: iditemCaixinha })
        });

        let response = await enviarUpdate();
        let ajusteDiferencaGerado = false;

        // Débito sem saldo a receber pendente suficiente pra cobrir: backend devolve 409 com a
        // diferença, em vez de fechar o débito sem deixar rastro do que faltou compensar.
        if (response.status === 409) {
            const diferencaInfo = await response.json();
            if (!diferencaInfo.diferencaDetectada) {
                throw new Error('Erro no servidor');
            }

            const confirmacao = await Swal.fire({
                title: 'Diferença de valor detectada',
                html: `Você está pagando um <strong>Débito de ${formatarMoeda(diferencaInfo.valorDebito)}</strong>.<br>
                       O total destinado a este funcionário neste evento (Cachê + Ajuda de Custo + Caixinha + Créditos, pagos ou não) é de
                       <strong>${formatarMoeda(diferencaInfo.saldo)}</strong>.<br><br>
                       Se continuar, este Débito será marcado como Pago e um novo <strong>Débito de ${formatarMoeda(diferencaInfo.diferenca)}</strong>
                       será gerado automaticamente para registrar a diferença.`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Gerar Ajuste e Pagar',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#dc2626',
                cancelButtonColor: '#6c757d',
                reverseButtons: true
            });

            if (!confirmacao.isConfirmed) {
                btnClicado.disabled = false;
                btnClicado.innerHTML = htmlOriginal;
                return;
            }

            response = await enviarUpdate(true);
        }

        if (response.ok) {
            const resultado = await response.json().catch(() => ({}));
            ajusteDiferencaGerado = !!resultado.ajusteDiferencaGerado;
            exibirToastSucesso(
                ajusteDiferencaGerado
                    ? `Status atualizado — novo Débito de diferença gerado`
                    : `Status atualizado para ${statusParaEnviar}`
            );

            // Atualização na memória global
            if (typeof dados !== 'undefined' && Array.isArray(dados)) {
                dados.forEach(ev => {
                    const func = ev.funcionarios.find(f => f.idstaffevento === idStaff);
                    if (func) {
                        if (tipo === 'Cache') func.statuspgto = statusParaEnviar;
                        else if (tipo === 'Ajuda') func.statuspgtoajdcto = statusParaEnviar;
                        else if (tipo === 'Caixinha') {
                            // Pagamento por item — atualiza só o item específico, não o registro inteiro.
                            const itemCx = (func.itens_caixinha || []).find(it => it.iditem === iditemCaixinha);
                            if (itemCx) itemCx.statuspgto = statusParaEnviar;
                        }
                    }
                    if (tipo === 'AjusteFin') {
                        ev.funcionarios.forEach(f => {
                            const ajuste = (f.ajustes_financeiros || []).find(a => a.idajustefinanceiro === idStaff);
                            if (ajuste) ajuste.status = statusParaEnviar;
                        });
                    }
                });
            }

            if (linhaTr) {
                const celulaStatus = linhaTr.querySelector('.status-celula');
                const celulaAcoes = linhaTr.querySelector('.btn-group-acoes')?.parentElement;
                const celulaComprovantes = linhaTr.querySelector('.comprovantes-cell');
                const celulaValor = linhaTr.querySelector('.valor-celula');

                // 1. Atualiza Status
                if (celulaStatus) {                    
                    const classeStatus = statusParaEnviar.toLowerCase().replace(/\s+/g, '-').replace('%', '');
                    celulaStatus.className = `status-celula status-${classeStatus}`;
                    celulaStatus.innerText = statusParaEnviar;
                }

                // 2. Atualiza Botões
                if (celulaAcoes) {
                    celulaAcoes.innerHTML = renderConteudoAcao(idStaff, tipo, statusParaEnviar, null, iditemCaixinha);
                }

                // 3. Atualiza Comprovantes
                if (celulaComprovantes) {
                    const filtroParaDinamico = (tipo === 'Ajuda') ? 'ajuda_custo' : tipo.toLowerCase();
                    const conteudoAtual = celulaComprovantes.innerHTML;

                    celulaComprovantes.innerHTML = gerarHTMLComprovanteDinamico(
                        idStaff, 
                        filtroParaDinamico, 
                        statusParaEnviar, 
                        conteudoAtual
                    );
                }

                // 4. Aplica/Remove Riscado no Valor
                if (celulaValor) {
                    if (statusParaEnviar === 'Rejeitado' || statusParaEnviar === 'Recusado') {
                        celulaValor.classList.add('valor-rejeitado');
                    } else {
                        celulaValor.classList.remove('valor-rejeitado');
                    }
                }
            }
            
            await atualizarCardsResumoSilencioso();

        } else {
            // Caso o response não seja OK (404, 500, etc)
            throw new Error('Erro no servidor');
        }

    } catch (error) {
        console.error(error);
        if (btnClicado) {
            btnClicado.disabled = false;
            btnClicado.innerHTML = '<i class="fas fa-check"></i> Pago';
        }
        Swal.fire('Erro', 'Não foi possível atualizar o status.', 'error');
    }
}
window.alterarStatusStaff = alterarStatusStaff;

// async function alterarStatusStaff(idStaff, tipo, novoStatus, elementoBotao) {
//     const btnClicado = elementoBotao;
//     const linhaTr = btnClicado ? btnClicado.closest('tr') : null;
//     let statusParaEnviar = novoStatus;

//     if (tipo === 'Ajuda' && novoStatus === 'Pago') {
//         const { value: opcao } = await Swal.fire({
//             title: 'Pagamento Ajuda de Custo',
//             text: 'Escolha a modalidade do pagamento:',
//             icon: 'question',
//             showDenyButton: true,
//             showCancelButton: true,
//             confirmButtonText: 'Pago 100%',
//             denyButtonText: 'Pago 50%',
//             cancelButtonText: 'Cancelar',
//             confirmButtonColor: '#28a745',
//             denyButtonColor: '#17a2b8',
//         });

//         if (opcao === true) statusParaEnviar = 'Pago 100%';
//         else if (Swal.getDenyButton() && opcao === false) statusParaEnviar = 'Pago 50%';
//         else return;
//     }


//     try {
//         btnClicado.disabled = true;
//         const htmlOriginal = btnClicado.innerHTML;
//         btnClicado.innerHTML = '';

//         const response = await fetch(`/main/vencimentos/update-status`, {
//             method: 'POST',
//             headers: { 
//                 'Content-Type': 'application/json',
//                 'Authorization': `Bearer ${localStorage.getItem('token')}` 
//             },
//             body: JSON.stringify({ idStaff, tipo, novoStatus: statusParaEnviar })
//         });

//         if (response.ok) {
//             exibirToastSucesso(`Status atualizado para ${statusParaEnviar}`);

//             if (linhaTr) {
//                 const celulaStatus = linhaTr.querySelector('.status-celula');
//                 const celulaAcoes = linhaTr.querySelector('.acoes-supremo');
//                 const celulaComprovantes = linhaTr.querySelector('.comprovantes-cell');

//                 // 1. Atualiza Cor e Texto do Status
//                 if (celulaStatus) {                    
//                     const classeStatus = statusParaEnviar.toLowerCase().replace(/\s+/g, '-').replace('%', '');
//                     celulaStatus.className = `status-celula status-${classeStatus}`;
//                     celulaStatus.innerText = statusParaEnviar;
             
//                 }

//                 // 2. Atualiza Botões de Ação (Pago/Suspenso/Lock)
//                 if (celulaAcoes) {
//                     celulaAcoes.innerHTML = renderConteudoAcao(idStaff, tipo, statusParaEnviar);
//                 }

//                 // 3. ATUALIZAÇÃO CHAVE: Libera os inputs de upload na hora
//                 if (celulaComprovantes) {
//                     // 1. Define o filtro correto
//                     const filtroParaDinamico = (tipo === 'Ajuda') ? 'ajuda_custo' : tipo.toLowerCase();
                    
//                     // 2. Pega o HTML atual, tratando se vier nulo do banco/front
//                     const conteudoAtual = celulaComprovantes.innerHTML;

//                     // 3. Atualiza a célula (Aqui estava o erro do filtroFormatado)
//                     celulaComprovantes.innerHTML = gerarHTMLComprovanteDinamico(
//                         idStaff, 
//                         filtroParaDinamico, 
//                         statusParaEnviar, 
//                         conteudoAtual
//                     );
//                 }
//             }
//             await atualizarCardsResumoSilencioso();
//         } else {
//             throw new Error('Erro no servidor');
//         }
//     } catch (error) {
//         btnClicado.disabled = false;
//         btnClicado.innerHTML = '<i class="fas fa-check"></i> Pago';
//         Swal.fire('Erro', 'Não foi possível atualizar o status.', 'error');
//     }
// }


// window.alterarStatusStaff = alterarStatusStaff;

async function atualizarCardsResumoSilencioso() {
    try {
        const filtroAno = document.getElementById('filtroAnoVencimentos')?.value || 2026;
        // Busca os dados atualizados do backend
        const response = await fetch(`/main/vencimentos?periodo=anual&ano=${filtroAno}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const dados = await response.json();

        // Função auxiliar para formatar moeda e atualizar o elemento
        const atualizarValor = (seletor, valor) => {
            const el = document.querySelector(seletor);
            if (el) el.innerText = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
        };

        // --- ATUALIZA OS CARDS DO TOPO (Segundo Print) ---
        // Ajuste os seletores conforme as classes/IDs reais do seu HTML
        atualizarValor('.card-ajuda .pendente', dados.totalAjudaPendente);
        atualizarValor('.card-ajuda .pago', dados.totalAjudaPago);
        
        atualizarValor('.card-cache .pendente', dados.totalCachePendente);
        atualizarValor('.card-cache .pago', dados.totalCachePago);

        atualizarValor('.card-caixinha .valor-total', dados.saldoCaixinha);

        // Se houver aquele resumo de "A Pagar (Total)" vermelho e verde do topo:
        atualizarValor('.total-geral-pendente', dados.totalGeralPendente);
        atualizarValor('.total-geral-pago', dados.totalGeralPago);

    } catch (error) {
        console.error("Erro ao sincronizar resumos:", error);
    }
}


function renderConteudoAcao(id, tipo, statusAtual, idEventoContexto = null, iditemCaixinha = null) {
    const statusLimpo = (statusAtual || "").trim();
    // idEventoContexto: só usado por AjusteFin (crédito/débito), pra registrar em qual
    // evento o pagamento foi de fato confirmado (idstaffeventopago no backend).
    // iditemCaixinha: só usado por Caixinha — pagamento agora é por item do array, não mais
    // uma flag única do registro, então o botão precisa saber QUAL item está decidindo.
    // Se vier iditemCaixinha sem idEventoContexto, ainda precisa do 'null' na posição pra
    // não desalinhar os argumentos posicionais de alterarStatusStaff.
    const argEventoContexto = idEventoContexto != null ? `, ${idEventoContexto}` : (iditemCaixinha ? ', null' : '');
    // iditemCaixinha é string (vem do backend); usamos aspas simples porque o
    // atributo onclick="..." é delimitado por aspas duplas — JSON.stringify geraria
    // aspas duplas literais no meio do atributo e quebraria o HTML.
    const argIditem = iditemCaixinha ? `, '${String(iditemCaixinha).replace(/'/g, "\\'")}'` : '';

    // 1. Caso Comum: Já está Pago ou Finalizado
    if (statusLimpo === 'Pago' || statusLimpo === 'Pago 100%'|| statusLimpo === 'Rejeitado') {
        return `<div class="btn-group-acoes"><span class="check-finalizado"><i class="fas fa-lock"></i></span></div>`;
    }

    // 2. Lógica Específica para CONTAS FIXAS
    if (tipo === 'ContaFixa') {
        return `
            <div class="btn-group-acoes">
                <button class="btn-pago" onclick="confirmarPagamentoContaFixa(${id})">
                    <i class="fas fa-check"></i> Pagar Conta
                </button>
            </div>`;
    }

    // 3. Lógica Específica para STAFF (Cachê, Ajuda, Caixinha)
    // Se estiver 50%, mostra botão para completar o resto
    if (statusLimpo === 'Pago 50%') {
        return `
            <div class="btn-group-acoes">
                <button class="btn-complementar" title="Pagar os 50% restantes" 
                    onclick="alterarStatusStaff(${id}, '${tipo}', 'Pago 100%', this)">
                    <i class="fas fa-plus-circle"></i> +50%
                </button>
            </div>`;
    }

    if (statusLimpo === 'Suspenso') {
        return `
            <div class="btn-group-acoes">
                <button class="btn-reverter" title="Reverter para Pendente"
                    onclick="alterarStatusStaff(${id}, '${tipo}', 'Pendente', this${argEventoContexto}${argIditem})">
                    <i class="fas fa-undo"></i> Reativar
                </button>
            </div>`;
    }

    // Pendente / Suspenso para Staff
    return `
        <div class="btn-group-acoes">
            <button class="btn-pago" onclick="alterarStatusStaff(${id}, '${tipo}', 'Pago', this${argEventoContexto}${argIditem})">
                <i class="fas fa-check"></i> Pago
            </button>
            <button class="btn-suspenso" onclick="alterarStatusStaff(${id}, '${tipo}', 'Suspenso', this${argEventoContexto}${argIditem})">
                <i class="fas fa-pause"></i> Susp.
            </button>
            <button class="btn-rejeitado" onclick="alterarStatusStaff(${id}, '${tipo}', 'Rejeitado', this${argEventoContexto}${argIditem})">
                <i class="fas fa-xmark"></i> Rejeitar
            </button>
        </div>`;
}


window.abrirComprovantesStaff = abrirComprovantesStaff;
window.handleFileUpload = handleFileUpload;


function construirParametrosFiltro() {
    const tipoOriginal = document.querySelector("input[name='periodo']:checked")?.value || 'diario';
    const anoAtual = new Date().getFullYear(); 
    
    // Captura o mês do select (Ex: Março = 3)
    const seletorMes = document.querySelector("#sub-filtro-select");
    const mesSelecionado = seletorMes ? seletorMes.value : (new Date().getMonth() + 1);

    let params = `?periodo=${tipoOriginal}`;

    // 1. Regra para DIÁRIO / SEMANAL (Busca o mês todo para pegar vencidos)
    if (tipoOriginal === "diario" || tipoOriginal === "semanal") {
        const dataInput = document.querySelector("#sub-filtro-data")?.value;
        const mesParaBackend = dataInput ? new Date(dataInput + "T12:00:00").getMonth() + 1 : mesSelecionado;
        params = `?periodo=mensal&mes=${mesParaBackend}&ano=${anoAtual}`;
    } 
    // 2. Regra para MENSAL (Crucial para Março aparecer!)
    else if (tipoOriginal === "mensal") {
        params = `?periodo=mensal&mes=${mesSelecionado}&ano=${anoAtual}`;
    }
    // 3. Regra para TRIMESTRAL
    else if (tipoOriginal === "trimestral" || tipoOriginal === "trimestre") {
        // Se você tiver rádio de trimestre (T1, T2...), ele usa. 
        // Se não, calcula o trimestre baseado no mês do select
        const triRadio = document.querySelector("input[name='sub']:checked")?.value;
        const triCalculado = triRadio || Math.ceil(mesSelecionado / 3);
        params = `?periodo=trimestral&trimestre=${triCalculado}&ano=${anoAtual}`;
    }
    else if (tipoOriginal === "anual") {
        params = `?periodo=anual&ano=${anoAtual}`;
    }
    
    return params;
}


window.carregarDadosDoFiltro = function() {
    const select = document.getElementById('selectAno');
    if (select) {
        // console.log("Filtrando para o ano:", select.value);
        // carregarDadosVencimentos(parseInt(select.value, 10));

        const ano = parseInt(select.value, 10);
        console.log("🔄 Filtrando Financeiro Geral para o ano:", ano);
        
        // Esta função agora é a "Cérebro" que dispara o Promise.all interno
        carregarDadosVencimentos(ano);
    }
};

function configurarSelectAno() {
    const select = document.getElementById('selectAno');
    if (!select) return;

    const anoAtual = new Date().getFullYear();
    const anosParaExibir = [anoAtual - 1, anoAtual, anoAtual + 1]; // Ex: 2024, 2025, 2026

    // Limpa opções existentes
    select.innerHTML = '';

    anosParaExibir.forEach(ano => {
        const option = document.createElement('option');
        option.value = ano;
        option.textContent = ano;
        
        // Define o ano vigente como selecionado
        if (ano === anoAtual) {
            option.selected = true;
        }
        
        select.appendChild(option);
    });

    // Após configurar, carrega os dados do ano atual pela primeira vez
    //carregarDadosVencimentos(anoAtual);
    window.carregarDadosDoFiltro();
}

// Chame esta função quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    configurarSelectAno();
    // outras inicializações...
});


async function carregarDadosVencimentos(anoFiltro) {
    const dataSistema = new Date();
    const ano = parseInt(anoFiltro) || dataSistema.getFullYear();

    let hoje = new Date(dataSistema);
    if (ano < dataSistema.getFullYear()) hoje = new Date(ano, 11, 31, 23, 59, 59);
    else if (ano > dataSistema.getFullYear()) hoje = new Date(ano, 0, 1, 0, 0, 0);
    hoje.setHours(0, 0, 0, 0);

    let soma = {
        ajAVencer: 0, ajVencidos: 0, ajPagos: 0, ajSuspenso: 0, ajHoje: 0,
        chAVencer: 0, chVencidos: 0, chPagos: 0, chSuspenso: 0, chHoje: 0,
        cxAVencer: 0, cxVencidos: 0, cxPagos: 0, cxSuspenso: 0, cxHoje: 0,
        contasAVencer: 0, contasVencidas: 0, contasPagos: 0, contasSuspensas: 0, contasHoje: 0,
        staffAguardando: 0
    };

    try {
        const [resStaff, resContas] = await Promise.all([
            fetchComToken(`/main/vencimentos?periodo=anual&ano=${ano}`),
            fetchComToken(`/main/contas-pagar?periodo=anual&ano=${ano}`)
        ]);

        // --- 1. PROCESSAR STAFF ---
        if (resStaff?.eventos) {
            resStaff.eventos.forEach(ev => {
                const ajPg = parseFloat(ev.ajuda?.pago || ev.ajuda?.pagos || 0);
                const chPgAntesCheck = parseFloat(ev.cache?.pago || ev.cache?.pagos || 0);
                soma.ajPagos += ajPg;
                soma.chPagos += chPgAntesCheck;
                soma.cxPagos += parseFloat(ev.caixinha?.pago) || 0;

                // Evento sem funcionários cadastrados fica em "Aguardando Staff" (mesma regra
                // usada no acordeão/card do topo) — pendente dele não é vencido/hoje/a vencer
                // pra nenhuma aba, então não pode virar nenhum desses buckets aqui também.
                const temFuncionariosEv = ev.funcionarios && ev.funcionarios.length > 0;
                if (!temFuncionariosEv) {
                    soma.staffAguardando += (parseFloat(ev.ajuda?.pendente) || 0) + (parseFloat(ev.cache?.pendente) || 0) + (parseFloat(ev.caixinha?.pendente) || 0);
                    return;
                }

                const ajP = parseFloat(ev.ajuda?.pendente) || 0;
                if (ajP > 0 && ev.dataVencimentoAjuda) {
                    const parts = ev.dataVencimentoAjuda.split('/');
                    const dV = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]), 12, 0, 0);
                    if (dV.getFullYear() === ano) {
                        if (ehMesmoDia(dV, hoje)) soma.ajHoje += ajP;
                        else if (dV < hoje) soma.ajVencidos += ajP;
                        else soma.ajAVencer += ajP;
                    }
                }
                const chP = parseFloat(ev.cache?.pendente) || 0;
                if (chP > 0 && ev.dataVencimentoCache && ev.dataVencimentoCache !== 'N/A') {
                    const partsC = ev.dataVencimentoCache.split('/');
                    const dC = new Date(parseInt(partsC[2]), parseInt(partsC[1]) - 1, parseInt(partsC[0]), 12, 0, 0);
                    if (dC.getFullYear() === ano) {
                        if (ehMesmoDia(dC, hoje)) soma.chHoje += chP;
                        else if (dC < hoje) soma.chVencidos += chP;
                        else soma.chAVencer += chP;
                    }
                }

                // Caixinha: antes ia direto pra "a vencer" sem olhar data — agora usa a
                // própria data de vencimento (mesma regra de Ajuda/Cachê acima).
                const cxP = parseFloat(ev.caixinha?.pendente) || 0;
                if (cxP > 0 && ev.dataVencimentoCaixinha && ev.dataVencimentoCaixinha !== 'N/A' && ev.dataVencimentoCaixinha !== '---') {
                    const partsX = ev.dataVencimentoCaixinha.split('/');
                    const dX = new Date(parseInt(partsX[2]), parseInt(partsX[1]) - 1, parseInt(partsX[0]), 12, 0, 0);
                    if (dX.getFullYear() === ano) {
                        if (ehMesmoDia(dX, hoje)) soma.cxHoje += cxP;
                        else if (dX < hoje) soma.cxVencidos += cxP;
                        else soma.cxAVencer += cxP;
                    }
                } else if (cxP > 0) {
                    soma.cxAVencer += cxP;
                }

                // Suspenso é campo à parte de "pendente" — antes não entrava em nenhum bucket
                // aqui (nem vencido, nem a vencer), ficando invisível também nesse painel.
                soma.ajSuspenso += parseFloat(ev.ajuda?.suspenso) || 0;
                soma.chSuspenso += parseFloat(ev.cache?.suspenso) || 0;
                soma.cxSuspenso += parseFloat(ev.caixinha?.suspenso) || 0;
            });
        }

        // --- 2. PROCESSAR CONTAS A PAGAR (COM TRAVA DE DUPLICIDADE) ---
        const listaContas = Array.isArray(resContas) ? resContas : (resContas?.contas || []);
        const ocupacaoMensal = {}; 

        listaContas.forEach(c => {
            const dStr = (c.dtvcto || c.vctobase || "").substring(0, 10);
            if (!dStr) return;
            const vctoReal = new Date(dStr + "T12:00:00");
            if (vctoReal.getFullYear() !== ano) return;

            const chave = `${c.idlancamento || c.nome_vinculo}-${vctoReal.getMonth()}`;
            ocupacaoMensal[chave] = true;

            const status = (c.status || "").toLowerCase();
            // Funcionário (salário/13º) usa valorTotal/valorPago, não vlrestimado/vlrreal/vlrpago
            // (esses são só dos lançamentos normais) — sem isso o custo do funcionário some do
            // total anual (soma 0) mesmo com o holerite certo e pago.
            const vTotal = Number(c.vlrreal || c.valor || c.vlrestimado || c.valorTotal || 0);
            const vPago = Number(c.vlrpago || c.valorPago || 0);

            if (status === 'pago') soma.contasPagos += (vPago || vTotal);
            else if (status === 'suspenso') {
                // Terceiro estado, nem vencida nem a vencer — card/linha própria (Suspensas),
                // mesma ideia do resumo do acordeão "Contas a Pagar" e do card do topo.
                soma.contasSuspensas += vTotal;
            } else {
                if (ehMesmoDia(vctoReal, hoje)) soma.contasHoje += vTotal;
                else if (vctoReal < hoje) soma.contasVencidas += vTotal;
                else soma.contasAVencer += vTotal;
            }
        });

        // Ocorrências projetadas (meses ainda sem "pagamentos" gravado) do MESMO lançamento —
        // ver expandirOcorrenciasNoAno, a mesma função que monta a lista detalhada da tela.
        // Antes esse cálculo era próprio daqui e tinha dois bugs: ignorava lançamentos
        // PARCELADO por completo, e pra FIXO expandia a partir do ano do vctobase original em
        // vez do ano filtrado direto (um lançamento com mais de ~11 meses nunca alcançava anos
        // futuros).
        listaContas.forEach(c => {
            const vProj = Number(c.vlrreal || c.valor || c.vlrestimado || c.valorTotal || 0);
            expandirOcorrenciasNoAno(c, ano).forEach(dParcela => {
                const chaveProj = `${c.idlancamento || c.nome_vinculo}-${dParcela.getMonth()}`;
                if (ocupacaoMensal[chaveProj]) return;
                if (ehMesmoDia(dParcela, hoje)) soma.contasHoje += vProj;
                else if (dParcela < hoje) soma.contasVencidas += vProj;
                else soma.contasAVencer += vProj;
                ocupacaoMensal[chaveProj] = true;
            });
        });

        // --- 2.5 PROCESSAR HOLERITES (SALÁRIO/13º) ---
        // Folha de funcionário fixo (Interno/Externo) NÃO vem em resContas.contas (isso é só
        // lançamento manual) — ela é calculada aparte pelo back (GET /contas-pagar já devolve
        // holerites/eventos13 prontos, real ou previsão), então precisa somar aqui também,
        // senão o custo de funcionário nunca entra no total anual.
        (resContas?.holerites || []).forEach(h => {
            if (h.ano !== ano) return;
            const vTotal = Number(h.liquido || 0);
            if (vTotal <= 0) return;
            const pago = h.origem === 'real' && String(h.status || '').toLowerCase() === 'pago';
            if (pago) { soma.contasPagos += vTotal; return; }
            const dVcto = new Date(ano, h.mes - 1, 5, 12, 0, 0);
            if (ehMesmoDia(dVcto, hoje)) soma.contasHoje += vTotal;
            else if (dVcto < hoje) soma.contasVencidas += vTotal; else soma.contasAVencer += vTotal;
        });
        (resContas?.eventos13 || []).forEach(ev => {
            if (ev.ano !== ano) return;
            const vTotal = Number(ev.liquido || 0);
            if (vTotal <= 0) return;
            const pago = ev.origem === 'real' && String(ev.status || '').toLowerCase() === 'pago';
            if (pago) { soma.contasPagos += vTotal; return; }
            const dVcto = new Date((ev.dtvcto || "") + "T12:00:00");
            if (ehMesmoDia(dVcto, hoje)) soma.contasHoje += vTotal;
            else if (dVcto < hoje) soma.contasVencidas += vTotal; else soma.contasAVencer += vTotal;
        });
        // Benefícios (VA/VT) — mesma ideia do salário/13º acima, só que "pago" olha
        // status_beneficios (via linha.status já vem daí, ver /contas-pagar em rotaMain.js) e
        // vencimento é o dtvcto próprio (último dia útil do mês), não dia 5.
        (resContas?.beneficios || []).forEach(b => {
            if (b.ano !== ano) return;
            const vTotal = Number(b.liquido || 0);
            if (vTotal <= 0) return;
            const pago = b.origem === 'real' && String(b.status || '').toLowerCase() === 'pago';
            if (pago) { soma.contasPagos += vTotal; return; }
            const dVcto = new Date((b.dtvcto || "") + "T12:00:00");
            if (ehMesmoDia(dVcto, hoje)) soma.contasHoje += vTotal;
            else if (dVcto < hoje) soma.contasVencidas += vTotal; else soma.contasAVencer += vTotal;
        });

        // --- 3. ATUALIZAÇÃO DA UI (STAFF + CONTAS) ---
        const format = (val) => formatarMoeda(val);
        const safeSetText = (id, value) => {
            const elementos = document.querySelectorAll(`#${id}`);
            elementos.forEach(el => { el.textContent = format(value); });
        };

        const totalPagos = soma.ajPagos + soma.chPagos + soma.cxPagos + soma.contasPagos;
        const totalVencidos = soma.ajVencidos + soma.chVencidos + soma.cxVencidos + soma.contasVencidas;
        const totalAVencer = soma.ajAVencer + soma.chAVencer + soma.cxAVencer + soma.contasAVencer;
        // "Hoje" é um terceiro estado temporal (nem vencido nem a vencer) — mesma regra do
        // card do topo "Hoje Geral" e do resumo dos acordeões: antes esse dinheiro entrava
        // junto de "A Vencer" aqui, fazendo esse total divergir do que aparecia nas outras telas.
        const staffHoje = soma.ajHoje + soma.chHoje + soma.cxHoje;
        const totalHoje = staffHoje + soma.contasHoje;
        // Suspensa é um terceiro estado (nem vencida nem a vencer) — só existe do lado de
        // Contas/Fornecedores hoje (Staff/eventos não têm esse conceito), mas ainda é dinheiro
        // de verdade, por isso entra no Total Geral/Total Anual (mesma regra do card do topo
        // "Total Geral" e do resumo do acordeão "Contas a Pagar"). Staff também tem suspenso
        // (Ajuda/Cachê podem ser suspensos por evento) — antes ficava invisível aqui também.
        const staffSuspenso = soma.ajSuspenso + soma.chSuspenso + soma.cxSuspenso;
        const totalSuspensas = staffSuspenso + soma.contasSuspensas;
        // Aguardando Staff: evento sem funcionários cadastrados ainda (mesma regra do
        // acordeão/card do topo) — não é vencido/hoje/a vencer/suspenso pra nenhuma aba, mas
        // ainda é dinheiro real, por isso entra no Total Geral.
        const totalAguardando = soma.staffAguardando;

        // Cards Superiores
        safeSetText('vencimentosTotal', totalAVencer);
        safeSetText('vencimentosPagos', totalPagos);
        safeSetText('vencimentosVencidas', totalVencidos);
        safeSetText('vencHojeGeral', totalHoje);
        safeSetText('vencSuspensasGeral', totalSuspensas);
        safeSetText('vencTotalGeral', totalPagos + totalVencidos + totalHoje + totalAVencer + totalSuspensas + totalAguardando);

        // Seção Contas
        safeSetText('vencTotalContas', soma.contasPagos + soma.contasVencidas + soma.contasHoje + soma.contasAVencer + soma.contasSuspensas);
        safeSetText('vencContasPagos', soma.contasPagos);
        safeSetText('vencContasVencidas', soma.contasVencidas);
        safeSetText('vencContasHoje', soma.contasHoje);
        safeSetText('vencContasPendente', soma.contasAVencer);
        safeSetText('vencContasSuspensas', soma.contasSuspensas);

        // --- SEÇÃO STAFF (RESTURADA) ---
        const totalStaff = (soma.ajPagos + soma.chPagos + soma.cxPagos) + (soma.ajAVencer + soma.chAVencer + soma.cxAVencer) + (soma.ajVencidos + soma.chVencidos + soma.cxVencidos) + staffHoje + staffSuspenso + totalAguardando;
        safeSetText('vencTotalStaff', totalStaff);
        safeSetText('vencAjudaSuspenso', soma.ajSuspenso);
        safeSetText('vencCacheSuspenso', soma.chSuspenso);
        safeSetText('vencAjudaHoje', soma.ajHoje);
        safeSetText('vencCacheHoje', soma.chHoje);

        // Ajuda
        safeSetText('vencAjudaPagos', soma.ajPagos);
        safeSetText('vencAjudaVencidos', soma.ajVencidos);
        safeSetText('vencAjudaAVencer', soma.ajAVencer);
        
        // Cachê
        safeSetText('vencCachePagos', soma.chPagos);
        safeSetText('vencCacheVencidos', soma.chVencidos);
        safeSetText('vencCacheAVencer', soma.chAVencer);

    } catch (e) { console.error("Erro financeiro:", e); }
}

async function inicializarCardVencimentos() {
    // Checa as duas permissões (Assumindo que estão definidas globalmente)
    const eSupremo = usuarioTemPermissaoSupremo();
    const eMaster = usuarioTemPermissao();
    const eFinanceiro = usuarioTemPermissaoFinanceiro();

    // Seleciona os containers principais
    const cardVencimentos = document.getElementById('cardContainerVencimentos');
    const cardOrcamentos = document.getElementById('cardContainerOrcamentos');

    if (!cardVencimentos || !cardOrcamentos) {
        console.warn("Um dos cards não foi encontrado (Vencimentos ou Orçamentos).");
        return;
    }

    // Padrão: Ambos ocultos, depois exibimos o(s) necessário(s)
    cardVencimentos.style.display = 'none';
    cardOrcamentos.style.display = 'none';
    
    // ===========================================
    // Lógica de Visibilidade
    // ===========================================
    
    if (eSupremo || eFinanceiro || eMaster ) {
        // Se for Master OU Financeiro: Mostra VENCIMENTOS
        cardVencimentos.style.display = 'flex';
        carregarDadosVencimentos(); // Chama a função que preenche o card
    }

    if (eSupremo || eMaster) {
        // Se for Master: Mostra ORÇAMENTOS também
        cardOrcamentos.style.display = 'flex';
    } 
    else if (!eSupremo && !eFinanceiro && !eMaster) {
         // Se for Nenhum (não Master e não Financeiro): Mostra APENAS ORÇAMENTOS
        cardOrcamentos.style.display = 'flex';
    }
}


function criarControlesDeFiltro(conteudoGeral, valoresResumoElement) {
    const filtrosContainer = document.createElement("div");
    filtrosContainer.className = "filtros-vencimentos";

    // 1. Filtro Principal (Radios)
    const grupoPeriodo = document.createElement("div");
    grupoPeriodo.className = "filtro-periodo";
    grupoPeriodo.innerHTML = `
      <label class="label-select">Tipo de Filtro</label>
      <div class="wrapper" id="periodo-wrapper">
        ${["diario", "semanal", "mensal", "trimestral", "semestral", "anual"].map(t => `
            <div class="option">
                <input ${t === 'diario' ? 'checked' : ''} value="${t}" name="periodo" type="radio" class="input" />
                <div class="btn"><span class="span">${t.charAt(0).toUpperCase() + t.slice(1)}</span></div>
            </div>
        `).join('')}
      </div>
    `;
    filtrosContainer.appendChild(grupoPeriodo);

    // 2. Sub-Filtro Wrapper
    const subFiltroWrapper = document.createElement("div");
    subFiltroWrapper.id = "sub-filtro-wrapper";
    subFiltroWrapper.className = "sub-filtro";
    filtrosContainer.appendChild(subFiltroWrapper);

    // 3. Botões de Foco (acesso rápido): abrem um dos dois blocos (Staff / Contas)
    // já expandido, escondendo o resumo e o outro bloco pra usar toda a tela.
    const focoContainer = document.createElement("div");
    focoContainer.className = "foco-vencimentos-container";
    focoContainer.innerHTML = `
        <button type="button" class="btn-foco-vencimento" data-foco="eventos">📅 Pagamentos de Staff</button>
        <button type="button" class="btn-foco-vencimento" data-foco="contas">💸 Contas a Pagar</button>
        <button type="button" class="btn-fechar-foco-vencimento" style="display:none;">✕ Fechar</button>
    `;
    filtrosContainer.appendChild(focoContainer);

    const btnFocoEventos = focoContainer.querySelector('[data-foco="eventos"]');
    const btnFocoContas = focoContainer.querySelector('[data-foco="contas"]');
    const btnFecharFoco = focoContainer.querySelector('.btn-fechar-foco-vencimento');

    function atualizarBotoesFoco() {
        const foco = window._focoVencimentoAtivo || null;
        btnFocoEventos.classList.toggle('active', foco === 'eventos');
        btnFocoContas.classList.toggle('active', foco === 'contas');
        btnFecharFoco.style.display = foco ? 'inline-flex' : 'none';
    }

    function alternarFoco(valor) {
        window._focoVencimentoAtivo = window._focoVencimentoAtivo === valor ? null : valor;
        atualizarBotoesFoco();
        carregarDetalhesVencimentos(conteudoGeral, valoresResumoElement);
    }

    btnFocoEventos.onclick = () => alternarFoco('eventos');
    btnFocoContas.onclick = () => alternarFoco('contas');
    btnFecharFoco.onclick = () => {
        window._focoVencimentoAtivo = null;
        atualizarBotoesFoco();
        carregarDetalhesVencimentos(conteudoGeral, valoresResumoElement);
    };

    atualizarBotoesFoco();

    function montarOpcoes(titulo, valores) {
        return `
            <label class="label-select">${titulo}</label>
            <div class="wrapper" id="sub-opcoes">
                ${valores.map(v => `
                    <div class="option">
                        <input value="${v.value}" name="sub" type="radio" class="input" ${v.checked ? "checked" : ""} />
                        <div class="btn"><span class="span">${v.label}</span></div>
                    </div>
                `).join("")}
            </div>
        `;
    }

    // --- FUNÇÃO CENTRALIZADA ---
    function atualizarSubFiltro(tipo) {
        subFiltroWrapper.innerHTML = "";
        
        // Centralização do Ano: Captura uma única vez para todos os blocos
        const selectAno = document.getElementById('selectAno');
        const anoRef = selectAno ? parseInt(selectAno.value, 10) : new Date().getFullYear();
        
        const hoje = new Date();
        const mesPadrao = String(hoje.getMonth() + 1).padStart(2, '0');
        const diaPadrao = String(hoje.getDate()).padStart(2, '0');
        const dataDefault = `${anoRef}-${mesPadrao}-${diaPadrao}`;

        if (tipo === "diario" || tipo === "semanal") {
            const label = tipo === "diario" ? "Selecione o Dia" : "Data de Início da Semana";
            subFiltroWrapper.innerHTML = `
                <label class="label-select">${label}</label>
                <div class="wrapper select-wrapper">
                    <input type="date" id="sub-filtro-data" class="input-data-simples" value="${dataDefault}">
                </div>
            `;
            subFiltroWrapper.querySelector("#sub-filtro-data").addEventListener("change", () => carregarDetalhesVencimentos(conteudoGeral, valoresResumoElement));
        } 
        
        else if (tipo === "mensal") {
            let optionsHtml = "";
            for (let i = 1; i <= 12; i++) {
                const isCurrentMonth = (i === hoje.getMonth() + 1);
                optionsHtml += `<option value="${i}" ${isCurrentMonth ? "selected" : ""}>${nomeDoMes(i)} / ${anoRef}</option>`;
            }
            subFiltroWrapper.innerHTML = `
                <label class="label-select">Selecione o Mês</label>
                <div class="wrapper select-wrapper">
                    <select id="sub-filtro-select" class="select-simples">${optionsHtml}</select>
                </div>
            `;
            subFiltroWrapper.querySelector("#sub-filtro-select").addEventListener("change", () => carregarDetalhesVencimentos(conteudoGeral, valoresResumoElement));
        } 
        
        else if (tipo === "trimestral") {
            const trimestreAtual = Math.ceil((hoje.getMonth() + 1) / 3);
            const trimes = [1, 2, 3, 4].map(t => ({
                value: t,
                label: `${t}° Trimestre `,
                checked: t === trimestreAtual
            }));
            subFiltroWrapper.innerHTML = montarOpcoes(`Selecione o Trimestre / ${anoRef}`, trimes);
        } 
        
        else if (tipo === "semestral") {
            const semestreAtual = (hoje.getMonth() + 1) <= 6 ? 1 : 2;
            const semestres = [
                { value: 1, label: `1º Semestre`, checked: semestreAtual === 1 },
                { value: 2, label: `2º Semestre`, checked: semestreAtual === 2 }
            ];
            subFiltroWrapper.innerHTML = montarOpcoes(`Selecione o Semestre / ${anoRef}`, semestres);
        } 
        
        else if (tipo === "anual") {
            subFiltroWrapper.innerHTML = `
                <label class="label-select">Período Anual</label>
                <p class="anual-info">Eventos do ano de ${anoRef}</p>
            `;
        }

        // Listeners para Radios Custom (Trimestral/Semestral)
        const radios = subFiltroWrapper.querySelectorAll("input[name='sub']");
        radios.forEach(r => r.addEventListener("change", () => carregarDetalhesVencimentos(conteudoGeral, valoresResumoElement)));

        // Disparo imediato do carregamento
        carregarDetalhesVencimentos(conteudoGeral, valoresResumoElement);
    }

    // Inicialização e Listeners Principais
    atualizarSubFiltro("diario");

    grupoPeriodo.querySelectorAll("input[name='periodo']").forEach(radio => {
        radio.addEventListener("change", (e) => atualizarSubFiltro(e.target.value));
    });

    // BÔNUS: Sincroniza quando o ano do card mudar
    const selectAnoGlobal = document.getElementById('selectAno');
    if (selectAnoGlobal) {
        selectAnoGlobal.addEventListener('change', () => {
            const tipoAtivo = grupoPeriodo.querySelector("input[name='periodo']:checked").value;
            atualizarSubFiltro(tipoAtivo);
        });
    }

    return filtrosContainer;
}

function criarFiltroCategorias(conteudoGeral, valoresResumoElement) {
    const container = document.createElement("div");
    container.className = "filtro-categoria-container"; // Uma classe pai para controle extra se precisar

    //  <div class="wrapper" id="categoria-wrapper">
    // 
    container.innerHTML = `
      <label class="label-select">Categoria de Pagamento</label>
      <div class="categoria-wrapper">
        <div class="option">
            <input checked value="ajuda_custo" name="categoria" type="radio" class="input" />
            <div class="btn"><span class="span">Ajuda Custo</span></div>
        </div>
        <div class="option">
            <input value="cache" name="categoria" type="radio" class="input" />
            <div class="btn"><span class="span">Cache</span></div>
        </div>
        <div class="option">
            <input value="caixinha" name="categoria" type="radio" class="input" />
            <div class="btn"><span class="span">Caixinha</span></div>
        </div>
      </div>
    `;

    // Adiciona o evento de clique em cada rádio
    // container.querySelectorAll("input[name='categoria']").forEach(radio => {
    //     radio.addEventListener("change", () => {
    //         // Chama a função de carregamento sempre que mudar a categoria
    //         if (typeof carregarDetalhesVencimentos === "function") {
    //             carregarDetalhesVencimentos(conteudoGeral, valoresResumoElement);
    //         }
    //     });
    // });

    container.querySelectorAll("input[name='categoria']").forEach(radio => {
        radio.addEventListener("change", (e) => {
            // 1. Limpa o estilo inline de TODOS os btns e spans
            container.querySelectorAll('.btn').forEach(b => {
                b.style.backgroundColor = '';
            });
            container.querySelectorAll('.span').forEach(s => {
                s.style.color = '';
            });

            // 2. Aplica o estilo no btn selecionado
            const btnAtivo = e.target.nextElementSibling;
            if (btnAtivo) {
                btnAtivo.style.backgroundColor = 'var(--primary-color)';
                const spanAtivo = btnAtivo.querySelector('.span');
                if (spanAtivo) spanAtivo.style.color = 'var(--font-color)';
            }

            // 3. Chama a função de carregamento se existir
            if (typeof carregarDetalhesVencimentos === "function") {
                carregarDetalhesVencimentos(conteudoGeral, valoresResumoElement);
            }
        });
    });

    return container;
}

function nomeDoMes(num) {
    const meses = [
        "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
        "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"
    ];
    return meses[num - 1];
}

function construirQueryDeFiltro() {
    // Definido localmente para garantir o escopo
    const anoAtual = new Date().getFullYear(); 
    
    const periodoSelect = document.getElementById('periodo-select');
    const periodo = periodoSelect.value;
    let queryString = `?periodo=${periodo}&ano=${anoAtual}`;

    // Adiciona o parâmetro de seleção específico se não for Diário ou Anual
    if (periodo === 'mensal') {
        const mesSelect = document.getElementById('sub-filtro-select');
        if (mesSelect) {
      queryString += `&mes=${mesSelect.value}`;
        }
    } else if (periodo === 'trimestral') {
        const trimestreSelect = document.getElementById('sub-filtro-select');
        if (trimestreSelect) {
      queryString += `&trimestre=${trimestreSelect.value}`;
        }
    } else if (periodo === 'semestral') {
        const semestreSelect = document.getElementById('sub-filtro-select');
        if (semestreSelect) {
      queryString += `&semestre=${semestreSelect.value}`;
        }
    }

    // Para o filtro diário, usamos a data atual como referência (se não houver um seletor de data)
    if (periodo === 'diario') {
         const hoje = new Date().toISOString().split('T')[0];
         queryString += `&dataInicio=${hoje}`;
    }

    return queryString;
}

document.getElementById("cardContainerVencimentos").addEventListener("click", async function() {
    const painel = document.getElementById("painelDetalhes");
    painel.innerHTML = "";

    const container = document.createElement("div");
    container.id = "venc-container";
    container.className = "venc-container";

    const header = document.createElement("div");
    header.className = "venc-header";

    const btnVoltar = document.createElement("button"); 
    btnVoltar.id = "btnVoltarVencimentos";
    btnVoltar.className = "btn-voltar";
    btnVoltar.textContent = "←";

    const titulo = document.createElement("h2");
    titulo.textContent = "Vencimentos de Pagamentos"; 

    header.appendChild(btnVoltar);
    header.appendChild(titulo);
    container.appendChild(header);

    const valoresResumoElement = document.createElement("div");
    valoresResumoElement.id = "valores-resumo-vencimentos"; 
    valoresResumoElement.className = "resumo-periodo-vencimentos";
    
    const conteudoGeral = document.createElement("div");
    conteudoGeral.className = "conteudo-geral";

    window._focoVencimentoAtivo = null; // Sempre começa no modo normal (resumo visível)

    const FiltrosVencimentos = criarControlesDeFiltro(conteudoGeral, valoresResumoElement);

    container.appendChild(FiltrosVencimentos); 
    container.appendChild(valoresResumoElement);
    container.appendChild(conteudoGeral);

    // Anexe o container completo ao painel
    painel.appendChild(container);
  
    btnVoltar.addEventListener('click', () => {
        painel.innerHTML = ""; // Volta para a tela anterior
    });
});


// ===========================


// ======================
// ABRIR AGENDA
// ======================
async function inicializarAgendaCard() {
    window.eventosSalvos = await carregarAgendaUsuario();
    atualizarMiniCardAgenda();
}

document.getElementById("card-agenda").addEventListener("click", async function() {
  const painel = document.getElementById("painelDetalhes");
  painel.innerHTML = "";

  const container = document.createElement("div");
  container.id = "agenda-container";
  container.className = "agenda-container";

  // HEADER
  const header = document.createElement("div");
  header.className = "agenda-header";

  const btnVoltar = document.createElement("button");
  btnVoltar.id = "btnVoltarAgenda";
  btnVoltar.className = "btn-voltar";
  btnVoltar.textContent = "←";

  const titulo = document.createElement("h2");
  titulo.textContent = "Agenda Pessoal";

  header.appendChild(btnVoltar);
  header.appendChild(titulo);
  container.appendChild(header);

  // ===== CONTEÚDO GERAL =====
  const conteudoGeral = document.createElement("div");
  conteudoGeral.className = "conteudo-geral";

  // ===== CALENDÁRIO =====
  const calendarioDiv = document.createElement("div");
  calendarioDiv.className = "agenda-calendario";
  calendarioDiv.id = "calendarioVertical";

  // --- SELECT DE MÊS ---
  const seletorMes = document.createElement("select");
  seletorMes.id = "seletorMes";
  seletorMes.className = "select-mes";

  const meses = [
    "Janeiro", "Fevereiro", "Março", "Abril",
    "Maio", "Junho", "Julho", "Agosto",
    "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  meses.forEach((mes, index) => {
    const option = document.createElement("option");
    option.value = index;
    option.textContent = mes;
    seletorMes.appendChild(option);
  });

  seletorMes.value = new Date().getMonth();
  calendarioDiv.appendChild(seletorMes);

  // --- CRIAÇÃO DO CABEÇALHO DOS DIAS DA SEMANA ---
const cabecalhoDiasSemana = document.createElement("div");
cabecalhoDiasSemana.id = "cabecalhoDiasSemana";
cabecalhoDiasSemana.className = "cabecalho-semana";

// Nomes dos dias da semana (começando no Domingo, ajuste se necessário)
const nomesDias = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]; 

nomesDias.forEach(nome => {
    const nomeDiaDiv = document.createElement("div");
    nomeDiaDiv.className = "nome-dia";
    nomeDiaDiv.textContent = nome;
    cabecalhoDiasSemana.appendChild(nomeDiaDiv);
});

// ADICIONA O CABEÇALHO DA SEMANA
calendarioDiv.appendChild(cabecalhoDiasSemana);

  // container dos dias
  const diasDiv = document.createElement("div");
  diasDiv.id = "diasCalendario";
  diasDiv.className = "dias-calendario";
  calendarioDiv.appendChild(diasDiv);

  // ===== CONTEÚDO =====
  const conteudo = document.createElement("div");
  conteudo.className = "agenda-conteudo";

  const dataSelecionada = document.createElement("h3");
  dataSelecionada.id = "dataSelecionada";
  dataSelecionada.textContent = "Selecione um dia";
  conteudo.appendChild(dataSelecionada);

  const listaEventos = document.createElement("ul");
  listaEventos.id = "listaEventosDia";
  conteudo.appendChild(listaEventos);

  const btnAdicionar = document.createElement("button");
  btnAdicionar.id = "btnAdicionarEvento";
  btnAdicionar.className = "btn-adicionar";
  btnAdicionar.textContent = "+ Novo Evento";
  conteudo.appendChild(btnAdicionar);

  conteudoGeral.appendChild(calendarioDiv);
  conteudoGeral.appendChild(conteudo);
  container.appendChild(conteudoGeral);
  painel.appendChild(container);

  // =======================
  // EVENTOS E CALENDÁRIO
  // =======================
  if (typeof window.eventosSalvos === "undefined") window.eventosSalvos = [];

  // 🔹 Carrega os eventos salvos no banco
  window.eventosSalvos = await carregarAgendaUsuario();
  console.log("Eventos carregados no frontend:", window.eventosSalvos)

  gerarCalendarioMensal(parseInt(seletorMes.value, 10));

  seletorMes.addEventListener("change", function() {
    gerarCalendarioMensal(parseInt(this.value, 10));
  });

  btnVoltar.addEventListener("click", function() {
    painel.innerHTML = "";
  });

  btnAdicionar.addEventListener("click", abrirPopupNovoEvento);
});

function atualizarMiniCardAgenda() {
    const listaUl = document.getElementById("listaAgendaUsuario");
    if (!listaUl) return;

    listaUl.innerHTML = "";

    // Pega a data de hoje formatada (AAAA-MM-DD) para comparar
    const hoje = new Date();
    const hojeStr = hoje.getFullYear() + '-' + 
                    String(hoje.getMonth() + 1).padStart(2, '0') + '-' + 
                    String(hoje.getDate()).padStart(2, '0');

    // Filtra eventos de hoje
    const eventosHoje = (window.eventosSalvos || []).filter(ev => {
        const dataEv = new Date(ev.data_evento).toISOString().split('T')[0];
        return dataEv === hojeStr;
    });

    if (eventosHoje.length === 0) {
        listaUl.innerHTML = `<li class="agenda-vazia">Agenda Livre</li>`;
        return;
    }

    // Mostra os 3 primeiros eventos (para não estourar o card)
    eventosHoje.slice(0, 3).forEach(ev => {
        const li = document.createElement("li");
        li.className = "mini-item-agenda";
        
        // Define uma cor ou ícone baseado no tipo
        let corStatus = ev.tipo === 'Reunião' ? '#ff4d4d' : '#4CAF50';

        li.innerHTML = `
            <div class="mini-hora" style="border-left: 3px solid ${corStatus}">
                ${ev.hora_evento || '--:--'}
            </div>
            <div class="mini-detalhes">
                <span class="mini-titulo">${ev.titulo}</span>
                <span class="mini-tipo">${ev.tipo}</span>
            </div>
        `;
        listaUl.appendChild(li);
    });

    if (eventosHoje.length > 3) {
        const mais = document.createElement("li");
        mais.className = "mini-mais";
        mais.textContent = `+ ${eventosHoje.length - 3} outros hoje`;
        listaUl.appendChild(mais);
    }
}

function gerarCalendarioMensal(mesParam) {
  const diasDiv = document.getElementById("diasCalendario");
  if (!diasDiv) return;
  diasDiv.innerHTML = "";

  const ano = new Date().getFullYear();
  const mes = typeof mesParam === "number" ? mesParam : new Date().getMonth();
  const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();

  diasDiv.classList.add("grade-calendario");

  // 🔹 Função auxiliar para garantir comparação local (sem UTC)
  function formatarDataLocal(data) {
    const d = new Date(data);
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, "0");
    const dia = String(d.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
  }

  // Preenche dias vazios no início
  for (let i = 0; i < primeiroDiaSemana; i++) {
    const vazio = document.createElement("div");
    vazio.className = "dia vazio";
    diasDiv.appendChild(vazio);
  }

  // Gera cada dia do mês
  for (let dia = 1; dia <= diasNoMes; dia++) {
    const data = new Date(ano, mes, dia);
    const dataISO = formatarDataLocal(data); // agora em horário local
    const div = document.createElement("div");
    div.className = "dia";
    div.dataset.date = dataISO;
    div.textContent = dia;

    // 🔹 Verifica se há eventos nesse dia
    const eventosDia = (window.eventosSalvos || []).filter(
      ev => formatarDataLocal(ev.data_evento) === dataISO
    );

    if (eventosDia.length > 0) {
      const indicador = document.createElement("span");
      indicador.className = "indicador-evento";
      div.appendChild(indicador);
    }

    div.addEventListener("click", function() {
      selecionarDia(this, data);
    });

    diasDiv.appendChild(div);
  }

  // 🔹 Destaca o dia atual
  const hoje = new Date();
  if (hoje.getFullYear() === ano && hoje.getMonth() === mes) {
    const hojeStr = formatarDataLocal(hoje);
    const hojeDiv = diasDiv.querySelector(`div[data-date="${hojeStr}"]`);
    if (hojeDiv) {
      hojeDiv.classList.add("dia-atual");
      selecionarDia(hojeDiv, hoje);
    }
  }
}

function selecionarDia(div, data) {
  const calendario = document.getElementById("diasCalendario");
  if (calendario) {
    calendario.querySelectorAll(".dia").forEach(d => d.classList.remove("selecionado"));
  }
  div.classList.add("selecionado");

  const dataTexto = data.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  const tituloFormatado = dataTexto.charAt(0).toUpperCase() + dataTexto.slice(1);
  const elDataSelecionada = document.getElementById("dataSelecionada");
  if (elDataSelecionada) elDataSelecionada.textContent = tituloFormatado;

  carregarEventosDoDia(data);
}

function carregarEventosDoDia(data) {
  const lista = document.getElementById("listaEventosDia");
  if (!lista) return;
  lista.innerHTML = "";

  // 🔹 Função auxiliar para normalizar datas (sem UTC)
  function formatarDataLocal(data) {
    const d = new Date(data);
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, "0");
    const dia = String(d.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
  }

  const dataStr = formatarDataLocal(data);

  // 🔹 Agora a filtragem ignora o fuso horário
  const eventosDia = (window.eventosSalvos || []).filter(
    ev => formatarDataLocal(ev.data_evento) === dataStr
  );

  if (eventosDia.length === 0) {
    const li = document.createElement("li");
    li.textContent = "Nenhum evento para este dia.";
    li.style.color = "var(--text-2)";
    lista.appendChild(li);
  } else {
    eventosDia.forEach(ev => {
      const li = document.createElement("li");
      li.className = "evento-item";

      let icone = "";
      if (ev.tipo === "Reunião") {
        icone = `<svg class="icon" viewBox="0 0 24 24">
          <g stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path d="M8 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/>
      <path d="M16 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/>
      <path d="M2 20a6 6 0 0 1 12 0"/>
      <path d="M10 20a6 6 0 0 1 12 0"/>
      <path d="M12 14c-1.5 0-3 .5-4 1.5"/>
          </g>
        </svg>`;
      } else if (ev.tipo === "Lembrete") {
        icone = `<svg class="icon" viewBox="0 0 24 24">
          <g stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="4" width="14" height="16" rx="2"/>
      <path d="M7 8h8"/>
      <path d="M16 5v2"/>
          </g>
        </svg>`;
      } else if (ev.tipo === "Anotação") {
        icone = `<svg class="icon" viewBox="0 0 24 24">
          <g stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 3h10l6 6v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/>
      <path d="M14 3v6h6"/>
      <path d="M8 13h8"/>
      <path d="M8 16h5"/>
          </g>
        </svg>`;
      }

      li.innerHTML = `
        ${icone}
        <div class="evento-info">
          <strong>${ev.tipo || "Evento"}</strong> - ${ev.titulo || ""}
          <br>
          <small>${ev.hora_evento || ""} ${ev.descricao ? " | " + ev.descricao : ""}</small>
        </div>
      `;
      lista.appendChild(li);
    });
  }
}

function abrirPopupNovoEvento() {
  const overlay = document.createElement("div");
  overlay.className = "popup-overlay";

  const popup = document.createElement("div");
  popup.className = "popup-agenda";

  const diaSelecionado = document.querySelector(".agenda-calendario .dia.selecionado");
  const dataDefault = diaSelecionado
    ? diaSelecionado.dataset.date
    : new Date().toISOString().split("T")[0];

  const agora = new Date();
  const horaDefault = agora.toTimeString().slice(0, 5);

  popup.innerHTML = `
    <h3>Novo Evento</h3>
    <label>Tipo:</label>
    <select id="tipoEvento">
      <option value="Evento">Evento</option>
      <option value="Reunião">Reunião</option>
      <option value="Lembrete">Lembrete</option>
      <option value="Anotação">Anotação</option>
    </select>

    <label>Título:</label>
    <input type="text" id="tituloEvento" placeholder="Título do evento">

    <label>Data:</label>
    <input type="date" id="dataEvento" value="${dataDefault}">

    <label>Hora:</label>
    <input type="time" id="horaEvento" value="${horaDefault}">

    <label>Descrição:</label>
    <textarea id="descricaoEvento" placeholder="Detalhes..."></textarea>

    <div class="popup-botoes">
      <button id="btnSalvarEvento">Salvar</button>
      <button id="btnCancelarEvento">Cancelar</button>
    </div>
  `;

  overlay.appendChild(popup);
  document.body.appendChild(overlay);

  document.getElementById("btnCancelarEvento").addEventListener("click", () => overlay.remove());

  document.getElementById("btnSalvarEvento").addEventListener("click", async () => {
    const tipo = document.getElementById("tipoEvento").value;
    const titulo = document.getElementById("tituloEvento").value.trim();
    const data = document.getElementById("dataEvento").value;
    const hora = document.getElementById("horaEvento").value;
    const descricao = document.getElementById("descricaoEvento").value.trim();

    if (!titulo || !data) {
      alert("Preencha pelo menos o título e a data!");
      return;
    }

    const novoEvento = await salvarEventoAgenda({
      tipo,
      titulo,
      data_evento: data,
      hora_evento: hora,
      descricao
    });

    window.eventosSalvos.push(novoEvento);
    overlay.remove();

    carregarEventosDoDia(new Date(data));
  });
}

async function salvarEventoAgenda(dadosEvento) {
  try {
    const json = await fetchComToken("/main/agenda", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...dadosEvento,
        tipo: dadosEvento.tipo || "Evento" // 🔹 garante tipo padrão
      })
    });

    Swal.fire({
      title: "Evento salvo!",
      text: `O evento "${dadosEvento.titulo}" foi adicionado à sua agenda.`,
      icon: "success",
      confirmButtonText: "Ok",
      confirmButtonColor: "#3085d6",
      timer: 2500,
      timerProgressBar: true
    });

    return json; // 🔹 aqui já é o JSON retornado
  } catch (err) {
    console.error("Erro ao salvar evento:", err);
    alert("Erro ao salvar evento.");
  }
}

async function carregarAgendaUsuario() {
  try {
    const eventos = await fetchComToken("/main/agenda");
    console.log("Eventos carregados no frontend:", eventos);
    return eventos || [];
  } catch (err) {
    console.error("Erro ao buscar agenda:", err);
    return [];
  }
}


// Chame na inicialização:
document.addEventListener("DOMContentLoaded", async function () {
  await atualizarResumo();
  await atualizarEventosEmAberto();
  await atualizarProximoEvento();
  await inicializarCardVencimentos();
  await inicializarAgendaCard();
});






// =========================================================================
//  Home em pílulas (padrão do TI Mode)
//  ------------------------------------------------------------------------
//  Os blocos da home deixaram de ser cards grandes e viraram pílulas no topo
//  (estilo em Main.css). O clique de cada um continua sendo tratado pelos
//  listeners já existentes acima — aqui só cuidamos do estado visual: marcar
//  qual pílula está aberta e devolver o placeholder do painel de Detalhes
//  quando o usuário volta (os "←" dos painéis fazem painel.innerHTML = "").
// =========================================================================
// A faixa fixa do topo (barra "Trocar empresa" + header) não tem altura fixa:
// a barra some para quem só tem uma empresa e o header muda de altura conforme
// o menu quebra de linha. Medimos e publicamos em --altura-topo para o CSS da
// home encostar o conteúdo no cabeçalho e esticar até o fim da janela.
function medirAlturaTopo() {
  const cabecalho = document.querySelector("header");
  if (!cabecalho) return;
  // O header é position:fixed, então bottom já é a distância até o topo da
  // janela — somar scrollY daria um valor errado se a página estivesse rolada.
  const base = Math.round(cabecalho.getBoundingClientRect().bottom);
  document.documentElement.style.setProperty("--altura-topo", `${base}px`);
}

document.addEventListener("DOMContentLoaded", function () {
  medirAlturaTopo();
  window.addEventListener("resize", medirAlturaTopo);
  // A barra de empresas é montada pelo Index.js depois de um fetch, e a classe
  // .sem-troca-empresa entra no body no meio do caminho — remede quando isso
  // acontecer em vez de confiar na medida do primeiro frame.
  new MutationObserver(medirAlturaTopo).observe(document.body, {
    attributes: true,
    attributeFilter: ["class"],
  });
  const barraEmpresas = document.querySelector(".barra-empresas");
  if (barraEmpresas) new MutationObserver(medirAlturaTopo).observe(barraEmpresas, { childList: true, subtree: true });

  const barraCards = document.getElementById("Cards");
  const painel = document.getElementById("painelDetalhes");
  if (!barraCards || !painel) return;

  // Snapshot do painel "em repouso" (título + versão do sistema), tirado antes
  // de qualquer pílula ter sido clicada.
  const painelEmRepouso = painel.innerHTML;

  function limparPilulaAtiva() {
    barraCards.querySelectorAll(".card.pilula-ativa").forEach((p) => p.classList.remove("pilula-ativa"));
  }

  // A pílula corta o texto que não cabe (Próximo Evento costuma listar vários),
  // então o conteúdo inteiro vai pro title — quem quiser o detalhe passa o
  // mouse ou clica pra abrir no painel.
  function sincronizarTitles() {
    barraCards.querySelectorAll(".card").forEach((pilula) => {
      const texto = pilula.innerText.replace(/\s+/g, " ").trim();
      if (texto) pilula.title = texto;
    });
  }
  sincronizarTitles();
  new MutationObserver(sincronizarTitles).observe(barraCards, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  barraCards.addEventListener("click", function (evento) {
    const pilula = evento.target.closest(".card");
    if (!pilula || !barraCards.contains(pilula)) return;
    // O select de ano do Financeiro não muda de painel, só recarrega os valores.
    if (evento.target.closest("#filtoanual")) return;
    limparPilulaAtiva();
    pilula.classList.add("pilula-ativa");
  });

  // Quando o painel volta a ficar vazio, nenhuma pílula está "aberta" — e o
  // painel precisa do seu conteúdo de repouso de volta, senão fica em branco.
  // O timeout existe porque vários fluxos fazem innerHTML = "" e só depois
  // montam o conteúdo com appendChild: sem ele, o placeholder entraria no meio.
  let checagemPendente;
  new MutationObserver(function () {
    clearTimeout(checagemPendente);
    checagemPendente = setTimeout(function () {
      if (painel.children.length > 0) return;
      limparPilulaAtiva();
      painel.innerHTML = painelEmRepouso;
      if (!document.getElementById("app-version")?.innerText) carregarVersaoSistema();
    }, 0);
  }).observe(painel, { childList: true });
});
