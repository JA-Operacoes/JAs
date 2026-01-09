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

let descSupBlurListener = null;
let limparSuprimentoButtonListener = null;
let enviarSuprimentoButtonListener = null;
let pesquisarSuprimentoButtonListener = null;
let selectSuprimentoChangeListener = null;
let novoInputDescSupBlurListener = null; // Para o blur do novo input de descrição
let novoInputDescSupInputListener = null;

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

        
    botaoEnviar.addEventListener("click", async (event) => {
        event.preventDefault();

        const idSup = document.querySelector("#idSup").value.trim();
        const descSup = document.querySelector("#descSup").value.toUpperCase().trim();
        const vlrCusto = document.querySelector("#ctoSup").value;
        const vlrVenda = document.querySelector("#vdaSup").value;

        const custo = parseFloat(vlrCusto.replace(",", "."));
        const venda = parseFloat(vlrVenda.replace(",", "."));

        // Permissões
        const temPermissaoCadastrar = temPermissao("Suprimentos", "cadastrar");
        const temPermissaoAlterar = temPermissao("Suprimentos", "alterar");

        const metodo = idSup ? "PUT" : "POST";

        if (!idSup && !temPermissaoCadastrar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para cadastrar novos suprimentos.", "error");
        }

        if (idSup && !temPermissaoAlterar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para alterar suprimentos.", "error");
        }

        if (!descSup || !vlrCusto || !vlrVenda) {
            return Swal.fire("Campos obrigatórios!", "Preencha todos os campos antes de enviar.", "warning");
        }

        const dados = { descSup, custo, venda };

        // Verifica alterações
        if (
            idSup &&
            parseInt(idSup) === parseInt(window.SuprimentoOriginal?.idSup) &&
            descSup === window.SuprimentoOriginal?.descSup &&
            Number(custo).toFixed(2) === Number(window.SuprimentoOriginal?.vlrCusto).toFixed(2) &&
            Number(venda).toFixed(2) === Number(window.SuprimentoOriginal?.vlrVenda).toFixed(2)
        ) {
            return Swal.fire("Nenhuma alteração foi detectada!", "Faça alguma alteração antes de salvar.", "info");
        }

        const url = idSup
            ? `/suprimentos/${idSup}`
            : "/suprimentos";

        try {
            // Confirma alteração (PUT)
            if (metodo === "PUT") {
                const { isConfirmed } = await Swal.fire({
                    title: "Deseja salvar as alterações?",
                    text: "Você está prestes a atualizar os dados do s.",
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

            await Swal.fire("Sucesso!", respostaApi.message || "Suprimento salvo com sucesso.", "success");
            limparCamposSuprimento();

        } catch (error) {
            console.error("Erro ao enviar dados:", error);
            Swal.fire("Erro", error.message || "Erro ao salvar s.", "error");
        }
    });

    botaoPesquisar.addEventListener("click", async function (event) {
    event.preventDefault();
    limparCamposSuprimento();

    console.log("Pesquisando Suprimento...");

    // Verifica permissão
    const temPermissaoPesquisar = temPermissao("Suprimentos", "pesquisar");

    if (!temPermissaoPesquisar) {
        return Swal.fire(
            "Acesso negado",
            "Você não tem permissão para pesquisar suprimentos.",
            "error"
        );
    }

    try {
        const suprimentos = await fetchComToken("/suprimentos");

        if (!suprimentos || suprimentos.length === 0) {
            return Swal.fire({
                icon: 'info',
                title: 'Nenhum suprimento cadastrado',
                text: 'Não foi encontrado nenhum suprimento no sistema.',
                confirmButtonText: 'Ok'
            });
        }

        console.log("Suprimentos encontrados:", suprimentos);

        const select = criarSelectSuprimento(suprimentos);
        limparCamposSuprimento();

        const input = document.querySelector("#descSup");

        if (input && input.parentNode) {
            input.parentNode.replaceChild(select, input);
        }

        const label = document.querySelector('label[for="descSup"]');
        if (label) {
            label.style.display = "none";
        }

        // Evento ao escolher um s
        select.addEventListener("change", async function () {
            const desc = this.value?.trim();

            if (!desc) return;

            await carregarSuprimentoDescricao(desc, this);

            const novoInput = document.createElement("input");
            novoInput.type = "text";
            novoInput.id = "descSup";
            novoInput.name = "descSup";
            
            // --- ESTAS LINHAS SÃO AS QUE ARRUMAM O VALID ---
            novoInput.required = true; 
            novoInput.setAttribute("placeholder", " "); // Ajuda o CSS a detectar conteúdo
            novoInput.setAttribute("spellcheck", "false");
            // ----------------------------------------------

            novoInput.className = "form uppercase"; 
            novoInput.value = desc;

            novoInput.addEventListener("input", function () {
                this.value = this.value.toUpperCase();
            });

            if (this.parentNode) {
                this.parentNode.replaceChild(novoInput, this);
            }

            // REATIVA O LABEL
            if (label) {
                label.style.display = ""; // Remove o display manual para voltar ao absoluto do CSS
                label.textContent = " Suprimento ";
            }

            // Adiciona o blur novamente
            adicionarEventoBlurSuprimento();
        });

    } catch (error) {
        console.error("Erro ao carregar Suprimentos:", error);
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: error.message || 'Não foi possível carregar os suprimentos.',
            confirmButtonText: 'Ok'
        });
    }
});

    

}

