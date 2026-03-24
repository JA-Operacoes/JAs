import { fetchComToken, aplicarTema } from '../utils/utils.js';


let anoIndiceInputListener = null; 
let anoIndiceBlurListener = null; 
let limparIndiceAnualButtonListener = null;
let enviarIndiceAnualButtonListener = null;
let pesquisarIndiceAnualButtonListener = null;
let selectEventoChangeListener = null;
let novoInputAnoIndiceInputListener = null; 
let novoInputAnoIndiceBlurListener = null; 

let IndiceAnualOriginal = {
    idIndice: "",
    anoIndice: "",
    percentCtoVda: "",
    percentAlimentacao: "",
    percentTransporte: ""
};

let empresaLogoPath = 'http://localhost:3000/img/JA_Oper.png';


// Funcao centralizada para buscar dados da empresa e configurar o app
function inicializarDadosEmpresa() {
    const idempresa = localStorage.getItem("idempresa");

    console.log("ID da empresa obtido do localStorage:", idempresa);

    if (idempresa) {
        const apiUrl = `/empresas/${idempresa}`;

        console.log("Buscando dados da empresa na API:", apiUrl);

        fetchComToken(apiUrl)
            .then(empresa => {
                console.log("Dados da empresa recebidos:", empresa);
                const tema = empresa.nmfantasia;
               // aplicarTema(tema);

                console.log("Tema da empresa obtido:", tema);

                // Lógica de construção do caminho do logo
                const nomeArquivoLogo = tema.toUpperCase().replace(/[^A-Z0-9]/g, '_');
                // IMPORTANTE: Aqui definimos a variável global
                empresaLogoPath = `http://localhost:3000/img/${nomeArquivoLogo}.png`;
                
                console.log("Caminho do logo definido:", empresaLogoPath);
            })
            .catch(error => {
                console.error("❌ Erro ao buscar dados da empresa para o tema/logo:", error);
                // Em caso de erro, o logo usa o caminho de fallback
            });
    }
}

// Verifica o estado do DOM e executa a função
// if (document.readyState === "loading") {
//     // O DOM ainda está carregando, então ouvimos o evento
//     document.addEventListener("DOMContentLoaded", inicializarDadosEmpresa);
// } else {
//     // O DOM já está pronto (readyState é 'interactive' ou 'complete'), executa imediatamente
//     console.log("DOM já carregado, executando inicializarDadosEmpresa imediatamente.");
//     inicializarDadosEmpresa();
// }

