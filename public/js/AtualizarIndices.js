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
let limparAtualizarindiceButtonListener = null;
let enviarAtualizarindiceButtonListener = null;
let pesquisarAtualizarindiceButtonListener = null;
let selectAtualizarindiceChangeListener = null;
let novoInputDescEquipBlurListener = null; // Para o blur do novo input de descrição
let novoInputDescEquipInputListener = null;

if (typeof window.AtualizarindiceOriginal === "undefined") {
    window.AtualizarindiceOriginal = {
        idEquip: "",
        descEquip: "",
        vlrCusto: "",
        vlrVenda: ""
    };
}

function verificaAtualizarindice() {

    console.log("Carregando Atualizarindice...");
    
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

            await carregarAtualizarindiceDescricao(desc, this);
            console.log("Função selecionado depois de carregarAtualizarindiceDescricao:", this.value);
         

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

        limparCamposAtualizarindice();

    });

        
    botaoEnviar.addEventListener("click", async (event) => {
        event.preventDefault();

        const idEquip = document.querySelector("#idEquip").value.trim();
        const descEquip = document.querySelector("#descEquip").value.toUpperCase().trim();
        const vlrCusto = document.querySelector("#ctoEquip").value;
        const vlrVenda = document.querySelector("#vdaEquip").value;

        const custo = parseFloat(vlrCusto.replace(",", "."));
        const venda = parseFloat(vlrVenda.replace(",", "."));

        // Permissões
        const temPermissaoCadastrar = temPermissao("Atualizarindices", "cadastrar");
        const temPermissaoAlterar = temPermissao("Atualizarindices", "alterar");

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
            parseInt(idEquip) === parseInt(window.AtualizarindiceOriginal?.idEquip) &&
            descEquip === window.AtualizarindiceOriginal?.descEquip &&
            Number(custo).toFixed(2) === Number(window.AtualizarindiceOriginal?.vlrCusto).toFixed(2) &&
            Number(venda).toFixed(2) === Number(window.AtualizarindiceOriginal?.vlrVenda).toFixed(2)
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

            await Swal.fire("Sucesso!", respostaApi.message || "Atualizarindice salvo com sucesso.", "success");
            limparCamposAtualizarindice();

        } catch (error) {
            console.error("Erro ao enviar dados:", error);
            Swal.fire("Erro", error.message || "Erro ao salvar equipamento.", "error");
        }
    });

    botaoPesquisar.addEventListener("click", async function (event) {
    event.preventDefault();
    limparCamposAtualizarindice();

    console.log("Pesquisando Atualizarindice...");

    // Verifica permissão
    const temPermissaoPesquisar = temPermissao("Atualizarindices", "pesquisar");

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

        console.log("Atualizarindices encontrados:", equipamentos);

        const select = criarSelectAtualizarindice(equipamentos);
        limparCamposAtualizarindice();

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

            await carregarAtualizarindiceDescricao(desc, this);

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
            adicionarEventoBlurAtualizarindice();

            if (label) {
                label.style.display = "block";
                label.textContent = "Descrição do Atualizarindice";
            }

            novoInput.addEventListener("blur", async function () {
                if (!this.value.trim()) return;
                await carregarAtualizarindiceDescricao(this.value, this);
            });
        });

    } catch (error) {
        console.error("Erro ao carregar Atualizarindices:", error);
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
        await carregarAtualizarindiceDescricao(this.value, this);
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
        input.placeholder = "Descrição do Atualizarindice";
        input.className = "form";
        input.classList.add('uppercase');
        input.required = true;

        // Remove o listener do select antes de substituí-lo
        if (selectAtualizarindiceChangeListener) {
            descEquipCampo.removeEventListener("change", selectAtualizarindiceChangeListener);
            selectAtualizarindiceChangeListener = null;
        }

        descEquipCampo.parentNode.replaceChild(input, descEquipCampo);
        adicionarListenersAoInputDescEquip(input); // Adiciona os listeners ao novo input

        const label = document.querySelector('label[for="descEquip"]');
        if (label) {
            label.style.display = "block";
            label.textContent = "Descrição do Atualizarindice";
        }
    }
}


// =============================================================================
// Função de Desinicialização do Módulo Atualizarindices
// =============================================================================
function desinicializarAtualizarindiceModal() {
    console.log("🧹 Desinicializando módulo Atualizarindices.js...");

    const descEquipElement = document.querySelector("#descEquip");
    const botaoEnviar = document.querySelector("#Enviar");
    const botaoPesquisar = document.querySelector("#Pesquisar");
    const botaoLimpar = document.querySelector("#Limpar");

    // 1. Remover listeners de eventos dos elementos fixos
    if (botaoLimpar && limparAtualizarindiceButtonListener) {
        botaoLimpar.removeEventListener("click", limparAtualizarindiceButtonListener);
        limparAtualizarindiceButtonListener = null;
        console.log("Listener de click do Limpar (Atualizarindices) removido.");
    }
    if (botaoEnviar && enviarAtualizarindiceButtonListener) {
        botaoEnviar.removeEventListener("click", enviarAtualizarindiceButtonListener);
        enviarAtualizarindiceButtonListener = null;
        console.log("Listener de click do Enviar (Atualizarindices) removido.");
    }
    if (botaoPesquisar && pesquisarAtualizarindiceButtonListener) {
        botaoPesquisar.removeEventListener("click", pesquisarAtualizarindiceButtonListener);
        pesquisarAtualizarindiceButtonListener = null;
        console.log("Listener de click do Pesquisar (Atualizarindices) removido.");
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

        } else if (descEquipElement.tagName.toLowerCase() === "select" && selectAtualizarindiceChangeListener) {
            descEquipElement.removeEventListener("change", selectAtualizarindiceChangeListener);
            selectAtualizarindiceChangeListener = null;
            console.log("Listener de change do select descEquip removido.");
        }
    }

    // 3. Limpar o estado global e campos do formulário
    window.AtualizarindiceOriginal = null; // Zera o objeto de equipamento original
    limparCamposAtualizarindice(); // Limpa todos os campos visíveis do formulário
   // document.querySelector("#form").reset(); // Garante que o formulário seja completamente resetado
    document.querySelector("#idEquip").value = ""; // Limpa o ID oculto
    resetarCampoDescEquipParaInput(); // Garante que o campo descEquip volte a ser um input padrão

    console.log("✅ Módulo Atualizarindices.js desinicializado.");
}

