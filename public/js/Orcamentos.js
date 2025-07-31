import "https://cdn.jsdelivr.net/npm/flatpickr@latest/dist/flatpickr.min.js";
import "https://cdn.jsdelivr.net/npm/flatpickr@latest/dist/l10n/pt.js";


//import "../js/flatpickr/l10n/pt.js";
//import "../js/flatpickr/flatpickr.min.js";


import { fetchComToken} from '../../utils/utils.js';

let idMontagemChangeListener = null;
let statusInputListener = null;
let nrOrcamentoInputListener = null;
let nrOrcamentoBlurListener = null;
let btnAdicionarLinhaListener = null;
let btnAdicionarLinhaAdicionalListener = null;
let globalDescontoValorInputListener = null;
let globalDescontoValorBlurListener = null;
let globalDescontoPercentualInputListener = null;
let globalDescontoPercentualBlurListener = null;
let globalAcrescimoValorInputListener = null;
let globalAcrescimoValorBlurListener = null;
let globalAcrescimoPercentualInputListener = null;
let globalAcrescimoPercentualBlurListener = null;
let percentualImpostoInputListener = null;
let btnEnviarListener = null;
let btnLimparListener = null;
//importado no inicio do js pois deve ser importado antes do restante do codigo


const fp = window.flatpickr; 
const currentLocale = fp.l10ns.pt || fp.l10ns.default;

if (!currentLocale) {
    console.error("Flatpickr locale 'pt' não carregado. Verifique o caminho do arquivo.");
} else {
    fp.setDefaults({
        locale: currentLocale
    });
  //  console.log("Flatpickr locale definido para Português.");
}
//fim do tratamento do flatpickr

let locaisDeMontagem = [];

let flatpickrInstances = {};

let flatpickrInstancesOrcamento = []; 

if (typeof window.hasRegisteredChangeListenerForAjdCusto === 'undefined') {
    window.hasRegisteredChangeListenerForAjdCusto = false;
}

const commonFlatpickrOptions = {
    mode: "range",
    dateFormat: "d/m/Y",
    altInput: true, // Se quiser altInput para os da tabela também
    altFormat: "d/m/Y",
    //locale: flatpickr.l10ns.pt,
    locale: currentLocale,
    appendTo: document.body // Certifique-se de que 'modal-flatpickr-container' existe e é o elemento correto
   
};

const commonFlatpickrOptionsTable = {
    mode: "range",
    dateFormat: "d/m/Y",
    altInput: true, // Se quiser altInput para os da tabela também
    altFormat: "d/m/Y",
    //locale: flatpickr.l10ns.pt,
    locale: currentLocale,
    appendTo: document.body, // Certifique-se de que 'modal-flatpickr-container' existe e é o elemento correto
    onChange: function(selectedDates, dateStr, instance) {
        // Isso garantirá que sua lógica de cálculo de dias e atualização do input
        // seja chamada para QUALQUER Flatpickr que use estas opções.
        atualizarQtdDias(instance.element, selectedDates);
    }
};

let idCliente;
let idEvento;
let idMontagem;
let idFuncao;
let idPavilhao;
let Categoria = "";
let idEquipamento = "";
let idSuprimento = "";
let vlrAlmoco = 0;
let vlrJantar = 0;
let vlrTransporte = 0;
let funcoesDisponiveis = [];

let lastEditedFieldType = null; // 'valor' ou 'percentual'
let isRecalculatingDiscountAcrescimo = false;

let lastEditedGlobalFieldType = null; // 'valor' ou 'percentual' para os campos globais
let isRecalculatingGlobalDiscountAcrescimo = false;

let selects = document.querySelectorAll(".idFuncao, .idEquipamento, .idSuprimento, .idPavilhao");
    selects.forEach(select => {
        select.addEventListener("change", atualizaProdutoOrc);
    });

const selectFuncao = document.getElementById('selectFuncao');
if (selectFuncao) {
   selectFuncao.addEventListener('change', function() {
    resetarOutrosSelectsOrc(selectFuncao); // Reseta outros selects quando este é alterado
   });    
}
const selectEquipamento = document.getElementById('selectEquipamento');
if (selectEquipamento) {
    selectEquipamento.addEventListener('change', function() {
        resetarOutrosSelectsOrc(selectEquipamento); // Reseta outros selects quando este é alterado
    });   
}
const selectSuprimento = document.getElementById('selectSuprimento');
if (selectSuprimento) {
    selectSuprimento.addEventListener('change', function() {
        resetarOutrosSelectsOrc(selectSuprimento); // Reseta outros selects quando este é alterado
    });
}

// function atualizarOuCriarCampoTexto(nmFantasia, texto) {
//     const campo = document.getElementById(nmFantasia);
//     if (campo) {
//         campo.textContent = texto || "";
//     } else {
//         console.warn(`Elemento com NomeFantasia '${nmFantasia}' não encontrado.`);
//     }
// }

// // Busca por nome fantasia
// async function buscarEExibirDadosClientePorNome(nmFantasia) {
//     try {
//         const dadosCliente = await fetchComToken(`orcamentos/clientes?nmFantasia=${encodeURIComponent(nmFantasia)}`);

//         // if (!dadosCliente.ok) {
//         //     throw new Error(`Erro ao buscar dados do cliente: ${dadosCliente.status}`);
//         // }

//        // const dadosCliente = await response.json();

//         console.log("Cliente selecionado! Dados:", {
//             nome: dadosCliente.nmcontato,
//             celular: dadosCliente.celcontato,
//             email: dadosCliente.emailcontato
//         });

//         // atualizarOuCriarCampoTexto("nmContato", dadosCliente.nmcontato);
//         // atualizarOuCriarCampoTexto("celContato", dadosCliente.celcontato);
//         // atualizarOuCriarCampoTexto("emailContato", dadosCliente.emailcontato);

//     } catch (error) {
//         console.error("Erro ao buscar dados do cliente:", error);
//         Swal.fire("Erro", "Erro ao buscar dados do cliente", "error");

//         atualizarOuCriarCampoTexto("nmContato", "");
//         atualizarOuCriarCampoTexto("celContato", "");
//         atualizarOuCriarCampoTexto("emailContato", "");
//     }
// }

async function  carregarClientesOrc() {  

    try{

        const clientes = await fetchComToken('orcamentos/clientes');
    
        console.log('Clientes recebidos:', clientes);

        let selects = document.querySelectorAll(".idCliente");

        selects.forEach(select => {
          
            const valorSelecionadoAtual = select.value;
            select.innerHTML = '<option value="">Selecione Cliente</option>';

            clientes.forEach(cliente => {
                let option = document.createElement("option");
                option.value = cliente.idcliente;
                option.textContent = cliente.nmfantasia;           

                select.appendChild(option);
            });

            if (valorSelecionadoAtual) {
                select.value = String(valorSelecionadoAtual); 
            }
           
            select.addEventListener('change', function () {
                idCliente = this.value; // O value agora é o ID
                console.log("idCliente selecionado:", idCliente);
            
            });
        });
    
    }
    catch(error){
        console.error("Erro ao carregar clientes:", error);
    }
}


async function carregarEventosOrc() {
      
    try{

        const eventos = await fetchComToken('/orcamentos/eventos');
        
        let selects = document.querySelectorAll(".idEvento");
        
        selects.forEach(select => {           
                
            select.innerHTML = '<option value="">Selecione Evento</option>'; // Adiciona a opção padrão
            eventos.forEach(evento => {
                let option = document.createElement("option");   
              
                option.value = evento.idevento;  // Atenção ao nome da propriedade (idMontagem)
                option.textContent = evento.nmevento; 
                option.setAttribute("data-nmevento", evento.nmevento);
                option.setAttribute("data-idEvento", evento.idevento);
                select.appendChild(option);

            });

            select.addEventListener('change', function () {
                idEvento = this.value;               
                  
            });
            
        });
    }catch(error){
        console.error("Erro ao carregar eventos:", error);
    }  

}

// Função para carregar os locais de montagem
async function carregarLocalMontOrc() {
    try{
        const montagem = await fetchComToken('/orcamentos/localmontagem');
        
        let selects = document.querySelectorAll(".idMontagem");
        
        selects.forEach(select => {           
            // Adiciona as opções de Local de Montagem
            select.innerHTML = '<option value="">Selecione Local de Montagem</option>'; // Adiciona a opção padrão
            montagem.forEach(local => {
                let option = document.createElement("option");

                option.value = local.idmontagem;  
                option.textContent = local.descmontagem; 
                option.setAttribute("data-idMontagem", local.idmontagem); 
                option.setAttribute("data-descmontagem", local.descmontagem);
                option.setAttribute("data-ufmontagem", local.ufmontagem); 
                select.appendChild(option);

                locaisDeMontagem = montagem;

            });
            select.addEventListener("change", function () {

                //idMontagem = this.value; // O value agora é o ID

                const selectedOption = this.options[this.selectedIndex]; 
              
               document.getElementById("idMontagem").value = selectedOption.getAttribute("data-idMontagem");           

               idMontagem = selectedOption.value;        
               console.log("IDLOCALMONTAGEM selecionado:", idMontagem);

                carregarPavilhaoOrc(idMontagem);             
                
            });
            
        });
    }catch(error){
        console.error("Erro ao carregar localmontagem:", error);
    } 
}

let selectedPavilhoes = [];
// function updatePavilhaoDisplayInputs() {
//     const listaPavilhaoDisplay = document.getElementById('listaPavilhaoDisplay');
//     const idsPavilhoesSelecionadosHidden = document.getElementById('idsPavilhoesSelecionados');

//     // Atualiza o input de texto visível com os nomes dos pavilhões
//     listaPavilhaoDisplay.value = selectedPavilhoes.map(p => p.name).join(', ');

//     // Atualiza o input hidden com os IDs em formato JSON (ideal para enviar ao backend)
//     idsPavilhoesSelecionadosHidden.value = JSON.stringify(selectedPavilhoes.map(p => p.id));
// }

function updatePavilhaoDisplayInputs() {
    const container = document.getElementById('pavilhoesSelecionadosContainer');
    const idsInput = document.getElementById('idsPavilhoesSelecionados');
    
    // 1. Limpa o contêiner de tags
    container.innerHTML = '';
    
    // 2. Preenche o contêiner e cria as tags
    selectedPavilhoes.forEach(pavilhao => {
        const tag = document.createElement('span');
        tag.classList.add('pavilhao-tag');
        tag.innerHTML = `
            ${pavilhao.name}
            <button type="button" class="remover-pavilhao-btn" data-id="${pavilhao.id}">&times;</button>
        `;
        container.appendChild(tag);
    });

    // 3. Adiciona o listener de click para os botões de remover
    const removerBotoes = container.querySelectorAll('.remover-pavilhao-btn');
    removerBotoes.forEach(botao => {
        botao.addEventListener('click', function(event) {
            const idPavilhao = parseInt(event.target.dataset.id, 10);
            
            // Filtra o array selectedPavilhoes para remover o item clicado
            selectedPavilhoes = selectedPavilhoes.filter(p => p.id !== idPavilhao);
            
            // Recarrega a exibição dos inputs
            updatePavilhaoDisplayInputs();
        });
    });

    // 4. Atualiza o input hidden com a string JSON correta
    const idsParaOInput = selectedPavilhoes.map(p => p.id);
    idsInput.value = JSON.stringify(idsParaOInput);
}

async function carregarPavilhaoOrc(idMontagem) {
    selectedPavilhoes = [];
    updatePavilhaoDisplayInputs();
    
    if (!idMontagem || idMontagem === '') {
        console.warn("ID da Montagem está vazio, não carregando pavilhões.");
        // Opcional: Limpe o select de pavilhão aqui, se ele tiver opções antigas
        const idPavilhaoSelect = document.querySelector(".idPavilhao");
        if (idPavilhaoSelect) {
            idPavilhaoSelect.innerHTML = '<option value="">Selecione um Pavilhão</option>';
        }
        selectedPavilhoes = [];
        updatePavilhaoDisplayInputs();
        return; // Não faça a requisição se idMontagem for vazio
    }

    // try{

    //    const pavilhao = await fetchComToken(`/orcamentos/pavilhao?idmontagem=${idMontagem}`);
        
    //    console.log("Pavilhão recebido:", pavilhao);
    //     let selects = document.querySelectorAll(".idPavilhao");       
        
        
    //     selects.forEach(select => {        
           
    //         select.innerHTML = '<option value="">Selecione Pavilhão</option>'; // Adiciona a opção padrão
    //         pavilhao.forEach(localpav => {
          
    //             let option = document.createElement("option");

    //             option.value = localpav.idpavilhao;  // Atenção ao nome da propriedade (idMontagem)
    //             option.textContent = localpav.nmpavilhao; 
    //             option.setAttribute("data-idpavilhao", localpav.idpavilhao); 
    //             option.setAttribute("data-nmpavilhao", localpav.nmpavilhao);
                         
    //             select.appendChild(option);
           
    //         });
    //         select.addEventListener("change", function (event) {    
    //             idPavilhao = this.value;   
    //             const selectedOption = this.options[this.selectedIndex];                               
                
    //             console.log("IDPAVILHAO selecionado:", selectedOption.value, selectedOption.getAttribute("data-nmpavilhao")); 

                

             
    //         });
            
    //     });
    // }catch(error){
    //     console.error("Erro ao carregar pavilhao:", error);
    // } 

    try {
        const pavilhoes = await fetchComToken(`/orcamentos/pavilhao?idmontagem=${idMontagem}`);
        console.log("Pavilhões recebido:", pavilhoes);

        const selecionarPavilhaoSelect = document.getElementById("selecionarPavilhao"); // Use o ID correto do seu select
        if (selecionarPavilhaoSelect) {
            selecionarPavilhaoSelect.innerHTML = '<option value="">Selecione para Adicionar</option>'; // Adiciona a opção padrão
            pavilhoes.forEach(localpav => {
                let option = document.createElement("option");
                option.value = localpav.idpavilhao;
                option.textContent = localpav.nmpavilhao;
                // Os data-attributes são úteis, mas para o que você quer, basta o value e textContent
                // option.setAttribute("data-idpavilhao", localpav.idpavilhao);
                // option.setAttribute("data-nmpavilhao", localpav.nmpavilhao);
                selecionarPavilhaoSelect.appendChild(option);
            });
            // O event listener agora será adicionado uma vez, fora desta função, no DOMContentLoaded
        }
    } catch (error) {
        console.error("Erro ao carregar pavilhao:", error);
        Swal.fire("Erro", "Não foi possível carregar os pavilhões.", "error");
    }
}

// async function carregarPavilhaoOrc(idMontagem) {
//     // ... (seu código existente para verificar idMontagem e limpar o select) ...

//     try {
//         const pavilhoes = await fetchComToken(`/orcamentos/pavilhao?idmontagem=${idMontagem}`);
//         console.log("Pavilhões recebidos:", pavilhoes);

//         const nmPavilhaoSelect = document.getElementById("nmPavilhao");
//         if (nmPavilhaoSelect) {
//             // Limpa as opções existentes antes de adicionar novas
//             $(nmPavilhaoSelect).empty(); // Use jQuery .empty() para Select2
//             $(nmPavilhaoSelect).append('<option></option>'); // Opção vazia para placeholder se necessário

//             pavilhoes.forEach(localpav => {
//                 let option = new Option(localpav.nmpavilhao, localpav.idpavilhao, false, false);
//                 $(nmPavilhaoSelect).append(option);
//             });

//             // Inicializa/Atualiza o Select2
//             // Se já estiver inicializado, você pode usar $(nmPavilhaoSelect).val(null).trigger('change'); para resetar seleções
//             // E depois re-selecionar ao carregar um orçamento existente para edição.
//             // Ou destruir e recriar:
//             if ($(nmPavilhaoSelect).data('select2')) {
//                 $(nmPavilhaoSelect).select2('destroy');
//             }
//             $(nmPavilhaoSelect).select2({
//                 placeholder: "Selecione um ou mais Pavilhões",
//                 allowClear: true // Permite limpar todas as seleções
//             });
//         }

//     } catch (error) {
//         console.error("Erro ao carregar pavilhões:", error);
//         Swal.fire("Erro", "Não foi possível carregar os pavilhões.", "error");
//     }
// }

// async function carregarNomePavilhao(id) {
//     if (!id) {
//         console.warn("ID do pavilhão não fornecido para carregarNomePavilhao.");
//         return null; 
//     }
//     try {
       
//         const procurapavilhao = await fetchComToken(`/orcamentos/pavilhao/${id}`);
        
//         if (procurapavilhao && procurapavilhao.nmpavilhao) { // Ajuste 'nome' para a propriedade correta do seu objeto de pavilhão
//             return procurapavilhao.nmpavilhao; 
//         } else {
//             console.warn("Nenhum nome de pavilhão encontrado na resposta:", procurapavilhao);
//             return null;
//         }
//     } catch (error) {
//         console.error('Erro ao carregar nome do pavilhão:', error);
//         return null; 
//     }
      
// }
 

//Função para carregar os Funcao
async function carregarFuncaoOrc() {
    try{
        const funcaofetch = await fetchComToken('/orcamentos/funcao');
        funcoesDisponiveis = funcaofetch;

        let selects = document.querySelectorAll(".idFuncao");
        selects.forEach(select => {
            select.innerHTML = "";

            // console.log('Funcao recebidos 2:', funcao); // Log das Funções recebidas
            let opcaoPadrao = document.createElement("option");
            opcaoPadrao.setAttribute("value", "");
            opcaoPadrao.textContent = "Selecione Função";
            select.appendChild(opcaoPadrao);

            funcaofetch.forEach(funcao => {
                let option = document.createElement("option");
                option.value = funcao.idfuncao;
                option.textContent = funcao.descfuncao;
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
                const linha = this.closest('tr');    
                idFuncao = this.value; // O value agora é o ID
                console.log("IDFUNCAO selecionado change:", idFuncao);

                const selectedOption = this.options[this.selectedIndex];
                
                const idFuncaoAtual = selectedOption.value;                
                
                if (linha) {
                    linha.dataset.idfuncao = idFuncaoAtual; // Atualiza o data-idfuncao na linha
                }
                
                // Se a opção padrão "Selecione Função" for escolhida, zere os valores globais
                if (selectedOption.value === "") {
                    vlrAlmoco = 0;
                    vlrJantar = 0;
                    vlrTransporte = 0;
                    idFuncao = ""; // Limpa também o idFuncao global
                    Categoria = "Produto(s)"; // Reinicia a categoria se for relevante
                    console.log("Nenhuma função selecionada. Valores de almoço, jantar, transporte e ID limpos.");
                    
                } else {
                    // Pega o valor do ID da função selecionada
                    idFuncao = selectedOption.value;
                    console.log("IDFUNCAO selecionado:", idFuncao);

                    // Pega os valores dos atributos 'data-' e os armazena nas variáveis globais
                    // Use parseFloat para garantir que são números para cálculos futuros
                    vlrAlmoco = parseFloat(selectedOption.getAttribute("data-almoco")) || 0;
                    vlrJantar = parseFloat(selectedOption.getAttribute("data-jantar")) || 0;
                    vlrTransporte = parseFloat(selectedOption.getAttribute("data-transporte")) || 0;
                    Categoria = selectedOption.getAttribute("data-categoria") || "N/D";
                  
                    console.log(`Valores Globais Atualizados: Almoco: ${vlrAlmoco}, Jantar: ${vlrJantar}, Transporte: ${vlrTransporte}, Categoria: ${Categoria}`);
                }                
               // Categoria = selectedOption.getAttribute("data-categoria") || "N/D";
                
                recalcularLinha(linha);
                atualizaProdutoOrc(event);
            });
          //  Categoria = "Produto(s)"; // define padrão ao carregar
        });
    }catch(error){
    console.error("Erro ao carregar funcao:", error);
    } 
}


async function carregarEquipamentosOrc() {

    try{
        const equipamentos = await fetchComToken('/orcamentos/equipamentos');

        let selects = document.querySelectorAll(".idEquipamento"); //
        selects.forEach(select => {
            select.innerHTML = "";
            
            let opcaoPadrao = document.createElement("option");
            opcaoPadrao.setAttribute("value", "");
            opcaoPadrao.textContent = "Selecione Equipamento";
            select.appendChild(opcaoPadrao);
            equipamentos.forEach(equipamentos => {
                let option = document.createElement("option");
                option.value = equipamentos.idequip;
                option.textContent = equipamentos.descequip;
                option.setAttribute("data-descproduto", equipamentos.descequip);
                option.setAttribute("data-cto", equipamentos.ctoequip);
                option.setAttribute("data-vda", equipamentos.vdaequip);
                option.setAttribute("data-categoria", "Equipamento(s)");
                select.appendChild(option);
            });
            select.addEventListener("change", function (event) {
                const selectedOption = select.options[select.selectedIndex];
                idEquipamento = this.value;
                Categoria = selectedOption.getAttribute("data-categoria") || "N/D";               
               
                atualizaProdutoOrc(event);
            });

            
            Categoria = "Equipamento(s)"; // define padrão ao carregar
        });
    }catch(error){
    console.error("Erro ao carregar equipamentos:", error);
    }
}
        

// Função para carregar os suprimentos
async function carregarSuprimentosOrc() {
   try{
        const suprimentos = await fetchComToken('/orcamentos/suprimentos');
        let selects = document.querySelectorAll(".idSuprimento");
       
        selects.forEach(select => {
            select.innerHTML = '<option value="">Selecione Suprimento</option>';
            suprimentos.forEach(suprimentos => {
                let option = document.createElement("option");
                option.value = suprimentos.idsup;
                option.textContent = suprimentos.descsup;
                option.setAttribute("data-descproduto", suprimentos.descsup);
                option.setAttribute("data-cto", suprimentos.ctosup);
                option.setAttribute("data-vda", suprimentos.vdasup);
                option.setAttribute("data-categoria", "Suprimento(s)");
                select.appendChild(option); 

            });
            
            select.addEventListener("change", function (event) {
                const selectedOption = select.options[select.selectedIndex];
                idSuprimento = this.value;
                Categoria = selectedOption.getAttribute("data-categoria") || "N/D";
              
                atualizaProdutoOrc(event);
            });
            Categoria = "Suprimento(s)"; // define padrão ao carregar
        });
    }catch(error){
    console.error("Erro ao carregar suprimentos:", error);
    }
}

function limparSelects() {
  const ids = ['selectFuncao', 'selectEquipamento', 'selectSuprimento'];

  ids.forEach(function(id) {
    const select = document.getElementById(id);
    if (select) {
      select.selectedIndex = 0; // Seleciona o primeiro item (geralmente uma opção vazia ou "Selecione...")
    }
  });
}

function configurarInfraCheckbox() {
    let checkbox = document.getElementById("ativo");
    let bloco = document.getElementById("blocoInfra");
    let bloco2 = document.getElementById("blocoInfra2");
 
    if (!checkbox || !bloco || !bloco2) return;


    function atualizarVisibilidade() {
        bloco.style.display = checkbox.checked ? "block" : "none";
        bloco2.style.display = checkbox.checked ? "block" : "none";
    }

    checkbox.addEventListener("change", atualizarVisibilidade);
// console.log("entrou na função");
    // Opcional: já configura o estado inicial com base no checkbox
    atualizarVisibilidade();
}


function configurarFormularioOrc() {
    let form = document.querySelector("#form");
    if (!form) return;

    form.addEventListener("submit", function (event) {
        event.preventDefault();

        let idCliente = document.getElementById("idCliente").value;
        console.log("ID Cliente:", idCliente); // Log do ID do cliente
        // let idMontagem = document.getElementById("idMontagem").value;

        let tabela = document.getElementById("tabela");
        let linhas = tabela.getElementsByTagName("tbody")[0].getElementsByTagName("tr");
        let orcamento = { idCliente, Pessoas: [] };

        for (let linha of linhas) {
            let dados = {
                // idFuncao: linha.cells[0].querySelector(".idFuncao").value,
                qtdProduto: linha.cells[0].textContent.trim(),
                qtdDias: linha.cells[1].textContent.trim(),
                valor: linha.cells[2].textContent.trim(),
                total: linha.cells[3].textContent.trim()
            };
            orcamento.Pessoas.push(dados);
        }
     });
    
}

function desformatarMoeda(valor) {

   if (!valor) return 0;

    // Se for número, retorna direto
    if (typeof valor === 'number') return valor;

    // Remove R$ e espaços
    valor = valor.replace(/[R$\s]/g, '');

    // Se valor contiver vírgula e ponto (R$ 1.234,56), remove o ponto (milhar) e troca vírgula por ponto
    if (valor.includes(',') && valor.includes('.')) {
        valor = valor.replace(/\./g, '').replace(',', '.');
    } else if (valor.includes(',')) {
        // Se só tiver vírgula, assume que vírgula é decimal
        valor = valor.replace(',', '.');
    }

    // Se tiver só ponto, assume que já está no formato decimal correto
    return parseFloat(valor) || 0;
}


function recalcularTotaisGerais() {
    let totalCustoGeral = 0;
    let totalVendaGeral = 0;
    let totalAjdCustoGeral = 0;

    // Soma os custos
    document.querySelectorAll('.totCtoDiaria').forEach(cell => {
        totalCustoGeral += desformatarMoeda(cell.textContent);
    });

    // Soma as vendas
    document.querySelectorAll('.totVdaDiaria').forEach(cell => {
        totalVendaGeral += desformatarMoeda(cell.textContent);
    });

    document.querySelectorAll('.totAjdCusto').forEach(cell => {
        totalAjdCustoGeral += desformatarMoeda(cell.textContent);
    });

    // Atualiza campos visuais
    document.querySelector('#totalGeralCto').value = totalCustoGeral.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });

    document.querySelector('#totalGeralVda').value = totalVendaGeral.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });

    

    // Atualiza o valor do cliente com o valor total de venda
    const campoValorCliente = document.querySelector('#valorCliente');
    if (campoValorCliente) {
        campoValorCliente.value = totalVendaGeral.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        });
    }
    console.log("RECALCULAR TOTAIS GERAIS", totalCustoGeral, totalVendaGeral, totalAjdCustoGeral);
    
    calcularLucro();
    calcularLucroReal();
}

function calcularLucro() {
    console.log("CALCULAR LUCRO");
    let totalCustoGeral = 0;
    let totalVendaGeral = 0;

    // Extraímos os valores numéricos das células, desformatados de moeda
    totalCustoGeral = desformatarMoeda(document.querySelector('#totalGeralCto').value);
    totalVendaGeral = desformatarMoeda(document.querySelector('#totalGeralVda').value);

    console.log("CALCULAR LUCRO", totalCustoGeral, totalVendaGeral);
    // Calcula o lucro
    let lucro = totalVendaGeral - totalCustoGeral;

    let porcentagemLucro = 0;
    if (totalVendaGeral > 0) {
        porcentagemLucro = (lucro / totalVendaGeral) * 100;
    }

    // Exibe o lucro no console
    console.log('Lucro calculado:', lucro);
    console.log('Porcentagem de Lucro:', porcentagemLucro.toFixed(2) + '%');

    // Atualiza o campo de lucro com a formatação de moeda
    let inputLucro = document.querySelector('#Lucro');
    if (inputLucro) {
        inputLucro.value = formatarMoeda(lucro);
    }

    let inputPorcentagemLucro = document.querySelector('#percentLucro');
    if (inputPorcentagemLucro) {
        inputPorcentagemLucro.value = porcentagemLucro.toFixed(2) + '%';
    }
}