async function verificaIndiceAnual() {

    inicializarDadosEmpresa();

    console.log("Carregando Índice Anual...");
    
    const botaoEnviar = document.querySelector("#Enviar");
    const botaoPesquisar = document.querySelector("#Pesquisar");
    const botaoLimpar = document.querySelector("#Limpar");
    const botaoAtualizar = document.querySelector("#Atualizar");
    const botaoReverter = document.querySelector("#Reverter");
    const form = document.querySelector("#form"); 

    botaoReverter.classList.add('btn-secondary');
    botaoReverter.disabled = true;
    botaoReverter.textContent = "Reverter Índices";
    botaoReverter.title = "Reverter os índices aplicados anteriormente.";
    
    botaoAtualizar.classList.add('btn-secondary');
    botaoAtualizar.disabled = false;
    botaoAtualizar.textContent = "Atualizar Índices";
    botaoAtualizar.title = "Aplicar os índices de atualização nas Categorias de Função.";

    if (!botaoEnviar || !form) {
        console.error("Formulário ou botão não encontrado no DOM.");
        return;
    }

    botaoLimpar.addEventListener("click", (e) => {
        e.preventDefault();
        limparCamposIndiceAnual();
    });

    botaoEnviar.addEventListener("click", async (e) => {
        e.preventDefault();

        const idIndice = document.querySelector("#idIndice").value.trim();
        const anoIndice = document.querySelector("#anoIndice").value.toUpperCase().trim();
        const percentCtoVda = document.querySelector("#percentCtoVda").value.trim();
        const percentAlimentacao = document.querySelector("#percentAlimentacao").value.trim();
        const percentTransporte = document.querySelector("#percentTransporte").value.trim();

        const percentCtoVdaFormatado = formatarParaEnvio(percentCtoVda);
        const percentAlimentacaoFormatado = formatarParaEnvio(percentAlimentacao);
        const percentTransporteFormatado = formatarParaEnvio(percentTransporte);

        if (!anoIndice || !percentCtoVda || !percentAlimentacao || !percentTransporte) {
            return Swal.fire("Campos obrigatórios", "Por favor, preencha todos os campos.", "warning");
        }
        // Permissões
        const temPermissaoCadastrar = temPermissao("IndiceAnual", "cadastrar");
        const temPermissaoAlterar = temPermissao("IndiceAnual", "alterar");

        const metodo = idIndice ? "PUT" : "POST";

        if (!idIndice && !temPermissaoCadastrar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para cadastrar índices anuais.", "error");
        }

        if (idIndice && !temPermissaoAlterar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para alterar índices anuais.", "error");
        }
        

        // ✅ Incluir o array de clientes no objeto de dados
        const dados = { 
            anoIndice, 
            percentCtoVda: percentCtoVdaFormatado, 
            percentAlimentacao: percentAlimentacaoFormatado, 
            percentTransporte: percentTransporteFormatado 
        };       

        // ✅ Verifica se houve alguma alteração 
        const anoIndiceAlterado = anoIndice !== window.IndiceAnualOriginal?.anoIndice;
        const percentCtoVdaAlterado = percentCtoVdaFormatado !== window.IndiceAnualOriginal?.percentCtoVda; // USANDO FORMATADO
        const percentAlimentacaoAlterado = percentAlimentacaoFormatado !== window.IndiceAnualOriginal?.percentAlimentacao; // USANDO FORMATADO
        const percentTransporteAlterado = percentTransporteFormatado !== window.IndiceAnualOriginal?.percentTransporte; // USANDO FORMATADO

        if (metodo === "PUT" && !anoIndiceAlterado && !percentCtoVdaAlterado && !percentAlimentacaoAlterado && !percentTransporteAlterado) {
            return Swal.fire("Nenhuma alteração foi detectada!", "Faça alguma alteração antes de salvar.", "info");
        }

        const url = idIndice
            ? `/indiceanual/${idIndice}`
            : "/indiceanual";

        try {
            // Confirma alteração (PUT)
            if (metodo === "PUT") {
                const { isConfirmed } = await Swal.fire({
                    title: "Deseja salvar as alterações?",
                    text: "Você está prestes a atualizar os dados do Índice Anual.",
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
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dados)
            });

            await Swal.fire("Sucesso!", respostaApi.message || "Índice Anual salvo com sucesso.", "success");
            limparCamposIndiceAnual();

        } catch (error) {
            console.error("Erro ao enviar dados:", error);
            Swal.fire("Erro", error.message || "Erro ao salvar índice anual.", "error");
        }
    });

    botaoPesquisar.addEventListener("click", async function (e) {
        e.preventDefault();
        limparCamposIndiceAnual();

        console.log("Pesquisando Índice Anual...");

        const temPermissaoPesquisar = temPermissao('IndiceAnual', 'pesquisar');
        if (!temPermissaoPesquisar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para pesquisar.", "warning");
        }

        console.log("Pesquisando Índice Anual...");

        try {
            const indiceanual = await fetchComToken("/indiceanual");

            if (!indiceanual || indiceanual.length === 0) {
                return Swal.fire({
                    icon: 'info',
                    title: 'Nenhum índice anual cadastrado',
                    text: 'Não foi encontrado nenhum índice anual no sistema.',
                    confirmButtonText: 'Ok'
                });
            }

            const select = criarSelectIndiceAnual(indiceanual);

            limparCamposIndiceAnual();
            const input = document.querySelector("#anoIndice");

            if (input && input.parentNode) {
                input.parentNode.replaceChild(select, input);
            }

            const label = document.querySelector('label[for="anoIndice"]');
            if (label) label.style.display = "none";

            select.addEventListener("change", async function () {
                const desc = this.value?.trim();
                if (!desc) return;

                await carregarIndiceAnualDescricao(desc, this);

                const novoInput = document.createElement("input");
                novoInput.type = "text";
                novoInput.id = "anoIndice";
                novoInput.name = "anoIndice";
                novoInput.required = true;
                novoInput.className = "form";
                novoInput.value = desc;

                novoInput.addEventListener("input", function () {
                    this.value = this.value.toUpperCase();
                });

                // this.parentNode.replaceChild(novoInput, this);
                adicionarEventoBlurIndiceAnual();

                if (label) {
                    label.style.display = "block";
                    label.textContent = "Descrição do Índice Anual";
                }

                novoInput.addEventListener("blur", async function () {
                    if (!this.value.trim()) return;
                    await carregarIndiceAnualDescricao(this.value, this);
                });
            });

        } catch (error) {
            console.error("Erro ao carregar índices anuais:", error);
            Swal.fire({
                icon: 'error',
                title: 'Erro',
                text: 'Não foi possível carregar os índices anuais.',
                confirmButtonText: 'Ok'
            });
        }
    });
    
    

    botaoAtualizar.addEventListener("click", async (e) => {
        e.preventDefault(); 
        
        // **Ajuste:** Se você não tem idIndiceAtual, você deve pegá-lo aqui.
        // Se o ID está em um campo oculto:
        const idIndiceAtual = document.getElementById("idIndice").value; 
        
        if (!idIndiceAtual) {
            Swal.fire("Erro", "ID do índice anual não encontrado. Salve o índice primeiro.", "error");
            return;
        }

        // Pega os valores apenas para exibir na confirmação (o Back-end buscará do BD)
        const ano = document.getElementById("anoIndice").value;
        const ctoVda = document.getElementById("percentCtoVda").value;
        const alimentacao = document.getElementById("percentAlimentacao").value;
        const transporte = document.getElementById("percentTransporte").value;

        // 2. Monta o HTML da Confirmação com os dados
        const htmlConfirmacao = `
            <p>Você está prestes a recalcular e atualizar todos os valores da CategoriaFunção, Função, Equipamentos e Suprimentos com os seguintes índices:</p>
            <ul style="text-align: left; list-style-type: none; padding-left: 20px;">
                <li><strong>Ano de Referência:</strong> <b>${ano}</b></li>
                <li><strong>Percentual Cto Vda:</strong> <b>${ctoVda}%</b></li>
                <li><strong>Percentual Alimentação:</strong> <b>${alimentacao}%</b></li>
                <li><strong>Percentual Transporte:</strong> <b>${transporte}%</b></li>
            </ul>
            <p>Deseja realmente prosseguir com a aplicação desses índices? Esta ação criará um ponto de reversão.</p>
        `;

        const resultadoConfirmacao = await Swal.fire({
            title: "Confirma a Aplicação dos Índices?",
            html: htmlConfirmacao,
            icon: "warning", 
            showCancelButton: true,
            confirmButtonColor: "#3085d6",
            cancelButtonColor: "#d33",
            confirmButtonText: "Sim, Aplicar Cálculos!",
            cancelButtonText: "Cancelar"
        });

        // 4. Verificar o resultado da confirmação e chamar a API
        if (resultadoConfirmacao.isConfirmed) {
            try {
                // **AJUSTE ESSENCIAL:** Chamando a nova rota PATCH com o ID do índice
                const urlAplicacao = `/indiceanual/${idIndiceAtual}/aplicar-calculo`;
                
                const respostaApi = await fetchComToken(urlAplicacao, {
                    method: "POST" // Usamos POST, conforme definido no back-end
                    // NÃO É NECESSÁRIO ENVIAR O BODY, pois o back-end buscará os percentuais
                }); 
                
               // await Swal.fire("Sucesso!", respostaApi.message || "Cálculos aplicados com sucesso.", "success");
               // limparCamposIndiceAnual();

               await handleAplicacaoBemSucedida(idIndiceAtual, ano, respostaApi.message);
                                
                
            } catch (error) {
                console.error("Erro ao aplicar índices anuais:", error);
                Swal.fire("Erro", error.message || "Erro ao aplicar índices anuais.", "error");
            }
        } else {
            console.log("Aplicação de índices cancelada pelo usuário.");
        }
    });    

    
    
    botaoReverter.addEventListener("click", async (e) => {
        e.preventDefault(); 
        
        // **Obter o ID do Índice Atual**
        const idIndiceAtual = document.getElementById("idIndice").value; 
        
        if (!idIndiceAtual) {
            Swal.fire("Erro", "ID do índice anual não encontrado. Não é possível reverter.", "error");
            return;
        }
        
        // Pega o ano apenas para exibir na confirmação
        const ano = document.getElementById("anoIndice").value;
       

        // 1. Mostrar o Swal inicial de ALERTA/Confirmação
        const resultadoAlerta = await Swal.fire({
            title: "Confirma a Reversão dos Índices?",
            html: `
                <p>Você tem certeza que deseja **REVERTER** a aplicação dos índices do **Ano ${ano}**?</p>
                <p style="color: red; font-weight: bold;">Todos os valores da CategoriaFuncao voltarão ao estado anterior à aplicação deste índice.</p>
                <p>Esta ação não pode ser desfeita automaticamente.</p>
            `,
            icon: "error", // Use ícone de erro para ações destrutivas
            showCancelButton: true,
            confirmButtonColor: "#d33", // Cor vermelha para confirmar reversão
            cancelButtonColor: "#3085d6",
            confirmButtonText: "Sim, Continuar para Reversão!",
            cancelButtonText: "Não, Cancelar"
        });

        // 2. Se o usuário confirmar, pedimos a Observação (Motivo)
        if (resultadoAlerta.isConfirmed) {
            
            const resultadoMotivo = await Swal.fire({
                title: "Motivo da Reversão",
                text: "Por favor, descreva o motivo da reversão para fins de auditoria.",
                input: 'textarea', // Adiciona um campo de texto de múltiplas linhas
                inputLabel: 'Motivo da Reversão (Obrigatório)',
                inputPlaceholder: 'Ex: Correção de percentual de alimentação. Índice será reaplicado.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: "#3085d6",
                cancelButtonColor: "#d33",
                confirmButtonText: "Confirmar e Reverter",
                cancelButtonText: "Voltar e Cancelar",
                
                // Validação: Garante que o campo não está vazio
                inputValidator: (value) => {
                    if (!value || value.trim() === '') {
                        return 'Você deve fornecer um motivo para a reversão!';
                    }
                }
            });

            // 3. Se o usuário fornecer o motivo e confirmar
            if (resultadoMotivo.isConfirmed) {
                const motivoReversao = resultadoMotivo.value;
                
                try {
                    // Prepara a URL
                    const urlReversao = `/indiceanual/${idIndiceAtual}/desfazer-calculo`;
                    
                    // CHAMADA À ROTA DE REVERSÃO COM O BODY (Motivo)
                    const respostaApi = await fetchComToken(urlReversao, {
                        method: "POST",
                        body: { // O body é necessário para enviar a observação
                            observacao: motivoReversao 
                        }
                    }); 
                    
                    // 4. Sucesso!
                    await Swal.fire("Revertido!", respostaApi.message || `Cálculos do ano ${ano} foram revertidos com sucesso.`, "success");
                    limparCamposIndiceAnual();                    
                    
                } catch (error) {
                    console.error("Erro ao reverter índices anuais:", error);
                    Swal.fire("Erro", error.message || "Erro ao reverter índices anuais.", "error");
                }
            } else {
                console.log("Reversão cancelada na etapa de Observação.");
            }
        } else {
            console.log("Reversão de índices cancelada pelo usuário.");
        }
    });
}

