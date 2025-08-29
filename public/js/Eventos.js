import { fetchComToken } from '../utils/utils.js';

let nmEventoInputListener = null; 
let nmEventoBlurListener = null; 
let limparEventoButtonListener = null;
let enviarEventoButtonListener = null;
let pesquisarEventoButtonListener = null;
let selectEventoChangeListener = null;
let novoInputNmEventoInputListener = null; 
let novoInputNmEventoBlurListener = null; 

let EventoOriginal = {
    idEvento: "",
    nmEvento: ""
   
};




async function verificaEvento() {
    console.log("Carregando Evento...");
    
    const botaoEnviar = document.querySelector("#Enviar");
    const botaoPesquisar = document.querySelector("#Pesquisar");
    const botaoLimpar = document.querySelector("#Limpar");
    const form = document.querySelector("#form");    


    const clientesSelecionados = new Set(); // Use um Set para evitar clientes duplicados
    const selectCliente = document.getElementById("selectCliente");
    const clientesContainer = document.getElementById("clientesSelecionadosContainer");
    const clientesInput = document.getElementById("clientesDoEvento");

    carregarClientes();

    selectCliente.addEventListener('change', (e) => {
        const idCliente = e.target.value;
        const nomeCliente = e.target.options[e.target.selectedIndex].text;

        if (idCliente && !clientesSelecionados.has(idCliente)) {
            clientesSelecionados.add(idCliente);
            
            const tag = document.createElement('span');
            tag.className = 'cliente-tag';
            tag.innerHTML = `${nomeCliente} <button type="button" class="remover-cliente" data-id="${idCliente}">x</button>`;
            clientesContainer.appendChild(tag);

            clientesInput.value = JSON.stringify(Array.from(clientesSelecionados));
            
            // ✅ Lógica de Remoção com Swal
            tag.querySelector('.remover-cliente').addEventListener('click', async () => {
                const { isConfirmed } = await Swal.fire({
                    title: "Remover cliente?",
                    text: `Deseja realmente remover o cliente "${nomeCliente}" deste evento?`,
                    icon: "warning",
                    showCancelButton: true,
                    confirmButtonColor: '#d33',
                    cancelButtonColor: '#3085d6',
                    confirmButtonText: "Sim, remover!",
                    cancelButtonText: "Cancelar"
                });
                if (isConfirmed) {
                    clientesSelecionados.delete(idCliente);
                    tag.remove();
                    clientesInput.value = JSON.stringify(Array.from(clientesSelecionados));
                    botaoEnviar.click();
                }
            });
        }
        e.target.value = '';
    });


    if (!botaoEnviar || !form) {
        console.error("Formulário ou botão não encontrado no DOM.");
        return;
    }

    botaoLimpar.addEventListener("click", (e) => {
        e.preventDefault();
        limparCamposEvento();
    });

    // botaoEnviar.addEventListener("click", async (e) => {
    //     e.preventDefault();

    //     const idEvento = document.querySelector("#idEvento").value.trim();
    //     const nmEvento = document.querySelector("#nmEvento").value.toUpperCase().trim();
        
    //     // Permissões
    //     const temPermissaoCadastrar = temPermissao("Eventos", "cadastrar");
    //     const temPermissaoAlterar = temPermissao("Eventos", "alterar");

    //     const metodo = idEvento ? "PUT" : "POST";

    //     if (!idEvento && !temPermissaoCadastrar) {
    //         return Swal.fire("Acesso negado", "Você não tem permissão para cadastrar novos eventos.", "error");
    //     }

    //     if (idEvento && !temPermissaoAlterar) {
    //         return Swal.fire("Acesso negado", "Você não tem permissão para alterar eventos.", "error");
    //     }

    //     if (!nmEvento) {
    //         return Swal.fire("Campos obrigatórios!", "Preencha todos os campos antes de enviar.", "warning");
    //     }

    //     const dados = { nmEvento};        

    //     if (parseInt(idEvento) === parseInt(window.EventoOriginal?.idEvento)) {
    //         console.log("Evento não alterado, não será enviado.");
    //     }
    //     if (nmEvento === window.EventoOriginal?.nmEvento ) {
    //         console.log("Evento não alterado, não será enviado.");
    //     }
    //     // Verifica alterações
    //     if (
            
    //         parseInt(idEvento) === parseInt(window.EventoOriginal?.idEvento) &&
    //         nmEvento === window.EventoOriginal?.nmEvento  
    //     ) {
    //         return Swal.fire("Nenhuma alteração foi detectada!", "Faça alguma alteração antes de salvar.", "info");
    //     }
        
    //     const url = idEvento
    //         ? `/eventos/${idEvento}`
    //         : "/eventos";
        
    //     try {
    //         // Confirma alteração (PUT)
    //         if (metodo === "PUT") {
    //             const { isConfirmed } = await Swal.fire({
    //                 title: "Deseja salvar as alterações?",
    //                 text: "Você está prestes a atualizar os dados do Evento.",
    //                 icon: "question",
    //                 showCancelButton: true,
    //                 confirmButtonText: "Sim, salvar",
    //                 cancelButtonText: "Cancelar",
    //                 reverseButtons: true,
    //                 focusCancel: true
    //             });
    //             if (!isConfirmed) return;
    //         }

    //         console.log("Enviando dados para o servidor:", dados, url, metodo);
    //         const respostaApi = await fetchComToken(url, {
    //             method: metodo,
    //             headers: {
    //                 'Content-Type': 'application/json'
    //             },
    //             body: JSON.stringify(dados)
    //         });            

    //         await Swal.fire("Sucesso!", respostaApi.message || "Evento salvo com sucesso.", "success");
    //         limparCamposEvento();

    //     } catch (error) {
    //         console.error("Erro ao enviar dados:", error);
    //         Swal.fire("Erro", error.message || "Erro ao salvar evento.", "error");
    //     }
    // });

    botaoEnviar.addEventListener("click", async (e) => {
        e.preventDefault();

        const idEvento = document.querySelector("#idEvento").value.trim();
        const nmEvento = document.querySelector("#nmEvento").value.toUpperCase().trim();
        // ✅ Obter o array de clientes selecionados do campo oculto
        const clientesDoEventoInput = document.querySelector("#clientesDoEvento");
        const clientesDoEvento = clientesDoEventoInput.value ? JSON.parse(clientesDoEventoInput.value) : [];

        // Permissões
        const temPermissaoCadastrar = temPermissao("Eventos", "cadastrar");
        const temPermissaoAlterar = temPermissao("Eventos", "alterar");

        const metodo = idEvento ? "PUT" : "POST";

        if (!idEvento && !temPermissaoCadastrar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para cadastrar novos eventos.", "error");
        }

        if (idEvento && !temPermissaoAlterar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para alterar eventos.", "error");
        }

        // ✅ Adicionar validação para o nome e a lista de clientes
        if (!nmEvento || clientesDoEvento.length === 0) {
            return Swal.fire("Campos obrigatórios!", "Preencha a descrição do evento e selecione pelo menos um cliente.", "warning");
        }

        // ✅ Incluir o array de clientes no objeto de dados
        const dados = { nmEvento, clientesDoEvento };

        // ✅ Busca a lista original de clientes para a comparação de alteração
        const clientesOriginais = window.EventoOriginal?.clientes || [];

        // ✅ Verifica se houve alguma alteração (nome ou lista de clientes)
        const nmEventoAlterado = nmEvento !== window.EventoOriginal?.nmEvento;
        const clientesAlterados = JSON.stringify(clientesDoEvento.sort()) !== JSON.stringify(clientesOriginais.sort());

        if (metodo === "PUT" && !nmEventoAlterado && !clientesAlterados) {
            return Swal.fire("Nenhuma alteração foi detectada!", "Faça alguma alteração antes de salvar.", "info");
        }

        const url = idEvento
            ? `/eventos/${idEvento}`
            : "/eventos";

        try {
            // Confirma alteração (PUT)
            if (metodo === "PUT") {
                const { isConfirmed } = await Swal.fire({
                    title: "Deseja salvar as alterações?",
                    text: "Você está prestes a atualizar os dados do Evento.",
                    icon: "question",
                    showCancelButton: true,
                    confirmButtonText: "Sim, salvar",
                    cancelButtonText: "Cancelar",
                    reverseButtons: true,
                    focusCancel: true
                });
                if (!isConfirmed) return;
            }

            console.log("Enviando dados para o servidor:", dados, url, metodo);
            const respostaApi = await fetchComToken(url, {
                method: metodo,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(dados)
            });

            await Swal.fire("Sucesso!", respostaApi.message || "Evento salvo com sucesso.", "success");
            limparCamposEvento();

        } catch (error) {
            console.error("Erro ao enviar dados:", error);
            Swal.fire("Erro", error.message || "Erro ao salvar evento.", "error");
        }
    });

    botaoPesquisar.addEventListener("click", async function (e) {
        e.preventDefault();
        limparCamposEvento();

        console.log("Pesquisando Evento...");

        const temPermissaoPesquisar = temPermissao('Eventos', 'pesquisar');
        if (!temPermissaoPesquisar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para pesquisar.", "warning");
        }

        console.log("Pesquisando Evento...");

        try {
            const eventos = await fetchComToken("/eventos");
           
            const select = criarSelectEvento(eventos);

            limparCamposEvento();
            const input = document.querySelector("#nmEvento");

            if (input && input.parentNode) {
                input.parentNode.replaceChild(select, input);
            }

            const label = document.querySelector('label[for="nmEvento"]');
            if (label) label.style.display = "none";

            select.addEventListener("change", async function () {
                const desc = this.value?.trim();
                if (!desc) return;

                await carregarEventoDescricao(desc, this);

                const novoInput = document.createElement("input");
                novoInput.type = "text";
                novoInput.id = "nmEvento";
                novoInput.name = "nmEvento";
                novoInput.required = true;
                novoInput.className = "form";
                novoInput.value = desc;

                novoInput.addEventListener("input", function () {
                    this.value = this.value.toUpperCase();
                });

                // this.parentNode.replaceChild(novoInput, this);
                adicionarEventoBlurEvento();

                if (label) {
                    label.style.display = "block";
                    label.textContent = "Descrição do Evento";
                }

                novoInput.addEventListener("blur", async function () {
                    if (!this.value.trim()) return;
                    await carregarEventoDescricao(this.value, this);
                });
            });

        } catch (error) {
            console.error("Erro ao carregar eventos:", error);
            Swal.fire({
                icon: 'error',
                title: 'Erro',
                text: 'Não foi possível carregar os eventos.',
                confirmButtonText: 'Ok'
            });
        }
    });
}

