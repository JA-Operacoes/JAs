import { fetchComToken } from '../utils/utils.js';

//importado no inicio do js pois deve ser importado antes do restante do codigo
import "https://cdn.jsdelivr.net/npm/flatpickr@latest/dist/flatpickr.min.js";
import "https://cdn.jsdelivr.net/npm/flatpickr@latest/dist/l10n/pt.js";

const fp = window.flatpickr;
const currentLocale = fp.l10ns.pt || fp.l10ns.default;

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
    dateFormat: "d/m/Y",
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

const formatInputTextWithStatus = (instance, dataArray) => {
    const datesWithStatus = instance.selectedDates.map(date => {
        const dateStr = flatpickr.formatDate(date, "Y-m-d");
        const statusData = dataArray.find(item => item.data === dateStr);
        const status = statusData ? statusData.status : 'Pendente';
        return `${flatpickr.formatDate(date, "d/m/Y")} - ${status}`;
    });
    instance.altInput.value = datesWithStatus.join(', ');
};

// const aplicarStatusManualmente = (pickerInstance, dataArray) => {
//     const dias = pickerInstance.calendarContainer.querySelectorAll('.flatpickr-day');
//     dias.forEach(diaElement => {
//         const dataDia = flatpickr.formatDate(diaElement.dateObj, "Y-m-d");
//         const statusData = dataArray.find(item => item.data === dataDia);
//         if (statusData) {
//             diaElement.classList.add(`status-${statusData.status.toLowerCase()}`);
//         }
//     });
// };


function configurarFlatpickrs() {
    console.log("Configurando Flatpickrs...");

    // Inicialização da Diária Dobrada
    window.diariaDobradaPicker = flatpickr(document.querySelector("#diariaDobrada"), {
        ...commonFlatpickrOptions,
        enable: [],
        altInput: true,
        altFormat: "d/m/Y",
        locale: currentLocale,
        appendTo: document.body,
        onDayCreate: (dObj, dStr, fp, dayElement) => {
            const dataDia = flatpickr.formatDate(dayElement.dateObj, "Y-m-d");
            const statusData = datasDobrada.find(item => item.data === dataDia);
            if (statusData) {
                dayElement.classList.add(`status-${statusData.status.toLowerCase()}`);
                if (statusData.status.toLowerCase() !== 'pendente') {
                    dayElement.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        Swal.fire({
                            title: 'Atenção!',
                            text: `Esta data já foi processada e não pode ser desmarcada.`,
                            icon: 'warning',
                            confirmButtonText: 'OK'
                        });
                    }, true);
                }
            }
        },
        onReady: (selectedDates, dateStr, instance) => {
            setTimeout(() => formatInputTextWithStatus(instance, datasDobrada), 0);
        },
        onChange: (selectedDates, dateStr, instance) => {
            let duplicateDates = [];
            if (selectedDates.length > 0 && window.meiaDiariaPicker) {
                const datesMeiaDiaria = window.meiaDiariaPicker.selectedDates;
                for (let i = 0; i < selectedDates.length; i++) {
                    const dataSelecionada = flatpickr.formatDate(selectedDates[i], "Y-m-d");
                    const existe = datesMeiaDiaria.some(d => flatpickr.formatDate(d, "Y-m-d") === dataSelecionada);
                    if (existe) duplicateDates.push(selectedDates[i]);
                }
            }
            if (duplicateDates.length > 0) {
                Swal.fire({
                    title: 'Atenção!',
                    text: `Uma ou mais datas selecionadas já estão em "Meia Diária": ${duplicateDates.map(d => flatpickr.formatDate(d, 'd/m/Y')).join(', ')}. Serão desmarcadas daqui.`,
                    icon: 'warning',
                    confirmButtonText: 'OK'
                });
                const newSelected = instance.selectedDates.filter(date =>
                    !duplicateDates.some(dup => dup.getTime() === date.getTime())
                );
                instance.setDate(newSelected, false);
                return;
            }
            instance._prevSelectedDates = [...selectedDates];
            formatInputTextWithStatus(instance, datasDobrada);
        },
        onClose: function(selectedDates, dateStr, instance) {
            setTimeout(() => {
                formatInputTextWithStatus(instance, datasDobrada);
                if (window.meiaDiariaPicker) {
                    formatInputTextWithStatus(window.meiaDiariaPicker, datasMeiaDiaria);
                }
            }, 0);
            if (typeof diariaDobradacheck !== "undefined" && diariaDobradacheck)
                diariaDobradacheck.checked = instance.selectedDates.length > 0;
            updateDisabledDates();
            calcularValorTotal();
        },
    });

    // Inicialização da Meia Diária
    window.meiaDiariaPicker = flatpickr(document.querySelector("#meiaDiaria"), {
        ...commonFlatpickrOptions,
        enable: [],
        altInput: true,
        altFormat: "d/m/Y",
        locale: currentLocale,
        appendTo: document.body,
        onDayCreate: (dObj, dStr, fp, dayElement) => {
            const dataDia = flatpickr.formatDate(dayElement.dateObj, "Y-m-d");
            const statusData = datasMeiaDiaria.find(item => item.data === dataDia);
            if (statusData) {
                dayElement.classList.add(`status-${statusData.status.toLowerCase()}`);
                if (statusData.status.toLowerCase() !== 'pendente') {
                    dayElement.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        Swal.fire({
                            title: 'Atenção!',
                            text: `Esta data já foi processada e não pode ser desmarcada.`,
                            icon: 'warning',
                            confirmButtonText: 'OK'
                        });
                    }, true);
                }
            }
        },
        onReady: (selectedDates, dateStr, instance) => {
            setTimeout(() => formatInputTextWithStatus(instance, datasMeiaDiaria), 0);
        },
        onChange: (selectedDates, dateStr, instance) => {
            let duplicateDates = [];
            if (selectedDates.length > 0 && window.diariaDobradaPicker) {
                const datesDiariaDobrada = window.diariaDobradaPicker.selectedDates;
                for (let i = 0; i < selectedDates.length; i++) {
                    const dataSelecionada = flatpickr.formatDate(selectedDates[i], "Y-m-d");
                    const existe = datesDiariaDobrada.some(d => flatpickr.formatDate(d, "Y-m-d") === dataSelecionada);
                    if (existe) duplicateDates.push(selectedDates[i]);
                }
            }
            if (duplicateDates.length > 0) {
                Swal.fire({
                    title: 'Atenção!',
                    text: `Uma ou mais datas selecionadas já estão em "Diária Dobrada": ${duplicateDates.map(d => flatpickr.formatDate(d, 'd/m/Y')).join(', ')}. Não é possível selecioná-las aqui.`,
                    icon: 'warning',
                    confirmButtonText: 'OK'
                });
                const newSelected = instance.selectedDates.filter(date =>
                    !duplicateDates.some(dup => dup.getTime() === date.getTime())
                );
                instance.setDate(newSelected, false);
                return;
            }
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
            if (typeof meiaDiariacheck !== "undefined" && meiaDiariacheck)
                meiaDiariacheck.checked = instance.selectedDates.length > 0;
            updateDisabledDates();
            calcularValorTotal();
        },
    });

    // Inicialização do Picker Principal
    window.datasEventoPicker = flatpickr(document.querySelector("#datasEvento"), {
        ...commonFlatpickrOptions,
        onDayCreate: (dObj, dStr, fp, dayElement) => {
            const dataDia = flatpickr.formatDate(dayElement.dateObj, "Y-m-d");
            const statusDobrada = datasDobrada.find(d => d.data === dataDia);
            const statusMeia = datasMeiaDiaria.find(d => d.data === dataDia);

            if (statusDobrada || statusMeia) {
                const status = (statusDobrada || statusMeia).status.toLowerCase();
                dayElement.classList.add(`status-${status}`);
                if (status !== 'pendente') {
                    dayElement.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        Swal.fire({
                            title: 'Atenção!',
                            text: `Esta data já foi processada e não pode ser desmarcada.`,
                            icon: 'warning',
                            confirmButtonText: 'OK'
                        });
                    }, true);
                }
            }
        },
        onChange: function(selectedDates, dateStr, instance) {
            datasEventoSelecionadas = selectedDates; 
            
            const previouslySelectedDates = instance._prevSelectedDates || [];
            const datesAttemptedToRemove = previouslySelectedDates.filter(prevDate => 
                !selectedDates.some(newDate => prevDate.getTime() === newDate.getTime())
            );

            const unauthorizedRemovals = datesAttemptedToRemove.filter(removedDate => {
                const dataDiaRemovida = flatpickr.formatDate(removedDate, 'Y-m-d');
                const statusDobrada = datasDobrada.find(d => d.data === dataDiaRemovida);
                const statusMeiaDiaria = datasMeiaDiaria.find(d => d.data === dataDiaRemovida);
                
                return (statusDobrada && statusDobrada.status.toLowerCase() !== 'pendente') ||
                    (statusMeiaDiaria && statusMeiaDiaria.status.toLowerCase() !== 'pendente');
            });
            if (bloqueadas.length > 0) {
                Swal.fire({
                    title: 'Atenção!',
                    text: `As seguintes datas já foram processadas e não podem ser desmarcadas: ${bloqueadas.map(d => flatpickr.formatDate(d, 'd/m/Y')).join(', ')}.`,
                    icon: 'warning',
                    confirmButtonText: 'OK'
                });
                instance.setDate(prev, false);
                return;
            }
            instance._prevSelectedDates = [...selectedDates];
            datasEventoSelecionadas = selectedDates;

            const contador = document.getElementById('contadorDatas');
            if (contador) {
                contador.innerText = selectedDates.length === 0
                    ? 'Nenhuma data selecionada'
                    : `${selectedDates.length} ${selectedDates.length === 1 ? 'Diária Selecionada' : 'Diárias'}`;
            }

            if (window.diariaDobradaPicker && typeof window.diariaDobradaPicker.set === "function") {
                window.diariaDobradaPicker.set('enable', datasEventoSelecionadas);
                window.diariaDobradaPicker.setDate(
                    window.diariaDobradaPicker.selectedDates.filter(d =>
                        datasEventoSelecionadas.some(sel => sel.getTime() === d.getTime())
                    ), false
                );
            }
            if (window.meiaDiariaPicker && typeof window.meiaDiariaPicker.set === "function") {
                window.meiaDiariaPicker.set('enable', datasEventoSelecionadas);
                window.meiaDiariaPicker.setDate(
                    window.meiaDiariaPicker.selectedDates.filter(d =>
                        datasEventoSelecionadas.some(sel => sel.getTime() === d.getTime())
                    ), false
                );
            }
        },
        onClose: selectedDates => {
            if (selectedDates.length > 0) debouncedOnCriteriosChanged();
            calcularValorTotal();
        }
    });

    // 🔒 Garantir que nunca fiquem como array
    if (Array.isArray(window.datasEventoPicker)) window.datasEventoPicker = window.datasEventoPicker[0];
    if (Array.isArray(window.diariaDobradaPicker)) window.diariaDobradaPicker = window.diariaDobradaPicker[0];
    if (Array.isArray(window.meiaDiariaPicker)) window.meiaDiariaPicker = window.meiaDiariaPicker[0];

    // Fallback: pegar instância do próprio input
    window.datasEventoPicker = window.datasEventoPicker || document.querySelector('#datasEvento')._flatpickr;
    window.diariaDobradaPicker = window.diariaDobradaPicker || document.querySelector('#diariaDobrada')._flatpickr;
    window.meiaDiariaPicker = window.meiaDiariaPicker || document.querySelector('#meiaDiaria')._flatpickr;

    // Variáveis locais também
    datasEventoPicker = window.datasEventoPicker;
    diariaDobradaPicker = window.diariaDobradaPicker;
    meiaDiariaPicker = window.meiaDiariaPicker;
}

const atualizarContadorEDatas = (selectedDates) => {
    const contador = document.getElementById('contadorDatas');
    if (contador) {
        contador.innerText = selectedDates.length === 0
            ? 'Nenhuma data selecionada'
            : `${selectedDates.length} ${selectedDates.length === 1 ? 'Diária Selecionada' : 'Diárias'}`;
    }

    const diariaDobradaPicker = window.diariaDobradaPicker;
    const meiaDiariaPicker = window.meiaDiariaPicker;

    if (diariaDobradaPicker) {
        diariaDobradaPicker.set('enable', selectedDates);
        diariaDobradaPicker.setDate(
            diariaDobradaPicker.selectedDates.filter(date => selectedDates.some(d => d.getTime() === date.getTime())),
            false
        );
    }

    if (meiaDiariaPicker) {
        meiaDiariaPicker.set('enable', selectedDates);
        meiaDiariaPicker.setDate(
            meiaDiariaPicker.selectedDates.filter(date => selectedDates.some(d => d.getTime() === date.getTime())),
            false
        );
    }
};


// Função de inicialização
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
let almocoInputListener = null;
let jantarInputListener = null;
let caixinhaInputListener = null;
let fileCacheChangeListener = null;
let fileAjdCustoChangeListener = null;
let fileCaixinhaChangeListener = null;
let fileAjdCusto2ChangeListener = null;
let datasEventoPicker, diariaDobradaPicker, meiaDiariaPicker;
let datasEventoSelecionadas = []; // Inicializa com um array vazio
let datasDobrada = [];
let datasMeiaDiaria = [];
let orcamentoPorFuncao = {};
let statusOrcamentoAtual;
let porcentagemPaga = 50;
let isFormLoadedFromDoubleClick = false;
let currentRowSelected = null;
let currentEditingStaffEvent = null;
let retornoDados = false;
let vlrCustoSeniorFuncao = 0;
let vlrCustoPlenoFuncao = 0;
let vlrCustoJuniorFuncao = 0;
let vlrCustoBaseFuncao = 0;
let vlrAlmocoFuncao = 0;
let vlrJantarFuncao = 0;
let vlrTransporteFuncao = 0;
let vlrTransporteSeniorFuncao = 0;
let vlrAlmocoDobra =0;
let vlrJantarDobra =0;

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
        almoco: "",
        jantar: "",
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
        setor: "",
        statusPgto: "",
        nivelExperiencia: ""
    };
}


const eventsTableBody = document.querySelector('#eventsDataTable tbody');
const noResultsMessage = document.getElementById('noResultsMessage');
const idFuncionarioHiddenInput = document.getElementById('idFuncionario');
const apelidoFuncionarioInput = document.getElementById("apelidoFuncionario");
const perfilFuncionarioInput = document.getElementById("perfilFuncionario");
const previewFotoImg = document.getElementById('previewFoto');
const fileNameSpan = document.getElementById('fileName');
const uploadHeaderDiv = document.getElementById('uploadHeader');
const fileInput = document.getElementById('file');
const avaliacaoSelect = document.getElementById('avaliacao'); // Se usar
const tarjaDiv = document.getElementById('tarjaAvaliacao'); // Se usar
//const bFuncionarioCadstrado = false;

const idStaffInput = document.getElementById('idStaff'); // Campo ID Staff
const idStaffEventoInput = document.getElementById('idStaffEvento');
const idFuncaoInput = document.getElementById('idFuncao');
const descFuncaoSelect = document.getElementById('descFuncao'); // Select de Função
const vlrCustoInput = document.getElementById('vlrCusto');
const ajusteCustoInput = document.getElementById('ajusteCusto');
const transporteInput = document.getElementById('transporte');
const almocoInput = document.getElementById('almoco');
const jantarInput = document.getElementById('jantar');
const caixinhaInput = document.getElementById('caixinha');
const descBeneficioTextarea = document.getElementById('descBeneficio');
const nmLocalMontagemSelect = document.getElementById('nmLocalMontagem');
const nmPavilhaoSelect = document.getElementById('nmPavilhao');
const idClienteInput = document.getElementById('idCliente');
const nmClienteSelect = document.getElementById('nmCliente');
const idEventoInput = document.getElementById('idEvento');
const nmEventoSelect = document.getElementById('nmEvento');
const datasEventoInput = document.getElementById('datasEvento'); // Input do Flatpickr

const ajusteCustocheck = document.getElementById('ajusteCustocheck');
const campoAjusteCusto = document.getElementById('campoAjusteCusto');
const ajusteCustoTextarea = document.getElementById('descAjusteCusto');
const campoStatusajusteCusto = document.getElementById('campoStatusAjusteCusto');
const statusAjusteCustoInput = document.getElementById('statusAjusteCusto');
const selectStatusAjusteCusto = document.getElementById('selectStatusAjusteCusto');

const vlrTotalInput = document.getElementById('vlrTotal');

//const campoAjusteCustoTextarea = document.getElementById('descajusteCusto');
const caixinhacheck = document.getElementById('Caixinhacheck');
const campoCaixinha = document.getElementById('campoCaixinha');
const descCaixinhaTextarea = document.getElementById('descCaixinha');
const campoStatusCaixinha = document.getElementById('campoStatusCaixinha');
const statusCaixinhaInput = document.getElementById('statusCaixinha');
const selectStatusCaixinha = document.getElementById('selectStatusCaixinha');

const setorInput = document.getElementById('setor');

const statusPagtoInput = document.getElementById('statusPgto');

const temPermissaoMaster = temPermissao("Staff", "master");
const temPermissaoFinanceiro = temPermissao("Staff", "financeiro");
const temPermissaoTotal = (temPermissaoMaster || temPermissaoFinanceiro);

const diariaDobradaInput = document.getElementById('diariaDobrada');
const diariaDobradacheck = document.getElementById('diariaDobradacheck');
const campoDiariaDobrada = document.getElementById('campoDiariaDobrada');
const descDiariaDobradaTextarea = document.getElementById('descDiariaDobrada');
const campoStatusDiariaDobrada = document.getElementById('campoStatusDiariaDobrada');
const statusDiariaDobradaInput = document.getElementById('statusDiariaDobrada');

const meiaDiariaInput = document.getElementById('meiaDiaria');
const meiaDiariacheck = document.getElementById('meiaDiariacheck');
const campoMeiaDiaria = document.getElementById('campoMeiaDiaria');
const descMeiaDiariaTextarea = document.getElementById('descMeiaDiaria');
const campoStatusMeiaDiaria = document.getElementById('campoStatusMeiaDiaria');
const statusMeiaDiariaInput = document.getElementById('statusMeiaDiaria');

const containerDiariaDobradaCheck = document.querySelector('#diariaDobradacheck').closest('.input-container-checkbox');
const containerMeiaDiariacheck = document.querySelector('#meiaDiariacheck').closest('.input-container-checkbox');
const containerStatusDiariaDobrada = document.getElementById('containerStatusDiariaDobrada');
const containerStatusMeiaDiaria = document.getElementById('containerStatusMeiaDiaria');

const check50 = document.getElementById('check50');
const check100 = document.getElementById('check100');

const container1 = document.getElementById('labelFileAjdCusto').parentElement;
const container2 = document.getElementById('labelFileAjdCusto2').parentElement;
const mensagemConcluido = document.getElementById('mensagemConcluido');

const seniorCheck = document.getElementById('Seniorcheck');
const plenoCheck = document.getElementById('Plenocheck');
const juniorCheck = document.getElementById('Juniorcheck');
const baseCheck = document.getElementById('Basecheck');

const almocoCheck = document.getElementById('Almococheck');
const jantarCheck = document.getElementById('Jantarcheck');

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

