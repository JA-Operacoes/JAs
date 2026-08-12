import { fetchComToken, aplicarTema  } from '../utils/utils.js';

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


let tpEmpresaInputListener = null;
let enviarEmpresaButtonListener = null;
let limparEmpresaButtonListener = null;
let pesquisarEmpresaButtonListener = null;
let nmFantasiaSelectChangeListener = null;

if (typeof window.empresaOriginal === "undefined") {
    window.empresaOriginal = {
        idEmpresa: "",
        nmFantasia: "",
        razaoSocial: "",
        cnpj: "",
        emailEmpresa: "",
        emailNfe: "",    
        site: "",
        inscEstadual: "",
        cep: "",
        rua: "",
        endereco: "",
        numero: "",
        complemento: "",
        bairro: "",
        cidade: "",
        estado: "",
        pais: "",
        ativo: "",
        regimeTributario: "",
        inscricaoMunicipal: "",
        idBanco: "",
        agencia: "",
        digitoAgencia: "",
        numeroConta: "",
        digitoConta: "",
        tipoConta: "",
        pix: ""
    };
}

let maskCNPJ, maskTelefone, maskCelContato, maskCEP;

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
   
    maskCEP = IMask(document.querySelector("#cep"), {
        mask: "00000-000"
    });  

}