async function carregarClientes() {
    try {
        const clientes = await fetchComToken("/eventos/clientes");
        const selectCliente = document.getElementById("selectCliente");

        // Limpa as opções existentes
        selectCliente.innerHTML = '<option value="">Selecione um Cliente</option>';

        clientes.forEach(cliente => {
        console.log("CLIENTES", clientes.nmfantasia)
            const option = document.createElement("option");
            option.value = cliente.idcliente; // Use o ID do cliente como valor
            option.text = cliente.nmfantasia;
            selectCliente.appendChild(option);
        });
    } catch (error) {
        console.error("Erro ao carregar clientes:", error);
    }
}

function adicionarListenersAoInputNmEvento(inputElement) {
    // Remove listeners anteriores para evitar duplicidade
    if (novoInputNmEventoInputListener) { // Verifica se já existe um listener para 'input' no novo input
        inputElement.removeEventListener("input", novoInputNmEventoInputListener);
    }
    if (novoInputNmEventoBlurListener) { // Verifica se já existe um listener para 'blur' no novo input
        inputElement.removeEventListener("blur", novoInputNmEventoBlurListener);
    }

    nmEventoInputListener = function () { // Atribui à variável global para o listener 'input'
        this.value = this.value.toUpperCase();
    };
    inputElement.addEventListener("input", nmEventoInputListener);

    nmEventoBlurListener = async function () { // Atribui à variável global para o listener 'blur'
        if (!this.value.trim()) return;
        console.log("Campo nmEvento procurado (blur dinâmico):", this.value);
        await carregarEventoDescricao(this.value, this);
    };
    inputElement.addEventListener("blur", nmEventoBlurListener);
}

