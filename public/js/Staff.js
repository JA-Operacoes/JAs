import { fetchComToken, aplicarTema  } from '../utils/utils.js';

let statusAditivoFinal = null; // Usar null em vez de '' para campos vazios
let statusExtraBonificadoFinal = null;
let permitirCadastro = false;
let nmFuncaoDoFormulario = '';

let decisaoUsuarioDataFora = null;

// Crie uma flag global para rastrear se o evento foi capturado
let prefillEventFired = false; 

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
    console.log("Configurando Flatpickrs..."); 
    
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
                        }, true);
                    }
                }
            },

            onReady: (selectedDates, dateStr, instance) => {
                setTimeout(() => {
                    formatInputTextWithStatus(instance, datasDobrada); 
                }, 0);
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
                diariaDobradacheck.checked = instance.selectedDates.length > 0;
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
                        }, true);
                    }
                }
            },
            onReady: (selectedDates, dateStr, instance) => {
                setTimeout(() => {
                    formatInputTextWithStatus(instance, datasMeiaDiaria);
                }, 0);
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

                meiaDiariacheck.checked = instance.selectedDates.length > 0;
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
const alimentacaoInput = document.getElementById('alimentacao');
const statusPgtoAjudaCustoInput = document.getElementById('statusPgtoAjudaCusto');
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
const campoPgtoCaixinha = document.getElementById('campoPgtoCaixinha');
const descCaixinhaTextarea = document.getElementById('descCaixinha');
const campoStatusCaixinha = document.getElementById('campoStatusCaixinha');
const statusCaixinhaInput = document.getElementById('statusCaixinha');
const selectStatusCaixinha = document.getElementById('selectStatusCaixinha');
const statusPgtoCaixinhaInput = document.getElementById('statusPgtoCaixinha');

const setorInput = document.getElementById('setor');

const statusPagtoInput = document.getElementById('statusPgto');

const temPermissaoMaster = temPermissao("Staff", "master");
const temPermissaoFinanceiro = temPermissao("Staff", "financeiro");
const temPermissaoTotal = (temPermissaoMaster && temPermissaoFinanceiro);

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

const qtdPessoasInput = document.getElementById('qtdPessoas');

const idEquipeInput = document.getElementById('idEquipe');
const nmEquipeSelect = document.getElementById('nmEquipe'); // Select de Equipe

const DescViagem1 = "[Viagem Fora SP] Valor Alimentação referente a Almoço e Jantar por ser fora de São Paulo"; 
const DescViagem2 = "[Viagem Fora SP] Valor Alimentação referente a Café da Manhã, Almoço e Jantar por ser fora de São Paulo"; 
const DescViagem3 = "[Viagem Fora SP] Valor Alimentação e Transporte para Funcionário Local";


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

// A sua função principal de carregamento de dados
const carregarDadosParaEditar = (eventData, bloquear) => {
    console.log("Objeto eventData recebido:", eventData);
    console.log("Valor de dtdiariadobrada:", eventData.dtdiariadobrada);    

    const btn = document.getElementById('Enviar');
    const fieldsetEvento = document.getElementById('containerFieldsets');
    
    // 1. Lógica do Botão Enviar
    if (btn) {
        const precisaComprovante = verificarNecessidadeComprovante(eventData);
        // Se for financeiro (bloquear=true) mas precisa de comprovante, o botão DEVE aparecer
        if (bloquear && !precisaComprovante) {
            btn.style.display = 'none';
            btn.disabled = true;
        } else {
            btn.style.display = 'block';
            btn.disabled = false;
        }
    }

    
    if (fieldsetEvento) {
        const camposParaTravar = fieldsetEvento.querySelectorAll('input:not([type="file"]), select, textarea');
        
        camposParaTravar.forEach(campo => {
            // --- NOVA TRAVA DE SEGURANÇA ---
            // Se o campo tiver o atributo de readonly permanente, ignoramos ele no loop
            if (campo.hasAttribute('data-permanent-readonly')) {
                campo.readOnly = true;
                campo.style.cursor = 'default'; // ou 'not-allowed' se preferir
                return; // Pula para o próximo campo sem alterar este
            }

            if (campo.id === 'check50' || campo.id === 'check100') {
                return;
            }

            if (bloquear) {
                campo.readOnly = true; 
                if (campo.tagName === 'SELECT' || campo.type === 'checkbox') {
                    campo.disabled = true;
                }
                campo.style.cursor = 'not-allowed';
            } else {
                campo.readOnly = false;
                campo.disabled = false;
                campo.style.backgroundColor = '';
                campo.style.cursor = '';
            }
        });
    }

    // 3. Liberar apenas os Uploads Necessários (Financeiro)
    // Chamamos a função que você já tem ou a lógica de habilitar file inputs
    configurarUploadsFinanceiro(eventData);


    retornoDados = true;
    limparCamposEvento();
    currentEditingStaffEvent = eventData;
    isFormLoadedFromDoubleClick = true;

    const uploadHeaderDiv = document.getElementById('uploadHeader');
    const uploadContainer = document.querySelector("#upload-container");
    const fileInput = document.getElementById('file');

    if (uploadHeaderDiv) uploadHeaderDiv.style.display = 'none';
    if (uploadContainer) uploadContainer.style.display = 'none';
    if (fileInput) fileInput.disabled = true;

    // Carregando dados básicos nos inputs do formulário.
    idStaffInput.value = eventData.idstaff || '';
    idStaffEventoInput.value = eventData.idstaffevento;
    idFuncaoInput.value = eventData.idfuncao;
    idClienteInput.value = eventData.idcliente;
    idEventoInput.value = eventData.idevento;
    idFuncionarioHiddenInput.value = eventData.idfuncionario || '';   
    idEquipeInput.value = eventData.idequipe || '';


    const valorAjudaCustoViagem = eventData.tipoajudacustoviagem; // Esse é o 1, 2 ou 3

    document.getElementById('viagem1Check').checked = (valorAjudaCustoViagem === 1);
    document.getElementById('viagem2Check').checked = (valorAjudaCustoViagem === 2);
    document.getElementById('viagem3Check').checked = (valorAjudaCustoViagem === 3);

    if (containerDiariaDobradaCheck) {
        containerDiariaDobradaCheck.style.display = 'block';
        containerStatusDiariaDobrada.style.display = 'block';
    }
    if (containerMeiaDiariacheck) {
        containerMeiaDiariacheck.style.display = 'block';
        containerStatusMeiaDiaria.style.display = 'block';
    }

  //  if (descFuncaoSelect) descFuncaoSelect.value = eventData.idfuncao || '';

    if (descFuncaoSelect) {
        descFuncaoSelect.value = eventData.idfuncao || '';
        
        // --- NOVO PASSO: Garante que os valores de almoço e alimentacao sejam carregados na edição ---
        // Pega a opção selecionada no dropdown de função
        const selectedOption = descFuncaoSelect.options[descFuncaoSelect.selectedIndex];

        // Se uma opção válida for encontrada, atualiza as variáveis globais
        if (selectedOption) {//AQUI QUE TEMOS QUE FAZER A CORREÇÃO CARREGANDO OS VALORES CORRETOS
            //vlrAlimentacaoDobra = parseFloat(selectedOption.getAttribute("data-alimentacao")) || 0;
            vlrAlimentacaoDobra = parseFloat(eventData.vlralimentacao) || 0;

            console.log("Valores de Almoço e Jantar carregados para edição:", vlrAlimentacaoDobra);
        }
    }


    if (nmClienteSelect) nmClienteSelect.value = eventData.idcliente || '';
    if (nmEventoSelect) nmEventoSelect.value = eventData.idevento || '';
    

    
    const equipeId = eventData.idequipe || '';
    
    const nomeEquipe = eventData.nmequipe || 'Equipe não informada'; 
    
    if (nmEquipeSelect) {
        // Agora, o input readonly nmEquipeSelect recebe o NOME (string) para exibição.
        nmEquipeSelect.value = nomeEquipe; 
    }
    
    // Atualiza os console.logs para exibir o nome.
    console.log("ID da Equipe:", equipeId);
    console.log("Nome da Equipe (nmEquipe):", nomeEquipe); 
    // 🌟 FIM DA CORREÇÃO

    // Lógica para preencher Local de Montagem e Pavilhão.
    if (nmLocalMontagemSelect) {
        nmLocalMontagemSelect.value = eventData.idmontagem || '';
        nmLocalMontagemSelect.dispatchEvent(new Event('change'));

        // setTimeout(() => {
        //     if (nmPavilhaoSelect) {
        //         const historicalPavilhaoName = eventData.pavilhao || '';
        //         let selected = false;
        //         for (let i = 0; i < nmPavilhaoSelect.options.length; i++) {
        //             if (nmPavilhaoSelect.options[i].textContent.toUpperCase().trim() === historicalPavilhaoName.toUpperCase().trim()) {
        //                 nmPavilhaoSelect.value = nmPavilhaoSelect.options[i].value;
        //                 selected = true;
        //                 break;
        //             }
        //         }
        //         if (!selected && historicalPavilhaoName) {
        //             const tempOption = document.createElement('option');
        //             tempOption.value = historicalPavilhaoName;
        //             tempOption.textContent = `${historicalPavilhaoName} (Histórico)`;
        //             nmPavilhaoSelect.prepend(tempOption);
        //             nmPavilhaoSelect.value = historicalPavilhaoName;
        //         } else if (!historicalPavilhaoName) {
        //             nmPavilhaoSelect.value = '';
        //         }
        //     }
        // }, 200);

        // O timeout é usado para garantir que carregarPavilhaoStaff() tenha terminado de preencher as opções
        setTimeout(() => {
            const nmPavilhaoSelect = document.getElementById('nmPavilhao');
            const inputHiddenPavilhao = document.getElementById('idPavilhao');

            if (nmPavilhaoSelect) {
                const historicalPavilhaoString = eventData.pavilhao || '';
                
                // 1. Processar a string salva do banco em um array de nomes
                const savedPavilhaoNames = historicalPavilhaoString
                    .split(',')
                    .map(name => name.trim().toUpperCase())
                    .filter(name => name.length > 0); 

                // 2. Limpar todas as seleções anteriores (essencial para selects múltiplos)
                Array.from(nmPavilhaoSelect.options).forEach(option => {
                    option.selected = false;
                });

                // 3. Iterar e selecionar os pavilhões
                for (let i = 0; i < nmPavilhaoSelect.options.length; i++) {
                    const option = nmPavilhaoSelect.options[i];
                    const optionText = option.textContent.trim().toUpperCase();
                    
                    // Verifica se o texto da opção está contido na lista de nomes salvos
                    if (savedPavilhaoNames.includes(optionText)) {
                        option.selected = true;
                    }
                }

                // 4. Preencher o input hidden com a string completa salva
                // Isso garante que o valor correto seja enviado se o usuário não fizer alterações.
                if (inputHiddenPavilhao) {
                    inputHiddenPavilhao.value = historicalPavilhaoString;
                }

                console.log("Pavilhões selecionados com base nos dados históricos:", historicalPavilhaoString); 

            }
        }, 200);

    } else {
        if (nmPavilhaoSelect) {
            nmPavilhaoSelect.innerHTML = `<option value="${eventData.pavilhao || ''}">${eventData.pavilhao || 'Selecione Pavilhão'}</option>`;
            nmPavilhaoSelect.value = eventData.pavilhao || '';
        }
    }    

    qtdPessoasInput.value = parseInt(eventData.qtdpessoaslote || 0);

    // Preenchendo campos financeiros e de custo.
    vlrCustoInput.value = parseFloat(eventData.vlrcache || 0).toFixed(2).replace('.', ',');
    transporteInput.value = parseFloat(eventData.vlrtransporte || 0).toFixed(2).replace('.', ',');  
    alimentacaoInput.value = parseFloat(eventData.vlralimentacao || 0).toFixed(2).replace('.', ',');
    statusPgtoAjudaCustoInput.value = eventData.statuspgtoajdcto.toUpperCase() || '';
    
    descBeneficioTextarea.value = eventData.descbeneficios || '';

    ajusteCustoInput.value = parseFloat(eventData.vlrajustecusto || 0).toFixed(2).replace('.', ',');
    ajusteCustoTextarea.value = eventData.descajusteCusto || '';
    statusAjusteCustoInput.value = eventData.statusajustecusto;

    caixinhaInput.value = parseFloat(eventData.vlrcaixinha || 0).toFixed(2).replace('.', ',');
    descCaixinhaTextarea.value = eventData.desccaixinha || '';
    statusCaixinhaInput.value = eventData.statuscaixinha;
    statusPgtoCaixinhaInput.value = (eventData.statuspgtocaixinha?.toUpperCase()) || '';

    vlrTotalInput.value = parseFloat(eventData.vlrtotal || 0).toFixed(2).replace('.', ',');

    console.log("VALOR TOTAL", vlrTotalInput.value);
    setorInput.value = eventData.setor.toUpperCase() || '';
    statusPagtoInput.value = eventData.statuspgto.toUpperCase() || '';


    // Lógica para checkboxes de Bônus e Caixinha
    if (ajusteCustocheck) {
        ajusteCustocheck.checked = parseFloat(eventData.vlrajustecusto || 0);

        console.log("AJUSTE DE CUSTO", ajusteCustocheck, eventData.vlrajustecusto);

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
        campoPgtoCaixinha.style.display = caixinhacheck.checked ? 'block' : 'none';
        descCaixinhaTextarea.style.display = caixinhacheck.checked ? 'block' : 'none';
        descCaixinhaTextarea.required = caixinhacheck.checked;
        descCaixinhaTextarea.value = eventData.desccaixinha || '';
    }

    // Lógica para Comprovantes 50% e 100%
    if (temPermissaoFinanceiro ) {
        const comp50Preenchido = eventData.comppgtoajdcusto50 && eventData.comppgtoajdcusto50.length > 0;
        const comp100Preenchido = eventData.comppgtoajdcusto && eventData.comppgtoajdcusto.length > 0;

        check50.checked = comp50Preenchido;
        check100.checked = comp100Preenchido;

        container1.style.display = check100.checked ? 'flex' : 'none';
        container2.style.display = check50.checked ? 'flex' : 'none';

        
    }

    const statusPagtoValue = statusPagtoInput.value.toUpperCase();
    statusPagtoInput.classList.remove('pendente', 'pago', 'suspenso');
    if (statusPagtoValue === "PENDENTE") {
        statusPagtoInput.classList.add('pendente');
    } else if (statusPagtoValue === "PAGO") {
        statusPagtoInput.classList.add('pago');
    }else if (statusPagtoValue === "SUSPENSO") {
        statusPagtoInput.classList.add('suspenso');
    }

    const statusPgtoCxValue = statusPgtoCaixinhaInput.value.toUpperCase();
    statusPgtoCaixinhaInput.classList.remove('pendente', 'pago', 'suspenso');
    if (statusPgtoCxValue === "PENDENTE") {
        statusPgtoCaixinhaInput.classList.add('pendente');
    } else if (statusPgtoCxValue === "PAGO") {
        statusPgtoCaixinhaInput.classList.add('pago');
    }else if (statusPgtoCxValue === "SUSPENSO") {
        statusPgtoCaixinhaInput.classList.add('suspenso');
    }

    const statusPgtoAjdCtoValue = statusPgtoAjudaCustoInput.value.toUpperCase();
    statusPgtoAjudaCustoInput.classList.remove('pendente', 'pago', 'pago50', 'suspenso');
    if (statusPgtoAjdCtoValue === "PENDENTE") {
        statusPgtoAjudaCustoInput.classList.add('pendente');
    } else if (statusPgtoAjdCtoValue === "PAGO") {
        statusPgtoAjudaCustoInput.classList.add('pago');
    }else if (statusPgtoAjdCtoValue === "PAGO50") {
        statusPgtoAjudaCustoInput.value = "PAGO 50%";
        statusPgtoAjudaCustoInput.classList.add('pago50');
    }else if (statusPgtoAjdCtoValue === "SUSPENSO") {
        statusPgtoAjudaCustoInput.classList.add('suspenso');
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

    preencherComprovanteCampo(eventData.comppgtocache, 'Cache');
    preencherComprovanteCampo(eventData.comppgtoajdcusto, 'AjdCusto');
    preencherComprovanteCampo(eventData.comppgtoajdcusto50, 'AjdCusto2');
    preencherComprovanteCampo(eventData.comppgtocaixinha, 'Caixinha');

    // --- PONTO CHAVE: Chama a nova função para lidar com os Flatpickrs ---
    inicializarEPreencherCampos(eventData);
    atualizarContadorDatas();

    const pickers = [
        window.datasEventoPicker,
        window.diariaDobradaPicker,
        window.meiaDiariaPicker
    ];

    pickers.forEach(p => alternarBloqueioFlatpickr(p, bloquear));

    
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

/**
 * Inicializa e preenche os campos do formulário com os dados de um evento.
 * Esta versão garante que as datas e o status apareçam corretamente no campo de entrada
 * na carga inicial, após seleção de datas e após o fechamento do calendário.
 * @param {object} eventData - O objeto de dados do evento contendo as datas e status.
 */
function inicializarEPreencherCampos(eventData) {
    console.log("Inicializando Flatpickrs com dados de evento...");

    // **PASSO 1: DESTRUIR INSTÂNCIAS ANTERIORES**
    // Isso evita que eventos e configurações dupliquem ao recarregar o formulário.
    if (window.diariaDobradaPicker) window.diariaDobradaPicker.destroy();
    if (window.meiaDiariaPicker) window.meiaDiariaPicker.destroy();
    if (window.datasEventoPicker) window.datasEventoPicker.destroy();

    configurarFlatpickrs();

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
    //containerStatusDiariaDobrada.style.display = diariaDobradacheck.checked ? 'flex' : 'none';

    meiaDiariacheck.checked = datesMeiaDiaria.length > 0;
    campoMeiaDiaria.style.display = meiaDiariacheck.checked ? 'block' : 'none';
    campoStatusMeiaDiaria.style.display = meiaDiariacheck.checked ? 'block' : 'none';
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
        document.getElementById('selectStatusAjusteCusto').value = eventData.statusajustecusto || '';
        console.log("VALOR DO STATUS AJUSTE CUSTO:", eventData.statusajustecusto);
        aplicarCoresAsOpcoes('selectStatusAjusteCusto');
        aplicarCorNoSelect(document.getElementById('selectStatusAjusteCusto'));

        document.getElementById('selectStatusCaixinha').style.display = 'block';
        statusCaixinhaInput.style.display = 'none';
        document.getElementById('selectStatusCaixinha').value = eventData.statuscaixinha || '';
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
           
        console.log("NÃO É MASTER");
        document.getElementById('selectStatusAjusteCusto').style.display = 'none';
        statusAjusteCustoInput.style.display = 'block';
        console.log("STATUS AJUSTE CUSTO SEM PERMISSAO TOTAL", eventData.statusajustecusto);

        // CORREÇÃO AQUI: use 'statusajustecusto' (tudo minúsculo)
        statusAjusteCustoInput.value = eventData.statusajustecusto || ''; 
        aplicarCorStatusInput(statusAjusteCustoInput);

        document.getElementById('selectStatusCaixinha').style.display = 'none';
        statusCaixinhaInput.style.display = 'block';
        statusCaixinhaInput.value = eventData.statuscaixinha || '';
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
                const temValoresNoBanco = 
                    eventData.vlrtotajdcusto !== undefined && eventData.vlrtotajdcusto !== null && parseFloat(eventData.vlrtotajdcusto) !== 0 &&
                    eventData.vlrtotcache !== undefined && eventData.vlrtotcache !== null && parseFloat(eventData.vlrtotcache) !== 0;

                if (temValoresNoBanco) {
                    totais = {
                        qtdDias: qtdDiasCalculada, 
                        totalAjdCusto: parseFloat(eventData.vlrtotajdcusto),
                        totalCache: parseFloat(eventData.vlrtotcache),
                        vlrDobraCalculado: parseFloat(eventData.vlrtotdiariadobrada || 0),
                        vlrMeiaCalculada: parseFloat(eventData.vlrtotmeiadiaria || 0),
                        totalGeral: parseFloat(eventData.vlrtotgeral || 0)
                    };
                } else {
                    totais = calcularTotaisLinha(eventData);
                    totais.qtdDias = qtdDiasCalculada; // Garante consistência
                }

                
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


                const bloqueioParcial = !temPermissaoTotal && (statusAjd === "pago" || statusCache === "pago" || statusCxnha === "pago");

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

                

                // CAIXINHA
                // const vlrCaixinha = parseFloat(eventData.vlrcaixinha || 0);
                // const vlrCaixinhaCell = row.insertCell();

                // if (vlrCaixinha > 0) {
                //     vlrCaixinhaCell.textContent = vlrCaixinha.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                    
                //     // AQUI permanece a lógica de classe CSS conforme solicitado
                //     if (eventData.statuscaixinha && eventData.statuscaixinha.trim() !== "") {
                //         const sCaixinha = eventData.statuscaixinha.toLowerCase().trim();
                //         const spanCxn = document.createElement('span');
                //         spanCxn.textContent = ` (${eventData.statuscaixinha})`;
                //         spanCxn.classList.add('status-custom', `statusStaff-${sCaixinha}`);
                //         vlrCaixinhaCell.appendChild(spanCxn);
                //     }
                // } else {
                //     vlrCaixinhaCell.textContent = "---";
                // }

                

                // // STATUS CAIXINHA
                // const statusCaixinhaCell = row.insertCell();
                // if (vlrCaixinha > 0) {
                //     const sCaixinha = (eventData.statuscaixinha || '').toLowerCase().trim();
                //     const spanCaixinha = document.createElement('span');
                //     spanCaixinha.textContent = sCaixinha.toUpperCase();
                //     spanCaixinha.classList.add('status-pgto', sCaixinha);
                //     statusCaixinhaCell.appendChild(spanCaixinha);
                // } else {
                //     statusCaixinhaCell.textContent = '---';
                // }

                const statusCaixinhaCell = row.insertCell();
                const vlrCaixinhaCell = parseFloat(eventData.vlrcaixinha || 0);

                if (vlrCaixinhaCell > 0) {
                    const sCaixinha = (eventData.statuscaixinha || '').toLowerCase().trim();
                    const spanCaixinha = document.createElement('span');
                    
                    spanCaixinha.textContent = sCaixinha === "" ? "PENDENTE" : sCaixinha.toUpperCase();
                    
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

const calcularTotaisLinha = (eventData) => {
    const vlrCache = parseFloat(eventData.vlrcache || 0);
    const vlrAlim = parseFloat(eventData.vlralimentacao || 0);
    const vlrTransp = parseFloat(eventData.vlrtransporte || 0);
    const qtdpessoas = parseInt(eventData.qtdpessoaslote || 1);
    const multiplicador = (eventData.perfil === "Lote") ? qtdpessoas : 1;
    const vlrAlimExtra = parseFloat(eventData.vlralimentacao || 0); // Valor fixo conforme sua regra

    // Função interna para limpar JSONB corrompido ou com aspas duplicadas
    const parseSeguro = (campo) => {
        if (!campo || campo === '[]') return [];
        try {
            if (typeof campo === 'string') {
                // Remove aspas duplicadas e limpa o início/fim da string
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

    // 1. Quantidade de dias (Base)
    const datas = parseSeguro(eventData.datasevento);
    const qtdDias = datas.length;

    // 2. Cálculos Iniciais (Diárias Normais)
    let totalCache = (qtdDias * vlrCache) * multiplicador;
    let totalAjdCusto = (qtdDias * (vlrAlim + vlrTransp)) * multiplicador;

    // 3. Processamento de Diárias Dobradas
    const dobras = parseSeguro(eventData.dtdiariadobrada);
    const autorizadasDobra = dobras.filter(item => item.status === 'Autorizado').length;
    
    const extrasDobraCache = (vlrCache * autorizadasDobra);
    const extrasDobraAjd = (vlrAlimExtra * autorizadasDobra);

    // 4. Processamento de Meias Diárias
    const meias = parseSeguro(eventData.dtmeiadiaria);
    const autorizadasMeia = meias.filter(item => item.status === 'Autorizado').length;
    
    const extrasMeiaCache = ((vlrCache / 2) * autorizadasMeia);
    const extrasMeiaAjd = (vlrAlimExtra * autorizadasMeia);

    // 5. Ajustes e Caixinha
    const vlrAjuste = (eventData.statusajustecusto === 'Autorizado') ? parseFloat(eventData.vlrajustecusto || 0) : 0;
    const vlrCaixinha = (eventData.statuscaixinha === 'Autorizado') ? parseFloat(eventData.vlrcaixinha || 0) : 0;

    // Consolidação dos Totais
    totalCache += (extrasDobraCache + extrasMeiaCache + vlrAjuste + extrasDobraAjd + extrasMeiaAjd);
    //totalAjdCusto += (extrasDobraAjd + extrasMeiaAjd);

    return {
        qtdDias,
        totalCache,
        totalAjdCusto,
        vlrDobraCalculado: extrasDobraCache + extrasDobraAjd, // Para exibir na coluna
        vlrMeiaCalculada: extrasMeiaCache + extrasMeiaAjd,    // Para exibir na coluna
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

async function limparCamposStaffParcial() {

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

    // 1. Limpeza de IDs e Nome do Staff/Funcionário
    document.querySelector("#idStaff").value = '';
    document.querySelector("#idFuncionario").value = '';
    const nmFuncionario = document.getElementById("nmFuncionario");
    if (nmFuncionario) nmFuncionario.value = ''; 

    const descfuncaoElement = document.getElementById('nmFuncaoSelect'); 
    const descfuncaoAtual = (descfuncaoElement ? descfuncaoElement.value : '').trim();
    const isAjudanteDeMarcacao = descfuncaoAtual.toUpperCase() === 'AJUDANTE DE MARCAÇÃO';

    document.querySelector("#apelidoFuncionario").value = '';
    const apelido = document.getElementById("apelidoFuncionario");
    if (apelido) apelido.value = '';

    document.querySelector("#perfilFuncionario").value = '';
    const perfil = document.getElementById("perfilFuncionario");
    if (perfil) perfil.value = '';

    // 2. Limpeza de valores financeiros
    document.querySelector("#vlrCusto").value = ''; // Cachê
    document.querySelector("#transporte").value = '';
    document.querySelector("#alimentacao").value = '';
    document.querySelector("#caixinha").value = '';
    document.getElementById('vlrTotal').value = '';

    const ajusteCustoInput = document.querySelector("#ajusteCusto");
    if (ajusteCustoInput) ajusteCustoInput.style.display = 'none'; // 🎯 Novo

    const caixinhaInput = document.querySelector("#caixinha");
    if (caixinhaInput) caixinhaInput.style.display = 'none'; // 🎯 Novo

    // 3. Limpeza de Níveis de Experiência (Checkboxes)
    
    if (isAjudanteDeMarcacao) {
        console.log("Função 'Ajudante de Marcação' detectada. Pulando a limpeza dos Níveis de Experiência.");
    } else {
        document.getElementById('Seniorcheck').checked = false;
        document.getElementById('Plenocheck').checked = false;
        document.getElementById('Juniorcheck').checked = false;
        document.getElementById('Basecheck').checked = false;
        console.log("Níveis de experiência limpos.");
    }
       
    
    // 4. 🛑 LIMPEZA TOTAL DE DATAS (Flatpickr)
    // Usamos o método clear() em todas as instâncias do flatpickr.
    
    // Período do Evento
    // if (typeof datasEventoPicker !== 'undefined' && datasEventoPicker && typeof datasEventoPicker.clear === 'function') {
    //     datasEventoPicker.clear();
    //     console.log("Datas do Evento (Flatpickr) limpas.");
    // }

    // Diária Dobrada
    const diariaDobradaCheck = document.getElementById("diariaDobradacheck");
    if (typeof window.diariaDobradaPicker !== 'undefined' && window.diariaDobradaPicker && typeof window.diariaDobradaPicker.clear === 'function') {
        diariaDobradaPicker.clear();
    }
    if (diariaDobradaCheck) {
        diariaDobradaCheck.checked = false; 
        // Oculta o campo de data (input do Flatpickr)
        const diariaDobradaInput = document.getElementById("datasDobrada"); // ⚠️ Verifique o ID do input de datas dobradas
        if (diariaDobradaInput) {
            diariaDobradaInput.style.display = 'none'; // 🎯 Novo: Oculta o input de datas
        }
    }
    
    // Meia Diária
    const meiaDiariaCheck = document.getElementById("meiaDiariacheck");
    if (typeof window.meiaDiariaPicker !== 'undefined' && window.meiaDiariaPicker && typeof window.meiaDiariaPicker.clear === 'function') {
        meiaDiariaPicker.clear();
    }
    if (meiaDiariaCheck) {
        meiaDiariaCheck.checked = false; 
        // Oculta o campo de data (input do Flatpickr)
        const meiaDiariaInput = document.getElementById("datasMeiaDiaria");
        if (meiaDiariaInput) {
            meiaDiariaInput.style.display = 'none'; // 🎯 Novo: Oculta o input de datas
        }
    }

    // 5. ⚠️ Limpeza de outros Checkboxes (Caixinha/AjusteCusto)
    const caixinhaCheck = document.getElementById("Caixinhacheck");
    if (caixinhaCheck) {
        caixinhaCheck.checked = false;
    }
    
    const ajusteCustoCheck = document.getElementById("ajusteCustocheck");
    if (ajusteCustoCheck) {
        ajusteCustoCheck.checked = false;
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
    if (statusMeiaDiaria) statusMeiaDiaria.value = 'Autorização de Meia Diária';

    const statusDiariaDobrada = document.getElementById('statusDiariaDobrada');
    if (statusDiariaDobrada) statusDiariaDobrada.value = 'Autorização de Diária Dobrada';

    const statusPgto = document.getElementById('statuspgto');
    if (statusPgto) statusPgto.value = '';

    const statusAjusteCusto = document.getElementById('statusAjusteCusto');
    if (statusAjusteCusto) {
        statusAjusteCusto.value = 'Autorização do Ajuste de Custo';
        statusAjusteCusto.style.display = 'none'; // 🎯 Novo: Oculta o select
    }

    const statusCaixinha = document.getElementById('statuscaixinha');
    if (statusCaixinha) {
        statusCaixinha.value = 'Autorização da Caixinha';
        statusCaixinha.style.display = 'none'; // 🎯 Novo: Oculta o select
    }

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


    // 6. Notifica o usuário
    Swal.fire({
        title: "Pronto para o próximo!",
        text: "Campos de funcionário/cachê e datas limpos. Prossiga com o novo cadastro.",
        icon: "info",
        timer: 2000,
        showConfirmButton: false
    });


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

    baseCheck.addEventListener('change', debouncedOnCriteriosChanged);
    juniorCheck.addEventListener('change', debouncedOnCriteriosChanged);
    plenoCheck.addEventListener('change', debouncedOnCriteriosChanged);
    seniorCheck.addEventListener('change', debouncedOnCriteriosChanged);

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
        let statusAjusteCustoOriginal = '';

        // Se estiver em modo de edição, sobrescreve com os valores originais
        if (currentEditingStaffEvent) {
            valorAjusteCustoOriginal = parseFloat(currentEditingStaffEvent.vlrajustecusto || 0.00);
            descAjusteCustoOriginal = currentEditingStaffEvent.descajustecusto || '';
            statusAjusteCustoOriginal = currentEditingStaffEvent.statusajustecusto || '';
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
                        campoStatusAjusteCusto.value = '';
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
                campoStatusAjusteCusto.value = '';
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

        // Assegura que o campo de valor e a descrição sejam acessados corretamente
        const caixinhaInput = document.getElementById('caixinha');
        const descCaixinhaTextarea = document.getElementById('descCaixinha');
        const campoStatusCaixinha = document.getElementById('statusCaixinha');

        // Inicia com valores padrão para o caso de novo cadastro
        let valorCaixinhaOriginal = 0;
        let descCaixinhaOriginal = '';
        let statusCaixinhaOriginal = '';

        // Se estiver em modo de edição, sobrescreve com os valores originais
        if (currentEditingStaffEvent) {
            valorCaixinhaOriginal = parseFloat(currentEditingStaffEvent.vlrcaixinha || 0.00);
            descCaixinhaOriginal = currentEditingStaffEvent.desccaixinha || '';
            statusCaixinhaOriginal = currentEditingStaffEvent.statuscaixinha || '';
        }

        const isCheckedBeforeSwal = caixinhacheck.checked;
        console.log("CAIXINHA CHECKBOX ALTERADO", isCheckedBeforeSwal, currentEditingStaffEvent, campoStatusCaixinha.value, statusCaixinhaOriginal);

        if (!isCheckedBeforeSwal) {
            // Lógica para quando o usuário desmarca a caixa
            if ((statusCaixinhaOriginal !== 'Pendente') && (statusCaixinhaOriginal !== '') && (statusCaixinhaOriginal !== null)) {
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
                    campoPgtoCaixinha.style.display = 'block';
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
                        campoPgtoCaixinha.style.display = 'none';
                        caixinhaInput.value = '0,00';
                        descCaixinhaTextarea.value = '';
                        campoStatusCaixinha.value = '';
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
                        campoPgtoCaixinha.style.setProperty('display', 'block', 'important');

                        calcularValorTotal();
                    }
                });
            } else {
                // Se não há valor e o status é pendente, simplesmente desmarque
                campoCaixinha.style.display = 'none';
                descCaixinhaTextarea.style.display = 'none';
                campoStatusCaixinha.style.display = 'none';
                campoPgtoCaixinha.style.display = 'none';
                caixinhaInput.value = '0,00';
                descCaixinhaTextarea.value = '';
                campoStatusCaixinha.value = '';
                calcularValorTotal();
            }
        } else {
            // Lógica padrão quando o usuário marca a caixa
            campoCaixinha.style.display = 'block';
            descCaixinhaTextarea.style.display = 'block';
            campoStatusCaixinha.style.setProperty('display', 'block', 'important');
            campoPgtoCaixinha.style.setProperty('display', 'block', 'important');

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

    const datasEventoInput = document.getElementById('datasEvento');
    if (datasEventoInput) {
            console.log("ENTROU NO PERIODO EVENTO DO VERIFICASTAFF");
    }

    const botaoEnviarOriginal = document.getElementById("Enviar");
    if (botaoEnviarOriginal) {
        const BotaoEnviar = botaoEnviarOriginal.cloneNode(true); // Clona o botão, removendo listeners antigos
        botaoEnviarOriginal.parentNode.replaceChild(BotaoEnviar, botaoEnviarOriginal);
        console.log("[botaoEnviar] Listener antigo removido para evitar salvamento duplicado.");

        // Agora usa o novo botão clonado na função existente:
        BotaoEnviar.addEventListener("click", async (event) => {
            event.preventDefault();                
            
                
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
       

            const idMontagem = document.querySelector("#idMontagem").value; // ID do local de montagem (FK)
            const selectLocalMontagem = document.getElementById("nmLocalMontagem");
            const nmLocalMontagem = selectLocalMontagem.options[selectLocalMontagem.selectedIndex].textContent.trim();
            const selectPavilhao = document.getElementById("nmPavilhao");
        
            const inputHiddenPavilhao = document.getElementById('idPavilhao');
            const pavilhao = inputHiddenPavilhao.value.trim().toUpperCase() || '';
            const caixinhaAtivo = document.getElementById("Caixinhacheck")?.checked;
            const ajusteCustoAtivo = document.getElementById("ajusteCustocheck")?.checked;
            const descBeneficioInput = document.getElementById("descBeneficio");
            const descBeneficio = descBeneficioInput?.value.trim() || "";

            const descAjusteCustoInput = document.getElementById("descAjusteCusto");
            const descAjusteCusto = descAjusteCustoInput.value.trim() || "";           

            const setor = document.querySelector("#setor").value.trim().toUpperCase();

            const descCaixinhaInput = document.getElementById("descCaixinha");
            const descCaixinha = descCaixinhaInput?.value.trim() || "";
                //const statusCaixinha = document.getElementById("statusCaixinha").value;

            const selectStatusAjusteCusto = document.getElementById("statusAjusteCusto");
            console.log("Elemento `statusAjusteCusto`:", selectStatusAjusteCusto);
            let statusAjusteCusto = selectStatusAjusteCusto?.value?.trim() || '';

            console.log("Valor `statusAjusteCusto`:", statusAjusteCusto);

            const selectStatusCaixinha = document.getElementById("statusCaixinha");
            let statusCaixinha = selectStatusCaixinha?.value?.trim() || '';

            const diariaDobrada = document.getElementById("diariaDobradacheck")?.checked;
            const meiaDiaria = document.getElementById("meiaDiariacheck")?.checked;
            let statusDiariaDobrada = document.getElementById("statusDiariaDobrada").value;
            let statusMeiaDiaria = document.getElementById("statusMeiaDiaria").value;

            const seniorCheck = document.getElementById('Seniorcheck');
            const plenoCheck = document.getElementById('Plenocheck');
            const juniorCheck = document.getElementById('Juniorcheck');
            const baseCheck = document.getElementById('Basecheck');       

            const qtdPessoas = parseInt(document.getElementById('qtdPessoas').value, 10) || 0;

            console.log("QTD PESSOAS", qtdPessoas);

            console.log("STATUS CAIXINHA, AJUSTECUSTO, DIARIADOBRADAINPUT, DATASEVENTOINPUT", statusCaixinha, statusAjusteCusto, diariaDobradaInput, datasEventoInput);

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

            const viagem1Marcada = document.getElementById('viagem1Check')?.checked || false;
            const viagem2Marcada = document.getElementById('viagem2Check')?.checked || false;
            const viagem3Marcada = document.getElementById('viagem3Check')?.checked || false;

            // 1. VERIFICAÇÃO DE OBRIGATORIEDADE
            if (bForaSP) {
                // bForaSP está TRUE (Evento é fora de SP)
                const nenhumaViagemMarcada = !viagem1Marcada && !viagem2Marcada && !viagem3Marcada;

                if (nenhumaViagemMarcada) {
                    await Swal.fire({
                        title: "Viagem Obrigatória",
                        html: "Este evento está cadastrado para ser realizado <strong>fora de São Paulo (SP)</strong>.<br><br>É obrigatório selecionar pelo menos uma opção de <strong>Deslocamento/Viagem</strong> (Viagem 1, Viagem 2 ou Viagem 3) para continuar com o agendamento.",
                        icon: "error",
                        confirmButtonText: "Entendi"
                    });
                    return; // 🛑 BLOQUEIA O AGENDAMENTO
                }
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
                      
            console.log("Modo final:", metodo, "ID EVENTO PARA API:", idEventoEmEdicao);

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
            nmFuncaoDoFormulario = descFuncao;     
            const idEventoPrincipal = idEvento;

            console.log("IdFuncaoDoFormulario do Botão Enviar:", idFuncaoDoFormulario, "NmFuncaoDoFormulario:", nmFuncaoDoFormulario, "IdEvento:", idEventoPrincipal);

            const flatpickrForDatasEvento = window.flatpickrInstances['datasEvento'];
           

            //-----NOVO TRECHO PARA VERIFICAÇÃO DE FUNCIONÁRIO COM LIMITE DE AGENDAMENTOS POR DIA -----
            const datasParaVerificacao = periodoDoEvento.map(d => {
                // 1. Verifica se 'd' é um objeto Date
                if (d instanceof Date) {
                    return d.toISOString().split('T')[0];
                }
                // 2. Se não for Date, mas for string, retorna a string diretamente.
                // (Assumindo que strings já estão no formato YYYY-MM-DD, conforme exigido pela API)
                if (typeof d === 'string') {
                    return d;
                }
                // 3. Caso contrário, ignora (ou trata como erro)
                return null; 
            }).filter(d => d !== null);           

           
            // 1. CHAME A API E OBTENHA TODOS OS CONFLITOS E A CATEGORIA DA FUNÇÃO
            console.log("Iniciando verificação de disponibilidade do staff...");
          
            const apiResult = await verificarDisponibilidadeStaff(
                idFuncionarioParaVerificacao,             
                periodoDoEvento,
                idFuncaoDoFormulario,
                idEventoEmEdicao
            );
            
            console.log("DIAGNÓSTICO: API retornou! apiResult:", apiResult);

            console.log("Resultado da API (Disponível):", apiResult.isAvailable, "Conflito Encontrado:", apiResult.conflictingEvent);

           

            const { 
                isAvailable, 
                conflicts: initialConflicts = [], // Garante que initialConflicts é [] se a propriedade 'conflicts' não vier
                conflictingEvent // Adiciona para fácil acesso
            } = apiResult;
 
            let conflicts = initialConflicts;      
            
            console.log("DIAGNÓSTICO: Número total de eventos conflitantes retornados pela API (conflicts.length):", conflicts.length);

            const totalConflitosExistentes = conflicts.length;
            
            
            if (apiResult.conflictingEvent && !conflicts.some(c => 
                    Number(c.idstaffevento) === Number(apiResult.conflictingEvent.idstaffevento)
                )) {
                conflicts.push(apiResult.conflictingEvent);
            }

  
            //const idRegistroEmEdicao = currentEditingStaffEvent?.idstaffevento || document.getElementById('idStaffEvento')?.value;
            const idRegistroEmEdicaoParaFiltro = currentEditingStaffEvent?.idstaffevento || document.getElementById('idStaffEvento')?.value;


            console.log("Valores para busca de duplicidade:");
            console.log(`- idFuncaoDoFormulario: ${idFuncaoDoFormulario}, Tipo: ${typeof idFuncaoDoFormulario}, Nome: ${nmFuncaoDoFormulario}`);
            console.log(`- idEventoPrincipal: ${idEventoPrincipal}, Tipo: ${typeof idEventoPrincipal}`); // NOVO LOG
            console.log(`- idEventoEmEdicao: ${idEventoEmEdicao}, Tipo: ${typeof idEventoEmEdicao}`);          

        //     const periodoStringAtual = (periodoDoEvento || []).sort().join(',');
        // const periodoStringOriginal = (window.dadosOriginais?.periodo || []).sort().join(',');
        // const idFuncionarioOriginal = String(window.dadosOriginais?.idFuncionario || "");
        // const idFuncionarioAtual = String(idStaffEvento); // idFuncionario capturado no início do clique

        // // Se for edição e NÃO mudou data nem funcionário, pulamos tudo
        // const isEdicao = !!idRegistroEmEdicaoParaFiltro; // ou a lógica que você usa para identificar PUT
        // const mudouAgenda = (periodoStringAtual !== periodoStringOriginal) || (idFuncionarioAtual !== idFuncionarioOriginal);
        // console.log("PeriodoStringAtual:", periodoStringAtual, "PeriodoStringOriginal:", periodoStringOriginal, "IdFuncionarioAtual:", idFuncionarioAtual, "IdFuncionarioOriginal:", idFuncionarioOriginal);


        // console.log("Verificação de alteração de agenda:", mudouAgenda, isEdicao);


        // if (isEdicao && !mudouAgenda) {
        //     console.log("✅ Alteração informativa detectada. Pulando validações de conflito e duplicidade.");
        //     // Aqui o código sai desse bloco gigante e vai direto para a parte final de montagem do FormData e Fetch
        // } else {

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
                        datasevento: JSON.stringify(periodoDoEvento),
                        idFuncao: idFuncao
                    }).toString();

                    const duplicateCheckResult = await fetchComToken(checkDuplicateUrl, {
                        method: 'GET',
                        headers: { 'Content-Type': 'application/json' }
                    });

                    console.log("DuplicateCheckResult", duplicateCheckResult);

                    if (duplicateCheckResult.isDuplicate) {
                        console.log("IsDuplicate");

                        const existingEventData = duplicateCheckResult.existingEvent;

                        console.log("EXISTINGEVENTEDATA", existingEventData);
                        
                        // 1. Obtém o ID do evento que estamos tentando salvar (se for uma edição)
                        const idEventoFormulario = idEvento;
                        
                        console.log("IDEVENTOFORMULARIO", idEventoFormulario);
                        // 2. Define o ID do evento retornado pelo backend
                        const idEventoDuplicado = existingEventData?.idstaffevento;
                        
                        console.log("IDEVENTODUPLICADO", idEventoDuplicado);
                        // 3. Verifica se o duplicado é o próprio evento em edição (Self-Conflict).
                        const isSelfConflict = idEventoFormulario && String(idEventoFormulario) === String(idEventoDuplicado);

                        console.log("ISSELFCONFLICT", isSelfConflict);
                        // Variáveis de comparação:
                        //const idEventoDoFormulario = document.getElementById('idEvento')?.value; // ID do evento no formulário
                        //const idFuncaoDoFormulario = document.getElementById('descFuncaoSelect')?.value; // ID da função no formulário

                        console.log("IDS EVENTO E FUNCAO DO FORMULARIO", idFuncaoDoFormulario, idEventoFormulario);

                        const isSameFunction = Number(existingEventData?.idfuncao) === Number(idFuncaoDoFormulario);
                        // 5. Verifica se o duplicado é para o MESMO evento.
                        const isSameEvent = Number(existingEventData?.idevento) === Number(idEventoFormulario);

                        console.log("IS SAME FUNCTION E EVENT", isSameFunction, isSameEvent);
                        
                        // A. SE É O PRÓPRIO EVENTO EM EDIÇÃO (Self-Conflict)
                        if (isSelfConflict) {
                            console.log("Evento existente detectado e em modo de edição. É o mesmo registro (Self-Conflict). Prosseguindo para verificação de alteração.");
                            metodo = "PUT"; // Garante que o método continua PUT
                            url = `/staff/${existingEventData.idstaffevento}`; // Garante a URL correta
                            currentEditingStaffEvent = existingEventData; // Atualiza com os dados mais recentes do backend
                            // Prossegue para checagem de limites.
                            
                        // B. SE É UM CONFLITO E NÃO É O PRÓPRIO EVENTO EM EDIÇÃO (Conflito Real de Agenda)
                        } else { 
                            
                            // Conflito 1: Duplicidade Estrita (mesma função, ID diferente).
                            if (isSameFunction) {
                                
                                console.log("!!! DUPLICADO ENCONTRADO (STRICT) !!!");

                                await Swal.fire({
                                    icon: "error", // Altera para ícone de erro
                                    title: "Cadastro Duplicado!",
                                    html: `O evento para o funcionário <strong>${nmFuncionario}</strong> com a função <strong>${existingEventData.nmfuncao}</strong> e datas selecionadas JÁ ESTÁ CADASTRADO, não permitindo cadastrar novamente.<br><br>É necessário editar o registro existente, e não criar um novo.`,
                                    confirmButtonText: "Entendido",
                                });

                                console.log("Usuário bloqueado de cadastrar duplicidade estrita.");
                                return; // 🛑 BLOQUEIA e encerra a execução.
                                
                            }                             
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

            // Variável Local (Adapte conforme onde você obtém a categoria)
            const categoriaFuncaoDoFormulario = categoriaFuncao || 'PADRAO'; 
            
            // Variável de ID Fiscal (manter para o limite 2)
            const FUNCOES_EXCECAO_IDS = ['6']; // FISCAL NOTURNO ID 6, etc.
           
            //const idRegistroEmEdicaoParaFiltro = currentEditingStaffEvent?.idstaffevento || document.getElementById('idStaffEvento')?.value;

            // 2. FILTRAR E CONTAR CONFLITOS
            // Filtra os eventos conflitantes que NÃO são o registro de staff que estamos AGORA editando/atualizando.
            const conflitosReais = conflicts ? conflicts.filter(c => String(c.idstaffevento) !== String(idRegistroEmEdicaoParaFiltro)) : [];

            // Obtém o número total de eventos já agendados (excluindo o atual)
           // const totalConflitosExistentes = conflitosReais.length;
            
            let limiteMaximo;
            let motivoLiberacao = null;

            // 3. Define o limite de acordo com a categoria
            if (categoriaFuncaoDoFormulario === 'ATENDIMENTO PRÉ-EVENTO') {
                limiteMaximo = 4;
                motivoLiberacao = "A categoria <br>ATENDIMENTO PRÉ-EVENTO</br> permite até 4 agendamentos, por funcionário parao mesmo dia.";
            } 
            else {
                //if (FUNCOES_EXCECAO_IDS.includes(String(idFuncaoDoFormulario))) {
                limiteMaximo = 2;
                motivoLiberacao = "É permitido até 2 agendamentos, por funcionário para o mesmo dia.";
            } 
            
           

            if (totalConflitosExistentes > 0) {
                const datasConflito = encontrarDatasConflitantes(datasParaVerificacao, conflitosReais);
                const datasFormatadas = formatarDatas(datasConflito);
                
                let msg = `O funcionário <strong>${nmFuncionario}</strong> já está agendado em <br>${totalConflitosExistentes}</br> atividade(s) `;
                
                // Adiciona as datas conflitantes à mensagem
                if (datasConflito.length > 0) {
                    msg += `na(s) data(s) conflitante(s): <strong>${datasFormatadas}</strong>.`;
                }

                // 3.1: VERIFICA SE O LIMITE FOI ATINGIDO OU EXCEDIDO (SOLICITA AUTORIZAÇÃO)
                if (totalConflitosExistentes >= limiteMaximo) {
                    
                    // --- NOVO PASSO 1: VERIFICAÇÃO DE STATUS EXISTENTE (PENDENTE/AUTORIZADO) ---
                   
                    if (!idOrcamentoAtual) {
                        await Swal.fire("Erro", "Não foi possível obter o ID do Orçamento (idOrcamento) necessário para a solicitação.", "error");
                        return; 
                    }

                    const aditivoExistente = await verificarStatusAditivoExtra(idOrcamentoAtual, idFuncaoDoFormulario, 'FuncExcedido', idFuncionarioParaVerificacao, nmFuncionario);

                    if (aditivoExistente === false) {
                        return; // 🛑 BLOQUEIA O AGENDAMENTO AQUI E SAI DA FUNÇÃO PRINCIPAL.
                    }
                    
                    if (aditivoExistente.encontrado) {
                        
                        // A. STATUS PENDENTE: BLOQUEIA
                        if (aditivoExistente.status === 'Pendente') {
                            // await Swal.fire({
                            //     title: "Solicitação Pendente",
                            //     html: `Já existe uma solicitação de exceção <strong>PENDENTE</strong> para esta função, evento e período (ID: ${aditivoExistente.detalhes.idAditivoExtra}). Aguarde a aprovação.`,
                            //     icon: "info",
                            //     confirmButtonText: "Entendi"
                            // });
                            //return; // Bloqueia o agendamento
                        }

                        // B. STATUS AUTORIZADO: PROSSEGUE SEM NOVA SOLICITAÇÃO
                        if (aditivoExistente.status === 'Autorizado') {
                            await Swal.fire({
                                title: "Autorização Existente",
                                html: `Já existe uma solicitação de exceção <strong>AUTORIZADA</strong> para esta função, evento e período (ID: ${aditivoExistente.detalhes.idAditivoExtra}). O agendamento será processado sem gerar um novo aditivo.`,
                                icon: "success",
                                confirmButtonText: "Prosseguir com o Agendamento"
                            });
                            return; // PROSSEGUE (pula o restante do bloco IF)
                        }
                        
                        // C. Se o status for Rejeitado ou outro, o código continua para criar uma nova solicitação.
                    }
                    
                    // --- PASSO 2: CRIAÇÃO DE NOVA SOLICITAÇÃO DE ADITIVO (Se necessário) ---
                    
                    // Mensagem padrão para solicitação de autorização
                    msg += `<br><br>⚠️ <strong>LIMITE ATINGIDO!</strong> O limite máximo é de <strong>${limiteMaximo}</strong> agendamentos por funcionário para o mesmo dia.`;
                    msg += `<br><br>Eventos Agendados (${totalConflitosExistentes}):`;
                    conflitosReais.forEach(c => {
                        msg += `<br> - <strong>${c.nmevento || 'N/A'}</strong> (Função: ${c.nmfuncao})`;
                    });

                    msg += `<br><br>Para continuar, você deve SOLICITAR AUTORIZAÇÃO por exceder o limite. Deseja prosseguir?`;
                    
                    let justificativa = '';
                    let isConfirmed = false;
                    const swalResult =  await Swal.fire({
                    //const { value: justificativa, isConfirmed } = await Swal.fire({
                        title: "Solicitar Autorização de Exceção?",
                        html: `
                            ${msg}<br>
                            <label for="swal-input-justificativa">Justificativa:</label>
                            <textarea id="swal-input-justificativa" class="swal2-textarea" placeholder="Descreva o motivo..." required></textarea>
                        `, 
                        icon: "warning", 
                        showCancelButton: true,
                        confirmButtonText: "Sim, Solicitar Autorização e Agendar",
                        cancelButtonText: "Não, Cancelar Agendamento",
                        preConfirm: () => {
                            const input = document.getElementById('swal-input-justificativa').value.trim();
                            if (!input) {
                                Swal.showValidationMessage('A justificativa é obrigatória para a solicitação.');
                                return false;
                            }
                            return input; 
                        }
                    });

                    justificativa = swalResult.value || '';
                    isConfirmed = swalResult.isConfirmed;

                    if (!isConfirmed) {
                        return; // **Cancela o envio**
                    }
                    console.log("Justificativa confirmada e pronta para processamento:", justificativa);
                    
                    try { 
                        // 2.1: AJUSTE DA JUSTIFICATIVA COM O PERÍODO (MOVIDO PARA DENTRO DO TRY)
                        const { dtInicio, dtFim } = getPeriodoEvento(datasParaVerificacao);
                        let justificativaFinal = justificativa;

                        if (dtInicio && dtFim) {
                            // Adiciona o período do novo agendamento à justificativa
                            justificativaFinal = `[Período Agendamento: ${dtInicio} a ${dtFim}] - ${justificativa}`;
                        }
                        
                        console.log("IdFuncaoDoFormulario Antes de Salvar Solicitação:", idFuncaoDoFormulario, "NmFuncaoDoFormulario:", nmFuncaoDoFormulario);
                        
                        const result = await salvarSolicitacaoAditivoExtra(
                            idOrcamentoAtual, 
                            idFuncaoDoFormulario,                       
                            1, // Solicitando +1 (para o agendamento atual)
                            'FuncExcedido', 
                            justificativaFinal, // Usar a justificativa ajustada
                            idFuncionarioParaVerificacao
                        );                       
                        

                        // Flag para rastrear o resultado e o ID, e se foi cancelado
                        let solicitacaoInfo = { 
                            salva: false, 
                            id: null, 
                            cancelada: !isConfirmed 
                        };

                        // 1. TENTA SALVAR A SOLICITAÇÃO APENAS SE O USUÁRIO CONFIRMOU A JUSTIFICATIVA
                        if (isConfirmed) {
                            try { 
                                // 2.1: AJUSTE DA JUSTIFICATIVA COM O PERÍODO
                                // Certifique-se de que a função getPeriodoEvento foi definida antes (conforme discutido anteriormente)
                                const { dtInicio, dtFim } = getPeriodoEvento(datasParaVerificacao);
                                let justificativaFinal = justificativa;

                                if (dtInicio && dtFim) {
                                    justificativaFinal = `[Período Agendamento: ${dtInicio} a ${dtFim}] - ${justificativa}`;
                                }
                                
                                console.log("IdFuncaoDoFormulario Antes de Salvar Solicitação:", idFuncaoDoFormulario, "NmFuncaoDoFormulario:", nmFuncaoDoFormulario);
                                
                                const result = await salvarSolicitacaoAditivoExtra(
                                    idOrcamentoAtual, 
                                    idFuncaoDoFormulario,             
                                    1, // Solicitando +1
                                    'FuncExcedido', 
                                    justificativaFinal,
                                    idFuncionarioParaVerificacao
                                );

                                if (!result.sucesso) {
                                    await Swal.fire("Falha na Solicitação", `Não foi possível registrar a solicitação de exceção. Detalhes: <strong>${result.erro}</strong>`, "error");
                                    return; // Bloqueia o agendamento em caso de falha no servidor/API
                                }

                                // Sucesso
                                solicitacaoInfo.salva = true;
                                solicitacaoInfo.id = result.idAditivoExtra;
                                
                            } catch (error) {
                                console.error("Erro inesperado no fluxo de aditivo:", error);
                                await Swal.fire("Erro Crítico", `Ocorreu um erro inesperado durante a solicitação de aditivo. Verifique o console. Detalhes: ${error.message}`, "error");
                                return; // Bloqueia o agendamento em caso de erro crítico
                            }
                        }

                        // 2. EXIBIÇÃO DO SWAL DE DECISÃO FINAL (Unificado para Sucesso ou Cancelamento)

                        let swalTitle;
                        let htmlMessage;
                        let swalIcon;

                        if (solicitacaoInfo.salva) {
                            swalTitle = "Solicitação Pendente Registrada!";
                            htmlMessage = `Sua solicitação de exceção foi registrada com sucesso e está <strong>Pendente de aprovação<strong>. O agendamento do staff <strong>NÃO<strong> foi realizado.`;
                            swalIcon = "info";
                        } else if (solicitacaoInfo.cancelada) {
                            swalTitle = "Agendamento Cancelado";
                            htmlMessage = `Você optou por <strong>NÃO</strong> solicitar a autorização de exceção. O agendamento foi cancelado.`;
                            swalIcon = "warning";
                        } else {
                            // Se não salvou e não foi cancelado (o que indica que o 'return' foi chamado acima devido a um erro de API)
                            return;
                        }

                        htmlMessage += `<br><br>Qual a próxima ação?`;

                        const resultDecisao = await Swal.fire({
                            title: swalTitle,
                            html: htmlMessage,
                            icon: swalIcon,
                            showCancelButton: true,
                            showDenyButton: true,
                            confirmButtonText: "Cadastrar mais um (Manter evento/função)",
                            cancelButtonText: "Finalizar e Sair",
                            denyButtonText: "Cadastrar novo staff (Limpar tudo)",
                            reverseButtons: true,
                            focusCancel: true
                        });

                        // 3. TRATAMENTO DA DECISÃO DO USUÁRIO
                        if (resultDecisao.isConfirmed) {
                            console.log("Usuário escolheu: Cadastrar mais um (Manter evento/função)");
                            if (typeof limparCamposStaffParcial === "function") {
                                limparCamposStaffParcial();
                            } else {
                                console.error("limparCamposStaffParcial não está definida. Limpando tudo.");
                                limparCamposStaff();
                            }
                        } else if (resultDecisao.isDenied) {
                            console.log("Usuário escolheu: Cadastrar novo staff (Limpar tudo)");
                            limparCamposStaff();
                        } else if (resultDecisao.dismiss === Swal.DismissReason.cancel) {
                            console.log("Usuário escolheu: Finalizar e Sair");
                            if (typeof fecharModal === "function") {
                                fecharModal();
                                window.location.reload();
                            } else {
                                document.getElementById("modal-overlay").style.display = "none";
                                document.getElementById("modal-container").innerHTML = "";
                                document.body.classList.remove("modal-open");
                            }
                        }

                        return; // 🛑 ESSENCIAL: Bloqueia o agendamento do staff. A decisão já foi tomada.

                    } catch (error) {
                        console.error("Erro inesperado no fluxo de aditivo:", error);
                        await Swal.fire("Erro Crítico", `Ocorreu um erro inesperado durante a solicitação de aditivo. Verifique o console. Detalhes: ${error.message}`, "error");
                        return; // Bloqueia o agendamento
                    }


                } else {
                    // 3.2: Conflito, mas DENTRO do Limite (Aviso com Permissão - Lógica Original)
                    
                    // *** AVISO: Conflito, mas DENTRO do Limite ***
                    
                    msg += `<br><br>Você está tentando agendar o <strong>${(totalConflitosExistentes + 1)}º</strong> evento.`;
                    msg += `<br>Motivo do Prosseguimento: <strong>${motivoLiberacao}</strong>`;
                    
                    msg += `<br><br>Eventos Agendados (${totalConflitosExistentes}):`;
                    conflitosReais.forEach(c => {
                        msg += `<br> - <strong>${c.nmevento || 'N/A'}</strong> (Função: ${c.nmfuncao})`;
                    });

                    msg += `<br><br>Deseja continuar com o agendamento? (Limite total: ${limiteMaximo})`;

                    const { isConfirmed } = await Swal.fire({
                        title: "Atenção: Conflito de Agendamento!",
                        html: msg,
                        icon: "warning",
                        showCancelButton: true,
                        confirmButtonText: "Sim, continuar",
                        cancelButtonText: "Não, cancelar",
                    });

                    if (!isConfirmed) {
                        return; // **Cancela o envio**
                    }
                    
                }
            }
        
           // } // Fecha o bloco ELSE do isEdicao e mudouAgenda

            //----- FIM DO TRECHO DE VERIFICAÇÃO DE LIMITE DE AGENDAMENTOS POR DIA -----

            console.log("Preparando dados para envio:", {
                nmFuncionario, descFuncao, nmLocalMontagem, nmCliente, nmEvento, vlrCusto, ajusteCusto, transporte, alimentacao, caixinha,
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
                
                    nmEvento: nmEventoSelect.options[nmEventoSelect.selectedIndex].text,
                    nmCliente: nmClienteSelect.options[nmClienteSelect.selectedIndex].text,
                    nmlocalMontagem: nmLocalMontagemSelect.options[nmLocalMontagemSelect.selectedIndex].text,
                    nmFuncao: descFuncaoSelect.options[descFuncaoSelect.selectedIndex].text,                    
                    pavilhao: nmPavilhaoSelect.options[nmPavilhaoSelect.selectedIndex].text,
                    datasEvento: datasSelecionadas,
                    datasEventoDobradas: datasDobradas,
                    idFuncao: descFuncaoSelect.value
                };

                // if (!isFormLoadedFromDoubleClick && !verificarLimiteDeFuncao(criteriosDeVerificacao)) {

                //     return;
                // }

                //NOVO: Verificação de limite de vagas orçadas
                if (!isFormLoadedFromDoubleClick) {
                   // controlarBotaoSalvarStaff(false);
                    // 1. VERIFICAÇÃO DE LIMITE DE QUANTIDADE (VAGAS)
                    const resultadoFuncao = await verificarLimiteDeFuncao(criteriosDeVerificacao);

                    if (!resultadoFuncao.allowed) {
                        controlarBotaoSalvarStaff(false); //se puder cadastrar mais liberar o botão dqui
                        return; // Bloqueia o cadastro se o usuário cancelou no modal de quantidade
                    }

                    // Inicializa com o resultado da verificação de QUANTIDADE
                    statusAditivoFinal = resultadoFuncao.statusAditivo;
                    statusExtraBonificadoFinal = resultadoFuncao.statusExtraBonificado;

                    // 2. VERIFICAÇÃO DE DATAS FORA DO ORÇAMENTO (Variável Global)
                    // Verifica se houve decisão de Aditivo/Extra na etapa de seleção de datas
                    if (typeof decisaoUsuarioDataFora !== 'undefined' && decisaoUsuarioDataFora !== null) {
                        console.log("Aplicando decisão manual por Data Fora do Orçamento:", decisaoUsuarioDataFora);

                        if (decisaoUsuarioDataFora === 'ADITIVO') {
                            statusAditivoFinal = 'Pendente';
                        } else if (decisaoUsuarioDataFora === 'EXTRA') {
                            statusExtraBonificadoFinal = 'Pendente';
                        }
                    }
                    
                    console.log(
                        "Status Final Consolidado -> Aditivo:", statusAditivoFinal, 
                        "| Extra Bonificado:", statusExtraBonificadoFinal
                    );
                    
                }
                

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
            formData.append('vlralimentacao', alimentacao);
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

            let statusPgto = document.querySelector("#statusPgto")?.value || ''; 
            let statusPgtoAjusteCusto = document.querySelector("#statusPgtoAjudaCusto")?.value || ''; 
            let statusPgtoCaixinha = document.querySelector("#statusPgtoCaixinha")?.value || '';           

            console.log("VALORES CUSTOS ANTES", vlrCusto, ajusteCusto, caixinha, alimentacao, transporte);
            const custosVazios = ajusteCusto === 0 && caixinha === 0 && alimentacao === 0 && transporte === 0;
            console.log("VALORES CUSTOS DEPOIS", vlrCusto, ajusteCusto, caixinha, alimentacao, transporte, comppgtocacheDoForm, comppgtocacheDoForm, comppgtocaixinhaDoForm);

            const vlrAjusteCusto = parseFloat(ajusteCusto);
            const vlrCache = parseFloat(vlrCusto);
            const vlrAlimentacao = parseFloat(alimentacao);
            const vlrTransporte = parseFloat(transporte);
            const vlrCaixinha = parseFloat(caixinha);

            const temComprovanteCache = !!comppgtocacheDoForm;
            const temComprovanteAjudaCusto = !!comppgtoajdcustoDoForm;
            const temComprovanteAjudaCusto50 = !!comppgtoajdcusto50DoForm;
            const temComprovanteCaixinha = !!comppgtocaixinhaDoForm;

            const cachePago = (vlrCache > 0 && temComprovanteCache);
            const ajudaCustoPaga = ((vlrAlimentacao > 0 || vlrTransporte > 0) && temComprovanteAjudaCusto);
            const caixinhasPagos = ((vlrCaixinha > 0) && temComprovanteCaixinha);


            // if (cachePago && ajudaCustoPaga && caixinhasPagos) {
            //     statusPgto = "Pago";
            // } else if (
            //     (vlrCache <= 0 || (vlrCache > 0 && temComprovanteCache)) && // Se o cache não precisa de comprovação ou está pago
            //     ((vlrAlimentacao <= 0 && vlrTransporte <= 0) || ((vlrAlimentacao > 0 || vlrTransporte > 0) && temComprovanteAjudaCusto)) && // Mesma lógica para ajuda de custo
            //     (vlrCaixinha <= 0 || (vlrCaixinha > 0 && temComprovanteCaixinha))
            // ) {

            //     statusPgto = "Pago";
            // } else {
            //     statusPgto = "Pendente";
            // }       
            
            
            // if (statusPgto !== "Pago") {
            //     if (vlrCache > 0 && !!comppgtocacheDoForm) {
            //         statusPgto = "Pago";
            //     } else {
            //         statusPgto = "Pendente";
            //     }
            // }

            if (vlrCaixinha === 0) { 
                // Se não tem valor, o status deve ser vazio, conforme solicitado.
                statusCaixinha = '';  
            }

            if (vlrAjusteCusto === 0) { 
                // Se não tem valor, o status deve ser vazio, conforme solicitado.
                statusAjusteCusto = '';  
            }

            // if (statusPgtoAjusteCusto !== "Pago" && statusPgtoAjusteCusto !== "Pago50") {
            //     if (temComprovanteAjudaCusto) {
            //         statusPgtoAjusteCusto = "Pago";
            //     } else if (temComprovanteAjudaCusto50) {
            //         statusPgtoAjusteCusto = "Pago50";
            //     } else {
            //         statusPgtoAjusteCusto = "Pendente";
            //     }
            // } else {
            //     // Se já estava Pago ou Pago50, mas agora subiram o comprovante total, forçamos "Pago"
            //     if (temComprovanteAjudaCusto) {
            //         statusPgtoAjusteCusto = "Pago";
            //     }
            // }

            // if (statusPgtoCaixinha !== "Pago") {
            //     if (temComprovanteCaixinha) {
            //         statusPgtoCaixinha = "Pago";
            //     } else {
            //         statusPgtoCaixinha = "Pendente";
            //     }
            // }

            //if (vlrAjusteCusto === 0) statusPgtoAjusteCusto = '';
            //if (vlrCaixinha === 0) statusPgtoCaixinha = '';

            formData.append('statuspgto', statusPgto);
            formData.append('statuspgtoajdcto', statusPgtoAjusteCusto);
            formData.append('statuspgtocaixinha', statusPgtoCaixinha);

            formData.append('statusajustecusto', statusAjusteCusto);
            formData.append('statuscaixinha', statusCaixinha);            
            formData.append('descdiariadobrada', descDiariaDobradaTextarea.value.trim());
            formData.append('descmeiadiaria', descMeiaDiariaTextarea.value.trim());
            formData.append('desccaixinha', descCaixinhaTextarea.value.trim()); 
            
            let tipoAjudaCustoViagem = 0; // Valor padrão (nenhum ou erro)

            if (document.getElementById('viagem1Check').checked) tipoAjudaCustoViagem = 1;
            else if (document.getElementById('viagem2Check').checked) tipoAjudaCustoViagem = 2;
            else if (document.getElementById('viagem3Check').checked) tipoAjudaCustoViagem = 3;

            formData.append('tipoajudacustoviagem', tipoAjudaCustoViagem.toString());
        
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
            formData.append('qtdpessoas', qtdPessoas.toString());

            console.log("ENVIANDO ID E NOME EQUIPE", idEquipe, nmEquipe);
            formData.append('idequipe', idEquipe);
            formData.append('nmequipe', nmEquipe);

            console.log("Status Diaria Dobrada", statusDiariaDobrada, statusMeiaDiaria);

        
            if (diariaDobrada === true ){
                if (statusDiariaDobrada === "Autorização de Diária Dobrada"){

                    statusDiariaDobrada = "Pendente";
                }
            }else{
                statusDiariaDobrada = '';
            }
            if (meiaDiaria === true && statusMeiaDiaria === "Autorização de Meia Diária"){          
                if (statusMeiaDiaria === "Autorização de Meia Diária"){
                    statusMeiaDiaria = "Pendente";
                }
                
            }else{
                statusMeiaDiaria = '';
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
                    
        
        console.log("STATUS ANTES DE SALVAR", statusDiariaDobrada, statusMeiaDiaria, dadosDiariaDobrada, dadosMeiaDiaria, diariaDobrada, meiaDiaria);

        formData.append('statusdiariadobrada', statusDiariaDobrada);
        formData.append('statusmeiadiaria', statusMeiaDiaria);
        formData.append('datadiariadobrada', JSON.stringify(dadosDiariaDobrada));
        formData.append('datameiadiaria', JSON.stringify(dadosMeiaDiaria));   
        
        console.log("ID ORÇAMENTO ATUAL PARA PUT:", idOrcamentoAtual);
        formData.append('idorcamento', idOrcamentoAtual);
        

        console.log("Preparando envio de FormData. Método:", metodo, "URL:", url, window.StaffOriginal);
        console.log("Dados do FormData:", {
            nmFuncionario, descFuncao, vlrCusto, ajusteCusto, transporte, alimentacao, caixinha,
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

            const dataDiariaDobradaOriginalLimpa = (dataDiariaDobradaOriginal || []).map(item => 
                typeof item === 'object' ? item.data : item
            );

            const dataMeiaDiariaOriginalLimpa = (dataMeiaDiariaOriginal || []).map(item => 
                typeof item === 'object' ? item.data : item
            );

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
            const qtdPessoasAtual = qtdPessoas;

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
                const descDiariaDobrada = descDiariaDobradaInput.value.trim();

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
                const descMeiaDiaria = descMeiaDiariaInput.value.trim();

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
                parseFloat(currentEditingStaffEvent.vlralimentacao || 0.00) != parseFloat(alimentacao.replace(',', '.') || 0.00) ||
                parseFloat(currentEditingStaffEvent.vlrcaixinha || 0.00) != caixinhaValorAtual ||
                (currentEditingStaffEvent.descajustecusto || '').trim() != descAjusteCusto.trim() ||
                (currentEditingStaffEvent.descbeneficios || '').trim() != descBeneficio.trim() ||
                (currentEditingStaffEvent.desccaixinha || '').trim() != descCaixinha.trim() ||
                (currentEditingStaffEvent.setor || '').trim() != setor.trim() ||
                currentEditingStaffEvent.idcliente != idCliente ||
                currentEditingStaffEvent.idevento != idEvento ||
                currentEditingStaffEvent.idmontagem != idMontagem ||
                currentEditingStaffEvent.idequipe != idEquipe ||
                (currentEditingStaffEvent.pavilhao || '').toUpperCase().trim() != pavilhao ||
                (currentEditingStaffEvent.statuspgto || '').trim() != statusPgto.trim() ||
                (currentEditingStaffEvent.statusajustecusto || '').trim() != statusAjusteCusto.trim() ||
                (currentEditingStaffEvent.statuscaixinha || '').trim() != statusCaixinha.trim() ||
                (currentEditingStaffEvent.statusdiariadobrada || '').trim() != statusDiariaDobrada.trim() ||
                (currentEditingStaffEvent.statusmeiadiaria || '').trim() != statusMeiaDiaria.trim() ||
                currentEditingStaffEvent.diariadobrada != diariaDobradaAtual ||
                currentEditingStaffEvent.meiadiaria != meiaDiariaAtual ||
                currentEditingStaffEvent.nivelexperiencia != nivelExperienciaAtual ||
                currentEditingStaffEvent.qtdpessoas != qtdPessoasAtual 
            ) {
                houveAlteracao = true;
            }

            const logAndCheck = (fieldName, originalValue, currentValue, condition) => {
            const isDifferent = condition;
                console.log(`[COMPARACAO] ${fieldName}: Original = '${originalValue}' | Atual = '${currentValue}' | Diferente = ${isDifferent}`);
                return isDifferent;
            };
            houveAlteracao =
                logAndCheck('ID Equipe', currentEditingStaffEvent.idequipe, idEquipe, currentEditingStaffEvent.idequipe != idEquipe) ||
                logAndCheck('Equipe', currentEditingStaffEvent.nmequipe.toUpperCase(), nmEquipe, currentEditingStaffEvent.nmequipe.toUpperCase() != nmEquipe) ||
                logAndCheck('ID Funcionário', currentEditingStaffEvent.idfuncionario, idFuncionario, currentEditingStaffEvent.idfuncionario != idFuncionario) ||
                logAndCheck('Função', currentEditingStaffEvent.nmfuncao.toUpperCase(), descFuncao, currentEditingStaffEvent.nmfuncao.toUpperCase() != descFuncao) ||
                logAndCheck('Valor Cache', parseFloat(currentEditingStaffEvent.vlrcache || 0), parseFloat(vlrCusto.replace(',', '.') || 0), parseFloat(currentEditingStaffEvent.vlrcache || 0) != parseFloat(vlrCusto.replace(',', '.') || 0)) ||
                logAndCheck('Datas Evento', JSON.stringify(currentEditingStaffEvent.datasevento || []), JSON.stringify(periodoDoEvento), JSON.stringify(currentEditingStaffEvent.datasevento || []) !== JSON.stringify(periodoDoEvento)) || // Use datasevento
                logAndCheck('Valor AjusteCusto', parseFloat(currentEditingStaffEvent.vlrajustecusto || 0), ajusteCustoValorAtual, parseFloat(currentEditingStaffEvent.vlrajustecusto || 0) != ajusteCustoValorAtual) ||
                logAndCheck('Valor Transporte', parseFloat(currentEditingStaffEvent.vlrtransporte || 0), parseFloat(transporte.replace(',', '.') || 0), parseFloat(currentEditingStaffEvent.vlrtransporte || 0) != parseFloat(transporte.replace(',', '.') || 0)) ||
                logAndCheck('Valor Alimentação', parseFloat(currentEditingStaffEvent.vlralimentacao || 0), parseFloat(alimentacao.replace(',', '.') || 0), parseFloat(currentEditingStaffEvent.vlralimentacao || 0) != parseFloat(alimentacao.replace(',', '.') || 0)) ||
                logAndCheck('Valor Caixinha', parseFloat(currentEditingStaffEvent.vlrcaixinha || 0), caixinhaValorAtual, parseFloat(currentEditingStaffEvent.vlrcaixinha || 0) != caixinhaValorAtual) ||
                logAndCheck('Descrição Bônus', (currentEditingStaffEvent.descajustecusto || '').trim(), descAjusteCusto.trim(), (currentEditingStaffEvent.descajustecusto || '').trim() != descAjusteCusto.trim()) ||
                logAndCheck('Descrição Benefícios', (currentEditingStaffEvent.descbeneficios || '').trim(), descBeneficio.trim(), (currentEditingStaffEvent.descbeneficios || '').trim() != descBeneficio.trim()) ||
                logAndCheck('Descrição Caixinha', (currentEditingStaffEvent.desccaixinha || '').trim(), descCaixinha.trim(), (currentEditingStaffEvent.desccaixinha || '').trim() != descCaixinha.trim()) ||
                logAndCheck('Setor', (currentEditingStaffEvent.setor.toUpperCase() || '').trim(), setor.trim().toUpperCase(), (currentEditingStaffEvent.setor.toUpperCase() || '').trim() != setor.toUpperCase().trim()) ||
                logAndCheck('StatusPgto', (currentEditingStaffEvent.statuspgto || '').trim(), statusPgto.trim(), (currentEditingStaffEvent.statuspgto || '').trim() != statusPgto.trim()) ||
                //logAndCheck('StatusAjusteCusto', (currentEditingStaffEvent.statusajustecusto || '').trim(), statusAjusteCusto.trim(), (currentEditingStaffEvent.statusajustecusto || '').trim() != statusAjusteCusto.trim()) ||
                logAndCheck('StatusAjusteCusto', (currentEditingStaffEvent.statusajustecusto || '').trim(), (statusAjusteCusto || '').trim(), (currentEditingStaffEvent.statusajustecusto || '').trim() != (statusAjusteCusto || '').trim()) ||
                logAndCheck('StatusCaixinha', (currentEditingStaffEvent.statuscaixinha || '').trim(), (statusCaixinha || '').trim(), (currentEditingStaffEvent.statuscaixinha || '').trim() != (statusCaixinha || '').trim()) ||
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

                //logAndCheck('Datas Diária Dobrada', JSON.stringify(dataDiariaDobradaOriginal), JSON.stringify(dataDiariaDobradaAtual), JSON.stringify(dataDiariaDobradaOriginal) !== JSON.stringify(dataDiariaDobradaAtual)) ||
                //logAndCheck('Datas Meia Diária', JSON.stringify(dataMeiaDiariaOriginal), JSON.stringify(dataMeiaDiariaAtual), JSON.stringify(dataMeiaDiariaOriginal) !== JSON.stringify(dataMeiaDiariaAtual)) ||

                logAndCheck(
                    'Datas Diária Dobrada', 
                    JSON.stringify(dataDiariaDobradaOriginalLimpa), 
                    JSON.stringify(dataDiariaDobradaAtual), 
                    JSON.stringify(dataDiariaDobradaOriginalLimpa) !== JSON.stringify(dataDiariaDobradaAtual)
                ) ||
                logAndCheck(
                    'Datas Meia Diária', 
                    JSON.stringify(dataMeiaDiariaOriginalLimpa), 
                    JSON.stringify(dataMeiaDiariaAtual), 
                    JSON.stringify(dataMeiaDiariaOriginalLimpa) !== JSON.stringify(dataMeiaDiariaAtual)
                ) ||

                logAndCheck('Status Diária Dobrada', (currentEditingStaffEvent.statusdiariadobrada || '').trim(), (statusDiariaDobrada|| '').trim(), (currentEditingStaffEvent.statusdiariadobrada || '').trim() != (statusDiariaDobrada|| '').trim()) ||
                logAndCheck('Status Meia Diária', (currentEditingStaffEvent.statusmeiadiaria || '').trim(), (statusMeiaDiaria|| '').trim(), (currentEditingStaffEvent.statusmeiadiaria || '').trim() != (statusMeiaDiaria|| '').trim()) ||
                logAndCheck('Nível Experiência', (currentEditingStaffEvent.nivelexperiencia || '').trim(), nivelExperienciaAtual.trim(), (currentEditingStaffEvent.nivelexperiencia || '').trim() != nivelExperienciaAtual.trim()) ||
                logAndCheck('Qtd Pessoas', currentEditingStaffEvent.qtdpessoas || 0, qtdPessoasAtual || 0, (currentEditingStaffEvent.qtdpessoas || 0) != (qtdPessoasAtual || 0));
        
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
                    //headers: { 'Content-Type': 'application/json' },
                    body: formData
                });

                // 🛑 Reabilita o botão após o sucesso do FETCH
                const botaoEnviar = document.getElementById("botaoEnviar");
                if (botaoEnviar) {
                    botaoEnviar.disabled = false;
                    botaoEnviar.textContent = 'Salvar'; 
                }

                await Swal.fire("Sucesso!", respostaApi.message || "Staff salvo com sucesso.", "success");

                // 1. RECUPERAÇÃO DO ESTADO ORIGINAL:
                await carregarTabelaStaff(idFuncionario);
                window.StaffOriginal = null;

                // =========================================================================
                // 🛑 NOVO BLOCO DE PERGUNTA (Substituindo o antigo limparCamposStaff())
                // =========================================================================

                const result = await Swal.fire({
                    title: "Deseja continuar?",
                    text: "O cadastro foi concluído. Quer cadastrar mais um funcionário para o mesmo evento/função ou finalizar?",
                    icon: "question",
                    showCancelButton: true,
                    showDenyButton: true,
                    confirmButtonText: "Cadastrar mais um (Manter dados)",
                    cancelButtonText: "Finalizar e Sair", // Opção de fechar a modal
                    denyButtonText: "Cadastrar novo staff (Limpar tudo)", // Opção de cadastrar outro staff (limpar tudo)
                    reverseButtons: true,
                    focusCancel: true
                });
                
                if (result.isConfirmed) {
                    // Se escolheu "Cadastrar mais um (Manter dados)"
                    console.log("Usuário escolheu: Cadastrar mais um (Manter evento/função)");
                    
                    // Chama a nova função de limpeza parcial
                    if (typeof limparCamposStaffParcial === "function") {
                        limparCamposStaffParcial();
                    } else {
                        console.error("limparCamposStaffParcial não está definida. Limpando tudo.");
                        limparCamposStaff(); // Fallback para limpeza total
                    }

                } else if (result.isDenied) {
                    // Se escolheu "Cadastrar novo staff (Limpar tudo)"
                    console.log("Usuário escolheu: Cadastrar novo staff (Limpar tudo)");
                    limparCamposStaff(); // Sua função de limpeza total

                } else if (result.dismiss === Swal.DismissReason.cancel) {
                    // Se escolheu "Finalizar e Sair"
                    console.log("Usuário escolheu: Finalizar e Sair");
                    
                    // Chama a função global para fechar a modal
                    if (typeof fecharModal === "function") {
                        fecharModal();
                        window.location.reload();
                    } else {
                        // Fallback (se a fecharModal não estiver no escopo)
                        document.getElementById("modal-overlay").style.display = "none";
                        document.getElementById("modal-container").innerHTML = "";
                        document.body.classList.remove("modal-open");
                    }
                }
                
                // =========================================================================

            } catch (error) {
                console.error("❌ Erro ao enviar dados do funcionário:", error);
                
                // ❌ Reabilita o botão após o erro
                const botaoEnviar = document.getElementById("botaoEnviar");
                if (botaoEnviar) {
                    botaoEnviar.disabled = false;
                    botaoEnviar.textContent = 'Salvar'; 
                }
                
                Swal.fire("Erro", error.message || "Erro ao salvar funcionário.", "error");
            }
        })
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
    const setorParaBusca = setorInput.value.toUpperCase();
    const datasEventoRawValue = datasEventoInput ? datasEventoInput.value.trim() : '';
    console.log("DEBUG 1: RAW input de Datas Evento (d/m/Y):", datasEventoRawValue);
    const periodoDoEvento = getPeriodoDatas(datasEventoRawValue);
    console.log("DEBUG 2: Array final de Datas Evento (YYYY-MM-DD):", periodoDoEvento);

    // --- NOVO TRECHO PARA NÍVEL DE EXPERIÊNCIA ---
    const seniorChecked = document.getElementById('seniorCheck')?.checked;
    const plenoChecked = document.getElementById('plenoCheck')?.checked;
    const juniorChecked = document.getElementById('juniorCheck')?.checked;
    const baseChecked = document.getElementById('baseCheck')?.checked;
    const nivelSelecionado = seniorChecked || plenoChecked || juniorChecked || baseChecked; 
    // ----------------------------------------------

    console.log(`DEBUG 3: Validação Final - idEvento: ${!!idEvento}, idCliente: ${!!idCliente}, idFuncao: ${!!idFuncao}, Nível Selecionado: ${!!nivelSelecionado}, Datas count: ${periodoDoEvento.length}`);

    // Apenas chame a API se os campos obrigatórios estiverem preenchidos
    if (idEvento && idCliente && idLocalMontagem && idFuncao && periodoDoEvento.length > 0) {
        console.log("🟢 DEBUG: Chamando buscarEPopularOrcamento. Todos os critérios (incluindo Nível de Experiência) atendidos.");
        buscarEPopularOrcamento(idEvento, idCliente, idLocalMontagem, idFuncao, periodoDoEvento);    
    } else {
        console.log("🔴 DEBUG: Bloqueado. Um dos critérios obrigatórios está ausente ou `periodoDoEvento` está vazio.");
    }
    

}, 500);


async function buscarEPopularOrcamento(idEvento, idCliente, idLocalMontagem, idFuncao, datasEvento) {
    try {
        console.log("Buscando orçamento com os seguintes IDs:", { idEvento, idCliente, idLocalMontagem, idFuncao, datasEvento });

        // Reseta a decisão anterior sempre que buscar novo orçamento
        decisaoUsuarioDataFora = null; 

        const criteriosDeBusca = {
            idEvento,
            idCliente,
            idLocalMontagem,
            idFuncao,
            datasEvento: datasEvento || []
        };

        const dadosDoOrcamento = await fetchComToken('/staff/orcamento/consultar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(criteriosDeBusca)
        });

        orcamentoPorFuncao = {};   
        
        console.log('Dados do Orçamento Recebidos:', dadosDoOrcamento);

        if (!Array.isArray(dadosDoOrcamento) || dadosDoOrcamento.length === 0) {
            temOrcamento = false;
            controlarBotaoSalvarStaff(false); 
            Swal.fire({ icon: 'info', title: 'Nenhum Orçamento Encontrado', text: 'Não foram encontrados itens de orçamento.' });
            statusOrcamentoAtual = '';
            idOrcamentoAtual = null;
            return;
        }

        const statusDoOrcamento = dadosDoOrcamento[0].status;
        statusOrcamentoAtual = statusDoOrcamento;

        const idOrcamento = dadosDoOrcamento[0].idorcamento;
        idOrcamentoAtual = idOrcamento;

        const nrOrcamento = dadosDoOrcamento[0].nrorcamento;

        const liberadoCadastro = dadosDoOrcamento[0].contratarstaff;

        

       console.log('ID do Orçamento Atual:', idOrcamentoAtual, statusDoOrcamento, liberadoCadastro);

    

        if (statusDoOrcamento === 'A') {
            Swal.fire({ icon: 'warning', title: `Orçamento Sem Proposta`, text: 'Orçamento status A (Aberto). Não é possível cadastrar.' });
            temOrcamento = false;
            controlarBotaoSalvarStaff(false);
            return;
        }

        if (statusDoOrcamento === 'P' && !liberadoCadastro) {
            Swal.fire({ icon: 'warning', title: 'Orçamento Não liberado para Contratação', text: 'Orçamento em Proposta Sem liberação de Contratação. Não é possível cadastrar.' });
            temOrcamento = false;
            controlarBotaoSalvarStaff(false);
            return;
        }

        // --- 3. VALIDAÇÃO DE DATAS ESPECÍFICA POR FUNÇÃO ---
        const funcaoSelecionadaTexto = descFuncaoSelect.options[descFuncaoSelect.selectedIndex].text;
        console.log("Validando datas para:", funcaoSelecionadaTexto);

        const datasPermitidasParaFuncao = new Set();

        dadosDoOrcamento.forEach(item => {
            if (item.descfuncao === funcaoSelecionadaTexto) {
                if (item.datas_totais_orcadas && Array.isArray(item.datas_totais_orcadas)) {
                    item.datas_totais_orcadas.forEach(dataISO => {
                        const dataSimples = typeof dataISO === 'string' ? dataISO.split('T')[0] : '';
                        if (dataSimples) datasPermitidasParaFuncao.add(dataSimples);
                    });
                }
            }
        });

        const datasNaoOrcadas = [];
        for (const dataSelecionada of datasEvento) {
            if (!datasPermitidasParaFuncao.has(dataSelecionada)) {
                datasNaoOrcadas.push(dataSelecionada);
            }
        }

        // --- 4. TRATAMENTO DE DATAS FORA DO ORÇAMENTO (BOTÕES SEPARADOS) ---
        // if (datasNaoOrcadas.length > 0) {
            
        //     const datasFormatadas = datasNaoOrcadas.map(data => {
        //         const [ano, mes, dia] = data.split('-');
        //         return `${dia}/${mes}/${ano}`;
        //     }).join(', ');
            
        //     console.warn("Datas fora do orçamento:", datasNaoOrcadas);

        //     // Configuração do Swal com 3 botões
        //     const result = await Swal.fire({
        //         icon: 'question', // Ícone de pergunta é mais adequado para escolha
        //         title: 'Datas Fora do Orçamento',
        //         html: `A função <b>${funcaoSelecionadaTexto}</b> não possui orçamento para: <br><b style="color:red">${datasFormatadas}</b>.<br><br>Como deseja prosseguir?`,
                
        //         // Configuração dos Botões
        //         showCancelButton: true,
        //         showDenyButton: true, // Habilita o terceiro botão
                
        //         confirmButtonText: 'Solicitar Aditivo ($)',
        //         denyButtonText: 'Extra Bonificado (Grátis)',
        //         cancelButtonText: 'Cancelar',
                
        //         confirmButtonColor: '#28a745', // Verde (Dinheiro/Aditivo)
        //         denyButtonColor: '#17a2b8',    // Azul ou Laranja (Bonificado)
        //         cancelButtonColor: '#d33',     // Vermelho (Cancelar)
                
        //         allowOutsideClick: false,      // Obriga o usuário a decidir
        //         allowEscapeKey: false
        //     });

        //     if (result.isConfirmed) {
        //         // --- OPÇÃO 1: ADITIVO ---
        //         console.log("Usuário escolheu: ADITIVO");
        //         decisaoUsuarioDataFora = 'ADITIVO'; // Salva na variável global
                
        //         temOrcamento = true;
        //         mostrarStatusComoPendente('StatusAditivo')
        //         controlarBotaoSalvarStaff(true);

        //     } else if (result.isDenied) {
        //         // --- OPÇÃO 2: EXTRA BONIFICADO ---
        //         console.log("Usuário escolheu: EXTRA BONIFICADO");
        //         decisaoUsuarioDataFora = 'EXTRA'; // Salva na variável global
                
        //         temOrcamento = true;
        //         mostrarStatusComoPendente('StatusExtraBonificado');
        //         controlarBotaoSalvarStaff(true);

        //     } else {
        //         // --- OPÇÃO 3: CANCELAR ---
        //         console.log("Usuário Cancelou");
        //         temOrcamento = false;
        //         controlarBotaoSalvarStaff(false);
                
        //         if (window.flatpickrInstances && window.flatpickrInstances['datasEvento']) {
        //             window.flatpickrInstances['datasEvento'].clear();
        //         }
        //         decisaoUsuarioDataFora = null;
        //         return; 
        //     }
        // } else {
        //     // Datas Ok
        //     temOrcamento = true;
        //     controlarBotaoSalvarStaff(true);
        // }

        // // --- 5. POPULAR OBJETO GLOBAL ---
        // dadosDoOrcamento.forEach(item => {
        //     const chave = `${item.nmevento}-${item.nmcliente}-${item.nmlocalmontagem}-${item.descfuncao}`;
        //     if (!orcamentoPorFuncao[chave]) {
        //         orcamentoPorFuncao[chave] = {
        //             quantidadeOrcada: Number(item.quantidade_orcada), 
        //             quantidadeEscalada: Number(item.quantidade_escalada),
        //             idOrcamento: item.idOrcamento,
        //             idFuncao: item.idFuncao
        //         };
        //     } else {
        //         orcamentoPorFuncao[chave].quantidadeOrcada += Number(item.quantidade_orcada);
        //     }
        // });

        if (datasNaoOrcadas.length > 0) {
            const datasFormatadas = datasNaoOrcadas.map(data => {
                const [ano, mes, dia] = data.split('-');
                return `${dia}/${mes}/${ano}`;
            }).join(', ');
            
            console.warn("Datas fora do orçamento:", datasNaoOrcadas);

            // 1. Pergunta o tipo de solicitação
            const result = await Swal.fire({
                icon: 'question',
                title: 'Datas Fora do Orçamento',
                html: `A função <b>${funcaoSelecionadaTexto}</b> não possui orçamento para: <br><b style="color:red">${datasFormatadas}</b>.<br><br>Como deseja prosseguir?`,
                showCancelButton: true,
                showDenyButton: true,
                confirmButtonText: 'Solicitar Aditivo ($)',
                denyButtonText: 'Extra Bonificado (Grátis)',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#28a745',
                denyButtonColor: '#17a2b8',
                cancelButtonColor: '#d33',
                allowOutsideClick: false,
                allowEscapeKey: false
            });

            let tipoParaSolicitar = '';

            if (result.isConfirmed) {
                tipoParaSolicitar = 'Aditivo';
            } else if (result.isDenied) {
                tipoParaSolicitar = 'Extra Bonificado';
            } else {
                // OPÇÃO: CANCELAR
                console.log("Usuário Cancelou no primeiro nível");
                cancelarProcessoOrcamento();
                return; 
            }

            // 2. Chama o modal de quantidade e justificativa
            // Importante: passamos 'idFuncao' que vem dos argumentos da sua função buscarEPopularOrcamento
            const resultadoExcecao = await solicitarDadosExcecao(
                tipoParaSolicitar, 
                idOrcamentoAtual, 
                funcaoSelecionadaTexto, 
                idFuncao 
            );

            // 3. Valida se a gravação no banco (via AJAX) deu certo
            if (resultadoExcecao && resultadoExcecao.sucesso) {
                console.log(`Sucesso ao registrar ${tipoParaSolicitar}`);
                decisaoUsuarioDataFora = (tipoParaSolicitar === 'Aditivo' ? 'ADITIVO' : 'EXTRA');
                
                temOrcamento = true;
                const statusElemento = (tipoParaSolicitar === 'Aditivo' ? 'StatusAditivo' : 'StatusExtraBonificado');
                mostrarStatusComoPendente(statusElemento);
                controlarBotaoSalvarStaff(true);
                
                Swal.fire('Solicitado!', `A solicitação de ${tipoParaSolicitar} foi registrada com sucesso.`, 'success');
            } else {
                // Se o usuário cancelou o segundo modal ou deu erro no salvarSolicitacaoAditivoExtra
                console.log("Solicitação cancelada ou falhou:", resultadoExcecao.erro);
                if (!resultadoExcecao.cancelado) {
                    Swal.fire('Erro', 'Não foi possível salvar a solicitação: ' + resultadoExcecao.erro, 'error');
                }
                cancelarProcessoOrcamento();
                return;
            }

        } else {
            // Datas Ok
            temOrcamento = true;
            controlarBotaoSalvarStaff(true);
        }

        // Função auxiliar interna para limpar campos em caso de cancelamento
        function cancelarProcessoOrcamento() {
            temOrcamento = false;
            controlarBotaoSalvarStaff(false);
            if (window.flatpickrInstances && window.flatpickrInstances['datasEvento']) {
                window.flatpickrInstances['datasEvento'].clear();
            }
            decisaoUsuarioDataFora = null;
        }

        // // --- 5. POPULAR OBJETO GLOBAL ---
        dadosDoOrcamento.forEach(item => {
            const chave = `${item.nmevento}-${item.nmcliente}-${item.nmlocalmontagem}-${item.descfuncao}`;
            if (!orcamentoPorFuncao[chave]) {
                orcamentoPorFuncao[chave] = {
                    quantidadeOrcada: Number(item.quantidade_orcada), 
                    quantidadeEscalada: Number(item.quantidade_escalada),
                    idOrcamento: item.idOrcamento,
                    idFuncao: item.idFuncao
                };
            } else {
                orcamentoPorFuncao[chave].quantidadeOrcada += Number(item.quantidade_orcada);
            }
        });

    } catch (error) {
        console.error("Erro:", error);
        // Tratamento de erro padrão...
    }
}

// Adicione esta função em Staff.js
/**
 * Torna o campo de status visível e define seu valor inicial como 'Pendente'.
 * Deve ser chamada após uma solicitação ser criada (ex: confirmação do Swal).
 * @param {string} statusType - O tipo de status (ex: 'StatusAditivo' ou 'StatusExtraBonificado').
 */
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
                const plenoCheck = document.getElementById("plenoCheck") || document.getElementById("Plenocheck"); 
                const juniorCheck = document.getElementById("juniorCheck") || document.getElementById("Juniorcheck"); 
                const baseCheck = document.getElementById("baseCheck") || document.getElementById("Basecheck"); 
                
                if (seniorCheck) seniorCheck.checked = false;
                if (plenoCheck) plenoCheck.checked = false;
                if (juniorCheck) juniorCheck.checked = false;
                if (baseCheck) baseCheck.checked = false;

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
                if (descFuncao === "AJUDANTE DE MARCAÇÃO") {
                    console.log(`🟡 REGRA FUNÇÃO ATIVA: ${descFuncao}. Trava no Base e Custo Base.`);
                    
                    // 1. Marca/Trava o "Base"
                    if (baseCheck) baseCheck.checked = true;
                    if (seniorCheck) seniorCheck.disabled = true;
                    if (plenoCheck) plenoCheck.disabled = true;
                    if (juniorCheck) juniorCheck.disabled = true;
                    if (baseCheck) baseCheck.disabled = false; 
                    
                    // 2. Preenche os custos com o valor Base da Função
                    document.getElementById("vlrCusto").value = (parseFloat(vlrCustoBaseFuncao) || 0).toFixed(2).replace('.', ',');
                    document.getElementById("alimentacao").value = (parseFloat(vlrAlimentacaoFuncao) || 0).toFixed(2).replace('.', ','); 
                    document.getElementById("transporte").value = (parseFloat(vlrTransporteFuncao) || 0).toFixed(2).replace('.', ',');
                    
                    if (typeof calcularValorTotal === 'function') {
                        calcularValorTotal();
                    }
                    
                } 
                // Verifica se o perfil é INTERNO ou EXTERNO
                else if(perfilSelecionado === "INTERNO" || perfilSelecionado === "EXTERNO") { 
                    console.log(`🔴 REGRA PERFIL ATIVA: Perfil 'FUNCIONARIO' (${perfilSelecionado}) detectado.`);
                    // 💡 DEBUG: Confira o valor que foi lido do atributo 'data-vlrfuncionario':
                    console.log(`💡 DEBUG: vlrFuncionario lido: ${vlrFuncionario}`);

                    // 1. Marca/Trava o "Base"
                    if (baseCheck) baseCheck.checked = true;
                    if (seniorCheck) seniorCheck.disabled = true;
                    if (plenoCheck) plenoCheck.disabled = true;
                    if (juniorCheck) juniorCheck.disabled = true;
                    if (baseCheck) baseCheck.disabled = false; 

                    // 2. Preenche os custos com o vlrFuncionario
                    // 🟢 CORREÇÃO CRÍTICA: Usando o nome de variável CONSISTENTE (vlrFuncionario)
                    document.getElementById("vlrCusto").value = (parseFloat(vlrFuncionario) || 0).toFixed(2).replace('.', ',');
                    document.getElementById("alimentacao").value = (parseFloat(vlrAlimentacaoFuncao) || 0).toFixed(2).replace('.', ','); 
                    document.getElementById("transporte").value = (parseFloat(vlrTransporteFuncao) || 0).toFixed(2).replace('.', ',');
                    
                    if (typeof calcularValorTotal === 'function') {
                        calcularValorTotal();
                    }

                }
                // Perfil/Função Padrão (FREELANCER, LOTE, ou Função/Perfil padrão)
                else{
                    console.log("🟢 PERFIL/FUNÇÃO PADRÃO: Habilita Checkboxes e chama onCriteriosChanged.");
                    
                    // 1. Re-habilita todos os checkboxes
                    if (seniorCheck) seniorCheck.disabled = false;
                    if (plenoCheck) plenoCheck.disabled = false;
                    if (juniorCheck) juniorCheck.disabled = false;
                    if (baseCheck) baseCheck.disabled = false;
                    
                    // 2. Chama onCriteriosChanged para preencher os valores de custo inicial
                    if (typeof onCriteriosChanged === 'function') {
                        onCriteriosChanged();
                    }
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
        console.log("ENTROU NO CARREGAR FUNCIONARIO STAFF", funcionariofetch);

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
            //    limparCamposEvento();

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
                if (perfilSelecionado) {
                    labelFuncionario.style.display = "block"; // sempre visível                    
                    
                    if (perfilSelecionado.toLowerCase() === "freelancer") {
                        isLote = false;
                        labelFuncionario.textContent = "FREE-LANCER";
                        labelFuncionario.style.color = "red";
                    } if ((perfilSelecionado.toLowerCase() === "interno") || (perfilSelecionado.toLowerCase() === "externo")) {
                        isLote = false;
                        labelFuncionario.textContent = "FUNCIONÁRIO";
                        labelFuncionario.style.color = "green"
                        descBeneficioTextarea.value = "Cachê é pago se escala cair em Fim de Semana ou Feriado";

                    }else if (perfilSelecionado.toLowerCase() === "lote") {
                        isLote = true;
                        labelFuncionario.textContent = "LOTE";
                        labelFuncionario.style.color = "blue";                    
                    }
                } else {
                    labelFuncionario.style.display = "none"; // se não tiver perfil
                }

                if (perfilSelecionado && perfilSelecionado.toLowerCase() === 'lote') {
                    qtdPessoasDiv.style.display = 'block';
                } else {
                    qtdPessoasDiv.style.display = 'none';
                    // Limpa o valor do input quando ele é escondido
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

               carregarPavilhaoStaff(idMontagemSelecionado);

            });

        });
    }catch(error){
        console.error("Erro ao carregar localmontagem:", error);
    }
}


async function carregarPavilhaoStaff(idMontagem) {
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
        const pavilhaofetch = await fetchComToken(`/staff/pavilhao?idmontagem=${idMontagem}`);
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
    } catch (error) {
        console.error("❌ Erro ao carregar pavilhao:", error);
    }
}

function limparCamposEvento() {
    console.log("Limpeza parcial do formulário iniciada (apenas campos do evento).");

    const btn = document.getElementById('Enviar');
    if (btn) {
        btn.style.display = 'block'; // Ou 'block', dependendo do seu fluxo
        btn.disabled = false;
    }

    // Lista de campos que se referem a um evento específico
    const camposEvento = [
        "idStaff", "descFuncao", "vlrCusto", "ajusteCusto", "transporte", "alimentacao", "caixinha",
        "nmLocalMontagem", "nmPavilhao", "descBeneficio", "descAjusteCusto", "nmCliente", "nmEvento", "vlrTotal",
        "vlrTotalHidden", "idFuncao", "idMontagem", "idPavilhao", "idCliente", "idEvento", "statusPgto",
        "statusAjusteCusto", "statusCaixinha", "statusDiariaDobrada", "descDiariaDobrada", "statusMeiaDiaria",
        "descMeiaDiaria", "qtdPessoas","idequipe","nmEquipe"
    ];

    camposEvento.forEach(id => {
        const campo = document.getElementById(id);
        if (campo) {
            campo.value = "";
            // console.log(`Campo "${id}" limpo.`); // Descomente para debug
        }
    });
    
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

    const check50 = document.getElementById('check50');
    if (check50) check50.checked = false;

    const check100 = document.getElementById('check100');
    if (check100) check100.checked = false;

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

    document.getElementById('statusCaixinha').value = 'Autorização da Caixinha';

    document.getElementById('statusAjusteCusto').value = 'Autorização do Ajuste de Custo';

    document.getElementById('statusDiariaDobrada').value = 'Autorização de Diária Dobrada';
    document.getElementById('descDiariaDobrada').value = '';
    document.getElementById('campoStatusDiariaDobrada').style.display = 'none';

    document.getElementById('statusMeiaDiaria').value = 'Autorização de Meia Diária';
    document.getElementById('descMeiaDiaria').value = '';
    document.getElementById('campoStatusMeiaDiaria').style.display = 'none';

    // Garanta que os containers opcionais sejam ocultados
    document.getElementById('campoAjusteCusto').style.display = 'none';
    document.getElementById('campoCaixinha').style.display = 'none';
    document.getElementById('campoStatusCaixinha').style.display = 'none';
    document.getElementById('campoPgtoCaixinha').style.display = 'none';


    if (window.diariaDobradaPicker) {
        window.diariaDobradaPicker.clear(); 
    }
    if (window.meiaDiariaPicker) {
        window.meiaDiariaPicker.clear();
    }
    if (window.datasEventoPicker) {
        window.datasEventoPicker.clear();
    }

    // Limpa o objeto em memória do staff original
    limparStaffOriginal();

    console.log("Limpeza parcial do formulário concluída.");
}

function limparCamposStaff() {
    const campos = [
        "idStaff", "nmFuncionario", "apelidoFuncionario", "linkFotoFuncionarios", "descFuncao", "vlrCusto",
        "nmLocalMontagem", "nmPavilhao", "alimentacao", "transporte", "vlrBeneficio", "descBeneficio",
        "nmCliente", "nmEvento", "vlrTotal", "vlrTotalHidden", "idFuncionario", "idFuncao", "idMontagem",
        "idPavilhao", "idCliente", "idEvento", "statusPgto", "statusCaixinha", "statusAjusteCusto", "statusDiariaDobrada",
        "descDiariaDobrada", "statusMeiaDiaria", "descMeiaDiaria", "labelFuncionario", "perfilFuncionario", "qtdPessoas",
        "idequipe","nmEquipe"
    ];

    const btn = document.getElementById('Enviar');
    if (btn) {
        btn.style.display = 'block'; // Ou 'block', dependendo do seu fluxo
        btn.disabled = false;
    }
    
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
        labelFuncionario.textContent = "";    // limpa o texto
        labelFuncionario.style.color = "";    // reseta cor
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

    const contadorDatas = document.getElementById('contadorDatas');

    if (contadorDatas) {
        contadorDatas.textContent = "Nenhuma data selecionada.";
    }

    // Limpeza do Picker Principal (Datas do Evento)
    if (window.datasEventoPicker) {
        window.datasEventoPicker.clear();
        // O MutationObserver deve pegar a alteração no contadorDatas, 
        // mas é bom garantir que o contador reflita a limpeza.
        if (contadorDatas) {
            contadorDatas.textContent = "Nenhuma data selecionada."; 
        }
        console.log("Datas do evento limpas via Flatpickr.");
    }
    
    // Limpeza dos Pickers Auxiliares (Diária Dobrada e Meia Diária)
    if (window.diariaDobradaPicker) {
        window.diariaDobradaPicker.clear();
    }

    if (window.meiaDiariaPicker) {
        window.meiaDiariaPicker.clear();
    }
    console.log("Pickers auxiliares (Diária Dobrada e Meia Diária) limpos.");

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
    const campoPgtoCaixinha = document.getElementById('campoPgtoCaixinha');


    if (ajusteCustoCheck) {
        ajusteCustoCheck.checked = false;
        if (campoAjusteCusto) campoAjusteCusto.style.display = 'none';
        const inputAjusteCusto = document.getElementById('ajusteCusto');
        if (inputAjusteCusto) inputAjusteCusto.value = '';

        const ajusteCustoTextarea = document.getElementById('descAjusteCusto');
        if (ajusteCustoTextarea) {
            ajusteCustoTextarea.style.display = 'none'; // Oculta o textarea
            ajusteCustoTextarea.required = false;    // Remove a obrigatoriedade
            ajusteCustoTextarea.value = '';        // Limpa o conteúdo
        }

        if (campoStatusAjusteCusto) campoStatusAjusteCusto.style.display = 'none';

    }
    if (caixinhaCheck) {
        caixinhaCheck.checked = false;
        if (campoCaixinha) campoCaixinha.style.display = 'none';
        const inputCaixinha = document.getElementById('caixinha');
        if (inputCaixinha) inputCaixinha.value = '';
        if (campoStatusCaixinha) campoStatusCaixinha.style.display = 'none';

        const descCaixinhaTextarea = document.getElementById('descCaixinha');
        if (descCaixinhaTextarea) {
            descCaixinhaTextarea.style.display = 'none'; // Oculta o textarea
            descCaixinhaTextarea.required = false;   // Remove a obrigatoriedade
            descCaixinhaTextarea.value = '';       // Limpa o conteúdo
        }

        if (campoStatusCaixinha) campoStatusCaixinha.style.display = 'none';
        if (campoPgtoCaixinha) campoPgtoCaixinha.style.display = 'none';
    }

    const campoMeiaDiaria = document.getElementById('campoMeiaDiaria');
    const campoStatusMeiaDiaria = document.getElementById('campoStatusMeiaDiaria');
    const meiaDiariaCheck = document.getElementById('meiaDiariacheck');
    
    if (meiaDiariaCheck){
        meiaDiariaCheck.checked = false;
        
        if (campoMeiaDiaria) campoMeiaDiaria.style.display = 'none';
        const inputMeiaDiaria = document.getElementById('meiaDiaria');
        if (inputMeiaDiaria) inputMeiaDiaria.value = '';
        if (campoStatusMeiaDiaria) campoStatusMeiaDiaria.style.display = 'none';

        const descMeiaDiariaTextarea = document.getElementById('descMeiaDiaria');
        if (descMeiaDiariaTextarea) {
            descMeiaDiariaTextarea.style.display = 'none'; // Oculta o textarea
            descMeiaDiariaTextarea.required = false;     // Remove a obrigatoriedade
            descMeiaDiariaTextarea.value = '';     // Limpa o conteúdo
        }
    } 

    const campoDiariaDobrada = document.getElementById('campoDiariaDobrada');
    const campoStatusDiariaDobrada = document.getElementById('campoStatusDiariaDobrada');
    const diariaDobradacheck = document.getElementById('diariaDobradacheck');
    
    if (diariaDobradacheck){
        diariaDobradacheck.checked = false;
        if (campoDiariaDobrada) campoDiariaDobrada.style.display = 'none';
        const inputDiariaDobrada = document.getElementById('diariaDobrada');
        if (inputDiariaDobrada) inputDiariaDobrada.value = '';
        if (campoStatusDiariaDobrada) campoStatusDiariaDobrada.style.display = 'none';
        
        const descDiariaDobradaTextarea = document.getElementById('descDiariaDobrada');
        if (descDiariaDobradaTextarea) {
            descDiariaDobradaTextarea.style.display = 'none'; // Oculta o textarea
            descDiariaDobradaTextarea.required = false;      // Remove a obrigatoriedade
            descDiariaDobradaTextarea.value = '';      // Limpa o conteúdo
        }
    } 

    // O trecho abaixo estava duplicado ou incorreto, removido/corrigido.
    // O trecho com 'meiaDiariacheck' e 'campoDiariaDobrada' estava logicamente incorreto.
    // O `meiaDiariacheck` já foi tratado no bloco `meiaDiariaCheck`.
    
    // if (meiaDiariacheck){
    //     meiaDiariacheck.checked = false;
    //     if (meiaDiariacheck) campoDiariaDobrada.style.display = 'none'; // ERROR: está referenciando campoDiariaDobrada
    //     const inputMeiaDiaria = document.getElementById('meiaDiaria');
    //     if (inputMeiaDiaria) iinputMeiaDiaria.value = ''; // ERROR: iinputMeiaDiaria
    //     if (campoStatusMeiaDiaria) campoStatusMeiaDiaria.style.display = 'none';
        
    //     const descMeiaDiariaTextarea = document.getElementById('descDiariaDobrada'); // ERROR: descDiariaDobrada
    //     if (descMeiaDiariaTextarea) {
    //         descMeiaDiariaTextarea.style.display = 'none'; 
    //         descMeiaDiariaTextarea.required = false;      
    //         descMeiaDiariaTextarea.value = '';      
    //     }
        
    //     if (campoStatusMeiaDiaria) ampoStatusMeiaDiaria.style.display = 'none'; // ERROR: ampoStatusMeiaDiaria
    // } 

    const check50 = document.getElementById('check50');
    const check100 = document.getElementById('check100');
    
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

    const viagem1Check = document.getElementById('viagem1Check');
    if (viagem1Check) viagem1Check.checked = false;

    const viagem2Check = document.getElementById('viagem2Check');
    if (viagem2Check) viagem2Check.checked = false;

    const viagem3Check = document.getElementById('viagem3Check');
    if (viagem3Check) viagem3Check.checked = false;

    const beneficioTextarea = document.getElementById('descBeneficio');
    if (beneficioTextarea) {
        beneficioTextarea.style.display = 'none'; // Oculta o textarea
        beneficioTextarea.required = false;      // Remove a obrigatoriedade
        beneficioTextarea.value = '';      // Limpa o conteúdo
    }

    const descAjusteCustoTextarea = document.getElementById('descAjusteCusto');
    if (descAjusteCustoTextarea) {
        descAjusteCustoTextarea.style.display = 'none'; // Oculta o textarea
        descAjusteCustoTextarea.required = false;    // Remove a obrigatoriedade
        descAjusteCustoTextarea.value = '';        // Limpa o conteúdo
    }

    const descCaixinhaTextarea = document.getElementById('descCaixinha');
    if (descCaixinhaTextarea) {
        descCaixinhaTextarea.style.display = 'none'; // Oculta o textarea
        descCaixinhaTextarea.required = false;   // Remove a obrigatoriedade
        descCaixinhaTextarea.value = '';       // Limpa o conteúdo
    }

    // 🎯 CORREÇÃO: Alinhando a string para 'Autorização de...' para bater com a lógica de salvamento
    const statusMeiaDiaria = document.getElementById('statusMeiaDiaria');
    if (statusMeiaDiaria) statusMeiaDiaria.value = 'Autorização de Meia Diária'; // <-- Corrigido para "de"

    // 🎯 CORREÇÃO: Alinhando a string para 'Autorização de...' para bater com a lógica de salvamento
    const statusDiariaDobrada = document.getElementById('statusDiariaDobrada');
    if (statusDiariaDobrada) statusDiariaDobrada.value = 'Autorização de Diária Dobrada'; // <-- Corrigido para "de"

    const statusPgto = document.getElementById('statuspgto');
    if (statusPgto) statusPgto.value = '';

    const statusAjusteCusto = document.getElementById('statusAjusteCusto');
    if (statusAjusteCusto) statusAjusteCusto.value = 'Autorização do Ajuste de Custo';

    const statusCaixinha = document.getElementById('statuscaixinha');
    if (statusCaixinha) statusCaixinha.value = 'Autorização da Caixinha';   

    const containerStatusDiariaDobrada = document.getElementById('containerStatusDiariaDobrada');
    const containerStatusMeiaDiaria = document.getElementById('containerStatusMeiaDiaria');
    const containerStatusAditivo = document.getElementById('containerStatusAditivo');
    const containerStatusExtraBonificado = document.getElementById('containerStatusExtraBonificado');

    if (containerStatusDiariaDobrada) {
        containerStatusDiariaDobrada.innerHTML = '';
        containerStatusDiariaDobrada.style.display = 'none';
    }

    if (containerStatusMeiaDiaria) {
        containerStatusMeiaDiaria.innerHTML = '';
        containerStatusMeiaDiaria.style.display = 'none';
    }

    
    if (containerStatusAditivo) {
        containerStatusAditivo.innerHTML = '';
        containerStatusAditivo.style.display = 'none';
    }

    if (containerStatusExtraBonificado) {
        containerStatusExtraBonificado.innerHTML = '';
        containerStatusExtraBonificado.style.display = 'none';
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

    const tabelaCorpo = document.getElementById("eventsDataTable") ? document.getElementById("eventsDataTable").getElementsByTagName("tbody")[0] : null;

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
        console.warn("Tabela com ID 'eventsDataTable' ou seu tbody não encontrado para limpeza. Verifique se o ID está correto.");
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

    const valorCaixinha = document.getElementById('caixinha').value;

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

  const campoPgtoCaixinha = document.getElementById('campoPgtoCaixinha');
  const inputStatusPgtoCaixinha = document.getElementById('statusPgtoCaixinha');

  if (this.checked) {
    campo.style.display = 'block';
    input.required = true;
    input.style.width = '170px'; // aplica largura total

    campoStatusCaixinha.style.display = 'block';
    inputStatusCaixinha.required = true;
    inputStatusCaixinha.style.width = '170px';

    campoPgtoCaixinha.style.display = 'block';
    inputStatusPgtoCaixinha.required = true;
    inputStatusPgtoCaixinha.style.width = '170px';
  } else {
    campo.style.display = 'none';
    input.value = '';
    input.required = false;

    campoStatusCaixinha.style.display = 'none';
    inputStatusCaixinha.value = '';
    inputStatusCaixinha.required = false;

    campoPgtoCaixinha.style.display = 'none';
    inputStatusPgtoCaixinha.value = '';
    inputStatusPgtoCaixinha.required = false;
  }
});


document.getElementById('Seniorcheck').addEventListener('change', function () {
    if (seniorCheck.checked) {
        // Lógica para quando o checkbox de Senior estiver marcado
        if (!validarCamposEssenciais()) {
            seniorCheck.checked = false; // Desmarca se a validação falhar
            return;
        }

        plenoCheck.checked = false;
        juniorCheck.checked = false;
        baseCheck.checked = false;

        //console.log("Valores para Senior - Custo:", vlrCustoSeniorFuncao, "Alimentação:", vlrAlimentacao, "Transporte:", vlrTransporteSeniorFuncao);
        document.getElementById("alimentacao").value = (parseFloat(vlrAlimentacaoFuncao) || 0).toFixed(2);
        document.getElementById("vlrCusto").value = (parseFloat(vlrCustoSeniorFuncao) || 0).toFixed(2); 
        document.getElementById("transporte").value = (parseFloat(vlrTransporteSeniorFuncao) || 0).toFixed(2);

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

document.getElementById('Plenocheck').addEventListener('change', function () {
    if (plenoCheck.checked) {
        // Lógica para quando o checkbox de Pleno estiver marcado
        if (!validarCamposEssenciais()) {
            plenoCheck.checked = false; // Desmarca se a validação falhar
            return;
        }
        seniorCheck.checked = false;
        juniorCheck.checked = false;
        baseCheck.checked = false;        
        
        document.getElementById("vlrCusto").value = (parseFloat(vlrCustoPlenoFuncao) || 0).toFixed(2);   
        document.getElementById("alimentacao").value = (parseFloat(vlrAlimentacaoFuncao) || 0).toFixed(2);
        document.getElementById("transporte").value = (parseFloat(vlrTransporteFuncao) || 0).toFixed(2);
    
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
    if (juniorCheck.checked) {
        // Lógica para quando o checkbox de Junior estiver marcado
        if (!validarCamposEssenciais()) {
            juniorCheck.checked = false; // Desmarca se a validação falhar
            return;
        }
        seniorCheck.checked = false;
        plenoCheck.checked = false;
        baseCheck.checked = false;

        document.getElementById("vlrCusto").value = (parseFloat(vlrCustoJuniorFuncao) || 0).toFixed(2); 
        document.getElementById("alimentacao").value = (parseFloat(vlrAlimentacaoFuncao) || 0).toFixed(2);  
        document.getElementById("transporte").value = (parseFloat(vlrTransporteFuncao) || 0).toFixed(2);
    
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
    if (baseCheck.checked) {
        // Lógica para quando o checkbox de Base estiver marcado

        if (!validarCamposEssenciais()) {
            baseCheck.checked = false; // Desmarca se a validação falhar
            return;
        }
        seniorCheck.checked = false;
        plenoCheck.checked = false;
        juniorCheck.checked = false;

        document.getElementById("vlrCusto").value = (parseFloat(vlrCustoBaseFuncao) || 0).toFixed(2);
        document.getElementById("alimentacao").value = (parseFloat(vlrAlimentacaoFuncao) || 0).toFixed(2);   
        document.getElementById("transporte").value = (parseFloat(vlrTransporteFuncao) || 0).toFixed(2);

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

function criarRegexRemocao(textoPuro) {
    const textoEscapado = textoPuro.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    // Encontra (opcional \n\n) + o texto
    return new RegExp("(\\n\\n)?" + textoEscapado, 'g');
}

// Regex para cada descrição
const REGEX_REMOCAO1 = criarRegexRemocao(DescViagem1);
const REGEX_REMOCAO2 = criarRegexRemocao(DescViagem2);
const REGEX_REMOCAO3 = criarRegexRemocao(DescViagem3);

document.getElementById('viagem1Check').addEventListener('change', function () { 
    let vlrAlimentacaoViagem = vlrAlimentacaoFuncao; 
    let descBeneficioAtual = descBeneficioTextarea.value;  
    descBeneficioAtual = limparDescricoesViagem(descBeneficioAtual);

    document.getElementById("alimentacao").value = (parseFloat(vlrAlimentacaoViagem) || 0).toFixed(2);
    document.getElementById("transporte").value = (parseFloat(vlrTransporteFuncao) || 0).toFixed(2);

    if (viagem1Check.checked) {
        // Lógica para quando o checkbox de Viagem 1 estiver marcado
        viagem2Check.checked = false;
        if (typeof viagem3Check !== 'undefined') viagem3Check.checked = false;
        vlrAlimentacaoViagem = vlrAlimentacaoViagem * 2 ;
        document.getElementById("alimentacao").value = (parseFloat(vlrAlimentacaoViagem) || 0).toFixed(2);
        document.getElementById("transporte").value = (0).toFixed(2);
        

        console.log("Descrição atual antes da modificação:", descBeneficioTextarea.value);        

        if (descBeneficioAtual) {
            descBeneficioAtual = descBeneficioAtual.trim();
        }
        if (descBeneficioAtual.includes(DescViagem1)) {
            descBeneficioAtual = descBeneficioAtual.replace(DescViagem1, "").trim();
        }
        let separador = "";
        if (descBeneficioAtual.length > 0) {
            // Se houver texto remanescente, adicione o separador \n\n
            separador = "\n\n";
        }
        // 2. Adiciona a descrição de viagem ao texto
        descBeneficioTextarea.value = descBeneficioAtual + separador + DescViagem1;

    }else {
        document.getElementById("alimentacao").value = (parseFloat(vlrAlimentacaoFuncao) || 0).toFixed(2);
        document.getElementById("transporte").value = (parseFloat(vlrTransporteFuncao) || 0).toFixed(2);

        // let descBeneficioAtual = descBeneficioTextarea.value;
    
        // // Escapa o texto para uso seguro no Regex
        // const DescViagem1Escapada = DescViagem1.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        
        // // Regex para remover (duas quebras de linha opcionais) + o texto da viagem
        // const regexRemover = new RegExp("(\\n\\n)?" + DescViagem1Escapada, 'g');

        // if (descBeneficioAtual.includes(DescViagem1)) {
            
        //     // Remove o texto e o separador que o precede (se existir)
        //     descBeneficioAtual = descBeneficioAtual.replace(regexRemover, "").trim();
            
        //     // **PASSO ESSENCIAL:** Atribui o texto limpo de volta à textarea
        //     descBeneficioTextarea.value = descBeneficioAtual;
        // }
        descBeneficioTextarea.value = descBeneficioAtual;
    }
    //console.log("Valores para Senior - Custo:", vlrCustoSeniorFuncao, "Alimentação:", vlrAlimentacao, "Transporte:", vlrTransporteSeniorFuncao);
 
});

document.getElementById('viagem2Check').addEventListener('change', function () { 
    let vlrAlimentacaoViagem = vlrAlimentacaoFuncao;  
    let descBeneficioAtual = descBeneficioTextarea.value;

    descBeneficioAtual = limparDescricoesViagem(descBeneficioAtual);
    document.getElementById("alimentacao").value = (parseFloat(vlrAlimentacaoFuncao) || 0).toFixed(2);
    document.getElementById("transporte").value = (parseFloat(vlrTransporteFuncao) || 0).toFixed(2);

    if (viagem2Check.checked) {
        // Lógica para quando o checkbox de Viagem 2 estiver marcado
        viagem1Check.checked = false;
        if (typeof viagem3Check !== 'undefined') viagem3Check.checked = false;
        vlrAlimentacaoViagem = (vlrAlimentacaoViagem * 2) + (vlrAlimentacaoViagem / 2) ;
        document.getElementById("alimentacao").value = (parseFloat(vlrAlimentacaoViagem) || 0).toFixed(2);
        document.getElementById("transporte").value = (0).toFixed(2);

        
        if (descBeneficioAtual) {
            descBeneficioAtual = descBeneficioAtual.trim();
        }
        if (descBeneficioAtual.includes(DescViagem2)) {
            descBeneficioAtual = descBeneficioAtual.replace(DescViagem2, "").trim();
        }
        let separador = "";
        if (descBeneficioAtual.length > 0) {
            // Se houver texto remanescente, adicione o separador \n\n
            separador = "\n\n";
        }

        // 2. Adiciona a descrição de viagem ao texto
        descBeneficioTextarea.value = descBeneficioAtual + separador +DescViagem2;

    }else {
        document.getElementById("alimentacao").value = (parseFloat(vlrAlimentacaoFuncao) || 0).toFixed(2);
        document.getElementById("transporte").value = (parseFloat(vlrTransporteFuncao) || 0).toFixed(2);

        
        // // Escapa o texto para uso seguro no Regex
        // const DescViagem2Escapada = DescViagem2.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');        
        // // Regex para remover (duas quebras de linha opcionais) + o texto da viagem
        // const regexRemover = new RegExp("(\\n\\n)?" + DescViagem2Escapada, 'g');
        // if (descBeneficioAtual.includes(DescViagem2)) {
        //     // Remove o texto e o separador que o precede (se existir)
        //     descBeneficioAtual = descBeneficioAtual.replace(regexRemover, "").trim();            
        //     // **PASSO ESSENCIAL:** Atribui o texto limpo de volta à textarea
        //     descBeneficioTextarea.value = descBeneficioAtual;
        // }

        descBeneficioTextarea.value = descBeneficioAtual;
    }
    
    //console.log("Valores para Senior - Custo:", vlrCustoSeniorFuncao, "Alimentação:", vlrAlimentacao, "Transporte:", vlrTransporteSeniorFuncao);
    
});

if (document.getElementById('viagem3Check')) {
    document.getElementById('viagem3Check').addEventListener('change', function () { 
        let descBeneficioAtual = descBeneficioTextarea.value;

        // Limpa todas as descrições de viagem (incluindo Viagem 1 e 2)
        descBeneficioAtual = limparDescricoesViagem(descBeneficioAtual);
        
        // Garante que o Transporte e Alimentação fiquem nos valores base da função (SEM ALTERAÇÃO)
        document.getElementById("alimentacao").value = (parseFloat(vlrAlimentacaoFuncao) || 0).toFixed(2);
        document.getElementById("transporte").value = (parseFloat(vlrTransporteFuncao) || 0).toFixed(2);

        if (viagem3Check.checked) {
            // Desmarca outras opções
            viagem1Check.checked = false;
            viagem2Check.checked = false;

            // Lógica de descrição
            if (descBeneficioAtual) {
                descBeneficioAtual = descBeneficioAtual.trim();
            }
            // Remove DescViagem3 primeiro, caso tenha sobrado alguma sujeira (redundância para segurança)
            if (descBeneficioAtual.includes(DescViagem3)) {
                descBeneficioAtual = descBeneficioAtual.replace(DescViagem3, "").trim();
            }
            
            let separador = "";
            if (descBeneficioAtual.length > 0) {
                // Se houver texto remanescente (não-viagem), adicione o separador \n\n
                separador = "\n\n";
            }
            
            // Adiciona a descrição de viagem local ao texto
            descBeneficioTextarea.value = descBeneficioAtual + separador + DescViagem3;

        } else {
            // Quando desmarca, apenas garante que o texto restante seja mantido
            descBeneficioTextarea.value = descBeneficioAtual;
        }
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
    const alimentacao = parseFloat(document.getElementById('alimentacao').value.replace(',', '.')) || 0;
    const ajusteCusto = parseFloat(document.getElementById('ajusteCusto').value.replace(',', '.')) || 0;
    const caixinha = parseFloat(document.getElementById('caixinha').value.replace(',', '.')) || 0;
    const perfilFuncionario = document.getElementById("perfilFuncionario").value;
    const qtdpessoas = parseInt(document.getElementById("qtdPessoas").value) || 1;


    if (isFormLoadedFromDoubleClick)
    {
        console.log("VALORES PARA RECALCULAR", vlrAlimentacaoDobra);
    }

    // Pega o número de diárias selecionadas
    const contadorTexto = document.getElementById('contadorDatas').innerText;
    const match = contadorTexto.match(/\d+/);
    const numeroDias = match ? parseInt(match[0]) : 0;

    const datasParaProcessar = window.datasEventoPicker 
        ? window.datasEventoPicker.selectedDates // Fonte de dados mais confiável: a instância Flatpickr
        : datasEventoSelecionadas; // Fallback para a variável global, se a instância não estiver disponível

    // Conta apenas o número de datas do evento
    console.log("Número de diárias:", contadorTexto, match, numeroDias, cache, ajusteCusto, transporte, alimentacao, caixinha, datasParaProcessar);

    // Inicializa o valor total com os itens que são sempre calculados
  
    let total = 0;
    let totalCache = 0; 
    let totalAjdCusto = 0;

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

    console.log("Total inicial (sem adicionais):", total.toFixed(2));

    // --- NOVA LÓGICA: INCLUIR VALORES APENAS SE AUTORIZADOS ---

    // 1. Verificação do Ajuste de Custo
    const statusAjusteCusto = document.getElementById("statusAjusteCusto").value;
    if (statusAjusteCusto === 'Autorizado') {
        total += ajusteCusto;
        totalCache += ajusteCusto;    
        console.log("Ajuste de Custo Autorizado. Adicionando:", ajusteCusto.toFixed(2));
    } else {
        console.log("Ajuste de Custo Não Autorizado. Não adicionado.");
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
    const valorLimpoCache = total.toFixed(2);

    document.getElementById('vlrTotalCache').value = valorFormatTotCache;
    document.getElementById('vlrTotalCacheHidden').value = valorLimpoCache;

    const valorFormatTotAjdCusto = 'R$ ' + totalAjdCusto.toFixed(2).replace('.', ',');
    const valorLimpoAjdCusto = total.toFixed(2);

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

/**
 * Verifica o limite de vagas orçadas para uma função.
 * Retorna um objeto de status para o cadastro.
 * * @param {object} criterios Critérios de filtro (nmEvento, nmFuncao, etc.).
 * @returns {Promise<{ allowed: boolean, statusAditivo: string | null, statusExtraBonificado: string | null }>}
 */
async function verificarLimiteDeFuncao(criterios) {
    // 1. Construa a chave composta
    //const chave = `${criterios.nmEvento}-${criterios.nmCliente}-${criterios.nmlocalMontagem}-${criterios.pavilhao || ''}-${criterios.nmFuncao}-${criterios.setor || ''}`;
    
    
    const nmEvento = (criterios.nmEvento || '').trim().toUpperCase();
    const nmCliente = (criterios.nmCliente || '').trim().toUpperCase();
    const nmlocalMontagem = (criterios.nmlocalMontagem || '').trim().toUpperCase();
    const pavilhao = (criterios.pavilhao || '').trim().toUpperCase();
    const nmFuncao = (criterios.nmFuncao || '').trim().toUpperCase();
    const setor = (criterios.setor || '').trim().toUpperCase();
   

    // Constrói uma lista de partes, excluindo partes que ficariam vazias (como pavilhao ou setor)
    const partesChave = [
        nmEvento,
        nmCliente,
        nmlocalMontagem,
        pavilhao, 
        nmFuncao,
        setor     
    ];

    // Filtra valores nulos, undefined ou strings vazias, e junta com um hífen.
    const chave = partesChave
        .filter(p => p) // Remove as strings vazias ('')
        .join('-'); // Junta as partes restantes com hífen

    // 💡 IMPORTANTE: Tente limpar o final da chave, se for o caso do ' 1'
    // Se você tem certeza que o ' 1' vem do campo nmFuncao e não deveria estar lá,
    // você precisará limpar a variável 'nmFuncao' ANTES de incluí-la no array.
    // Exemplo: const nmFuncaoLimpa = nmFuncao.replace(/\s\d+$/, ''); 
    
    // Assumindo que a chave no orcamentoPorFuncao NÃO tem o ' 1' no final:
    const chaveSemNumerosFinais = chave.replace(/(\s\d+)$/, ''); 
    
    const dadosOrcamento = orcamentoPorFuncao[chaveSemNumerosFinais] || orcamentoPorFuncao[chave];
    // Tenta primeiro com a chave limpa, depois com a chave original (se não for o problema)


    console.log("Verificando limite para a chave:", chave, dadosOrcamento);
    // const dadosOrcamento = orcamentoPorFuncao[chave];

    // console.log("Verificando limite para a chave:", chave, dadosOrcamento);

    // Se não houver dados de orçamento para ESTA COMBINAÇÃO ÚNICA, não há limite
    if (!dadosOrcamento) {
        console.warn("⚠️ ORÇAMENTO NÃO ENCONTRADO para a chave:", chave);
        // Retorno de sucesso (Permitido, sem status especial)
        return { allowed: true, statusAditivo: null, statusExtraBonificado: null };
    }

    // 2. Conte quantos funcionários já foram inseridos na tabela com EXATAMENTE esses critérios
    let countNaTabela = 0;
    const linhasTabela = document.querySelectorAll('#eventsTableBody tr');
    linhasTabela.forEach(linha => {
        const eventDataNaLinha = JSON.parse(linha.dataset.eventData);
        if (
            eventDataNaLinha.nmfuncao.trim().toUpperCase() === criterios.nmFuncao.toUpperCase().trim() &&
            eventDataNaLinha.nmevento.trim().toUpperCase() === criterios.nmEvento.toUpperCase().trim() &&
            eventDataNaLinha.nmcliente.trim().toUpperCase() === criterios.nmCliente.toUpperCase().trim() &&
            eventDataNaLinha.nmlocalmontagem.trim().toUpperCase() === criterios.nmlocalMontagem.toUpperCase().trim() &&
            // Incluindo Pavilhão e Setor na contagem
            (eventDataNaLinha.pavilhao || '').trim().toUpperCase() === (criterios.pavilhao || '').toUpperCase().trim() &&
            (eventDataNaLinha.setor || '').trim().toUpperCase() === (criterios.setor || '').toUpperCase().trim()
        ) {
            countNaTabela++;
        }
    });

    // 3. Calcule o total ocupado e proposto
    const totalJaOcupado = Number(dadosOrcamento.quantidadeEscalada) + countNaTabela;
    const limite = dadosOrcamento.quantidadeOrcada;

    // Calcule o total proposto: slots ocupados + 1 (o item que está sendo submetido)
    const totalProposto = totalJaOcupado + 1;

    console.log(`Verificando para a combinação '${chave}' - Ocupado: ${totalJaOcupado}, Limite: ${limite}, Proposto: ${totalProposto}`);

    // --- LÓGICA DE LIMITE ---

    // if (totalProposto > limite) {
        
    //     // 🚨 NOVO BLOQUEIO DE SEGURANÇA: Se exceder o limite em mais de 1, bloqueia.
    //     // Assumimos que o Aditivo/Extra permite APENAS +1 acima do limite orçado.
    //     //if (totalProposto > limite + 1) {
    //     // if (totalProposto > limite) {
    //     //     Swal.fire({
    //     //         icon: 'error',
    //     //         title: 'Limite Máximo Excedido',
    //     //         text: `O cadastro excede o limite orçado para a vaga. (Limite Orçado: ${limite}) - (Ocupado: ${totalJaOcupado}) - (Proposto: ${totalProposto}).`
    //     //     });
    //     //     // Retorno de bloqueio
    //     //     return { allowed: false, statusAditivo: null, statusExtraBonificado: null };
    //     // }
        
    //     // 💡 LIMITE ATINGIDO: Apresenta os botões Aditivo/Extra Bonificado (Assíncrono)
    //     return new Promise(resolve => {
    //         Swal.fire({
    //             icon: 'info',
    //             title: 'Limite Orçamentário Atingido',
    //             //html: `O limite de **${limite}** para esta função já foi alcançado. <br>Existem ${dadosOrcamento.quantidadeEscalada} funcionários já salvos e ${countNaTabela} adicionados. <br><br>Deseja cadastrar este item como **Aditivo** ou **Extra Bonificado**?`,
    //             html: `O limite de **${limite}** para esta função já foi alcançado. <br>Existem ${dadosOrcamento.quantidadeEscalada} funcionários já salvos. <br><br>Deseja cadastrar este item como <strong>Aditivo</strong> ou <strong>Extra Bonificado</strong>?`,
                
    //             // Configuração dos Botões
    //             showCancelButton: true,
    //             showDenyButton: true, // Habilita o terceiro botão
    //             confirmButtonText: 'Aditivo',
    //             denyButtonText: 'Extra Bonificado',
    //             cancelButtonText: 'Cancelar Cadastro',
    //             //reverseButtons: true
    //         }).then(async (result) => {
    //             let statusAditivo = null;
    //             let statusExtraBonificado = null;
    //             let opcaoEscolhida = null;
    //             let permitirCadastro = false;

    //             if (result.isConfirmed) {
    //                 // Clicou em "Aditivo"
    //                 opcaoEscolhida = 'Aditivo';
    //                 statusAditivo = 'Pendente';
    //                 permitirCadastro = true;
    //             } else if (result.isDenied) {
    //                 // Clicou em "Extra Bonificado"
    //                 opcaoEscolhida = 'Extra Bonificado';
    //                 statusExtraBonificado = 'Pendente';
    //                 permitirCadastro = true;
    //             } else {
    //                 // Clicou em "Cancelar Cadastro" ou fora do modal
    //                 resolve({ allowed: false, statusAditivo: null, statusExtraBonificado: null });
    //                 return;
    //             }

    //             // --- 3. NOVO TRECHO: SEGUNDO SWAL DE CONFIRMAÇÃO ---
    //             // Swal.fire({
    //             //     icon: 'question',
    //             //     title: 'Confirmar Escolha',
    //             //     html: `Você escolheu a opção **${opcaoEscolhida}**. Deseja realmente prosseguir com o cadastro como **${opcaoEscolhida}**?`,
    //             //     showCancelButton: true,
    //             //     confirmButtonText: `Sim, usar ${opcaoEscolhida}`,
    //             //     cancelButtonText: 'Não, voltar',
    //             // }).then((confirmResult) => {
    //             //     if (confirmResult.isConfirmed) {
    //             //         // Confirmação OK: resolve com a opção escolhida no primeiro Swal
    //             //         resolve({ 
    //             //             allowed: true, 
    //             //             statusAditivo: statusAditivo, 
    //             //             statusExtraBonificado: statusExtraBonificado 
    //             //         });
    //             //     } else {
    //             //         // Confirmação Cancelada: cancela o cadastro
    //             //         resolve({ 
    //             //             allowed: false, 
    //             //             statusAditivo: null, 
    //             //             statusExtraBonificado: null 
    //             //         });
    //             //     }
    //             // });


    //             // solicitarDadosExcecao(opcaoEscolhida, idOrcamentoAtual, criterios.idFuncao)
    //             // .then(solicitacaoResult => {
    //             //     resolve(solicitacaoResult);
    //             // });

    //             const prosseguir = await verificarStatusAditivoExtra(idOrcamentoAtual, criterios.idFuncao, opcaoEscolhida);
                
    //             if (prosseguir) {
    //                 // Se a nova lógica permitiu e já coletou os dados da solicitação, 
    //                 // a função principal deve ser cancelada, pois a submissão será feita pelo fluxo do Aditivo/Extra
    //                 resolve({ allowed: false, statusAditivo: null, statusExtraBonificado: null, solicitacaoEmCurso: true });
    //             } else {
    //                 // Se a nova lógica bloqueou ou foi cancelada pelo usuário (aguardar Pendente/Rejeitado)
    //                 resolve({ allowed: false, statusAditivo: null, statusExtraBonificado: null });
    //             }
        
    //         });
    //     });

    // }

    // // LIMITE NÃO ATINGIDO (Permite o cadastro normalmente)
    // return { allowed: true, statusAditivo: null, statusExtraBonificado: null };

    if (totalProposto > limite) {
        
        // 💡 LIMITE ATINGIDO: Apresenta os botões Aditivo/Extra Bonificado (Assíncrono)
        return new Promise(resolve => {
            Swal.fire({
                icon: 'info',
                title: 'Limite Orçamentário Atingido',
                html: `O limite de <strong>${limite}</strong> para a função <strong>${nmFuncaoDoFormulario}</strong> já foi alcançado. <br>Existem ${dadosOrcamento.quantidadeEscalada} funcionários já salvos. <br><br>Deseja solicitar <strong>Aditivo</strong> ou <strong>Extra Bonificado</strong> para a função <strong>${nmFuncaoDoFormulario}</strong>?`,
                
                showCancelButton: true,
                showDenyButton: true,
                confirmButtonText: 'Aditivo',
                denyButtonText: 'Extra Bonificado',
                cancelButtonText: 'Cancelar Cadastro',
            }).then(async (result) => {
                let opcaoEscolhida = null;
                const tipoExcecao = (result.isConfirmed ? 'Aditivo' : result.isDenied ? 'Extra Bonificado' : null);

                if (!tipoExcecao) {
                    // Clicou em "Cancelar Cadastro" ou fora do modal
                    resolve({ allowed: false, statusAditivo: null, statusExtraBonificado: null });
                    return;
                }
                
                // --- NOVO FLUXO: SOLICITA JUSTIFICATIVA E CRIA REGISTRO NA TABELA ADITIVOEXTRA ---
                
                // 1. Verifica se já existe uma solicitação Pendente/Autorizada (Funciona como um bloqueio ou bypass)
                const aditivoExistente = await verificarStatusAditivoExtra(
                    idOrcamentoAtual, 
                    criterios.idFuncao, 
                    tipoExcecao // Passa 'Aditivo' ou 'Extra Bonificado'
                );

                if (aditivoExistente === false) {
                    // O bloqueio aconteceu DENTRO de verificarStatusAditivoExtra (ex: Pendente)
                    resolve({ allowed: false, statusAditivo: null, statusExtraBonificado: null });
                    return;
                }
                
                if (aditivoExistente.encontrado && aditivoExistente.status === 'Autorizado') {
                     // 2. Se a solicitação já está AUTORIZADA, podemos prosseguir com o agendamento principal
                     // O status no payload será 'Autorizado' para que o backend saiba que este item usa a exceção.
                     const statusAditivo = (tipoExcecao === 'Aditivo') ? 'Autorizado' : null;
                     const statusExtraBonificado = (tipoExcecao === 'Extra Bonificado') ? 'Autorizado' : null;

                     Swal.fire('Autorização Existente', `Solicitação de <strong>${tipoExcecao}</strong> já autorizada para <strong>${nmFuncaoDoFormulario}</strong>. Prosseguindo com o agendamento.`, 'success');
                     
                     // 🎯 Permite o agendamento e passa o status de volta ao fluxo principal
                     resolve({ allowed: true, statusAditivo: statusAditivo, statusExtraBonificado: statusExtraBonificado });
                     return;

                } else if (aditivoExistente.encontrado && aditivoExistente.status === 'Rejeitado') {
                    // Se foi rejeitado, podemos tentar uma nova solicitação (o fluxo continua abaixo)
                    Swal.fire('Solicitação Rejeitada', `A solicitação de ${tipoExcecao} anterior para <strong>${nmFuncaoDoFormulario}</strong> foi rejeitada. Você pode submeter uma nova.`, 'info');
                }
                
                // 3. Se não houver solicitação ou se foi Rejeitada, chama a função para coletar dados e salvar
                // Nota: Assumimos que a variável 'idEmpresa' está disponível globalmente, se necessário.
                const resultadoSolicitacao = await solicitarDadosExcecao(
                    tipoExcecao, 
                    idOrcamentoAtual, 
                    nmFuncaoDoFormulario,
                    criterios.idFuncao
                    // , idEmpresa // Adicione idEmpresa se necessário na assinatura
                );
                
                if (resultadoSolicitacao && resultadoSolicitacao.sucesso) {
                    // Solicitação de Aditivo/Extra criada com sucesso.
                    await Swal.fire("Solicitação Enviada", `Solicitação de <strong>${tipoExcecao.toUpperCase()}</strong> para <strong>${nmFuncaoDoFormulario}</strong> registrada com sucesso. O agendamento continuará com status <strong>PENDENTE</strong> de aprovação.`, "success");
                    
                    // // O agendamento principal PODE prosseguir, mas com o status Pendente.
                    // const statusAditivo = (tipoExcecao === 'Aditivo') ? 'Pendente' : null;
                    // const statusExtraBonificado = (tipoExcecao === 'Extra Bonificado') ? 'Pendente' : null;
                    
                    // // 🎯 Permite o agendamento e passa o status de volta ao fluxo principal
                    // resolve({ allowed: true, statusAditivo: statusAditivo, statusExtraBonificado: statusExtraBonificado });

                    if (typeof limparTudoStaff === 'function') {
                        limparTudoStaff(); 
                    }

                    // 🛑 BLOQUEIA o fluxo principal de salvamento do Staff!
                    resolve({ allowed: false, statusAditivo: null, statusExtraBonificado: null });

                } else {
                    // Falha ao salvar ou usuário cancelou em solicitarDadosExcecao
                    if (resultadoSolicitacao && resultadoSolicitacao.erro) {
                        Swal.fire("Falha na Solicitação", `Não foi possível registrar a solicitação. Detalhes: ${resultadoSolicitacao.erro}`, "error");
                    }
                    resolve({ allowed: false, statusAditivo: null, statusExtraBonificado: null });
                }
            });
        });

    }

    // LIMITE NÃO ATINGIDO (Permite o cadastro normalmente)
    return { allowed: true, statusAditivo: null, statusExtraBonificado: null };
}


async function solicitarDadosExcecao(tipo, idOrcamentoAtual, nmFuncaoDoFormulario, idFuncaoDoFormulario) { 
    
    const { value: formValues, isConfirmed } = await Swal.fire({ // 💡 Captura 'isConfirmed'
        title: `Solicitar ${tipo} para ${nmFuncaoDoFormulario}`,
        html: 
            `<input id="swal-qtd" class="swal2-input" type="number" placeholder="Quantidade Solicitada" min="1">` +
            `<textarea id="swal-justificativa" class="swal2-textarea" placeholder="Justificativa (obrigatório)"></textarea>`,
        
        // 🎯 MELHORIA: Adiciona explicitamente o botão Cancelar
        showCancelButton: true,
        confirmButtonText: `Sim, Solicitar ${tipo}`,
        cancelButtonText: 'Cancelar',
        
        focusConfirm: false,
        preConfirm: () => {
            const qtd = document.getElementById('swal-qtd').value;
            const justificativa = document.getElementById('swal-justificativa').value;

            if (!qtd || parseInt(qtd) <= 0) {
                Swal.showValidationMessage('A quantidade solicitada deve ser maior que zero.');
                return false;
            }
            if (!justificativa.trim()) {
                Swal.showValidationMessage('A justificativa é obrigatória.');
                return false;
            }
            return { qtd: parseInt(qtd), justificativa: justificativa };
        }
    });

    // 🎯 CORREÇÃO NO FLUXO DE CANCELAMENTO
    // isConfirmed será 'false' se o usuário clicar em Cancelar ou fechar o modal.
    if (isConfirmed && formValues) {
        
        // ⚠️ ATENÇÃO: Corrigindo a chamada para salvarSolicitacaoAditivoExtra
        // O último parâmetro de salvarSolicitacaoAditivoExtra é 'idFuncionario', 
        // mas você estava passando 'idEmpresa' que não deve ser enviado pelo frontend.
        // O idFuncionario é nulo neste cenário (limite de função), portanto, passamos null.
        return salvarSolicitacaoAditivoExtra(
            idOrcamentoAtual, 
            idFuncaoDoFormulario, 
            formValues.qtd, 
            tipo, 
            formValues.justificativa, 
            null // idFuncionario é null neste cenário (Aditivo/Extra por Limite de Função)
        );
    }

    // Retorna false se cancelado ou se o modal for fechado
    return { sucesso: false, cancelado: true, erro: 'Solicitação de exceção cancelada pelo usuário.' };
    
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

async function verificarStatusAditivoExtra(idOrcamentoAtual, idFuncaoDoFormulario, tipoSolicitacao, idFuncionario = null, nmFuncionario) {
    
    console.log(`Verificando status para idOrcamento: ${idOrcamentoAtual}, idFuncao: ${idFuncaoDoFormulario}, tipoSolicitacao: ${tipoSolicitacao}, idFuncionario: ${idFuncionario}`);

    const params = new URLSearchParams({
        idOrcamento: idOrcamentoAtual,
        idFuncao: idFuncaoDoFormulario,
        tipoSolicitacao: tipoSolicitacao // ESSENCIAL para o backend filtrar
    });
    
    // 🎯 CORREÇÃO 1: Adiciona idFuncionario APENAS para FuncExcedido
    if (tipoSolicitacao === 'FuncExcedido' && idFuncionario) {
        params.append('idFuncionario', idFuncionario);
    }
    
    try {
        // 2. CHAMA O ENDPOINT DE VERIFICAÇÃO
        //const url = `/staff/aditivoextra/verificar-status?idOrcamento=${idOrcamento}&idFuncao=${idFuncao}`;
        const url = `/staff/aditivoextra/verificar-status?${params.toString()}`;
        console.log(`Buscando status em: ${url}`);
        
        const response = await fetchComToken(url, {});
        
        if (response.sucesso === false) {
            Swal.fire('Erro!', `Não foi possível verificar o status atual: ${response.erro}`, 'error');
            return false; // BLOQUEADO
        }

        const { solicitacaoRecente, totaisFuncao } = response.dados;

        console.log("Resposta da verificação de status:", response.dados);

        // --- Etapa 1: Verificar Solicitação Recente (Pendente/Rejeitado) ---
        if (solicitacaoRecente) {
            const status = solicitacaoRecente.status;

            console.log(`Solicitação Recente: Tipo=${solicitacaoRecente.tiposolicitacao}, Status=${status}`);

            if (status === 'Pendente' && solicitacaoRecente.tiposolicitacao.trim() === tipoSolicitacao.trim()) {
                    let htmlMessage = '';
                    if (tipoSolicitacao.trim() === 'FuncExcedido') {
                        // Mensagem específica para 'FuncExcedido'
                        htmlMessage = `Já existe uma solicitação de <strong>Limite de Funções Diárias Excedidas</strong> pendente para o funcionário <strong>${nmFuncionario}</strong>. <br><br> Por favor, aguarde a <strong>Aprovação/Rejeição</strong> antes de solicitar novamente.`;
                    } else {
                        // Mensagem genérica para outros tipos (Aditivo, Extra Bonificado, etc.)
                        htmlMessage = `Já existe uma solicitação de <strong>${solicitacaoRecente.tiposolicitacao}</strong> com status <strong>Pendente</strong>. <br><br> Por favor, aguarde a <strong>Aprovação/Rejeição</strong> antes de solicitar novamente.`;
                    }
                    // --- Fim da lógica da mensagem ---

                    await Swal.fire({
                        title: 'Atenção!',
                        html: htmlMessage, // Usando a mensagem dinâmica
                        icon: 'info',
                        confirmButtonText: 'Entendi'
                    });
                    controlarBotaoSalvarStaff(false);
                    return false; // BLOQUEADO

                    // await Swal.fire({
                    //     title: 'Atenção!',
                    //     html: `Já existe uma solicitação de <strong>${solicitacaoRecente.tiposolicitacao}</strong> com status <strong>Pendente</strong>. <br><br> Por favor, aguarde a <strong>Aprovação/Rejeição</strong> antes de solicitar novamente.`,
                    //     icon: 'info',
                    //     confirmButtonText: 'Entendi'
                    // });
                    // controlarBotaoSalvarStaff(false); // Reativa o botão Salvar
                    // return false; // BLOQUEADO
                    //return { encontrado: true, status: 'Pendente' };
               // } 
            }

            if (status === 'Rejeitado' && solicitacaoRecente.tiposolicitacao.trim() === tipoSolicitacao.trim()) {
                //const tipoRejeitado = solicitacaoRecente.tipoSolicitacao; 

                const result = await Swal.fire({
                    title: 'Solicitação Rejeitada!',
                    html: `A última solicitação (${solicitacaoRecente.idAditivoExtra} de <strong>${solicitacaoRecente.tiposolicitacao}</strong>) foi <strong>Rejeitada</strong>. <br><br> Deseja fazer uma nova solicitação?`,
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'Sim, Nova Solicitação',
                    cancelButtonText: 'Não, Cancelar'
                });
                
                if (!result.isConfirmed) {
                    return false; // BLOQUEADO
                }
            }
        }

        // --- Etapa 2: Verificar Capacidade Total (Aprovado/Preenchido) ---
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
        
        // --- Etapa Final: Se passou por todas as verificações, prossegue para solicitar a QTD ---
        // (Aqui, você pode optar por enviar o totalVagasPreenchidas e limiteMaximo para solicitarDadosExcecao)
        //return solicitarDadosExcecao(tipoSolicitacao, idOrcamento, idFuncao, idEmpresaAtual); 
        return {
            encontrado: solicitacaoRecente !== null,
            status: solicitacaoRecente ? solicitacaoRecente.status : null,
            detalhes: solicitacaoRecente,
            totaisFuncao: totaisFuncao
        };

    } catch (error) {
        console.error("Erro na verificação de status AditivoExtra:", error);
        // Em caso de erro, bloqueia o fluxo.
        Swal.fire('Erro Inesperado!', `Ocorreu um erro ao verificar o status. Detalhe: ${error.message}`, 'error');
        return false;
    }
}

window.verificarStatusAditivoExtra = verificarStatusAditivoExtra; // Torna acessível


async function salvarSolicitacaoAditivoExtra(idOrcamentoAtual, idFuncaoDoFormulario, qtd, tipo, justificativa, idFuncionario = null) {
    console.log("AJAX: Tentando salvar solicitação:", { idOrcamentoAtual, idFuncaoDoFormulario, qtd, tipo, justificativa });
    
    // Objeto de dados a ser enviado
    const dadosParaEnvio = { 
        idOrcamento: idOrcamentoAtual, 
        idFuncao: idFuncaoDoFormulario,
        qtdSolicitada: qtd, 
        tipoSolicitacao: tipo, 
        justificativa,
        idFuncionario: tipo === 'FuncExcedido' ? idFuncionario : null
    };

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




function configurarEventosStaff() {
    console.log("Configurando eventos Staff...");

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
        ajusteCustoTextarea.value = '';               // Limpa o textarea 'ajusteCusto' ao ocultar
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
    const campoPgtoCaixinha = document.getElementById('campoPgtoCaixinha');

    if (caixinhacheck && campoCaixinha) {
        caixinhacheck.addEventListener('change', function() {
            campoCaixinha.style.display = this.checked ? 'block' : 'none';
            campoPgtoCaixinha.style.display = this.checked ? 'block' : 'none';
        });
        campoCaixinha.style.display = caixinhacheck.checked ? 'block' : 'none';
        campoPgtoCaixinha.style.display = caixinhacheck.checked ? 'block' : 'none';
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
    // 📢 FIM DO NOVO BLOCO    

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
    const idsNivelExperiencia = ['Seniorcheck', 'Plenocheck', 'Juniorcheck', 'Basecheck'];
    
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

    // 1. Destruição do Diária Dobrada
    if (window.diariaDobradaPicker && typeof window.diariaDobradaPicker.destroy === 'function') {
        window.diariaDobradaPicker.destroy();
        window.diariaDobradaPicker = null; // Limpa a referência
        console.log("Diária Dobrada destruído com sucesso.");
    }

    // 2. Destruição do Meia Diária
    if (window.meiaDiariaPicker && typeof window.meiaDiariaPicker.destroy === 'function') {
        window.meiaDiariaPicker.destroy();
        window.meiaDiariaPicker = null; // Limpa a referência
        console.log("Meia Diária destruído com sucesso.");
    }
    
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