import { fetchComToken, aplicarTema } from '../utils/utils.js';

document.addEventListener("DOMContentLoaded", function () {
    const idempresa = localStorage.getItem("idempresa");
    if (idempresa) {
        let tema = idempresa == 1 ? "JA-Oper" : "ES";
        aplicarTema(tema);
    }
});

let descMontagemInputListener = null; 
let descMontagemBlurListener = null; 
let cidadeMontagemInputListener = null; 
let ufMontagemInputListener = null; 
let qtdPavilhaoChangeListener = null; 
let limparMontagemButtonListener = null;
let enviarMontagemButtonListener = null;
let pesquisarMontagemButtonListener = null;
let selectMontagemChangeListener = null; 
let novoInputDescMontagemInputListener = null; 
let novoInputDescMontagemBlurListener = null;  
let isSwalOpen = false;

let MontagemOriginal = {
    idMontagem: "",
    descMontagem: "",
    cidadeMontagem: "",
    ufMontagem: "",
    qtdPavilhao:"",
    pavilhoes: []
};

function verificaMontagem() {

    console.log("Carregando Montagem...");
    
    const botaoLimpar = document.querySelector("#Limpar");
    const botaoEnviar = document.querySelector("#Enviar");
    const botaoPesquisar = document.querySelector("#Pesquisar");
    const form = document.querySelector("#form");

    if (!botaoEnviar || !form) {
        console.error("Formulário ou botão não encontrado no DOM.");
        return;
    }

    botaoLimpar.addEventListener("click", function (event) {
        event.preventDefault(); // Previne o envio padrão do formulário 
        
        limparCamposMontagem();

    });

document.querySelector("#qtdPavilhao").addEventListener("input", async function() {
    if (isSwalOpen) return;

    const novaQuantidade = parseInt(this.value);
    const inputsAtuaisDivs = document.querySelectorAll('#inputsPavilhoes .form2');
    
    const pavilhoesOriginais = [];
    inputsAtuaisDivs.forEach(div => {
        const input = div.querySelector('input');
        if (input) {
            pavilhoesOriginais.push({
                idpavilhao: input.dataset.idpavilhao || null,
                nmpavilhao: input.value
            });
        }
    });
    const quantidadeOriginal = pavilhoesOriginais.length;

    if (novaQuantidade >= quantidadeOriginal) {
        criarInputsPavilhoes(novaQuantidade, pavilhoesOriginais);
        return;
    }

    const pavilhoesParaManter = pavilhoesOriginais.slice(0, novaQuantidade);

    // ✅ Lógica corrigida para encontrar os pavilhões existentes a serem removidos
    const pavilhoesExistentesParaRemover = pavilhoesOriginais.filter(p => p.idpavilhao && !pavilhoesParaManter.some(pM => pM.idpavilhao === p.idpavilhao));
    
    // O console.log foi mantido aqui para depuração final
    console.log("QUANTIDADES", {
        novaQuantidade,
        quantidadeOriginal,
        pavilhoesOriginais,
        pavilhoesParaManter,
        pavilhoesExistentesParaRemover
    });

    if (pavilhoesExistentesParaRemover.length > 0) {
        isSwalOpen = true;

        try {
            const idsParaVerificar = pavilhoesExistentesParaRemover.map(p => parseInt(p.idpavilhao));
            const statusData = await fetchComToken('/localmontagem/pavilhoes-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pavilhoesParaVerificar: pavilhoesExistentesParaRemover })
            });
            
            // const pavilhoesRemoviveis = statusData.pavilhoesRemoviveis;
            // const pavilhoesEmUso = statusData.pavilhoesEmUso;

            // let swalTitle = "Reduzir Pavilhões?";
            // let swalText = "";
            // let confirmButtonText = "";

            // if (pavilhoesEmUso.length > 0) {
            //     const nomesPavilhoesEmUso = pavilhoesEmUso.map(p => `"${p.nmpavilhao}"`).join(', ');
            //     swalText += `O(s) Pavilhão(ões) ${nomesPavilhoesEmUso} não pode(m) ser removido(s) por estar(em) associado(s) a um orçamento. `;
            // }
            
            // if (pavilhoesRemoviveis.length > 0) {
            //     const nomesPavilhoesRemoviveis = pavilhoesRemoviveis.map(p => `"${p.nmpavilhao}"`).join(', ');
            //     swalText += `O(s) Pavilhão(ões) ${nomesPavilhoesRemoviveis} será(ão) removido(s). Deseja continuar?`;
            //     confirmButtonText = "Sim, remover";
            // } else {
            //     swalTitle = "Operação Cancelada";
            //     swalText = `Nenhum dos pavilhões selecionados pode ser removido.`;
            //     confirmButtonText = "Ok";
            // }

            // const { isConfirmed } = await Swal.fire({
            //     title: swalTitle,
            //     text: swalText,
            //     icon: "warning",
            //     showCancelButton: (pavilhoesRemoviveis.length > 0),
            //     confirmButtonText: confirmButtonText,
            //     cancelButtonText: "Cancelar"
            // });
            // isSwalOpen = false;

            const { pavilhoesRemoviveis, pavilhoesEmUso } = statusData;

            let swalTitle = "Remover Pavilhões?";
            let swalText = "";
            let confirmButtonText = "";

            // ✅ NOVO: Constrói a mensagem sobre os pavilhões que NÃO podem ser removidos.
            if (pavilhoesEmUso.length > 0) {
                const nomesPavilhoesEmUso = pavilhoesEmUso.map(p => `"${p.nmpavilhao}"`).join(', ');
                swalText += `O(s) Pavilhão(ões) ${nomesPavilhoesEmUso} não pode(m) ser removido(s) por estar(em) associado(s) a um orçamento. `;
            }

            // ✅ Constrói a mensagem sobre os pavilhões que SERÃO removidos, se houver.
            if (pavilhoesRemoviveis.length > 0) {
                const nomesPavilhoesRemoviveis = pavilhoesRemoviveis.map(p => `"${p.nmpavilhao}"`).join(', ');
                swalText += `O(s) Pavilhão(ões) ${nomesPavilhoesRemoviveis} será(ão) removido(s). Deseja continuar?`;
                confirmButtonText = "Sim, remover";
            } else {
                // Caso não haja nada para remover, a ação será cancelada.
                swalTitle = "Operação Cancelada";
                confirmButtonText = "Ok";
                if (swalText === "") { // Garante que a mensagem não fique vazia
                    swalText = `Nenhum dos pavilhões selecionados pode ser removido.`;
                }
            }

            isSwalOpen = true;
            const { isConfirmed } = await Swal.fire({
                title: swalTitle,
                text: swalText,
                icon: (pavilhoesRemoviveis.length > 0 ? "warning" : "info"),
                showCancelButton: (pavilhoesRemoviveis.length > 0),
                confirmButtonText: confirmButtonText,
                cancelButtonText: "Cancelar"
            });
            isSwalOpen = false;

            if (!isConfirmed || pavilhoesRemoviveis.length === 0) {
                this.value = quantidadeOriginal;
                criarInputsPavilhoes(quantidadeOriginal, pavilhoesOriginais);
                return;
            }

            const idsPavilhoesParaManterFinal = pavilhoesParaManter.map(p => p.idpavilhao);
            pavilhoesEmUso.forEach(p => {
                if (!idsPavilhoesParaManterFinal.includes(p.idpavilhao)) {
                    pavilhoesParaManter.push(p);
                }
            });

            const novaQuantidadeFinal = pavilhoesParaManter.length;
            this.value = novaQuantidadeFinal;
            
            const idMontagem = document.querySelector("#idMontagem").value;
            if (idMontagem) {
                const dadosFormulario = {
                    descMontagem: document.querySelector("#descMontagem").value.trim().toUpperCase(),
                    cidadeMontagem: document.querySelector("#cidadeMontagem").value.trim().toUpperCase(),
                    ufMontagem: document.querySelector("#ufMontagem").value.trim().toUpperCase(),
                    qtdPavilhao: novaQuantidadeFinal,
                    pavilhoes: pavilhoesParaManter
                };
                
                try {
                    const result = await fetchComToken(`/localmontagem/${idMontagem}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(dadosFormulario)
                    });
                    
                    criarInputsPavilhoes(result.localmontagem.qtdpavilhao, result.localmontagem.pavilhoes);
                    
                    Swal.fire({
                        icon: 'success',
                        title: 'Salvo!',
                        text: 'A quantidade de pavilhões foi atualizada com sucesso.',
                        showConfirmButton: false,
                        timer: 1500
                    });

                } catch (error) {
                    console.error("Erro ao salvar a redução de pavilhões:", error);
                    this.value = quantidadeOriginal;
                    criarInputsPavilhoes(quantidadeOriginal, pavilhoesOriginais);
                    Swal.fire({
                        icon: 'error',
                        title: 'Erro!',
                        text: error.message,
                    });
                }
            } else {
                criarInputsPavilhoes(novaQuantidadeFinal, pavilhoesParaManter);
            }

        } catch (error) {
            console.error("Erro ao verificar o status dos pavilhões:", error);
            isSwalOpen = false;
            Swal.fire({
                icon: 'error',
                title: 'Erro!',
                text: 'Não foi possível verificar o status dos pavilhões. Tente novamente.',
            });
            this.value = quantidadeOriginal;
            criarInputsPavilhoes(quantidadeOriginal, pavilhoesOriginais);
        }
    } else {
        // Se nenhum pavilhão existente será removido, a lógica é mais simples.
        const idMontagem = document.querySelector("#idMontagem").value;
        if (idMontagem) {
            const dadosFormulario = {
                descMontagem: document.querySelector("#descMontagem").value.trim().toUpperCase(),
                cidadeMontagem: document.querySelector("#cidadeMontagem").value.trim().toUpperCase(),
                ufMontagem: document.querySelector("#ufMontagem").value.trim().toUpperCase(),
                qtdPavilhao: novaQuantidade,
                pavilhoes: pavilhoesParaManter
            };
            try {
                const result = await fetchComToken(`/localmontagem/${idMontagem}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(dadosFormulario)
                });
                criarInputsPavilhoes(result.localmontagem.qtdpavilhao, result.localmontagem.pavilhoes);
                Swal.fire({
                    icon: 'success',
                    title: 'Salvo!',
                    text: 'A quantidade de pavilhões foi atualizada com sucesso.',
                    showConfirmButton: false,
                    timer: 1500
                });
            } catch (error) {
                console.error("Erro ao salvar a redução de pavilhões:", error);
                Swal.fire({
                    icon: 'error',
                    title: 'Erro!',
                    text: error.message,
                });
            }
        } else {
            criarInputsPavilhoes(novaQuantidade, pavilhoesParaManter);
        }
    }
});

    botaoEnviar.addEventListener("click", async function (event) {
        event.preventDefault(); // Previne o envio padrão do formulário

        console.log("ENVIANDO DADOS DO Montagem PELO Montagem.JS", document);

        const idMontagem = document.querySelector("#idMontagem").value.trim().toString();
        const descMontagem = document.querySelector("#descMontagem").value.trim().toUpperCase();
        const cidadeMontagem = document.querySelector("#cidadeMontagem").value.trim().toUpperCase();
        const ufMontagem = document.querySelector("#ufMontagem").value.trim().toUpperCase();
        const qtdPavilhao = parseInt(document.querySelector("#qtdPavilhao").value.trim()); 
        
        const pavilhoesInputElements = document.querySelectorAll('#inputsPavilhoes input[name="nmPavilhao[]"]');
        const pavilhoes = [];
        let hasEmptyPavilhao = false;

        pavilhoesInputElements.forEach(input => { 
            const nmPavilhao = input.value.trim().toUpperCase();
            pavilhoes.push({
                idpavilhao: input.dataset.idpavilhao ? parseInt(input.dataset.idpavilhao) : null,
                nmpavilhao: nmPavilhao 
            });
            if (nmPavilhao === "" && qtdPavilhao > 0) { // Se qtdPavilhao > 0 E o nome do pavilhão está vazio
                hasEmptyPavilhao = true;
            }
        });
        // Permissões
        const temPermissaoCadastrar = temPermissao("Localmontagem", "cadastrar");
        const temPermissaoAlterar = temPermissao("Localmontagem", "alterar");

        const metodo = idMontagem ? "PUT" : "POST";
    

        if (!idMontagem && !temPermissaoCadastrar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para cadastrar novos locais de montagem.", "error");
        }

        if (idMontagem && !temPermissaoAlterar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para alterar locais de montagem.", "error");
        }

       console.log(isNaN(qtdPavilhao), qtdPavilhao);

       console.log("--- Valores para Validação ---");
    console.log("descMontagem:", descMontagem, " (Vazio/Falso:", !descMontagem, ")");
    console.log("cidadeMontagem:", cidadeMontagem, " (Vazio/Falso:", !cidadeMontagem, ")");
    console.log("ufMontagem:", ufMontagem, " (Vazio/Falso:", !ufMontagem, ")");
    console.log("qtdPavilhao:", qtdPavilhao, " (NaN:", isNaN(qtdPavilhao), ")", " (< 0:", qtdPavilhao < 0, ")");
    console.log("hasEmptyPavilhao:", hasEmptyPavilhao);
    console.log("--- Fim da Checagem de Valores ---");

        if (!descMontagem || !cidadeMontagem || !ufMontagem || isNaN(qtdPavilhao) || qtdPavilhao < 0 || hasEmptyPavilhao) {
           
            Swal.fire({
                icon: 'warning',
                title: 'Campos obrigatórios!',
                text: 'Preencha todos os campos antes de enviar.',
                confirmButtonText: 'Entendi'
            });
            return;
        }
        // 🔍 Comparar com os valores originais
        if (
                      
            parseInt(idMontagem) === parseInt(MontagemOriginal.idMontagem) && 
            descMontagem === MontagemOriginal.descMontagem   &&
            cidadeMontagem === MontagemOriginal.cidadeMontagem  &&   
            ufMontagem === MontagemOriginal.ufMontagem &&
            qtdPavilhao == MontagemOriginal.qtdPavilhao &&   
            JSON.stringify(pavilhoes.map(p => ({idpavilhao: p.idpavilhao, nmpavilhao: p.nmpavilhao})).sort((a,b) => (a.nmpavilhao > b.nmpavilhao) ? 1 : ((b.nmpavilhao > a.nmpavilhao) ? -1 : 0))) === // Compara pavilhões
            JSON.stringify(MontagemOriginal.pavilhoes.map(p => ({idpavilhao: p.idpavilhao, nmpavilhao: p.nmpavilhao})).sort((a,b) => (a.nmpavilhao > b.nmpavilhao) ? 1 : ((b.nmpavilhao > a.nmpavilhao) ? -1 : 0)))
            
        ) {
           
            Swal.fire({
                icon: 'info', // info | success | warning | error | question
                title: 'Nenhuma alteração foi detectada!',
                text: 'Faça alguma alteração antes de salvar.',
                confirmButtonText: 'Entendi'
            });
         
             
            console.log("Nenhuma alteração detectada.");
            return;
        }
    
        const dados = { descMontagem, cidadeMontagem, ufMontagem, qtdPavilhao, pavilhoes };

        const url = idMontagem
            ? `/localmontagem/${idMontagem}`
            : "/localmontagem";
   
        try {
            // Confirma alteração (PUT)
            if (metodo === "PUT") {
                const { isConfirmed } = await Swal.fire({
                    title: "Deseja salvar as alterações?",
                    text: "Você está prestes a atualizar os dados do Local Montagem.",
                    icon: "question",
                    showCancelButton: true,
                    confirmButtonText: "Sim, salvar",
                    cancelButtonText: "Cancelar",
                    reverseButtons: true,
                    focusCancel: true
                });
                if (!isConfirmed) {
                    console.log("Usuário cancelou o cadastro do Local de Montagem.");
                    elementoAtual.value = ""; // Limpa o campo se não for cadastrar
                    setTimeout(() => {
                        elementoAtual.focus();
                    }, 0);
                    return;
                }
            }
            
            console.log("Enviando dados para o servidor:", dados, url, metodo);
            const respostaApi = await fetchComToken(url, {                
                method: metodo,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(dados)
            });            

            await Swal.fire("Sucesso!", respostaApi.message || "Local Montagem salvo com sucesso.", "success");
            limparCamposMontagem();

        } catch (error) {
            console.error("Erro ao enviar dados:", error);
            Swal.fire("Erro", error.message || "Erro ao salvar Local Montagem.", "error");
        }
    });
    
    console.log("botaoPesquisar", botaoPesquisar);
    botaoPesquisar.addEventListener("click", async function (event) {
        event.preventDefault();

        limparCamposMontagem();

        console.log("Pesquisando Montagem...");
        const temPermissaoPesquisar = temPermissao('Localmontagem', 'pesquisar');
        if (!temPermissaoPesquisar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para pesquisar.", "warning");
        }

        
        try {
            const montagem = await fetchComToken("/localmontagem"); // ajuste a rota conforme sua API
           
            const select = criarSelectMontagem(montagem);
            limparCamposMontagem();

            const input = document.querySelector("#descMontagem");
  
            // Substituir o input pelo select
            
            if (input && input.parentNode) {
                input.parentNode.replaceChild(select, input);
            }

            const label = document.querySelector('label[for="descMontagem"]');
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

                await carregarLocalMontagem(desc, this);
                   
                const novoInput = document.createElement("input");
                novoInput.type = "text";
                novoInput.id = "descMontagem";
                novoInput.name = "descMontagem";
                novoInput.required = true;
                novoInput.className = "form";
                novoInput.value = desc;
                novoInput.classList.add('uppercase');
      
                novoInput.addEventListener("input", function() {
                    this.value = this.value.toUpperCase(); // transforma o texto em maiúsculo à medida que o usuário digita
                });

                this.parentNode.replaceChild(novoInput, this);
                adicionarEventoBlurMontagem();

                const label = document.querySelector('label[for="descMontagem"]');
                if (label) {
                label.style.display = "block";
                label.textContent = "Local de Montagem"; // ou algum texto que você tenha guardado
                }

                novoInput.addEventListener("blur", async function () {
                    if (!this.value.trim()) return;
                    await carregarLocalMontagem(this.value, this);
                });

        
            });
   
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
async function salvarDadosMontagem(dados, idMontagem, metodo) {
    const url = idMontagem ? `/localmontagem/${idMontagem}` : "/localmontagem";
    try {
        const respostaApi = await fetchComToken(url, {
            method: metodo,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(dados)
        });

        if (!respostaApi.ok) {
            const errorData = await respostaApi.json();
            throw new Error(errorData.message || 'Erro ao salvar o Local de Montagem.');
        }

        const result = await respostaApi.json();

        // Assume que `limparCamposMontagem` é uma função existente
        limparCamposMontagem(); 

        await Swal.fire("Sucesso!", result.message || "Local de Montagem salvo com sucesso.", "success");
        return true; // Retorna true em caso de sucesso
    } catch (error) {
        console.error("Erro ao enviar dados:", error);
        Swal.fire("Erro", error.message || "Erro ao salvar Local de Montagem.", "error");
        return false; // Retorna false em caso de erro
    }
}

function adicionarListenersAoInputDescMontagem(inputElement) {
    // Remove listeners anteriores para evitar duplicidade
    if (descMontagemInputListener) {
        inputElement.removeEventListener("input", descMontagemInputListener);
    }
    if (descMontagemBlurListener) {
        inputElement.removeEventListener("blur", descMontagemBlurListener);
    }

    descMontagemInputListener = function () {
        this.value = this.value.toUpperCase();
    };
    inputElement.addEventListener("input", descMontagemInputListener);

    descMontagemBlurListener = async function () {
        if (!this.value.trim()) return;
        console.log("Campo descMontagem procurado (blur dinâmico):", this.value);
        // await carregarLocalMontagem(this.value, this); // Esta linha precisa ser reconsiderada aqui,
        // pois o blur após a pesquisa não deve acionar o carregamento novamente,
        // ele já foi carregado pelo 'change' do select.
        // O blur é mais útil para um "novo" input que não veio de uma seleção.
        // Mantenha apenas se a lógica de negócio exigir.
    };
    inputElement.addEventListener("blur", descMontagemBlurListener);
}

function resetarCampoDescMontagemParaInput() {
    const descMontagemCampo = document.getElementById("descMontagem");
    // Verifica se o campo atual é um select e o substitui por um input
    if (descMontagemCampo && descMontagemCampo.tagName.toLowerCase() === "select") {
        const input = document.createElement("input");
        input.type = "text";
        input.id = "descMontagem";
        input.name = "descMontagem";
        input.value = ""; // Limpa o valor
        input.placeholder = "Descrição do Local de Montagem";
        input.className = "form";
        input.classList.add('uppercase');
        input.required = true;

        // Remove o listener do select antes de substituí-lo
        if (selectMontagemChangeListener) {
            descMontagemCampo.removeEventListener("change", selectMontagemChangeListener);
            selectMontagemChangeListener = null;
        }

        descMontagemCampo.parentNode.replaceChild(input, descMontagemCampo);
        adicionarListenersAoInputDescMontagem(input); // Adiciona os listeners ao novo input

        const label = document.querySelector('label[for="descMontagem"]');
        if (label) {
            label.style.display = "block";
            label.textContent = "Local de Montagem";
        }
    }
}


// =============================================================================
// Função de Desinicialização do Módulo Local Montagem
// =============================================================================
function desinicializarLocalMontagemModal() {
    console.log("🧹 Desinicializando módulo Local Montagem.js...");

    const descMontagemElement = document.querySelector("#descMontagem");
    const cidadeMontagemElement = document.querySelector("#cidadeMontagem");
    const ufMontagemElement = document.querySelector("#ufMontagem");
    const qtdPavilhaoElement = document.querySelector("#qtdPavilhao");
    const botaoLimpar = document.querySelector("#Limpar");
    const botaoEnviar = document.querySelector("#Enviar");
    const botaoPesquisar = document.querySelector("#Pesquisar");

    // 1. Remover listeners de eventos dos elementos fixos
    if (botaoLimpar && limparMontagemButtonListener) {
        botaoLimpar.removeEventListener("click", limparMontagemButtonListener);
        limparMontagemButtonListener = null;
        console.log("Listener de click do Limpar (Local Montagem) removido.");
    }
    if (botaoEnviar && enviarMontagemButtonListener) {
        botaoEnviar.removeEventListener("click", enviarMontagemButtonListener);
        enviarMontagemButtonListener = null;
        console.log("Listener de click do Enviar (Local Montagem) removido.");
    }
    if (botaoPesquisar && pesquisarMontagemButtonListener) {
        botaoPesquisar.removeEventListener("click", pesquisarMontagemButtonListener);
        pesquisarMontagemButtonListener = null;
        console.log("Listener de click do Pesquisar (Local Montagem) removido.");
    }

    // 2. Remover listeners dos campos de input (que podem ser input ou select)
    if (descMontagemElement) {
        if (descMontagemElement.tagName.toLowerCase() === "input") {
            if (descMontagemInputListener) { // Listener para 'input' (toUpperCase)
                descMontagemElement.removeEventListener("input", descMontagemInputListener);
                descMontagemInputListener = null;
                console.log("Listener de input do descMontagem (input) removido.");
            }
            if (descMontagemBlurListener) { // Listener para 'blur' (carregar descrição)
                descMontagemElement.removeEventListener("blur", descMontagemBlurListener);
                descMontagemBlurListener = null;
                console.log("Listener de blur do descMontagem (input) removido.");
            }
        } else if (descMontagemElement.tagName.toLowerCase() === "select" && selectMontagemChangeListener) {
            descMontagemElement.removeEventListener("change", selectMontagemChangeListener);
            selectMontagemChangeListener = null;
            console.log("Listener de change do select descMontagem removido.");
        }
    }
    if (cidadeMontagemElement && cidadeMontagemInputListener) {
        cidadeMontagemElement.removeEventListener("input", cidadeMontagemInputListener);
        cidadeMontagemInputListener = null;
        console.log("Listener de input do cidadeMontagem removido.");
    }
    if (ufMontagemElement && ufMontagemInputListener) {
        ufMontagemElement.removeEventListener("input", ufMontagemInputListener);
        ufMontagemInputListener = null;
        console.log("Listener de input do ufMontagem removido.");
    }
    if (qtdPavilhaoElement && qtdPavilhaoChangeListener) {
        qtdPavilhaoElement.removeEventListener("change", qtdPavilhaoChangeListener);
        qtdPavilhaoChangeListener = null;
        console.log("Listener de change do qtdPavilhao removido.");
    }

    // Remover listeners dos inputs de pavilhões gerados dinamicamente
    // Esta parte é um pouco mais complexa porque os listeners são anônimos
    // ou não armazenados em variáveis globais facilmente removíveis individualmente.
    // A melhor abordagem é limpar o container e resetar os campos.
    document.querySelectorAll('#inputsPavilhoes input[name="nmPavilhao[]"]').forEach(input => {
        // Se você adicionou um listener anônimo ou direto, não há como removê-lo facilmente.
        // A estratégia de limpar o innerHTML do container #inputsPavilhoes já "destrói" os elementos
        // e, consequentemente, remove seus listeners.
        // O `uppercase-listener-added` foi apenas para evitar duplicidade na adição, não para remoção.
    });


    // 3. Limpar o estado global e campos do formulário
    MontagemOriginal = null; // Zera o objeto de local de montagem original
    limparCamposMontagem(); // Limpa todos os campos visíveis do formulário
 //   document.querySelector("#form").reset(); // Garante que o formulário seja completamente resetado
    document.querySelector("#idMontagem").value = ""; // Limpa o ID oculto
    document.querySelector("#inputsPavilhoes").innerHTML = ''; // Garante que os inputs de pavilhões sejam removidos
    document.querySelector("#qtdPavilhao").value = ''; // Reseta a quantidade de pavilhões
    resetarCampoDescMontagemParaInput(); // Garante que o campo descMontagem volte a ser um input padrão


    console.log("✅ Módulo Local Montagem.js desinicializado.");
}

function criarSelectMontagem(montagem) {
    const select = document.createElement("select");
    select.id = "descMontagem";
    select.name = "descMontagem";
    select.required = true;
    select.className = "form";

   // limparCamposMontagem();

    const defaultOption = document.createElement("option");
    defaultOption.value = "";
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

if (!window.ultimoClique) {
    window.ultimoClique = null;
  
}
// Captura o último elemento clicado no documento (uma única vez)
document.addEventListener("mousedown", (e) => {
    window.ultimoClique = e.target;
});


function adicionarEventoBlurMontagem() {
    const input = document.querySelector("#descMontagem");
    if (!input) return;   
    
    input.addEventListener("blur", async function () {
       
        const botoesIgnorados = ["Limpar", "Pesquisar", "Enviar"];
        const ehBotaoIgnorado =
            ultimoClique?.id && botoesIgnorados.includes(ultimoClique.id) ||
            (ultimoClique?.classList && ultimoClique.classList.contains("close"));

        if (ehBotaoIgnorado) {
            console.log("🔁 Blur ignorado: clique em botão de controle (Fechar/Limpar/Pesquisar).");
            return;
        }

        const desc = this.value.trim();
        console.log("Campo descMontagem procurado:", desc);

        if (!desc) return;

        try {
            await carregarLocalMontagem(desc, this);
            console.log("Local Montagem selecionado depois de carregarLocalMontagem:", this.value);
        } catch (error) {
            console.error("Erro ao buscar Local Montagem:", error);
        }
    });
}

async function carregarLocalMontagem(desc, elementoAtual) {
    try {
        const montagem = await fetchComToken(`/localmontagem?descmontagem=${encodeURIComponent(desc.trim())}`);
             console.log("Dados da montagem recebidos no frontend:", montagem);  
        document.querySelector("#idMontagem").value = montagem.idmontagem;
        document.querySelector("#descMontagem").value = montagem.descmontagem;
        document.querySelector("#cidadeMontagem").value = montagem.cidademontagem;
        document.querySelector("#ufMontagem").value = montagem.ufmontagem;
        document.querySelector("#qtdPavilhao").value = montagem.qtdpavilhao;

        criarInputsPavilhoes(montagem.qtdpavilhao, montagem.pavilhoes);
        
        MontagemOriginal = {
            idMontagem: montagem.idmontagem,
            descMontagem: montagem.descmontagem,
            cidadeMontagem: montagem.cidademontagem,
            ufMontagem: montagem.ufmontagem,
            qtdPavilhao:montagem.qtdpavilhao,
            pavilhoes: montagem.pavilhoes || [] 
            
        };
     
          
    }  catch (error) {
        
        console.warn("Local de Montagem não encontrado.");

        const inputIdMontagem = document.querySelector("#idMontagem");
        const podeCadastrarMontagem = temPermissao("Localmontagem", "cadastrar");
        console.log("podeCadastrarMontagem", podeCadastrarMontagem, inputIdMontagem.value);
       if (!inputIdMontagem.value && podeCadastrarMontagem) {
             const resultado = await Swal.fire({
                icon: 'question',
                title: `Deseja cadastrar "${desc.toUpperCase()}" como novo Local de Montagem?`,
                text: `Local de Montagem "${desc.toUpperCase()}" não encontrado.`,
                showCancelButton: true,
                confirmButtonText: "Sim, cadastrar",
                cancelButtonText: "Cancelar",
                reverseButtons: true,
                focusCancel: true
            });
            console.log("resultado", resultado);
            if (resultado.isConfirmed) {                
                console.log(`Usuário optou por cadastrar: ${desc}`);
               
                document.querySelector("#idMontagem").value = "";
                document.querySelector("#cidadeMontagem").value = ""; // Limpa os outros campos, pois é um novo cadastro
                document.querySelector("#ufMontagem").value = "";
                document.querySelector("#qtdPavilhao").value = "";
                criarInputsPavilhoes(0); 
                // MontagemOriginal.qtdPavilhao = ""; 
                // MontagemOriginal.pavilhoes = []; 
                MontagemOriginal = {
                    idMontagem: null,
                    descMontagem: desc.toUpperCase(),
                    cidadeMontagem: "",
                    ufMontagem: "",
                    qtdPavilhao: 0,
                    pavilhoes: []
                };
            }
            if (!resultado.isConfirmed) {
                console.log("Usuário cancelou o cadastro do Local de Montagem.");
                elementoAtual.value = ""; // Limpa o campo se não for cadastrar
                
                setTimeout(() => {
                    elementoAtual.focus();
                }, 0);
               // limparCamposMontagem();
                return;
            }
            
        } else if (!podeCadastrarMontagem) {
            Swal.fire({
                icon: "info",
                title: "Local de Montagem não cadastrado",
                text: "Você não tem permissão para cadastrar local de montagem.",
                confirmButtonText: "OK"
            });
        }
    }
    
}

function limparMontagemOriginal() {
    MontagemOriginal = {
        idMontagem: "",
        descMontagem: "",
        cidadeMontagem: "",
        ufMontagem: "",
        qtdPavilhao:"",
        pavilhoes: []
    };
}

function limparCamposMontagem() {
    const campos = ["idMontagem", "cidadeMontagem", "ufMontagem", "descMontagem", "qtdPavilhao"];
    campos.forEach(id => {
        const campo = document.getElementById(id);
        if (campo) campo.value = "";
    });

    const containerPavilhoes = document.getElementById('inputsPavilhoes');
    if (containerPavilhoes) {
        containerPavilhoes.innerHTML = '';
    }

    const idMontagem = document.getElementById("idMontagem");
    const descMontagemEl = document.getElementById("descMontagem");
        

    if (idMontagem) idMontagem.value = "";
    

    if (descMontagemEl && descMontagemEl.tagName === "SELECT") {
        // Se for SELECT, trocar por INPUT
        const novoInput = document.createElement("input");
        novoInput.type = "text";
        novoInput.id = "descMontagem";
        novoInput.name = "descMontagem";
        novoInput.required = true;
        novoInput.className = "form";
        novoInput.classList.add('uppercase');
      

        // Configura o evento de transformar texto em maiúsculo
        novoInput.addEventListener("input", function () {
            this.value = this.value.toUpperCase();
        });

        // Reativa o evento blur
        novoInput.addEventListener("blur", async function () {
            if (!this.value.trim()) return;
            await carregarLocalMontagem(this.value, this);
        });

        descMontagemEl.parentNode.replaceChild(novoInput, descMontagemEl);
        adicionarEventoBlurMontagem();

        const label = document.querySelector('label[for="descMontagem"]');
        if (label) {
            label.style.display = "block";
            label.textContent = "Local de Montagem";
        }
    } else if (descMontagemEl) {
        // Se for input normal, só limpa
        descMontagemEl.value = "";
    }
    
}



//antigo
// function criarInputsPavilhoes(quantidade, pavilhoesExistentes = []) {
//     const container = document.getElementById('inputsPavilhoes');
//     container.innerHTML = ''; // Limpa inputs anteriores

//     const numQuantidade = parseInt(quantidade);
//     if (isNaN(numQuantidade) || numQuantidade <= 0) {
//         return; // Não cria inputs se a quantidade for inválida ou zero
//     }

//     for (let i = 0; i < numQuantidade; i++) { // ✅ Loop de 0 a quantidade-1
//         const div = document.createElement('div');
//         div.classList.add('form2');

//         const input = document.createElement('input');
//         input.type = 'text';
//         input.name = 'nmPavilhao[]';
//         input.id = `nmPavilhao${i + 1}`; // ID começa em 1
//         input.required = true;
//         input.classList.add('uppercase');

//         if (numQuantidade > 0) {
//             input.required = true; 
//         } else {
//             input.required = false; // Garante que não é obrigatório se for 0
//         }

//         // Preenche com dados existentes se houver
//         if (pavilhoesExistentes[i]) {
//             input.value = pavilhoesExistentes[i].nmpavilhao;
//             input.dataset.idpavilhao = pavilhoesExistentes[i].idpavilhao; // ✅ Guarda o ID do pavilhão no dataset
//         }

//         input.addEventListener("input", function() {
//             this.value = this.value.toUpperCase();
//         });


//         const label = document.createElement('label');
//         label.setAttribute('for', `nmPavilhao${i + 1}`);
//         label.textContent = `Nome do Pavilhão ${i + 1}`; // Rótulo para cada pavilhão

//         div.appendChild(input);
//         div.appendChild(label);
//         container.appendChild(div);
//     }
//   }

//   document.querySelector("#qtdPavilhao").addEventListener("input", function() {
//     // O evento 'input' é melhor para type="number" pois dispara a cada tecla
//     const quantidade = parseInt(this.value);
//     if (!isNaN(quantidade) && quantidade >= 0) { // Validação básica antes de chamar
//         criarInputsPavilhoes(quantidade);
//     } else if (this.value.trim() === '') { // Se o campo for esvaziado, também limpa os pavilhões
//         criarInputsPavilhoes(0);
//     }
// });

function criarInputsPavilhoes(quantidade, pavilhoesExistentes = []) {
    const container = document.getElementById('inputsPavilhoes');
    container.innerHTML = ''; // Limpa todos os inputs anteriores para evitar duplicatas ou inconsistências

    const numQuantidade = parseInt(quantidade);
    if (isNaN(numQuantidade) || numQuantidade <= 0) {
        return; // Não faz nada se a quantidade for inválida ou zero
    }

    for (let i = 0; i < numQuantidade; i++) {
        const div = document.createElement('div');
        div.classList.add('form2');

        const input = document.createElement('input');
        input.type = 'text';
        input.name = 'nmPavilhao[]';
        input.id = `nmPavilhao${i + 1}`;
        input.required = true;
        input.classList.add('uppercase');

        // ✅ Lógica para PREENCHER o input com os dados existentes
        if (pavilhoesExistentes[i]) {
            input.value = pavilhoesExistentes[i].nmpavilhao;
            input.dataset.idpavilhao = pavilhoesExistentes[i].idpavilhao;
            input.dataset.nomeOriginal = pavilhoesExistentes[i].nmpavilhao; // Armazena o nome original para a verificação
        }

        input.addEventListener("input", function() {
            this.value = this.value.toUpperCase();
        });

        // Evento para verificar a alteração do nome com Swal (o que você já tinha)
        input.addEventListener("blur", async function() {
            if (this.dataset.idpavilhao && this.value !== this.dataset.nomeOriginal) {
                const { isConfirmed } = await Swal.fire({
                    title: "Alterar nome do Pavilhão?",
                    text: "O nome deste pavilhão será alterado. Se ele estiver associado a um orçamento, a alteração será refletida em todos os orçamentos. Deseja continuar?",
                    icon: "info",
                    showCancelButton: true,
                    confirmButtonText: "Sim, alterar",
                    cancelButtonText: "Cancelar"
                });
                if (!isConfirmed) {
                    this.value = this.dataset.nomeOriginal;
                } else {
                    this.dataset.nomeOriginal = this.value;
                }
            }
        });

        const label = document.createElement('label');
        label.setAttribute('for', `nmPavilhao${i + 1}`);
        label.textContent = `Nome do Pavilhão ${i + 1}`;

        div.appendChild(input);
        div.appendChild(label);
        container.appendChild(div);
    }
}

function configurarEventosMontagem() {
    console.log("Configurando eventos Montagem...");
    verificaMontagem(); // Carrega os Montagem ao abrir o modal
    adicionarEventoBlurMontagem();
    console.log("Entrou configurar Montagem no MONTAGEM.js.");
    

} 
window.configurarEventosMontagem = configurarEventosMontagem;

function configurarEventosEspecificos(modulo) {
  console.log("⚙️ configurarEventosEspecificos recebeu:", modulo);
  if (modulo.trim().toLowerCase() === 'localmontagem') {
    console.log("Modulo", modulo.trim().toLowerCase() );
    configurarEventosMontagem();

    if (typeof aplicarPermissoes === "function" && window.permissoes) {
      aplicarPermissoes(window.permissoes);
    } else {
      console.warn("⚠️ aplicarPermissoes ou window.permissoes ainda não estão disponíveis para LocalMontagem.");
    }
  }
}
window.configurarEventosEspecificos = configurarEventosEspecificos;

window.moduloHandlers = window.moduloHandlers || {};
window.moduloHandlers['LocalMontagem'] = { // A chave 'LocalMontagem' (com L e M maiúsculos) deve corresponder ao seu Index.js
    configurar: configurarEventosMontagem,
    desinicializar: desinicializarLocalMontagemModal
};