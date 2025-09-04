
import { fetchComToken, aplicarTema } from '../utils/utils.js';


document.addEventListener("DOMContentLoaded", function () {
    const idempresa = localStorage.getItem("idempresa");
    if (idempresa) {
        let tema = idempresa == 1 ? "JA-Oper" : "ES";
        aplicarTema(tema);
    }
});

let limparFuncaoButtonListener = null;
let enviarFuncaoButtonListener = null;
let pesquisarFuncaoButtonListener = null;
let selectFuncaoChangeListener = null;
let inputDescFuncaoInputListener = null; 
let inputDescFuncaoBlurListener = null;  
let blurFuncaoCampoListener = null;

if (typeof window.FuncaoOriginal === "undefined") {
    window.FuncaoOriginal = {
        idFuncao: "",
        descFuncao: "",
        vlrCusto: "",
        vlrVenda: "",
        vlrTransporte: "",
        vlrAlmoco: "",
        vlrJantar: "",
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
        console.log("Limpando Funcao...");
        const campo = document.getElementById("descFuncao");

        if (campo && campo.tagName.toLowerCase() === "select") {
            const input = document.createElement("input");
            input.type = "text";
            input.id = "descFuncao";
            input.name = "descFuncao";
            input.value = "Descrição da Função";
            input.className = "form";
            input.classList.add('uppercase');
            input.required = true;

            campo.parentNode.replaceChild(input, campo);
            adicionarEventoBlurFuncao();

            const label = document.querySelector('label[for="descFuncao"]');
            if (label) label.style.display = "block";

        }
        
        limparCamposFuncao();

    });

    botaoEnviar.addEventListener("click", async function (event) {
        event.preventDefault(); // Previne o envio padrão do formulário
        console.log("Enviando Funcao...");

        const idFuncao = document.querySelector("#idFuncao").value;
        const descFuncao = document.querySelector("#descFuncao").value.toUpperCase().trim();
        const vlrCusto = document.querySelector("#Custo").value;
        const vlrVenda = document.querySelector("#Venda").value;
        const vlrTransporte = document.querySelector("#transporte").value;
        const vlrAlmoco = document.querySelector("#almoco").value;
        const vlrJantar = document.querySelector("#jantar").value;
        const obsProposta = document.querySelector("#obsProposta").value.trim();
        const obsFuncao = document.querySelector("#obsFuncao").value.trim();
    
        const custo = parseFloat(String(vlrCusto).replace(",", "."));
        const venda = parseFloat(String(vlrVenda).replace(",", "."));
        const transporte = parseFloat(String(vlrTransporte).replace(",", "."));
        const almoco = parseFloat(String(vlrAlmoco).replace(",", "."));
        const jantar = parseFloat(String(vlrJantar).replace(",", "."));

       // Permissões
        const temPermissaoCadastrar = temPermissao("Funcao", "cadastrar");
        const temPermissaoAlterar = temPermissao("Funcao", "alterar");

        console.log("temPermissaoCadastrar:", temPermissaoCadastrar);
        console.log("temPermissaoAlterar:", temPermissaoAlterar);

        const metodo = idFuncao ? "PUT" : "POST";

        if (!idFuncao && !temPermissaoCadastrar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para cadastrar novas funções.", "error");
        }

        if (idFuncao && !temPermissaoAlterar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para alterar funções.", "error");
        }

        console.log("campos antes de salvar", idFuncao, descFuncao, custo, venda, obsProposta, obsFuncao, transporte, almoco, jantar);
 
        if (!descFuncao || !vlrCusto || !vlrVenda) {
           
            Swal.fire({
                icon: 'warning',
                title: 'Campos obrigatórios!',
                text: 'Preencha todos os campos antes de enviar.',
                confirmButtonText: 'Entendi'
            });
            return;
        }
        console.log("Valores do Funcao:", idFuncao, descFuncao, custo, venda, transporte, obsProposta, obsFuncao, almoco, jantar);
        console.log("Valores do Funcao Original:", window.FuncaoOriginal.idFuncao, window.FuncaoOriginal.descFuncao, window.FuncaoOriginal.vlrCusto, window.FuncaoOriginal.vlrVenda, window.FuncaoOriginal.vlrTransporte, window.FuncaoOriginal.obsFuncao, window.FuncaoOriginal.vlrAlmoco, window.FuncaoOriginal.vlrJantar);
            
        // Comparar com os valores originais
        if (
            parseInt(idFuncao) === parseInt(window.FuncaoOriginal.idFuncao) && 
            descFuncao === window.FuncaoOriginal.descFuncao && 
            Number(custo).toFixed(2) === Number(window.FuncaoOriginal.vlrCusto).toFixed(2) &&
            Number(venda).toFixed(2) === Number(window.FuncaoOriginal.vlrVenda).toFixed(2) &&
            Number(transporte).toFixed(2) === Number(window.FuncaoOriginal.vlrTransporte).toFixed(2) &&
            Number(almoco).toFixed(2) === Number(window.FuncaoOriginal.vlrAlmoco).toFixed(2) &&
            Number(jantar).toFixed(2) === Number(window.FuncaoOriginal.vlrJantar).toFixed(2) &&
            obsProposta === window.FuncaoOriginal.obsProposta&&
            obsFuncao === window.FuncaoOriginal.obsFuncao 
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

        const dados = { descFuncao, custo, venda, transporte, obsProposta, obsFuncao, almoco, jantar };
        const token = localStorage.getItem('token');
        const idEmpresa = localStorage.getItem('idEmpresa');

        console.log("Dados a serem enviados:", dados);
        console.log("ID da empresa:", idEmpresa);
     
        if (idFuncao) {
            const { isConfirmed } = await Swal.fire({
                title: "Deseja salvar as alterações?",
                text: "Você está prestes a atualizar os dados da função.",
                icon: "question",
                showCancelButton: true,
                confirmButtonText: "Sim, salvar",
                cancelButtonText: "Cancelar",
                reverseButtons: true,
                focusCancel: true
            });

            if (!isConfirmed) return; 

            try {
                
                const resultJson = await fetchComToken(`/funcao/${idFuncao}`, {
                    method: "PUT",
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(dados)
                });

            
                Swal.fire("Sucesso!", resultJson.message || "Alterações salvas com sucesso!", "success"); 
                document.getElementById('form').reset();
                document.querySelector("#idFuncao").value = "";
                limparFuncaoOriginal();

            } catch (error) {
                console.error("Erro ao enviar dados (PUT):", error);
                
                Swal.fire("Erro", error.message || "Erro ao salvar a Função.", "error");
            }
        } else {
            // Lógica para POST (Salvar novo)
            try {
                
                const resultJson = await fetchComToken("/funcao", {
                    method: "POST",
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(dados) // Passe o objeto dados diretamente
                });
            
                Swal.fire("Sucesso!", resultJson.mensagem || "Função cadastrada!", "success"); 
                document.getElementById('form').reset(); 
                limparFuncaoOriginal();
                document.querySelector("#idFuncao").value = "";

            } catch (error) {
                console.error("Erro ao enviar dados (POST):", error);            
                Swal.fire("Erro", error.message || "Erro ao cadastrar a Função.", "error");
            }
        }           
    });
    
    console.log("botaoPesquisar:", botaoPesquisar);
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
            const input = document.querySelector("#descFuncao");
            const desc = input?.value?.trim() || "";

            const funcoes = await fetchComToken(`/funcao?descFuncao=${encodeURIComponent(desc)}`);
          
            const select = criarSelectFuncao(funcoes);
            limparCamposFuncao();
            
               
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
                novoInput.classList.add('uppercase');
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


// Variável global para armazenar o último elemento clicado
if (!window.ultimoClique) {
    window.ultimoClique = null;
  
}
// Captura o último elemento clicado no documento (uma única vez)
document.addEventListener("mousedown", (e) => {
    window.ultimoClique = e.target;
});

function adicionarEventoBlurFuncao() {
    const input = document.querySelector("#descFuncao");
    if (!input) return;

    input.addEventListener("blur", async function () {
        console.log("Blur no campo descFuncao:", this.value);

        const botoesIgnorados = ["Limpar", "Pesquisar", "Close"];
        const ehBotaoIgnorado =
            (ultimoClique?.id && botoesIgnorados.includes(ultimoClique.id)) ||
            (ultimoClique?.classList && ultimoClique.classList.contains("close"));

        if (ehBotaoIgnorado) {
            console.log("🔁 Blur ignorado: clique em botão de controle (Fechar/Limpar/Pesquisar).");
            return;
        }

        const desc = this.value.trim();
        console.log("Campo descFuncao procurado:", desc);

        if (!desc) return;

        try {
            console.log("Buscando Função com descrição:", desc);
            await carregarFuncaoDescricao(desc, this);
            console.log("Função selecionada depois de carregarFuncaoDescricao:", this.value);
        } catch (error) {
            console.error("Erro ao buscar Função:", error);
        }
    });
}


async function carregarFuncaoDescricao(desc, elementoAtual) {
    console.log("Carregando Função com descrição:", desc, elementoAtual);
    try {
      
       const funcao = await fetchComToken(`/funcao?descFuncao=${encodeURIComponent(desc)}`);
      
       console.log("Resposta da busca de Função:", funcao);
       if (!funcao || !funcao.idfuncao) throw new Error("Função não encontrada");
     
        document.querySelector("#idFuncao").value = funcao.idfuncao;
        document.querySelector("#Custo").value = funcao.ctofuncao;
        document.querySelector("#Venda").value = funcao.vdafuncao;
        console.log("Valores da Função carregada:", funcao.ctofuncao, funcao.vdafuncao, funcao.transporte, funcao.almoco, funcao.jantar);
        document.querySelector("#transporte").value = funcao.transporte;
        document.querySelector("#almoco").value = funcao.almoco;
        document.querySelector("#jantar").value = funcao.jantar;
        document.querySelector("#obsProposta").value = funcao.obsproposta;
        document.querySelector("#obsFuncao").value = funcao.obsfuncao;
        
        window.FuncaoOriginal = {
            idFuncao: funcao.idfuncao,
            descFuncao: funcao.descfuncao,
            vlrCusto: funcao.ctofuncao,
            vlrVenda: funcao.vdafuncao,
            vlrTransporte: funcao.transporte,
            vlrAlmoco: funcao.almoco,
            vlrJantar: funcao.jantar,
            obsProposta: funcao.obsproposta,
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
        vlrTransporte: "",
        vlrAlmoco: "",
        vlrJantar: "",
        obsFuncao:"",
        ObsAjc:""
    };
}

function limparCamposFuncao() {
    const campos = ["idFuncao", "descFuncao","Custo", "Venda", "transporte", "almoco", "jantar", "ObsAjc"];
    campos.forEach(id => {
        const campo = document.getElementById(id);
        if (campo) campo.value = "";
    });
    
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

//   console.log("Resposta da requisição Funcao.js:", resposta);

//   let responseBody = null;
//   try {
//       // Primeiro, tente ler como JSON, pois é o mais comum para APIs
//       responseBody = await resposta.json();
//   } catch (jsonError) {
//       // Se falhar (não é JSON, ou resposta vazia, etc.), tente ler como texto
//       try {
//           responseBody = await resposta.text();
//       } catch (textError) {
//           // Se nem como texto conseguir, assume que não há corpo lido ou que é inválido
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
//       window.location.href = "login.html"; // ajuste conforme necessário
//     });
//     //return;
//     throw new Error('Sessão expirada'); 
//   }

//   if (!resposta.ok) {
//         // Se a resposta NÃO foi bem-sucedida (status 4xx ou 5xx)
//         // Use o responseBody já lido para obter a mensagem de erro
//         const errorMessage = (responseBody && responseBody.erro) || (responseBody && responseBody.message) || responseBody || resposta.statusText;
//         throw new Error(`Erro na requisição: ${errorMessage}`);
//   }

//   return responseBody;
// }


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

    if (typeof aplicarPermissoes === "function" && window.permissoes) {// 01/06/2025
      aplicarPermissoes(window.permissoes);
    } else {
      console.warn("⚠️ aplicarPermissoes ou window.permissoes ainda não estão disponíveis.");
    }
  
  }
}
window.configurarEventosEspecificos = configurarEventosEspecificos;


function desinicializarFuncaoModal() { // Renomeado para seguir o padrão 'desinicializarBancosModal'
    console.log("🧹 Desinicializando módulo Funcao.js...");

    const botaoEnviar = document.querySelector("#Enviar");
    const botaoPesquisar = document.querySelector("#Pesquisar");
    const botaoLimpar = document.querySelector("#Limpar");
    const descFuncaoElement = document.getElementById("descFuncao"); // Pode ser input ou select

    // 1. Remover listeners de eventos dos botões fixos (usando as variáveis `let`)
    if (botaoLimpar && limparFuncaoButtonListener) {
        botaoLimpar.removeEventListener("click", limparFuncaoButtonListener);
        limparFuncaoButtonListener = null; // Zera a referência
        console.log("Listener de click do Limpar (Funcao) removido.");
    }
    if (botaoEnviar && enviarFuncaoButtonListener) {
        botaoEnviar.removeEventListener("click", enviarFuncaoButtonListener);
        enviarFuncaoButtonListener = null; // Zera a referência
        console.log("Listener de click do Enviar (Funcao) removido.");
    }
    if (botaoPesquisar && pesquisarFuncaoButtonListener) {
        botaoPesquisar.removeEventListener("click", pesquisarFuncaoButtonListener);
        pesquisarFuncaoButtonListener = null; // Zera a referência
        console.log("Listener de click do Pesquisar (Funcao) removido.");
    }

    // 2. Remover listeners de elementos dinâmicos (#descFuncao)
    if (descFuncaoElement) {
        if (descFuncaoElement.tagName.toLowerCase() === "select" && selectFuncaoChangeListener) {
            descFuncaoElement.removeEventListener("change", selectFuncaoChangeListener);
            selectFuncaoChangeListener = null;
            console.log("Listener de change do select descFuncao removido.");
        }
        if (descFuncaoElement.tagName.toLowerCase() === "input") {
            if (inputDescFuncaoInputListener) {
                descFuncaoElement.removeEventListener("input", inputDescFuncaoInputListener);
                inputDescFuncaoInputListener = null;
                console.log("Listener de input do descFuncao (input) removido.");
            }
            if (inputDescFuncaoBlurListener) {
                descFuncaoElement.removeEventListener("blur", inputDescFuncaoBlurListener);
                inputDescFuncaoBlurListener = null;
                console.log("Listener de blur do descFuncao (input) removido.");
            }
            // Se 'adicionarEventoBlurFuncao' adiciona um listener com uma referência que está em 'blurFuncaoCampoListener'
            if (blurFuncaoCampoListener) {
                 descFuncaoElement.removeEventListener("blur", blurFuncaoCampoListener);
                 blurFuncaoCampoListener = null;
                 console.log("Listener adicional de blur do descFuncao (input) removido.");
            }
        }
    }
    
    // 3. Limpar o estado global FuncaoOriginal
    // Assumindo que window.FuncaoOriginal existe, ou defina-o como um objeto vazio
    window.FuncaoOriginal = { idFuncao: "", descFuncao: "", vlrCusto: 0, vlrVenda: 0, vlrTransporte: 0, obsFuncao: "", vlrAlmoco: 0, vlrJantar: 0 };
    limparCamposFuncao(); // Chame a função que limpa os campos do formulário para garantir um estado limpo
    document.getElementById('form').reset(); // Garante que o formulário seja resetado
    document.querySelector("#idFuncao").value = ""; // Garante que o ID oculto seja limpo

    console.log("✅ Módulo Funcao.js desinicializado.");
}
// Torna a função de desinicialização global para ser chamada pelo sistema de módulos


window.moduloHandlers = window.moduloHandlers || {}; // Garante que o objeto existe

// Registra as funções de configuração e desinicialização para o módulo 'Funcao'
window.moduloHandlers['Funcao'] = { // Use 'Funcao' (com F maiúsculo) para corresponder ao seu mapaModulos no Index.js
    configurar: configurarEventosFuncao, // Usa a nova função de inicialização
    desinicializar: desinicializarFuncaoModal // Usa a nova função de desinicialização
};
