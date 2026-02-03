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

let blurCodCentroCustoListener = null;
let limparButtonListener = null;
let enviarButtonListener = null;
let pesquisarButtonListener = null;
let selectCentroCustoChangeListener = null;
let inputNmCentroCustoBlurListener = null;
let inputSgCentroCustoBlurListener = null;

let jaPerguntouCadastro = false;

if (typeof window.CentroCustoOriginal === "undefined") {
    window.CentroCustoOriginal = {
        idCentroCusto: "",
        sgCentroCusto: "",
        nmCentroCusto: "",
        ativo: false,
        idempresa: ""
    };
}


async function verificaCentroCusto() {
    console.log("Carregando Centro de Custo...");

    const botaoEnviar = document.querySelector("#Enviar");
    const botaoPesquisar = document.querySelector("#Pesquisar");
    const botaoLimpar = document.querySelector("#Limpar");
    const form = document.querySelector("#form");  

    // Dentro da função verificaCentroCusto()

    const nmInput = document.querySelector("#nmCentroCusto");
    const sgInput = document.querySelector("#siglaCentroCusto");

    if (nmInput) {
        nmInput.addEventListener("input", function() {
            this.value = this.value.toUpperCase();
            validarFormulario(); // Libera o botão se a sigla já estiver preenchida
        });
    }

    if (sgInput) {
        sgInput.addEventListener("input", function() {
            this.value = this.value.toUpperCase();
            validarFormulario(); // Libera o botão se o nome já estiver preenchido
        });
    }

    const nmCentroCustoInput = document.querySelector("#nmCentroCusto");
    const sgCentroCustoInput = document.querySelector("#siglaCentroCusto");  

   
    if (sgCentroCustoInput) {
        sgCentroCustoInput.addEventListener("blur", async function() {
            const sigla = this.value.trim();
            const idVazio = !document.querySelector("#idCentroCusto").value;

            if (!sigla || !idVazio || jaPerguntouCadastro) return;

            try {
                const dados = await fetchComToken(`/centrocusto?sigla=${encodeURIComponent(sigla)}`);
                const lista = Array.isArray(dados) ? dados : [dados];

                if (lista.length > 0) {
                    // Se achou pela sigla, carrega os dados completos pelo nome encontrado
                    await carregarCentroCustoDescricao(lista[0].nmcentrocusto, this);
                } else {
                    // Se a sigla NÃO existe, tenta usar o nome atual ou a própria sigla para perguntar
                    const nomeAtual = document.querySelector("#nmCentroCusto").value.trim();
                    await carregarCentroCustoDescricao(nomeAtual || sigla, this);
                }
            } catch (e) {
                console.error("Erro na busca por sigla", e);
            }
        });
    }

    if (nmCentroCustoInput) {
        nmCentroCustoInput.addEventListener("blur", async function() {
            const nome = this.value.trim();
            const siglaVazia = document.querySelector("#siglaCentroCusto").value.trim() === "";
            const idVazio = !document.querySelector("#idCentroCusto").value;

            // Se eu saí do nome, a sigla está vazia e eu ainda não perguntei nada:
            if (nome && siglaVazia && idVazio && !jaPerguntouCadastro) {
                await carregarCentroCustoDescricao(nome, this);
            }
        });
    }

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
        jaPerguntouCadastro = false;
        limparCamposCentroCusto();
    });
    

    botaoEnviar.addEventListener("click", async (e) => {
        e.preventDefault();

        const idCentroCusto = document.querySelector("#idCentroCusto").value.trim();
        const nmCentroCusto = document.querySelector("#nmCentroCusto").value.toUpperCase().trim();
        const sgCentroCusto = document.querySelector("#siglaCentroCusto").value.toUpperCase().trim();
        const ativo = document.querySelector("#ativo").checked;       
       
       
        if (!nmCentroCusto || !sgCentroCusto) {
            return Swal.fire("Campos obrigatórios", "Informe o nome e a sigla.", "warning");
        }

        // 2. Permissões
        const temPermissaoCadastrar = temPermissao("CentroCusto", "cadastrar");
        const temPermissaoAlterar = temPermissao("CentroCusto", "alterar");
        const metodo = idCentroCusto ? "PUT" : "POST";

        if (!idCentroCusto && !temPermissaoCadastrar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para cadastrar.", "error");
        }
        if (idCentroCusto && !temPermissaoAlterar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para alterar.", "error");
        }

        // 3. BLOCO DE COMPARAÇÃO (Revisado)
        // Garantimos que comparamos arrays de strings e tratamos valores nulos/undefined
       
        
        const semAlteracao = 
            idCentroCusto && // Só bloqueia se for uma edição            
            parseInt(idCentroCusto) === parseInt(CentroCustoOriginal?.idCentroCusto) &&
            nmCentroCusto === CentroCustoOriginal?.nmCentroCusto &&
            sgCentroCusto === CentroCustoOriginal?.sgCentroCusto &&
            ativo === CentroCustoOriginal?.ativo           

        if (idCentroCusto && semAlteracao) {
            return Swal.fire("Nenhuma alteração detectada!", "Altere algum dado antes de salvar.", "info");
        }

        // 4. Envio dos Dados
        const dados = { nmCentroCusto, ativo, sgCentroCusto };
        const url = idCentroCusto ? `/CentroCusto/${idCentroCusto}` : "/CentroCusto";

        try {
            if (metodo === "PUT") {
                const { isConfirmed } = await Swal.fire({
                    title: "Deseja salvar as alterações?",
                    text: "Isso atualizará os vínculos deste Centro de Custo nas empresas selecionadas.",
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

            await Swal.fire("Sucesso!", respostaApi.message || "Dados salvos com sucesso.", "success");
            limparCamposCentroCusto();

        } catch (error) {
            console.error("Erro ao enviar dados:", error);
            Swal.fire("Erro", error.message || "Erro ao salvar.", "error");
        }
        
    });

    botaoPesquisar.addEventListener("click", async function (e) {
        e.preventDefault();
        limparCamposCentroCusto();

        const temPermissaoPesquisar = temPermissao('CentroCusto', 'pesquisar');
        if (!temPermissaoPesquisar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para pesquisar.", "warning");
        }

        try {
            const contasEncontrados = await fetchComToken("/centrocusto"); // Use /contas (minúsculo) conforme sua rota adaptada
            console.log("CentroCusto retornados da API:", contasEncontrados);

            if (!contasEncontrados || contasEncontrados.length === 0) {
                return Swal.fire({
                    icon: 'info',
                    title: 'Nenhuma conta cadastrada',
                    text: 'Não foi encontrado nenhuma conta no sistema.',
                    confirmButtonText: 'Ok'
                });
            }
            const select = criarSelectCentroCusto(contasEncontrados);
        
            console.log("Centro de Custo encontrados da API:", contasEncontrados); // Log mais descritivo
            limparCamposCentroCusto();
            const input = document.querySelector("#nmCentroCusto");

            if (input && input.parentNode) {
                input.parentNode.replaceChild(select, input);
            }

            const label = document.querySelector('label[for="nmCentroCusto"]');
            if (label) label.style.display = "none";

            select.addEventListener("change", async function () {
                const desc = this.value?.trim();
                if (!desc) return;

                await carregarCentroCustoDescricao(desc, this);

                const novoInput = document.createElement("input");
                novoInput.type = "text";
                novoInput.id = "nmCentroCusto";
                novoInput.name = "nmCentroCusto";
                novoInput.required = true;
                novoInput.className = "form";
                novoInput.value = desc;

                novoInput.addEventListener("input", function () {
                    this.value = this.value.toUpperCase();
                    validarFormulario();
                });

                novoInput.addEventListener("input", validarFormulario);

                this.parentNode.replaceChild(novoInput, this);
                adicionarEventoBlurCentroCusto();

                if (label) {
                    label.style.display = "block";
                    label.textContent = "Nome do Centro de Custo";
                }

                novoInput.addEventListener("blur", async function () {
                    if (!this.value.trim()) return;
                    await carregarCentroCustoDescricao(this.value, this);
                });
            });


        } catch (error) {
            console.error("Erro ao carregar CentroCusto:", error);
            Swal.fire({
                icon: 'error',
                title: 'Erro',
                text: 'Não foi possível carregar os CentroCusto.',
                confirmButtonText: 'Ok'
            });
        }
    });
    validarFormulario();
}


function validarFormulario() {
    const elNm = document.querySelector("#nmCentroCusto");
    const elSg = document.querySelector("#siglaCentroCusto");
    const botaoEnviar = document.querySelector("#Enviar");

    if (!elNm || !elSg || !botaoEnviar) return;

    const nmCentroCusto = elNm.value.trim();
    const siglaCentroCusto = elSg.value.trim();
    // Pega o array de IDs selecionados
    

    const formularioValido = nmCentroCusto !== "" && siglaCentroCusto !== "";

    if (formularioValido) {
        botaoEnviar.disabled = false;
        botaoEnviar.style.opacity = "1";
        botaoEnviar.style.cursor = "pointer";
        botaoEnviar.title = "Salvar alterações"; // Limpa o aviso
    } else {
        botaoEnviar.disabled = true;
        botaoEnviar.style.opacity = "0.5";
        botaoEnviar.style.cursor = "not-allowed";
        // Aviso nativo ao passar o mouse
        botaoEnviar.title = "Para habilitar, informe o Nome do Centro de Custo e a Sigla.";
    }
}

async function verificarSiglaExistente(sigla, elementoAtual) {
    if (!sigla) return;

    try {
        // Faz uma busca na API filtrando pela sigla
        const dados = await fetchComToken(`/centrocusto?sigla=${encodeURIComponent(sigla)}`);
        const lista = Array.isArray(dados) ? dados : [dados];

        if (lista.length > 0) {
            const registro = lista[0];
            const idAtual = document.querySelector("#idCentroCusto").value;

            // Se encontrou uma sigla que não é do registro que estamos editando atualmente
            if (String(registro.idcentrocusto) !== String(idAtual)) {
                await Swal.fire({
                    icon: 'warning',
                    title: 'Sigla já utilizada',
                    text: `A sigla "${sigla}" já está cadastrada no Centro de Custo: ${registro.nmcentrocusto}`,
                    confirmButtonText: 'Entendido'
                });
                elementoAtual.value = ""; // Limpa o campo
                validarFormulario();
            }
        }
    } catch (error) {
        console.log("Sigla disponível ou erro na busca:", error);
    }
}

async function perguntarNovoCadastro(termo, elementoAtual) {
    const resultado = await Swal.fire({
        icon: 'question',
        title: `Deseja cadastrar "${termo.toUpperCase()}"?`,
        text: `Este Centro de Custo não foi encontrado no sistema.`,
        showCancelButton: true,
        confirmButtonText: "Sim, cadastrar",
        cancelButtonText: "Cancelar",
        reverseButtons: true,
        focusCancel: true
    });

    if (resultado.isConfirmed) {
        // Usuário quer cadastrar: Mantemos o que ele digitou
        jaPerguntouCadastro = true;
        
        // Se o que ele digitou foi no campo de nome, garantimos que o nome está lá
        // Se foi na sigla, garantimos que a sigla está lá.
        if (elementoAtual) {
            elementoAtual.value = termo.toUpperCase();
        }

        validarFormulario();
        return true;
    } else {
        // Usuário cancelou: Agora sim limpamos para evitar confusão
        document.querySelector("#nmCentroCusto").value = "";
        document.querySelector("#siglaCentroCusto").value = "";
        document.querySelector("#idCentroCusto").value = "";
        jaPerguntouCadastro = false;
        validarFormulario();
        return false;
    }
}

function desinicializarCentroCustoModal() {
    console.log("🧹 Desinicializando módulo CentroCusto.js");

    const botaoEnviar = document.querySelector("#Enviar");
    const botaoPesquisar = document.querySelector("#Pesquisar");
    const botaoLimpar = document.querySelector("#Limpar");
    const inputNmCentroCusto = document.querySelector("#nmCentroCusto");
    const inputSgCentroCusto = document.querySelector("#siglaCentroCusto");
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
    if (inputNmCentroCusto && inputNmCentroCusto.tagName === "SELECT" && selectCentroCustoChangeListener) {
        inputNmCentroCusto.removeEventListener("change", selectCentroCustoChangeListener);
        selectCentroCustoChangeListener = null;
    }
    if (inputNmCentroCusto && inputNmCentroCusto.tagName === "INPUT" && inputNmCentroCustoBlurListener) {
        inputNmCentroCusto.removeEventListener("blur", inputNmCentroCustoBlurListener);
        inputNmCentroCustoBlurListener = null;
    }
    // Agora a variável existe e o erro ReferenceError sumirá
    if (inputSgCentroCusto && inputSgCentroCustoBlurListener) {
        inputSgCentroCusto.removeEventListener("blur", inputSgCentroCustoBlurListener);
        inputSgCentroCustoBlurListener = null;
    }

    if (ativoCheckbox) {
        ativoCheckbox.checked = false; 
    }
    
    jaPerguntouCadastro = false; // Resetar o controle ao fechar
    window.CentroCustoOriginal = { idCentroCusto: "", sgCentroCusto:"", nmCentroCusto: "", ativo: false };
    console.log("✅ Módulo CentroCusto.js desinicializado.");
}

// function criarSelectCentroCusto(contasEncontrados) {
   
//     const select = document.createElement("select");
//     select.id = "nmCentroCusto";
//     select.name = "nmCentroCusto";
//     select.required = true;
//     select.className = "form";

   
//     // Adicionar opções
//     const defaultOption = document.createElement("option");
//     defaultOption.value = "";
//     defaultOption.text = "Selecione um Centro de Custo...";
//     defaultOption.disabled = true;
//     defaultOption.selected = true;
//     select.appendChild(defaultOption);
   
//     console.log("PESQUISANDO Centro de Custo:", contasEncontrados);

//     contasEncontrados.forEach(contasachado => {
//         const option = document.createElement("option");
//         option.value = contasachado.nmcentrocusto;
//         option.text = contasachado.nmcentrocusto;
//         select.appendChild(option);
//     });
 
//     return select;
// }

function criarSelectCentroCusto(contasEncontrados) {
    const select = document.createElement("select");
    select.id = "nmCentroCusto";
    select.name = "nmCentroCusto";
    select.required = true;
    select.className = "form";

    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.text = "Selecione um Centro de Custo...";
    defaultOption.disabled = true;
    defaultOption.selected = true;
    select.appendChild(defaultOption);

    contasEncontrados.forEach(contasachado => {
        const option = document.createElement("option");
        // Use nmcentrocusto (minúsculo) conforme o retorno da API
        option.value = contasachado.nmcentrocusto;
        option.text = contasachado.nmcentrocusto; 
        select.appendChild(option);
    });
 
    return select;
}

document.addEventListener("mousedown", (e) => {
    window.ultimoClique = e.target;
});

function adicionarEventoBlurCentroCusto() {
    const input = document.querySelector("#nmCentroCusto");
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
            await carregarCentroCustoDescricao(desc, this);
        } catch (error) {
            console.error("Erro ao buscar CentroCusto:", error);
        }
    });
}