function criarSelectAtualizarindice(equipamentos) {
   
    const select = document.createElement("select");
    select.id = "descEquip";
    select.name = "descEquip";
    select.required = true;
    select.className = "form";

   
    // Adicionar opções
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.text = "Selecione um Atualizarindice...";
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

function adicionarEventoBlurAtualizarindice() {
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
            await carregarAtualizarindiceDescricao(desc, this);
            console.log("Atualizarindice selecionado depois de carregarAtualizarindiceDescricao:", this.value);
        } catch (error) {
            console.error("Erro ao buscar Atualizarindice:", error);
        }
    });
}

async function carregarAtualizarindiceDescricao(desc, elementoAtual) {
    try {
        const equipamentos = await fetchComToken(`/equipamentos?descEquip=${encodeURIComponent(desc)}`);
       
        if (!equipamentos || !equipamentos.idequip) throw new Error("Atualizarindice não encontrada");
     
        document.querySelector("#idEquip").value = equipamentos.idequip;
        document.querySelector("#ctoEquip").value = equipamentos.ctoequip;
        document.querySelector("#vdaEquip").value = equipamentos.vdaequip;

        window.AtualizarindiceOriginal = {
            idEquip: equipamentos.idequip,
            descEquip: equipamentos.descequip,
            vlrCusto: equipamentos.ctoequip,
            vlrVenda: equipamentos.vdaequip
        };

    } catch (error) {
        //console.warn("Erro ao buscar equipamento:", error);

        const temPermissaoCadastrar = temPermissao("Atualizarindices", "cadastrar");
        const temPermissaoAlterar = temPermissao("Atualizarindices", "alterar");

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

        if (parseInt(idEquip) === parseInt(window.AtualizarindiceOriginal?.idEquip)) {
            console.log("Atualizarindice não alterado, não será enviado.");
        }
        if (descEquip === window.AtualizarindiceOriginal?.descEquip) {
            console.log("Atualizarindice não alterado, não será enviado.");
        }
        // Verifica alterações
        if (

            parseInt(idEquip) === parseInt(window.AtualizarindiceOriginal?.idEquip) &&
            descEquip === window.AtualizarindiceOriginal?.descEquip
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
                    text: "Você está prestes a atualizar os dados do Atualizarindice.",
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

            await Swal.fire("Sucesso!", respostaApi.message || "Atualizarindice salvo com sucesso.", "success");
            limparCamposAtualizarindice();

        } catch (error) {
            console.error("Erro ao enviar dados:", error);
            Swal.fire("Erro", error.message || "Erro ao salvar equipamento.", "error");
        }
    }
}


function limparAtualizarindiceOriginal() {
    window.AtualizarindiceOriginal = {
        idEquip: "",
        descEquip: "",
        vlrCusto: "",
        vlrVenda: ""
    };
}

function limparCamposAtualizarindice() {
    const campos = ["idEquip", "descEquip","ctoEquip", "vdaEquip" ];
    campos.forEach(id => {
        const campo = document.getElementById(id);
        if (campo) campo.value = "";
    });
    
}

function configurarEventosAtualizarindice() {
    console.log("Configurando eventos Atualizarindice...");
    verificaAtualizarindice(); // Carrega os Atualizarindice ao abrir o modal
    adicionarEventoBlurAtualizarindice();
    console.log("Entrou configurar Atualizarindice no EQUIPAMENTO.js.");
    

} 
window.configurarEventosAtualizarindice = configurarEventosAtualizarindice;

function configurarEventosEspecificos(modulo) {
  console.log("⚙️ configurarEventosEspecificos recebeu:", modulo);
  if (modulo.trim().toLowerCase() === 'atualizarindices') {
    configurarEventosAtualizarindice();
    
    if (typeof aplicarPermissoes === "function" && window.permissoes) {
      aplicarPermissoes(window.permissoes);
    } else {
      console.warn("⚠️ aplicarPermissoes ou window.permissoes ainda não estão disponíveis para LocalMontagem.");
    }
  }
}
window.configurarEventosEspecificos = configurarEventosEspecificos;

window.moduloHandlers = window.moduloHandlers || {};

window.moduloHandlers['Atualizarindices'] = { // A chave 'Atualizarindices' (com E maiúsculo) deve corresponder ao seu Index.js
    configurar: configurarEventosAtualizarindice,
    desinicializar: desinicializarAtualizarindiceModal
};
