import { fetchComToken } from '../utils/utils.js';

if (typeof window.BancoOriginal === "undefined") {
    window.BancoOriginal = {
        idBanco: "",
        nmBanco: "",
        codBanco: ""
    };
}

console.log("Entrou no js");

async function verificaBanco() {
    console.log("Carregando Banco...");

    const botaoEnviar = document.querySelector("#Enviar");
    const botaoPesquisar = document.querySelector("#Pesquisar");
    const botaoLimpar = document.querySelector("#Limpar");
    const form = document.querySelector("#form");
    const inputCodBancoElement = document.querySelector("#codBanco");
   
    if (inputCodBancoElement) {
        inputCodBancoElement.addEventListener("blur", async function () {
            const codBanco = this.value.toUpperCase().trim();
            await preencherBanco(codBanco);
        });
        console.log("[initFuncionariosModal] Listener 'blur' adicionado ao campo de CÓDIGO do banco (#codigobanco).");
    } else {
        console.warn("[initFuncionariosModal] Campo de CÓDIGO do banco (#codigobanco) não encontrado.");
    }

    if (!botaoEnviar || !form) {
        console.error("Formulário ou botão não encontrado no DOM.");
        return;
    }

    botaoLimpar.addEventListener("click", (e) => {
        e.preventDefault();
        limparCamposBanco();
    });

    botaoEnviar.addEventListener("click", async (e) => {
        e.preventDefault();

        const idBanco = document.querySelector("#idBanco").value.trim();
        const nmBanco = document.querySelector("#nmBanco").value.toUpperCase().trim();
        const codBanco = document.querySelector("#codBanco").value.toUpperCase().trim();

        const temPermissaoCadastrar = temPermissao("Bancos", "cadastrar");
        const temPermissaoAlterar = temPermissao("Bancos", "alterar");

        const metodo = idBanco ? "PUT" : "POST";

        if (!idBanco && !temPermissaoCadastrar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para cadastrar novos Bancos.", "error");
        }

        if (idBanco && !temPermissaoAlterar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para alterar Bancos.", "error");
        }

        if (!nmBanco || !codBanco) {
            return Swal.fire("Campos obrigatórios!", "Preencha todos os campos antes de enviar.", "warning");
        }

        const dados = { nmBanco, codBanco };

        if (
            parseInt(idBanco) === parseInt(BancoOriginal?.idBanco) &&
            nmBanco === BancoOriginal?.nmBanco &&
            codBanco === BancoOriginal?.codBanco
        ) {
            return Swal.fire("Nenhuma alteração foi detectada!", "Faça alguma alteração antes de salvar.", "info");
        }

        const url = idBanco ? `/Bancos/${idBanco}` : "/Bancos";

        try {
            if (metodo === "PUT") {
                const { isConfirmed } = await Swal.fire({
                    title: "Deseja salvar as alterações?",
                    text: "Você está prestes a atualizar os dados do Banco.",
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
                body: JSON.stringify(dados)
            });

            await Swal.fire("Sucesso!", respostaApi.message || "Banco salvo com sucesso.", "success");
            limparCamposBanco();

        } catch (error) {
            console.error("Erro ao enviar dados:", error);
            Swal.fire("Erro", error.message || "Erro ao salvar banco.", "error");
        }
    });

    botaoPesquisar.addEventListener("click", async function (e) {
        e.preventDefault();
        limparCamposBanco();

        const temPermissaoPesquisar = temPermissao('Bancos', 'pesquisar');
        if (!temPermissaoPesquisar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para pesquisar.", "warning");
        }

        try {
            const bancosEncontrados = await fetchComToken("/bancos"); // Use /bancos (minúsculo) conforme sua rota adaptada

            const select = criarSelectBanco(bancosEncontrados);
        
            console.log("Bancos encontrados da API:", bancosEncontrados); // Log mais descritivo
            limparCamposBanco();
            const input = document.querySelector("#nmBanco");

            if (input && input.parentNode) {
                input.parentNode.replaceChild(select, input);
            }

            const label = document.querySelector('label[for="nmBanco"]');
            if (label) label.style.display = "none";

            select.addEventListener("change", async function () {
                const desc = this.value?.trim();
                if (!desc) return;

                await carregarBancoDescricao(desc, this);

                const novoInput = document.createElement("input");
                novoInput.type = "text";
                novoInput.id = "nmBanco";
                novoInput.name = "nmBanco";
                novoInput.required = true;
                novoInput.className = "form";
                novoInput.value = desc;

                novoInput.addEventListener("input", function () {
                    this.value = this.value.toUpperCase();
                });

                this.parentNode.replaceChild(novoInput, this);
                adicionarEventoBlurBanco();

                if (label) {
                    label.style.display = "block";
                    label.textContent = "Nome do Banco";
                }

                novoInput.addEventListener("blur", async function () {
                    if (!this.value.trim()) return;
                    await carregarBancoDescricao(this.value, this);
                });
            });


        } catch (error) {
            console.error("Erro ao carregar Bancos:", error);
            Swal.fire({
                icon: 'error',
                title: 'Erro',
                text: 'Não foi possível carregar os Bancos.',
                confirmButtonText: 'Ok'
            });
        }
    });   
    
}

function criarSelectBanco(bancosEncontrados) {
   
    const select = document.createElement("select");
    select.id = "nmBanco";
    select.name = "nmBanco";
    select.required = true;
    select.className = "form";

   
    // Adicionar opções
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.text = "Selecione um Banco...";
    defaultOption.disabled = true;
    defaultOption.selected = true;
    select.appendChild(defaultOption);
   
    console.log("PESQUISANDO Banco:", bancosEncontrados);

    bancosEncontrados.forEach(bancosachado => {
        const option = document.createElement("option");
        option.value = bancosachado.nmbanco;
        option.text = bancosachado.nmbanco;
        select.appendChild(option);
    });
 
    return select;
}

document.addEventListener("mousedown", (e) => {
    window.ultimoClique = e.target;
});

function adicionarEventoBlurBanco() {
    const input = document.querySelector("#nmBanco");
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
            await carregarBancoDescricao(desc, this);
        } catch (error) {
            console.error("Erro ao buscar Banco:", error);
        }
    });
}