const campos = {
        idEmpresa: "#idEmpresa",
        nmFantasia: "#nmFantasia",
        razaoSocial: "#razaoSocial",
        cnpj: "#cnpj",
        inscEstadual: "#inscEstadual",
        emailEmpresa: "#emailEmpresa",
        emailNfe: "#emailNfe",
        site: "#site",
        telefone: "#telefone",
        cep: "#cep",
        rua: "#rua",
        numero: "#numero",
        complemento: "#complemento",
        bairro: "#bairro",
        cidade: "#cidade",
        estado: "#estado",
        pais: "#pais",
        ativo: "#ativo",
        regimeTributario: "#regimeTributario",
        inscricaoMunicipal: "#inscricaoMunicipal",
        idBanco: "#idBanco",
        agencia: "#agencia",
        digitoAgencia: "#digitoAgencia",
        numeroConta: "#numeroConta",
        digitoConta: "#digitoConta",
        tipoConta: "#tipoConta",
        pix: "#pix"
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

// const preencherFormulario = (empresa) => {
//     console.log("PREENCHER FORMULARIO", empresa);
//     Object.entries(campos).forEach(([key]) => {
//         if (key === "telefone") maskTelefone.value = empresa.telefone || '';
//         else if (key === "cnpj") maskCNPJ.value = empresa.cnpj || '';
//         else if (key === "cep") maskCEP.value = empresa.cep || '';
//         else setCampo(key, empresa[key.toLowerCase()]);
//     });

//     window.empresaOriginal = {
//         idEmpresa: empresa.idempresa || "",
//         nmFantasia: empresa.nmfantasia || "",
//         razaoSocial: empresa.razaosocial || "",
//         cnpj: empresa.cnpj || "",   
//         emailEmpresa: empresa.emailemp || "",
//         emailNfe: empresa.emailnf || "",     
//         site: empresa.site || "",
//         inscEstadual: empresa.inscricaoestadual || "",
//         cep: empresa.cep || "",
//         rua: empresa.rua || "",
//         numero: empresa.numero || "",
//         complemento: empresa.complemento || "",
//         bairro: empresa.bairro || "",
//         cidade: empresa.cidade || "",
//         estado: empresa.estado || "",
//         pais: empresa.pais || "",
//         ativo: empresa.ativo || false
//     };

//     console.log("Empresa original CarregarEmpresa:", window.empresaOriginal);

//     const campoCodigo = getCampo("idEmpresa");
//     if (campoCodigo && campoCodigo.value.trim()) {
//         campoCodigo.classList.add("has-value");
//     }
//     campoCodigo.readOnly = true; // bloqueia o campo
// };

const preencherFormulario = (empresa) => {
    console.log("PREENCHER FORMULARIO", empresa);

    // 1. Mapeia os dados da API para um objeto com os nomes dos seus campos
    const dadosMapeados = {
        idEmpresa: empresa.idempresa || "",
        nmFantasia: empresa.nmfantasia || "",
        razaoSocial: empresa.razaosocial || "",
        cnpj: empresa.cnpj || "",   
        emailEmpresa: empresa.emailemp || "",
        emailNfe: empresa.emailnf || "",     
        site: empresa.site || "",
        inscEstadual: empresa.inscricaoestadual || "", // CORREÇÃO APLICADA AQUI
        cep: empresa.cep || "",
        rua: empresa.endereco || "",
        numero: empresa.numero || "",
        complemento: empresa.complemento || "",
        bairro: empresa.bairro || "",
        cidade: empresa.cidade || "",
        estado: empresa.estado || "",
        pais: empresa.pais || "",
        ativo: empresa.ativo || false,
        regimeTributario: empresa.regimetributario || "",
        inscricaoMunicipal: empresa.inscricaomunicipal || "",
        idBanco: empresa.idbanco || "",
        agencia: empresa.agencia || "",
        digitoAgencia: empresa.digitoagencia || "",
        numeroConta: empresa.numeroconta || "",
        digitoConta: empresa.digitoconta || "",
        tipoConta: empresa.tipoconta || "",
        pix: empresa.pix || ""
    };

    // 2. Itera sobre os dados mapeados para preencher o formulário
    Object.entries(dadosMapeados).forEach(([key, value]) => {
        if (key === "telefone") {
            if (maskTelefone) maskTelefone.value = value;
        } else if (key === "cnpj") {
            if (maskCNPJ) maskCNPJ.value = value;
        } else if (key === "cep") {
            if (maskCEP) maskCEP.value = value;
        } else {
            setCampo(key, value);
        }
    });

    // 3. Usa os mesmos dados mapeados para o objeto de estado
    window.empresaOriginal = dadosMapeados;

    console.log("Empresa original CarregarEmpresa:", window.empresaOriginal);

    const campoCodigo = getCampo("idEmpresa");
    if (campoCodigo && campoCodigo.value.trim()) {
        campoCodigo.classList.add("has-value");
    }
    campoCodigo.readOnly = true;
};

const limparFormulario = () => {
    form.reset();
    document.querySelector("#idEmpresa").value = "";
    if (typeof limparEmpresaOriginal === "function") limparEmpresaOriginal();
    const campoSigla = document.querySelector("#certificadoSigla");
    const campoStatus = document.querySelector("#certificadoStatus");
    const btnInserir = document.querySelector("#btnInserirCertificado");
    if (campoSigla) campoSigla.value = "";
    if (campoStatus) campoStatus.value = "";
    if (btnInserir) {
        btnInserir.style.display = "none";
        btnInserir.onclick = null;
    }
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
        emailEmpresa: valor("emailEmpresa"),
        emailNfe: valor("emailNfe"),
        site: valor("site"),
        telefone: valor("telefone").replace(/\D/g, ''),
        cep: valor("cep").replace(/\D/g, ''),
        endereco: valor("rua").toUpperCase(),
        numero: valor("numero"),
        complemento: valor("complemento").toUpperCase(),
        bairro: valor("bairro").toUpperCase(),
        cidade: valor("cidade").toUpperCase(),
        estado: valor("estado").toUpperCase(),
        pais: valor("pais").toUpperCase(),
        ativo: getCampo("ativo")?.checked,
        regimeTributario: valor("regimeTributario"),
        inscricaoMunicipal: valor("inscricaoMunicipal"),
        idBanco: valor("idBanco"),
        agencia: valor("agencia"),
        digitoAgencia: valor("digitoAgencia"),
        numeroConta: valor("numeroConta"),
        digitoConta: valor("digitoConta"),
        tipoConta: valor("tipoConta"),
        pix: valor("pix"),
    };
    console.log("Dados do formulário prontos para envio:", dados);
    return dados;
};