function adicionarListenersAoInputDescSup(inputElement) {
    // Remove listeners anteriores para evitar duplicidade
    if (novoInputDescSupInputListener) {
        inputElement.removeEventListener("input", novoInputDescSupInputListener);
    }
    if (novoInputDescSupBlurListener) {
        inputElement.removeEventListener("blur", novoInputDescSupBlurListener);
    }

    novoInputDescSupInputListener = function() {
        this.value = this.value.toUpperCase();
    };
    inputElement.addEventListener("input", novoInputDescSupInputListener);

    novoInputDescSupBlurListener = async function() {
        if (!this.value.trim()) return;
        await carregarSuprimentoDescricao(this.value, this);
    };
    inputElement.addEventListener("blur", novoInputDescSupBlurListener);
}


function resetarCampoDescSupParaInput() {
    const descSupCampo = document.getElementById("descSup");
    // Verifica se o campo atual é um select e o substitui por um input
    if (descSupCampo && descSupCampo.tagName.toLowerCase() === "select") {
        const input = document.createElement("input");
        input.type = "text";
        input.id = "descSup";
        input.name = "descSup";
        input.value = ""; // Limpa o valor
        input.placeholder = "Descrição do Suprimento";
        input.className = "form";
        input.classList.add('uppercase');
        input.required = true;

        // Remove o listener do select antes de substituí-lo
        if (selectSuprimentoChangeListener) {
            descSupCampo.removeEventListener("change", selectSuprimentoChangeListener);
            selectSuprimentoChangeListener = null;
        }

        descSupCampo.parentNode.replaceChild(input, descSupCampo);
        adicionarListenersAoInputDescSup(input); // Adiciona os listeners ao novo input

        const label = document.querySelector('label[for="descSup"]');
        if (label) {
            label.style.display = "block";
            label.textContent = "Descrição do Suprimento";
        }
    }
}


// =============================================================================
// Função de Desinicialização do Módulo Suprimentos
// =============================================================================
function desinicializarSuprimentoModal() {
    console.log("🧹 Desinicializando módulo Suprimentos.js...");

    const descSupElement = document.querySelector("#descSup");
    const botaoEnviar = document.querySelector("#Enviar");
    const botaoPesquisar = document.querySelector("#Pesquisar");
    const botaoLimpar = document.querySelector("#Limpar");

    // 1. Remover listeners de eventos dos elementos fixos
    if (botaoLimpar && limparSuprimentoButtonListener) {
        botaoLimpar.removeEventListener("click", limparSuprimentoButtonListener);
        limparSuprimentoButtonListener = null;
        console.log("Listener de click do Limpar (Suprimentos) removido.");
    }
    if (botaoEnviar && enviarSuprimentoButtonListener) {
        botaoEnviar.removeEventListener("click", enviarSuprimentoButtonListener);
        enviarSuprimentoButtonListener = null;
        console.log("Listener de click do Enviar (Suprimentos) removido.");
    }
    if (botaoPesquisar && pesquisarSuprimentoButtonListener) {
        botaoPesquisar.removeEventListener("click", pesquisarSuprimentoButtonListener);
        pesquisarSuprimentoButtonListener = null;
        console.log("Listener de click do Pesquisar (Suprimentos) removido.");
    }

    // 2. Remover listeners do campo descSup (que pode ser input ou select)
    if (descSupElement) {
        if (descSupElement.tagName.toLowerCase() === "input") {
            if (descSupBlurListener) {
                descSupElement.removeEventListener("blur", descSupBlurListener);
                descSupBlurListener = null;
                console.log("Listener de blur do descSup (input original) removido.");
            }
            if (novoInputDescSupInputListener) {
                descSupElement.removeEventListener("input", novoInputDescSupInputListener);
                novoInputDescSupInputListener = null;
                console.log("Listener de input do descSup (input dinâmico) removido.");
            }
            if (novoInputDescSupBlurListener) {
                descSupElement.removeEventListener("blur", novoInputDescSupBlurListener);
                novoInputDescSupBlurListener = null;
                console.log("Listener de blur do descSup (input dinâmico) removido.");
            }

        } else if (descSupElement.tagName.toLowerCase() === "select" && selectSuprimentoChangeListener) {
            descSupElement.removeEventListener("change", selectSuprimentoChangeListener);
            selectSuprimentoChangeListener = null;
            console.log("Listener de change do select descSup removido.");
        }
    }

    // 3. Limpar o estado global e campos do formulário
    window.SuprimentoOriginal = null; // Zera o objeto de s original
    limparCamposSuprimento(); // Limpa todos os campos visíveis do formulário
   // document.querySelector("#form").reset(); // Garante que o formulário seja completamente resetado
    document.querySelector("#idSup").value = ""; // Limpa o ID oculto
    resetarCampoDescSupParaInput(); // Garante que o campo descSup volte a ser um input padrão

    console.log("✅ Módulo Suprimentos.js desinicializado.");
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
document.addEventListener("mousedown", (e) => {
    window.ultimoClique = e.target;
});

function adicionarEventoBlurSuprimento() {
    const input = document.querySelector("#descSup");
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
        console.log("Campo descSup procurado:", desc);

        if (!desc) return;

        try {
            await carregarSuprimentoDescricao(desc, this);
            console.log("Suprimento selecionado depois de carregarSuprimentoDescricao:", this.value);
        } catch (error) {
            console.error("Erro ao buscar Suprimento:", error);
        }
    });
}

