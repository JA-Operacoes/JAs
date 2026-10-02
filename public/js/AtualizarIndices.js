import { fetchComToken, aplicarTema } from '../utils/utils.js';

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

let descEquipBlurListener = null;
let limparAtualizarIndiceButtonListener = null;
let enviarAtualizarIndiceButtonListener = null;
let pesquisarAtualizarIndiceButtonListener = null;
let selectAtualizarIndiceChangeListener = null;
let novoInputDescEquipBlurListener = null; // Para o blur do novo input de descrição
let novoInputDescEquipInputListener = null;

if (typeof window.AtualizarIndiceOriginal === "undefined") {
    window.AtualizarIndiceOriginal = {
        idEquip: "",
        descEquip: "",
        vlrCusto: "",
        vlrVenda: ""
    };
}

function verificaAtualizarIndice() {

    console.log("Carregando AtualizarIndice...");
    
    document.querySelector("#descEquip").addEventListener("blur", async function () {
        const desc = this.value.trim();

        console.log("Campo descEquip procurado:", desc);
    
        if (desc === "") return;
    
        try {
            if (!desc) {
                console.warn("Valor do select está vazio ou indefinido.");
                return;
            }

            console.log("Selecionado:", desc);

            await carregarAtualizarIndiceDescricao(desc, this);
            console.log("Função selecionado depois de carregarAtualizarIndiceDescricao:", this.value);
         

        } catch (error) {
            console.error("Erro ao buscar Função:", error);
        }

    });

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

        limparCamposAtualizarIndice();

    });

        
    botaoEnviar.addEventListener("click", async (event) => {
        event.preventDefault();

        const idEquip = document.querySelector("#idEquip").value.trim();
        const descEquip = document.querySelector("#descEquip").value.toUpperCase().trim();
        const vlrCusto = document.querySelector("#ctoEquip").value;
        const vlrVenda = document.querySelector("#vdaEquip").value;

        const custo = parseFloat(desformatarReais(vlrCusto));
        const venda = parseFloat(desformatarReais(vlrVenda));

        // Permissões
        const temPermissaoCadastrar = temPermissao("AtualizarIndices", "cadastrar");
        const temPermissaoAlterar = temPermissao("AtualizarIndices", "alterar");

        const metodo = idEquip ? "PUT" : "POST";

        if (!idEquip && !temPermissaoCadastrar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para cadastrar novos equipamentos.", "error");
        }

        if (idEquip && !temPermissaoAlterar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para alterar equipamentos.", "error");
        }

        if (!descEquip || !vlrCusto || !vlrVenda) {
            return Swal.fire("Campos obrigatórios!", "Preencha todos os campos antes de enviar.", "warning");
        }

        const dados = { descEquip, custo, venda };

        // Verifica alterações
        if (
            idEquip &&
            parseInt(idEquip) === parseInt(window.AtualizarIndiceOriginal?.idEquip) &&
            descEquip === window.AtualizarIndiceOriginal?.descEquip &&
            Number(custo).toFixed(2) === Number(window.AtualizarIndiceOriginal?.vlrCusto).toFixed(2) &&
            Number(venda).toFixed(2) === Number(window.AtualizarIndiceOriginal?.vlrVenda).toFixed(2)
        ) {
            return Swal.fire("Nenhuma alteração foi detectada!", "Faça alguma alteração antes de salvar.", "info");
        }

        const url = idEquip
            ? `/equipamentos/${idEquip}`
            : "/equipamentos";

        try {
            // Confirma alteração (PUT)
            if (metodo === "PUT") {
                const { isConfirmed } = await Swal.fire({
                    title: "Deseja salvar as alterações?",
                    text: "Você está prestes a atualizar os dados do equipamento.",
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

            await Swal.fire("Sucesso!", respostaApi.message || "AtualizarIndice salvo com sucesso.", "success");

        } catch (error) {
            console.error("Erro ao enviar dados:", error);
            Swal.fire("Erro", error.message || "Erro ao salvar equipamento.", "error");
        }
    });

    botaoPesquisar.addEventListener("click", async function (event) {
    event.preventDefault();
    limparCamposAtualizarIndice();

    console.log("Pesquisando AtualizarIndice...");

    // Verifica permissão
    const temPermissaoPesquisar = temPermissao("AtualizarIndices", "pesquisar");

    if (!temPermissaoPesquisar) {
        return Swal.fire(
            "Acesso negado",
            "Você não tem permissão para pesquisar equipamentos.",
            "error"
        );
    }

    try {
        const equipamentos = await fetchComToken("/equipamentos");

        if (!equipamentos || equipamentos.length === 0) {
            return Swal.fire({
                icon: 'info',
                title: 'Nenhum equipamento cadastrado',
                text: 'Não foi encontrado nenhum equipamento no sistema.',
                confirmButtonText: 'Ok'
            });
        }

        console.log("AtualizarIndices encontrados:", equipamentos);

        const select = criarSelectAtualizarIndice(equipamentos);
        limparCamposAtualizarIndice();

        const input = document.querySelector("#descEquip");

        if (input && input.parentNode) {
            input.parentNode.replaceChild(select, input);
        }

        const label = document.querySelector('label[for="descEquip"]');
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

            await carregarAtualizarIndiceDescricao(desc, this);

            const novoInput = document.createElement("input");
            novoInput.type = "text";
            novoInput.id = "descEquip";
            novoInput.name = "descEquip";
            novoInput.required = true;
            novoInput.className = "form";
            novoInput.value = desc;

            novoInput.addEventListener("input", function () {
                this.value = this.value.toUpperCase();
            });

            this.parentNode.replaceChild(novoInput, this);
            adicionarEventoBlurAtualizarIndice();

            if (label) {
                label.style.display = "block";
                label.textContent = "Descrição do AtualizarIndice";
            }

            novoInput.addEventListener("blur", async function () {
                if (!this.value.trim()) return;
                await carregarAtualizarIndiceDescricao(this.value, this);
            });
        });

    } catch (error) {
        console.error("Erro ao carregar AtualizarIndices:", error);
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: error.message || 'Não foi possível carregar os equipamentos.',
            confirmButtonText: 'Ok'
        });
    }
});

    

}

