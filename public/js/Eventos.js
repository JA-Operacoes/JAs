import { fetchComToken, aplicarTema } from '../utils/utils.js';


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
});

let nmEventoInputListener = null; 
let nmEventoBlurListener = null; 
let limparEventoButtonListener = null;
let enviarEventoButtonListener = null;
let pesquisarEventoButtonListener = null;
let selectEventoChangeListener = null;
let novoInputNmEventoInputListener = null; 
let novoInputNmEventoBlurListener = null; 
let clientesSelecionados = new Set();

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


    //const clientesSelecionados = new Set(); // Use um Set para evitar clientes duplicados
    const selectCliente = document.getElementById("selectCliente");
    selectCliente.disabled = true;
    selectCliente.title = "Preencha o nome do evento primeiro";

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
                headers: { 'Content-Type': 'application/json' },
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
        
        // 💡 CORREÇÃO: Chama resetarCampoNmEventoParaInput() para garantir que o campo seja INPUT
        // antes da pesquisa. Isso evita o bug de um 'select' duplicado se você clicar duas vezes.
        resetarCampoNmEventoParaInput();

        console.log("Pesquisando Evento...");

        const temPermissaoPesquisar = temPermissao('Eventos', 'pesquisar');
        if (!temPermissaoPesquisar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para pesquisar.", "warning");
        }

        console.log("Pesquisando Evento...");

        try {
            const eventos = await fetchComToken("/eventos");

            if (!eventos || eventos.length === 0) {
                return Swal.fire({
                    icon: 'info',
                    title: 'Nenhum evento cadastrado',
                    text: 'Não foi encontrado nenhum evento no sistema.',
                    confirmButtonText: 'Ok'
                });
            }

            const select = criarSelectEvento(eventos);

            limparCamposEvento();
            const input = document.querySelector("#nmEvento");

            if (input && input.parentNode) {
                // Remove listeners do input antes de substituir
                if (nmEventoInputListener) {
                    input.removeEventListener("input", nmEventoInputListener);
                    nmEventoInputListener = null;
                }
                if (nmEventoBlurListener) {
                    input.removeEventListener("blur", nmEventoBlurListener);
                    nmEventoBlurListener = null;
                }

                input.parentNode.replaceChild(select, input);
            }

            const label = document.querySelector('label[for="nmEvento"]');
            if (label) label.style.display = "none";

            // 💡 CORREÇÃO APLICADA AQUI
            select.addEventListener("change", async function () {
                const desc = this.value?.trim();
                if (!desc) return;

                // 1. Carrega os dados do Evento selecionado
                await carregarEventoDescricao(desc, this);
                
                // 2. Transforma o select de volta para um input para permitir a edição
                //    e re-adiciona os listeners de blur/input.
                resetarCampoNmEventoParaInput();
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
    
    if (nmEventoInputListener) { 
        inputElement.removeEventListener("input", nmEventoInputListener);
    }
    nmEventoInputListener = function () { 
        this.value = this.value.toUpperCase();
        const selectCliente = document.getElementById("selectCliente");
        if (this.value.trim()) {
            selectCliente.disabled = false;
            selectCliente.title = "";
        } else {
            selectCliente.disabled = true;
            selectCliente.title = "Preencha o nome do evento primeiro";
        }
    };
    inputElement.addEventListener("input", nmEventoInputListener);

    // Configura o listener de BLUR (carregarEventoDescricao)
    // if (nmEventoBlurListener) { 
    //     inputElement.removeEventListener("blur", nmEventoBlurListener);
    // }
    // nmEventoBlurListener = async function () { 
    //     if (!this.value.trim()) return;
    //     console.log("Campo nmEvento procurado (blur dinâmico):", this.value);
        
    //     // 💡 ATENÇÃO: Chama carregarEventoDescricao, mas a lógica de ignorar clique está no final do arquivo
    //     await carregarEventoDescricao(this.value, this); 
    // };
    // inputElement.addEventListener("blur", nmEventoBlurListener);
}

function resetarCampoNmEventoParaInput() {
    const nmEventoCampo = document.getElementById("nmEvento");
    // Verifica se o campo atual é um select e o substitui por um input
    if (nmEventoCampo && nmEventoCampo.tagName.toLowerCase() === "select") {
        const input = document.createElement("input");
        input.type = "text";
        input.id = "nmEvento";
        input.name = "nmEvento";
        input.value = nmEventoCampo.value || ""; // Mantém o valor selecionado
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
        
        // Garante que o input seja populado com o valor de EventoOriginal
        const nomeOriginal = window.EventoOriginal?.nmEvento || "";
        if (input.value === "" && nomeOriginal) {
             input.value = nomeOriginal;
        }

        adicionarListenersAoInputNmEvento(input); // Adiciona os listeners ao novo input
        
        const label = document.querySelector('label[for="nmEvento"]');
        if (label) {
            label.style.display = "block";
            label.textContent = "Nome do Evento";
        }
        
        // 💡 REATIVAÇÃO DO BLUR: Como o input foi recriado, o listener de blur deve ser reativado
        // usando a lógica de ignorar o clique de botões.
        adicionarEventoBlurEvento();
        
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

    // 💡 REMOVE O LISTENER ANTERIOR PARA EVITAR DUPLICIDADE
    if (nmEventoBlurListener) { 
        input.removeEventListener("blur", nmEventoBlurListener);
    }
    
    nmEventoBlurListener = async function () { // Atribui à variável global
        
        const botoesIgnorados = ["Limpar", "Pesquisar", "Enviar"];
        const ehBotaoIgnorado =
            window.ultimoClique?.id && botoesIgnorados.includes(window.ultimoClique.id) ||
             (window.ultimoClique?.classList && (window.ultimoClique.classList.contains("close") || window.ultimoClique.classList.contains("remover-cliente")));

        if (ehBotaoIgnorado) {
            console.log("🔁 Blur ignorado: clique em botão de controle (Enviar/Fechar/Limpar/Pesquisar).");
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
    };
    input.addEventListener("blur", nmEventoBlurListener);
}


async function carregarEventoDescricao(desc, elementoAtual) {
    try {
        const eventos = await fetchComToken(`/eventos?nmEvento=${encodeURIComponent(desc)}`);

        // Limpar o estado anterior antes de carregar o novo (opcional, pode ser comentado)
        //limparCamposEvento();
        
        if (!eventos || !eventos.idevento) throw new Error("Evento não encontrado");

        document.querySelector("#idEvento").value = eventos.idevento;
        document.querySelector("#nmEvento").value = eventos.nmevento; 

        const selectCliente = document.getElementById("selectCliente");
        selectCliente.disabled = false;
        selectCliente.title = "";
        
        window.EventoOriginal = {
            idEvento: eventos.idevento,
            nmEvento: eventos.nmevento,
            clientes: eventos.clientes 
        };

        await carregarClientesSelecionados(eventos.clientes);

        console.log("Evento encontrado:", window.EventoOriginal);

    } catch (error) {
        console.warn("Evento não encontrado.");

        const inputIdEvento = document.querySelector("#idEvento");
        const podeCadastrarEvento = temPermissao("Eventos", "cadastrar");
        
        // Se o evento não for encontrado, garantimos que o ID está limpo
        inputIdEvento.value = "";
        
        if (!podeCadastrarEvento) {
            Swal.fire({
                icon: "info",
                title: "Evento não cadastrado",
                text: "Você não tem permissão para cadastrar eventos.",
                confirmButtonText: "OK"
            });
            // 💡 Se não pode cadastrar, não limpamos o valor, apenas retornamos
            // elementoAtual.value = ""; 
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

        if (resultado.isConfirmed) {
            // ✅ Confirmou cadastro — habilita o select de clientes
            const selectCliente = document.getElementById("selectCliente");
            selectCliente.disabled = false;
            selectCliente.title = "";
        } else {
            console.log("Usuário cancelou o cadastro do Evento.");           
            setTimeout(() => {
                elementoAtual.focus();
            }, 0);
        }
    }
}

async function carregarClientesSelecionados(clientesIds) {
    if (!clientesIds || clientesIds.length === 0) {
        // Limpar o container se não houver clientes
        document.getElementById("clientesSelecionadosContainer").innerHTML = '';
        document.getElementById("clientesDoEvento").value = "[]";
        clientesSelecionados.clear(); 
        return;
    }

    const clientesContainer = document.getElementById("clientesSelecionadosContainer");
    const clientesInput = document.getElementById("clientesDoEvento");
    const botaoEnviar = document.getElementById("Enviar");

    clientesSelecionados.clear();
    clientesIds.forEach(id => clientesSelecionados.add(String(id)));
    clientesInput.value = JSON.stringify(Array.from(clientesSelecionados));
    
    clientesContainer.innerHTML = '';
    //clientesInput.value = JSON.stringify(clientesIds);

    try {
        const clientesDisponiveis = await fetchComToken('/eventos/clientes');
        
        clientesIds.forEach(id => {
            const cliente = clientesDisponiveis.find(c => String(c.idcliente) === String(id));
            if (cliente) {
                const tag = document.createElement('span');
                tag.className = 'cliente-tag';
                const nomeCliente = cliente.nmfantasia;
                const idCliente = cliente.idcliente;
                tag.innerHTML = `${nomeCliente} <button type="button" class="remover-cliente" data-id="${idCliente}">x</button>`;
                clientesContainer.appendChild(tag);
                
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
                        // const clientesSelecionadosSet = new Set(JSON.parse(clientesInput.value));
                        // clientesSelecionadosSet.delete(idCliente);
                        // tag.remove();
                        // clientesInput.value = JSON.stringify(Array.from(clientesSelecionadosSet));
                        // botaoEnviar.click();
                        clientesSelecionados.delete(String(idCliente));
                        tag.remove();
                        clientesInput.value = JSON.stringify(Array.from(clientesSelecionados));
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
    
    clientesSelecionados.clear();

    const selectCliente = document.getElementById("selectCliente");
    if (selectCliente) {
        selectCliente.disabled = true;
        selectCliente.title = "Preencha o nome do evento primeiro";
    }

    const idEvent = document.getElementById("idEvento");
    const descEventEl = document.getElementById("nmEvento");
    
    const clientesSelecionadosContainer = document.getElementById("clientesSelecionadosContainer");
    const clientesDoEventoInput = document.getElementById("clientesDoEvento");

    if (idEvent) {idEvent.value = "";}

    if (clientesSelecionadosContainer) {
        clientesSelecionadosContainer.innerHTML = "";
    }

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

        // Configura os eventos
        adicionarListenersAoInputNmEvento(novoInput);

        descEventEl.parentNode.replaceChild(novoInput, descEventEl);
        adicionarEventoBlurEvento(); // Reativa o blur listener no novo input

        const label = document.querySelector('label[for="nmEvento"]');
        if (label) {
            label.style.display = "block";
            label.textContent = "Descrição do Evento";
        }
    } else if (descEventEl) {
        // Se for input normal, só limpa
        descEventEl.value = "";
    }
    
    // Zera o estado original
    limparEventoOriginal();
}


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