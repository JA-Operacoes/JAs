import { fetchComToken } from '../utils/utils.js';

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

            const respostaApi = await fetchComToken(url, {
                method: metodo,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(dados)
            });            

            await Swal.fire("Sucesso!", respostaApi.message || "Equipamento salvo com sucesso.", "success");
            limparCamposEquipamento();

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
        const equipamentos = await fetchComToken("/equipamentos");        

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

if (!window.ultimoClique) {
    window.ultimoClique = null;
  
}
document.addEventListener("mousedown", (e) => {
    window.ultimoClique = e.target;
});

function adicionarEventoBlurEquipamento() {
    const input = document.querySelector("#descEquip");
    if (!input) return;   
    
    
    input.addEventListener("blur", async function () {
       
        const botoesIgnorados = ["Limpar", "Pesquisar", "Close"];
        const ehBotaoIgnorado =
            (ultimoClique?.id && botoesIgnorados.includes(ultimoClique.id)) ||
            (ultimoClique?.classList && ultimoClique.classList.contains("close"));

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
        const equipamentos = await fetchComToken(`/equipamentos?descEquip=${encodeURIComponent(desc)}`);
       
        if (!equipamentos || !equipamentos.idequip) throw new Error("Equipamento não encontrada");
     
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
        //console.warn("Erro ao buscar equipamento:", error);

        const temPermissaoCadastrar = temPermissao("Equipamentos", "cadastrar");
        const temPermissaoAlterar = temPermissao("Equipamentos", "alterar");

        const metodo = idEquip ? "PUT" : "POST";

        if (!idEquip && !temPermissaoCadastrar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para cadastrar novos equipamentos.", "error");
        }

        if (idEquip && !temPermissaoAlterar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para alterar equipamentos.", "error");
        }

        if (!descEquip) {
            return Swal.fire("Campos obrigatórios!", "Preencha todos os campos antes de enviar.", "warning");
        }

        const dados = { descEquip };        

        if (parseInt(idEquip) === parseInt(window.EquipamentoOriginal?.idEquip)) {
            console.log("Equipamento não alterado, não será enviado.");
        }
        if (descEquip === window.EquipamentoOriginal?.descEquip) {
            console.log("Equipamento não alterado, não será enviado.");
        }
        // Verifica alterações
        if (

            parseInt(idEquip) === parseInt(window.EquipamentoOriginal?.idEquip) &&
            descEquip === window.EquipamentoOriginal?.descEquip
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
                    text: "Você está prestes a atualizar os dados do Equipamento.",
                    icon: "question",
                    showCancelButton: true,
                    confirmButtonText: "Sim, salvar",
                    cancelButtonText: "Cancelar",
                    reverseButtons: true,
                    focusCancel: true
                });
                if (!isConfirmed) return;
            }

            console.log("Enviando dados para o servidor:", dados, url, metodo);
            const respostaApi = await fetchComToken(url, {
                method: metodo,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(dados)
            });            

            await Swal.fire("Sucesso!", respostaApi.message || "Equipamento salvo com sucesso.", "success");
            limparCamposEquipamento();

        } catch (error) {
            console.error("Erro ao enviar dados:", error);
            Swal.fire("Erro", error.message || "Erro ao salvar equipamento.", "error");
        }

        // const inputIdEquip = document.querySelector("#idEquip");
        // const podeCadastrar = temPermissao("Equipamentos", "cadastrar");

        // console.log("Valor de inputIdEquip.value:", inputIdEquip.value, podeCadastrar);
        // if (!inputIdEquip.value) {
        //     console.log("Detectado Equipamento não encontrado e usuário tem permissão para cadastrar.");
        //     const resultado = await Swal.fire({
        //         icon: 'question',
        //         title: `Deseja cadastrar "${desc.toUpperCase()}" como novo Equipamento?`,
        //         text: `Equipamento "${desc.toUpperCase()}" não encontrado.`,
        //         showCancelButton: true,
        //         confirmButtonText: "Sim, cadastrar",
        //         cancelButtonText: "Cancelar",
        //         reverseButtons: true,
        //         focusCancel: true
        //     });

        //     console.log("Resultado bruto do Swal.fire:", resultado);
        //     if (resultado.isConfirmed) {
        //         console.log("DEBUG: Swal.fire CONFIRMADO! Prosseguindo...");
        //         console.log("Valor de elementoAtual.value APÓS CONFIRMAÇÃO (deve ser o digitado):", elementoAtual.value); // Log após confirmação
        //         // Nenhuma ação de limpeza aqui. O campo deve permanecer com o valor.
        //     } else { // Usuário clicou em Cancelar ou descartou o modal
        //         console.log("DEBUG: Swal.fire CANCELADO ou DISMISSADO. Detalhes:", resultado);
        //         console.log("DEBUG: Limpando elementoAtual.value, pois não foi confirmado o cadastro."); // Log antes de limpar
        //         elementoAtual.value = ""; // Limpa o campo se não for cadastrar
        //         setTimeout(() => {
        //             elementoAtual.focus();
        //         }, 0);
        //         return; // Sai da função carregarEquipamentoDescricao
        //     }
        // } else if (!podeCadastrar) {
        //     console.log("Equipamento não encontrado, mas usuário NÃO tem permissão para cadastrar.");
        //     Swal.fire({
        //         icon: "info",
        //         title: "Equipamento não cadastrado",
        //         text: "Você não tem permissão para cadastrar equipamentos.",
        //         confirmButtonText: "OK"
        //     });
        //     // Se não tem permissão e não encontrou, limpa o campo também para evitar confusão.
        //     elementoAtual.value = ""; 
        //     setTimeout(() => {
        //         elementoAtual.focus();
        //     }, 0);
        //     return; // Sai da função carregarEquipamentoDescricao
        // }
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

