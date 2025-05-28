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

        
    botaoEnviar.addEventListener("click", async (event) => {
        event.preventDefault();

        const idEquip = document.querySelector("#idEquip").value.trim();
        const descEquip = document.querySelector("#descEquip").value.toUpperCase().trim();
        const vlrCusto = document.querySelector("#ctoEquip").value;
        const vlrVenda = document.querySelector("#vdaEquip").value;

        const custo = parseFloat(vlrCusto.replace(",", "."));
        const venda = parseFloat(vlrVenda.replace(",", "."));

        // Permissões
        const temPermissaoCadastrar = temPermissao("Equipamentos", "cadastrar");
        const temPermissaoAlterar = temPermissao("Equipamentos", "alterar");

        const metodo = idEquip ? "PUT" : "POST";

        if (!idEquip && !temPermissaoCadastrar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para cadastrar novos equipamentos.", "error");
        }

        if (idEquip && !temPermissaoAlterar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para alterar equipamentos.", "error");
        }

        if (!descEquip || !vlrCusto || !vlrVenda) {
            return Swal.fire("Campos obrigatórios!", "Preencha todos os campos antes de enviar.", "warning");
        }

        const dados = { descEquip, custo, venda };

        // Verifica alterações
        if (
            idEquip &&
            parseInt(idEquip) === parseInt(window.EquipamentoOriginal?.idEquip) &&
            descEquip === window.EquipamentoOriginal?.descEquip &&
            Number(custo).toFixed(2) === Number(window.EquipamentoOriginal?.vlrCusto).toFixed(2) &&
            Number(venda).toFixed(2) === Number(window.EquipamentoOriginal?.vlrVenda).toFixed(2)
        ) {
            return Swal.fire("Nenhuma alteração foi detectada!", "Faça alguma alteração antes de salvar.", "info");
        }

        const url = idEquip
            ? `/equipamentos/${idEquip}`
            : "/equipamentos";

        try {
            // Confirma alteração (PUT)
            if (metodo === "PUT") {
                const { isConfirmed } = await Swal.fire({
                    title: "Deseja salvar as alterações?",
                    text: "Você está prestes a atualizar os dados do equipamento.",
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

            if (!res.ok) throw new Error(json.erro || json.message || "Erro ao salvar equipamento");

            await Swal.fire("Sucesso!", json.message || "Equipamento salvo com sucesso.", "success");
            document.getElementById("form").reset();
            document.querySelector("#idEquip").value = "";
            limparEquipamentoOriginal();

        } catch (error) {
            console.error("Erro ao enviar dados:", error);
            Swal.fire("Erro", error.message || "Erro ao salvar equipamento.", "error");
        }
    });

    botaoPesquisar.addEventListener("click", async function (event) {
    event.preventDefault();
    limparCamposEquipamento();

    console.log("Pesquisando Equipamento...");

    // Verifica permissão
    const temPermissaoPesquisar = temPermissao("Equipamentos", "pesquisar");

    if (!temPermissaoPesquisar) {
        return Swal.fire(
            "Acesso negado",
            "Você não tem permissão para pesquisar equipamentos.",
            "error"
        );
    }

    try {
        const response = await fetchComToken("/equipamentos");

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
            label.style.display = "none";
        }

        // Evento ao escolher um equipamento
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

            novoInput.addEventListener("input", function () {
                this.value = this.value.toUpperCase();
            });

            this.parentNode.replaceChild(novoInput, this);
            adicionarEventoBlurEquipamento();

            if (label) {
                label.style.display = "block";
                label.textContent = "Descrição do Equipamento";
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
            text: error.message || 'Não foi possível carregar os equipamentos.',
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
   
    console.log("PESQUISANDO EQUIPAMENTO:", equipamentos);

    equipamentos.forEach(equipamentosachado => {
        const option = document.createElement("option");
        option.value = equipamentosachado.descequip;
        option.text = equipamentosachado.descequip;
        select.appendChild(option);
    });
 
    return select;
}

function adicionarEventoBlurEquipamento() {
    const input = document.querySelector("#descEquip");
    if (!input) return;
    
    let ultimoClique = null;

    // Captura o último elemento clicado no documento
    document.addEventListener("mousedown", (e) => {
        ultimoClique = e.target;
    });
    
    input.addEventListener("blur", async function () {
       
        const botoesIgnorados = ["Limpar", "Pesquisar", "Enviar"];
        const ehBotaoIgnorado =
            ultimoClique?.id && botoesIgnorados.includes(ultimoClique.id) ||
            ultimoClique?.classList.contains("close");

        if (ehBotaoIgnorado) {
            console.log("🔁 Blur ignorado: clique em botão de controle (Fechar/Limpar/Pesquisar).");
            return;
        }

        const desc = this.value.trim();
        console.log("Campo descEquip procurado:", desc);

        if (!desc) return;

        try {
            await carregarEquipamentoDescricao(desc, this);
            console.log("Equipamento selecionado depois de carregarEquipamentoDescricao:", this.value);
        } catch (error) {
            console.error("Erro ao buscar Equipamento:", error);
        }
    });
}

async function carregarEquipamentoDescricao(desc, elementoAtual) {
    try {
        const response = await fetchComToken(`/equipamentos?descEquip=${encodeURIComponent(desc)}`);
        if (!response.ok) throw new Error("Equipamento não encontrado");

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
        console.warn("Erro ao buscar equipamento:", error);

        const inputIdEquip = document.querySelector("#idEquip");
        const podeCadastrar = temPermissao("Equipamentos", "cadastrar");

        if (!inputIdEquip.value && podeCadastrar) {
            const resultado = await Swal.fire({
                icon: 'question',
                title: `Deseja cadastrar "${desc.toUpperCase()}" como novo Equipamento?`,
                text: `Equipamento "${desc.toUpperCase()}" não encontrado.`,
                showCancelButton: true,
                confirmButtonText: "Sim, cadastrar",
                cancelButtonText: "Cancelar",
                reverseButtons: true,
                focusCancel: true
            });

            
            if (!resultado.isConfirmed) {
                console.log("Usuário cancelou o cadastro do Equipamento.");
                elementoAtual.value = ""; // Limpa o campo se não for cadastrar
                setTimeout(() => {
                    elementoAtual.focus();
                }, 0);
                return;
            }
        } else if (!podeCadastrar) {
            Swal.fire({
                icon: "info",
                title: "Equipamento não cadastrado",
                text: "Você não tem permissão para cadastrar equipamentos.",
                confirmButtonText: "OK"
            });
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
    mode: "cors",
    // se precisar enviar cookies de sessão:
    credentials: "include"
  });
}


function limparCamposEquipamento() {
       
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
        adicionarEventoBlurEquipamento()

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
    adicionarEventoBlurEquipamento();
    console.log("Entrou configurar Equipamento no EQUIPAMENTO.js.");
    

} 
window.configurarEventosEquipamento = configurarEventosEquipamento;

function configurarEventosEspecificos(modulo) {
  console.log("⚙️ configurarEventosEspecificos recebeu:", modulo);
  if (modulo.trim().toLowerCase() === 'equipamentos') {
    configurarEventosEquipamento();
  }
}
window.configurarEventosEspecificos = configurarEventosEspecificos;