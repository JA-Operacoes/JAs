import { fetchComToken, aplicarTema } from '../utils/utils.js';

// document.addEventListener("DOMContentLoaded", function () {
//     const idempresa = localStorage.getItem("idempresa");

//     if (idempresa) {
//         const apiUrl = `/empresas/${idempresa}`; // Verifique o caminho da sua API

//         fetchComToken(apiUrl)
//             .then(empresa => {
//                 // Usa o nome fantasia como tema
//                 const tema = empresa.nmfantasia;
//                 aplicarTema(tema);
//             })
//             .catch(error => {
//                 console.error("❌ Erro ao buscar dados da empresa para o tema:", error);
//                 // aplicarTema('default');
//             });
//     }
// });

let nmModuloBlurListener = null;
let limparModulosButtonListener = null;
let enviarModulosButtonListener = null;
let pesquisarModulosButtonListener = null;
let selectModulosChangeListener = null;
let novoInputDescModuloBlurListener = null; // Para o blur do novo input de descrição
let novoInputDescModuloInputListener = null;

if (typeof window.ModulosOriginal === "undefined") {
    window.ModulosOriginal = {
        idModulo: "",
        nmModulo: ""
    };
}

function verificaModulos() {

    console.log("Carregando Módulos...");
    
    document.querySelector("#nmModulo").addEventListener("blur", async function () {
        const desc = this.value.trim();

        console.log("Campo nmModulo procurado:", desc);
    
        if (desc === "") return;
    
        try {
            if (!desc) {
                console.warn("Valor do select está vazio ou indefinido.");
                return;
            }

            console.log("Selecionado:", desc);

            await carregarModulosDescricao(desc, this);
            console.log("Função selecionado depois de carregarModulosDescricao:", this.value);
         

        } catch (error) {
            console.error("Erro ao buscar Função:", error);
        }

    });

    const botaoEnviar = document.querySelector("#Enviar");
    const botaoPesquisar = document.querySelector("#Pesquisar");
    const form = document.querySelector("#modulos");
    const botaoLimpar = document.querySelector("#Limpar");

    if (!botaoEnviar || !form) {
        console.error("Formulário ou botão não encontrado no DOM.");
        return;
    }

    botaoLimpar.addEventListener("click", function (event) {
        event.preventDefault(); // Previne o envio padrão do formulário 

        limparCamposModulos();

    });

        
    botaoEnviar.addEventListener("click", async (event) => {
        event.preventDefault();

        const idModulo = document.querySelector("#idModulo").value.trim();
        const nmModulo = document.querySelector("#nmModulo").value.toUpperCase().trim();

        // Permissões
        const temPermissaoCadastrar = temPermissao("Modulos", "cadastrar");
        const temPermissaoAlterar = temPermissao("Modulos", "alterar");

        const metodo = idModulo ? "PUT" : "POST";

        if (!idModulo && !temPermissaoCadastrar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para cadastrar novos modulos.", "error");
        }

        if (idModulo && !temPermissaoAlterar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para alterar modulos.", "error");
        }

        if (!nmModulo) {
            return Swal.fire("Campos obrigatórios!", "Preencha todos os campos antes de enviar.", "warning");
        }

        const dados = { idModulo, nmModulo };

        // Verifica alterações
        if (
            idModulo &&
            parseInt(idModulo) === parseInt(window.ModulosOriginal?.idModulo) &&
            nmModulo === window.ModulosOriginal?.nmModulo 
        ) {
            return Swal.fire("Nenhuma alteração foi detectada!", "Faça alguma alteração antes de salvar.", "info");
        }

        const url = idModulo
            ? `/modulos/${idModulo}`
            : "/modulos";

        try {
            // Confirma alteração (PUT)
            if (metodo === "PUT") {
                const { isConfirmed } = await Swal.fire({
                    title: "Deseja salvar as alterações?",
                    text: "Você está prestes a atualizar os dados de módulos.",
                    icon: "question",
                    showCancelButton: true,
                    confirmButtonText: "Sim, salvar",
                    cancelButtonText: "Cancelar",
                    reverseButtons: true,
                    focusCancel: true
                });
                if (!isConfirmed) return;
            }

            const respostaApi = await fetchComToken(url, {
                method: metodo,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dados)
            });            

            await Swal.fire("Sucesso!", respostaApi.message || "Modulos salvo com sucesso.", "success");
            limparCamposModulos();

        } catch (error) {
            console.error("Erro ao enviar dados:", error);
            Swal.fire("Erro", error.message || "Erro ao salvar equipamento.", "error");
        }
    });

    botaoPesquisar.addEventListener("click", async function (event) {
    event.preventDefault();
    limparCamposModulos();

    console.log("Pesquisando Modulos...");

    // Verifica permissão
    const temPermissaoPesquisar = temPermissao("Modulos", "pesquisar");

    if (!temPermissaoPesquisar) {
        return Swal.fire(
            "Acesso negado",
            "Você não tem permissão para pesquisar modulos.",
            "error"
        );
    }

    try {
        const modulos = await fetchComToken("/modulos");

        if (!modulos || modulos.length === 0) {
            return Swal.fire({
                icon: 'info',
                title: 'Nenhum equipamento cadastrado',
                text: 'Não foi encontrado nenhum módulo no sistema.',
                confirmButtonText: 'Ok'
            });
        }

        console.log("Modulos encontrados:", modulos);

        const select = criarSelectModulos(modulos);
        limparCamposModulos();

        const input = document.querySelector("#nmModulo");

        if (input && input.parentNode) {
            input.parentNode.replaceChild(select, input);
        }

        const label = document.querySelector('label[for="nmModulo"]');
        if (label) {
            label.style.display = "none";
        }

        // Evento ao escolher um equipamento
        select.addEventListener("change", async function () {
            const desc = this.value?.trim();

            if (!desc) {
                console.warn("Valor do select está vazio ou indefinido.");
                return;
            }

            await carregarModulosDescricao(desc, this);

            const novoInput = document.createElement("input");
            novoInput.type = "text";
            novoInput.id = "nmModulo";
            novoInput.name = "nmModulo";
            novoInput.required = true;
            novoInput.className = "form";
            novoInput.value = desc;

            novoInput.addEventListener("input", function () {
                this.value = this.value.toUpperCase();
            });

            this.parentNode.replaceChild(novoInput, this);
            adicionarEventoBlurModulos();

            if (label) {
                label.style.display = "block";
                label.textContent = "Descrição do Modulos";
            }

            novoInput.addEventListener("blur", async function () {
                if (!this.value.trim()) return;
                await carregarModulosDescricao(this.value, this);
            });
        });

    } catch (error) {
        console.error("Erro ao carregar Modulos:", error);
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: error.message || 'Não foi possível carregar os módulos.',
            confirmButtonText: 'Ok'
        });
    }
});

    

}

