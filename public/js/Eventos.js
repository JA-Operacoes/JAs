
let EventoOriginal = {
    idEvento: "",
    nmEvento: ""
   
};

// function verificaEvento() {

//     console.log("Carregando Evento...");
    
//     document.querySelector("#nmEvento").addEventListener("blur", async function () {
//         const desc = this.value.trim();

//         console.log("Campo nmEvento procurado:", desc);
    
//         if (desc === "") return;
    
//         try {
//             if (!desc) {
//                 console.warn("Valor do select está vazio ou indefinido.");
//                 return;
//             }

//             console.log("Selecionado:", desc);

//             await carregarEventoDescricao(desc, this);
//             console.log("Função selecionado depois de carregarEventoDescricao:", this.value);
         

//         } catch (error) {
//             console.error("Erro ao buscar Função:", error);
//         }

//     });

//     const botaoEnviar = document.querySelector("#Enviar");
//     const botaoPesquisar = document.querySelector("#Pesquisar");
//     const form = document.querySelector("#form");
//     const botaoLimpar = document.querySelector("#Limpar");

//     if (!botaoEnviar || !form) {
//         console.error("Formulário ou botão não encontrado no DOM.");
//         return;
//     }

//     botaoLimpar.addEventListener("click", function (event) {
//         event.preventDefault(); // Previne o envio padrão do formulário 

//         limparCamposEvento();

//     });

//     botaoEnviar.addEventListener("click", async function (event) {
//         event.preventDefault(); // Previne o envio padrão do formulário

//         console.log("ENVIANDO DADOS DO Evento PELO Evento.JS", document);

//         const idEvento = document.querySelector("#idEvento").value.trim();
//         const nmEvento = document.querySelector("#nmEvento").value.trim();
    
    
//         if (!nmEvento ) {
           
//             Swal.fire({
//                 icon: 'warning',
//                 title: 'Campos obrigatórios!',
//                 text: 'Preencha todos os campos antes de enviar.',
//                 confirmButtonText: 'Entendi'
//             });
//             return;
//         }
//         console.log("Valores do Evento:", idEvento, nmEvento);
//         console.log("Valores do Evento Original:", EventoOriginal.idEvento, EventoOriginal.nmEvento);
    
//         // Comparar com os valores originais
//         if (
//             parseInt(idEvento) === parseInt(EventoOriginal.idEvento) && 
//             nmEvento === EventoOriginal.nmEvento
           
//         ) {
//             console.log("Nenhuma alteração detectada.");
//             await Swal.fire({
//                 icon: 'info',
//                 title: 'Nenhuma alteração foi detectada!',
//                 text: 'Faça alguma alteração antes de salvar.',
//                 confirmButtonText: 'Entendi'
//             });
//             return;
//         }
    
//         const dados = { nmEvento };

//         console.log("Dados a serem enviados:", idEvento);
     
//         if (idEvento) {
//             Swal.fire({
//                 title: "Deseja salvar as alterações?",
//                 text: "Você está prestes a atualizar os dados do evento.",
//                 icon: "question",
//                 showCancelButton: true,
//                 confirmButtonText: "Sim, salvar",
//                 cancelButtonText: "Cancelar",
//                 reverseButtons: true,
//                 focusCancel: true
                
//             }).then(async (result) => {
//                 if (result.isConfirmed) {
//                     try {
//                         const response = await fetch(`http://localhost:3000/eventos/${idEvento}`, {
//                             method: "PUT",
//                             headers: {
//                                 "Content-Type": "application/json"
//                             },
//                             body: JSON.stringify(dados)
//                         });
        
//                         const resultJson = await response.json();
        
//                         if (response.ok) {
//                             document.getElementById('form').reset();
//                             Swal.fire("Sucesso!", resultJson.mensagem || "Alterações salvas com sucesso!", "success");
//                             //form.reset();
//                             document.querySelector("#idEvento").value = "";
//                             limparEventoOriginal();  
//                         } else {
//                             Swal.fire("Erro", resultJson.erro || "Erro ao salvar o Função.", "error");
//                         }
//                     } catch (error) {
//                         console.error("Erro ao enviar dados:", error);
//                         Swal.fire("Erro de conexão", "Não foi possível conectar ao servidor.", "error");
//                     }
//                 } else {
//                     console.log("Usuário cancelou a alteração.");
//                 }
//             });
//         } else {
//             // Se for novo, salva direto
//             try {
//                 const response = await fetch("http://localhost:3000/eventos", {
//                     method: "POST",
//                     headers: {
//                         "Content-Type": "application/json"
//                     },
//                     body: JSON.stringify(dados)
//                 });
        
//                 const resultJson = await response.json();
        
//                 if (response.ok) {
//                     Swal.fire("Sucesso!", resultJson.mensagem || "Evento cadastrado!", "success");
//                     form.reset();
//                     limparEventoOriginal();
//                     document.querySelector("#idEvento").value = "";
//                 } else {
//                     Swal.fire("Erro", resultJson.erro || "Erro ao cadastrar o Evento.", "error");
//                 }
//             } catch (error) {
//                 console.error("Erro ao enviar dados:", error);
//                 Swal.fire("Erro de conexão", "Não foi possível conectar ao servidor.", "error");
//             }
//         }
//     });
    
//     botaoPesquisar.addEventListener("click", async function (event) {
//         event.preventDefault();
//         limparCamposEvento();
//         console.log("Pesquisando Evento...");
//         try {
//             const response = await fetch("http://localhost:3000/eventos"); // ajuste a rota conforme sua API
//             if (!response.ok) throw new Error("Erro ao buscar Eventos");
    
