if (typeof Swal === "undefined") {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/sweetalert2@11";
    script.onload = () => {
        console.log("SweetAlert2 carregado com sucesso.");
    };
    document.head.appendChild(script);
}

let MontagemOriginal = {
    idMontagem: "",
    descMontagem: "",
    cidadeMontagem: "",
    ufMontagem: ""
};

function verificaMontagem() {

    console.log("Carregando Montagem...");
    
    document.querySelector("#descMontagem").addEventListener("blur", async function () {
        const desc = this.value?.trim();

        console.log("Campo descMontagem procurado:", desc);
    
        //if (desc === "") return;
    
        try {
            
            if (!desc) {
                console.warn("Valor do select está vazio ou indefinido.");
                return;
            }

            console.log("Selecionado:", desc);

            await carregarLocalMontagem(desc, this);
            console.log("Cliente selecionado depois de carregarLocalMontagem:", this.value);
         

        } catch (error) {
            console.error("Erro ao buscar Montagem:", error);
        }
    });

    const botaoLimpar = document.querySelector("#Limpar");
    const botaoEnviar = document.querySelector("#Enviar");
    const botaoPesquisar = document.querySelector("#Pesquisar");
    const form = document.querySelector("#form");

    if (!botaoEnviar || !form) {
        console.error("Formulário ou botão não encontrado no DOM.");
        return;
    }

    botaoLimpar.addEventListener("click", function (event) {
        event.preventDefault(); // Previne o envio padrão do formulário 

        limparCamposMontagem();

    });
    botaoEnviar.addEventListener("click", async function (event) {
        event.preventDefault(); // Previne o envio padrão do formulário

        console.log("ENVIANDO DADOS DO Montagem PELO Montagem.JS", document);

        const idMontagem = document.querySelector("#idMontagem").value.trim().toString();
        const descMontagem = document.querySelector("#descMontagem").value.trim().toUpperCase();
        const cidadeMontagem = document.querySelector("#cidadeMontagem").value.trim().toUpperCase();
        const ufMontagem = document.querySelector("#ufMontagem").value.trim().toUpperCase();
        
        if (!descMontagem || !cidadeMontagem || !ufMontagem) {
           
            Swal.fire({
                icon: 'warning',
                title: 'Campos obrigatórios!',
                text: 'Preencha todos os campos antes de enviar.',
                confirmButtonText: 'Entendi'
            });
            return;
        }
        // 🔍 Comparar com os valores originais
        if (
                      
            parseInt(idMontagem) === parseInt(MontagemOriginal.idMontagem) && 
            descMontagem === MontagemOriginal.descMontagem   &&
            cidadeMontagem === MontagemOriginal.cidadeMontagem  &&   
            ufMontagem === MontagemOriginal.ufMontagem 
            
        ) {
           
            Swal.fire({
                icon: 'info', // info | success | warning | error | question
                title: 'Nenhuma alteração foi detectada!',
                text: 'Faça alguma alteração antes de salvar.',
                confirmButtonText: 'Entendi'
            });
         
             
            console.log("Nenhuma alteração detectada.");
            return;
        }
    
        const dados = { descMontagem, cidadeMontagem, ufMontagem };
   
        if (idMontagem) {
            // Se for alteração, perguntar ao usuário antes
            
            Swal.fire({
                title: "Deseja salvar as alterações?",
                text: "Você está prestes a atualizar os dados do local de montagem.",
                icon: "question",
                showCancelButton: true,
                confirmButtonText: "Sim, salvar",
                cancelButtonText: "Cancelar",
                reverseButtons: true,
                focusCancel: true
                
            }).then(async (result) => {
                if (result.isConfirmed) {
                    try {
                        const response = await fetch(`http://localhost:3000/localmontagem/${idMontagem}`, {
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
                            document.querySelector("#idMontagem").value = "";
                            limparMontagemOriginal();  
                        } else {
                            Swal.fire("Erro", resultJson.erro || "Erro ao salvar o Local de Montagem.", "error");
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
                console.log("Enviando dados para o servidor:", dados);
                
                const response = await fetch("http://localhost:3000/localmontagem", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(dados)
                });
        
                const resultJson = await response.json();
        
                if (response.ok) {
                    Swal.fire("Sucesso!", resultJson.mensagem || "Local de montagem cadastrado!", "success");
                    form.reset();
                    limparMontagemOriginal();
                    document.querySelector("#idMontagem").value = "";
                } else {
                    Swal.fire("Erro", resultJson.erro || "Erro ao cadastrar o Local de Montagem.", "error");
                }
            } catch (error) {
                console.error("Erro ao enviar dados:", error);
                Swal.fire("Erro de conexão", "Não foi possível conectar ao servidor.", "error");
            }
        }
       
    });

    
    console.log("botaoPesquisar", botaoPesquisar);
    botaoPesquisar.addEventListener("click", async function (event) {
        event.preventDefault();

        limparCamposMontagem();
        console.log("Pesquisando Montagem...");
        
        try {
           const response = await fetch("http://localhost:3000/localmontagem"); // ajuste a rota conforme sua API
           if (!response.ok) throw new Error("Erro ao buscar Local Montagem");
    
            const montagem = await response.json();
 
            const select = criarSelectMontagem(montagem);
            limparCamposMontagem();
            const input = document.querySelector("#descMontagem");
  
            // Substituir o input pelo select
            
            if (input && input.parentNode) {
                input.parentNode.replaceChild(select, input);
            }

            const label = document.querySelector('label[for="descMontagem"]');
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

                await carregarLocalMontagem(desc, this);
                   
                const novoInput = document.createElement("input");
                novoInput.type = "text";
                novoInput.id = "descMontagem";
                novoInput.name = "descMontagem";
                novoInput.required = true;
                novoInput.className = "form";
                novoInput.value = desc;
      
                novoInput.addEventListener("input", function() {
                    this.value = this.value.toUpperCase(); // transforma o texto em maiúsculo à medida que o usuário digita
                });

                this.parentNode.replaceChild(novoInput, this);

                const label = document.querySelector('label[for="descMontagem"]');
                if (label) {
                label.style.display = "block";
                label.textContent = "Local de Montagem"; // ou algum texto que você tenha guardado
                }

                novoInput.addEventListener("blur", async function () {
                    if (!this.value.trim()) return;
                    await carregarLocalMontagem(this.value, this);
                });

        
            });
   
        } catch (error) {
            console.error("Erro ao carregar local montagem:", error);
            Swal.fire({
                icon: 'error',
                title: 'Erro',
                text: 'Não foi possível carregar o local montagem.',
                confirmButtonText: 'Ok'
            });
        }
    });
    

}

function criarSelectMontagem(montagem) {
    const select = document.createElement("select");
    select.id = "descMontagem";
    select.name = "descMontagem";
    select.required = true;
    select.className = "form";

    limparCamposMontagem();
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.text = "Selecione um Local de Montagem...";
    defaultOption.disabled = true;
    defaultOption.selected = true;
    defaultOption.value = "";
    select.appendChild(defaultOption);

    console.log("Montagem encontrados no CriarSelects:", montagem);

    montagem.forEach(localmontagem => {
        const option = document.createElement("option");
        option.value = localmontagem.descmontagem;
        option.text = localmontagem.descmontagem;
        select.appendChild(option);
    });
 
    return select;
}

async function carregarLocalMontagem(desc, elementoAtual) {
    try {
        const response = await fetch(`http://localhost:3000/localmontagem?descmontagem=${encodeURIComponent(desc.trim())}`);
        if (!response.ok) throw new Error();

        const montagem = await response.json();
       
        document.querySelector("#idMontagem").value = montagem.idmontagem;
        document.querySelector("#descMontagem").value = montagem.descmontagem;
        document.querySelector("#cidadeMontagem").value = montagem.cidademontagem;
        document.querySelector("#ufMontagem").value = montagem.ufmontagem;
        
        MontagemOriginal = {
            idMontagem: montagem.idmontagem,
            descMontagem: montagem.descmontagem,
            cidadeMontagem: montagem.cidademontagem,
            ufMontagem: montagem.ufmontagem,
            
        };
     
          
    }  catch (error) {

        if (!idMontagem.value) {
            const resultado = Swal.fire({
            icon: 'question',
            title: `Deseja cadastrar "${desc.toUpperCase()}" como novo Local de Montagem?`,
            text: `Local "${desc.toUpperCase()}" não encontrado`,
            showCancelButton: true,
            confirmButtonText: 'Sim, cadastrar',
            cancelButtonText: 'Cancelar'
            });
        }
        
    }
    
}

function limparMontagemOriginal() {
    MontagemOriginal = {
        idMontagem: "",
        descMontagem: "",
        cidadeMontagem: "",
        ufMontagem: ""
    };
}

function limparCamposMontagem() {
    const campos = ["idMontagem", "cidadeMontagem", "ufMontagem", "descMontagem"];
    campos.forEach(id => {
        const campo = document.getElementById(id);
        if (campo) campo.value = "";
    });
    
    
}

function configurarEventosMontagem() {
    console.log("Configurando eventos Montagem...");
    verificaMontagem(); // Carrega os Montagem ao abrir o modal
    console.log("Entrou configurar Montagem no MONTAGEM.js.");
    

} 
window.configurarEventosMontagem = configurarEventosMontagem;