function adicionarListenersAoInputDescModulo(inputElement) {
    // Remove listeners anteriores para evitar duplicidade
    if (novoInputDescModuloInputListener) {
        inputElement.removeEventListener("input", novoInputDescModuloInputListener);
    }
    if (novoInputDescModuloBlurListener) {
        inputElement.removeEventListener("blur", novoInputDescModuloBlurListener);
    }

    novoInputDescModuloInputListener = function() {
        this.value = this.value.toUpperCase();
    };
    inputElement.addEventListener("input", novoInputDescModuloInputListener);

    novoInputDescModuloBlurListener = async function() {
        if (!this.value.trim()) return;
        await carregarModulosDescricao(this.value, this);
    };
    inputElement.addEventListener("blur", novoInputDescModuloBlurListener);
}


function resetarCampoDescModuloParaInput() {
    const nmModuloCampo = document.getElementById("nmModulo");
    // Verifica se o campo atual é um select e o substitui por um input
    if (nmModuloCampo && nmModuloCampo.tagName.toLowerCase() === "select") {
        const input = document.createElement("input");
        input.type = "text";
        input.id = "nmModulo";
        input.name = "nmModulo";
        input.value = ""; // Limpa o valor
        input.placeholder = "Descrição do Modulos";
        input.className = "form";
        input.classList.add('uppercase');
        input.required = true;

        // Remove o listener do select antes de substituí-lo
        if (selectModulosChangeListener) {
            nmModuloCampo.removeEventListener("change", selectModulosChangeListener);
            selectModulosChangeListener = null;
        }

        nmModuloCampo.parentNode.replaceChild(input, nmModuloCampo);
        adicionarListenersAoInputDescModulo(input); // Adiciona os listeners ao novo input

        const label = document.querySelector('label[for="nmModulo"]');
        if (label) {
            label.style.display = "block";
            label.textContent = "Descrição do Modulos";
        }
    }
}