function calcularLucroReal() {
     
    let totalCustoGeral = 0;
    let totalAjdCusto = 0;
    let valorFinalCliente = 0;
    let valorPercImposto = 0;

    const inputTotalGeral = document.querySelector('#totalGeralCto');
    const inputTotalAjdCusto= document.querySelector('#totalAjdCusto');
    const inputValorCliente = document.querySelector('#valorCliente');
    const inputPercImposto = document.querySelector('#percentImposto');

    if (!inputTotalGeral || !inputValorCliente) {
        console.warn("⚠️ Campo(s) #totalGeral ou #valorCliente não encontrados. Lucro não pode ser calculado.");
        return;
    }
    console.log("CALCULAR LUCRO REAL", inputTotalGeral.value, inputValorCliente.value, inputTotalAjdCusto?.value);
    // Obtém os valores convertendo de moeda
    totalCustoGeral = desformatarMoeda(inputTotalGeral.value);    
    totalAjdCusto = desformatarMoeda(inputTotalAjdCusto.value);
    valorFinalCliente = desformatarMoeda(inputValorCliente.value);
    valorPercImposto = desformatarMoeda(inputPercImposto.value);

    console.log("TOTAL AJDCUSTO", totalCustoGeral, totalAjdCusto, valorFinalCliente, valorPercImposto);

    
    // Atualiza o campo de imposto com a formatação de moeda
    let vlrImposto = valorFinalCliente > 0 
        ? (valorFinalCliente * valorPercImposto / 100) 
        : 0;

    console.log('💰 Valor do Imposto calculado:', vlrImposto);

    // Calcula lucro
    let lucroReal = valorFinalCliente - (totalCustoGeral+totalAjdCusto+vlrImposto);
    let porcentagemLucroReal = valorFinalCliente > 0
        ? (lucroReal / valorFinalCliente) * 100
        : 0;

    console.log('📈 Lucro Real calculado:', lucroReal);
    console.log('📊 Porcentagem de Lucro Real:', porcentagemLucroReal.toFixed(2) + '%');

    // Atualiza os campos de resultado
    const inputLucro = document.querySelector('#lucroReal');
    if (inputLucro) {
        inputLucro.value = formatarMoeda(lucroReal);
    } else {
        console.warn("⚠️ Campo #lucroReal não encontrado.");
    }

    const inputPorcentagemLucro = document.querySelector('#percentReal');
    if (inputPorcentagemLucro) {
        inputPorcentagemLucro.value = porcentagemLucroReal.toFixed(2) + '%';
    } else {
        console.warn("⚠️ Campo #percentReal não encontrado.");
    }

     const inputValorImposto = document.querySelector('#valorImposto');
    if (inputValorImposto) {
        inputValorImposto.value = formatarMoeda(vlrImposto);
    } else {
        console.warn("⚠️ Campo #valorImposto não encontrado.");
    }
}

// function aplicarDescontoEAcrescimo() {
//    console.log ("DESCONTO NO APLICAR DESCONTO E ACRESCIMO",document.querySelector('#Desconto').value, document.querySelector('#percentDesc').value);
//     const campoTotalVenda = document.querySelector('#totalGeralVda');
//     const campoDesconto = document.querySelector('#Desconto');
//     const campoPerCentDesc = document.querySelector('#percentDesc');
//     const campoAcrescimo = document.querySelector('#Acrescimo');
//     const campoPerCentAcresc = document.querySelector('#percentAcresc');
//     const campoValorCliente = document.querySelector('#valorCliente');

//     let totalVenda = desformatarMoeda(campoTotalVenda?.value || '0');
//     if (isNaN(totalVenda)) totalVenda = 0;

//     let valorDesconto = desformatarMoeda(campoDesconto?.value || '0');
//     let perCentDesc = parseFloat((campoPerCentDesc?.value || '0').replace('%', '').replace(',', '.')) || 0;

//     let valorAcrescimo = desformatarMoeda(campoAcrescimo?.value || '0');
//     let perCentAcresc = parseFloat((campoPerCentAcresc?.value || '0').replace('%', '').replace(',', '.')) || 0;


//     if (campoDesconto && totalVenda > 0) {
//         perCentDesc = (valorDesconto / totalVenda) * 100;
//         campoPerCentDesc.value = perCentDesc.toFixed(2) + '%';
//     } else if (campoPerCentDesc && totalVenda > 0) {
//         valorDesconto = totalVenda * (perCentDesc / 100);
//         campoDesconto.value = formatarMoeda(valorDesconto);
//     }    
    
//     // Sincronizar acréscimo
//     if (campoAcrescimo && totalVenda > 0) {
//         perCentAcresc = (valorAcrescimo / totalVenda) * 100;
//         campoPerCentAcresc.value = perCentAcresc.toFixed(2) + '%';
//     } else if (campoPerCentAcresc && totalVenda > 0) {
//         valorAcrescimo = totalVenda * (perCentAcresc / 100);
//         campoAcrescimo.value = formatarMoeda(valorAcrescimo);
//     }    

//     // valorDesconto = desformatarMoeda(campoDesconto?.value || '0');
//     // valorAcrescimo = desformatarMoeda(campoAcrescimo?.value || '0');
//     // Calcular valor final para o cliente
//     const valorFinal = totalVenda - valorDesconto + valorAcrescimo;

//     if (campoValorCliente) {
//         campoValorCliente.value = formatarMoeda(valorFinal);
//     }

    
//     calcularLucro();
//     calcularLucroReal();
// }

function aplicarDescontoEAcrescimo(changedInputId) { // Removendo forceFormat daqui, se não for mais necessário
    if (isRecalculatingGlobalDiscountAcrescimo) {
        console.log("DEBUG GLOBAL: Recálculo global em andamento, ignorando nova chamada.");
        return;
    }

    const campoValorCliente = document.querySelector('#valorCliente');

    isRecalculatingGlobalDiscountAcrescimo = true;

    try {
        // Obter os elementos de desconto/acréscimo globais
        const inputDescontoValor = document.getElementById('Desconto');
        const inputDescontoPercentual = document.getElementById('percentDesc');
        const inputAcrescimoValor = document.getElementById('Acrescimo');
        const inputAcrescimoPercentual = document.getElementById('percentAcresc');

        // É crucial ter o total intermediário atualizado
        recalcularTotaisGerais(); // Garante que TotalIntermediario está atualizado
        const totalBaseParaCalculo = desformatarMoeda(document.getElementById('totalGeralVda')?.value || '0');

        console.log("DEBUG GLOBAL - aplicarDescontoEAcrescimo - INÍCIO");
        console.log("Campo Alterado (ID):", changedInputId);
        console.log("Total Base para Cálculo (Global):", totalBaseParaCalculo);
        console.log("lastEditedGlobalFieldType ANTES DO CÁLCULO:", lastEditedGlobalFieldType);

        let descontoValorAtual = desformatarMoeda(inputDescontoValor?.value || '0');
        let descontoPercentualAtual = desformatarPercentual(inputDescontoPercentual?.value || '0');
        let acrescimoValorAtual = desformatarMoeda(inputAcrescimoValor?.value || '0');
        let acrescimoPercentualAtual = desformatarPercentual(inputAcrescimoPercentual?.value || '0');

        // --- Lógica de sincronização para DESCONTO GLOBAL ---
        if (changedInputId === 'Desconto' || changedInputId === 'percentDesc') {
            if (lastEditedGlobalFieldType === 'valorDesconto') { // Se o usuário editou o valor do desconto
                if (totalBaseParaCalculo > 0) {
                    descontoPercentualAtual = (descontoValorAtual / totalBaseParaCalculo) * 100;
                } else {
                    descontoPercentualAtual = 0;
                }
                if (inputDescontoPercentual) {
                    descontoPercentualAtual = Math.round(descontoPercentualAtual * 100) / 100;
                    inputDescontoPercentual.value = formatarPercentual(descontoPercentualAtual);
                    console.log(`GLOBAL: Atualizando percentDesc para: ${inputDescontoPercentual.value}`);
                }
            } else if (lastEditedGlobalFieldType === 'percentualDesconto') { // Se o usuário editou o percentual do desconto
                descontoValorAtual = totalBaseParaCalculo * (descontoPercentualAtual / 100);
                if (inputDescontoValor) {
                    descontoValorAtual = Math.round(descontoValorAtual * 100) / 100;
                    inputDescontoValor.value = formatarMoeda(descontoValorAtual);
                    console.log(`GLOBAL: Atualizando Desconto para: ${inputDescontoValor.value}`);
                }
            }
        }

        // --- Lógica de sincronização para ACRÉSCIMO GLOBAL ---
        if (changedInputId === 'Acrescimo' || changedInputId === 'percentAcresc') {
            if (lastEditedGlobalFieldType === 'valorAcrescimo') { // Se o usuário editou o valor do acréscimo
                if (totalBaseParaCalculo > 0) {
                    acrescimoPercentualAtual = (acrescimoValorAtual / totalBaseParaCalculo) * 100;
                } else {
                    acrescimoPercentualAtual = 0;
                }
                if (inputAcrescimoPercentual) {
                    acrescimoPercentualAtual = Math.round(acrescimoPercentualAtual * 100) / 100;
                    inputAcrescimoPercentual.value = formatarPercentual(acrescimoPercentualAtual);
                    console.log(`GLOBAL: Atualizando percentAcresc para: ${inputAcrescimoPercentual.value}`);
                }
            } else if (lastEditedGlobalFieldType === 'percentualAcrescimo') { // Se o usuário editou o percentual do acréscimo
                acrescimoValorAtual = totalBaseParaCalculo * (acrescimoPercentualAtual / 100);
                if (inputAcrescimoValor) {
                    acrescimoValorAtual = Math.round(acrescimoValorAtual * 100) / 100;
                    inputAcrescimoValor.value = formatarMoeda(acrescimoValorAtual);
                    console.log(`GLOBAL: Atualizando Acrescimo para: ${inputAcrescimoValor.value}`);
                }
            }
        }

        // Lógica para zerar o campo "parceiro" se o campo alterado for zerado
        let valorDigitadoNoCampoAlterado = 0;
        let campoParceiro = null;

        if (changedInputId === 'Desconto') {
            valorDigitadoNoCampoAlterado = desformatarMoeda(inputDescontoValor?.value || '0');
            campoParceiro = inputDescontoPercentual;
        } else if (changedInputId === 'percentDesc') {
            valorDigitadoNoCampoAlterado = desformatarPercentual(inputDescontoPercentual?.value || '0');
            campoParceiro = inputDescontoValor;
        } else if (changedInputId === 'Acrescimo') {
            valorDigitadoNoCampoAlterado = desformatarMoeda(inputAcrescimoValor?.value || '0');
            campoParceiro = inputAcrescimoPercentual;
        } else if (changedInputId === 'percentAcresc') {
            valorDigitadoNoCampoAlterado = desformatarPercentual(inputAcrescimoPercentual?.value || '0');
            campoParceiro = inputAcrescimoValor;
        }

        if (valorDigitadoNoCampoAlterado === 0 && campoParceiro) {
            console.log("GLOBAL: Campo alterado foi zerado. Zerando campo parceiro.");
            if (changedInputId === 'Desconto' || changedInputId === 'Acrescimo') { // Se alterou valor, zera percentual
                campoParceiro.value = formatarPercentual(0);
            } else { // Se alterou percentual, zera valor
                campoParceiro.value = formatarMoeda(0);
            }
        }

        const valorDesconto = desformatarMoeda(inputDescontoValor?.value || '0');
        const valorAcrescimo = desformatarMoeda(inputAcrescimoValor?.value || '0');

        const valorFinal = totalBaseParaCalculo - valorDesconto + valorAcrescimo;

        console.log("DEBUG GLOBAL - aplicarDescontoEAcrescimo - Valor Final:", valorFinal, 
            "Desconto:", valorDesconto, 
            "Acréscimo:", valorAcrescimo, 
            "Total Base para Cálculo:", totalBaseParaCalculo);

        if (campoValorCliente) {
            campoValorCliente.value = formatarMoeda(valorFinal);
        }


         calcularLucro();
         calcularLucroReal();
        // Chama a função principal de recalcular totais gerais após as atualizações
       // recalcularTotaisGerais();

    } finally {
        isRecalculatingGlobalDiscountAcrescimo = false;
        // O reset de lastEditedGlobalFieldType será controlado pelos listeners blur
        console.log("DEBUG GLOBAL - aplicarDescontoEAcrescimo - FIM.");
    }
}

function calcularImposto(totalDeReferencia, percentualImposto) {
    console.log("CALCULAR IMPOSTO", totalDeReferencia, percentualImposto);
    const campoValorImposto = document.querySelector('#valorImposto'); // Supondo que você terá um campo com id 'valorImposto'
    const campoPercentualImposto = document.querySelector('#percentImposto'); // Supondo que você terá um campo com id 'percentualImposto'

    let valorTotal = parseFloat(totalDeReferencia) || 0;
    let percImposto = parseFloat((percentualImposto || '0').replace('%', '').replace(',', '.')) || 0;

    let valorCalculadoImposto = valorTotal * (percImposto / 100);

    if (campoValorImposto) {
        campoValorImposto.value = formatarMoeda(valorCalculadoImposto);
    }
    calcularLucroReal(); // Recalcula o lucro real após calcular o imposto
}
// document.getElementById("tabela").addEventListener("click", function (e) {
//     const botao = e.target.closest(".deleteBtn");
//     if (!botao) return;
//     const linha = botao.closest("tr");
//     if (linha) removerLinha(linha);
// });
// Exemplo de função para remover a linha
function removerLinha(linha) {
    // Remove a linha da DOM
    linha.remove();

    // Recalcular os totais após a remoção
    
    recalcularTotaisGerais();
  //  aplicarDescontoEAcrescimo();
    aplicarMascaraMoeda();
    calcularLucro();
    calcularLucroReal();
}

function adicionarLinhaOrc() {
    let tabela = document.getElementById("tabela").getElementsByTagName("tbody")[0];
    
    const emptyRow = tabela.querySelector('td[colspan="20"]');
    if (emptyRow) {
        emptyRow.closest('tr').remove();
    } 

    let ufAtual = document.getElementById("ufmontagem")?.value || 'SP';
    const initialDisplayStyle = (!ufAtual || ufAtual.toUpperCase() === 'SP') ? "display: none;" : "display: table-cell;";

   // let novaLinha = tabela.insertRow();    
   let novaLinha = document.createElement('tr');
    // 
    novaLinha.innerHTML = `
        <td style="display: none;"><input type="hidden" class="idItemOrcamento" style="display: none;" value=""></td> <!-- Corrigido: de <th> para <td> e adicionado input hidden -->
        <td style="display: none;"><input type="hidden" class="idFuncao" value=""></td>
        <td style="display: none;"><input type="hidden" class="idEquipamento" value=""></td>
        <td style="display: none;"><input type="hidden" class="idSuprimento" value=""></td>
        <td class="Proposta">
            <div class="checkbox-wrapper-33">
                <label class="checkbox">
                    <input class="checkbox__trigger visuallyhidden" type="checkbox" />
                    <span class="checkbox__symbol">
                        <svg aria-hidden="true" class="icon-checkbox" width="28px" height="28px" viewBox="0 0 28 28" version="1" xmlns="http://www.w3.org/2000/svg">
                            <path d="M4 14l8 7L24 7"></path>
                        </svg>
                    </span>
                    <p class="checkbox__textwrapper"></p>
                </label>
            </div>
        </td>
        <td class="Categoria"><input type="text" class="categoria-input" value=""></td> <!-- Adicionado input para edição -->
        <td class="qtdProduto">
            <div class="add-less">
                <input type="number" class="qtdProduto" min="0" value="0">
                <div class="Bt">
                    <button type="button" class="increment">+</button>
                    <button type="button" class="decrement">-</button>
                </div>
            </div>
        </td>
        
        <td class="produto"><input type="text" class="produto-input" value=""></td> <!-- Adicionado input para edição -->
        <td class="setor"><input type="text" class="setor-input" value=""></td> <!-- Adicionado input para edição -->
     
        <td class="qtdDias">
            <div class="add-less">
                <input type="number" readonly class="qtdDias" min="0" value="0">
            </div>
        </td>
        <td class="Periodo">
            <div class="flatpickr-container">
                <input type="text" class="datas datas-item" data-input required readonly placeholder="Clique para Selecionar">
            </div>
        </td>
        <td class="descontoItem Moeda">
            <div class="Acres-Desc">
                <input type="text" class="ValorInteiros" value="R$ 0,00">
                <input type="text" class="valorPerCent" value="0%">
            </div>
        </td>
        <td class="acrescimoItem Moeda">
            <div class="Acres-Desc">
                <input type="text" class="ValorInteiros" value="R$ 0,00">
                <input type="text" class="valorPerCent" value="0%">
            </div>
        </td>
        <td class="vlrVenda Moeda" data-original-venda="0">${formatarMoeda(0)}</td>
        <td class="totVdaDiaria Moeda">${formatarMoeda(0)}</td>
        <td class="vlrCusto Moeda">${formatarMoeda(0)}</td>
        <td class="totCtoDiaria Moeda">${formatarMoeda(0)}</td>
        <td class="ajdCusto Moeda">
            <div class="Acres-Desc">
                <select class="tpAjdCusto-alimentacao">
                    <option value="select" selected>Alimentação</option>
                    <option value="Almoco">Almoço</option>
                    <option value="Janta">Jantar</option>
                    <option value="2alimentacao">Almoço + jantar</option>
                </select>
            </div>
            <br><span class="valorbanco alimentacao">${formatarMoeda(0)}</span>
        </td>
        <td class="ajdCusto Moeda">
            <div class="Acres-Desc">
                <select class="tpAjdCusto-transporte">
                    <option value="select" selected>Veiculo</option>
                    <option value="Público">Público</option>
                    <option value="Alugado">Alugado</option>
                    <option value="Próprio">Próprio</option>
                </select>
            </div>
            <br><span class="valorbanco transporte">${formatarMoeda(0)}</span>
        </td>
        <td class="totAjdCusto Moeda">${formatarMoeda(0)}</td>
        <td class="extraCampo" style="${initialDisplayStyle}">
            <input type="text" class="hospedagem Moeda" value=" R$ 0,00">
        </td>
        <td class="extraCampo" style="${initialDisplayStyle}">
            <input type="text" class="transporteExtraInput Moeda" value=" R$ 0,00">
        </td>
        <td class="totGeral Moeda">${formatarMoeda(0)}</td>
        <td>
            <div class="Acao">
                <button class="btnApagar" type="button">
                    <svg class="delete-svgIcon" viewBox="0 0 448 512">
                        <path d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z"></path>
                    </svg>
                </button>
            </div>
        </td>
    `;  
    
    // const setorInputCheck = novaLinha.querySelector(".setor-input");
    // console.log(`DEBUG ADICIONAR LINHA: .setor-input na nova linha:`, setorInputCheck ? 'Encontrado!' : 'NÃO ENCONTRADO!');
    // if (setorInputCheck) {
    //     console.log(`DEBUG ADICIONAR LINHA: HTML do td .setor:`, novaLinha.querySelector('td.setor').outerHTML);
    // }
    tabela.insertBefore(novaLinha, tabela.firstChild);

    
    const descontoValorItem = novaLinha.querySelector('.descontoItem .ValorInteiros');
    if (descontoValorItem) {
        descontoValorItem.addEventListener('input', function() {
            console.log("EVENTO INPUT: Campo ValorInteiros de Desconto alterado.");
            lastEditedFieldType = 'valor';
            recalcularDescontoAcrescimo(this, 'desconto', 'valor', this.closest('tr'));
        });
        descontoValorItem.addEventListener('blur', function() {
            console.log("EVENTO BLUR: Campo ValorInteiros de Desconto.");
            this.value = formatarMoeda(desformatarMoeda(this.value));
            // Adiciona um listener para o próximo tick, para verificar o foco.
            // Se o foco não está no campo percentual ou em outro campo da mesma célula, zera.
            setTimeout(() => {
                const campoPercentual = this.closest('.descontoItem').querySelector('.valorPerCent');
                // Se o foco não está no campo parceiro OU se o foco saiu da célula Acres-Desc
                if (document.activeElement !== campoPercentual && !this.closest('.Acres-Desc').contains(document.activeElement)) {
                    lastEditedFieldType = null;
                    console.log("lastEditedFieldType resetado para null após blur do ValorInteiros.");
                }
            }, 0); // Pequeno atraso para o browser resolver o foco
        });
    }

    // Campo Percentual de Desconto
    const descontoPercentualItem = novaLinha.querySelector('.descontoItem .valorPerCent');
    if (descontoPercentualItem) {
        descontoPercentualItem.addEventListener('input', function() {
            console.log("EVENTO INPUT: Campo valorPerCent de Desconto alterado.");
            lastEditedFieldType = 'percentual';
            recalcularDescontoAcrescimo(this, 'desconto', 'percentual', this.closest('tr'));
        });
        descontoPercentualItem.addEventListener('blur', function() {
            console.log("EVENTO BLUR: Campo valorPerCent de Desconto.");
            this.value = formatarPercentual(desformatarPercentual(this.value));
            // Ao sair do percentual, podemos resetar o lastEditedFieldType
            // já que o usuário provavelmente terminou a interação com este par de campos.
            setTimeout(() => {
                // Verifica se o foco não está dentro do mesmo grupo acres-desc
                if (!this.closest('.Acres-Desc').contains(document.activeElement)) {
                    lastEditedFieldType = null;
                    console.log("lastEditedFieldType resetado para null após blur do valorPerCent.");
                }
            }, 0);
        });
    }
    const acrescimoValorItem = novaLinha.querySelector('.acrescimoItem .ValorInteiros');
    if (acrescimoValorItem) {
        acrescimoValorItem.addEventListener('input', function() {
            console.log("EVENTO INPUT: Campo ValorInteiros de Acréscimo alterado.");
            lastEditedFieldType = 'valor';
            recalcularDescontoAcrescimo(this, 'acrescimo', 'valor', this.closest('tr'));
        });
        acrescimoValorItem.addEventListener('blur', function() {
            console.log("EVENTO BLUR: Campo ValorInteiros de Acréscimo.");
            this.value = formatarMoeda(desformatarMoeda(this.value));
            // Adiciona um listener para o próximo tick, para verificar o foco.
            // Se o foco não está no campo percentual ou em outro campo da mesma célula, zera.
            setTimeout(() => {
                const campoPercentual = this.closest('.acrescimoItem').querySelector('.valorPerCent');
                // Se o foco não está no campo parceiro OU se o foco saiu da célula Acres-Desc
                if (document.activeElement !== campoPercentual && !this.closest('.Acres-Desc').contains(document.activeElement)) {
                    lastEditedFieldType = null;
                    console.log("lastEditedFieldType resetado para null após blur do ValorInteiros.");
                }
            }, 0); // Pequeno atraso para o browser resolver o foco
        });
    }

    // Campo Percentual de Desconto
    const acrescimoPercentualItem = novaLinha.querySelector('.acrescimoItem .valorPerCent');
    if (acrescimoPercentualItem) {
        acrescimoPercentualItem.addEventListener('input', function() {
            console.log("EVENTO INPUT: Campo valorPerCent de Acréscimo alterado.");
            lastEditedFieldType = 'percentual';
            recalcularDescontoAcrescimo(this, 'acrescimo', 'percentual', this.closest('tr'));
        });
        acrescimoPercentualItem.addEventListener('blur', function() {
            console.log("EVENTO BLUR: Campo valorPerCent de Acréscimo.");
            this.value = formatarPercentual(desformatarPercentual(this.value));
         
            setTimeout(() => {
                // Verifica se o foco não está dentro do mesmo grupo acres-desc
                if (!this.closest('.Acres-Desc').contains(document.activeElement)) {
                    lastEditedFieldType = null;
                    console.log("lastEditedFieldType resetado para null após blur do valorPerCent.");
                }
            }, 0);
        });
    }

    //Inicializa o Flatpickr para o campo de data na nova linha
    const novoInputData = novaLinha.querySelector('input[type="text"].datas');  
    if (novoInputData) {
        flatpickr(novoInputData, commonFlatpickrOptionsTable);
        console.log("Flatpickr inicializado para nova linha adicionada:", novoInputData);
    } else {
        console.error("Erro: Novo input de data não encontrado na nova linha.");
    }

    const incrementButton = novaLinha.querySelector('.qtdProduto .increment');
    const decrementButton = novaLinha.querySelector('.qtdProduto .decrement');
    const quantityInput = novaLinha.querySelector('.qtdProduto input[type="number"]');

    if (incrementButton && quantityInput) {
        incrementButton.addEventListener('click', function() {
            quantityInput.value = parseInt(quantityInput.value) + 1;
            // Chame sua função de recalcular a linha aqui também, se necessário
            recalcularLinha(this.closest('tr'));
        });
    }

    if (decrementButton && quantityInput) {
        decrementButton.addEventListener('click', function() {
            let currentValue = parseInt(quantityInput.value);
            if (currentValue > 0) { // Garante que não decrementa abaixo de zero
                quantityInput.value = currentValue - 1;
                // Chame sua função de recalcular a linha aqui também, se necessário
                recalcularLinha(this.closest('tr'));
            }
        });
    }  
    

    novaLinha.querySelector('.qtdProduto input')?.addEventListener('input', function() {
        recalcularLinha(this.closest('tr'));
    });
    novaLinha.querySelector('.qtdDias input')?.addEventListener('input', function() {
        recalcularLinha(this.closest('tr'));
    });

    // Event listeners para campos de ajuda de custo (selects)
    novaLinha.querySelector('.tpAjdCusto-alimentacao')?.addEventListener('change', function() {
        recalcularLinha(this.closest('tr'));
    });
    novaLinha.querySelector('.tpAjdCusto-transporte')?.addEventListener('change', function() {
        recalcularLinha(this.closest('tr'));
    });

    // Event listeners para campos extras (hospedagem, transporte)
    novaLinha.querySelector('.hospedagem')?.addEventListener('input', function() {
        recalcularLinha(this.closest('tr'));
    });
    novaLinha.querySelector('.transporteExtraInput')?.addEventListener('input', function() {
        recalcularLinha(this.closest('tr'));
        console.log("INPUT TRANSPORTE ALTERADO NO ADICIONARLINHAORC:", this.value);
    });


    const temPermissaoApagar = temPermissao("Orcamentos", "apagar");
    const deleteButton = novaLinha.querySelector('.btnApagar');
    const idItemInput = novaLinha.querySelector('input.idItemOrcamento'); 


    if (deleteButton) {
        deleteButton.addEventListener('click', async function(event) {
            event.preventDefault(); // Sempre previne o comportamento padrão inicial

            const linhaParaRemover = this.closest('tr');
            const idOrcamentoItem = idItemInput ? idItemInput.value : null; // Pega o ID na hora do clique

            if (!idOrcamentoItem || idOrcamentoItem.trim() === '') {
                // Se NÃO tem ID (linha nova/vazia), SEMPRE permite remoção local
                console.log("DEBUG: Item sem ID. Permitindo exclusão local.");
                Swal.fire({
                    title: "Remover item?",
                    text: "Este item ainda não foi salvo no banco de dados. Deseja apenas removê-lo da lista?",
                    icon: "warning",
                    showCancelButton: true,
                    confirmButtonColor: "#3085d6",
                    cancelButtonColor: "#d33",
                    confirmButtonText: "Sim, remover!",
                    cancelButtonText: "Cancelar"
                }).then((result) => {
                    if (result.isConfirmed) {
                        linhaParaRemover.remove();
                        recalcularTotaisGerais();
                        calcularLucro();
                        Swal.fire("Removido!", "O item foi removido da lista.", "success");
                    }
                });
            } else if (!temPermissaoApagar) {
                // Se TEM ID, mas o usuário NÃO tem permissão para apagar
                console.warn("Usuário não tem permissão para apagar itens de orçamento. Exibindo Swal.");
                Swal.fire({
                    title: "Acesso Negado!",
                    text: "Você não tem permissão para apagar itens de orçamento que já estão salvos.",
                    icon: "error",
                    confirmButtonText: "Entendi"
                });
            } else {
                // Se TEM ID E o usuário TEM permissão para apagar (lógica original)
                let currentItemProduct = linhaParaRemover.querySelector('.produto-input')?.value || "este item";
                if (!currentItemProduct || currentItemProduct.trim() === '') {
                     const produtoCell = linhaParaRemover.querySelector('.produto');
                     if (produtoCell) {
                         currentItemProduct = produtoCell.textContent.trim();
                     }
                }
                
                const { isConfirmed } = await Swal.fire({
                    title: `Tem Certeza que deseja EXCLUIR o item "${currentItemProduct}" ?`,
                    text: "Você não poderá reverter esta ação!",
                    icon: "warning",
                    showCancelButton: true,
                    confirmButtonColor: "#3085d6",
                    cancelButtonColor: "#d33",
                    confirmButtonText: "Sim, deletar!",
                    cancelButtonText: "Cancelar"
                });

                if (isConfirmed) {
                    try {
                        const idOrcamentoPrincipal = document.getElementById('idOrcamento').value;
                        console.log("IDS ORCAMENTO:", idOrcamentoPrincipal, idOrcamentoItem);   
                       await fetchComToken(`/orcamentos/${idOrcamentoPrincipal}/itens/${idOrcamentoItem}`, {
                            method: 'DELETE',
                            headers: {
                                'Content-Type': 'application/json'
                            }
                        });                        

                        linhaParaRemover.remove(); 
                        recalcularTotaisGerais(); 
                        calcularLucro(); 

                        Swal.fire("Deletado!", "O item foi removido com sucesso.", "success");

                    } catch (error) {
                        console.error("Erro ao deletar item:", error);
                        Swal.fire("Erro!", `Não foi possível deletar o item: ${error.message}`, "error");
                    }
                }
            }
        });
        
        if (!temPermissaoApagar) {        
            deleteButton.classList.add("btnDesabilitado");
            deleteButton.title = "Você não tem permissão para apagar itens de orçamento que já estão salvos.";
        }
    }
    
    recalcularLinha(novaLinha);
    recalcularTotaisGerais(); 
    aplicarMascaraMoeda(); 
    limparSelects();  
}

