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
let limparEquipamentoButtonListener = null;
let enviarEquipamentoButtonListener = null;
let pesquisarEquipamentoButtonListener = null;
let selectEquipamentoChangeListener = null;
let novoInputDescEquipBlurListener = null; // Para o blur do novo input de descrição
let novoInputDescEquipInputListener = null;

if (typeof window.EquipamentoOriginal === "undefined") {
    window.EquipamentoOriginal = {
        idEquip: "",
        descEquip: "",
        vlrCusto: "",
        vlrVenda: ""
    };
}

function verificaEquipamento() {

    console.log("Carregando Equipamento...");
    
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

        limparCamposEquipamento();

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
        const temPermissaoCadastrar = temPermissao("Equipamentos", "cadastrar");
        const temPermissaoAlterar = temPermissao("Equipamentos", "alterar");

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
            parseInt(idEquip) === parseInt(window.EquipamentoOriginal?.idEquip) &&
            descEquip === window.EquipamentoOriginal?.descEquip &&
            Number(custo).toFixed(2) === Number(window.EquipamentoOriginal?.vlrCusto).toFixed(2) &&
            Number(venda).toFixed(2) === Number(window.EquipamentoOriginal?.vlrVenda).toFixed(2)
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

            await Swal.fire("Sucesso!", respostaApi.message || "Equipamento salvo com sucesso.", "success");
            limparCamposEquipamento();

        } catch (error) {
            console.error("Erro ao enviar dados:", error);
            Swal.fire("Erro", error.message || "Erro ao salvar equipamento.", "error");
        }
    });

    botaoPesquisar.addEventListener("click", async function (event) {
    event.preventDefault();
    limparCamposEquipamento();

    console.log("Pesquisando Equipamento...");

    // Verifica permissão
    const temPermissaoPesquisar = temPermissao("Equipamentos", "pesquisar");

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

        console.log("Equipamentos encontrados:", equipamentos);

        const select = criarSelectEquipamento(equipamentos);
        limparCamposEquipamento();

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

            await carregarEquipamentoDescricao(desc, this);

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
            adicionarEventoBlurEquipamento();

            if (label) {
                label.style.display = "block";
                label.textContent = "Descrição do Equipamento";
            }

            novoInput.addEventListener("blur", async function () {
                if (!this.value.trim()) return;
                await carregarEquipamentoDescricao(this.value, this);
            });
        });

    } catch (error) {
        console.error("Erro ao carregar Equipamentos:", error);
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
        await carregarEquipamentoDescricao(this.value, this);
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
        input.placeholder = "Descrição do Equipamento";
        input.className = "form";
        input.classList.add('uppercase');
        input.required = true;

        // Remove o listener do select antes de substituí-lo
        if (selectEquipamentoChangeListener) {
            descEquipCampo.removeEventListener("change", selectEquipamentoChangeListener);
            selectEquipamentoChangeListener = null;
        }

        descEquipCampo.parentNode.replaceChild(input, descEquipCampo);
        adicionarListenersAoInputDescEquip(input); // Adiciona os listeners ao novo input

        const label = document.querySelector('label[for="descEquip"]');
        if (label) {
            label.style.display = "block";
            label.textContent = "Descrição do Equipamento";
        }
    }
}


