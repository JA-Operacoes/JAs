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

let blurCodContaListener = null;
let limparButtonListener = null;
let enviarButtonListener = null;
let pesquisarButtonListener = null;
let selectContaChangeListener = null;
let inputNmContaBlurListener = null;

if (typeof window.ContaOriginal === "undefined") {
    window.ContaOriginal = {
        idConta: "",
        nmConta: "",
        ativo: false,
        tpConta: ""
      //  codConta: ""
    };
}

async function verificaConta() {
    console.log("Carregando Conta...");

    const botaoEnviar = document.querySelector("#Enviar");
    const botaoPesquisar = document.querySelector("#Pesquisar");
    const botaoLimpar = document.querySelector("#Limpar");
    const form = document.querySelector("#form");
  //  const inputCodContaElement = document.querySelector("#codConta");

  const ativoCheckbox = document.querySelector("#ativo");
    if (ativoCheckbox) {
        console.log("Checkbox 'ativo' encontrado.");
        ativoCheckbox.checked = false;
    }
    else {
        console.log("Checkbox 'ativo' não encontrado.");
    }
   
    // if (inputCodContaElement) {
    //     inputCodContaElement.addEventListener("blur", async function () {
    //         const codConta = this.value.toUpperCase().trim();
    //         await preencherConta(codConta);
    //     });
    //     console.log("[initFuncionariosModal] Listener 'blur' adicionado ao campo de CÓDIGO do banco (#codigobanco).");
    // } else {
    //     console.warn("[initFuncionariosModal] Campo de CÓDIGO do banco (#codigobanco) não encontrado.");
    // }

    if (!botaoEnviar || !form) {
        console.error("Formulário ou botão não encontrado no DOM.");
        return;
    }

    botaoLimpar.addEventListener("click", (e) => {
        e.preventDefault();
        limparCamposConta();
    });

    botaoEnviar.addEventListener("click", async (e) => {
        e.preventDefault();

        const idConta = document.querySelector("#idConta").value.trim();
        const nmConta = document.querySelector("#nmConta").value.toUpperCase().trim();
        const ativo = document.querySelector("#ativo").checked;
        const tpConta = document.querySelector("#tpConta").value;
     //   const codConta = document.querySelector("#codConta").value.toUpperCase().trim();

        const temPermissaoCadastrar = temPermissao("Contas", "cadastrar");
        const temPermissaoAlterar = temPermissao("Contas", "alterar");

        const metodo = idConta ? "PUT" : "POST";

        if (!idConta && !temPermissaoCadastrar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para cadastrar novos Contas.", "error");
        }

        if (idConta && !temPermissaoAlterar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para alterar Contas.", "error");
        }

        if (!nmConta || nmConta.length === 0 || !tpConta || tpConta.length === 0) {
            return Swal.fire("Campos obrigatórios!", "Preencha todos os campos antes de enviar.", "warning");
        }

        const dados = {nmConta, ativo, tpConta};
        if (
            parseInt(idConta) === parseInt(ContaOriginal?.idConta) &&
            nmConta === ContaOriginal?.nmConta &&
            ativo === ContaOriginal?.ativo &&
            tpConta === ContaOriginal?.tpConta
           // codConta === ContaOriginal?.codConta
        ) {
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

            await Swal.fire("Sucesso!", respostaApi.message || "Conta salvo com sucesso.", "success");
            limparCamposConta();

        } catch (error) {
            console.error("Erro ao enviar dados:", error);
            Swal.fire("Erro", error.message || "Erro ao salvar banco.", "error");
        }
    });

    botaoPesquisar.addEventListener("click", async function (e) {
        e.preventDefault();
        limparCamposConta();

        const temPermissaoPesquisar = temPermissao('Contas', 'pesquisar');
        if (!temPermissaoPesquisar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para pesquisar.", "warning");
        }

        try {
            const contasEncontrados = await fetchComToken("/contas"); // Use /contas (minúsculo) conforme sua rota adaptada

            if (!contasEncontrados || contasEncontrados.length === 0) {
                return Swal.fire({
                    icon: 'info',
                    title: 'Nenhuma conta cadastrada',
                    text: 'Não foi encontrado nenhuma conta no sistema.',
                    confirmButtonText: 'Ok'
                });
            }
            const select = criarSelectConta(contasEncontrados);
        
            console.log("Contas encontrados da API:", contasEncontrados); // Log mais descritivo
            limparCamposConta();
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
                });

                this.parentNode.replaceChild(novoInput, this);
                adicionarEventoBlurConta();

                if (label) {
                    label.style.display = "block";
                    label.textContent = "Nome do Conta";
                }

                novoInput.addEventListener("blur", async function () {
                    if (!this.value.trim()) return;
                    await carregarContaDescricao(this.value, this);
                });
            });


        } catch (error) {
            console.error("Erro ao carregar Contas:", error);
            Swal.fire({
                icon: 'error',
                title: 'Erro',
                text: 'Não foi possível carregar os Contas.',
                confirmButtonText: 'Ok'
            });
        }
    });   
    
}

