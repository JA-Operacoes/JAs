 console.log("Staff.js iniciou");
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
        avaliacao:"",
        idFuncionario:"",
        nmFuncionario: "",      
        descFuncao: "",
        vlrCusto: "",
        extra:"",
        transporte: "",
        almoco:"",
        jantar:"",   
        caixinha:"",
        descBeneficio: "",
        idCliente:"",
        nmCliente: "",
        idEvento:"",
        nmEvento: "",
        idLocalMontagem:"",
        nmLocalMontagem:"",
        datasEventos: "",   
        bonus: "",   
        vlrTotal: "",
        nmPavilhao:""
    }
};

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

// Checkboxes e seus campos relacionados
const extracheck = document.getElementById('Extracheck');
const campoExtra = document.getElementById('campoExtra');
const caixinhacheck = document.getElementById('Caixinhacheck');
const campoCaixinha = document.getElementById('campoCaixinha');

// Variável para armazenar os dados originais do registro em edição
let currentEditingStaffEvent = null;
let retornoDados = false;

const carregarDadosParaEditar = (eventData) => {
    console.log("CARREGARDADOSPRAEDITAR", retornoDados);
        retornoDados = true;
        // Armazena os dados originais para comparação em um PUT
        currentEditingStaffEvent = eventData;

        console.log("Carregando dados para edição:", eventData);
    
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
        descBeneficioTextarea.value = eventData.descbonus || ''; // Seu campo de bônus está como descbonus no backend
        bonusTextarea.value = eventData.descbonus || ''; // Se você tem um campo 'bonus' no HTML
        vlrTotalInput.value = parseFloat(eventData.total || 0).toFixed(2).replace('.', ',');

        // Tratamento dos Checkboxes Extra/Caixinha
        if (extracheck && campoExtra) {
            extracheck.checked = (parseFloat(eventData.vlrextra || 0) > 0);
            campoExtra.style.display = extracheck.checked ? 'block' : 'none';
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

        if (fileInput) fileInput.value = ''; // Limpa o input de arquivo de foto
        if (document.getElementById('filePDFCache')) document.getElementById('filePDFCache').value = '';
        if (document.getElementById('filePDFAjuda')) document.getElementById('filePDFAjuda').value = '';
        if (document.getElementById('filePDFCaixinha')) document.getElementById('filePDFCaixinha').value = '';
    
    
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

                    row.insertCell().textContent = eventData.idevento || '';
                    row.insertCell().textContent = eventData.nmfuncao || '';
                    row.insertCell().textContent = eventData.nmevento || '';
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
                    row.insertCell().textContent = parseFloat(eventData.vlrtransporte || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                    row.insertCell().textContent = (eventData.vlralmoco === 1 ? 'Sim' : 'Não');
                    row.insertCell().textContent = (eventData.vlrjantar === 1 ? 'Sim' : 'Não');
                    row.insertCell().textContent = parseFloat(eventData.vlrcaixinha || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                    row.insertCell().textContent = eventData.beneficios || '';
                    row.insertCell().textContent = eventData.nmlocalmontagem || '';
                    row.insertCell().textContent = eventData.pavilhao || '';
                    row.insertCell().textContent = eventData.nmcliente || '';
                    row.insertCell().textContent = eventData.descbonus || '';
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

    botaoEnviar.addEventListener("click", async (event) => {
      event.preventDefault(); // Previne o envio padrão do formulário

        //const avaliacao = document.querySelector("#avaliacao").value.trim();
        const selectAvaliacao = document.getElementById("avaliacao");
        const avaliacao = selectAvaliacao.options[selectAvaliacao.selectedIndex]?.textContent.trim().toUpperCase() || '';
        const idStaff = document.querySelector("#idStaff").value.trim();
        const idFuncionario = document.querySelector("#idFuncionario").value;
        //   const nmFuncionario = document.querySelector("#nmFuncionario").value.toUpperCase().trim();
        const selectFuncionario = document.getElementById("nmFuncionario");
        const nmFuncionario = selectFuncionario.options[selectFuncionario.selectedIndex]?.textContent.trim().toUpperCase() || '';
        const idFuncao = document.querySelector("#idFuncao").value;
        // const descFuncao = document.querySelector("#descFuncao").value || '';
        const selectFuncao = document.getElementById("descFuncao");
        const descFuncao = selectFuncao.options[selectFuncao.selectedIndex]?.textContent.trim().toUpperCase() || '';
        const vlrCusto = document.querySelector("#vlrCusto").value.trim() || '0';
        const extra = document.querySelector("#extra").value.trim() || '0';
        const transporte = document.querySelector("#transporte").value.trim() || '0';
        const almoco = document.querySelector("#almoco").value.trim() || '0';
        const jantar = document.querySelector("#jantar").value.trim() || '0';
        const caixinha = document.querySelector("#caixinha").value.trim() || '0';
        const idCliente = document.querySelector("#idCliente").value; 
        //  const nmCliente = document.querySelector("#nmCliente").value.trim();
        const selectCliente = document.getElementById("nmCliente");
        const nmCliente = selectCliente.options[selectCliente.selectedIndex]?.textContent.trim().toUpperCase() || '';
        const idEvento = document.querySelector("#idEvento").value;       
        //  const nmEvento = document.querySelector("#nmEvento").value.trim();
        const selectEvento = document.getElementById("nmEvento");
        const nmEvento = selectEvento.options[selectEvento.selectedIndex]?.textContent.trim().toUpperCase() || '';
        const idMontagem = document.querySelector("#idMontagem").value; // ID do local de montagem (FK)
        //const nmLocalMontagem = document.querySelector("#nmLocalMontagem").value.trim() || ''; // Nome do local de montagem (histórico)
        const selectLocalMontagem = document.getElementById("nmLocalMontagem");
        const nmLocalMontagem = selectLocalMontagem.options[selectLocalMontagem.selectedIndex].textContent.trim();
        //const pavilhao = document.querySelector("#nmPavilhao").value.trim() || '';
        const selectPavilhao = document.getElementById("nmPavilhao");
        const pavilhao = selectPavilhao.options[selectPavilhao.selectedIndex]?.textContent.trim().toUpperCase() || '';
        
        // const datasEventoRawValue = document.querySelector("#datasEvento").value.trim();
        // const periodoDoEvento = getPeriodoDatas(datasEventoRawValue);
        
        const datasEventoRawValue = datasEventoInput.value.trim();
        const periodoDoEvento = getPeriodoDatas(datasEventoRawValue);

    console.log("Array de datas do evento para envio:", periodoDoEvento);

    console.log("AVALIACAO", avaliacao);
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

    if (caixinha){
        if(!descBeneficio){
            return Swal.fire("Campos obrigatórios!", "Obrigatório o Preenchimento das Descrições do Benefícios (Caixinha/Extra)!","warning");
        }
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
                return Swal.fire("Erro", "Dados originais não encontrados para comparação (ID ausente para PUT).", "error");
            }
            formData.append('idstaff', currentEditingStaffEvent.idstaff || ''); 
            formData.append('idstaffevento', currentEditingStaffEvent.idstaffevento); 

            let houveAlteracao = false;
            if (
                currentEditingStaffEvent.idfuncionario != idFuncionario ||
                currentEditingStaffEvent.nmfuncao.toUpperCase() != descFuncao ||
                parseFloat(currentEditingStaffEvent.vlrcache || 0) != parseFloat(vlrCusto.replace(',', '.') || 0) ||
                JSON.stringify(currentEditingStaffEvent.periodo || []) !== JSON.stringify(periodoDoEvento) ||
                parseFloat(currentEditingStaffEvent.vlrextra || 0) != parseFloat(extra.replace(',', '.') || 0) ||
                parseFloat(currentEditingStaffEvent.vlrtransporte || 0) != parseFloat(transporte.replace(',', '.') || 0) ||
                (currentEditingStaffEvent.vlralmoco === 1 ? '1' : '0') != almoco || // Comparar valor '1' ou '0'
                (currentEditingStaffEvent.vlrjantar === 1 ? '1' : '0') != jantar || // Comparar valor '1' ou '0'
                parseFloat(currentEditingStaffEvent.vlrcaixinha || 0) != parseFloat(caixinha.replace(',', '.') || 0) ||
                (currentEditingStaffEvent.descbonus || '') != bonusTextarea.value.trim() ||
                currentEditingStaffEvent.idcliente != idCliente ||
                currentEditingStaffEvent.idevento != idEvento ||
                currentEditingStaffEvent.idmontagem != idMontagem ||
                (currentEditingStaffEvent.pavilhao || '').toUpperCase().trim() != pavilhao // Comparar nomes de pavilhão
            ) {
                houveAlteracao = true;
            }

            console.log("ALTERAÇÃO", houveAlteracao);

            if (!houveAlteracao) {
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

            if (!isConfirmed) return;
        }

        // --- EXECUTA O FETCH PARA POST OU PUT ---
        try {
            console.log("ENTRANDO NO TRY. Método:", metodo);

            const respostaApi = await fetchComToken(url, {
                method: metodo,
                body: formData,
            });

            await Swal.fire("Sucesso!", respostaApi.message || "Staff salvo com sucesso.", "success");
            limparCamposStaff();
            window.StaffOriginal = null;

            await carregarTabelaStaff(idFuncionario);

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
            vlrTotal: staff.vlrtotal        
    
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
        avaliacao:"",
        idFuncionario:"",
        nmFuncionario: "",      
        descFuncao: "",
        vlrCusto: "",
        extra:"",
        transporte: "",
        almoco:"",
        jantar:"",   
        caixinha:"",
        descBeneficio: "",
        idCliente:"",
        nmCliente: "",
        idEvento:"",
        nmEvento: "",
        idLocalMontagem:"",
        nmLocalMontagem:"",
        datasEventos: "",   
        bonus: "",   
        vlrTotal: "",
        nmPavilhao:""
    };
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
const campos = ["idStaff", "nmFuncionario", "apelidoFuncionario", "linkFotoFuncionarios", "descFuncao", "vlrCusto", 
    "nmLocalMontagem", "nmPavilhao", "almoco", "jantar", "transporte", "vlrBeneficio", "descBeneficio", "nmCliente", 
    "nmEvento", "vlrTotal", "vlrTotalHidden",
    "idFuncionario", "idFuncao", "idMontagem", "idPavilhao", "idCliente", "idEvento" ];
    campos.forEach(id => {
        const campo = document.getElementById(id);
        if (campo) campo.value = "";
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
    }
    if (fileName) {
        fileName.textContent = "Nenhum arquivo selecionado";
    }
    if (fileInput) {
        fileInput.value = ""; // Limpa o valor do input file
        // Se precisar reativar (já que no HTML está disabled), faça aqui
        // fileInput.disabled = false; 
    }
    if (uploadHeader) {
        uploadHeader.style.display = "block"; // Reexibe o header de upload
    }
    if (linkFotoFuncionarios) {
        linkFotoFuncionarios.value = ""; // Limpa o hidden input que guarda o link da foto
    }
    if (nomeFuncionarioExibido) {
        nomeFuncionarioExibido.textContent = ""; // Limpa o nome exibido abaixo da foto
    }

    // 3. Limpeza dos campos de DATAS DO EVENTO e CONTADOR
    const datasEventoInput = document.getElementById('datasEvento');
    const contadorDatas = document.getElementById('contadorDatas');

    if (datasEventoInput._flatpickr) {
        datasEventoInput._flatpickr.clear(); // Isso limpa as datas selecionadas
    } else {
        // Se por algum motivo a instância não estiver diretamente acessível,
        // ou se não for um Flatpickr, apenas limpa o valor do input.
        datasEventoInput.value = "";
    }
    if (contadorDatas) {
        contadorDatas.textContent = "Nenhuma data selecionada.";
    }

    // Campos de texto de nome de arquivo PDF
    const fileNamesPDF = document.querySelectorAll('p[name="fileNamePDF"]');
    fileNamesPDF.forEach(p => {
        p.textContent = "Nenhum arquivo selecionado";
    });

    // Inputs de arquivo PDF
    const fileInputsPDF = document.querySelectorAll('input[type="file"][name="filePDF"]');
    fileInputsPDF.forEach(input => {
        input.value = ""; // Limpa o valor do input file
    });

    // Hidden inputs dos comprovantes (ComprovanteCache, ComprovanteAjdCusto, ComprovanteCaixinha)
    const hiddenComprovantes = ["ComprovanteCache", "ComprovanteAjdCusto", "ComprovanteCaixinha"];
    hiddenComprovantes.forEach(id => {
        const hiddenInput = document.getElementById(id);
        if (hiddenInput) {
            hiddenInput.value = "";
        }
    });

    // 5. Resetar checkboxes e seus campos associados
    const extraCheck = document.getElementById('Extracheck');
    const campoExtra = document.getElementById('campoExtra');
    const caixinhaCheck = document.getElementById('Caixinhacheck');
    const campoCaixinha = document.getElementById('campoCaixinha');

    if (extraCheck) {
        extraCheck.checked = false;
        if (campoExtra) campoExtra.style.display = 'none';
        const inputExtra = document.getElementById('extra');
        if (inputExtra) inputExtra.value = '';
    }
    if (caixinhaCheck) {
        caixinhaCheck.checked = false;
        if (campoCaixinha) campoCaixinha.style.display = 'none';
        const inputCaixinha = document.getElementById('caixinha');
        if (inputCaixinha) inputCaixinha.value = '';
    }

    // 6. Resetar a avaliação para a opção padrão (se for um select)
    const avaliacaoSelect = document.getElementById('avaliacao');
    if (avaliacaoSelect) {
        avaliacaoSelect.value = ''; // Reseta para a opção disabled "Avalie o Funcionario"
        const tarjaAvaliacao = document.getElementById('tarjaAvaliacao');
        if (tarjaAvaliacao) {
            tarjaAvaliacao.className = 'tarja-avaliacao'; // Remove as classes de cor
            tarjaAvaliacao.textContent = ''; // Limpa o texto da tarja
        }
    }
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

function configurarPreviewPDF() {
  const inputPDF = document.getElementById('filePDF');
  const previewPDF = document.getElementById('previewPDF');
  const fileNamePDF = document.getElementById('fileNamePDF');
  const hiddenPDF = document.getElementById('ComprovantePagamentos');
  const headerPDF = document.getElementById('uploadHeaderPDF');

  inputPDF.addEventListener('change', function () {
    const file = inputPDF.files[0];

    if (!file || file.type !== 'application/pdf') {
      if (previewPDF) previewPDF.style.display = 'none';
      if (headerPDF) headerPDF.style.display = 'block';
      if (fileNamePDF) fileNamePDF.textContent = 'Nenhum arquivo selecionado';
      if (hiddenPDF) hiddenPDF.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
      if (previewPDF) {
        previewPDF.src = e.target.result;
        previewPDF.style.display = 'block';
      }
      if (headerPDF) headerPDF.style.display = 'none';
      if (fileNamePDF) fileNamePDF.textContent = file.name;
      if (hiddenPDF) hiddenPDF.value = e.target.result;
    };
    reader.readAsDataURL(file);
    console.log("funcionou pdf", fileNamePDF)
  });
}

function checkModalScroll() {
        // Pequeno atraso para permitir que a transição CSS do collapsible-content ocorra
        // antes de calcular a altura. 350ms é um pouco mais do que os 0.3s da transição.
        setTimeout(() => {
            if (modalContainer) {
                const contentHeight = modalContainer.scrollHeight; // Altura real do conteúdo
                const viewportHeight = modalContainer.clientHeight; // Altura visível do container do modal

                if (contentHeight > viewportHeight) {
                    modalContainer.classList.add('scrollable'); // Adiciona a classe para ativar rolagem
                } else {
                    modalContainer.classList.remove('scrollable'); // Remove a classe para desativar rolagem
                }
            }
        }, 350); // Deve ser maior que a duração da sua transição (0.3s)
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

function configurarEventosStaff() {
    console.log("Configurando eventos Staff...");
    verificaStaff(); // Carrega os Staff ao abrir o modal
    adicionarEventoBlurStaff();
    inicializarFlatpickrsGlobais();


    
    // Inicializa o estado dos campos extra/caixinha no carregamento
    const extracheck = document.getElementById('Extracheck');
    const campoExtra = document.getElementById('campoExtra');
    if (extracheck && campoExtra) {
        extracheck.addEventListener('change', function() {
            campoExtra.style.display = this.checked ? 'block' : 'none';
        });
        campoExtra.style.display = extracheck.checked ? 'block' : 'none';
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