async function carregarCentroCustoDescricao(desc, elementoAtual) {
    try {
        const dados = await fetchComToken(`/centrocusto?nmCentrocusto=${encodeURIComponent(desc)}`);
        const listaRegistros = Array.isArray(dados) ? dados : [dados];

        console.log("Carregando Dados...", listaRegistros);
        
        if (listaRegistros.length === 0) throw new Error("Não encontrado");

        const centrocustoPrincipal = listaRegistros[0];

        const isAtivo = listaRegistros.some(reg => reg.ativo === true || reg.ativo === 1 || reg.ativo === "S");
       

        document.querySelector("#idCentroCusto").value = centrocustoPrincipal.idcentrocusto;
        document.querySelector("#siglaCentroCusto").value = centrocustoPrincipal.sigla || "";
        document.querySelector("#nmCentroCusto").value = centrocustoPrincipal.nmcentrocusto || "";
        document.querySelector("#ativo").checked = isAtivo;
             
        
        // Atualizamos o objeto original salvando apenas os IDs das empresas que estão REALMENTE ativas
        window.CentroCustoOriginal = {
            idCentroCusto: centrocustoPrincipal.idcentrocusto,              
            nmCentroCusto: centrocustoPrincipal.nmcentrocusto,
            sgCentroCusto: centrocustoPrincipal.sigla || "",
            ativo: isAtivo
            
        };

        jaPerguntouCadastro = false;
        validarFormulario();

    } catch (error) {
        console.warn("Centro de Custo não encontrado.");
        const idVazio = !document.querySelector("#idCentroCusto").value;
        const podeCadastrar = temPermissao("centrocusto", "cadastrar");

        if (idVazio && podeCadastrar && !jaPerguntouCadastro) {
            // PASSANDO OS ARGUMENTOS CORRETOS AQUI
            await perguntarNovoCadastro(desc, elementoAtual);
        }
    }

    // } catch (error) {
    //    console.warn("CentroCusto não encontrado.");
    
    //     const inputIdCentroCusto = document.querySelector("#idCentroCusto");
    //     const podeCadastrarCentroCusto = temPermissao("centrocusto", "cadastrar");

    //     if (!inputIdCentroCusto.value && podeCadastrarCentroCusto) {
    //             const resultado = await Swal.fire({
    //             icon: 'question',
    //             title: `Deseja cadastrar "${desc.toUpperCase()}" como novo CentroCusto?`,
    //             text: `CentroCusto "${desc.toUpperCase()}" não encontrado.`,
    //             showCancelButton: true,
    //             confirmButtonText: "Sim, cadastrar",
    //             cancelButtonText: "Cancelar",
    //             reverseButtons: true,
    //             focusCancel: true
    //         });

            
    //         if (!resultado.isConfirmed) {
    //             console.log("Usuário cancelou o cadastro do CentroCusto.");
    //             elementoAtual.value = ""; // Limpa o campo se não for cadastrar
    //             validarFormulario();
    //             setTimeout(() => {
    //                 elementoAtual.focus();
    //             }, 0);
    //             return;
    //         }
    //     } else if (!podeCadastrarCentroCusto) {
    //         Swal.fire({
    //             icon: "info",
    //             title:"CentroCusto não cadastrado",
    //             text: "Você não tem permissão para cadastrar contas.",
    //             confirmButtonText: "OK"
    //         });
    //     }
    //     validarFormulario();
    
    // }
}

