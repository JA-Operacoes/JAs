import { fetchComToken, aplicarTema } from '../utils/utils.js';

document.addEventListener("DOMContentLoaded", function () {
    const idempresa = localStorage.getItem("idempresa");

    if (idempresa) {
        const apiUrl = `/empresas/${idempresa}`;

        fetchComToken(apiUrl)
            .then(empresa => {
                const tema = empresa.nmfantasia;
                aplicarTema(tema);
            })
            .catch(error => {
                console.error("❌ Erro ao buscar dados da empresa para o tema:", error);
            });
    }
});

let limparButtonListener = null;
let enviarButtonListener = null;
let pesquisarButtonListener = null;

if (typeof window.PlanoContasOriginal === "undefined") {
    window.PlanoContasOriginal = {
        idPlanoConta: "",
        codigo: "",
        nmPlanoConta: "",
        ativo: false        
    };
}

async function verificaPlanoContas() {
    console.log("Carregando Plano de Contas...");

    const botaoEnviar = document.querySelector("#Enviar");
    const botaoPesquisar = document.querySelector("#Pesquisar");
    const botaoLimpar = document.querySelector("#Limpar");
    const form = document.querySelector("#form-planocontas");

    const codPlanoContaInput = document.querySelector("#codPlanoConta");

    const nmPlanoContaInput = document.querySelector("#nmPlanoConta");
    
    if (codPlanoContaInput) {
        codPlanoContaInput.addEventListener("input", validarFormulario);
    }

    if (nmPlanoContaInput) {
        nmPlanoContaInput.addEventListener("input", validarFormulario);
    }
    

    validarFormulario();
   

    const ativoCheckbox = document.querySelector("#ativoPlanoContas");
    if (ativoCheckbox) {
        ativoCheckbox.checked = false;
    }

    if (!botaoEnviar || !form) {
        console.error("Formulário ou botão não encontrado no DOM.");
        return;
    }

    // Configuração dos Listeners para remoção posterior
    limparButtonListener = (e) => {
        e.preventDefault();
        limparCamposPlanoContas();
    };
    botaoLimpar.addEventListener("click", limparButtonListener);

    enviarButtonListener = async (e) => {
        e.preventDefault();       

        const idPlanoConta = document.querySelector("#idPlanoConta").value.trim();
        const codigo = document.querySelector("#codPlanoConta").value.trim();
        const nmPlanoConta = document.querySelector("#nmPlanoConta").value.toUpperCase().trim();
        const ativo = document.querySelector("#ativoPlanoContas").checked;
        
        const temPermissaoCadastrar = temPermissao("Planocontas", "cadastrar");
        const temPermissaoAlterar = temPermissao("Planocontas", "alterar");

        const metodo = idPlanoConta ? "PUT" : "POST";

        console.log("temPermissaoCadastrar:", temPermissaoCadastrar, "temPermissaoAlterar:", temPermissaoAlterar);

        if (!idPlanoConta && !temPermissaoCadastrar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para cadastrar novos Planos de Contas.", "error");
        }

        if (idPlanoConta && !temPermissaoAlterar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para alterar Planos de Contas.", "error");
        }

        if (!codigo || codigo.length === 0) {
            return Swal.fire("Campos obrigatórios!", "Preencha o campo Código do Plano de Contas antes de enviar.", "warning");
        }

        if (!nmPlanoConta || nmPlanoConta.length === 0) {
            return Swal.fire("Campos obrigatórios!", "Preencha o campo Nome do Plano de Contas antes de enviar.", "warning");
        }

        const dados = { codigo, nmPlanoConta, ativo }; // Objeto com novo nome de campo
        
        // Dirty Checking ajustado para String para comparar com o valor do Select
        const semAlteracao = 
            String(idPlanoConta) === String(window.PlanoContaOriginal?.idPlanoConta) &&
            codigo === window.PlanoContaOriginal?.codigo &&
            nmPlanoConta === window.PlanoContaOriginal?.nmPlanoConta &&
            ativo === window.PlanoContaOriginal?.ativo;

        if (idPlanoConta && semAlteracao) {
            return Swal.fire("Nenhuma alteração foi detectada!", "Faça alguma alteração antes de salvar.", "info");
        }

        const url = idPlanoConta ? `/planocontas/${idPlanoConta}` : "/planocontas";
        try {
            if (metodo === "PUT") {
                const { isConfirmed } = await Swal.fire({
                    title: "Deseja salvar as alterações?",
                    text: "Você está prestes a atualizar os dados do Plano de Contas.",
                    icon: "question",
                    showCancelButton: true,
                    confirmButtonText: "Sim, salvar",
                    cancelButtonText: "Cancelar",
                    reverseButtons: true
                });
                if (!isConfirmed) return;
            }

            const respostaApi = await fetchComToken(url, {
                method: metodo,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dados)
            });

            await Swal.fire("Sucesso!", respostaApi.message || "Plano de Contas salvo com sucesso.", "success");
            limparCamposPlanoContas();

        } catch (error) {
            console.error("Erro ao enviar dados:", error);
            Swal.fire("Erro", error.message || "Erro ao salvar plano de contas.", "error");
        }
    };
    botaoEnviar.addEventListener("click", enviarButtonListener);

    pesquisarButtonListener = async function (e) {
        e.preventDefault();
        limparCamposPlanoContas();

        const temPermissaoPesquisar = temPermissao('Planocontas', 'pesquisar');
        if (!temPermissaoPesquisar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para pesquisar.", "warning");
        }

        try {
            const planocontasEncontrados = await fetchComToken("/planocontas");

            if (!planocontasEncontrados || planocontasEncontrados.length === 0) {
                return Swal.fire({
                    icon: 'info',
                    title: 'Nenhum plano de conta cadastrado',
                    text: 'Não foi encontrado nenhum plano de conta no sistema.',
                    confirmButtonText: 'Ok'
                });
            }
            const select = criarSelectPlanoContas(planocontasEncontrados);
            
            const input = document.querySelector("#nmPlanoConta");
            if (input && input.parentNode) {
                input.parentNode.replaceChild(select, input);
            }

            const label = document.querySelector('label[for="nmPlanoConta"]');
            if (label) label.style.display = "none";

            select.addEventListener("change", async function () {
                const desc = this.value?.trim();
                if (!desc) return;

                await carregarPlanoContasDescricao(desc, this);

                const novoInput = document.createElement("input");
                novoInput.type = "text";
                novoInput.id = "nmPlanoConta";
                novoInput.name = "nmPlanoConta";
                novoInput.required = true;
                novoInput.className = "form";
                novoInput.value = desc;

                novoInput.addEventListener("input", function () {
                    this.value = this.value.toUpperCase();
                    validarFormulario();
                });

                this.parentNode.replaceChild(novoInput, this);
                adicionarEventoBlurPlanoContas();

                if (label) {
                    label.style.display = "block";
                    label.textContent = "Nome do Plano de Contas";
                }
            });

        } catch (error) {
            console.error("Erro ao carregar Planos de Contas:", error);
            Swal.fire("Erro", "Não foi possível carregar os Planos de Contas.", "error");
        }
    };
    botaoPesquisar.addEventListener("click", pesquisarButtonListener);
}

