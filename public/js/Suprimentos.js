import { fetchComToken } from '../utils/utils.js';

if (typeof window.SuprimentoOriginal === "undefined") {
    window.SuprimentoOriginal = {
        idSup: "",
        descSup: "",
        vlrCusto: "",
        vlrVenda: ""
    };
}


function verificaSuprimento() {

    console.log("Carregando Suprimento...");
    
    
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

        limparCamposSuprimento();

    });

    botaoEnviar.addEventListener("click", async function (event) {
        event.preventDefault(); // Previne o envio padrão do formulário

        console.log("ENVIANDO DADOS DO Suprimento PELO Suprimento.JS", document);

        const idSup = document.querySelector("#idSup").value.trim();
        const descSup = document.querySelector("#descSup").value.toUpperCase().trim();
        const vlrCusto = document.querySelector("#ctoSup").value;
        const vlrVenda = document.querySelector("#vdaSup").value;
    
        const custo = parseFloat(String(vlrCusto).replace(",", "."));
        const venda = parseFloat(String(vlrVenda).replace(",", "."));

        // Permissões
        const temPermissaoCadastrar = temPermissao("Suprimentos", "cadastrar");
        const temPermissaoAlterar = temPermissao("Suprimentos", "alterar");

        const metodo = idSup ? "PUT" : "POST";

        if (!idSup && !temPermissaoCadastrar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para cadastrar novo suprimento.", "error");
        }

        if (idSup && !temPermissaoAlterar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para alterar suprimentos.", "error");
        }
    
        if (!descSup || !vlrCusto || !vlrVenda) {
           
            Swal.fire({
                icon: 'warning',
                title: 'Campos obrigatórios!',
                text: 'Preencha todos os campos antes de enviar.',
                confirmButtonText: 'Entendi'
            });
            return;
        }
        console.log("Valores do Suprimento:", idSup, descSup, custo, venda);
        console.log("Valores do Suprimento Original:", window.SuprimentoOriginal.idSup, window.SuprimentoOriginal.descSup, window.SuprimentoOriginal.vlrCusto, window.SuprimentoOriginal.vlrVenda);
    
        // Comparar com os valores originais
        if (
            parseInt(idSup) === parseInt(window.SuprimentoOriginal.idSup) && 
            descSup === window.SuprimentoOriginal.descSup && 
            Number(custo).toFixed(2) === Number(window.SuprimentoOriginal.vlrCusto).toFixed(2) &&
            Number(venda).toFixed(2) === Number(window.SuprimentoOriginal.vlrVenda).toFixed(2)
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
    
        const dados = { descSup, custo, venda };

        const url = idSup
            ? `/suprimentos/${idSup}`
            : "/suprimentos";


        try {
            // Confirma alteração (PUT)
            if (metodo === "PUT") {
                const { isConfirmed } = await Swal.fire({
                    title: "Deseja salvar as alterações?",
                    text: "Você está prestes a atualizar os dados do Suprimentos.",
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
                body: JSON.stringify(dados)
            });            

            await Swal.fire("Sucesso!", respostaApi.message || "Suprimento salvo com sucesso.", "success");
            limparCamposSuprimento();

        } catch (error) {
            console.error("Erro ao enviar dados:", error);
            Swal.fire("Erro", error.message || "Erro ao salvar suprimento.", "error");
        }
    });


    botaoPesquisar.addEventListener("click", async function (event) {
        event.preventDefault();
        limparCamposSuprimento();
        
        console.log("Pesquisando Suprimento...");
        const temPermissaoPesquisar = temPermissao('Suprimentos', 'pesquisar');
        if (!temPermissaoPesquisar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para pesquisar.", "warning");
        }

        try {
            const suprimentos = await fetchComToken("/suprimentos"); // ajuste a rota conforme sua API
            
            console.log("Suprimentos encontrados:", suprimentos);

            const select = criarSelectSuprimento(suprimentos);
            limparCamposSuprimento();

            const input = document.querySelector("#descSup");
               
            if (input && input.parentNode) {
                input.parentNode.replaceChild(select, input);
            }
   
            const label = document.querySelector('label[for="descSup"]');
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

                await carregarSuprimentoDescricao(desc, this);

                const novoInput = document.createElement("input");
                novoInput.type = "text";
                novoInput.id = "descSup";
                novoInput.name = "descSup";
                novoInput.required = true;
                novoInput.className = "form";
                novoInput.value = desc;
            
                novoInput.addEventListener("input", function() {
                    this.value = this.value.toUpperCase(); // transforma o texto em maiúsculo à medida que o usuário digita
                });

                this.parentNode.replaceChild(novoInput, this);
                adicionarEventoBlurSuprimento();
               
                const label = document.querySelector('label[for="descSup"]');
                if (label) {
                label.style.display = "block";
                label.textContent = "Descrição do Suprimento"; // ou algum texto que você tenha guardado
                }
              
                novoInput.addEventListener("blur", async function () {
                    if (!this.value.trim()) return;
                    await carregarSuprimentoDescricao(this.value, this);
                });
 
         });
    
        } catch (error) {
            console.error("Erro ao carregar Suprimentos:", error);
            Swal.fire({
                icon: 'error',
                title: 'Erro',
                text: 'Não foi possível carregar os suprimentos.',
                confirmButtonText: 'Ok'
            });
        }
    });
    

}
function criarSelectSuprimento(suprimentos) {
   
    const select = document.createElement("select");
    select.id = "descSup";
    select.name = "descSup";
    select.required = true;
    select.className = "form";

   
    // Adicionar opções
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.text = "Selecione um Suprimento...";
    defaultOption.disabled = true;
    defaultOption.selected = true;
    select.appendChild(defaultOption);
   
    console.log("PESQUISANDO SUPRIMENTO:", suprimentos);

    suprimentos.forEach(suprimentosachado => {
        const option = document.createElement("option");
        option.value = suprimentosachado.descsup;
        option.text = suprimentosachado.descsup;
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

function adicionarEventoBlurSuprimento() {
    const input = document.querySelector("#descSup");
    if (!input) return;
        
    input.addEventListener("blur", async function () {
       
        const botoesIgnorados = ["Limpar", "Pesquisar", "Close"];
        const ehBotaoIgnorado =
            ultimoClique?.id && botoesIgnorados.includes(ultimoClique.id) ||
             (ultimoClique?.classList && ultimoClique.classList.contains("close"));

        if (ehBotaoIgnorado) {
            console.log("🔁 Blur ignorado: clique em botão de controle (Fechar/Limpar/Pesquisar).");
            return;
        }

        const desc = this.value.trim();
        console.log("Campo descSup procurado:", desc);

        if (!desc) return;

        try {
            await carregarSuprimentoDescricao(desc, this);
            console.log("Suprimento selecionado depois de carregarSuprimentoDescricao:", this.value);
        } catch (error) {
            console.error("Erro ao buscar Suprimentos:", error);
        }
    });
}

async function carregarSuprimentoDescricao(desc, elementoAtual) {
    try {
        const suprimentos = await fetchComToken(`/suprimentos?descSup=${encodeURIComponent(desc)}`);
        
        document.querySelector("#idSup").value = suprimentos.idsup;
        document.querySelector("#ctoSup").value = suprimentos.ctosup;
        document.querySelector("#vdaSup").value = suprimentos.vdasup
        window.SuprimentoOriginal = {
            idSup: suprimentos.idsup,
            descSup: suprimentos.descsup,
            vlrCusto: suprimentos.ctosup,
            vlrVenda: suprimentos.vdasup
        };   
    

    } catch (error) {
        
         
        console.warn("Suprimento não encontrado.");

        const inputIdSuprimento = document.querySelector("#idSup");
        const podeCadastrarSuprimento = temPermissao("Suprimentos", "cadastrar");

       if (!inputIdSuprimento.value && podeCadastrarSuprimento) {
             const resultado = await Swal.fire({
                icon: 'question',
                title: `Deseja cadastrar "${desc.toUpperCase()}" como novo Suprimento?`,
                text: `Suprimento "${desc.toUpperCase()}" não encontrado.`,
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
                console.log("Usuário cancelou o cadastro do Suprimento.");
                elementoAtual.value = ""; // Limpa o campo se não for cadastrar
                setTimeout(() => {
                    elementoAtual.focus();
                }, 0);
                return;
            }
        } else if (!podeCadastrarSuprimento) {
            Swal.fire({
                icon: "info",
                title: "Suprimento não cadastrado",
                text: "Você não tem permissão para cadastrar suprimentos.",
                confirmButtonText: "OK"
            });
        }
    }
}


function limparSuprimentoOriginal() {
    window.SuprimentoOriginal = {
        idSup: "",
        descSup: "",
        vlrCusto: "",
        vlrVenda: ""
    };
}



function limparCamposSuprimento() {
    
    const idSup = document.getElementById("idSup");
    const descSupEl = document.getElementById("descSup");
    const ctoSup = document.getElementById("ctoSup");
    const vdaSup = document.getElementById("vdaSup");

    if (idSup) idSup.value = "";
    if (ctoSup) ctoSup.value = "";
    if (vdaSup) vdaSup.value = "";

    if (descSupEl && descSupEl.tagName === "SELECT") {
        // Se for SELECT, trocar por INPUT
        const novoInput = document.createElement("input");
        novoInput.type = "text";
        novoInput.id = "descSup";
        novoInput.name = "descSup";
        novoInput.required = true;
        novoInput.className = "form";

        // Configura o evento de transformar texto em maiúsculo
        novoInput.addEventListener("input", function () {
            this.value = this.value.toUpperCase();
        });

        // Reativa o evento blur
        novoInput.addEventListener("blur", async function () {
            if (!this.value.trim()) return;
            await carregarSuprimentoDescricao(this.value, this);
        });

        descSupEl.parentNode.replaceChild(novoInput, descSupEl);
        adicionarEventoBlurSuprimento();

        const label = document.querySelector('label[for="descSup"]');
        if (label) {
            label.style.display = "block";
            label.textContent = "Descrição do Suprimento";
        }
    } else if (descSupEl) {
        // Se for input normal, só limpa
        descSupEl.value = "";
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

//   console.log("Resposta da requisição Suprimentos.js:", resposta);

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

function configurarEventosSuprimento() {
    console.log("Configurando eventos Suprimento...");
    verificaSuprimento(); // Carrega os Suprimento ao abrir o modal
    adicionarEventoBlurSuprimento(); // Adiciona o evento blur ao campo de descrição
    console.log("Entrou configurar Suprimento no EQUIPAMENTO.js.");
    

} 
window.configurarEventosSuprimento = configurarEventosSuprimento;

function configurarEventosEspecificos(modulo) {
  console.log("⚙️ configurarEventosEspecificos recebeu:", modulo);
  if (modulo.trim().toLowerCase() === 'suprimentos') {
    console.log("Modulo", modulo.trim().toLowerCase() );
    configurarEventosSuprimento();
    
    if (typeof aplicarPermissoes === "function" && window.permissoes) {
      aplicarPermissoes(window.permissoes);
    } else {
      console.warn("⚠️ aplicarPermissoes ou window.permissoes ainda não estão disponíveis para LocalMontagem.");
    }
  }
}
window.configurarEventosEspecificos = configurarEventosEspecificos;
