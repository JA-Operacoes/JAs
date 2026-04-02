
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

const formatInputTextWithStatus = (instance, dataArray) => {

    if (!instance || !instance.altInput) {
        // Se estiver faltando, apenas sai da função.
        return; 
    }
    const datesWithStatus = instance.selectedDates.map(date => {
        const dateStr = flatpickr.formatDate(date, "Y-m-d");
        const statusData = dataArray.find(item => item.data === dateStr);
        const status = statusData ? statusData.status : 'Pendente';
        return `${flatpickr.formatDate(date, "d/m/Y")} - ${status}`;
    });
    instance.altInput.value = datesWithStatus.join(', ');
};

// Novo auxiliar para ser chamado com o resultado de parseDatesWithStatus
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
                        dayElement.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();

                            Swal.fire({
                                title: 'Atenção!',
                                text: `Esta data já foi processada e não pode ser desmarcada.`,
                                icon: 'warning',
                                confirmButtonText: 'OK'
                            });
                            console.log("✅ diariaDobradaPicker inicializado:", window.diariaDobradaPicker);
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
    const campo = document.getElementById('campoDiariaDobrada');
    const campoStatus = document.getElementById('campoStatusDiariaDobrada');
    const check = document.getElementById('diariaDobradacheck');
    if (campo) campo.style.display = 'block';
    if (campoStatus) campoStatus.style.display = 'block';
    if (check) check.checked = true;
    console.log("🟢 onOpen diariaDobrada - campoStatus:", campoStatus?.style.display);
},
            
            onChange: (selectedDates, dateStr, instance) => {
                // Lógica de prevenção de remoção para datas não pendentes
                const previouslySelectedDates = instance._prevSelectedDates || [];
                const datesAttemptedToRemove = previouslySelectedDates.filter(prevDate => 
                    !selectedDates.some(newDate => prevDate.getTime() === newDate.getTime())
                );

                const unauthorizedRemovals = datesAttemptedToRemove.filter(removedDate =>
                    datasDobrada.some(d => 
                        d.status.toLowerCase() !== 'pendente' && 
                        flatpickr.formatDate(new Date(d.data), 'Y-m-d') === flatpickr.formatDate(removedDate, 'Y-m-d')
                    )
                );

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

                // Se a validação passou, atualize a variável para o próximo ciclo
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
                document.getElementById('diariaDobradacheck').checked = instance.selectedDates.length > 0;
                updateDisabledDates();
                console.log("Fechando Diária Dobrada, datas selecionadas:", selectedDates);
                calcularValorTotal();
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
                            console.log("✅ meiaDiariaPicker inicializado:", window.meiaDiariaPicker);
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
                const campo = document.getElementById('campoMeiaDiaria');
                const campoStatus = document.getElementById('campoStatusMeiaDiaria');
                const check = document.getElementById('meiaDiariacheck');
                if (campo) campo.style.display = 'block';
                if (campoStatus) campoStatus.style.display = 'block';
                if (check) check.checked = true;
            },
            onChange: (selectedDates, dateStr, instance) => {
                // Lógica de verificação de duplicatas (conflito com Diária Dobrada)
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

                const unauthorizedRemovals = datesAttemptedToRemove.filter(removedDate =>
                    datasMeiaDiaria.some(d => 
                        d.status.toLowerCase() !== 'pendente' && 
                        flatpickr.formatDate(new Date(d.data), 'Y-m-d') === flatpickr.formatDate(removedDate, 'Y-m-d')
                    )
                );

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
            },
        });
    } else {
        window.meiaDiariaPicker = null; // Garante que a variável seja null se o elemento não for encontrado
        console.warn("Elemento #meiaDiaria não encontrado. Picker de Meia Diária não inicializado.");
    }

    // --- 3. Inicialização do Picker Principal (datasEvento) ---
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
                if (selectedDates.length > 0 && typeof atualizarContadorEDatas === 'function') {
                    atualizarContadorEDatas(selectedDates);
                }  
            },

            onDayCreate: (dObj, dStr, fp, dayElement) => {
                const dataDia = flatpickr.formatDate(dayElement.dateObj, "Y-m-d");
                
                console.log("🟢 DEBUG: ENTROU EM DATAS EVENTO NO CONFIGURAR FLATPICKRS");
                
                const statusDataDobrada = datasDobrada.find(d => d.data === dataDia);
                const statusDataMeiaDiaria = datasMeiaDiaria.find(d => d.data === dataDia);

                if (statusDataDobrada) {
                    const status = statusDataDobrada.status.toLowerCase();
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
                } else if (statusDataMeiaDiaria) {
                    const status = statusDataMeiaDiaria.status.toLowerCase();
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

                console.log("🟢 DEBUG: CHANGE DATAS EVENTO", datasEventoSelecionadas);
                
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
                
                instance._prevSelectedDates = [...selectedDates];
                
                atualizarContadorEDatas(selectedDates);
                console.log("DEBUG ATÔMICO: Chamando debouncedOnCriteriosChanged do onChange."); 
                debouncedOnCriteriosChanged();
            },
            onClose: selectedDates => {
                console.log(" 🟢 DEBUG ATÔMICO: Evento onClose disparado."); 
                
                if (selectedDates.length > 0) {
                    console.log("DEBUG ATÔMICO: Chamando debouncedOnCriteriosChanged."); 
                } else {
                    console.log("DEBUG ATÔMICO: Nenhuma data selecionada.");
                }
                
                console.log("Datas selecionadas:", selectedDates); 
                console.log("Fechando Datas Evento, datas selecionadas:", selectedDates);
                atualizarContadorEDatas(selectedDates);
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
        setor: "",
        statusPgto: "",
        nivelExperiencia: "",
        idequipe: "",
        nmequipe: ""
    };
}


// const eventsTableBody = document.querySelector('#eventsDataTable tbody');
// const noResultsMessage = document.getElementById('noResultsMessage');
// const idFuncionarioHiddenInput = document.getElementById('idFuncionario');
// const apelidoFuncionarioInput = document.getElementById("apelidoFuncionario");
// const perfilFuncionarioInput = document.getElementById("perfilFuncionario");
// const previewFotoImg = document.getElementById('previewFoto');
// const fileNameSpan = document.getElementById('fileName');
// const uploadHeaderDiv = document.getElementById('uploadHeader');
// const fileInput = document.getElementById('file');
// const avaliacaoSelect = document.getElementById('avaliacao'); // Se usar
// const tarjaDiv = document.getElementById('tarjaAvaliacao'); // Se usar
// //const bFuncionarioCadstrado = false;

// const idStaffInput = document.getElementById('idStaff'); // Campo ID Staff
// const idStaffEventoInput = document.getElementById('idStaffEvento');
// const idFuncaoInput = document.getElementById('idFuncao');
// const descFuncaoSelect = document.getElementById('descFuncao'); // Select de Função
// const vlrCustoInput = document.getElementById('vlrCusto');
// const ajusteCustoInput = document.getElementById('ajusteCusto');
// const transporteInput = document.getElementById('transporte');
// const alimentacaoInput = document.getElementById('alimentacao');
// const statusPgtoAjudaCustoInput = document.getElementById('statusPgtoAjudaCusto');
// const caixinhaInput = document.getElementById('caixinha');
// const descBeneficioTextarea = document.getElementById('descBeneficio');
// const nmLocalMontagemSelect = document.getElementById('nmLocalMontagem');
// const nmPavilhaoSelect = document.getElementById('nmPavilhao');
// const idClienteInput = document.getElementById('idCliente');
// const nmClienteSelect = document.getElementById('nmCliente');
// const idEventoInput = document.getElementById('idEvento');
// const nmEventoSelect = document.getElementById('nmEvento');
// const datasEventoInput = document.getElementById('datasEvento'); // Input do Flatpickr


// const ajusteCustocheck = document.getElementById('ajusteCustocheck');
// const campoAjusteCusto = document.getElementById('campoAjusteCusto');
// const ajusteCustoTextarea = document.getElementById('descAjusteCusto');
// const campoStatusajusteCusto = document.getElementById('campoStatusAjusteCusto');
// const statusAjusteCustoInput = document.getElementById('statusAjusteCusto');
// const selectStatusAjusteCusto = document.getElementById('selectStatusAjusteCusto');

// // let ajusteCustocheck = document.getElementById('ajusteCustocheck');
// // let campoAjusteCusto = document.getElementById('campoAjusteCusto');
// // let ajusteCustoTextarea = document.getElementById('descAjusteCusto');
// // let campoStatusajusteCusto = document.getElementById('campoStatusAjusteCusto');
// // let statusAjusteCustoInput = document.getElementById('statusAjusteCusto');
// // let selectStatusAjusteCusto = document.getElementById('selectStatusAjusteCusto');


// const vlrTotalInput = document.getElementById('vlrTotal');
// const vlrTotalCacheInput = document.getElementById('vlrTotalCache');
// const vlrTotalAjdCustoInput = document.getElementById('vlrTotalAjdCusto');

// //const campoAjusteCustoTextarea = document.getElementById('descajusteCusto');
// const caixinhacheck = document.getElementById('Caixinhacheck');
// const campoCaixinha = document.getElementById('campoCaixinha');
// const campoPgtoCaixinha = document.getElementById('campoPgtoCaixinha');
// const descCaixinhaTextarea = document.getElementById('descCaixinha');
// const campoStatusCaixinha = document.getElementById('campoStatusCaixinha');
// const statusCaixinhaInput = document.getElementById('statusCaixinha');
// const selectStatusCaixinha = document.getElementById('selectStatusCaixinha');
// const statusPgtoCaixinhaInput = document.getElementById('statusPgtoCaixinha');

// const setorInput = document.getElementById('setor');

// const statusPagtoInput = document.getElementById('statusPgto');

// const temPermissaoMaster = temPermissao("Staff", "master");
// const temPermissaoFinanceiro = temPermissao("Staff", "financeiro");
// const temPermissaoTotal = (temPermissaoMaster && temPermissaoFinanceiro);

// const diariaDobradaInput = document.getElementById('diariaDobrada');
// const diariaDobradacheck = document.getElementById('diariaDobradacheck');
// const campoDiariaDobrada = document.getElementById('campoDiariaDobrada');
// const descDiariaDobradaTextarea = document.getElementById('descDiariaDobrada');
// const campoStatusDiariaDobrada = document.getElementById('campoStatusDiariaDobrada');
// const statusDiariaDobradaInput = document.getElementById('statusDiariaDobrada');

// const meiaDiariaInput = document.getElementById('meiaDiaria');
// const meiaDiariacheck = document.getElementById('meiaDiariacheck');
// const campoMeiaDiaria = document.getElementById('campoMeiaDiaria');
// const descMeiaDiariaTextarea = document.getElementById('descMeiaDiaria');
// const descCustoFechadoTextarea = document.getElementById('descCustoFechado');
// const campoStatusMeiaDiaria = document.getElementById('campoStatusMeiaDiaria');
// const statusMeiaDiariaInput = document.getElementById('statusMeiaDiaria');

// const containerDiariaDobradaCheck = document.querySelector('#diariaDobradacheck').closest('.input-container-checkbox');
// const containerMeiaDiariacheck = document.querySelector('#meiaDiariacheck').closest('.input-container-checkbox');
// const containerStatusDiariaDobrada = document.getElementById('containerStatusDiariaDobrada');
// const containerStatusMeiaDiaria = document.getElementById('containerStatusMeiaDiaria');

// const check50 = document.getElementById('check50');
// const check100 = document.getElementById('check100');

// const container1 = document.getElementById('labelFileAjdCusto').parentElement;
// const container2 = document.getElementById('labelFileAjdCusto2').parentElement;
// const mensagemConcluido = document.getElementById('mensagemConcluido');


// const seniorCheck = document.getElementById('Seniorcheck');
// const seniorCheck2 = document.getElementById('Seniorcheck2');
// const plenoCheck = document.getElementById('Plenocheck');
// const juniorCheck = document.getElementById('Juniorcheck');
// const baseCheck = document.getElementById('Basecheck');
// const fechadoCheck =  document.getElementById('Fechadocheck');

// const qtdPessoasInput = document.getElementById('qtdPessoas');

// const idEquipeInput = document.getElementById('idEquipe');
// const nmEquipeSelect = document.getElementById('nmEquipe'); // Select de Equipe

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



