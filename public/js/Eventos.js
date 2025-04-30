// if (typeof Swal === "undefined") {
//     const script = document.createElement("script");
//     script.src = "https://cdn.jsdelivr.net/npm/sweetalert2@11";
//     script.onload = () => {
//         console.log("SweetAlert2 carregado com sucesso.");
//     };
//     document.head.appendChild(script);
// }

let EventoOriginal = {
    idEvento: "",
    descEvento: ""
   
};

function verificaEvento() {

    console.log("Carregando Evento...");
    
    document.querySelector("#nmEvento").addEventListener("blur", async function () {
        const desc = this.value.trim();

        console.log("Campo descEvento procurado:", desc);
    
        if (desc === "") return;
    
        try {
            if (!desc) {
                console.warn("Valor do select está vazio ou indefinido.");
                return;
            }

            console.log("Selecionado:", desc);

            await carregarEventoDescricao(desc, this);
            console.log("Função selecionado depois de carregarEventoDescricao:", this.value);
         

        } catch (error) {
            console.error("Erro ao buscar Função:", error);
        }

    });

    const botaoEnviar = document.querySelector("#Enviar");
    const botaoPesquisar = document.querySelector("#Pesquisar");
    const form = document.querySelector("#form");
    const botaoLimpar = document.querySelector("#Limpar");

    if (!botaoEnviar || !form) {
        console.error("Formulário ou botão não encontrado no DOM.");
        return;
    }

    botaoLimpar.addEventListener("click", function (event) {
        event.preventDefault(); // Previne o envio padrão do formulário 

        limparCamposEvento();

    });

    botaoEnviar.addEventListener("click", async function (event) {
        event.preventDefault(); // Previne o envio padrão do formulário

        console.log("ENVIANDO DADOS DO Evento PELO Evento.JS", document);

        const idEvento = document.querySelector("#idEvento").value.trim();
        const descEvento = document.querySelector("#nmEvento").value.trim();
    
    
        if (!descEvento ) {
           
            Swal.fire({
                icon: 'warning',
                title: 'Campos obrigatórios!',
                text: 'Preencha todos os campos antes de enviar.',
                confirmButtonText: 'Entendi'
            });
            return;
        }
        console.log("Valores do Evento:", idEvento, descEvento);
        console.log("Valores do Evento Original:", EventoOriginal.idEvento, EventoOriginal.descEvento);
    
        // Comparar com os valores originais
        if (
            parseInt(idEvento) === parseInt(EventoOriginal.idEvento) && 
            descEvento === EventoOriginal.descEvento
           
        ) {
            console.log("Nenhuma alteração detectada.");
            await Swal.fire({
                icon: 'info',
                title: 'Nenhuma alteração foi detectada!',
                text: 'Faça alguma alteração antes de salvar.',
                confirmButtonText: 'Entendi'
            });
            return;
        }
    
        const dados = { descEvento };

        console.log("Dados a serem enviados:", idEvento);
     
        if (idEvento) {
            Swal.fire({
                title: "Deseja salvar as alterações?",
                text: "Você está prestes a atualizar os dados do evento.",
                icon: "question",
                showCancelButton: true,
                confirmButtonText: "Sim, salvar",
                cancelButtonText: "Cancelar",
                reverseButtons: true,
                focusCancel: true
                
            }).then(async (result) => {
                if (result.isConfirmed) {
                    try {
                        const response = await fetch(`http://localhost:3000/eventos/${idEvento}`, {
                            method: "PUT",
                            headers: {
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify(dados)
                        });
        
                        const resultJson = await response.json();
        
                        if (response.ok) {
                            document.getElementById('form').reset();
                            Swal.fire("Sucesso!", resultJson.mensagem || "Alterações salvas com sucesso!", "success");
                            //form.reset();
                            document.querySelector("#idEvento").value = "";
                            limparEventoOriginal();  
                        } else {
                            Swal.fire("Erro", resultJson.erro || "Erro ao salvar o Função.", "error");
                        }
                    } catch (error) {
                        console.error("Erro ao enviar dados:", error);
                        Swal.fire("Erro de conexão", "Não foi possível conectar ao servidor.", "error");
                    }
                } else {
                    console.log("Usuário cancelou a alteração.");
                }
            });
        } else {
            // Se for novo, salva direto
            try {
                const response = await fetch("http://localhost:3000/eventos", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(dados)
                });
        
                const resultJson = await response.json();
        
                if (response.ok) {
                    Swal.fire("Sucesso!", resultJson.mensagem || "Evento cadastrado!", "success");
                    form.reset();
                    limparEventoOriginal();
                    document.querySelector("#idEvento").value = "";
                } else {
                    Swal.fire("Erro", resultJson.erro || "Erro ao cadastrar o Evento.", "error");
                }
            } catch (error) {
                console.error("Erro ao enviar dados:", error);
                Swal.fire("Erro de conexão", "Não foi possível conectar ao servidor.", "error");
            }
        }
    });
    
    botaoPesquisar.addEventListener("click", async function (event) {
        event.preventDefault();
        limparCamposEvento();
        console.log("Pesquisando Evento...");
        try {
            const response = await fetch("http://localhost:3000/eventos"); // ajuste a rota conforme sua API
            if (!response.ok) throw new Error("Erro ao buscar Eventos");
    
            const eventos = await response.json();

            console.log("Eventos encontradas:", eventos);

            const select = criarSelectEvento(eventos);
            limparCamposEvento();
            const input = document.querySelector("#nmEvento");
               
            if (input && input.parentNode) {
                input.parentNode.replaceChild(select, input);
            }
   
            const label = document.querySelector('label[for="nmEvento"]');
            if (label) {
              label.style.display = "none"; // ou guarda o texto, se quiser restaurar exatamente o mesmo
            }
    
            // Reativar o evento blur para o novo select
            select.addEventListener("change", async function () {
                const desc = this.value?.trim();
               
                if (!desc) {
                    console.warn("Valor do select está vazio ou indefinido.");
                    return;
                }

                await carregarEventoDescricao(desc, this);

                const novoInput = document.createElement("input");
                novoInput.type = "text";
                novoInput.id = "nmEvento";
                novoInput.name = "nmEvento";
                novoInput.required = true;
                novoInput.className = "form";
                novoInput.value = desc;
            
                novoInput.addEventListener("input", function() {
                    this.value = this.value.toUpperCase(); // transforma o texto em maiúsculo à medida que o usuário digita
                });

                this.parentNode.replaceChild(novoInput, this);
               
                const label = document.querySelector('label[for="nmEvento"]');
                if (label) {
                label.style.display = "block";
                label.textContent = "Descrição do Evento"; // ou algum texto que você tenha guardado
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

async function carregarEventoDescricao(desc, elementoAtual) {
    
    try {
        const response = await fetch(`http://localhost:3000/eventos?nmEvento=${encodeURIComponent(desc)}`);
        console.log("Resposta do servidor:", response);
        if (!response.ok) throw new Error();

        const eventos = await response.json();
        console.log("Resposta json:", eventos);
        document.querySelector("#idEvento").value = eventos.idevento;
       
      
        EventoOriginal = {
            idEvento: eventos.idevento,
            descEvento: eventos.nmevento
           
        };
   
        console.log("Evento encontrado:", EventoOriginal);
    } catch (error) {
    
        if (!idEvento.value) {
      
            const resultado = Swal.fire({
                icon: 'question',
                title: `Deseja cadastrar "${desc.toUpperCase()}" como novo Evento?`,
                text: `Evento "${desc.toUpperCase()}" não encontrado`,
                showCancelButton: true,
                confirmButtonText: 'Sim, cadastrar',
                cancelButtonText: 'Cancelar'
            });
        
        }
    }
}



function limparEventoOriginal() {
    EventoOriginal = {
        idEvento: "",
        descEvento: ""
       
    };
}



function limparCamposEvento() {
    const campos = ["idEvento", "nmEvento" ];
    campos.forEach(id => {
        const campo = document.getElementById(id);
        if (campo) campo.value = "";
    });
}

function configurarEventosCadEvento() {
    console.log("Configurando eventos Evento...");
    verificaEvento(); // Carrega os Evento ao abrir o modal
    console.log("Entrou configurar Evento no EVENTOS.js.");
    

} 
window.configurarEventosCadEvento = configurarEventosCadEvento;