function limparCamposCentroCusto() {
    const idEvent = document.getElementById("idCentroCusto");
    const sgCentroCustoEl = document.getElementById("siglaCentroCusto");
    const nmCentroCustoEl = document.getElementById("nmCentroCusto"); 
    const ativoEl = document.getElementById("ativo");

    if (idEvent) idEvent.value = "";
    if (sgCentroCustoEl) sgCentroCustoEl.value = "";
    if (nmCentroCustoEl) nmCentroCustoEl.value = "";
    if (ativoEl) ativoEl.checked = false;
   

    if (nmCentroCustoEl && nmCentroCustoEl.tagName === "SELECT") {
        const novoInput = document.createElement("input");
        novoInput.type = "text";
        novoInput.id = "nmCentroCusto";
        novoInput.name = "nmCentroCusto";
        novoInput.required = true;
        novoInput.className = "form";

        novoInput.addEventListener("input", function () {
            this.value = this.value.toUpperCase();
        });

        novoInput.addEventListener("blur", async function () {
            if (!this.value.trim()) return;
            await carregarCentroCustoDescricao(this.value, this);
        });

        nmCentroCustoEl.parentNode.replaceChild(novoInput, nmCentroCustoEl);
        adicionarEventoBlurCentroCusto();
        const label = document.querySelector('label[for="nmCentroCusto"]');
        if (label) {
            label.style.display = "block";
            label.textContent = "Nome do Centro de Custo";
        }

        const campoAtivo = document.getElementById("ativo");
        if (campoAtivo && campoAtivo.type === "checkbox") {
            campoAtivo.checked = false;
        }
    }
    validarFormulario();
}


function configurarCadCentroCusto() {
    verificaCentroCusto();
    adicionarEventoBlurCentroCusto();
}
window.configurarCentroCustoCadCentroCusto = configurarCadCentroCusto;

function configurarEventosEspecificos(modulo) {
    if (modulo.trim().toLowerCase() === 'centrocusto') {
        configurarCadCentroCusto();
        if (typeof aplicarPermissoes === "function" && window.permissoes) {
            aplicarPermissoes(window.permissoes);
        }
    }
}
window.configurarEventosEspecificos = configurarEventosEspecificos;


window.moduloHandlers = window.moduloHandlers || {};

// Registra as funções de configuração e desinicialização para este módulo
window.moduloHandlers['CentroCusto'] = { // Use 'CentroCusto' (com C maiúsculo) para corresponder ao seu mapaModulos no Index.js
    configurar: configurarCadCentroCusto,
    desinicializar: desinicializarCentroCustoModal
};


