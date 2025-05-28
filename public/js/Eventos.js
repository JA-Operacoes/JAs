
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

    if (!botaoEnviar || !form) {
        console.error("Formulário ou botão não encontrado no DOM.");
        return;
    }

    botaoLimpar.addEventListener("click", (e) => {
        e.preventDefault();
        limparCamposEvento();
    });

    botaoEnviar.addEventListener("click", async (event) => {
        event.preventDefault();

        const idEvento = document.querySelector("#idEvento").value.trim();
        const nmEvento = document.querySelector("#nmEvento").value.toUpperCase().trim();
        
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

        if (!nmEvento) {
            return Swal.fire("Campos obrigatórios!", "Preencha todos os campos antes de enviar.", "warning");
        }

        const dados = { nmEvento};        

        if (parseInt(idEvento) === parseInt(window.EventoOriginal?.idEvento)) {
            console.log("Evento não alterado, não será enviado.");
        }
        if (nmEvento === window.EventoOriginal?.nmEvento ) {
            console.log("Evento não alterado, não será enviado.");
        }
        // Verifica alterações
        if (
            
            parseInt(idEvento) === parseInt(window.EventoOriginal?.idEvento) &&
            nmEvento === window.EventoOriginal?.nmEvento  
        ) {
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

            const res = await fetchComToken(url, {
                method: metodo,
                body: JSON.stringify(dados)
            });

            const texto = await res.text();
            let json;
            try {
                json = JSON.parse(texto);
            } catch (e) {
                throw new Error("Resposta não é um JSON válido: " + texto);
            }

            if (!res.ok) throw new Error(json.erro || json.message || "Erro ao salvar evento");

            await Swal.fire("Sucesso!", json.message || "Evento salvo com sucesso.", "success");
            document.getElementById("form").reset();
            document.querySelector("#idEvento").value = "";
            limparEventoOriginal();

        } catch (error) {
            console.error("Erro ao enviar dados:", error);
            Swal.fire("Erro", error.message || "Erro ao salvar Evento.", "error");
        }
    });

    botaoPesquisar.addEventListener("click", async function (event) {
        event.preventDefault();
        limparCamposEvento();

        console.log("Pesquisando Evento...");

        const temPermissaoPesquisar = temPermissao('Eventos', 'pesquisar');
        if (!temPermissaoPesquisar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para pesquisar.", "warning");
        }

        console.log("Pesquisando Evento...");

        try {
            const response = await fetchComToken("/eventos");
            if (!response.ok) throw new Error("Erro ao buscar Eventos");

            const eventos = await response.json();
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

                this.parentNode.replaceChild(novoInput, this);
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

function adicionarEventoBlurEvento() {
    const input = document.querySelector("#nmEvento");
    if (!input) return;

    let ultimoClique = null;

    // Captura o último elemento clicado no documento
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

async function carregarEventoDescricao(desc, elementoAtual) {
    try {
        const response = await fetchComToken(`/eventos?nmEvento=${encodeURIComponent(desc)}`);
        console.log("Resposta do servidor:", response);

        if (!response.ok) throw new Error();

        const eventos = await response.json();
        console.log("Resposta json:", eventos);

        document.querySelector("#idEvento").value = eventos.idevento;

        window.EventoOriginal = {
            idEvento: eventos.idevento,
            nmEvento: eventos.nmevento
        };

        console.log("Evento encontrado:", EventoOriginal);

    } catch (error) {
        console.warn("Evento não encontrado.");

        const inputIdEvento = document.querySelector("#idEvento");
        const podeCadastrarEvento = temPermissao("Eventos", "cadastrar");

       if (!inputIdEvento.value && podeCadastrarEvento) {
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
                elementoAtual.value = ""; // Limpa o campo se não for cadastrar
                setTimeout(() => {
                    elementoAtual.focus();
                }, 0);
                return;
            }
        } else if (!podeCadastrarEvento) {
            Swal.fire({
                icon: "info",
                title: "Evento não cadastrado",
                text: "Você não tem permissão para cadastrar eventosquipamentos.",
                confirmButtonText: "OK"
            });
        }
        
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
    

    if (idEvent) idEvent.value = "";
   

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

function fetchComToken(url, options = {}) {
  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("fetchComToken: nenhum token encontrado. Faça login primeiro.");
  }

  // Monta os headers sempre incluindo Authorization
  const headers = {
    "Authorization": `Bearer ${token}`,
    // só coloca Content-Type se houver body (POST/PUT)
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...options.headers
  };

  return fetch(url, {
    ...options,
    headers,
    // caso seu back-end esteja em outro host e precisa de CORS:
    //mode: "cors",
    // se precisar enviar cookies de sessão:
    credentials: "include"
  });
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
  }
}
window.configurarEventosEspecificos = configurarEventosEspecificos;
