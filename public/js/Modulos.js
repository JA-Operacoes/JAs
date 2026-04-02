import { fetchComToken, aplicarTema } from '../utils/utils.js';

let nmModuloBlurListener = null;
let limparModulosButtonListener = null;
let enviarModulosButtonListener = null;
let pesquisarModulosButtonListener = null;
let selectModulosChangeListener = null;
let novoInputDescModuloBlurListener = null; // Para o blur do novo input de descrição
let novoInputDescModuloInputListener = null;

if (typeof window.ModulosOriginal === "undefined") {
    window.ModulosOriginal = {
        idModulo: "",
        nmModulo: "",
        empresas: []
    };
}

function verificaModulos() {

    console.log("Carregando Módulos...");
    
    const form = document.querySelector("#modulos");
    const botaoEnviar = document.querySelector("#Enviar");
    const botaoPesquisar = document.querySelector("#Pesquisar");    
    const botaoLimpar = document.querySelector("#Limpar");

    carregarEExibirEmpresasSelect();

    if (!botaoEnviar || !form) {
        console.error("Formulário ou botão não encontrado no DOM.");
        return;
    }

    botaoLimpar.addEventListener("click", function (event) {
        event.preventDefault(); // Previne o envio padrão do formulário 

        limparCamposModulos();

    });

        
    botaoEnviar.addEventListener("click", async (event) => {
        event.preventDefault();

        const idModulo = document.querySelector("#idModulo")?.value.trim();
        const nmModuloBruto = document.querySelector("#nmModulo")?.value.toUpperCase().trim();

        const nmModulo = formatarComoCapitalizada(nmModuloBruto);

        //const idModulo = document.querySelector("#idModulo")?.value; 
        //const nmModulo = document.querySelector("#nmModulo")?.value;

        // const empresasSelecionadas = Array.from(document.querySelectorAll('input[name="empresa"]:checked'))
        // .map(checkbox => checkbox.value);

        // if (empresasSelecionadas.length === 0) {
        //     // Isso só deve acontecer se o HTML estiver incorreto ou o script falhar
        //     return Swal.fire("Empresas Obrigatórias", "Pelo menos a empresa principal deve estar selecionada para salvar o módulo.", "error");
        // }

        // Permissões
        const temPermissaoCadastrar = temPermissao("Modulos", "cadastrar");
        const temPermissaoAlterar = temPermissao("Modulos", "alterar");

        const metodo = idModulo ? "PUT" : "POST";

        if (!idModulo && !temPermissaoCadastrar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para cadastrar novos modulos.", "error");
        }

        if (idModulo && !temPermissaoAlterar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para alterar modulos.", "error");
        }

        if (!nmModulo) {
            return Swal.fire("Campos obrigatórios!", "Preencha todos os campos antes de enviar.", "warning");
        }

        //const dados = { idModulo, nmModulo };
        const empresasSelecionadas = coletarEmpresasSelecionadas();

        console.log("Empresas selecionadas para o módulo:", empresasSelecionadas);

        const dados = { 
            idModulo, 
            nmModulo, 
            empresas: empresasSelecionadas // <--- NOVO
        };

        // Verifica alterações
        if (
            idModulo &&
            parseInt(idModulo) === parseInt(window.ModulosOriginal?.idModulo) &&
            nmModulo === window.ModulosOriginal?.nmModulo 
        ) {
            return Swal.fire("Nenhuma alteração foi detectada!", "Faça alguma alteração antes de salvar.", "info");
        }

        //const isUpdate = !isNaN(idModulo); // Verdadeiro apenas se for um número válido


        const url = idModulo
            ? `/modulos/${idModulo}`
            : "/modulos";

        try {
            // Confirma alteração (PUT)
            if (metodo === "PUT") {
                const { isConfirmed } = await Swal.fire({
                    title: "Deseja salvar as alterações?",
                    text: "Você está prestes a atualizar os dados de módulos.",
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

            await Swal.fire("Sucesso!", respostaApi.message || "Modulos salvo com sucesso.", "success");
            limparCamposModulos();

        } catch (error) {
            console.error("Erro ao enviar dados:", error);
            Swal.fire("Erro", error.message || "Erro ao salvar modulos.", "error");
        }
    });

    botaoPesquisar.addEventListener("click", async function (event) {
        event.preventDefault();
        limparCamposModulos();

        console.log("Pesquisando Modulos...");

        // Verifica permissão
        const temPermissaoPesquisar = temPermissao("Modulos", "pesquisar");

        if (!temPermissaoPesquisar) {
            return Swal.fire(
                "Acesso negado",
                "Você não tem permissão para pesquisar modulos.",
                "error"
            );
        }

        try {
            const modulos = await fetchComToken("/modulos");

            if (!modulos || modulos.length === 0) {
                return Swal.fire({
                    icon: 'info',
                    title: 'Nenhum Módulo cadastrado',
                    text: 'Não foi encontrado nenhum módulo no sistema.',
                    confirmButtonText: 'Ok'
                });
            }

            console.log("Modulos encontrados:", modulos);

            const select = criarSelectModulos(modulos);
            limparCamposModulos();

            const input = document.querySelector("#nmModulo");

            if (input && input.parentNode) {
                input.parentNode.replaceChild(select, input);
            }

            const label = document.querySelector('label[for="nmModulo"]');
            if (label) {
                label.style.display = "none";
            }

            // Evento ao escolher um modulo
            select.addEventListener("change", async function () {
                const selectedOption = this.options[this.selectedIndex];
                const desc = selectedOption.value?.trim();
                if (!desc) return;

                const d = selectedOption.dataset;
                const empresas = JSON.parse(d.empresas || '[]');

                document.querySelector("#idModulo").value = d.idmodulo;

                window.ModulosOriginal = {
                    idModulo: d.idmodulo,
                    nmModulo: d.nmmodulo,
                    empresas: empresas
                };

                // ✅ 1. Substitui select por input PRIMEIRO
                const novoInput = document.createElement("input");
                novoInput.type = "text";
                novoInput.id = "nmModulo";
                novoInput.name = "nmModulo";
                novoInput.required = true;
                novoInput.className = "form";
                novoInput.value = d.nmmodulo;

                novoInput.addEventListener("input", function () {
                    this.value = this.value.toUpperCase();
                });

                novoInput.addEventListener("blur", async function () {
                    if (!this.value.trim()) return;
                    const idAtual = document.querySelector("#idModulo")?.value;
                    if (idAtual) return;
                    await carregarModulosDescricao(this.value, this);
                });

                this.parentNode.replaceChild(novoInput, this);
                adicionarEventoBlurModulos();

                const label = document.querySelector('label[for="nmModulo"]');
                if (label) {
                    label.style.display = "block";
                    label.textContent = "Descrição do Modulo";
                }

                // ✅ 2. Aplica checkboxes DEPOIS da substituição
                aplicarSelecaoEmpresas(empresas.map(e => String(e.idempresa || e)));
                console.log("✅ Módulo selecionado:", window.ModulosOriginal);
            });
        } catch (error) {
            console.error("Erro ao carregar Modulos:", error);
            Swal.fire({
                icon: 'error',
                title: 'Erro',
                text: error.message || 'Não foi possível carregar os módulos.',
                confirmButtonText: 'Ok'
            });
        }
    });   
}

// function coletarEmpresasSelecionadas() {
//     const checkboxes = document.querySelectorAll('.checkbox__trigger:checked');
    
//     // Mapeia os elementos DOM para seus respectivos valores (IDs numéricos)
//     const idsEmpresas = Array.from(checkboxes).map(checkbox => checkbox.value);

//     console.log("IDs das empresas selecionadas:", idsEmpresas);
    
//     return idsEmpresas; // Retorna um array de strings ['1', '2', '3']
// }

function formatarComoCapitalizada(texto) {
    if (!texto) return '';
    const textoLimpo = texto.trim().toLowerCase();
    return textoLimpo.charAt(0).toUpperCase() + textoLimpo.slice(1);
}

function coletarEmpresasSelecionadas() {
    const select = document.getElementById('empresas-select-multiplo');
    if (!select) return [];

    // Filtra apenas as opções que estão "selected" e mapeia para o valor (ID)
    const idsEmpresas = Array.from(select.options)
        .filter(option => option.selected)
        .map(option => option.value); // Pega o ID da empresa

    console.log("IDs das empresas selecionadas:", idsEmpresas);
    return idsEmpresas; // Retorna o array de IDs ['1', '2', '3']
}


function aplicarSelecaoEmpresas(idsEmpresasDoModulo) {
    const selectOriginal = document.getElementById('empresas-select-multiplo');
    
    // ✅ Usa um container fixo no DOM, não depende do select
    let checkContainer = document.getElementById('empresas-checkboxes');
    if (!checkContainer) {
        checkContainer = document.createElement('div');
        checkContainer.id = 'empresas-checkboxes';
        checkContainer.style.cssText = 'display:flex; flex-wrap:wrap; gap:10px; padding:10px;';
        // ✅ Insere SEMPRE após o select original que permanece no DOM
        selectOriginal.parentNode.insertBefore(checkContainer, selectOriginal.nextSibling);
    }
    
    selectOriginal.style.display = 'none';
    checkContainer.innerHTML = '';
    
    const idsSet = new Set(idsEmpresasDoModulo.map(String));

    Array.from(selectOriginal.options).forEach(option => {
        if (!option.value) return;

        const isChecked = idsSet.has(String(option.value));
        
        const label = document.createElement('label');
        label.style.cssText = 'display:flex; align-items:center; gap:5px; cursor:pointer; font-weight:bold;';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = option.value;
        checkbox.checked = isChecked;
        checkbox.style.cssText = 'width:18px; height:18px; cursor:pointer;';

        checkbox.addEventListener('change', async function(e) {
            e.preventDefault();
            const nomeEmpresa = option.text;
            const acao = this.checked ? 'incluir' : 'excluir';

            const { isConfirmed } = await Swal.fire({
                icon: 'question',
                title: `${acao === 'incluir' ? 'Incluir' : 'Excluir'} empresa?`,
                text: `Deseja ${acao} a empresa "${nomeEmpresa}" ${acao === 'incluir' ? 'neste' : 'deste'} módulo?`,
                showCancelButton: true,
                confirmButtonText: `Sim, ${acao}`,
                cancelButtonText: 'Cancelar',
                confirmButtonColor: acao === 'incluir' ? '#16a34a' : '#dc2626',
            });

            if (!isConfirmed) {
                this.checked = !this.checked;
                return;
            }

            // ✅ Sincroniza o select original
            const optionSelect = Array.from(selectOriginal.options)
                .find(o => String(o.value) === String(this.value));
            if (optionSelect) optionSelect.selected = this.checked;
        });

        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(option.text));
        checkContainer.appendChild(label);
    });
}

let todasAsEmpresas = []; 

async function carregarEExibirEmpresas() {
    const container = document.getElementById('container-empresas'); // Crie este <div> no seu HTML
    if (!container) return console.error("Container de empresas não encontrado.");
    
    try {
        // 1. Busque a lista de empresas (API - Ajuste a URL se necessário)
        const empresasApi = await fetchComToken("/empresas"); 
        
        todasAsEmpresas = Array.isArray(empresasApi) ? empresasApi : [];
        container.innerHTML = ''; // Limpa o container antes de popular

        // 2. Gere o HTML de cada checkbox dinamicamente
        todasAsEmpresas.forEach(empresa => {
            const htmlEmpresa = `
                <div class="Vertical">
                    <div class="checkbox-wrapper-33">
                        <label class="checkbox">
                            <input 
                                class="checkbox__trigger visuallyhidden empresa-checkbox" 
                                type="checkbox" 
                                id="empresa-${empresa.idempresa}" 
                                name="empresasSelecionadas" 
                                value="${empresa.idempresa}"
                            />
                            <span class="checkbox__symbol">
                                <svg aria-hidden="true" class="icon-checkbox" width="28px" height="28px" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M4 14l8 7L24 7"></path>
                                </svg>
                            </span>
                            <p class="checkbox__textwrapper"></p>
                        </label>
                    </div>
                    <label for="empresa-${empresa.idempresa}">${empresa.nmfantasia || empresa.nome}</label> 
                </div>
            `;
            container.innerHTML += htmlEmpresa;
        });
        
    } catch (error) {
        console.error("Erro ao carregar lista de empresas:", error);
    }
}

async function carregarEExibirEmpresasSelect() {
    const select = document.getElementById('empresas-select-multiplo');
    if (!select) return; // Garante que o elemento existe

    try {
        // Altere a URL/Endpoint conforme a sua API
        const empresasApi = await fetchComToken("/empresas"); 
        const empresas = Array.isArray(empresasApi) ? empresasApi : [];

        // Limpa opções antigas
        select.innerHTML = ''; 

        // Cria a opção padrão (opcional)
        const defaultOption = document.createElement("option");
        defaultOption.text = "Selecione as Empresas (Ctrl/Cmd + Clique)";
        defaultOption.value = "";
        defaultOption.disabled = true;
        select.appendChild(defaultOption);

        // Popula o select com os dados da API
        empresas.forEach(empresa => {
            const option = document.createElement('option');
            // IMPORTANTE: o value deve ser o ID da empresa para enviar ao backend
            option.value = empresa.idempresa; 
            option.text = empresa.nmfantasia || empresa.nome; // Exibe o nome fantasia ou nome
            select.appendChild(option);
        });

        aplicarSelecaoEmpresas([]);


    } catch (error) {
        console.error("Erro ao carregar lista de empresas:", error);
        // Exiba um alerta ao usuário, se apropriado
        Swal.fire("Erro ao Carregar", "Não foi possível carregar a lista de empresas.", "error");
    }
}

function adicionarListenersAoInputDescModulo(inputElement) {
    // Remove listeners anteriores para evitar duplicidade
    if (novoInputDescModuloInputListener) {
        inputElement.removeEventListener("input", novoInputDescModuloInputListener);
    }
    if (novoInputDescModuloBlurListener) {
        inputElement.removeEventListener("blur", novoInputDescModuloBlurListener);
    }

    novoInputDescModuloInputListener = function() {
        this.value = this.value.toUpperCase();
    };
    inputElement.addEventListener("input", novoInputDescModuloInputListener);

    novoInputDescModuloBlurListener = async function() {
        if (!this.value.trim()) return;
        await carregarModulosDescricao(this.value, this);
    };
    inputElement.addEventListener("blur", novoInputDescModuloBlurListener);
}


function resetarCampoDescModuloParaInput() {
    const nmModuloCampo = document.getElementById("nmModulo");
    // Verifica se o campo atual é um select e o substitui por um input
    if (nmModuloCampo && nmModuloCampo.tagName.toLowerCase() === "select") {
        const input = document.createElement("input");
        input.type = "text";
        input.id = "nmModulo";
        input.name = "nmModulo";
        input.value = ""; // Limpa o valor
        input.placeholder = "Descrição do Modulos";
        input.className = "form";
        input.classList.add('uppercase');
        input.required = true;

        // Remove o listener do select antes de substituí-lo
        if (selectModulosChangeListener) {
            nmModuloCampo.removeEventListener("change", selectModulosChangeListener);
            selectModulosChangeListener = null;
        }

        nmModuloCampo.parentNode.replaceChild(input, nmModuloCampo);
        adicionarListenersAoInputDescModulo(input); // Adiciona os listeners ao novo input

        const label = document.querySelector('label[for="nmModulo"]');
        if (label) {
            label.style.display = "block";
            label.textContent = "Descrição do Modulos";
        }
    }
}


// =============================================================================
// Função de Desinicialização do Módulo Modulos
// =============================================================================
function desinicializarModulosModal() {
    console.log("🧹 Desinicializando módulo Modulos.js...");

    const nmModuloElement = document.querySelector("#nmModulo");
    const botaoEnviar = document.querySelector("#Enviar");
    const botaoPesquisar = document.querySelector("#Pesquisar");
    const botaoLimpar = document.querySelector("#Limpar");

    // 1. Remover listeners de eventos dos elementos fixos
    if (botaoLimpar && limparModulosButtonListener) {
        botaoLimpar.removeEventListener("click", limparModulosButtonListener);
        limparModulosButtonListener = null;
        console.log("Listener de click do Limpar (Modulos) removido.");
    }
    if (botaoEnviar && enviarModulosButtonListener) {
        botaoEnviar.removeEventListener("click", enviarModulosButtonListener);
        enviarModulosButtonListener = null;
        console.log("Listener de click do Enviar (Modulos) removido.");
    }
    if (botaoPesquisar && pesquisarModulosButtonListener) {
        botaoPesquisar.removeEventListener("click", pesquisarModulosButtonListener);
        pesquisarModulosButtonListener = null;
        console.log("Listener de click do Pesquisar (Modulos) removido.");
    }

    // 2. Remover listeners do campo nmModulo (que pode ser input ou select)
    if (nmModuloElement) {
        if (nmModuloElement.tagName.toLowerCase() === "input") {
            if (nmModuloBlurListener) {
                nmModuloElement.removeEventListener("blur", nmModuloBlurListener);
                nmModuloBlurListener = null;
                console.log("Listener de blur do nmModulo (input original) removido.");
            }
            if (novoInputDescModuloInputListener) {
                nmModuloElement.removeEventListener("input", novoInputDescModuloInputListener);
                novoInputDescModuloInputListener = null;
                console.log("Listener de input do nmModulo (input dinâmico) removido.");
            }
            if (novoInputDescModuloBlurListener) {
                nmModuloElement.removeEventListener("blur", novoInputDescModuloBlurListener);
                novoInputDescModuloBlurListener = null;
                console.log("Listener de blur do nmModulo (input dinâmico) removido.");
            }

        } else if (nmModuloElement.tagName.toLowerCase() === "select" && selectModulosChangeListener) {
            nmModuloElement.removeEventListener("change", selectModulosChangeListener);
            selectModulosChangeListener = null;
            console.log("Listener de change do select nmModulo removido.");
        }
    }

    // 3. Limpar o estado global e campos do formulário
    window.ModulosOriginal = null; // Zera o objeto de modulo original
    limparCamposModulos(); // Limpa todos os campos visíveis do formulário
   // document.querySelector("#form").reset(); // Garante que o formulário seja completamente resetado
    document.querySelector("#idModulo").value = ""; // Limpa o ID oculto
    resetarCampoDescModuloParaInput(); // Garante que o campo nmModulo volte a ser um input padrão

    console.log("✅ Módulo Modulos.js desinicializado.");
}

function criarSelectModulos(modulos) {
    // ✅ Adiciona log para ver o que vem da API
    console.log("🔍 Primeiro módulo:", modulos[0]);
    console.log("🔍 Chaves disponíveis:", Object.keys(modulos[0]));
    
    const select = document.createElement("select");
    select.id = "nmModulo";
    select.name = "nmModulo";
    select.required = true;
    select.className = "form";

    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.text = "Selecione um Modulo...";
    defaultOption.disabled = true;
    defaultOption.selected = true;
    select.appendChild(defaultOption);

    modulos.forEach(modulosachado => {
        const option = document.createElement("option");
        option.value = modulosachado.nmModulo; // ✅ era 'modulo', é 'nmModulo'
        option.text = modulosachado.nmModulo;  // ✅
        option.dataset.idmodulo = modulosachado.idmodulo;
        option.dataset.nmmodulo = modulosachado.nmModulo; // ✅
        option.dataset.empresas = JSON.stringify(modulosachado.empresas || []);
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

function adicionarEventoBlurModulos() {
    const input = document.querySelector("#nmModulo");
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
        if (!desc){          
            return; 
        }

        const idAtual = document.querySelector("#idModulo")?.value;
        if (idAtual) return;

        try {
            await carregarModulosDescricao(desc, this);

        } catch (error) {
            console.error("Erro ao buscar Modulos:", error);
        }
    });
}

async function carregarModulosDescricao(desc, elementoAtual) {
    try {
        const modulos = await fetchComToken(`/modulos?nmModulo=${encodeURIComponent(desc)}`);

        console.log("🔍 Retorno da API:", modulos);

              
        if (!modulos || !modulos.idmodulo) throw new Error("Modulos não encontrada");        

        document.querySelector("#idModulo").value = modulos.idmodulo;
        document.querySelector("#nmModulo").value = modulos.nmModulo;
     
        window.ModulosOriginal = {
            idModulo: modulos.idmodulo,
            nmModulo: modulos.nmModulo,
            empresas: modulos.empresas || []
        };

        return;

    } catch (error) {
       
        const inputIdModulo = document.querySelector("#idModulo");
        const podeCadastrarModulos = temPermissao("Modulos", "cadastrar");

        if (inputIdModulo.value) {
            console.error("Erro ao buscar módulo existente. Não limpar campo.");
            return; // Sai sem alterar o campo de descrição.
        }

        if  (!podeCadastrarModulos) {
            Swal.fire({
                icon: "info",
                title: "Módulo não cadastrado",
                text: "Você não tem permissão para cadastrar módulo.",
                confirmButtonText: "OK"
            });
            elementoAtual.value = "";
            return;
        } 

        const resultado = await Swal.fire({
            icon: 'question',
            title: `Deseja cadastrar "${desc.toUpperCase()}" como novo Módulo?`,
            text: `Módulo "${desc.toUpperCase()}" não encontrado`,
            showCancelButton: true,
            confirmButtonText: "Sim, cadastrar",
            cancelButtonText: "Cancelar",
            reverseButtons: true,
            focusCancel: true
        });

        console.log("Resultado do Swal:", resultado);
        console.log("isConfirmed é:", resultado.isConfirmed); // Adicione este log

        if (!resultado.isConfirmed) {
            console.log("Usuário cancelou o cadastro do Módulo.");
            elementoAtual.value = ""; // Limpa o campo se não for cadastrar
            setTimeout(() => {
                elementoAtual.focus();
            }, 0);              
        }
        if (resultado.isConfirmed) {
            // AÇÃO: Usuário CONFIRMOU o cadastro. MANTÉM O CAMPO PREENCHIDO
            
            document.querySelector("#idModulo").value = ""; 
            // IMPORTANTE: Se tiver a função limparModulosOriginal(), chame aqui.
            limparModulosOriginal(); 
            
            //Swal.fire('Atenção!', `"${desc.toUpperCase()}" pronto para cadastro. Clique em "Enviar" para salvar.`, 'info');
            
            return; // <-- SAI DA FUNÇÃO, MANTENDO O VALOR
        }        
        
    }
}


function limparModulosOriginal() {
    window.ModulosOriginal = {
        idModulo: "",
        nmModulo: "",
        empresas: []
    };
}

function limparCamposModulos() {
    const campos = ["idModulo", "nmModulo"];
    campos.forEach(id => {
        const campo = document.getElementById(id);
        if (campo) campo.value = "";
    });

    // ✅ Limpa checkboxes mas mantém select escondido
    const checkContainer = document.getElementById('empresas-checkboxes');
    if (checkContainer) checkContainer.innerHTML = '';

    const selectEmpresas = document.getElementById('empresas-select-multiplo');
    if (selectEmpresas) {
        selectEmpresas.style.display = 'none'; // ✅ sempre escondido
        Array.from(selectEmpresas.options).forEach(o => o.selected = false);
    }

    // ✅ Recria checkboxes vazios
    aplicarSelecaoEmpresas([]);

    // ✅ Reseta SELECT para INPUT se necessário
    const nmModuloEl = document.getElementById("nmModulo");
    if (nmModuloEl && nmModuloEl.tagName === "SELECT") {
        const novoInput = document.createElement("input");
        novoInput.type = "text";
        novoInput.id = "nmModulo";
        novoInput.name = "nmModulo";
        novoInput.required = true;
        novoInput.className = "form";
        novoInput.value = "";
        nmModuloEl.parentNode.replaceChild(novoInput, nmModuloEl);
        adicionarEventoBlurModulos();

        const label = document.querySelector('label[for="nmModulo"]');
        if (label) {
            label.style.display = "block";
            label.textContent = "Descrição do Modulo";
        }
    }

    limparModulosOriginal();
}

function configurarEventosModulos() {
    console.log("Configurando eventos Modulos...");
    verificaModulos(); // Carrega os Modulos ao abrir o modal
    adicionarEventoBlurModulos();
    console.log("Entrou configurar Modulos no Modulos.js.");
    

} 
window.configurarEventosModulos = configurarEventosModulos;

function configurarEventosEspecificos(modulo) {
  console.log("⚙️ configurarEventosEspecificos recebeu:", modulo);
  if (modulo.trim().toLowerCase() === 'modulos') {
    configurarEventosModulos();
    
    if (typeof aplicarPermissoes === "function" && window.permissoes) {
      aplicarPermissoes(window.permissoes);
    } else {
      console.warn("⚠️ aplicarPermissoes ou window.permissoes ainda não estão disponíveis para Modulos.");
    }
  }
}
window.configurarEventosEspecificos = configurarEventosEspecificos;

window.moduloHandlers = window.moduloHandlers || {};

window.moduloHandlers['Modulos'] = { // A chave 'Modulos' (com E maiúsculo) deve corresponder ao seu Index.js
    configurar: configurarEventosModulos,
    desinicializar: desinicializarModulosModal
};