async function preencherBanco(codBanco) {
    try {
        const bancos = await fetchComToken(`/bancos?codBanco=${encodeURIComponent(codBanco)}`);    
        
        document.querySelector("#idBanco").value = bancos.idbanco;
        document.querySelector("#nmBanco").value = bancos.nmbanco;

        window.BancoOriginal = {
            idBanco: bancos.idbanco,
            codBanco:bancos.codbanco,
            nmBanco: bancos.nmbanco,
        };

        console.log("Banco encontrado:", BancoOriginal);

    } catch (error) {
        console.warn("Banco não encontrado.");

        const inputIdBanco = document.querySelector("#idBanco");
        const podeCadastrarBanco = temPermissao("bancos", "cadastrar");

        if (!inputIdBanco.value && podeCadastrarBanco) {
            const resultado = await Swal.fire({
                icon: 'question',
                title: `Deseja cadastrar "${codBanco.toUpperCase()}" como novo Banco?`,
                text: `Banco "${codBanco.toUpperCase()}" não encontrado.`,
                showCancelButton: true,
                confirmButtonText: "Sim, cadastrar",
                cancelButtonText: "Cancelar",
                reverseButtons: true,
                focusCancel: true
            });
            
            if (!resultado.isConfirmed) {
                console.log("Usuário cancelou o cadastro do Banco.");
                elementoAtual.value = ""; // Limpa o campo se não for cadastrar
                setTimeout(() => {
                    elementoAtual.focus();
                }, 0);
                return;
            }
        } else if (!podeCadastrarBanco) {
            Swal.fire({
                icon: "info",
                title:"Banco não cadastrado",
                text: "Você não tem permissão para cadastrar bancos.",
                confirmButtonText: "OK"
            });
        }
        
    }   
}


async function carregarBancoDescricao(desc, elementoAtual) {
    try {
            const bancos = await fetchComToken(`/bancos?nmBanco=${encodeURIComponent(desc)}`);
           // console.log("Resposta do servidor:", response);
           
            document.querySelector("#idBanco").value = bancos.idbanco;
            document.querySelector("#codBanco").value = bancos.codbanco;
    
            window.BancoOriginal = {
                idBanco: bancos.idbanco,
                codBanco:bancos.codbanco,
                nmBanco: bancos.nmbanco,
            };
    
            console.log("Banco encontrado:", BancoOriginal);
    
        } catch (error) {
            console.warn("Banco não encontrado.");
    
            const inputIdBanco = document.querySelector("#idBanco");
            const podeCadastrarBanco = temPermissao("bancos", "cadastrar");
    
           if (!inputIdBanco.value && podeCadastrarBanco) {
                 const resultado = await Swal.fire({
                    icon: 'question',
                    title: `Deseja cadastrar "${desc.toUpperCase()}" como novo Banco?`,
                    text: `Banco "${desc.toUpperCase()}" não encontrado.`,
                    showCancelButton: true,
                    confirmButtonText: "Sim, cadastrar",
                    cancelButtonText: "Cancelar",
                    reverseButtons: true,
                    focusCancel: true
                });
    
                
                if (!resultado.isConfirmed) {
                    console.log("Usuário cancelou o cadastro do Banco.");
                    elementoAtual.value = ""; // Limpa o campo se não for cadastrar
                    setTimeout(() => {
                        elementoAtual.focus();
                    }, 0);
                    return;
                }
            } else if (!podeCadastrarBanco) {
                Swal.fire({
                    icon: "info",
                    title:"Banco não cadastrado",
                    text: "Você não tem permissão para cadastrar bancos.",
                    confirmButtonText: "OK"
                });
            }
            
        }
}

function limparCamposBanco() {
    const idEvent = document.getElementById("idBanco");
    const descEventEl = document.getElementById("nmBanco");
    const codBancoEl = document.getElementById("codBanco");

    if (idEvent) idEvent.value = "";
    if (descEventEl) descEventEl.value = "";
    if (codBancoEl) codBancoEl.value = "";

    if (descEventEl && descEventEl.tagName === "SELECT") {
        const novoInput = document.createElement("input");
        novoInput.type = "text";
        novoInput.id = "nmBanco";
        novoInput.name = "nmBanco";
        novoInput.required = true;
        novoInput.className = "form";

        novoInput.addEventListener("input", function () {
            this.value = this.value.toUpperCase();
        });

        novoInput.addEventListener("blur", async function () {
            if (!this.value.trim()) return;
            await carregarBancoDescricao(this.value, this);
        });

        descEventEl.parentNode.replaceChild(novoInput, descEventEl);
        adicionarEventoBlurBanco();

        const label = document.querySelector('label[for="nmBanco"]');
        if (label) {
            label.style.display = "block";
            label.textContent = "Nome do Banco";
        }
    }
}


function configurarbancosCadBanco() {
    verificaBanco();
    adicionarEventoBlurBanco();
}
window.configurarbancosCadBanco = configurarbancosCadBanco;

function configurarEventosEspecificos(modulo) {
    if (modulo.trim().toLowerCase() === 'bancos') {
        configurarbancosCadBanco();
        if (typeof aplicarPermissoes === "function" && window.permissoes) {
            aplicarPermissoes(window.permissoes);
        }
    }
}
window.configurarEventosEspecificos = configurarEventosEspecificos;
