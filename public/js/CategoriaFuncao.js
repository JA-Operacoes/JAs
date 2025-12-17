import { fetchComToken, aplicarTema } from '../utils/utils.js';


// document.addEventListener("DOMContentLoaded", function () {
//     const idempresa = localStorage.getItem("idempresa");
//     if (idempresa) {
//         let tema = idempresa == 1 ? "JA-Oper" : "ES";
//         aplicarTema(tema);
//     }
// });

document.addEventListener("DOMContentLoaded", function () {
    const idempresa = localStorage.getItem("idempresa");

    if (idempresa) {
        const apiUrl = `/empresas/${idempresa}`; // Verifique o caminho da sua API

        fetchComToken(apiUrl)
            .then(empresa => {
                // Usa o nome fantasia como tema
                const tema = empresa.nmfantasia;
                aplicarTema(tema);
            })
            .catch(error => {
                console.error("❌ Erro ao buscar dados da empresa para o tema:", error);
                // aplicarTema('default');
            });
    }
});

let limparCatFuncaoButtonListener = null;
let enviarCatFuncaoButtonListener = null;
let pesquisarCatFuncaoButtonListener = null;
let selectCatFuncaoChangeListener = null;
let inputDescCatFuncaoInputListener = null; 
let inputDescCatFuncaoBlurListener = null;  
let blurCatFuncaoCampoListener = null;

if (typeof window.CatFuncaoOriginal === "undefined") {
    window.CatFuncaoOriginal = {
        idCatFuncao: "",
        descCatFuncao: "",
        vlrCustoSenior: "",
        vlrCustoPleno: "",
        vlrCustoJunior: "",
        vlrCustoBase: "",
        vlrVenda: "",
        vlrTransporte: "",
        vlrTransporteSenior: "",
        vlrAlmoco: "",
        vlrAlimentacao: "",
        valorFuncionario: ""

    }
};

