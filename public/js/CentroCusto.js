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

if (typeof window.CentroCustoOriginal === "undefined") {
    window.CentroCustoOriginal = {
        idCentroCusto: "",
        nmCentroCusto: "",
        ativo: false,
        idempresa: ""
    };
}


async function verificaCentroCusto() {
    console.log("Carregando Centro de Custo...");

    carregarContas();
    carregarEmpresas();

    const botaoEnviar = document.querySelector("#Enviar");
    const botaoPesquisar = document.querySelector("#Pesquisar");
    const botaoLimpar = document.querySelector("#Limpar");
    const form = document.querySelector("#form");  

    const nmCentroCustoInput = document.querySelector("#nmCentroCusto");
    const empresaSelect = document.querySelector("#empresaSelect");

    // Adiciona ouvintes para validar em tempo real
    if (nmCentroCustoInput) {
        nmCentroCustoInput.addEventListener("input", validarFormulario);
    }
    if (empresaSelect) {
        empresaSelect.addEventListener("change", validarFormulario);
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
        limparCamposCentroCusto();
    });

    // botaoEnviar.addEventListener("click", async (e) => {
    //     e.preventDefault();

    //     const idCentroCusto = document.querySelector("#idCentroCusto").value.trim();
    //     const nmCentroCusto = document.querySelector("#nmCentroCusto").value.toUpperCase().trim();
    //     const ativo = document.querySelector("#ativo").checked;
    //     // Dentro do evento de clique do botaoEnviar:
    //     const selectEmpresa = document.querySelector("#empresaSelect");
    //     const idsEmpresas = Array.from(selectEmpresa.selectedOptions).map(option => option.value);

    //     if (idsEmpresas.length === 0) {
    //         return Swal.fire("Campo obrigatório", "Selecione pelo menos uma empresa.", "warning");
    //     }

    //     const temPermissaoCadastrar = temPermissao("CentroCusto", "cadastrar");
    //     const temPermissaoAlterar = temPermissao("CentroCusto", "alterar");

    //     const metodo = idCentroCusto ? "PUT" : "POST";

    //     if (!idCentroCusto && !temPermissaoCadastrar) {
    //         return Swal.fire("Acesso negado", "Você não tem permissão para cadastrar novos CentroCusto.", "error");
    //     }

    //     if (idCentroCusto && !temPermissaoAlterar) {
    //         return Swal.fire("Acesso negado", "Você não tem permissão para alterar CentroCusto.", "error");
    //     }

    //     // Validação de campos obrigatórios
    //     if (!nmCentroCusto || !idsEmpresas.length) {
    //         return Swal.fire("Campos obrigatórios!", "Preencha o nome e selecione a empresa.", "warning");
    //     }

    //     const dados = {nmCentroCusto, ativo, empresas: idsEmpresas };
    //     if (
    //         parseInt(idCentroCusto) === parseInt(CentroCustoOriginal?.idCentroCusto) &&
    //         nmCentroCusto === CentroCustoOriginal?.nmCentroCusto &&
    //         ativo === CentroCustoOriginal?.ativo &&
    //         idsEmpresas.length === CentroCustoOriginal?.empresas?.length && // Corrigido de empresas.length para idsEmpresas.length
    //         idsEmpresas.every(id => CentroCustoOriginal?.empresas?.includes(id))
          
    //     ) {
    //         return Swal.fire("Nenhuma alteração foi detectada!", "Faça alguma alteração antes de salvar.", "info");
    //     }

    //     const url = idCentroCusto ? `/CentroCusto/${idCentroCusto}` : "/CentroCusto";

    //     try {
    //         if (metodo === "PUT") {
    //             const { isConfirmed } = await Swal.fire({
    //                 title: "Deseja salvar as alterações?",
    //                 text: "Você está prestes a atualizar os dados do Centro Custo.",
    //                 icon: "question",
    //                 showCancelButton: true,
    //                 confirmButtonText: "Sim, salvar",
    //                 cancelButtonText: "Cancelar",
    //                 reverseButtons: true,
    //                 focusCancel: true
    //             });
    //             if (!isConfirmed) return;
    //         }

    //         console.log("Enviando dados para o servidor:", dados, url, metodo);
    //         const respostaApi = await fetchComToken(url, {
    //             method: metodo,
    //             headers: { 'Content-Type': 'application/json' },
    //             body: JSON.stringify(dados)
    //         });

    //         await Swal.fire("Sucesso!", respostaApi.message || "CentroCusto salvo com sucesso.", "success");
    //         limparCamposCentroCusto();

    //     } catch (error) {
    //         console.error("Erro ao enviar dados:", error);
    //         Swal.fire("Erro", error.message || "Erro ao salvar banco.", "error");
    //     }
    // });

    botaoEnviar.addEventListener("click", async (e) => {
        e.preventDefault();

        const idCentroCusto = document.querySelector("#idCentroCusto").value.trim();
        const nmCentroCusto = document.querySelector("#nmCentroCusto").value.toUpperCase().trim();
        const ativo = document.querySelector("#ativo").checked;
        
        const selectEmpresa = document.querySelector("#empresaSelect");
        // Convertemos para String para garantir comparação idêntica com o que vem da API
        const idsEmpresas = Array.from(selectEmpresa.selectedOptions).map(option => String(option.value));

        // 1. Validações Iniciais
        if (idsEmpresas.length === 0) {
            return Swal.fire("Campo obrigatório", "Selecione pelo menos uma empresa.", "warning");
        }
        if (!nmCentroCusto) {
            return Swal.fire("Campo obrigatório", "Informe o nome do Centro de Custo.", "warning");
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
        const empresasOriginais = (CentroCustoOriginal?.empresas || []).map(String);
        
        const semAlteracao = 
            idCentroCusto && // Só bloqueia se for uma edição
            parseInt(idCentroCusto) === parseInt(CentroCustoOriginal?.idCentroCusto) &&
            nmCentroCusto === CentroCustoOriginal?.nmCentroCusto &&
            ativo === CentroCustoOriginal?.ativo &&
            idsEmpresas.length === empresasOriginais.length &&
            idsEmpresas.every(id => empresasOriginais.includes(id));

        if (semAlteracao) {
            return Swal.fire("Nenhuma alteração detectada!", "Altere algum dado antes de salvar.", "info");
        }

        // 4. Envio dos Dados
        const dados = { nmCentroCusto, ativo, empresas: idsEmpresas };
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
}

async function carregarContas() {   
    const selectConta = document.getElementById('nomeConta');
    if (!selectConta) return console.error("Elemento nomeConta não encontrado no DOM");
    // Limpa TUDO e garante que o display não esteja 'none'
    selectConta.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Selecione a Conta';
    placeholder.disabled = true;
    placeholder.selected = true;
    selectConta.appendChild(placeholder);
    try {
        const contas = await fetchComToken(`/centrocusto/contas`);
        if (Array.isArray(contas)) {
            contas.forEach(conta => {
                const option = document.createElement('option');
                option.value = conta.idconta;
                option.textContent = conta.nmconta;
                selectConta.appendChild(option);
                console.log("Adicionada conta ao select:", option.value, option.textContent);
            });
            console.log("Select populado com " + contas.length + " contas.");
        }
    } catch (e) {
        console.error("Erro:", e);
    }
}

async function carregarEmpresas() {
    const selectEmpresa = document.getElementById('empresaSelect');
    if (!selectEmpresa) return console.error("Elemento empresaSelect não encontrado no DOM");

    // Limpa TUDO e garante que o display não esteja 'none'
    selectEmpresa.innerHTML = ''; 
    
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Selecione a Empresa Responsável';
    placeholder.disabled = true;
    placeholder.selected = true;
    selectEmpresa.appendChild(placeholder);

    try {
        const empresas = await fetchComToken(`/centrocusto/empresas`);
        
        if (Array.isArray(empresas)) {
            empresas.forEach(emp => {
                const option = document.createElement('option');
                option.value = emp.idempresa;
                // Use nmfantasia ou nmfantasia dependendo do que vem no seu log (vi que vem nmfantasia)
                option.textContent = emp.nmfantasia || emp.razaosocial;
                selectEmpresa.appendChild(option);
                console.log("Adicionada empresa ao select:", option.value, option.textContent);
            });
            console.log("Select populado com " + empresas.length + " empresas.");
        }
    } catch (e) {
        console.error("Erro:", e);
    }
}

function validarFormulario() {
    const elNm = document.querySelector("#nmCentroCusto");
    const elEmp = document.querySelector("#empresaSelect");
    const botaoEnviar = document.querySelector("#Enviar");

    if (!elNm || !elEmp || !botaoEnviar) return;

    const nmCentroCusto = elNm.value.trim();
    // Pega o array de IDs selecionados
    const empresasSelecionadas = Array.from(elEmp.selectedOptions).map(opt => opt.value);

    const formularioValido = nmCentroCusto !== "" && empresasSelecionadas.length > 0;

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
        botaoEnviar.title = "Para habilitar, informe o Nome do Centro de Custo e selecione pelo menos uma Empresa.";
    }
}

function desinicializarCentroCustoModal() {
    console.log("🧹 Desinicializando módulo CentroCusto.js");

   // const inputCodCentroCustoElement = document.querySelector("#codCentroCusto");
    const botaoEnviar = document.querySelector("#Enviar");
    const botaoPesquisar = document.querySelector("#Pesquisar");
    const botaoLimpar = document.querySelector("#Limpar");
    const inputNmCentroCusto = document.querySelector("#nmCentroCusto"); // Pode ser input ou select
    const ativoCheckbox = document.querySelector("#ativo");
   
    const empresaSelect = document.querySelector("#empresaSelect");

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
    // Remover listener do select (se o #nmCentroCusto for um select no momento da desinicialização)
    if (inputNmCentroCusto && inputNmCentroCusto.tagName === "SELECT" && selectCentroCustoChangeListener) {
        inputNmCentroCusto.removeEventListener("change", selectCentroCustoChangeListener);
        selectCentroCustoChangeListener = null;
    }
    // Remover listener do input #nmCentroCusto (se for um input no momento da desinicialização)
    if (inputNmCentroCusto && inputNmCentroCusto.tagName === "INPUT" && inputNmCentroCustoBlurListener) {
        inputNmCentroCusto.removeEventListener("blur", inputNmCentroCustoBlurListener);
        inputNmCentroCustoBlurListener = null;
    }

    if (ativoCheckbox) {
        ativoCheckbox.checked = false;
    }

    // ADICIONADO: Reset do Select de Empresa
    if (empresaSelect) {
        empresaSelect.selectedIndex = 0; // Volta para o "Selecione Empresa"
    }
    
    // Limpar o estado global CentroCustoOriginal
    CentroCustoOriginal = { idCentroCusto: "", nmCentroCusto: "", ativo: "" };
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

// async function preencherCentroCusto(codCentroCusto) {
//     try {
//         const contas = await fetchComToken(`/contas?codCentroCusto=${encodeURIComponent(codCentroCusto)}`);    
        
//         document.querySelector("#idCentroCusto").value = contas.idbanco;
//         document.querySelector("#nmCentroCusto").value = contas.nmbanco;
//         document.querySelector("#ativo").checked = contas.ativo;

//         window.CentroCustoOriginal = {
//             idCentroCusto: contas.idbanco,
//           //  codCentroCusto:contas.codbanco,
//             nmCentroCusto: contas.nmbanco,
//             ativo: contas.ativo
//         };

//         console.log("CentroCusto encontrado:", CentroCustoOriginal);

//     } catch (error) {
//         console.warn("CentroCusto não encontrado.");

//         const inputIdCentroCusto = document.querySelector("#idCentroCusto");
//         const podeCadastrarCentroCusto = temPermissao("contas", "cadastrar");

//         if (!inputIdCentroCusto.value && podeCadastrarCentroCusto) {
//             const resultado = await Swal.fire({
//                 icon: 'question',
//                 title: `Deseja cadastrar "${idCentroCusto.toUpperCase()}" como novo CentroCusto?`,
//                 text: `CentroCusto "${idCentroCusto.toUpperCase()}" não encontrado.`,
//                 showCancelButton: true,
//                 confirmButtonText: "Sim, cadastrar",
//                 cancelButtonText: "Cancelar",
//                 reverseButtons: true,
//                 focusCancel: true
//             });
            
//             if (!resultado.isConfirmed) {
//                 console.log("Usuário cancelou o cadastro do CentroCusto.");
//                 elementoAtual.value = ""; // Limpa o campo se não for cadastrar
//                 setTimeout(() => {
//                     elementoAtual.focus();
//                 }, 0);
//                 return;
//             }
//         } else if (!podeCadastrarCentroCusto) {
//             Swal.fire({
//                 icon: "info",
//                 title:"CentroCusto não cadastrado",
//                 text: "Você não tem permissão para cadastrar contas.",
//                 confirmButtonText: "OK"
//             });
//         }
        
//     }   
// }


// async function carregarCentroCustoDescricao(desc, elementoAtual) {
//     try {
//             const dados = await fetchComToken(`/centrocusto?nmCentrocusto=${encodeURIComponent(desc)}`);
           

//             const centrocusto = Array.isArray(dados) ? dados[0] : dados;
//             console.log("CentroCusto encontrado da API:", centrocusto); // Log mais descritivo

//             document.querySelector("#idCentroCusto").value = centrocusto.idcentrocusto;
//             document.querySelector("#nmCentroCusto").value = centrocusto.nmcentrocusto || "";
            

//             const selectEmpresa = document.querySelector("#empresaSelect");
//             if (centrocusto.idempresa && selectEmpresa) {
//                 selectEmpresa.value = centrocusto.idempresa;
//             }

//             const isAtivo = centrocusto.ativo === true || centrocusto.ativo === 1 || centrocusto.ativo === "S";
//             document.querySelector("#ativo").checked = isAtivo;
            
            
//             window.CentroCustoOriginal = {
//                 idCentroCusto: centrocusto.idcentrocusto,              
//                 nmCentroCusto: centrocusto.nmcentrocusto,
//                 ativo: isAtivo,
//                 idempresa: centrocusto.idempresa
//             };

//             validarFormulario();
    
//             console.log("CentroCusto encontrado:", CentroCustoOriginal);
    
//         } catch (error) {
//             console.warn("CentroCusto não encontrado.");
    
//             const inputIdCentroCusto = document.querySelector("#idCentroCusto");
//             const podeCadastrarCentroCusto = temPermissao("contas", "cadastrar");
    
//            if (!inputIdCentroCusto.value && podeCadastrarCentroCusto) {
//                  const resultado = await Swal.fire({
//                     icon: 'question',
//                     title: `Deseja cadastrar "${desc.toUpperCase()}" como novo CentroCusto?`,
//                     text: `CentroCusto "${desc.toUpperCase()}" não encontrado.`,
//                     showCancelButton: true,
//                     confirmButtonText: "Sim, cadastrar",
//                     cancelButtonText: "Cancelar",
//                     reverseButtons: true,
//                     focusCancel: true
//                 });
    
                
//                 if (!resultado.isConfirmed) {
//                     console.log("Usuário cancelou o cadastro do CentroCusto.");
//                     elementoAtual.value = ""; // Limpa o campo se não for cadastrar
//                     validarFormulario();
//                     setTimeout(() => {
//                         elementoAtual.focus();
//                     }, 0);
//                     return;
//                 }
//             } else if (!podeCadastrarCentroCusto) {
//                 Swal.fire({
//                     icon: "info",
//                     title:"CentroCusto não cadastrado",
//                     text: "Você não tem permissão para cadastrar contas.",
//                     confirmButtonText: "OK"
//                 });
//             }
//             validarFormulario();
//         }
// }

// async function carregarCentroCustoDescricao(desc, elementoAtual) {
//     try {
//         // 1. Busca os registros (pode retornar vários para o mesmo nome em empresas diferentes)
//         const dados = await fetchComToken(`/centrocusto?nmCentrocusto=${encodeURIComponent(desc)}`);
//         const listaRegistros = Array.isArray(dados) ? dados : [dados];
        
//         if (listaRegistros.length === 0) throw new Error("Não encontrado");

//         const centrocustoPrincipal = listaRegistros[0];

//         // Preenche campos básicos
//         document.querySelector("#idCentroCusto").value = centrocustoPrincipal.idcentrocusto;
//         document.querySelector("#nmCentroCusto").value = centrocustoPrincipal.nmcentrocusto || "";

//         // 2. Lógica de Seleção Visual das Empresas
//         const selectEmpresa = document.querySelector("#empresaSelect");
//         if (selectEmpresa) {
//             // Limpamos seleções anteriores
//             Array.from(selectEmpresa.options).forEach(option => option.selected = false);

//             const idsEmpresasVinculadas = listaRegistros.map(reg => String(reg.idempresa));

//             Array.from(selectEmpresa.options).forEach(option => {
//                 if (idsEmpresasVinculadas.includes(String(option.value))) {
//                     option.selected = true; // Marca a opção internamente
//                 }
//             });

//             // ADICIONE ESTA LINHA: Força a atualização visual da UI
//             selectEmpresa.dispatchEvent(new Event('change')); 
//         }

//         // Resto do preenchimento...
//         const isAtivo = centrocustoPrincipal.ativo === true || centrocustoPrincipal.ativo === 1 || centrocustoPrincipal.ativo === "S";
//         document.querySelector("#ativo").checked = isAtivo;
        
//         window.CentroCustoOriginal = {
//             idCentroCusto: centrocustoPrincipal.idcentrocusto,              
//             nmCentroCusto: centrocustoPrincipal.nmcentrocusto,
//             ativo: isAtivo,
//             empresas: listaRegistros.map(reg => String(reg.idempresa))
//         };

//         validarFormulario();

//     } catch (error) {
//         console.warn("CentroCusto não encontrado.");
    
//         const inputIdCentroCusto = document.querySelector("#idCentroCusto");
//         const podeCadastrarCentroCusto = temPermissao("contas", "cadastrar");

//         if (!inputIdCentroCusto.value && podeCadastrarCentroCusto) {
//                 const resultado = await Swal.fire({
//                 icon: 'question',
//                 title: `Deseja cadastrar "${desc.toUpperCase()}" como novo CentroCusto?`,
//                 text: `CentroCusto "${desc.toUpperCase()}" não encontrado.`,
//                 showCancelButton: true,
//                 confirmButtonText: "Sim, cadastrar",
//                 cancelButtonText: "Cancelar",
//                 reverseButtons: true,
//                 focusCancel: true
//             });

            
//             if (!resultado.isConfirmed) {
//                 console.log("Usuário cancelou o cadastro do CentroCusto.");
//                 elementoAtual.value = ""; // Limpa o campo se não for cadastrar
//                 validarFormulario();
//                 setTimeout(() => {
//                     elementoAtual.focus();
//                 }, 0);
//                 return;
//             }
//         } else if (!podeCadastrarCentroCusto) {
//             Swal.fire({
//                 icon: "info",
//                 title:"CentroCusto não cadastrado",
//                 text: "Você não tem permissão para cadastrar contas.",
//                 confirmButtonText: "OK"
//             });
//         }
//         validarFormulario();
//     }
// }

async function carregarCentroCustoDescricao(desc, elementoAtual) {
    try {
        const dados = await fetchComToken(`/centrocusto?nmCentrocusto=${encodeURIComponent(desc)}`);
        const listaRegistros = Array.isArray(dados) ? dados : [dados];

        console.log("Carregando Dados...", listaRegistros);
        
        if (listaRegistros.length === 0) throw new Error("Não encontrado");

        const centrocustoPrincipal = listaRegistros[0];

        const isAtivo = listaRegistros.some(reg => reg.ativo === true || reg.ativo === 1 || reg.ativo === "S");

        document.querySelector("#ativo").checked = isAtivo;

        document.querySelector("#idCentroCusto").value = centrocustoPrincipal.idcentrocusto;
        document.querySelector("#nmCentroCusto").value = centrocustoPrincipal.nmcentrocusto || "";

        // 2. Lógica de Seleção Visual das Empresas (REVISADA)
        const selectEmpresa = document.querySelector("#empresaSelect");
        if (selectEmpresa) {
            Array.from(selectEmpresa.options).forEach(option => option.selected = false);

            Array.from(selectEmpresa.options).forEach(option => {
                // Procuramos o registro correspondente a esta opção no array que veio do banco
                const vinculoBanco = listaRegistros.find(reg => String(reg.idempresa) === String(option.value));
                
                // SÓ marcamos como selecionada se o vínculo existir E o ativoempresa for true
                if (vinculoBanco && vinculoBanco.ativoempresa === true) {
                    option.selected = true;
                }
            });

            selectEmpresa.dispatchEvent(new Event('change')); 
        }

       
        
        // Atualizamos o objeto original salvando apenas os IDs das empresas que estão REALMENTE ativas
        window.CentroCustoOriginal = {
            idCentroCusto: centrocustoPrincipal.idcentrocusto,              
            nmCentroCusto: centrocustoPrincipal.nmcentrocusto,
            ativo: isAtivo,
            empresas: listaRegistros
                .filter(reg => reg.ativoempresa === true) // Filtra apenas as ativas
                .map(reg => String(reg.idempresa))
        };

        validarFormulario();

    } catch (error) {
       console.warn("CentroCusto não encontrado.");
    
        const inputIdCentroCusto = document.querySelector("#idCentroCusto");
        const podeCadastrarCentroCusto = temPermissao("centrocusto", "cadastrar");

        if (!inputIdCentroCusto.value && podeCadastrarCentroCusto) {
                const resultado = await Swal.fire({
                icon: 'question',
                title: `Deseja cadastrar "${desc.toUpperCase()}" como novo CentroCusto?`,
                text: `CentroCusto "${desc.toUpperCase()}" não encontrado.`,
                showCancelButton: true,
                confirmButtonText: "Sim, cadastrar",
                cancelButtonText: "Cancelar",
                reverseButtons: true,
                focusCancel: true
            });

            
            if (!resultado.isConfirmed) {
                console.log("Usuário cancelou o cadastro do CentroCusto.");
                elementoAtual.value = ""; // Limpa o campo se não for cadastrar
                validarFormulario();
                setTimeout(() => {
                    elementoAtual.focus();
                }, 0);
                return;
            }
        } else if (!podeCadastrarCentroCusto) {
            Swal.fire({
                icon: "info",
                title:"CentroCusto não cadastrado",
                text: "Você não tem permissão para cadastrar contas.",
                confirmButtonText: "OK"
            });
        }
        validarFormulario();
    
    }
}

function limparCamposCentroCusto() {
    const idEvent = document.getElementById("idCentroCusto");
    const nmCentroCustoEl = document.getElementById("nmCentroCusto");
    const empresaSelectEl = document.getElementById("empresaSelect");
    const ativoEl = document.getElementById("ativo");

    if (idEvent) idEvent.value = "";
    if (nmCentroCustoEl) nmCentroCustoEl.value = "";
    if (ativoEl) ativoEl.checked = false;

    if (empresaSelectEl) empresaSelectEl.selectedIndex = 0;

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

        descEventEl.parentNode.replaceChild(novoInput, nmCentroCustoEl);
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


