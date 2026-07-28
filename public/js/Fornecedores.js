import { fetchComToken, aplicarTema } from '../utils/utils.js';

// document.addEventListener("DOMContentLoaded", function () {
//     const idempresa = localStorage.getItem("idempresa");
//     if (idempresa) {
//         let tema = idempresa == 1 ? "JA-Oper" : "ES";
//         aplicarTema(tema);
//     }
// });
let nomeEmpresaAtual = '';

document.addEventListener("DOMContentLoaded", function () {
    const idempresa = localStorage.getItem("idempresa");

    if (idempresa) {
        const apiUrl = `/empresas/${idempresa}`; // Verifique o caminho da sua API

        fetchComToken(apiUrl)
            .then(empresa => {
                // Usa o nome fantasia como tema
                const tema = empresa.nmfantasia;
                nomeEmpresaAtual = empresa.nmfantasia || '';
                aplicarTema(tema);
            })
            .catch(error => {
                console.error("❌ Erro ao buscar dados da empresa para o tema:", error);
                // aplicarTema('default');
            });
    }
});
let tpFornecedorInputListener = null;
let btnEnviarListener = null;
let btnLimparListener = null;
let btnPesquisarListener = null;
let selectFornecedoresChangeListener = null;
let nmFantasiaBlurListener = null;
let cnpjBlurListener = null;

if (typeof window.fornecedorOriginal === "undefined") {
    window.fornecedorOriginal = {
        idFornecedor: "",
        nmFantasia: "",
        razaoSocial: "",
        cnpj: "",
        nmContato: "",
        celContato: "",
        emailFornecedor: "",
        emailContato: "",
        pix: "",
        agencia: "",
        digitoagencia: "",
        conta: "",
        digitoconta: "",
        codbanco: "",
        telefone: "",
        inscEstadual: "",
        cep: "",
        rua: "",
        numero: "",
        complemento: "",
        bairro: "",
        cidade: "",
        estado: "",
        pais: "",
        ativo: "",
        tpfornecedor: "",
        observacao: ""
    };
}


let maskCNPJ, maskTelefone, maskCelContato, maskCEP =null;


function aplicarMascaras() {
    console.log("Aplicando máscaras aos campos de entrada...");
    maskCNPJ = IMask(document.querySelector("#cnpj"), {    
        mask: [
                {
                    mask: '000.000.000-00', // Máscara para CPF (11 dígitos)
                    maxLength: 11 // Define o comprimento máximo para esta máscara
                },
                {
                    mask: '00.000.000/0000-00', // Máscara para CNPJ (14 dígitos)
                    maxLength: 14 // Define o comprimento máximo para esta máscara
                }
            ],
            dispatch: function (appended, dynamicMasked) {
                const number = (dynamicMasked.value + appended).replace(/\D/g,'');

                if (number.length <= 11) {
                    return dynamicMasked.compiledMasks[0]; // Retorna a máscara de CPF
                }
                
                return dynamicMasked.compiledMasks[1]; // Retorna a máscara de CNPJ
            }
    });
    

    maskTelefone = IMask(document.querySelector("#telefone"), {
        mask: [
        {
            mask: "(00) 0000-0000", // Fixo: 10 dígitos
          
        },
        {
            mask: "(00) 00000-0000", // Celular: 11 dígitos
            
        }]
    
  
    });

    maskCelContato = IMask(document.querySelector("#celContato"), {
        mask: "(00) 00000-0000"
    });

    maskCEP = IMask(document.querySelector("#cep"), {
        mask: "00000-000"
    });  

}

const campos = {
        idFornecedor: "#idFornecedor",
        nmFantasia: "#nmFantasia",
        razaoSocial: "#razaoSocial",
        cnpj: "#cnpj",
        inscEstadual: "#inscEstadual",
        emailFornecedor: "#emailFornecedor",
        pix: "#pix",        
        telefone: "#telefone",
        cep: "#cep",
        rua: "#rua",
        numero: "#numero",
        complemento: "#complemento",
        bairro: "#bairro",
        cidade: "#cidade",
        estado: "#estado",
        pais: "#pais",
        nmContato: "#nmContato",
        celContato: "#celContato",
        emailContato: "#emailContato",
        ativo: "#ativo",
        tpfornecedor: "#tpfornecedor",
        observacao: "#observacao",
        codbanco: "#codBanco",
        agencia: "#agencia",
        digitoagencia: "#digitoAgencia",
        conta: "#nConta",
        digitoconta: "#digitoConta"
  
};

const getCampo = (key) => document.querySelector(campos[key]);