function formatarParaEnvio(valor) {
    if (typeof valor === 'string') {
        // Substitui todas as ocorrências de vírgula por ponto.
        return valor.replace(/,/g, '.');
    }
    return valor;
}

// async function handleAplicacaoBemSucedida(idIndiceAnual, anoIndice, mensagem) {
//     let swalResult;

//     // 1. Mostrar o Swal de sucesso com a opção de gerar o relatório
//     swalResult = await Swal.fire({
//         icon: 'success',
//         title: 'Sucesso!',
//         text: mensagem || 'Índice aplicado com sucesso.',
//         showCancelButton: true,
//         confirmButtonText: 'Gerar Relatório de Comparação',
//         cancelButtonText: 'Fechar',
//         reverseButtons: true,
//     });

//     // 2. Recarregar o estado do índice
//     await carregarIndiceAnualDescricao(anoIndice, document.querySelector("#anoIndice")); 
    
//     // 3. O usuário clicou para gerar o relatório
//     if (swalResult && swalResult.isConfirmed) {
//         try {
//             const idIndiceAtual = document.getElementById("idIndice").value; // Reconfirma o ID
//             const urlRelatorio = `/indiceanual/${idIndiceAtual}/relatorio-comparacao`;
            
//             console.log(`➡️ CHAMANDO API DE RELATÓRIO: ${urlRelatorio}`);
//             const respostaApi = await fetchComToken(urlRelatorio);
            
//             console.log("⬅️ RESPOSTA API COMPLETA:", respostaApi); // 🚨 NOVO LOG DE DIAGNÓSTICO
            
//             // CORREÇÃO: Extrai o array de detalhes
//             const relatorio = respostaApi.detalhes; 

//             if (relatorio && relatorio.length > 0) {
                
//                 console.log(`✅ ${relatorio.length} registros de relatório encontrados. Abrindo modal.`);
//                 abrirModalRelatorio(relatorio); 
                
//             } else {
//                 // Se a API retornou o objeto, mas o array 'detalhes' está vazio (o mais provável):
//                 const mensagemErroApi = respostaApi.message || 'Sem dados de snapshot ativos.';
                
//                 console.warn(`⚠️ Relatório vazio. Mensagem da API: ${mensagemErroApi}`);
                
//                 Swal.fire('Atenção', 
//                     `Aplicação bem-sucedida, mas o relatório de comparação não pôde ser gerado (${mensagemErroApi}).`, 
//                     'warning'
//                 );
//             }
//         } catch (error) {
//             console.error("❌ Erro ao gerar relatório:", error);
//             Swal.fire('Erro', 'Houve um erro ao buscar os dados do relatório.', 'error');
//         }
//     }
// }


