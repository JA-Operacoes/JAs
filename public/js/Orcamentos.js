import { fetchComToken} from '../../utils/utils.js';


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

let locaisDeMontagem = [];

let flatpickrInstances = {};

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

document.addEventListener("DOMContentLoaded", function () {  
   
});

let idCliente;
let idEvento;
let idMontagem;
let idFuncao;

const idOrcamentoInput = document.getElementById('idOrcamento');
//const nrOrcamentoInput = document.getElementById('nrOrcamento');
const clienteSelect = document.querySelector('.idCliente'); // Select do cliente no form principal
const eventoSelect = document.querySelector('.idEvento');   // Select do evento no form principal
const localMontagemSelect = document.querySelector('.idMontagem'); // Select do local no form principal
const statusSelect = document.getElementById('Status');

console.log("ID LOCAL MONTAGEM", localMontagemSelect);

 let selects = document.querySelectorAll(".idFuncao, .idEquipamento, .idSuprimento");
    selects.forEach(select => {
        select.addEventListener("change", atualizaProdutoOrc);
    });

// const selectFuncao = document.getElementById('selectFuncao');
// if (selectFuncao) {
//    selectFuncao.addEventListener('change', function() {
//     resetarOutrosSelectsOrc(selectFuncao); // Reseta outros selects quando este é alterado
//    });
    
// }
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

// const selectLocalMontagem = document.getElementById('selectMontagem');
//     if (selectLocalMontagem) {
        
//         selectLocalMontagem.addEventListener('change', function() {
//             atualizarUFOrc(this);
//         });       
//     }    
// Atualiza texto no DOM
function atualizarOuCriarCampoTexto(nmFantasia, texto) {
    const campo = document.getElementById(nmFantasia);
    if (campo) {
        campo.textContent = texto || "";
    } else {
        console.warn(`Elemento com NomeFantasia '${nmFantasia}' não encontrado.`);
    }
}

// Busca por nome fantasia
async function buscarEExibirDadosClientePorNome(nmFantasia) {
    try {
        const dadosCliente = await fetchComToken(`orcamentos/clientes?nmFantasia=${encodeURIComponent(nmFantasia)}`);

        // if (!dadosCliente.ok) {
        //     throw new Error(`Erro ao buscar dados do cliente: ${dadosCliente.status}`);
        // }

       // const dadosCliente = await response.json();

        console.log("Cliente selecionado! Dados:", {
            nome: dadosCliente.nmcontato,
            celular: dadosCliente.celcontato,
            email: dadosCliente.emailcontato
        });

        // atualizarOuCriarCampoTexto("nmContato", dadosCliente.nmcontato);
        // atualizarOuCriarCampoTexto("celContato", dadosCliente.celcontato);
        // atualizarOuCriarCampoTexto("emailContato", dadosCliente.emailcontato);

    } catch (error) {
        console.error("Erro ao buscar dados do cliente:", error);
        Swal.fire("Erro", "Erro ao buscar dados do cliente", "error");

        atualizarOuCriarCampoTexto("nmContato", "");
        atualizarOuCriarCampoTexto("celContato", "");
        atualizarOuCriarCampoTexto("emailContato", "");
    }
}

async function  carregarClientesOrc() {
    console.log("Função CARREGAR Cliente chamada");    

    try{

        const clientes = await fetchComToken('orcamentos/clientes');
    
        console.log('Clientes recebidos:', clientes);

        let selects = document.querySelectorAll(".idCliente");

        selects.forEach(select => {
           // const nomeSelecionado = select.value;
            const valorSelecionadoAtual = select.value;
            select.innerHTML = '<option value="">Selecione Cliente</option>';

            clientes.forEach(cliente => {
                let option = document.createElement("option");
                option.value = cliente.idcliente;
                option.textContent = cliente.nmfantasia;
                // option.setAttribute("data-nmfantasia", cliente.nmfantasia);
                // option.setAttribute("data-idCliente", cliente.idcliente);

                select.appendChild(option);
            });

            if (valorSelecionadoAtual) {
                 // Convertendo para string, pois o valor do select é sempre string.
                select.value = String(valorSelecionadoAtual); 
            }


            // Evento de seleção de cliente
            select.addEventListener('change', function () {
                idCliente = this.value; // O value agora é o ID
                console.log("idCliente selecionado:", idCliente);
               
                // const nomeFantasia = this.value;
                // const selectedOption = select.options[select.selectedIndex];
                // idCliente = selectedOption.getAttribute("data-idCliente");
                // console.log("idCliente", idCliente);
                // if (nomeFantasia) {
                //     buscarEExibirDadosClientePorNome(nomeFantasia);
                // }
            });

            // if (nomeSelecionado) {
            //     buscarEExibirDadosClientePorNome(nomeSelecionado);
            // }
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
                console.log("idEvento selecionado:", idEvento);
                // const selectedOption = select.options[select.selectedIndex];   
                // idEvento = selectedOption.getAttribute("data-idEvento");
                  
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

                option.value = local.idmontagem;  // Atenção ao nome da propriedade (idMontagem)
                option.textContent = local.descmontagem; 
                option.setAttribute("data-idMontagem", local.idmontagem); 
                option.setAttribute("data-descmontagem", local.descmontagem);
                option.setAttribute("data-ufmontagem", local.ufmontagem); 
                select.appendChild(option);

               // console.log("Select atualizado:", select.innerHTML);

                locaisDeMontagem = montagem;

            });
            select.addEventListener("change", function () {

                idMontagem = this.value; // O value agora é o ID
                console.log("IDLOCALMONTAGEM selecionado:", idMontagem);
                // const selectedOption = select.options[select.selectedIndex];
                // idMontagem = selectedOption.getAttribute("data-idlocalmontagem") || "N/D";
                // // console.log("IDLOCALMONTAGEM", idMontagem);
                
            });
            
        });
    }catch(error){
        console.error("Erro ao carregar localmontagem:", error);
    } 
}

let Categoria = "";
let vlrAlmoco = "";
let vlrJantar = "";
let vlrTransporte = "";

// Função para carregar os Funcao
async function carregarFuncaoOrc() {
    try{
        const funcaofetch = await fetchComToken('/orcamentos/funcao');
        //funcoesDisponiveis = funcaofetch;

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
                idFuncao = this.value; // O value agora é o ID
                console.log("IDFUNCAO selecionado:", idFuncao);

                const selectedOption = this.options[this.selectedIndex];
                
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
                atualizaProdutoOrc(event);
            });
          //  Categoria = "Produto(s)"; // define padrão ao carregar
        });
    }catch(error){
    console.error("Erro ao carregar funcao:", error);
    } 
}

// Função para carregar os equipamentos
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
                option.setAttribute("data-categoria", "Equipamentos(s)");
                select.appendChild(option);
            });
            select.addEventListener("change", function (event) {
                const selectedOption = select.options[select.selectedIndex];
                Categoria = selectedOption.getAttribute("data-categoria") || "N/D";
                atualizaProdutoOrc(event);
            });
            
            Categoria = "Equipamentos(s)"; // define padrão ao carregar
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
                
                //  console.log("Select atualizado Suprimento:", select.innerHTML);

            });
            
            select.addEventListener("change", function (event) {
                const selectedOption = select.options[select.selectedIndex];
                Categoria = selectedOption.getAttribute("data-categoria") || "N/D";
                atualizaProdutoOrc(event);
            });
            Categoria = "Suprimento(s)"; // define padrão ao carregar
        });
    }catch(error){
    console.error("Erro ao carregar suprimentos:", error);
    }
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

    //     fetchComToken('/orcamento', {
    //         method: 'POST',
    //         // headers: {
    //         //             "Content-Type": "application/json",
    //         //             'Authorization': `Bearer ${token}`
    //         //             // 'x-id-empresa': idEmpresa
    //         //         },
    //         body: JSON.stringify(orcamento)
    //     })
    //     .then(response => response.json())
    //     .then(data => {
    //         alert("Orçamento salvo com sucesso!");
    //         fecharModal();
    //     })
    //     .catch(error => console.error("Erro ao salvar:", error));
    // });
    //     fetchComToken('/orcamento', {
    //         method: 'POST',
    //         // headers: {
    //         //             "Content-Type": "application/json",
    //         //             'Authorization': `Bearer ${token}`
    //         //             // 'x-id-empresa': idEmpresa
    //         //         },
    //         body: JSON.stringify(orcamento)
    //     })
    //     .then(response => response.json())
    //     .then(data => {
    //         alert("Orçamento salvo com sucesso!");
    //         fecharModal();
    //     })
    //     .catch(error => console.error("Erro ao salvar:", error));
     });
    
}

if (!window.hasRegisteredClickListener) {
    document.querySelector("#tabela").addEventListener("click", function(event) {
        if (event.target.classList.contains("increment")) {
            const input = event.target.closest("td").querySelector("input.qtdProduto");
            if (input) {
                input.value = parseInt(input.value || 0) + 1;
                const linha = input.closest("tr");
                if (linha) {
                    recalcularLinha(linha); // Chama aqui, dentro do clique
                }
            }
        }

        if (event.target.classList.contains("decrement")) {
            const input = event.target.closest("td").querySelector("input.qtdProduto");
            if (input) {
                const valorAtual = parseInt(input.value || 0);
                input.value = Math.max(0, valorAtual - 1);
                const linha = input.closest("tr");
                if (linha) {
                    recalcularLinha(linha); // Também aqui
                }
            }
        }
    });

    window.hasRegisteredClickListener = true; // Marca que o listener já foi adicionado
}

if (!window.hasRegisteredChangeListenerForAjdCusto) {
    document.addEventListener('change', async function(event) {
        // Este 'if' verifica SE o evento 'change' veio de um select de alimentação ou transporte
        if (event.target.classList.contains('select-alimentacao') || event.target.classList.contains('select-transporte')) {
            console.log("--- Evento CHANGE disparado por select-alimentacao ou select-transporte ---");
            const linhaAtual = event.target.closest('tr');
            if (!linhaAtual) {
                console.error("Erro: Não foi possível encontrar a linha (<tr>) pai para o select de ajuda de custo.");
                return;
            }
            // Chama a função para recalcular e atualizar a exibição daquela linha específica
            //atualizarValoresAjdCustoNaLinha(linhaAtual);
            
            recalcularLinha(linhaAtual);
            //calcularTotaisOrc(); // Recalcula os totais gerais da tabela após mudança em uma linha
        }
    });
    window.hasRegisteredChangeListenerForAjdCusto = true;
}

function desformatarMoeda(valor) {

    // console.log ("DESFORMATARMOEDA", valor);
    // if (!valor) return 0;
    // return parseFloat(valor.replace(/[R$\s.]/g, '').replace(',', '.')) || 0;
    
    
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
    calcularLucroReal();
    calcularLucro();
}

function calcularLucro() {
    let totalCustoGeral = 0;
    let totalVendaGeral = 0;

    // Extraímos os valores numéricos das células, desformatados de moeda
    totalCustoGeral = desformatarMoeda(document.querySelector('#totalGeralCto').value);
    totalVendaGeral = desformatarMoeda(document.querySelector('#totalGeralVda').value);

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

    const inputTotalGeral = document.querySelector('#totalGeralCto');
    const inputTotalAjdCusto= document.querySelector('#totalAjdCusto');
    const inputValorCliente = document.querySelector('#valorCliente');

    if (!inputTotalGeral || !inputValorCliente) {
        console.warn("⚠️ Campo(s) #totalGeral ou #valorCliente não encontrados. Lucro não pode ser calculado.");
        return;
    }

    // Obtém os valores convertendo de moeda
    totalCustoGeral = desformatarMoeda(inputTotalGeral.value);    
    totalAjdCusto = desformatarMoeda(inputTotalAjdCusto.value);
    valorFinalCliente = desformatarMoeda(inputValorCliente.value);
    console.log("TOTAL AJDCUSTO", totalCustoGeral, totalAjdCusto, valorFinalCliente );

    // Calcula lucro
    let lucroReal = valorFinalCliente - (totalCustoGeral+totalAjdCusto);
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
}

function aplicarDescontoEAcrescimo(input = null) {
    const campoTotalVenda = document.querySelector('#totalGeralVda');
    const campoDesconto = document.querySelector('#Desconto');
    const campoPerCentDesc = document.querySelector('#percentDesc');
    const campoAcrescimo = document.querySelector('#Acrescimo');
    const campoPerCentAcresc = document.querySelector('#percentAcresc');
    const campoValorCliente = document.querySelector('#valorCliente');

    let totalVenda = desformatarMoeda(campoTotalVenda?.value || '0');
    if (isNaN(totalVenda)) totalVenda = 0;

    let valorDesconto = desformatarMoeda(campoDesconto?.value || '0');
    let perCentDesc = parseFloat((campoPerCentDesc?.value || '0').replace('%', '').replace(',', '.')) || 0;

    let valorAcrescimo = desformatarMoeda(campoAcrescimo?.value || '0');
    let perCentAcresc = parseFloat((campoPerCentAcresc?.value || '0').replace('%', '').replace(',', '.')) || 0;

    // Se input for null, só calcula e mostra o valor final
    if (input === null) {
        const valorFinal = totalVenda - valorDesconto + valorAcrescimo;
        if (campoValorCliente) {
            campoValorCliente.value = formatarMoeda(valorFinal);
        }
        return;
    }
        
    // Sincronizar desconto
    if (input === campoDesconto && totalVenda > 0) {
        perCentDesc = (valorDesconto / totalVenda) * 100;
        campoPerCentDesc.value = perCentDesc.toFixed(2) + '%';
    } else if (input === campoPerCentDesc && totalVenda > 0) {
        valorDesconto = totalVenda * (perCentDesc / 100);
        campoDesconto.value = formatarMoeda(valorDesconto);
    }

    // Sincronizar acréscimo
    if (input === campoAcrescimo && totalVenda > 0) {
        perCentAcresc = (valorAcrescimo / totalVenda) * 100;
        campoPerCentAcresc.value = perCentAcresc.toFixed(2) + '%';
    } else if (input === campoPerCentAcresc && totalVenda > 0) {
        valorAcrescimo = totalVenda * (perCentAcresc / 100);
        campoAcrescimo.value = formatarMoeda(valorAcrescimo);
    }

    // Calcular valor final para o cliente
    const valorFinal = totalVenda - valorDesconto + valorAcrescimo;

    if (campoValorCliente) {
        campoValorCliente.value = formatarMoeda(valorFinal);
    }

    calcularLucroReal();
    calcularLucro();
}


