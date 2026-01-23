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

if (typeof window.ContaOriginal === "undefined") {
    window.ContaOriginal = {
        idConta: "",
        nmConta: "",
        ativo: false,
        idtipoconta: "",
        idempresapagadora: "" // Alterado de tpConta para idtipoconta
    };
}

async function verificaConta() {
    console.log("Carregando Conta...");

    const botaoEnviar = document.querySelector("#Enviar");
    const botaoPesquisar = document.querySelector("#Pesquisar");
    const botaoLimpar = document.querySelector("#Limpar");
    const form = document.querySelector("#form-contas");

    const nmContaInput = document.querySelector("#nmConta");
    const tpContaSelect = document.querySelector("#tpConta");
    const empresaPagadoraSelect = document.querySelector("#empresaPagadora");

    if (nmContaInput) {
        nmContaInput.addEventListener("input", validarFormulario);
    }
    if (tpContaSelect) {
        tpContaSelect.addEventListener("change", validarFormulario);
    }
    if (empresaPagadoraSelect) {
        empresaPagadoraSelect.addEventListener("change", validarFormulario);
    }

    validarFormulario();
    carregarSelectTipoConta();
    carregarSelectEmpresaPagadora();

    const ativoCheckbox = document.querySelector("#ativo");
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
        limparCamposConta();
    };
    botaoLimpar.addEventListener("click", limparButtonListener);

    enviarButtonListener = async (e) => {
        e.preventDefault();       

        const idConta = document.querySelector("#idConta").value.trim();
        const nmConta = document.querySelector("#nmConta").value.toUpperCase().trim();
        const ativo = document.querySelector("#ativo").checked;
        const idtipoconta = document.querySelector("#tpConta").value; // O valor do select agora é o ID
        const idempresapagadora = document.querySelector("#empresaPagadora").value; // Novo campo

        const temPermissaoCadastrar = temPermissao("Contas", "cadastrar");
        const temPermissaoAlterar = temPermissao("Contas", "alterar");

        const metodo = idConta ? "PUT" : "POST";

        if (!idConta && !temPermissaoCadastrar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para cadastrar novos Contas.", "error");
        }

        if (idConta && !temPermissaoAlterar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para alterar Contas.", "error");
        }

        if (!nmConta || nmConta.length === 0 || !idtipoconta || idtipoconta.length === 0 || !idempresapagadora || idempresapagadora.length === 0) {
            return Swal.fire("Campos obrigatórios!", "Preencha todos os campos antes de enviar.", "warning");
        }

        const dados = { nmConta, ativo, idtipoconta, idempresapagadora }; // Objeto com novo nome de campo
        
        // Dirty Checking ajustado para String para comparar com o valor do Select
        const semAlteracao = 
            String(idConta) === String(window.ContaOriginal?.idConta) &&
            nmConta === window.ContaOriginal?.nmConta &&
            ativo === window.ContaOriginal?.ativo &&
            String(idtipoconta) === String(window.ContaOriginal?.idtipoconta) &&
            String(idempresapagadora) === String(window.ContaOriginal?.idempresapagadora);

        if (idConta && semAlteracao) {
            return Swal.fire("Nenhuma alteração foi detectada!", "Faça alguma alteração antes de salvar.", "info");
        }

        const url = idConta ? `/Contas/${idConta}` : "/Contas";

        try {
            if (metodo === "PUT") {
                const { isConfirmed } = await Swal.fire({
                    title: "Deseja salvar as alterações?",
                    text: "Você está prestes a atualizar os dados do Conta.",
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

            await Swal.fire("Sucesso!", respostaApi.message || "Conta salvo com sucesso.", "success");
            limparCamposConta();

        } catch (error) {
            console.error("Erro ao enviar dados:", error);
            Swal.fire("Erro", error.message || "Erro ao salvar conta.", "error");
        }
    };
    botaoEnviar.addEventListener("click", enviarButtonListener);

    pesquisarButtonListener = async function (e) {
        e.preventDefault();
        limparCamposConta();

        const temPermissaoPesquisar = temPermissao('Contas', 'pesquisar');
        if (!temPermissaoPesquisar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para pesquisar.", "warning");
        }

        try {
            const contasEncontrados = await fetchComToken("/contas");

            if (!contasEncontrados || contasEncontrados.length === 0) {
                return Swal.fire({
                    icon: 'info',
                    title: 'Nenhuma conta cadastrada',
                    text: 'Não foi encontrado nenhuma conta no sistema.',
                    confirmButtonText: 'Ok'
                });
            }
            const select = criarSelectConta(contasEncontrados);
            
            const input = document.querySelector("#nmConta");
            if (input && input.parentNode) {
                input.parentNode.replaceChild(select, input);
            }

            const label = document.querySelector('label[for="nmConta"]');
            if (label) label.style.display = "none";

            select.addEventListener("change", async function () {
                const desc = this.value?.trim();
                if (!desc) return;

                await carregarContaDescricao(desc, this);

                const novoInput = document.createElement("input");
                novoInput.type = "text";
                novoInput.id = "nmConta";
                novoInput.name = "nmConta";
                novoInput.required = true;
                novoInput.className = "form";
                novoInput.value = desc;

                novoInput.addEventListener("input", function () {
                    this.value = this.value.toUpperCase();
                    validarFormulario();
                });

                this.parentNode.replaceChild(novoInput, this);
                adicionarEventoBlurConta();

                if (label) {
                    label.style.display = "block";
                    label.textContent = "Nome do Conta";
                }
            });

        } catch (error) {
            console.error("Erro ao carregar Contas:", error);
            Swal.fire("Erro", "Não foi possível carregar os Contas.", "error");
        }
    };
    botaoPesquisar.addEventListener("click", pesquisarButtonListener);
}

function desinicializarContasModal() {
    console.log("🧹 Desinicializando módulo Contas.js");

    const botaoEnviar = document.querySelector("#Enviar");
    const botaoPesquisar = document.querySelector("#Pesquisar");
    const botaoLimpar = document.querySelector("#Limpar");

    if (botaoLimpar && limparButtonListener) botaoLimpar.removeEventListener("click", limparButtonListener);
    if (botaoEnviar && enviarButtonListener) botaoEnviar.removeEventListener("click", enviarButtonListener);
    if (botaoPesquisar && pesquisarButtonListener) botaoPesquisar.removeEventListener("click", pesquisarButtonListener);

    limparButtonListener = null;
    enviarButtonListener = null;
    pesquisarButtonListener = null;

    window.ContaOriginal = { idConta: "", nmConta: "", ativo: false, idtipoconta: "" };
}

function criarSelectConta(contasEncontrados) {
    const select = document.createElement("select");
    select.id = "nmConta";
    select.name = "nmConta";
    select.required = true;
    select.className = "form";

    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.text = "Selecione um Conta...";
    defaultOption.disabled = true;
    defaultOption.selected = true;
    select.appendChild(defaultOption);

    contasEncontrados.forEach(contasachado => {
        const option = document.createElement("option");
        option.value = contasachado.nmconta;
        option.text = contasachado.nmconta;
        select.appendChild(option);
    });

    return select;
}

document.addEventListener("mousedown", (e) => {
    window.ultimoClique = e.target;
});

function adicionarEventoBlurConta() {
    const input = document.querySelector("#nmConta");
    if (!input) return;

    input.addEventListener("blur", async function () {
        const botoesIgnorados = ["Limpar", "Pesquisar", "Enviar"];
        const ehBotaoIgnorado = (
            window.ultimoClique?.id && botoesIgnorados.includes(window.ultimoClique.id)
        ) || (window.ultimoClique?.classList && window.ultimoClique.classList.contains("close"));

        if (ehBotaoIgnorado) return;

        const desc = this.value.trim();
        if (!desc) return;

        await carregarContaDescricao(desc, this);
    });
}

async function carregarSelectTipoConta() {
    const selectTpConta = document.querySelector("#tpConta");
    if (!selectTpConta) return;

    try {
        const tipos = await fetchComToken('/tipoconta');
        selectTpConta.innerHTML = '<option value="" disabled selected>Selecione o Tipo de Conta</option>';

        if (tipos && Array.isArray(tipos)) {
            tipos.forEach(tipo => {
                if (tipo.ativo) {
                    const option = document.createElement("option");
                    option.value = tipo.idtipoconta;
                    option.textContent = tipo.nmtipoconta;
                    selectTpConta.appendChild(option);
                }
            });
        }
    } catch (error) {
        console.error("Erro ao carregar tipos de conta:", error);
    }
}

async function carregarSelectEmpresaPagadora() {
    const selectEmpresaPagadora = document.querySelector("#empresaPagadora");
    if (!selectEmpresaPagadora) return;

    try {
        const empresas = await fetchComToken('/empresas');
        selectEmpresaPagadora.innerHTML = '<option value="" disabled selected>Selecione a Empresa Pagadora</option>';
        if (empresas && Array.isArray(empresas)) {
            empresas.forEach(empresa => {
                if (empresa.ativo) {
                    const option = document.createElement("option");
                    option.value = empresa.idempresa;
                    option.textContent = empresa.nmfantasia;
                    selectEmpresaPagadora.appendChild(option);
                }
            });
        }
    } catch (error) {
        console.error("Erro ao carregar empresas:", error);
    }
}


async function carregarContaDescricao(desc, elementoAtual) {
    try {
        const dadosRecebidos = await fetchComToken(`/contas?nmConta=${encodeURIComponent(desc)}`);
        
        if (!dadosRecebidos || (Array.isArray(dadosRecebidos) && dadosRecebidos.length === 0)) {
            throw new Error("Conta não encontrada");
        }

        const conta = Array.isArray(dadosRecebidos) ? dadosRecebidos[0] : dadosRecebidos;

        document.querySelector("#idConta").value = conta.idconta || "";
        document.querySelector("#nmConta").value = conta.nmconta || "";
        
        const selectTp = document.querySelector("#tpConta");
        if (selectTp) {
            // Suporta tanto o ID vindo como Integer quanto o legado vindo como String
            const valorBanco = String(conta.idtipoconta || conta.tpconta); 
            selectTp.value = valorBanco;

            if (selectTp.selectedIndex <= 0 && valorBanco !== "undefined" && valorBanco !== "null") {
                console.warn("Aviso: Tipo de conta legado ou não encontrado:", valorBanco);
            }
        }

        const selectEmpPagadora = document.querySelector("#empresaPagadora");
        if (selectEmpPagadora) {
            // Suporta tanto o ID vindo como Integer quanto o legado vindo como String
            const valorBanco = String(conta.idempresapagadora || conta.empresaPagadora); 
            selectEmpPagadora.value = valorBanco;
            if (selectEmpPagadora.selectedIndex <= 0 && valorBanco !== "undefined" && valorBanco !== "null") {
                console.warn("Aviso: Empresa Pagadora legada ou não encontrada:", valorBanco);
            }
        }
        
        const isAtivo = conta.ativo === true || conta.ativo === 1 || conta.ativo === "S" || conta.ativo === "T";
        document.querySelector("#ativo").checked = isAtivo;

        window.ContaOriginal = {
            idConta: conta.idconta,     
            nmConta: conta.nmconta,
            ativo: isAtivo,
            idtipoconta: String(conta.idtipoconta || conta.tpconta),
            idempresapagadora: String(conta.idempresapagadora || conta.empresaPagadora)
        };

        validarFormulario();

    // } catch (error) {
    //     console.warn("Conta não encontrada, abrindo opção de cadastro.");
    //     document.querySelector("#idConta").value = "";

    //     if (temPermissao("Contas", "cadastrar")) {
    //         const resultado = await Swal.fire({
    //             icon: 'question',
    //             title: `Deseja cadastrar "${desc.toUpperCase()}"?`,
    //             text: `A conta não foi encontrada no sistema.`,
    //             showCancelButton: true,
    //             confirmButtonText: "Sim, cadastrar",
    //             cancelButtonText: "Cancelar",
    //             reverseButtons: true
    //         });

    //         if (!resultado.isConfirmed) {
    //             elementoAtual.value = "";
    //             validarFormulario();
    //         }
    //     } else {
    //         Swal.fire("Acesso negado", "Você não tem permissão para cadastrar.", "info");
    //         elementoAtual.value = "";
    //         validarFormulario();
    //     }
    // }
    // ... dentro da função carregarContaDescricao ...
    } catch (error) {
        console.warn("Conta não encontrada com este nome exato.");
        
        const idExistente = document.querySelector("#idConta").value;

        // Se JÁ EXISTE um ID, não oferecemos novo cadastro. 
        // Apenas deixamos o usuário continuar editando o nome para o PUT.
        if (idExistente) {
            console.log("Editando conta existente, permitindo alteração de nome.");
            return; 
        }

        // Se NÃO existe ID, aí sim verificamos permissão para novo cadastro
        if (temPermissao("Contas", "cadastrar")) {
            const resultado = await Swal.fire({
                icon: 'question',
                title: `Deseja cadastrar "${desc.toUpperCase()}"?`,
                text: `A conta não foi encontrada no sistema.`,
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

function limparCamposConta() {
    const idEvent = document.getElementById("idConta");
    const nmContaEl = document.getElementById("nmConta");
    const tpContaEl = document.getElementById("tpConta");
    const ativoEl = document.getElementById("ativo");
    const empresaPagadoraEl = document.getElementById("empresaPagadora");

    if (empresaPagadoraEl) empresaPagadoraEl.value = "";

    if (idEvent) idEvent.value = "";
    if (nmContaEl) nmContaEl.value = "";
    if (tpContaEl) tpContaEl.value = "";
    if (ativoEl) ativoEl.checked = false;

    if (nmContaEl && nmContaEl.tagName === "SELECT") {
        const novoInput = document.createElement("input");
        novoInput.type = "text";
        novoInput.id = "nmConta";
        novoInput.name = "nmConta";
        novoInput.required = true;
        novoInput.className = "form";

        novoInput.addEventListener("input", function () {
            this.value = this.value.toUpperCase();
        });

        nmContaEl.parentNode.replaceChild(novoInput, nmContaEl);
        adicionarEventoBlurConta();

        const label = document.querySelector('label[for="nmConta"]');
        if (label) {
            label.style.display = "block";
            label.textContent = "Nome do Conta";
        }
    }

    
    validarFormulario();
}

// function validarFormulario() {
//     const elNm = document.querySelector("#nmConta");
//     const elTp = document.querySelector("#tpConta");
//     const elEmpPagadora = document.querySelector("#empresaPagadora");
//     const botaoEnviar = document.querySelector("#Enviar");

//     console.log("Validando formulário de Conta...", elNm, elTp, elEmpPagadora, botaoEnviar);

//     if (!elNm || !elTp || !elEmpPagadora || !botaoEnviar) return;

//     const nmConta = elNm.value.trim();
//     const tpConta = elTp.value.trim();
//     const idempresapagadora = elEmpPagadora.value.trim();

//     if (nmConta.length > 0 && tpConta.length > 0 && idempresapagadora.length > 0) {
//         botaoEnviar.disabled = false;
//         botaoEnviar.style.opacity = "1";
//         botaoEnviar.style.cursor = "pointer";
//     } else {
//         botaoEnviar.disabled = true;
//         botaoEnviar.style.opacity = "0.5";
//         botaoEnviar.style.cursor = "not-allowed";
//     }
// }


function validarFormulario() {
    const elNm = document.querySelector("#nmConta");
    const elTp = document.querySelector("#tpConta");
    const elEmpPagadora = document.querySelector("#empresaPagadora");
    const botaoEnviar = document.querySelector("#Enviar");

    console.log("Validando formulário de Conta...", "Nome Conta:", elNm.value, "Tipo Conta:", elTp.value, "Empresa Pagadora:", elEmpPagadora.value, botaoEnviar);
    if (!elNm || !elTp || !elEmpPagadora || !botaoEnviar) return;

    const nmConta = elNm.value.trim();
    const tpConta = elTp.value.trim();
    const idempresapagadora = elEmpPagadora.value.trim();

    // Debug para você ver no console qual campo está travando:
    // console.log({ nmConta, tpConta, idempresapagadora });

    if (nmConta.length > 0 && tpConta.length > 0 && idempresapagadora.length > 0) {
        botaoEnviar.disabled = false;
        botaoEnviar.style.opacity = "1";
        botaoEnviar.style.cursor = "pointer";
    } else {
        botaoEnviar.disabled = true;
        botaoEnviar.style.opacity = "0.5";
        botaoEnviar.style.cursor = "not-allowed";
    }
}

function configurarCadConta() {
    verificaConta();
    adicionarEventoBlurConta();
}

window.configurarEventosEspecificos = function(modulo) {
    if (modulo.trim().toLowerCase() === 'contas') {
        configurarCadConta();
        if (typeof aplicarPermissoes === "function" && window.permissoes) {
            aplicarPermissoes(window.permissoes);
        }
    }
};

window.moduloHandlers = window.moduloHandlers || {};
window.moduloHandlers['Contas'] = {
    configurar: configurarCadConta,
    desinicializar: desinicializarContasModal
};