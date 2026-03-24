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

let blurCodTipoContaListener = null;
let limparButtonListener = null;
let enviarButtonListener = null;
let pesquisarButtonListener = null;
let selectTipoContaChangeListener = null;
let inputNmTipoContaBlurListener = null;

if (typeof window.TipoContaOriginal === "undefined") {
    window.TipoContaOriginal = {
        idTipoConta: "",
        nmTipoConta: "",
        ativo: false
       
    };
}

async function verificaTipoConta() {
    console.log("Carregando Tipo Conta...");

    const botaoEnviar = document.querySelector("#Enviar");
    const botaoPesquisar = document.querySelector("#Pesquisar");
    const botaoLimpar = document.querySelector("#Limpar");
    const nmTipoContaInput = document.querySelector("#nmTipoConta");

    const form = document.querySelector("#form");


    // Adiciona os ouvintes para validar enquanto digita ou seleciona
    if (nmTipoContaInput) {
        nmTipoContaInput.addEventListener("input", validarFormulario);
    }
    

    validarFormulario();
 
    const ativoCheckbox = document.querySelector("#ativo");
    if (ativoCheckbox) {
        console.log("Checkbox 'ativo' encontrado.");
        ativoCheckbox.checked = false;
    }
    else {
        console.log("Checkbox 'ativo' não encontrado.");
    } 
   

    if (!botaoEnviar || !form) {
        console.error("Formulário ou botão não encontrado no DOM.");
        return;
    }

    botaoLimpar.addEventListener("click", (e) => {
        e.preventDefault();
        limparCamposTipoConta();
    });

    botaoEnviar.addEventListener("click", async (e) => {
        e.preventDefault();       

        const idTipoConta = document.querySelector("#idTipoConta").value.trim();
        const nmTipoConta = document.querySelector("#nmTipoConta").value.toUpperCase().trim();
        const ativo = document.querySelector("#ativo").checked;
        

        const temPermissaoCadastrar = temPermissao("TipoConta", "cadastrar");
        const temPermissaoAlterar = temPermissao("TipoConta", "alterar");

        const metodo = idTipoConta ? "PUT" : "POST";

        if (!idTipoConta && !temPermissaoCadastrar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para cadastrar novos Tipos de Conta.", "error");
        }

        if (idTipoConta && !temPermissaoAlterar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para alterar Tipos de Conta.", "error");
        }

        if (!nmTipoConta || nmTipoConta.length === 0) {
            return Swal.fire("Campos obrigatórios!", "Preencha todos os campos antes de enviar.", "warning");
        }

        const dados = {nmTipoConta, ativo};
        if (
            parseInt(idTipoConta) === parseInt(TipoContaOriginal?.idTipoConta) &&
            nmTipoConta === TipoContaOriginal?.nmTipoConta &&
            ativo === TipoContaOriginal?.ativo
           
        ) {
            return Swal.fire("Nenhuma alteração foi detectada!", "Faça alguma alteração antes de salvar.", "info");
        }

        const url = idTipoConta ? `/tipoconta/${idTipoConta}` : "/tipoconta";

        try {
            if (metodo === "PUT") {
                const { isConfirmed } = await Swal.fire({
                    title: "Deseja salvar as alterações?",
                    text: "Você está prestes a atualizar os dados do TipoConta.",
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
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dados)
            });

            await Swal.fire("Sucesso!", respostaApi.message || "Tipo de Conta salvo com sucesso.", "success");
            limparCamposTipoConta();

        } catch (error) {
            console.error("Erro ao enviar dados:", error);
            Swal.fire("Erro", error.message || "Erro ao salvar banco.", "error");
        }
    });

    botaoPesquisar.addEventListener("click", async function (e) {
        e.preventDefault();
        limparCamposTipoConta();

        const temPermissaoPesquisar = temPermissao('TipoConta', 'pesquisar');
        if (!temPermissaoPesquisar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para pesquisar.", "warning");
        }

        try {
            const tipocontaEncontrados = await fetchComToken("/tipoconta"); // Use /tipoconta (minúsculo) conforme sua rota adaptada

            if (!tipocontaEncontrados || tipocontaEncontrados.length === 0) {
                return Swal.fire({
                    icon: 'info',
                    title: 'Nenhuma conta cadastrada',
                    text: 'Não foi encontrado nenhuma conta no sistema.',
                    confirmButtonText: 'Ok'
                });
            }
            const select = criarSelectTipoConta(tipocontaEncontrados);
        
            console.log("Tipo de Conta encontrados da API:", tipocontaEncontrados); // Log mais descritivo
            limparCamposTipoConta();
            const input = document.querySelector("#nmTipoConta");

            if (input && input.parentNode) {
                input.parentNode.replaceChild(select, input);
            }

            const label = document.querySelector('label[for="nmTipoConta"]');
            if (label) label.style.display = "none";

            select.addEventListener("change", async function () {
                const desc = this.value?.trim();
                if (!desc) return;

                await carregarTipoContaDescricao(desc, this);

                const novoInput = document.createElement("input");
                novoInput.type = "text";
                novoInput.id = "nmTipoConta";
                novoInput.name = "nmTipoConta";
                novoInput.required = true;
                novoInput.className = "form";
                novoInput.value = desc;

                novoInput.addEventListener("input", function () {
                    this.value = this.value.toUpperCase();
                    validarFormulario();
                });

                novoInput.addEventListener("input", validarFormulario);

                this.parentNode.replaceChild(novoInput, this);
                adicionarEventoBlurTipoConta();

                if (label) {
                    label.style.display = "block";
                    label.textContent = "Tipo da Conta";
                }

                novoInput.addEventListener("blur", async function () {
                    if (!this.value.trim()) return;
                    await carregarTipoContaDescricao(this.value, this);
                });
            });


        } catch (error) {
            console.error("Erro ao carregar Tipo de Contas:", error);
            Swal.fire({
                icon: 'error',
                title: 'Erro',
                text: 'Não foi possível carregar os Tipo de Contas.',
                confirmButtonText: 'Ok'
            });
        }
    });   
    
}