document.getElementById("tabela").addEventListener("click", function (e) {
    const botao = e.target.closest(".deleteBtn");
    if (!botao) return;
    const linha = botao.closest("tr");
    if (linha) removerLinha(linha);
});
// Exemplo de função para remover a linha
function removerLinha(linha) {
    // Remove a linha da DOM
    linha.remove();

    // Recalcular os totais após a remoção
    
    recalcularTotaisGerais();
    aplicarDescontoEAcrescimo();
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


    let novaLinha = tabela.insertRow();
    
    
        novaLinha.innerHTML = `
        <td style="display:none;"><input type="hidden" class="idItemOrcamento" value=""></td> <!-- Corrigido: de <th> para <td> e adicionado input hidden -->
        <td class="Proposta">
            <div class="checkbox-wrapper-33" style="margin-top: 40px;">
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
                <input type="number" class="qtdProduto" min="0" value="0" oninput="recalcularLinha(this.closest('tr'))">
                <div class="Bt">
                    <button type="button" class="increment">+</button>
                    <button type="button" class="decrement">-</button>
                </div>
            </div>
        </td>
        <td class="produto"><input type="text" class="produto-input" value=""></td> <!-- Adicionado input para edição -->
        <td class="qtdDias">
            <div class="add-less">
                <input type="number" readonly class="qtdDias" min="0" value="0" oninput="recalcularLinha(this.closest('tr'))">
            </div>
        </td>
        <td class="Periodo">
            <div class="flatpickr-container">
                <input type="text" class="datas datas-item" data-input required readonly placeholder="Clique para Selecionar">
            </div>
        </td>
        <td class="desconto Moeda">
            <div class="Acres-Desc">
                <input type="text" class="ValorInteiros" value="R$ 0,00" oninput="recalcularLinha(this.closest('tr'))">
                <input type="text" class="valorPerCent" value="0%" oninput="recalcularLinha(this.closest('tr'))">
            </div>
        </td>
        <td class="Acrescimo Moeda">
            <div class="Acres-Desc">
                <input type="text" class="ValorInteiros" value="R$ 0,00" oninput="recalcularLinha(this.closest('tr'))">
                <input type="text" class="valorPerCent" value="0%" oninput="recalcularLinha(this.closest('tr'))">
            </div>
        </td>
        <td class="vlrVenda Moeda">${formatarMoeda(0)}</td>
        <td class="totVdaDiaria Moeda">${formatarMoeda(0)}</td>
        <td class="vlrCusto Moeda">${formatarMoeda(0)}</td>
        <td class="totCtoDiaria Moeda">${formatarMoeda(0)}</td>
        <td class="ajdCusto Moeda">
            <div class="Acres-Desc">
                <select class="tpAjdCusto-alimentacao">
                    <option value="select" selected disabled>Alimentação</option>
                    <option value="almoco">Almoço</option>
                    <option value="janta">Jantar</option>
                    <option value="2alimentacao">Almoço + jantar</option>
                </select>
            </div>
            <br><span class="valorbanco alimentacao">${formatarMoeda(0)}</span>
        </td>
        <td class="ajdCusto Moeda">
            <div class="Acres-Desc">
                <select class="tpAjdCusto-transporte">
                    <option value="select" selected disabled>Veiculo</option>
                    <option value="Publico">Público</option>
                    <option value="alugado">Alugado</option>
                    <option value="Proprio">Próprio</option>
                </select>
            </div>
            <br><span class="valorbanco transporte">${formatarMoeda(0)}</span>
        </td>
        <td class="totAjdCusto Moeda">${formatarMoeda(0)}</td>
        <td class="extraCampo" style="display: none;">
            <input type="text" class="hospedagem" value="0" min="0" step="0.01" oninput="recalcularLinha(this.closest('tr'))">
        </td>
        <td class="extraCampo" style="display: none;">
            <input type="text" class="transporte" value="0" min="0" step="0.01" oninput="recalcularLinha(this.closest('tr'))">
        </td>
        <td class="totGeral Moeda">${formatarMoeda(0)}</td>
        <td>
            <div class="Acao">
                <button class="deleteBtn" type="button">
                    <svg class="delete-svgIcon" viewBox="0 0 448 512">
                        <path d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z"></path>
                    </svg>
                </button>
            </div>
        </td>
    `;

    
    //Inicializa o Flatpickr para o campo de data na nova linha
    const novoInputData = novaLinha.querySelector('input[type="text"].datas');  
    if (novoInputData) {
        flatpickr(novoInputData, commonFlatpickrOptionsTable);
        console.log("Flatpickr inicializado para nova linha adicionada:", novoInputData);
    } else {
        console.error("Erro: Novo input de data não encontrado na nova linha.");
    }

    novaLinha.querySelector('.qtdProduto .increment')?.addEventListener('click', (event) => {
        const input = event.target.closest("td").querySelector("input.qtdProduto");
        if (input) {
            input.value = parseInt(input.value || 0) + 1;
            recalcularLinha(novaLinha);
        }
    });

    novaLinha.querySelector('.qtdProduto .decrement')?.addEventListener('click', (event) => {
        const input = event.target.closest("td").querySelector("input.qtdProduto");
        if (input) {
            const valorAtual = parseInt(input.value || 0);
            input.value = Math.max(0, valorAtual - 1);
            recalcularLinha(novaLinha);
        }
    });

    // Adiciona event listener para o botão de excluir
    novaLinha.querySelector('.deleteBtn').addEventListener('click', () => {
        novaLinha.remove();
        recalcularTotaisGerais();
    });
    
    // Adiciona event listeners para os selects de AjdCusto
    novaLinha.querySelectorAll('.tpAjdCusto-alimentacao, .tpAjdCusto-transporte').forEach(select => {
        select.addEventListener('change', () => {
            recalcularLinha(novaLinha);
        });
    });

    // Adiciona event listeners para inputs de texto/número que precisam de recalculo
    novaLinha.querySelectorAll('input.categoria-input, input.produto-input, input.ValorInteiros, input.valorPerCent, input.qtdProduto, input.qtdDias, input.hospedagem, input.transporte').forEach(input => {
        input.addEventListener('input', () => recalcularLinha(novaLinha));
    });

    
    // const qtdProdutoInput = novaLinha.querySelector('.qtdProduto input[type="number"]');
    // const incrementBtnQtdProduto = novaLinha.querySelector('.qtdProduto .increment');
    // const decrementBtnQtdProduto = novaLinha.querySelector('.qtdProduto .decrement');

    // if (qtdProdutoInput && incrementBtnQtdProduto && decrementBtnQtdProduto) {
    //     incrementBtnQtdProduto.addEventListener('click', () => {
    //         qtdProdutoInput.value = parseInt(qtdProdutoInput.value) + 1;
    //         // Chame sua função de cálculo aqui, se necessário, ou confie no oninput
    //         // recalcularLinha(); // Se recalcularLinha() lida com a linha
    //         const linhaDaQtd = qtdProdutoInput.closest('tr');
    //         if (linhaDaQtd) { /* ... chamar função de cálculo específica da linha ... */ }
    //     });
    //     decrementBtnQtdProduto.addEventListener('click', () => {
    //         const currentValue = parseInt(qtdProdutoInput.value);
    //         if (currentValue > 0) {
    //             qtdProdutoInput.value = currentValue - 1;
    //             // calcularTotalOrc();
    //             const linhaDaQtd = qtdProdutoInput.closest('tr');
    //             if (linhaDaQtd) { /* ... chamar função de cálculo específica da linha ... */ }
    //         }
    //     });
    // }

}

function adicionarLinhaAdicional() {
    let tabela = document.getElementById("tabela").getElementsByTagName("tbody")[0];

    let novaLinha = tabela.insertRow();
    novaLinha.classList.add("liberada");     // aplica nova cor
 novaLinha.innerHTML = `
        <td style="display:none;" ><input type="hidden" class="idItemOrcamento" value=""></td> <!-- Corrigido: de <th> para <td> e adicionado input hidden -->
        <td class="Proposta">
            <div class="checkbox-wrapper-33" style="margin-top: 40px;">
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
                <input type="number" class="qtdProduto" min="0" value="0" oninput="recalcularLinha(this.closest('tr'))">
                <div class="Bt">
                    <button type="button" class="increment">+</button>
                    <button type="button" class="decrement">-</button>
                </div>
            </div>
        </td>
        <td class="produto"><input type="text" class="produto-input" value=""></td> <!-- Adicionado input para edição -->
        <td class="qtdDias">
            <div class="add-less">
                <input type="number" readonly class="qtdDias" min="0" value="0" oninput="recalcularLinha(this.closest('tr'))">
            </div>
        </td>
        <td class="Periodo">
            <div class="flatpickr-container">
                <input type="text" class="datas datas-item" data-input required readonly placeholder="Clique para Selecionar">
            </div>
        </td>
        <td class="desconto Moeda">
            <div class="Acres-Desc">
                <input type="text" class="ValorInteiros" value="R$ 0,00" oninput="recalcularLinha(this.closest('tr'))">
                <input type="text" class="valorPerCent" value="0%" oninput="recalcularLinha(this.closest('tr'))">
            </div>
        </td>
        <td class="Acrescimo Moeda">
            <div class="Acres-Desc">
                <input type="text" class="ValorInteiros" value="R$ 0,00" oninput="recalcularLinha(this.closest('tr'))">
                <input type="text" class="valorPerCent" value="0%" oninput="recalcularLinha(this.closest('tr'))">
            </div>
        </td>
        <td class="vlrVenda Moeda">${formatarMoeda(0)}</td>
        <td class="totVdaDiaria Moeda">${formatarMoeda(0)}</td>
        <td class="vlrCusto Moeda">${formatarMoeda(0)}</td>
        <td class="totCtoDiaria Moeda">${formatarMoeda(0)}</td>
        <td class="ajdCusto Moeda">
            <div class="Acres-Desc">
                <select class="tpAjdCusto-alimentacao">
                    <option value="select" selected disabled>Alimentação</option>
                    <option value="almoco">Almoço</option>
                    <option value="janta">Jantar</option>
                    <option value="2alimentacao">Almoço + jantar</option>
                </select>
            </div>
            <br><span class="valorbanco alimentacao">${formatarMoeda(0)}</span>
        </td>
        <td class="ajdCusto Moeda">
            <div class="Acres-Desc">
                <select class="tpAjdCusto-transporte">
                    <option value="select" selected disabled>Veiculo</option>
                    <option value="Publico">Público</option>
                    <option value="alugado">Alugado</option>
                    <option value="Proprio">Próprio</option>
                </select>
            </div>
            <br><span class="valorbanco transporte">${formatarMoeda(0)}</span>
        </td>
        <td class="totAjdCusto Moeda">${formatarMoeda(0)}</td>
        <td class="extraCampo" style="display: none;">
            <input type="text" class="hospedagem" value="0" min="0" step="0.01" oninput="recalcularLinha(this.closest('tr'))">
        </td>
        <td class="extraCampo" style="display: none;">
            <input type="text" class="transporte" value="0" min="0" step="0.01" oninput="recalcularLinha(this.closest('tr'))">
        </td>
        <td class="totGeral Moeda">${formatarMoeda(0)}</td>
        <td>
            <div class="Acao">
                <button class="deleteBtn" type="button">
                    <svg class="delete-svgIcon" viewBox="0 0 448 512">
                        <path d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z"></path>
                    </svg>
                </button>
            </div>
        </td>
    `;

    // 1. Popula o select de FUNÇÃO da nova linha
    const novoSelectFuncao = novaLinha.querySelector('.idFuncao');
    if (novoSelectFuncao) {
        novoSelectFuncao.innerHTML = ""; // Limpa antes de popular
        let opcaoPadrao = document.createElement("option");
        opcaoPadrao.setAttribute("value", ""); // Garanta que este value seja consistente
        opcaoPadrao.textContent = "Selecione Função";
        novoSelectFuncao.appendChild(opcaoPadrao);
        funcoesDisponiveis.forEach(funcao => {
            let option = document.createElement("option");
            option.value = funcao.idfuncao;
            option.textContent = funcao.descfuncao;
            option.setAttribute("data-almoco", funcao.almoco || 0);
            option.setAttribute("data-jantar", funcao.jantar || 0);
            option.setAttribute("data-transporte", funcao.transporte || 0);
            novoSelectFuncao.appendChild(option);
        });
    }

    // Inicializa o Flatpickr para o campo de data na nova linha
    const novoInputData = novaLinha.querySelector('input[type="text"].datas');
   
    if (novoInputData) {
        flatpickr(novoInputData, commonFlatpickrOptionsTable);
        console.log("Flatpickr inicializado para nova linha adicionada:", novoInputData);
    } else {
        console.error("Erro: Novo input de data não encontrado na nova linha.");
    }

    // const qtdProdutoInput = novaLinha.querySelector('.qtdProduto input[type="number"]');
    // const incrementBtnQtdProduto = novaLinha.querySelector('.qtdProduto .increment');
    // const decrementBtnQtdProduto = novaLinha.querySelector('.qtdProduto .decrement');

    // if (qtdProdutoInput && incrementBtnQtdProduto && decrementBtnQtdProduto) {
    //     incrementBtnQtdProduto.addEventListener('click', () => {
    //         qtdProdutoInput.value = parseInt(qtdProdutoInput.value) + 1;
    //         // Chame sua função de cálculo aqui, se necessário, ou confie no oninput
    //         // recalcularLinha(); // Se recalcularLinha() lida com a linha
    //         const linhaDaQtd = qtdProdutoInput.closest('tr');
    //         if (linhaDaQtd) { /* ... chamar função de cálculo específica da linha ... */ }
    //     });
    //     decrementBtnQtdProduto.addEventListener('click', () => {
    //         const currentValue = parseInt(qtdProdutoInput.value);
    //         if (currentValue > 0) {
    //             qtdProdutoInput.value = currentValue - 1;
    //             // calcularTotalOrc();
    //             const linhaDaQtd = qtdProdutoInput.closest('tr');
    //             if (linhaDaQtd) { /* ... chamar função de cálculo específica da linha ... */ }
    //         }
    //     });
    // }
    // Você também precisa de listeners para os inputs de valor (desconto, acrescimo) e os checkboxes.
    // Sugiro ter funções como 'inicializarEventosLinha(novaLinha)' que encapsulem isso.
    // E chamar essa função após 'novaLinha.innerHTML = ...'
    // Exemplo:
    // inicializarEventosLinha(novaLinha);
}

function removerLinhaOrc(botao) {
    let linha = botao.closest("tr"); // Encontra a linha mais próxima
    removerLinha(linha); // Remove a linha
}


function initializeAllFlatpickrsInModal() {
    console.log("Inicializando Flatpickr para todos os campos de data no modal...");

    // 1. Inicializa os campos globais com a função já existente
    inicializarFlatpickrsGlobais(); // Chamamos a função que você já tinha

    // 2. Inicializa Flatpickr para os inputs '.datas' que JÁ EXISTEM na tabela no carregamento inicial do modal
    document.querySelectorAll(".datas").forEach(input => {
        if (!input._flatpickr) { // Evita reinicialização
            flatpickr(input, commonFlatpickrOptions);
            console.log("Flatpickr inicializado para input da tabela (existente):", input);
        } else {
            console.log("Flatpickr já está inicializado para input da tabela (existente), pulando.");
        }
    });
}

// Crie esta nova função
function inicializarFlatpickrsGlobais() {
console.log("Inicializando Flatpickr para todos os campos de data (globais)...");
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
                console.log(`Flatpickr inicializado e salvo para campo global #${id}`);
            } else {
                console.log(`Flatpickr para campo global #${id} já estava inicializado.`);
               
                flatpickrInstances[id] = element._flatpickr; 
            }
        } else {
            console.warn(`Elemento com ID '${id}' não encontrado para inicialização do Flatpickr.`);
        }
    });
}

// No seu Orcamentos.js

// Certifique-se que linhaCounter está definida globalmente no topo do seu arquivo
let linhaCounter = 0;

function inicializarFlatpickr(inputElement, onDateChangeCallback = null) {
    console.log("Inicializando Flatpickr para o input:", inputElement);
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

//   if (datas.length === 2) {
//     // Dois dias selecionados (intervalo)
//     var partesInicio = datas[0].trim().split('/');
//     var partesFim = datas[1].trim().split('/');
//     var inicio = new Date(partesInicio[2], partesInicio[1] - 1, partesInicio[0]);
//     var fim = new Date(partesFim[2], partesFim[1] - 1, partesFim[0]);

//     if (fim >= inicio) {
//       diffDias = Math.floor((fim - inicio) / (1000 * 60 * 60 * 24)) + 1;
//     } else {
//       diffDias = "-";
//     }

//   } else if (datas.length === 1 && datas[0].trim() !== '') {
//     // Apenas um dia selecionado
//     diffDias = 1;
//   } else {
//     diffDias = "-";
//   }

//   inputQtdDias.value = diffDias;
//   console.log("📤 Valor final enviado para input.qtdDias:", inputQtdDias.value);

//   // Atualiza a linha automaticamente
//   if (typeof recalcularLinha === 'function') {
//     console.log("🔁 Chamando recalcularLinha...");
//     recalcularLinha(linha);
//   } else {
//     console.warn("⚠️ Função recalcularLinha não está definida.");
//   }
}


//formulario de 
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
    let vlrCusto = selectedOption.getAttribute("data-cto");
    let vlrVenda = selectedOption.getAttribute("data-vda");

    let tabela = document.getElementById("tabela");
    if (!tabela) return; // Se a tabela não existir, sai da função

    let ultimaLinha = tabela.querySelector("tbody tr:last-child");
    if (ultimaLinha) {
        
        let celulaProduto = ultimaLinha.querySelector(".produto");
        let celulaCategoria = ultimaLinha.querySelector(".Categoria");
        if (celulaCategoria) celulaCategoria.textContent = Categoria;
        console.log(" A categoria é :", Categoria)
        // Se a célula de produto estiver vazia OU se foi alterado um novo select, atualiza
        if (celulaProduto && (celulaProduto.textContent === "" || select.classList.contains("idEquipamento") || select.classList.contains("idSuprimento") || select.classList.contains("idFuncao"))) {
            celulaProduto.textContent = produtoSelecionado;
            console.log(" produto escolhido foi:", produtoSelecionado)
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
        if (celulaVlrVenda) celulaVlrVenda.textContent = vlrVenda;
        console.log(" valor de Venda é:", vlrVenda);

        // let celulaAjdCusto = ultimaLinha.querySelector(".ajdCusto");
        // if (celulaAjdCusto) celulaAjdCusto.textContent = vlrAjdCusto;
        // console.log(" valor de AjdCusto é:", vlrAjdCusto);
    }
    recalcularLinha(ultimaLinha); //marcia   
}