function resetarCampoNmEventoParaInput() {
    const nmEventoCampo = document.getElementById("nmEvento");
    // Verifica se o campo atual é um select e o substitui por um input
    if (nmEventoCampo && nmEventoCampo.tagName.toLowerCase() === "select") {
        const input = document.createElement("input");
        input.type = "text";
        input.id = "nmEvento";
        input.name = "nmEvento";
        input.value = ""; // Limpa o valor
        input.placeholder = "Nome do Evento";
        input.className = "form";
        input.classList.add('uppercase');
        input.required = true;

        // Remove o listener do select antes de substituí-lo
        if (selectEventoChangeListener) {
            nmEventoCampo.removeEventListener("change", selectEventoChangeListener);
            selectEventoChangeListener = null;
        }

        nmEventoCampo.parentNode.replaceChild(input, nmEventoCampo);
        adicionarListenersAoInputNmEvento(input); // Adiciona os listeners ao novo input

        const label = document.querySelector('label[for="nmEvento"]');
        if (label) {
            label.style.display = "block";
            label.textContent = "Nome do Evento";
        }
    }
}


// =============================================================================
// Função de Desinicialização do Módulo Eventos
// =============================================================================
function desinicializarEventoModal() {
    console.log("🧹 Desinicializando módulo Eventos.js...");

    const nmEventoElement = document.querySelector("#nmEvento");
    const botaoEnviar = document.querySelector("#Enviar");
    const botaoPesquisar = document.querySelector("#Pesquisar");
    const botaoLimpar = document.querySelector("#Limpar");

    // 1. Remover listeners de eventos dos elementos fixos
    if (botaoLimpar && limparEventoButtonListener) {
        botaoLimpar.removeEventListener("click", limparEventoButtonListener);
        limparEventoButtonListener = null;
        console.log("Listener de click do Limpar (Eventos) removido.");
    }
    if (botaoEnviar && enviarEventoButtonListener) {
        botaoEnviar.removeEventListener("click", enviarEventoButtonListener);
        enviarEventoButtonListener = null;
        console.log("Listener de click do Enviar (Eventos) removido.");
    }
    if (botaoPesquisar && pesquisarEventoButtonListener) {
        botaoPesquisar.removeEventListener("click", pesquisarEventoButtonListener);
        pesquisarEventoButtonListener = null;
        console.log("Listener de click do Pesquisar (Eventos) removido.");
    }

    // 2. Remover listeners do campo nmEvento (que pode ser input ou select)
    if (nmEventoElement) {
        if (nmEventoElement.tagName.toLowerCase() === "input") {
            if (nmEventoInputListener) { // Listener para 'input' (toUpperCase)
                nmEventoElement.removeEventListener("input", nmEventoInputListener);
                nmEventoInputListener = null;
                console.log("Listener de input do nmEvento (input) removido.");
            }
            if (nmEventoBlurListener) { // Listener para 'blur' (carregar descrição)
                nmEventoElement.removeEventListener("blur", nmEventoBlurListener);
                nmEventoBlurListener = null;
                console.log("Listener de blur do nmEvento (input) removido.");
            }
        } else if (nmEventoElement.tagName.toLowerCase() === "select" && selectEventoChangeListener) {
            nmEventoElement.removeEventListener("change", selectEventoChangeListener);
            selectEventoChangeListener = null;
            console.log("Listener de change do select nmEvento removido.");
        }
    }

    // 3. Limpar o estado global e campos do formulário
    window.EventoOriginal = null; // Zera o objeto de evento original
    limparCamposEvento(); // Limpa todos os campos visíveis do formulário
   // document.querySelector("#form").reset(); // Garante que o formulário seja completamente resetado
    document.querySelector("#idEvento").value = ""; // Limpa o ID oculto
    resetarCampoNmEventoParaInput(); // Garante que o campo nmEvento volte a ser um input padrão

    console.log("✅ Módulo Eventos.js desinicializado.");
}


