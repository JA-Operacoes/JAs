document.addEventListener("DOMContentLoaded", function () {
    console.log("Script orcamento.js carregado.");
   
    let selects = document.querySelectorAll(".idFuncao, .idEquipamento, .idSuprimento");
    selects.forEach(select => {
        select.addEventListener("change", atualizaProdutoOrc);
    });

});

function carregarClientesOrc() {
    
    console.log("Função carregar Cliente chamada");
    fetch('http://localhost:3000/clientes')
    .then(response => response.json())
    .then(clientes => {
        console.log('Clientes recebidos:', clientes);
        
        let selects = document.querySelectorAll(".idCliente");

        
        selects.forEach(select => {
            
            select.innerHTML = '<option value="">Selecione Cliente</option>'; // Adiciona a opção padrão
            clientes.forEach(cliente => {
                let option = document.createElement("option");
                
                console.log('Clientes recebidos 2:', clientes);
              
                option.value = cliente.idcliente;  // Atenção ao nome da propriedade (idMontagem)
                option.textContent = cliente.nmfantasia; 
                option.setAttribute("data-nmfantasia", cliente.nmfantasia);
                select.appendChild(option);

                console.log("Select atualizado:", select.innerHTML);

            });
            
        });
    
    })

     // Chama a função para atualizar o campo UF após carregar os locais de montagem
    .catch(error => console.error('Erro ao carregar Local Montagem:', error));
}

function carregarEventosOrc() {
    
    console.log("Função carregar Eventos chamada");

    fetch('http://localhost:3000/eventos')
    .then(response => response.json())
    .then(eventos => {
        console.log('Eventos recebidos:', eventos);
        
        let selects = document.querySelectorAll(".idEvento");
        
        selects.forEach(select => {
            
            console.log("dentro do SELECT EVENTOS",eventos);
            
            select.innerHTML = '<option value="">Selecione Evento</option>'; // Adiciona a opção padrão
            eventos.forEach(evento => {
                let option = document.createElement("option");
                
                console.log('Eventos recebidos 2:', eventos);
              
                option.value = evento.idevento;  // Atenção ao nome da propriedade (idMontagem)
                option.textContent = evento.nmevento; 
                option.setAttribute("data-nmevento", evento.nmevento);
                // option.setAttribute("data-ufmontagem", cliente.ufmontagem); 
                select.appendChild(option);

                console.log("Select atualizado:", select.innerHTML);
            

            });
            
        });
    
    })

     // Chama a função para atualizar o campo UF após carregar os locais de montagem
    .catch(error => console.error('Erro ao carregar Local Montagem:', error));
}
// Função para carregar os Funcao
function carregarFuncaoOrc() {
    console.log("Função carregarFuncao chamada ORCAMENTO.js");
     
    fetch('http://localhost:3000/funcao')
   
        .then(response => response.json())
        .then(funcao => {
             console.log('Funcao recebidos 1:', funcao); // Log das Função recebidos
           
             let selects = document.querySelectorAll(".idFuncao");
            selects.forEach(select => {
                select.innerHTML = "";
               
                console.log('Funcao recebidos 2:', funcao); // Log das Função recebidos
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
                    select.appendChild(option);
                });
                select.addEventListener("change", atualizaProdutoOrc);
            });
        })
        .catch(error => console.error('Erro ao carregar Funcao:', error));
}

// Função para carregar os equipamentos
function carregarEquipamentosOrc() {

    console.log("Função carregarEquipamentos chamada");
    fetch('http://localhost:3000/equipamento')
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
                    select.appendChild(option);
                });
                select.addEventListener("change", atualizaProdutoOrc);
            });
        })
        .catch(error => console.error('Erro ao carregar equipamentos:', error));
}

// Função para carregar os suprimentos
function carregarSuprimentosOrc() {
    console.log("Função carregarSuprimentos chamada");
    fetch('http://localhost:3000/suprimento')
        .then(response => response.json())
        .then(suprimentos => {
            let selects = document.querySelectorAll(".idSuprimento");
            console.log('Suprimentos recebidos:', suprimentos); // Log dos suprimentos recebidos
            console.log('Selects Suprimento',selects);
            selects.forEach(select => {
                select.innerHTML = '<option value="">Selecione Suprimento</option>';
                suprimentos.forEach(suprimentos => {
                    let option = document.createElement("option");
                    option.value = suprimentos.idsup;
                    option.textContent = suprimentos.descsup;
                    option.setAttribute("data-descproduto", suprimentos.descsup);
                    option.setAttribute("data-cto", suprimentos.ctosup);
                    option.setAttribute("data-vda", suprimentos.vdasup);
                    select.appendChild(option);
                   
                    console.log("Select atualizado Suprimento:", select.innerHTML);

                });
                select.addEventListener("change", atualizaProdutoOrc);
            });
        })
        .catch(error => console.error('Erro ao carregar suprimentos:', error));
}

