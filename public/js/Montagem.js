// if (typeof Swal === "undefined") {
//     const script = document.createElement("script");
//     script.src = "https://cdn.jsdelivr.net/npm/sweetalert2@11";
//     script.onload = () => {
//         console.log("SweetAlert2 carregado com sucesso.");
//     };
//     document.head.appendChild(script);
// }

let MontagemExistente = false;
let MontagemOriginal = {
    idMontagem: "",
    descMontagem: "",
    vlrCusto: "",
    vlrVenda: ""
};

function verificaMontagem() {

    console.log("Carregando Montagem...");
    
    document.querySelector("#descMontagem").addEventListener("blur", async function () {
        const desc = this.value.trim();

        console.log("Campo descMontagem procurado:", desc);
    
        if (desc === "") return;
    
        try {
            const response = await fetch(`http://localhost:3000/localmontagem?descMontagem=${encodeURIComponent(desc)}`);

            
            if (!response.ok) {
                console.log("Montagem não encontrado.");
                limparMontagemOriginal();
                MontagemExistente = false;
                return;
            }
    
            const Montagem = await response.json();

            if (!Montagem || Object.keys(Montagem).length === 0) {
                console.log("Cliente não encontrado no corpo da resposta.");
                Swal.fire({
                    icon: 'warning',
                    title: 'Montagem não encontrado',
                    text: `Nenhuma montagem com descrição "${descMontagem}" foi encontrado.`,
                    confirmButtonText: 'Ok'
                });
                limparMontagemOriginal();
                MontagemExistente = false;
                return;
            }
            else{
                MontagemExistente = true; // Define que o cliente existe 
            }
            
            if (MontagemExistente){

                console.log("Montagem encontrado:", Montagem);
                console.log("Campos encontrados:", {
                    idMontagem: document.querySelector("#idMontagem"),
                    Cidade: document.querySelector("#cidadeMontagem"),
                    Uf: document.querySelector("#ufMontagem")
                });

                // Preenche os campos com os dados retornados
                document.querySelector("#idMontagem").value = Montagem.idmontagem; // se existir o campo
                document.querySelector("#cidadeMontagem").value = Montagem.cidademontagem;
                document.querySelector("#ufMontagem").value = Montagem.ufmontagem;
                
                MontagemOriginal = {
                    idMontagem: Montagem.idmontagem,
                    descMontagem: Montagem.descmontagem,
                    cidademontagem: Montagem.cidademontagem,
                    ufmontagem: Montagem.ufmontagem
                };
        
                console.log("Montagem encontrado e preenchido:", Montagem);
            }
        } catch (error) {
            console.error("Erro ao buscar Montagem:", error);
        }
    });

    const botaoEnviar = document.querySelector("#Enviar");
    const botaoPesquisar = document.querySelector("#Pesquisar");
    const form = document.querySelector("#form");

    if (!botaoEnviar || !form) {
        console.error("Formulário ou botão não encontrado no DOM.");
        return;
    }

    botaoEnviar.addEventListener("click", async function (event) {
        event.preventDefault(); // Previne o envio padrão do formulário

        console.log("ENVIANDO DADOS DO Montagem PELO Montagem.JS", document);

        const idMontagem = document.querySelector("#idMontagem").value.trim();
        const descMontagem = document.querySelector("#descMontagem").value.trim();
        const cidadeMontagem = document.querySelector("#cidadeMontagem").value.trim();
        const ufMontagem = document.querySelector("#ufMontagem").value.trim();

        
    
        if (!descMontagem || !cidadeMontagem || !ufMontagem) {
            alert("Preencha todos os campos.");
            return;
        }
    
        // 🔍 Comparar com os valores originais
        if (
            idMontagem === MontagemOriginal.idmontagem &&
            descMontagem === MontagemOriginal.descmontagem &&
            cidadeMontagem === MontagemOriginal.cidademontagem &&
            ufMontagemvenda === MontagemOriginal.ufmontagem
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
    
        const dados = { descMontagem, cidadeMontagem, ufMontagem };
     
        
    
        try {
            let response;
            console.log("idMontagem", idMontagem);
            if (idMontagem) {

                response = await fetch(`http://localhost:3000/localmontagem/${idMontagem}`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(dados)
                });
            } else {
                response = await fetch("http://localhost:3000/localmontagem", {
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
                document.querySelector("#idMontagem").value = "";
    
                // Zera os valores antigos após salvar
                limparMontagemOriginal();
                MontagemExistente = false;
               
            } else {
                alert(result.erro || "Erro ao salvar o Montagem.");
            }
    
        } catch (error) {
            console.error("Erro ao enviar dados:", error);
            alert("Erro de conexão com o servidor.");
        }
    });

    botaoPesquisar.addEventListener("click", async function (event) {
        event.preventDefault();
        limparCamposMontagem();
        console.log("Pesquisando Montagem...");
        
        try {
           
           const response = await fetch("http://localhost:3000/localMontagem"); // ajuste a rota conforme sua API
           if (!response.ok) throw new Error("Erro ao buscar Local Montagem");
    
            const montagem = await response.json();
 
            // const estiloCampo = (elemento) => {
            //     elemento.className = "form"; // se você estiver usando classe CSS
            //     elemento.style.fontFamily = "Abel, sans-serif"; // Altera a fonte do campo
            //     elemento.style.width = "100%";
            //     elemento.style.display = "flex";
            //     elemento.style.justifyContent = "center"; // Centraliza o campo
            //     elemento.style.padding = "5px,10px";
            //     elemento.style.margin = "5px,10px";
            //     elemento.style.fontSize = "17px";
            //     elemento.style.border = "1px solid #000000";
            //     elemento.style.borderRadius = "8px";
            //     elemento.style.flex = "1"; // Faz o campo ocupar toda a largura disponível
            //     elemento.style.maxWidth = "100%"; // Limita a largura máxima
                
            // };

            const select = criarSelectMontagem(montagem);
            const input = document.querySelector("#descMontagem");
    
            // // Criar novo SELECT
            // const select = document.createElement("select");
            // select.id = "descMontagem";
            // select.name = "descMontagem";
            // select.required = true;
            // select.className = "form";
            // estiloCampo(select);
            

            // // Adicionar opções
            // const defaultOption = document.createElement("option");
            // defaultOption.text = "Selecione uma função...";
            // defaultOption.disabled = true;
            // defaultOption.selected = true;
            // select.appendChild(defaultOption);
           
            // console.log("PESQUISANDO FUNCAO:", funcoes);

            // funcoes.forEach(montagem => {
            //     const option = document.createElement("option");
            //     option.value = montagem.descmontagem;
            //     option.text = montagem.descmontagem;
            //     select.appendChild(option);
            // });
    
            // Substituir o input pelo select
            input.parentNode.replaceChild(select, input);


           
            
//             const select = criarSelectClientes(clientes);
            
//             input.parentNode.replaceChild(select, input);
    
//             select.addEventListener("change", async function () {
//                 console.log("Cliente selecionado antes de carregarClientes:", this.value);
//                 const desc = this.value?.trim(); // Protegendo contra undefined

//                 if (!desc) {
//                     console.warn("Valor do select está vazio ou indefinido.");
//                     return;
//                 }

//                 console.log("Selecionado:", desc);

//                 await carregarClientesNmFantasia(desc, this);
//                 console.log("Cliente selecionado:", this.value);
    
            // Reativar o evento blur para o novo select
            select.addEventListener("change", async function () {
                console.log("Montagem selecionado antes de carregarMontagem:", this.value);
                const desc = this.value?.trim();


                if (!desc) {
                    console.warn("Valor do select está vazio ou indefinido.");
                    return;
                }

                console.log("Selecionado:", desc);

                await carregarNmFantasia(desc, this);
                console.log("Cliente selecionado:", this.value);

        //         const response = await fetch(`http://localhost:3000/localmontagem?descMontagem=${encodeURIComponent(desc)}`);
        //         if (response.ok) {
                   
        //             const montagem = await response.json();
        //             document.querySelector("#idMontagem").value = montagem.idmontagem;
        //             document.querySelector("#descMontagem").value = montagem.descmontagem;
        //             document.querySelector("#CidadeMontagem").value = montagem.cidademontagem;
        //             document.querySelector("#UfMontagem").value = montagem.ufmontagem;
                    
        //             MontagemOriginal = {
        //                 idMontagem: montagem.idmontagem,
        //                 descMontagem: montagem.descmontagem,
        //                 cidadeMontagem: montagem.cidademontagem,
        //                 ufMontagem: montagem.ufmontagem
        //             };
        //             MontagemExistente = true;

                    
        //             const input = document.createElement("input");
        //             input.type = "text";
        //             input.id = "descMontagem";
        //             input.name = "descMontagem";
        //             input.required = true;
        //             input.className = "form";
        //             input.style.width = "100%";
        //             input.style.height = "40px";
        //             estiloCampo(input);
        //             input.value = montagem.descmontagem;

        //             // Substitui o select pelo input
        //             this.parentNode.replaceChild(input, this);

        // // Reanexa o evento de blur no input restaurado
        //             input.addEventListener("blur", async function () {
        //                 const desc = this.value.trim();
        //                 if (desc === "") return;

        //                 const response = await fetch(`http://localhost:3000/localmontagem?descMontagem=${encodeURIComponent(desc)}`);
        //                 if (response.ok) {
        //                     const montagem = await response.json();
        //                     document.querySelector("#idMontagem").value = montagem.idmontagem;
        //                     document.querySelector("#descMontagem").value = montagem.descmontagem;
        //                     document.querySelector("#CidadeMontagem").value = montagem.cidademontagem;
        //                     document.querySelector("#UfMontagem").value = montagem.ufmontagem;
        //                     MontagemOriginal = {
        //                         idMontagem: montagem.idmontagem,
        //                         descMontagem: montagem.descmontagem,
        //                         cidadeMontagem: montagem.cidademontagem,
        //                         ufMontagem: montagem.ufmontagem
        //                     };
        //                     MontagemExistente = true;
        //                 } else {
        //                     Swal.fire({
        //                         icon: 'warning',
        //                         title: 'Local Montagem não encontrada',
        //                         text: `Nenhum local de montagem com essa descrição foi encontrada.`,
        //                         confirmButtonText: 'Ok'
        //                     });
        //                     limparMontagemOriginal();
        //                     MontagemExistente = false;
        //                 }
        //             });

        //         } else {
        //             Swal.fire({
        //                 icon: 'warning',
        //                 title: 'Local Montagem não encontrada',
        //                 text: `Nenhum local de montagem com essa descrição foi encontrada.`,
        //                 confirmButtonText: 'Ok'
        //             });
        //             limparMontagemOriginal();
        //             MontagemExistente = false;
        //         }
            });

                    
            //     } else {
            //         Swal.fire({
            //             icon: 'warning',
            //             title: 'Função não encontrada',
            //             text: `Nenhuma função com essa descrição foi encontrada.`,
            //             confirmButtonText: 'Ok'
            //         });
            //         limparMontagemOriginal();
            //         MontagemExistente = false;
            //     }
            // });
    
        } catch (error) {
            console.error("Erro ao carregar local montagem:", error);
            Swal.fire({
                icon: 'error',
                title: 'Erro',
                text: 'Não foi possível carregar o local montagem.',
                confirmButtonText: 'Ok'
            });
        }
    });
    

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

function criarSelectMontagem(montagem) {
    const select = document.createElement("select");
    select.id = "descMontagem";
    select.name = "descMontagem";
    select.required = true;
    select.className = "form";

    estiloCampo(select);

    const defaultOption = document.createElement("option");
    defaultOption.text = "Selecione um Local de Montagem...";
    defaultOption.disabled = true;
    defaultOption.selected = true;
    defaultOption.value = "";
    select.appendChild(defaultOption);

    console.log("Montagem encontrados no CriarSelects:", montagem);

    montagem.forEach(localmontagem => {
        const option = document.createElement("option");
        option.value = localmontagem.descmontagem;
        option.text = localmontagem.descmontagem;
        select.appendChild(option);
    });
    


    return select;
}

async function carregarLocalMontagem(desc, elementoAtual) {
    try {
        const response = await fetch(`http://localhost:3000/localmontagem?descMontagem=${encodeURIComponent(desc.trim())}`);
        if (!response.ok) throw new Error();
        console.log("Response carregarLocalMontagem",response);
        const montagem = await response.json();
       
        console.log("Montagem encontrado:", montagem);

        document.querySelector("#idMontagem").value = montagem.idmontagem;
        document.querySelector("#descMontagem").value = montagem.descmontagem;
        document.querySelector("#CidadeMontagem").value = montagem.cidademontagem;
        document.querySelector("#UfMontagem").value = montagem.ufmontagem;
        
        MontagemOriginal = {
            idMontagem: montagem.idmontagem,
            descMontagem: montagem.descmontagem,
            cidadeMontagem: montagem.cidademontagem,
            ufMontagem: montagem.ufmontagem
        };
        MontagemExistente = true;

        // document.querySelector("#idCliente").value = cliente.idcliente || "";
        // document.querySelector("#nmFantasia").value = cliente.nmfantasia || "";
        // document.querySelector("#razaoSocial").value = cliente.razaosocial || "";

        // maskCNPJ.value = cliente.cnpj || '';
        // document.querySelector("#inscEstadual").value = cliente.inscestadual || "";
        // document.querySelector("#emailCliente").value = cliente.emailcliente || "";
        // document.querySelector("#emailNfe").value = cliente.emailnfe || "";
        // document.querySelector("#site").value = cliente.site || "";

        // maskTelefone.value = cliente.telefone || '';
        // maskCelContato.value = cliente.celcontato || '';

        // document.querySelector("#nmContato").value = cliente.nmcontato || "";
        // document.querySelector("#emailContato").value = cliente.emailcontato || "";

        // maskCEP.value = cliente.cep || '';
        // document.querySelector("#rua").value = cliente.rua || "";
        // document.querySelector("#numero").value = cliente.numero || "";
        // document.querySelector("#complemento").value = cliente.complemento || "";
        // document.querySelector("#bairro").value = cliente.bairro || "";
        // document.querySelector("#cidade").value = cliente.cidade || "";
        // document.querySelector("#estado").value = cliente.estado || "";
        // document.querySelector("#pais").value = cliente.pais || "";

        // document.querySelector("#ativo").checked =
        //     cliente.ativo === true || cliente.ativo === "true" || cliente.ativo === 1;
        
        // document.querySelector("#tpcliente").value = cliente.tpcliente || "";
        // // Atualiza o cliente original para comparação futura
        // clienteOriginal = {
        //     idCliente: cliente.idcliente,
        //     nmFantasia: cliente.nmfantasia,
        //     razaoSocial: cliente.razaosocial,
        //     cnpj: cliente.cnpj,
        //     inscEstadual: cliente.inscestadual,
        //     emailCliente: cliente.emailcliente,
        //     emailNfe: cliente.emailnfe,
        //     telefone: cliente.telefone,
        //     nmContato: cliente.nmcontato,
        //     celContato: cliente.celcontato,
        //     emailContato: cliente.emailcontato,
        //     site: cliente.site,
        //     cep: cliente.cep,
        //     rua: cliente.rua,
        //     numero: cliente.numero,
        //     complemento: cliente.complemento,
        //     bairro: cliente.bairro,
        //     cidade: cliente.cidade,
        //     estado: cliente.estado,
        //     pais: cliente.pais,
        //     ativo: cliente.ativo,
        //     tpcliente: cliente.tpcliente
        // };
        // clienteExistente = true; // Define que o cliente existe


        const novoInput = document.createElement("input");
        novoInput.type = "text";
        novoInput.id = "descMontagem";
        novoInput.name = "descMontagem";
        novoInput.required = true;
        novoInput.className = "form";
        novoInput.value = montagem.descmontagem;

        estiloCampo(novoInput);
        elementoAtual.parentNode.replaceChild(novoInput, elementoAtual);

        novoInput.addEventListener("blur", async function () {
            if (!this.value.trim()) return;
            await carregarLocalMontagem(this.value, this);
        });

    } catch {
        mostrarErro("Local  Montagem não encontrada", "Nenhum local de montagem com essa descrição foi encontrada.");
        limparMontagemOriginal();
        MontagemExistente = false;

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


function limparMontagemOriginal() {
    MontagemOriginal = {
        idMontagem: "",
        descMontagem: "",
        cidadeMontagem: "",
        ufMontagem: ""
    };
}
function mostrarAlerta() {
    Swal.fire({
        icon: 'info',
        title: 'Nada foi alterado!',
        text: 'Faça alguma alteração antes de salvar.',
        confirmButtonText: 'OK',

        didOpen: () => {
            const confirmBtn = Swal.getConfirmButton();
            if (confirmBtn) confirmBtn.focus();
          }
    });
}

function limparCamposMontagem() {
    const campos = ["idMontagem", "CidadeMontagem", "UfMontagem", "descMontagem"];
    campos.forEach(id => {
        const campo = document.getElementById(id);
        if (campo) campo.value = "";
    });
}

function configurarEventosMontagem() {
    console.log("Configurando eventos Montagem...");
    verificaMontagem(); // Carrega os Montagem ao abrir o modal
    console.log("Entrou configurar Montagem no MONTAGEM.js.");
    

} 
window.configurarEventosMontagem = configurarEventosMontagem;
