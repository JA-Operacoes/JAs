document.addEventListener("DOMContentLoaded", function () {
    // console.log("Script orcamento.js carregado.");

    let selects = document.querySelectorAll(".idFuncao, .idEquipamento, .idSuprimento");
    selects.forEach(select => {
        select.addEventListener("change", atualizaProdutoOrc);
    });

});

let idCliente;
let idEvento;
let idLocalMontagem;


function carregarClientesOrc() {
    // console.log("Função carregar Cliente chamada");

    fetch('http://localhost:3000/clientes')
        .then(response => response.json())
        .then(clientes => {
            // console.log('Clientes recebidos:', clientes);

            let selects = document.querySelectorAll(".idCliente");

            selects.forEach(select => {
                const nomeSelecionado = select.value;
                select.innerHTML = '<option value="">Selecione Cliente</option>';

                clientes.forEach(cliente => {
                    let option = document.createElement("option");
                    option.value = cliente.nmfantasia;
                    option.textContent = cliente.nmfantasia;
                    option.setAttribute("data-idCliente", cliente.idcliente);
                    select.appendChild(option);
                });

                // Evento de seleção de cliente
                select.addEventListener('change', function () {
                    const nomeFantasia = this.value;
                    const selectedOption = select.options[select.selectedIndex];
                    idCliente = selectedOption.getAttribute("data-idCliente");
                    // console.log("idCliente", idCliente);
                    if (nomeFantasia) {
                        buscarEExibirDadosClientePorNome(nomeFantasia);
                    }
                });

                if (nomeSelecionado) {
                    buscarEExibirDadosClientePorNome(nomeSelecionado);
                }
            });
        })
        .catch(error => {
            console.error("Erro ao carregar clientes:", error);
        });
}

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
        const response = await fetch(`http://localhost:3000/clientes?nmFantasia=${encodeURIComponent(nmFantasia)}`);

        if (!response.ok) {
            throw new Error(`Erro ao buscar dados do cliente: ${response.status}`);
        }

        const dadosCliente = await response.json();

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

// Carregar ao iniciar
document.addEventListener("DOMContentLoaded", carregarClientesOrc);

function carregarEventosOrc() {
    
    // console.log("Função carregar Eventos chamada");

    fetch('http://localhost:3000/eventos')
    .then(response => response.json())
    .then(eventos => {
        // console.log('Eventos recebidos:', eventos);
        
        let selects = document.querySelectorAll(".idEvento");
        
        selects.forEach(select => {
            
            // console.log("dentro do SELECT EVENTOS",eventos);
            
            select.innerHTML = '<option value="">Selecione Evento</option>'; // Adiciona a opção padrão
            eventos.forEach(evento => {
                let option = document.createElement("option");
                
                // console.log('Eventos recebidos 2:', eventos);
              
                option.value = evento.idevento;  // Atenção ao nome da propriedade (idMontagem)
                option.textContent = evento.nmevento; 
                option.setAttribute("data-nmevento", evento.nmevento);
                option.setAttribute("data-idEvento", evento.idevento);
                select.appendChild(option);

            });

            select.addEventListener('change', function () {
                const selectedOption = select.options[select.selectedIndex];   
                idEvento = selectedOption.getAttribute("data-idEvento");
                // console.log("IDEVENTO",idEvento);
                    
            });
            
        });
    
    })

     // Chama a função para atualizar o campo UF após carregar os locais de montagem
    .catch(error => console.error('Erro ao carregar Local Montagem:', error));
}
let Categoria = "";