//             const eventos = await response.json();

//             console.log("Eventos encontradas:", eventos);

//             const select = criarSelectEvento(eventos);
//             limparCamposEvento();
//             const input = document.querySelector("#nmEvento");
               
//             if (input && input.parentNode) {
//                 input.parentNode.replaceChild(select, input);
//             }
   
//             const label = document.querySelector('label[for="nmEvento"]');
//             if (label) {
//               label.style.display = "none"; // ou guarda o texto, se quiser restaurar exatamente o mesmo
//             }
    
//             // Reativar o evento blur para o novo select
//             select.addEventListener("change", async function () {
//                 const desc = this.value?.trim();
               
//                 if (!desc) {
//                     console.warn("Valor do select está vazio ou indefinido.");
//                     return;
//                 }

//                 await carregarEventoDescricao(desc, this);

//                 const novoInput = document.createElement("input");
//                 novoInput.type = "text";
//                 novoInput.id = "nmEvento";
//                 novoInput.name = "nmEvento";
//                 novoInput.required = true;
//                 novoInput.className = "form";
//                 novoInput.value = desc;
            
//                 novoInput.addEventListener("input", function() {
//                     this.value = this.value.toUpperCase(); // transforma o texto em maiúsculo à medida que o usuário digita
//                 });

//                 this.parentNode.replaceChild(novoInput, this);
               
//                 const label = document.querySelector('label[for="nmEvento"]');
//                 if (label) {
//                 label.style.display = "block";
//                 label.textContent = "Descrição do Evento"; // ou algum texto que você tenha guardado
//                 }
              
//                 novoInput.addEventListener("blur", async function () {
//                     if (!this.value.trim()) return;
//                     await carregarEventoDescricao(this.value, this);
//                 });
 
//          });
    
//         } catch (error) {
//             console.error("Erro ao carregar eventos:", error);
//             Swal.fire({
//                 icon: 'error',
//                 title: 'Erro',
//                 text: 'Não foi possível carregar os eventos.',
//                 confirmButtonText: 'Ok'
//             });
//         }
//     });
    

// }


async function verificaEvento() {
    console.log("Carregando Evento...");

    document.querySelector("#nmEvento").addEventListener("blur", async function () {
        const desc = this.value.trim();
        if (!desc) return;

        try {
            await carregarEventoDescricao(desc, this);
        } catch (error) {
            console.error("Erro ao buscar Evento:", error);
        }
    });

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

        // Verifica alterações
        if (
            idEvento &&
            parseInt(idEvento) === parseInt(window.EventoOriginal?.idEvento) &&
            nmEvento === window.EventoOriginal?.nmEvento  
        ) {
            return Swal.fire("Nenhuma alteração foi detectada!", "Faça alguma alteração antes de salvar.", "info");
        }
        
        // Valida alterações
        // if (!houveAlteracao(dados)) {
        //     return Swal.fire("Nenhuma alteração foi detectada!", "Faça alguma alteração antes de salvar.", "info");
        // }
         const url = idEvento
            ? `/eventos/${idEvento}`
            : "/eventos";
        console.log("idEvento:", idEvento);
        console.log("Dados a serem enviados:", dados);
        console.log("Evento Original:", EventoOriginal);
        console.log("Url:", url);
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

// async function carregarEventoDescricao(desc, elementoAtual) {
    
//     try {
//         const response = await fetch(`/eventos?nmEvento=${encodeURIComponent(desc)}`);
//         console.log("Resposta do servidor:", response);
//         if (!response.ok) throw new Error();

//         const eventos = await response.json();
//         console.log("Resposta json:", eventos);
//         document.querySelector("#idEvento").value = eventos.idevento;
       
      
//         EventoOriginal = {
//             idEvento: eventos.idevento,
//             nmEvento: eventos.nmevento
           
//         };
   
//         console.log("Evento encontrado:", EventoOriginal);
//     } catch (error) {
    
//         if (!idEvento.value) {
      
//             const resultado = Swal.fire({
//                 icon: 'question',
//                 title: `Deseja cadastrar "${desc.toUpperCase()}" como novo Evento?`,
//                 text: `Evento "${desc.toUpperCase()}" não encontrado`,
//                 showCancelButton: true,
//                 confirmButtonText: 'Sim, cadastrar',
//                 cancelButtonText: 'Cancelar'
//             });
        
//         }
//     }
// }

async function carregarEventoDescricao(desc, elementoAtual) {
    try {
        const response = await fetchComToken(`/eventos?nmEvento=${encodeURIComponent(desc)}`);
        console.log("Resposta do servidor:", response);

        if (!response.ok) throw new Error();

        const eventos = await response.json();
        console.log("Resposta json:", eventos);

        document.querySelector("#idEvento").value = eventos.idevento;

        EventoOriginal = {
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
                confirmButtonText: "Sim, salvar",
                cancelButtonText: "Cancelar",
                reverseButtons: true,
                focusCancel: true
            });

            if (resultado.isConfirmed) {
                // Aqui você pode chamar a função que abre o modal ou inicia o cadastro
                // abrirModalCadastroEquipamento(desc);
                console.log(`Usuário optou por cadastrar: ${desc}`);
            }
            
        } else if (!podeCadastrarEvento) {
            Swal.fire({
                icon: "info",
                title: "Equipamento não cadastrado",
                text: "Você não tem permissão para cadastrar quipamentos.",
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
    // const campos = ["idEvento", "nmEvento" ];
    // campos.forEach(id => {
    //     const campo = document.getElementById(id);
    //     if (campo) campo.value = "";
    // });

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
