if (typeof Swal === "undefined") {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/sweetalert2@11";
    script.onload = () => {
        console.log("SweetAlert2 carregado com sucesso.");
    };
    document.head.appendChild(script);
}

if (typeof window.SuprimentoOriginal === "undefined") {
    window.SuprimentoOriginal = {
        idSup: "",
        descSup: "",
        vlrCusto: "",
        vlrVenda: ""
    };
}


function verificaSuprimento() {

    console.log("Carregando Suprimento...");
    
    document.querySelector("#descSup").addEventListener("blur", async function () {
        const desc = this.value.trim();

        console.log("Campo descSup procurado:", desc);
    
        if (desc === "") return;
    
        try {
            if (!desc) {
                console.warn("Valor do select está vazio ou indefinido.");
                return;
            }

            console.log("Selecionado:", desc);

            await carregarSuprimentoDescricao(desc, this);
            console.log("Suprimento selecionado depois de carregarSuprimentoDescricao:", this.value);
         

        } catch (error) {
            console.error("Erro ao buscar Suprimento:", error);
        }

    });

    const botaoEnviar = document.querySelector("#Enviar");
    const botaoPesquisar = document.querySelector("#Pesquisar");
    const form = document.querySelector("#form");
    const botaoLimpar = document.querySelector("#Limpar");

    if (!botaoEnviar || !form) {
        console.error("Formulário ou botão não encontrado no DOM.");
        return;
    }

    botaoLimpar.addEventListener("click", function (event) {
        event.preventDefault(); // Previne o envio padrão do formulário 

        limparCamposSuprimento();

    });

    botaoEnviar.addEventListener("click", async function (event) {
        event.preventDefault(); // Previne o envio padrão do formulário

        console.log("ENVIANDO DADOS DO Suprimento PELO Suprimento.JS", document);

        const idSup = document.querySelector("#idSup").value.trim();
        const descSup = document.querySelector("#descSup").value.toUpperCase().trim();
        const vlrCusto = document.querySelector("#ctoSup").value;
        const vlrVenda = document.querySelector("#vdaSup").value;
    
        const custo = parseFloat(String(vlrCusto).replace(",", "."));
        const venda = parseFloat(String(vlrVenda).replace(",", "."));
    
        if (!descSup || !vlrCusto || !vlrVenda) {
           
            Swal.fire({
                icon: 'warning',
                title: 'Campos obrigatórios!',
                text: 'Preencha todos os campos antes de enviar.',
                confirmButtonText: 'Entendi'
            });
            return;
        }
        console.log("Valores do Suprimento:", idSup, descSup, custo, venda);
        console.log("Valores do Suprimento Original:", window.SuprimentoOriginal.idSup, window.SuprimentoOriginal.descSup, window.SuprimentoOriginal.vlrCusto, window.SuprimentoOriginal.vlrVenda);
    
        // Comparar com os valores originais
        if (
            parseInt(idSup) === parseInt(window.SuprimentoOriginal.idSup) && 
            descSup === window.SuprimentoOriginal.descSup && 
            Number(custo).toFixed(2) === Number(window.SuprimentoOriginal.vlrCusto).toFixed(2) &&
            Number(venda).toFixed(2) === Number(window.SuprimentoOriginal.vlrVenda).toFixed(2)
        ) {
            console.log("Nenhuma alteração detectada.");
            await Swal.fire({
                icon: 'info',
                title: 'Nenhuma alteração foi detectada!',
                text: 'Faça alguma alteração antes de salvar.',
                confirmButtonText: 'Entendi'
            });
            return;
        }
    
        const dados = { descSup, custo, venda };
     
        if (idSup) {
            Swal.fire({
                title: "Deseja salvar as alterações?",
                text: "Você está prestes a atualizar os dados da função.",
                icon: "question",
                showCancelButton: true,
                confirmButtonText: "Sim, salvar",
                cancelButtonText: "Cancelar",
                reverseButtons: true,
                focusCancel: true
                
            }).then(async (result) => {
                if (result.isConfirmed) {
                    try {
                        const response = await fetch(`http://localhost:3000/suprimentos/${idSup}`, {
                            method: "PUT",
                            headers: {
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify(dados)
                        });
        
                        const resultJson = await response.json();
        
                        if (response.ok) {
                            document.getElementById('form').reset();
                            Swal.fire("Sucesso!", resultJson.mensagem || "Alterações salvas com sucesso!", "success");
                            //form.reset();
                            document.querySelector("#idSup").value = "";
                            limparSuprimentoOriginal();  
                        } else {
                            Swal.fire("Erro", resultJson.erro || "Erro ao salvar o Função.", "error");
                        }
                    } catch (error) {
                        console.error("Erro ao enviar dados:", error);
                        Swal.fire("Erro de conexão", "Não foi possível conectar ao servidor.", "error");
                    }
                } else {
                    console.log("Usuário cancelou a alteração.");
                }
            });
        } else {
            // Se for novo, salva direto
            try {
                const response = await fetch("http://localhost:3000/suprimentos", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(dados)
                });
        
                const resultJson = await response.json();
        
                if (response.ok) {
                    Swal.fire("Sucesso!", resultJson.mensagem || "Suprimento cadastrado!", "success");
                    form.reset();
                    limparSuprimentoOriginal();
                    document.querySelector("#idSup").value = "";
                } else {
                    Swal.fire("Erro", resultJson.erro || "Erro ao cadastrar o Função.", "error");
                }
            } catch (error) {
                console.error("Erro ao enviar dados:", error);
                Swal.fire("Erro de conexão", "Não foi possível conectar ao servidor.", "error");
            }
        }
    });
    
    botaoPesquisar.addEventListener("click", async function (event) {
        event.preventDefault();
        limparCamposSuprimento();
        console.log("Pesquisando Suprimento...");
        try {
            const response = await fetch("http://localhost:3000/suprimentos"); // ajuste a rota conforme sua API
            if (!response.ok) throw new Error("Erro ao buscar suprimentos");
    
            const suprimentos = await response.json();

            console.log("Suprimentos encontrados:", suprimentos);

            const select = criarSelectSuprimento(suprimentos);
            limparCamposSuprimento();
            const input = document.querySelector("#descSup");
               
            if (input && input.parentNode) {
                input.parentNode.replaceChild(select, input);
            }
   
            const label = document.querySelector('label[for="descSup"]');
            if (label) {
              label.style.display = "none"; // ou guarda o texto, se quiser restaurar exatamente o mesmo
            }
    
            // Reativar o evento blur para o novo select
            select.addEventListener("change", async function () {
                const desc = this.value?.trim();
               
                if (!desc) {
                    console.warn("Valor do select está vazio ou indefinido.");
                    return;
                }

                await carregarSuprimentoDescricao(desc, this);

                const novoInput = document.createElement("input");
                novoInput.type = "text";
                novoInput.id = "descSup";
                novoInput.name = "descSup";
                novoInput.required = true;
                novoInput.className = "form";
                novoInput.value = desc;
            
                novoInput.addEventListener("input", function() {
                    this.value = this.value.toUpperCase(); // transforma o texto em maiúsculo à medida que o usuário digita
                });

                this.parentNode.replaceChild(novoInput, this);
               
                const label = document.querySelector('label[for="descSup"]');
                if (label) {
                label.style.display = "block";
                label.textContent = "Descrição do Suprimento"; // ou algum texto que você tenha guardado
                }
              
                novoInput.addEventListener("blur", async function () {
                    if (!this.value.trim()) return;
                    await carregarSuprimentoDescricao(this.value, this);
                });
 
         });
    
        } catch (error) {
            console.error("Erro ao carregar Suprimentos:", error);
            Swal.fire({
                icon: 'error',
                title: 'Erro',
                text: 'Não foi possível carregar os suprimentos.',
                confirmButtonText: 'Ok'
            });
        }
    });
    

}
function criarSelectSuprimento(suprimentos) {
   
    const select = document.createElement("select");
    select.id = "descSup";
    select.name = "descSup";
    select.required = true;
    select.className = "form";

   
    // Adicionar opções
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.text = "Selecione um Suprimento...";
    defaultOption.disabled = true;
    defaultOption.selected = true;
    select.appendChild(defaultOption);
   
    console.log("PESQUISANDO FUNCAO:", suprimentos);

    suprimentos.forEach(suprimentosachado => {
        const option = document.createElement("option");
        option.value = suprimentosachado.descsup;
        option.text = suprimentosachado.descsup;
        select.appendChild(option);
    });
 
    return select;
}

