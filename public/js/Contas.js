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
        codConta: "",
        nmConta: "",
        ativo: false,
        idTipoConta: "",
        idEmpresaPagadora: "" // Alterado de tpConta para idtipoconta
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
    carregarSelectPlanoContas();
    carregarSelectCentroCusto();
    configurarEventosVinculo();

    // Dentro da função verificaConta ou configurarCadConta
    const selectPlano = document.querySelector("#planoContas");
    const inputCodigo = document.querySelector("#codConta"); // Ou o campo onde fica o código da conta

    if (selectPlano) {
        selectPlano.addEventListener("change", async function() {
            const idPlano = this.value;
            if (!idPlano) return;

            // Pegar o texto da opção selecionada para extrair o prefixo (ex: "01.00.00")
            const textoSelecionado = this.options[this.selectedIndex].text;
            const prefixo = textoSelecionado.split(' - ')[0]; 
            
            // Remove os zeros finais se quiser que a conta seja filha direta
            // Ex: 01.00.00 vira prefixo 01.00
            const prefixoLimpo = prefixo.split('.').slice(0, 2).join('.');

            try {
                const dados = await fetchComToken(`/contas/proximo-codigo/${prefixoLimpo}`);
                if (dados.proximoCodigo) {
                    inputCodigo.value = dados.proximoCodigo;
                    // Dispara o evento input para o label subir se necessário
                    inputCodigo.dispatchEvent(new Event('input'));
                }

            } catch (error) {
                console.error("Erro ao buscar próximo código:", error);
            }
        });
    }
    

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

        const idConta = document.querySelector("#idConta")?.value || "";
        const codConta = document.querySelector("#codConta").value.trim();
        const nmConta = document.querySelector("#nmConta").value.toUpperCase().trim();
        const ativo = document.querySelector("#ativo").checked;
        const idTipoConta = document.querySelector("#tpConta").value; // O valor do select agora é o ID
        const idEmpresaPagadora = document.querySelector("#empresaPagadora").value; // Novo campo
        const idPlanoContas = document.querySelector("#planoContas") ? document.querySelector("#planoContas").value : null; // Novo campo opcional
        const idCentroCusto = document.querySelector("#centroCusto")?.value;

        // CAPTURA DO VÍNCULO (NOVO)
        const checkMarcado = document.querySelector('.tipo-vinculo:checked');
        const tipoVinculo = checkMarcado ? checkMarcado.value : null; // 'cliente', 'fornecedor' ou 'funcionario'
        const idVinculo = document.querySelector('#idVinculo')?.value || null;

        const temPermissaoCadastrar = temPermissao("Contas", "cadastrar");
        const temPermissaoAlterar = temPermissao("Contas", "alterar");

        const metodo = idConta ? "PUT" : "POST";

        if (!idConta && !temPermissaoCadastrar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para cadastrar novos Contas.", "error");
        }

        if (idConta && !temPermissaoAlterar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para alterar Contas.", "error");
        }

        if (!nmConta || !codConta || !idTipoConta || !idEmpresaPagadora ) {
            return Swal.fire("Campos obrigatórios!", "Preencha todos os campos antes de enviar.", "warning");
        }

        const dados = { nmConta, codConta, ativo, idTipoConta, idEmpresaPagadora, idPlanoContas, 
            idCentroCusto, tipoVinculo, idVinculo  }; // Objeto com novo nome de campo
        
        // Dirty Checking ajustado para String para comparar com o valor do Select
        const semAlteracao = 
            String(idConta) === String(window.ContaOriginal?.idconta) &&
            nmConta === window.ContaOriginal?.nmconta &&
            codConta === window.ContaOriginal?.codconta &&
            ativo === window.ContaOriginal?.ativo &&
            String(idTipoConta) === String(window.ContaOriginal?.idtipoconta) &&
            String(idEmpresaPagadora) === String(window.ContaOriginal?.idempresapagadora) &&
            String(idPlanoContas) === String(window.ContaOriginal?.idplanocontas) &&
            String(idCentroCusto) === String(window.ContaOriginal?.idcentrocusto);

        if (idConta && semAlteracao) {
            return Swal.fire("Nenhuma alteração foi detectada!", "Faça alguma alteração antes de salvar.", "info");
        }

        console.log("Enviando dados da Conta:", dados);

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

    window.ContaOriginal = { idConta: "", nmConta: "", codConta: "", ativo: false, idTipoConta: "" };
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
        const tipos = await fetchComToken('/contas/tipoconta');
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
        const empresas = await fetchComToken('/contas/empresas');
        selectEmpresaPagadora.innerHTML = '<option value="" disabled selected>Selecione a Empresa Pagadora</option>';
        if (empresas && Array.isArray(empresas)) {
            empresas.forEach(empresa => {
               // if (empresa.ativo) {
                    const option = document.createElement("option");
                    option.value = empresa.idempresa;
                    option.textContent = empresa.nmfantasia;
                    selectEmpresaPagadora.appendChild(option);
                //}
            });
        }
    } catch (error) {
        console.error("Erro ao carregar empresas:", error);
    }
}