function atualizarValoresAjdCustoNaLinha(linha) {
    console.log("Chamando atualizarValoresAjdCustoNaLinha para:", linha);

    const selectAlimentacao = linha.querySelector('.select-alimentacao');
    const selectTransporte = linha.querySelector('.select-transporte');
    const valorAlimentacaoDiv = linha.querySelector('.valor-alimentacao');
    const valorTransporteDiv = linha.querySelector('.valor-transporte');
    const totAjdCustoCell = linha.querySelector('.totAjdCusto'); // Célula do total de Ajuda de Custo da linha

    let totalAlimentacaoLinha = 0;
    let totalTransporteLinha = 0;
    let totalAjdCustoLinha = 0;

    // Garante que os valores base existem (podem ser 0 se a função não foi selecionada)
    const baseAlmoco = parseFloat(vlrAlmoco || 0);
    const baseJantar = parseFloat(vlrJantar || 0);
    const baseTransporte = parseFloat(vlrTransporte || 0); // Renomeei para evitar conflito

    console.log(`Bases lidas do dataset: Almoco: ${baseAlmoco}, Jantar: ${baseJantar}, Transporte: ${baseTransporte}`);

    // === Lógica para Alimentação ===
    if (selectAlimentacao && valorAlimentacaoDiv) {
        
        const tipoAlimentacaoSelecionado = selectAlimentacao.value;
        console.log("TIPO SELECIONADO", selectAlimentacao.value);
        if (tipoAlimentacaoSelecionado === 'Almoco') {
            totalAlimentacaoLinha = baseAlmoco;
        } else if (tipoAlimentacaoSelecionado === 'Janta') {
            totalAlimentacaoLinha = baseJantar;
        } else if (tipoAlimentacaoSelecionado === '2alimentacao') {
            totalAlimentacaoLinha = baseAlmoco + baseJantar;
        }
        // Se for 'select' ou algo não mapeado, totalAlimentacaoLinha permanece 0
        valorAlimentacaoDiv.textContent = formatarMoeda(totalAlimentacaoLinha);
        console.log(`Alimentação: Tipo: ${tipoAlimentacaoSelecionado}, Valor Calculado: ${totalAlimentacaoLinha}`);
    }

    // === Lógica para Transporte ===
    if (selectTransporte && valorTransporteDiv) {
        const tipoTransporteSelecionado = selectTransporte.value;
        if (tipoTransporteSelecionado === 'Público' || tipoTransporteSelecionado === 'Alugado' || tipoTransporteSelecionado === 'Próprio') {
            totalTransporteLinha = baseTransporte;
        }
        // Se for 'select' ou algo não mapeado, totalTransporteLinha permanece 0
        valorTransporteDiv.textContent = formatarMoeda(totalTransporteLinha);
        console.log(`Transporte: Tipo: ${tipoTransporteSelecionado}, Valor Calculado: ${totalTransporteLinha}`);
    }
    
    // === Cálculo do Total de Ajuda de Custo da Linha ===
    totalAjdCustoLinha = totalAlimentacaoLinha + totalTransporteLinha;
    
    if (totAjdCustoCell) {
        totAjdCustoCell.textContent = formatarMoeda(totalAjdCustoLinha);
        console.log(`Total Ajd Custo da Linha: ${totalAjdCustoLinha}`);
    }

    // Nota: O `calcularTotaisOrc()` global deve ser chamado após o loop de atualização de todas as linhas
    // ou após a atualização de uma única linha pelos listeners delegados de alimentação/transporte.
    // Não é necessário chamar aqui dentro, a menos que você queira que os totais globais se atualizem
    // a cada linha que é processada, o que pode ser ineficiente.
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

    // console.log("Função configurarEventosOrcamento CHAMADA");
    carregarFuncaoOrc();
    carregarEventosOrc();
    carregarClientesOrc();
    carregarLocalMontOrc();
    carregarEquipamentosOrc();
    carregarSuprimentosOrc();
    configurarFormularioOrc();

    // Isso deve ser chamado depois que os selects estiverem carregados, se dependerem deles

   // inicializarFlatpickrsGlobais(); 
    initializeAllFlatpickrsInModal(); // Inicializa os campos de data globais

    configurarInfraCheckbox();
    
    const selectElement = document.getElementById('idMontagem');

    if (selectElement) {       
        selectElement.addEventListener('change', function() {           
            atualizarUFOrc(this);
        });
        console.log("Event listener adicionado ao idMontagem.");

    } else {
        console.error("Elemento 'idMontagem' não encontrado no DOM!");
    }   

//    const periododtproduto = document.getElementById('seletorData');

//     if (periododtproduto) {
//         flatpickr(periododtproduto, commonFlatpickrOptionsTable);  
    
//         console.log("Flatpickr inicializado para o seletor de data de produto.");

//     } else {
//         console.error("Elemento 'seletorData' não encontrado no DOM!");
//     }
    
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
                limparFormularioOrcamento(); // Implemente esta função para limpar o form
                return;
            }

            console.log(`Buscando orçamento com Nº: ${nrOrcamento}`);

            try {
                // Monta a URL para a rota GET
                const url = `orcamentos?nrOrcamento=${nrOrcamento}`;
                
                // Faz a requisição usando fetchComToken
                const orcamento = await fetchComToken(url, { method: 'GET' });

                // Se encontrou o orçamento, preenche o formulário
                console.log("DEBUG: Conteúdo de flatpickrInstances ANTES de preencher:", flatpickrInstances);
                preencherFormularioComOrcamento(orcamento);          

            } catch (error) {
                console.error("Erro ao buscar orçamento:", error);
                // Assume que 404 significa não encontrado, outros erros são falha.
                let errorMessage = error.message;
                if (error.message.includes("404")) { 
                    errorMessage = `Orçamento com o número ${nrOrcamento} não encontrado.`;
                    limparFormularioOrcamento(); // Limpa o formulário se não encontrar
                } else if (error.message.includes("400")) {
                     errorMessage = "Número do orçamento é inválido ou vazio.";
                     limparFormularioOrcamento();
                } else {
                    errorMessage = `Erro ao carregar orçamento: ${error.message}`;
                    limparFormularioOrcamento();
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

    // const btnRemoverLinha = document.getElementById('removerLinha');
    // if (btnRemoverLinha) {
    //     btnRemoverLinha.addEventListener('click', function() {
    //         console.log("Botão 'Remover Linha' clicado");
    //         // 
    //         removerLinhaOrc(this); // Chama a função para remover a linha
    //     });
    // } else {
    //     console.error("Botão 'Remover Linha' não encontrado.");
    // }

    const btnEnviar = document.getElementById('Enviar');
    btnEnviar.addEventListener("click", async function (event) {
        event.preventDefault(); // Previne o envio padrão do formulário
        console.log("Entrou no botão OK");

        btnEnviar.disabled = true;
        btnEnviar.textContent = 'Salvando...';

        try{

            const form = document.getElementById("form");
            const formData = new FormData(form);

            const temPermissaoCadastrar = temPermissao("Funcionarios", "cadastrar");
            const temPermissaoAlterar = temPermissao("Funcionarios", "alterar");


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

            const dadosOrcamento = {
                id: orcamentoId,
                status: formData.get("Status"),
                idCliente: document.querySelector(".idCliente option:checked")?.value || null, // Se o campo for vazio, será null
                idEvento: document.querySelector(".idEvento option:checked")?.value || null, // Se o campo for vazio, será null
                //idMontagem: document.querySelector(".idMontagem option:checked")?.getAttribute("data-idlocalmontagem"),
                idMontagem: document.querySelector(".idMontagem option:checked")?.value || null, // Se o campo for vazio, será null
        
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
                    
                
            
                obsItens: formData.get("obsItens"),
                obsProposta: formData.get("obsProposta"),
                totGeralVda: desformatarMoeda(document.querySelector('#totalGeralVda').value),
                totGeralCto: desformatarMoeda(document.querySelector('#totalGeralCto').value),
                totAjdCusto: desformatarMoeda(document.querySelector('#totalAjdCusto').value),
                lucroBruto: desformatarMoeda(document.querySelector('#Lucro').value),
                percentLucro: parsePercentValue(document.querySelector('#percentLucro').value),
                desconto: parseFloat(formData.get("Desconto")),
                percentDesconto: parsePercentValue(document.querySelector('#percentDesc').value),
                acrescimo: parseFloat(formData.get("Acrescimo")),
                percentAcrescimo: parsePercentValue(document.querySelector('#percentAcresc').value),
                lucroReal: desformatarMoeda(document.querySelector('#lucroReal').value),
                percentLucroReal: parsePercentValue(document.querySelector('#percentReal').value),
                vlrCliente: desformatarMoeda(document.querySelector('#valorCliente').value),
            
            };

            const itensOrcamento = [];
        //    const linhas = document.querySelectorAll("#tabela tbody tr");
            
            const tabelaBodyParaColeta = document.querySelector("#tabela tbody"); // Pegue o tbody novamente para garantir

    //console.log("DEBUG FRONTEND: HTML do tbody ANTES de coletar as linhas:", tabelaBodyParaColeta ? tabelaBodyParaColeta.innerHTML : "tbody não encontrado");

    const linhas = tabelaBodyParaColeta ? tabelaBodyParaColeta.querySelectorAll("tr") : []; // Use querySelectorAll no tbody específico

    console.log("DEBUG FRONTEND: Quantidade de linhas encontradas por querySelectorAll:", linhas.length);

    // if (linhas.length === 0) {
    //     console.error("ERRO CRÍTICO: Nenhuma linha encontrada na tabela de itens ao tentar salvar! O tbody está vazio ou as linhas não foram renderizadas/foram removidas.");
    //     // Você pode até lançar um erro aqui para parar a execução e inspecionar
    //     // throw new Error("Tabela de itens vazia ao tentar salvar.");
    // }


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
                    qtdDias: linha.querySelector(".qtdDias input")?.value || "0",

                    descontoitem: desformatarMoeda(linha.querySelector(".desconto.Moeda .ValorInteiros")?.value || '0'),
                    percentdescontoitem: parsePercentValue(linha.querySelector(".desconto.Moeda .valorPerCent")?.value),
                    acrescimoitem: desformatarMoeda(linha.querySelector(".Acrescimo.Moeda .ValorInteiros")?.value || '0'),
                    percentacrescimoitem: parsePercentValue(linha.querySelector(".Acrescimo.Moeda .valorPerCent")?.value),

                    vlrdiaria: desformatarMoeda(linha.querySelector(".vlrVenda.Moeda")?.textContent || '0'),
                    totvdadiaria: desformatarMoeda(linha.querySelector(".totVdaDiaria.Moeda")?.textContent || '0'),
                    ctodiaria: desformatarMoeda(linha.querySelector(".vlrCusto.Moeda")?.textContent || '0'),
                    totctodiaria: desformatarMoeda(linha.querySelector(".totCtoDiaria.Moeda")?.textContent || '0'),

                    tpajdctoalimentacao: linha.querySelector('.select-alimentacao')?.value || null,
                    vlrajdctoalimentacao: desformatarMoeda(linha.querySelector('.valor-alimentacao')?.textContent || '0'),
                    tpajdctotransporte: linha.querySelector('.select-transporte')?.value || null,
                    vlrajdctotransporte: desformatarMoeda(linha.querySelector('.valor-transporte')?.textContent || '0'),
                    totajdctoitem: desformatarMoeda(linha.querySelector(".totAjdCusto.Moeda")?.textContent || '0'),

                    hospedagem: desformatarMoeda(linha.querySelector(".extraCampo .hospedagem")?.value || '0'),
                    transporte: desformatarMoeda(linha.querySelector(".extraCampo .transporte")?.value || '0'),

                    totgeralitem: desformatarMoeda(linha.querySelector(".totGeral")?.textContent || '0')
                };

                // 🎯 Aqui vem o tratamento correto dos períodos:
                const campoPeriodo = linha.querySelector(".datas-item");
                const valorPeriodoInput = campoPeriodo?.value?.trim() || "";

                // item.periododiariasinicio = formatarRangeDataParaBackend(valorPeriodo);
                // // Divide as datas do range
                // const periodoFormatado = formatarRangeParaInput(item.periododiariasinicio || '');
                // console.log("datas itens:", periodoFormatado);
                // itensOrcamento.push(item);

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
            btnLimpar.addEventListener("click", limparOrcamento);
        } else {
            console.warn("Botão 'Limpar' com ID 'Limpar' não encontrado.");
        }
        
    });// Previne o envio padrão do formulário

    recalcularTotaisGerais();
}
function limparOrcamento() {
    console.log("DEBUG: Limpando formulário de orçamento...");

    const form = document.getElementById("form");
    if (!form) {
        console.error("Formulário com ID 'form' não encontrado.");
        return;
    }

    // Limpar campos de input de texto, número e textareas
    form.querySelectorAll('input[type="text"], input[type="number"], textarea').forEach(input => {
        // Ignorar campos readonly que não devem ser limpos manualmente (como nrOrcamento se for gerado)
        // ou idOrcamento
        if (!input.readOnly) {
            input.value = '';
        }
    });

    // Limpar campos ocultos específicos que devem ser resetados (como idOrcamento)
    document.getElementById('idOrcamento').value = '';
    document.getElementById('nrOrcamento').value = ''; // Se nrOrcamento for gerado, pode querer deixar vazio ou null

    // Resetar selects para a primeira opção ou uma opção padrão
    form.querySelectorAll('select').forEach(select => {
        // Encontra a primeira opção que não seja 'disabled' ou 'selected' por padrão,
        // ou a primeira opção válida.
        const defaultOption = select.querySelector('option[selected][disabled]') || select.querySelector('option:first-child');
        if (defaultOption) {
            select.value = defaultOption.value;
        }
        // Disparar evento 'change' para que outros listeners reajam (ex: Select2)
        const event = new Event('change');
        select.dispatchEvent(event);
    });

    // Desmarcar checkboxes
    form.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.checked = false;
    });

    // Limpar instâncias do Flatpickr
    // É crucial limpar as instâncias do Flatpickr, não apenas o valor do input
    // Você precisa ter acesso às instâncias do Flatpickr que foram inicializadas.
    // Se você as armazena em um array ou objeto global, pode iterar sobre elas aqui.
    // Exemplo: se você tem um array `flatpickrInstances = []`
    // flatpickrInstances.forEach(fp => fp.clear());

    // Para os campos Flatpickr principais do formulário:
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
        tabelaBody.innerHTML = `<td colspan="20" style="text-align: center;">Nenhum item adicionado a este orçamento.</td>`;
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
    document.getElementById('valorCliente').value = 'R$ 0,00';

    // Se você tiver máscaras (como IMask), pode precisar re-aplicá-las ou garantir que o valor seja resetado corretamente
    // Ex: IMask(document.getElementById('Desconto'), { mask: 'R$ num', ... }).value = 'R$ 0,00';

    console.log("DEBUG: Formulário de orçamento limpo.");
}