function verificaCatFuncao() {

    console.log("Carregando CategoriaFuncao...");
       
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
        console.log("Limpando Categoria Funcao...");
        const campo = document.getElementById("descCatFuncao");

        if (campo && campo.tagName.toLowerCase() === "select") {
            const input = document.createElement("input");
            input.type = "text";
            input.id = "descCatFuncao";
            input.name = "descCatFuncao";
            input.value = "Descrição da Função";
            input.className = "form";
            input.classList.add('uppercase');
            input.required = true;

            campo.parentNode.replaceChild(input, campo);
            adicionarEventoBlurCatFuncao();

            const label = document.querySelector('label[for="descCatFuncao"]');
            if (label) label.style.display = "block";

        }
        
        limparCamposCatFuncao();

    });

    botaoEnviar.addEventListener("click", async function (event) {
        event.preventDefault(); // Previne o envio padrão do formulário
        console.log("Enviando Categoria Funcao...");

        const idCatFuncao = document.querySelector("#idCatFuncao").value;
        const descCatFuncao = document.querySelector("#descCatFuncao").value.toUpperCase().trim();
        const vlrFuncionario = document.querySelector("#valorFuncionario").value || 0.00;
        const vlrCustoSenior = document.querySelector("#CustoSenior").value || 0.00;
        const vlrCustoPleno = document.querySelector("#CustoPleno").value || 0.00;
        const vlrCustoJunior = document.querySelector("#CustoJunior").value || 0.00;
        const vlrCustoBase = document.querySelector("#CustoBase").value || 0.00;
        const vlrVenda = document.querySelector("#Venda").value || 0.00;
        const vlrTransporte = document.querySelector("#transporte").value || 0.00;
        const vlrTransporteSenior = document.querySelector("#TranspSenior").value || 0.00;      
        const vlrAlimentacao = document.querySelector("#alimentacao").value || 0.00;    
        
        const valorFuncionario = parseFloat(String(vlrFuncionario).replace(",", "."));
        const custoSenior = parseFloat(String(vlrCustoSenior).replace(",", "."));
        const custoPleno = parseFloat(String(vlrCustoPleno).replace(",", "."));
        const custoJunior = parseFloat(String(vlrCustoJunior).replace(",", "."));
        const custoBase = parseFloat(String(vlrCustoBase).replace(",", "."));
        const venda = parseFloat(String(vlrVenda).replace(",", "."));
        const transporte = parseFloat(String(vlrTransporte).replace(",", "."));
        const transporteSenior = parseFloat(String(vlrTransporteSenior).replace(",", "."));
     
        const alimentacao = parseFloat(String(vlrAlimentacao).replace(",", "."));

       // Permissões
        const temPermissaoCadastrar = temPermissao("categoriafuncao", "cadastrar");
        const temPermissaoAlterar = temPermissao("categoriafuncao", "alterar");

        console.log("temPermissaoCadastrar:", temPermissaoCadastrar);
        console.log("temPermissaoAlterar:", temPermissaoAlterar);

        const metodo = idCatFuncao ? "PUT" : "POST";

        if (!idCatFuncao && !temPermissaoCadastrar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para cadastrar novas funções.", "error");
        }

        if (idCatFuncao && !temPermissaoAlterar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para alterar funções.", "error");
        }

        console.log("campos antes de salvar", idCatFuncao, descCatFuncao, valorFuncionario, custoSenior, custoPleno, custoJunior, custoBase, venda,  transporte, transporteSenior, alimentacao);

         if (!descCatFuncao) { // || !venda

            Swal.fire({
                icon: 'warning',
                title: 'Campos obrigatórios!',
                text: 'Preencha todos os campos antes de enviar.',
                confirmButtonText: 'Entendi'
            });
            return;
        }
        console.log("Valores do Funcao:", idCatFuncao, descCatFuncao, valorFuncionario, custoSenior, custoPleno, custoJunior, custoBase, venda, transporte, transporteSenior, alimentacao);
        console.log("Valores do Funcao Original:", window.CatFuncaoOriginal.idCatFuncao, window.CatFuncaoOriginal.descCatFuncao, window.CatFuncaoOriginal.valorFuncionario, window.CatFuncaoOriginal.vlrCusto, window.CatFuncaoOriginal.vlrCustoSenior,
            window.CatFuncaoOriginal.vlrCustoPleno, window.CatFuncaoOriginal.vlrCustoJunior, window.CatFuncaoOriginal.vlrBase, window.CatFuncaoOriginal.vlrVenda, window.CatFuncaoOriginal.vlrTransporte, 
            window.CatFuncaoOriginal.vlrTransporteSenior,  window.CatFuncaoOriginal.vlrAlimentacao);
            
        // Comparar com os valores originais
        if (
            parseInt(idCatFuncao) === parseInt(window.CatFuncaoOriginal.idCatFuncao) && 
            descCatFuncao === window.CatFuncaoOriginal.descCatFuncao && 
            Number(valorFuncionario).toFixed(2) === Number(window.CatFuncaoOriginal.vlrFuncionario).toFixed(2) &&
            Number(custoSenior).toFixed(2) === Number(window.CatFuncaoOriginal.vlrCustoSenior).toFixed(2) &&
            Number(custoPleno).toFixed(2) === Number(window.CatFuncaoOriginal.vlrCustoPleno).toFixed(2) &&
            Number(custoJunior).toFixed(2) === Number(window.CatFuncaoOriginal.vlrCustoJunior).toFixed(2) &&
            Number(custoBase).toFixed(2) === Number(window.CatFuncaoOriginal.vlrBase).toFixed(2) &&
            Number(venda).toFixed(2) === Number(window.CatFuncaoOriginal.vlrVenda).toFixed(2) &&
            Number(transporte).toFixed(2) === Number(window.CatFuncaoOriginal.vlrTransporte).toFixed(2) &&
            Number(transporteSenior).toFixed(2) === Number(window.CatFuncaoOriginal.vlrTransporteSenior).toFixed(2) &&         
            Number(alimentacao).toFixed(2) === Number(window.CatFuncaoOriginal.vlrAlimentacao).toFixed(2)            
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

        const dados = { descCatFuncao, valorFuncionario, custoSenior, custoPleno, custoJunior, custoBase, venda, transporte, transporteSenior,alimentacao};
        const token = localStorage.getItem('token');
        const idEmpresa = localStorage.getItem('idEmpresa');

        console.log("Dados a serem enviados:", dados);
        console.log("ID da empresa:", idEmpresa);
     
        if (idCatFuncao) {
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
                
                const resultJson = await fetchComToken(`/categoriafuncao/${idCatFuncao}`, {
                    method: "PUT",
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(dados)
                });

            
                Swal.fire("Sucesso!", resultJson.message || "Alterações salvas com sucesso!", "success"); 
                document.getElementById('form').reset();
                document.querySelector("#idCatFuncao").value = "";
                limparCatFuncaoOriginal();

            } catch (error) {
                console.error("Erro ao enviar dados (PUT):", error);
                
                Swal.fire("Erro", error.message || "Erro ao salvar a Função.", "error");
            }
        } else {
            // Lógica para POST (Salvar novo)
            try {
                
                const resultJson = await fetchComToken("/categoriafuncao", {
                    method: "POST",
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(dados) // Passe o objeto dados diretamente
                });
            
                Swal.fire("Sucesso!", resultJson.mensagem || "Categoria Função cadastrada!", "success"); 
                document.getElementById('form').reset(); 
                limparCatFuncaoOriginal();
                document.querySelector("#idCatFuncao").value = "";

            } catch (error) {
                console.error("Erro ao enviar dados (POST):", error);            
                Swal.fire("Erro", error.message || "Erro ao cadastrar Categoria Função.", "error");
            }
        }           
    });
    
    console.log("botaoPesquisar:", botaoPesquisar);
    botaoPesquisar.addEventListener("click", async function (event) {
        event.preventDefault();
        console.log("Pesquisando Categoria Funcao...");

        limparCamposCatFuncao();
        console.log("Pesquisando Categoria Funcao...");

        const temPermissaoPesquisar = temPermissao('categoriafuncao', 'pesquisar');
        console.log("Tem permissão para pesquisar Função:", temPermissaoPesquisar);
        if (!temPermissaoPesquisar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para pesquisar.", "warning");
        }

        try {
            const input = document.querySelector("#descCatFuncao");
            const desc = input?.value?.trim() || "";

            const catfuncoes = await fetchComToken(`/categoriafuncao?descCatFuncao=${encodeURIComponent(desc)}`);

            if (!catfuncoes || catfuncoes.length === 0) {
                return Swal.fire({
                    icon: 'info',
                    title: 'Nenhuma categoria funcao cadastrada',
                    text: 'Não foi encontrado nenhuma categoria funcao no sistema.',
                    confirmButtonText: 'Ok'
                });
            }

            const select = criarSelectCatFuncao(catfuncoes);
            limparCamposCatFuncao();
            
               
            if (input && input.parentNode) {
                input.parentNode.replaceChild(select, input);
            }
   
            const label = document.querySelector('label[for="descCatFuncao"]');
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

                await carregarCatFuncaoDescricao(desc, this);

                const novoInput = document.createElement("input");
                novoInput.type = "text";
                novoInput.id = "descCatFuncao";
                novoInput.name = "descCatFuncao";
                novoInput.required = true;
                novoInput.className = "form";
                novoInput.classList.add('uppercase');
                novoInput.value = desc;
            
                novoInput.addEventListener("input", function() {
                    this.value = this.value.toUpperCase(); // transforma o texto em maiúsculo à medida que o usuário digita
                });

                this.parentNode.replaceChild(novoInput, this);
                adicionarEventoBlurCatFuncao();
               
                const label = document.querySelector('label[for="descCatFuncao"]');
                if (label) {
                label.style.display = "block";
                label.textContent = "Descrição da Categoria Função"; // ou algum texto que você tenha guardado
                }
              
                novoInput.addEventListener("blur", async function () {
                    if (!this.value.trim()) return;
                    await carregarCatFuncaoDescricao(this.value, this);
                });
 
         });
    
        } catch (error) {
            console.error("Erro ao carregar categorias funções:", error);
            Swal.fire({
                icon: 'error',
                title: 'Erro',
                text: 'Não foi possível carregar as categorias funções.',
                confirmButtonText: 'Ok'
            });
        }
    });
}