// =============================================================================
// Função de Desinicialização do Módulo Modulos
// =============================================================================
function desinicializarModulosModal() {
    console.log("🧹 Desinicializando módulo Modulos.js...");

    const nmModuloElement = document.querySelector("#nmModulo");
    const botaoEnviar = document.querySelector("#Enviar");
    const botaoPesquisar = document.querySelector("#Pesquisar");
    const botaoLimpar = document.querySelector("#Limpar");

    // 1. Remover listeners de eventos dos elementos fixos
    if (botaoLimpar && limparModulosButtonListener) {
        botaoLimpar.removeEventListener("click", limparModulosButtonListener);
        limparModulosButtonListener = null;
        console.log("Listener de click do Limpar (Modulos) removido.");
    }
    if (botaoEnviar && enviarModulosButtonListener) {
        botaoEnviar.removeEventListener("click", enviarModulosButtonListener);
        enviarModulosButtonListener = null;
        console.log("Listener de click do Enviar (Modulos) removido.");
    }
    if (botaoPesquisar && pesquisarModulosButtonListener) {
        botaoPesquisar.removeEventListener("click", pesquisarModulosButtonListener);
        pesquisarModulosButtonListener = null;
        console.log("Listener de click do Pesquisar (Modulos) removido.");
    }

    // 2. Remover listeners do campo nmModulo (que pode ser input ou select)
    if (nmModuloElement) {
        if (nmModuloElement.tagName.toLowerCase() === "input") {
            if (nmModuloBlurListener) {
                nmModuloElement.removeEventListener("blur", nmModuloBlurListener);
                nmModuloBlurListener = null;
                console.log("Listener de blur do nmModulo (input original) removido.");
            }
            if (novoInputDescModuloInputListener) {
                nmModuloElement.removeEventListener("input", novoInputDescModuloInputListener);
                novoInputDescModuloInputListener = null;
                console.log("Listener de input do nmModulo (input dinâmico) removido.");
            }
            if (novoInputDescModuloBlurListener) {
                nmModuloElement.removeEventListener("blur", novoInputDescModuloBlurListener);
                novoInputDescModuloBlurListener = null;
                console.log("Listener de blur do nmModulo (input dinâmico) removido.");
            }

        } else if (nmModuloElement.tagName.toLowerCase() === "select" && selectModulosChangeListener) {
            nmModuloElement.removeEventListener("change", selectModulosChangeListener);
            selectModulosChangeListener = null;
            console.log("Listener de change do select nmModulo removido.");
        }
    }

    // 3. Limpar o estado global e campos do formulário
    window.ModulosOriginal = null; // Zera o objeto de equipamento original
    limparCamposModulos(); // Limpa todos os campos visíveis do formulário
   // document.querySelector("#form").reset(); // Garante que o formulário seja completamente resetado
    document.querySelector("#idModulo").value = ""; // Limpa o ID oculto
    resetarCampoDescModuloParaInput(); // Garante que o campo nmModulo volte a ser um input padrão

    console.log("✅ Módulo Modulos.js desinicializado.");
}

function criarSelectModulos(modulos) {
   
    const select = document.createElement("select");
    select.id = "nmModulo";
    select.name = "nmModulo";
    select.required = true;
    select.className = "form";

   
    // Adicionar opções
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.text = "Selecione um Modulos...";
    defaultOption.disabled = true;
    defaultOption.selected = true;
    select.appendChild(defaultOption);
   
    console.log("PESQUISANDO EQUIPAMENTO:", modulos);

    modulos.forEach(modulosachado => {
        const option = document.createElement("option");
        option.value = modulosachado.descequip;
        option.text = modulosachado.descequip;
        select.appendChild(option);
    });
 
    return select;
}

if (!window.ultimoClique) {
    window.ultimoClique = null;
  
}
document.addEventListener("mousedown", (e) => {
    window.ultimoClique = e.target;
});

function adicionarEventoBlurModulos() {
    const input = document.querySelector("#nmModulo");
    if (!input) return;   
    
    
    input.addEventListener("blur", async function () {
       
        const botoesIgnorados = ["Limpar", "Pesquisar", "Close"];
        const ehBotaoIgnorado =
            (ultimoClique?.id && botoesIgnorados.includes(ultimoClique.id)) ||
            (ultimoClique?.classList && ultimoClique.classList.contains("close"));

        if (ehBotaoIgnorado) {
            console.log("🔁 Blur ignorado: clique em botão de controle (Fechar/Limpar/Pesquisar).");
            return;
        }

        const desc = this.value.trim();
        console.log("Campo nmModulo procurado:", desc);

        if (!desc) return;

        try {
            await carregarModulosDescricao(desc, this);
            console.log("Modulos selecionado depois de carregarModulosDescricao:", this.value);
        } catch (error) {
            console.error("Erro ao buscar Modulos:", error);
        }
    });
}