function preencherFormularioComOrcamento(orcamento) {
    if (!orcamento) {
        limparFormularioOrcamento();
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

    // const localMontagemSelect = document.querySelector('.idMontagem');
    // if (localMontagemSelect) {      
    //     localMontagemSelect.value = orcamento.idmontagem || '';         
    // } else {
    //     console.warn("Elemento com classe '.idMontagem' não encontrado.");
    // }   


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
        // Chamar atualizarUFOrc para garantir que a visibilidade das colunas extras seja ajustada
        // e que o input 'ufmontagem' seja atualizado com base na opção selecionada.
        // Se a função atualizarUFOrc espera o select, passamos ele.
        atualizarUFOrc(localMontagemSelect); 
        // Se atualizarUFOrc já lida com o input diretamente, podemos passar o valor da UF:
        // atualizarUFOrc(orcamento.ufmontagem || ''); // Se atualizarUFOrc for adaptada para receber a UF diretamente.
    } else {
        console.warn("Elemento com classe '.idMontagem' não encontrado.");
    }

    console.log("Preenchendo campos de data com os valores do orçamento:", orcamento);
    for (const id in flatpickrInstances) {
        const pickerInstance = flatpickrInstances[id];
        
        console.log(`Verificando Flatpickr para ID: ${id}`); // Log para depuração
        console.log(`Instância Flatpickr para ID ${id}:`, pickerInstance); //
        // Verificação robusta para a instância do Flatpickr
        if (pickerInstance && typeof pickerInstance.setDate === 'function' && pickerInstance.config) {
            let inicio = null;
            let fim = null;
            
            console.log(`Preenchendo Flatpickr para ID: ${id}`); // Log para depuração
            console.log(`Valores do orçamento para ${id}:`, orcamento);
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

            console.log(`Configurando Flatpickr para ${id}: Data Início = ${startDate}, Data Fim = ${endDate}`); 
            console.log(`startDate isNaN: ${isNaN(startDate?.getTime())}, endDate isNaN: ${isNaN(endDate?.getTime())}`);          

                    
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
    //console.log("Campos de data preenchidos com sucesso.");

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

    // Preencher campos de valor formatados (adicionando verificações de null)
    // Use `document.getElementById` se o elemento tiver ID, ou `document.querySelector` se for por classe.
    const totalGeralVdaInput = document.getElementById('totalGeralVda');
    if (totalGeralVdaInput) totalGeralVdaInput.value = formatarMoeda(orcamento.totgeralvda || 0);

    const totalGeralCtoInput = document.getElementById('totalGeralCto');
    if (totalGeralCtoInput) totalGeralCtoInput.value = formatarMoeda(orcamento.totgeralcto || 0);

    const totalAjdCustoInput = document.getElementById('totalAjdCusto');
    if (totalAjdCustoInput) totalAjdCustoInput.value = formatarMoeda(orcamento.totajdcto || 0);

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

    const valorClienteInput = document.getElementById('valorCliente');
    if (valorClienteInput) valorClienteInput.value = formatarMoeda(orcamento.vlrcliente || 0);
    
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


// function preencherItensOrcamentoTabela(itens) {
//     console.log("DEBUG FRONTEND: preencherItensOrcamentoTabela foi chamada com itens:", itens);

//     const tabelaBody = document.querySelector("#tabela tbody");

//     if (!tabelaBody) {
//         console.warn("Corpo da tabela de itens (seletor #tabela tbody) não encontrado. Não é possível preencher os itens.");
//         return;
//     }

//     tabelaBody.innerHTML = ''; // Limpa as linhas existentes

//     if (!itens || itens.length === 0) {
//         console.log("Nenhum item encontrado para este orçamento ou 'itens' está vazio.");
//         const emptyRow = tabelaBody.insertRow();
//         emptyRow.innerHTML = `<td colspan="20" style="text-align: center;">Nenhum item adicionado a este orçamento.</td>`;
//         return;
//     }

//     // Variável global para controle de listener da tabela (para os botões de incremento/decremento)
//     // Isso evita registrar o listener várias vezes na tabela inteira.
//     if (!window.hasRegisteredTableClickListener) {
//         document.querySelector("#tabela").addEventListener("click", function(event) {
//             // Lógica para botões de incremento/decremento
//             let input;
//             let linha;

//             if (event.target.classList.contains("increment")) {
//                 input = event.target.closest(".add-less").querySelector("input[type='number']");
//                 if (input) {
//                     input.value = parseInt(input.value || 0) + 1;
//                     linha = input.closest("tr");
//                     if (linha) {
//                         recalcularLinha(linha); 
//                     }
//                 }
//             } else if (event.target.classList.contains("decrement")) {
//                 input = event.target.closest(".add-less").querySelector("input[type='number']");
//                 if (input) {
//                     const valorAtual = parseInt(input.value || 0);
//                     input.value = Math.max(0, valorAtual - 1);
//                     linha = input.closest("tr");
//                     if (linha) {
//                         recalcularLinha(linha); 
//                     }
//                 }
//             }
//         });
//         window.hasRegisteredTableClickListener = true; // Marca que o listener já foi adicionado
//     }

//     itens.forEach(item => {
//         console.log("DEBUG FRONTEND: Adicionando item à tabela:", item);
//         const newRow = tabelaBody.insertRow(); // Cria a linha DOM de uma vez

//         // Formatação de datas para Flatpickr
//         const inicioDiarias = item.periododiariasinicio;
//         const fimDiarias = item.periododiariasfim;
//         let valorInicialDoInputDiarias = '';
//         const formattedInicio = formatarDataParaBR(inicioDiarias);
//         const formattedFim = formatarDataParaBR(fimDiarias);

//         if (formattedInicio && formattedFim) {
//             valorInicialDoInputDiarias = `${formattedInicio} a ${formattedFim}`;
//         } else if (formattedInicio) {
//             valorInicialDoInputDiarias = formattedInicio;
//         }

//         // Construa o HTML de TODA a linha como uma única string
//         newRow.innerHTML = `
//             <td><input type="hidden" class="idItemOrcamento" value="${item.idorcamentoitem || ''}"></td>
//             <td class="Proposta">
//                 <div class="checkbox-wrapper-33" style="margin-top: 40px;">
//                     <label class="checkbox">
//                         <input class="checkbox__trigger visuallyhidden" type="checkbox" ${item.enviarnaproposta ? 'checked' : ''} />
//                         <span class="checkbox__symbol">
//                             <svg aria-hidden="true" class="icon-checkbox" width="28px" height="28px" viewBox="0 0 28 28" version="1" xmlns="http://www.w3.org/2000/svg">
//                                 <path d="M4 14l8 7L24 7"></path>
//                             </svg>
//                         </span>
//                         <p class="checkbox__textwrapper"></p>
//                     </label>
//                 </div>
//             </td>
//             <td class="Categoria">${item.categoria || ''}</td>
//             <td class="qtdProduto">
//                 <div class="add-less">
//                     <input type="number" class="qtdProduto" min="0" value="${item.qtditens || 0}">
//                     <div class="Bt">
//                         <button type="button" class="increment">+</button>
//                         <button type="button" class="decrement">-</button>
//                     </div>
//                 </div>
//             </td>
//             <td class="produto">${item.produto || ''}</td>
//             <td class="qtdDias">
//                 <div class="add-less">
//                     <input type="number" readonly class="qtdDias" min="0" value="${item.qtddias || 0}">
//                     <div class="Bt">
//                         <button type="button" class="increment">+</button>
//                         <button type="button" class="decrement">-</button>
//                     </div>
//                 </div>
//             </td>
//             <td class="Periodo">
//                 <div class="flatpickr-container">
//                     <input type="text" class="datas datas-item" data-input required readonly placeholder="Clique para Selecionar" value="${valorInicialDoInputDiarias}">
//                 </div>
//             </td>
//             <td class="desconto Moeda">
//                 <div class="Acres-Desc">
//                     <input type="text" class="ValorInteiros" value="${formatarMoeda(item.descontoitem || 0)}">
//                     <input type="text" class="valorPerCent" value="${parseFloat(item.percentdescontoitem || 0).toFixed(2)}%">
//                 </div>
//             </td>
//             <td class="Acrescimo Moeda">
//                 <div class="Acres-Desc">
//                     <input type="text" class="ValorInteiros" value="${formatarMoeda(item.acrescimoitem || 0)}">
//                     <input type="text" class="valorPerCent" value="${parseFloat(item.percentacrescimoitem || 0).toFixed(2)}%">
//                 </div>
//             </td>
//             <td class="vlrVenda Moeda">${formatarMoeda(item.vlrdiaria || 0)}</td>
//             <td class="totVdaDiaria Moeda">${formatarMoeda(item.totvdadiaria || 0)}</td>
//             <td class="vlrCusto Moeda">${formatarMoeda(item.ctodiaria || 0)}</td>
//             <td class="totCtoDiaria Moeda">${formatarMoeda(item.totctodiaria || 0)}</td>
//             <td class="ajdCusto Moeda">
//                 <div class="Acres-Desc">
//                     <select class="tpAjdCusto-alimentacao">
//                         <option value="select" ${item.tpajdctoalimentacao === '' || item.tpajdctoalimentacao === 'select' ? 'selected disabled' : ''}>Alimentação</option>
//                         <option value="almoco" ${item.tpajdctoalimentacao === 'almoco' ? 'selected' : ''}>Almoço</option>
//                         <option value="janta" ${item.tpajdctoalimentacao === 'janta' ? 'selected' : ''}>Jantar</option>
//                         <option value="2alimentacao" ${item.tpajdctoalimentacao === '2alimentacao' ? 'selected' : ''}>Almoço + jantar</option>
//                     </select>
//                 </div>
//                 <br><span class="valorbanco alimentacao">${formatarMoeda(item.vlrajdctoalimentacao || 0)}</span>
//             </td>
//             <td class="ajdCusto Moeda">
//                 <div class="Acres-Desc">
//                     <select class="tpAjdCusto-transporte">
//                         <option value="select" ${item.tpajdctotransporte === '' || item.tpajdctotransporte === 'select' ? 'selected disabled' : ''}>Veiculo</option>
//                         <option value="Publico" ${item.tpajdctotransporte === 'Publico' ? 'selected' : ''}>Publico</option>
//                         <option value="alugado" ${item.tpajdctotransporte === 'alugado' ? 'selected' : ''}>alugado</option>
//                         <option value="Proprio" ${item.tpajdctotransporte === 'Proprio' ? 'selected' : ''}>Proprio</option>
//                     </select>
//                 </div>
//                 <br><span class="valorbanco transporte">${formatarMoeda(item.vlrajdctotransporte || 0)}</span>
//             </td>
//             <td class="totAjdCusto Moeda">${formatarMoeda(item.totajdctoitem || 0)}</td>
//             <td class="extraCampo" style="display: none;">
//                 <input type="text" class="hospedagem" value="${item.hospedagem || 0}" min="0" step="0.01">
//             </td>
//             <td class="extraCampo" style="display: none;">
//                 <input type="text" class="transporte" value="${item.transporte || 0}" min="0" step="0.01">
//             </td>
//             <td class="totGeral Moeda">${formatarMoeda(item.totgeralitem || 0)}</td>
//             <td>
//                 <div class="Acao">
//                     <button class="deleteBtn" type="button">
//                         <svg class="delete-svgIcon" viewBox="0 0 448 512">
//                             <path d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z"></path>
//                         </svg>
//                     </button>
//                 </div>
//             </td>
//         `;

//         // Agora, adicione os event listeners aos elementos recém-criados DENTRO desta 'newRow'
//         // NUNCA use 'oninput' no HTML gerado quando você vai adicionar listeners via JS.

//         // Event listeners para inputs de desconto/acréscimo
//         newRow.querySelector('.desconto .ValorInteiros')?.addEventListener('input', function() {
//             recalcularLinha(this.closest('tr'));
//         });
//         newRow.querySelector('.desconto .valorPerCent')?.addEventListener('input', function() {
//             recalcularLinha(this.closest('tr'));
//         });
//         newRow.querySelector('.Acrescimo .ValorInteiros')?.addEventListener('input', function() {
//             recalcularLinha(this.closest('tr'));
//         });
//         newRow.querySelector('.Acrescimo .valorPerCent')?.addEventListener('input', function() {
//             recalcularLinha(this.closest('tr'));
//         });
        
//         // Event listeners para campos de ajuda de custo (selects)
//         newRow.querySelector('.tpAjdCusto-alimentacao')?.addEventListener('change', function() {
//             recalcularLinha(this.closest('tr'));
//         });
//         newRow.querySelector('.tpAjdCusto-transporte')?.addEventListener('change', function() {
//             recalcularLinha(this.closest('tr'));
//         });

//         // Event listeners para campos extras (hospedagem, transporte)
//         newRow.querySelector('.hospedagem')?.addEventListener('input', function() {
//             recalcularLinha(this.closest('tr'));
//         });
//         newRow.querySelector('.transporte')?.addEventListener('input', function() {
//             recalcularLinha(this.closest('tr'));
//         });

//         // Inicialização do Flatpickr
//         const itemDateInput = newRow.querySelector(".Periodo .datas-item");
//         if (itemDateInput) {
//             const defaultDatesArray = [];
//             if (inicioDiarias) {
//                 defaultDatesArray.push(new Date(inicioDiarias));
//             }
//             if (fimDiarias) {
//                 defaultDatesArray.push(new Date(fimDiarias));
//             }

//             flatpickr(itemDateInput, {
//                 mode: "range",
//                 dateFormat: "d/m/Y",
//                 locale: flatpickr.l10ns.pt,
//                 defaultDate: defaultDatesArray.length > 0 ? defaultDatesArray : [],
//                 onChange: function(selectedDates, dateStr, instance) {
//                     // Você pode querer chamar recalcularLinha aqui se a mudança de datas afeta cálculos
//                     recalcularLinha(itemDateInput.closest('tr'));
//                 }
//             });
//         }
        
//         // Event listener para o botão de excluir
//         newRow.querySelector('.deleteBtn')?.addEventListener('click', async function() {
//             const currentItemProduct = item.produto; // Captura o nome do produto para o SweetAlert
//             const { isConfirmed } = await Swal.fire({
//                 title: `Tem Certeza que deseja EXCLUIR o item "${currentItemProduct}" ?`,
//                 text: "Você não poderá reverter esta ação!",
//                 icon: "warning",
//                 showCancelButton: true,
//                 confirmButtonColor: "#3085d6",
//                 cancelButtonColor: "#d33",
//                 confirmButtonText: "Sim, deletar!",
//                 cancelButtonText: "Cancelar"
//             });

//             if (isConfirmed) {
//                 this.closest('tr').remove(); // 'this' se refere ao botão, closest('tr') pega a linha pai
//                 recalcularTotaisGerais(); 
//                 calcularLucro(); // Chame se necessário
//                 Swal.fire(
//                     "Deletado!",
//                     "O item foi removido.",
//                     "success"
//                 );
//             }
//         });
//     });

//     // Recalcula os totais gerais após preencher todos os itens.
//     recalcularTotaisGerais(); 
//     aplicarMascaraMoeda(); // Se esta função aplica máscaras aos totais gerais, etc.
//     aplicarDescontoEAcrescimo(); // Se esta função aplica máscaras ou outras coisas
//     calcularLucro(); // Chame aqui se necessário
// }

// Importe as funções auxiliares que você usa aqui (formatarMoeda, etc.)
// Ex: import { formatarMoeda } from './Formataçoes.js'; // ou onde estiver
// import { formatarDatasParaInputPeriodo } from './seuarquivo.js'; // se estiver em um arquivo separado

function preencherItensOrcamentoTabela(itens) {
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

    // Adiciona event listeners para os botões de incremento/decremento (qtdProduto, qtdDias)
    if (!window.hasRegisteredClickListener) {
        document.querySelector("#tabela").addEventListener("click", function(event) {
            if (event.target.classList.contains("increment")) {
                const input = event.target.closest("td").querySelector("input.qtdProduto");
                if (input) {
                    input.value = parseInt(input.value || 0) + 1;
                    const linha = input.closest("tr");
                    if (linha) {
                        recalcularLinha(linha); // Chama aqui, dentro do clique
                    }
                }
            }

            if (event.target.classList.contains("decrement")) {
                const input = event.target.closest("td").querySelector("input.qtdProduto");
                if (input) {
                    const valorAtual = parseInt(input.value || 0);
                    input.value = Math.max(0, valorAtual - 1);
                    const linha = input.closest("tr");
                    if (linha) {
                        recalcularLinha(linha); // Também aqui
                    }
                }
            }
        });

        window.hasRegisteredClickListener = true; // Marca que o listener já foi adicionado
    }



    // itens.forEach(item => {
    //     console.log("DEBUG FRONTEND: Adicionando item à tabela:", item);
    //     const newRow = tabelaBody.insertRow();

    //     // 1. ID do Item (oculto)
    //     // Você não tem uma coluna <th> para isso, então o <td> abaixo será a primeira célula
    //     newRow.innerHTML = `<td><input type="hidden" class="idItemOrcamento" value="${item.idorcamentoitem || ''}"></td>`;      

    //     // 2. P/ Proposta (Checkbox com estilo complexo)
    //     newRow.innerHTML += `
    //         <td class="Proposta">
    //             <div class="checkbox-wrapper-33" style="margin-top: 40px;">
    //                 <label class="checkbox">
    //                     <input class="checkbox__trigger visuallyhidden" type="checkbox" ${item.enviarnaproposta ? 'checked' : ''} />
    //                     <span class="checkbox__symbol">
    //                         <svg aria-hidden="true" class="icon-checkbox" width="28px" height="28px" viewBox="0 0 28 28" version="1" xmlns="http://www.w3.org/2000/svg">
    //                             <path d="M4 14l8 7L24 7"></path>
    //                         </svg>
    //                     </span>
    //                     <p class="checkbox__textwrapper"></p>
    //                 </label>
    //             </div>
    //         </td>
    //     `;

    //     // 3. Categoria (Assumindo que é texto puro aqui, se for SELECT, precisa de mais lógica)
    //     newRow.innerHTML += `<td class="Categoria">${item.categoria || ''}</td>`;

    //     // 4. Qtd Itens (Com botões de incremento/decremento)
    //     newRow.innerHTML += `
    //         <td class="qtdProduto">
    //             <div class="add-less">
    //                 <input type="number" class="qtdProduto" min="0" value="${item.qtditens || 0}" oninput="recalcularLinha()">
    //                 <div class="Bt">
    //                     <button type="button" class="increment">+</button>
    //                     <button type="button" class="decrement">-</button>
    //                 </div>
    //             </div>
    //         </td>
    //     `;

    //     // 5. Produto (Assumindo que é texto puro, se for SELECT, precisa de mais lógica)
    //     newRow.innerHTML += `<td class="produto">${item.produto || ''}</td>`; // Se for select, você teria que recriar o select e setar a opção

    //     // 6. Qtd Dias (Com botões de incremento/decremento)
    //     newRow.innerHTML += 
    //        ` <td class="qtdDias"><div class="add-less"><input type="number" readonly class="qtdDias" min="0" value="${item.qtddias || 0}" oninput="recalcularTotaisGerais()"></td>
    //     `;

    //     // 7. Periodo das diárias (Flatpickr)
    //     // Removido o ID fixo "seletorData" para evitar IDs duplicados
    //     const inicioDiarias = item.periododiariasinicio; // Ex: "2025-03-25T03:00:00.000Z"
    //     const fimDiarias = item.periododiariasfim;     // Ex: "2025-07-16T03:00:00.000Z" ou null

    //     let valorInicialDoInputDiarias = ''; // Inicializa como string vazia

    //     // Formata as datas individualmente
    //     const formattedInicio = formatarDataParaBR(inicioDiarias);
    //     const formattedFim = formatarDataParaBR(fimDiarias);

    //     // Lógica para montar a string de exibição no input
    //     if (formattedInicio && formattedFim) {
    //         // Se ambas as datas são válidas e existem, exibe o range
    //         valorInicialDoInputDiarias = `${formattedInicio} a ${formattedFim}`;
    //     } else if (formattedInicio) {
    //         // Se apenas a data de início é válida, exibe apenas ela
    //         valorInicialDoInputDiarias = formattedInicio;
    //     }
    //     // Se formattedFim for o único válido ou ambos forem inválidos, valorInicialDoInputDiarias permanece ''

    //     console.log(`DEBUG: Item ${item.idorcamentoitem} - inicioDiarias: "${inicioDiarias}", fimDiarias: "${fimDiarias}"`);
    //     console.log(`DEBUG: Item ${item.idorcamentoitem} - formattedInicio: "${formattedInicio}", formattedFim: "${formattedFim}"`);
    //     console.log(`DEBUG: Item ${item.idorcamentoitem} - valorInicialDoInputDiarias final: "${valorInicialDoInputDiarias}"`);


    //     newRow.innerHTML += `
    //         <td class="Periodo">
    //             <div class="flatpickr-container">
    //                 <input type="text" class="datas datas-item" data-input required readonly placeholder="Clique para Selecionar" value="${valorInicialDoInputDiarias}">
    //             </div>
    //         </td>
    //     `;
    //    // <input type="text" class="ValorInteiros" value="${formatarMoeda(item.descontoitem || 0)}">
    //     // <input type="text" class="valorPerCent" value="${parseFloat(item.percentdescontoitem || 0).toFixed(2)}%">
    //     // 8. Desconto (Valores e porcentagens)
    //     newRow.innerHTML += `
    //         <td class="desconto Moeda">
    //             <div class="Acres-Desc">
                   
    //                 <input type="text" class="ValorInteiros" value="${formatarMoeda(item.descontoitem || 0)}">
    //                <input type="text" class="valorPerCent" value="${parseFloat(item.percentdescontoitem || 0).toFixed(2)}%">
    //             </div>
    //         </td>
    //     `;

    //    const tbody = document.getElementById('tabela').querySelector('tbody'); 
    //     // Se não tiver ID na tabela, e for a única tabela:
    //     // const tbody = document.querySelector('table tbody'); 

    //     // 2. Adicione a nova linha ao tbody
    //     if (tbody) {
    //         tbody.appendChild(newRow);
    //     } else {
    //         console.error("tbody não encontrado!");
    //         return; // Sai da iteração se o tbody não for encontrado
    //     }

    //     // 3. AGORA, adicione os event listeners aos inputs DENTRO desta newRow
    //     const inputValorInteiros = newRow.querySelector('.desconto .ValorInteiros');
    //     const inputValorPerCent = newRow.querySelector('.desconto .valorPerCent');
    //     const inputQtdProduto = newRow.querySelector('.qtdProduto input'); // Exemplo de outros inputs
    //     const inputQtdDias = newRow.querySelector('.qtdDias input');
    //     const selectAlimentacao = newRow.querySelector('.select-alimentacao');
    //     const selectTransporte = newRow.querySelector('.select-transporte');
    //     const inputHospedagem = newRow.querySelector('.hospedagem'); // Se existirem
    //     const inputTransporte = newRow.querySelector('.transporte'); // Se existirem


    //     if (inputValorInteiros) {
    //         inputValorInteiros.addEventListener('input', function() {
    //             recalcularLinha(this.closest('tr'));
    //         });
    //     }

    //     if (inputValorPerCent) {
    //         inputValorPerCent.addEventListener('input', function() {
    //             recalcularLinha(this.closest('tr'));
    //         });
    //     }

    //     // 9. Acrescimo (Valores e porcentagens)
    //     newRow.innerHTML += `
    //         <td class="Acrescimo Moeda">
    //             <div class="Acres-Desc">
    //                 <input type="text" class="ValorInteiros" value="${formatarMoeda(item.acrescimoitem || 0)}">
    //                 <input type="text" class="valorPerCent" value="${parseFloat(item.percentacrescimoitem || 0).toFixed(2)}%">
    //             </div>
    //         </td>
    //     `;

    //     // 10. VlrDiaria (Exibição)
    //     newRow.innerHTML += `<td class="vlrVenda Moeda">${formatarMoeda(item.vlrdiaria || 0)}</td>`;

    //     // 11. Tot Venda Diaria (Exibição)
    //     newRow.innerHTML += `<td class="totVdaDiaria Moeda">${formatarMoeda(item.totvdadiaria || 0)}</td>`;

    //     // 12. CtoDiaria (Exibição)
    //     newRow.innerHTML += `<td class="vlrCusto Moeda">${formatarMoeda(item.ctodiaria || 0)}</td>`;

    //     // 13. Tot Custo Diaria (Exibição)
    //     newRow.innerHTML += `<td class="totCtoDiaria Moeda">${formatarMoeda(item.totctodiaria || 0)}</td>`;

    //     // 14. AjdCusto/alimentação (SELECT com valor selecionado e valor banco)
    //     newRow.innerHTML += `
    //         <td class="ajdCusto Moeda">
    //             <div class="Acres-Desc">
    //                 <select class="tpAjdCusto-alimentacao">
    //                     <option value="select" ${item.tpajdctoalimentacao === '' || item.tpajdctoalimentacao === 'select' ? 'selected disabled' : ''}>Alimentação</option>
    //                     <option value="almoco" ${item.tpajdctoalimentacao === 'almoco' ? 'selected' : ''}>Almoço</option>
    //                     <option value="janta" ${item.tpajdctoalimentacao === 'janta' ? 'selected' : ''}>Jantar</option>
    //                     <option value="2alimentacao" ${item.tpajdctoalimentacao === '2alimentacao' ? 'selected' : ''}>Almoço + jantar</option>
    //                 </select>
    //             </div>
    //             <br><span class="valorbanco alimentacao">${formatarMoeda(item.vlrajdctoalimentacao || 0)}</span>
    //         </td>
    //     `;

    //     // 15. AjdCusto/transporte (SELECT com valor selecionado e valor banco)
    //     newRow.innerHTML += `
    //         <td class="ajdCusto Moeda">
    //             <div class="Acres-Desc">
    //                 <select class="tpAjdCusto-transporte">
    //                     <option value="select" ${item.tpajdctotransporte === '' || item.tpajdctotransporte === 'select' ? 'selected disabled' : ''}>Veiculo</option>
    //                     <option value="Publico" ${item.tpajdctotransporte === 'Publico' ? 'selected' : ''}>Publico</option>
    //                     <option value="alugado" ${item.tpajdctotransporte === 'alugado' ? 'selected' : ''}>alugado</option>
    //                     <option value="Proprio" ${item.tpajdctotransporte === 'Proprio' ? 'selected' : ''}>Proprio</option>
    //                 </select>
    //             </div>
    //             <br><span class="valorbanco transporte">${formatarMoeda(item.vlrajdctotransporte || 0)}</span>
    //         </td>
    //     `;

    //     // 16. TotAjdCusto (Exibição)
    //     newRow.innerHTML += `<td class="totAjdCusto Moeda">${formatarMoeda(item.totajdctoitem || 0)}</td>`;

    //     // 17. Hospedagem (Campo extra, oculto por padrão)
    //     newRow.innerHTML += `
    //         <td class="extraCampo" style="display: none;">
    //             <input type="text" class="hospedagem" value="${item.hospedagem || 0}" min="0" step="0.01" oninput="recalcularTotaisGerais()">
    //         </td>
    //     `;

    //     // 18. Transporte (Campo extra, oculto por padrão)
    //     newRow.innerHTML += `
    //         <td class="extraCampo" style="display: none;">
    //             <input type="text" class="transporte" value="${item.transporte || 0}" min="0" step="0.01" oninput="recalcularTotaisGerais()">
    //         </td>
    //     `;

    //     // 19. TotGeral (Exibição)
    //     newRow.innerHTML += `<td class="totGeral Moeda">${formatarMoeda(item.totgeralitem || 0)}</td>`;

    //     // 20. Ação (Botão de excluir com SVG)
    //     newRow.innerHTML += `
    //         <td>
    //             <div class="Acao">
    //                 <button class="deleteBtn" type="button">
    //                     <svg class="delete-svgIcon" viewBox="0 0 448 512">
    //                         <path d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z"></path>
    //                     </svg>
    //                 </button>
    //             </div>
    //         </td>
    //     `;

       
    //     const itemDateInput = newRow.querySelector(".Periodo .datas-item");
    //     if (itemDateInput) {
    //         const defaultDatesArray = [];
    //         // Adiciona as datas ao array APENAS se forem strings válidas e não nulas
    //         if (inicioDiarias) {
    //             defaultDatesArray.push(new Date(inicioDiarias)); // Converte para objeto Date
    //         }
    //         if (fimDiarias) {
    //             defaultDatesArray.push(new Date(fimDiarias));   // Converte para objeto Date
    //         }

    //         flatpickr(itemDateInput, {
    //             mode: "range",
    //             dateFormat: "d/m/Y",
    //             locale: flatpickr.l10ns.pt,
    //             // Passa o array de objetos Date para o defaultDate
    //             defaultDate: defaultDatesArray.length > 0 ? defaultDatesArray : [],
    //         });
    //     }

    //     if (inputQtdProduto) {
    //         inputQtdProduto.addEventListener('input', function() {
    //             recalcularLinha(this.closest('tr'));
    //         });
    //         // Para os botões + e - (se existirem e afetarem o cálculo da linha)
    //         newRow.querySelector('.qtdProduto .increment')?.addEventListener('click', function() {
    //             const input = this.closest('.qtdProduto').querySelector('input');
    //             input.value = parseInt(input.value) + 1;
    //             recalcularLinha(this.closest('tr'));
    //         });
    //         newRow.querySelector('.qtdProduto .decrement')?.addEventListener('click', function() {
    //             const input = this.closest('.qtdProduto').querySelector('input');
    //             if (parseInt(input.value) > 0) {
    //                 input.value = parseInt(input.value) - 1;
    //             }
    //             recalcularLinha(this.closest('tr'));
    //         });
    //     }

    //     if (inputQtdDias) {
    //         inputQtdDias.addEventListener('input', function() {
    //             recalcularLinha(this.closest('tr'));
    //         });
    //         // Para os botões + e - (se existirem e afetarem o cálculo da linha)
    //         newRow.querySelector('.qtdDias .increment')?.addEventListener('click', function() { // Supondo que tem botões similares
    //             const input = this.closest('.qtdDias').querySelector('input');
    //             input.value = parseInt(input.value) + 1;
    //             recalcularLinha(this.closest('tr'));
    //         });
    //         newRow.querySelector('.qtdDias .decrement')?.addEventListener('click', function() {
    //             const input = this.closest('.qtdDias').querySelector('input');
    //             if (parseInt(input.value) > 0) {
    //                 input.value = parseInt(input.value) - 1;
    //             }
    //             recalcularLinha(this.closest('tr'));
    //         });
    //     }
        
    //     if (selectAlimentacao) {
    //         selectAlimentacao.addEventListener('change', function() { // Use 'change' para selects
    //             recalcularLinha(this.closest('tr'));
    //         });
    //     }

    //     if (selectTransporte) {
    //         selectTransporte.addEventListener('change', function() { // Use 'change' para selects
    //             recalcularLinha(this.closest('tr'));
    //         });
    //     }
        
    //     // Adicione listeners para os campos 'hospedagem' e 'transporte' se existirem
    //     if (inputHospedagem) {
    //         inputHospedagem.addEventListener('input', function() {
    //             recalcularLinha(this.closest('tr'));
    //         });
    //     }
    //     if (inputTransporte) {
    //         inputTransporte.addEventListener('input', function() {
    //             recalcularLinha(this.closest('tr'));
    //         });
    //     }

    //     // Se você usa IMask ou outras máscaras para campos como Desconto/Acrescimo (ValorInteiros, valorPerCent)
    //     // ou Hospedagem/Transporte, você precisará inicializá-los AQUI para os inputs DENTRO desta nova linha.
    //     // Exemplo (se IMask estiver configurado):
    //     // newRow.querySelectorAll('.ValorInteiros').forEach(input => {
    //     //     IMask(input, { mask: 'R$ num', ... });
    //     // });
    //     // newRow.querySelectorAll('.valorPerCent').forEach(input => {
    //     //     IMask(input, { mask: 'num%', ... });
    //     // });

        

    //     // Adiciona event listener para o botão de excluir
    //     // newRow.querySelector('.btn-excluir-item, .deleteBtn').addEventListener('click', () => {
    //     //     newRow.remove(); // Remove a linha da tabela
    //     //     recalcularTotaisGerais(); // Recalcula totais após exclusão
    //     // });

    //     newRow.querySelector('.btn-excluir-item, .deleteBtn').addEventListener('click', async () => { // Adicionado 'async' aqui
    //         const { isConfirmed } = await Swal.fire({
    //             title: `Tem Certeza que deseja EXCLUIR o item "${item.produto}" ?`,
    //             text: "Você não poderá reverter esta ação!",
    //             icon: "warning",
    //             showCancelButton: true,
    //             confirmButtonColor: "#3085d6",
    //             cancelButtonColor: "#d33",
    //             confirmButtonText: "Sim, deletar!",
    //             cancelButtonText: "Cancelar"
    //         });

    //         if (isConfirmed) {
    //             newRow.remove();
    //             recalcularTotaisGerais(); // Alterado de calcularTotalOrc() para recalcularTotaisGerais()
    //             Swal.fire(
    //                 "Deletado!",
    //                 "O item foi removido.",
    //                 "success"
    //             );
    //         }
    //     });
        

    //     // Adiciona event listeners para os selects de AjdCusto se eles precisam de lógica dinâmica
    //     newRow.querySelector('.tpAjdCusto-alimentacao')?.addEventListener('change', (e) => {
    //         // Lógica para atualizar o valor de alimentação com base na seleção
    //         console.log('Alimentação selecionada:', e.target.value);
    //         // Você pode precisar de dados de custo de alimentação para atualizar o valororbanco span
    //         // Ex: atualizarAjdCustoAlimentacao(newRow, e.target.value);
    //     });
    //     newRow.querySelector('.tpAjdCusto-transporte')?.addEventListener('change', (e) => {
    //         // Lógica para atualizar o valor de transporte com base na seleção
    //         console.log('Transporte selecionado:', e.target.value);
    //         // Ex: atualizarAjdCustoTransporte(newRow, e.target.value);
    //     });
    // });


    itens.forEach(item => {
        console.log("DEBUG FRONTEND: Adicionando item à tabela:", item);
        const newRow = tabelaBody.insertRow(); // Cria a linha DOM de uma vez

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

        // Construa o HTML de TODA a linha como uma única string
        newRow.innerHTML = `
            <td><input type="hidden" class="idItemOrcamento" value="${item.idorcamentoitem || ''}"></td>
            <td class="Proposta">
                <div class="checkbox-wrapper-33" style="margin-top: 40px;">
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
            <td class="qtdDias">
                <div class="add-less">
                    <input type="number" readonly class="qtdDias" min="0" value="${item.qtddias || 0}">
                    <div class="Bt">
                        <button type="button" class="increment">+</button>
                        <button type="button" class="decrement">-</button>
                    </div>
                </div>
            </td>
            <td class="Periodo">
                <div class="flatpickr-container">
                    <input type="text" class="datas datas-item" data-input required readonly placeholder="Clique para Selecionar" value="${valorInicialDoInputDiarias}">
                </div>
            </td>
            <td class="desconto Moeda">
                <div class="Acres-Desc">
                    <input type="text" class="ValorInteiros" value="${formatarMoeda(item.descontoitem || 0)}">
                    <input type="text" class="valorPerCent" value="${parseFloat(item.percentdescontoitem || 0).toFixed(2)}%">
                </div>
            </td>
            <td class="Acrescimo Moeda">
                <div class="Acres-Desc">
                    <input type="text" class="ValorInteiros" value="${formatarMoeda(item.acrescimoitem || 0)}">
                    <input type="text" class="valorPerCent" value="${parseFloat(item.percentacrescimoitem || 0).toFixed(2)}%">
                </div>
            </td>
            <td class="vlrVenda Moeda">${formatarMoeda(item.vlrdiaria || 0)}</td>
            <td class="totVdaDiaria Moeda">${formatarMoeda(item.totvdadiaria || 0)}</td>
            <td class="vlrCusto Moeda">${formatarMoeda(item.ctodiaria || 0)}</td>
            <td class="totCtoDiaria Moeda">${formatarMoeda(item.totctodiaria || 0)}</td>
            <td class="ajdCusto Moeda">
                <div class="Acres-Desc">
                    <select class="tpAjdCusto-alimentacao">
                        <option value="select" ${item.tpajdctoalimentacao === '' || item.tpajdctoalimentacao === 'select' ? 'selected disabled' : ''}>Alimentação</option>
                        <option value="almoco" ${item.tpajdctoalimentacao === 'almoco' ? 'selected' : ''}>Almoço</option>
                        <option value="janta" ${item.tpajdctoalimentacao === 'janta' ? 'selected' : ''}>Jantar</option>
                        <option value="2alimentacao" ${item.tpajdctoalimentacao === '2alimentacao' ? 'selected' : ''}>Almoço + jantar</option>
                    </select>
                </div>
                <br><span class="valorbanco alimentacao">${formatarMoeda(item.vlrajdctoalimentacao || 0)}</span>
            </td>
            <td class="ajdCusto Moeda">
                <div class="Acres-Desc">
                    <select class="tpAjdCusto-transporte">
                        <option value="select" ${item.tpajdctotransporte === '' || item.tpajdctotransporte === 'select' ? 'selected disabled' : ''}>Veiculo</option>
                        <option value="Publico" ${item.tpajdctotransporte === 'Publico' ? 'selected' : ''}>Publico</option>
                        <option value="alugado" ${item.tpajdctotransporte === 'alugado' ? 'selected' : ''}>alugado</option>
                        <option value="Proprio" ${item.tpajdctotransporte === 'Proprio' ? 'selected' : ''}>Proprio</option>
                    </select>
                </div>
                <br><span class="valorbanco transporte">${formatarMoeda(item.vlrajdctotransporte || 0)}</span>
            </td>
            <td class="totAjdCusto Moeda">${formatarMoeda(item.totajdctoitem || 0)}</td>
            <td class="extraCampo" style="display: none;">
                <input type="text" class="hospedagem" value="${item.hospedagem || 0}" min="0" step="0.01">
            </td>
            <td class="extraCampo" style="display: none;">
                <input type="text" class="transporte" value="${item.transporte || 0}" min="0" step="0.01">
            </td>
            <td class="totGeral Moeda">${formatarMoeda(item.totgeralitem || 0)}</td>
            <td>
                <div class="Acao">
                    <button class="deleteBtn" type="button">
                        <svg class="delete-svgIcon" viewBox="0 0 448 512">
                            <path d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z"></path>
                        </svg>
                    </button>
                </div>
            </td>
        `;

        // Agora, adicione os event listeners aos elementos recém-criados DENTRO desta 'newRow'
        // NUNCA use 'oninput' no HTML gerado quando você vai adicionar listeners via JS.

        // Event listeners para inputs de desconto/acréscimo
        newRow.querySelector('.desconto .ValorInteiros')?.addEventListener('input', function() {
           // aplicarMascaraMoeda();
            recalcularLinha(this.closest('tr'));
        });
        newRow.querySelector('.desconto .valorPerCent')?.addEventListener('input', function() {
            recalcularLinha(this.closest('tr'));
        });
        newRow.querySelector('.Acrescimo .ValorInteiros')?.addEventListener('input', function() {
            recalcularLinha(this.closest('tr'));
        });
        newRow.querySelector('.Acrescimo .valorPerCent')?.addEventListener('input', function() {
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
        newRow.querySelector('.transporte')?.addEventListener('input', function() {
            recalcularLinha(this.closest('tr'));
        });

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
                    // Você pode querer chamar recalcularLinha aqui se a mudança de datas afeta cálculos
                    recalcularLinha(itemDateInput.closest('tr'));
                }
            });
        }
        
        // Event listener para o botão de excluir
        newRow.querySelector('.deleteBtn')?.addEventListener('click', async function() {
            const currentItemProduct = item.produto; // Captura o nome do produto para o SweetAlert
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
                this.closest('tr').remove(); // 'this' se refere ao botão, closest('tr') pega a linha pai
                recalcularTotaisGerais(); 
                calcularLucro(); // Chame se necessário
                Swal.fire(
                    "Deletado!",
                    "O item foi removido.",
                    "success"
                );
            }
        });
    });


    // Se você tem uma função para recalcular os totais gerais do orçamento
    // chame-a aqui após preencher todos os itens.
    recalcularTotaisGerais(); // Certifique-se que esta função existe e faz o que precisa.
    aplicarMascaraMoeda();
    aplicarDescontoEAcrescimo();
    calcularLucro();

}