function desinicializarContasModal() {
    console.log("🧹 Desinicializando módulo Contas.js");

   // const inputCodContaElement = document.querySelector("#codConta");
    const botaoEnviar = document.querySelector("#Enviar");
    const botaoPesquisar = document.querySelector("#Pesquisar");
    const botaoLimpar = document.querySelector("#Limpar");
    const inputNmConta = document.querySelector("#nmConta"); // Pode ser input ou select
    const ativoCheckbox = document.querySelector("#ativo");
    // // Remover listeners que foram armazenados
    // if (inputCodContaElement && blurCodContaListener) {
    //     inputCodContaElement.removeEventListener("blur", blurCodContaListener);
    //     blurCodContaListener = null;
    // }

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
    // Remover listener do select (se o #nmConta for um select no momento da desinicialização)
    if (inputNmConta && inputNmConta.tagName === "SELECT" && selectContaChangeListener) {
        inputNmConta.removeEventListener("change", selectContaChangeListener);
        selectContaChangeListener = null;
    }
    // Remover listener do input #nmConta (se for um input no momento da desinicialização)
    if (inputNmConta && inputNmConta.tagName === "INPUT" && inputNmContaBlurListener) {
        inputNmConta.removeEventListener("blur", inputNmContaBlurListener);
        inputNmContaBlurListener = null;
    }

    if (ativoCheckbox) {
        ativoCheckbox.checked = false;
    }
    
    // Limpar o estado global ContaOriginal
    ContaOriginal = { idConta: "", nmConta: "", ativo: "" };
    console.log("✅ Módulo Contas.js desinicializado.");
}

function criarSelectConta(contasEncontrados) {
   
    const select = document.createElement("select");
    select.id = "nmConta";
    select.name = "nmConta";
    select.required = true;
    select.className = "form";

   
    // Adicionar opções
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.text = "Selecione um Conta...";
    defaultOption.disabled = true;
    defaultOption.selected = true;
    select.appendChild(defaultOption);
   
    console.log("PESQUISANDO Conta:", contasEncontrados);

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
            ultimoClique?.id && botoesIgnorados.includes(ultimoClique.id)
        ) || (ultimoClique?.classList && ultimoClique.classList.contains("close"));

        if (ehBotaoIgnorado) {
            return;
        }

        const desc = this.value.trim();
        if (!desc) return;

        try {
            await carregarContaDescricao(desc, this);
        } catch (error) {
            console.error("Erro ao buscar Conta:", error);
        }
    });
}

async function preencherConta(codConta) {
    try {
        const contas = await fetchComToken(`/contas?codConta=${encodeURIComponent(codConta)}`);    
        
        document.querySelector("#idConta").value = contas.idbanco;
        document.querySelector("#nmConta").value = contas.nmbanco;
        document.querySelector("#ativo").checked = contas.ativo;

        window.ContaOriginal = {
            idConta: contas.idbanco,
          //  codConta:contas.codbanco,
            nmConta: contas.nmbanco,
            ativo: contas.ativo
        };

        console.log("Conta encontrado:", ContaOriginal);

    } catch (error) {
        console.warn("Conta não encontrado.");

        const inputIdConta = document.querySelector("#idConta");
        const podeCadastrarConta = temPermissao("contas", "cadastrar");

        if (!inputIdConta.value && podeCadastrarConta) {
            const resultado = await Swal.fire({
                icon: 'question',
                title: `Deseja cadastrar "${idConta.toUpperCase()}" como novo Conta?`,
                text: `Conta "${idConta.toUpperCase()}" não encontrado.`,
                showCancelButton: true,
                confirmButtonText: "Sim, cadastrar",
                cancelButtonText: "Cancelar",
                reverseButtons: true,
                focusCancel: true
            });
            
            if (!resultado.isConfirmed) {
                console.log("Usuário cancelou o cadastro do Conta.");
                elementoAtual.value = ""; // Limpa o campo se não for cadastrar
                setTimeout(() => {
                    elementoAtual.focus();
                }, 0);
                return;
            }
        } else if (!podeCadastrarConta) {
            Swal.fire({
                icon: "info",
                title:"Conta não cadastrado",
                text: "Você não tem permissão para cadastrar contas.",
                confirmButtonText: "OK"
            });
        }
        
    }   
}


