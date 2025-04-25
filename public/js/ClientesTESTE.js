// UTILITÁRIAS

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
        ativo: ""
    };
}

function aplicarMascaras() {
    IMask(document.getElementById('cnpj'), { mask: '00.000.000/0000-00' });
    IMask(document.getElementById('telefone'), { mask: '(00) 0000-0000' });
    IMask(document.getElementById('celContato'), { mask: '(00) 00000-0000' });
    IMask(document.getElementById('cep'), { mask: '00000-000' });
}

document.addEventListener("DOMContentLoaded", () => {
    aplicarMascaras();
    configurarEventosClientes();  // Adicionando a chamada da função aqui
});



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

function preencherFormularioCliente(cliente) {
    const campos = {
        idCliente: "idcliente",
        nmFantasia: "nmfantasia",
        razaoSocial: "razaosocial",
        cnpj: "cnpj",
        inscEstadual: "inscestadual",
        emailCliente: "emailcliente",
        telefone: "telefone",
        cep: "cep",
        rua: "rua",
        numero: "numero",
        complemento: "complemento",
        bairro: "bairro",
        cidade: "cidade",
        estado: "estado",
        pais: "pais",
        nmContato: "nmcontato",
        celContato: "celcontato",
        emailContato: "emailcontato",
        emailNfe: "emailnfe",
        site: "site",
        ativo: "ativo"
    };

    for (let campo in campos) {
        const input = document.querySelector(`#${campo}`);
        if (input) {
            if (campo === "ativo") {
                input.checked = cliente[campos[campo]] === true || cliente[campos[campo]] === "true" || cliente[campos[campo]] === 1;
            } else {
                input.value = cliente[campos[campo]] || "";
            }
        }
    }

    clienteOriginal = { ...cliente };
}

function obterDadosFormulario() {
    const dados = {
        idCliente: document.querySelector("#idCliente").value.trim(),
        nmFantasia: document.querySelector("#nmFantasia").value,
        razaoSocial: document.querySelector("#razaoSocial").value,
        cnpj: document.getElementById("cnpj").value.replace(/\D/g, ''),
        inscEstadual: document.querySelector("#inscEstadual").value,
        emailCliente: document.querySelector("#emailCliente").value,
        emailNfe: document.querySelector("#emailNfe").value,
        nmContato: document.querySelector("#nmContato").value,
        celContato: document.querySelector("#celContato").value.replace(/\D/g, ''),
        emailContato: document.querySelector("#emailContato").value,
        site: document.querySelector("#site").value,
        telefone: document.querySelector("#telefone").value.replace(/\D/g, ''),
        cep: document.querySelector("#cep").value.replace(/\D/g, ''),
        rua: document.querySelector("#rua").value,
        numero: document.querySelector("#numero").value,
        complemento: document.querySelector("#complemento").value,
        bairro: document.querySelector("#bairro").value,
        cidade: document.querySelector("#cidade").value,
        estado: document.querySelector("#estado").value,
        pais: document.querySelector("#pais").value,
        ativo: document.querySelector("#ativo").checked
    };

    return dados;
}

function clienteFoiAlterado(dados) {
    return Object.keys(dados).some(chave => {
        return dados[chave]?.toString().trim() !== (clienteOriginal[chave]?.toString().trim() || "");
    });
}

// EVENTO SUBMIT
 const botaoEnviar = document.querySelector("#Enviar");
botaoEnviar.addEventListener("click", async function (event) {
    event.preventDefault();

    const dados = obterDadosFormulario();

    if (!dados.nmFantasia || !dados.razaoSocial || !dados.cnpj) {
        alert("Preencha todos os campos obrigatórios.");
        return;
    }

    if (!clienteFoiAlterado(dados)) {
        mostrarAlerta();
        return;
    }

    try {
        const url = dados.idCliente
            ? `http://localhost:3000/clientes/${dados.idCliente}`
            : `http://localhost:3000/clientes`;
        const metodo = dados.idCliente ? "PUT" : "POST";

        const response = await fetch(url, {
            method: metodo,
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(dados)
        });

        const result = await response.json();

        if (response.ok) {
            alert(result.mensagem || "Cliente salvo com sucesso!");
            form.reset();
            document.querySelector("#idCliente").value = "";
            limparClienteOriginal();
            clienteExistente = false;
        } else {
            alert(result.erro || "Erro ao salvar o cliente.");
        }
    } catch (error) {
        console.error("Erro ao enviar dados:", error);
        alert("Erro de conexão com o servidor.");
    }
});
function carregarClientes() {
    console.log("Função carregarClientes chamada para configurar o modal de clientes...");
    // Lógica para buscar e exibir lista de clientes, se necessário
}
function configurarEventosClientes() {
    console.log("Configurando eventos para o modal de clientes...");
    carregarClientes(); // Supondo que você tenha uma função carregarClientes para configurar
}

window.configurarEventosClientes = configurarEventosClientes;