// function preencherItensOrcamentoTabela(itens) {
//     console.log("DEBUG FRONTEND: preencherItensOrcamentoTabela foi chamada com itens:", itens);

//     const tabelaBody = document.querySelector("#tabela tbody");

//     if (!tabelaBody) {
//         console.warn("Corpo da tabela de itens (seletor #tabela tbody) não encontrado. Não é possível preencher os itens.");
//         return;
//     }

//     tabelaBody.innerHTML = ''; // Limpa as linhas existentes

//     if (!itens || itens.length === 0) {
//         console.log("Nenhum item encontrado para este orçamento ou 'itens' está vazio.");
//         const emptyRow = tabelaBody.insertRow();
//         emptyRow.innerHTML = `<td colspan="20" style="text-align: center;">Nenhum item adicionado a este orçamento.</td>`;
//         return;
//     }

//     itens.forEach(item => {
//         console.log("DEBUG FRONTEND: Adicionando item à tabela:", item);
//         const newRow = tabelaBody.insertRow();

//         // 1. ID do Item (oculto) - ESTA É A PRIMEIRA CÉLULA E CORRESPONDE AO <th> VAZIO NO THEAD
//         newRow.innerHTML = `<td><input type="hidden" class="idItemOrcamento" value="${item.idorcamentoitem || ''}"></td>`;