async function carregarSuprimentoDescricao(desc, elementoAtual) {
    try {
        const response = await fetch(`http://localhost:3000/suprimentos?descSup=${encodeURIComponent(desc)}`);
        if (!response.ok) throw new Error();
           
        const suprimentos = await response.json();
        document.querySelector("#idSup").value = suprimentos.idsup;
        document.querySelector("#ctoSup").value = suprimentos.ctosup;
        document.querySelector("#vdaSup").value = suprimentos.vdasup
        window.SuprimentoOriginal = {
            idSup: suprimentos.idsup,
            descSup: suprimentos.descsup,
            vlrCusto: suprimentos.ctosup,
            vlrVenda: suprimentos.vdasup
        };   
    

    } catch (error) {
        
        if (!idSup.value) {
    
            const resultado = await Swal.fire({
                icon: 'question',
                title: `Deseja cadastrar "${desc.toUpperCase()}" como novo Suprimento?`,
                text: `Suprimento "${desc.toUpperCase()}" não encontrado`,
                showCancelButton: true,
                confirmButtonText: "Sim, salvar",
                cancelButtonText: "Cancelar",
                reverseButtons: true,
                focusCancel: true
                });

                console.log("Resultado do Swal:", resultado);

        }
    }
}



function limparSuprimentoOriginal() {
    window.SuprimentoOriginal = {
        idSup: "",
        descSup: "",
        vlrCusto: "",
        vlrVenda: ""
    };
}