async function carregarSelectCentroCusto() {
    const selectCentroCusto = document.querySelector("#centroCusto");
    if (!selectCentroCusto) return;

    try {
        const centrocusto = await fetchComToken('/contas/centrocusto');
        selectCentroCusto.innerHTML = '<option value="" disabled selected>Selecione o Centro de Custo</option>';
        if (centrocusto && Array.isArray(centrocusto)) {
            centrocusto.forEach(ccusto => {
               // if (empresa.ativo) {
                    const option = document.createElement("option");
                    option.value = ccusto.idcentrocusto;
                    option.textContent = ccusto.nmcentrocusto;
                    selectCentroCusto.appendChild(option);
                //}
            });
        }
    } catch (error) {
        console.error("Erro ao carregar centro de custo:", error);
    }
}

async function carregarSelectPlanoContas() {
    const selectPlanoContas = document.querySelector("#planoContas"); // ID do select no HTML
    if (!selectPlanoContas) return;

    try {
        // Busca os planos de contas cadastrados
        const planos = await fetchComToken('/contas/planocontas');
        
        // Limpa o select e adiciona a opção padrão (vazia para o label subir corretamente)
        selectPlanoContas.innerHTML = '<option value="" disabled selected>Selecione o Plano de Contas</option>';
        
        if (planos && Array.isArray(planos)) {
            planos.forEach(plano => {
                // Verifica se está ativo (considerando que seu banco retorna boolean ou 'T'/'S')
                const isAtivo = plano.ativo === true || plano.ativo === 'T' || plano.ativo === 'S' || plano.ativo === 1;
                
                if (isAtivo) {
                    const option = document.createElement("option");
                    option.value = plano.idplanocontas; // Valor que vai para o banco
                    option.textContent = `${plano.codigo} - ${plano.nmplanocontas}`; // O que o usuário vê
                    selectPlanoContas.appendChild(option);
                }
            });

            // Dentro da função carregarSelectPlanoContas()
            // Remova qualquer listener antigo antes de adicionar o novo para evitar duplicidade
            selectPlanoContas.replaceWith(selectPlanoContas.cloneNode(true));
            const novoSelect = document.querySelector("#planoContas");

            novoSelect.addEventListener("change", async function() {
                const idPlano = this.value; // Pega o ID (Ex: 2)

                // VALIDAÇÃO: Se o idPlano não for um número (ex: vier "02.00"), pare aqui.
                if (!idPlano || isNaN(idPlano)) {
                    console.warn("⚠️ O valor selecionado não é um ID válido:", idPlano);
                    return;
                }

                try {
                    const dados = await fetchComToken(`/contas/proximo-codigo/${idPlano}`);
                    
                    if (dados && dados.proximoCodigo) {
                        const inputCod = document.querySelector("#codConta");
                        inputCod.value = dados.proximoCodigo;
                        
                        inputCod.dispatchEvent(new Event('input'));
                        if (typeof validarFormulario === "function") validarFormulario();
                    }
                } catch (e) {
                    console.error("Erro capturado no Front:", e.message);
                }
            });
        }
    } catch (error) {
        console.error("Erro ao carregar planos de contas para o select:", error);
    }
}

// Adicione dentro da sua função de inicialização ou verificaContas
function configurarEventosVinculo() {
    const checks = document.querySelectorAll('.tipo-vinculo');
    const containerVinculo = document.querySelector('#containerVinculo');
    const selectVinculo = document.querySelector('#idVinculo');
    const labelVinculo = document.querySelector('#labelVinculo');

    checks.forEach(check => {
        check.addEventListener('change', async function() {
            if (this.checked) {
                // Desmarca os outros (comportamento de Radio Button)
                checks.forEach(c => { if (c !== this) c.checked = false; });

                // Exibe o container e muda o label
                containerVinculo.style.display = 'block';
                const tipo = this.value; // cliente, fornecedor ou funcionario
                labelVinculo.textContent = `Selecionar ${this.previousElementSibling.textContent}`;

                // Busca os dados no banco
                await carregarDadosVinculo(tipo);
            } else {
                // Se desmarcar, esconde o select
                containerVinculo.style.display = 'none';
                selectVinculo.innerHTML = '<option value="" disabled selected></option>';
            }
        });
    });
}