//         // 2. P/ Proposta (Checkbox com estilo complexo)
//         newRow.innerHTML += `
//             <td class="Proposta">
//                 <div class="checkbox-wrapper-33" style="margin-top: 40px;">
//                     <label class="checkbox">
//                         <input class="checkbox__trigger visuallyhidden" type="checkbox" ${item.enviarnaproposta ? 'checked' : ''} />
//                         <span class="checkbox__symbol">
//                             <svg aria-hidden="true" class="icon-checkbox" width="28px" height="28px" viewBox="0 0 28 28" version="1" xmlns="http://www.w3.org/2000/svg">
//                                 <path d="M4 14l8 7L24 7"></path>
//                             </svg>
//                         </span>
//                         <p class="checkbox__textwrapper"></p>
//                     </label>
//                 </div>
//             </td>
//         `;

//         // 3. Categoria (agora com input para edição)
//        //newRow.innerHTML += `<td class="Categoria"><input type="text" class="categoria-input" value="${item.categoria || ''}"></td>`;
//         newRow.innerHTML += `<td class="Categoria">${item.categoria || ''}</td>`;
//         // 4. Qtd Itens (Com botões de incremento/decremento)
//         newRow.innerHTML += `
//             <td class="qtdProduto">
//                 <div class="add-less">
//                     <input type="number" class="qtdProduto" min="0" value="${item.qtditens || 0}" oninput="recalcularLinha(this.closest('tr'))">
//                     <div class="Bt">
//                         <button type="button" class="increment">+</button>
//                         <button type="button" class="decrement">-</button>
//                     </div>
//                 </div>
//             </td>
//         `;

//         // 5. Produto (agora com input para edição)
//        // newRow.innerHTML += `<td class="produto"><input type="text" class="produto-input" value="${item.produto || ''}"></td>`;
//         newRow.innerHTML += `<td class="produto">${item.produto || ''}</td>`;
//         // 6. Qtd Dias (Com botões de incremento/decremento)
//         newRow.innerHTML += 
//             ` <td class="qtdDias"><div class="add-less"><input type="number" readonly class="qtdDias" min="0" value="${item.qtddias || 0}" oninput="recalcularLinha(this.closest('tr'))"></div></td>
//         `;

//         // 7. Periodo das diárias (Flatpickr)
//         const inicioDiarias = item.periododiariasinicio;
//         const fimDiarias = item.periododiariasfim;

//         let valorInicialDoInputDiarias = '';
//         const formattedInicio = formatarDataParaBR(inicioDiarias);
//         const formattedFim = formatarDataParaBR(fimDiarias);

//         if (formattedInicio && formattedFim) {
//             valorInicialDoInputDiarias = `${formattedInicio} a ${formattedFim}`;
//         } else if (formattedInicio) {
//             valorInicialDoInputDiarias = formattedInicio;
//         }

//         console.log(`DEBUG: Item ${item.idorcamentoitem} - inicioDiarias: "${inicioDiarias}", fimDiarias: "${fimDiarias}"`);
//         console.log(`DEBUG: Item ${item.idorcamentoitem} - formattedInicio: "${formattedInicio}", formattedFim: "${formattedFim}"`);
//         console.log(`DEBUG: Item ${item.idorcamentoitem} - valorInicialDoInputDiarias final: "${valorInicialDoInputDiarias}"`);

//         newRow.innerHTML += `
//             <td class="Periodo">
//                 <div class="flatpickr-container">
//                     <input type="text" class="datas datas-item" data-input required readonly placeholder="Clique para Selecionar" value="${valorInicialDoInputDiarias}">
//                 </div>
//             </td>
//         `;
        
//         // 8. Desconto (Valores e porcentagens)
//         newRow.innerHTML += `
//             <td class="desconto Moeda">
//                 <div class="Acres-Desc">
//                     <input type="text" class="ValorInteiros" value="${formatarMoeda(item.descontoitem || 0)}" oninput="recalcularLinha(this.closest('tr'))">
//                     <input type="text" class="valorPerCent" value="${parseFloat(item.percentdescontoitem || 0).toFixed(2)}%" oninput="recalcularLinha(this.closest('tr'))">
//                 </div>
//             </td>
//         `;

//         // 9. Acrescimo (Valores e porcentagens)
//         newRow.innerHTML += `
//             <td class="Acrescimo Moeda">
//                 <div class="Acres-Desc">
//                     <input type="text" class="ValorInteiros" value="${formatarMoeda(item.acrescimoitem || 0)}" oninput="recalcularLinha(this.closest('tr'))">
//                     <input type="text" class="valorPerCent" value="${parseFloat(item.percentacrescimoitem || 0).toFixed(2)}%" oninput="recalcularLinha(this.closest('tr'))">
//                 </div>
//             </td>
//         `;

//         // 10. VlrDiaria (Exibição)
//         newRow.innerHTML += `<td class="vlrVenda Moeda">${formatarMoeda(item.vlrdiaria || 0)}</td>`;

//         // 11. Tot Venda Diaria (Exibição)
//         newRow.innerHTML += `<td class="totVdaDiaria Moeda">${formatarMoeda(item.totvdadiaria || 0)}</td>`;

//         // 12. CtoDiaria (Exibição)
//         newRow.innerHTML += `<td class="vlrCusto Moeda">${formatarMoeda(item.ctodiaria || 0)}</td>`;

//         // 13. Tot Custo Diaria (Exibição)
//         newRow.innerHTML += `<td class="totCtoDiaria Moeda">${formatarMoeda(item.totctodiaria || 0)}</td>`;

//         // 14. AjdCusto/alimentação (SELECT com valor selecionado e valor banco)
//         newRow.innerHTML += `
//             <td class="ajdCusto Moeda">
//                 <div class="Acres-Desc">
//                     <select class="tpAjdCusto-alimentacao">
//                         <option value="select" ${item.tpajdctoalimentacao === '' || item.tpajdctoalimentacao === 'select' ? 'selected disabled' : ''}>Alimentação</option>
//                         <option value="almoco" ${item.tpajdctoalimentacao === 'almoco' ? 'selected' : ''}>Almoço</option>
//                         <option value="janta" ${item.tpajdctoalimentacao === 'janta' ? 'selected' : ''}>Jantar</option>
//                         <option value="2alimentacao" ${item.tpajdctoalimentacao === '2alimentacao' ? 'selected' : ''}>Almoço + jantar</option>
//                     </select>
//                 </div>
//                 <br><span class="valorbanco alimentacao">${formatarMoeda(item.vlrajdctoalimentacao || 0)}</span>
//             </td>
//         `;

//         // 15. AjdCusto/transporte (SELECT com valor selecionado e valor banco)
//         newRow.innerHTML += `
//             <td class="ajdCusto Moeda">
//                 <div class="Acres-Desc">
//                     <select class="tpAjdCusto-transporte">
//                         <option value="select" ${item.tpajdctotransporte === '' || item.tpajdctotransporte === 'select' ? 'selected disabled' : ''}>Veiculo</option>
//                         <option value="Publico" ${item.tpajdctotransporte === 'Publico' ? 'selected' : ''}>Publico</option>
//                         <option value="alugado" ${item.tpajdctotransporte === 'alugado' ? 'selected' : ''}>alugado</option>
//                         <option value="Proprio" ${item.tpajdctotransporte === 'Proprio' ? 'selected' : ''}>Proprio</option>
//                     </select>
//                 </div>
//                 <br><span class="valorbanco transporte">${formatarMoeda(item.vlrajdctotransporte || 0)}</span>
//             </td>
//         `;