const setCampo = (key, value) => {
    const campo = getCampo(key);
    if (campo) {
        if (campo.type === "checkbox") {
            campo.checked = value === true || value === "true" || value === 1;
        } else {
            campo.value = value ?? "";
        }
    }
};

const preencherFormulario = (fornecedor) => {
    console.log("PREENCHER FORMULARIO", fornecedor);
    Object.entries(campos).forEach(([key]) => {
        if (key === "telefone") maskTelefone.value = fornecedor.telefone || '';
        else if (key === "cnpj") maskCNPJ.value = fornecedor.cnpj || '';
        else if (key === "cep") maskCEP.value = fornecedor.cep || '';
        else if (key === "celContato") maskCelContato.value = fornecedor.celcontato || '';
        else setCampo(key, fornecedor[key.toLowerCase()]);
    });

    const campoNome = document.getElementById("nmFantasia");
    if (campoNome) campoNome.value = fornecedor.nmfantasia;

    if (fornecedor.codbanco) {
        buscarENomearBanco(fornecedor.codbanco);
    }

    window.fornecedorOriginal = {
        idFornecedor: fornecedor.idfornecedor || "",
        nmFantasia: fornecedor.nmfantasia || "",
        razaoSocial: fornecedor.razaosocial || "",
        cnpj: fornecedor.cnpj || "",
        nmContato: fornecedor.nmcontato || "",
        celContato: fornecedor.celcontato || "",
        emailFornecedor: fornecedor.emailfornecedor || "",
        emailContato: fornecedor.emailcontato || "",
        pix: fornecedor.pix || "",        
        telefone: fornecedor.telefone || "",
        inscEstadual: fornecedor.inscestadual || "",
        cep: fornecedor.cep || "",
        rua: fornecedor.rua || "",
        numero: fornecedor.numero || "",
        complemento: fornecedor.complemento || "",
        bairro: fornecedor.bairro || "",
        cidade: fornecedor.cidade || "",
        estado: fornecedor.estado || "",
        pais: fornecedor.pais || "",
        ativo: fornecedor.ativo || false,
        tpfornecedor: fornecedor.tpfornecedor || "",
        observacao: fornecedor.observacao || "",
        codbanco: fornecedor.codbanco || "",
        agencia: fornecedor.agencia || "",
        digitoagencia: fornecedor.digitoagencia || "",
        conta: fornecedor.conta || "",
        digitoconta: fornecedor.digitoconta || ""
       
    };

    console.log("Fornecedor original CarregarFornecedor:", window.fornecedorOriginal);

    const campoCodigo = getCampo("idFornecedor");
    if (campoCodigo && campoCodigo.value.trim()) {
        campoCodigo.classList.add("has-value");
    }
    campoCodigo.readOnly = true; // bloqueia o campo
};

// Preenche os dados de um fornecedor já existente (achado por CPF/CNPJ em outra
// empresa). Propositalmente NÃO preenche `idFornecedor` — o formulário continua em
// modo de novo cadastro (POST), que no backend detecta o CPF/CNPJ já existente e
// apenas vincula o fornecedor à empresa atual, em vez de duplicar o registro.
const preencherDadosImportadosFornecedor = (fornecedor) => {
    Object.entries(campos).forEach(([key]) => {
        if (key === "idFornecedor") return;
        if (key === "telefone") maskTelefone.value = fornecedor.telefone || '';
        else if (key === "cnpj") maskCNPJ.value = fornecedor.cnpj || '';
        else if (key === "cep") maskCEP.value = fornecedor.cep || '';
        else if (key === "celContato") maskCelContato.value = fornecedor.celcontato || '';
        else setCampo(key, fornecedor[key.toLowerCase()]);
    });

    if (fornecedor.codbanco) {
        buscarENomearBanco(fornecedor.codbanco);
    }
};