function adicionarListenersAoInputDescEquip(inputElement) {
    // Remove listeners anteriores para evitar duplicidade
    if (novoInputDescEquipInputListener) {
        inputElement.removeEventListener("input", novoInputDescEquipInputListener);
    }
    if (novoInputDescEquipBlurListener) {
        inputElement.removeEventListener("blur", novoInputDescEquipBlurListener);
    }

    novoInputDescEquipInputListener = function() {
        this.value = this.value.toUpperCase();
    };
    inputElement.addEventListener("input", novoInputDescEquipInputListener);

    novoInputDescEquipBlurListener = async function() {
        if (!this.value.trim()) return;
        await carregarAtualizarIndiceDescricao(this.value, this);
    };
    inputElement.addEventListener("blur", novoInputDescEquipBlurListener);
}


function resetarCampoDescEquipParaInput() {
    const descEquipCampo = document.getElementById("descEquip");
    // Verifica se o campo atual é um select e o substitui por um input
    if (descEquipCampo && descEquipCampo.tagName.toLowerCase() === "select") {
        const input = document.createElement("input");
        input.type = "text";
        input.id = "descEquip";
        input.name = "descEquip";
        input.value = ""; // Limpa o valor
        input.placeholder = "Descrição do AtualizarIndice";
        input.className = "form";
        input.classList.add('uppercase');
        input.required = true;

        // Remove o listener do select antes de substituí-lo
        if (selectAtualizarIndiceChangeListener) {
            descEquipCampo.removeEventListener("change", selectAtualizarIndiceChangeListener);
            selectAtualizarIndiceChangeListener = null;
        }

        descEquipCampo.parentNode.replaceChild(input, descEquipCampo);
        adicionarListenersAoInputDescEquip(input); // Adiciona os listeners ao novo input

        const label = document.querySelector('label[for="descEquip"]');
        if (label) {
            label.style.display = "block";
            label.textContent = "Descrição do AtualizarIndice";
        }
    }
}