//         // 16. TotAjdCusto (Exibição)
//         newRow.innerHTML += `<td class="totAjdCusto Moeda">${formatarMoeda(item.totajdctoitem || 0)}</td>`;

//         // 17. Hospedagem (Campo extra, oculto por padrão)
//         newRow.innerHTML += `
//             <td class="extraCampo" style="display: none;">
//                 <input type="text" class="hospedagem" value="${item.hospedagem || 0}" min="0" step="0.01" oninput="recalcularLinha(this.closest('tr'))">
//             </td>
//         `;

//         // 18. Transporte (Campo extra, oculto por padrão)
//         newRow.innerHTML += `
//             <td class="extraCampo" style="display: none;">
//                 <input type="text" class="transporte" value="${item.transporte || 0}" min="0" step="0.01" oninput="recalcularLinha(this.closest('tr'))">
//             </td>
//         `;

//         // 19. TotGeral (Exibição)
//         newRow.innerHTML += `<td class="totGeral Moeda">${formatarMoeda(item.totgeralitem || 0)}</td>`;

//         // 20. Ação (Botão de excluir com SVG)
//         newRow.innerHTML += `
//             <td>
//                 <div class="Acao">
//                     <button class="deleteBtn" type="button">
//                         <svg class="delete-svgIcon" viewBox="0 0 448 512">
//                             <path d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z"></path>
//                         </svg>
//                     </button>
//                 </div>
//             </td>
//         `;

//         // --- Inicialização de funcionalidades para a nova linha ---

//         // Inicializa Flatpickr para o campo "Periodo" da nova linha
//         const itemDateInput = newRow.querySelector(".Periodo .datas-item");
//         if (itemDateInput) {
//             const defaultDatesArray = [];
//             if (inicioDiarias) {
//                 defaultDatesArray.push(new Date(inicioDiarias)); // Converte para objeto Date
//             }
//             if (fimDiarias) {
//                 defaultDatesArray.push(new Date(fimDiarias));   // Converte para objeto Date
//             }

//             flatpickr(itemDateInput, {
//                 mode: "range",
//                 dateFormat: "d/m/Y",
//                 locale: flatpickr.l10ns.pt,
//                 defaultDate: defaultDatesArray.length > 0 ? defaultDatesArray : [],
//             });
//         }
        
//         // Adiciona event listeners para os botões de incremento/decremento (qtdProduto, qtdDias)
//         // Removendo o listener global e aplicando por linha para consistência e clareza
//         newRow.querySelector('.qtdProduto .increment')?.addEventListener('click', (event) => {
//             const input = event.target.closest("td").querySelector("input.qtdProduto");
//             if (input) {
//                 input.value = parseInt(input.value || 0) + 1;
//                 recalcularLinha(newRow); // Passa a linha atual
//             }
//         });

//         newRow.querySelector('.qtdProduto .decrement')?.addEventListener('click', (event) => {
//             const input = event.target.closest("td").querySelector("input.qtdProduto");
//             if (input) {
//                 const valorAtual = parseInt(input.value || 0);
//                 input.value = Math.max(0, valorAtual - 1);
//                 recalcularLinha(newRow); // Passa a linha atual
//             }
//         });

//         // Adiciona event listener para o botão de excluir com confirmação Swal.fire
//         newRow.querySelector('.deleteBtn').addEventListener('click', async () => { // Adicionado 'async' aqui
//             const { isConfirmed } = await Swal.fire({
//                 title: `Tem Certeza que deseja EXCLUIR o item "${item.produto || 'este item'}" ?`, // Adicionado nome do produto
//                 text: "Você não poderá reverter esta ação!",
//                 icon: "warning",
//                 showCancelButton: true,
//                 confirmButtonColor: "#3085d6",
//                 cancelButtonColor: "#d33",
//                 confirmButtonText: "Sim, deletar!",
//                 cancelButtonText: "Cancelar"
//             });

//             if (isConfirmed) {
//                 newRow.remove();
//                 recalcularTotaisGerais();
//                 Swal.fire(
//                     "Deletado!",
//                     "O item foi removido.",
//                     "success"
//                 );
//             }
//         });
        
//         // Adiciona event listeners para os selects de AjdCusto
//         newRow.querySelectorAll('.tpAjdCusto-alimentacao, .tpAjdCusto-transporte').forEach(select => {
//             select.addEventListener('change', () => {
//                 recalcularLinha(newRow); // Passa a linha atual
//             });
//         });

//         // Adiciona event listeners para inputs de texto/número que precisam de recalculo
//         newRow.querySelectorAll('input.categoria-input, input.produto-input, input.ValorInteiros, input.valorPerCent, input.qtdProduto, input.qtdDias, input.hospedagem, input.transporte').forEach(input => {
//             input.addEventListener('input', () => recalcularLinha(newRow)); // Passa a linha atual
//         });
//     });

