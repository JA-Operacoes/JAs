import { fetchComToken } from '../utils/utils.js';

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

            await Swal.fire("Sucesso!", respostaApi.message || "Suprimento salvo com sucesso.", "success");
            limparCamposMontagem();

        } catch (error) {
            console.error("Erro ao enviar dados:", error);
            Swal.fire("Erro", error.message || "Erro ao salvar suprimento.", "error");
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

            if (resultado.isConfirmed) {                
                console.log(`Usuário optou por cadastrar: ${desc}`);
                document.querySelector("#idMontagem").value = "";
                document.querySelector("#qtdPavilhao").value = "";
                criarInputsPavilhoes(0); 
                MontagemOriginal.qtdPavilhao = ""; 
                MontagemOriginal.pavilhoes = []; 
            }
            if (!resultado.isConfirmed) {
                console.log("Usuário cancelou o cadastro do Local de Montagem.");
                elementoAtual.value = ""; // Limpa o campo se não for cadastrar
                
                setTimeout(() => {
                    elementoAtual.focus();
                }, 0);
                limparCamposMontagem();
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

//   console.log("Resposta da requisição LocalMontagem.js:", resposta);

//   let responseBody = null;
//   try {     
//       responseBody = await resposta.json();
//   } catch (jsonError) {    
//       try {
//           responseBody = await resposta.text();
//       } catch (textError) {        
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
//       window.location.href = "login.html"; 
//     });
   
//     throw new Error('Sessão expirada'); 
//   }

//   if (!resposta.ok) {        
//         const errorMessage = (responseBody && responseBody.erro) || (responseBody && responseBody.message) || responseBody || resposta.statusText;
//         throw new Error(`Erro na requisição: ${errorMessage}`);
//   }

//   return responseBody;
// }

function criarInputsPavilhoes(quantidade, pavilhoesExistentes = []) {
    const container = document.getElementById('inputsPavilhoes');
    container.innerHTML = ''; // Limpa inputs anteriores

    const numQuantidade = parseInt(quantidade);
    if (isNaN(numQuantidade) || numQuantidade <= 0) {
        return; // Não cria inputs se a quantidade for inválida ou zero
    }

    for (let i = 0; i < numQuantidade; i++) { // ✅ Loop de 0 a quantidade-1
        const div = document.createElement('div');
        div.classList.add('form2');

        const input = document.createElement('input');
        input.type = 'text';
        input.name = 'nmPavilhao[]';
        input.id = `nmPavilhao${i + 1}`; // ID começa em 1
        input.required = true;
        input.classList.add('uppercase');

        if (numQuantidade > 0) {
            input.required = true; 
        } else {
            input.required = false; // Garante que não é obrigatório se for 0
        }

        // Preenche com dados existentes se houver
        if (pavilhoesExistentes[i]) {
            input.value = pavilhoesExistentes[i].nmpavilhao;
            input.dataset.idpavilhao = pavilhoesExistentes[i].idpavilhao; // ✅ Guarda o ID do pavilhão no dataset
        }

        input.addEventListener("input", function() {
            this.value = this.value.toUpperCase();
        });


        const label = document.createElement('label');
        label.setAttribute('for', `nmPavilhao${i + 1}`);
        label.textContent = `Nome do Pavilhão ${i + 1}`; // Rótulo para cada pavilhão

        div.appendChild(input);
        div.appendChild(label);
        container.appendChild(div);
    }
  }

  document.querySelector("#qtdPavilhao").addEventListener("input", function() {
    // O evento 'input' é melhor para type="number" pois dispara a cada tecla
    const quantidade = parseInt(this.value);
    if (!isNaN(quantidade) && quantidade >= 0) { // Validação básica antes de chamar
        criarInputsPavilhoes(quantidade);
    } else if (this.value.trim() === '') { // Se o campo for esvaziado, também limpa os pavilhões
        criarInputsPavilhoes(0);
    }
});


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