// ===== Verificação de CPF/CNPJ já cadastrado (em qualquer empresa) =====
// Ao sair do campo CNPJ (campo aceita CPF ou CNPJ), verifica se já existe um
// fornecedor com esse documento. Mesma lógica usada em Funcionários.
function configurarVerificacaoCnpj() {
    const inputCnpj = document.getElementById("cnpj");
    if (!inputCnpj) return;

    if (cnpjBlurListener) {
        inputCnpj.removeEventListener("blur", cnpjBlurListener);
    }

    cnpjBlurListener = async function () {
        const cnpj = (maskCNPJ?.unmaskedValue || this.value.replace(/\D/g, ''));
        if (!cnpj || (cnpj.length !== 11 && cnpj.length !== 14)) return;

        const idAtual = document.getElementById("idFornecedor")?.value;
        if (idAtual) return; // já está editando um fornecedor carregado

        try {
            const resposta = await fetchComToken(`/fornecedores/verificar-cnpj/${encodeURIComponent(cnpj)}`);

            // fetchComToken devolve [] em 404 (documento novo, ninguém encontrado)
            if (!resposta || Array.isArray(resposta) || !resposta.idfornecedor) {
                return;
            }

            if (resposta.existeNaEmpresaAtual) {
                await Swal.fire({
                    icon: 'info',
                    title: 'Fornecedor já cadastrado nesta empresa',
                    text: 'Os dados deste fornecedor foram carregados para edição.',
                    confirmButtonText: 'OK'
                });
                preencherFormulario(resposta.dados);
                return;
            }

            const { isConfirmed } = await Swal.fire({
                icon: 'question',
                title: 'Fornecedor já cadastrado em outra empresa do grupo empresarial',
                text: `Deseja importar os dados para a empresa "${nomeEmpresaAtual || 'atual'}"?`,
                showCancelButton: true,
                confirmButtonText: 'Sim, importar',
                cancelButtonText: 'Não',
                reverseButtons: true
            });

            if (isConfirmed) {
                preencherDadosImportadosFornecedor(resposta.dados);
                await Swal.fire({
                    icon: 'info',
                    title: 'Dados importados',
                    text: 'Os dados vieram como sugestão de outra empresa do grupo — confira e ajuste o que for diferente nesta empresa antes de salvar.',
                    confirmButtonText: 'OK, entendi'
                });
            }
        } catch (error) {
            console.error("Erro ao verificar CPF/CNPJ do fornecedor:", error);
        }
    };

    inputCnpj.addEventListener("blur", cnpjBlurListener);
}

const limparFormulario = () => {
    form.reset();
    document.querySelector("#idFornecedor").value = "";
    if (typeof limparFornecedorOriginal === "function") limparFornecedorOriginal();
    
    
};

const obterDadosFormulario = () => {
    const valor = (key) => getCampo(key)?.value?.trim() || "";
    const rawIE = valor("inscEstadual");
    const inscEstadual = rawIE.toUpperCase() === "ISENTO" ? "ISENTO" : rawIE.replace(/\D/g, '');  // só números
    const dados = {
        nmFantasia: valor("nmFantasia").toUpperCase(),
        razaoSocial: valor("razaoSocial").toUpperCase(),
        cnpj: valor("cnpj").replace(/\D/g, ''),
        inscEstadual,
        emailFornecedor: valor("emailFornecedor"),
        pix: valor("pix"), 
        telefone: valor("telefone").replace(/\D/g, ''),
        nmContato: valor("nmContato").toUpperCase(),
        celContato: valor("celContato").replace(/\D/g, ''),
        emailContato: valor("emailContato"),
        observacao: valor("observacao"),
        cep: valor("cep").replace(/\D/g, ''),
        rua: valor("rua").toUpperCase(),
        numero: valor("numero"),
        complemento: valor("complemento").toUpperCase(),
        bairro: valor("bairro").toUpperCase(),
        cidade: valor("cidade").toUpperCase(),
        estado: valor("estado").toUpperCase(),
        pais: valor("pais").toUpperCase(),
        ativo: getCampo("ativo")?.checked,
        tpfornecedor: valor("tpfornecedor").toUpperCase(),
        observacao: valor("observacao").toUpperCase(),
        codbanco: valor("codbanco"),
        agencia: valor("agencia"),
        digitoagencia: valor("digitoagencia"),
        conta: valor("conta"),
        digitoconta: valor("digitoconta")
    };
    console.log("Dados do formulário prontos para envio:", dados);
    return dados;
};