function adicionarLinhaAdicional() {
    let tabela = document.getElementById("tabela").getElementsByTagName("tbody")[0];

    let ufAtual = document.getElementById("ufmontagem")?.value || 'SP';
    const initialDisplayStyle = (!ufAtual || ufAtual.toUpperCase() === 'SP') ? "display: none;" : "display: table-cell;";

    let novaLinha = tabela.insertRow();
    novaLinha.classList.add("liberada");     // aplica nova cor
    novaLinha.innerHTML = `
        <td style="display: none;"><input type="hidden" class="idItemOrcamento" style="display: none;" value=""></td> <!-- Corrigido: de <th> para <td> e adicionado input hidden -->
        <td style="display: none;"><input type="hidden" class="idFuncao" value=""></td>
        <td style="display: none;"><input type="hidden" class="idEquipamento" value=""></td>
        <td style="display: none;"><input type="hidden" class="idSuprimento" value=""></td>
        <td class="Proposta">
            <div class="checkbox-wrapper-33">
                <label class="checkbox">
                    <input class="checkbox__trigger visuallyhidden" type="checkbox" />
                    <span class="checkbox__symbol">
                        <svg aria-hidden="true" class="icon-checkbox" width="28px" height="28px" viewBox="0 0 28 28" version="1" xmlns="http://www.w3.org/2000/svg">
                            <path d="M4 14l8 7L24 7"></path>
                        </svg>
                    </span>
                    <p class="checkbox__textwrapper"></p>
                </label>
            </div>
        </td>
        <td class="Categoria"><input type="text" class="categoria-input" value=""></td> <!-- Adicionado input para edição -->
        <td class="qtdProduto">
            <div class="add-less">
                <input type="number" class="qtdProduto" min="0" value="0">
                <div class="Bt">
                    <button type="button" class="increment">+</button>
                    <button type="button" class="decrement">-</button>
                </div>
            </div>
        </td>
        <td class="produto"><input type="text" class="produto-input" value=""></td> <!-- Adicionado input para edição -->
        <td class="setor"><input type="text" class="setor-input" value=""></td> <!-- Adicionado input para edição -->
       
        <td class="qtdDias">
            <div class="add-less">
                <input type="number" readonly class="qtdDias" min="0" value="0">
            </div>
        </td>
        <td class="Periodo">
            <div class="flatpickr-container">
                <input type="text" class="datas datas-item" data-input required readonly placeholder="Clique para Selecionar">
            </div>
        </td>
        <td class="descontoItem Moeda">
            <div class="Acres-Desc">
                <input type="text" class="ValorInteiros" value="R$ 0,00">
                <input type="text" class="valorPerCent" value="0%">
            </div>
        </td>
        <td class="acrescimoItem Moeda">
            <div class="Acres-Desc">
                <input type="text" class="ValorInteiros" value="R$ 0,00">
                <input type="text" class="valorPerCent" value="0%">
            </div>
        </td>
        <td class="vlrVenda Moeda" data-original-venda="0">${formatarMoeda(0)}</td>
        <td class="totVdaDiaria Moeda">${formatarMoeda(0)}</td>
        <td class="vlrCusto Moeda">${formatarMoeda(0)}</td>
        <td class="totCtoDiaria Moeda">${formatarMoeda(0)}</td>
        <td class="ajdCusto Moeda">
            <div class="Acres-Desc">
                <select class="tpAjdCusto-alimentacao">
                    <option value="select" selected>Alimentação</option>
                    <option value="Almoco">Almoço</option>
                    <option value="Janta">Jantar</option>
                    <option value="2alimentacao">Almoço + jantar</option>
                </select>
            </div>
            <br><span class="valorbanco alimentacao">${formatarMoeda(0)}</span>
        </td>
        <td class="ajdCusto Moeda">
            <div class="Acres-Desc">
                <select class="tpAjdCusto-transporte">
                    <option value="select" selected>Veiculo</option>
                    <option value="Público">Público</option>
                    <option value="Alugado">Alugado</option>
                    <option value="Próprio">Próprio</option>
                </select>
            </div>
            <br><span class="valorbanco transporte">${formatarMoeda(0)}</span>
        </td>
        <td class="totAjdCusto Moeda">${formatarMoeda(0)}</td>
        <td class="extraCampo" style="display: none;">
            <input type="text" class="hospedagem" value=" R$ 0,00">
        </td>
        <td class="extraCampo" style="display: none;">
            <input type="text" class="transporteExtraInput" value=" R$ 0,00">
        </td>
        <td class="totGeral Moeda">${formatarMoeda(0)}</td>
        <td>
            <div class="Acao">
                <button class="btnApagar" type="button">
                    <svg class="delete-svgIcon" viewBox="0 0 448 512">
                        <path d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z"></path>
                    </svg>
                </button>
            </div>
        </td>
    `;  

    
    // // --- ADICIONE ESTE LOG AQUI ---
    // const setorInputCheck = novaLinha.querySelector(".setor-input");
    // console.log(`DEBUG ADICIONAR LINHA: .setor-input na nova linha:`, setorInputCheck ? 'Encontrado!' : 'NÃO ENCONTRADO!');
    // if (setorInputCheck) {
    //     console.log(`DEBUG ADICIONAR LINHA: HTML do td .setor:`, novaLinha.querySelector('td.setor').outerHTML);
    // }
    // // --- FIM DO LOG ---
    // //Inicializa o Flatpickr para o campo de data na nova linha

    const descontoValorItem = novaLinha.querySelector('.descontoItem .ValorInteiros');
    if (descontoValorItem) {
        descontoValorItem.addEventListener('input', function() {
            console.log("EVENTO INPUT: Campo ValorInteiros de Desconto alterado.");
            lastEditedFieldType = 'valor';
            recalcularDescontoAcrescimo(this, 'desconto', 'valor', this.closest('tr'));
        });
        descontoValorItem.addEventListener('blur', function() {
            console.log("EVENTO BLUR: Campo ValorInteiros de Desconto.");
            this.value = formatarMoeda(desformatarMoeda(this.value));
            // Adiciona um listener para o próximo tick, para verificar o foco.
            // Se o foco não está no campo percentual ou em outro campo da mesma célula, zera.
            setTimeout(() => {
                const campoPercentual = this.closest('.descontoItem').querySelector('.valorPerCent');
                // Se o foco não está no campo parceiro OU se o foco saiu da célula Acres-Desc
                if (document.activeElement !== campoPercentual && !this.closest('.Acres-Desc').contains(document.activeElement)) {
                    lastEditedFieldType = null;
                    console.log("lastEditedFieldType resetado para null após blur do ValorInteiros.");
                }
            }, 0); // Pequeno atraso para o browser resolver o foco
        });
    }

    // Campo Percentual de Desconto
    const descontoPercentualItem = novaLinha.querySelector('.descontoItem .valorPerCent');
    if (descontoPercentualItem) {
        descontoPercentualItem.addEventListener('input', function() {
            console.log("EVENTO INPUT: Campo valorPerCent de Desconto alterado.");
            lastEditedFieldType = 'percentual';
            recalcularDescontoAcrescimo(this, 'desconto', 'percentual', this.closest('tr'));
        });
        descontoPercentualItem.addEventListener('blur', function() {
            console.log("EVENTO BLUR: Campo valorPerCent de Desconto.");
            this.value = formatarPercentual(desformatarPercentual(this.value));
            // Ao sair do percentual, podemos resetar o lastEditedFieldType
            // já que o usuário provavelmente terminou a interação com este par de campos.
            setTimeout(() => {
                // Verifica se o foco não está dentro do mesmo grupo acres-desc
                if (!this.closest('.Acres-Desc').contains(document.activeElement)) {
                    lastEditedFieldType = null;
                    console.log("lastEditedFieldType resetado para null após blur do valorPerCent.");
                }
            }, 0);
        });
    }
    const acrescimoValorItem = novaLinha.querySelector('.acrescimoItem .ValorInteiros');
    if (acrescimoValorItem) {
        acrescimoValorItem.addEventListener('input', function() {
            console.log("EVENTO INPUT: Campo ValorInteiros de Acréscimo alterado.");
            lastEditedFieldType = 'valor';
            recalcularDescontoAcrescimo(this, 'acrescimo', 'valor', this.closest('tr'));
        });
        acrescimoValorItem.addEventListener('blur', function() {
            console.log("EVENTO BLUR: Campo ValorInteiros de Acréscimo.");
            this.value = formatarMoeda(desformatarMoeda(this.value));
            // Adiciona um listener para o próximo tick, para verificar o foco.
            // Se o foco não está no campo percentual ou em outro campo da mesma célula, zera.
            setTimeout(() => {
                const campoPercentual = this.closest('.acrescimoItem').querySelector('.valorPerCent');
                // Se o foco não está no campo parceiro OU se o foco saiu da célula Acres-Desc
                if (document.activeElement !== campoPercentual && !this.closest('.Acres-Desc').contains(document.activeElement)) {
                    lastEditedFieldType = null;
                    console.log("lastEditedFieldType resetado para null após blur do ValorInteiros.");
                }
            }, 0); // Pequeno atraso para o browser resolver o foco
        });
    }

    // Campo Percentual de Desconto
    const acrescimoPercentualItem = novaLinha.querySelector('.acrescimoItem .valorPerCent');
    if (acrescimoPercentualItem) {
        acrescimoPercentualItem.addEventListener('input', function() {
            console.log("EVENTO INPUT: Campo valorPerCent de Acréscimo alterado.");
            lastEditedFieldType = 'percentual';
            recalcularDescontoAcrescimo(this, 'acrescimo', 'percentual', this.closest('tr'));
        });
        acrescimoPercentualItem.addEventListener('blur', function() {
            console.log("EVENTO BLUR: Campo valorPerCent de Acréscimo.");
            this.value = formatarPercentual(desformatarPercentual(this.value));
            // Ao sair do percentual, podemos resetar o lastEditedFieldType
            // já que o usuário provavelmente terminou a interação com este par de campos.
            setTimeout(() => {
                // Verifica se o foco não está dentro do mesmo grupo acres-desc
                if (!this.closest('.Acres-Desc').contains(document.activeElement)) {
                    lastEditedFieldType = null;
                    console.log("lastEditedFieldType resetado para null após blur do valorPerCent.");
                }
            }, 0);
        });
    }

    const novoInputData = novaLinha.querySelector('input[type="text"].datas');  
    if (novoInputData) {
        flatpickr(novoInputData, commonFlatpickrOptionsTable);
        console.log("Flatpickr inicializado para nova linha adicionada:", novoInputData);
    } else {
        console.error("Erro: Novo input de data não encontrado na nova linha.");
    }

    const incrementButton = novaLinha.querySelector('.qtdProduto .increment');
    const decrementButton = novaLinha.querySelector('.qtdProduto .decrement');
    const quantityInput = novaLinha.querySelector('.qtdProduto input[type="number"]');

    if (incrementButton && quantityInput) {
        incrementButton.addEventListener('click', function() {
            quantityInput.value = parseInt(quantityInput.value) + 1;
            // Chame sua função de recalcular a linha aqui também, se necessário
            recalcularLinha(this.closest('tr'));
        });
    }

    if (decrementButton && quantityInput) {
        decrementButton.addEventListener('click', function() {
            let currentValue = parseInt(quantityInput.value);
            if (currentValue > 0) { // Garante que não decrementa abaixo de zero
                quantityInput.value = currentValue - 1;
                // Chame sua função de recalcular a linha aqui também, se necessário
                recalcularLinha(this.closest('tr'));
            }
        });
    }
    
    // novaLinha.querySelector('.descontoItem .ValorInteiros')?.addEventListener('blur', function(event) { // MUDANÇA: 'input' para 'blur'
    //     console.log("DEBUG: Blur no campo ValorInteiros de Desconto! Input:", this.value); // Adicione este log
    //     recalcularDescontoAcrescimo(this, 'desconto', 'valor', this.closest('tr'));
    // });

    // novaLinha.querySelector('.descontoItem .valorPerCent')?.addEventListener('blur', function(event) { // MUDANÇA: 'input' para 'blur'
    //     console.log("DEBUG: Blur no campo valorPerCent de Desconto! Input:", this.value); // Adicione este log
    //     recalcularDescontoAcrescimo(this, 'desconto', 'percentual', this.closest('tr'));
    // });
    // novaLinha.querySelector('.acrescimoItem .ValorInteiros')?.addEventListener('blur', function(event) { // MUDANÇA: 'input' para 'blur'
    //     console.log("DEBUG: Blur no campo ValorInteiros de Acrescimo! Input:", this.value); // Adicione este log
    //     recalcularDescontoAcrescimo(this, 'acrescimo', 'valor', this.closest('tr'));
    // });
    // novaLinha.querySelector('.acrescimoItem .valorPerCent')?.addEventListener('blur', function(event) { // MUDANÇA: 'input' para 'blur'
    //     console.log("DEBUG: Blur no campo valorPerCent de Acrescimo! Input:", this.value); // Adicione este log
    //     recalcularDescontoAcrescimo(this, 'acrescimo', 'percentual', this.closest('tr'));
    // });

    novaLinha.querySelector('.qtdProduto input')?.addEventListener('input', function() {
        recalcularLinha(this.closest('tr'));
    });
    novaLinha.querySelector('.qtdDias input')?.addEventListener('input', function() {
        recalcularLinha(this.closest('tr'));
    });

    // Event listeners para campos de ajuda de custo (selects)
    novaLinha.querySelector('.tpAjdCusto-alimentacao')?.addEventListener('change', function() {
        recalcularLinha(this.closest('tr'));
    });
    novaLinha.querySelector('.tpAjdCusto-transporte')?.addEventListener('change', function() {
        recalcularLinha(this.closest('tr'));
    });

    // Event listeners para campos extras (hospedagem, transporte)
    novaLinha.querySelector('.hospedagem')?.addEventListener('input', function() {
        recalcularLinha(this.closest('tr'));
    });
    novaLinha.querySelector('.transporteExtraInput')?.addEventListener('input', function() {
        recalcularLinha(this.closest('tr'));
        console.log("INPUT TRANSPORTE ALTERADO NO ADICIONARLINHAORC:", this.value);
    });


    

    const temPermissaoApagar = temPermissao("Orcamentos", "apagar");
    const deleteButton = novaLinha.querySelector('.btnApagar');
    const idItemInput = novaLinha.querySelector('input.idItemOrcamento'); // Obtém o input de ID
    const idFuncaoInput = novaLinha.querySelector('input.idFuncao');

    if (deleteButton) {
        deleteButton.addEventListener('click', async function(event) {
            event.preventDefault(); // Sempre previne o comportamento padrão inicial

            const linhaParaRemover = this.closest('tr');
            const idOrcamentoItem = idItemInput ? idItemInput.value : null; // Pega o ID na hora do clique

            if (!idOrcamentoItem || idOrcamentoItem.trim() === '') {
                // Se NÃO tem ID (linha nova/vazia), SEMPRE permite remoção local
                console.log("DEBUG: Item sem ID. Permitindo exclusão local.");
                Swal.fire({
                    title: "Remover item?",
                    text: "Este item ainda não foi salvo no banco de dados. Deseja apenas removê-lo da lista?",
                    icon: "warning",
                    showCancelButton: true,
                    confirmButtonColor: "#3085d6",
                    cancelButtonColor: "#d33",
                    confirmButtonText: "Sim, remover!",
                    cancelButtonText: "Cancelar"
                }).then((result) => {
                    if (result.isConfirmed) {
                        linhaParaRemover.remove();
                        recalcularTotaisGerais();
                        calcularLucro();
                        Swal.fire("Removido!", "O item foi removido da lista.", "success");
                    }
                });
            } else if (!temPermissaoApagar) {
                // Se TEM ID, mas o usuário NÃO tem permissão para apagar
                console.warn("Usuário não tem permissão para apagar itens de orçamento. Exibindo Swal.");
                Swal.fire({
                    title: "Acesso Negado!",
                    text: "Você não tem permissão para apagar itens de orçamento que já estão salvos.",
                    icon: "error",
                    confirmButtonText: "Entendi"
                });
            } else {
                // Se TEM ID E o usuário TEM permissão para apagar (lógica original)
                let currentItemProduct = linhaParaRemover.querySelector('.produto-input')?.value || "este item";
                if (!currentItemProduct || currentItemProduct.trim() === '') {
                     const produtoCell = linhaParaRemover.querySelector('.produto');
                     if (produtoCell) {
                         currentItemProduct = produtoCell.textContent.trim();
                     }
                }
                
                const { isConfirmed } = await Swal.fire({
                    title: `Tem Certeza que deseja EXCLUIR o item "${currentItemProduct}" ?`,
                    text: "Você não poderá reverter esta ação!",
                    icon: "warning",
                    showCancelButton: true,
                    confirmButtonColor: "#3085d6",
                    cancelButtonColor: "#d33",
                    confirmButtonText: "Sim, deletar!",
                    cancelButtonText: "Cancelar"
                });

                if (isConfirmed) {
                    try {
                        const idOrcamentoPrincipal = document.getElementById('idOrcamento').value;
                        console.log("IDS ORCAMENTO:", idOrcamentoPrincipal, idOrcamentoItem);   
                       await fetchComToken(`/orcamentos/${idOrcamentoPrincipal}/itens/${idOrcamentoItem}`, {
                            method: 'DELETE',
                            headers: {
                                'Content-Type': 'application/json'
                            }
                        });                        

                        linhaParaRemover.remove(); 
                        recalcularTotaisGerais(); 
                        calcularLucro(); 

                        Swal.fire("Deletado!", "O item foi removido com sucesso.", "success");

                    } catch (error) {
                        console.error("Erro ao deletar item:", error);
                        Swal.fire("Erro!", `Não foi possível deletar o item: ${error.message}`, "error");
                    }
                }
            }
        });

        // Aplica classe de desabilitado visualmente se não tiver permissão para apagar itens EXISTENTES
        // Isso é feito FORA do listener, para que a aparência seja aplicada imediatamente
        if (!temPermissaoApagar) {
             // NÃO ADICIONE disabled=true AQUI, APENAS A CLASSE VISUAL
            deleteButton.classList.add("btnDesabilitado");
            deleteButton.title = "Você não tem permissão para apagar itens de orçamento que já estão salvos.";
        }
    }
   
    recalcularTotaisGerais(); 
    aplicarMascaraMoeda();
    limparSelects();  
}

function removerLinhaOrc(botao) {
    let linha = botao.closest("tr"); // Encontra a linha mais próxima
    removerLinha(linha); // Remove a linha
}


function initializeAllFlatpickrsInModal() {
//    console.log("Inicializando Flatpickr para todos os campos de data no modal...");

for (const id in flatpickrInstances) {
        if (flatpickrInstances.hasOwnProperty(id)) {
            const instance = flatpickrInstances[id];
            if (instance && typeof instance.destroy === 'function') {
                instance.destroy();
                console.log(`Flatpickr global #${id} destruído.`);
            }
        }
    }
    flatpickrInstances = {}; // Zera o objeto após destruir


    // Destruir Flatpickrs das linhas da tabela (os que você gerencia em flatpickrInstancesOrcamento)
    if (flatpickrInstancesOrcamento && flatpickrInstancesOrcamento.length > 0) {
        flatpickrInstancesOrcamento.forEach(instance => {
            if (instance && typeof instance.destroy === 'function') {
                instance.destroy();
                console.log("Flatpickr de linha da tabela destruído:", instance.element);
            }
        });
        flatpickrInstancesOrcamento = []; // Zera o array após destruir
    }


    // --- PASSO 2: Inicializar/Recriar todas as instâncias Flatpickr ---

    // Inicializa os campos globais
    const dateInputIds = [
        'periodoInfraMontagem', 'periodoMontagem', 'periodoMarcacao',
        'periodoRealizacao', 'periodoDesmontagem', 'periodoDesmontagemInfra'
    ];
    dateInputIds.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            // Sempre crie uma nova instância aqui, pois as antigas foram destruídas
            const picker = flatpickr(element, commonFlatpickrOptions);
            flatpickrInstances[id] = picker;
            console.log(`Flatpickr inicializado para campo global #${id}`);
        } else {
            console.warn(`Elemento com ID '${id}' não encontrado para inicialização do Flatpickr.`);
        }
    });

    // Inicializa Flatpickr para os inputs '.datas' que JÁ EXISTEM na tabela
    // (Isso será executado quando o modal é aberto e a tabela já está renderizada com itens)
    const tabela = document.getElementById("tabela");
    if (tabela) {
        // Seleciona os inputs type="text" visíveis, não os hidden que o Flatpickr pode criar
        const dataInputs = tabela.querySelectorAll('input[type="text"].datas-item'); // Use '.datas-item' para ser mais específico
        dataInputs.forEach(input => {
            const fpInstance = flatpickr(input, commonFlatpickrOptionsTable); // Use commonFlatpickrOptionsTable
            flatpickrInstancesOrcamento.push(fpInstance); // Adiciona a nova instância ao array
            console.log("Flatpickr inicializado para input da tabela (existente):", input);
        });
    } else {
        console.warn("Tabela de orçamento não encontrada para inicializar Flatpickrs de linha.");
    }

    console.log("✅ Todos os Flatpickrs no modal de orçamento inicializados/reinicializados.");



    // // 1. Inicializa os campos globais com a função já existente
    // inicializarFlatpickrsGlobais(); // Chamamos a função que você já tinha

    // // 2. Inicializa Flatpickr para os inputs '.datas' que JÁ EXISTEM na tabela no carregamento inicial do modal
    // document.querySelectorAll(".datas").forEach(input => {
    //     if (!input._flatpickr) { // Evita reinicialização
    //         flatpickr(input, commonFlatpickrOptions);
    //         console.log("Flatpickr inicializado para input da tabela (existente):", input);
    //     } else {
    //         console.log("Flatpickr já está inicializado para input da tabela (existente), pulando.");
    //     }
    // });
}
initializeAllFlatpickrsInModal = initializeAllFlatpickrsInModal;

// Crie esta nova função
function inicializarFlatpickrsGlobais() {
//console.log("Inicializando Flatpickr para todos os campos de data (globais)...");
    const dateInputIds = [
        'periodoInfraMontagem',
        'periodoMontagem',
        'periodoMarcacao',
        'periodoRealizacao',
        'periodoDesmontagem',
        'periodoDesmontagemInfra'
    ];

    dateInputIds.forEach(id => { 
        const element = document.getElementById(id);
        if (element) {
            if (!element._flatpickr) { 
                const picker = flatpickr(element, commonFlatpickrOptions);               
                flatpickrInstances[id] = picker; 
              //  console.log(`Flatpickr inicializado e salvo para campo global #${id}`);
            } else {
            //    console.log(`Flatpickr para campo global #${id} já estava inicializado.`);
               
                flatpickrInstances[id] = element._flatpickr; 
            }
        } else {
            console.warn(`Elemento com ID '${id}' não encontrado para inicialização do Flatpickr.`);
        }
    });
}

// No seu Orcamentos.js

async function gerarObservacoesProposta(linhas) {
    const obsTextarea = document.getElementById("ObservacaoProposta");
    if (!obsTextarea) return;

    const textoAnterior = obsTextarea.value.trim(); // preserva o que já estava
    const linhasProcessadas = new Set();

    let novoTexto = "";

    for (const linha of linhas) {
        const produtoEl = linha.querySelector('.produto');
        const produto = produtoEl?.innerText?.trim();
        if (!produto) continue;

        const qtdDias = linha.querySelector('.qtdDias input')?.value?.trim();
        const qtdItens = linha.querySelector('.qtdProduto input')?.value?.trim();
        const datasRaw = linha.querySelector('.datas')?.value?.trim().replace(" to ", " até: ") || "";

        const idUnico = `${produto}_${qtdItens}_${qtdDias}_${datasRaw}`;
        if (linhasProcessadas.has(idUnico)) {
            console.log(`🔁 Linha duplicada detectada (${produto}). Pulando.`);
            continue;
        }
        linhasProcessadas.add(idUnico);

        console.log(`🔎 Verificando produto: ${produto}`);

        let obs = "";
        try {
            const funcao = await fetchComToken(`/orcamentos/obsfuncao?nome=${encodeURIComponent(produto)}`);
            obs = funcao?.obsfuncao?.trim();
        } catch (erro) {
            console.warn(`❌ Erro ao buscar observação da função '${produto}':`, erro);
        }

        if (!obs) continue;

        let resumoTexto = "";
        if (qtdItens !== '0') {
            resumoTexto = `${qtdItens} ${produto}`;
            if (qtdDias !== '0') {
                resumoTexto += ` – atendimento por ${qtdDias} dias – iniciando de: ${datasRaw}`;
            }
        }

        const textoFormatado = [
            `${produto.toUpperCase()}`,
            '',
            obs,
            '',
            resumoTexto
        ].join('\n');

        novoTexto += textoFormatado + '\n\n';
    }

    // Junta o texto antigo + novo, separados por duas quebras se necessário
    obsTextarea.value = [textoAnterior, novoTexto.trim()].filter(Boolean).join('\n\n');
}

// Certifique-se que linhaCounter está definida globalmente no topo do seu arquivo
let linhaCounter = 0;

function inicializarFlatpickr(inputElement, onDateChangeCallback = null) {
  //  console.log("Inicializando Flatpickr para o input:", inputElement);
    if (!inputElement) {
        console.error("Elemento de input inválido para inicializar Flatpickr.");
        return;
    }

    // Se já existe uma instância Flatpickr para este input, destrua-a
    if (inputElement._flatpickr) {
        inputElement._flatpickr.destroy();
        delete flatpickrInstances[inputElement.id]; // Remova do nosso gerenciador também
    }

    const config = {
        mode: "range",
        dateFormat: "d/m/Y", // Formato dia/mês/ano
        locale: flatpickr.l10ns.pt, // Importante: use 'pt_br' para português do Brasil
        altInput: true, // Se você quer o input formatado de um jeito e o valor real de outro
        altFormat: "d/m/Y", // Formato visível para o usuário
        enableTime: false,
        noCalendar: false,
        // O `appendTo` é crucial para modais
        appendTo: inputElement.closest('.modal-content') || document.body, // Se não estiver em modal, anexa ao body
        positionElement: inputElement,
    };

    // Adiciona o callback onChange SOMENTE se ele for fornecido
    if (onDateChangeCallback) {
        config.onChange = function(selectedDates, dateStr, instance) {
            onDateChangeCallback(selectedDates, dateStr, instance);
        };
    }

    // Cria e armazena a instância Flatpickr
    inputElement._flatpickr = flatpickr(inputElement, config);
    flatpickrInstances[inputElement.id] = inputElement._flatpickr; // Armazena no nosso objeto
    console.log(`Flatpickr inicializado para #${inputElement.id} com config:`, config); // Adicionado para depuração
}

