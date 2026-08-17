import { fetchComToken, aplicarTema  } from '../utils/utils.js';

function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

let statusAditivoFinal = null; // Usar null em vez de '' para campos vazios
let statusExtraBonificadoFinal = null;
let permitirCadastro = false;
let nmFuncaoDoFormulario = '';

let decisaoUsuarioDataFora = null;

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

    // 🔥 SEGUNDA TENTATIVA DE PREENCHIMENTO (DOMContentLoaded)
    if (setorEsperado) {
        const setorInput = document.getElementById('setor');
        if (setorInput) {
            setorInput.value = setorEsperado.toUpperCase();
            setorInput.dispatchEvent(new Event('change', { bubbles: true }));
            console.log("✅ [DOMContentLoaded] Campo setor preenchido com:", setorEsperado.toUpperCase());
        }
    } else {
        console.warn("⚠️ [DOMContentLoaded] setorEsperado ainda está vazio!");
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
    setorEsperado = params.get("setor") || params.get("valor_local") || '';

    // 🔍 DEBUG: Mostra todos os parâmetros recebidos no modal
    console.log("=== 📥 PARÂMETROS RECEBIDOS NO MODAL STAFF ===");
    console.log("URL completa:", window.location.href);
    console.log("Parâmetros:", Object.fromEntries(params.entries()));
    console.log("setor esperado ATRIBUÍDO:", setorEsperado);
    console.log("modo_local:", params.get("modo_local"));
    console.log("valor_local:", params.get("valor_local"));
    console.log("=============================================");

    // 🔥 PREENCHE O CAMPO SETOR IMEDIATAMENTE (se elemento já existe)
    setTimeout(() => {
        const setorInput = document.getElementById('setor');
        if (setorInput && setorEsperado) {
            setorInput.value = setorEsperado.toUpperCase();
            setorInput.dispatchEvent(new Event('change'));
            console.log("✅ Campo setor preenchido IMEDIATAMENTE com:", setorEsperado.toUpperCase());
        } else {
            console.warn("⚠️ Campo setor não encontrado ou setorEsperado vazio:", {setorInputExists: !!setorInput, setorEsperado});
        }
    }, 50);

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
    ajusteCustoTextarea.value = eventData.descajustecusto || '';
    statusAjusteCustoInput.value = eventData.statusajustecusto;

    caixinhaInput.value = parseFloat(eventData.vlrcaixinha || 0).toFixed(2).replace('.', ',');
    descCaixinhaTextarea.value = eventData.desccaixinha || '';
    statusCaixinhaInput.value = eventData.statuscaixinha;
    statusPgtoCaixinhaInput.value = (eventData.statuspgtocaixinha?.toUpperCase()) || '';

    vlrTotalInput.value = parseFloat(eventData.vlrtotal || 0).toFixed(2).replace('.', ',');

    console.log("VALOR TOTAL", vlrTotalInput.value);
    
    // ✅ CARREGAMENTO DO SETOR: Prioridade - eventData.setor -> eventData.orcamentoitens -> ''
    const setorCarregar = eventData.setor || eventData.orcamentoitens || '';
    setorInput.value = setorCarregar.toUpperCase() || '';
    console.log("[carregarDadosParaEditar] Setor carregado:", setorCarregar, "| Fonte: ", eventData.setor ? 'setor' : (eventData.orcamentoitens ? 'orcamentoitens' : 'vazio'));
    
    statusPagtoInput.value = eventData.statuspgto.toUpperCase() || '';
    
    // ✅ NOVO: Valida e filtra os pavilhões baseado no setor carregado
    setTimeout(() => {
        validarEFiltrarSetorPavilhao();
        console.log("[carregarDadosParaEditar] Validação de setor/pavilhão executada após carregamento");
    }, 250);


    // Lógica para checkboxes de Bônus e Caixinha
    if (ajusteCustocheck) {
        ajusteCustocheck.checked = parseFloat(eventData.vlrajustecusto || 0);

        console.log("AJUSTE DE CUSTO", ajusteCustocheck, eventData.vlrajustecusto);

        campoAjusteCusto.style.display = ajusteCustocheck.checked ? 'block' : 'none';
        campoStatusajusteCusto.style.display = ajusteCustocheck.checked ? 'block' : 'none';
        ajusteCustoTextarea.style.display = ajusteCustocheck.checked ? 'block' : 'none';
        ajusteCustoTextarea.required = ajusteCustocheck.checked;
        ajusteCustoTextarea.value = eventData.descajustecusto || '';
        
        // 🔒 Verifica se deve bloquear o checkbox baseado no status
        controlarBloqueioCheckbox('ajusteCustocheck', 'statusAjusteCusto');
    }
    if (caixinhacheck) {
        caixinhacheck.checked = parseFloat(eventData.vlrcaixinha || 0) > 0;
        campoCaixinha.style.display = caixinhacheck.checked ? 'block' : 'none';
        campoStatusCaixinha.style.display = caixinhacheck.checked ? 'block' : 'none';
        campoPgtoCaixinha.style.display = caixinhacheck.checked ? 'block' : 'none';
        descCaixinhaTextarea.style.display = caixinhacheck.checked ? 'block' : 'none';
        descCaixinhaTextarea.required = caixinhacheck.checked;
        descCaixinhaTextarea.value = eventData.desccaixinha || '';
        
        // 🔒 Verifica se deve bloquear o checkbox baseado no status
        controlarBloqueioCheckbox('Caixinhacheck', 'statusCaixinha');
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
    // Guarda o valor "cru" (ex.: PAGO50) separado do texto exibido, que é reformatado
    // logo abaixo para "PAGO 50%" — sem isso, as checagens de comprovante mais abaixo
    // (que leem .value) nunca bateriam com 'pago'/'pago50'.
    statusPgtoAjudaCustoInput.dataset.status = statusPgtoAjdCtoValue;
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
    
    // 🔴 VERIFICA SE É FUNCIONÁRIO (INTERNO/EXTERNO) E BLOQUEIA OS CHECKBOXES
    const perfilFuncionarioCarregado = perfilFuncionarioInput?.value?.toUpperCase().trim() || '';
    console.log("[carregarDadosParaEditar] Perfil do funcionário:", perfilFuncionarioCarregado);
    
    if (perfilFuncionarioCarregado === "INTERNO" || perfilFuncionarioCarregado === "EXTERNO") {
        console.log("🔴 Funcionário INTERNO/EXTERNO detectado - Travando nível Base");
        
        // Garante que apenas Base está marcado
        baseCheck.checked = true;
        seniorCheck.checked = false;
        plenoCheck.checked = false;
        juniorCheck.checked = false;
        
        // Desabilita todos os checkboxes exceto Base
        seniorCheck.disabled = true;
        plenoCheck.disabled = true;
        juniorCheck.disabled = true;
        baseCheck.disabled = false;
    } else {
        // Libera todos os checkboxes para outros perfis
        seniorCheck.disabled = false;
        plenoCheck.disabled = false;
        juniorCheck.disabled = false;
        baseCheck.disabled = false;
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

// Adicione isso ao final do arquivo Staff.js ou dentro de verificaStaff()


/**
 * Valida e aplica restrições ao setor e pavilhão baseado na compatibilidade.
 * Se o setor informado não está cadastrado nos pavilhões, bloqueia a seleção de pavilhões.
 * Se o setor for compatível com um pavilhão, mostra apenas esse pavilhão e força sua seleção.
 */
// Normaliza "setor" (texto livre do orçamento, ex: "1") e "nome de pavilhão"
// (catálogo oficial do local, ex: "Pavilhão 1") para o mesmo formato antes de
// comparar — remove acentos, caixa e o prefixo "PAV"/"PAVILHAO", sem exigir
// que o usuário digite o nome oficial do pavilhão no setor do orçamento.
function normalizarSetorPavilhao(valor) {
    const SEM_ACENTO = new RegExp('[̀-ͯ]', 'g');
    return (valor || '')
        .normalize('NFD').replace(SEM_ACENTO, '')
        .toUpperCase()
        .trim()
        .replace(/^PAV(ILHAO)?\.?\s*/, '')
        .trim();
}

function validarEFiltrarSetorPavilhao() {
    const inputSetor = document.getElementById("setor");
    const selectPav = document.getElementById("nmPavilhao");
    
    if (!inputSetor || !selectPav) {
        console.warn("[validarEFiltrarSetorPavilhao] inputSetor ou selectPav não encontrados");
        return;
    }
    
    // 🔧 MELHORIA: Salva as opções originais na PRIMEIRA vez, antes de qualquer alteração
    if (!selectPav.dataset.originalOptions && selectPav.options.length > 0) {
        const allOptions = Array.from(selectPav.options).map(opt => ({
            value: opt.value,
            text: opt.textContent
        }));
        selectPav.dataset.originalOptions = JSON.stringify(allOptions);
        console.log("[validarEFiltrarSetorPavilhao] Opções originais salvas:", allOptions.length);
    }
    
    const setorInformado = inputSetor.value.toUpperCase().trim();
    const setorInformadoNorm = normalizarSetorPavilhao(inputSetor.value);
    console.log("[validarEFiltrarSetorPavilhao] Setor informado:", setorInformado || "(vazio)");
    console.log("[validarEFiltrarSetorPavilhao] Opções do select:", Array.from(selectPav.options).map(o => o.textContent));
    
    if (!setorInformado) {
        // Se não há setor informado, libera o pavilhão
        console.log("[validarEFiltrarSetorPavilhao] Setor vazio - liberando pavilhão");
        selectPav.disabled = false;
        selectPav.style.opacity = "1";
        selectPav.style.cursor = "auto";
        selectPav.style.backgroundColor = "";
        selectPav.title = "";
        selectPav.required = false;
        // Restaura todas as opções se estavam filtradas
        if (selectPav.dataset.originalOptions) {
            const originalOptions = JSON.parse(selectPav.dataset.originalOptions);
            selectPav.innerHTML = '';
            originalOptions.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt.value;
                option.textContent = opt.text;
                selectPav.appendChild(option);
            });
            console.log("[validarEFiltrarSetorPavilhao] Opções restauradas");
        }
        return;
    }
    
    // 🔧 MELHORIA: Restaura as opções originais ANTES de fazer a nova validação
    // Isso garante que sempre tenhamos todas as opções disponíveis para comparar
    if (selectPav.dataset.originalOptions) {
        const originalOptions = JSON.parse(selectPav.dataset.originalOptions);
        selectPav.innerHTML = '';
        originalOptions.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.text;
            selectPav.appendChild(option);
        });
        console.log("[validarEFiltrarSetorPavilhao] Opções restauradas antes da validação");
    }
    
    // Procura por um pavilhão compatível com o setor
    let pavilhaoCompaivel = null;
    let indiceCompaivel = -1;
    
    for (let i = 0; i < selectPav.options.length; i++) {
        const option = selectPav.options[i];
        if (option.value === "") continue; // Ignora a opção padrão vazia
        
        const nmPavilhao = option.textContent.toUpperCase().trim();
        const nmPavilhaoNorm = normalizarSetorPavilhao(option.textContent);
        console.log(`[validarEFiltrarSetorPavilhao] Comparando "${setorInformadoNorm}" (setor="${setorInformado}") com "${nmPavilhaoNorm}" (pavilhao="${nmPavilhao}")`);
        if (nmPavilhaoNorm === setorInformadoNorm) {
            pavilhaoCompaivel = option;
            indiceCompaivel = i;
            console.log(`[validarEFiltrarSetorPavilhao] MATCH encontrado!`);
            break;
        }
    }
    
    if (pavilhaoCompaivel) {
        // Setor é compatível com um pavilhão cadastrado
        // Mostra apenas esse pavilhão e força sua seleção
        console.log(`✅ Setor compatível encontrado: ${setorInformado}`);
        
        // Salva as opções originais se ainda não foram salvas
        if (!selectPav.dataset.originalOptions) {
            const allOptions = Array.from(selectPav.options).map(opt => ({
                value: opt.value,
                text: opt.textContent
            }));
            selectPav.dataset.originalOptions = JSON.stringify(allOptions);
        }
        
        // Limpa e deixa apenas a opção padrão e o pavilhão compatível
        selectPav.innerHTML = '';
        
        const opcaoPadrao = document.createElement('option');
        opcaoPadrao.value = "";
        opcaoPadrao.textContent = "Selecione o Pavilhão";
        opcaoPadrao.disabled = true;
        selectPav.appendChild(opcaoPadrao);
        
        const optionCompativel = document.createElement('option');
        optionCompativel.value = pavilhaoCompaivel.value;
        optionCompativel.textContent = pavilhaoCompaivel.textContent;
        selectPav.appendChild(optionCompativel);
        
        // Força a seleção do pavilhão compatível
        selectPav.value = pavilhaoCompaivel.value;
        selectPav.disabled = false;
        selectPav.style.opacity = "1";
        selectPav.style.cursor = "auto";
        selectPav.title = "";
        selectPav.required = true;
        
        // Marca como obrigatório visualmente
        const label = document.querySelector('label[for="nmPavilhao"]');
        if (label && !label.textContent.includes('*')) {
            label.textContent += ' *';
        }
        
        console.log(`✅ Setor compatível encontrado: ${setorInformado} -> Pavilhão: ${pavilhaoCompaivel.textContent}`);
    } else {
        // Setor não é compatível com nenhum pavilhão cadastrado
        // Bloqueia a seleção de pavilhões e mostra mensagem
        console.log(`❌ Setor não compatível: ${setorInformado} - Pavilhão bloqueado`);
        
        selectPav.disabled = true;
        selectPav.style.opacity = "0.5";
        selectPav.style.cursor = "not-allowed";
        selectPav.style.backgroundColor = "#f2f2f2";
        selectPav.value = "";
        selectPav.required = false;
        
        // Cria tooltip com mensagem informativa
        selectPav.title = `O setor "${setorInformado}" não está cadastrado nos pavilhões disponíveis para este local de montagem.`;
        
        // Se tinha restaurar opções, faz isso
        if (selectPav.dataset.originalOptions) {
            const originalOptions = JSON.parse(selectPav.dataset.originalOptions);
            selectPav.innerHTML = '';
            originalOptions.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt.value;
                option.textContent = opt.textContent;
                selectPav.appendChild(option);
            });
        }
    }
}