function desinicializarTipoContaModal() {
    console.log("🧹 Desinicializando módulo TipoConta.js");

    const botaoEnviar = document.querySelector("#Enviar");
    const botaoPesquisar = document.querySelector("#Pesquisar");
    const botaoLimpar = document.querySelector("#Limpar");
    const inputNmTipoConta = document.querySelector("#nmTipoConta"); // Pode ser input ou select
    const ativoCheckbox = document.querySelector("#ativo");   

    if (botaoLimpar && limparButtonListener) {
        botaoLimpar.removeEventListener("click", limparButtonListener);
        limparButtonListener = null;
    }
    if (botaoEnviar && enviarButtonListener) {
        botaoEnviar.removeEventListener("click", enviarButtonListener);
        enviarButtonListener = null;
    }
    if (botaoPesquisar && pesquisarButtonListener) {
        botaoPesquisar.removeEventListener("click", pesquisarButtonListener);
        pesquisarButtonListener = null;
    }
   
    // Remover listener do input #nmTipoConta (se for um input no momento da desinicialização)
    if (inputNmTipoConta && inputNmTipoConta.tagName === "INPUT" && inputNmTipoContaBlurListener) {
        inputNmTipoConta.removeEventListener("blur", inputNmTipoContaBlurListener);
        inputNmTipoContaBlurListener = null;
    }

    if (ativoCheckbox) {
        ativoCheckbox.checked = false;
    }
    
    // Limpar o estado global TipoContaOriginal
    TipoContaOriginal = { idTipoConta: "", nmTipoConta: "", ativo: "" };
    console.log("✅ Módulo TipoConta.js desinicializado.");
}

function criarSelectTipoConta(tipocontaEncontrados) {
   
    const select = document.createElement("select");
    select.id = "nmTipoConta";
    select.name = "nmTipoConta";
    select.required = true;
    select.className = "form";

   
    // Adicionar opções
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.text = "Selecione um Tipo de Conta...";
    defaultOption.disabled = true;
    defaultOption.selected = true;
    select.appendChild(defaultOption);
   
    console.log("PESQUISANDO Tipo de Conta:", tipocontaEncontrados);

    tipocontaEncontrados.forEach(tpcontaachado => {
        const option = document.createElement("option");
        option.value = tpcontaachado.nmtipoconta;
        option.text = tpcontaachado.nmtipoconta;
        select.appendChild(option);
    });
 
    return select;
}

document.addEventListener("mousedown", (e) => {
    window.ultimoClique = e.target;
});

function adicionarEventoBlurTipoConta() {
    const input = document.querySelector("#nmTipoConta");
    if (!input) return;

    input.addEventListener("blur", async function () {
        const botoesIgnorados = ["Limpar", "Pesquisar", "Enviar"];
        const ehBotaoIgnorado = (
            ultimoClique?.id && botoesIgnorados.includes(ultimoClique.id)
        ) || (ultimoClique?.classList && ultimoClique.classList.contains("close"));

        if (ehBotaoIgnorado) {
            return;
        }

        const desc = this.value.trim();
        if (!desc) return;

        try {
            await carregarTipoContaDescricao(desc, this);
        } catch (error) {
            console.error("Erro ao buscar TipoConta:", error);
        }
    });
}