async function carregarContaDescricao(desc, elementoAtual) {
    try {
            const contas = await fetchComToken(`/contas?nmConta=${encodeURIComponent(desc)}`);
           // console.log("Resposta do servidor:", response);
           
            document.querySelector("#idConta").value = contas.idconta;
            document.querySelector("#nmConta").value = contas.nmconta || "";
            document.querySelector("#tpConta").value = contas.tpconta || "";
            
           // document.querySelector("#codConta").value = contas.codbanco;

            const isAtivo = contas.ativo === true || contas.ativo === 1 || contas.ativo === "S";
            document.querySelector("#ativo").checked = isAtivo;
            console.log("Ativo definido para:", isAtivo);
            window.ContaOriginal = {
                idConta: contas.idconta,
                //codConta:contas.codbanco,
                nmConta: contas.nmconta,
                ativo: isAtivo,
                tpConta: contas.tpconta
            };
    
            console.log("Conta encontrado:", ContaOriginal);
    
        } catch (error) {
            console.warn("Conta não encontrado.");
    
            const inputIdConta = document.querySelector("#idConta");
            const podeCadastrarConta = temPermissao("contas", "cadastrar");
    
           if (!inputIdConta.value && podeCadastrarConta) {
                 const resultado = await Swal.fire({
                    icon: 'question',
                    title: `Deseja cadastrar "${desc.toUpperCase()}" como novo Conta?`,
                    text: `Conta "${desc.toUpperCase()}" não encontrado.`,
                    showCancelButton: true,
                    confirmButtonText: "Sim, cadastrar",
                    cancelButtonText: "Cancelar",
                    reverseButtons: true,
                    focusCancel: true
                });
    
                
                if (!resultado.isConfirmed) {
                    console.log("Usuário cancelou o cadastro do Conta.");
                    elementoAtual.value = ""; // Limpa o campo se não for cadastrar
                    setTimeout(() => {
                        elementoAtual.focus();
                    }, 0);
                    return;
                }
            } else if (!podeCadastrarConta) {
                Swal.fire({
                    icon: "info",
                    title:"Conta não cadastrado",
                    text: "Você não tem permissão para cadastrar contas.",
                    confirmButtonText: "OK"
                });
            }
            
        }
}

function limparCamposConta() {
    const idEvent = document.getElementById("idConta");
    const nmContaEl = document.getElementById("nmConta");
    const tpContaEl = document.getElementById("tpConta");
    const ativoEl = document.getElementById("ativo");

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

        novoInput.addEventListener("blur", async function () {
            if (!this.value.trim()) return;
            await carregarContaDescricao(this.value, this);
        });

        descEventEl.parentNode.replaceChild(novoInput, nmContaEl);
        adicionarEventoBlurConta();

        const label = document.querySelector('label[for="nmConta"]');
        if (label) {
            label.style.display = "block";
            label.textContent = "Nome do Conta";
        }

        const campoAtivo = document.getElementById("ativo");
        if (campoAtivo && campoAtivo.type === "checkbox") {
            campoAtivo.checked = false;
        }
    }
}


function configurarCadConta() {
    verificaConta();
    adicionarEventoBlurConta();
}
window.configurarcontasCadConta = configurarCadConta;

function configurarEventosEspecificos(modulo) {
    if (modulo.trim().toLowerCase() === 'contas') {
        configurarCadConta();
        if (typeof aplicarPermissoes === "function" && window.permissoes) {
            aplicarPermissoes(window.permissoes);
        }
    }
}
window.configurarEventosEspecificos = configurarEventosEspecificos;


window.moduloHandlers = window.moduloHandlers || {};

// Registra as funções de configuração e desinicialização para este módulo
window.moduloHandlers['Contas'] = { // Use 'Contas' (com C maiúsculo) para corresponder ao seu mapaModulos no Index.js
    configurar: configurarcontasCadConta,
    desinicializar: desinicializarContasModal
};