async function handleAplicacaoBemSucedida(idIndiceAnual, anoIndice, mensagem) {
    let swalResult;

    // 1. Mostrar o Swal de sucesso com a opção de gerar o relatório
    swalResult = await Swal.fire({
        icon: 'success',
        title: 'Sucesso!',
        text: mensagem || 'Índice aplicado com sucesso.',
        showCancelButton: true,
        // Mantemos o texto do botão como "Gerar Relatório" para UX
        confirmButtonText: 'Gerar Relatório de Comparação', 
        cancelButtonText: 'Fechar',
        reverseButtons: true,
    });

    // 2. Recarregar o estado do índice
    // É importante recarregar o estado para atualizar o status dos botões
    await carregarIndiceAnualDescricao(anoIndice, document.querySelector("#anoIndice")); 
    
    // 3. O usuário clicou para gerar o relatório
    if (swalResult && swalResult.isConfirmed) {
        try {
            const idIndiceAtual = document.getElementById("idIndice").value;
            const urlRelatorio = `/indiceanual/${idIndiceAtual}/relatorio-comparacao`;
            
            console.log(`➡️ CHAMANDO API DE RELATÓRIO: ${urlRelatorio}`);
            const respostaApi = await fetchComToken(urlRelatorio);
            
            // ✅ EXTRAI O ARRAY DE DADOS
            const relatorio = respostaApi.detalhes; 

            if (relatorio && relatorio.length > 0) {
                
                console.log(`✅ ${relatorio.length} registros de relatório encontrados. Gerando HTML para impressão.`);
                
                // 1. GERA O HTML DA TABELA
                const htmlTabela = gerarTabelaRelatorio(relatorio);
                
                // 2. CHAMA A FUNÇÃO DE IMPRESSÃO (NOVA JANELA + PRINT)
                imprimirRelatorio(htmlTabela); 
                
            } else {
                const mensagemErroApi = respostaApi.message || 'Sem dados de snapshot ativos.';
                
                console.warn(`⚠️ Relatório vazio. Mensagem da API: ${mensagemErroApi}`);
                
                Swal.fire('Atenção', 
                    `Aplicação bem-sucedida, mas o relatório de comparação não pôde ser gerado (${mensagemErroApi}).`, 
                    'warning'
                );
            }
        } catch (error) {
            console.error("❌ Erro ao gerar relatório:", error);
            Swal.fire('Erro', 'Houve um erro ao buscar os dados do relatório.', 'error');
        }
    }
}
// NO SEU IndiceAnual.js