// A sua função principal de carregamento de dados
const carregarDadosParaEditar = (eventData) => {
    console.log("Objeto eventData recebido:", eventData);
    console.log("Valor de dtdiariadobrada:", eventData.dtdiariadobrada);

    retornoDados = true;
    limparCamposEvento();
    currentEditingStaffEvent = eventData;
    isFormLoadedFromDoubleClick = true;

    // --- PONTO IMPORTANTE: Oculta upload para não aparecer embaixo da foto ---
    const uploadHeaderDiv = document.getElementById('uploadHeader');
    const uploadContainer = document.querySelector("#upload-container");
    const fileInput = document.getElementById('file');

    if (uploadHeaderDiv) uploadHeaderDiv.style.display = 'none';
    if (uploadContainer) uploadContainer.style.display = 'none';
    if (fileInput) fileInput.disabled = true;

    // --- Carregando dados básicos nos inputs do formulário ---
    idStaffInput.value = eventData.idstaff || '';
    idStaffEventoInput.value = eventData.idstaffevento;
    idFuncaoInput.value = eventData.idfuncao;
    idClienteInput.value = eventData.idcliente;
    idEventoInput.value = eventData.idevento;
    idFuncionarioHiddenInput.value = eventData.idfuncionario || '';   

    if (containerDiariaDobradaCheck) {
        containerDiariaDobradaCheck.style.display = 'block';
        containerStatusDiariaDobrada.style.display = 'block';
    }
    if (containerMeiaDiariacheck) {
        containerMeiaDiariacheck.style.display = 'block';
        containerStatusMeiaDiaria.style.display = 'block';
    }

  //  if (descFuncaoSelect) descFuncaoSelect.value = eventData.idfuncao || '';

    if (descFuncaoSelect) {
        descFuncaoSelect.value = eventData.idfuncao || '';
        
        // --- NOVO PASSO: Garante que os valores de almoço e jantar sejam carregados na edição ---
        // Pega a opção selecionada no dropdown de função
        const selectedOption = descFuncaoSelect.options[descFuncaoSelect.selectedIndex];

        // Se uma opção válida for encontrada, atualiza as variáveis globais
        if (selectedOption) {
            vlrAlmocoDobra = parseFloat(selectedOption.getAttribute("data-almoco")) || 0;
            vlrJantarDobra = parseFloat(selectedOption.getAttribute("data-jantar")) || 0;
            console.log("Valores de Almoço e Jantar carregados para edição:", vlrAlmocoDobra, vlrJantarDobra);
        }
    }


    if (nmClienteSelect) nmClienteSelect.value = eventData.idcliente || '';
    if (nmEventoSelect) nmEventoSelect.value = eventData.idevento || '';

    // Local de Montagem e Pavilhão
    if (nmLocalMontagemSelect) {
        nmLocalMontagemSelect.value = eventData.idmontagem || '';
        nmLocalMontagemSelect.dispatchEvent(new Event('change'));

        setTimeout(() => {
            if (nmPavilhaoSelect) {
                const historicalPavilhaoName = eventData.pavilhao || '';
                let selected = false;
                for (let i = 0; i < nmPavilhaoSelect.options.length; i++) {
                    if (nmPavilhaoSelect.options[i].textContent.toUpperCase().trim() === historicalPavilhaoName.toUpperCase().trim()) {
                        nmPavilhaoSelect.value = nmPavilhaoSelect.options[i].value;
                        selected = true;
                        break;
                    }
                }
                if (!selected && historicalPavilhaoName) {
                    const tempOption = document.createElement('option');
                    tempOption.value = historicalPavilhaoName;
                    tempOption.textContent = `${historicalPavilhaoName} (Histórico)`;
                    nmPavilhaoSelect.prepend(tempOption);
                    nmPavilhaoSelect.value = historicalPavilhaoName;
                } else if (!historicalPavilhaoName) {
                    nmPavilhaoSelect.value = '';
                }
            }
        }, 200);
    } else {
        if (nmPavilhaoSelect) {
            nmPavilhaoSelect.innerHTML = `<option value="${eventData.pavilhao || ''}">${eventData.pavilhao || 'Selecione Pavilhão'}</option>`;
            nmPavilhaoSelect.value = eventData.pavilhao || '';
        }
    }

    // Campos financeiros
    vlrCustoInput.value = parseFloat(eventData.vlrcache || 0).toFixed(2).replace('.', ',');
    transporteInput.value = parseFloat(eventData.vlrtransporte || 0).toFixed(2).replace('.', ',');
    almocoInput.value = parseFloat(eventData.vlralmoco || 0).toFixed(2).replace('.', ',');
    jantarInput.value = parseFloat(eventData.vlrjantar || 0).toFixed(2).replace('.', ',');
    descBeneficioTextarea.value = eventData.descbeneficios || '';

    ajusteCustoInput.value = parseFloat(eventData.vlrajustecusto || 0).toFixed(2).replace('.', ',');
    ajusteCustoTextarea.value = eventData.descajusteCusto || '';
    statusAjusteCustoInput.value = eventData.statusajustecusto;

    caixinhaInput.value = parseFloat(eventData.vlrcaixinha || 0).toFixed(2).replace('.', ',');
    descCaixinhaTextarea.value = eventData.desccaixinha || '';
    statusCaixinhaInput.value = eventData.statuscaixinha;

    vlrTotalInput.value = parseFloat(eventData.vlrtotal || 0).toFixed(2).replace('.', ',');

    console.log("VALOR TOTAL", vlrTotalInput.value);
    setorInput.value = eventData.setor.toUpperCase() || '';
    statusPagtoInput.value = eventData.statuspgto.toUpperCase() || '';

    // Checkboxes de Bônus e Caixinha
    if (ajusteCustocheck) {
        ajusteCustocheck.checked = parseFloat(eventData.vlrajustecusto || 0);
        campoAjusteCusto.style.display = ajusteCustocheck.checked ? 'block' : 'none';
        campoStatusajusteCusto.style.display = ajusteCustocheck.checked ? 'block' : 'none';
        ajusteCustoTextarea.style.display = ajusteCustocheck.checked ? 'block' : 'none';
        ajusteCustoTextarea.required = ajusteCustocheck.checked;
        ajusteCustoTextarea.value = eventData.descajustecusto || '';
    }
    if (caixinhacheck) {
        caixinhacheck.checked = parseFloat(eventData.vlrcaixinha || 0) > 0;
        campoCaixinha.style.display = caixinhacheck.checked ? 'block' : 'none';
        campoStatusCaixinha.style.display = caixinhacheck.checked ? 'block' : 'none';
        descCaixinhaTextarea.style.display = caixinhacheck.checked ? 'block' : 'none';
        descCaixinhaTextarea.required = caixinhacheck.checked;
        descCaixinhaTextarea.value = eventData.desccaixinha || '';
    }

    // Comprovantes 50% e 100%
    if (temPermissaoTotal) {
        const comp50Preenchido = eventData.comppgtoajdcusto50 && eventData.comppgtoajdcusto50.length > 0;
        const comp100Preenchido = eventData.comppgtoajdcusto && eventData.comppgtoajdcusto.length > 0;

        check50.checked = comp50Preenchido;
        check100.checked = comp100Preenchido;

        container1.style.display = check100.checked ? 'flex' : 'none';
        container2.style.display = check50.checked ? 'flex' : 'none';

        const statusPagtoValue = statusPagtoInput.value.toUpperCase();
        statusPagtoInput.classList.remove('pendente', 'pago');
        if (statusPagtoValue === "PENDENTE") {
            statusPagtoInput.classList.add('pendente');
        } else if (statusPagtoValue === "PAGO") {
            statusPagtoInput.classList.add('pago');
        }
    }

    switch(eventData.nivelexperiencia) {
        case "Base":
            baseCheck.checked = true;
            break;
        case "Junior":
            juniorCheck.checked = true;
            break;
        case "Pleno":
            plenoCheck.checked = true;
            break;
        case "Senior":
            seniorCheck.checked = true;
            break;
    }
    if (eventData.vlralmoco > 0) {
        almocoCheck.checked = true;
    } else {
        almocoCheck.checked = false; // opcional, caso queira desmarcar se for 0
    }

    // Marcar jantar se houver valor
    if (eventData.vlrjantar > 0) {
        jantarCheck.checked = true;
    } else {
        jantarCheck.checked = false; // opcional
    }

    preencherComprovanteCampo(eventData.comppgtocache, 'Cache');
    preencherComprovanteCampo(eventData.comppgtoajdcusto, 'AjdCusto');
    preencherComprovanteCampo(eventData.comppgtoajdcusto50, 'AjdCusto2');
    preencherComprovanteCampo(eventData.comppgtocaixinha, 'Caixinha');

    // Flatpickrs e contador de datas
    inicializarEPreencherCampos(eventData);
    atualizarContadorDatas();

};



/**
 * Inicializa e preenche os campos do formulário com os dados de um evento.
 * Esta versão garante que as datas e o status apareçam corretamente no campo de entrada
 * na carga inicial, após seleção de datas e após o fechamento do calendário.
 * @param {object} eventData - O objeto de dados do evento contendo as datas e status.
 */
function inicializarEPreencherCampos(eventData) {
    console.log("Inicializando Flatpickrs com dados de evento...");

    // PASSO 1: DESTRUIR INSTÂNCIAS ANTERIORES
    if (diariaDobradaPicker && typeof diariaDobradaPicker.destroy === "function") diariaDobradaPicker.destroy();
    if (meiaDiariaPicker && typeof meiaDiariaPicker.destroy === "function") meiaDiariaPicker.destroy();
    if (datasEventoPicker && typeof datasEventoPicker.destroy === "function") datasEventoPicker.destroy();

    configurarFlatpickrs();

    // Atualiza as variáveis locais com as instâncias globais
    datasEventoPicker = window.datasEventoPicker;
    diariaDobradaPicker = window.diariaDobradaPicker;
    meiaDiariaPicker = window.meiaDiariaPicker;

    // PASSO 4: Preencher as novas instâncias com os dados carregados
    const datesEvento = getDatesForFlatpickr(eventData.datasevento);
    const datesDiariaDobrada = getDatesForFlatpickr(datasDobrada);
    const datesMeiaDiaria = getDatesForFlatpickr(datasMeiaDiaria);

    datasEventoPicker.setDate(datesEvento, false);
    diariaDobradaPicker.set('enable', datesEvento);
    meiaDiariaPicker.set('enable', datesEvento);

    diariaDobradaPicker.setDate(datesDiariaDobrada, true);//estava false
    formatInputTextWithStatus(diariaDobradaPicker, datasDobrada);

    meiaDiariaPicker.setDate(datesMeiaDiaria, true);//estava false
    formatInputTextWithStatus(meiaDiariaPicker, datasMeiaDiaria);

    setTimeout(() => {
        if (diariaDobradaPicker) formatInputTextWithStatus(diariaDobradaPicker, datasDobrada);
        if (meiaDiariaPicker) formatInputTextWithStatus(meiaDiariaPicker, datasMeiaDiaria);
    }, 0);

    // PASSO 6: Lógica dos checkboxes
    diariaDobradacheck.addEventListener('change', (e) => {
        if (e.target.checked) {
            campoDiariaDobrada.style.display = 'block';
            campoStatusDiariaDobrada.style.display = 'block';
            containerStatusDiariaDobrada.style.display = 'block';
        } else {
            campoDiariaDobrada.style.display = 'none';
            campoStatusDiariaDobrada.style.display = 'none';
            containerStatusDiariaDobrada.style.display = 'none';
            if (diariaDobradaPicker && typeof diariaDobradaPicker.clear === "function") diariaDobradaPicker.clear();
        }
        setTimeout(() => {
            if (meiaDiariaPicker) formatInputTextWithStatus(meiaDiariaPicker, datasMeiaDiaria);
        }, 0);
        updateDisabledDates();
        calcularValorTotal();
    });

    meiaDiariacheck.addEventListener('change', (e) => {
        if (e.target.checked) {
            campoMeiaDiaria.style.display = 'block';
            campoStatusMeiaDiaria.style.display = 'block';
            containerStatusMeiaDiaria.style.display = 'block';
        } else {
            campoMeiaDiaria.style.display = 'none';
            campoStatusMeiaDiaria.style.display = 'none';
            containerStatusMeiaDiaria.style.display = 'none';
            if (meiaDiariaPicker && typeof meiaDiariaPicker.clear === "function") meiaDiariaPicker.clear();
        }
        setTimeout(() => {
            if (diariaDobradaPicker) formatInputTextWithStatus(diariaDobradaPicker, datasDobrada);
        }, 0);
        updateDisabledDates();
        calcularValorTotal();
    });

    // Preenche descrições
    if (descDiariaDobradaTextarea) descDiariaDobradaTextarea.value = eventData.descdiariadobrada || '';
    if (descMeiaDiariaTextarea) descMeiaDiariaTextarea.value = eventData.descmeiadiaria || '';

    diariaDobradacheck.checked = datesDiariaDobrada.length > 0;
    campoDiariaDobrada.style.display = diariaDobradacheck.checked ? 'block' : 'none';
    campoStatusDiariaDobrada.style.display = diariaDobradacheck.checked ? 'block' : 'none';
    containerStatusDiariaDobrada.style.display = diariaDobradacheck.checked ? 'block' : 'none';

    meiaDiariacheck.checked = datesMeiaDiaria.length > 0;
    campoMeiaDiaria.style.display = meiaDiariacheck.checked ? 'block' : 'none';
    campoStatusMeiaDiaria.style.display = meiaDiariacheck.checked ? 'block' : 'none';
    containerStatusMeiaDiaria.style.display = meiaDiariacheck.checked ? 'block' : 'none';

    if (temPermissaoTotal) {
        document.getElementById('grupoDiariaDobrada').style.display = 'block';
        document.getElementById('grupoMeiaDiaria').style.display = 'block';

        document.getElementById('selectStatusDiariaDobrada').style.display = 'none';
        statusDiariaDobradaInput.style.display = 'none';
        campoStatusDiariaDobrada.style.display = 'none';

        document.getElementById('selectStatusMeiaDiaria').style.display = 'none';
        statusMeiaDiariaInput.style.display = 'none';
        campoStatusMeiaDiaria.style.display = 'none';

        renderDatesWithStatus(datasDobrada, 'containerStatusDiariaDobrada', 'dobrada');
        renderDatesWithStatus(datasMeiaDiaria, 'containerStatusMeiaDiaria', 'meia');
    } else {
        document.getElementById('grupoDiariaDobrada').style.display = 'none';
        document.getElementById('grupoMeiaDiaria').style.display = 'none';

        document.getElementById('selectStatusDiariaDobrada').style.display = 'none';
        statusDiariaDobradaInput.style.display = 'block';
        statusDiariaDobradaInput.value = eventData.statusdiariadobrada || 'Pendente';
        aplicarCorStatusInput(statusDiariaDobradaInput);

        document.getElementById('selectStatusMeiaDiaria').style.display = 'none';
        statusMeiaDiariaInput.style.display = 'block';
        statusMeiaDiariaInput.value = eventData.statusmeiadiaria || 'Pendente';
        aplicarCorStatusInput(statusMeiaDiariaInput);
    }
    updateDisabledDates();
}

// Função para atualizar o contador de diárias e chamar o cálculo
function atualizarContadorDatas() {
    // Pega as datas de evento
    const datasEvento = (datasEventoPicker?.selectedDates || []).map(date => flatpickr.formatDate(date, "Y-m-d"));

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
    if (!diariaDobradaPicker || !meiaDiariaPicker) {
        console.warn("Pickers não inicializados corretamente");
        return;
    }

    if (typeof diariaDobradaPicker.set !== "function" || typeof meiaDiariaPicker.set !== "function") {
        console.error("Um dos pickers não é instância do Flatpickr:", diariaDobradaPicker, meiaDiariaPicker);
        return;
    }

    const datesDobrada = diariaDobradaPicker.selectedDates || [];
    const datesMeiaDiaria = meiaDiariaPicker.selectedDates || [];

    console.log("DATAS SELECIONADAS", datesDobrada, datesMeiaDiaria);

    const datesDobradaStrings = datesDobrada.map(d => flatpickr.formatDate(d, "Y-m-d"));
    const datesMeiaDiariaStrings = datesMeiaDiaria.map(d => flatpickr.formatDate(d, "Y-m-d"));

    meiaDiariaPicker.set('disable', datesDobradaStrings);
    diariaDobradaPicker.set('disable', datesMeiaDiariaStrings);
}

/**
 * Coleta todos os dados do formulário de evento para salvar ou processar.
 * @returns {object} Um objeto contendo todos os dados do formulário,
 * incluindo datas formatadas em strings.
 */
function getDadosFormulario() {
    // Acessa as instâncias de Flatpickr de forma segura
    const datasDobrada = diariaDobradaPicker ? diariaDobradaPicker.selectedDates : [];
    const datasMeiaDiaria = meiaDiariaPicker ? meiaDiariaPicker.selectedDates : [];

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
    eventsTableBody.innerHTML = '';
    noResultsMessage.style.display = 'none';
    currentRowSelected = null;
    isFormLoadedFromDoubleClick = false;

    console.log("CARREGOU TABELA STAFF", isFormLoadedFromDoubleClick);
    if (!funcionarioId) {
        noResultsMessage.style.display = 'block';
        noResultsMessage.textContent = 'Por favor, selecione um funcionário para pesquisar os eventos.';
        return;
    }

    const url = `/staff/${funcionarioId}`; // Sua nova rota GET

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
        console.log('Dados de eventos recebidos para o funcionário:', data);


        if (data && data.length > 0) {
            data.forEach(eventData => {

                const row = eventsTableBody.insertRow();
                row.dataset.eventData = JSON.stringify(eventData);

                if (eventData.status === "Pago"){
                    Swal.fire({
                        icon: 'warning',
                        title: 'Não é possível inserir dados para edição.',
                        text: 'Evento deste funcionário já foi concluído e pago',
                    });
                    return;

                }else{
                    row.addEventListener('dblclick', () => {

                        if (eventData.statuspgto === "Pago" && !temPermissaoTotal) {
                            Swal.fire({
                                icon: 'warning',
                                title: 'Sem permissão para editar.',
                                text: 'Este evento já foi pago não possibilitando a edição.'
                            });
                            return; // Impede que o restante do código do dblclick seja executado
                        }

                        isFormLoadedFromDoubleClick = true;
                        if (currentRowSelected) {
                            currentRowSelected.classList.remove('selected-row');
                        }

                        row.classList.add('selected-row');

                        currentRowSelected = row;

                        carregarDadosParaEditar(eventData)
                    });


                    row.insertCell().textContent = eventData.nmfuncao || '';
                    row.insertCell().textContent = eventData.setor || '';
                    row.insertCell().textContent = eventData.nmcliente || '';
                    row.insertCell().textContent = eventData.nmevento || '';
                    row.insertCell().textContent = eventData.nmlocalmontagem || '';
                    row.insertCell().textContent = eventData.pavilhao || '';
                    row.insertCell().textContent = (eventData.datasevento && typeof eventData.datasevento === 'string')

                    ? JSON.parse(eventData.datasevento) // Primeiro parseia a string JSON para um array
                    .map(dateStr => { // Depois, mapeia cada string de data no array
                        const parts = dateStr.split('-'); // Divide a data (ex: ['2025', '07', '01'])
                        if (parts.length === 3) {
                            return `${parts[2]}/${parts[1]}/${parts[0]}`; // Reorganiza para DD/MM/YYYY
                        }
                        return dateStr; // Retorna a data original se não estiver no formato esperado
                    })
                    .join(', ') // Junta as datas formatadas com vírgula e espaço
                    : (Array.isArray(eventData.datasevento) && eventData.datasevento.length > 0)
                    ? eventData.datasevento // Se já for um array (do backend, por exemplo)
                    .map(dateStr => {
                        const parts = dateStr.split('-');
                        if (parts.length === 3) {
                            return `${parts[2]}/${parts[1]}/${parts[0]}`;
                        }
                        return dateStr;
                    })
                    .join(', ')
                    : 'N/A';

                    row.insertCell().textContent = parseFloat(eventData.vlrcache || 0.00).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                    row.insertCell().textContent = parseFloat(eventData.vlrajustecusto || 0.00).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                    row.insertCell().textContent = eventData.descajustecusto || '';
                    row.insertCell().textContent = parseFloat(eventData.vlralmoco || 0.00).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                    row.insertCell().textContent = parseFloat(eventData.vlrjantar || 0.00).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                    row.insertCell().textContent = parseFloat(eventData.vlrtransporte || 0.00).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                    row.insertCell().textContent = parseFloat(eventData.vlrcaixinha || 0.00).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                    row.insertCell().textContent = eventData.descbeneficios || '';
                    row.insertCell().textContent = parseFloat(eventData.vlrtotal || 0.00).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                    // row.insertCell().textContent = eventData.statuspgto || '';

                    const statusCell = row.insertCell();


                    const status = (eventData.statuspgto || '').toLowerCase();
                    const statusSpan = document.createElement('span');
                    statusSpan.textContent = status.toUpperCase();

                    // Adicione a classe base
                    statusSpan.classList.add('status-pgto');

                    if (status === "pendente") {
                        statusSpan.classList.add('pendente');
                    } else if (status === "pago") {
                        statusSpan.classList.add('pago');
                    }
                    statusCell.appendChild(statusSpan);
                }

            });
        } else {
            noResultsMessage.style.display = 'block';
            noResultsMessage.textContent = `Nenhum evento encontrado para o funcionário selecionado.`;
        }

    } catch (error) {
        console.error('Erro ao buscar dados de eventos do funcionário:', error);
        noResultsMessage.style.display = 'block';
        noResultsMessage.textContent = `Erro ao carregar dados: ${error.message}. Tente novamente.`;
    }
};