function criarSelectEvento(eventos) {
   
    const select = document.createElement("select");
    select.id = "nmEvento";
    select.name = "nmEvento";
    select.required = true;
    select.className = "form";

   
    // Adicionar opções
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.text = "Selecione um Evento...";
    defaultOption.disabled = true;
    defaultOption.selected = true;
    select.appendChild(defaultOption);
   
    console.log("PESQUISANDO EVENTO:", eventos);

    eventos.forEach(eventosachado => {
        const option = document.createElement("option");
        option.value = eventosachado.nmevento;
        option.text = eventosachado.nmevento;
        select.appendChild(option);
    });
 
    return select;
}

if (!window.ultimoClique) {
    window.ultimoClique = null;
  
}
// Captura o último elemento clicado no documento (uma única vez)
document.addEventListener("mousedown", (e) => {
    window.ultimoClique = e.target;
});

function adicionarEventoBlurEvento() {
    const input = document.querySelector("#nmEvento");
    if (!input) return;

    input.addEventListener("blur", async function () {
        
        const botoesIgnorados = ["Limpar", "Pesquisar", "Enviar"];
        const ehBotaoIgnorado =
            ultimoClique?.id && botoesIgnorados.includes(ultimoClique.id) ||
             (ultimoClique?.classList && ultimoClique.classList.contains("close"));

        if (ehBotaoIgnorado) {
            console.log("🔁 Blur ignorado: clique em botão de controle (Fechar/Limpar/Pesquisar).");
            return;
        }

        const desc = this.value.trim();
        console.log("Campo nmEvento procurado:", desc);

        if (!desc) return;

        try {
            await carregarEventoDescricao(desc, this);
            console.log("Evento selecionado depois de carregarEventoDescricao:", this.value);
        } catch (error) {
            console.error("Erro ao buscar Evento:", error);
        }
    });
}