function carregarFornecedores() {
    console.log("Configurando eventos para o modal de fornecedors");
   
    aplicarMascaras();  

    const tpFornecedorInput = document.getElementById('tpfornecedor');
    if(tpFornecedorInput){
        tpFornecedorInput.addEventListener('input', function(event) {
            const valor = event.target.value;
            const permitido = /^[jJfF]$/.test(valor); // Usa regex para verificar

            if (!permitido) {
                event.target.value = ''; // Limpa o campo se a entrada for inválida
                Swal.fire({
                    title: 'Entrada Inválida',
                    text: 'Por favor, digite apenas "J" ou "F"',
                    icon: 'warning',
                    confirmButtonText: 'Ok'
                });
            }
        });
    }
    //pesquisar fornecedor pelo nome fantasia
    const form = document.querySelector("#form");
    const btnEnviar = document.querySelector("#Enviar");
    const btnLimpar = document.getElementById("Limpar");
    const btnPesquisar = document.getElementById("Pesquisar");
    

    if (!form || !btnEnviar) {
        console.error("Formulário ou botão Enviar não encontrado.");
        return;
    }

    const codBancoInput = document.getElementById("codBanco");

    codBancoInput.addEventListener("blur", async function () {
        const codBanco = this.value.trim();
        if (!codBanco) {
            console.warn("Código do banco vazio, não fazendo busca.");
            return;
        }
        preencherDadosBancoPeloCodigo(codBanco);
    });
   
    btnEnviar.addEventListener("click", async (e) => {
    e.preventDefault();
        console.log("Entrou no botão Enviar");
        const dados = obterDadosFormulario();
        const valorIdFornecedor = document.querySelector("#idFornecedor").value.trim();

        const temPermissaoCadastrar = temPermissao("Fornecedores", "cadastrar");
        const temPermissaoAlterar = temPermissao("Fornecedores", "alterar");

        const metodo = valorIdFornecedor ? "PUT" : "POST";

        // Bloqueia tentativa de cadastro se não tem permissão
        if (!valorIdFornecedor && !temPermissaoCadastrar) {
            return Swal.fire({
                    icon: "info",
                    title: "Fornecedor não cadastrado",
                    text: "Você não tem permissão para cadastrar Fornecedores.",
                    confirmButtonText: "OK"
                });
        }

        // Bloqueia tentativa de edição se não tem permissão
        if (valorIdFornecedor && !temPermissaoAlterar) {
            return wal.fire({
                    icon: "info",
                    title: "Acesso negado",
                    text: "Você não tem permissão para alterar Fornecedores.",
                    confirmButtonText: "OK"
                });
        }

        // Valida campos obrigatórios
        if (!dados.nmFantasia || !dados.razaoSocial || !dados.cnpj) {
            return Swal.fire("Atenção!", "Preencha Fantasia, Razão e CNPJ.", "warning");
        }

        // Valida alterações
        if (!houveAlteracao(dados)) {
            return Swal.fire("Nenhuma alteração foi detectada!", "Faça alguma alteração antes de salvar.", "info");
        }

        const url = valorIdFornecedor
            ? `/fornecedores/${valorIdFornecedor}`
            : "/fornecedores";

        try {
            if (metodo === "PUT") {
                const { isConfirmed } = await Swal.fire({
                    title: "Deseja salvar as alterações?",
                    text: "Você está prestes a atualizar os dados do fornecedor.",
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

            await Swal.fire("Sucesso!", respostaApi.message || "Fornecedor salvo com sucesso.", "success");
            limparFormulario();

        } catch (error) {
            console.error("Erro ao enviar dados:", error);
            Swal.fire("Erro", error.message || "Erro ao salvar fornecedor.", "error");
        }
    });


    if (btnLimpar) {
        btnLimpar.addEventListener("click", () => {
            const campo = document.getElementById("nmFantasia");

            if (campo && campo.tagName.toLowerCase() === "select") {
                const input = document.createElement("input");
                input.type = "text";
                input.id = "nmFantasia";
                input.name = "nmFantasia";
                input.className = "form";
                input.required = true;
                input.classList.add("uppercase");

                campo.parentNode.replaceChild(input, campo);
                adicionarEventoBlurFornecedor() 

                const label = document.querySelector('label[for="nmFantasia"]');
                if (label) label.style.display = "block";
            }

            limparFormulario(); // Se você quiser limpar o restante do formulário
        });
    }
     
    if (btnPesquisar) {
        console.log("Entrou no botão pesquisar antes do click");
        
        btnPesquisar.addEventListener("click", async (event) => {
            event.preventDefault();
            console.log("ENTROU NO BOTÃO PESQUISAR DEPOIS DO CLICK");

            limparFormulario();
            try {
                console.log("CarregarFornecedores");
                const fornecedors = await fetchComToken("/fornecedores");

                if (!fornecedors || fornecedors.length === 0) {
                    return Swal.fire({
                        icon: 'info',
                        title: 'Nenhum fornecedor cadastrado',
                        text: 'Não foi encontrado nenhum fornecedor no sistema.',
                        confirmButtonText: 'Ok'
                    });
                }

                const input = getCampo("nmFantasia");

                const select = criarSelectFornecedores(fornecedors);
                if (input && input.parentNode) {
                    input.parentNode.replaceChild(select, input);
                }

                const label = document.querySelector('label[for="nmFantasia"]');
                if (label) label.style.display = "none";

                select.addEventListener("change", async function () {
                    const desc = this.value?.trim();
                    if (!desc) return;

                    await carregarFornecedoresNmFantasia(desc, this);
                    console.log("Fornecedor selecionado:", desc);
                });

            } catch (error) {
                console.error("Erro ao carregar fornecedors:", error);
                mostrarErro("Erro", "Não foi possível carregar os fornecedors.");
            }
        });
    }
    
 }

 async function preencherDadosBancoPeloCodigo() {
 
    const codBancoInput = document.getElementById('codBanco');
  
    if (!codBancoInput) {
        console.warn("Elemento 'inputBanco' (nome do banco) não encontrado no DOM do modal de Funcionários.");
        return;
    }

    if (!codBancoInput.value) {       
        codBancoInput.value = '';
        return;
    }    

    try {
        const codBanco = document.getElementById("codBanco").value;
        const url = `/funcionarios/bancos?codBanco=${encodeURIComponent(codBanco)}`;
        const nomeBanco = await fetchComToken(url);            
        
        if (nomeBanco && nomeBanco.codbanco) { 
            document.getElementById("banco").value = nomeBanco.nmbanco;        
        } else {        
    
            Swal.fire({
                icon: 'info',
                title: 'Banco não encontrado',
                text: `Nenhum banco encontrado com o código '${codBanco}'.`,
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000
            });           
        }
    } catch (error) {        
           
        if (error.message !== 'Sessão expirada') {
            Swal.fire({
                icon: 'error',
                title: 'Erro de busca de banco',
                text: 'Não foi possível buscar as informações do banco. Verifique o código e tente novamente.',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000
            });
        }
    }
}

// No Fornecedores.js
async function buscarENomearBanco(codigo) {
    if (!codigo) return;
    try {
        const url = `/funcionarios/bancos?codBanco=${encodeURIComponent(codigo)}`;
        const nomeBanco = await fetchComToken(url);            
        
        if (nomeBanco && nomeBanco.nmbanco) { 
            document.getElementById("banco").value = nomeBanco.nmbanco;        
        }
    } catch (error) {
        console.error("Erro ao buscar nome do banco:", error);
    }
}

 function desinicializarFornecedoresModal() {
    console.log("🧹 Desinicializando módulo Fornecedores.js");

    const tpFornecedorInput = document.getElementById('tpfornecedor');
    const btnEnviar = document.querySelector("#Enviar");
    const btnLimpar = document.getElementById("Limpar");
    const btnPesquisar = document.getElementById("Pesquisar");
    const nmFantasiaElement = document.getElementById("nmFantasia"); // Pode ser input ou select

    if (tpFornecedorInput && tpFornecedorInputListener) {
        tpFornecedorInput.removeEventListener('input', tpFornecedorInputListener);
        tpFornecedorInputListener = null;
    }
    if (btnEnviar && btnEnviarListener) {
        btnEnviar.removeEventListener("click", btnEnviarListener);
        btnEnviarListener = null;
    }
    if (btnLimpar && btnLimparListener) {
        btnLimpar.removeEventListener("click", btnLimparListener);
        btnLimparListener = null;
    }
    if (btnPesquisar && btnPesquisarListener) {
        btnPesquisar.removeEventListener("click", btnPesquisarListener);
        btnPesquisarListener = null;
    }

    // Remover listener do select (se o #nmFantasia for um select)
    if (nmFantasiaElement && nmFantasiaElement.tagName === "SELECT" && selectFornecedoresChangeListener) {
        nmFantasiaElement.removeEventListener("change", selectFornecedoresChangeListener);
        selectFornecedoresChangeListener = null;
    }
    // Remover listener do input #nmFantasia (se for um input)
    if (nmFantasiaElement && nmFantasiaElement.tagName === "INPUT" && nmFantasiaBlurListener) {
        nmFantasiaElement.removeEventListener("blur", nmFantasiaBlurListener);
        nmFantasiaBlurListener = null;
    }

    const inputCnpj = document.getElementById("cnpj");
    if (inputCnpj && cnpjBlurListener) {
        inputCnpj.removeEventListener("blur", cnpjBlurListener);
        cnpjBlurListener = null;
    }

    // Limpar o estado original do fornecedor
    window.FornecedorOriginal = { // <-- Acesse diretamente a variável do módulo
        idFornecedor: "",
        nmFantasia: "",
        razaoSocial: "",
        cnpj: "",
        nmContato: "",
        celContato: "",
        emailFornecedor: "",
        emailContato: "",
        pix: "",
        agencia: "",
        digitoagencia: "",
        conta: "",
        digitoconta: "",
        codbanco: "",
        inscEstadual: "",
        cep: "",
        rua: "",
        numero: "",
        complemento: "",
        bairro: "",
        cidade: "",
        estado: "",
        pais: "",
        ativo: "",
        tpfornecedor: "",
        observacao: ""
    };


    if (maskCNPJ) {
        maskCNPJ.destroy(); // Chama o método destroy da instância da máscara
        maskCNPJ = null;
    }
    if (maskTelefone) {
        maskTelefone.destroy();
        maskTelefone = null;
    }
    if (maskCelContato) {
        maskCelContato.destroy();
        maskCelContato = null;
    }
    if (maskCEP) {
        maskCEP.destroy();
        maskCEP = null;
    }

 }


    
  /**
 * Retorna true se houver alguma diferença entre os dados atuais e fornecedorOriginal.
 * @param {Object} dados - objeto com as propriedades e valores do formulário.
 */

  
function houveAlteracao(dados) {
    if (!window.fornecedorOriginal) return true;

    return Object.keys(dados).some(key => {
        const original = window.fornecedorOriginal[key];
        const atual = dados[key];
        return String(original ?? "").trim() !== String(atual ?? "").trim();
    });
}


function criarSelectFornecedores(fornecedors) {
    const select = document.createElement("select");
    select.id = "nmFantasia";
    select.name = "nmFantasia";
    select.required = true;
    select.className = "form";

    const defaultOption = document.createElement("option");
    
    defaultOption.text = "Selecione um fornecedor...";
    defaultOption.disabled = true;
    defaultOption.selected = true;
    defaultOption.value = "";
    select.appendChild(defaultOption);

    console.log("Fornecedores encontrados no CriarSelects:", fornecedors);

    fornecedors.forEach(fornecedoresachados => {
        const option = document.createElement("option");
        option.value = fornecedoresachados.nmfantasia;
        option.text = fornecedoresachados.nmfantasia;
        select.appendChild(option);
    });
    
    return select;
}

function adicionarEventoBlurFornecedor() {
    
    // Event: Preencher campos ao sair do campo Nome Fantasia
    let ultimoClique = null;

    // Captura o último elemento clicado no documento
    document.addEventListener("mousedown", (e) => {
        ultimoClique = e.target;
    });
    
    getCampo("nmFantasia").addEventListener("blur", async function () {
       
        const botoesIgnorados = ["Limpar", "Pesquisar", "Close"];
        const ehBotaoIgnorado =
            ultimoClique?.id && botoesIgnorados.includes(ultimoClique.id) ||
            ultimoClique?.classList.contains("close");

        if (ehBotaoIgnorado) {
            console.log("🔁 Blur ignorado: clique em botão de controle (Fechar/Limpar/Pesquisar).");
            return;
        }    
    
        const nmFantasia = this.value.trim();
        if (!nmFantasia) return;

        try {
            const fornecedor = await fetchComToken(`/fornecedores?nmFantasia=${encodeURIComponent(nmFantasia)}`);
            
            console.log("Fornecedor encontrado:", fornecedor);

            if (!fornecedor || Object.keys(fornecedor).length === 0)
                throw new Error("Dados de fornecedor vazios");

            preencherFormulario(fornecedor);
            console.log("Fornecedor carregado:", fornecedor);

        } catch (error) {
            console.log("Erro ao buscar fornecedor:", nmFantasia, idFornecedor.value, error);

            //  Se fornecedor não existe e ainda não tem ID preenchido
            if (!idFornecedor.value) {
                const podeCadastrar = temPermissao("Fornecedores", "cadastrar");
                console.log("PODE CADASTRAR ", podeCadastrar);
                // Só pergunta se deseja cadastrar se tiver permissão
                if (podeCadastrar) {
                    const { isConfirmed } = await Swal.fire({
                        icon: 'question',
                        title: `Deseja cadastrar "${nmFantasia.toUpperCase()}" como novo Fornecedor?`,
                        text: `Fornecedor "${nmFantasia.toUpperCase()}" não encontrado`,
                        showCancelButton: true,
                        confirmButtonText: 'Sim, cadastrar',
                        cancelButtonText: 'Cancelar'
                    });

                    if (!isConfirmed) return;

                    // Se confirmado, pode continuar com o formulário em branco
                    limparFormulario(); // opcional
                    getCampo("nmFantasia").value = nmFantasia; // mantém o nome digitado
                } else {
                    //  Sem permissão: apenas alerta
                    await Swal.fire({
                        icon: 'info',
                        title: "Fornecedor não encontrado",
                        text: `Você não tem permissão para cadastrar um novo fornecedor.`,
                    });
                    getCampo("nmFantasia").value = '';
                    // ⚠️ Aguardar fechamento do Swal e forçar foco no campo
                    setTimeout(() => {
                        getCampo("nmFantasia").focus();
                    }, 100); // Pequeno delay (100ms)
                                
                getCampo("nmFantasia").focus();
                }
            }
        }
    });
}

// async function carregarFornecedoresNmFantasia(desc, elementoAtual) {
//     try {
//         const fornecedor = await fetchComToken(`/fornecedores?nmFantasia=${encodeURIComponent(desc.trim())}`);
        
//         console.log("Fornecedor encontrado:", fornecedor);

//         // Preencher os campos...
//         document.querySelector("#idFornecedor").value = fornecedor.idfornecedor || "";
//         document.querySelector("#nmFantasia").value = fornecedor.nmfantasia || "";
//         document.querySelector("#razaoSocial").value = fornecedor.razaosocial || "";
//         maskCNPJ.value = fornecedor.cnpj || '';
//         document.querySelector("#inscEstadual").value = fornecedor.inscestadual || "";
//         document.querySelector("#emailFornecedor").value = fornecedor.emailfornecedor || "";
//         document.querySelector("#pix").value = fornecedor.pix || "";
//         maskTelefone.value = fornecedor.telefone || '';
//         maskCelContato.value = fornecedor.celcontato || '';
//         document.querySelector("#nmContato").value = fornecedor.nmcontato || "";
//         document.querySelector("#emailContato").value = fornecedor.emailcontato || "";
//         document.querySelector("#observacao").value = fornecedor.observacao || "";
//         document.querySelector("#codbanco").value = fornecedor.codbanco || "";
//         document.querySelector("#agencia").value = fornecedor.agencia || "";
//         document.querySelector("#digitoagencia").value = fornecedor.digitoagencia || "";
//         document.querySelector("#conta").value = fornecedor.conta || "";
//         document.querySelector("#digitoconta").value = fornecedor.digitoconta || "";
//         maskCEP.value = fornecedor.cep || '';
//         document.querySelector("#rua").value = fornecedor.rua || "";
//         document.querySelector("#numero").value = fornecedor.numero || "";
//         document.querySelector("#complemento").value = fornecedor.complemento || "";
//         document.querySelector("#bairro").value = fornecedor.bairro || "";
//         document.querySelector("#cidade").value = fornecedor.cidade || "";
//         document.querySelector("#estado").value = fornecedor.estado || "";
//         document.querySelector("#pais").value = fornecedor.pais || "";
//         document.querySelector("#ativo").checked =
//             fornecedor.ativo === true || fornecedor.ativo === "true" || fornecedor.ativo === 1;
//         document.querySelector("#tpfornecedor").value = fornecedor.tpfornecedor || "";

//         fornecedorOriginal = { ...fornecedor };

//         const novoInput = document.createElement("input");
//         novoInput.type = "text";
//         novoInput.id = "nmFantasia";
//         novoInput.name = "nmFantasia";
//         novoInput.required = true;
//         novoInput.className = "form";
//         novoInput.classList.add("uppercase");
//         novoInput.value = fornecedor.nmfantasia;


//         elementoAtual.parentNode.replaceChild(novoInput, elementoAtual);
//         adicionarEventoBlurFornecedor();

//         const label = document.querySelector('label[for="nmFantasia"]');
//         if (label) {
//             label.style.display = "block";
//             label.textContent = "Nome Fantasia";
//         }

//         novoInput.addEventListener("blur", async function () {
//             if (!this.value.trim()) return;
//             await carregarFornecedoresNmFantasia(this.value, this);
//         });

//     } catch {
//         mostrarErro("Fornecedor não encontrado", "Nenhum fornecedor com esse nome foi encontrado.");
//         limparFornecedorOriginal();
//     }
// }

async function carregarFornecedoresNmFantasia(desc, elementoAtual) {
    try {
        console.log("Buscando fornecedor:", desc);
        const fornecedor = await fetchComToken(`/fornecedores?nmFantasia=${encodeURIComponent(desc.trim())}`);
        
        if (!fornecedor || Object.keys(fornecedor).length === 0) {
            throw new Error("Fornecedor não encontrado na base de dados");
        }

        console.log("Fornecedor recebido da API:", fornecedor);

        // Use a função que você já criou, ela trata os campos de forma centralizada
        preencherFormulario(fornecedor);

        // Lógica para trocar o Select de volta para Input de texto
        const novoInput = document.createElement("input");
        novoInput.type = "text";
        novoInput.id = "nmFantasia";
        novoInput.name = "nmFantasia";
        novoInput.required = true;
        novoInput.className = "form uppercase";
        novoInput.value = fornecedor.nmfantasia;

        novoInput.addEventListener("input", (e) => {
            console.log("Novo nome fantasia sendo digitado:", e.target.value);
        });

        if (elementoAtual && elementoAtual.parentNode) {
            elementoAtual.parentNode.replaceChild(novoInput, elementoAtual);
        }
        
        adicionarEventoBlurFornecedor();

        const label = document.querySelector('label[for="nmFantasia"]');
        if (label) {
            label.style.display = "block";
        }

    } catch (error) {
        console.error("Erro detalhado no front:", error);
        mostrarErro("Atenção", "Não foi possível carregar os detalhes do fornecedor.");
        limparFornecedorOriginal();
    }
}

function mostrarErro(titulo, texto) {
    Swal.fire({
        icon: 'warning',
        title: titulo,
        text: texto,
        confirmButtonText: 'Ok'
    });
}


function limparFornecedorOriginal() {  
    fornecedorOriginal = {
        idFornecedor: "",
        nmFantasia: "",
        razaoSocial: "",
        cnpj: "",
        nmContato: "",
        celContato: "",
        emailContato: "",
        emailFornecedor: "",
        pix: "",
        agencia: "",
        digitoagencia: "",
        conta: "",
        digitoconta: "",
        codbanco: "",
        telefone: "",
        inscEstadual: "",
        cep: "",
        rua: "",
        numero: "",
        complemento: "",
        bairro: "",
        cidade: "",
        estado: "",
        pais: "",
        ativo: "",
        tpfornecedor: "",
        observacao: ""
    };
}

function limparCamposFornecedores(){
    const campos = ["idFornecedor", "nmFantasia", "razaoSocial", "cnpj", "inscEstadual", "emailFornecedor", "pix", "site", "telefone", "nmContato", "celContato", "emailContato", "cep", "rua", "numero", "complemento", "bairro", "cidade", "estado", "pais", "tpfornecedor", "observacao", "codBanco", "Agencia", "digitoAgencia", "nConta", "digitoConta"];  
   
    campos.forEach(id => {
        const campo = document.getElementById(id);
        if (campo) {
            if (campo.type === "checkbox") {
                campo.checked = false;
            } else {
                campo.value = "";
            }
        }
    });

    // Garante que o campo "ativo" (checkbox) seja desmarcado
    const campoAtivo = document.getElementById("ativo");
    if (campoAtivo && campoAtivo.type === "checkbox") {
        campoAtivo.checked = false;
    }
    const campoNomeFantasia = document.querySelector("#nmFantasia");
    if (campoNomeFantasia.tagName === "SELECT") {
        const input = document.createElement("input");
        input.type = "text";
        input.id = "nmFantasia";
        input.name = "nmFantasia";
        input.className = "form";
        input.value = "Nome Fantasia"; 
        input.classList.add("uppercase");
        input.required = true;
        campoNomeFantasia.parentNode.replaceChild(input, campoNomeFantasia);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const inputCodigo = document.querySelector("#idFornecedor");
  
    if (!inputCodigo) {
        console.warn("Tratamento do 'idFornecedor' para estilizar como demais campos.");
        return; // Encerra o código se o campo não existir
      }
    
    const atualizarLabelCodigo = () => {
      if (inputCodigo.value.trim()) {
        inputCodigo.classList.add("has-value");
      } else {
        inputCodigo.classList.remove("has-value");
      }
    };
  
    // Roda no carregamento
    atualizarLabelCodigo();
  
    // Observa mudanças manuais e via script
    inputCodigo.addEventListener("input", atualizarLabelCodigo);
  
    // Atualiza se o valor for preenchido programaticamente
    const observer = new MutationObserver(atualizarLabelCodigo);
    observer.observe(inputCodigo, { attributes: true, attributeFilter: ["value"] });
});

function configurarEventosFornecedores() {
    console.log("Configurando eventos para o modal de fornecedors...");
    carregarFornecedores();
    adicionarEventoBlurFornecedor() ;
    configurarVerificacaoCnpj(); // detecta CPF/CNPJ já cadastrado (nesta ou em outra empresa)
}
window.configurarEventosFornecedores = configurarEventosFornecedores;

function configurarEventosEspecificos(modulo) {
  console.log("⚙️ configurarEventosEspecificos recebeu:", modulo);
  if (modulo.trim().toLowerCase() === 'fornecedores') {
    configurarEventosFornecedores();
    
    if (typeof aplicarPermissoes === "function" && window.permissoes) {// 01/06/2025
      aplicarPermissoes(window.permissoes);
    } else {
      console.warn("⚠️ aplicarPermissoes ou window.permissoes ainda não estão disponíveis.");
    }
  }
}
window.configurarEventosEspecificos = configurarEventosEspecificos;

window.moduloHandlers = window.moduloHandlers || {};

window.moduloHandlers['Fornecedores'] = { // A chave 'Fornecedores' deve ser a mesma do seu mapaModulos no Index.js
    configurar: configurarEventosFornecedores,
    desinicializar: desinicializarFornecedoresModal
};

console.log(`Módulo Fornecedores.js registrado em window.moduloHandlers`);