// Função para carregar os Funcao
function carregarFuncaoOrc() {
    // console.log("Função carregarFuncao chamada ORCAMENTO.js");

    fetch('http://localhost:3000/funcao')
        .then(response => response.json())
        .then(funcao => {
            // console.log('Funcao recebidos 1:', funcao); // Log das Funções recebidas

            let selects = document.querySelectorAll(".idFuncao");
            selects.forEach(select => {
                select.innerHTML = "";

                // console.log('Funcao recebidos 2:', funcao); // Log das Funções recebidas
                let opcaoPadrao = document.createElement("option");
                opcaoPadrao.setAttribute("value", "");
                opcaoPadrao.textContent = "Selecione Função";
                select.appendChild(opcaoPadrao);

                funcao.forEach(funcao => {
                    let option = document.createElement("option");
                    option.value = funcao.idfuncao;
                    option.textContent = funcao.descfuncao;
                    option.setAttribute("data-descproduto", funcao.descfuncao);
                    option.setAttribute("data-cto", funcao.ctofuncao);
                    option.setAttribute("data-vda", funcao.vdafuncao);
                    option.setAttribute("data-ajdcusto", funcao.ajcfuncao);
                    option.setAttribute("data-categoria", "Produto(s)");
                    select.appendChild(option);
                });

                
                    select.addEventListener("change", function (event) {
                        const selectedOption = select.options[select.selectedIndex];
                        
                        Categoria = selectedOption.getAttribute("data-categoria") || "N/D";
                        atualizaProdutoOrc(event);
                    });
                Categoria = "Produto(s)"; // define padrão ao carregar
            });
        })
        .catch(error => console.error('Erro ao carregar Funcao:', error));
}

// Função para carregar os equipamentos
function carregarEquipamentosOrc() {

    // console.log("Função carregarEquipamentos chamada");
    fetch('http://localhost:3000/equipamentos')
        .then(response => response.json())
        .then(equipamentos => {
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
        })
        .catch(error => console.error('Erro ao carregar Funcao:', error));
}

// Função para carregar os suprimentos
function carregarSuprimentosOrc() {
    // console.log("Função carregarSuprimentos chamada");
    fetch('http://localhost:3000/suprimentos')
        .then(response => response.json())
        .then(suprimentos => {
            let selects = document.querySelectorAll(".idSuprimento");
            // console.log('Suprimentos recebidos:', suprimentos); // Log dos suprimentos recebidos
            // console.log('Selects Suprimento',selects);
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
        })
        .catch(error => console.error('Erro ao carregar Funcao:', error));
}

// Função para carregar os locais de montagem
function carregarLocalMontOrc() {
    
    // console.log("Função carregar LocalMontagem chamada");
    fetch('http://localhost:3000/localmontagem')
    .then(response => response.json())
    .then(montagem => {
        // console.log('Local Montagem recebidos:', montagem);
        
        let selects = document.querySelectorAll(".idMontagem");
        
        selects.forEach(select => {
           
            // Adiciona as opções de Local de Montagem
            select.innerHTML = '<option value="">Selecione Local de Montagem</option>'; // Adiciona a opção padrão
            montagem.forEach(local => {
                let option = document.createElement("option");

                option.value = local.idmontagem;  // Atenção ao nome da propriedade (idMontagem)
                option.textContent = local.descmontagem; 
                option.setAttribute("data-idlocalmontagem", local.idlocalmontagem); 
                option.setAttribute("data-descmontagem", local.descmontagem);
                option.setAttribute("data-ufmontagem", local.ufmontagem); 
                select.appendChild(option);

               // console.log("Select atualizado:", select.innerHTML);

                locaisDeMontagem = montagem;

            });
            select.addEventListener("change", function (event) {
                const selectedOption = select.options[select.selectedIndex];
                idLocalMontagem = selectedOption.getAttribute("data-idlocalmontagem") || "N/D";
                // console.log("IDLOCALMONTAGEM", idLocalMontagem);
                
            });
            
        });
    
    })

     // Chama a função para atualizar o campo UF após carregar os locais de montagem
    .catch(error => console.error('Erro ao carregar Local Montagem:', error));
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
                qtdPessoas: linha.cells[0].textContent.trim(),
                qtdDias: linha.cells[1].textContent.trim(),
                valor: linha.cells[2].textContent.trim(),
                total: linha.cells[3].textContent.trim()
            };
            orcamento.Pessoas.push(dados);
        }

        fetch('/salvar-orcamento', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orcamento)
        })
        .then(response => response.json())
        .then(data => {
            alert("Orçamento salvo com sucesso!");
            fecharModal();
        })
        .catch(error => console.error("Erro ao salvar:", error));
    });
    
}




