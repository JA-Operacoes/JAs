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
        setor: ""
    };
}

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
const nmClienteSelect = document.getElementById('nmCliente');
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

// Variável para armazenar os dados originais do registro em edição
let currentEditingStaffEvent = null;
let retornoDados = false;

const carregarDadosParaEditar = (eventData) => {
    console.log("CARREGARDADOSPRAEDITAR", retornoDados);
    retornoDados = true;
    // Armazena os dados originais para comparação em um PUT
    currentEditingStaffEvent = eventData;

    console.log("Carregando dados para edição:", eventData);

    console.log("Valor de eventData.comppgtocache:", eventData.comppgtocache);
    console.log("Valor de eventData.comppgtoajdcusto:", eventData.comppgtoajdcusto);
    console.log("Valor de eventData.comppgtoextras:", eventData.comppgtoextras);

    idStaffInput.value = eventData.idstaff || ''; // idstaff da tabela staffeventos
    console.log("IDSTAFFINPUT", idStaffInput.value);
    idFuncionarioHiddenInput.value = eventData.idfuncionario || ''; // idfuncionario do staffeventos
    // Preenche os campos do evento
    // Campos de SELECT:
    if (descFuncaoSelect) descFuncaoSelect.value = eventData.idfuncao || '';        
    if (nmClienteSelect) nmClienteSelect.value = eventData.idcliente || '';
    if (nmEventoSelect) nmEventoSelect.value = eventData.idevento || '';
    nmPavilhaoSelect.value = eventData.pavilhao || '';

    if (nmLocalMontagemSelect) {
        nmLocalMontagemSelect.value = eventData.idmontagem || '';              
            
        // Dispara o evento 'change' para que a lógica de carregamento dos pavilhões seja ativada
        // (Assumindo que o listener para nmLocalMontagemSelect.change chama carregarPavilhaoStaff)
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
    setorInput.value = eventData.setor || ''; // Setor do funcionário, se necessário

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

    preencherComprovanteCampo(eventData.comppgtocache, 'fileNameCache', 'previewCache', 'pdfPreviewCache', 'linkCache', 'imagePreviewCache', 'linkImageCache');
    preencherComprovanteCampo(eventData.comppgtoajdcusto, 'fileNameAjdCusto', 'previewAjdCusto', 'pdfPreviewAjdCusto', 'linkAjdCusto', 'imagePreviewAjdCusto', 'linkImageAjdCusto');
    preencherComprovanteCampo(eventData.comppgtoextras, 'fileNameCaixinha', 'previewCaixinha', 'pdfPreviewCaixinha', 'linkCaixinha', 'imagePreviewCaixinha', 'linkImageCaixinha');
    
};


const carregarTabelaStaff = async (funcionarioId) => {
        eventsTableBody.innerHTML = '';
        noResultsMessage.style.display = 'none';

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

                    document.getElementById("idStaff").value = eventData.idstaff;
                    document.getElementById("idEvento").value = eventData.idevento;
                    document.getElementById("idFuncao").value = eventData.idfuncao;
                    document.getElementById("idCliente").value = eventData.idcliente;
                    document.getElementById("avaliacao").value = eventData.avaliacao;
                    document.getElementById("setor").value = eventData.setor;

                    // preencherComprovanteCampo(eventData.comppgtocache, 'fileNameCache', 'ComprovanteCache');
                    // preencherComprovanteCampo(eventData.comppgtoajdcusto, 'fileNameAjdCusto', 'ComprovanteAjdCusto');
                    // preencherComprovanteCampo(eventData.comppgtoextras, 'fileNameCaixinha', 'ComprovanteCaixinha');

                    
                    if (avaliacaoSelect) {
                        // Converte a avaliação do DB para o valor do select (ex: "MUITO BOM" -> "muito_bom")
                        const avaliacaoValue = (eventData.avaliacao || '').toLowerCase().replace(' ', '_');
                        avaliacaoSelect.value = avaliacaoValue;
                        mostrarTarja(); // Atualiza a tarja visual
                    }
console.log('Valor de eventData.periodo antes de exibir:', eventData.datasevento);
                console.log('Tipo de eventData.periodo antes de exibir:', typeof eventData.datasevento);

                    const row = eventsTableBody.insertRow();                    
                    // Adiciona o listener de duplo clique à linha
                    row.addEventListener('dblclick', () => carregarDadosParaEditar(eventData));

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
                    // row.insertCell().textContent = (eventData.vlralmoco === 1 ? 'Sim' : 'Não');
                    // row.insertCell().textContent = (eventData.vlrjantar === 1 ? 'Sim' : 'Não');                    
                    row.insertCell().textContent = parseFloat(eventData.vlrtransporte || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                    // row.insertCell().textContent = (eventData.vlrcaixinha === 1 ? 'Sim' : 'Não');                    row.insertCell().textContent = parseFloat(eventData.vlrcaixinha || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                    row.insertCell().textContent = parseFloat(eventData.vlrcaixinha || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                    row.insertCell().textContent = eventData.descbeneficios || '';
                    row.insertCell().textContent = parseFloat(eventData.vlrtotal || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                    
                    
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




function toggleSectionVisibility(headerElement, contentClass, iconClassPrefix) {
    const sectionContent = headerElement.nextElementSibling; // O conteúdo é o próximo irmão do cabeçalho
    const toggleBtn = headerElement.querySelector('.toggle-arrow-btn');
    const icon = toggleBtn ? toggleBtn.querySelector('i') : null;

    if (!sectionContent || !sectionContent.classList.contains(contentClass)) {
        console.warn("Elemento de conteúdo não encontrado ou classe incorreta para o cabeçalho:", headerElement);
        return;
    }

    const isCollapsed = sectionContent.classList.contains('collapsed');

    if (isCollapsed) {
        sectionContent.classList.remove('collapsed');
        if (icon) {
            icon.classList.remove(`${iconClassPrefix}-down`);
            icon.classList.add(`${iconClassPrefix}-up`);
        }
    } else {
        sectionContent.classList.add('collapsed');
        if (icon) {
            icon.classList.remove(`${iconClassPrefix}-up`);
            icon.classList.add(`${iconClassPrefix}-down`);
        }
    }
    // console.log(`Seção ${isCollapsed ? 'expandida' : 'colapsada'}.`); // Para depuração
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

    const botaoEnviar = document.querySelector("#Enviar");
 //   const botaoPesquisar = document.querySelector("#Pesquisar");
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

    setupComprovanteUpload('fileCache', 'fileNameCache', 'fileCache');
    setupComprovanteUpload('fileAjdCusto', 'fileNameAjdCusto', 'fileAjdCusto');
    setupComprovanteUpload('fileCaixinha', 'fileNameCaixinha', 'fileCaixinha');

    botaoEnviar.addEventListener("click", async (event) => {
      event.preventDefault(); // Previne o envio padrão do formulário

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
        const pavilhao = selectPavilhao.options[selectPavilhao.selectedIndex]?.textContent.trim().toUpperCase() || '';
        const caixinhaAtivo = document.getElementById("Caixinhacheck")?.checked;
        const extraAtivo = document.getElementById("Extracheck")?.checked;
        const descBeneficioInput = document.getElementById("descBeneficio");
        const descBonusInput = document.getElementById("bonus");
        const descBonus = descBonusInput.value.trim() || "";
        const descBeneficio = descBeneficioInput?.value.trim() || "";
        const setor = document.querySelector("#setor").value; 
        
        const datasEventoRawValue = datasEventoInput.value.trim();
        const periodoDoEvento = getPeriodoDatas(datasEventoRawValue);

      
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


        if(!nmFuncionario || !descFuncao || !vlrCusto || !transporte || !almoco || !jantar || !nmCliente || !nmEvento || !periodoDoEvento){
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

        const isEditing = currentEditingStaffEvent && currentEditingStaffEvent.idstaffevento; // Verifica se o objeto existe E se tem um ID de evento válido
        const metodo = isEditing ? "PUT" : "POST";
        const url = isEditing ? `/staff/${currentEditingStaffEvent.idstaffevento}` : "/staff";

        if (!idStaff && !temPermissaoCadastrar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para cadastrar novas funções.", "error");
        }

        if (idStaff && !temPermissaoAlterar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para alterar funções.", "error");
        }

            console.log("Preparando dados para envio:", {
            nmFuncionario, descFuncao, nmLocalMontagem, nmCliente, nmEvento, vlrCusto, extra, transporte, almoco, jantar, caixinha,
            periodoDoEvento, vlrTotal
        });

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
        if (fileCacheInput.files && fileCacheInput.files[0]) {
            // Caso 1: O usuário selecionou um NOVO arquivo. Anexa o objeto File.
            formData.append('comppgtocache', fileCacheInput.files[0]);
        } else if (fileCacheInput.value === '') {
            // Caso 2: O usuário limpou explicitamente o campo (o input.value está vazio).
            // Envia uma string vazia para o backend para sinalizar a remoção.
            formData.append('comppgtocache', '');
        }
      
        // Comprovante de Ajuda de Custo
        const fileAjdCustoInput = document.getElementById('fileAjdCusto');
        if (fileAjdCustoInput.files && fileAjdCustoInput.files[0]) {
            formData.append('comppgtoajdcusto', fileAjdCustoInput.files[0]);
        } else if (fileAjdCustoInput.value === '') {
            formData.append('comppgtoajdcusto', '');
        }

        // Comprovante de Caixinha (Extras)
        const fileCaixinhaInput = document.getElementById('fileCaixinha');
        if (fileCaixinhaInput.files && fileCaixinhaInput.files[0]) {
            formData.append('comppgtoextras', fileCaixinhaInput.files[0]);
        } else if (fileCaixinhaInput.value === '') {
            formData.append('comppgtoextras', '');
        }
        
        formData.append('descbeneficios', beneficioTextarea.value.trim());

        formData.append('setor', setor);


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
            if (!isEditing) { // Use isEditing aqui também para ser consistente
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
                (currentEditingStaffEvent.vlralmoco === 1 ? '1' : '0') != almoco ||
                (currentEditingStaffEvent.vlrjantar === 1 ? '1' : '0') != jantar ||
                parseFloat(currentEditingStaffEvent.vlrcaixinha || 0) != caixinhaValorAtual ||
                (currentEditingStaffEvent.descbonus || '').trim() != descBonus.trim() ||
                (currentEditingStaffEvent.descbeneficios || '').trim() != descBeneficio.trim() ||
                (currentEditingStaffEvent.setor || '').trim() != setor.trim() ||
                currentEditingStaffEvent.idcliente != idCliente ||
                currentEditingStaffEvent.idevento != idEvento ||
                currentEditingStaffEvent.idmontagem != idMontagem ||
                (currentEditingStaffEvent.pavilhao || '').toUpperCase().trim() != pavilhao
            ) {
                houveAlteracao = true;
            }

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
            setor: staff.setor || ""
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
        setor: ""
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

       const pavilhao = await fetchComToken(`/staff/pavilhao?idmontagem=${idMontagem}`);
        
        let selects = document.querySelectorAll(".nmPavilhao");      
        
        selects.forEach(select => {        
           
            select.innerHTML = '<option value="">Selecione o Pavilhão</option>'; // Adiciona a opção padrão
            pavilhao.forEach(localpav => {
          
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

function limparCamposStaff() {
    const campos = [
        "idStaff", "nmFuncionario", "apelidoFuncionario", "linkFotoFuncionarios", "descFuncao", "vlrCusto",
        "nmLocalMontagem", "nmPavilhao", "almoco", "jantar", "transporte", "vlrBeneficio", "descBeneficio",
        "nmCliente", "nmEvento", "vlrTotal", "vlrTotalHidden", "idFuncionario", "idFuncao", "idMontagem",
        "idPavilhao", "idCliente", "idEvento"
    ];

    campos.forEach(id => {
        const campo = document.getElementById(id);
        if (campo) {
            campo.value = "";
            console.log(`Campo "${id}" limpo.`);
        }
    });

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

    const soma = cache + extra + transporte + almoco + jantar + caixinha;
    const total = soma * numeroDias;

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

function setupComprovanteUpload(fileInputId, fileNameDisplayId, previewImgId, pdfPreviewDivId, pdfLinkId, imagePreviewDivId, linkImageId) {
    const fileInput = document.getElementById(fileInputId);
    const fileNameDisplay = document.getElementById(fileNameDisplayId);
    const previewImg = document.getElementById(previewImgId); // A tag <img> que será sempre oculta
    const pdfPreviewDiv = document.getElementById(pdfPreviewDivId);
    const pdfLink = document.getElementById(pdfLinkId);
    const imagePreviewDiv = document.getElementById(imagePreviewDivId); // Div do botão de imagem
    const linkImage = document.getElementById(linkImageId); // Link do botão de imagem

    // Verificação de elementos (importante para depuração)
    if (!fileInput || !fileNameDisplay || !previewImg || !pdfPreviewDiv || !pdfLink || !imagePreviewDiv || !linkImage) {
        console.warn(`[SETUP ERROR] Elementos não encontrados para o setup: Input=${fileInputId}, Nome=${fileNameDisplayId}, Img=${previewImgId}, PDFDiv=${pdfPreviewDivId}, PDFLink=${pdfLinkId}, ImgDiv=${imagePreviewDivId}, ImgLink=${linkImageId}`);
        return;
    }
    console.log(`[SETUP SUCESSO] Todos os elementos encontrados para ${fileInputId}.`);

    fileInput.addEventListener('change', function(event) {
        console.log(`[EVENTO CHANGE] Evento 'change' disparado para ${fileInputId}.`);
        const file = event.target.files[0];

        console.log(`[EVENTO CHANGE] Objeto 'file' capturado:`, file);

        // Esconde TODOS os previews por padrão ao selecionar um novo arquivo
        previewImg.style.display = 'none'; // A tag <img> sempre oculta
        pdfPreviewDiv.style.display = 'none';
        pdfLink.href = '#';
        imagePreviewDiv.style.display = 'none'; // Esconde o botão de imagem
        linkImage.href = '#'; // Limpa o href do link da imagem

        if (file) {
            fileNameDisplay.textContent = `Arquivo selecionado: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`;
            console.log(`[PROCESSANDO ARQUIVO] Arquivo selecionado: ${file.name}, Tipo: ${file.type}`);

            const reader = new FileReader();

            reader.onload = function(e) {
                const dataUrl = e.target.result;

                const isImage = file.type.startsWith('image/');
                const isPdf = file.type === 'application/pdf';

                console.log(`[PREVIEW LOGIC] Tipo MIME detectado: ${file.type}. É Imagem? ${isImage}. É PDF? ${isPdf}.`);

                if (isImage) {
                    linkImage.href = dataUrl; // Define o Data URL como href para o botão de imagem
                    imagePreviewDiv.style.display = 'block'; // Exibe o div do botão de imagem
                    console.log(`[PREVIEW IMAGE] Exibindo botão de prévia de imagem. href definido para: ${linkImage.href.substring(0, 50)}...`);
                } else if (isPdf) {
                    pdfLink.href = dataUrl; // Define o Data URL como href para o botão de PDF
                    pdfPreviewDiv.style.display = 'block'; // Exibe o div do botão de PDF
                    console.log(`[PREVIEW PDF] Exibindo botão de PDF. href definido para: ${pdfLink.href.substring(0, 50)}...`);
                } else {
                    console.warn(`[PREVIEW WARNING] Tipo de arquivo não suportado para pré-visualização: ${file.type}`);
                }
                console.log(`[FINALIZADO] Comprovante para ${fileInputId} selecionado e processado.`);
            };

            reader.onerror = function(error) {
                console.error(`[ERRO READER] Erro ao ler o arquivo para ${fileInputId}:`, error);
                fileNameDisplay.textContent = "Erro ao ler o arquivo.";
                previewImg.style.display = 'none';
                pdfPreviewDiv.style.display = 'none';
                pdfLink.href = '#';
                imagePreviewDiv.style.display = 'none';
                linkImage.href = '#';
            };

            reader.readAsDataURL(file);
        } else {
            fileNameDisplay.textContent = "Nenhum arquivo selecionado";
            previewImg.style.display = 'none';
            pdfPreviewDiv.style.display = 'none';
            pdfLink.href = '#';
            imagePreviewDiv.style.display = 'none';
            linkImage.href = '#';
            console.log(`[NENHUM ARQUIVO] Nenhum arquivo selecionado para ${fileInputId}.`);
        }
    });
}


function preencherComprovanteCampo(filePath, fileNameDisplayId, previewImgId, pdfPreviewDivId, pdfLinkId, imagePreviewDivId, linkImageId) {
    const fileNameDisplay = document.getElementById(fileNameDisplayId);
    const previewImg = document.getElementById(previewImgId);
    const pdfPreviewDiv = document.getElementById(pdfPreviewDivId);
    const pdfLink = document.getElementById(pdfLinkId);
    const imagePreviewDiv = document.getElementById(imagePreviewDivId);
    const linkImage = document.getElementById(linkImageId);
    const fileInputId = fileNameDisplayId.replace('fileName', 'file');
    const fileInput = document.getElementById(fileInputId);

    if (!fileNameDisplay || !previewImg || !pdfPreviewDiv || !pdfLink || !imagePreviewDiv || !linkImage || !fileInput) {
        console.warn(`[CARREGAR DO BANCO ERROR] Elementos não encontrados para preencher: ${fileNameDisplayId}, ${previewImgId}, ${pdfPreviewDivId}, ${pdfLinkId}, ${imagePreviewDivId}, ${linkImageId}, ${fileInputId}`);
        return;
    }

    // Esconde TODOS os previews por padrão
    previewImg.style.display = 'none';
    pdfPreviewDiv.style.display = 'none';
    pdfLink.href = '#';
    imagePreviewDiv.style.display = 'none';
    linkImage.href = '#';

    if (filePath) {
        const fileName = filePath.split('/').pop();
        fileNameDisplay.textContent = fileName;

        const isImageFile = filePath.match(/\.(jpeg|jpg|png|gif|webp|bmp|svg)$/i);
        const isPdfFile = filePath.match(/\.pdf$/i);

        if (isImageFile) {
            linkImage.href = filePath;
            imagePreviewDiv.style.display = 'block';
        } else if (isPdfFile) {
            pdfLink.href = filePath;
            pdfPreviewDiv.style.display = 'block';
        } else {
            console.warn(`[CARREGAR DO BANCO WARNING] Tipo de arquivo desconhecido para pré-visualização: ${filePath}. Exibindo apenas nome.`);
        }
    } else {
        fileNameDisplay.textContent = 'Nenhum arquivo selecionado';
        fileInput.value = '';
    }
}


// E na sua função de limpeza
function limparCamposComprovantes() {
    // Limpa Comprovante de Cache
    document.getElementById('fileCache').value = '';
    document.getElementById('fileNameCache').textContent = 'Nenhum arquivo selecionado';
    document.getElementById('previewCache').src = '#';
    document.getElementById('previewCache').style.display = 'none';
    document.getElementById('linkCache').href = '#';
    document.getElementById('pdfPreviewCache').style.display = 'none';
    document.getElementById('linkImageCache').href = '#';
    document.getElementById('imagePreviewCache').style.display = 'none';

    // ... (repetir para Ajuda de Custo e Caixinha) ...

    // Limpa Comprovante de Ajuda de Custo
    document.getElementById('fileAjdCusto').value = '';
    document.getElementById('fileNameAjdCusto').textContent = 'Nenhum arquivo selecionado';
    document.getElementById('previewAjdCusto').src = '#';
    document.getElementById('previewAjdCusto').style.display = 'none';
    document.getElementById('linkAjdCusto').href = '#';
    document.getElementById('pdfPreviewAjdCusto').style.display = 'none';
    document.getElementById('linkImageAjdCusto').href = '#';
    document.getElementById('imagePreviewAjdCusto').style.display = 'none';

    // Limpa Comprovante de Caixinha
    document.getElementById('fileCaixinha').value = '';
    document.getElementById('fileNameCaixinha').textContent = 'Nenhum arquivo selecionado';
    document.getElementById('previewCaixinha').src = '#';
    document.getElementById('previewCaixinha').style.display = 'none';
    document.getElementById('linkCaixinha').href = '#';
    document.getElementById('pdfPreviewCaixinha').style.display = 'none';
    document.getElementById('linkImageCaixinha').href = '#';
    document.getElementById('imagePreviewCaixinha').style.display = 'none';

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