function atualizarQtdDias(input, selectedDatesArray) {
  console.log("⏱️ Campo de datas alterado:", input.value);

  var linha = input.closest('tr');
  var inputQtdDias = linha.querySelector('input.qtdDias');
  var datas = input.value.split(" to ");
  console.log("📆 Datas selecionadas:", datas);

  let diffDias = 0;

     if (selectedDatesArray && selectedDatesArray.length === 2) {
        const startDate = selectedDatesArray[0];
        const endDate = selectedDatesArray[1];

        // Verifique se as datas são válidas
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            console.error("Datas selecionadas inválidas.");
            diffDias = "-"; // Ou outro indicador de erro
        } else if (endDate >= startDate) {
            const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
            // +1 para incluir o dia de início e o dia de fim no cálculo
            diffDias = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        } else {
            diffDias = "-"; // Data final é anterior à data inicial
        }
    } else if (selectedDatesArray && selectedDatesArray.length === 1 && selectedDatesArray[0]) {
        // Apenas um dia selecionado (caso mode não seja range ou o usuário selecione apenas um dia)
        if (!isNaN(selectedDatesArray[0].getTime())) {
            diffDias = 1;
        } else {
            diffDias = "-";
        }
    } else {
        // Nenhuma data selecionada ou seleção incompleta
        diffDias = 0; // Ou "-" se preferir um valor que indica vazio
    }

    inputQtdDias.value = diffDias;
    console.log("📤 Valor final enviado para input.qtdDias:", inputQtdDias.value);

    // Atualiza a linha automaticamente
    if (typeof recalcularLinha === 'function') {
        console.log("🔁 Chamando recalcularLinha...");
        recalcularLinha(linha);
    } else {
        console.warn("⚠️ Função recalcularLinha não está definida.");
    }
}


function atualizarUFOrc(selectLocalMontagem) {
     console.log("Função atualizarUF chamada");
     console.log("Lista atual de locais antes da busca:", locaisDeMontagem);

    let selectedOption = selectLocalMontagem.options[selectLocalMontagem.selectedIndex]; // Obtém a opção selecionada
    let uf = selectedOption.getAttribute("data-ufmontagem"); // Obtém a UF
   // let idLocal = selectLocalMontagem.value; 

    console.log("UF selecionada do atualizarUF:", uf); // Verifica se o valor está correto
    
    const ufSelecionada = uf; // Obtém o valor da UF selecionada
    
    let inputUF = document.getElementById("ufmontagem"); 

    if (inputUF) {        
        inputUF.value = uf; // Atualiza o campo de input    
        
    } else {
        console.error("Campo 'ufmontagem' não encontrado!");
    }

    const colunasExtras = document.querySelectorAll(".extraColuna"); // Colunas do cabeçalho
    const camposExtras = document.querySelectorAll(".extraCampo"); // Campos na tabela
    
    console.log("UF Selecionada.", ufSelecionada);
    
    if (ufSelecionada !== "SP") {
        console.log("UF diferente de SP, exibindo campos extras.");
        colunasExtras.forEach(col => col.style.display = "table-cell"); // Exibe cabeçalho
        camposExtras.forEach(campo => campo.style.display = "table-cell"); // Exibe campos
    } else {
        // console.log("UF é SP, ocultando campos extras.");
        colunasExtras.forEach(col => col.style.display = "none"); // Oculta cabeçalho
        camposExtras.forEach(campo => campo.style.display = "none"); // Oculta campos
    }
   
}

function atualizaProdutoOrc(event) {
    // console.log("Função atualizaProduto chamada", Categoria);

    let select = event.target; // Qual select foi alterado (Funcao, equipamento ou suprimento)

    console.log("Select alterado:", select); // Log do select alterado

    let selectedOption = select.options[select.selectedIndex]; // Opção selecionada
    let valorSelecionado = selectedOption.value;

    console.log("Valor :", valorSelecionado);
  

    // Obtém as informações do item selecionado
    let produtoSelecionado = selectedOption.getAttribute("data-descproduto");
    let idFuncaoSelecionado = idFuncao;
 

    console.log("Produto selecionado:", produtoSelecionado); // Log do produto selecionado
    // Log do pavilhão selecionado
    let vlrCusto = selectedOption.getAttribute("data-cto");
    let vlrVenda = selectedOption.getAttribute("data-vda");

    const vlrCustoNumerico = parseFloat(vlrCusto) || 0;
    const vlrVendaNumerico = parseFloat(vlrVenda) || 0;

    let tabela = document.getElementById("tabela");
    if (!tabela) return; // Se a tabela não existir, sai da função

    //let ultimaLinha = tabela.querySelector("tbody tr:last-child");
    let ultimaLinha = tabela.querySelector("tbody tr:first-child");
    if (ultimaLinha) {

        
        let celulaProduto = ultimaLinha.querySelector(".produto");
        let celulaCategoria = ultimaLinha.querySelector(".Categoria");
        let celulaIdFuncao = ultimaLinha.querySelector(".idFuncao");
        let celulaIdEquipamento = ultimaLinha.querySelector(".idEquipamento");
        let celulaIdSuprimento = ultimaLinha.querySelector(".idSuprimento");
        
        if (celulaCategoria && Categoria !== "Pavilhao") {
            celulaCategoria.textContent = Categoria;
        }       

        console.log(" A categoria é :", Categoria)
       

        if (celulaProduto && (celulaProduto.textContent === "" || select.classList.contains("idEquipamento") || select.classList.contains("idSuprimento") || select.classList.contains("idFuncao"))) {
            celulaProduto.textContent = produtoSelecionado;
           
            if (select.classList.contains("idFuncao"))
            {
                celulaIdFuncao.textContent = valorSelecionado;
                console.log(" produto escolhido foi:", produtoSelecionado, "Funcao: ", select.classList.contains("idFuncao"), "Equipamento: ", select.classList.contains("idEquipamento"), "Suprimento: ",select.classList.contains("idSuprimento"), celulaIdFuncao);
            }     
            
            if (select.classList.contains("idEquipamento"))
            {
                celulaIdEquipamento.textContent = valorSelecionado;
                console.log(" produto escolhido foi:", produtoSelecionado, "Funcao: ", select.classList.contains("idFuncao"), "Equipamento: ", select.classList.contains("idEquipamento"), "Suprimento: ",select.classList.contains("idSuprimento"));
            
            }
            if (select.classList.contains("idSuprimento"))
            {
                celulaIdSuprimento.textContent = valorSelecionado;
                console.log(" produto escolhido foi:", produtoSelecionado, "Funcao: ", select.classList.contains("idFuncao"), "Equipamento: ", select.classList.contains("idEquipamento"), "Suprimento: ",select.classList.contains("idSuprimento"));
            
            }
            
           // celulaIdEquipamento.textContent = select.classList.contains("idEquipamento");
            //celulaIdSuprimento.textContent = select.classList.contains("idSuprimento");
           // console.log(" produto escolhido foi:", produtoSelecionado, "Funcao: ", select.classList.contains("idFuncao"), "Equipamento: ", select.classList.contains("idEquipamento"), "Suprimento: ",select.classList.contains("idSuprimento"));
        }     
        
       
        // Encontre os selects de alimentação e transporte dentro da nova linha
        const selectAlimentacao = ultimaLinha.querySelector('.select-alimentacao');
        const selectTransporte = ultimaLinha.querySelector('.select-transporte');

        if (Categoria === "Produto(s)") { // Use "Função" se essa for a categoria exata definida na option
            if (selectAlimentacao) {
                selectAlimentacao.disabled = false;               
            }
            if (selectTransporte) {
                selectTransporte.disabled = false;
            }
        } else {
            if (selectAlimentacao) {
                selectAlimentacao.disabled = true;
                selectAlimentacao.value = ""; // Opcional: Reseta o valor
            }
            if (selectTransporte) {
                selectTransporte.disabled = true;
                selectTransporte.value = ""; // Opcional: Reseta o valor
            }
        }

        let celulaVlrCusto = ultimaLinha.querySelector(".vlrCusto");
        if (celulaVlrCusto) celulaVlrCusto.textContent = vlrCusto;
        console.log(" valor de Custo é:", vlrCusto);

        let celulaVlrVenda = ultimaLinha.querySelector(".vlrVenda");
       // if (celulaVlrVenda) celulaVlrVenda.textContent = vlrVenda;

        if (celulaVlrVenda) {
            celulaVlrVenda.textContent = formatarMoeda(vlrVendaNumerico);
            celulaVlrVenda.dataset.originalVenda = vlrVendaNumerico.toString();
        }
        console.log(" valor de Venda é:", vlrVendaNumerico);

        
    }
    gerarObservacoesProposta([ultimaLinha]);
    recalcularLinha(ultimaLinha);
 //marcia   
}

// Sua função de atualização de valores (mantém-se a mesma)
function atualizarValoresAjdCustoNaLinha(linha) {
    // ... (sua implementação atual de atualizarValoresAjdCustoNaLinha) ...
    console.log("Chamando atualizarValoresAjdCustoNaLinha para:", linha);

    const selectAlimentacao = linha.querySelector('.tpAjdCusto-alimentacao'); 
    const selectTransporte = linha.querySelector('.tpAjdCusto-transporte');  
    const idFuncaoCell = linha.querySelector('.idFuncao'); 
    
    const valorAlimentacaoSpan = linha.querySelector('.valorbanco.alimentacao'); 
    const valorTransporteSpan = linha.querySelector('.valorbanco.transporte');   
    
    const totAjdCustoCell = linha.querySelector('.totAjdCusto');

    let totalAlimentacaoLinha = 0;
    let totalTransporteLinha = 0;
    let totalAjdCustoLinha = 0;

    
    const idFuncaoDaLinha = linha.dataset.idfuncao;
   // Atualiza o texto da célula com o ID da função

    console.log("ID da função na linha:", idFuncaoDaLinha);

    let baseAlmoco = 0;
    let baseJantar = 0;
    let baseTransporte = 0;

    // const baseAlmoco = parseFloat(vlrAlmoco || 0); // Assumindo que vlrAlmoco está no window
    // const baseJantar = parseFloat(vlrJantar || 0); // Assumindo que vlrJantar está no window
    // const baseTransporte = parseFloat(vlrTransporte || 0); // Assumindo que vlrTransporte está no window

    // if (selectFuncao) {
    //     const selectedOptionFuncao = selectFuncao.options[selectFuncao.selectedIndex];
    //     if (selectedOptionFuncao && selectedOptionFuncao.value !== "") {
    //         baseAlmoco = parseFloat(selectedOptionFuncao.getAttribute("data-almoco")) || 0;
    //         baseJantar = parseFloat(selectedOptionFuncao.getAttribute("data-jantar")) || 0;
    //         baseTransporte = parseFloat(selectedOptionFuncao.getAttribute("data-transporte")) || 0;
    //     }
    // }

    // if (idFuncaoDaLinha && funcoesDisponiveis && funcoesDisponiveis.length > 0) {
    //     const funcaoCorrespondente = funcoesDisponiveis.find(f => String(f.idfuncao) === idFuncaoDaLinha);
    //     if (funcaoCorrespondente) {
    //         baseAlmoco = parseFloat(funcaoCorrespondente.almoco || 0);
    //         baseJantar = parseFloat(funcaoCorrespondente.jantar || 0);
    //         baseTransporte = parseFloat(funcaoCorrespondente.transporte || 0);
    //     } else {
    //         console.warn(`Função com ID ${idFuncaoDaLinha} não encontrada em funcoesDisponiveis.`);
    //     }
    // } else {
    //     console.log("idFuncaoDaLinha não encontrado ou funcoesDisponiveis vazio.");
    // }

    if (idFuncaoDaLinha && funcoesDisponiveis && funcoesDisponiveis.length > 0) {
        const funcaoCorrespondente = funcoesDisponiveis.find(f => String(f.idfuncao) === idFuncaoDaLinha);
        if (funcaoCorrespondente) {
            baseAlmoco = parseFloat(funcaoCorrespondente.almoco || 0);
            baseJantar = parseFloat(funcaoCorrespondente.jantar || 0);
            baseTransporte = parseFloat(funcaoCorrespondente.transporte || 0);
            console.log(`Bases lidas (da linha ${idFuncaoDaLinha}): Almoco: ${baseAlmoco}, Jantar: ${baseJantar}, Transporte: ${baseTransporte}`);
        } else {
            // Se idFuncaoDaLinha existe mas a função não foi encontrada, usa os globais como fallback
            console.warn(`Função com ID ${idFuncaoDaLinha} não encontrada em funcoesDisponiveis. Usando valores globais.`);
            baseAlmoco = parseFloat(vlrAlmoco || 0); // Use o valor global aqui
            baseJantar = parseFloat(vlrJantar || 0); // Use o valor global aqui
            baseTransporte = parseFloat(vlrTransporte || 0); // Use o valor global aqui
        }
    } else {
        // Se idFuncaoDaLinha não existe (para novas linhas) ou funcoesDisponiveis está vazio,
        // usa os valores globais como padrão.
        console.log("idFuncaoDaLinha não encontrado ou funcoesDisponiveis vazio. Usando valores globais.");
        baseAlmoco = parseFloat(vlrAlmoco || 0); // Use o valor global aqui
        baseJantar = parseFloat(vlrJantar || 0); // Use o valor global aqui
        baseTransporte = parseFloat(vlrTransporte || 0); // Use o valor global aqui
    }


    console.log(`Bases lidas (da linha ${idFuncaoDaLinha}): Almoco: ${baseAlmoco}, Jantar: ${baseJantar}, Transporte: ${baseTransporte}`);

    if (selectAlimentacao && valorAlimentacaoSpan) {
        const tipoAlimentacaoSelecionado = selectAlimentacao.value;
        console.log("Alimentação - TIPO SELECIONADO", tipoAlimentacaoSelecionado);
        if (tipoAlimentacaoSelecionado === 'Almoco') {
            totalAlimentacaoLinha = baseAlmoco;
        } else if (tipoAlimentacaoSelecionado === 'Janta') {
            totalAlimentacaoLinha = baseJantar;
        } else if (tipoAlimentacaoSelecionado === '2alimentacao') {
            totalAlimentacaoLinha = baseAlmoco + baseJantar;
        }
        valorAlimentacaoSpan.textContent = formatarMoeda(totalAlimentacaoLinha);
        console.log(`Alimentação: Tipo: ${tipoAlimentacaoSelecionado}, Valor Calculado: ${totalAlimentacaoLinha}`);
    }

    console.log(`Bases lidas (globais): Almoco: ${baseAlmoco}, Jantar: ${baseJantar}, Transporte: ${baseTransporte}`);

    if (selectAlimentacao && valorAlimentacaoSpan) {
        const tipoAlimentacaoSelecionado = selectAlimentacao.value;
        console.log("Alimentação - TIPO SELECIONADO", tipoAlimentacaoSelecionado);
        if (tipoAlimentacaoSelecionado === 'Almoco') { 
            totalAlimentacaoLinha = baseAlmoco;
        } else if (tipoAlimentacaoSelecionado === 'Janta') { 
            totalAlimentacaoLinha = baseJantar;
        } else if (tipoAlimentacaoSelecionado === '2alimentacao') { 
            totalAlimentacaoLinha = baseAlmoco + baseJantar;
        }
        valorAlimentacaoSpan.textContent = formatarMoeda(totalAlimentacaoLinha);
        console.log(`Alimentação: Tipo: ${tipoAlimentacaoSelecionado}, Valor Calculado: ${totalAlimentacaoLinha}`);
    }

    if (selectTransporte && valorTransporteSpan) {
        const tipoTransporteSelecionado = selectTransporte.value;
        if (tipoTransporteSelecionado !== 'select') { 
            totalTransporteLinha = baseTransporte;
        }
        valorTransporteSpan.textContent = formatarMoeda(totalTransporteLinha);
        console.log(`Transporte: Tipo: ${tipoTransporteSelecionado}, Valor Calculado: ${totalTransporteLinha}`);
    }
    
    totalAjdCustoLinha = totalAlimentacaoLinha + totalTransporteLinha;
    
    if (totAjdCustoCell) {
        totAjdCustoCell.textContent = formatarMoeda(totalAjdCustoLinha);
        console.log(`Total Ajd Custo da Linha: ${totalAjdCustoLinha}`);
    }
}


// --- NOVA FUNÇÃO PARA INICIALIZAR OS LISTENERS DE AJUDA DE CUSTO ---
// Chame esta função SEMPRE que o conteúdo do modal for carregado/atualizado.
function inicializarListenersAjdCustoTabela() {
    console.log("Inicializando listeners de Ajuda de Custo para a tabela de orçamento.");

    const tabelaBody = document.querySelector("#tabela tbody");

    if (!tabelaBody) {
        console.warn("Corpo da tabela de orçamento (#tabela tbody) não encontrado. Não é possível anexar listeners de ajuda de custo.");
        return;
    }

    // Este listener delegado para 'change' nos selects de Ajuda de Custo
    // deve ser adicionado apenas UMA VEZ ao 'tabelaBody'.
    // Usaremos uma flag para garantir isso, mesmo que a função seja chamada múltiplas vezes.
    if (!tabelaBody.dataset.hasAjdCustoChangeListener) { // Usamos um dataset na tabela para a flag
        tabelaBody.addEventListener('change', async function(event) {
            if (event.target.classList.contains('tpAjdCusto-alimentacao') || event.target.classList.contains('tpAjdCusto-transporte')) {
                console.log("--- Evento CHANGE disparado por select de ajuda de custo (delegado) ---");
                const linhaAtual = event.target.closest('tr');
                if (!linhaAtual) {
                    console.error("Erro: Não foi possível encontrar a linha (<tr>) pai para o select de ajuda de custo.");
                    return;
                }
                
                atualizarValoresAjdCustoNaLinha(linhaAtual);
                recalcularLinha(linhaAtual); 
                recalcularTotaisGerais(); 
            }
        });
        tabelaBody.dataset.hasAjdCustoChangeListener = true; // Define a flag como true
        console.log("Listener de Ajuda de Custo delegado anexado ao tbody.");
    } else {
        console.log("Listener de Ajuda de Custo delegado já está anexado ao tbody. Pulando.");
    }

    // Também recalcule os valores iniciais para todas as linhas já presentes na tabela
    // (inclusive a primeira linha que vem do HTML ou as que foram carregadas do backend).
    tabelaBody.querySelectorAll('tr').forEach(linha => {
        atualizarValoresAjdCustoNaLinha(linha);
        recalcularLinha(linha); 
    });
}



function resetarOutrosSelectsOrc(select) {
    const selects = document.querySelectorAll('.idFuncao, .idEquipamento, .idSuprimento');

    selects.forEach(outroSelect => {
        if (outroSelect !== select) {
            outroSelect.selectedIndex = 0;
        }
    });   
}