// Altere esta função para ela RETORNAR a string HTML da tabela
function gerarTabelaRelatorio(dados) {
    if (!dados || dados.length === 0) {
        return '<h1>Não há dados de comparação disponíveis para o relatório.</h1>';
    }

    const formatarMoeda = (valor) => {
        // Trata valores nulos, vazios, ou zero de forma consistente
        if (valor === null || valor === undefined || valor === 0) {
             return 'R$ 0,00';
        }
        return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }
    
    // 1. Inicia a tabela HTML
    let htmlContent = `
        <style>
            .header-container img {
                max-height: 50px; /* Tamanho do logo (Ajuste conforme necessário) */
                width: auto;
                object-fit: contain;
            }

            /* Garantindo que o header-container use flexbox sempre */
            .header-container {
                display: flex; 
                justify-content: space-between; 
                align-items: center; 
                padding: 10px 0;
                border-bottom: 2px solid #333;
                margin-bottom: 20px;
            }
            
            .header-title {
                text-align: center;
                flex-grow: 1;
                font-size: 18pt; 
                font-weight: bold;
                margin: 0;
                color: #333;
            }
            /* CSS específico para impressão (Opcional, mas recomendado) */
            @media print {
                body { 
                    margin: 0; 
                    font-family: Arial, sans-serif;
                }
                table { 
                    width: 100%; 
                    border-collapse: collapse; 
                    margin-top: 10px;
                }
                th, td { 
                    border: 1px solid #ccc; 
                    padding: 8px;
                    font-size: 10pt; /* Reduz um pouco a fonte para impressão */
                }
                .text-right { text-align: right; }
                
                /* NOVO: Estilo do Container do Cabeçalho */
                .header-container {
                    display: flex; 
                    justify-content: space-between; 
                    align-items: center; 
                    padding: 10px 0;
                    border-bottom: 2px solid #000;
                    margin-bottom: 15px;
                }
                .header-container img {
                    max-height: 50px; /* Ajuste o tamanho do logo */
                    width: auto;
                    object-fit: contain;
                }
                .header-title {
                    text-align: center;
                    flex-grow: 1; /* Permite que o título ocupe o espaço central */
                    font-size: 18pt; /* Aumenta o tamanho do título */
                    font-weight: bold;
                    margin: 0;
                }
                .logo-ja {
                    max-width: 50px;
                    height: auto;
                    margin-left: 20px;
                }
            }
        </style>

        <div class="header-container">
            <img src="${empresaLogoPath}" alt="Logo da Empresa" class="logo-ja">
            
            <h1 class="header-title">Relatório de Comparação de Índices Aplicados</h1>
            
            <div style="width: 100px;"></div> 
        </div>
        <p>Comparação dos valores (Original vs. Atual) após a aplicação do índice anual.</p>
        
        <table class="table table-striped table-bordered table-sm">
            <thead>
                <tr>
                    <th>Função</th>
                    <th>Categoria</th>                    
                    <th class="text-right">CTO Base Original</th>
                    <th class="text-right">CTO Base Atual</th>
                    <th class="text-right">CTO Junior Original</th>
                    <th class="text-right">CTO Junior Atual</th>
                    <th class="text-right">CTO Pleno Original</th>
                    <th class="text-right">CTO Pleno Atual</th>
                    <th class="text-right">CTO Senior Original</th>
                    <th class="text-right">CTO Senior Atual</th>
                    <th class="text-right">CTO Senior2 Original</th>
                    <th class="text-right">CTO Senior2 Atual</th>
                    <th class="text-right">Transp. Original</th>                    
                    <th class="text-right">Transp. Atual</th>
                    <th class="text-right">Alim. Original</th>
                    <th class="text-right">Alim. Atual</th>
                    <th class="text-right">VDA Original</th>
                    <th class="text-right">VDA Atual</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    // 2. Itera sobre os dados e cria as linhas da tabela
    dados.forEach(item => {
        htmlContent += `
            <tr>
                <td>${item.descfuncao}</td>
                <td>${item.nmcategoriafuncao}</td>
                
                <td class="text-right">${formatarMoeda(item.cto_base_original)}</td>
                <td class="text-right">${formatarMoeda(item.cto_base_atual)}</td>
                <td class="text-right">${formatarMoeda(item.cto_junior_original)}</td>
                <td class="text-right">${formatarMoeda(item.cto_junior_atual)}</td>
                <td class="text-right">${formatarMoeda(item.cto_pleno_original)}</td>
                <td class="text-right">${formatarMoeda(item.cto_pleno_atual)}</td>
                <td class="text-right">${formatarMoeda(item.cto_senior_original)}</td>
                <td class="text-right">${formatarMoeda(item.cto_senior_atual)}</td>
                <td class="text-right">${formatarMoeda(item.cto_senior2_original)}</td>
                <td class="text-right">${formatarMoeda(item.cto_senior2_atual)}</td>
                <td class="text-right">${formatarMoeda(item.transporte_original)}</td>
                <td class="text-right">${formatarMoeda(item.transporte_atual)}</td>
                <td class="text-right">${formatarMoeda(item.alimentacao_original)}</td>
                <td class="text-right">${formatarMoeda(item.alimentacao_atual)}</td>
                <td class="text-right">${formatarMoeda(item.vda_original)}</td>
                <td class="text-right">${formatarMoeda(item.vda_atual)}</td>
            </tr>
        `;
    });
    
    // 3. Fecha a tabela e retorna
    htmlContent += '</tbody></table>';
    return htmlContent;
}

// NO SEU IndiceAnual.js

function imprimirRelatorio(htmlTabela) {
    const janelaImprimir = window.open('', 'RelatorioImpressao', 'height=600,width=800');
    
    janelaImprimir.document.write('<html><head>');
    janelaImprimir.document.write('<title>Relatório de Índices</title>');
    
    // Opcional: Para manter o estilo do Bootstrap na impressão, adicione os links CSS AQUI
    janelaImprimir.document.write('<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">');

    janelaImprimir.document.write('</head><body>');
    
    // Adiciona o HTML da tabela
    janelaImprimir.document.write(htmlTabela);
    
    janelaImprimir.document.write('</body></html>');
    janelaImprimir.document.close();
    
    // Chama a função de impressão após um pequeno delay para carregar o CSS
    setTimeout(() => {
        janelaImprimir.print();
        // janelaImprimir.close(); // Fecha a janela após a impressão (ou cancelamento)
    }, 500); // 500ms de delay
}

function abrirModalRelatorio(dadosRelatorio) { 
    // 1. Garante que o modal exista no DOM e que o HTML está dentro
    criarModalRelatorioEInserirNoDOM(); 
    
    // 2. Gera o conteúdo da tabela, chamando corretamente gerarTabelaRelatorio com 1 argumento
    const htmlRelatorio = gerarTabelaRelatorio(dadosRelatorio); 
    document.getElementById('tabelaRelatorioCorpo').innerHTML = htmlRelatorio; 
    
    // 3. Exibe o modal e o overlay manualmente (sem Bootstrap JS)
    const modalElement = document.getElementById('RelIndices'); 
    const overlayElement = document.getElementById('modal-overlay');

    if (modalElement && overlayElement) {
        modalElement.style.display = 'block';
        overlayElement.style.display = 'block';
        console.log("Modal aberto usando exibição manual (sem Bootstrap JS).");
    } else {
        console.error("Erro: Elementos do modal (#RelIndices ou #modal-overlay) não encontrados.");
        alert("Não foi possível carregar a janela do relatório.");
    }
}

/**
 * Cria a estrutura HTML completa do modal de relatório (NÃO-BOOTSTRAP) 
 * e a insere no <body> do documento, juntamente com o overlay.
 * Usa o ID #RelIndices, conforme esperado pelo RelIndices.css.
 */
function criarModalRelatorioEInserirNoDOM() {
    // 1. Evita duplicidade
    if (document.getElementById('RelIndices')) {
        return;
    }
    
    // 2. Adiciona o overlay de fundo (Usado pelo RelIndices.css)
    const htmlOverlay = `<div id="modal-overlay"></div>`;
    
    // 3. Estrutura HTML do modal (sem classes Bootstrap como 'modal', 'modal-dialog', etc.)
    // O ID #RelIndices corresponde ao CSS fixo
    const htmlModal = `
        <div id="RelIndices" aria-labelledby="modalRelatorioLabel" style="display: none;">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="modalRelatorioLabel">Relatório de Comparação de Índices Aplicados</h5>
                    <button type="button" class="close-btn" id="btnFecharHeader" aria-label="Close">
                        &times;
                    </button>
                </div>
                <div class="modal-body">
                    <div id="tabelaRelatorioCorpo"></div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn-imprimir" id="btnImprimirRelatorioModal">
                        <i class="fas fa-print"></i> Imprimir
                    </button>
                    <button type="button" class="btn-fechar" id="btnFecharRelatorioModal">
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', htmlOverlay);
    document.body.insertAdjacentHTML('beforeend', htmlModal);

    // 4. Adicionar listeners para fechar o modal manualmente (Substituindo data-bs-dismiss)
    const fecharBtnHeader = document.getElementById('btnFecharHeader');
    const fecharBtnFooter = document.getElementById('btnFecharRelatorioModal');
    const overlay = document.getElementById('modal-overlay');
    const modalElement = document.getElementById('RelIndices');

    const fecharModal = () => {
        if (modalElement) modalElement.style.display = 'none';
        if (overlay) overlay.style.display = 'none';
    };

    if (fecharBtnHeader) fecharBtnHeader.addEventListener('click', fecharModal);
    if (fecharBtnFooter) fecharBtnFooter.addEventListener('click', fecharModal);
    if (overlay) overlay.addEventListener('click', fecharModal);
    
    // 5. Adicionar listener para impressão
    const imprimirBtn = document.getElementById('btnImprimirRelatorioModal');
    if (imprimirBtn) {
        imprimirBtn.addEventListener('click', () => {
            // Reutiliza a função de impressão do RelIndices.js
            const htmlConteudo = document.getElementById('tabelaRelatorioCorpo').innerHTML;
            if (window.imprimirRelatorio && htmlConteudo) {
                 window.imprimirRelatorio(htmlConteudo);
            } else {
                 alert("Nenhum dado para imprimir ou função de impressão indisponível.");
            }
        });
    }
}