// =============================================================================
// Função de Desinicialização do Módulo Equipamentos
// =============================================================================
function desinicializarEquipamentoModal() {
    console.log("🧹 Desinicializando módulo Equipamentos.js...");

    const descEquipElement = document.querySelector("#descEquip");
    const botaoEnviar = document.querySelector("#Enviar");
    const botaoPesquisar = document.querySelector("#Pesquisar");
    const botaoLimpar = document.querySelector("#Limpar");

    // 1. Remover listeners de eventos dos elementos fixos
    if (botaoLimpar && limparEquipamentoButtonListener) {
        botaoLimpar.removeEventListener("click", limparEquipamentoButtonListener);
        limparEquipamentoButtonListener = null;
        console.log("Listener de click do Limpar (Equipamentos) removido.");
    }
    if (botaoEnviar && enviarEquipamentoButtonListener) {
        botaoEnviar.removeEventListener("click", enviarEquipamentoButtonListener);
        enviarEquipamentoButtonListener = null;
        console.log("Listener de click do Enviar (Equipamentos) removido.");
    }
    if (botaoPesquisar && pesquisarEquipamentoButtonListener) {
        botaoPesquisar.removeEventListener("click", pesquisarEquipamentoButtonListener);
        pesquisarEquipamentoButtonListener = null;
        console.log("Listener de click do Pesquisar (Equipamentos) removido.");
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

        } else if (descEquipElement.tagName.toLowerCase() === "select" && selectEquipamentoChangeListener) {
            descEquipElement.removeEventListener("change", selectEquipamentoChangeListener);
            selectEquipamentoChangeListener = null;
            console.log("Listener de change do select descEquip removido.");
        }
    }

    // 3. Limpar o estado global e campos do formulário
    window.EquipamentoOriginal = null; // Zera o objeto de equipamento original
    limparCamposEquipamento(); // Limpa todos os campos visíveis do formulário
   // document.querySelector("#form").reset(); // Garante que o formulário seja completamente resetado
    document.querySelector("#idEquip").value = ""; // Limpa o ID oculto
    resetarCampoDescEquipParaInput(); // Garante que o campo descEquip volte a ser um input padrão

    console.log("✅ Módulo Equipamentos.js desinicializado.");
}