// Função para configurar eventos no modal de orçamento
async function verificaOrcamento() {

    initializeAllFlatpickrsInModal();
  
    carregarFuncaoOrc();
    carregarEventosOrc();
    carregarClientesOrc();
    carregarLocalMontOrc();
    carregarEquipamentosOrc();
    carregarSuprimentosOrc();
    configurarFormularioOrc();
    
    inicializarListenersAjdCustoTabela();

    adicionarLinhaOrc(); 

    configurarInfraCheckbox();
        
    // const selectElement = document.getElementById('idMontagem');

    // if (selectElement) {       
    //     selectElement.addEventListener('change', function() {           
    //         atualizarUFOrc(this);
    //     });
    //     console.log("Event listener adicionado ao idMontagem.");

    // } else {
    //     console.error("Elemento 'idMontagem' não encontrado no DOM!");
    // }   


    const selecionarPavilhaoSelect = document.getElementById('selecionarPavilhao');

    if (selecionarPavilhaoSelect) {
        selecionarPavilhaoSelect.addEventListener('change', function() {
            const selectedOption = this.options[this.selectedIndex];
            const id = parseInt(selectedOption.value, 10);
            const name = selectedOption.textContent;

            // Verifica se um pavilhão válido foi selecionado e se ele já não está na lista
            if (id && !selectedPavilhoes.some(p => p.id === id)) {
                selectedPavilhoes.push({ id: id, name: name });
                updatePavilhaoDisplayInputs(); // Atualiza o input de exibição
                this.value = ""; // Reseta o select para "Selecione para Adicionar"
            } else if (id && selectedPavilhoes.some(p => p.id === id)) {
                Swal.fire("Atenção", `O pavilhão "${name}" já foi adicionado.`, "info");
                this.value = ""; // Reseta o select mesmo se já estiver adicionado
            }
        });
    }

    // Event listener para a mudança do Local Montagem, para carregar os pavilhões
    const idMontagemSelect = document.getElementById('idMontagem');
    if (idMontagemSelect) {
        idMontagemSelect.addEventListener('change', function() {
            atualizarUFOrc(this);
            carregarPavilhaoOrc(this.value);
        });
        // Se a página já carrega com um idMontagem selecionado, chame a função para carregar os pavilhões iniciais
        if (idMontagemSelect.value) {
            carregarPavilhaoOrc(idMontagemSelect.value);
        }
    }

    

    // Chame updatePavilhaoDisplayInputs() inicialmente para garantir que os campos estejam vazios
    // ou preenchidos se o formulário for carregado para edição.
    updatePavilhaoDisplayInputs();
    
    const statusInput = document.getElementById('Status');
    if(statusInput){
        statusInput.addEventListener('input', function(event) {
            const valor = event.target.value;
            const permitido = /^[aAfF]$/.test(valor); // Usa regex para verificar

            if (!permitido) {
                event.target.value = ''; // Limpa o campo se a entrada for inválida
                Swal.fire({
                    title: 'Entrada Inválida',
                    text: 'Por favor, digite apenas "A" ou "F"',
                    icon: 'warning',
                    confirmButtonText: 'Ok'
                });
            }
        });
    }

    const nrOrcamentoInput = document.getElementById('nrOrcamento');
    if(nrOrcamentoInput){
        nrOrcamentoInput.addEventListener('input', function(event) {
            const valor = event.target.value;
            const permitido = /^[0-9]*$/.test(valor); // Permite apenas números
            if (!permitido) {
                event.target.value = ''; // Limpa o campo se a entrada for inválida
                Swal.fire({ 
                    title: 'Entrada Inválida',
                    text: 'Por favor, digite apenas números',
                    icon: 'warning',
                    confirmButtonText: 'Ok'
                });
            }            
        });
        nrOrcamentoInput.addEventListener('blur', async function() {
            const nrOrcamento = this.value.trim(); // Pega o valor do campo e remove espaços

            // Se o campo estiver vazio, limpa o formulário e sai
            if (!nrOrcamento) {
                limparOrcamento(); // Implemente esta função para limpar o form
                return;
            }

            console.log(`Buscando orçamento com Nº: ${nrOrcamento}`);

            try {
                const url = `orcamentos?nrOrcamento=${nrOrcamento}`;           
       
                const orcamento = await fetchComToken(url, { method: 'GET' });                     
                preencherFormularioComOrcamento(orcamento);          

            } catch (error) {
                console.error("Erro ao buscar orçamento:", error);
          
                let errorMessage = error.message;
                if (error.message.includes("404")) { 
                    errorMessage = `Orçamento com o número ${nrOrcamento} não encontrado.`;
                    limparOrcamento(); 
                } else if (error.message.includes("400")) {
                     errorMessage = "Número do orçamento é inválido ou vazio.";
                     limparOrcamento();
                } else {
                    errorMessage = `Erro ao carregar orçamento: ${error.message}`;
                    limparOrcamento();
                }
                
                Swal.fire("Erro!", errorMessage, "error");
            }
        });
    }    

    const btnAdicionarLinha = document.getElementById('adicionarLinha');
    if (btnAdicionarLinha) {    
        btnAdicionarLinha.addEventListener('click', function() {
            console.log("Botão 'Adicionar Linha' clicado"); 
            adicionarLinhaOrc(); // Chama a função para adicionar uma nova linha          
            
        });
    } else {
        console.error("Botão 'Adicionar Linha' não encontrado.");

    }

    const btnAdicionarLinhaAdicional = document.getElementById('adicionarLinhaAdicional');
    if (btnAdicionarLinhaAdicional) {
        btnAdicionarLinhaAdicional.addEventListener('click', function() {
            console.log("Botão 'Adicionar Linha Adicional' clicado");
            adicionarLinhaAdicional(); // Chama a função para adicionar uma nova linha adicional
            
        });
    } else {
        console.error("Botão 'Adicionar Linha Adicional' não encontrado.");
    }   
  

    const globalDescontoValor = document.getElementById('Desconto');
    const globalDescontoPercentual = document.getElementById('percentDesc');

    if (globalDescontoValor) {
        globalDescontoValor.addEventListener('input', function() {
            console.log("EVENTO INPUT GLOBAL: Desconto Valor alterado.");
            lastEditedGlobalFieldType = 'valorDesconto'; // Define qual campo foi editado
            aplicarDescontoEAcrescimo('Desconto');
        });
        globalDescontoValor.addEventListener('blur', function() {
            console.log("EVENTO BLUR GLOBAL: Desconto Valor.");
            this.value = formatarMoeda(desformatarMoeda(this.value));
            setTimeout(() => {
                if (document.activeElement !== globalDescontoPercentual && document.activeElement !== globalDescontoValor) {
                    lastEditedGlobalFieldType = null;
                    console.log("lastEditedGlobalFieldType resetado para null após blur do Desconto Valor.");
                }
            }, 0);
        });
    }

    if (globalDescontoPercentual) {
        globalDescontoPercentual.addEventListener('input', function() {
            console.log("EVENTO INPUT GLOBAL: Desconto Percentual alterado.");
            lastEditedGlobalFieldType = 'percentualDesconto'; // Define qual campo foi editado
            aplicarDescontoEAcrescimo('percentDesc');
        });
        globalDescontoPercentual.addEventListener('blur', function() {
            console.log("EVENTO BLUR GLOBAL: Desconto Percentual.");
            this.value = formatarPercentual(desformatarPercentual(this.value));
            setTimeout(() => {
                if (document.activeElement !== globalDescontoValor && document.activeElement !== globalDescontoPercentual) {
                    lastEditedGlobalFieldType = null;
                    console.log("lastEditedGlobalFieldType resetado para null após blur do Desconto Percentual.");
                }
            }, 0);
        });
    }

    // Acréscimo Global
    const globalAcrescimoValor = document.getElementById('Acrescimo');
    const globalAcrescimoPercentual = document.getElementById('percentAcresc');

    if (globalAcrescimoValor) {
        globalAcrescimoValor.addEventListener('input', function() {
            console.log("EVENTO INPUT GLOBAL: Acrescimo Valor alterado.");
            lastEditedGlobalFieldType = 'valorAcrescimo';
            aplicarDescontoEAcrescimo('Acrescimo');
        });
        globalAcrescimoValor.addEventListener('blur', function() {
            console.log("EVENTO BLUR GLOBAL: Acrescimo Valor.");
            this.value = formatarMoeda(desformatarMoeda(this.value));
            setTimeout(() => {
                if (document.activeElement !== globalAcrescimoPercentual && document.activeElement !== globalAcrescimoValor) {
                    lastEditedGlobalFieldType = null;
                    console.log("lastEditedGlobalFieldType resetado para null após blur do Acrescimo Valor.");
                }
            }, 0);
        });
    }

    if (globalAcrescimoPercentual) {
        globalAcrescimoPercentual.addEventListener('input', function() {
            console.log("EVENTO INPUT GLOBAL: Acrescimo Percentual alterado.");
            lastEditedGlobalFieldType = 'percentualAcrescimo';
            aplicarDescontoEAcrescimo('percentAcresc');
        });
        globalAcrescimoPercentual.addEventListener('blur', function() {
            console.log("EVENTO BLUR GLOBAL: Acrescimo Percentual.");
            this.value = formatarPercentual(desformatarPercentual(this.value));
            setTimeout(() => {
                if (document.activeElement !== globalAcrescimoValor && document.activeElement !== globalAcrescimoPercentual) {
                    lastEditedGlobalFieldType = null;
                    console.log("lastEditedGlobalFieldType resetado para null após blur do Acrescimo Percentual.");
                }
            }, 0);
        });
    }

    const percentualImpostoInput = document.getElementById('percentImposto');
    if (percentualImpostoInput) {
        percentualImpostoInput.addEventListener('input', function() {  
            const totalReferencia= desformatarMoeda(document.querySelector('#totalGeralVda').value || 0);

            calcularImposto(totalReferencia, this.value);
        });
    }

    const btnEnviar = document.getElementById('Enviar');
    btnEnviar.addEventListener("click", async function (event) {
        event.preventDefault(); // Previne o envio padrão do formulário
        console.log("Entrou no botão OK");

        btnEnviar.disabled = true;
        btnEnviar.textContent = 'Salvando...';

        try{

            const form = document.getElementById("form");
            const formData = new FormData(form);

            const temPermissaoCadastrar = temPermissao("Orcamentos", "cadastrar");
            const temPermissaoAlterar = temPermissao("Orcamentos", "alterar");
            

            const idOrcamentoExistenteValue = document.getElementById('idOrcamento')?.value;
            // --- Converte para número ou define como null de forma segura ---
            const orcamentoId = idOrcamentoExistenteValue && !isNaN(parseInt(idOrcamentoExistenteValue)) && parseInt(idOrcamentoExistenteValue) > 0
                ? parseInt(idOrcamentoExistenteValue)
                : null;
                
                
            if (!orcamentoId && !temPermissaoCadastrar) {
                return Swal.fire("Acesso negado", "Você não tem permissão para cadastrar novos funcionários.", "error");
            }

            if (orcamentoId && !temPermissaoAlterar) {
                return Swal.fire("Acesso negado", "Você não tem permissão para alterar funcionários.", "error");
            }

        
            console.log("formData BTNSALVAR", formData);

            console.log("Valor bruto de idOrcamentoExistenteValue:", idOrcamentoExistenteValue);
            console.log("ID do Orçamento (parseado para número ou null):", orcamentoId);

            console.log("idEvento BTNSALVAR", document.querySelector(".idEvento option:checked")?.value || null);
            console.log("idMontagem BTNSALVAR", document.querySelector(".idMontagem option:checked")?.value || null);

            const infraMontagemDatas = getPeriodoDatas(formData.get("periodoInfraMontagem"));
            for (const pair of formData.entries()) {
                console.log(`formData entry: ${pair[0]}, ${pair[1]}`);
            }
            const marcacaoDatas = getPeriodoDatas(formData.get("periodoMarcacao"));
            console.log("marcacaoDatas BTNSALVAR", marcacaoDatas);
            const montagemDatas = getPeriodoDatas(formData.get("periodoMontagem"));
            const realizacaoDatas = getPeriodoDatas(formData.get("periodoRealizacao"));
            const desmontagemDatas = getPeriodoDatas(formData.get("periodoDesmontagem"));
            const desmontagemInfraDatas = getPeriodoDatas(formData.get("periodoDesmontagemInfra"));

            const idsPavilhoesSelecionadosInput = document.getElementById('idsPavilhoesSelecionados');
            console.log("PAVILHOES PARA ENVIAR", idsPavilhoesSelecionadosInput);
            let pavilhoesParaEnviar = [];
            if (idsPavilhoesSelecionadosInput && idsPavilhoesSelecionadosInput.value) {
                try {
                    // Parseie a string JSON de volta para um array de IDs
                    pavilhoesParaEnviar = JSON.parse(idsPavilhoesSelecionadosInput.value);
                } catch (e) {
                    console.error("Erro ao parsear IDs de pavilhões selecionados:", e);
                    // Se o JSON estiver malformado, você pode querer retornar um erro aqui
                    Swal.fire("Erro!", "Formato inválido para a lista de pavilhões.", "error");
                    //btnEnviar.disabled = false;
                    //btnEnviar.textContent = 'Salvar Orçamento';
                    return;
                }
            }
            console.log("Pavilhões para enviar:", pavilhoesParaEnviar);

            const dadosOrcamento = {
                id: orcamentoId,
                status: formData.get("Status"),
                idCliente: document.querySelector(".idCliente option:checked")?.value || null, // Se o campo for vazio, será null
                idEvento: document.querySelector(".idEvento option:checked")?.value || null, // Se o campo for vazio, será null
               
                idMontagem: document.querySelector(".idMontagem option:checked")?.value || null, // Se o campo for vazio, será null
                // idPavilhao: document.querySelector(".idPavilhao option:checked")?.value || null, // Se o campo for vazio, será null
                idsPavilhoes: pavilhoesParaEnviar, 
                infraMontagem: formData.get("infraMontagem"),

                dtiniInfraMontagem: infraMontagemDatas.inicio,
                dtFimInfraMontagem: infraMontagemDatas.fim,
                dtIniMontagem: montagemDatas.inicio, 
                dtFimMontagem: montagemDatas.fim,
                dtIniMarcacao: marcacaoDatas.inicio,
                dtFimMarcacao: marcacaoDatas.fim,
                dtIniRealizacao: realizacaoDatas.inicio,
                dtFimRealizacao: realizacaoDatas.fim,
                dtIniDesmontagem: desmontagemDatas.inicio,
                dtFimDesmontagem: desmontagemDatas.fim,
                dtIniDesmontagemInfra: desmontagemInfraDatas.inicio,
                dtFimDesmontagemInfra: desmontagemInfraDatas.fim,                 
            
                obsItens: formData.get("Observacao"),
                obsProposta: formData.get("ObservacaoProposta"),
                totGeralVda: desformatarMoeda(document.querySelector('#totalGeralVda').value),
                totGeralCto: desformatarMoeda(document.querySelector('#totalGeralCto').value),
                totAjdCusto: desformatarMoeda(document.querySelector('#totalAjdCusto').value),
                lucroBruto: desformatarMoeda(document.querySelector('#Lucro').value),
                percentLucro: parsePercentValue(document.querySelector('#percentLucro').value),
                desconto: desformatarMoeda(document.querySelector('#Desconto').value),
                percentDesconto: parsePercentValue(document.querySelector('#percentDesc').value),
                acrescimo: desformatarMoeda(document.querySelector('#Acrescimo').value),
                percentAcrescimo: parsePercentValue(document.querySelector('#percentAcresc').value),
                lucroReal: desformatarMoeda(document.querySelector('#lucroReal').value),
                percentLucroReal: parsePercentValue(document.querySelector('#percentReal').value),               
                vlrCliente: desformatarMoeda(document.querySelector('#valorCliente').value),
                vlrImposto: desformatarMoeda(document.querySelector('#valorImposto').value),
                percentImposto: parsePercentValue(document.querySelector('#percentImposto').value)
                
            };

            const itensOrcamento = [];
        //    const linhas = document.querySelectorAll("#tabela tbody tr");
            
            const tabelaBodyParaColeta = document.querySelector("#tabela tbody"); // Pegue o tbody novamente para garantir

    //console.log("DEBUG FRONTEND: HTML do tbody ANTES de coletar as linhas:", tabelaBodyParaColeta ? tabelaBodyParaColeta.innerHTML : "tbody não encontrado");

    const linhas = tabelaBodyParaColeta ? tabelaBodyParaColeta.querySelectorAll("tr") : []; // Use querySelectorAll no tbody específico

    console.log("DEBUG FRONTEND: Quantidade de linhas encontradas por querySelectorAll:", linhas.length);
   

            linhas.forEach((linha) => {
                
                const item = {
                    
                    id: parseInt(linha.querySelector(".idItemOrcamento")?.value) || null,
                    nrorcamento: parseInt(linha.querySelector(".nrOrcamento")?.value) || null,
                    enviarnaproposta: linha.querySelector('.Proposta input[type="checkbox"]')?.checked || false,
                    categoria: linha.querySelector(".Categoria")?.textContent.trim(),
                    qtditens: parseInt(linha.querySelector(".qtdProduto input")?.value) || 0,
                    idfuncao: parseInt(linha.querySelector(".idFuncao")?.textContent) || null,
                    idequipamento: parseInt(linha.querySelector(".idEquipamento")?.textContent) || null,
                    idsuprimento: parseInt(linha.querySelector(".idSuprimento")?.textContent ) || null,
                    produto: linha.querySelector(".produto")?.textContent.trim(),
                    setor: linha.querySelector(".setor-input")?.value?.trim() || null,
                   
                    qtdDias: linha.querySelector(".qtdDias input")?.value || "0",

                    descontoitem: desformatarMoeda(linha.querySelector(".descontoItem.Moeda .ValorInteiros")?.value || '0'),
                    percentdescontoitem: parsePercentValue(linha.querySelector(".descontoItem.Moeda .valorPerCent")?.value),
                    acrescimoitem: desformatarMoeda(linha.querySelector(".acrescimoItem.Moeda .ValorInteiros")?.value || '0'),
                    percentacrescimoitem: parsePercentValue(linha.querySelector(".acrescimoItem.Moeda .valorPerCent")?.value),

                    vlrdiaria: desformatarMoeda(linha.querySelector(".vlrVenda.Moeda")?.textContent || '0'),
                    totvdadiaria: desformatarMoeda(linha.querySelector(".totVdaDiaria.Moeda")?.textContent || '0'),
                    ctodiaria: desformatarMoeda(linha.querySelector(".vlrCusto.Moeda")?.textContent || '0'),
                    totctodiaria: desformatarMoeda(linha.querySelector(".totCtoDiaria.Moeda")?.textContent || '0'),          
            
            
                    tpajdctoalimentacao: linha.querySelector('.tpAjdCusto-alimentacao')?.value || null,
                    vlrajdctoalimentacao: desformatarMoeda(linha.querySelector('.valorbanco.alimentacao')?.textContent || '0'),
                    tpajdctotransporte: linha.querySelector('.tpAjdCusto-transporte')?.value || null,
                    vlrajdctotransporte: desformatarMoeda(linha.querySelector('.valorbanco.transporte')?.textContent || '0'),
                    totajdctoitem: desformatarMoeda(linha.querySelector(".totAjdCusto.Moeda")?.textContent || '0'),

                    hospedagem: desformatarMoeda(linha.querySelector(".extraCampo .hospedagem")?.value || '0'),
                    transporte: desformatarMoeda(linha.querySelector(".extraCampo .transporteExtraInput")?.value || '0'),                    

                    totgeralitem: desformatarMoeda(linha.querySelector(".totGeral")?.textContent || '0')
                };

                // 🎯 Aqui vem o tratamento correto dos períodos:
                const campoPeriodo = linha.querySelector(".datas-item");
                const valorPeriodoInput = campoPeriodo?.value?.trim() || "";               

                let dataInicioFormatada = null;
                let dataFimFormatada = null;

                if (valorPeriodoInput) {
                    // Utilize a lógica de parsing que já existe na sua formatarRangeDataParaBackend
                    const partes = valorPeriodoInput
                        .replace(' até ', ' to ')
                        .replace(' a ', ' to ')
                        .split(' to ')
                        .map(d => d.trim());

                    if (partes.length === 2) {
                        // ASSUMINDO que você já tem a função `formatarDataParaBackend`
                        // que converte "DD/MM/YYYY" para "YYYY-MM-DD"
                        dataInicioFormatada = formatarDataParaBackend(partes[0]);
                        dataFimFormatada = formatarDataParaBackend(partes[1]);
                    } else {
                        // Se houver apenas uma data, atribua-a ao início e o fim como null ou vazio
                        dataInicioFormatada = formatarDataParaBackend(partes[0]);
                        dataFimFormatada = null; // Ou '', dependendo da sua preferência para campos vazios
                    }
                }

                // ATRIBUIÇÃO CORRETA:
                item.periododiariasinicio = dataInicioFormatada;
                item.periododiariasfim = dataFimFormatada; // <--- AGORA ESTAMOS ATRIBUINDO A DATA DE FIM SEPARADAMENTE

                itensOrcamento.push(item);
                // --- FIM DO NOVO TRECHO ---

                // Seus logs de depuração (opcionais, mas úteis para confirmar)
                console.log("Valor do input recebido:", valorPeriodoInput); // Ex: "03/07/2025 a 05/07/2025"
                console.log("item.periododiariasinicio (para o backend):", item.periododiariasinicio); // Ex: "2025-07-03"
                console.log("item.periododiariasfim (para o backend):", item.periododiariasfim);     // Ex: "2025-07-05"

            });


                
            dadosOrcamento.itens = itensOrcamento;

            console.log("Payload Final do Orçamento (sem id_empresa):", dadosOrcamento);

            // Determina o método e a URL com base na existência do ID do orçamento
            const isUpdate = orcamentoId !== null;
            const method = isUpdate ? 'PUT' : 'POST';
            const url = isUpdate ? `orcamentos/${orcamentoId}` : 'orcamentos';

            // 3. Enviar os dados para o backend usando fetchComToken
            const resultado = await fetchComToken(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(dadosOrcamento)
            });

            // 4. Lidar com a resposta do backend
            //if (response.ok) {
            //    const resultado = await response.json();
            Swal.fire("Sucesso!", resultado.message || "Orçamento salvo com sucesso!", "success");
            // Se for uma criação e o backend retornar o ID, atualize o formulário
            if (!isUpdate && resultado.id) {
                document.getElementById('idOrcamento').value = resultado.id;
                if (resultado.nrOrcamento) {
                    document.getElementById('nrOrcamento').value = resultado.nrOrcamento; // Atualiza o campo no formulário
                }
            }       

        } catch (error) {
            console.error('Erro inesperado ao salvar orçamento:', error);
                let errorMessage = "Ocorreu um erro inesperado ao salvar o orçamento.";
                if (error.message) {
                    errorMessage = error.message; // Pega a mensagem do erro lançada por fetchComToken
                } else if (typeof error === 'string') {
                    errorMessage = error; // Caso o erro seja uma string simples
                }
                Swal.fire("Erro!", "Falha ao salvar orçamento: " + errorMessage, "error");
        } finally {
            btnEnviar.disabled = false;
            btnEnviar.textContent = 'Salvar Orçamento';
        }

    });
    const btnLimpar = document.getElementById('Limpar');
    btnLimpar.addEventListener("click", async function (event) {
        event.preventDefault(); 
        if (btnLimpar) {
            btnLimpar.addEventListener("click", limparOrcamento());
        } else {
            console.warn("Botão 'Limpar' com ID 'Limpar' não encontrado.");
        }
        
    });// Previne o envio padrão do formulário

    recalcularTotaisGerais();
}

function desinicializarOrcamentosModal() {
    console.log("🧹 Desinicializando módulo Orcamentos.js");

    const selectElement = document.getElementById('idMontagem');
    if (selectElement && idMontagemChangeListener) {
        selectElement.removeEventListener('change', idMontagemChangeListener);
        idMontagemChangeListener = null;
    }

    const statusInput = document.getElementById('Status');
    if (statusInput && statusInputListener) {
        statusInput.removeEventListener('input', statusInputListener);
        statusInputListener = null;
    }

    const nrOrcamentoInput = document.getElementById('nrOrcamento');
    if (nrOrcamentoInput && nrOrcamentoInputListener) {
        nrOrcamentoInput.removeEventListener('input', nrOrcamentoInputListener);
        nrOrcamentoInputListener = null;
    }
    if (nrOrcamentoInput && nrOrcamentoBlurListener) {
        nrOrcamentoInput.removeEventListener('blur', nrOrcamentoBlurListener);
        nrOrcamentoBlurListener = null;
    }

    const btnAdicionarLinha = document.getElementById('adicionarLinha');
    if (btnAdicionarLinha && btnAdicionarLinhaListener) {
        btnAdicionarLinha.removeEventListener('click', btnAdicionarLinhaListener);
        btnAdicionarLinhaListener = null;
    }

    const btnAdicionarLinhaAdicional = document.getElementById('adicionarLinhaAdicional');
    if (btnAdicionarLinhaAdicional && btnAdicionarLinhaAdicionalListener) {
        btnAdicionarLinhaAdicional.removeEventListener('click', btnAdicionarLinhaAdicionalListener);
        btnAdicionarLinhaAdicionalListener = null;
    }

    const globalDescontoValor = document.getElementById('Desconto');
    if (globalDescontoValor && globalDescontoValorInputListener) {
        globalDescontoValor.removeEventListener('input', globalDescontoValorInputListener);
        globalDescontoValorInputListener = null;
    }
    if (globalDescontoValor && globalDescontoValorBlurListener) {
        globalDescontoValor.removeEventListener('blur', globalDescontoValorBlurListener);
        globalDescontoValorBlurListener = null;
    }

    const globalDescontoPercentual = document.getElementById('percentDesc');
    if (globalDescontoPercentual && globalDescontoPercentualInputListener) {
        globalDescontoPercentual.removeEventListener('input', globalDescontoPercentualInputListener);
        globalDescontoPercentualInputListener = null;
    }
    if (globalDescontoPercentual && globalDescontoPercentualBlurListener) {
        globalDescontoPercentual.removeEventListener('blur', globalDescontoPercentualBlurListener);
        globalDescontoPercentualBlurListener = null;
    }

    const globalAcrescimoValor = document.getElementById('Acrescimo');
    if (globalAcrescimoValor && globalAcrescimoValorInputListener) {
        globalAcrescimoValor.removeEventListener('input', globalAcrescimoValorInputListener);
        globalAcrescimoValorInputListener = null;
    }
    if (globalAcrescimoValor && globalAcrescimoValorBlurListener) {
        globalAcrescimoValor.removeEventListener('blur', globalAcrescimoValorBlurListener);
        globalAcrescimoValorBlurListener = null;
    }

    const globalAcrescimoPercentual = document.getElementById('percentAcresc');
    if (globalAcrescimoPercentual && globalAcrescimoPercentualInputListener) {
        globalAcrescimoPercentual.removeEventListener('input', globalAcrescimoPercentualInputListener);
        globalAcrescimoPercentualInputListener = null;
    }
    if (globalAcrescimoPercentual && globalAcrescimoPercentualBlurListener) {
        globalAcrescimoPercentual.removeEventListener('blur', globalAcrescimoPercentualBlurListener);
        globalAcrescimoPercentualBlurListener = null;
    }

    const percentualImpostoInput = document.getElementById('percentImposto');
    if (percentualImpostoInput && percentualImpostoInputListener) {
        percentualImpostoInput.removeEventListener('input', percentualImpostoInputListener);
        percentualImpostoInputListener = null;
    }

    const btnEnviar = document.getElementById('Enviar');
    if (btnEnviar && btnEnviarListener) {
        btnEnviar.removeEventListener("click", btnEnviarListener);
        btnEnviarListener = null;
    }

    const btnLimpar = document.getElementById('Limpar');
    if (btnLimpar && btnLimparListener) {
        btnLimpar.removeEventListener("click", btnLimparListener);
        btnLimparListener = null;
    }
    
    // Resetar estados e limpar formulário (se aplicável)
    limparOrcamento(); // Chame sua função de limpeza de formulário
    
    lastEditedGlobalFieldType = null;

    console.log("✅ Módulo Orcamentos.js desinicializado.");
}

export function limparOrcamento() {
    console.log("DEBUG: Limpando formulário de orçamento...");

    const form = document.getElementById("form");
    if (!form) {
        console.error("Formulário com ID 'form' não encontrado.");
        return;
    }

   
    form.querySelectorAll('input[type="text"], input[type="number"], textarea').forEach(input => {
       
        if (!input.readOnly) {
            input.value = '';
        }
    });

   
    document.getElementById('idOrcamento').value = '';
    document.getElementById('nrOrcamento').value = ''; 

   
    form.querySelectorAll('select').forEach(select => {
       
        const defaultOption = select.querySelector('option[selected][disabled]') || select.querySelector('option:first-child');
        if (defaultOption) {
            select.value = defaultOption.value;
        }
        // Disparar evento 'change' para que outros listeners reajam (ex: Select2)
        const event = new Event('change');
        select.dispatchEvent(event);
    });

    
    form.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.checked = false;
    });
   
    const mainFlatpickrIds = [
        "periodoInfraMontagem", "periodoMarcacao", "periodoMontagem",
        "periodoRealizacao", "periodoDesmontagem", "periodoDesmontagemInfra"
    ];
    mainFlatpickrIds.forEach(id => {
        const input = document.getElementById(id);
        if (input && input._flatpickr) { // Verifica se a instância do Flatpickr existe
            input._flatpickr.clear();
        } else if (input) {
            input.value = ''; // Se não for Flatpickr, limpa o valor do input
        }
    });

    // Limpar a tabela de itens
    const tabelaBody = document.querySelector("#tabela tbody");
    if (tabelaBody) {
       // tabelaBody.innerHTML = `<td colspan="20" style="text-align: center;">Nenhum item adicionado a este orçamento.</td>`;
        tabelaBody.innerHTML = '';
    }

    // Resetar campos de totais e valores monetários/percentuais para seus valores padrão
    document.getElementById('totalGeralVda').value = 'R$ 0,00';
    document.getElementById('totalGeralCto').value = 'R$ 0,00';
    document.getElementById('totalAjdCusto').value = 'R$ 0,00';
    document.getElementById('Lucro').value = 'R$ 0,00';
    document.getElementById('percentLucro').value = '0%';
    document.getElementById('Desconto').value = 'R$ 0,00';
    document.getElementById('percentDesc').value = '0%';
    document.getElementById('Acrescimo').value = 'R$ 0,00';
    document.getElementById('percentAcresc').value = '0%';
    document.getElementById('lucroReal').value = 'R$ 0,00';    
    document.getElementById('percentReal').value = '0%';
    document.getElementById('valorImposto').value = 'R$ 0,00';    
    document.getElementById('percentImposto').value = '0%';
    document.getElementById('valorCliente').value = 'R$ 0,00';

    // Se você tiver máscaras (como IMask), pode precisar re-aplicá-las ou garantir que o valor seja resetado corretamente
    // Ex: IMask(document.getElementById('Desconto'), { mask: 'R$ num', ... }).value = 'R$ 0,00';

    adicionarLinhaAdicional();

    console.log("DEBUG: Formulário de orçamento limpo.");
}

