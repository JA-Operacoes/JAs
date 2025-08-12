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
//fim do tratamento do flatpickr

window.flatpickrInstances = {};

const commonFlatpickrOptions = {
    mode: "multiple",
    dateFormat: "d/m/Y",
    altInput: true, // Se quiser altInput para os da tabela também
    altFormat: "d/m/Y",
    //locale: flatpickr.l10ns.pt,
    locale: currentLocale,
    appendTo: document.body, // Certifique-se de que 'modal-flatpickr-container' existe e é o elemento correto
    onChange: function(selectedDates) {
        const contador = document.getElementById('contadorDatas');
        if (contador) {
            if (selectedDates.length === 0) {
                contador.innerText = 'Nenhuma data selecionada';
            } else {
                contador.innerText = `${selectedDates.length} ${selectedDates.length === 1 ? 'Diaria Selecionada' : 'Diarias'}`;
            }
        }
    }
    
};

flatpickr("#datasEvento", {
    ...commonFlatpickrOptions, // Isso copia todas as opções comuns
    // As opções específicas para este input
    onClose: function(selectedDates) {
        if (selectedDates.length > 0) {
            // Apenas chame a sua função se houver datas selecionadas
            debouncedOnCriteriosChanged();
        }
    }
});

let avaliacaoChangeListener = null;
let limparStaffButtonListener = null;
let enviarStaffButtonListener = null;
let datasEventoFlatpickrInstance = null; // Para armazenar a instância do Flatpickr
let nmFuncionarioChangeListener = null;
let descFuncaoChangeListener = null;
let nmClienteChangeListener = null;
let nmEventoChangeListener = null;
let nmLocalMontagemChangeListener = null;
let qtdPavilhaoChangeListener = null; // Para o select de pavilhões, se for dinâmico
let CaixinhacheckListener = null;
let ExtracheckListener = null;
let vlrCustoInputListener = null;
let extraInputListener = null;
let transporteInputListener = null;
let almocoInputListener = null;
let jantarInputListener = null;
let caixinhaInputListener = null;
let fileCacheChangeListener = null;
let fileAjdCustoChangeListener = null;
let fileCaixinhaChangeListener = null;

let orcamentoPorFuncao = {};
let statusOrcamentoAtual;

if (typeof window.StaffOriginal === "undefined") {
    window.StaffOriginal = {
        idStaff: "",
        avaliacao: "",
        idFuncionario: "",
        nmFuncionario: "",
        descFuncao: "",
        vlrCusto: "",
        extra: "",
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
        bonus: "",
        vlrTotal: "",
        nmPavilhao: "",
        
        // 📎 Comprovantes PDF
        comprovanteCache: "",
        comprovanteAjdCusto: "",
        comprovanteCaixinha: "",
        setor: "",
        statusPgto: ""
    };
}

let isFormLoadedFromDoubleClick = false;

const eventsTableBody = document.querySelector('#eventsDataTable tbody');
const noResultsMessage = document.getElementById('noResultsMessage');
const idFuncionarioHiddenInput = document.getElementById('idFuncionario');
const apelidoFuncionarioInput = document.getElementById("apelidoFuncionario");
const previewFotoImg = document.getElementById('previewFoto');
const fileNameSpan = document.getElementById('fileName');
const uploadHeaderDiv = document.getElementById('uploadHeader');
const fileInput = document.getElementById('file');
const avaliacaoSelect = document.getElementById('avaliacao'); // Se usar
const tarjaDiv = document.getElementById('tarjaAvaliacao'); // Se usar
const bFuncionarioCadstrado = false;

const idStaffInput = document.getElementById('idStaff'); // Campo ID Staff
const idStaffEventoInput = document.getElementById('idStaffEvento');
const idFuncaoInput = document.getElementById('idFuncao');
const descFuncaoSelect = document.getElementById('descFuncao'); // Select de Função
const vlrCustoInput = document.getElementById('vlrCusto');
const extraInput = document.getElementById('extra');
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
const bonusTextarea = document.getElementById('bonus');
const vlrTotalInput = document.getElementById('vlrTotal');
const beneficioTextarea = document.getElementById('descBeneficio');

// Checkboxes e seus campos relacionados
const extracheck = document.getElementById('Extracheck');
const campoExtra = document.getElementById('campoExtra');
const caixinhacheck = document.getElementById('Caixinhacheck');
const campoCaixinha = document.getElementById('campoCaixinha');
const setorInput = document.getElementById('setor');

const statusPagtoInput = document.getElementById('statusPgto');

// Variável para armazenar os dados originais do registro em edição
let currentEditingStaffEvent = null;
let retornoDados = false;

const carregarDadosParaEditar = (eventData) => {
    console.log("CARREGARDADOSPRAEDITAR", retornoDados);
    retornoDados = true;
    // Armazena os dados originais para comparação em um PUT
    limparCamposEvento();
    currentEditingStaffEvent = eventData;    

    isFormLoadedFromDoubleClick = true;

    console.log("Carregando dados para edição:", eventData, currentEditingStaffEvent);

    console.log("Valor de eventData.comppgtocache:", eventData.comppgtocache);
    console.log("Valor de eventData.comppgtoajdcusto:", eventData.comppgtoajdcusto);
    console.log("Valor de eventData.comppgtocaixinha:", eventData.comppgtocaixinha);

    idStaffInput.value = eventData.idstaff || ''; // idstaff da tabela staffeventos
   
    idStaffEventoInput.value = eventData.idstaffevento;
    idFuncaoInput.value = eventData.idfuncao
    idClienteInput.value = eventData.idcliente;
    idEventoInput.value = eventData.idevento;
     console.log("IDSTAFFINPUT", idStaffInput.value, idFuncaoInput.value, idClienteInput.value, idEventoInput.value);
    idFuncionarioHiddenInput.value = eventData.idfuncionario || ''; // idfuncionario do staffeventos
    
    // Preenche os campos do evento
    // Campos de SELECT:
    if (descFuncaoSelect) descFuncaoSelect.value = eventData.idfuncao || '';      
    
    if (nmClienteSelect) nmClienteSelect.value = eventData.idcliente || '';
   
    if (nmEventoSelect) nmEventoSelect.value = eventData.idevento || '';
    nmPavilhaoSelect.value = eventData.pavilhao || '';

    if (nmLocalMontagemSelect) {
        nmLocalMontagemSelect.value = eventData.idmontagem || '';              
            
       
        nmLocalMontagemSelect.dispatchEvent(new Event('change')); 
        
        // Reintroduz o setTimeout para aguardar a população assíncrona
        setTimeout(() => {
            if (nmPavilhaoSelect) {
                const historicalPavilhaoName = eventData.pavilhao || '';
                let selected = false;

                // Tenta encontrar a opção existente pelo textContent (nome)
                for (let i = 0; i < nmPavilhaoSelect.options.length; i++) {
                    if (nmPavilhaoSelect.options[i].textContent.toUpperCase().trim() === historicalPavilhaoName.toUpperCase().trim()) {
                        nmPavilhaoSelect.value = nmPavilhaoSelect.options[i].value; // Define o valor pelo ID da opção encontrada
                        selected = true;
                        console.log(`Pavilhão "${historicalPavilhaoName}" encontrado e selecionado pelo textContent.`);
                        break;
                    }
                }

                // Se a opção histórica não foi encontrada, adiciona-a temporariamente
                if (!selected && historicalPavilhaoName) {
                    const tempOption = document.createElement('option');
                    tempOption.value = historicalPavilhaoName; // O valor da opção temporária será o nome
                    tempOption.textContent = `${historicalPavilhaoName} (Histórico)`; 
                    nmPavilhaoSelect.prepend(tempOption); // Adiciona no início para ser facilmente visível
                    nmPavilhaoSelect.value = historicalPavilhaoName; // Seleciona a opção temporária pelo seu valor (o nome)
                    console.log(`Pavilhão "${historicalPavilhaoName}" adicionado como opção histórica e selecionado.`);
                } else if (!historicalPavilhaoName) {
                    nmPavilhaoSelect.value = ''; // Garante que esteja vazio se não houver nome histórico
                }
            }
        }, 200); // Aumentei o tempo para 200ms para maior robustez na sincronização
    } else {
        // Fallback se nmLocalMontagemSelect não for encontrado
        // Neste caso, o nmPavilhaoSelect não será populado dinamicamente, apenas tentará selecionar o valor direto
        if (nmPavilhaoSelect) {
            nmPavilhaoSelect.innerHTML = `<option value="${eventData.pavilhao || ''}">${eventData.pavilhao || 'Selecione Pavilhão'}</option>`;
            nmPavilhaoSelect.value = eventData.pavilhao || '';
        }
    }

    // Campos de INPUT/TEXTAREA:
    vlrCustoInput.value = parseFloat(eventData.vlrcache || 0).toFixed(2).replace('.', ','); // Formato para moeda
    extraInput.value = parseFloat(eventData.vlrextra || 0).toFixed(2).replace('.', ',');
    transporteInput.value = parseFloat(eventData.vlrtransporte || 0).toFixed(2).replace('.', ',');
    almocoInput.value = parseFloat(eventData.vlralmoco || 0).toFixed(2).replace('.', ',');
    jantarInput.value = parseFloat(eventData.vlrjantar || 0).toFixed(2).replace('.', ',');
    caixinhaInput.value = parseFloat(eventData.vlrcaixinha || 0).toFixed(2).replace('.', ',');
    descBeneficioTextarea.value = eventData.descbeneficios || ''; // Seu campo de bônus está como descbonus no backend
    bonusTextarea.value = eventData.descbonus || ''; // Se você tem um campo 'bonus' no HTML
    vlrTotalInput.value = parseFloat(eventData.total || 0).toFixed(2).replace('.', ',');
    setorInput.value = eventData.setor.toUpperCase() || ''; // Setor do funcionário, se necessário
    statusPagtoInput.value = eventData.statuspgto.toUpperCase() || '';

    

    //const statusPgtoInput = document.getElementById('statusPgto');
    if (statusPagtoInput.value) {
        // 1. Defina o valor do input
        //statusPgtoInput.value = statusPgto; // statusPgto é a variável que você calculou

        // 2. Remova classes existentes para evitar conflito
        
        statusPagtoInput.classList.remove('pendente', 'pago');

        // 3. Adicione a classe apropriada com base no status
        if (statusPagtoInput.value === "PENDENTE") {
            statusPagtoInput.classList.add('pendente');
        } else if (statusPagtoInput.value === "PAGO") {
            console.log("CARREGANDO STATUS", statusPagtoInput.value);
            statusPagtoInput.classList.add('pago');
        }
    }

    // Tratamento dos Checkboxes Extra/Caixinha
    if (extracheck && campoExtra) {
        extracheck.checked = (parseFloat(eventData.vlrextra || 0) > 0);
        campoExtra.style.display = extracheck.checked ? 'block' : 'none';

        const bonusTextarea = document.getElementById('bonus');
        if (bonusTextarea) {
            bonusTextarea.style.display = extracheck.checked ? 'block' : 'none';
            bonusTextarea.required = extracheck.checked; // Torna obrigatório apenas se visível
            if (!extracheck.checked) {
                bonusTextarea.value = ''; // Limpa o conteúdo se estiver sendo ocultado
            }
        }
    }
    if (caixinhacheck && campoCaixinha) {
        caixinhacheck.checked = (parseFloat(eventData.vlrcaixinha || 0) > 0);
        campoCaixinha.style.display = caixinhacheck.checked ? 'block' : 'none';
    }   
    
    if (eventData.datasevento) {
        let periodoArrayStrings; // Este será o array de strings YYYY-MM-DD
        let periodoArrayDateObjects = []; // Este será o array de objetos Date

        if (Array.isArray(eventData.datasevento)) {
            periodoArrayStrings = eventData.datasevento;
            console.log("PERIODO (já array de strings):", periodoArrayStrings);
        } else if (typeof eventData.datasevento === 'string') {
            try {
                periodoArrayStrings = JSON.parse(eventData.datasevento);
                console.log("PERIODO (parseado de string para array de strings):", periodoArrayStrings);
            } catch (e) {
                console.error("Erro ao parsear datasevento do evento:", e);
                periodoArrayStrings = [];
            }
        } else {
            periodoArrayStrings = [];
        }

        // --- NOVA LÓGICA: CONVERTER STRINGS YYYY-MM-DD PARA OBJETOS DATE ---
        periodoArrayDateObjects = periodoArrayStrings.map(dateStr => {
            // Cria um objeto Date a partir da string YYYY-MM-DD
            // Usar o construtor 'new Date(year, monthIndex, day)' é mais seguro
            // para evitar problemas de fuso horário com strings como 'YYYY-MM-DD' em alguns ambientes.
            const parts = dateStr.split('-').map(Number); // [Ano, Mês, Dia] como números
            if (parts.length === 3) {
                // Mês em JavaScript é 0-indexed (Janeiro=0, Fevereiro=1, ..., Julho=6)
                return new Date(parts[0], parts[1] - 1, parts[2]); // parts[1] é o mês, subtrai 1
            }
            return null; // Retorna null para datas inválidas, que Flatpickr ignorará
        }).filter(date => date !== null); // Filtra quaisquer datas inválidas

        console.log("Datas como objetos Date para Flatpickr:", periodoArrayDateObjects);

        const flatpickrForDatasEvento = window.flatpickrInstances['datasEvento']; 
        
        if (flatpickrForDatasEvento) {
            // Use setDate com o array de objetos Date
            flatpickrForDatasEvento.setDate(periodoArrayDateObjects, true); 
            console.log("Flatpickr setDate chamado para #datasEvento com objetos Date:", periodoArrayDateObjects);
        } else {
            console.warn("Instância do Flatpickr para #datasEvento não encontrada. Preenchendo input diretamente.");
            // Fallback (mantido para debugging)
            const datasFormatadas = periodoArrayStrings.map(dateStr => {
                const parts = dateStr.split('-');
                if (parts.length === 3) {
                    return `${parts[2]}/${parts[1]}/${parts[0]}`;
                }
                return dateStr;
            });
            datasEventoInput.value = datasFormatadas.join(', ');
        }
    } else {
        datasEventoInput.value = '';
        const flatpickrForDatasEvento = window.flatpickrInstances['datasEvento'];
        if (flatpickrForDatasEvento) {
            flatpickrForDatasEvento.clear();
            console.log("Flatpickr para #datasEvento limpo.");
        }
    }

    // preencherComprovanteCampo(eventData.comppgtocache, 'fileNameCache', 'previewCache', 'pdfPreviewCache', 'linkCache', 'imagePreviewCache', 'linkImageCache');
    // preencherComprovanteCampo(eventData.comppgtoajdcusto, 'fileNameAjdCusto', 'previewAjdCusto', 'pdfPreviewAjdCusto', 'linkAjdCusto', 'imagePreviewAjdCusto', 'linkImageAjdCusto');
    // preencherComprovanteCampo(eventData.comppgtocaixinha, 'fileNameCaixinha', 'previewCaixinha', 'pdfPreviewCaixinha', 'linkCaixinha', 'imagePreviewCaixinha', 'linkImageCaixinha');
  
    preencherComprovanteCampo(eventData.comppgtocache, 'Cache');
    preencherComprovanteCampo(eventData.comppgtoajdcusto, 'AjdCusto');
    preencherComprovanteCampo(eventData.comppgtocaixinha, 'Caixinha');

console.log("CARREGADO DADOS PARA EDITAR ATRAVÉS DE DBLCLIQUE", isFormLoadedFromDoubleClick);
   
};