const carregarDadosParaEditar = (eventData, bloquear) => {
    console.log("Objeto eventData recebido:", eventData);
    console.log("Valor de dtdiariadobrada:", eventData.dtdiariadobrada);    

    const btn = document.getElementById('Enviar');
    const fieldsetEvento = document.getElementById('containerFieldsets');
    
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
    currentEditingStaffEvent = eventData;

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
    ajusteCustoTextarea.value = eventData.descajustecusto || 'Pendente';
    statusAjusteCustoInput.value = eventData.statusajustecusto || 'Pendente';

    caixinhaInput.value = parseFloat(eventData.vlrcaixinha || 0).toFixed(2).replace('.', ',');
    descCaixinhaTextarea.value = eventData.desccaixinha || '';
    statusCaixinhaInput.value = eventData.statuscaixinha || 'Pendente';
    statusPgtoCaixinhaInput.value = (eventData.statuspgtocaixinha?.toUpperCase()) || 'Pendente';

    vlrTotalInput.value = parseFloat(eventData.vlrtotal || 0).toFixed(2).replace('.', ',');
    if (vlrTotalCacheInput) vlrTotalCacheInput.value = parseFloat(eventData.vlrcache || 0).toFixed(2).replace('.', ',');
    if (vlrTotalAjdCustoInput) vlrTotalAjdCustoInput.value = parseFloat(eventData.vlrajustecusto || 0).toFixed(2).replace('.', ',')
    console.log("VALOR TOTAL", vlrTotalInput.value);

    // Outros Campos de Status
    setorInput.value = (eventData.setor || '').toUpperCase();
    statusPagtoInput.value = (eventData.statuspgto || 'Pendente').toUpperCase();
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

    return precisaCache || precisaAjd || precisaCaixinha;
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

     // PASSO 2: Extrai APENAS os objetos Date para o setDate()
    // Use a função que retorna APENAS os objetos Date (seja getDatesForFlatpickr ou extractDatesFromStatusArray)
    const datesEvento = getDatesForFlatpickr(eventData.datasevento); // Presumindo que datasevento seja uma string JSON de datas
    const datesDiariaDobrada = extractDatesFromStatusArray(datasDobrada); // 💡 USAR O NOVO AUXILIAR
    const datesMeiaDiaria = extractDatesFromStatusArray(datasMeiaDiaria); // 💡 USAR O NOVO AUXILIAR

    //  // **PASSO 3: INICIALIZAR AS NOVAS INSTÂNCIAS COM AS CONFIGURAÇÕES CORRETAS**

    // console.log("Valor de dtdiariadobrada:", eventData.dtdiariadobrada, eventData.dtmeiadiaria,eventData.datasevento );

    // // **PASSO 4: PREENCHER AS NOVAS INSTÂNCIAS COM OS DADOS CARREGADOS E PREENCHER O ALTINPUT**
    // const datesEvento = getDatesForFlatpickr(eventData.datasevento);
    // const datesDiariaDobrada = getDatesForFlatpickr(datasDobrada);
    // const datesMeiaDiaria = getDatesForFlatpickr(datasMeiaDiaria);

    datasEventoSelecionadas = datesEvento;

    window.datasEventoPicker.setDate(datesEvento, false);

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
        const statusAjuste = eventData.statusajustecusto || 'Pendente';
        statusAjusteCustoInput.value = statusAjuste.charAt(0).toUpperCase() + statusAjuste.slice(1).toLowerCase();
        aplicarCorStatusInput(statusAjusteCustoInput);

        document.getElementById('selectStatusCaixinha').style.display = 'none';
        statusCaixinhaInput.style.display = 'block';
        const statusCx = eventData.statuscaixinha || 'Pendente';
        statusCaixinhaInput.value = statusCx.charAt(0).toUpperCase() + statusCx.slice(1).toLowerCase();
        aplicarCorStatusInput(statusCaixinhaInput);

        // Esconde os grupos (label + container)
        document.getElementById('grupoDiariaDobrada').style.display = 'none';
        document.getElementById('grupoMeiaDiaria').style.display = 'none';

        // Mostra os inputs antigos
        document.getElementById('selectStatusDiariaDobrada').style.display = 'none';
        statusDiariaDobradaInput.style.display = 'block';
        statusDiariaDobradaInput.value = eventData.statusdiariadobrada || 'Pendente';
        aplicarCorStatusInput(statusDiariaDobradaInput);

        document.getElementById('selectStatusMeiaDiaria').style.display = 'none';
        statusMeiaDiariaInput.style.display = 'block';
        statusMeiaDiariaInput.value = eventData.statusmeiadiaria || 'Pendente';
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
                row.dataset.eventData = JSON.stringify(eventData);

                row.addEventListener('dblclick', async () => {
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
                
            });

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

    viagem1Check               = document.getElementById('viagem1Check')
    viagem2Check               = document.getElementById('viagem2Check')
    viagem3Check               = document.getElementById('viagem3Check')

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

        if (statusPgtoAjudaCustoInput.value !== 'Pago') {
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

        if (statusPgtoAjudaCustoInput.value !== 'Pago50') {
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
                campoInputMinúsculo.value = sOriginal || 'Pendente';
            }

            alternarStatusPorPermissao('StatusAjusteCusto', temPermissaoMaster);

            ajusteCustoInput.value = vOriginal.toFixed(2).replace('.', ',');
            textarea.value = dOriginal;
        }
    })

    document.getElementById('selectStatusAjusteCusto')?.addEventListener('change', (e) => {
        console.log("statusAnteriorAjusteCusto no momento da troca:", statusAnteriorAjusteCusto);
        statusAnteriorAjusteCusto = document.getElementById('statusAjusteCusto').value;
        document.getElementById('statusAjusteCusto').value = e.target.value;
        calcularValorTotal();
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

            const campoInput = document.getElementById('statuscaixinha');
            if (campoInput) campoInput.value = sOriginal || 'Pendente';
        }
    })
    document.getElementById('selectStatusCaixinha')?.addEventListener('change', (e) => {
        console.log("statusAnteriorCaixinha no momento da troca:", statusAnteriorCaixinha);
        statusAnteriorCaixinha = document.getElementById('statusCaixinha').value;
        document.getElementById('statusCaixinha').value = e.target.value;
        calcularValorTotal();
    })
    
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

    // const datasEventoInput = document.getElementById('datasEvento');
    if (datasEventoInput) {
         console.log("ENTROU NO PERIODO EVENTO DO VERIFICASTAFF");
    }

    document.getElementById("selectStatusCustoFechado")?.addEventListener("change", function() {
        // Sincroniza o hidden com o select visível
        const hiddenStatus = document.getElementById("statusCustoFechado");
        if (hiddenStatus) hiddenStatus.value = this.value;
        
        // Aplica cor no select
        aplicarCorNoSelect(this);
        
        console.log("✅ statusCustoFechado (hidden) atualizado para:", this.value);
    });

    const botaoEnviarOriginal = document.getElementById("Enviar");
    if (botaoEnviarOriginal) {
        const BotaoEnviar = botaoEnviarOriginal.cloneNode(true);
        botaoEnviarOriginal.parentNode.replaceChild(BotaoEnviar, botaoEnviarOriginal);
        console.log("[botaoEnviar] Listener antigo removido para evitar salvamento duplicado.");

        BotaoEnviar.addEventListener("click", async (event) => {
            event.preventDefault();

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

            const inputStatusFechado = document.getElementById("statusCustoFechado");
            let statusFechado = inputStatusFechado ? inputStatusFechado.value : '';

            let statusAjusteCusto = document.getElementById("statusAjusteCusto")?.value?.trim() || '';
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
                            currentEditingStaffEvent = existingEventData;
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
                    datasConflitantes, idEventoPrincipal, conflitosReais[0]?.idevento
                );

                if (aditivoExistente && aditivoExistente.bloqueado) return;

                if (bLiberacaoAutorizada === false) {
                    const datasConflito = encontrarDatasConflitantes(datasParaVerificacao, conflitosReais);
                    const datasFormatadas = formatarDatas(datasConflito);

                    let msg = `O funcionário <strong>${nmFuncionario}</strong> já está agendado em <strong>${totalConflitosExistentes}</strong> atividade(s) `;
                    if (datasConflito.length > 0) msg += `na(s) data(s): <strong>${datasFormatadas}</strong>.`;

                    // CASO A: Excedeu o limite → Solicitar autorização
                    if (totalConflitosExistentes >= limiteMaximo) {
                        if (aditivoExistente?.encontrado && aditivoExistente.status === 'Autorizado') {
                            await Swal.fire({
                                title: "Autorização Existente",
                                html: `Já existe uma solicitação <strong>AUTORIZADA</strong>. O agendamento será processado.`,
                                icon: "success", confirmButtonText: "Prosseguir"
                            });
                            return;
                        }

                        msg += `<br><br>⚠️ <strong>LIMITE ATINGIDO!</strong> Máximo: ${limiteMaximo}.`;
                        conflitosReais.forEach(c => { msg += `<br> - <strong>${c.nmevento || 'N/A'}</strong> (${c.nmfuncao})`; });
                        msg += `<br><br>Deseja SOLICITAR AUTORIZAÇÃO?`;

                        const swalResult = await Swal.fire({
                            title: "Solicitar Autorização?",
                            html: `${msg}<br>
                                <label for="swal-input-justificativa">Justificativa:</label>
                                <textarea id="swal-input-justificativa" class="swal2-textarea" placeholder="Descreva o motivo..." required></textarea>`,
                            icon: "warning", showCancelButton: true,
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
                        try {
                            const { dtInicio, dtFim } = getPeriodoEvento(datasParaVerificacao);
                            const detalheConflitos = conflitosReais.map(c => {
                                const dataFormatada = c.data_conflito ? new Date(c.data_conflito).toLocaleDateString('pt-BR') : '';
                                return `[${c.nmevento || 'N/A'} - ${c.nmfuncao}${dataFormatada ? ' em ' + dataFormatada : ''}]`;
                            }).join(', ');

                            let justificativaFinal = '';
                            if (dtInicio && dtFim) justificativaFinal += `[Período Novo: ${dtInicio} a ${dtFim}] `;
                            if (detalheConflitos) justificativaFinal += `| Agendado em: ${detalheConflitos} `;
                            justificativaFinal += `- Justificativa Usuário: ${justificativa}`;

                            const result = await salvarSolicitacaoAditivoExtra(
                                idOrcamentoAtual, idFuncaoDoFormulario, 1, 'FuncExcedido',
                                justificativaFinal, idFuncionarioParaVerificacao,
                                datasConflitantes, idEventoPrincipal, conflitosReais[0]?.idevento
                            );

                            if (!result.sucesso) {
                                await Swal.fire("Erro", `Falha ao registrar: ${result.erro}`, "error");
                                return;
                            }
                        } catch (error) {
                            console.error("Erro no salvamento:", error);
                            await Swal.fire("Erro Crítico", error.message, "error");
                            return;
                        }

                        const resultDecisao = await Swal.fire({
                            title: "Solicitação Registrada!",
                            html: `A exceção está <strong>Pendente</strong>. O agendamento não foi realizado ainda.<br><br>O que deseja fazer?`,
                            icon: "info", showCancelButton: true, showDenyButton: true,
                            confirmButtonText: "Cadastrar mais um (Mesmo Evento)",
                            denyButtonText: "Novo Staff (Limpar tudo)",
                            cancelButtonText: "Finalizar e Sair"
                        });

                        if (resultDecisao.isConfirmed) {
                            (typeof limparCamposStaffParcial === "function") ? limparCamposStaffParcial() : limparCamposStaff();
                        } else if (resultDecisao.isDenied) {
                            limparCamposStaff();
                        } else if (resultDecisao.dismiss === Swal.DismissReason.cancel) {
                            window.location.reload();
                        }
                        return;

                    // CASO B: Dentro do limite → Apenas aviso
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
                    idFuncao: descFuncaoSelect.value
                };

                const resultadoFuncao = await verificarLimiteDeFuncao(criteriosDeVerificacao);
                if (!resultadoFuncao.allowed) {
                    controlarBotaoSalvarStaff(false);
                    return;
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
                statusAjusteCusto = (vlrAjusteNum > 0 || (descAjusteTxt !== '' && descAjusteTxt !== '-') || checkAjusteManual?.checked) ? 'Pendente' : '';
            }

            // Status Custo Fechado/Liberado
            if (!statusFechado || statusFechado.trim() === '') {
                statusFechado = ((fechadoCheck.checked || liberadoCheck.checked) && vlrCustoNumerico > 0) ? 'Pendente' : '';
            }
            if (!fechadoCheck.checked && !liberadoCheck.checked) statusFechado = '';

            // Se houve troca de nível, zera statusFechado e descCustoFechado no envio
            const statusFechadoParaEnvio = nivelFoiTrocado ? null : statusFechado;
            const descCustoFechadoParaEnvio = nivelFoiTrocado ? null : descCustoFechado;



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

                const houveAlteracaoAjusteCusto = (ajusteCustoAtivoOriginal !== ajusteCustoAtivo) || (ajusteCustoValorOriginal !== ajusteCustoValorAtual);
                const houveAlteracaoCaixinha = (caixinhaAtivoOriginal !== caixinhaAtivo) || (caixinhaValorOriginal !== caixinhaValorAtual);
                const houveAlteracaoDiariaDobrada = (dataDiariaDobradaOriginalLimpa.toString() !== periodoDobrado.toString());
                const houveAlteracaoMeiaDiaria = (dataMeiaDiariaOriginalLimpa.toString() !== periodoMeiaDiaria.toString());

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
                if (houveAlteracaoDiariaDobrada && diariaDobradaAtual) {
                    const descDD = document.getElementById("descDiariaDobrada").value.trim();
                    if (!descDD || descDD.length < 15) {
                        document.getElementById("descDiariaDobrada")?.focus();
                        return Swal.fire("Campo obrigatório!", "A descrição da Diária Dobrada deve ter no mínimo 15 caracteres.", "warning");
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

                const houveAlteracao =
                    logAndCheck('ID Equipe', currentEditingStaffEvent.idequipe, idEquipe, currentEditingStaffEvent.idequipe != idEquipe) ||
                    logAndCheck('Equipe', currentEditingStaffEvent.nmequipe?.toUpperCase(), nmEquipe, currentEditingStaffEvent.nmequipe?.toUpperCase() != nmEquipe) ||
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
                    logAndCheck('StatusPgto', (currentEditingStaffEvent.statuspgto || '').trim(), statusPgto.trim(), (currentEditingStaffEvent.statuspgto || '').trim() != statusPgto.trim()) ||
                    logAndCheck('StatusAjusteCusto', (currentEditingStaffEvent.statusajustecusto || '').trim(), (statusAjusteCusto || '').trim(), (currentEditingStaffEvent.statusajustecusto || '').trim() != (statusAjusteCusto || '').trim()) ||
                    logAndCheck('StatusCaixinha', (currentEditingStaffEvent.statuscaixinha || '').trim(), (statusCaixinha || '').trim(), (currentEditingStaffEvent.statuscaixinha || '').trim() != (statusCaixinha || '').trim()) ||
                    logAndCheck('StatusCustoFechado', (currentEditingStaffEvent.statuscustofechado || '').trim(), (statusFechadoParaEnvio || '').trim(), (currentEditingStaffEvent.statuscustofechado || '').trim() != (statusFechadoParaEnvio || '').trim()) ||
                    logAndCheck('ID Cliente', currentEditingStaffEvent.idcliente, idCliente, currentEditingStaffEvent.idcliente != idCliente) ||
                    logAndCheck('ID Evento', currentEditingStaffEvent.idevento, idEvento, currentEditingStaffEvent.idevento != idEvento) ||
                    logAndCheck('ID Montagem', currentEditingStaffEvent.idmontagem, idMontagem, currentEditingStaffEvent.idmontagem != idMontagem) ||
                    logAndCheck('Pavilhão', (currentEditingStaffEvent.pavilhao || '').toUpperCase().trim(), pavilhao.toUpperCase().trim(), (currentEditingStaffEvent.pavilhao || '').toUpperCase().trim() != pavilhao.toUpperCase().trim()) ||
                    logAndCheck('Comprovante Cache', normalizeEmptyValue(currentEditingStaffEvent.comppgtocache), normalizeEmptyValue(comppgtocacheDoForm), normalizeEmptyValue(currentEditingStaffEvent.comppgtocache) !== normalizeEmptyValue(comppgtocacheDoForm)) ||
                    logAndCheck('Comprovante AjdCusto', normalizeEmptyValue(currentEditingStaffEvent.comppgtoajdcusto), normalizeEmptyValue(comppgtoajdcustoDoForm), normalizeEmptyValue(currentEditingStaffEvent.comppgtoajdcusto) !== normalizeEmptyValue(comppgtoajdcustoDoForm)) ||
                    logAndCheck('Comprovante AjdCusto50', normalizeEmptyValue(currentEditingStaffEvent.comppgtoajdcusto50), normalizeEmptyValue(comppgtoajdcusto50DoForm), normalizeEmptyValue(currentEditingStaffEvent.comppgtoajdcusto50) !== normalizeEmptyValue(comppgtoajdcusto50DoForm)) ||
                    logAndCheck('Comprovante Caixinha', normalizeEmptyValue(currentEditingStaffEvent.comppgtocaixinha), normalizeEmptyValue(comppgtocaixinhaDoForm), normalizeEmptyValue(currentEditingStaffEvent.comppgtocaixinha) !== normalizeEmptyValue(comppgtocaixinhaDoForm)) ||
                    logAndCheck('Datas Diária Dobrada', JSON.stringify(dataDiariaDobradaOriginalLimpa), JSON.stringify(periodoDobrado), JSON.stringify(dataDiariaDobradaOriginalLimpa) !== JSON.stringify(periodoDobrado)) ||
                    logAndCheck('Datas Meia Diária', JSON.stringify(dataMeiaDiariaOriginalLimpa), JSON.stringify(periodoMeiaDiaria), JSON.stringify(dataMeiaDiariaOriginalLimpa) !== JSON.stringify(periodoMeiaDiaria)) ||
                    logAndCheck('Status Diária Dobrada', (currentEditingStaffEvent.statusdiariadobrada || '').trim(), (statusDiariaDobrada || '').trim(), (currentEditingStaffEvent.statusdiariadobrada || '').trim() != (statusDiariaDobrada || '').trim()) ||
                    logAndCheck('Status Meia Diária', (currentEditingStaffEvent.statusmeiadiaria || '').trim(), (statusMeiaDiaria || '').trim(), (currentEditingStaffEvent.statusmeiadiaria || '').trim() != (statusMeiaDiaria || '').trim()) ||
                    logAndCheck('Nível Experiência', (currentEditingStaffEvent.nivelexperiencia || '').trim(), nivelExperienciaAtual.trim(), (currentEditingStaffEvent.nivelexperiencia || '').trim() != nivelExperienciaAtual.trim()) ||
                    logAndCheck('Qtd Pessoas', currentEditingStaffEvent.qtdpessoas || 0, qtdPessoasAtual || 0, (currentEditingStaffEvent.qtdpessoas || 0) != (qtdPessoasAtual || 0)) ||
                    nivelFoiTrocado; // ← Se houve troca de nível, força alteração

                if (!houveAlteracao) {
                    return Swal.fire("Nenhuma alteração detectada", "Faça alguma alteração antes de salvar.", "info");
                }

                const { isConfirmed } = await Swal.fire({
                    title: "Deseja salvar as alterações?",
                    text: "Você está prestes a atualizar os dados do staff.",
                    icon: "question", showCancelButton: true,
                    confirmButtonText: "Sim, salvar", cancelButtonText: "Cancelar",
                    reverseButtons: true, focusCancel: true
                });
                if (!isConfirmed) return;
            }          
           
            

            // =========================================================
            // 14. DIÁRIA DOBRADA E MEIA DIÁRIA
            // =========================================================
            if (diariaDobrada && (statusDiariaDobrada === "Autorização de Diária Dobrada" || statusDiariaDobrada === '')) statusDiariaDobrada = "Pendente";
            else if (!diariaDobrada) statusDiariaDobrada = '';

            if (meiaDiaria && (statusMeiaDiaria === "Autorização de Meia Diária" || statusMeiaDiaria === '')) statusMeiaDiaria = "Pendente";
            else if (!meiaDiaria) statusMeiaDiaria = '';

            let dadosDiariaDobrada = [];
            if (periodoDobrado?.length > 0) {
                dadosDiariaDobrada = periodoDobrado.map(data => {
                    const statusData = datasDobrada.find(item => item.data === data);
                    return { data, status: statusData ? statusData.status : statusDiariaDobrada };
                });
            }

            let dadosMeiaDiaria = [];
            if (periodoMeiaDiaria?.length > 0) {
                dadosMeiaDiaria = periodoMeiaDiaria.map(data => {
                    const statusData = datasMeiaDiaria.find(item => item.data === data);
                    return { data, status: statusData ? statusData.status : statusMeiaDiaria };
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
            
            formData.append('datadiariadobrada', JSON.stringify(dadosDiariaDobrada));
            formData.append('descdiariadobrada', descDiariaDobradaTextarea.value.trim());
            formData.append('statusdiariadobrada', statusDiariaDobrada);

            formData.append('descmeiadiaria', descMeiaDiariaTextarea.value.trim());
            formData.append('datameiadiaria', JSON.stringify(dadosMeiaDiaria));
            formData.append('statusmeiadiaria', statusMeiaDiaria);

            // Comprovantes
            if (fileCacheInput.files?.[0]) formData.append('comppgtocache', fileCacheInput.files[0]);
            else if (hiddenRemoverCacheInput.value === 'true') formData.append('limparComprovanteCache', 'true');

            if (fileAjdCustoInput.files?.[0]) formData.append('comppgtoajdcusto', fileAjdCustoInput.files[0]);
            else if (hiddenRemoverAjdCustoInput.value === 'true') formData.append('limparComprovanteAjdCusto', 'true');

            if (fileAjdCusto2Input.files?.[0]) formData.append('comppgtoajdcusto50', fileAjdCusto2Input.files[0]);
            else if (hiddenRemoverAjdCusto2Input.value === 'true') formData.append('limparComprovanteAjdCusto2', 'true');

            if (fileCaixinhaInput.files?.[0]) formData.append('comppgtocaixinha', fileCaixinhaInput.files[0]);
            else if (hiddenRemoverCaixinhaInput.value === 'true') formData.append('limparComprovanteCaixinha', 'true');

            // =========================================================
            // 16. ENVIO DA REQUISIÇÃO
            // =========================================================
            try {
                console.log("Preparando envio. Método:", metodo, "URL:", url);
                for (let pair of formData.entries()) console.log(pair[0] + ': ' + pair[1]);

                const respostaApi = await fetchComToken(url, { method: metodo, body: formData });

                // Reseta flag de troca de nível após salvar com sucesso
                nivelFoiTrocado = false;
                nivelOriginalCarregado = null;

                await Swal.fire("Sucesso!", respostaApi.message || "Staff salvo com sucesso.", "success");
                await carregarTabelaStaff(idFuncionario);
                window.StaffOriginal = null;

                const result = await Swal.fire({
                    title: "Deseja continuar?",
                    text: "O cadastro foi concluído. Quer cadastrar mais um ou finalizar?",
                    icon: "question", showCancelButton: true, showDenyButton: true,
                    confirmButtonText: "Cadastrar mais um (Manter dados)",
                    cancelButtonText: "Finalizar e Sair",
                    denyButtonText: "Cadastrar novo staff (Limpar tudo)",
                    reverseButtons: true, focusCancel: true
                });

                if (result.isConfirmed) {
                    (typeof limparCamposStaffParcial === "function") ? limparCamposStaffParcial() : limparCamposStaff();
                } else if (result.isDenied) {
                    limparCamposStaff();
                } else if (result.dismiss === Swal.DismissReason.cancel) {
                    console.log("Usuário escolheu: Finalizar e Sair");

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

            } catch (error) {
                console.error("❌ Erro ao enviar dados do funcionário:", error);
                
                const botaoEnviar = document.getElementById("botaoEnviar");
                if (botaoEnviar) {
                    botaoEnviar.disabled = false;
                    botaoEnviar.textContent = 'Salvar'; 
                }

                // Tenta parsear o JSON que vem dentro do error.message
                let titulo = "Erro ao salvar funcionário";
                let htmlErro = `<p>${error.message || "Erro desconhecido."}</p>`;

                try {
                    const jsonMatch = error.message?.match(/\{.*\}/s);
                    if (jsonMatch) {
                        const dados = JSON.parse(jsonMatch[0]);

                        if (dados.tipoErro === "LIMITE_EXCEDIDO") {
                            titulo = dados.title;
                            htmlErro = `
                                <p>O limite de <strong>${dados.tipo}</strong> para essa função foi atingido.</p>
                                <br>
                                <table style="margin: 0 auto; text-align: center; border-collapse: collapse; width: 80%">
                                    <tr style="background: #f0f0f0;">
                                        <th style="padding: 8px 20px;">Limite</th>
                                        <th style="padding: 8px 20px;">Tentou</th>
                                        <th style="padding: 8px 20px;">Usado</th>
                                        <th style="padding: 8px 20px;">Saldo</th>
                                    </tr>
                                    <tr>
                                        <td style="padding: 8px 20px;">${dados.limite}</td>
                                        <td style="padding: 8px 20px;">${dados.tentativa}</td>
                                        <td style="padding: 8px 20px;">${dados.usado}</td>
                                        <td style="padding: 8px 20px; color: ${dados.saldo <= 0 ? '#d63030' : '#28a745'}; font-weight: bold;">${dados.saldo}</td>
                                    </tr>
                                </table>
                            `;
                        }
                    }
                } catch (_) { /* mantém o htmlErro padrão */ }

                Swal.fire({
                    title: titulo,
                    html: htmlErro,
                    icon: "error",
                    confirmButtonText: "Entendi"
                });
            }
        });
    }
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
    console.log("🔍 Validando critérios para API:", { idEvento, idCliente, idLocalMontagem, idFuncao, totalDatas: periodoDoEvento.length });

    // A API exige os 4 IDs. Se o idCliente estiver vazio, não disparar para evitar Erro 400.
   // No seu Staff.js, dentro do debouncedOnCriteriosChanged:

if (idEvento && idCliente && idFuncao && periodoDoEvento.length > 0) { 
    console.log("🟢 Todos os campos preenchidos. Buscando...");
    buscarEPopularOrcamento(idEvento, idCliente, idLocalMontagem, idFuncao, periodoDoEvento);
} else {
    // Se o cliente é o que falta, damos um aviso mais amigável
    if (!idCliente && idEvento && idFuncao) {
        console.warn("⚠️ Aguardando a seleção do Cliente para buscar o orçamento.");
    }
}
}, 500);

// async function buscarEPopularOrcamento(idEvento, idCliente, idLocalMontagem, idFuncao, datasEvento) {
//     try {
//         console.log("🚀 Iniciando busca de orçamento...", { idEvento, idCliente, idLocalMontagem, idFuncao });

//         decisaoUsuarioDataFora = null; 

//         const idFuncionario = document.getElementById('idFuncionario').value;
//         const selectFunc = document.getElementById('nmFuncionario');
//         const nmFuncionario = selectFunc.options[selectFunc.selectedIndex]?.text || "Funcionário não identificado";

//         const criteriosDeBusca = {
//             idEvento,
//             idCliente,
//             idLocalMontagem,
//             idFuncao,
//             datasEvento: datasEvento || []
//         };

//         const dadosDoOrcamento = await fetchComToken('/staff/orcamento/consultar', {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify(criteriosDeBusca)
//         });

//         orcamentoPorFuncao = {}; 
        
//         if (!Array.isArray(dadosDoOrcamento) || dadosDoOrcamento.length === 0) {
//             temOrcamento = false;
//             controlarBotaoSalvarStaff(false); 
//             Swal.fire({ icon: 'info', title: 'Orçamento não encontrado', text: 'Não existem itens de orçamento para os critérios selecionados.' });
//             return;
//         }

//         // --- 1. CONFIGURAÇÕES BÁSICAS ---
//         statusOrcamentoAtual = dadosDoOrcamento[0].status;
//         idOrcamentoAtual = dadosDoOrcamento[0].idorcamento;
//         const liberadoCadastro = dadosDoOrcamento[0].contratarstaff;

//         if (statusOrcamentoAtual === 'A' || (statusOrcamentoAtual === 'P' && !liberadoCadastro)) {
//             Swal.fire({ icon: 'warning', title: 'Contratação bloqueada', text: 'Este orçamento não possui liberação para cadastro de staff no momento.' });
//             controlarBotaoSalvarStaff(false);
//             return;
//         }

//         //// --- 2. TRATAMENTO DO CAMPO SETOR (PAVILHÃO) ---
//         // const elSetor = document.getElementById('setor'); 
//         // if (elSetor) {
//         //     let setorEncontrado = dadosDoOrcamento[0].setor; 

//         //     // Tenta extrair do nome da função se o campo setor vier vazio do orçamento
//         //     if (!setorEncontrado && dadosDoOrcamento[0].descfuncao?.includes('(')) {
//         //         const match = dadosDoOrcamento[0].descfuncao.match(/\(([^)]+)\)/);
//         //         if (match) setorEncontrado = match[1];
//         //     }

//         //     // Prioridade final para o que já está salvo no banco (edição)
//         //     if (!setorEncontrado && window.__modalFetchedData?.setor) {
//         //         setorEncontrado = window.__modalFetchedData.setor;
//         //     }

//         //     if (setorEncontrado) {
//         //         console.log(`🔍 Aplicando setor(es): ${setorEncontrado}`);
//         //         const alvos = String(setorEncontrado).split(',').map(s => s.trim().toUpperCase());

//         //         Array.from(elSetor.options).forEach(opt => {
//         //             if (alvos.some(a => opt.text.toUpperCase().includes(a))) {
//         //                 opt.selected = true;
//         //             }
//         //         });
                
//         //         // Estilização de "Travado" para o Select
//         //         elSetor.style.backgroundColor = "#e9ecef";
//         //         elSetor.style.pointerEvents = "none"; // Impede alteração manual se vier do orçamento
//         //     }
//         // }


        

//         // // --- 3. VALIDAÇÃO DE DATAS ---
//         // const descFuncaoSelect = document.getElementById('descFuncao');
//         // const funcaoTexto = descFuncaoSelect?.options[descFuncaoSelect.selectedIndex]?.text || "";
//         // const datasPermitidas = new Set();

//         // dadosDoOrcamento.forEach(item => {
//         //     if (item.descfuncao === funcaoTexto && item.datas_totais_orcadas) {
//         //         item.datas_totais_orcadas.forEach(d => datasPermitidas.add(d.split('T')[0]));
//         //     }
//         // });

//         // const datasNaoOrcadas = datasEvento.filter(d => !datasPermitidas.has(d));

       
//         // --- 2. RESET E TRATAMENTO DO CAMPO SETOR/PAVILHÃO ---
//         const elSelectPavilhao = document.getElementById('nmPavilhao');
//         const elInputSetor = document.getElementById('setor');

//         if (elSelectPavilhao && elInputSetor) {
//             // 🧹 RESET TOTAL INICIAL: Limpa tudo antes de decidir o que fazer
//             const setorNaTela = elInputSetor.value.trim().toUpperCase();

//             // 2. Procura no array de retorno a linha que dá "match" com o setor da tela
//             // Se não houver nada na tela, ele tenta pegar a linha onde o setor é vazio/null
//             let orcamentoBase = dadosDoOrcamento.find(item => 
//                 (item.setor?.trim().toUpperCase() === setorNaTela)
//             ) || dadosDoOrcamento.find(item => !item.setor) || dadosDoOrcamento[0];

//             console.log("🎯 Linha de orçamento selecionada:", orcamentoBase);

//             let setorEncontrado = orcamentoBase.setor;

//             // Obtém o nome exato da função que o usuário selecionou no SELECT da tela
//             const descFuncaoSelect = document.getElementById('descFuncao');
//             const funcaoSelecionadaTexto = descFuncaoSelect?.options[descFuncaoSelect.selectedIndex]?.text || "";

//             // 🛡️ CORREÇÃO CRÍTICA: Só tenta extrair do parênteses se a função do orçamento for EXATAMENTE a selecionada
//             if (!setorEncontrado && orcamentoBase.descfuncao === funcaoSelecionadaTexto && orcamentoBase.descfuncao?.includes('(')) {
//                 const match = orcamentoBase.descfuncao.match(/\(([^)]+)\)/);
//                 const termoExtraido = match ? match[1].trim().toUpperCase() : "";
                
//                 // Lista negra: Se o que estiver no parênteses for um desses termos, ignora (não é pavilhão)
//                 const termosIgnorar = ["MONO", "BILINGUE", "TRILINGUE", "COORD", "COLETOR DE DADOS"];
//                 if (termoExtraido && !termosIgnorar.includes(termoExtraido)) {
//                     setorEncontrado = termoExtraido;
//                 }
//             }

//             // 🛑 APLICAÇÃO FINAL
//             if (setorEncontrado && setorEncontrado !== "null" && setorEncontrado !== "") {
//                 const nomeUpper = String(setorEncontrado).trim().toUpperCase();
//                 console.log(`✅ Setor oficial encontrado: ${nomeUpper}`);

//                 elSelectPavilhao.innerHTML = `<option value="${nomeUpper}" selected>${nomeUpper}</option>`;
//                 elInputSetor.value = nomeUpper;
//                 elInputSetor.readOnly = true;
//                 [elSelectPavilhao, elInputSetor].forEach(el => {
//                     el.style.backgroundColor = "#e9ecef";
//                     el.style.pointerEvents = "none";
//                 });
//                 if (container) container.classList.add('active', 'is-filled');
//                 if (typeof $ !== 'undefined' && $(elSelectPavilhao).data('select2')) $(elSelectPavilhao).trigger('change');
//             } else {
//                 console.log("🔓 Nenhum setor vinculado. Campo liberado.");
//             }
//         }

//         // --- 3. VALIDAÇÃO DE DATAS ---
//         const descFuncaoSelect = document.getElementById('descFuncao');
//         const funcaoTexto = descFuncaoSelect?.options[descFuncaoSelect.selectedIndex]?.text || "";
//         const datasPermitidas = new Set();

//         if (Array.isArray(dadosDoOrcamento)) {
//             dadosDoOrcamento.forEach(item => {
//                 if (item && item.descfuncao === funcaoTexto && Array.isArray(item.datas_totais_orcadas)) {
//                     item.datas_totais_orcadas.forEach(d => {
//                         if (d) datasPermitidas.add(d.split('T')[0]);
//                     });
//                 }
//             });
//         }

//         const listaDatasEvento = Array.isArray(datasEvento) ? datasEvento : [];
//         const datasNaoOrcadas = listaDatasEvento.filter(d => !datasPermitidas.has(d));        

//         if (datasNaoOrcadas.length > 0) {
//             const result = await Swal.fire({
//                 icon: 'question',
//                 title: 'Datas fora do orçamento',
//                 text: 'Existem datas selecionadas que não constam no orçamento original.',
//                 showCancelButton: true,
//                 showDenyButton: true,
//                 confirmButtonText: 'Solicitar Aditivo',
//                 denyButtonText: 'Extra Bonificado',
//                 cancelButtonText: 'Cancelar'
//             });

//             if (result.isConfirmed || result.isDenied) {

//                 if (window.datasEventoPicker) {
//                     const datasApenasOrcadas = listaDatasEvento.filter(d => datasPermitidas.has(d));
//                     window.datasEventoPicker.setDate(datasApenasOrcadas); 
//                     console.log("🧹 Flatpickr limpo. Mantidas apenas datas orçadas:", datasApenasOrcadas);
//                 }

//                 const motivo = " - Data fora do Orçamento";
//                 //const tipo = result.isConfirmed ? 'Aditivo' : 'Extra Bonificado';
//                 const tipo = result.isConfirmed ? `Aditivo${motivo}` : `Extra Bonificado${motivo}`;

//                 console.log(`🔍 Verificando existência de ${tipo} pendente para o orçamento...`, idOrcamentoAtual, idFuncao, tipo, idFuncionario, nmFuncionario, nmFuncaoDoFormulario);

//                 // const verificacao = await verificarStatusAditivoExtra(
//                 //     idOrcamentoAtual, 
//                 //     idFuncao,                     
//                 //     //tipo, 
//                 //     'QUALQUER_DATA',
//                 //     idFuncionario, 
//                 //     nmFuncionario,
//                 //     funcaoTexto,
//                 //     datasNaoOrcadas // certifique-se que nmFuncionario está acessível aqui
//                 // );

//                 // // 2. Se retornar bloqueado, para o processo aqui mesmo e não abre o próximo Swal
//                 // if (verificacao && verificacao.bloqueado) {
//                 //     console.warn(`🛑 Bloqueado: Já existe um ${tipo} pendente.`);
//                 //     return; // Encerra a função buscarEPopularOrcamento
//                 // }
//                 // const resultadoExcecao = await solicitarDadosExcecao(tipo, idOrcamentoAtual, funcaoTexto, idFuncao, idFuncionario, datasNaoOrcadas);

//                 const checkData = await verificarStatusAditivoExtra(
//                     idOrcamentoAtual, 
//                     idFuncao, 
//                     'QUALQUER_DATA', // 🚀 Filtro mestre para Aditivo/Extra de DATA
//                     idFuncionario, 
//                     nmFuncionario,
//                     funcaoTexto,
//                     datasNaoOrcadas 
//                 );

//                 // 1. Se já estiver autorizado para estas datas, libera o processo
//                 if (checkData && checkData.autorizado) {
//                     console.log("✅ Datas já autorizadas previamente para este funcionário.");
//                     temOrcamento = true;
//                     controlarBotaoSalvarStaff(true);
//                     return; 
//                 }

//                 // 2. Se retornar bloqueado (pendente ou rejeitado), encerra aqui
//                 // O 'verificarStatusAditivoExtra' já terá exibido o Swal de aviso
//                 if (checkData && checkData.bloqueado) {
//                     console.warn(`🛑 Processo interrompido: Existe solicitação de data pendente/rejeitada.`);
//                     cancelarProcessoOrcamento();
//                     return; 
//                 }

//                 const resultadoExcecao = await solicitarDadosExcecao(
//                     tipo, 
//                     idOrcamentoAtual, 
//                     funcaoTexto, 
//                     idFuncao, 
//                     idFuncionario, 
//                     datasNaoOrcadas
//                 );
                
//                 // if (resultadoExcecao && resultadoExcecao.sucesso) {
//                 //     decisaoUsuarioDataFora = result.isConfirmed ? 'ADITIVO' : 'EXTRA';
//                 //     temOrcamento = true;
//                 //     controlarBotaoSalvarStaff(true);

//                 if (resultadoExcecao && resultadoExcecao.sucesso) {
//                     if (tipo.includes("Data fora do Orçamento")) {
//                         // Garante que o input de datas só tenha o que é permitido antes de liberar o botão salvar
//                         const datasApenasOrcadas = listaDatasEvento.filter(d => datasPermitidas.has(d));
//                         window.datasEventoPicker.setDate(datasApenasOrcadas);
//                     }
//                     decisaoUsuarioDataFora = result.isConfirmed ? 'ADITIVO' : 'EXTRA';
//                     temOrcamento = true;
//                     controlarBotaoSalvarStaff(true);

//                 } else {
//                     cancelarProcessoOrcamento();
//                     return;
//                 }
//             } else {
//                 cancelarProcessoOrcamento();
//                 return;
//             }
//         } else {
//             temOrcamento = true;
//             controlarBotaoSalvarStaff(true);
//         }

//         console.log("✅ Orçamento carregado com sucesso:", dadosDoOrcamento, temOrcamento);

//         // --- 4. ATUALIZAÇÃO GLOBAL ---
//         dadosDoOrcamento.forEach(item => {
//             const chave = `${item.nmevento}-${item.nmcliente}-${item.nmlocalmontagem}-${item.descfuncao}`;
//             if (!orcamentoPorFuncao[chave]) {
//                 orcamentoPorFuncao[chave] = {
//                     quantidadeOrcada: Number(item.quantidade_orcada), 
//                     quantidadeEscalada: Number(item.quantidade_escalada),
//                     idOrcamento: item.idorcamento,
//                     idFuncao: item.idfuncao
//                 };
//             }
//         });

//     } catch (error) {
//         console.error("❌ Erro em buscarEPopularOrcamento:", error);
//         controlarBotaoSalvarStaff(false);
//     }

//     function cancelarProcessoOrcamento() {
//         temOrcamento = false;
//         controlarBotaoSalvarStaff(false);
//         if (window.datasEventoPicker) window.datasEventoPicker.clear();
//         decisaoUsuarioDataFora = null;
//     }
// }

async function buscarEPopularOrcamento(idEvento, idCliente, idLocalMontagem, idFuncao, datasEvento) {
    try {
        console.log("🚀 Iniciando busca de orçamento...", { idEvento, idCliente, idLocalMontagem, idFuncao });

        decisaoUsuarioDataFora = null; 
        let orcamentoBase = null; // 🎯 DECLARAÇÃO NO TOPO (Escopo amplo)

        const idFuncionario = document.getElementById('idFuncionario').value;
        const selectFunc = document.getElementById('nmFuncionario');
        const nmFuncionario = selectFunc.options[selectFunc.selectedIndex]?.text || "Funcionário não identificado";
        const elInputSetor = document.getElementById('setor');
        const setorAtual = elInputSetor ? elInputSetor.value.trim() : null;

        const criteriosDeBusca = {
            idEvento,
            idCliente,
            idLocalMontagem,
            idFuncao,
            setor: setorAtual, // Enviando o setor para o backend fixado
            datasEvento: datasEvento || []
        };

        const dadosDoOrcamento = await fetchComToken('/staff/orcamento/consultar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(criteriosDeBusca)
        });

        if (!Array.isArray(dadosDoOrcamento) || dadosDoOrcamento.length === 0) {
            temOrcamento = false;
            controlarBotaoSalvarStaff(false); 
            Swal.fire({ icon: 'info', title: 'Orçamento não encontrado', text: 'Não existem itens de orçamento para os critérios selecionados.' });
            return;
        }

        // --- 1. DEFINIÇÃO DA LINHA BASE ---
        // Tenta achar a linha que bate com o setor da tela, senão pega a primeira
        orcamentoBase = dadosDoOrcamento.find(item => 
            setorAtual && item.setor?.trim().toUpperCase() === setorAtual.toUpperCase()
        ) || dadosDoOrcamento.find(item => !item.setor) || dadosDoOrcamento[0];

        idOrcamentoAtual = orcamentoBase.idorcamento;
        const statusOrcamentoAtual = orcamentoBase.status;
        const liberadoCadastro = orcamentoBase.contratarstaff;

        if (statusOrcamentoAtual === 'A' || (statusOrcamentoAtual === 'P' && !liberadoCadastro)) {
            Swal.fire({ icon: 'warning', title: 'Contratação bloqueada', text: 'Este orçamento não possui liberação para cadastro de staff.' });
            controlarBotaoSalvarStaff(false);
            return;
        }

        // --- 2. TRATAMENTO VISUAL DO SETOR ---
        const elSelectPavilhao = document.getElementById('nmPavilhao');
        if (elSelectPavilhao && elInputSetor) {
            let setorEncontrado = orcamentoBase.setor;

            if (setorEncontrado && setorEncontrado !== "null" && setorEncontrado !== "") {
                const nomeUpper = String(setorEncontrado).trim().toUpperCase();
                elSelectPavilhao.innerHTML = `<option value="${nomeUpper}" selected>${nomeUpper}</option>`;
                elInputSetor.value = nomeUpper;
                elInputSetor.readOnly = true;
                [elSelectPavilhao, elInputSetor].forEach(el => {
                    el.style.backgroundColor = "#e9ecef";
                    el.style.pointerEvents = "none";
                });
            } else {
                // Se for nulo no banco, libera para preenchimento manual
                elInputSetor.readOnly = false;
                [elSelectPavilhao, elInputSetor].forEach(el => {
                    el.style.backgroundColor = "#ffffff";
                    el.style.pointerEvents = "auto";
                });
            }
        }

        // --- 3. VALIDAÇÃO DE DATAS (AGORA RECONHECE O orcamentoBase) ---
        const descFuncaoSelect = document.getElementById('descFuncao');
        const funcaoTexto = descFuncaoSelect?.options[descFuncaoSelect.selectedIndex]?.text || "";

        // const datasPermitidas = new Set();
        // if (orcamentoBase && Array.isArray(orcamentoBase.datas_totais_orcadas)) {
        //     orcamentoBase.datas_totais_orcadas.forEach(d => {
        //         if (d) datasPermitidas.add(d.split('T')[0]);
        //     });
        // }

        const datasPermitidas = new Set();
        dadosDoOrcamento.forEach(item =>{
            if (Array.isArray(orcamentoBase.datas_totais_orcadas)) {
            item.datas_totais_orcadas.forEach(d => {
                if (d) datasPermitidas.add(d.split('T')[0]);
            });
        }
    })
        

        const listaDatasEvento = Array.isArray(datasEvento) ? datasEvento : [];
        const datasNaoOrcadas = listaDatasEvento.filter(d => !datasPermitidas.has(d));        

        if (datasNaoOrcadas.length > 0) {
            // 🇧🇷 Formata as datas para exibição no Swal (DD/MM/YYYY)
            const datasFormatadasBR = datasNaoOrcadas.map(dataIso => {
                const [ano, mes, dia] = dataIso.split('-');
                return `${dia}/${mes}/${ano}`;
            }).join(', ');

            console.log("🚨 Datas fora formatadas:", datasFormatadasBR);

            // 🎯 DEFINIÇÃO DOS TIPOS PADRONIZADOS PARA VERIFICAÇÃO INICIAL
            const tiposParaVerificar = [
                "ADITIVO - DATA FORA DO ORÇAMENTO",
                "EXTRA BONIFICADO - DATA FORA DO ORÇAMENTO"
            ];

            // 🚀 Agora verificamos pelos TIPOS REAIS em vez de 'QUALQUER_DATA'
            const checkData = await verificarStatusAditivoExtra(
                idOrcamentoAtual, 
                idFuncao, 
                tiposParaVerificar.join(','), 
                idFuncionario, 
                nmFuncionario,
                funcaoTexto,
                datasNaoOrcadas[0] ?? null
            );

            // 1. Se já estiver autorizado, libera o processo
            if (checkData && checkData.autorizado) {
                console.log("✅ Solicitação já autorizada previamente para este motivo.");
                temOrcamento = true;
                controlarBotaoSalvarStaff(true);
                return; 
            }

            // 2. Se retornar bloqueado (pendente ou rejeitado), encerra aqui
            if (checkData && checkData.bloqueado) {
                console.warn(`🛑 Processo interrompido: Existe solicitação de data pendente/rejeitada.`);
                controlarBotaoSalvarStaff(false);
                return; 
            }

            // 3. Se não houver solicitação, abre o Swal para escolha
            const result = await Swal.fire({
                icon: 'question',
                title: 'Datas fora do orçamento',
                html: `As datas <b>${datasFormatadasBR}</b> não constam no orçamento original para este setor.<br><br>Como deseja prosseguir?`,
                showCancelButton: true,
                showDenyButton: true,
                confirmButtonText: 'Solicitar Aditivo',
                denyButtonText: 'Extra Bonificado',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#3085d6',
                denyButtonColor: '#d33',
            });

            if (result.isConfirmed || result.isDenied) {
                // Limpeza visual do seletor de datas
                if (window.datasEventoPicker) {
                    const datasApenasOrcadas = listaDatasEvento.filter(d => datasPermitidas.has(d));
                    window.datasEventoPicker.setDate(datasApenasOrcadas); 
                }

                // 🎯 MONTAGEM DO TIPO CONFORME PADRÃO (CAIXA ALTA)
                const motivoExcecao = " - DATA FORA DO ORÇAMENTO";
                const tipoFinal = result.isConfirmed ? `ADITIVO${motivoExcecao}` : `EXTRA BONIFICADO${motivoExcecao}`;

                console.log(`🔍 Solicitando: ${tipoFinal}`);

                const resultadoExcecao = await solicitarDadosExcecao(
                    tipoFinal, 
                    idOrcamentoAtual, 
                    funcaoTexto, 
                    idFuncao, 
                    idFuncionario, 
                    datasNaoOrcadas
                );              

                if (resultadoExcecao && resultadoExcecao.sucesso) {
                    decisaoUsuarioDataFora = result.isConfirmed ? 'ADITIVO' : 'EXTRA';
                    temOrcamento = true;
                    controlarBotaoSalvarStaff(true);
                } else {
                    temOrcamento = false;
                    controlarBotaoSalvarStaff(false);
                    return;
                }

            } else {
                temOrcamento = false;
                controlarBotaoSalvarStaff(false);
                return;
            }
        } else {
            // Tudo dentro do orçamento
            temOrcamento = true;
            controlarBotaoSalvarStaff(true);
        }

    } catch (error) {
        console.error("❌ Erro em buscarEPopularOrcamento:", error);
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
function formatarDatas(datas) {
    if (!datas || datas.length === 0) return '';
    return datas.map(d => {
        const parts = d.split('-');
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
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
                if (isFormLoadedFromDoubleClick) {
                    console.log("💾 Edição detectada: Preservando valores históricos do banco.");
                    
                    // Resetamos a flag para que, SE o usuário mudar a função MANUALMENTE 
                    // após abrir o formulário, aí sim o sistema passe a buscar os preços novos.
                    isFormLoadedFromDoubleClick = false; 
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

                select.appendChild(option);
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


                document.getElementById("apelidoFuncionario").value = selectedOption.getAttribute("data-apelido");
                document.getElementById("idFuncionario").value = selectedOption.getAttribute("data-idfuncionario");
                document.getElementById("perfilFuncionario").value = selectedOption.getAttribute("data-perfil");

                const perfilSelecionado = selectedOption.getAttribute("data-perfil");
                const labelFuncionario = document.getElementById("labelFuncionario");
                const qtdPessoasDiv = document.querySelector('label[for="lote"]').closest('.field');
                console.log("Perfil selecionado:", perfilSelecionado);

                // Se não for freelancer, mostra label em verde
                // if (perfilSelecionado) {
                //     labelFuncionario.style.display = "block"; // sempre visível                    
                    
                //     if (perfilSelecionado.toLowerCase() === "freelancer") {
                //         isLote = false;
                //         labelFuncionario.textContent = "FREE-LANCER";
                //         labelFuncionario.style.color = "red";
                //     } if ((perfilSelecionado.toLowerCase() === "interno") || (perfilSelecionado.toLowerCase() === "externo")) {
                //         isLote = false;
                //         labelFuncionario.textContent = "FUNCIONÁRIO";
                //         labelFuncionario.style.color = "green"
                //         descBeneficioTextarea.value = "Cachê é pago se escala cair em Fim de Semana ou Feriado";

                //             // 1. Marca/Trava o "Base"
                //         if (baseCheck) baseCheck.checked = true;
                //         if (seniorCheck) seniorCheck.disabled = true;
                //         if (plenoCheck) plenoCheck.disabled = true;
                //         if (juniorCheck) juniorCheck.disabled = true;
                //         if (baseCheck) baseCheck.disabled = false;
                //         if (fechadoCheck) fechadoCheck.disabled = false; 
                //         if (liberadoCheck) liberadoCheck.disabled = false;  

                //         // // 2. Preenche os custos com o vlrFuncionario
                //         // // 🟢 CORREÇÃO CRÍTICA: Usando o nome de variável CONSISTENTE (vlrFuncionario)
                //         // document.getElementById("vlrCusto").value = (parseFloat(vlrFuncionario) || 0).toFixed(2).replace('.', ',');
                //         // document.getElementById("alimentacao").value = (parseFloat(vlrAlimentacaoFuncao) || 0).toFixed(2).replace('.', ','); 
                //         // document.getElementById("transporte").value = (parseFloat(vlrTransporteFuncao) || 0).toFixed(2).replace('.', ',');

                //         // CORREÇÃO: Relê vlrFuncionario direto do select de função no momento atual
                //         const selectFuncao = document.querySelector(".descFuncao");
                //         const optionFuncaoAtual = selectFuncao?.options[selectFuncao.selectedIndex];
                //         const vlrFuncionarioAtual = parseFloat(optionFuncaoAtual?.getAttribute("data-vlrfuncionario") || 0);

                //         // ANTES: document.getElementById("vlrCusto").value = (parseFloat(vlrFuncionario) || 0)...
                //         document.getElementById("vlrCusto").value = vlrFuncionarioAtual.toFixed(2).replace('.', ',');
                //         document.getElementById("alimentacao").value = (parseFloat(vlrAlimentacaoFuncao) || 0).toFixed(2).replace('.', ','); 
                //         document.getElementById("transporte").value = (parseFloat(vlrTransporteFuncao) || 0).toFixed(2).replace('.', ',');
                        
                //         if (typeof calcularValorTotal === 'function') {
                //             calcularValorTotal();
                //         }


                //     }else if (perfilSelecionado.toLowerCase() === "lote") {
                //         isLote = true;
                //         labelFuncionario.textContent = "LOTE";
                //         labelFuncionario.style.color = "blue";                    
                //     }
                    

                // } else {
                //     labelFuncionario.style.display = "none"; // se não tiver perfil
                // }

                // if (perfilSelecionado && perfilSelecionado.toLowerCase() === 'lote') {
                //     qtdPessoasDiv.style.display = 'block';
                // } else {
                //     qtdPessoasDiv.style.display = 'none';
                //     // Limpa o valor do input quando ele é escondido
                //     document.getElementById('qtdPessoas').value = '';
                // }

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
                        descBeneficioTextarea.value = "Cachê é pago se escala cair em Fim de Semana ou Feriado";

                        if (baseCheck) baseCheck.checked = true;
                        if (seniorCheck) seniorCheck.disabled = true;
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

                        document.getElementById("vlrCusto").value = vlrFuncionarioAtual.toFixed(2).replace('.', ',');
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

            });

        });
    }catch(error){
    console.error("Erro ao carregar funcao:", error);
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
                   if (selectedOption.getAttribute("data-ufmontagem") !== "SP") {
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

// function limparCamposEvento() {
//     console.log("Limpeza parcial do formulário iniciada (apenas campos do evento).");
//     bLiberacaoAutorizada = false; // Reset da variável de controle de liberação

//     const btn = document.getElementById('Enviar');
//     if (btn) {
//         btn.style.display = 'block'; // Ou 'block', dependendo do seu fluxo
//         btn.disabled = false;
//     }

//     // Lista de campos que se referem a um evento específico
//     const camposEvento = [
//         "idStaff", "descFuncao", "vlrCusto", "ajusteCusto", "transporte", "alimentacao", "caixinha",
//         "nmLocalMontagem", "nmPavilhao", "descBeneficio", "descAjusteCusto", "nmCliente", "nmEvento", "vlrTotal",
//         "vlrTotalHidden", "idFuncao", "idMontagem", "idPavilhao", "idCliente", "idEvento", "statusPgto",
//         "statusAjusteCusto", "statusCaixinha", "statusDiariaDobrada", "descDiariaDobrada", "statusMeiaDiaria",
//         "descMeiaDiaria", "qtdPessoas","idequipe","nmEquipe", "descCustoFechado"
//     ];

//     camposEvento.forEach(id => {
//         const campo = document.getElementById(id);
//         if (campo) {
//             campo.value = "";
//             // console.log(`Campo "${id}" limpo.`); // Descomente para debug
//         }
//     });
    
//     // Limpa os campos de comprovantes
//     limparCamposComprovantes();

//     // Resetar campos opcionais
//     const ajusteCustoCheck = document.getElementById('ajusteCustocheck');
//     if (ajusteCustoCheck) ajusteCustoCheck.checked = false;
//     const caixinhaCheck = document.getElementById('Caixinhacheck');
//     if (caixinhaCheck) caixinhaCheck.checked = false;

//     const meiaDiariaCheck = document.getElementById('meiaDiariaCheck');
//     if (meiaDiariaCheck) meiaDiariaCheck.checked = false;

//     const diariaDobradacheck = document.getElementById('diariaDobradacheck');
//     if (diariaDobradacheck) diariaDobradacheck.checked = false;

//     const seniorCheck = document.getElementById('Seniorcheck');
//     if (seniorCheck) seniorCheck.checked = false;

//     const plenoCheck = document.getElementById('Plenocheck');
//     if (plenoCheck) plenoCheck.checked = false;

//     const juniorCheck = document.getElementById('Juniorcheck');
//     if (juniorCheck) juniorCheck.checked = false;

//     const baseCheck = document.getElementById('Basecheck');
//     if (baseCheck) baseCheck.checked = false;
    
//     const check50 = document.getElementById('check50');
//     if (check50) check50.checked = false;

//     const check100 = document.getElementById('check100');
//     if (check100) check100.checked = false;

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

//     // Limpa as descrições de bônus e benefícios
//     document.getElementById('ajusteCusto').value = '';
//     document.getElementById('descBeneficio').value = '';

//     document.getElementById('statusCaixinha').value = 'Autorização da Caixinha';

//     document.getElementById('statusAjusteCusto').value = 'Autorização do Ajuste de Custo';

//     document.getElementById('statusDiariaDobrada').value = 'Autorização de Diária Dobrada';
//     document.getElementById('descDiariaDobrada').value = '';
//     document.getElementById('campoStatusDiariaDobrada').style.display = 'none';

//     document.getElementById('statusMeiaDiaria').value = 'Autorização de Meia Diária';
//     document.getElementById('descMeiaDiaria').value = '';
//     document.getElementById('campoStatusMeiaDiaria').style.display = 'none';

//     // Garanta que os containers opcionais sejam ocultados
//     document.getElementById('campoAjusteCusto').style.display = 'none';
//     document.getElementById('campoCaixinha').style.display = 'none';
//     document.getElementById('campoStatusCaixinha').style.display = 'none';
//     document.getElementById('campoPgtoCaixinha').style.display = 'none';


//     if (window.diariaDobradaPicker) {
//         window.diariaDobradaPicker.clear(); 
//     }
//     if (window.meiaDiariaPicker) {
//         window.meiaDiariaPicker.clear();
//     }
//     if (window.datasEventoPicker) {
//         window.datasEventoPicker.clear();
//     }

//     // --- ADICIONE OU ATUALIZE ESTE BLOCO DENTRO DA FUNÇÃO ---

//     // 1. Reset de Checkboxes (Garante que nenhum fique marcado do funcionário anterior)
//     const checksParaLimpar = [
//         'Seniorcheck', 'Seniorcheck2', 'Plenocheck', 'Juniorcheck', 
//         'Basecheck', 'Fechadocheck', 'Liberadocheck', 'viagem1Check', 
//         'viagem2Check', 'viagem3Check', 'check50', 'check100'
//     ];
//     checksParaLimpar.forEach(id => {
//         const cb = document.getElementById(id);
//         if (cb) cb.checked = false;
//     });

//     // 2. Ocultar Textareas e Wrappers de Justificativa
//     const camposParaOcultar = [
//         'descBeneficio', 'descAjusteCusto', 'descCaixinha', 
//         'descMeiaDiaria', 'descDiariaDobrada', 'descCustoFechado'
//     ];
    
//     camposParaOcultar.forEach(id => {
//         const elemento = document.getElementById(id);
//         if (elemento) {
//             elemento.style.display = 'none';
//             elemento.required = false;
//             elemento.value = '';
//         }
//     });

//     // 3. Ocultar Containers de Status e Wrappers específicos
//     // Caso você use uma Div que envolve o "descCustoFechado", oculte-a também:
//     const wrapperCustoFechado = document.getElementById('wrapperJustificativaCustoFechado'); // Ajuste o ID se for diferente
//     if (wrapperCustoFechado) wrapperCustoFechado.style.display = 'none';

//     const campoStatusCustoFechado = document.getElementById('campoStatusCustoFechado');
//     if (campoStatusCustoFechado) campoStatusCustoFechado.style.display = 'none';

//     // 4. Limpeza de Containers de Status (Aditivos/Extras)
//     const containersParaLimpar = [
//         'containerStatusDiariaDobrada', 'containerStatusMeiaDiaria',
//         'containerStatusAditivo', 'containerStatusExtraBonificado'
//     ];

//     containersParaLimpar.forEach(id => {
//         const container = document.getElementById(id);
//         if (container) {
//             container.innerHTML = '';
//             container.style.display = 'none';
//         }
//     });

//     console.log("Campos de Custo Fechado e Níveis resetados.");

//     // Limpa o objeto em memória do staff original
//     limparStaffOriginal();

//     console.log("Limpeza parcial do formulário concluída.");
// }

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
        "descMeiaDiaria", "qtdPessoas", "idequipe", "nmEquipe"
    ];

    camposEvento.forEach(id => {
        const campo = document.getElementById(id);
        if (campo) campo.value = "";
    });

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

    // 4. Containers de Status e Wrappers
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
    if (window.diariaDobradaPicker) window.diariaDobradaPicker.clear();
    if (window.meiaDiariaPicker) window.meiaDiariaPicker.clear();
    if (window.datasEventoPicker) window.datasEventoPicker.clear();

    limparCamposComprovantes();
    limparStaffOriginal();

    console.log("Limpeza parcial do formulário concluída.");
}

// function limparCamposStaff() {
//     const campos = [
//         "idStaff", "nmFuncionario", "apelidoFuncionario", "linkFotoFuncionarios", "descFuncao", "vlrCusto",
//         "nmLocalMontagem", "nmPavilhao", "alimentacao", "transporte", "vlrBeneficio", "descBeneficio",
//         "nmCliente", "nmEvento", "vlrTotal", "vlrTotalHidden", "idFuncionario", "idFuncao", "idMontagem",
//         "idPavilhao", "idCliente", "idEvento", "statusPgto", "statusCaixinha", "statusAjusteCusto", "statusDiariaDobrada",
//         "descDiariaDobrada", "statusMeiaDiaria", "descMeiaDiaria", "labelFuncionario", "perfilFuncionario", "qtdPessoas",
//         "idequipe","nmEquipe","setor"
//     ];

//     const btn = document.getElementById('Enviar');
//     if (btn) {
//         btn.style.display = 'block'; // Ou 'block', dependendo do seu fluxo
//         btn.disabled = false;
//     }
    
//     campos.forEach(id => {
//         const campo = document.getElementById(id);
//         if (campo) {
//             campo.value = "";
//             console.log(`Campo "${id}" limpo.`);
//         }
//     });

//     // Limpeza robusta para o Select Multiple de Pavilhão
//     // Força a limpeza visual de campos 'multiple' como o Pavilhão
//     const selectPavilhao = document.getElementById('nmPavilhao');
//     if (selectPavilhao) {
//         // Desmarca todas as opções selecionadas uma por uma
//         Array.from(selectPavilhao.options).forEach(option => {
//             option.selected = false;
//         });
//         console.log("Seleções de nmPavilhao resetadas manualmente.");
//     }

//     // Garante que o input de Setor também seja limpo (adicione se não estiver no array 'campos')
//     const campoSetor = document.getElementById('setor');
//     if (campoSetor) {
//         campoSetor.value = "";
//     }

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
//         labelFuncionario.textContent = "";    // limpa o texto
//         labelFuncionario.style.color = "";    // reseta cor
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

//     const contadorDatas = document.getElementById('contadorDatas');

//     if (contadorDatas) {
//         contadorDatas.textContent = "Nenhuma data selecionada.";
//     }

//     // Limpeza do Picker Principal (Datas do Evento)
//     if (window.datasEventoPicker) {
//         window.datasEventoPicker.clear();
//         // O MutationObserver deve pegar a alteração no contadorDatas, 
//         // mas é bom garantir que o contador reflita a limpeza.
//         if (contadorDatas) {
//             contadorDatas.textContent = "Nenhuma data selecionada."; 
//         }
//         console.log("Datas do evento limpas via Flatpickr.");
//     }
    
//     // Limpeza dos Pickers Auxiliares (Diária Dobrada e Meia Diária)
//     if (window.diariaDobradaPicker) {
//         window.diariaDobradaPicker.clear();
//     }

//     if (window.meiaDiariaPicker) {
//         window.meiaDiariaPicker.clear();
//     }
//     console.log("Pickers auxiliares (Diária Dobrada e Meia Diária) limpos.");

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

//     // Resetar campos opcionais
//     const ajusteCustoCheck = document.getElementById('ajusteCustocheck');
//     const campoAjusteCusto = document.getElementById('campoAjusteCusto');
//     const campoStatusAjusteCusto = document.getElementById('campoStatusAjusteCusto');

//     const caixinhaCheck = document.getElementById('Caixinhacheck');
//     const campoCaixinha = document.getElementById('campoCaixinha');
//     const campoStatusCaixinha = document.getElementById('campoStatusCaixinha');
//     const campoPgtoCaixinha = document.getElementById('campoPgtoCaixinha');


//     if (ajusteCustoCheck) {
//         ajusteCustoCheck.checked = false;
//         if (campoAjusteCusto) campoAjusteCusto.style.display = 'none';
//         const inputAjusteCusto = document.getElementById('ajusteCusto');
//         if (inputAjusteCusto) inputAjusteCusto.value = '';

//         const ajusteCustoTextarea = document.getElementById('descAjusteCusto');
//         if (ajusteCustoTextarea) {
//             ajusteCustoTextarea.style.display = 'none'; // Oculta o textarea
//             ajusteCustoTextarea.required = false;    // Remove a obrigatoriedade
//             ajusteCustoTextarea.value = '';        // Limpa o conteúdo
//         }

//         if (campoStatusAjusteCusto) campoStatusAjusteCusto.style.display = 'none';

//     }
//     if (caixinhaCheck) {
//         caixinhaCheck.checked = false;
//         if (campoCaixinha) campoCaixinha.style.display = 'none';
//         const inputCaixinha = document.getElementById('caixinha');
//         if (inputCaixinha) inputCaixinha.value = '';
//         if (campoStatusCaixinha) campoStatusCaixinha.style.display = 'none';

//         const descCaixinhaTextarea = document.getElementById('descCaixinha');
//         if (descCaixinhaTextarea) {
//             descCaixinhaTextarea.style.display = 'none'; // Oculta o textarea
//             descCaixinhaTextarea.required = false;   // Remove a obrigatoriedade
//             descCaixinhaTextarea.value = '';       // Limpa o conteúdo
//         }

//         if (campoStatusCaixinha) campoStatusCaixinha.style.display = 'none';
//         if (campoPgtoCaixinha) campoPgtoCaixinha.style.display = 'none';
//     }

//     const campoMeiaDiaria = document.getElementById('campoMeiaDiaria');
//     const campoStatusMeiaDiaria = document.getElementById('campoStatusMeiaDiaria');
//     const meiaDiariaCheck = document.getElementById('meiaDiariacheck');
    
//     if (meiaDiariaCheck){
//         meiaDiariaCheck.checked = false;
        
//         if (campoMeiaDiaria) campoMeiaDiaria.style.display = 'none';
//         const inputMeiaDiaria = document.getElementById('meiaDiaria');
//         if (inputMeiaDiaria) inputMeiaDiaria.value = '';
//         if (campoStatusMeiaDiaria) campoStatusMeiaDiaria.style.display = 'none';

//         const descMeiaDiariaTextarea = document.getElementById('descMeiaDiaria');
//         if (descMeiaDiariaTextarea) {
//             descMeiaDiariaTextarea.style.display = 'none'; // Oculta o textarea
//             descMeiaDiariaTextarea.required = false;     // Remove a obrigatoriedade
//             descMeiaDiariaTextarea.value = '';     // Limpa o conteúdo
//         }
//     } 

//     const campoDiariaDobrada = document.getElementById('campoDiariaDobrada');
//     const campoStatusDiariaDobrada = document.getElementById('campoStatusDiariaDobrada');
//     const diariaDobradacheck = document.getElementById('diariaDobradacheck');
    
//     if (diariaDobradacheck){
//         diariaDobradacheck.checked = false;
//         if (campoDiariaDobrada) campoDiariaDobrada.style.display = 'none';
//         const inputDiariaDobrada = document.getElementById('diariaDobrada');
//         if (inputDiariaDobrada) inputDiariaDobrada.value = '';
//         if (campoStatusDiariaDobrada) campoStatusDiariaDobrada.style.display = 'none';
        
//         const descDiariaDobradaTextarea = document.getElementById('descDiariaDobrada');
//         if (descDiariaDobradaTextarea) {
//             descDiariaDobradaTextarea.style.display = 'none'; // Oculta o textarea
//             descDiariaDobradaTextarea.required = false;      // Remove a obrigatoriedade
//             descDiariaDobradaTextarea.value = '';      // Limpa o conteúdo
//         }
//     } 

//     // O trecho abaixo estava duplicado ou incorreto, removido/corrigido.
//     // O trecho com 'meiaDiariacheck' e 'campoDiariaDobrada' estava logicamente incorreto.
//     // O `meiaDiariacheck` já foi tratado no bloco `meiaDiariaCheck`.
    
//     // if (meiaDiariacheck){
//     //     meiaDiariacheck.checked = false;
//     //     if (meiaDiariacheck) campoDiariaDobrada.style.display = 'none'; // ERROR: está referenciando campoDiariaDobrada
//     //     const inputMeiaDiaria = document.getElementById('meiaDiaria');
//     //     if (inputMeiaDiaria) iinputMeiaDiaria.value = ''; // ERROR: iinputMeiaDiaria
//     //     if (campoStatusMeiaDiaria) campoStatusMeiaDiaria.style.display = 'none';
        
//     //     const descMeiaDiariaTextarea = document.getElementById('descDiariaDobrada'); // ERROR: descDiariaDobrada
//     //     if (descMeiaDiariaTextarea) {
//     //         descMeiaDiariaTextarea.style.display = 'none'; 
//     //         descMeiaDiariaTextarea.required = false;      
//     //         descMeiaDiariaTextarea.value = '';      
//     //     }
        
//     //     if (campoStatusMeiaDiaria) ampoStatusMeiaDiaria.style.display = 'none'; // ERROR: ampoStatusMeiaDiaria
//     // } 

//     const check50 = document.getElementById('check50');
//     const check100 = document.getElementById('check100');
    
//     if (check50) {
//         check50.checked = false;
//     }
//     if (check100) {
//         check100.checked = false;
//     }

//     const senior2Check = document.getElementById('Seniorcheck');
//     if (senior2Check) senior2Check.checked = false;

//     const seniorCheck = document.getElementById('Seniorcheck');
//     if (seniorCheck) seniorCheck.checked = false;

//     const plenoCheck = document.getElementById('Plenocheck');
//     if (plenoCheck) plenoCheck.checked = false;

//     const juniorCheck = document.getElementById('Juniorcheck');
//     if (juniorCheck) juniorCheck.checked = false;

//     const baseCheck = document.getElementById('Basecheck');
//     if (baseCheck) baseCheck.checked = false;

//     const fechadoCheck = document.getElementById('Fechadocheck');
//     if (fechadoCheck) fechadoCheck.checked = false;

//     const liberadoCheck = document.getElementById('Liberadocheck');
//     if (liberadoCheck) liberadoCheck.checked = false;

//     const viagem1Check = document.getElementById('viagem1Check');
//     if (viagem1Check) viagem1Check.checked = false;

//     const viagem2Check = document.getElementById('viagem2Check');
//     if (viagem2Check) viagem2Check.checked = false;

//     const viagem3Check = document.getElementById('viagem3Check');
//     if (viagem3Check) viagem3Check.checked = false;

//     const beneficioTextarea = document.getElementById('descBeneficio');
//     if (beneficioTextarea) {
//         beneficioTextarea.style.display = 'none'; // Oculta o textarea
//         beneficioTextarea.required = false;      // Remove a obrigatoriedade
//         beneficioTextarea.value = '';      // Limpa o conteúdo
//     }

//     const descAjusteCustoTextarea = document.getElementById('descAjusteCusto');
//     if (descAjusteCustoTextarea) {
//         descAjusteCustoTextarea.style.display = 'none'; // Oculta o textarea
//         descAjusteCustoTextarea.required = false;    // Remove a obrigatoriedade
//         descAjusteCustoTextarea.value = '';        // Limpa o conteúdo
//     }

//     const descCaixinhaTextarea = document.getElementById('descCaixinha');
//     if (descCaixinhaTextarea) {
//         descCaixinhaTextarea.style.display = 'none'; // Oculta o textarea
//         descCaixinhaTextarea.required = false;   // Remove a obrigatoriedade
//         descCaixinhaTextarea.value = '';       // Limpa o conteúdo
//     }

//     const descCustoFechadoTextarea = document.getElementById('descCustoFechado');
//     if (descCustoFechadoTextarea) {
//         descCustoFechadoTextarea.style.display = 'none'; // Oculta o textarea
//         descCustoFechadoTextarea.required = false;   // Remove a obrigatoriedade
//         descCustoFechadoTextarea.value = '';       // Limpa o conteúdo
//     }

//     // 🎯 CORREÇÃO: Alinhando a string para 'Autorização de...' para bater com a lógica de salvamento
//     const statusMeiaDiaria = document.getElementById('statusMeiaDiaria');
//     if (statusMeiaDiaria) statusMeiaDiaria.value = 'Autorização de Meia Diária'; // <-- Corrigido para "de"

//     // 🎯 CORREÇÃO: Alinhando a string para 'Autorização de...' para bater com a lógica de salvamento
//     const statusDiariaDobrada = document.getElementById('statusDiariaDobrada');
//     if (statusDiariaDobrada) statusDiariaDobrada.value = 'Autorização de Diária Dobrada'; // <-- Corrigido para "de"

//     const statusPgto = document.getElementById('statuspgto');
//     if (statusPgto) statusPgto.value = '';

//     const statusAjusteCusto = document.getElementById('statusAjusteCusto');
//     if (statusAjusteCusto) statusAjusteCusto.value = 'Autorização do Ajuste de Custo';

//     const statusCaixinha = document.getElementById('statuscaixinha');
//     if (statusCaixinha) statusCaixinha.value = 'Autorização da Caixinha';   

//     const containerStatusDiariaDobrada = document.getElementById('containerStatusDiariaDobrada');
//     const containerStatusMeiaDiaria = document.getElementById('containerStatusMeiaDiaria');
//     const containerStatusAditivo = document.getElementById('containerStatusAditivo');
//     const containerStatusExtraBonificado = document.getElementById('containerStatusExtraBonificado');

//     if (containerStatusDiariaDobrada) {
//         containerStatusDiariaDobrada.innerHTML = '';
//         containerStatusDiariaDobrada.style.display = 'none';
//     }

//     if (containerStatusMeiaDiaria) {
//         containerStatusMeiaDiaria.innerHTML = '';
//         containerStatusMeiaDiaria.style.display = 'none';
//     }

    
//     if (containerStatusAditivo) {
//         containerStatusAditivo.innerHTML = '';
//         containerStatusAditivo.style.display = 'none';
//     }

//     if (containerStatusExtraBonificado) {
//         containerStatusExtraBonificado.innerHTML = '';
//         containerStatusExtraBonificado.style.display = 'none';
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

//     const tabelaCorpo = document.getElementById("eventsDataTable") ? document.getElementById("eventsDataTable").getElementsByTagName("tbody")[0] : null;

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
//         console.warn("Tabela com ID 'eventsDataTable' ou seu tbody não encontrado para limpeza. Verifique se o ID está correto.");
//     }

//     // --- ADICIONE OU ATUALIZE ESTE BLOCO DENTRO DA FUNÇÃO ---

//     // 1. Reset de Checkboxes (Garante que nenhum fique marcado do funcionário anterior)
//     const checksParaLimpar = [
//         'Seniorcheck', 'Seniorcheck2', 'Plenocheck', 'Juniorcheck', 
//         'Basecheck', 'Fechadocheck', 'Liberadocheck', 'viagem1Check', 
//         'viagem2Check', 'viagem3Check', 'check50', 'check100'
//     ];
//     checksParaLimpar.forEach(id => {
//         const cb = document.getElementById(id);
//         if (cb) cb.checked = false;
//     });

//     // 2. Ocultar Textareas e Wrappers de Justificativa
//     const camposParaOcultar = [
//         'descBeneficio', 'descAjusteCusto', 'descCaixinha', 
//         'descMeiaDiaria', 'descDiariaDobrada', 'descCustoFechado'
//     ];
    
//     camposParaOcultar.forEach(id => {
//         const elemento = document.getElementById(id);
//         if (elemento) {
//             elemento.style.display = 'none';
//             elemento.required = false;
//             elemento.value = '';
//         }
//     });

//     // 3. Ocultar Containers de Status e Wrappers específicos
//     // Caso você use uma Div que envolve o "descCustoFechado", oculte-a também:
//     const wrapperCustoFechado = document.getElementById('wrapperJustificativaCustoFechado'); // Ajuste o ID se for diferente
//     if (wrapperCustoFechado) wrapperCustoFechado.style.display = 'none';

//     const campoStatusCustoFechado = document.getElementById('campoStatusCustoFechado');
//     if (campoStatusCustoFechado) campoStatusCustoFechado.style.display = 'none';

//     // 4. Limpeza de Containers de Status (Aditivos/Extras)
//     const containersParaLimpar = [
//         'containerStatusDiariaDobrada', 'containerStatusMeiaDiaria',
//         'containerStatusAditivo', 'containerStatusExtraBonificado'
//     ];

//     containersParaLimpar.forEach(id => {
//         const container = document.getElementById(id);
//         if (container) {
//             container.innerHTML = '';
//             container.style.display = 'none';
//         }
//     });

//     console.log("Campos de Custo Fechado e Níveis resetados.");


//     limparCamposComprovantes();
//     limparFoto();

//     // ✅ Limpa objeto em memória
//     limparStaffOriginal();
//     console.log("StaffOriginal resetado.");
// }

function limparCamposStaff() {
    console.log("Iniciando limpeza completa do formulário Staff.");

    // 1. Reset de variáveis de controle
    currentEditingStaffEvent = null;
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
        "idPavilhao", "idCliente", "idEvento", "statusPgto", "statusCaixinha", "statusAjusteCusto", 
        "statusDiariaDobrada", "descDiariaDobrada", "statusMeiaDiaria", "descMeiaDiaria", 
        "labelFuncionario", "perfilFuncionario", "qtdPessoas", "idequipe", "nmEquipe", "setor",
        "ajusteCusto", "caixinha", "meiaDiaria", "diariaDobrada", "avaliacao"
    ];

    campos.forEach(id => {
        const campo = document.getElementById(id);
        if (campo) campo.value = "";
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
        'statuscaixinha': 'Autorização da Caixinha'
    };
    for (let id in statusPadrao) {
        const el = document.getElementById(id);
        if (el) el.value = statusPadrao[id];
    }

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
    if (window.datasEventoPicker) window.datasEventoPicker.clear();
    if (window.diariaDobradaPicker) window.diariaDobradaPicker.clear();
    if (window.meiaDiariaPicker) window.meiaDiariaPicker.clear();
    
    const contador = document.getElementById('contadorDatas');
    if (contador) contador.textContent = "Nenhuma data selecionada.";

    // 10. Limpeza de Select Multiple (Pavilhão)
    const selectPavilhao = document.getElementById('nmPavilhao');
    if (selectPavilhao) {
        Array.from(selectPavilhao.options).forEach(opt => opt.selected = false);
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

    // Funções auxiliares externas
    limparCamposComprovantes();
    limparFoto();
    limparStaffOriginal();

    console.log("StaffOriginal e campos resetados com sucesso.");
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
//     document.getElementById('vlrCacheTotal').value = '';
//     document.getElementById('vlrAjdCustoTotal').value = '';

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
//         document.getElementById('Liberadocheck').checked = false;
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
//         document.getElementById('Liberadocheck').checked = false;
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

// // --- ADICIONE OU ATUALIZE ESTE BLOCO DENTRO DA FUNÇÃO ---

//     // 1. Reset de Checkboxes (Garante que nenhum fique marcado do funcionário anterior)
//     const checksParaLimpar = [
//         'Seniorcheck', 'Seniorcheck2', 'Plenocheck', 'Juniorcheck', 
//         'Basecheck', 'Fechadocheck', 'Liberadocheck', 'viagem1Check', 
//         'viagem2Check', 'viagem3Check', 'check50', 'check100'
//     ];
//     checksParaLimpar.forEach(id => {
//         const cb = document.getElementById(id);
//         if (cb) cb.checked = false;
//     });

//     // 2. Ocultar Textareas e Wrappers de Justificativa
//     const camposParaOcultar = [
//         'descBeneficio', 'descAjusteCusto', 'descCaixinha', 
//         'descMeiaDiaria', 'descDiariaDobrada', 'descCustoFechado'
//     ];
    
//     camposParaOcultar.forEach(id => {
//         const elemento = document.getElementById(id);
//         if (elemento) {
//             elemento.style.display = 'none';
//             elemento.required = false;
//             elemento.value = '';
//         }
//     });

//     // 3. Ocultar Containers de Status e Wrappers específicos
//     // Caso você use uma Div que envolve o "descCustoFechado", oculte-a também:
//     const wrapperCustoFechado = document.getElementById('wrapperJustificativaCustoFechado'); // Ajuste o ID se for diferente
//     if (wrapperCustoFechado) wrapperCustoFechado.style.display = 'none';

//     const campoStatusCustoFechado = document.getElementById('campoStatusCustoFechado');
//     if (campoStatusCustoFechado) campoStatusCustoFechado.style.display = 'none';

//     // 4. Limpeza de Containers de Status (Aditivos/Extras)
//     const containersParaLimpar = [
//         'containerStatusDiariaDobrada', 'containerStatusMeiaDiaria',
//         'containerStatusAditivo', 'containerStatusExtraBonificado'
//     ];

//     containersParaLimpar.forEach(id => {
//         const container = document.getElementById(id);
//         if (container) {
//             container.innerHTML = '';
//             container.style.display = 'none';
//         }
//     });

//     console.log("Campos de Custo Fechado e Níveis resetados.");

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

async function limparCamposStaffParcial() {
    console.log("Iniciando limpeza parcial do Staff (Funcionário e Valores).");

    // 1. Reset de variáveis de controle e Foto
    currentEditingStaffEvent = null;
    isFormLoadedFromDoubleClick = false;

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
    });

    // 4. Reset de Checkboxes (Unificado)
    const checksParaLimpar = ['ajusteCustocheck', 'Caixinhacheck', 'meiaDiariacheck', 'diariaDobradacheck', 'check50', 'check100', 'viagem1Check', 'viagem2Check', 'viagem3Check'];
        console.log ("pulando niveis especificos:", pularLimpezaNiveis);
    
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
        'datasDobrada', 'datasMeiaDiaria', 'statusAjusteCusto', 'statuscaixinha',
        'ajusteCusto', 'caixinha' // Inputs que você marcou como 🎯 Novo
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
        'statuspgto': ''
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

    // Funções de limpeza externa
    limparCamposComprovantes();
    limparFoto();
    limparStaffOriginal();



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
        const vlrAlimentacaoViagem1 = (parseFloat(vlrAlimentacaoFuncao)|| 0) * 2 ;
        document.getElementById("alimentacao").value = vlrAlimentacaoViagem1.toFixed(2);
        document.getElementById("transporte").value = (0).toFixed(2)

        // Texto
        let separador = descBeneficioAtual.trim().length > 0 ? "\n\n" : "";
        descBeneficioTextarea.value = descBeneficioAtual + separador + DescViagem1;
    } else {
        // Reset para o padrão da função
        document.getElementById("alimentacao").value = (parseFloat(vlrAlimentacaoFuncao) || 0).toFixed(2);
        document.getElementById("transporte").value = (parseFloat(vlrTransporteFuncao) || 0).toFixed(2);
        descBeneficioTextarea.value = descBeneficioAtual;
    }
        calcularValorTotal();
    });

    document.getElementById('viagem2Check').addEventListener('change', function () { 
        const textoParaLimpar = descBeneficioTextarea.value;
        let descBeneficioAtual = limparDescricoesViagem(textoParaLimpar);

        if (this.checked) {

            [viagem1Check, viagem3Check].forEach(c =>{ if(c) c.checked = false;});
            const vlrAlimentacaoViagem2 = ((parseFloat(vlrAlimentacaoFuncao) || 0 ) *2) + ((parseFloat(vlrAlimentacaoFuncao)|| 0) /2);
            document.getElementById("alimentacao").value = vlrAlimentacaoViagem2.toFixed(2);
            document.getElementById("transporte").value = (0).toFixed(2)

            let separador = descBeneficioAtual.trim().length > 0 ? "\n\n" : "";
            descBeneficioTextarea.value = descBeneficioAtual + separador + DescViagem2;

        }else {

            document.getElementById("alimentacao").value = (parseFloat(vlrAlimentacaoFuncao) || 0).toFixed(2);
            document.getElementById("transporte").value = (parseFloat(vlrTransporteFuncao) || 0).toFixed(2);

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

            let separador = descBeneficioAtual.trim().length > 0 ? "\n\n":""
                descBeneficioTextarea.value = descBeneficioAtual + separador + DescViagem3;

    } else {

            document.getElementById("alimentacao").value = (parseFloat(vlrAlimentacaoFuncao) || 0).toFixed(2);
            document.getElementById("transporte").value = (parseFloat(vlrTransporteFuncao) || 0).toFixed(2);
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
}


function calcularValorTotal() {
    if (isFormLoadedFromDoubleClick) {
        const cache = window.currentEventDataCache || { vlrtotcache: 0, vlrtotajdcusto: 0 };
        if (cache.vlrtotcache > 0 && cache.vlrtotajdcusto > 0) {
            console.log("Cálculo abortado: dados do banco serão restaurados pelo setTimeout.");
            return;
        }
        console.log("⚠️ Totais zerados no banco, calculando mesmo durante carregamento.");
    }
    
    console.log("Iniciando o cálculo do valor total...");

    // Pega os valores dos inputs e converte para número
    const cache = parseFloat(document.getElementById('vlrCusto').value.replace(',', '.')) || 0;
    const transporte = parseFloat(document.getElementById('transporte').value.replace(',', '.')) || 0;   
    const alimentacao = parseFloat(document.getElementById('alimentacao').value.replace(',', '.')) || 0;
    const ajusteCusto = parseFloat(document.getElementById('ajusteCusto').value.replace(',', '.')) || 0;
    const caixinha = parseFloat(document.getElementById('caixinha').value.replace(',', '.')) || 0;
    const perfilFuncionario = document.getElementById("perfilFuncionario").value;
    const qtdpessoas = parseInt(document.getElementById("qtdPessoas").value) || 1;
    const isFechado = document.getElementById('Fechadocheck').checked;
    const isLiberado = document.getElementById('Liberadocheck').checked;
    // Inicializa o valor total com os itens que são sempre calculados
  
    let total = 0;
    let totalCache = 0; 
    let totalAjdCusto = 0;
    let statusAnteriorAjusteCusto = '';


    if (isFormLoadedFromDoubleClick)
    {
        console.log("VALORES PARA RECALCULAR", vlrAlimentacaoDobra);
    }
    const statusFechado = document.getElementById("statusCustoFechado")?.value || "";
    
    if (isFechado || isLiberado) {
            if (statusFechado === "Autorizado") {
                total = cache;
                totalCache = cache;
                console.log("Cachê Fechado Autorizado: Adicionando ao total.");
            } else {
                total = 0;
                totalCache = 0;
                console.log("Cachê Fechado Pendente/Rejeitado: Total zerado.");
            }
    } else {

        // Pega o número de diárias selecionadas
        const contadorTexto = document.getElementById('contadorDatas').innerText;
        const match = contadorTexto.match(/\d+/);
        const numeroDias = match ? parseInt(match[0]) : 0;

        const datasParaProcessar = window.datasEventoPicker 
            ? window.datasEventoPicker.selectedDates // Fonte de dados mais confiável: a instância Flatpickr
            : datasEventoSelecionadas; // Fallback para a variável global, se a instância não estiver disponível

        // Conta apenas o número de datas do evento
        console.log("Número de diárias:", contadorTexto, match, numeroDias, cache, ajusteCusto, transporte, alimentacao, caixinha, datasParaProcessar);

        //(datasEventoSelecionadas || []).forEach(data => {
        (datasParaProcessar || []).forEach(data => {
            console.log("Processando data:", data, perfilFuncionario);

            if (perfilFuncionario === "Freelancer") {
                total += cache + transporte + alimentacao;
                totalCache += cache;
                totalAjdCusto += transporte + alimentacao;
            } else if (perfilFuncionario === "Lote") {
                if (qtdpessoas <= 0) {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Atenção',
                        text: "Perfil 'Lote' selecionado, o preenchimento da quantidade de pessoas é OBRIGATÓRIO."
                    });
                }
                total += (cache + transporte + alimentacao) * qtdpessoas;
                totalCache += cache * qtdpessoas;
                totalAjdCusto += (transporte + alimentacao) * qtdpessoas;
                console.log(`Perfil 'Lote' detectado. Diária (${data.toLocaleDateString()}) para ${qtdpessoas} pessoas: ${total.toFixed(2)}`);
            } else {
                if (isFinalDeSemanaOuFeriado(data)) {
                    total += cache + transporte +  alimentacao;
                    totalCache += cache;   
                    totalAjdCusto += transporte + alimentacao;         
                } else {
                    total += transporte + alimentacao;
                    totalAjdCusto += transporte + alimentacao;
                    console.log(`Data ${data.toLocaleDateString()} não é fim de semana nem feriado. Cachê não adicionado.`);
                }
            }
        });
    }

    document.getElementById('vlrTotal').value = 'R$ ' + total.toFixed(2).replace('.', ',');

    console.log("Total inicial (sem adicionais):", total.toFixed(2));

    // --- NOVA LÓGICA: INCLUIR VALORES APENAS SE AUTORIZADOS ---

    // 1. Verificação do Ajuste de Custo
    const statusAjusteCusto = document.getElementById("statusAjusteCusto").value;
    if (statusAjusteCusto === 'Autorizado') {
        total += ajusteCusto;
        totalCache += ajusteCusto;
        console.log("Ajuste Autorizado. Adicionando:", ajusteCusto.toFixed(2));
    } else if (
        statusAnteriorAjusteCusto === 'Autorizado' && 
        (statusAjusteCusto === 'Pendente' || statusAjusteCusto === 'Rejeitado')
    ) {
        total -= ajusteCusto;
        totalCache -= ajusteCusto;
        console.log("Ajuste removido (era Autorizado). Subtraindo:", ajusteCusto.toFixed(2));
    } else {
        console.log("Ajuste Não Autorizado. Nada alterado.");
    }

    // 2. Verificação da Caixinha
    const statusCaixinha = document.getElementById("statusCaixinha").value;
    if (statusCaixinha === 'Autorizado') {
        total += caixinha;
       // totalCache += caixinha
        console.log("Caixinha Autorizada. Adicionando:", caixinha.toFixed(2));
    } else {
        console.log("Caixinha Não Autorizada. Não adicionada.");
    }

    // 3. Verificação de Diárias Dobradas
    // if (diariaDobradacheck.checked && datasDobrada && datasDobrada.length > 0) {
    //     const diariasDobradasAutorizadas = datasDobrada.filter(item => item.status === 'Autorizado');
    //     if (diariasDobradasAutorizadas.length > 0) {
    //         const valorDiariaDobrada = (cache + transporte + alimentacao) * diariasDobradasAutorizadas.length;
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
            let valorDiariaDobrada = cache + vlrAlimentacaoDobra;
            let valorCacheDobrada = cache;
            let valorAjdCustoDobrada = vlrAlimentacaoDobra          
            // transporte não entra no cálculo
            valorDiariaDobrada *= diariasDobradasAutorizadas.length;
            valorCacheDobrada *= diariasDobradasAutorizadas.length;
            valorAjdCustoDobrada *= diariasDobradasAutorizadas.length;
            
            total += valorDiariaDobrada;
            totalCache += valorCacheDobrada
            totalAjdCusto += valorAjdCustoDobrada;

            console.log(`Diárias Dobradas Autorizadas: ${diariasDobradasAutorizadas.length}. Adicionando: ${valorDiariaDobrada.toFixed(2)}`);
        }
    }

    // 4. Verificação de Meias Diárias
    if (meiaDiariacheck.checked && datasMeiaDiaria && datasMeiaDiaria.length > 0) {
        const meiasDiariasAutorizadas = datasMeiaDiaria.filter(item => item.status === 'Autorizado');
        if (meiasDiariasAutorizadas.length > 0) {
            let valorMeiaDiaria = (cache / 2)+ vlrAlimentacaoDobra; // base é metade do cache
            let valorCacheMeia = (cache/2);
            let valorAjdCustoMeia = vlrAlimentacaoDobra;

            console.log("ALIMENTACAO", alimentacao);   

            // transporte não entra no cálculo
            valorMeiaDiaria *= meiasDiariasAutorizadas.length;
            valorCacheMeia *= meiasDiariasAutorizadas.length;
            valorAjdCustoMeia *= meiasDiariasAutorizadas.length;
            
            total += valorMeiaDiaria;
            totalCache += valorCacheMeia;
            totalAjdCusto += valorAjdCustoMeia;

            console.log(`Meias Diárias Autorizadas: ${meiasDiariasAutorizadas.length}. Adicionando: ${valorMeiaDiaria.toFixed(2)}. Ajuda de Custo: ${valorAjdCustoMeia.toFixed(2)}    `);
        }
    }
    // Formatação e atualização dos campos
    const valorFormatado = 'R$ ' + total.toFixed(2).replace('.', ',');
    const valorLimpo = total.toFixed(2);

    document.getElementById('vlrTotal').value = valorFormatado;
    document.getElementById('vlrTotalHidden').value = valorLimpo;

    const valorFormatTotCache = 'R$ ' + totalCache.toFixed(2).replace('.', ',');
    const valorLimpoCache = totalCache.toFixed(2);

    document.getElementById('vlrTotalCache').value = valorFormatTotCache;
    document.getElementById('vlrTotalCacheHidden').value = valorLimpoCache;

    const valorFormatTotAjdCusto = 'R$ ' + totalAjdCusto.toFixed(2).replace('.', ',');
    const valorLimpoAjdCusto = totalAjdCusto.toFixed(2);

    document.getElementById('vlrTotalAjdCusto').value = valorFormatTotAjdCusto;
    document.getElementById('vlrTotalAjdCustoHidden').value = valorLimpoAjdCusto;

    console.log("Valor Total Final: R$", total.toFixed(2));
}

// O restante do seu código de listeners está correto VERIFICAR SE É PARA REMOVER TODO O TRECHO
//Adiciona listeners de input para os campos que impactam no cálculo
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


// async function verificarLimiteDeFuncao(criterios) {
//     const nmEvento = (criterios.nmEvento || '').trim().toUpperCase();
//     const nmCliente = (criterios.nmCliente || '').trim().toUpperCase();
//     const nmlocalMontagem = (criterios.nmlocalMontagem || '').trim().toUpperCase();
//     const pavilhao = (criterios.pavilhao || '').trim().toUpperCase();
//     const nmFuncao = (criterios.nmFuncao || '').trim().toUpperCase();
//     const setor = (criterios.setor || '').trim().toUpperCase();

//     const idFuncionario = criterios.idFuncionario || document.getElementById('idFuncionario')?.value || null;
//     const selectFunc = document.getElementById('nmFuncionario');       
//     const nmFuncionario = criterios.nmFuncionario || selectFunc.options[selectFunc.selectedIndex]?.text;;

//     const campoData = document.getElementById('periodoEvento'); 
//     let datasSelecionadas = [];

//     if (campoData && campoData._flatpickr) {
//         // Se usar Flatpickr
//         datasSelecionadas = campoData._flatpickr.selectedDates.map(d => 
//             d.toLocaleDateString('en-CA') // Formato YYYY-MM-DD
//         );
//     } else if (campoData?.value) {
//         // Se for um input simples
//         datasSelecionadas = [campoData.value];
//     }
//     // 1. Tenta a chave completa
//     const chaveCompleta = [nmEvento, nmCliente, nmlocalMontagem, pavilhao, nmFuncao, setor].filter(p => p).join('-');
    
//     // 2. Tenta uma chave simplificada (caso o orçamento não use pavilhão/setor na chave)
//     const chaveSimples = [nmEvento, nmCliente, nmlocalMontagem, nmFuncao].filter(p => p).join('-');

//     let dadosOrcamento = orcamentoPorFuncao[chaveCompleta] || orcamentoPorFuncao[chaveSimples];

//     // 3. Fallback: Se ainda assim não achar, procura no dicionário uma chave que CONTENHA o nome da função e do evento
//     if (!dadosOrcamento) {
//         const todasAsChaves = Object.keys(orcamentoPorFuncao);
//         const chaveEncontrada = todasAsChaves.find(c => c.includes(nmEvento) && c.includes(nmFuncao));
//         if (chaveEncontrada) dadosOrcamento = orcamentoPorFuncao[chaveEncontrada];
//     }

//     console.log("Busca de Orçamento:", { tentada: chaveCompleta, encontrada: dadosOrcamento });

//     if (!dadosOrcamento) {
//         console.warn("⚠️ Orçamento não localizado. Verifique se os nomes no Orçamento batem com os nomes no Staff.");
//         return { allowed: true };
//     }

//     // Contagem na tabela (mantém sua lógica atual)
//     let countNaTabela = 0;
//     document.querySelectorAll('#eventsTableBody tr').forEach(linha => {
//         try {
//             const data = JSON.parse(linha.dataset.eventData);
//             if (data.nmfuncao?.trim().toUpperCase() === nmFuncao &&
//                 data.nmevento?.trim().toUpperCase() === nmEvento) {
//                 countNaTabela++;
//             }
//         } catch (e) {}
//     });

//     const totalJaOcupado = Number(dadosOrcamento.quantidadeEscalada || 0) + countNaTabela;
//     const limite = Number(dadosOrcamento.quantidadeOrcada || 0);
//     const totalProposto = totalJaOcupado + 1;

//     if (totalProposto > limite) {
//         const { value: decisao } = await Swal.fire({
//             icon: 'warning',
//             title: 'Limite de Vagas Excedido',
//             html: `A função <b>${nmFuncao}</b> tem limite de <b>${limite}</b> vaga(s).<br>Já existem <b>${totalJaOcupado}</b> cadastradas.`,
//             showCancelButton: true,
//             showDenyButton: true,
//             confirmButtonText: 'Solicitar Aditivo',
//             denyButtonText: 'Extra Bonificado',
//             cancelButtonText: 'Cancelar Cadastro',
//             confirmButtonColor: '#3085d6',
//             denyButtonColor: '#28a745',
//         });

//         // if (decisao === true) { // Aditivo
//         //     await solicitarDadosExcecao('Aditivo', dadosOrcamento.idOrcamento, nmFuncao, criterios.idFuncao, idFuncionario);
//         // } else if (decisao === false) { // Extra Bonificado (Deny retorna false no Swal)
//         //     await solicitarDadosExcecao('ExtraBonificado', dadosOrcamento.idOrcamento, nmFuncao, criterios.idFuncao, idFuncionario);
//         // }

//         // return { allowed: false }; // Bloqueia o POST original

//         if (decisao === true || decisao === false) { 
//             const motivo = " - Vaga Excedida";
//             //const tipoEscolhido = (decisao === true) ? 'Aditivo' : 'ExtraBonificado';
//             const tipoEscolhido = (decisao === true) ? `Aditivo${motivo}` : `Extra Bonificado${motivo}`;

//             const dataReferencia = datasSelecionadas.length > 0 ? datasSelecionadas[0] : null;
//             // 🚀 CHAMA A VERIFICAÇÃO (Ela cuidará dos Swals de Pendente e Autorizado)
//             const verificacao = await verificarStatusAditivoExtra(
//                 dadosOrcamento.idOrcamento, 
//                 criterios.idFuncao, 
//                 tipoEscolhido, 
//                 idFuncionario, 
//                 nmFuncionario,
//                 nmFuncao,
//                 dataReferencia
//             );

//             // Se a verificação retornar bloqueado (seja por Pendente ou porque o 
//             // usuário desistiu no Autorizado), paramos aqui.
//             if (verificacao && verificacao.bloqueado) {
//                 return { allowed: false };
//             }

//             // ✅ Só abre a justificativa se NÃO houver pendência ou se o usuário 
//             // confirmou que quer uma nova mesmo já tendo uma Autorizada.
//             await solicitarDadosExcecao(tipoEscolhido, dadosOrcamento.idOrcamento, nmFuncao, criterios.idFuncao, idFuncionario, datasSelecionadas);
//         }

//         return { allowed: false };
//     }

//     return { allowed: true };
// }


async function verificarLimiteDeFuncao(criterios) {
   
    const nmEvento = (criterios.nmEvento || '').trim().toUpperCase();
    const nmCliente = (criterios.nmCliente || '').trim().toUpperCase();
    const nmlocalMontagem = (criterios.nmlocalMontagem || '').trim().toUpperCase();
    const pavilhao = (criterios.pavilhao || '').trim().toUpperCase();
    const nmFuncao = (criterios.nmFuncao || '').trim().toUpperCase();
    const setor = (criterios.setor || '').trim().toUpperCase();

    const idFuncionario = criterios.idFuncionario || document.getElementById('idFuncionario')?.value || null;
    const selectFunc = document.getElementById('nmFuncionario');       
    const nmFuncionario = criterios.nmFuncionario || selectFunc.options[selectFunc.selectedIndex]?.text;;

    // --- CAPTURA DAS DATAS (Melhorada para evitar Array Vazio) ---
    const campoData = document.getElementById('periodoEvento'); 
    let datasSelecionadas = [];

    // 1. Tenta pelo Flatpickr do elemento
    if (campoData && campoData._flatpickr && campoData._flatpickr.selectedDates.length > 0) {
        datasSelecionadas = campoData._flatpickr.selectedDates.map(d => d.toLocaleDateString('en-CA'));
    } 
    // 2. Tenta pela variável global que o CIOSP costuma usar
    else if (window.datasEventoPicker && window.datasEventoPicker.selectedDates.length > 0) {
        datasSelecionadas = window.datasEventoPicker.selectedDates.map(d => d.toLocaleDateString('en-CA'));
    }
    // 3. Tenta pelo que já veio no objeto criterios
    else if (criterios.datasEvento && (Array.isArray(criterios.datasEvento) ? criterios.datasEvento.length > 0 : true)) {
        datasSelecionadas = Array.isArray(criterios.datasEvento) ? criterios.datasEvento : [criterios.datasEvento];
    }

    // 🎯 Segurança: Se ainda estiver vazio, não deixa prosseguir sem data
    if (datasSelecionadas.length === 0) {
        console.warn("⚠️ Nenhuma data detectada. Usando data de hoje como último recurso.");
        datasSelecionadas = [new Date().toLocaleDateString('en-CA')];
    }

    const dataUnicaParaBanco = datasSelecionadas[0] || null;
   
    //const setorAlocacao = (criterios.pavilhao || criterios.setor || '').trim().toUpperCase();

    // 1. Tenta achar a chave exata ou a simples
    const chaveCompleta = [nmEvento, nmFuncao, setor, pavilhao].filter(p => p).join('-');
    const chaveSimples = [nmEvento, nmFuncao].filter(p => p).join('-');

    let dadosOrcamento = orcamentoPorFuncao[chaveCompleta] || orcamentoPorFuncao[chaveSimples];

    // 🎯 FALLBACK: O que fazia o seu funcionar antes
    if (!dadosOrcamento) {
        const todasAsChaves = Object.keys(orcamentoPorFuncao);
        const chaveEncontrada = todasAsChaves.find(c => c.includes(nmEvento) && c.includes(nmFuncao));
        if (chaveEncontrada) dadosOrcamento = orcamentoPorFuncao[chaveEncontrada];
    }

    if (!dadosOrcamento) {
        console.warn("⚠️ Orçamento não localizado. Permitindo...");
        return { allowed: true };
    }

    // 2. CONTAGEM (Banco + Tabela atual)
    let countNaTabela = 0;
    document.querySelectorAll('#eventsTableBody tr').forEach(linha => {
        try {
            const data = JSON.parse(linha.dataset.eventData);
            if (data.nmfuncao?.trim().toUpperCase() === nmFuncao &&
                data.nmevento?.trim().toUpperCase() === nmEvento) {
                countNaTabela++;
            }
        } catch (e) {}
    });

    const totalJaOcupado = Number(dadosOrcamento.quantidadeEscalada || 0) + countNaTabela;
    const limite = Number(dadosOrcamento.quantidadeOrcada || 0);

    // 🚨 REGRA: Se o total for MAIOR OU IGUAL ao limite, bloqueia e pergunta
    // if (totalJaOcupado >= limite) {
    //     const { value: decisao } = await Swal.fire({
    //         icon: 'warning',
    //         title: 'Limite de Vagas Excedido',
    //         html: `A função <b>${nmFuncao}</b> tem limite de <b>${limite}</b> vaga(s).<br>Já existem <b>${totalJaOcupado}</b> cadastradas.`,
    //         showCancelButton: true,
    //         showDenyButton: true,
    //         confirmButtonText: 'Solicitar Aditivo',
    //         denyButtonText: 'Extra Bonificado',
    //         cancelButtonText: 'Cancelar Cadastro',
    //     });

    //     if (decisao === true || decisao === false) {
    //         const motivo = " - Vaga Excedida";
    //         const tipoEscolhido = (decisao === true) ? `Aditivo${motivo}` : `Extra Bonificado${motivo}`;

    //         // 🛠️ CORREÇÃO DO ERRO 500: Garante que a data nunca seja "undefined"
    //         const dataUnicaParaBanco = datasSelecionadas[0];

    //             console.log("DATA REFERENCIA PARA VERIFICAÇÃO:", datasSelecionadas, dadosOrcamento.idOrcamento, criterios.idFuncao, tipoEscolhido, idFuncionario, nmFuncionario, nmFuncao);

    //         const verificacao = await verificarStatusAditivoExtra(
    //             dadosOrcamento.idOrcamento, 
    //             criterios.idFuncao, 
    //             tipoEscolhido, 
    //             idFuncionario, 
    //             nmFuncionario,
    //             nmFuncao,
    //             dataUnicaParaBanco // Passa null se não tiver data
    //         );

    //         console.log("Criterios para exceção:", verificacao, criterios);

    //         if (verificacao && verificacao.bloqueado) return { allowed: false };
            

    //         await solicitarDadosExcecao(
    //             tipoEscolhido, dadosOrcamento.idOrcamento, 
    //             nmFuncao, criterios.idFuncao, idFuncionario, dataUnicaParaBanco
    //         );
    //     }
        
    //     // RETORNA FALSE para qualquer caso onde o limite foi excedido
    //     return { allowed: false };
    // }

    if (totalJaOcupado >= limite) {
        
        // 🎯 PASSO 1: Antes de mostrar qualquer aviso, checamos se este funcionário já está autorizado
        // Testamos os dois tipos possíveis de solicitação
        // const verificacaoAditivo = await verificarStatusAditivoExtra(
        //     dadosOrcamento.idOrcamento, criterios.idFuncao, "Aditivo - Vaga Excedida", idFuncionario, nmFuncionario, nmFuncao, dataUnicaParaBanco
        // );

        // const verificacaoExtra = await verificarStatusAditivoExtra(
        //     dadosOrcamento.idOrcamento, criterios.idFuncao, "Extra Bonificado - Vaga Excedida", idFuncionario, nmFuncionario, nmFuncao, dataUnicaParaBanco
        // );
        // Exemplo de verificação de DATA
            const checkVaga = await verificarStatusAditivoExtra(
            dadosOrcamento.idOrcamento, 
            criterios.idFuncao, 
            'QUALQUER_VAGA', 
            idFuncionario, 
            nmFuncionario, 
            nmFuncao, 
            dataUnicaParaBanco
        );

        // ✅ Se houver autorização específica para este funcionário nesta vaga
        if (checkVaga && checkVaga.autorizado) {
            console.log("✅ Cadastro liberado: Autorização de vaga encontrada.");
            return { allowed: true }; 
        }

        // 🛑 Se houver uma solicitação PENDENTE ou REJEITADA
        // (O Swal já foi disparado dentro da função verificarStatusAditivoExtra)
        if (checkVaga && checkVaga.bloqueado) {
            return { allowed: false };
        }

        // 🎯 PASSO 2: Se não houver nada no banco, aí sim mostramos o Swal de ESCOLHA
        const { value: decisao } = await Swal.fire({
            icon: 'warning',
            title: 'Limite de Vagas Excedido',
            html: `A função <b>${nmFuncao}</b> tem limite de <b>${limite}</b> vaga(s).<br>` +
                `Já existem <b>${totalJaOcupado}</b> cadastradas.`,
            showCancelButton: true,
            showDenyButton: true,
            confirmButtonText: 'Solicitar Aditivo',
            denyButtonText: 'Extra Bonificado',
            cancelButtonText: 'Cancelar Cadastro',
        });

        if (decisao === true || decisao === false) {
            const tipoEscolhido = (decisao === true) ? `Aditivo - Vaga Excedida` : `Extra Bonificado - Vaga Excedida`;

            // Chama o formulário de justificativa
            await solicitarDadosExcecao(
                tipoEscolhido, dadosOrcamento.idOrcamento, 
                nmFuncao, criterios.idFuncao, idFuncionario, dataUnicaParaBanco
            );
        }
        
        return { allowed: false };
    }

    return { allowed: true };
}


// async function solicitarDadosExcecao(tipo, idOrcamentoAtual, nmFuncaoDoFormulario, idFuncaoDoFormulario, idFuncionario) { 
//     idFuncionario = document.getElementById('idFuncionario').value;
    
//     const { value: formValues, isConfirmed } = await Swal.fire({ // 💡 Captura 'isConfirmed'
//         title: `Solicitar ${tipo} para ${nmFuncaoDoFormulario}`,
//         html: 
//             `<input id="swal-qtd" class="swal2-input" type="number" placeholder="Quantidade Solicitada" min="1">` +
//             `<textarea id="swal-justificativa" class="swal2-textarea" placeholder="Justificativa (obrigatório)"></textarea>`,
        
//         // 🎯 MELHORIA: Adiciona explicitamente o botão Cancelar
//         showCancelButton: true,
//         confirmButtonText: `Sim, Solicitar ${tipo}`,
//         cancelButtonText: 'Cancelar',
        
//         focusConfirm: false,
//         preConfirm: () => {
//             const qtd = document.getElementById('swal-qtd').value;
//             const justificativa = document.getElementById('swal-justificativa').value;

//             if (!qtd || parseInt(qtd) <= 0) {
//                 Swal.showValidationMessage('A quantidade solicitada deve ser maior que zero.');
//                 return false;
//             }
//             if (!justificativa.trim()) {
//                 Swal.showValidationMessage('A justificativa é obrigatória.');
//                 return false;
//             }
//             return { qtd: parseInt(qtd), justificativa: justificativa };
//         }
//     });

//     // 🎯 CORREÇÃO NO FLUXO DE CANCELAMENTO
//     // isConfirmed será 'false' se o usuário clicar em Cancelar ou fechar o modal.
//     // if (isConfirmed && formValues) {
        
//     //     // ⚠️ ATENÇÃO: Corrigindo a chamada para salvarSolicitacaoAditivoExtra
//     //     // O último parâmetro de salvarSolicitacaoAditivoExtra é 'idFuncionario', 
//     //     // mas você estava passando 'idEmpresa' que não deve ser enviado pelo frontend.
//     //     // O idFuncionario é nulo neste cenário (limite de função), portanto, passamos null.

//     //     console.log("Salvando solicitação de exceção:", {
//     //         idOrcamentoAtual,
//     //         idFuncaoDoFormulario,
//     //         qtd: formValues.qtd,
//     //         tipo,
//     //         justificativa: formValues.justificativa,
//     //         idFuncionario
//     //     });
      
//     //     return salvarSolicitacaoAditivoExtra(
//     //         idOrcamentoAtual, 
//     //         idFuncaoDoFormulario,             
//     //         formValues.qtd, 
//     //         tipo, 
//     //         formValues.justificativa, 
//     //         idFuncionario // idFuncionario é null neste cenário (Aditivo/Extra por Limite de Função)
//     //     );
//     // }

//     // // Retorna false se cancelado ou se o modal for fechado
//     // return { sucesso: false, cancelado: true, erro: 'Solicitação de exceção cancelada pelo usuário.' };

//     if (isConfirmed && formValues) {
//         // Chamamos a função e aguardamos o resultado
//         const resultado = await salvarSolicitacaoAditivoExtra(
//             idOrcamentoAtual, 
//             idFuncaoDoFormulario,             
//             formValues.qtd, 
//             tipo, 
//             formValues.justificativa, 
//             idFuncionario
//         );

//         // 🎯 ADICIONE ESTE BLOCO AQUI:
//         // if (resultado.sucesso) {
//         //     await Swal.fire({
//         //         icon: 'success',
//         //         title: 'Solicitação Enviada!',
//         //         text: `Sua solicitação de ${tipo} foi registrada com sucesso (ID: ${resultado.idAditivoExtra}).`,
//         //         confirmButtonText: 'OK'
//         //     });
//         // } 
//         if (resultado.sucesso) {
//             // 🎯 TRATAMENTO ESPECÍFICO PARA DATAS FORA DO ORÇAMENTO
//             if (tipo.includes("Data fora do Orçamento")) {
                
//                 // 1. Removemos as datas excedentes do Flatpickr
//                 if (window.datasEventoPicker) {
//                     const todasDatas = window.datasEventoPicker.selectedDates.map(d => d.toISOString().split('T')[0]);
                    
//                     // Aqui usamos a lógica: se a data NÃO está nas permitidas (que calculamos na função anterior)
//                     // No entanto, para ser mais simples e direto aqui:
//                     // Se o usuário acabou de solicitar a exceção de data, 
//                     // a regra de negócio diz que ele NÃO pode salvar essa data ainda.
                    
//                     // Então, limpamos o picker ou mantemos apenas as que o orçamento já tinha.
//                     // Uma forma elegante é avisar o usuário:
//                     await Swal.fire({
//                         icon: 'success',
//                         title: 'Solicitação Enviada!',
//                         html: `Sua solicitação de <b>${tipo}</b> foi registrada.<br><br>` +
//                               `<span style="color: #d33">Importante:</span> As datas fora do orçamento foram removidas da sua seleção atual e só poderão ser usadas após a aprovação.`,
//                         confirmButtonText: 'OK'
//                     });
//                 }
//             } else {
//                 // Mensagem padrão para Vagas Excedidas ou outros tipos
//                 await Swal.fire({
//                     icon: 'success',
//                     title: 'Solicitação Enviada!',
//                     text: `Sua solicitação de ${tipo} foi registrada com sucesso.`,
//                     confirmButtonText: 'OK'
//                 });
//             }
//         }
//         else {
//             await Swal.fire({
//                 icon: 'error',
//                 title: 'Falha na Solicitação',
//                 text: resultado.erro || 'Ocorreu um erro ao salvar.',
//                 confirmButtonText: 'Entendido'
//             });
//         }

//         return resultado; // Mantém o retorno original para quem chamou a função
//     }
    
// }


async function solicitarDadosExcecao(tipo, idOrcamentoAtual, nmFuncao, idFuncao, idFuncionario, dataEspecifica) { 
    
    const mapaTipos = {
        "ADITIVO - DATA FORA DO ORÇAMENTO": "Aditivo - Datas fora do Orçamento",
        "ADITIVO - DATAS FORA DO ORÇAMENTO": "Aditivo - Datas fora do Orçamento",
        "ADITIVO - VAGA EXCEDIDA": "Aditivo - Vaga Excedida",
        "EXTRA BONIFICADO - DATA FORA DO ORÇAMENTO": "Extra Bonificado - Datas fora do Orçamento",
        "EXTRA BONIFICADO - DATAS FORA DO ORÇAMENTO": "Extra Bonificado - Datas fora do Orçamento",
        "EXTRA BONIFICADO - VAGA EXCEDIDA": "Extra Bonificado - Vaga Excedida"
    };

    // Tenta encontrar no mapa usando caixa alta, se não achar, usa o que veio
    const tipoPadronizado = mapaTipos[tipo.toUpperCase().trim()] || tipo;

    console.log("Tipo original:", tipo, "-> Tipo Padronizado:", tipoPadronizado);
    
    
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
    let dataReal = "";

    if (campoData && campoData._flatpickr && campoData._flatpickr.selectedDates.length > 0) {
        // Pega a primeira data selecionada no calendário
        dataReal = campoData._flatpickr.selectedDates[0].toLocaleDateString('en-CA'); // Retorna YYYY-MM-DD
    } else if (Array.isArray(dataEspecifica) && dataEspecifica.length > 0) {
        dataReal = dataEspecifica[0];
    } else if (typeof dataEspecifica === 'string' && dataEspecifica.length > 5) {
        dataReal = dataEspecifica;
    }

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
    const dataFormatada = dataReal.split('-').reverse().join('/'); 
    
    // ... segue para o seu Swal.fire usando a dataFormatada ...
    console.log("📅 Data utilizada no formulário:", dataFormatada);

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
        const resultado = await salvarSolicitacaoAditivoExtra(
            idOrcamentoAtual, 
            idFuncao,             
            1, // Qtd é sempre 1 por registro de data
            tipoPadronizado, 
            formValues.justificativa, 
            idFuncionario,
            dataReal // 🎯 NOVO PARÂMETRO
        );

        
        if (resultado.sucesso) {
            // 🎯 TRATAMENTO ESPECÍFICO PARA DATAS FORA DO ORÇAMENTO
            if (tipo.includes("Data fora do Orçamento")) {
                
                // 1. Removemos as datas excedentes do Flatpickr
                if (window.datasEventoPicker) {
                    const todasDatas = window.datasEventoPicker.selectedDates.map(d => d.toISOString().split('T')[0]);
                         
                    await Swal.fire({
                        icon: 'success',
                        title: 'Solicitação Enviada!',
                        html: `Sua solicitação de <b>${tipoPadronizado}</b> foi registrada.<br><br>` +
                              `<span style="color: #d33">Importante:</span> As datas fora do orçamento foram removidas da sua seleção atual e só poderão ser usadas após a aprovação.`,
                        confirmButtonText: 'OK'
                    });
                }
            } else {
                // Mensagem padrão para Vagas Excedidas ou outros tipos
                await Swal.fire({
                    icon: 'success',
                    title: 'Solicitação Enviada!',
                    text: `Sua solicitação de ${tipoPadronizado} foi registrada com sucesso.`,
                    confirmButtonText: 'OK'
                });
            }
        }
        else {
            await Swal.fire({
                icon: 'error',
                title: 'Falha na Solicitação',
                text: resultado.erro || 'Ocorreu um erro ao salvar.',
                confirmButtonText: 'Entendido'
            });
        }

        return resultado; // Mantém o retorno original para quem chamou a função
    }
    
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

// async function verificarStatusAditivoExtra(idOrcamentoAtual, idFuncaoDoFormulario, tipoSolicitacao, idFuncionario, nmFuncionario) {
    
//     console.log(`Verificando status para idOrcamento: ${idOrcamentoAtual}, idFuncao: ${idFuncaoDoFormulario}, tipoSolicitacao: ${tipoSolicitacao}, idFuncionario: ${idFuncionario}`);

//     const params = new URLSearchParams({
//         idOrcamento: idOrcamentoAtual,
//         idFuncao: idFuncaoDoFormulario,
//         tipoSolicitacao: tipoSolicitacao // ESSENCIAL para o backend filtrar
//     });
    
//     // 🎯 CORREÇÃO 1: Adiciona idFuncionario APENAS para FuncExcedido
//     if (tipoSolicitacao === 'FuncExcedido' && idFuncionario) {
//         params.append('idFuncionario', idFuncionario);
//     }
    
//     try {
//         // 2. CHAMA O ENDPOINT DE VERIFICAÇÃO
//         //const url = `/staff/aditivoextra/verificar-status?idOrcamento=${idOrcamento}&idFuncao=${idFuncao}`;
//         const url = `/staff/aditivoextra/verificar-status?${params.toString()}`;
//         console.log(`Buscando status em: ${url}`);
        
//         const response = await fetchComToken(url, {});
        
//         if (response.sucesso === false) {
//             Swal.fire('Erro!', `Não foi possível verificar o status atual: ${response.erro}`, 'error');
//             return false; // BLOQUEADO
//         }

//         const { solicitacaoRecente, totaisFuncao } = response.dados;
//         console.log("🔍 O que veio do banco:", solicitacaoRecente);
//         console.log("🔍 O que eu estou pedindo agora:", tipoSolicitacao);

//         console.log("Resposta da verificação de status:", response.dados);

//         // --- Etapa 1: Verificar Solicitação Recente (Pendente/Rejeitado) ---
//         if (solicitacaoRecente) {
//             const status = solicitacaoRecente.status;

//             console.log(`Verificando: Status(${status}) e Tipos(${solicitacaoRecente.tiposolicitacao} vs ${tipoSolicitacao})`);

//             // if (status === 'Pendente' && solicitacaoRecente.tiposolicitacao.trim() === tipoSolicitacao.trim()) {
//             //         let htmlMessage = '';
//             //         if (tipoSolicitacao.trim() === 'FuncExcedido') {
//             //             // Mensagem específica para 'FuncExcedido'
//             //             htmlMessage = `Já existe uma solicitação de <strong>Limite de Funções Diárias Excedidas</strong> pendente para o funcionário <strong>${nmFuncionario}</strong>. <br><br> Por favor, aguarde a <strong>Aprovação/Rejeição</strong> antes de solicitar novamente.`;
//             //         } else {
//             //             // Mensagem genérica para outros tipos (Aditivo, Extra Bonificado, etc.)
//             //             htmlMessage = `Já existe uma solicitação de <strong>${solicitacaoRecente.tiposolicitacao}</strong> com status <strong>Pendente</strong>. <br><br> Por favor, aguarde a <strong>Aprovação/Rejeição</strong> antes de solicitar novamente.`;
//             //         }
//             //         // --- Fim da lógica da mensagem ---

//             //         await Swal.fire({
//             //             title: 'Atenção!',
//             //             html: htmlMessage, // Usando a mensagem dinâmica
//             //             icon: 'info',
//             //             confirmButtonText: 'Entendi'
//             //         });
//             //         controlarBotaoSalvarStaff(false);
//             //         return false; // BLOQUEADO

//             //         // await Swal.fire({
//             //         //     title: 'Atenção!',
//             //         //     html: `Já existe uma solicitação de <strong>${solicitacaoRecente.tiposolicitacao}</strong> com status <strong>Pendente</strong>. <br><br> Por favor, aguarde a <strong>Aprovação/Rejeição</strong> antes de solicitar novamente.`,
//             //         //     icon: 'info',
//             //         //     confirmButtonText: 'Entendi'
//             //         // });
//             //         // controlarBotaoSalvarStaff(false); // Reativa o botão Salvar
//             //         // return false; // BLOQUEADO
//             //         //return { encontrado: true, status: 'Pendente' };
//             //    // } 
//             // }

//             if (status === 'Pendente' && solicitacaoRecente.tiposolicitacao.trim() === tipoSolicitacao.trim()) {
//                 let htmlMessage = (tipoSolicitacao.trim() === 'FuncExcedido') 
//                     ? `Já existe uma solicitação de <strong>Limite de Funções Diárias Excedidas</strong> pendente para o funcionário <strong>${nmFuncionario}</strong>...`
//                     : `Já existe uma solicitação de <strong>${solicitacaoRecente.tiposolicitacao}</strong> com status <strong>Pendente</strong>...`;

//                 await Swal.fire({
//                     title: 'Atenção!',
//                     html: htmlMessage,
//                     icon: 'info',
//                     confirmButtonText: 'Entendi'
//                 });
                
//                 controlarBotaoSalvarStaff(false);
                
//                 // IMPORTANTE: Retornar um objeto que indique claramente o bloqueio
//                 return { bloqueado: true, status: 'Pendente' }; 
//             }

//             if (status === 'Rejeitado' && solicitacaoRecente.tiposolicitacao.trim() === tipoSolicitacao.trim()) {
//                 //const tipoRejeitado = solicitacaoRecente.tipoSolicitacao; 

//                 const result = await Swal.fire({
//                     title: 'Solicitação Rejeitada!',
//                     html: `A última solicitação (${solicitacaoRecente.idAditivoExtra} de <strong>${solicitacaoRecente.tiposolicitacao}</strong>) foi <strong>Rejeitada</strong>. <br><br> Deseja fazer uma nova solicitação?`,
//                     icon: 'warning',
//                     showCancelButton: true,
//                     confirmButtonText: 'Sim, Nova Solicitação',
//                     cancelButtonText: 'Não, Cancelar'
//                 });
                
//                 if (!result.isConfirmed) {
//                     return false; // BLOQUEADO
//                 }
//             }
//         }

//         // --- Etapa 2: Verificar Capacidade Total (Aprovado/Preenchido) ---
//         if (totaisFuncao) {
//             const { totalOrcado, totalAditivoAprovado, totalExtraAprovado, totalVagasPreenchidas } = totaisFuncao;
            
//             // ⚠️ CÁLCULO CORRIGIDO: Limite é a soma do Orçado + Aditivos Aprovados
//             const limiteTotalAprovado = totalOrcado + totalAditivoAprovado + totalExtraAprovado;

//             let limiteMaximo;
            
//             // Define o limite com base no tipo de solicitação (ou no limite total se for FuncExcedido)
//             if (tipoSolicitacao === 'Aditivo') {
//                 // Se estamos solicitando Aditivo, o limite é o orçado + Aditivos Aprovados (Exclui o Extra se for separado)
//                 limiteMaximo = totalOrcado + totalAditivoAprovado; 
//             } else if (tipoSolicitacao === 'Extra') {
//                 // Se estamos solicitando Extra, o limite é o orçado + Extras Aprovados (Exclui o Aditivo se for separado)
//                 limiteMaximo = totalOrcado + totalExtraAprovado; 
//             } else if (tipoSolicitacao === 'FuncExcedido') {
//                 // 🎯 NOVO TRATAMENTO: FuncExcedido deve respeitar o limite MÁXIMO (todos os aprovados)
//                 limiteMaximo = limiteTotalAprovado; 
//             } else {
//                  limiteMaximo = totalOrcado; // Default para segurança
//             }

//             // Verifica se as vagas aprovadas (Limite Máximo) já foram preenchidas
//             if (totalVagasPreenchidas >= limiteMaximo) {
                
//                 const vagasDisponiveis = limiteMaximo - totalVagasPreenchidas;
                
//                 const result = await Swal.fire({
//                     title: `Confirmação da Solicitação de ${tipoSolicitacao}!`,
//                     // Garante que o tipoSolicitacao seja usado na mensagem
//                     html: `As <strong>${limiteMaximo} vagas</strong> (Orçado + Aprovados) para esta função já foram preenchidas (${totalVagasPreenchidas} staff alocados). <br><br> Confirma solicitação um <strong>novo ${tipoSolicitacao}</strong>?`,
//                     icon: 'warning',
//                     showCancelButton: true,
//                     confirmButtonText: 'Sim, Solicitar Mais',
//                     cancelButtonText: 'Não, Cancelar'
//                 });

//                 if (!result.isConfirmed) {
//                     return false; // BLOQUEADO
//                 }
//             }
//         }
        
//         // --- Etapa Final: Se passou por todas as verificações, prossegue para solicitar a QTD ---
//         // (Aqui, você pode optar por enviar o totalVagasPreenchidas e limiteMaximo para solicitarDadosExcecao)
//         //return solicitarDadosExcecao(tipoSolicitacao, idOrcamento, idFuncao, idEmpresaAtual); 
//         return {
//             encontrado: solicitacaoRecente !== null,
//             status: solicitacaoRecente ? solicitacaoRecente.status : null,
//             detalhes: solicitacaoRecente,
//             totaisFuncao: totaisFuncao
//         };

//     } catch (error) {
//         console.error("Erro na verificação de status AditivoExtra:", error);
//         // Em caso de erro, bloqueia o fluxo.
//         Swal.fire('Erro Inesperado!', `Ocorreu um erro ao verificar o status. Detalhe: ${error.message}`, 'error');
//         return false;
//     }
// }

//atualizado em 28/01 para tratar bloqueios de aditivo/extra 
// async function verificarStatusAditivoExtra(idOrcamentoAtual, idFuncaoDoFormulario, tipoSolicitacao, idFuncionario, nmFuncionario) {
    
//     console.log(`Verificando status para idOrcamento: ${idOrcamentoAtual}, idFuncao: ${idFuncaoDoFormulario}, tipoSolicitacao: ${tipoSolicitacao}, idFuncionario: ${idFuncionario}`);

//     if (!idOrcamentoAtual || !idFuncaoDoFormulario) {
//         console.warn("⚠️ Abortando verificação: ID do Orçamento ou da Função está faltando.");
//         return { bloqueado: false }; 
//     }

//     const params = new URLSearchParams({
//         idOrcamento: idOrcamentoAtual,
//         idFuncao: idFuncaoDoFormulario,
//         tipoSolicitacao: tipoSolicitacao 
//     });
    
//     if (tipoSolicitacao === 'FuncExcedido' && idFuncionario) {
//         params.append('idFuncionario', idFuncionario);
//     }
    
//     const formatarTipo = (tipo) => {
//             if (tipo === 'FuncExcedido') return `Limite de Funções Diárias Excedidas para o Funcionário <strong>${nmFuncionario}</strong>`;
//             if (tipo === 'ExtraBonificado') return `<strong>EXTRA BONIFICADO</strong>`;
//             if (tipo === 'Aditivo') return `<strong>ADITIVO</strong>`;
//             return `<strong>${tipo}</strong>`;
//     };

//     try {
//         const url = `/staff/aditivoextra/verificar-status?${params.toString()}`;
//         const response = await fetchComToken(url, {});
        
//         if (response.sucesso === false) {
//             Swal.fire('Erro!', `Não foi possível verificar o status atual: ${response.erro}`, 'error');
//             return { bloqueado: true }; 
//         }

//         const { solicitacaoRecente, totaisFuncao } = response.dados;
//         const tipoAtual = tipoSolicitacao.trim();

//         // --- Etapa 1: Verificar Solicitação Recente (Pendente / Autorizado / Rejeitado) ---
//         const tipoFormatado = formatarTipo(tipoSolicitacao);

//         console.log("Resposta da verificação de status:", solicitacaoRecente);
//         if (solicitacaoRecente) {
//             const status = solicitacaoRecente.status;
            

//             // 1. CASO PENDENTE (Bloqueio Total)
//             if (status === 'Pendente') {
//                 await Swal.fire({
//                     icon: 'warning',
//                     title: 'Solicitação Pendente!',
//                     html: `Já existe uma solicitação de ${tipoFormatado} para a função <strong>${nmFuncaoDoFormulario}</strong> com status <strong>Pendente</strong>. <br><br> Por favor, aguarde a aprovação antes de tentar novamente.`,
//                     confirmButtonText: 'Entendi'
//                 });
//                 return { bloqueado: true, status: 'Pendente' };
//             }

//             // 2. CASO AUTORIZADO (Pergunta se deseja nova)
//             if (status === 'Autorizado') {
//                 const result = await Swal.fire({
//                     icon: 'question',
//                     title: 'Já Autorizado!',
//                     html: `Já existe uma solicitação de ${tipoFormatado} para a função <strong>${nmFuncaoDoFormulario}</strong> com status <strong>Autorizado</strong>. <br><br> Deseja fazer uma nova solicitação mesmo assim?`,
//                     showCancelButton: true,
//                     confirmButtonText: 'Sim, Nova Solicitação',
//                     cancelButtonText: 'Não, Cancelar',
//                     confirmButtonColor: '#28a745',
//                     cancelButtonColor: '#d33'
//                 });

//                 if (!result.isConfirmed) return { bloqueado: true, status: 'Autorizado' };
//             }

//             // 3. CASO REJEITADO (Pergunta se deseja tentar nova)
//             if (status === 'Rejeitado') {
//                 const result = await Swal.fire({
//                     icon: 'warning',
//                     title: 'Solicitação Rejeitada!',
//                     html: `A última solicitação de ${tipoFormatado} para a função <strong>${nmFuncaoDoFormulario}</strong> foi <strong>Rejeitada</strong>. <br><br> Deseja tentar fazer uma nova solicitação?`,
//                     showCancelButton: true,
//                     confirmButtonText: 'Sim, Nova Solicitação',
//                     cancelButtonText: 'Não, Cancelar'
//                 });
                
//                 if (!result.isConfirmed) return { bloqueado: true, status: 'Rejeitado' };
//             }
//         }

//         // --- Etapa 2: Verificar Capacidade Total (Aprovado/Preenchido) ---
//         if (totaisFuncao) {
//             const { totalOrcado, totalAditivoAprovado, totalExtraAprovado, totalVagasPreenchidas } = totaisFuncao;
//             const limiteTotalAprovado = totalOrcado + totalAditivoAprovado + totalExtraAprovado;

//             let limiteMaximo;
//             if (tipoSolicitacao === 'Aditivo') {
//                 limiteMaximo = totalOrcado + totalAditivoAprovado; 
//             } else if (tipoSolicitacao === 'Extra' || tipoSolicitacao === 'ExtraBonificado') {
//                 limiteMaximo = totalOrcado + totalExtraAprovado; 
//             } else if (tipoSolicitacao === 'FuncExcedido') {
//                 limiteMaximo = limiteTotalAprovado; 
//             } else {
//                  limiteMaximo = totalOrcado;
//             }

//             if (totalVagasPreenchidas >= limiteMaximo) {
//                 const result = await Swal.fire({
//                     title: `Vagas Preenchidas!`,
//                     html: `As <strong>${limiteMaximo} vagas</strong> aprovadas para esta função já foram ocupadas. <br><br> Confirma o envio de uma solicitação de <strong>novo ${tipoSolicitacao}</strong>?`,
//                     icon: 'warning',
//                     showCancelButton: true,
//                     confirmButtonText: 'Sim, Solicitar',
//                     cancelButtonText: 'Não, Cancelar'
//                 });

//                 if (!result.isConfirmed) {
//                     return { bloqueado: true };
//                 }
//             }
//         }
        
//         // Se chegou aqui, não está bloqueado
//         return {
//             bloqueado: false,
//             encontrado: solicitacaoRecente !== null,
//             status: solicitacaoRecente ? solicitacaoRecente.status : null,
//             detalhes: solicitacaoRecente,
//             totaisFuncao: totaisFuncao
//         };

//     } catch (error) {
//         console.error("Erro na verificação de status AditivoExtra:", error);
//         Swal.fire('Erro!', `Ocorreu um erro ao verificar o status.`, 'error');
//         return { bloqueado: true };
//     }
// }

//atualizado em 29/01 para tratar aditivo/extra bonificado
async function verificarStatusAditivoExtra(idOrcamentoAtual, idFuncaoDoFormulario, tipoSolicitacao, idFuncionario, nmFuncionario, nmFuncao, dataEspecifica, idEventoSolicitado, idEventoConflitante) {
    
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
            let statusTexto = `<strong style="color: #ffc107;">"PENDENTE"</strong>`;
            let funcaoTexto = `<strong>${nmFuncaoInput || 'Não informada'}</strong>`;
            
            return { textoBase, statusTexto, funcaoTexto, nomeLimpo: nomeExibicao };
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
                    mensagemHtml = `Você já tem uma solicitação de ${infoMsg.textoBase} com status ${infoMsg.statusTexto} ` +
                                   `para a função de ${infoMsg.funcaoTexto} para esse mesmo Funcionário: <strong>"${nmFuncionarioDono}"</strong>` +
                                   `<hr>` +                                
                                   `<strong>Aguarde a análise do gestor</strong> antes de tentar realizar o cadastro novamente.`;
                } else {
                    mensagemHtml = `Já existe uma solicitação de ${infoMsg.textoBase} com status ${infoMsg.statusTexto}, ` +
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
                    html: `As <strong>${limiteMaximo} vagas</strong> (Orçado + Aprovados) para esta função já foram preenchidas (${totalVagasPreenchidas} staff alocados). <br><br> Confirma solicitação um <strong>novo ${tipoSolicitacao}</strong>?`,
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


async function salvarSolicitacaoAditivoExtra(idOrcamentoAtual, idFuncaoDoFormulario, qtd, tipo, justificativa, idFuncionario, dataSolicitada, idEventoSolicitado, idEventoConflitante) {
    console.log("AJAX: Tentando salvar solicitação:", { idOrcamentoAtual, idFuncaoDoFormulario, qtd, tipo, justificativa, idFuncionario, dataSolicitada, idStaffEvento });
    const tipoPadronizado = tipo ? tipo.toUpperCase().trim() : "";
    const quantidadeGarantida = (qtd && qtd > 0) ? qtd : 1;
    const datasFormatadas = Array.isArray(dataSolicitada) ? dataSolicitada.join(',') : dataSolicitada;

    // Objeto de dados a ser enviado
    const dadosParaEnvio = { 
        idOrcamento: idOrcamentoAtual, 
        idFuncao: idFuncaoDoFormulario,
        qtdSolicitada: quantidadeGarantida, 
        tipoSolicitacao: tipoPadronizado, 
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
    if (typeof mostrarTarja === 'function') {
        mostrarTarja();
    }
    
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

function preencherDatasEventoFlatpickr(dataeventos) {
    if (window.datasEventoPicker) {
        if (Array.isArray(dataeventos)) {
            window.datasEventoPicker.setDate(dataeventos, true);
            console.log("[preencherDatasEventoFlatpickr] Datas preenchidas no Flatpickr:", dataeventos);
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