function criarSelectEquipamento(equipamentos) {
   
    const select = document.createElement("select");
    select.id = "descEquip";
    select.name = "descEquip";
    select.required = true;
    select.className = "form";

   
    // Adicionar opções
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.text = "Selecione um Equipamento...";
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

function adicionarEventoBlurEquipamento() {
    const input = document.querySelector("#descEquip");
    if (!input) return;   
    
    
    input.addEventListener("blur", async function () {
       
        const botoesIgnorados = ["Limpar", "Pesquisar", "Close"];
        const ehBotaoIgnorado =
            (ultimoClique?.id && botoesIgnorados.includes(ultimoClique.id)) ||
            (ultimoClique?.classList && ultimoClique.classList.contains("close"));

        if (ehBotaoIgnorado) {
           
            return;
        }

        const desc = this.value.trim();
       
        if (!desc) return;

        const idAtual = document.querySelector("#idEquip")?.value;
        if (idAtual) return;

        try {
            await carregarEquipamentoDescricao(desc, this);
            
        } catch (error) {
            console.error("Erro ao buscar Equipamento:", error);
        }
    });
}

async function carregarEquipamentoDescricao(desc, elementoAtual) {
    try {
        const equipamentos = await fetchComToken(`/equipamentos?descEquip=${encodeURIComponent(desc)}`);
       
        if (!equipamentos || !equipamentos.idequip) throw new Error("Equipamento não encontrada");
     
        document.querySelector("#idEquip").value = equipamentos.idequip;
        document.querySelector("#ctoEquip").value = equipamentos.ctoequip;
        document.querySelector("#vdaEquip").value = equipamentos.vdaequip;

        window.EquipamentoOriginal = {
            idEquip: equipamentos.idequip,
            descEquip: equipamentos.descequip,
            vlrCusto: equipamentos.ctoequip,
            vlrVenda: equipamentos.vdaequip
        };

    } catch (error) {
        

        const inputIdEquip = document.querySelector("#idEquip");
        const podeCadastrar = temPermissao("Equipamentos", "cadastrar");

        console.log("Valor de inputIdEquip.value:", inputIdEquip.value, podeCadastrar);
        if (!inputIdEquip.value) {
            console.log("Detectado Equipamento não encontrado e usuário tem permissão para cadastrar.");
            const resultado = await Swal.fire({
                icon: 'question',
                title: `Deseja cadastrar "${desc.toUpperCase()}" como novo Equipamento?`,
                text: `Equipamento "${desc.toUpperCase()}" não encontrado.`,
                showCancelButton: true,
                confirmButtonText: "Sim, cadastrar",
                cancelButtonText: "Cancelar",
                reverseButtons: true,
                focusCancel: true
            });

            if (!resultado.isConfirmed) {
                    elementoAtual.value = "";
                    setTimeout(() => elementoAtual.focus(), 0);
                    return;
            }

            // ✅ Confirmou — mantém o valor digitado
            elementoAtual.value = desc.toUpperCase();
        
        } else if (!podeCadastrar) {
            console.log("Equipamento não encontrado, mas usuário NÃO tem permissão para cadastrar.");
            Swal.fire({
                icon: "info",
                title: "Equipamento não cadastrado",
                text: "Você não tem permissão para cadastrar equipamentos.",
                confirmButtonText: "OK"
            });
            // Se não tem permissão e não encontrou, limpa o campo também para evitar confusão.
            elementoAtual.value = ""; 
            setTimeout(() => {
                elementoAtual.focus();
            }, 0);
            return; // Sai da função carregarEquipamentoDescricao
        }
    }
}


function limparEquipamentoOriginal() {
    window.EquipamentoOriginal = {
        idEquip: "",
        descEquip: "",
        vlrCusto: "",
        vlrVenda: ""
    };
}


function limparCamposEquipamento() {
    const campos = ["idEquip", "ctoEquip", "vdaEquip"];
    campos.forEach(id => {
        const campo = document.getElementById(id);
        if (campo) campo.value = "";
    });

    // ✅ Verifica se descEquip é select e substitui por input
    const descEquipEl = document.getElementById("descEquip");
    if (descEquipEl) {
        if (descEquipEl.tagName === "SELECT") {
            const novoInput = document.createElement("input");
            novoInput.type = "text";
            novoInput.id = "descEquip";
            novoInput.name = "descEquip";
            novoInput.required = true;
            novoInput.className = "form";

            novoInput.addEventListener("input", function () {
                this.value = this.value.toUpperCase();
            });

            novoInput.addEventListener("blur", async function () {
                if (!this.value.trim()) return;
                const idAtual = document.querySelector("#idEquip")?.value;
                if (idAtual) return; // ✅ proteção edição
                await carregarEquipamentoDescricao(this.value, this);
            });

            descEquipEl.parentNode.replaceChild(novoInput, descEquipEl);
            adicionarEventoBlurEquipamento();

            const label = document.querySelector('label[for="descEquip"]');
            if (label) {
                label.style.display = "block";
                label.textContent = "Descrição do Equipamento";
            }
        } else {
            // Já é input, só limpa o valor
            descEquipEl.value = "";
        }
    }

    // ✅ Limpa o estado global
    window.EquipamentoOriginal = {
        idEquip: "",
        descEquip: "",
        vlrCusto: "",
        vlrVenda: ""
    };
}

function configurarEventosEquipamento() {
    console.log("Configurando eventos Equipamento...");
    verificaEquipamento(); // Carrega os Equipamento ao abrir o modal
    adicionarEventoBlurEquipamento();
    console.log("Entrou configurar Equipamento no EQUIPAMENTO.js.");
    

} 
window.configurarEventosEquipamento = configurarEventosEquipamento;

function configurarEventosEspecificos(modulo) {
  console.log("⚙️ configurarEventosEspecificos recebeu:", modulo);
  if (modulo.trim().toLowerCase() === 'equipamentos') {
    configurarEventosEquipamento();
    
    if (typeof aplicarPermissoes === "function" && window.permissoes) {
      aplicarPermissoes(window.permissoes);
    } else {
      console.warn("⚠️ aplicarPermissoes ou window.permissoes ainda não estão disponíveis para Equipamentos.");
    }
  }
}
window.configurarEventosEspecificos = configurarEventosEspecificos;

window.moduloHandlers = window.moduloHandlers || {};

window.moduloHandlers['Equipamentos'] = { // A chave 'Equipamentos' (com E maiúsculo) deve corresponder ao seu Index.js
    configurar: configurarEventosEquipamento,
    desinicializar: desinicializarEquipamentoModal
};
