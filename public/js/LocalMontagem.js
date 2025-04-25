

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

    const botaoEnviar = document.querySelector("#Enviar");
    
    const form = document.querySelector("#form");

    if (!botaoEnviar || !form) {
        console.error("Formulário ou botão não encontrado no DOM.");
        return;
    }

    botaoEnviar.addEventListener("click", async function (event) {
        event.preventDefault(); // Previne o envio padrão do formulário

        console.log("ENVIANDO DADOS DO Montagem PELO Montagem.JS", document);

        const idMontagem = document.querySelector("#idMontagem").value.trim().toString();
        const descMontagem = document.querySelector("#descMontagem").value.trim().toUpperCase();
        const cidadeMontagem = document.querySelector("#cidadeMontagem").value.trim().toUpperCase();
        const ufMontagem = document.querySelector("#ufMontagem").value.trim().toUpperCase();

      
    
        if (!descMontagem || !cidadeMontagem || !ufMontagem) {
            alert("Preencha todos os campos.");
            return;
        }
        if (MontagemOriginal.idMontagem.toString() === idMontagem) {
            console.log("idMontagem", idMontagem);
        }
        if (MontagemOriginal.descMontagem === descMontagem) {
            console.log("descMontagem", descMontagem);
            
        }
        if (MontagemOriginal.cidadeMontagem === cidadeMontagem) {
            console.log("cidadeMontagem", cidadeMontagem);
        }
        if (MontagemOriginal.ufMontagem === ufMontagem) {
            console.log("ufMontagem", ufMontagem);
        }
        // 🔍 Comparar com os valores originais
        if (
                      
            MontagemOriginal.idMontagem.toString() === idMontagem &&
            MontagemOriginal.descMontagem === descMontagem &&
            MontagemOriginal.cidadeMontagem=== cidadeMontagem &&   
            MontagemOriginal.ufMontagem === ufMontagem
            
        ) {
           
            Swal.fire({
                icon: 'info', // info | success | warning | error | question
                title: 'Nenhuma alteração foi detectada!',
                text: 'Faça alguma alteração antes de salvar.',
                confirmButtonText: 'Entendi'
            });
           // mostrarAlerta();
             
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

    const botaoPesquisar = document.querySelector("#Pesquisar");
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
            input.parentNode.replaceChild(select, input);

    
            // Reativar o evento blur para o novo select
            select.addEventListener("change", async function () {
                console.log("Montagem selecionado antes de carregarMontagem:", this.value);
                const desc = this.value?.trim();


                if (!desc) {
                    console.warn("Valor do select está vazio ou indefinido.");
                    return;
                }

                console.log("Selecionado:", desc);

                await carregarLocalMontagem(desc, this);
                console.log("Cliente selecionado:", this.value);
             
                const novoInput = document.createElement("input");
                novoInput.type = "text";
                novoInput.id = "descMontagem";
                novoInput.name = "descMontagem";
                novoInput.required = true;
                novoInput.className = "form";
                novoInput.value = desc;
                //novoInput.value = montagem.descmontagem;

                novoInput.addEventListener("input", function() {
                    this.value = this.value.toUpperCase(); // transforma o texto em maiúsculo à medida que o usuário digita
                });

                estiloCampo(novoInput);
                //elementoAtual.parentNode.replaceChild(novoInput, elementoAtual);
                this.parentNode.replaceChild(novoInput, this);

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

function estiloCampo(elemento) {
    Object.assign(elemento.style, {
        fontFamily: "Abel, sans-serif",
        width: "100%",
        display: "flex",
        justifyContent: "center",
        padding: "5px 10px",
        margin: "5px 10px",
        fontSize: "17px",
        border: "1px solid #000",
        borderRadius: "8px",
        flex: "1",
        maxWidth: "100%"
    });
}

function criarSelectMontagem(montagem) {
    const select = document.createElement("select");
    select.id = "descMontagem";
    select.name = "descMontagem";
    select.required = true;
    select.className = "form";

    estiloCampo(select);

    limparCamposMontagem();
    const defaultOption = document.createElement("option");
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
    
        console.log("Carregando Local Montagem:", desc);
        const response = await fetch(`http://localhost:3000/localmontagem?descmontagem=${encodeURIComponent(desc.trim())}`);
        if (!response.ok) throw new Error();

        console.log("Response carregarLocalMontagem",response);
        const montagem = await response.json();
       
        console.log("Montagem encontrado:", montagem);

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
        console.log("MontagemOriginal", MontagemOriginal);
          
    } catch {
        mostrarErro("Local  Montagem não encontrada", "Nenhum local de montagem com essa descrição foi encontrada.");
    

    }
    
}

function mostrarErro(titulo, texto) {
    Swal.fire({
        icon: 'warning',
        title: titulo,
        text: texto,
        confirmButtonText: 'Ok'
    });
}


function limparMontagemOriginal() {
    MontagemOriginal = {
        idMontagem: "",
        descMontagem: "",
        cidadeMontagem: "",
        ufMontagem: ""
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

function limparCamposMontagem() {
    const campos = ["idMontagem", "cidadeMontagem", "ufMontagem", "descMontagem"];
    campos.forEach(id => {
        const campo = document.getElementById(id);
        if (campo) campo.value = "";
    });
    console.log("Campos de montagem limpos.");
}

function configurarEventosMontagem() {
    console.log("Configurando eventos Montagem...");
    verificaMontagem(); // Carrega os Montagem ao abrir o modal
    console.log("Entrou configurar Montagem no MONTAGEM.js.");
    

} 
window.configurarEventosMontagem = configurarEventosMontagem;
