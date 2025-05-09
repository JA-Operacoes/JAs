// if (typeof Swal === "undefined") {
//     const script = document.createElement("script");
//     script.src = "https://cdn.jsdelivr.net/npm/sweetalert2@11";
//     script.onload = () => {
//         console.log("SweetAlert2 carregado com sucesso.");
//     };
//     document.head.appendChild(script);
// }

let FuncionarioExistente = false;
let FuncionarioOriginal = {
    idFuncionario: "",
    descFuncionario: "",
    vlrCusto: "",
    vlrVenda: ""
};

function verificaFuncionario() {

    console.log("Carregando Funcionario...");
    
    document.querySelector("#descFuncionario").addEventListener("blur", async function () {
        const desc = this.value.trim();

        console.log("Campo descFuncionario procurado:", desc);
    
        if (desc === "") return;
    
        try {
            const response = await fetch(`http://localhost:3000/funcao?descFuncionario=${encodeURIComponent(desc)}`);

            
            if (!response.ok) {
                console.log("Funcionario não encontrado.");
                limparFuncionarioOriginal();
                FuncionarioExistente = false;
                return;
            }
    
            const Funcionario = await response.json();

            if (!Funcionario || Object.keys(Funcionario).length === 0) {
                console.log("Cliente não encontrado no corpo da resposta.");
                Swal.fire({
                    icon: 'warning',
                    title: 'Cliente não encontrado',
                    text: `Nenhum cliente com o nome fantasia "${nmFantasia}" foi encontrado.`,
                    confirmButtonText: 'Ok'
                });
                limparFuncionarioOriginal();
                FuncionarioExistente = false;
                return;
            }
            else{
                FuncionarioExistente = true; // Define que o cliente existe 
            }
            
            if (FuncionarioExistente){

                console.log("Funcionario encontrado:", Funcionario);
                console.log("Campos encontrados:", {
                    idFuncionario: document.querySelector("#idFuncionario"),
                    Custo: document.querySelector("#Custo"),
                    Venda: document.querySelector("#Venda")
                });

                // Preenche os campos com os dados retornados
                document.querySelector("#idFuncionario").value = Funcionario.idfuncao; // se existir o campo
                document.querySelector("#Custo").value = Funcionario.ctofuncao;
                document.querySelector("#Venda").value = Funcionario.vdafuncao;
                
                FuncionarioOriginal = {
                    idFuncionario: Funcionario.idfuncao,
                    descFuncionario: Funcionario.descfuncao,
                    vlrCusto: Funcionario.ctofuncao,
                    vlrVenda: Funcionario.vdafuncao
                };
        
                console.log("Funcionario encontrado e preenchido:", Funcionario);
            }
        } catch (error) {
            console.error("Erro ao buscar Funcionario:", error);
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

        console.log("ENVIANDO DADOS DO Funcionario PELO Funcionario.JS", document);

        const idFuncionario = document.querySelector("#idFuncionario").value.trim();
        const descFuncionario = document.querySelector("#descFuncionario").value.trim();
        const vlrCusto = document.querySelector("#Custo").value.trim();
        const vlrVenda = document.querySelector("#Venda").value.trim();

        const custo = parseFloat(String(vlrCusto).replace(",", "."));
        const venda = parseFloat(String(vlrVenda).replace(",", "."));
    
        if (!descFuncionario || !vlrCusto || !vlrVenda) {
            alert("Preencha todos os campos.");
            return;
        }
    
        // 🔍 Comparar com os valores originais
        if (
            idFuncionario === FuncionarioOriginal.idfuncao &&
            descFuncionario === FuncionarioOriginal.descfuncao &&
            custo === FuncionarioOriginal.ctofuncao &&
            venda === FuncionarioOriginal.vdafuncao
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
    
        const dados = { descFuncionario, custo, venda };
     
        
    
        try {
            let response;
            console.log("idFuncionario", idFuncionario);
            if (idFuncionario) {

                response = await fetch(`http://localhost:3000/funcao/${idFuncionario}`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(dados)
                });
            } else {
                response = await fetch("http://localhost:3000/funcao", {
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
                document.querySelector("#idFuncionario").value = "";
    
                // Zera os valores antigos após salvar
                limparFuncionarioOriginal();
                FuncionarioExistente = false;
               
            } else {
                alert(result.erro || "Erro ao salvar o Funcionario.");
            }
    
        } catch (error) {
            console.error("Erro ao enviar dados:", error);
            alert("Erro de conexão com o servidor.");
        }
    });

    botaoPesquisar.addEventListener("click", async function (event) {
        event.preventDefault();
        limparCamposFuncionario();
        console.log("Pesquisando Funcionario...");
        try {
           
            
            const response = await fetch("http://localhost:3000/Funcionario"); // ajuste a rota conforme sua API
     

            if (!response.ok) throw new Error("Erro ao buscar funções");
    
            const funcoes = await response.json();
            
            // font-family:"Abel",sans-serif;
            // width: 100%;
            // display: flex;
            // justify-content: center;                  /* Faz os inputs ocuparem toda a largura */
            // padding: 5px 50px; 
            // margin: 5px 10px;
            // font-size: 17px;               /* Espaçamento interno nos campos */
            // border: 1px solid #000000;      /* Cor de borda */
            // border-radius: 8px;  
            // flex: 1;      
            // max-width: 100%;  


            const estiloCampo = (elemento) => {
                elemento.className = "form"; // se você estiver usando classe CSS
                elemento.style.fontFamily = "Abel, sans-serif"; // Altera a fonte do campo
                elemento.style.width = "100%";
                elemento.style.display = "flex";
                elemento.style.justifyContent = "center"; // Centraliza o campo
                elemento.style.padding = "5px,10px";
                elemento.style.margin = "5px,10px";
                elemento.style.fontSize = "17px";
                elemento.style.border = "1px solid #000000";
                elemento.style.borderRadius = "8px";
                elemento.style.flex = "1"; // Faz o campo ocupar toda a largura disponível
                elemento.style.maxWidth = "100%"; // Limita a largura máxima
                
            };
            const input = document.querySelector("#descFuncionario");
    
            // Criar novo SELECT
            const select = document.createElement("select");
            select.id = "descFuncionario";
            select.name = "descFuncionario";
            select.required = true;
            select.className = "form";
            estiloCampo(select);
            

            // Adicionar opções
            const defaultOption = document.createElement("option");
            defaultOption.text = "Selecione uma função...";
            defaultOption.disabled = true;
            defaultOption.selected = true;
            select.appendChild(defaultOption);
           
            console.log("PESQUISANDO FUNCAO:", funcoes);

            funcoes.forEach(funcao => {
                const option = document.createElement("option");
                option.value = funcao.descfuncao;
                option.text = funcao.descfuncao;
                select.appendChild(option);
            });
    
            // Substituir o input pelo select
            input.parentNode.replaceChild(select, input);
    
            // Reativar o evento blur para o novo select
            select.addEventListener("change", async function () {
                const desc = this.value.trim();
                const response = await fetch(`http://localhost:3000/funcao?descFuncionario=${encodeURIComponent(desc)}`);
                if (response.ok) {
                   
                    const funcao = await response.json();
                    document.querySelector("#idFuncionario").value = funcao.idfuncao;
                    document.querySelector("#Custo").value = funcao.ctofuncao;
                    document.querySelector("#Venda").value = funcao.vdafuncao;
                    
                    FuncionarioOriginal = {
                        idFuncionario: funcao.idfuncao,
                        descFuncionario: funcao.descfuncao,
                        vlrCusto: funcao.ctofuncao,
                        vlrVenda: funcao.vdafuncao
                    };
                    FuncionarioExistente = true;

                    
                    const input = document.createElement("input");
                    input.type = "text";
                    input.id = "descFuncionario";
                    input.name = "descFuncionario";
                    input.required = true;
                    input.className = "form";
                    input.style.width = "100%";
                    input.style.height = "40px";
                    estiloCampo(input);
                    input.value = funcao.descfuncao;

                    // Substitui o select pelo input
                    this.parentNode.replaceChild(input, this);

        // Reanexa o evento de blur no input restaurado
                    input.addEventListener("blur", async function () {
                        const desc = this.value.trim();
                        if (desc === "") return;

                        const response = await fetch(`http://localhost:3000/funcao?descFuncionario=${encodeURIComponent(desc)}`);
                        if (response.ok) {
                            const funcao = await response.json();
                            document.querySelector("#idFuncionario").value = funcao.idfuncao;
                            document.querySelector("#Custo").value = funcao.ctofuncao;
                            document.querySelector("#Venda").value = funcao.vdafuncao;
                            FuncionarioOriginal = {
                                idFuncionario: funcao.idfuncao,
                                descFuncionario: funcao.descfuncao,
                                vlrCusto: funcao.ctofuncao,
                                vlrVenda: funcao.vdafuncao
                            };
                            FuncionarioExistente = true;
                        } else {
                            Swal.fire({
                                icon: 'warning',
                                title: 'Função não encontrada',
                                text: `Nenhuma função com essa descrição foi encontrada.`,
                                confirmButtonText: 'Ok'
                            });
                            limparFuncionarioOriginal();
                            FuncionarioExistente = false;
                        }
                    });

                } else {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Função não encontrada',
                        text: `Nenhuma função com essa descrição foi encontrada.`,
                        confirmButtonText: 'Ok'
                    });
                    limparFuncionarioOriginal();
                    FuncionarioExistente = false;
                }
            });

                    
            //     } else {
            //         Swal.fire({
            //             icon: 'warning',
            //             title: 'Função não encontrada',
            //             text: `Nenhuma função com essa descrição foi encontrada.`,
            //             confirmButtonText: 'Ok'
            //         });
            //         limparFuncionarioOriginal();
            //         FuncionarioExistente = false;
            //     }
            // });
    
        } catch (error) {
            console.error("Erro ao carregar funções:", error);
            Swal.fire({
                icon: 'error',
                title: 'Erro',
                text: 'Não foi possível carregar as funções.',
                confirmButtonText: 'Ok'
            });
        }
    });
    

}

function limparFuncionarioOriginal() {
    FuncionarioOriginal = {
        idFuncionario: "",
        descFuncionario: "",
        vlrCusto: "",
        vlrVenda: ""
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

function limparCamposFuncionario() {
    const campos = ["idFuncionario", "Custo", "Venda", "descFuncionario"];
    campos.forEach(id => {
        const campo = document.getElementById(id);
        if (campo) campo.value = "";
    });
}

function configurarEventosFuncionario() {
    console.log("Configurando eventos Funcionario...");
    verificaFuncionario(); // Carrega os Funcionario ao abrir o modal
    console.log("Entrou configurar Funcionario no FUNCAO.js.");
    

} 
window.configurarEventosFuncionario = configurarEventosFuncionario;