if (!window.hasRegisteredClickListener) {
    document.addEventListener('click', function(event) {
        if (event.target.classList.contains('increment') || event.target.classList.contains('decrement')) {
            const input = event.target.closest('.add-less').querySelector('input');
            let currentValue = parseInt(input.value || 0);

            if (event.target.classList.contains('increment')) {
                // console.log('Incrementando...');
                input.value = currentValue + 1;
            } else if (event.target.classList.contains('decrement')) {
                // console.log('Decrementando...');
                if (currentValue > 0) {
                    input.value = currentValue - 1;
                }
            }

            // Depois de mudar o valor, recalcula o total da linha
            recalcularLinha(input.closest('tr'));
        }
    });

    window.hasRegisteredClickListener = true;
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

function formatarMoeda(valor) {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function recalcularLinha(linha) {
    if (!linha) return;

    try {
        console.log("Linha recebida:", linha);

        let qtdItens = parseFloat(linha.querySelector('.qtdPessoas input')?.value) || 0;
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
        let vlrAjdCusto = desformatarMoeda(linha.querySelector('.ajdCusto')?.textContent);

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

        let inputTotalAjdCusto = document.querySelector('#totalajdCusto');
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
        // aplicarDescontoEAcrescimo();
        calcularLucro();
        recalcularTotaisGerais();

    } catch (error) {
        console.error("Erro no recalcularLinha:", error);
    }
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

    let inputPorcentagemLucro = document.querySelector('#perCent');
    if (inputPorcentagemLucro) {
        inputPorcentagemLucro.value = porcentagemLucro.toFixed(2) + '%';
    }
}

function calcularLucroReal() {
    let totalCustoGeral = 0;
    let valorFinalCliente = 0;

    // Obtém o valor do custo total
    totalCustoGeral = desformatarMoeda(document.querySelector('#totalGeral').value);

    // Obtém o valor final ao cliente (já com desconto ou acréscimo)
    valorFinalCliente = desformatarMoeda(document.querySelector('#valorCliente').value);

    // Calcula o lucro real (valor final recebido - custo total)
    let lucroReal = valorFinalCliente - totalCustoGeral;

    let porcentagemLucroReal = 0;
    if (valorFinalCliente > 0) {
        porcentagemLucroReal = (lucroReal / valorFinalCliente) * 100;
    }

    // Exibe o lucro no console
    console.log('Lucro Real calculado:', lucroReal);
    console.log('Porcentagem de Lucro Real:', porcentagemLucroReal.toFixed(2) + '%');

    // Atualiza o campo de lucro com a formatação de moeda
    let inputLucro = document.querySelector('#LucroReal');
    if (inputLucro) {
        inputLucro.value = formatarMoeda(lucroReal); // Corrigido aqui
    }

    let inputPorcentagemLucro = document.querySelector('#perCentReal');
    if (inputPorcentagemLucro) {
        inputPorcentagemLucro.value = porcentagemLucroReal.toFixed(2) + '%'; // Corrigido aqui
    }

}

function aplicarDescontoEAcrescimo(input = null) {
    const campoTotalVenda = document.querySelector('#totalGeralVda');
    const campoDesconto = document.querySelector('#Desconto');
    const campoPerCentDesc = document.querySelector('#perCentDesc');
    const campoAcrescimo = document.querySelector('#Acrescimo');
    const campoPerCentAcresc = document.querySelector('#perCentAcresc');
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


// Exemplo de função para remover a linha
function removerLinha(linha) {
    // Remove a linha da DOM
    linha.remove();

    // Recalcular os totais após a remoção
    
    recalcularTotaisGerais();
    aplicarDescontoEAcrescimo();
    aplicarMascaraMoeda()
    calcularLucro()
    calcularLucroReal()
}


function adicionarLinhaOrc() {
    let tabela = document.getElementById("tabela").getElementsByTagName("tbody")[0];

    let novaLinha = tabela.insertRow();
    novaLinha.innerHTML = `
            <td class="Proposta"> <input type="checkbox" name="" id=""> </td>
            <td class="Categoria"></td>
            <td class="qtdPessoas"><div class="add-less"><input type="number" class="qtdPessoas" min="0" value="0" oninput="calcularTotalOrc()"><div class="Bt"><button class="increment">+</button><button class="decrement">-</button></div></div></td>
            <td class="produto"></td>
            <td class="qtdDias"><div class="add-less"><input type="number" class="qtdDias" min="0" value="0" oninput="calcularTotalOrc()"><div class="Bt"><button class="increment">+</button><button class="decrement">-</button></div></div></td>
            <td class="vlrVenda Moeda"></td>
            <td class="desconto Moeda"><div class="Acres-Desc"><input type="text" class="ValorInteiros" value="R$ 0,00" id=""><input type="text" class="valorPerCent" value="0%" id=""></div></td>
            <td class="Acrescimo Moeda"><div class="Acres-Desc"><input type="text" class="ValorInteiros" value="R$ 0,00" id=""><input type="text" class="valorPerCent" value="0%" id=""></div></td>
            <td class="totVdaDiaria Moeda"></td>
            <td class="vlrCusto Moeda"></td>
            <td class="totCtoDiaria Moeda"></td>
            <td class="ajdCusto Moeda"></td>
            <td class="totAjdCusto Moeda">0</td>
            <td class="extraCampo" style="display: none;">
                <input type="text" class="hospedagem" min="0" step="0.01" oninput="calcularTotaisOrc()">
            </td>
            <td class="extraCampo" style="display: none;">
                <input type="text" class="transporte" min="0" step="0.01" oninput="calcularTotaisOrc()">
            </td>
            <td class="totGeral">0</td>
            <td><div class="Acao"><button class="deleteBtn" onclick="removerLinhaOrc(this)"><svg class="delete-svgIcon" viewBox="0 0 448 512"> <path d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z"></path></svg></button></div></td>
`;
}

function removerLinhaOrc(botao) {
    let linha = botao.closest("tr"); // Encontra a linha mais próxima
    removerLinha(linha); // Remove a linha
}

//formulario de 
function atualizarUFOrc(selectLocalMontagem) {
    //  console.log("Função atualizarUF chamada");
    // console.log("Lista atual de locais antes da busca:", locaisDeMontagem);

    let selectedOption = selectLocalMontagem.options[selectLocalMontagem.selectedIndex]; // Obtém a opção selecionada
    let uf = selectedOption.getAttribute("data-ufmontagem"); // Obtém a UF
    let idLocal = selectLocalMontagem.value; 

    // console.log("UF selecionada do atualizarUF:", uf); // Verifica se o valor está correto

    const ufSelecionada = uf.trim(); // Obtém o valor da UF selecionada
    
    let inputUF = document.getElementById("ufmontagem"); 

    if (inputUF) {
        
        inputUF.value = uf;//uf; // Atualiza o campo de input
       
        
    } else {
        console.error("Campo 'ufmontagem' não encontrado!");
    }

    //verificarUF(ufSelecionada);

    const colunasExtras = document.querySelectorAll(".extraColuna"); // Colunas do cabeçalho
    const camposExtras = document.querySelectorAll(".extraCampo"); // Campos na tabela
    
    
    if (ufSelecionada !== "SP") {
        // console.log("UF diferente de SP, exibindo campos extras.");
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
    let vlrAjdCusto = selectedOption.getAttribute("data-ajdCusto");

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

        let celulaVlrCusto = ultimaLinha.querySelector(".vlrCusto");
        if (celulaVlrCusto) celulaVlrCusto.textContent = vlrCusto;
        console.log(" valor de Custo é:", vlrCusto);

        let celulaVlrVenda = ultimaLinha.querySelector(".vlrVenda");
        if (celulaVlrVenda) celulaVlrVenda.textContent = vlrVenda;
        console.log(" valor de Venda é:", vlrVenda);

        let celulaAjdCusto = ultimaLinha.querySelector(".ajdCusto");
        if (celulaAjdCusto) celulaAjdCusto.textContent = vlrAjdCusto;
        console.log(" valor de AjdCusto é:", vlrAjdCusto);
    }
    recalcularLinha(ultimaLinha); //marcia
    
    
}

function resetarOutrosSelectsOrc(select) {
    const selects = document.querySelectorAll('.idFuncao, .idEquipamento, .idSuprimento');

    selects.forEach(outroSelect => {
        if (outroSelect !== select) {
            outroSelect.selectedIndex = 0;
        }
    });

    // Aqui você pode atualizar campos da tabela se quiser, por exemplo:
    // document.querySelector('.produto').textContent = ...
}

// Função para configurar eventos no modal de orçamento
function configurarEventosOrcamento() {

    // console.log("Função configurarEventosOrcamento CHAMADA");
    carregarFuncaoOrc();
    carregarEventosOrc();
    carregarClientesOrc();
    carregarLocalMontOrc();
    carregarEquipamentosOrc();
    carregarSuprimentosOrc();
    configurarFormularioOrc();

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

    const btnSalvar = document.getElementById('btnSalvar');
    btnSalvar.addEventListener("click", async function (event) {
        event.preventDefault(); // Previne o envio padrão do formulário
        console.log("Entrou no botão OK");

        const form = document.getElementById("form");
        const formData = new FormData(form);

        console.log("formData BTNSALVAR", formData);

        console.log("idEvento BTNSALVAR", document.querySelector(".idEvento option:checked")?.getAttribute("data-idEvento"));
        console.log("idlocalmontagem BTNSALVAR", document.querySelector(".idlocalmontagem option:checked")?.getAttribute("data-idLocalMontagem"));

        const dadosOrcamento = {
            idStatus: formData.get("Status"),
            idCliente: document.querySelector(".idCliente option:checked")?.getAttribute("data-idCliente"),
            idEvento: document.querySelector(".idEvento option:checked")?.getAttribute("data-idEvento"),
            idLocalMontagem: document.querySelector(".idLocalMontagem option:checked")?.getAttribute("data-idlocalmontagem"),
            dtIniMarcacao: formData.get("dtIniMarcacao"),
            dtFimMarcacao: formData.get("dtFimMarcacao"),
            dtIniMontagem: formData.get("dtInicioMontagem"),
            dtFimMontagem: formData.get("dtFimMontagem"),
            dtIniRealizacao: formData.get("dtInicioRealizacao"),
            dtFimRealizacao: formData.get("dtFimRealizacao"),
            dtIniDesmontagem: formData.get("dtIniDesmontagem"),
            dtFimDesmontagem: formData.get("dtFimDesmontagem"),
            totGeralVda: desformatarMoeda(document.querySelector('#totalGeralVda').value),
            totGeralCto: desformatarMoeda(document.querySelector('#totalGeralCto').value),
            lucroBruto: desformatarMoeda(document.querySelector('#Lucro').value),
            desconto: parseFloat(formData.get("Desconto")),
            acrescimo: parseFloat(formData.get("Acrescimo")),
            lucroReal: desformatarMoeda(document.querySelector('#lucroReal').value),
            vlrCliente: desformatarMoeda(document.querySelector('#valorCliente').value),
            observacoes: formData.get("observacoes")
        };
        const itens = [];
        const linhas = document.querySelectorAll("#tabela tbody tr");

        linhas.forEach((linha) => {
            const item = {
            categoria: linha.querySelector(".Categoria")?.textContent.trim(),
            produto: linha.querySelector(".produto")?.textContent.trim(),
            qtdPessoas: linha.querySelector(".qtdPessoas input")?.value || "0",
            qtdDias: linha.querySelector(".qtdDias input")?.value || "0",
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

        const payload = {
            ...dadosOrcamento,
            itens
        };

        try {
            const response = await fetch('http://localhost:3000/orcamentos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
            });

            if (response.ok) {
            const resultado = await response.json();
            Swal.fire("Sucesso", "Orçamento salvo com sucesso!", "success");
            } else {
            const erro = await response.text();
            Swal.fire("Erro", "Falha ao salvar orçamento: " + erro, "error");
            }
        } catch (err) {
            console.error(err);
            Swal.fire("Erro", "Erro inesperado ao salvar orçamento.", "error");
        }
    });
    //calcularTotaisOrc();
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

    fetch("http://localhost:3000/orcamento", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
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

    // IDs que não devem ser bloqueados nunca
    const idsPermitidos = ['Desconto', 'perCentDesc', 'Acrescimo', 'perCentAcresc'];

    if (fechado) {
        // Bloqueia todos os campos, exceto os permitidos
        const campos = document.querySelectorAll('input, select, textarea');
        campos.forEach(campo => {
            const id = campo.id;

            if (
                campo.classList.contains('idFuncao') ||
                campo.classList.contains('idEquipamento') ||
                campo.classList.contains('idSuprimento') ||
                idsPermitidos.includes(id)
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
                classes.contains('pesquisar') ||
                classes.contains('Adicional');

            if (id === 'fecharOrc' || id === 'adicionar') {
                botao.style.display = 'none';
            } else if (deveContinuarAtivo) {
                botao.style.display = 'inline-block';
                botao.disabled = false;
            } else {
                botao.disabled = true;
            }
        });

        // Adiciona alerta se tentar editar manualmente (exceto os permitidos)
        const elementosEditaveis = document.querySelectorAll('input, select, textarea, .Proposta input');
        elementosEditaveis.forEach(el => {
            const id = el.id;

            if (
                el.classList.contains('idFuncao') ||
                el.classList.contains('idEquipamento') ||
                el.classList.contains('idSuprimento') ||
                idsPermitidos.includes(id)
            ) return;

            el.addEventListener('focus', () => {
                Swal.fire('Orçamento fechado', 'Este orçamento está fechado. Não é possível fazer alterações, apenas inserir adicionais.', 'warning');
                el.blur();
            });
        });

    } else {
        // Desbloqueia todos os campos normalmente
        const campos = document.querySelectorAll('input, select, textarea');
        campos.forEach(campo => {
            campo.classList.remove('bloqueado');
            campo.readOnly = false;
            campo.disabled = false;
        });

        // Mostra botão de fechar
        const btnFechar = document.getElementById('fecharOrc');
        if (btnFechar) {
            btnFechar.style.display = 'inline-block';
            btnFechar.disabled = false;
        }

        // Oculta botões adicionais se necessário
        const btnAdicional = document.querySelectorAll('.Adicional');
        btnAdicional.forEach(btn => {
            btn.style.display = 'none';
        });
    }
}
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

function gerarOrcamentoPDF() {
    const cliente = document.querySelector('#clienteSelecionado')?.textContent || '';
    const evento = document.querySelector('#eventoSelecionado')?.textContent || '';
    const local = document.querySelector('#localSelecionado')?.textContent || '';
    const data_inicio = document.querySelector('#dtInicioRealizacao')?.value || '';
    const data_fim = document.querySelector('#dtFimRealizacao')?.value || '';
    const infraAtivado = document.querySelector('#checkboxInfra')?.checked;

    // Pega os períodos (dataRange)
    function pegarRange(idPrefixo) {
        const de = document.querySelector(`#${idPrefixo}De`)?.value || null;
        const ate = document.querySelector(`#${idPrefixo}Ate`)?.value || null;
        return de && ate ? { de, ate } : null;
    }

    const periodos = {
        montagem_infra: infraAtivado ? pegarRange('montagemInfra') : null,
        periodo_marcacao: pegarRange('periodoMarcacao'),
        periodo_montagem: pegarRange('periodoMontagem'),
        periodo_realizacao: pegarRange('periodoRealizacao'),
        periodo_desmontagem: pegarRange('periodoDesmontagem'),
        desmontagem_infra: infraAtivado ? pegarRange('desmontagemInfra') : null
    };

    // Pega todos os itens com classe .Proposta (independente do checkbox estar marcado)
    const linhas = document.querySelectorAll('.Proposta');
    const itens = Array.from(linhas).map(linha => {
        const categoria = linha.querySelector('.Categoria')?.textContent?.trim() || '';
        const produto = linha.querySelector('.produto')?.textContent?.trim() || '';
        const quantidade = linha.querySelector('.qtdPessoas input')?.value || '0';
        const dias = linha.querySelector('.qtdDias input')?.value || '0';

        return {
            categoria,
            produto,
            quantidade: parseInt(quantidade),
            dias: parseInt(dias)
        };
    });

    const dados = {
        cliente,
        evento,
        local,
        data_inicio,
        data_fim,
        ...periodos,
        itens
    };

    // Envia para o backend
    fetch('http://localhost:3000/orcamentos1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
    })
    .then(res => res.json())
    .then(resp => {
        console.log('Orçamento salvo com sucesso:', resp);
        alert('Orçamento salvo com sucesso!');
    })
    .catch(err => {
        console.error('Erro ao salvar orçamento:', err);
        alert('Erro ao salvar orçamento.');
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
    img.src = 'img/orcamento_fundo.jpg';

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

        doc.addImage(img, 'PNG', 0, 0, pageWidth, pageHeight);

        console.log("Buscando dados do formulário");

        const clienteSelect = document.querySelector('.idCliente');
        const nomeCliente = clienteSelect?.options[clienteSelect.selectedIndex]?.innerText || "N/D";
        const eventoSelect = document.querySelector('.idEvento');
        const nomeEvento = eventoSelect?.options[eventoSelect.selectedIndex]?.innerText || "N/D";
        const montagemSelect = document.querySelector('.idMontagem');
        const localEvento = montagemSelect?.options[montagemSelect.selectedIndex]?.innerText || "N/D";
        const dataInicio = document.getElementById('dtInicioRealizacao')?.value || "N/D";
        const dataFim = document.getElementById('dtFimRealizacao')?.value || "N/D";

        let dadosContato = { nmcontato: "N/D", celcontato: "N/D", emailcontato: "N/D" };
        try {
            console.log("Buscando dados do cliente via API");
            const resposta = await fetch(`http://localhost:3000/clientes?nmFantasia=${encodeURIComponent(nomeCliente)}`);
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
        adicionarLinha(`Data: De ${dataInicio} até ${dataFim}`);
        y += 10;

        doc.setFontSize(tituloFontSize);
        adicionarLinha("Escopo da proposta:");
        y += 5;

        const tabela = document.getElementById('tabela');
        const linhas = tabela?.querySelectorAll('tbody tr') || [];
        const categoriasMap = {};

        

        linhas.forEach(linha => {
            const checkbox = linha.querySelector('.Proposta input');
            if (!checkbox || !checkbox.checked) return;

            const qtdItens = linha.querySelector('.qtdPessoas input')?.value?.trim();
            const produto = linha.querySelector('.produto')?.innerText?.trim();
            const qtdDias = linha.querySelector('.qtdDias input')?.value?.trim();
            const categoria = linha.querySelector('.Categoria')?.innerText?.trim() || "Sem Categoria";

            if (produto && qtdItens !== '0' && qtdDias !== '0') {
                if (!categoriasMap[categoria]) categoriasMap[categoria] = [];
                categoriasMap[categoria].push(`• ${produto} — ${qtdItens} Item(s), ${qtdDias} Diaria(s)`);
            }
        });

        for (const [categoria, itens] of Object.entries(categoriasMap)) {
            adicionarLinha(categoria + ":", 12, true);
            itens.forEach(item => adicionarLinha(item));
            y += 5;
        }

        doc.addPage();
        doc.addImage(img, 'PNG', 0, 0, pageWidth, pageHeight);
        y = 40;

        adicionarLinha("SUPORTE TÉCNICO", textoFontSize, true);
        doc.splitTextToSize("Caso seja necessário suporte técnico para as impressoras, a diária adicional é de R$ XX.", pageWidth - 2 * x)
            .forEach(linha => adicionarLinha(linha));
        y += 10;

        adicionarLinha("INVESTIMENTO", textoFontSize, true);
        doc.splitTextToSize("O valor para a execução desta proposta é de R$ XX...", pageWidth - 2 * x)
            .forEach(linha => adicionarLinha(linha));
        y += 10;

        adicionarLinha("FORMA DE PAGAMENTO", textoFontSize, true);
        doc.splitTextToSize("Condições de pagamento a serem definidas...", pageWidth - 2 * x)
            .forEach(linha => adicionarLinha(linha));
        y += 15;

        doc.setFontSize(10);
        adicionarLinha("Obs: Proposta informativa sem valores financeiros.");

        const dataAtual = new Date();
        const dataFormatada = dataAtual.toLocaleDateString('pt-BR');
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
    }

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
            qtdPessoas: linha.querySelector(".qtdPessoas input")?.value,
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
        const resposta = await fetch(form.getAttribute('data-action'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
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

window.configurarEventosOrcamento = configurarEventosOrcamento;