async function carregarDadosVinculo(tipo) {
    const selectVinculo = document.querySelector('#idVinculo');
    selectVinculo.innerHTML = '<option value="" disabled selected>Carregando...</option>';

    // Dicionário para resolver os plurais corretamente
    const rotasPlurais = {
        'cliente': 'clientes',
        'fornecedor': 'fornecedores',
        'funcionario': 'funcionarios'
    };

    try {
        // Agora a URL será sempre perfeita: /contas/vinculo/clientes, etc.
        const url = `/contas/vinculo/${rotasPlurais[tipo]}`;
        
        const dados = await fetchComToken(url); 

        console.log("RESPOSTA DADOS:", tipo, dados);
        
        selectVinculo.innerHTML = '<option value="" disabled selected>Selecione...</option>';
        
        if (!dados || dados.length === 0) {
            selectVinculo.innerHTML = '<option value="" disabled selected>Nenhum registro encontrado</option>';
            return;
        }

        dados.forEach(item => {
            const option = document.createElement('option');
            // Mapeamento dinâmico dos campos de ID e Nome
            //const id = item[`id${tipo}`];
            //const nome = item[`nm${tipo}`];
            
            option.value = item.id;
            option.textContent = item.nome;
            selectVinculo.appendChild(option);
        });

    } catch (error) {
        console.error(`Erro ao carregar ${tipo}:`, error);
        selectVinculo.innerHTML = '<option value="" disabled selected>Erro ao carregar dados</option>';
    }
}

