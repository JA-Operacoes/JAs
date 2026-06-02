
import { fetchComToken, aplicarTema  } from '../utils/utils.js';

function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

const temPermissaoMaster = temPermissao("Staff", "master");
const temPermissaoFinanceiro = temPermissao("Staff", "financeiro");
const temPermissaoTotal = (temPermissaoMaster && temPermissaoFinanceiro);


let statusAditivoFinal = null; // Usar null em vez de '' para campos vazios
let statusExtraBonificadoFinal = null;
let permitirCadastro = false;
let nmFuncaoDoFormulario = '';

let bLiberacaoAutorizada = false;

let decisaoUsuarioDataFora = null;

let nivelOriginalCarregado = null;
let nivelFoiTrocado = false;

// Crie uma flag global para rastrear se o evento foi capturado
let prefillEventFired = false; 

let setorEsperado = ''; 
let estaSalvando = false;
let alteracaoRegistrada = false;

let bSalvarComoInativo = false;
let tipoExcecaoAtual = null;
let justificativaParaSalvar = "";
let prefixoSolicitacao = "";

window.addEventListener('prefill:registered', function (e) { 
    console.log("⚡ EVENTO RECEBIDO: prefill:registered. Tentando chamar a busca...");
    
    // 1. Sinalize que o evento foi capturado
    prefillEventFired = true; 

    // 2. Pega as datas que já estão no Flatpickr
    const datasDoFlatpickr = window.datasEventoPicker?.selectedDates.map(d => d.toISOString().split('T')[0]) || [];

    // 3. Primeira tentativa de checagem.
    // Esta checagem imediata pode falhar se o Nível de Experiência ainda não carregou (via AJAX).
    verificarSeDeveChamarOnCriteriosChanged(datasDoFlatpickr);

    // 4. [OPCIONAL, mas recomendado] Disparo de segurança:
    // Garante que o debouncedOnCriteriosChanged será chamado após o preenchimento de dados dependentes.
    setTimeout(() => {
        console.log("⏰ 200ms após prefill. Executando checagem final de segurança.");
        debouncedOnCriteriosChanged();
    }, 200);

}, { once: true });

document.addEventListener("DOMContentLoaded", function () {
    const idempresa = localStorage.getItem("idempresa");

    if (idempresa) {
        const apiUrl = `/empresas/${idempresa}`; // Verifique o caminho da sua API

        fetchComToken(apiUrl)
            .then(empresa => {
                // Usa o nome fantasia como tema
                const tema = empresa.nmfantasia;
                aplicarTema(tema);
            })
            .catch(error => {
                console.error("❌ Erro ao buscar dados da empresa para o tema:", error);
                // aplicarTema('default');
            });
    }
});

//importado no inicio do js pois deve ser importado antes do restante do codigo
import "https://cdn.jsdelivr.net/npm/flatpickr@latest/dist/flatpickr.min.js";
import "https://cdn.jsdelivr.net/npm/flatpickr@latest/dist/l10n/pt.js";

const fp = window.flatpickr;
const currentLocale = fp.l10ns.pt || fp.l10ns.default;

let avaliacaoChangeListener = null;
let limparStaffButtonListener = null;
let enviarStaffButtonListener = null;
let datasEventoFlatpickrInstance = null; // Para armazenar a instância do Flatpickr
let diariaDobradaFlatpickrInstance = null; // Para armazenar a instância do Flatpickr
let nmFuncionarioChangeListener = null;
let descFuncaoChangeListener = null;
let nmClienteChangeListener = null;
let nmEventoChangeListener = null;
let nmLocalMontagemChangeListener = null;
let qtdPavilhaoChangeListener = null; // Para o select de pavilhões, se for dinâmico
let CaixinhacheckListener = null;
let ajusteCustocheckListener = null;
let vlrCustoInputListener = null;
let ajusteCustoInputListener = null;
let transporteInputListener = null;
let alimentacaoInputListener = null;
let caixinhaInputListener = null;
let fileCacheChangeListener = null;
let fileAjdCustoChangeListener = null;
let fileCaixinhaChangeListener = null;
let fileAjdCusto2ChangeListener = null;
let fileControleGastosChangeListener = null;
let datasEventoPicker, diariaDobradaPicker, meiaDiariaPicker;
let datasEventoSelecionadas = []; // Inicializa com um array vazio
let datasDobrada = [];
let datasMeiaDiaria = [];
let orcamentoPorFuncao = {};
let statusOrcamentoAtual;
let idOrcamentoAtual = null;
//let limiteMaximo;
let porcentagemPaga = 50;
let isFormLoadedFromDoubleClick = false;
let currentRowSelected = null;
let currentEditingStaffEvent = null;
let retornoDados = false;
let vlrCustoSeniorFuncao = 0;
let vlrCustoSeniorFuncao2 = 0;
let vlrCustoPlenoFuncao = 0;
let vlrCustoJuniorFuncao = 0;
let vlrCustoBaseFuncao = 0;
let vlrAlimentacaoFuncao = 0;
let vlrTransporteFuncao = 0;
let vlrTransporteSeniorFuncao = 0;
let vlrAlimentacaoDobra =0;
let vlrFuncionario = 0;
let isLote = false;
let temOrcamento = false;
let bForaSP = false;
let categoriaFuncao = 'PADRAO';

if (!currentLocale) {
    console.error("Flatpickr locale 'pt' não carregado. Verifique o caminho do arquivo.");
} else {
    fp.setDefaults({
        locale: currentLocale
    });
    console.log("Flatpickr locale definido para Português.");
}
 // armazena as datas do primeiro calendário

window.flatpickrInstances = {};

const commonFlatpickrOptions = {
    mode: "multiple",
    //dateFormat: "d/m/Y",
    dateFormat: "Y-m-d",
    altInput: true,
    altFormat: "d/m/Y",
    locale: currentLocale,
    appendTo: document.body    
};

const feriadosFixos = ["01-01","04-21","05-01","06-19","09-07","10-12","11-02","11-15","11-20","12-25"];

const getDatesForFlatpickr = (dateData) => {
    if (!dateData) return [];
    let dates = typeof dateData === 'string' ? JSON.parse(dateData) : dateData;
    if (!Array.isArray(dates)) return [];

    return dates.map(item => {
        const dateStr = item.data ? item.data : item;
        if (typeof dateStr !== 'string') return null;
        const dateFormatted = dateStr.replace(/-/g, '/');
        const date = new Date(dateFormatted);
        return (date instanceof Date && !isNaN(date)) ? date : null;
    }).filter(d => d);
};

const parseDatesWithStatus = (dateData) => {
    if (!dateData) return [];
    let data = typeof dateData === 'string' ? JSON.parse(dateData) : dateData;
    return Array.isArray(data) ? data : [];
};

// const formatInputTextWithStatus = (instance, dataArray) => {

//     if (!instance || !instance.altInput) {
//         // Se estiver faltando, apenas sai da função.
//         return; 
//     }
//     const datesWithStatus = instance.selectedDates.map(date => {
//         const dateStr = flatpickr.formatDate(date, "Y-m-d");
//         const statusData = dataArray.find(item => item.data === dateStr);
//         const status = statusData ? statusData.status : 'Pendente';
//         return `${flatpickr.formatDate(date, "d/m/Y")} - ${status}`;
//     });
//     instance.altInput.value = datesWithStatus.join(', ');
// };

// Novo auxiliar para ser chamado com o resultado de parseDatesWithStatus


const formatInputTextWithStatus = (instance, dataArray) => {

    if (!instance || !instance.altInput) {
        // Se estiver faltando, apenas sai da função.
        return; 
    }
    
    // Garante que o dataArray seja tratado como lista para não quebrar com métodos de array
    const listaDados = Array.isArray(dataArray) ? dataArray : [];

    const datesWithStatus = instance.selectedDates.map(date => {
        const dateStr = flatpickr.formatDate(date, "Y-m-d");
        const statusData = listaDados.find(item => item.data === dateStr);
        const status = statusData ? statusData.status : 'Pendente';
        
        // 🚀 CAPTURA OS VALORES DE CACHÊ E ALIMENTAÇÃO DA DATA
        const cacheDobra = statusData?.vlr_cache !== undefined && statusData.vlr_cache !== null
            ? Number(statusData.vlr_cache) 
            : null;
            
        const alimDobra = statusData?.vlr_alimentacao !== undefined && statusData.vlr_alimentacao !== null
            ? Number(statusData.vlr_alimentacao) 
            : null;

        const dataFormatada = flatpickr.formatDate(date, "d/m/Y");

        // 🎯 SE TIVER VALORES SALVOS: Mostra o texto completo estruturado
        if (cacheDobra !== null) {
            return `${dataFormatada} [${status}] (C: R$ ${cacheDobra.toFixed(2)} | A: R$ ${(alimDobra || 0).toFixed(2)})`;
        }

        // Fallback caso seja uma dobra antiga sem valores gravados ainda no JSON
        return `${dataFormatada} [${status}]`;
    });

    // Une todas as datas com uma quebra de linha ou vírgula para manter legível
    instance.altInput.value = datesWithStatus.join(', ');
};


const extractDatesFromStatusArray = (datesWithStatusArray) => {
    if (!Array.isArray(datesWithStatusArray)) return [];
    
    return datesWithStatusArray.map(item => {
        const dateStr = item.data; // Assume que o campo de data é 'data'
        if (typeof dateStr !== 'string') return null;
        
        // Substituir traços para garantir a compatibilidade de new Date()
        const dateFormatted = dateStr.replace(/-/g, '/'); 
        const date = new Date(dateFormatted);
        return (date instanceof Date && !isNaN(date)) ? date : null;
    }).filter(d => d);
};


if (window.__modalInitialParams) {
    const params = new URLSearchParams(window.__modalInitialParams);
    const dataeventos = params.get("dataeventos");
    setorEsperado = params.get("setor") || '';

    if (dataeventos) {
        try {
            const datasEvento = JSON.parse(dataeventos);
            preencherDatasEventoFlatpickr(datasEvento);
        } catch (e) {
            console.warn("Erro ao parsear dataeventos:", e);
        }
    } else {
        console.warn("[configurarEventosStaff] Parâmetro dataeventos não encontrado.");
    }
}

const verificarSeEstaPago = () => {
    const pgtoCache = (window.statusPgtoCacheOriginalDoBanco || "").trim().toLowerCase();
    const pgtoAjuda = (window.statusPgtoAjudaOriginalDoBanco || "").trim().toLowerCase();
    return pgtoCache === "pago" || pgtoAjuda === "pago";
};

function configurarFlatpickrs() {
    console.log("%cConfigurando Flatpickrs...","background:green;"); 
    
    console.log("🔍 diariaDobrada el:", document.querySelector("#diariaDobrada"));
    console.log("🔍 meiaDiaria el:", document.querySelector("#meiaDiaria"));
    console.log("🔍 campoDiariaDobrada:", document.getElementById("campoDiariaDobrada"));
    // --- 1. Inicialização da Diária Dobrada ---
    const diariaDobradaEl = document.querySelector("#diariaDobrada");
    
    if (diariaDobradaEl) {
        window.diariaDobradaPicker = flatpickr(diariaDobradaEl, {
            ...commonFlatpickrOptions,
            enable: [],
            altInput: true,
            altFormat: "d/m/Y",           

            onDayCreate: (dObj, dStr, fp, dayElement) => {
                const dataDia = flatpickr.formatDate(dayElement.dateObj, "Y-m-d");
                const statusData = datasDobrada.find(item => item.data === dataDia);

                if (statusData) {
                    dayElement.classList.add(`status-${statusData.status.toLowerCase()}`);

                    if (statusData.status.toLowerCase() !== 'pendente') {
                        dayElement.classList.add('data-bloqueada');
                        dayElement.style.opacity = '0.6';
                        dayElement.style.cursor = 'not-allowed';

                        dayElement.addEventListener('mousedown', (e) => {
                            console.log('🔴 CLICOU NA DATA BLOQUEADA');
                            e.preventDefault();
                            e.stopImmediatePropagation();
                            Swal.fire({
                                title: 'Atenção!',
                                text: 'Esta data já foi processada e não pode ser desmarcada.',
                                icon: 'warning',
                                confirmButtonText: 'OK'
                            });
                        }, true);
                    }
                }
            },

            onReady: (selectedDates, dateStr, instance) => {
                setTimeout(() => {
                    formatInputTextWithStatus(instance, datasDobrada); 
                }, 0);
            },            
            
            onOpen: function(selectedDates, dateStr, instance) {
                instance.usuarioAbriu = true;
                const campo = document.getElementById('campoDiariaDobrada');
                const campoStatus = document.getElementById('campoStatusDiariaDobrada');
                const check = document.getElementById('diariaDobradacheck');
                if (campo) campo.style.display = 'block';
                if (campoStatus) campoStatus.style.display = 'block';
                if (check) check.checked = true;
                console.log("🟢 onOpen diariaDobrada - campoStatus:", campoStatus?.style.display);
            },
            
            onChange: (selectedDates, dateStr, instance) => {
                if (window.estLimpandoProgramaticamente) {
                    instance._prevSelectedDates = [];
                    return;
                }
                // Lógica de prevenção de remoção para datas não pendentes
                if (typeof estaSalvando !== 'undefined' && estaSalvando) {
                    instance._prevSelectedDates = [...selectedDates];
                    return; 
                }

                const previouslySelectedDates = instance._prevSelectedDates || [];
                const datesAttemptedToRemove = previouslySelectedDates.filter(prevDate => 
                    !selectedDates.some(newDate => prevDate.getTime() === newDate.getTime())
                );


                const unauthorizedRemovals = datesAttemptedToRemove.filter(removedDate => {
                    // Formata a data removida para YYYY-MM-DD com segurança
                    const removedDateStr = flatpickr.formatDate(removedDate, 'Y-m-d');
                    
                    // Procura no array original vindo do banco
                    return datasDobrada.some(d => {
                        // Compara as strings de data diretamente (evita erro de fuso horário do new Date)
                        const isSameDate = d.data === removedDateStr;
                        const isNotPendente = d.status.toLowerCase() !== 'pendente';
                        
                        // Só bloqueia se for a mesma data E o status NÃO for pendente
                        return isSameDate && isNotPendente;
                    });
                });

                if (unauthorizedRemovals.length > 0) {
              
                    Swal.fire({
                        title: 'Atenção!',
                        text: `As seguintes datas já foram processadas e não podem ser desmarcadas: ${unauthorizedRemovals.map(d => flatpickr.formatDate(d, 'd/m/Y')).join(', ')}.`,
                        icon: 'warning',
                        confirmButtonText: 'OK'
                    });
                    
                    instance.setDate(previouslySelectedDates, false);
                    return;
                }

                
                
                // Lógica de verificação de duplicatas (conflito com Meia Diária)
                let duplicateDates = [];
                if (selectedDates.length > 0) {
                    if (window.meiaDiariaPicker) { 
                        const datesMeiaDiaria = window.meiaDiariaPicker.selectedDates;
                        for (let i = 0; i < selectedDates.length; i++) {
                            const dataSelecionada = flatpickr.formatDate(selectedDates[i], "Y-m-d");
                            const dataExisteEmMeiaDiaria = datesMeiaDiaria.some(d => flatpickr.formatDate(d, "Y-m-d") === dataSelecionada);
                            if (dataExisteEmMeiaDiaria) {
                                duplicateDates.push(selectedDates[i]);
                            }
                        }
                    }
                }
                
                if (duplicateDates.length > 0) {
                    Swal.fire({
                        title: 'Atenção!',
                        text: `Uma ou mais datas selecionadas já estão em "Meia Diária": ${duplicateDates.map(d => flatpickr.formatDate(d, 'd/m/Y')).join(', ')}. Serão desmarcadas daqui.`,
                        icon: 'warning',
                        confirmButtonText: 'OK'
                    });
                    
                    const newSelectedDates = instance.selectedDates.filter(date =>
                        !duplicateDates.some(dupDate => dupDate.getTime() === date.getTime())
                    );
                    instance.setDate(newSelectedDates, false);
                    return; 
                }

                const isPago = verificarSeEstaPago();
               
                if (isPago && instance.usuarioAbriu) {
                    registrarLogPosPagamento(`Alteração em Diária Dobrada: ${dateStr}`);                    
                }

                // Se a validação passou, atualize a variável para o próximo ciclo
                instance._prevSelectedDates = [...selectedDates];
                formatInputTextWithStatus(instance, datasDobrada);

                if (typeof calcularValorTotal === 'function') {
                    calcularValorTotal();
                }
            },

            onClose: function(selectedDates, dateStr, instance) {
                setTimeout(() => {
                    formatInputTextWithStatus(instance, datasDobrada);
                    if (window.meiaDiariaPicker) {
                        formatInputTextWithStatus(window.meiaDiariaPicker, datasMeiaDiaria);
                    }
                }, 0); 
                document.getElementById('diariaDobradacheck').checked = instance.selectedDates.length > 0;
                updateDisabledDates();
                console.log("Fechando Diária Dobrada, datas selecionadas:", selectedDates);
                calcularValorTotal();

                setTimeout(() => { 
                    instance.usuarioAbriu = false; 
                    console.log("Flag 'usuarioAbriu' (Dobrada) resetada");
                }, 1000);
            },
        });
    } else {
        window.diariaDobradaPicker = null; // Garante que a variável seja null se o elemento não for encontrado
        console.warn("Elemento #diariaDobrada não encontrado. Picker de Diária Dobrada não inicializado.");
    }

    // --- 2. Inicialização da Meia Diária ---
    const meiaDiariaEl = document.querySelector("#meiaDiaria");
    
    if (meiaDiariaEl) {
        window.meiaDiariaPicker = flatpickr(meiaDiariaEl, {
            ...commonFlatpickrOptions,
            enable: [],
            altInput: true, 
            altFormat: "d/m/Y",           
           

            onDayCreate: (dObj, dStr, fp, dayElement) => {
                const dataDia = flatpickr.formatDate(dayElement.dateObj, "Y-m-d");
                const statusData = datasDobrada.find(item => item.data === dataDia);

                if (statusData) {
                    dayElement.classList.add(`status-${statusData.status.toLowerCase()}`);

                    if (statusData.status.toLowerCase() !== 'pendente') {
                        dayElement.classList.add('data-bloqueada');
                        dayElement.style.opacity = '0.6';
                        dayElement.style.cursor = 'not-allowed';

                        dayElement.addEventListener('mousedown', (e) => {
                            console.log('🔴 CLICOU NA DATA BLOQUEADA');
                            e.preventDefault();
                            e.stopImmediatePropagation();
                            Swal.fire({
                                title: 'Atenção!',
                                text: 'Esta data já foi processada e não pode ser desmarcada.',
                                icon: 'warning',
                                confirmButtonText: 'OK'
                            });
                        }, true);
                    }
                }
            },

            onReady: (selectedDates, dateStr, instance) => {
                setTimeout(() => {
                    formatInputTextWithStatus(instance, datasMeiaDiaria);
                }, 0);
            },
            onOpen: function(selectedDates, dateStr, instance) {
                instance.usuarioAbriu = true;
                const campo = document.getElementById('campoMeiaDiaria');
                const campoStatus = document.getElementById('campoStatusMeiaDiaria');
                const check = document.getElementById('meiaDiariacheck');
                if (campo) campo.style.display = 'block';
                if (campoStatus) campoStatus.style.display = 'block';
                if (check) check.checked = true;
            },
            onChange: (selectedDates, dateStr, instance) => {
                if (window.estLimpandoProgramaticamente) {
                    instance._prevSelectedDates = [];
                    return;
                }

                // Lógica de verificação de duplicatas (conflito com Diária Dobrada)
                instance.usuarioAbriu = instance.usuarioAbriu || false;
                if (typeof estaSalvando !== 'undefined' && estaSalvando) {
                    instance._prevSelectedDates = [...selectedDates];
                    return; 
                }
                let duplicateDates = [];
                if (selectedDates.length > 0) {
                    if (window.diariaDobradaPicker) {
                        const datesDiariaDobrada = window.diariaDobradaPicker.selectedDates;
                        for (let i = 0; i < selectedDates.length; i++) {
                            const dataSelecionada = flatpickr.formatDate(selectedDates[i], "Y-m-d");
                            const dataExisteEmDiariaDobrada = datesDiariaDobrada.some(d => flatpickr.formatDate(d, "Y-m-d") === dataSelecionada);
                            if (dataExisteEmDiariaDobrada) {
                                duplicateDates.push(selectedDates[i]);
                            }
                        }
                    }
                }
                
                if (duplicateDates.length > 0) {
                    Swal.fire({
                        title: 'Atenção!',
                        text: `Uma ou mais datas selecionadas já estão em "Diária Dobrada": ${duplicateDates.map(d => flatpickr.formatDate(d, 'd/m/Y')).join(', ')}. Não é possível selecioná-las aqui.`,
                        icon: 'warning',
                        confirmButtonText: 'OK'
                    });
                    
                    const newSelectedDates = instance.selectedDates.filter(date =>
                        !duplicateDates.some(dupDate => dupDate.getTime() === date.getTime())
                    );
                    
                    instance.setDate(newSelectedDates, false);
                    return;
                }

                // Lógica de prevenção de remoção para datas não pendentes
                const previouslySelectedDates = instance._prevSelectedDates || [];
                const datesAttemptedToRemove = previouslySelectedDates.filter(prevDate => 
                    !selectedDates.some(newDate => prevDate.getTime() === newDate.getTime())
                );

                const unauthorizedRemovals = datesAttemptedToRemove.filter(removedDate => {
                    // Formata a data removida para YYYY-MM-DD com segurança
                    const removedDateStr = flatpickr.formatDate(removedDate, 'Y-m-d');
                    
                    // Procura no array original vindo do banco
                    return datasMeiaDiaria.some(d => {
                        // Compara as strings de data diretamente (evita erro de fuso horário do new Date)
                        const isSameDate = d.data === removedDateStr;
                        const isNotPendente = d.status.toLowerCase() !== 'pendente';
                        
                        // Só bloqueia se for a mesma data E o status NÃO for pendente
                        return isSameDate && isNotPendente;
                    });
                });

                

                if (unauthorizedRemovals.length > 0) {
           
                    Swal.fire({
                        title: 'Atenção!',
                        text: `As seguintes datas já foram processadas e não podem ser desmarcadas: ${unauthorizedRemovals.map(d => flatpickr.formatDate(d, 'd/m/Y')).join(', ')}.`,
                        icon: 'warning',
                        confirmButtonText: 'OK'
                    });
                    
                    instance.setDate(previouslySelectedDates, false);
                    return;
                }

                const isPago = verificarSeEstaPago();

                console.log("LOG TESTE - Manual:", instance.usuarioAbriu, "Pago:", isPago);

                if (isPago && instance.usuarioAbriu) {
                    const msg = `Alteração em Meia Diária: ${dateStr}`;                
                    registrarLogPosPagamento(msg);
                   
                }

                // Se a validação passou, atualize a variável para o próximo ciclo
                instance._prevSelectedDates = [...selectedDates];
                formatInputTextWithStatus(instance, datasMeiaDiaria);

            },
            onClose: function(selectedDates, dateStr, instance) {
                setTimeout(() => {
                    formatInputTextWithStatus(instance, datasMeiaDiaria);
                    if (window.diariaDobradaPicker) {
                        formatInputTextWithStatus(window.diariaDobradaPicker, datasDobrada);
                    }
                }, 0);

                document.getElementById('meiaDiariacheck').checked = instance.selectedDates.length > 0;
                updateDisabledDates();
                console.log("Fechando Meia Diária, datas selecionadas:", selectedDates);
                calcularValorTotal();

                setTimeout(() => { 
                    instance.usuarioAbriu = false; 
                    console.log("Flag 'usuarioAbriu' resetada para false");
                }, 1000);
            },
        });
    } else {
        window.meiaDiariaPicker = null; // Garante que a variável seja null se o elemento não for encontrado
        console.warn("Elemento #meiaDiaria não encontrado. Picker de Meia Diária não inicializado.");
    }

    // --- 3. Inicialização do Picker Principal (datasEvento) ---
    let ultimaAcaoCalendario = 'adicao';
    const datasEventoEl = document.querySelector("#datasEvento");

    if (datasEventoEl) {
        window.datasEventoPicker = flatpickr(datasEventoEl, {
            ...commonFlatpickrOptions,
            
            onValueUpdate: function(selectedDates, dateStr, instance) {
                const displayValue = selectedDates.map(d => instance.formatDate(d, 'd/m/Y')).join(', ');
                instance.input.value = displayValue;
            },
            
            onReady: (selectedDates, dateStr, instance) => {
                console.log("🟢 DEBUG: Evento onReady disparado. Flatpickr configurado com sucesso.");
                window.datasEventoNoCalendarioCache = selectedDates.map(d => flatpickr.formatDate(d, 'Y-m-d')).sort();
                if (selectedDates.length > 0 && typeof atualizarContadorEDatas === 'function') {
                    atualizarContadorEDatas(selectedDates);
                }  
            },

            onOpen: function(selectedDates, dateStr, instance) {
                // Adicionando a flag de abertura humana aqui também!
                instance.usuarioAbriu = true;
            },


            onDayCreate: (dObj, dStr, fp, dayElement) => {
                const dataDia = flatpickr.formatDate(dayElement.dateObj, "Y-m-d");
                
                const statusDataDobrada = datasDobrada.find(d => d.data === dataDia);
                const statusDataMeiaDiaria = datasMeiaDiaria.find(d => d.data === dataDia);

                if (statusDataDobrada) {
                    const status = statusDataDobrada.status.toLowerCase();
                    dayElement.classList.add(`status-${status}`);
                    if (status !== 'pendente') {
                        dayElement.classList.add('data-bloqueada');
                        dayElement.style.opacity = '0.6';
                        dayElement.style.cursor = 'not-allowed';
                        dayElement.addEventListener('mousedown', (e) => {
                            console.log('🔴 CLICOU NA DATA BLOQUEADA - Dobrada');
                            e.preventDefault();
                            e.stopImmediatePropagation();
                            Swal.fire({
                                title: 'Atenção!',
                                text: 'Esta data já foi processada e não pode ser desmarcada.',
                                icon: 'warning',
                                confirmButtonText: 'OK'
                            });
                        }, true);
                    }
                } else if (statusDataMeiaDiaria) {
                    const status = statusDataMeiaDiaria.status.toLowerCase();
                    dayElement.classList.add(`status-${status}`);
                    if (status !== 'pendente') {
                        dayElement.classList.add('data-bloqueada');
                        dayElement.style.opacity = '0.6';
                        dayElement.style.cursor = 'not-allowed';
                        dayElement.addEventListener('mousedown', (e) => {
                            console.log('🔴 CLICOU NA DATA BLOQUEADA - Meia Diária');
                            e.preventDefault();
                            e.stopImmediatePropagation();
                            Swal.fire({
                                title: 'Atenção!',
                                text: 'Esta data já foi processada e não pode ser desmarcada.',
                                icon: 'warning',
                                confirmButtonText: 'OK'
                            });
                        }, true);
                    }
                }
            },
            onChange: async function(selectedDates, dateStr, instance) {
                datasEventoSelecionadas = selectedDates; 

                if (isFormLoadedFromDoubleClick) {
                    const datasAtuais = selectedDates.map(d => flatpickr.formatDate(d, "Y-m-d")).sort().join(',');
                    const datasOriginais = (window.datasOriginaisCarregadas || []).slice().sort().join(',');
                    if (datasAtuais !== datasOriginais) {
                        isFormLoadedFromDoubleClick = false;
                        console.log("🔓 Bypass desativado: usuário alterou as datas.");
                    }
                }

                // Limpeza programática: ignora validações e apenas reseta o cache
                if (window.estLimpandoProgramaticamente) {
                    window.datasEventoNoCalendarioCache = [];
                    return;
                }

                console.log("🟢 DEBUG: CHANGE DATAS EVENTO", datasEventoSelecionadas);
                
                const previouslySelectedDates = instance._prevSelectedDates || [];
                
                const datesAttemptedToRemove = previouslySelectedDates.filter(prevDate => 
                    !selectedDates.some(newDate => prevDate.getTime() === newDate.getTime())
                );


                const unauthorizedRemovals = datesAttemptedToRemove.filter(removedDate => {
                    const dataDiaRemovida = flatpickr.formatDate(removedDate, 'Y-m-d');
                    
                    // Verifica se a data está travada na Diária Dobrada
                    const itemDobrada = datasDobrada.find(d => d.data === dataDiaRemovida);
                    // Verifica se a data está travada na Meia Diária
                    const itemMeia = datasMeiaDiaria.find(d => d.data === dataDiaRemovida);
                    
                    const bloqueiaDobrada = itemDobrada && itemDobrada.status.toLowerCase() !== 'pendente';
                    const bloqueiaMeia = itemMeia && itemMeia.status.toLowerCase() !== 'pendente';
                    
                    return bloqueiaDobrada || bloqueiaMeia;
                });


                if (unauthorizedRemovals.length > 0) {
                    instance.close();
                    const isPlural = unauthorizedRemovals.length > 1;
                    const datasFormatadas = unauthorizedRemovals.map(d => flatpickr.formatDate(d, 'd/m/Y')).join(', ');

                    Swal.fire({
                        title: 'Atenção!',
                        text: `${isPlural ? 'As datas' : 'A data'} (${datasFormatadas}) já ${isPlural ? 'foram processadas' : 'foi processada'} e não ${isPlural ? 'podem' : 'pode'} ser ${isPlural ? 'desmarcadas' : 'desmarcada'}.`,
                        icon: 'warning',
                        confirmButtonText: 'OK'
                    });
                    
                    instance.setDate(previouslySelectedDates, false);
                    return;
                }

                const isPago = verificarSeEstaPago();
               
                // 1. Pegamos as datas do calendário no clique atual
                const formatarIso = (d) => flatpickr.formatDate(d, 'Y-m-d');
                const strAtuais = selectedDates.map(formatarIso).sort();

                // ✅ FIX: Se não foi o usuário quem abriu (é um setDate programático),
                // apenas atualiza o cache e sai. Evita falsos positivos de "inserção".
                if (!instance.usuarioAbriu) {
                    window.datasEventoNoCalendarioCache = [...strAtuais];
                    atualizarContadorEDatas(selectedDates);
                    debouncedOnCriteriosChanged();
                    return;
                }

                const strAnteriores = window.datasEventoNoCalendarioCache || [];


                // 3. Comparações ultra precisas
                const removidasArray = strAnteriores.filter(d => !strAtuais.includes(d));
                const inseridasArray = strAtuais.filter(d => !strAnteriores.includes(d));

                const removeuDatas = removidasArray.length > 0;
                const adicionouDatas = inseridasArray.length > 0;

                const acao = removeuDatas && !adicionouDatas ? 'remocao' : 'adicao';
                ultimaAcaoCalendario = acao;

                console.log("=== DEBUG ATÔMICO CORRIGIDO ===");
                console.log("Datas que estavam no calendário (Cache):", strAnteriores);
                console.log("Datas que ficaram no calendário (Atuais):", strAtuais);
                console.log("O que foi de fato REMOVIDO:", removidasArray);
                console.log("O que foi de fato INSERIDO:", inseridasArray);
                console.log("Pago:", isPago);
                console.log("Adicionou Datas:", adicionouDatas);
                console.log("Removeu Datas:", removeuDatas);
                console.log("======================");


                 if (isPago && instance.usuarioAbriu && (adicionouDatas || removeuDatas)) {

                    instance.close(); // Fecha o calendário principal

                    const labelVermelha = (texto) => `<span style="color: #ff0000; font-weight: bold;">${texto}</span>`;
                    
                    const statusPgtoBanco = (window.statusPgtoCacheOriginalDoBanco || "").trim().toLowerCase();
                    const statusPgtoAjudaBanco = (window.statusPgtoAjudaOriginalDoBanco || "").trim().toLowerCase();
                    
                    // 1. Definimos o título do alerta com base no status do banco
                    let labelTexto = statusPgtoBanco === "pago" 
                        ? (statusPgtoAjudaBanco === "pago" ? "Cachê e Ajuda de Custo PAGOS" : "Cachê PAGO") 
                        : "Ajuda de Custo PAGA";
                        
                    // 2. Criamos o texto dinâmico da ação (Adicionando ou Removendo)
                    let textoAcao = "";
                   if (removeuDatas) {
                        const datasRemovidasStr = removidasArray
                            .map(d => {
                                const [y, m, dia] = d.split('-');
                                return `${dia}/${m}/${y}`;
                            })
                            .join(', ');
                        textoAcao = `Você está <b>removendo</b> as datas [<b>${datasRemovidasStr}</b>] do evento.`;
                    } else if (adicionouDatas) {
                        const datasInseridassStr = inseridasArray
                            .map(d => {
                                const [y, m, dia] = d.split('-');
                                return `${dia}/${m}/${y}`;
                            })
                            .join(', ');
                        textoAcao = `Você está <b>adicionando</b> as datas [<b>${datasInseridassStr}</b>] ao período do evento.`;
                    }

                    // 3. O SEU PULO DO GATO: Regra específica para quando SÓ a ajuda de custo está paga
                    let textoCompensacaoCache = "";
                    const apenasAjudaEstaPaga = statusPgtoAjudaBanco === "pago" && statusPgtoBanco !== "pago";

                    if (apenasAjudaEstaPaga) {
                        if (adicionouDatas) {
                            textoCompensacaoCache = `<br>Como a Ajuda de Custo já está paga, a diferença do valor das novas datas será <b>acrescentada</b> no saldo do Cachê.`;
                        } else if (removeuDatas) {
                            textoCompensacaoCache = `<br>Como a Ajuda de Custo já está paga, a diferença do valor das datas retiradas será <b>removida</b> do saldo do Cachê.`;
                        }
                    }

                    // 4. Montagem final do HTML
                    const htmlConteudo = `<b>Alerta:</b> ${labelVermelha(labelTexto)}<br><br>` +
                        `${textoAcao}<br>` +
                        `Como já existem valores pagos, essa ação causará divergência no fechamento financeiro.` +
                        `${textoCompensacaoCache}<br><br>` +
                        `Deseja continuar com a alteração?`;

                    // 5. Chamada do Swal de validação (mantém igual ao anterior)
                    const sucesso = await validarAlteracaoPosPagamento(
                        `⚠️ Alterar Datas do Evento`,
                        htmlConteudo,
                        dateStr, 
                        "Datas Anteriores", 
                        "Datas Atualizadas",
                        "Alteração de Datas",
                        removidasArray, // 👈 PASSANDO AQUI O QUE FOI REMOVIDO
                        inseridasArray
                    );

                   
                    if (!sucesso) {
                            // Se o usuário cancelou, voltamos o calendário para o estado anterior usando o cache!
                        const datasAnterioresObj = strAnteriores.map(d => new Date(d + 'T12:00:00')); // T12:00:00 evita bugs de fuso
                        instance.setDate(datasAnterioresObj, false);

                        if (typeof atualizarContadorEDatas === 'function') {
                            atualizarContadorEDatas(datasAnterioresObj);
                        }
                        
                        if (typeof calcularValorTotal === 'function') {
                            calcularValorTotal(); // Isso faz o valor voltar ao que era antes
                        }
                        return;
                    }
                    
                    if (typeof calcularValorTotal === 'function') calcularValorTotal();
                    
                    Swal.fire({
                        title: 'Cálculo Atualizado!',
                        html: 'O total foi recalculado com as novas regras.<br>Clique em <b>ENVIAR</b> para gravar as alterações.',
                        icon: 'success'
                    });
                }               
   

                window.datasEventoNoCalendarioCache = [...strAtuais];
                if (typeof calcularValorTotal === 'function') calcularValorTotal();
                atualizarContadorEDatas(selectedDates);
                console.log("DEBUG ATÔMICO: Chamando debouncedOnCriteriosChanged do onChange."); 
                //debouncedOnCriteriosChanged();
            },

            onClose: function(selectedDates, dateStr, instance) {
                console.log(" 🟢 DEBUG ATÔMICO: Evento onClose disparado."); 
                console.log("📅 Calendário fechado. Disparando validação final.");
                
                
                
                console.log("Datas selecionadas:", selectedDates); 
                console.log("Fechando Datas Evento, datas selecionadas:", selectedDates);
                atualizarContadorEDatas(selectedDates);

                setTimeout(() => { 
                    instance.usuarioAbriu = false; 
                    console.log("Flag 'usuarioAbriu' (Datas Evento) resetada");
                }, 1000);
            }      
        }); 
    } else {
        window.datasEventoPicker = null; // Garante que a variável seja null se o elemento não for encontrado
        console.warn("Elemento #datasEvento não encontrado. Picker de Datas Evento não inicializado.");
    }
    
    // --- LÓGICA DE BLOQUEIO DE ABERTURA ---
    function createBlockHandler(instance) {
        return function(event) {
            if (instance && instance.isOpen) {
                console.log("PASSOU NO BLOQUEIO: Calendário já está aberto. Permitindo fechar.");
                return; 
            }
            
            if (event.detail === 0) return; 

            console.log("ENTRANDO NA INTERCEPTAÇÃO MOUSE DOWN FINAL (Toggle/AltInput)");

            const campoVazio = validarCamposAntesDoPeriodo(); 
            console.log("Campo Vazio Retornado:", campoVazio);
            if (typeof campoVazio === 'string' && campoVazio.trim() !== '') {
                event.preventDefault(); 
                event.stopPropagation();
                
                if (instance && instance.isOpen) {
                    instance.close();
                }
                
                const elementsMap = {
                    'Funcionário': document.getElementById('nmFuncionario'),
                    'Função': document.getElementById('descFuncao'),          
                    'Local Montagem': document.getElementById('nmLocalMontagem'),    
                    'Cliente': document.getElementById('nmCliente'),
                    'Evento': document.getElementById('nmEvento'),
                };

                Swal.fire({
                    icon: 'warning',
                    title: 'Preenchimento Pendente',
                    html: `Por favor, preencha o campo **${campoVazio}** antes de selecionar o período do evento.`,
                    confirmButtonText: 'Entendi'
                }).then(() => {
                    if (campoVazio !== 'Nível de Experiência') {
                        const campoElement = elementsMap[campoVazio];
                        if (campoElement) {
                            campoElement.focus();
                        }
                    }else {
                        const primeiraCheck = document.getElementById('seniorCheck');
                        if (primeiraCheck) {
                            primeiraCheck.focus();
                        }
                    }
                });
                return; 
            }
        };
    }
    
    // Aplicação dos Listeners, AGORA CONDICIONAL À EXISTÊNCIA DA INSTÂNCIA
    if (window.datasEventoPicker) { 
        const handler = createBlockHandler(window.datasEventoPicker);
        const altInput = window.datasEventoPicker.altInput;

        if (altInput) {
            const parentElement = altInput.parentElement;
            
            if (parentElement) {
                parentElement.addEventListener('mousedown', handler, true);
                console.log("Listener MOUSE DOWN aplicado no elemento PAI do input.");
            }
            
            altInput.addEventListener('mousedown', handler, true);
            
            const toggleButton = window.datasEventoPicker.toggle;
            if (toggleButton && typeof toggleButton.addEventListener === 'function') {
                toggleButton.addEventListener('mousedown', handler, true);
            }
        }
    }
}


async function validarAlteracaoPosPagamento(titulo, htmlConteudo, formattedDate, statusOriginal, novoStatus, tipoDiaria, removidosArray = [], inseridosArray = []) {
    // ETAPA 1: Justificativa
    const { value: justificativa } = await Swal.fire({
        title: titulo,
        html: htmlConteudo,
        input: 'textarea',
        inputLabel: 'Justificativa da alteração:',
        inputPlaceholder: 'Por que alterar esta data específica?',
        showCancelButton: true,
        confirmButtonText: 'Próximo',
        cancelButtonColor: '#d33',
        inputValidator: (value) => { if (!value) return 'Justificativa obrigatória!'; }
    });

    if (justificativa) {
        // ETAPA 2: Confirmação final
        const confirmacao = await Swal.fire({
            title: 'Confirmar Alteração?',
            text: `Esta ação será registrada no log do sistema.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sim, aplicar'
        });

        if (confirmacao.isConfirmed) {
            let msgLog = "";

            // Função simples para converter AAAA-MM-DD para DD/MM/AAAA no log
            const formatarParaPTBR = (dataStr) => {
                if (!dataStr) return '';
                const partes = dataStr.split('-');
                if (partes.length === 3) {
                    return `${partes[2]}/${partes[1]}/${partes[0]}`;
                }
                return dataStr; 
            };

            // SE FOR ALTERAÇÃO DE DATAS DO EVENTO
            if (tipoDiaria === "Alteração de Datas") {
                
                let detalhesDatas = [];
                
                // Formatação e verificação de remoções (usando o parâmetro recebido)
                if (removidosArray.length > 0) {
                    const removidasFormatadas = removidosArray.map(d => formatarParaPTBR(d)).join(', ');
                    detalhesDatas.push(`Data(s) removida(s): ${removidasFormatadas}`);
                }
                
                // Formatação e verificação de inserções (usando o parâmetro recebido)
                if (inseridosArray.length > 0) {
                    const inseridasFormatadas = inseridosArray.map(d => formatarParaPTBR(d)).join(', ');
                    detalhesDatas.push(`Data(s) inserida(s): ${inseridasFormatadas}`);
                }

                // Junta tudo em uma string coerente
                const resumoAlteracoes = detalhesDatas.length > 0 ? detalhesDatas.join(' | ') : `Datas atuais: ${formattedDate}`;

                msgLog = `${tipoDiaria}: ${resumoAlteracoes} - Motivo: ${justificativa}`;

            } else {
                // Para os outros pickers (Dobrada, Meia Diária) mantém o padrão que você já usava
                msgLog = `Alteração em ${tipoDiaria}: ${formattedDate} (${statusOriginal} -> ${novoStatus}) - Motivo: ${justificativa}`;
            }
            
            console.log("Chamando registrarLogPosPagamento com a msg:", msgLog);
            
            // CHAMA O REGISTRO DO LOG
            registrarLogPosPagamento(msgLog);
            
            return true; 
        }
    }
    return false; 
}

function converterDatasParaFlatpickr(datasRecebidas) {
    if (!datasRecebidas || datasRecebidas.length === 0) {
        return [];
    }
    // Substitui barras por hifens. Se já for hifen, não muda.
    return datasRecebidas.map(dataStr => {
        // Usa uma Expressão Regular para substituir todas as barras por hifens.
        return dataStr.replace(/\//g, '-');
    });
}


function atualizarContadorEDatas(selectedDates) {

    console.log("ENTROU NO ATUALIZARCONTADOREDATAS");
    
    // 🌟 NOVA LINHA DE CORREÇÃO: Mapeia para garantir que todas as entradas sejam objetos Date válidos
    const validDates = selectedDates.map(date => {
        // Se já for um objeto Date, retorna. Se for string, tenta converter.
        // O Flatpickr espera objetos Date ou strings YYYY-MM-DD.
        // Se estivermos 100% seguros de que selectedDates só contém Date objects, esta linha é redundante,
        // mas adiciona segurança.
        return date instanceof Date && !isNaN(date) ? date : new Date(date);
    }).filter(date => date instanceof Date && !isNaN(date)); // Filtra datas inválidas

    // ... (Seção 1. Atualização do Contador - Use selectedDates.length ou validDates.length) ...
    const contador = document.getElementById('contadorDatas');
    if (contador) {
        contador.innerText = validDates.length === 0
            ? 'Nenhuma data selecionada'
            : `${validDates.length} ${validDates.length === 1 ? 'Diária Selecionada' : 'Diárias'}`;

            console.log(`[atualizarContadorEDatas] Texto do contador alterado para: ${contador.innerText}`);
    }

    // if (contador) {
    //     // ESSA LINHA PRECISA EXECUTAR PARA DISPARAR O OBSERVER
    //     contador.innerText = selectedDates.length === 0 
    //         ? 'Nenhuma data selecionada'
    //         : `${selectedDates.length} ${selectedDates.length === 1 ? 'Diária Selecionada' : 'Diárias'}`;
        
    //     console.log(`[atualizarContadorEDatas] Texto do contador alterado para: ${contador.innerText}`);
    // }

    // 2. Sincronização da Diária Dobrada (CORRIGIDO)
    if (window.diariaDobradaPicker) {
        try {
            // Usa validDates para o set('enable', ...)
            window.diariaDobradaPicker.set('enable', validDates); 
            
            // Filtra as datas selecionadas anteriormente que não estão mais no evento principal
            window.diariaDobradaPicker.setDate(
                window.diariaDobradaPicker.selectedDates.filter(date => validDates.some(d => d.getTime() === date.getTime())),
                false
            );
            
            if (typeof formatInputTextWithStatus === 'function') {
                formatInputTextWithStatus(window.diariaDobradaPicker, datasDobrada);
            }
        } catch (e) {
            console.error("❌ Erro ao sincronizar Diária Dobrada (Staff.js:1137):", e);
        }
    }

    // 3. Sincronização da Meia Diária (CORRIGIDO)
    if (window.meiaDiariaPicker) {
        try {
            // Usa validDates para o set('enable', ...)
            window.meiaDiariaPicker.set('enable', validDates);
            
            // Filtra as datas selecionadas anteriormente que não estão mais no evento principal
            window.meiaDiariaPicker.setDate(
                window.meiaDiariaPicker.selectedDates.filter(date => validDates.some(d => d.getTime() === date.getTime())),
                false
            );
            
            if (typeof formatInputTextWithStatus === 'function') {
                formatInputTextWithStatus(window.meiaDiariaPicker, datasMeiaDiaria);
            }
        } catch (e) {
            console.error("❌ Erro ao sincronizar Meia Diária:", e);
        }
    }
}

function inicializarFlatpickrsGlobais(datasDoEvento = []) {
    console.log("Inicializando Flatpickr para todos os campos de data...");

    // Obtenha as instâncias dos elementos
    const elementDatasEvento = document.getElementById('datasEvento');
    const elementDiariaDobrada = document.getElementById('diariaDobrada');
    const elementMeiaDiaria = document.getElementById('meiaDiaria');

    // **Inicialização do Picker Principal (datasEvento)**
    if (elementDatasEvento && !elementDatasEvento._flatpickr) {
        window.datasEventoPicker = flatpickr(elementDatasEvento, {
            mode: "multiple",
            dateFormat: "Y-m-d",
            defaultDate: datasDoEvento, // Define as datas iniciais
            onChange: function(selectedDates) {
                // Chama a função centralizada para atualizar a contagem e as datas
                atualizarContadorEDatas(selectedDates);
            },
        });
    }

    // **Inicialização da Diária Dobrada**
    if (elementDiariaDobrada && !elementDiariaDobrada._flatpickr) {
        window.diariaDobradaPicker = flatpickr(elementDiariaDobrada, {
            mode: "multiple",
            dateFormat: "Y-m-d",
            enable: datasDoEvento, // PASSO CRUCIAL: Habilita apenas as datas do evento
            onChange: (selectedDates) => {
                // Sua lógica existente de formatação do texto
                // e checagem de duplicatas
            },
        });
    }

    // **Inicialização da Meia Diária**
    if (elementMeiaDiaria && !elementMeiaDiaria._flatpickr) {
        window.meiaDiariaPicker = flatpickr(elementMeiaDiaria, {
            mode: "multiple",
            dateFormat: "Y-m-d",
            enable: datasDoEvento, // PASSO CRUCIAL: Habilita apenas as datas do evento
            onChange: (selectedDates) => {
                // Sua lógica existente de formatação do texto
                // e checagem de duplicatas
            },
        });
    }
}




if (typeof window.StaffOriginal === "undefined") {
    window.StaffOriginal = {
        idStaff: "",
        avaliacao: "",
        idFuncionario: "",
        nmFuncionario: "",
        perfilFuncionario: "",
        descFuncao: "",
        vlrCusto: "",
        ajusteCusto: "",
        transporte: "",
        alimentacao: "",
        caixinha: "",
        descBeneficio: "",
        idCliente: "",
        nmCliente: "",
        idEvento: "",
        nmEvento: "",        
        idLocalMontagem: "",
        nmLocalMontagem: "",
        datasEventos: "",
        diariaDobrada: "",
        ajusteCusto: "",
        vlrTotal: "",
        nmPavilhao: "",

        // 📎 Comprovantes PDF
        comprovanteCache: "",
        comprovanteAjdCusto: "",
        comprovanteCaixinha: "",
        comprovanteContGastos: "",
        setor: "",
        statusPgto: "",
        nivelExperiencia: "",
        idequipe: "",
        nmequipe: ""
    };
}


let eventsTableBody = document.querySelector('#eventsDataTable tbody');
let noResultsMessage = document.getElementById('noResultsMessage');
let idFuncionarioHiddenInput = document.getElementById('idFuncionario');
let apelidoFuncionarioInput = document.getElementById("apelidoFuncionario");
let perfilFuncionarioInput = document.getElementById("perfilFuncionario");
let previewFotoImg = document.getElementById('previewFoto');
let fileNameSpan = document.getElementById('fileName');
let uploadHeaderDiv = document.getElementById('uploadHeader');
let fileInput = document.getElementById('file');
let avaliacaoSelect = document.getElementById('avaliacao');
let tarjaDiv = document.getElementById('tarjaAvaliacao');
 
let idStaffInput = document.getElementById('idStaff');
let idStaffEventoInput = document.getElementById('idStaffEvento');
let idFuncaoInput = document.getElementById('idFuncao');
let descFuncaoSelect = document.getElementById('descFuncao');
let vlrCustoInput = document.getElementById('vlrCusto');
let ajusteCustoInput = document.getElementById('ajusteCusto');
let transporteInput = document.getElementById('transporte');
let alimentacaoInput = document.getElementById('alimentacao');
let statusPgtoAjudaCustoInput = document.getElementById('statusPgtoAjudaCusto');
let caixinhaInput = document.getElementById('caixinha');
let descBeneficioTextarea = document.getElementById('descBeneficio');
let nmLocalMontagemSelect = document.getElementById('nmLocalMontagem');
let nmPavilhaoSelect = document.getElementById('nmPavilhao');
let idClienteInput = document.getElementById('idCliente');
let nmClienteSelect = document.getElementById('nmCliente');
let idEventoInput = document.getElementById('idEvento');
let nmEventoSelect = document.getElementById('nmEvento');
let datasEventoInput = document.getElementById('datasEvento');
 
let ajusteCustocheck = document.getElementById('ajusteCustocheck');
let campoAjusteCusto = document.getElementById('campoAjusteCusto');
let ajusteCustoTextarea = document.getElementById('descAjusteCusto');
let campoStatusajusteCusto = document.getElementById('campoStatusAjusteCusto');
let statusAjusteCustoInput = document.getElementById('statusAjusteCusto');
let selectStatusAjusteCusto = document.getElementById('selectStatusAjusteCusto');
let statusAnteriorAjusteCusto = '';
 
let vlrTotalInput = document.getElementById('vlrTotal');
let vlrTotalCacheInput = document.getElementById('vlrTotalCache');
let vlrTotalAjdCustoInput = document.getElementById('vlrTotalAjdCusto');
 
let caixinhacheck = document.getElementById('Caixinhacheck');
let campoCaixinha = document.getElementById('campoCaixinha');
let campoPgtoCaixinha = document.getElementById('campoPgtoCaixinha');
let descCaixinhaTextarea = document.getElementById('descCaixinha');
let campoStatusCaixinha = document.getElementById('campoStatusCaixinha');
let statusCaixinhaInput = document.getElementById('statusCaixinha');
let selectStatusCaixinha = document.getElementById('selectStatusCaixinha');
let statusPgtoCaixinhaInput = document.getElementById('statusPgtoCaixinha');
let statusAnteriorCaixinha = '';

 
let setorInput = document.getElementById('setor');
let statusPagtoInput = document.getElementById('statusPgto');
 
 
let diariaDobradaInput = document.getElementById('diariaDobrada');
let diariaDobradacheck = document.getElementById('diariaDobradacheck');
let campoDiariaDobrada = document.getElementById('campoDiariaDobrada');
let descDiariaDobradaTextarea = document.getElementById('descDiariaDobrada');
let campoStatusDiariaDobrada = document.getElementById('campoStatusDiariaDobrada');
let statusDiariaDobradaInput = document.getElementById('statusDiariaDobrada');
 
let meiaDiariaInput = document.getElementById('meiaDiaria');
let meiaDiariacheck = document.getElementById('meiaDiariacheck');
let campoMeiaDiaria = document.getElementById('campoMeiaDiaria');
let descMeiaDiariaTextarea = document.getElementById('descMeiaDiaria');
let descCustoFechadoTextarea = document.getElementById('descCustoFechado');
let campoStatusMeiaDiaria = document.getElementById('campoStatusMeiaDiaria');
let statusMeiaDiariaInput = document.getElementById('statusMeiaDiaria');
 
let containerDiariaDobradaCheck = document.querySelector('#diariaDobradacheck').closest('.input-container-checkbox');
let containerMeiaDiariacheck = document.querySelector('#meiaDiariacheck').closest('.input-container-checkbox');
let containerStatusDiariaDobrada = document.getElementById('containerStatusDiariaDobrada');
let containerStatusMeiaDiaria = document.getElementById('containerStatusMeiaDiaria');
 
let check50 = document.getElementById('check50');
let check100 = document.getElementById('check100');
 
let container1 = document.getElementById('labelFileAjdCusto').parentElement;
let container2 = document.getElementById('labelFileAjdCusto2').parentElement;
let mensagemConcluido = document.getElementById('mensagemConcluido');
 
let seniorCheck = document.getElementById('Seniorcheck');
let seniorCheck2 = document.getElementById('Seniorcheck2');
let plenoCheck = document.getElementById('Plenocheck');
let juniorCheck = document.getElementById('Juniorcheck');
let baseCheck = document.getElementById('Basecheck');
let fechadoCheck = document.getElementById('Fechadocheck');
let liberadoCheck =  document.getElementById('Liberadocheck');
let statusAnteriorCustoFechado = '';
 
let qtdPessoasInput = document.getElementById('qtdPessoas');
 
let idEquipeInput = document.getElementById('idEquipe');
let nmEquipeSelect = document.getElementById('nmEquipe');

let viagem1Check = document.getElementById('viagem1Check');
let viagem2Check = document.getElementById('viagem2Check');
let viagem3Check = document.getElementById('viagem3Check');

let DescViagem1 = "[Viagem Fora SP] Valor Alimentação referente a Almoço e Jantar por ser fora de São Paulo"; 
let DescViagem2 = "[Viagem Fora SP] Valor Alimentação referente a Café da Manhã, Almoço e Jantar por ser fora de São Paulo"; 
let DescViagem3 = "[Viagem Fora SP] Valor Alimentação e Transporte para Funcionário Local";


window.flatpickrInstances = {
    diariaDobrada: diariaDobradaPicker,
    meiaDiaria: meiaDiariaPicker,
    datasEvento: datasEventoPicker,
};

function atualizarLayout() {
    // Esconde tudo por padrão
    container1.style.display = 'none';
    container2.style.display = 'none';

    // Lógica para mostrar o que precisa, baseada no estado dos checkboxes
    if (check100.checked) {
        container1.style.display = 'flex'; // Mostra o campo de 100%
    } else if (check50.checked) {
        container2.style.display = 'flex'; // Mostra o campo de 50%
    }

    if (!check50.checked && !check100.checked) {
        container2.style.display = 'none'; // Esconde o campo de 50%
        container1.style.display = 'none'; // Esconde o campo de 100%
    }
}

// const alternarBloqueioFlatpickr = (instancia, bloquear) => {
//     if (!instancia) return;
    
//     if (bloquear) {
//         if (instancia.input) instancia.input.readOnly = true;
//         if (instancia._input) instancia._input.disabled = true;
//         instancia.close();
//         instancia.input.style.pointerEvents = 'none';
//         instancia.input.style.backgroundColor = '#f2f2f2'; // Estética de bloqueado
//     } else {
//         if (instancia.input) instancia.input.readOnly = false;
//         if (instancia._input) instancia._input.disabled = false;
//         instancia.input.style.pointerEvents = 'auto';
//         instancia.input.style.backgroundColor = ''; 
//     }
// };

function verificarBloqueioAlteracaoDatas() {
    const statuspgto = (document.getElementById('statusPgto')?.value || '').trim().toUpperCase();
    const statuspgtoajdcto = (document.getElementById('statusPgtoAjudaCusto')?.value || '').trim().toUpperCase();

    let mensagem = null;

    if (statuspgto === 'PAGO') {
        mensagem = 'Não é possível alterar as datas pois o <strong>Cachê já foi Pago</strong>.';
    } else if (statuspgtoajdcto === 'PAGO' || statuspgtoajdcto === 'PAGO50') {
        mensagem = 'Não é possível alterar as datas pois a <strong>Ajuda de Custo já foi Paga</strong>.';
    }

    if (mensagem) {
        // Bloqueia os três pickers usando a função existente
        alternarBloqueioFlatpickr(window.datasEventoPicker, true);
        alternarBloqueioFlatpickr(window.diariaDobradaPicker, true);
        alternarBloqueioFlatpickr(window.meiaDiariaPicker, true);

        Swal.fire({
            icon: 'warning',
            title: 'Alteração Bloqueada!',
            html: mensagem,
            confirmButtonText: 'Entendido'
        });
        return true;
    }

    return false;
}

const alternarBloqueioFlatpickr = (instancia, bloquear) => {
    if (!instancia || !instancia.input) return;

    // Trava de segurança: Se o input tiver o atributo 'data-permanent-readonly' 
    // ou se ele for um campo que NUNCA deve ser editado, saímos da função.
    if (instancia.input.hasAttribute('data-permanent-readonly') || instancia.input.getAttribute('readonly') === 'true') {
        // Se o campo for permanentemente readonly, garantimos que ele fique bloqueado
        instancia.input.readOnly = true;
        instancia.input.style.pointerEvents = 'none';
        return; 
    }
    
    if (bloquear) {
        instancia.input.readOnly = true;
        if (instancia._input) instancia._input.disabled = true;
        instancia.close();
        instancia.input.style.pointerEvents = 'none';
        instancia.input.style.backgroundColor = '#f2f2f2';
    } else {
        // Só desbloqueia se NÃO for um campo marcado como permanentemente bloqueado
        instancia.input.readOnly = false;
        if (instancia._input) instancia._input.disabled = false;
        instancia.input.style.pointerEvents = 'auto';
        instancia.input.style.backgroundColor = ''; 
    }
};

function bloquearFormularioVisualizacao(motivo, tipo) {
    // Banner visual
    const banner = document.getElementById('bannerBloqueio');
    if (banner) {
        const config = {
            deletado: { bg: '#cc0000', icone: '🚫', texto: `REGISTRO DELETADO — ${motivo}` },
            pendente: { bg: '#e67e22', icone: '⏳', texto: `AGUARDANDO APROVAÇÃO — ${motivo}` },
            inativo: { bg: '#7f8c8d', icone: '🔒', texto: `REGISTRO INATIVO — ${motivo}` },
        };
        const { bg, icone, texto } = config[tipo] || config.pendente;
        banner.innerHTML = `${icone} ${texto}`;
        banner.style.cssText = `
            display: block;
            background: ${bg};
            color: #fff;
            font-weight: bold;
            font-size: 0.85rem;
            padding: 8px 14px;
            border-radius: 4px;
            margin-bottom: 10px;
            letter-spacing: 0.4px;
        `;
    }

    // Flatpickrs — usa função existente + força clickOpens false
    [window.datasEventoPicker, window.diariaDobradaPicker, window.meiaDiariaPicker].forEach(picker => {
        if (!picker) return;
        alternarBloqueioFlatpickr(picker, true);
        picker.set('clickOpens', false); // ← impede abertura pelo ícone também
        picker.close();                  // ← fecha se estiver aberto
    });

    // Botão Enviar
    const btnEnviar = document.getElementById('Enviar');
    if (btnEnviar) {

        if (btnEnviar.getAttribute('data-modo') === 'comprovante') return;
        btnEnviar.disabled = true;
        btnEnviar.style.opacity = '0.5';
        btnEnviar.style.cursor = 'not-allowed';
        btnEnviar.style.pointerEvents = 'none';
        btnEnviar.setAttribute('data-bloqueado', 'true');
    }
}

function desbloquearFormulario() {
    const banner = document.getElementById('bannerBloqueio');
    if (banner) { banner.style.display = 'none'; banner.innerHTML = ''; }

    [window.datasEventoPicker, window.diariaDobradaPicker, window.meiaDiariaPicker].forEach(picker => {
        if (!picker) return;
        alternarBloqueioFlatpickr(picker, false);
        picker.set('clickOpens', true); // ← restaura abertura normal
    });

    const btnEnviar = document.getElementById('Enviar');
    if (btnEnviar) {
        btnEnviar.disabled = false;
        btnEnviar.style.opacity = '';
        btnEnviar.style.cursor = '';
        btnEnviar.style.pointerEvents = ''; // ← RESTAURA
        btnEnviar.removeAttribute('data-bloqueado'); // ← remove flag
        btnEnviar.removeAttribute('data-modo');
    }
}

const carregarDadosParaEditar = (eventData, bloquear) => {
    console.log('🔴 carregarDadosParaEditar CHAMADO - currentEditingStaffEvent será setado!');
    console.trace(); // Mostra a pilha completa de quem chamou

    const btn = document.getElementById('Enviar');
    const fieldsetEvento = document.getElementById('containerFieldsets');

    const containerObsPosPgto = document.getElementById('containerObsPosPgto');
    const obsPosPgtoTextarea = document.getElementById('obsPosPgto');
    const obsGeralTextarea = document.getElementById('obsGeral');
    
    // 1. Lógica do Botão Enviar
    if (btn) {
        const precisaComprovante = verificarNecessidadeComprovante(eventData);
        if (bloquear && !precisaComprovante) {
            btn.style.display = 'none';
            btn.disabled = true;
        } else {
            btn.style.display = 'block';
            btn.disabled = false;
        }
    }

    // 2. Travamento de campos
    if (fieldsetEvento) {
        const camposParaTravar = fieldsetEvento.querySelectorAll('input:not([type="file"]), select, textarea');
        camposParaTravar.forEach(campo => {
            if (campo.hasAttribute('data-permanent-readonly')) {
                campo.readOnly = true;
                campo.style.cursor = 'default';
                return;
            }
            if (campo.id === 'check50' || campo.id === 'check100') return;

            if (bloquear) {
                campo.readOnly = true; 
                if (campo.tagName === 'SELECT' || campo.type === 'checkbox') campo.disabled = true;
                campo.style.cursor = 'not-allowed';
            } else {
                campo.readOnly = false;
                campo.disabled = false;
                campo.style.backgroundColor = '';
                campo.style.cursor = '';
            }
        });
    }

    configurarUploadsFinanceiro(eventData);

    // Cache para calcularValorTotal saber se deve abortar ou recalcular
    window.currentEventDataCache = {
        vlrtotcache: parseFloat(eventData.vlrtotcache || 0),
        vlrtotajdcusto: parseFloat(eventData.vlrtotajdcusto || 0)
    };

    retornoDados = true;
    limparCamposEvento();
    //currentEditingStaffEvent = eventData; 
    
    currentEditingStaffEvent = JSON.parse(JSON.stringify(eventData));

    console.log("Dados do evento a serem carregados no formulário:", eventData);

    // ATIVA A TRAVA DE CARREGAMENTO
    isFormLoadedFromDoubleClick = true;

    const uploadHeaderDiv = document.getElementById('uploadHeader');
    const uploadContainer = document.querySelector("#upload-container");
    const fileInput = document.getElementById('file');

    if (uploadHeaderDiv) uploadHeaderDiv.style.display = 'none';
    if (uploadContainer) uploadContainer.style.display = 'none';
    if (fileInput) fileInput.disabled = true;

    // IDs e Dados Básicos
    idStaffInput.value = eventData.idstaff || '';
    idStaffEventoInput.value = eventData.idstaffevento;
    idFuncaoInput.value = eventData.idfuncao;
    idClienteInput.value = eventData.idcliente;
    idEventoInput.value = eventData.idevento;
    idFuncionarioHiddenInput.value = eventData.idfuncionario || '';   
    idEquipeInput.value = eventData.idequipe || '';

    console.log("ID da Equipe:", idEquipeInput.value);

    // Checks de Viagem
    const valorAjudaCustoViagem = eventData.tipoajudacustoviagem;
    document.getElementById('viagem1Check').checked = (valorAjudaCustoViagem === 1);
    document.getElementById('viagem2Check').checked = (valorAjudaCustoViagem === 2);
    document.getElementById('viagem3Check').checked = (valorAjudaCustoViagem === 3);

    // Containers Diária Dobrada e Meia Diária
    if (containerDiariaDobradaCheck) {
        containerDiariaDobradaCheck.style.display = 'block';
        containerStatusDiariaDobrada.style.display = 'block';
    }
    if (containerMeiaDiariacheck) {
        containerMeiaDiariacheck.style.display = 'block';
        containerStatusMeiaDiaria.style.display = 'block';
    }

    // Recarga de Função e Custos Globais
    if (descFuncaoSelect) {
        descFuncaoSelect.value = eventData.idfuncao || '';
        const selectedOption = descFuncaoSelect.options[descFuncaoSelect.selectedIndex];
        if (selectedOption) {
            console.log("📥 Recarregando custos da função para permitir troca de nível...");
            vlrCustoSeniorFuncao  = parseFloat(selectedOption.getAttribute("data-ctosenior")) || 0;
            vlrCustoSeniorFuncao2 = parseFloat(selectedOption.getAttribute("data-ctosenior2")) || 0;
            vlrCustoPlenoFuncao   = parseFloat(selectedOption.getAttribute("data-ctopleno")) || 0;
            vlrCustoJuniorFuncao  = parseFloat(selectedOption.getAttribute("data-ctojunior")) || 0;
            vlrCustoBaseFuncao    = parseFloat(selectedOption.getAttribute("data-ctobase")) || 0;
            vlrCustoSeniorFuncao2 = vlrCustoSeniorFuncao; 
            vlrAlimentacaoFuncao  = parseFloat(selectedOption.getAttribute("data-alimentacao")) || 0;
            vlrTransporteFuncao   = parseFloat(selectedOption.getAttribute("data-transporte")) || 0;

            vlrAlimentacaoDobra  = parseFloat(selectedOption.getAttribute("data-alimentacao")) || 0;
           

            const descFuncaoTexto = selectedOption.textContent.trim().toUpperCase();

            if (descFuncaoTexto === "AJUDANTE DE MARCAÇÃO") {
                if (seniorCheck) seniorCheck.disabled = true;
                if (seniorCheck2) seniorCheck2.disabled = true;
                if (plenoCheck)  plenoCheck.disabled = true;
                if (juniorCheck) juniorCheck.disabled = true;
                if (baseCheck)   baseCheck.disabled = false;                
            }

            if (descFuncaoTexto === "FISCAL DE MARCAÇÃO") {
                const inputSenior2 = document.getElementById("Seniorcheck2");
                const divPaiSenior2 = inputSenior2 ? inputSenior2.closest('.Vertical') : null;
                if (divPaiSenior2) divPaiSenior2.style.setProperty("display", "flex", "important");
            }
        }
    }

    if (nmClienteSelect) nmClienteSelect.value = eventData.idcliente || '';
    if (nmEventoSelect) nmEventoSelect.value = eventData.idevento || '';

    const equipeId = eventData.idequipe || '';
    const nomeEquipe = eventData.nmequipe || 'Equipe não informada'; 
    if (nmEquipeSelect) nmEquipeSelect.value = nomeEquipe; 
    console.log("ID da Equipe:", equipeId);
    console.log("Nome da Equipe (nmEquipe):", nomeEquipe); 

    // Lógica de Pavilhão/Montagem
    if (nmLocalMontagemSelect) {
        nmLocalMontagemSelect.value = eventData.idmontagem || '';
        nmLocalMontagemSelect.dispatchEvent(new Event('change'));        
        setTimeout(() => {
            const nmPavilhaoSelect = document.getElementById('nmPavilhao');
            const inputHiddenPavilhao = document.getElementById('idPavilhao');
            if (nmPavilhaoSelect) {
                const historicalPavilhaoString = eventData.pavilhao || '';
                const savedPavilhaoNames = historicalPavilhaoString
                    .split(',')
                    .map(name => name.trim().toUpperCase())
                    .filter(name => name.length > 0); 
                Array.from(nmPavilhaoSelect.options).forEach(option => { option.selected = false; });
                for (let i = 0; i < nmPavilhaoSelect.options.length; i++) {
                    const option = nmPavilhaoSelect.options[i];
                    if (savedPavilhaoNames.includes(option.textContent.trim().toUpperCase())) {
                        option.selected = true;
                    }
                }
                if (inputHiddenPavilhao) inputHiddenPavilhao.value = historicalPavilhaoString;
                console.log("Pavilhões selecionados:", historicalPavilhaoString); 
            }
        }, 200);
    } else {
        if (nmPavilhaoSelect) {
            nmPavilhaoSelect.innerHTML = `<option value="${eventData.pavilhao || ''}">${eventData.pavilhao || 'Selecione Pavilhão'}</option>`;
            nmPavilhaoSelect.value = eventData.pavilhao || '';
        }
    }    

    qtdPessoasInput.value = parseInt(eventData.qtdpessoaslote || 0);

    // Campos Financeiros
    vlrCustoInput.value = parseFloat(eventData.vlrcache || 0).toFixed(2).replace('.', ',');
    transporteInput.value = parseFloat(eventData.vlrtransporte || 0).toFixed(2).replace('.', ',');  
    alimentacaoInput.value = parseFloat(eventData.vlralimentacao || 0).toFixed(2).replace('.', ',');
    
    descBeneficioTextarea.value = eventData.descbeneficios || '';
    ajusteCustoInput.value = parseFloat(eventData.vlrajustecusto || 0).toFixed(2).replace('.', ',');
    ajusteCustoTextarea.value = eventData.descajustecusto;
    statusAjusteCustoInput.value = eventData.statusajustecusto || '';

    caixinhaInput.value = parseFloat(eventData.vlrcaixinha || 0).toFixed(2).replace('.', ',');
    descCaixinhaTextarea.value = eventData.desccaixinha || '';
   // statusCaixinhaInput.value = eventData.statuscaixinha || '';
    const vlrCaixinha = parseFloat(eventData.vlrcaixinha || 0);
    statusCaixinhaInput.value = eventData.statuscaixinha || (vlrCaixinha !== 0 ? 'Pendente' : '');
    window.statusAnteriorCaixinha = eventData.statuscaixinha;
    statusPgtoCaixinhaInput.value = (eventData.statuspgtocaixinha?.toUpperCase()) || 'Pendente';
    window.statusPgtoCaixinhaOriginalDoBanco = eventData.statuspgtocaixinha;
    

    vlrTotalInput.value = parseFloat(eventData.vlrtotal || 0).toFixed(2).replace('.', ',');
    if (vlrTotalCacheInput) vlrTotalCacheInput.value = parseFloat(eventData.vlrcache || 0).toFixed(2).replace('.', ',');
    if (vlrTotalAjdCustoInput) vlrTotalAjdCustoInput.value = parseFloat(eventData.vlrajustecusto || 0).toFixed(2).replace('.', ',')
    console.log("VALOR TOTAL", vlrTotalInput.value);

    // Outros Campos de Status
    setorInput.value = (eventData.setor || '').toUpperCase();
    statusPagtoInput.value = (eventData.statuspgto || 'Pendente').toUpperCase();
    window.statusPgtoCacheOriginalDoBanco = eventData.statuspgto;
    statusPgtoAjudaCustoInput.value = (eventData.statuspgtoajdcto || 'Pendente').toUpperCase(); 
  

    // Lógica para Comprovantes 50% e 100%
    if (temPermissaoFinanceiro) {
        const comp50Preenchido = eventData.comppgtoajdcusto50 && eventData.comppgtoajdcusto50.length > 0;
        const comp100Preenchido = eventData.comppgtoajdcusto && eventData.comppgtoajdcusto.length > 0;
        check50.checked = comp50Preenchido;
        check100.checked = comp100Preenchido;
        container1.style.display = check100.checked ? 'flex' : 'none';
        container2.style.display = check50.checked ? 'flex' : 'none';
    }

    // Cores dos Status de Pagamento
    const statusPagtoValue = statusPagtoInput.value.toUpperCase();  
    statusPagtoInput.classList.remove('pendente', 'pago', 'suspenso');
    if (statusPagtoValue === "PENDENTE") statusPagtoInput.classList.add('pendente');
    else if (statusPagtoValue === "PAGO") statusPagtoInput.classList.add('pago');
    else if (statusPagtoValue === "SUSPENSO") statusPagtoInput.classList.add('suspenso');

    const statusPgtoCxValue = statusPgtoCaixinhaInput.value.toUpperCase();
    statusPgtoCaixinhaInput.classList.remove('pendente', 'pago', 'suspenso');
    if (statusPgtoCxValue === "PENDENTE") statusPgtoCaixinhaInput.classList.add('pendente');
    else if (statusPgtoCxValue === "PAGO") statusPgtoCaixinhaInput.classList.add('pago');
    else if (statusPgtoCxValue === "SUSPENSO") statusPgtoCaixinhaInput.classList.add('suspenso');

    const statusPgtoAjdCtoValue = statusPgtoAjudaCustoInput.value.toUpperCase();
    statusPgtoAjudaCustoInput.classList.remove('pendente', 'pago', 'pago50', 'suspenso');
    if (statusPgtoAjdCtoValue === "PENDENTE") statusPgtoAjudaCustoInput.classList.add('pendente');
    else if (statusPgtoAjdCtoValue === "PAGO") statusPgtoAjudaCustoInput.classList.add('pago');
    else if (statusPgtoAjdCtoValue === "PAGO50") {
        statusPgtoAjudaCustoInput.value = "PAGO 50%";
        statusPgtoAjudaCustoInput.classList.add('pago50');
    }
    else if (statusPgtoAjdCtoValue === "SUSPENSO") statusPgtoAjudaCustoInput.classList.add('suspenso');

    // Preenchimento de Níveis
    nivelOriginalCarregado = (eventData.nivelexperiencia || '').trim().toUpperCase();
    nivelFoiTrocado = false;

    const nivelBanco = (eventData.nivelexperiencia || "").trim().toUpperCase();
    if (seniorCheck2) seniorCheck2.closest('.Vertical').style.display = 'none';

    switch(nivelBanco) {
        case "BASE":    if (baseCheck) baseCheck.checked = true; break;
        case "JUNIOR":  if (juniorCheck) juniorCheck.checked = true; break;
        case "PLENO":   if (plenoCheck) plenoCheck.checked = true; break;
        case "SENIOR":  if (seniorCheck) seniorCheck.checked = true; break;
        case "SENIOR2":
        case "SENIOR 2":
            if (seniorCheck2) {
                seniorCheck2.closest('.Vertical').style.setProperty("display", "flex", "important");
                seniorCheck2.checked = true;
                console.log("✅ Senior 2 marcado na edição.");
            }
            break;
        case "FECHADO":
        case "LIBERADO":
            const isFechado = (nivelBanco === "FECHADO");
            if (isFechado && fechadoCheck) fechadoCheck.checked = true;
            if (!isFechado && liberadoCheck) liberadoCheck.checked = true;
            
            document.getElementById('campoStatusCustoFechado').style.display = 'flex';
            document.getElementById('wrapperJustificativaCustoFechado').style.display = 'block';

            if (descCustoFechadoTextarea) {
                descCustoFechadoTextarea.value = eventData.desccustofechado || '';
                descCustoFechadoTextarea.style.display = 'block';
            }

            const statusFechadoBanco = eventData.statuscustofechado || 'Pendente';
            window.statusAnteriorCustoFechado = statusFechadoBanco;

            const temAcesso = temPermissaoMaster;
            const selectStatusFechado = document.getElementById('selectStatusCustoFechado');
            const inputStatusFechado = document.getElementById('statusCustoFechadoTexto');
            const hiddenStatusFechado = document.getElementById('statusCustoFechado');

            if (hiddenStatusFechado) hiddenStatusFechado.value = statusFechadoBanco;

            if (temAcesso) {
                document.getElementById('wrapperSelectCustoFechado').style.display = 'block';
                document.getElementById('wrapperInputCustoFechado').style.display = 'none';
                if (selectStatusFechado) {
                    selectStatusFechado.value = statusFechadoBanco;
                    aplicarCorNoSelect(selectStatusFechado);
                }
            } else {
                document.getElementById('wrapperSelectCustoFechado').style.display = 'none';
                document.getElementById('wrapperInputCustoFechado').style.display = 'block';
                if (inputStatusFechado) {
                    inputStatusFechado.value = statusFechadoBanco;
                    aplicarCorStatusInput(inputStatusFechado);
                }
            }
            break;
    }

    // Calendários
    inicializarEPreencherCampos(eventData);    
    atualizarContadorDatas();


    // ← MOVER PARA CÁ (depois do inicializarEPreencherCampos)
    if (ajusteCustocheck) {
        const vlrAjuste = parseFloat(eventData.vlrajustecusto || 0);        
        ajusteCustocheck.checked = vlrAjuste != 0;
        window.statusAnteriorAjusteCusto = eventData.statusajustecusto || '';
        
        const mostrar = ajusteCustocheck.checked ? 'block' : 'none';   

        if (campoAjusteCusto) campoAjusteCusto.style.display = mostrar;
        if (campoStatusajusteCusto) campoStatusajusteCusto.style.display = mostrar;    
   
        if (ajusteCustoTextarea) {
            ajusteCustoTextarea.style.display = mostrar;
            ajusteCustoTextarea.required = ajusteCustocheck.checked;
            ajusteCustoTextarea.value = eventData.descajustecusto || '';
        }
    }

    if (caixinhacheck) {
        const vlrCaixa = parseFloat(eventData.vlrcaixinha || 0);
        caixinhacheck.checked = vlrCaixa != 0;
        window.statusAnteriorCaixinha = eventData.statuscaixinha || '';
        
        const mostrarCx = caixinhacheck.checked ? 'block' : 'none';
        if (campoCaixinha) campoCaixinha.style.display = mostrarCx;
        if (campoStatusCaixinha) campoStatusCaixinha.style.display = mostrarCx;
        if (campoPgtoCaixinha) campoPgtoCaixinha.style.display = mostrarCx;
        if (descCaixinhaTextarea) {
            descCaixinhaTextarea.style.display = mostrarCx;
            descCaixinhaTextarea.required = caixinhacheck.checked;
            descCaixinhaTextarea.value = eventData.desccaixinha || '';
        }
    }

    // 🟢 LOG POS-PAGAMENTO: Mostra apenas se houver conteúdo na tabela
    if (containerObsPosPgto && obsPosPgtoTextarea) {
        // Pega o valor da coluna obspospgto que veio do banco
        const logBanco = eventData.obspospgto || '';
        
        if (logBanco.trim() !== '') {
            obsPosPgtoTextarea.value = logBanco.trim();
            containerObsPosPgto.style.display = 'block'; // Mostra o container se houver log
        } else {
            obsPosPgtoTextarea.value = '';
            containerObsPosPgto.style.display = 'none';  // Oculta completamente se estiver vazio
        }
    }

    obsGeralTextarea.value = eventData.obsgeral?.trim() || '';

    // Bloqueia pickers silenciosamente durante carregamento se já foi pago
    const statuspgtoCarreg = (eventData.statuspgto || '').trim().toUpperCase();
    const statuspgtoajdctoCarreg = (eventData.statuspgtoajdcto || '').trim().toUpperCase();
    if (statuspgtoCarreg === 'PAGO' || statuspgtoajdctoCarreg === 'PAGO' || statuspgtoajdctoCarreg === 'PAGO50') {
        alternarBloqueioFlatpickr(window.datasEventoPicker, true);
        alternarBloqueioFlatpickr(window.diariaDobradaPicker, true);
        alternarBloqueioFlatpickr(window.meiaDiariaPicker, true);
        console.log("🔒 Pickers bloqueados: pagamento já realizado.");
    }

    // Bloqueia/desbloqueia pickers conforme bloquear (permissão financeiro)
    const pickers = [window.datasEventoPicker, window.diariaDobradaPicker, window.meiaDiariaPicker];
    pickers.forEach(p => alternarBloqueioFlatpickr(p, bloquear));

    // Comprovantes
    preencherComprovanteCampo(eventData.comppgtocache, 'Cache');
    preencherComprovanteCampo(eventData.comppgtoajdcusto, 'AjdCusto');
    preencherComprovanteCampo(eventData.comppgtoajdcusto50, 'AjdCusto2');
    preencherComprovanteCampo(eventData.comppgtocaixinha, 'Caixinha');
    preencherComprovanteCampo(eventData.compcontgastos, 'ControleGastos');

    // 🌟 Restauração dos valores financeiros
    console.log("🌟 Restaurando valores do banco:", eventData.vlrtotal, eventData.vlrtotcache, eventData.vlrtotajdcusto);

    vlrTotalInput.value = 'R$ ' + parseFloat(eventData.vlrtotal || 0).toFixed(2).replace('.', ',');

    const vlrtotcache = parseFloat(eventData.vlrtotcache || 0);
    const vlrtotajdcusto = parseFloat(eventData.vlrtotajdcusto || 0);

    if (vlrtotcache > 0 && vlrtotajdcusto > 0) {
        // Banco tem valores → restaura direto sem recalcular
        vlrTotalCacheInput.value = 'R$ ' + vlrtotcache.toFixed(2).replace('.', ',');
        vlrTotalAjdCustoInput.value = 'R$ ' + vlrtotajdcusto.toFixed(2).replace('.', ',');
    }
    // Se zerados → calcularValorTotal já foi/será chamado pelo inicializarEPreencherCampos

    // setTimeout garante que, após todos os listeners rodarem, os valores do banco prevalecem
    setTimeout(() => {
        if (parseFloat(eventData.vlrtotcache || 0) > 0) {
            vlrCustoInput.value = parseFloat(eventData.vlrcache || 0).toFixed(2).replace('.', ',');
            transporteInput.value = parseFloat(eventData.vlrtransporte || 0).toFixed(2).replace('.', ',');  
            alimentacaoInput.value = parseFloat(eventData.vlralimentacao || 0).toFixed(2).replace('.', ',');
            vlrTotalInput.value = 'R$ ' + parseFloat(eventData.vlrtotal || 0).toFixed(2).replace('.', ',');
            vlrTotalCacheInput.value = 'R$ ' + parseFloat(eventData.vlrtotcache || 0).toFixed(2).replace('.', ',');
            vlrTotalAjdCustoInput.value = 'R$ ' + parseFloat(eventData.vlrtotajdcusto || 0).toFixed(2).replace('.', ',');
        }
        isFormLoadedFromDoubleClick = false; 
        console.log("✅ Carregamento finalizado.");
    }, 1000);
};

const verificarNecessidadeComprovante = (ed) => {
    // Regra 1: Cachê
    const precisaCache = parseFloat(ed.vlrtotcache || 0) > 0 && 
                         (ed.statuspgto || "").toLowerCase() === 'pago' && 
                         (!ed.comppgtocache);

    // Regra 2: Ajuda de Custo
    const precisaAjd = parseFloat(ed.vlrtotajdcusto || 0) > 0 && 
                        (ed.statuspgtoajdcto || "").toLowerCase() === 'pago' && 
                        (!ed.comppgtoajdcusto);

    // Regra 3: Caixinha
    const precisaCaixinha = parseFloat(ed.vlrcaixinha || 0) > 0 && 
                            (ed.statuscaixinha || "").toLowerCase() === 'pago' && 
                            (!ed.comppgtocaixinha);

    const isInativo = (ed.statusstaff || "").trim() === 'Inativo';

    return precisaCache || precisaAjd || precisaCaixinha || isInativo;
};

const configurarUploadsFinanceiro = (ed) => {
    const upCache = document.getElementById('uploadCompCache'); // Ajuste os IDs
    const upAjd = document.getElementById('uploadCompAjd');
    const upCaixinha = document.getElementById('uploadCompCaixinha');

    if (upCache) upCache.disabled = !(parseFloat(ed.vlrtotcache || 0) > 0 && (ed.statuspgto || "").toLowerCase() === 'pago' && !ed.comppgtocache);
    
    if (upAjd) upAjd.disabled = !(parseFloat(ed.vlrtotajdcusto || 0) > 0 && (ed.statuspgtoajdcto || "").toLowerCase() === 'pago' && !ed.comppgtoajdcusto);
    
    if (upCaixinha) upCaixinha.disabled = !(parseFloat(ed.vlrcaixinha || 0) > 0 && (ed.statuscaixinha || "").toLowerCase() === 'pago' && !ed.comppgtocaixinha);
};


function inicializarEPreencherCampos(eventData) {
    
    console.log("Inicializando Flatpickrs com dados de evento...");

    // **PASSO 1: DESTRUIR INSTÂNCIAS ANTERIORES**
    // Isso evita que eventos e configurações dupliquem ao recarregar o formulário.
    if (window.diariaDobradaPicker) window.diariaDobradaPicker.destroy();
    if (window.meiaDiariaPicker) window.meiaDiariaPicker.destroy();
    if (window.datasEventoPicker) window.datasEventoPicker.destroy();


    // Garante que ao clicar no input, mostra o campo mesmo após recriar os pickers
    configurarFlatpickrs();    

    // Garante que ao clicar no input, mostra o campo mesmo após recriar os pickers
    setTimeout(() => {
        if (window.diariaDobradaPicker?.altInput) {
            window.diariaDobradaPicker.altInput.addEventListener('mousedown', function() {
                console.log("🟢 MOUSEDOWN altInput diariaDobrada");
                document.getElementById('campoDiariaDobrada').style.display = 'block';
                document.getElementById('campoStatusDiariaDobrada').style.display = 'block';
                const textarea = document.getElementById('descDiariaDobrada');
                if (textarea) textarea.style.display = 'block';
                if (diariaDobradacheck) diariaDobradacheck.checked = true;
            });
        }
        if (window.meiaDiariaPicker?.altInput) {
            window.meiaDiariaPicker.altInput.addEventListener('mousedown', function() {
                console.log("🟢 MOUSEDOWN altInput meiaDiaria");
                document.getElementById('campoMeiaDiaria').style.display = 'block';
                document.getElementById('campoStatusMeiaDiaria').style.display = 'block';
                const textarea = document.getElementById('descMeiaDiaria');
                if (textarea) textarea.style.display = 'block';
                if (meiaDiariacheck) meiaDiariacheck.checked = true;
            });
        }
    }, 200);

     // Pega as datas e status dos dados do evento
     datasDobrada = parseDatesWithStatus(eventData.dtdiariadobrada);
     datasMeiaDiaria = parseDatesWithStatus(eventData.dtmeiadiaria);

    // 🚩 SINCRONIZAÇÃO PARA REVERSÃO FINANCEIRA (Adicionado aqui)
    // 1. Capturamos o status de pagamento global do cachê para as travas de Dobra/Meia
    window.statusPgtoCacheOriginalDoBanco = (eventData.statuspgto || "Pendente").trim();
    window.statusPgtoAjudaOriginalDoBanco = (eventData.statuspgtoajdcto || "Pendente").trim();

    // 2. Capturamos o status anterior das Dobras (do JSON ou do campo mestre)
    window.statusAnteriorDiariaDobrada = datasDobrada.length > 0 ? datasDobrada[0].status : (eventData.statusdiariadobrada || '');
    
    // 3. Capturamos o status anterior das Meias
    window.statusAnteriorMeiaDiaria = datasMeiaDiaria.length > 0 ? datasMeiaDiaria[0].status : (eventData.statusmeiadiaria || '');

    // 4. Sincroniza os inputs hidden para o cálculo inicial não bugar
    if (document.getElementById('statusDiariaDobrada')) {
        document.getElementById('statusDiariaDobrada').value = window.statusAnteriorDiariaDobrada;
    }
    if (document.getElementById('statusMeiaDiaria')) {
        document.getElementById('statusMeiaDiaria').value = window.statusAnteriorMeiaDiaria;
    }

     // PASSO 2: Extrai APENAS os objetos Date para o setDate()
    // Use a função que retorna APENAS os objetos Date (seja getDatesForFlatpickr ou extractDatesFromStatusArray)
    const datesEvento = getDatesForFlatpickr(eventData.datasevento); // Presumindo que datasevento seja uma string JSON de datas
    const datesDiariaDobrada = extractDatesFromStatusArray(datasDobrada); // 💡 USAR O NOVO AUXILIAR
    const datesMeiaDiaria = extractDatesFromStatusArray(datasMeiaDiaria); // 💡 USAR O NOVO AUXILIAR


    // 🚩 ADICIONE ESTE BLOCO AQUI PARA CORRIGIR O qtdOriginais: 0
    window.currentEventDataCache = {
        ...window.currentEventDataCache, // Mantém o que já existir (como vlrtotajdcusto)
        vlrtotajdcusto: eventData.vlrtotajdcusto,
        statusAjudaCustoOriginal: (eventData.statuspgtoajdcto || "").trim().toLowerCase(),
        statusPgtoCacheOriginalDoBanco: (eventData.statuspgto || "").trim().toLowerCase(),
        // Salva as datas originais como Array para o .length funcionar no calcularValorTotal
        datasOriginaisBanco: datesEvento 
    };

    window.datasOriginaisCarregadas = datesEvento.map(d => flatpickr.formatDate(d, "Y-m-d"));

    //  // **PASSO 3: INICIALIZAR AS NOVAS INSTÂNCIAS COM AS CONFIGURAÇÕES CORRETAS**

    // console.log("Valor de dtdiariadobrada:", eventData.dtdiariadobrada, eventData.dtmeiadiaria,eventData.datasevento );

    // // **PASSO 4: PREENCHER AS NOVAS INSTÂNCIAS COM OS DADOS CARREGADOS E PREENCHER O ALTINPUT**
    // const datesEvento = getDatesForFlatpickr(eventData.datasevento);
    // const datesDiariaDobrada = getDatesForFlatpickr(datasDobrada);
    // const datesMeiaDiaria = getDatesForFlatpickr(datasMeiaDiaria);

    datasEventoSelecionadas = datesEvento;

    window.datasEventoPicker.setDate(datesEvento, false);

    window.datasEventoNoCalendarioCache = window.datasEventoPicker.selectedDates
    .map(d => flatpickr.formatDate(d, 'Y-m-d'))
    .sort();
    console.log("✅ Cache datasEvento inicializado:", window.datasEventoNoCalendarioCache);

    if (typeof atualizarContadorEDatas === 'function') {
        atualizarContadorEDatas(window.datasEventoPicker.selectedDates);
        console.log("✅ Contador de Datas e pickers auxiliares sincronizados explicitamente.");
    } else {
        console.error("❌ Função atualizarContadorEDatas não está disponível.");
    }

    window.diariaDobradaPicker.set('enable', datesEvento);
    window.meiaDiariaPicker.set('enable', datesEvento);

    window.diariaDobradaPicker.setDate(datesDiariaDobrada, true);//estava false
    //formatInputTextWithStatus(window.diariaDobradaPicker, datasDobrada);

    window.meiaDiariaPicker.setDate(datesMeiaDiaria, true);//estava false
    //formatInputTextWithStatus(window.meiaDiariaPicker, datasMeiaDiaria);

    
    // Adicione um setTimeout para garantir que a formatação do input seja feita após a renderização
    setTimeout(() => {
        formatInputTextWithStatus(window.diariaDobradaPicker, datasDobrada);
        formatInputTextWithStatus(window.meiaDiariaPicker, datasMeiaDiaria);
    }, 0);

    // **PASSO 6: LÓGICA DO CHECKBOX**
    // Evento de alteração do checkbox de Diária Dobrada
    diariaDobradacheck.addEventListener('change', (e) => {
        if (e.target.checked) {
            // Se o usuário MARCOU o checkbox, exibe o campo
            campoDiariaDobrada.style.display = 'block';
            campoStatusDiariaDobrada.style.display = 'block';
            containerStatusDiariaDobrada.style.display = 'block';
        } else {
            // Se o usuário DESMARCOU o checkbox, oculta o campo e limpa o Flatpickr
            campoDiariaDobrada.style.display = 'none';
            campoStatusDiariaDobrada.style.display = 'none';
            containerStatusDiariaDobrada.style.display = 'none';
            window.diariaDobradaPicker.clear();
        }

        // ADIÇÃO: Força a atualização do input do outro campo após a alteração do checkbox
        setTimeout(() => {
          formatInputTextWithStatus(window.meiaDiariaPicker, datasMeiaDiaria);
        }, 0);

        // A lógica de desabilitar/habilitar datas no outro picker
        // e o cálculo do total são chamados independentemente
        // do estado do checkbox.
        updateDisabledDates();
        calcularValorTotal();
    });

    // Evento de alteração do checkbox de Meia Diária
    meiaDiariacheck.addEventListener('change', (e) => {
        if (e.target.checked) {
            // Se o usuário MARCOU o checkbox, exibe o campo
            campoMeiaDiaria.style.display = 'block';
            campoStatusMeiaDiaria.style.display = 'block';
            containerStatusMeiaDiaria.style.display = 'block';
        } else {
            // Se o usuário DESMARCOU o checkbox, oculta o campo e limpa o Flatpickr
            campoMeiaDiaria.style.display = 'none';
            campoStatusMeiaDiaria.style.display = 'none';
            containerStatusMeiaDiaria.style.display = 'none';
            window.meiaDiariaPicker.clear();
        }

        // ADIÇÃO: Força a atualização do input do outro campo após a alteração do checkbox
        setTimeout(() => {
          formatInputTextWithStatus(window.diariaDobradaPicker, datasDobrada);
        }, 0);

        // A lógica de desabilitar/habilitar datas no outro picker
        // e o cálculo do total são chamados independentemente
        // do estado do checkbox.
        updateDisabledDates();
        calcularValorTotal();
    });

    // ... (restante do seu código para checkboxes e status) ...
    descDiariaDobradaTextarea.value = eventData.descdiariadobrada || '';
    descMeiaDiariaTextarea.value = eventData.descmeiadiaria || '';

    diariaDobradacheck.checked = datesDiariaDobrada.length > 0;
    campoDiariaDobrada.style.display = diariaDobradacheck.checked ? 'block' : 'none';
    campoStatusDiariaDobrada.style.display = diariaDobradacheck.checked ? 'block' : 'none';
    descDiariaDobradaTextarea.style.display = diariaDobradacheck.checked ? 'block' : 'none';
    //containerStatusDiariaDobrada.style.display = diariaDobradacheck.checked ? 'flex' : 'none';

    meiaDiariacheck.checked = datesMeiaDiaria.length > 0;
    campoMeiaDiaria.style.display = meiaDiariacheck.checked ? 'block' : 'none';
    campoStatusMeiaDiaria.style.display = meiaDiariacheck.checked ? 'block' : 'none';
    descMeiaDiariaTextarea.style.display = meiaDiariacheck.checked ? 'block' : 'none';
    //containerStatusMeiaDiaria.style.display = meiaDiariacheck.checked ? 'flex' : 'none';    

    console.log("TEM PERMISSÃO MASTER:", temPermissaoMaster);
    console.log("TEM PERMISSÃO FINANCEIRO:", temPermissaoFinanceiro);    
    console.log("TEM PERMISSÃO TOTAL:", temPermissaoTotal);
   
    const containerPDF = document.querySelector('.pdf');

    if (containerPDF) {
        if (temPermissaoMaster || temPermissaoFinanceiro)  {
            containerPDF.style.display = 'flex'; // 🚫 Oculta tudo para quem não tem Master/Financeiro
        } else {            
            containerPDF.style.display = 'none'; // 👁️ Mostra tudo para Master e Financeiro
        }
    }

    if (temPermissaoMaster) {   
        console.log("É FINANCEIRO"); 
        document.getElementById('selectStatusAjusteCusto').style.display = 'block';
        statusAjusteCustoInput.style.display = 'none';
        console.log("STATUS AJUSTE CUSTO TEM PERMISSAO TOTAL", eventData.statusajustecusto);
        const statusAjusteNormalizado = (eventData.statusajustecusto || '').toLowerCase().replace(/^\w/, c => c.toUpperCase());
        document.getElementById('selectStatusAjusteCusto').value = statusAjusteNormalizado; // ex: 'PENDENTE' → 'Pendente'
        console.log("VALOR DO STATUS AJUSTE CUSTO:", eventData.statusajustecusto);
        aplicarCoresAsOpcoes('selectStatusAjusteCusto');
        aplicarCorNoSelect(document.getElementById('selectStatusAjusteCusto'));

        document.getElementById('selectStatusCaixinha').style.display = 'block';
        statusCaixinhaInput.style.display = 'none';
        const statusCaixinhaNormalizado = (eventData.statuscaixinha || '').toLowerCase().replace(/^\w/, c => c.toUpperCase());
        document.getElementById('selectStatusCaixinha').value = statusCaixinhaNormalizado;
        aplicarCoresAsOpcoes('selectStatusCaixinha');
        aplicarCorNoSelect(document.getElementById('selectStatusCaixinha'));
        
        // Exibe os grupos (label + container)
        document.getElementById('grupoDiariaDobrada').style.display = 'block';
        document.getElementById('grupoMeiaDiaria').style.display = 'block';

        // Oculta selects e inputs antigos
        document.getElementById('selectStatusDiariaDobrada').style.display = 'none';
        statusDiariaDobradaInput.style.display = 'none';
        campoStatusDiariaDobrada.style.display = 'none';

        document.getElementById('selectStatusMeiaDiaria').style.display = 'none';
        statusMeiaDiariaInput.style.display = 'none';
        campoStatusMeiaDiaria.style.display = 'none';

        // Renderiza os novos containers
        renderDatesWithStatus(datasDobrada, 'containerStatusDiariaDobrada', 'dobrada');
        renderDatesWithStatus(datasMeiaDiaria, 'containerStatusMeiaDiaria', 'meia');

        const grupoDiariaDobrada = document.getElementById('grupoDiariaDobrada');
        const grupoMeiaDiaria = document.getElementById('grupoMeiaDiaria');
        const containerDiariaDobrada = document.getElementById('containerStatusDiariaDobrada');
        const containerMeiaDiaria = document.getElementById('containerStatusMeiaDiaria');

        // Lógica de Diária Dobrada:
        if (grupoDiariaDobrada) {
            // Só exibe o grupo pai se houver datas
            grupoDiariaDobrada.style.display = datesDiariaDobrada.length > 0 ? 'block' : 'none';
        }
        if (containerDiariaDobrada) {
            // Só exibe o container de status (lista de datas) se houver datas
            containerDiariaDobrada.style.display = datesDiariaDobrada.length > 0 ? 'flex' : 'none';
        }

        // Lógica de Meia Diária:
        if (grupoMeiaDiaria) {
            // Só exibe o grupo pai se houver datas
            grupoMeiaDiaria.style.display = datesMeiaDiaria.length > 0 ? 'block' : 'none';
        }
        if (containerMeiaDiaria) {
            // Só exibe o container de status (lista de datas) se houver datas
            containerMeiaDiaria.style.display = datesMeiaDiaria.length > 0 ? 'flex' : 'none';
        }

     } else {      
        document.getElementById('selectStatusAjusteCusto').style.display = 'none';
        statusAjusteCustoInput.style.display = 'block';
        
        // NORMALIZAR: primeira letra maiúscula, resto minúsculo
        const statusAjuste = eventData.statusajustecusto || '';
        statusAjusteCustoInput.value = statusAjuste.charAt(0).toUpperCase() + statusAjuste.slice(1).toLowerCase();
        aplicarCorStatusInput(statusAjusteCustoInput);

        document.getElementById('selectStatusCaixinha').style.display = 'none';
        statusCaixinhaInput.style.display = 'block';
        const statusCx = eventData.statuscaixinha || '';
        statusCaixinhaInput.value = statusCx.charAt(0).toUpperCase() + statusCx.slice(1).toLowerCase();
        aplicarCorStatusInput(statusCaixinhaInput);

        // Esconde os grupos (label + container)
        document.getElementById('grupoDiariaDobrada').style.display = 'none';
        document.getElementById('grupoMeiaDiaria').style.display = 'none';

        // Mostra os inputs antigos
        document.getElementById('selectStatusDiariaDobrada').style.display = 'none';
        statusDiariaDobradaInput.style.display = 'block';
        statusDiariaDobradaInput.value = eventData.statusdiariadobrada || '';
        aplicarCorStatusInput(statusDiariaDobradaInput);

        document.getElementById('selectStatusMeiaDiaria').style.display = 'none';
        statusMeiaDiariaInput.style.display = 'block';
        statusMeiaDiariaInput.value = eventData.statusmeiadiaria || '';
        aplicarCorStatusInput(statusMeiaDiariaInput);
        
     }

    // Assuma que 'temPermissaoFinanceiro' é uma variável booleana definida em outro local

    updateDisabledDates();
}

// Função para atualizar o contador de diárias e chamar o cálculo
function atualizarContadorDatas() {
    // Pega as datas de evento
    const datasEvento = (window.datasEventoPicker?.selectedDates || []).map(date => flatpickr.formatDate(date, "Y-m-d"));

    // Conta apenas o número de datas do evento
    const numeroTotalDeDias = datasEvento.length;

    // Atualiza o texto do contador
    const contadorElemento = document.getElementById('contadorDatas');
    if (contadorElemento) {
        contadorElemento.innerText = `${numeroTotalDeDias} diárias selecionadas`;
    }

    // Chama o cálculo logo após a atualização.
    // Isso é o que elimina a necessidade do MutationObserver
    calcularValorTotal();
}

function updateDisabledDates() {
    const datesDobrada = window.diariaDobradaPicker.selectedDates;
    const datesMeiaDiaria = window.meiaDiariaPicker.selectedDates;

    console.log("DATAS SELECIONADAS", datesDobrada, datesMeiaDiaria);

    // Use o método formatDate do Flatpickr para garantir o formato correto
    const datesDobradaStrings = datesDobrada.map(d => flatpickr.formatDate(d, "Y-m-d"));
    const datesMeiaDiariaStrings = datesMeiaDiaria.map(d => flatpickr.formatDate(d, "Y-m-d"));

    // Desabilita as datas já selecionadas no outro picker
    window.meiaDiariaPicker.set('disable', datesDobradaStrings);
    window.diariaDobradaPicker.set('disable', datesMeiaDiariaStrings);
}

/**
 * Coleta todos os dados do formulário de evento para salvar ou processar.
 * @returns {object} Um objeto contendo todos os dados do formulário,
 * incluindo datas formatadas em strings.
 */
function getDadosFormulario() {
    // Acessa as instâncias de Flatpickr de forma segura
    const datasDobrada = window.diariaDobradaPicker ? window.diariaDobradaPicker.selectedDates : [];
    const datasMeiaDiaria = window.meiaDiariaPicker ? window.meiaDiariaPicker.selectedDates : [];

    // Converte as datas para o formato string "Y-m-d"
    const datesDobradaFormatted = datasDobrada.map(date => flatpickr.formatDate(date, "Y-m-d"));
    const datesMeiaDiariaFormatted = datasMeiaDiaria.map(date => flatpickr.formatDate(date, "Y-m-d"));

    // Retorna um objeto com todos os dados
    return {
        // ... outros campos do formulário
        datasDiariaDobrada: datesDobradaFormatted,
        datasMeiaDiaria: datesMeiaDiariaFormatted,
        // ...
    };
}



const carregarTabelaStaff = async (funcionarioId) => {
    const eventsTableBody = document.querySelector('#eventsDataTable tbody');
    // Reset inicial da tela
    eventsTableBody.innerHTML = '';
    noResultsMessage.style.display = 'none';
    currentRowSelected = null;
    isFormLoadedFromDoubleClick = false;

    // Validação de ID
    if (!funcionarioId || (typeof funcionarioId === 'string' && (funcionarioId.toLowerCase() === 'null' || funcionarioId.trim() === ''))) {
        noResultsMessage.style.display = 'block';
        noResultsMessage.textContent = 'Por favor, selecione um funcionário para pesquisar os eventos.';
        return;
    }

    const url = `/staff/${funcionarioId}`;


    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + localStorage.getItem('token')
            }
        });


        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Erro na requisição');
        }

        const data = await response.json();
        document.getElementById('qtdPessoasHeader').style.display = 'none';

        if (data && data.length > 0) {
            if (isLote) {
                document.getElementById('qtdPessoasHeader').style.display = 'table-cell';
            }

            data.forEach(eventData => {
                // --- 1. PROCESSAMENTO DE DATAS E QTD DIAS (Sempre calculado dinamicamente) ---
                let datasArray = [];
                try {
                    //datasArray = typeof eventData.datasevento === 'string' ? JSON.parse(eventData.datasevento) : (eventData.datasevento || []);
                    const fonteDados = eventData.datasevento_aggr || eventData.datasevento;
    
                    datasArray = typeof fonteDados === 'string' ? JSON.parse(fonteDados) : (fonteDados || []);
                    
                    // GARANTIA FRONT-END: Ordena as datas antes de exibir
                    datasArray.sort((a, b) => new Date(a) - new Date(b));
                } catch(e) { 
                    datasArray = []; 
                }
                const qtdDiasCalculada = datasArray.length;

                // --- 2. DEFINIÇÃO DOS TOTAIS (Prioridade para o Banco, senão calcula) ---
                let totais;
                // const temValoresNoBanco = 
                //     eventData.vlrtotajdcusto !== undefined && eventData.vlrtotajdcusto !== null && parseFloat(eventData.vlrtotajdcusto) !== 0 &&
                //     eventData.vlrtotcache !== undefined && eventData.vlrtotcache !== null && parseFloat(eventData.vlrtotcache) !== 0;

                // if (temValoresNoBanco) {
                //     totais = {
                //         qtdDias: qtdDiasCalculada, 
                //         totalAjdCusto: parseFloat(eventData.vlrtotajdcusto),
                //         totalCache: parseFloat(eventData.vlrtotcache),
                //         vlrDobraCalculado: parseFloat(eventData.vlrtotdiariadobrada || 0),
                //         vlrMeiaCalculada: parseFloat(eventData.vlrtotmeiadiaria || 0),
                //         totalGeral: parseFloat(eventData.vlrtotgeral || 0)
                //     };
                // } else {
                //     totais = calcularTotaisLinha(eventData);
                //     totais.qtdDias = qtdDiasCalculada; // Garante consistência
                // }

                const temValoresNoBanco = 
                    eventData.vlrtotajdcusto !== undefined && eventData.vlrtotajdcusto !== null && parseFloat(eventData.vlrtotajdcusto) !== 0 &&
                    eventData.vlrtotcache !== undefined && eventData.vlrtotcache !== null && parseFloat(eventData.vlrtotcache) !== 0;

                const statusFechado = (eventData.statuscustofechado || '').toLowerCase().trim();

                // Deve calcular APENAS se não tem valores no banco E não é Fechado/Pendente
                const deveCalcular = !temValoresNoBanco && statusFechado !== 'pendente';

                if (temValoresNoBanco || statusFechado === 'pendente') {
                    // Usa banco — tanto quando tem valores salvos quanto quando é Fechado ainda Pendente
                    totais = {
                        qtdDias: qtdDiasCalculada, 
                        totalAjdCusto: parseFloat(eventData.vlrtotajdcusto || 0),
                        totalCache: parseFloat(eventData.vlrtotcache || 0),
                        vlrDobraCalculado: parseFloat(eventData.vlrtotdiariadobrada || 0),
                        vlrMeiaCalculada: parseFloat(eventData.vlrtotmeiadiaria || 0),
                        totalGeral: parseFloat(eventData.vlrtotal || 0)
                    };
                } else {
                    // Calcula dinamicamente apenas quando não tem valores E não é Fechado/Pendente
                    totais = calcularTotaisLinha(eventData);
                    totais.qtdDias = qtdDiasCalculada;
                }

                //console.log("Totais calculados para o evento:", totais, "Valor do banco:", eventData);
                
                // Lógica de bloqueio de edição
                const vlrAjd = totais.totalAjdCusto; 
                const vlrCache = totais.totalCache;
                const statusAjd = (eventData.statuspgtoajdcto || "").toLowerCase();
                const statusCache = (eventData.statuspgto || "").toLowerCase();
                const statusCxnha = (eventData.statuspgtocaixinha || "").toLowerCase();

                console.log("Valores para verificação de pagamento:", {vlrAjd, statusAjd, vlrCache, statusCache, temPermissaoTotal});

                // REGRA: Consideramos "Evento Concluído e Pago" se:
                // 1. O que era devido de Ajuda de Custo está pago (se houver valor)
                // 2. O que era devido de Cachê está pago (se houver valor)
                const temValorAlgum = (vlrAjd > 0 || vlrCache > 0 || (parseFloat(eventData.vlrcaixinha || 0) > 0));
                const estaTudoPago = temValorAlgum && 
                     (vlrAjd > 0 ? statusAjd === "pago" : true) && 
                     (vlrCache > 0 ? statusCache === "pago" : true) &&
                     (parseFloat(eventData.vlrcaixinha || 0) > 0 ? statusCxnha === "pago" : true);


                const bloqueioParcial = !temPermissaoTotal && (statusCache === "pago" || statusCxnha === "pago");

                const row = eventsTableBody.insertRow();

                const statusStaff = (eventData.statusstaff || 'Ativo').trim();
                row.setAttribute('data-statusstaff', statusStaff);
                if (statusStaff === 'Deletado') row.classList.add('row-deletado');
                else if (statusStaff === 'Pendente') row.classList.add('row-pendente');
                else if (statusStaff === 'Inativo') row.classList.add('row-inativo');
                row.dataset.eventData = JSON.stringify(eventData);

                row.addEventListener('dblclick', async () => {
                    desbloquearFormulario();
                    isFormLoadedFromDoubleClick = true;

                    let datasOriginaisArray = [];
                    try {
                        datasOriginaisArray = typeof eventData.datasevento === 'string' 
                            ? JSON.parse(eventData.datasevento) 
                            : (eventData.datasevento || []);
                    } catch(e) { 
                        datasOriginaisArray = []; 
                    }

                    // Armazenamos no window para que o botão "Salvar" consiga ler depois
                    window.dadosOriginais = {
                        idFuncionario: eventData.idstaffevento,
                        periodo: datasOriginaisArray
                    };
                    
                    // Gerenciamento visual da seleção da linha
                    if (currentRowSelected) currentRowSelected.classList.remove('selected-row');
                    row.classList.add('selected-row');
                    currentRowSelected = row;

                    const statusAtual = (eventData.statusstaff || 'Ativo').trim();
                    if (statusAtual === 'Deletado') {
                        await Swal.fire({
                            icon: 'error',
                            title: 'REGISTRO DELETADO',
                            text: 'Modo visualização. Este registro foi deletado e não pode ser editado.',
                            confirmButtonText: 'Visualizar',
                            timer: 2500,
                            timerProgressBar: true
                        });
                        document.getElementById('Enviar')?.setAttribute('data-bloqueado', 'true');
                        carregarDadosParaEditar(eventData, true); // bloquear = true
                        setTimeout(() => bloquearFormularioVisualizacao('Registro deletado — edição não permitida', 'deletado'), 200);
                        return;
                    }
                    // if (statusAtual === 'Pendente') {
                    //     await Swal.fire({
                    //         icon: 'warning',
                    //         title: 'SOLICITAÇÃO PENDENTE',
                    //         text: 'Modo visualização. Edição bloqueada até aprovação ou rejeição.',
                    //         confirmButtonText: 'Visualizar',
                    //         timer: 2500,
                    //         timerProgressBar: true
                    //     });
                    //     document.getElementById('Enviar')?.setAttribute('data-bloqueado', 'true');
                    //     carregarDadosParaEditar(eventData, true); // bloquear = true
                    //     setTimeout(() => bloquearFormularioVisualizacao('Solicitação pendente de aprovação', 'pendente'), 200);
                    //     return;
                    // }
                    if (statusAtual === 'Pendente') {
                        const solAditivo = eventData.solicitacao_aditivo;
                        const aguardandoOrcamento = solAditivo && 
                            solAditivo.status === 'Autorizado' && 
                            !solAditivo.noOrcamento;

                            console.log("eventData completo:", eventData);
                            console.log("Status Pendente com aditivo:", {solAditivo, aguardandoOrcamento});

                        await Swal.fire({ 
                            icon: 'warning',
                            title: aguardandoOrcamento ? 'AGUARDANDO ORÇAMENTO' : 'SOLICITAÇÃO PENDENTE',
                            text: aguardandoOrcamento 
                                ? 'Modo visualização. Aditivo autorizado, mas ainda não incluído no orçamento.' 
                                : 'Modo visualização. Edição bloqueada até aprovação ou rejeição.',
                            confirmButtonText: 'Visualizar',
                            timer: 2500,
                            timerProgressBar: true
                        });
                        document.getElementById('Enviar')?.setAttribute('data-bloqueado', 'true');
                        carregarDadosParaEditar(eventData, true);
                        setTimeout(() => bloquearFormularioVisualizacao(
                            aguardandoOrcamento ? 'Aguardando inclusão no orçamento' : 'Solicitação pendente de aprovação', 
                            'pendente'
                        ), 200);
                        return;
                    }

                    // --- STATUS INATIVO ---
                    if (statusAtual === 'Inativo') {
                        await Swal.fire({
                            icon: 'warning',
                            title: 'REGISTRO INATIVO',
                            text: 'Modo visualização. Apenas o lançamento de comprovantes está liberado.',
                            confirmButtonText: 'Entendido',
                            timer: 2500,
                            timerProgressBar: true
                        });

                        document.getElementById('Enviar')?.setAttribute('data-modo', 'comprovante');
                        carregarDadosParaEditar(eventData, true); // bloquear = true
                        setTimeout(() => {
                            bloquearFormularioVisualizacao('Registro inativo — edição restrita', 'inativo');
                            
                        }, 200);
                        return;
                    }

                    // --- LOGICA DE PERMISSÕES ---

                    // 1. USUÁRIO COM PERMISSÃO TOTAL (ADMIN)
                    if (temPermissaoTotal) {
                        if (estaTudoPago || bloqueioParcial) {
                            // Apenas avisa, mas deixa editar
                            await Swal.fire({
                                icon: 'info',
                                title: 'CONCLUÍDO E PAGO',
                                text: 'Este evento já foi pago, mas você tem permissão de administrador para editar.',
                                confirmButtonText: 'Continuar'
                            });
                        }
                        carregarDadosParaEditar(eventData, false); // Libera botão (bloquear = false)
                        return; // Encerra a execução do clique aqui
                    }

                    // 2. USUÁRIO COM PERMISSÃO FINANCEIRO (VISUALIZADOR)
                    if (temPermissaoFinanceiro) {
                        if (estaTudoPago || bloqueioParcial) {
                            await Swal.fire({
                                icon: 'warning',
                                title: 'MODO VISUALIZAÇÃO',
                                text: 'Evento com pagamento vinculado. Você pode visualizar os dados, mas a edição está desativada.',
                                confirmButtonText: 'Entendido'
                            });
                            carregarDadosParaEditar(eventData, true); // Bloqueia botão (bloquear = true)
                        } else {
                            // Se ainda não foi pago, financeiro pode editar? 
                            // Se sim, false. Se apenas ver, true.
                            carregarDadosParaEditar(eventData, false); 
                        }
                        return;
                    }

                    // 3. SEM PERMISSÃO (BLOQUEIO TOTAL)
                    // Se não caiu nos IFs acima e está pago/parcial, nega até o carregamento
                    if (estaTudoPago || bloqueioParcial) {
                        await Swal.fire({
                            icon: 'error',
                            title: 'ACESSO BLOQUEADO',
                            text: 'Você não tem permissão para acessar dados de eventos já pagos ou concluídos.',
                            confirmButtonText: 'Sair'
                        });
                        
                        // Limpa a seleção e não carrega nada
                        if (currentRowSelected) currentRowSelected.classList.remove('selected-row');
                        currentRowSelected = null;
                        return; // Não chama carregarDadosParaEditar
                    }

                    // 4. CASO PADRÃO (Evento aberto e usuário comum)
                    carregarDadosParaEditar(eventData, false);
                });

                // --- 4. PREENCHIMENTO DAS CÉLULAS ---
                
                // Informações Básicas
                row.insertCell().textContent = eventData.nmfuncao || '';
                row.insertCell().textContent = eventData.setor || '';
                row.insertCell().textContent = eventData.nmcliente || '';
                row.insertCell().textContent = eventData.nmevento || '';
                row.insertCell().textContent = eventData.nmlocalmontagem || '';
                row.insertCell().textContent = eventData.pavilhao || '';

                // Coluna Qtd Pessoas (Lote)
                const qtdPessoasCell = row.insertCell();
                if (isLote) {
                    qtdPessoasCell.textContent = eventData.qtdpessoaslote || '0';
                } else {
                    qtdPessoasCell.style.display = 'none';
                }

                // Datas do Evento formatadas
                row.insertCell().textContent = datasArray.map(dateStr => {
                    const parts = dateStr.split('-');
                    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateStr;
                }).join(', ') || 'N/A';

                // Qtd Dias
                row.insertCell().textContent = totais.qtdDias;

                // Valores Unitários Ajuda de Custo
                row.insertCell().textContent = parseFloat(eventData.vlralimentacao || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                row.insertCell().textContent = parseFloat(eventData.vlrtransporte || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

                // TOTAL AJUDA DE CUSTO
                const cellTotalAjd = row.insertCell();
                cellTotalAjd.textContent = totais.totalAjdCusto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                cellTotalAjd.style.fontWeight = 'bold';

                // STATUS AJUDA DE CUSTO (Oculta se valor for 0)
                const cellStatusAjd = row.insertCell();
                if (totais.totalAjdCusto > 0) {
                    const statusAjdBase = (eventData.statuspgtoajdcto || 'pendente').toLowerCase().trim();
                    const statusSpanAjd = document.createElement('span');
                    
                    if (statusAjdBase === 'pago50') {
                        statusSpanAjd.textContent = 'PAGO 50%';
                    } else {
                        statusSpanAjd.textContent = statusAjdBase.toUpperCase();
                    }
                    statusSpanAjd.classList.add('status-pgto', statusAjdBase);
                    cellStatusAjd.appendChild(statusSpanAjd);
                } else {
                    cellStatusAjd.textContent = '---';
                }

                // Cachê Base e Ajuste
                row.insertCell().textContent = parseFloat(eventData.vlrcache || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                
                const vlrAjusteCell = row.insertCell(); 
                const vlrAjusteNum = parseFloat(eventData.vlrajustecusto || 0);

                // Só formata e exibe se for diferente de zero
                if (vlrAjusteNum !== 0) {
                    vlrAjusteCell.textContent = vlrAjusteNum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                    
                    // Proteção para o erro DOMTokenList: verifica se existe status antes de adicionar classe
                    if (eventData.statusajustecusto && eventData.statusajustecusto.trim() !== "") {
                        const statusClass = eventData.statusajustecusto.toLowerCase().trim();
                        vlrAjusteCell.innerHTML += ` <span class="status-custom statusStaff-${statusClass}">(${eventData.statusajustecusto})</span>`;
                    }
                } else {
                    vlrAjusteCell.textContent = "---"; // Fica limpo se for 0
                }

                //row.insertCell().textContent = eventData.descajustecusto || '';

                row.insertCell().textContent = eventData.descajustecusto && eventData.descajustecusto.trim() !== "" 
                    ? eventData.descajustecusto 
                    : "---";

                // Dobras e Meias
                row.insertCell().innerHTML = formatarDataComStatus(eventData.dtdiariadobrada);
                row.insertCell().textContent = totais.vlrDobraCalculado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                
                row.insertCell().innerHTML = formatarDataComStatus(eventData.dtmeiadiaria);
                row.insertCell().textContent = totais.vlrMeiaCalculada.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

                row.insertCell().textContent = eventData.descbeneficios || '';

                // TOTAL CACHÊ
                const cellTotalCache = row.insertCell();
                cellTotalCache.textContent = totais.totalCache.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                cellTotalCache.style.fontWeight = 'bold';

                // --- 2. STATUS PAGAMENTO CACHÊ (Linha onde o erro costuma ocorrer) ---
                const statusCellCache = row.insertCell();
                const scache = (eventData.statuspgto || '').toLowerCase().trim();
                const spanCache = document.createElement('span');

                spanCache.textContent = (scache === 'pago50') ? 'PAGO 50%' : (scache === "" ? "PENDENTE" : scache.toUpperCase());

                // CORREÇÃO: Prevenção contra token vazio
                spanCache.classList.add('status-pgto');
                if (scache !== "") {
                    spanCache.classList.add(scache);
                } else {
                    spanCache.classList.add('pendente'); // Define um padrão caso esteja vazio no banco
                }
                statusCellCache.appendChild(spanCache);                

                
                const statusCaixinhaCell = row.insertCell();
                const vlrCaixinhaCell = parseFloat(eventData.vlrcaixinha || 0);

                if (vlrCaixinhaCell > 0) {
                    const sCaixinha = (eventData.statuscaixinha || '').toLowerCase().trim();
                    const spanCaixinha = document.createElement('span');
                    
                    spanCaixinha.textContent = sCaixinha === "" ? "Pendente" : sCaixinha.toUpperCase();
                    
                    // CORREÇÃO: Prevenção contra token vazio
                    spanCaixinha.classList.add('status-pgto');
                    if (sCaixinha !== "") {
                        spanCaixinha.classList.add(sCaixinha);
                    }
                    statusCaixinhaCell.appendChild(spanCaixinha);
                } else {
                    statusCaixinhaCell.textContent = '---';
                }

                const cellStatusCaixinha = row.insertCell();
                if (eventData.vlrcaixinha > 0) {
                    const statusCaixinhaBase = (eventData.statuscaixinha || 'pendente').toLowerCase().trim();
                    const statusSpanCaixinha = document.createElement('span');
                                  
                    statusSpanCaixinha.textContent = statusCaixinhaBase.toUpperCase();
                   
                    statusSpanCaixinha.classList.add('status-pgto', statusCaixinhaBase);
                    cellStatusCaixinha.appendChild(statusSpanCaixinha);
                } else {
                    cellStatusCaixinha.textContent = '---';
                }

                // TOTAL GERAL
                const cellTotalGeral = row.insertCell();
                cellTotalGeral.textContent = totais.totalGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                cellTotalGeral.style.fontWeight = 'bold'; 

                // if (statusStaff === 'Deletado' || statusStaff === 'Pendente' || statusStaff === 'Inativo') {
                //     const celulaEvento = row.cells[3]; // nmevento
                //     if (celulaEvento) {
                //         const badge = document.createElement('div');
                //         badge.className = `badge-statusstaff badge-statusstaff--${statusStaff.toLowerCase()}`;
                //         if (statusStaff === 'Deletado') badge.textContent = '🚫 DELETADO';
                //         else if (statusStaff === 'Pendente') badge.textContent = '⏳ Aguardando Autorização';
                //         else if (statusStaff === 'Inativo') badge.textContent = '🔒 Inativo';
                //         celulaEvento.appendChild(badge);
                //     }
                // }

                if (statusStaff === 'Deletado' || statusStaff === 'Pendente' || statusStaff === 'Inativo') {
                    const celulaEvento = row.cells[3];
                    if (celulaEvento) {
                        const badge = document.createElement('div');

                        if (statusStaff === 'Deletado') {
                            badge.className = `badge-statusstaff badge-statusstaff--deletado`;
                            badge.textContent = '🚫 DELETADO';
                        } else if (statusStaff === 'Inativo') {
                            badge.className = `badge-statusstaff badge-statusstaff--inativo`;
                            badge.textContent = '🔒 Inativo';
                        } else if (statusStaff === 'Pendente') {
                            const solAditivo = eventData.solicitacao_aditivo;
                            const aguardandoOrcamento = solAditivo && 
                                solAditivo.status === 'Autorizado' && 
                                !solAditivo.noOrcamento;

                            if (aguardandoOrcamento) {
                                badge.className = `badge-statusstaff badge-statusstaff--orcamento`;
                                badge.textContent = '📋 Aguardando Inclusão no Orçamento';
                            } else {
                                badge.className = `badge-statusstaff badge-statusstaff--pendente`;
                                badge.textContent = '⏳ Aguardando Autorização';
                            }
                        }

                        celulaEvento.appendChild(badge);
                    }
                }
                
            });

            inicializarToggleDeletados(eventsTableBody);

            const containerAcoes = document.getElementById('containerAcoesStaff'); // Supondo que você tenha um div para isso
            if (containerAcoes) {
                containerAcoes.innerHTML = ''; // Limpa para não duplicar
                const btnGerarTodosPendentes = document.createElement('button');
                btnGerarTodosPendentes.innerHTML = '📄 Gerar PDF de Pendentes';
                btnGerarTodosPendentes.className = 'btn-pdf-geral';
                
                btnGerarTodosPendentes.onclick = () => {
                    // Filtra apenas os eventos onde a Ajuda de Custo está pendente
                    const eventosPendentes = data.filter(ev => 
                        (ev.statuspgtoajdcto || '').toLowerCase().trim() === 'pendente'
                    );

                    if (eventosPendentes.length === 0) {
                        Swal.fire('Aviso', 'Não há eventos com Ajuda de Custo pendente para este funcionário.', 'info');
                        return;
                    }

                    // Chama a função passando a lista filtrada
                    gerarPdfFichaTrabalho(eventosPendentes);
                };
                containerAcoes.appendChild(btnGerarTodosPendentes);
            }

        } else {
            noResultsMessage.style.display = 'block';
            noResultsMessage.textContent = `Nenhum evento encontrado.`;
        }
    } catch (error) {
        console.error('Erro:', error);
        noResultsMessage.style.display = 'block';
        noResultsMessage.textContent = `Erro ao carregar dados: ${error.message}`;
    }
};

function inicializarToggleDeletados(eventsTableBody) {
    // Remove container anterior se existir
    document.getElementById('container-toggles-status')?.remove();

    const totalDeletados = eventsTableBody.querySelectorAll('tr.row-deletado').length;
    const totalInativos  = eventsTableBody.querySelectorAll('tr.row-inativo').length;

    // Não exibe nada se não houver nenhum dos dois
    if (totalDeletados === 0 && totalInativos === 0) return;

    const container = document.createElement('div');
    container.id = 'container-toggles-status';
    container.className = 'container-toggles-status';

    // Toggle de Deletados (só aparece se houver)
    if (totalDeletados > 0) {
        const labelDel = document.createElement('label');
        labelDel.className = 'label-toggle-status';
        labelDel.innerHTML = `
            <input type="checkbox" id="toggle-mostrar-deletados">
            Mostrar deletados
            <span class="badge-count-status badge-count-deletados">${totalDeletados}</span>
        `;
        container.appendChild(labelDel);
    }

    // Toggle de Inativos (só aparece se houver)
    if (totalInativos > 0) {
        const labelInat = document.createElement('label');
        labelInat.className = 'label-toggle-status';
        labelInat.innerHTML = `
            <input type="checkbox" id="toggle-mostrar-inativos">
            Mostrar inativos
            <span class="badge-count-status badge-count-inativos">${totalInativos}</span>
        `;
        container.appendChild(labelInat);
    }

    // Insere acima da tabela
    const tabela = eventsTableBody.closest('table');
    tabela?.parentElement?.insertBefore(container, tabela);

    // Evento toggle deletados
    document.getElementById('toggle-mostrar-deletados')?.addEventListener('change', function () {
        tabela.classList.toggle('mostrar-deletados', this.checked);
    });

    // Evento toggle inativos
    document.getElementById('toggle-mostrar-inativos')?.addEventListener('change', function () {
        tabela.classList.toggle('mostrar-inativos', this.checked);
    });
}

const formatarDataComStatus = (campo) => {
    if (!campo || campo === '[]') return '---';
    
    let str = typeof campo === 'string' ? campo.replace(/""/g, '"') : JSON.stringify(campo);
    if (str.startsWith('"') && str.endsWith('"')) str = str.substring(1, str.length - 1);
    
    let dados = [];
    try { 
        dados = JSON.parse(str); 
    } catch (e) { 
        return '---'; 
    }

    if (!Array.isArray(dados)) return '---';

    return dados.map(item => {
        const d = item.data.split('-');
        const dataBr = d.length === 3 ? `${d[2]}/${d[1]}/${d[0]}` : item.data;
        
        // ALTERAÇÃO AQUI: Se não houver status, ele fica como null ou vazio
        const status = item.status || null;
        
        // Se o status existir, monta o span. Se não, retorna apenas a data.
        if (status) {
            return `${dataBr} <span class="status-custom statusStaff-${status}">(${status})</span>`;
        } else {
            return `${dataBr}`; // Retorna sem o status e sem parênteses
        }
    }).join('<br>'); 
};

// const calcularTotaisLinha = (eventData) => {
//     const vlrCache = parseFloat(eventData.vlrcache || 0);
//     const vlrAlim = parseFloat(eventData.vlralimentacao || 0);
//     const vlrTransp = parseFloat(eventData.vlrtransporte || 0);
//     const qtdpessoas = parseInt(eventData.qtdpessoaslote || 1);
//     const multiplicador = (eventData.perfil === "Lote") ? qtdpessoas : 1;
//     const vlrAlimExtra = parseFloat(eventData.vlralimentacao || 0); // Valor fixo conforme sua regra

//     // Função interna para limpar JSONB corrompido ou com aspas duplicadas
//     const parseSeguro = (campo) => {
//         if (!campo || campo === '[]') return [];
//         try {
//             if (typeof campo === 'string') {
//                 // Remove aspas duplicadas e limpa o início/fim da string
//                 let strLimpa = campo.replace(/""/g, '"');
//                 if (strLimpa.startsWith('"') && strLimpa.endsWith('"')) {
//                     strLimpa = strLimpa.substring(1, strLimpa.length - 1);
//                 }
//                 return JSON.parse(strLimpa);
//             }
//             return campo;
//         } catch (e) {
//             console.error("Erro no parseSeguro:", e);
//             return [];
//         }
//     };

//     // 1. Quantidade de dias (Base)
//     const datas = parseSeguro(eventData.datasevento);
//     const qtdDias = datas.length;

//     // 2. Cálculos Iniciais (Diárias Normais)
//     let totalCache = (qtdDias * vlrCache) * multiplicador;
//     let totalAjdCusto = (qtdDias * (vlrAlim + vlrTransp)) * multiplicador;

//     // 3. Processamento de Diárias Dobradas
//     const dobras = parseSeguro(eventData.dtdiariadobrada);
//     const autorizadasDobra = dobras.filter(item => item.status === 'Autorizado').length;
    
//     const extrasDobraCache = (vlrCache * autorizadasDobra);
//     const extrasDobraAjd = (vlrAlimExtra * autorizadasDobra);

//     // 4. Processamento de Meias Diárias
//     const meias = parseSeguro(eventData.dtmeiadiaria);
//     const autorizadasMeia = meias.filter(item => item.status === 'Autorizado').length;
    
//     const extrasMeiaCache = ((vlrCache / 2) * autorizadasMeia);
//     const extrasMeiaAjd = (vlrAlimExtra * autorizadasMeia);

//     // 5. Ajustes e Caixinha
//     const vlrAjuste = (eventData.statusajustecusto === 'Autorizado') ? parseFloat(eventData.vlrajustecusto || 0) : 0;
//     const vlrCaixinha = (eventData.statuscaixinha === 'Autorizado') ? parseFloat(eventData.vlrcaixinha || 0) : 0;

//     // Consolidação dos Totais
//     totalCache += (extrasDobraCache + extrasMeiaCache + vlrAjuste + extrasDobraAjd + extrasMeiaAjd);
//     //totalAjdCusto += (extrasDobraAjd + extrasMeiaAjd);

//     return {
//         qtdDias,
//         totalCache,
//         totalAjdCusto,
//         vlrDobraCalculado: extrasDobraCache + extrasDobraAjd, // Para exibir na coluna
//         vlrMeiaCalculada: extrasMeiaCache + extrasMeiaAjd,    // Para exibir na coluna
//         totalGeral: totalCache + totalAjdCusto + vlrCaixinha
//     };
// };


const calcularTotaisLinha = (eventData) => {
    const vlrCache = parseFloat(eventData.vlrcache || 0);
    const vlrAlim = parseFloat(eventData.vlralimentacao || 0);
    const vlrTransp = parseFloat(eventData.vlrtransporte || 0);
    const qtdpessoas = parseInt(eventData.qtdpessoaslote || 1);
    const perfil = eventData.perfil || '';
    const multiplicador = (perfil === "Lote") ? qtdpessoas : 1;
    const vlrAlimExtra = parseFloat(eventData.vlralimentacao || 0);

    const parseSeguro = (campo) => {
        if (!campo || campo === '[]') return [];
        try {
            if (typeof campo === 'string') {
                let strLimpa = campo.replace(/""/g, '"');
                if (strLimpa.startsWith('"') && strLimpa.endsWith('"')) {
                    strLimpa = strLimpa.substring(1, strLimpa.length - 1);
                }
                return JSON.parse(strLimpa);
            }
            return campo;
        } catch (e) {
            console.error("Erro no parseSeguro:", e);
            return [];
        }
    };

    // 1. Quantidade de dias e cálculo por perfil
    const datas = parseSeguro(eventData.datasevento);
    const qtdDias = datas.length;

    let totalCache = 0;
    let totalAjdCusto = 0;

    // MESMA LÓGICA DO calcularValorTotal
    datas.forEach(dateStr => {
        const date = new Date(dateStr);
        
        if (perfil === "Freelancer") {
            totalCache += vlrCache;
            totalAjdCusto += vlrAlim + vlrTransp;
        } else if (perfil === "Lote") {
            totalCache += vlrCache * qtdpessoas;
            totalAjdCusto += (vlrAlim + vlrTransp) * qtdpessoas;
        } else {
            // CLT/Padrão: cachê só em fim de semana/feriado
            if (isFinalDeSemanaOuFeriado(date)) {
                totalCache += vlrCache;
            }
            totalAjdCusto += vlrAlim + vlrTransp;
        }
    });

    // 2. Diárias Dobradas
    const dobras = parseSeguro(eventData.dtdiariadobrada);
    const autorizadasDobra = dobras.filter(item => item.status === 'Autorizado').length;
    const extrasDobraCache = vlrCache * autorizadasDobra;
    const extrasDobraAjd = vlrAlimExtra * autorizadasDobra;

    // 3. Meias Diárias
    const meias = parseSeguro(eventData.dtmeiadiaria);
    const autorizadasMeia = meias.filter(item => item.status === 'Autorizado').length;
    const extrasMeiaCache = (vlrCache / 2) * autorizadasMeia;
    const extrasMeiaAjd = vlrAlimExtra * autorizadasMeia;

    // 4. Ajustes e Caixinha
    const vlrAjuste = (eventData.statusajustecusto === 'Autorizado') ? parseFloat(eventData.vlrajustecusto || 0) : 0;
    const vlrCaixinha = (eventData.statuscaixinha === 'Autorizado') ? parseFloat(eventData.vlrcaixinha || 0) : 0;

    totalCache += extrasDobraCache + extrasMeiaCache + vlrAjuste + extrasDobraAjd + extrasMeiaAjd;

    return {
        qtdDias,
        totalCache,
        totalAjdCusto,
        vlrDobraCalculado: extrasDobraCache + extrasDobraAjd,
        vlrMeiaCalculada: extrasMeiaCache + extrasMeiaAjd,
        totalGeral: totalCache + totalAjdCusto + vlrCaixinha
    };
};


function aplicarCoresAsOpcoes(selectElementId) {
  //  console.log("Aplicando cores às opções do select:", selectElementId);
    const selectElement = document.getElementById(selectElementId);
    if (selectElement) {
        for (let i = 0; i < selectElement.options.length; i++) {
            const option = selectElement.options[i];
            option.classList.remove('status-Pendente', 'status-Autorizado', 'status-Rejeitado');
            if (option.value) {
                option.classList.add('status-' + option.value);
                console.log("Option Value:", option.value);
            }
        }
    }
}

function aplicarCorNoSelect(selectElement) {
   // console.log("Aplicando cores no select:", selectElement.id);
    const statusAtual = selectElement.value;
    selectElement.classList.remove('status-Pendente', 'status-Autorizado', 'status-Rejeitado');
    if (statusAtual) {
        selectElement.classList.add('status-' + statusAtual);
        console.log("Status Atual:", statusAtual);
    }
}

function aplicarCorStatusInput(elementoInput) {
   // console.log("Aplicando cores no input:", elementoInput.id);
    elementoInput.classList.remove('status-Pendente', 'status-Autorizado', 'status-Rejeitado');
    const statusAtual = elementoInput.value;
    if (statusAtual) {
        elementoInput.classList.add('status-' + statusAtual);
        console.log("Status Atual INPUT:", statusAtual);
    }
}

// async function limparCamposStaffParcial() {

//     currentEditingStaffEvent = null; // Garanta que esta também seja limpa
//     isFormLoadedFromDoubleClick = false;

//     const previewFoto = document.getElementById('previewFoto');
//     const fileName = document.getElementById('fileName');
//     const fileInput = document.getElementById('file');
//     const uploadHeader = document.getElementById('uploadHeader');
//     const linkFotoFuncionarios = document.getElementById('linkFotoFuncionarios');
//     const nomeFuncionarioExibido = document.getElementById('nomeFuncionarioExibido');
//     const labelFuncionario = document.getElementById('labelFuncionario');

//     if (labelFuncionario) {
//         labelFuncionario.style.display = "none"; // esconde
//         labelFuncionario.textContent = "";       // limpa o texto
//         labelFuncionario.style.color = "";       // reseta cor
//         console.log("Label Funcionário limpo.");
//     }

//     if (previewFoto) {
//         previewFoto.src = "#";
//         previewFoto.style.display = "none";
//         console.log("Preview da foto limpo.");
//     }
//     if (fileName) {
//         fileName.textContent = "Nenhum arquivo selecionado";
//     }
//     if (fileInput) {
//         fileInput.value = "";
//     }
//     if (uploadHeader) {
//         uploadHeader.style.display = "block";
//     }
//     if (linkFotoFuncionarios) {
//         linkFotoFuncionarios.value = "";
//     }
//     if (nomeFuncionarioExibido) {
//         nomeFuncionarioExibido.textContent = "";
//     }

//     // 1. Limpeza de IDs e Nome do Staff/Funcionário
//     document.querySelector("#idStaff").value = '';
//     document.querySelector("#idFuncionario").value = '';
//     const nmFuncionario = document.getElementById("nmFuncionario");
//     if (nmFuncionario) nmFuncionario.value = ''; 

//     const descfuncaoElement = document.getElementById('nmFuncaoSelect'); 
//     const descfuncaoAtual = (descfuncaoElement ? descfuncaoElement.value : '').trim();
//     const isAjudanteDeMarcacao = descfuncaoAtual.toUpperCase() === 'AJUDANTE DE MARCAÇÃO';
//     const isFiscalDeMarcacao = descfuncaoAtual.toUpperCase() === 'FISCAL DE MARCAÇÃO';

//     document.querySelector("#apelidoFuncionario").value = '';
//     const apelido = document.getElementById("apelidoFuncionario");
//     if (apelido) apelido.value = '';

//     document.querySelector("#perfilFuncionario").value = '';
//     const perfil = document.getElementById("perfilFuncionario");
//     if (perfil) perfil.value = '';

//     // 2. Limpeza de valores financeiros
//     document.querySelector("#vlrCusto").value = ''; // Cachê
//     document.querySelector("#transporte").value = '';
//     document.querySelector("#alimentacao").value = '';
//     document.querySelector("#caixinha").value = '';
//     document.getElementById('vlrTotal').value = '';

//     const ajusteCustoInput = document.querySelector("#ajusteCusto");
//     if (ajusteCustoInput) ajusteCustoInput.style.display = 'none'; // 🎯 Novo

//     const caixinhaInput = document.querySelector("#caixinha");
//     if (caixinhaInput) caixinhaInput.style.display = 'none'; // 🎯 Novo

//     // 3. Limpeza de Níveis de Experiência (Checkboxes)
    
//     if (isAjudanteDeMarcacao) {
//         console.log("Função 'Ajudante de Marcação' detectada. Pulando a limpeza dos Níveis de Experiência.");
//     } else {
//         document.getElementById('Seniorcheck').checked = false;
//         document.getElementById('Plenocheck').checked = false;
//         document.getElementById('Juniorcheck').checked = false;
//         document.getElementById('Basecheck').checked = false;
//         document.getElementById('Fechadocheck').checked = false;
//         console.log("Níveis de experiência limpos.");
//     }
//     if (isFiscalDeMarcacao) {
//         console.log("Função 'Fiscal de Marcação' detectada. Pulando a limpeza dos Níveis de Experiência.");
//     } else {
//         document.getElementById('Seniorcheck2').checked = false;
//         document.getElementById('Seniorcheck').checked = false;
//         document.getElementById('Plenocheck').checked = false;
//         document.getElementById('Juniorcheck').checked = false;
//         document.getElementById('Basecheck').checked = false;
//         document.getElementById('Fechadocheck').checked = false;
//         console.log("Níveis de experiência limpos.");
//     }
    
//     // 4. 🛑 LIMPEZA TOTAL DE DATAS (Flatpickr)
//     // Usamos o método clear() em todas as instâncias do flatpickr.
    
//     // Período do Evento
//     // if (typeof datasEventoPicker !== 'undefined' && datasEventoPicker && typeof datasEventoPicker.clear === 'function') {
//     //     datasEventoPicker.clear();
//     //     console.log("Datas do Evento (Flatpickr) limpas.");
//     // }

//     // Diária Dobrada
//     const diariaDobradaCheck = document.getElementById("diariaDobradacheck");
//     if (typeof window.diariaDobradaPicker !== 'undefined' && window.diariaDobradaPicker && typeof window.diariaDobradaPicker.clear === 'function') {
//         diariaDobradaPicker.clear();
//     }
//     if (diariaDobradaCheck) {
//         diariaDobradaCheck.checked = false; 
//         // Oculta o campo de data (input do Flatpickr)
//         const diariaDobradaInput = document.getElementById("datasDobrada"); // ⚠️ Verifique o ID do input de datas dobradas
//         if (diariaDobradaInput) {
//             diariaDobradaInput.style.display = 'none'; // 🎯 Novo: Oculta o input de datas
//         }
//     }
    
//     // Meia Diária
//     const meiaDiariaCheck = document.getElementById("meiaDiariacheck");
//     if (typeof window.meiaDiariaPicker !== 'undefined' && window.meiaDiariaPicker && typeof window.meiaDiariaPicker.clear === 'function') {
//         meiaDiariaPicker.clear();
//     }
//     if (meiaDiariaCheck) {
//         meiaDiariaCheck.checked = false; 
//         // Oculta o campo de data (input do Flatpickr)
//         const meiaDiariaInput = document.getElementById("datasMeiaDiaria");
//         if (meiaDiariaInput) {
//             meiaDiariaInput.style.display = 'none'; // 🎯 Novo: Oculta o input de datas
//         }
//     }

//     // 5. ⚠️ Limpeza de outros Checkboxes (Caixinha/AjusteCusto)
//     const caixinhaCheck = document.getElementById("Caixinhacheck");
//     if (caixinhaCheck) {
//         caixinhaCheck.checked = false;
//     }
    
//     const ajusteCustoCheck = document.getElementById("ajusteCustocheck");
//     if (ajusteCustoCheck) {
//         ajusteCustoCheck.checked = false;
//     }

//     // ✅ Limpeza de PDFs por classe
//     const fileNamesPDF = document.querySelectorAll('.fileNamePDF');
//     const fileInputsPDF = document.querySelectorAll('.filePDFInput');
//     const hiddenInputsPDF = document.querySelectorAll('.hiddenPDF');

//     fileNamesPDF.forEach(p => {
//         p.textContent = "Nenhum arquivo selecionado";
//     });
//     fileInputsPDF.forEach(input => {
//         input.value = "";
//     });
//     hiddenInputsPDF.forEach(input => {
//         input.value = "";
//     });
//     console.log("Campos de arquivos PDF limpos.");


//     const beneficioTextarea = document.getElementById('descBeneficio');
//     if (beneficioTextarea) {
//         beneficioTextarea.style.display = 'none'; // Oculta o textarea
//         beneficioTextarea.required = false;      // Remove a obrigatoriedade
//         beneficioTextarea.value = '';            // Limpa o conteúdo
//     }

//     const ajusteCustoTextarea = document.getElementById('descAjusteCusto');
//     if (ajusteCustoTextarea) {
//         ajusteCustoTextarea.style.display = 'none'; // Oculta o textarea
//         ajusteCustoTextarea.required = false;      // Remove a obrigatoriedade
//         ajusteCustoTextarea.value = '';            // Limpa o conteúdo
//     }

//     const descCaixinhaTextarea = document.getElementById('descCaixinha');
//     if (descCaixinhaTextarea) {
//         descCaixinhaTextarea.style.display = 'none'; // Oculta o textarea
//         descCaixinhaTextarea.required = false;      // Remove a obrigatoriedade
//         descCaixinhaTextarea.value = '';            // Limpa o conteúdo
//     }

//     const statusMeiaDiaria = document.getElementById('statusMeiaDiaria');
//     if (statusMeiaDiaria) statusMeiaDiaria.value = 'Autorização de Meia Diária';

//     const statusDiariaDobrada = document.getElementById('statusDiariaDobrada');
//     if (statusDiariaDobrada) statusDiariaDobrada.value = 'Autorização de Diária Dobrada';

//     const statusPgto = document.getElementById('statuspgto');
//     if (statusPgto) statusPgto.value = '';

//     const statusAjusteCusto = document.getElementById('statusAjusteCusto');
//     if (statusAjusteCusto) {
//         statusAjusteCusto.value = 'Autorização do Ajuste de Custo';
//         statusAjusteCusto.style.display = 'none'; // 🎯 Novo: Oculta o select
//     }

//     const statusCaixinha = document.getElementById('statuscaixinha');
//     if (statusCaixinha) {
//         statusCaixinha.value = 'Autorização da Caixinha';
//         statusCaixinha.style.display = 'none'; // 🎯 Novo: Oculta o select
//     }

//     const containerStatusDiariaDobrada = document.getElementById('containerStatusDiariaDobrada');
//     const containerStatusMeiaDiaria = document.getElementById('containerStatusMeiaDiaria');

//     if (containerStatusDiariaDobrada) {
//         containerStatusDiariaDobrada.innerHTML = '';
//         containerStatusDiariaDobrada.style.display = 'none';
//     }

//     if (containerStatusMeiaDiaria) {
//         containerStatusMeiaDiaria.innerHTML = '';
//         containerStatusMeiaDiaria.style.display = 'none';
//     }

//     const avaliacaoSelect = document.getElementById('avaliacao');
//     if (avaliacaoSelect) {
//         avaliacaoSelect.value = ''; // Define para o valor da opção vazia (se existir, ex: <option value="">Selecione...</option>)
//         // avaliacaoSelect.selectedIndex = 0; // Alternativa: seleciona a primeira opção
//         const tarjaAvaliacao = document.getElementById('tarjaAvaliacao');
//         if (tarjaAvaliacao) {
//             tarjaAvaliacao.className = 'tarja-avaliacao'; // Reseta para a classe padrão
//             tarjaAvaliacao.textContent = ''; // Limpa o texto
//             console.log("Campos de avaliação (select e tarja) limpos.");
//         }
//     }

//     const tabelaCorpo = document.getElementById("eventsDataTable").getElementsByTagName("tbody")[0];
//     if (tabelaCorpo) {
//         // Remove todas as linhas filhas do tbody
//         while (tabelaCorpo.firstChild) {
//             tabelaCorpo.removeChild(tabelaCorpo.firstChild);
//         }
//         console.log("Corpo da tabela (tabela) limpo.");

//         // Adiciona uma linha "vazia" de volta, se for o comportamento padrão desejado
//         let emptyRow = tabelaCorpo.insertRow();
//         let emptyCell = emptyRow.insertCell(0);
//         emptyCell.colSpan = 20; // Ajuste para o número total de colunas da sua tabela
//         emptyCell.textContent = "Nenhum item adicionado.";
//         emptyCell.style.textAlign = "center";
//         emptyCell.style.padding = "20px";
//         console.log("Linha vazia adicionada à tabela 'tabela'.");
//     } else {
//         console.warn("Tabela com ID 'tabela' ou seu tbody não encontrado para limpeza. Verifique se o ID está correto.");
//     }


//     limparCamposComprovantes();
//     limparFoto();


//     // 6. Notifica o usuário
//     Swal.fire({
//         title: "Pronto para o próximo!",
//         text: "Campos de funcionário/cachê e datas limpos. Prossiga com o novo cadastro.",
//         icon: "info",
//         timer: 2000,
//         showConfirmButton: false
//     });


// }


async function verificaStaff() {

    console.log("%cCarregando Staff...", "background: blue;");
    eventsTableBody           = document.querySelector('#eventsDataTable tbody');
    noResultsMessage          = document.getElementById('noResultsMessage');
    idFuncionarioHiddenInput  = document.getElementById('idFuncionario');
    apelidoFuncionarioInput   = document.getElementById('apelidoFuncionario');
    perfilFuncionarioInput    = document.getElementById('perfilFuncionario');
    previewFotoImg            = document.getElementById('previewFoto');
    fileNameSpan              = document.getElementById('fileName');
    uploadHeaderDiv           = document.getElementById('uploadHeader');
    fileInput                 = document.getElementById('file');
    avaliacaoSelect           = document.getElementById('avaliacao');
    tarjaDiv                  = document.getElementById('tarjaAvaliacao');

    idStaffInput              = document.getElementById('idStaff');
    idStaffEventoInput        = document.getElementById('idStaffEvento');
    idFuncaoInput             = document.getElementById('idFuncao');
    descFuncaoSelect          = document.getElementById('descFuncao');
    vlrCustoInput             = document.getElementById('vlrCusto');
    ajusteCustoInput          = document.getElementById('ajusteCusto');
    transporteInput           = document.getElementById('transporte');
    alimentacaoInput          = document.getElementById('alimentacao');
    statusPgtoAjudaCustoInput = document.getElementById('statusPgtoAjudaCusto');
    caixinhaInput             = document.getElementById('caixinha');
    descBeneficioTextarea     = document.getElementById('descBeneficio');
    nmLocalMontagemSelect     = document.getElementById('nmLocalMontagem');
    nmPavilhaoSelect          = document.getElementById('nmPavilhao');
    idClienteInput            = document.getElementById('idCliente');
    nmClienteSelect           = document.getElementById('nmCliente');
    idEventoInput             = document.getElementById('idEvento');
    nmEventoSelect            = document.getElementById('nmEvento');
    datasEventoInput          = document.getElementById('datasEvento');

    ajusteCustocheck          = document.getElementById('ajusteCustocheck');
    campoAjusteCusto          = document.getElementById('campoAjusteCusto');
    ajusteCustoTextarea       = document.getElementById('descAjusteCusto');
    campoStatusajusteCusto    = document.getElementById('campoStatusAjusteCusto');
    statusAjusteCustoInput    = document.getElementById('statusAjusteCusto');
    selectStatusAjusteCusto   = document.getElementById('selectStatusAjusteCusto');

    vlrTotalInput             = document.getElementById('vlrTotal');
    vlrTotalCacheInput = document.getElementById('vlrTotalCache');
    vlrTotalAjdCustoInput = document.getElementById('vlrTotalAjdCusto');
    

    caixinhacheck             = document.getElementById('Caixinhacheck');
    campoCaixinha             = document.getElementById('campoCaixinha');
    campoPgtoCaixinha         = document.getElementById('campoPgtoCaixinha');
    descCaixinhaTextarea      = document.getElementById('descCaixinha');
    campoStatusCaixinha       = document.getElementById('campoStatusCaixinha');
    statusCaixinhaInput       = document.getElementById('statusCaixinha');
    selectStatusCaixinha      = document.getElementById('selectStatusCaixinha');
    statusPgtoCaixinhaInput   = document.getElementById('statusPgtoCaixinha')

    setorInput                = document.getElementById('setor');
    statusPagtoInput          = document.getElementById('statusPgto');

    diariaDobradaInput        = document.getElementById('diariaDobrada');
    diariaDobradacheck        = document.getElementById('diariaDobradacheck');
    campoDiariaDobrada        = document.getElementById('campoDiariaDobrada');
    descDiariaDobradaTextarea = document.getElementById('descDiariaDobrada');
    campoStatusDiariaDobrada  = document.getElementById('campoStatusDiariaDobrada');
    statusDiariaDobradaInput  = document.getElementById('statusDiariaDobrada');

    meiaDiariaInput           = document.getElementById('meiaDiaria');
    meiaDiariacheck           = document.getElementById('meiaDiariacheck');
    campoMeiaDiaria           = document.getElementById('campoMeiaDiaria');
    descMeiaDiariaTextarea    = document.getElementById('descMeiaDiaria');
    descCustoFechadoTextarea  = document.getElementById('descCustoFechado');
    campoStatusMeiaDiaria     = document.getElementById('campoStatusMeiaDiaria');
    statusMeiaDiariaInput     = document.getElementById('statusMeiaDiaria');

    containerDiariaDobradaCheck  = document.querySelector('#diariaDobradacheck')?.closest('.input-container-checkbox');
    containerMeiaDiariacheck     = document.querySelector('#meiaDiariacheck')?.closest('.input-container-checkbox');
    containerStatusDiariaDobrada = document.getElementById('containerStatusDiariaDobrada');
    containerStatusMeiaDiaria    = document.getElementById('containerStatusMeiaDiaria');

    check50                   = document.getElementById('check50');
    check100                  = document.getElementById('check100');

    container1                = document.getElementById('labelFileAjdCusto')?.parentElement;
    container2                = document.getElementById('labelFileAjdCusto2')?.parentElement;
    mensagemConcluido         = document.getElementById('mensagemConcluido');

    seniorCheck               = document.getElementById('Seniorcheck');
    seniorCheck2              = document.getElementById('Seniorcheck2');
    plenoCheck                = document.getElementById('Plenocheck');
    juniorCheck               = document.getElementById('Juniorcheck');
    baseCheck                 = document.getElementById('Basecheck');
    fechadoCheck              = document.getElementById('Fechadocheck');
    liberadoCheck             = document.getElementById('Liberadocheck');

    qtdPessoasInput           = document.getElementById('qtdPessoas');
    idEquipeInput             = document.getElementById('idEquipe');
    nmEquipeSelect            = document.getElementById('nmEquipe');

    DescViagem1
    DescViagem2
    DescViagem3

    viagem1Check = document.getElementById('viagem1Check')
    viagem2Check = document.getElementById('viagem2Check')
    viagem3Check = document.getElementById('viagem3Check')

    configurarPreviewPDF();
    configurarPreviewImagem();
    inicializarFlatpickrsGlobais();

//  functions que deixaram de usar o dom para multiplas chamadas
    registrarListenersNivel();
    camposDiarias();
    
    carregarFuncaoStaff();
    carregarFuncionarioStaff();
    carregarClientesStaff();
    carregarEventosStaff();
    carregarLocalMontStaff();

    configurarFlatpickrs();

    setTimeout(() => {
        if (window.datasEventoPicker && typeof atualizarContadorEDatas === 'function') {
            // Se o picker está inicializado, chame a atualização
            atualizarContadorEDatas(window.datasEventoPicker.selectedDates);
            console.log("✅ [verificaStaff] Contador forçado após inicialização.");
        } else {
            console.warn("⚠️ [verificaStaff] Picker principal não está pronto para forçar a atualização.");
        }
    }, 0);    


    const botaoEnviar = document.querySelector("#Enviar");
    const botaoLimpar = document.querySelector("#Limpar");

    const form = document.querySelector("#form");

    if (!botaoEnviar || !form) {
        console.error("Formulário ou botão não encontrado no DOM.");
        return;
    }

    const tarja = document.querySelector("#avaliacao");
    tarja.addEventListener("change", async function () {   
    mostrarTarja();
    });

    
    document.getElementById('btnGerarFichaPendente').onclick = async function() {        
        // Configuração de estilo comum
        const configEstilo = {
            width: '400px', // Força o alerta a ser mais estreito
            customClass: {
                container: 'swal-compacto',
                title: 'swal-titulo-menor',
                htmlContainer: 'swal-texto-menor'
            },
            didOpen: () => {
                // Ajuste direto via JavaScript (garante que mude)
                const container = Swal.getHtmlContainer();
                if (container) container.style.fontSize = '14px';
                
                const title = Swal.getTitle();
                if (title) title.style.fontSize = '18px';

                const input = Swal.getInput();
                if (input) {
                    input.style.fontSize = '14px';
                    input.style.height = '35px';
                }
            }
        };

        // 1. Primeiro Filtro
        const { value: tipoFiltro } = await Swal.fire({
            ...configEstilo, // Espalha as configurações de estilo aqui
            title: 'Gerar Ficha de Trabalho',
            input: 'select',
            inputOptions: {
                'todos': 'Todos os Eventos',
                'a_realizar': 'Eventos a Realizar (Futuros)',
                'realizados': 'Eventos Realizados (Passados)'
            },
            inputPlaceholder: 'Selecione uma opção',
            showCancelButton: true,
            confirmButtonText: 'Próximo',
            cancelButtonText: 'Cancelar'
        });

        if (!tipoFiltro) return;

        let dataCorteInicio = null;
        let dataCorteFim = null;

        // 2. Segundo Filtro (Realizados)
        if (tipoFiltro === 'realizados') {
            const { value: periodo } = await Swal.fire({
                ...configEstilo, // Espalha as configurações de estilo aqui
                title: 'Filtrar por Período?',
                html: `
                    <input type="month" id="mesFiltro" class="swal2-input" style="font-size: 14px; height: 35px; width: 80%;">
                    <p style="font-size: 12px; color: gray; margin-top: 10px;">Deixe em branco para ver todos os passados</p>
                `,
                showCancelButton: true,
                confirmButtonText: 'Filtrar',
                cancelButtonText: 'Cancelar',
                preConfirm: () => {
                    return document.getElementById('mesFiltro').value;
                }
            });
            
            if (periodo) {
                const [ano, mes] = periodo.split('-');
                dataCorteInicio = new Date(ano, mes - 1, 1);
                dataCorteFim = new Date(ano, mes, 0);
            }
        }

        processarGeracaoFicha(tipoFiltro, dataCorteInicio, dataCorteFim);
    };

    botaoLimpar.addEventListener("click", function (event) {
        event.preventDefault(); // Previne o envio padrão do formulário
        form.reset();
        limparCamposStaff();
    });

    

    const labelFileAjdCusto = document.getElementById('labelFileAjdCusto');
    const labelFileCaixinha = document.getElementById('labelFileCaixinha');

    // Lógica para o comprovante de Ajuda de Custo
    labelFileAjdCusto.addEventListener('click', (event) => {       
        const vlrJantar = parseFloat(alimentacaoInput.value.replace(',', '.') || 0.00);
        const vlrTransporte = parseFloat(transporteInput.value.replace(',', '.') || 0.00);

        console.log("Verificando valores para Ajuda de Custo:", vlrJantar, vlrTransporte, statusPgtoAjudaCustoInput.value);
        // Se os valores estiverem zerados, previne a ação e exibe o alerta  TESTAR
        if (vlrJantar === 0 && vlrTransporte === 0) {
            event.preventDefault(); // Impede a abertura do modal de upload
            Swal.fire({
                icon: 'warning',
                title: 'Não é possível inserir comprovante',
                text: 'Os valores de Jantar e Transporte devem ser maiores que zero para inserir um comprovante.',
            });
        }

        const status = statusPgtoAjudaCustoInput.value.toLowerCase();
        if (status !== 'pago') {
            event.preventDefault(); // Impede a abertura do modal de upload
            Swal.fire({
                icon: 'warning',
                title: 'Não é possível inserir comprovante',
                text: 'O status de pagamento deve ser "Pago" para inserir um comprovante do valor Integral.',
            });
        }
    });

    labelFileAjdCusto2.addEventListener('click', (event) => {       
        const vlrJantar = parseFloat(alimentacaoInput.value.replace(',', '.') || 0.00);
        const vlrTransporte = parseFloat(transporteInput.value.replace(',', '.') || 0.00);

        console.log("Verificando valores para Ajuda de Custo:", vlrJantar, vlrTransporte, statusPgtoAjudaCustoInput.value);
        // Se os valores estiverem zerados, previne a ação e exibe o alerta  TESTAR
        if (vlrJantar === 0 && vlrTransporte === 0) {
            event.preventDefault(); // Impede a abertura do modal de upload
            Swal.fire({
                icon: 'warning',
                title: 'Não é possível inserir comprovante',
                text: 'Os valores de Jantar e Transporte devem ser maiores que zero para inserir um comprovante.',
            });
        }

        const status50 = statusPgtoAjudaCustoInput.value.toLowerCase();

        if (status50 !== 'pago50') {
            event.preventDefault(); // Impede a abertura do modal de upload
            Swal.fire({
                icon: 'warning',
                title: 'Não é possível inserir comprovante',
                text: 'O status de pagamento deve ser "Pago 50%" para inserir um comprovante de 50% do valor pago.',
            });
        }
    });

    // Lógica para o comprovante de Caixinha
    labelFileCaixinha.addEventListener('click', (event) => {
        const vlrCaixinha = parseFloat(caixinhaInput.value.replace(',', '.') || 0.00);

        if (vlrCaixinha === 0) {
            event.preventDefault(); // Impede a abertura do modal de upload
            Swal.fire({
                icon: 'warning',
                title: 'Não é possível inserir comprovante',
                text: 'O valor da Caixinha deve ser maior que zero para inserir um comprovante.',
            });
        }
    });

    atualizarLayout();

    check50.addEventListener('change', () => {
        if (check50.checked) {
            check100.checked = false; // Desmarca o outro
            atualizarLayout();
        }

    });

    check100.addEventListener('change', () => {
        if (check100.checked) {
            check50.checked = false; // Desmarca o outro
            atualizarLayout();
        }

    });

    nmEventoSelect.addEventListener('change', debouncedOnCriteriosChanged);
    nmClienteSelect.addEventListener('change', debouncedOnCriteriosChanged);
    nmLocalMontagemSelect.addEventListener('change', debouncedOnCriteriosChanged);
    setorInput.addEventListener('change', debouncedOnCriteriosChanged);
    descFuncaoSelect.addEventListener('change', () => {
        const idorcamento = getUrlParameter('idorcamento');
        const idfuncao = descFuncaoSelect.value;
        const idmontagem = nmLocalMontagemSelect.value;
        carregarPavilhaoStaff(idmontagem, idorcamento, idfuncao);
    });

    baseCheck.addEventListener('change', debouncedOnCriteriosChanged);
    juniorCheck.addEventListener('change', debouncedOnCriteriosChanged);
    plenoCheck.addEventListener('change', debouncedOnCriteriosChanged);
    seniorCheck.addEventListener('change', debouncedOnCriteriosChanged);
    seniorCheck2.addEventListener('change', debouncedOnCriteriosChanged);

    
    ajusteCustoInput.addEventListener('change', () => {
        let valor = ajusteCustoInput.value.replace(',', '.');
        if (!isNaN(parseFloat(valor))) {
            ajusteCustoInput.value = parseFloat(valor).toFixed(2).replace('.', ',');
        } else {
            ajusteCustoInput.value = '0,00';
        }
        console.log("formatação do valor :","background:yellow;", ajusteCustoInput.value)
        // if (typeof calcularValorTotal === 'function') {
        //     calcularValorTotal();
        // }
    });

    const selectAjusteCusto = document.getElementById('selectStatusAjusteCusto');

    if (selectAjusteCusto) {
        selectAjusteCusto.addEventListener('change', () => {
            aplicarCorNoSelect(selectAjusteCusto);
            statusAjusteCustoInput.value = selectStatusAjusteCusto.value;
            console.log("Status de Ajuste de Custo sincronizado para:", statusAjusteCustoInput.value);
        });
    }

    const cacheBaseLiberado = () => {
        const selectStatus = document.getElementById("selectStatusCustoFechado")?.value;
        const inputStatus = document.getElementById("statusCustoFechadoTexto")?.value;
        
        const status = ((selectStatus && selectStatus !== "none") ? selectStatus : (inputStatus || "")).trim();
        
        console.log("🔍 [Trava Segurança] Status atual:", status);

        // Se o status for VAZIO ou "none", significa que é um NOVO registro 
        // ou o usuário ainda está preenchendo. Vamos LIBERAR.
        if (status === "" || status === "none") {
            return true; 
        }

        // Se o status já existe e é impeditivo, aí sim BLOQUEIA.
        if (status === "Pendente" || status === "Rejeitado") {
            return false; 
        }

        // Para qualquer outro status (Autorizado, Pago, etc), LIBERA.
        return true;
    };

        // 1. Lógica para Ajuste de Custo
    // 1. Lógica para Ajuste de Custo (Corrigida para níveis de acesso)
    ajusteCustocheck.addEventListener('change', async (e) => {
        const isChecked = ajusteCustocheck.checked;
        const textarea = document.getElementById('descAjusteCusto');
        
        // Elementos do Status (Ajuste esses IDs conforme o seu HTML real)
        const inputStatus = document.getElementById('statusAjusteCusto'); 
        const selectStatus = document.getElementById('selectStatusAjusteCusto');

        
        // Tenta encontrar o container/div que envolve o status (geralmente tem um ID parecido)
        const wrapperStatus = document.getElementById('campoStatusAjusteCusto') || 
                            inputStatus?.closest('.form2') || 
                            inputStatus?.parentElement;

        // TRAVA DE SEGURANÇA
        if (isChecked && !cacheBaseLiberado()) {
            e.preventDefault();
            ajusteCustocheck.checked = false;
            return Swal.fire({
                icon: 'warning',
                title: 'Solicitação Bloqueada',
                text: 'Você não pode adicionar Ajuste de Custo enquanto o Cachê Base estiver Pendente.',
                confirmButtonColor: '#3085d6'
            });
        }

        let vOriginal = currentEditingStaffEvent ? parseFloat(currentEditingStaffEvent.vlrajustecusto || 0) : 0;
        let dOriginal = currentEditingStaffEvent ? currentEditingStaffEvent.descajustecusto || '' : '';
        let sOriginal = currentEditingStaffEvent ? currentEditingStaffEvent.statusajustecusto || '' : '';

        if (!isChecked) {
            // Lógica de fechamento (Remover)
            if (sOriginal !== 'Pendente' && sOriginal !== '' && sOriginal !== null) {
                e.preventDefault();
                ajusteCustocheck.checked = true;
                return Swal.fire('Erro!', `Status "${sOriginal}" não permite remoção.`, 'error');
            }
            
            campoAjusteCusto.style.display = 'none';
            textarea.style.display = 'none';
            if (wrapperStatus) wrapperStatus.style.display = 'none';
            
            ajusteCustoInput.value = '0,00';
            textarea.value = '';
        } else {
            // 1. Exibe os containers de texto e valor primeiro
            campoAjusteCusto.style.display = 'block';
            textarea.style.display = 'block';

            // 2. Localiza o container do status (O ID que sua função usa como 'campo' + baseId)
            // Se você passa 'StatusAjusteCusto', ela procura 'campoStatusAjusteCusto'
            const wrapperStatus = document.getElementById('campoStatusAjusteCusto');
            
            if (wrapperStatus) {
                // FORÇAMOS a exibição antes da função checar
                wrapperStatus.style.setProperty('display', 'block', 'important');
            }

            // 3. Define o valor inicial no input escondido para a função poder ler
            const campoInputMinúsculo = document.getElementById('statusajustecusto');
            if (campoInputMinúsculo) {
                campoInputMinúsculo.value = sOriginal || '';
            }

            alternarStatusPorPermissao('StatusAjusteCusto', temPermissaoMaster);

            ajusteCustoInput.value = vOriginal.toFixed(2).replace('.', ',');
            textarea.value = dOriginal;
        }
    })

   
    document.getElementById("selectStatusAjusteCusto")?.addEventListener("change", async function() {
        const novoStatus = this.value;
        const inputDescAjuste = document.getElementById('descAjusteCusto');
        const statusAnterior = window.statusAnteriorAjusteCusto || "";

        // Normalizamos os status de pagamento do banco
        const statusPgto = (window.statusPgtoCacheOriginalDoBanco || "").trim().toLowerCase();
        const statusPgtoAjuda = (window.statusPgtoAjudaOriginalDoBanco || "").trim().toLowerCase();
        
        // Regra: Trava se Cachê OU Ajuda estiverem como "pago"
        const isPago = statusPgto === "pago" || statusPgtoAjuda === "pago";

        if (isPago && novoStatus !== statusAnterior) {
            let labelTexto = "";
            let htmlConteudo = "";
            const labelVermelha = (texto) => `<span style="color: #ff0000; font-weight: bold;">${texto}</span>`;

            // CENÁRIO A: CACHÊ PAGO
            if (statusPgto === "pago") {
                labelTexto = statusPgtoAjuda === "pago" ? "Cachê e Ajuda de Custo PAGOS" : "Cachê PAGO";
                htmlConteudo = `<b>Alerta:</b> ${labelVermelha(labelTexto)}<br><br>` +
                    `Este item já consta como <b>PAGO</b> no financeiro.<br><br>` +
                    `Mudar o Ajuste para <b>${novoStatus}</b> alterará o valor total e gerará divergência no caixa.<br><br>` +
                    `A reversão impactará o fechamento financeiro. Dados alterados não irão bater com os valores pagos anteriormente.`;
            } 
            // CENÁRIO B: APENAS AJUDA PAGA
            else {
                labelTexto = "Ajuda de Custo PAGA";
                htmlConteudo = `<b>Alerta:</b> ${labelVermelha(labelTexto)}<br><br>` +
                    `Este item possui uma Ajuda de Custo já paga.<br><br>` +
                    `Alterar o status do ajuste para <b>${novoStatus}</b> afetará o cálculo do total geral.<br><br>` +
                    `Deseja continuar com esta alteração?`;
            }

            // 1º SWAL: JUSTIFICATIVA
            const { value: justificativa } = await Swal.fire({
                title: '⚠️ Alterar Ajuste em Item PAGO',
                html: htmlConteudo,
                input: 'textarea',
                inputLabel: 'Justificativa para Auditoria:',
                inputPlaceholder: 'Por que o ajuste está sendo alterado após o pagamento?',
                showCancelButton: true,
                confirmButtonText: 'Próximo',
                cancelButtonColor: '#d33',
                inputValidator: (value) => { if (!value) return 'A justificativa é obrigatória!'; }
            });

            if (justificativa) {
                // 2º SWAL: CONFIRMAÇÃO FINAL
                const confirmacao = await Swal.fire({
                    title: 'Confirmar Alteração?',
                    text: `O valor de Ajuste será ${novoStatus === 'Autorizado' ? 'somado' : 'removido'} do cálculo total.`,
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'Sim, aplicar'
                });

                if (confirmacao.isConfirmed) {
                    const dataHora = new Date().toLocaleString();
                    
                    // 1. Log Centralizado (obsPosPgto)
                    registrarLogPosPagamento(`Alteração Status Ajuste: ${statusAnterior} -> ${novoStatus}. Motivo: ${justificativa}`);

                    // 2. Log Local (descAjusteCusto)
                    if (inputDescAjuste) {
                        const logLocal = `\n[Status AJUSTE ${dataHora}]: ${statusAnterior} -> ${novoStatus}. Motivo: ${justificativa}`;
                        inputDescAjuste.value = (inputDescAjuste.value + logLocal).trim();
                    }

                    // 3. Atualiza valores e UI
                    if (document.getElementById("statusAjusteCusto")) {
                        document.getElementById("statusAjusteCusto").value = novoStatus;
                    }
                    window.statusAnteriorAjusteCusto = novoStatus;
                    
                    if (typeof calcularValorTotal === "function") calcularValorTotal();
                    if (typeof aplicarCorNoSelect === "function") aplicarCorNoSelect(this);

                    Swal.fire({
                        title: 'Cálculo Atualizado!',
                        html: 'O total foi recalculado.<br><br><b>IMPORTANTE:</b> Clique em <b>ENVIAR</b> para salvar.',
                        icon: 'success',
                        confirmButtonText: 'Entendi'
                    });
                } else {
                    this.value = statusAnterior;
                    if (typeof aplicarCorNoSelect === "function") aplicarCorNoSelect(this);
                }
            } else {
                this.value = statusAnterior;
                if (typeof aplicarCorNoSelect === "function") aplicarCorNoSelect(this);
            }
        } else {
            // Fluxo normal (Sem travas)
            if (document.getElementById("statusAjusteCusto")) {
                document.getElementById("statusAjusteCusto").value = novoStatus;
            }
            window.statusAnteriorAjusteCusto = novoStatus;
            if (typeof calcularValorTotal === "function") calcularValorTotal();
            if (typeof aplicarCorNoSelect === "function") aplicarCorNoSelect(this);
        }
    });

    const selectCaixinha = document.getElementById('selectStatusCaixinha');

    if (selectCaixinha) {
        selectCaixinha.addEventListener('change', () => {
            aplicarCorNoSelect(selectCaixinha);
            statusCaixinhaInput.value = selectStatusCaixinha.value;
            console.log("Status de Caixinha sincronizado para:", statusCaixinhaInput.value);
        });
    }
    caixinhacheck.addEventListener('change', async (e) => {
        const isChecked = caixinhacheck.checked;
        const textarea = document.getElementById('descCaixinha');
        
        // Elementos do Status da Caixinha
        const inputStatus = document.getElementById('statusCaixinha'); 
        const selectStatus = document.getElementById('selectStatusCaixinha');
        
        // Container do status (Wrapper)
        const wrapperStatus = document.getElementById('campoStatusCaixinha') || 
                            inputStatus?.closest('.form2') || 
                            inputStatus?.parentElement;

        // TRAVA DE SEGURANÇA: Bloqueia se o Cachê Base estiver pendente
        if (isChecked && !cacheBaseLiberado()) {
            e.preventDefault();
            caixinhacheck.checked = false;
            return Swal.fire({
                icon: 'warning',
                title: 'Solicitação Bloqueada',
                text: 'Você não pode adicionar Caixinha enquanto o Cachê Base estiver Pendente.',
                confirmButtonColor: '#3085d6'
            });
        }

        let vOriginal = currentEditingStaffEvent ? parseFloat(currentEditingStaffEvent.vlrcaixinha || 0) : 0;
        let dOriginal = currentEditingStaffEvent ? currentEditingStaffEvent.desccaixinha || '' : '';
        let sOriginal = currentEditingStaffEvent ? currentEditingStaffEvent.statuscaixinha || '' : '';

        if (!isChecked) {
            // Lógica para quando desmarca
            if (sOriginal !== 'Pendente' && sOriginal !== '' && sOriginal !== null) {
                e.preventDefault();
                caixinhacheck.checked = true;
                return Swal.fire('Erro!', `Não é possível remover: status atual é "${sOriginal}".`, 'error');
            }

            if (parseFloat(caixinhaInput.value.replace(',', '.')) > 0) {
                const result = await Swal.fire({
                    title: 'Remover Caixinha?',
                    text: 'Os dados preenchidos serão perdidos. Confirmar?',
                    icon: 'warning',
                    showCancelButton: true
                });
                if (!result.isConfirmed) {
                    caixinhacheck.checked = true;
                    return;
                }
            }

            // Esconde tudo
            campoCaixinha.style.display = 'none';
            textarea.style.display = 'none';
            campoPgtoCaixinha.style.display = 'none';
            if (wrapperStatus) wrapperStatus.style.display = 'none';
            
            caixinhaInput.value = '0,00';
            textarea.value = '';
        } else {
            // Lógica de abertura (Exibir)
            campoCaixinha.style.display = 'block';
            textarea.style.display = 'block';
            campoPgtoCaixinha.style.setProperty('display', 'block', 'important');

            caixinhaInput.value = vOriginal.toFixed(2).replace('.', ',');
            textarea.value = dOriginal;

            const campoInput = document.getElementById('statusCaixinha');
            //if (campoInput) campoInput.value = sOriginal || 'Pendente';
            const vlrCaixaOriginal = currentEditingStaffEvent ? parseFloat(currentEditingStaffEvent.vlrcaixinha || 0) : 0;
            campoInput.value = sOriginal || (vlrCaixaOriginal !== 0 ? 'Pendente' : '');
        }
    })
   
   
    document.getElementById('selectStatusCaixinha')?.addEventListener('change', async function(e) {
        const novoStatus = e.target.value;
        const inputDescCaixinha = document.getElementById('descCaixinha');
        
        // Normalizamos o status de pagamento original do banco
        const statusPgtoCaixinha = (window.statusPgtoCaixinhaOriginalDoBanco || "").trim().toLowerCase();
        
        // Pegamos o status anterior da variável global ou do campo hidden
        const statusAnteriorCaixinha = window.statusAnteriorCaixinha || document.getElementById('statusCaixinha')?.value || "Pendente";

        // 🚩 REGRA: Se a caixinha já foi paga, qualquer mudança exige trava de auditoria
        if (statusPgtoCaixinha === "pago" && novoStatus !== statusAnterior) {
            
            const labelVermelha = (texto) => `<span style="color: #ff0000; font-weight: bold;">${texto}</span>`;

            // 1º SWAL: JUSTIFICATIVA
            const { value: justificativa } = await Swal.fire({
                title: '⚠️ Caixinha já PAGA',
                html: `<b>Alerta:</b> ${labelVermelha("Pagamento Identificado")}<br><br>` +
                    `Esta <b>Caixinha</b> consta como <b>PAGA</b> no financeiro.<br><br>` +
                    `Mudar de <b>${statusAnterior}</b> para <b>${novoStatus}</b> gerará divergência no fechamento e no caixa.<br><br>` +
                    `Deseja prosseguir com a reversão?`,                     
                input: 'textarea',
                inputLabel: 'Justificativa para Auditoria:',
                inputPlaceholder: 'Por que alterar esta caixinha após o pagamento?',
                showCancelButton: true,
                confirmButtonText: 'Próximo',
                cancelButtonColor: '#d33',
                inputValidator: (value) => {
                    if (!value) return 'A justificativa é obrigatória!';
                }
            });

            if (justificativa) {
                // 2º SWAL: CONFIRMAÇÃO FINAL
                const confirmacao = await Swal.fire({
                    title: 'Confirmar Alteração?',
                    text: `O valor da caixinha será ${novoStatus === 'Autorizado' ? 'somado' : 'removido'} do total geral.`,
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'Sim, aplicar'
                });

                if (confirmacao.isConfirmed) {
                    const dataHora = new Date().toLocaleString();
                    
                    // 1. Registra no Log Centralizado (obsPosPgto)
                    const msgLog = `Alteração Status Caixinha: ${statusAnterior} -> ${novoStatus}. Motivo: ${justificativa}`;
                    registrarLogPosPagamento(msgLog);

                    // 2. Grava log na descrição específica da caixinha
                    if (inputDescCaixinha) {
                        const logLocal = `\n[Status CAIXINHA ${dataHora}]: ${statusAnterior} -> ${novoStatus}. Motivo: ${justificativa}`;
                        inputDescCaixinha.value = (inputDescCaixinha.value + logLocal).trim();
                    }

                    // 3. Atualiza valores e UI
                    document.getElementById('statusCaixinha').value = novoStatus;
                    window.statusAnteriorCaixinha = novoStatus; 
                    
                    if (typeof calcularValorTotal === "function") calcularValorTotal();
                    if (typeof aplicarCorNoSelect === "function") aplicarCorNoSelect(this);

                    Swal.fire({
                        title: 'Cálculo Atualizado!',
                        html: 'O total foi recalculado.<br><br><b>IMPORTANTE:</b> Clique em <b>ENVIAR</b> para salvar.',
                        icon: 'success',
                        confirmButtonText: 'Entendi'
                    });
                } else {
                    this.value = statusAnterior;
                    if (typeof aplicarCorNoSelect === "function") aplicarCorNoSelect(this);
                }
            } else {
                this.value = statusAnterior;
                if (typeof aplicarCorNoSelect === "function") aplicarCorNoSelect(this);
            }
        } else {
            // Fluxo normal (Sem travas de pagamento)
            document.getElementById('statusCaixinha').value = novoStatus;
            window.statusAnteriorCaixinha = novoStatus; 
            if (typeof calcularValorTotal === "function") calcularValorTotal();
            if (typeof aplicarCorNoSelect === "function") aplicarCorNoSelect(this);
        }
    });

        
    const selectDiariaDobrada = document.getElementById('selectStatusDiariaDobrada');
    const selectMeiaDiaria = document.getElementById('selectStatusMeiaDiaria');

    if (selectDiariaDobrada) {
        selectDiariaDobrada.addEventListener('change', () => {

            aplicarCorNoSelect(selectDiariaDobrada);
        });
    }

    // Adiciona o ouvinte de evento 'change' para o select de 'Meia Diária'
    if (selectMeiaDiaria) {
        selectMeiaDiaria.addEventListener('change', () => {

            aplicarCorNoSelect(selectMeiaDiaria);
        });
    }  
    
   
    // --- OUvinte para o Select GLOBAL de Diária Dobrada ---
    document.getElementById('selectStatusDiariaDobrada')?.addEventListener('change', async function() {
        const novoStatus = this.value;
        const statusPgto = (window.statusPgtoCacheOriginalDoBanco || "").trim().toLowerCase();
        const statusPgtoAjuda = (window.statusPgtoAjudaOriginalDoBanco || "").trim().toLowerCase();
        const isPago = statusPgto === "pago" || statusPgtoAjuda === "pago";
        
        const statusAnteriorDiariaDobrada = window.statusAnteriorDiariaDobrada || "Pendente";

        if (isPago && novoStatus !== statusAnterior) {
            let labelTexto = "";
            let htmlConteudo = "";
            const labelVermelha = (texto) => `<span style="color: #ff0000; font-weight: bold;">${texto}</span>`;

            if (statusPgto === "pago") {
                labelTexto = statusPgtoAjuda === "pago" ? "Cachê e Ajuda de Custo PAGOS" : "Cachê PAGO";
                htmlConteudo = `<b>Alerta:</b> ${labelVermelha(labelTexto)}<br><br>` +
                    `Este item consta como <b>PAGO</b> no financeiro.<br><br>` +
                    `Mudar o status das dobras para <b>${novoStatus}</b> gerará divergência e impactará o fechamento do caixa.<br><br>` +
                    `Caso queira continuar, revise os valores e insira novos comprovantes. Deseja continuar?`;
            } else {
                labelTexto = "Ajuda de Custo PAGA";
                htmlConteudo = `<b>Alerta:</b> ${labelVermelha(labelTexto)}<br><br>` +
                    `Este item possui Ajuda de Custo já paga.<br><br>` +
                    `Mudar o status das dobras para <b>${novoStatus}</b> alterará o valor total do cachê e o total geral.<br><br>` +
                    `Deseja continuar com esta alteração?`;
            }

            const { value: justificativa } = await Swal.fire({
                title: '⚠️ Alterar Status de Diária Dobrada',
                html: htmlConteudo,
                input: 'textarea',
                inputLabel: 'Justificativa da alteração:',
                inputPlaceholder: 'Por que alterar todas as dobras após o pagamento?',
                showCancelButton: true,
                confirmButtonText: 'Próximo',
                cancelButtonColor: '#d33',
                inputValidator: (value) => { if (!value) return 'Justificativa obrigatória!'; }
            });

            if (justificativa) {
                const confirmacao = await Swal.fire({
                    title: 'Confirmar Alteração em Lote?',
                    text: `Todas as datas selecionadas como dobra serão alteradas para ${novoStatus}.`,
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'Sim, aplicar'
                });

                if (confirmacao.isConfirmed) {
                    registrarLogPosPagamento(`Alteração Global Diária Dobrada: ${statusAnterior} -> ${novoStatus}. Motivo: ${justificativa}`);
                    
                    // Aplica a mudança
                    document.getElementById('statusDiariaDobrada').value = novoStatus;
                    window.statusAnteriorDiariaDobrada = novoStatus;
                    processarMudancaStatusDiarias(novoStatus, 'dobrada'); // Sua função que atualiza o array/UI
                    
                    if (typeof aplicarCorNoSelect === "function") aplicarCorNoSelect(this);
                    
                    Swal.fire({ title: 'Atualizado!', text: 'As dobras foram recalculadas.', icon: 'success', timer: 1500, showConfirmButton: false });
                } else {
                    this.value = statusAnterior;
                    if (typeof aplicarCorNoSelect === "function") aplicarCorNoSelect(this);
                }
            } else {
                this.value = statusAnterior;
                if (typeof aplicarCorNoSelect === "function") aplicarCorNoSelect(this);
            }
        } else {
            // Fluxo Normal
            document.getElementById('statusDiariaDobrada').value = novoStatus;
            window.statusAnteriorDiariaDobrada = novoStatus;
            processarMudancaStatusDiarias(novoStatus, 'dobrada');
            if (typeof aplicarCorNoSelect === "function") aplicarCorNoSelect(this);
        }
    });

    // --- OUvinte para o Select GLOBAL de Meia Diária ---
    document.getElementById('selectStatusMeiaDiaria')?.addEventListener('change', async function() {
        const novoStatus = this.value;
        const statusPgto = (window.statusPgtoCacheOriginalDoBanco || "").trim().toLowerCase();
        const statusPgtoAjuda = (window.statusPgtoAjudaOriginalDoBanco || "").trim().toLowerCase();
        const isPago = statusPgto === "pago" || statusPgtoAjuda === "pago";
        
        const statusAnteriorMeiaDiaria = window.statusAnteriorMeiaDiaria || "Pendente";

        if (isPago && novoStatus !== statusAnterior) {
            let labelTexto = "";
            let htmlConteudo = "";
            const labelVermelha = (texto) => `<span style="color: #ff0000; font-weight: bold;">${texto}</span>`;

            if (statusPgto === "pago") {
                labelTexto = statusPgtoAjuda === "pago" ? "Cachê e Ajuda de Custo PAGOS" : "Cachê PAGO";
                htmlConteudo = `<b>Alerta:</b> ${labelVermelha(labelTexto)}<br><br>` +
                    `Este item consta como <b>PAGO</b> no financeiro.<br><br>` +
                    `Mudar o status das meias diárias para <b>${novoStatus}</b> gerará divergência no fechamento.<br><br>` +
                    `Deseja continuar?`;
            } else {
                labelTexto = "Ajuda de Custo PAGA";
                htmlConteudo = `<b>Alerta:</b> ${labelVermelha(labelTexto)}<br><br>` +
                    `Este item possui Ajuda de Custo já paga.<br><br>` +
                    `A alteração das meias diárias para <b>${novoStatus}</b> impactará o valor total geral.<br><br>` +
                    `Deseja continuar?`;
            }

            const { value: justificativa } = await Swal.fire({
                title: '⚠️ Alterar Status de Meia Diária',
                html: htmlConteudo,
                input: 'textarea',
                inputLabel: 'Justificativa da alteração:',
                inputPlaceholder: 'Motivo da alteração global...',
                showCancelButton: true,
                confirmButtonText: 'Próximo',
                cancelButtonColor: '#d33',
                inputValidator: (value) => { if (!value) return 'Justificativa obrigatória!'; }
            });

            if (justificativa) {
                const confirmacao = await Swal.fire({
                    title: 'Confirmar Alteração em Lote?',
                    text: `As meias diárias serão marcadas como ${novoStatus}.`,
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'Sim, aplicar'
                });

                if (confirmacao.isConfirmed) {
                    registrarLogPosPagamento(`Alteração Global Meia Diária: ${statusAnterior} -> ${novoStatus}. Motivo: ${justificativa}`);
                    
                    document.getElementById('statusMeiaDiaria').value = novoStatus;
                    window.statusAnteriorMeiaDiaria = novoStatus;
                    processarMudancaStatusDiarias(novoStatus, 'meia');
                    
                    if (typeof aplicarCorNoSelect === "function") aplicarCorNoSelect(this);
                    
                    Swal.fire({ title: 'Atualizado!', text: 'Cálculo de meia diária refeito.', icon: 'success', timer: 1500, showConfirmButton: false });
                } else {
                    this.value = statusAnterior;
                    if (typeof aplicarCorNoSelect === "function") aplicarCorNoSelect(this);
                }
            } else {
                this.value = statusAnterior;
                if (typeof aplicarCorNoSelect === "function") aplicarCorNoSelect(this);
            }
        } else {
            document.getElementById('statusMeiaDiaria').value = novoStatus;
            window.statusAnteriorMeiaDiaria = novoStatus;
            processarMudancaStatusDiarias(novoStatus, 'meia');
            if (typeof aplicarCorNoSelect === "function") aplicarCorNoSelect(this);
        }
    });

    // const datasEventoInput = document.getElementById('datasEvento');
    if (datasEventoInput) {
         console.log("ENTROU NO PERIODO EVENTO DO VERIFICASTAFF");
    }

    document.getElementById("selectStatusCustoFechado")?.addEventListener("change", async function() {
        const novoStatus = this.value; // Pode ser 'Autorizado', 'Pendente' ou 'Rejeitado'
        const inputDesc = document.getElementById('descCustoFechado');
        const statusAnterior = window.statusAnteriorCustoFechado;

        // Normalizamos o status de pagamento original do banco
        const pagamentoNoBanco = (window.statusPgtoCacheOriginalDoBanco || "").trim();

        // 🚩 REGRA: Se o pagamento já foi feito ("Pago"), qualquer mudança de status do cachê exige trava
        if (pagamentoNoBanco === "Pago" && novoStatus !== statusAnterior) {
            
            // 1º SWAL: JUSTIFICATIVA
            const { value: justificativa } = await Swal.fire({
                title: '⚠️ Alteração em Cachê PAGO',
                html: `Este item já consta como <b>PAGO</b> no financeiro.<br><br>` +
                    `Mudar o status de <b>${statusAnterior}</b> para status <b>${novoStatus}</b> alterará o valor total e gerará divergência no caixa.
                    A reversão impactará o fechamento financeiro. Dados alterados não irão bater com os dados pagos anteriomente.
                    Caso queria continuar, revise os valores no seu banco e insira novos comprovantes. Deseja continuar?
                    `,
                input: 'textarea',
                inputLabel: 'Justificativa para a alteração:',
                inputPlaceholder: 'Explique o motivo da mudança...',
                showCancelButton: true,
                confirmButtonText: 'Próximo',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#d33'
            });

            if (justificativa) {
                // 2º SWAL: CONFIRMAÇÃO DE ZERAMENTO/REVERSÃO
                const confirmacaoFinal = await Swal.fire({
                    title: 'Confirmar Alteração?',
                    text: `Tem certeza que deseja mudar para ${novoStatus}? Os valores da tabela serão recalculados/zerados conforme esta escolha.`,
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'Sim, alterar valores',
                    cancelButtonText: 'Cancelar'
                });

                if (confirmacaoFinal.isConfirmed) {
                    const dataHora = new Date().toLocaleString();
                    const logMensagem = `\n[ALTERAÇÃO NO STATUS EM STAFF PAGO ${dataHora}]: Status mudou de ${statusAnterior} para ${novoStatus}. Motivo: ${justificativa}`;
                    if (inputDesc) inputDesc.value = (inputDesc.value + logMensagem).trim();
                    
                    // Aplica a mudança e recalcula
                    processarMudancaStatus(novoStatus);
                    window.statusAnteriorCustoFechado = novoStatus;
                    
                   Swal.fire({
                        title: 'Cálculo Atualizado!',
                        html: 'O total foi recalculado com base no novo status.<br><br><b>IMPORTANTE:</b> Clique no botão <b>ENVIAR</b> para gravar esta alteração permanentemente.',
                        icon: 'warning',
                        confirmButtonText: 'Entendi',
                        confirmButtonColor: '#3085d6'
                    });
                    aplicarCorNoSelect(this);
                } else {
                    // Cancelou no 2º passo: Volta para o status que estava antes
                    this.value = statusAnterior;
                    if (typeof aplicarCorNoSelect === "function") aplicarCorNoSelect(this);
                }
            } else {
                // Cancelou no 1º passo: Volta para o status que estava antes
                this.value = statusAnterior;
                if (typeof aplicarCorNoSelect === "function") aplicarCorNoSelect(this);
            }
        } else {
            // Fluxo normal (se não houver pagamento "Pago" envolvido)
            processarMudancaStatus(novoStatus);
            window.statusAnteriorCustoFechado = novoStatus;
        }
    });
    
    const botaoEnviarOriginal = document.getElementById("Enviar");
    if (botaoEnviarOriginal) {
        const BotaoEnviar = botaoEnviarOriginal.cloneNode(true);
        botaoEnviarOriginal.parentNode.replaceChild(BotaoEnviar, botaoEnviarOriginal);
        console.log("[botaoEnviar] Listener antigo removido para evitar salvamento duplicado.");

        BotaoEnviar.addEventListener("click", async (event) => {
            event.preventDefault();

            // 👇 ADICIONE ESTE LOG TEMPORÁRIO
    console.log("🔍 currentEditingStaffEvent no clique:", JSON.stringify(currentEditingStaffEvent));
    console.log("🔍 isFormLoadedFromDoubleClick:", isFormLoadedFromDoubleClick);

            const getSelectedText = (el) => (el && el.selectedIndex >= 0) ? el.options[el.selectedIndex].text : "";

            // =========================================================
            // 1. COLETA DE DADOS DO FORMULÁRIO
            // =========================================================
            const datasEventoRawValue = window.datasEventoPicker?.selectedDates || [];
            const periodoDoEvento = datasEventoRawValue.map(date => flatpickr.formatDate(date, "Y-m-d"));

            const diariaDobradaRawValue = window.diariaDobradaPicker?.selectedDates || [];
            const periodoDobrado = diariaDobradaRawValue.map(date => flatpickr.formatDate(date, "Y-m-d"));

            const diariaMeiaRawValue = window.meiaDiariaPicker?.selectedDates || [];
            const periodoMeiaDiaria = diariaMeiaRawValue.map(date => flatpickr.formatDate(date, "Y-m-d"));

            statusOrcamentoAtual = document.getElementById("status");

            const selectAvaliacao = document.getElementById("avaliacao");
            const avaliacao = selectAvaliacao.options[selectAvaliacao.selectedIndex]?.textContent.trim().toUpperCase() || '';
            const idStaff = document.querySelector("#idStaff").value.trim();
            const idFuncionario = document.querySelector("#idFuncionario").value;
            const selectFuncionario = document.getElementById("nmFuncionario");
            const nmFuncionario = selectFuncionario.options[selectFuncionario.selectedIndex]?.textContent.trim().toUpperCase() || '';
            const idFuncao = document.querySelector("#idFuncao").value;
            const selectFuncao = document.getElementById("descFuncao");
            const descFuncao = selectFuncao.options[selectFuncao.selectedIndex]?.textContent.trim().toUpperCase() || '';
            const vlrCusto = document.querySelector("#vlrCusto").value.trim() || '0';
            const ajusteCusto = document.querySelector("#ajusteCusto").value.trim() || '0';
            const transporte = document.querySelector("#transporte").value.trim() || '0';
            const alimentacao = document.querySelector("#alimentacao").value.trim() || '0';
            const caixinha = document.querySelector("#caixinha").value.trim() || '0';
            const idCliente = document.querySelector("#idCliente").value;
            const selectCliente = document.getElementById("nmCliente");
            const nmCliente = selectCliente.options[selectCliente.selectedIndex]?.textContent.trim().toUpperCase() || '';
            const idEvento = document.querySelector("#idEvento").value;
            const selectEvento = document.getElementById("nmEvento");
            const nmEvento = selectEvento.options[selectEvento.selectedIndex]?.textContent.trim().toUpperCase() || '';
            const idEquipe = document.querySelector("#idEquipe").value;
            const nmEquipe = document.querySelector("#nmEquipe").value.trim().toUpperCase();
            const idMontagem = document.querySelector("#idMontagem").value;
            const selectLocalMontagem = document.getElementById("nmLocalMontagem");
            const nmLocalMontagem = selectLocalMontagem.options[selectLocalMontagem.selectedIndex].textContent.trim();
            const inputHiddenPavilhao = document.getElementById('idPavilhao');
            const pavilhao = inputHiddenPavilhao.value.trim().toUpperCase() || '';
            const setor = document.querySelector("#setor").value.trim().toUpperCase();

            const caixinhaAtivo = document.getElementById("Caixinhacheck")?.checked;
            const ajusteCustoAtivo = document.getElementById("ajusteCustocheck")?.checked;

            const descBeneficioInput = document.getElementById("descBeneficio");
            const descBeneficio = descBeneficioInput?.value.trim() || "";
            const descAjusteCustoInput = document.getElementById("descAjusteCusto");
            const descAjusteCusto = descAjusteCustoInput.value.trim() || "";
            const descCaixinhaInput = document.getElementById("descCaixinha");
            const descCaixinha = descCaixinhaInput?.value.trim() || "";
            const descCustoFechadoTextarea = document.getElementById("descCustoFechado");
            const descCustoFechado = descCustoFechadoTextarea?.value.trim() || "";

            // const inputStatusFechado = document.getElementById("statusCustoFechado");
            // let statusFechado = inputStatusFechado ? inputStatusFechado.value : '';

            const selectStatusFechado = document.getElementById("selectStatusCustoFechado");
            const inputStatusFechado = document.getElementById("statusCustoFechado");
            let statusFechado = (selectStatusFechado?.value && selectStatusFechado.value !== 'none')
                ? selectStatusFechado.value
                : (inputStatusFechado?.value || '');

            let statusAjusteCusto = document.getElementById("statusAjusteCusto")?.value?.trim() || '';
            const statusAjusteCustoParaComparacao = statusAjusteCusto;
            let statusCaixinha = document.getElementById("statusCaixinha")?.value?.trim() || '';

            const diariaDobrada = document.getElementById("diariaDobradacheck")?.checked;
            const meiaDiaria = document.getElementById("meiaDiariacheck")?.checked;
            let statusDiariaDobrada = document.getElementById("statusDiariaDobrada").value;
            let statusMeiaDiaria = document.getElementById("statusMeiaDiaria").value;

            const seniorCheck  = document.getElementById('Seniorcheck');
            const seniorCheck2 = document.getElementById('Seniorcheck2');
            const plenoCheck   = document.getElementById('Plenocheck');
            const juniorCheck  = document.getElementById('Juniorcheck');
            const baseCheck    = document.getElementById('Basecheck');
            const fechadoCheck = document.getElementById('Fechadocheck');
            const liberadoCheck = document.getElementById('Liberadocheck');

            const qtdPessoas = parseInt(document.getElementById('qtdPessoas').value, 10) || 0;

            // Totais
            const vlrTotal = document.getElementById('vlrTotal').value;
            const total = parseFloat(vlrTotal.replace('R$', '').replace(/\./g, '').replace(',', '.').trim()) || 0.00;

            const vlrTotCache = document.getElementById('vlrTotalCache').value;
            const vlrtotcache = parseFloat(vlrTotCache.replace('R$', '').replace(/\./g, '').replace(',', '.').trim()) || 0.00;

            const vlrTotalAjdCusto = document.getElementById('vlrTotalAjdCusto').value;
            const vlrtotajdcusto = parseFloat(vlrTotalAjdCusto.replace('R$', '').replace(/\./g, '').replace(',', '.').trim()) || 0.00;

            // // =========================================================
            // // 2. VALIDAÇÕES OBRIGATÓRIAS
            // // =========================================================
            // if (periodoDoEvento.length === 0) {
            //     return Swal.fire("Campo obrigatório!", "Por favor, selecione os dias do evento.", "warning");
            // }
            // if (diariaDobradacheck.checked && periodoDobrado.length === 0) {
            //     return Swal.fire("Campo obrigatório!", "Por favor, selecione os dias de Dobra no evento.", "warning");
            // }
            // if (meiaDiariacheck.checked && periodoMeiaDiaria.length === 0) {
            //     return Swal.fire("Campo obrigatório!", "Por favor, selecione os dias de Meia Diária no evento.", "warning");
            // }

            // // 🔥 VALIDAÇÃO INTELIGENTE COM ABERTURA DO MODAL (PARA POST E PUT)
            // // 🔥 VALIDAÇÃO INTELIGENTE COM ABERTURA DO MODAL (PARA POST E PUT)
            // if (diariaDobrada && periodoDobrado.length > 0) {
            //     // Verifica se falta preencher os detalhes da dobra em algum dia
            //     const precisaPreencherDobra = !window.dadosDiariaDobradaInjetar || 
            //         window.dadosDiariaDobradaInjetar.length === 0 ||
            //         window.dadosDiariaDobradaInjetar.some(d => 
            //             (!d.idfuncaodobra && !d.idFuncaoDobra) || 
            //             String(d.idfuncaodobra || d.idFuncaoDobra).trim() === '' || 
            //             String(d.idfuncaodobra || d.idFuncaoDobra) === 'NaN'
            //         );

            //     if (precisaPreencherDobra) {
            //         console.log("🔄 Interceptando salvamento: Detalhes da dobra não preenchidos. Processando modal...");

            //         if (!window.dadosDiariaDobradaInjetar) {
            //             window.dadosDiariaDobradaInjetar = [];
            //         }

            //         // Varre cada data selecionada no flatpickr de dobra
            //         for (const dataDobra of periodoDobrado) {
            //             // Verifica se essa data específica já foi configurada com sucesso
            //             const jaExisteDobraValida = window.dadosDiariaDobradaInjetar.some(d => 
            //                 d.data === dataDobra && 
            //                 (d.idfuncaodobra || d.idFuncaoDobra) && 
            //                 String(d.idfuncaodobra || d.idFuncaoDobra).trim() !== '' && 
            //                 String(d.idfuncaodobra || d.idFuncaoDobra) !== 'NaN'
            //             );

            //             if (!jaExisteDobraValida) {
            //                 console.log(`📅 Abrindo modal obrigatório para a data: ${dataDobra}`);

            //                 const dadosOrcamentoMock = { idorcamento: currentEditingStaffEvent?.idorcamento || null };
            //                 const criteriosMock = { idFuncao: idFuncao, datasEvento: periodoDoEvento };

            //                 // Chama a sua função de tela para capturar a vaga/justificativa
            //                 const resultadoDobraDia = await perguntarFuncaoDiariaDobrada(
            //                     qtdPessoas,          
            //                     dadosOrcamentoMock,  
            //                     criteriosMock,       
            //                     descFuncao,          
            //                     idFuncionario,       
            //                     dataDobra            
            //                 );

            //                 if (!resultadoDobraDia) {
            //                     return Swal.fire("Operação interrompida", "É obrigatório definir as funções e preencher a justificativa de todas as datas de dobra antes de salvar.", "warning");
            //                 }

            //                 // Limpa registros residuais da mesma data para evitar duplicados no array
            //                 window.dadosDiariaDobradaInjetar = window.dadosDiariaDobradaInjetar.filter(d => d.data !== dataDobra);

            //                 const nomeFuncaoAlocada = resultadoDobraDia.nomeFuncao || descFuncao;
            //                 const setorAlvoDobra = resultadoDobraDia.setorVaga || '';
            //                 const textoDigitadoNoSwal = resultadoDobraDia.justificativa || '';
                            
            //                 const fraseJustificativaEstruturada = `Consumiu vaga da função "${nomeFuncaoAlocada}"${setorAlvoDobra ? ` do setor "${setorAlvoDobra}"` : ''} para cobrir virada. Justificativa: ${textoDigitadoNoSwal}`;

            //                 // Alimenta o array global espelhando chaves em CamelCase e SnakeCase para garantir compatibilidade com o Back-end
            //                 if (resultadoDobraDia.tipo === "ALOCACAO_NORMAL") {
            //                     window.dadosDiariaDobradaInjetar.push({
            //                         data: dataDobra,
            //                         // Chaves em minúsculo (para salvar na coluna dtdiariadobrada da staffeventos)
            //                         idfuncaodobra: resultadoDobraDia.idFuncaoFinal,
            //                         setordobra: resultadoDobraDia.setorVaga || '',
            //                         justificativa: fraseJustificativaEstruturada,
            //                         idorcamento: resultadoDobraDia.idOrcamentoFinal,
            //                         vlr_cache: resultadoDobraDia.vlrCache || 0,
            //                         vlr_alimentacao: resultadoDobraDia.vlrAlimentacao || 0                                    
                                    
            //                     });
            //                 } else if (resultadoDobraDia.tipo === "SOLICITAR_ADITIVO" || resultadoDobraDia.tipo === "SOLICITAR_EXTRA_BONIFICADO") {
            //                     window.dadosDiariaDobradaInjetar.push({
            //                         data: dataDobra,
            //                         idfuncaodobra: idFuncao ? parseInt(idFuncao, 10) : null,
            //                         setordobra: setor || '',
            //                         justificativa: fraseJustificativaEstruturada,
            //                         idorcamento: resultadoDobraDia.idOrcamentoFinal,
            //                         vlr_cache: resultadoDobraDia.vlrCache || 0,
            //                         vlr_alimentacao: resultadoDobraDia.vlrAlimentacao || 0,    
            //                         solicitacaoExcecao: true,
            //                         tipoSolicitacao: resultadoDobraDia.tipo
                                    
            //                     });
            //                 }
            //             }
            //         }
            //         const campoDescDobra = document.getElementById('descDiariaDobrada');
            //         if (window.dadosDiariaDobradaInjetar?.length > 0) {
            //             const tagsParaCampo = window.dadosDiariaDobradaInjetar.map(item => {
            //                 const dataFormatadaBR = item.data.split('-').reverse().join('/');
            //                 return `[Diária Dobrada ${dataFormatadaBR}] ${item.justificativa}`;
            //             });
                        
            //             const textoFinalString = tagsParaCampo.join(' | ');
                        
            //             if (campoDescDobra) {
            //                 campoDescDobra.value = textoFinalString;
            //                 campoDescDobra.dispatchEvent(new Event('input'));
            //             }
                        
            //             // Força a atualização da variável que seu formData lê
            //             if (typeof descDiariaDobradaTextarea !== 'undefined' && descDiariaDobradaTextarea) {
            //                 descDiariaDobradaTextarea.value = textoFinalString;
            //             }
            //         }

            //         console.log("✅ Todas as dobras foram normalizadas e mapeadas:", window.dadosDiariaDobradaInjetar);
            //     }
            // }

            // =========================================================
            // 2. VALIDAÇÕES OBRIGATÓRIAS
            // =========================================================
            if (periodoDoEvento.length === 0) {
                return Swal.fire("Campo obrigatório!", "Por favor, selecione os dias do evento.", "warning");
            }
            if (diariaDobradacheck.checked && periodoDobrado.length === 0) {
                return Swal.fire("Campo obrigatório!", "Por favor, selecione os dias de Dobra no evento.", "warning");
            }
            if (meiaDiariacheck.checked && periodoMeiaDiaria.length === 0) {
                return Swal.fire("Campo obrigatório!", "Por favor, selecione os dias de Meia Diária no evento.", "warning");
            }

            // 🔥 VALIDAÇÃO INTELIGENTE COM ABERTURA DO MODAL (PARA POST E PUT)
            if (diariaDobrada && periodoDobrado.length > 0) {
                
                // 🌟 NOVO FILTRO INTELIGENTE: Identifica o que já veio gravado no banco de dados para não re-perguntar
                let datasOriginaisNoBancoPrimeiroMomento = [];
                if (typeof dataDiariaDobradaOriginalLimpa !== 'undefined' && dataDiariaDobradaOriginalLimpa) {
                    datasOriginaisNoBancoPrimeiroMomento = dataDiariaDobradaOriginalLimpa;
                } else if (currentEditingStaffEvent?.dtdiariadobrada) {
                    datasOriginaisNoBancoPrimeiroMomento = typeof currentEditingStaffEvent.dtdiariadobrada === 'string' 
                        ? JSON.parse(currentEditingStaffEvent.dtdiariadobrada) 
                        : currentEditingStaffEvent.dtdiariadobrada;
                }

                const listaOriginaisStringPrimeiroMomento = (datasOriginaisNoBancoPrimeiroMomento || []).map(d => {
                    if (!d) return '';
                    if (typeof d === 'object') return (d.data || d.datadiariadobrada || '');
                    return String(d);
                }).map(s => s.trim()).filter(p => p);

                // Isola apenas as datas reais que o usuário adicionou agora na tela
                const datasNovasParaPerguntarMomento1 = periodoDobrado.filter(dataTela => {
                    return !listaOriginaisStringPrimeiroMomento.includes(String(dataTela).trim());
                });

                // Só avalia se precisa preencher se houver datas novas de verdade
                let precisaPreencherDobra = false;
                if (datasNovasParaPerguntarMomento1.length > 0) {
                    precisaPreencherDobra = !window.dadosDiariaDobradaInjetar || 
                        window.dadosDiariaDobradaInjetar.length === 0 ||
                        datasNovasParaPerguntarMomento1.some(dtNova => {
                            const configExistente = window.dadosDiariaDobradaInjetar.find(d => String(d.data).trim() === String(dtNova).trim());
                            if (!configExistente) return true; // Falta configurar
                            const idFuncaoFinal = configExistente.idfuncaodobra || configExistente.idFuncaoDobra;
                            return !idFuncaoFinal || String(idFuncaoFinal).trim() === '' || String(idFuncaoFinal) === 'NaN';
                        });
                }

                if (precisaPreencherDobra) {
                    console.log("🔄 Interceptando salvamento (Momento 1): Novas dobras detectadas. Processando modal...");

                    if (!window.dadosDiariaDobradaInjetar) {
                        window.dadosDiariaDobradaInjetar = [];
                    }

                    // 🌟 O loop agora roda APENAS nas datas novas (pula de 12 a 16 e vai direto no 17/05!)
                    for (const dataDobra of datasNovasParaPerguntarMomento1) {
                        const dataDobraLimpa = String(dataDobra).trim();

                        const jaExisteDobraValida = window.dadosDiariaDobradaInjetar.some(d => 
                            String(d.data).trim() === dataDobraLimpa && 
                            (d.idfuncaodobra || d.idFuncaoDobra) && 
                            String(d.idfuncaodobra || d.idFuncaoDobra).trim() !== '' && 
                            String(d.idfuncaodobra || d.idFuncaoDobra) !== 'NaN'
                        );

                        if (!jaExisteDobraValida) {
                            console.log(`📅 Abrindo modal obrigatório (Momento 1) para a nova data: ${dataDobraLimpa}`);

                            const dadosOrcamentoMock = { idorcamento: currentEditingStaffEvent?.idorcamento || null };
                            //const criteriosMock = { idFuncao: idFuncao, datasEvento: periodoDoEvento };
                            const criteriosMock = { 
                                idFuncaoOriginal: idFuncao, 
                                datasEvento: periodoDoEvento,
                                dataDobraFiltro: dataDobraLimpa,
                                trazerTodasComVaga: true // Flag para seu componente/API saber que deve listar o combo completo de funções disponíveis
                            };

                            const resultadoDobraDia = await perguntarFuncaoDiariaDobrada(
                                qtdPessoas,          
                                dadosOrcamentoMock,  
                                criteriosMock,       
                                descFuncao,          
                                idFuncionario,       
                                dataDobraLimpa            
                            );

                            if (!resultadoDobraDia) {
                                return Swal.fire("Operação interrompida", "É obrigatório definir as funções e preencher a justificativa de todas as datas de dobra antes de salvar.", "warning");
                            }

                            window.dadosDiariaDobradaInjetar = window.dadosDiariaDobradaInjetar.filter(d => String(d.data).trim() !== dataDobraLimpa);

                            const nomeFuncaoAlocada = resultadoDobraDia.nomeFuncao || descFuncao;
                            const setorAlvoDobra = resultadoDobraDia.setorVaga || '';
                            const textoDigitadoNoSwal = resultadoDobraDia.justificativa || '';
                            
                            const fraseJustificativaEstruturada = `Consumiu vaga da função "${nomeFuncaoAlocada}"${setorAlvoDobra ? ` do setor "${setorAlvoDobra}"` : ''} para cobrir virada. Justificativa: ${textoDigitadoNoSwal}`;

                            if (resultadoDobraDia.tipo === "ALOCACAO_NORMAL") {
                                window.dadosDiariaDobradaInjetar.push({
                                    data: dataDobraLimpa,
                                    status: "Pendente",
                                    idfuncaodobra: resultadoDobraDia.idFuncaoFinal,
                                    setordobra: resultadoDobraDia.setorVaga || '',
                                    justificativa: fraseJustificativaEstruturada,
                                    idorcamento: resultadoDobraDia.idOrcamentoFinal,
                                    vlr_cache: resultadoDobraDia.vlrCache || 0,
                                    vlr_alimentacao: resultadoDobraDia.vlrAlimentacao || 0                                    
                                });
                            } else if (resultadoDobraDia.tipo === "SOLICITAR_ADITIVO" || resultadoDobraDia.tipo === "SOLICITAR_EXTRA_BONIFICADO") {
                                window.dadosDiariaDobradaInjetar.push({
                                    data: dataDobraLimpa,
                                    status: "Pendente",
                                    idfuncaodobra: idFuncao ? parseInt(idFuncao, 10) : null,
                                    setordobra: setor || '',
                                    justificativa: fraseJustificativaEstruturada,
                                    idorcamento: resultadoDobraDia.idOrcamentoFinal,
                                    vlr_cache: resultadoDobraDia.vlrCache || 0,
                                    vlr_alimentacao: resultadoDobraDia.vlrAlimentacao || 0,    
                                    solicitacaoExcecao: true,
                                    tipoSolicitacao: resultadoDobraDia.tipo
                                });
                            }
                        }
                    }

                    const campoDescDobra = document.getElementById('descDiariaDobrada');
                    if (window.dadosDiariaDobradaInjetar?.length > 0) {
                        const tagsParaCampo = window.dadosDiariaDobradaInjetar.map(item => {
                            const dataFormatadaBR = item.data.split('-').reverse().join('/');
                            return `[Diária Dobrada ${dataFormatadaBR}] ${item.justificativa}`;
                        });
                        
                        const textoFinalString = tagsParaCampo.join(' | ');
                        if (campoDescDobra) {
                            campoDescDobra.value = textoFinalString;
                            campoDescDobra.dispatchEvent(new Event('input'));
                        }
                        if (typeof descDiariaDobradaTextarea !== 'undefined' && descDiariaDobradaTextarea) {
                            descDiariaDobradaTextarea.value = textoFinalString;
                        }
                    }
                    console.log("✅ Todas as dobras foram normalizadas e mapeadas no primeiro momento:", window.dadosDiariaDobradaInjetar);
                }
            }

            if (!nmFuncionario || !descFuncao || !vlrCusto || !nmCliente || !nmEvento || !periodoDoEvento) {
                return Swal.fire("Campos obrigatórios!", "Preencha todos os campos obrigatórios: Funcionário, Função, Cachê, Transportes, Alimentação, Cliente, Evento e Período do Evento.", "warning");
            }
            if (!seniorCheck2.checked && !seniorCheck.checked && !plenoCheck.checked && !juniorCheck.checked && !baseCheck.checked && !fechadoCheck.checked && !liberadoCheck.checked) {
                return Swal.fire("Nível de Experiência não selecionado!", "Por favor, selecione pelo menos um nível de experiência.", "warning");
            }
            if (caixinhaAtivo && !descCaixinha) {
                descCaixinhaInput?.focus();
                return Swal.fire("Campos obrigatórios!", "Preencha a descrição do benefício (Caixinha) antes de salvar.", "warning");
            }
            if (ajusteCustoAtivo && !descAjusteCusto) {
                descAjusteCustoInput?.focus();
                return Swal.fire("Campos obrigatórios!", "Preencha a descrição do bônus antes de salvar.", "warning");
            }
            if (fechadoCheck.checked && !descCustoFechado) {
                descCustoFechadoTextarea?.focus();
                return Swal.fire("Campos obrigatórios!", "Por favor, preencha a justificativa do Cachê Fechado antes de salvar.", "warning");
            }
            if (liberadoCheck.checked && !descCustoFechado) {
                descCustoFechadoTextarea?.focus();
                return Swal.fire("Campos obrigatórios!", "Por favor, preencha a justificativa do Cachê Liberado antes de salvar.", "warning");
            }

            // Validação de viagem fora SP
            const viagem1Marcada = document.getElementById('viagem1Check')?.checked || false;
            const viagem2Marcada = document.getElementById('viagem2Check')?.checked || false;
            const viagem3Marcada = document.getElementById('viagem3Check')?.checked || false;
            if (bForaSP && !viagem1Marcada && !viagem2Marcada && !viagem3Marcada) {
                await Swal.fire({
                    title: "Viagem Obrigatória",
                    html: "Este evento está cadastrado para ser realizado <strong>fora de São Paulo (SP)</strong>.<br><br>É obrigatório selecionar pelo menos uma opção de <strong>Deslocamento/Viagem</strong>.",
                    icon: "error",
                    confirmButtonText: "Entendi"
                });
                return;
            }

            // =========================================================
            // 3. ALERTA DE TROCA DE NÍVEL (FECHADO/LIBERADO → OUTRO)
            // =========================================================
            if (nivelFoiTrocado) {
                const result = await Swal.fire({
                    icon: 'warning',
                    title: 'Atenção!',
                    html: `O nível de experiência foi alterado de <strong>${nivelOriginalCarregado}</strong>.<br><br>
                        A solicitação de <strong>Cachê ${nivelOriginalCarregado}</strong> será <strong>removida</strong>.<br><br>
                        Deseja continuar?`,
                    showCancelButton: true,
                    confirmButtonText: 'Sim, continuar',
                    cancelButtonText: 'Não, cancelar'
                });
                if (!result.isConfirmed) return;
            }

            // =========================================================
            // 4. DEFINIÇÃO DE MÉTODO (POST ou PUT)
            // =========================================================
            const temPermissaoCadastrar = temPermissao("Staff", "cadastrar");
            const temPermissaoAlterar = temPermissao("Staff", "alterar");

            const idStaffEvento = document.querySelector("#idStaffEvento").value;
            const isEditingInitial = !!(currentEditingStaffEvent && currentEditingStaffEvent.idstaffevento);
            const idEventoEmEdicao = isEditingInitial ? currentEditingStaffEvent.idstaffevento : null;

            let metodo = isEditingInitial ? "PUT" : "POST";
            let url = isEditingInitial ? `/staff/${idEventoEmEdicao}` : "/staff";

            const idStaffEventoFromObject = currentEditingStaffEvent ? currentEditingStaffEvent.idstaffevento : null;
            const idStaffEventoNumero = parseInt(idStaffEvento, 10);

            if (idStaffEvento && isFormLoadedFromDoubleClick && currentEditingStaffEvent && idStaffEventoFromObject === idStaffEventoNumero) {
                metodo = "PUT";
                url = `/staff/${idStaffEvento}`;
                console.log("Modo de edição detectado via idstaffevento e flag. Método:", metodo, "URL:", url);
            } else if (!isEditingInitial) {
                metodo = "POST";
                url = "/staff";
                currentEditingStaffEvent = null;
                isFormLoadedFromDoubleClick = false;
            }

            console.log("Modo final:", metodo, "ID EVENTO PARA API:", idEventoEmEdicao);

            if (metodo === "POST" && !temPermissaoCadastrar) {
                return Swal.fire("Acesso negado", "Você não tem permissão para cadastrar novos staffs.", "error");
            }
            if (metodo === "PUT" && !temPermissaoAlterar) {
                return Swal.fire("Acesso negado", "Você não tem permissão para alterar staffs.", "error");
            }

            // =========================================================
            // 5. VARIÁVEIS PARA VERIFICAÇÕES
            // =========================================================
            const idFuncionarioParaVerificacao = idFuncionario;
            const idFuncaoDoFormulario = idFuncao;
            nmFuncaoDoFormulario = descFuncao;
            const idEventoPrincipal = idEvento;

            // Validação de pavilhão obrigatório
            const idorcamento = getUrlParameter('idorcamento');
            if (idorcamento && idFuncaoDoFormulario) {
                try {
                    const pavilhaoObrigatorio = await fetchComToken(`/staff/pavilhao?idmontagem=${idMontagem}&idorcamento=${idorcamento}&idfuncao=${idFuncaoDoFormulario}`);
                    if (pavilhaoObrigatorio.length > 0 && !pavilhao.trim()) {
                        return Swal.fire("Campo obrigatório!", "Para esta função, é obrigatório selecionar um pavilhão.", "warning");
                    }
                } catch (error) {
                    console.error("Erro ao verificar pavilhões obrigatórios:", error);
                }
            }

            // =========================================================
            // 6. VERIFICAÇÃO DE DISPONIBILIDADE
            // =========================================================
            
            const datasParaVerificacao = periodoDoEvento.map(d => {
                if (d instanceof Date) return d.toISOString().split('T')[0];
                if (typeof d === 'string') return d;
                return null;
            }).filter(d => d !== null);

            
            console.log("Iniciando verificação de disponibilidade do staff...");
            const apiResult = await verificarDisponibilidadeStaff(
                idFuncionarioParaVerificacao,
                periodoDoEvento,
                idFuncaoDoFormulario,
                idEventoEmEdicao
            );

            const {
                isAvailable,
                conflicts: initialConflicts = [],
                conflictingEvent
            } = apiResult;

            let conflicts = initialConflicts;
            const totalConflitosExistentes = conflicts.length;

            if (apiResult.conflictingEvent && !conflicts.some(c =>
                Number(c.idstaffevento) === Number(apiResult.conflictingEvent.idstaffevento)
            )) {
                conflicts.push(apiResult.conflictingEvent);
            }
            const idRegistroEmEdicaoParaFiltro = currentEditingStaffEvent?.idstaffevento || document.getElementById('idStaffEvento')?.value;

            // =========================================================
            // 7. VERIFICAÇÃO DE DUPLICIDADE
            // =========================================================
            if (metodo === "POST" || (metodo === "PUT" && !isFormLoadedFromDoubleClick)) {
                try {
                    const checkDuplicateUrl = `/staff/check-duplicate?` + new URLSearchParams({
                        idFuncionario, nmFuncionario, setor,
                        nmlocalmontagem: nmLocalMontagem,
                        nmevento: nmEvento, nmcliente: nmCliente,
                        datasevento: JSON.stringify(periodoDoEvento),
                        idFuncao: idFuncao
                    }).toString();

                    const duplicateCheckResult = await fetchComToken(checkDuplicateUrl, {
                        method: 'GET',
                        headers: { 'Content-Type': 'application/json' }
                    });

                    if (duplicateCheckResult.isDuplicate) {
                        const existingEventData = duplicateCheckResult.existingEvent;
                        //const isSelfConflict = idEvento && String(idEvento) === String(existingEventData?.idstaffevento);
                        const idStaffEventoAtual = document.querySelector("#idStaffEvento")?.value;
                        const isSelfConflict = idStaffEventoAtual && String(idStaffEventoAtual) === String(existingEventData?.idstaffevento);   
                        const isSameFunction = Number(existingEventData?.idfuncao) === Number(idFuncaoDoFormulario);
                        const isSameEvent = Number(existingEventData?.idevento) === Number(idEvento);

                        if (isSelfConflict) {
                            metodo = "PUT";
                            url = `/staff/${existingEventData.idstaffevento}`;
                           // currentEditingStaffEvent = existingEventData; //Verificar se é necessário atualizar o objeto de edição atual
                        } else if (isSameFunction) {
                            await Swal.fire({
                                icon: "error",
                                title: "Cadastro Duplicado!",
                                html: `O evento para <strong>${nmFuncionario}</strong> com a função <strong>${existingEventData.nmfuncao}</strong> JÁ ESTÁ CADASTRADO.<br><br>Edite o registro existente.`,
                                confirmButtonText: "Entendido",
                            });
                            return;
                        }
                    }
                } catch (error) {
                    console.error("Erro na verificação de duplicidade:", error);
                    Swal.fire("Erro", error.message || "Não foi possível verificar duplicidade.", "error");
                    return;
                }
            }

            // =========================================================
            // 8. VERIFICAÇÃO DE LIMITE DE AGENDAMENTOS
            // =========================================================
            const categoriaFuncaoDoFormulario = categoriaFuncao || 'PADRAO';
            const FUNCOES_EXCECAO_IDS = ['6'];
            const conflitosReais = conflicts ? conflicts.filter(c => String(c.idstaffevento) !== String(idRegistroEmEdicaoParaFiltro)) : [];

            let limiteMaximo;
            let motivoLiberacao = null;

            if (categoriaFuncaoDoFormulario === 'ATENDIMENTO PRÉ-EVENTO') {
                limiteMaximo = 4;
                motivoLiberacao = "A categoria ATENDIMENTO PRÉ-EVENTO permite até 4 agendamentos por funcionário para o mesmo dia.";
            } else {
                limiteMaximo = 1;
                motivoLiberacao = "O limite padrão é de 1 agendamento por funcionário para o mesmo dia.";
            }

            if (totalConflitosExistentes > 0) {
                const datasConflitantes = encontrarDatasConflitantes(datasParaVerificacao, conflitosReais);
                const aditivoExistente = await verificarStatusAditivoExtra(
                    idOrcamentoAtual, idFuncaoDoFormulario, 'FuncExcedido',
                    idFuncionarioParaVerificacao, nmFuncionario, nmFuncaoDoFormulario,
                    datasConflitantes, idEventoPrincipal, conflitosReais[0]?.idevento,
                    conflitosReais
                );

                if (aditivoExistente && aditivoExistente.bloqueado) return;

                if (bLiberacaoAutorizada === false) {
                    const datasConflito = encontrarDatasConflitantes(datasParaVerificacao, conflitosReais);
                    const datasFormatadas = formatarDatas(datasConflito);

                    let msg = `O funcionário <strong>${nmFuncionario}</strong> já está agendado em <strong>${totalConflitosExistentes}</strong> atividade(s) `;
                    if (datasConflito.length > 0) msg += `na(s) data(s): <strong>${datasFormatadas}</strong>.`;

                    // if (statusConflito === 'Pendente') {
                    //     msg += `<br><br>⚠️ Existe uma solicitação de autorização <strong>PENDENTE</strong> para este conflito. Aguarde a decisão antes de tentar agendar novamente.`;
                    //     return;
                    // }

                    // CASO A: Excedeu o limite → Solicitar autorização
                    if (totalConflitosExistentes >= limiteMaximo) {
                        if (aditivoExistente?.encontrado && aditivoExistente.status === 'Autorizado') {
                            await Swal.fire({
                                title: "Autorização Existente",
                                html: `Já existe uma solicitação <strong>AUTORIZADA</strong>. O agendamento será processado.`,
                                icon: "success", confirmButtonText: "Prosseguir"
                            });
                           // return;
                        }

                        msg += `<br><br>⚠️ <strong>LIMITE ATINGIDO!</strong> Máximo: ${limiteMaximo}.`;
                        conflitosReais.forEach(c => { msg += `<br> - <strong>${c.nmevento || 'N/A'}</strong> (${c.nmfuncao})`; });
                        msg += `<br><br>Deseja SOLICITAR AUTORIZAÇÃO?`;

                        const swalResult = await Swal.fire({
                            title: "Solicitar Autorização?",
                            html: `${msg}<br>
                                <label for="swal-input-justificativa">Justificativa:</label>
                                <textarea id="swal-input-justificativa" class="swal2-textarea" placeholder="Descreva o motivo..." required></textarea>`,
                            icon: "warning", 
                            showCancelButton: true,
                            confirmButtonText: "Sim, Solicitar e Agendar",
                            cancelButtonText: "Não, Cancelar",
                            preConfirm: () => {
                                const input = document.getElementById('swal-input-justificativa').value.trim();
                                if (!input) { Swal.showValidationMessage('A justificativa é obrigatória.'); return false; }
                                return input;
                            }
                        });

                        if (!swalResult.isConfirmed) return;

                        const justificativa = swalResult.value;

                        window.bSalvarComoInativo = true; 
                        window.tipoExcecaoAtual = "FuncExcedido";

                        window.prefixoSolicitacao = "[SOLICITAÇÃO - FUNCEXCEDIDO (Limite de agendamento diário excedido)]";
                        window.justificativaParaSalvar = justificativa;     
                        window.datasParaSalvarNoBanco = datasConflitantes;                  
                        
                    } else {
                        msg += `<br><br>Você está no <strong>${(totalConflitosExistentes + 1)}º</strong> agendamento (Limite: ${limiteMaximo}).`;
                        msg += `<br>Motivo: ${motivoLiberacao}<br><br>Deseja continuar?`;

                        const { isConfirmed } = await Swal.fire({
                            title: "Aviso de Conflito", html: msg, icon: "warning",
                            showCancelButton: true, confirmButtonText: "Sim, continuar", cancelButtonText: "Não, cancelar",
                        });
                        if (!isConfirmed) return;
                    }
                }
            }

            // =========================================================
            // 9. VERIFICAÇÃO DE LIMITE DE VAGAS (POST)
            // =========================================================
            if (metodo === "POST" && !isFormLoadedFromDoubleClick) {
                const datasSelecionadas = window.flatpickrInstances['datasEvento']?.selectedDates.map(date => date.toISOString().split('T')[0]) || [];
                const datasDobradas = window.flatpickrInstances['diariaDobrada']?.selectedDates.map(date => date.toISOString().split('T')[0]) || [];

                const criteriosDeVerificacao = {
                    nmEvento: nmEventoSelect.options[nmEventoSelect.selectedIndex].text,
                    nmCliente: nmClienteSelect.options[nmClienteSelect.selectedIndex].text,
                    nmlocalMontagem: nmLocalMontagemSelect.options[nmLocalMontagemSelect.selectedIndex].text,
                    nmFuncao: descFuncaoSelect.options[descFuncaoSelect.selectedIndex].text,
                    pavilhao: nmPavilhaoSelect.options[nmPavilhaoSelect.selectedIndex].text,
                    datasEvento: datasSelecionadas,
                    datasEventoDobradas: datasDobradas,
                    idFuncao: descFuncaoSelect?.value || ""
                };

                console.log("Critérios para verificação de limite de função EM POST:", criteriosDeVerificacao);
                const resultadoFuncao = await verificarLimiteDeFuncao(criteriosDeVerificacao);
                console.log("Resultado da verificação de limite de função:", resultadoFuncao);
                // if (!resultadoFuncao.allowed) {
                //     controlarBotaoSalvarStaff(false);
                //     return;
                // }

                // Se não for permitido (limite excedido), mas o usuário confirmar a solicitação:
                if (!resultadoFuncao.allowed) {
                    // Se a função 'verificarLimiteDeFuncao' já abre o Swal e retorna a justificativa,
                    // use o valor retornado. Caso contrário, se ela apenas retornar allowed: false,
                    // precisamos abrir o Swal de justificativa aqui.
                    
                    if (resultadoFuncao.solicitouAutorizacao) { // Supondo que sua função retorne isso
                        window.bSalvarComoInativo = true;
                        justificativaParaSalvar = resultadoFuncao.justificativa;
                        // Aqui você define o prefixo baseado no que excedeu (Vaga ou Data Fora)

                        window.tipoExcecaoAtual = resultadoFuncao.tipoSolicitacao;

                        // 4. Define o prefixo do log (obsgeral) verificando o conteúdo da string
                        // Usamos .includes() porque o retorno é "Aditivo - Vaga Excedida" ou similar
                        if (window.tipoExcecaoAtual && window.tipoExcecaoAtual.includes("Vaga Excedida")) {
                            window.prefixoSolicitacao = "[SOLICITAÇÃO - VAGA EXCEDIDA]";
                        } else {
                            // Caso seja "Datas fora do Orçamento" ou qualquer outro
                            window.prefixoSolicitacao = "[SOLICITAÇÃO - DATAS FORA ORÇAMENTO]";
                        }
                        
                        // prefixoSolicitacao = resultadoFuncao.tipoSolicitacao === 'VagaExcedida' 
                        //     ? "[SOLICITAÇÃO - VAGA EXCEDIDA]" 
                        //     : "[SOLICITAÇÃO - DATAS FORA ORÇAMENTO]";                      
                        
                        
                        // NÃO DAMOS RETURN! Deixamos seguir para salvar como inativo.
                    } else {
                        // Se o usuário simplesmente cancelou no Swal dentro da verificarLimiteDeFuncao
                        controlarBotaoSalvarStaff(false);
                        return; 
                    }
                }

                statusAditivoFinal = resultadoFuncao.statusAditivo;
                statusExtraBonificadoFinal = resultadoFuncao.statusExtraBonificado;

                if (typeof decisaoUsuarioDataFora !== 'undefined' && decisaoUsuarioDataFora !== null) {
                    if (decisaoUsuarioDataFora === 'ADITIVO') statusAditivoFinal = 'Pendente';
                    else if (decisaoUsuarioDataFora === 'EXTRA') statusExtraBonificadoFinal = 'Pendente';
                }
            }

            // =========================================================
            // 10. CÁLCULO DE STATUS
            // =========================================================
            const vlrCustoNumerico = parseFloat(String(vlrCusto).replace(',', '.')) || 0;

            let statusPgto = document.querySelector("#statusPgto")?.value || '';
            let statusPgtoAjusteCusto = document.querySelector("#statusPgtoAjudaCusto")?.value || '';
            let statusPgtoCaixinha = document.querySelector("#statusPgtoCaixinha")?.value || '';

            // Status Caixinha
            if (!statusCaixinha || statusCaixinha.trim() === '') {
                const valorCaixinhaNumerico = parseFloat(caixinhaInput.value.replace(',', '.')) || 0;
                const textoDescricao = descCaixinhaTextarea.value?.trim() || '';
                statusCaixinha = (valorCaixinhaNumerico > 0 || (textoDescricao !== '' && textoDescricao !== '-')) ? 'Pendente' : '';
            }
            if (statusCaixinha === 'Autorizado') statusPgtoCaixinha = 'Pendente';

            // Status Ajuste de Custo
            if (!statusAjusteCusto || statusAjusteCusto.trim() === '') {
                const vlrAjusteNum = parseFloat(ajusteCusto) || 0;
                const descAjusteTxt = document.getElementById("descAjusteCusto").value.trim();
                const checkAjusteManual = document.getElementById("ajusteCustocheck");
                //statusAjusteCusto = (vlrAjusteNum > 0 || (descAjusteTxt !== '' && descAjusteTxt !== '-') || checkAjusteManual?.checked) ? 'Pendente' : '';
                statusAjusteCusto = (vlrAjusteNum !== 0 || (descAjusteTxt !== '' && descAjusteTxt !== '-')) ? 'Pendente' : '';
            }

            console.log("STATUSCUSTOFECHADO ANTES DE TRATAR", statusFechado, "Check:", fechadoCheck.checked, "Valor:", vlrCustoNumerico);
            // Status Custo Fechado/Liberado
            // if (!statusFechado || statusFechado.trim() === '') {
            //     statusFechado = ((fechadoCheck.checked || liberadoCheck.checked) && vlrCustoNumerico > 0) ? 'Pendente' : '';
            // }
            

            // Só define 'Pendente' se statusFechado estiver realmente vazio
            if (!statusFechado || statusFechado.trim() === '' || statusFechado === 'none') {
                statusFechado = ((fechadoCheck.checked || liberadoCheck.checked) && vlrCustoNumerico > 0) 
                    ? 'Pendente' 
                    : '';
            }

            if (!fechadoCheck.checked && !liberadoCheck.checked) statusFechado = '';

            // Se houve troca de nível, zera statusFechado e descCustoFechado no envio
            const statusFechadoParaEnvio = nivelFoiTrocado ? null : statusFechado;
            const descCustoFechadoParaEnvio = nivelFoiTrocado ? null : descCustoFechado;

            console.log("STATUSCUSTOFECHADO DEPOIS DE TRATAR", statusFechado, "Check:", fechadoCheck.checked, "Valor:", vlrCustoNumerico);


            // =========================================================
            // 11. COMPROVANTES
            // =========================================================
            const fileCacheInput = document.getElementById('fileCache');
            const hiddenRemoverCacheInput = document.getElementById('limparComprovanteCache');
            let comppgtocacheDoForm;
            if (fileCacheInput.files?.[0]) { comppgtocacheDoForm = 'novo-arquivo'; }
            else if (hiddenRemoverCacheInput.value === 'true') { comppgtocacheDoForm = ''; }
            else { comppgtocacheDoForm = currentEditingStaffEvent?.comppgtocache || ''; }

            const fileAjdCustoInput = document.getElementById('fileAjdCusto');
            const hiddenRemoverAjdCustoInput = document.getElementById('limparComprovanteAjdCusto');
            let comppgtoajdcustoDoForm;
            if (fileAjdCustoInput.files?.[0]) { comppgtoajdcustoDoForm = 'novo-arquivo'; }
            else if (hiddenRemoverAjdCustoInput.value === 'true') { comppgtoajdcustoDoForm = ''; }
            else { comppgtoajdcustoDoForm = currentEditingStaffEvent?.comppgtoajdcusto || ''; }

            const fileAjdCusto2Input = document.getElementById('fileAjdCusto2');
            const hiddenRemoverAjdCusto2Input = document.getElementById('limparComprovanteAjdCusto2');
            let comppgtoajdcusto50DoForm;
            if (fileAjdCusto2Input.files?.[0]) { comppgtoajdcusto50DoForm = 'novo-arquivo'; }
            else if (hiddenRemoverAjdCusto2Input.value === 'true') { comppgtoajdcusto50DoForm = ''; }
            else { comppgtoajdcusto50DoForm = currentEditingStaffEvent?.comppgtoajdcusto50 || ''; }

            const fileCaixinhaInput = document.getElementById('fileCaixinha');
            const hiddenRemoverCaixinhaInput = document.getElementById('limparComprovanteCaixinha');
            let comppgtocaixinhaDoForm;
            if (fileCaixinhaInput.files?.[0]) { comppgtocaixinhaDoForm = 'novo-arquivo'; }
            else if (hiddenRemoverCaixinhaInput.value === 'true') { comppgtocaixinhaDoForm = ''; }
            else { comppgtocaixinhaDoForm = currentEditingStaffEvent?.comppgtocaixinha || ''; }

            const fileControleGastosInput = document.getElementById('fileControleGastos');
            const hiddenRemoverControleGastosInput = document.getElementById('limparComprovanteControleGastos');
            let compcontrolegastosDoForm;
            if (fileControleGastosInput.files?.[0]) { compcontrolegastosDoForm = 'novo-arquivo'; }
            else if (hiddenRemoverControleGastosInput.value === 'true') { compcontrolegastosDoForm = ''; }
            else { compcontrolegastosDoForm = currentEditingStaffEvent?.compcontrolegastos || ''; }


            // =========================================================
            // 12. MONTAGEM DO NÍVEL DE EXPERIÊNCIA
            // =========================================================
            let nivelExperienciaSelecionado = "";
            if (seniorCheck2.checked) nivelExperienciaSelecionado = "Senior 2";
            else if (seniorCheck.checked) nivelExperienciaSelecionado = "Senior";
            else if (plenoCheck.checked) nivelExperienciaSelecionado = "Pleno";
            else if (juniorCheck.checked) nivelExperienciaSelecionado = "Junior";
            else if (baseCheck.checked) nivelExperienciaSelecionado = "Base";
            else if (fechadoCheck.checked) nivelExperienciaSelecionado = "Fechado";
            else if (liberadoCheck.checked) nivelExperienciaSelecionado = "Liberado";

            // =========================================================
            // 13. VERIFICAÇÕES EXTRAS PARA PUT
            // =========================================================
            let textoLogDatas = "";
            if (metodo === "PUT") {
                if (!isEditingInitial) {
                    return Swal.fire("Erro", "Dados originais não encontrados para comparação (ID ausente para PUT).", "error");
                }

                const ajusteCustoAtivoOriginal = parseFloat(currentEditingStaffEvent.vlrajustecusto || 0) > 0;
                const caixinhaAtivoOriginal = parseFloat(currentEditingStaffEvent.vlrcaixinha || 0) > 0;
                const ajusteCustoValorOriginal = parseFloat(currentEditingStaffEvent.vlrajustecusto || 0);
                const caixinhaValorOriginal = parseFloat(currentEditingStaffEvent.vlrcaixinha || 0);

                const dataDiariaDobradaOriginal = currentEditingStaffEvent.dtdiariadobrada || [];
                const dataMeiaDiariaOriginal = currentEditingStaffEvent.dtmeiadiaria || [];
                const dataDiariaDobradaOriginalLimpa = dataDiariaDobradaOriginal.map(item => typeof item === 'object' ? item.data : item);
                const dataMeiaDiariaOriginalLimpa = dataMeiaDiariaOriginal.map(item => typeof item === 'object' ? item.data : item);

                const ajusteCustoValorAtual = parseFloat(ajusteCusto.replace(',', '.') || 0);
                const caixinhaValorAtual = parseFloat(caixinha.replace(',', '.') || 0);
                const custoFechadoAtivoAtual = fechadoCheck.checked;
                const diariaDobradaAtual = diariaDobradacheck.checked;
                const meiaDiariaAtual = meiaDiariacheck.checked;
                const nivelExperienciaAtual = nivelExperienciaSelecionado;
                const qtdPessoasAtual = qtdPessoas;

                // 🌟 1. BUSCA AS DATAS IMEDIATAMENTE (CORREÇÃO DO SWAL VAZIO)
                let datasDobradas = window.flatpickrInstances['diariaDobrada']?.selectedDates.map(date => date.toISOString().split('T')[0]) || [];
                if (datasDobradas.length === 0) {
                    datasDobradas = periodoDobrado.map(item => typeof item === 'object' ? item.data : item) || [];
                }

                let datasSelecionadas = window.flatpickrInstances['datasEvento']?.selectedDates.map(date => date.toISOString().split('T')[0]) || [];
                if (datasSelecionadas.length === 0) {
                    datasSelecionadas = periodoDoEvento || [];
                }

                // --- 4. INICIALIZAÇÃO IMEDIATA DOS CRITÉRIOS DE VERIFICAÇÃO ---
                // Inicializado aqui em cima para que as validações abaixo possam usá-lo com segurança!
                const criteriosDeVerificacao = {
                    idEvento: parseInt(nmEventoSelect?.value),
                    idCliente: parseInt(nmClienteSelect?.value),
                    idLocalMontagem: parseInt(nmLocalMontagemSelect?.value),
                    nmEvento: getSelectedText(nmEventoSelect),
                    nmCliente: getSelectedText(nmClienteSelect),
                    nmlocalMontagem: getSelectedText(nmLocalMontagemSelect),
                    nmFuncao: getSelectedText(descFuncaoSelect),
                    pavilhao: getSelectedText(nmPavilhaoSelect),  
                    datasEvento: datasSelecionadas,              
                    datasEventoDobradas: datasDobradas, 
                    idFuncao: descFuncaoSelect?.value || "",
                    idStaff: currentEditingStaffEvent?.idstaff || null
                };
                
                const houveAlteracaoAjusteCusto = (ajusteCustoAtivoOriginal !== ajusteCustoAtivo) || (ajusteCustoValorOriginal !== ajusteCustoValorAtual);
                const houveAlteracaoCaixinha = (caixinhaAtivoOriginal !== caixinhaAtivo) || (caixinhaValorOriginal !== caixinhaValorAtual);
                const houveAlteracaoDiariaDobrada = (dataDiariaDobradaOriginalLimpa.toString() !== periodoDobrado.toString());
                const houveAlteracaoMeiaDiaria = (dataMeiaDiariaOriginalLimpa.toString() !== periodoMeiaDiaria.toString());
                const houveAlteracaoDatas = JSON.stringify(currentEditingStaffEvent.datasevento || []) !== JSON.stringify(periodoDoEvento);
    
                
                
                // if (houveAlteracaoDatas) {
                //     const datasOriginais = currentEditingStaffEvent.datasevento || [];
                //     const datasNovas = periodoDoEvento || [];

                //     // Descobrir quais foram removidas e quais foram inseridas
                //     const removidas = datasOriginais.filter(d => !datasNovas.includes(d));
                //     const inseridas = datasNovas.filter(d => !datasOriginais.includes(d));

                //     const formataDataBR = (dataISO) => {
                //         const [ano, mes, dia] = dataISO.split('-');
                //         return `${dia}/${mes}/${ano}`;
                //     };

                //     let partesLog = [];
                //     if (removidas.length > 0) {
                //         partesLog.push(`Data(s) removida(s): ${removidas.map(formataDataBR).join(', ')} - Motivo: Remoção Data`);
                //     }
                //     if (inseridas.length > 0) {
                //         partesLog.push(`Data(s) inserida(s): ${inseridas.map(formataDataBR).join(', ')} - Motivo: Acrescentando Data`);
                //     }

                //     if (partesLog.length > 0) {
                //         const agora = new Date();
                //         const horaFormatada = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                //         const dataFormatada = agora.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                        
                //         textoLogDatas = `[${dataFormatada}, ${horaFormatada}] Alteração de Datas: ${partesLog.join(' | ')}`;
                //         textoLogDatas = `[${dataFormatada}, ${horaFormatada}] Alteração de Datas: ${partesLog.join(' | ')}`;
                //     }
                // }

                if (houveAlteracaoCaixinha && caixinhaAtivo && (!descCaixinha || descCaixinha.length < 15)) {
                    descCaixinhaInput?.focus();
                    return Swal.fire("Campos obrigatórios!", "A descrição da Caixinha deve ter no mínimo 15 caracteres.", "warning");
                }
                if (houveAlteracaoAjusteCusto && ajusteCustoAtivo && (!descAjusteCusto || descAjusteCusto.length < 15)) {
                    descAjusteCustoInput?.focus();
                    return Swal.fire("Campos obrigatórios!", "A descrição do Bônus deve ter no mínimo 15 caracteres.", "warning");
                }
                if (houveAlteracaoAjusteCusto && custoFechadoAtivoAtual && (!descCustoFechado || descCustoFechado.length < 15)) {
                    descCustoFechadoTextarea?.focus();
                    return Swal.fire("Campos obrigatórios!", "A descrição do Cachê Fechado deve ter no mínimo 15 caracteres.", "warning");
                }
                // if (houveAlteracaoDiariaDobrada && diariaDobradaAtual) {
                //     const descDD = document.getElementById("descDiariaDobrada").value.trim();
                //     if (!descDD || descDD.length < 15) {
                //         document.getElementById("descDiariaDobrada")?.focus();
                //         return Swal.fire("Campo obrigatório!", "A descrição da Diária Dobrada deve ter no mínimo 15 caracteres.", "warning");
                //     }
                // }

                // 🌟 NOVO FLUXO: Removemos a obrigatoriedade do caractere mínimo no campo da tela, 
                // pois cada data já foi validada individualmente com excelência dentro do loop!
                // if (houveAlteracaoDiariaDobrada && diariaDobradaAtual) {
                //     // Pegamos as datas que estão selecionadas na tela/calendário para a dobra
                //     if (!datasDobradas || datasDobradas.length === 0) {
                //         return Swal.fire("Atenção!", "Você ativou a Diária Dobrada, mas não selecionou nenhuma data no calendário.", "warning");
                //     }

                //     // Garante que o array final de injeção foi gerado com sucesso e não está vazio
                //     if (!window.dadosDiariaDobradaInjetar || window.dadosDiariaDobradaInjetar.length === 0) {
                //         return Swal.fire("Operação incompleta", "Por favor, selecione as funções ou solicite Aditivo ou Extra bonificado e preencha as justificativas para as datas dobradas antes de salvar.", "warning");
                //     }
                // }

                // 🌟 VALIDAÇÃO DA DIÁRIA DOBRADA COM RECONSTRUÇÃO DE INJEÇÃO AUTOMÁTICA
                // --- 7. VALIDAÇÃO CORRIGIDA DA DIÁRIA DOBRADA (COM RECONSTRUÇÃO AUTOMÁTICA) ---
                // if (houveAlteracaoDiariaDobrada && diariaDobradaAtual) {
                //     if (!datasDobradas || datasDobradas.length === 0) {
                //         return Swal.fire("Atenção!", "Você ativou a Diária Dobrada, mas não selecionou nenhuma data no calendário.", "warning");
                //     }

                //     // Se a variável global veio vazia por ser PUT direto da listagem, reconstrói com histórico estável do banco
                //     if (!window.dadosDiariaDobradaInjetar || window.dadosDiariaDobradaInjetar.length === 0) {
                //         console.log("🔄 [PUT] window.dadosDiariaDobradaInjetar vazio. Gerando fallback estável dos dados originais...");
                //         const originalDobra = currentEditingStaffEvent.dtdiariadobrada || [];
                        
                //         window.dadosDiariaDobradaInjetar = originalDobra.map(item => {
                //             if (typeof item === 'object' && item !== null) {
                //                 return {
                //                     data: item.data || '',
                //                     justificativa: item.justificativa || item.desc || 'Mantido original do sistema',
                //                     idFuncao: criteriosDeVerificacao.idFuncao,
                //                     nmFuncao: criteriosDeVerificacao.nmFuncao
                //                 };
                //             }
                //             return {
                //                 data: item,
                //                 justificativa: 'Mantido original do sistema',
                //                 idFuncao: criteriosDeVerificacao.idFuncao,
                //                 nmFuncao: criteriosDeVerificacao.nmFuncao
                //             };
                //         }).filter(item => item.data);
                //     }

                //     // Se mesmo com o fallback continuar completamente sem dados, barra
                //     if (!window.dadosDiariaDobradaInjetar || window.dadosDiariaDobradaInjetar.length === 0) {
                //         return Swal.fire("Operação incompleta", "Por favor, selecione as funções ou solicite Aditivo ou Extra bonificado e preencha as justificativas para as datas dobradas antes de salvar.", "warning");
                //     }
                // }

                // 🌟 VALIDAÇÃO DA DIÁRIA DOBRADA COM RECONSTRUÇÃO DE INJEÇÃO AUTOMÁTICA
                // --- 7. VALIDAÇÃO CORRIGIDA DA DIÁRIA DOBRADA (COM RECONSTRUÇÃO AUTOMÁTICA) ---
                if (houveAlteracaoDiariaDobrada && diariaDobradaAtual) {
                    if (!datasDobradas || datasDobradas.length === 0) {
                        return Swal.fire("Atenção!", "Você ativou a Diária Dobrada, mas não selecionou nenhuma data no calendário.", "warning");
                    }

                    // Se a variável global veio vazia por ser PUT direto da listagem ou dados novos limpados
                    if (!window.dadosDiariaDobradaInjetar || window.dadosDiariaDobradaInjetar.length === 0) {
                        console.log("🔄 [PUT] window.dadosDiariaDobradaInjetar vazio. Gerando fallback estável...");
                        const originalDobra = currentEditingStaffEvent?.dtdiariadobrada || [];
                        
                        if (originalDobra.length > 0) {
                            // Se havia dados antigos no banco, mapeia mantendo a estrutura e tratando nulos
                            window.dadosDiariaDobradaInjetar = originalDobra.map(item => {
                                if (typeof item === 'object' && item !== null) {
                                    return {
                                        data: item.data || '',
                                        idfuncaodobra: item.idfuncaodobra !== undefined && item.idfuncaodobra !== null ? parseInt(item.idfuncaodobra) : (criteriosDeVerificacao.idFuncao || null),
                                        setordobra: item.setordobra || '',
                                        justificativa: item.justificativa || ''
                                    };
                                }
                                return {
                                    data: item || '',
                                    idfuncaodobra: criteriosDeVerificacao.idFuncao || null,
                                    setordobra: '',
                                    justificativa: ''
                                };
                            }).filter(item => item.data && item.idfuncaodobra);
                        } else {
                            // Se o banco estava zerado, monta com base nas datas selecionadas na tela
                            window.dadosDiariaDobradaInjetar = datasDobradas.map(dt => {
                                return {
                                    data: dt,
                                    idfuncaodobra: criteriosDeVerificacao.idFuncao || null,
                                    setordobra: '',
                                    justificativa: 'Adicionado em edição'
                                };
                            }).filter(item => item.data && item.idfuncaodobra);
                        }
                    }

                    // 🌟 VALIDAÇÃO EXTRA DE SEGURANÇA TRATADA (ANTI-QUEBRA):
                    // Analisa se realmente existe algum item com id da função totalmente ausente
                    const possuiItemInvalido = Array.isArray(window.dadosDiariaDobradaInjetar) && window.dadosDiariaDobradaInjetar.some(d => {
                        if (!d.data) return true; // Data ausente é inválido
                        
                        // Se o ID for nulo ou indefinido, acusa inválido
                        if (d.idfuncaodobra === null || d.idfuncaodobra === undefined) return true;
                        
                        // Converte para string com segurança antes de verificar se está vazio
                        const idStr = String(d.idfuncaodobra).trim();
                        return idStr === '' || idStr === 'NaN';
                    });

                    if (!window.dadosDiariaDobradaInjetar || window.dadosDiariaDobradaInjetar.length === 0 || possuiItemInvalido) {
                        console.warn("⚠️ Array de injeção possui itens incompletos:", window.dadosDiariaDobradaInjetar);
                        return Swal.fire("Operação incompleta", "Por favor, selecione as funções para as datas dobradas antes de salvar.", "warning");
                    }
                    // 🌟 AQUI ENTRA A GERAÇÃO E RECONSTRUÇÃO AUTOMÁTICA DO TEXTO 🌟
                    // Agora que o array passou em todas as validações, geramos a descrição formatada
                    const textoGeradoAutomatico = window.dadosDiariaDobradaInjetar.map(dobra => {
                        // Tenta pegar o nome da função do objeto, se não tiver usa o da tela ou deixa "Não informada"
                        const nomeFuncaoDobra = dobra.nmFuncao || criteriosDeVerificacao.nmFuncao || "Não informada";
                        const justificativaDobra = dobra.justificativa ? dobra.justificativa.trim() : "Sem justificativa";
                        
                        return `[Diária Dobrada ${dobra.data}] ${justificativaDobra}`;
                    }).join("\n");

                    // Injeta esse texto no textarea da tela para que o FormData leia o valor atualizado
                    const campoDesc = document.getElementById("descDiariaDobrada") || (typeof descDiariaDobradaTextarea !== 'undefined' ? descDiariaDobradaTextarea : null);
                    if (campoDesc) {
                        campoDesc.value = textoGeradoAutomatico;
                        console.log("📝 Texto da diária dobrada atualizado no input com sucesso!");
                    }
                }

                if (houveAlteracaoMeiaDiaria && meiaDiariaAtual) {
                    const descMD = document.getElementById("descMeiaDiaria").value.trim();
                    if (!descMD || descMD.length < 15) {
                        document.getElementById("descMeiaDiaria")?.focus();
                        return Swal.fire("Campo obrigatório!", "A descrição da Meia Diária deve ter no mínimo 15 caracteres.", "warning");
                    }
                }

                // Verificação de alterações
                const logAndCheck = (fieldName, originalValue, currentValue, condition) => {
                    console.log(`[COMPARACAO] ${fieldName}: Original = '${originalValue}' | Atual = '${currentValue}' | Diferente = ${condition}`);
                    return condition;
                };
                


                // Garantimos que ambos virem String para não dar falso positivo (ex: 2 diferente de '2')
               const idEquipeOriginalRaw = currentEditingStaffEvent && currentEditingStaffEvent.idequipe !== undefined 
                    ? currentEditingStaffEvent.idequipe 
                    : '';

                const idEquipeOriginal = String(idEquipeOriginalRaw).trim();
                const idEquipeAtual = String(idEquipe || '').trim();

                // ADICIONE ESTAS 2 LINHAS antes do houveAlteracao:
                console.log("🔍 DEBUG idequipe:", currentEditingStaffEvent?.idequipe, "| idEquipeOriginalRaw:", idEquipeOriginalRaw, "| idEquipeOriginal:", idEquipeOriginal);
                console.log("🔍 currentEditingStaffEvent keys:", Object.keys(currentEditingStaffEvent || {}));
                

                const houveAlteracao =
                    logAndCheck('ID Equipe', currentEditingStaffEvent.idequipe, idEquipe, currentEditingStaffEvent.idequipe != idEquipe) ||
                    //logAndCheck('ID Equipe', idEquipeOriginal, idEquipe, idEquipeOriginal !== idEquipe)
                    logAndCheck('Equipe', currentEditingStaffEvent.nmequipe?.toUpperCase(), nmEquipe, currentEditingStaffEvent.nmequipe?.toUpperCase() != nmEquipe) ||
                    //logAndCheck('Equipe', (currentEditingStaffEvent.nmequipe || '').toUpperCase(), (nmEquipe || '').toUpperCase(), (currentEditingStaffEvent.nmequipe || '') !== '' && (currentEditingStaffEvent.nmequipe || '').toUpperCase() !== (nmEquipe || '').toUpperCase()) || 
                    logAndCheck('ID Funcionário', currentEditingStaffEvent.idfuncionario, idFuncionario, currentEditingStaffEvent.idfuncionario != idFuncionario) ||
                    logAndCheck('Função', currentEditingStaffEvent.nmfuncao?.toUpperCase(), descFuncao, currentEditingStaffEvent.nmfuncao?.toUpperCase() != descFuncao) ||
                    logAndCheck('Valor Cache', parseFloat(currentEditingStaffEvent.vlrcache || 0), parseFloat(vlrCusto.replace(',', '.') || 0), parseFloat(currentEditingStaffEvent.vlrcache || 0) != parseFloat(vlrCusto.replace(',', '.') || 0)) ||
                    logAndCheck('Datas Evento', JSON.stringify(currentEditingStaffEvent.datasevento || []), JSON.stringify(periodoDoEvento), JSON.stringify(currentEditingStaffEvent.datasevento || []) !== JSON.stringify(periodoDoEvento)) ||
                    logAndCheck('Valor AjusteCusto', parseFloat(currentEditingStaffEvent.vlrajustecusto || 0), ajusteCustoValorAtual, parseFloat(currentEditingStaffEvent.vlrajustecusto || 0) != ajusteCustoValorAtual) ||
                    logAndCheck('Valor Transporte', parseFloat(currentEditingStaffEvent.vlrtransporte || 0), parseFloat(transporte.replace(',', '.') || 0), parseFloat(currentEditingStaffEvent.vlrtransporte || 0) != parseFloat(transporte.replace(',', '.') || 0)) ||
                    logAndCheck('Valor Alimentação', parseFloat(currentEditingStaffEvent.vlralimentacao || 0), parseFloat(alimentacao.replace(',', '.') || 0), parseFloat(currentEditingStaffEvent.vlralimentacao || 0) != parseFloat(alimentacao.replace(',', '.') || 0)) ||
                    logAndCheck('Valor Caixinha', parseFloat(currentEditingStaffEvent.vlrcaixinha || 0), caixinhaValorAtual, parseFloat(currentEditingStaffEvent.vlrcaixinha || 0) != caixinhaValorAtual) ||
                    logAndCheck('Descrição Bônus', (currentEditingStaffEvent.descajustecusto || '').trim(), descAjusteCusto.trim(), (currentEditingStaffEvent.descajustecusto || '').trim() != descAjusteCusto.trim()) ||
                    logAndCheck('Descrição Benefícios', (currentEditingStaffEvent.descbeneficios || '').trim(), descBeneficio.trim(), (currentEditingStaffEvent.descbeneficios || '').trim() != descBeneficio.trim()) ||
                    logAndCheck('Descrição Caixinha', (currentEditingStaffEvent.desccaixinha || '').trim(), descCaixinha.trim(), (currentEditingStaffEvent.desccaixinha || '').trim() != descCaixinha.trim()) ||
                    logAndCheck('Setor', (currentEditingStaffEvent.setor?.toUpperCase() || '').trim(), setor.trim(), (currentEditingStaffEvent.setor?.toUpperCase() || '').trim() != setor.trim()) ||
                    //logAndCheck('StatusPgto', (currentEditingStaffEvent.statuspgto || '').trim(), statusPgto.trim(), (currentEditingStaffEvent.statuspgto || '').trim() != statusPgto.trim()) ||
                    logAndCheck('StatusPgto', (currentEditingStaffEvent.statuspgto || '').trim().toUpperCase(), statusPgto.trim().toUpperCase(), (currentEditingStaffEvent.statuspgto || '').trim().toUpperCase() != statusPgto.trim().toUpperCase()) ||
                    //logAndCheck('StatusAjusteCusto', (currentEditingStaffEvent.statusajustecusto || '').trim().toUpperCase(), (statusAjusteCusto || '').trim().toUpperCase(), (currentEditingStaffEvent.statusajustecusto || '').trim().toUpperCase() != (statusAjusteCusto || '').trim().toUpperCase()) ||
                    logAndCheck('StatusAjusteCusto', (currentEditingStaffEvent.statusajustecusto || '').trim().toUpperCase(), (statusAjusteCustoParaComparacao || '').trim().toUpperCase(), (currentEditingStaffEvent.statusajustecusto || '').trim().toUpperCase() != (statusAjusteCustoParaComparacao || '').trim().toUpperCase()) ||
                    logAndCheck('StatusCaixinha', (currentEditingStaffEvent.statuscaixinha || '').trim().toUpperCase(), (statusCaixinha || '').trim().toUpperCase(), (currentEditingStaffEvent.statuscaixinha || '').trim().toUpperCase() != (statusCaixinha || '').trim().toUpperCase()) ||
                    logAndCheck('StatusCustoFechado', (currentEditingStaffEvent.statuscustofechado || '').trim().toUpperCase(), (statusFechadoParaEnvio || '').trim().toUpperCase(), (currentEditingStaffEvent.statuscustofechado || '').trim().toUpperCase() != (statusFechadoParaEnvio || '').trim().toUpperCase()) ||
                    logAndCheck('ID Cliente', currentEditingStaffEvent.idcliente, idCliente, currentEditingStaffEvent.idcliente != idCliente) ||
                    logAndCheck('ID Evento', currentEditingStaffEvent.idevento, idEvento, currentEditingStaffEvent.idevento != idEvento) ||
                    logAndCheck('ID Montagem', currentEditingStaffEvent.idmontagem, idMontagem, currentEditingStaffEvent.idmontagem != idMontagem) ||
                    logAndCheck('Pavilhão', (currentEditingStaffEvent.pavilhao || '').toUpperCase().trim(), pavilhao.toUpperCase().trim(), (currentEditingStaffEvent.pavilhao || '').toUpperCase().trim() != pavilhao.toUpperCase().trim()) ||
                    logAndCheck('Comprovante Cache', normalizeEmptyValue(currentEditingStaffEvent.comppgtocache), normalizeEmptyValue(comppgtocacheDoForm), normalizeEmptyValue(currentEditingStaffEvent.comppgtocache) !== normalizeEmptyValue(comppgtocacheDoForm)) ||
                    logAndCheck('Comprovante AjdCusto', normalizeEmptyValue(currentEditingStaffEvent.comppgtoajdcusto), normalizeEmptyValue(comppgtoajdcustoDoForm), normalizeEmptyValue(currentEditingStaffEvent.comppgtoajdcusto) !== normalizeEmptyValue(comppgtoajdcustoDoForm)) ||
                    logAndCheck('Comprovante AjdCusto50', normalizeEmptyValue(currentEditingStaffEvent.comppgtoajdcusto50), normalizeEmptyValue(comppgtoajdcusto50DoForm), normalizeEmptyValue(currentEditingStaffEvent.comppgtoajdcusto50) !== normalizeEmptyValue(comppgtoajdcusto50DoForm)) ||
                    logAndCheck('Comprovante Caixinha', normalizeEmptyValue(currentEditingStaffEvent.comppgtocaixinha), normalizeEmptyValue(comppgtocaixinhaDoForm), normalizeEmptyValue(currentEditingStaffEvent.comppgtocaixinha) !== normalizeEmptyValue(comppgtocaixinhaDoForm)) ||
                    logAndCheck('Comprovante ControleGastos', normalizeEmptyValue(currentEditingStaffEvent.compcontrolegastos), normalizeEmptyValue(compcontrolegastosDoForm), normalizeEmptyValue(currentEditingStaffEvent.compcontrolegastos) !== normalizeEmptyValue(compcontrolegastosDoForm)) ||
                    logAndCheck('Datas Diária Dobrada', JSON.stringify(dataDiariaDobradaOriginalLimpa), JSON.stringify(periodoDobrado), JSON.stringify(dataDiariaDobradaOriginalLimpa) !== JSON.stringify(periodoDobrado)) ||
                    logAndCheck('Datas Meia Diária', JSON.stringify(dataMeiaDiariaOriginalLimpa), JSON.stringify(periodoMeiaDiaria), JSON.stringify(dataMeiaDiariaOriginalLimpa) !== JSON.stringify(periodoMeiaDiaria)) ||
                    //logAndCheck('Status Diária Dobrada', (currentEditingStaffEvent.statusdiariadobrada || '').trim().toUpperCase(), (statusDiariaDobrada || '').trim().toUpperCase(), (currentEditingStaffEvent.statusdiariadobrada || '').trim().toUpperCase() != (statusDiariaDobrada || '').trim().toUpperCase()) ||
                    //logAndCheck('Status Meia Diária', (currentEditingStaffEvent.statusmeiadiaria || '').trim().toUpperCase(), (statusMeiaDiaria || '').trim().toUpperCase(), (currentEditingStaffEvent.statusmeiadiaria || '').trim().toUpperCase() != (statusMeiaDiaria || '').trim().toUpperCase()) ||
                    logAndCheck(
                        'Status Meia Diária (array)', 
                        JSON.stringify((currentEditingStaffEvent.dtmeiadiaria || []).map(i => ({ data: i.data, status: i.status }))), 
                        JSON.stringify(datasMeiaDiaria.map(i => ({ data: i.data, status: i.status }))), 
                        JSON.stringify((currentEditingStaffEvent.dtmeiadiaria || []).map(i => ({ data: i.data, status: i.status }))) !== JSON.stringify(datasMeiaDiaria.map(i => ({ data: i.data, status: i.status })))
                    ) ||
                    logAndCheck(
                        'Status Diária Dobrada (array)', 
                        JSON.stringify((currentEditingStaffEvent.dtdiariadobrada || []).map(i => ({ data: i.data, status: i.status }))), 
                        JSON.stringify(datasDobrada.map(i => ({ data: i.data, status: i.status }))), 
                        JSON.stringify((currentEditingStaffEvent.dtdiariadobrada || []).map(i => ({ data: i.data, status: i.status }))) !== JSON.stringify(datasDobrada.map(i => ({ data: i.data, status: i.status })))
                    ) ||
                    logAndCheck('Nível Experiência', (currentEditingStaffEvent.nivelexperiencia || '').trim(), nivelExperienciaAtual.trim(), (currentEditingStaffEvent.nivelexperiencia || '').trim() != nivelExperienciaAtual.trim()) ||
                    logAndCheck('Qtd Pessoas', currentEditingStaffEvent.qtdpessoas || 0, qtdPessoasAtual || 0, (currentEditingStaffEvent.qtdpessoas || 0) != (qtdPessoasAtual || 0)) ||
                    nivelFoiTrocado; // ← Se houve troca de nível, força alteração

                if (!houveAlteracao) {
                    return Swal.fire("Nenhuma alteração detectada", "Faça alguma alteração antes de salvar.", "info");
                }

                console.log("HOUVE ALTERAÇÃO:", houveAlteracao, "ALTEROU DATAS:", houveAlteracaoDatas);

                const alterouDadosOrcamento = houveAlteracaoDatas || houveAlteracaoDiariaDobrada || logAndCheck('Função', currentEditingStaffEvent.nmfuncao?.toUpperCase(), descFuncao, currentEditingStaffEvent.nmfuncao?.toUpperCase() != descFuncao);
                console.log("HOUVE ALTERAÇÃO:", houveAlteracao, "ALTEROU DATAS:", houveAlteracaoDatas, "ALTEROU FUNÇÃO:", alterouDadosOrcamento);

                if (alterouDadosOrcamento) {
                    const datasSelecionadas = window.flatpickrInstances['datasEvento']?.selectedDates.map(date => date.toISOString().split('T')[0]) || [];
                    const datasDobradas = window.flatpickrInstances['diariaDobrada']?.selectedDates.map(date => date.toISOString().split('T')[0]) || [];

                    const criteriosDeVerificacao = {
                        nmEvento: nmEventoSelect.options[nmEventoSelect.selectedIndex].text,
                        nmCliente: nmClienteSelect.options[nmClienteSelect.selectedIndex].text,
                        nmlocalMontagem: nmLocalMontagemSelect.options[nmLocalMontagemSelect.selectedIndex].text,
                        nmFuncao: descFuncaoSelect.options[descFuncaoSelect.selectedIndex].text,
                        pavilhao: nmPavilhaoSelect.options[nmPavilhaoSelect.selectedIndex].text,
                        datasEvento: datasSelecionadas,
                        datasEventoDobradas: datasDobradas,
                        idFuncao: descFuncaoSelect.value,
                        idEvento: parseInt(nmEventoSelect?.value),
                        idCliente: parseInt(nmClienteSelect?.value),
                        idLocalMontagem: parseInt(nmLocalMontagemSelect?.value),
                        idStaff: currentEditingStaffEvent.idstaff
                    };

                    console.log("Critérios para verificação de limite de função EM PUT:", criteriosDeVerificacao);

                    if (typeof window.orcamentoPorFuncao === 'undefined' || !window.orcamentoPorFuncao) {
                        window.orcamentoPorFuncao = {};
                    }

                    const chave = `${criteriosDeVerificacao.nmEvento.toUpperCase()}-${criteriosDeVerificacao.nmFuncao.toUpperCase()}`;
                    const cacheExistente = window.orcamentoPorFuncao[chave];
                    const cacheValido = !!(cacheExistente && 
                                        (cacheExistente.quantidade_orcada || cacheExistente.quantidadeOrcada) && 
                                        (cacheExistente.datas_totais_orcadas || cacheExistente.datasOrcadas));

                    if (!cacheValido) {
                        console.log("🔍 Cache incompleto. Forçando busca do orçamento para:", chave);
                        await buscarEPopularOrcamento(
                            criteriosDeVerificacao.idEvento,
                            criteriosDeVerificacao.idCliente,
                            criteriosDeVerificacao.idLocalMontagem,
                            criteriosDeVerificacao.idFuncao,
                            criteriosDeVerificacao.datasEvento,
                            false,
                            true
                        );
                    } else {
                        console.log("📦 Usando cache válido para:", chave);
                    }

                    const resultadoLimite = await verificarLimiteDeFuncao(criteriosDeVerificacao);

                    if (resultadoLimite && resultadoLimite.allowed === false) {
                        if (resultadoLimite.solicitouAutorizacao) {
                            // Tem justificativa — salva como inativo, NÃO dá return
                            window.bSalvarComoInativo = true;
                            justificativaParaSalvar = resultadoLimite.justificativa;
                            window.tipoExcecaoAtual = resultadoLimite.tipoSolicitacao;
                            window.prefixoSolicitacao = window.tipoExcecaoAtual?.includes("Vaga Excedida")
                                ? "[SOLICITAÇÃO - VAGA EXCEDIDA]"
                                : "[SOLICITAÇÃO - DATAS FORA ORÇAMENTO]";
                            console.log(`📋 Exceção detectada. Salvando como Inativo. Tipo: ${window.tipoExcecaoAtual}`);
                        } else {
                            // Usuário cancelou — para aqui
                            console.log("⚠️ Salvamento cancelado pelo usuário.");
                            return;
                        }
                    } else {
                        if (window.tipoExcecaoAtual === null) {
                            window.bSalvarComoInativo = false;
                            window.prefixoSolicitacao = "";
                            justificativaParaSalvar = "";
                        }
                    }
                } // ← fecha if(alterouDadosOrcamento) — único e correto                

                // let arrayDiariaDobradaFinal = [];

                // if (diariaDobradaAtual && (datasDobradas && datasDobradas.length > 0)) {
                    
                //     // 1. Recupera o histórico real limpo do banco
                //     let datasDobradasOriginais = [];
                //     if (typeof dataDiariaDobradaOriginalLimpa !== 'undefined' && dataDiariaDobradaOriginalLimpa) {
                //         datasDobradasOriginais = dataDiariaDobradaOriginalLimpa;
                //     } else if (currentEditingStaffEvent?.datadiariadobrada) {
                //         datasDobradasOriginais = typeof currentEditingStaffEvent.datadiariadobrada === 'string' 
                //             ? JSON.parse(currentEditingStaffEvent.datadiariadobrada) 
                //             : currentEditingStaffEvent.datadiariadobrada;
                //     }

                //     // Mapeia apenas as strings puras das datas originais para o "includes" funcionamento redondo
                //     const stringOriginais = datasDobradasOriginais.map(d => {
                //         if (!d) return '';
                //         return typeof d === 'object' ? (d.data || d.datadiariadobrada || '') : String(d);
                //     }).filter(p => p);

                //     console.log(`[COMPARAÇÃO REAL DOBRAS] Originais Limpas:`, stringOriginais, `| Atuais na Tela:`, datasDobradas);

                //     const chaveOrcamentoPUT = `${criteriosDeVerificacao.nmEvento.toUpperCase()}-${criteriosDeVerificacao.nmFuncao.toUpperCase()}`;
                //     const dadosOrcamentoPUT = window.orcamentoPorFuncao ? window.orcamentoPorFuncao[chaveOrcamentoPUT] : {};
                    

                //     let novasStringsParaDescFuncao = []; // Vai guardar o texto COM DATA para o campo geral da tela
                //     let justificativasParaSolicitacoes = []; // Vai guardar o texto SEM DATA para as solicitações

                //     // 1. CAPTURA O TEXTO COMPLETO DO CAMPO DA TELA
                //     const campoDescDobra = document.getElementById('descDiariaDobrada');
                //     let textoGeralDoCampo = campoDescDobra ? campoDescDobra.value.trim() : '';
                //     let textoPreDigitado = '';
                //     if (campoDescDobra) {
                //         let valorCampo = campoDescDobra.value.trim();
                //         if (valorCampo.includes('Justificativa:')) {
                //             textoPreDigitado = valorCampo.split('Justificativa:').pop().trim();
                //         } else {
                //             textoPreDigitado = valorCampo;
                //         }
                //     }

                //     // 2. Loop pelas datas da tela
                //     for (const dataDobra of datasDobradas) {
                //         const dataFormatadaBR = dataDobra.split('-').reverse().join('/');                       
                        
                        

                //         // ====================================================================
                //         // 🎯 SE A DATA JÁ EXISTIA: Proteção total contra sumiço de dados e valores
                //         // ====================================================================
                //         if (stringOriginais && stringOriginais.includes(dataDobra)) {

                //             console.log("🔍 ORIGINAL DO BANCO para", dataDobra, ":", 
                //                 JSON.stringify(
                //                     (datasDobradasOriginais || []).find(d => {
                //                         const s = typeof d === 'object' ? (d.data || d.datadiariadobrada) : d;
                //                         return s === dataDobra;
                //                     })
                //                 , null, 2));

                //             console.log("🔍 window.dadosDiariaDobradaInjetar para", dataDobra, ":",
                //                 JSON.stringify(
                //                     (window.dadosDiariaDobradaInjetar || []).find(
                //                         d => (d.data || d.datadiariadobrada) === dataDobra
                //                     )
                //                 , null, 2));

                //             let originalObj = (datasDobradasOriginais || []).find(d => {
                //                 const currentDataStr = typeof d === 'object' ? (d.data || d.datadiariadobrada) : d;
                //                 return currentDataStr === dataDobra;
                //             });

                //             // Busca nas fontes disponíveis + Fonte mestre do evento ativo na tela
                //             const dadosAoVivoDoEvento = (currentEditingStaffEvent?.dtdiariadobrada || []).find(
                //                 d => (d.data || d.datadiariadobrada) === dataDobra
                //             );
                //             const dadosDaWindow = (window.dadosDiariaDobradaInjetar || []).find(
                //                 d => (d.data || d.datadiariadobrada) === dataDobra
                //             );
                //             const dadosDoArray = arrayDiariaDobradaFinal.find(
                //                 d => (d.data || d.datadiariadobrada) === dataDobra
                //             );

                //             // 🎯 RESOLVER BLINDADO: Prioriza dados REAIS preenchidos (maiores que zero/not null)
                //             // Evita que um null gerado temporariamente mate o valor antigo real
                //             const resolver = (campo) => {
                //                 if (dadosAoVivoDoEvento?.[campo] != null) return dadosAoVivoDoEvento[campo];
                //                 if (dadosDoArray?.[campo] != null) return dadosDoArray[campo];
                //                 if (dadosDaWindow?.[campo] != null) return dadosDaWindow[campo];
                //                 if (originalObj?.[campo] != null) return originalObj[campo];
                //                 return null;
                //             };

                //             const idfuncaodobra   = resolver('idfuncaodobra');
                //             const vlr_cache       = resolver('vlr_cache') != null ? Number(resolver('vlr_cache')) : null;
                //             const vlr_alimentacao = resolver('vlr_alimentacao') != null ? Number(resolver('vlr_alimentacao')) : null;
                //             const setordobra      = resolver('setordobra') ?? "";
                            
                //             // Segura o orçamento específico (ex: 331). Se falhar tudo, mantém o do evento.
                //             const idorcamento     = resolver('idorcamento') 
                //                 ?? currentEditingStaffEvent?.idorcamento 
                //                 ?? dadosOrcamentoPUT?.idorcamento 
                //                 ?? null;

                //             let justificativaRecuperada = resolver('justificativa') || "";

                //             if (!justificativaRecuperada && textoGeralDoCampo.includes(dataFormatadaBR)) {
                //                 try {
                //                     const blocos = textoGeralDoCampo.split('|');
                //                     const blocoDaData = blocos.find(b => b.includes(dataFormatadaBR));
                //                     if (blocoDaData) {
                //                         justificativaRecuperada = blocoDaData.replace(/\[Diária Dobrada.*?\]/g, '').trim();
                //                     }
                //                 } catch (e) {
                //                     console.error("Erro ao recuperar justificativa antiga:", e);
                //                 }
                //             }

                //             if (!justificativaRecuperada) {
                //                 justificativaRecuperada = `Diária dobrada mantida para o dia ${dataFormatadaBR}`;
                //             }

                //             arrayDiariaDobradaFinal.push({
                //                 data: dataDobra,
                //                 status: resolver('status') || "Pendente",
                //                 idfuncaodobra,
                //                 setordobra,
                //                 justificativa: justificativaRecuperada,
                //                 idorcamento,
                //                 vlr_cache,
                //                 vlr_alimentacao
                //             });

                //             justificativasParaSolicitacoes.push({ data: dataDobra, justificativa: justificativaRecuperada });
                //             continue;
                //         } 
                //         // ====================================================================
                //         // 🔥 SE FOR UMA DATA NOVA: Captura nome da função de forma segura
                //         // ====================================================================

                //         const criteriosExclusivosDaData = {
                //             ...criteriosDeVerificacao,
                //             data: dataDobra, // Injeta a data correta da iteração (ex: "2026-05-17")
                //             dataDobra: dataDobra
                //         };

                //         const resultadoDobra = await perguntarFuncaoDiariaDobrada(
                //             window.vagasDisponiveisDobra || [],
                //             dadosOrcamentoPUT,
                //             criteriosExclusivosDaData, // 👈 Enviamos o objeto corrigido aqui
                //             criteriosDeVerificacao.nmFuncao,
                //             idFuncionario,
                //             dataDobra // 👈 Passamos a data corrente de forma isolada
                //         );

                //         if (!resultadoDobra) return;

                //         // Tudo vem resolvido e correto da função — sem reconstrução, sem globals
                //         const {
                //             tipo,
                //             idFuncaoFinal,
                //             idOrcamentoFinal,
                //             nomeFuncaoAlocada: nomeFuncaoAlocada,
                //             setorAlvoDobra,
                //             vlrCache,
                //             vlrAlimentacao,
                //             justificativa: textoDigitadoNoSwal
                //         } = {
                //             nomeFuncaoAlocada: resultadoDobra.nomeFuncao,
                //             setorAlvoDobra:    resultadoDobra.setorVaga,
                //             vlrCache:          resultadoDobra.vlrCache,
                //             vlrAlimentacao:    resultadoDobra.vlrAlimentacao,
                //             ...resultadoDobra
                //         };

                //         // Se for aditivo/extra, o idfuncaodobra fica null — comportamento correto
                //         const justificativaSemData = `Consumiu vaga da função "${nomeFuncaoAlocada}"${setorAlvoDobra ? ` do setor "${setorAlvoDobra}"` : ''} para cobrir virada. Justificativa: ${textoDigitadoNoSwal}`;
                //         const justificativaComData = `[Diária Dobrada ${dataFormatadaBR}] ${justificativaSemData}`;

                //         novasStringsParaDescFuncao.push(justificativaComData);
                //         justificativasParaSolicitacoes.push({ data: dataDobra, justificativa: justificativaSemData });

                //         await Swal.fire({
                //             icon: 'success',
                //             title: 'Função Atribuída!',
                //             html: `A diária dobrada do dia <b>${dataFormatadaBR}</b> foi vinculada à função <b>${nomeFuncaoAlocada}</b> com sucesso.`,
                //             timer: 1500,
                //             showConfirmButton: false
                //         });

                //         arrayDiariaDobradaFinal.push({
                //             data: dataDobra,
                //             status: "Pendente",
                //             idfuncaodobra: idFuncaoFinal,       // null só para aditivo/extra — correto
                //             setordobra: setorAlvoDobra,
                //             justificativa: justificativaSemData,
                //             idorcamento: idOrcamentoFinal,
                //             vlr_cache: vlrCache,                // vem certo da função, nunca null
                //             vlr_alimentacao: vlrAlimentacao     // idem
                //         });
                //     }

                //     // CONCATENAÇÃO INTELIGENTE COM DATA NO CAMPO GERAL DA TELA
                //     if (novasStringsParaDescFuncao.length > 0 && campoDescDobra) {
                //         let valorExistenteNoCampo = campoDescDobra.value.trim();
                //         const novasFiltradasCampo = novasStringsParaDescFuncao.filter(novaTag => !valorExistenteNoCampo.includes(novaTag));

                //         if (novasFiltradasCampo.length > 0) {
                //             campoDescDobra.value = valorExistenteNoCampo 
                //                 ? `${valorExistenteNoCampo} | ${novasFiltradasCampo.join(' | ')}`
                //                 : novasFiltradasCampo.join(' | ');
                //             campoDescDobra.dispatchEvent(new Event('input'));
                //         }
                //     }

                //     window.dadosDiariaDobradaInjetar = arrayDiariaDobradaFinal;
                //     console.log("💾 arrayDiariaDobradaFinal salvo na window:", JSON.stringify(arrayDiariaDobradaFinal, null, 2));
                //     window.justificativasSolicitacoesInjetar = justificativasParaSolicitacoes;

                // } else if (diariaDobradaAtual) {
                //     window.dadosDiariaDobradaInjetar = typeof dtdiariadobrada === 'string' ? JSON.parse(dtdiariadobrada) : dtdiariadobrada; 
                // }

                let arrayDiariaDobradaFinal = [];

                // ====================================================================
                // 🔄 INTERCEPTANDO SALVAMENTO: CONSOLIDAÇÃO FIEL DE HISTÓRICO (PUT)
                // ====================================================================
                if (diariaDobrada && periodoDobrado.length > 0) {
                    
                    // 1. Recupera fielmente o histórico completo gravado no banco de dados
                    let datasOriginaisNoBanco = [];
                    if (typeof dataDiariaDobradaOriginalLimpa !== 'undefined' && dataDiariaDobradaOriginalLimpa) {
                        datasOriginaisNoBanco = dataDiariaDobradaOriginalLimpa;
                    } else if (currentEditingStaffEvent?.dtdiariadobrada) {
                        datasOriginaisNoBanco = typeof currentEditingStaffEvent.dtdiariadobrada === 'string' 
                            ? JSON.parse(currentEditingStaffEvent.dtdiariadobrada) 
                            : currentEditingStaffEvent.dtdiariadobrada;
                    }

                    const listaObjetosOriginais = Array.isArray(datasOriginaisNoBanco) ? datasOriginaisNoBanco : [];
                   

                    // 2. Preserva INTEGRALMENTE tudo o que já existia originalmente no banco
                    // Substitui o forEach simples por este com resolver:
                    listaObjetosOriginais.forEach(itemOrig => {
                        if (!itemOrig) return;

                        const dataStr = typeof itemOrig === 'object' 
                            ? (itemOrig.data || itemOrig.datadiariadobrada || '') 
                            : String(itemOrig).trim();

                        if (!dataStr) return;

                        // Busca nas fontes disponíveis, igual ao código comentado
                        const dadosAoVivo = (currentEditingStaffEvent?.dtdiariadobrada || []).find(
                            d => (d.data || d.datadiariadobrada) === dataStr
                        );
                        const dadosDaWindow = (window.dadosDiariaDobradaInjetar || []).find(
                            d => String(d.data).trim() === dataStr
                        );
                        const originalObj = typeof itemOrig === 'object' ? itemOrig : null;

                        const resolver = (campo) => {
                            if (dadosAoVivo?.[campo] != null) return dadosAoVivo[campo];
                            if (dadosDaWindow?.[campo] != null) return dadosDaWindow[campo];
                            if (originalObj?.[campo] != null) return originalObj[campo];
                            return null;
                        };

                        arrayDiariaDobradaFinal.push({
                            data: dataStr,
                            status: resolver('status') || 'Pendente',
                            idfuncaodobra: resolver('idfuncaodobra'),
                            setordobra: resolver('setordobra') ?? '',
                            justificativa: resolver('justificativa') || `Diária dobrada mantida para o dia ${dataStr.split('-').reverse().join('/')}`,
                            idorcamento: resolver('idorcamento') ?? currentEditingStaffEvent?.idorcamento ?? null,
                            vlr_cache: resolver('vlr_cache') != null ? Number(resolver('vlr_cache')) : null,
                            vlr_alimentacao: resolver('vlr_alimentacao') != null ? Number(resolver('vlr_alimentacao')) : null
                        });
                    });

                    // 3. Adiciona as novas dobras configuradas nesta sessão através do modal (Momento 1)
                    if (window.dadosDiariaDobradaInjetar && window.dadosDiariaDobradaInjetar.length > 0) {
                        window.dadosDiariaDobradaInjetar.forEach(novoItem => {
                            const dataNovoLimpa = String(novoItem.data).trim();
                            // Verifica se a data realmente não constava no banco original
                            const jaExisteNoBanco = arrayDiariaDobradaFinal.some(banco => String(banco.data).trim() === dataNovoLimpa);
                            if (!jaExisteNoBanco) {
                                arrayDiariaDobradaFinal.push(novoItem);
                            }
                        });
                    }

                    // 4. Salva o compilado final perfeito de volta na memória global do formulário
                    window.dadosDiariaDobradaInjetar = arrayDiariaDobradaFinal;

                    // 5. Atualiza o input descDiariaDobrada aproveitando a justificativa já existente
                    const campoDescDobra = document.getElementById('descDiariaDobrada');
                    if (window.dadosDiariaDobradaInjetar.length > 0 && campoDescDobra) {
                        const tagsParaCampo = window.dadosDiariaDobradaInjetar.map(item => {
                            // Garante que a data está no formato correto independente de como veio
                            const dataLimpa = String(item.data || item.datadiariadobrada || '').trim().split('T')[0];
                            const dataFormatadaBR = dataLimpa.split('-').reverse().join('/');
                            
                            // Remove qualquer tag [Diária Dobrada ...] que já exista na justificativa
                            // evitando a duplicação do prefixo
                            const txtJustificativa = (item.justificativa || '')
                                .replace(/\[Diária Dobrada\s+[\d\/]+\]\s*/g, '')
                                .trim();

                            return `[Diária Dobrada ${dataFormatadaBR}] ${txtJustificativa}`;
                        });
                        
                        // Junta usando o pipe padronizado do Juarez
                        const textoFinalString = tagsParaCampo.join(' | ');
                        
                        campoDescDobra.value = textoFinalString;
                        campoDescDobra.dispatchEvent(new Event('input'));
                        
                        if (typeof descDiariaDobradaTextarea !== 'undefined' && descDiariaDobradaTextarea) {
                            descDiariaDobradaTextarea.value = textoFinalString;
                        }
                    }

                    console.log("✅ [PUT] Histórico protegido e dados consolidados com total fidelidade:", window.dadosDiariaDobradaInjetar);
                }
                // 👆 FIM DA INTEGRAÇÃO DO MOMENTO 2 REESTRUTURADO
                 // 👆 FIM DA INTEGRAÇÃO

                const { isConfirmed } = await Swal.fire({
                    title: window.bSalvarComoInativo ? "Enviar como Solicitação?" : "Deseja salvar as alterações?",
                    text: window.bSalvarComoInativo 
                        ? "O limite foi excedido. O registro será atualizado como INATIVO aguardando aprovação." 
                        : "Você está prestes a atualizar os dados do staff.",
                    icon: "question", 
                    showCancelButton: true,
                    confirmButtonText: "Sim, salvar", 
                    cancelButtonText: "Cancelar",
                    reverseButtons: true, 
                    focusCancel: true
                });

                if (!isConfirmed) return;
            }          
           
            const obsPosPgtoElement = document.getElementById('obsPosPgto'); 

            // // =========================================================
            // // 14. DIÁRIA DOBRADA E MEIA DIÁRIA
            // // =========================================================
            // if (diariaDobrada && (statusDiariaDobrada === "Autorização de Diária Dobrada" || statusDiariaDobrada === '')) statusDiariaDobrada = "Pendente";
            // else if (!diariaDobrada) statusDiariaDobrada = '';

            // if (meiaDiaria && (statusMeiaDiaria === "Autorização de Meia Diária" || statusMeiaDiaria === '')) statusMeiaDiaria = "Pendente";
            // else if (!meiaDiaria) statusMeiaDiaria = '';

            // let dadosDiariaDobrada = [];
            // if (periodoDobrado?.length > 0) {
            //     dadosDiariaDobrada = periodoDobrado.map(data => {
            //         const statusData = datasDobrada.find(item => item.data === data);
            //         return { data, status: statusData ? statusData.status : statusDiariaDobrada };
            //     });
            // }

            // let dadosMeiaDiaria = [];
            // if (periodoMeiaDiaria?.length > 0) {
            //     dadosMeiaDiaria = periodoMeiaDiaria.map(data => {
            //         const statusData = datasMeiaDiaria.find(item => item.data === data);
            //         return { data, status: statusData ? statusData.status : statusMeiaDiaria };
            //     });
            // }


            // =========================================================
            // 14. DIÁRIA DOBRADA E MEIA DIÁRIA
            // =========================================================
            if (diariaDobrada && (statusDiariaDobrada === "Autorização de Diária Dobrada" || statusDiariaDobrada === '')) {
                statusDiariaDobrada = "Pendente";
            } else if (!diariaDobrada) {
                statusDiariaDobrada = '';
            }

            if (meiaDiaria && (statusMeiaDiaria === "Autorização de Meia Diária" || statusMeiaDiaria === '')) {
                statusMeiaDiaria = "Pendente";
            } else if (!meiaDiaria) {
                statusMeiaDiaria = '';
            }

            let dadosDiariaDobrada = [];
            // if (periodoDobrado?.length > 0) {
            //     dadosDiariaDobrada = periodoDobrado.map(data => {
            //         const statusData = datasDobrada.find(item => item.data === data);
            //         // ✅ CORREÇÃO: Se a data for nova (não encontrada em statusData), forçar 'Pendente'
            //         return { data, status: statusData ? statusData.status : "Pendente" };
            //     });
            // }

            if (window.dadosDiariaDobradaInjetar && window.dadosDiariaDobradaInjetar.length > 0) {
                // Se o nosso loop inteligente rodou e guardou os dados na window, usamos ele com prioridade absoluta!
                dadosDiariaDobrada = window.dadosDiariaDobradaInjetar;
                console.log("💎 Usando dados de dobra processados da window (Com valores e IDs):", dadosDiariaDobrada);
            } else if (periodoDobrado?.length > 0) {
                // Fallback apenas para quando não houve alteração/abertura de modal de novas funções
                dadosDiariaDobrada = periodoDobrado.map(data => {
                    const statusData = datasDobrada.find(item => item.data === data);
                    return { 
                        data, 
                        status: statusData ? statusData.status : "Pendente",
                        idfuncaodobra: statusData?.idfuncaodobra || null,
                        setordobra: statusData?.setordobra || "",
                        justificativa: statusData?.justificativa || "",
                        idorcamento: statusData?.idorcamento || null,
                        vlr_cache: statusData?.vlr_cache !== undefined ? Number(statusData.vlr_cache) : null,
                        vlr_alimentacao: statusData?.vlr_alimentacao !== undefined ? Number(statusData.vlr_alimentacao) : null
                    };
                });
                console.log("ℹ️ Usando dados de dobra históricos do fallback:", dadosDiariaDobrada);
            }

          
    
            let dadosMeiaDiaria = [];
            if (periodoMeiaDiaria?.length > 0) {
                dadosMeiaDiaria = periodoMeiaDiaria.map(data => {
                    const statusData = datasMeiaDiaria.find(item => item.data === data);
                    // ✅ CORREÇÃO: Se a data for nova, forçar 'Pendente'
                    return { data, status: statusData ? statusData.status : "Pendente" };
                });
            }

            const vlrAjusteEnvio = parseFloat(ajusteCustoInput?.value?.replace(',', '.') || 0);
            const statusAjusteEnvio = vlrAjusteEnvio !== 0
                ? (document.getElementById('selectStatusAjusteCusto')?.value || statusAjusteCustoInput?.value || 'Pendente')
                : '';
            

            // statuspgtoajdcto = pagamento da AJUDA DE CUSTO (transporte/alimentação), não do ajuste
            const vlrAjdCustoEnvio = parseFloat(transporteInput?.value?.replace(',', '.') || 0) 
                + parseFloat(alimentacaoInput?.value?.replace(',', '.') || 0);
            const statusPgtoAjdEnvio = vlrAjdCustoEnvio !== 0 
                ? (statusPgtoAjudaCustoInput?.value || 'Pendente') 
                : '';
            

            const vlrCaixaEnvio = parseFloat(caixinhaInput?.value?.replace(',', '.') || 0);
            const statusCaixaEnvio = vlrCaixaEnvio !== 0
                ? (document.getElementById('selectStatusCaixinha')?.value || statusCaixinhaInput?.value || 'Pendente')
                : '';


            const statusPgtoCxEnvio = vlrCaixaEnvio !== 0
                ? (statusPgtoCaixinhaInput?.value || 'Pendente')
                : '';

            

            let tipoAjudaCustoViagem = 0;
            if (document.getElementById('viagem1Check').checked) tipoAjudaCustoViagem = 1;
            else if (document.getElementById('viagem2Check').checked) tipoAjudaCustoViagem = 2;
            else if (document.getElementById('viagem3Check').checked) tipoAjudaCustoViagem = 3;
            

            // =========================================================
            // 15. MONTAGEM DO FORMDATA
            // =========================================================
            const formData = new FormData();
            const capitalize = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : '';

            if (metodo === "PUT") {
                formData.append('idstaff', currentEditingStaffEvent.idstaff || '');
                formData.append('idstaffevento', currentEditingStaffEvent.idstaffevento || '');
            }

            formData.append('avaliacao', avaliacao);
            formData.append('idfuncionario', idFuncionario);
            formData.append('nmfuncionario', nmFuncionario);

            formData.append('qtdpessoas', qtdPessoas.toString());
            formData.append('idorcamento', idOrcamentoAtual);

            formData.append('idfuncao', idFuncao);
            formData.append('nmfuncao', descFuncao);
            formData.append('idequipe', idEquipe);
            formData.append('nmequipe', nmEquipe);
            formData.append('nivelexperiencia', nivelExperienciaSelecionado);

            formData.append('setor', setor);
            formData.append('idmontagem', idMontagem);
            formData.append('nmlocalmontagem', nmLocalMontagem);

            formData.append('pavilhao', pavilhao);

            formData.append('idcliente', idCliente);
            formData.append('nmcliente', nmCliente);
            formData.append('idevento', idEvento);
            formData.append('nmevento', nmEvento);

            formData.append('vlrcache', vlrCusto);
            formData.append('desccustofechado', descCustoFechadoParaEnvio || '');
            formData.append('statuscustofechado', statusFechadoParaEnvio || '');
            formData.append('vlrtransporte', transporte);
            formData.append('vlralimentacao', alimentacao);
            
            formData.append('descbeneficios', descBeneficioTextarea.value.trim());
            
            formData.append('datasevento', JSON.stringify(periodoDoEvento));
            
            formData.append('tipoajudacustoviagem', tipoAjudaCustoViagem.toString());

            formData.append('vlrtotajdcusto', vlrtotajdcusto.toString());
            formData.append('statuspgtoajdcto', capitalize(statusPgtoAjdEnvio));
            formData.append('vlrtotcache', vlrtotcache.toString());
            formData.append('statuspgto', capitalize(statusPgto));
            formData.append('vlrtotal', total.toString());
            
            formData.append('vlrajustecusto', ajusteCusto);
            formData.append('descajustecusto', ajusteCustoTextarea.value.trim());
            formData.append('statusajustecusto', capitalize(statusAjusteEnvio));

            formData.append('vlrcaixinha', caixinha);
            formData.append('desccaixinha', descCaixinhaTextarea.value.trim());
            formData.append('statuscaixinha', capitalize(statusCaixaEnvio));
            formData.append('statuspgtocaixinha', capitalize(statusPgtoCxEnvio));
            
            // //formData.append('datadiariadobrada', JSON.stringify(dadosDiariaDobrada));
            // if (window.dadosDiariaDobradaInjetar && window.dadosDiariaDobradaInjetar.length > 0) {
            //     formData.append('datadiariadobrada', JSON.stringify(window.dadosDiariaDobradaInjetar));
            // } else {
            //     formData.append('datadiariadobrada', JSON.stringify(dadosDiariaDobrada));
            // }

            if (window.dadosDiariaDobradaInjetar && window.dadosDiariaDobradaInjetar.length > 0) {
                // Se o usuário configurou novas dobras nos modais, enviamos o array injetado
                formData.append('datadiariadobrada', JSON.stringify(window.dadosDiariaDobradaInjetar));
                
                // 2. AGORA A MÁGICA: Criamos o texto explicativo automaticamente baseado no array injetado
                // const textoGeradoAutomatico = window.dadosDiariaDobradaInjetar.map(dobra => {
                //     return `[Diária Dobrada ${dobra.data}] 2 Consumiu vaga da função "${dobra.nmFuncao}" para cobrir virada. Justificativa: ${dobra.justificativa}`;
                // }).join("\n");

                // Atualizamos o valor do elemento visual na tela (textarea) com o novo texto estruturado
                // const campoDescElement = document.getElementById('descDiariaDobrada') || (typeof descDiariaDobradaTextarea !== 'undefined' ? descDiariaDobradaTextarea : null);
                // if (campoDescElement) {
                //     campoDescElement.value = textoGeradoAutomatico;
                // }
            } else {
                // Se não há novas inserções da sessão atual, mantém o array que já veio carregado do banco
                formData.append('datadiariadobrada', JSON.stringify(dadosDiariaDobrada));
            }

            console.log("📤 dadosDiariaDobrada que vai no formData:", JSON.stringify(dadosDiariaDobrada, null, 2));


            //formData.append('datadiariadobrada', JSON.stringify(dadosDiariaDobrada));

            const textoDobraParaEnviar = document.getElementById('descDiariaDobrada') 
                ? document.getElementById('descDiariaDobrada').value.trim() 
                : (typeof descDiariaDobradaTextarea !== 'undefined' ? descDiariaDobradaTextarea.value.trim() : '');

            formData.append('descdiariadobrada', textoDobraParaEnviar);
           // formData.append('descdiariadobrada', descDiariaDobradaTextarea.value.trim());
 
            formData.append('statusdiariadobrada', statusDiariaDobrada);

            formData.append('descmeiadiaria', descMeiaDiariaTextarea.value.trim());
            formData.append('datameiadiaria', JSON.stringify(dadosMeiaDiaria));
            formData.append('statusmeiadiaria', statusMeiaDiaria);            

            //formData.append('obspospgto', obsPosPgtoElement ? obsPosPgtoElement.value.trim() : '');

            let obsFinal = obsPosPgtoElement ? obsPosPgtoElement.value.trim() : '';

            // Se geramos um log de datas e ele passou pelas travas, junta com a observação
            if (textoLogDatas) {
                // Se já tiver texto digitado antes, pula uma linha para organizar
                obsFinal = obsFinal ? `${obsFinal}\n${textoLogDatas}` : textoLogDatas;
            }

            // Grava no FormData para enviar ao banco de dados
            formData.append('obspospgto', obsFinal);

            // if (bSalvarComoInativo) {
            //     const agora = new Date().toLocaleString('pt-BR');
            //     const usuarioLogado = window.usuarioNome || "Usuário";
            //     const logSolicitacao = `${prefixoSolicitacao} - Solicitado em ${agora} por ${usuarioLogado}. Justificativa: ${justificativaParaSalvar}`;
                
            //     formData.append('obsgeral', logSolicitacao);
            //     formData.append('ativo', 'false');
            // } else {
            //     formData.append('ativo', 'true');
            // }

            // 🚩 ADICIONA O NOVO CAMPO ATIVO
           // formData.append('ativo', bSalvarComoInativo ? 'false' : 'true');

            //Comprovantes
            if (fileCacheInput.files?.[0]) formData.append('comppgtocache', fileCacheInput.files[0]);
            else if (hiddenRemoverCacheInput.value === 'true') formData.append('limparComprovanteCache', 'true');

            // if (fileAjdCustoInput.files?.[0]) formData.append('comppgtoajdcusto', fileAjdCustoInput.files[0]);
            // else if (hiddenRemoverAjdCustoInput.value === 'true') formData.append('limparComprovanteAjdCusto', 'true');

            if (fileAjdCusto2Input.files?.[0]) formData.append('comppgtoajdcusto50', fileAjdCusto2Input.files[0]);
            else if (hiddenRemoverAjdCusto2Input.value === 'true') formData.append('limparComprovanteAjdCusto2', 'true');

            if (fileCaixinhaInput.files?.[0]) formData.append('comppgtocaixinha', fileCaixinhaInput.files[0]);
            else if (hiddenRemoverCaixinhaInput.value === 'true') formData.append('limparComprovanteCaixinha', 'true');

            if (fileAjdCustoInput.files?.[0]) {
                console.log("📎 Anexando NOVO comprovante de Ajuda de Custo");
                formData.append('comppgtoajdcusto', fileAjdCustoInput.files[0]);
            } else if (hiddenRemoverAjdCustoInput.value === 'true') {
                console.log("🗑️ Marcando comprovante de Ajuda de Custo para REMOÇÃO");
                formData.append('limparComprovanteAjdCusto', 'true');
            }

            if (fileControleGastosInput.files?.[0]) formData.append('compcontrolegastos', fileControleGastosInput.files[0]);
            else if (hiddenRemoverControleGastosInput.value === 'true') formData.append('limparComprovanteControleGastos', 'true');

            console.log("Chega aqui antes do try do envio...");

            
            try {
                estaSalvando = true;

                console.log("Entrou no try. Método:", metodo, "URL:", url, window.tipoExcecaoAtual ? "Tipo de Exceção: " + window.tipoExcecaoAtual : "Sem tipo de exceção");

                const deveSerInativo = window.bSalvarComoInativo === true || 
                       (window.tipoExcecaoAtual !== null && window.tipoExcecaoAtual !== undefined && window.tipoExcecaoAtual !== '');

                if (deveSerInativo) {
                    console.log("⚠️ Bloqueando registro: Enviando como INATIVO para aprovação.");
                    formData.set('ativo', 'false');
                    formData.set('tipoSolicitacaoAditivo', window.tipoExcecaoAtual);
                    formData.set('justificativaAditivo', window.justificativaParaSalvar);
                    
                    const datasConflito = Array.isArray(window.datasParaSalvarNoBanco) 
                        ? window.datasParaSalvarNoBanco 
                        : [window.datasParaSalvarNoBanco];
                    
                    formData.set('datasExcecao', JSON.stringify(datasConflito));
                    // Atualiza o log obsgeral
                    // const agora = new Date().toLocaleString('pt-BR');
                    // const prefixo = `[SOLICITAÇÃO - ${window.tipoExcecaoAtual?.toUpperCase() || 'ADITIVO'}]`;
                    // formData.set('obsgeral', `${prefixo} - ${agora}. Justificativa: ${window.justificativaParaSalvar}`);

                    // 🚀 FORMATAÇÃO DAS DATAS DO ADITIVO PARA PT-BR (DD/MM/AAAA)
                    const datasFormatadasBR = datasConflito.map(dStr => {
                        if (!dStr) return '';
                        const partes = String(dStr).trim().split('-');
                        if (partes.length === 3) {
                            return `${partes[2]}/${partes[1]}/${partes[0]}`; // Inverte AAAA-MM-DD para DD/MM/AAAA
                        }
                        return dStr; // Fallback caso venha em outro formato
                    }).filter(Boolean).join(', ');

                    // Atualiza o log obsgeral com a marcação das datas solicitadas
                    const agora = new Date().toLocaleString('pt-BR');
                    const prefixo = `[SOLICITAÇÃO - ${window.tipoExcecaoAtual?.toUpperCase() || 'ADITIVO'}]`;
                    const tagDatas = datasFormatadasBR ? ` [EXCEDIDO EM ${datasFormatadasBR}]` : '';
                    
                    formData.set('obsgeral', `${prefixo} - ${agora}.${tagDatas} Justificativa: ${window.justificativaParaSalvar}`);
                } else {
                    formData.set('ativo', 'true');
                }               

                nivelFoiTrocado = false; 
                nivelOriginalCarregado = null; 

                console.log("Preparando envio. Método:", metodo, "URL:", url);

                // Ajuda de Custo

                
                // 1. SALVA O STAFF
                const respostaApi = await fetchComToken(url, { method: metodo, body: formData });
                console.log("Full API Response:", respostaApi);

                if (respostaApi && (respostaApi.sucesso || respostaApi.message === 'Atualizado' || respostaApi.id)) {
                    console.log("✅ Sucesso total:", respostaApi);

                    if (currentEditingStaffEvent && window.dadosDiariaDobradaInjetar) {
                        currentEditingStaffEvent.datadiariadobrada = JSON.parse(
                            JSON.stringify(window.dadosDiariaDobradaInjetar)
                        );
                        console.log("🔄 currentEditingStaffEvent.datadiariadobrada atualizado com dados salvos.");
                    }

                    // 3. FINALIZAÇÃO E RESETS DE FLAGS DE EXCEÇÃO
                    window.bSalvarComoInativo = false; 
                    window.justificativaParaSalvar = "";
                    window.tipoExcecaoAtual = null;
                    window.nivelFoiTrocado = false;

                    const foiSolicitacao = formData.get('statusstaff') === 'Pendente';

                    await Swal.fire({
                        icon: foiSolicitacao ? 'info' : 'success',
                        title: foiSolicitacao ? 'Solicitação Enviada!' : 'Sucesso!',
                        text: foiSolicitacao 
                            ? 'Solicitação enviada com sucesso. Staff cadastrado como inativo, aguardando aprovação.' 
                            : (respostaApi.message || 'Staff salvo com sucesso.'),
                        confirmButtonColor: '#3085d6'
                    });

                    const idFuncionarioParaRecarregar = document.getElementById('idFuncionario')?.value;
                    if (idFuncionarioParaRecarregar) await carregarTabelaStaff(idFuncionarioParaRecarregar);
                    
                    window.StaffOriginal = null;

                //     // --- MODAL DE DECISÃO PÓS-SALVAMENTO ---
                //     const result = await Swal.fire({
                //         title: "Deseja continuar?",
                //         text: "O cadastro foi concluído. Quer cadastrar mais um ou finalizar?",
                //         icon: "question", 
                //         showCancelButton: true, 
                //         showDenyButton: true,
                //         confirmButtonText: "Cadastrar mais um (Manter dados)",
                //         cancelButtonText: "Finalizar e Sair",
                //         denyButtonText: "Cadastrar novo staff (Limpar tudo)",
                //         reverseButtons: true, 
                //         focusCancel: true
                //     });

                //     if (result.isConfirmed) {
                //         // OPÇÃO: CADASTRAR MAIS UM (MANTER DADOS)
                //         console.group("🔍 DEBUG: Revalidação Pós-Cadastro (Manter Dados)");

                //         // 1. CAPTURA DAS IDs (Antes de limpar campos específicos de funcionário)
                //         const idEv   = document.getElementById('nmEvento').value;
                //         const idCli  = document.getElementById('nmCliente').value;
                //         const idLoc  = document.getElementById('nmLocalMontagem').value;
                //         const idFunc = document.getElementById('descFuncao').value;
                //         const setor  = document.getElementById('setor')?.value;

                //         // Captura das datas do Picker
                //         const elDatas = document.getElementById('datasEvento') || document.getElementById('periodoEvento');
                //         const picker = elDatas?._flatpickr || window.flatpickrInstances?.['datasEvento'];
                        
                //         let datasParaValidar = [];
                //         if (picker && picker.selectedDates.length > 0) {
                //             datasParaValidar = picker.selectedDates.map(date => {
                //                 const d = new Date(date);
                //                 d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
                //                 return d.toISOString().split('T')[0];
                //             });
                //         }

                //         // 2. LIMPEZA PARCIAL (Remove o funcionário mas mantém o evento/função/datas)
                //         if (typeof limparCamposStaffParcial === "function") {
                //             limparCamposStaffParcial();
                //         } else {
                //             // Fallback manual se não houver a função parcial
                //             document.getElementById('idFuncionario').value = '';
                //             document.getElementById('nmFuncionario').value = '';
                //             if(document.getElementById('imgFuncionario')) document.getElementById('imgFuncionario').src = 'img/sem-foto.png';
                //         }

                //         // 3. REVALIDAÇÃO AUTOMÁTICA DO ORÇAMENTO E LIMITES
                //         // Aqui chamamos a função que agora possui a regra de 1 mês de margem
                //         if (idEv && idLoc && idFunc && datasParaValidar.length > 0) {
                //             console.log("🛡️ Revalidando orçamento para a próxima inserção...");
                            
                //             // buscarEPopularOrcamento já abrirá o modal de Aditivo/Extra/1 Mês se necessário
                //             await buscarEPopularOrcamento(idEv, idCli, idLoc, idFunc, datasParaValidar);
                            
                //             // Também revalidamos o limite de vagas (se ultrapassou a quantidade orçada)
                //             const criterios = {
                //                 idEvento: idEv,
                //                 idLocalMontagem: idLoc,
                //                 idFuncao: idFunc,
                //                 setor: setor,
                //                 datasEvento: datasParaValidar
                //             };
                            
                //             if (typeof verificarLimiteDeFuncao === "function") {
                //                 await verificarLimiteDeFuncao(criterios);
                //             }
                //         }

                //         console.groupEnd();

                //     } else if (result.isDenied) {
                //         // OPÇÃO: CADASTRAR NOVO (LIMPAR TUDO)
                //         window.currentEditingStaffEvent = null;
                //         window.temOrcamento = false;
                //         window.decisaoUsuarioDataFora = null;
                //         limparCamposStaff(); // Limpa tudo, inclusive evento e datas
                        
                //     } else if (result.dismiss === Swal.DismissReason.cancel) {
                //         // OPÇÃO: FINALIZAR E SAIR
                //         console.log("Usuário escolheu: Finalizar e Sair");
                //         window.currentEditingStaffEvent = null;
                //         currentEditingStaffEvent = null;
                //         window.temOrcamento = false;
                //         window.decisaoUsuarioDataFora = null;
                //         limparCamposStaff(); // Limpeza completa antes de fechar

                //         if (typeof fecharModal === "function") {
                //             fecharModal();
                //         } else {
                //             document.getElementById("modal-container").innerHTML = "";
                //             document.getElementById("modal-overlay").style.display = "none";
                //             document.body.classList.remove("modal-open");
                //             if (typeof window.onStaffModalClosed === 'function') {
                //                 const callback = window.onStaffModalClosed;
                //                 window.onStaffModalClosed = null;
                //                 callback(true); 
                //             }
                //         }
                //     }
                // }
                    // ====================================================================
                    // 🛡️ CONFIGURAÇÃO DINÂMICA DO MODAL DE DECISÃO PÓS-SALVAMENTO
                    // ====================================================================
                    const ehEdicao = (metodo === 'PUT' || metodo === 'put');
                    
                    const swalConfig = {
                        title: "Deseja continuar?",
                        text: ehEdicao 
                            ? "A edição foi concluída. Quer cadastrar um novo ou finalizar?" 
                            : "O cadastro foi concluído. Quer cadastrar mais um ou finalizar?",
                        icon: "question", 
                        showCancelButton: true, 
                        showDenyButton: true,
                        cancelButtonText: "Finalizar e Sair",
                        reverseButtons: true, 
                        focusCancel: true
                    };

                    if (ehEdicao) {
                        // 📝 Se for edição (PUT): Esconde o botão de "Manter Dados" (Confirm) 
                        // e usa o Deny para "Cadastrar Novo"
                        swalConfig.showConfirmButton = false; 
                        swalConfig.denyButtonText = "Cadastrar novo staff (Limpar tudo)";
                    } else {
                        // 🟢 Se for cadastro (POST): Mantém os 3 botões originais ativos
                        swalConfig.showConfirmButton = true;
                        swalConfig.confirmButtonText = "Cadastrar mais um (Manter dados)";
                        swalConfig.denyButtonText = "Cadastrar novo staff (Limpar tudo)";
                    }

                    const result = await Swal.fire(swalConfig);

                    if (result.isConfirmed && !ehEdicao) {
                        // OPÇÃO: CADASTRAR MAIS UM (MANTER DADOS) - Só entra se for POST
                        console.group("🔍 DEBUG: Revalidação Pós-Cadastro (Manter Dados)");

                        const idEv   = document.getElementById('nmEvento').value;
                       // const idCli  = document.getElementById('nmCliente').value;
                        const idCli  = document.getElementById('nmCliente')?.value || window.idClienteAtual || null;
                        const idLoc  = document.getElementById('nmLocalMontagem').value;
                        const idFunc = document.getElementById('descFuncao').value;
                        const setor  = document.getElementById('setor')?.value;

                        const elDatas = document.getElementById('datasEvento') || document.getElementById('periodoEvento');
                        const picker = elDatas?._flatpickr || window.flatpickrInstances?.['datasEvento'];
                        
                        let datasParaValidar = [];
                        if (picker && picker.selectedDates.length > 0) {
                            datasParaValidar = picker.selectedDates.map(date => {
                                const d = new Date(date);
                                d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
                                return d.toISOString().split('T')[0];
                            });
                        }

                        if (typeof limparCamposStaffParcial === "function") {
                            limparCamposStaffParcial();
                        } else {
                            document.getElementById('idFuncionario').value = '';
                            document.getElementById('nmFuncionario').value = '';
                            if(document.getElementById('imgFuncionario')) document.getElementById('imgFuncionario').src = 'img/sem-foto.png';
                        }

                        if (idEv && idCli && idLoc && idFunc && datasParaValidar.length > 0) {
                            console.log("🛡️ Revalidando orçamento para a próxima inserção...");
                            await buscarEPopularOrcamento(idEv, idCli, idLoc, idFunc, datasParaValidar, false, true);
                            
                            const criterios = {
                                idEvento: idEv,
                                idCliente: idCli,
                                idLocalMontagem: idLoc,
                                idFuncao: idFunc,
                                setor: setor,
                                datasEvento: datasParaValidar
                            };
                            
                            if (typeof verificarLimiteDeFuncao === "function") {
                                await verificarLimiteDeFuncao(criterios);
                            }
                        }
                        console.groupEnd();

                    } else if (result.isDenied) {
                        // OPÇÃO: CADASTRAR NOVO (LIMPAR TUDO) - Funciona tanto para PUT quanto POST
                        window.currentEditingStaffEvent = null;
                        if (typeof currentEditingStaffEvent !== 'undefined') currentEditingStaffEvent = null;
                        window.temOrcamento = false;
                        window.decisaoUsuarioDataFora = null;
                        limparCamposStaff(); 
                        
                    } else if (result.dismiss === Swal.DismissReason.cancel) {
                        // OPÇÃO: FINALIZAR E SAIR - Funciona tanto para PUT quanto POST
                        console.log("Usuário escolheu: Finalizar e Sair");
                        window.currentEditingStaffEvent = null;
                        if (typeof currentEditingStaffEvent !== 'undefined') currentEditingStaffEvent = null;
                        window.temOrcamento = false;
                        window.decisaoUsuarioDataFora = null;
                        limparCamposStaff(); 

                        if (typeof fecharModal === "function") {
                            fecharModal();
                        } else {
                            document.getElementById("modal-container").innerHTML = "";
                            document.getElementById("modal-overlay").style.display = "none";
                            document.body.classList.remove("modal-open");
                            if (typeof window.onStaffModalClosed === 'function') {
                                const callback = window.onStaffModalClosed;
                                window.onStaffModalClosed = null;
                                callback(true); 
                            }
                        }
                    }
                }
            } catch (error) {
                console.error("Erro ao salvar:", error);
                const botaoEnviar = document.getElementById("botaoEnviar");
                if (botaoEnviar) {
                    botaoEnviar.disabled = false;
                    botaoEnviar.textContent = 'Salvar'; 
                }

                console.error("Erro ao salvar:", error);

                // 1. Tenta extrair o JSON de erro que o backend enviou dentro da mensagem
                let dadosErroBackend = null;
                try {
                    const jsonMatch = error.message?.match(/\{.*\}/s);
                    if (jsonMatch) {
                        dadosErroBackend = JSON.parse(jsonMatch[0]);
                    }
                } catch (e) {
                    console.warn("Não foi possível parsear o JSON do erro.");
                }
                
                if (dadosErroBackend && dadosErroBackend.tipoErro === "LIMITE_EXCEDIDO") {
                    
                    // 1. Chama a função que abre o modal que você viu no log
                    const resultadoExcecao = await verificarLimiteDeFuncao(criteriosDeVerificacao, dadosErroBackend);

                    // 2. IMPORTANTE: Se o usuário confirmou no modal, reativa o processo
                    if (resultadoExcecao && resultadoExcecao.solicitouAutorizacao) {
                        
                        // Atualizamos as flags globais com o que veio do modal
                        window.bSalvarComoInativo = true;
                        window.justificativaParaSalvar = resultadoExcecao.justificativa;
                        window.tipoExcecaoAtual = resultadoExcecao.tipoSolicitacao; 
                        window.prefixoSolicitacao = `[SOLICITAÇÃO - ${window.tipoExcecaoAtual.toUpperCase()}]`;

                        // Avisamos o usuário que agora ele pode salvar como solicitação
                        const confirmacao = await Swal.fire({
                            icon: 'info',
                            title: 'Justificativa Capturada',
                            text: 'Solicitação: ${tipoExcecaoAtual}. Clique em "Salvar" novamente para enviar como solicitação (o registro ficará inativo até aprovação).',
                            confirmButtonText: 'Entendido'
                        });

                        // Opcional: Disparar o clique automaticamente se quiser poupar o usuário
                        // if (confirmacao.isConfirmed) BotaoEnviar.click();

                    }else {
                        // Erro desconhecido ou erro de rede (mostra o alerta padrão)
                        Swal.fire({
                            title: "Erro no servidor",
                            text: error.message || "Não foi possível processar a requisição.",
                            icon: "error"
                        });
                    }
                }
            } finally {
                setTimeout(() => { estaSalvando = false; }, 1000);
            }
        });
    }
}

// Instale ou importe uma biblioteca como jwt-decode ou use essa função simples:
function obterNomeDoToken() {
    const token = localStorage.getItem('token'); // ou o nome que você usa
    if (!token) return "Usuário";

    console.group("🔍 Debug: Identificação do Usuário");
    console.log("Token bruto encontrado:", token ? "Sim (Iniciado com " + token.substring(0, 10) + "...)" : "Não encontrado");

    if (!token) {
        console.warn("Aviso: Nenhum token encontrado no localStorage/sessionStorage.");
        console.groupEnd();
        return "Usuário";
    }

    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        const payload = JSON.parse(jsonPayload);
        return payload.nomeusuario || "Usuário";
    } catch (e) {
        return "Usuário";
    }
}



function processarMudancaStatus(novoStatus) {
    const hiddenField = document.getElementById("statusCustoFechado");
    const statusAnterior = window.statusAnteriorCustoFechado;
    const statusQueNaoSomam = ["Pendente", "Rejeitado", "none", "", null];

    const eraInativo = statusQueNaoSomam.includes(statusAnterior);
    const vaiSerInativo = statusQueNaoSomam.includes(novoStatus);

    if (eraInativo && vaiSerInativo) {
        if (hiddenField) hiddenField.value = novoStatus;
        window.statusAnteriorCustoFechado = novoStatus;
        return;
    }

    if (hiddenField) hiddenField.value = novoStatus;
    
    // Chama o cálculo passando o override
    calcularValorTotal({ statusFechadoOverride: novoStatus });
    
    window.statusAnteriorCustoFechado = novoStatus;
}

const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

const debouncedOnCriteriosChanged = debounce(() => {
    const idEvento = nmEventoSelect.value;
    const idCliente = nmClienteSelect.value;
    const idLocalMontagem = nmLocalMontagemSelect.value;
    const idFuncao = descFuncaoSelect.value;
    
    const datasEventoRawValue = datasEventoInput ? datasEventoInput.value.trim() : '';
    const periodoDoEvento = getPeriodoDatas(datasEventoRawValue);

    // LOG de depuração para você ver o que falta
    console.log("🔍 Validando critérios para API:", { idEvento, idCliente, idLocalMontagem, idFuncao, totalDatas: periodoDoEvento.length, periodoDoEvento });

    // A API exige os 4 IDs. Se o idCliente estiver vazio, não disparar para evitar Erro 400.
   // No seu Staff.js, dentro do debouncedOnCriteriosChanged:

    if (acao === 'remocao') {
        console.log("🗑️ Ação de remoção detectada. Pulando validação de orçamento.");
        return;
    }

    if (idEvento && idCliente && idFuncao && periodoDoEvento.length > 0) { 
        console.log("🟢 Todos os campos preenchidos. Buscando...");
        buscarEPopularOrcamento(idEvento, idCliente, idLocalMontagem, idFuncao, periodoDoEvento, false, true);
    } else {
        // Se o cliente é o que falta, damos um aviso mais amigável
        if (!idCliente && idEvento && idFuncao) {
            console.warn("⚠️ Aguardando a seleção do Cliente para buscar o orçamento.");
        }
    }
}, 500);



// async function buscarEPopularOrcamento(idEvento, idCliente, idLocalMontagem, idFuncao, datasEvento) {
//     try {
//         console.log("🚀 [INÍCIO] buscarEPopularOrcamento", { idEvento, idCliente, idLocalMontagem, idFuncao, datasEvento });

//         let orcamentoBase = null;
//         const idFuncionario = document.getElementById('idFuncionario')?.value;
//         const selectFunc = document.getElementById('nmFuncionario');
//         const nmFuncionario = selectFunc?.options[selectFunc.selectedIndex]?.text || "Funcionário não identificado";
//         const elInputSetor = document.getElementById('setor');
//         const setorAtual = elInputSetor ? elInputSetor.value.trim() : null;
//         const nomeUsuarioLogado = window.usuarioLogadoNome || "Sistema";

//         // Limpeza de estados
//         if (document.getElementById('tipoSolicitacaoAditivo')) document.getElementById('tipoSolicitacaoAditivo').value = '';
//         if (document.getElementById('justificativaAditivo')) document.getElementById('justificativaAditivo').value = '';
//         window.tipoExcecaoAtual = null;
//         window.justificativaParaSalvar = null;
//         window.bSalvarComoInativo = false;

//         const criteriosDeBusca = { idEvento, idCliente, idLocalMontagem, idFuncao, setor: setorAtual, datasEvento: datasEvento || [] };

//         let dadosDoOrcamento;

        
//         try {
//             dadosDoOrcamento = await fetchComToken('/staff/orcamento/consultar', {
//                 method: 'POST',
//                 headers: { 'Content-Type': 'application/json' },
//                 body: JSON.stringify(criteriosDeBusca)
//             });
//         } catch (e) { dadosDoOrcamento = []; }

//         if (!Array.isArray(dadosDoOrcamento) || dadosDoOrcamento.length === 0) {
//             try {
//                 dadosDoOrcamento = await fetchComToken('/staff/orcamento/consultar', {
//                     method: 'POST',
//                     headers: { 'Content-Type': 'application/json' },
//                     body: JSON.stringify({ ...criteriosDeBusca, ignorarFiltroData: true })
//                 });
//             } catch (err) { console.error("❌ Busca expandida falhou."); }
//         }

//         if (!Array.isArray(dadosDoOrcamento) || dadosDoOrcamento.length === 0) {
//             temOrcamento = false;
//             controlarBotaoSalvarStaff(false); 
//             Swal.fire({ icon: 'warning', title: 'Orçamento não localizado', text: 'Não existe planejamento para esta função nos critérios selecionados.' });
//             return;
//         }

//         orcamentoBase = dadosDoOrcamento.find(item => setorAtual && item.setor?.trim().toUpperCase() === setorAtual.toUpperCase()) 
//                         || dadosDoOrcamento.find(item => !item.setor) 
//                         || dadosDoOrcamento[0];
        
//         console.log("DEBUG ORÇAMENTO:", orcamentoBase);

//         window.orcamentoPorFuncao = window.orcamentoPorFuncao || {};
// const nmEventoMemo = (orcamentoBase.nmevento || '').trim().toUpperCase();
// const nmFuncaoMemo = (orcamentoBase.descfuncao || '').trim().toUpperCase();
// const chaveMemo = `${nmEventoMemo}-${nmFuncaoMemo}`;

// if (chaveMemo && chaveMemo !== '-') {
//     window.orcamentoPorFuncao[chaveMemo] = {
//         idOrcamento: orcamentoBase.idorcamento,
//         quantidade_orcada: Number(orcamentoBase.quantidade_orcada || 0),
//         quantidade_escalada: Number(orcamentoBase.quantidade_escalada || 0),
//         diarias_escaladas: Number(orcamentoBase.diarias_escaladas || 0),
//         datasOrcadas: orcamentoBase.datas_totais_orcadas || [],
//     };
//     console.log(`✅ Memória populada: ${chaveMemo}`, window.orcamentoPorFuncao[chaveMemo]);
// }


//         idOrcamentoAtual = orcamentoBase.idorcamento;
//         const idStaffExistente = document.getElementById('idStaff')?.value;

//         // if (window.isFormLoadedFromDoubleClick || (idStaffExistente && idStaffExistente !== "")) {
//         //     console.log("ℹ️ Carregamento de dados detectado. Pulando validações de divergência.");
//         //     temOrcamento = true;
//         //     controlarBotaoSalvarStaff(true);
//         //     return dadosDoOrcamento;
//         // }

//         const datasOriginais = (window.datasOriginaisCarregadas || []).slice().sort().join(',');
//         const datasAtuais = (datasEvento || []).slice().sort().join(',');
//         const datasNaoMudaram = datasOriginais === datasAtuais;

//         if (isFormLoadedFromDoubleClick && datasNaoMudaram && idStaffExistente && idStaffExistente !== "") {
//             console.log("ℹ️ Carregamento de dados detectado. Pulando validações de divergência.");
//             temOrcamento = true;
//             controlarBotaoSalvarStaff(true);
//             return dadosDoOrcamento;
//         }

        

//         // --- 1. CÁLCULOS DE VAGAS E DIÁRIAS (AJUSTADO VIA DEBUG) ---
//         const q_orcada = Number(orcamentoBase.quantidade_orcada || 0);
//         const q_escalada = Number(orcamentoBase.quantidade_escalada || 0);

//         // 🔥 O segredo está aqui: pegamos o tamanho do array de datas enviado pelo banco
//         const d_orcadas = Array.isArray(orcamentoBase.datas_totais_orcadas) 
//             ? orcamentoBase.datas_totais_orcadas.length 
//             : 0;

//         const d_escaladas = Number(orcamentoBase.diarias_escaladas || 0);

//         const datasSolicitadasArray = Array.isArray(datasEvento) ? datasEvento : [];
//         const d_solicitadas = datasSolicitadasArray.length;

//         // Se não houver datas no formulário, encerra sem disparar o Swal
//         if (d_solicitadas === 0) {
//             temOrcamento = true;
//             controlarBotaoSalvarStaff(true);
//             return dadosDoOrcamento;
//         }

//         // Validações
//         const ultrapassouVagas = !idStaffExistente && (q_escalada + 1) > q_orcada;

//         const d_escaladas_sem_este = idStaffExistente 
//             ? Math.max(0, d_escaladas - (window.datasOriginaisCarregadas?.length || 0))
//             : d_escaladas;

//         const ultrapassouDiarias = q_orcada > 0 && (d_escaladas_sem_este + d_solicitadas) > q_orcada;

//         // Para EXIBIÇÃO - mostra a realidade para o usuário
//         const d_utilizadas_exibir = idStaffExistente
//             ? d_escaladas  // no PUT mostra o total real já no banco (10)
//             : d_escaladas; // no POST também

//         const d_apos_inclusao_exibir = idStaffExistente
//             ? d_escaladas_sem_este + d_solicitadas  // (10-10) + 11 = 11
//             : d_escaladas + d_solicitadas;

//         const excedenteDiarias = ultrapassouDiarias 
//             ? Math.abs(q_orcada - (d_escaladas_sem_este + d_solicitadas)) 
//             : 0;

//         // Agora o d_orcadas será 5, então a validação funcionará corretamente
//        // const ultrapassouDiarias = !idStaffExistente && d_orcadas > 0 && (d_escaladas + d_solicitadas) > d_orcadas;

        

//         const excedenteVagas = ultrapassouVagas ? Math.abs(q_orcada - (q_escalada + 1)) : 0;
//        // const excedenteDiarias = ultrapassouDiarias ? Math.abs(d_orcadas - (d_escaladas + d_solicitadas)) : 0;

//         // const excedenteDiarias = ultrapassouDiarias 
//         //     ? Math.abs(q_orcada - (d_escaladas_sem_este + d_solicitadas)) 
//         //     : 0;

//         // Lógica de Datas (AQUI REMOVI O 'CONST' REPETIDO)
//         const datasOriginaisArray = (orcamentoBase.datas_totais_orcadas || []).map(d => d.includes('T') ? d.split('T')[0] : d);
        
//         // Apenas filtramos, sem declarar a variável de novo
//         const datasForaDoPlanejado = datasSolicitadasArray.filter(d => !new Set(datasOriginaisArray).has(d));
//         const temDataFora = datasForaDoPlanejado.length > 0;

//         // --- 2. MARGEM DE TOLERÂNCIA ---
//         let dentroDaMargem = true;
//         if (temDataFora && datasOriginaisArray.length > 0) {
//             const datasBaseDates = datasOriginaisArray.map(d => new Date(d + 'T00:00:00'));
//             const minDataOrig = new Date(Math.min(...datasBaseDates));
//             const maxDataOrig = new Date(Math.max(...datasBaseDates));
//             const margemInicio = new Date(minDataOrig); margemInicio.setMonth(margemInicio.getMonth() - 1);
//             const margemFim = new Date(maxDataOrig); margemFim.setMonth(margemFim.getMonth() + 1);

//             const datasMuitoFora = datasSolicitadasArray.filter(d => {
//                 const dt = new Date(d + 'T00:00:00');
//                 return dt < margemInicio || dt > margemFim;
//             });
//             if (datasMuitoFora.length > 0) dentroDaMargem = false;
//         }

//         // --- 3. LIBERAÇÃO AUTOMÁTICA ---
//         if (!temDataFora && !ultrapassouVagas && !ultrapassouDiarias) {
//             temOrcamento = true;
//             controlarBotaoSalvarStaff(true);
//             return dadosDoOrcamento;
//         }

//         // --- 3. LIBERAÇÃO AUTOMÁTICA ---
//         if (!temDataFora && !ultrapassouVagas && !ultrapassouDiarias) {
//             temOrcamento = true;
//             controlarBotaoSalvarStaff(true);
//             return dadosDoOrcamento;
//         }

//         // --- 4. VERIFICAÇÃO DE AUTORIZAÇÃO PRÉVIA ---
//         const descFuncaoSelect = document.getElementById('descFuncao');
//         const funcaoTexto = descFuncaoSelect?.options[descFuncaoSelect.selectedIndex]?.text || "";
//         const checkData = await verificarStatusAditivoExtra(
//             idOrcamentoAtual, idFuncao, 
//             "ADITIVO - DATA FORA DO ORÇAMENTO,EXTRA BONIFICADO - DATA FORA DO ORÇAMENTO,ADITIVO - VAGA EXCEDIDA,EXTRA BONIFICADO - VAGA EXCEDIDA", 
//             idFuncionario, nmFuncionario, funcaoTexto, datasForaDoPlanejado[0] ?? null
//         );

//         if (checkData?.autorizado) {
//             temOrcamento = true;
//             controlarBotaoSalvarStaff(true);
//             return dadosDoOrcamento;
//         }
//         if (checkData?.bloqueado) {
//             controlarBotaoSalvarStaff(false);
//             return;
//         }

//         // --- 5. DASHBOARD E MODAL (CORRIGIDO) ---
//         // const htmlDashboard = `
//         //     <div style="text-align: left; font-size: 0.9rem; background: #f8f9fa; padding: 12px; border-radius: 8px; border: 1px solid #dee2e6; margin-bottom: 15px;">
//         //         <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
//         //             <span>Vagas (Pessoas):</span>
//         //             <span style="font-weight:bold;">${q_escalada} / ${q_orcada}</span>
//         //         </div>
//         //         <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
//         //             <span>Diárias (Total):</span>
//         //             <span style="font-weight:bold;">${d_escaladas_sem_este + d_solicitadas} / ${q_orcada}</span>
//         //         </div>
//         //         <div style="display: flex; justify-content: space-between; border-top: 1px solid #ddd; padding-top: 4px; font-weight: bold;">
//         //             <span>Status:</span>
//         //             <span style="color: ${(ultrapassouVagas || ultrapassouDiarias) ? '#dc3545' : '#28a745'}">
//         //                 ${ultrapassouVagas ? `Vagas Excedidas (${excedenteVagas})` : (ultrapassouDiarias ? `Diárias Excedidas (${excedenteDiarias})` : 'Divergência Detectada')}
//         //             </span>
//         //         </div>
//         //     </div>
//         // `;

//         const datasFormatadasBR = datasForaDoPlanejado.map(d => d.split('-').reverse().join('/')).join(', ');

//         const htmlDashboard = `
//             <div style="text-align: left; font-size: 0.9rem; background: #f8f9fa; padding: 12px; border-radius: 8px; border: 1px solid #dee2e6; margin-bottom: 15px;">
//                 <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
//                     <span>Diárias já utilizadas:</span>
//                     <span style="font-weight:bold;">${d_utilizadas_exibir}</span>
//                 </div>
//                 <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
//                     <span>Diárias solicitadas agora:</span>
//                     <span style="font-weight:bold;">${d_solicitadas}</span>
//                 </div>
//                 <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
//                     <span>Total após inclusão:</span>
//                     <span style="font-weight:bold; color: ${ultrapassouDiarias ? '#dc3545' : '#28a745'}">
//                         ${d_apos_inclusao_exibir} de ${q_orcada} orçadas
//                     </span>
//                 </div>
//                 ${temDataFora ? `
//                 <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
//                     <span>Datas fora do período:</span>
//                     <span style="font-weight:bold; color: #dc3545">${datasFormatadasBR}</span>
//                 </div>` : ''}
//                 <div style="display: flex; justify-content: space-between; border-top: 1px solid #ddd; padding-top: 8px; margin-top: 4px; font-weight: bold;">
//                     <span>Situação:</span>
//                     <span style="color: ${(ultrapassouVagas || ultrapassouDiarias) ? '#dc3545' : '#e6a817'}">
//                         ${ultrapassouDiarias 
//                             ? `⛔ Limite excedido em ${excedenteDiarias} diária(s)` 
//                             : ultrapassouVagas 
//                                 ? `⛔ Vagas esgotadas` 
//                                 : `⚠️ Data fora do período planejado`}
//                     </span>
//                 </div>
//             </div>
//         `;

        

//         let swalOptions = {
//             icon: 'warning',
//             title: 'Divergência com o Orçamento',
//             showCancelButton: true,
//             showDenyButton: true,
//             confirmButtonText: 'Solicitar Aditivo',
//             denyButtonText: 'Extra Bonificado',
//             cancelButtonText: 'Corrigir dados',
//             confirmButtonColor: '#28a745',
//             denyButtonColor: '#17a2b8',
//             allowOutsideClick: false,  // ✅ impede fechar clicando fora
//             allowEscapeKey: false,     // ✅ impede fechar com ESC também
//             html: htmlDashboard
//         };

//         const podeProsseguirSem = temDataFora && dentroDaMargem && !ultrapassouVagas && !ultrapassouDiarias;

//         if (podeProsseguirSem) {
//             swalOptions.html += `
//                 <div style="color: #856404; background-color: #fff3cd; border: 1px solid #ffeeba; padding: 10px; border-radius: 5px; font-size: 0.85rem; text-align:left;">
//                     As datas <b>${datasFormatadasBR}</b> não estão no orçamento, mas estão dentro da margem permitida de 30 dias.
//                 </div>
//                 <p style="margin-top:15px;">Deseja registrar como exceção ou apenas prosseguir?</p>
//             `;
//             swalOptions.footer = '<button id="btnProsseguirSem" class="swal2-confirm swal2-styled" style="background-color: #6e7881; border:none; border-radius: 5px; color: white; padding: 10px 15px; cursor: pointer; width: 400px; text-align:center;">Prosseguir Sem Solicitação</button>';
//         } else {
//             // Define a mensagem de erro específica para o bloqueio
//             let msgErro = "";
//             if (ultrapassouDiarias) msgErro = `Limite de Diárias excedido (${d_orcadas} orçadas).`;
//             else if (ultrapassouVagas) msgErro = `Limite de vagas excedido.`;
//             else msgErro = `Datas (<b>${datasFormatadasBR}</b>) fora da margem permitida.`;

//             swalOptions.html += `
//                 <div style="color: #721c24; background-color: #f8d7da; border: 1px solid #f5c6cb; padding: 10px; border-radius: 5px; font-size: 0.85rem; text-align:left;">
//                     🛑 <b>Bloqueio:</b> ${msgErro}
//                 </div>
//                 <p style="margin-top:15px;">Uma autorização é obrigatória para salvar.</p>
//             `;
//             swalOptions.footer = ''; 
//         }

//       // const result = await Swal.fire(swalOptions);

//        let prosseguirSemSolicitacao = false;

//         if (podeProsseguirSem) {
//             swalOptions.didOpen = () => {
//                 const btnFooter = document.getElementById('btnProsseguirSem');
//                 if (btnFooter) {
//                     btnFooter.onclick = () => {
//                         prosseguirSemSolicitacao = true;
//                         Swal.clickConfirm();
//                     };
//                 }
//             };
//         }

//         const result = await Swal.fire(swalOptions);

//         if (result.dismiss === Swal.DismissReason.cancel) {
//             // 1. Localize o input onde o Flatpickr está instanciado
//             const inputData = document.getElementById('datasEvento'); // Ajuste para o ID real do seu input
            
//             if (inputData && inputData._flatpickr) {
//                 const fp = inputData._flatpickr;
                
//                 // 2. Filtramos as datas atuais removendo as que estão fora do planejado
//                 // Usamos o Set para performance na comparação
//                 const setFora = new Set(datasForaDoPlanejado);
//                 const datasCorrigidas = fp.selectedDates.filter(date => {
//                     const dataISO = date.toISOString().split('T')[0];
//                     return !setFora.has(dataISO);
//                 });

//                 // 3. Atualizamos o calendário
//                 fp.setDate(datasCorrigidas, true); // O 'true' dispara o evento onChange do Flatpickr
                
//                 // 4. Feedback visual opcional
//                 console.log("✅ Calendário corrigido. Datas removidas:", datasForaDoPlanejado);
//             }
//         }

       
//         // O listener do botão de footer precisa ser anexado via delegate ou checado após o clique se for disparado pelo Swal
//         // Mas a forma mais segura com SweetAlert2 é capturar o clique do elemento injetado:
//         // if (podeProsseguirSem) {
//         //      const btnFooter = document.getElementById('btnProsseguirSem');
//         //      if (btnFooter) {
//         //          btnFooter.onclick = () => {
//         //              prosseguirSemSolicitacao = true;
//         //              Swal.clickConfirm();
//         //          };
//         //      }
//         // }

        



//         if (prosseguirSemSolicitacao) {
//             const elObs = document.getElementById('obsgeral');
//             if (elObs) {
//                 const periodoOriginalBR = datasOriginaisArray.map(d => d.split('-').reverse().join('/')).join(', ');
//                 const logHist = `\n[HISTÓRICO] Período planejado: ${periodoOriginalBR}. Registrado em: ${datasFormatadasBR} por margem de tolerância. Por: ${nomeUsuarioLogado}.`;
//                 elObs.value = (elObs.value + logHist).trim();
//             }
//             temOrcamento = true;
//             controlarBotaoSalvarStaff(true);
//             return dadosDoOrcamento;
//         }

//         if (result.isConfirmed || result.isDenied) {
//             const baseTipo = result.isConfirmed ? 'Aditivo' : 'Extra Bonificado';
//             // Prioridade do motivo: Se estourou diária ou vaga, o motivo é Vaga Excedida
//             const motivo = (ultrapassouVagas || ultrapassouDiarias) ? 'Vaga Excedida' : 'Datas fora do Orçamento';
//             const tipoFinal = `${baseTipo} - ${motivo}`;

//             let datasParaSolicitacao = [];

//             if (temDataFora) {
//                 // Se houver datas fora do planeado (ex: 11/04), enviamos APENAS essas
//                 datasParaSolicitacao = datasForaDoPlanejado;
//              } else if (ultrapassouDiarias || ultrapassouVagas) {
//                 // Se o erro for apenas excesso de quantidade, mas as datas estão no orçamento,
//                 // enviamos a última data selecionada como o "ponto de conflito" 
//                 // ou o array completo, dependendo da sua preferência.
//                 // Para mostrar apenas a excedente:
//                 datasParaSolicitacao = [datasSolicitadasArray[datasSolicitadasArray.length - 1]];
//             } 
//             //else {
//             //     datasParaSolicitacao = datasSolicitadasArray;
//             // }

            

//             if (datasParaSolicitacao.length === 0) {
//                 datasParaSolicitacao = datasSolicitadasArray;
//             }

//            // const resEx = await solicitarDadosExcecao(tipoFinal, idOrcamentoAtual, funcaoTexto, idFuncao, idFuncionario, datasForaDoPlanejado.length > 0 ? datasForaDoPlanejado : datasSolicitadasArray);
            
// // 🔥 CONSOLE DE VERIFICAÇÃO 1
// console.log("DEBUG ANTES DE ENVIAR:");
// console.log("- Tipo Final:", tipoFinal);
// console.log("- Array Filtrado (datasParaSolicitacao):", datasParaSolicitacao);

//             const resEx = await solicitarDadosExcecao(
//                     tipoFinal, 
//                     idOrcamentoAtual, 
//                     funcaoTexto, 
//                     idFuncao, 
//                     idFuncionario, 
//                     datasParaSolicitacao // Enviando apenas a(s) data(s) de conflito
//                 );

//             if (resEx?.confirmado) {
//                 window.tipoExcecaoAtual = tipoFinal;
//                 window.justificativaParaSalvar = resEx.justificativa;
//                 window.datasParaSalvarNoBanco = resEx.dataConflito;
//                 window.bSalvarComoInativo = true;
//                 if (document.getElementById('tipoSolicitacaoAditivo')) document.getElementById('tipoSolicitacaoAditivo').value = tipoFinal;
//                 if (document.getElementById('justificativaAditivo')) document.getElementById('justificativaAditivo').value = resEx.justificativa;
//                 temOrcamento = true;
//                 controlarBotaoSalvarStaff(true);
//             } else {
//                 controlarBotaoSalvarStaff(false);
//             }
//         } else {
//             controlarBotaoSalvarStaff(false);
//         }

//         return dadosDoOrcamento;
//     } catch (error) {
//         console.error("❌ [CRÍTICO] Erro em buscarEPopularOrcamento:", error);
//         controlarBotaoSalvarStaff(false);
//     }
// }


// 🔥 Adicionado o parâmetro bEhDiariaDobrada com valor padrão false para não quebrar as outras chamadas do sistema

// async function buscarEPopularOrcamento(idEvento, idCliente, idLocalMontagem, idFuncao, datasEvento, bEhDiariaDobrada = false) {
//     try {
//         console.log("🚀 [INÍCIO] buscarEPopularOrcamento", { idEvento, idCliente, idLocalMontagem, idFuncao, datasEvento, bEhDiariaDobrada });

//         let orcamentoBase = null;
//         const idFuncionario = document.getElementById('idFuncionario')?.value;
//         const selectFunc = document.getElementById('nmFuncionario');
//         const nmFuncionario = selectFunc?.options[selectFunc.selectedIndex]?.text || "Funcionário não identificado";
//         const elInputSetor = document.getElementById('setor');
//         const setorAtual = elInputSetor ? elInputSetor.value.trim() : null;
//         const nomeUsuarioLogado = window.usuarioLogadoNome || "Sistema";

//         // Limpeza de estados
//         if (document.getElementById('tipoSolicitacaoAditivo')) document.getElementById('tipoSolicitacaoAditivo').value = '';
//         if (document.getElementById('justificativaAditivo')) document.getElementById('justificativaAditivo').value = '';
//         window.tipoExcecaoAtual = null;
//         window.justificativaParaSalvar = null;
//         window.bSalvarComoInativo = false;

//         const criteriosDeBusca = { idEvento, idCliente, idLocalMontagem, idFuncao, setor: setorAtual, datasEvento: datasEvento || [] };

//         let dadosDoOrcamento;

//         // 🔀 NOVA REGRA DA DIÁRIA DOBRADA
//         if (bEhDiariaDobrada) {
//             console.log("🔄 [DIÁRIA DOBRADA DETECTADA] Buscando vagas consolidadas em /orcamento/vagas-disponiveis");
//             try {
//                 const responseVagas = await fetchComToken('/staff/orcamento/vagas-disponiveis', {
//                     method: 'POST',
//                     headers: { 'Content-Type': 'application/json' },
//                     body: JSON.stringify({
//                         idOrcamento: window.idOrcamentoAtual || null,
//                         idEvento,
//                         idCliente,
//                         idLocalMontagem
//                     })
//                 });

//                 if (responseVagas && responseVagas.ok) {
//                     const dadosVagasMacro = await responseVagas.json();
                    
//                     // Encontra os dados específicos desta função no retorno macro
//                     orcamentoBase = dadosVagasMacro.find(item => Number(item.idfuncao) === Number(idFuncao));
                    
//                     // Se achou, simula a estrutura que o restante do código espera para não quebrar nada
//                     if (orcamentoBase) {
//                         dadosDoOrcamento = [{
//                             idorcamento: orcamentoBase.idorcamento,
//                             nmevento: orcamentoBase.nmevento || '',
//                             descfuncao: orcamentoBase.descfuncao || '',
//                             quantidade_orcada: orcamentoBase.quantidade_orcada,
//                             quantidade_escalada: orcamentoBase.quantidade_escalada,
//                             diarias_escaladas: orcamentoBase.diarias_escaladas,
//                             datas_totais_orcadas: orcamentoBase.datas_totais_orcadas || []
//                         }];
//                     }
//                 }
//             } catch (errVagas) {
//                 console.error("❌ Falha ao buscar dados em /orcamento/vagas-disponiveis. Tentando fallback...", errVagas);
//             }
//         }

//         // // ℹ️ Se NÃO for Diária Dobrada, ou se a rota macro falhar por algum motivo, roda o fluxo tradicional:
//         // if (!dadosDoOrcamento) {
//         //     try {
//         //         dadosDoOrcamento = await fetchComToken('/staff/orcamento/consultar', {
//         //             method: 'POST',
//         //             headers: { 'Content-Type': 'application/json' },
//         //             body: JSON.stringify(criteriosDeBusca)
//         //         });
//         //     } catch (e) { dadosDoOrcamento = []; }

//         //     if (!Array.isArray(dadosDoOrcamento) || dadosDoOrcamento.length === 0) {
//         //         try {
//         //             dadosDoOrcamento = await fetchComToken('/staff/orcamento/consultar', {
//         //                 method: 'POST',
//         //                 headers: { 'Content-Type': 'application/json' },
//         //                 body: JSON.stringify({ ...criteriosDeBusca, ignorarFiltroData: true })
//         //             });
//         //         } catch (err) { console.error("❌ Busca expandida falhou."); }
//         //     }
//         // }

//         // if (!Array.isArray(dadosDoOrcamento) || dadosDoOrcamento.length === 0) {
//         //     temOrcamento = false;
//         //     controlarBotaoSalvarStaff(false); 
//         //     Swal.fire({ icon: 'warning', title: 'Orçamento não localizado', text: 'Não existe planejamento para esta função nos critérios selecionados.' });
//         //     return;
//         // }

//         // // Se o orcamentoBase ainda não tiver sido definido pela rota da diária dobrada, define aqui
//         // if (!orcamentoBase) {
//         //     orcamentoBase = dadosDoOrcamento.find(item => setorAtual && item.setor?.trim().toUpperCase() === setorAtual.toUpperCase()) 
//         //                     || dadosDoOrcamento.find(item => !item.setor) 
//         //                     || dadosDoOrcamento[0];
//         // }

//         // ... (resto do código de busca acima igual)

//         // ℹ️ Se NÃO for Diária Dobrada, roda o fluxo tradicional consultando a nova API estruturada:
//         if (!dadosDoOrcamento) {
//             try {
//                 let response = await fetchComToken('/staff/orcamento/consultar', {
//                     method: 'POST',
//                     headers: { 'Content-Type': 'application/json' },
//                     body: JSON.stringify(criteriosDeBusca)
//                 });
                
//                 // Normaliza o retorno da API: extrai o item caso venha encapsulado em Array, senão usa o objeto direto
//                 dadosDoOrcamento = Array.isArray(response) ? response[0] : response;
//             } catch (e) { 
//                 dadosDoOrcamento = null; 
//             }

//             // Se falhou ou retornou vazio, tenta a busca expandida ignorando filtros de data
//             if (!dadosDoOrcamento || !dadosDoOrcamento.idorcamento) {
//                 try {
//                     let responseExpandida = await fetchComToken('/staff/orcamento/consultar', {
//                         method: 'POST',
//                         headers: { 'Content-Type': 'application/json' },
//                         body: JSON.stringify({ ...criteriosDeBusca, ignorarFiltroData: true })
//                     });
//                     dadosDoOrcamento = Array.isArray(responseExpandida) ? responseExpandida[0] : responseExpandida;
//                 } catch (err) { 
//                     console.error("❌ Busca expandida falhou."); 
//                 }
//             }
//         }

//         // 🛡️ [CORREÇÃO AQUI] Validação definitiva de existência do Orçamento
//         // Se dadosDoOrcamento for null, undefined ou não tiver idorcamento, para o código IMEDIATAMENTE.
//         if (!dadosDoOrcamento || !dadosDoOrcamento.idorcamento) {
//             console.warn("⚠️ Orçamento retornado é inválido ou nulo:", dadosDoOrcamento);
//             temOrcamento = false;
//             controlarBotaoSalvarStaff(false); 
//             Swal.fire({ 
//                 icon: 'warning', 
//                 title: 'Orçamento não localizado', 
//                 text: 'Não existe planejamento para esta função nos critérios selecionados.' 
//             });
//             return; // 🛑 ATENÇÃO: Mudado de 'return null' para 'return' puro para parar a função imediatamente!
//         }

//         // Como normalizamos acima e garantimos que não é nulo, o orcamentoBase recebe o objeto com segurança
//         if (!orcamentoBase) {
//             orcamentoBase = dadosDoOrcamento;
//         }
        
//         console.log("DEBUG ORÇAMENTO LOCALIZADO:", orcamentoBase);

//         window.orcamentoPorFuncao = window.orcamentoPorFuncao || {};
//         // Agora essa linha nunca mais lerá de um null:
//         const nmEventoMemo = (orcamentoBase.nmevento || '').trim().toUpperCase();
//         const nmFuncaoMemo = (orcamentoBase.descfuncao || orcamentoBase.nmfuncao || '').trim().toUpperCase();
        
//         // ... (resto do código de cálculos e Swal segue igual abaixo)
//         const chaveMemo = `${nmEventoMemo}-${nmFuncaoMemo}`;

//         // if (chaveMemo && chaveMemo !== '-') {
//         //     window.orcamentoPorFuncao[chaveMemo] = {
//         //         idOrcamento: orcamentoBase.idorcamento,
//         //         quantidade_orcada: Number(orcamentoBase.quantidade_orcada || 0),
//         //         quantidade_escalada: Number(orcamentoBase.quantidade_escalada || 0),
//         //         diarias_escaladas: Number(orcamentoBase.diarias_escaladas || 0),
//         //         datasOrcadas: orcamentoBase.datas_totais_orcadas || [],
//         //     };
//         //     console.log(`✅ Memória populada: ${chaveMemo}`, window.orcamentoPorFuncao[chaveMemo]);
//         // }

//         if (chaveMemo && chaveMemo !== '-') {
//             window.orcamentoPorFuncao[chaveMemo] = {
//                 idorcamento: orcamentoBase.idorcamento,
//                 idOrcamento: orcamentoBase.idorcamento,
//                 quantidade_orcada: Number(orcamentoBase.quantidade_orcada || 0),
//                 quantidadeOrcada: Number(orcamentoBase.quantidade_orcada || 0),
//                 quantidade_escalada: Number(orcamentoBase.quantidade_escalada || 0),
//                 diarias_escaladas: Number(orcamentoBase.diarias_escaladas || 0),
//                 datasOrcadas: orcamentoBase.datas_totais_orcadas || [],
//                 itensOrcamentoDetail: orcamentoBase.itensOrcamentoDetail || []
//             };
//             console.log(`✅ Memória populada: ${chaveMemo}`, window.orcamentoPorFuncao[chaveMemo]);
//         }

//         idOrcamentoAtual = orcamentoBase.idorcamento;
//         const idStaffExistente = document.getElementById('idStaff')?.value;

//         const datasOriginais = (window.datasOriginaisCarregadas || []).slice().sort().join(',');
//         const datasAtuais = (datasEvento || []).slice().sort().join(',');
//         const datasNaoMudaram = datasOriginais === datasAtuais;

//         if (isFormLoadedFromDoubleClick && datasNaoMudaram && idStaffExistente && idStaffExistente !== "") {
//             console.log("ℹ️ Carregamento de dados detectado. Pulando validações de divergência.");
//             temOrcamento = true;
//             controlarBotaoSalvarStaff(true);
//             return dadosDoOrcamento;
//         }

//         // --- 1. CÁLCULOS DE VAGAS E DIÁRIAS (AJUSTADO VIA DEBUG) ---
//         const q_orcada = Number(orcamentoBase.quantidade_orcada || 0);
//         const q_escalada = Number(orcamentoBase.quantidade_escalada || 0);

//         const d_orcadas = Array.isArray(orcamentoBase.datas_totais_orcadas) 
//             ? orcamentoBase.datas_totais_orcadas.length 
//             : 0;

//         const d_escaladas = Number(orcamentoBase.diarias_escaladas || 0);
//         const datasSolicitadasArray = Array.isArray(datasEvento) ? datasEvento : [];
//         const d_solicitadas = datasSolicitadasArray.length;

//         if (d_solicitadas === 0) {
//             temOrcamento = true;
//             controlarBotaoSalvarStaff(true);
//             return dadosDoOrcamento;
//         }

//         const ultrapassouVagas = !idStaffExistente && (q_escalada + 1) > q_orcada;

//         const d_escaladas_sem_este = idStaffExistente 
//             ? Math.max(0, d_escaladas - (window.datasOriginaisCarregadas?.length || 0))
//             : d_escaladas;

//         const ultrapassouDiarias = q_orcada > 0 && (d_escaladas_sem_este + d_solicitadas) > q_orcada;

//         const d_utilizadas_exibir = d_escaladas;
//         const d_apos_inclusao_exibir = idStaffExistente
//             ? d_escaladas_sem_este + d_solicitadas
//             : d_escaladas + d_solicitadas;

//         const excedenteDiarias = ultrapassouDiarias 
//             ? Math.abs(q_orcada - (d_escaladas_sem_este + d_solicitadas)) 
//             : 0;

//         const excedenteVagas = ultrapassouVagas ? Math.abs(q_orcada - (q_escalada + 1)) : 0;

//         const datasOriginaisArray = (orcamentoBase.datas_totais_orcadas || []).map(d => d.includes('T') ? d.split('T')[0] : d);
//         const datasForaDoPlanejado = datasSolicitadasArray.filter(d => !new Set(datasOriginaisArray).has(d));
//         const temDataFora = datasForaDoPlanejado.length > 0;

//         // --- 2. MARGEM DE TOLERÂNCIA ---
//         let dentroDaMargem = true;
//         if (temDataFora && datasOriginaisArray.length > 0) {
//             const datasBaseDates = datasOriginaisArray.map(d => new Date(d + 'T00:00:00'));
//             const minDataOrig = new Date(Math.min(...datasBaseDates));
//             const maxDataOrig = new Date(Math.max(...datasBaseDates));
//             const margemInicio = new Date(minDataOrig); margemInicio.setMonth(margemInicio.getMonth() - 1);
//             const margemFim = new Date(maxDataOrig); margemFim.setMonth(margemFim.getMonth() + 1);

//             const datasMuitoFora = datasSolicitadasArray.filter(d => {
//                 const dt = new Date(d + 'T00:00:00');
//                 return dt < margemInicio || dt > margemFim;
//             });
//             if (datasMuitoFora.length > 0) dentroDaMargem = false;
//         }

//         console.log("🚦 [RESULTADOS DAS VERIFICAÇÕES]", {
//             ultrapassouVagas,
//             ultrapassouDiarias,
//             dentroDaMargem,
//             temDataFora,
//             bEhDiariaDobrada
//         });

//         // --- 3. LIBERAÇÃO AUTOMÁTICA ---
//         if (!bEhDiariaDobrada && !temDataFora && !ultrapassouVagas && !ultrapassouDiarias) {
//             temOrcamento = true;
//             controlarBotaoSalvarStaff(true);
//             return dadosDoOrcamento;
//         }

//         // --- 4. VERIFICAÇÃO DE AUTORIZAÇÃO PRÉVIA ---
//         const descFuncaoSelect = document.getElementById('descFuncao');
//         const funcaoTexto = descFuncaoSelect?.options[descFuncaoSelect.selectedIndex]?.text || "";
//         const checkData = await verificarStatusAditivoExtra(
//             idOrcamentoAtual, idFuncao, 
//             "ADITIVO - DATA FORA DO ORÇAMENTO,EXTRA BONIFICADO - DATA FORA DO ORÇAMENTO,ADITIVO - VAGA EXCEDIDA,EXTRA BONIFICADO - VAGA EXCEDIDA", 
//             idFuncionario, nmFuncionario, funcaoTexto, datasForaDoPlanejado[0] ?? null, 
//             idEvento,              // idEventoSolicitado (Passando o ID do Evento Atual)
//             null,                  // idEventoConflitante (Não temos um agendamento colidido mapeado aqui)
//             []                     // conflitosReaisParam (Passamos um array vazio de forma explícita e segura)
//         );

//         if (checkData?.autorizado) {
//             temOrcamento = true;
//             controlarBotaoSalvarStaff(true);
//             return dadosDoOrcamento;
//         }
//         if (checkData?.bloqueado) {
//             controlarBotaoSalvarStaff(false);
//             return;
//         }

//         // --- 5. DASHBOARD E MODAL ---
//         const datasFormatadasBR = datasForaDoPlanejado.map(d => d.split('-').reverse().join('/')).join(', ');

//         const htmlDashboard = `
//             <div style="text-align: left; font-size: 0.9rem; background: #f8f9fa; padding: 12px; border-radius: 8px; border: 1px solid #dee2e6; margin-bottom: 15px;">
//                 <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
//                     <span>Diárias já utilizadas:</span>
//                     <span style="font-weight:bold;">${d_utilizadas_exibir}</span>
//                 </div>
//                 <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
//                     <span>Diárias solicitadas agora:</span>
//                     <span style="font-weight:bold;">${d_solicitadas}</span>
//                 </div>
//                 <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
//                     <span>Total após inclusão:</span>
//                     <span style="font-weight:bold; color: ${ultrapassouDiarias ? '#dc3545' : '#28a745'}">
//                         ${d_apos_inclusao_exibir} de ${q_orcada} orçadas
//                     </span>
//                 </div>
//                 ${temDataFora ? `
//                 <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
//                     <span>Datas fora do período:</span>
//                     <span style="font-weight:bold; color: #dc3545">${datasFormatadasBR}</span>
//                 </div>` : ''}
//                 <div style="display: flex; justify-content: space-between; border-top: 1px solid #ddd; padding-top: 8px; margin-top: 4px; font-weight: bold;">
//                     <span>Situação:</span>
//                     <span style="color: ${(ultrapassouVagas || ultrapassouDiarias) ? '#dc3545' : '#e6a817'}">
//                         ${ultrapassouDiarias 
//                             ? `⛔ Limite excedido em ${excedenteDiarias} diária(s)` 
//                             : ultrapassouVagas 
//                                 ? `⛔ Vagas esgotadas` 
//                                 : `⚠️ Data fora do período planejado`}
//                     </span>
//                 </div>
//             </div>
//         `;

//         let swalOptions = {
//             icon: 'warning',
//             title: 'Divergência com o Orçamento',
//             showCancelButton: true,
//             showDenyButton: true,
//             confirmButtonText: 'Solicitar Aditivo',
//             denyButtonText: 'Extra Bonificado',
//             cancelButtonText: 'Corrigir dados',
//             confirmButtonColor: '#28a745',
//             denyButtonColor: '#17a2b8',
//             allowOutsideClick: false,
//             allowEscapeKey: false,
//             html: htmlDashboard
//         };

//         const podeProsseguirSem = temDataFora && dentroDaMargem && !ultrapassouVagas && !ultrapassouDiarias;

//         if (podeProsseguirSem) {
//             swalOptions.html += `
//                 <div style="color: #856404; background-color: #fff3cd; border: 1px solid #ffeeba; padding: 10px; border-radius: 5px; font-size: 0.85rem; text-align:left;">
//                     As datas <b>${datasFormatadasBR}</b> não estão no orçamento, mas estão dentro da margem permitida de 30 dias.
//                 </div>
//                 <p style="margin-top:15px;">Deseja registrar como exceção ou apenas prosseguir?</p>
//             `;
//             swalOptions.footer = '<button id="btnProsseguirSem" class="swal2-confirm swal2-styled" style="background-color: #6e7881; border:none; border-radius: 5px; color: white; padding: 10px 15px; cursor: pointer; width: 400px; text-align:center;">Prosseguir Sem Solicitação</button>';
//         } else {
//             let msgErro = "";
//             if (ultrapassouDiarias) msgErro = `Limite de Diárias excedido (${q_orcada} orçadas).`;
//             else if (ultrapassouVagas) msgErro = `Limite de vagas excedido.`;
//             else msgErro = `Datas (<b>${datasFormatadasBR}</b>) fora da margem permitida.`;

//             swalOptions.html += `
//                 <div style="color: #721c24; background-color: #f8d7da; border: 1px solid #f5c6cb; padding: 10px; border-radius: 5px; font-size: 0.85rem; text-align:left;">
//                     🛑 <b>Bloqueio:</b> ${msgErro}
//                 </div>
//                 <p style="margin-top:15px;">Uma autorização é obrigatória para salvar.</p>
//             `;
//             swalOptions.footer = ''; 
//         }

//         let prosseguirSemSolicitacao = false;        

//         // if (podeProsseguirSem) {
//         //     swalOptions.didOpen = () => {
//         //         const btnFooter = document.getElementById('btnProsseguirSem');
//         //         if (btnFooter) {
//         //             btnFooter.onclick = () => {
//         //                 prosseguirSemSolicitacao = true;
//         //                 Swal.clickConfirm();
//         //             };
//         //         }
//         //     };
//         // }

//         if (bEhDiariaDobrada) {
//             // Injeta o alerta visual de Diária Dobrada no topo do HTML
//             swalOptions.html = `
//                 <div style="color: #856404; background-color: #fff3cd; border: 1px solid #ffeeba; padding: 10px; border-radius: 5px; font-size: 0.85rem; text-align:left; margin-bottom: 15px;">
//                     ⚠️ <b>Atenção:</b> Este lançamento foi identificado como <b>Diária Dobrada</b>. 
//                     Selecione uma das opções abaixo para classificar a exceção no orçamento.
//                 </div>
//             ` + htmlDashboard;
            
//             swalOptions.footer = ''; // Sem botão de rodapé, força o Aditivo ou Extra
//         } else {
//             // --- FLUXO PADRÃO DO SISTEMA ---
//             const podeProsseguirSem = temDataFora && dentroDaMargem && !ultrapassouVagas && !ultrapassouDiarias;

//             if (podeProsseguirSem) {
//                 swalOptions.html += `
//                     <div style="color: #856404; background-color: #fff3cd; border: 1px solid #ffeeba; padding: 10px; border-radius: 5px; font-size: 0.85rem; text-align:left;">
//                         As datas <b>${datasFormatadasBR}</b> não estão no orçamento, mas estão dentro da margem permitida de 30 dias.
//                     </div>
//                     <p style="margin-top:15px;">Deseja registrar como exceção ou apenas prosseguir?</p>
//                 `;
//                 swalOptions.footer = '<button id="btnProsseguirSem" class="swal2-confirm swal2-styled" style="background-color: #6e7881; border:none; border-radius: 5px; color: white; padding: 10px 15px; cursor: pointer; width: 400px; text-align:center;">Prosseguir Sem Solicitação</button>';
//             } else {
//                 let msgErro = "";
//                 if (ultrapassouDiarias) msgErro = `Limite de Diárias excedido (${q_orcada} orçadas).`;
//                 else if (ultrapassouVagas) msgErro = `Limite de vagas excedido.`;
//                 else msgErro = `Datas (<b>${datasFormatadasBR}</b>) fora da margem permitida.`;

//                 swalOptions.html += `
//                     <div style="color: #721c24; background-color: #f8d7da; border: 1px solid #f5c6cb; padding: 10px; border-radius: 5px; font-size: 0.85rem; text-align:left;">
//                         🛑 <b>Bloqueio:</b> ${msgErro}
//                     </div>
//                     <p style="margin-top:15px;">Uma autorização é obrigatória para salvar.</p>
//                 `;
//                 swalOptions.footer = ''; 
//             }

//             // Anexa o evento do rodapé se puder prosseguir sem aditivo
//             if (podeProsseguirSem) {
//                 swalOptions.didOpen = () => {
//                     const btnFooter = document.getElementById('btnProsseguirSem');
//                     if (btnFooter) {
//                         btnFooter.onclick = () => {
//                             prosseguirSemSolicitacao = true;
//                             Swal.clickConfirm();
//                         };
//                     }
//                 };
//             }
//         }

//         const result = await Swal.fire(swalOptions);

//         if (result.dismiss === Swal.DismissReason.cancel) {
//             const inputData = document.getElementById('datasEvento'); 
//             if (inputData && inputData._flatpickr) {
//                 const fp = inputData._flatpickr;
//                 const setFora = new Set(datasForaDoPlanejado);
//                 const datasCorrigidas = fp.selectedDates.filter(date => {
//                     const dataISO = date.toISOString().split('T')[0];
//                     return !setFora.has(dataISO);
//                 });
//                 fp.setDate(datasCorrigidas, true);
//                 console.log("✅ Calendário corrigido. Datas removidas:", datasForaDoPlanejado);
//             }
//         }

//         if (prosseguirSemSolicitacao) {
//             const elObs = document.getElementById('obsgeral');
//             if (elObs) {
//                 const periodoOriginalBR = datasOriginaisArray.map(d => d.split('-').reverse().join('/')).join(', ');
//                 const logHist = `\n[HISTÓRICO] Período planejado: ${periodoOriginalBR}. Registrado em: ${datasFormatadasBR} por margem de tolerância. Por: ${nomeUsuarioLogado}.`;
//                 elObs.value = (elObs.value + logHist).trim();
//             }
//             temOrcamento = true;
//             controlarBotaoSalvarStaff(true);
//             return dadosDoOrcamento;
//         }

//         if (result.isConfirmed || result.isDenied) {
//             const baseTipo = result.isConfirmed ? 'Aditivo' : 'Extra Bonificado';
//             const motivo = (ultrapassouVagas || ultrapassouDiarias) ? 'Vaga Excedida' : 'Datas fora do Orçamento';
//             const tipoFinal = `${baseTipo} - ${motivo}`;

//             let datasParaSolicitacao = [];

//             if (temDataFora) {
//                 datasParaSolicitacao = datasForaDoPlanejado;
//             } else if (ultrapassouDiarias || ultrapassouVagas) {
//                 datasParaSolicitacao = [datasSolicitadasArray[datasSolicitadasArray.length - 1]];
//             } 

//             if (datasParaSolicitacao.length === 0) {
//                 datasParaSolicitacao = datasSolicitadasArray;
//             }

//             console.log("DEBUG ANTES DE ENVIAR:", { tipoFinal, datasParaSolicitacao });

//             const resEx = await solicitarDadosExcecao(tipoFinal, idOrcamentoAtual, funcaoTexto, idFuncao, idFuncionario, datasParaSolicitacao);

//             if (resEx?.confirmado) {
//                 window.tipoExcecaoAtual = tipoFinal;
//                 window.justificativaParaSalvar = resEx.justificativa;
//                 window.datasParaSalvarNoBanco = resEx.dataConflito;
//                 window.bSalvarComoInativo = true;
//                 if (document.getElementById('tipoSolicitacaoAditivo')) document.getElementById('tipoSolicitacaoAditivo').value = tipoFinal;
//                 if (document.getElementById('justificativaAditivo')) document.getElementById('justificativaAditivo').value = resEx.justificativa;
//                 temOrcamento = true;
//                 controlarBotaoSalvarStaff(true);
//             } else {
//                 controlarBotaoSalvarStaff(false);
//             }
//         } else {
//             controlarBotaoSalvarStaff(false);
//         }

//         return dadosDoOrcamento;
//     } catch (error) {
//         console.error("❌ [CRÍTICO] Erro em buscarEPopularOrcamento:", error);
//         controlarBotaoSalvarStaff(false);
//     }
// }

// 🎯 Adicionado o parâmetro opcional 'ignorarModalVisivel' no final da assinatura
// async function buscarEPopularOrcamento(idEvento, idCliente, idLocalMontagem, idFuncao, datasEvento, bEhDiariaDobrada = false, ignorarModalVisivel = false) {
//     try {
//         console.log("🚀 [INÍCIO] buscarEPopularOrcamento", { idEvento, idCliente, idLocalMontagem, idFuncao, datasEvento, bEhDiariaDobrada, ignorarModalVisivel });

//         let orcamentoBase = null;
//         const idFuncionario = document.getElementById('idFuncionario')?.value;
//         const selectFunc = document.getElementById('nmFuncionario');
//         const nmFuncionario = selectFunc?.options[selectFunc.selectedIndex]?.text || "Funcionário não identificado";
//         const elInputSetor = document.getElementById('setor');
//         const setorAtual = elInputSetor ? elInputSetor.value.trim() : null;
//         const nomeUsuarioLogado = window.usuarioLogadoNome || "Sistema";

//         // Limpeza de estados
//         if (document.getElementById('tipoSolicitacaoAditivo')) document.getElementById('tipoSolicitacaoAditivo').value = '';
//         if (document.getElementById('justificativaAditivo')) document.getElementById('justificativaAditivo').value = '';
//         window.tipoExcecaoAtual = null;
//         window.justificativaParaSalvar = null;
//         window.bSalvarComoInativo = false;

//         const criteriosDeBusca = { idEvento, idCliente, idLocalMontagem, idFuncao, setor: setorAtual, datasEvento: datasEvento || [] };

//         let dadosDoOrcamento;

//         // 🔀 NOVA REGRA DA DIÁRIA DOBRADA
//         if (bEhDiariaDobrada) {
//             console.log("🔄 [DIÁRIA DOBRADA DETECTADA] Buscando vagas consolidadas em /orcamento/vagas-disponiveis");
//             try {
//                 const responseVagas = await fetchComToken('/staff/orcamento/vagas-disponiveis', {
//                     method: 'POST',
//                     headers: { 'Content-Type': 'application/json' },
//                     body: JSON.stringify({
//                         idOrcamento: window.idOrcamentoAtual || null,
//                         idEvento,
//                         idCliente,
//                         idLocalMontagem
//                     })
//                 });

//                 if (responseVagas && responseVagas.ok) {
//                     const dadosVagasMacro = await responseVagas.json();
                    
//                     // Encontra os dados específicos desta função no retorno macro
//                     orcamentoBase = dadosVagasMacro.find(item => Number(item.idfuncao) === Number(idFuncao));
                    
//                     // Se achou, simula a estrutura que o restante do código espera para não quebrar nada
//                     if (orcamentoBase) {
//                         dadosDoOrcamento = [{
//                             idorcamento: orcamentoBase.idorcamento,
//                             nmevento: orcamentoBase.nmevento || '',
//                             descfuncao: orcamentoBase.descfuncao || '',
//                             quantidade_orcada: orcamentoBase.quantidade_orcada,
//                             quantidade_escalada: orcamentoBase.quantidade_escalada,
//                             diarias_escaladas: orcamentoBase.diarias_escaladas,
//                             datas_totais_orcadas: orcamentoBase.datas_totais_orcadas || []
//                         }];
//                     }
//                 }
//             } catch (errVagas) {
//                 console.error("❌ Falha ao buscar dados em /orcamento/vagas-disponiveis. Tentando fallback...", errVagas);
//             }
//         }

//         // ℹ️ Se NÃO for Diária Dobrada, roda o fluxo tradicional consultando a nova API estruturada:
//         if (!dadosDoOrcamento) {
//             try {
//                 let response = await fetchComToken('/staff/orcamento/consultar', {
//                     method: 'POST',
//                     headers: { 'Content-Type': 'application/json' },
//                     body: JSON.stringify(criteriosDeBusca)
//                 });
                
//                 dadosDoOrcamento = Array.isArray(response) ? response[0] : response;
//             } catch (e) { 
//                 dadosDoOrcamento = null; 
//             }

//             // Se falhou ou retornou vazio, tenta a busca expandida ignorando filtros de data
//             if (!dadosDoOrcamento || !dadosDoOrcamento.idorcamento) {
//                 try {
//                     let responseExpandida = await fetchComToken('/staff/orcamento/consultar', {
//                         method: 'POST',
//                         headers: { 'Content-Type': 'application/json' },
//                         body: JSON.stringify({ ...criteriosDeBusca, ignorarFiltroData: true })
//                     });
//                     dadosDoOrcamento = Array.isArray(responseExpandida) ? responseExpandida[0] : responseExpandida;
//                 } catch (err) { 
//                     console.error("❌ Busca expandida falhou."); 
//                 }
//             }
//         }

//         // 🛡️ Validação definitiva de existência do Orçamento
//         if (!dadosDoOrcamento || !dadosDoOrcamento.idorcamento) {
//             console.warn("⚠️ Orçamento retornado é inválido ou nulo:", dadosDoOrcamento);
//             temOrcamento = false;
//             controlarBotaoSalvarStaff(false); 
            
//             // Só exibe alerta se NÃO for para rodar de modo silencioso
//             if (!ignorarModalVisivel) {
//                 Swal.fire({ 
//                     icon: 'warning', 
//                     title: 'Orçamento não localizado', 
//                     text: 'Não existe planejamento para esta função nos critérios selecionados.' 
//                 });
//             }
//             return; 
//         }

//         if (!orcamentoBase) {
//             orcamentoBase = dadosDoOrcamento;
//         }
        
//         console.log("DEBUG ORÇAMENTO LOCALIZADO:", orcamentoBase);

//         window.orcamentoPorFuncao = window.orcamentoPorFuncao || {};
//         const nmEventoMemo = (orcamentoBase.nmevento || '').trim().toUpperCase();
//         const nmFuncaoMemo = (orcamentoBase.descfuncao || orcamentoBase.nmfuncao || '').trim().toUpperCase();
        
//         const chaveMemo = `${nmEventoMemo}-${nmFuncaoMemo}`;

//         if (chaveMemo && chaveMemo !== '-') {
//             window.orcamentoPorFuncao[chaveMemo] = {
//                 idorcamento: orcamentoBase.idorcamento,
//                 idOrcamento: orcamentoBase.idorcamento,
//                 quantidade_orcada: Number(orcamentoBase.quantidade_orcada || 0),
//                 quantidadeOrcada: Number(orcamentoBase.quantidade_orcada || 0),
//                 quantidade_escalada: Number(orcamentoBase.quantidade_escalada || 0),
//                 diarias_escaladas: Number(orcamentoBase.diarias_escaladas || 0),
//                 datasOrcadas: orcamentoBase.datas_totais_orcadas || [],
//                 itensOrcamentoDetail: orcamentoBase.itensOrcamentoDetail || []
//             };
//             console.log(`✅ Memória populada: ${chaveMemo}`, window.orcamentoPorFuncao[chaveMemo]);
//         }

//         idOrcamentoAtual = orcamentoBase.idorcamento;

//         // 🛑 [PONTO DE CORREÇÃO] Se o modo silencioso estiver ativo, para a execução aqui!
//         // O cache global e as variáveis já estão prontas para a 'verificarLimiteDeFuncao' reassumir e validar.
//         if (ignorarModalVisivel) {
//             console.log("🤫 [buscarEPopularOrcamento] Modo silencioso ativo. Cache populado com sucesso, pulando Seção Visual.");
//             temOrcamento = true;
//             controlarBotaoSalvarStaff(true);
//             return dadosDoOrcamento;
//         }

//         const idStaffExistente = document.getElementById('idStaff')?.value;
//         const datasOriginais = (window.datasOriginaisCarregadas || []).slice().sort().join(',');
//         const datasAtuais = (datasEvento || []).slice().sort().join(',');
//         const datasNaoMudaram = datasOriginais === datasAtuais;

//         if (isFormLoadedFromDoubleClick && datasNaoMudaram && idStaffExistente && idStaffExistente !== "") {
//             console.log("ℹ️ Carregamento de dados detectado. Pulando validações de divergência.");
//             temOrcamento = true;
//             controlarBotaoSalvarStaff(true);
//             return dadosDoOrcamento;
//         }

//         // --- 1. CÁLCULOS DE VAGAS E DIÁRIAS (AJUSTADO VIA DEBUG) ---
//         const q_orcada = Number(orcamentoBase.quantidade_orcada || 0);
//         const q_escalada = Number(orcamentoBase.quantidade_escalada || 0);

//         const d_orcadas = Array.isArray(orcamentoBase.datas_totais_orcadas) 
//             ? orcamentoBase.datas_totais_orcadas.length 
//             : 0;

//         const d_escaladas = Number(orcamentoBase.diarias_escaladas || 0);
//         const datasSolicitadasArray = Array.isArray(datasEvento) ? datasEvento : [];
//         const d_solicitadas = datasSolicitadasArray.length;

//         if (d_solicitadas === 0) {
//             temOrcamento = true;
//             controlarBotaoSalvarStaff(true);
//             return dadosDoOrcamento;
//         }

//         const ultrapassouVagas = !idStaffExistente && (q_escalada + 1) > q_orcada;

//         const d_escaladas_sem_este = idStaffExistente 
//             ? Math.max(0, d_escaladas - (window.datasOriginaisCarregadas?.length || 0))
//             : d_escaladas;

//         const ultrapassouDiarias = q_orcada > 0 && (d_escaladas_sem_este + d_solicitadas) > q_orcada;

//         const d_utilizadas_exibir = d_escaladas;
//         const d_apos_inclusao_exibir = idStaffExistente
//             ? d_escaladas_sem_este + d_solicitadas
//             : d_escaladas + d_solicitadas;

//         const excedenteDiarias = ultrapassouDiarias 
//             ? Math.abs(q_orcada - (d_escaladas_sem_este + d_solicitadas)) 
//             : 0;

//         const excedenteVagas = ultrapassouVagas ? Math.abs(q_orcada - (q_escalada + 1)) : 0;

//         const datasOriginaisArray = (orcamentoBase.datas_totais_orcadas || []).map(d => d.includes('T') ? d.split('T')[0] : d);
//         const datasForaDoPlanejado = datasSolicitadasArray.filter(d => !new Set(datasOriginaisArray).has(d));
//         const temDataFora = datasForaDoPlanejado.length > 0;

//         // --- 2. MARGEM DE TOLERÂNCIA ---
//         let dentroDaMargem = true;
//         if (temDataFora && datasOriginaisArray.length > 0) {
//             const datasBaseDates = datasOriginaisArray.map(d => new Date(d + 'T00:00:00'));
//             const minDataOrig = new Date(Math.min(...datasBaseDates));
//             const maxDataOrig = new Date(Math.max(...datasBaseDates));
//             const margemInicio = new Date(minDataOrig); margemInicio.setMonth(margemInicio.getMonth() - 1);
//             const margemFim = new Date(maxDataOrig); margemFim.setMonth(margemFim.getMonth() + 1);

//             const datasMuitoFora = datasSolicitadasArray.filter(d => {
//                 const dt = new Date(d + 'T00:00:00');
//                 return dt < margemInicio || dt > margemFim;
//             });
//             if (datasMuitoFora.length > 0) dentroDaMargem = false;
//         }

//         console.log("🚦 [RESULTADOS DAS VERIFICAÇÕES]", {
//             ultrapassouVagas,
//             ultrapassouDiarias,
//             dentroDaMargem,
//             temDataFora,
//             bEhDiariaDobrada
//         });

//         // --- 3. LIBERAÇÃO AUTOMÁTICA ---
//         if (!bEhDiariaDobrada && !temDataFora && !ultrapassouVagas && !ultrapassouDiarias) {
//             temOrcamento = true;
//             controlarBotaoSalvarStaff(true);
//             return dadosDoOrcamento;
//         }

//         // --- 4. VERIFICAÇÃO DE AUTORIZAÇÃO PRÉVIA ---
//         const descFuncaoSelect = document.getElementById('descFuncao');
//         const funcaoTexto = descFuncaoSelect?.options[descFuncaoSelect.selectedIndex]?.text || "";
//         const checkData = await verificarStatusAditivoExtra(
//             idOrcamentoAtual, idFuncao, 
//             "ADITIVO - DATA FORA DO ORÇAMENTO,EXTRA BONIFICADO - DATA FORA DO ORÇAMENTO,ADITIVO - VAGA EXCEDIDA,EXTRA BONIFICADO - VAGA EXCEDIDA", 
//             idFuncionario, nmFuncionario, funcaoTexto, datasForaDoPlanejado[0] ?? null, 
//             idEvento,                  
//             null,                      
//             []                         
//         );

//         if (checkData?.autorizado) {
//             temOrcamento = true;
//             controlarBotaoSalvarStaff(true);
//             return dadosDoOrcamento;
//         }
//         if (checkData?.bloqueado) {
//             controlarBotaoSalvarStaff(false);
//             return;
//         }

//         // --- 5. DASHBOARD E MODAL ---
//         const datasFormatadasBR = datasForaDoPlanejado.map(d => d.split('-').reverse().join('/')).join(', ');

//         const htmlDashboard = `
//             <div style="text-align: left; font-size: 0.9rem; background: #f8f9fa; padding: 12px; border-radius: 8px; border: 1px solid #dee2e6; margin-bottom: 15px;">
//                 <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
//                     <span>Diárias já utilizadas:</span>
//                     <span style="font-weight:bold;">${d_utilizadas_exibir}</span>
//                 </div>
//                 <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
//                     <span>Diárias solicitadas agora:</span>
//                     <span style="font-weight:bold;">${d_solicitadas}</span>
//                 </div>
//                 <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
//                     <span>Total após inclusão:</span>
//                     <span style="font-weight:bold; color: ${ultrapassouDiarias ? '#dc3545' : '#28a745'}">
//                         ${d_apos_inclusao_exibir} de ${q_orcada} orçadas
//                     </span>
//                 </div>
//                 ${temDataFora ? `
//                 <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
//                     <span>Datas fora do período:</span>
//                     <span style="font-weight:bold; color: #dc3545">${datasFormatadasBR}</span>
//                 </div>` : ''}
//                 <div style="display: flex; justify-content: space-between; border-top: 1px solid #ddd; padding-top: 8px; margin-top: 4px; font-weight: bold;">
//                     <span>Situação:</span>
//                     <span style="color: ${(ultrapassouVagas || ultrapassouDiarias) ? '#dc3545' : '#e6a817'}">
//                         ${ultrapassouDiarias 
//                             ? `⛔ Limite excedido em ${excedenteDiarias} diária(s)` 
//                             : ultrapassouVagas 
//                                 ? `⛔ Vagas esgotadas` 
//                                 : `⚠️ Data fora do período planejado`}
//                     </span>
//                 </div>
//             </div>
//         `;

//         let swalOptions = {
//             icon: 'warning',
//             title: 'Divergência com o Orçamento',
//             showCancelButton: true,
//             showDenyButton: true,
//             confirmButtonText: 'Solicitar Aditivo',
//             denyButtonText: 'Extra Bonificado',
//             cancelButtonText: 'Corrigir dados',
//             confirmButtonColor: '#28a745',
//             denyButtonColor: '#17a2b8',
//             allowOutsideClick: false,
//             allowEscapeKey: false,
//             html: htmlDashboard
//         };

//         if (bEhDiariaDobrada) {
//             swalOptions.html = `
//                 <div style="color: #856404; background-color: #fff3cd; border: 1px solid #ffeeba; padding: 10px; border-radius: 5px; font-size: 0.85rem; text-align:left; margin-bottom: 15px;">
//                     ⚠️ <b>Atenção:</b> Este lançamento foi identificado como <b>Diária Dobrada</b>. 
//                     Selecione uma das opções abaixo para classificar a exceção no orçamento.
//                 </div>
//             ` + htmlDashboard;
//             swalOptions.footer = ''; 
//         } else {
//             const podeProsseguirSem = temDataFora && dentroDaMargem && !ultrapassouVagas && !ultrapassouDiarias;

//             if (podeProsseguirSem) {
//                 swalOptions.html += `
//                     <div style="color: #856404; background-color: #fff3cd; border: 1px solid #ffeeba; padding: 10px; border-radius: 5px; font-size: 0.85rem; text-align:left;">
//                         As datas <b>${datasFormatadasBR}</b> não estão no orçamento, mas estão dentro da margem permitida de 30 dias.
//                     </div>
//                     <p style="margin-top:15px;">Deseja registrar como exceção ou apenas prosseguir?</p>
//                 `;
//                 swalOptions.footer = '<button id="btnProsseguirSem" class="swal2-confirm swal2-styled" style="background-color: #6e7881; border:none; border-radius: 5px; color: white; padding: 10px 15px; cursor: pointer; width: 400px; text-align:center;">Prosseguir Sem Solicitação</button>';
//             } else {
//                 let msgErro = "";
//                 if (ultrapassouDiarias) msgErro = `Limite de Diárias excedido (${q_orcada} orçadas).`;
//                 else if (ultrapassouVagas) msgErro = `Limite de vagas excedido.`;
//                 else msgErro = `Datas (<b>${datasFormatadasBR}</b>) fora da margem permitida.`;

//                 swalOptions.html += `
//                     <div style="color: #721c24; background-color: #f8d7da; border: 1px solid #f5c6cb; padding: 10px; border-radius: 5px; font-size: 0.85rem; text-align:left;">
//                         🛑 <b>Bloqueio:</b> ${msgErro}
//                     </div>
//                     <p style="margin-top:15px;">Uma autorização é obrigatória para salvar.</p>
//                 `;
//                 swalOptions.footer = ''; 
//             }

//             if (podeProsseguirSem) {
//                 swalOptions.didOpen = () => {
//                     const btnFooter = document.getElementById('btnProsseguirSem');
//                     if (btnFooter) {
//                         btnFooter.onclick = () => {
//                             prosseguirSemSolicitacao = true;
//                             Swal.clickConfirm();
//                         };
//                     }
//                 };
//             }
//         }

//         const result = await Swal.fire(swalOptions);

//         if (result.dismiss === Swal.DismissReason.cancel) {
//             const inputData = document.getElementById('datasEvento'); 
//             if (inputData && inputData._flatpickr) {
//                 const fp = inputData._flatpickr;
//                 const setFora = new Set(datasForaDoPlanejado);
//                 const datasCorrigidas = fp.selectedDates.filter(date => {
//                     const dataISO = date.toISOString().split('T')[0];
//                     return !setFora.has(dataISO);
//                 });
//                 fp.setDate(datasCorrigidas, true);
//                 console.log("✅ Calendário corrigido. Datas removidas:", datasForaDoPlanejado);
//             }
//         }

//         if (prosseguirSemSolicitacao) {
//             const elObs = document.getElementById('obsgeral');
//             if (elObs) {
//                 const periodoOriginalBR = datasOriginaisArray.map(d => d.split('-').reverse().join('/')).join(', ');
//                 const logHist = `\n[HISTÓRICO] Período planejado: ${periodoOriginalBR}. Registrado em: ${datasFormatadasBR} por margem de tolerância. Por: ${nomeUsuarioLogado}.`;
//                 elObs.value = (elObs.value + logHist).trim();
//             }
//             temOrcamento = true;
//             controlarBotaoSalvarStaff(true);
//             return dadosDoOrcamento;
//         }

//         if (result.isConfirmed || result.isDenied) {
//             const baseTipo = result.isConfirmed ? 'Aditivo' : 'Extra Bonificado';
//             const motivo = (ultrapassouVagas || ultrapassouDiarias) ? 'Vaga Excedida' : 'Datas fora do Orçamento';
//             const tipoFinal = `${baseTipo} - ${motivo}`;

//             let datasParaSolicitacao = [];

//             if (temDataFora) {
//                 datasParaSolicitacao = datasForaDoPlanejado;
//             } else if (ultrapassouDiarias || ultrapassouVagas) {
//                 datasParaSolicitacao = [datasSolicitadasArray[datasSolicitadasArray.length - 1]];
//             } 

//             if (datasParaSolicitacao.length === 0) {
//                 datasParaSolicitacao = datasSolicitadasArray;
//             }

//             console.log("DEBUG ANTES DE ENVIAR:", { tipoFinal, datasParaSolicitacao });

//             const resEx = await solicitarDadosExcecao(tipoFinal, idOrcamentoAtual, funcaoTexto, idFuncao, idFuncionario, datasParaSolicitacao);

//             if (resEx?.confirmado) {
//                 window.tipoExcecaoAtual = tipoFinal;
//                 window.justificativaParaSalvar = resEx.justificativa;
//                 window.datasParaSalvarNoBanco = resEx.dataConflito;
//                 window.bSalvarComoInativo = true;
//                 if (document.getElementById('tipoSolicitacaoAditivo')) document.getElementById('tipoSolicitacaoAditivo').value = tipoFinal;
//                 if (document.getElementById('justificativaAditivo')) document.getElementById('justificativaAditivo').value = resEx.justificativa;
//                 temOrcamento = true;
//                 controlarBotaoSalvarStaff(true);
//             } else {
//                 controlarBotaoSalvarStaff(false);
//             }
//         } else {
//             controlarBotaoSalvarStaff(false);
//         }

//         return dadosDoOrcamento;
//     } catch (error) {
//         console.error("❌ [CRÍTICO] Erro em buscarEPopularOrcamento:", error);
//         controlarBotaoSalvarStaff(false);
//     }
// }


async function buscarEPopularOrcamento(idEvento, idCliente, idLocalMontagem, idFuncao, datasEvento, bEhDiariaDobrada = false, ignorarModalVisivel = false) {
    try {
        console.log("🚀 [INÍCIO] buscarEPopularOrcamento", { idEvento, idCliente, idLocalMontagem, idFuncao, datasEvento, bEhDiariaDobrada, ignorarModalVisivel });

        let orcamentoBase = null;
        const idFuncionario = document.getElementById('idFuncionario')?.value;
        const selectFunc = document.getElementById('nmFuncionario');
        const nmFuncionario = selectFunc?.options[selectFunc.selectedIndex]?.text || "Funcionário não identificado";
        const elInputSetor = document.getElementById('setor');
        const setorAtual = elInputSetor ? elInputSetor.value.trim() : null;
        const nomeUsuarioLogado = window.usuarioLogadoNome || "Sistema";

        // Limpeza de estados
        if (document.getElementById('tipoSolicitacaoAditivo')) document.getElementById('tipoSolicitacaoAditivo').value = '';
        if (document.getElementById('justificativaAditivo')) document.getElementById('justificativaAditivo').value = '';
        window.tipoExcecaoAtual = null;
        window.justificativaParaSalvar = null;
        window.bSalvarComoInativo = false;

        const criteriosDeBusca = { idEvento, idCliente, idLocalMontagem, idFuncao, setor: setorAtual, datasEvento: datasEvento || [] };

        let dadosDoOrcamento;

        // 🔀 NOVA REGRA DA DIÁRIA DOBRADA (Preservada com sucesso!)
        if (bEhDiariaDobrada) {
            console.log("🔄 [DIÁRIA DOBRADA DETECTADA] Buscando vagas consolidadas em /orcamento/vagas-disponiveis");
            try {
                const responseVagas = await fetchComToken('/staff/orcamento/vagas-disponiveis', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        idOrcamento: window.idOrcamentoAtual || null,
                        idEvento,
                        idCliente,
                        idLocalMontagem
                    })
                });

                if (responseVagas && responseVagas.ok) {
                    const dadosVagasMacro = await responseVagas.json();
                    
                    // Encontra os dados específicos desta função no retorno macro
                    orcamentoBase = dadosVagasMacro.find(item => Number(item.idfuncao) === Number(idFuncao));
                    
                    // Se achou, simula a estrutura que o restante do código espera para não quebrar nada
                    if (orcamentoBase) {
                        dadosDoOrcamento = [{
                            idorcamento: orcamentoBase.idorcamento,
                            nmevento: orcamentoBase.nmevento || '',
                            descfuncao: orcamentoBase.descfuncao || '',
                            quantidade_orcada: orcamentoBase.quantidade_orcada,
                            quantidade_escalada: orcamentoBase.quantidade_escalada,
                            diarias_escaladas: orcamentoBase.diarias_escaladas,
                            datas_totais_orcadas: orcamentoBase.datas_totais_orcadas || []
                        }];
                    }
                }
            } catch (errVagas) {
                console.error("❌ Falha ao buscar dados em /orcamento/vagas-disponiveis. Tentando fallback...", errVagas);
            }
        }

        // ℹ️ Se NÃO for Diária Dobrada, roda o fluxo tradicional consultando a nova API estruturada:
        if (!dadosDoOrcamento) {
            try {
                let response = await fetchComToken('/staff/orcamento/consultar', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(criteriosDeBusca)
                });
                
                dadosDoOrcamento = Array.isArray(response) ? response[0] : response;
            } catch (e) { 
                dadosDoOrcamento = null; 
            }

            // Se falhou ou retornou vazio, tenta a busca expandida ignorando filtros de data
            if (!dadosDoOrcamento || !dadosDoOrcamento.idorcamento) {
                try {
                    let responseExpandida = await fetchComToken('/staff/orcamento/consultar', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ...criteriosDeBusca, ignorarFiltroData: true })
                    });
                    dadosDoOrcamento = Array.isArray(responseExpandida) ? responseExpandida[0] : responseExpandida;
                } catch (err) { 
                    console.error("❌ Busca expandida falhou."); 
                }
            }
        }

        // 🛡️ Validação definitiva de existência do Orçamento
        if (!dadosDoOrcamento || !dadosDoOrcamento.idorcamento) {
            console.warn("⚠️ Orçamento retornado é inválido ou nulo:", dadosDoOrcamento);
            temOrcamento = false;
            controlarBotaoSalvarStaff(false); 
            
            // Só exibe alerta se NÃO for para rodar de modo silencioso
            if (!ignorarModalVisivel) {
                Swal.fire({ 
                    icon: 'warning', 
                    title: 'Orçamento não localizado', 
                    text: 'Não existe planejamento para esta função nos critérios selecionados.' 
                });
            }
            return; 
        }

        if (!orcamentoBase) {
            orcamentoBase = dadosDoOrcamento;
        }
        
        console.log("DEBUG ORÇAMENTO LOCALIZADO:", orcamentoBase);

        window.orcamentoPorFuncao = window.orcamentoPorFuncao || {};
        const nmEventoMemo = (orcamentoBase.nmevento || '').trim().toUpperCase();
        const nmFuncaoMemo = (orcamentoBase.descfuncao || orcamentoBase.nmfuncao || '').trim().toUpperCase();
        
        const chaveMemo = `${nmEventoMemo}-${nmFuncaoMemo}`;

        if (chaveMemo && chaveMemo !== '-') {
            window.orcamentoPorFuncao[chaveMemo] = {
                idorcamento: orcamentoBase.idorcamento,
                idOrcamento: orcamentoBase.idorcamento,
                quantidade_orcada: Number(orcamentoBase.quantidade_orcada || 0),
                quantidadeOrcada: Number(orcamentoBase.quantidade_orcada || 0),
                quantidade_escalada: Number(orcamentoBase.quantidade_escalada || 0),
                diarias_escaladas: Number(orcamentoBase.diarias_escaladas || 0),
                datasOrcadas: orcamentoBase.datas_totais_orcadas || [],
                itensOrcamentoDetail: orcamentoBase.itensOrcamentoDetail || []
            };
            console.log(`✅ Memória populada: ${chaveMemo}`, window.orcamentoPorFuncao[chaveMemo]);
        }

        idOrcamentoAtual = orcamentoBase.idorcamento;

        // 🛑 [PONTO DE CORREÇÃO] Se o modo silencioso estiver ativo, para a execução aqui!
        if (ignorarModalVisivel) {
            console.log("🤫 [buscarEPopularOrcamento] Modo silencioso ativo. Cache populado com sucesso, pulando Seção Visual.");
            temOrcamento = true;
            controlarBotaoSalvarStaff(true);
            return dadosDoOrcamento;
        }

        const idStaffExistente = document.getElementById('idStaff')?.value;
        const datasOriginais = (window.datasOriginaisCarregadas || []).slice().sort().join(',');
        const datasAtuais = (datasEvento || []).slice().sort().join(',');
        const datasNaoMudaram = datasOriginais === datasAtuais;

        if (isFormLoadedFromDoubleClick && datasNaoMudaram && idStaffExistente && idStaffExistente !== "") {
            console.log("ℹ️ Carregamento de dados detectado. Pulando validações de divergência.");
            temOrcamento = true;
            controlarBotaoSalvarStaff(true);
            return dadosDoOrcamento;
        }

        // --- 1. CÁLCULOS DE VAGAS E DIÁRIAS (AJUSTADO VIA DEBUG) ---
        const q_orcada = Number(orcamentoBase.quantidade_orcada || 0);
        const q_escalada = Number(orcamentoBase.quantidade_escalada || 0);

        const d_orcadas = Array.isArray(orcamentoBase.datas_totais_orcadas) 
            ? orcamentoBase.datas_totais_orcadas.length 
            : 0;

        const d_escaladas = Number(orcamentoBase.diarias_escaladas || 0);
        const datasSolicitadasArray = Array.isArray(datasEvento) ? datasEvento : [];
        const d_solicitadas = datasSolicitadasArray.length;

        if (d_solicitadas === 0) {
            temOrcamento = true;
            controlarBotaoSalvarStaff(true);
            return dadosDoOrcamento;
        }

        const ultrapassouVagas = !idStaffExistente && (q_escalada + 1) > q_orcada;

        const d_escaladas_sem_este = idStaffExistente 
            ? Math.max(0, d_escaladas - (window.datasOriginaisCarregadas?.length || 0))
            : d_escaladas;

        const ultrapassouDiarias = q_orcada > 0 && (d_escaladas_sem_este + d_solicitadas) > q_orcada;

        const d_utilizadas_exibir = d_escaladas;
        const d_apos_inclusao_exibir = idStaffExistente
            ? d_escaladas_sem_este + d_solicitadas
            : d_escaladas + d_solicitadas;

        const excedenteDiarias = ultrapassouDiarias 
            ? Math.abs(q_orcada - (d_escaladas_sem_este + d_solicitadas)) 
            : 0;

        const excedenteVagas = ultrapassouVagas ? Math.abs(q_orcada - (q_escalada + 1)) : 0;

        const datasOriginaisArray = (orcamentoBase.datas_totais_orcadas || []).map(d => d.includes('T') ? d.split('T')[0] : d);
        const datasForaDoPlanejado = datasSolicitadasArray.filter(d => !new Set(datasOriginaisArray).has(d));
        const temDataFora = datasForaDoPlanejado.length > 0;

        // --- 2. MARGEM DE TOLERÂNCIA ---
        let dentroDaMargem = true;
        if (temDataFora && datasOriginaisArray.length > 0) {
            const datasBaseDates = datasOriginaisArray.map(d => new Date(d + 'T00:00:00'));
            const minDataOrig = new Date(Math.min(...datasBaseDates));
            const maxDataOrig = new Date(Math.max(...datasBaseDates));
            const margemInicio = new Date(minDataOrig); margemInicio.setMonth(margemInicio.getMonth() - 1);
            const margemFim = new Date(maxDataOrig); margemFim.setMonth(margemFim.getMonth() + 1);

            const datasMuitoFora = datasSolicitadasArray.filter(d => {
                const dt = new Date(d + 'T00:00:00');
                return dt < margemInicio || dt > margemFim;
            });
            if (datasMuitoFora.length > 0) dentroDaMargem = false;
        }

        console.log("🚦 [RESULTADOS DAS VERIFICAÇÕES]", {
            ultrapassouVagas,
            ultrapassouDiarias,
            dentroDaMargem,
            temDataFora,
            bEhDiariaDobrada
        });

        // --- 3. LIBERAÇÃO AUTOMÁTICA ---
        if (!bEhDiariaDobrada && !temDataFora && !ultrapassouVagas && !ultrapassouDiarias) {
            temOrcamento = true;
            controlarBotaoSalvarStaff(true);
            return dadosDoOrcamento;
        }

        // --- 4. VERIFICAÇÃO DE AUTORIZAÇÃO PRÉVIA ---
        const descFuncaoSelect = document.getElementById('descFuncao');
        const funcaoTexto = descFuncaoSelect?.options[descFuncaoSelect.selectedIndex]?.text || "";
        const checkData = await verificarStatusAditivoExtra(
            idOrcamentoAtual, idFuncao, 
            "ADITIVO - DATA FORA DO ORÇAMENTO,EXTRA BONIFICADO - DATA FORA DO ORÇAMENTO,ADITIVO - VAGA EXCEDIDA,EXTRA BONIFICADO - VAGA EXCEDIDA", 
            idFuncionario, nmFuncionario, funcaoTexto, datasForaDoPlanejado[0] ?? null, 
            idEvento,                  
            null,                      
            []                         
        );

        if (checkData?.autorizado) {
            temOrcamento = true;
            controlarBotaoSalvarStaff(true);
            return dadosDoOrcamento;
        }
        if (checkData?.bloqueado) {
            controlarBotaoSalvarStaff(false);
            return;
        }

        // --- 5. DASHBOARD E MODAL ---
        const datasFormatadasBR = datasForaDoPlanejado.map(d => d.split('-').reverse().join('/')).join(', ');

        const htmlDashboard = `
            <div style="text-align: left; font-size: 0.9rem; background: #f8f9fa; padding: 12px; border-radius: 8px; border: 1px solid #dee2e6; margin-bottom: 15px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span>Diárias já utilizadas:</span>
                    <span style="font-weight:bold;">${d_utilizadas_exibir}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span>Diárias solicitadas agora:</span>
                    <span style="font-weight:bold;">${d_solicitadas}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span>Total após inclusão:</span>
                    <span style="font-weight:bold; color: ${ultrapassouDiarias ? '#dc3545' : '#28a745'}">
                        ${d_apos_inclusao_exibir} de ${q_orcada} orçadas
                    </span>
                </div>
                ${temDataFora ? `
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span>Datas fora do período:</span>
                    <span style="font-weight:bold; color: #dc3545">${datasFormatadasBR}</span>
                </div>` : ''}
                <div style="display: flex; justify-content: space-between; border-top: 1px solid #ddd; padding-top: 8px; margin-top: 4px; font-weight: bold;">
                    <span>Situação:</span>
                    <span style="color: ${(ultrapassouVagas || ultrapassouDiarias) ? '#dc3545' : '#e6a817'}">
                        ${ultrapassouDiarias 
                            ? `⛔ Limite excedido em ${excedenteDiarias} diária(s)` 
                            : ultrapassouVagas 
                                ? `⛔ Vagas esgotadas` 
                                : `⚠️ Data fora do período planejado`}
                    </span>
                </div>
            </div>
        `;

        let swalOptions = {
            icon: 'warning',
            title: 'Divergência com o Orçamento',
            showCancelButton: true,
            showDenyButton: true,
            confirmButtonText: 'Solicitar Aditivo',
            denyButtonText: 'Extra Bonificado',
            cancelButtonText: 'Corrigir dados',
            confirmButtonColor: '#28a745',
            denyButtonColor: '#17a2b8',
            html: htmlDashboard
        };

        if (bEhDiariaDobrada) {
            swalOptions.html = `
                <div style="color: #856404; background-color: #fff3cd; border: 1px solid #ffeeba; padding: 10px; border-radius: 5px; font-size: 0.85rem; text-align:left; margin-bottom: 15px;">
                    ⚠️ <b>Atenção:</b> Este lançamento foi identificado como <b>Diária Dobrada</b>. 
                    Selecione uma das opções abaixo para classificar a exceção no orçamento.
                </div>
            ` + htmlDashboard;
            swalOptions.footer = ''; 
        } else {
            const podeProsseguirSem = temDataFora && dentroDaMargem && !ultrapassouVagas && !ultrapassouDiarias;

            if (podeProsseguirSem) {
                swalOptions.html += `
                    <div style="color: #856404; background-color: #fff3cd; border: 1px solid #ffeeba; padding: 10px; border-radius: 5px; font-size: 0.85rem; text-align:left;">
                        As datas <b>${datasFormatadasBR}</b> não estão no orçamento, mas estão dentro da margem permitida de 30 dias.
                    </div>
                    <p style="margin-top:15px;">Deseja registrar como exceção ou apenas prosseguir?</p>
                `;
                swalOptions.footer = '<button id="btnProsseguirSem" class="swal2-confirm swal2-styled" style="background-color: #6e7881; border:none; border-radius: 5px; color: white; padding: 10px 15px; cursor: pointer; width: 400px; text-align:center;">Prosseguir Sem Solicitação</button>';
            } else {
                let msgErro = "";
                if (ultrapassouDiarias) msgErro = `Limite de Diárias excedido (${q_orcada} orçadas).`;
                else if (ultrapassouVagas) msgErro = `Limite de vagas excedido.`;
                else msgErro = `Datas (<b>${datasFormatadasBR}</b>) fora da margem permitida.`;

                swalOptions.html += `
                    <div style="color: #721c24; background-color: #f8d7da; border: 1px solid #f5c6cb; padding: 10px; border-radius: 5px; font-size: 0.85rem; text-align:left;">
                        🛑 <b>Bloqueio:</b> ${msgErro}
                    </div>
                    <p style="margin-top:15px;">Uma autorização é obrigatória para salvar.</p>
                `;
                swalOptions.footer = ''; 
            }

            if (podeProsseguirSem) {
                swalOptions.didOpen = () => {
                    const btnFooter = document.getElementById('btnProsseguirSem');
                    if (btnFooter) {
                        btnFooter.onclick = () => {
                            prosseguirSemSolicitacao = true;
                            Swal.clickConfirm();
                        };
                    }
                };
            }
        }

       const result = await Swal.fire(swalOptions);

        if (result.dismiss === Swal.DismissReason.cancel) {
            const inputData = document.getElementById('datasEvento'); 
            if (inputData && inputData._flatpickr) {
                const fp = inputData._flatpickr;
                const setFora = new Set(datasForaDoPlanejado);
                const datasCorrigidas = fp.selectedDates.filter(date => {
                    const dataISO = date.toISOString().split('T')[0];
                    return !setFora.has(dataISO);
                });
                fp.setDate(datasCorrigidas, true);
                console.log("✅ Calendário corrigido. Datas removidas:", datasForaDoPlanejado);
            }
        }

        let prosseguirSemSolicitacao = false;
        // O listener do botão de footer precisa ser anexado via delegate ou checado após o clique se for disparado pelo Swal
        // Mas a forma mais segura com SweetAlert2 é capturar o clique do elemento injetado:
        if (podeProsseguirSem) {
             const btnFooter = document.getElementById('btnProsseguirSem');
             if (btnFooter) {
                 btnFooter.onclick = () => {
                     prosseguirSemSolicitacao = true;
                     Swal.clickConfirm();
                 };
             }
        }

        if (prosseguirSemSolicitacao) {
            const elObs = document.getElementById('obsgeral');
            if (elObs) {
                const periodoOriginalBR = datasOriginaisArray.map(d => d.split('-').reverse().join('/')).join(', ');
                const logHist = `\n[HISTÓRICO] Período planejado: ${periodoOriginalBR}. Registrado em: ${datasFormatadasBR} por margem de tolerância. Por: ${nomeUsuarioLogado}.`;
                elObs.value = (elObs.value + logHist).trim();
            }
            temOrcamento = true;
            controlarBotaoSalvarStaff(true);
            return dadosDoOrcamento;
        }

        if (result.isConfirmed || result.isDenied) {
            const baseTipo = result.isConfirmed ? 'Aditivo' : 'Extra Bonificado';
            
            // 🎯 AJUSTE CIRÚRGICO: Se for Diária Dobrada ou estourou os limites normais, classifica rigidamente como 'Vaga Excedida'
            const motivo = (bEhDiariaDobrada || ultrapassouVagas || ultrapassouDiarias) ? 'Vaga Excedida' : 'Datas fora do Orçamento';
            const tipoFinal = `${baseTipo} - ${motivo}`;

            let datasParaSolicitacao = [];

            if (temDataFora) {
                datasParaSolicitacao = datasForaDoPlanejado;
            } else if (ultrapassouDiarias || ultrapassouVagas) {
                // Se o erro for apenas excesso de quantidade, mas as datas estão no orçamento,
                // enviamos a última data selecionada como o "ponto de conflito" 
                // ou o array completo, dependendo da sua preferência.
                // Para mostrar apenas a excedente:
                datasParaSolicitacao = [datasSolicitadasArray[datasSolicitadasArray.length - 1]];
            } else {
                datasParaSolicitacao = datasSolicitadasArray;
            }

            console.log("DEBUG ANTES DE ENVIAR:", { tipoFinal, datasParaSolicitacao });

            const resEx = await solicitarDadosExcecao(tipoFinal, idOrcamentoAtual, funcaoTexto, idFuncao, idFuncionario, datasParaSolicitacao);

            if (resEx?.confirmado) {
                window.tipoExcecaoAtual = tipoFinal;
                window.justificativaParaSalvar = resEx.justificativa;
                window.datasParaSalvarNoBanco = resEx.dataConflito;
                window.bSalvarComoInativo = true;
                if (document.getElementById('tipoSolicitacaoAditivo')) document.getElementById('tipoSolicitacaoAditivo').value = tipoFinal;
                if (document.getElementById('justificativaAditivo')) document.getElementById('justificativaAditivo').value = resEx.justificativa;
                temOrcamento = true;
                controlarBotaoSalvarStaff(true);
            } else {
                controlarBotaoSalvarStaff(false);
            }
        } else {
            controlarBotaoSalvarStaff(false);
        }

        return dadosDoOrcamento;
    } catch (error) {
        console.error("❌ [CRÍTICO] Erro em buscarEPopularOrcamento:", error);
        controlarBotaoSalvarStaff(false);
    }
}


function mostrarStatusComoPendente(statusType) {
    const statusTypeLower = statusType.toLowerCase(); // Ex: statusaditivo
    const containerId = `campo${statusType}`; // Ex: campoStatusAditivo
    const inputId = statusTypeLower; // Ex: statusaditivo
    const selectId = `select${statusType}`; // Ex: selectStatusAditivo

    const container = document.getElementById(containerId); 
    const input = document.getElementById(inputId); 
    const select = document.getElementById(selectId);

    if (container) {
        // 1. Torna o container visível
        container.style.display = 'block';

        // 2. Define o valor como 'Pendente' para o INPUT
        if (input) {
            input.value = 'Pendente';            
        }
        
        // 3. Define o valor como 'Pendente' para o SELECT (se visível/master)
        if (select) {
            select.value = 'Pendente';
        }
        
        // 4. Reaplica a permissão para garantir que o campo correto (input/select) apareça
        // Assumindo que window.permissoes está globalmente acessível
        if (window.permissoes) {
            alternarStatusPorPermissao(statusType, window.permissoes.master === true); 
        }
        
        console.log(`✅ Solicitação de ${statusType} registrada. Status: PENDENTE.`);
    }
}

function alternarStatusPorPermissao(baseId, temPermissaoMaster) {
    const campoInput = document.getElementById(baseId.toLowerCase());
    const campoSelect = document.getElementById(`select${baseId}`);
    const campoContainer = document.getElementById(`campo${baseId}`);
    const label = campoInput ? campoInput.nextElementSibling : null;

    // Somente alterna se o container estiver visível (ou seja, se houver uma solicitação PENDENTE)
    if (campoInput && campoSelect && campoContainer && campoContainer.style.display !== 'none') {

        if (temPermissaoMaster) { 
            // Usuário Master: mostra o SELECT
            campoInput.style.display = 'none';
            campoInput.removeAttribute('required');
            campoInput.removeAttribute('readonly'); // Master pode alterar o valor (via select)
            campoInput.removeAttribute('disabled'); // Master pode alterar o valor (via select)
            
            campoSelect.style.display = 'block';
            campoSelect.setAttribute('required', 'required');
            
            // Garante que o select carregue o valor atual
            if (campoInput.value) {
                campoSelect.value = campoInput.value;
            } else {
                campoSelect.value = 'none';
            }
            
            // Oculta a label do input
            if (label && label.tagName === 'LABEL') {
                label.style.display = 'none'; 
            }
            
        } else {
            
            // Outras Permissões: mostra o INPUT readonly
            campoInput.style.display = 'block';
            campoInput.setAttribute('required', 'required');
            
            // ⭐ GARANTIA DE EXIBIÇÃO DO VALOR: Adiciona readonly e remove disabled
            campoInput.setAttribute('readonly', 'readonly'); 
            campoInput.removeAttribute('disabled'); 
            
            campoSelect.style.display = 'none';
            campoSelect.removeAttribute('required');

            // AJUSTE DE EXIBIÇÃO: Altera o texto da label para mostrar o status
            if (label && label.tagName === 'LABEL') {
                const statusValue = campoInput.value || 'Pendente'; // Garante que Pendente será exibido
                const baseName = baseId.replace('Status', '').trim();
                
                label.textContent = `Status ${baseName} (${statusValue})`; 
                label.style.display = 'block'; 
            }
        }
    }
}

function controlarBotaoSalvarStaff(temOrcamento) {
    const btnSalvar = document.getElementById('Enviar'); // Use o ID correto do seu botão

    console.log("TEM ORCAMENTO", temOrcamento);

    if (btnSalvar?.getAttribute('data-bloqueado') === 'true') return;

    if (btnSalvar?.getAttribute('data-modo') === 'comprovante') return;

    if (btnSalvar) {
        if (temOrcamento) {
            btnSalvar.disabled = false;
            btnSalvar.textContent = 'Enviar'
            btnSalvar.title = 'Pronto para Salvar';
        } else {
            btnSalvar.disabled = true;
            btnSalvar.textContent = 'Não existe orçamento válido.'
            btnSalvar.title = 'É necessário ter um orçamento válido para salvar o Staff.'; 
        }
    }
}

/**
 * Renderiza dinamicamente as datas selecionadas com seus respectivos status,
 * apenas para usuários com permissão total.
 * @param {Array<Object>} datesArray - O array de objetos de data e status.
 * @param {string} containerId - O ID do contêiner onde os elementos serão inseridos.
 * @param {string} type - O tipo de diária ('dobrada' ou 'meia').
 */
// function renderDatesWithStatus(datesArray, containerId, type) {
//     const container = document.getElementById(containerId);
//     if (!container) return;

//     // Remove apenas os itens de data antigos, mantendo o label
//     const existingDates = container.querySelectorAll('.date-status-item');
//     existingDates.forEach(el => el.remove());

//     if (datesArray.length === 0) {
//         container.style.display = 'none';
//         return;
//     }

//     // Certifica-se que o contêiner pai está visível antes de renderizar
//     container.style.display = 'block';

//     datesArray.forEach(item => {
//         const formattedDate = item.data.split('-').reverse().join('/');

//         const dateElement = document.createElement('div');
//         dateElement.classList.add('date-status-item');

//         dateElement.innerHTML = `
//             <span>${formattedDate}:</span>
//             <select data-date="${item.data}" data-type="${type}" class="form-select status-select">
//                 <option value="Pendente" ${item.status === 'Pendente' ? 'selected' : ''}>Pendente</option>
//                 <option value="Autorizado" ${item.status === 'Autorizado' ? 'selected' : ''}>Autorizado</option>
//                 <option value="Rejeitado" ${item.status === 'Rejeitado' ? 'selected' : ''}>Rejeitado</option>
//             </select>
//         `;
//         container.appendChild(dateElement);

//         const select = dateElement.querySelector('select');
//         select.classList.add(`status-${item.status.toLowerCase()}`);

//         // select.addEventListener('change', (e) => {
//         //     const dateToUpdate = e.target.dataset.date;
//         //     const newStatus = e.target.value;

//         //     e.target.classList.remove('status-pendente', 'status-autorizado', 'status-rejeitado');
//         //     e.target.classList.add(`status-${newStatus.toLowerCase()}`);

//         //     const arrayToUpdate = type === 'dobrada' ? datasDobrada : datasMeiaDiaria;
//         //     const foundDate = arrayToUpdate.find(d => d.data === dateToUpdate);
//         //     if (foundDate) {
//         //         foundDate.status = newStatus;
//         //     }
//         // });
//         select.addEventListener('change', async function(e) {
//             console.log("%c 🚀 [RENDER_DATES] -> ENTROU NO CHANGE INDIVIDUAL", "color: white; background: #ff0077; font-weight: bold; padding: 4px; border-radius: 4px;");
//             const dateToUpdate = e.target.dataset.date;
//             const novoStatus = e.target.value;
//             const statusPgto = (window.statusPgtoCacheOriginalDoBanco || "").trim().toLowerCase();
            
//             // Referência para o textarea de log (Dobra ou Meia)
//             const inputDescLog = type === 'dobrada' ? 
//                 document.getElementById('descDiariaDobrada') : 
//                 document.getElementById('descMeiaDiaria');

//             // 🚩 TRAVA DE SEGURANÇA: Se o cachê estiver PAGO e o status mudou
//             if (statusPgto === "pago" && novoStatus !== statusOriginalItem) {
                
//                 const { value: justificativa } = await Swal.fire({
//                     title: '⚠️ Reversão em Data PAGA',
//                     html: `A data <b>${formattedDate}</b> faz parte de um cachê já <b>PAGO</b>.<br>` +
//                           `Alterar para <b>${novoStatus}</b> causará divergência no fechamento.`,
//                     input: 'textarea',
//                     inputLabel: 'Justificativa da alteração individual:',
//                     inputPlaceholder: 'Por que alterar esta data específica?',
//                     showCancelButton: true,
//                     confirmButtonText: 'Confirmar',
//                     cancelButtonColor: '#d33',
//                     inputValidator: (value) => { if (!value) return 'Justificativa obrigatória!'; }
//                 });

//                 if (justificativa) {
//                     const confirmacao = await Swal.fire({
//                         title: 'Confirmar Alteração?',
//                         text: "O valor total será recalculado na tela.",
//                         icon: 'warning',
//                         showCancelButton: true,
//                         confirmButtonText: 'Sim, aplicar'
//                     });

//                     if (confirmacao.isConfirmed) {
//                         processarMudancaStatusDiarias(e.target, type, dateToUpdate, novoStatus, justificativa, formattedDate, inputDescLog);
//                     } else {
//                         e.target.value = statusOriginalItem; // Volta para o que era
//                         atualizarClasseStatusDiarias(e.target, statusOriginalItem);
//                     }
//                 } else {
//                     e.target.value = statusOriginalItem;
//                     atualizarClasseStatus(e.target, statusOriginalItem);
//                 }
//             } else {
//                 // Fluxo normal (não pago ou mesma opção)
//                 processarMudancaStatusDiarias(e.target, type, dateToUpdate, novoStatus);
//             }
//         });
//     });
// }

function renderDatesWithStatus(datesArray, containerId, type) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const existingDates = container.querySelectorAll('.date-status-item');
    existingDates.forEach(el => el.remove());

    if (datesArray.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';

    datesArray.forEach(item => {
        const formattedDate = item.data.split('-').reverse().join('/');
        const statusOriginalItem = item.status; 

        const dateElement = document.createElement('div');
        dateElement.classList.add('date-status-item');

        dateElement.innerHTML = `
            <span>${formattedDate}:</span>
            <select data-date="${item.data}" data-type="${type}" class="form-select status-select status-${item.status.toLowerCase()}">
                <option value="Pendente" ${item.status === 'Pendente' ? 'selected' : ''}>Pendente</option>
                <option value="Autorizado" ${item.status === 'Autorizado' ? 'selected' : ''}>Autorizado</option>
                <option value="Rejeitado" ${item.status === 'Rejeitado' ? 'selected' : ''}>Rejeitado</option>
            </select>
        `;
        container.appendChild(dateElement);

        const select = dateElement.querySelector('select');

        select.addEventListener('change', async function(e) {
            console.log("%c 🚀 [RENDER_DATES] -> ENTROU NO CHANGE INDIVIDUAL", "color: white; background: #ff0077; font-weight: bold; padding: 4px; border-radius: 4px;");
            
            const targetSelect = e.target;
            const novoStatus = targetSelect.value;
            const dateToUpdate = targetSelect.dataset.date;
            const statusPgto = (window.statusPgtoCacheOriginalDoBanco || "").trim().toLowerCase();
            const statusPgtoAjuda = (window.statusPgtoAjudaOriginalDoBanco || "").trim().toLowerCase();
            const isPago = statusPgto === "pago" || statusPgtoAjuda === "pago";
            
            const arrayParaAtualizar = type === 'dobrada' ? datasDobrada : datasMeiaDiaria;
            const itemNoArray = arrayParaAtualizar.find(d => d.data === dateToUpdate);

        

            // 🚩 TRAVA DE SEGURANÇA: CACHÊ PAGO (Com o novo SWAL de 2 etapas)
            if (isPago && novoStatus !== statusOriginalItem) {
                let labelTexto = "";
                let htmlConteudo = "";
                const tipoDiaria = type === 'dobrada' ? 'Diária Dobrada' : 'Meia Diária';
                const labelVermelha = (texto) => `<span style="color: #ff0000; font-weight: bold;">${texto}</span>`;

                // CENÁRIO A: CACHÊ PAGO (CRÍTICO)
                if (statusPgto === "pago") {
                    labelTexto = statusPgtoAjuda === "pago" ? "Cachê e Ajuda de Custo PAGOS" : "Cachê PAGO";
                    
                    htmlConteudo = `<b>Alerta:</b> ${labelVermelha(labelTexto)}<br><br>` +
                        `A data <b>${formattedDate}</b> consta como <b>PAGA</b> no financeiro.<br><br>` +
                        `Mudar o status de <b>${statusOriginalItem}</b> para <b>${novoStatus}</b> alterará o valor total e gerará divergência no caixa.<br><br>` +
                        `A reversão impactará o fechamento financeiro. Dados alterados não irão bater com os dados pagos anteriormente.<br>` +
                        `Caso queira continuar, revise os valores no seu banco e insira novos comprovantes. Deseja continuar?`;
                } 
                // CENÁRIO B: APENAS AJUDA DE CUSTO PAGA (MODERADO)
                else {
                    labelTexto = "Ajuda de Custo PAGA";
                    
                    htmlConteudo = `<b>Alerta:</b> ${labelVermelha(labelTexto)}<br><br>` +
                        `A data <b>${formattedDate}</b> consta como vinculada a uma Ajuda de Custo já paga.<br><br>` +
                        `Mudar o status de <b>${statusOriginalItem}</b> para <b>${novoStatus}</b> alterará o valor total do cachê e o total geral.<br><br>` +
                        `Deseja continuar com esta alteração?`;
                }

                // ETAPA 1: Justificativa
                const { value: justificativa } = await Swal.fire({
                    title: `⚠️ Alterar Status de ${tipoDiaria}`,
                    html: htmlConteudo,
                    input: 'textarea',
                    inputLabel: 'Justificativa da alteração:',
                    inputPlaceholder: 'Por que alterar esta data específica?',
                    showCancelButton: true,
                    confirmButtonText: 'Próximo',
                    cancelButtonColor: '#d33',
                    inputValidator: (value) => { if (!value) return 'Justificativa obrigatória!'; }
                });

                if (justificativa) {
                    // ETAPA 2: Confirmação final
                    const confirmacao = await Swal.fire({
                        title: 'Confirmar Alteração?',
                        text: `O valor será ${novoStatus === 'Autorizado' ? 'somado' : 'removido'} do total.`,
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonText: 'Sim, aplicar'
                    });

                    if (confirmacao.isConfirmed) {
                        const dataHora = new Date().toLocaleString();
                        if (itemNoArray) itemNoArray.status = novoStatus;

                        const msgLog = `Alterar Status de ${tipoDiaria}: ${formattedDate} (${statusOriginalItem} -> ${novoStatus}) - Motivo: ${justificativa}`;
                        registrarLogPosPagamento(msgLog);
                        
                        const inputDescLog = type === 'dobrada' ? document.getElementById('descDiariaDobrada') : document.getElementById('descMeiaDiaria');
                        if (inputDescLog) {
                            inputDescLog.value += `\n[Status ${formattedDate} - ${dataHora}]: ${statusOriginalItem} -> ${novoStatus}. Motivo: ${justificativa}`;
                        }

                        targetSelect.classList.remove('status-pendente', 'status-autorizado', 'status-rejeitado');
                        targetSelect.classList.add(`status-${novoStatus.toLowerCase()}`);
                        if (typeof calcularValorTotal === 'function') calcularValorTotal();

                        Swal.fire({
                            title: 'Cálculo Atualizado!',
                            html: 'O total foi recalculado.<br><br><b>IMPORTANTE:</b> Clique no botão <b>ENVIAR</b> para gravar permanentemente.',
                            icon: 'warning',
                            confirmButtonText: 'Entendi'
                        });
                    } else {
                        reverterSelect(targetSelect, statusOriginalItem);
                    }
                } else {
                    reverterSelect(targetSelect, statusOriginalItem);
                }
            } else {
                // Fluxo Normal (Não pago)
                if (itemNoArray) itemNoArray.status = novoStatus;
                
                // Atualiza Cores e Soma
                targetSelect.classList.remove('status-pendente', 'status-autorizado', 'status-rejeitado');
                targetSelect.classList.add(`status-${novoStatus.toLowerCase()}`);
                if (typeof calcularValorTotal === 'function') calcularValorTotal();
            }
        });
    });
    function reverterSelect(selectEl, statusAnterior) {
        selectEl.value = statusAnterior
        selectEl.classList.remove('status-pendente', 'status-autorizado', 'status-rejeitado');
        selectEl.classList.add(`status-${statusAnterior.toLowerCase()}`);
    }
    
}





function processarMudancaStatusDiarias(novoStatus, type) {
    const isDobra = type === 'dobrada';
    const hiddenFieldId = isDobra ? "statusDiariaDobrada" : "statusMeiaDiaria";
    const globalVarName = isDobra ? "statusAnteriorDiariaDobrada" : "statusAnteriorMeiaDiaria";
    
    const hiddenField = document.getElementById(hiddenFieldId);
    const statusAnterior = window[globalVarName];
    
    const statusQueNaoSomam = ["Pendente", "Rejeitado", "none", "", null];

    // Se a mudança for irrelevante para o cálculo (ex: Pendente -> Rejeitado)
    if (statusQueNaoSomam.includes(statusAnterior) && statusQueNaoSomam.includes(novoStatus)) {
        if (hiddenField) hiddenField.value = novoStatus;
        window[globalVarName] = novoStatus;
        return; 
    }

    // Atualiza o estado mestre
    if (hiddenField) hiddenField.value = novoStatus;
    window[globalVarName] = novoStatus;

    // 🚩 IMPORTANTE: Não alteramos o 'datasArray' aqui.
    // O calcularValorTotal() deve ser inteligente o suficiente para:
    // Se o Select Geral for 'Rejeitado', ele ignora todas as datas.
    // Se o Select Geral for 'Autorizado', ele soma apenas as datas que também estão 'Autorizado' individualmente.

    if (typeof calcularValorTotal === 'function') {
        calcularValorTotal();
    }
}

function atualizarClasseStatus(element, status) {
    element.classList.remove('status-pendente', 'status-autorizado', 'status-rejeitado');
    element.classList.add(`status-${status.toLowerCase()}`);
}

function atualizarEstiloESoma(elemento, status) {
    elemento.classList.remove('status-pendente', 'status-autorizado', 'status-rejeitado');
    elemento.classList.add(`status-${status.toLowerCase()}`);
    if (typeof calcularValorTotal === 'function') {
        calcularValorTotal();
    }
}


function desinicializarStaffModal() {
    console.log("🧹 Desinicializando módulo Staff.js...");

    // Garante que a instância existe e a destrói.
    if (window.datasEventoPicker) {
        window.datasEventoPicker.destroy();
        window.datasEventoPicker = null; // Limpa a referência global
        console.log("Flatpickr para #datasEvento destruído.");
    }

    if (window.diariaDobradaPicker) {
        window.diariaDobradaPicker.destroy();
        window.diariaDobradaPicker = null; // Limpa a referência global
        console.log("Flatpickr para #diariaDobrada destruído.");
    }

    if (window.meiaDiariaPicker) {
        window.meiaDiariaPicker.destroy();
        window.meiaDiariaPicker = null; // Limpa a referência global
        console.log("Flatpickr para #meiaDiaria destruído.");
    }

    // 🛑 REMOVE AS CHAMADAS setDate() QUE ESTAVAM CAUSANDO O ERRO DE UNDEFINED
    // if (typeof datasEventoPicker !== 'undefined' && datasEventoPicker) { ... }
    // Essas chamadas não são mais necessárias, pois a instância foi destruída.
    
    // ----------------------------------------------------------------------
    // 3. Limpar o estado global e campos do formulário
    // ----------------------------------------------------------------------
    window.StaffOriginal = null;
    window.currentEditingStaffEvent = null;

    // Chama a limpeza de campos (agora que o Flatpickr não existe mais e não vai falhar)
    limparCamposStaff(); 

    document.querySelector("#form").reset(); // Garante que o formulário seja completamente resetado

    console.log("✅ Módulo Staff.js desinicializado.");
}

function normalizeEmptyValue(value) {
    // Se o valor é null, undefined, ou uma string vazia após trim, retorne null
    if (value === null || typeof value === 'undefined' || (typeof value === 'string' && value.trim() === '')) {
        return null;
    }
    return value;
}


async function verificarDisponibilidadeStaff(idFuncionario, datasAgendamento, idFuncao, idEventoIgnorar = null) {
    try {
        // AQUI ESTÁ A CORREÇÃO: 'datasAgendamento' já é um array de strings.
        const data = await fetchComToken(`/staff/check-availability`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                idfuncionario: idFuncionario,
                datas: datasAgendamento, // AQUI: Envia o array de strings diretamente
                idfuncao: idFuncao,
                idEventoIgnorar: idEventoIgnorar
            })
        });

        return data;
    } catch (error) {
        console.error("Erro na API de verificação de disponibilidade:", error);
        Swal.fire("Erro na Verificação", "Não foi possível verificar a disponibilidade do funcionário.", "error");
        return { isAvailable: false, conflictingEvent: null, conflicts: [] };
    }
}

// Função auxiliar para encontrar as datas de intersecção

function encontrarDatasConflitantes(datasParaVerificacao, conflitosReais) {
    const datasFormularioSet = new Set(datasParaVerificacao.map(d => {
        if (d instanceof Date) {
            return d.toISOString().split('T')[0];
        }
        return d; 
    }));

    const datasConflitantes = new Set();

    console.log("Conflitos Reais Recebidos:", conflitosReais);
    
    conflitosReais.forEach(conflito => {
        let datasConflito;
        try {
            // As datas do evento conflitante vêm como string JSON ou array
            datasConflito = typeof conflito.datasevento === 'string' 
                            ? JSON.parse(conflito.datasevento) 
                            : conflito.datasevento;
        } catch (e) {
            console.error("Erro ao parsear datas do evento conflitante:", e);
            datasConflito = [];
        }

        if (Array.isArray(datasConflito)) {
            datasConflito.forEach(dataConflito => {
                if (datasFormularioSet.has(dataConflito)) {
                    datasConflitantes.add(dataConflito);
                }
            });
        }
    });

    return Array.from(datasConflitantes);
}

/**
 * Formata um array de datas YYYY-MM-DD para o formato DD/MM/YYYY.
 * @param {Array<string>} datas - Array de datas no formato YYYY-MM-DD.
 * @returns {string} String com as datas formatadas e separadas por vírgula.
 */
// function formatarDatas(datas) {
//     if (!datas || datas.length === 0) return '';
//     return datas.map(d => {
//         const parts = d.split('-');
//         return `${parts[2]}/${parts[1]}/${parts[0]}`;
//     }).join(', ');
// }

function formatarDatas(datas) {
    if (!datas || datas.length === 0) return '';
    
    // Garante que 'datas' seja tratado como Array (caso venha uma string só)
    const lista = Array.isArray(datas) ? datas : [datas];

    return lista.map(d => {
        // Pega apenas 'YYYY-MM-DD', ignorando o 'T00:00:00' se houver
        const apenasData = String(d).split('T')[0]; 
        const parts = apenasData.split('-');
        
        // Se a data estiver no formato correto, inverte. Se não, retorna o original.
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return d; 
    }).join(', ');
}

function adicionarEventoBlurStaff() {
    const input = document.querySelector("#nmFuncionario");
    if (!input) return;

    let ultimoClique = null;

    //Captura o último elemento clicado no documento
    document.addEventListener("mousedown", (e) => {
        ultimoClique = e.target;
    });


    input.addEventListener("blur", async function () {

        const botoesIgnorados = ["Limpar", "Pesquisar", "Enviar"];
        const ehBotaoIgnorado =
            ultimoClique?.id && botoesIgnorados.includes(ultimoClique.id) ||
            ultimoClique?.classList.contains("close");

        if (ehBotaoIgnorado) {
            console.log("🔁 Blur ignorado: clique em botão de controle (Fechar/Limpar/Pesquisar).");
            return;
        }
        const desc = this.value.trim();
        console.log("Campo descStaff procurado:", desc);

        if (!desc) return;
    });
}

function limparStaffOriginal() {
    window.StaffOriginal = {
        idStaff: "",
        avaliacao: "",
        idFuncionario: "",
        nmFuncionario: "",
        descFuncao: "",
        vlrCusto: "",
        vlrCustoBaseFuncao: "",
        vlrCustoJuniorFuncao: "",
        vlrCustoPlenoFuncao: "",
        ajusteCusto: "",
        transporte: "",
        vlrTransporteSeniorFuncao: "",
        vlrTransporteFuncao: "", 
        alimentacao: "",
        caixinha: "",
        descBeneficio: "",
        idCliente: "",
        nmCliente: "",
        idEvento: "",
        nmEvento: "",
        idLocalMontagem: "",
        nmLocalMontagem: "",
        datasEventos: "",
        diariaDobrada: "",
        vlrTotal: "",
        vlrTotCache:"",
        vlrTotAjdCusto: "",
        nmPavilhao: "",

        // 📎 Comprovantes PDF
        comprovanteCache: "",
        comprovanteAjdCusto: "",
        comprovanteCaixinha: "",
        comprovanteContGastos: "",
        setor: "",
        statusPgto,
        statusDiariaDobrada: "",
        descDiariaDobrada: "",
        statusMeiaDiaria: "",
        descMeiaDiaria: "",

        descAjusteCusto: "",
        descCaixinha: "",
        statusAjusteCusto: "",
        statusCaixinha: "",
        nivelexperiencia: "",
        qtdpessoas: ""
    };

    bLiberacaoAutorizada = false; // Reset da variável de controle de liberação
    // Log dos campos limpados
    console.log("✅ StaffOriginal foi resetado com os seguintes campos:");
    Object.entries(window.StaffOriginal).forEach(([chave, valor]) => {
        console.log(`- ${chave}: "${valor}"`);
    });
}

async function carregarEquipeStaff() {

    try{
        const equipes = await fetchComToken('/staff/equipe');
        console.log("ENTROU NO CARREGAREQUIPESTAFF", equipes);
        let selects = document.querySelectorAll(".nmEquipe");

        selects.forEach(select => {     // Log das equipes recebidas

            select.innerHTML = '<option value="">Selecione a Equipe</option>'; // Adiciona a opção padrão
            console.log('Equipes recebidas:', equipes);
            equipes.forEach(equipe => {
                let option = document.createElement("option");

                option.value = equipe.idequipe;  // Atenção ao nome da propriedade (idMontagem)
                option.textContent = equipe.nmequipe;
                option.setAttribute("data-nmEquipe", equipe.nmequipe);
                option.setAttribute("data-idEquipe", equipe.idequipe);
                select.appendChild(option);

            });

            select.addEventListener('change', function () {

                const selectedOption = select.options[select.selectedIndex];

                document.getElementById("idEquipe").value = selectedOption.getAttribute("data-idEquipe");


            });

        });
    }catch(error){
        console.error("Erro ao carregar equipes:", error);
    }

}

// async function carregarFuncaoStaff() {
//     try{
//         const funcaofetch = await fetchComToken('/staff/funcao');
//         console.log("ENTROU NO CARREGARFUNCAOSTAFF", funcaofetch);       

//         let selects = document.querySelectorAll(".descFuncao");

//         const inputIdEquipe = document.getElementById("idEquipe");
//         const inputNmEquipe = document.getElementById("nmEquipe");

//         selects.forEach(select => {
//             select.innerHTML = "";

//             console.log('Funcao recebidos:', funcaofetch); // Log das Funções recebidas
//             let opcaoPadrao = document.createElement("option");
//             opcaoPadrao.setAttribute("value", "");
//             opcaoPadrao.textContent = "Selecione Função";
//             select.appendChild(opcaoPadrao);

//             funcaofetch.forEach(funcao => {
//                // if (funcao.ativo === true || funcao.ativo === "true" || funcao.ativo === 1) {
//                     let option = document.createElement("option");
//                     option.value = funcao.idfuncao;
//                     option.textContent = funcao.descfuncao;
//                     option.setAttribute("data-idFuncao", funcao.idfuncao);
//                     option.setAttribute("data-descproduto", funcao.descfuncao);
//                     option.setAttribute("data-ctosenior", funcao.ctofuncaosenior);
//                     option.setAttribute("data-ctosenior2", funcao.ctofuncaosenior2);
//                     option.setAttribute("data-ctopleno", funcao.ctofuncaopleno);
//                     option.setAttribute("data-ctojunior", funcao.ctofuncaojunior);
//                     option.setAttribute("data-ctobase", funcao.ctofuncaobase);
//                     option.setAttribute("data-vda", funcao.vdafuncao); 
                    
//                     // 🟢 Linha Adicionada para trazer o valor do funcionário
//                     option.setAttribute("data-vlrfuncionario", funcao.vlrfuncionario || 0); 
                    
//                     option.setAttribute("data-alimentacao", funcao.alimentacao || 0);
//                     option.setAttribute("data-transporte", funcao.transporte || 0);
//                     option.setAttribute("data-transpsenior", funcao.transpsenior || 0);
//                     option.setAttribute("data-idequipe", funcao.idequipe || '');
//                     option.setAttribute("data-nmequipe", funcao.nmequipe || '');                     
//                     option.setAttribute("data-categoriafuncao", funcao.nmcategoriafuncao || '');
//                     option.setAttribute("data-categoria", "Produto(s)");
//                     select.appendChild(option);
//                // }else {
//                //      // Opcional: Log para saber quais funções foram filtradas.
//                //      console.log(`Função inativa ignorada: ${funcao.descfuncao}`);
//                // }
//             });

//             select.addEventListener("change", function (event) {
//                 if (isFormLoadedFromDoubleClick) {
//                     console.log("💾 Edição detectada: Preservando valores históricos do banco.");
                    
//                     // Resetamos a flag para que, SE o usuário mudar a função MANUALMENTE 
//                     // após abrir o formulário, aí sim o sistema passe a buscar os preços novos.
//                     isFormLoadedFromDoubleClick = false; 
//                     return; 
//                 }

//                 document.getElementById("vlrCusto").value = '';
//                 document.getElementById("alimentacao").value = '';
//                 document.getElementById("transporte").value = '';
                
//                 // Referências aos checkboxes (use IDs consistentes com o seu HTML)
//                 const seniorCheck = document.getElementById("seniorCheck") || document.getElementById("Seniorcheck"); 
//                 const seniorCheck2 = document.getElementById("seniorCheck2") || document.getElementById("Seniorcheck2"); 
//                 const plenoCheck = document.getElementById("plenoCheck") || document.getElementById("Plenocheck"); 
//                 const juniorCheck = document.getElementById("juniorCheck") || document.getElementById("Juniorcheck"); 
//                 const baseCheck = document.getElementById("baseCheck") || document.getElementById("Basecheck"); 
//                 const fechadoCheck = document.getElementById("fechadoCheck") || document.getElementById("Fechadocheck"); 
//                 const liberadoCheck = document.getElementById("Liberadocheck") || document.getElementById("liberadocheck"); 

//                 if (seniorCheck) seniorCheck.checked = false;
//                 if (seniorCheck2) seniorCheck2.checked = false; 
//                 if (plenoCheck) plenoCheck.checked = false;
//                 if (juniorCheck) juniorCheck.checked = false;
//                 if (baseCheck) baseCheck.checked = false;
//                 if (fechadoCheck) fechadoCheck.checked = false;
//                 if (liberadoCheck) liberadoCheck.checked = false;

//                 inputIdEquipe.value = '';
//                 inputNmEquipe.value = '';

//                 const selectedOption = this.options[this.selectedIndex];
//                 const descFuncao = selectedOption.textContent;

//                 // 1. Obtém o valor do perfil
//                 const perfilFuncionarioInput = document.getElementById('perfilFuncionario');
//                 const perfilSelecionado = perfilFuncionarioInput?.value?.toUpperCase().trim() || ''; 

//                 document.getElementById("idFuncao").value = selectedOption.getAttribute("data-idFuncao"); 
//                 const idEquipeSelecionado = selectedOption.getAttribute("data-idequipe");
//                 const nmEquipeSelecionado = selectedOption.getAttribute("data-nmequipe");
                
//                 if (idEquipeSelecionado) {
//                     inputIdEquipe.value = idEquipeSelecionado;
//                     inputNmEquipe.value = nmEquipeSelecionado;
//                     console.log(`Equipe preenchida: ID ${idEquipeSelecionado}, Nome ${nmEquipeSelecionado}`);
//                 } 

//                 vlrCustoSeniorFuncao = parseFloat(selectedOption.getAttribute("data-ctosenior")) || 0;
//                 vlrCustoSeniorFuncao2 = parseFloat(selectedOption.getAttribute("data-ctosenior2")) || 0;
//                 vlrCustoPlenoFuncao = parseFloat(selectedOption.getAttribute("data-ctopleno")) || 0;
//                 vlrCustoJuniorFuncao = parseFloat(selectedOption.getAttribute("data-ctojunior")) || 0;
//                 vlrCustoBaseFuncao = parseFloat(selectedOption.getAttribute("data-ctobase")) || 0;         
//                 vlrAlimentacaoFuncao = parseFloat(selectedOption.getAttribute("data-alimentacao")) || 0;
//                 vlrTransporteFuncao = parseFloat(selectedOption.getAttribute("data-transporte")) || 0;
//                 vlrTransporteSeniorFuncao = parseFloat(selectedOption.getAttribute("data-transpsenior")) || 0;

//                 // 🔴 CORREÇÃO: Lendo o atributo com o nome todo em minúsculo (kebab-case) 
//                 // e armazenando na variável com 'F' maiúsculo para consistência.
//                 vlrFuncionario = parseFloat(selectedOption.getAttribute("data-vlrfuncionario")) || 0;
                
//                 categoriaFuncao = selectedOption.getAttribute("data-categoriafuncao") || '';
                
//                 // ----------------------------------------------------
//                 // LÓGICA DE OVERRIDE POR FUNÇÃO E PERFIL
//                 // ----------------------------------------------------
//                 if  (descFuncao === "FISCAL DE MARCAÇÃO") {
//                     console.log(`🔵 REGRA ATIVA: ${descFuncao}.`);

//                     // 1. Mostra a DIV pai do Senior 2
//                     const inputSenior2 = document.getElementById("Seniorcheck2");
//                     const divPaiSenior2 = inputSenior2 ? inputSenior2.closest('.Vertical') : null;
                    
//                     if (divPaiSenior2) {
//                         divPaiSenior2.style.setProperty("display", "flex", "important");
//                     }
//                 } else {
//                     // Esconde o Senior 2 se mudar para outra função
//                     const inputSenior2 = document.getElementById("Seniorcheck2");
//                     const divPaiSenior2 = inputSenior2 ? inputSenior2.closest('.Vertical') : null;
//                     if (divPaiSenior2) divPaiSenior2.style.display = 'none';
//                     if (inputSenior2) inputSenior2.checked = false;
//                 }
//                 if (descFuncao === "AJUDANTE DE MARCAÇÃO") {
//                     console.log(`🟡 REGRA FUNÇÃO ATIVA: ${descFuncao}. Trava no Base e Custo Base.`);
                    
//                     // 1. Marca/Trava o "Base"
//                     if (baseCheck) baseCheck.checked = true;
//                     if (seniorCheck) seniorCheck.disabled = true;
//                     if (plenoCheck) plenoCheck.disabled = true;
//                     if (juniorCheck) juniorCheck.disabled = true;
//                     if (baseCheck) baseCheck.disabled = false; 
//                     if (fechadoCheck) fechadoCheck.disabled = false; 
//                     if (liberadoCheck) liberadoCheck.disabled = false; 
                    
//                     // 2. Preenche os custos com o valor Base da Função
//                     document.getElementById("vlrCusto").value = (parseFloat(vlrCustoBaseFuncao) || 0).toFixed(2).replace('.', ',');
//                     document.getElementById("alimentacao").value = (parseFloat(vlrAlimentacaoFuncao) || 0).toFixed(2).replace('.', ','); 
//                     document.getElementById("transporte").value = (parseFloat(vlrTransporteFuncao) || 0).toFixed(2).replace('.', ',');
                    
//                     if (typeof calcularValorTotal === 'function') {
//                         calcularValorTotal();
//                     }
                    
//                 } 
//                 // Verifica se o perfil é INTERNO ou EXTERNO
//                 else if ((perfilSelecionado.toLowerCase() === "interno") || (perfilSelecionado.toLowerCase() === "externo")) { 
//                     console.log(`🔴 REGRA PERFIL ATIVA: Perfil 'FUNCIONARIO' (${perfilSelecionado}) detectado.`);
//                     // 💡 DEBUG: Confira o valor que foi lido do atributo 'data-vlrfuncionario':
//                     console.log(`💡 DEBUG: vlrFuncionario lido: ${vlrFuncionario}`);

//                     // 1. Marca/Trava o "Base"
//                     if (baseCheck) baseCheck.checked = true;
//                     if (seniorCheck) seniorCheck.disabled = true;
//                     if (plenoCheck) plenoCheck.disabled = true;
//                     if (juniorCheck) juniorCheck.disabled = true;
//                     if (baseCheck) baseCheck.disabled = false;
//                     if (fechadoCheck) fechadoCheck.disabled = false; 
//                     if (liberadoCheck) liberadoCheck.disabled = false;  

//                     // 2. Preenche os custos com o vlrFuncionario
//                     // 🟢 CORREÇÃO CRÍTICA: Usando o nome de variável CONSISTENTE (vlrFuncionario)
//                     document.getElementById("vlrCusto").value = (parseFloat(vlrFuncionario) || 0).toFixed(2).replace('.', ',');
//                     document.getElementById("alimentacao").value = (parseFloat(vlrAlimentacaoFuncao) || 0).toFixed(2).replace('.', ','); 
//                     document.getElementById("transporte").value = (parseFloat(vlrTransporteFuncao) || 0).toFixed(2).replace('.', ',');
                    
//                     if (typeof calcularValorTotal === 'function') {
//                         calcularValorTotal();
//                     }

//                 }
//                 // Perfil/Função Padrão (FREELANCER, LOTE, ou Função/Perfil padrão)
//                 else{
//                     console.log("🟢 PERFIL/FUNÇÃO PADRÃO: Habilita Checkboxes e chama onCriteriosChanged.");
                    
//                     // 1. Re-habilita todos os checkboxes
//                     if (seniorCheck) seniorCheck.disabled = false;
//                     if (plenoCheck) plenoCheck.disabled = false;
//                     if (juniorCheck) juniorCheck.disabled = false;
//                     if (baseCheck) baseCheck.disabled = false;
//                     if (fechadoCheck) fechadoCheck.disabled = false; 
//                     if (liberadoCheck) liberadoCheck.disabled = false; 
                    
//                     // 2. Chama onCriteriosChanged para preencher os valores de custo inicial
//                     if (typeof onCriteriosChanged === 'function') {
//                         onCriteriosChanged();
//                     }
//                 }
//             });
//         });
//     }catch(error){
//     console.error("Erro ao carregar funcao:", error);
//     }
// }

async function carregarFuncaoStaff() {
    try{
        const funcaofetch = await fetchComToken('/staff/funcao');
        console.log("ENTROU NO CARREGARFUNCAOSTAFF", funcaofetch);       

        let selects = document.querySelectorAll(".descFuncao");

        const inputIdEquipe = document.getElementById("idEquipe");
        const inputNmEquipe = document.getElementById("nmEquipe");

        selects.forEach(select => {
            select.innerHTML = "";

            console.log('Funcao recebidos:', funcaofetch); // Log das Funções recebidas
            let opcaoPadrao = document.createElement("option");
            opcaoPadrao.setAttribute("value", "");
            opcaoPadrao.textContent = "Selecione Função";
            select.appendChild(opcaoPadrao);

            funcaofetch.forEach(funcao => {
               // if (funcao.ativo === true || funcao.ativo === "true" || funcao.ativo === 1) {
               console.log(`Função ${funcao.descfuncao} - ctosenior: ${funcao.ctofuncaosenior}, ctopleno: ${funcao.ctofuncaopleno}, ctobase: ${funcao.ctofuncaobase}`);
                    let option = document.createElement("option");
                    option.value = funcao.idfuncao;
                    option.textContent = funcao.descfuncao;
                    option.setAttribute("data-idFuncao", funcao.idfuncao);
                    option.setAttribute("data-descproduto", funcao.descfuncao);
                    option.setAttribute("data-ctosenior", funcao.ctofuncaosenior);
                    option.setAttribute("data-ctosenior2", funcao.ctofuncaosenior2);
                    option.setAttribute("data-ctopleno", funcao.ctofuncaopleno);
                    option.setAttribute("data-ctojunior", funcao.ctofuncaojunior);
                    option.setAttribute("data-ctobase", funcao.ctofuncaobase);
                    option.setAttribute("data-vda", funcao.vdafuncao); 
                    
                    // 🟢 Linha Adicionada para trazer o valor do funcionário
                    option.setAttribute("data-vlrfuncionario", funcao.vlrfuncionario || 0); 
                    
                    option.setAttribute("data-alimentacao", funcao.alimentacao || 0);
                    option.setAttribute("data-transporte", funcao.transporte || 0);
                    option.setAttribute("data-transpsenior", funcao.transpsenior || 0);
                    option.setAttribute("data-idequipe", funcao.idequipe || '');
                    option.setAttribute("data-nmequipe", funcao.nmequipe || '');                     
                    option.setAttribute("data-categoriafuncao", funcao.nmcategoriafuncao || '');
                    option.setAttribute("data-categoria", "Produto(s)");
                    select.appendChild(option);
               // }else {
               //      // Opcional: Log para saber quais funções foram filtradas.
               //      console.log(`Função inativa ignorada: ${funcao.descfuncao}`);
               // }
            });

            select.addEventListener("change", function (event) {
                if (!this.value) return;

                if (isFormLoadedFromDoubleClick) {
                    console.log("💾 Edição detectada: Preservando valores históricos do banco.");
                    
                    // Resetamos a flag para que, SE o usuário mudar a função MANUALMENTE 
                    // após abrir o formulário, aí sim o sistema passe a buscar os preços novos.
                   // isFormLoadedFromDoubleClick = false; //ATENÇÃO - AQUI É O PONTO CRÍTICO: NÃO DEVEMOS RESETAR ESSA FLAG AQUI, POIS SE O USUÁRIO SIMPLESMENTE ABRIR O FORMULÁRIO PARA VISUALIZAR, ESSA FUNÇÃO VAI SER CHAMADA E VAI RESETAR A FLAG, FAZENDO COM QUE OS VALORES SEJAM PERDIDOS MESMO SEM O USUÁRIO TER MUDADO A FUNÇÃO. ENTÃO, ESSA FLAG SÓ DEVE SER RESETADA QUANDO O USUÁRIO REALMENTE INTERAGIR E MUDAR A FUNÇÃO, NÃO APENAS AO CARREGAR O FORMULÁRIO.
                    return; 
                }

                document.getElementById("vlrCusto").value = '';
                document.getElementById("alimentacao").value = '';
                document.getElementById("transporte").value = '';
                
                // Referências aos checkboxes (use IDs consistentes com o seu HTML)
                const seniorCheck = document.getElementById("seniorCheck") || document.getElementById("Seniorcheck"); 
                const seniorCheck2 = document.getElementById("seniorCheck2") || document.getElementById("Seniorcheck2"); 
                const plenoCheck = document.getElementById("plenoCheck") || document.getElementById("Plenocheck"); 
                const juniorCheck = document.getElementById("juniorCheck") || document.getElementById("Juniorcheck"); 
                const baseCheck = document.getElementById("baseCheck") || document.getElementById("Basecheck"); 
                const fechadoCheck = document.getElementById("fechadoCheck") || document.getElementById("Fechadocheck"); 
                
                if (seniorCheck) seniorCheck.checked = false;
                if (seniorCheck2) seniorCheck2.checked = false; 
                if (plenoCheck) plenoCheck.checked = false;
                if (juniorCheck) juniorCheck.checked = false;
                if (baseCheck) baseCheck.checked = false;
                if (fechadoCheck) fechadoCheck.checked = false;

                inputIdEquipe.value = '';
                inputNmEquipe.value = '';

                const selectedOption = this.options[this.selectedIndex];
                const descFuncao = selectedOption.textContent;

                // 1. Obtém o valor do perfil
                const perfilFuncionarioInput = document.getElementById('perfilFuncionario');
                const perfilSelecionado = perfilFuncionarioInput?.value?.toUpperCase().trim() || ''; 

                document.getElementById("idFuncao").value = selectedOption.getAttribute("data-idFuncao"); 
                const idEquipeSelecionado = selectedOption.getAttribute("data-idequipe");
                const nmEquipeSelecionado = selectedOption.getAttribute("data-nmequipe");
                
                if (idEquipeSelecionado) {
                    inputIdEquipe.value = idEquipeSelecionado;
                    inputNmEquipe.value = nmEquipeSelecionado;
                    console.log(`Equipe preenchida: ID ${idEquipeSelecionado}, Nome ${nmEquipeSelecionado}`);
                } 

                vlrCustoSeniorFuncao = parseFloat(selectedOption.getAttribute("data-ctosenior")) || 0;
                vlrCustoSeniorFuncao2 = parseFloat(selectedOption.getAttribute("data-ctosenior2")) || 0;
                vlrCustoPlenoFuncao = parseFloat(selectedOption.getAttribute("data-ctopleno")) || 0;
                vlrCustoJuniorFuncao = parseFloat(selectedOption.getAttribute("data-ctojunior")) || 0;
                vlrCustoBaseFuncao = parseFloat(selectedOption.getAttribute("data-ctobase")) || 0;         
                vlrAlimentacaoFuncao = parseFloat(selectedOption.getAttribute("data-alimentacao")) || 0;
                vlrTransporteFuncao = parseFloat(selectedOption.getAttribute("data-transporte")) || 0;
                vlrTransporteSeniorFuncao = parseFloat(selectedOption.getAttribute("data-transpsenior")) || 0;

                // 🔴 CORREÇÃO: Lendo o atributo com o nome todo em minúsculo (kebab-case) 
                // e armazenando na variável com 'F' maiúsculo para consistência.
                const vlrFuncionario = parseFloat(selectedOption.getAttribute("data-vlrfuncionario")) || 0;
                
                categoriaFuncao = selectedOption.getAttribute("data-categoriafuncao") || '';
                
                // ----------------------------------------------------
                // LÓGICA DE OVERRIDE POR FUNÇÃO E PERFIL
                // ----------------------------------------------------
                // if  (descFuncao === "FISCAL DE MARCAÇÃO") {
                //     console.log(`🔵 REGRA ATIVA: ${descFuncao}.`);

                //     // 1. Mostra a DIV pai do Senior 2
                //     const inputSenior2 = document.getElementById("Seniorcheck2");
                //     const divPaiSenior2 = inputSenior2 ? inputSenior2.closest('.Vertical') : null;
                    
                //     if (divPaiSenior2) {
                //         divPaiSenior2.style.setProperty("display", "flex", "important");
                //     }
                // } else {
                //     // Esconde o Senior 2 se mudar para outra função
                //     const inputSenior2 = document.getElementById("Seniorcheck2");
                //     const divPaiSenior2 = inputSenior2 ? inputSenior2.closest('.Vertical') : null;
                //     if (divPaiSenior2) divPaiSenior2.style.display = 'none';
                //     if (inputSenior2) inputSenior2.checked = false;
                // }
                // if (descFuncao === "AJUDANTE DE MARCAÇÃO") {
                //     console.log(`🟡 REGRA FUNÇÃO ATIVA: ${descFuncao}. Trava no Base e Custo Base.`);
                    
                //     // 1. Marca/Trava o "Base"
                //     if (baseCheck) baseCheck.checked = true;
                //     if (seniorCheck) seniorCheck.disabled = true;
                //     if (plenoCheck) plenoCheck.disabled = true;
                //     if (juniorCheck) juniorCheck.disabled = true;
                //     if (baseCheck) baseCheck.disabled = false; 
                    
                //     // 2. Preenche os custos com o valor Base da Função
                //     document.getElementById("vlrCusto").value = (parseFloat(vlrCustoBaseFuncao) || 0).toFixed(2).replace('.', ',');
                //     document.getElementById("alimentacao").value = (parseFloat(vlrAlimentacaoFuncao) || 0).toFixed(2).replace('.', ','); 
                //     document.getElementById("transporte").value = (parseFloat(vlrTransporteFuncao) || 0).toFixed(2).replace('.', ',');
                    
                //     if (typeof calcularValorTotal === 'function') {
                //         calcularValorTotal();
                //     }
                    
                // } 
                // // Verifica se o perfil é INTERNO ou EXTERNO
                // else if(perfilSelecionado === "INTERNO" || perfilSelecionado === "EXTERNO") { 
                //     console.log(`🔴 REGRA PERFIL ATIVA: Perfil 'FUNCIONARIO' (${perfilSelecionado}) detectado.`);
                //     // 💡 DEBUG: Confira o valor que foi lido do atributo 'data-vlrfuncionario':
                //     console.log(`💡 DEBUG: vlrFuncionario lido: ${vlrFuncionario}`);

                //     // 1. Marca/Trava o "Base"
                //     if (baseCheck) baseCheck.checked = true;
                //     if (seniorCheck) seniorCheck.disabled = true;
                //     if (plenoCheck) plenoCheck.disabled = true;
                //     if (juniorCheck) juniorCheck.disabled = true;
                //     if (baseCheck) baseCheck.disabled = false; 

                //     // 2. Preenche os custos com o vlrFuncionario
                //     // 🟢 CORREÇÃO CRÍTICA: Usando o nome de variável CONSISTENTE (vlrFuncionario)
                //     document.getElementById("vlrCusto").value = (parseFloat(vlrFuncionario) || 0).toFixed(2).replace('.', ',');
                //     document.getElementById("alimentacao").value = (parseFloat(vlrAlimentacaoFuncao) || 0).toFixed(2).replace('.', ','); 
                //     document.getElementById("transporte").value = (parseFloat(vlrTransporteFuncao) || 0).toFixed(2).replace('.', ',');
                    
                //     if (typeof calcularValorTotal === 'function') {
                //         calcularValorTotal();
                //     }

                // }
                // // Perfil/Função Padrão (FREELANCER, LOTE, ou Função/Perfil padrão)
                // else{
                //     console.log("🟢 PERFIL/FUNÇÃO PADRÃO: Habilita Checkboxes e chama onCriteriosChanged.");
                    
                //     // 1. Re-habilita todos os checkboxes
                //     if (seniorCheck) seniorCheck.disabled = false;
                //     if (plenoCheck) plenoCheck.disabled = false;
                //     if (juniorCheck) juniorCheck.disabled = false;
                //     if (baseCheck) baseCheck.disabled = false;
                    
                //     // 2. Chama onCriteriosChanged para preencher os valores de custo inicial
                //     if (typeof onCriteriosChanged === 'function') {
                //         onCriteriosChanged();
                //     }
                // }

                // 1. CONTROLE DO SENIOR 2 (baseado apenas na função)
                // 1. CONTROLE DO SENIOR 2 (só para FISCAL)
                const inputSenior2 = document.getElementById("Seniorcheck2");
                const divPaiSenior2 = inputSenior2 ? inputSenior2.closest('.Vertical') : null;

                if (descFuncao === "FISCAL DE MARCAÇÃO") {
                    if (divPaiSenior2) divPaiSenior2.style.setProperty("display", "flex", "important");
                } else {
                    if (divPaiSenior2) divPaiSenior2.style.display = 'none';
                    if (inputSenior2) inputSenior2.checked = false;
                }

                // 2. CONTROLE DE NÍVEIS E CUSTOS
                const isInternoOuExterno = perfilSelecionado === "INTERNO" || perfilSelecionado === "EXTERNO";

                if (descFuncao === "AJUDANTE DE MARCAÇÃO") {
                    // Sempre trava Senior, Pleno, Junior — independente do perfil
                    if (seniorCheck)  seniorCheck.disabled = true;
                    if (seniorCheck2) seniorCheck2.disabled = true;
                    if (plenoCheck)   plenoCheck.disabled = true;
                    if (juniorCheck)  juniorCheck.disabled = true;
                    if (baseCheck)    { baseCheck.checked = true; baseCheck.disabled = false; }
                    if (fechadoCheck) fechadoCheck.disabled = false;
                    if (liberadoCheck) liberadoCheck.disabled = false;

                    // Custo varia conforme o perfil
                    if (isInternoOuExterno) {
                        const selectFuncao = document.querySelector(".descFuncao");
                        const optionFuncaoAtual = selectFuncao?.options[selectFuncao.selectedIndex];
                        const vlrFuncionarioAtual = parseFloat(optionFuncaoAtual?.getAttribute("data-vlrfuncionario") || 0);
                        document.getElementById("vlrCusto").value = vlrFuncionarioAtual.toFixed(2).replace('.', ',');
                        document.getElementById("alimentacao").value = (parseFloat(vlrAlimentacaoFuncao) || 0).toFixed(2).replace('.', ',');
                        document.getElementById("transporte").value = (parseFloat(vlrTransporteFuncao) || 0).toFixed(2).replace('.', ',');
                    } else {
                        // Freelancer, Lote
                        document.getElementById("vlrCusto").value = (parseFloat(vlrCustoBaseFuncao) || 0).toFixed(2).replace('.', ',');
                        document.getElementById("alimentacao").value = (0).toFixed(2).replace('.', ',');
                        document.getElementById("transporte").value = (0).toFixed(2).replace('.', ',');    
                    }
                    
                    if (typeof calcularValorTotal === 'function') calcularValorTotal();

                } else if (isInternoOuExterno) {
                    // Interno/externo em qualquer outra função (incluindo FISCAL)
                    if (baseCheck)    { baseCheck.checked = true; baseCheck.disabled = false; }
                    if (seniorCheck)  seniorCheck.disabled = true;
                    if (seniorCheck2) seniorCheck2.disabled = true;
                    if (plenoCheck)   plenoCheck.disabled = true;
                    if (juniorCheck)  juniorCheck.disabled = true;
                    if (fechadoCheck) fechadoCheck.disabled = false;
                    if (liberadoCheck) liberadoCheck.disabled = false;

                    const selectFuncao = document.querySelector(".descFuncao");
                    const optionFuncaoAtual = selectFuncao?.options[selectFuncao.selectedIndex];
                    const vlrFuncionarioAtual = parseFloat(optionFuncaoAtual?.getAttribute("data-vlrfuncionario") || 0);

                    document.getElementById("vlrCusto").value = vlrFuncionarioAtual.toFixed(2).replace('.', ',');
                    document.getElementById("alimentacao").value = (parseFloat(vlrAlimentacaoFuncao) || 0).toFixed(2).replace('.', ',');
                    document.getElementById("transporte").value = (parseFloat(vlrTransporteFuncao) || 0).toFixed(2).replace('.', ',');
                    if (typeof calcularValorTotal === 'function') calcularValorTotal();

                } else {
                    // Freelancer/Lote em função padrão (não é AJUDANTE)
                    if (seniorCheck)  seniorCheck.disabled = false;
                    if (plenoCheck)   plenoCheck.disabled = false;
                    if (juniorCheck)  juniorCheck.disabled = false;
                    if (baseCheck)    baseCheck.disabled = false;
                    if (fechadoCheck) fechadoCheck.disabled = false;
                    if (liberadoCheck) liberadoCheck.disabled = false;

                    if (typeof onCriteriosChanged === 'function') onCriteriosChanged();
                }
            });
        });
    }catch(error){
    console.error("Erro ao carregar funcao:", error);
    }
}

async function carregarFuncionarioStaff() {
    try{
        
        const funcionariofetch = await fetchComToken('/staff/funcionarios');
        //console.log("ENTROU NO CARREGAR FUNCIONARIO STAFF", funcionariofetch);

        let selects = document.querySelectorAll(".nmFuncionario");

        selects.forEach(select => {
            select.innerHTML = "";

            let opcaoPadrao = document.createElement("option");
            opcaoPadrao.setAttribute("value", "");
            opcaoPadrao.textContent = "Selecione Funcionário";
            select.appendChild(opcaoPadrao);

            funcionariofetch.forEach(funcionario => {
             // console.log("ENTROU NO FOR EACH", funcionario);
                let option = document.createElement("option");
                option.value = funcionario.idfuncionario;
                option.textContent = funcionario.nome;
                option.setAttribute("data-idfuncionario", funcionario.idfuncionario);
                option.setAttribute("data-nmfuncionario", funcionario.nome);
                option.setAttribute("data-apelido", funcionario.apelido);
                option.setAttribute("data-perfil", funcionario.perfil);
                option.setAttribute("data-foto", funcionario.foto);
                option.setAttribute("data-avaliacao", funcionario.avaliacao);

                select.appendChild(option);
            });


            if ($(select).hasClass("select2-hidden-accessible")) {
                $(select).select2('destroy');
            }

           
            $(select).select2({
                placeholder: "Digite para buscar o funcionário...",
                allowClear: true,
                width: '100%',
                matcher: function(params, data) {
                    if ($.trim(params.term) === '') return data;
                    if (typeof data.text === 'undefined') return null;
                    
                    // Busca ignorando maiúsculas/minúsculas
                    if (data.text.toLowerCase().indexOf(params.term.toLowerCase()) > -1) {
                        return data;
                    }
                    return null;
                }
            });

            // Dispara o evento change original quando o Select2 seleciona algo
            $(select).on('select2:select', function (e) {
                this.dispatchEvent(new Event('change', { bubbles: true }));
            });

            // Limpa os campos quando o utilizador clica no "X" para desmarcar
            $(select).on('select2:unselect', function (e) {
                this.value = "";
                this.dispatchEvent(new Event('change', { bubbles: true }));
            });

            select.addEventListener("change", function () {
                //limparCamposStaffParcial();

            const selectedOption = this.options[this.selectedIndex];

            const idFuncionarioSelecionado = selectedOption.value; // Pega o idfuncionario do valor do option

                // eventsTableBody.innerHTML = '';
                // noResultsMessage.style.display = 'none';
                // limparCamposStaff();
                // currentEditingStaffEvent = null;

                // Se a opção padrão "Selecione Funcionário" for selecionada (valor vazio), limpa a tabela
                if (idFuncionarioSelecionado === "") {
                    eventsTableBody.innerHTML = '';
                    noResultsMessage.style.display = 'none'; // Ou 'block' com uma mensagem genérica de "selecione um funcionário"

                    // Também limpe os campos relacionados ao funcionário
                    apelidoFuncionarioInput.value = '';
                    idFuncionarioHiddenInput.value = '';
                    previewFotoImg.src = '#';
                    previewFotoImg.alt = 'Sem foto';
                    previewFotoImg.style.display = 'none';
                    if (uploadHeaderDiv) { uploadHeaderDiv.style.display = 'block'; }
                    if (fileNameSpan) { fileNameSpan.textContent = 'Nenhum arquivo selecionado'; }
                    if (fileInput) { fileInput.value = ''; }
                    // E a tarja de avaliação, se aplicável
                    if (avaliacaoSelect) {
                        avaliacaoSelect.value = '';
                        if (tarjaDiv) {
                            tarjaDiv.textContent = '';
                            tarjaDiv.className = 'tarja-avaliacao';
                        }
                    }

                    return; // Sai da função, não busca eventos para ID vazio
                }

                if (currentEditingStaffEvent) {
                        const statusCache = (currentEditingStaffEvent.statuspgto || '').trim().toUpperCase();
                        const statusAjuda = (currentEditingStaffEvent.statuspgtoajdcto || '').trim().toUpperCase();

                        // Verifica se há pagamentos realizados
                        if (statusCache === 'PAGO' || statusAjuda === 'PAGO' || statusAjuda === 'PAGO50') {
                            const motivosBloqueio = [];
                            if (statusCache === 'PAGO') motivosBloqueio.push('💰 <strong>Cachê já foi pago</strong>');
                            if (statusAjuda === 'PAGO') motivosBloqueio.push('💰 <strong>Ajuda de Custo já foi paga</strong>');
                            if (statusAjuda === 'PAGO50') motivosBloqueio.push('💰 <strong>Ajuda de Custo 50% já foi paga</strong>');

                            Swal.fire({
                                title: '🚫 Troca de Funcionário Bloqueada',
                                html: `Não é possível trocar o funcionário pois:<br><br>
                                    ${motivosBloqueio.join('<br>')}<br><br>
                                    Para trocar o funcionário, o pagamento deve ser estornado primeiro.`,
                                icon: 'error',
                                confirmButtonColor: '#d33',
                                confirmButtonText: 'Entendido'
                            }).then(() => {
                                // Reverte o select para o funcionário anterior
                                const idFuncionarioAnterior = currentEditingStaffEvent.idfuncionario;
                                $(select).val(idFuncionarioAnterior).trigger('change.select2');
                            });

                            return; // Bloqueia qualquer ação adicional
                        }
                    const nomeFuncionarioAtual = currentEditingStaffEvent.nmfuncionario || 
                                                currentEditingStaffEvent.nome || 
                                                `ID ${currentEditingStaffEvent.idfuncionario}`;
                    const nomeEvento = currentEditingStaffEvent.nmevento || 
                                    currentEditingStaffEvent.idevento || '';
                    const nomeFuncionarioNovo = selectedOption.getAttribute("data-nmfuncionario") || 
                                                selectedOption.textContent.trim();

                    Swal.fire({
                        title: 'Funcionário com evento carregado',
                        html: `Os dados exibidos são do funcionário <strong>${nomeFuncionarioAtual}</strong>
                            ${nomeEvento ? `<br>Evento: <strong>${nomeEvento}</strong>` : ''}<br><br>
                            O que deseja fazer com <strong>${nomeFuncionarioNovo}</strong>?`,
                        icon: 'question',
                        showCancelButton: true,
                        showDenyButton: true,
                        confirmButtonColor: '#3085d6',
                        denyButtonColor: '#e07b00',
                        cancelButtonColor: '#aaa',
                        confirmButtonText: `✅ Trocar Funcionário ${nomeFuncionarioAtual.split(' ')[0]} por ${nomeFuncionarioNovo.split(' ')[0]} no evento`,
                        denyButtonText: `🧹 Limpar e carregar ${nomeFuncionarioNovo.split(' ')[0]}`,
                        cancelButtonText: '❌ Cancelar',
                        // --- ESTILIZAÇÃO PARA EMPILHAR OS BOTÕES ---
                        customClass: {
                            actions: 'my-stacked-buttons',
                            confirmButton: 'full-width-button',
                            denyButton: 'full-width-button',
                            cancelButton: 'full-width-button'
                        },
                        didOpen: () => {
                            // Injeta o CSS dinamicamente para garantir o empilhamento
                            const style = document.createElement('style');
                            style.innerHTML = `
                                .my-stacked-buttons {
                                    flex-direction: column !important;
                                    align-items: stretch !important;
                                    padding: 0 10% !important;
                                }
                                .full-width-button {
                                    width: 100% !important;
                                    margin: 5px 0 !important;
                                }
                            `;
                            document.head.appendChild(style);
                        }
                    }).then((result) => {
                        if (result.isConfirmed) {
                            // Avisa que precisa salvar antes de trocar
                            Swal.fire({
                                title: 'Atenção! TROCANDO FUNCIONÁRIO NO EVENTO',
                                html: `CLIQUE em <strong>ENVIAR</strong> para salvar os dados do Evento. <br><br>O Evento será retirado do funcionário <strong>${nomeFuncionarioAtual}</strong> e atribuído ao <strong>${nomeFuncionarioNovo}</strong>.<br><br>`,
                                icon: 'warning',
                                confirmButtonColor: '#3085d6',
                                confirmButtonText: 'Ok, entendido'
                            }).then(() => {
                                // Só processa após o usuário confirmar o aviso
                                processarSelecaoFuncionario(select, selectedOption, idFuncionarioSelecionado);
                            });

                        } else if (result.isDenied) {
                            // Limpa tudo e carrega o novo funcionário do zero
                            currentEditingStaffEvent = null;
                            limparCamposEvento();
                            processarSelecaoFuncionario(select, selectedOption, idFuncionarioSelecionado);

                        } else {
                            // Cancelou: reverte o select para o funcionário anterior
                            const idFuncionarioAnterior = currentEditingStaffEvent.idfuncionario;
                            $(select).val(idFuncionarioAnterior).trigger('change.select2');
                        }
                    });

                    return; // ← ESSENCIAL: impede que o fluxo normal continue enquanto o Swal está aberto
                }

                // --- Fluxo normal: nenhum evento carregado ---
                processarSelecaoFuncionario(select, selectedOption, idFuncionarioSelecionado);                

            });

        });
    }catch(error){
    console.error("Erro ao carregar funcao:", error);
    }
}

function processarSelecaoFuncionario(selectEl, selectedOption, idFuncionarioSelecionado) {
    document.getElementById("apelidoFuncionario").value = selectedOption.getAttribute("data-apelido");
    document.getElementById("idFuncionario").value = selectedOption.getAttribute("data-idfuncionario");
    document.getElementById("perfilFuncionario").value = selectedOption.getAttribute("data-perfil");


    const avaliacaoRaw = selectedOption.getAttribute("data-avaliacao") || '';
    console.log('1. Raw do data-avaliacao:', avaliacaoRaw);
    const avaliacaoNormalizada = normalizarAvaliacao(avaliacaoRaw);
    console.log('2. Após normalizar:', avaliacaoNormalizada);
    document.getElementById("avaliacao").value = avaliacaoNormalizada;
    console.log('3. select.value após setar:', document.getElementById("avaliacao").value);
    mostrarTarja();


    const perfilSelecionado = selectedOption.getAttribute("data-perfil");
    const labelFuncionario = document.getElementById("labelFuncionario");
    const avaliacaoSelect = document.getElementById("avaliacao");
    const tarjaDiv = document.getElementById("tarjaAvaliacao");
    const qtdPessoasDiv = document.querySelector('label[for="lote"]').closest('.field');
    console.log("Perfil selecionado:", perfilSelecionado);

    if (perfilSelecionado) {
        labelFuncionario.style.display = "block";
        
        if (perfilSelecionado.toLowerCase() === "freelancer") {
            isLote = false;
            labelFuncionario.textContent = "FREE-LANCER";
            labelFuncionario.style.color = "red";
        } else if ((perfilSelecionado.toLowerCase() === "interno") || (perfilSelecionado.toLowerCase() === "externo")) {
            isLote = false;
            labelFuncionario.textContent = "FUNCIONÁRIO";
            labelFuncionario.style.color = "green";           

            if (baseCheck) baseCheck.checked = true;
            if (seniorCheck) seniorCheck.disabled = true;
            if (seniorCheck2) seniorCheck2.disabled = true;
            if (seniorCheck2) seniorCheck2.disabled = true;
            if (plenoCheck) plenoCheck.disabled = true;
            if (juniorCheck) juniorCheck.disabled = true;
            if (baseCheck) baseCheck.disabled = false;
            if (fechadoCheck) fechadoCheck.disabled = false; 
            if (liberadoCheck) liberadoCheck.disabled = false;  

            const selectFuncao = document.querySelector(".descFuncao");
            const optionFuncaoAtual = selectFuncao?.options[selectFuncao.selectedIndex];
            const vlrFuncionarioAtual = parseFloat(optionFuncaoAtual?.getAttribute("data-vlrfuncionario") || 0);
            const descFuncaoAtual = optionFuncaoAtual?.textContent.trim().toUpperCase() || '';
            const isAjudante = descFuncaoAtual === "AJUDANTE DE MARCAÇÃO";

            if (perfilSelecionado.toLowerCase() === "externo")
            {
                document.getElementById("vlrCusto").value = "0,00";
                descBeneficioTextarea.value = "Funcionário externo Não recebe Cachê, apenas benefícios (alimentação e transporte) conforme função";
            }
            if (perfilSelecionado.toLowerCase() === "interno")
            {
               document.getElementById("vlrCusto").value = vlrFuncionarioAtual.toFixed(2).replace('.', ',');
               descBeneficioTextarea.value = "Cachê é pago se escala cair em Fim de Semana ou Feriado";
            }
            
            // AJUDANTE interno/externo: tem alimentação e transporte
            // Qualquer outra função interno/externo: tem alimentação e transporte
            // (só freelancer AJUDANTE não tem)
            document.getElementById("alimentacao").value = (parseFloat(vlrAlimentacaoFuncao) || 0).toFixed(2).replace('.', ','); 
            document.getElementById("transporte").value = (parseFloat(vlrTransporteFuncao) || 0).toFixed(2).replace('.', ',');
            
            if (typeof calcularValorTotal === 'function') calcularValorTotal();

        } else if (perfilSelecionado.toLowerCase() === "lote") {
            isLote = true;
            labelFuncionario.textContent = "LOTE";
            labelFuncionario.style.color = "blue";                    
        }

        // Para freelancer e lote: relê variáveis globais da função e reaplica nível
        // Para freelancer e lote: relê variáveis globais da função e reaplica nível
    if (perfilSelecionado.toLowerCase() !== "interno" && perfilSelecionado.toLowerCase() !== "externo") {
        const selectFuncao = document.querySelector(".descFuncao");
        const optionFuncaoAtual = selectFuncao?.options[selectFuncao.selectedIndex];
        
        if (optionFuncaoAtual && optionFuncaoAtual.value !== "") {
            vlrCustoSeniorFuncao = parseFloat(optionFuncaoAtual.getAttribute("data-ctosenior")) || 0;
            vlrCustoSeniorFuncao2 = parseFloat(optionFuncaoAtual.getAttribute("data-ctosenior2")) || 0;
            vlrCustoPlenoFuncao = parseFloat(optionFuncaoAtual.getAttribute("data-ctopleno")) || 0;
            vlrCustoJuniorFuncao = parseFloat(optionFuncaoAtual.getAttribute("data-ctojunior")) || 0;
            vlrCustoBaseFuncao = parseFloat(optionFuncaoAtual.getAttribute("data-ctobase")) || 0;
            vlrAlimentacaoFuncao = parseFloat(optionFuncaoAtual.getAttribute("data-alimentacao")) || 0;
            vlrTransporteFuncao = parseFloat(optionFuncaoAtual.getAttribute("data-transporte")) || 0;

            const descFuncaoAtual = optionFuncaoAtual.textContent.trim().toUpperCase();
            const isFuncaoTravada = descFuncaoAtual === "AJUDANTE DE MARCAÇÃO" || descFuncaoAtual === "FISCAL DE MARCAÇÃO";
            const isAjudante = descFuncaoAtual === "AJUDANTE DE MARCAÇÃO";

            // Só reabilita se NÃO for função travada
            if (!isFuncaoTravada) {
                if (seniorCheck)  seniorCheck.disabled = false;
                if (seniorCheck2) seniorCheck2.disabled = false;
                if (plenoCheck)   plenoCheck.disabled = false;
                if (juniorCheck)  juniorCheck.disabled = false;
                if (baseCheck)    baseCheck.disabled = false;
            }

            if (isAjudante) {
                document.getElementById("vlrCusto").value = (parseFloat(vlrCustoBaseFuncao) || 0).toFixed(2).replace('.', ',');
                document.getElementById("alimentacao").value = (0).toFixed(2).replace('.', ',');
                document.getElementById("transporte").value = (0).toFixed(2).replace('.', ',');
                if (typeof calcularValorTotal === 'function') calcularValorTotal();

            } else {
                if (typeof onCriteriosChanged === 'function') onCriteriosChanged();
            }
            
        }
    }

    } else {
        labelFuncionario.style.display = "none";
    }

    if (perfilSelecionado && perfilSelecionado.toLowerCase() === 'lote') {
        qtdPessoasDiv.style.display = 'block';
    } else {
        qtdPessoasDiv.style.display = 'none';
        document.getElementById('qtdPessoas').value = '';
    }
    

    const fotoPathFromData = selectedOption.getAttribute("data-foto"); // Este é o caminho real da foto

    // Referências aos elementos DOM que serão manipulados
    const nomeFuncionarioInput = document.getElementById("nmFuncionario");
    const previewFotoImg = document.getElementById('previewFoto');
    const fileNameSpan = document.getElementById('fileName');
    const uploadHeaderDiv = document.getElementById('uploadHeader');
    const fileInput = document.getElementById('file'); // Referência ao input type="file"

    // --- Lógica para exibir a foto ---
    if (previewFotoImg) {
        console.log("Preview",nomeFuncionarioInput );
        if (fotoPathFromData) {

            previewFotoImg.src = `/${fotoPathFromData}`;
            previewFotoImg.alt = `Foto de ${nomeFuncionarioInput || 'funcionário'}`; // Alt text para acessibilidade
            previewFotoImg.style.display = 'block'; // Mostra a imagem

            if (fileInput) {
                fileInput.value = '';
            }

            if (uploadHeaderDiv) {
                uploadHeaderDiv.style.display = 'none'; // Esconde o cabeçalho de upload
            }
            if (fileNameSpan) {
                // Pega o nome do arquivo da URL (última parte após a última barra)
                const fileName = fotoPathFromData.split('/').pop();
                fileNameSpan.textContent = fileName || 'Foto carregada';
            }
        } else {
            // Se não há foto (fotoPathFromData é nulo ou vazio), reseta e esconde os elementos
            previewFotoImg.src = '#'; // Reseta o src
            previewFotoImg.alt = 'Sem foto';
            previewFotoImg.style.display = 'none'; // Esconde a imagem

            if (uploadHeaderDiv) {
                uploadHeaderDiv.style.display = 'block'; // Mostra o cabeçalho de upload
            }
            if (fileNameSpan) {
                fileNameSpan.textContent = 'Nenhum arquivo selecionado';
            }
        }
    }
    carregarTabelaStaff(idFuncionarioSelecionado);
    
    calcularValorTotal();
}

function normalizarAvaliacao(valor) {
    if (!valor) return '';
    const map = {
        'MUITO BOM':           'muito_bom',
        'SATISFATORIO':        'satisfatorio',
        'SATISFATÓRIO':        'satisfatorio',
        'REGULAR':             'regular',
        'AVALIE O FUNCIONARIO':  '',   // placeholder → vazio
        'AVALIE O FUNCIONÁRIO':  '',
    };
    return map[valor.toUpperCase().trim()] ?? '';
}

function mostrarTarja() {
    const valor = document.getElementById("avaliacao").value;
    const tarjaDiv = document.getElementById("tarjaAvaliacao");

    const config = {
        muito_bom:   { texto: '⭐ MUITO BOM',     cor: '#1a7f37', fundo: '#d4edda' },
        satisfatorio:{ texto: '👍 SATISFATÓRIO',  cor: '#856404', fundo: '#fff3cd' },
        regular:     { texto: '⚠️ REGULAR',        cor: '#721c24', fundo: '#f8d7da' },
    };

    if (valor && config[valor]) {
        const { texto, cor, fundo } = config[valor];
        tarjaDiv.textContent = texto;
        tarjaDiv.style.cssText = `
            display: block;
            padding: 6px 14px;
            margin-top: 6px;
            border-radius: 4px;
            font-weight: bold;
            font-size: 0.85rem;
            color: ${cor};
            background-color: ${fundo};
            border: 1px solid ${cor};
        `;
    } else {
        tarjaDiv.textContent = '';
        tarjaDiv.style.display = 'none';
    }
}

async function  carregarClientesStaff() {
    //console.log("Função CARREGAR Cliente chamada");

    try{
        const clientes = await fetchComToken('staff/clientes');

        let selects = document.querySelectorAll(".nmCliente");

        selects.forEach(select => {

            const valorSelecionadoAtual = select.value;
            select.innerHTML = '<option value="">Selecione Cliente</option>';

            clientes.forEach(cliente => {
                let option = document.createElement("option");
                option.value = cliente.idcliente;
                option.textContent = cliente.nmfantasia;
                option.setAttribute("data-idcliente", cliente.idcliente);
                option.setAttribute("data-nmfantasia", cliente.nmfantasia);
                // option.setAttribute("data-idCliente", cliente.idcliente);

                select.appendChild(option);
            });

            if (valorSelecionadoAtual) {
                 // Convertendo para string, pois o valor do select é sempre string.
                select.value = String(valorSelecionadoAtual);
            }


            // Evento de seleção de cliente
            select.addEventListener('change', function () {
            //  idCliente = this.value; // O value agora é o ID
            //  console.log("idCliente selecionado:", idCliente);
            const selectedOption = select.options[select.selectedIndex];
            //const nomeFantasia = this.value;
            document.getElementById("idCliente").value = selectedOption.getAttribute("data-idcliente");
            });
        });

    }
    catch(error){
        console.error("Erro ao carregar clientes:", error);
    }
}

async function carregarEventosStaff() {

    try{
        const eventos = await fetchComToken('/staff/eventos');

        let selects = document.querySelectorAll(".nmEvento");

        selects.forEach(select => {

            select.innerHTML = '<option value="">Selecione Evento</option>'; // Adiciona a opção padrão
            eventos.forEach(evento => {
                let option = document.createElement("option");

                option.value = evento.idevento;  // Atenção ao nome da propriedade (idMontagem)
                option.textContent = evento.nmevento;
                option.setAttribute("data-nmEvento", evento.nmevento);
                option.setAttribute("data-idEvento", evento.idevento);
                select.appendChild(option);

            });

            select.addEventListener('change', function () {

                const selectedOption = select.options[select.selectedIndex];

                document.getElementById("idEvento").value = selectedOption.getAttribute("data-idEvento");


            });

        });
    }catch(error){
        console.error("Erro ao carregar eventos:", error);
    }

}

let idMontagemSelecionado = "";

async function carregarLocalMontStaff() {
    try{
        const montagem = await fetchComToken('/staff/localmontagem');

        let selects = document.querySelectorAll(".nmLocalMontagem");

        const containerViagens = document.getElementById("containerViagens");
        
        // Oculta o container por padrão ao carregar a função
        if (containerViagens) {
            containerViagens.style.display = 'none';
        }

        selects.forEach(select => {

            select.innerHTML = '<option value="">Selecione Local de Montagem</option>';
            montagem.forEach(local => {
                let option = document.createElement("option");

                option.value = local.idmontagem;
                option.textContent = local.descmontagem;
                option.setAttribute("data-idMontagem", local.idmontagem);
                option.setAttribute("data-descmontagem", local.descmontagem);
                option.setAttribute("data-cidademontagem", local.cidademontagem);
                option.setAttribute("data-cidademontagem", local.cidademontagem);
                option.setAttribute("data-ufmontagem", local.ufmontagem);
                select.appendChild(option);

            });
            select.addEventListener("change", function () {
              const selectedOption = this.options[this.selectedIndex];

               document.getElementById("idMontagem").value = selectedOption.getAttribute("data-idMontagem");

               if(selectedOption.value === "") {
                   console.log("Nenhum local de montagem selecionado.");
                   if (containerViagens) {
                        containerViagens.style.display = 'none';
                    }
                   
               } else {   
                    console.log("Local de montagem selecionado:", selectedOption.textContent);                
                   if ((selectedOption.getAttribute("data-ufmontagem") !== "SP") || (selectedOption.getAttribute("data-cidademontagem") !== "SÃO PAULO")) {
                        //Swal.fire("Atenção", "O local de montagem selecionado está fora do estado de SP. Verifique os custos adicionais de deslocamento.", "warning");
                        bForaSP = true;
                        if (containerViagens) {
                            containerViagens.style.display = 'block'; // Mostra o container
                        }

                   }else {
                        bForaSP = false;
                        if (containerViagens) {
                            containerViagens.style.display = 'none'; // Oculta o container
                        }
                        document.getElementById('viagem1Check').checked = false; 
                        document.getElementById('viagem2Check').checked = false;
                        document.getElementById('viagem3Check').checked = false;
                   }
               }

               idMontagemSelecionado = selectedOption.value;

               const idorcamento = getUrlParameter('idorcamento');
               carregarPavilhaoStaff(idMontagemSelecionado, idorcamento);

            });

        });
    }catch(error){
        console.error("Erro ao carregar localmontagem:", error);
    }
}


async function carregarPavilhaoStaff(idMontagem, idorcamento = null, idfuncao = null) {
    if (!idMontagem || idMontagem === "") {
        console.warn("carregarPavilhaoStaff: idMontagem vazio. Limpando seleção de Pavilhão.");
        let selects = document.querySelectorAll(".nmPavilhao");
        selects.forEach(select => {
            select.innerHTML = '<option value="" selected disabled>Selecione o Pavilhão</option>';
            document.getElementById("idPavilhao").value = '';
        });
        return;
    }

    try {
        let url = `/staff/pavilhao?idmontagem=${idMontagem}`;
        if (idorcamento) url += `&idorcamento=${idorcamento}`;
        if (idfuncao) url += `&idfuncao=${idfuncao}`;
        const pavilhaofetch = await fetchComToken(url);
        let selects = document.querySelectorAll(".nmPavilhao");
        const hiddenInputParaNomes = document.getElementById("idPavilhao"); 

        selects.forEach(select => {
            select.innerHTML = ''; 

            let opcaoPadrao = document.createElement("option");
            opcaoPadrao.value = "";
            // opcaoPadrao.textContent = "Selecione o(s) Pavilhão(ões)";
            opcaoPadrao.selected = true;
            opcaoPadrao.disabled = true;
            select.appendChild(opcaoPadrao);

            // ✅ CORREÇÃO: Usando pavilhaofetch
            pavilhaofetch.forEach(localpav => { 
                let option = document.createElement("option");
                option.value = localpav.idpavilhao; 
                option.textContent = localpav.nmpavilhao;
                option.setAttribute("data-idPavilhao", localpav.idpavilhao);
                option.setAttribute("data-nmPavilhao", localpav.nmpavilhao);
                select.appendChild(option);
            });

            select.addEventListener("change", function () {
                const selectedOptions = Array.from(this.selectedOptions);
                
                const nomesSelecionados = selectedOptions
                    .filter(option => option.value !== "")
                    .map(option => option.textContent.trim());
                
                const stringNomes = nomesSelecionados.join(", ");

                if (hiddenInputParaNomes) {
                    hiddenInputParaNomes.value = stringNomes;
                    console.log(`Pavilhões para salvar no banco: ${stringNomes}`);
                }
            });
        });

        // Selecionar o pavilhão esperado se houver
        if (setorEsperado) {
            selects.forEach(select => {
                for (let i = 0; i < select.options.length; i++) {
                    const option = select.options[i];
                    if (option.textContent.toUpperCase().trim() === setorEsperado.toUpperCase().trim()) {
                        select.value = option.value;
                        select.dispatchEvent(new Event('change'));
                        break;
                    }
                }
            });
        }
    } catch (error) {
        console.error("❌ Erro ao carregar pavilhao:", error);
    }
}



function limparCamposEvento() {
    console.log("Limpeza parcial do formulário iniciada (apenas campos do evento).");
    bLiberacaoAutorizada = false; 

    const btn = document.getElementById('Enviar');
    if (btn) {
        btn.style.display = 'block';
        btn.disabled = false;
    }

    // 1. Lista principal de inputs (removido duplicados como ajusteCusto)
    const camposEvento = [
        "idStaff", "descFuncao", "vlrCusto", "ajusteCusto", "transporte", "alimentacao", "caixinha",
        "nmLocalMontagem", "nmPavilhao", "nmCliente", "nmEvento", "vlrTotal",
        "vlrTotalHidden", "idFuncao", "idMontagem", "idPavilhao", "idCliente", "idEvento", "statusPgto",
        "statusAjusteCusto", "statusCaixinha", "statusDiariaDobrada", "descDiariaDobrada", "statusMeiaDiaria",
        "descMeiaDiaria", "qtdPessoas", "idequipe", "nmEquipe",
        "selectStatusAjusteCusto", "selectStatusDiariaDobrada", "selectStatusMeiaDiaria",
        "diariaDobrada", "meiaDiaria", "vlrTotalCache", "vlrTotalAjdCusto",
        "statusPgtoAjudaCusto", "setor", "vlrTotalCache"
    ];

    camposEvento.forEach(id => {
        const campo = document.getElementById(id);
        if (campo) campo.value = "";
    });

    // Selects de status que não estão na lista principal
    const selectsParaLimpar = [
        'selectStatusAjusteCusto',
        'selectStatusDiariaDobrada', 
        'selectStatusMeiaDiaria',
        'selectStatusCustoFechado'
    ];
    selectsParaLimpar.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    // Inputs com classe preenchido (Flatpickr altInput gerado dinamicamente)
    document.querySelectorAll('.preenchido').forEach(el => {
        el.value = '';
    });

    // Limpa também os altInputs gerados pelo Flatpickr
    if (window.diariaDobradaPicker?.altInput) window.diariaDobradaPicker.altInput.value = '';
    if (window.meiaDiariaPicker?.altInput) window.meiaDiariaPicker.altInput.value = '';
    if (window.datasEventoPicker?.altInput) window.datasEventoPicker.altInput.value = '';

    document.querySelectorAll('.preenchido').forEach(el => el.value = '');

    // 2. Reset de Checkboxes (Unificado em uma única lista para evitar repetição)
    const checksParaLimpar = [
        'ajusteCustocheck', 'Caixinhacheck', 'meiaDiariaCheck', 'diariaDobradacheck',
        'Seniorcheck', 'Seniorcheck2', 'Plenocheck', 'Juniorcheck', 
        'Basecheck', 'Fechadocheck', 'Liberadocheck', 'viagem1Check', 
        'viagem2Check', 'viagem3Check', 'check50', 'check100'
    ];
    checksParaLimpar.forEach(id => {
        const cb = document.getElementById(id);
        if (cb) cb.checked = false;
    });

    // 3. Ocultar Textareas e resetar valores (Incluindo o descCustoFechado)
    const camposParaOcultar = [
        'descBeneficio', 'descAjusteCusto', 'descCaixinha', 
        'descMeiaDiaria', 'descDiariaDobrada', 'descCustoFechado'
    ];
    
    camposParaOcultar.forEach(id => {
        const elemento = document.getElementById(id);
        if (elemento) {
            elemento.style.display = 'none';
            elemento.required = false;
            elemento.value = '';
        }
    });

   
    // 4. Containers de Status e Wrappers (Ajustado para esconder as áreas de inputs)
    const containersParaLimpar = [
        'campoAjusteCusto', 'campoStatusAjusteCusto', // Crucial para esconder o Ajuste
        'campoCaixinha', 'campoStatusCaixinha', 
        'campoPgtoCaixinha', 'campoStatusPgtoCaixinha',
        'campoMeiaDiaria', 'campoStatusMeiaDiaria', 
        'campoDiariaDobrada', 'campoStatusDiariaDobrada',
        'containerStatusDiariaDobrada', 'containerStatusMeiaDiaria',
        'containerStatusAditivo', 'containerStatusExtraBonificado',
        'campoStatusCustoFechado', 'wrapperJustificativaCustoFechado'
    ];

    containersParaLimpar.forEach(id => {
        const container = document.getElementById(id);
        if (container) {
            if (id.startsWith('container')) container.innerHTML = '';
            container.style.display = 'none'; // Garante que a "caixa" do campo suma
        }
    });

    
    

    // 5. Reset de valores padrões de Status
    const statusPadrao = {
        'statusCaixinha': 'Autorização da Caixinha',
        'statusAjusteCusto': 'Autorização do Ajuste de Custo',
        'statusDiariaDobrada': 'Autorização de Diária Dobrada',
        'statusMeiaDiaria': 'Autorização de Meia Diária'
    };

    for (let id in statusPadrao) {
        const el = document.getElementById(id);
        if (el) el.value = statusPadrao[id];
    }

    // 6. Limpeza de Pickers e Complementos
    // if (window.diariaDobradaPicker) window.diariaDobradaPicker.clear();
    // if (window.meiaDiariaPicker) window.meiaDiariaPicker.clear();
    // if (window.datasEventoPicker) window.datasEventoPicker.clear();

    window.estLimpandoProgramaticamente = true;

    if (window.datasEventoPicker) {
        window.datasEventoPicker.clear();
        window.datasEventoNoCalendarioCache = []; // Limpa o cache junto!
    }
    if (window.diariaDobradaPicker) window.diariaDobradaPicker.clear();
    if (window.meiaDiariaPicker) window.meiaDiariaPicker.clear();

    window.estLimpandoProgramaticamente = false;

    currentEditingStaffEvent = null;

    // Força reset dos campos de totais calculados para o valor padrão
    const camposTotais = ["vlrTotal", "vlrTotalCache", "vlrTotalAjdCusto"];
    camposTotais.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "R$ 0,00";
    });

    // Reseta também os hiddens
    const camposHidden = ["vlrTotalHidden", "vlrTotalCacheHidden", "vlrTotalAjdCustoHidden"];
    camposHidden.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "0.00";
    });

    limparCamposComprovantes();
    limparStaffOriginal();

    window.dadosDiariaDobradaInjetar = null;
    window.justificativasSolicitacoesInjetar = null;
    window.vagasDisponiveisDobra = null;
    window.vlrCacheDobraSelecionado = 0;
    window.vlrAlimentacaoDobraSelecionado = 0;
    window.tipoExcecaoAtual = null;
    window.justificativaParaSalvar = null;
    window.bSalvarComoInativo = false;

    console.log("Limpeza parcial do formulário concluída.");
}


function limparCamposStaff() {
    console.log("Iniciando limpeza completa do formulário Staff.");

    currentEditingStaffEvent = null;

    window.statusPgtoCacheOriginalDoBanco = "";
    window.statusPgtoAjudaOriginalDoBanco = "";
    window.statusAnteriorMeiaDiaria = "";
    window.statusAnteriorDiariaDobrada = "";

    // 1. Reset de variáveis de controle
   // currentEditingStaffEvent = null;
  
    isFormLoadedFromDoubleClick = false;    

    // 2. Habilitar botão Enviar
    const btn = document.getElementById('Enviar');
    if (btn) {
        btn.style.display = 'block';
        btn.disabled = false;
    }

    // 3. Lista de campos de texto/valor simples
    const campos = [
        "idStaff", "nmFuncionario", "apelidoFuncionario", "linkFotoFuncionarios", "descFuncao", "vlrCusto",
        "nmLocalMontagem", "nmPavilhao", "alimentacao", "transporte", "vlrBeneficio", "descBeneficio",
        "nmCliente", "nmEvento", "vlrTotal", "vlrTotalHidden", "idFuncionario", "idFuncao", "idMontagem",
        "idPavilhao", "idCliente", "idEvento", "statusPgto", "statusPgtoAjudaCusto", "statusCaixinha", "statusAjusteCusto", 
        "statusDiariaDobrada", "descDiariaDobrada", "statusMeiaDiaria", "descMeiaDiaria", 
        "labelFuncionario", "perfilFuncionario", "qtdPessoas", "idequipe", "nmEquipe", "setor",
        "ajusteCusto", "caixinha", "meiaDiaria", "diariaDobrada", "avaliacao", "obsPosPgto", "vlrTotalAjdCusto", "vlrTotal", "vlrTotalCache"
    ];

    campos.forEach(id => {
        const campo = document.getElementById(id);
        if (campo) campo.value = "";

        if ($(campo).hasClass("select2-hidden-accessible")) {
                $(campo).val('').trigger('change.select2');
        }
    });

    const camposExtras = ["selectStatusCustoFechado", "statusCustoFechadoTexto"];
    camposExtras.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = ""; 
    });

    // 4. Reset de Checkboxes (Unificado para evitar repetições de Senior, Viagens, etc)
    const checksParaLimpar = [
        'ajusteCustocheck', 'Caixinhacheck', 'meiaDiariacheck', 'diariaDobradacheck',
        'Seniorcheck', 'Seniorcheck2', 'Plenocheck', 'Juniorcheck', 'Basecheck', 
        'Fechadocheck', 'Liberadocheck', 'viagem1Check', 'viagem2Check', 'viagem3Check', 
        'check50', 'check100'
    ];
    checksParaLimpar.forEach(id => {
        const cb = document.getElementById(id);
        if (cb) cb.checked = false;
    });

    // 5. Ocultar Textareas e torná-los não obrigatórios (Incluindo Custo Fechado)
    const textareasParaOcultar = [
        'descBeneficio', 'descAjusteCusto', 'descCaixinha', 
        'descMeiaDiaria', 'descDiariaDobrada', 'descCustoFechado'
    ];
    textareasParaOcultar.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.style.display = 'none';
            el.required = false;
            el.value = '';
        }
    });

    const obsPos = document.getElementById('obsPosPgto');
    if (obsPos) {
        obsPos.value = "";
    }
    const containerObs = document.getElementById('containerObsPosPgto');
    if (containerObs) {
        containerObs.style.display = 'none'; // Oculta o histórico no reset
    }

    const containersParaLimpar = [
        'containerStatusDiariaDobrada', 'containerStatusMeiaDiaria',
        'containerStatusAditivo', 'containerStatusExtraBonificado',
        'campoStatusDiariaDobrada', 'campoStatusMeiaDiaria', 'campoAjusteCusto',
        'campoCaixinha', 'campoStatusCaixinha', 'campoPgtoCaixinha',
        'campoStatusCustoFechado', 'wrapperJustificativaCustoFechado'
    ];

    containersParaLimpar.forEach(id => {
        const container = document.getElementById(id);
        if (container) {
            if (id.startsWith('container')) container.innerHTML = '';
            container.style.display = 'none';
        }
    });

    // 6. Containers, Wrappers e Status Visuais
    const containersParaOcultar = [
        'campoAjusteCusto', 'campoStatusAjusteCusto', 'campoCaixinha', 'campoStatusCaixinha', 
        'campoPgtoCaixinha', 'campoMeiaDiaria', 'campoStatusMeiaDiaria', 'campoDiariaDobrada', 
        'campoStatusDiariaDobrada', 'containerStatusDiariaDobrada', 'containerStatusMeiaDiaria', 
        'containerStatusAditivo', 'containerStatusExtraBonificado', 'campoStatusCustoFechado',
        'wrapperJustificativaCustoFechado', 'labelFuncionario'
    ];
    containersParaOcultar.forEach(id => {
        const container = document.getElementById(id);
        if (container) {
            if (id.startsWith('container')) container.innerHTML = '';
            container.style.display = 'none';
        }
    });

    // 7. Reset de valores de Status Padrão (Strings de Autorização)
    const statusPadrao = {
        'statusMeiaDiaria': 'Autorização de Meia Diária',
        'statusDiariaDobrada': 'Autorização de Diária Dobrada',
        'statusAjusteCusto': 'Autorização do Ajuste de Custo',
        'statuscaixinha': 'Autorização da Caixinha',
        'selectStatusCustoFechado': ''
       
    };
    for (let id in statusPadrao) {
        const el = document.getElementById(id);
        if (el) el.value = statusPadrao[id];
    }

    const statusTexto = document.getElementById('statusCustoFechadoTexto');
    if (statusTexto) statusTexto.value = "";

    // 8. Limpeza de Foto e Uploads
    if (document.getElementById('previewFoto')) {
        const preview = document.getElementById('previewFoto');
        preview.src = "#";
        preview.style.display = "none";
    }
    if (document.getElementById('fileName')) document.getElementById('fileName').textContent = "Nenhum arquivo selecionado";
    if (document.getElementById('file')) document.getElementById('file').value = "";
    if (document.getElementById('uploadHeader')) document.getElementById('uploadHeader').style.display = "block";
    if (document.getElementById('nomeFuncionarioExibido')) document.getElementById('nomeFuncionarioExibido').textContent = "";

    // 9. Pickers (Flatpickr) e Contadores
    // if (window.datasEventoPicker) window.datasEventoPicker.clear();
    // if (window.diariaDobradaPicker) window.diariaDobradaPicker.clear();
    // if (window.meiaDiariaPicker) window.meiaDiariaPicker.clear();


    window.estLimpandoProgramaticamente = true;

    if (window.datasEventoPicker) {
        window.datasEventoPicker.clear();
        window.datasEventoNoCalendarioCache = []; // Limpa o cache junto!
    }
    if (window.diariaDobradaPicker) window.diariaDobradaPicker.clear();
    if (window.meiaDiariaPicker) window.meiaDiariaPicker.clear();

    window.estLimpandoProgramaticamente = false;
    
    const contador = document.getElementById('contadorDatas');
    if (contador) contador.textContent = "Nenhuma data selecionada.";

   // 10. Limpeza de Select Multiple (Pavilhão) e Div Temporária
    const selectPavilhao = document.getElementById('nmPavilhao');
    if (selectPavilhao) {
        selectPavilhao.innerHTML = ""; // Isso remove todas as opções (nomes dos pavilhões)
        console.log("Opções de pavilhões removidas.");
    }
 

    // 11. Limpeza de PDFs (Classes)
    document.querySelectorAll('.fileNamePDF').forEach(p => p.textContent = "Nenhum arquivo selecionado");
    document.querySelectorAll('.filePDFInput, .hiddenPDF').forEach(input => input.value = "");

    // 12. Tarja de Avaliação
    const tarjaAvaliacao = document.getElementById('tarjaAvaliacao');
    if (tarjaAvaliacao) {
        tarjaAvaliacao.className = 'tarja-avaliacao';
        tarjaAvaliacao.textContent = '';
    }

    // 13. Limpeza da Tabela
    const tabelaCorpo = document.querySelector("#eventsDataTable tbody");
    if (tabelaCorpo) {
        tabelaCorpo.innerHTML = `<tr><td colspan="20" style="text-align:center; padding:20px;">Nenhum item adicionado.</td></tr>`;
    }

     // Força reset dos campos de totais calculados para o valor padrão
    const camposTotais = ["vlrTotal", "vlrTotalCache", "vlrTotalAjdCusto"];
    camposTotais.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "R$ 0,00";
    });

    // Reseta também os hiddens
    const camposHidden = ["vlrTotalHidden", "vlrTotalCacheHidden", "vlrTotalAjdCustoHidden"];
    camposHidden.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "0.00";
    });

    // Funções auxiliares externas
    limparCamposComprovantes();
    limparFoto();
    limparStaffOriginal();

    window.dadosDiariaDobradaInjetar = null;
    window.justificativasSolicitacoesInjetar = null;
    window.vagasDisponiveisDobra = null;
    window.vlrCacheDobraSelecionado = 0;
    window.vlrAlimentacaoDobraSelecionado = 0;
    window.nomeFuncaoDobraSelecionadoAoVivo = "";
    window.tipoExcecaoAtual = null;
    window.justificativaParaSalvar = null;
    window.bSalvarComoInativo = false;


    console.log("StaffOriginal e campos resetados com sucesso.");
}



async function limparCamposStaffParcial() {
    console.log("Iniciando limpeza parcial do Staff (Funcionário e Valores).");

    // 1. Reset de variáveis de controle e Foto
    currentEditingStaffEvent = null;
    //currentEditingStaffEvent = {};
    isFormLoadedFromDoubleClick = false;

    window.statusPgtoCacheOriginalDoBanco = ""; // Limpa o status de pagamento anterior
    window.statusPgtoAjudaOriginalDoBanco = "";
    window.statusAnteriorMeiaDiaria = "";
    window.statusAnteriorDiariaDobrada = "";

    const idsFoto = ['previewFoto', 'fileName', 'file', 'uploadHeader', 'linkFotoFuncionarios', 'nomeFuncionarioExibido', 'labelFuncionario'];
    idsFoto.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        if (id === 'previewFoto') { el.src = "#"; el.style.display = "none"; }
        else if (id === 'fileName') el.textContent = "Nenhum arquivo selecionado";
        else if (id === 'uploadHeader') el.style.display = "block";
        else if (id === 'nomeFuncionarioExibido' || id === 'labelFuncionario') {
            el.textContent = "";
            if (id === 'labelFuncionario') { el.style.display = "none"; el.style.color = ""; }
        } else { el.value = ""; }
    });


    // 2. Identificação da Função (Regra de Negócio para Níveis)
    const descfuncaoElement = document.getElementById('descFuncao'); 
    const descfuncaoAtual = (descfuncaoElement ? descfuncaoElement.selectedOptions[0].text : '').trim().toUpperCase();
    const pularLimpezaNiveis = (descfuncaoAtual === 'AJUDANTE DE MARCAÇÃO');

    // 3. Limpeza de Inputs de Texto e Valores
    const camposTexto = [
        "idStaff", "idFuncionario", "nmFuncionario", "apelidoFuncionario", "perfilFuncionario",
        "vlrCusto", "transporte", "alimentacao", "caixinha", "vlrTotal", "vlrTotalCache", 
        "vlrTotalAjdCusto", "ajusteCusto", "avaliacao"
    ];
    camposTexto.forEach(id => {
        const campo = document.getElementById(id);
        if (campo) campo.value = "";
        if ($(campo).hasClass("select2-hidden-accessible")) {
                $(campo).val('').trigger('change.select2');
        }
    });

    // 4. Reset de Checkboxes (Unificado)
    const checksParaLimpar = ['ajusteCustocheck', 'Caixinhacheck', 'meiaDiariacheck', 'diariaDobradacheck', 'check50', 'check100', 'viagem1Check', 'viagem2Check', 'viagem3Check'];
       
    
    // Só adiciona os níveis à lista de limpeza se não for função de marcação
    if (!pularLimpezaNiveis) {
        checksParaLimpar.push('Seniorcheck', 'Seniorcheck2', 'Plenocheck', 'Juniorcheck', 'Basecheck', 'Fechadocheck', 'Liberadocheck');
    }

    checksParaLimpar.forEach(id => {
        const cb = document.getElementById(id);
        if (cb) cb.checked = false;
    });

    // 5. Ocultar Textareas e Justificativas (Incluindo Custo Fechado)
    const camposParaOcultar = [
        'descBeneficio', 'descAjusteCusto', 'descCaixinha', 
        'descMeiaDiaria', 'descDiariaDobrada', 'descCustoFechado'
    ];
    camposParaOcultar.forEach(id => {
        const elemento = document.getElementById(id);
        if (elemento) {
            elemento.style.display = 'none';
            elemento.required = false;
            elemento.value = '';
        }
    });

    // 6. Containers de Status, Inputs de Data e Wrappers
    const containersParaLimpar = [
        'containerStatusDiariaDobrada', 'containerStatusMeiaDiaria',
        'containerStatusAditivo', 'containerStatusExtraBonificado',
        'campoStatusCustoFechado', 'wrapperJustificativaCustoFechado',
        'datasDobrada', 'datasMeiaDiaria', 'statusAjusteCusto', 'statuscaixinha' // Inputs que você marcou como 🎯 Novo
    ];
    containersParaLimpar.forEach(id => {
        const container = document.getElementById(id);
        if (container) {
            if (id.startsWith('container')) container.innerHTML = '';
            container.style.display = 'none';
        }
    });

    // 7. Reset de Valores de Status Padrão
    const statusPadrao = {
        'statusMeiaDiaria': 'Autorização de Meia Diária',
        'statusDiariaDobrada': 'Autorização de Diária Dobrada',
        'statusAjusteCusto': 'Autorização do Ajuste de Custo',
        'statuscaixinha': 'Autorização da Caixinha',
        'statuspgto': '',
        'selectStatusCustoFechado': '', // ADICIONE ISSO: Limpa o status do custo fechado
        'statusCustoFechadoTexto': ''
    };
    for (let id in statusPadrao) {
        const el = document.getElementById(id);
        if (el) el.value = statusPadrao[id];
    }

    // 8. Flatpickr e Comprovantes
    if (window.diariaDobradaPicker) window.diariaDobradaPicker.clear();
    if (window.meiaDiariaPicker) window.meiaDiariaPicker.clear();
    
    // Limpeza de PDFs por classe
    document.querySelectorAll('.fileNamePDF').forEach(p => p.textContent = "Nenhum arquivo selecionado");
    document.querySelectorAll('.filePDFInput, .hiddenPDF').forEach(input => input.value = "");

    // 9. Reset da Tabela de Eventos
    const tabelaCorpo = document.querySelector("#eventsDataTable tbody");
    if (tabelaCorpo) {
        tabelaCorpo.innerHTML = `<tr><td colspan="20" style="text-align:center; padding:20px;">Nenhum item adicionado.</td></tr>`;
    }

    // 10. Tarja de Avaliação
    const tarjaAvaliacao = document.getElementById('tarjaAvaliacao');
    if (tarjaAvaliacao) {
        tarjaAvaliacao.className = 'tarja-avaliacao';
        tarjaAvaliacao.textContent = '';
    }

     // Força reset dos campos de totais calculados para o valor padrão
    const camposTotais = ["vlrTotal", "vlrTotalCache", "vlrTotalAjdCusto"];
    camposTotais.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "R$ 0,00";
    });

    // Reseta também os hiddens
    const camposHidden = ["vlrTotalHidden", "vlrTotalCacheHidden", "vlrTotalAjdCustoHidden"];
    camposHidden.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "0.00";
    });

    // Funções de limpeza externa
    limparCamposComprovantes();
    limparFoto();
    limparStaffOriginal();

    window.dadosDiariaDobradaInjetar = null;
    window.justificativasSolicitacoesInjetar = null;
    window.vagasDisponiveisDobra = null;
    window.vlrCacheDobraSelecionado = 0;
    window.vlrAlimentacaoDobraSelecionado = 0;
    window.tipoExcecaoAtual = null;
    window.justificativaParaSalvar = null;
    window.bSalvarComoInativo = false;



    Swal.fire({
        title: "Pronto para o próximo!",
        text: "Campos de funcionário/cachê e datas limpos. Prossiga com o novo cadastro.",
        icon: "info",
        timer: 2000,
        showConfirmButton: false
    });
}

function getPeriodoDatas(inputValue) {
    console.log("Valor do input recebido para período do evento:", inputValue);

    if (typeof inputValue !== 'string' || inputValue.trim() === '') {
        // Se o input estiver vazio, retorna um array vazio.
        return [];
    }

    // Divide a string por vírgulas e espaços, e remove espaços extras de cada parte
    const datasStringArray = inputValue.split(',').map(dateStr => dateStr.trim());

    const datasFormatadas = [];
    for (const dataStr of datasStringArray) {
        if (dataStr) { // Garante que não está processando strings vazias
            const dataFormatada = formatarDataParaBackend(dataStr);
            if (dataFormatada) {
                datasFormatadas.push(dataFormatada);
            } else {
                console.warn(`Data inválida encontrada no input: ${dataStr}. Será ignorada.`);
            }
        }
    }

    console.log("Datas formatadas para array:", datasFormatadas);
    return datasFormatadas; // Retorna um array de strings no formato YYYY-MM-DD
}

/**
 * Converte uma string de data (DD/MM/YYYY ou YYYY-MM-DD) para o formato YYYY-MM-DD.
 * @param {string} dataString - A string de data a ser formatada.
 * @returns {string|null} A data formatada como 'YYYY-MM-DD' ou null se for inválida.
 */
function formatarDataParaBackend(dataString) {
    if (!dataString) return null;

    // 1. Tenta validar o formato YYYY-MM-DD (usado pelo Flatpickr e backend)
    const isoMatch = dataString.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
        // Se a data JÁ ESTÁ no formato YYYY-MM-DD, retorna-a diretamente.
        // O Flatpickr geralmente fornece a data neste formato, mas sem hora/timezone.
        // Você pode adicionar validação extra aqui se precisar garantir que os valores são datas reais.
        return dataString;
    }

    // 2. Tenta validar o formato DD/MM/YYYY (formato brasileiro)
    const partes = dataString.split('/');
    if (partes.length === 3) {
        let dia = partes[0];
        let mes = partes[1];
        let ano = partes[2];
        
        // Validação básica para evitar NaN (Not a Number)
        if (isNaN(parseInt(dia)) || isNaN(parseInt(mes)) || isNaN(parseInt(ano))) {
             return null;
        }

        // Lógica de 2 dígitos (mantida)
        if (ano.length === 2) {
             const currentYear = new Date().getFullYear();
             const century = Math.floor(currentYear / 100) * 100;
             if (parseInt(ano) > (currentYear % 100)) {
                 ano = (century - 100) + parseInt(ano);
             } else {
                 ano = century + parseInt(ano);
             }
        }

        mes = mes.padStart(2, '0');
        dia = dia.padStart(2, '0');

        return `${ano}-${mes}-${dia}`; // Retorna no formato YYYY-MM-DD
    }

    return null; // Retorna null se nenhum dos formatos for reconhecido
}

function verificarStatusCache() {
    const isFechado = document.getElementById('Fechadocheck')?.checked;
    const isLiberado = document.getElementById('Liberadocheck')?.checked;

    // Se não é Fechado nem Liberado, não há restrição
    if (!isFechado && !isLiberado) return true;

    // Se é Fechado/Liberado, verifica o status
    const inputStatus = document.getElementById('statusCustoFechadoTexto')?.value || '';
    const selectStatus = document.getElementById('selectStatusCustoFechado')?.value || '';

    // ✅ Pega o que estiver visível/preenchido, ignorando 'none'
    const statusCache = (selectStatus && selectStatus !== 'none') 
        ? selectStatus 
        : inputStatus;

    const statusUpper = statusCache.trim().toUpperCase();

    if (statusUpper === 'PENDENTE' || statusUpper === '') {
        Swal.fire({
            title: 'Solicitação Bloqueada',
            text: 'A solicitação de adicionais está bloqueada até a liberação do Cachê Fechado/Liberado.',
            icon: 'warning',
            confirmButtonText: 'Entendi'
        });
        return false;
    }
    return true;
}

// AJUSTE DE CUSTO
document.getElementById('ajusteCustocheck').addEventListener('click', function(e) {
    // Se estiver desmarcado e o usuário tentar marcar
    if (!this.classList.contains('is-active') && !this.checked) {
        // Deixe o change lidar com a marcação, mas aqui validamos o bloqueio
    }
});

document.getElementById('ajusteCustocheck').addEventListener('change', function () {
    const campo = document.getElementById('campoAjusteCusto');
    const input = document.getElementById('ajusteCusto');
    const campoStatus = document.getElementById('campoStatusAjusteCusto');
    const inputStatus = document.getElementById('statusAjusteCusto');

    if (this.checked) {
        // Tenta marcar: Valida se pode
        if (!verificarStatusCache()) {
            this.checked = false; // Desmarca forçadamente
            return;
        }
        
        // Se puder marcar, mostra os campos
        campo.style.display = 'block';
        input.required = true;
        campoStatus.style.display = 'block';
        inputStatus.required = true;
    } else {
        // AO DESMARCAR: Remove obrigatoriedade ANTES de esconder
        input.required = false;
        inputStatus.required = false;
        
        campo.style.display = 'none';
        campoStatus.style.display = 'none';
        
        // Limpa os valores para não enviar lixo no POST
        input.value = '';
        inputStatus.value = '';
    }
});

// CAIXINHA
document.getElementById('Caixinhacheck').addEventListener('change', function () {
    const input = document.getElementById('caixinha');
    const inputStatus = document.getElementById('statusCaixinha');
    const inputPgto = document.getElementById('statusPgtoCaixinha');

    if (this.checked) {
        if (!verificarStatusCache()) {
            this.checked = false;
            return;
        }
        
        document.getElementById('campoCaixinha').style.display = 'block';
        document.getElementById('campoStatusCaixinha').style.display = 'block';
        document.getElementById('campoPgtoCaixinha').style.display = 'block';
        
        input.required = true;
        inputStatus.required = true;
        inputPgto.required = true;
    } else {
        input.required = false;
        inputStatus.required = false;
        inputPgto.required = false;

        document.getElementById('campoCaixinha').style.display = 'none';
        document.getElementById('campoStatusCaixinha').style.display = 'none';
        document.getElementById('campoPgtoCaixinha').style.display = 'none';
        
        input.value = '';
        inputStatus.value = '';
        inputPgto.value = '';
    }
});

function registrarListenersNivel() {
    document.getElementById('Seniorcheck').addEventListener('change', function () {
        if (this.checked) {
            if (verificarBloqueioStatusAutorizado(this)) return;   
            
            if (nivelOriginalCarregado === 'FECHADO' || nivelOriginalCarregado === 'LIBERADO') {
                console.log("ENTROU NA TROCA DE NIVEL", nivelOriginalCarregado);
                nivelFoiTrocado = true;
            }

            document.getElementById("vlrCusto").readOnly = true; // Torna o campo de custo não editável
            // Lógica para quando o checkbox de Senior estiver marcado
            if (!validarCamposEssenciais()) {
                this.checked = false; // Desmarca se a validação falhar
                return;
            }

            [seniorCheck2, plenoCheck, juniorCheck, baseCheck, fechadoCheck, liberadoCheck].forEach(c => {
                    if(c && c !== this) c.checked = false;
                });

            //console.log("Valores para Senior - Custo:", vlrCustoSeniorFuncao, "Alimentação:", vlrAlimentacao, "Transporte:", vlrTransporteSeniorFuncao);
            document.getElementById("alimentacao").value = (parseFloat(vlrAlimentacaoFuncao) || 0).toFixed(2);
            document.getElementById("vlrCusto").value = (parseFloat(vlrCustoSeniorFuncao) || 0).toFixed(2); 
            document.getElementById("transporte").value = (parseFloat(vlrTransporteSeniorFuncao) || 0).toFixed(2);

            document.getElementById('campoStatusCustoFechado').style.display = 'none';
            document.getElementById('wrapperJustificativaCustoFechado').style.display = 'none';
            if (descCustoFechadoTextarea) descCustoFechadoTextarea.style.display = 'none';

            const datasEventoInput = document.getElementById('datasEvento');
            if (datasEventoInput) {
                const periodoDatas = getPeriodoDatas(datasEventoInput.value);   
                
                if (periodoDatas.length > 0) {
                    console.log("➡️ Tentando chamar calcularValorTotal()..."); // LOG DE ENTRADA
                    calcularValorTotal();
                    console.log("⬅️ calcularValorTotal() chamado com sucesso (ou completou)."); // LOG DE SAÍDA
                }
                console.log("Período de datas obtido para Senior:", periodoDatas);
            }
        }

    });

    document.getElementById('Seniorcheck2').addEventListener('change', function () {
        if (this.checked) {   
            if (verificarBloqueioStatusAutorizado(this)) return;    
            if (nivelOriginalCarregado === 'FECHADO' || nivelOriginalCarregado === 'LIBERADO') {
                nivelFoiTrocado = true;
            } 

            document.getElementById("vlrCusto").readOnly = true; // Torna o campo de custo não editável
            // 1. Validação essencial igual ao seu Basecheck
            if (typeof validarCamposEssenciais === 'function' && !validarCamposEssenciais()) {
                this.checked = false; 
                return;
            }

            [seniorCheck, plenoCheck, juniorCheck, baseCheck, fechadoCheck, liberadoCheck].forEach(c => {
                    if(c && c !== this) c.checked = false;
                });

            // 3. Preenche custos (Usando o valor sênior conforme sua regra)
            // Certifique-se que vlrCustoSeniorFuncao esteja acessível aqui
            document.getElementById("vlrCusto").value = (parseFloat(vlrCustoSeniorFuncao2) || 0).toFixed(2);
            document.getElementById("alimentacao").value = (parseFloat(vlrAlimentacaoFuncao) || 0).toFixed(2);   
            document.getElementById("transporte").value = (parseFloat(vlrTransporteFuncao) || 0).toFixed(2);

            document.getElementById('campoStatusCustoFechado').style.display = 'none';
            document.getElementById('wrapperJustificativaCustoFechado').style.display = 'none';
            if (descCustoFechadoTextarea) descCustoFechadoTextarea.style.display = 'none';

            // 4. Cálculo de Total
            const datasEventoInput = document.getElementById('datasEvento');
            if (datasEventoInput && typeof getPeriodoDatas === 'function') {
                const periodoDatas = getPeriodoDatas(datasEventoInput.value);   
                if (periodoDatas.length > 0 && typeof calcularValorTotal === 'function') {
                    calcularValorTotal();
                }
            }
        }
    });

    document.getElementById('Plenocheck').addEventListener('change', function () {
        if (this.checked) {
            if (verificarBloqueioStatusAutorizado(this)) return;
            if (nivelOriginalCarregado === 'FECHADO' || nivelOriginalCarregado === 'LIBERADO') {
                nivelFoiTrocado = true;
            }
        
            document.getElementById("vlrCusto").readOnly = true; // Torna o campo de custo não editável
            // Lógica para quando o checkbox de Pleno estiver marcado
            if (!validarCamposEssenciais()) {
                this.checked = false; // Desmarca se a validação falhar
                return;
            }
            [seniorCheck2, seniorCheck, juniorCheck, baseCheck, fechadoCheck, liberadoCheck].forEach(c => {
                    if(c && c !== this) c.checked = false;
                });
            
            document.getElementById("vlrCusto").value = (parseFloat(vlrCustoPlenoFuncao) || 0).toFixed(2);   
            document.getElementById("alimentacao").value = (parseFloat(vlrAlimentacaoFuncao) || 0).toFixed(2);
            document.getElementById("transporte").value = (parseFloat(vlrTransporteFuncao) || 0).toFixed(2);

                        document.getElementById('campoStatusCustoFechado').style.display = 'none';
            document.getElementById('wrapperJustificativaCustoFechado').style.display = 'none';
            if (descCustoFechadoTextarea) descCustoFechadoTextarea.style.display = 'none';
        
            const datasEventoInput = document.getElementById('datasEvento');
            if (datasEventoInput) {
                const periodoDatas = getPeriodoDatas(datasEventoInput.value);   
                
                if (periodoDatas.length > 0) {
                    console.log("➡️ Tentando chamar calcularValorTotal()..."); // LOG DE ENTRADA
                    calcularValorTotal();
                    console.log("⬅️ calcularValorTotal() chamado com sucesso (ou completou)."); // LOG DE SAÍDA
                }
                console.log("Período de datas obtido para Pleno:", periodoDatas);
            }
        }
    });

    document.getElementById('Juniorcheck').addEventListener('change', function () {
        if (this.checked) {
            if (verificarBloqueioStatusAutorizado(this)) return;
            if (nivelOriginalCarregado === 'FECHADO' || nivelOriginalCarregado === 'LIBERADO') {
                nivelFoiTrocado = true;
            }
            
            document.getElementById("vlrCusto").readOnly = true; // Torna o campo de custo não editável
            // Lógica para quando o checkbox de Junior estiver marcado
            if (!validarCamposEssenciais()) {
                this.checked = false; // Desmarca se a validação falhar
                return;
            }

            [seniorCheck2, seniorCheck, plenoCheck, baseCheck, fechadoCheck, liberadoCheck].forEach(c => {
                    if(c && c !== this) c.checked = false;
            });

            document.getElementById("vlrCusto").value = (parseFloat(vlrCustoJuniorFuncao) || 0).toFixed(2); 
            document.getElementById("alimentacao").value = (parseFloat(vlrAlimentacaoFuncao) || 0).toFixed(2);  
            document.getElementById("transporte").value = (parseFloat(vlrTransporteFuncao) || 0).toFixed(2);

                        document.getElementById('campoStatusCustoFechado').style.display = 'none';
            document.getElementById('wrapperJustificativaCustoFechado').style.display = 'none';
            if (descCustoFechadoTextarea) descCustoFechadoTextarea.style.display = 'none';
        
            const datasEventoInput = document.getElementById('datasEvento');
            if (datasEventoInput) {
                const periodoDatas = getPeriodoDatas(datasEventoInput.value);   
                
                if (periodoDatas.length > 0) {
                    console.log("➡️ Tentando chamar calcularValorTotal()..."); // LOG DE ENTRADA
                    calcularValorTotal();
                    console.log("⬅️ calcularValorTotal() chamado com sucesso (ou completou)."); // LOG DE SAÍDA
                }
                console.log("Período de datas obtido para Junior:", periodoDatas);
            }

        }
    });

    document.getElementById('Basecheck').addEventListener('change', function () {
        if (this.checked) {
            if (verificarBloqueioStatusAutorizado(this)) return;

            if (nivelOriginalCarregado === 'FECHADO' || nivelOriginalCarregado === 'LIBERADO') {
                nivelFoiTrocado = true;
            }
        
            document.getElementById("vlrCusto").readOnly = true; // Torna o campo de custo não editável
            // Lógica para quando o checkbox de Base estiver marcado

            if (!validarCamposEssenciais()) {
                this.checked = false; // Desmarca se a validação falhar
                return;
            }
            [seniorCheck2, seniorCheck, plenoCheck, juniorCheck, fechadoCheck, liberadoCheck].forEach(c => {
                    if(c && c !== this) c.checked = false;
                });
            

            document.getElementById("vlrCusto").value = (parseFloat(vlrCustoBaseFuncao) || 0).toFixed(2);
            document.getElementById("alimentacao").value = (parseFloat(vlrAlimentacaoFuncao) || 0).toFixed(2);   
            document.getElementById("transporte").value = (parseFloat(vlrTransporteFuncao) || 0).toFixed(2);

                        document.getElementById('campoStatusCustoFechado').style.display = 'none';
            document.getElementById('wrapperJustificativaCustoFechado').style.display = 'none';
            if (descCustoFechadoTextarea) descCustoFechadoTextarea.style.display = 'none';

            const datasEventoInput = document.getElementById('datasEvento');
            if (datasEventoInput) {
                const periodoDatas = getPeriodoDatas(datasEventoInput.value);   
                
                if (periodoDatas.length > 0) {
                    console.log("➡️ Tentando chamar calcularValorTotal()..."); // LOG DE ENTRADA
                    calcularValorTotal();
                    console.log("⬅️ calcularValorTotal() chamado com sucesso (ou completou)."); // LOG DE SAÍDA
                }
                console.log("Período de datas obtido para Base:", periodoDatas);
            }
        }
    });

    document.getElementById('Fechadocheck').addEventListener('change', function () {
        if (verificarBloqueioStatusAutorizado(this)) return;

        if (this.checked) {        
            console.log("ENTROU NO FECHADOCHECK");
            
            if (!validarCamposEssenciais()) {
                this.checked = false;
                return;
            }

            [seniorCheck2, seniorCheck, plenoCheck, juniorCheck, baseCheck, liberadoCheck].forEach(c => {
                if(c && c !== this) c.checked = false;
            });

            if (!isFormLoadedFromDoubleClick) {
                // Se está editando um registro existente → restaura valor do banco
                if (currentEditingStaffEvent?.nivelexperiencia?.toUpperCase() === 'FECHADO') {
                    document.getElementById("vlrCusto").value = parseFloat(currentEditingStaffEvent.vlrcache || 0).toFixed(2);
                    document.getElementById("alimentacao").value = parseFloat(currentEditingStaffEvent.vlralimentacao || 0).toFixed(2);
                    document.getElementById("transporte").value = parseFloat(currentEditingStaffEvent.vlrtransporte || 0).toFixed(2);
                    restaurarStatusCustoFechado();
                    console.log("↩️ Restaurando valores do banco para Fechado.");
                } else {
                    // Novo registro → zera
                    document.getElementById("vlrCusto").value = (0).toFixed(2);
                    document.getElementById("alimentacao").value = (0).toFixed(2);
                    document.getElementById("transporte").value = (0).toFixed(2);

                    document.getElementById('campoStatusCustoFechado').style.display = 'flex';
                    document.getElementById('wrapperJustificativaCustoFechado').style.display = 'block';
                    if (descCustoFechadoTextarea) descCustoFechadoTextarea.style.display = 'block';
                }
            }
        }
    });

    document.getElementById('Liberadocheck').addEventListener('change', function () {
        console.log("ENTROU NO LIBERADO", isFormLoadedFromDoubleClick);
        if (verificarBloqueioStatusAutorizado(this)) return;

        if (this.checked) {
            if (!validarCamposEssenciais()) {
                this.checked = false;
                return;
            }

            [seniorCheck2, seniorCheck, plenoCheck, juniorCheck, baseCheck, fechadoCheck].forEach(c => {
                if(c && c !== this) c.checked = false;
            });

            if (!isFormLoadedFromDoubleClick) {
                // Se está editando um registro existente → restaura valor do banco
                if (currentEditingStaffEvent?.nivelexperiencia?.toUpperCase() === 'LIBERADO') {
                    document.getElementById("vlrCusto").value = parseFloat(currentEditingStaffEvent.vlrcache || 0).toFixed(2);
                    document.getElementById("alimentacao").value = parseFloat(currentEditingStaffEvent.vlralimentacao || 0).toFixed(2);
                    document.getElementById("transporte").value = parseFloat(currentEditingStaffEvent.vlrtransporte || 0).toFixed(2);
                    restaurarStatusCustoFechado();
                    console.log("↩️ Restaurando valores do banco para Liberado.");
                } else {
                    // Novo registro → zera cache, mantém alimentação e transporte da função
                    document.getElementById("vlrCusto").value = (0).toFixed(2);
                    document.getElementById("alimentacao").value = (parseFloat(vlrAlimentacaoFuncao) || 0).toFixed(2);   
                    document.getElementById("transporte").value = (parseFloat(vlrTransporteFuncao) || 0).toFixed(2);

                    document.getElementById('campoStatusCustoFechado').style.display = 'flex';
                    document.getElementById('wrapperJustificativaCustoFechado').style.display = 'block';
                    if (descCustoFechadoTextarea) descCustoFechadoTextarea.style.display = 'block';

                    const datasEventoInput = document.getElementById('datasEvento');
                    if (datasEventoInput) {
                        const periodoDatas = getPeriodoDatas(datasEventoInput.value);   
                        if (periodoDatas.length > 0) calcularValorTotal();
                    }
                }
            }
        } 
    });

    document.getElementById('viagem1Check').addEventListener('change', function () {
    const textoParaLimpar = descBeneficioTextarea.value;
    let descBeneficioAtual = limparDescricoesViagem(textoParaLimpar);

    if (this.checked) {
        [viagem2Check, viagem3Check].forEach(c =>{if(c) c.checked = false;});
        const vlrAlimentacaoViagem1 = (parseFloat(vlrAlimentacaoFuncao) || 0) * 2;
        document.getElementById("alimentacao").value = vlrAlimentacaoViagem1.toFixed(2);
        document.getElementById("transporte").value = (0).toFixed(2)

        const isFechadoOuLiberado = fechadoCheck?.checked || liberadoCheck?.checked;
        document.getElementById("alimentacao").readOnly = !isFechadoOuLiberado;
        document.getElementById("transporte").readOnly = !isFechadoOuLiberado;

        // Texto
        let separador = descBeneficioAtual.trim().length > 0 ? "\n\n" : "";
        descBeneficioTextarea.value = descBeneficioAtual + separador + DescViagem1;
    } else {
        // Reset para o padrão da função
        document.getElementById("alimentacao").value = (parseFloat(vlrAlimentacaoFuncao) || 0).toFixed(2);
        document.getElementById("transporte").value = (parseFloat(vlrTransporteFuncao) || 0).toFixed(2);

        document.getElementById("alimentacao").readOnly = false;
        document.getElementById("transporte").readOnly = false;
        descBeneficioTextarea.value = descBeneficioAtual;
    }
    calcularValorTotal();
    });

    document.getElementById('viagem2Check').addEventListener('change', function () { 
        const textoParaLimpar = descBeneficioTextarea.value;
        let descBeneficioAtual = limparDescricoesViagem(textoParaLimpar);

        if (this.checked) {

            [viagem1Check, viagem3Check].forEach(c =>{ if(c) c.checked = false;});
            const vlrAlimentacaoViagem2 = ((parseFloat(vlrAlimentacaoFuncao) || 0) * 2) + ((parseFloat(vlrAlimentacaoFuncao) || 0) / 2);
            document.getElementById("alimentacao").value = vlrAlimentacaoViagem2.toFixed(2);
            document.getElementById("transporte").value = (0).toFixed(2)

            const isFechadoOuLiberado = fechadoCheck?.checked || liberadoCheck?.checked;
            document.getElementById("alimentacao").readOnly = !isFechadoOuLiberado;
            document.getElementById("transporte").readOnly = !isFechadoOuLiberado;

            let separador = descBeneficioAtual.trim().length > 0 ? "\n\n" : "";
            descBeneficioTextarea.value = descBeneficioAtual + separador + DescViagem2;

        }else {

            document.getElementById("alimentacao").value = (parseFloat(vlrAlimentacaoFuncao) || 0).toFixed(2);
            document.getElementById("transporte").value = (parseFloat(vlrTransporteFuncao) || 0).toFixed(2);

            document.getElementById("alimentacao").readOnly = false;
            document.getElementById("transporte").readOnly = false;

            descBeneficioTextarea.value = descBeneficioAtual;
        }
        calcularValorTotal();
    });

    document.getElementById('viagem3Check').addEventListener('change', function () { 
        const textoParaLimpar = descBeneficioTextarea.value;
        let descBeneficioAtual = limparDescricoesViagem(textoParaLimpar);

        if (this.checked) {
            [viagem1Check,viagem2Check].forEach(c =>{if(c) c.checked = false;});

            document.getElementById("alimentacao").value = (parseFloat(vlrAlimentacaoFuncao) || 0).toFixed(2);
            document.getElementById("transporte").value = (parseFloat(vlrTransporteFuncao) || 0).toFixed(2)

            const isFechadoOuLiberado = fechadoCheck?.checked || liberadoCheck?.checked;
            document.getElementById("alimentacao").readOnly = !isFechadoOuLiberado;
            document.getElementById("transporte").readOnly = !isFechadoOuLiberado;

            let separador = descBeneficioAtual.trim().length > 0 ? "\n\n":""
                descBeneficioTextarea.value = descBeneficioAtual + separador + DescViagem3;

        } else {

                document.getElementById("alimentacao").value = (parseFloat(vlrAlimentacaoFuncao) || 0).toFixed(2);
                document.getElementById("transporte").value = (parseFloat(vlrTransporteFuncao) || 0).toFixed(2);

                document.getElementById("alimentacao").readOnly = false;
                document.getElementById("transporte").readOnly = false;
                descBeneficioTextarea.value = descBeneficioAtual;
        }
        calcularValorTotal();
    });

}

function restaurarStatusCustoFechado() {
    const statusFechadoBanco = currentEditingStaffEvent.statuscustofechado || 'Pendente';
    const txtDesc = document.getElementById('descCustoFechado');
    if (txtDesc) txtDesc.value = currentEditingStaffEvent.desccustofechado || '';
        txtDesc.style.display = 'block';

    const temAcesso = temPermissaoMaster || temPermissaoFinanceiro;
    const selectStatusFechado = document.getElementById('selectStatusCustoFechado');
    const inputStatusFechado = document.getElementById('statusCustoFechadoTexto');
    const hiddenStatusFechado = document.getElementById('statusCustoFechado');

    if (hiddenStatusFechado) hiddenStatusFechado.value = statusFechadoBanco;

    if (temAcesso) {
        document.getElementById('wrapperSelectCustoFechado').style.display = 'block';
        document.getElementById('wrapperInputCustoFechado').style.display = 'none';
        if (selectStatusFechado) {
            selectStatusFechado.value = statusFechadoBanco;
            aplicarCorNoSelect(selectStatusFechado);
        }
    } else {
        document.getElementById('wrapperSelectCustoFechado').style.display = 'none';
        document.getElementById('wrapperInputCustoFechado').style.display = 'block';
        if (inputStatusFechado) {
            inputStatusFechado.value = statusFechadoBanco;
            aplicarCorStatusInput(inputStatusFechado);
        }
    }
}

function verificarBloqueioStatusAutorizado(checkboxElement) {
    const elStatus = document.getElementById('selectStatusCustoFechado') || document.getElementById('statusCustoFechadoTexto');
    const statusAtual = (elStatus ? elStatus.value : "").toUpperCase();

    // Se está AUTORIZADO e NÃO é o carregamento inicial (ou seja, é clique humano)
    if (statusAtual === "AUTORIZADO" && !isFormLoadedFromDoubleClick) {
        Swal.fire({
            title: "Ação Bloqueada!",
            text: "Este cachê já foi AUTORIZADO. Para alterar o nível, o status deve ser alterado para Pendente ou Rejeitado primeiro.",
            icon: "error"
        });
        
        // 1. Desmarca o que o usuário clicou errado
        checkboxElement.checked = false;

        // 2. CORREÇÃO: Usa a variável GLOBAL para saber o que marcar de volta
        const nivelOriginal = (currentEditingStaffEvent.nivelexperiencia || "").trim().toUpperCase();
        console.log("Restaurando para o nível autorizado:", nivelOriginal);

        // 3. Remarca o original
        if (nivelOriginal === "BASE") if (baseCheck) baseCheck.checked = true;
        if (nivelOriginal === "JUNIOR") if (juniorCheck) juniorCheck.checked = true;
        if (nivelOriginal === "PLENO") if (plenoCheck) plenoCheck.checked = true;
        if (nivelOriginal === "SENIOR") if (seniorCheck) seniorCheck.checked = true;
        if (nivelOriginal === "SENIOR2" || nivelOriginal === "SENIOR 2") if (seniorCheck2) seniorCheck2.checked = true;
        if (nivelOriginal === "FECHADO") if (fechadoCheck) fechadoCheck.checked = true;
        if (nivelOriginal === "LIBERADO") if (liberadoCheck) liberadoCheck.checked = true;

        return true; 
    }
    return false; 
}

function validarCamposEssenciais() {
    const nmFuncionario = document.getElementById("nmFuncionario");
    const descFuncao = document.getElementById("descFuncao");
    
    // 1. Validar Funcionário
    if (!nmFuncionario || nmFuncionario.value.trim() === "") {
        Swal.fire({
            icon: "warning",
            title: "Atenção!",
            text: "É essencial o preenchimento do campo 'Funcionário' antes de escolher o nível de experiência.",
            confirmButtonText: "Fechar"
        });
        return false;
    }

    // 2. Validar Função
    // Assume que 'descFuncao' é o ID do campo da função
    if (!descFuncao || descFuncao.value.trim() === "" || descFuncao.value.trim() === "0") {
        Swal.fire({
            icon: "warning",
            title: "Atenção!",
            text: "É essencial o preenchimento do campo 'Função' antes de escolher o nível de experiência.",
            confirmButtonText: "Fechar"
        });
        return false;
    }

    return true;
}

function onCriteriosChanged() {
    console.log("🔵 onCriteriosChanged chamado");
    
    const checks = [
        { el: seniorCheck2, nome: 'seniorCheck2' },
        { el: seniorCheck,  nome: 'seniorCheck' },
        { el: plenoCheck,   nome: 'plenoCheck' },
        { el: juniorCheck,  nome: 'juniorCheck' },
        { el: baseCheck,    nome: 'baseCheck' },
        { el: fechadoCheck, nome: 'fechadoCheck' },
        { el: liberadoCheck,nome: 'liberadoCheck' },
    ];

    const marcado = checks.find(c => c.el?.checked);
    
    if (marcado) {
        console.log(`🔵 Disparando change em: ${marcado.nome}`);
        marcado.el.dispatchEvent(new Event('change'));
    } 
}

function atualizarVisibilidadeCacheFechado() {
    const check = document.getElementById('Fechadocheck');
    const divStatus = document.getElementById('campoStatusCustoFechado');
    const inputVlrCusto = document.getElementById('vlrCusto');

    if (check && divStatus) {
        if (!check.checked) {
            divStatus.style.display = 'none';
            inputVlrCusto.readOnly = true;
        } else {
            divStatus.style.display = 'flex';
            inputVlrCusto.readOnly = false;
        }
    }
}

function atualizarVisibilidadeCacheLiberado() {
    const check = document.getElementById('Liberadocheck');
    const divStatus = document.getElementById('campoStatusCustoLiberado');
    const inputVlrCusto = document.getElementById('vlrCusto');

    if (check && divStatus) {
        if (!check.checked) {
            divStatus.style.display = 'none';
            inputVlrCusto.readOnly = true;
        } else {
            divStatus.style.display = 'block';
            inputVlrCusto.readOnly = false;
        }
    }
}

function criarRegexRemocao(textoPuro) {
    const textoEscapado = textoPuro.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    // Encontra (opcional \n\n) + o texto
    return new RegExp("(\\n\\n)?" + textoEscapado, 'g');
}

// Regex para cada descrição
const REGEX_REMOCAO1 = criarRegexRemocao(DescViagem1);
const REGEX_REMOCAO2 = criarRegexRemocao(DescViagem2);
const REGEX_REMOCAO3 = criarRegexRemocao(DescViagem3);



function camposDiarias(){
    document.getElementById('diariaDobradacheck')?.addEventListener('change', function() {
        document.getElementById('campoDiariaDobrada').style.display = this.checked ? 'block' : 'none';
        document.getElementById('campoStatusDiariaDobrada').style.display = this.checked ? 'block' : 'none';
        const textarea = document.getElementById('descDiariaDobrada');
        if (textarea) textarea.style.display = this.checked ? 'block' : 'none';
    });

    document.getElementById('meiaDiariacheck')?.addEventListener('change', function() {
        document.getElementById('campoMeiaDiaria').style.display = this.checked ? 'block' : 'none';
        document.getElementById('campoStatusMeiaDiaria').style.display = this.checked ? 'block' : 'none';
        const textarea = document.getElementById('descMeiaDiaria');
        if (textarea) textarea.style.display = this.checked ? 'block' : 'none';
    });
}

function limparDescricoesViagem(textoAtual) {
    let textoLimpo = textoAtual;

    // Remove a Viagem 1, se existir
    if (textoLimpo.includes(DescViagem1)) {
        textoLimpo = textoLimpo.replace(REGEX_REMOCAO1, "").trim();
    }
    
    // Remove a Viagem 2, se existir
    if (textoLimpo.includes(DescViagem2)) {
        textoLimpo = textoLimpo.replace(REGEX_REMOCAO2, "").trim();
    }    

     // Remove a Viagem 3, se existir
    if (textoLimpo.includes(DescViagem3)) {
        textoLimpo = textoLimpo.replace(REGEX_REMOCAO3, "").trim();
    }

    return textoLimpo;
}

function calcularPascoa(ano) {
    const f = Math.floor,
          G = ano % 19,
          C = f(ano / 100),
          H = (C - f(C / 4) - f((8 * C + 13) / 25) + 19 * G + 15) % 30,
          I = H - f(H / 28) * (1 - f(H / 28) * f(29 / (H + 1)) * f((21 - G) / 11)),
          J = (ano + f(ano / 4) + I + 2 - C + f(C / 4)) % 7,
          L = I - J,
          mes = 3 + f((L + 40) / 44),
          dia = L + 28 - 31 * f(mes / 4);
    return new Date(ano, mes - 1, dia);
}

// Retorna um array com os feriados móveis do ano
function feriadosMoveis(ano) {
    const pascoa = calcularPascoa(ano);
    const carnaval = new Date(pascoa); 
    carnaval.setDate(pascoa.getDate() - 47);

    const sextaSanta = new Date(pascoa);
    sextaSanta.setDate(pascoa.getDate() - 2);

    const corpusChristi = new Date(pascoa);
    corpusChristi.setDate(pascoa.getDate() + 60);

    return [carnaval, sextaSanta, pascoa, corpusChristi];
}

// Modifica a função isFeriado para incluir móveis
function isFeriado(date) {
    const mmdd = `${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
    const feriadosFixos = ["01-01","01-25","04-21","05-01","07-09","09-07","10-12","11-02","11-15","12-25"];

    // Checa feriados fixos
    if (feriadosFixos.includes(mmdd)) return true;

    // Checa feriados móveis
    const moveis = feriadosMoveis(date.getFullYear());
    return moveis.some(d => d.getDate() === date.getDate() && d.getMonth() === date.getMonth());
}


function isFinalDeSemanaOuFeriado(date) {
  const dia = date.getDay(); // 0=Domingo, 6=Sábado
  return dia === 0 || dia === 6 || isFeriado(date);

  console.log("Verificando se é final de semana ou feriado para:", date, "Resultado:", dia === 0 || dia === 6 || isFeriado(date));
}



// function calcularValorTotal({ statusFechadoOverride = null } = {}) {
//     if (!document.getElementById('vlrTotal')) return;
    
//     // if (isFormLoadedFromDoubleClick) {
//     //     const cache = window.currentEventDataCache || { vlrtotcache: 0, vlrtotajdcusto: 0 };
//     //     if (cache.vlrtotcache > 0 && cache.vlrtotajdcusto > 0) {
//     //         console.log("Cálculo abortado: dados do banco serão restaurados pelo setTimeout.");
//     //         return;
//     //     }
//     //     console.log("⚠️ Totais zerados no banco, calculando mesmo durante carregamento.");
//     // }

//     if (!statusFechadoOverride && isFormLoadedFromDoubleClick) {
//         const cache = window.currentEventDataCache || { vlrtotcache: 0, vlrtotajdcusto: 0 };
//         if (cache.vlrtotcache > 0 && cache.vlrtotajdcusto > 0) {
//             return;
//         }
//     }
    
//     console.log("Iniciando o cálculo do valor total... Status Anterior de ", "CustoFechado/Liberado:", statusAnteriorCustoFechado, "AjusteCusto:", statusAnteriorAjusteCusto, "Caixinha:", statusAnteriorCaixinha);

//     // Pega os valores dos inputs e converte para número
//     const cache = parseFloat(document.getElementById('vlrCusto').value.replace(',', '.')) || 0;
//     const transporte = parseFloat(document.getElementById('transporte').value.replace(',', '.')) || 0;   
//     const alimentacao = parseFloat(document.getElementById('alimentacao').value.replace(',', '.')) || 0;
//     const ajusteCusto = parseFloat(document.getElementById('ajusteCusto').value.replace(',', '.')) || 0;
//     const caixinha = parseFloat(document.getElementById('caixinha').value.replace(',', '.')) || 0;
//     const perfilFuncionario = document.getElementById("perfilFuncionario").value;
//     const qtdpessoas = parseInt(document.getElementById("qtdPessoas").value) || 1;
//     const isFechado = document.getElementById('Fechadocheck').checked;
//     const isLiberado = document.getElementById('Liberadocheck').checked;
//     // Inicializa o valor total com os itens que são sempre calculados
  
//     let total = 0;
//     let totalCache = 0; 
//     let totalAjdCusto = 0;
          
//     // const statusFechado = statusFechadoOverride 
//     //     ?? document.getElementById("statusCustoFechado")?.value 
//     //     ?? "";
    
//     //const statusFechado = statusFechadoOverride || document.getElementById('statusCustoFechado').value;
//     //const statusFechado = statusFechadoOverride || document.getElementById('statusCustoFechado')?.value || "Pendente";
//     const statusFechado = statusFechadoOverride || 
//                          document.getElementById('statusCustoFechado')?.value || 
//                          document.getElementById('selectStatusCustoFechado')?.value || 
//                          "Pendente";

//     console.log("🔍 Verificação de Segurança - Status do Cachê identificado como:", statusFechado);

//    console.log("LIBERADO", isLiberado, "FECHADO", statusFechado);

//     if (isFechado) {
//         if (statusFechado === "Autorizado") {
//             total = cache;
//             totalAjdCusto = alimentacao + transporte;
//             totalCache = cache;
//             console.log("Cachê Fechado Autorizado: Adicionando ao total.");
//         } else {
//             total = 0;
//             totalCache = 0;
//             totalAjdCusto = 0;

//             console.log("Cachê Fechado Pendente/Rejeitado: Total zerado.");

//             document.getElementById('vlrTotal').value = 'R$ 0,00';
//             document.getElementById('vlrTotalHidden').value = '0.00';
            
//             if (document.getElementById('vlrTotalCache')) {
//                 document.getElementById('vlrTotalCache').value = 'R$ 0,00';
//                 document.getElementById('vlrTotalCacheHidden').value = '0.00';
//             }
            
//             if (document.getElementById('vlrTotalAjdCusto')) {
//                 document.getElementById('vlrTotalAjdCusto').value = 'R$ 0,00';
//                 document.getElementById('vlrTotalAjdCustoHidden').value = '0.00';
//             }

//             // Importante: Retornamos aqui para que nenhum outro cálculo 
//             // (como diárias ou extras) some valores em cima desse zero.
//             return;
            
//         }
//     } else {
//         console.log("LIBERADO", isLiberado, statusFechado);

//         if (isLiberado && statusFechado !== "Autorizado") {
//             total = 0;
//             totalCache = 0;
//             totalAjdCusto = 0;
            
//             console.log("🚫 Nível LIBERADO Pendente/Rejeitado: Zerando valores e abortando loop de diárias.");

//             // Atualização visual imediata
//             document.getElementById('vlrTotal').value = 'R$ 0,00';
//             document.getElementById('vlrTotalHidden').value = '0.00';
            
//             if (document.getElementById('vlrTotalCache')) {
//                 document.getElementById('vlrTotalCache').value = 'R$ 0,00';
//                 document.getElementById('vlrTotalCacheHidden').value = '0.00';
//             }
            
//             if (document.getElementById('vlrTotalAjdCusto')) {
//                 document.getElementById('vlrTotalAjdCusto').value = 'R$ 0,00';
//                 document.getElementById('vlrTotalAjdCustoHidden').value = '0.00';
//             }

//             return; // IMPORTANTE: Impede o código de descer e calcular as diárias abaixo
//         }

//         // Pega o número de diárias selecionadas
//         const contadorTexto = document.getElementById('contadorDatas').innerText;
//         const match = contadorTexto.match(/\d+/);
//         const numeroDias = match ? parseInt(match[0]) : 0;

//         const datasParaProcessar = window.datasEventoPicker 
//             ? window.datasEventoPicker.selectedDates // Fonte de dados mais confiável: a instância Flatpickr
//             : datasEventoSelecionadas; // Fallback para a variável global, se a instância não estiver disponível

//         // Conta apenas o número de datas do evento
//         console.log("Número de diárias:", contadorTexto, match, numeroDias, cache, ajusteCusto, transporte, alimentacao, caixinha, datasParaProcessar);

//         //(datasEventoSelecionadas || []).forEach(data => {
//         (datasParaProcessar || []).forEach(data => {
//             console.log("Processando data:", data, perfilFuncionario);

//             if (perfilFuncionario === "Freelancer") {
//                 total += cache + transporte + alimentacao;
//                 totalCache += cache;
//                 totalAjdCusto += transporte + alimentacao;
//             } else if (perfilFuncionario === "Lote") {
//                 if (qtdpessoas <= 0) {
//                     Swal.fire({
//                         icon: 'warning',
//                         title: 'Atenção',
//                         text: "Perfil 'Lote' selecionado, o preenchimento da quantidade de pessoas é OBRIGATÓRIO."
//                     });
//                 }
//                 total += (cache + transporte + alimentacao) * qtdpessoas;
//                 totalCache += cache * qtdpessoas;
//                 totalAjdCusto += (transporte + alimentacao) * qtdpessoas;
//                 console.log(`Perfil 'Lote' detectado. Diária (${data.toLocaleDateString()}) para ${qtdpessoas} pessoas: ${total.toFixed(2)}`);
//             } else {
//                 if (isFinalDeSemanaOuFeriado(data)) {
//                     total += cache + transporte +  alimentacao;
//                     totalCache += cache;   
//                     totalAjdCusto += transporte + alimentacao;         
//                 } else {
//                     total += transporte + alimentacao;
//                     totalAjdCusto += transporte + alimentacao;
//                     console.log(`Data ${data.toLocaleDateString()} não é fim de semana nem feriado. Cachê não adicionado.`);
//                 }
//             }
//         });
//     }

//     document.getElementById('vlrTotal').value = 'R$ ' + total.toFixed(2).replace('.', ',');

//     console.log("Total inicial (sem adicionais):", total.toFixed(2));

//     // --- NOVA LÓGICA: INCLUIR VALORES APENAS SE AUTORIZADOS ---

//     // 1. Verificação do Ajuste de Custo
//     //const statusAjusteCusto = document.getElementById("statusAjusteCusto").value;
//     const statusAjusteCusto = document.getElementById("statusAjusteCusto")?.value || "Pendente";

//     if (statusAjusteCusto === 'Autorizado') {
//         total += ajusteCusto;
//         totalCache += ajusteCusto;
//         console.log("Ajuste Autorizado. Adicionando:", ajusteCusto.toFixed(2));
//     } else if (
//         statusAnteriorAjusteCusto === 'Autorizado' && 
//         (statusAjusteCusto === 'Pendente' || statusAjusteCusto === 'Rejeitado')
//     ) {
//         total -= ajusteCusto;
//         totalCache -= ajusteCusto;
//         console.log("Ajuste removido (era Autorizado). Subtraindo:", ajusteCusto.toFixed(2));
//     } else {
//         console.log("Ajuste Não Autorizado. Nada alterado.");
//     }

//     // 2. Verificação da Caixinha
//     //const statusCaixinha = document.getElementById("statusCaixinha").value;
//     const statusCaixinha = document.getElementById("statusCaixinha")?.value || "Pendente";
//     if (statusCaixinha === 'Autorizado') {
//         total += caixinha;
//        // totalCache += caixinha
//         console.log("Caixinha Autorizada. Adicionando:", caixinha.toFixed(2));
//     } else {
//         console.log("Caixinha Não Autorizada. Não adicionada.");
//     }

//     // // 3. Verificação de Diárias Dobradas
//     // if (diariaDobradacheck.checked && datasDobrada && datasDobrada.length > 0) {
//     //     const diariasDobradasAutorizadas = datasDobrada.filter(item => item.status === 'Autorizado');
//     //     if (diariasDobradasAutorizadas.length > 0) {
//     //         let valorDiariaDobrada = cache + vlrAlimentacaoDobra;
//     //         let valorCacheDobrada = cache;
//     //         let valorAjdCustoDobrada = vlrAlimentacaoDobra          
//     //         // transporte não entra no cálculo
//     //         valorDiariaDobrada *= diariasDobradasAutorizadas.length;
//     //         valorCacheDobrada *= diariasDobradasAutorizadas.length;
//     //         valorAjdCustoDobrada *= diariasDobradasAutorizadas.length;
            
//     //         total += valorDiariaDobrada;
//     //         totalCache += valorCacheDobrada
//     //         totalAjdCusto += valorAjdCustoDobrada;

//     //         console.log(`Diárias Dobradas Autorizadas: ${diariasDobradasAutorizadas.length}. Adicionando: ${valorDiariaDobrada.toFixed(2)}`);
//     //     }
//     // }

//     // // 4. Verificação de Meias Diárias
//     // if (meiaDiariacheck.checked && datasMeiaDiaria && datasMeiaDiaria.length > 0) {
//     //     const meiasDiariasAutorizadas = datasMeiaDiaria.filter(item => item.status === 'Autorizado');
//     //     if (meiasDiariasAutorizadas.length > 0) {
//     //         let valorMeiaDiaria = (cache / 2)+ vlrAlimentacaoDobra; // base é metade do cache
//     //         let valorCacheMeia = (cache/2);
//     //         let valorAjdCustoMeia = vlrAlimentacaoDobra;

//     //         console.log("ALIMENTACAO", alimentacao);   

//     //         // transporte não entra no cálculo
//     //         valorMeiaDiaria *= meiasDiariasAutorizadas.length;
//     //         valorCacheMeia *= meiasDiariasAutorizadas.length;
//     //         valorAjdCustoMeia *= meiasDiariasAutorizadas.length;
            
//     //         total += valorMeiaDiaria;
//     //         totalCache += valorCacheMeia;
//     //         totalAjdCusto += valorAjdCustoMeia;

//     //         console.log(`Meias Diárias Autorizadas: ${meiasDiariasAutorizadas.length}. Adicionando: ${valorMeiaDiaria.toFixed(2)}. Ajuda de Custo: ${valorAjdCustoMeia.toFixed(2)}    `);
//     //     }
//     // }

    
// // 3. Verificação de Diárias Dobradas
// if (diariaDobradacheck.checked && datasDobrada && datasDobrada.length > 0) {
//     const diariasDobradasAutorizadas = datasDobrada.filter(item => item.status === 'Autorizado');
    
//     if (diariasDobradasAutorizadas.length > 0) {
//         let valorDiariaDobrada = cache + vlrAlimentacaoDobra;
//         let valorCacheDobrada = cache;
//         let valorAjdCustoDobrada = vlrAlimentacaoDobra;
        
//         // Aplica o multiplicador (número de datas autorizadas)
//         valorDiariaDobrada *= diariasDobradasAutorizadas.length;
//         valorCacheDobrada *= diariasDobradasAutorizadas.length;
//         valorAjdCustoDobrada *= diariasDobradasAutorizadas.length;
        
//         // Soma nos acumuladores globais da função
//         total += valorDiariaDobrada;
//         totalCache += valorCacheDobrada;
//         totalAjdCusto += valorAjdCustoDobrada;

//         console.log(`✅ DOBRAS: ${diariasDobradasAutorizadas.length} autorizadas. +R$ ${valorDiariaDobrada.toFixed(2)}`);
//     }
// }
// // 4. Verificação de Meias Diárias
// if (meiaDiariacheck.checked && datasMeiaDiaria && datasMeiaDiaria.length > 0) {
//     const meiasDiariasAutorizadas = datasMeiaDiaria.filter(item => item.status === 'Autorizado');
    
//     if (meiasDiariasAutorizadas.length > 0) {
//         let valorMeiaDiaria = (cache / 2) + vlrAlimentacaoDobra; // Base: metade do cache
//         let valorCacheMeia = (cache / 2);
//         let valorAjdCustoMeia = vlrAlimentacaoDobra;

//         // Aplica o multiplicador
//         valorMeiaDiaria *= meiasDiariasAutorizadas.length;
//         valorCacheMeia *= meiasDiariasAutorizadas.length;
//         valorAjdCustoMeia *= meiasDiariasAutorizadas.length;
        
//         // Soma nos acumuladores globais da função
//         total += valorMeiaDiaria;
//         totalCache += valorCacheMeia;
//         totalAjdCusto += valorAjdCustoMeia;

//         console.log(`✅ MEIAS: ${meiasDiariasAutorizadas.length} autorizadas. +R$ ${valorMeiaDiaria.toFixed(2)}`);
//     }
// }


//     // Formatação e atualização dos campos
//     const valorFormatado = 'R$ ' + total.toFixed(2).replace('.', ',');
//     const valorLimpo = total.toFixed(2);

//     document.getElementById('vlrTotal').value = valorFormatado;
//     document.getElementById('vlrTotalHidden').value = valorLimpo;

//     const valorFormatTotCache = 'R$ ' + totalCache.toFixed(2).replace('.', ',');
//     const valorLimpoCache = totalCache.toFixed(2);

//     document.getElementById('vlrTotalCache').value = valorFormatTotCache;
//     document.getElementById('vlrTotalCacheHidden').value = valorLimpoCache;

//     const valorFormatTotAjdCusto = 'R$ ' + totalAjdCusto.toFixed(2).replace('.', ',');
//     const valorLimpoAjdCusto = totalAjdCusto.toFixed(2);

//     document.getElementById('vlrTotalAjdCusto').value = valorFormatTotAjdCusto;
//     document.getElementById('vlrTotalAjdCustoHidden').value = valorLimpoAjdCusto;

//     console.log("Valor Total Final: R$", total.toFixed(2));
// }

// O restante do seu código de listeners está correto VERIFICAR SE É PARA REMOVER TODO O TRECHO
//Adiciona listeners de input para os campos que impactam no cálculo


// function calcularValorTotal({ statusFechadoOverride = null } = {}) {
//     if (!document.getElementById('vlrTotal')) return;

//     const statusPgtoBanco = (window.statusPgtoCacheOriginalDoBanco || "").trim().toLowerCase();
//     const datasParaProcessar = window.datasEventoPicker ? window.datasEventoPicker.selectedDates : (datasEventoSelecionadas || []);
//     const previouslySelectedDates = window.datasEventoPicker?._prevSelectedDates || [];

//     if (statusPgtoBanco === 'pago' && window.datasEventoPicker && window.datasEventoPicker.usuarioAbriu) {
//         const removeuDatas = previouslySelectedDates.length > datasParaProcessar.length || 
//                              previouslySelectedDates.some(prevDate => !datasParaProcessar.some(newDate => prevDate.getTime() === newDate.getTime()));
        
//         const adicionouDatas = datasParaProcessar.length > previouslySelectedDates.length || 
//                                datasParaProcessar.some(newDate => !previouslySelectedDates.some(prevDate => prevDate.getTime() === newDate.getTime()));

//         if (removeuDatas || adicionouDatas) {
//             window.datasEventoPicker.close();
            
//             Swal.fire({
//                 title: 'Atenção!',
//                 text: 'O Cachê deste funcionário já foi PAGO. Não é mais permitido alterar, incluir ou remover datas deste evento.',
//                 icon: 'error',
//                 confirmButtonText: 'Entendi'
//             });

//             // Reverte o calendário para as datas que estavam antes do clique
//             window.datasEventoPicker.setDate(previouslySelectedDates, false);
//             return;
//         }
//     }

//     // --- PARÂMETROS INICIAIS ---
//     const cacheInput = parseFloat(document.getElementById('vlrCusto').value.replace(',', '.')) || 0;
//     const transporte = parseFloat(document.getElementById('transporte').value.replace(',', '.')) || 0;
//     const alimentacao = parseFloat(document.getElementById('alimentacao').value.replace(',', '.')) || 0;
//     const ajusteCusto = parseFloat(document.getElementById('ajusteCusto').value.replace(',', '.')) || 0;
//     const caixinha = parseFloat(document.getElementById('caixinha').value.replace(',', '.')) || 0;
//     const perfilFuncionario = document.getElementById("perfilFuncionario").value;
//     const qtdpessoas = parseInt(document.getElementById("qtdPessoas").value) || 1;
//     const isFechado = document.getElementById('Fechadocheck').checked;
    
//     // Status de Pagamento
//     const statusPgtoAjudCusto = document.getElementById('statusPgtoAjudaCusto')?.value || "";
//     const isAjudaCustoPaga = statusPgtoAjudCusto.toLowerCase() === 'pago';

//     const datasOriginaisAjudCusto = window.currentEventDataCache?.datasOriginaisBanco || [];

//     // IMPORTANTÍSSIMO: Se já foi pago, pegamos o valor que FOI pago do cache do banco
//     // para não zerar o campo na tela.
//     const vlrJaPagoAjdCusto = isAjudaCustoPaga 
//         ? (window.currentEventDataCache?.vlrtotajdcusto || 0) 
//         : 0;

//     let totalCache = 0;
//     let totalAjdCusto = isAjudaCustoPaga ? vlrJaPagoAjdCusto : 0; 

//     // --- 1. CÁLCULO DE DIÁRIAS (BASE) ---
//     if (isFechado) {
//         const statusFechado = statusFechadoOverride || document.getElementById('statusCustoFechado')?.value || "Pendente";
//         if (statusFechado === "Autorizado") {
//             totalCache = cacheInput;
//             // Se NÃO estiver pago, calcula a ajuda de custo normalmente
//             if (!isAjudaCustoPaga) {
//                 totalAjdCusto = alimentacao + transporte;
//             } else {
//                 // Se já estiver pago, qualquer "ajuste" ou nova diária de transporte 
//                 // que surgisse aqui (teoricamente) deveria ir para o cachê, 
//                 // mas no FECHADO o valor é fixo, então mantemos o totalAjdCusto do banco.
//             }
//         }
//     } else {
//         const datasParaProcessar = window.datasEventoPicker ? window.datasEventoPicker.selectedDates : (datasEventoSelecionadas || []);
        
//         // Quantidade de datas que geraram o pagamento original (para saber se houve adição/moficação)
//         const qtdDatasOriginais = window.currentEventDataCache?.qtdDatasOriginal || datasParaProcessar.length;

//         datasParaProcessar.forEach((data, index) => {
//             let vlrDiariaBase = 0;
//             let vlrAjudCustoDiaria = 0;

//             if (perfilFuncionario === "Freelancer") {
//                 vlrDiariaBase = cacheInput;
//                 vlrAjudCustoDiaria = transporte + alimentacao;
//             } else if (perfilFuncionario === "Lote") {
//                 vlrDiariaBase = cacheInput * qtdpessoas;
//                 vlrAjudCustoDiaria = (transporte + alimentacao) * qtdpessoas;
//             } else {
//                 vlrDiariaBase = isFinalDeSemanaOuFeriado(data) ? cacheInput : 0;
//                 vlrAjudCustoDiaria = transporte + alimentacao;
//             }

//             totalCache += vlrDiariaBase;
            
//             // SE NÃO PAGO: Soma na Ajuda de Custo normalmente
//             if (!isAjudaCustoPaga) {
//                 totalAjdCusto += vlrAjudCustoDiaria;
//             } 
//             // SE PAGO: Se o índice da data for maior que a quantidade original, 
//             // significa que é uma DATA NOVA adicionada pós-pagamento.
//             else if (index >= qtdDatasOriginais) {
//                 totalCache += vlrAjudCustoDiaria; // Joga o transporte da data nova no cachê
//                 registrarLog(`Data extra ${data.toLocaleDateString()} adicionada pós-pagamento.`);
//             }
//             // else {
//             //     const dataFormatada = flatpickr.formatDate(data, 'Y-m-d');
//             //     const isDataNova = !datasOriginaisAjudCusto.includes(dataFormatada);

//             //     if (isDataNova) {
//             //         // Joga o valor correspondente à ajuda de custo desta nova data para dentro do CACHÊ
//             //         totalCache += vlrAjudCustoDiaria; 
//             //         registrarLogPosPagamento(`Compensação financeira da data extra ${flatpickr.formatDate(data, 'd/m/Y')} aplicada no saldo do cachê.`);
//             //     }
//             // }
//         });

//         // // Se a Ajuda já está PAGA mas o usuário removeu alguma data original
//         // if (isAjudaCustoPaga && datasOriginaisAjudCusto.length > 0) {
//         //     datasOriginaisAjudCusto.forEach(dataOrigStr => {
//         //         // Se a data original não está mais nas datas atuais selecionadas, ela foi removida!
//         //         const aindaExiste = datasParaProcessar.some(d => flatpickr.formatDate(d, 'Y-m-d') === dataOrigStr);
                
//         //         if (!aindaExiste) {
//         //             let vlrDescontoAjud = transporte + alimentacao;
//         //             if (perfilFuncionario === "Lote") vlrDescontoAjud *= qtdpessoas;

//         //             // Como a ajuda já foi paga cheia, nós DESCONTAMOS essa diferença no Cachê
//         //             totalCache -= vlrDescontoAjud;
//         //             registrarLog(`Desconto de data removida (${dataOrigStr.split('-').reverse().join('/')}) aplicado no saldo do cachê.`);
//         //         }
//         //     });
//         // }    
        
//     }

    

//     // --- 2. DIÁRIAS DOBRADAS (CORREÇÃO DA MATEMÁTICA) ---
//     if (typeof diariaDobradacheck !== 'undefined' && diariaDobradacheck.checked && datasDobrada?.length > 0) {
//         const autorizadas = datasDobrada.filter(item => item.status === 'Autorizado');
//         if (autorizadas.length > 0) {
//             let vlrDobraTotal = cacheInput * autorizadas.length;
//             let vlrAjudDobraTotal = (vlrAlimentacaoDobra || 0) * autorizadas.length;

//             totalCache += vlrDobraTotal;
//             if (isAjudaCustoPaga) {
//                 totalCache += vlrAjudDobraTotal; // Soma o bônus de alimentação no cachê
//             } else {
//                 totalAjdCusto += vlrAjudDobraTotal;
//             }
//         }
//     }

//     // --- 3. MEIAS DIÁRIAS (CORREÇÃO DA MATEMÁTICA: 100 + 40 = 140) ---
//     if (typeof meiaDiariacheck !== 'undefined' && meiaDiariacheck.checked && datasMeiaDiaria?.length > 0) {
//         const autorizadas = datasMeiaDiaria.filter(item => item.status === 'Autorizado');
//         if (autorizadas.length > 0) {
//             // Se cacheInput é 200, vlrMeiaUnitario é 100
//             let vlrMeiaUnitario = cacheInput / 2; 
//             let vlrAjudMeiaUnitario = vlrAlimentacaoDobra || 0; // Ex: 40

//             totalCache += (vlrMeiaUnitario * autorizadas.length);
            
//             if (isAjudaCustoPaga) {
//                 // Se pago, os 40 reais (ajuda) vão para o cachê
//                 totalCache += (vlrAjudMeiaUnitario * autorizadas.length);
//             } else {
//                 totalAjdCusto += (vlrAjudMeiaUnitario * autorizadas.length);
//             }
//             console.log("Cálculo Meia:", autorizadas.length, "x", (vlrMeiaUnitario + vlrAjudMeiaUnitario));
//         }
//     }

//     // --- 4. AJUSTE E CAIXINHA ---
//     if ((document.getElementById("statusAjusteCusto")?.value || "Pendente") === 'Autorizado') {
//         totalCache += ajusteCusto;
//     }
//     if ((document.getElementById("statusCaixinha")?.value || "Pendente") === 'Autorizado') {
//         totalCache += caixinha;
//     }

//     // --- 5. ATUALIZAÇÃO FINAL ---
//     const totalGeral = totalCache + totalAjdCusto;

//     // Atualiza os campos na tela (Sem zerar o Ajuda de Custo se estiver pago)
//     document.getElementById('vlrTotal').value = 'R$ ' + totalGeral.toFixed(2).replace('.', ',');
//     document.getElementById('vlrTotalHidden').value = totalGeral.toFixed(2);

//     document.getElementById('vlrTotalCache').value = 'R$ ' + totalCache.toFixed(2).replace('.', ',');
//     document.getElementById('vlrTotalCacheHidden').value = totalCache.toFixed(2);

//     document.getElementById('vlrTotalAjdCusto').value = 'R$ ' + totalAjdCusto.toFixed(2).replace('.', ',');
//     document.getElementById('vlrTotalAjdCustoHidden').value = totalAjdCusto.toFixed(2);

//     // Controle do Container de Observação
//     const obsInput = document.getElementById('obsPosPgto');
//     const containerObs = document.getElementById('containerObsPosPgto');
//     const temInformacao = obsInput.value.trim().length > 0;

//     if (temInformacao) {
//         // Se houver texto (log de alteração), exibe o bloco
//         containerObs.classList.add('show-obs');
//     } else {
//         // Se estiver vazio, mantém oculto
//         containerObs.classList.remove('show-obs');
//     }
// }

function calcularValorTotal({ statusFechadoOverride = null } = {}) {
    if (!document.getElementById('vlrTotal')) return;

    const statusPgtoBanco = (window.statusPgtoCacheOriginalDoBanco || "").trim().toLowerCase();
    const datasParaProcessar = window.datasEventoPicker ? window.datasEventoPicker.selectedDates : (datasEventoSelecionadas || []);
    
    // --- PARÂMETROS INICIAIS ---
    const cacheInput = parseFloat(document.getElementById('vlrCusto').value.replace(',', '.')) || 0;
    const transporte = parseFloat(document.getElementById('transporte').value.replace(',', '.')) || 0;
    const alimentacao = parseFloat(document.getElementById('alimentacao').value.replace(',', '.')) || 0;
    const ajusteCusto = parseFloat(document.getElementById('ajusteCusto').value.replace(',', '.')) || 0;
    const caixinha = parseFloat(document.getElementById('caixinha').value.replace(',', '.')) || 0;
    const perfilFuncionario = document.getElementById("perfilFuncionario").value;
    const qtdpessoas = parseInt(document.getElementById("qtdPessoas").value) || 1;
    const isFechado = document.getElementById('Fechadocheck').checked;
    
    // Status de Pagamento
    const statusPgtoAjudCusto = (document.getElementById('statusPgtoAjudaCusto')?.value || "").trim().toLowerCase();
    const statusBanco = (window.currentEventDataCache?.statusAjudaCustoOriginal || "").trim().toLowerCase();
    const isAjudaCustoPaga = statusPgtoAjudCusto === 'pago' || statusBanco === 'pago';

    const cacheGlobal = window.currentEventDataCache || {};

    const datasOriginaisAjudCusto = window.currentEventDataCache?.datasOriginaisBanco || [];

    const qtdOriginais = datasOriginaisAjudCusto.length; 
    const qtdAtuais = datasParaProcessar.length;

    console.log("Checagem de Regra:", { 
        isAjudaCustoPaga, 
        qtdOriginais, 
        qtdAtuais,
        comparacao: (qtdAtuais < qtdOriginais)
    });

    let totalCache = 0;   

    let totalAjdCusto = isAjudaCustoPaga 
        ? (parseFloat(window.currentEventDataCache?.vlrtotajdcusto) || 0) 
        : 0;

    console.log("LOG DE CORREÇÃO:", {
        statusPgtoAjudCusto,
        statusBanco,
        isAjudaCustoPaga,
        valorFixado: totalAjdCusto
    });

    // --- 1. CÁLCULO DE DIÁRIAS (BASE) ---
    if (isFechado) {
        const statusFechado = statusFechadoOverride || document.getElementById('statusCustoFechado')?.value || "Pendente";
        if (statusFechado === "Autorizado") {
            totalCache = cacheInput;
            if (!isAjudaCustoPaga) totalAjdCusto = alimentacao + transporte;
        }
    } else {
        
        datasParaProcessar.forEach((data) => {
            // Cria data com componentes locais para evitar bug de fuso
            const dataLocal = new Date(data.getFullYear(), data.getMonth(), data.getDate());

            let vlrDiariaBase = 0;

            if (perfilFuncionario === "Freelancer") {
                vlrDiariaBase = cacheInput;
            } else if (perfilFuncionario === "Lote") {
                vlrDiariaBase = cacheInput * qtdpessoas;
            } else {
                console.log("Data para cálculo:", dataLocal.toLocaleDateString(), " - É final de semana ou feriado?", isFinalDeSemanaOuFeriado(dataLocal));
                vlrDiariaBase = isFinalDeSemanaOuFeriado(dataLocal) ? cacheInput : 0;
            }

            totalCache += vlrDiariaBase;

            if (!isAjudaCustoPaga) {
                let vlrAjdDiaria = (transporte + alimentacao);
                if (perfilFuncionario === "Lote") vlrAjdDiaria *= qtdpessoas;
                totalAjdCusto += vlrAjdDiaria;
            }
        });
       
        // --- REGRA DE OURO: AJUSTE DE CACHÊ POR AJUDA PAGA (INCLUSÃO E REMOÇÃO) ---
        if (isAjudaCustoPaga) {
            // 1. Calculamos quanto vale 1 Ajuda de Custo unitária
            let vlrAjudaUnitario = (transporte + alimentacao);
            if (perfilFuncionario === "Lote") vlrAjudaUnitario *= qtdpessoas;

            if (qtdAtuais < qtdOriginais) {
                // CASO A: REMOÇÃO - O funcionário recebeu ajuda de custo por dias que não vai trabalhar
                // Descontamos esse excesso do Cachê (pois o campo Ajuda de Custo está travado/pago)
                const qtdRemovida = qtdOriginais - qtdAtuais;
                const valorParaDescontar = qtdRemovida * vlrAjudaUnitario;

                console.log("%c >>> REMOÇÃO: Descontando ajuda do Cachê <<< ", "background: #ff0000; color: #fff");
                totalCache = totalCache - valorParaDescontar;

            } else if (qtdAtuais > qtdOriginais) {
                // CASO B: INCLUSÃO - O funcionário vai trabalhar dias extras e precisa de ajuda de custo para eles
                // Como a ajuda original já foi paga, somamos o valor dessas novas ajudas ao Cachê
                const qtdAdicionada = qtdAtuais - qtdOriginais;
                const valorParaAdicionar = qtdAdicionada * vlrAjudaUnitario;

                console.log("%c >>> INCLUSÃO: Somando ajuda extra ao Cachê <<< ", "background: #008000; color: #fff");
                totalCache = totalCache + valorParaAdicionar;
            }
        }
       
    }
    

    // if (typeof diariaDobradacheck !== 'undefined' && diariaDobradacheck.checked && datasDobrada?.length > 0) {
    //     const autorizadas = datasDobrada.filter(item => item.status === 'Autorizado');
    //     if (autorizadas.length > 0) {
    //         totalCache += (cacheInput * autorizadas.length);
    //         let vlrAjudDobraTotal = (vlrAlimentacaoDobra || 0) * autorizadas.length;
            
    //         if (isAjudaCustoPaga) {
    //             totalCache += vlrAjudDobraTotal; // Vai para o cache para não mexer na ajuda paga
    //         } else {
    //             totalAjdCusto += vlrAjudDobraTotal;
    //         }
    //     }
    // }

    // --- 2. DIÁRIAS DOBRADAS (CÁLCULO DINÂMICO POR FUNÇÃO/NÍVEL/ALIMENTAÇÃO) ---
    if (typeof diariaDobradacheck !== 'undefined' && diariaDobradacheck.checked && datasDobrada?.length > 0) {
        const autorizadas = datasDobrada.filter(item => item.status === 'Autorizado');
        if (autorizadas.length > 0) {
            
            // Verifica se possui valor específico de cachê para a função selecionada, senão usa o padrão do form
            const valorCustoDobraUnitaria = (typeof window.vlrCacheDobraSelecionado !== 'undefined' && window.vlrCacheDobraSelecionado > 0)
                ? window.vlrCacheDobraSelecionado
                : cacheInput;

            // 🚀 VERIFICA SE POSSUI VALOR ESPECÍFICO DE ALIMENTAÇÃO DA FUNÇÃO SELECIONADA
            // Se o valor estiver definido na window (mesmo que seja 0.00), usa ele. Caso contrário, usa o fallback do formulário.
            const valorAlimDobraUnitaria = (typeof window.vlrAlimentacaoDobraSelecionado !== 'undefined')
                ? window.vlrAlimentacaoDobraSelecionado
                : (vlrAlimentacaoDobra || alimentacao || 0);

            // Soma o custo dinâmico da função escolhida multiplicado pelas dobras autorizadas
            totalCache += (valorCustoDobraUnitaria * autorizadas.length);
            
            // Multiplica a alimentação específica pela quantidade de dobras
            let vlrAjudDobraTotal = valorAlimDobraUnitaria * autorizadas.length;
            
            if (isAjudaCustoPaga) {
                totalCache += vlrAjudDobraTotal; // Vai para o cachê para não mexer na ajuda que já está paga/fechada
            } else {
                totalAjdCusto += vlrAjudDobraTotal; // Soma no totalizador de ajuda de custo normal
            }
            
            console.log(`💰 [Cálculo Dobra] Cachê Base: R$ ${valorCustoDobraUnitaria.toFixed(2)} | Alimentação da Função: R$ ${valorAlimDobraUnitaria.toFixed(2)} | Qtd: ${autorizadas.length}`);
        }
    }

    // --- 3. MEIAS DIÁRIAS ---
    if (typeof meiaDiariacheck !== 'undefined' && meiaDiariacheck.checked && datasMeiaDiaria?.length > 0) {
        const autorizadas = datasMeiaDiaria.filter(item => item.status === 'Autorizado');
        if (autorizadas.length > 0) {
            let vlrMeiaUnitario = cacheInput / 2; // 110
            let vlrAjudMeiaUnitario = vlrAlimentacaoDobra || 0; // 40

            totalCache += (vlrMeiaUnitario * autorizadas.length);
            
            if (isAjudaCustoPaga) {
                totalCache += (vlrAjudMeiaUnitario * autorizadas.length); // 40 vão para o cachê
            } else {
                totalAjdCusto += (vlrAjudMeiaUnitario * autorizadas.length);
            }
        }
    }

    // --- 4. AJUSTE E CAIXINHA ---
    if ((document.getElementById("statusAjusteCusto")?.value || "Pendente") === 'Autorizado') {
        totalCache += ajusteCusto;
    }
    if ((document.getElementById("statusCaixinha")?.value || "Pendente") === 'Autorizado') {
        totalCache += caixinha;
    }

    // --- 5. ATUALIZAÇÃO FINAL ---
    const totalGeral = totalCache + totalAjdCusto;

    document.getElementById('vlrTotal').value = 'R$ ' + totalGeral.toFixed(2).replace('.', ',');
    document.getElementById('vlrTotalHidden').value = totalGeral.toFixed(2);

    document.getElementById('vlrTotalCache').value = 'R$ ' + totalCache.toFixed(2).replace('.', ',');
    document.getElementById('vlrTotalCacheHidden').value = totalCache.toFixed(2);

    document.getElementById('vlrTotalAjdCusto').value = 'R$ ' + totalAjdCusto.toFixed(2).replace('.', ',');
    document.getElementById('vlrTotalAjdCustoHidden').value = totalAjdCusto.toFixed(2);

    const obsInput = document.getElementById('obsPosPgto');
    const containerObs = document.getElementById('containerObsPosPgto');
    const temInformacao = obsInput.value.trim().length > 0;

    if (temInformacao) {
        containerObs.classList.add('show-obs');
    } else {
        containerObs.classList.remove('show-obs');
    }
}


function gerarLogDiferencaDatas(datasOriginais, datasAtuais, motivoInput) {
    // 1. Garante que estamos lidando com strings no formato DD/MM/AAAA para comparar e exibir
    const formatarParaDiaMesAno = (data) => {
        const d = new Date(data);
        return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' }); 
    };

    const originaisFormatadas = datasOriginais.map(d => formatarParaDiaMesAno(d));
    const atuaisFormatadas = datasAtuais.map(d => formatarParaDiaMesAno(d));

    // 2. Descobre o que foi removido e o que foi adicionado
    const removidas = originaisFormatadas.filter(d => !atuaisFormatadas.includes(d));
    const inseridas = atuaisFormatadas.filter(d => !originaisFormatadas.includes(d));

    // 3. Monta as mensagens de forma limpa
    let mensagensDiferenca = [];
    
    if (removidas.length > 0) {
        mensagensDiferenca.push(`Data(s) removida(s): ${removidas.join(', ')}`);
    }
    if (inseridas.length > 0) {
        mensagensDiferenca.push(`Data(s) inserida(s): ${inseridas.join(', ')}`);
    }

    // Se por acaso o usuário não mudou nenhuma data, mas o botão foi clicado
    if (mensagensDiferenca.length === 0) {
        return `[${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}] Nenhuma data foi alterada - Motivo: ${motivoInput}`;
    }

    // 4. Retorna a string final idêntica ao seu padrão
    const dataHoraAtual = new Date().toLocaleDateString('pt-BR') + ', ' + new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
    
    return `[${dataHoraAtual}] Alteração em Alteração de Datas: ${mensagensDiferenca.join(' | ')} - Motivo: ${motivoInput} - Valores refletidos ao total do cachê pois AJUDA DE CUSTO já está PAGO`;
    return `[${dataHoraAtual}] Alteração em Alteração de Datas: ${mensagensDiferenca.join(' | ')} - Motivo: ${motivoInput} - Valores refletidos ao total do cachê pois AJUDA DE CUSTO já está PAGO`;
}

function registrarLogPosPagamento(msg) {
    const obsInput = document.getElementById('obsPosPgto');
    if (!obsInput) return;

    // IDs extraídos do seu log de envio: statuspgtoajdcto e statuspgto
    const statusAjd = document.getElementById('statusPgtoAjudaCusto')?.value || "";
    const statusCache = document.getElementById('statusPgto')?.value || ""; 

    const isPago = statusAjd.toLowerCase() === 'pago' || statusCache.toLowerCase() === 'pago';

    console.log("Status detectados:", { statusAjd, statusCache, isPago });

    if (isPago) {
        const dataHora = new Date().toLocaleString('pt-BR', { 
            day: '2-digit', 
            month: '2-digit', 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        const novaEntrada = `[${dataHora}] ${msg} - Valores refletidos ao total do cachê pois AJUDA DE CUSTO já está PAGO\n`;

        // Só adiciona se a mensagem exata ainda não existir para esta ação
        if (!obsInput.value.includes(msg)) {
            obsInput.value += novaEntrada;
            
            const container = document.getElementById('containerObsPosPgto');
            if (container) {
                container.classList.add('show-obs');
                container.style.display = 'block';
            }
            
            obsInput.scrollTop = obsInput.scrollHeight;
            console.log("%cLog registrado na OBS!", "color: blue; font-weight: bold;");
        }
    }
}

['vlrCusto', 'ajusteCusto', 'transporte',  'alimentacao', 'caixinha'].forEach(function(id) {
    const el = document.getElementById(id);
    if(el) el.addEventListener('input', calcularValorTotal);
});

// // Adiciona listeners para os checkboxes de diária também!
['diariaDobradacheck', 'meiaDiariacheck', 'viagem1Check', 'viagem2Check', 'viagem3Check'].forEach(function(id) {
    const el = document.getElementById(id);
    if(el) el.addEventListener('change', calcularValorTotal);
});

// // Cria um observer para o contadorDatas para recalcular quando mudar texto
const contadorDatasEl = document.getElementById('contadorDatas');
if (contadorDatasEl) {
    console.log("Contador de Datas encontrado.");
    const observer = new MutationObserver(calcularValorTotal);
    observer.observe(contadorDatasEl, { childList: true, characterData: true, subtree: true });
}

function configurarPreviewPDF() {
    const inputs = document.querySelectorAll('.filePDFInput');
    inputs.forEach(function(input) {
        input.addEventListener('change', function() {
            const container = this.closest('.containerPDF');
            const fileNamePDF = container.querySelector('.fileNamePDF');
            const hiddenPDF = container.querySelector('.hiddenPDF');
            const file = this.files[0];

            // --- ALTERAÇÃO AQUI ---
            // Se não houver arquivo, ou se o arquivo não for PDF E não for Imagem, então limpa.
            if (!file || (file.type !== 'application/pdf' && !file.type.startsWith('image/'))) {
                if (fileNamePDF) fileNamePDF.textContent = 'Nenhum arquivo selecionado';
                if (hiddenPDF) hiddenPDF.value = '';
                // Adicionalmente, se for imagem, esconde a prévia da imagem
                const previewImg = container.querySelector('img[id^="preview"]'); // Tenta encontrar a img de prévia
                if (previewImg) previewImg.style.display = 'none';
                // E se for PDF, esconde o link de PDF
                const pdfPreviewDiv = container.querySelector('div[id^="pdfPreview"]');
                if (pdfPreviewDiv) pdfPreviewDiv.style.display = 'none';
                return;
            }

            const reader = new FileReader();
            reader.onload = function(e) {
                if (fileNamePDF) fileNamePDF.textContent = file.name;
                if (hiddenPDF) hiddenPDF.value = e.target.result; // Ainda está salvando Base64 aqui, o que você não quer mais para o backend

                // Lógica de pré-visualização (duplicada de setupComprovanteUpload)
                const previewImg = container.querySelector('img[id^="preview"]');
                const pdfPreviewDiv = container.querySelector('div[id^="pdfPreview"]');
                const pdfLink = container.querySelector('a[id^="link"]');

                if (file.type.startsWith('image/')) {
                    if (previewImg) {
                        previewImg.src = e.target.result;
                        previewImg.style.display = 'block';
                    }
                    if (pdfPreviewDiv) pdfPreviewDiv.style.display = 'none';
                } else if (file.type === 'application/pdf') {
                    if (pdfLink) pdfLink.href = e.target.result;
                    if (pdfPreviewDiv) pdfPreviewDiv.style.display = 'block';
                    if (previewImg) previewImg.style.display = 'none';
                }

                console.log("Arquivo carregado por configurarPreviewPDF:", file.name);
            };
            reader.readAsDataURL(file);
        });
    });
}

function configurarPreviewImagem() {

    const inputImg = document.getElementById('file');
    const previewImg = document.getElementById('previewFoto');
    const fileNameImg = document.getElementById('fileName');
    const hiddenImg = document.getElementById('linkFotoSidStaff');
    const headerImg = document.getElementById('uploadHeader');

    inputImg.addEventListener('change', function () {
        const file = inputImg.files[0];
        if (!file || !file.type.startsWith('image/')) {
        previewImg.style.display = 'none';
        headerImg.style.display = 'block';
        fileNameImg.textContent = 'Nenhum arquivo selecionado';
        hiddenImg.value = '';
        return;
        }

        const reader = new FileReader();
        reader.onload = function (e) {
        previewImg.src = e.target.result;
        previewImg.style.display = 'block';
        headerImg.style.display = 'none';
        fileNameImg.textContent = file.name;
        hiddenImg.value = e.target.result;
        };
        reader.readAsDataURL(file);
        console.log("pegou a imagem do ", fileNameImg)
    });
}

// function mostrarTarja() {
//     var select = document.getElementById('avaliacao');
//     var tarja = document.getElementById('tarjaAvaliacao');

//     tarja.className = 'tarja-avaliacao'; // Reseta classes
//     tarja.style.display = 'none'; // Oculta por padrão

//     if (select.value === 'muito_bom') {
//     tarja.classList.add('muito-bom');
//     tarja.textContent = 'Funcionário Muito Bom';
//     tarja.style.display = 'block';
//     } else if (select.value === 'satisfatorio') {
//     tarja.classList.add('satisfatorio');
//     tarja.textContent = 'Funcionário Satisfatório';
//     tarja.style.display = 'block';
//     } else if (select.value === 'regular') {
//     tarja.classList.add('regular');
//     tarja.textContent = 'Funcionário Regular';
//     tarja.style.display = 'block';
//     }
// }


export function preencherComprovanteCampo(filePath, campoNome) {
    const fileLabel = document.querySelector(`.collumn .containerPDF label[for="file${campoNome}"]`);
    const fileNameDisplay = document.getElementById(`fileName${campoNome}`);
    const fileInput = document.getElementById(`file${campoNome}`);
    const linkDisplayContainer = document.getElementById(`linkContainer${campoNome}`);
    const mainDisplayContainer = document.getElementById(`comprovante${campoNome}Display`);
    const hiddenRemoverInput = document.getElementById(`limparComprovante${campoNome}`);

    if (!fileLabel || !fileNameDisplay || !fileInput || !linkDisplayContainer || !mainDisplayContainer || !hiddenRemoverInput) {
        console.warn(`[PREENCHER-COMPROVANTE] Elementos não encontrados para o campo: ${campoNome}`);
        return;
    }

    // Limpa o estado inicial
    fileLabel.style.display = 'flex';
    linkDisplayContainer.innerHTML = '';
    mainDisplayContainer.style.display = 'none';
    hiddenRemoverInput.value = 'false';
    fileNameDisplay.textContent = 'Nenhum arquivo selecionado';
    fileInput.value = '';

    if (filePath) {
        const fileName = filePath.split('/').pop();

        fileLabel.style.display = 'none';
        mainDisplayContainer.style.display = 'block';

        let linkHtml = '';
        if (filePath.toLowerCase().match(/\.(jpeg|jpg|png|gif|webp|bmp|svg|jfif)$/i)) {
            linkHtml = `<a href="${filePath}" target="_blank" class="comprovante-salvo-link btn-success">Ver Imagem: ${fileName}</a>`;
        } else if (filePath.toLowerCase().endsWith('.pdf')) {
            linkHtml = `<a href="${filePath}" target="_blank" class="comprovante-salvo-link btn-info">Ver PDF: ${fileName}</a>`;
        }

        let removerBtnHtml = '';

        console.log("PERMISSAO", temPermissaoMaster);
        if (temPermissaoMaster)
        {
            removerBtnHtml = `
                <button type="button" class="btn btn-sm btn-danger remover-comprovante-btn" data-campo="${campoNome}">
                    <i class="fas fa-trash"></i> Remover
                </button>
            `;
        }

        linkDisplayContainer.innerHTML = `
            ${linkHtml}
            ${removerBtnHtml}
        `;
    }
}

document.addEventListener('click', function(e) {
    // Verifica se o clique foi em um botão com a classe 'remover-comprovante-btn'

    // // 1. Identifica o botão de forma precisa
    // const removerBtn = e.target.closest('.remover-comprovante-btn');

    // // 2. Se não clicou no botão de remover, ignora o resto da função
    // if (!removerBtn) return;

    // // 3. Evita que o evento suba para outros elementos ou interfira em calendários
    // e.preventDefault();
    // e.stopPropagation();

    // const campoNome = removerBtn.getAttribute('data-campo');

    // if (!campoNome) return;

    if (e.target.classList.contains('remover-comprovante-btn') || e.target.closest('.remover-comprovante-btn')) {
        const removerBtn = e.target.closest('.remover-comprovante-btn');
        const campoNome = removerBtn.getAttribute('data-campo');

        // Exibe o pop-up de confirmação antes de apagar
        Swal.fire({
            title: 'Você tem certeza que quer remover este comprovante?',
            text: "Esta ação irá remover o comprovante. Você não poderá desfazê-la!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Sim, remover!',
            cancelButtonText: 'Não, cancelar'
        }).then((result) => {
            // Se o usuário confirmou a remoção
            if (result.isConfirmed) {
                // Obter referências aos elementos do campo específico
                const fileLabel = document.querySelector(`.collumn .containerPDF label[for="file${campoNome}"]`);
                const linkDisplayContainer = document.getElementById(`linkContainer${campoNome}`);
                const mainDisplayContainer = document.getElementById(`comprovante${campoNome}Display`);
                const hiddenRemoverInput = document.getElementById(`limparComprovante${campoNome}`);
                const fileInput = document.getElementById(`file${campoNome}`);
                const fileNameDisplay = document.getElementById(`fileName${campoNome}`);
                
                // Oculta a área do link/botão de remoção
                if (mainDisplayContainer) mainDisplayContainer.style.display = 'none';
                if (linkDisplayContainer) linkDisplayContainer.innerHTML = '';
                
                // Mostra a área de upload de arquivo
                if (fileLabel) fileLabel.style.display = 'block';
                
                // Limpa o input do arquivo e o texto exibido
                if (fileInput) fileInput.value = '';
                if (fileNameDisplay) fileNameDisplay.textContent = 'Nenhum arquivo selecionado';
                
                // Seta o input hidden para indicar que o comprovante deve ser removido no servidor
                if (hiddenRemoverInput) hiddenRemoverInput.value = 'true';

                // Opcional: Mostra uma mensagem de sucesso após a remoção
                // Swal.fire(
                //     'Removido!',
                //     'O comprovante foi marcado para remoção.',
                //     'success'
                // );
            }
        });
    }
});


// async function verificarLimiteDeFuncao(criterios, dadosErroBackend = null) {
//     console.log("Iniciando verificação de limite de função com critérios:", criterios, "e dados de erro do backend:", dadosErroBackend);

//     const nmEvento = (criterios.nmEvento || '').trim().toUpperCase();
//     const nmFuncao = (criterios.nmFuncao || '').trim().toUpperCase();
//     const idFuncionario = criterios.idFuncionario || document.getElementById('idFuncionario')?.value || null;
//     const selectFunc = document.getElementById('nmFuncionario');       
//     const nmFuncionario = criterios.nmFuncionario || selectFunc?.options[selectFunc.selectedIndex]?.text;

//     // 1. Coleta de datas de forma robusta
//     const campoData = document.getElementById('periodoEvento'); 
//     // let datasSelecionadas = [];
//     // if (campoData && campoData._flatpickr && campoData._flatpickr.selectedDates.length > 0) {
//     //     datasSelecionadas = campoData._flatpickr.selectedDates.map(d => d.toLocaleDateString('en-CA'));
//     // } else if (criterios.datasEvento) {
//     //     datasSelecionadas = Array.isArray(criterios.datasEvento) ? criterios.datasEvento : [criterios.datasEvento];
//     // } else if (window.datasEventoPicker && window.datasEventoPicker.selectedDates.length > 0) {
//     //     datasSelecionadas = window.datasEventoPicker.selectedDates.map(d => d.toLocaleDateString('en-CA'));
//     // }

//     // Alteração na Seção 1: Priorize criterios.datasEvento
//     let datasSelecionadas = [];
//     if (criterios.datasEvento && Array.isArray(criterios.datasEvento)) {
//         datasSelecionadas = criterios.datasEvento; // Aqui já virão as duplicatas da dobra
//     } else if (campoData && campoData._flatpickr && campoData._flatpickr.selectedDates.length > 0) {
//         datasSelecionadas = campoData._flatpickr.selectedDates.map(d => d.toLocaleDateString('en-CA'));
//     }

//     console.log("Datas selecionadas para verificação:", datasSelecionadas);

//     const dataUnicaParaBanco = datasSelecionadas[0] || null;

//     // 2. Busca do Orçamento na Memória
//     const chaveSimples = [nmEvento, nmFuncao].filter(p => p).join('-');
//     let dadosOrcamento = orcamentoPorFuncao[chaveSimples];

//     if (!dadosOrcamento) {
//         const todasAsChaves = Object.keys(orcamentoPorFuncao);
//         const chaveEncontrada = todasAsChaves.find(c => c.includes(nmEvento) && c.includes(nmFuncao));
//         if (chaveEncontrada) dadosOrcamento = orcamentoPorFuncao[chaveEncontrada];
//     }

//     if (!dadosOrcamento && typeof idOrcamentoAtual !== 'undefined' && idOrcamentoAtual) {
//         dadosOrcamento = Object.values(orcamentoPorFuncao).find(o => o.idOrcamento == idOrcamentoAtual);
//     }

//     console.log("DEBUG dadosOrcamento:", {
//         objeto: dadosOrcamento,
//         quantidadeEscalada: dadosOrcamento?.quantidade_escalada,
//         quantidadeOrcada: dadosOrcamento?.quantidade_orcada,
//         datasOrcadas: dadosOrcamento?.datasOrcadas,
//         chaveSimples
//     });

//     // --- LÓGICA CRÍTICA: VERIFICAÇÃO DE DATAS ---
//     // if (datasSelecionadas.length > 0) {
//     //     let ehExcecaoDeData = false;
//     //     let datasPermitidas = [];

//     //     if (dadosOrcamento && dadosOrcamento.datasOrcadas) {
//     //         //datasPermitidas = Array.isArray(dadosOrcamento.datasOrcadas) ? dadosOrcamento.datasOrcadas : [dadosOrcamento.datasOrcadas];
//     //         //ehExcecaoDeData = datasSelecionadas.some(dataSel => !datasPermitidas.includes(dataSel));

//     //         // 1. Normaliza as datas do orçamento (YYYY-MM-DD)
//     //         datasPermitidas = (Array.isArray(dadosOrcamento.datasOrcadas) 
//     //             ? dadosOrcamento.datasOrcadas 
//     //             : [dadosOrcamento.datasOrcadas]).map(d => String(d).trim().substring(0, 10));

//     //         // 2. Para checar se a data ESTÁ NO ORÇAMENTO, usamos um Set para pegar datas únicas
//     //         // Isso evita que a duplicata da "dobra" confunda a verificação de período
//     //         const datasUnicasSolicitadas = [...new Set(datasSelecionadas.map(d => String(d).trim().substring(0, 10)))];

//     //         console.log("DEBUG - Datas do Orçamento:", datasPermitidas);
//     //         console.log("DEBUG - Datas Únicas Solicitadas:", datasUnicasSolicitadas);

//     //         // 3. Só é exceção se alguma data única NÃO estiver nas permitidas
//     //         ehExcecaoDeData = datasUnicasSolicitadas.some(dataSel => !datasPermitidas.includes(dataSel));
//     //     } else {
//     //         ehExcecaoDeData = true; 
//     //     }

//     //     if (ehExcecaoDeData) {
//     //         // Se já capturamos a justificativa nesta sessão, apenas retorna os dados salvos
//     //         if (window.justificativaParaSalvar && window.tipoExcecaoAtual) {
//     //             return { 
//     //                 allowed: false, 
//     //                 solicitouAutorizacao: true, 
//     //                 justificativa: window.justificativaParaSalvar,
//     //                 tipoSolicitacao: window.tipoExcecaoAtual 
//     //             };
//     //         }

//     //         // DISTINÇÃO DE COMPORTAMENTO:
//     //         // Se NÃO temos dadosErroBackend, significa que é apenas uma verificação preventiva (ex: onchange)
//     //         if (!dadosErroBackend && !window.estaSalvando) {
//     //             const { isConfirmed } = await Swal.fire({
//     //                 icon: 'info',
//     //                 title: 'Período fora do planejado',
//     //                 html: `As datas <b>${datasSelecionadas.join(', ')}</b> não constam no orçamento aprovado.<br>Deseja prosseguir ou corrigir?`,
//     //                 showCancelButton: true,
//     //                 confirmButtonText: 'Prosseguir',
//     //                 cancelButtonText: 'Corrigir Datas',
//     //                 confirmButtonColor: '#28a745'
//     //             });

//     //             // Se prosseguir, apenas permite mas não seta exceção ainda (deixa para o botão enviar)
//     //             return { allowed: isConfirmed, preventDefault: !isConfirmed };
//     //         }

//     //         let decisaoManual = null;

//     //         // SE CHEGOU AQUI: É o momento do ENVIO ou um ERRO do backend retornou
//     //         // Mostrar o modal completo com todas as opções
//     //         const result = await Swal.fire({
//     //             icon: 'warning',
//     //             title: 'Data fora do Orçamento',
//     //             html: `As datas selecionadas não constam no orçamento aprovado.<br>Como deseja prosseguir?`,
//     //             showCancelButton: true,
//     //             showDenyButton: true,
//     //             showNeutralButton: true, // Simularemos o botão neutro via HTML/Custom se necessário, ou usamos um ternário
//     //             confirmButtonText: 'Solicitar Aditivo',
//     //             denyButtonText: 'Extra Bonificado',
//     //             cancelButtonText: 'Cancelar',
//     //             footer: '<button id="btnProsseguirSem" class="swal2-confirm swal2-styled" style="background-color: #6e7881;">Prosseguir sem solicitação</button>',
//     //             didOpen: () => {
//     //                 // AQUI o botão já existe no DOM
//     //                 const btnProsseguir = document.getElementById('btnProsseguirSem');
//     //                 if (btnProsseguir) {
//     //                     btnProsseguir.onclick = () => {
//     //                         decisaoManual = 'prosseguir';
//     //                         Swal.clickConfirm();
//     //                     };
//     //                 }
//     //             }
//     //         });            
            

//     //         if (result.isConfirmed || result.isDenied) {
//     //             const sufixo = result.isConfirmed ? 'Aditivo' : 'Extra Bonificado';
//     //             const tipoEscolhido = `${sufixo} - Datas fora do Orçamento`;
                
//     //             const dadosExcecao = await solicitarDadosExcecao(
//     //                 tipoEscolhido, 
//     //                 dadosOrcamento ? dadosOrcamento.idOrcamento : (idOrcamentoAtual || 0), 
//     //                 nmFuncao, 
//     //                 criterios.idFuncao, 
//     //                 idFuncionario, 
//     //                 dataUnicaParaBanco
//     //             );

//     //             if (dadosExcecao && dadosExcecao.confirmado) {
//     //                 window.tipoExcecaoAtual = tipoEscolhido;
//     //                 window.justificativaParaSalvar = dadosExcecao.justificativa;
//     //                 window.bSalvarComoInativo = true;
                    
//     //                 return { 
//     //                     allowed: false, 
//     //                     solicitouAutorizacao: true, 
//     //                     justificativa: dadosExcecao.justificativa, 
//     //                     tipoSolicitacao: tipoEscolhido 
//     //                 };
//     //             }
//     //         } else if (decisaoManual === 'prosseguir') {
//     //             // Usuário escolheu prosseguir sem solicitação (Ativo: true)
//     //             window.bSalvarComoInativo = false;
//     //             window.tipoExcecaoAtual = null;
//     //             return { allowed: true };
//     //         }

//     //         return { allowed: false }; 
//     //     }
//     // }


// // --- LÓGICA CRÍTICA: VERIFICAÇÃO DE DATAS ---
//     if (datasSelecionadas.length > 0) {
//         let ehExcecaoDeData = false;
//         let ehDataInexistenteNoOrcamento = false;

//         let datasPermitidas = [];

//         const datasSelNormalizadas = [...new Set(datasSelecionadas.map(d => String(d).trim().substring(0, 10)))];

//         const diasUnicosSolicitados = [...new Set(datasSelecionadas.map(d => String(d).trim().substring(0, 10)))];

//         if (dadosOrcamento && dadosOrcamento.datasOrcadas) {
//             // 2. Normalizamos as datas que vêm do orçamento
//             datasPermitidas = (Array.isArray(dadosOrcamento.datasOrcadas) 
//                 ? dadosOrcamento.datasOrcadas 
//                 : [dadosOrcamento.datasOrcadas]).map(d => String(d).trim().substring(0, 10));

//             console.log("DEBUG DATAS:", { solicitadas: datasSelNormalizadas, permitidas: datasPermitidas });

//             // 3. Verifica se alguma solicitada não está nas permitidas
//             ehExcecaoDeData = datasSelNormalizadas.some(dataSel => !datasPermitidas.includes(dataSel));
//         } else {
//             // Se não tem dados do orçamento, tudo vira exceção
//             ehExcecaoDeData = true; 
//         }

//         // --- BLOCO DO ALERTA ---
//         if (ehExcecaoDeData) {
//             // Se já temos justificativa salva, retorna direto
//             if (window.justificativaParaSalvar && window.tipoExcecaoAtual) {
//                 return { 
//                     allowed: false, 
//                     solicitouAutorizacao: true, 
//                     justificativa: window.justificativaParaSalvar,
//                     tipoSolicitacao: window.tipoExcecaoAtual 
//                 };
//             }

//             // Alerta preventivo (Info)
//             if (!dadosErroBackend && !window.estaSalvando) {
//                 const { isConfirmed } = await Swal.fire({
//                     icon: 'info',
//                     title: 'Período fora do planejado',
//                     html: `As datas <b>${datasSelNormalizadas.join(', ')}</b> não constam no orçamento aprovado.<br>Deseja prosseguir ou corrigir?`,
//                     showCancelButton: true,
//                     confirmButtonText: 'Prosseguir',
//                     cancelButtonText: 'Corrigir Datas',
//                     confirmButtonColor: '#28a745'
//                 });

//                 return { allowed: isConfirmed, preventDefault: !isConfirmed };
//             }

//             // Alerta de Envio (Warning com opções de Aditivo/Extra)
//             let decisaoManual = null;
//             const result = await Swal.fire({
//                 icon: 'warning',
//                 title: 'Data fora do Orçamento',
//                 html: `As datas selecionadas não constam no orçamento aprovado.<br>Como deseja prosseguir?`,
//                 showCancelButton: true,
//                 showDenyButton: true,
//                 confirmButtonText: 'Solicitar Aditivo',
//                 denyButtonText: 'Extra Bonificado',
//                 cancelButtonText: 'Cancelar',
//                 footer: '<button id="btnProsseguirSem" class="swal2-confirm swal2-styled" style="background-color: #6e7881;">Prosseguir sem solicitação</button>',
//                 didOpen: () => {
//                     const btnProsseguir = document.getElementById('btnProsseguirSem');
//                     if (btnProsseguir) {
//                         btnProsseguir.onclick = () => {
//                             decisaoManual = 'prosseguir';
//                             Swal.clickConfirm();
//                         };
//                     }
//                 }
//             });            

//             if (result.isConfirmed || result.isDenied) {
//                 const sufixo = result.isConfirmed ? 'Aditivo' : 'Extra Bonificado';
//                 const tipoEscolhido = `${sufixo} - Datas fora do Orçamento`;
                
//                 const dadosExcecao = await solicitarDadosExcecao(
//                     tipoEscolhido, 
//                     dadosOrcamento ? dadosOrcamento.idOrcamento : (idOrcamentoAtual || 0), 
//                     nmFuncao, 
//                     criterios.idFuncao, 
//                     idFuncionario, 
//                     dataUnicaParaBanco
//                 );

//                 if (dadosExcecao && dadosExcecao.confirmado) {
//                     window.tipoExcecaoAtual = tipoEscolhido;
//                     window.justificativaParaSalvar = dadosExcecao.justificativa;
//                     window.bSalvarComoInativo = true;
                    
//                     return { 
//                         allowed: false, 
//                         solicitouAutorizacao: true, 
//                         justificativa: dadosExcecao.justificativa, 
//                         tipoSolicitacao: tipoEscolhido 
//                     };
//                 }
//             } else if (decisaoManual === 'prosseguir') {
//                 window.bSalvarComoInativo = false;
//                 window.tipoExcecaoAtual = null;
//                 // Deixa passar para a próxima seção (Vagas)
//             } else {
//                 return { allowed: false }; 
//             }
//         } // Fim do ehExcecaoDeData
//     } // Fim do if datasSelecionadas.length

//     // 3. CONTAGEM DE VAGAS
//     // if (dadosOrcamento) {
//     //     let countNaTabela = 0;
//     //     document.querySelectorAll('#eventsTableBody tr').forEach(linha => {
//     //         try {
//     //             const data = JSON.parse(linha.dataset.eventData);
//     //             if (data.nmfuncao?.trim().toUpperCase() === nmFuncao &&
//     //                 data.nmevento?.trim().toUpperCase() === nmEvento) {
//     //                 countNaTabela++;
//     //             }
//     //         } catch (e) {}
//     //     });

//     //     const totalJaOcupado = Number(dadosOrcamento.quantidadeEscalada || 0) + countNaTabela;
//     //     const limite = Number(dadosOrcamento.quantidadeOrcada || 0);

//     //     if (totalJaOcupado >= limite) {
//     //          if (window.tipoExcecaoAtual && window.tipoExcecaoAtual.includes("Vaga Excedida")) {
//     //             return { allowed: false, solicitouAutorizacao: true, justificativa: window.justificativaParaSalvar };
//     //         }

//     //         const { value: decisaoVaga } = await Swal.fire({
//     //             icon: 'warning',
//     //             title: 'Limite de Vagas Excedido',
//     //             text: `A função ${nmFuncao} já atingiu o limite de ${limite} vaga(s). Deseja solicitar autorização?`,
//     //             showCancelButton: true,
//     //             showDenyButton: true,
//     //             confirmButtonText: 'Solicitar Aditivo',
//     //             denyButtonText: 'Extra Bonificado',
//     //             cancelButtonText: 'Cancelar'
//     //         });

//     //         if (decisaoVaga === true || decisaoVaga === false) {
//     //             const sufixo = decisaoVaga === true ? 'Aditivo' : 'Extra Bonificado';
//     //             const tipoEscolhido = `${sufixo} - Vaga Excedida`;
                
//     //             const dadosExcecao = await solicitarDadosExcecao(
//     //                 tipoEscolhido, 
//     //                 dadosOrcamento.idOrcamento, 
//     //                 nmFuncao, 
//     //                 criterios.idFuncao, 
//     //                 idFuncionario, 
//     //                 dataUnicaParaBanco
//     //             );

//     //             if (dadosExcecao && dadosExcecao.confirmado) {
//     //                 window.tipoExcecaoAtual = tipoEscolhido;
//     //                 window.justificativaParaSalvar = dadosExcecao.justificativa;
//     //                 window.bSalvarComoInativo = true;
//     //                 return { allowed: false, solicitouAutorizacao: true, justificativa: dadosExcecao.justificativa, tipoSolicitacao: tipoEscolhido };
//     //             }
//     //         }
//     //         return { allowed: false };
//     //     }
//     // }

//     // 3. CONTAGEM DE VAGAS (Levando em conta dobras já existentes na tabela)
//     if (dadosOrcamento) {
//         let vagasOcupadasNaTabela = 0;
//         document.querySelectorAll('#eventsTableBody tr').forEach(linha => {
//             try {
//                 const data = JSON.parse(linha.dataset.eventData);
//                 if (data.nmfuncao?.trim().toUpperCase() === nmFuncao &&
//                     data.nmevento?.trim().toUpperCase() === nmEvento) {
                    
//                     // Conta a vaga principal da linha
//                     vagasOcupadasNaTabela++;

//                     // VERIFICA SE ESTA LINHA TEM DOBRA:
//                     // Ajuste os nomes dos campos conforme seu objeto 'data' do banco
//                     if (data.datadiariadobrada) {
//                         const dobras = typeof data.datadiariadobrada === 'string' 
//                             ? JSON.parse(data.datadiariadobrada) 
//                             : data.datadiariadobrada;
                        
//                         if (Array.isArray(dobras)) {
//                             vagasOcupadasNaTabela += dobras.length; // Soma as dobras como novas vagas
//                         }
//                     }
//                 }
//             } catch (e) { console.error("Erro ao contar vaga na linha:", e); }
//         });

//         // Agora somamos o que já está no banco + o que está na tabela + o que o usuário quer inserir AGORA
//         // O 'datasSelecionadas' aqui já deve conter as duplicatas se o botão Enviar foi ajustado
//         // 1. Quantas diárias o funcionário vai ocupar nesta ação?
//             // Ex: Dias 01, 02, 03, 04 (4 diárias) + Dobras 01, 03, 04 (3 diárias) = 7 total
//             const qttDiariasNormais = datasSelecionadas.length;
//             const qttDobras = datasEventoDobradas ? datasEventoDobradas.length : 0;
//             const impactoDestaAcao = qttDiariasNormais + qttDobras;

//             // 2. Total já ocupado considerando a tabela e o banco
//             const totalGeralDesejado = totalJaEscalado + vagasNaTabela + impactoDestaAcao;

//             if (totalGeralDesejado > limiteTotal) {
//                 // Verifica se o estouro é apenas por falta de vaga na data ou se o orçamento ACABOU
//                 const saldoNoOrcamento = limiteTotal - (totalJaEscalado + vagasNaTabela);
//                 const temVagaEmOutroDia = saldoNoOrcamento > 0;

//                 // Formata as datas para o Swal usando sua função
//                 const diasComDobraBR = formatarDatas([...new Set(datasEventoDobradas)]);

//                 let msg = `O limite de vagas para <b>${nmFuncao}</b> foi atingido.<br><br>`;
                
//                 if (temVagaEmOutroDia) {
//                     msg += `Você está solicitando <b>${impactoDestaAcao} diárias</b> (incluindo as dobras de ${diasComDobraBR}).<br>
//                             O orçamento atual tem apenas <b>${saldoNoOrcamento} vaga(s)</b> restante(s).<br><br>
//                             Deseja reaproveitar vagas de outros dias ou solicitar nova verba?`;
//                 }

//                 const { value: decisao } = await Swal.fire({
//                     icon: 'warning',
//                     title: 'Limite de Diárias Excedido',
//                     html: msg,
//                     showCancelButton: true,
//                     showDenyButton: true,
//                     confirmButtonText: temVagaEmOutroDia ? 'Usar Vaga de outro período' : 'Solicitar Aditivo',
//                     denyButtonText: 'Extra Bonificado',
//                     cancelButtonText: 'Cancelar',
//                     confirmButtonColor: '#28a745',
//                     denyButtonColor: '#6e7881'
//                 });

//                 if (decisao === true && temVagaEmOutroDia) {
//                     // Usuário optou por usar o saldo de outros dias do orçamento
//                     window.tipoExcecaoAtual = "Vaga Reaproveitada"; 
//                     return { allowed: true };
//                 }

//                 // Caso contrário, é Aditivo ou Extra Bonificado
//                 const sufixo = resultVaga.isConfirmed ? 'Aditivo' : 'Extra Bonificado';
//                 const tipoEscolhido = `${sufixo} - Vaga Excedida`;

//                 const dadosExcecao = await solicitarDadosExcecao(
//                     tipoEscolhido,
//                     dadosOrcamento.idOrcamento,
//                     nmFuncao,
//                     criterios.idFuncao,
//                     idFuncionario,
//                     dataUnicaParaBanco
//                 );

//                 if (dadosExcecao && dadosExcecao.confirmado) {
//                     window.tipoExcecaoAtual = tipoEscolhido;
//                     window.justificativaParaSalvar = dadosExcecao.justificativa;
//                     window.bSalvarComoInativo = true;

//                     return {
//                         allowed: false,
//                         solicitouAutorizacao: true,
//                         justificativa: dadosExcecao.justificativa,
//                         tipoSolicitacao: tipoEscolhido
//                     };
//                 }
//             }

//             return { allowed: false }; // Cancelar ou fechou o modal
//         }
//     }
// }

//estava funcional antes
// async function verificarLimiteDeFuncao(criterios, dadosErroBackend = null) {
//     console.log("Iniciando verificação de limite de função", criterios);

//     // const nmEvento = (criterios.nmEvento || '').trim().toUpperCase();
//     // const nmFuncao = (criterios.nmFuncao || '').trim().toUpperCase();
//     // const idFuncionario = criterios.idFuncionario || document.getElementById('idFuncionario')?.value || null;
//     // const selectFunc = document.getElementById('nmFuncionario');       
//     // const nmFuncionario = criterios.nmFuncionario || selectFunc?.options[selectFunc.selectedIndex]?.text;
//     // const datasEventoDobradas = criterios.datasEventoDobradas || [];

//     const nmEvento = (criterios.nmEvento || criterios.nmevento || '').trim().toUpperCase();
//     const nmFuncao = (criterios.nmFuncao || criterios.nmfuncao || criterios.descfuncao || '').trim().toUpperCase();
    
//     const idFuncionario = criterios.idFuncionario || criterios.idfuncionario || document.getElementById('idFuncionario')?.value || null;
//     const selectFunc = document.getElementById('nmFuncionario');       
//     const nmFuncionario = criterios.nmFuncionario || criterios.nmfuncionario || selectFunc?.options[selectFunc.selectedIndex]?.text;
//     const datasEventoDobradas = criterios.datasEventoDobradas || criterios.dataseventodobradas || [];

//     // 1. Coleta de datas de forma robusta
//     const campoData = document.getElementById('periodoEvento'); 
//     let datasSelecionadas = [];
//     if (criterios.datasEvento && Array.isArray(criterios.datasEvento)) {
//         datasSelecionadas = criterios.datasEvento;
//     } else if (campoData && campoData._flatpickr && campoData._flatpickr.selectedDates.length > 0) {
//         datasSelecionadas = campoData._flatpickr.selectedDates.map(d => d.toLocaleDateString('en-CA'));
//     }

//     const dataUnicaParaBanco = datasSelecionadas[0] || null;

//     let countDobras = datasEventoDobradas.length;
//     const ehDiariaDobrada = (countDobras > 0 || criterios.isDiariaDobrada === true || (typeof isDiariaDobrada !== 'undefined' && isDiariaDobrada === true));

//     if (ehDiariaDobrada) {
//         console.log("🔄 [verificarLimiteDeFuncao] É Diária Dobrada detectada no início. Ignorando Seção 2 e Seção 3 para seguir ao fluxo sequencial.");
//         return { allowed: true }; // 🌟 Retorna liberado direto, sem abrir NENHUM Swal antes da hora
//     }

//     // 2. Busca do Orçamento na Memória
//     const chaveSimples = [nmEvento, nmFuncao].filter(p => p).join('-');

//     // 🔍 CORREÇÃO: Verifique se 'orcamentoPorFuncao' existe antes de acessar
// if (typeof orcamentoPorFuncao === 'undefined' || !orcamentoPorFuncao) {
//     console.warn("⚠️ O objeto orcamentoPorFuncao não foi inicializado. Inicializando agora...");
//     window.orcamentoPorFuncao = {}; 
// }

//     //let dadosOrcamento = orcamentoPorFuncao[chaveSimples];

//     let dadosOrcamento = window.orcamentoPorFuncao ? window.orcamentoPorFuncao[chaveSimples] : undefined;

//     console.log("DADOS BRUTOS NO INÍCIO:", dadosOrcamento);

//     // if (!dadosOrcamento) {
//     //     const todasAsChaves = Object.keys(orcamentoPorFuncao);
//     //     const chaveEncontrada = todasAsChaves.find(c => c.includes(nmEvento) && c.includes(nmFuncao));
//     //     if (chaveEncontrada) dadosOrcamento = orcamentoPorFuncao[chaveEncontrada];
//     // }

//     // if (!dadosOrcamento && typeof idOrcamentoAtual !== 'undefined' && idOrcamentoAtual) {
//     //     dadosOrcamento = Object.values(orcamentoPorFuncao).find(o => o.idOrcamento == idOrcamentoAtual);
//     // }

//     if (!dadosOrcamento || (!dadosOrcamento.quantidade_orcada && !dadosOrcamento.quantidadeOrcada)) {
//         console.warn(`⚠️ [verificarLimiteDeFuncao] Cache inválido ou incompleto para '${chaveSimples}'. Forçando busca no banco de dados...`);
       
//         // 🛡️ CAPTURA BLINDADA DO ID DO CLIENTE PARA EVITAR ERRO 500 NA API
//         const idClienteDefinido = criterios.idCliente 
//             || document.getElementById('nmCliente')?.value 
//             || currentEditingStaffEvent?.idcliente 
//             || window.idClienteAtual 
//             || null;

//         console.log(`📡 [verificarLimiteDeFuncao] Recarregando orçamento com idCliente resolvido: ${idClienteDefinido}`);

//         // Executa a função mapeando os parâmetros que vieram nos critérios
//         await buscarEPopularOrcamento(
//             criterios.idEvento,
//             //iterios.idCliente,     
//             idClienteDefinido,
//             criterios.idLocalMontagem, 
//             criterios.idFuncao,
//             criterios.datasEvento
//         );
        
//         // Atualiza a variável local pegando o valor atualizado que a busca acabou de gravar no objeto global
//         if (window.orcamentoPorFuncao) {
//             dadosOrcamento = window.orcamentoPorFuncao[chaveSimples];
//         }
//     }

//     console.log("DEBUG dadosOrcamento:", {
//         objeto: dadosOrcamento,
//         quantidadeEscalada: dadosOrcamento?.quantidade_escalada,
//         quantidadeOrcada: dadosOrcamento?.quantidade_orcada,
//         datasOrcadas: dadosOrcamento?.datasOrcadas,
//         chaveSimples
//     });
    

//     // --- SEÇÃO 2: VERIFICAÇÃO DE DATAS ---
//     if (datasSelecionadas.length > 0) {
//         let ehExcecaoDeData = false;
//         let datasPermitidas = [];
//         const diasUnicosSolicitados = [...new Set(datasSelecionadas.map(d => String(d).trim().substring(0, 10)))];

//         if (dadosOrcamento && dadosOrcamento.datasOrcadas) {
//             datasPermitidas = (Array.isArray(dadosOrcamento.datasOrcadas) 
//                 ? dadosOrcamento.datasOrcadas 
//                 : [dadosOrcamento.datasOrcadas]).map(d => String(d).trim().substring(0, 10));

//             ehExcecaoDeData = diasUnicosSolicitados.some(dataSel => !datasPermitidas.includes(dataSel));
//         } else {
//             ehExcecaoDeData = true; 
//         }

//         if (ehExcecaoDeData) {
//             if (window.justificativaParaSalvar && window.tipoExcecaoAtual) {
//                 return { allowed: false, solicitouAutorizacao: true, justificativa: window.justificativaParaSalvar, tipoSolicitacao: window.tipoExcecaoAtual };
//             }

//             // --- NOVA LÓGICA DE MENSAGEM PERSONALIZADA ---
//             const temDobra = datasEventoDobradas.length > 0;
//             const dataFormatadaBR = formatarDatas(diasUnicosSolicitados);
            
//             // Se a data EXISTE nas permitidas, mas caiu aqui, é porque é um conflito de vaga/dobra
//             const aDataExisteNoOrcamento = diasUnicosSolicitados.every(d => datasPermitidas.includes(d));

//             let tituloCustom = 'Data fora do Orçamento';
//             let msgCustom = `A data <b>${dataFormatadaBR}</b> não consta no orçamento aprovado.`;

//             console.log("DEBUG - Verificando tipo de exceção:", { aDataExisteNoOrcamento, temDobra });

//             if (aDataExisteNoOrcamento && temDobra) {
//                 tituloCustom = 'Conflito de Diária Dobrada';
//                 msgCustom = `A data <b>${dataFormatadaBR}</b> já está prevista, mas você está solicitando uma <b>Diária Dobrada</b> que excede o planejado para este dia.`;
//             }

//             const result = await Swal.fire({
//                 icon: 'warning',
//                 title: tituloCustom,
//                 html: `${msgCustom}<br><br>Como deseja prosseguir?`,
//                 showCancelButton: true,
//                 showDenyButton: true,
//                 confirmButtonText: 'Solicitar Aditivo',
//                 denyButtonText: 'Extra Bonificado',
//                 cancelButtonText: 'Cancelar',
//                 footer: '<button id="btnProsseguirSemData" class="swal2-confirm swal2-styled" style="background-color: #6e7881;">Prosseguir sem solicitação</button>',
//                 didOpen: () => {
//                     const btn = document.getElementById('btnProsseguirSemData');
//                     if(btn) {
//                         btn.onclick = () => {
//                             window.tipoExcecaoAtual = null;
//                             Swal.clickConfirm(); 
//                         };
//                     }
//                 }
//             });


//             if (result.isConfirmed || result.isDenied) {
//                 if (window.tipoExcecaoAtual === null) return { allowed: true }; // Veio pelo footer

//                 const tipoEscolhido = `${result.isConfirmed ? 'Aditivo' : 'Extra Bonificado'} - Datas fora do Orçamento`;
//                 const dadosExcecao = await solicitarDadosExcecao(tipoEscolhido, dadosOrcamento?.idorcamento || 0, nmFuncao, criterios.idfuncao, idFuncionario, dataUnicaParaBanco);

//                 if (dadosExcecao?.confirmado) {
//                     window.tipoExcecaoAtual = tipoEscolhido;
//                     window.justificativaParaSalvar = dadosExcecao.justificativa;
//                     window.bSalvarComoInativo = true;
//                     return { allowed: false, solicitouAutorizacao: true, justificativa: dadosExcecao.justificativa, tipoSolicitacao: tipoEscolhido };
//                 }
//                 return { allowed: false };
//             }
//             return { allowed: false };
//         }
//     }

//     // --- SEÇÃO 3: CONTAGEM DE VAGAS ---
// //     if (dadosOrcamento) {
// //         let vagasOcupadasNaTabela = 0;
// //         document.querySelectorAll('#eventsTableBody tr').forEach(linha => {
// //             try {
// //                 const data = JSON.parse(linha.dataset.eventData);
// //                 if (data.nmfuncao?.trim().toUpperCase() === nmFuncao && data.statusstaff !== 'Inativo') {
// //                     vagasOcupadasNaTabela++;
// //                     if (data.datadiariadobrada) {
// //                         const dobras = typeof data.datadiariadobrada === 'string' ? JSON.parse(data.datadiariadobrada) : data.datadiariadobrada;
// //                         if (Array.isArray(dobras)) vagasOcupadasNaTabela += dobras.length;
// //                     }
// //                 }
// //             } catch (e) {}
// //         });

// //         const limiteTotal = Number(dadosOrcamento.quantidade_orcada || 0);
// //         const totalJaEscalado = Number(dadosOrcamento.diarias_escaladas || 0);
// //        // const impactoDestaAcao = datasSelecionadas.length + (datasEventoDobradas ? datasEventoDobradas.length : 0);
// //        // const totalGeralDesejado = totalJaEscalado + vagasOcupadasNaTabela + impactoDestaAcao;

// // // =========================================================================
// //         // 👇 AQUI ENTROU SEU NOVO BLOCO DO CÁLCULO DE IMPACTO INTELIGENTE
// //         // =========================================================================
// //         let countDiariasNormais = datasSelecionadas.length;
// //         let countDobras = datasEventoDobradas.length;
// //         let impactoDestaAcao = 0;

// //         // Se for PUT (criterios.idStaff ou currentEditingStaffEvent preenchido)
// //         const isPUT = criterios.idStaff || currentEditingStaffEvent?.idstaff;

// //         if (isPUT) {
// //             // 🔍 LÓGICA DO PUT:
// //             const datasJaSalvasNoBanco = currentEditingStaffEvent?.datasevento || [];
            
// //             // O total teórico inicial é a soma do que está na tela (normais + dobras)
// //             impactoDestaAcao = countDiariasNormais + countDobras; 
            
// //             // Se as diárias normais já existiam e estão computadas no banco, subtraímos para restar apenas o saldo/a dobra nova
// //             if (datasJaSalvasNoBanco.length > 0) {
// //                 impactoDestaAcao = impactoDestaAcao - datasJaSalvasNoBanco.length;
// //             }
// //         } else {
// //             // 🔍 LÓGICA DO POST:
// //             impactoDestaAcao = countDiariasNormais + countDobras;
// //         }

// //         console.log(`📊 [Cálculo de Impacto] Modo: ${isPUT ? 'PUT' : 'POST'} | Normais: ${countDiariasNormais} | Dobras: ${countDobras} | Impacto Final calculado: ${impactoDestaAcao}`);
// //         // =========================================================================

// //         const totalGeralDesejado = totalJaEscalado + vagasOcupadasNaTabela + impactoDestaAcao;

// //         console.log("DEBUG VAGAS:", {
// //             limiteTotal,
// //             totalJaEscalado,
// //             vagasOcupadasNaTabela,
// //             impactoDestaAcao,
// //             totalGeralDesejado
// //         });

// //         if (totalGeralDesejado > limiteTotal) {
// //             const saldo = limiteTotal - (totalJaEscalado + vagasOcupadasNaTabela);
// //             const temVagaEmOutroDia = saldo > 0;
// //             const diasDobraBR = formatarDatas(datasEventoDobradas);

// //             let msg = `O limite de vagas para <b>${nmFuncao}</b> foi atingido.<br><br>`;
// //             if (temVagaEmOutroDia) {
// //                 msg += `Você solicita <b>${impactoDestaAcao} diárias</b> (incluindo dobras de ${diasDobraBR}).<br>O orçamento tem apenas <b>${saldo} vaga(s)</b> disponível(is).<br><br>Deseja reaproveitar vaga de outro dia ou solicitar nova verba?`;
// //             } else {
// //                 msg += `Não há mais vagas disponíveis em nenhum período deste orçamento.`;
// //             }

// //             const resultVaga = await Swal.fire({
// //                 icon: 'warning',
// //                 title: 'Limite de Diárias Excedido',
// //                 html: msg,
// //                 showCancelButton: true,
// //                 showDenyButton: true,
// //                 confirmButtonText: temVagaEmOutroDia ? 'Usar Vaga Disponível' : 'Solicitar Aditivo',
// //                 denyButtonText: 'Extra Bonificado',
// //                 cancelButtonText: 'Cancelar'
// //             });

// //             if (resultVaga.isConfirmed && temVagaEmOutroDia) {
// //                 window.tipoExcecaoAtual = "Vaga Reaproveitada";
// //                 return { allowed: true };
// //             } else if (resultVaga.isConfirmed || resultVaga.isDenied) {
// //                 const tipoVaga = `${resultVaga.isConfirmed ? 'Aditivo' : 'Extra Bonificado'} - Vaga Excedida`;
// //                 const dadosExcecao = await solicitarDadosExcecao(tipoVaga, dadosOrcamento.idOrcamento, nmFuncao, criterios.idFuncao, idFuncionario, dataUnicaParaBanco);
                
// //                 if (dadosExcecao?.confirmado) {
// //                     window.tipoExcecaoAtual = tipoVaga;
// //                     window.justificativaParaSalvar = dadosExcecao.justificativa;
// //                     window.bSalvarComoInativo = true;
// //                     return { allowed: false, solicitouAutorizacao: true, justificativa: dadosExcecao.justificativa, tipoSolicitacao: tipoVaga };
// //                 }
// //             }
// //             return { allowed: false };
// //         }
// //     }


// // =========================================================================
// // --- SEÇÃO 3: CONTAGEM DE VAGAS INTEGRADA COM ITENS DE ORÇAMENTO ---
// // =========================================================================
//     if (dadosOrcamento) {
//         let vagasOcupadasNaTabela = 0;
//         let dobrasNoMesmoDiaAtual = 0;

//         const setorAtual = (criterios.setor || currentEditingStaffEvent?.setor || '').trim().toUpperCase();
//         const diasSelecionadosTexto = datasSelecionadas.map(d => String(d).substring(0, 10));

//         const normalizarTextoGeral = (txt) => {
//             return String(txt || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
//         };

//         const setorAtualNormalizado = normalizarTextoGeral(setorAtual);
//         const nmFuncaoNormalizada = normalizarTextoGeral(nmFuncao);        
       

//         document.querySelectorAll('#eventsTableBody tr').forEach(linha => {
//             try {
//                 const data = JSON.parse(linha.dataset.eventData);
//                 if (data.nmfuncao?.trim().toUpperCase() === nmFuncao && data.statusstaff !== 'Inativo') {
//                     vagasOcupadasNaTabela++;
                    
//                     const datasDoStaff = Array.isArray(data.datasevento) ? data.datasevento : JSON.parse(data.datasevento || '[]');
//                     const setorStaff = (data.setor || '').trim().toUpperCase();

//                     datasDoStaff.forEach(dt => {
//                         const formatoDt = String(dt).substring(0, 10);
//                         if (diasSelecionadosTexto.includes(formatoDt) && setorStaff === setorAtual) {
//                             dobrasNoMesmoDiaAtual++;
//                         }
//                     });
//                 }
//             } catch (e) {}
//         });

//         const limiteTotal = Number(dadosOrcamento.quantidade_orcada || 0);
//         const totalJaEscalado = Number(dadosOrcamento.diarias_escaladas || 0);

//         let countDiariasNormais = datasSelecionadas.length;
//         let countDobras = datasEventoDobradas.length;
//         let impactoDestaAcao = 0;

//         const isPUT = criterios.idStaff || currentEditingStaffEvent?.idstaff;
        
//         if (isPUT) {
//             const datasJaSalvasNoBanco = currentEditingStaffEvent?.datasevento || [];
//             impactoDestaAcao = countDiariasNormais + countDobras; 
//             if (datasJaSalvasNoBanco.length > 0) {
//                 impactoDestaAcao = impactoDestaAcao - datasJaSalvasNoBanco.length;
//             }
//         } else {
//             impactoDestaAcao = countDiariasNormais + countDobras;
//         }

//         const totalGeralDesejado = totalJaEscalado + vagasOcupadasNaTabela + impactoDestaAcao;
//         // 🔥 Define de forma precisa se a ação atual envolve diária dobrada
//         const ehDiariaDobrada = (countDobras > 0 || criterios.isDiariaDobrada === true || (typeof isDiariaDobrada !== 'undefined' && isDiariaDobrada === true));

//         // =========================================================================
//         // 🎯 CÁLCULO DE ESTOURO DO SETOR ATUAL
//         // =========================================================================
//         let estourouDiaSpecifico = false;
//         let limiteDoSetorAtual = 0;

//         const itensDoContrato = dadosOrcamento.itensOrcamentoDetail || [];

//         if (itensDoContrato.length > 0) {
//             const itemSetorBanco = itensDoContrato.find(item => {
//                 const sBanco = normalizarTextoGeral(item.setor);
//                 const fBanco = normalizarTextoGeral(item.nmfuncao || item.funcao);
//                 return sBanco === setorAtualNormalizado;
//             });
//             if (itemSetorBanco) {
//                 limiteDoSetorAtual = Number(itemSetorBanco.quantidade_orcada || 0);
//             }
//         }

//         let consumidoNoSetorAtual = 0;
//         document.querySelectorAll('#eventsTableBody tr').forEach(linha => {
//             try {
//                 const sData = JSON.parse(linha.dataset.eventData);
//                 if (normalizarTextoGeral(sData.nmfuncao) === nmFuncaoNormalizada && sData.statusstaff !== 'Inativo') {
//                     const setorStaff = normalizarTextoGeral(sData.setor);
//                     if (setorStaff === setorAtualNormalizado) {
//                         const dts = Array.isArray(sData.datasevento) ? sData.datasevento : JSON.parse(sData.datasevento || '[]');
//                         consumidoNoSetorAtual += dts.length;
//                     }
//                 }
//             } catch(e){}
//         });

//         if (isPUT && currentEditingStaffEvent) {
//             const meuSetorAntigo = normalizarTextoGeral(currentEditingStaffEvent.setor);
//             const minhaFuncaoAntiga = normalizarTextoGeral(currentEditingStaffEvent.nmfuncao);
//             if (meuSetorAntigo === setorAtualNormalizado && minhaFuncaoAntiga === nmFuncaoNormalizada) {
//                 const dtsAntigas = currentEditingStaffEvent.datasevento || [];
//                 consumidoNoSetorAtual -= dtsAntigas.length;
//             }
//         }

//         const desejadoNoSetor = consumidoNoSetorAtual + impactoDestaAcao;

//         if (totalGeralDesejado > limiteTotal || desejadoNoSetor > limiteDoSetorAtual) {
//             estourouDiaSpecifico = true;
//         }

//         // =========================================================================
//         // 🧮 MAPEAMENTO DE TODAS AS VAGAS COM SALDO NO ORÇAMENTO
//         // =========================================================================
//         let opcoesVagasValidas = [];

//         if (itensDoContrato.length > 0) {
//             itensDoContrato.forEach(item => {
//                 const itemFuncaoContrato = normalizarTextoGeral(item.nmfuncao || item.funcao || nmFuncao);
//                 const itemSetorContrato = normalizarTextoGeral(item.setor);

//                 let consumidoOutro = 0;
//                 document.querySelectorAll('#eventsTableBody tr').forEach(linha => {
//                     try {
//                         const sData = JSON.parse(linha.dataset.eventData);
//                         if (sData.statusstaff !== 'Inativo') {
//                             const funcStaff = normalizarTextoGeral(sData.nmfuncao);
//                             const setorStaff = normalizarTextoGeral(sData.setor);
//                             if (funcStaff === itemFuncaoContrato && setorStaff === itemSetorContrato) {
//                                 const dts = Array.isArray(sData.datasevento) ? sData.datasevento : JSON.parse(sData.datasevento || '[]');
//                                 consumidoOutro += dts.length;
//                             }
//                         }
//                     } catch(e){}
//                 });

//                 if (isPUT && currentEditingStaffEvent) {
//                     const meuSetorAntigo = normalizarTextoGeral(currentEditingStaffEvent.setor);
//                     const minhaFuncaoAntiga = normalizarTextoGeral(currentEditingStaffEvent.nmfuncao);
//                     if (meuSetorAntigo === itemSetorContrato && minhaFuncaoAntiga === itemFuncaoContrato) {
//                         const dtsAntigas = currentEditingStaffEvent.datasevento || [];
//                         consumidoOutro -= dtsAntigas.length;
//                     }
//                 }

//                 let saldoItem = Number(item.quantidade_orcada || 0) - consumidoOutro;
//                 if (saldoItem > 0) {
//                     opcoesVagasValidas.push({
//                         funcao: item.nmfuncao || item.funcao || nmFuncao,
//                         setor: item.setor,
//                         saldo: saldoItem
//                     });
//                 }
//             });
//         }

//         // =========================================================================
//         // 💬 DISPARO DOS MODAIS DE LIMITE EXCEDIDO
//         // =========================================================================
//         if (estourouDiaSpecifico) {
//             const dataSolicitadaBR = formatarDatas(datasSelecionadas);

//             // if (ehDiariaDobrada) {
//             //     // =========================================================================
//             //     // 🔥 FLUXO A: DIÁRIA DOBRADA EXCEDIDA (Muda para Aditivo/Extra Vaga Excedida)
//             //     // =========================================================================
//             //     let htmlDobrada = `O setor <b>"${setorAtual}"</b> não possui saldo de vagas para esta <b>Diária Dobrada (Virada de Turno)</b> no dia <b>${dataSolicitadaBR}</b>.<br><br>`;
                
//             //     if (opcoesVagasValidas.length > 0) {
//             //         htmlDobrada += `<p style="font-size: 13px; color: #444; margin-bottom: 8px; font-weight: 500;">Selecione qual vaga disponível do orçamento deseja reaproveitar para cobrir esta virada:</p>`;
//             //         htmlDobrada += `<select id="selectVagaDobra" style="width: 100%; height: 42px; border-radius: 4px; border: 1px solid #ccc; padding: 5px 10px; font-size: 14px; background-color: #fff; font-weight: bold; color: #333;">`;
//             //         opcoesVagasValidas.forEach((vaga, idx) => {
//             //             htmlDobrada += `<option value="${idx}">[${vaga.funcao}] - ${vaga.setor} (Saldo: ${vaga.saldo})</option>`;
//             //         });
//             //         htmlDobrada += `</select><br><br>`;
//             //     } else {
//             //         htmlDobrada += `<span style="color: #dc3545; font-weight: 500;">⚠️ Nenhuma outra vaga possui saldo livre no orçamento para remanejamento.</span><br><br>`;
//             //     }
//             //     htmlDobrada += `Como deseja prosseguir com o estouro da virada?`;

//             //     const resultDobra = await Swal.fire({
//             //         icon: 'warning',
//             //         title: 'Limite Excedido na Diária Dobrada',
//             //         html: htmlDobrada,
//             //         showCancelButton: true,
//             //         showDenyButton: true,
//             //         confirmButtonText: 'Solicitar Aditivo',
//             //         confirmButtonColor: '#5f1420',
//             //         denyButtonText: 'Extra Bonificado',
//             //         denyButtonColor: '#dc3545',
//             //         cancelButtonText: 'Cancelar',
//             //         cancelButtonColor: '#6c757d',
//             //         footer: opcoesVagasValidas.length > 0 ? `
//             //             <button id="btnProsseguirVagaDobra" style="display:inline-flex; background-color: #28a745 !important; color: #ffffff !important; border: 0; box-shadow: none; margin: 8px 0 0 0; padding: 12px 24px; font-size: 14px; font-weight: 500; border-radius: 4px; cursor: pointer; height: 46px; width: 100%; align-items: center; justify-content: center;">
//             //                 Prosseguir reaproveitando vaga selecionada
//             //             </button>
//             //         ` : '',
//             //         didOpen: () => {
//             //             const actionsContainer = document.querySelector('.swal2-actions');
//             //             const btnConfirm = document.querySelector('.swal2-confirm');
//             //             const btnDeny = document.querySelector('.swal2-deny');
//             //             const btnCancel = document.querySelector('.swal2-cancel');
//             //             const btnProsseguir = document.getElementById('btnProsseguirVagaDobra');

//             //             if (actionsContainer && btnConfirm && btnDeny && btnCancel) {
//             //                 actionsContainer.style.setProperty('display', 'flex', 'important');
//             //                 actionsContainer.style.setProperty('flex-wrap', 'wrap', 'important');
//             //                 actionsContainer.style.setProperty('justify-content', 'center', 'important');
//             //                 actionsContainer.style.setProperty('gap', '8px', 'important');

//             //                 [btnConfirm, btnDeny, btnCancel].forEach(btn => {
//             //                     btn.style.setProperty('margin', '0', 'important');
//             //                     btn.style.setProperty('padding', '10px 16px', 'important');
//             //                     btn.style.setProperty('height', '44px', 'important');
//             //                     btn.style.setProperty('border-radius', '4px', 'important');
//             //                     btn.style.setProperty('flex', '1 1 auto', 'important');
//             //                 });

//             //                 if (btnProsseguir) {
//             //                     actionsContainer.appendChild(btnProsseguir);
//             //                     btnProsseguir.onclick = () => {
//             //                         const selectEl = document.getElementById('selectVagaDobra');
//             //                         if (selectEl) {
//             //                             const vagaEscolhida = opcoesVagasValidas[selectEl.value];
//             //                             window.justificativaParaSalvar = `[Diária Dobrada] Consumiu vaga da função "${vagaEscolhida.funcao}" do setor "${vagaEscolhida.setor}" para cobrir virada em "${setorAtual}".`;
//             //                         }
//             //                         window.tipoExcecaoAtual = "Vaga Reaproveitada";
//             //                         Swal.clickConfirm(); 
//             //                     };
//             //                 }
//             //             }
//             //         }
//             //     });

//             //     if (resultDobra.isConfirmed && window.tipoExcecaoAtual === "Vaga Reaproveitada") {
//             //         return { allowed: true, obs: window.justificativaParaSalvar };
//             //     }
//             //     else if (resultDobra.isConfirmed) {
//             //         Swal.close();
//             //         const tipoVaga = 'Aditivo - Vaga Excedida';
//             //         const dadosExcecao = await solicitarDadosExcecao(tipoVaga, dadosOrcamento.idorcamento || dadosOrcamento.idOrcamento, nmFuncao, criterios.idFuncao, idFuncionario, dataUnicaParaBanco);
//             //         if (dadosExcecao?.confirmado) {
//             //             window.tipoExcecaoAtual = tipoVaga;
//             //             window.justificativaParaSalvar = dadosExcecao.justificativa;
//             //             window.bSalvarComoInativo = true;
//             //             return { allowed: false, solicitouAutorizacao: true, justificativa: dadosExcecao.justificativa, tipoSolicitacao: tipoVaga };
//             //         }
//             //     }
//             //     else if (resultDobra.isDenied) {
//             //         const tipoVaga = 'Extra Bonificado - Vaga Excedida';
//             //         const dadosExcecao = await solicitarDadosExcecao(tipoVaga, dadosOrcamento.idorcamento || dadosOrcamento.idOrcamento, nmFuncao, criterios.idFuncao, idFuncionario, dataUnicaParaBanco);
//             //         if (dadosExcecao?.confirmado) {
//             //             window.tipoExcecaoAtual = tipoVaga;
//             //             window.justificativaParaSalvar = dadosExcecao.justificativa;
//             //             window.bSalvarComoInativo = true;
//             //             return { allowed: false, solicitouAutorizacao: true, justificativa: dadosExcecao.justificativa, tipoSolicitacao: tipoVaga };
//             //         }
//             //     }
//             //     return { allowed: false };

//             // } else {
//                 // =========================================================================
//                 // 🛑 FLUXO B: CENÁRIO GERAL (DIÁRIA COMUM EXCEDIDA)
//                 // =========================================================================
//                 let msg = `Não há vaga disponível no dia <b>${dataSolicitadaBR}</b> para o setor <b>"${setorAtual}"</b> na função <b>[${nmFuncao}]</b>.<br><br>`;
                
//                 if (opcoesVagasValidas.length > 0) {
//                     msg += `<p style="font-size: 13px; color: #444; margin-bottom: 8px; font-weight: 500;"><b>Vagas com saldo encontradas no orçamento:</b></p>`;
//                     msg += `<select id="selectVagaComum" style="width: 100%; height: 42px; border-radius: 4px; border: 1px solid #ccc; padding: 5px 10px; font-size: 14px; background-color: #fff; font-weight: bold; color: #333;">`;
//                     opcoesVagasValidas.forEach((vaga, idx) => {
//                         msg += `<option value="${idx}">[${vaga.funcao}] - ${vaga.setor} (Saldo: ${vaga.saldo})</option>`;
//                     });
//                     msg += `</select><br><br>`;
//                 } else {
//                     msg += `<span style="color: #dc3545; font-weight: 500;">⚠️ O orçamento geral está totalmente esgotado em todos os setores/funções.</span><br><br>`;
//                 }
//                 msg += `Como deseja prosseguir?`;

//                 const resultVaga = await Swal.fire({
//                     icon: 'warning',
//                     title: 'Limite de Diárias Excedido para este Período',
//                     html: msg,
//                     showCancelButton: true,
//                     showDenyButton: true,
//                     confirmButtonText: 'Solicitar Aditivo',
//                     confirmButtonColor: '#5f1420',
//                     denyButtonText: 'Extra Bonificado',
//                     denyButtonColor: '#dc3545',
//                     cancelButtonText: 'Cancelar',
//                     cancelButtonColor: '#6c757d',
//                     footer: opcoesVagasValidas.length > 0 ? `
//                         <button id="btnCustomProsseguirVerde" style="display:inline-flex; background-color: #28a745 !important; color: #ffffff !important; border: 0; box-shadow: none; margin: 8px 0 0 0; padding: 12px 24px; font-size: 14px; font-weight: 500; border-radius: 4px; cursor: pointer; height: 46px; width: 100%; align-items: center; justify-content: center;">
//                             Prosseguir usando vaga selecionada
//                         </button>
//                     ` : '',
//                     didOpen: () => {
//                         const actionsContainer = document.querySelector('.swal2-actions');
//                         const btnConfirm = document.querySelector('.swal2-confirm');
//                         const btnDeny = document.querySelector('.swal2-deny');
//                         const btnCancel = document.querySelector('.swal2-cancel');
//                         const btnProsseguir = document.getElementById('btnCustomProsseguirVerde');

//                         if (actionsContainer && btnConfirm && btnDeny && btnCancel) {
//                             actionsContainer.style.setProperty('display', 'flex', 'important');
//                             actionsContainer.style.setProperty('flex-wrap', 'wrap', 'important');
//                             actionsContainer.style.setProperty('justify-content', 'center', 'important');
//                             actionsContainer.style.setProperty('gap', '8px', 'important');

//                             [btnConfirm, btnDeny, btnCancel].forEach(btn => {
//                                 btn.style.setProperty('margin', '0', 'important');
//                                 btn.style.setProperty('padding', '10px 16px', 'important');
//                                 btn.style.setProperty('height', '44px', 'important');
//                                 btn.style.setProperty('border-radius', '4px', 'important');
//                                 btn.style.setProperty('flex', '1 1 auto', 'important');
//                             });

//                             if (btnProsseguir) {
//                                 actionsContainer.appendChild(btnProsseguir);
//                                 btnProsseguir.onclick = () => {
//                                     const selectEl = document.getElementById('selectVagaComum');
//                                     if (selectEl) {
//                                         const vagaEscolhida = opcoesVagasValidas[selectEl.value];
//                                         window.justificativaParaSalvar = `Reaproveitou saldo da vaga "[${vagaEscolhida.funcao}] - ${vagaEscolhida.setor}" para cobrir lançamento no setor "${setorAtual}".`;
//                                     }
//                                     window.tipoExcecaoAtual = "Vaga Reaproveitada";
//                                     Swal.clickConfirm(); 
//                                 };
//                             }
//                         }
//                     }
//                 });

//                 if (resultVaga.isConfirmed && window.tipoExcecaoAtual === "Vaga Reaproveitada") {
//                     return { allowed: true, obs: window.justificativaParaSalvar };
//                 }
//                 else if (resultVaga.isConfirmed) {
//                     Swal.close();
//                     const tipoVaga = 'Aditivo - Vaga Excedida';
//                     const dadosExcecao = await solicitarDadosExcecao(tipoVaga, dadosOrcamento.idorcamento || dadosOrcamento.idOrcamento, nmFuncao, criterios.idFuncao, idFuncionario, dataUnicaParaBanco);
//                     if (dadosExcecao?.confirmado) {
//                         window.tipoExcecaoAtual = tipoVaga;
//                         window.justificativaParaSalvar = dadosExcecao.justificativa;
//                         window.bSalvarComoInativo = true;
//                         return { allowed: false, solicitouAutorizacao: true, justificativa: dadosExcecao.justificativa, tipoSolicitacao: tipoVaga };
//                     }
//                 }
//                 else if (resultVaga.isDenied) {
//                     const tipoVaga = 'Extra Bonificado - Vaga Excedida';
//                     const dadosExcecao = await solicitarDadosExcecao(tipoVaga, dadosOrcamento.idorcamento || dadosOrcamento.idOrcamento, nmFuncao, criterios.idFuncao, idFuncionario, dataUnicaParaBanco);
//                     if (dadosExcecao?.confirmado) {
//                         window.tipoExcecaoAtual = tipoVaga;
//                         window.justificativaParaSalvar = dadosExcecao.justificativa;
//                         window.bSalvarComoInativo = true;
//                         return { allowed: false, solicitouAutorizacao: true, justificativa: dadosExcecao.justificativa, tipoSolicitacao: tipoVaga };
//                     }
//                 }
//                 return { allowed: false };
//            // }
//         }
//     }
//     return { allowed: true }; // Se passou por tudo, permite salvar
// }

// async function verificarLimiteDeFuncao(criterios, dadosErroBackend = null) {
//     console.log("Iniciando verificação de limite de função", criterios);

//     // 1. Tratamento seguro de nomes e fallbacks de critérios textuais
//     let nmEvento = (criterios.nmEvento || criterios.nmevento || '').trim().toUpperCase();
//     let nmFuncao = (criterios.nmFuncao || criterios.nmfuncao || criterios.descfuncao || '').trim().toUpperCase();
    
//     const idFuncionario = criterios.idFuncionario || criterios.idfuncionario || document.getElementById('idFuncionario')?.value || null;
//     const selectFunc = document.getElementById('nmFuncionario');       
//     const nmFuncionario = criterios.nmFuncionario || criterios.nmfuncionario || selectFunc?.options[selectFunc.selectedIndex]?.text;
//     const datasEventoDobradas = criterios.datasEventoDobradas || criterios.dataseventodobradas || [];

//     // Coleta de datas de forma robusta
//     const campoData = document.getElementById('periodoEvento') || document.getElementById('datasEvento'); 
//     // ==========================================================
//     // 1. Coleta de datas de forma robusta (SUBSTITUÍDO AQUI)
//     // ==========================================================
//     let datasSelecionadas = [];

//     if (criterios.datasEvento && Array.isArray(criterios.datasEvento) && criterios.datasEvento.length > 0) {
//         datasSelecionadas = criterios.datasEvento;
//     } else if (criterios.datasevento && Array.isArray(criterios.datasevento) && criterios.datasevento.length > 0) {
//         datasSelecionadas = criterios.datasevento;
//     } else {
//         // Fallback: Se não veio por array, tenta capturar diretamente do valor do input de texto da tela
//         const campoData = document.getElementById('periodoEvento') || document.getElementById('datasEvento');
//         if (campoData && campoData.value) {
//             // Divide a string por vírgula, remove espaços e filtra entradas vazias
//             datasSelecionadas = campoData.value.split(',')
//                 .map(d => d.trim())
//                 .filter(d => d.length > 0);
//         } else if (campoData && campoData._flatpickr && campoData._flatpickr.selectedDates.length > 0) {
//             datasSelecionadas = campoData._flatpickr.selectedDates.map(d => d.toLocaleDateString('en-CA'));
//         }
//     }

//     // Garante que todas as datas na memória estão normalizadas apenas com os 10 primeiros caracteres (YYYY-MM-DD)
//     datasSelecionadas = datasSelecionadas.map(d => String(d).substring(0, 10));

//     const dataUnicaParaBanco = datasSelecionadas[0] || null;

//     // Garante a leitura segura das dobras para não gerar erro de undefined
//     let arrayDobras = criterios.datasEventoDobradas || (typeof datasEventoDobradas !== 'undefined' ? datasEventoDobradas : []);
//     let countDobras = Array.isArray(arrayDobras) ? arrayDobras.length : 0;
//     let ehDiariaDobrada = (countDobras > 0 || criterios.isDiariaDobrada === true || (typeof isDiariaDobrada !== 'undefined' && isDiariaDobrada === true));
    
//     if (ehDiariaDobrada) {
//         console.log("🔄 [verificarLimiteDeFuncao] É Diária Dobrada detectada no início. Ignorando Seção 2 e Seção 3 para seguir ao fluxo sequencial.");
//         return { allowed: true }; 
//     }

//     // Inicializa o objeto de memória caso não exista
//     if (typeof orcamentoPorFuncao === 'undefined' || !orcamentoPorFuncao) {
//         window.orcamentoPorFuncao = {}; 
//     }

//     // 2. Tenta gerar a chave primária tradicional
//     let chaveSimples = [nmEvento, nmFuncao].filter(p => p).join('-');
//     let dadosOrcamento = window.orcamentoPorFuncao ? window.orcamentoPorFuncao[chaveSimples] : undefined;

//     const idFuncaoProcurado = criterios.idFuncao || criterios.idfuncao;

//     // 🎯 [VARREDURA AGRESSIVA] Se não achou pela chave string, força localização por ID ignorando caixa alta/baixa
//     if (!dadosOrcamento && window.orcamentoPorFuncao && idFuncaoProcurado) {
//         dadosOrcamento = Object.values(window.orcamentoPorFuncao).find(o => {
//             if (!o) return false;
//             return String(o.idfuncao) === String(idFuncaoProcurado) || 
//                    String(o.idFuncao) === String(idFuncaoProcurado) ||
//                    String(o.id_funcao) === String(idFuncaoProcurado);
//         });
        
//         if (dadosOrcamento) {
//             nmEvento = (dadosOrcamento.nmevento || '').trim().toUpperCase();
//             nmFuncao = (dadosOrcamento.descfuncao || dadosOrcamento.nmfuncao || '').trim().toUpperCase();
//             chaveSimples = `${nmEvento}-${nmFuncao}`;
//             console.log(`💡 [verificarLimiteDeFuncao] Cache localizado via ID da Função: [${chaveSimples}]`);
//         }
//     }

//     console.log("DADOS BRUTOS NO INÍCIO:", dadosOrcamento);

//     // 3. Se ainda assim não encontrar, força recarga na API e captura o retorno direto da Promessa
//     if (!dadosOrcamento || (!dadosOrcamento.quantidade_orcada && !dadosOrcamento.quantidadeOrcada)) {
//         console.warn(`⚠️ [verificarLimiteDeFuncao] Cache inválido ou incompleto para '${chaveSimples}'. Forçando busca no banco de dados...`);
        
//         const idClienteDefinido = criterios.idCliente 
//             || criterios.idcliente
//             || document.getElementById('nmCliente')?.value 
//             || (typeof currentEditingStaffEvent !== 'undefined' ? currentEditingStaffEvent?.idcliente : null)
//             || window.idClienteAtual 
//             || null;

//         console.log(`📡 [verificarLimiteDeFuncao] Recarregando orçamento com idCliente resolvido: ${idClienteDefinido}`);

//         // Captura o retorno direto da função para caso o cache global sofro interferência externa
//         let retornoApi = await buscarEPopularOrcamento(
//             criterios.idEvento || criterios.idevento,
//             idClienteDefinido,
//             criterios.idLocalMontagem || criterios.idlocalmontagem, 
//             criterios.idFuncao || criterios.idfuncao,
//             datasSelecionadas,
//             false,
//             true
//         );
        
//         // Se a API retornou o objeto mas ele sumiu do cache global, usamos o retorno direto!
//         if (retornoApi) {
//             dadosOrcamento = Array.isArray(retornoApi) ? retornoApi[0] : retornoApi;
//         }

//         // Tenta sincronizar novamente os nomes textuais obtidos do banco
//         if (dadosOrcamento) {
//             nmEvento = (dadosOrcamento.nmevento || '').trim().toUpperCase();
//             nmFuncao = (dadosOrcamento.descfuncao || dadosOrcamento.nmfuncao || '').trim().toUpperCase();
//             chaveSimples = [nmEvento, nmFuncao].filter(p => p).join('-');
//         }
//     }

//     // 🛡️ [BLINDAGEM FINAL DO OBJETO] Se mesmo após a API ele for nulo, cria um fallback seguro para não travar em undefined
//     if (!dadosOrcamento) {
//         console.error("❌ Falha crítica: Orçamento não pôde ser recuperado nem via API.");
//         dadosOrcamento = {
//             quantidadeOrcada: 0,
//             quantidadeEscalada: 0,
//             datasOrcadas: []
//         };
//     }

//     // Normalização de propriedades para garantir compatibilidade com o restante do script
//     dadosOrcamento.quantidadeOrcada = dadosOrcamento.quantidade_orcada !== undefined ? dadosOrcamento.quantidade_orcada : (dadosOrcamento.quantidadeOrcada || 0);
//     dadosOrcamento.quantidadeEscalada = dadosOrcamento.quantidade_escalada !== undefined ? dadosOrcamento.quantidade_escalada : (dadosOrcamento.quantidadeEscalada || 0);
//     dadosOrcamento.datasOrcadas = dadosOrcamento.datas_totais_orcadas !== undefined ? dadosOrcamento.datas_totais_orcadas : (dadosOrcamento.datasOrcadas || []);

//     console.log("DEBUG dadosOrcamento:", {
//         objeto: dadosOrcamento,
//         quantidadeEscalada: dadosOrcamento.quantidadeEscalada,
//         quantidadeOrcada: dadosOrcamento.quantidadeOrcada,
//         datasOrcadas: dadosOrcamento.datasOrcadas,
//         chaveSimples: chaveSimples
//     });

//     // --- SEÇÃO 2: VERIFICAÇÃO DE DATAS ---
//     if (datasSelecionadas.length > 0) {
//         let ehExcecaoDeData = false;
//         let datasPermitidas = [];
//         const diasUnicosSolicitados = [...new Set(datasSelecionadas.map(d => String(d).trim().substring(0, 10)))];

//         if (dadosOrcamento && dadosOrcamento.datasOrcadas) {
//             datasPermitidas = (Array.isArray(dadosOrcamento.datasOrcadas) 
//                 ? dadosOrcamento.datasOrcadas 
//                 : [dadosOrcamento.datasOrcadas]).map(d => String(d).trim().substring(0, 10));

//             ehExcecaoDeData = diasUnicosSolicitados.some(dataSel => !datasPermitidas.includes(dataSel));
//         } else {
//             ehExcecaoDeData = true; 
//         }

//         if (ehExcecaoDeData) {
//             if (window.justificativaParaSalvar && window.tipoExcecaoAtual) {
//                 return { allowed: false, solicitouAutorizacao: true, justificativa: window.justificativaParaSalvar, tipoSolicitacao: window.tipoExcecaoAtual };
//             }

//             // --- NOVA LÓGICA DE MENSAGEM PERSONALIZADA ---
//             const temDobra = datasEventoDobradas.length > 0;
//             const dataFormatadaBR = formatarDatas(diasUnicosSolicitados);
            
//             const aDataExisteNoOrcamento = diasUnicosSolicitados.every(d => datasPermitidas.includes(d));

//             let tituloCustom = 'Data fora do Orçamento';
//             let msgCustom = `A data <b>${dataFormatadaBR}</b> não consta no orçamento aprovado.`;

//             console.log("DEBUG - Verificando tipo de exceção:", { aDataExisteNoOrcamento, temDobra });

//             if (aDataExisteNoOrcamento && temDobra) {
//                 tituloCustom = 'Conflito de Diária Dobrada';
//                 msgCustom = `A data <b>${dataFormatadaBR}</b> já está prevista, mas você está solicitando uma <b>Diária Dobrada</b> que excede o planejado para este dia.`;
//             }

//             const result = await Swal.fire({
//                 icon: 'warning',
//                 title: tituloCustom,
//                 html: `${msgCustom}<br><br>Como deseja prosseguir?`,
//                 showCancelButton: true,
//                 showDenyButton: true,
//                 confirmButtonText: 'Solicitar Aditivo',
//                 denyButtonText: 'Extra Bonificado',
//                 cancelButtonText: 'Cancelar',
//                 footer: '<button id="btnProsseguirSemData" class="swal2-confirm swal2-styled" style="background-color: #6e7881;">Prosseguir sem solicitação</button>',
//                 didOpen: () => {
//                     const btn = document.getElementById('btnProsseguirSemData');
//                     if(btn) {
//                         btn.onclick = () => {
//                             window.tipoExcecaoAtual = null;
//                             Swal.clickConfirm(); 
//                         };
//                     }
//                 }
//             });

//             if (result.isConfirmed || result.isDenied) {
//                 if (window.tipoExcecaoAtual === null) return { allowed: true }; // Veio pelo footer

//                 const tipoEscolhido = `${result.isConfirmed ? 'Aditivo' : 'Extra Bonificado'} - Datas fora do Orçamento`;
//                 const dadosExcecao = await solicitarDadosExcecao(tipoEscolhido, dadosOrcamento?.idorcamento || 0, nmFuncao, criterios.idfuncao, idFuncionario, dataUnicaParaBanco);

//                 if (dadosExcecao?.confirmado) {
//                     window.tipoExcecaoAtual = tipoEscolhido;
//                     window.justificativaParaSalvar = dadosExcecao.justificativa;
//                     window.bSalvarComoInativo = true;
//                     return { allowed: false, solicitouAutorizacao: true, justificativa: dadosExcecao.justificativa, tipoSolicitacao: tipoEscolhido };
//                 }
//                 return { allowed: false };
//             }
//             return { allowed: false };
//         }
//     }

//     // =========================================================================
//     // --- SEÇÃO 3: CONTAGEM DE VAGAS INTEGRADA (INDEPENDENTE DE SETOR) ---
//     // =========================================================================
//     if (dadosOrcamento) {
//         let vagasOcupadasNaTabela = 0;
//         const normalizarTextoGeral = (txt) => {
//             return String(txt || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
//         };
//         const nmFuncaoNormalizada = normalizarTextoGeral(nmFuncao);

//         // 1. Soma todas as diárias da mesma função que já estão mapeadas visualmente na tabela (na tela)
//         document.querySelectorAll('#eventsTableBody tr').forEach(linha => {
//             try {
//                 const data = JSON.parse(linha.dataset.eventData);
//                 if (normalizarTextoGeral(data.nmfuncao) === nmFuncaoNormalizada && data.statusstaff !== 'Inativo') {
//                     const datasDoStaff = Array.isArray(data.datasevento) ? data.datasevento : JSON.parse(data.datasevento || '[]');
//                     vagasOcupadasNaTabela += datasDoStaff.length;

//                     // Se a linha da tabela possuir diárias dobradas salvas visualmente, contabiliza-as também
//                     if (data.datadiariadobrada) {
//                         const dobras = typeof data.datadiariadobrada === 'string' ? JSON.parse(data.datadiariadobrada) : data.datadiariadobrada;
//                         if (Array.isArray(dobras)) {
//                             vagasOcupadasNaTabela += dobras.length;
//                         }
//                     }
//                 }
//             } catch (e) {
//                 console.error("Erro ao computar linha da tabela na Seção 3:", e);
//             }
//         });

//         // 2. Resgata limites totais da função vindos do orçamento (Banco de Dados)
//         // Mapeamento idêntico ao console.log enviado: quantidadeOrcada (22) e quantidadeEscalada (20)
//         const limiteTotal = Number(dadosOrcamento.quantidadeOrcada || dadosOrcamento.quantidade_orcada || 0);
//         const totalJaEscalado = Number(dadosOrcamento.quantidadeEscalada || dadosOrcamento.quantidade_escalada || dadosOrcamento.diarias_escaladas || 0);

//         let countDiariasNormais = datasSelecionadas.length;
//         let countDobras = datasEventoDobradas.length;
//         let impactoDestaAcao = 0;

//         const isPUT = criterios.idStaff || currentEditingStaffEvent?.idstaff;
        
//         // 3. Regra para deduzir diárias da linha anterior caso seja uma Edição (PUT)
//         if (isPUT) {
//             const datasJaSalvasNoBanco = currentEditingStaffEvent?.datasevento || [];
//             impactoDestaAcao = countDiariasNormais + countDobras; 
//             if (datasJaSalvasNoBanco.length > 0) {
//                 impactoDestaAcao = impactoDestaAcao - datasJaSalvasNoBanco.length;
//             }
//         } else {
//             impactoDestaAcao = countDiariasNormais + countDobras;
//         }

//         // 4. Calcula o total geral de diárias projetado
//         const totalGeralDesejado = totalJaEscalado + vagasOcupadasNaTabela + impactoDestaAcao;

//         console.log("📊 [Seção 3 Vagas] Verificação Global por Função (Independente de Setor):", {
//             funcao: nmFuncaoNormalizada,
//             limiteTotalOrcado: limiteTotal,
//             jaEscaladoNoBanco: totalJaEscalado,
//             vagasNaTabelaTela: vagasOcupadasNaTabela,
//             impactoDaAcaoAtual: impactoDestaAcao,
//             totalGeralProjetado: totalGeralDesejado
//         });

// // 5. Se estourar a quantidade de diárias permitidas para a função
//         if (totalGeralDesejado > limiteTotal) {
//             const dataSolicitadaBR = formatarDatas(datasSelecionadas);
//             const saldoDisponivel = limiteTotal - (totalJaEscalado + vagasOcupadasNaTabela);
//             const temSaldoRestante = saldoDisponivel > 0;

//             let msg = `O limite de vagas/diárias para a função <b>${nmFuncao}</b> foi atingido.<br><br>`;
//             if (temSaldoRestante) {
//                 msg += `Você está solicitando <b>${impactoDestaAcao} diárias</b> para o período [${dataSolicitadaBR}].<br>`;
//                 msg += `O orçamento geral da função possui apenas <b>${saldoDisponivel} diária(s)</b> disponível(is).<br><br>`;
//             } else {
//                 msg += `⚠️ O orçamento geral da função está totalmente esgotado (Limite: ${limiteTotal} diárias).<br><br>`;
//             }
//             msg += `Como deseja prosseguir?`;

//             const resultVaga = await Swal.fire({
//                 icon: 'warning',
//                 title: 'Limite de Diárias Excedido',
//                 html: msg,
//                 showCancelButton: true,
//                 showDenyButton: true,
//                 confirmButtonText: 'Solicitar Aditivo',
//                 confirmButtonColor: '#5f1420',
//                 denyButtonText: 'Extra Bonificado',
//                 denyButtonColor: '#dc3545',
//                 cancelButtonText: 'Cancelar',
//                 cancelButtonColor: '#6c757d'
//             });

//             // Se o usuário fechar no "X" ou clicar em Cancelar
//             if (resultVaga.isDismissed) {
//                 return { allowed: false, solicitouAutorizacao: false, preventDefault: true };
//             }

//             if (resultVaga.isConfirmed) {
//                 const tipoVaga = 'Aditivo - Vaga Excedida';
//                 const dadosExcecao = await solicitarDadosExcecao(tipoVaga, dadosOrcamento.idorcamento || dadosOrcamento.idOrcamento || 0, nmFuncao, criterios.idFuncao || criterios.idfuncao, idFuncionario, dataUnicaParaBanco);
//                 if (dadosExcecao?.confirmado) {
//                     window.tipoExcecaoAtual = tipoVaga;
//                     window.justificativaParaSalvar = dadosExcecao.justificativa;
//                     window.bSalvarComoInativo = true;
//                     return { allowed: false, solicitouAutorizacao: true, justificativa: dadosExcecao.justificativa, tipoSolicitacao: tipoVaga };
//                 }
//             }
//             else if (resultVaga.isDenied) {
//                 const tipoVaga = 'Extra Bonificado - Vaga Excedida';
//                 const dadosExcecao = await solicitarDadosExcecao(tipoVaga, dadosOrcamento.idorcamento || dadosOrcamento.idOrcamento || 0, nmFuncao, criterios.idFuncao || criterios.idfuncao, idFuncionario, dataUnicaParaBanco);
//                 if (dadosExcecao?.confirmado) {
//                     window.tipoExcecaoAtual = tipoVaga;
//                     window.justificativaParaSalvar = dadosExcecao.justificativa;
//                     window.bSalvarComoInativo = true;
//                     return { allowed: false, solicitouAutorizacao: true, justificativa: dadosExcecao.justificativa, tipoSolicitacao: tipoVaga };
//                 }
//             }
            
//             // Fallback se abriu a modal de dados de exceção mas não confirmou
//             return { allowed: false, solicitouAutorizacao: false };
//         }
//     }

//     // 🛡️ GARANTIA ABSOLUTA DE RETORNO CASO PASSE SEM ERROS
//     return { allowed: true, solicitouAutorizacao: false };
// }

// async function verificarLimiteDeFuncao(criterios, dadosErroBackend = null) {
//     console.log("Iniciando verificação de limite de função com critérios:", criterios, "e dados de erro do backend:", dadosErroBackend);

//     let nmEvento = (criterios.nmEvento || criterios.nmevento || '').trim().toUpperCase();
//     let nmFuncao = (criterios.nmFuncao || criterios.nmfuncao || '').trim().toUpperCase();
//     const idFuncionario = criterios.idFuncionario || document.getElementById('idFuncionario')?.value || null;
//     const selectFunc = document.getElementById('nmFuncionario');       
//     const nmFuncionario = criterios.nmFuncionario || selectFunc?.options[selectFunc.selectedIndex]?.text;

//     // ==========================================================
//     // 1. Coleta de datas de forma robusta e blindada
//     // ==========================================================
//     let datasSelecionadas = [];

//     if (criterios.datasEvento && Array.isArray(criterios.datasEvento) && criterios.datasEvento.length > 0) {
//         datasSelecionadas = criterios.datasEvento;
//     } else if (criterios.datasevento && Array.isArray(criterios.datasevento) && criterios.datasevento.length > 0) {
//         datasSelecionadas = criterios.datasevento;
//     } else {
//         const campoData = document.getElementById('periodoEvento') || document.getElementById('datasEvento');
//         if (campoData && campoData.value) {
//             datasSelecionadas = campoData.value.split(',')
//                 .map(d => d.trim())
//                 .filter(d => d.length > 0);
//         } else if (campoData && campoData._flatpickr && campoData._flatpickr.selectedDates.length > 0) {
//             datasSelecionadas = campoData._flatpickr.selectedDates.map(d => d.toLocaleDateString('en-CA'));
//         }
//     }

//     datasSelecionadas = datasSelecionadas.map(d => String(d).substring(0, 10));
//     console.log("Datas selecionadas para verificação:", datasSelecionadas);

//     const dataUnicaParaBanco = datasSelecionadas[0] || null;

//     // Garante a leitura segura das dobras para evitar quebra de código
//     let arrayDobras = criterios.datasEventoDobradas || (typeof datasEventoDobradas !== 'undefined' ? datasEventoDobradas : []);
//     let countDobras = Array.isArray(arrayDobras) ? arrayDobras.length : 0;
//     let ehDiariaDobrada = (countDobras > 0 || criterios.isDiariaDobrada === true || (typeof isDiariaDobrada !== 'undefined' && isDiariaDobrada === true));
    
//     if (ehDiariaDobrada) {
//         console.log("🔄 [verificarLimiteDeFuncao] É Diária Dobrada detectada no início. Ignorando validações para seguir fluxo sequencial.");
//         return { allowed: true }; 
//     }

//     if (typeof orcamentoPorFuncao === 'undefined' || !orcamentoPorFuncao) {
//         window.orcamentoPorFuncao = {}; 
//     }

//     // ==========================================================
//     // 2. Busca do Orçamento na Memória / Cache
//     // ==========================================================
//     let chaveSimples = [nmEvento, nmFuncao].filter(p => p).join('-');
//     let dadosOrcamento = window.orcamentoPorFuncao ? window.orcamentoPorFuncao[chaveSimples] : undefined;

//     const idFuncaoProcurado = criterios.idFuncao || criterios.idfuncao;

//     if (!dadosOrcamento && window.orcamentoPorFuncao) {
//         const todasAsChaves = Object.keys(window.orcamentoPorFuncao);
//         const chaveEncontrada = todasAsChaves.find(c => c.includes(nmEvento) && c.includes(nmFuncao));
//         if (chaveEncontrada) dadosOrcamento = window.orcamentoPorFuncao[chaveEncontrada];
//     }

//     if (!dadosOrcamento && window.orcamentoPorFuncao && idFuncaoProcurado) {
//         dadosOrcamento = Object.values(window.orcamentoPorFuncao).find(o => {
//             if (!o) return false;
//             return String(o.idfuncao) === String(idFuncaoProcurado) || 
//                    String(o.idFuncao) === String(idFuncaoProcurado) ||
//                    String(o.id_funcao) === String(idFuncaoProcurado);
//         });
        
//         if (dadosOrcamento) {
//             nmEvento = (dadosOrcamento.nmevento || '').trim().toUpperCase();
//             nmFuncao = (dadosOrcamento.descfuncao || dadosOrcamento.nmfuncao || '').trim().toUpperCase();
//             chaveSimples = `${nmEvento}-${nmFuncao}`;
//             console.log(`💡 [verificarLimiteDeFuncao] Cache localizado via ID da Função: [${chaveSimples}]`);
//         }
//     }

//     console.log("DADOS BRUTOS NO INÍCIO:", dadosOrcamento);

//     // 3. Se não encontrar ou estiver incompleto, força recarga via API
//     if (!dadosOrcamento || (!dadosOrcamento.quantidade_orcada && !dadosOrcamento.quantidadeOrcada)) {
//         console.warn(`⚠️ Cache incompleto para '${chaveSimples}'. Forçando busca no banco...`);
//         const idClienteDefinido = criterios.idCliente || criterios.idcliente || document.getElementById('nmCliente')?.value || null;

//         let retornoApi = await buscarEPopularOrcamento(
//             criterios.idEvento || criterios.idevento,
//             idClienteDefinido,
//             criterios.idLocalMontagem || criterios.idlocalmontagem, 
//             criterios.idFuncao || criterios.idfuncao,
//             datasSelecionadas,
//             false,
//             true
//         );
        
//         if (retornoApi) {
//             dadosOrcamento = Array.isArray(retornoApi) ? retornoApi[0] : retornoApi;
//         }

//         if (dadosOrcamento) {
//             nmEvento = (dadosOrcamento.nmevento || '').trim().toUpperCase();
//             nmFuncao = (dadosOrcamento.descfuncao || dadosOrcamento.nmfuncao || '').trim().toUpperCase();
//             chaveSimples = [nmEvento, nmFuncao].filter(p => p).join('-');
//         }
//     }

//     // Fallback de segurança para não quebrar objetos
//     if (!dadosOrcamento) {
//         dadosOrcamento = { quantidadeOrcada: 0, quantidadeEscalada: 0, datasOrcadas: [] };
//     }

//     // ==========================================================
//     // --- LÓGICA CRÍTICA 1: VERIFICAÇÃO DE DATAS OUT-OF-BUDGET ---
//     // ==========================================================
//     if (datasSelecionadas.length > 0) {
//         let ehExcecaoDeData = false;
//         let datasPermitidas = [];
//         const datasSelNormalizadas = [...new Set(datasSelecionadas.map(d => String(d).trim().substring(0, 10)))];

//         if (dadosOrcamento && dadosOrcamento.datasOrcadas) {
//             datasPermitidas = (Array.isArray(dadosOrcamento.datasOrcadas) 
//                 ? dadosOrcamento.datasOrcadas 
//                 : [dadosOrcamento.datasOrcadas]).map(d => String(d).trim().substring(0, 10));

//             console.log("DEBUG DATAS:", { solicitadas: datasSelNormalizadas, permitidas: datasPermitidas });
//             ehExcecaoDeData = datasSelNormalizadas.some(dataSel => !datasPermitidas.includes(dataSel));
//         } else {
//             ehExcecaoDeData = true; 
//         }

//         if (ehExcecaoDeData) {
//             if (window.justificativaParaSalvar && window.tipoExcecaoAtual) {
//                 return { 
//                     allowed: false, 
//                     solicitouAutorizacao: true, 
//                     justificativa: window.justificativaParaSalvar,
//                     tipoSolicitacao: window.tipoExcecaoAtual 
//                 };
//             }

//             // 📥 SWAL 1: Alerta preventivo (Info)
//             if (!dadosErroBackend && !window.estaSalvando) {
//                 const { isConfirmed } = await Swal.fire({
//                     icon: 'info',
//                     title: 'Período fora do planejado',
//                     html: `As datas <b>${datasSelNormalizadas.join(', ')}</b> não constam no orçamento aprovado.<br>Deseja prosseguir ou corrigir?`,
//                     showCancelButton: true,
//                     confirmButtonText: 'Prosseguir',
//                     cancelButtonText: 'Corrigir Datas',
//                     confirmButtonColor: '#28a745'
//                 });

//                 if (!isConfirmed) {
//                     return { allowed: false, preventDefault: true };
//                 }
//             }

//             // 📥 SWAL 2: Alerta de Envio (Warning com opções de Aditivo/Extra)
//             let decisaoManual = null;
//             const resultDatas = await Swal.fire({
//                 icon: 'warning',
//                 title: 'Data fora do Orçamento',
//                 html: `As datas selecionadas não constam no orçamento aprovado.<br>Como deseja prosseguir?`,
//                 showCancelButton: true,
//                 showDenyButton: true,
//                 confirmButtonText: 'Solicitar Aditivo',
//                 denyButtonText: 'Extra Bonificado',
//                 cancelButtonText: 'Cancelar',
//                 footer: '<button id="btnProsseguirSem" class="swal2-confirm swal2-styled" style="background-color: #6e7881;">Prosseguir sem solicitação</button>',
//                 didOpen: () => {
//                     const btnProsseguir = document.getElementById('btnProsseguirSem');
//                     if (btnProsseguir) {
//                         btnProsseguir.onclick = () => {
//                             decisaoManual = 'prosseguir';
//                             Swal.clickConfirm();
//                         };
//                     }
//                 }
//             });            

//             if ((resultDatas.isConfirmed || resultDatas.isDenied) && decisaoManual !== 'prosseguir') {
//                 const sufixo = resultDatas.isConfirmed ? 'Aditivo' : 'Extra Bonificado';
//                 const tipoEscolhido = `${sufixo} - Datas fora do Orçamento`;
                
//                 const dadosExcecao = await solicitarDadosExcecao(
//                     tipoEscolhido, 
//                     dadosOrcamento.idorcamento || dadosOrcamento.idOrcamento || 0, 
//                     nmFuncao, 
//                     idFuncaoProcurado, 
//                     idFuncionario, 
//                     dataUnicaParaBanco
//                 );

//                 if (dadosExcecao && dadosExcecao.confirmado) {
//                     window.tipoExcecaoAtual = tipoEscolhido;
//                     window.justificativaParaSalvar = dadosExcecao.justificativa;
//                     window.bSalvarComoInativo = true;
                    
//                     return { 
//                         allowed: false, 
//                         solicitouAutorizacao: true, 
//                         justificativa: dadosExcecao.justificativa, 
//                         tipoSolicitacao: tipoEscolhido 
//                     };
//                 }
//                 return { allowed: false };
//             } else if (decisaoManual === 'prosseguir') {
//                 window.bSalvarComoInativo = false;
//                 window.tipoExcecaoAtual = null;
//                 // Deixa vazar para avaliar a contagem de vagas abaixo
//             } else {
//                 return { allowed: false }; 
//             }
//         }
//     }

//     // ==========================================================
//     // --- LÓGICA CRÍTICA 2: CONTAGEM GLOBAL DE VAGAS ---
//     // ==========================================================
//     if (dadosOrcamento) {
//         let vagasOcupadasNaTabela = 0;
//         const normalizarTextoGeral = (txt) => String(txt || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
//         const nmFuncaoNormalizada = normalizarTextoGeral(nmFuncao);

//         document.querySelectorAll('#eventsTableBody tr').forEach(linha => {
//             try {
//                 const data = JSON.parse(linha.dataset.eventData);
//                 if (normalizarTextoGeral(data.nmfuncao) === nmFuncaoNormalizada && data.statusstaff !== 'Inativo') {
                    
//                     const datasDoStaff = Array.isArray(data.datasevento) ? data.datasevento : JSON.parse(data.datasevento || '[]');
//                     vagasOcupadasNaTabela += datasDoStaff.length;

//                     if (data.datadiariadobrada) {
//                         const dobras = typeof data.datadiariadobrada === 'string' ? JSON.parse(data.datadiariadobrada) : data.datadiariadobrada;
//                         if (Array.isArray(dobras)) {
//                             vagasOcupadasNaTabela += dobras.length;
//                         }
//                     }
//                 }
//             } catch (e) {
//                 console.error("Erro ao computar linha da tabela:", e);
//             }
//         });

//         const limiteTotal = Number(dadosOrcamento.quantidadeOrcada || dadosOrcamento.quantidade_orcada || 0);
//         const totalJaEscalado = Number(dadosOrcamento.quantidadeEscalada || dadosOrcamento.quantidade_escalada || dadosOrcamento.diarias_escaladas || 0);

//         const qttDiariasNormais = datasSelecionadas.length;
//         const impactoDestaAcao = qttDiariasNormais + countDobras;

//         const totalGeralDesejado = totalJaEscalado + vagasOcupadasNaTabela + impactoDestaAcao;

//         console.log("📊 [Seção Vagas] Verificação:", {
//             limiteTotal,
//             totalJaEscalado,
//             vagasOcupadasNaTabela,
//             impactoDestaAcao,
//             totalGeralDesejado
//         });

// if (totalGeralDesejado > limiteTotal) {
//             const saldoNoOrcamento = limiteTotal - (totalJaEscalado + vagasOcupadasNaTabela);
            
//             // 🎯 CORREÇÃO CRÍTICA: Só tem vaga real se o saldo for maior que zero E cobrir TODAS as diárias solicitadas agora!
//             const temVagaDisponivelReal = saldoNoOrcamento > 0 && saldoNoOrcamento >= impactoDestaAcao;
            
//             const diasComDobraBR = typeof formatarDatas === 'function' ? formatarDatas([...new Set(arrayDobras)]) : arrayDobras.join(', ');

//             let msg = `O limite de vagas para <b>${nmFuncao}</b> foi atingido.<br><br>`;
            
//             if (temVagaDisponivelReal) {
//                 // Caso tenha saldo suficiente perdido em outros dias do orçamento
//                 msg += `Você está solicitando <b>${impactoDestaAcao} diárias</b> (incluindo as dobras de ${diasComDobraBR}).<br>
//                         O orçamento atual da função possui <b>${saldoNoOrcamento} vaga(s)</b> disponível(is) em outros dias do período.<br><br>
//                         Deseja reaproveitar essas vagas do orçamento ou solicitar nova verba?`;
//             } else {
//                 // Caso o saldo seja zero, negativo ou insuficiente para cobrir a ação atual (Ex: precisa de 10, mas só tem 2)
//                 const saldoExibicao = saldoNoOrcamento > 0 ? saldoNoOrcamento : 0;
//                 msg += `⚠️ O orçamento geral da função é insuficiente ou está totalmente esgotado.<br>`;
//                 msg += `Você inseriu <b>${impactoDestaAcao} diárias</b>, mas o saldo restante é de apenas <b>${saldoExibicao} diária(s)</b> (Limite Total: ${limiteTotal}).<br><br>`;
//                 msg += `Como deseja prosseguir?`;
//             }

//             // 📥 SWAL 3: Limite de Diárias Excedido (Configurado dinamicamente baseado no saldo real)
//             const resultVaga = await Swal.fire({
//                 icon: 'warning',
//                 title: 'Limite de Diárias Excedido',
//                 html: msg,
//                 showCancelButton: true,
//                 showDenyButton: true,
//                 confirmButtonText: temVagaDisponivelReal ? 'Usar Vaga de outro período' : 'Solicitar Aditivo',
//                 confirmButtonColor: temVagaDisponivelReal ? '#28a745' : '#5f1420', // Cor escura para aditivo se estourou de vez
//                 denyButtonText: 'Extra Bonificado',
//                 denyButtonColor: '#dc3545',
//                 cancelButtonText: 'Cancelar',
//                 cancelButtonColor: '#6c757d'
//             });

//             // Se o usuário clicou em Cancelar ou fechou no X, aborta o salvamento imediatamente
//             if (resultVaga.isDismissed) {
//                 return { allowed: false, solicitouAutorizacao: false };
//             }

//             // Se o usuário escolheu usar a vaga e REALMENTE tinha saldo disponível
//             if (resultVaga.isConfirmed && temVagaDisponivelReal) {
//                 window.tipoExcecaoAtual = "Vaga Reaproveitada"; 
//                 window.bSalvarComoInativo = false; // Permite salvar ativo direto porque está dentro do saldo
//                 return { allowed: true };
//             }

//             // Caso contrário, se clicou no Confirmar (que virou 'Solicitar Aditivo') ou Denied ('Extra Bonificado')
//             if (resultVaga.isConfirmed || resultVaga.isDenied) {
//                 const sufixo = resultVaga.isConfirmed ? 'Aditivo' : 'Extra Bonificado';
//                 const tipoEscolhido = `${sufixo} - Vaga Excedida`;

//                 const dadosExcecao = await solicitarDadosExcecao(
//                     tipoEscolhido,
//                     dadosOrcamento.idorcamento || dadosOrcamento.idOrcamento || 0,
//                     nmFuncao,
//                     idFuncaoProcurado,
//                     idFuncionario,
//                     dataUnicaParaBanco
//                 );

//                 if (dadosExcecao && dadosExcecao.confirmado) {
//                     window.tipoExcecaoAtual = tipoEscolhido;
//                     window.justificativaParaSalvar = dadosExcecao.justificativa;
//                     window.bSalvarComoInativo = true; // Força salvar bloqueado (Inativo) para auditoria

//                     return {
//                         allowed: false,
//                         solicitouAutorizacao: true,
//                         justificativa: dadosExcecao.justificativa,
//                         tipoSolicitacao: tipoEscolhido
//                     };
//                 }
//             }
//             return { allowed: false }; 
//         }
//     }

//     return { allowed: true, solicitouAutorizacao: false };
// }

async function verificarLimiteDeFuncao(criterios, dadosErroBackend = null) {
    console.log("Iniciando verificação de limite de função com critérios:", criterios, "e dados de erro do backend:", dadosErroBackend);

    let nmEvento = (criterios.nmEvento || criterios.nmevento || '').trim().toUpperCase();
    let nmFuncao = (criterios.nmFuncao || criterios.nmfuncao || '').trim().toUpperCase();
    const idFuncionario = criterios.idFuncionario || document.getElementById('idFuncionario')?.value || null;
    const selectFunc = document.getElementById('nmFuncionario');       
    const nmFuncionario = criterios.nmFuncionario || selectFunc?.options[selectFunc.selectedIndex]?.text;

    // ==========================================================
    // 1. Coleta de datas de forma robusta e blindada
    // ==========================================================
    let datasSelecionadas = [];

    if (criterios.datasEvento && Array.isArray(criterios.datasEvento) && criterios.datasEvento.length > 0) {
        datasSelecionadas = criterios.datasEvento;
    } else if (criterios.datasevento && Array.isArray(criterios.datasevento) && criterios.datasevento.length > 0) {
        datasSelecionadas = criterios.datasevento;
    } else {
        const campoData = document.getElementById('periodoEvento') || document.getElementById('datasEvento');
        if (campoData && campoData.value) {
            datasSelecionadas = campoData.value.split(',')
                .map(d => d.trim())
                .filter(d => d.length > 0);
        } else if (campoData && campoData._flatpickr && campoData._flatpickr.selectedDates.length > 0) {
            datasSelecionadas = campoData._flatpickr.selectedDates.map(d => d.toLocaleDateString('en-CA'));
        }
    }

    datasSelecionadas = datasSelecionadas.map(d => String(d).substring(0, 10));
    console.log("Datas selecionadas para verificação:", datasSelecionadas);

    const dataUnicaParaBanco = datasSelecionadas[0] || null;

    // Garante a leitura segura das dobras para evitar quebra de código
    let arrayDobras = criterios.datasEventoDobradas || (typeof datasEventoDobradas !== 'undefined' ? datasEventoDobradas : []);
    let countDobras = Array.isArray(arrayDobras) ? arrayDobras.length : 0;
    let ehDiariaDobrada = (countDobras > 0 || criterios.isDiariaDobrada === true || (typeof isDiariaDobrada !== 'undefined' && isDiariaDobrada === true));
    
    if (ehDiariaDobrada) {
        console.log("🔄 [verificarLimiteDeFuncao] É Diária Dobrada detectada no início. Ignorando validações para seguir fluxo sequencial.");
        return { allowed: true }; 
    }

    if (typeof orcamentoPorFuncao === 'undefined' || !orcamentoPorFuncao) {
        window.orcamentoPorFuncao = {}; 
    }

    // ==========================================================
    // 2. Busca do Orçamento na Memória / Cache
    // ==========================================================
    let chaveSimples = [nmEvento, nmFuncao].filter(p => p).join('-');
    let dadosOrcamento = window.orcamentoPorFuncao ? window.orcamentoPorFuncao[chaveSimples] : undefined;

    const idFuncaoProcurado = criterios.idFuncao || criterios.idfuncao;

    if (!dadosOrcamento && window.orcamentoPorFuncao) {
        const todasAsChaves = Object.keys(window.orcamentoPorFuncao);
        const chaveEncontrada = todasAsChaves.find(c => c.includes(nmEvento) && c.includes(nmFuncao));
        if (chaveEncontrada) dadosOrcamento = window.orcamentoPorFuncao[chaveEncontrada];
    }

    if (!dadosOrcamento && window.orcamentoPorFuncao && idFuncaoProcurado) {
        dadosOrcamento = Object.values(window.orcamentoPorFuncao).find(o => {
            if (!o) return false;
            return String(o.idfuncao) === String(idFuncaoProcurado) || 
                   String(o.idFuncao) === String(idFuncaoProcurado) ||
                   String(o.id_funcao) === String(idFuncaoProcurado);
        });
        
        if (dadosOrcamento) {
            nmEvento = (dadosOrcamento.nmevento || '').trim().toUpperCase();
            nmFuncao = (dadosOrcamento.descfuncao || dadosOrcamento.nmfuncao || '').trim().toUpperCase();
            chaveSimples = `${nmEvento}-${nmFuncao}`;
            console.log(`💡 [verificarLimiteDeFuncao] Cache localizado via ID da Função: [${chaveSimples}]`);
        }
    }

    console.log("DADOS BRUTOS NO INÍCIO:", dadosOrcamento);

    // 3. Se não encontrar ou estiver incompleto, força recarga via API
    if (!dadosOrcamento || (!dadosOrcamento.quantidade_orcada && !dadosOrcamento.quantidadeOrcada)) {
        console.warn(`⚠️ Cache incompleto para '${chaveSimples}'. Forçando busca no banco...`);
        const idClienteDefinido = criterios.idCliente || criterios.idcliente || document.getElementById('nmCliente')?.value || null;

        let retornoApi = await buscarEPopularOrcamento(
            criterios.idEvento || criterios.idevento,
            idClienteDefinido,
            criterios.idLocalMontagem || criterios.idlocalmontagem, 
            criterios.idFuncao || criterios.idfuncao,
            datasSelecionadas,
            false,
            true
        );
        
        if (retornoApi) {
            dadosOrcamento = Array.isArray(retornoApi) ? retornoApi[0] : retornoApi;
        }

        if (dadosOrcamento) {
            nmEvento = (dadosOrcamento.nmevento || '').trim().toUpperCase();
            nmFuncao = (dadosOrcamento.descfuncao || dadosOrcamento.nmfuncao || '').trim().toUpperCase();
            chaveSimples = [nmEvento, nmFuncao].filter(p => p).join('-');
        }
    }

    // Fallback de segurança para não quebrar objetos
    if (!dadosOrcamento) {
        dadosOrcamento = { quantidadeOrcada: 0, quantidadeEscalada: 0, datasOrcadas: [] };
    }

    // ==========================================================
    // --- LÓGICA CRÍTICA 1: VERIFICAÇÃO DE DATAS OUT-OF-BUDGET ---
    // ==========================================================
    if (datasSelecionadas.length > 0) {
        let ehExcecaoDeData = false;
        let datasPermitidas = [];
        const datasSelNormalizadas = [...new Set(datasSelecionadas.map(d => String(d).trim().substring(0, 10)))];

        if (dadosOrcamento && dadosOrcamento.datasOrcadas) {
            datasPermitidas = (Array.isArray(dadosOrcamento.datasOrcadas) 
                ? dadosOrcamento.datasOrcadas 
                : [dadosOrcamento.datasOrcadas]).map(d => String(d).trim().substring(0, 10));

            ehExcecaoDeData = datasSelNormalizadas.some(dataSel => !datasPermitidas.includes(dataSel));
        } else {
            ehExcecaoDeData = true; 
        }

        console.log("ehExcecaoDeData:", ehExcecaoDeData);
    console.log("datasPermitidas:", datasPermitidas);
    console.log("datasSelNormalizadas:", datasSelNormalizadas);
    console.log("window.estaSalvando:", window.estaSalvando);

        if (ehExcecaoDeData) {
            if (window.justificativaParaSalvar && window.tipoExcecaoAtual) {
                return { allowed: false, solicitouAutorizacao: true, justificativa: window.justificativaParaSalvar, tipoSolicitacao: window.tipoExcecaoAtual };
            }

            // 🌟 EM VEZ DE RECALCULAR, HERDA O DIAGNÓSTICO DO BACKEND/API
            // Se a API não trouxe a propriedade, assume true por segurança (fallback)
            const dentroDaMargem = dadosOrcamento.hasOwnProperty('dentroDaMargem') ? dadosOrcamento.dentroDaMargem : true;
            
            const datasFormatadasBR = datasSelNormalizadas
                .filter(d => !datasPermitidas.includes(d))
                .map(d => d.split('-').reverse().join('/'))
                .join(', ');

            // 📥 SWAL 1: Alerta preventivo (Info) baseado no diagnóstico herdado
            if (!dadosErroBackend && !window.estaSalvando) {
                let htmlMensagemInfo = `As datas <b>${datasSelNormalizadas.map(d => d.split('-').reverse().join('/')).join(', ')}</b> não constam no orçamento aprovado.<br><br>`;
                
                if (dentroDaMargem) {
                    htmlMensagemInfo += `<div style="color: #856404; background-color: #fff3cd; border: 1px solid #ffeeba; padding: 10px; border-radius: 5px; font-size: 0.85rem; text-align:left;">
                        ℹ️ <b>Informativo:</b> Este período está <b>dentro da margem permitida de 30 dias</b> do planejamento original.
                    </div>`;
                } else {
                    htmlMensagemInfo += `<div style="color: #721c24; background-color: #f8d7da; border: 1px solid #f5c6cb; padding: 10px; border-radius: 5px; font-size: 0.85rem; text-align:left;">
                        🛑 <b>Atenção:</b> O período selecionado está <b>fora da margem permitida</b> de tolerância.
                    </div>`;
                }
                htmlMensagemInfo += `<p style="margin-top:15px;">Deseja prosseguir para classificar a exceção ou corrigir as datas?</p>`;

                const { isConfirmed } = await Swal.fire({
                    icon: dentroDaMargem ? 'info' : 'warning',
                    title: 'Período fora do planejado',
                    html: htmlMensagemInfo,
                    showCancelButton: true,
                    confirmButtonText: 'Prosseguir',
                    cancelButtonText: 'Corrigir Datas',
                    confirmButtonColor: '#28a745'
                });

                if (!isConfirmed) return { allowed: false, preventDefault: true };
            }

            // 📥 SWAL 2: Alerta de Envio (Warning com opções de Aditivo/Extra)
            let decisaoManual = null;
            let htmlExcecaoComOpcoes = `As datas selecionadas não constam no orçamento aprovado.<br><br>`;
            
            if (dentroDaMargem) {
                htmlExcecaoComOpcoes += `<div style="color: #856404; background-color: #fff3cd; border: 1px solid #ffeeba; padding: 10px; border-radius: 5px; font-size: 0.85rem; text-align:left;">
                    As datas <b>${datasFormatadasBR}</b> não estão no orçamento, mas estão dentro da margem permitida de 30 dias.
                </div>
                <p style="margin-top:15px;">Deseja registrar como exceção ou apenas prosseguir?</p>`;
            } else {
                htmlExcecaoComOpcoes += `<div style="color: #721c24; background-color: #f8d7da; border: 1px solid #f5c6cb; padding: 10px; border-radius: 5px; font-size: 0.85rem; text-align:left;">
                    🛑 <b>Bloqueio:</b> Período totalmente fora da margem planejada. Uma autorização de aditivo é obrigatória.
                </div>`;
            }

            const resultDatas = await Swal.fire({
                icon: 'warning',
                title: 'Data fora do Orçamento',
                html: htmlExcecaoComOpcoes,
                showCancelButton: true,
                showDenyButton: true,
                confirmButtonText: 'Solicitar Aditivo',
                denyButtonText: 'Extra Bonificado',
                cancelButtonText: 'Cancelar',
                footer: dentroDaMargem ? `
                    <button id="btnProsseguirSem" 
                            style="width: 100%; 
                                padding: 12px; 
                                background-color: #7a1e27; 
                                color: white; 
                                border: none; 
                                border-radius: .25em; 
                                font-size: 1rem; 
                                font-weight: 500; 
                                cursor: pointer; 
                                transition: background-color 0.1s;
                                box-shadow: 0 0 0 3px transparent;">
                        Prosseguir sem solicitação
                    </button>
                ` : '',
                didOpen: () => {
                    if (dentroDaMargem) {
                        const btnProsseguir = document.getElementById('btnProsseguirSem');
                        if (btnProsseguir) {
                            btnProsseguir.onclick = () => {
                                decisaoManual = 'prosseguir';
                                Swal.clickConfirm();
                            };
                        }
                    }
                }
            });

         

            if ((resultDatas.isConfirmed || resultDatas.isDenied) && decisaoManual !== 'prosseguir') {
                const sufixo = resultDatas.isConfirmed ? 'Aditivo' : 'Extra Bonificado';
                const tipoEscolhido = `${sufixo} - Datas fora do Orçamento`;


                 // Calcula as datas que realmente excedem o saldo
                const saldoRestante = Math.max(0, limiteTotal - totalJaEscalado);
                const datasExcedentes = datasSelecionadas.slice(saldoRestante);
                const datasParaSolicitar = datasExcedentes.length > 0 ? datasExcedentes : datasSelecionadas;
               
                
                const dadosExcecao = await solicitarDadosExcecao(
                    tipoEscolhido, 
                    dadosOrcamento.idorcamento || dadosOrcamento.idOrcamento || 0, 
                    nmFuncao, 
                    idFuncaoProcurado, 
                    idFuncionario, 
                    //dataUnicaParaBanco
                    datasParaSolicitar
                );

                if (dadosExcecao && dadosExcecao.confirmado) {
                    window.tipoExcecaoAtual = tipoEscolhido;
                    window.justificativaParaSalvar = dadosExcecao.justificativa;
                    window.bSalvarComoInativo = true;
                    
                    return { 
                        allowed: false, 
                        solicitouAutorizacao: true, 
                        justificativa: dadosExcecao.justificativa, 
                        tipoSolicitacao: tipoEscolhido 
                    };
                }
                return { allowed: false };
            } else if (decisaoManual === 'prosseguir') {
                window.bSalvarComoInativo = false;
                window.tipoExcecaoAtual = null;
                
                // Grava o histórico na observação geral por estar dentro da margem
                const elObs = document.getElementById('obsgeral');
                if (elObs) {
                    const periodoOriginalBR = datasPermitidas.map(d => d.split('-').reverse().join('/')).join(', ');
                    const nomeUsuarioLogado = window.usuarioLogadoNome || "Sistema";
                    const logHist = `\n[HISTÓRICO] Período planejado: ${periodoOriginalBR}. Registrado em: ${datasFormatadasBR} por margem de tolerância. Por: ${nomeUsuarioLogado}.`;
                    elObs.value = (elObs.value + logHist).trim();
                }
                // Deixa vazar para avaliar a contagem de vagas abaixo
            } else {
                return { allowed: false }; 
            }
        }
    }

    // ==========================================================
    // --- LÓGICA CRÍTICA 2: CONTAGEM GLOBAL DE VAGAS ---
    // ==========================================================
    if (dadosOrcamento) {
        let vagasOcupadasNaTabela = 0;
        const normalizarTextoGeral = (txt) => String(txt || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
        const nmFuncaoNormalizada = normalizarTextoGeral(nmFuncao);

        document.querySelectorAll('#eventsTableBody tr').forEach(linha => {
            try {
                const data = JSON.parse(linha.dataset.eventData);
                if (normalizarTextoGeral(data.nmfuncao) === nmFuncaoNormalizada && data.statusstaff !== 'Inativo') {
                    
                    const datasDoStaff = Array.isArray(data.datasevento) ? data.datasevento : JSON.parse(data.datasevento || '[]');
                    vagasOcupadasNaTabela += datasDoStaff.length;

                    // if (data.datadiariadobrada) {
                    //     const dobras = typeof data.datadiariadobrada === 'string' ? JSON.parse(data.datadiariadobrada) : data.datadiariadobrada;
                    //     if (Array.isArray(dobras)) {
                    //         vagasOcupadasNaTabela += dobras.length;
                    //     }
                    // }

                    if (data.dtdiariadobrada) {
                        const dobras = typeof data.dtdiariadobrada === 'string' 
                            ? JSON.parse(data.dtdiariadobrada) 
                            : data.dtdiariadobrada;
                        if (Array.isArray(dobras)) {
                            const dobrasNestaFuncao = dobras.filter(d => 
                                (d.status === 'Pendente' || d.status === 'Autorizado') &&
                                String(d.idfuncaodobra) === String(idFuncaoProcurado)
                            );
                            vagasOcupadasNaTabela += dobrasNestaFuncao.length;
                        }
                    }
                }
            } catch (e) {
                console.error("Erro ao computar linha da tabela:", e);
            }
        });

        const limiteTotal = Number(dadosOrcamento.quantidadeOrcada || dadosOrcamento.quantidade_orcada || 0);
        const totalJaEscalado = Number(dadosOrcamento.quantidadeEscalada || dadosOrcamento.quantidade_escalada || dadosOrcamento.diarias_escaladas || 0);

        const qttDiariasNormais = datasSelecionadas.length;
        const impactoDestaAcao = qttDiariasNormais + countDobras;

        const totalGeralDesejado = totalJaEscalado + vagasOcupadasNaTabela + impactoDestaAcao;

        console.log("📊 [Seção Vagas] Verificação:", {
            limiteTotal,
            totalJaEscalado,
            vagasOcupadasNaTabela,
            impactoDestaAcao,
            totalGeralDesejado
        });

        if (totalGeralDesejado > limiteTotal) {
            const saldoNoOrcamento = limiteTotal - (totalJaEscalado + vagasOcupadasNaTabela);
            
            const temVagaDisponivelReal = saldoNoOrcamento > 0 && saldoNoOrcamento >= impactoDestaAcao;
            
            const diasComDobraBR = typeof formatarDatas === 'function' ? formatarDatas([...new Set(arrayDobras)]) : arrayDobras.join(', ');

            let msg = `O limite de vagas para <b>${nmFuncao}</b> foi atingido.<br><br>`;
            
            if (temVagaDisponivelReal) {
                msg += `Você está soliciting <b>${impactoDestaAcao} diárias</b> (incluindo as dobras de ${diasComDobraBR}).<br>
                        O orçamento atual da função possui <b>${saldoNoOrcamento} vaga(s)</b> disponível(is) em outros dias do período.<br><br>
                        Deseja reaproveitar essas vagas do orçamento ou solicitar nova verba?`;
            } else {
                const saldoExibicao = saldoNoOrcamento > 0 ? saldoNoOrcamento : 0;
                msg += `⚠️ O orçamento geral da função é insuficiente ou está totalmente esgotado.<br>`;
                msg += `Você inseriu <b>${impactoDestaAcao} diárias</b>, mas o saldo restante é de apenas <b>${saldoExibicao} diária(s)</b> (Limite Total: ${limiteTotal}).<br><br>`;
                msg += `Como deseja prosseguir?`;
            }

            const resultVaga = await Swal.fire({
                icon: 'warning',
                title: 'Limite de Diárias Excedido',
                html: msg,
                showCancelButton: true,
                showDenyButton: true,
                confirmButtonText: temVagaDisponivelReal ? 'Usar Vaga de outro período' : 'Solicitar Aditivo',
                confirmButtonColor: temVagaDisponivelReal ? '#28a745' : '#5f1420', 
                denyButtonText: 'Extra Bonificado',
                denyButtonColor: '#dc3545',
                cancelButtonText: 'Corrigir Datas',
                cancelButtonColor: '#6c757d'
            });

            if (resultVaga.isDismissed) {
                return { allowed: false, solicitouAutorizacao: false };
            }

            if (resultVaga.isConfirmed && temVagaDisponivelReal) {
                window.tipoExcecaoAtual = "Vaga Reaproveitada"; 
                window.bSalvarComoInativo = false; 
                return { allowed: true };
            }

            if (resultVaga.isConfirmed || resultVaga.isDenied) {
                const sufixo = resultVaga.isConfirmed ? 'Aditivo' : 'Extra Bonificado';
                const tipoEscolhido = `${sufixo} - Vaga Excedida`;

                // Datas que excedem o saldo
                const saldoRestante = Math.max(0, limiteTotal - totalJaEscalado);
                const datasExcedentes = datasSelecionadas.slice(saldoRestante);
                const datasFinais = datasExcedentes.length > 0 ? datasExcedentes : datasSelecionadas;

                const dadosExcecao = await solicitarDadosExcecao(
                    tipoEscolhido,
                    dadosOrcamento.idorcamento || dadosOrcamento.idOrcamento || 0,
                    nmFuncao,
                    idFuncaoProcurado,
                    idFuncionario,
                    datasFinais
                    //dataUnicaParaBanco
                );

                if (dadosExcecao && dadosExcecao.confirmado) {
                    window.tipoExcecaoAtual = tipoEscolhido;
                    window.justificativaParaSalvar = dadosExcecao.justificativa;
                    window.bSalvarComoInativo = true; 
                    window.datasParaSalvarNoBanco = datasFinais;

                    return {
                        allowed: false,
                        solicitouAutorizacao: true,
                        justificativa: dadosExcecao.justificativa,
                        tipoSolicitacao: tipoEscolhido
                    };
                }
            }
            return { allowed: false }; 
        }
    }

    return { allowed: true, solicitouAutorizacao: false };
}


// Função auxiliar para carregar as funções com vagas disponíveis do orçamento e perguntar a correta


// async function perguntarFuncaoDiariaDobrada(vagasDisponiveis, dadosOrcamento, criterios, nmFuncao, idFuncionario, dataUnicaParaBanco) {
//     try {
//         // Captura os IDs selecionados nos elementos do formulário atual
//         const idEvento = document.getElementById('nmEvento')?.value;
//         const idCliente = document.getElementById('nmCliente')?.value;
//         const idLocalMontagem = document.getElementById('nmLocalMontagem')?.value;
//         const idEquipe = document.getElementById('nmEquipe')?.value;
        
//         // Captura o ID do orçamento se ele estiver disponível no escopo do formulário ou objeto global
//         const idOrcamento = currentEditingStaffEvent?.idorcamento || null;

//         const setorAtual = (typeof setorEsperado !== 'undefined' && setorEsperado) ? setorEsperado.trim() : "";

//         // 🌟 Formata a data atual do loop para exibir de forma amigável no Swal (Ex: 19/05/2026)
//         let dataFormatadaBR = "Data não definida";
//         if (dataUnicaParaBanco) {
//             const partes = dataUnicaParaBanco.split('-');
//             if (partes.length === 3) dataFormatadaBR = `${partes[2]}/${partes[1]}/${partes[0]}`;
//         }

//         console.log(`🚀 [Diária Dobrada] Processando modal individual para a data: ${dataUnicaParaBanco}`, {
//             idOrcamento, idEvento, idCliente, idLocalMontagem, setorAtual, idEquipe
//         });

//         if (!idEvento || !idCliente || !idLocalMontagem) {
//             console.warn("⚠️ Não foi possível buscar as vagas do orçamento: IDs do Evento, Cliente ou Local ausentes.");
//             return null;
//         }

//         // Faz o POST consumindo a rota de vagas
//         const vagasDisponiveis = await fetchComToken('/staff/orcamento/vagas-disponiveis', {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify({
//                 idOrcamento: null,
//                 idEvento: parseInt(idEvento),
//                 idCliente: parseInt(idCliente),
//                 idLocalMontagem: parseInt(idLocalMontagem),
//                 setor: setorAtual,
//                 idEquipe: idEquipe ? parseInt(idEquipe) : null
//             })
//         });

//         console.log("📦 [Diária Dobrada] Retorno bruto da rota:", vagasDisponiveis);

//         if (!vagasDisponiveis || !Array.isArray(vagasDisponiveis)) {
//             Swal.fire("Erro", "Não foi possível carregar a lista de vagas do orçamento.", "error");
//             return null;
//         }

//         const idEquipeFuncionario = currentEditingStaffEvent?.idequipe || null;
//         const funcoesFiltradas = vagasDisponiveis.filter(vaga => {
//             const temSaldo = parseInt(vaga.saldo_disponivel) > 0;
//             const ehDaMesmaEquipe = idEquipeFuncionario ? parseInt(vaga.idequipe) === parseInt(idEquipeFuncionario) : true;
//             return temSaldo && ehDaMesmaEquipe;
//         });

//         if (funcoesFiltradas.length === 0) {
//             console.warn("🛑 Nenhuma vaga com saldo positivo foi encontrada. Disparando Swal de bloqueio...");
//             await Swal.fire({
//                 title: `Atenção! (Dobra de ${dataFormatadaBR})`,
//                 text: `Não existem funções com vagas disponíveis remanescentes neste orçamento para alocar a diária dobrada do dia ${dataFormatadaBR}.`,
//                 icon: 'warning',
//                 confirmButtonText: 'Entendido'
//             });
//             return null;
//         }

//         let optionsHtml = '<option value="">Selecione uma função disponível para sua equipe...</option>';
//         funcoesFiltradas.forEach(vaga => {
//             const labelSetor = vaga.setor && vaga.setor !== 'Geral / Sem Setor' ? ` | Setor: ${vaga.setor}` : ' | Sem Setor';
//             const labelPeriodo = vaga.periodo ? ` | Período: ${vaga.periodo}` : ' | Período não definido';
//             optionsHtml += `<option value="${vaga.idfuncao}">${vaga.nmfuncao}${labelSetor}${labelPeriodo} (Saldo: ${vaga.saldo_disponivel})</option>`;
//         });

//         let escolhaModal = null;

//         // 🌟 Injeta a data formatada no Título e no subtítulo do Swal
//         await Swal.fire({
//             title: `<span style="font-size: 20px; font-weight: bold; color: #333;">Diária Dobrada Detectada - ${dataFormatadaBR}</span>`,
//             html: `
//                 <div style="text-align: left; padding: 0 5px;">
//                     <p style="font-size: 14px; color: #666; margin-bottom: 12px;">
//                         Por favor, selecione qual a função que deseja associar para a diária dobrada do dia <b style="color: #000;">${dataFormatadaBR}</b>:
//                     </p>
                    
//                     <select id="swal-select-funcao" class="form-control" style="width: 100%; height: 40px; font-size: 14px; margin-bottom: 20px; border-radius: 6px; padding: 6px 12px;">
//                         ${optionsHtml}
//                     </select>
                    
//                     <div style="border-top: 1px solid #e9ecef; margin: 15px 0; padding-top: 15px; text-align: center;">
//                         <p style="font-size: 13px; font-weight: 500; color: #777; margin-bottom: 12px;">
//                             Não encontrou a vaga ou saldo necessário para sua equipe no dia ${dataFormatadaBR}?
//                         </p>
                        
//                         <div style="display: flex; gap: 12px; justify-content: center; width: 100%; margin-bottom: 25px;">
//                             <button type="button" id="btn-solicitar-aditivo" class="btn" 
//                                     style="flex: 1; max-width: 180px; padding: 8px; font-weight: bold; font-size: 13px; background-color: #8B0000; color: white; border: none; display: flex; align-items: center; justify-content: center; gap: 5px; border-radius: 4px;">
//                                 <i class="fa fa-plus"></i> Solicitar Aditivo
//                             </button>
//                             <button type="button" id="btn-solicitar-extra" class="btn" 
//                                     style="flex: 1; max-width: 180px; padding: 8px; font-weight: bold; font-size: 13px; background-color: #DC3545; color: white; border: none; display: flex; align-items: center; justify-content: center; gap: 5px; border-radius: 4px;">
//                                 <i class="fa fa-star"></i> Extra Bonificado
//                             </button>
//                         </div>
//                     </div>

//                     <div style="border-top: 1px solid #e9ecef; padding-top: 15px; display: flex; justify-content: center; gap: 15px; width: 100%;">
//                         <button type="button" id="btn-confirmar-alocacao" class="btn" style="padding: 10px 24px; font-weight: bold; font-size: 14px; background-color: #28A745; color: white; border: none; border-radius: 6px;">
//                             Confirmar Alocação
//                         </button>
//                         <button type="button" id="btn-cancelar-modal" class="btn" style="padding: 10px 24px; font-weight: bold; font-size: 14px; background-color: #6C757D; color: white; border: none; border-radius: 6px;">
//                             Cancelar
//                         </button>
//                     </div>
//                 </div>
//             `,
//             showConfirmButton: false, 
//             showCancelButton: false,  
//             width: '550px',           
//             allowOutsideClick: false, 
//             didOpen: () => {
//                 const selectElement = document.getElementById('swal-select-funcao');
                
//                 document.getElementById('btn-solicitar-aditivo').addEventListener('click', () => {
//                     escolhaModal = "SOLICITAR_ADITIVO";
//                     Swal.close();
//                 });

//                 document.getElementById('btn-solicitar-extra').addEventListener('click', () => {
//                     escolhaModal = "SOLICITAR_EXTRA_BONIFICADO";
//                     Swal.close();
//                 });

//                 document.getElementById('btn-confirmar-alocacao').addEventListener('click', () => {
//                     const selectValue = selectElement.value;
//                     if (!selectValue) {
//                         Swal.showValidationMessage('Por favor, selecione uma função ou solicite uma exceção.');
//                         return;
//                     }
//                     escolhaModal = selectValue; 
//                     Swal.close();
//                 });

//                 document.getElementById('btn-cancelar-modal').addEventListener('click', () => {
//                     escolhaModal = null;
//                     Swal.close();
//                 });
//             }
//         });
       
//         if (escolhaModal) {
//             const idOrcamentoAtual = dadosOrcamento.idorcamento || dadosOrcamento.idOrcamento;
//             const idFuncionarioAtual = idFuncionario || null;
            
//             // 🌟 OBRIGATÓRIO: A solicitação deve conter APENAS a data única daquela iteração do loop!
//             const datasParaSolicitacao = dataUnicaParaBanco ? [dataUnicaParaBanco] : (criterios.datasEvento || []); 

//             if (escolhaModal === "SOLICITAR_ADITIVO") {
//                 console.log(`🚀 Fluxo Unificado: Aditivo - Vaga Excedida solicitado para a data ${dataUnicaParaBanco}.`);
                
//                 const tipoVaga = 'Aditivo - Vaga Excedida';
                
//                 const dadosExcecao = await solicitarDadosExcecao(
//                     tipoVaga, 
//                     idOrcamentoAtual, 
//                     nmFuncao, 
//                     criterios.idFuncao, 
//                     idFuncionarioAtual, 
//                     datasParaSolicitacao
//                 );

//                 if (dadosExcecao?.confirmado) {
//                     console.log("📝 Gravando solicitação de Aditivo Única no banco...");
                    
//                     const resultado = await salvarSolicitacaoAditivoExtra(
//                         idOrcamentoAtual,
//                         criterios.idFuncao,
//                         1, 
//                         tipoVaga, 
//                         dadosExcecao.justificativa,
//                         idFuncionarioAtual,
//                         datasParaSolicitacao,
//                         criterios.idEventoSolicitado || null,
//                         criterios.idEventoConflitante || null,
//                         null 
//                     );

//                     if (resultado && resultado.sucesso) {
//                         window.tipoExcecaoAtual = tipoVaga;
//                         window.justificativaParaSalvar = dadosExcecao.justificativa;
//                         window.bSalvarComoInativo = true; 

//                         await Swal.fire({
//                             icon: 'success',
//                             title: 'Solicitação Enviada!',
//                             text: `A solicitação de Aditivo para o dia ${dataFormatadaBR} foi gerada com sucesso e aguarda aprovação.`,
//                             confirmButtonText: 'Prosseguir'
//                         });

//                         // Retorna o tipo de vaga como string identificável para salvar na tabela de dobras se necessário
//                         return escolhaModal;
//                     } else {
//                         await Swal.fire('Erro!', `Não foi possível salvar a solicitação: ${resultado.erro}`, 'error');
//                         return null;
//                     }
//                 }
//                 return null;

//             } else if (escolhaModal === "SOLICITAR_EXTRA_BONIFICADO") {
//                 console.log(`🚀 Fluxo Unificado: Extra Bonificado - Vaga Excedida solicitado para a data ${dataUnicaParaBanco}.`);
                
//                 const tipoVaga = 'Extra Bonificado - Vaga Excedida';
                
//                 const dadosExcecao = await solicitarDadosExcecao(
//                     tipoVaga, 
//                     idOrcamentoAtual, 
//                     nmFuncao, 
//                     criterios.idFuncao, 
//                     idFuncionarioAtual, 
//                     datasParaSolicitacao
//                 );

//                 if (dadosExcecao?.confirmado) {
//                     console.log("📝 Gravando solicitação de Extra Bonificado Única no banco...");
                    
//                     const resultado = await salvarSolicitacaoAditivoExtra(
//                         idOrcamentoAtual,
//                         criterios.idFuncao,
//                         1, 
//                         tipoVaga, 
//                         dadosExcecao.justificativa,
//                         idFuncionarioAtual,
//                         datasParaSolicitacao,
//                         criterios.idEventoSolicitado || null,
//                         criterios.idEventoConflitante || null,
//                         null
//                     );

//                     if (resultado && resultado.sucesso) {
//                         window.tipoExcecaoAtual = tipoVaga;
//                         window.justificativaParaSalvar = dadosExcecao.justificativa;
//                         window.bSalvarComoInativo = true;

//                         await Swal.fire({
//                             icon: 'success',
//                             title: 'Solicitação Enviada!',
//                             text: `A solicitação de Extra Bonificado para o dia ${dataFormatadaBR} foi gerada com sucesso e aguarda aprovação.`,
//                             confirmButtonText: 'Prosseguir'
//                         });

//                         return escolhaModal;
//                     } else {
//                         await Swal.fire('Erro!', `Não foi possível salvar a solicitação: ${resultado.erro}`, 'error');
//                         return null;
//                     }
//                 }
//                 return null;

//             } else {
//                 // =========================================================================
//                 // Fluxo normal: Reaproveitou uma vaga com ID legítimo
//                 // =========================================================================
//                 const idFuncaoSelecionada = escolhaModal;
//                 console.log(`✅ Alocando diária dobrada na função ID: ${idFuncaoSelecionada} para o dia ${dataUnicaParaBanco}`);
                
//                 const vagaEscolhida = vagasDisponiveis.find(v => parseInt(v.idfuncao) === parseInt(idFuncaoSelecionada));
//                 const setorVaga = vagaEscolhida ? vagaEscolhida.setor : 'Geral / Sem Setor';
//                 const nomeVaga = vagaEscolhida ? vagaEscolhida.nmfuncao : nmFuncao;

//                 // 1. Captura o texto que o usuário digitou obrigatoriamente no campo da tela
//                 const descUsuario = document.getElementById('descDiariaDobrada')?.value || '';
                
//                 // 2. Unifica os dados da Vaga Consumida + a Justificativa que já está na tela
//                 window.justificativaParaSalvar = `[Diária Dobrada ${dataFormatadaBR}] Consumiu vaga da função "${nomeVaga}" do setor "${setorVaga}" para cobrir virada. Justificativa: ${descUsuario}`.trim();
                
//                 window.tipoExcecaoAtual = "Vaga Reaproveitada";
                
//                 // 🌟 Retorna o ID puro escolhido para que seu botão salvar alimente o arrayDiariaDobradaFinal corretamente
//                 return idFuncaoSelecionada;
//             }
//         } else {
//             console.log("❌ Operação cancelada pelo usuário no modal de dobra.");
//             return null;
//         }
//     } catch (error) {
//         console.error("Erro ao carregar mapa de vagas ou abrir seletor de função:", error);
//         Swal.fire("Erro", "Ocorreu um problema ao processar as vagas do orçamento.", "error");
//         return null;
//     }
// }





async function perguntarFuncaoDiariaDobrada(vagasDisponiveis, dadosOrcamento, criterios, nmFuncao, idFuncionario, dataUnicaParaBanco) {
    try {
        // Captura os IDs selecionados nos elementos do formulário atual
        const idEvento = document.getElementById('nmEvento')?.value;
        const idCliente = document.getElementById('nmCliente')?.value;
        const idLocalMontagem = document.getElementById('nmLocalMontagem')?.value;
        const idEquipe = document.getElementById('nmEquipe')?.value;
        
        // Captura o ID do orçamento se ele estiver disponível no escopo do formulário ou objeto global
        const idOrcamento = currentEditingStaffEvent?.idorcamento || null;

        const setorAtual = (typeof setorEsperado !== 'undefined' && setorEsperado) ? setorEsperado.trim() : "";

        // 🌟 Formata a data atual do loop para exibir de forma amigável no Swal (Ex: 19/05/2026)
        let dataFormatadaBR = "Data não definida";
        if (dataUnicaParaBanco) {
            const partes = dataUnicaParaBanco.split('-');
            if (partes.length === 3) dataFormatadaBR = `${partes[2]}/${partes[1]}/${partes[0]}`;
        }

        console.log(`🚀 [Diária Dobrada] Processando modal individual para a data: ${dataUnicaParaBanco}`, {
            idOrcamento, idEvento, idCliente, idLocalMontagem, setorAtual, idEquipe
        });

        if (!idEvento || !idCliente || !idLocalMontagem) {
            console.warn("⚠️ Não foi possível buscar as vagas do orçamento: IDs do Evento, Cliente ou Local ausentes.");
            return null;
        }

        // Faz o POST consumindo a rota de vagas
        const vagasBuscadas = await fetchComToken('/staff/orcamento/vagas-disponiveis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                idOrcamento: null,
                idEvento: parseInt(idEvento),
                idCliente: parseInt(idCliente),
                idLocalMontagem: parseInt(idLocalMontagem),
                setor: setorAtual,
                idEquipe: idEquipe ? parseInt(idEquipe) : null
            })
        });

        console.log("📦 [Diária Dobrada] Retorno bruto da rota:", vagasBuscadas);

        if (!vagasBuscadas || !Array.isArray(vagasBuscadas)) {
            Swal.fire("Erro", "Não foi possível carregar a lista de vagas do orçamento.", "error");
            return null;
        }

        const idEquipeFuncionario = currentEditingStaffEvent?.idequipe || null;
        const funcoesFiltradas = vagasBuscadas.filter(vaga => {
            const temSaldo = parseInt(vaga.saldo_disponivel) > 0;
            const ehDaMesmaEquipe = idEquipeFuncionario ? parseInt(vaga.idequipe) === parseInt(idEquipeFuncionario) : true;
            return temSaldo && ehDaMesmaEquipe;
        });

        if (funcoesFiltradas.length === 0) {
            console.warn("🛑 Nenhuma vaga com saldo positivo foi encontrada. Disparando Swal de bloqueio...");
            await Swal.fire({
                title: `Atenção! (Dobra de ${dataFormatadaBR})`,
                text: `Não existem funções com vagas disponíveis remanescentes neste orçamento para alocar a diária dobrada do dia ${dataFormatadaBR}.`,
                icon: 'warning',
                confirmButtonText: 'Entendido'
            });
            return null;
        }

        let optionsHtml = '<option value="">Selecione uma função disponível para sua equipe...</option>';
        funcoesFiltradas.forEach(vaga => {
            const labelSetor = vaga.setor && vaga.setor !== 'Geral / Sem Setor' ? ` | Setor: ${vaga.setor}` : ' | Sem Setor';
            const labelPeriodo = vaga.periodo ? ` | Período: ${vaga.periodo}` : ' | Período não definido';
            optionsHtml += `<option value="${vaga.idfuncao}-${vaga.idorcamento}">${vaga.nmfuncao}${labelSetor}${labelPeriodo} (Orç: ${vaga.idorcamento} | Saldo: ${vaga.saldo_disponivel} diárias)</option>`;
        });        

        let escolhaModal = null;
        let idOrcamentoSelecionadoNoClique = null; // 🎯 Variável para interceptar o valor no clique

        // 🌟 Injeta a data formatada no Título e no subtítulo do Swal
        await Swal.fire({
            title: `<span style="font-size: 20px; font-weight: bold; color: #333;">Diária Dobrada Detectada - ${dataFormatadaBR}</span>`,
            html: `
                <div style="text-align: left; padding: 0 5px;">
                    <p style="font-size: 14px; color: #666; margin-bottom: 12px;">
                        Por favor, selecione qual a função que deseja associar para a diária dobrada do dia <b style="color: #000;">${dataFormatadaBR}</b>:
                    </p>
                    
                    <select id="swal-select-funcao" class="form-control" style="width: 100%; height: 40px; font-size: 14px; margin-bottom: 20px; border-radius: 6px; padding: 6px 12px;">
                        ${optionsHtml}
                    </select>
                    
                    <div style="border-top: 1px solid #e9ecef; margin: 15px 0; padding-top: 15px; text-align: center;">
                        <p style="font-size: 13px; font-weight: 500; color: #777; margin-bottom: 12px;">
                            Não encontrou a vaga ou saldo necessário para sua equipe no dia ${dataFormatadaBR}?
                        </p>
                        
                        <div style="display: flex; gap: 12px; justify-content: center; width: 100%; margin-bottom: 25px;">
                            <button type="button" id="btn-solicitar-aditivo" class="btn" 
                                    style="flex: 1; max-width: 180px; padding: 8px; font-weight: bold; font-size: 13px; background-color: #8B0000; color: white; border: none; display: flex; align-items: center; justify-content: center; gap: 5px; border-radius: 4px;">
                                <i class="fa fa-plus"></i> Solicitar Aditivo
                            </button>
                            <button type="button" id="btn-solicitar-extra" class="btn" 
                                    style="flex: 1; max-width: 180px; padding: 8px; font-weight: bold; font-size: 13px; background-color: #DC3545; color: white; border: none; display: flex; align-items: center; justify-content: center; gap: 5px; border-radius: 4px;">
                                <i class="fa fa-star"></i> Extra Bonificado
                            </button>
                        </div>
                    </div>

                    <div style="border-top: 1px solid #e9ecef; padding-top: 15px; display: flex; justify-content: center; gap: 15px; width: 100%;">
                        <button type="button" id="btn-confirmar-alocacao" class="btn" style="padding: 10px 24px; font-weight: bold; font-size: 14px; background-color: #28A745; color: white; border: none; border-radius: 6px;">
                            Confirmar Alocação
                        </button>
                        <button type="button" id="btn-cancelar-modal" class="btn" style="padding: 10px 24px; font-weight: bold; font-size: 14px; background-color: #6C757D; color: white; border: none; border-radius: 6px;">
                            Cancelar
                        </button>
                    </div>
                </div>
            `,
            showConfirmButton: false, 
            showCancelButton: false,  
            width: '550px',           
            allowOutsideClick: false, 
            didOpen: () => {
                const selectElement = document.getElementById('swal-select-funcao');
                
                // Função auxiliar para capturar o orçamento do select antes de fechar
                const capturarOrcamentoAtual = () => {
                    const valor = selectElement?.value;
                    if (valor && valor.includes('-')) {
                        return parseInt(valor.split('-')[1]);
                    }
                    return null;
                };

                document.getElementById('btn-solicitar-aditivo').addEventListener('click', () => {
                    escolhaModal = "SOLICITAR_ADITIVO";
                    idOrcamentoSelecionadoNoClique = capturarOrcamentoAtual(); // 🔥 CAPTURA AQUI!
                    Swal.close();
                });

                document.getElementById('btn-solicitar-extra').addEventListener('click', () => {
                    escolhaModal = "SOLICITAR_EXTRA_BONIFICADO";
                    idOrcamentoSelecionadoNoClique = capturarOrcamentoAtual(); // 🔥 CAPTURA AQUI!
                    Swal.close();
                });

                document.getElementById('btn-confirmar-alocacao').addEventListener('click', () => {
                    const selectValue = selectElement.value;
                    if (!selectValue) {
                        Swal.showValidationMessage('Por favor, selecione uma função ou solicite uma exceção.');
                        return;
                    }
                    escolhaModal = selectValue; 
                    Swal.close();
                });

                document.getElementById('btn-cancelar-modal').addEventListener('click', () => {
                    escolhaModal = null;
                    Swal.close();
                });
            }
        });
       
        if (escolhaModal) {
            let idFuncaoFinal = null;
            // Se já interceptamos o orçamento no clique dos botões, usa ele. Senão, usa o padrão.
            let idOrcamentoFinal = idOrcamentoSelecionadoNoClique || dadosOrcamento.idorcamento || dadosOrcamento.idOrcamento || null;

            // Se o usuário foi pelo fluxo normal de confirmação (veio o valor composto tipo "48-331")
            if (escolhaModal.includes('-')) {
                const [idFunc, idOrc] = escolhaModal.split('-');
                idFuncaoFinal = parseInt(idFunc);
                idOrcamentoFinal = parseInt(idOrc);
            }

            console.log(`📌 Orçamento definido para gravação: ${idOrcamentoFinal}`);

            const idFuncionarioAtual = idFuncionario || null;
            const datasParaSolicitacao = dataUnicaParaBanco ? [dataUnicaParaBanco] : (criterios.datasEvento || []); 

            if (escolhaModal === "SOLICITAR_ADITIVO") {
                console.log(`🚀 Enviando Aditivo para o Orçamento: ${idOrcamentoFinal}`);
                const tipoVaga = 'Aditivo - Vaga Excedida';
                
                const dadosExcecao = await solicitarDadosExcecao(
                    tipoVaga, 
                    idOrcamentoFinal, 
                    nmFuncao, 
                    criterios.idFuncao, 
                    idFuncionarioAtual, 
                    datasParaSolicitacao
                );

                if (dadosExcecao?.confirmado) {
                    const resultado = await salvarSolicitacaoAditivoExtra(
                        idOrcamentoFinal,
                        criterios.idFuncao,
                        1, 
                        tipoVaga, 
                        dadosExcecao.justificativa,
                        idFuncionarioAtual,
                        datasParaSolicitacao,
                        criterios.idEventoSolicitado || null,
                        criterios.idEventoConflitante || null,
                        null 
                    );

                    if (resultado && resultado.sucesso) {
                        window.tipoExcecaoAtual = tipoVaga;
                        window.justificativaParaSalvar = dadosExcecao.justificativa;
                        window.bSalvarComoInativo = true; 

                        await Swal.fire({
                            icon: 'success',
                            title: 'Solicitação Enviada!',
                            text: `A solicitação de Aditivo para o dia ${dataFormatadaBR} foi gerada com sucesso.`,
                            confirmButtonText: 'Prosseguir'
                        });

                        //return escolhaModal;
                        return {
                            tipo: "SOLICITAR_ADITIVO",
                            valor: escolhaModal,
                            idFuncaoFinal: null,
                            idOrcamentoFinal: idOrcamentoFinal,
                            nomeFuncao: nmFuncao,
                            setorVaga: "",
                            vlrCache: 0,
                            vlrAlimentacao: 0,
                            nivelSelecionado: null,
                            justificativa: dadosExcecao.justificativa
                        };


                    } else {
                        await Swal.fire('Erro!', `Não foi possível salvar a solicitação: ${resultado.erro}`, 'error');
                        return null;
                    }
                }
                return null;

            } else if (escolhaModal === "SOLICITAR_EXTRA_BONIFICADO") {
                console.log(`🚀 Enviando Extra Bonificado para o Orçamento: ${idOrcamentoFinal}`);
                const tipoVaga = 'Extra Bonificado - Vaga Excedida';
                
                const dadosExcecao = await solicitarDadosExcecao(
                    tipoVaga, 
                    idOrcamentoFinal, 
                    nmFuncao, 
                    criterios.idFuncao, 
                    idFuncionarioAtual, 
                    datasParaSolicitacao
                );

                if (dadosExcecao?.confirmado) {
                    const resultado = await salvarSolicitacaoAditivoExtra(
                        idOrcamentoFinal,
                        criterios.idFuncao,
                        1, 
                        tipoVaga, 
                        dadosExcecao.justificativa,
                        idFuncionarioAtual,
                        datasParaSolicitacao,
                        criterios.idEventoSolicitado || null,
                        criterios.idEventoConflitante || null,
                        null
                    );

                    if (resultado && resultado.sucesso) {
                        window.tipoExcecaoAtual = tipoVaga;
                        window.justificativaParaSalvar = dadosExcecao.justificativa;
                        window.bSalvarComoInativo = true;

                        await Swal.fire({
                            icon: 'success',
                            title: 'Solicitação Enviada!',
                            text: `A solicitação de Extra Bonificado para o dia ${dataFormatadaBR} foi gerada com sucesso.`,
                            confirmButtonText: 'Prosseguir'
                        });

                        //return escolhaModal;
                        return {
                            tipo: "SOLICITAR_EXTRA_BONIFICADO",
                            valor: escolhaModal,
                            idFuncaoFinal: null,
                            idOrcamentoFinal: idOrcamentoFinal,
                            nomeFuncao: nmFuncao,
                            setorVaga: "",
                            vlrCache: 0,
                            vlrAlimentacao: 0,
                            nivelSelecionado: null,
                            justificativa: dadosExcecao.justificativa
                        };
                    } else {
                        await Swal.fire('Erro!', `Não foi possível salvar a solicitação: ${resultado.erro}`, 'error');
                        return null;
                    }
                }
                return null;

            // } else {
            //     // Fluxo normal
            //     const vagaEscolhida = vagasBuscadas.find(v => 
            //         parseInt(v.idfuncao) === idFuncaoFinal && 
            //         parseInt(v.idorcamento) === idOrcamentoFinal
            //     );
                
            //     const setorVaga = vagaEscolhida ? (vagaEscolhida.setor || 'Geral / Sem Setor') : 'Geral / Sem Setor';
            //     const nomeVaga = vagaEscolhida ? vagaEscolhida.nmfuncao : nmFuncao;

            //     const { value: textoJustificativa } = await Swal.fire({
            //         title: 'Justificativa Obrigatória',
            //         html: `Informe o motivo da Diária Dobrada para o dia <b>${dataFormatadaBR}</b>:<br><small style="color:#777;">(Função: ${nomeVaga} | Orçamento: ${idOrcamentoFinal})</small>`,
            //         input: 'textarea',
            //         inputPlaceholder: 'Digite o motivo da virada ou cobertura de escala...',
            //         allowOutsideClick: false,
            //         inputValidator: (value) => {
            //             if (!value || !value.trim()) {
            //                 return 'Você precisa digitar uma justificativa para esta data!';
            //             }
            //         }
            //     });

            //     if (!textoJustificativa) return null;
                
            //     window.justificativaParaSalvar = `[Diária Dobrada ${dataFormatadaBR}] Consumiu vaga da função "${nomeVaga}" do setor "${setorVaga}" para cobrir virada. Justificativa: ${textoJustificativa.trim()}`.trim();
            //     window.tipoExcecaoAtual = "Vaga Reaproveitada";
                
            //     return escolhaModal;
            // }
            } else {
                // Fluxo normal - Função Selecionada
                const vagaEscolhida = vagasBuscadas.find(v => 
                    parseInt(v.idfuncao) === idFuncaoFinal && 
                    parseInt(v.idorcamento) === idOrcamentoFinal
                );
                
                const setorVaga = vagaEscolhida ? (vagaEscolhida.setor || 'Geral / Sem Setor') : 'Geral / Sem Setor';
                const nomeVaga = vagaEscolhida ? vagaEscolhida.nmfuncao : nmFuncao;

                // DEFINIÇÃO DO VALOR DO CACHÊ DA DOBRA POR NÍVEL
                let valorCacheDobraFinal = 0;
                let valorAlimentacaoFinal = 0;
                let nivelSelecionadoTexto = "Base";

                if (vagaEscolhida) {
                    const vBase = Number(vagaEscolhida.valor_base || 0);
                    const vJunior = Number(vagaEscolhida.valor_junior || 0);
                    const vPleno = Number(vagaEscolhida.valor_pleno || 0);
                    const vSenior = Number(vagaEscolhida.valor_senior || 0);
                    const vAlim = Number(vagaEscolhida.valor_alimentacao || 0); // 🚀 Captura a alimentação

                    valorAlimentacaoFinal = vAlim

                    // Se NÃO possui níveis cadastrados (Ex: Ajudante de Marcação)
                    if (vJunior === 0 && vPleno === 0 && vSenior === 0) {
                        valorCacheDobraFinal = vBase;
                        nivelSelecionadoTexto = "Único";
                    } else {
                        // Possui níveis (Ex: Analista de Projetos), pede para selecionar mostrando Cachê + Alimentação
                        // Possui níveis (Ex: Fiscal de Marcação), pede para selecionar mostrando Cachê + Alimentação
                        // Possui níveis (Ex: Fiscal de Marcação), pede para selecionar mostrando Cachê + Alimentação
                        const { value: nivelEscolhido } = await Swal.fire({
                            title: '<span style="font-size: 22px; font-weight: bold; color: #333;">Nível de Experiência</span>',
                            html: `
                                <p style="font-size: 14px; color: #666; margin-bottom: 15px;">
                                    Selecione o nível para a dobra em: <b style="color: #000;">${nomeVaga}</b>
                                </p>
                            `,
                            input: 'select',
                            inputOptions: {
                                'base': `Base - Cachê: R$ ${vBase.toFixed(2)} | Alim: R$ ${vAlim.toFixed(2)}`,
                                'junior': `Júnior - Cachê: R$ ${vJunior.toFixed(2)} | Alim: R$ ${vAlim.toFixed(2)}`,
                                'pleno': `Pleno - Cachê: R$ ${vPleno.toFixed(2)} | Alim: R$ ${vAlim.toFixed(2)}`,
                                'senior': `Sênior - Cachê: R$ ${vSenior.toFixed(2)} | Alim: R$ ${vAlim.toFixed(2)}`
                            },
                            inputPlaceholder: 'Selecione o nível...',
                            allowOutsideClick: false,
                            
                            // 🚀 CONFIGURAÇÃO DOS BOTÕES (CONFIRMAR E CANCELAR)
                            showCancelButton: true,
                            confirmButtonText: 'OK',
                            cancelButtonText: 'Cancelar',
                            confirmButtonColor: '#8B0000', // Vermelho escuro do seu sistema
                            cancelButtonColor: '#6C757D',  // Cinza padrão para cancelamento
                            
                            customClass: {
                                input: 'swal-select-customizado'
                            },
                            didOpen: () => {
                                // Ajusta a altura, o padding e remove o corte do texto interno do select
                                const selectElement = Swal.getInput();
                                if (selectElement) {
                                    selectElement.style.height = '42px';
                                    selectElement.style.padding = '6px 12px';
                                    selectElement.style.lineHeight = '1.5';
                                    selectElement.style.fontSize = '14px';
                                    selectElement.style.borderRadius = '6px';
                                    selectElement.style.boxShadow = 'none';
                                }
                            },
                            inputValidator: (value) => {
                                if (!value) return 'Você precisa selecionar um nível!';
                            }
                        });

                        // 🚀 TRATAMENTO CASO O USUÁRIO CLIQUE EM CANCELAR
                        // Se o usuário cancelar ou fechar o modal de nível, interrompemos o fluxo retornando null
                        if (nivelEscolhido === undefined) {
                            console.log("❌ Seleção de nível cancelada pelo usuário.");
                            return null;
                        }

                        if (nivelEscolhido === 'base') { valorCacheDobraFinal = vBase; nivelSelecionadoTexto = "Base"; }
                        if (nivelEscolhido === 'junior') { valorCacheDobraFinal = vJunior; nivelSelecionadoTexto = "Júnior"; }
                        if (nivelEscolhido === 'pleno') { valorCacheDobraFinal = vPleno; nivelSelecionadoTexto = "Pleno"; }
                        if (nivelEscolhido === 'senior') { valorCacheDobraFinal = vSenior; nivelSelecionadoTexto = "Sênior"; }
                    }
                    
                    // Guarda o valor da alimentação de forma global para a função de cálculo ler
                    window.vlrCacheDobraSelecionado       = valorCacheDobraFinal;
                    window.vlrAlimentacaoDobraSelecionado = valorAlimentacaoFinal;
                } else {
                    window.vlrAlimentacaoDobraSelecionado = 0;
                }

                // Guarda o valor do cachê descoberto na window
                window.vlrCacheDobraSelecionado = valorCacheDobraFinal;

                console.log(`🎯 [Dobra Definida] Função: ${nomeVaga} | Cachê: R$ ${window.vlrCacheDobraSelecionado} | Alimentação: R$ ${window.vlrAlimentacaoDobraSelecionado}`);

                // 🚀 Injeta o valor do Cachê e da Alimentação escolhidos no resumo antes da Justificativa
                const { value: textoJustificativa } = await Swal.fire({
                    title: 'Justificativa Obrigatória',
                    html: `
                        Informe o motivo da Diária Dobrada para o dia <b>${dataFormatadaBR}</b>:<br>
                        <small style="color:#555; display:block; margin-top:5px; background:#f8f9fa; padding:6px; border-radius:4px; border:1px solid #e9ecef;">
                            <b>Função:</b> ${nomeVaga} (${nivelSelecionadoTexto})<br>
                            <b>Cachê:</b> R$ ${valorCacheDobraFinal.toFixed(2)} | <b>Alimentação:</b> R$ ${window.vlrAlimentacaoDobraSelecionado.toFixed(2)}
                        </small>
                    `,
                    input: 'textarea',
                    inputPlaceholder: 'Digite o motivo da virada ou cobertura de escala...',
                    allowOutsideClick: false,
                    inputValidator: (value) => {
                        if (!value || !value.trim()) {
                            return 'Você precisa digitar uma justificativa para esta data!';
                        }
                    }
                });

                if (!textoJustificativa) return null;
                
                window.justificativaParaSalvar = `[Diária Dobrada ${dataFormatadaBR}] Consumiu vaga da função "${nomeVaga}" (${nivelSelecionadoTexto}) do setor "${setorVaga}" para cobrir virada. Justificativa: ${textoJustificativa.trim()}`.trim();
                window.tipoExcecaoAtual = "Vaga Reaproveitada";
                
                //return escolhaModal;
                return {
                    tipo: "ALOCACAO_NORMAL",
                    status: "Pendente", 
                    valor: escolhaModal,           // "48-331"
                    idFuncaoFinal: idFuncaoFinal,
                    idOrcamentoFinal: idOrcamentoFinal,
                    nomeFuncao: nomeVaga,          // ← nome já resolvido aqui dentro, correto
                    setorVaga: setorVaga,
                    vlrCache:         valorCacheDobraFinal,   // já existia
                    vlrAlimentacao:   valorAlimentacaoFinal,  // ← era window.vlrAlimentacaoDobraSelecionado, troca para local
                    nivelSelecionado: nivelSelecionadoTexto,
                    justificativa: textoJustificativa.trim()
                };

                // // SOLICITAR_ADITIVO
                // return {
                //     tipo: "SOLICITAR_ADITIVO",
                //     status: "Pendente",          // ← adicionar
                //     valor: escolhaModal,
                //     idFuncaoFinal: null,
                //     idOrcamentoFinal: idOrcamentoFinal,
                //     nomeFuncao: nmFuncao,
                //     setorVaga: "",
                //     vlrCache: 0,
                //     vlrAlimentacao: 0,
                //     nivelSelecionado: null,
                //     justificativa: dadosExcecao.justificativa
                // };

                // // SOLICITAR_EXTRA_BONIFICADO
                // return {
                //     tipo: "SOLICITAR_EXTRA_BONIFICADO",
                //     status: "Pendente",          // ← adicionar
                //     valor: escolhaModal,
                //     idFuncaoFinal: null,
                //     idOrcamentoFinal: idOrcamentoFinal,
                //     nomeFuncao: nmFuncao,
                //     setorVaga: "",
                //     vlrCache: 0,
                //     vlrAlimentacao: 0,
                //     nivelSelecionado: null,
                //     justificativa: dadosExcecao.justificativa
                // };
            }
        
        
        } else {
            console.log("❌ Operação cancelada pelo usuário no modal de dobra.");
            return null;
        }
    } catch (error) {
        console.error("Erro ao carregar mapa de vagas ou abrir seletor de função:", error);
        Swal.fire("Erro", "Ocorreu um problema ao processar as vagas do orçamento.", "error");
        return null;
    }
}

async function solicitarDadosExcecao(tipo, idOrcamentoAtual, nmFuncao, idFuncao, idFuncionario, dataEspecifica) { 

    console.log("Iniciando solicitação de exceção com os seguintes parâmetros:", {tipo, idOrcamentoAtual, nmFuncao, idFuncao, idFuncionario, dataEspecifica});
    
    const mapaTipos = {
        "ADITIVO - DATA FORA DO ORÇAMENTO": "Aditivo - Datas fora do Orçamento",
        //"ADITIVO - DATAS FORA DO ORÇAMENTO": "Aditivo - Datas fora do Orçamento",
        "ADITIVO - VAGA EXCEDIDA": "Aditivo - Vaga Excedida",
        "EXTRA BONIFICADO - DATA FORA DO ORÇAMENTO": "Extra Bonificado - Datas fora do Orçamento",
        //"EXTRA BONIFICADO - DATAS FORA DO ORÇAMENTO": "Extra Bonificado - Datas fora do Orçamento",
        "EXTRA BONIFICADO - VAGA EXCEDIDA": "Extra Bonificado - Vaga Excedida"
    };

    // Tenta encontrar no mapa usando caixa alta, se não achar, usa o que veio
    const tipoPadronizado = mapaTipos[tipo.toUpperCase().trim()] || tipo;

    console.log("Tipo original:", tipo, "-> Tipo Padronizado:", tipoPadronizado);
    prefixoSolicitacao = `[SOLICITAÇÃO - ${tipoPadronizado}]`;
    
    console.log("Solicitando dados de exceção para:", {
        tipo: tipoPadronizado,
        idOrcamentoAtual,
        nmFuncao,
        idFuncao,
        idFuncionario,
        dataEspecifica
    });
    // 1. Prioridade para a data vinda do Flatpickr
    const campoData = document.getElementById('periodoEvento');
   

    //let dataReal = "";
    let listaDatas = [];

    // 1. PRIORIDADE: Se passamos uma data específica (ex: 11/04), usamos essa!
    // if (Array.isArray(dataEspecifica) && dataEspecifica.length > 0) {
    //     // Pega a primeira data do array de conflito
    //     dataReal = dataEspecifica[0]; 
    // } 
    // else if (typeof dataEspecifica === 'string' && dataEspecifica.length > 5) {
    //     dataReal = dataEspecifica;
    // }
    // // 2. FALLBACK: Só olha para o calendário se não houver data específica
    // else {
    //     const campoData = document.getElementById('periodoEvento');
    //     if (campoData && campoData._flatpickr && campoData._flatpickr.selectedDates.length > 0) {
    //         dataReal = campoData._flatpickr.selectedDates[0].toLocaleDateString('en-CA');
    //     }
    // }


    if (Array.isArray(dataEspecifica) && dataEspecifica.length > 0) {
        listaDatas = dataEspecifica.map(d => d.includes('T') ? d.split('T')[0] : d);
    } 
    else if (typeof dataEspecifica === 'string' && dataEspecifica.length > 5) {
        listaDatas = [dataEspecifica.includes('T') ? dataEspecifica.split('T')[0] : dataEspecifica];
    }

    // Garante que não leva o horário (T03:00...) se vier do banco
   // if (dataReal.includes('T')) dataReal = dataReal.split('T')[0];

    // Se ainda assim não tiver data, avisa o usuário em vez de chutar "hoje"
    if (!dataReal) {
        console.warn("⚠️ Nenhuma data selecionada no Flatpickr.");
        return Swal.fire({
            icon: 'error',
            title: 'Data não informada',
            text: 'Por favor, selecione uma data válida para o ajuste antes de salvar.',
            confirmButtonColor: '#3085d6'
        });
    }

    // 2. Formata para o padrão brasileiro DD/MM/YYYY
   // const dataFormatada = dataReal.split('-').reverse().join('/'); 
   listaDatas = [...new Set(listaDatas)].sort();

    const datasFormatadasExibicao = listaDatas
        .map(d => d.split('-').reverse().join('/'))
        .join(', ');
    
    // ... segue para o seu Swal.fire usando a dataFormatada ...
    console.log("📅 Data utilizada no formulário:", dataFormatada);

    // const { value: formValues, isConfirmed } = await Swal.fire({
    //     title: `Solicitar ${tipo}`,
    //     html: `
    //         <div style="margin-bottom: 10px;"><b>Data:</b> ${dataFormatada}</div>
    //         <div style="margin-bottom: 10px;"><b>Função:</b> ${nmFuncao}</div>
    //         <textarea id="swal-justificativa" class="swal2-textarea" placeholder="Justificativa para esta data (obrigatório)"></textarea>`,
    //     showCancelButton: true,
    //     confirmButtonText: 'Enviar Solicitação',
    //     cancelButtonText: 'Cancelar Solicitação',
    //     preConfirm: () => {
    //         const justificativa = document.getElementById('swal-justificativa').value;
    //         if (!justificativa.trim()) {
    //             Swal.showValidationMessage('A justificativa é obrigatória.');
    //             return false;
    //         }
    //         return { justificativa: justificativa };
    //     }
    // });
    const { value: formValues, isConfirmed } = await Swal.fire({
        title: `Solicitar ${tipo}`,
        html: `
            <div style="margin-bottom: 10px;"><b>Data:</b> ${dataFormatada}</div>
            <div style="margin-bottom: 10px;"><b>Função:</b> ${nmFuncao}</div>
            <textarea id="swal-justificativa" class="swal2-textarea" placeholder="Justificativa para esta data (obrigatório)"></textarea>`,
        showCancelButton: true,
        confirmButtonText: 'Enviar Solicitação',
        cancelButtonText: 'Cancelar Solicitação',
        preConfirm: () => {
            const justificativa = document.getElementById('swal-justificativa').value;
            if (!justificativa.trim()) {
                Swal.showValidationMessage('A justificativa é obrigatória.');
                return false;
            }
            return { justificativa: justificativa };
        }
    });

    if (isConfirmed && formValues) {
        // const resultado = await salvarSolicitacaoAditivoExtra(
        //     idOrcamentoAtual, 
        //     idFuncao,             
        //     1, // Qtd é sempre 1 por registro de data
        //     tipoPadronizado, 
        //     formValues.justificativa, 
        //     idFuncionario,
        //     dataReal // 🎯 NOVO PARÂMETRO
        // );

        
        // if (resultado.sucesso) {
        //     // 🎯 TRATAMENTO ESPECÍFICO PARA DATAS FORA DO ORÇAMENTO
        //     if (tipo.includes("Data fora do Orçamento")) {
                
        //         // 1. Removemos as datas excedentes do Flatpickr
        //         if (window.datasEventoPicker) {
        //             const todasDatas = window.datasEventoPicker.selectedDates.map(d => d.toISOString().split('T')[0]);
                         
        //             await Swal.fire({
        //                 icon: 'success',
        //                 title: 'Solicitação Enviada!',
        //                 html: `Sua solicitação de <b>${tipoPadronizado}</b> foi registrada.<br><br>` +
        //                       `<span style="color: #d33">Importante:</span> As datas fora do orçamento foram removidas da sua seleção atual e só poderão ser usadas após a aprovação.`,
        //                 confirmButtonText: 'OK'
        //             });
        //         }
        //     } else {
        //         // Mensagem padrão para Vagas Excedidas ou outros tipos
        //         await Swal.fire({
        //             icon: 'success',
        //             title: 'Solicitação Enviada!',
        //             text: `Sua solicitação de ${tipoPadronizado} foi registrada com sucesso.`,
        //             confirmButtonText: 'OK'
        //         });
        //     }
        // }
        // else {
        //     await Swal.fire({
        //         icon: 'error',
        //         title: 'Falha na Solicitação',
        //         text: resultado.erro || 'Ocorreu um erro ao salvar.',
        //         confirmButtonText: 'Entendido'
        //     });
        // }

        // return resultado; // Mantém o retorno original para quem chamou a função

        return { //para testar o salvar do staff com status inativo antes das solicitações de exceção
            confirmado: true, 
            solicitouAutorizacao: true,
            justificativa: formValues.justificativa,
            tipoPadronizado: tipoPadronizado,
            dataConflito: dataReal 
        };

    }
     //para testar o salvar do staff com status inativo antes das solicitações de exceção
     console.log("❌ Usuário cancelou o Swal");
    return { confirmado: false, solicitouAutorizacao: false };
    
}



window.solicitarDadosExcecao = solicitarDadosExcecao;

function getPeriodoEvento(datas) {
    if (!Array.isArray(datas) || datas.length === 0) {
        return { dtInicio: null, dtFim: null };
    }

    // 1. Cria uma cópia e ordena as datas (a ordenação alfabética funciona para YYYY-MM-DD)
    const datasOrdenadas = [...datas].sort();

    // 2. Define a função auxiliar para formatar para o frontend
    const formatarDataParaFrontend = (dataStr) => {
        // Assume o formato 'YYYY-MM-DD'
        const [ano, mes, dia] = dataStr.split('-');
        return `${dia}/${mes}/${ano}`;
    };

    // 3. Pega a primeira e a última data e formata
    const dtInicio = formatarDataParaFrontend(datasOrdenadas[0]);
    const dtFim = formatarDataParaFrontend(datasOrdenadas[datasOrdenadas.length - 1]);

    // 4. Retorna o objeto esperado
    return { dtInicio, dtFim };
}


//atualizado em 29/01 para tratar aditivo/extra bonificado
async function verificarStatusAditivoExtra(idOrcamentoAtual, idFuncaoDoFormulario, tipoSolicitacao, idFuncionario, nmFuncionario, nmFuncao, dataEspecifica, idEventoSolicitado, idEventoConflitante, conflitosReaisParam) {
    
    // 🔍 LOG DE DEPURAÇÃO MELHORADO
    console.log("Valores recebidos:", { idOrcamentoAtual, idFuncaoDoFormulario, idFuncionario, nmFuncionario });

    if (!idOrcamentoAtual || !idFuncaoDoFormulario) {
        console.warn("⚠️ Abortando verificação: ID do Orçamento ou da Função está faltando.");
        return { bloqueado: false }; 
    }
    
    // 🛡️ LIMPEZA RIGOROSA: Impede que a string "undefined" vá para a URL
  //  const cleanIdFunc = (idFuncionario && idFuncionario !== 'undefined' && idFuncionario !== 'null') ? idFuncionario : null;
  //  const cleanNmFunc = (nmFuncionario && nmFuncionario !== 'undefined' && nmFuncionario !== 'null') ? nmFuncionario : null;
    const dataLimpa = (dataEspecifica && dataEspecifica !== 'undefined' && dataEspecifica !== '') ? dataEspecifica : null;
    
    // ADICIONAR:
    const eventoSolicitadoLimpo = (idEventoSolicitado && idEventoSolicitado !== 'undefined') ? idEventoSolicitado : null;
    const eventoConflitanteLimpo = (idEventoConflitante && idEventoConflitante !== 'undefined') ? idEventoConflitante : null;

    const params = new URLSearchParams({
        idOrcamento: idOrcamentoAtual,
        idFuncao: idFuncaoDoFormulario,
        tipoSolicitacao: tipoSolicitacao
        
    });
    
    if (dataLimpa) params.append('dataSolicitada', dataLimpa);
   // if (cleanIdFunc) params.append('idFuncionario', cleanIdFunc);
    // Sempre enviamos o funcionário se ele existir, para garantir a precisão do "Data fora"
    if (idFuncionario) {
        params.append('idFuncionario', idFuncionario);
    }

    // ADICIONAR:
    if (eventoSolicitadoLimpo) params.append('idEventoSolicitado', eventoSolicitadoLimpo);
    if (eventoConflitanteLimpo) params.append('idEventoConflitante', eventoConflitanteLimpo);
    
    // 🏷️ 2. FORMATAR MENSAGEM (O "Cérebro" do seu novo padrão de leitura)
    
    // const formatarMensagemPersonalizada = (tipo, nmFuncaoInput) => {
    //     let textoBase = `<strong>"${tipo}"</strong>`;
    //     let statusTexto = `<strong style="color: #ffc107;">"PENDENTE"</strong>`;
    //     let funcaoTexto = `<strong>${nmFuncaoInput || 'Não informada'}</strong>`;

    //     return { textoBase, statusTexto, funcaoTexto };
    // };

    try {       
        const url = `/staff/aditivoextra/verificar-status?${params.toString()}`;
        console.log(`Buscando status em: ${url}`);
        const response = await fetchComToken(url, {});

        if (!response || response.sucesso === false) {
            console.error("Erro na resposta do servidor:", response?.erro);
            return { bloqueado: false, erroServidor: true };
        }

        //const { solicitacaoRecente, autorizadoEspecifico, totaisFuncao } = response.dados;

        const { solicitacaoRecente, solicitacaoDuplicada, autorizadoEspecifico, totaisFuncao } = response.dados;

        console.log("🔍 [Frontend FuncExcedido] solicitacaoDuplicada:", solicitacaoDuplicada);
        console.log("🔍 [Frontend FuncExcedido] solicitacaoRecente:", solicitacaoRecente);
        console.log("🔍 [Frontend FuncExcedido] autorizadoEspecifico:", autorizadoEspecifico);

        // 🎯 AJUSTE NA MENSAGEM: 
        // Se houver uma solicitação no banco, usamos o tipo real dela (ex: "ADITIVO - DATA FORA...")
        // Se não, usamos o tipo que veio no parâmetro da função.
        const tipoExibicao = solicitacaoRecente ? solicitacaoRecente.tiposolicitacao : tipoSolicitacao;

        const formatarMensagemPersonalizada = (tipo, nmFuncaoInput) => {
            // 🎯 TRATAMENTO DO NOME TÉCNICO PARA NOME AMIGÁVEL
            let nomeExibicao = tipo;
            
            if (tipo && tipo.includes('FuncExcedido')) {
                nomeExibicao = "Limite de Funções Excedido";
            }

            let textoBase = `<strong>"${nomeExibicao}"</strong>`;
            //let statusTexto = `<strong style="color: #ffc107;">"PENDENTE"</strong>`;
            let statusPendente = `<strong style="color: #ffc107;">"PENDENTE"</strong>`;
            let statusAutorizado = `<strong style="color: #007bff;">"AUTORIZADO"</strong>`;
            let funcaoTexto = `<strong>${nmFuncaoInput || 'Não informada'}</strong>`;
            
            return { textoBase, statusPendente, statusAutorizado, funcaoTexto, nomeLimpo: nomeExibicao };
        };

        const infoMsg = formatarMensagemPersonalizada(tipoExibicao, nmFuncao);

  
            // --- 1. CASO AUTORIZADO ESPECÍFICO ---
            // if (autorizadoEspecifico) {
            //     // 🎯 Simplificamos a lógica aqui usando o nome já tratado
            //     const mensagemFinal = `Autorização de ${infoMsg.textoBase} detectada.`;

            //     // Variável global para controle de liberação

            //     bLiberacaoAutorizada = true;
            //     console.log("RESPOSTA DA LIBERACAO ESPECÍFICA:", autorizadoEspecifico, bLiberacaoAutorizada);
            //     await Swal.fire({
            //         icon: 'success',
            //         title: 'Liberação Detectada!',
            //         html: `${mensagemFinal}<hr><div style="color: #28a745;">O cadastro do funcionário está liberado.</div>`,
            //         timer: 3000,
            //         showConfirmButton: false
            //     });
            //     return { bloqueado: false, autorizado: true };
                
            // }

        
            // // --- 2. CASO PENDENTE (Bloqueio) ---
            // // Se você tiver a parte de "Em Análise", use o infoMsg.textoBase também
            // if (solicitacaoRecente && (solicitacaoRecente.status === 'Pendente' || solicitacaoRecente.status === 'Em Análise')) {
            //     await Swal.fire({
            //         icon: 'info',
            //         title: 'Solicitação em Análise',
            //         html: `Já existe uma solicitação de ${infoMsg.textoBase} para esta função.<br><br>` +
            //             `Aguarde a aprovação para prosseguir.`,
            //         confirmButtonText: 'Entendido'
            //     });
            //     return { bloqueado: true };
            // }    
            
        // --- 0. CASO EXCLUSIVO FuncExcedido ---
        if (tipoSolicitacao === 'FuncExcedido') {

            // 🌟 SUB-CASO NOVO: Interceptação por statusstaff "Pendente" nos conflitos reais recebidos
            if (Array.isArray(conflitosReaisParam) && conflitosReaisParam.length > 0) {
                const temAgendamentoPendente = conflitosReaisParam.find(c => c.statusstaff && String(c.statusstaff).toLowerCase() === 'pendente');
                
                if (temAgendamentoPendente) {
                    const nomeEvConflito = temAgendamentoPendente.nmevento || 'Evento informado';
                    const datasTexto = Array.isArray(temAgendamentoPendente.datasevento) 
                        ? temAgendamentoPendente.datasevento.map(d => new Date(d).toLocaleDateString('pt-BR')).join(', ')
                        : 'não informadas';

                    await Swal.fire({
                        icon: 'warning',
                        title: 'Agendamento Pendente de Aprovação!',
                        html: `A data conflitante escolhida já possui um agendamento com status <strong>PENDENTE</strong> de aprovação para <strong>${nmFuncionario}</strong> no evento <strong>${nomeEvConflito}</strong>.<br><br>
                               ` +
                              `Por favor, aguarde a autorização deste agendamento antes de tentar realizar uma nova solicitação para o mesmo período.`,
                        confirmButtonText: 'Entendido'
                    });
                    
                    return { bloqueado: true, status: 'Pendente' };
                }
            }

            // CASO A: Solicitação IDÊNTICA → BLOQUEAR
            if (solicitacaoDuplicada) {
                // Formatar datas do registro duplicado
                const datasConflito = Array.isArray(solicitacaoDuplicada.dtsolicitada) 
                    ? solicitacaoDuplicada.dtsolicitada
                        .filter(d => d)
                        .map(d => new Date(d).toLocaleDateString('pt-BR'))
                        .join(', ')
                    : 'não informadas';

                const nomeEvento = solicitacaoDuplicada.nmeventosolicitado || 'mesmo evento';

                await Swal.fire({
                    icon: 'error',
                    title: 'Solicitação já existe!',
                    html: `Já existe uma solicitação <strong>PENDENTE</strong> para 
                        <strong>${nmFuncionario}</strong> no evento <strong>${nomeEvento}</strong>
                        para a(s) data(s): <strong>${datasConflito}</strong>.<br><br>
                        Aguarde a aprovação ou rejeição antes de fazer nova solicitação.`,
                    confirmButtonText: 'Entendido'
                });
                return { bloqueado: true };
            }

            // CASO B: Autorizado para este evento específico → LIBERAR
            if (autorizadoEspecifico) {
                bLiberacaoAutorizada = true;
                await Swal.fire({
                    icon: 'success',
                    title: 'Liberação Detectada!',
                    html: `Autorização de <strong>"Limite Diário Excedido"</strong> detectada.<br>
                        <hr><div style="color: #28a745;">O cadastro do funcionário está liberado.</div>`,
                    timer: 3000,
                    showConfirmButton: false
                });
                return { bloqueado: false, autorizado: true };
            }
            
            

            // CASO C: Pendente em outro evento na mesma data → AVISAR e perguntar
            if (solicitacaoRecente && solicitacaoRecente.status === 'Pendente') {
                const nomeEventoPendente = solicitacaoRecente.nmeventosolicitado || 'outro evento';
                const datasConflito = Array.isArray(solicitacaoRecente.dtsolicitada)
                    ? solicitacaoRecente.dtsolicitada
                        .filter(d => d)
                        .map(d => new Date(d).toLocaleDateString('pt-BR'))
                        .join(', ')
                    : 'não informadas';

                const result = await Swal.fire({
                    icon: 'warning',
                    title: 'Solicitação Pendente em Outro Evento!',
                    html: `Já existe uma solicitação <strong>PENDENTE</strong> para 
                        <strong>${nmFuncionario}</strong> no evento <strong>${nomeEventoPendente}</strong>
                        na(s) data(s): <strong>${datasConflito}</strong>.<br><br>
                        Deseja fazer uma nova solicitação para o evento atual mesmo assim?`,
                    showCancelButton: true,
                    confirmButtonText: 'Sim, fazer nova solicitação',
                    cancelButtonText: 'Não, cancelar'
                });
                if (!result.isConfirmed) return { bloqueado: true };
                return { bloqueado: false, encontrado: true, status: 'Pendente' };
            }

            // CASO D: Nada encontrado → continua normalmente
            return { 
                bloqueado: false, 
                encontrado: solicitacaoRecente !== null,
                status: solicitacaoRecente?.status || null,
                detalhes: solicitacaoRecente
            };
        }

        // ← daqui para baixo só chega para outros tipos (Aditivo, Extra, Data Fora)
        if (!solicitacaoRecente && !autorizadoEspecifico) {
                console.log("ℹ️ Nenhuma solicitação prévia encontrada. Retornando ao fluxo principal.");
                return { 
                    bloqueado: false, 
                    encontrado: false, 
                    autorizado: false 
                };
        }
        
        // --- 1. CASO AUTORIZADO ESPECÍFICO ---
        if (autorizadoEspecifico) {
            const mensagemFinal = `Autorização de ${infoMsg.textoBase} detectada.`;
            bLiberacaoAutorizada = true;
            console.log("RESPOSTA DA LIBERACAO ESPECÍFICA:", autorizadoEspecifico, bLiberacaoAutorizada);
            await Swal.fire({
                icon: 'success',
                title: 'Liberação Detectada!',
                html: `${mensagemFinal}<hr><div style="color: #28a745;">O cadastro do funcionário está liberado.</div>`,
                timer: 3000,
                showConfirmButton: false
            });
            return { bloqueado: false, autorizado: true };
        }

        // --- 2. CASO PENDENTE (Bloqueio) ---
        if (solicitacaoRecente && (solicitacaoRecente.status === 'Pendente' || solicitacaoRecente.status === 'Em Análise')) {
            await Swal.fire({
                icon: 'info',
                title: 'Solicitação em Análise',
                html: `Já existe uma solicitação de ${infoMsg.textoBase} para esta função.<br><br>` +
                    `Aguarde a aprovação para prosseguir.`,
                confirmButtonText: 'Entendido'
            });
            return { bloqueado: true };
        }       
        
        // --- 2. TRATAMENTO DE SOLICITAÇÃO EXISTENTE (PENDENTE/REJEITADA) ---
        if (solicitacaoRecente) {
            const status = solicitacaoRecente.status;   
            const nmFuncionarioDono = solicitacaoRecente.nmfuncionariodono || "Outro funcionário";
            const mesmaPessoa = idFuncionario == solicitacaoRecente.idfuncionario;         

            // 🛑 CASO PENDENTE
            if (status === 'Pendente' || status === 'Em Análise') {                
                let mensagemHtml;

                if (mesmaPessoa) {
                    mensagemHtml = `Você já tem uma solicitação de ${infoMsg.textoBase} com status ${infoMsg.statusPendente} ` +
                                   `para a função de ${infoMsg.funcaoTexto} para esse mesmo Funcionário: <strong>"${nmFuncionarioDono}"</strong>` +
                                   `<hr>` +                                
                                   `<strong>Aguarde a análise do gestor</strong> antes de tentar realizar o cadastro novamente.`;
                } else {
                    mensagemHtml = `Já existe uma solicitação de ${infoMsg.textoBase} com status ${infoMsg.statusPendente}, ` +
                                   `para a função de ${infoMsg.funcaoTexto}, solicitada para <strong>"${nmFuncionarioDono}"</strong>.` +
                                   `<hr>` +
                                   `Funcionário Atual: <strong>${nmFuncionario || 'Não informado'}</strong><br><br>` +
                                   `<strong>Atenção:</strong> Como a vaga é a mesma, aguarde a decisão do gestor para este funcionário anterior.`;
                }

                await Swal.fire({
                    icon: 'warning',
                    title: 'Solicitação em Análise!',
                    html: mensagemHtml,
                    confirmButtonText: 'Entendido'
                });
                
                return { bloqueado: true, status: 'Pendente' };
            }

            // ✅ CASO AUTORIZADO / APROVADO (Para outra pessoa)
            if (status === 'Autorizado' || status === 'Aprovado') {
                const result = await Swal.fire({
                    icon: 'info',
                    title: 'Vaga Ocupada por Outra Autorização',
                    html: `Já existe uma solicitação de ${infoMsg.textoBase} <strong>AUTORIZADA</strong>, ` +
                        `porém para o funcionário <strong>"${nmFuncionarioDono}"</strong>.` +
                        `<hr>` +
                        `Deseja solicitar uma <strong>nova autorização</strong> para o funcionário atual?`,
                    showCancelButton: true,
                    confirmButtonText: 'Sim, Solicitar Nova',
                    cancelButtonText: 'Não, Cancelar'
                });

                if (!result.isConfirmed) return { bloqueado: true, status: 'Autorizado' };
            }

            // ❌ CASO REJEITADO
            if (status === 'Rejeitado' || status === 'Reprovado') {
                const result = await Swal.fire({
                    icon: 'error',
                    title: 'Solicitação Rejeitada!',
                    html: `A última solicitação de ${infoMsg.textoBase} para a função de ${infoMsg.funcaoTexto} foi <strong>REJEITADA</strong>.` +
                        `<hr>` +
                        `Deseja tentar enviar uma <strong>nova justificativa</strong> para o funcionário atual?`,
                    showCancelButton: true,
                    confirmButtonText: 'Sim, Tentar Novamente',
                    cancelButtonText: 'Não, Cancelar'
                });
                
                if (!result.isConfirmed) return { bloqueado: true, status: 'Rejeitado' };
            }
        }

        // --- Etapa 2: Validação de Limites (Apenas se não for Data Fora, pois data não ocupa vaga) ---
        // if (totaisFuncao && !tipoSolicitacao.includes("Data fora")) {
        //     // ... sua lógica de limiteMaximo que já está funcional ...
        //     // (Mantenha o código que você já tem aqui)
        // }
        if (totaisFuncao) {
            const { totalOrcado, totalAditivoAprovado, totalExtraAprovado, totalVagasPreenchidas } = totaisFuncao;
            
            // ⚠️ CÁLCULO CORRIGIDO: Limite é a soma do Orçado + Aditivos Aprovados
            const limiteTotalAprovado = totalOrcado + totalAditivoAprovado + totalExtraAprovado;

            let limiteMaximo;
            
            // Define o limite com base no tipo de solicitação (ou no limite total se for FuncExcedido)
            if (tipoSolicitacao === 'Aditivo') {
                // Se estamos solicitando Aditivo, o limite é o orçado + Aditivos Aprovados (Exclui o Extra se for separado)
                limiteMaximo = totalOrcado + totalAditivoAprovado; 
            } else if (tipoSolicitacao === 'Extra') {
                // Se estamos solicitando Extra, o limite é o orçado + Extras Aprovados (Exclui o Aditivo se for separado)
                limiteMaximo = totalOrcado + totalExtraAprovado; 
            } else if (tipoSolicitacao === 'FuncExcedido') {
                // 🎯 NOVO TRATAMENTO: FuncExcedido deve respeitar o limite MÁXIMO (todos os aprovados)
                limiteMaximo = limiteTotalAprovado; 
            } else {
                 limiteMaximo = totalOrcado; // Default para segurança
            }

            // Verifica se as vagas aprovadas (Limite Máximo) já foram preenchidas
            if (totalVagasPreenchidas >= limiteMaximo) {
                
                const vagasDisponiveis = limiteMaximo - totalVagasPreenchidas;
                
                const result = await Swal.fire({
                    title: `Confirmação da Solicitação de ${tipoSolicitacao}!`,
                    // Garante que o tipoSolicitacao seja usado na mensagem
                    html: `A(s) <strong>${limiteMaximo} vaga(s)</strong> (Orçado + Aprovados) para esta função já foram preenchidas (${totalVagasPreenchidas} staff alocados). <br><br> Confirma solicitação um <strong>novo ${tipoSolicitacao}</strong>?`,
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'Sim, Solicitar Mais',
                    cancelButtonText: 'Não, Cancelar'
                });

                if (!result.isConfirmed) {
                    return false; // BLOQUEADO
                }
            }
        }
        
        
        return {
            encontrado: solicitacaoRecente !== null,
            status: solicitacaoRecente ? solicitacaoRecente.status : null,
            detalhes: solicitacaoRecente,
            totaisFuncao: totaisFuncao
        };
        
        //return { bloqueado: false, detalhes: solicitacaoRecente };

    } catch (error) {
        console.error("Erro na verificação de status:", error);
        //return { bloqueado: true };
        return { bloqueado: false, falhaCritica: true };
    }
}

window.verificarStatusAditivoExtra = verificarStatusAditivoExtra; // Torna acessível


async function salvarSolicitacaoAditivoExtra(idOrcamentoAtual, idFuncaoDoFormulario, qtd, tipo, justificativa, idFuncionario, dataSolicitada, idEventoSolicitado, idEventoConflitante, idStaffCriado) {
   
    const tipoPadronizado = tipo ? tipo.toUpperCase().trim() : "";
    const quantidadeGarantida = (qtd && qtd > 0) ? qtd : 1;
    const datasFormatadas = Array.isArray(dataSolicitada) ? dataSolicitada.join(',') : dataSolicitada;
    const idStaffEventoFinal = idStaffCriado || document.querySelector("#idStaffEvento")?.value;

     console.log("AJAX: Tentando salvar solicitação:", { idOrcamentoAtual, idFuncaoDoFormulario, qtd, tipo, justificativa, idFuncionario, dataSolicitada, idStaffEventoFinal });

    // Objeto de dados a ser enviado
    const dadosParaEnvio = { 
        idOrcamento: idOrcamentoAtual, 
        idFuncao: idFuncaoDoFormulario,
        qtdSolicitada: quantidadeGarantida, 
        tipoSolicitacao: tipoPadronizado, 
        categoria_log: "aditivoextra", 
        idregistroalterado: idStaffEventoFinal,
        justificativa,
        idFuncionario: idFuncionario || null,
        dataSolicitada: datasFormatadas,
       // datasolicitada: Array.isArray(dataSolicitada) ? dataSolicitada[0] : dataSolicitada, // Para bater com o nome da coluna no banco
        idEventoSolicitado: idEventoSolicitado,
        idEventoConflitante: idEventoConflitante
    };

    console.log("DADOS QUE SERÃO ENVIADOS AO SERVIDOR:", JSON.stringify(dadosParaEnvio));
    Swal.showLoading();
    try {
        const data = await fetchComToken('/staff/aditivoextra/solicitacao', {
            method: 'POST',
            // 🎯 CORREÇÃO 1: Adicionar o Content-Type
            headers: { 
                'Content-Type': 'application/json' 
            },
            // 🎯 CORREÇÃO 2: Converter o objeto para string JSON
            body: JSON.stringify(dadosParaEnvio)
        });
        
        // Se fetchComToken já retorna o JSON parseado:
        if (data && data.sucesso) { 
            return { sucesso: true, idAditivoExtra: data.idAditivoExtra }; 
        } else {
            console.error('Erro lógico do backend:', data);
            // Captura erros de validação do backend (400, 500 etc) se fetchComToken não lançar exceção
            return { sucesso: false, erro: data ? data.erro : 'Erro desconhecido.' };
        }
        
    } catch (error) {
        // 3. CAPTURA ERROS de rede ou exceções lançadas por fetchComToken em status 4xx/5xx
        console.error('Erro de rede/código ao salvar solicitação. O erro foi gerado por fetchComToken:', error);
        //return { sucesso: false, erro: 'Falha na comunicação com o servidor.' };
        return { 
            sucesso: false, 
            erro: error.message || 'Erro de comunicação desconhecido.' 
        };
    }
}

function limparCamposComprovantes() {

    preencherComprovanteCampo(null, 'Cache');
    preencherComprovanteCampo(null, 'AjdCusto');
    preencherComprovanteCampo(null, 'AjdCusto2');
    preencherComprovanteCampo(null, 'Caixinha');
    preencherComprovanteCampo(null, 'ControleGastos');

    const mainFileInput = document.getElementById('file');
    if (mainFileInput) {
        mainFileInput.value = '';
        const mainFileNameSpan = document.getElementById('fileName');

        const mainUploadHeader = document.getElementById('uploadHeader');

        if (mainFileNameSpan) mainFileNameSpan.textContent = "Nenhum arquivo selecionado";
       
        if (mainUploadHeader) mainUploadHeader.style.display = "block";
    }
}

function limparFoto() {
    const mainPreviewFoto = document.getElementById('previewFoto');
    if (mainPreviewFoto) {
        mainPreviewFoto.src = "#";
        mainPreviewFoto.style.display = "none";
    }
}

function processarGeracaoFicha(tipo, dataMin, dataMax) {
    const linhas = document.querySelectorAll('#eventsDataTable tbody tr');
    const eventosFiltrados = [];
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    console.log("Iniciando filtragem...", { tipo, hoje });

    linhas.forEach((linha, index) => {
        const celulas = linha.cells;
        if (celulas.length < 10) return;

        // --- MAPA DE ÍNDICES CONFORME SEU CONSOLE ---
        const evento = celulas[3].innerText.trim();
        const textoDatas = celulas[7].innerText.trim();

        // 1. Tratamento das Datas (Lida com "20/01/2026, 21/01/2026" ou formato ISO)
        let datasObj = [];
        const partes = textoDatas.split(/[\s,]+/); // Quebra por vírgula ou espaço
        
        partes.forEach(p => {
            if (p.includes('/')) {
                // Formato DD/MM/AAAA
                const [d, m, a] = p.split('/');
                datasObj.push(new Date(a, m - 1, d));
            } else if (p.includes('-')) {
                // Formato ISO YYYY-MM-DD
                datasObj.push(new Date(p));
            }
        });

        datasObj.sort((a, b) => a - b);
        if (datasObj.length === 0) return;

        const ultimaDataEvento = datasObj[datasObj.length - 1];
        ultimaDataEvento.setHours(0, 0, 0, 0);

        let incluir = false;

        if (tipo === 'todos') incluir = true;
        else if (tipo === 'a_realizar') {
            if (ultimaDataEvento >= hoje) incluir = true;
        } else if (tipo === 'realizados') {
            if (ultimaDataEvento < hoje) {
                if (dataMin && dataMax) {
                    if (ultimaDataEvento >= dataMin && ultimaDataEvento <= dataMax) incluir = true;
                } else {
                    incluir = true;
                }
            }
        }

        if (incluir) {
            eventosFiltrados.push({
                funcao: celulas[0].innerText,
                cliente: celulas[2].innerText,
                evento: evento,
                local: celulas[4].innerText,
                periodo: textoDatas,
                valorTotal: celulas[25].innerText
            });
        }
    });

    console.log("Eventos encontrados após filtro:", eventosFiltrados.length);

    if (eventosFiltrados.length > 0) {
        const titulosFiltro = {
            'todos': 'Relatório Geral de Eventos',
            'a_realizar': 'Relatório de Eventos a Realizar (Futuros)',
            'realizados': 'Relatório de Eventos Realizados (Concluídos)'
        };
        gerarPdfFichaTrabalho(eventosFiltrados, titulosFiltro[tipo]);
    } else {
        Swal.fire('Ops!', 'Nenhum evento corresponde aos critérios.', 'info');
    }
}


async function gerarPdfFichaTrabalho(eventos, nomeFiltro) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const dataGeracao = new Date().toLocaleDateString('pt-BR');
    const selectFuncionario = document.getElementById("nmFuncionario");
    const nomeFuncionario = selectFuncionario?.options[selectFuncionario.selectedIndex]?.textContent.trim().toUpperCase() || "PROFISSIONAL NÃO IDENTIFICADO";

    // --- CABEÇALHO ---
    doc.setFontSize(16); doc.setFont("helvetica", "bold");
    doc.text("FICHA DE TRABALHO - STAFF", 14, 15);
    doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(100);
    doc.text(`Filtro: ${nomeFiltro}`, 14, 22);
    doc.text(`Profissional: ${nomeFuncionario}`, 14, 27);
    doc.text(`Gerado em: ${dataGeracao}`, 196, 15, { align: 'right' });

    const colunas = ["Informações do Evento", "Detalhes da Vaga"];
    
    const linhasCorpo = eventos.map(ev => {
        const partes = ev.periodo.split(/[\s,]+/);
        const datasObj = partes.map(p => {
            const [d, m, a] = p.split('/');
            return new Date(a, m - 1, d);
        }).sort((a, b) => a - b);
        const ultimaData = datasObj[datasObj.length - 1];
        const estaEncerrado = (ultimaData < hoje);

        const avisoAlteracao = !estaEncerrado ? '"Período sujeito a alteração"\n' : "";

        return [
            { 
                content: `STATUS: ${estaEncerrado ? "ENCERRADO" : "EM ANDAMENTO"}\nEVENTO: ${ev.evento}\n${avisoAlteracao}CLIENTE: ${ev.cliente}\nLOCAL: ${ev.local}\n`,
                estaEncerrado
            },
            { 
                content: `FUNÇÃO: ${ev.funcao}\nPERÍODO:\n${ev.periodo}` 
            }
        ];
    });

    doc.autoTable({
        startY: 35,
        head: [colunas],
        body: linhasCorpo,
        theme: 'grid',
        headStyles: { fillColor: [45, 45, 45], halign: 'center', fontStyle: 'bold' },
        styles: { 
            fontSize: 9, 
            cellPadding: { top: 7, right: 5, bottom: 12, left: 6 }, // Aumentado bottom para garantir espaço no período
            valign: 'top',
            overflow: 'linebreak',
            rowPageBreak: 'avoid',
            font: "helvetica"
        },
        columnStyles: { 0: { cellWidth: 90 }, 1: { cellWidth: 'auto' } },
        
        didDrawCell: function(data) {
            if (data.section === 'body') {
                const doc = data.doc;
                const cell = data.cell;
                const lines = cell.text;
                const padLeft = cell.padding('left');
                let cursorY = cell.y + cell.padding('top') + 3.5;
                const lineHeight = 4.2; 
                const gapExtra = 3.0; // Espaço apenas entre blocos diferentes

                // Limpa o fundo para evitar sobreposição
                doc.setFillColor(255, 255, 255);
                doc.rect(cell.x + 0.5, cell.y + 0.5, cell.width - 1, cell.height - 1, 'F');

                lines.forEach((line, index) => {
                    const text = line.trim();
                    if (!text) return;

                    // Se não for a primeira linha e contiver um rótulo, adiciona o gapExtra
                    if (index > 0 && text.includes(":")) {
                        cursorY += gapExtra;
                    }

                    if (text.startsWith("STATUS:")) {
                        doc.setFont("helvetica", "bold");
                        const isEnc = cell.raw.estaEncerrado;
                        doc.setTextColor(isEnc ? 200 : 0, isEnc ? 0 : 128, 0);
                        doc.text(text, cell.x + padLeft, cursorY);
                        cursorY += lineHeight;
                    } 
                    else if (text.includes(":")) {
                        const [label, ...rest] = text.split(":");
                        const valor = rest.join(":").trim();
                        
                        // Rótulo sempre em Negrito
                        doc.setFont("helvetica", "bold");
                        doc.setTextColor(0);
                        doc.text(label + ":", cell.x + padLeft, cursorY);

                        // Valor em Normal
                        doc.setFont("helvetica", "normal");
                        const availableWidth = cell.width - padLeft - 22;
                        const valorQuebrado = doc.splitTextToSize(valor, availableWidth);
                        
                        // Alinhamento fixo (20mm de recuo)
                        doc.text(valorQuebrado, cell.x + padLeft + 20, cursorY);

                        // Calcula o pulo do cursor baseado na quebra do nome (sem gap extra aqui)
                        const numLines = Array.isArray(valorQuebrado) ? valorQuebrado.length : 1;
                        cursorY += (numLines * lineHeight);
                    } 
                    else {
                        // Linhas que são continuação (datas do período ou nomes muito longos)
                        doc.setFont("helvetica", "normal");
                        doc.setTextColor(0);
                        doc.text(text, cell.x + padLeft, cursorY);
                        cursorY += lineHeight;
                    }
                });
            }
        }
    });

    // Rodapé
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8); doc.setTextColor(150);
        doc.text(`Página ${i} de ${totalPages}`, 105, 290, { align: 'center' });
    }

    window.open(doc.output('bloburl'), '_blank');
}


function configurarEventosStaff() {
    console.log("Configurando eventos Staff...");

    prefillEventFired = false;
    const containerPDF = document.querySelector('.pdf');

    // Se o usuário NÃO tiver a permissão Master, oculta o container.
    if (!temPermissaoMaster) {
        containerPDF.style.display = 'none';
    } else {
        containerPDF.style.display = ''; // Volta ao padrão
    }

    verificaStaff(); // Carrega os Staff ao abrir o modal
    adicionarEventoBlurStaff();
    inicializarFlatpickrsGlobais();
    limparStaffOriginal();

    inicializarFlatpickrStaffComLimites(); 

    if (window.__modalInitialParams) {
        const params = new URLSearchParams(window.__modalInitialParams);
        const dataeventos = params.get("dataeventos");

        if (dataeventos) {
            try {
                const datasEvento = JSON.parse(dataeventos);
                preencherDatasEventoFlatpickr(datasEvento);
            } catch (e) {
                console.warn("Erro ao parsear dataeventos:", e);
            }
        } else {
            console.warn("[configurarEventosStaff] Parâmetro dataeventos não encontrado.");
        }
    }
  
    // if (typeof mostrarTarja === 'function') {
    //     mostrarTarja();
    // }
    
    // 📢 NOVO BLOCO: Restrição de edição dos campos de Status
    const statusAjusteCustoInput = document.getElementById('statusAjusteCusto');
    const statusCaixinhaInput = document.getElementById('statusCaixinha');

    if (statusAjusteCustoInput && statusCaixinhaInput) {
        if (!temPermissaoMaster) {
            // Desabilita os campos se o usuário NÃO for Master
            statusAjusteCustoInput.disabled = true;
            statusCaixinhaInput.disabled = true;
            console.log("Status de Ajuste/Caixinha desabilitados: Permissão Master requerida.");
        } else {
            // Garante que os campos estão habilitados se o usuário for Master
            statusAjusteCustoInput.disabled = false;
            statusCaixinhaInput.disabled = false;
        }
    }

    const divStatusContainer = document.getElementById('campoStatusCustoFechado');
    const wrapperInput = document.getElementById('wrapperInputCustoFechado');
    const wrapperSelect = document.getElementById('wrapperSelectCustoFechado');
    const inputStatusTxt = document.getElementById('statusCustoFechadoTexto');
    const selectStatus = document.getElementById('selectStatusCustoFechado');
    const textareaJustificativa = document.getElementById('descCustoFechado');


    const temAcessoMasterOuFinanceiro = temPermissaoMaster || temPermissaoFinanceiro;

    // if (fechadoCheck || liberadoCheck) { // 'fechadoCheck' é a variável global do seu topo de arquivo
    //     const aplicarRegraVisibilidade = () => {
    //         if (fechadoCheck.checked || liberadoCheck.checked) {
    //             if (divStatusContainer) divStatusContainer.style.display = 'flex';
    //             if (divStatusContainer) divStatusContainer.style.flexDirection = 'row';
                
    //             // Justificativa sempre visível se o check estiver ativo
    //             if (textareaJustificativa) textareaJustificativa.style.display = 'block';

    //             if (temAcessoMasterOuFinanceiro) {
    //                 // MESTRE: Vê Select, esconde Input informativo
    //                 if (wrapperSelect) wrapperSelect.style.display = 'block';
    //                 if (wrapperInput) wrapperInput.style.display = 'none';
    //             } else {
    //                 // STAFF: Vê Input informativo, esconde Select
    //                 if (wrapperSelect) wrapperSelect.style.display = 'none';
    //                 if (wrapperInput) wrapperInput.style.display = 'block';
    //                 if (inputStatusTxt && !inputStatusTxt.value) inputStatusTxt.value = "Pendente";
    //             }
    //         } else {
    //             if (divStatusContainer) divStatusContainer.style.display = 'none';
    //         }
    //     };

    //     // Aplica a regra assim que o modal/página carrega
    //     aplicarRegraVisibilidade();

    //     // Sincronização: O que o Master escolhe no Select, aparece no Input do Staff
    //     if (selectStatus) {
    //         selectStatus.addEventListener('change', function() {
    //             if (inputStatusTxt) inputStatusTxt.value = this.value;
    //         });
    //     }

    //     // Evento de mudança no Checkbox "Cachê Fechado"
    //     fechadoCheck.addEventListener('change', function() {
    //         aplicarRegraVisibilidade();
            
    //         if (this.checked) {
    //             // LIBERA O VALOR: Torna o campo de valor editável
    //             if (vlrCustoInput) {
    //                 vlrCustoInput.readOnly = false;
    //                 vlrCustoInput.disabled = false;
    //                 vlrCustoInput.removeAttribute('data-permanent-readonly');
    //             }
    //         } else {
    //             // BLOQUEIA E LIMPA: Ao desmarcar, reseta os campos
    //             if (vlrCustoInput) {
    //                 vlrCustoInput.value = '';
    //                 vlrCustoInput.setAttribute('data-permanent-readonly', 'true');
    //                 vlrCustoInput.readOnly = true;
    //             }
    //             if (textareaJustificativa) textareaJustificativa.value = '';
    //             if (inputStatusTxt) inputStatusTxt.value = '';
    //             if (selectStatus) selectStatus.value = 'none';
    //         }
            
    //         // Atualiza cálculos se a função existir
    //         if (typeof calcularValorTotal === 'function') calcularValorTotal();
    //     });

    //     liberadoCheck.addEventListener('change', function() {
    //         aplicarRegraVisibilidade();
            
    //         if (this.checked) {
    //             // LIBERA O VALOR: Torna o campo de valor editável
    //             if (vlrCustoInput) {
    //                 vlrCustoInput.readOnly = false;
    //                 vlrCustoInput.disabled = false;
    //                 vlrCustoInput.removeAttribute('data-permanent-readonly');
    //             }
    //         } else {
    //             // BLOQUEIA E LIMPA: Ao desmarcar, reseta os campos
    //             if (vlrCustoInput) {
    //                 vlrCustoInput.value = '';
    //                 vlrCustoInput.setAttribute('data-permanent-readonly', 'true');
    //                 vlrCustoInput.readOnly = true;
    //             }
    //             if (textareaJustificativa) textareaJustificativa.value = '';
    //             if (inputStatusTxt) inputStatusTxt.value = '';
    //             if (selectStatus) selectStatus.value = 'none';
    //         }
            
    //         // Atualiza cálculos se a função existir
    //         if (typeof calcularValorTotal === 'function') calcularValorTotal();
    //     });
    // }
        // 📢 FIM DO NOVO BLOCO   
        
        if (fechadoCheck && liberadoCheck) { 
            const aplicarRegraVisibilidade = () => {
                // Verifica se QUALQUER um dos dois está marcado
                const algumAtivo = fechadoCheck.checked || liberadoCheck.checked;

                if (algumAtivo) {
                    // EXIBE os containers principais
                    if (divStatusContainer) {
                        divStatusContainer.style.display = 'flex';
                        divStatusContainer.style.flexDirection = 'row';
                    }
                    if (textareaJustificativa) {
                        textareaJustificativa.style.display = 'block';
                    }

                    // Regra de Permissão (Master/Financeiro vs Staff)
                    if (temAcessoMasterOuFinanceiro) {
                        if (wrapperSelect) wrapperSelect.style.display = 'block';
                        if (wrapperInput) wrapperInput.style.display = 'none';
                    } else {
                        if (wrapperSelect) wrapperSelect.style.display = 'none';
                        if (wrapperInput) wrapperInput.style.display = 'block';
                        if (inputStatusTxt && !inputStatusTxt.value) inputStatusTxt.value = "Pendente";
                    }
                } else {
                    // OCULTA TUDO se nenhum dos dois estiver marcado
                    if (divStatusContainer) divStatusContainer.style.display = 'none';
                    if (textareaJustificativa) {
                        textareaJustificativa.style.display = 'none';
                        textareaJustificativa.value = ''; // Limpa ao ocultar
                    }
                    // Limpa os status para não enviar lixo ao banco
                    if (inputStatusTxt) inputStatusTxt.value = '';
                    if (selectStatus) selectStatus.value = 'none';
                }
            };

            // Aplica no carregamento
            aplicarRegraVisibilidade();

            // Sincronização do Select para o Input
            if (selectStatus) {
                selectStatus.addEventListener('change', function() {
                    if (inputStatusTxt) inputStatusTxt.value = this.value;
                });
            }

            // Listeners simplificados: ambos chamam a mesma regra de visibilidade e o bloqueio de valor
            const monitorarChecks = (el) => {
                el.addEventListener('change', function() {
                    aplicarRegraVisibilidade();
                    
                    // Seleciona os inputs de alimentação e transporte
                    const inputAlim = document.getElementById("alimentacao");
                    const inputTrans = document.getElementById("transporte");

                    if (this.checked) {
                        // --- LIBERA TUDO ---
                        if (vlrCustoInput) {
                            vlrCustoInput.readOnly = false;
                            vlrCustoInput.disabled = false;
                            vlrCustoInput.removeAttribute('data-permanent-readonly');
                        }
                        if (inputAlim) inputAlim.readOnly = false; // 🔓 Libera alimentação
                        if (inputTrans) inputTrans.readOnly = false; // 🔓 Libera transporte

                    } else if (!fechadoCheck.checked && !liberadoCheck.checked) {
                        // --- BLOQUEIA TUDO (Só se ambos estiverem desmarcados) ---
                        if (vlrCustoInput) {
                            vlrCustoInput.value = '';
                            vlrCustoInput.setAttribute('data-permanent-readonly', 'true');
                            vlrCustoInput.readOnly = true;
                        }
                        if (inputAlim) {
                            inputAlim.readOnly = true; // 🔒 Bloqueia
                            inputAlim.value = (0).toFixed(2);
                        }
                        if (inputTrans) {
                            inputTrans.readOnly = true; // 🔒 Bloqueia
                            inputTrans.value = (0).toFixed(2);
                        }
                    }

                    if (typeof calcularValorTotal === 'function') calcularValorTotal();
                });
            };

            monitorarChecks(fechadoCheck);
            monitorarChecks(liberadoCheck);
        }

    const datasDoFlatpickr = window.datasEventoPicker?.selectedDates.map(d => d.toISOString().split('T')[0]) || [];

    console.log("Entrou configurar Staff no STAFF.js.");

}

// NO INÍCIO OU FINAL DO SEU STAFF.JS (Escopo Global)

function validarCamposAntesDoPeriodo() {
    // 📢 ESTA É A VERSÃO CORRETA DA SUA LÓGICA DE VALIDAÇÃO
    
    if (document.getElementById('nmFuncionario').value === '') {
        return 'Funcionário';
    }
    if (document.getElementById('descFuncao').value === '') {
        return 'Função';
    }
    const idsNivelExperiencia = ['Seniorcheck2','Seniorcheck', 'Plenocheck', 'Juniorcheck', 'Basecheck','Fechadocheck','Liberadocheck'];
    
    // A função 'isAnyChecked' será TRUE se pelo menos UMA checkbox estiver marcada
    const isAnyChecked = idsNivelExperiencia.some(id => {
        const checkElement = document.getElementById(id);
        return checkElement && checkElement.checked;
    });

    // Se nenhuma estiver marcada, retorna o nome do campo
    if (!isAnyChecked) {
        return 'Nível de Experiência';
    }   
    
    if (document.getElementById('nmLocalMontagem').value === '') {
        return 'Local Montagem';
    }
    if (document.getElementById('nmCliente').value === '') {
        return 'Cliente';
    }
    if (document.getElementById('nmEvento').value === '') {
        return 'Evento';
    }

    if (typeof bForaSP !== 'undefined' && bForaSP === true) {
        const idsViagem = ['viagem1Check', 'viagem2Check', 'viagem3Check'];
        
        // Verifica se pelo menos uma checkbox de viagem está marcada
        const isViagemChecked = idsViagem.some(id => {
            const checkElement = document.getElementById(id);
            return checkElement && checkElement.checked;
        });

        // Se o local é Fora de SP e NENHUMA checkbox de Viagem foi marcada
        if (!isViagemChecked) {
            return 'Alimentação Viagem';
        }
    }
    
    // Se todos estiverem preenchidos, retorne algo falso (null ou "")
    return null;
}

function getUrlParam(name) {
    const params = new URLSearchParams(window.__modalInitialParams);
    const value = params.get(name);
    console.log(`Parâmetro ${name}:`, value); // Adicione este log
    return value;
}

function inicializarFlatpickrStaffComLimites() {

    destruirFlatpickrsComSeguranca();

    const dtini_vaga = getUrlParam('dtini_vaga');
    const dtfim_vaga = getUrlParam('dtfim_vaga');
    
    const elementDatasEvento = document.getElementById('datasEvento');

    // 1. Gerar o array de datas completo entre dtini_vaga e dtfim_vaga
    const datasCompletasDaVaga = gerarArrayDatasEntre(dtini_vaga, dtfim_vaga);
    
    if (elementDatasEvento) {
        // // Se já existe, destrua a instância anterior (se aplicável)
        // if (elementDatasEvento._flatpickr) {
        //     window.datasEventoPicker.destroy();
        // }

        window.datasEventoPicker = flatpickr(elementDatasEvento, {
            mode: "multiple",
            dateFormat: "Y-m-d",
            locale: "pt",
            altInput: true,         // <-- Certifique-se de que está aqui para o formato DD/MM/AAAA
            altFormat: "d/m/Y",
            
            // ✅ AÇÃO 1: PREENCHE O INPUT com o array completo de datas
            defaultDate: datasCompletasDaVaga, 
            
            // ❌ AÇÃO 2: REMOVE minDate e maxDate para NÃO bloquear outras datas
            // minDate: null, 
            // maxDate: null, 
            
            onChange: function(selectedDates) {
                console.log("📅 Clique no calendário detectado...");
                // Mantém sua lógica de callback
                atualizarContadorEDatas(selectedDates);

                if (selectedDates.length > 0) {
                    console.log("✅ ONCHANGE MANUAL: Critérios atendidos. Chamando debouncedOnCriteriosChanged.");
                    debouncedOnCriteriosChanged(); 
                } else {
                    console.log(`❌ ONCHANGE MANUAL: Bloqueado (Datas: ${selectedDates.length}, Evento: ${!!idEvento}, Cliente: ${!!idCliente}).`);
                }
            },
        });        
        
        console.log(`✅ Flatpickr #datasEvento preenchido por padrão com ${datasCompletasDaVaga.length} dias.`);
    }
}

function verificarSeDeveChamarOnCriteriosChanged(datas) {
    const idEvento = document.getElementById('nmEvento')?.value;
    const idCliente = document.getElementById('nmCliente')?.value; 
    const idLocalMontagem = document.getElementById('nmLocalMontagem')?.value;
    
    // ATENÇÃO: Verifique se o nmFuncao está preenchido também, pois é essencial para o orçamento.
    const descFuncao = document.getElementById('descFuncao')?.value;

    if (datas.length > 0 && idEvento && idCliente && idLocalMontagem && descFuncao) {
        console.log("✅ CRITÉRIOS ATENDIDOS (via Prefill). Chamando debouncedOnCriteriosChanged.");
        debouncedOnCriteriosChanged();
    } else {
         console.log("❌ CRITÉRIOS AINDA BLOQUEADOS. Tentativa de Busca adiada.");
    }
}

// function preencherDatasEventoFlatpickr(dataeventos) {
//     if (window.datasEventoPicker) {
//         if (Array.isArray(dataeventos)) {
//             window.datasEventoPicker.setDate(dataeventos, true);
//             console.log("[preencherDatasEventoFlatpickr] Datas preenchidas no Flatpickr:", dataeventos);
//         } else {
//             console.warn("[preencherDatasEventoFlatpickr] Parâmetro dataeventos não é um array válido.");
//         }
//     } else {
//         console.warn("[preencherDatasEventoFlatpickr] Flatpickr não inicializado.");
//     }
// }

function preencherDatasEventoFlatpickr(dataeventos) {
    if (window.datasEventoPicker) {
        if (Array.isArray(dataeventos)) {
            window.datasEventoPicker.setDate(dataeventos, true);
            
            // ✅ FIX: Sincroniza o cache LOGO APÓS o setDate programático.
            // Isso garante que o próximo onChange do usuário compare contra
            // as datas corretas, e não contra um array vazio.
            window.datasEventoNoCalendarioCache = window.datasEventoPicker.selectedDates
                .map(d => flatpickr.formatDate(d, 'Y-m-d'))
                .sort();
            console.log("[preencherDatasEventoFlatpickr] Cache sincronizado:", window.datasEventoNoCalendarioCache);
        } else {
            console.warn("[preencherDatasEventoFlatpickr] Parâmetro dataeventos não é um array válido.");
        }
    } else {
        console.warn("[preencherDatasEventoFlatpickr] Flatpickr não inicializado.");
    }
}

/**
 * Gera um array de strings de data ('YYYY-MM-DD') entre duas datas.
 * As datas de entrada podem ser strings ISO (com ou sem horário).
 */
function gerarArrayDatasEntre(dataInicioStr, dataFimStr) {
    if (!dataInicioStr || !dataFimStr) return [];

    // Converte para objetos Date e remove a parte T03:00:00.000Z
    let dataAtual = new Date(dataInicioStr.split('T')[0]);
    const dataFim = new Date(dataFimStr.split('T')[0]);
    const arrayDatas = [];

    // Loop que adiciona a data atual e avança um dia
    while (dataAtual <= dataFim) {
        // Formata a data como YYYY-MM-DD
        const dataFormatada = dataAtual.toISOString().split('T')[0];
        arrayDatas.push(dataFormatada);

        // Avança para o próximo dia (necessário para evitar problemas de fuso)
        dataAtual.setDate(dataAtual.getDate() + 1);
    }
    
    return arrayDatas;
}

// Staff.js: Função auxiliar de segurança (deve estar em escopo global)
function destruirFlatpickrsComSeguranca() {
    console.log("🚨 DESTROY SEGURO: Verificando instâncias de Flatpickr.");

    // // 1. Destruição do Diária Dobrada
    // if (window.diariaDobradaPicker && typeof window.diariaDobradaPicker.destroy === 'function') {
    //     window.diariaDobradaPicker.destroy();
    //     window.diariaDobradaPicker = null; // Limpa a referência
    //     console.log("Diária Dobrada destruído com sucesso.");
    // }

    // // 2. Destruição do Meia Diária
    // if (window.meiaDiariaPicker && typeof window.meiaDiariaPicker.destroy === 'function') {
    //     window.meiaDiariaPicker.destroy();
    //     window.meiaDiariaPicker = null; // Limpa a referência
    //     console.log("Meia Diária destruído com sucesso.");
    // }
    
    // 3. Destruição do Datas Evento
    if (window.datasEventoPicker && typeof window.datasEventoPicker.destroy === 'function') {
        window.datasEventoPicker.destroy();
        window.datasEventoPicker = null; // Limpa a referência
        console.log("Datas Evento destruído com sucesso.");
    }
}
window.destruirFlatpickrsComSeguranca = destruirFlatpickrsComSeguranca;

// Opcional: Garante que a função é globalmente acessível, mesmo que a estrutura de 
// módulos ou escopo esteja confusa.
window.validarCamposAntesDoPeriodo = validarCamposAntesDoPeriodo;

window.configurarEventosStaff = configurarEventosStaff;

function configurarEventosEspecificos(modulo) {
  console.log("⚙️ configurarEventosEspecificos recebeu:", modulo);
  if (modulo.trim().toLowerCase() === 'staff') {
    configurarEventosStaff();

    // setTimeout(() => {
    //     // Se a flag não foi setada após 300ms, o evento foi perdido na corrida de scripts.
    //     if (!prefillEventFired) {
    //         console.warn("⚠️ Evento 'prefill:registered' foi perdido. Chamando a verificação de critérios como fallback de 300ms.");
            
    //         // As datas devem estar no Flatpickr neste momento, então chamamos o debounced.
    //         debouncedOnCriteriosChanged(); 
    //     }
    // }, 300);

    if (typeof aplicarPermissoes === "function" && window.permissoes) {
      aplicarPermissoes(window.permissoes);
    } else {
      console.warn("⚠️ aplicarPermissoes ou window.permissoes ainda não estão disponíveis.");
    }

    console.log("Entrou configurar Staff no STAFF.js.");
  }
}
window.configurarEventosEspecificos = configurarEventosEspecificos;

window.moduloHandlers = window.moduloHandlers || {};
window.moduloHandlers['Staff'] = { // A chave 'Staff' deve corresponder ao seu Index.js
    configurar: configurarEventosStaff,
    desinicializar: desinicializarStaffModal
};