let currentRowSelected = null;
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
                
                // document.getElementById("idStaff").value = eventData.idstaff;
                // document.getElementById("idStaffEvento").value = eventData.idstaffevento;          
                // document.getElementById("idEvento").value = eventData.idevento;                
                // document.getElementById("idFuncao").value = eventData.idfuncao;
                // document.getElementById("idCliente").value = eventData.idcliente;
                // document.getElementById("avaliacao").value = eventData.avaliacao;         

                
            //     if (avaliacaoSelect) {
            //         // Converte a avaliação do DB para o valor do select (ex: "MUITO BOM" -> "muito_bom")
            //         const avaliacaoValue = (eventData.avaliacao || '').toLowerCase().replace(' ', '_');
            //         avaliacaoSelect.value = avaliacaoValue;
            //         mostrarTarja(); // Atualiza a tarja visual
            //     }
            // console.log('Valor de eventData.periodo antes de exibir:', eventData.datasevento);
            // console.log('Tipo de eventData.periodo antes de exibir:', typeof eventData.datasevento);

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
                        isFormLoadedFromDoubleClick = true;
                        if (currentRowSelected) {
                            currentRowSelected.classList.remove('selected-row');
                        }
                        // Adiciona a classe 'selected-row' à linha clicada
                        row.classList.add('selected-row');
                        // Atualiza a referência da linha selecionada
                        currentRowSelected = row;

                        carregarDadosParaEditar(eventData)});                   
                        

                    //  row.insertCell().textContent = eventData.idevento || '';
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

                    row.insertCell().textContent = parseFloat(eventData.vlrcache || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                    row.insertCell().textContent = parseFloat(eventData.vlrextra || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                    row.insertCell().textContent = eventData.descbonus || '';
                    row.insertCell().textContent = parseFloat(eventData.almoco || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                    row.insertCell().textContent = parseFloat(eventData.jantar || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });                                
                    row.insertCell().textContent = parseFloat(eventData.vlrtransporte || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                    row.insertCell().textContent = parseFloat(eventData.vlrcaixinha || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });               
                    row.insertCell().textContent = eventData.descbeneficios || '';
                    row.insertCell().textContent = parseFloat(eventData.vlrtotal || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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




// function toggleSectionVisibility(headerElement, contentClass, iconClassPrefix) {
//     const sectionContent = headerElement.nextElementSibling; // O conteúdo é o próximo irmão do cabeçalho
//     const toggleBtn = headerElement.querySelector('.toggle-arrow-btn');
//     const icon = toggleBtn ? toggleBtn.querySelector('i') : null;

//     if (!sectionContent || !sectionContent.classList.contains(contentClass)) {
//         console.warn("Elemento de conteúdo não encontrado ou classe incorreta para o cabeçalho:", headerElement);
//         return;
//     }

//     const isCollapsed = sectionContent.classList.contains('collapsed');

//     if (isCollapsed) {
//         sectionContent.classList.remove('collapsed');
//         if (icon) {
//             icon.classList.remove(`${iconClassPrefix}-down`);
//             icon.classList.add(`${iconClassPrefix}-up`);
//         }
//     } else {
//         sectionContent.classList.add('collapsed');
//         if (icon) {
//             icon.classList.remove(`${iconClassPrefix}-up`);
//             icon.classList.add(`${iconClassPrefix}-down`);
//         }
//     }
//     // console.log(`Seção ${isCollapsed ? 'expandida' : 'colapsada'}.`); // Para depuração
// }

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
        limparCamposStaff();
    });

    // setupComprovanteUpload('fileCache', 'fileNameCache', 'fileCache');
    // setupComprovanteUpload('fileAjdCusto', 'fileNameAjdCusto', 'fileAjdCusto');
    // setupComprovanteUpload('fileCaixinha', 'fileNameCaixinha', 'fileCaixinha');

    //botaoEnviar.addEventListener("click", handleFormSubmit);

    //const uploadAjdCusto = document.getElementById('uploadAjdCusto');
    //const uploadCaixinha = document.getElementById('uploadCaixinha');

    const labelFileAjdCusto = document.getElementById('labelFileAjdCusto');
    //const fileAjdCustoInput = document.getElementById('fileAjdCusto');

    const labelFileCaixinha = document.getElementById('labelFileCaixinha');
    //const fileCaixinhaInput = document.getElementById('fileCaixinha');


    // Lógica para o comprovante de Ajuda de Custo
    labelFileAjdCusto.addEventListener('click', (event) => {
        const vlrAlmoco = parseFloat(almocoInput.value.replace(',', '.') || 0);
        const vlrJantar = parseFloat(jantarInput.value.replace(',', '.') || 0);
        const vlrTransporte = parseFloat(transporteInput.value.replace(',', '.') || 0);

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
        const vlrCaixinha = parseFloat(caixinhaInput.value.replace(',', '.') || 0);

        if (vlrCaixinha === 0) {
            event.preventDefault(); // Impede a abertura do modal de upload
            Swal.fire({
                icon: 'warning',
                title: 'Não é possível inserir comprovante',
                text: 'O valor da Caixinha deve ser maior que zero para inserir um comprovante.',
            });
        }
    });

    nmEventoSelect.addEventListener('change', debouncedOnCriteriosChanged);
    nmClienteSelect.addEventListener('change', debouncedOnCriteriosChanged);
    nmLocalMontagemSelect.addEventListener('change', debouncedOnCriteriosChanged);
    setorInput.addEventListener('change', debouncedOnCriteriosChanged);
   // datasEventoInput.addEventListener('change', debouncedOnCriteriosChanged);
    

    botaoEnviar.addEventListener("click", async (event) => {
      event.preventDefault(); // Previne o envio padrão do formulário    

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
        const extra = document.querySelector("#extra").value.trim() || '0';
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
        const extraAtivo = document.getElementById("Extracheck")?.checked;
        const descBeneficioInput = document.getElementById("descBeneficio");
        const descBonusInput = document.getElementById("bonus");
        const descBonus = descBonusInput.value.trim() || "";
        const descBeneficio = descBeneficioInput?.value.trim() || "";
        const setor = document.querySelector("#setor").value.trim().toUpperCase(); 
        
        const datasEventoRawValue = datasEventoInput.value.trim();
        const periodoDoEvento = getPeriodoDatas(datasEventoRawValue);     

        

    // Verifique se os IDs essenciais estão preenchidos antes de buscar
    
      
        if (periodoDoEvento.length === 0) {
            return Swal.fire("Campo obrigatório!", "Por favor, selecione os dias do evento.", "warning");
        }

        const vlrTotal = document.getElementById('vlrTotal').value; // "R$ 2.345,00"
        const total = parseFloat(
        vlrTotal
            .replace('R$', '') // remove símbolo
            .replace(/\./g, '') // remove milhares
            .replace(',', '.') // troca vírgula por ponto
            .trim()
        ) || 0;


        if(!nmFuncionario || !descFuncao || !vlrCusto || !nmCliente || !nmEvento || !periodoDoEvento){
            return Swal.fire("Campos obrigatórios!", "Preencha todos os campos obrigatórios: Funcionário, Função, Cachê, Transportes, Alimentação, Cliente, Evento e Período do Evento.", "warning");
        }

        if ((caixinhaAtivo) && !descBeneficio) {
            // Coloca foco no campo de descrição (opcional)
            if (descBeneficioInput) {
                descBeneficioInput.focus();
            }
            // Bloqueia envio e mostra aviso
            return Swal.fire(
                "Campos obrigatórios!",
                "Preencha a descrição do benefício (Caixinha) antes de salvar.",
                "warning"
            );
        }

        if ((extraAtivo) && !descBonus) {
            // Coloca foco no campo de descrição (opcional)
            if (descBonusInput) {
                descBonusInput.focus();
            }
            // Bloqueia envio e mostra aviso
            return Swal.fire(
                "Campos obrigatórios!",
                "Preencha a descrição do bônus antes de salvar.",
                "warning"
            );
        }
        
      // Permissões
        const temPermissaoCadastrar = temPermissao("Staff", "cadastrar");
        const temPermissaoAlterar = temPermissao("Staff", "alterar");

        
        const idStaffEvento = document.querySelector("#idStaffEvento").value;

       
        // const isEditingInitial = currentEditingStaffEvent && currentEditingStaffEvent.idstaffevento; // Estado inicial do formulário
        // const idEventoEmEdicao = isEditingInitial ? currentEditingStaffEvent.idstaffevento : null;

        // console.log("EM EDIÇÃO?",isEditingInitial, idEventoEmEdicao);

        // let metodo = isEditingInitial ? "PUT" : "POST"; // Método inicial
        // let url = isEditingInitial ? `/staff/${currentEditingStaffEvent.idstaffevento}` : "/staff";

        // Verifica se o formulário está em modo de edição
        const isEditingInitial = !!(currentEditingStaffEvent && currentEditingStaffEvent.idstaffevento);

        // Obtém o ID do evento em edição, se houver
        const idEventoEmEdicao = isEditingInitial ? currentEditingStaffEvent.idstaffevento : null;

        console.log("EM EDIÇÃO?", isEditingInitial, idEventoEmEdicao);

        let metodo = isEditingInitial ? "PUT" : "POST";
        let url = isEditingInitial ? `/staff/${idEventoEmEdicao}` : "/staff";
        
         const idStaffEventoFromObject = currentEditingStaffEvent ? currentEditingStaffEvent.idstaffevento : null;
        
        // console.log("idSTAFFEVENTO", idStaffEvento, isFormLoadedFromDoubleClick, currentEditingStaffEvent, idStaffEventoFromObject);
            const idStaffEventoNumero = parseInt(idStaffEvento, 10);
        // if (idStaffEventoFromObject === idStaffEvento)
        // {
        //     console.log("IDS SÃO IGUAIS",idStaffEventoFromObject, idStaffEvento );
        // }else  {
        //     console.log("IDS SÃO DIFERENTES",idStaffEventoFromObject, idStaffEvento );
        // }


        
          
// Compare os IDs garantindo que ambos são do mesmo tipo (número)
            if (idStaffEventoFromObject === idStaffEventoNumero)
            {
                console.log("IDS SÃO IGUAIS", idStaffEventoFromObject, idStaffEventoNumero);
            } else {
                console.log("IDS SÃO DIFERENTES", idStaffEventoFromObject, idStaffEventoNumero);
            }

        // Estamos em modo de edição de um evento específico
        if (idStaffEvento && isFormLoadedFromDoubleClick && currentEditingStaffEvent && idStaffEventoFromObject === idStaffEventoNumero) {
            console.log("ENTROU NO METODO PUT");
            metodo = "PUT";
            url = `/staff/${idStaffEvento}`;
            console.log("Modo de edição detectado via idstaffevento e flag. Método:", metodo, "URL:", url);
        } else {
            // Estamos em modo de cadastro ou foi uma tentativa de PUT sem os dados originais
            metodo = "POST";
            url = "/staff";
            console.log("Modo de cadastro detectado. Método:", metodo, "URL:", url, "Status Orcamento", statusOrcamentoAtual);
            // Garante que estas variáveis estão resetadas para um POST
            currentEditingStaffEvent = null;
            isFormLoadedFromDoubleClick = false;

            // if (statusOrcamentoAtual === 'A') {
            //     Swal.fire({
            //         icon: 'warning',
            //         title: 'Impossível Cadastrar',
            //         text: 'Não é possível cadastrar staff em um orçamento que ainda não foi fechado.'
            //     });
            //     return; // O 'return' aqui vai, de fato, bloquear a função de cadastro
            // }
        }        

        if (pavilhao === "SELECIONE O PAVILHÃO") {
            pavilhao = ""; // Garante que seja uma string vazia. Isso é redundante se o value já é "", mas não prejudica.
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

        const idFuncionarioParaVerificacao = idFuncionario; // Use o idFuncionario capturado
        const idFuncaoDoFormulario = idFuncao;
        // As datas do Flatpickr já estão em 'periodoDoEvento' mas como strings 'YYYY-MM-DD'.
        // A função 'verificarDisponibilidadeStaff' espera um array de objetos Date.
        // Você precisa ter acesso à instância do Flatpickr, assumindo que seja `flatpickrForDatasEvento`.
        const flatpickrForDatasEvento = window.flatpickrInstances['datasEvento']; // Ou como você acessa sua instância do Flatpickr
        const datasParaVerificacao = flatpickrForDatasEvento.selectedDates; // Isso retorna um array de objetos Date

        const idStaffEventoParaVerificacao = currentEditingStaffEvent ? currentEditingStaffEvent.idstaffevento : null;

        console.log("Iniciando verificação de disponibilidade do staff...");
        const { isAvailable, conflictingEvent } = await verificarDisponibilidadeStaff(
            idFuncionarioParaVerificacao,
            datasParaVerificacao,
            idFuncaoDoFormulario,
            idEventoEmEdicao
           // idStaffEventoParaVerificacao
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

        // if (!isAvailable) {
        // // Usamos <strong> para negrito e `html: true` no Swal.fire
        //     let msg = `O funcionário <strong>${nmFuncionario}</strong> já está agendado para outra atividade `; 
        //     if (conflictingEvent) {
        //         msg += `no evento "<strong>${conflictingEvent.nmevento || 'N/A'}</strong>" do cliente "<strong>${conflictingEvent.nmcliente || 'N/A'}</strong>" `; 

        //         const conflictingDates = typeof conflictingEvent.datasevento === 'string' ? JSON.parse(conflictingEvent.datasevento) : conflictingEvent.datasevento;
        //         const intersection = datasParaVerificacao.map(d => d.toISOString().split('T')[0]).filter(date => conflictingDates.includes(date));
        //         if (intersection.length > 0) {
        //             msg += `nas datas: <strong>${intersection.map(d => { 
        //                 const parts = d.split('-');
        //                 return `${parts[2]}/${parts[1]}/${parts[0]}`; // Formato DD/MM/AAAA para exibição
        //             }).join(', ')}</strong>.`;
        //         } else {
        //             msg += `em datas conflitantes.`;
        //         }
        //     } else {
        //         msg += `em datas conflitantes.`;
        //     }
            
        //     // AQUI ESTÁ A MUDANÇA CRUCIAL: usar 'html: msg' em vez de 'text: msg' ou apenas 'msg'
        //     Swal.fire({
        //         title: "Conflito de Agendamento",
        //         html: msg, // Use 'html' para renderizar as tags <strong>
        //         icon: "warning"
        //     }); 
        //     return; // BLOQUEIA o envio do formulário
        // }

        if (!isAvailable) {
            // AQUI: A nova lógica de verificação de função
            // Se a função do conflito for IGUAL à função do agendamento atual
            if (conflictingEvent && String(conflictingEvent.idfuncao) === String(idFuncaoDoFormulario)) {
                // CENA 1: Conflito de agendamento para a MESMA FUNÇÃO (BLOQUEANTE)
                let msg = `O funcionário <strong>${nmFuncionario}</strong> já está agendado para a <strong>mesma função</strong>`;
                if (conflictingEvent) {
                    msg += ` no evento "<strong>${conflictingEvent.nmevento || 'N/A'}</strong>" do cliente "<strong>${conflictingEvent.nmcliente || 'N/A'}</strong>"`;
                }

                Swal.fire({
                    title: "Conflito de Agendamento",
                    html: msg,
                    icon: "error" // Use "error" para indicar que a operação não pode ser concluída
                });
                return; // BLOQUEIA o envio do formulário
            } else {
                // CENA 2: Conflito de agendamento para uma FUNÇÃO DIFERENTE (NÃO BLOQUEANTE)
                let msg = `O funcionário <strong>${nmFuncionario}</strong> já está agendado para uma <strong>função diferente</strong> `;
                if (conflictingEvent) {
                    msg += `no evento "<strong>${conflictingEvent.nmevento || 'N/A'}</strong>" do cliente "<strong>${conflictingEvent.nmcliente || 'N/A'}</strong>" `;
                }
                
                // Esta parte do seu código já está pronta para mostrar as datas do conflito
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
                    return; // O usuário cancelou, bloqueia o envio
                }
            }
        }

        console.log("Preparando dados para envio:", {
            nmFuncionario, descFuncao, nmLocalMontagem, nmCliente, nmEvento, vlrCusto, extra, transporte, almoco, jantar, caixinha,
            periodoDoEvento, vlrTotal
        });

        

        if (metodo === "POST")
        {
            const datasSelecionadas = window.flatpickrInstances['datasEvento'].selectedDates.map(date => {
                // Formata a data para a string 'YYYY-MM-DD'
                return date.toISOString().split('T')[0];
            });           

            const criteriosDeVerificacao = {
                nmFuncao: descFuncaoSelect.options[descFuncaoSelect.selectedIndex].text,
                nmEvento: nmEventoSelect.options[nmEventoSelect.selectedIndex].text,
                nmCliente: nmClienteSelect.options[nmClienteSelect.selectedIndex].text,
                nmlocalMontagem: nmLocalMontagemSelect.options[nmLocalMontagemSelect.selectedIndex].text,
                pavilhao: nmPavilhaoSelect.options[nmPavilhaoSelect.selectedIndex].text,
                datasEvento: datasSelecionadas // Adicionado o array de datas
            };
            console.log("VERIFICAÇÃO CAMPOS", descFuncao, nmEvento, nmCliente, nmLocalMontagem, pavilhao, datasEvento);

            // A verificação deve acontecer somente para novos cadastros
            if (!isFormLoadedFromDoubleClick && !verificarLimiteDeFuncao(criteriosDeVerificacao)) {
                // Se a verificação falhar, a execução é interrompida
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
                    // O header Content-Type é geralmente para 'body' no formato JSON,
                    // para GET com query params, não é estritamente necessário,
                    // mas não deve causar problemas.
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
        formData.append('vlrextra', extra);
        formData.append('vlrtransporte', transporte);
        formData.append('vlralmoco', almoco);
        formData.append('vlrjantar', jantar);
        formData.append('vlrcaixinha', caixinha);
        formData.append('descbonus', bonusTextarea.value.trim());
        // formData.append('Data de Evento:', dataevento);
        formData.append('datasevento', JSON.stringify(periodoDoEvento));
        formData.append('vlrtotal', total.toString()); 

        

        const fileCacheInput = document.getElementById('fileCache');
        const hiddenRemoverCacheInput = document.getElementById('limparComprovanteCache');
        let comppgtocacheDoForm; // Variável para a lógica de status
        
        if (fileCacheInput.files && fileCacheInput.files[0]) {
            // Caso 1: Novo arquivo selecionado.
            formData.append('comppgtocache', fileCacheInput.files[0]);
            comppgtocacheDoForm = 'novo-arquivo'; // Sinaliza a presença de um comprovante
        } else if (hiddenRemoverCacheInput.value === 'true') {
            // Caso 2: O usuário marcou para remover o arquivo existente.
            formData.append('limparComprovanteCache', 'true');
            comppgtocacheDoForm = ''; // Sinaliza a ausência de um comprovante
        } else if (currentEditingStaffEvent && currentEditingStaffEvent.comppgtocache) {
            // Caso 3: Nenhuma alteração foi feita, mas um arquivo já existe.
            // Não adiciona nada ao formData para manter o valor no backend,
            // mas define a variável para a validação do status.
            comppgtocacheDoForm = currentEditingStaffEvent.comppgtocache;
        } else {
            // Caso 4: Nenhuma alteração e nenhum arquivo existente.
            comppgtocacheDoForm = '';
        }

        // --- Comprovante de Ajuda de Custo ---
        const fileAjdCustoInput = document.getElementById('fileAjdCusto');
        const hiddenRemoverAjdCustoInput = document.getElementById('limparComprovanteAjdCusto');
        let comppgtoajdcustoDoForm;
        
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

        // --- Comprovante de Caixinha ---
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
        
        formData.append('descbeneficios', beneficioTextarea.value.trim());

        formData.append('setor', setor);

        let statusPgto = "Pendente"; // Valor padrão

            // --- Regras de Validação e Atribuição de statusPgto ---

            // Condição 1: Tudo vazio, exceto valorCache (que é obrigatório), E comprovanteCache preenchido
        console.log("VALORES CUSTOS ANTES", vlrCusto, extra, caixinha, almoco, jantar, transporte);
        const custosVazios = extra === 0 && caixinha === 0 && almoco === 0 && jantar === 0 && transporte === 0;
        console.log("VALORES CUSTOS DEPOIS", vlrCusto, extra, caixinha, almoco, jantar, transporte, comppgtocacheDoForm, comppgtocacheDoForm, comppgtocaixinhaDoForm);

        
        const vlrCache = parseFloat(vlrCusto); // Corrigindo a inconsistência de nomes
        const vlrAlmoco = parseFloat(almoco);
        const vlrJantar = parseFloat(jantar);
        const vlrTransporte = parseFloat(transporte);
        const vlrCaixinha = parseFloat(caixinha);

        const temComprovanteCache = !!comppgtocacheDoForm;
        const temComprovanteAjudaCusto = !!comppgtoajdcustoDoForm;
        const temComprovanteCaixinha = !!comppgtocaixinhaDoForm;

        // Lógica de Pagamento
        const cachePago = (vlrCache > 0 && temComprovanteCache);
        const ajudaCustoPaga = ((vlrAlmoco > 0 || vlrJantar > 0 || vlrTransporte > 0) && temComprovanteAjudaCusto);
        const caixinhasPagos = ((vlrCaixinha > 0) && temComprovanteCaixinha);

        // A condição para o status ser 'Pago' é se *todas* as partes que têm valor > 0, 
        // também têm o seu comprovante.
        // Esta é a lógica mais segura e fácil de ler.
        if (cachePago && ajudaCustoPaga && caixinhasPagos) {
            // Se tudo que tem valor > 0 tem comprovante, então é "Pago"
            statusPgto = "Pago";
        } else if (
            (vlrCache <= 0 || (vlrCache > 0 && temComprovanteCache)) && // Se o cache não precisa de comprovação ou está pago
            ((vlrAlmoco <= 0 && vlrJantar <= 0 && vlrTransporte <= 0) || ((vlrAlmoco > 0 || vlrJantar > 0 || vlrTransporte > 0) && temComprovanteAjudaCusto)) && // Mesma lógica para ajuda de custo
            (vlrCaixinha <= 0 || (vlrCaixinha > 0 && temComprovanteCaixinha)) // Mesma lógica para extras
        ) {
            // Se tudo que tem valor > 0 tem comprovante, então é "Pago"
            statusPgto = "Pago";
        } else {
            statusPgto = "Pendente";
        }


        console.log("Status de Pagamento Calculado:", statusPgto);

        formData.append('statuspgto', statusPgto);

        console.log("Preparando envio de FormData. Método:", metodo, "URL:", url, window.StaffOriginal);
        console.log("Dados do FormData:", {
            nmFuncionario, descFuncao, vlrCusto, extra, transporte, almoco, jantar, caixinha,
            nmCliente, nmEvento, periodoDoEvento, vlrTotal
        });

        console.log("METODO PARA ENVIAR",metodo, currentEditingStaffEvent);

            // 🎯 LOG DO FORMDATA ANTES DO ENVIO 🎯
        console.log("Preparando envio de FormData. Método:", metodo, "URL:", url);
        console.log("Dados do FormData sendo enviados:");

        for (let pair of formData.entries()) {
            console.log(pair[0]+ ': ' + pair[1]); 
        }


        if (metodo === "PUT") {
            if (!isEditingInitial) { // Use isEditing aqui também para ser consistente
                console.log("Erro: Dados originais não encontrados para PUT");
                return Swal.fire("Erro", "Dados originais não encontrados para comparação (ID ausente para PUT).", "error");
            }

            // Valores originais dos checkboxes (considera ativo se valor numérico > 0)
            const extraAtivoOriginal = parseFloat(currentEditingStaffEvent.vlrextra || 0) > 0;
            const caixinhaAtivoOriginal = parseFloat(currentEditingStaffEvent.vlrcaixinha || 0) > 0;
            const extraValorOriginal = parseFloat(currentEditingStaffEvent.vlrextra || 0);
            const caixinhaValorOriginal = parseFloat(currentEditingStaffEvent.vlrcaixinha || 0);

            console.log("Valores originais - Extra Ativo:", extraAtivoOriginal, "Extra Valor:", extraValorOriginal);
            console.log("Valores originais - Caixinha Ativo:", caixinhaAtivoOriginal, "Caixinha Valor:", caixinhaValorOriginal);

            // Valores atuais (checkboxes e inputs)
            const extraAtivoAtual = extraAtivo;
            const caixinhaAtivoAtual = caixinhaAtivo;
            const extraValorAtual = parseFloat(extra.replace(',', '.') || 0);
            const caixinhaValorAtual = parseFloat(caixinha.replace(',', '.') || 0);

            console.log("Valores atuais - Extra Ativo:", extraAtivoAtual, "Extra Valor:", extraValorAtual);
            console.log("Valores atuais - Caixinha Ativo:", caixinhaAtivoAtual, "Caixinha Valor:", caixinhaValorAtual);

            // Detecta alterações em estado ou valor
            const houveAlteracaoExtra = (extraAtivoOriginal !== extraAtivoAtual) || (extraValorOriginal !== extraValorAtual);
            const houveAlteracaoCaixinha = (caixinhaAtivoOriginal !== caixinhaAtivoAtual) || (caixinhaValorOriginal !== caixinhaValorAtual);

            console.log("Houve alteração Extra?", houveAlteracaoExtra);
            console.log("Houve alteração Caixinha?", houveAlteracaoCaixinha);

            // Se houve alteração ativando extra ou caixinha, obrigar preenchimento de descBeneficio
            if (houveAlteracaoCaixinha && caixinhaAtivoAtual) {            
                console.log("Extra ou Caixinha ativado e houve alteração, verificando descBeneficio...");
                if (!descBeneficio || descBeneficio.length < 20) {
                    console.log("descBeneficio inválido - bloqueando salvamento");
                    if (descBeneficioInput) descBeneficioInput.focus();
                    return Swal.fire(
                        "Campos obrigatórios!",
                        "A descrição do benefício (Caixinha) deve ter no mínimo 20 caracteres para salvar.",
                        "warning"
                    );
                } else {
                    console.log("descBeneficio preenchido corretamente");
                }
            } else {
                console.log("Nenhuma alteração relevante em Caixinha que obrigue descBeneficio");
            }

            if (houveAlteracaoExtra && extraAtivoAtual) {
                console.log("Extra ou Caixinha ativado e houve alteração, verificando descBonus...");
                if (!descBonus || descBonus.length < 20) {
                    console.log("descBonus inválido - bloqueando salvamento");
                    if (descBonus) descBonusInput.focus();
                    return Swal.fire(
                        "Campos obrigatórios!",
                        "A descrição do Bônus deve ter no mínimo 20 caracteres para salvar.",
                        "warning"
                    );
                } else {
                    console.log("descBonus preenchido corretamente");
                }
            } else {
                console.log("Nenhuma alteração relevante em Bônusque obrigue descBonus");
            }

            formData.append('idstaff', currentEditingStaffEvent.idstaff || '');
            formData.append('idstaffevento', currentEditingStaffEvent.idstaffevento);

            let houveAlteracao = false;
            if (
                currentEditingStaffEvent.idfuncionario != idFuncionario ||
                currentEditingStaffEvent.nmfuncao.toUpperCase() != descFuncao ||
                parseFloat(currentEditingStaffEvent.vlrcache || 0) != parseFloat(vlrCusto.replace(',', '.') || 0) ||
                JSON.stringify(currentEditingStaffEvent.periodo || []) !== JSON.stringify(periodoDoEvento) ||
                parseFloat(currentEditingStaffEvent.vlrextra || 0) != extraValorAtual ||
                parseFloat(currentEditingStaffEvent.vlrtransporte || 0) != parseFloat(transporte.replace(',', '.') || 0) ||
                parseFloat(currentEditingStaffEvent.vlralmoco || 0) != parseFloat(almoco.replace(',', '.') || 0) ||
                parseFloat(currentEditingStaffEvent.vlrjantar || 0) != parseFloat(jantar.replace(',', '.') || 0) ||
                // (currentEditingStaffEvent.vlralmoco === 1 ? '1' : '0') != almoco ||
                // (currentEditingStaffEvent.vlrjantar === 1 ? '1' : '0') != jantar ||
                parseFloat(currentEditingStaffEvent.vlrcaixinha || 0) != caixinhaValorAtual ||
                (currentEditingStaffEvent.descbonus || '').trim() != descBonus.trim() ||
                (currentEditingStaffEvent.descbeneficios || '').trim() != descBeneficio.trim() ||
                (currentEditingStaffEvent.setor || '').trim() != setor.trim() ||
                currentEditingStaffEvent.idcliente != idCliente ||
                currentEditingStaffEvent.idevento != idEvento ||
                currentEditingStaffEvent.idmontagem != idMontagem ||
                (currentEditingStaffEvent.pavilhao || '').toUpperCase().trim() != pavilhao ||
                (currentEditingStaffEvent.statuspgto || '').trim() != statusPgto.trim()
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
                logAndCheck('Valor Extra', parseFloat(currentEditingStaffEvent.vlrextra || 0), extraValorAtual, parseFloat(currentEditingStaffEvent.vlrextra || 0) != extraValorAtual) ||
                logAndCheck('Valor Transporte', parseFloat(currentEditingStaffEvent.vlrtransporte || 0), parseFloat(almoco.replace(',', '.') || 0), parseFloat(currentEditingStaffEvent.vlrtransporte || 0) != parseFloat(transporte.replace(',', '.') || 0)) ||
                logAndCheck('Valor Almoço', parseFloat(currentEditingStaffEvent.vlralmoco || 0), parseFloat(transporte.replace(',', '.') || 0), parseFloat(currentEditingStaffEvent.vlralmoco || 0) != parseFloat(almoco.replace(',', '.') || 0)) ||
                logAndCheck('Valor Jantar', parseFloat(currentEditingStaffEvent.vlrjantar || 0), parseFloat(jantar.replace(',', '.') || 0), parseFloat(currentEditingStaffEvent.vlrjantar || 0) != parseFloat(jantar.replace(',', '.') || 0)) ||
                logAndCheck('Valor Caixinha', parseFloat(currentEditingStaffEvent.vlrcaixinha || 0), caixinhaValorAtual, parseFloat(currentEditingStaffEvent.vlrcaixinha || 0) != caixinhaValorAtual) ||
                logAndCheck('Descrição Bônus', (currentEditingStaffEvent.descbonus || '').trim(), descBonus.trim(), (currentEditingStaffEvent.descbonus || '').trim() != descBonus.trim()) ||
                logAndCheck('Descrição Benefícios', (currentEditingStaffEvent.descbeneficios || '').trim(), descBeneficio.trim(), (currentEditingStaffEvent.descbeneficios || '').trim() != descBeneficio.trim()) ||
                logAndCheck('Setor', (currentEditingStaffEvent.setor.toUpperCase() || '').trim(), setor.trim().toUpperCase(), (currentEditingStaffEvent.setor.toUpperCase() || '').trim() != setor.toUpperCase().trim()) ||
                logAndCheck('StatusPgto', (currentEditingStaffEvent.statuspgto || '').trim(), statusPgto.trim(), (currentEditingStaffEvent.statuspgto || '').trim() != statusPgto.trim()) ||
                logAndCheck('ID Cliente', currentEditingStaffEvent.idcliente, idCliente, currentEditingStaffEvent.idcliente != idCliente) ||
                logAndCheck('ID Evento', currentEditingStaffEvent.idevento, idEvento, currentEditingStaffEvent.idevento != idEvento) ||
                logAndCheck('ID Montagem', currentEditingStaffEvent.idmontagem, idMontagem, currentEditingStaffEvent.idmontagem != idMontagem) ||
                logAndCheck('Pavilhão', (currentEditingStaffEvent.pavilhao || '').toUpperCase().trim(), pavilhao.toUpperCase().trim(), (currentEditingStaffEvent.pavilhao || '').toUpperCase().trim() != pavilhao.toUpperCase().trim()) ||
                // logAndCheck('Comprovante Cache', currentEditingStaffEvent.comppgtocache, comppgtocacheDoForm, currentEditingStaffEvent.comppgtocache !== comppgtocacheDoForm) ||
                // logAndCheck('Comprovante Ajuda Custo', currentEditingStaffEvent.comppgtoajdcusto, comppgtoajdcustoDoForm, currentEditingStaffEvent.comppgtoajdcusto !== comppgtoajdcustoDoForm) ||
                // logAndCheck('Comprovante Extras', currentEditingStaffEvent.comppgtocaixinha, comppgtocaixinhaDoForm, currentEditingStaffEvent.comppgtocaixinha !== comppgtocaixinhaDoForm) ||

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
                    'Comprovante Extras',
                    normalizeEmptyValue(currentEditingStaffEvent.comppgtocaixinha),
                    normalizeEmptyValue(comppgtocaixinhaDoForm),
                    normalizeEmptyValue(currentEditingStaffEvent.comppgtocaixinha) !== normalizeEmptyValue(comppgtocaixinhaDoForm)
                );

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
    const datasEventoRawValue = datasEventoInput.value.trim();
    const periodoDoEvento = getPeriodoDatas(datasEventoRawValue);

    // Apenas chame a API se os campos obrigatórios estiverem preenchidos
    if (idEvento && idCliente && periodoDoEvento.length > 0) {
      buscarEPopularOrcamento(idEvento, idCliente, idLocalMontagem, setorParaBusca, periodoDoEvento);
    }
}, 500);

// const onCriteriosChanged = () => {
//         console.log("ENTROU NO ONCRITEIOSCHANGED ENVIAR");
//         if (isFormLoadedFromDoubleClick) {
//             console.log("É DUPLO CLICK ?", isFormLoadedFromDoubleClick);
//            // return; // Sai da função imediatamente
//         }
//             const idEvento = nmEventoSelect.value;
//             const idCliente = nmClienteSelect.value;
//             const idLocalMontagem = nmLocalMontagemSelect.value;
//             //const idPavilhao = nmPavilhaoSelect.value;
//             const setorParaBusca = setor.value;
            
//             const datasEventoRawValue = datasEventoInput.value.trim();
//             const periodoDoEvento = getPeriodoDatas(datasEventoRawValue);

//             if (idEvento && idCliente) {
//                 buscarEPopularOrcamento(idEvento, idCliente, idLocalMontagem, setorParaBusca, periodoDoEvento);
//             }
//              console.log("VERIFICAÇÃO CRITÉRIOS", idEvento, idCliente, idLocalMontagem, setorParaBusca, periodoDoEvento );
//         };
       
// const handleFormSubmit = async (e) => {
//     // Agora toda a lógica está aqui dentro, de forma organizada
//     e.preventDefault(); // Previne o envio padrão do formulário      

//         const selectAvaliacao = document.getElementById("avaliacao");
//         const avaliacao = selectAvaliacao.options[selectAvaliacao.selectedIndex]?.textContent.trim().toUpperCase() || '';
//         const idStaff = document.querySelector("#idStaff").value.trim();
//         const idFuncionario = document.querySelector("#idFuncionario").value;
//         const selectFuncionario = document.getElementById("nmFuncionario");
//         const nmFuncionario = selectFuncionario.options[selectFuncionario.selectedIndex]?.textContent.trim().toUpperCase() || '';
//         const idFuncao = document.querySelector("#idFuncao").value;
//         const selectFuncao = document.getElementById("descFuncao");
//         const descFuncao = selectFuncao.options[selectFuncao.selectedIndex]?.textContent.trim().toUpperCase() || '';
//         const vlrCusto = document.querySelector("#vlrCusto").value.trim() || '0';
//         const extra = document.querySelector("#extra").value.trim() || '0';
//         const transporte = document.querySelector("#transporte").value.trim() || '0';
//         const almoco = document.querySelector("#almoco").value.trim() || '0';
//         const jantar = document.querySelector("#jantar").value.trim() || '0';
//         const caixinha = document.querySelector("#caixinha").value.trim() || '0';
//         const idCliente = document.querySelector("#idCliente").value; 
//         const selectCliente = document.getElementById("nmCliente");
//         const nmCliente = selectCliente.options[selectCliente.selectedIndex]?.textContent.trim().toUpperCase() || '';
//         const idEvento = document.querySelector("#idEvento").value;       
//         const selectEvento = document.getElementById("nmEvento");
//         const nmEvento = selectEvento.options[selectEvento.selectedIndex]?.textContent.trim().toUpperCase() || '';
//         const idMontagem = document.querySelector("#idMontagem").value; // ID do local de montagem (FK)
//         const selectLocalMontagem = document.getElementById("nmLocalMontagem");
//         const nmLocalMontagem = selectLocalMontagem.options[selectLocalMontagem.selectedIndex].textContent.trim();
//         const selectPavilhao = document.getElementById("nmPavilhao");
//         let pavilhao = selectPavilhao.options[selectPavilhao.selectedIndex]?.textContent.trim().toUpperCase() || '';
//         const caixinhaAtivo = document.getElementById("Caixinhacheck")?.checked;
//         const extraAtivo = document.getElementById("Extracheck")?.checked;
//         const descBeneficioInput = document.getElementById("descBeneficio");
//         const descBonusInput = document.getElementById("bonus");
//         const descBonus = descBonusInput.value.trim() || "";
//         const descBeneficio = descBeneficioInput?.value.trim() || "";
//         const setor = document.querySelector("#setor").value; 
        
//         const datasEventoRawValue = datasEventoInput.value.trim();
//         const periodoDoEvento = getPeriodoDatas(datasEventoRawValue);     

        
      
//         if (periodoDoEvento.length === 0) {
//             return Swal.fire("Campo obrigatório!", "Por favor, selecione os dias do evento.", "warning");
//         }

//         const vlrTotal = document.getElementById('vlrTotal').value; // "R$ 2.345,00"
//         const total = parseFloat(
//         vlrTotal
//             .replace('R$', '') // remove símbolo
//             .replace(/\./g, '') // remove milhares
//             .replace(',', '.') // troca vírgula por ponto
//             .trim()
//         ) || 0;


//         if(!nmFuncionario || !descFuncao || !vlrCusto || !nmCliente || !nmEvento || !periodoDoEvento){
//             return Swal.fire("Campos obrigatórios!", "Preencha todos os campos obrigatórios: Funcionário, Função, Cachê, Transportes, Alimentação, Cliente, Evento e Período do Evento.", "warning");
//         }

//         if ((caixinhaAtivo) && !descBeneficio) {
//             // Coloca foco no campo de descrição (opcional)
//             if (descBeneficioInput) {
//                 descBeneficioInput.focus();
//             }
//             // Bloqueia envio e mostra aviso
//             return Swal.fire(
//                 "Campos obrigatórios!",
//                 "Preencha a descrição do benefício (Caixinha) antes de salvar.",
//                 "warning"
//             );
//         }

//         if ((extraAtivo) && !descBonus) {
//             // Coloca foco no campo de descrição (opcional)
//             if (descBonusInput) {
//                 descBonusInput.focus();
//             }
//             // Bloqueia envio e mostra aviso
//             return Swal.fire(
//                 "Campos obrigatórios!",
//                 "Preencha a descrição do bônus antes de salvar.",
//                 "warning"
//             );
//         }
        
//       // Permissões
//         const temPermissaoCadastrar = temPermissao("Staff", "cadastrar");
//         const temPermissaoAlterar = temPermissao("Staff", "alterar");

        
//         const idStaffEvento = document.querySelector("#idStaffEvento").value;

       
//         // const isEditingInitial = currentEditingStaffEvent && currentEditingStaffEvent.idstaffevento; // Estado inicial do formulário
//         // const idEventoEmEdicao = isEditingInitial ? currentEditingStaffEvent.idstaffevento : null;

//         // console.log("EM EDIÇÃO?",isEditingInitial, idEventoEmEdicao);

//         // let metodo = isEditingInitial ? "PUT" : "POST"; // Método inicial
//         // let url = isEditingInitial ? `/staff/${currentEditingStaffEvent.idstaffevento}` : "/staff";

//         // Verifica se o formulário está em modo de edição
//         const isEditingInitial = !!(currentEditingStaffEvent && currentEditingStaffEvent.idstaffevento);

//         // Obtém o ID do evento em edição, se houver
//         const idEventoEmEdicao = isEditingInitial ? currentEditingStaffEvent.idstaffevento : null;

//         console.log("EM EDIÇÃO?", isEditingInitial, idEventoEmEdicao);

//         let metodo = isEditingInitial ? "PUT" : "POST";
//         let url = isEditingInitial ? `/staff/${idEventoEmEdicao}` : "/staff";
        
//          const idStaffEventoFromObject = currentEditingStaffEvent ? currentEditingStaffEvent.idstaffevento : null;
        
//         // console.log("idSTAFFEVENTO", idStaffEvento, isFormLoadedFromDoubleClick, currentEditingStaffEvent, idStaffEventoFromObject);
            
//         // if (idStaffEventoFromObject === idStaffEvento)
//         // {
//         //     console.log("IDS SÃO IGUAIS",idStaffEventoFromObject, idStaffEvento );
//         // }else  {
//         //     console.log("IDS SÃO DIFERENTES",idStaffEventoFromObject, idStaffEvento );
//         // }


//         const idStaffEventoNumero = parseInt(idStaffEvento, 10);
//         console.log("idSTAFFEVENTO", idStaffEvento, isFormLoadedFromDoubleClick, currentEditingStaffEvent, idStaffEventoFromObject);
          
// // Compare os IDs garantindo que ambos são do mesmo tipo (número)
// if (idStaffEventoFromObject === idStaffEventoNumero)
// {
//     console.log("IDS SÃO IGUAIS", idStaffEventoFromObject, idStaffEventoNumero);
// } else {
//     console.log("IDS SÃO DIFERENTES", idStaffEventoFromObject, idStaffEventoNumero);
// }

//         // Estamos em modo de edição de um evento específico
//         if (idStaffEvento && isFormLoadedFromDoubleClick && currentEditingStaffEvent && idStaffEventoFromObject === idStaffEventoNumero) {
//             console.log("ENTROU NO METODO PUT");
//             metodo = "PUT";
//             url = `/staff/${idStaffEvento}`;
//             console.log("Modo de edição detectado via idstaffevento e flag. Método:", metodo, "URL:", url);
//         } else {
//             // Estamos em modo de cadastro ou foi uma tentativa de PUT sem os dados originais
//             metodo = "POST";
//             url = "/staff";
//             console.log("Modo de cadastro detectado. Método:", metodo, "URL:", url);
//             // Garante que estas variáveis estão resetadas para um POST
//             currentEditingStaffEvent = null;
//             isFormLoadedFromDoubleClick = false;
//         }        

//         if (pavilhao === "SELECIONE O PAVILHÃO") {
//             pavilhao = ""; // Garante que seja uma string vazia. Isso é redundante se o value já é "", mas não prejudica.
//         } 

//         if (metodo === "POST" && !temPermissaoCadastrar) {
//             return Swal.fire("Acesso negado", "Você não tem permissão para cadastrar novos staffs.", "error");
//         }

//         if (metodo === "PUT" && !temPermissaoAlterar) {
//             return Swal.fire("Acesso negado", "Você não tem permissão para alterar staffs.", "error");
//         }


//         console.log("--- INÍCIO handleFormSubmit ---");
// console.log("Método inicial:", metodo); // POST ou PUT
// console.log("Carregado por duplo clique (isFormLoadedFromDoubleClick):", isFormLoadedFromDoubleClick);
// console.log("currentEditingStaffEvent (antes da verificação):", currentEditingStaffEvent);

//         const idFuncionarioParaVerificacao = idFuncionario; // Use o idFuncionario capturado
//         // As datas do Flatpickr já estão em 'periodoDoEvento' mas como strings 'YYYY-MM-DD'.
//         // A função 'verificarDisponibilidadeStaff' espera um array de objetos Date.
//         // Você precisa ter acesso à instância do Flatpickr, assumindo que seja `flatpickrForDatasEvento`.
//         const flatpickrForDatasEvento = window.flatpickrInstances['datasEvento']; // Ou como você acessa sua instância do Flatpickr
//         const datasParaVerificacao = flatpickrForDatasEvento.selectedDates; // Isso retorna um array de objetos Date

//         const idStaffEventoParaVerificacao = currentEditingStaffEvent ? currentEditingStaffEvent.idstaffevento : null;

//         console.log("Iniciando verificação de disponibilidade do staff...");
//         const { isAvailable, conflictingEvent } = await verificarDisponibilidadeStaff(
//             idFuncionarioParaVerificacao,
//             datasParaVerificacao,
//             idEventoEmEdicao
//            // idStaffEventoParaVerificacao
//         );


//         console.log("Dados do formulário para verificação de duplicidade:", {
//             idFuncionario: idFuncionario,
//             nmFuncionario: nmFuncionario,
//             setor: setor,
//             nmlocalmontagem: nmLocalMontagem,
//             nmevento: nmEvento,
//             nmcliente: nmCliente,
//             datasevento: JSON.stringify(periodoDoEvento)
//         });

//         if (!isAvailable) {
//         // Usamos <strong> para negrito e `html: true` no Swal.fire
//             let msg = `O funcionário <strong>${nmFuncionario}</strong> já está agendado para outra atividade `; 
//             if (conflictingEvent) {
//                 msg += `no evento "<strong>${conflictingEvent.nmevento || 'N/A'}</strong>" do cliente "<strong>${conflictingEvent.nmcliente || 'N/A'}</strong>" `; 

//                 const conflictingDates = typeof conflictingEvent.datasevento === 'string' ? JSON.parse(conflictingEvent.datasevento) : conflictingEvent.datasevento;
//                 const intersection = datasParaVerificacao.map(d => d.toISOString().split('T')[0]).filter(date => conflictingDates.includes(date));
//                 if (intersection.length > 0) {
//                     msg += `nas datas: <strong>${intersection.map(d => { 
//                         const parts = d.split('-');
//                         return `${parts[2]}/${parts[1]}/${parts[0]}`; // Formato DD/MM/AAAA para exibição
//                     }).join(', ')}</strong>.`;
//                 } else {
//                     msg += `em datas conflitantes.`;
//                 }
//             } else {
//                 msg += `em datas conflitantes.`;
//             }
            
//             // AQUI ESTÁ A MUDANÇA CRUCIAL: usar 'html: msg' em vez de 'text: msg' ou apenas 'msg'
//             Swal.fire({
//                 title: "Conflito de Agendamento",
//                 html: msg, // Use 'html' para renderizar as tags <strong>
//                 icon: "warning"
//             }); 
//             return; // BLOQUEIA o envio do formulário
//         }

//         console.log("Preparando dados para envio:", {
//             nmFuncionario, descFuncao, nmLocalMontagem, nmCliente, nmEvento, vlrCusto, extra, transporte, almoco, jantar, caixinha,
//             periodoDoEvento, vlrTotal
//         });

//         if (metodo === "POST" || (metodo === "PUT" && !isFormLoadedFromDoubleClick)) {
//             console.log("Iniciando verificação de duplicidade. Método Inicial:", metodo, "Carregado por duplo clique:", isFormLoadedFromDoubleClick);
//             try {
//                 const checkDuplicateUrl = `/staff/check-duplicate?` + new URLSearchParams({
//                     idFuncionario: idFuncionario,
//                     nmFuncionario: nmFuncionario,
//                     setor: setor,
//                     nmlocalmontagem: nmLocalMontagem,
//                     nmevento: nmEvento,
//                     nmcliente: nmCliente,
//                     datasevento: JSON.stringify(periodoDoEvento)
//                 }).toString();

//                 const duplicateCheckResult = await fetchComToken(checkDuplicateUrl, {
//                     method: 'GET',
//                     // O header Content-Type é geralmente para 'body' no formato JSON,
//                     // para GET com query params, não é estritamente necessário,
//                     // mas não deve causar problemas.
//                     headers: { 'Content-Type': 'application/json' }
//                 });

//                 if (duplicateCheckResult.isDuplicate) {

//                     const existingEventData = duplicateCheckResult.existingEvent;

                    
//                     console.log("!!! DUPLICADO ENCONTRADO !!!");
//                     console.log("Evento duplicado retornado pelo backend:", existingEventData);
//                     console.log("Comparando:", currentEditingStaffEvent?.idstaffevento, "com", existingEventData?.idstaffevento);

                    
//                     console.log("COMPARACAO", currentEditingStaffEvent, existingEventData);

//                     if (currentEditingStaffEvent && currentEditingStaffEvent.idstaffevento === existingEventData.idstaffevento) {
                       
//                         console.log("Evento existente detectado e em modo de edição. É o mesmo registro. Prosseguindo para verificação de alteração.");
//                         metodo = "PUT"; // Garante que o método continua PUT
//                         url = `/staff/${existingEventData.idstaffevento}`; // Garante a URL correta
//                         currentEditingStaffEvent = existingEventData; // Atualiza com os dados mais recentes do backend
//                         // isFormLoadedFromDoubleClick = true; // Já deveria ser true se chegou aqui por duplo clique
//                     } else {
                        
//                         const { isConfirmed } = await Swal.fire({
//                             icon: "info",
//                             title: "Evento Duplicado!",
//                             html: `O evento para o funcionário <strong>${nmFuncionario}</strong> com as datas selecionadas já está cadastrado.<br><br>Deseja Atualizar o registro existente?`,
//                             showCancelButton: true,
//                             confirmButtonText: "Sim, atualizar",
//                             cancelButtonText: "Não, cancelar",
//                             reverseButtons: true
//                         });

//                         if (!isConfirmed) {
//                             console.log("Usuário optou por não atualizar o evento duplicado.");
//                             return; 
//                         }
                        
//                         console.log("Usuário confirmou a atualização do evento duplicado. Alterando para modo PUT.");
//                         metodo = "PUT";
//                         url = `/staff/${existingEventData.idstaffevento}`; // Usa o ID do evento duplicado encontrado
//                         currentEditingStaffEvent = existingEventData; // Define o evento a ser editado como o duplicado
//                         isFormLoadedFromDoubleClick = true; // Marca como "carregado por duplo clique" para pular a verificação futura para este item
//                     }

//                 } else {
                    
//                     console.log("Nenhum evento duplicado encontrado. Prosseguindo com o método original:", metodo);
//                 }
//             } catch (error) {
//                 console.error("Erro na verificação de duplicidade:", error);
//                 Swal.fire("Erro", error.message || "Não foi possível verificar duplicidade. Tente novamente.", "error");
//                 return; // Bloqueia o envio se houver erro na verificação
//             }
//         } else {
//             console.log("Pulando verificação de duplicidade (modo de edição via duplo clique já está ativo).");
//         }

//         const formData = new FormData();
//         // Adiciona todos os campos de texto ao FormData
//         formData.append('avaliacao', avaliacao);
//         formData.append('idfuncionario', idFuncionario);
//         formData.append('nmfuncionario', nmFuncionario);
//         formData.append('idfuncao', idFuncao);
//         formData.append('nmfuncao', descFuncao);
//         formData.append('idcliente', idCliente);
//         formData.append('nmcliente', nmCliente);
//         formData.append('idevento', idEvento);
//         formData.append('nmevento', nmEvento);
//         formData.append('idmontagem', idMontagem);
//         formData.append('nmlocalmontagem', nmLocalMontagem);
//         formData.append('pavilhao', pavilhao); 
//         formData.append('vlrcache', vlrCusto);
//         formData.append('vlrextra', extra);
//         formData.append('vlrtransporte', transporte);
//         formData.append('vlralmoco', almoco);
//         formData.append('vlrjantar', jantar);
//         formData.append('vlrcaixinha', caixinha);
//         formData.append('descbonus', bonusTextarea.value.trim());       
//         formData.append('datasevento', JSON.stringify(periodoDoEvento));
//         formData.append('vlrtotal', total.toString());         

//         const fileCacheInput = document.getElementById('fileCache');
//         const hiddenRemoverCacheInput = document.getElementById('limparComprovanteCache');
//         let comppgtocacheDoForm; // Variável para a lógica de status
        
//         if (fileCacheInput.files && fileCacheInput.files[0]) {
//             // Caso 1: Novo arquivo selecionado.
//             formData.append('comppgtocache', fileCacheInput.files[0]);
//             comppgtocacheDoForm = 'novo-arquivo'; // Sinaliza a presença de um comprovante
//         } else if (hiddenRemoverCacheInput.value === 'true') {
//             // Caso 2: O usuário marcou para remover o arquivo existente.
//             formData.append('limparComprovanteCache', 'true');
//             comppgtocacheDoForm = ''; // Sinaliza a ausência de um comprovante
//         } else if (currentEditingStaffEvent && currentEditingStaffEvent.comppgtocache) {
//             // Caso 3: Nenhuma alteração foi feita, mas um arquivo já existe.
//             // Não adiciona nada ao formData para manter o valor no backend,
//             // mas define a variável para a validação do status.
//             comppgtocacheDoForm = currentEditingStaffEvent.comppgtocache;
//         } else {
//             // Caso 4: Nenhuma alteração e nenhum arquivo existente.
//             comppgtocacheDoForm = '';
//         }

//         // --- Comprovante de Ajuda de Custo ---
//         const fileAjdCustoInput = document.getElementById('fileAjdCusto');
//         const hiddenRemoverAjdCustoInput = document.getElementById('limparComprovanteAjdCusto');
//         let comppgtoajdcustoDoForm;
        
//         if (fileAjdCustoInput.files && fileAjdCustoInput.files[0]) {
//             formData.append('comppgtoajdcusto', fileAjdCustoInput.files[0]);
//             comppgtoajdcustoDoForm = 'novo-arquivo';
//         } else if (hiddenRemoverAjdCustoInput.value === 'true') {
//             formData.append('limparComprovanteAjdCusto', 'true');
//             comppgtoajdcustoDoForm = '';
//         } else if (currentEditingStaffEvent && currentEditingStaffEvent.comppgtoajdcusto) {
//             comppgtoajdcustoDoForm = currentEditingStaffEvent.comppgtoajdcusto;
//         } else {
//             comppgtoajdcustoDoForm = '';
//         }

//         // --- Comprovante de Caixinha ---
//         const fileCaixinhaInput = document.getElementById('fileCaixinha');
//         const hiddenRemoverCaixinhaInput = document.getElementById('limparComprovanteCaixinha');
//         let comppgtocaixinhaDoForm;

//         if (fileCaixinhaInput.files && fileCaixinhaInput.files[0]) {
//             formData.append('comppgtocaixinha', fileCaixinhaInput.files[0]);
//             comppgtocaixinhaDoForm = 'novo-arquivo';
//         } else if (hiddenRemoverCaixinhaInput.value === 'true') {
//             formData.append('limparComprovanteCaixinha', 'true');
//             comppgtocaixinhaDoForm = '';
//         } else if (currentEditingStaffEvent && currentEditingStaffEvent.comppgtocaixinha) {
//             comppgtocaixinhaDoForm = currentEditingStaffEvent.comppgtocaixinha;
//         } else {
//             comppgtocaixinhaDoForm = '';
//         }
        
//         formData.append('descbeneficios', beneficioTextarea.value.trim());

//         formData.append('setor', setor);

//         let statusPgto = "Pendente"; // Valor padrão

//             // --- Regras de Validação e Atribuição de statusPgto ---

//             // Condição 1: Tudo vazio, exceto valorCache (que é obrigatório), E comprovanteCache preenchido
//             console.log("VALORES CUSTOS ANTES", vlrCusto, extra, caixinha, almoco, jantar, transporte);
//             const custosVazios = extra === 0 && caixinha === 0 && almoco === 0 && jantar === 0 && transporte === 0;
//             console.log("VALORES CUSTOS DEPOIS", vlrCusto, extra, caixinha, almoco, jantar, transporte, comppgtocacheDoForm, comppgtocacheDoForm, comppgtocaixinhaDoForm);

            
//             const vlrCache = parseFloat(vlrCusto); // Corrigindo a inconsistência de nomes
//             const vlrAlmoco = parseFloat(almoco);
//             const vlrJantar = parseFloat(jantar);
//             const vlrTransporte = parseFloat(transporte);
//             const vlrCaixinha = parseFloat(caixinha);

//             const temComprovanteCache = !!comppgtocacheDoForm;
//             const temComprovanteAjudaCusto = !!comppgtoajdcustoDoForm;
//             const temComprovanteCaixinha = !!comppgtocaixinhaDoForm;


//             console.log("TEM COMPROVANTES", temComprovanteAjudaCusto, temComprovanteCache, temComprovanteCaixinha);
//             // Lógica de Pagamento
//             const cachePago = (vlrCache > 0 && temComprovanteCache);
//             const ajudaCustoPaga = ((vlrAlmoco > 0 || vlrJantar > 0 || vlrTransporte > 0) && temComprovanteAjudaCusto);
//             const caixinhasPagos = ((vlrCaixinha > 0) && temComprovanteCaixinha);

//             // A condição para o status ser 'Pago' é se *todas* as partes que têm valor > 0, 
//             // também têm o seu comprovante.
//             // Esta é a lógica mais segura e fácil de ler.
//             if (cachePago && ajudaCustoPaga && caixinhasPagos) {
//                 // Se tudo que tem valor > 0 tem comprovante, então é "Pago"
//                 statusPgto = "Pago";
//             } else if (
//                 (vlrCache <= 0 || (vlrCache > 0 && temComprovanteCache)) && // Se o cache não precisa de comprovação ou está pago
//                 ((vlrAlmoco <= 0 && vlrJantar <= 0 && vlrTransporte <= 0) || ((vlrAlmoco > 0 || vlrJantar > 0 || vlrTransporte > 0) && temComprovanteAjudaCusto)) && // Mesma lógica para ajuda de custo
//                 (vlrCaixinha <= 0 || (vlrCaixinha > 0 && temComprovanteCaixinha)) // Mesma lógica para extras
//             ) {
//                 // Se tudo que tem valor > 0 tem comprovante, então é "Pago"
//                 statusPgto = "Pago";
//             } else {
//                 statusPgto = "Pendente";
//             }


//             console.log("Status de Pagamento Calculado:", statusPgto);

//         formData.append('statuspgto', statusPgto);

//         console.log("Preparando envio de FormData. Método:", metodo, "URL:", url, window.StaffOriginal);
//         console.log("Dados do FormData:", {
//             nmFuncionario, descFuncao, vlrCusto, extra, transporte, almoco, jantar, caixinha,
//             nmCliente, nmEvento, periodoDoEvento, vlrTotal
//         });

//         console.log("METODO PARA ENVIAR",metodo, currentEditingStaffEvent);

//             // 🎯 LOG DO FORMDATA ANTES DO ENVIO 🎯
//         console.log("Preparando envio de FormData. Método:", metodo, "URL:", url);
//         console.log("Dados do FormData sendo enviados:");

//         for (let pair of formData.entries()) {
//             console.log(pair[0]+ ': ' + pair[1]); 
//         }


//         if (metodo === "PUT") {
//             if (!isEditingInitial) { // Use isEditing aqui também para ser consistente
//                 console.log("Erro: Dados originais não encontrados para PUT");
//                 return Swal.fire("Erro", "Dados originais não encontrados para comparação (ID ausente para PUT).", "error");
//             }

//             // Valores originais dos checkboxes (considera ativo se valor numérico > 0)
//             const extraAtivoOriginal = parseFloat(currentEditingStaffEvent.vlrextra || 0) > 0;
//             const caixinhaAtivoOriginal = parseFloat(currentEditingStaffEvent.vlrcaixinha || 0) > 0;
//             const extraValorOriginal = parseFloat(currentEditingStaffEvent.vlrextra || 0);
//             const caixinhaValorOriginal = parseFloat(currentEditingStaffEvent.vlrcaixinha || 0);

//             console.log("Valores originais - Extra Ativo:", extraAtivoOriginal, "Extra Valor:", extraValorOriginal);
//             console.log("Valores originais - Caixinha Ativo:", caixinhaAtivoOriginal, "Caixinha Valor:", caixinhaValorOriginal);

//             // Valores atuais (checkboxes e inputs)
//             const extraAtivoAtual = extraAtivo;
//             const caixinhaAtivoAtual = caixinhaAtivo;
//             const extraValorAtual = parseFloat(extra.replace(',', '.') || 0);
//             const caixinhaValorAtual = parseFloat(caixinha.replace(',', '.') || 0);

//             console.log("Valores atuais - Extra Ativo:", extraAtivoAtual, "Extra Valor:", extraValorAtual);
//             console.log("Valores atuais - Caixinha Ativo:", caixinhaAtivoAtual, "Caixinha Valor:", caixinhaValorAtual);

//             // Detecta alterações em estado ou valor
//             const houveAlteracaoExtra = (extraAtivoOriginal !== extraAtivoAtual) || (extraValorOriginal !== extraValorAtual);
//             const houveAlteracaoCaixinha = (caixinhaAtivoOriginal !== caixinhaAtivoAtual) || (caixinhaValorOriginal !== caixinhaValorAtual);

//             console.log("Houve alteração Extra?", houveAlteracaoExtra);
//             console.log("Houve alteração Caixinha?", houveAlteracaoCaixinha);

//             // Se houve alteração ativando extra ou caixinha, obrigar preenchimento de descBeneficio
//             if (houveAlteracaoCaixinha && caixinhaAtivoAtual) {            
//                 console.log("Extra ou Caixinha ativado e houve alteração, verificando descBeneficio...");
//                 if (!descBeneficio || descBeneficio.length < 20) {
//                     console.log("descBeneficio inválido - bloqueando salvamento");
//                     if (descBeneficioInput) descBeneficioInput.focus();
//                     return Swal.fire(
//                         "Campos obrigatórios!",
//                         "A descrição do benefício (Caixinha) deve ter no mínimo 20 caracteres para salvar.",
//                         "warning"
//                     );
//                 } else {
//                     console.log("descBeneficio preenchido corretamente");
//                 }
//             } else {
//                 console.log("Nenhuma alteração relevante em Caixinha que obrigue descBeneficio");
//             }

//             if (houveAlteracaoExtra && extraAtivoAtual) {
//                 console.log("Extra ou Caixinha ativado e houve alteração, verificando descBonus...");
//                 if (!descBonus || descBonus.length < 20) {
//                     console.log("descBonus inválido - bloqueando salvamento");
//                     if (descBonus) descBonusInput.focus();
//                     return Swal.fire(
//                         "Campos obrigatórios!",
//                         "A descrição do Bônus deve ter no mínimo 20 caracteres para salvar.",
//                         "warning"
//                     );
//                 } else {
//                     console.log("descBonus preenchido corretamente");
//                 }
//             } else {
//                 console.log("Nenhuma alteração relevante em Bônusque obrigue descBonus");
//             }

//             formData.append('idstaff', currentEditingStaffEvent.idstaff || '');
//             formData.append('idstaffevento', currentEditingStaffEvent.idstaffevento);

//             let houveAlteracao = false;
//             if (
//                 currentEditingStaffEvent.idfuncionario != idFuncionario ||
//                 currentEditingStaffEvent.nmfuncao.toUpperCase() != descFuncao ||
//                 parseFloat(currentEditingStaffEvent.vlrcache || 0) != parseFloat(vlrCusto.replace(',', '.') || 0) ||
//                 JSON.stringify(currentEditingStaffEvent.periodo || []) !== JSON.stringify(periodoDoEvento) ||
//                 parseFloat(currentEditingStaffEvent.vlrextra || 0) != extraValorAtual ||
//                 parseFloat(currentEditingStaffEvent.vlrtransporte || 0) != parseFloat(transporte.replace(',', '.') || 0) ||
//                 parseFloat(currentEditingStaffEvent.vlralmoco || 0) != parseFloat(almoco.replace(',', '.') || 0) ||
//                 parseFloat(currentEditingStaffEvent.vlrjantar || 0) != parseFloat(jantar.replace(',', '.') || 0) ||
//                 // (currentEditingStaffEvent.vlralmoco === 1 ? '1' : '0') != almoco ||
//                 // (currentEditingStaffEvent.vlrjantar === 1 ? '1' : '0') != jantar ||
//                 parseFloat(currentEditingStaffEvent.vlrcaixinha || 0) != caixinhaValorAtual ||
//                 (currentEditingStaffEvent.descbonus || '').trim() != descBonus.trim() ||
//                 (currentEditingStaffEvent.descbeneficios || '').trim() != descBeneficio.trim() ||
//                 (currentEditingStaffEvent.setor || '').trim() != setor.trim() ||
//                 currentEditingStaffEvent.idcliente != idCliente ||
//                 currentEditingStaffEvent.idevento != idEvento ||
//                 currentEditingStaffEvent.idmontagem != idMontagem ||
//                 (currentEditingStaffEvent.pavilhao || '').toUpperCase().trim() != pavilhao ||
//                 (currentEditingStaffEvent.statuspgto || '').trim() != statusPgto.trim()
//             ) {
//                 houveAlteracao = true;
//             }            

//             const logAndCheck = (fieldName, originalValue, currentValue, condition) => {
//             const isDifferent = condition;
//                 console.log(`[COMPARACAO] ${fieldName}: Original = '${originalValue}' | Atual = '${currentValue}' | Diferente = ${isDifferent}`);
//                 return isDifferent;
//             };
//             houveAlteracao =
//                 logAndCheck('ID Funcionário', currentEditingStaffEvent.idfuncionario, idFuncionario, currentEditingStaffEvent.idfuncionario != idFuncionario) ||
//                 logAndCheck('Função', currentEditingStaffEvent.nmfuncao.toUpperCase(), descFuncao, currentEditingStaffEvent.nmfuncao.toUpperCase() != descFuncao) ||
//                 logAndCheck('Valor Cache', parseFloat(currentEditingStaffEvent.vlrcache || 0), parseFloat(vlrCusto.replace(',', '.') || 0), parseFloat(currentEditingStaffEvent.vlrcache || 0) != parseFloat(vlrCusto.replace(',', '.') || 0)) ||
//                 logAndCheck('Datas Evento', JSON.stringify(currentEditingStaffEvent.datasevento || []), JSON.stringify(periodoDoEvento), JSON.stringify(currentEditingStaffEvent.datasevento || []) !== JSON.stringify(periodoDoEvento)) || // Use datasevento
//                 logAndCheck('Valor Extra', parseFloat(currentEditingStaffEvent.vlrextra || 0), extraValorAtual, parseFloat(currentEditingStaffEvent.vlrextra || 0) != extraValorAtual) ||
//                 logAndCheck('Valor Transporte', parseFloat(currentEditingStaffEvent.vlrtransporte || 0), parseFloat(almoco.replace(',', '.') || 0), parseFloat(currentEditingStaffEvent.vlrtransporte || 0) != parseFloat(transporte.replace(',', '.') || 0)) ||
//                 logAndCheck('Valor Almoço', parseFloat(currentEditingStaffEvent.vlralmoco || 0), parseFloat(transporte.replace(',', '.') || 0), parseFloat(currentEditingStaffEvent.vlralmoco || 0) != parseFloat(almoco.replace(',', '.') || 0)) ||
//                 logAndCheck('Valor Jantar', parseFloat(currentEditingStaffEvent.vlrjantar || 0), parseFloat(jantar.replace(',', '.') || 0), parseFloat(currentEditingStaffEvent.vlrjantar || 0) != parseFloat(jantar.replace(',', '.') || 0)) ||
//                 logAndCheck('Valor Caixinha', parseFloat(currentEditingStaffEvent.vlrcaixinha || 0), caixinhaValorAtual, parseFloat(currentEditingStaffEvent.vlrcaixinha || 0) != caixinhaValorAtual) ||
//                 logAndCheck('Descrição Bônus', (currentEditingStaffEvent.descbonus || '').trim(), descBonus.trim(), (currentEditingStaffEvent.descbonus || '').trim() != descBonus.trim()) ||
//                 logAndCheck('Descrição Benefícios', (currentEditingStaffEvent.descbeneficios || '').trim(), descBeneficio.trim(), (currentEditingStaffEvent.descbeneficios || '').trim() != descBeneficio.trim()) ||
//                 logAndCheck('Setor', (currentEditingStaffEvent.setor || '').trim(), setor.trim(), (currentEditingStaffEvent.setor || '').trim() != setor.trim()) ||
//                 logAndCheck('StatusPgto', (currentEditingStaffEvent.statuspgto || '').trim(), statusPgto.trim(), (currentEditingStaffEvent.statuspgto || '').trim() != statusPgto.trim()) ||
//                 logAndCheck('ID Cliente', currentEditingStaffEvent.idcliente, idCliente, currentEditingStaffEvent.idcliente != idCliente) ||
//                 logAndCheck('ID Evento', currentEditingStaffEvent.idevento, idEvento, currentEditingStaffEvent.idevento != idEvento) ||
//                 logAndCheck('ID Montagem', currentEditingStaffEvent.idmontagem, idMontagem, currentEditingStaffEvent.idmontagem != idMontagem) ||
//                 logAndCheck('Pavilhão', (currentEditingStaffEvent.pavilhao || '').toUpperCase().trim(), pavilhao.toUpperCase().trim(), (currentEditingStaffEvent.pavilhao || '').toUpperCase().trim() != pavilhao.toUpperCase().trim()) ||
//                 // logAndCheck('Comprovante Cache', currentEditingStaffEvent.comppgtocache, comppgtocacheDoForm, currentEditingStaffEvent.comppgtocache !== comppgtocacheDoForm) ||
//                 // logAndCheck('Comprovante Ajuda Custo', currentEditingStaffEvent.comppgtoajdcusto, comppgtoajdcustoDoForm, currentEditingStaffEvent.comppgtoajdcusto !== comppgtoajdcustoDoForm) ||
//                 // logAndCheck('Comprovante Extras', currentEditingStaffEvent.comppgtocaixinha, comppgtocaixinhaDoForm, currentEditingStaffEvent.comppgtocaixinha !== comppgtocaixinhaDoForm) ||

//                 logAndCheck(
//                     'Comprovante Cache',
//                     normalizeEmptyValue(currentEditingStaffEvent.comppgtocache), // Valor original normalizado
//                     normalizeEmptyValue(comppgtocacheDoForm),                 // Valor do formulário normalizado
//                     normalizeEmptyValue(currentEditingStaffEvent.comppgtocache) !== normalizeEmptyValue(comppgtocacheDoForm) // Comparação normalizada
//                 ) ||
//                 logAndCheck(
//                     'Comprovante Ajuda Custo',
//                     normalizeEmptyValue(currentEditingStaffEvent.comppgtoajdcusto),
//                     normalizeEmptyValue(comppgtoajdcustoDoForm),
//                     normalizeEmptyValue(currentEditingStaffEvent.comppgtoajdcusto) !== normalizeEmptyValue(comppgtoajdcustoDoForm)
//                 ) ||
//                 logAndCheck(
//                     'Comprovante Extras',
//                     normalizeEmptyValue(currentEditingStaffEvent.comppgtocaixinha),
//                     normalizeEmptyValue(comppgtocaixinhaDoForm),
//                     normalizeEmptyValue(currentEditingStaffEvent.comppgtocaixinha) !== normalizeEmptyValue(comppgtocaixinhaDoForm)
//                 );

//             console.log("Houve alteração geral?", houveAlteracao);

//             if (!houveAlteracao) {
//                 console.log("Nenhuma alteração detectada, bloqueando salvamento.");
//                 return Swal.fire("Nenhuma alteração detectada", "Faça alguma alteração antes de salvar.", "info");
//             }

//             const { isConfirmed } = await Swal.fire({
//                 title: "Deseja salvar as alterações?",
//                 text: "Você está prestes a atualizar os dados do staff.",
//                 icon: "question",
//                 showCancelButton: true,
//                 confirmButtonText: "Sim, salvar",
//                 cancelButtonText: "Cancelar",
//                 reverseButtons: true,
//                 focusCancel: true
//             });

//             if (!isConfirmed) {
//                 console.log("Alteração cancelada pelo usuário");
//                 return;
//             }
//         }

//         // --- EXECUTA O FETCH PARA POST OU PUT ---
//         try {
//             console.log("ENTRANDO NO TRY. Método:", metodo);

//             const respostaApi = await fetchComToken(url, {
//                 method: metodo,
  
//                 body: formData,
//             });

//             await Swal.fire("Sucesso!", respostaApi.message || "Staff salvo com sucesso.", "success");
                      

//             await carregarTabelaStaff(idFuncionario);

//              window.StaffOriginal = null;
//              limparCamposStaff();

//         } catch (error) {
//             console.error("❌ Erro ao enviar dados do funcionário:", error);
//             Swal.fire("Erro", error.message || "Erro ao salvar funcionário.", "error");
//         }
//     };    

//     const onCriteriosChanged = () => {
//         console.log("ENTROU NO ONCRITEIOSCHANGED handleFormSubmit");
//     const idEvento = nmEventoSelect.value;
//     const idCliente = nmClienteSelect.value;
//     const idLocalMontagem = nmLocalMontagemSelect.value;
//     const idPavilhao = nmPavilhaoSelect.value;

//     // Verifique se os IDs essenciais estão preenchidos antes de buscar
//     if (idEvento && idCliente) {
//         buscarEPopularOrcamento(idEvento, idCliente, idLocalMontagem, idPavilhao);
//     }
// };

// 
async function buscarEPopularOrcamento(idEvento, idCliente, idLocalMontagem, setorParaBusca, datasEvento) {
    try {
        console.log("Buscando orçamento com os seguintes IDs:", { idEvento, idCliente, idLocalMontagem, setorParaBusca });

        const criteriosDeBusca = {
            idEvento,
            idCliente,
            idLocalMontagem,
            setor: setorParaBusca,
            datasEvento: datasEvento || [],
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

function desinicializarStaffModal() {
    console.log("🧹 Desinicializando módulo Staff.js...");

    const selectAvaliacao = document.querySelector("#avaliacao");
    const botaoLimpar = document.querySelector("#Limpar");
    const botaoEnviar = document.querySelector("#Enviar");
    const datasEventoInput = document.querySelector("#datasEvento");
    const selectFuncionario = document.querySelector("#nmFuncionario");
    const selectFuncao = document.querySelector("#descFuncao");
    const selectCliente = document.querySelector("#nmCliente");
    const selectEvento = document.querySelector("#nmEvento");
    const selectLocalMontagem = document.querySelector("#nmLocalMontagem");
    const selectPavilhao = document.querySelector("#nmPavilhao"); // Pode não existir se não carregado
    const Caixinhacheck = document.querySelector("#Caixinhacheck");
    const Extracheck = document.querySelector("#Extracheck");
    const vlrCustoInput = document.querySelector("#vlrCusto");
    const extraInput = document.querySelector("#extra");
    const transporteInput = document.querySelector("#transporte");
    const almocoInput = document.querySelector("#almoco");
    const jantarInput = document.querySelector("#jantar");
    const caixinhaInput = document.querySelector("#caixinha");
    const fileCacheInput = document.getElementById('fileCache');
    const fileAjdCustoInput = document.getElementById('fileAjdCusto');
    const fileCaixinhaInput = document.getElementById('fileCaixinha');


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
    if (Extracheck && ExtracheckListener) {
        Extracheck.removeEventListener("change", ExtracheckListener);
        ExtracheckListener = null;
    }

    // Remover listeners dos campos de valor
    if (vlrCustoInput && vlrCustoInputListener) {
        vlrCustoInput.removeEventListener("input", vlrCustoInputListener);
        vlrCustoInputListener = null;
    }
    if (extraInput && extraInputListener) {
        extraInput.removeEventListener("input", extraInputListener);
        extraInputListener = null;
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

//essa verificacao não inclui funcao e não permite cadastras mesma data
// async function verificarDisponibilidadeStaff(idFuncionario, datasAgendamento, idEventoIgnorar = null) {
//     try {
//         const data = await fetchComToken(`/staff/check-availability`, { // Certifique-se que o endpoint é este
//             method: 'POST',
//             headers: {
//                 'Content-Type': 'application/json'
//             },
//             body: JSON.stringify({
//                 idfuncionario: idFuncionario,
//                 datas: datasAgendamento.map(d => d.toISOString().split('T')[0]), // Garante formato YYYY-MM-DD
//                 idEventoIgnorar: idEventoIgnorar // <--- ISSO É CRUCIAL PARA O BACKEND
//             })
//         });
        
//         return data; // Deve conter { isAvailable: boolean, conflictingEvent: {...} }
//     } catch (error) {
//         console.error("Erro na API de verificação de disponibilidade:", error);
//         Swal.fire("Erro na Verificação", "Não foi possível verificar a disponibilidade do funcionário.", "error");
//         return { isAvailable: false, conflictingEvent: null };
//     }
// }

async function verificarDisponibilidadeStaff(idFuncionario, datasAgendamento, idFuncao, idEventoIgnorar = null) {
    try {
        const data = await fetchComToken(`/staff/check-availability`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                idfuncionario: idFuncionario,
                datas: datasAgendamento.map(d => d.toISOString().split('T')[0]),
                idfuncao: idFuncao, // AQUI: Passamos o ID da função
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


function inicializarFlatpickrsGlobais() {
console.log("Inicializando Flatpickr para todos os campos de data (globais)...");
    const dateInputIds = [
        'datasEvento'
    ];

    dateInputIds.forEach(id => { // Este é o loop correto
        const element = document.getElementById(id);
        if (element) { // Verificamos se o elemento existe
            // **IMPORTANTE**: Só inicialize se já não foi inicializado
            if (!element._flatpickr) { 
                const picker = flatpickr(element, commonFlatpickrOptions);
                // **CRUCIAL**: Salve a instância no objeto global 'flatpickrInstances'
                window.flatpickrInstances[id] = picker; 
                console.log(`Flatpickr inicializado e salvo para campo global #${id}`);
            } else {
                console.log(`Flatpickr para campo global #${id} já estava inicializado.`);
                // Se já estava inicializado, podemos simplesmente garantir que a instância está salva
                window.flatpickrInstances[id] = element._flatpickr; 
            }
        } else {
            console.warn(`Elemento com ID '${id}' não encontrado para inicialização do Flatpickr.`);
        }
    });
}




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

        try {
            //await carregarStaffDescricao(desc, this);
           // carregarTabelaStaff();
            console.log("Staff selecionada depois de carregarStaffDescricao:", this.value);
        } catch (error) {
            console.error("Erro ao buscar Staff:", error);
        }
    });
}

async function carregarStaffDescricao(desc, elementoAtual) {

    console.log("carregou a descrição staff");
    try {
        const response = await fetchComToken(`/staff?descStaff=${encodeURIComponent(desc)}`);
        if (!response.ok) throw new Error();
        
        const staff = await response.json();
        document.querySelector("#idStaff").value = staff.idstaff;
        document.querySelector("#nmFuncionario").value = staff.nmFuncionario;
        document.querySelector("#descFuncao").value = staff.descFuncao;
        document.querySelector("#vlrCusto").value = staff.vlrcusto;
        document.querySelector("#vlrBeneficio").value = staff.vlrbeneficio;
        document.querySelector("#descBeneficio").value = staff.descbeneficio;
        document.querySelector("#nmCliente").value = staff.nmcliente;
        document.querySelector("#nmEvento").value = staff.nmevento;
        document.querySelector("#avaliacao").value = staff.avaliacao;

        console.log("CARREGA AVALIACAO", staff.avaliacao);

        document.querySelector("#vlrTotal").value = staff.vlrtotal;
        
        window.StaffOriginal = {
            idStaff: staff.idstaff,
            avaliacao: staff.avaliacao,
            idFuncionario: staff.idfuncionario,
            nmFuncionario: staff.nmfuncionario,
            idFuncao: staff.idfuncao,
            descFuncao: staff.descfuncao,            
            vlrCusto: staff.vlrCusto,
            extra:staff.extra,
            transporte: staff.transporte,
            vlrBeneficio: staff.vlrbeneficio,
            descBeneficio: staff.descbeneficio,
            almoco: staff.almoco,
            jantar: staff.jantar,   
            caixinha: staff.caixinha,    
            idCliente: staff.idCliente,      
            nmCliente: staff.nmcliente,
            idEvento: staff.idevento,
            nmEvento: staff.nmevento,
            idLocalMontagem: staff.idlocalmontagem,
            nmLocalMontagem: staff.nmlocalmontagem,
            //datasEventos: staff.dataseventos,   
            bonus: staff.bonus,          
            nmPavilhao: staff.nmpavilhao,
            datasevento: Array.isArray(eventData.datasevento) ? eventData.datasevento :
                    (typeof eventData.datasevento === 'string' ? JSON.parse(eventData.datasevento) : []),
            vlrTotal: staff.vlrtotal,      
    
            // 📎 Comprovantes PDF (se vierem do banco ou API)
            comprovanteCache: staff.comprovantecache || "",
            comprovanteAjdCusto: staff.comprovanteajdcusto || "",
            comprovanteCaixinha: staff.comprovantecaixinha || "",
            setor: staff.setor || "",
            statusPgto: staff.statuspgto || ""
        };

    } catch (error) {
        
        const inputIdStaff = document.querySelector("#idStaff");
        const podeCadastrarStaff = temPermissao("Staff", "cadastrar");


       if (!inputIdStaff.value && podeCadastrarStaff) {
    
            const resultado = await Swal.fire({
                icon: 'question',
                title: `Deseja cadastrar "${desc.toUpperCase()}" como Staff?`,
                text: `Staff "${desc.toUpperCase()}" não encontrado`,
                showCancelButton: true,
                confirmButtonText: "Sim, cadastrar",
                cancelButtonText: "Cancelar",
                reverseButtons: true,
                focusCancel: true
            });

                console.log("Resultado do Swal:", resultado);
            if (!resultado.isConfirmed) {
                console.log("Usuário cancelou o cadastro do Staff.");
                //elementoAtual.value = ""; // Limpa o campo se não for cadastrar
                limparCamposStaff();
                setTimeout(() => {
                    elementoAtual.focus();
                }, 0);
                return;
            }
        
        }else if (!podeCadastrarStaff) {
            Swal.fire({
                icon: "info",
                title: "Staff não cadastrada",
                text: "Você não tem permissão para cadastrar Staff.",
                confirmButtonText: "OK"
            });
        }
        
    }
}



function limparStaffOriginal() {
    window.StaffOriginal = {
        idStaff: "",
        avaliacao: "",
        idFuncionario: "",
        nmFuncionario: "",
        descFuncao: "",
        vlrCusto: "",
        extra: "",
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
        bonus: "",
        vlrTotal: "",
        nmPavilhao: "",

        // 📎 Comprovantes PDF
        comprovanteCache: "",
        comprovanteAjdCusto: "",
        comprovanteCaixinha: "",
        setor: "",
        statusPgto
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
        console.log("ENTROU NO CARREGARFUNCAOORC", funcaofetch);
        
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
                option.setAttribute("data-cto", funcao.ctofuncao);
                option.setAttribute("data-vda", funcao.vdafuncao);
                // option.setAttribute("data-transporte", funcao.transporte);   
                option.setAttribute("data-almoco", funcao.almoco || 0); // Certifique-se de que almoco/jantar estão aqui
                option.setAttribute("data-jantar", funcao.jantar || 0);
                option.setAttribute("data-transporte", funcao.transporte || 0);     
                option.setAttribute("data-categoria", "Produto(s)");
                select.appendChild(option);
            });
            
            select.addEventListener("change", function (event) {    
              

                const selectedOption = this.options[this.selectedIndex];

                document.getElementById("idFuncao").value = selectedOption.getAttribute("data-idFuncao");
              //  document.getElementById("nmFuncao").value = selectedOption.getAttribute("data-nmFuncao");

                document.getElementById("vlrCusto").value = selectedOption.getAttribute("data-cto"); 
                document.getElementById("almoco").value = selectedOption.getAttribute("data-almoco");  
                document.getElementById("jantar").value = selectedOption.getAttribute("data-jantar");
                document.getElementById("transporte").value = selectedOption.getAttribute("data-transporte");    
              
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

async function carregarDadosPavilhao(idMontagem) { // Renomeada para corresponder ao seu código
        if (!nmPavilhaoSelect) return;

        nmPavilhaoSelect.innerHTML = '<option value="">Carregando Pavilhões...</option>'; // Mensagem de carregamento

        if (!idMontagem) {
            nmPavilhaoSelect.innerHTML = '<option value="">Selecione Pavilhão</option>';
            return;
        }

        try {
            const pavilhaoData = await fetchComToken(`/staff/pavilhao?idmontagem=${idMontagem}`); // Ajuste a URL se necessário
            console.log(`Dados de Pavilhões recebidos para ${idMontagem}:`, pavilhaoData); // Log para depuração

            nmPavilhaoSelect.innerHTML = '<option value="">Selecione Pavilhão</option>'; // Limpa e adiciona opção padrão
            pavilhaoData.forEach(localpav => {
                const option = document.createElement('option');
                option.value = localpav.idpavilhao;  // O valor da opção é o ID
                option.textContent = localpav.nmpavilhao; // O texto visível é o nome
                option.setAttribute("data-idPavilhao", localpav.idpavilhao); 
                option.setAttribute("data-nmPavilhao", localpav.nmpavilhao); // Corrigido typo
                nmPavilhaoSelect.appendChild(option);
                console.log(`Adicionada opção: value="${option.value}", text="${option.textContent}"`); // Log de depuração
            });
            console.log(`Pavilhões carregados e populados para Local de Montagem ${idMontagem}.`);
        } catch (error) {
            console.error("Erro ao carregar pavilhao:", error);
            nmPavilhaoSelect.innerHTML = '<option value="">Erro ao carregar Pavilhões</option>';
        }
}

function limparCamposEvento() {
    console.log("Limpeza parcial do formulário iniciada (apenas campos do evento).");
    
    // Lista de campos que se referem a um evento específico
    const camposEvento = [
        "idStaff", "descFuncao", "vlrCusto", "extra", "transporte", "almoco", "jantar", "caixinha",
        "nmLocalMontagem", "nmPavilhao", "descBeneficio", "descBonus",
        "nmCliente", "nmEvento", "vlrTotal", "vlrTotalHidden", 
        "idFuncao", "idMontagem", "idPavilhao", "idCliente", "idEvento", "statusPgto"
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
    
    // Limpa os campos de comprovantes
    limparCamposComprovantes();

    // Resetar campos opcionais
    const extraCheck = document.getElementById('Extracheck');
    if (extraCheck) extraCheck.checked = false;
    const caixinhaCheck = document.getElementById('Caixinhacheck');
    if (caixinhaCheck) caixinhaCheck.checked = false;
    
    // Limpa as descrições de bônus e benefícios
    document.getElementById('bonus').value = '';
    document.getElementById('descBeneficio').value = '';

    // Garanta que os containers opcionais sejam ocultados
    document.getElementById('campoExtra').style.display = 'none';
    document.getElementById('campoCaixinha').style.display = 'none';

    // Limpa o objeto em memória do staff original
    limparStaffOriginal();

    console.log("Limpeza parcial do formulário concluída.");
}

function limparCamposStaff() {
    const campos = [
        "idStaff", "nmFuncionario", "apelidoFuncionario", "linkFotoFuncionarios", "descFuncao", "vlrCusto",
        "nmLocalMontagem", "nmPavilhao", "almoco", "jantar", "transporte", "vlrBeneficio", "descBeneficio",
        "nmCliente", "nmEvento", "vlrTotal", "vlrTotalHidden", "idFuncionario", "idFuncao", "idMontagem",
        "idPavilhao", "idCliente", "idEvento", "statusPgto"
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
    const extraCheck = document.getElementById('Extracheck');
    const campoExtra = document.getElementById('campoExtra');
    const caixinhaCheck = document.getElementById('Caixinhacheck');
    const campoCaixinha = document.getElementById('campoCaixinha');

    if (extraCheck) {
        extraCheck.checked = false;
        if (campoExtra) campoExtra.style.display = 'none';
        const inputExtra = document.getElementById('extra');
        if (inputExtra) inputExtra.value = '';

        const bonusTextarea = document.getElementById('bonus');
        if (bonusTextarea) {
            bonusTextarea.style.display = 'none'; // Oculta o textarea
            bonusTextarea.required = false;      // Remove a obrigatoriedade
            bonusTextarea.value = '';            // Limpa o conteúdo
        }
    }
    if (caixinhaCheck) {
        caixinhaCheck.checked = false;
        if (campoCaixinha) campoCaixinha.style.display = 'none';
        const inputCaixinha = document.getElementById('caixinha');
        if (inputCaixinha) inputCaixinha.value = '';
    }

    const beneficioTextarea = document.getElementById('descBeneficio');
    if (beneficioTextarea) {
        beneficioTextarea.style.display = 'none'; // Oculta o textarea
        beneficioTextarea.required = false;      // Remove a obrigatoriedade
        beneficioTextarea.value = '';            // Limpa o conteúdo
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

document.getElementById('Extracheck').addEventListener('change', function () {
  const campo = document.getElementById('campoExtra');
  const input = document.getElementById('extra');

  if (this.checked) {
    campo.style.display = 'block';
    input.required = true;
    input.style.width = '100%'; // aplica largura total
  } else {
    campo.style.display = 'none';
    input.value = '';
    input.required = false;
  }

  calcularValorTotal();
});

document.getElementById('Caixinhacheck').addEventListener('change', function () {
  const campo = document.getElementById('campoCaixinha');
  const input = document.getElementById('caixinha');

  if (this.checked) {
    campo.style.display = 'block';
    input.required = true;
    input.style.width = '170px'; // aplica largura total
  } else {
    campo.style.display = 'none';
    input.value = '';
    input.required = false;
  }

  calcularValorTotal();
});

function calcularValorTotal() {
    console.log("CalcularValorTotal", retornoDados);

    const cache = parseFloat(document.getElementById('vlrCusto').value.replace(',', '.')) || 0;
    const extra = parseFloat(document.getElementById('extra').value.replace(',', '.')) || 0;
    const transporte = parseFloat(document.getElementById('transporte').value.replace(',', '.')) || 0;
    const almoco = parseFloat(document.getElementById('almoco').value.replace(',', '.')) || 0;
    const jantar = parseFloat(document.getElementById('jantar').value.replace(',', '.')) || 0;
    const caixinha = parseFloat(document.getElementById('caixinha').value.replace(',', '.')) || 0;

    const contadorTexto = document.getElementById('contadorDatas').innerText;
    const match = contadorTexto.match(/\d+/);
    const numeroDias = match ? parseInt(match[0]) : 0;

    const soma = cache + transporte + almoco + jantar ;
    const total = (soma * numeroDias) + extra + caixinha;

    const valorFormatado = 'R$ ' + total.toFixed(2).replace('.', ',');
    const valorLimpo = total.toFixed(2);

    document.getElementById('vlrTotal').value = valorFormatado;
    document.getElementById('vlrTotalHidden').value = valorLimpo;

    console.log(`Cálculo: (${cache} + ${extra} + ${transporte} + ${almoco} + ${jantar} + ${caixinha}) * ${numeroDias} = ${valorFormatado}`);
}

  // Adiciona listeners de input para os campos que impactam no cálculo
  ['vlrCusto', 'extra', 'transporte', 'almoco', 'jantar', 'caixinha'].forEach(function(id) {
    const el = document.getElementById(id);
    if(el) el.addEventListener('input', calcularValorTotal);
  });

  // Cria um observer para o contadorDatas para recalcular quando mudar texto
  const contadorDatasEl = document.getElementById('contadorDatas');
  if (contadorDatasEl) {
    const observer = new MutationObserver(calcularValorTotal);
    observer.observe(contadorDatasEl, { childList: true, characterData: true, subtree: true });
  }

  // Pode chamar a função na inicialização para garantir valor correto
  calcularValorTotal();



console.log("Ainda não Entrou no Previewpdf");

// function configurarPreviewPDF() {
//   const inputs = document.querySelectorAll('.filePDFInput');
//   inputs.forEach(function(input) {
//     input.addEventListener('change', function() {
//       const container = this.closest('.containerPDF');
//       const fileNamePDF = container.querySelector('.fileNamePDF');
//       const hiddenPDF = container.querySelector('.hiddenPDF');
//       const file = this.files[0];

//       if (!file || file.type !== 'application/pdf') {
//         if (fileNamePDF) fileNamePDF.textContent = 'Nenhum arquivo selecionado';
//         if (hiddenPDF) hiddenPDF.value = '';
//         return;
//       }

//       const reader = new FileReader();
//       reader.onload = function(e) {
//         if (fileNamePDF) fileNamePDF.textContent = file.name;
//         if (hiddenPDF) hiddenPDF.value = e.target.result;
//         console.log("Arquivo PDF carregado:", file.name);
//       };
//       reader.readAsDataURL(file);
//     });
//   });
// }

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

// function setupComprovanteUpload(fileInputId, fileNameDisplayId, previewImgId, pdfPreviewDivId, pdfLinkId, imagePreviewDivId, linkImageId) {
//     const fileInput = document.getElementById(fileInputId);
//     const fileNameDisplay = document.getElementById(fileNameDisplayId);
//     const previewImg = document.getElementById(previewImgId); // A tag <img> que será sempre oculta
//     const pdfPreviewDiv = document.getElementById(pdfPreviewDivId);
//     const pdfLink = document.getElementById(pdfLinkId);
//     const imagePreviewDiv = document.getElementById(imagePreviewDivId); // Div do botão de imagem
//     const linkImage = document.getElementById(linkImageId); // Link do botão de imagem

//     // Verificação de elementos (importante para depuração)
//     if (!fileInput || !fileNameDisplay || !previewImg || !pdfPreviewDiv || !pdfLink || !imagePreviewDiv || !linkImage) {
//         console.warn(`[SETUP ERROR] Elementos não encontrados para o setup: Input=${fileInputId}, Nome=${fileNameDisplayId}, Img=${previewImgId}, PDFDiv=${pdfPreviewDivId}, PDFLink=${pdfLinkId}, ImgDiv=${imagePreviewDivId}, ImgLink=${linkImageId}`);
//         return;
//     }
//     console.log(`[SETUP SUCESSO] Todos os elementos encontrados para ${fileInputId}.`);

//     fileInput.addEventListener('change', function(event) {
//         console.log(`[EVENTO CHANGE] Evento 'change' disparado para ${fileInputId}.`);
//         const file = event.target.files[0];

//         console.log(`[EVENTO CHANGE] Objeto 'file' capturado:`, file);

//         // Esconde TODOS os previews por padrão ao selecionar um novo arquivo
//         previewImg.style.display = 'none'; // A tag <img> sempre oculta
//         pdfPreviewDiv.style.display = 'none';
//         pdfLink.href = '#';
//         imagePreviewDiv.style.display = 'none'; // Esconde o botão de imagem
//         linkImage.href = '#'; // Limpa o href do link da imagem

//         if (file) {
//             fileNameDisplay.textContent = `Arquivo selecionado: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`;
//             console.log(`[PROCESSANDO ARQUIVO] Arquivo selecionado: ${file.name}, Tipo: ${file.type}`);

//             const reader = new FileReader();

//             reader.onload = function(e) {
//                 const dataUrl = e.target.result;

//                 const isImage = file.type.startsWith('image/');
//                 const isPdf = file.type === 'application/pdf';

//                 console.log(`[PREVIEW LOGIC] Tipo MIME detectado: ${file.type}. É Imagem? ${isImage}. É PDF? ${isPdf}.`);

//                 if (isImage) {
//                     linkImage.href = dataUrl; // Define o Data URL como href para o botão de imagem
//                     imagePreviewDiv.style.display = 'block'; // Exibe o div do botão de imagem
//                     console.log(`[PREVIEW IMAGE] Exibindo botão de prévia de imagem. href definido para: ${linkImage.href.substring(0, 50)}...`);
//                 } else if (isPdf) {
//                     pdfLink.href = dataUrl; // Define o Data URL como href para o botão de PDF
//                     pdfPreviewDiv.style.display = 'block'; // Exibe o div do botão de PDF
//                     console.log(`[PREVIEW PDF] Exibindo botão de PDF. href definido para: ${pdfLink.href.substring(0, 50)}...`);
//                 } else {
//                     console.warn(`[PREVIEW WARNING] Tipo de arquivo não suportado para pré-visualização: ${file.type}`);
//                 }
//                 console.log(`[FINALIZADO] Comprovante para ${fileInputId} selecionado e processado.`);
//             };

//             reader.onerror = function(error) {
//                 console.error(`[ERRO READER] Erro ao ler o arquivo para ${fileInputId}:`, error);
//                 fileNameDisplay.textContent = "Erro ao ler o arquivo.";
//                 previewImg.style.display = 'none';
//                 pdfPreviewDiv.style.display = 'none';
//                 pdfLink.href = '#';
//                 imagePreviewDiv.style.display = 'none';
//                 linkImage.href = '#';
//             };

//             reader.readAsDataURL(file);
//         } else {
//             fileNameDisplay.textContent = "Nenhum arquivo selecionado";
//             previewImg.style.display = 'none';
//             pdfPreviewDiv.style.display = 'none';
//             pdfLink.href = '#';
//             imagePreviewDiv.style.display = 'none';
//             linkImage.href = '#';
//             console.log(`[NENHUM ARQUIVO] Nenhum arquivo selecionado para ${fileInputId}.`);
//         }
//     });
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
        if (filePath.toLowerCase().match(/\.(jpeg|jpg|png|gif|webp|bmp|svg)$/i)) {
            linkHtml = `<a href="${filePath}" target="_blank" class="comprovante-salvo-link btn-success">Ver Imagem: ${fileName}</a>`;
        } else if (filePath.toLowerCase().endsWith('.pdf')) {
            linkHtml = `<a href="${filePath}" target="_blank" class="comprovante-salvo-link btn-info">Ver PDF: ${fileName}</a>`;
        }

        linkDisplayContainer.innerHTML = `
            ${linkHtml}
            <button type="button" class="btn btn-sm btn-danger remover-comprovante-btn" data-campo="${campoNome}">
                <i class="fas fa-trash"></i> Remover
            </button>
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
    preencherComprovanteCampo(null, 'Caixinha'); 
    
    const mainFileInput = document.getElementById('file');
    if (mainFileInput) {
        mainFileInput.value = '';
        const mainFileNameSpan = document.getElementById('fileName');
        const mainPreviewFoto = document.getElementById('previewFoto');
        const mainUploadHeader = document.getElementById('uploadHeader');

        if (mainFileNameSpan) mainFileNameSpan.textContent = "Nenhum arquivo selecionado";
        if (mainPreviewFoto) {
            mainPreviewFoto.src = "#";
            mainPreviewFoto.style.display = "none";
        }
        if (mainUploadHeader) mainUploadHeader.style.display = "block";
    }
}

function configurarEventosStaff() {
    console.log("Configurando eventos Staff...");
    verificaStaff(); // Carrega os Staff ao abrir o modal
    adicionarEventoBlurStaff();
    inicializarFlatpickrsGlobais();
    limparStaffOriginal()
    
    // Inicializa o estado dos campos extra/caixinha no carregamento
    const inputExtra = document.getElementById('extra');
    const extracheck = document.getElementById('Extracheck');
    const campoExtra = document.getElementById('campoExtra');
    if (extracheck && campoExtra && bonusTextarea) {
        extracheck.addEventListener('change', function() {
            campoExtra.style.display = this.checked ? 'block' : 'none';

            bonusTextarea.style.display = this.checked ? 'block' : 'none';
            bonusTextarea.required = this.checked;
            if (!this.checked) {
                if (inputExtra) inputExtra.value = ''; // Limpa o input 'extra' ao ocultar
                bonusTextarea.value = '';               // Limpa o textarea 'bonus' ao ocultar
            }

        });
        
        campoExtra.style.display = extracheck.checked ? 'block' : 'none';

        bonusTextarea.style.display = extracheck.checked ? 'block' : 'none';
        bonusTextarea.required = extracheck.checked;
        if (!extracheck.checked) {
            if (inputExtra) inputExtra.value = '';
            bonusTextarea.value = '';
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