// Função para carregar os locais de montagem
function carregarLocalMontOrc() {
    
    console.log("Função carregar LocalMontagem chamada");
    fetch('http://localhost:3000/localmontagem')
    .then(response => response.json())
    .then(montagem => {
        console.log('Local Montagem recebidos:', montagem);
        
        let selects = document.querySelectorAll(".idMontagem");
        
        selects.forEach(select => {
           
            // Adiciona as opções de Local de Montagem
            select.innerHTML = '<option value="">Selecione Local de Montagem</option>'; // Adiciona a opção padrão
            montagem.forEach(local => {
                let option = document.createElement("option");

                option.value = local.idmontagem;  // Atenção ao nome da propriedade (idMontagem)
                option.textContent = local.descmontagem; 
                option.setAttribute("data-descmontagem", local.descmontagem);
                option.setAttribute("data-ufmontagem", local.ufmontagem); 
                select.appendChild(option);

                console.log("Select atualizado:", select.innerHTML);

                locaisDeMontagem = montagem;

            });
            
        });
    
    })

     // Chama a função para atualizar o campo UF após carregar os locais de montagem
    .catch(error => console.error('Erro ao carregar Local Montagem:', error));
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
                console.log('Incrementando...');
                input.value = currentValue + 1;
            } else if (event.target.classList.contains('decrement')) {
                console.log('Decrementando...');
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
    if (!valor) return 0;
    return parseFloat(valor.replace(/[R$\s.]/g, '').replace(',', '.')) || 0;
}

