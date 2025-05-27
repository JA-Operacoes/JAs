let MontagemOriginal = {
    idMontagem: "",
    descMontagem: "",
    cidadeMontagem: "",
    ufMontagem: ""
};

function verificaMontagem() {

    console.log("Carregando Montagem...");
    
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
        
        // Permissões
        const temPermissaoCadastrar = temPermissao("Eventos", "cadastrar");
        const temPermissaoAlterar = temPermissao("Eventos", "alterar");

        const metodo = idMontagem ? "PUT" : "POST";

        if (!idMontagem && !temPermissaoCadastrar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para cadastrar novos eventos.", "error");
        }

        if (idMontagem && !temPermissaoAlterar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para alterar eventos.", "error");
        }

       

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

        const url = idMontagem
            ? `/localmontagem/${idMontagem}`
            : "/localmontagem";
   
        try {
            // Confirma alteração (PUT)
            if (metodo === "PUT") {
                const { isConfirmed } = await Swal.fire({
                    title: "Deseja salvar as alterações?",
                    text: "Você está prestes a atualizar os dados do Local Montagem.",
                    icon: "question",
                    showCancelButton: true,
                    confirmButtonText: "Sim, salvar",
                    cancelButtonText: "Cancelar",
                    reverseButtons: true,
                    focusCancel: true
                });
                if (!isConfirmed) {
                    console.log("Usuário cancelou o cadastro do Local de Montagem.");
                    elementoAtual.value = ""; // Limpa o campo se não for cadastrar
                    setTimeout(() => {
                        elementoAtual.focus();
                    }, 0);
                    return;
                }
            }
            
            console.log("Enviando dados para o servidor:", dados, url, metodo);
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

            if (!res.ok) throw new Error(json.erro || json.message || "Erro ao salvar local montagem");

            await Swal.fire("Sucesso!", json.message || "Local Montagem salvo com sucesso.", "success");
            document.getElementById("form").reset();
            document.querySelector("#idMontagem").value = "";
            limparMontagemOriginal();

        } catch (error) {
            console.error("Erro ao enviar dados:", error);
            Swal.fire("Erro", error.message || "Erro ao salvar Local de Montagem.", "error");
        }
    });
    
    console.log("botaoPesquisar", botaoPesquisar);
    botaoPesquisar.addEventListener("click", async function (event) {
        event.preventDefault();

        limparCamposMontagem();

        console.log("Pesquisando Montagem...");
        const temPermissaoPesquisar = temPermissao('Eventos', 'pesquisar');
        if (!temPermissaoPesquisar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para pesquisar.", "warning");
        }

        
        try {
           const response = await fetchComToken("/localmontagem"); // ajuste a rota conforme sua API
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
                adicionarEventoBlurMontagem();

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

function adicionarEventoBlurMontagem() {
    const input = document.querySelector("#descMontagem");
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
        console.log("Campo descMontagem procurado:", desc);

        if (!desc) return;

        try {
            await carregarLocalMontagem(desc, this);
            console.log("Local Montagem selecionado depois de carregarLocalMontagem:", this.value);
        } catch (error) {
            console.error("Erro ao buscar Local Montagem:", error);
        }
    });
}

async function carregarLocalMontagem(desc, elementoAtual) {
    try {
        const response = await fetchComToken(`/localmontagem?descmontagem=${encodeURIComponent(desc.trim())}`);
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

        
        console.warn("Local de Montagem não encontrado.");

        const inputIdMontagem = document.querySelector("#idMontagem");
        const podeCadastrarMontagem = temPermissao("Localmontagem", "cadastrar");

       if (!inputIdMontagem.value && podeCadastrarMontagem) {
             const resultado = await Swal.fire({
                icon: 'question',
                title: `Deseja cadastrar "${desc.toUpperCase()}" como novo Local de Montagem?`,
                text: `Local de Montagem "${desc.toUpperCase()}" não encontrado.`,
                showCancelButton: true,
                confirmButtonText: "Sim, cadastrar",
                cancelButtonText: "Cancelar",
                reverseButtons: true,
                focusCancel: true
            });

            if (resultado.isConfirmed) {
                
                console.log(`Usuário optou por cadastrar: ${desc}`);
            }
            if (!resultado.isConfirmed) {
                console.log("Usuário cancelou o cadastro do Local de Montagem.");
                elementoAtual.value = ""; // Limpa o campo se não for cadastrar
                setTimeout(() => {
                    elementoAtual.focus();
                }, 0);
                return;
            }
            
        } else if (!podeCadastrarMontagem) {
            Swal.fire({
                icon: "info",
                title: "Local de Montagem não cadastrado",
                text: "Você não tem permissão para cadastrar local de montagem.",
                confirmButtonText: "OK"
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

    const idMontagem = document.getElementById("idMontagem");
    const descMontagemEl = document.getElementById("descMontagem");
        

    if (idMontagem) idMontagem.value = "";
    

    if (descMontagemEl && descMontagemEl.tagName === "SELECT") {
        // Se for SELECT, trocar por INPUT
        const novoInput = document.createElement("input");
        novoInput.type = "text";
        novoInput.id = "descMontagem";
        novoInput.name = "descMontagem";
        novoInput.required = true;
        novoInput.className = "form";

        // Configura o evento de transformar texto em maiúsculo
        novoInput.addEventListener("input", function () {
            this.value = this.value.toUpperCase();
        });

        // Reativa o evento blur
        novoInput.addEventListener("blur", async function () {
            if (!this.value.trim()) return;
            await carregarLocalMontagem(this.value, this);
        });

        descMontagemEl.parentNode.replaceChild(novoInput, descMontagemEl);
        adicionarEventoBlurMontagem();

        const label = document.querySelector('label[for="descMontagem"]');
        if (label) {
            label.style.display = "block";
            label.textContent = "Local de Montagem";
        }
    } else if (descMontagemEl) {
        // Se for input normal, só limpa
        descMontagemEl.value = "";
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


function configurarEventosMontagem() {
    console.log("Configurando eventos Montagem...");
    verificaMontagem(); // Carrega os Montagem ao abrir o modal
    adicionarEventoBlurMontagem();
    console.log("Entrou configurar Montagem no MONTAGEM.js.");
    

} 
window.configurarEventosMontagem = configurarEventosMontagem;

function configurarEventosEspecificos(modulo) {
  console.log("⚙️ configurarEventosEspecificos recebeu:", modulo);
  if (modulo.trim().toLowerCase() === 'localmontagem') {
    console.log("Modulo", modulo.trim().toLowerCase() );
    configurarEventosMontagem();
  }
}
window.configurarEventosEspecificos = configurarEventosEspecificos;