export async function preencherFormularioComOrcamento(orcamento) {
    if (!orcamento) {
        limparOrcamento();
        return;
    }
    
    const idOrcamentoInput = document.getElementById('idOrcamento');
    if (idOrcamentoInput) { // Adicionado if para proteger o acesso a .value
        idOrcamentoInput.value = orcamento.idorcamento || '';
    } else {
        console.warn("Elemento com ID 'idOrcamento' não encontrado.");
    }

    const nrOrcamentoInput = document.getElementById('nrOrcamento');
    if (nrOrcamentoInput) { // Adicionado if
        nrOrcamentoInput.value = orcamento.nrorcamento || '';
    } else {
        console.warn("Elemento com ID 'nrOrcamento' não encontrado.");
    }
    
    // Define os valores dos selects.
    // Como os 'value' das options agora são os IDs, a atribuição direta funciona.
    const statusInput = document.getElementById('Status'); // Seu HTML mostra input type="text"
    if (statusInput) {
        statusInput.value = orcamento.status || '';
    } else {
        console.warn("Elemento com ID 'Status' não encontrado.");
    }

    const clienteSelect = document.querySelector('.idCliente');
    if (clienteSelect) {     
        clienteSelect.value = orcamento.idcliente || '';
    } else {
        console.warn("Elemento com classe '.idCliente' não encontrado.");
    }

    const eventoSelect = document.querySelector('.idEvento');
    if (eventoSelect) {
        eventoSelect.value = orcamento.idevento || '';
    } else {
        console.warn("Elemento com classe '.idEvento' não encontrado.");
    }

    const localMontagemSelect = document.querySelector('.idMontagem');
    if (localMontagemSelect) {
        localMontagemSelect.value = orcamento.idmontagem || '';
        // --- NOVO: Preencher o campo UF da montagem e atualizar visibilidade ---
        const ufMontagemInput = document.getElementById('ufmontagem');
        if (ufMontagemInput) {
            ufMontagemInput.value = orcamento.ufmontagem || '';
        } else {
            console.warn("Elemento com ID 'ufmontagem' não encontrado.");
        }
       
        atualizarUFOrc(localMontagemSelect); 

        if (orcamento.idmontagem) {
             await carregarPavilhaoOrc(orcamento.idmontagem);
        } else {
             await carregarPavilhaoOrc(''); // Limpa o select se não houver montagem
        }
        
    } else {
        console.warn("Elemento com classe '.idMontagem' não encontrado.");
    }

    // const pavilhaoSelect = document.querySelector('.idPavilhao');
    // //console.log("PAVILHÃO:", pavilhaoSelect); // Vai mostrar o elemento <select>
    // if (pavilhaoSelect) {
        
    //     pavilhaoSelect.value = orcamento.idpavilhao || '';
    //     console.log("PAVILHÃO selecionado por ID:", pavilhaoSelect.value); 
       
    //     if (orcamento.idpavilhao && orcamento.nomepavilhao) {
    //         let optionExistente = pavilhaoSelect.querySelector(`option[value="${orcamento.idpavilhao}"]`);

    //         if (!optionExistente) {
    //             // Se a opção não existe, crie-a
    //             const newOption = document.createElement('option');
    //             newOption.value = orcamento.idpavilhao;
    //             newOption.textContent = orcamento.nomepavilhao; // Use o nome do pavilhão que veio do backend
    //             pavilhaoSelect.appendChild(newOption);
    //             console.log(`Opção para Pavilhão '${orcamento.nomepavilhao}' (ID: ${orcamento.idpavilhao}) adicionada dinamicamente.`);
    //         } else {
    //             // Se a opção já existe, apenas garanta que o texto esteja correto
    //             optionExistente.textContent = orcamento.nomepavilhao;
    //         }
    //         // Garante que o valor esteja selecionado (pode ser redundante, mas não custa)
    //         pavilhaoSelect.value = orcamento.idpavilhao;
    //         console.log(`Pavilhão '${orcamento.nomepavilhao}' (ID: ${orcamento.idpavilhao}) definido no select.`);

    //     } else if (!orcamento.idpavilhao && !orcamento.nomepavilhao) {
    //          // Se não houver ID nem nome, limpa o select
    //          pavilhaoSelect.value = '';
    //          console.log("Nenhum pavilhão para definir, select limpo.");
    //     }

    // } else {
    //     console.warn("Elemento com classe '.idPavilhao' não encontrado.");
    // }
    
        if (orcamento.pavilhoes && orcamento.pavilhoes.length > 0) {
        // Popula a variável global `selectedPavilhoes`
        // O `orcamento.pavilhoes` deve ser um array de objetos, ex: [{id: 8, nomepavilhao: "nome"}, ...]
        selectedPavilhoes = orcamento.pavilhoes.map(p => ({
            id: p.id, // Supondo que o ID é 'id'
            name: p.nomepavilhao // E o nome é 'nomepavilhao'
        }));
    } else {
        selectedPavilhoes = [];
    }

    // Chama a função que já sabe como preencher os inputs corretamente
    updatePavilhaoDisplayInputs();

    for (const id in flatpickrInstances) {
        const pickerInstance = flatpickrInstances[id];        
      
        if (pickerInstance && typeof pickerInstance.setDate === 'function' && pickerInstance.config) {
            let inicio = null;
            let fim = null;
                     
            switch(id) {
                case 'periodoInfraMontagem':
                    inicio = orcamento.dtiniinframontagem;
                    fim = orcamento.dtfiminframontagem;
                    break;
                case 'periodoMontagem':
                    inicio = orcamento.dtinimontagem;
                    fim = orcamento.dtfimmontagem;
                    break;
                case 'periodoMarcacao':
                    inicio = orcamento.dtinimarcacao;
                    fim = orcamento.dtfimmarcacao;
                    break;
                case 'periodoRealizacao':
                    inicio = orcamento.dtinirealizacao;
                    fim = orcamento.dtfimrealizacao;
                    break; 
                case 'periodoDesmontagem':
                    inicio = orcamento.dtinidesmontagem;
                    fim = orcamento.dtfimdesmontagem;
                    break;
                case 'periodoDesmontagemInfra':
                    inicio = orcamento.dtiniinfradesmontagem;
                    fim = orcamento.dtfiminfradesmontagem;
                    break;
            }
            
            const startDate = inicio ? new Date(inicio) : null;
            const endDate = fim ? new Date(fim) : null;
          
            if (pickerInstance.config.mode === "range") {
                // Adiciona verificação para datas válidas e tratamento para apenas uma data
                if (startDate && endDate && !isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
                    pickerInstance.setDate([startDate, endDate], true);
                } else if (startDate && !isNaN(startDate.getTime())) { // Se apenas a data de início for fornecida
                     pickerInstance.setDate(startDate, true);
                } else {
                    pickerInstance.clear();
                }
            } else { // Para modo de data única
                if (startDate && !isNaN(startDate.getTime())) {
                    pickerInstance.setDate(startDate, true);
                } else {
                    pickerInstance.clear();
                }
            }
        } else {
            console.warn(`[preencherFormularioComOrcamento] Instância Flatpickr para ID '${id}' não encontrada ou inválida. Não foi possível preencher.`);
        }
    }
 
    // Preencher campos de texto
     const obsItensInput = document.getElementById('Observacao'); 
    if (obsItensInput) {
        obsItensInput.value = orcamento.obsitens || '';
    } else {
        console.warn("Elemento com ID 'Observacao' (Observações sobre os Itens) não encontrado.");
    }

    const obsPropostaInput = document.getElementById('ObservacaoProposta');
    if (obsPropostaInput) {
        obsPropostaInput.value = orcamento.obsproposta || '';
    } else {
        console.warn("Elemento com ID 'ObservacaoProposta' (Observações sobre a Proposta) não encontrado.");
    }
   
    const totalGeralVdaInput = document.getElementById('totalGeralVda');
    if (totalGeralVdaInput) totalGeralVdaInput.value = formatarMoeda(orcamento.totgeralvda || 0);

    const totalGeralCtoInput = document.getElementById('totalGeralCto');
    if (totalGeralCtoInput) totalGeralCtoInput.value = formatarMoeda(orcamento.totgeralcto || 0);

    const totalAjdCustoInput = document.getElementById('totalAjdCusto');
    if (totalAjdCustoInput) totalAjdCustoInput.value = formatarMoeda(orcamento.totajdcto || 0);

    const totalGeralInput = document.getElementById('totalGeral');
    if (totalGeralCtoInput && totalAjdCustoInput && totalGeralInput) {
        // Obter os valores dos campos.
        // Use uma função para remover a formatação de moeda e converter para número.
        const valorGeralCto = desformatarMoeda(totalGeralCtoInput.value);
        const valorAjdCusto = desformatarMoeda(totalAjdCustoInput.value);

        // Realizar a soma
        const somaTotal = valorGeralCto + valorAjdCusto;

        // Formatar o resultado de volta para moeda e atribuir ao campo totalGeral
        totalGeralInput.value = formatarMoeda(somaTotal);
    } else {
        console.warn("Um ou mais elementos de input (totalGeralCto, totalAjdCusto, totalGeral) não foram encontrados.");
    }

    const lucroInput = document.getElementById('Lucro');
    if (lucroInput) lucroInput.value = formatarMoeda(orcamento.lucrobruto || 0);

    const percentLucroInput = document.getElementById('percentLucro');
    if (percentLucroInput) percentLucroInput.value = formatarPercentual(orcamento.percentlucro || 0);

    const descontoInput = document.getElementById('Desconto');
    if (descontoInput) {
        // Converte para número antes de toFixed
        descontoInput.value = parseFloat(orcamento.desconto || 0).toFixed(2);
    } else {
        console.warn("Elemento com ID 'Desconto' não encontrado.");
    }

    const percentDescInput = document.getElementById('percentDesc');
    if (percentDescInput) {
        percentDescInput.value = formatarPercentual(parseFloat(orcamento.percentdesconto || 0));
    } else {
        console.warn("Elemento com ID 'percentDesc' não encontrado.");
    }

    const acrescimoInput = document.getElementById('Acrescimo');
    if (acrescimoInput) {
        // Converte para número antes de toFixed
        acrescimoInput.value = parseFloat(orcamento.acrescimo || 0).toFixed(2);
    } else {
        console.warn("Elemento com ID 'Acrescimo' não encontrado.");
    }

    const percentAcrescInput = document.getElementById('percentAcresc');
    if (percentAcrescInput) {
        percentAcrescInput.value = formatarPercentual(parseFloat(orcamento.percentacrescimo || 0));
    } else {
        console.warn("Elemento com ID 'percentAcresc' não encontrado.");
    }

    const lucroRealInput = document.getElementById('lucroReal');
    if (lucroRealInput) lucroRealInput.value = formatarMoeda(orcamento.lucroreal || 0);

    const percentRealInput = document.getElementById('percentReal');
    if (percentRealInput) percentRealInput.value = formatarPercentual(orcamento.percentlucroreal || 0);

    const valorImpostoInput = document.getElementById('valorImposto');
    if (valorImpostoInput) valorImpostoInput.value = formatarMoeda(orcamento.valorimposto || 0);

    const percentImpostoInput = document.getElementById('percentImposto');
    if (percentImpostoInput) percentImpostoInput.value = formatarPercentual(orcamento.percentimposto || 0);

    const valorClienteInput = document.getElementById('valorCliente');
    if (valorClienteInput) valorClienteInput.value = formatarMoeda(orcamento.vlrcliente || 0);

    console.log("VALOR DO CLIENTE VINDO DO BANCO", orcamento.vlrcliente || 0);
    
   // preencherItensOrcamentoTabela(orcamento.itens || []);
    
    if (orcamento.itens && orcamento.itens.length > 0) {
        preencherItensOrcamentoTabela(orcamento.itens); // <--- ESTA CHAMADA É CRUCIAL
    } else {
        console.log("Orçamento carregado não possui itens ou array de itens está vazio.");
        preencherItensOrcamentoTabela([]); // Limpa a tabela se não houver itens
    }
    if (localMontagemSelect) { // Verifica se o select existe antes de chamar
        atualizarUFOrc(localMontagemSelect); 
    }
}


 export function preencherItensOrcamentoTabela(itens) {
     console.log("DEBUG FRONTEND: preencherItensOrcamentoTabela foi chamada com itens:", itens);
   
    const tabelaBody = document.querySelector("#tabela tbody");

    if (!tabelaBody) {
        console.warn("Corpo da tabela de itens (seletor #tabela tbody) não encontrado. Não é possível preencher os itens.");
        return;
    }

    tabelaBody.innerHTML = ''; // Limpa as linhas existentes    

    if (!itens || itens.length === 0) {
        console.log("Nenhum item encontrado para este orçamento ou 'itens' está vazio.");
        // Opcional: Adicionar uma linha indicando que não há itens
        const emptyRow = tabelaBody.insertRow();
        emptyRow.innerHTML = `<td colspan="20" style="text-align: center;">Nenhum item adicionado a este orçamento.</td>`;
        return;
    }
    

    itens.forEach(item => {
        console.log("DEBUG FRONTEND: Adicionando item à tabela:", item);     
        const newRow = tabelaBody.insertRow(); // Cria a linha DOM de uma vez
        newRow.dataset.idorcamentoitem = item.idorcamentoitem || '';
        newRow.dataset.idfuncao = item.idfuncao || '';
        // Formatação de datas para Flatpickr
        const inicioDiarias = item.periododiariasinicio;
        const fimDiarias = item.periododiariasfim;
        let valorInicialDoInputDiarias = '';
        const formattedInicio = formatarDataParaBR(inicioDiarias);
        const formattedFim = formatarDataParaBR(fimDiarias);

        if (formattedInicio && formattedFim) {
            valorInicialDoInputDiarias = `${formattedInicio} a ${formattedFim}`;
        } else if (formattedInicio) {
            valorInicialDoInputDiarias = formattedInicio;
        }

        console.log("DEBUG: SETOR", item.setor);

        // Construa o HTML de TODA a linha como uma única string
        newRow.innerHTML = `
            <td style="display: none;"><input type="hidden" class="idItemOrcamento" value="${item.idorcamentoitem || ''}"></td>
            <td style="display: none;"><input type="hidden" class="idFuncao" value="${item.idfuncao || ''}"></td>
            <td style="display: none;"><input type="hidden" class="idEquipamento" value="${item.idequipamento || ''}"></td>
            <td style="display: none;"><input type="hidden" class="idSuprimento" value="${item.idsuprimento || ''}"></td>
            <td class="Proposta">
                <div class="checkbox-wrapper-33">
                    <label class="checkbox">
                        <input class="checkbox__trigger visuallyhidden" type="checkbox" ${item.enviarnaproposta ? 'checked' : ''} />
                        <span class="checkbox__symbol">
                            <svg aria-hidden="true" class="icon-checkbox" width="28px" height="28px" viewBox="0 0 28 28" version="1" xmlns="http://www.w3.org/2000/svg">
                                <path d="M4 14l8 7L24 7"></path>
                            </svg>
                        </span>
                        <p class="checkbox__textwrapper"></p>
                    </label>
                </div>
            </td>
            <td class="Categoria">${item.categoria || ''}</td>
            <td class="qtdProduto">
                <div class="add-less">
                    <input type="number" class="qtdProduto" min="0" value="${item.qtditens || 0}">
                    <div class="Bt">
                        <button type="button" class="increment">+</button>
                        <button type="button" class="decrement">-</button>
                    </div>
                </div>
            </td>
            <td class="produto">${item.produto || ''}</td>
            <td class="setor">
                <input type="text" class="setor-input" value="${item.setor || ''}">
            </td>
            
            <td class="qtdDias">
                <div class="add-less">
                    <input type="number" readonly class="qtdDias" min="0" value="${item.qtddias || 0}">                    
                </div>
            </td>
            <td class="Periodo">
                <div class="flatpickr-container">
                    <input type="text" class="datas datas-item" data-input required readonly placeholder="Clique para Selecionar">
                </div>
            </td>
            <td class="descontoItem Moeda">
                <div class="Acres-Desc">
                    <input type="text" class="ValorInteiros" value="${formatarMoeda(item.descontoitem || 0)}">
                    <input type="text" class="valorPerCent" value="${parseFloat(item.percentdescontoitem || 0).toFixed(2)}%">
                </div>
            </td>
            <td class="acrescimoItem Moeda">
                <div class="Acres-Desc">
                    <input type="text" class="ValorInteiros" value="${formatarMoeda(item.acrescimoitem || 0)}">
                    <input type="text" class="valorPerCent" value="${parseFloat(item.percentacrescimoitem || 0).toFixed(2)}%">
                </div>
            </td>
          
            <td class="vlrVenda Moeda" data-original-venda="${item.vlrdiaria || 0}">${formatarMoeda(item.vlrdiaria || 0)}</td>
            <td class="totVdaDiaria Moeda">${formatarMoeda(item.totvdadiaria || 0)}</td>
            <td class="vlrCusto Moeda">${formatarMoeda(item.ctodiaria || 0)}</td>
            <td class="totCtoDiaria Moeda">${formatarMoeda(item.totctodiaria || 0)}</td>
            <td class="ajdCusto Moeda">
                <div class="Acres-Desc">
                    <select class="tpAjdCusto-alimentacao">
                        <option value="select" ${item.tpajdctoalimentacao === '' || item.tpajdctoalimentacao === 'select' ? 'selected' : ''}>Alimentação</option>
                        <option value="Almoco" ${item.tpajdctoalimentacao === 'Almoco' ? 'selected' : ''}>Almoço</option>
                        <option value="Janta" ${item.tpajdctoalimentacao === 'Janta' ? 'selected' : ''}>Jantar</option>
                        <option value="2alimentacao" ${item.tpajdctoalimentacao === '2alimentacao' ? 'selected' : ''}>Almoço + jantar</option>
                    </select>
                </div>
                <br><span class="valorbanco alimentacao">${formatarMoeda(item.vlrajdctoalimentacao || 0)}</span>
            </td>
            <td class="ajdCusto Moeda">
                <div class="Acres-Desc">
                    <select class="tpAjdCusto-transporte">
                        <option value="select" ${item.tpajdctotransporte === '' || item.tpajdctotransporte === 'select' ? 'selected' : ''}>Veiculo</option>
                        <option value="Público" ${item.tpajdctotransporte === 'Público' ? 'selected' : ''}>Público</option>
                        <option value="Alugado" ${item.tpajdctotransporte === 'Alugado' ? 'selected' : ''}>Alugado</option>
                        <option value="Próprio" ${item.tpajdctotransporte === 'Próprio' ? 'selected' : ''}>Próprio</option>
                    </select>
                </div>
                <br><span class="valorbanco transporte">${formatarMoeda(item.vlrajdctotransporte || 0)}</span>
            </td>
            <td class="totAjdCusto Moeda">${formatarMoeda(item.totajdctoitem || 0)}</td>
            <td class="extraCampo Moeda" style="display: none;">
                <input type="text" class="hospedagem" value="${item.hospedagem || 0}">
            </td>
            <td class="extraCampo Moeda" style="display: none;">
                <input type="text" class="transporteExtraInput" value="${item.transporte || 0}">
            </td>
            <td class="totGeral Moeda">${formatarMoeda(item.totgeralitem || 0)}</td>
            <td>
                <div class="Acao">
                    <button class="btnApagar" type="button">
                        <svg class="delete-svgIcon" viewBox="0 0 448 512">
                            <path d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z"></path>
                        </svg>
                    </button>
                </div>
            </td>
        `;

    const descontoValorItem = newRow.querySelector('.descontoItem .ValorInteiros');
    if (descontoValorItem) {
        descontoValorItem.addEventListener('input', function() {
            console.log("EVENTO INPUT: Campo ValorInteiros de Desconto alterado.");
            lastEditedFieldType = 'valor';
            recalcularDescontoAcrescimo(this, 'desconto', 'valor', this.closest('tr'));
        });
        descontoValorItem.addEventListener('blur', function() {
            console.log("EVENTO BLUR: Campo ValorInteiros de Desconto.");
            this.value = formatarMoeda(desformatarMoeda(this.value));
            // Adiciona um listener para o próximo tick, para verificar o foco.
            // Se o foco não está no campo percentual ou em outro campo da mesma célula, zera.
            setTimeout(() => {
                const campoPercentual = this.closest('.descontoItem').querySelector('.valorPerCent');
                // Se o foco não está no campo parceiro OU se o foco saiu da célula Acres-Desc
                if (document.activeElement !== campoPercentual && !this.closest('.Acres-Desc').contains(document.activeElement)) {
                    lastEditedFieldType = null;
                    console.log("lastEditedFieldType resetado para null após blur do ValorInteiros.");
                }
            }, 0); // Pequeno atraso para o browser resolver o foco
        });
    }

    // Campo Percentual de Desconto
    const descontoPercentualItem = newRow.querySelector('.descontoItem .valorPerCent');
    if (descontoPercentualItem) {
        descontoPercentualItem.addEventListener('input', function() {
            console.log("EVENTO INPUT: Campo valorPerCent de Desconto alterado.");
            lastEditedFieldType = 'percentual';
            recalcularDescontoAcrescimo(this, 'desconto', 'percentual', this.closest('tr'));
        });
        descontoPercentualItem.addEventListener('blur', function() {
            console.log("EVENTO BLUR: Campo valorPerCent de Desconto.");
            this.value = formatarPercentual(desformatarPercentual(this.value));
            // Ao sair do percentual, podemos resetar o lastEditedFieldType
            // já que o usuário provavelmente terminou a interação com este par de campos.
            setTimeout(() => {
                // Verifica se o foco não está dentro do mesmo grupo acres-desc
                if (!this.closest('.Acres-Desc').contains(document.activeElement)) {
                    lastEditedFieldType = null;
                    console.log("lastEditedFieldType resetado para null após blur do valorPerCent.");
                }
            }, 0);
        });
    }
    const acrescimoValorItem = newRow.querySelector('.acrescimoItem .ValorInteiros');
    if (acrescimoValorItem) {
        acrescimoValorItem.addEventListener('input', function() {
            console.log("EVENTO INPUT: Campo ValorInteiros de Acréscimo alterado.");
            lastEditedFieldType = 'valor';
            recalcularDescontoAcrescimo(this, 'acrescimo', 'valor', this.closest('tr'));
        });
        acrescimoValorItem.addEventListener('blur', function() {
            console.log("EVENTO BLUR: Campo ValorInteiros de Acréscimo.");
            this.value = formatarMoeda(desformatarMoeda(this.value));
            // Adiciona um listener para o próximo tick, para verificar o foco.
            // Se o foco não está no campo percentual ou em outro campo da mesma célula, zera.
            setTimeout(() => {
                const campoPercentual = this.closest('.acrescimoItem').querySelector('.valorPerCent');
                // Se o foco não está no campo parceiro OU se o foco saiu da célula Acres-Desc
                if (document.activeElement !== campoPercentual && !this.closest('.Acres-Desc').contains(document.activeElement)) {
                    lastEditedFieldType = null;
                    console.log("lastEditedFieldType resetado para null após blur do ValorInteiros.");
                }
            }, 0); // Pequeno atraso para o browser resolver o foco
        });
    }

    // Campo Percentual de Desconto
    const acrescimoPercentualItem = newRow.querySelector('.acrescimoItem .valorPerCent');
    if (acrescimoPercentualItem) {
        acrescimoPercentualItem.addEventListener('input', function() {
            console.log("EVENTO INPUT: Campo valorPerCent de Acréscimo alterado.");
            lastEditedFieldType = 'percentual';
            recalcularDescontoAcrescimo(this, 'acrescimo', 'percentual', this.closest('tr'));
        });
        acrescimoPercentualItem.addEventListener('blur', function() {
            console.log("EVENTO BLUR: Campo valorPerCent de Acréscimo.");
            this.value = formatarPercentual(desformatarPercentual(this.value));
            // Ao sair do percentual, podemos resetar o lastEditedFieldType
            // já que o usuário provavelmente terminou a interação com este par de campos.
            setTimeout(() => {
                // Verifica se o foco não está dentro do mesmo grupo acres-desc
                if (!this.closest('.Acres-Desc').contains(document.activeElement)) {
                    lastEditedFieldType = null;
                    console.log("lastEditedFieldType resetado para null após blur do valorPerCent.");
                }
            }, 0);
        });
    }    
          
        
        newRow.querySelector('.qtdProduto input')?.addEventListener('input', function() {
            recalcularLinha(this.closest('tr'));
        });
        
        newRow.querySelector('.qtdDias input')?.addEventListener('input', function() {
            recalcularLinha(this.closest('tr'));
        });

        // Event listeners para campos de ajuda de custo (selects)
        newRow.querySelector('.tpAjdCusto-alimentacao')?.addEventListener('change', function() {
            recalcularLinha(this.closest('tr'));
        });
        newRow.querySelector('.tpAjdCusto-transporte')?.addEventListener('change', function() {
            recalcularLinha(this.closest('tr'));
        });

        // Event listeners para campos extras (hospedagem, transporte)
        newRow.querySelector('.hospedagem')?.addEventListener('input', function() {
            recalcularLinha(this.closest('tr'));
        });

        newRow.querySelector('.transporteExtraInput')?.addEventListener('input', function() {
            recalcularLinha(this.closest('tr'));
            console.log("INPUT DO TRANSPORTE:", this.value); // Log para depuração
        });
        
        const selectAlimentacao = newRow.querySelector('.tpAjdCusto-alimentacao');
        if (selectAlimentacao && item.tpajdctoalimentacao) {
            selectAlimentacao.value = item.tpajdctoalimentacao;
        }

        const selectTransporte = newRow.querySelector('.tpAjdCusto-transporte');
        if (selectTransporte && item.tpajdctotransporte) {
            selectTransporte.value = item.tpajdctotransporte;
        }
        
        // Inicialização do Flatpickr
        const itemDateInput = newRow.querySelector(".Periodo .datas-item");
        if (itemDateInput) {
            const defaultDatesArray = [];
            if (inicioDiarias) {
                defaultDatesArray.push(new Date(inicioDiarias));
            }
            if (fimDiarias) {
                defaultDatesArray.push(new Date(fimDiarias));
            }

            flatpickr(itemDateInput, {
                mode: "range",
                dateFormat: "d/m/Y",
                locale: flatpickr.l10ns.pt,
                defaultDate: defaultDatesArray.length > 0 ? defaultDatesArray : [],
                onChange: function(selectedDates, dateStr, instance) {
                    const input = instance.input;
                    atualizarQtdDias(input, selectedDates);
                }
            });
        } 

        const incrementButton = newRow.querySelector('.qtdProduto .increment');
        const decrementButton = newRow.querySelector('.qtdProduto .decrement');
        const quantityInput = newRow.querySelector('.qtdProduto input[type="number"]');

        if (incrementButton && quantityInput) {
            incrementButton.addEventListener('click', function() {
                quantityInput.value = parseInt(quantityInput.value) + 1;
                // Chame sua função de recalcular a linha aqui também, se necessário
                recalcularLinha(this.closest('tr'));
            });
        }

        if (decrementButton && quantityInput) {
            decrementButton.addEventListener('click', function() {
                let currentValue = parseInt(quantityInput.value);
                if (currentValue > 0) { // Garante que não decrementa abaixo de zero
                    quantityInput.value = currentValue - 1;
                    // Chame sua função de recalcular a linha aqui também, se necessário
                    recalcularLinha(this.closest('tr'));
                }
            });
        }
        
        const temPermissaoApagar = temPermissao("Orcamentos", "apagar");
        const deleteButton = newRow.querySelector('.btnApagar');
        const idItemInput = newRow.querySelector('input.idItemOrcamento'); // Obtém o input de ID
       

        if (deleteButton) {
            deleteButton.addEventListener('click', async function(event) {
                event.preventDefault(); // Sempre previne o comportamento padrão inicial

                const linhaParaRemover = this.closest('tr');
                const idOrcamentoItem = idItemInput ? idItemInput.value : null; // Pega o ID na hora do clique

                if (!idOrcamentoItem || idOrcamentoItem.trim() === '') {
                    // Se NÃO tem ID (linha nova/vazia), SEMPRE permite remoção local
                    console.log("DEBUG: Item sem ID. Permitindo exclusão local.");
                    Swal.fire({
                        title: "Remover item?",
                        text: "Este item ainda não foi salvo no banco de dados. Deseja apenas removê-lo da lista?",
                        icon: "warning",
                        showCancelButton: true,
                        confirmButtonColor: "#3085d6",
                        cancelButtonColor: "#d33",
                        confirmButtonText: "Sim, remover!",
                        cancelButtonText: "Cancelar"
                    }).then((result) => {
                        if (result.isConfirmed) {
                            linhaParaRemover.remove();
                            recalcularTotaisGerais();
                           // calcularLucro();
                            Swal.fire("Removido!", "O item foi removido da lista.", "success");
                        }
                    });
                } else if (!temPermissaoApagar) {
                    // Se TEM ID, mas o usuário NÃO tem permissão para apagar
                    console.warn("Usuário não tem permissão para apagar itens de orçamento. Exibindo Swal.");
                    Swal.fire({
                        title: "Acesso Negado!",
                        text: "Você não tem permissão para apagar itens de orçamento que já estão salvos.",
                        icon: "error",
                        confirmButtonText: "Entendi"
                    });
                } else {
                    // Se TEM ID E o usuário TEM permissão para apagar (lógica original)
                    let currentItemProduct = linhaParaRemover.querySelector('.produto-input')?.value || "este item";
                    if (!currentItemProduct || currentItemProduct.trim() === '') {
                        const produtoCell = linhaParaRemover.querySelector('.produto');
                        if (produtoCell) {
                            currentItemProduct = produtoCell.textContent.trim();
                        }
                    }
                    
                    const { isConfirmed } = await Swal.fire({
                        title: `Tem Certeza que deseja EXCLUIR o item "${currentItemProduct}" ?`,
                        text: "Você não poderá reverter esta ação!",
                        icon: "warning",
                        showCancelButton: true,
                        confirmButtonColor: "#3085d6",
                        cancelButtonColor: "#d33",
                        confirmButtonText: "Sim, deletar!",
                        cancelButtonText: "Cancelar"
                    });

                    if (isConfirmed) {
                        try {
                            const idOrcamentoPrincipal = document.getElementById('idOrcamento').value;
                            console.log("IDS ORCAMENTO:", idOrcamentoPrincipal, idOrcamentoItem);   
                            await fetchComToken(`/orcamentos/${idOrcamentoPrincipal}/itens/${idOrcamentoItem}`, {
                                method: 'DELETE',
                                headers: {
                                    'Content-Type': 'application/json'
                                }
                            });                            

                            linhaParaRemover.remove(); 
                            recalcularTotaisGerais(); 
                           // calcularLucro(); 

                            Swal.fire("Deletado!", "O item foi removido com sucesso.", "success");

                        } catch (error) {
                            console.error("Erro ao deletar item:", error);
                            Swal.fire("Erro!", `Não foi possível deletar o item: ${error.message}`, "error");
                        }
                    }
                }
            });

            // Aplica classe de desabilitado visualmente se não tiver permissão para apagar itens EXISTENTES
            // Isso é feito FORA do listener, para que a aparência seja aplicada imediatamente
            if (!temPermissaoApagar) {
                // NÃO ADICIONE disabled=true AQUI, APENAS A CLASSE VISUAL
                deleteButton.classList.add("btnDesabilitado");
                deleteButton.title = "Você não tem permissão para apagar itens de orçamento que já estão salvos.";
            }
        }
       
    });

    
    
   // recalcularTotaisGerais(); 
    aplicarMascaraMoeda();   
   // calcularLucro();
}

function formatarDatasParaInputPeriodo(inicioStr, fimStr) {
    const formatarSimples = (data) => {
        if (!data) return '';
        const d = new Date(data);
        if (isNaN(d.getTime())) return ''; // Verifica se a data é válida
        const dia = String(d.getDate()).padStart(2, '0');
        const mes = String(d.getMonth() + 1).padStart(2, '0'); // Mês é base 0
        const ano = d.getFullYear();
        return `${dia}/${mes}/${ano}`;
    };

    const inicioFormatado = formatarSimples(inicioStr);
    const fimFormatado = formatarSimples(fimStr);

    if (inicioFormatado && fimFormatado) {
        if (inicioFormatado === fimFormatado) {
            return inicioFormatado; // Se for a mesma data, mostra apenas uma vez
        }
        return `${inicioFormatado} até ${fimFormatado}`;
    } else if (inicioFormatado) {
        return inicioFormatado; // Se só tiver data de início
    }
    return ''; // Se não tiver nenhuma data
}

// --- Função para Limpar o Formulário Principal ---

export function limparFormularioOrcamento() {
    document.getElementById('form').reset();
    idOrcamentoInput.value = '';

    // Limpar seleções de Flatpickr para todos os inputs
    for (const id in flatpickrInstances) {
        const pickerInstance = flatpickrInstances[id];
        if (pickerInstance) {
            pickerInstance.clear();
        }
    }

    // Resetar selects para a opção padrão (Selecione...)
    if (statusSelect) statusSelect.value = '';
    if (clienteSelect) clienteSelect.value = '';
    if (eventoSelect) eventoSelect.value = '';
    if (localMontagemSelect) localMontagemSelect.value = '';

    // TODO: Se você tiver uma função para limpar a tabela de itens, chame-a aqui
    // Ex: limparItensOrcamentoTabela();
}

function getPeriodoDatas(inputValue) { // Recebe diretamente o valor do input
   
    console.log("Valor do input recebido:", inputValue);
    
    if (typeof inputValue !== 'string' || inputValue.trim() === '') {
        // Se o input estiver vazio ou não for uma string, retorna null para as datas.
        // Isso é exatamente o que você quer para campos opcionais não preenchidos.
        return { inicio: null, fim: null };
    }
    const datas = inputValue.split(' até '); 

    let dataInicial = null;
    let dataFinal = null;

    if (datas.length === 2) {
        // Se há duas partes, é um período completo (início e fim)
        dataInicial = formatarDataParaBackend(datas[0].trim()); // Trim para remover espaços extras
        dataFinal = formatarDataParaBackend(datas[1].trim());
    } else if (datas.length === 1) {
        // Se há apenas uma parte, é uma única data selecionada
        dataInicial = formatarDataParaBackend(datas[0].trim());
        dataFinal = formatarDataParaBackend(datas[0].trim()); // Ou null, dependendo da sua regra para um único dia
                                                              // Deixei como a mesma data para um período de 1 dia.
    }
    // Caso contrário (datas.length é 0, já tratado pela validação inicial)
console.log("Datas retornadas:", { inicio: dataInicial, fim: dataFinal });
    return { inicio: dataInicial, fim: dataFinal };
}

function formatarDataParaBackend(dataString) {
    if (!dataString) return null;
    const partes = dataString.split('/');
    if (partes.length === 3) {
        let dia = partes[0];
        let mes = partes[1];
        let ano = partes[2];

        // Adiciona 2000 para anos de 2 dígitos, assumindo que são anos do século 21
        // Se você tiver datas antes de 2000, essa lógica precisará ser mais robusta
        if (ano.length === 2) {
            const currentYear = new Date().getFullYear();
            const century = Math.floor(currentYear / 100) * 100; // Ex: 2000
            
            // Heurística simples: se o ano de 2 dígitos for maior que o ano atual de 2 dígitos (ex: 95 para 2024),
            // assume século passado (19xx). Caso contrário, assume século atual (20xx).
            // A melhor prática é que o campo de data sempre retorne 4 dígitos do frontend.
            if (parseInt(ano) > (currentYear % 100)) {
                ano = (century - 100) + parseInt(ano); // Ex: 1995
            } else {
                ano = century + parseInt(ano); // Ex: 2025
            }
        }

        // Garante que mês e dia tenham 2 dígitos (adiciona '0' à esquerda se necessário)
        mes = mes.padStart(2, '0');
        dia = dia.padStart(2, '0');

        return `${ano}-${mes}-${dia}`; // Retorna no formato YYYY-MM-DD
    }
    //return dataString; // Retorna como está se não for DD/MM/YYYY
    return null; // Retorna null se a data não estiver no formato esperado
}