function limparCamposSuprimento() {
    // const campos = ["idSup", "descSup","ctoSup", "vdaSup" ];
    // campos.forEach(id => {
    //     const campo = document.getElementById(id);
    //     if (campo) campo.value = "";
    // });
    const idSup = document.getElementById("idSup");
    const descSupEl = document.getElementById("descSup");
    const ctoSup = document.getElementById("ctoSup");
    const vdaSup = document.getElementById("vdaSup");

    if (idSup) idSup.value = "";
    if (ctoSup) ctoSup.value = "";
    if (vdaSup) vdaSup.value = "";

    if (descSupEl && descSupEl.tagName === "SELECT") {
        // Se for SELECT, trocar por INPUT
        const novoInput = document.createElement("input");
        novoInput.type = "text";
        novoInput.id = "descSup";
        novoInput.name = "descSup";
        novoInput.required = true;
        novoInput.className = "form";

        // Configura o evento de transformar texto em maiúsculo
        novoInput.addEventListener("input", function () {
            this.value = this.value.toUpperCase();
        });

        // Reativa o evento blur
        novoInput.addEventListener("blur", async function () {
            if (!this.value.trim()) return;
            await carregarSuprimentoDescricao(this.value, this);
        });

        descSupEl.parentNode.replaceChild(novoInput, descSupEl);

        const label = document.querySelector('label[for="descSup"]');
        if (label) {
            label.style.display = "block";
            label.textContent = "Descrição do Suprimento";
        }
    } else if (descSupEl) {
        // Se for input normal, só limpa
        descSupEl.value = "";
    }

}

function configurarEventosSuprimento() {
    console.log("Configurando eventos Suprimento...");
    verificaSuprimento(); // Carrega os Suprimento ao abrir o modal
    console.log("Entrou configurar Suprimento no EQUIPAMENTO.js.");
    

} 
window.configurarEventosSuprimento = configurarEventosSuprimento;
