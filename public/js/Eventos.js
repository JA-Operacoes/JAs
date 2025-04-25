let EventoExistente = false;
let EventoOriginal = {
    idEvento: "",
    nmEvento: ""
   
};

function verificaEvento() {

    console.log("Carregando Evento...");
    
    document.querySelector("#nmEvento").addEventListener("blur", async function () {
        const desc = this.value.trim();

        console.log("Campo nmEvento procurado:", desc);
    
        if (desc === "") return;
    
        try {
            const response = await fetch(`http://localhost:3000/eventos?nmEvento=${encodeURIComponent(desc)}`);

            
            if (!response.ok) {
                console.log("Evento não encontrado.");
                limparEventoOriginal();
                EventoExistente = false;
                return;
            }
    
            const Evento = await response.json();

            if (!Evento || Object.keys(Evento).length === 0) {
                console.log("Cliente não encontrado no corpo da resposta.");
                Swal.fire({
                    icon: 'warning',
                    title: 'Cliente não encontrado',
                    text: `Nenhum cliente com o nome fantasia "${nmFantasia}" foi encontrado.`,
                    confirmButtonText: 'Ok'
                });
                limparEventoOriginal();
                EventoExistente = false;
                return;
            }
            else{
                EventoExistente = true; // Define que o cliente existe 
            }
            
            if (EventoExistente){

                console.log("Evento encontrado:", Evento);
                console.log("Campos encontrados:", {
                    idEvento: document.querySelector("#idEvento")
                    
                });

                // Preenche os campos com os dados retornados
                document.querySelector("#idEvento").value = Evento.idfuncao; // se existir o campo
               

                EventoOriginal = {
                    idEvento: Evento.idEvento,
                    nmEvento: Evento.nmEvento
                   
                };
        
                console.log("Evento encontrado e preenchido:", Evento);
            }
        } catch (error) {
            console.error("Erro ao buscar Evento:", error);
        }
    });

    const botaoEnviar = document.querySelector("#Enviar");
    const botaoPesquisar = document.querySelector("#Pesquisar");
    const form = document.querySelector("#form");

    if (!botaoEnviar || !form) {
        console.error("Formulário ou botão não encontrado no DOM.");
        return;
    }

    botaoEnviar.addEventListener("click", async function (event) {
        event.preventDefault(); // Previne o envio padrão do formulário

        console.log("ENVIANDO DADOS DO Evento PELO Evento.JS", document);

        const idEvento = document.querySelector("#idEvento").value.trim();
        const nmEvento = document.querySelector("#nmEvento").value.trim();
           
        if (!nmEvento || !vlrCusto || !vlrVenda) {
            alert("Preencha todos os campos.");
            return;
        }
    
        // 🔍 Comparar com os valores originais
        if (
            idEvento === EventoOriginal.idEvento &&
            nmEvento === EventoOriginal.nmEvento 
          
        ) {
            //  alert("Nenhuma alteração detectada.");
            // Swal.fire({
            //     icon: 'info', // info | success | warning | error | question
            //     title: 'Nada foi alterado!',
            //     text: 'Faça alguma alteração antes de salvar.',
            //     confirmButtonText: 'Entendi'
            // });
            mostrarAlerta();
             
            console.log("Nenhuma alteração detectada.");
            return;
        }
    
        const dados = { nmEvento };

        
        
    
        try {
            let response;
            console.log("idEvento", idEvento);
            if (idEvento) {

                response = await fetch(`http://localhost:3000/funcao/${idEvento}`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(dados)
                });
            } else {
                response = await fetch("http://localhost:3000/salvarEvento", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(dados)
                });
            }
    
            const result = await response.json();
    
            if (response.ok) {
                alert(result.mensagem || "Operação realizada com sucesso!");
                form.reset();
                document.querySelector("#idEvento").value = "";
    
                // Zera os valores antigos após salvar
                limparEventoOriginal();
                EventoExistente = false;
               
            } else {
                alert(result.erro || "Erro ao salvar o Evento.");
            }
    
        } catch (error) {
            console.error("Erro ao enviar dados:", error);
            alert("Erro de conexão com o servidor.");
        }
    });

    botaoPesquisar.addEventListener("click", async function (event) {
        event.preventDefault();
        limparCamposEvento();
        console.log("Pesquisando Evento...");
        try {
           
            
            const response = await fetch("http://localhost:3000/Eventos"); // ajuste a rota conforme sua API
     

            if (!response.ok) throw new Error("Erro ao buscar funções");
    
            const funcoes = await response.json();
            
            // font-family:"Abel",sans-serif;
            // width: 100%;
            // display: flex;
            // justify-content: center;                  /* Faz os inputs ocuparem toda a largura */
            // padding: 5px 50px; 
            // margin: 5px 10px;
            // font-size: 17px;               /* Espaçamento interno nos campos */
            // border: 1px solid #000000;      /* Cor de borda */
            // border-radius: 8px;  
            // flex: 1;      
            // max-width: 100%;  


            const estiloCampo = (elemento) => {
                elemento.className = "form"; // se você estiver usando classe CSS
                elemento.style.fontFamily = "Abel, sans-serif"; // Altera a fonte do campo
                elemento.style.width = "100%";
                elemento.style.display = "flex";
                elemento.style.justifyContent = "center"; // Centraliza o campo
                elemento.style.padding = "5px,10px";
                elemento.style.margin = "5px,10px";
                elemento.style.fontSize = "17px";
                elemento.style.border = "1px solid #000000";
                elemento.style.borderRadius = "8px";
                elemento.style.flex = "1"; // Faz o campo ocupar toda a largura disponível
                elemento.style.maxWidth = "100%"; // Limita a largura máxima
                
            };
            const input = document.querySelector("#nmEvento");
    
            // Criar novo SELECT
            const select = document.createElement("select");
            select.id = "nmEvento";
            select.name = "nmEvento";
            select.required = true;
            select.className = "form";
            estiloCampo(select);
            

            // Adicionar opções
            const defaultOption = document.createElement("option");
            defaultOption.text = "Selecione uma função...";
            defaultOption.disabled = true;
            defaultOption.selected = true;
            select.appendChild(defaultOption);
           
            console.log("PESQUISANDO FUNCAO:", funcoes);

            funcoes.forEach(funcao => {
                const option = document.createElement("option");
                option.value = funcao.descfuncao;
                option.text = funcao.descfuncao;
                select.appendChild(option);
            });
    
            // Substituir o input pelo select
            input.parentNode.replaceChild(select, input);
    
            // Reativar o evento blur para o novo select
            select.addEventListener("change", async function () {
                const desc = this.value.trim();
                const response = await fetch(`http://localhost:3000/funcao?nmEvento=${encodeURIComponent(desc)}`);
                if (response.ok) {
                    const evento = await response.json();
                    document.querySelector("#idEvento").value = evento.idevento;
                    
                    EventoOriginal = {
                        idEvento: funcao.idEvento,
                        nmEvento: funcao.nmEvento
                    };
                    EventoExistente = true;

                    
                    const input = document.createElement("input");
                    input.type = "text";
                    input.id = "nmEvento";
                    input.name = "nmEvento";
                    input.required = true;
                    input.className = "form";
                    input.style.width = "100%";
                    input.style.height = "40px";
                    estiloCampo(input);
                    input.value = funcao.descfuncao;

                    // Substitui o select pelo input
                    this.parentNode.replaceChild(input, this);

        // Reanexa o evento de blur no input restaurado
                    input.addEventListener("blur", async function () {
                        const desc = this.value.trim();
                        if (desc === "") return;

                        const response = await fetch(`http://localhost:3000/eventos?nmEvento=${encodeURIComponent(desc)}`);
                        if (response.ok) {
                            const evento = await response.json();
                            document.querySelector("#idEvento").value = evento.idevento;
                            
                            EventoOriginal = {
                                idEvento: evento.idevento,
                                nmEvento: evento.nmEvento
                               
                            };
                            EventoExistente = true;
                        } else {
                            Swal.fire({
                                icon: 'warning',
                                title: 'Evento não encontrada',
                                text: `Nenhuma função com essa descrição foi encontrada.`,
                                confirmButtonText: 'Ok'
                            });
                            limparEventoOriginal();
                            EventoExistente = false;
                        }
                    });

                } else {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Evento não encontrada',
                        text: `Nenhuma função com essa descrição foi encontrada.`,
                        confirmButtonText: 'Ok'
                    });
                    limparEventoOriginal();
                    EventoExistente = false;
                }
            });

                    
            //     } else {
            //         Swal.fire({
            //             icon: 'warning',
            //             title: 'Evento não encontrada',
            //             text: `Nenhuma função com essa descrição foi encontrada.`,
            //             confirmButtonText: 'Ok'
            //         });
            //         limparEventoOriginal();
            //         EventoExistente = false;
            //     }
            // });
    
        } catch (error) {
            console.error("Erro ao carregar funções:", error);
            Swal.fire({
                icon: 'error',
                title: 'Erro',
                text: 'Não foi possível carregar as funções.',
                confirmButtonText: 'Ok'
            });
        }
    });
    

    //     // Captura os valores do formulário
    //     const nmEvento = document.querySelector("#nmEvento").value;
    //     const vlrCusto = document.querySelector("#Custo").value;
    //     const vlrVenda = document.querySelector("#Venda").value;

    //     if (!nmEvento || !vlrCusto || !vlrVenda) {
    //         console.error("❌ Campos do formulário não encontrados!");
    //         alert("Erro: campos do formulário não foram carregados corretamente.");
    //         return;
    //     }
    //     const dados = { nmEvento, vlrCusto, vlrVenda };
    //     console.log("enviando", dados);

    //     try {
    //         const response = await fetch("http://localhost:3000/Evento", {
    //             method: "POST",
    //             headers: {
    //                 "Content-Type": "application/json",
    //             },
    //             body: JSON.stringify(dados),
    //         });

    //         const result = await response.json();

    //         if (result.success) {
    //             alert("Dados enviados com sucesso!");
    //             form.reset(); // Limpa o formulário
    //         } else {
    //             alert("Erro ao enviar os dados.");
    //         }
    //     } catch (error) {
    //         console.error("Erro ao enviar:", error);
    //         alert("Erro de conexão com o servidor.");
    //     }
    // });
}

function limparEventoOriginal() {
    EventoOriginal = {
        idEvento: "",
        nmEvento: ""
       
    };
}
function mostrarAlerta() {
    Swal.fire({
        icon: 'info',
        title: 'Nada foi alterado!',
        text: 'Faça alguma alteração antes de salvar.',
        confirmButtonText: 'OK',

        didOpen: () => {
            const confirmBtn = Swal.getConfirmButton();
            if (confirmBtn) confirmBtn.focus();
          }
    });
}

function limparCamposEvento() {
    const campos = ["idEvento", "nmEvento"];
    campos.forEach(id => {
        const campo = document.getElementById(id);
        if (campo) campo.value = "";
    });
}

function configurarEventosEvento() {
    console.log("Configurando eventos Evento...");
    verificaEvento(); // Carrega os Evento ao abrir o modal
    console.log("Entrou configurar Evento no EVENTO.js.");
    

} 
window.configurarEventosEvento = configurarEventosEvento;
