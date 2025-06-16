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
        numero: "",
        complemento: "",
        bairro: "",
        cidade: "",
        estado: "",
        pais: "",
        ativo: ""      
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
        ativo: "#ativo"
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

const preencherFormulario = (empresa) => {
    console.log("PREENCHER FORMULARIO", empresa);
    Object.entries(campos).forEach(([key]) => {
        if (key === "telefone") maskTelefone.value = empresa.telefone || '';
        else if (key === "cnpj") maskCNPJ.value = empresa.cnpj || '';
        else if (key === "cep") maskCEP.value = empresa.cep || '';
        else setCampo(key, empresa[key.toLowerCase()]);
    });

    window.empresaOriginal = {
        idEmpresa: empresa.idempresa || "",
        nmFantasia: empresa.nmfantasia || "",
        razaoSocial: empresa.razaosocial || "",
        cnpj: empresa.cnpj || "",   
        emailEmpresa: empresa.emailempresa || "",
        emailNfe: empresa.emailnfe || "",     
        site: empresa.site || "",
        inscEstadual: empresa.inscestadual || "",
        cep: empresa.cep || "",
        rua: empresa.rua || "",
        numero: empresa.numero || "",
        complemento: empresa.complemento || "",
        bairro: empresa.bairro || "",
        cidade: empresa.cidade || "",
        estado: empresa.estado || "",
        pais: empresa.pais || "",
        ativo: empresa.ativo || false
    };

    console.log("Empresa original CarregarEmpresa:", window.empresaOriginal);

    const campoCodigo = getCampo("idEmpresa");
    if (campoCodigo && campoCodigo.value.trim()) {
        campoCodigo.classList.add("has-value");
    }
    campoCodigo.readOnly = true; // bloqueia o campo
};

const limparFormulario = () => {
    form.reset();
    document.querySelector("#idEmpresa").value = "";
    if (typeof limparEmpresaOriginal === "function") limparEmpresaOriginal();
    
    
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
        rua: valor("rua").toUpperCase(),
        numero: valor("numero"),
        complemento: valor("complemento").toUpperCase(),
        bairro: valor("bairro").toUpperCase(),
        cidade: valor("cidade").toUpperCase(),
        estado: valor("estado").toUpperCase(),
        pais: valor("pais").toUpperCase(),
        ativo: getCampo("ativo")?.checked,
       
    };
    console.log("Dados do formulário prontos para envio:", dados);
    return dados;
};


function carregarEmpresas() {
    console.log("Configurando eventos para o modal de empresas");
   
    aplicarMascaras();  

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

            const respostaApi = await fetchComToken(url, {
                method: metodo,
                body: JSON.stringify(dados)
            });            

            await Swal.fire("Sucesso!", respostaApi.message || "Empresa salvo com sucesso.", "success");
            limparFormulario();

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
        document.querySelector("#inscEstadual").value = empresa.inscestadual || "";
        document.querySelector("#emailEmpresa").value = empresa.emailempresa || "";
        document.querySelector("#emailNfe").value = empresa.emailnfe || "";
        document.querySelector("#site").value = empresa.site || "";
        maskTelefone.value = empresa.telefone || '';
        maskCEP.value = empresa.cep || '';
        document.querySelector("#rua").value = empresa.rua || "";
        document.querySelector("#numero").value = empresa.numero || "";
        document.querySelector("#complemento").value = empresa.complemento || "";
        document.querySelector("#bairro").value = empresa.bairro || "";
        document.querySelector("#cidade").value = empresa.cidade || "";
        document.querySelector("#estado").value = empresa.estado || "";
        document.querySelector("#pais").value = empresa.pais || "";
        document.querySelector("#ativo").checked =
            empresa.ativo === true || empresa.ativo === "true" || empresa.ativo === 1;
        empresaOriginal = { ...empresa };

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

    } catch {
        mostrarErro("Empresa não encontrado", "Nenhum empresa com esse nome foi encontrado.");
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
        numero: "",
        complemento: "",
        bairro: "",
        cidade: "",
        estado: "",
        pais: "",
        ativo: ""
    };
}

function limparCamposEmpresa(){
    const campos = ["idEmpresa", "nmFantasia", "razaoSocial", "cnpj", "inscEstadual", "emailEmpresa", "emailNfe", "site", "telefone", "cep", "rua", "numero", "complemento", "bairro", "cidade", "estado", "pais"];  
   
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

async function fetchComToken(url, options = {}) {
  console.log("URL da requisição ORÇAMENTOS:", url);
  const token = localStorage.getItem("token");
  const idempresa = localStorage.getItem("idempresa");

  console.log("ID da empresa no localStorage:", idempresa);
  console.log("Token no localStorage:", token);

  if (!options.headers) options.headers = {};
  
  if (options.body && typeof options.body === 'string' && options.body.startsWith('{')) {
        options.headers['Content-Type'] = 'application/json';
  }else if (options.body && typeof options.body === 'object' && options.headers['Content-Type'] !== 'multipart/form-data') {
       
        options.body = JSON.stringify(options.body);
        options.headers['Content-Type'] = 'application/json';
  }

  options.headers['Authorization'] = 'Bearer ' + token; 

  if (
      idempresa && 
      idempresa !== 'null' && 
      idempresa !== 'undefined' && 
      idempresa.trim() !== '' &&
      !isNaN(idempresa) && 
      Number(idempresa) > 0
  ) {
      options.headers['idempresa'] = idempresa;
      console.log('[fetchComToken] Enviando idempresa no header:', idempresa);
  } else {
    console.warn('[fetchComToken] idempresa inválido, não será enviado no header:', idempresa);
  }
  console.log("URL OPTIONS", url, options)
 
  const resposta = await fetch(url, options);

  console.log("Resposta da requisição:", resposta);

  let responseBody = null;
  try {
      // Primeiro, tente ler como JSON, pois é o mais comum para APIs
      responseBody = await resposta.json();
  } catch (jsonError) {
      // Se falhar (não é JSON, ou resposta vazia, etc.), tente ler como texto
      try {
          responseBody = await resposta.text();
      } catch (textError) {
          // Se nem como texto conseguir, assume que não há corpo lido ou que é inválido
          responseBody = null;
      }
  }

  if (resposta.status === 401) {
    localStorage.clear();
    Swal.fire({
      icon: "warning",
      title: "Sessão expirada",
      text: "Por favor, faça login novamente."
    }).then(() => {
      window.location.href = "login.html"; // ajuste conforme necessário
    });
    //return;
    throw new Error('Sessão expirada'); 
  }

  if (!resposta.ok) {
        // Se a resposta NÃO foi bem-sucedida (status 4xx ou 5xx)
        // Use o responseBody já lido para obter a mensagem de erro
        const errorMessage = (responseBody && responseBody.erro) || (responseBody && responseBody.message) || responseBody || resposta.statusText;
        throw new Error(`Erro na requisição: ${errorMessage}`);
  }

  return responseBody;
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
