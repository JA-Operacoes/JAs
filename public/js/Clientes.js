
if (typeof Swal === "undefined") {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/sweetalert2@11";
    script.onload = () => {
        console.log("SweetAlert2 carregado com sucesso.");
    };
    document.head.appendChild(script);
}

let clienteExistente = false;

let clienteOriginal = {idCliente: "",
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

let maskCNPJ, maskTelefone, maskCelContato, maskCEP;

function aplicarMascaras() {
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
    // const inscEstadualInput = document.querySelector("#inscEstadual");
    // maskInscEstadual = IMask(inscEstadualInput, {
    //     mask: "000.000.000.000"
    // });

}

function carregarClientes() {
    console.log("Configurando eventos para o modal de clientes");
    
    
    aplicarMascaras();  
    //pesquisar cliente pelo nome fantasia
    document.querySelector("#nmFantasia").addEventListener("blur", async function () {
        const nmFantasia = this.value.trim();

        console.log("Campo nome fansasia procurado:", nmFantasia);
    
        if (nmFantasia === "") return;
    
        try {
            
        
            const response = await fetch(`http://localhost:3000/clientes?nmFantasia=${encodeURIComponent(nmFantasia)}`);
            console.log("Response",response);
            
            if (!response.ok) {
                console.log("Nome Fantasia não encontrado.");
                // setTimeout(() => {
                //     //mostrarAlerta();
                //     Swal.fire({
                //         icon: 'warning',
                //         title: 'Cliente não encontrado 1',
                //         text: `Nenhum cliente com o nome fantasia "${nmFantasia}" foi encontrado.`,
                //         confirmButtonText: 'Ok',
                //         customClass: {
                //             popup: 'swal-custom-z'
                //           }
                //     });
                //   }, 50); // 
                
                
                limparClienteOriginal();
                clienteExistente = false;
                return;
            }
    
            const cliente = await response.json();

            if (!cliente || Object.keys(cliente).length === 0) {
                console.log("Cliente não encontrado no corpo da resposta.");
                // setTimeout(() => {
                //     Swal.fire({
                //         icon: 'warning',
                //         title: 'Cliente não encontrado',
                //         text: `Nenhum cliente com o nome fantasia "${nmFantasia}" foi encontrado.`,
                //         confirmButtonText: 'Ok',
                //         customClass: {
                //             popup: 'swal2-center-button'
                //         }
                //     });
                //  }, 50); //
                limparClienteOriginal();
                clienteExistente = false;
                return;
            }
            else{
                clienteExistente = true; // Define que o cliente existe 
            }
            
            console.log("Nome Fantasia encontrado:", cliente);
            console.log("Campos encontrados:", {
                idCliente: document.querySelector("#idCliente"),
                nmFantasia: document.querySelector("#nmFantasia"),
                razaoSocial: document.querySelector("#razaoSocial"),
                cnpj: document.querySelector("#cnpj"),
                emailCliente: document.querySelector("#email"),
                emailNfe: document.querySelector("#emailNFE"),
                site: document.querySelector("#site"),
                inscEstadual: document.querySelector("#inscEstadual"),
                ativo: document.querySelector("#ativo"),
                nmContato: document.querySelector("#nmContato"),
                celContato: document.querySelector("#celContato"),
                emailContato: document.querySelector("#emailContato"),
                telefone: document.querySelector("#telefone"),
                cep: document.querySelector("#cep"),
                rua: document.querySelector("#rua"),
                numero: document.querySelector("#numero"),
                complemento: document.querySelector("#complemento"),
                bairro: document.querySelector("#bairro"),
                cidade: document.querySelector("#cidade"),
                estado: document.querySelector("#estado"),
                pais: document.querySelector("#pais"),
                tpcliente: document.querySelector("#tpcliente")
           
            });
            
            
            if (clienteExistente) {
                 
                // Preenche os campos com os dados retornados
                
                document.querySelector("#idCliente").value = cliente.idcliente; // se existir o campo
                document.querySelector("#nmFantasia").value = cliente.nmfantasia;
                document.querySelector("#razaoSocial").value = cliente.razaosocial;
            // document.querySelector("#cnpj").value = cliente.cnpj;
                
                maskCNPJ.value = cliente.cnpj || '';
                
                        
                document.querySelector("#inscEstadual").value = cliente.inscestadual;
                document.querySelector("#emailCliente").value = cliente.emailcliente;
                //document.querySelector("#telefone").value = cliente.telefone;
                maskTelefone.value = cliente.telefone || '';

                //document.querySelector("#cep").value = cliente.cep;
                maskCEP.value = cliente.cep || '';
                
                document.querySelector("#rua").value = cliente.rua;
                document.querySelector("#numero").value = cliente.numero;
                document.querySelector("#complemento").value = cliente.complemento;
                document.querySelector("#bairro").value = cliente.bairro;
                document.querySelector("#cidade").value = cliente.cidade;
                document.querySelector("#estado").value = cliente.estado;
                document.querySelector("#pais").value = cliente.pais;
            
                document.querySelector("#nmContato").value = cliente.nmcontato;
                //document.querySelector("#celContato").value = cliente.celcontato;
                maskCelContato.value = cliente.celcontato || '';
                document.querySelector("#emailContato").value = cliente.emailcontato;
            
                document.querySelector("#emailNfe").value = cliente.emailnfe;
                document.querySelector("#site").value = cliente.site;
                document.querySelector("#ativo").checked = cliente.ativo === true || cliente.ativo === "true" || cliente.ativo === 1;
                document.querySelector("#tpcliente").value = cliente.tpcliente;

                clienteOriginal = {
                    idCliente: cliente.idcliente,
                    nmFantasia: cliente.nmfantasia,
                    razaoSocial: cliente.razaosocial,
                    cnpj: cliente.cnpj,
                    inscEstadual: cliente.inscestadual,
                    emailCliente: cliente.emailcliente,
                    emailNfe: cliente.emailNfe,
                    telefone: cliente.telefone,
                    nmContato: cliente.nmcontato,
                    celContato: cliente.celcontato,
                    emailContato: cliente.emailcontato,
                    
                    site: cliente.site,
                    
                    cep: cliente.cep,
                    rua: cliente.rua,
                    numero: cliente.numero,
                    complemento: cliente.complemento,
                    bairro: cliente.bairro,
                    cidade: cliente.cidade,
                    estado: cliente.estado,
                    pais: cliente.pais,
                    ativo: cliente.ativo,
                    tpcliente: cliente.tpcliente
                    
                };
        
                console.log("Cliente encontrado e preenchido:", cliente);
            }
            else{
                console.log("Cliente não encontrado.");
                limparClienteOriginal(); // Limpa os dados do cliente original se não encontrado
                clienteExistente = false; // Reseta o estado do cliente existente
            }
        } catch (error) {
            console.error("Erro ao buscar cliente:", error);
        }
    });
   
    
    const botaoEnviar = document.querySelector("#Enviar");
    
    if (!botaoEnviar) {
        console.error("Botão Enviar não encontrado no DOM.");
        return;
    }
   
    const form = document.querySelector("#form");

    if (!botaoEnviar) {
        console.error("Botão não encontrado no DOM.");
        return;
    }
    if (!form) {
        console.error("Formulário encontrado no DOM.");
        return;
    }

    console.log("Botão Enviar encontrado:", botaoEnviar);
    console.log("Formulário encontrado:", form);
    botaoEnviar.addEventListener("click", async function (event) {
        event.preventDefault(); // Previne o envio padrão do formulário

        console.log("ENVIANDO DADOS DO cliente PELO cliente.JS", document);

        // Obtenha os dados do formulário        
        const idCliente = document.querySelector("#idCliente").value.trim();
        const nmFantasia = document.querySelector("#nmFantasia").value;
        const razaoSocial = document.querySelector("#razaoSocial").value;
        // const cnpj = document.querySelector("#cnpj").value;
        const cnpj = document.getElementById('cnpj').value.replace(/\D/g, '');

        const inscEstadual = document.querySelector("#inscEstadual").value.replace(/\D/g, '');
        const emailCliente = document.querySelector("#emailCliente").value;
        const emailNfe = document.querySelector("#emailNfe").value;
        const nmContato = document.querySelector("#nmContato").value.replace(/\D/g, '');
        const celContato = document.querySelector("#celContato").value.replace(/\D/g, '');
        const emailContato = document.querySelector("#emailContato").value;
        const site = document.querySelector("#site").value;
        const telefone = document.querySelector("#telefone").value.replace(/\D/g, '');
        const cep = document.querySelector("#cep").value.replace(/\D/g, '');
        const rua = document.querySelector("#rua").value;
        const numero = document.querySelector("#numero").value;
        const complemento = document.querySelector("#complemento").value;
        const bairro = document.querySelector("#bairro").value;
        const cidade = document.querySelector("#cidade").value;
        const estado = document.querySelector("#estado").value;
        const pais = document.querySelector("#pais").value;
        const ativo = document.querySelector("#ativo").checked;
        const tpcliente = document.querySelector("#tpcliente").value;
       
        const dados = { nmFantasia, razaoSocial, cnpj, inscEstadual, emailCliente, emailNfe, site, telefone, nmContato, celContato, emailContato, cep, rua, numero, complemento, bairro, cidade, estado, pais, ativo, tpcliente};
        
        console.log("enviando", dados);
        
        if (!nmFantasia || !razaoSocial || !cnpj) {
            alert("Preencha todos os campos.");
            return;
        }
    
        // 🔍 Comparar com os valores originais
        if (
            idCliente === clienteOriginal.idCliente?.toString() &&           
            nmFantasia.trim() === clienteOriginal.nmFantasia.trim() &&
            razaoSocial === clienteOriginal.razaoSocial &&
            cnpj === clienteOriginal.cnpj &&
            inscEstadual === clienteOriginal.inscEstadual &&
            emailCliente === clienteOriginal.emailCliente &&
            emailNfe === clienteOriginal.emailNfe &&
            site === clienteOriginal.site &&
            telefone  === clienteOriginal.telefone &&
            nmContato === clienteOriginal.nmContato &&
            celContato === clienteOriginal.celContato &&
            emailContato === clienteOriginal.emailContato &&
            cep === clienteOriginal.cep &&
            rua === clienteOriginal.rua &&
            numero === clienteOriginal.numero &&
            complemento === clienteOriginal.complemento &&
            bairro === clienteOriginal.bairro &&
            cidade === clienteOriginal.cidade &&
            estado === clienteOriginal.estado &&
            pais === clienteOriginal.pais &&
            ativo === clienteOriginal.ativo &&
            tpcliente === clienteOriginal.tpcliente
           
        ) {
            //  alert("Nenhuma alteração detectada.");
            // Swal.fire({
            //     icon: 'info', // info | success | warning | error | question
            //     title: 'Nada foi alterado!',
            //     text: 'Faça alguma alteração antes de salvar.',
            //     confirmButtonText: 'Entendi'
            // });
            mostrarAlerta();
             
            console.log("Nenhuma alteração detectada.");
            return;
        }
    
       
    
        try {
            let response;
    
            if (idCliente) {
                response = await fetch(`http://localhost:3000/clientes/${idCliente}`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(dados)
                });
            } else {
                console.log("Salvando novo cliente...CLIENTES.JS");
                response = await fetch("http://localhost:3000/clientes", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(dados)
                });
            }
    
            const result = await response.json();
    
            if (response.ok) {
                alert(result.mensagem || "Operação realizada com sucesso!");
                form.reset();
                document.querySelector("#idCliente").value = "";

                limparClienteOriginal(); // Limpa os dados do cliente original após salvar
                clienteExistente = false; // Reseta o estado do cliente existente
    
               
            } else {
                alert(result.erro || "Erro ao salvar o cliente.");
            }
    
        } catch (error) {
            console.error("Erro ao enviar dados:", error);
            alert("Erro de conexão com o servidor.");
        }
    });
    const btnLimpar = document.getElementById("Limpar");

    if (btnLimpar) {
        btnLimpar.addEventListener("click", () => {
        form.reset();
        document.querySelector("#idCliente").value = "";
        clienteExistente = false;

        // Se você tiver uma função para limpar estados extras, chame aqui:
        if (typeof limparClienteOriginal === "function") {
            limparClienteOriginal();
        }

        console.log("Formulário limpo com sucesso!");
        });
    }

    const btnPesquisar = document.getElementById("Pesquisar");
    btnPesquisar.addEventListener("click", async function (event) {
        event.preventDefault();
       
        limparCamposCliente();

        console.log("Pesquisando Clientes...");
        try {
            const response = await fetch("http://localhost:3000/Clientes");
            
            if (!response.ok) throw new Error("Erro ao buscar clientes");
    
            const clientes = await response.json();
            console.log("Clientes encontrados:", clientes);

            const input = document.querySelector("#nmFantasia");
            
            const select = criarSelectClientes(clientes);
            
            input.parentNode.replaceChild(select, input);
    
            select.addEventListener("change", async function () {
                console.log("Cliente selecionado antes de carregarClientes:", this.value);
                const desc = this.value?.trim(); // Protegendo contra undefined

                if (!desc) {
                    console.warn("Valor do select está vazio ou indefinido.");
                    return;
                }

                console.log("Selecionado:", desc);

                await carregarClientesNmFantasia(desc, this);
                console.log("Cliente selecionado:", this.value);
            });
                
            } catch (error) {
                console.error("Erro ao carregar clientes:", error);
                mostrarErro("Erro", "Não foi possível carregar as clientes.");
            }});
    // Adicione aqui outros eventos ou configurações necessárias para o modal de clientes
  
}