// Select de Banco — lista vem de /bancos (cadastro já existente, usado no
// financeiro), escopada pela empresa logada via bancoempresas.
async function carregarBancosSelect() {
    const select = document.getElementById('idBanco');
    if (!select) return;
    try {
        const bancos = await fetchComToken('/bancos');
        if (!bancos.length) {
            select.innerHTML = '<option value="">Nenhum banco cadastrado — cadastre em Bancos</option>';
            return;
        }
        select.innerHTML = '<option value="">Selecione...</option>' +
            bancos.map((b) => `<option value="${b.idbanco}">${b.nmbanco}${b.codbanco ? ' (' + b.codbanco + ')' : ''}</option>`).join('');
    } catch (err) {
        console.error('Erro ao carregar bancos:', err);
        select.innerHTML = '<option value="">Erro ao carregar bancos</option>';
    }
}

function carregarEmpresas() {
    console.log("Configurando eventos para o modal de empresas");

    aplicarMascaras();
    carregarBancosSelect();

    const tpEmpresaInput = document.getElementById('tpempresa');
    if(tpEmpresaInput){
        tpEmpresaInput.addEventListener('input', function(event) {
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
    //pesquisar empresa pelo nome fantasia
    const form = document.querySelector("#form");
    const btnEnviar = document.querySelector("#Enviar");
    const btnLimpar = document.getElementById("Limpar");
    const btnPesquisar = document.getElementById("Pesquisar");    

    if (!form || !btnEnviar) {
        console.error("Formulário ou botão Enviar não encontrado.");
        return;
    }
   
    btnEnviar.addEventListener("click", async (e) => {
    e.preventDefault();
        console.log("Entrou no botão Enviar");
        const dados = obterDadosFormulario();
        const valorIdEmpresa = document.querySelector("#idEmpresa").value.trim();

        const temPermissaoCadastrar = temPermissao("Empresas", "cadastrar");
        const temPermissaoAlterar = temPermissao("Empresas", "alterar");

        const metodo = valorIdEmpresa ? "PUT" : "POST";

        console.log("Dados", dados)

        // Bloqueia tentativa de cadastro se não tem permissão
        if (!valorIdEmpresa && !temPermissaoCadastrar) {
            return Swal.fire({
                    icon: "info",
                    title: "Empresa não cadastrado",
                    text: "Você não tem permissão para cadastrar Empresas.",
                    confirmButtonText: "OK"
                });
        }

        // Bloqueia tentativa de edição se não tem permissão
        if (valorIdEmpresa && !temPermissaoAlterar) {
            return wal.fire({
                    icon: "info",
                    title: "Acesso negado",
                    text: "Você não tem permissão para alterar Empresas.",
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

        const url = valorIdEmpresa
            ? `/empresas/${valorIdEmpresa}`
            : "/empresas";

        try {
            if (metodo === "PUT") {
                const { isConfirmed } = await Swal.fire({
                    title: "Deseja salvar as alterações?",
                    text: "Você está prestes a atualizar os dados do empresa.",
                    icon: "question",
                    showCancelButton: true,
                    confirmButtonText: "Sim, salvar",
                    cancelButtonText: "Cancelar",
                    reverseButtons: true,
                    focusCancel: true
                });
                if (!isConfirmed) return;
            }

            const respostaApi = await salvarEmpresaComResolucaoDeSigla(url, metodo, dados);
            if (!respostaApi) return; // usuário cancelou a resolução do conflito de sigla

            await Swal.fire("Sucesso!", respostaApi.message || "Empresa salvo com sucesso.", "success");
            const idempresaSalva = respostaApi.idempresa || valorIdEmpresa;
            limparFormulario();
            await verificarCertificadoEmpresa(idempresaSalva);

        } catch (error) {
            console.error("Erro ao enviar dados:", error);
            Swal.fire("Erro", error.message || "Erro ao salvar empresa.", "error");
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
                adicionarEventoBlurEmpresa() 

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
                console.log("CarregarEmpresas");
                const empresas = await fetchComToken("/empresas");

                if (!empresas || empresas.length === 0) {
                    return Swal.fire({
                        icon: 'info',
                        title: 'Nenhuma empresa cadastrada',
                        text: 'Não foi encontrado nenhuma empresa no sistema.',
                        confirmButtonText: 'Ok'
                    });
                }
                
                const input = getCampo("nmFantasia");

                const select = criarSelectEmpresas(empresas);
                if (input && input.parentNode) {
                    input.parentNode.replaceChild(select, input);
                }

                const label = document.querySelector('label[for="nmFantasia"]');
                if (label) label.style.display = "none";

                select.addEventListener("change", async function () {
                    const desc = this.value?.trim();
                    if (!desc) return;

                    await carregarEmpresasNmFantasia(desc, this);
                    console.log("Empresa selecionado:", desc);
                });

            } catch (error) {
                console.error("Erro ao carregar empresas:", error);
                mostrarErro("Erro", "Não foi possível carregar os empresas.");
            }
        });
    }
    
 }

 function desinicializarEmpresasModal() {
    console.log("🧹 Desinicializando módulo Empresas...");

    const tpEmpresaInput = document.getElementById('tpempresa');
    const btnEnviar = document.querySelector("#Enviar");
    const btnLimpar = document.getElementById("Limpar");
    const btnPesquisar = document.getElementById("Pesquisar");
    const nmFantasiaSelect = document.getElementById("nmFantasia"); // Pode ser um input ou um select

    // Remover listeners
    if (tpEmpresaInput && tpEmpresaInputListener) {
        tpEmpresaInput.removeEventListener('input', tpEmpresaInputListener);
        tpEmpresaInputListener = null;
        console.log("Listener de input para #tpempresa removido.");
    }
    if (btnEnviar && enviarEmpresaButtonListener) {
        btnEnviar.removeEventListener("click", enviarEmpresaButtonListener);
        enviarEmpresaButtonListener = null;
        console.log("Listener de click para #Enviar (Empresas) removido.");
    }
    if (btnLimpar && limparEmpresaButtonListener) {
        btnLimpar.removeEventListener("click", limparEmpresaButtonListener);
        limparEmpresaButtonListener = null;
        console.log("Listener de click para #Limpar (Empresas) removido.");
    }
    if (btnPesquisar && pesquisarEmpresaButtonListener) {
        btnPesquisar.removeEventListener("click", pesquisarEmpresaButtonListener);
        pesquisarEmpresaButtonListener = null;
        console.log("Listener de click para #Pesquisar (Empresas) removido.");
    }
    if (nmFantasiaSelect && nmFantasiaSelect.tagName.toLowerCase() === "select" && nmFantasiaSelectChangeListener) {
        nmFantasiaSelect.removeEventListener("change", nmFantasiaSelectChangeListener);
        nmFantasiaSelectChangeListener = null;
        console.log("Listener de change para #nmFantasia (select) removido.");
    }

    // Limpar o estado global e campos do formulário
    limparFormulario();
    document.querySelector("#form").reset(); // Garante que o formulário seja completamente resetado
    empresaOriginal = null; // Garante que o estado original seja limpo

    // Se o campo nmFantasia estiver como select, reconverte para input ao desinicializar
    const campoNmFantasia = document.getElementById("nmFantasia");
    if (campoNmFantasia && campoNmFantasia.tagName.toLowerCase() === "select") {
        const input = document.createElement("input");
        input.type = "text";
        input.id = "nmFantasia";
        input.name = "nmFantasia";
        input.className = "form-control";
        input.required = true;
        input.classList.add("uppercase");
        campoNmFantasia.parentNode.replaceChild(input, campoNmFantasia);
        const label = document.querySelector('label[for="nmFantasia"]');
        if (label) label.style.display = "block";
    }
    // TODO: Adicionar o adicionarEventoBlurEmpresa() aqui, se ele deve ser sempre aplicado ao input
    // Mas note que ao desinicializar, não há necessidade de um listener ativo.
    // Ele será adicionado novamente na próxima chamada a configurarEmpresasModal.

    console.log("✅ Módulo Empresas desinicializado.");
}


    
  /**
 * Retorna true se houver alguma diferença entre os dados atuais e empresaOriginal.
 * @param {Object} dados - objeto com as propriedades e valores do formulário.
 */

  
function houveAlteracao(dados) {
    if (!window.empresaOriginal) return true;

    return Object.keys(dados).some(key => {
        const original = window.empresaOriginal[key];
        const atual = dados[key];
        return String(original ?? "").trim() !== String(atual ?? "").trim();
    });
}


function criarSelectEmpresas(empresas) {
    const select = document.createElement("select");
    select.id = "nmFantasia";
    select.name = "nmFantasia";
    select.required = true;
    select.className = "form";

    const defaultOption = document.createElement("option");
    
    defaultOption.text = "Selecione um empresa...";
    defaultOption.disabled = true;
    defaultOption.selected = true;
    defaultOption.value = "";
    select.appendChild(defaultOption);

    console.log("Empresas encontrados no CriarSelects:", empresas);

    empresas.forEach(empresasachados => {
        const option = document.createElement("option");
        option.value = empresasachados.nmfantasia;
        option.text = empresasachados.nmfantasia;
        select.appendChild(option);
    });
    
    return select;
}

function adicionarEventoBlurEmpresa() {
    
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
            const empresa = await fetchComToken(`/empresas?nmFantasia=${encodeURIComponent(nmFantasia)}`);
            //const idEmpresa = empresa.idempresa || document.querySelector("#idEmpresa");
            console.log("Empresa encontrado:", empresa);

            if (!empresa || Object.keys(empresa).length === 0)
                throw new Error("Dados de empresa vazios");

            preencherFormulario(empresa);
            console.log("Empresa carregado:", empresa);

        } catch (error) {
            console.log("Erro ao buscar empresa:", nmFantasia, idEmpresa.value, error);

            //  Se empresa não existe e ainda não tem ID preenchido
            if (!idEmpresa.value) {
                const podeCadastrar = temPermissao("Empresas", "cadastrar");
                console.log("PODE CADASTRAR ", podeCadastrar);
                // Só pergunta se deseja cadastrar se tiver permissão
                if (podeCadastrar) {
                    const { isConfirmed } = await Swal.fire({
                        icon: 'question',
                        title: `Deseja cadastrar "${nmFantasia.toUpperCase()}" como nova Empresa?`,
                        text: `Empresa "${nmFantasia.toUpperCase()}" não encontrado`,
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
                        title: "Empresa não encontrado",
                        text: `Você não tem permissão para cadastrar um novo empresa.`,
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

async function carregarEmpresasNmFantasia(desc, elementoAtual) {
    try {
        const empresa = await fetchComToken(`/empresas?nmFantasia=${encodeURIComponent(desc.trim())}`);
        
        console.log("Empresa encontrado:", empresa);

        // Preencher os campos...
        document.querySelector("#idEmpresa").value = empresa.idempresa || "";
        document.querySelector("#nmFantasia").value = empresa.nmfantasia || "";
        document.querySelector("#razaoSocial").value = empresa.razaosocial || "";
        maskCNPJ.value = empresa.cnpj || '';
        document.querySelector("#inscEstadual").value = empresa.inscricaoestadual || "";
        document.querySelector("#emailEmpresa").value = empresa.emailemp || "";
        document.querySelector("#emailNfe").value = empresa.emailnf || "";
        document.querySelector("#site").value = empresa.site || "";
        maskTelefone.value = empresa.telefone || '';
        maskCEP.value = empresa.cep || '';
        document.querySelector("#rua").value = empresa.endereco || "";
        document.querySelector("#numero").value = empresa.numero || "";
        document.querySelector("#complemento").value = empresa.complemento || "";
        document.querySelector("#bairro").value = empresa.bairro || "";
        document.querySelector("#cidade").value = empresa.cidade || "";
        document.querySelector("#estado").value = empresa.estado || "";
        document.querySelector("#pais").value = empresa.pais || "";
        document.querySelector("#ativo").checked =
            empresa.ativo === true || empresa.ativo === "true" || empresa.ativo === 1;
        document.querySelector("#regimeTributario").value = empresa.regimetributario || "";
        document.querySelector("#inscricaoMunicipal").value = empresa.inscricaomunicipal || "";
        document.querySelector("#idBanco").value = empresa.idbanco || "";
        document.querySelector("#agencia").value = empresa.agencia || "";
        document.querySelector("#digitoAgencia").value = empresa.digitoagencia || "";
        document.querySelector("#numeroConta").value = empresa.numeroconta || "";
        document.querySelector("#digitoConta").value = empresa.digitoconta || "";
        document.querySelector("#tipoConta").value = empresa.tipoconta || "";
        document.querySelector("#pix").value = empresa.pix || "";
        empresaOriginal = { ...empresa };
        verificarCertificadoEmpresa(empresa.idempresa, true);

        const novoInput = document.createElement("input");
        novoInput.type = "text";
        novoInput.id = "nmFantasia";
        novoInput.name = "nmFantasia";
        novoInput.required = true;
        novoInput.className = "form";
        novoInput.classList.add("uppercase");
        novoInput.value = empresa.nmfantasia;


        elementoAtual.parentNode.replaceChild(novoInput, elementoAtual);
        adicionarEventoBlurEmpresa();

        const label = document.querySelector('label[for="nmFantasia"]');
        if (label) {
            label.style.display = "block";
            label.textContent = "Nome Fantasia";
        }

        novoInput.addEventListener("blur", async function () {
            if (!this.value.trim()) return;
            await carregarEmpresasNmFantasia(this.value, this);
        });

    } catch (erro) {
        console.error("Erro ao carregar empresa:", erro);
        mostrarErro("Empresa não encontrada", erro.message || "Nenhuma empresa com esse nome foi encontrada.");
        limparEmpresaOriginal();
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

// Se o backend acusar conflito de sigla de certificado (duas empresas dando
// a mesma sigla derivada do nome fantasia), pede uma sigla alternativa pro
// usuário e tenta salvar de novo com ela — em vez de obrigar a renomear a
// empresa só por causa de uma coincidência técnica no nome fantasia.
async function salvarEmpresaComResolucaoDeSigla(url, metodo, dados) {
    let corpo = dados;
    for (let tentativa = 0; tentativa < 5; tentativa++) {
        try {
            return await fetchComToken(url, {
                method: metodo,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(corpo)
            });
        } catch (erro) {
            if (erro.status !== 409 || !erro.corpo?.precisaSiglaManual) throw erro;

            const { value: novaSigla } = await Swal.fire({
                icon: "warning",
                title: "Sigla de certificado em conflito",
                text: erro.corpo.message,
                input: "text",
                inputLabel: "Digite uma sigla alternativa (até 6 letras/números)",
                inputAttributes: { maxlength: "6", autocapitalize: "characters" },
                showCancelButton: true,
                confirmButtonText: "Tentar salvar",
                cancelButtonText: "Cancelar",
                inputValidator: (valor) => (!valor || !valor.trim()) ? "Digite uma sigla." : undefined,
            });

            if (!novaSigla) return null; // usuário cancelou, não salva

            corpo = { ...corpo, siglaCertificado: novaSigla };
        }
    }
    throw new Error("Não foi possível encontrar uma sigla de certificado disponível.");
}

// A checagem que decide o que mostrar (upload pra master / aviso pros
// demais) é só UX — quem realmente barra é o backend (exigirFlag('master')
// no POST /empresas/:id/certificado). Aqui é só pra não oferecer um Swal de
// upload pra quem nem teria permissão de salvar.
function usuarioTemFlagMaster() {
    // /auth/permissoes remapeia as colunas do banco pra "pode_master" (ver
    // authController.js -> listarPermissoes) — não existe "p.master" no
    // objeto que chega no front. Checa em QUALQUER linha (não só o módulo
    // "Empresas"), igual o exigirFlag('master') faz no backend.
    return Array.isArray(window.permissoes) && window.permissoes.some((p) => p.pode_master === true);
}

// Preenche os campos só-leitura na tela — chamado só quando o formulário
// está de fato mostrando uma empresa (edição carregada), nunca logo após um
// cadastro/salvamento, porque nesses casos o formulário some inteiro
// (limparFormulario) e esses dois campos ficariam "pendente" sozinhos numa
// tela em branco.
function atualizarCamposCertificadoNaTela(status, idempresa) {
    const campoSigla = document.querySelector("#certificadoSigla");
    const campoStatus = document.querySelector("#certificadoStatus");
    const btnInserir = document.querySelector("#btnInserirCertificado");
    if (campoSigla) campoSigla.value = status?.sigla || "";
    if (campoStatus) campoStatus.value = status?.configurado ? "Configurado ✅" : "Pendente ⚠️";

    // Botão só aparece se estiver pendente E o usuário puder de fato inserir
    // (master) — sem ele, quem fechou o Swal sem anexar tinha que sair e
    // entrar de novo na empresa pra ver o Swal aparecer de novo.
    if (btnInserir) {
        const mostrarBotao = Boolean(status) && !status.configurado && usuarioTemFlagMaster();
        btnInserir.style.display = mostrarBotao ? "flex" : "none";
        btnInserir.onclick = mostrarBotao
            ? async () => {
                  await abrirSwalUploadCertificado(idempresa, status.sigla);
                  const statusAtualizado = await fetchComToken(`/empresas/${idempresa}/certificado`);
                  atualizarCamposCertificadoNaTela(statusAtualizado, idempresa);
              }
            : null;
    }
}

// atualizarCampos: true só na tela de edição carregada — no fluxo de
// salvar (criar/editar), o formulário já foi limpo antes desta chamada, então
// não faz sentido preencher esses dois campos ali.
async function verificarCertificadoEmpresa(idempresa, atualizarCampos = false) {
    if (!idempresa) return;
    try {
        const status = await fetchComToken(`/empresas/${idempresa}/certificado`);

        if (atualizarCampos) atualizarCamposCertificadoNaTela(status, idempresa);

        if (status.configurado) return;

        if (usuarioTemFlagMaster()) {
            await abrirSwalUploadCertificado(idempresa, status.sigla);
        } else {
            Swal.fire({
                icon: "info",
                title: "Certificado digital pendente",
                text: "Esta empresa ainda não tem certificado digital (A1) cadastrado para emitir nota fiscal. Solicite ao setor financeiro a inserção do certificado desta empresa.",
                confirmButtonText: "Ok",
            });
        }
    } catch (erro) {
        console.error("Erro ao verificar certificado da empresa:", erro);
    }
}

async function abrirSwalUploadCertificado(idempresa, sigla) {
    const { value: dadosCertificado } = await Swal.fire({
        title: `Cadastrar certificado digital (${sigla})`,
        html: `
            <div style="text-align:left; display:flex; flex-direction:column; gap:14px;">
                <div>
                    <label style="display:block; margin-bottom:6px;">Arquivo do certificado (.pfx ou .p12)</label>
                    <input type="file" id="swalCertArquivo" accept=".pfx,.p12" style="display:none;">
                    <button type="button" id="swalCertBtnAnexar" style="
                        width:100%; box-sizing:border-box; margin:0; padding:14px;
                        display:flex; align-items:center; justify-content:center; gap:8px;
                        border:2px dashed #999; border-radius:8px; background:#f7f7f7;
                        font-size:15px; cursor:pointer; color:#333;">
                        <span id="swalCertNomeArquivo">📎 Clique pra anexar o certificado</span>
                    </button>
                </div>
                <div>
                    <label for="swalCertSenha" style="display:block; margin-bottom:6px;">Senha do certificado</label>
                    <input type="password" id="swalCertSenha" class="swal2-input" placeholder="Senha" style="margin:0; width:100%; box-sizing:border-box;">
                </div>
            </div>
        `,
        confirmButtonText: "Salvar certificado",
        showCancelButton: true,
        cancelButtonText: "Depois",
        focusConfirm: false,
        didOpen: () => {
            const inputArquivo = document.getElementById("swalCertArquivo");
            const btnAnexar = document.getElementById("swalCertBtnAnexar");
            const nomeArquivo = document.getElementById("swalCertNomeArquivo");
            btnAnexar.addEventListener("click", () => inputArquivo.click());
            inputArquivo.addEventListener("change", () => {
                const arquivo = inputArquivo.files[0];
                if (arquivo) {
                    nomeArquivo.textContent = `✅ Arquivo anexado: ${arquivo.name}`;
                    btnAnexar.style.borderStyle = "solid";
                    btnAnexar.style.borderColor = "#28a745";
                    btnAnexar.style.background = "#eaf7ee";
                } else {
                    nomeArquivo.textContent = "📎 Clique pra anexar o certificado";
                    btnAnexar.style.borderStyle = "dashed";
                    btnAnexar.style.borderColor = "#999";
                    btnAnexar.style.background = "#f7f7f7";
                }
            });
        },
        preConfirm: () => {
            const arquivo = document.getElementById("swalCertArquivo").files[0];
            const senha = document.getElementById("swalCertSenha").value;
            if (!arquivo) {
                Swal.showValidationMessage("Selecione o arquivo do certificado.");
                return false;
            }
            if (!senha) {
                Swal.showValidationMessage("Informe a senha do certificado.");
                return false;
            }
            return { arquivo, senha };
        },
    });

    if (!dadosCertificado) return;

    try {
        const formData = new FormData();
        formData.append("arquivo", dadosCertificado.arquivo);
        formData.append("senha", dadosCertificado.senha);
        await fetchComToken(`/empresas/${idempresa}/certificado`, { method: "POST", body: formData });
        atualizarCamposCertificadoNaTela({ sigla, configurado: true }, idempresa);
        await Swal.fire("Certificado salvo!", "O certificado digital dessa empresa já está pronto pra assinar nota fiscal.", "success");
    } catch (erro) {
        Swal.fire("Erro", erro.message || "Erro ao salvar o certificado.", "error");
    }
}


function limparEmpresaOriginal() {  
    empresaOriginal = {
        idEmpresa: "",
        nmFantasia: "",
        razaoSocial: "",
        cnpj: "",
        emailEmpresa: "",
        emailNfe: "",
        site: "",
        telefone: "",
        inscEstadual: "",
        cep: "",
        rua: "",
        endereco: "",
        numero: "",
        complemento: "",
        bairro: "",
        cidade: "",
        estado: "",
        pais: "",
        ativo: "",
        regimeTributario: "",
        inscricaoMunicipal: "",
        idBanco: "",
        agencia: "",
        digitoAgencia: "",
        numeroConta: "",
        digitoConta: "",
        tipoConta: "",
        pix: ""
    };
}

function limparCamposEmpresa(){
    const campos = ["idEmpresa", "nmFantasia", "razaoSocial", "cnpj", "inscEstadual", "emailEmpresa", "emailNfe", "site", "telefone", "cep", "rua", "endereco", "numero", "complemento", "bairro", "cidade", "estado", "pais", "regimeTributario", "inscricaoMunicipal", "idBanco", "agencia", "digitoAgencia", "numeroConta", "digitoConta", "tipoConta", "pix"];
   
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
    const inputCodigo = document.querySelector("#idEmpresa");
  
    if (!inputCodigo) {
        console.warn("Tratamento do 'idEmpresa' para estilizar como demais campos.");
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

function configurarEventosEmpresas() {
    console.log("Configurando eventos para o modal de empresas...");
    carregarEmpresas();
    adicionarEventoBlurEmpresa() ;
}
window.configurarEventosEmpresas = configurarEventosEmpresas;

function configurarEventosEspecificos(modulo) {
  console.log("⚙️ configurarEventosEspecificos recebeu:", modulo);
  if (modulo.trim().toLowerCase() === 'empresas') {
    configurarEventosEmpresas();
    
    if (typeof aplicarPermissoes === "function" && window.permissoes) {
      aplicarPermissoes(window.permissoes);
    } else {
      console.warn("⚠️ aplicarPermissoes ou window.permissoes ainda não estão disponíveis para LocalMontagem.");
    }
  }
}
window.configurarEventosEspecificos = configurarEventosEspecificos;


window.moduloHandlers = window.moduloHandlers || {};
window.moduloHandlers['Empresas'] = { // A chave 'Empresas' deve corresponder ao seu Index.js
    configurar: configurarEventosEmpresas,
    desinicializar: desinicializarEmpresasModal
};