function adicionarListenersAoInputIndiceAnual(inputElement) {
    // Remove listeners anteriores para evitar duplicidade
    if (novoInputIndiceAnualInputListener) { // Verifica se já existe um listener para 'input' no novo input
        inputElement.removeEventListener("input", novoInputIndiceAnualInputListener);
    }
    if (novoInpuIndiceAnualBlurListener) { // Verifica se já existe um listener para 'blur' no novo input
        inputElement.removeEventListener("blur", novoInputIndiceAnualBlurListener);
    }

    anoIndiceInputListener = function () { // Atribui à variável global para o listener 'input'
        this.value = this.value.toUpperCase();
    };
    inputElement.addEventListener("input", anoIndiceInputListener);

    anoIndiceBlurListener = async function () { // Atribui à variável global para o listener 'blur'
        if (!this.value.trim()) return;
        console.log("Campo anoIndice procurado (blur dinâmico):", this.value);
        await carregarIndiceAnualDescricao(this.value, this);
    };
    inputElement.addEventListener("blur", anoIndiceBlurListener);
}

function resetarCampoNmEventoParaInput() {
    const anoIndiceCampo = document.getElementById("anoIndice");
    // Verifica se o campo atual é um select e o substitui por um input
    if (anoIndiceCampo && anoIndiceCampo.tagName.toLowerCase() === "select") {
        const input = document.createElement("input");
        input.type = "text";
        input.id = "anoIndice";
        input.name = "anoIndice";
        input.value = ""; // Limpa o valor
        input.placeholder = "Ano";
        input.className = "form";
        input.classList.add('uppercase');
        input.required = true;

        // Remove o listener do select antes de substituí-lo
        if (selectEventoChangeListener) {
            anoIndiceCampo.removeEventListener("change", selectEventoChangeListener);
            selectEventoChangeListener = null;
        }

        anoIndiceCampo.parentNode.replaceChild(input, anoIndiceCampo);
        adicionarListenersAoInputIndiceAnual(input); // Adiciona os listeners ao novo input

        const label = document.querySelector('label[for="anoIndice"]');
        if (label) {
            label.style.display = "block";
            label.textContent = "Nome do Índice Anual";
        }
    }
}


// =============================================================================
// Função de Desinicialização do Módulo Indice Anual
// =============================================================================
function desinicializarIndiceAnualModal() {
    console.log("🧹 Desinicializando módulo IndiceAnual.js...");

    const anoIndiceElement = document.querySelector("#anoIndice");
    const botaoEnviar = document.querySelector("#Enviar");
    const botaoPesquisar = document.querySelector("#Pesquisar");
    const botaoLimpar = document.querySelector("#Limpar");

    // 1. Remover listeners de eventos dos elementos fixos
    if (botaoLimpar && limparIndiceAnualButtonListener) {
        botaoLimpar.removeEventListener("click", limparIndiceAnualButtonListener);
        limparIndiceAnualButtonListener = null;
        console.log("Listener de click do Limpar (Indice Anual) removido.");
    }
    if (botaoEnviar && enviarIndiceAnualButtonListener) {
        botaoEnviar.removeEventListener("click", enviarIndiceAnualButtonListener);
        enviarIndiceAnualButtonListener = null;
        console.log("Listener de click do Enviar (Indice Anual) removido.");
    }
    if (botaoPesquisar && pesquisarIndiceAnualButtonListener) {
        botaoPesquisar.removeEventListener("click", pesquisarIndiceAnualButtonListener);
        pesquisarIndiceAnualButtonListener = null;
        console.log("Listener de click do Pesquisar (Indice Anual) removido.");
    }

    // 2. Remover listeners do campo anoIndice (que pode ser input ou select)
    if (anoIndiceElement) {
        if (anoIndiceElement.tagName.toLowerCase() === "input") {
            if (anoIndiceInputListener) { // Listener para 'input' (toUpperCase)
                anoIndiceElement.removeEventListener("input", anoIndiceInputListener);
                anoIndiceInputListener = null;
                console.log("Listener de input do anoIndice (input) removido.");
            }
            if (anoIndiceBlurListener) { // Listener para 'blur' (carregar descrição)
                anoIndiceElement.removeEventListener("blur", anoIndiceBlurListener);
                anoIndiceBlurListener = null;
                console.log("Listener de blur do anoIndice (input) removido.");
            }
        } else if (anoIndiceElement.tagName.toLowerCase() === "select" && selectEventoChangeListener) {
            anoIndiceElement.removeEventListener("change", selectEventoChangeListener);
            selectEventoChangeListener = null;
            console.log("Listener de change do select anoIndice removido.");
        }
    }

    // 3. Limpar o estado global e campos do formulário
    window.IndiceOriginal = null; // Zera o objeto de evento original
    limparCamposIndiceAnual(); // Limpa todos os campos visíveis do formulário
   // document.querySelector("#form").reset(); // Garante que o formulário seja completamente resetado
    document.querySelector("#idIndice").value = ""; // Limpa o ID oculto
    resetarCampoNmEventoParaInput(); // Garante que o campo anoIndice volte a ser um input padrão

    console.log("✅ Módulo IndiceAnual.js desinicializado.");
}


