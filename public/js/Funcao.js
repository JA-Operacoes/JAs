
if (typeof window.FuncaoOriginal === "undefined") {
    window.FuncaoOriginal = {
        idFuncao: "",
        descFuncao: "",
        vlrCusto: "",
        vlrVenda: "",
        vlrajdcusto: "",
        obsFuncao: ""
    }
};

function verificaFuncao() {

    console.log("Carregando Funcao...");
       
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
        const campo = document.getElementById("descFuncao");

        if (campo && campo.tagName.toLowerCase() === "select") {
            const input = document.createElement("input");
            input.type = "text";
            input.id = "descFuncao";
            input.name = "descFuncao";
            input.value = "Descrição da Função";
            input.className = "form";
            input.required = true;

            campo.parentNode.replaceChild(input, campo);
            adicionarEventoBlurFuncao();

            const label = document.querySelector('label[for="descFuncao"]');
            if (label) label.style.display = "block";

            // Adiciona o evento blur ao novo input
        
        }
        limparCamposFuncao();

    });

    botaoEnviar.addEventListener("click", async function (event) {
        event.preventDefault(); // Previne o envio padrão do formulário

        const idFuncao = document.querySelector("#idFuncao").value;
        const descFuncao = document.querySelector("#descFuncao").value.toUpperCase().trim();
        const vlrCusto = document.querySelector("#Custo").value;
        const vlrVenda = document.querySelector("#Venda").value;
        const vlrajdcusto = document.querySelector("#ajdCusto").value;
        const obsfuncao = document.querySelector("#ObsAjc").value.trim();
    
        const custo = parseFloat(String(vlrCusto).replace(",", "."));
        const venda = parseFloat(String(vlrVenda).replace(",", "."));
        const ajcfuncao = parseFloat(String(vlrajdcusto).replace(",", "."));

       // Permissões
        const temPermissaoCadastrar = temPermissao("Funcao", "cadastrar");
        const temPermissaoAlterar = temPermissao("Funcao", "alterar");

        const metodo = idFuncao ? "PUT" : "POST";

        if (!idFuncao && !temPermissaoCadastrar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para cadastrar novas funções.", "error");
        }

        if (idFuncao && !temPermissaoAlterar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para alterar funções.", "error");
        }
 
        if (!descFuncao || !vlrCusto || !vlrVenda) {
           
            Swal.fire({
                icon: 'warning',
                title: 'Campos obrigatórios!',
                text: 'Preencha todos os campos antes de enviar.',
                confirmButtonText: 'Entendi'
            });
            return;
        }
        console.log("Valores do Funcao:", idFuncao, descFuncao, custo, venda, ajcfuncao, obsfuncao);
        console.log("Valores do Funcao Original:", window.FuncaoOriginal.idFuncao, window.FuncaoOriginal.descFuncao, window.FuncaoOriginal.vlrCusto, window.FuncaoOriginal.vlrVenda, window.FuncaoOriginal.vlrajdcusto, window.FuncaoOriginal.obsFuncao);
            
        // Comparar com os valores originais
        if (
            parseInt(idFuncao) === parseInt(window.FuncaoOriginal.idFuncao) && 
            descFuncao === window.FuncaoOriginal.descFuncao && 
            Number(custo).toFixed(2) === Number(window.FuncaoOriginal.vlrCusto).toFixed(2) &&
            Number(venda).toFixed(2) === Number(window.FuncaoOriginal.vlrVenda).toFixed(2) &&
            Number(ajcfuncao).toFixed(2) === Number(window.FuncaoOriginal.vlrajdcusto).toFixed(2) &&
            obsfuncao=== window.FuncaoOriginal.obsFuncao
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
    
        const dados = { descFuncao, custo, venda, ajcfuncao, obsfuncao };

     
        if (idFuncao) {
            Swal.fire({
                title: "Deseja salvar as alterações?",
                text: "Você está prestes a atualizar os dados da função.",
                icon: "question",
                showCancelButton: true,
                confirmButtonText: "Sim, salvar",
                cancelButtonText: "Cancelar",
                reverseButtons: true,
                focusCancel: true
                
            }).then(async (result) => {
                if (result.isConfirmed) {
                    try {
                        const response = await fetchComToken(`/funcao/${idFuncao}`, {
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
                            document.querySelector("#idFuncao").value = "";
                            limparFuncaoOriginal();  
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
                const response = await fetchComToken("/funcao", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(dados)
                });
        
                const resultJson = await response.json();
        
                if (response.ok) {
                    Swal.fire("Sucesso!", resultJson.mensagem || "Função cadastrada!", "success");
                    form.reset();
                    limparFuncaoOriginal();
                    document.querySelector("#idFuncao").value = "";
                } else {
                    Swal.fire("Erro", resultJson.erro || "Erro ao cadastrar o Função.", "error");
                }
            } catch (error) {
                console.error("Erro ao enviar dados:", error);
                Swal.fire("Erro de conexão", "Não foi possível conectar ao servidor.", "error");
            }
        }
    });
    
    botaoPesquisar.addEventListener("click", async function (event) {
        event.preventDefault();
        console.log("Pesquisando Funcao...");

        limparCamposFuncao();
        console.log("Pesquisando Funcao...");

        const temPermissaoPesquisar = temPermissao('Funcao', 'pesquisar');
        console.log("Tem permissão para pesquisar Função:", temPermissaoPesquisar);
        if (!temPermissaoPesquisar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para pesquisar.", "warning");
        }

        try {
            const response = await fetchComToken("/funcao"); // ajuste a rota conforme sua API
            if (!response.ok) throw new Error("Erro ao buscar funções");
    
            const funcoes = await response.json();

            console.log("Funções encontradas:", funcoes);

            const select = criarSelectFuncao(funcoes);
            limparCamposFuncao();
            const input = document.querySelector("#descFuncao");
               
            if (input && input.parentNode) {
                input.parentNode.replaceChild(select, input);
            }
   
            const label = document.querySelector('label[for="descFuncao"]');
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

                await carregarFuncaoDescricao(desc, this);

                const novoInput = document.createElement("input");
                novoInput.type = "text";
                novoInput.id = "descFuncao";
                novoInput.name = "descFuncao";
                novoInput.required = true;
                novoInput.className = "form";
                novoInput.value = desc;
            
                novoInput.addEventListener("input", function() {
                    this.value = this.value.toUpperCase(); // transforma o texto em maiúsculo à medida que o usuário digita
                });

                this.parentNode.replaceChild(novoInput, this);
                adicionarEventoBlurFuncao();
               
                const label = document.querySelector('label[for="descFuncao"]');
                if (label) {
                label.style.display = "block";
                label.textContent = "Descrição da Função"; // ou algum texto que você tenha guardado
                }
              
                novoInput.addEventListener("blur", async function () {
                    if (!this.value.trim()) return;
                    await carregarFuncaoDescricao(this.value, this);
                });
 
         });
    
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
    

}
function criarSelectFuncao(funcoes) {
   
    const select = document.createElement("select");
    select.id = "descFuncao";
    select.name = "descFuncao";
    select.required = true;
    select.className = "form";

   
    // Adicionar opções
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.text = "Selecione uma função...";
    defaultOption.disabled = true;
    defaultOption.selected = true;
    select.appendChild(defaultOption);
   
    console.log("PESQUISANDO FUNCAO:", funcoes);

    funcoes.forEach(funcaoachada => {
        const option = document.createElement("option");
        option.value = funcaoachada.descfuncao;
        option.text = funcaoachada.descfuncao;
        select.appendChild(option);
    });
 
    return select;
}

function adicionarEventoBlurFuncao() {
    const input = document.querySelector("#descFuncao");
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
        console.log("Campo descFuncao procurado:", desc);

        if (!desc) return;

        try {
            await carregarFuncaoDescricao(desc, this);
            console.log("Função selecionada depois de carregarFuncaoDescricao:", this.value);
        } catch (error) {
            console.error("Erro ao buscar Função:", error);
        }
    });
}

async function carregarFuncaoDescricao(desc, elementoAtual) {
    try {
        const response = await fetchComToken(`/funcao?descFuncao=${encodeURIComponent(desc)}`);
        if (!response.ok) throw new Error();
           
        const funcao = await response.json();
        document.querySelector("#idFuncao").value = funcao.idfuncao;
        document.querySelector("#Custo").value = funcao.ctofuncao;
        document.querySelector("#Venda").value = funcao.vdafuncao;
        document.querySelector("#ajdCusto").value = funcao.ajcfuncao;
        document.querySelector("#ObsAjc").value = funcao.obsfuncao;
        
        window.FuncaoOriginal = {
            idFuncao: funcao.idfuncao,
            descFuncao: funcao.descfuncao,
            vlrCusto: funcao.ctofuncao,
            vlrVenda: funcao.vdafuncao,
            vlrajdcusto: funcao.ajcfuncao,
            obsFuncao: funcao.obsfuncao
        };
   
       

    } catch (error) {
        
        const inputIdFuncao = document.querySelector("#idFuncao");
        const podeCadastrarFuncao = temPermissao("Funcao", "cadastrar");

       if (!inputIdFuncao.value && podeCadastrarFuncao) {
    
            const resultado = await Swal.fire({
                icon: 'question',
                title: `Deseja cadastrar "${desc.toUpperCase()}" como nova Função?`,
                text: `Função "${desc.toUpperCase()}" não encontrado`,
                showCancelButton: true,
                confirmButtonText: "Sim, cadastrar",
                cancelButtonText: "Cancelar",
                reverseButtons: true,
                focusCancel: true
            });

                console.log("Resultado do Swal:", resultado);
            if (!resultado.isConfirmed) {
                console.log("Usuário cancelou o cadastro da Função.");
                elementoAtual.value = ""; // Limpa o campo se não for cadastrar
                setTimeout(() => {
                    elementoAtual.focus();
                }, 0);
                return;
            }
        
        }else if (!podeCadastrarFuncao) {
            Swal.fire({
                icon: "info",
                title: "Função não cadastrada",
                text: "Você não tem permissão para cadastrar função.",
                confirmButtonText: "OK"
            });
        }
        
    }
}



function limparFuncaoOriginal() {
    window.FuncaoOriginal = {
        idFuncao: "",
        descFuncao: "",
        vlrCusto: "",
        vlrVenda: "",
        obsFuncao:""
    };
}

function limparCamposFuncao() {
    const campos = ["idFuncao", "descFuncao","Custo", "Venda", "ajdCusto", "ObsAjc" ];
    campos.forEach(id => {
        const campo = document.getElementById(id);
        if (campo) campo.value = "";
    });
    
}

function fetchComToken(url, options = {}) {
  const token = localStorage.getItem("token");
  const idempresa = localStorage.getItem("idempresa");
  if (!token) {
    throw new Error("fetchComToken: nenhum token encontrado. Faça login primeiro.");
  }

  if (!idempresa) {
    throw new Error("fetchComToken: nenhum idempresa encontrado. Selecione uma empresa.");
  }
  // Monta os headers sempre incluindo Authorization
  const headers = {
    "Authorization": `Bearer ${token}`,
    "idempresa": options.headers?.idempresa || idempresa,
    // só coloca Content-Type se houver body (POST/PUT)
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...options.headers
  };

  return fetch(url, {
    ...options,
    headers,
    // caso seu back-end esteja em outro host e precisa de CORS:
    mode: "cors",
    // se precisar enviar cookies de sessão:
    credentials: "include"
  });
}

function configurarEventosFuncao() {
    console.log("Configurando eventos Funcao...");
    verificaFuncao(); // Carrega os Funcao ao abrir o modal
    adicionarEventoBlurFuncao();
    console.log("Entrou configurar Funcao no FUNCAO.js.");
    

} 
window.configurarEventosFuncao = configurarEventosFuncao;

function configurarEventosEspecificos(modulo) {
  console.log("⚙️ configurarEventosEspecificos recebeu:", modulo);
  if (modulo.trim().toLowerCase() === 'funcao') {
    configurarEventosFuncao();
  }
}
window.configurarEventosEspecificos = configurarEventosEspecificos;