async function carregarSuprimentoDescricao(desc, elementoAtual) {
    try {
        // 1. Verifique se o nome do parâmetro na URL bate com o que o Router espera (descSup)
        const suprimentos = await fetchComToken(`/suprimentos?descSup=${encodeURIComponent(desc)}`);
        
        // 2. O banco retorna tudo em MINÚSCULO (idsup, descsup, ctosup, vdasup)
        if (!suprimentos || !suprimentos.idsup) throw new Error("Suprimento não encontrado");
     
        // 3. Preencha os campos usando os nomes em minúsculo vindos do banco
        document.querySelector("#idSup").value = suprimentos.idsup;
        document.querySelector("#ctoSup").value = suprimentos.ctosup;
        document.querySelector("#vdaSup").value = suprimentos.vdasup;

        // 4. Atualize o objeto original para o Dirty Checking funcionar (também em minúsculo)
        window.SuprimentoOriginal = {
            idSup: suprimentos.idsup,
            descSup: suprimentos.descsup,
            vlrCusto: suprimentos.ctosup,
            vlrVenda: suprimentos.vdasup
        };

        console.log("Campos preenchidos com sucesso!");

    } catch (error) {
        //console.warn("Erro ao buscar s:", error);

        //const temPermissaoCadastrar = temPermissao("Suprimentos", "cadastrar");
        //const temPermissaoAlterar = temPermissao("Suprimentos", "alterar");

        // const metodo = idSup ? "PUT" : "POST";

        // if (!idSup && !temPermissaoCadastrar) {
        //     return Swal.fire("Acesso negado", "Você não tem permissão para cadastrar novos suprimentos.", "error");
        // }

        // if (idSup && !temPermissaoAlterar) {
        //     return Swal.fire("Acesso negado", "Você não tem permissão para alterar suprimentos.", "error");
        // }

        // if (!descSup) {
        //     return Swal.fire("Campos obrigatórios!", "Preencha todos os campos antes de enviar.", "warning");
        // }

        // const dados = { descSup };        

        // if (parseInt(idSup) === parseInt(window.SuprimentoOriginal?.idSup)) {
        //     console.log("Suprimento não alterado, não será enviado.");
        // }
        // if (descSup === window.SuprimentoOriginal?.descSup) {
        //     console.log("Suprimento não alterado, não será enviado.");
        // }
        // // Verifica alterações
        // if (

        //     parseInt(idSup) === parseInt(window.SuprimentoOriginal?.idSup) &&
        //     descSup === window.SuprimentoOriginal?.descSup
        // ) {
        //     return Swal.fire("Nenhuma alteração foi detectada!", "Faça alguma alteração antes de salvar.", "info");
        // }

        // const url = idSup
        //     ? `/suprimentos/${idSup}`
        //     : "/suprimentos";

        // try {
        //     // Confirma alteração (PUT)
        //     if (metodo === "PUT") {
        //         const { isConfirmed } = await Swal.fire({
        //             title: "Deseja salvar as alterações?",
        //             text: "Você está prestes a atualizar os dados do Suprimento.",
        //             icon: "question",
        //             showCancelButton: true,
        //             confirmButtonText: "Sim, salvar",
        //             cancelButtonText: "Cancelar",
        //             reverseButtons: true,
        //             focusCancel: true
        //         });
        //         if (!isConfirmed) return;
        //     }

        //     console.log("Enviando dados para o servidor:", dados, url, metodo);
        //     const respostaApi = await fetchComToken(url, {
        //         method: metodo,
        //         headers: {
        //             'Content-Type': 'application/json'
        //         },
        //         body: JSON.stringify(dados)
        //     });            

        //     await Swal.fire("Sucesso!", respostaApi.message || "Suprimento salvo com sucesso.", "success");
        //     limparCamposSuprimento();

        // } catch (error) {
        //     console.error("Erro ao enviar dados:", error);
        //     Swal.fire("Erro", error.message || "Erro ao salvar s.", "error");
        // }

        const inputIdSup = document.querySelector("#idSup");
        const podeCadastrar = temPermissao("Suprimentos", "cadastrar");

        console.log("Valor de inputIdSup.value:", inputIdSup.value, podeCadastrar);
        if (!inputIdSup.value) {
            console.log("Detectado Suprimento não encontrado e usuário tem permissão para cadastrar.");
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

            console.log("Resultado bruto do Swal.fire:", resultado);
            if (resultado.isConfirmed) {
                console.log("DEBUG: Swal.fire CONFIRMADO! Prosseguindo...");
                console.log("Valor de elementoAtual.value APÓS CONFIRMAÇÃO (deve ser o digitado):", elementoAtual.value); // Log após confirmação
                // Nenhuma ação de limpeza aqui. O campo deve permanecer com o valor.
            } else { // Usuário clicou em Cancelar ou descartou o modal
                console.log("DEBUG: Swal.fire CANCELADO ou DISMISSADO. Detalhes:", resultado);
                console.log("DEBUG: Limpando elementoAtual.value, pois não foi confirmado o cadastro."); // Log antes de limpar
                elementoAtual.value = ""; // Limpa o campo se não for cadastrar
                setTimeout(() => {
                    elementoAtual.focus();
                }, 0);
                return; // Sai da função carregarSuprimentoDescricao
            }
        } else if (!podeCadastrar) {
            console.log("Suprimento não encontrado, mas usuário NÃO tem permissão para cadastrar.");
            Swal.fire({
                icon: "info",
                title: "Suprimento não cadastrado",
                text: "Você não tem permissão para cadastrar suprimentos.",
                confirmButtonText: "OK"
            });
            // Se não tem permissão e não encontrou, limpa o campo também para evitar confusão.
            elementoAtual.value = ""; 
            setTimeout(() => {
                elementoAtual.focus();
            }, 0);
            return; // Sai da função carregarSuprimentoDescricao
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
    const campos = ["idSup", "descSup","ctoSup", "vdaSup" ];
    campos.forEach(id => {
        const campo = document.getElementById(id);
        if (campo) campo.value = "";
    });
    
}

function configurarEventosSuprimento() {
    console.log("Configurando eventos Suprimento...");
    verificaSuprimento(); // Carrega os Suprimento ao abrir o modal
    adicionarEventoBlurSuprimento();
    console.log("Entrou configurar Suprimento no SUPRIMENTO.js.");
    

} 
window.configurarEventosSuprimento = configurarEventosSuprimento;

function configurarEventosEspecificos(modulo) {
  console.log("⚙️ configurarEventosEspecificos recebeu:", modulo);
  if (modulo.trim().toLowerCase() === 'suprimentos') {
    configurarEventosSuprimento();
    
    if (typeof aplicarPermissoes === "function" && window.permissoes) {
      aplicarPermissoes(window.permissoes);
    } else {
      console.warn("⚠️ aplicarPermissoes ou window.permissoes ainda não estão disponíveis para Suprimentos.");
    }
  }
}
window.configurarEventosEspecificos = configurarEventosEspecificos;

window.moduloHandlers = window.moduloHandlers || {};

window.moduloHandlers['Suprimentos'] = { // A chave 'Suprimentos' (com E maiúsculo) deve corresponder ao seu Index.js
    configurar: configurarEventosSuprimento,
    desinicializar: desinicializarSuprimentoModal
};