function criarSelectIndiceAnual(indiceanual) {
   
    const select = document.createElement("select");
    select.id = "anoIndice";
    select.name = "anoIndice";
    select.required = true;
    select.className = "form";

   
    // Adicionar opções
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.text = "Selecione um Ano...";
    defaultOption.disabled = true;
    defaultOption.selected = true;
    select.appendChild(defaultOption);

    console.log("PESQUISANDO ANO:", indiceanual);

    indiceanual.forEach(anoIndiceachado => {
        const option = document.createElement("option");
        option.value = anoIndiceachado.ano;
        option.text = anoIndiceachado.ano;
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

function adicionarEventoBlurIndiceAnual() {
    const input = document.querySelector("#anoIndice");
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
        console.log("Campo anoIndice procurado:", desc);

        if (!desc) return;

        try {
            await carregarIndiceAnualDescricao(desc, this);
            console.log("Índice Anual selecionado depois de carregarIndiceAnualDescricao:", this.value);
        } catch (error) {
            console.error("Erro ao buscar Índice Anual:", error);
        }
    });
}

async function carregarIndiceAnualDescricao(desc, elementoAtual) {
    // Utilitário: remove classes de estado (btn-primary, btn-secondary, btn-danger)
    // Declarado no escopo da função para estar disponível tanto no try quanto no catch
    function limparClasses(btn) {
        if (btn) btn.classList.remove('btn-primary', 'btn-secondary', 'btn-danger');
    }

    try {

        console.log("Carregando Índice Anual para descrição:", desc);
        const indiceanual = await fetchComToken(`/indiceanual?anoIndice=${encodeURIComponent(desc)}`);        

        // Limpar o estado anterior antes de carregar o novo
        //limparCamposIndiceAnual();

        if (!indiceanual || !indiceanual.idindice) throw new Error("Índice Anual não encontrado");

        
        const dataAtualizacao = indiceanual.dataatualizacao;
        console.log("Data de Atualização do Índice Anual:", dataAtualizacao);
        const botaoAtualizar = document.getElementById("Atualizar");
        const botaoReverter = document.getElementById("Reverter");

        // if (dataAtualizacao) {
        //     console.log("Índice Anual já foi aplicado em:", new Date(dataAtualizacao).toLocaleDateString());
        //     // O índice foi aplicado
        //     botaoAtualizar.disabled = true; // Desabilita o botão para impedir reaplicação
        //     botaoAtualizar.textContent = "Índice Atualizado";
        //     botaoAtualizar.title = `Índice já aplicado em: ${new Date(dataAtualizacao).toLocaleDateString()}. Reverta para aplicar novamente.`;
        //     botaoAtualizar.classList.add('btn-secondary');
        //     botaoAtualizar.classList.remove('btn-primary', 'btn-danger', 'btnAtualizar'); // Remove outras classes de cor
            
            
            
        //     if (botaoReverter) {
        //         botaoReverter.disabled = false;
        //         botaoReverter.classList.remove('btn-secondary');
        //     }

        // } else {
        //     // // O índice NÃO foi aplicado
        //     botaoAtualizar.disabled = false;
        //     botaoAtualizar.textContent = "Atualizar Índice";
        //     botaoAtualizar.title = "Aplicar os índices de atualização nas Categorias de Função.";
        //     //botaoAtualizar.classList.add('btn-primary');
        //     botaoAtualizar.classList.remove('btn-secondary');
        //    // document.getElementById("statusAplicacao").textContent = "Status: Não Aplicado.";
        //    const botaoReverter = document.getElementById("Reverter");
        //     if (botaoReverter) {
        //         botaoReverter.disabled = true;
        //         botaoReverter.title = "A reversão só é possível se o índice já tiver sido aplicado.";
        //         botaoReverter.classList.add('btn-secondary');
        //         botaoReverter.classList.remove('btn-primary', 'btn-danger', 'btnAtualizar');
        //     }
        // }

        const limparClasses = (btn) => {
             if (btn) btn.classList.remove('btn-primary', 'btn-secondary', 'btn-danger');
        };

        limparClasses(botaoAtualizar);
        if (botaoReverter) limparClasses(botaoReverter);
        
        // =========================================================================
        // ESTADO 1: APLICADO (dataatualizacao está preenchida)
        // =========================================================================
        if (dataAtualizacao) {
            console.log("Índice Anual já foi aplicado e não revertido.");
            
            // Botão Atualizar (Bloqueado)
            botaoAtualizar.disabled = true; 
            botaoAtualizar.textContent = "Índice Aplicado";
            botaoAtualizar.title = `Aplicação em: ${new Date(dataAtualizacao).toLocaleDateString()}. Reverter para aplicar novamente.`;
            botaoAtualizar.classList.add('btn-secondary'); // Cor neutra para bloqueado
            
            // Botão Reverter (Habilitado)
            if (botaoReverter) {
                botaoReverter.disabled = false;
               // botaoReverter.textContent = "Reverterzer Aplicação";
                botaoReverter.title = "A reversão só é possível se o índice já tiver sido aplicado.";
                botaoReverter.classList.add('btn-danger'); // Cor de alerta para reversão
            }

        } 
        // =========================================================================
        // ESTADO 2: REVERTIDO OU NUNCA APLICADO (dataatualizacao é NULL, mas o ID existe)
        // =========================================================================
        else {
            console.log("Índice Anual liberado para aplicação (Revertido ou Não Aplicado).");

            // Botão Atualizar (Habilitado)
            botaoAtualizar.disabled = false;
            botaoAtualizar.textContent = "Atualizar Índice";
            botaoAtualizar.title = "Aplicar o índice de atualização nas Categorias de Função.";
            botaoAtualizar.classList.add('btn-primary'); // Cor padrão/principal para ação
            
            // Botão Reverter (Desabilitado)
            if (botaoReverter) {
                botaoReverter.disabled = true;
                //botaoReverter.textContent = "Desfazer Aplicação";
                botaoReverter.title = "A reversão só é possível se o índice estiver aplicado.";
                botaoReverter.classList.add('btn-secondary'); // Cor neutra para bloqueado
            }
        }

        document.querySelector("#idIndice").value = indiceanual.idindice;
        document.querySelector("#anoIndice").value = indiceanual.ano; // ✅ Certifique-se de preencher o input com o nome retornado
        document.querySelector("#percentCtoVda").value = indiceanual.percentctovda;
        document.querySelector("#percentAlimentacao").value = indiceanual.percentalimentacao;
        document.querySelector("#percentTransporte").value = indiceanual.percenttransporte;

        window.IndiceOriginal = {
            idIndice: indiceanual.idindice,
            anoIndice: indiceanual.ano,
            perctCtoVda: indiceanual.percentctovda, // ✅ Armazena o array de clientes originais
            percentAlimentacao: indiceanual.percentalimentacao,
            percentTransporte: indiceanual.percenttransporte
        };
       
        console.log("Indice Anual encontrado:", window.IndiceOriginal);

    } catch (error) {
        console.warn("Indice Anual não encontrado.");

        const inputIdEvento = document.querySelector("#idIndice");
        const podeCadastrarEvento = temPermissao("IndiceAnual", "cadastrar");
        
        // Se o evento não for encontrado, garantimos que os campos estão limpos
      //  limparCamposIndiceAnual();

        const botaoAtualizar = document.getElementById("Atualizar");
        const botaoReverter = document.getElementById("Reverter");
        
        // Se não encontrou o índice, desabilita a atualização/reversão
        if (botaoAtualizar) {
             limparClasses(botaoAtualizar);
             botaoAtualizar.disabled = true;
             botaoAtualizar.classList.add('btn-secondary');
        }
        if (botaoReverter) {
             limparClasses(botaoReverter);
             botaoReverter.disabled = true;
             botaoReverter.classList.add('btn-secondary');
        }

        if (!podeCadastrarEvento) {
            Swal.fire({
                icon: "info",
                title: "Índice Anual não cadastrado",
                text: "Você não tem permissão para cadastrar índices anuais.",
                confirmButtonText: "OK"
            });
            elementoAtual.value = "";
            return;
        }

        const resultado = await Swal.fire({
            icon: 'question',
            title: `Deseja cadastrar "${desc.toUpperCase()}" como novo Índice Anual?`,
            text: `Índice Anual "${desc.toUpperCase()}" não encontrado.`,
            showCancelButton: true,
            confirmButtonText: "Sim, cadastrar",
            cancelButtonText: "Cancelar",
            reverseButtons: true,
            focusCancel: true
        });

        if (!resultado.isConfirmed) {
            console.log("Usuário cancelou o cadastro do Índice Anual.");
            elementoAtual.value = "";
            setTimeout(() => {
                elementoAtual.focus();
            }, 0);
        }
    }
}


function limparIndiceOriginal() {
    IndiceOriginal = {
        idIndice: "",
        anoIndice: "",
        percentCtoVda: "",
        percentAlimentacao: "",
        percentTransporte: ""      
    };
}



function limparCamposIndiceAnual() {

    console.log("ENTROU NO LIMPAR CAMPOS");

    const idIndice = document.getElementById("idIndice");
    const anoIndiceEl = document.getElementById("anoIndice");
    const percentCtoVdaEl = document.getElementById("percentCtoVda");
    const percentAlimentacaoEl = document.getElementById("percentAlimentacao");
    const percentTransporteEl = document.getElementById("percentTransporte");
    const botaoAtualizar = document.getElementById("Atualizar");
    const botaoReverter = document.getElementById("Reverter");

    if (anoIndiceEl) {anoIndiceEl.value = "";}   
    if (percentCtoVdaEl) percentCtoVdaEl.value = "";
    if (percentAlimentacaoEl) percentAlimentacaoEl.value = "";
    if (percentTransporteEl) percentTransporteEl.value = "";

    botaoAtualizar.classList.add('btn-secondary');
    botaoAtualizar.disabled = false;
    botaoAtualizar.textContent = "Atualizar Índices";
    botaoAtualizar.title = "Aplicar os índices de atualização nas Categorias de Função.";

    botaoReverter.classList.add('btn-secondary');
    botaoReverter.disabled = true;
    botaoReverter.textContent = "Reverter Índices";
    botaoReverter.title = "Reverter os índices aplicados anteriormente.";

    if (anoIndiceEl && anoIndiceEl.tagName === "SELECT") {
        // Se for SELECT, trocar por INPUT
        const novoInput = document.createElement("input");
        novoInput.type = "text";
        novoInput.id = "anoIndice";
        novoInput.name = "anoIndice";
        novoInput.required = true;
        novoInput.className = "form";

        // Configura o evento de transformar texto em maiúsculo
        novoInput.addEventListener("input", function () {
            this.value = this.value.toUpperCase();
        });

        // Reativa o evento blur
        novoInput.addEventListener("blur", async function () {
            if (!this.value.trim()) return;
            await carregarIndiceAnualDescricao(this.value, this);
        });

        anoIndiceEl.parentNode.replaceChild(novoInput, anoIndiceEl);
        adicionarEventoBlurIndiceAnual();

        const label = document.querySelector('label[for="anoIndice"]');
        if (label) {
            label.style.display = "block";
            label.textContent = "Descrição do Índice Anual";
        }
    } else if (anoIndiceEl) {
        // Se for input normal, só limpa
        anoIndiceEl.value = "";
    }
}

function configurarEventosCadIndiceAnual() {
    console.log("Configurando eventos Indice Anual...");
    criarModalRelatorioEInserirNoDOM(); 
    verificaIndiceAnual(); // Carrega os Evento ao abrir o modal
    adicionarEventoBlurIndiceAnual();
    console.log("Entrou configurar Evento no INDICE ANUAL.js.");
}
window.configurarEventosCadIndiceAnual = configurarEventosCadIndiceAnual;

function configurarEventosEspecificos(modulo) {
  console.log("⚙️ configurarEventosEspecificos recebeu:", modulo);
  if (modulo.trim().toLowerCase() === 'indiceanual') {
    configurarEventosCadIndiceAnual();
    
    if (typeof aplicarPermissoes === "function" && window.permissoes) {
      aplicarPermissoes(window.permissoes);
    } else {
      console.warn("⚠️ aplicarPermissoes ou window.permissoes ainda não estão disponíveis para LocalMontagem.");
    }
  }
}
window.configurarEventosEspecificos = configurarEventosEspecificos;


window.moduloHandlers = window.moduloHandlers || {};

window.moduloHandlers['Indiceanual'] = { // A chave 'IndiceAnual' (com I maiúsculo) deve corresponder ao seu Index.js
    configurar: configurarEventosCadIndiceAnual,
    desinicializar: desinicializarIndiceAnualModal
};