if (typeof Swal === "undefined") {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/sweetalert2@11";
    script.onload = () => {
        console.log("SweetAlert2 carregado com sucesso.");
    };
    document.head.appendChild(script);
}

if (typeof window.EquipamentoOriginal === "undefined") {
    window.EquipamentoOriginal = {
        idEquip: "",
        descEquip: "",
        vlrCusto: "",
        vlrVenda: ""
    };
}

function verificaEquipamento() {

    console.log("Carregando Equipamento...");
    
    document.querySelector("#descEquip").addEventListener("blur", async function () {
        const desc = this.value.trim();

        console.log("Campo descEquip procurado:", desc);
    
        if (desc === "") return;
    
        try {
            if (!desc) {
                console.warn("Valor do select está vazio ou indefinido.");
                return;
            }

            console.log("Selecionado:", desc);

            await carregarEquipamentoDescricao(desc, this);
            console.log("Função selecionado depois de carregarEquipamentoDescricao:", this.value);
         

        } catch (error) {
            console.error("Erro ao buscar Função:", error);
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

        limparCamposEquipamento();

    });

    botaoEnviar.addEventListener("click", async function (event) {
        event.preventDefault(); // Previne o envio padrão do formulário

        console.log("ENVIANDO DADOS DO Equipamento PELO Equipamento.JS", document);

        const idEquip = document.querySelector("#idEquip").value.trim();
        const descEquip = document.querySelector("#descEquip").value.toUpperCase().trim();
        const vlrCusto = document.querySelector("#ctoEquip").value;
        const vlrVenda = document.querySelector("#vdaEquip").value;
    
        const custo = parseFloat(String(vlrCusto).replace(",", "."));
        const venda = parseFloat(String(vlrVenda).replace(",", "."));
    
        if (!descEquip || !vlrCusto || !vlrVenda) {
           
            Swal.fire({
                icon: 'warning',
                title: 'Campos obrigatórios!',
                text: 'Preencha todos os campos antes de enviar.',
                confirmButtonText: 'Entendi'
            });
            return;
        }
        console.log("Valores do Equipamento:", idEquip, descEquip, custo, venda);
        console.log("Valores do Equipamento Original:", window.EquipamentoOriginal.idEquip, window.EquipamentoOriginal.descEquip, window.EquipamentoOriginal.vlrCusto, window.EquipamentoOriginal.vlrVenda);
    
        // Comparar com os valores originais
        if (
            parseInt(idEquip) === parseInt(window.EquipamentoOriginal.idEquip) && 
            descEquip === window.EquipamentoOriginal.descEquip && 
            Number(custo).toFixed(2) === Number(window.EquipamentoOriginal.vlrCusto).toFixed(2) &&
            Number(venda).toFixed(2) === Number(window.EquipamentoOriginal.vlrVenda).toFixed(2)
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
    
        const dados = { descEquip, custo, venda };
     
        if (idEquip) {
            
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
                        const response = await fetch(`http://localhost:3000/equipamentos/${idEquip}`, {
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
                            document.querySelector("#idEquip").value = "";
                            limparEquipamentoOriginal();  
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

            console.log("Novo Equipamento, salvando...");
            // Se for novo, salva direto
            try {
                const response = await fetch("http://localhost:3000/equipamentos", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(dados)
                });
        
                const resultJson = await response.json();
        
                if (response.ok) {
                    Swal.fire("Sucesso!", resultJson.mensagem || "Equipamento cadastrada!", "success");
                    form.reset();
                    limparEquipamentoOriginal();
                    document.querySelector("#idEquip").value = "";
                } else {
                    Swal.fire("Erro", resultJson.erro || "Erro ao cadastrar o Equipamento.", "error");
                }
            } catch (error) {
                console.error("Erro ao enviar dados:", error);
                Swal.fire("Erro de conexão", "Não foi possível conectar ao servidor.", "error");
            }
        }
    });
    
    botaoPesquisar.addEventListener("click", async function (event) {
        event.preventDefault();
        limparCamposEquipamento();
        console.log("Pesquisando Equipamento...");
        try {
            const response = await fetch("http://localhost:3000/equipamentos"); // ajuste a rota conforme sua API
            if (!response.ok) throw new Error("Erro ao buscar equipamentos");
    
            const equipamentos = await response.json();

            console.log("Equipamentos encontrados:", equipamentos);

            const select = criarSelectEquipamento(equipamentos);
            limparCamposEquipamento();
            const input = document.querySelector("#descEquip");
               
            if (input && input.parentNode) {
                input.parentNode.replaceChild(select, input);
            }
   
            const label = document.querySelector('label[for="descEquip"]');
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

                await carregarEquipamentoDescricao(desc, this);

                const novoInput = document.createElement("input");
                novoInput.type = "text";
                novoInput.id = "descEquip";
                novoInput.name = "descEquip";
                novoInput.required = true;
                novoInput.className = "form";
                novoInput.value = desc;
            
                novoInput.addEventListener("input", function() {
                    this.value = this.value.toUpperCase(); // transforma o texto em maiúsculo à medida que o usuário digita
                });

                this.parentNode.replaceChild(novoInput, this);
               
                const label = document.querySelector('label[for="descEquip"]');
                if (label) {
                label.style.display = "block";
                label.textContent = "Descrição do Equipamento"; // ou algum texto que você tenha guardado
                }
              
                novoInput.addEventListener("blur", async function () {
                    if (!this.value.trim()) return;
                    await carregarEquipamentoDescricao(this.value, this);
                });
 
         });
    
        } catch (error) {
            console.error("Erro ao carregar Equipamentos:", error);
            Swal.fire({
                icon: 'error',
                title: 'Erro',
                text: 'Não foi possível carregar os equipamentos.',
                confirmButtonText: 'Ok'
            });
        }
    });
    

}
function criarSelectEquipamento(equipamentos) {
   
    const select = document.createElement("select");
    select.id = "descEquip";
    select.name = "descEquip";
    select.required = true;
    select.className = "form";

   
    // Adicionar opções
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.text = "Selecione um Equipamento...";
    defaultOption.disabled = true;
    defaultOption.selected = true;
    select.appendChild(defaultOption);
   
    console.log("PESQUISANDO FUNCAO:", equipamentos);

    equipamentos.forEach(equipamentosachado => {
        const option = document.createElement("option");
        option.value = equipamentosachado.descequip;
        option.text = equipamentosachado.descequip;
        select.appendChild(option);
    });
 
    return select;
}

async function carregarEquipamentoDescricao(desc, elementoAtual) {
    try {
        const response = await fetch(`http://localhost:3000/equipamentos?descEquip=${encodeURIComponent(desc)}`);
        if (!response.ok) throw new Error();
           
        const equipamentos = await response.json();
        document.querySelector("#idEquip").value = equipamentos.idequip;
        document.querySelector("#ctoEquip").value = equipamentos.ctoequip;
        document.querySelector("#vdaEquip").value = equipamentos.vdaequip;
        
        window.EquipamentoOriginal = {
            idEquip: equipamentos.idequip,
            descEquip: equipamentos.descequip,
            vlrCusto: equipamentos.ctoequip,
            vlrVenda: equipamentos.vdaequip
        };

    } catch (error) {
        
        if (!idEquip.value) {
    
            const resultado = await Swal.fire({
                icon: 'question',
                title: `Deseja cadastrar "${desc.toUpperCase()}" como novo Equipamento?`,
                text: `Equipamento "${desc.toUpperCase()}" não encontrado`,
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



function limparEquipamentoOriginal() {
    window.EquipamentoOriginal = {
        idEquip: "",
        descEquip: "",
        vlrCusto: "",
        vlrVenda: ""
    };
}



function limparCamposEquipamento() {
    // const campos = ["idEquip", "descEquip","ctoEquip", "vdaEquip" ];
    // campos.forEach(id => {
    //     const campo = document.getElementById(id);
    //     if (campo) campo.value = "";
    // });
    
    const idEquip = document.getElementById("idEquip");
    const descEquipEl = document.getElementById("descEquip");
    const ctoEquip = document.getElementById("ctoEquip");
    const vdaEquip = document.getElementById("vdaEquip");

    if (idEquip) idEquip.value = "";
    if (ctoEquip) ctoEquip.value = "";
    if (vdaEquip) vdaEquip.value = "";

    if (descEquipEl && descEquipEl.tagName === "SELECT") {
        // Se for SELECT, trocar por INPUT
        const novoInput = document.createElement("input");
        novoInput.type = "text";
        novoInput.id = "descEquip";
        novoInput.name = "descEquip";
        novoInput.required = true;
        novoInput.className = "form";

        // Configura o evento de transformar texto em maiúsculo
        novoInput.addEventListener("input", function () {
            this.value = this.value.toUpperCase();
        });

        // Reativa o evento blur
        novoInput.addEventListener("blur", async function () {
            if (!this.value.trim()) return;
            await carregarEquipamentoDescricao(this.value, this);
        });

        descEquipEl.parentNode.replaceChild(novoInput, descEquipEl);

        const label = document.querySelector('label[for="descEquip"]');
        if (label) {
            label.style.display = "block";
            label.textContent = "Descrição do Equipamento";
        }
    } else if (descEquipEl) {
        // Se for input normal, só limpa
        descEquipEl.value = "";
    }

}

function configurarEventosEquipamento() {
    console.log("Configurando eventos Equipamento...");
    verificaEquipamento(); // Carrega os Equipamento ao abrir o modal
    console.log("Entrou configurar Equipamento no EQUIPAMENTO.js.");
    

} 
window.configurarEventosEquipamento = configurarEventosEquipamento;