function desinicializarPlanoContasModal() {
    console.log("🧹 Desinicializando módulo PlanoContas.js");

    const botaoEnviar = document.querySelector("#Enviar");
    const botaoPesquisar = document.querySelector("#Pesquisar");
    const botaoLimpar = document.querySelector("#Limpar");

    if (botaoLimpar && limparButtonListener) botaoLimpar.removeEventListener("click", limparButtonListener);
    if (botaoEnviar && enviarButtonListener) botaoEnviar.removeEventListener("click", enviarButtonListener);
    if (botaoPesquisar && pesquisarButtonListener) botaoPesquisar.removeEventListener("click", pesquisarButtonListener);

    limparButtonListener = null;
    enviarButtonListener = null;
    pesquisarButtonListener = null;

    window.PlanoContasOriginal = {codigo: "", idPlanoConta: "", nmPlanoConta: "", ativo: false };
}

function criarSelectPlanoContas(planocontasEncontrados) {
    const select = document.createElement("select");
    select.id = "nmPlanoConta";
    select.name = "nmPlanoConta";
    select.required = true;
    select.className = "form";

    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.text = "Selecione um Conta...";
    defaultOption.disabled = true;
    defaultOption.selected = true;
    select.appendChild(defaultOption);

    planocontasEncontrados.forEach(planoconta => {
        const option = document.createElement("option");
        option.value = planoconta.nmplanocontas;
        option.text = planoconta.nmplanocontas;
        select.appendChild(option);
    });

    return select;
}

document.addEventListener("mousedown", (e) => {
    window.ultimoClique = e.target;
});

function adicionarEventoBlurPlanoContas() {
    const input = document.querySelector("#nmPlanoConta");
    if (!input) return;

    input.addEventListener("blur", async function () {
        const botoesIgnorados = ["Limpar", "Pesquisar", "Enviar"];
        const ehBotaoIgnorado = (
            window.ultimoClique?.id && botoesIgnorados.includes(window.ultimoClique.id)
        ) || (window.ultimoClique?.classList && window.ultimoClique.classList.contains("close"));

        if (ehBotaoIgnorado) return;

        const desc = this.value.trim();
        if (!desc) return;

        await carregarPlanoContasDescricao(desc, this);
    });
}