function criarSelectCatFuncao(catfuncoes) {
   
    const select = document.createElement("select");
    select.id = "descCatFuncao";
    select.name = "descCatFuncao";
    select.required = true;
    select.className = "form";

   
    // Adicionar opções
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.text = "Selecione uma função...";
    defaultOption.disabled = true;
    defaultOption.selected = true;
    select.appendChild(defaultOption);
   
    console.log("PESQUISANDO CATEGORIA FUNCAO:", catfuncoes);

    catfuncoes.forEach(catfuncaoachada => {
        const option = document.createElement("option");
        option.value = catfuncaoachada.nmcategoriafuncao;
        option.text = catfuncaoachada.nmcategoriafuncao;
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

function adicionarEventoBlurCatFuncao() {
    const input = document.querySelector("#descCatFuncao");
    if (!input) return;

    input.addEventListener("blur", async function () {
        console.log("Blur no campo descCatFuncao:", this.value);

        const botoesIgnorados = ["Limpar", "Pesquisar", "Close"];
        const ehBotaoIgnorado =
            (ultimoClique?.id && botoesIgnorados.includes(ultimoClique.id)) ||
            (ultimoClique?.classList && ultimoClique.classList.contains("close"));

        if (ehBotaoIgnorado) {
            console.log("🔁 Blur ignorado: clique em botão de controle (Fechar/Limpar/Pesquisar).");
            return;
        }

        const desc = this.value.trim();
        console.log("Campo descCatFuncao procurado:", desc);

        if (!desc) return;

        try {
            console.log("Buscando Categoria Função com descrição:", desc);
            await carregarCatFuncaoDescricao(desc, this);
            console.log("Categoria de Função selecionada depois de carregarCatFuncaoDescricao:", this.value);
        } catch (error) {
            console.error("Erro ao buscar Categoria Função:", error);
        }
    });
}


async function carregarCatFuncaoDescricao(desc, elementoAtual) {
    console.log("Carregando Função com descrição:", desc, elementoAtual);
    try {
      
       const catfuncao = await fetchComToken(`/categoriafuncao?descCatFuncao=${encodeURIComponent(desc)}`);
      
       console.log("Resposta da busca da Categoria Função:", catfuncao);

       //if (!funcao || !funcao.idcategoriafuncao) throw new Error("Função não encontrada");

       if (!catfuncao || catfuncao.length === 0 || !catfuncao.idcategoriafuncao) {
            // Lançamos o erro para forçar a entrada no bloco 'catch'
            throw new Error("Função não encontrada ou resposta inválida.");
        }
     
         document.querySelector("#idCatFuncao").value = catfuncao.idcategoriafuncao;
         document.querySelector("#valorFuncionario").value = catfuncao.vlrfuncionario || 0.00;
         document.querySelector("#CustoSenior").value = catfuncao.ctofuncaosenior || 0.00;
         document.querySelector("#CustoPleno").value = catfuncao.ctofuncaopleno || 0.00;
         document.querySelector("#CustoJunior").value = catfuncao.ctofuncaojunior || 0.00;
         document.querySelector("#CustoBase").value = catfuncao.ctofuncaobase || 0.00;
         document.querySelector("#Venda").value = catfuncao.vdafuncao || 0.00;
         document.querySelector("#transporte").value = catfuncao.transporte || 0.00;
         document.querySelector("#TranspSenior").value = catfuncao.transpsenior || 0.00;      
         document.querySelector("#alimentacao").value = catfuncao.alimentacao || 0.00;      
         
        console.log("Valores da Função carregada:", catfuncao.ctofuncaosenior, catfuncao.ctofuncaopleno, catfuncao.ctofuncaojunior, catfuncao.ctofuncaobase, catfuncao.vdafuncao, catfuncao.transporte, catfuncao.alimentacao);
        
        window.CatFuncaoOriginal = {
            idCatFuncao: catfuncao.idcategoriafuncao,
            descCatFuncao: catfuncao.nmcategoriafuncao,
            vlrCustoSenior: catfuncao.ctofuncaosenior,
            vlrCustoPleno: catfuncao.ctofuncaopleno,
            vlrCustoJunior: catfuncao.ctofuncaojunior,
            vlrCustoBase: catfuncao.ctofuncaobase,
            vlrVenda: catfuncao.vdafuncao,
            vlrTransporte: catfuncao.transporte,
            vlrTransporteSenior: catfuncao.transpsenior,
            vlrAlimentacao: catfuncao.alimentacao,
            vlrFuncionario: catfuncao.vlrfuncionario 
        };


    } catch (error) {
        
        const inputIdCatFuncao = document.querySelector("#idCatFuncao");
        const podeCadastrarCatFuncao = temPermissao("Categoriafuncao", "cadastrar");

       if (!inputIdCatFuncao.value && podeCadastrarCatFuncao) {
    
            const resultado = await Swal.fire({
                icon: 'question',
                title: `Deseja cadastrar "${desc.toUpperCase()}" como nova Categoria de Função?`,
                text: `Função "${desc.toUpperCase()}" não encontrado`,
                showCancelButton: true,
                confirmButtonText: "Sim, cadastrar",
                cancelButtonText: "Cancelar",
                reverseButtons: true,
                focusCancel: true
            });

            console.log("Resultado do Swal:", resultado);
            if (!resultado.isConfirmed) {
                console.log("Usuário cancelou o cadastro da Categoria de Função.");
                elementoAtual.value = ""; // Limpa o campo se não for cadastrar
                setTimeout(() => {
                    elementoAtual.focus();
                }, 0);
                return;
            }
        
        }else if (!podeCadastrarFuncao) {
            Swal.fire({
                icon: "info",
                title: "Categoria de Função não cadastrada",
                text: "Você não tem permissão para cadastrar categoria de função.",
                confirmButtonText: "OK"
            });
        }
        
    }
}

function limparCatFuncaoOriginal() {
    window.CatFuncaoOriginal = {
        idCatFuncao: "",
        descCatFuncao: "",
        vlrCustoBase: "",
        vlrCustoPleno: "",
        vlrCustoJunior: "",
        vlrCustoSenior: "",
        vlrVenda: "",
        vlrTransporte: "",
        vlrTransporteSenior: "",
        vlrAlmoco: "",
        vlrAlimentacao: "",
        valorFuncionario: ""     
    };
}

function limparCamposCatFuncao() {
    const campos = ["idCatFuncao", "descCatFuncao","CustoSenior", "CustoPleno", "CustoJunior", "CustoBase", "Venda", "transporte", "transporteSenior",  "alimentacao"];
    campos.forEach(id => {
        const campo = document.getElementById(id);
        if (campo) {
            if (campo.type === "checkbox") {
                campo.checked = false;
            } else {
                campo.value = "";
            }
        }
    });   
    
}

function configurarEventosCatFuncao() {
    console.log("Configurando eventos Funcao...");
    verificaCatFuncao(); // Carrega os Funcao ao abrir o modal
    adicionarEventoBlurCatFuncao();
    console.log("Entrou configurar CategoriaFuncao no CATEGORIAFUNCAO.js.");
} 
window.configurarEventosCatFuncao = configurarEventosCatFuncao;

function configurarEventosEspecificos(modulo) {
  console.log("⚙️ configurarEventosEspecificos recebeu:", modulo);
  
  if (modulo.trim().toLowerCase() === 'categoriafuncao') {
    
    configurarEventosCatFuncao();

    if (typeof aplicarPermissoes === "function" && window.permissoes) {// 01/06/2025
      aplicarPermissoes(window.permissoes);
    } else {
      console.warn("⚠️ aplicarPermissoes ou window.permissoes ainda não estão disponíveis.");
    }
  
  }
}
window.configurarEventosEspecificos = configurarEventosEspecificos;


function desinicializarCatFuncaoModal() { // Renomeado para seguir o padrão 'desinicializarBancosModal'
    console.log("🧹 Desinicializando módulo Funcao.js...");

    const botaoEnviar = document.querySelector("#Enviar");
    const botaoPesquisar = document.querySelector("#Pesquisar");
    const botaoLimpar = document.querySelector("#Limpar");
    const descCatFuncaoElement = document.getElementById("descCatFuncao"); // Pode ser input ou select

    // 1. Remover listeners de eventos dos botões fixos (usando as variáveis `let`)
    if (botaoLimpar && limparCatFuncaoButtonListener) {
        botaoLimpar.removeEventListener("click", limparCatFuncaoButtonListener);
        limparCatFuncaoButtonListener = null; // Zera a referência
        console.log("Listener de click do Limpar (Funcao) removido.");
    }
    if (botaoEnviar && enviarCatFuncaoButtonListener) {
        botaoEnviar.removeEventListener("click", enviarCatFuncaoButtonListener);
        enviarCatFuncaoButtonListener = null; // Zera a referência
        console.log("Listener de click do Enviar (Funcao) removido.");
    }
    if (botaoPesquisar && pesquisarCatFuncaoButtonListener) {
        botaoPesquisar.removeEventListener("click", pesquisarCatFuncaoButtonListener);
        pesquisarCatFuncaoButtonListener = null; // Zera a referência
        console.log("Listener de click do Pesquisar (Funcao) removido.");
    }

    // 2. Remover listeners de elementos dinâmicos (#descCatFuncao)
    if (descCatFuncaoElement) {
        if (descCatFuncaoElement.tagName.toLowerCase() === "select" && selectCatFuncaoChangeListener) {
            descCatFuncaoElement.removeEventListener("change", selectCatFuncaoChangeListener);
            selectFuncaoChangeListener = null;
            console.log("Listener de change do select descCatFuncao removido.");
        }
        if (descCatFuncaoElement.tagName.toLowerCase() === "input") {
            if (inputDescCatFuncaoInputListener) {
                descCatFuncaoElement.removeEventListener("input", inputDescCatFuncaoInputListener);
                inputDescCatFuncaoInputListener = null;
                console.log("Listener de input do descCatFuncao (input) removido.");
            }
            if (inputDescCatFuncaoBlurListener) {
                descCatFuncaoElement.removeEventListener("blur", inputDescCatFuncaoBlurListener);
                inputDescCatFuncaoBlurListener = null;
                console.log("Listener de blur do descCatFuncao (input) removido.");
            }
            // Se 'adicionarEventoBlurFuncao' adiciona um listener com uma referência que está em 'blurCatFuncaoCampoListener'
            if (blurCatFuncaoCampoListener) {
                 descCatFuncaoElement.removeEventListener("blur", blurCatFuncaoCampoListener);
                 blurCatFuncaoCampoListener = null;
                 console.log("Listener adicional de blur do descCatFuncao (input) removido.");
            }
        }
    }
    
    // 3. Limpar o estado global FuncaoOriginal
    // Assumindo que window.FuncaoOriginal existe, ou defina-o como um objeto vazio
    window.CatFuncaoOriginal = { idCatFuncao: "", descCatFuncao: "", vlrCustoSenior: 0.00, vlrCustoPleno: 0.00, vlrCustoJunior: 0.00, vlrCustoBase: 0.00, vlrVenda: 0.00, vlrTransporte: 0.00, vlrTransporteSenior: 0.00, vlrAliemntacao: 0.00 };
    limparCamposCatFuncao(); // Chame a função que limpa os campos do formulário para garantir um estado limpo
    document.getElementById('form').reset(); // Garante que o formulário seja resetado
    document.querySelector("#idCatFuncao").value = ""; // Garante que o ID oculto seja limpo

    console.log("✅ Módulo Funcao.js desinicializado.");
}
// Torna a função de desinicialização global para ser chamada pelo sistema de módulos


window.moduloHandlers = window.moduloHandlers || {}; // Garante que o objeto existe

// Registra as funções de configuração e desinicialização para o módulo 'Funcao'
window.moduloHandlers['Categoriafuncao'] = { // Use 'Funcao' (com F maiúsculo) para corresponder ao seu mapaModulos no Index.js
    configurar: configurarEventosCatFuncao, // Usa a nova função de inicialização
    desinicializar: desinicializarCatFuncaoModal // Usa a nova função de desinicialização
};