function formatarRangeDataParaBackend(dataRange) {
    if (!dataRange) return null;

    const partes = dataRange
        .replace(' até ', ' to ')
        .replace(' a ', ' to ')
        .split(' to ')
        .map(d => d.trim());

    if (partes.length !== 2) return null;

    const dataInicio = formatarDataParaBackend(partes[0]);
    const dataFim = formatarDataParaBackend(partes[1]);

    return `${dataInicio} a ${dataFim}`;
}

function formatarRangeParaInput(dataRangeISO) {
    console.log("DATAS", dataRangeISO);
   
    if (dataRangeISO === null || dataRangeISO === undefined) {
        return ''; // Retorna uma string vazia se a data for nula
    }
   
    if (!dataRangeISO.includes(' a ')) {
        return ''; // formato inválido
    }

    const [inicio, fim] = dataRangeISO.split(' a ');
    return formatarDataParaBR(inicio) + ' a ' + formatarDataParaBR(fim);
}

// function formatarDataParaBR(dataISO) {
//     const [ano, mes, dia] = dataISO.split('-');
//     return `${dia}/${mes}/${ano}`;
// }

function formatarDataParaBR(dataISOString) {
    if (!dataISOString) {
        return ''; // Retorna vazio se a string for nula ou vazia
    }

    try {
        // Tenta criar um objeto Date a partir da string ISO.
        // O construtor Date() é inteligente o suficiente para lidar com ISO 8601.
        const data = new Date(dataISOString);

        // Verifica se o objeto Date resultante é válido
        if (isNaN(data.getTime())) {
            console.warn(`[formatarDataParaBR] Data inválida recebida: "${dataISOString}". Retornando vazio.`);
            return '';
        }

        // Extrai dia, mês e ano.
        // `getDate()` retorna o dia do mês (1-31).
        // `getMonth()` retorna o mês (0-11), então adicionamos 1.
        // `getFullYear()` retorna o ano.
        // `padStart(2, '0')` garante que dia e mês tenham sempre dois dígitos (ex: "05" em vez de "5").
        const dia = String(data.getDate()).padStart(2, '0');
        const mes = String(data.getMonth() + 1).padStart(2, '0');
        const ano = data.getFullYear();

        return `${dia}/${mes}/${ano}`; // Retorna no formato DD/MM/YYYY
    } catch (e) {
        // Captura qualquer erro durante o processo de formatação
        console.error(`[formatarDataParaBR] Erro ao formatar data "${dataISOString}":`, e);
        return ''; // Em caso de erro, retorna vazio
    }
}

function parsePercentValue(valueString) {
    if (typeof valueString !== 'string' || !valueString) {
        return 0; // Ou null, dependendo do que seu banco espera para campos vazios
    }
    // Remove o '%' e espaços, depois substitui vírgula por ponto para parseFloat
    const cleanedValue = valueString.replace('%', '').trim().replace(',', '.');
    return parseFloat(cleanedValue) || 0; // Retorna 0 se não for um número válido após a limpeza
}