function aplicarCoresAsOpcoes(selectElementId) {
    console.log("Aplicando cores às opções do select:", selectElementId);
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
    console.log("Aplicando cores no select:", selectElement.id);
    const statusAtual = selectElement.value;
    selectElement.classList.remove('status-Pendente', 'status-Autorizado', 'status-Rejeitado');
    if (statusAtual) {
        selectElement.classList.add('status-' + statusAtual);
        console.log("Status Atual:", statusAtual);
    }
}
function aplicarCorStatusInput(elementoInput) {
    console.log("Aplicando cores no input:", elementoInput.id);
    elementoInput.classList.remove('status-Pendente', 'status-Autorizado', 'status-Rejeitado');
    const statusAtual = elementoInput.value;
    if (statusAtual) {
        elementoInput.classList.add('status-' + statusAtual);
        console.log("Status Atual INPUT:", statusAtual);
    }
}


console.log("não carregou Verificar");
async function verificaStaff() {

    console.log("Carregando Staff...");

    configurarPreviewPDF();
    configurarPreviewImagem();
    inicializarFlatpickrsGlobais();

    carregarFuncaoStaff();
    carregarFuncionarioStaff();
    carregarClientesStaff();
    carregarEventosStaff();
    carregarLocalMontStaff();

    configurarFlatpickrs();

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

    botaoLimpar.addEventListener("click", function (event) {
        event.preventDefault(); // Previne o envio padrão do formulário
        form.reset();
        limparCamposStaff();
    });

    const labelFileAjdCusto = document.getElementById('labelFileAjdCusto');
    const labelFileCaixinha = document.getElementById('labelFileCaixinha');

    // Lógica para o comprovante de Ajuda de Custo
    labelFileAjdCusto.addEventListener('click', (event) => {
        const vlrAlmoco = parseFloat(almocoInput.value.replace(',', '.') || 0.00);
        const vlrJantar = parseFloat(jantarInput.value.replace(',', '.') || 0.00);
        const vlrTransporte = parseFloat(transporteInput.value.replace(',', '.') || 0.00);

        // Se os valores estiverem zerados, previne a ação e exibe o alerta
        if (vlrAlmoco === 0 && vlrJantar === 0 && vlrTransporte === 0) {
            event.preventDefault(); // Impede a abertura do modal de upload
            Swal.fire({
                icon: 'warning',
                title: 'Não é possível inserir comprovante',
                text: 'Os valores de Almoço, Jantar e Transporte devem ser maiores que zero para inserir um comprovante.',
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

    ajusteCustoInput.addEventListener('change', () => {
        let valor = ajusteCustoInput.value.replace(',', '.');
        if (!isNaN(parseFloat(valor))) {
            ajusteCustoInput.value = parseFloat(valor).toFixed(2).replace('.', ',');
        } else {
            ajusteCustoInput.value = '0,00';
        }
    });

    const selectAjusteCusto = document.getElementById('selectStatusAjusteCusto');

    if (selectAjusteCusto) {
        selectAjusteCusto.addEventListener('change', () => {
            aplicarCorNoSelect(selectAjusteCusto);
            statusAjusteCustoInput.value = selectStatusAjusteCusto.value;
            console.log("Status de Ajuste de Custo sincronizado para:", statusAjusteCustoInput.value);
        });
    }


    ajusteCustocheck.addEventListener('change', (e) => {
        const isCheckedBeforeSwal = ajusteCustocheck.checked;
        const ajusteCustoTextarea = document.getElementById('descAjusteCusto');
        const campoStatusAjusteCusto = document.getElementById('statusAjusteCusto');

           // Se qualquer um dos elementos não for encontrado, interrompe a execução
        if (!ajusteCustoInput || !ajusteCustoTextarea || !campoStatusAjusteCusto) {
            console.error("Um ou mais elementos do bônus não foram encontrados. Verifique os IDs.");
            // Opcional: Adicionar um alerta para o usuário
            Swal.fire('Erro!', 'Ocorreu um problema ao carregar os campos do bônus. Tente recarregar a página.', 'error');
            return; // Sai da função para evitar o erro
        }

        console.log("AJUSTE DE CUSTO CHECKBOX ALTERADO", isCheckedBeforeSwal, currentEditingStaffEvent, campoStatusAjusteCusto.value);

        // Inicia com valores padrão para o caso de novo cadastro
        let valorAjusteCustoOriginal = 0;
        let descAjusteCustoOriginal = '';
        let statusAjusteCustoOriginal = 'Pendente';

        // Se estiver em modo de edição, sobrescreve com os valores originais
        if (currentEditingStaffEvent) {
            valorAjusteCustoOriginal = parseFloat(currentEditingStaffEvent.vlrajustecusto || 0.00);
            descAjusteCustoOriginal = currentEditingStaffEvent.descajustecusto || '';
            statusAjusteCustoOriginal = currentEditingStaffEvent.statusajustecusto || 'Pendente';
        }

        if (!isCheckedBeforeSwal) {
            // Lógica para quando o usuário desmarca a caixa
            if (statusAjusteCustoOriginal !== 'Pendente') {
                e.preventDefault();
                Swal.fire({
                    title: 'Atenção!',
                    text: `Não é possível remover o Ajuste de Custo pois seu status é "${statusAjusteCustoOriginal}".`,
                    icon: 'error',
                    confirmButtonColor: '#3085d6',
                    confirmButtonText: 'Ok'
                }).then(() => {
                    ajusteCustocheck.checked = true;
                    ajusteCustoInput.value = valorAjusteCustoOriginal.toFixed(2).replace('.', ',');
                    ajusteCustoTextarea.value = descAjusteCustoOriginal;
                    campoStatusAjusteCusto.value = statusAjusteCustoOriginal;

                    // Exibe os campos novamente
                    campoAjusteCusto.style.display = 'block';
                    ajusteCustoTextarea.style.display = 'block';
                    campoStatusAjusteCusto.style.setProperty('display', 'block', 'important');

                    calcularValorTotal();
                });
            } else if (valorAjusteCustoOriginal > 0) {
                e.preventDefault();
                Swal.fire({
                    title: 'Atenção!',
                    text: 'Você tem um valor preenchido para o Ajuste de Custo. Desmarcar a caixa irá remover esse valor e a descrição. Deseja continuar?',
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#3085d6',
                    cancelButtonColor: '#d33',
                    confirmButtonText: 'Sim, continuar!',
                    cancelButtonText: 'Não, cancelar'
                }).then((result) => {
                    if (result.isConfirmed) {
                        ajusteCustocheck.checked = false;
                        campoAjusteCusto.style.display = 'none';
                        ajusteCustoTextarea.style.display = 'none';
                        campoStatusAjusteCusto.style.display = 'none';
                        ajusteCustoInput.value = '0,00';
                        ajusteCustoTextarea.value = '';
                        campoStatusAjusteCusto.value = 'Pendente';
                        calcularValorTotal();
                    } else {
                        ajusteCustocheck.checked = true;
                        ajusteCustoInput.value = valorAjusteCustoOriginal.toFixed(2).replace('.', ',');
                        ajusteCustoTextarea.value = descAjusteCustoOriginal;
                        campoStatusajusteCusto.value = statusAjusteCustoOriginal;

                        // Exibe os campos novamente
                        campoAjusteCusto.style.display = 'block';
                        ajusteCustoTextarea.style.display = 'block';
                        campoStatusAjusteCusto.style.setProperty('display', 'block', 'important');

                        calcularValorTotal();
                    }
                });
            } else {
                // Se não há valor e o status é pendente, simplesmente desmarque
                campoAjusteCusto.style.display = 'none';
                ajusteCustoTextarea.style.display = 'none';
                campoStatusAjusteCusto.style.display = 'none';
                ajusteCustoInput.value = '0,00';
                ajusteCustoTextarea.value = '';
                campoStatusAjusteCusto.value = 'Pendente';
                calcularValorTotal();
            }
        } else {
            // Lógica padrão quando o usuário marca a caixa
            campoAjusteCusto.style.display = 'block';
            ajusteCustoTextarea.style.display = 'block';
            campoStatusAjusteCusto.style.setProperty('display', 'block', 'important');

            // Os valores já foram definidos no início do listener
            ajusteCustoInput.value = valorAjusteCustoOriginal.toFixed(2).replace('.', ',');
            ajusteCustoTextarea.value = descAjusteCustoOriginal;
            campoStatusAjusteCusto.value = statusAjusteCustoOriginal;

            calcularValorTotal();
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

    caixinhaInput.addEventListener('change', () => {
        let valor = caixinhaInput.value.replace(',', '.');
        if (!isNaN(parseFloat(valor))) {
            caixinhaInput.value = parseFloat(valor).toFixed(2).replace('.', ',');
        } else {
            caixinhaInput.value = '0,00';
        }
    });

    caixinhacheck.addEventListener('change', (e) => {
        // Ação padrão: desativa o comportamento padrão do evento se houver lógica adicional
        // e.preventDefault(); // Comentei esta linha pois ela pode impedir a mudança visual do checkbox

        // Assegura que o campo de valor e a descrição sejam acessados corretamente
        const caixinhaInput = document.getElementById('caixinha');
        const descCaixinhaTextarea = document.getElementById('descCaixinha');
        const campoStatusCaixinha = document.getElementById('statusCaixinha');

        // Inicia com valores padrão para o caso de novo cadastro
        let valorCaixinhaOriginal = 0;
        let descCaixinhaOriginal = '';
        let statusCaixinhaOriginal = 'Pendente';

        // Se estiver em modo de edição, sobrescreve com os valores originais
        if (currentEditingStaffEvent) {
            valorCaixinhaOriginal = parseFloat(currentEditingStaffEvent.vlrcaixinha || 0.00);
            descCaixinhaOriginal = currentEditingStaffEvent.desccaixinha || '';
            statusCaixinhaOriginal = currentEditingStaffEvent.statuscaixinha || 'Pendente';
        }

        const isCheckedBeforeSwal = caixinhacheck.checked;

        if (!isCheckedBeforeSwal) {
            // Lógica para quando o usuário desmarca a caixa
            if (statusCaixinhaOriginal !== 'Pendente') {
                e.preventDefault();
                Swal.fire({
                    title: 'Atenção!',
                    text: `Não é possível remover a Caixinha pois seu status é "${statusCaixinhaOriginal}".`,
                    icon: 'error',
                    confirmButtonColor: '#3085d6',
                    confirmButtonText: 'Ok'
                }).then(() => {
                    caixinhacheck.checked = true;
                    caixinhaInput.value = valorCaixinhaOriginal.toFixed(2).replace('.', ',');
                    descCaixinhaTextarea.value = descCaixinhaOriginal;
                    campoStatusCaixinha.value = statusCaixinhaOriginal;

                    // Exibe os campos novamente
                    campoCaixinha.style.display = 'block';
                    descCaixinhaTextarea.style.display = 'block';
                    campoStatusCaixinha.style.setProperty('display', 'block', 'important');

                    calcularValorTotal();
                });
            } else if (valorCaixinhaOriginal > 0) {
                e.preventDefault();
                Swal.fire({
                    title: 'Atenção!',
                    text: 'Você tem um valor preenchido para o Caixinha. Desmarcar a caixa irá remover esse valor e a descrição. Deseja continuar?',
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#3085d6',
                    cancelButtonColor: '#d33',
                    confirmButtonText: 'Sim, continuar!',
                    cancelButtonText: 'Não, cancelar'
                }).then((result) => {
                    if (result.isConfirmed) {
                        caixinhacheck.checked = false;
                        campoCaixinha.style.display = 'none';
                        descCaixinhaTextarea.style.display = 'none';
                        campoStatusCaixinha.style.display = 'none';
                        caixinhaInput.value = '0,00';
                        descCaixinhaTextarea.value = '';
                        campoStatusCaixinha.value = 'Pendente';
                        calcularValorTotal();
                    } else {
                        caixinhacheck.checked = true;
                        caixinhaInput.value = valorCaixinhaOriginal.toFixed(2).replace('.', ',');
                        descCaixinhaTextarea.value = descCaixinhaOriginal;
                        campoStatusCaixinha.value = statusCaixinhaOriginal;

                        // Exibe os campos novamente
                        campoCaixinha.style.display = 'block';
                        descCaixinhaTextarea.style.display = 'block';
                        campoStatusCaixinha.style.setProperty('display', 'block', 'important');

                        calcularValorTotal();
                    }
                });
            } else {
                // Se não há valor e o status é pendente, simplesmente desmarque
                campoCaixinha.style.display = 'none';
                descCaixinhaTextarea.style.display = 'none';
                campoStatusCaixinha.style.display = 'none';
                caixinhaInput.value = '0,00';
                descCaixinhaTextarea.value = '';
                campoStatusCaixinha.value = 'Pendente';
                calcularValorTotal();
            }
        } else {
            // Lógica padrão quando o usuário marca a caixa
            campoCaixinha.style.display = 'block';
            descCaixinhaTextarea.style.display = 'block';
            campoStatusCaixinha.style.setProperty('display', 'block', 'important');

            // Os valores já foram definidos no início do listener
            caixinhaInput.value = valorCaixinhaOriginal.toFixed(2).replace('.', ',');
            descCaixinhaTextarea.value = descCaixinhaOriginal;
            campoStatusCaixinha.value = statusCaixinhaOriginal;

            calcularValorTotal();
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



    botaoEnviar.addEventListener("click", async (event) => {
        event.preventDefault(); // Previne o envio padrão do formulário

        const datasEventoRawValue = datasEventoPicker?.selectedDates || [];
        const periodoDoEvento = datasEventoRawValue.map(date => flatpickr.formatDate(date, "Y-m-d"));

        const diariaDobradaRawValue = diariaDobradaPicker?.selectedDates || [];
        const periodoDobrado = diariaDobradaRawValue.map(date => flatpickr.formatDate(date, "Y-m-d"));

        const diariaMeiaRawValue = meiaDiariaPicker?.selectedDates || [];
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
        const almoco = document.querySelector("#almoco").value.trim() || '0';
        const jantar = document.querySelector("#jantar").value.trim() || '0';
        const caixinha = document.querySelector("#caixinha").value.trim() || '0';
        const idCliente = document.querySelector("#idCliente").value;
        const selectCliente = document.getElementById("nmCliente");
        const nmCliente = selectCliente.options[selectCliente.selectedIndex]?.textContent.trim().toUpperCase() || '';
        const idEvento = document.querySelector("#idEvento").value;
        const selectEvento = document.getElementById("nmEvento");
        const nmEvento = selectEvento.options[selectEvento.selectedIndex]?.textContent.trim().toUpperCase() || '';
        const idMontagem = document.querySelector("#idMontagem").value; // ID do local de montagem (FK)
        const selectLocalMontagem = document.getElementById("nmLocalMontagem");
        const nmLocalMontagem = selectLocalMontagem.options[selectLocalMontagem.selectedIndex].textContent.trim();
        const selectPavilhao = document.getElementById("nmPavilhao");
        let pavilhao = selectPavilhao.options[selectPavilhao.selectedIndex]?.textContent.trim().toUpperCase() || '';
        const caixinhaAtivo = document.getElementById("Caixinhacheck")?.checked;
        const ajusteCustoAtivo = document.getElementById("ajusteCustocheck")?.checked;
        const descBeneficioInput = document.getElementById("descBeneficio");
        const descBeneficio = descBeneficioInput?.value.trim() || "";

        const descAjusteCustoInput = document.getElementById("descAjusteCusto");
        const descAjusteCusto = descAjusteCustoInput.value.trim() || "";
        //const statusAjusteCusto = document.getElementById("statusAjusteCusto").value;
     

        const setor = document.querySelector("#setor").value.trim().toUpperCase();

        const descCaixinhaInput = document.getElementById("descCaixinha");
        const descCaixinha = descCaixinhaInput?.value.trim() || "";
        //const statusCaixinha = document.getElementById("statusCaixinha").value;

        const selectStatusAjusteCusto = document.getElementById("statusAjusteCusto");
        console.log("Elemento `statusAjusteCusto`:", selectStatusAjusteCusto);
        const statusAjusteCusto = selectStatusAjusteCusto?.value?.trim() || '';

        console.log("Valor `statusAjusteCusto`:", statusAjusteCusto);

        const selectStatusCaixinha = document.getElementById("statusCaixinha");
        const statusCaixinha = selectStatusCaixinha?.value?.trim() || '';

        const diariaDobrada = document.getElementById("diariaDobradacheck")?.checked;
        const meiaDiaria = document.getElementById("meiaDiariacheck")?.checked;
        let statusDiariaDobrada = document.getElementById("statusDiariaDobrada").value;
        let statusMeiaDiaria = document.getElementById("statusMeiaDiaria").value;

        const seniorCheck = document.getElementById('Seniorcheck');
        const plenoCheck = document.getElementById('Plenocheck');
        const juniorCheck = document.getElementById('Juniorcheck');
        const baseCheck = document.getElementById('Basecheck');

        const almocoCheck = document.getElementById('Almococheck');
        const jantarCheck = document.getElementById('Jantarcheck');

        console.log("Status Ajuste de Custo", statusAjusteCusto);

        console.log("STATUS", statusCaixinha, statusAjusteCusto, diariaDobradaInput, datasEventoInput);

        if (periodoDoEvento.length === 0) {
            return Swal.fire("Campo obrigatório!", "Por favor, selecione os dias do evento.", "warning");
        }
        if (diariaDobradacheck.checked && periodoDobrado.length === 0) {
            return Swal.fire(
                "Campo obrigatório!",
                "Por favor, selecione os dias de Dobra no evento.",
                "warning"
            );
        }
        if (meiaDiariacheck.checked && periodoMeiaDiaria.length === 0) {
            return Swal.fire(
                "Campo obrigatório!",
                "Por favor, selecione os dias de Dobra no evento.",
                "warning"
            );
        }   
            const vlrTotal = document.getElementById('vlrTotal').value;
            const total = parseFloat(
            vlrTotal
                .replace('R$', '')
                .replace(/\./g, '')
                .replace(',', '.')
                .trim()
            ) || 0.00;


            if(!nmFuncionario || !descFuncao || !vlrCusto || !nmCliente || !nmEvento || !periodoDoEvento){
                return Swal.fire("Campos obrigatórios!", "Preencha todos os campos obrigatórios: Funcionário, Função, Cachê, Transportes, Alimentação, Cliente, Evento e Período do Evento.", "warning");
            }

            if (!seniorCheck.checked &&  !plenoCheck.checked &&  !juniorCheck.checked &&  !baseCheck.checked) {
                return Swal.fire(
                    "Nível de Experiência não selecionado!",
                    "Por favor, selecione pelo menos um nível de experiência: Sênior, Pleno, Júnior ou Base.",
                    "warning"
                );
            }

            if ((caixinhaAtivo) && !descCaixinha) {

                if (descCaixinhaInput) {
                    descCaixinhaInput.focus();
                }

                return Swal.fire(
                    "Campos obrigatórios!",
                    "Preencha a descrição do benefício (Caixinha) antes de salvar.",
                    "warning"
                );
            }

            if ((ajusteCustoAtivo) && !descAjusteCusto) {

                if (descAjusteCustoInput) {
                    descAjusteCustoInput.focus();
                }

                return Swal.fire(
                    "Campos obrigatórios!",
                    "Preencha a descrição do bônus antes de salvar.",
                    "warning"
                );
            }

            const temPermissaoCadastrar = temPermissao("Staff", "cadastrar");
            const temPermissaoAlterar = temPermissao("Staff", "alterar");

            const idStaffEvento = document.querySelector("#idStaffEvento").value;

            const isEditingInitial = !!(currentEditingStaffEvent && currentEditingStaffEvent.idstaffevento);

            const idEventoEmEdicao = isEditingInitial ? currentEditingStaffEvent.idstaffevento : null;

            console.log("EM EDIÇÃO?", isEditingInitial, idEventoEmEdicao);

            let metodo = isEditingInitial ? "PUT" : "POST";
            let url = isEditingInitial ? `/staff/${idEventoEmEdicao}` : "/staff";

            const idStaffEventoFromObject = currentEditingStaffEvent ? currentEditingStaffEvent.idstaffevento : null;

            const idStaffEventoNumero = parseInt(idStaffEvento, 10);

            if (idStaffEventoFromObject === idStaffEventoNumero)
            {
                console.log("IDS SÃO IGUAIS", idStaffEventoFromObject, idStaffEventoNumero);
            } else {
                console.log("IDS SÃO DIFERENTES", idStaffEventoFromObject, idStaffEventoNumero);
            }

            if (idStaffEvento && isFormLoadedFromDoubleClick && currentEditingStaffEvent && idStaffEventoFromObject === idStaffEventoNumero) {
                console.log("ENTROU NO METODO PUT");
                metodo = "PUT";
                url = `/staff/${idStaffEvento}`;
                console.log("Modo de edição detectado via idstaffevento e flag. Método:", metodo, "URL:", url);
            } else {

                metodo = "POST";
                url = "/staff";
                console.log("Modo de cadastro detectado. Método:", metodo, "URL:", url, "Status Orcamento", statusOrcamentoAtual);

                currentEditingStaffEvent = null;
                isFormLoadedFromDoubleClick = false;
            }

            if (pavilhao === "SELECIONE O PAVILHÃO") {
                pavilhao = "";
            }

            if (metodo === "POST" && !temPermissaoCadastrar) {
                return Swal.fire("Acesso negado", "Você não tem permissão para cadastrar novos staffs.", "error");
            }

            if (metodo === "PUT" && !temPermissaoAlterar) {
                return Swal.fire("Acesso negado", "Você não tem permissão para alterar staffs.", "error");
            }

            console.log("--- INÍCIO handleFormSubmit ---");
            console.log("Método inicial:", metodo); // POST ou PUT
            console.log("Carregado por duplo clique (isFormLoadedFromDoubleClick):", isFormLoadedFromDoubleClick);
            console.log("currentEditingStaffEvent (antes da verificação):", currentEditingStaffEvent);

            const idFuncionarioParaVerificacao = idFuncionario; 
            const idFuncaoDoFormulario = idFuncao;         

            const flatpickrForDatasEvento = window.flatpickrInstances['datasEvento'];
            const datasParaVerificacao = flatpickrForDatasEvento?.selectedDates || [];
            

            const isDiariaDobradaChecked = diariaDobradacheck.checked;

            console.log("Parâmetros para verificarDisponibilidadeStaff:", {
            idFuncionarioParaVerificacao,   
            periodoDoEvento,
            idFuncaoDoFormulario,
            idEventoEmEdicao
        });

            console.log("Iniciando verificação de disponibilidade do staff...");
            const { isAvailable, conflictingEvent } = await verificarDisponibilidadeStaff(
                idFuncionarioParaVerificacao,               
                periodoDoEvento,
                idFuncaoDoFormulario,
                idEventoEmEdicao

            );


            console.log("Dados do formulário para verificação de duplicidade:", {
                idFuncionario: idFuncionario,
                nmFuncionario: nmFuncionario,
                idFuncao: idFuncao,
                setor: setor,
                nmlocalmontagem: nmLocalMontagem,
                nmevento: nmEvento,
                nmcliente: nmCliente,
                datasevento: JSON.stringify(periodoDoEvento)
            });


            if (!isAvailable) {

                if (conflictingEvent && String(conflictingEvent.idfuncao) === String(idFuncaoDoFormulario) && !isDiariaDobradaChecked) {

                    let msg = `O funcionário <strong>${nmFuncionario}</strong> já está agendado para a <strong>mesma função</strong>`;
                    if (conflictingEvent) {
                        msg += ` no evento "<strong>${conflictingEvent.nmevento || 'N/A'}</strong>" do cliente "<strong>${conflictingEvent.nmcliente || 'N/A'}</strong>"`;
                    }

                    Swal.fire({
                        title: "Conflito de Agendamento",
                        html: msg,
                        icon: "error"
                    });
                    return;

                } else {

                    let msg = `O funcionário <strong>${nmFuncionario}</strong> já está agendado para uma <strong>função diferente</strong> `;


                    if (isDiariaDobradaChecked) {
                        msg = `O funcionário <strong>${nmFuncionario}</strong> já está agendado em <strong>outra atividade</strong> na(s) data(s) conflitante(s).`;
                    }

                    if (conflictingEvent) {
                        msg += `no evento "<strong>${conflictingEvent.nmevento || 'N/A'}</strong>" do cliente "<strong>${conflictingEvent.nmcliente || 'N/A'}</strong>" `;
                    }

                    const conflictingDates = typeof conflictingEvent.datasevento === 'string' ? JSON.parse(conflictingEvent.datasevento) : conflictingEvent.datasevento;
                    const intersection = datasParaVerificacao.map(d => d.toISOString().split('T')[0]).filter(date => conflictingDates.includes(date));
                    if (intersection.length > 0) {
                        msg += `nas datas: <strong>${intersection.map(d => {
                            const parts = d.split('-');
                            return `${parts[2]}/${parts[1]}/${parts[0]}`;
                        }).join(', ')}</strong>.`;
                    } else {
                        msg += `em datas conflitantes.`;
                    }

                    msg += `<br>Deseja continuar com o agendamento?`;

                    const { isConfirmed } = await Swal.fire({
                        title: "Atenção: Conflito de Agendamento!",
                        html: msg,
                        icon: "warning",
                        showCancelButton: true,
                        confirmButtonText: "Sim, continuar",
                        cancelButtonText: "Não, cancelar",
                    });

                    if (!isConfirmed) {
                        return;
                    }
                }
            }

            console.log("Preparando dados para envio:", {
                nmFuncionario, descFuncao, nmLocalMontagem, nmCliente, nmEvento, vlrCusto, ajusteCusto, transporte, almoco, jantar, caixinha,
                periodoDoEvento, vlrTotal
            });

            if (metodo === "POST")
             {
                const datasSelecionadas = window.flatpickrInstances['datasEvento']?.selectedDates.map(date => {
                    return date.toISOString().split('T')[0];
                }) || []; // Adicione um fallback para um array vazio

                // Corrija a linha para usar o 'chaining opcional' e um fallback
                const datasDobradas = window.flatpickrInstances['diariaDobrada']?.selectedDates.map(date => {
                    return date.toISOString().split('T')[0];
                }) || []; 

                const periodoDoEvento = [...datasSelecionadas, ...datasDobradas];

                const criteriosDeVerificacao = {
                    nmFuncao: descFuncaoSelect.options[descFuncaoSelect.selectedIndex].text,
                    nmEvento: nmEventoSelect.options[nmEventoSelect.selectedIndex].text,
                    nmCliente: nmClienteSelect.options[nmClienteSelect.selectedIndex].text,
                    nmlocalMontagem: nmLocalMontagemSelect.options[nmLocalMontagemSelect.selectedIndex].text,
                    pavilhao: nmPavilhaoSelect.options[nmPavilhaoSelect.selectedIndex].text,
                    datasEvento: datasSelecionadas,
                    datasEventoDobradas: datasDobradas
                };

                if (!isFormLoadedFromDoubleClick && !verificarLimiteDeFuncao(criteriosDeVerificacao)) {

                    return;
                }

            }

            if (metodo === "POST" || (metodo === "PUT" && !isFormLoadedFromDoubleClick)) {
                console.log("Iniciando verificação de duplicidade. Método Inicial:", metodo, "Carregado por duplo clique:", isFormLoadedFromDoubleClick);
                try {
                    const checkDuplicateUrl = `/staff/check-duplicate?` + new URLSearchParams({
                        idFuncionario: idFuncionario,
                        nmFuncionario: nmFuncionario,
                        setor: setor,
                        nmlocalmontagem: nmLocalMontagem,
                        nmevento: nmEvento,
                        nmcliente: nmCliente,
                        datasevento: JSON.stringify(periodoDoEvento)
                    }).toString();

                    const duplicateCheckResult = await fetchComToken(checkDuplicateUrl, {
                        method: 'GET',
                        headers: { 'Content-Type': 'application/json' }
                    });

                    if (duplicateCheckResult.isDuplicate) {

                        const existingEventData = duplicateCheckResult.existingEvent;

                        console.log("!!! DUPLICADO ENCONTRADO !!!");
                        console.log("Evento duplicado retornado pelo backend:", existingEventData);
                        console.log("Comparando:", currentEditingStaffEvent?.idstaffevento, "com", existingEventData?.idstaffevento);


                        console.log("COMPARACAO", currentEditingStaffEvent, existingEventData);

                        if (currentEditingStaffEvent && currentEditingStaffEvent.idstaffevento === existingEventData.idstaffevento) {

                            console.log("Evento existente detectado e em modo de edição. É o mesmo registro. Prosseguindo para verificação de alteração.");
                            metodo = "PUT"; // Garante que o método continua PUT
                            url = `/staff/${existingEventData.idstaffevento}`; // Garante a URL correta
                            currentEditingStaffEvent = existingEventData; // Atualiza com os dados mais recentes do backend
                            // isFormLoadedFromDoubleClick = true; // Já deveria ser true se chegou aqui por duplo clique
                        } else {

                            const { isConfirmed } = await Swal.fire({
                                icon: "info",
                                title: "Evento Duplicado!",
                                html: `O evento para o funcionário <strong>${nmFuncionario}</strong> com as datas selecionadas já está cadastrado.<br><br>Deseja Atualizar o registro existente?`,
                                showCancelButton: true,
                                confirmButtonText: "Sim, atualizar",
                                cancelButtonText: "Não, cancelar",
                                reverseButtons: true
                            });

                            if (!isConfirmed) {
                                console.log("Usuário optou por não atualizar o evento duplicado.");
                                return;
                            }

                            console.log("Usuário confirmou a atualização do evento duplicado. Alterando para modo PUT.");
                            metodo = "PUT";
                            url = `/staff/${existingEventData.idstaffevento}`; // Usa o ID do evento duplicado encontrado
                            currentEditingStaffEvent = existingEventData; // Define o evento a ser editado como o duplicado
                            isFormLoadedFromDoubleClick = true; // Marca como "carregado por duplo clique" para pular a verificação futura para este item
                        }

                    } else {

                        console.log("Nenhum evento duplicado encontrado. Prosseguindo com o método original:", metodo);
                    }
                } catch (error) {
                    console.error("Erro na verificação de duplicidade:", error);
                    Swal.fire("Erro", error.message || "Não foi possível verificar duplicidade. Tente novamente.", "error");
                    return; // Bloqueia o envio se houver erro na verificação
                }
            } else {
                console.log("Pulando verificação de duplicidade (modo de edição via duplo clique já está ativo).");
            }

            const formData = new FormData();
            // Adiciona todos os campos de texto ao FormData
            formData.append('avaliacao', avaliacao);
            formData.append('idfuncionario', idFuncionario);
            formData.append('nmfuncionario', nmFuncionario);
            formData.append('idfuncao', idFuncao);
            formData.append('nmfuncao', descFuncao);
            formData.append('idcliente', idCliente);
            formData.append('nmcliente', nmCliente);
            formData.append('idevento', idEvento);
            formData.append('nmevento', nmEvento);
            formData.append('idmontagem', idMontagem);
            formData.append('nmlocalmontagem', nmLocalMontagem);
            formData.append('pavilhao', pavilhao);
            formData.append('vlrcache', vlrCusto);
            formData.append('vlrajustecusto', ajusteCusto);
            formData.append('vlrtransporte', transporte);
            formData.append('vlralmoco', almoco);
            formData.append('vlrjantar', jantar);
            formData.append('vlrcaixinha', caixinha);
            formData.append('descajustecusto', ajusteCustoTextarea.value.trim());
            formData.append('datasevento', JSON.stringify(periodoDoEvento));
            formData.append('vlrtotal', total.toString());


            const fileCacheInput = document.getElementById('fileCache');
            const hiddenRemoverCacheInput = document.getElementById('limparComprovanteCache');
            let comppgtocacheDoForm;

            if (fileCacheInput.files && fileCacheInput.files[0]) {

                formData.append('comppgtocache', fileCacheInput.files[0]);
                comppgtocacheDoForm = 'novo-arquivo';
            } else if (hiddenRemoverCacheInput.value === 'true') {

                formData.append('limparComprovanteCache', 'true');
                comppgtocacheDoForm = '';
            } else if (currentEditingStaffEvent && currentEditingStaffEvent.comppgtocache) {

                comppgtocacheDoForm = currentEditingStaffEvent.comppgtocache;
            } else {

                comppgtocacheDoForm = '';
            }


            const fileAjdCustoInput = document.getElementById('fileAjdCusto');
            const hiddenRemoverAjdCustoInput = document.getElementById('limparComprovanteAjdCusto');

            const fileAjdCusto2Input = document.getElementById('fileAjdCusto2');
            const hiddenRemoverAjdCusto2Input = document.getElementById('limparComprovanteAjdCusto2');
            let comppgtoajdcustoDoForm;
            let comppgtoajdcusto50DoForm;

            if (fileAjdCustoInput.files && fileAjdCustoInput.files[0]) {
                formData.append('comppgtoajdcusto', fileAjdCustoInput.files[0]);
                comppgtoajdcustoDoForm = 'novo-arquivo';
            } else if (hiddenRemoverAjdCustoInput.value === 'true') {
                formData.append('limparComprovanteAjdCusto', 'true');
                comppgtoajdcustoDoForm = '';
            } else if (currentEditingStaffEvent && currentEditingStaffEvent.comppgtoajdcusto) {
                comppgtoajdcustoDoForm = currentEditingStaffEvent.comppgtoajdcusto;
            } else {
                comppgtoajdcustoDoForm = '';
            }

            if (fileAjdCusto2Input.files && fileAjdCusto2Input.files[0]) {
                formData.append('comppgtoajdcusto50', fileAjdCusto2Input.files[0]);
                comppgtoajdcusto50DoForm = 'novo-arquivo';
            } else if (hiddenRemoverAjdCusto2Input.value === 'true') {
                formData.append('limparComprovanteAjdCusto2', 'true');
                comppgtoajdcusto50DoForm = '';
            } else if (currentEditingStaffEvent && currentEditingStaffEvent.comppgtoajdcusto50) {
                comppgtoajdcusto50DoForm = currentEditingStaffEvent.comppgtoajdcusto50;
            } else {
                comppgtoajdcusto50DoForm = '';
            }

            const fileCaixinhaInput = document.getElementById('fileCaixinha');
            const hiddenRemoverCaixinhaInput = document.getElementById('limparComprovanteCaixinha');
            let comppgtocaixinhaDoForm;

            if (fileCaixinhaInput.files && fileCaixinhaInput.files[0]) {
                formData.append('comppgtocaixinha', fileCaixinhaInput.files[0]);
                comppgtocaixinhaDoForm = 'novo-arquivo';
            } else if (hiddenRemoverCaixinhaInput.value === 'true') {
                formData.append('limparComprovanteCaixinha', 'true');
                comppgtocaixinhaDoForm = '';
            } else if (currentEditingStaffEvent && currentEditingStaffEvent.comppgtocaixinha) {
                comppgtocaixinhaDoForm = currentEditingStaffEvent.comppgtocaixinha;
            } else {
                comppgtocaixinhaDoForm = '';
            }

            formData.append('descbeneficios', descBeneficioTextarea.value.trim());
            formData.append('setor', setor);

            let statusPgto = "Pendente"; // Valor padrão

            console.log("VALORES CUSTOS ANTES", vlrCusto, ajusteCusto, caixinha, almoco, jantar, transporte);
            const custosVazios = ajusteCusto === 0 && caixinha === 0 && almoco === 0 && jantar === 0 && transporte === 0;
            console.log("VALORES CUSTOS DEPOIS", vlrCusto, ajusteCusto, caixinha, almoco, jantar, transporte, comppgtocacheDoForm, comppgtocacheDoForm, comppgtocaixinhaDoForm);

            const vlrAjusteCusto = parseFloat(ajusteCusto);
            const vlrCache = parseFloat(vlrCusto);
            const vlrAlmoco = parseFloat(almoco);
            const vlrJantar = parseFloat(jantar);
            const vlrTransporte = parseFloat(transporte);
            const vlrCaixinha = parseFloat(caixinha);

            const temComprovanteCache = !!comppgtocacheDoForm;
            const temComprovanteAjudaCusto = !!comppgtoajdcustoDoForm;
            const temComprovanteAjudaCusto50 = !!comppgtoajdcusto50DoForm;
            const temComprovanteCaixinha = !!comppgtocaixinhaDoForm;

            const cachePago = (vlrCache > 0 && temComprovanteCache);
            const ajudaCustoPaga = ((vlrAlmoco > 0 || vlrJantar > 0 || vlrTransporte > 0) && temComprovanteAjudaCusto);
            const caixinhasPagos = ((vlrCaixinha > 0) && temComprovanteCaixinha);


            if (cachePago && ajudaCustoPaga && caixinhasPagos) {

                statusPgto = "Pago";
            } else if (
                (vlrCache <= 0 || (vlrCache > 0 && temComprovanteCache)) && // Se o cache não precisa de comprovação ou está pago
                ((vlrAlmoco <= 0 && vlrJantar <= 0 && vlrTransporte <= 0) || ((vlrAlmoco > 0 || vlrJantar > 0 || vlrTransporte > 0) && temComprovanteAjudaCusto)) && // Mesma lógica para ajuda de custo
                (vlrCaixinha <= 0 || (vlrCaixinha > 0 && temComprovanteCaixinha))
            ) {

                statusPgto = "Pago";
            } else {
                statusPgto = "Pendente";
            }


            formData.append('statuspgto', statusPgto);
            formData.append('statusajustecusto', statusAjusteCusto);
            formData.append('statuscaixinha', statusCaixinha);
            formData.append('descdiariadobrada', descDiariaDobradaTextarea.value.trim());
            formData.append('descmeiadiaria', descMeiaDiariaTextarea.value.trim());
            formData.append('desccaixinha', descCaixinhaTextarea.value.trim());



           
           
            let nivelExperienciaSelecionado ="";

            if (seniorCheck.checked) {
                nivelExperienciaSelecionado =  "Senior";
            } 
            if (plenoCheck.checked) {
                nivelExperienciaSelecionado =  "Pleno";
            } 
            if (juniorCheck.checked) {
                nivelExperienciaSelecionado =  "Junior";
            } 
            if (baseCheck.checked) {
                nivelExperienciaSelecionado =  "Base";
            }

            formData.append('nivelexperiencia', nivelExperienciaSelecionado);

            if (statusDiariaDobrada === "Autorização da Diária Dobrada"){
                statusDiariaDobrada = "Pendente";
            }
            if (statusMeiaDiaria === "Autorização da Meia Diária"){
                statusMeiaDiaria = "Pendente";
            }

            let dadosDiariaDobrada = [];
            if (periodoDobrado && periodoDobrado.length > 0) {
                dadosDiariaDobrada = periodoDobrado.map(data => {
                const statusData = datasDobrada.find(item => item.data === data);
                return {
                    data: data,
                    status: statusData ? statusData.status : statusDiariaDobrada
                };
            });
        }

        let dadosMeiaDiaria = [];
        if (periodoMeiaDiaria && periodoMeiaDiaria.length > 0) {
            dadosMeiaDiaria = periodoMeiaDiaria.map(data => {
                const statusData = datasMeiaDiaria.find(item => item.data === data);
                return {
                    data: data,
                    status: statusData ? statusData.status : statusMeiaDiaria
                };
            });
        }


        formData.append('statusdiariadobrada', statusDiariaDobrada);
        formData.append('statusmeiadiaria', statusMeiaDiaria);
        formData.append('datadiariadobrada', JSON.stringify(dadosDiariaDobrada));
        formData.append('datameiadiaria', JSON.stringify(dadosMeiaDiaria));

        console.log("Preparando envio de FormData. Método:", metodo, "URL:", url, window.StaffOriginal);
        console.log("Dados do FormData:", {
            nmFuncionario, descFuncao, vlrCusto, ajusteCusto, transporte, almoco, jantar, caixinha,
            nmCliente, nmEvento, periodoDoEvento, vlrTotal, diariaDobrada, meiaDiaria, nivelExperienciaSelecionado
        });

        console.log("METODO PARA ENVIAR",metodo, currentEditingStaffEvent);

        console.log("Preparando envio de FormData. Método:", metodo, "URL:", url);
        console.log("Dados do FormData sendo enviados:");

        for (let pair of formData.entries()) {
            console.log(pair[0]+ ': ' + pair[1]);
        }


        if (metodo === "PUT") {
            if (!isEditingInitial) {
                console.log("Erro: Dados originais não encontrados para PUT");
                return Swal.fire("Erro", "Dados originais não encontrados para comparação (ID ausente para PUT).", "error");
            }

            const ajusteCustoAtivoOriginal = parseFloat(currentEditingStaffEvent.vlrajustecusto || 0.00) > 0;
            const caixinhaAtivoOriginal = parseFloat(currentEditingStaffEvent.vlrcaixinha || 0.00) > 0;
            const ajusteCustoValorOriginal = parseFloat(currentEditingStaffEvent.vlrajustecusto || 0);
            const caixinhaValorOriginal = parseFloat(currentEditingStaffEvent.vlrcaixinha || 0.00);

            const diariaDobradaOriginal = currentEditingStaffEvent.diariadobrada || false;
            const meiaDiariaOriginal = currentEditingStaffEvent.meiadiaria || false;

            const dataDiariaDobradaOriginal = currentEditingStaffEvent.dtdiariadobrada || [];

            const dataMeiaDiariaOriginal = currentEditingStaffEvent.dtmeiadiaria || [];

            const nivelExperienciaOriginal = currentEditingStaffEvent.nivelexperiencia || "";

            console.log("Valores originais - ajusteCusto Ativo:", ajusteCustoAtivoOriginal, "ajusteCusto Valor:", ajusteCustoValorOriginal);
            console.log("Valores originais - Caixinha Ativo:", caixinhaAtivoOriginal, "Caixinha Valor:", caixinhaValorOriginal);

            const ajusteCustoAtivoAtual = ajusteCustoAtivo;
            const caixinhaAtivoAtual = caixinhaAtivo;
            const ajusteCustoValorAtual = parseFloat(ajusteCusto.replace(',', '.') || 0.00);
            const caixinhaValorAtual = parseFloat(caixinha.replace(',', '.') || 0.00);

            const diariaDobradaAtual = diariaDobradacheck.checked;
            const meiaDiariaAtual = meiaDiariacheck.checked;
            const dataDiariaDobradaAtual = periodoDobrado;
            const dataMeiaDiariaAtual = periodoMeiaDiaria;

            const nivelExperienciaAtual = nivelExperienciaSelecionado;

            const houveAlteracaoAjusteCusto = (ajusteCustoAtivoOriginal !== ajusteCustoAtivoAtual) || (ajusteCustoValorOriginal !== ajusteCustoValorAtual);
            const houveAlteracaoCaixinha = (caixinhaAtivoOriginal !== caixinhaAtivoAtual) || (caixinhaValorOriginal !== caixinhaValorAtual);

            const houveAlteracaoDiariaDobrada = (diariaDobradaOriginal !== diariaDobradaAtual) || (dataDiariaDobradaOriginal.toString() !== dataDiariaDobradaAtual.toString());
            const houveAlteracaoMeiaDiaria = (meiaDiariaOriginal !== meiaDiariaAtual) || (dataMeiaDiariaOriginal.toString() !== dataMeiaDiariaAtual.toString());

            console.log("Houve alteração ajusteCusto?", houveAlteracaoAjusteCusto);
            console.log("Houve alteração Caixinha?", houveAlteracaoCaixinha);
            console.log("Houve alteração Diária Dobrada?", houveAlteracaoDiariaDobrada);
            console.log("Houve alteração Meia Diária?", houveAlteracaoMeiaDiaria);


            if (houveAlteracaoCaixinha && caixinhaAtivoAtual) {
                if (!descCaixinha || descCaixinha.length < 15) {
                    if (descCaixinhaInput) descCaixinhaInput.focus();
                    return Swal.fire(
                        "Campos obrigatórios!",
                        "A descrição do benefício (Caixinha) deve ter no mínimo 15 caracteres para salvar.",
                        "warning"
                    );
                }
            }

            if (houveAlteracaoAjusteCusto && ajusteCustoAtivoAtual) {
                if (!descAjusteCusto || descAjusteCusto.length < 15) {
                    if (descAjusteCusto) descAjusteCustoInput.focus();
                    return Swal.fire(
                        "Campos obrigatórios!",
                        "A descrição do Bônus deve ter no mínimo 15 caracteres para salvar.",
                        "warning"
                    );
                }
            }


            if (houveAlteracaoDiariaDobrada && diariaDobradaAtual) {
                const descDiariaDobradaInput = document.getElementById("descDiariaDobrada");
                const descDiariaDobrada = descDiariaDobradaInput ? descDiariaDobradaInput.value.trim() : "";

                if (!descDiariaDobrada || descDiariaDobrada.length < 15) {
                    if (descDiariaDobradaInput) {
                        descDiariaDobradaInput.focus();
                    }
                    return Swal.fire(
                        "Campo obrigatório!",
                        "A descrição da Diária Dobrada deve ter no mínimo 15 caracteres para salvar.",
                        "warning"
                    );
                }
            }


            if (houveAlteracaoMeiaDiaria && meiaDiariaAtual) {
                const descMeiaDiariaInput = document.getElementById("descMeiaDiaria");
                const descMeiaDiaria = descMeiaDiariaInput ? descMeiaDiariaInput.value.trim() : "";

                if (!descMeiaDiaria || descMeiaDiaria.length < 15) {
                    if (descMeiaDiariaInput) {
                        descMeiaDiariaInput.focus();
                    }
                    return Swal.fire(
                        "Campo obrigatório!",
                        "A descrição da Meia Diária deve ter no mínimo 15 caracteres para salvar.",
                        "warning"
                    );
                }
            }

            formData.append('idstaff', currentEditingStaffEvent.idstaff || '');
            formData.append('idstaffevento', currentEditingStaffEvent.idstaffevento);

            let houveAlteracao = false;
            if (
                currentEditingStaffEvent.idfuncionario != idFuncionario ||
                currentEditingStaffEvent.nmfuncao.toUpperCase() != descFuncao ||
                parseFloat(currentEditingStaffEvent.vlrcache || 0.00) != parseFloat(vlrCusto.replace(',', '.') || 0.00) ||
                JSON.stringify(currentEditingStaffEvent.periodo || []) !== JSON.stringify(periodoDoEvento) ||
                parseFloat(currentEditingStaffEvent.vlrajustecusto || 0.00) != ajusteCustoValorAtual ||
                parseFloat(currentEditingStaffEvent.vlrtransporte || 0.00) != parseFloat(transporte.replace(',', '.') || 0.00) ||
                parseFloat(currentEditingStaffEvent.vlralmoco || 0.00) != parseFloat(almoco.replace(',', '.') || 0.00) ||
                parseFloat(currentEditingStaffEvent.vlrjantar || 0.00) != parseFloat(jantar.replace(',', '.') || 0.00) ||
                parseFloat(currentEditingStaffEvent.vlrcaixinha || 0.00) != caixinhaValorAtual ||
                (currentEditingStaffEvent.descajustecusto || '').trim() != descAjusteCusto.trim() ||
                (currentEditingStaffEvent.descbeneficios || '').trim() != descBeneficio.trim() ||
                (currentEditingStaffEvent.desccaixinha || '').trim() != descCaixinha.trim() ||
                (currentEditingStaffEvent.setor || '').trim() != setor.trim() ||
                currentEditingStaffEvent.idcliente != idCliente ||
                currentEditingStaffEvent.idevento != idEvento ||
                currentEditingStaffEvent.idmontagem != idMontagem ||
                (currentEditingStaffEvent.pavilhao || '').toUpperCase().trim() != pavilhao ||
                (currentEditingStaffEvent.statuspgto || '').trim() != statusPgto.trim() ||
                (currentEditingStaffEvent.statusajustecusto || '').trim() != statusAjusteCusto.trim() ||
                (currentEditingStaffEvent.statuscaixinha || '').trim() != statusCaixinha.trim() ||
                (currentEditingStaffEvent.statusdiariadobrada || '').trim() != statusDiariaDobrada.trim() ||
                (currentEditingStaffEvent.statusmeiadiaria || '').trim() != statusMeiaDiaria.trim() ||
                currentEditingStaffEvent.diariadobrada != diariaDobradaAtual ||
                currentEditingStaffEvent.meiadiaria != meiaDiariaAtual ||
                currentEditingStaffEvent.nivelexperiencia != nivelExperienciaAtual
            ) {
                houveAlteracao = true;
            }

            const logAndCheck = (fieldName, originalValue, currentValue, condition) => {
            const isDifferent = condition;
                console.log(`[COMPARACAO] ${fieldName}: Original = '${originalValue}' | Atual = '${currentValue}' | Diferente = ${isDifferent}`);
                return isDifferent;
            };
            houveAlteracao =
                logAndCheck('ID Funcionário', currentEditingStaffEvent.idfuncionario, idFuncionario, currentEditingStaffEvent.idfuncionario != idFuncionario) ||
                logAndCheck('Função', currentEditingStaffEvent.nmfuncao.toUpperCase(), descFuncao, currentEditingStaffEvent.nmfuncao.toUpperCase() != descFuncao) ||
                logAndCheck('Valor Cache', parseFloat(currentEditingStaffEvent.vlrcache || 0), parseFloat(vlrCusto.replace(',', '.') || 0), parseFloat(currentEditingStaffEvent.vlrcache || 0) != parseFloat(vlrCusto.replace(',', '.') || 0)) ||
                logAndCheck('Datas Evento', JSON.stringify(currentEditingStaffEvent.datasevento || []), JSON.stringify(periodoDoEvento), JSON.stringify(currentEditingStaffEvent.datasevento || []) !== JSON.stringify(periodoDoEvento)) || // Use datasevento
                logAndCheck('Valor AjusteCusto', parseFloat(currentEditingStaffEvent.vlrajustecusto || 0), ajusteCustoValorAtual, parseFloat(currentEditingStaffEvent.vlrajustecusto || 0) != ajusteCustoValorAtual) ||
                logAndCheck('Valor Transporte', parseFloat(currentEditingStaffEvent.vlrtransporte || 0), parseFloat(transporte.replace(',', '.') || 0), parseFloat(currentEditingStaffEvent.vlrtransporte || 0) != parseFloat(transporte.replace(',', '.') || 0)) ||
                logAndCheck('Valor Almoço', parseFloat(currentEditingStaffEvent.vlralmoco || 0), parseFloat(almoco.replace(',', '.') || 0), parseFloat(currentEditingStaffEvent.vlralmoco || 0) != parseFloat(almoco.replace(',', '.') || 0)) ||
                logAndCheck('Valor Jantar', parseFloat(currentEditingStaffEvent.vlrjantar || 0), parseFloat(jantar.replace(',', '.') || 0), parseFloat(currentEditingStaffEvent.vlrjantar || 0) != parseFloat(jantar.replace(',', '.') || 0)) ||
                logAndCheck('Valor Caixinha', parseFloat(currentEditingStaffEvent.vlrcaixinha || 0), caixinhaValorAtual, parseFloat(currentEditingStaffEvent.vlrcaixinha || 0) != caixinhaValorAtual) ||
                logAndCheck('Descrição Bônus', (currentEditingStaffEvent.descajustecusto || '').trim(), descAjusteCusto.trim(), (currentEditingStaffEvent.descajustecusto || '').trim() != descAjusteCusto.trim()) ||
                logAndCheck('Descrição Benefícios', (currentEditingStaffEvent.descbeneficios || '').trim(), descBeneficio.trim(), (currentEditingStaffEvent.descbeneficios || '').trim() != descBeneficio.trim()) ||
                logAndCheck('Descrição Caixinha', (currentEditingStaffEvent.desccaixinha || '').trim(), descCaixinha.trim(), (currentEditingStaffEvent.desccaixinha || '').trim() != descCaixinha.trim()) ||
                logAndCheck('Setor', (currentEditingStaffEvent.setor.toUpperCase() || '').trim(), setor.trim().toUpperCase(), (currentEditingStaffEvent.setor.toUpperCase() || '').trim() != setor.toUpperCase().trim()) ||
                logAndCheck('StatusPgto', (currentEditingStaffEvent.statuspgto || '').trim(), statusPgto.trim(), (currentEditingStaffEvent.statuspgto || '').trim() != statusPgto.trim()) ||
                logAndCheck('StatusAjusteCusto', (currentEditingStaffEvent.statusajustecusto || '').trim(), statusAjusteCusto.trim(), (currentEditingStaffEvent.statusajustecusto || '').trim() != statusAjusteCusto.trim()) ||
                logAndCheck('StatusCaixinha', (currentEditingStaffEvent.statuscaixinha || '').trim(), statusCaixinha.trim(), (currentEditingStaffEvent.statuscaixinha || '').trim() != statusCaixinha.trim()) ||
                logAndCheck('ID Cliente', currentEditingStaffEvent.idcliente, idCliente, currentEditingStaffEvent.idcliente != idCliente) ||
                logAndCheck('ID Evento', currentEditingStaffEvent.idevento, idEvento, currentEditingStaffEvent.idevento != idEvento) ||
                logAndCheck('ID Montagem', currentEditingStaffEvent.idmontagem, idMontagem, currentEditingStaffEvent.idmontagem != idMontagem) ||
                logAndCheck('Pavilhão', (currentEditingStaffEvent.pavilhao || '').toUpperCase().trim(), pavilhao.toUpperCase().trim(), (currentEditingStaffEvent.pavilhao || '').toUpperCase().trim() != pavilhao.toUpperCase().trim()) ||

                logAndCheck(
                    'Comprovante Cache',
                    normalizeEmptyValue(currentEditingStaffEvent.comppgtocache), // Valor original normalizado
                    normalizeEmptyValue(comppgtocacheDoForm),                 // Valor do formulário normalizado
                    normalizeEmptyValue(currentEditingStaffEvent.comppgtocache) !== normalizeEmptyValue(comppgtocacheDoForm) // Comparação normalizada
                ) ||
                logAndCheck(
                    'Comprovante Ajuda Custo',
                    normalizeEmptyValue(currentEditingStaffEvent.comppgtoajdcusto),
                    normalizeEmptyValue(comppgtoajdcustoDoForm),
                    normalizeEmptyValue(currentEditingStaffEvent.comppgtoajdcusto) !== normalizeEmptyValue(comppgtoajdcustoDoForm)
                ) ||
                logAndCheck(
                    'Comprovante Ajuda Custo 50',
                    normalizeEmptyValue(currentEditingStaffEvent.comppgtoajdcusto50),
                    normalizeEmptyValue(comppgtoajdcusto50DoForm),
                    normalizeEmptyValue(currentEditingStaffEvent.comppgtoajdcusto50) !== normalizeEmptyValue(comppgtoajdcusto50DoForm)
                ) ||
                logAndCheck(
                    'Comprovante Caixinha',
                    normalizeEmptyValue(currentEditingStaffEvent.comppgtocaixinha),
                    normalizeEmptyValue(comppgtocaixinhaDoForm),
                    normalizeEmptyValue(currentEditingStaffEvent.comppgtocaixinha) !== normalizeEmptyValue(comppgtocaixinhaDoForm)
                ) ||

                logAndCheck('Datas Diária Dobrada', JSON.stringify(dataDiariaDobradaOriginal), JSON.stringify(dataDiariaDobradaAtual), JSON.stringify(dataDiariaDobradaOriginal) !== JSON.stringify(dataDiariaDobradaAtual)) ||
                logAndCheck('Datas Meia Diária', JSON.stringify(dataMeiaDiariaOriginal), JSON.stringify(dataMeiaDiariaAtual), JSON.stringify(dataMeiaDiariaOriginal) !== JSON.stringify(dataMeiaDiariaAtual)) ||

                logAndCheck('Status Diária Dobrada', (currentEditingStaffEvent.statusdiariadobrada || '').trim(), statusDiariaDobrada.trim(), (currentEditingStaffEvent.statusdiariadobrada || '').trim() != statusDiariaDobrada.trim()) ||
                logAndCheck('Status Meia Diária', (currentEditingStaffEvent.statusmeiadiaria || '').trim(), statusMeiaDiaria.trim(), (currentEditingStaffEvent.statusmeiadiaria || '').trim() != statusMeiaDiaria.trim()) ||
                logAndCheck('Nível Experiência', (currentEditingStaffEvent.nivelexperiencia || '').trim(), nivelExperienciaAtual.trim(), (currentEditingStaffEvent.nivelexperiencia || '').trim() != nivelExperienciaAtual.trim());
           
                console.log("Houve alteração geral?", houveAlteracao);

            if (!houveAlteracao) {
                console.log("Nenhuma alteração detectada, bloqueando salvamento.");
                return Swal.fire("Nenhuma alteração detectada", "Faça alguma alteração antes de salvar.", "info");
            }

            const { isConfirmed } = await Swal.fire({
                title: "Deseja salvar as alterações?",
                text: "Você está prestes a atualizar os dados do staff.",
                icon: "question",
                showCancelButton: true,
                confirmButtonText: "Sim, salvar",
                cancelButtonText: "Cancelar",
                reverseButtons: true,
                focusCancel: true
            });

            if (!isConfirmed) {
                console.log("Alteração cancelada pelo usuário");
                return;
            }
        }

        // --- EXECUTA O FETCH PARA POST OU PUT ---
        try {
            console.log("ENTRANDO NO TRY. Método:", metodo);

            const respostaApi = await fetchComToken(url, {
                method: metodo,

                body: formData,
            });

            await Swal.fire("Sucesso!", respostaApi.message || "Staff salvo com sucesso.", "success");


            await carregarTabelaStaff(idFuncionario);

             window.StaffOriginal = null;
             limparCamposStaff();

        } catch (error) {
            console.error("❌ Erro ao enviar dados do funcionário:", error);
            Swal.fire("Erro", error.message || "Erro ao salvar funcionário.", "error");
        }
    });
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
    const setorParaBusca = setorInput.value.toUpperCase();
    const datasEventoRawValue = datasEventoInput ? datasEventoInput.value.trim() : '';
    const periodoDoEvento = getPeriodoDatas(datasEventoRawValue);
    //const diariaDobradaRawValue = diariaDobradaInput ? diariaDobradaInput.value.trim() : '';
    //const periodoDobrado = getPeriodoDatas(diariaDobradaRawValue);

    //console.log("Valor RAW do input de Diária Dobrada:", diariaDobradaRawValue);
    //console.log("Datas processadas (periodoDobrado):", periodoDobrado);

    // Apenas chame a API se os campos obrigatórios estiverem preenchidos
    if (idEvento && idCliente && periodoDoEvento.length > 0) {
      buscarEPopularOrcamento(idEvento, idCliente, idLocalMontagem, setorParaBusca, periodoDoEvento);
    }
}, 500);


async function buscarEPopularOrcamento(idEvento, idCliente, idLocalMontagem, setorParaBusca, datasEvento, diariaDobrada) {
    try {
        console.log("Buscando orçamento com os seguintes IDs:", { idEvento, idCliente, idLocalMontagem, setorParaBusca });

        const criteriosDeBusca = {
            idEvento,
            idCliente,
            idLocalMontagem,
            //setor: setorParaBusca,
            datasEvento: datasEvento || []
        };
        console.log("Objeto enviado para o backend:", criteriosDeBusca);

        const dadosDoOrcamento = await fetchComToken('/staff/orcamento/consultar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(criteriosDeBusca)
        });

        // Limpa a variável global antes de qualquer processamento
        orcamentoPorFuncao = {};

        // **VALIDAÇÃO CORRIGIDA:** Garante que a resposta é um array válido e não vazio
        if (!Array.isArray(dadosDoOrcamento) || dadosDoOrcamento.length === 0) {
            Swal.fire({
                icon: 'info',
                title: 'Nenhum Orçamento Encontrado',
                text: 'Não foram encontrados orçamentos para os critérios de busca informados.'
            });
            // Opcional: define o status como nulo ou vazio
            statusOrcamentoAtual = '';
            return;
        }

        // **LÓGICA DO STATUS:** Agora que sabemos que o array não está vazio, podemos acessar a posição [0] com segurança
        const statusDoOrcamento = dadosDoOrcamento[0].status;
        statusOrcamentoAtual = statusDoOrcamento; // Define a variável global

        // if (statusDoOrcamento === 'A') {
        //     Swal.fire({
        //         icon: 'warning',
        //         title: 'Orçamento Não Fechado',
        //         text: 'O orçamento para os parâmetros solicitados ainda está em aberto. Não é possível ver os detalhes.'
        //     });
        //     return;
        // }

        // **PROCESSAMENTO DOS DADOS:** Se o status não for 'A', o código continua aqui
        dadosDoOrcamento.forEach(item => {
            const chave = `${item.nmevento}-${item.nmcliente}-${item.nmlocalmontagem}-${item.setor}-${item.descfuncao}`;

            orcamentoPorFuncao[chave] = {
                quantidadeOrcada: item.quantidade_orcada,
                quantidadeEscalada: item.quantidade_escalada
            };
        });

        console.log('Orçamento carregado:', orcamentoPorFuncao);

    } catch (error) {
        console.error("Erro ao carregar orçamento:", error);
        orcamentoPorFuncao = {};
        statusOrcamentoAtual = ''; // Limpa o status em caso de erro
        Swal.fire({
            icon: 'error',
            title: 'Erro de Carregamento',
            text: 'Não foi possível carregar o orçamento. Tente novamente mais tarde.'
        });
    }
}

/**
 * Renderiza dinamicamente as datas selecionadas com seus respectivos status,
 * apenas para usuários com permissão total.
 * @param {Array<Object>} datesArray - O array de objetos de data e status.
 * @param {string} containerId - O ID do contêiner onde os elementos serão inseridos.
 * @param {string} type - O tipo de diária ('dobrada' ou 'meia').
 */
function renderDatesWithStatus(datesArray, containerId, type) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Remove apenas os itens de data antigos, mantendo o label
    const existingDates = container.querySelectorAll('.date-status-item');
    existingDates.forEach(el => el.remove());

    if (datesArray.length === 0) {
        container.style.display = 'none';
        return;
    }

    // Certifica-se que o contêiner pai está visível antes de renderizar
    container.style.display = 'block';

    datesArray.forEach(item => {
        const formattedDate = item.data.split('-').reverse().join('/');

        const dateElement = document.createElement('div');
        dateElement.classList.add('date-status-item');

        dateElement.innerHTML = `
            <span>${formattedDate}:</span>
            <select data-date="${item.data}" data-type="${type}" class="form-select status-select">
                <option value="Pendente" ${item.status === 'Pendente' ? 'selected' : ''}>Pendente</option>
                <option value="Autorizado" ${item.status === 'Autorizado' ? 'selected' : ''}>Autorizado</option>
                <option value="Rejeitado" ${item.status === 'Rejeitado' ? 'selected' : ''}>Rejeitado</option>
            </select>
        `;
        container.appendChild(dateElement);

        const select = dateElement.querySelector('select');
        select.classList.add(`status-${item.status.toLowerCase()}`);

        select.addEventListener('change', (e) => {
            const dateToUpdate = e.target.dataset.date;
            const newStatus = e.target.value;

            e.target.classList.remove('status-pendente', 'status-autorizado', 'status-rejeitado');
            e.target.classList.add(`status-${newStatus.toLowerCase()}`);

            const arrayToUpdate = type === 'dobrada' ? datasDobrada : datasMeiaDiaria;
            const foundDate = arrayToUpdate.find(d => d.data === dateToUpdate);
            if (foundDate) {
                foundDate.status = newStatus;
            }
        });
    });
}

function desinicializarStaffModal() {
    console.log("🧹 Desinicializando módulo Staff.js...");

    const selectAvaliacao = document.querySelector("#avaliacao");
    const botaoLimpar = document.querySelector("#Limpar");
    const botaoEnviar = document.querySelector("#Enviar");
    const datasEventoInput = document.querySelector("#datasEvento");
    const diariaDobradaInput = document.querySelector("#diariaDobrada");
    const selectFuncionario = document.querySelector("#nmFuncionario");
    const selectFuncao = document.querySelector("#descFuncao");
    const selectCliente = document.querySelector("#nmCliente");
    const selectEvento = document.querySelector("#nmEvento");
    const selectLocalMontagem = document.querySelector("#nmLocalMontagem");
    const selectPavilhao = document.querySelector("#nmPavilhao"); // Pode não existir se não carregado
    const Caixinhacheck = document.querySelector("#Caixinhacheck");
    const ajusteCustocheck = document.querySelector("#ajusteCustocheck");
    const vlrCustoInput = document.querySelector("#vlrCusto");
    const ajusteCustoInput = document.querySelector("#ajusteCusto");
    const transporteInput = document.querySelector("#transporte");
    const almocoInput = document.querySelector("#almoco");
    const jantarInput = document.querySelector("#jantar");
    const caixinhaInput = document.querySelector("#caixinha");
    const fileCacheInput = document.getElementById('fileCache');
    const fileAjdCustoInput = document.getElementById('fileAjdCusto');
    const fileCaixinhaInput = document.getElementById('fileCaixinha');
    const fileAjdCusto2Input = document.getElementById('fileAjdCusto2');
    const hiddenRemoverAjdCusto2Input = document.getElementById('limparComprovanteAjdCusto2');


    // 1. Remover listeners de eventos dos elementos
    if (selectAvaliacao && avaliacaoChangeListener) {
        selectAvaliacao.removeEventListener("change", avaliacaoChangeListener);
        avaliacaoChangeListener = null;
        console.log("Listener de change do Avaliação (Staff) removido.");
    }
    if (botaoLimpar && limparStaffButtonListener) {
        botaoLimpar.removeEventListener("click", limparStaffButtonListener);
        limparStaffButtonListener = null;
        console.log("Listener de click do Limpar (Staff) removido.");
    }
    if (botaoEnviar && enviarStaffButtonListener) {
        botaoEnviar.removeEventListener("click", enviarStaffButtonListener);
        enviarStaffButtonListener = null;
        console.log("Listener de click do Enviar (Staff) removido.");
    }

    // Remover listeners dos selects
    if (selectFuncionario && nmFuncionarioChangeListener) {
        selectFuncionario.removeEventListener("change", nmFuncionarioChangeListener);
        nmFuncionarioChangeListener = null;
    }
    if (selectFuncao && descFuncaoChangeListener) {
        selectFuncao.removeEventListener("change", descFuncaoChangeListener);
        descFuncaoChangeListener = null;
    }
    if (selectCliente && nmClienteChangeListener) {
        selectCliente.removeEventListener("change", nmClienteChangeListener);
        nmClienteChangeListener = null;
    }
    if (selectEvento && nmEventoChangeListener) {
        selectEvento.removeEventListener("change", nmEventoChangeListener);
        nmEventoChangeListener = null;
    }
    if (selectLocalMontagem && nmLocalMontagemChangeListener) {
        selectLocalMontagem.removeEventListener("change", nmLocalMontagemChangeListener);
        nmLocalMontagemChangeListener = null;
    }
    if (selectPavilhao && qtdPavilhaoChangeListener) { // Remover apenas se existir
        selectPavilhao.removeEventListener("change", qtdPavilhaoChangeListener);
        qtdPavilhaoChangeListener = null;
    }


    // Remover listeners dos checkboxes
    if (Caixinhacheck && CaixinhacheckListener) {
        Caixinhacheck.removeEventListener("change", CaixinhacheckListener);
        CaixinhacheckListener = null;
    }
    if (ajusteCustocheck && ajusteCustocheckListener) {
        ajusteCustocheck.removeEventListener("change", ajusteCustocheckListener);
        ajusteCustocheckListener = null;
    }

    // Remover listeners dos campos de valor
    if (vlrCustoInput && vlrCustoInputListener) {
        vlrCustoInput.removeEventListener("input", vlrCustoInputListener);
        vlrCustoInputListener = null;
    }
    if (ajusteCustoInput && ajusteCustoInputListener) {
        ajusteCustoInput.removeEventListener("input", ajusteCustoInputListener);
        ajusteCustoInputListener = null;
    }
    if (transporteInput && transporteInputListener) {
        transporteInput.removeEventListener("input", transporteInputListener);
        transporteInputListener = null;
    }
    if (almocoInput && almocoInputListener) {
        almocoInput.removeEventListener("input", almocoInputListener);
        almocoInputListener = null;
    }
    if (jantarInput && jantarInputListener) {
        jantarInput.removeEventListener("input", jantarInputListener);
        jantarInputListener = null;
    }
    if (caixinhaInput && caixinhaInputListener) {
        caixinhaInput.removeEventListener("input", caixinhaInputListener);
        caixinhaInputListener = null;
    }

    // Remover listeners dos inputs de arquivo
    if (fileCacheInput && fileCacheChangeListener) {
        fileCacheInput.removeEventListener("change", fileCacheChangeListener);
        fileCacheChangeListener = null;
    }
    if (fileAjdCustoInput && fileAjdCustoChangeListener) {
        fileAjdCustoInput.removeEventListener("change", fileAjdCustoChangeListener);
        fileAjdCustoChangeListener = null;
    }
    if (fileAjdCusto2Input && fileAjdCusto2ChangeListener) {
        fileAjdCusto2Input.removeEventListener("change", fileAjdCusto2ChangeListener);
        fileAjdCusto2ChangeListener = null;
    }
    if (fileCaixinhaInput && fileCaixinhaChangeListener) {
        fileCaixinhaInput.removeEventListener("change", fileCaixinhaChangeListener);
        fileCaixinhaChangeListener = null;
    }


    // 2. Destruir instâncias de bibliotecas externas (Flatpickr)
    if (datasEventoFlatpickrInstance) {
        datasEventoFlatpickrInstance.destroy();
        datasEventoFlatpickrInstance = null;
        console.log("Flatpickr para #datasEvento destruído.");
    }
    // 2. Destruir instâncias de bibliotecas externas (Flatpickr)
    if (diariaDobradaFlatpickrInstance) {
        diariaDobradaFlatpickrInstance.destroy();
        diariaDobradaFlatpickrInstance = null;
        console.log("Flatpickr para #diariaDobrada destruído.");
    }

    // 3. Limpar o estado global e campos do formulário
    window.StaffOriginal = null;
    window.currentEditingStaffEvent = null;
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
        return { isAvailable: false, conflictingEvent: null };
    }
}


// function inicializarFlatpickrsGlobais() {
//     console.log("Inicializando Flatpickr para todos os campos de data (globais)...");

//     const dateInputIds = ['datasEvento', 'diariaDobrada', 'meiaDiaria'];
//     const commonFlatpickrOptions = {
//         mode: "multiple",
//         dateFormat: "Y-m-d",
//     };

//     dateInputIds.forEach(id => {
//         const element = document.getElementById(id);
//         if (element) {
//             if (!element._flatpickr) {
//                 // AQUI ESTÁ A CORREÇÃO:
//                 // Obtemos as datas do objeto de edição, se existirem.
//                 let initialDates = [];
//                 if (window.currentEditingStaffEvent) {
//                     if (id === 'datasEvento' && window.currentEditingStaffEvent.datasevento) {
//                         initialDates = window.currentEditingStaffEvent.datasevento;
//                     }
//                     // Adicione lógica semelhante para 'diariaDobrada' e 'meiaDiaria'
//                     // se houver campos de data correspondentes no objeto de edição.
//                     // Exemplo:
//                     // else if (id === 'diariaDobrada' && window.currentEditingStaffEvent.dtdiariadobrada) {
//                     //    initialDates = window.currentEditingStaffEvent.dtdiariadobrada;
//                     // }
//                     // etc.
//                 }

//                 const picker = flatpickr(element, {
//                     ...commonFlatpickrOptions,
//                     defaultDate: initialDates // Pré-preenche o calendário com as datas
//                 });

//                 window.flatpickrInstances[id] = picker;
//                 console.log(`Flatpickr inicializado e salvo para campo global #${id}`, initialDates);
//             } else {
//                 console.log(`Flatpickr para campo global #${id} já estava inicializado.`);
//                 window.flatpickrInstances[id] = element._flatpickr;
//             }
//         } else {
//             console.warn(`Elemento com ID '${id}' não encontrado para inicialização do Flatpickr.`);
//         }
//     });
// }


console.log("ainda n adicionou Blur")
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
        ajusteCusto: "",
        transporte: "",
        almoco: "",
        jantar: "",
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
        nmPavilhao: "",

        // 📎 Comprovantes PDF
        comprovanteCache: "",
        comprovanteAjdCusto: "",
        comprovanteCaixinha: "",
        setor: "",
        statusPgto,
        statusDiariaDobrada: "",
        descDiariaDobrada: "",
        statusMeiaDiaria: "",
        descMeiaDiaria: "",

        descAjusteCusto: "",
        descCaixinha: ""
    };

    // Log dos campos limpados
    console.log("✅ StaffOriginal foi resetado com os seguintes campos:");
    Object.entries(window.StaffOriginal).forEach(([chave, valor]) => {
        console.log(`- ${chave}: "${valor}"`);
    });
}

async function carregarFuncaoStaff() {
    try{
        const funcaofetch = await fetchComToken('/staff/funcao');
        console.log("ENTROU NO CARREGARFUNCAOSTAFF", funcaofetch);

        let selects = document.querySelectorAll(".descFuncao");
        selects.forEach(select => {
            select.innerHTML = "";

            console.log('Funcao recebidos:', funcaofetch); // Log das Funções recebidas
            let opcaoPadrao = document.createElement("option");
            opcaoPadrao.setAttribute("value", "");
            opcaoPadrao.textContent = "Selecione Função";
            select.appendChild(opcaoPadrao);

            funcaofetch.forEach(funcao => {
                let option = document.createElement("option");
                option.value = funcao.idfuncao;
                option.textContent = funcao.descfuncao;
                option.setAttribute("data-idFuncao", funcao.idfuncao);
                option.setAttribute("data-descproduto", funcao.descfuncao);
                option.setAttribute("data-ctosenior", funcao.ctofuncaosenior);
                option.setAttribute("data-ctopleno", funcao.ctofuncaopleno);
                option.setAttribute("data-ctojunior", funcao.ctofuncaojunior);
                option.setAttribute("data-ctobase", funcao.ctofuncaobase);
                option.setAttribute("data-vda", funcao.vdafuncao);
              
                option.setAttribute("data-almoco", funcao.almoco || 0); // Certifique-se de que almoco/jantar estão aqui
                option.setAttribute("data-jantar", funcao.jantar || 0);
                option.setAttribute("data-transporte", funcao.transporte || 0);
                option.setAttribute("data-transpsenior", funcao.transpsenior || 0);
                option.setAttribute("data-categoria", "Produto(s)");
                select.appendChild(option);
            });

            select.addEventListener("change", function (event) {

                document.getElementById("vlrCusto").value = '';
                document.getElementById("almoco").value = '';
                document.getElementById("jantar").value = '';
                document.getElementById("transporte").value = '';
                document.getElementById("Seniorcheck").checked = false;
                document.getElementById("Plenocheck").checked = false;
                document.getElementById("Juniorcheck").checked = false;
                document.getElementById("Basecheck").checked = false;
                

                const selectedOption = this.options[this.selectedIndex];
             

                document.getElementById("idFuncao").value = selectedOption.getAttribute("data-idFuncao");
              //  document.getElementById("nmFuncao").value = selectedOption.getAttribute("data-nmFuncao");

                // document.getElementById("vlrCusto").value = selectedOption.getAttribute("data-cto");
                // document.getElementById("almoco").value = selectedOption.getAttribute("data-almoco");
                // document.getElementById("jantar").value = selectedOption.getAttribute("data-jantar");
                // document.getElementById("transporte").value = selectedOption.getAttribute("data-transporte");

                vlrCustoSeniorFuncao = parseFloat(selectedOption.getAttribute("data-ctosenior")) || 0;
                vlrCustoPlenoFuncao = parseFloat(selectedOption.getAttribute("data-ctopleno")) || 0;
                vlrCustoJuniorFuncao = parseFloat(selectedOption.getAttribute("data-ctojunior")) || 0;
                vlrCustoBaseFuncao = parseFloat(selectedOption.getAttribute("data-ctobase")) || 0;
                vlrAlmocoFuncao = parseFloat(selectedOption.getAttribute("data-almoco")) || 0;
                vlrJantarFuncao = parseFloat(selectedOption.getAttribute("data-jantar")) || 0;
                vlrTransporteFuncao = parseFloat(selectedOption.getAttribute("data-transporte")) || 0;
                vlrTransporteSeniorFuncao = parseFloat(selectedOption.getAttribute("data-transpsenior")) || 0;
                
            });

        });
    }catch(error){
    console.error("Erro ao carregar funcao:", error);
    }
}

async function carregarFuncionarioStaff() {
    try{
        const funcionariofetch = await fetchComToken('/staff/funcionarios');
        console.log("ENTROU NO CARREGAR FUNCIONARIO STAFF", funcionariofetch);

        let selects = document.querySelectorAll(".nmFuncionario");

        selects.forEach(select => {
            select.innerHTML = "";

            let opcaoPadrao = document.createElement("option");
            opcaoPadrao.setAttribute("value", "");
            opcaoPadrao.textContent = "Selecione Funcionário";
            select.appendChild(opcaoPadrao);

            funcionariofetch.forEach(funcionario => {
              console.log("ENTROU NO FOR EACH", funcionario);
                let option = document.createElement("option");
                option.value = funcionario.idfuncionario;
                option.textContent = funcionario.nome;
                option.setAttribute("data-idfuncionario", funcionario.idfuncionario);
                option.setAttribute("data-nmfuncionario", funcionario.nome);
                option.setAttribute("data-apelido", funcionario.apelido);
                option.setAttribute("data-perfil", funcionario.perfil);
                option.setAttribute("data-foto", funcionario.foto);

                select.appendChild(option);
            });

            select.addEventListener("change", function () {

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


                document.getElementById("apelidoFuncionario").value = selectedOption.getAttribute("data-apelido");
                document.getElementById("idFuncionario").value = selectedOption.getAttribute("data-idfuncionario");
                document.getElementById("perfilFuncionario").value = selectedOption.getAttribute("data-perfil");

                const perfilSelecionado = selectedOption.getAttribute("data-perfil");
                const labelFuncionario = document.getElementById("labelFuncionario");

                console.log("Perfil selecionado:", perfilSelecionado);

                // Se não for freelancer, mostra label em verde
                if (perfilSelecionado) {
                    labelFuncionario.style.display = "block"; // sempre visível
                    if (perfilSelecionado.toLowerCase() === "freelancer") {
                        labelFuncionario.textContent = "FREE-LANCER";
                        labelFuncionario.style.color = "red";
                    } else {
                        labelFuncionario.textContent = "FUNCIONÁRIO";
                        labelFuncionario.style.color = "green";
                    }
                } else {
                labelFuncionario.style.display = "none"; // se não tiver perfil
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
    console.log("Preview", nomeFuncionarioInput);

    if (fotoPathFromData) {
        // Mostra a foto
        previewFotoImg.src = `/${fotoPathFromData}`;
        previewFotoImg.alt = `Foto de ${nomeFuncionarioInput.value || 'funcionário'}`;
        previewFotoImg.style.display = 'block';

        if (fileInput) fileInput.disabled = true;
        if (uploadHeaderDiv) uploadHeaderDiv.style.display = 'none';
        if (fileNameSpan) fileNameSpan.textContent = fotoPathFromData.split('/').pop() || 'Foto carregada';
        const fileLabel = document.querySelector("label[for='file']");
        if (fileLabel) fileLabel.style.display = "none";
        const uploadContainer = document.querySelector("#upload-container");
        if (uploadContainer) uploadContainer.style.display = "none";

    } else {
        // Não tem foto → oculta tudo
        previewFotoImg.src = '#';
        previewFotoImg.alt = 'Sem foto';
        previewFotoImg.style.display = 'none';

        if (fileInput) fileInput.disabled = false;
        if (uploadHeaderDiv) uploadHeaderDiv.style.display = 'none';
        if (fileNameSpan) fileNameSpan.textContent = '';
        const fileLabel = document.querySelector("label[for='file']");
        if (fileLabel) fileLabel.style.display = "none ";
        const uploadContainer = document.querySelector("#upload-container");
        if (uploadContainer) uploadContainer.style.display = "none";
    }
}

carregarTabelaStaff(idFuncionarioSelecionado);

            });

        });
    }catch(error){
    console.error("Erro ao carregar funcao:", error);
    }
}

async function  carregarClientesStaff() {
    console.log("Função CARREGAR Cliente chamada");

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

        selects.forEach(select => {

            select.innerHTML = '<option value="">Selecione Local de Montagem</option>';
            montagem.forEach(local => {
                let option = document.createElement("option");

                option.value = local.idmontagem;
                option.textContent = local.descmontagem;
                option.setAttribute("data-idMontagem", local.idmontagem);
                option.setAttribute("data-descmontagem", local.descmontagem);
                option.setAttribute("data-ufmontagem", local.ufmontagem);
                select.appendChild(option);

            });
            select.addEventListener("change", function () {
              const selectedOption = this.options[this.selectedIndex];

               document.getElementById("idMontagem").value = selectedOption.getAttribute("data-idMontagem");


               idMontagemSelecionado = selectedOption.value;

               carregarPavilhaoStaff(idMontagemSelecionado);

            });

        });
    }catch(error){
        console.error("Erro ao carregar localmontagem:", error);
    }
}

async function carregarPavilhaoStaff(idMontagem) {
    try{

       const pavilhaofetch = await fetchComToken(`/staff/pavilhao?idmontagem=${idMontagem}`);

        let selects = document.querySelectorAll(".nmPavilhao");

        selects.forEach(select => {

            select.innerHTML = '<option value="">Selecione o Pavilhão</option>'; // Adiciona a opção padrão
            pavilhaofetch.forEach(localpav => {

                let option = document.createElement("option");

                option.value = localpav.idpavilhao;  // Atenção ao nome da propriedade (idMontagem)
                option.textContent = localpav.nmpavilhao;
                option.setAttribute("data-idPavilhao", localpav.idpavilhao);
                option.setAttribute("data-nmPavilhao", localpav.nmPavilhao);

                select.appendChild(option);

            });
            select.addEventListener("change", function () {
                // document.getElementById("idPavilhao").value = selectedOption.getAttribute("data-idPavilhao");


            });

        });
    }catch(error){
        console.error("Erro ao carregar pavilhao:", error);
    }
}

// async function carregarDadosPavilhao(idMontagem) { // Renomeada para corresponder ao seu código
//         if (!nmPavilhaoSelect) return;

//         nmPavilhaoSelect.innerHTML = '<option value="">Carregando Pavilhões...</option>'; // Mensagem de carregamento

//         if (!idMontagem) {
//             nmPavilhaoSelect.innerHTML = '<option value="">Selecione Pavilhão</option>';
//             return;
//         }

//         try {
//             const pavilhaoData = await fetchComToken(`/staff/pavilhao?idmontagem=${idMontagem}`); // Ajuste a URL se necessário
//             console.log(`Dados de Pavilhões recebidos para ${idMontagem}:`, pavilhaoData); // Log para depuração

//             nmPavilhaoSelect.innerHTML = '<option value="">Selecione Pavilhão</option>'; // Limpa e adiciona opção padrão
//             pavilhaoData.forEach(localpav => {
//                 const option = document.createElement('option');
//                 option.value = localpav.idpavilhao;  // O valor da opção é o ID
//                 option.textContent = localpav.nmpavilhao; // O texto visível é o nome
//                 option.setAttribute("data-idPavilhao", localpav.idpavilhao);
//                 option.setAttribute("data-nmPavilhao", localpav.nmpavilhao); // Corrigido typo
//                 nmPavilhaoSelect.appendChild(option);
//                 console.log(`Adicionada opção: value="${option.value}", text="${option.textContent}"`); // Log de depuração
//             });
//             console.log(`Pavilhões carregados e populados para Local de Montagem ${idMontagem}.`);
//         } catch (error) {
//             console.error("Erro ao carregar pavilhao:", error);
//             nmPavilhaoSelect.innerHTML = '<option value="">Erro ao carregar Pavilhões</option>';
//         }
// }

function limparCamposEvento() {
    console.log("Limpeza parcial do formulário iniciada (apenas campos do evento).");

    // Lista de campos que se referem a um evento específico
    const camposEvento = [
        "idStaff", "descFuncao", "vlrCusto", "ajusteCusto", "transporte", "almoco", "jantar", "caixinha",
        "nmLocalMontagem", "nmPavilhao", "descBeneficio", "descAjusteCusto", "nmCliente", "nmEvento", "vlrTotal",
        "vlrTotalHidden", "idFuncao", "idMontagem", "idPavilhao", "idCliente", "idEvento", "statusPgto",
        "statusAjusteCusto", "statusCaixinha", "statusDiariaDobrada", "descDiariaDobrada", "statusMeiaDiaria",
        "descMeiaDiaria"
    ];

    camposEvento.forEach(id => {
        const campo = document.getElementById(id);
        if (campo) {
            campo.value = "";
            // console.log(`Campo "${id}" limpo.`); // Descomente para debug
        }
    });

    // Limpa a data do evento (Flatpickr)
    const datasEventoInput = document.getElementById('datasEvento');
    if (datasEventoInput && datasEventoInput._flatpickr) {
        datasEventoInput._flatpickr.clear();
    }

    const diariaDobradaInput = document.getElementById('diariaDobrada');
    if (diariaDobradaInput && diariaDobradaInput._flatpickr) {
        diariaDobradaInput._flatpickr.clear();
    }

    // Limpa os campos de comprovantes
    limparCamposComprovantes();

    // Resetar campos opcionais
    const ajusteCustoCheck = document.getElementById('ajusteCustocheck');
    if (ajusteCustoCheck) ajusteCustoCheck.checked = false;
    const caixinhaCheck = document.getElementById('Caixinhacheck');
    if (caixinhaCheck) caixinhaCheck.checked = false;

    const meiaDiariaCheck = document.getElementById('meiaDiariaCheck');
    if (meiaDiariaCheck) meiaDiariaCheck.checked = false;

    const diariaDobradacheck = document.getElementById('diariaDobradacheck');
    if (diariaDobradacheck) diariaDobradacheck.checked = false;

    const seniorCheck = document.getElementById('Seniorcheck');
    if (seniorCheck) seniorCheck.checked = false;

    const plenoCheck = document.getElementById('Plenocheck');
    if (plenoCheck) plenoCheck.checked = false;

    const juniorCheck = document.getElementById('Juniorcheck');
    if (juniorCheck) juniorCheck.checked = false;

    const baseCheck = document.getElementById('Basecheck');
    if (baseCheck) baseCheck.checked = false;

    const containerStatusDiariaDobrada = document.getElementById('containerStatusDiariaDobrada');
    const containerStatusMeiaDiaria = document.getElementById('containerStatusMeiaDiaria');

    if (containerStatusDiariaDobrada) {
        containerStatusDiariaDobrada.innerHTML = '';
        containerStatusDiariaDobrada.style.display = 'none';
    }

    if (containerStatusMeiaDiaria) {
        containerStatusMeiaDiaria.innerHTML = '';
        containerStatusMeiaDiaria.style.display = 'none';
    }

    // Limpa as descrições de bônus e benefícios
    document.getElementById('ajusteCusto').value = '';
    document.getElementById('descBeneficio').value = '';

    const statusCaixinhaEl = document.getElementById('statusCaixinha');
    if (statusCaixinhaEl) statusCaixinhaEl.value = 'Autorização da Caixinha';

    const statusAjusteCustoEl = document.getElementById('statusAjusteCusto');
    if (statusAjusteCustoEl) statusAjusteCustoEl.value = 'Autorização do Ajuste de Custo';

    const statusDiariaDobradaEl = document.getElementById('statusDiariaDobrada');
    if (statusDiariaDobradaEl) statusDiariaDobradaEl.value = 'Autorização da Diária Dobrada';

    const descDiariaDobradaEl = document.getElementById('descDiariaDobrada');
    if (descDiariaDobradaEl) descDiariaDobradaEl.value = '';
    
    const campoStatusDiariaDobradaEl = document.getElementById('campoStatusDiariaDobrada');
    if (campoStatusDiariaDobradaEl) campoStatusDiariaDobradaEl.style.display = 'none';

    const statusMeiaDiariaEl = document.getElementById('statusMeiaDiaria');
    if (statusMeiaDiariaEl) statusMeiaDiariaEl.value = 'Autorização da Meia Diária';

    const descMeiaDiariaEl = document.getElementById('descMeiaDiaria');
    if (descMeiaDiariaEl) descMeiaDiariaEl.value = '';

    const campoStatusMeiaDiariaEl = document.getElementById('campoStatusMeiaDiaria');
    if (campoStatusMeiaDiariaEl) campoStatusMeiaDiariaEl.style.display = 'none';

    // Garanta que os containers opcionais sejam ocultados
    document.getElementById('campoAjusteCusto').style.display = 'none';
    document.getElementById('campoCaixinha').style.display = 'none';
    document.getElementById('campoStatusCaixinha').style.display = 'none';



    // Limpa o objeto em memória do staff original
    limparStaffOriginal();

    console.log("Limpeza parcial do formulário concluída.");
}

function limparCamposStaff() {
    const campos = [
        "idStaff", "nmFuncionario", "apelidoFuncionario", "linkFotoFuncionarios", "descFuncao", "vlrCusto",
        "nmLocalMontagem", "nmPavilhao", "almoco", "jantar", "transporte", "vlrBeneficio", "descBeneficio",
        "nmCliente", "nmEvento", "vlrTotal", "vlrTotalHidden", "idFuncionario", "idFuncao", "idMontagem",
        "idPavilhao", "idCliente", "idEvento", "statusPgto", "statusCaixinha", "statusAjusteCusto", "statusDiariaDobrada",
        "descDiariaDobrada", "statusMeiaDiaria", "descMeiaDiaria", "labelFuncionario", "perfilFuncionario"
    ];

    campos.forEach(id => {
        const campo = document.getElementById(id);
        if (campo) {
            campo.value = "";
            console.log(`Campo "${id}" limpo.`);
        }
    });

    currentEditingStaffEvent = null; // Garanta que esta também seja limpa
    isFormLoadedFromDoubleClick = false;

    const previewFoto = document.getElementById('previewFoto');
    const fileName = document.getElementById('fileName');
    const fileInput = document.getElementById('file');
    const uploadHeader = document.getElementById('uploadHeader');
    const linkFotoFuncionarios = document.getElementById('linkFotoFuncionarios');
    const nomeFuncionarioExibido = document.getElementById('nomeFuncionarioExibido');
    const labelFuncionario = document.getElementById('labelFuncionario');

    if (labelFuncionario) {
        labelFuncionario.style.display = "none"; // esconde
        labelFuncionario.textContent = "";       // limpa o texto
        labelFuncionario.style.color = "";       // reseta cor
        console.log("Label Funcionário limpo.");
    }

    if (previewFoto) {
        previewFoto.src = "#";
        previewFoto.style.display = "none";
        console.log("Preview da foto limpo.");
    }
    if (fileName) {
        fileName.textContent = "Nenhum arquivo selecionado";
    }
    if (fileInput) {
        fileInput.value = "";
    }
    if (uploadHeader) {
        uploadHeader.style.display = "block";
    }
    if (linkFotoFuncionarios) {
        linkFotoFuncionarios.value = "";
    }
    if (nomeFuncionarioExibido) {
        nomeFuncionarioExibido.textContent = "";
    }

    const datasEventoInput = document.getElementById('datasEvento');
    const contadorDatas = document.getElementById('contadorDatas');

    if (datasEventoInput && datasEventoInput._flatpickr) {
        datasEventoInput._flatpickr.clear();
        console.log("Datas do evento limpas via Flatpickr.");
    } else if (datasEventoInput) {
        datasEventoInput.value = "";
    }
    if (contadorDatas) {
        contadorDatas.textContent = "Nenhuma data selecionada.";
    }

    const diariaDobradaInput = document.getElementById('diariaDobrada');

    if (diariaDobradaInput && diariaDobradaInput._flatpickr) {
        diariaDobradaInput._flatpickr.clear();
        console.log("Datas do evento limpas via Flatpickr.");
    }

     const meiaDiariaInput = document.getElementById('meiaDiaria');

    if (meiaDiariaInput && meiaDiariaInput._flatpickr) {
        meiaDiariaInput._flatpickr.clear();
        console.log("Datas do evento limpas via Flatpickr.");
    }

    // ✅ Limpeza de PDFs por classe
    const fileNamesPDF = document.querySelectorAll('.fileNamePDF');
    const fileInputsPDF = document.querySelectorAll('.filePDFInput');
    const hiddenInputsPDF = document.querySelectorAll('.hiddenPDF');

    fileNamesPDF.forEach(p => {
        p.textContent = "Nenhum arquivo selecionado";
    });
    fileInputsPDF.forEach(input => {
        input.value = "";
    });
    hiddenInputsPDF.forEach(input => {
        input.value = "";
    });
    console.log("Campos de arquivos PDF limpos.");

    // Resetar campos opcionais
    const ajusteCustoCheck = document.getElementById('ajusteCustocheck');
    const campoAjusteCusto = document.getElementById('campoAjusteCusto');
    const campoStatusAjusteCusto = document.getElementById('campoStatusAjusteCusto');

    const caixinhaCheck = document.getElementById('Caixinhacheck');
    const campoCaixinha = document.getElementById('campoCaixinha');
    const campoStatusCaixinha = document.getElementById('campoStatusCaixinha');


    if (ajusteCustoCheck) {
        ajusteCustoCheck.checked = false;
        if (campoAjusteCusto) campoAjusteCusto.style.display = 'none';
        const inputAjusteCusto = document.getElementById('ajusteCusto');
        if (inputAjusteCusto) inputAjusteCusto.value = '';

        const ajusteCustoTextarea = document.getElementById('descAjusteCusto');
        if (ajusteCustoTextarea) {
            ajusteCustoTextarea.style.display = 'none'; // Oculta o textarea
            ajusteCustoTextarea.required = false;      // Remove a obrigatoriedade
            ajusteCustoTextarea.value = '';            // Limpa o conteúdo
        }

        if (campoStatusAjusteCusto) campoStatusAjusteCusto.style.display = 'none';

    }
    if (caixinhaCheck) {
        caixinhaCheck.checked = false;
        if (campoCaixinha) campoCaixinha.style.display = 'none';
        const inputCaixinha = document.getElementById('caixinha');
        if (inputCaixinha) inputCaixinha.value = '';
        if (campoStatusCaixinha) campoStatusCaixinha.style.display = 'none';
    }

    const meiaDiariaCheck = document.getElementById('meiaDiariaCheck');
    if (meiaDiariaCheck) meiaDiariaCheck.checked = false;

    const diariaDobradacheck = document.getElementById('diariaDobradacheck');
    if (diariaDobradacheck) diariaDobradacheck.checked = false;

    if (check50) {
        check50.checked = false;
    }
    if (check100) {
        check100.checked = false;
    }

    const seniorCheck = document.getElementById('Seniorcheck');
    if (seniorCheck) seniorCheck.checked = false;

    const plenoCheck = document.getElementById('Plenocheck');
    if (plenoCheck) plenoCheck.checked = false;

    const juniorCheck = document.getElementById('Juniorcheck');
    if (juniorCheck) juniorCheck.checked = false;

    const baseCheck = document.getElementById('Basecheck');
    if (baseCheck) baseCheck.checked = false;

    const beneficioTextarea = document.getElementById('descBeneficio');
    if (beneficioTextarea) {
        beneficioTextarea.style.display = 'none'; // Oculta o textarea
        beneficioTextarea.required = false;      // Remove a obrigatoriedade
        beneficioTextarea.value = '';            // Limpa o conteúdo
    }

    const ajusteCustoTextarea = document.getElementById('descAjusteCusto');
    if (ajusteCustoTextarea) {
        ajusteCustoTextarea.style.display = 'none'; // Oculta o textarea
        ajusteCustoTextarea.required = false;      // Remove a obrigatoriedade
        ajusteCustoTextarea.value = '';            // Limpa o conteúdo
    }

    const descCaixinhaTextarea = document.getElementById('descCaixinha');
    if (descCaixinhaTextarea) {
        descCaixinhaTextarea.style.display = 'none'; // Oculta o textarea
        descCaixinhaTextarea.required = false;      // Remove a obrigatoriedade
        descCaixinhaTextarea.value = '';            // Limpa o conteúdo
    }

    const statusMeiaDiaria = document.getElementById('statusMeiaDiaria');
    if (statusMeiaDiaria) statusMeiaDiaria.value = 'Autorização da Meia Diária';

    const statusDiariaDobrada = document.getElementById('statusDiariaDobrada');
    if (statusDiariaDobrada) statusDiariaDobrada.value = 'Autorização da Diária Dobrada';

    const statusPgto = document.getElementById('statuspgto');
    if (statusPgto) statusPgto.value = '';

    const statusAjusteCusto = document.getElementById('statusAjusteCusto');
    if (statusAjusteCusto) statusAjusteCusto.value = 'Autorização do Ajuste de Custo';

    const statusCaixinha = document.getElementById('statuscaixinha');
    if (statusCaixinha) statusCaixinha.value = 'Autorização da Caixinha';

    const containerStatusDiariaDobrada = document.getElementById('containerStatusDiariaDobrada');
    const containerStatusMeiaDiaria = document.getElementById('containerStatusMeiaDiaria');

    if (containerStatusDiariaDobrada) {
        containerStatusDiariaDobrada.innerHTML = '';
        containerStatusDiariaDobrada.style.display = 'none';
    }

    if (containerStatusMeiaDiaria) {
        containerStatusMeiaDiaria.innerHTML = '';
        containerStatusMeiaDiaria.style.display = 'none';
    }

    const avaliacaoSelect = document.getElementById('avaliacao');
    if (avaliacaoSelect) {
        avaliacaoSelect.value = ''; // Define para o valor da opção vazia (se existir, ex: <option value="">Selecione...</option>)
        // avaliacaoSelect.selectedIndex = 0; // Alternativa: seleciona a primeira opção
        const tarjaAvaliacao = document.getElementById('tarjaAvaliacao');
        if (tarjaAvaliacao) {
            tarjaAvaliacao.className = 'tarja-avaliacao'; // Reseta para a classe padrão
            tarjaAvaliacao.textContent = ''; // Limpa o texto
            console.log("Campos de avaliação (select e tarja) limpos.");
        }
    }

    const tabelaCorpo = document.getElementById("eventsDataTable").getElementsByTagName("tbody")[0];
    if (tabelaCorpo) {
        // Remove todas as linhas filhas do tbody
        while (tabelaCorpo.firstChild) {
            tabelaCorpo.removeChild(tabelaCorpo.firstChild);
        }
        console.log("Corpo da tabela (tabela) limpo.");

        // Adiciona uma linha "vazia" de volta, se for o comportamento padrão desejado
        let emptyRow = tabelaCorpo.insertRow();
        let emptyCell = emptyRow.insertCell(0);
        emptyCell.colSpan = 20; // Ajuste para o número total de colunas da sua tabela
        emptyCell.textContent = "Nenhum item adicionado.";
        emptyCell.style.textAlign = "center";
        emptyCell.style.padding = "20px";
        console.log("Linha vazia adicionada à tabela 'tabela'.");
    } else {
        console.warn("Tabela com ID 'tabela' ou seu tbody não encontrado para limpeza. Verifique se o ID está correto.");
    }


    limparCamposComprovantes();
    limparFoto();

    // ✅ Limpa objeto em memória
    limparStaffOriginal();
    console.log("StaffOriginal resetado.");
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

// Sua função formatarDataParaBackend continua a mesma
function formatarDataParaBackend(dataString) {
    if (!dataString) return null;
    const partes = dataString.split('/');
    if (partes.length === 3) {
        let dia = partes[0];
        let mes = partes[1];
        let ano = partes[2];

        // Lógica para anos de 2 dígitos (mantida como está)
        if (ano.length === 2) {
            const currentYear = new Date().getFullYear(); // Ex: 2025
            const century = Math.floor(currentYear / 100) * 100; // Ex: 2000

            // Se o ano de 2 dígitos for maior que o ano atual de 2 dígitos (ex: 95 para 25), assume 19xx.
            // Senão, assume 20xx.
            if (parseInt(ano) > (currentYear % 100)) {
                ano = (century - 100) + parseInt(ano); // Ex: 1995
            } else {
                ano = century + parseInt(ano); // Ex: 2025
            }
        }

        mes = mes.padStart(2, '0');
        dia = dia.padStart(2, '0');

        return `${ano}-${mes}-${dia}`; // Retorna no formato YYYY-MM-DD
    }
    return null; // Retorna null se o formato não for DD/MM/YYYY
}

document.getElementById('ajusteCustocheck').addEventListener('change', function () {
  const campo = document.getElementById('campoAjusteCusto');
  const input = document.getElementById('ajusteCusto');
  const campoStatusAjusteCusto = document.getElementById('campoStatusAjusteCusto');
  const inputStatusAjusteCusto = document.getElementById('statusAjusteCusto');

  if (this.checked) {
    campo.style.display = 'block';
    input.required = true;
    input.style.width = '100%'; // aplica largura total

    campoStatusAjusteCusto.style.display = 'block';
    inputStatusAjusteCusto.required = true;
    inputStatusAjusteCusto.style.width = '100%';

  } else {
    campo.style.display = 'none';
    input.value = '';
    input.required = false;

    campoStatusAjusteCusto.style.display = 'none';
    inputStatusAjusteCusto.value = '';
    inputStatusAjusteCusto.required = false;
  }
});

document.getElementById('ajusteCusto').addEventListener('change', function () {

    const valorAjusteCusto = document.getElementById('ajusteCusto').value;

    console.log("VALOR DO ajusteCusto", valorAjusteCusto);

    const valorAjusteCustoNumerico = parseFloat(valorAjusteCusto.replace('R$', '').replace('.', '').replace(',', '.'));

    if (valorAjusteCustoNumerico > 0) {
        document.getElementById('statusAjusteCusto').value = 'Pendente';
    } else {
        // Se o valor for 0 ou negativo, limpa o status
        document.getElementById('statusAjusteCusto').value = '';
    }

});

document.getElementById('caixinha').addEventListener('change', function () {

    const valorCaixinha = document.getElementById('caixinha');
        if(caixinhaInput){
            const valorCaixinha = caixinhaInput.value;
            console.log("VALOR DO caixinhaInput", valorCaixinha);
        }else{
            console.warn("caixinhaInput não encontrado");
        }

    console.log("VALOR DA CAIXINHA", valorCaixinha);

    const valorCaixinhaNumerico = parseFloat(valorCaixinha.replace('R$', '').replace('.', '').replace(',', '.'));

    if (valorCaixinhaNumerico > 0) {
        document.getElementById('statusCaixinha').value = 'Pendente';
    } else {
        // Se o valor for 0 ou negativo, limpa o status
        document.getElementById('statusCaixinha').value = '';
    }

});

document.getElementById('Caixinhacheck').addEventListener('change', function () {
  const campo = document.getElementById('campoCaixinha');
  const input = document.getElementById('caixinha');

  const campoStatusCaixinha = document.getElementById('campoStatusCaixinha');
  const inputStatusCaixinha = document.getElementById('statusCaixinha');


  if (this.checked) {
    campo.style.display = 'block';
    input.required = true;
    input.style.width = '170px'; // aplica largura total

    campoStatusCaixinha.style.display = 'block';
    inputStatusCaixinha.required = true;
    inputStatusCaixinha.style.width = '170px';
  } else {
    campo.style.display = 'none';
    input.value = '';
    input.required = false;

    campoStatusCaixinha.style.display = 'none';
    inputStatusCaixinha.value = '';
    inputStatusCaixinha.required = false;
  }
});

document.getElementById('Seniorcheck').addEventListener('change', function () {
    if (seniorCheck.checked) {
        // Lógica para quando o checkbox de Senior estiver marcado
        plenoCheck.checked = false;
        juniorCheck.checked = false;
        baseCheck.checked = false;

        console.log("Valores para Senior - Custo:", vlrCustoSeniorFuncao, "Almoço:", vlrAlmocoFuncao, "Jantar:", vlrJantarFuncao, "Transporte:", vlrTransporteSeniorFuncao);

       document.getElementById("vlrCusto").value = (parseFloat(vlrCustoSeniorFuncao) || 0).toFixed(2);
  //     document.getElementById("almoco").value = (parseFloat(vlrAlmocoFuncao) || 0).toFixed(2);
  //     document.getElementById("jantar").value = (parseFloat(vlrJantarFuncao) || 0).toFixed(2);
       document.getElementById("transporte").value = (parseFloat(vlrTransporteSeniorFuncao) || 0).toFixed(2);
    }
});

document.getElementById('Plenocheck').addEventListener('change', function () {
    if (plenoCheck.checked) {
        // Lógica para quando o checkbox de Pleno estiver marcado
        seniorCheck.checked = false;
        juniorCheck.checked = false;
        baseCheck.checked = false;

        document.getElementById("vlrCusto").value = (parseFloat(vlrCustoPlenoFuncao) || 0).toFixed(2);
    //    document.getElementById("almoco").value = (parseFloat(vlrAlmocoFuncao) || 0).toFixed(2);
    //    document.getElementById("jantar").value = (parseFloat(vlrJantarFuncao) || 0).toFixed(2);
        document.getElementById("transporte").value = (parseFloat(vlrTransporteFuncao) || 0).toFixed(2);
    }
});

document.getElementById('Juniorcheck').addEventListener('change', function () {
    if (juniorCheck.checked) {
        // Lógica para quando o checkbox de Junior estiver marcado
        seniorCheck.checked = false;
        plenoCheck.checked = false;
        baseCheck.checked = false;

        document.getElementById("vlrCusto").value = (parseFloat(vlrCustoJuniorFuncao) || 0).toFixed(2);
    //   document.getElementById("almoco").value = (parseFloat(vlrAlmocoFuncao) || 0).toFixed(2);
    //    document.getElementById("jantar").value = (parseFloat(vlrJantarFuncao) || 0).toFixed(2);
        document.getElementById("transporte").value = (parseFloat(vlrTransporteFuncao) || 0).toFixed(2);
    }
});

document.getElementById('Basecheck').addEventListener('change', function () {
    if (baseCheck.checked) {
        // Lógica para quando o checkbox de Base estiver marcado
        seniorCheck.checked = false;
        plenoCheck.checked = false;
        juniorCheck.checked = false;

        document.getElementById("vlrCusto").value = (parseFloat(vlrCustoBaseFuncao) || 0).toFixed(2);
   //     document.getElementById("almoco").value = (parseFloat(vlrAlmocoFuncao) || 0).toFixed(2);
   //     document.getElementById("jantar").value = (parseFloat(vlrJantarFuncao) || 0).toFixed(2);
        document.getElementById("transporte").value = (parseFloat(vlrTransporteFuncao) || 0).toFixed(2);
    }
});

document.getElementById('Almococheck').addEventListener('change', function () {
    if (almocoCheck.checked) {       
        document.getElementById("almoco").value = (parseFloat(vlrAlmocoFuncao) || 0).toFixed(2);        
    }
    else {
        document.getElementById("almoco").value = 0;
    }
});

document.getElementById('Jantarcheck').addEventListener('change', function () {
    if (jantarCheck.checked) {   
        document.getElementById("jantar").value = (parseFloat(vlrJantarFuncao) || 0).toFixed(2);       
    }
    else {
        document.getElementById("jantar").value = 0;
    }
});

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
    const feriadosFixos = ["01-01","04-21","05-01","09-07","10-12","11-02","11-15","12-25"];

    // Checa feriados fixos
    if (feriadosFixos.includes(mmdd)) return true;

    // Checa feriados móveis
    const moveis = feriadosMoveis(date.getFullYear());
    return moveis.some(d => d.getDate() === date.getDate() && d.getMonth() === date.getMonth());
}


function isFinalDeSemanaOuFeriado(date) {
  const dia = date.getDay(); // 0=Domingo, 6=Sábado
  return dia === 0 || dia === 6 || isFeriado(date);
}


function calcularValorTotal() {
    console.log("Iniciando o cálculo do valor total...");

    // Pega os valores dos inputs e converte para número
    const cache = parseFloat(document.getElementById('vlrCusto').value.replace(',', '.')) || 0;
    const transporte = parseFloat(document.getElementById('transporte').value.replace(',', '.')) || 0;
    const almoco = parseFloat(document.getElementById('almoco').value.replace(',', '.')) || 0;
    const jantar = parseFloat(document.getElementById('jantar').value.replace(',', '.')) || 0;
    const ajusteCusto = parseFloat(document.getElementById('ajusteCusto').value.replace(',', '.')) || 0;
    const caixinha = parseFloat(document.getElementById('caixinha').value.replace(',', '.')) || 0;
    const perfilFuncionario = document.getElementById("perfilFuncionario").value;

    if (isFormLoadedFromDoubleClick)
    {
        console.log("VALORES PARA RECALCULAR", vlrAlmocoDobra, vlrJantarDobra);
    }

    // Pega o número de diárias selecionadas
    const contadorTexto = document.getElementById('contadorDatas').innerText;
    const match = contadorTexto.match(/\d+/);
    const numeroDias = match ? parseInt(match[0]) : 0;

    // Conta apenas o número de datas do evento
    console.log("Número de diárias:", contadorTexto, match, numeroDias, cache, ajusteCusto, transporte, almoco, jantar, caixinha, datasEventoSelecionadas);

    // Inicializa o valor total com os itens que são sempre calculados
   // let total = (cache + transporte + almoco + jantar) * numeroDias;
    let total = 0;

    (datasEventoSelecionadas || []).forEach(data => {
        console.log("Processando data:", data, perfilFuncionario);

        if (perfilFuncionario === "Freelancer") {
            total += cache + transporte + almoco + jantar;
        } else {
            if (isFinalDeSemanaOuFeriado(data)) {
                total += cache + transporte + almoco + jantar;
            } else {
                total += transporte + almoco + jantar;
                console.log(`Data ${data.toLocaleDateString()} não é fim de semana nem feriado. Cachê não adicionado.`);
            }
        }
    });

    console.log("Total inicial (sem adicionais):", total.toFixed(2));

    // --- NOVA LÓGICA: INCLUIR VALORES APENAS SE AUTORIZADOS ---

    // 1. Verificação do Ajuste de Custo
    const statusAjusteCusto = document.getElementById("statusAjusteCusto").value;
    if (statusAjusteCusto === 'Autorizado') {
        total += ajusteCusto;
        console.log("Ajuste de Custo Autorizado. Adicionando:", ajusteCusto.toFixed(2));
    } else {
        console.log("Ajuste de Custo Não Autorizado. Não adicionado.");
    }

    // 2. Verificação da Caixinha
    const statusCaixinha = document.getElementById("statusCaixinha").value;
    if (statusCaixinha === 'Autorizado') {
        total += caixinha;
        console.log("Caixinha Autorizada. Adicionando:", caixinha.toFixed(2));
    } else {
        console.log("Caixinha Não Autorizada. Não adicionada.");
    }

    // 3. Verificação de Diárias Dobradas
    // if (diariaDobradacheck.checked && datasDobrada && datasDobrada.length > 0) {
    //     const diariasDobradasAutorizadas = datasDobrada.filter(item => item.status === 'Autorizado');
    //     if (diariasDobradasAutorizadas.length > 0) {
    //         const valorDiariaDobrada = (cache + transporte + jantar) * diariasDobradasAutorizadas.length;
    //         total += valorDiariaDobrada;
    //         console.log(`Diárias Dobradas Autorizadas: ${diariasDobradasAutorizadas.length}. Adicionando: ${valorDiariaDobrada.toFixed(2)}`);
    //     }
    // }

    // // 4. Verificação de Meias Diárias
    // if (meiaDiariacheck.checked && datasMeiaDiaria && datasMeiaDiaria.length > 0) {
    //     const meiasDiariasAutorizadas = datasMeiaDiaria.filter(item => item.status === 'Autorizado');
    //     if (meiasDiariasAutorizadas.length > 0) {
    //         const valorMeiaDiaria = ((cache / 2)+ transporte) * meiasDiariasAutorizadas.length;
    //         total += valorMeiaDiaria;
    //         console.log(`Meias Diárias Autorizadas: ${meiasDiariasAutorizadas.length}. Adicionando: ${valorMeiaDiaria.toFixed(2)}`);
    //     }
    // }

    // 3. Verificação de Diárias Dobradas
    if (diariaDobradacheck.checked && datasDobrada && datasDobrada.length > 0) {
        const diariasDobradasAutorizadas = datasDobrada.filter(item => item.status === 'Autorizado');
        if (diariasDobradasAutorizadas.length > 0) {
            let valorDiariaDobrada = cache; // base é o cache
            
            // Ajuste conforme checkboxes
            if (almocoCheck.checked) valorDiariaDobrada += vlrJantarDobra;   // somar jantar se almoço estiver marcado
            if (jantarCheck.checked) valorDiariaDobrada += vlrAlmocoDobra;   // somar almoço se jantar estiver marcado
            
            // transporte não entra no cálculo
            valorDiariaDobrada *= diariasDobradasAutorizadas.length;
            
            total += valorDiariaDobrada;
            console.log(`Diárias Dobradas Autorizadas: ${diariasDobradasAutorizadas.length}. Adicionando: ${valorDiariaDobrada.toFixed(2)}`);
        }
    }

    // 4. Verificação de Meias Diárias
    if (meiaDiariacheck.checked && datasMeiaDiaria && datasMeiaDiaria.length > 0) {
        const meiasDiariasAutorizadas = datasMeiaDiaria.filter(item => item.status === 'Autorizado');
        if (meiasDiariasAutorizadas.length > 0) {
            let valorMeiaDiaria = cache / 2; // base é metade do cache

            console.log("ALIMENTACAO", jantar, almoco);
            
            // Ajuste conforme checkboxes
            if (almocoCheck.checked) valorMeiaDiaria += vlrJantarDobra;   // somar jantar se almoço estiver marcado
            if (jantarCheck.checked) valorMeiaDiaria += vlrAlmocoDobra;   // somar almoço se jantar estiver marcado
            
            // transporte não entra no cálculo
            valorMeiaDiaria *= meiasDiariasAutorizadas.length;
            
            total += valorMeiaDiaria;
            console.log(`Meias Diárias Autorizadas: ${meiasDiariasAutorizadas.length}. Adicionando: ${valorMeiaDiaria.toFixed(2)}`);
        }
    }


    // Formatação e atualização dos campos
    const valorFormatado = 'R$ ' + total.toFixed(2).replace('.', ',');
    const valorLimpo = total.toFixed(2);

    document.getElementById('vlrTotal').value = valorFormatado;
    document.getElementById('vlrTotalHidden').value = valorLimpo;

    console.log("Valor Total Final: R$", total.toFixed(2));
}

// O restante do seu código de listeners está correto VERIFICAR SE É PARA REMOVER TODO O TRECHO
//Adiciona listeners de input para os campos que impactam no cálculo
['vlrCusto', 'ajusteCusto', 'transporte', 'almoco', 'jantar', 'caixinha'].forEach(function(id) {
    const el = document.getElementById(id);
    if(el) el.addEventListener('input', calcularValorTotal);
});

// // Adiciona listeners para os checkboxes de diária também!
['diariaDobradacheck', 'meiaDiariacheck'].forEach(function(id) {
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

function mostrarTarja() {
    var select = document.getElementById('avaliacao');
    var tarja = document.getElementById('tarjaAvaliacao');

    tarja.className = 'tarja-avaliacao'; // Reseta classes
    tarja.style.display = 'none'; // Oculta por padrão

    if (select.value === 'muito_bom') {
    tarja.classList.add('muito-bom');
    tarja.textContent = 'Funcionário Muito Bom';
    tarja.style.display = 'block';
    } else if (select.value === 'satisfatorio') {
    tarja.classList.add('satisfatorio');
    tarja.textContent = 'Funcionário Satisfatório';
    tarja.style.display = 'block';
    } else if (select.value === 'regular') {
    tarja.classList.add('regular');
    tarja.textContent = 'Funcionário Regular';
    tarja.style.display = 'block';
    }
}


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

        console.log("PERMISSAO", temPermissaoTotal);
        if (temPermissaoTotal)
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



/**
 * Verifica se a quantidade de funcionários para uma função excedeu o orçamento
 * com base em múltiplos critérios, incluindo o período.
 * @param {object} criterios - Objeto com os critérios (ex: {nmFuncao, nmEvento, datasEvento, ...}).
 * @returns {boolean} - true se o limite não foi atingido, false caso contrário.
 */
function verificarLimiteDeFuncao(criterios) {
    // 1. Construa a chave composta, igual à usada em buscarEPopularOrcamento
    const chave = `${criterios.nmEvento}-${criterios.nmCliente}-${criterios.nmlocalMontagem}-${criterios.pavilhao}-${criterios.nmFuncao}`;
    const dadosOrcamento = orcamentoPorFuncao[chave];

    // Se não houver dados de orçamento, não há limite
    if (!dadosOrcamento) {
        return true;
    }

    // 2. Conte quantos funcionários já foram inseridos na tabela com esses critérios
    let countNaTabela = 0;
    const linhasTabela = document.querySelectorAll('#eventsTableBody tr');
    linhasTabela.forEach(linha => {
        const eventDataNaLinha = JSON.parse(linha.dataset.eventData);
        if (
            eventDataNaLinha.nmfuncao.trim().toUpperCase() === criterios.nmFuncao.toUpperCase().trim() &&
            eventDataNaLinha.nmevento.trim().toUpperCase() === criterios.nmEvento.toUpperCase().trim() &&
            eventDataNaLinha.nmcliente.trim().toUpperCase() === criterios.nmCliente.toUpperCase().trim() &&
            eventDataNaLinha.nmlocalmontagem.trim().toUpperCase() === criterios.nmlocalMontagem.toUpperCase().trim() &&
            //eventDataNaLinha.pavilhao.trim().toUpperCase() === criterios.pavilhao.toUpperCase().trim()
            eventDataNaLinha.setor.trim().toUpperCase() === criterios.setor.toUpperCase().trim()
        ) {
            countNaTabela++;
        }
    });

    // 3. Combine a contagem do banco e da tabela
    const totalEscalado = dadosOrcamento.quantidadeEscalada + countNaTabela;
    const limite = dadosOrcamento.quantidadeOrcada;

    console.log(`Verificando para a combinação '${chave}' - Total escalado: ${totalEscalado}, Limite: ${limite}`);

    if (totalEscalado >= limite) {
        Swal.fire({
            icon: 'warning',
            title: 'Limite atingido',
            text: `O limite de ${limite} para esta função no período já foi alcançado. Existem ${dadosOrcamento.quantidadeEscalada} funcionários já salvos para este período neste setor e ${countNaTabela} adicionados na lista atual.`,
        });
        return false;
    }

    return true;
}

function limparCamposComprovantes() {

    preencherComprovanteCampo(null, 'Cache');
    preencherComprovanteCampo(null, 'AjdCusto');
    preencherComprovanteCampo(null, 'AjdCusto2');
    preencherComprovanteCampo(null, 'Caixinha');

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



// function ocultarCamposComprovantes(papelDoUsuario) {
//     // Condição para MOSTRAR os campos de comprovantes
//     //const temPermissaoMaster = temPermissao("Staff", "master");
//     // const temPermissaoFinanceiro = temPermissao("Staff", "financeiro");

//     // const temPermissaoTotal = (temPermissaoMaster || temPermissaoFinanceiro);

//     // Se o usuário NÃO tiver a permissão, oculta o container.
//     // Caso contrário, ele permanece visível (ou é exibido).
//     if (!temPermissaoTotal) {
//         containerPDF.style.display = 'none';
//     } else {
//         containerPDF.style.display = ''; // Volta ao padrão
//     }
// }


function configurarEventosStaff() {
    console.log("Configurando eventos Staff...");

    const containerPDF = document.querySelector('.pdf');

    // Se o usuário NÃO tiver a permissão, oculta o container.
    // Caso contrário, ele permanece visível (ou é exibido).
    if (!temPermissaoTotal) {
        containerPDF.style.display = 'none';
    } else {
        containerPDF.style.display = ''; // Volta ao padrão
    }

    verificaStaff(); // Carrega os Staff ao abrir o modal
    adicionarEventoBlurStaff();
    inicializarFlatpickrsGlobais();
    limparStaffOriginal()

    // Inicializa o estado dos campos extra/caixinha no carregamento
    const inputAjusteCusto = document.getElementById('ajusteCusto');
    const ajusteCustocheck = document.getElementById('ajusteCustocheck');
    const campoAjusteCusto = document.getElementById('campoAjusteCusto');

    if (ajusteCustocheck && campoAjusteCusto && ajusteCustoTextarea) {
        ajusteCustocheck.addEventListener('change', function() {
            campoAjusteCusto.style.display = this.checked ? 'block' : 'none';

            ajusteCustoTextarea.style.display = this.checked ? 'block' : 'none';
            ajusteCustoTextarea.required = this.checked;
            if (!this.checked) {
                if (inputAjusteCusto) inputAjusteCusto.value = ''; // Limpa o input 'ajusteCusto' ao ocultar
                ajusteCustoTextarea.value = '';               // Limpa o textarea 'ajusteCusto' ao ocultar
            }

        });

        campoAjusteCusto.style.display = ajusteCustocheck.checked ? 'block' : 'none';

        ajusteCustoTextarea.style.display = ajusteCustocheck.checked ? 'block' : 'none';
        ajusteCustoTextarea.required = ajusteCustocheck.checked;
        if (!ajusteCustocheck.checked) {
            if (inputAjusteCusto) inputAjusteCusto.value = '';
            ajusteCustoTextarea.value = '';
        }
    }

    const caixinhacheck = document.getElementById('Caixinhacheck');
    const campoCaixinha = document.getElementById('campoCaixinha');

    if (caixinhacheck && campoCaixinha) {
        caixinhacheck.addEventListener('change', function() {
            campoCaixinha.style.display = this.checked ? 'block' : 'none';
        });
        campoCaixinha.style.display = caixinhacheck.checked ? 'block' : 'none';
    }

    const diariaDobradacheck = document.getElementById('diariaDobradacheck');
    const campoDiariaDobrada = document.getElementById('campoDiariaDobrada');
    if (diariaDobradacheck && campoDiariaDobrada) {
        diariaDobradacheck.addEventListener('change', function() {
            campoDiariaDobrada.style.display = this.checked ? 'block' : 'none';

        });
        campoDiariaDobrada.style.display = diariaDobradacheck.checked ? 'block' : 'none';

    }

    const meiaDiariacheck = document.getElementById('meiaDiariacheck');
    const campoMeiaDiaria = document.getElementById('campoMeiaDiaria');
    if (meiaDiariacheck && campoMeiaDiaria) {
        meiaDiariacheck.addEventListener('change', function() {
            campoMeiaDiaria.style.display = this.checked ? 'block' : 'none';
         });
        campoMeiaDiaria.style.display = meiaDiariacheck.checked ? 'block' : 'none';
    }

    // Chama mostrarTarja() para inicializar a tarja com base no valor do select
    if (typeof mostrarTarja === 'function') {
        mostrarTarja();
    }

    console.log("Entrou configurar Staff no STAFF.js.");

}


window.configurarEventosStaff = configurarEventosStaff;

function configurarEventosEspecificos(modulo) {
  console.log("⚙️ configurarEventosEspecificos recebeu:", modulo);
  if (modulo.trim().toLowerCase() === 'staff') {
    configurarEventosStaff();

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