// async function carregarEventoDescricao(desc, elementoAtual) {
//     try {
//         const eventos = await fetchComToken(`/eventos?nmEvento=${encodeURIComponent(desc)}`);
//        // console.log("Resposta do servidor:", response);
       
//         document.querySelector("#idEvento").value = eventos.idevento;

//         window.EventoOriginal = {
//             idEvento: eventos.idevento,
//             nmEvento: eventos.nmevento
//         };

//         console.log("Evento encontrado:", EventoOriginal);

//     } catch (error) {
//         console.warn("Evento não encontrado.");

//         const inputIdEvento = document.querySelector("#idEvento");
//         const podeCadastrarEvento = temPermissao("Eventos", "cadastrar");

//        if (!inputIdEvento.value && podeCadastrarEvento) {
//              const resultado = await Swal.fire({
//                 icon: 'question',
//                 title: `Deseja cadastrar "${desc.toUpperCase()}" como novo Evento?`,
//                 text: `Evento "${desc.toUpperCase()}" não encontrado.`,
//                 showCancelButton: true,
//                 confirmButtonText: "Sim, cadastrar",
//                 cancelButtonText: "Cancelar",
//                 reverseButtons: true,
//                 focusCancel: true
//             });

            
//             if (!resultado.isConfirmed) {
//                 console.log("Usuário cancelou o cadastro do Evento.");
//                 elementoAtual.value = ""; // Limpa o campo se não for cadastrar
//                 setTimeout(() => {
//                     elementoAtual.focus();
//                 }, 0);
//                 return;
//             }
//         } else if (!podeCadastrarEvento) {
//             Swal.fire({
//                 icon: "info",
//                 title: "Evento não cadastrado",
//                 text: "Você não tem permissão para cadastrar eventos.",
//                 confirmButtonText: "OK"
//             });
//         }
        
//     }
// }

async function carregarEventoDescricao(desc, elementoAtual) {
    try {
        const eventos = await fetchComToken(`/eventos?nmEvento=${encodeURIComponent(desc)}`);

        // Limpar o estado anterior antes de carregar o novo
        limparCamposEvento();
        
        document.querySelector("#idEvento").value = eventos.idevento;
        document.querySelector("#nmEvento").value = eventos.nmevento; // ✅ Certifique-se de preencher o input com o nome retornado
        
        window.EventoOriginal = {
            idEvento: eventos.idevento,
            nmEvento: eventos.nmevento,
            clientes: eventos.clientes // ✅ Armazena o array de clientes originais
        };

        // ✅ Chamar uma função para carregar os clientes no container
        await carregarClientesSelecionados(eventos.clientes);

        console.log("Evento encontrado:", window.EventoOriginal);

    } catch (error) {
        console.warn("Evento não encontrado.");

        const inputIdEvento = document.querySelector("#idEvento");
        const podeCadastrarEvento = temPermissao("Eventos", "cadastrar");
        
        // Se o evento não for encontrado, garantimos que os campos estão limpos
       // limparCamposEvento();

        if (!podeCadastrarEvento) {
            Swal.fire({
                icon: "info",
                title: "Evento não cadastrado",
                text: "Você não tem permissão para cadastrar eventos.",
                confirmButtonText: "OK"
            });
            elementoAtual.value = "";
            return;
        }

        const resultado = await Swal.fire({
            icon: 'question',
            title: `Deseja cadastrar "${desc.toUpperCase()}" como novo Evento?`,
            text: `Evento "${desc.toUpperCase()}" não encontrado.`,
            showCancelButton: true,
            confirmButtonText: "Sim, cadastrar",
            cancelButtonText: "Cancelar",
            reverseButtons: true,
            focusCancel: true
        });

        if (!resultado.isConfirmed) {
            console.log("Usuário cancelou o cadastro do Evento.");
            elementoAtual.value = "";
            setTimeout(() => {
                elementoAtual.focus();
            }, 0);
        }
    }
}