// Função auxiliar para formatar percentuais (se você precisar)
function formatarPercentual(valor) {
    //if (valor === null || valor === undefined) return '';
    //return (parseFloat(valor)).toFixed(2) + '%'; // Converte 0.1 para 10.00%

    if (valor === null || valor === undefined || valor === '') {
        return '0,00%'; // Retorna um valor padrão para nulos/vazios
    }
    const numero = parseFloat(valor);
    if (isNaN(numero)) {
        console.warn(`Valor inválido para formatarPercentual: ${valor}. Retornando 0,00%.`);
        return '0,00%';
    }
    const numeroFormatado = numero;
    // Usa toLocaleString para formatação com vírgula e 2 casas decimais, depois adiciona o '%'
    return `${numeroFormatado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function desformatarPercentual(texto) {
    if (!texto) return 0;
    return parseFloat(texto.replace('%', '').replace(',', '.').trim()) || 0;
}

//SALVANDO ORCAMENTO
function enviarOrcamento() {
    const tabela = document.getElementById("tabela");
    const linhas = tabela.querySelectorAll("tbody tr");
    const dados = [];

    linhas.forEach(linha => {
        const produto = linha.querySelector(".produto")?.textContent.trim();
        const vlrCusto = linha.querySelector(".vlrCusto")?.textContent.trim();
        const vlrVenda = linha.querySelector(".vlrVenda")?.textContent.trim();

        // Só adiciona se tiver produto
        if (produto) {
            dados.push({
                produto,
                vlrCusto: parseFloat(vlrCusto),
                vlrVenda: parseFloat(vlrVenda)
            });
        }
    });

    console.log("Dados a enviar:", dados);

    fetchComToken("/orcamento", {
        method: "POST",
        // headers: {
        //     "Content-Type": "application/json",
        //     'Authorization': `Bearer ${token}`
        //     // 'x-id-empresa': idEmpresa
        // },
        body: JSON.stringify({ Pessoas: dados })
    })
    .then(res => res.json())
    .then(res => {
        console.log("Resposta do servidor:", res);
        alert("Orçamento enviado com sucesso!");
    })
    .catch(err => {
        console.error("Erro ao enviar orçamento:", err);
        alert("Erro ao enviar orçamento.");
    });
}

// Exportar as funções se necessário

// -------------------------------------- input Desconto e Acrésimo -----------------------------------------------------------
// window.addEventListener('DOMContentLoaded', () => {
 
//     console.log("ENTROU NO ADD PARA APLICAR DESCONTO E ACRESCIMO");
//     aplicarDescontoEAcrescimo(); // ✅ Atualiza o valor do cliente assim que a tela carregar

//     // Seu listener existente
//     document.body.addEventListener('blur', function (e) {
//         const input = e.target; 
//         const inputId = input.id || input.className;
//         console.log(`DEBUG: Evento blur disparado por: ${inputId}`);
//         // Campos por linha
//         if (
//             input.matches('.descontoItem .ValorInteiros') ||
//             input.matches('.acrescimoItem .ValorInteiros') ||
//             input.matches('.descontoItem .valorPerCent') ||
//             input.matches('.acrescimoItem .valorPerCent')
//         ) {
//             const linha = input.closest('tr');
//             if (linha) {
//                 recalcularLinha(linha);
//             }
//         }

//         // Campos gerais
//         if (
//             input.matches('#Desconto') ||
//             input.matches('#percentDesc') ||
//             input.matches('#Acrescimo') ||
//             input.matches('#percentAcresc')
//         ) {
//             aplicarDescontoEAcrescimo();
//         }
//     }, true);
// });

// ------------------------------- Preenchimento automatico -------------------------
    document.querySelectorAll('.form2 input').forEach(input => {
        // Verifica se o campo já tem valor ao carregar
        if (input.value.trim() !== '') {
        input.classList.add('preenchido');
        }
    
        // Ao digitar ou colar algo
        input.addEventListener('input', () => {
        if (input.value.trim() !== '') {
            input.classList.add('preenchido');
        } else {
        input.classList.remove('preenchido');
        }
        });
    
        // Em caso de preenchimento via script
        input.addEventListener('blur', () => {
        if (input.value.trim() !== '') {
            input.classList.add('preenchido');
        } else {
            input.classList.remove('preenchido');
        }
        });
    });


//   ------------------ exibição de Moeda --------------------------------
function formatarMoeda(valor) {
   // return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
   if (valor === null || valor === undefined || valor === '') {
        return 'R$ 0,00'; // Retorna um valor padrão para nulos/vazios
    }
    // Converte o valor para float e verifica se é um número válido
    const numero = parseFloat(valor);
    if (isNaN(numero)) {
        console.warn(`Valor inválido para formatarMoeda: ${valor}. Retornando R$ 0,00.`);
        return 'R$ 0,00';
    }
    return numero.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}


function recalcularLinha(linha) {
    if (!linha) return;

    try {
        console.log("Linha recebida para recalcular:", linha);

        // ... (código existente para qtdItens, qtdDias, celulaVenda, vlrVendaOriginal, vlrVenda, vlrCusto) ...
        let qtdItens = parseFloat(linha.querySelector('.qtdProduto input')?.value) || 0;
        let qtdDias = parseFloat(linha.querySelector('.qtdDias input')?.value) || 0;

        let celulaVenda = linha.querySelector('.vlrVenda');
        //let vlrVendaOriginal = desformatarMoeda(celulaVenda?.textContent) || 0; 
        const vlrVendaOriginal = parseFloat(celulaVenda?.dataset.originalVenda) || 0; 
        console.log("DEBUG - recalcularLinha: vlrVendaOriginal (Lido do data-attribute) =", vlrVendaOriginal);
        let vlrVenda = vlrVendaOriginal;

        let vlrCusto = desformatarMoeda(linha.querySelector('.vlrCusto')?.textContent) || 0;

        // ... (código para Alimentação e Transporte: selectAlimentacao, valorAlimentacaoSpan, etc.) ...
        const selectAlimentacao = linha.querySelector('.tpAjdCusto-alimentacao');
        const selectTransporte = linha.querySelector('.tpAjdCusto-transporte');

        const valorAlimentacaoSpan =  linha.querySelector('.valorbanco.alimentacao');
        const valorTransporteSpan = linha.querySelector('.valorbanco.transporte');       
      
        
        // const baseAlmoco = parseFloat(vlrAlmoco || 0);
        // const baseJantar = parseFloat(vlrJantar || 0);
        // const baseTransporte = parseFloat(vlrTransporte || 0);

        // let totalAlimentacaoLinha = 0;
        // let totalTransporteLinha = 0;

        // if (selectAlimentacao && valorAlimentacaoSpan) {
        //     const tipoAlimentacaoSelecionado = selectAlimentacao.value;
        //     if (tipoAlimentacaoSelecionado === 'Almoco') { totalAlimentacaoLinha = baseAlmoco; }
        //     else if (tipoAlimentacaoSelecionado === 'Janta') { totalAlimentacaoLinha = baseJantar; }
        //     else if (tipoAlimentacaoSelecionado === '2alimentacao') { totalAlimentacaoLinha = baseAlmoco + baseJantar; }
        //     valorAlimentacaoSpan.textContent = totalAlimentacaoLinha.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        //     console.log("ALIMENTACAO", valorAlimentacaoSpan);
        // }

        // if (selectTransporte && valorTransporteSpan) {
        //     const tipoTransporteSelecionado = selectTransporte.value;
        //     if (tipoTransporteSelecionado === 'Público' || tipoTransporteSelecionado === 'Alugado' || tipoTransporteSelecionado === 'Próprio') {
        //         totalTransporteLinha = baseTransporte;
        //     }
        //     valorTransporteSpan.textContent = totalTransporteLinha.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        // }

        const totalAlimentacaoLinha = desformatarMoeda(linha.querySelector('.valorbanco.alimentacao')?.textContent) || 0;
        const totalTransporteLinha = desformatarMoeda(linha.querySelector('.valorbanco.transporte')?.textContent) || 0;

        console.log("ALIMENTACAO (lido do DOM):", linha.querySelector('.valorbanco.alimentacao')); // Mantém o log, agora deve mostrar o valor correto
        let hospedagemValor = parseFloat(linha.querySelector('.hospedagem')?.value) || 0;
        let transporteExtraValor = parseFloat(linha.querySelector('.transporteExtraInput')?.value) || 0;

        console.log("HOSPEDAGEM E TRANSPORTE EXTRA:", hospedagemValor, transporteExtraValor);
              

        // let vlrAjdCusto =  vlrCusto + totalAlimentacaoLinha + totalTransporteLinha + hospedagemValor;
        let vlrAjdCusto =  vlrCusto + totalAlimentacaoLinha + totalTransporteLinha + hospedagemValor;
        
        // --- LEITURA DOS VALORES DE DESCONTO E ACRÉSCIMO DA LINHA (NÃO FAÇA CÁLCULO DE SINCRONIZAÇÃO AQUI!) ---
        let campoDescValor = linha.querySelector('.descontoItem .ValorInteiros');
        let campoAcrescValor = linha.querySelector('.acrescimoItem .ValorInteiros');

        let desconto = 0;
        let acrescimo = 0;

        if (campoDescValor && campoDescValor.mask) {
            desconto = parseFloat(campoDescValor.mask.unmaskedValue) || 0;
        } else if (campoDescValor) {
            desconto = desformatarMoeda(campoDescValor.value);
        }

        if (campoAcrescValor && campoAcrescValor.mask) {
            acrescimo = parseFloat(campoAcrescValor.mask.unmaskedValue) || 0;
        } else if (campoAcrescValor) {
            acrescimo = desformatarMoeda(campoAcrescValor.value);
        }

        // --- CÁLCULO DO vlrVendaCorrigido USANDO OS VALORES LIDOS ---
        let vlrVendaCorrigido = vlrVendaOriginal - desconto + acrescimo; 

        // ... (resto dos seus cálculos de totalIntermediario, totalVenda, totalCusto, totalAjdCusto, totGeralCtoItem) ...
        // let totalIntermediario = qtdItens * qtdDias;
        // let totalVenda = totalIntermediario * vlrVendaCorrigido;
        // let totalCusto = totalIntermediario * vlrCusto;
        // let totalAjdCusto = totalIntermediario * vlrAjdCusto + transporteExtraValor; 
        // let totGeralCtoItem = totalCusto + totalAjdCusto+ transporteExtraValor;

        let totalIntermediario = qtdItens * qtdDias;
        let totalVenda = (totalIntermediario * vlrVendaCorrigido) +(hospedagemValor * totalIntermediario) + transporteExtraValor;
        let totalCusto = totalIntermediario * vlrCusto;
        let totalAjdCusto = totalIntermediario * vlrAjdCusto; 
        let totGeralCtoItem = totalCusto + totalAjdCusto;

        console.log("Ajuda Custo RECALCULAR LINHA:", totalAjdCusto, "totalIntermediario:", totalIntermediario, "vlrAjdCusto:", vlrAjdCusto);

        // --- ATUALIZA A DOM (TDs da linha) ---
        linha.querySelector('.valorbanco.alimentacao').textContent = totalAlimentacaoLinha.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        linha.querySelector('.valorbanco.transporte').textContent = totalTransporteLinha.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        
        linha.querySelector('.totVdaDiaria').textContent = totalVenda.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        linha.querySelector('.vlrVenda').textContent = vlrVendaCorrigido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        linha.querySelector('.totCtoDiaria').textContent = totalCusto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        linha.querySelector('.totAjdCusto').textContent = totalAjdCusto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        linha.querySelector('.totGeral').textContent = totGeralCtoItem.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        // --- CÁLCULO E ATUALIZAÇÃO DOS TOTAIS GERAIS (DA TELA) ---
        // Este bloco aqui é que recalcula os totais globais, independentemente da função aplicarDescontoEAcrescimo
        // pois esta função é chamada por CADA LINHA.
        let allTotalCusto = 0;
        document.querySelectorAll('#tabela tbody .totCtoDiaria').forEach(cell => {
            allTotalCusto += desformatarMoeda(cell.textContent);
        });
        document.querySelector('#totalGeralCto').value = allTotalCusto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        let allTotalVenda = 0;
        document.querySelectorAll('#tabela tbody .totVdaDiaria').forEach(cell => {
            allTotalVenda += desformatarMoeda(cell.textContent);
        });
        document.querySelector('#totalGeralVda').value = allTotalVenda.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        let allTotalAjdCusto = 0;
        document.querySelectorAll('#tabela tbody .totAjdCusto').forEach(cell => {
            allTotalAjdCusto += desformatarMoeda(cell.textContent);
        });
        document.querySelector('#totalAjdCusto').value = allTotalAjdCusto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        let allTotalGeral = 0;
        document.querySelectorAll('#tabela tbody .totGeral').forEach(cell => {
            allTotalGeral += desformatarMoeda(cell.textContent);
        });
        document.querySelector('#totalGeral').value = allTotalGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        // --- Chamadas Finais ---
        console.log("Calculo desc e Acresc (final):", vlrVendaOriginal, "-", desconto, "+", acrescimo);
        console.log("valor c/ desc e Acresc (final):", vlrVendaCorrigido);
        // ... (outros logs) ...
        
       
        
        recalcularTotaisGerais(); // Recalcula os totais gerais da tabela
    } catch (error) {
        console.error("Erro no recalcularLinha:", error);
    }
}

// function recalcularDescontoAcrescimo(campoAlterado, tipoCampo, tipoValorAlterado, linha) {
    
//     if (!campoAlterado) {
//         console.warn("recalcularDescontoAcrescimo: Campo alterado inválido.", campoAlterado);
//         return;
//     }

//     const celulaVenda = linha.querySelector('.vlrVenda');
//     // Assume que vlrVendaOriginal é o valor base para cálculo de percentual
//     const vlrVendaOriginal = parseFloat(celulaVenda?.dataset.originalVenda || '0') || 0;
//    //let vlrVendaOriginal = desformatarMoeda(celulaVenda?.textContent) || 0; 
    
//     console.log("DEBUG - recalcularDescontoAcrescimo - INÍCIO (SEM IMask.js)");
//     console.log("Campo Alterado:", campoAlterado.id || campoAlterado.className, "Tipo Campo:", tipoCampo, "Tipo Valor Alterado:", tipoValorAlterado);
//     console.log("Valor de Venda Original da Linha (dataset):", vlrVendaOriginal, celulaVenda.value);

//     let campoValor;      // Referência ao input de valor monetário (ex: R$ 10,00)
//     let campoPercentual; // Referência ao input de percentual (ex: 5%)

//     if (tipoCampo === 'desconto') {
//         campoValor = linha.querySelector('.descontoItem .ValorInteiros');
//         campoPercentual = linha.querySelector('.descontoItem .valorPerCent');
//     } else { // tipoCampo === 'acrescimo'
//         campoValor = linha.querySelector('.acrescimoItem .ValorInteiros');
//         campoPercentual = linha.querySelector('.acrescimoItem .valorPerCent');
//     }

//     // --- LEITURA DOS VALORES ATUAIS DOS CAMPOS ---
//     // Agora usando as funções de desformatação
//     let valorMonetarioAtual = desformatarMoeda(campoValor?.value || '0');
//     let percentualAtual = desformatarPercentual(campoPercentual?.value || '0');

//     console.log(`Valores lidos dos campos (monetário: ${valorMonetarioAtual}, percentual: ${percentualAtual})`);

//     console.log("tipoValorAlterado:", tipoValorAlterado, campoAlterado.value);

//     // --- Lógica de sincronização baseada no campo que foi alterado ---
//     if (tipoValorAlterado === 'valor') { // Se o campo monetário foi modificado
//         // O valor digitado já está em `valorMonetarioAtual` (desformatado)
//         // Atualiza o percentual
//         if (vlrVendaOriginal > 0) {
//             percentualAtual = (valorMonetarioAtual / vlrVendaOriginal) * 100;
//         } else {
//             percentualAtual = 0; // Se vlrVendaOriginal é 0, o percentual também é 0
//         }
//         // Atribui o novo percentual ao campo correspondente (formatado)
//         if (campoPercentual) {
//             campoPercentual.value = formatarPercentual(percentualAtual);
//             console.log(`Atualizando ${tipoCampo} Percentual para: ${campoPercentual.value}`);
//         }
        
//     } else { // tipoValorAlterado === 'percentual' - Se o campo percentual foi modificado
//         // O percentual digitado já está em `percentualAtual` (desformatado)
//         // Atualiza o valor monetário
//         valorMonetarioAtual = vlrVendaOriginal * (percentualAtual / 100);
//         // Atribui o novo valor monetário ao campo correspondente (formatado)
//         if (campoValor) {
//             campoValor.value = formatarMoeda(valorMonetarioAtual);
//             console.log(`Atualizando ${tipoCampo} Valor para: ${campoValor.value}`);
//         }
//     }

//     // --- Lógica para zerar o campo "parceiro" se o campo alterado for zerado ---
//     // Agora lemos diretamente do campo.value e desformatamos para verificar se é zero
//     let valorDigitadoNoCampoAlterado;
//     if (tipoValorAlterado === 'valor') {
//         valorDigitadoNoCampoAlterado = desformatarMoeda(campoAlterado.value || '0');
//     } else {
//         valorDigitadoNoCampoAlterado = desformatarPercentual(campoAlterado.value || '0');
//     }

//     if (valorDigitadoNoCampoAlterado === 0) {
//         console.log("Campo alterado foi zerado. Zerando campo parceiro.");
//         if (tipoValorAlterado === 'valor' && campoPercentual) {
//             campoPercentual.value = formatarPercentual(0);
//         } else if (tipoValorAlterado === 'percentual' && campoValor) {
//             campoValor.value = formatarMoeda(0);
//         }
//     }

//     // Chama a função principal de recalcular a linha após as atualizações
//     recalcularLinha(linha);
    
//     console.log("DEBUG - recalcularDescontoAcrescimo - FIM");
// }

function recalcularDescontoAcrescimo(campoAlterado, tipoCampo, tipoValorAlterado, linha) {
    if (isRecalculatingDiscountAcrescimo) {
        console.log("DEBUG: Recálculo em andamento, ignorando nova chamada.");
        return;
    }

    isRecalculatingDiscountAcrescimo = true;

    try {
        const celulaVenda = linha.querySelector('.vlrVenda');
        let vlrVendaOriginal = parseFloat(celulaVenda?.dataset.originalVenda || '0') || 0;

        if (vlrVendaOriginal === 0 && celulaVenda) {
            const vlrVendaAtualFormatado = celulaVenda.textContent;
            vlrVendaOriginal = desformatarMoeda(vlrVendaAtualFormatado);
            console.log("DEBUG: vlrVendaOriginal ajustado para o valor atual da celulaVenda:", vlrVendaOriginal);
        }

        console.log("DEBUG - recalcularDescontoAcrescimo - INÍCIO");
        console.log("Campo Alterado (elemento):", campoAlterado.className, "Tipo Campo (desc/acresc):", tipoCampo, "Tipo Valor Alterado (valor/percentual):", tipoValorAlterado);
        console.log("Valor de Venda Original da Linha (base para cálculo):", vlrVendaOriginal);

        let campoValor;
        let campoPercentual;

        if (tipoCampo === 'desconto') {
            campoValor = linha.querySelector('.descontoItem .ValorInteiros');
            campoPercentual = linha.querySelector('.descontoItem .valorPerCent');
        } else { // tipoCampo === 'acrescimo'
            campoValor = linha.querySelector('.acrescimoItem .ValorInteiros');
            campoPercentual = linha.querySelector('.acrescimoItem .valorPerCent');
        }

        let valorMonetarioAtual = desformatarMoeda(campoValor?.value || '0');
        let percentualAtual = desformatarPercentual(campoPercentual?.value || '0');

        console.log(`Valores lidos dos campos (monetário: ${valorMonetarioAtual}, percentual: ${percentualAtual})`);
        console.log("lastEditedFieldType ANTES DO CÁLCULO:", lastEditedFieldType);

        // A lógica de qual campo calcular deve ser baseada no lastEditedFieldType
        // que foi setado pelo evento 'input'.

        if (lastEditedFieldType === 'valor') { // Se o último campo EDITADO foi o valor monetário
            if (vlrVendaOriginal > 0) {
                percentualAtual = (valorMonetarioAtual / vlrVendaOriginal) * 100;
            } else {
                percentualAtual = 0;
            }
            if (campoPercentual) {
                percentualAtual = Math.round(percentualAtual * 100) / 100; // Arredonda para 2 casas
                campoPercentual.value = formatarPercentual(percentualAtual);
                console.log(`Atualizando ${tipoCampo} Percentual (baseado em valor) para: ${campoPercentual.value}`);
            }
        } else if (lastEditedFieldType === 'percentual') { // Se o último campo EDITADO foi o percentual
            valorMonetarioAtual = vlrVendaOriginal * (percentualAtual / 100);
            if (campoValor) {
                valorMonetarioAtual = Math.round(valorMonetarioAtual * 100) / 100; // Arredonda para 2 casas
                campoValor.value = formatarMoeda(valorMonetarioAtual);
                console.log(`Atualizando ${tipoCampo} Valor (baseado em percentual) para: ${campoValor.value}`);
            }
        }
        // Se lastEditedFieldType for null, significa que foi um disparo inicial ou um caso atípico.
        // Neste caso, use o tipoValorAlterado que veio do evento.
        else {
            console.warn("lastEditedFieldType é null. Usando tipoValorAlterado do evento como fallback.");
            if (tipoValorAlterado === 'valor') {
                if (vlrVendaOriginal > 0) {
                    percentualAtual = (valorMonetarioAtual / vlrVendaOriginal) * 100;
                } else {
                    percentualAtual = 0;
                }
                if (campoPercentual) {
                    percentualAtual = Math.round(percentualAtual * 100) / 100; // Arredonda para 2 casas
                    campoPercentual.value = formatarPercentual(percentualAtual);
                    console.log(`Atualizando ${tipoCampo} Percentual (fallback) para: ${campoPercentual.value}`);
                }
            } else { // tipoValorAlterado === 'percentual'
                valorMonetarioAtual = vlrVendaOriginal * (percentualAtual / 100);
                if (campoValor) {
                    valorMonetarioAtual = Math.round(valorMonetarioAtual * 100) / 100; // Arredonda para 2 casas
                    campoValor.value = formatarMoeda(valorMonetarioAtual);
                    console.log(`Atualizando ${tipoCampo} Valor (fallback) para: ${campoValor.value}`);
                }
            }
        }


        // --- Lógica para zerar o campo "parceiro" se o campo alterado for zerado ---
        let valorDigitadoNoCampoAlterado;
        if (tipoValorAlterado === 'valor') { // Se o evento veio de um campo de valor
            valorDigitadoNoCampoAlterado = desformatarMoeda(campoAlterado.value || '0');
        } else { // Se o evento veio de um campo de percentual
            valorDigitadoNoCampoAlterado = desformatarPercentual(campoAlterado.value || '0');
        }

        if (valorDigitadoNoCampoAlterado === 0) {
            console.log("Campo alterado foi zerado. Zerando campo parceiro.");
            if (tipoValorAlterado === 'valor' && campoPercentual) {
                campoPercentual.value = formatarPercentual(0);
            } else if (tipoValorAlterado === 'percentual' && campoValor) {
                campoValor.value = formatarMoeda(0);
            }
        }

        recalcularLinha(linha); // Recalcula o total da linha

    } finally {
        isRecalculatingDiscountAcrescimo = false;
        // O RESET DE lastEditedFieldType DEVE ACONTECER FORA DESTE CONTEXTO SÓ QUANDO O USUÁRIO SAIU DE AMBOS OS CAMPOS
        // Para depuração, temporariamente não vamos zerar ele aqui.
        // lastEditedFieldType = null; // COMENTE ESTA LINHA POR ENQUANTO PARA DEPURAR O FLUXO
        console.log("DEBUG - recalcularDescontoAcrescimo - FIM. lastEditedFieldType APÓS RECALC (para depuração):", lastEditedFieldType);
    }
}

function aplicarMascaraMoeda() {
    // Formatar valores de <td> com a classe .Moeda
    document.querySelectorAll('td.Moeda').forEach(td => {
        let valor = parseFloat(td.textContent);
        console.log("valor1", valor);
        if (!isNaN(valor)) {
            td.textContent = valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        }
    });

    // Formatar inputs somente se forem readonly (apenas visual)
    document.querySelectorAll('input.Moeda[readonly]').forEach(input => {
        let valor = parseFloat(input.value);
        console.log("valor2", valor)
        if (!isNaN(valor)) {
            input.dataset.valorOriginal = input.value; // guarda o valor real
            input.value = valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        }
    });   

}

function removerMascaraMoedaInputs() {
    document.querySelectorAll('input.Moeda[readonly]').forEach(input => {
        if (input.dataset.valorOriginal) {
            input.value = input.dataset.valorOriginal;
        }
    });
}

// Chame após o cálculo ou inserção de valores
aplicarMascaraMoeda();

function bloquearCamposSeFechado() {
    const statusInput = document.getElementById('Status');
    const fechado = statusInput?.value === 'Fechado';

    const idsPermitidos = ['Desconto', 'perCentDesc', 'Acrescimo', 'perCentAcresc', 'ObservacaoProposta', 'Observacao'];

    const tabela = document.querySelector('table');

    if (fechado) {
        const campos = document.querySelectorAll('input, select, textarea');
        campos.forEach(campo => {
            const id = campo.id;
            const dentroDeAdicional = campo.closest('.linhaAdicional');

            // NÃO bloquear se estiver em linha adicional ou for permitido
            if (
                campo.classList.contains('idFuncao') ||
                campo.classList.contains('idEquipamento') ||
                campo.classList.contains('idSuprimento') ||
                idsPermitidos.includes(id) ||
                dentroDeAdicional
            ) return;

            campo.readOnly = true;
            campo.disabled = true;
            campo.classList.add('bloqueado');
        });

        // Gerencia os botões
        const botoes = document.querySelectorAll('button');
        botoes.forEach(botao => {
            const id = botao.id || '';
            const classes = botao.classList;

            const deveContinuarAtivo =
                id === 'btnSalvar' ||
                id === 'Proposta' ||
                id === 'Close' ||
                classes.contains('Close') ||
                classes.contains('pesquisar') ||
                classes.contains('Adicional') ||
                classes.contains('Excel') ;

            if (id === 'fecharOrc' || id === 'adicionar' || id ==='Excel' || id === 'adicionarLinha') {
                botao.style.display = 'none';
            } else if (deveContinuarAtivo) {
                botao.style.display = 'inline-block';
                botao.disabled = false;
            } else {
                botao.disabled = true;
            }
        });

        // Altera a cor da tabela
        if (tabela) {
            tabela.classList.add('bloqueada');
        }

        // Adiciona alerta ao tentar editar manualmente (exceto os permitidos ou da linha adicional)
        const elementosEditaveis = document.querySelectorAll('input, select, textarea, .Proposta input');
        elementosEditaveis.forEach(el => {
            const id = el.id;
            const dentroDeAdicional = el.closest('.linhaAdicional');

            if (
                el.classList.contains('idFuncao') ||
                el.classList.contains('idEquipamento') ||
                el.classList.contains('idSuprimento') ||
                idsPermitidos.includes(id) ||
                dentroDeAdicional
            ) return;

            el.addEventListener('focus', () => {
                Swal.fire('Orçamento fechado', 'Este orçamento está fechado. Não é possível fazer alterações, apenas inserir adicionais.', 'warning');
                el.blur();
            });
        });

    } else {
        // Desbloqueia todos os campos
        const campos = document.querySelectorAll('input, select, textarea');
        campos.forEach(campo => {
            campo.classList.remove('bloqueado');
            campo.readOnly = false;
            campo.disabled = false;
        });

        // Botão de fechar visível e habilitado
        const btnFechar = document.getElementById('fecharOrc');
        if (btnFechar) {
            btnFechar.style.display = 'inline-block';
            btnFechar.disabled = false;
        }

        // Oculta botões adicionais (caso algum deva sumir com status "aberto")
        const btnAdicional = document.querySelectorAll('.Adicional');
        btnAdicional.forEach(btn => {
            btn.style.display = 'none';
        });

        // Remove o visual de bloqueio da tabela
        if (tabela) {
            tabela.classList.remove('bloqueada');
        }
    }
}

document.getElementById('fecharOrc').addEventListener('click', function(event) {
    event.preventDefault();
    fecharOrcamento();
});

function fecharOrcamento() {
const statusInput = document.getElementById('Status');

if (statusInput.value === 'Fechado') {
    Swal.fire('Orçamento fechado', 'Este orçamento está fechado e não pode ser alterado.', 'warning');
    return;
}

Swal.fire({
    title: 'Deseja realmente fechar este orçamento?',
    text: "Você não poderá reabrir diretamente.",
    icon: 'warning',
    showCancelButton: true,
    cancelButtonText: 'Cancelar',
    confirmButtonText: 'Sim, fechar',
    reverseButtons: true,
    focusCancel:true
}).then((result) => {
    if (result.isConfirmed) {
    statusInput.value = 'Fechado';
    bloquearCamposSeFechado();
    Swal.fire('Fechado!', 'O orçamento foi fechado com sucesso.', 'success');
    }
});
}


document.getElementById('Proposta').addEventListener('click', function(event) {
    event.preventDefault();
    WordOuPdf();
});

async function WordOuPdf() {
  Swal.fire({
    title: "Como deseja gerar o documento?",
    icon: "question",
    showCancelButton: true,
    confirmButtonText: `<i class="fa-regular fa-file-pdf" style="height: 20px; vertical-align: middle; margin-right: 5px;"></i> <b>Gerar PDF</b>`,
    cancelButtonText: `<i class="fa-regular fa-file-word" style="height: 20px; vertical-align: middle; margin-right: 5px;"></i> <b>Gerar Word</b>`,
    reverseButtons: true,
    customClass: {
      confirmButton: 'botao-pdf',
      cancelButton: 'botao-word'
    }
  }).then((result) => {
    if (result.isConfirmed) {
      gerarPropostaPDF();
    } else if (result.dismiss === Swal.DismissReason.cancel) {
      gerarPropostaWord();
    }
  });
}


async function gerarPropostaPDF() {
console.log("🚀 Versão atualizada da função gerarPropostaPDF executada");

    if (!window.jspdf || !window.jspdf.jsPDF) {
        console.error('jsPDF não carregado.');
        return;
    }

    const { jsPDF } = window.jspdf;
    const img = new Image();
    img.src = 'img/Fundo Propostas.png';

    img.onload = async function () {
        console.log("Imagem de fundo carregada");

        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margemRodape = 15;
        const limiteInferior = pageHeight - margemRodape;
        const lineHeight = 7;
        const x = 25;
        const tituloFontSize = 15;
        const textoFontSize = 10;
        
        let y = 50;

         function addNewPage() {
            doc.addPage();
            doc.addImage(img, 'PNG', 0, 0, pageWidth, pageHeight);
            y = 50; // Redefine a posição y para a nova página
        }

        // --- Função auxiliar para adicionar linhas com verificação de quebra de página ---
        function adicionarLinha(texto, fontSize = textoFontSize, bold = false, customLineHeight = lineHeight, alinhadoCentro = true) {
            if (y + customLineHeight > limiteInferior) {
                addNewPage();
            }

            doc.setFontSize(fontSize);
            doc.setFont('helvetica', bold ? 'bold' : 'normal');

            const posX = alinhadoCentro
                ? (pageWidth - doc.getTextWidth(texto)) / 2
                : x;

            doc.text(texto, posX, y);
            y += customLineHeight;
        }

    function formatarDataBR(dataStr) {
    if (!dataStr || dataStr.trim() === "") return "null";
    const [ano, mes, dia] = dataStr.split("-");
    if (!ano || !mes || !dia) return "null";
    return `${dia}/${mes}/${ano}`;
}

        doc.addImage(img, 'PNG', 0, 0, pageWidth, pageHeight);

        console.log("Buscando dados do formulário");

        const clienteSelect = document.querySelector('.idCliente');
        const nomeCliente = clienteSelect?.options[clienteSelect.selectedIndex]?.innerText || "N/D";
        const eventoSelect = document.querySelector('.idEvento');
        const nomeEvento = eventoSelect?.options[eventoSelect.selectedIndex]?.innerText || "N/D";
        const montagemSelect = document.querySelector('.idMontagem');
        const localEvento = montagemSelect?.options[montagemSelect.selectedIndex]?.innerText || "N/D";
        const pavilhaoSelect = document.querySelector('.idPavilhao');
        const nmPavilhao = pavilhaoSelect?.options[pavilhaoSelect.selectedIndex]?.innerText || "N/D";
        const inputMarcacao = document.getElementById('periodoMarcacao')?.value?.trim().replace(" to ", " até ") ||  "N/D" ; 
        const inputMontagem = document.getElementById('periodoMontagem')?.value?.trim().replace(" to ", " até ") ||  "N/D" ; 
        const inputRealizacao = document.querySelector('.realizacao')?.value?.trim().replace(" to ", " até ") ||  "N/D" ; 
        const inputDesmontagem = document.getElementById('periodoDesmontagem')?.value?.trim().replace(" to ", " até ") ||  "N/D" ; 
        const dataAtual = new Date();
        const anoAtual = dataAtual.getFullYear();
        const valorProposta = document.getElementById('valorCliente')?.value?.trim() || "R$ XX";

        

        let dadosContato = { nmcontato: "N/D", celcontato: "N/D", emailcontato: "N/D" };

        try {
            console.log("🔍 Iniciando busca dos dados do cliente...");
            console.log("➡️ Nome do cliente:", nomeCliente);

            const url = `clientes?nmfantasia=${encodeURIComponent(nomeCliente)}`;
            console.log("🌐 URL chamada:", url);

            const dados = await fetchComToken(url); // ✅ Aqui está o fetch correto
            console.log("🧾 JSON retornado:", dados);

            const cliente = Array.isArray(dados)
                ? dados.find(c => c.nmfantasia.trim().toLowerCase() === nomeCliente.trim().toLowerCase())
                : dados;
            console.log("👤 Cliente encontrado:", cliente);

            if (cliente) {
                dadosContato = {
                    nmcontato: cliente.nmcontato || "N/D",
                    celcontato: cliente.celcontato || "N/D",
                    emailcontato: cliente.emailcontato || "N/D"
                };
                console.log("✅ Dados de contato definidos:", dadosContato);
            } else {
                console.warn("⚠️ Nenhum cliente correspondente encontrado.");
            }

        } catch (erro) {
            console.warn("❌ Erro ao buscar dados do cliente:", erro);
        }

        doc.setFontSize(tituloFontSize);
        doc.setTextColor("#FF0901");
        doc.text("PROPOSTA DE SERVIÇOS", x, y);
        y += 50;
        doc.setTextColor(0, 0, 0);

        const cabecalho = [["Descrição", "Detalhe"]];

        const dados = [
        ["Cliente", nomeCliente],
        ["Responsável", `${dadosContato.nmcontato} - Celular: ${dadosContato.celcontato} - Email: ${dadosContato.emailcontato}`],
        ["Evento", `${nomeEvento} - Local: ${localEvento} - Pavilhão: ${nmPavilhao}`],
        ["Marcação", inputMarcacao],
        ["Montagem", inputMontagem],
        ["Realização", inputRealizacao],
        ["Desmontagem", inputDesmontagem],
        ];

        doc.autoTable({
        startY: 60, // onde começa no PDF
        head: cabecalho,
        body: dados,
        foot: [['\u200B', '\u200B']],

        styles: {
            fontSize: 10,
            cellPadding: 1,
            valign: 'middle',
            fillColor: false,
        },
        headStyles: {
            fillColor: [238, 47, 52],
            textColor: 255,
            fontStyle: 'bold',
        },
        footStyles: {
            fillColor: [238, 47, 52],
            cellPadding: { top: 1, bottom: 1, left: 1, right: 1 },
            fontSize: 1,
        },
        columnStyles: {
            0: { cellWidth: 50, fontStyle: 'bold' }, // Coluna "Campo"
            1: { cellWidth: 'auto' },               // Coluna "Informação"
        },
        });
        y += 25;

        doc.setFontSize(tituloFontSize);
        adicionarLinha("Escopo da proposta:");

        function escreverLinhaComCapsEmBold(texto, posX, posY, larguraMaxima) {
    const palavras = texto.split(" ");
    let cursorX = posX;
    const lineHeight = 4;

    for (let i = 0; i < palavras.length; i++) {
        const palavra = palavras[i];
        const ehCapslock = palavra === palavra.toUpperCase() && palavra.match(/[A-Z]/);

        doc.setFont(undefined, ehCapslock ? "bold" : "normal");
        const larguraPalavra = doc.getTextWidth(palavra + " ");

        // Quebra de linha automática
        if (cursorX + larguraPalavra > posX + larguraMaxima) {
            posY += lineHeight;
            cursorX = posX;

            // 🔥 VERIFICAÇÃO de espaço por linha
            if (posY > limiteInferior) {
                addNewPage();
                posY = y; // Atualiza a coordenada y global após a nova página
            }
        }

        doc.text(palavra + " ", cursorX, posY);
        cursorX += larguraPalavra;
    }

    y = posY + lineHeight; // 🔁 Atualiza `y` global para a próxima chamada
    return y;
}

        // Observações sobre a Proposta
        const propostaObs2 = document.querySelector('.Propostaobs2');
        const checkboxProposta = propostaObs2?.querySelector('.checkbox__trigger');
        const textoProposta = propostaObs2?.querySelector('.PropostaobsTexto')?.value?.trim();

        if (checkboxProposta?.checked && textoProposta) {

            y += 10;
            // adicionarLinha("Observações sobre a Proposta:", 12, true);

            const linesToPrintProposta = doc.splitTextToSize(textoProposta, pageWidth - 2 * x);
            const estimatedHeightProposta = linesToPrintProposta.length * 5 + 10;

            if (y + estimatedHeightProposta > limiteInferior) {
                addNewPage();
            }

            linesToPrintProposta.forEach(linha => {
                if (y + 5 > limiteInferior) { // Verifica espaço para cada linha
                    addNewPage();
                }
                doc.setFontSize(11);

                // Usando a função que imprime palavras em capslock em negrito
                y = escreverLinhaComCapsEmBold(linha, x, y, pageWidth - 2 * x);
            });
        }

        y += 10;
        if (y + 10 > limiteInferior) { // Verifica espaço para a linha de resumo
                addNewPage();
        }

        let textoResumo = "";
        doc.setFontSize(8);
        doc.setFont(undefined, 'normal');
        const textWidth = doc.getTextWidth(textoResumo);
        const xCentralizado = (pageWidth - textWidth) / 2;
        doc.text(textoResumo, xCentralizado, y);
        y += 10;
    

    function capitalizarPalavras(texto) {
    return texto
        .toLowerCase()
        .replace(/\b\w/g, letra => letra.toUpperCase());
    }
const tabela = document.getElementById('tabela');
const linhas = tabela?.querySelectorAll('tbody tr') || [];
const categoriasMap = {};
const adicionais = [];

// 1. Processa cada linha da tabela
linhas.forEach(linha => {
    const checkbox = linha.querySelector('.Proposta input');
    if (!checkbox || !checkbox.checked) return;

    const qtdItens = linha.querySelector('.qtdProduto input')?.value?.trim();
    const produto = linha.querySelector('.produto')?.innerText?.trim();
    const setor = linha.querySelector('.setor-input')?.value?.trim();
    const qtdDias = linha.querySelector('.qtdDias input')?.value?.trim();
    let categoria = linha.querySelector('.Categoria')?.innerText?.trim();

    const datasRaw = linha.querySelector('.datas')?.value?.trim().replace(" to ", " até: ") || "";

    const produtoFormatado = capitalizarPalavras(produto);
    let itemDescricao = `• ${qtdItens} ${produtoFormatado}`;

    if (setor && setor.toLowerCase() !== 'null' && setor !== '') {
        itemDescricao += `, (${setor})`;
    }

    if (qtdDias !== '0') {
        itemDescricao += `, ${qtdDias} Diária(s), de: ${datasRaw}`;
    }

    const isLinhaAdicional = linha.classList.contains('linha-adicional');

    if (qtdItens !== '0') {
        if (isLinhaAdicional) {
            adicionais.push(itemDescricao);
        } else {
            // Renomeia apenas visualmente
            if (categoria === "Produto(s)") {
                categoria = "Equipe Operacional";
            }

            const nomeCategoria = categoria || "Outros";
            if (!categoriasMap[nomeCategoria]) categoriasMap[nomeCategoria] = [];
            categoriasMap[nomeCategoria].push(itemDescricao);
        }
    }
});

        // 2. Ordem fixa desejada para exibir no PDF
        const ordemCategorias = ["Equipe Operacional", "Equipamento(s)", "Suprimento(s)"];

        // 3. Primeiro: renderiza categorias na ordem fixa
        ordemCategorias.forEach(categoria => {
            const itens = categoriasMap[categoria];
            if (!itens) return;

            const estimatedCategoryHeight = lineHeight + (itens.length * lineHeight) + 5;
            if (y + estimatedCategoryHeight > limiteInferior) {
                addNewPage();
            }

            y += 10;
            doc.setFont(undefined, 'bold');
            doc.setFontSize(11);
            doc.text(categoria.toUpperCase(), x, y);
            y += 7;

            itens.forEach(item => adicionarLinha(item, textoFontSize, false, lineHeight, false));
            y += 5;

            delete categoriasMap[categoria]; // Remove já exibidos
        });

        // 4. Em seguida: exibe categorias restantes (extras, se houver)
        for (const [categoria, itens] of Object.entries(categoriasMap)) {
            const estimatedCategoryHeight = lineHeight + (itens.length * lineHeight) + 5;
            if (y + estimatedCategoryHeight > limiteInferior) {
                addNewPage();
            }

            y += 10;
            doc.setFont(undefined, 'bold');
            doc.setFontSize(11);
            doc.text(categoria.toUpperCase(), x, y);
            y += 7;

            itens.forEach(item => adicionarLinha(item, textoFontSize, false, lineHeight, false));
            y += 5;
        }

        // 5. Adicionais
        if (adicionais.length > 0) {
            y += 10;
            const estimatedAdicionaisHeight = lineHeight + (adicionais.length * lineHeight);
            if (y + estimatedAdicionaisHeight > limiteInferior) {
                addNewPage();
            }
            y += 10;
            doc.setFont(undefined, 'bold');
            doc.setFontSize(11);
            doc.text("ADICIONAIS:", x, y);
            y += 7;

            adicionais.forEach(item => adicionarLinha(item, textoFontSize, false, false));
        }

        // 6. Observações sobre os Itens
        const checkboxItens = document.querySelectorAll('.Propostaobs1 .checkbox__trigger')[0];
        const textoItens = document.querySelectorAll('.PropostaobsTexto')[0]?.value?.trim();

        if (checkboxItens && checkboxItens.checked && textoItens) {
            y += 10;
            adicionarLinha("Observações sobre os Itens:", 12, true);

            const linesToPrintItens = doc.splitTextToSize(textoItens, pageWidth - 2 * x);
            const estimatedHeightItens = linesToPrintItens.length * 5;

            if (y + estimatedHeightItens > limiteInferior) {
                addNewPage();
            }

            linesToPrintItens.forEach(linha => {
                if (y + 5 > limiteInferior) {
                    addNewPage();
                }
                doc.setFontSize(textoFontSize);
                doc.setFont('helvetica', 'normal');
                doc.text(linha, x, y);
                y += 5;
            });
            y += 5;
        }
        doc.addPage();
        doc.addImage(img, 'PNG', 0, 0, pageWidth, pageHeight);
        y = 50;

            doc.setFont(undefined, 'bold');
            doc.setFontSize(11);
            doc.text("SUPORTE TÉCNICO", x, y); // Categoria à esquerda
            y += 7;

        doc.splitTextToSize("Caso seja necessário suporte técnico para as impressoras, a diária adicional é de R$ XX.", pageWidth - 2 * x)
            .forEach(linha => adicionarLinha(linha));
        y += 10;

            doc.setFont(undefined, 'bold');
            doc.setFontSize(11);
            doc.text("INVESTIMENTO", x, y);
            y += 7;
        doc.splitTextToSize(`O valor para a execução desta proposta para ${anoAtual} é de ${valorProposta}  Incluso no valor todos os custos referentes honorários de funcionários e prestadores de serviços, impostos fiscais devidos que deverão ser recolhidos pela JA Promoções e Eventos, arcando inclusive com as eventuais sanções legais oriundas do não cumprimento dessas obrigações.`, pageWidth - 2 * x)
            .forEach(linha => adicionarLinha(linha));
        y += 10;

        const propostaObs3 = document.querySelector('.Propostaobs3');
        const checkboxPagamento = propostaObs3?.querySelector('.checkbox__trigger');
        const textoPagamento = propostaObs3?.querySelector('#formaPagamento')?.value?.trim();

        if (checkboxPagamento?.checked && textoPagamento) {
            y += 10;
            adicionarLinha("", textoFontSize, true);
            doc.setFont(undefined, 'bold');
            doc.setFontSize(11);
            doc.text("FORMA DE PAGAMENTO", x, y);
            y += 7;

            const linhasPagamento = doc.splitTextToSize(textoPagamento, pageWidth - 2 * x);
                const lineHeightOriginal = lineHeight;
    const lineHeightReduzido = 5; // ou 4, se quiser ainda mais compacto
    linhasPagamento.forEach(linha => {
        if (y + lineHeightReduzido > limiteInferior) {
            doc.addPage();
            doc.addImage(img, 'PNG', 0, 0, pageWidth, pageHeight);
            y = 50;
        }
        doc.setFontSize(textoFontSize);
        doc.setFont('helvetica', 'normal');
        const textWidth = doc.getTextWidth(linha);
        const centroX = (pageWidth - textWidth) / 2;
        doc.text(linha, centroX, y);
        y += lineHeightReduzido;
    });
    y+= 10;
}


        doc.setFontSize(10);
        adicionarLinha("*Prazos de pagamento sujeitos a alteração conforme necessidade e acordo. ");

        
        const dataFormatada = dataAtual.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });

        const dataEstiloTexto = `*${dataFormatada.replace(/^(\d{2}) de/, '$1 de')}*`;
        y += 10;

        doc.setFontSize(11);
        adicionarLinha(`São Paulo, ${dataFormatada}`);
        adicionarLinha("João S. Neto");
        adicionarLinha("Diretor Comercial");

        const nomeArquivoSalvar = `${nomeEvento.replace(/[^\w\s]/gi, '').replace(/\s+/g, '_')}_${dataFormatada}.pdf`;
        const pdfBlob = doc.output('blob');
        const link = document.createElement('a');
        link.href = URL.createObjectURL(pdfBlob);
        link.download = nomeArquivoSalvar;
        link.click();
    };
}


function exportarParaExcel() {
  const linhas = document.querySelectorAll("#tabela tbody tr");
  const dados = [];

  // Cabeçalhos
  const cabecalhos = [
    "P/ Proposta", "Categoria", "Qtd Itens", "Produto", "Setor", "Qtd Dias", "Período das diárias",
    "Desconto", "Acréscimo", "Vlr Diária", "Tot Venda Diária", "Cto Diária", "Tot Custo Diária",
    "AjdCusto Alimentação", "AjdCusto Transporte", "Tot AjdCusto", "Hospedagem", "Transporte", "Tot Geral"
  ];
  dados.push(cabecalhos);

  // Linhas da tabela
  linhas.forEach(tr => {
    const linha = [];

    linha.push(tr.querySelector('input[type="checkbox"]')?.checked ? "Sim" : "Não");
    linha.push(tr.querySelector(".Categoria")?.innerText.trim() || "");
    linha.push(tr.querySelector(".qtdProduto input")?.value || "0");
    linha.push(tr.querySelector(".produto")?.innerText.trim() || "");
    linha.push(tr.querySelector(".setor")?.innerText.trim() || "");
    linha.push(tr.querySelector(".qtdDias input")?.value || "0");
    linha.push(tr.querySelector(".datas")?.value || "");

    const descontoValor = tr.querySelector(".descontoItem .ValorInteiros")?.value || "R$ 0,00";
    const descontoPerc = tr.querySelector(".descontoItem .valorPerCent")?.value || "0%";
    linha.push(`${descontoValor} (${descontoPerc})`);

    const acrescValor = tr.querySelector(".acrescimoItem .ValorInteiros")?.value || "R$ 0,00";
    const acrescPerc = tr.querySelector(".acrescimoItem .valorPerCent")?.value || "0%";
    linha.push(`${acrescValor} (${acrescPerc})`);

    linha.push(tr.querySelector(".vlrVenda")?.innerText.trim() || "");
    linha.push(tr.querySelector(".totVdaDiaria")?.innerText.trim() || "");
    linha.push(tr.querySelector(".vlrCusto")?.innerText.trim() || "");
    linha.push(tr.querySelector(".totCtoDiaria")?.innerText.trim() || "");

    const selectAlim = tr.querySelectorAll(".ajdCusto select")[0];
    linha.push(selectAlim?.value || "");

    const selectTrans = tr.querySelectorAll(".ajdCusto select")[1];
    linha.push(selectTrans?.value || "");

    linha.push(tr.querySelector(".totAjdCusto")?.innerText.trim() || "0");
    linha.push(tr.querySelector("input.hospedagem")?.value || "");
    linha.push(tr.querySelector("input.transporteExtraInput")?.value || "");
    linha.push(tr.querySelector(".totGeral")?.innerText.trim() || "0");

    dados.push(linha);
  });

  // Criar planilha
  const ws = XLSX.utils.aoa_to_sheet(dados);

  // Aplicar largura das colunas
  ws['!cols'] = [
    { wch: 10 }, { wch: 14 }, {  wch: 9 }, {  wch: 20 }, { wch: 9 },
    { wch: 20 }, {  wch: 13 }, {  wch: 13 }, {  wch: 13 }, {  wch: 15 },
    {  wch: 11 }, {  wch: 15 }, {  wch: 19 }, {  wch: 18 }, {  wch: 16 },
    {  wch: 20 }, {  wch: 20 }, {  wch: 15 }
  ];

  // Aplicar estilo no cabeçalho (linha 0)
  const headerStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" } }, // texto branco
    fill: { fgColor: { rgb: "2f3330" } },           // fundo azul
    alignment: { horizontal: "center", vertical: "center" },
    border: {
        top: { style: "thin", color: { rgb: "000000" } },
        bottom: { style: "thin", color: { rgb: "000000" } },
        left: { style: "thin", color: { rgb: "000000" } },
        right: { style: "thin", color: { rgb: "000000" } }
    }
    };
  const range = XLSX.utils.decode_range(ws['!ref']);

// Aplica estilo ao cabeçalho
for (let C = range.s.c; C <= range.e.c; ++C) {
  const cellAddress = XLSX.utils.encode_cell({ r: 0, c: C });
  if (!ws[cellAddress]) continue;
  ws[cellAddress].s = headerStyle;
}

// Alinha todas as células ao centro
for (let R = range.s.r; R <= range.e.r; ++R) {
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
    if (!ws[cellAddress]) continue;
    if (!ws[cellAddress].s) ws[cellAddress].s = {};
    ws[cellAddress].s.alignment = { horizontal: "center", vertical: "center" };
  }
}
  // Criar e salvar arquivo
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Orçamento");
  XLSX.writeFile(wb, "orcamento_formatado.xlsx");
}

function configurarEventosOrcamento() {
    console.log("Configurando eventos Orcamento...");
    //inicializarFlatpickrsGlobais(); 
    initializeAllFlatpickrsInModal();
    verificaOrcamento();   
    

    console.log("Entrou configurar Orcamento no ORCAMENTO.js.");
} 

window.configurarEventosOrcamento = configurarEventosOrcamento;

function configurarEventosEspecificos(modulo) {
  console.log("⚙️ configurarEventosEspecificos recebeu:", modulo);
  
  if (modulo.trim().toLowerCase() === 'orcamentos') {
    
    initializeAllFlatpickrsInModal();
    configurarEventosOrcamento();    

    if (typeof aplicarPermissoes === "function" && window.permissoes) {
      aplicarPermissoes(window.permissoes);
    } else {
      console.warn("⚠️ aplicarPermissoes ou window.permissoes ainda não estão disponíveis.");
    }
  
  }
}
window.configurarEventosEspecificos = configurarEventosEspecificos;

  document.addEventListener("DOMContentLoaded", function () {
     const orcamento = JSON.parse(sessionStorage.getItem("orcamentoSelecionado") || "{}");

    if (orcamento?.nrorcamento) {
      document.getElementById("nrOrcamento").textContent = orcamento.nrorcamento;
      // ...adicione os campos necessários
    }
  });

  window.moduloHandlers = window.moduloHandlers || {};

window.moduloHandlers['Orcamentos'] = { // A chave 'Orcamentos' deve ser a mesma do seu mapaModulos no Index.js
    configurar: verificaOrcamento,
    desinicializar: desinicializarOrcamentosModal
};

console.log(`Módulo Orcamentos.js registrado em window.moduloHandlers`);