async function carregarContaDescricao(desc, elementoAtual) {
    try {
        const dadosRecebidos = await fetchComToken(`/contas?nmConta=${encodeURIComponent(desc)}`);
        
        if (!dadosRecebidos || (Array.isArray(dadosRecebidos) && dadosRecebidos.length === 0)) {
            throw new Error("Conta não encontrada");
        }

        const conta = Array.isArray(dadosRecebidos) ? dadosRecebidos[0] : dadosRecebidos;

        console.log("DADOS RECEBIDOS:", conta);

        document.querySelector("#idConta").value = conta.idconta || "";
        document.querySelector("#codConta").value = conta.codconta || "";
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

        const selectPlanoContas = document.querySelector("#planoContas");
        if (selectPlanoContas) {
            const valorBanco = String(conta.idplanocontas || conta.planoContas); 
            selectPlanoContas.value = valorBanco;
            if (selectPlanoContas.selectedIndex <= 0 && valorBanco !== "undefined" && valorBanco !== "null") {
                console.warn("Aviso: Plano de Contas legado ou não encontrado:", valorBanco);
            }   
        }
        
        if (conta.tipovinculo) {
            const check = document.querySelector(`.tipo-vinculo[value="${conta.tipovinculo}"]`);
            if (check) {
                check.checked = true;
                await carregarDadosVinculo(conta.tipovinculo); // Carrega o select
                document.querySelector("#idVinculo").value = conta.idvinculo; // Seleciona o ID salvo
            }
        }

        const selectCentroCusto = document.querySelector("#centroCusto");
        if (selectCentroCusto) {
            const valorBanco = String(conta.idcentrocusto || conta.centrocusto); 
            selectCentroCusto.value = valorBanco;
            if (selectCentroCusto.selectedIndex <= 0 && valorBanco !== "undefined" && valorBanco !== "null") {
                console.warn("Aviso: Centro de Custo não encontrado:", valorBanco);
            }   
        }

        const isAtivo = conta.ativo === true || conta.ativo === 1 || conta.ativo === "S" || conta.ativo === "T";
        document.querySelector("#ativo").checked = isAtivo;

        window.ContaOriginal = {
            idconta: conta.idconta,  // Use minúsculo para bater com o objeto 'conta'
            codconta: conta.codconta,   
            nmconta: conta.nmconta,
            ativo: isAtivo,
            idtipoconta: String(conta.idtipoconta || conta.tpconta),
            idempresapagadora: String(conta.idempresapagadora || conta.empresapagadora),
            idplanocontas: String(conta.idplanocontas || conta.planoContas),
            idcentrocusto: String(conta.idcentrocusto || conta.centrocusto)
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
                title: `Deseja cadastrar a conta "${desc.toUpperCase()}"?`,
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

// function limparCamposConta() {
//     const idEvent = document.getElementById("idConta");
//     const codContaEl = document.getElementById("codConta");
//     const nmContaEl = document.getElementById("nmConta");
//     const tpContaEl = document.getElementById("tpConta");
//     const ativoEl = document.getElementById("ativo");
//     const empresaPagadoraEl = document.getElementById("empresaPagadora");
//     const planoContasEl = document.getElementById("planoContas");

//     if (empresaPagadoraEl) empresaPagadoraEl.value = "";

//     if (idEvent) idEvent.value = "";
//     if (codContaEl) codContaEl.value = "";
//     if (nmContaEl) nmContaEl.value = "";
//     if (tpContaEl) tpContaEl.value = "";
//     if (planoContasEl) planoContasEl.value = "";
//     if (ativoEl) ativoEl.checked = false;

//     if (nmContaEl && nmContaEl.tagName === "SELECT") {
//         const novoInput = document.createElement("input");
//         novoInput.type = "text";
//         novoInput.id = "nmConta";
//         novoInput.name = "nmConta";
//         novoInput.required = true;
//         novoInput.className = "form";

//         novoInput.addEventListener("input", function () {
//             this.value = this.value.toUpperCase();
//         });

//         nmContaEl.parentNode.replaceChild(novoInput, nmContaEl);
//         adicionarEventoBlurConta();

//         const label = document.querySelector('label[for="nmConta"]');
//         if (label) {
//             label.style.display = "block";
//             label.textContent = "Nome do Conta";
//         }
//     }

    
//     validarFormulario();
// }



function limparCamposConta() {
    console.log("🧹 Limpando campos do formulário...");

    // 1. Limpeza dos campos de texto e IDs ocultos
    const camposParaLimpar = ["#idConta", "#codConta", "#nmConta", "#tpConta", "#empresaPagadora", "#planoContas", "#centroCusto"];
    camposParaLimpar.forEach(selector => {
        const el = document.querySelector(selector);
        if (el) el.value = "";
    });

    // 2. Resetar Checkbox
    const ativoEl = document.querySelector("#ativo");
    if (ativoEl) ativoEl.checked = false;

    // 3. Restaurar NMCONTA (Se for um SELECT de pesquisa, volta a ser INPUT)
    const nmContaEl = document.querySelector("#nmConta");
    if (nmContaEl && nmContaEl.tagName === "SELECT") {
        const novoInput = document.createElement("input");
        novoInput.type = "text";
        novoInput.id = "nmConta";
        novoInput.name = "nmConta";
        novoInput.required = true;
        novoInput.className = "form";

        novoInput.addEventListener("input", function () {
            this.value = this.value.toUpperCase();
            validarFormulario();
        });

        nmContaEl.parentNode.replaceChild(novoInput, nmContaEl);
        adicionarEventoBlurConta();

        const label = document.querySelector('label[for="nmConta"]');
        if (label) {
            label.style.display = "block";
            label.textContent = "Nome do Conta";
        }
    }

    // 4. Resetar campos de vínculo (específico da sua nova lógica)
    const checks = document.querySelectorAll('.tipo-vinculo');
    checks.forEach(c => c.checked = false);
    
    const containerVinculo = document.querySelector('#containerVinculo');
  //  if (containerVinculo) containerVinculo.style.display = 'none';

    const idVinculo = document.querySelector('#idVinculo');
    if (idVinculo) idVinculo.innerHTML = '<option value="" disabled selected></option>';

    // 5. Atualizar o estado do botão Enviar
    validarFormulario();
}

function validarFormulario() {
    const elNm = document.querySelector("#nmConta");
    const elTp = document.querySelector("#tpConta");
    const elEmpPagadora = document.querySelector("#empresaPagadora");
    const elPlanoContas = document.querySelector("#planoContas"); 
    const elCod = document.querySelector("#codConta"); 
    const botaoEnviar = document.querySelector("#Enviar");

    if (!elNm || !elTp || !elEmpPagadora || !elPlanoContas || !elCod || !botaoEnviar) return;

    // Remova o elId da validação obrigatória, pois em cadastros novos ele é vazio
    const isValido = 
        elNm.value.trim().length > 0 &&
        elTp.value.trim().length > 0 &&
        elEmpPagadora.value.trim().length > 0 &&
        elPlanoContas.value.trim().length > 0 &&
        elCod.value.trim().length > 0;

    if (isValido) {
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