async function carregarClientesSelecionados(clientesIds) {
    if (!clientesIds || clientesIds.length === 0) {
        return;
    }

    const clientesContainer = document.getElementById("clientesSelecionadosContainer");
    const clientesInput = document.getElementById("clientesDoEvento");
    const clientesSelecionadosSet = new Set(clientesIds);
    const botaoEnviar = document.getElementById("Enviar");
    
    clientesContainer.innerHTML = '';
    clientesInput.value = JSON.stringify(clientesIds);

    try {
        const clientesDisponiveis = await fetchComToken('/clientes');
        
        clientesIds.forEach(id => {
            const cliente = clientesDisponiveis.find(c => c.idcliente === id);
            if (cliente) {
                // ✅ A variável 'tag' é criada aqui
                const tag = document.createElement('span');
                tag.className = 'cliente-tag';
                const nomeCliente = cliente.nmfantasia;
                const idCliente = cliente.idcliente;
                tag.innerHTML = `${nomeCliente} <button type="button" class="remover-cliente" data-id="${idCliente}">x</button>`;
                clientesContainer.appendChild(tag);
                
                // ✅ O event listener deve ser definido aqui, onde 'tag' está no escopo
                tag.querySelector('.remover-cliente').addEventListener('click', async () => {
                    const { isConfirmed } = await Swal.fire({
                        title: "Remover cliente?",
                        text: `Deseja realmente remover o cliente "${nomeCliente}" deste evento?`,
                        icon: "warning",
                        showCancelButton: true,
                        confirmButtonColor: '#d33',
                        cancelButtonColor: '#3085d6',
                        confirmButtonText: "Sim, remover!",
                        cancelButtonText: "Cancelar"
                    });
                    if (isConfirmed) {
                        const clientesSelecionadosSet = new Set(JSON.parse(clientesInput.value));
                        clientesSelecionadosSet.delete(idCliente);
                        tag.remove();
                        clientesInput.value = JSON.stringify(Array.from(clientesSelecionadosSet));
                        botaoEnviar.click();
                    }
                });
            }
        });
    } catch (error) {
        console.error("Erro ao carregar os clientes selecionados:", error);
    }
}


function limparEventoOriginal() {
    EventoOriginal = {
        idEvento: "",
        nmEvento: ""       
    };
}



function limparCamposEvento() {
    
    const idEvent = document.getElementById("idEvento");
    const descEventEl = document.getElementById("nmEvento");
    
    const clientesSelecionadosContainer = document.getElementById("clientesSelecionadosContainer"); // ✅
    const clientesDoEventoInput = document.getElementById("clientesDoEvento"); // ✅

    if (idEvent) {idEvent.value = "";}

    if (clientesSelecionadosContainer) {
        clientesSelecionadosContainer.innerHTML = "";
    }

    // ✅ Zera o input oculto com os IDs dos clientes
    if (clientesDoEventoInput) {
        clientesDoEventoInput.value = "[]";
    }
   

    if (descEventEl && descEventEl.tagName === "SELECT") {
        // Se for SELECT, trocar por INPUT
        const novoInput = document.createElement("input");
        novoInput.type = "text";
        novoInput.id = "nmEvento";
        novoInput.name = "nmEvento";
        novoInput.required = true;
        novoInput.className = "form";

        // Configura o evento de transformar texto em maiúsculo
        novoInput.addEventListener("input", function () {
            this.value = this.value.toUpperCase();
        });

        // Reativa o evento blur
        novoInput.addEventListener("blur", async function () {
            if (!this.value.trim()) return;
            await carregarEventoDescricao(this.value, this);
        });

        descEventEl.parentNode.replaceChild(novoInput, descEventEl);
        adicionarEventoBlurEvento();

        const label = document.querySelector('label[for="nmEvento"]');
        if (label) {
            label.style.display = "block";
            label.textContent = "Descrição do Evento";
        }
    } else if (descEventEl) {
        // Se for input normal, só limpa
        descEventEl.value = "";
    }
}