function formatarMoeda(valor) {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function recalcularLinha(linha) {
    if (!linha) return;

    try {
        console.log("Linha recebida:", linha);

        // --- Primeiro, recalcula o TotVendaDiaria e TotCtoDiaria
        let qtdItens = parseFloat(linha.querySelector('.qtdPessoas input')?.value) || 0;
        let qtdDias = parseFloat(linha.querySelector('.qtdDias input')?.value) || 0;
        let vlrVenda = desformatarMoeda(linha.querySelector('.vlrVenda')?.textContent);
        let vlrCusto = desformatarMoeda(linha.querySelector('.vlrCusto')?.textContent);

        let totalIntermediario = qtdItens * qtdDias;
        let totalVenda = totalIntermediario * vlrVenda;
        let totalCusto = totalIntermediario * vlrCusto;

        console.log(`Total Venda calculado: ${totalVenda.toFixed(2)}`);
        console.log(`Total Custo calculado: ${totalCusto.toFixed(2)}`);

        // Atualiza o valor na célula TotVendaDiaria
        let totalVendaCell = linha.querySelector('.totVdaDiaria');
        if (totalVendaCell) {
            totalVendaCell.textContent = totalVenda.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        }

        // Atualiza o valor na célula TotCtoDiaria
        let totalCustoCell = linha.querySelector('.totCtoDiaria');
        if (totalCustoCell) {
            totalCustoCell.textContent = totalCusto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        }

        // --- Agora, recalcula o total geral dos custos e vendas
        let totalCustoGeral = 0;
        let totalVendaGeral = 0;

        document.querySelectorAll('.totCtoDiaria').forEach(cell => {
            totalCustoGeral += desformatarMoeda(cell.textContent);
        });

        document.querySelectorAll('.totVdaDiaria').forEach(cell => {
            totalVendaGeral += desformatarMoeda(cell.textContent);
        });

        // Atualiza o campo de Total Geral Custo se existir
        let inputTotalCusto = document.querySelector('#totalGeralCto');
        if (inputTotalCusto) {
            inputTotalCusto.value = totalCustoGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        }

        // Atualiza o campo de Total Geral Venda se existir
        let inputTotalVenda = document.querySelector('#totalGeralVda');
        if (inputTotalVenda) {
            inputTotalVenda.value = totalVendaGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        }

        console.log("Total Geral de Custo:", totalCustoGeral.toFixed(2));
        console.log("Total Geral de Venda:", totalVendaGeral.toFixed(2));

        aplicarMascaraMoeda();
        aplicarDesconto();
        calcularLucro();

    } catch (error) {
        console.error("Erro no recalcularLinha:", error);
    }
}

function recalcularTotaisGerais() {
    let totalCustoGeral = 0;
    let totalVendaGeral = 0;

    // Soma os custos
    document.querySelectorAll('.totCtoDiaria').forEach(cell => {
        totalCustoGeral += desformatarMoeda(cell.textContent);
    });

    // Soma as vendas
    document.querySelectorAll('.totVdaDiaria').forEach(cell => {
        totalVendaGeral += desformatarMoeda(cell.textContent);
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

function aplicarDesconto() {
    aplicarMascaraMoeda();

    let totalVendaGeral = desformatarMoeda(document.querySelector('#totalGeralVda').value);
    let desconto = desformatarMoeda(document.querySelector('#Desconto').value);

    // Garante que o desconto não ultrapasse o total
    if (desconto > totalVendaGeral) {
        desconto = totalVendaGeral;
        document.querySelector('#Desconto').value = formatarMoeda(desconto);
    }

    let valorFinal = totalVendaGeral - desconto;

    // Atualiza o campo de valor final
    let inputValorFinal = document.querySelector('#valorCliente');
    if (inputValorFinal) {
        inputValorFinal.value = formatarMoeda(valorFinal);
    }

    console.log('Valor Final ao Cliente:', valorFinal);
}


// Exemplo de função para remover a linha
function removerLinha(linha) {
    // Remove a linha da DOM
    linha.remove();

    // Recalcular os totais após a remoção
    
    recalcularTotaisGerais();
    aplicarDesconto()
    aplicarMascaraMoeda()
    calcularLucro()
}







function adicionarLinhaOrc() {
    let tabela = document.getElementById("tabela").getElementsByTagName("tbody")[0];

    let novaLinha = tabela.insertRow();
    novaLinha.innerHTML = `
    <td class="qtdPessoas"><div class="add-less"><input type="number" class="qtdPessoas" min="0" value="0" oninput="calcularTotalOrc()"><div class="Bt"><button class="increment">+</button><button class="decrement">-</button></div></div></td>
    <td class="produto"></td>
    <td class="qtdDias"><div class="add-less"><input type="number" class="qtdDias" min="0" value="0" oninput="calcularTotalOrc()"><div class="Bt"><button class="increment">+</button><button class="decrement">-</button></div></div></td>
    <td class="vlrVenda Moeda"></td>
    <td class="totVdaDiaria Moeda"></td>
    <td class="vlrCusto Moeda"></td>
    <td class="totCtoDiaria Moeda"></td>
    <td class="ajdCusto"></td>
    <td class="totAjdCusto">0</td>
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
     console.log("Função atualizarUF chamada");
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
        console.log("UF diferente de SP, exibindo campos extras.");
        colunasExtras.forEach(col => col.style.display = "table-cell"); // Exibe cabeçalho
        camposExtras.forEach(campo => campo.style.display = "table-cell"); // Exibe campos
    } else {
        console.log("UF é SP, ocultando campos extras.");
        colunasExtras.forEach(col => col.style.display = "none"); // Oculta cabeçalho
        camposExtras.forEach(campo => campo.style.display = "none"); // Oculta campos
    }
   
}

function atualizaProdutoOrc(event) {
    console.log("Função atualizaProduto chamada");

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

        // Se a célula de produto estiver vazia OU se foi alterado um novo select, atualiza
        if (celulaProduto && (celulaProduto.textContent === "" || select.classList.contains("idEquipamento") || select.classList.contains("idSuprimento") || select.classList.contains("idFuncao"))) {
            celulaProduto.textContent = produtoSelecionado;
        }

        let celulaVlrCusto = ultimaLinha.querySelector(".vlrCusto");
        if (celulaVlrCusto) celulaVlrCusto.textContent = vlrCusto;

        let celulaVlrVenda = ultimaLinha.querySelector(".vlrVenda");
        if (celulaVlrVenda) celulaVlrVenda.textContent = vlrVenda;
    }

     
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

    console.log("Função configurarEventosOrcamento CHAMADA");
    carregarFuncaoOrc();
    carregarEventosOrc();
    carregarClientesOrc();
    carregarLocalMontOrc();
    carregarEquipamentosOrc();
    carregarSuprimentosOrc();
    configurarFormularioOrc();

    
    
    calcularTotaisOrc();
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


// --------------------------------------- botoes Quantidade-----------------------------------------

if (!window.hasRegisteredClickListener) {
    document.addEventListener('click', function(event) {
    if (event.target.classList.contains('increment')) {
        console.log('Incrementando...');
        const input = event.target.closest('.add-less').querySelector('input');
        input.value = parseInt(input.value || 0) + 1;
    }

    if (event.target.classList.contains('decrement')) {
        console.log('Decrementando...');
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
        if (!isNaN(valor)) {
            td.textContent = valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        }
    });

    // Formatar inputs somente se forem readonly (apenas visual)
    document.querySelectorAll('input.Moeda[readonly]').forEach(input => {
        let valor = parseFloat(input.value);
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
window.configurarEventosOrcamento = configurarEventosOrcamento;