//     // Chamada para calcular totais gerais após preencher todos os itens
//     recalcularTotaisGerais(); 
// }


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
function limparFormularioOrcamento() {
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
    // Usa toLocaleString para formatação com vírgula e 2 casas decimais, depois adiciona o '%'
    return `${numero.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
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
window.addEventListener('DOMContentLoaded', () => {
    aplicarDescontoEAcrescimo(); // ✅ Atualiza o valor do cliente assim que a tela carregar

    // Seu listener existente
    document.body.addEventListener('blur', function (e) {
        const input = e.target;

        // Campos por linha
        if (
            input.matches('.desconto .ValorInteiros') ||
            input.matches('.Acrescimo .ValorInteiros') ||
            input.matches('.desconto .valorPerCent') ||
            input.matches('.Acrescimo .valorPerCent')
        ) {
            const linha = input.closest('tr');
            if (linha) {
                recalcularLinha(linha);
            }
        }

        // Campos gerais
        if (
            input.matches('#Desconto') ||
            input.matches('#valorPerCentDesc') ||
            input.matches('#Acrescimo') ||
            input.matches('#valorPerCentAcresc')
        ) {
            aplicarDescontoEAcrescimo();
        }
    }, true);
});
// --------------------------------------- botoes Quantidade-----------------------------------------

if (!window.hasRegisteredClickListener) {
    document.addEventListener('click', function(event) {
    if (event.target.classList.contains('increment')) {
        // console.log('Incrementando...');
        const input = event.target.closest('.add-less').querySelector('input');
        input.value = parseInt(input.value || 0) + 1;
    }

    if (event.target.classList.contains('decrement')) {
        // console.log('Decrementando...');
        const input = event.target.closest('.add-less').querySelector('input');
        let currentValue = parseInt(input.value || 0);
        if (currentValue > 0) {
        input.value = currentValue - 1;
        }
    }
    });
    window.hasRegisteredClickListener = true;
}


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
        console.log("Linha recebida:", linha);

        let qtdItens = parseFloat(linha.querySelector('.qtdProduto input')?.value) || 0;
        let qtdDias = parseFloat(linha.querySelector('.qtdDias input')?.value) || 0;

        let celulaVenda = linha.querySelector('.vlrVenda');

        // Salva o valor original da venda apenas uma vez
        if (celulaVenda && !celulaVenda.dataset.vendaOriginal) {
            celulaVenda.dataset.vendaOriginal = desformatarMoeda(celulaVenda.textContent);
        }

        // Usa o valor original salvo (se houver), senão tenta pegar do texto atual
        let vlrVendaOriginal = parseFloat(celulaVenda?.dataset.vendaOriginal) || desformatarMoeda(celulaVenda?.textContent);
        let vlrVenda = vlrVendaOriginal;

        let vlrCusto = desformatarMoeda(linha.querySelector('.vlrCusto')?.textContent);

        const selectAlimentacao = linha.querySelector('.select-alimentacao');
        const selectTransporte = linha.querySelector('.select-transporte');
        const valorAlimentacaoDiv = linha.querySelector('.valor-alimentacao');
        const valorTransporteDiv = linha.querySelector('.valor-transporte');
   //     const totAjdCustoCell = linha.querySelector('.totAjdCusto'); // Célula do total de Ajuda de Custo da linha

        let totalAlimentacaoLinha = 0;
        let totalTransporteLinha = 0;
  //      let totalAjdCustoLinha = 0;

        // Garante que os valores base existem (podem ser 0 se a função não foi selecionada)
        const baseAlmoco = parseFloat(vlrAlmoco || 0);
        const baseJantar = parseFloat(vlrJantar || 0);
        const baseTransporte = parseFloat(vlrTransporte || 0); // Renomeei para evitar conflito

        console.log(`Bases lidas do dataset: Almoco: ${baseAlmoco}, Jantar: ${baseJantar}, Transporte: ${baseTransporte}`);

        // === Lógica para Alimentação ===
        if (selectAlimentacao && valorAlimentacaoDiv) {
            
            const tipoAlimentacaoSelecionado = selectAlimentacao.value;
            console.log("TIPO SELECIONADO", selectAlimentacao.value);
            if (tipoAlimentacaoSelecionado === 'Almoco') {
                totalAlimentacaoLinha = baseAlmoco;
            } else if (tipoAlimentacaoSelecionado === 'Janta') {
                totalAlimentacaoLinha = baseJantar;
            } else if (tipoAlimentacaoSelecionado === '2alimentacao') {
                totalAlimentacaoLinha = baseAlmoco + baseJantar;
            }
            // Se for 'select' ou algo não mapeado, totalAlimentacaoLinha permanece 0
            valorAlimentacaoDiv.textContent = formatarMoeda(totalAlimentacaoLinha);
            console.log(`Alimentação: Tipo: ${tipoAlimentacaoSelecionado}, Valor Calculado: ${totalAlimentacaoLinha}`);
        }

        // === Lógica para Transporte ===
        if (selectTransporte && valorTransporteDiv) {
            const tipoTransporteSelecionado = selectTransporte.value;
            if (tipoTransporteSelecionado === 'Público' || tipoTransporteSelecionado === 'Alugado' || tipoTransporteSelecionado === 'Próprio') {
                totalTransporteLinha = baseTransporte;
            }
            // Se for 'select' ou algo não mapeado, totalTransporteLinha permanece 0
            valorTransporteDiv.textContent = formatarMoeda(totalTransporteLinha);
            console.log(`Transporte: Tipo: ${tipoTransporteSelecionado}, Valor Calculado: ${totalTransporteLinha}`);
        }
    
        // // === Cálculo do Total de Ajuda de Custo da Linha ===
        let vlrAjdCusto = totalAlimentacaoLinha + totalTransporteLinha;
        
        // Pega os campos de valor e percentual para desconto e acréscimo
        let campoDescValor = linha.querySelector('.desconto .ValorInteiros');
        let campoDescPct = linha.querySelector('.desconto .valorPerCent');

        let campoAcrescValor = linha.querySelector('.Acrescimo .ValorInteiros');
        let campoAcrescPct = linha.querySelector('.Acrescimo .valorPerCent');

        let desconto = desformatarMoeda(campoDescValor?.value) || 0;
        let perCentDesc = parseFloat(campoDescPct?.value) || 0;

        let acrescimo = desformatarMoeda(campoAcrescValor?.value) || 0;
        let perCentAcresc = parseFloat(campoAcrescPct?.value) || 0;

        // Se o percentual de desconto/acréscimo foi preenchido, calcula o valor
        if (perCentDesc > 0) {
            desconto = vlrVenda * (perCentDesc / 100);
            if (campoDescValor) campoDescValor.value = desconto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        } else if (desconto > 0) {
            perCentDesc = (desconto / vlrVenda) * 100;
            if (campoDescPct) campoDescPct.value = perCentDesc.toFixed(2);
        }

        if (perCentAcresc > 0) {
            acrescimo = vlrVenda * (perCentAcresc / 100);
            if (campoAcrescValor) campoAcrescValor.value = acrescimo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        } else if (acrescimo > 0) {
            perCentAcresc = (acrescimo / vlrVenda) * 100;
            if (campoAcrescPct) campoAcrescPct.value = perCentAcresc.toFixed(2);
        }

        // Calcula novo valor de venda com desconto e acréscimo
        let vlrVendaCorrigido = vlrVenda - desconto + acrescimo;       

        let totalIntermediario = qtdItens * qtdDias;
        let totalVenda = totalIntermediario * vlrVendaCorrigido;
        let totalCusto = totalIntermediario * vlrCusto;
        let totalAjdCusto = totalIntermediario * vlrAjdCusto;
        let totGeralCtoItem = totalCusto + totalAjdCusto;

        console.log("Ajuda Custo RECALCULAR LINHA", totalAjdCusto, totalIntermediario, vlrAjdCusto);
        // Atualiza a DOM
        let totalVendaCell = linha.querySelector('.totVdaDiaria');
        if (totalVendaCell) {
            totalVendaCell.textContent = totalVenda.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        }

        if (celulaVenda) {
            celulaVenda.textContent = vlrVendaCorrigido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        }

        let totalCustoCell = linha.querySelector('.totCtoDiaria');
        if (totalCustoCell) {
            totalCustoCell.textContent = totalCusto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        }

        let totalAjdCustoCell = linha.querySelector('.totAjdCusto');
        if (totalAjdCustoCell) {
            totalAjdCustoCell.textContent = totalAjdCusto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        }

        let totalGeralCtoCell = linha.querySelector('.totGeral');
        if (totalGeralCtoCell) {
            totalGeralCtoCell.textContent = totGeralCtoItem.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        }

        // Totais gerais
        let totalCustoGeral = 0;
        let totalVendaGeral = 0;
        let totalAjdCustoGeral = 0;
        let totalGeralCustoItem = 0;

        document.querySelectorAll('.totCtoDiaria').forEach(cell => {
            totalCustoGeral += desformatarMoeda(cell.textContent);
        });

        document.querySelectorAll('.totVdaDiaria').forEach(cell => {
            totalVendaGeral += desformatarMoeda(cell.textContent);
        });

        document.querySelectorAll('.totAjdCusto').forEach(cell => {
            totalAjdCustoGeral += desformatarMoeda(cell.textContent);
        });

        document.querySelectorAll('.totGeral').forEach(cell => {
            totalGeralCustoItem += desformatarMoeda(cell.textContent);
        });

        let inputTotalCusto = document.querySelector('#totalGeralCto');
        if (inputTotalCusto) {
            inputTotalCusto.value = totalCustoGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        }

        let inputTotalVenda = document.querySelector('#totalGeralVda');
        if (inputTotalVenda) {
            inputTotalVenda.value = totalVendaGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        }

        let inputTotalAjdCusto = document.querySelector('#totalAjdCusto');
        if (inputTotalAjdCusto) {
            inputTotalAjdCusto.value = totalAjdCustoGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        }

        let inputTotalGeralCtoItem = document.querySelector('#totalGeral');
        if (inputTotalGeralCtoItem) {
            inputTotalGeralCtoItem.value = totalGeralCustoItem.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        }

        console.log("Calculo desc e Acresc:", vlrVendaOriginal, "-", desconto, "+", acrescimo);
        console.log("valor c/ desc e Acresc:", vlrVendaCorrigido);
        console.log("Total Geral de Custo:", totalCustoGeral.toFixed(2));
        console.log("Total Geral de Venda:", totalVendaGeral.toFixed(2));
        console.log("Total Geral de AjdCusto:", totalAjdCustoGeral.toFixed(2));
        console.log("Total Geral de Custo Item:", totalGeralCustoItem.toFixed(2));

        aplicarMascaraMoeda();
        aplicarDescontoEAcrescimo();///AQUI??
        calcularLucro();
        recalcularTotaisGerais();

    } catch (error) {
        console.error("Erro no recalcularLinha:", error);
    }
}

// function aplicarMascaraMoeda() {
//     // Formatar valores de <td> com a classe .Moeda
//     document.querySelectorAll('td.Moeda').forEach(td => {
//         let valor = parseFloat(td.textContent);
//         console.log("valor1", valor);
//         if (!isNaN(valor)) {
//             td.textContent = valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
//         }
//     });

//     // Formatar inputs somente se forem readonly (apenas visual)
//     document.querySelectorAll('input.Moeda[readonly]').forEach(input => {
//         let valor = parseFloat(input.value);
//         console.log("valor2", valor)
//         if (!isNaN(valor)) {
//             input.dataset.valorOriginal = input.value; // guarda o valor real
//             input.value = valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
//         }
//     });

    
// }

function aplicarMascaraMoeda() {
    console.log("DEBUG: aplicarMascaraMoeda foi chamada.");

    // --- Parte 1: Formatar valores de <td> com a classe .Moeda (para exibição) ---
    // Isto formata células como 'vlrVenda', 'totVdaDiaria', 'vlrCusto', etc.
    document.querySelectorAll('td.Moeda').forEach(td => {
        // Exclui TDs que contêm inputs editáveis (porque esses terão IMask)
        // E também exclui as TDs que contêm os spans de valorbanco, pois estes já vêm formatados
        // ou serão atualizados dinamicamente pelo select.
        if (!td.querySelector('input') && !td.classList.contains('ajdCusto')) { 
            let valorTexto = td.textContent;
            let valorNumerico = desformatarMoeda(valorTexto);

            if (!isNaN(valorNumerico)) {
                td.textContent = valorNumerico.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            }
        }
    });

    // --- Parte 2: Aplicar IMask a inputs editáveis específicos ---
    // Isso deve pegar todos os inputs que o usuário pode digitar valores monetários ou percentuais.
    document.querySelectorAll('input.ValorInteiros, input.hospedagem, input.transporte').forEach(input => {
        if (!input.mask) { 
            const initialValue = desformatarMoeda(input.value);
            
            input.mask = IMask(input, {
                mask: Number,
                blocks: {
                    num: {
                        mask: Number,
                        signed: false,
                        thousandsSeparator: '.',
                        padFractionalZeros: true,
                        normalizeZeros: true,
                        radix: ',', 
                        scale: 2, 
                        max: 99999999999.99 
                    }
                }
            });
            if (!isNaN(initialValue)) {
                input.mask.value = initialValue.toString().replace('.', ',');
            }
        }
    });

    document.querySelectorAll('input.valorPerCent').forEach(input => {
        if (!input.mask) {
            const initialValue = desformatarMoeda(input.value.replace('%', ''));
            
            input.mask = IMask(input, {
                mask: Number,
                scale: 2,
                signed: false,
                thousandsSeparator: '',
                padFractionalZeros: true,
                normalizeZeros: true,
                radix: ',',
                suffix: '%' 
            });
            if (!isNaN(initialValue)) {
                input.mask.value = initialValue.toString().replace('.', ',');
            }
        }
    });

    // --- Parte 3: REMOVER A FORMATAÇÃO MONETÁRIA DE QUALQUER INPUT READONLY QUE NÃO SEJA MONETÁRIO ---
    // Se a intenção é que 'qtdDias' seja apenas um número de dias, ele não precisa de toLocaleString('currency').
    // Se você tiver outros inputs readonly que DEVEM ser formatados como moeda (o que é raro), você os adicionaria aqui.
    // Pelo seu HTML, 'qtdDias' é um campo de quantidade de dias.
    // Então, esta seção não é mais necessária para QUASE NENHUM input readonly.
    // Se você realmente tiver um input readonly que exiba moeda e não seja um td, você precisaria de um seletor específico para ele.

    // Exemplo: Se você tivesse um input readonly chamado <input class="valorTotalFinalReadonly" readonly>
    /*
    document.querySelectorAll('input.valorTotalFinalReadonly[readonly]').forEach(input => {
        let valor = parseFloat(input.value);
        if (!isNaN(valor)) {
            input.dataset.valorOriginal = input.value;
            input.value = valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        }
    });
    */
}

// Caso precise reverter a formatação (ex: para enviar ao backend)
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
    gerarPropostaPDF();
});



async function gerarPropostaPDF() {
    console.log("Início da função gerarPropostaPDF");

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
        const margemRodape = 40;
        const limiteInferior = pageHeight - margemRodape;
        const lineHeight = 7;
        const x = 25;
        const tituloFontSize = 15;
        const textoFontSize = 10;

        let y = 50;

        function adicionarLinha(texto, fontSize = textoFontSize, bold = false) {
            if (y + lineHeight > limiteInferior) {
                doc.addPage();
                doc.addImage(img, 'PNG', 0, 0, pageWidth, pageHeight);
                y = 50;
            }
            doc.setFontSize(fontSize);
            doc.setFont('helvetica', bold ? 'bold' : 'normal');
            const textWidth = doc.getTextWidth(texto);
            const centroX = (pageWidth - textWidth) / 2;
            doc.text(texto, centroX, y);
            y += lineHeight;
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
        const inputRealizacao = document.querySelector('.realizacao')?.value?.trim().replace(" to ", " até ") ||  "N/D" ; 

        let dadosContato = { nmcontato: "N/D", celcontato: "N/D", emailcontato: "N/D" };
        try {
            console.log("Buscando dados do cliente via API");
            const resposta = await fetch(`clientes?nmFantasia=${encodeURIComponent(nomeCliente)}`);
            const dados = await resposta.json();
            const cliente = Array.isArray(dados) ? dados[0] : dados;
            if (cliente) {
                dadosContato = {
                    nmcontato: cliente.nmcontato || "N/D",
                    celcontato: cliente.celcontato || "N/D",
                    emailcontato: cliente.emailcontato || "N/D"
                };
            }
        } catch (erro) {
            console.warn("Erro ao buscar dados do cliente:", erro);
        }

        doc.setFontSize(tituloFontSize);
        doc.text("Proposta de Serviços", x, y);
        y += 20;

        adicionarLinha(`Cliente: ${nomeCliente}`);
        adicionarLinha(`Responsável: ${dadosContato.nmcontato} - Celular: ${dadosContato.celcontato} - Email: ${dadosContato.emailcontato}`);
        adicionarLinha(`Evento: ${nomeEvento} - Local: ${localEvento}`);
        adicionarLinha(`Data de Realização: ${inputRealizacao}`); console.log( "valor data", inputRealizacao)
        y += 10;

        doc.setFontSize(tituloFontSize);
        adicionarLinha("Escopo da proposta:");
        y += 5;

        const tabela = document.getElementById('tabela');
        const linhas = tabela?.querySelectorAll('tbody tr') || [];
         const categoriasMap = {};
        const adicionais = [];

        linhas.forEach(linha => {
            const checkbox = linha.querySelector('.Proposta input');
            if (!checkbox || !checkbox.checked) return;

            const qtdItens = linha.querySelector('.qtdProduto input')?.value?.trim();
            const produto = linha.querySelector('.produto')?.innerText?.trim();
            const qtdDias = linha.querySelector('.qtdDias input')?.value?.trim();
            const categoria = linha.querySelector('.Categoria')?.innerText?.trim();

            const datasRaw = linha.querySelector('.datas')?.value?.trim().replace(" to ", " até: ") || "";
            // const [dataInicioProdutoRaw, dataFimProdutoRaw] = datasRaw.split(" a ") || ["", ""];

            console.log(" datas",  datasRaw);

            const itemDescricao = `• ${produto} — ${qtdItens} Item(s), ${qtdDias} Diária(s), de: ${datasRaw} `;
            const isLinhaAdicional = linha.classList.contains('linha-adicional');

            if (qtdItens !== '0' && qtdDias !== '0') {
                if (isLinhaAdicional) {
                    adicionais.push(itemDescricao);
                } else {
                    const nomeCategoria = categoria || "Outros";
                    if (!categoriasMap[nomeCategoria]) categoriasMap[nomeCategoria] = [];
                    categoriasMap[nomeCategoria].push(itemDescricao);
                }
            }
        });

        // Primeiro, itens agrupados por categoria
        for (const [categoria, itens] of Object.entries(categoriasMap)) {
            adicionarLinha(categoria + ":", 12, true);
            itens.forEach(item => adicionarLinha(item));
            y += 5;
        }

        // Depois, itens adicionais
        if (adicionais.length > 0) {
            y += 10;
            adicionarLinha("Adicionais:", 12, true);
            adicionais.forEach(item => adicionarLinha(item));
        }

        // Observações sobre os Itens
        const checkboxItens = document.querySelectorAll('.Propostaobs1 .checkbox__trigger')[0];
        const textoItens = document.querySelectorAll('.PropostaobsTexto')[0]?.value?.trim();

        if (checkboxItens && checkboxItens.checked && textoItens) {
            y += 10;
            adicionarLinha("Observações sobre os Itens:", 12, true);

            const linhasItens = doc.splitTextToSize(textoItens, 180);
            linhasItens.forEach(linha => {
                adicionarLinha(linha);
                y += 5;
            });
        }

        // Observações sobre a Proposta
        const propostaObs2 = document.querySelector('.Propostaobs2');
        const checkboxProposta = propostaObs2?.querySelector('.checkbox__trigger');
        const textoProposta = propostaObs2?.querySelector('.PropostaobsTexto')?.value?.trim();

        if (checkboxProposta?.checked && textoProposta) {
            y += 10;
            adicionarLinha("Observações sobre a Proposta:", 12, true);

            const linhasProposta = doc.splitTextToSize(textoProposta, 180);
            linhasProposta.forEach(linha => {
                adicionarLinha(linha);
                y += 5;
            });
        }

        doc.addPage();
        doc.addImage(img, 'PNG', 0, 0, pageWidth, pageHeight);
        y = 40;

        adicionarLinha("SUPORTE TÉCNICO", textoFontSize, true);
        doc.splitTextToSize("Caso seja necessário suporte técnico para as impressoras, a diária adicional é de R$ XX.", pageWidth - 2 * x)
            .forEach(linha => adicionarLinha(linha));
        y += 10;

        adicionarLinha("INVESTIMENTO", textoFontSize, true);
        doc.splitTextToSize("O valor para a execução desta proposta é de R$ XX  Incluso no valor todos os custos referentes honorários de funcionários e prestadores de serviços, impostos fiscais devidos que deverão ser recolhidos pela JA Promoções e Eventos, arcando inclusive com as eventuais sanções legais oriundas do não cumprimento dessas obrigações.", pageWidth - 2 * x)
            .forEach(linha => adicionarLinha(linha));
        y += 10;

        adicionarLinha("FORMA DE PAGAMENTO", textoFontSize, true);
        doc.splitTextToSize("Condições de pagamento a serem definidas...", pageWidth - 2 * x)
            .forEach(linha => adicionarLinha(linha));
        y += 15;

        doc.setFontSize(10);
        adicionarLinha("*Prazos de pagamento sujeitos a alteração conforme necessidade e acordo. ");

        const dataAtual = new Date();
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

    //     console.log("Enviando PDF para o backend");

    //     const nomeArquivo = `${nomeEvento.replace(/[^\w\s]/gi, '').replace(/\s+/g, '_')}_${dataFormatada}.pdf`;

    //     const formData = new FormData();
    //     formData.append('arquivo', pdfBlob, nomeArquivo);
    //     formData.append('cliente', nomeCliente);
    //     formData.append('evento', nomeEvento);

    //     fetch("http://localhost:3000/enviar-pdf", {
    //         method: "POST",
    //         body: formData
    //     })
    //     .then(res => res.json())
    //     .then(data => console.log("Resposta do servidor:", data))
    //     .catch(err => console.error("Erro ao enviar PDF:", err));
    // };


    img.src = 'img/Fundo Propostas.png';
}

function exportarParaExcel() {
  const linhas = document.querySelectorAll("#tabela tbody tr");
  const dados = [];

  // Cabeçalhos
  const cabecalhos = [
    "P/ Proposta", "Categoria", "Qtd Itens", "Produto", "Qtd Dias", "Período das diárias",
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
    linha.push(tr.querySelector(".qtdDias input")?.value || "0");
    linha.push(tr.querySelector(".datas")?.value || "");

    const descontoValor = tr.querySelector(".desconto .ValorInteiros")?.value || "R$ 0,00";
    const descontoPerc = tr.querySelector(".desconto .valorPerCent")?.value || "0%";
    linha.push(`${descontoValor} (${descontoPerc})`);

    const acrescValor = tr.querySelector(".Acrescimo .ValorInteiros")?.value || "R$ 0,00";
    const acrescPerc = tr.querySelector(".Acrescimo .valorPerCent")?.value || "0%";
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
    linha.push(tr.querySelector("input.transporte")?.value || "");
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

async function salvarOrcamento(event) {
    event.preventDefault(); // evita o envio padrão do formulário

    const form = document.getElementById("form");
    const formData = new FormData(form);

    // Você pode adicionar campos adicionais se forem calculados dinamicamente
    // Por exemplo, valores da tabela ou campos que não estão no <form>

    const dados = {};
    formData.forEach((value, key) => {
        dados[key] = value;
    });

    // Exemplo de como capturar itens da tabela (ajuste conforme sua lógica)
    const itens = [];
    const linhas = document.querySelectorAll("#tabela tbody tr");
    linhas.forEach((linha) => {
        const item = {
            categoria: linha.querySelector(".Categoria")?.textContent.trim(),
            qtdProduto: linha.querySelector(".qtdProduto input")?.value,
            produto: linha.querySelector(".produto")?.textContent.trim(),
            qtdDias: linha.querySelector(".qtdDias input")?.value,
            vlrVenda: linha.querySelector(".vlrVenda")?.textContent.trim(),
            totVdaDiaria: linha.querySelector(".totVdaDiaria")?.textContent.trim(),
            vlrCusto: linha.querySelector(".vlrCusto")?.textContent.trim(),
            totCtoDiaria: linha.querySelector(".totCtoDiaria")?.textContent.trim(),
            ajdCusto: linha.querySelector(".ajdCusto")?.textContent.trim(),
            totAjdCusto: linha.querySelector(".totAjdCusto")?.textContent.trim(),
            hospedagem: linha.querySelector(".hospedagem")?.value || "0",
            transporte: linha.querySelector(".transporte")?.value || "0",
            totGeral: linha.querySelector(".totGeral")?.textContent.trim()
        };
        itens.push(item);
    });

    // Inclui os itens no objeto principal
    dados.itens = itens;

    console.log("DADOS ITENS", dados.itens);

    try {
        const resposta = await fetchComToken(form.getAttribute('data-action'), {
            method: 'POST',
            // headers: {
            //     'Content-Type': 'application/json',
            //     'Authorization': `Bearer ${token}`
            //     // 'x-id-empresa': idEmpresa
            // },
            body: JSON.stringify(dados)
        });

        if (resposta.ok) {
            const resultado = await resposta.json();
            Swal.fire("Sucesso", "Orçamento salvo com sucesso!", "success");
        } else {
            const erro = await resposta.text();
            Swal.fire("Erro", "Falha ao salvar orçamento: " + erro, "error");
        }
    } catch (err) {
        console.error(err);
        Swal.fire("Erro", "Erro inesperado ao salvar orçamento.", "error");
    }
}

function configurarEventosOrcamento() {
    console.log("Configurando eventos Orcamento...");
    verificaOrcamento(); // Carrega os Orcamentos ao abrir o modal
   // adicionarEventoBlurOrcamento();
   inicializarFlatpickrsGlobais(); // Inicializa os Flatpickrs globais

    console.log("Entrou configurar Orcamento no ORCAMENTO.js.");
} 

window.configurarEventosOrcamento = configurarEventosOrcamento;

function configurarEventosEspecificos(modulo) {
  console.log("⚙️ configurarEventosEspecificos recebeu:", modulo);
  
  if (modulo.trim().toLowerCase() === 'orcamentos') {
    
    configurarEventosOrcamento();
    //inicializarFlatpickrsGlobais(); 

    // if (typeof inicializarFlatpickrsGlobais === 'function') {
    //         inicializarFlatpickrsGlobais();
    //         console.log("Flatpickrs globais inicializados para o módulo Orcamentos.");
    // } else {
    //         console.warn("⚠️ Função 'inicializarFlatpickrsGlobais' não encontrada. Verifique a ordem de carregamento dos scripts.");
    // }

    if (typeof aplicarPermissoes === "function" && window.permissoes) {
      aplicarPermissoes(window.permissoes);
    } else {
      console.warn("⚠️ aplicarPermissoes ou window.permissoes ainda não estão disponíveis.");
    }
  
  }
}
window.configurarEventosEspecificos = configurarEventosEspecificos;