// async function fetchComToken(url, options = {}) {
//   console.log("URL da requisição:", url);
//   const token = localStorage.getItem("token");
//   const idempresa = localStorage.getItem("idempresa");

//   console.log("ID da empresa no localStorage:", idempresa);
//   console.log("Token no localStorage:", token);

//   if (!options.headers) options.headers = {};
  
//   if (options.body && typeof options.body === 'string' && options.body.startsWith('{')) {
//         options.headers['Content-Type'] = 'application/json';
//   }else if (options.body && typeof options.body === 'object' && options.headers['Content-Type'] !== 'multipart/form-data') {
       
//         options.body = JSON.stringify(options.body);
//         options.headers['Content-Type'] = 'application/json';
//   }

//   options.headers['Authorization'] = 'Bearer ' + token; 

//   if (
//       idempresa && 
//       idempresa !== 'null' && 
//       idempresa !== 'undefined' && 
//       idempresa.trim() !== '' &&
//       !isNaN(idempresa) && 
//       Number(idempresa) > 0
//   ) {
//       options.headers['idempresa'] = idempresa;
//       console.log('[fetchComToken] Enviando idempresa no header:', idempresa);
//   } else {
//     console.warn('[fetchComToken] idempresa inválido, não será enviado no header:', idempresa);
//   }
//   console.log("URL OPTIONS", url, options)
 
//   const resposta = await fetch(url, options);

//   console.log("Resposta da requisição Eventos.js:", resposta);

//   let responseBody = null;
//   try {     
//       responseBody = await resposta.json();
//   } catch (jsonError) {    
//       try {
//           responseBody = await resposta.text();
//       } catch (textError) {        
//           responseBody = null;
//       }
//   }

//   if (resposta.status === 401) {
//     localStorage.clear();
//     Swal.fire({
//       icon: "warning",
//       title: "Sessão expirada",
//       text: "Por favor, faça login novamente."
//     }).then(() => {
//       window.location.href = "login.html"; 
//     });
   
//     throw new Error('Sessão expirada'); 
//   }

//   if (!resposta.ok) {        
//         const errorMessage = (responseBody && responseBody.erro) || (responseBody && responseBody.message) || responseBody || resposta.statusText;
//         throw new Error(`Erro na requisição: ${errorMessage}`);
//   }

//   return responseBody;
// }

function configurarEventosCadEvento() {
    console.log("Configurando eventos Evento...");
    verificaEvento(); // Carrega os Evento ao abrir o modal
    adicionarEventoBlurEvento();
    console.log("Entrou configurar Evento no EVENTOS.js.");
}
window.configurarEventosCadEvento = configurarEventosCadEvento;

function configurarEventosEspecificos(modulo) {
  console.log("⚙️ configurarEventosEspecificos recebeu:", modulo);
  if (modulo.trim().toLowerCase() === 'eventos') {
    configurarEventosCadEvento();
    
    if (typeof aplicarPermissoes === "function" && window.permissoes) {
      aplicarPermissoes(window.permissoes);
    } else {
      console.warn("⚠️ aplicarPermissoes ou window.permissoes ainda não estão disponíveis para LocalMontagem.");
    }
  }
}
window.configurarEventosEspecificos = configurarEventosEspecificos;


window.moduloHandlers = window.moduloHandlers || {};

window.moduloHandlers['Eventos'] = { // A chave 'Eventos' (com E maiúsculo) deve corresponder ao seu Index.js
    configurar: configurarEventosCadEvento,
    desinicializar: desinicializarEventoModal
};