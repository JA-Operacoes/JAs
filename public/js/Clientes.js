
if (typeof window.clienteOriginal === "undefined") {
    window.clienteOriginal = {
        idCliente: "",
        nmFantasia: "",
        razaoSocial: "",
        cnpj: "",
        nmContato: "",
        celContato: "",
        emailCliente: "",
        emailNfe: "",
        emailContato: "",
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
        ativo: "",
        tpcliente: ""
    };
}


let maskCNPJ, maskTelefone, maskCelContato, maskCEP;


function aplicarMascaras() {
    console.log("Aplicando máscaras aos campos de entrada...");
    maskCNPJ = IMask(document.querySelector("#cnpj"), {
        mask: "00.000.000/0000-00"
    });

    maskTelefone = IMask(document.querySelector("#telefone"), {
        mask: "(00) 0000-0000" // ou "(00) 00000-0000" dependendo do padrão
    });

    maskCelContato = IMask(document.querySelector("#celContato"), {
        mask: "(00) 00000-0000"
    });

    maskCEP = IMask(document.querySelector("#cep"), {
        mask: "00000-000"
    });
    

}

function carregarClientes() {
    console.log("Configurando eventos para o modal de clientes");
    
    
    aplicarMascaras();  


    const tpClienteInput = document.getElementById('tpcliente');
    if(tpClienteInput){
        tpClienteInput.addEventListener('input', function(event) {
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
    //pesquisar cliente pelo nome fantasia
    const form = document.querySelector("#form");
    const botaoEnviar = document.querySelector("#Enviar");
    const btnLimpar = document.getElementById("Limpar");
    const btnPesquisar = document.getElementById("Pesquisar");

    if (!form || !botaoEnviar) {
        console.error("Formulário ou botão Enviar não encontrado.");
        return;
    }

    const campos = {
        idCliente: "#idCliente",
        nmFantasia: "#nmFantasia",
        razaoSocial: "#razaoSocial",
        cnpj: "#cnpj",
        inscEstadual: "#inscEstadual",
        emailCliente: "#emailCliente",
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
        nmContato: "#nmContato",
        celContato: "#celContato",
        emailContato: "#emailContato",
        ativo: "#ativo",
        tpcliente: "#tpcliente"
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

    const preencherFormulario = (cliente) => {
        Object.entries(campos).forEach(([key]) => {
            if (key === "telefone") maskTelefone.value = cliente.telefone || '';
            else if (key === "cnpj") maskCNPJ.value = cliente.cnpj || '';
            else if (key === "cep") maskCEP.value = cliente.cep || '';
            else if (key === "celContato") maskCelContato.value = cliente.celcontato || '';
            else setCampo(key, cliente[key.toLowerCase()]);
        });

        window.clienteOriginal = {
            idCliente: cliente.idcliente || "",
            nmFantasia: cliente.nmfantasia || "",
            razaoSocial: cliente.razaosocial || "",
            cnpj: cliente.cnpj || "",
            nmContato: cliente.nmcontato || "",
            celContato: cliente.celcontato || "",
            emailCliente: cliente.emailcliente || "",
            emailNfe: cliente.emailnfe || "",
            emailContato: cliente.emailcontato || "",
            site: cliente.site || "",
            inscEstadual: cliente.inscestadual || "",
            cep: cliente.cep || "",
            rua: cliente.rua || "",
            numero: cliente.numero || "",
            complemento: cliente.complemento || "",
            bairro: cliente.bairro || "",
            cidade: cliente.cidade || "",
            estado: cliente.estado || "",
            pais: cliente.pais || "",
            ativo: cliente.ativo || false,
            tpcliente: cliente.tpcliente || ""
        };

       console.log("Cliente original CarregarCliente:", window.clienteOriginal);

        const campoCodigo = getCampo("idCliente");
        if (campoCodigo && campoCodigo.value.trim()) {
            campoCodigo.classList.add("has-value");
        }
        campoCodigo.readOnly = true; // bloqueia o campo
    };

    const limparFormulario = () => {
        form.reset();
        document.querySelector("#idCliente").value = "";
        if (typeof limparClienteOriginal === "function") limparClienteOriginal();
    };

    const obterDadosFormulario = () => {
        const valor = (key) => getCampo(key)?.value?.trim() || "";
        const rawIE = valor("inscEstadual");
        const inscEstadual = rawIE.toUpperCase() === "ISENTO" ? "ISENTO" : rawIE.replace(/\D/g, '');  // só números
        return {
            nmFantasia: valor("nmFantasia").toUpperCase(),
            razaoSocial: valor("razaoSocial").toUpperCase(),
            cnpj: valor("cnpj").replace(/\D/g, ''),
            inscEstadual,
            emailCliente: valor("emailCliente"),
            emailNfe: valor("emailNfe"),
            site: valor("site"),
            telefone: valor("telefone").replace(/\D/g, ''),
            nmContato: valor("nmContato").toUpperCase(),
            celContato: valor("celContato").replace(/\D/g, ''),
            emailContato: valor("emailContato"),
            cep: valor("cep").replace(/\D/g, ''),
            rua: valor("rua").toUpperCase(),
            numero: valor("numero"),
            complemento: valor("complemento").toUpperCase(),
            bairro: valor("bairro").toUpperCase(),
            cidade: valor("cidade").toUpperCase(),
            estado: valor("estado").toUpperCase(),
            pais: valor("pais").toUpperCase(),
            ativo: getCampo("ativo")?.checked,
            tpcliente: valor("tpcliente").toUpperCase()
        };
    };

    // Event: Preencher campos ao sair do campo Nome Fantasia
    getCampo("nmFantasia").addEventListener("blur", async function () {
        const nmFantasia = this.value.trim();
        if (!nmFantasia) return;

        try {
            const response = await fetchComToken(`/clientes?nmFantasia=${encodeURIComponent(nmFantasia)}`);
            if (!response.ok) throw new Error("Cliente não encontrado");

            const cliente = await response.json();
            console.log("Cliente encontrado:", cliente);

            if (!cliente || Object.keys(cliente).length === 0)
                throw new Error("Dados de cliente vazios");

            preencherFormulario(cliente);
            console.log("Cliente carregado:", cliente);

        } catch (error) {
            console.log("Erro ao buscar cliente:", nmFantasia, idCliente.value, error);

            //  Se cliente não existe e ainda não tem ID preenchido
            if (!idCliente.value) {
                const podeCadastrar = temPermissao("Clientes", "cadastrar");

                // Só pergunta se deseja cadastrar se tiver permissão
                if (podeCadastrar) {
                    const { isConfirmed } = await Swal.fire({
                        icon: 'question',
                        title: `Deseja cadastrar "${nmFantasia.toUpperCase()}" como novo Cliente?`,
                        text: `Cliente "${nmFantasia.toUpperCase()}" não encontrado`,
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
                        title: "Cliente não encontrado",
                        text: `Você não tem permissão para cadastrar um novo cliente.`,
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


    botaoEnviar.addEventListener("click", async (e) => {
    e.preventDefault();
        console.log("Entrou no botão Enviar");
        const dados = obterDadosFormulario();
        const valorIdCliente = document.querySelector("#idCliente").value.trim();

        const temPermissaoCadastrar = temPermissao("Clientes", "cadastrar");
        const temPermissaoAlterar = temPermissao("Clientes", "alterar");

        const metodo = valorIdCliente ? "PUT" : "POST";

        // Bloqueia tentativa de cadastro se não tem permissão
        if (!valorIdCliente && !temPermissaoCadastrar) {
            return Swal.fire({
                    icon: "info",
                    title: "Cliente não cadastrado",
                    text: "Você não tem permissão para cadastrar Clientes.",
                    confirmButtonText: "OK"
                });
        }

        // Bloqueia tentativa de edição se não tem permissão
        if (valorIdCliente && !temPermissaoAlterar) {
            return wal.fire({
                    icon: "info",
                    title: "Acesso negado",
                    text: "Você não tem permissão para alterar Clientes.",
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

        const url = valorIdCliente
            ? `/clientes/${valorIdCliente}`
            : "/clientes";

        try {
            if (metodo === "PUT") {
                const { isConfirmed } = await Swal.fire({
                    title: "Deseja salvar as alterações?",
                    text: "Você está prestes a atualizar os dados do cliente.",
                    icon: "question",
                    showCancelButton: true,
                    confirmButtonText: "Sim, salvar",
                    cancelButtonText: "Cancelar",
                    reverseButtons: true,
                    focusCancel: true
                });
                if (!isConfirmed) return;
            }

            const res = await fetchComToken(url, {
                method: metodo,
                body: JSON.stringify(dados)
            });

            const texto = await res.text();
            let json;
            try {
                json = JSON.parse(texto);
            } catch (e) {
                throw new Error("Resposta não é um JSON válido: " + texto);
            }

            if (!res.ok) throw new Error(json.erro || json.message || "Erro ao salvar cliente");

            await Swal.fire("Sucesso!", json.message || "Cliente salvo com sucesso.", "success");
            limparFormulario();

        } catch (error) {
            console.error("Erro ao enviar dados:", error);
            Swal.fire("Erro", error.message || "Erro ao salvar cliente.", "error");
        }
    });



    // Event: Limpar formulário
    if (btnLimpar) {
        console.log("Entrou no botão limpar");
        btnLimpar.addEventListener("click", limparFormulario);
    }

       
     if (btnPesquisar) {
        console.log("Entrou no botão pesquisar antes do click");
        btnPesquisar.addEventListener("click", async (event) => {
            event.preventDefault();
            console.log("ENTROU NO BOTÃO PESQUISAR DEPOIS DO CLICK");

            limparFormulario();
            try {
                const response = await fetchComToken("/clientes");
                if (!response.ok) throw new Error("Erro ao buscar clientes");

                const clientes = await response.json();
                const input = getCampo("nmFantasia");

                const select = criarSelectClientes(clientes);
                if (input && input.parentNode) {
                    input.parentNode.replaceChild(select, input);
                }

                const label = document.querySelector('label[for="nmFantasia"]');
                if (label) label.style.display = "none";

                select.addEventListener("change", async function () {
                    const desc = this.value?.trim();
                    if (!desc) return;

                    await carregarClientesNmFantasia(desc, this);
                    console.log("Cliente selecionado:", desc);
                });

            } catch (error) {
                console.error("Erro ao carregar clientes:", error);
                mostrarErro("Erro", "Não foi possível carregar os clientes.");
            }
        });
    }
    
 }



  /**
 * Retorna true se houver alguma diferença entre os dados atuais e clienteOriginal.
 * @param {Object} dados - objeto com as propriedades e valores do formulário.
 */

  
function houveAlteracao(dados) {
    if (!window.clienteOriginal) return true;

    return Object.keys(dados).some(key => {
        const original = window.clienteOriginal[key];
        const atual = dados[key];
        return String(original ?? "").trim() !== String(atual ?? "").trim();
    });
}


function criarSelectClientes(clientes) {
    const select = document.createElement("select");
    select.id = "nmFantasia";
    select.name = "nmFantasia";
    select.required = true;
    select.className = "form";

    const defaultOption = document.createElement("option");
    
    defaultOption.text = "Selecione um cliente...";
    defaultOption.disabled = true;
    defaultOption.selected = true;
    defaultOption.value = "";
    select.appendChild(defaultOption);

    console.log("Clientes encontrados no CriarSelects:", clientes);

    clientes.forEach(clientesachados => {
        const option = document.createElement("option");
        option.value = clientesachados.nmfantasia;
        option.text = clientesachados.nmfantasia;
        select.appendChild(option);
    });
    
    return select;
}

async function carregarClientesNmFantasia(desc, elementoAtual) {
    try {
        const response = await fetchComToken(`/clientes?nmFantasia=${encodeURIComponent(desc.trim())}`);
        if (!response.ok) throw new Error();

        console.log("Response carregarClientesNmFantasia", response);
        const cliente = await response.json();
        console.log("Cliente encontrado:", cliente);

        // Preencher os campos...
        document.querySelector("#idCliente").value = cliente.idcliente || "";
        document.querySelector("#nmFantasia").value = cliente.nmfantasia || "";
        document.querySelector("#razaoSocial").value = cliente.razaosocial || "";
        maskCNPJ.value = cliente.cnpj || '';
        document.querySelector("#inscEstadual").value = cliente.inscestadual || "";
        document.querySelector("#emailCliente").value = cliente.emailcliente || "";
        document.querySelector("#emailNfe").value = cliente.emailnfe || "";
        document.querySelector("#site").value = cliente.site || "";
        maskTelefone.value = cliente.telefone || '';
        maskCelContato.value = cliente.celcontato || '';
        document.querySelector("#nmContato").value = cliente.nmcontato || "";
        document.querySelector("#emailContato").value = cliente.emailcontato || "";
        maskCEP.value = cliente.cep || '';
        document.querySelector("#rua").value = cliente.rua || "";
        document.querySelector("#numero").value = cliente.numero || "";
        document.querySelector("#complemento").value = cliente.complemento || "";
        document.querySelector("#bairro").value = cliente.bairro || "";
        document.querySelector("#cidade").value = cliente.cidade || "";
        document.querySelector("#estado").value = cliente.estado || "";
        document.querySelector("#pais").value = cliente.pais || "";
        document.querySelector("#ativo").checked =
            cliente.ativo === true || cliente.ativo === "true" || cliente.ativo === 1;
        document.querySelector("#tpcliente").value = cliente.tpcliente || "";

        clienteOriginal = { ...cliente };

        const novoInput = document.createElement("input");
        novoInput.type = "text";
        novoInput.id = "nmFantasia";
        novoInput.name = "nmFantasia";
        novoInput.required = true;
        novoInput.className = "form";
        novoInput.value = cliente.nmfantasia;

        elementoAtual.parentNode.replaceChild(novoInput, elementoAtual);

        const label = document.querySelector('label[for="nmFantasia"]');
        if (label) {
            label.style.display = "block";
            label.textContent = "Nome Fantasia";
        }

        novoInput.addEventListener("blur", async function () {
            if (!this.value.trim()) return;
            await carregarFuncaoDescricao(this.value, this);
        });

    } catch {
        mostrarErro("Cliente não encontrado", "Nenhuma função com essa descrição foi encontrada.");
        limparClienteOriginal();
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


function limparClienteOriginal() {  
    clienteOriginal = {
        idCliente: "",
        nmFantasia: "",
        razaoSocial: "",
        cnpj: "",
        nmContato: "",
        celContato: "",
        emailContato: "",
        emailCliente: "",
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
        ativo: "",
        tpcliente: ""
    };
}

function limparCamposCliente(){
    const campos = ["idCliente", "nmFantasia", "razaoSocial", "cnpj", "inscEstadual", "emailCliente", "emailNfe", "site", "telefone", "nmContato", "celContato", "emailContato", "cep", "rua", "numero", "complemento", "bairro", "cidade", "estado", "pais", "tpcliente"];  
   
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
        input.value = "Nome Fantasia";  // Exibe o nome fantasia por padrão
        input.required = true;
        campoNomeFantasia.parentNode.replaceChild(input, campoNomeFantasia);
    }
}


function fetchComToken(url, options = {}) {
  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("fetchComToken: nenhum token encontrado. Faça login primeiro.");
  }

  // Monta os headers sempre incluindo Authorization
  const headers = {
    "Authorization": `Bearer ${token}`,
    // só coloca Content-Type se houver body (POST/PUT)
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...options.headers
  };

  return fetch(url, {
    ...options,
    headers,
    // caso seu back-end esteja em outro host e precisa de CORS:
    //mode: "cors",
    // se precisar enviar cookies de sessão:
    credentials: "include"
  });
}


function configurarEventosClientes() {
    console.log("Configurando eventos para o modal de clientes...");
    carregarClientes();
}
window.configurarEventosClientes = configurarEventosClientes;

document.addEventListener('DOMContentLoaded', () => {
    const inputCodigo = document.querySelector("#idCliente");
  
    if (!inputCodigo) {
        console.warn("Tratamento do 'idCliente' para estilizar como demais campos.");
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

function configurarEventosEspecificos(modulo) {
  console.log("⚙️ configurarEventosEspecificos recebeu:", modulo);
  if (modulo.trim().toLowerCase() === 'clientes') {
    configurarEventosClientes();
  }
}
window.configurarEventosEspecificos = configurarEventosEspecificos;