// Execução dupla: 
// 1. Tenta imediatamente ao carregar o script
realizarIntertravamentoSetorPavilhao();

// 2. Reforça após o tempo de carregamento dos dados AJAX (Clientes/Funções)
setTimeout(realizarIntertravamentoSetorPavilhao, 1000);

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

                    // 1. USUÁRIO COM PERMISSÃO TOTAL (ADMIN/SUPREMO)
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

                    // 3. USUÁRIO NORMAL (SEM PERMISSÕES ESPECIAIS)
                    // 🔴 BLOQUEIO SE CACHÊ ESTIVER PAGO
                    const cachePago = (vlrCache > 0 && statusCache === "pago");
                    
                    if (estaTudoPago || bloqueioParcial || cachePago) {
                        await Swal.fire({
                            icon: 'error',
                            title: 'ACESSO BLOQUEADO',
                            text: cachePago 
                                ? 'O cachê deste evento já foi pago. Você não tem permissão para editar.'
                                : 'Você não tem permissão para acessar dados de eventos já pagos ou concluídos.',
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

    // document.getElementById('btnGerarFichaPendente').onclick = async function() {
    //     // 1. Primeiro Filtro: Tipo de Evento
    //     const { value: tipoFiltro } = await Swal.fire({
    //         title: 'Gerar Ficha de Trabalho',
    //         input: 'select',
    //         inputOptions: {
    //             'todos': 'Todos os Eventos',
    //             'a_realizar': 'Eventos a Realizar (Futuros)',
    //             'realizados': 'Eventos Realizados (Passados)'
    //         },
    //         inputPlaceholder: 'Selecione uma opção',
    //         showCancelButton: true,
    //         confirmButtonText: 'Próximo',
    //         cancelButtonText: 'Cancelar'
    //     });

    //     if (!tipoFiltro) return;

    //     let dataCorteInicio = null;
    //     let dataCorteFim = null;

    //     // 2. Se for "Realizados", perguntar o período (Opcional)
    //     if (tipoFiltro === 'realizados') {
    //         const { value: periodo } = await Swal.fire({
    //             title: 'Filtrar por Período?',
    //             html: `
    //                 <input type="month" id="mesFiltro" class="swal2-input">
    //                 <p style="font-size: 0.8em; color: gray;">Deixe em branco para ver todos os passados</p>
    //             `,
    //             showCancelButton: true,
    //             confirmButtonText: 'Filtrar',
    //             preConfirm: () => {
    //                 return document.getElementById('mesFiltro').value;
    //             }
    //         });
            
    //         if (periodo) {
    //             const [ano, mes] = periodo.split('-');
    //             dataCorteInicio = new Date(ano, mes - 1, 1);
    //             dataCorteFim = new Date(ano, mes, 0); // Último dia do mês
    //         }
    //     }

    //     processarGeracaoFicha(tipoFiltro, dataCorteInicio, dataCorteFim);
    // };

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

        if ((statusPgtoAjudaCustoInput.dataset.status || statusPgtoAjudaCustoInput.value) !== 'PAGO') {
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

        if ((statusPgtoAjudaCustoInput.dataset.status || statusPgtoAjudaCustoInput.value) !== 'PAGO50') {
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
    nmLocalMontagemSelect.addEventListener('change', function() {
        // Limpa o cache de opções originais para permitir novo carregamento
        const selectPav = document.getElementById("nmPavilhao");
        if (selectPav) {
            selectPav.dataset.originalOptions = '';
        }
        debouncedOnCriteriosChanged();
    });
    setorInput.addEventListener('change', function() {
        console.log("[SETOR CHANGE] Valor do setor:", this.value);
        // Atualiza o campo hidden idPavilhao com o valor do setor para manter consistência
        const hiddenPavilhao = document.getElementById("idPavilhao");
        if (hiddenPavilhao && this.value) {
            hiddenPavilhao.value = this.value;
            console.log("[SETOR CHANGE] Atualizou #idPavilhao para:", this.value);
        }
        validarEFiltrarSetorPavilhao();
        debouncedOnCriteriosChanged();
    });
    setorInput.addEventListener('input', function() {
        console.log("[SETOR INPUT] Valor do setor em tempo real:", this.value);
        validarEFiltrarSetorPavilhao();
    });
    setorInput.addEventListener('blur', function() {
        console.log("[SETOR BLUR] Valor do setor após perder foco:", this.value);
        validarEFiltrarSetorPavilhao();
    });
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
            // Se há status registrado e ele não é Pendente, não permite remover
            if (statusAjusteCustoOriginal && statusAjusteCustoOriginal !== 'Pendente') {
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

    /* ===============================
       1. DATAS (SEGURAS)
    =============================== */
    const datasEventoRawValue = window.datasEventoPicker?.selectedDates || [];
    const periodoDoEvento = datasEventoRawValue.map(d =>
        flatpickr.formatDate(d, "Y-m-d")
    );

    const periodoDobrado = (window.diariaDobradaPicker?.selectedDates || [])
        .map(d => flatpickr.formatDate(d, "Y-m-d"));

    const periodoMeiaDiaria = (window.meiaDiariaPicker?.selectedDates || [])
        .map(d => flatpickr.formatDate(d, "Y-m-d"));

    /* ===============================
       2. FUNÇÃO UTILITÁRIA
    =============================== */
    const limparId = (val) =>
        (val === '' || val === 'null' || val == null || isNaN(val))
            ? null
            : parseInt(val);

    /* ===============================
       3. SELECTS BLINDADOS
    =============================== */
    const getSelectText = (id) => {
        const el = document.getElementById(id);
        if (!el) return '';
        const selectedIndex = (typeof el.selectedIndex === 'number') ? el.selectedIndex : -1;
        if (selectedIndex === -1) return '';
        const option = (el.options && el.options[selectedIndex]) ? el.options[selectedIndex] : null;
        if (!option || typeof option.textContent !== 'string') return '';
        return option.textContent.trim().toUpperCase();
    };

    const avaliacao = getSelectText("avaliacao");
    const nmFuncionario = getSelectText("nmFuncionario");

    const selectIdFuncao = document.getElementById("idFuncao");
    let nmFuncaoRaw = '';
    // Tenta pegar de #descFuncao (select de função com nomes) primeiro
    const descFuncaoSelect = document.getElementById('descFuncao');
    if (descFuncaoSelect) {
        const si = (typeof descFuncaoSelect.selectedIndex === 'number') ? descFuncaoSelect.selectedIndex : -1;
        if (si !== -1 && descFuncaoSelect.options && descFuncaoSelect.options[si] && typeof descFuncaoSelect.options[si].textContent === 'string') {
            nmFuncaoRaw = descFuncaoSelect.options[si].textContent.trim().toUpperCase();
        }
    }
    // Fallback para #idFuncao se não conseguir de #descFuncao
    if (!nmFuncaoRaw && selectIdFuncao) {
        const si = (typeof selectIdFuncao.selectedIndex === 'number') ? selectIdFuncao.selectedIndex : -1;
        if (si !== -1 && selectIdFuncao.options && selectIdFuncao.options[si] && typeof selectIdFuncao.options[si].textContent === 'string') {
            nmFuncaoRaw = selectIdFuncao.options[si].textContent.trim().toUpperCase();
        }
    }
    if (!nmFuncaoRaw) nmFuncaoRaw = (document.getElementById("nmFuncao")?.value || '').toString().trim().toUpperCase();

    /* ===============================
       4. IDS E CAMPOS
    =============================== */
    const idStaff = document.querySelector("#idStaff")?.value?.trim() || '0';

    const dadosParaEnvio = {
        avaliacao,
        idfuncionario: limparId(document.getElementById("idFuncionario")?.value),
        nmfuncionario: nmFuncionario,

        idfuncao: limparId(selectIdFuncao?.value),
        nmfuncao: nmFuncaoRaw,

        idcliente: limparId(document.getElementById("idCliente")?.value),
        nmcliente: getSelectText("nmCliente"),

        idevento: limparId(document.getElementById("idEvento")?.value),
        nmevento: getSelectText("nmEvento"),

        idmontagem: limparId(document.getElementById("idMontagem")?.value),
        nmlocalmontagem: getSelectText("nmLocalMontagem"),

        // ✅ SIMPLIFICADO: pavilhao deve sempre usar o valor do setor selecionado
        pavilhao: (
            document.getElementById('setor')?.value ||
            document.getElementById('idPavilhao')?.value ||
            getSelectText('nmPavilhao') ||
            ''
        ).trim().toUpperCase(),
        
        setor: (
            document.getElementById('setor')?.value ||
            document.getElementById('idPavilhao')?.value ||
            getSelectText('nmPavilhao') ||
            ''
            ).trim().toUpperCase(),

        // Backend espera 'vlrcache'; no DOM o campo é '#vlrCusto'
        vlrcache: (function(){
            const raw = document.getElementById("vlrCusto")?.value || '0';
            const norm = raw.replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
            return norm || '0';
        })(),
        vlrajustecusto: (function(){
            const raw = document.getElementById("vlrAjusteCusto")?.value || '0';
            const norm = raw.replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
            return norm || '0';
        })(),
        vlrtransporte: (function(){
            const raw = document.getElementById("transporte")?.value || '0';
            const norm = raw.replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
            return norm || '0';
        })(),
        vlralimentacao: (function(){
            const raw = document.getElementById("alimentacao")?.value || '0';
            const norm = raw.replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
            return norm || '0';
        })(),
        vlrcaixinha: (function(){
            const raw = document.getElementById("vlrCaixinha")?.value || '0';
            const norm = raw.replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
            return norm || '0';
        })(),

        descajustecusto: document.getElementById("descAjusteCusto")?.value || '',
        descbeneficios: document.getElementById("descBeneficios")?.value || '',

        vlrtotal: (document.getElementById("vlrTotal")?.value || "0")
            .replace("R$ ", "")
            .replace(/\./g, "")
            .replace(",", "."),

        vlrtotcache: (document.getElementById("vlrTotalCacheHidden")?.value || "0"),
        vlrtotajdcusto: (document.getElementById("vlrTotalAjdCustoHidden")?.value || "0"),

        statuspgto: '',
        statuspgtoajdcto: '',
        statuspgtocaixinha: '',
        statusajustecusto: '',
        statuscaixinha: '',

        descdiariadobrada: document.getElementById("descDiariaDobrada")?.value || '',
        descmeiadiaria: document.getElementById("descMeiaDiaria")?.value || '',
        desccaixinha: document.getElementById("descCaixinha")?.value || '',

        tipoajudacustoviagem: document.getElementById("tipoAjudaCustoViagem")?.value || '0',
        nivelexperiencia: (function() {
            if (seniorCheck?.checked) return 'Senior';
            if (plenoCheck?.checked) return 'Pleno';
            if (juniorCheck?.checked) return 'Junior';
            if (baseCheck?.checked) return 'Base';
            return '';
        })(),

        qtdpessoas: '0',

        idequipe: limparId(document.getElementById("idEquipe")?.value),
        nmequipe: document.getElementById("nmEquipe")?.value || '',

        datasevento: JSON.stringify(periodoDoEvento),
        datadiariadobrada: JSON.stringify(periodoDobrado),
        datameiadiaria: JSON.stringify(periodoMeiaDiaria),

        idorcamento: limparId(document.getElementById("idorcamento")?.value) || limparId(getUrlParameter('idorcamento'))
    };

    /* ===============================
       5. VALIDAÇÃO DE LIMITE
    =============================== */
    // 🔧 CORREÇÃO: Só verifica limite se for NOVO cadastro (não em edição)
    const isEdit = idStaff !== '0';
    
    if (typeof verificarLimiteDeFuncao === "function" && !isEdit) {
        console.log("🔍 [LIMITE] Dados enviados para verificação:", {
            nmEvento: dadosParaEnvio.nmevento,
            nmCliente: dadosParaEnvio.nmcliente,
            nmlocalMontagem: dadosParaEnvio.nmlocalmontagem,
            nmFuncao: dadosParaEnvio.nmfuncao,
            setor: dadosParaEnvio.setor,
            pavilhao: dadosParaEnvio.pavilhao,
            idFuncao: dadosParaEnvio.idfuncao
        });
        
        const limite = await verificarLimiteDeFuncao({
            nmEvento: dadosParaEnvio.nmevento,
            nmCliente: dadosParaEnvio.nmcliente,
            nmlocalMontagem: dadosParaEnvio.nmlocalmontagem,
            nmFuncao: dadosParaEnvio.nmfuncao,
            idFuncao: dadosParaEnvio.idfuncao,
            setor: dadosParaEnvio.setor
        });

        if (limite && limite.allowed === false) return;
    } else if (isEdit) {
        console.log("⏩ [LIMITE] Edição detectada - Validação de limite pulada");
    }

    /* ===============================
       5.1 VALIDAÇÃO DE CAMPOS OBRIGATÓRIOS (CLIENTE-SIDE)
    =============================== */
    const obrigatorios = [
        { campo: 'Funcionário', valor: dadosParaEnvio.idfuncionario },
        { campo: 'Nome Funcionário', valor: dadosParaEnvio.nmfuncionario },
        { campo: 'Evento (ID)', valor: dadosParaEnvio.idevento },
        { campo: 'Evento (Nome)', valor: dadosParaEnvio.nmevento },
        { campo: 'Cliente (ID)', valor: dadosParaEnvio.idcliente },
        { campo: 'Cliente (Nome)', valor: dadosParaEnvio.nmcliente },
        { campo: 'Função (ID)', valor: dadosParaEnvio.idfuncao },
        { campo: 'Função (Nome)', valor: dadosParaEnvio.nmfuncao },
        { campo: 'Local Montagem (ID)', valor: dadosParaEnvio.idmontagem },
        { campo: 'Local Montagem (Nome)', valor: dadosParaEnvio.nmlocalmontagem },
        { campo: 'Cache', valor: dadosParaEnvio.vlrcache }
    ];
    const faltando = obrigatorios.filter(o => o.valor === null || o.valor === undefined || o.valor === '' || o.valor === '0');
    if (faltando.length) {
        const lista = faltando.map(f => `• ${f.campo}`).join('<br>');
        await Swal.fire({
            icon: 'warning',
            title: 'Campos obrigatórios faltando',
            html: `Preencha os campos:<br><br>${lista}`,
            confirmButtonText: 'OK'
        });
        return;
    }

    /* ===============================
       5.5 COMPARAÇÃO E CONFIRMAÇÃO (APENAS PARA EDIÇÃO)
    =============================== */
    // isEdit já foi declarado anteriormente na linha de validação de limite
    
    if (isEdit && currentEditingStaffEvent) {
        console.log("🔍 [VALIDAÇÃO PUT] Comparando dados originais com atuais...");
        
        // Função auxiliar para log e comparação
        const logAndCheck = (fieldName, originalValue, currentValue, condition) => {
            const isDifferent = condition;
            console.log(`[COMPARACAO] ${fieldName}: Original = '${originalValue}' | Atual = '${currentValue}' | Diferente = ${isDifferent}`);
            return isDifferent;
        };
        
        // Normaliza valores vazios
        const normalizeEmptyValue = (value) => {
            if (value === null || value === undefined || value === '' || value === 'null') return '';
            return String(value).trim();
        };
        
        // Comparação completa de todos os campos
        let houveAlteracao = 
            logAndCheck('ID Funcionário', currentEditingStaffEvent.idfuncionario, dadosParaEnvio.idfuncionario, currentEditingStaffEvent.idfuncionario != dadosParaEnvio.idfuncionario) ||
            logAndCheck('Função', (currentEditingStaffEvent.nmfuncao || '').toUpperCase(), dadosParaEnvio.nmfuncao, (currentEditingStaffEvent.nmfuncao || '').toUpperCase() != dadosParaEnvio.nmfuncao) ||
            logAndCheck('Valor Cache', parseFloat(currentEditingStaffEvent.vlrcache || 0), parseFloat(dadosParaEnvio.vlrcache || 0), parseFloat(currentEditingStaffEvent.vlrcache || 0) != parseFloat(dadosParaEnvio.vlrcache || 0)) ||
            logAndCheck('Datas Evento', JSON.stringify(currentEditingStaffEvent.datasevento || []), dadosParaEnvio.datasevento, JSON.stringify(currentEditingStaffEvent.datasevento || []) !== dadosParaEnvio.datasevento) ||
            logAndCheck('Valor Ajuste Custo', parseFloat(currentEditingStaffEvent.vlrajustecusto || 0), parseFloat(dadosParaEnvio.vlrajustecusto || 0), parseFloat(currentEditingStaffEvent.vlrajustecusto || 0) != parseFloat(dadosParaEnvio.vlrajustecusto || 0)) ||
            logAndCheck('Valor Transporte', parseFloat(currentEditingStaffEvent.vlrtransporte || 0), parseFloat(dadosParaEnvio.vlrtransporte || 0), parseFloat(currentEditingStaffEvent.vlrtransporte || 0) != parseFloat(dadosParaEnvio.vlrtransporte || 0)) ||
            logAndCheck('Valor Alimentação', parseFloat(currentEditingStaffEvent.vlralimentacao || 0), parseFloat(dadosParaEnvio.vlralimentacao || 0), parseFloat(currentEditingStaffEvent.vlralimentacao || 0) != parseFloat(dadosParaEnvio.vlralimentacao || 0)) ||
            logAndCheck('Valor Caixinha', parseFloat(currentEditingStaffEvent.vlrcaixinha || 0), parseFloat(dadosParaEnvio.vlrcaixinha || 0), parseFloat(currentEditingStaffEvent.vlrcaixinha || 0) != parseFloat(dadosParaEnvio.vlrcaixinha || 0)) ||
            logAndCheck('Descrição Ajuste Custo', (currentEditingStaffEvent.descajustecusto || '').trim(), (dadosParaEnvio.descajustecusto || '').trim(), (currentEditingStaffEvent.descajustecusto || '').trim() != (dadosParaEnvio.descajustecusto || '').trim()) ||
            logAndCheck('Descrição Benefícios', (currentEditingStaffEvent.descbeneficios || '').trim(), (dadosParaEnvio.descbeneficios || '').trim(), (currentEditingStaffEvent.descbeneficios || '').trim() != (dadosParaEnvio.descbeneficios || '').trim()) ||
            logAndCheck('Descrição Caixinha', (currentEditingStaffEvent.desccaixinha || '').trim(), (dadosParaEnvio.desccaixinha || '').trim(), (currentEditingStaffEvent.desccaixinha || '').trim() != (dadosParaEnvio.desccaixinha || '').trim()) ||
            logAndCheck('Setor', (currentEditingStaffEvent.setor || '').toUpperCase().trim(), (dadosParaEnvio.setor || '').toUpperCase().trim(), (currentEditingStaffEvent.setor || '').toUpperCase().trim() != (dadosParaEnvio.setor || '').toUpperCase().trim()) ||
            logAndCheck('ID Cliente', currentEditingStaffEvent.idcliente, dadosParaEnvio.idcliente, currentEditingStaffEvent.idcliente != dadosParaEnvio.idcliente) ||
            logAndCheck('ID Evento', currentEditingStaffEvent.idevento, dadosParaEnvio.idevento, currentEditingStaffEvent.idevento != dadosParaEnvio.idevento) ||
            logAndCheck('ID Montagem', currentEditingStaffEvent.idmontagem, dadosParaEnvio.idmontagem, currentEditingStaffEvent.idmontagem != dadosParaEnvio.idmontagem) ||
            logAndCheck('ID Equipe', currentEditingStaffEvent.idequipe, dadosParaEnvio.idequipe, currentEditingStaffEvent.idequipe != dadosParaEnvio.idequipe) ||
            logAndCheck('Pavilhão', (currentEditingStaffEvent.pavilhao || '').toUpperCase().trim(), (dadosParaEnvio.pavilhao || '').toUpperCase().trim(), (currentEditingStaffEvent.pavilhao || '').toUpperCase().trim() != (dadosParaEnvio.pavilhao || '').toUpperCase().trim()) ||
            logAndCheck('Descrição Diária Dobrada', (currentEditingStaffEvent.descdiariadobrada || '').trim(), (dadosParaEnvio.descdiariadobrada || '').trim(), (currentEditingStaffEvent.descdiariadobrada || '').trim() != (dadosParaEnvio.descdiariadobrada || '').trim()) ||
            logAndCheck('Descrição Meia Diária', (currentEditingStaffEvent.descmeiadiaria || '').trim(), (dadosParaEnvio.descmeiadiaria || '').trim(), (currentEditingStaffEvent.descmeiadiaria || '').trim() != (dadosParaEnvio.descmeiadiaria || '').trim()) ||
            logAndCheck('Datas Diária Dobrada', JSON.stringify(currentEditingStaffEvent.dtdiariadobrada || []), dadosParaEnvio.datadiariadobrada, JSON.stringify(currentEditingStaffEvent.dtdiariadobrada || []) !== dadosParaEnvio.datadiariadobrada) ||
            logAndCheck('Datas Meia Diária', JSON.stringify(currentEditingStaffEvent.dtmeiadiaria || []), dadosParaEnvio.datameiadiaria, JSON.stringify(currentEditingStaffEvent.dtmeiadiaria || []) !== dadosParaEnvio.datameiadiaria) ||
            logAndCheck('Nível Experiência', (currentEditingStaffEvent.nivelexperiencia || '').trim(), (dadosParaEnvio.nivelexperiencia || '').trim(), (currentEditingStaffEvent.nivelexperiencia || '').trim() != (dadosParaEnvio.nivelexperiencia || '').trim()) ||
            logAndCheck('Qtd Pessoas', currentEditingStaffEvent.qtdpessoas || 0, dadosParaEnvio.qtdpessoas || 0, (currentEditingStaffEvent.qtdpessoas || 0) != (dadosParaEnvio.qtdpessoas || 0));
        
        console.log("🔍 [VALIDAÇÃO PUT] Houve alteração geral?", houveAlteracao);
        
        if (!houveAlteracao) {
            console.log("❌ Nenhuma alteração detectada, bloqueando salvamento.");
            return Swal.fire("Nenhuma alteração detectada", "Faça alguma alteração antes de salvar.", "info");
        }
        
        // Confirma com o usuário se deseja salvar as alterações
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
            console.log("❌ Alteração cancelada pelo usuário");
            return;
        }
    }

    /* ===============================
       6. ENVIO
    =============================== */
    try {
        BotaoEnviar.disabled = true;
        BotaoEnviar.textContent = "Salvando...";

        const url = isEdit ? `/staff/${idStaff}` : '/staff';

        const result = await fetchComToken(url, {
            method: isEdit ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dadosParaEnvio)
        });

        console.log("✅ Resposta do backend (Staff):", result);

        // Backend pode retornar { message: "..." } para sucesso OU { error/details: "..." } para erro
        const temErro = result?.error || result?.message === "Erro ao salvar" || result?.details;
        if (temErro && result?.message !== "Evento(s) salvo(s) e associado(s) ao staff com sucesso!") {
            throw new Error(result?.error || result?.details || "Erro ao salvar");
        }

        await Swal.fire("Sucesso!", isEdit ? "Atualizado!" : "Cadastrado!", "success");

        // 🛑 Reabilita o botão após o sucesso
        BotaoEnviar.disabled = false;
        BotaoEnviar.textContent = "Salvar";

        // Recarrega a tabela de staff se for edição
        if (isEdit && dadosParaEnvio.idfuncionario) {
            await carregarTabelaStaff(dadosParaEnvio.idfuncionario);
        }

        // =========================================================================
        // 🎯 PERGUNTA AO USUÁRIO O QUE FAZER APÓS O CADASTRO
        // =========================================================================
        const resultSwal = await Swal.fire({
            title: "Deseja continuar?",
            text: "O cadastro foi concluído. Quer cadastrar mais um funcionário para o mesmo evento/função ou finalizar?",
            icon: "question",
            showCancelButton: true,
            showDenyButton: true,
            confirmButtonText: "Cadastrar mais um (Manter dados)",
            cancelButtonText: "Finalizar e Sair",
            denyButtonText: "Cadastrar novo staff (Limpar tudo)",
            reverseButtons: true,
            focusCancel: true
        });
        
        if (resultSwal.isConfirmed) {
            // Se escolheu "Cadastrar mais um (Manter dados)"
            console.log("Usuário escolheu: Cadastrar mais um (Manter evento/função)");
            
            // Chama a função de limpeza parcial (mantém evento, cliente, local, função)
            if (typeof limparCamposStaffParcial === "function") {
                limparCamposStaffParcial();
            } else {
                console.warn("limparCamposStaffParcial não está definida. Limpando apenas funcionário.");
                // Limpa apenas campos do funcionário
                const nmFuncionarioSelect = document.getElementById('nmFuncionario');
                const idFuncionarioInput = document.getElementById('idFuncionario');
                if (nmFuncionarioSelect) nmFuncionarioSelect.value = '';
                if (idFuncionarioInput) idFuncionarioInput.value = '';
                
                // Limpa valores financeiros
                if (document.getElementById('vlrCusto')) document.getElementById('vlrCusto').value = '0,00';
                if (document.getElementById('vlrAjusteCusto')) document.getElementById('vlrAjusteCusto').value = '0,00';
                if (document.getElementById('vlrTransporte')) document.getElementById('vlrTransporte').value = '0,00';
                if (document.getElementById('vlrAlimentacao')) document.getElementById('vlrAlimentacao').value = '0,00';
                if (document.getElementById('vlrCaixinha')) document.getElementById('vlrCaixinha').value = '0,00';
                if (document.getElementById('vlrTotal')) document.getElementById('vlrTotal').value = '0,00';
            }

        } else if (resultSwal.isDenied) {
            // Se escolheu "Cadastrar novo staff (Limpar tudo)"
            console.log("Usuário escolheu: Cadastrar novo staff (Limpar tudo)");
            if (typeof limparCamposStaff === "function") {
                limparCamposStaff();
            } else {
                // Fallback: recarrega a página
                location.reload();
            }

        } else if (resultSwal.dismiss === Swal.DismissReason.cancel) {
            // Se escolheu "Finalizar e Sair"
            console.log("Usuário escolheu: Finalizar e Sair");
            
            // Tenta fechar a modal
            if (typeof fecharModal === "function") {
                fecharModal();
                window.location.reload();
            } else {
                // Fallback: fecha a modal manualmente
                const modalOverlay = document.getElementById("modal-overlay");
                const modalContainer = document.getElementById("modal-container");
                
                if (modalOverlay) modalOverlay.style.display = "none";
                if (modalContainer) modalContainer.innerHTML = "";
                document.body.classList.remove("modal-open");
                
                // Recarrega a página
                window.location.reload();
            }
        }

    } catch (error) {
        console.error("❌ Erro:", error);
        BotaoEnviar.disabled = false;
        BotaoEnviar.textContent = "Salvar";
        Swal.fire("Erro", error.message, "error");
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

const debouncedOnCriteriosChanged = debounce(async () => {
    // 1. Captura de IDs
    const idEvento = nmEventoSelect.value;
    const idCliente = nmClienteSelect.value;
    const idLocalMontagem = nmLocalMontagemSelect.value;
    const idFuncao = descFuncaoSelect.value;

    // 2. UNIFICAÇÃO DE SETOR/PAVILHÃO
    // Captura de qualquer um dos dois campos e limpa espaços
    const setorRaw = document.getElementById('setor')?.value || document.getElementById('pavilhao')?.value || '';
    const setorDefinitivo = setorRaw.trim().toUpperCase();

    // 3. Captura de Nomes para a Chave Composta
    const nmEvento = nmEventoSelect.options[nmEventoSelect.selectedIndex]?.text || '';
    const nmCliente = nmClienteSelect.options[nmClienteSelect.selectedIndex]?.text || '';
    const nmlocalMontagem = nmLocalMontagemSelect.options[nmLocalMontagemSelect.selectedIndex]?.text || '';
    const nmFuncao = descFuncaoSelect.options[descFuncaoSelect.selectedIndex]?.text || '';

    // 4. Tratamento de Datas
    const datasEventoRawValue = datasEventoInput ? datasEventoInput.value.trim() : '';
    const periodoDoEvento = getPeriodoDatas(datasEventoRawValue);

    // Validação de Nível (Opcional, conforme seu código)
    const nivelSelecionado = document.querySelector('input[name="nivelexperiencia"]:checked')?.value;

    if (idEvento && idCliente && idLocalMontagem && idFuncao && periodoDoEvento.length > 0) {
        console.log(`🔍 Validando: ${nmFuncao} no ${setorDefinitivo || 'GERAL'}`);

        // PASSO 2: Busca no Banco
        await buscarEPopularOrcamento(idEvento, idCliente, idLocalMontagem, idFuncao, periodoDoEvento);

        // PASSO 3: Verifica Limites
        // 🔧 CORREÇÃO: Só verifica limite se NÃO estiver editando um registro existente
        if (!currentEditingStaffEvent && !isFormLoadedFromDoubleClick) {
            const criteriosParaLimite = {
                nmEvento,
                nmCliente,
                nmlocalMontagem,
                nmFuncao,
                setor: setorDefinitivo, 
                idFuncao: idFuncao
            };

            const resultado = await verificarLimiteDeFuncao(criteriosParaLimite);
            controlarBotaoSalvarStaff(resultado.allowed);
        } else {
            console.log("⏩ [LIMITE] Edição detectada - Validação de limite em onCriteriosChanged pulada");
            controlarBotaoSalvarStaff(true); // Libera o botão salvar em modo edição
        }
    } else {
        controlarBotaoSalvarStaff(false);
    }
}, 500);


async function buscarEPopularOrcamento(idEvento, idCliente, idLocal, idFuncao, datasEvento) {
    try {
        console.log("Buscando orçamento com os seguintes IDs:", { idEvento, idCliente, idLocal, idFuncao, datasEvento });

        // Reseta a decisão anterior sempre que buscar novo orçamento
        decisaoUsuarioDataFora = null;

        // ✅ Captura o setor/pavilhão selecionado no formulário (prioridade: #setor > #idPavilhao)
        const setorSelecionado = (
            document.getElementById('setor')?.value ||
            document.getElementById('idPavilhao')?.value ||
            ''
        ).trim().toUpperCase();

        // 🆕 NOVO: Verificar se há Extra Bonificado Aprovado antes de buscar orçamento
        const statusExtra = await verificarExtraBonificadoAprovado(idEvento, idCliente, idLocal, idFuncao);
        if (statusExtra && statusExtra.aprovado) {
            console.log('✅ Extra Bonificado APROVADO encontrado! Liberando salvamento sem orçamento.');
            temOrcamento = true;
            idOrcamentoAtual = statusExtra.idOrcamento;
            decisaoUsuarioDataFora = 'EXTRA';
            window.orcamentoPorFuncao = {}; // Limpa o mapa
            return; // Retorna sem buscar orçamento
        }

        // Limpeza de parâmetros para a API não receber "null"
        const params = {
            idEvento: idEvento === 'null' ? null : idEvento,
            idCliente: idCliente === 'null' ? null : idCliente,
            idLocalMontagem: idLocal === 'null' ? null : idLocal,
            idFuncao: idFuncao === 'null' ? null : idFuncao,
            datasEvento: datasEvento,
            setor: setorSelecionado
        };

        console.log("🔍 [buscarEPopularOrcamento] Enviando params:", params);

        const result = await fetchComToken('/staff/orcamento/consultar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
        });

        window.orcamentoPorFuncao = {};

        if (!Array.isArray(result) || result.length === 0) {
            // Não há orçamento - perguntar se quer solicitar adicional ou extrabonificado
            const descFuncaoSelect = document.getElementById('descFuncao');
            const funcaoSelecionadaTexto = descFuncaoSelect?.options[descFuncaoSelect.selectedIndex]?.text || 'esta função';
            
            const resultSwal = await Swal.fire({
                icon: 'warning',
                title: 'Nenhum Orçamento Encontrado',
                html: `Não foram encontrados itens de orçamento para <b>${funcaoSelecionadaTexto}</b>.<br><br>Como deseja prosseguir?`,
                showCancelButton: true,
                showDenyButton: true,
                confirmButtonText: 'Solicitar Adicional ($)',
                denyButtonText: 'Extra Bonificado (Grátis)',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#28a745',
                denyButtonColor: '#17a2b8',
                cancelButtonColor: '#d33',
                allowOutsideClick: false,
                allowEscapeKey: false
            });

            let tipoParaSolicitar = '';

            if (resultSwal.isConfirmed) {
                tipoParaSolicitar = 'Adicional';
            } else if (resultSwal.isDenied) {
                tipoParaSolicitar = 'Extra Bonificado';
            } else {
                // Usuário cancelou
                console.log("Usuário cancelou - sem orçamento");
                temOrcamento = false;
                controlarBotaoSalvarStaff(false);
                idOrcamentoAtual = null;
                if (window.datasEventoPicker) {
                    window.datasEventoPicker.clear();
                }
                return;
            }

            // Pergunta sobre o ID do orçamento para vincular a solicitação
            const { value: idOrcamentoInformado } = await Swal.fire({
                title: 'Informar Orçamento',
                html: `Para registrar a solicitação de <b>${tipoParaSolicitar}</b>, informe o ID do orçamento relacionado:`,
                input: 'number',
                inputPlaceholder: 'Digite o ID do orçamento',
                showCancelButton: true,
                confirmButtonText: 'Continuar',
                cancelButtonText: 'Cancelar',
                inputValidator: (value) => {
                    if (!value || value <= 0) {
                        return 'Por favor, informe um ID válido!';
                    }
                }
            });

            if (!idOrcamentoInformado) {
                // Usuário cancelou
                console.log("Usuário cancelou ao informar ID do orçamento");
                temOrcamento = false;
                controlarBotaoSalvarStaff(false);
                idOrcamentoAtual = null;
                if (window.datasEventoPicker) {
                    window.datasEventoPicker.clear();
                }
                return;
            }

            idOrcamentoAtual = parseInt(idOrcamentoInformado);

            // Chama o modal de quantidade e justificativa
            const resultadoExcecao = await solicitarDadosExcecao(
                tipoParaSolicitar,
                idOrcamentoAtual,
                funcaoSelecionadaTexto,
                idFuncao
            );

            if (resultadoExcecao && resultadoExcecao.sucesso) {
                console.log(`Sucesso ao registrar ${tipoParaSolicitar} sem orçamento`);
                decisaoUsuarioDataFora = (tipoParaSolicitar === 'Adicional' ? 'ADICIONAL' : 'EXTRA');
                
                temOrcamento = true;
                const statusElemento = (tipoParaSolicitar === 'Adicional' ? 'StatusAdicional' : 'StatusExtraBonificado');
                mostrarStatusComoPendente(statusElemento);
                controlarBotaoSalvarStaff(true);
                
                Swal.fire('Solicitado!', `A solicitação de ${tipoParaSolicitar} foi registrada com sucesso.`, 'success');
            } else {
                console.log("Solicitação cancelada ou falhou:", resultadoExcecao?.erro);
                if (!resultadoExcecao?.cancelado) {
                    Swal.fire('Erro', 'Não foi possível salvar a solicitação: ' + (resultadoExcecao?.erro || 'Erro desconhecido'), 'error');
                }
                temOrcamento = false;
                controlarBotaoSalvarStaff(false);
                idOrcamentoAtual = null;
                if (window.datasEventoPicker) {
                    window.datasEventoPicker.clear();
                }
            }
            
            return;
        }

        const statusDoOrcamento = result[0].status;
        const idOrcamento = result[0].idorcamento;
        idOrcamentoAtual = idOrcamento;
        const liberadoCadastro = result[0].contratarstaff;

        console.log('ID do Orçamento Atual:', idOrcamentoAtual, statusDoOrcamento, liberadoCadastro);

        if (statusDoOrcamento === 'A') {
            Swal.fire({ 
                icon: 'warning', 
                title: 'Orçamento Sem Proposta', 
                text: 'Orçamento status A (Aberto). Não é possível cadastrar.' 
            });
            temOrcamento = false;
            controlarBotaoSalvarStaff(false);
            return;
        }

        if (statusDoOrcamento === 'P' && !liberadoCadastro) {
            Swal.fire({ 
                icon: 'warning', 
                title: 'Orçamento Não liberado para Contratação', 
                text: 'Orçamento em Proposta Sem liberação de Contratação. Não é possível cadastrar.' 
            });
            temOrcamento = false;
            controlarBotaoSalvarStaff(false);
            return;
        }

        // --- 3. VALIDAÇÃO DE DATAS ESPECÍFICA POR FUNÇÃO ---
        const descFuncaoSelect = document.getElementById('descFuncao');
        const funcaoSelecionadaTexto = descFuncaoSelect?.options[descFuncaoSelect.selectedIndex]?.text || '';
        console.log("Validando datas para:", funcaoSelecionadaTexto);

        const datasPermitidasParaFuncao = new Set();

        result.forEach(item => {
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

        // --- 4. TRATAMENTO DE DATAS FORA DO ORÇAMENTO (COM SOLICITAÇÃO DE EXCEÇÃO) ---
        if (datasNaoOrcadas.length > 0) {
            const datasFormatadas = datasNaoOrcadas.map(data => {
                const [ano, mes, dia] = data.split('-');
                return `${dia}/${mes}/${ano}`;
            }).join(', ');
            
            console.warn("Datas fora do orçamento:", datasNaoOrcadas);

            // 1. Pergunta o tipo de solicitação
            const resultSwal = await Swal.fire({
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

            if (resultSwal.isConfirmed) {
                tipoParaSolicitar = 'Aditivo';
            } else if (resultSwal.isDenied) {
                tipoParaSolicitar = 'Extra Bonificado';
            } else {
                // OPÇÃO: CANCELAR
                console.log("Usuário Cancelou no primeiro nível");
                cancelarProcessoOrcamento();
                return; 
            }

            // 2. Chama o modal de quantidade e justificativa
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
                console.log("Solicitação cancelada ou falhou:", resultadoExcecao?.erro);
                if (!resultadoExcecao?.cancelado) {
                    Swal.fire('Erro', 'Não foi possível salvar a solicitação: ' + (resultadoExcecao?.erro || 'Erro desconhecido'), 'error');
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
            if (window.datasEventoPicker) {
                window.datasEventoPicker.clear();
            }
            decisaoUsuarioDataFora = null;
        }

        // --- 5. POPULAR OBJETO GLOBAL ---
        result.forEach(item => {
            const ev = (item.nmevento || '').trim().toUpperCase();
            const cl = (item.nmcliente || '').trim().toUpperCase();
            const lc = (item.nmlocalmontagem || '').trim().toUpperCase();
            const st = (item.setor || '').trim().toUpperCase();
            const fn = (item.descfuncao || '').trim().toUpperCase();

            // Chave Mestra
            const chave = `${ev}-${cl}-${lc}-${st}-${fn}`;
            const valorMapa = {
                totalOrcado: parseInt(item.quantidade_orcada) || 0,
                vagasPreenchidas: parseInt(item.quantidade_escalada) || 0,
                idOrcamento: item.idorcamento
            };
            
            // Guarda a chave específica (por nomes)
            if (!window.orcamentoPorFuncao[chave]) {
                window.orcamentoPorFuncao[chave] = valorMapa;
            } else {
                window.orcamentoPorFuncao[chave].totalOrcado += valorMapa.totalOrcado;
            }

            // Também armazena chaves usando IDs (idevento-idcliente-idmontagem-idfuncao)
            const evId = (item.idevento || '').toString().trim();
            const clId = (item.idcliente || '').toString().trim();
            const lcId = (item.idmontagem || '').toString().trim();
            const fnId = (item.idfuncao || '').toString().trim();
            const chaveIds = `${evId}-${clId}-${lcId}-${st}-${fnId}`;
            const chaveIdsSemFuncao = `${evId}-${clId}-${lcId}-${st}-`;
            const chaveIdsGeral = `${evId}-${clId}-${lcId}-GERAL-${fnId}`;
            const chaveIdsGeralSemFuncao = `${evId}-${clId}-${lcId}-GERAL-`;
            const chaveIdsVaziaTotal = `${evId}-${clId}-${lcId}--`;

            if (!window.orcamentoPorFuncao[chaveIds]) window.orcamentoPorFuncao[chaveIds] = valorMapa;
            if (!window.orcamentoPorFuncao[chaveIdsSemFuncao]) window.orcamentoPorFuncao[chaveIdsSemFuncao] = valorMapa;
            if (!window.orcamentoPorFuncao[chaveIdsGeral]) window.orcamentoPorFuncao[chaveIdsGeral] = valorMapa;
            if (!window.orcamentoPorFuncao[chaveIdsGeralSemFuncao]) window.orcamentoPorFuncao[chaveIdsGeralSemFuncao] = valorMapa;
            if (!window.orcamentoPorFuncao[chaveIdsVaziaTotal]) window.orcamentoPorFuncao[chaveIdsVaziaTotal] = valorMapa;

            // Também cria variações úteis para evitar falta de correspondência
            const chaveSemFuncao = `${ev}-${cl}-${lc}-${st}-`;
            if (!window.orcamentoPorFuncao[chaveSemFuncao]) window.orcamentoPorFuncao[chaveSemFuncao] = valorMapa;

            const chaveGeral = `${ev}-${cl}-${lc}-GERAL-${fn}`;
            if (!window.orcamentoPorFuncao[chaveGeral]) window.orcamentoPorFuncao[chaveGeral] = valorMapa;

            const chaveGeralSemFuncao = `${ev}-${cl}-${lc}-GERAL-`;
            if (!window.orcamentoPorFuncao[chaveGeralSemFuncao]) window.orcamentoPorFuncao[chaveGeralSemFuncao] = valorMapa;

            const chaveVaziaTotal = `${ev}-${cl}-${lc}--`;
            if (!window.orcamentoPorFuncao[chaveVaziaTotal]) window.orcamentoPorFuncao[chaveVaziaTotal] = valorMapa;
        });
        
        console.log("✅ Orçamento mapeado:", window.orcamentoPorFuncao);
        
        // 🔒 DETECÇÃO DE SETOR VAZIO/NULL: Verifica se há itens sem setor
        const temSetorVazio = result.some(item => !item.setor || item.setor.trim() === '');
        console.log("🔒 [Orçamento] Tem setor vazio?", temSetorVazio);
        
        if (temSetorVazio) {
            bloqueiarCamposSetorEPavilhao(true);
        } else {
            bloqueiarCamposSetorEPavilhao(false);
        }

    } catch (error) {
        console.error("❌ Erro ao buscar orçamento:", error);
    }
}

// Adicione esta função em Staff.js
/**
 * Bloqueia ou desbloqueia os campos de setor e pavilhão
 * @param {boolean} bloquear - true para bloquear, false para desbloquear
 */
function bloqueiarCamposSetorEPavilhao(bloquear = true) {
    const setorInput = document.getElementById('setor');
    const pavilhaoSelects = document.querySelectorAll('.nmPavilhao');
    
    if (bloquear) {
        // 🔒 BLOQUEIAR
        console.log("🔒 [Bloqueio] Bloqueando campos de setor e pavilhão");
        
        if (setorInput) {
            setorInput.disabled = true;
            setorInput.style.cursor = 'not-allowed';
            setorInput.style.pointerEvents = 'none';
            setorInput.style.opacity = '0.6';
            setorInput.title = 'Campo bloqueado: F sem setor específico';
            setorInput.setAttribute('data-bloqueado', 'true');
        }
        
        pavilhaoSelects.forEach(select => {
            select.disabled = true;
            select.style.cursor = 'not-allowed';
            select.style.pointerEvents = 'none';
            select.style.opacity = '0.6';
            select.title = 'Campo bloqueado: Orçamento sem setor específico';
            select.setAttribute('data-bloqueado', 'true');
        });
    } else {
        // 🔓 DESBLOQUEAR
        console.log("🔓 [Desbloqueio] Desbloqueando campos de setor e pavilhão");
        
        if (setorInput) {
            setorInput.disabled = false;
            setorInput.style.cursor = 'auto';
            setorInput.style.pointerEvents = 'auto';
            setorInput.style.opacity = '1';
            setorInput.title = '';
            setorInput.removeAttribute('data-bloqueado');
        }
        
        pavilhaoSelects.forEach(select => {
            select.disabled = false;
            select.style.cursor = 'auto';
            select.style.pointerEvents = 'auto';
            select.style.opacity = '1';
            select.title = '';
            select.removeAttribute('data-bloqueado');
        });
    }
}

/**
 * Bloqueia ou desbloqueia checkboxes baseado no status do campo associado.
 * Se o status for diferente de 'Pendente', o checkbox fica completamente bloqueado.
 * @param {string} checkboxId - ID do checkbox (ex: 'ajusteCustocheck')
 * @param {string} statusFieldId - ID do campo de status (ex: 'statusAjusteCusto')
 * @param {boolean} bloqueio - true para bloquear, false para desbloquear
 */
function controlarBloqueioCheckbox(checkboxId, statusFieldId, bloqueio = true) {
    const checkbox = document.getElementById(checkboxId);
    const statusField = document.getElementById(statusFieldId);
    
    if (!checkbox) {
        console.warn(`Checkbox ${checkboxId} não encontrado`);
        return;
    }
    
    const statusValue = statusField ? statusField.value : '';
    
    // Se status for diferente de 'Pendente', BLOQUEIA completamente
    if (bloqueio && statusValue && statusValue !== 'Pendente' && statusValue !== '') {
        console.log(`🔒 [Bloqueio] Bloqueando checkbox ${checkboxId} - Status: ${statusValue}`);
        
        checkbox.disabled = true;
        checkbox.style.cursor = 'not-allowed';
        checkbox.style.pointerEvents = 'none';
        checkbox.style.opacity = '0.6';
        checkbox.title = `Bloqueado: Status é "${statusValue}". Não é possível desmarcar.`;
        checkbox.setAttribute('data-bloqueado', 'true');
    } else {
        console.log(`🔓 [Desbloqueio] Desbloqueando checkbox ${checkboxId}`);
        
        checkbox.disabled = false;
        checkbox.style.cursor = 'pointer';
        checkbox.style.pointerEvents = 'auto';
        checkbox.style.opacity = '1';
        checkbox.title = '';
        checkbox.removeAttribute('data-bloqueado');
    }
}

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
        if (!idFuncionario || !datasAgendamento || datasAgendamento.length === 0) {
            return { isAvailable: true, conflicts: [] }; 
        }

        const data = await fetchComToken(`/staff/check-availability`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                idfuncionario: idFuncionario,
                datas: datasAgendamento, 
                idfuncao: idFuncao,
                idEventoIgnorar: idEventoIgnorar
            })
        });

        return data || { isAvailable: false, conflicts: [] };
    } catch (error) {
        console.error("❌ Erro na verificação de disponibilidade:", error);
        return { isAvailable: false, conflicts: [] };
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
        console.log("🔍 Verificando vlrfuncionario nas funções:", funcaofetch.map(f => ({ descfuncao: f.descfuncao, vlrfuncionario: f.vlrfuncionario })));       

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
                    console.log(`🔍 Função: ${funcao.descfuncao}, vlrfuncionario: ${funcao.vlrfuncionario}, atributo: ${funcao.vlrfuncionario || 0}`);
                    
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
                
                // 🔥 NOVA LÓGICA: Se já tiver função selecionada E for INTERNO/EXTERNO, recalcula o cachê
                const funcaoSelect = document.getElementById("descFuncao");
                if (funcaoSelect && funcaoSelect.value && (perfilSelecionado.toLowerCase() === "interno" || perfilSelecionado.toLowerCase() === "externo")) {
                    console.log("🔄 Funcionário INTERNO/EXTERNO selecionado DEPOIS da função. Recalculando cachê...");
                    
                    const selectedFuncaoOption = funcaoSelect.options[funcaoSelect.selectedIndex];
                    const vlrFuncionarioAttr = selectedFuncaoOption.getAttribute("data-vlrfuncionario");
                    const vlrAlimentacaoAttr = selectedFuncaoOption.getAttribute("data-alimentacao");
                    const vlrTransporteAttr = selectedFuncaoOption.getAttribute("data-transporte");
                    
                    const vlrFuncionarioRecalculado = parseFloat(vlrFuncionarioAttr) || 0;
                    const vlrAlimentacaoRecalculado = parseFloat(vlrAlimentacaoAttr) || 0;
                    const vlrTransporteRecalculado = parseFloat(vlrTransporteAttr) || 0;
                    
                    console.log("💰 vlrFuncionario:", vlrFuncionarioRecalculado, "Alimentação:", vlrAlimentacaoRecalculado, "Transporte:", vlrTransporteRecalculado);
                    
                    // Preenche os campos
                    document.getElementById("vlrCusto").value = vlrFuncionarioRecalculado.toFixed(2).replace('.', ',');
                    document.getElementById("alimentacao").value = vlrAlimentacaoRecalculado.toFixed(2).replace('.', ',');
                    document.getElementById("transporte").value = vlrTransporteRecalculado.toFixed(2).replace('.', ',');
                    
                    // Chama o cálculo do total
                    if (typeof calcularValorTotal === 'function') {
                        calcularValorTotal();
                    }
                }

                // Se não for freelancer, mostra label em verde
                if (perfilSelecionado) {
                    labelFuncionario.style.display = "block"; // sempre visível                    
                    
                    if (perfilSelecionado.toLowerCase() === "freelancer") {
                        isLote = false;
                        labelFuncionario.textContent = "FREE-LANCER";
                        labelFuncionario.style.color = "red";
                        
                        // 🟢 Libera todos os checkboxes para freelancer
                        if (seniorCheck) seniorCheck.disabled = false;
                        if (plenoCheck) plenoCheck.disabled = false;
                        if (juniorCheck) juniorCheck.disabled = false;
                        if (baseCheck) baseCheck.disabled = false;
                        
                    } if ((perfilSelecionado.toLowerCase() === "interno") || (perfilSelecionado.toLowerCase() === "externo")) {
                        isLote = false;
                        labelFuncionario.textContent = "FUNCIONÁRIO";
                        labelFuncionario.style.color = "green"
                        descBeneficioTextarea.value = "Cachê é pago se escala cair em Fim de Semana ou Feriado";
                        
                        // 🔴 ADICIONA: Trava os checkboxes no Base quando é funcionário
                        console.log("🔴 FUNCIONÁRIO SELECIONADO: Travando nível Base");
                        if (baseCheck) baseCheck.checked = true;
                        if (seniorCheck) seniorCheck.disabled = true;
                        if (plenoCheck) plenoCheck.disabled = true;
                        if (juniorCheck) juniorCheck.disabled = true;
                        if (baseCheck) baseCheck.disabled = false;

                    }else if (perfilSelecionado.toLowerCase() === "lote") {
                        isLote = true;
                        labelFuncionario.textContent = "LOTE";
                        labelFuncionario.style.color = "blue";
                        
                        // 🟢 Libera todos os checkboxes para lote
                        if (seniorCheck) seniorCheck.disabled = false;
                        if (plenoCheck) plenoCheck.disabled = false;
                        if (juniorCheck) juniorCheck.disabled = false;
                        if (baseCheck) baseCheck.disabled = false;
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
        
        // 🔥 PREENCHE O CAMPO SETOR ANTES DA VALIDAÇÃO
        if (setorEsperado) {
            const setorInput = document.getElementById('setor');
            if (setorInput) {
                setorInput.value = setorEsperado.toUpperCase();
                console.log("✅ [carregarPavilhaoStaff] Campo setor preenchido com:", setorEsperado.toUpperCase());
            }
        }
        
        // ✅ NOVO: Valida e filtra o setor com base nos pavilhões carregados
        validarEFiltrarSetorPavilhao();
        
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
        document.getElementById("alimentacao").value = (parseFloat(vlrAlimentacaoFuncao) || 0).toFixed(2).replace('.', ',');
        document.getElementById("vlrCusto").value = (parseFloat(vlrCustoSeniorFuncao) || 0).toFixed(2).replace('.', ','); 
        document.getElementById("transporte").value = (parseFloat(vlrTransporteSeniorFuncao) || 0).toFixed(2).replace('.', ',');

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
        
        document.getElementById("vlrCusto").value = (parseFloat(vlrCustoPlenoFuncao) || 0).toFixed(2).replace('.', ',');   
        document.getElementById("alimentacao").value = (parseFloat(vlrAlimentacaoFuncao) || 0).toFixed(2).replace('.', ',');
        document.getElementById("transporte").value = (parseFloat(vlrTransporteFuncao) || 0).toFixed(2).replace('.', ',');
    
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

        document.getElementById("vlrCusto").value = (parseFloat(vlrCustoJuniorFuncao) || 0).toFixed(2).replace('.', ','); 
        document.getElementById("alimentacao").value = (parseFloat(vlrAlimentacaoFuncao) || 0).toFixed(2).replace('.', ',');  
        document.getElementById("transporte").value = (parseFloat(vlrTransporteFuncao) || 0).toFixed(2).replace('.', ',');
    
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

        document.getElementById("vlrCusto").value = (parseFloat(vlrCustoBaseFuncao) || 0).toFixed(2).replace('.', ',');
        document.getElementById("alimentacao").value = (parseFloat(vlrAlimentacaoFuncao) || 0).toFixed(2).replace('.', ',');   
        document.getElementById("transporte").value = (parseFloat(vlrTransporteFuncao) || 0).toFixed(2).replace('.', ',');

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
        } else if (perfilFuncionario === "INTERNO" || perfilFuncionario === "EXTERNO") {
            // 🔴 FUNCIONÁRIO (INTERNO/EXTERNO): Cachê apenas nos finais de semana
            if (isFinalDeSemanaOuFeriado(data)) {
                total += cache + transporte + alimentacao;
                totalCache += cache;   
                totalAjdCusto += transporte + alimentacao;
                console.log(`Data ${data.toLocaleDateString()} é fim de semana/feriado. Cachê adicionado: ${cache}`);
            } else {
                total += transporte + alimentacao;
                totalAjdCusto += transporte + alimentacao;
                console.log(`Data ${data.toLocaleDateString()} não é fim de semana nem feriado. Apenas Ajuda de Custo: ${(transporte + alimentacao).toFixed(2)}`);
            }
        } else {
            // Perfil desconhecido ou vazio - comportamento padrão (cachê apenas finais de semana)
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
    const valorLimpoCache = totalCache.toFixed(2);

    document.getElementById('vlrTotalCache').value = valorFormatTotCache;
    document.getElementById('vlrTotalCacheHidden').value = valorLimpoCache;

    const valorFormatTotAjdCusto = 'R$ ' + totalAjdCusto.toFixed(2).replace('.', ',');
    const valorLimpoAjdCusto = totalAjdCusto.toFixed(2);

    document.getElementById('vlrTotalAjdCusto').value = valorFormatTotAjdCusto;
    document.getElementById('vlrTotalAjdCustoHidden').value = valorLimpoAjdCusto;

    console.log("Valor Total Final: R$", total.toFixed(2));
    console.log("Total Cache: R$", totalCache.toFixed(2));
    console.log("Total Ajd Custo: R$", totalAjdCusto.toFixed(2));
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
 * @param {object} criterios Critérios de filtro (nmEvento, nmFuncao, etc.).
 * @returns {Promise<{ allowed: boolean }>}
 */
async function verificarLimiteDeFuncao(criterios) {
    if (!criterios || !window.orcamentoPorFuncao) return { allowed: false };

    // Tenta pegar o setor de várias fontes para evitar o erro de chave vazia "--"
    const setorDaTela = document.getElementById('setor')?.value || document.getElementById('nmPavilhao')?.value || '';
    const setorFinal = (criterios.setor || setorDaTela || '').trim().toUpperCase();

    const ev = (criterios.nmEvento || '').trim().toUpperCase();
    const cl = (criterios.nmCliente || '').trim().toUpperCase();
    const lc = (criterios.nmlocalMontagem || '').trim().toUpperCase();
    const fn = (criterios.nmFuncao || '').trim().toUpperCase();

    // ⚠️ PRIORIDADE: Sempre usar a chave específica com setor diferenciado
    // Dessa forma, diferentes pavilhões/setores têm limites independentes
    const chaveEspecifica = `${ev}-${cl}-${lc}-${setorFinal}-${fn}`;
    
    console.log(`🔍 Verificando limite para: Evento=${ev}, Cliente=${cl}, Local=${lc}, Setor=${setorFinal}, Função=${fn}`);
    console.log(`📌 Chave específica: ${chaveEspecifica}`);
    console.log(`📊 Mapa disponível:`, Object.keys(window.orcamentoPorFuncao));

    // Primeiro tenta a chave específica com setor diferenciado
    if (window.orcamentoPorFuncao[chaveEspecifica]) {
        const dados = window.orcamentoPorFuncao[chaveEspecifica];
        const total = parseInt(dados.totalOrcado) || 0;
        const preenchidas = parseInt(dados.vagasPreenchidas) || 0;

        console.log(`✅ Chave específica encontrada! Total: ${total}, Preenchidas: ${preenchidas}`);

        if (preenchidas >= total) {
            // 🎯 LIMITE ATINGIDO: Oferece opção de solicitar Aditivo ou Extra
            
            // 1. Verifica se já existe solicitação pendente ou autorizada
            const statusExcecao = await verificarStatusAditivoExtra(
                dados.idOrcamento, 
                criterios.idFuncao, 
                'Aditivo',  // Tipo de solicitação
                null,       // idFuncionario (não aplicável aqui)
                criterios.nmFuncao || fn  // Nome da função
            );
            
            // Se retornou false, significa que bloqueou (já tem pendente)
            if (statusExcecao === false) {
                return { allowed: false };
            }
            
            // Se já tem autorizado, libera
            if (statusExcecao && statusExcecao.encontrado && statusExcecao.status === 'Autorizado') {
                return { allowed: true };
            }

            // 2. Mostra Swal com opções Aditivo/Extra
            const result = await Swal.fire({
                icon: 'warning',
                title: 'Limite Orçamentário Atingido',
                html: `O limite de <strong>${total}</strong> vagas para <strong>${fn}</strong> (${setorFinal}) já foi alcançado.<br><br>Já foram preenchidas <strong>${preenchidas}</strong> vagas.<br><br>Deseja cadastrar este item como <strong>Aditivo</strong> ou <strong>Extra Bonificado</strong>?`,
                showCancelButton: true,
                showDenyButton: true,
                confirmButtonText: 'Aditivo ($)',
                denyButtonText: 'Extra Bonificado (Grátis)',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#28a745',
                denyButtonColor: '#17a2b8',
                cancelButtonColor: '#d33'
            });

            let tipoSolicitacao = '';
            
            if (result.isConfirmed) {
                tipoSolicitacao = 'Aditivo';
            } else if (result.isDenied) {
                tipoSolicitacao = 'Extra Bonificado';
            } else {
                // Cancelou
                return { allowed: false };
            }

            // 3. Solicita quantidade e justificativa
            const resultadoExcecao = await solicitarDadosExcecao(
                tipoSolicitacao,
                dados.idOrcamento,
                fn,
                criterios.idFuncao
            );

            if (resultadoExcecao && resultadoExcecao.sucesso) {
                Swal.fire('Solicitado!', `A solicitação de ${tipoSolicitacao} foi registrada com sucesso.`, 'success');
                return { 
                    allowed: true, 
                    statusAditivo: tipoSolicitacao === 'Aditivo' ? 'Pendente' : null,
                    statusExtraBonificado: tipoSolicitacao === 'Extra Bonificado' ? 'Pendente' : null
                };
            } else {
                // Cancelou ou erro
                return { allowed: false };
            }
        }

        return { allowed: true };
    }

    // Se a chave específica não existe, tenta fallbacks (mas sem usar setores diferentes)
    const candidatos = [
        `${ev}-${cl}-${lc}-${setorFinal}-`,  // sem função
        `${ev}-${cl}-${lc}-GERAL-${fn}`,     // GERAL com função
        `${ev}-${cl}-${lc}-GERAL-`,           // GERAL sem função
        `${ev}-${cl}-${lc}--${fn}`,           // sem setor, com função
        `${ev}-${cl}-${lc}--`                 // sem setor e sem função
    ];

    let dados = null;
    let chaveEncontrada = null;
    for (const c of candidatos) {
        if (window.orcamentoPorFuncao[c]) {
            dados = window.orcamentoPorFuncao[c];
            chaveEncontrada = c;
            console.log(`⚠️ Chave específica não encontrada. Usando fallback: ${chaveEncontrada}`);
            break;
        }
    }

    if (!dados) {
        console.warn("⚠️ Função não encontrada no mapa. Liberando envio sem bloqueio. Candidatos:", candidatos);
        return { allowed: true };
    }

    const total = parseInt(dados.totalOrcado) || 0;
    const preenchidas = parseInt(dados.vagasPreenchidas) || 0;

    if (preenchidas >= total) {
        // 🎯 LIMITE ATINGIDO: Oferece opção de solicitar Aditivo ou Extra
        
        // 1. Verifica se já existe solicitação pendente ou autorizada
        const statusExcecao = await verificarStatusAditivoExtra(
            dados.idOrcamento, 
            criterios.idFuncao, 
            'Aditivo',  // Tipo de solicitação
            null,       // idFuncionario (não aplicável aqui)
            criterios.nmFuncao || fn  // Nome da função
        );
        
        // Se retornou false, significa que bloqueou (já tem pendente)
        if (statusExcecao === false) {
            return { allowed: false };
        }
        
        // Se já tem autorizado, libera
        if (statusExcecao && statusExcecao.encontrado && statusExcecao.status === 'Autorizado') {
            return { allowed: true };
        }

        // 2. Mostra Swal com opções Aditivo/Extra
        const result = await Swal.fire({
            icon: 'warning',
            title: 'Limite Orçamentário Atingido',
            html: `O limite de <strong>${total}</strong> vagas para <strong>${fn}</strong> já foi alcançado.<br><br>Já foram preenchidas <strong>${preenchidas}</strong> vagas.<br><br>Deseja cadastrar este item como <strong>Aditivo</strong> ou <strong>Extra Bonificado</strong>?`,
            showCancelButton: true,
            showDenyButton: true,
            confirmButtonText: 'Aditivo ($)',
            denyButtonText: 'Extra Bonificado (Grátis)',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#28a745',
            denyButtonColor: '#17a2b8',
            cancelButtonColor: '#d33'
        });

        let tipoSolicitacao = '';
        
        if (result.isConfirmed) {
            tipoSolicitacao = 'Aditivo';
        } else if (result.isDenied) {
            tipoSolicitacao = 'Extra Bonificado';
        } else {
            // Cancelou
            return { allowed: false };
        }

        // 3. Solicita quantidade e justificativa
        const resultadoExcecao = await solicitarDadosExcecao(
            tipoSolicitacao,
            dados.idOrcamento,
            fn,
            criterios.idFuncao
        );

        if (resultadoExcecao && resultadoExcecao.sucesso) {
            Swal.fire('Solicitado!', `A solicitação de ${tipoSolicitacao} foi registrada com sucesso.`, 'success');
            return { 
                allowed: true, 
                statusAditivo: tipoSolicitacao === 'Aditivo' ? 'Pendente' : null,
                statusExtraBonificado: tipoSolicitacao === 'Extra Bonificado' ? 'Pendente' : null
            };
        } else {
            // Cancelou ou erro
            return { allowed: false };
        }
    }

    return { allowed: true };
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

    // 🛡️ VALIDAÇÃO: Garante que tipoSolicitacao tenha um valor padrão
    if (!tipoSolicitacao || tipoSolicitacao === 'undefined' || tipoSolicitacao.trim() === '') {
        console.error('⚠️ tipoSolicitacao está vazio ou undefined. Usando valor padrão.');
        tipoSolicitacao = 'Aditivo'; // Valor padrão
    }

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

/**
 * Verifica se existe Extra Bonificado Aprovado para os critérios informados.
 * Retorna objeto com status de aprovação.
 */
async function verificarExtraBonificadoAprovado(idEvento, idCliente, idMontagem, idFuncao) {
    try {
        // Busca orçamento relacionado aos critérios
        const orcamentosResponse = await fetchComToken(
            `/staff/orcamento/consultar`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    idEvento,
                    idCliente,
                    idLocalMontagem: idMontagem,
                    idFuncao,
                    datasEvento: [],
                    setor: ''
                })
            }
        );

        // Se não encontrou orçamento, retorna false
        if (!Array.isArray(orcamentosResponse) || orcamentosResponse.length === 0) {
            return { aprovado: false };
        }

        const idOrcamento = orcamentosResponse[0].idorcamento;

        // Consulta status do Extra Bonificado
        const statusResponse = await fetchComToken(
            `/staff/aditivoextra/status?idOrcamento=${idOrcamento}&idFuncao=${idFuncao}&tipoSolicitacao=Extra Bonificado`
        );

        if (statusResponse && statusResponse.sucesso && statusResponse.dados) {
            const { solicitacaoRecente } = statusResponse.dados;
            
            // Verifica se há Extra Bonificado com status Autorizado
            if (solicitacaoRecente && 
                solicitacaoRecente.tiposolicitacao === 'Extra Bonificado' && 
                solicitacaoRecente.status === 'Autorizado') {
                console.log('✅ Extra Bonificado AUTORIZADO encontrado:', solicitacaoRecente);
                return { 
                    aprovado: true, 
                    idOrcamento: idOrcamento,
                    detalhes: solicitacaoRecente
                };
            }
        }

        return { aprovado: false };

    } catch (error) {
        console.error('Erro ao verificar Extra Bonificado aprovado:', error);
        return { aprovado: false };
    }
}

window.verificarExtraBonificadoAprovado = verificarExtraBonificadoAprovado;

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


// async function gerarPdfFichaTrabalho(eventos, nomeFiltro) {
//     const { jsPDF } = window.jspdf;
//     const doc = new jsPDF('p', 'mm', 'a4');
//     const hoje = new Date();
//     hoje.setHours(0, 0, 0, 0);

//     const dataGeracao = new Date().toLocaleDateString('pt-BR');
//     const selectFuncionario = document.getElementById("nmFuncionario");
//     const nomeFuncionario = selectFuncionario?.options[selectFuncionario.selectedIndex]?.textContent.trim().toUpperCase() || "PROFISSIONAL NÃO IDENTIFICADO";

//     // --- CABEÇALHO ---
//     doc.setFontSize(16); doc.setFont("helvetica", "bold");
//     doc.text("FICHA DE TRABALHO - STAFF", 14, 15);
//     doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(100);
//     doc.text(`Filtro: ${nomeFiltro}`, 14, 22);
//     doc.text(`Profissional: ${nomeFuncionario}`, 14, 27);
//     doc.text(`Gerado em: ${dataGeracao}`, 196, 15, { align: 'right' });

//     const colunas = ["Informações do Evento", "Detalhes da Vaga"];
    
//     const linhasCorpo = eventos.map(ev => {
//         const partes = ev.periodo.split(/[\s,]+/);
//         const datasObj = partes.map(p => {
//             const [d, m, a] = p.split('/');
//             return new Date(a, m - 1, d);
//         }).sort((a, b) => a - b);
//         const ultimaData = datasObj[datasObj.length - 1];
//         const estaEncerrado = (ultimaData < hoje);

//         // Adicionamos espaços extras após os dois pontos para evitar que fiquem grudados
//         return [
//             { 
//                 content: `${estaEncerrado ? "STATUS: ENCERRADO" : "STATUS: EM ANDAMENTO"}\n\nEVENTO:  ${ev.evento}\n\nCLIENTE: ${ev.cliente}\n\nLOCAL:   ${ev.local}`,
//                 estaEncerrado: estaEncerrado
//             },
//             { 
//                 content: `FUNÇÃO:  ${ev.funcao}\n\nPERÍODO:\n${ev.periodo}` 
//             }
//         ];
//     });

//     doc.autoTable({
//         startY: 35,
//         head: [colunas],
//         body: linhasCorpo,
//         theme: 'grid',
//         headStyles: { fillColor: [45, 45, 45], halign: 'center', fontStyle: 'bold' },
//         styles: { 
//             fontSize: 9, 
//             cellPadding: { top: 7, right: 5, bottom: 7, left: 8 }, // Aumentamos o left para 8 para não grudar na borda
//             valign: 'top',
//             overflow: 'linebreak',
//             rowPageBreak: 'avoid', // Evita que uma única linha se divida entre duas páginas se possível
//             font: "helvetica"
//         },
//         columnStyles: {
//             0: { cellWidth: 95 },
//             1: { cellWidth: 'auto' }
//         },
//         // Este hook é chamado antes de desenhar a célula. Vamos usá-lo para formatar o texto.
//         didParseCell: function(data) {
//             if (data.section === 'body') {
//                 // Aqui não precisamos fazer nada, o segredo está no didDrawCell simplificado
//             }
//         },
//         didDrawCell: function(data) {
//             if (data.section === 'body' && data.column.index === 0) {
//                 const isEnc = data.cell.raw.estaEncerrado;
//                 const text = data.cell.text;
                
//                 // Pintamos apenas a primeira linha (Status) de colorido
//                 if (text && text.length > 0) {
//                     doc.setFont(undefined, 'bold');
//                     if (text[0].includes("STATUS:")) {
//                         doc.setTextColor(isEnc ? 200 : 0, isEnc ? 0 : 128, 0);
//                         // O AutoTable já desenhou o texto, aqui apenas garantimos as cores
//                     }
//                 }
//             }
//         }
//     });

//     // --- RODAPÉ COM PAGINAÇÃO ---
//     const totalPages = doc.internal.getNumberOfPages();
//     for (let i = 1; i <= totalPages; i++) {
//         doc.setPage(i);
//         doc.setFontSize(8);
//         doc.setTextColor(150);
//         doc.text(`Página ${i} de ${totalPages}`, 105, 290, { align: 'center' });
//     }

//     const blobUrl = doc.output('bloburl');
//     window.open(blobUrl, '_blank');
// }


// --- FUNÇÕES AUXILIARES ---

// async function gerarPdfFichaTrabalho(eventos, nomeFiltro) {
//     const { jsPDF } = window.jspdf;
//     const doc = new jsPDF('p', 'mm', 'a4');
//     const hoje = new Date();
//     hoje.setHours(0, 0, 0, 0);

//     const dataGeracao = new Date().toLocaleDateString('pt-BR');
//     const selectFuncionario = document.getElementById("nmFuncionario");
//     const nomeFuncionario = selectFuncionario?.options[selectFuncionario.selectedIndex]?.textContent.trim().toUpperCase() || "PROFISSIONAL NÃO IDENTIFICADO";

//     // --- CABEÇALHO ---
//     doc.setFontSize(16); doc.setFont("helvetica", "bold");
//     doc.text("FICHA DE TRABALHO - STAFF", 14, 15);
//     doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(100);
//     doc.text(`Filtro: ${nomeFiltro}`, 14, 22);
//     doc.text(`Profissional: ${nomeFuncionario}`, 14, 27);
//     doc.text(`Gerado em: ${dataGeracao}`, 196, 15, { align: 'right' });

//     const colunas = ["Informações do Evento", "Detalhes da Vaga"];
    
//     const linhasCorpo = eventos.map(ev => {
//         const partes = ev.periodo.split(/[\s,]+/);
//         const datasObj = partes.map(p => {
//             const [d, m, a] = p.split('/');
//             return new Date(a, m - 1, d);
//         }).sort((a, b) => a - b);
//         const ultimaData = datasObj[datasObj.length - 1];
//         const estaEncerrado = (ultimaData < hoje);

//         // Usamos prefixos fáceis de identificar para o Negrito
//         return [
//             { 
//                 content: `${estaEncerrado ? "STATUS: ENCERRADO" : "STATUS: EM ANDAMENTO"}\nEVENTO: ${ev.evento}\nCLIENTE: ${ev.cliente}\nLOCAL: ${ev.local}`,
//                 estaEncerrado // Passamos o dado puro para usar no hook de desenho
//             },
//             { 
//                 content: `FUNÇÃO: ${ev.funcao}\n\nPERÍODO:\n${ev.periodo}`
//             }
//         ];
//     });

//     doc.autoTable({
//         startY: 35,
//         head: [colunas],
//         body: linhasCorpo,
//         theme: 'grid',
//         headStyles: { fillColor: [45, 45, 45], halign: 'center', fontStyle: 'bold' },
//         styles: { 
//             fontSize: 9, 
//             cellPadding: 5, 
//             valign: 'top',
//             overflow: 'linebreak',
//             rowPageBreak: 'avoid', // Impede que o evento seja cortado ao meio
//             font: "helvetica"
//         },
//         columnStyles: { 0: { cellWidth: 95 }, 1: { cellWidth: 'auto' } },
        
//         // AQUI ESTÁ A MÁGICA:
//         didDrawCell: function(data) {
//             if (data.section === 'body') {
//                 const doc = data.doc;
//                 const cell = data.cell;
//                 const lines = cell.text; // O AutoTable já separou o texto em linhas para nós
//                 const padding = cell.padding('left');
//                 let cursorY = cell.y + cell.padding('top') + 3.5;
//                 const jump = 4.5; // Distância entre linhas

//                 // Limpa o fundo para remover o texto "padrão" (evita o efeito fantasma/duplicado)
//                 doc.setFillColor(255, 255, 255);
//                 doc.rect(cell.x + 0.5, cell.y + 0.5, cell.width - 1, cell.height - 1, 'F');

//                 lines.forEach((line) => {
//                     doc.setFont("helvetica", "bold");
//                     doc.setTextColor(0);

//                     if (line.startsWith("STATUS:")) {
//                         const isEnc = cell.raw.estaEncerrado;
//                         doc.setTextColor(isEnc ? 200 : 0, isEnc ? 0 : 128, 0);
//                         doc.text(line, cell.x + padding, cursorY);
//                     } 
//                     else if (line.includes(": ")) {
//                         const [label, ...rest] = line.split(": ");
//                         const valor = rest.join(": ");
                        
//                         // Desenha o rótulo (EVENTO:, CLIENTE:, etc) em Negrito
//                         doc.setFont("helvetica", "bold");
//                         doc.text(label + ":", cell.x + padding, cursorY);

//                         // Desenha o valor em Normal com um recuo fixo de 18mm
//                         doc.setFont("helvetica", "normal");
//                         const textWidth = cell.width - padding - 20;
//                         const valorQuebrado = doc.splitTextToSize(valor, textWidth);
//                         doc.text(valorQuebrado, cell.x + padding + 18, cursorY);

//                         // Se o texto do valor for longo e quebrar, precisamos pular o cursorY
//                         if (valorQuebrado.length > 1) {
//                             cursorY += (valorQuebrado.length - 1) * jump;
//                         }
//                     } else {
//                         // Linhas simples (como as datas do período)
//                         doc.setFont("helvetica", "normal");
//                         doc.text(line, cell.x + padding, cursorY);
//                     }
//                     cursorY += jump;
//                 });
//             }
//         }
//     });

//     // --- RODAPÉ ---
//     const totalPages = doc.internal.getNumberOfPages();
//     for (let i = 1; i <= totalPages; i++) {
//         doc.setPage(i);
//         doc.setFontSize(8); doc.setTextColor(150);
//         doc.text(`Página ${i} de ${totalPages}`, 105, 290, { align: 'center' });
//     }

//     window.open(doc.output('bloburl'), '_blank');
// }


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

        return [
            { 
                content: `STATUS: ${estaEncerrado ? "ENCERRADO" : "EM ANDAMENTO"}\nEVENTO: ${ev.evento}\nCLIENTE: ${ev.cliente}\nLOCAL: ${ev.local}`,
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

    const containerPDF = document.querySelector('.pdf');

    // Se o usuário NÃO tiver a permissão Master, oculta o container.
    if (!temPermissaoMaster) {
        if (containerPDF) containerPDF.style.display = 'none';
    } else {
        if (containerPDF) containerPDF.style.display = ''; 
    }

    verificaStaff(); 
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
        }
    }

    // --- Lógica de Checkboxes (Ajuste, Caixinha, etc) ---
    const setupToggle = (checkId, campoId, extraId = null) => {
        const chk = document.getElementById(checkId);
        const div = document.getElementById(campoId);
        if (chk && div) {
            const toggle = () => {
                div.style.display = chk.checked ? 'block' : 'none';
                if (extraId) {
                    const ext = document.getElementById(extraId);
                    if (ext) ext.style.display = chk.checked ? 'block' : 'none';
                }
            };
            chk.addEventListener('change', toggle);
            toggle();
        }
    };

    setupToggle('ajusteCustocheck', 'campoAjusteCusto', 'ajusteCustoTextarea');
    setupToggle('Caixinhacheck', 'campoCaixinha');
    setupToggle('diariaDobradacheck', 'campoDiariaDobrada');
    setupToggle('meiaDiariacheck', 'campoMeiaDiaria');

    if (typeof mostrarTarja === 'function') mostrarTarja();
    
    // Restrição Master
    const statusAjusteCustoInput = document.getElementById('statusAjusteCusto');
    const statusCaixinhaInput = document.getElementById('statusCaixinha');
    if (statusAjusteCustoInput && statusCaixinhaInput) {
        statusAjusteCustoInput.disabled = !temPermissaoMaster;
        statusCaixinhaInput.disabled = !temPermissaoMaster;
    }

    // 🚀 CHAMADA DO INTERTRAVAMENTO (SETOR vs PAVILHÃO)
    // Usamos um delay para garantir que os selects e campos carreguem totalmente
    setTimeout(realizarIntertravamentoSetorPavilhao, 800);

    console.log("Entrou configurar Staff no STAFF.js.");
}

/**
 * Função responsável por travar os campos de local conforme o orçamento
 */
function realizarIntertravamentoSetorPavilhao() {
    const urlParams = new URLSearchParams(window.location.search);
    const modo = urlParams.get("modo_local");
    const valorRaw = urlParams.get("valor_local");

    // Validação de segurança: se não houver instrução na URL, não faz nada
    if (!modo || !valorRaw || valorRaw === "undefined" || valorRaw === "null" || valorRaw.trim() === "") {
        console.log("ℹ️ Sem instruções de intertravamento na URL.");
        return;
    }

    const valor = decodeURIComponent(valorRaw).trim();
    const inputSetor = document.getElementById("setor");
    const selectPav = document.getElementById("nmPavilhao"); 

    console.log("🔒 Executando trava de local:", modo, valor);

    if (modo === "setor") {
        // MODO SETOR: Preenche texto, trava o input e desabilita o Pavilhão
        if (inputSetor) {
            inputSetor.value = valor.toUpperCase();
            inputSetor.readOnly = true;
            inputSetor.style.backgroundColor = "#e9ecef";
            inputSetor.style.fontWeight = "bold";
        }
        if (selectPav) {
            selectPav.value = "";
            selectPav.disabled = true;
            selectPav.style.opacity = "0.6";
        }
    } 
    else if (modo === "pavilhao") {
        // MODO PAVILHÃO: Limpa/trava o setor e seleciona o item no dropdown
        if (inputSetor) {
            inputSetor.value = "";
            inputSetor.disabled = true;
            inputSetor.placeholder = "Vinculado ao Pavilhão";
        }
        if (selectPav) {
            const opcoes = selectPav.options;
            for (let i = 0; i < opcoes.length; i++) {
                if (opcoes[i].text.trim().toUpperCase() === valor.toUpperCase()) {
                    selectPav.selectedIndex = i;
                    selectPav.disabled = true;
                    break;
                }
            }
        }
    }
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