async function carregarModulosDescricao(desc, elementoAtual) {
    try {
        const modulos = await fetchComToken(`/modulos?nmModulo=${encodeURIComponent(desc)}`);
       
        if (!modulos || !modulos.idequip) throw new Error("Modulos não encontrada");
     
        document.querySelector("#idModulo").value = modulos.idequip;
        document.querySelector("#ctoEquip").value = modulos.ctoequip;
        document.querySelector("#vdaEquip").value = modulos.vdaequip;

        window.ModulosOriginal = {
            idModulo: modulos.idequip,
            nmModulo: modulos.descequip,
            vlrCusto: modulos.ctoequip,
            vlrVenda: modulos.vdaequip
        };

    } catch (error) {
        //console.warn("Erro ao buscar equipamento:", error);

        const temPermissaoCadastrar = temPermissao("Modulos", "cadastrar");
        const temPermissaoAlterar = temPermissao("Modulos", "alterar");

        const metodo = idModulo ? "PUT" : "POST";

        if (!idModulo && !temPermissaoCadastrar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para cadastrar novos modulos.", "error");
        }

        if (idModulo && !temPermissaoAlterar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para alterar modulos.", "error");
        }

        if (!nmModulo) {
            return Swal.fire("Campos obrigatórios!", "Preencha todos os campos antes de enviar.", "warning");
        }

        const dados = { nmModulo };        

        if (parseInt(idModulo) === parseInt(window.ModulosOriginal?.idModulo)) {
            console.log("Modulos não alterado, não será enviado.");
        }
        if (nmModulo === window.ModulosOriginal?.nmModulo) {
            console.log("Modulos não alterado, não será enviado.");
        }
        // Verifica alterações
        if (

            parseInt(idModulo) === parseInt(window.ModulosOriginal?.idModulo) &&
            nmModulo === window.ModulosOriginal?.nmModulo
        ) {
            return Swal.fire("Nenhuma alteração foi detectada!", "Faça alguma alteração antes de salvar.", "info");
        }

        const url = idModulo
            ? `/modulos/${idModulo}`
            : "/modulos";

        try {
            // Confirma alteração (PUT)
            if (metodo === "PUT") {
                const { isConfirmed } = await Swal.fire({
                    title: "Deseja salvar as alterações?",
                    text: "Você está prestes a atualizar os dados do Modulos.",
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
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(dados)
            });            

            await Swal.fire("Sucesso!", respostaApi.message || "Modulos salvo com sucesso.", "success");
            limparCamposModulos();

        } catch (error) {
            console.error("Erro ao enviar dados:", error);
            Swal.fire("Erro", error.message || "Erro ao salvar equipamento.", "error");
        }
    }
}


function limparModulosOriginal() {
    window.ModulosOriginal = {
        idModulo: "",
        nmModulo: ""
    };
}

function limparCamposModulos() {
    const campos = ["idModulo", "nmModulo"];
    campos.forEach(id => {
        const campo = document.getElementById(id);
        if (campo) campo.value = "";
    });
    
}

function configurarEventosModulos() {
    console.log("Configurando eventos Modulos...");
    verificaModulos(); // Carrega os Modulos ao abrir o modal
    adicionarEventoBlurModulos();
    console.log("Entrou configurar Modulos no EQUIPAMENTO.js.");
    

} 
window.configurarEventosModulos = configurarEventosModulos;

function configurarEventosEspecificos(modulo) {
  console.log("⚙️ configurarEventosEspecificos recebeu:", modulo);
  if (modulo.trim().toLowerCase() === 'modulos') {
    configurarEventosModulos();
    
    if (typeof aplicarPermissoes === "function" && window.permissoes) {
      aplicarPermissoes(window.permissoes);
    } else {
      console.warn("⚠️ aplicarPermissoes ou window.permissoes ainda não estão disponíveis para LocalMontagem.");
    }
  }
}
window.configurarEventosEspecificos = configurarEventosEspecificos;

window.moduloHandlers = window.moduloHandlers || {};

window.moduloHandlers['Modulos'] = { // A chave 'Modulos' (com E maiúsculo) deve corresponder ao seu Index.js
    configurar: configurarEventosModulos,
    desinicializar: desinicializarModulosModal
};