// async function fetchComToken(url, options = {}) {
//   console.log("URL da requisição:", url);
//   const token = localStorage.getItem("token");
//   const idempresa = localStorage.getItem("idempresa");

//   console.log("ID da empresa no localStorage:", idempresa);
//   console.log("Token no localStorage:", token);

//   if (!options.headers) options.headers = {};
  
//   if (options.body && typeof options.body === 'string' && options.body.startsWith('{')) {
//         options.headers['Content-Type'] = 'application/json';
//   }else if (options.body && typeof options.body === 'object' && options.headers['Content-Type'] !== 'multipart/form-data') {
       
//         options.body = JSON.stringify(options.body);
//         options.headers['Content-Type'] = 'application/json';
//   }

//   options.headers['Authorization'] = 'Bearer ' + token; 

//   if (
//       idempresa && 
//       idempresa !== 'null' && 
//       idempresa !== 'undefined' && 
//       idempresa.trim() !== '' &&
//       !isNaN(idempresa) && 
//       Number(idempresa) > 0
//   ) {
//       options.headers['idempresa'] = idempresa;
//       console.log('[fetchComToken] Enviando idempresa no header:', idempresa);
//   } else {
//     console.warn('[fetchComToken] idempresa inválido, não será enviado no header:', idempresa);
//   }
//   console.log("URL OPTIONS", url, options)
 
//   const resposta = await fetch(url, options);

//   console.log("Resposta da requisição Equipamentos.js:", resposta);

//   let responseBody = null;
//   try {
//       // Primeiro, tente ler como JSON, pois é o mais comum para APIs
//       responseBody = await resposta.json();
//   } catch (jsonError) {
//       // Se falhar (não é JSON, ou resposta vazia, etc.), tente ler como texto
//       try {
//           responseBody = await resposta.text();
//       } catch (textError) {
//           // Se nem como texto conseguir, assume que não há corpo lido ou que é inválido
//           responseBody = null;
//       }
//   }

//   if (resposta.status === 401) {
//     localStorage.clear();
//     Swal.fire({
//       icon: "warning",
//       title: "Sessão expirada",
//       text: "Por favor, faça login novamente."
//     }).then(() => {
//       window.location.href = "login.html"; // ajuste conforme necessário
//     });
//     //return;
//     throw new Error('Sessão expirada'); 
//   }

//   if (!resposta.ok) {
//         // Se a resposta NÃO foi bem-sucedida (status 4xx ou 5xx)
//         // Use o responseBody já lido para obter a mensagem de erro
//         const errorMessage = (responseBody && responseBody.erro) || (responseBody && responseBody.message) || responseBody || resposta.statusText;
//         throw new Error(`Erro na requisição: ${errorMessage}`);
//   }

//   return responseBody;
// }

// function limparCamposEquipamento() {
       
//     const idEquip = document.getElementById("idEquip");
//     const descEquipEl = document.getElementById("descEquip");
//     const ctoEquip = document.getElementById("ctoEquip");
//     const vdaEquip = document.getElementById("vdaEquip");

//     if (idEquip) idEquip.value = "";
//     if (ctoEquip) ctoEquip.value = "";
//     if (vdaEquip) vdaEquip.value = "";

//     if (descEquipEl && descEquipEl.tagName === "SELECT") {
//         // Se for SELECT, trocar por INPUT
//         const novoInput = document.createElement("input");
//         novoInput.type = "text";
//         novoInput.id = "descEquip";
//         novoInput.name = "descEquip";
//         novoInput.required = true;
//         novoInput.className = "form";

//         // Configura o evento de transformar texto em maiúsculo
//         novoInput.addEventListener("input", function () {
//             this.value = this.value.toUpperCase();
//         });

//         // Reativa o evento blur
//         novoInput.addEventListener("blur", async function () {
//             if (!this.value.trim()) return;
//             await carregarEquipamentoDescricao(this.value, this);
//         });

//         descEquipEl.parentNode.replaceChild(novoInput, descEquipEl);
//         adicionarEventoBlurEquipamento()

//         const label = document.querySelector('label[for="descEquip"]');
//         if (label) {
//             label.style.display = "block";
//             label.textContent = "Descrição do Equipamento";
//         }
//     } else if (descEquipEl) {
//         // Se for input normal, só limpa
//         descEquipEl.value = "";
//     }

// }
function limparCamposEquipamento() {
    const campos = ["idEquip", "descEquip","ctoEquip", "vdaEquip" ];
    campos.forEach(id => {
        const campo = document.getElementById(id);
        if (campo) campo.value = "";
    });
    
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
    
    if (typeof aplicarPermissoes === "function" && window.permissoes) {
      aplicarPermissoes(window.permissoes);
    } else {
      console.warn("⚠️ aplicarPermissoes ou window.permissoes ainda não estão disponíveis para LocalMontagem.");
    }
  }
}
window.configurarEventosEspecificos = configurarEventosEspecificos;