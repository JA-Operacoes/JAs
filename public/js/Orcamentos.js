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
      //  console.log("Flatpickr inicializado para nova linha adicionada:", novoInputData);
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
    tabela.insertBefore(novaLinha, tabela.firstChild);

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
             //   console.log(`Flatpickr global #${id} destruído.`);
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
          //  console.log(`Flatpickr inicializado para campo global #${id}`);
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

        let inputIdFuncao = ultimaLinha.querySelector("input.idFuncao");
        let inputIdEquipamento = ultimaLinha.querySelector("input.idEquipamento");
        let inputIdSuprimento = ultimaLinha.querySelector("input.idSuprimento");

        if(inputIdFuncao) inputIdFuncao.value = '';
        if(inputIdEquipamento) inputIdEquipamento.value = '';
        if(inputIdSuprimento) inputIdSuprimento.value = '';
        
        // Atribui o NOME do produto ao texto da célula
        if (celulaProduto) {
            // AQUI ESTÁ A CHAVE: o texto da célula recebe o NOME, e não o ID.
            celulaProduto.textContent = produtoSelecionado;
        }

        if (celulaCategoria && Categoria !== "Pavilhao") {
            celulaCategoria.textContent = Categoria;
        }

        console.log(" A categoria é :", Categoria)

        if (select.classList.contains("idFuncao")) {
            inputIdFuncao.value = valorSelecionado;
        } else if (select.classList.contains("idEquipamento")) {
            inputIdEquipamento.value = valorSelecionado;
        } else if (select.classList.contains("idSuprimento")) {
            inputIdSuprimento.value = valorSelecionado;
        }

        // if (celulaProduto && (celulaProduto.textContent === "" || select.classList.contains("idEquipamento") || select.classList.contains("idSuprimento") || select.classList.contains("idFuncao"))) {
        //     celulaProduto.textContent = produtoSelecionado;

        //     if (select.classList.contains("idFuncao"))
        //     {
        //         celulaIdFuncao.textContent = valorSelecionado;
        //         console.log(" produto escolhido foi:", produtoSelecionado, "Funcao: ", select.classList.contains("idFuncao"), "Equipamento: ", select.classList.contains("idEquipamento"), "Suprimento: ",select.classList.contains("idSuprimento"), celulaIdFuncao);
        //     }

        //     if (select.classList.contains("idEquipamento"))
        //     {
        //         celulaIdEquipamento.textContent = valorSelecionado;
        //         console.log(" produto escolhido foi:", produtoSelecionado, "Funcao: ", select.classList.contains("idFuncao"), "Equipamento: ", select.classList.contains("idEquipamento"), "Suprimento: ",select.classList.contains("idSuprimento"));

        //     }
        //     if (select.classList.contains("idSuprimento"))
        //     {
        //         celulaIdSuprimento.textContent = valorSelecionado;
        //         console.log(" produto escolhido foi:", produtoSelecionado, "Funcao: ", select.classList.contains("idFuncao"), "Equipamento: ", select.classList.contains("idEquipamento"), "Suprimento: ",select.classList.contains("idSuprimento"));

        //     }

        //    // celulaIdEquipamento.textContent = select.classList.contains("idEquipamento");
        //     //celulaIdSuprimento.textContent = select.classList.contains("idSuprimento");
        //    // console.log(" produto escolhido foi:", produtoSelecionado, "Funcao: ", select.classList.contains("idFuncao"), "Equipamento: ", select.classList.contains("idEquipamento"), "Suprimento: ",select.classList.contains("idSuprimento"));
        // }


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
                nomenclatura: document.querySelector("#nomenclatura")?.value,
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
                formaPagamento: formData.get("formaPagamento"),
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

    console.log("DEBUG FRONTEND: Quantidade de linhas encontradas por querySelectorAll:", linhas.length, linhas);


            linhas.forEach((linha) => {

                const item = {

                    id: parseInt(linha.querySelector(".idItemOrcamento")?.value) || null,
                    nrorcamento: parseInt(linha.querySelector(".nrOrcamento")?.value) || null,
                    enviarnaproposta: linha.querySelector('.Proposta input[type="checkbox"]')?.checked || false,
                    categoria: linha.querySelector(".Categoria")?.textContent.trim(),
                    qtditens: parseInt(linha.querySelector(".qtdProduto input")?.value) || 0,
                    idfuncao: parseInt(linha.querySelector(".idFuncao")?.value) || null,
                    idequipamento: parseInt(linha.querySelector(".idEquipamento")?.value) || null,
                    idsuprimento: parseInt(linha.querySelector(".idSuprimento")?.value) || null,
                    produto: linha.querySelector(".produto")?.textContent.trim(),
                    setor: linha.querySelector(".setor-input")?.value?.trim().toUpperCase() || null,

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

                console.log("valorPeriodoInput", valorPeriodoInput, item.idfuncao, item.idequipamento, item.idsuprimento);

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
                    }  else if (partes.length === 1) {
                        // Única data: "DD/MM/YYYY"
                        dataInicioFormatada = formatarDataParaBackend(partes[0]);
                        dataFimFormatada = formatarDataParaBackend(partes[0]); // Corrigido aqui!
                    } else {
                        // Formato inválido ou inesperado
                        dataInicioFormatada = null;
                        dataFimFormatada = null;
                    }
                }

                // ATRIBUIÇÃO CORRETA:
                item.periododiariasinicio = dataInicioFormatada;
                item.periododiariasfim = dataFimFormatada; // <--- AGORA ESTAMOS ATRIBUINDO A DATA DE FIM SEPARADAMENTE

                console.log("ITENS", item);

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

    const nomenclaturaInput = document.getElementById('nomenclatura');
    if (nomenclaturaInput) { // Adicionado if
        nomenclaturaInput.value = orcamento.nomenclatura || '';
    } else {
        console.warn("Elemento 'nomenclatura' não encontrado.");
    }

    // Define os valores dos selects.
    // Como os 'value' das options agora são os IDs, a atribuição direta funciona.
    const statusInput = document.getElementById('Status'); // Seu HTML mostra input type="text"

    if (statusInput) {
        statusInput.value = orcamento.status || '';
        console.log("Status", statusInput.value);

        if (statusInput.value === 'F'){
            bloquearCamposSeFechado();
        }
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

    const formaPagamentoInput = document.getElementById('formaPagamento');
    if (formaPagamentoInput) {
        formaPagamentoInput.value = orcamento.formapagamento || '';
    } else {
        console.warn("Elemento com ID 'FormaPagamento' (Forma Pagamento) não encontrado.");
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
        newRow.dataset.idequipamento = item.idequipamento || '';
        newRow.dataset.idsuprimento = item.idsuprimento || '';
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

        console.log("DEBUG: SETOR", item.setor, "Funcao", item.idfuncao, "Equipamento", item.idequipamento, "Suprimento", item.idsuprimento);

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

    });

    aplicarMascaraMoeda();

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
        let hospedagemValor = desformatarMoeda(linha.querySelector('.hospedagem')?.value) || 0;
        let transporteExtraValor = desformatarMoeda(linha.querySelector('.transporteExtraInput')?.value) || 0;

        console.log("HOSPEDAGEM E TRANSPORTE EXTRA:", hospedagemValor, transporteExtraValor);


        // let vlrAjdCusto =  vlrCusto + totalAlimentacaoLinha + totalTransporteLinha + hospedagemValor;
        let vlrAjdCusto =  vlrCusto + totalAlimentacaoLinha + totalTransporteLinha;

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
//     } else { // tipoCampo === 'acrescimo'('idFuncao')
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
    const fechado = statusInput?.value === 'F';

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
                id === 'Close' ||
                classes.contains('Close') ||
                classes.contains('pesquisar') ||
                classes.contains('Adicional') ||
                classes.contains('Excel') ||
                classes.contains('Contrato') ;

            if (id === 'fecharOrc' || id ==='Excel' || classes ==='Contrato' || id === 'adicionarLinha') {
                botao.style.display = 'none';
            } else if (deveContinuarAtivo) {
                botao.style.display = 'inline-block';
                botao.disabled = false;
            } else {
                botao.disabled = true;
            }
            if (id === 'Proposta' || classes.contains('Proposta')) {
            botao.disabled = true;
            botao.style.display = 'none'; // ou só desabilita se preferir
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

    if (statusInput.value === 'F') {
        Swal.fire('Orçamento fechado', 'Este orçamento está fechado e não pode ser alterado.', 'warning');
        return;
    }


    // Swal.fire({
    //     title: 'Deseja realmente fechar este orçamento?',
    //     text: "Você não poderá reabrir diretamente.",
    //     icon: 'warning',
    //     showCancelButton: true,
    //     cancelButtonText: 'Cancelar',
    //     confirmButtonText: 'Sim, fechar',
    //     reverseButtons: true,
    //     focusCancel:true
    // }).then((result) => {
    //     if (result.isConfirmed) {
    //     statusInput.value = 'F';
    //     bloquearCamposSeFechado();
    //     Swal.fire('Fechado!', 'O orçamento foi fechado com sucesso.', 'success');
    //     }
    // });
    Swal.fire({
        title: 'Deseja realmente fechar este orçamento?',
        text: "Você não poderá reabrir diretamente.",
        icon: 'warning',
        showCancelButton: true,
        cancelButtonText: 'Cancelar',
        confirmButtonText: 'Sim, fechar',
        reverseButtons: true,
        focusCancel:true
    }).then(async (result) => { // Adicionado 'async' aqui para usar 'await'
        if (result.isConfirmed) {
            try {

                const idOrcamento = document.getElementById('idOrcamento')?.value;
                const orcamentoIdNumerico = parseInt(idOrcamento, 10);

                if (!orcamentoIdNumerico || isNaN(orcamentoIdNumerico)) {
                    Swal.fire('Erro!', 'ID do orçamento inválido. Salve-o antes de fechar.', 'error');
                    return;
                }
                // 1. Prepare os dados para enviar ao backend
                const resultado = await fetchComToken(`orcamentos/fechar/${orcamentoIdNumerico}`, {
                    method: 'PUT',
                    // Não precisa de body, o status 'F' é definido no backend
                });

                // Verifique a resposta e atualize a UI
                if (resultado.message) {
                    document.getElementById('Status').value = 'F'; // Atualiza o input localmente
                    bloquearCamposSeFechado();
                    Swal.fire('Fechado!', resultado.message, 'success');
                }

            } catch (error) {
                console.error("Erro ao fechar o orçamento:", error);
                let errorMessage = error.message || "Ocorreu um erro ao fechar o orçamento.";
                Swal.fire('Erro!', errorMessage, 'error');
            }
        }
    });
}


document.getElementById('Proposta').addEventListener('click', function(event) {
    event.preventDefault();
    gerarPropostaPDF();
});

var font = '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AA8AFP/XAA8AFv/HAA8AF/+VAA8AGP/HAA8AGf+yAA8AGv/bAA8AG//HAA8AHP+yABEAE//HABEAFP/bABEAFv/HABEAF/+VABEAGP/HABEAGf+yABEAGv/bABEAG//HABEAHP+yABIAE//sABIAFv/sABIAF/9oABIAGf/XABIAG//sABIAHP/XABIAJP+BABIAJv/sABIAKv/sABIALf95ABIAMv/sABIANP/sABIARP+RABIARv+aABIAR/+aABIASP+aABIASv+iABIAUP/bABIAUf/bABIAUv+aABIAU//bABIAVP+iABIAVf/bABIAVv+RABIAWP/bABIAgf+BABIAgv+BABIAg/+BABIAhP+BABIAhf+BABIAhv+BABIAiP/sABIAk//sABIAlP/sABIAlf/sABIAlv/sABIAl//sABIAof+RABIAov+RABIAo/+RABIApP+RABIApf+RABIApv+RABIAp/+RABIAqf+aABIAqv+aABIAq/+aABIArP+aABIAs/+aABIAtP+aABIAtf+aABIAtv+aABIAt/+aABIAuv/bABIAu//bABIAvP/bABIAvf/bABIAx/95ABMAD//HABMAEf/HABMAEv/nABMAGP/sABMAGf/XABMAGv/XABMAG//sABMA3/9kABQAF//sABQAGf/fABQAHP/fABUAGP/bABUAGf/nABUAGv/sABUAHP/nABYAD//HABYAEf/HABYAE//sABYAFv/sABYAGP/sABYAGf/XABYAGv/XABYAG//sABYAHP/XABcAE//sABcAFv/sABcAGP/sABcAGv/XABcAHP/XABgAD//HABgAEf/HABgAE//sABgAFv/sABgAGP/sABgAGf/XABgAGv/XABgAG//sABgAHP/XABkAD//bABkAEf/bABkAGv/sABsAD//HABsAEf/HABsAEv/nABsAE//sABsAFv/sABsAGP/sABsAGf/XABsAGv/XABsAG//sABsAHP/XABwAD//bABwAEf/bABwAGf/sABwAGv/sACQABf+BACQACv+RACQAIv/XACQAN//DACQAOf/XACQAOv/XACQAPP+aACQAnv+qACQA2v+qACYAD//bACYAEf/bACYAPP/sACYAnv/sACYA2v/sACcAD/++ACcAEf++ACcAEv/nACcAPP/XACcATP/XACcAnv/XACcA2v/XACgAV//XACkAD/5WACkAEf5WACkAEv+FACkAJP/TACkAgf/TACkAgv/TACkAg//TACkAhP/TACkAhf/TACkAhv/TACoAD//bACoAEf/bACoAPP/sACoATP/sACoAnv/sACoA2v/sACsAD//XACsAEf/XACsARP/sACsASP/sACsATP/LACsAUv/sACsAWP/sACsAof/sACsAov/sACsAo//sACsApP/sACsApf/sACsApv/sACsAp//sACsAqf/sACsAqv/sACsAq//sACsArP/sACsAs//sACsAtP/sACsAtf/sACsAtv/sACsAt//sACsAuv/sACsAu//sACsAvP/sACsAvf/sACwATP/TACwATv/LACwAT//LAC0AD//bAC0AEf/bAC8ABf72AC8ACv8GAC8AIv/bAC8AN//LAC8AOf/HAC8AOv/TAC8APP+PAC8Anv+PAC8A2v+PADAABP/sADAAD//XADAAEf/XADAARP/sADAARv/sADAAR//sADAASP/sADAATP/LADAAUf/sADAAUv/sADAAWP/sADAAof/sADAAov/sADAAo//sADAApP/sADAApf/sADAApv/sADAAp//sADAAqf/sADAAqv/sADAAq//sADAArP/sADAAs//sADAAtP/sADAAtf/sADAAtv/sADAAt//sADAAuv/sADAAu//sADAAvP/sADAAvf/sADEAD//XADEAEf/XADEARP/sADEASP/sADEATP/LADEAUv/sADEAWP/sADEAof/sADEAov/sADEAo//sADEApP/sADEApf/sADEApv/sADEAp//sADEAqf/sADEAqv/sADEAq//sADEArP/sADEAs//sADEAtP/sADEAtf/sADEAtv/sADEAt//sADEAuv/sADEAu//sADEAvP/sADEAvf/sADIAD//HADIAEf/HADIAEv/nADIAPP/XADIATP/XADIATv/XADIAT//XADIAnv/XADIA2v/XADMAD/5WADMAEf5WADMAEv+qADMAnv/sADMA2v/sADQAD//HADQAEf/HADQAEv/nADQAPP/XADQATP/XADQATv/XADQAT//XADQAnv/XADQA2v/XADUAPP/XADUAnv/XADUA2v/XADYAD//bADYAEf/bADYAPP/XADYATP/sADYATv/sADYAT//sADYAnv/XADYA2v/XADcAD/9YADcAEP+6ADcAEf9YADcAEv+NADcAHf+uADcAHv+uADcAJP/DADcALf8zADcARP+iADcASP+uADcAUP/DADcAUv+uADcAVf/DADcAVv+eADcAWP/DADcAWv+uADcAXf/bADcAgf/DADcAgv/DADcAg//DADcAhP/DADcAhf/DADcAhv/DADcAof+iADcAov+iADcAo/+iADcApP+iADcApf+iADcApv+iADcAp/+iADcAqf+uADcAqv+uADcAq/+uADcArP+uADcAs/+uADcAtP+uADcAtf+uADcAtv+uADcAt/+uADcAuv/DADcAu//DADcAvP/DADcAvf/DADcAx/8zADgAD//HADgAEf/HADgAEv/nADgATP/fADkAD/9UADkAEf9UADkAEv99ADkAJP/XADkARP/fADkASP/nADkAUv/nADkAgf/XADkAgv/XADkAg//XADkAhP/XADkAhf/XADkAhv/XADkAof/fADkAov/fADkAo//fADkApP/fADkApf/fADkApv/fADkAp//fADkAqf/nADkAqv/nADkAq//nADkArP/nADkAs//nADkAtP/nADkAtf/nADkAtv/nADkAt//nADoAD/9cADoAEf9cADoAEv+JADoAJP/XADoARP/bADoAR//jADoASP/jADoAUv/jADoAgf/XADoAgv/XADoAg//XADoAhP/XADoAhf/XADoAhv/XADoAof/bADoAov/bADoAo//bADoApP/bADoApf/bADoApv/bADoAp//bADoAqf/jADoAqv/jADoAq//jADoArP/jADoAs//jADoAtP/jADoAtf/jADoAtv/jADoAt//jADoAxP/sADwAJP+aADwARP+uADwASP+uADwAUv+uADwAWP/DADwAgf+aADwAgv+aADwAg/+aADwAhP+aADwAhf+aADwAhv+aADwAof+uADwAov+uADwAo/+uADwApP+uADwApf+uADwApv+uADwAp/+uADwAqf+uADwAqv+uADwAq/+uADwArP+uADwAs/+uADwAtP+uADwAtf+uADwAtv+uADwAt/+uADwAuv/DADwAu//DADwAvP/DADwAvf/DAEQAIv9xAEUAD//sAEUAEf/sAEUAIv9tAEUAT//sAEYAD//sAEYAEf/sAEYAIv9tAEYATv/sAEYAT//s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AXQAAwABBAkACAAeAcIAAwABBAkACQAeAcIAAwABBAkACwAsAeAAAwABBAkADAAsAeAAAwABBAkADQEgAgwAAwABBAkADgA0AywAQwBvAHAAeQByAGkAZwBoAHQAIAAoAGMAKQAgADIAMAAxADEALAAgAE0AYQB0AHQAaABlAHcAIABEAGUAcwBtAG8AbgBkACAAKABoAHQAdABwADoALwAvAHcAdwB3AC4AbQBhAGQAdAB5AHAAZQAuAGMAbwBtACAAfAAgAG0AYQB0AHQAZABlAHMAbQBvAG4AZABAAGcAbQBhAGkAbAAuAGMAbwBtACkALAAgAHcAaQB0AGgAIABSAGUAcwBlAHIAdgBlAGQAIABGAG8AbgB0ACAATgBhAG0AZQAgAEEAYgBlAGwALgBBAGIAZQBsAFIAZQBnAHUAbABhAHIAMQAuADAAMAAzADsATQBBAEQAVAA7AEEAYgBlAGwALQBSAGUAZwB1AGwAYQByAEEAYgBlAGwAIABSAGUAZwB1AGwAYQByAFYAZQByAHMAaQBvAG4AIAAxAC4AMAAwADMAQQBiAGUAbAAtAFIAZQBnAHUAbABhAHIAQQBiAGUAbAAgAGkAcwAgAGEAIAB0AHIAYQBkAGUAbQBhAHIAawAgAG8AZgAgAE0AYQB0AHQAaABlAHcAIABEAGUAcwBtAG8AbgBkAC4ATQBhAHQAdABoAGUAdwAgAEQAZQBzAG0AbwBuAGQAaAB0AHQAcAA6AC8ALwB3AHcAdwAuAG0AYQBkAHQAeQBwAGUALgBjAG8AbQBUAGgAaQBzACAARgBvAG4AdAAgAFMAbwBmAHQAdwBhAHIAZQAgAGkAcwAgAGwAaQBjAGUAbgBzAGUAZAAgAHUAbgBkAGUAcgAgAHQAaABlACAAUwBJAEwAIABPAHAAZQBuACAARgBvAG4AdAAgAEwAaQBjAGUAbgBzAGUALAAgAFYAZQByAHMAaQBvAG4AIAAxAC4AMQAuACAAVABoAGkAcwAgAGwAaQBjAGUAbgBzAGUAIABpAHMAIABhAHYAYQBpAGwAYQBiAGwAZQAgAHcAaQB0AGgAIABhACAARgBBAFEAIABhAHQAOgAgAGgAdAB0AHAAOgAvAC8AcwBjAHIAaQBwAHQAcwAuAHMAaQBsAC4AbwByAGcALwBPAEYATABoAHQAdABwADoALwAvAHMAYwByAGkAcAB0AHMALgBzAGkAbAAuAG8AcgBnAC8ATwBGAEwAAAACAAAAAAAA/o8AUgAAAAAAAAAAAAAAAAAAAAAAAAAAAPsAAAABAAIAAwAEAAUABgAHAAgACQAKAAsADAANAA4ADwAQABEAEgATABQAFQAWABcAGAAZABoAGwAcAB0AHgAfACAAIQAiACMAJAAlACYAJwAoACkAKgArACwALQAuAC8AMAAxADIAMwA0ADUANgA3ADgAOQA6ADsAPAA9AD4APwBAAEEAQgBDAEQARQBGAEcASABJAEoASwBMAE0ATgBPAFAAUQBSAFMAVABVAFYAVwBYAFkAWgBbAFwAXQBeAF8AYABhAQIAowCEAIUAvQCWAOgAhgCOAIsAnQCpAKQAigDaAIMAkwDyAPMAjQCXAIgAwwDeAPEAngCqAPUA9AD2AKIArQDJAMcArgBiAGMAkABkAMsAZQDIAMoAzwDMAM0AzgDpAGYA0wDQANEArwBnAPAAkQDWANQA1QBoAOsA7QCJAGoAaQBrAG0AbABuAKAAbwBxAHAAcgBzAHUAdAB2AHcA6gB4AHoAeQB7AH0AfAC4AKEAfwB+AIAAgQDsAO4AugEDAQQBBQDXAQYBBwEIAQkBCgELAQwBDQDiAOMBDgEPALAAsQEQAREBEgETARQA5ADlALsA5gDnAKYA2ADhANsA3ADdAOAA2QDfARUAsgCzALYAtwDEALQAtQDFAIIAwgCHAKsAvgC/ALwBFgCMAO8BFwEYB3VuaTAwQTAEaGJhcgZJdGlsZGUGaXRpbGRlAklKAmlqC0pjaXJjdW1mbGV4C2pjaXJjdW1mbGV4DGtjb21tYWFjY2VudAxrZ3JlZW5sYW5kaWMKTGRvdGFjY2VudARsZG90Bk5hY3V0ZQZuYWN1dGUGUmFjdXRlDFJjb21tYWFjY2VudAxyY29tbWFhY2NlbnQGUmNhcm9uBnJjYXJvbgxkb3RhY2NlbnRjbWIERXVybwhkb3RsZXNzagtjb21tYWFjY2VudAAAAQAB//8ADw==';
        var callAddFont = function () {
        this.addFileToVFS('Abel-Regular-normal.ttf', font);
        this.addFont('Abel-Regular-normal.ttf', 'Abel-Regular', 'normal');
        };

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
        doc.setFont("abel", "normal");
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

async function PropostaouContrato() {
    Swal.fire({
        title: "Selecione o tipo de documento",
        text: "Escolha qual documento deseja gerar para este orçamento.",
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Gerar Proposta",
        cancelButtonText: "Gerar Contrato",
        reverseButtons: true,
        customClass: {
            confirmButton: 'Proposta',
            cancelButton: 'Contrato'
        }
        }).then((result) => {
        if (result.isConfirmed) {
            gerarPropostaPDF();
        } else if (result.dismiss === Swal.DismissReason.cancel) {
            gerarContrato(nrOrcamento);
        }
        });
}

document.getElementById('Contrato').addEventListener('click', function(event) {
    event.preventDefault();
    PropostaouContrato();
});

async function gerarContrato() {
    let nrOrcamentoElem = document.getElementById('nrOrcamento');
    let nrOrcamento = "";

    if (nrOrcamentoElem) {
        if (nrOrcamentoElem.tagName === "INPUT") {
            nrOrcamento = nrOrcamentoElem.value.trim();
        } else {
            nrOrcamento = nrOrcamentoElem.innerText.trim();
        }
    }

    if (!nrOrcamento) {
        alert("Número do orçamento não encontrado!");
        console.warn("Número do orçamento não encontrado!");
        return;
    }
    try {
        console.log("🔍 Iniciando requisição para gerar contrato...");

        // Envia a requisição para o backend e já recebe o JSON processado
        const result = await fetchComToken(`/orcamentos/${nrOrcamento}/contrato`, {
            method: "GET",
        });

        // ✅ CORRIGIDO: Removemos a linha 'const result = await response.json();'
        // pois a função 'fetchComToken' já retorna o JSON ou lança um erro.
        
        // Exibe uma mensagem de sucesso para o usuário
        if (result.success) {
            console.log("✅ Contrato enviado com sucesso para o ClickSign!");
             Swal.fire({
                icon: "success",
                title: "Contrato gerado!",
                text: "O contrato foi enviado com sucesso para o ClickSign.",
                confirmButtonText: "Ok"
            });

        } else {
            // Trata o caso de o backend não retornar sucesso
            throw new Error(result.message || "Ocorreu um erro desconhecido ao gerar o contrato.");
        }

    } catch (err) {
        console.error("❌ Erro ao gerar contrato:", err);
        Swal.fire({
            icon: "error",
            title: "Erro!",
            text: `Ocorreu um erro ao gerar o contrato: ${err.message}`,
            confirmButtonText: "Fechar"
        });
    }
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