function estiloCampo(elemento) {
    Object.assign(elemento.style, {
        fontFamily: "Abel, sans-serif",
        width: "100%",
        display: "flex",
        justifyContent: "center",
        padding: "5px 10px",
        margin: "5px 10px",
        fontSize: "17px",
        border: "1px solid #000",
        borderRadius: "8px",
        flex: "1",
        maxWidth: "100%"
    });
}

function criarSelectClientes(clientes) {
    const select = document.createElement("select");
    select.id = "nmFantasia";
    select.name = "nmFantasia";
    select.required = true;
    select.className = "form";

    estiloCampo(select);

    const defaultOption = document.createElement("option");
    defaultOption.text = "Selecione um cliente...";
    defaultOption.disabled = true;
    defaultOption.selected = true;
    defaultOption.value = "";
    select.appendChild(defaultOption);

    console.log("Clientes encontrados no CriarSelects:", clientes);

    clientes.forEach(clientes => {
        const option = document.createElement("option");
        option.value = clientes.nmfantasia;
        option.text = clientes.nmfantasia;
        select.appendChild(option);
    });
    


    return select;
}

async function carregarClientesNmFantasia(desc, elementoAtual) {
    try {
        const response = await fetch(`http://localhost:3000/clientes?nmFantasia=${encodeURIComponent(desc.trim())}`);
        if (!response.ok) throw new Error();
        console.log("Response carregarClientesNmFantasia",response);
        const cliente = await response.json();
       
        console.log("Cliente encontrado:", cliente);

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
        // Atualiza o cliente original para comparação futura
        clienteOriginal = {
            idCliente: cliente.idcliente,
            nmFantasia: cliente.nmfantasia,
            razaoSocial: cliente.razaosocial,
            cnpj: cliente.cnpj,
            inscEstadual: cliente.inscestadual,
            emailCliente: cliente.emailcliente,
            emailNfe: cliente.emailnfe,
            telefone: cliente.telefone,
            nmContato: cliente.nmcontato,
            celContato: cliente.celcontato,
            emailContato: cliente.emailcontato,
            site: cliente.site,
            cep: cliente.cep,
            rua: cliente.rua,
            numero: cliente.numero,
            complemento: cliente.complemento,
            bairro: cliente.bairro,
            cidade: cliente.cidade,
            estado: cliente.estado,
            pais: cliente.pais,
            ativo: cliente.ativo,
            tpcliente: cliente.tpcliente
        };
        clienteExistente = true; // Define que o cliente existe


        const novoInput = document.createElement("input");
        novoInput.type = "text";
        novoInput.id = "nmFantasia";
        novoInput.name = "nmFantasia";
        novoInput.required = true;
        novoInput.className = "form";
        novoInput.value = cliente.nmfantasia;

        estiloCampo(novoInput);
        elementoAtual.parentNode.replaceChild(novoInput, elementoAtual);

        novoInput.addEventListener("blur", async function () {
            if (!this.value.trim()) return;
            await carregarClientesNmFantasia(this.value, this);
        });

    } catch {
        mostrarErro("Função não encontrada", "Nenhuma função com essa descrição foi encontrada.");
        limparClienteOriginal();
        ClienteExistente = false;
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

function mostrarAlerta() {
    Swal.fire({
        icon: 'info',
        title: 'Nada foi alterado!',
        text: 'Faça alguma alteração antes de salvar.',
        confirmButtonText: 'Entendi',
        customClass: {
            popup: 'swal-custom-z'
          }
    });
}
function configurarEventosClientes() {
    console.log("Configurando eventos para o modal de clientes...");
    carregarClientes();
}
window.configurarEventosClientes = configurarEventosClientes;