async function carregarPlanoContasDescricao(desc, elementoAtual) {
    try {
        const dadosRecebidos = await fetchComToken(`/planocontas?nmPlanoConta=${encodeURIComponent(desc)}`);
        
        console.log("Dados recebidos para Plano de Contas:", dadosRecebidos);

        if (!dadosRecebidos || (Array.isArray(dadosRecebidos) && dadosRecebidos.length === 0)) {
            throw new Error("Conta não encontrada");
        }

        const planocontas = Array.isArray(dadosRecebidos) ? dadosRecebidos[0] : dadosRecebidos;

        document.querySelector("#idPlanoConta").value = planocontas.idplanocontas || "";
        document.querySelector("#codPlanoConta").value = planocontas.codigo || "";
        document.querySelector("#nmPlanoConta").value = planocontas.nmplanocontas || "";  
        
        const isAtivo = planocontas.ativo === true || planocontas.ativo === 1 || planocontas.ativo === "S" || planocontas.ativo === "T";
        document.querySelector("#ativoPlanoContas").checked = isAtivo;

        window.PlanoContasOriginal = {
            idPlanoConta: planocontas.idplanocontas,  
            codigo: planocontas.codigo,   
            nmPlanoConta: planocontas.nmplanocontas,
            ativo: isAtivo            
        };

        validarFormulario();

    } catch (error) {
        console.warn("Plano de conta não encontrado com este nome exato.");
        
        const idExistente = document.querySelector("#idPlanoConta").value;
        // Se JÁ EXISTE um ID, não oferecemos novo cadastro. 
        // Apenas deixamos o usuário continuar editando o nome para o PUT.
        if (idExistente) {
            console.log("Editando plano de conta existente, permitindo alteração de nome.");
            return; 
        }

        // Se NÃO existe ID, aí sim verificamos permissão para novo cadastro
        if (temPermissao("Planocontas", "cadastrar")) {
            const resultado = await Swal.fire({
                icon: 'question',
                title: `Deseja cadastrar "${desc.toUpperCase()}"?`,
                text: `O plano de conta não foi encontrado no sistema.`,
                showCancelButton: true,
                confirmButtonText: "Sim, cadastrar",
                cancelButtonText: "Cancelar",
                reverseButtons: true
            });

            if (!resultado.isConfirmed) {
                elementoAtual.value = "";
                validarFormulario();
            }
        } else {
            Swal.fire("Acesso negado", "Você não tem permissão para cadastrar.", "info");
            elementoAtual.value = "";
            validarFormulario();
        }
    }
}

function limparCamposPlanoContas() {
    const idEvent = document.getElementById("idPlanoConta");
    const codPlanoContasEl = document.getElementById("codPlanoConta");
    const nmPlanoContaEl = document.getElementById("nmPlanoConta");   
    const ativoEl = document.getElementById("ativoPlanoContas");

   

    if (idEvent) idEvent.value = "";
    if (codPlanoContasEl) codPlanoContasEl.value = "";
    if (nmPlanoContaEl) nmPlanoContaEl.value = "";
   
    if (ativoEl) ativoEl.checked = false;

    if (nmPlanoContaEl && nmPlanoContaEl.tagName === "SELECT") {
        const novoInput = document.createElement("input");
        novoInput.type = "text";
        novoInput.id = "nmPlanoConta";
        novoInput.name = "nmPlanoConta";
        novoInput.required = true;
        novoInput.className = "form";

        novoInput.addEventListener("input", function () {
            this.value = this.value.toUpperCase();
        });

        nmPlanoContaEl.parentNode.replaceChild(novoInput, nmPlanoContaEl);
        adicionarEventoBlurPlanoContas();

        const label = document.querySelector('label[for="nmPlanoConta"]');
        if (label) {
            label.style.display = "block";
            label.textContent = "Nome do Plano de Conta";
        }
    }
    
    validarFormulario();
}


function validarFormulario() {
    const elCod = document.querySelector("#codPlanoConta");
    const elNm = document.querySelector("#nmPlanoConta");
   
    const botaoEnviar = document.querySelector("#Enviar");

   // console.log("Validando formulário de Plano de Conta...", "Código Plano Conta:", elCod.value, "Nome Plano Conta:", elNm.value, botaoEnviar);
    if (!elCod || !elNm || !botaoEnviar) return;

    const codigo = elCod.value.trim();
    const nmPlanoConta = elNm.value.trim();    

    
    if (codigo.length > 0 && nmPlanoConta.length > 0) {
        botaoEnviar.disabled = false;
        botaoEnviar.style.opacity = "1";
        botaoEnviar.style.cursor = "pointer";
    } else {
        botaoEnviar.disabled = true;
        botaoEnviar.style.opacity = "0.5";
        botaoEnviar.style.cursor = "not-allowed";
    }
}

function configurarCadPlanoContas() {
    verificaPlanoContas();
    adicionarEventoBlurPlanoContas();
}

window.configurarEventosEspecificos = function(modulo) {
    if (modulo.trim().toLowerCase() === 'planocontas') {
        configurarCadPlanoContas();
        if (typeof aplicarPermissoes === "function" && window.permissoes) {
            aplicarPermissoes(window.permissoes);
        }
    }
};

window.moduloHandlers = window.moduloHandlers || {};
window.moduloHandlers['PlanoContas'] = {
    configurar: configurarCadPlanoContas,
    desinicializar: desinicializarPlanoContasModal
};