// =============================================================================
// Função de Desinicialização do Módulo AtualizarIndices
// =============================================================================
function desinicializarAtualizarIndiceModal() {
    console.log("🧹 Desinicializando módulo AtualizarIndices.js...");

    const descEquipElement = document.querySelector("#descEquip");
    const botaoEnviar = document.querySelector("#Enviar");
    const botaoPesquisar = document.querySelector("#Pesquisar");
    const botaoLimpar = document.querySelector("#Limpar");

    // 1. Remover listeners de eventos dos elementos fixos
    if (botaoLimpar && limparAtualizarIndiceButtonListener) {
        botaoLimpar.removeEventListener("click", limparAtualizarIndiceButtonListener);
        limparAtualizarIndiceButtonListener = null;
        console.log("Listener de click do Limpar (AtualizarIndices) removido.");
    }
    if (botaoEnviar && enviarAtualizarIndiceButtonListener) {
        botaoEnviar.removeEventListener("click", enviarAtualizarIndiceButtonListener);
        enviarAtualizarIndiceButtonListener = null;
        console.log("Listener de click do Enviar (AtualizarIndices) removido.");
    }
    if (botaoPesquisar && pesquisarAtualizarIndiceButtonListener) {
        botaoPesquisar.removeEventListener("click", pesquisarAtualizarIndiceButtonListener);
        pesquisarAtualizarIndiceButtonListener = null;
        console.log("Listener de click do Pesquisar (AtualizarIndices) removido.");
    }

    // 2. Remover listeners do campo descEquip (que pode ser input ou select)
    if (descEquipElement) {
        if (descEquipElement.tagName.toLowerCase() === "input") {
            if (descEquipBlurListener) {
                descEquipElement.removeEventListener("blur", descEquipBlurListener);
                descEquipBlurListener = null;
                console.log("Listener de blur do descEquip (input original) removido.");
            }
            if (novoInputDescEquipInputListener) {
                descEquipElement.removeEventListener("input", novoInputDescEquipInputListener);
                novoInputDescEquipInputListener = null;
                console.log("Listener de input do descEquip (input dinâmico) removido.");
            }
            if (novoInputDescEquipBlurListener) {
                descEquipElement.removeEventListener("blur", novoInputDescEquipBlurListener);
                novoInputDescEquipBlurListener = null;
                console.log("Listener de blur do descEquip (input dinâmico) removido.");
            }

        } else if (descEquipElement.tagName.toLowerCase() === "select" && selectAtualizarIndiceChangeListener) {
            descEquipElement.removeEventListener("change", selectAtualizarIndiceChangeListener);
            selectAtualizarIndiceChangeListener = null;
            console.log("Listener de change do select descEquip removido.");
        }
    }

    // 3. Limpar o estado global e campos do formulário
    window.AtualizarIndiceOriginal = null; // Zera o objeto de equipamento original
    limparCamposAtualizarIndice(); // Limpa todos os campos visíveis do formulário
   // document.querySelector("#form").reset(); // Garante que o formulário seja completamente resetado
    document.querySelector("#idEquip").value = ""; // Limpa o ID oculto
    resetarCampoDescEquipParaInput(); // Garante que o campo descEquip volte a ser um input padrão

    console.log("✅ Módulo AtualizarIndices.js desinicializado.");
}