async function carregarTipoContaDescricao(desc, elementoAtual) {
    try {
        const dadosRecebidos = await fetchComToken(`/tipoconta?nmTipoConta=${encodeURIComponent(desc)}`);
        
        // Verifica se retornou um array vazio ou objeto nulo
        if (!dadosRecebidos || (Array.isArray(dadosRecebidos) && dadosRecebidos.length === 0)) {
            throw new Error("TipoConta não encontrada");
        }

        // Se a API retornar um array, pegamos o primeiro índice
        const tipoconta = Array.isArray(dadosRecebidos) ? dadosRecebidos[0] : dadosRecebidos;

        document.querySelector("#idTipoConta").value = tipoconta.idtipoconta || "";
        document.querySelector("#nmTipoConta").value = tipoconta.nmtipoconta || "";
      
        
        const isAtivo = tipoconta.ativo === true || tipoconta.ativo === 1 || tipoconta.ativo === "S" || tipoconta.ativo === "T";
        document.querySelector("#ativo").checked = isAtivo;

        window.TipoContaOriginal = {
            idTipoConta: tipoconta.idtipoconta,     
            nmTipoConta: tipoconta.nmtipoconta,
            ativo: isAtivo           
        };

        validarFormulario(); // Atualiza o estado do botão enviar

    } catch (error) {
        console.warn("TipoConta não encontrada, abrindo opção de cadastro.");

        const idAtual = document.querySelector("#idTipoConta").value.trim();
        if (idAtual) {
            validarFormulario();
            return; // Deixa o usuário continuar editando normalmente
        }
        
        // Limpa o ID para garantir que o sistema entenda que é um novo cadastro
        document.querySelector("#idTipoConta").value = "";

        const podeCadastrarTipoConta = temPermissao("TipoConta", "cadastrar");

        if (podeCadastrarTipoConta) {
            const resultado = await Swal.fire({
                icon: 'question',
                title: `Deseja cadastrar "${desc.toUpperCase()}"?`,
                text: `O Tipo de conta não foi encontrada no sistema.`,
                showCancelButton: true,
                confirmButtonText: "Sim, cadastrar",
                cancelButtonText: "Cancelar",
                reverseButtons: true
            });

            if (resultado.isConfirmed) {
                // Se confirmou: Garantimos que o ID está vazio para ser um novo registro (POST)
                document.querySelector("#idTipoConta").value = "";
                // O valor em nmTipoConta ("Benefícios") permanece lá para o usuário salvar
                validarFormulario();
            } else {
                // Se cancelou: Limpamos tudo e voltamos o foco
                document.querySelector("#idTipoConta").value = "";
                elementoAtual.value = "";
                validarFormulario();
                setTimeout(() => elementoAtual.focus(), 100);
            }
        } else {
            // Sem permissão: Informa e limpa
            Swal.fire("Acesso negado", "Você não tem permissão para cadastrar novos tipos de conta.", "info");
            document.querySelector("#idTipoConta").value = "";
            elementoAtual.value = "";
            validarFormulario();
        }
    }
}

function limparCamposTipoConta() {
    console.log("Limpando campos do Tipo Conta...");
    const idEvent = document.getElementById("idTipoConta");
    const nmTipoContaEl = document.getElementById("nmTipoConta");
    const ativoEl = document.getElementById("ativo");

    if (idEvent) idEvent.value = "";
    if (nmTipoContaEl) nmTipoContaEl.value = "";
    if (ativoEl) ativoEl.checked = false;

    if (nmTipoContaEl && nmTipoContaEl.tagName === "SELECT") {
        const novoInput = document.createElement("input");
        novoInput.type = "text";
        novoInput.id = "nmTipoConta";
        novoInput.name = "nmTipoConta";
        novoInput.required = true;
        novoInput.className = "form";

        novoInput.addEventListener("input", function () {
            this.value = this.value.toUpperCase();
        });

        novoInput.addEventListener("blur", async function () {
            if (!this.value.trim()) return;
            await carregarTipoContaDescricao(this.value, this);
        });

        nmTipoContaEl.parentNode.replaceChild(novoInput, nmTipoContaEl);
        adicionarEventoBlurTipoConta();

    

        const label = document.querySelector('label[for="nmTipoConta"]');
        if (label) {
            label.style.display = "block";
            label.textContent = "Tipo da Conta";
        }

        const campoAtivo = document.getElementById("ativo");
        if (campoAtivo && campoAtivo.type === "checkbox") {
            campoAtivo.checked = false;
        }
    }


    validarFormulario();
}

function validarFormulario() {
    const elNm = document.querySelector("#nmTipoConta");
    const botaoEnviar = document.querySelector("#Enviar");

    if (!elNm || !botaoEnviar) return;

    const nmTipoConta = elNm.value.trim();


    // Habilita se ambos tiverem valor
    if (nmTipoConta.length > 0) {
        botaoEnviar.disabled = false;
        botaoEnviar.style.opacity = "1";
        botaoEnviar.style.cursor = "pointer";
    } else {
        botaoEnviar.disabled = true;
        botaoEnviar.style.opacity = "0.5";
        botaoEnviar.style.cursor = "not-allowed";
    }
}

function configurarCadTipoConta() {
    verificaTipoConta();
    adicionarEventoBlurTipoConta();
}
window.configurarCadTipoConta = configurarCadTipoConta;

function configurarEventosEspecificos(modulo) {
    if (modulo.trim().toLowerCase() === 'tipoconta') {
        configurarCadTipoConta();
        if (typeof aplicarPermissoes === "function" && window.permissoes) {
            aplicarPermissoes(window.permissoes);
        }
    }
}
window.configurarEventosEspecificos = configurarEventosEspecificos;


window.moduloHandlers = window.moduloHandlers || {};

// Registra as funções de configuração e desinicialização para este módulo
window.moduloHandlers['TipoConta'] = { // Use 'Tipoconta' (com C maiúsculo) para corresponder ao seu mapaModulos no Index.js
    configurar: configurarCadTipoConta,
    desinicializar: desinicializarTipoContaModal
};