function criarSelectAtualizarIndice(equipamentos) {
   
    const select = document.createElement("select");
    select.id = "descEquip";
    select.name = "descEquip";
    select.required = true;
    select.className = "form";

   
    // Adicionar opções
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.text = "Selecione um AtualizarIndice...";
    defaultOption.disabled = true;
    defaultOption.selected = true;
    select.appendChild(defaultOption);
   
    console.log("PESQUISANDO EQUIPAMENTO:", equipamentos);

    equipamentos.forEach(equipamentosachado => {
        const option = document.createElement("option");
        option.value = equipamentosachado.descequip;
        option.text = equipamentosachado.descequip;
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

function adicionarEventoBlurAtualizarIndice() {
    const input = document.querySelector("#descEquip");
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
        console.log("Campo descEquip procurado:", desc);

        if (!desc) return;

        try {
            await carregarAtualizarIndiceDescricao(desc, this);
            console.log("AtualizarIndice selecionado depois de carregarAtualizarIndiceDescricao:", this.value);
        } catch (error) {
            console.error("Erro ao buscar AtualizarIndice:", error);
        }
    });
}

async function carregarAtualizarIndiceDescricao(desc, elementoAtual) {
    try {
        const equipamentos = await fetchComToken(`/equipamentos?descEquip=${encodeURIComponent(desc)}`);
       
        if (!equipamentos || !equipamentos.idequip) throw new Error("AtualizarIndice não encontrada");
     
        document.querySelector("#idEquip").value = equipamentos.idequip;
        document.querySelector("#ctoEquip").value = equipamentos.ctoequip;
        document.querySelector("#vdaEquip").value = equipamentos.vdaequip;

        window.AtualizarIndiceOriginal = {
            idEquip: equipamentos.idequip,
            descEquip: equipamentos.descequip,
            vlrCusto: equipamentos.ctoequip,
            vlrVenda: equipamentos.vdaequip
        };

    } catch (error) {
        //console.warn("Erro ao buscar equipamento:", error);

        const temPermissaoCadastrar = temPermissao("AtualizarIndices", "cadastrar");
        const temPermissaoAlterar = temPermissao("AtualizarIndices", "alterar");

        const metodo = idEquip ? "PUT" : "POST";

        if (!idEquip && !temPermissaoCadastrar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para cadastrar novos equipamentos.", "error");
        }

        if (idEquip && !temPermissaoAlterar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para alterar equipamentos.", "error");
        }

        if (!descEquip) {
            return Swal.fire("Campos obrigatórios!", "Preencha todos os campos antes de enviar.", "warning");
        }

        const dados = { descEquip };        

        if (parseInt(idEquip) === parseInt(window.AtualizarIndiceOriginal?.idEquip)) {
            console.log("AtualizarIndice não alterado, não será enviado.");
        }
        if (descEquip === window.AtualizarIndiceOriginal?.descEquip) {
            console.log("AtualizarIndice não alterado, não será enviado.");
        }
        // Verifica alterações
        if (

            parseInt(idEquip) === parseInt(window.AtualizarIndiceOriginal?.idEquip) &&
            descEquip === window.AtualizarIndiceOriginal?.descEquip
        ) {
            return Swal.fire("Nenhuma alteração foi detectada!", "Faça alguma alteração antes de salvar.", "info");
        }

        const url = idEquip
            ? `/equipamentos/${idEquip}`
            : "/equipamentos";

        try {
            // Confirma alteração (PUT)
            if (metodo === "PUT") {
                const { isConfirmed } = await Swal.fire({
                    title: "Deseja salvar as alterações?",
                    text: "Você está prestes a atualizar os dados do AtualizarIndice.",
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

            await Swal.fire("Sucesso!", respostaApi.message || "AtualizarIndice salvo com sucesso.", "success");

        } catch (error) {
            console.error("Erro ao enviar dados:", error);
            Swal.fire("Erro", error.message || "Erro ao salvar equipamento.", "error");
        }
    }
}


function limparAtualizarIndiceOriginal() {
    window.AtualizarIndiceOriginal = {
        idEquip: "",
        descEquip: "",
        vlrCusto: "",
        vlrVenda: ""
    };
}

function limparCamposAtualizarIndice() {
    const campos = ["idEquip", "descEquip","ctoEquip", "vdaEquip" ];
    campos.forEach(id => {
        const campo = document.getElementById(id);
        if (campo) campo.value = "";
    });
    
}

function configurarEventosAtualizarIndice() {
    console.log("Configurando eventos AtualizarIndice...");
    verificaAtualizarIndice(); // Carrega os AtualizarIndice ao abrir o modal
    adicionarEventoBlurAtualizarIndice();
    console.log("Entrou configurarAtualizarIndice no ATUALIZARINDICE.js.");
    

} 
window.configurarEventosAtualizarIndice = configurarEventosAtualizarIndice;

function configurarEventosEspecificos(modulo) {
  console.log("⚙️ configurarEventosEspecificos recebeu:", modulo);
  if (modulo.trim().toLowerCase() === 'atualizarindices') {
    configurarEventosAtualizarIndice();
    
    if (typeof aplicarPermissoes === "function" && window.permissoes) {
      aplicarPermissoes(window.permissoes);
    } else {
      console.warn("⚠️ aplicarPermissoes ou window.permissoes ainda não estão disponíveis para LocalMontagem.");
    }
  }
}
window.configurarEventosEspecificos = configurarEventosEspecificos;

window.moduloHandlers = window.moduloHandlers || {};

window.moduloHandlers['AtualizarIndices'] = { // A chave 'AtualizarIndices' (com E maiúsculo) deve corresponder ao seu Index.js
    configurar: configurarEventosAtualizarIndice,
    desinicializar: desinicializarAtualizarIndiceModal
};
