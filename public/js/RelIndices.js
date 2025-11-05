// RelIndices.js - Código Otimizado
import { fetchComToken } from '../utils/utils.js';

// Variável para armazenar o último HTML gerado, acessível ao botão de impressão.
let ultimoHtmlRelatorio = ''; 
let relatorioGerado = false;

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

function atualizarStatusBotoes(gerado) {
    
    console.log("Atualizando status dos botões. Relatório gerado:", gerado);
    const btnGerar = document.getElementById('gerarRelatorioBtn');
    const btnImprimir = document.getElementById('btnImprimirNovamente'); 

    // O Gerar fica desabilitado APENAS se o relatório FOI gerado
    if (btnGerar) {
        btnGerar.disabled = gerado; 
    }
    
    // O Imprimir fica desabilitado se o relatório NÃO foi gerado
    if (btnImprimir) {
        btnImprimir.disabled = !gerado; 
    }

    relatorioGerado = gerado;
}

function formatCurrency(value) {
    if (value === null || value === undefined) return '-';
    // Garante que o valor é tratado como número antes de formatar
    return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarDataAplicacao(dataString) {
    if (!dataString) {
        return 'Aguardando Aplicação';
    }
    try {
        const dataObj = new Date(dataString);
        // Garante que o fuso horário não cause um dia de diferença
        const dia = String(dataObj.getDate()).padStart(2, '0');
        const mes = String(dataObj.getMonth() + 1).padStart(2, '0');
        const ano = dataObj.getFullYear();
        return `${dia}/${mes}/${ano}`;
    } catch (e) {
        console.error("Erro ao formatar data:", e);
        return 'Data Inválida';
    }
}


function imprimirRelatorio(htmlConteudo) {

    console.log("HTML gerado para o relatório:", htmlConteudo);
    if (!htmlConteudo) {
        alert('Nenhum dado para imprimir.');
        return;
    }

    // 1. Obtém a referência do iframe invisível
    const iframe = document.getElementById('printIframe');
    if (!iframe) {
        if (typeof Swal !== 'undefined') {
            Swal.fire('Erro', 'Elemento de impressão (iframe) não encontrado no HTML.', 'error');
        }
        return;
    }

    const doc = iframe.contentWindow.document || iframe.contentWindow.document;

    // 2. Limpa qualquer manipulador de onload anterior para evitar disparos acidentais
    iframe.onload = null;

    // 3. Define o novo manipulador de onload
    iframe.onload = function() {
        console.log("CSS carregado no Iframe. Iniciando impressão...");
        
        // CRÍTICO: REMOVE O MANIPULADOR DE IMEDIATO.
        iframe.onload = null; 

        
        
        // // Limpar o iframe após o uso (limpar conteúdo é crucial)
        // setTimeout(() => {
            
        //     doc.open();
        //     // Limpa o conteúdo de forma rápida e segura
        //     doc.write(''); 
        //     doc.close();
        // }, 500); 

        setTimeout(() => {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
            
            // Limpar o iframe após o uso (limpar conteúdo é crucial)
            setTimeout(() => {
                doc.open();
                doc.write(''); 
                doc.close();
            }, 500); 
        }, 50);

        
    };
    
    // 4. Injeta o conteúdo no iframe
    doc.open();
    doc.write('<html><head></head><body></body></html>');
    doc.close();

    console.log("Conteúdo injetado no iframe:", doc.documentElement.innerHTML);
    // *** ALTERAÇÃO CRÍTICA AQUI: Usando innerHTML para injetar o conteúdo ***
    
    // Injeta o conteúdo do <head> (título e CSS)
    doc.head.innerHTML = `
        <title>Relatório de Índices</title>
        <link rel="stylesheet" href="css/Modal/RelIndices.css">
    `;

    // Injeta o conteúdo no <body>
    doc.body.innerHTML = htmlConteudo;
    
    
    // 5. Fallback de segurança (mantido)
    setTimeout(function() {
        if (iframe.onload) { 
            console.warn("Fallback: onload falhou, forçando a impressão via timeout.");
            iframe.onload = null;
            setTimeout(() => {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
            }, 50);
        }
    }, 500); 
}


function gerarTabelaRelatorio(dadosDetalhes) {
    console.log("➡️ ENTROU EM GERAR TABELA DETALHES com:", dadosDetalhes.length, "linhas.");

    if (!dadosDetalhes || dadosDetalhes.length === 0) {
        return '<h2>Nenhum dado de funções encontrado para este índice.</h2>';
    }
    
    let html = '';
   // html += `<div class="repetir-cabecalho"></div>`;
    // 1. Tabela de Detalhes
    html += `       
        <table class="report-table relatorio-solido">
            <thead>
                <tr class="header-group-row">
                    <th colspan="2">Dados da Função</th>
                    <th colspan="8">Custo do Produto (CTO)</th>
                    <th colspan="2">Valor de Venda Produto (VDA)</th>
                    <th colspan="2">Transporte</th>
                    <th colspan="2">Alimentação</th>
                </tr>
                
                <tr>
                    <th>Função</th>
                    <th>Categoria</th>
                    
                    <th class="text-right">CTO Base Original</th>
                    <th class="text-right">CTO Base Ajustado</th>

                    <th class="text-right">CTO Junior Original</th>
                    <th class="text-right">CTO Junior Ajustado</th>

                    <th class="text-right">CTO Pleno Original</th>
                    <th class="text-right">CTO Pleno Ajustado</th>

                    <th class="text-right">CTO Senior Original</th>
                    <th class="text-right">CTO Senior Ajustado</th>

                    <th class="text-right">VDA Original</th>
                    <th class="text-right">VDA Ajustado</th>
                    
                    <th class="text-right">Transporte Original</th>
                    <th class="text-right">Transporte Ajustado</th>
                    
                    <th class="text-right">Alimentação Original</th>
                    <th class="text-right">Alimentação Ajustado</th>
                </tr>
            </thead>
            <tbody>
    `;
    // 2. Iteração dos Dados
    dadosDetalhes.forEach(item => {
        html += `
            <tr>
                <td>${item.descfuncao || 'N/A'}</td>
                <td>${item.nmcategoriafuncao || 'N/A'}</td>
                
                <td class="text-right">${formatCurrency(item.cto_base_original)}</td>
                <td class="text-right">${formatCurrency(item.cto_base_atual)}</td>

                <td class="text-right">${formatCurrency(item.cto_junior_original)}</td>
                <td class="text-right">${formatCurrency(item.cto_junior_atual)}</td>

                <td class="text-right">${formatCurrency(item.cto_pleno_original)}</td>
                <td class="text-right">${formatCurrency(item.cto_pleno_atual)}</td>

                <td class="text-right">${formatCurrency(item.cto_senior_original)}</td>
                <td class="text-right">${formatCurrency(item.cto_senior_atual)}</td>

                <td class="text-right">${formatCurrency(item.vda_original)}</td>
                <td class="text-right">${formatCurrency(item.vda_atual)}</td>

                <td class="text-right">${formatCurrency(item.transporte_original)}</td>
                <td class="text-right">${formatCurrency(item.transporte_atual)}</td>

                <td class="text-right">${formatCurrency(item.alimentacao_original)}</td>
                <td class="text-right">${formatCurrency(item.alimentacao_atual)}</td>
            </tr>
        `;
    });

    html += `
            </tbody>
        </table>
    `;

    return html.trim();
}

// =========================================================================
// FUNÇÕES PRINCIPAIS DO RELATORIOS DE ÍNDICES
// =========================================================================

/**
 * Carrega a lista de índices anuais da API e popula o dropdown.
 */
async function carregarIndices() {
    
     inicializarDadosEmpresa();

    console.log("Carregando índices anuais para o select...");
    const select = document.getElementById('selectIndiceRelatorio');
    
    const $selectElement = $(select);
    // Destrói o Select2, se existir, para evitar duplicação ou erros
    if ($selectElement.hasClass('select2-hidden-accessible')) {
        $selectElement.select2('destroy');
    }

    try {
        const indices = await fetchComToken('/indiceanual/all'); 
        
        select.innerHTML = ''; 
        select.innerHTML += '<option value="">Selecione um Índice...</option>';

        if (indices && Array.isArray(indices)) {
            indices.forEach(indice => {
                const option = document.createElement('option');
                //option.value = indice.idindice; 
                //option.textContent = `${indice.anoreferencia} (Cto/Vda: ${indice.percentctovda}%, Transp/Alim: ${indice.percentalimentacao}%)`; 
               // const pctTransporte = indice.percenttransporte || indice.percentalimentacao; 
                
                option.value = `${indice.idindice}|${indice.percentctovda}|${indice.percenttransporte}|${indice.percentalimentacao}`; 
                
                // O texto visível deve ser mantido claro para o usuário:
                option.textContent = `${indice.anoreferencia} (Cto/Vda: ${indice.percentctovda}%, Transp: ${indice.percenttransporte}%, Alim: ${indice.percentalimentacao}%)`;
                select.appendChild(option);
            });
        }
        
        // Inicializa o Select2
        if (typeof $ !== 'undefined' && $.fn.select2) {
            $selectElement.select2({
                dropdownParent: $('#RelIndices .modal-content'),
                placeholder: "Selecione um Índice..."
            });
        }
        
    } catch (error) {
        console.error('Erro ao carregar índices:', error);
        select.innerHTML = '<option value="">Erro ao carregar</option>';
        if (typeof Swal !== 'undefined') {
            Swal.fire('Erro', 'Não foi possível carregar a lista de índices anuais.', 'error');
        }
    }
}


async function gerarRelatorioEImprimir() {
    const selectedValue = document.getElementById('selectIndiceRelatorio').value;
    const btnGerar = document.getElementById('gerarRelatorioBtn');
    
    const reportOutput = document.getElementById('reportOutput'); 
    
    // 1. CHAMA O ESTADO INICIAL DE 'NÃO GERADO' E LIMPA O RELATÓRIO
    // O controle de estado agora gerencia o disabled/cinza
    atualizarStatusBotoes(false); 
    reportOutput.innerHTML = ''; 

    const idIndiceAnual = selectedValue.split('|')[0]; // Extrai "1" de "1|8.00|5.00|5.00"
    
    // **NOTA CRÍTICA:** REMOVIDA LINHA: 
    // if (btnImprimir) { btnImprimir.style.display = 'none'; }
    // O botão AGORA DEVE SER CONTROLADO APENAS PELO 'DISABLED' E CSS!

    if (!idIndiceAnual || isNaN(parseInt(idIndiceAnual))) {
        if (typeof Swal !== 'undefined') {
            Swal.fire('Atenção', 'Selecione um Índice Anual para gerar o relatório.', 'warning');
        }
        return;
    }
    
    // Feedback visual de carregamento
    const originalText = btnGerar.textContent;
    btnGerar.textContent = 'Gerando...';
    btnGerar.disabled = true;

    try {
        const urlRelatorio = `/indiceanual/${idIndiceAnual}/relatorio-comparacao`; 
        const responseData = await fetchComToken(urlRelatorio);

        // Verifica a nova estrutura
        if (responseData && responseData.detalhes && responseData.detalhes.length > 0) {
            
            const { indice, detalhes } = responseData;
            const dataAtual = new Date().toLocaleDateString('pt-BR');
            
            // Usando a data de aplicação formatada
            const dataAplicacaoFormatada = formatarDataAplicacao(indice.dataAplicacao);

            // Geração da Info de Percentuais (usando dados confiáveis do backend)
            const infoPercentuais = `
                Percentuais Aplicados - Cto/Vda: ${parseFloat(indice.percentctovda).toFixed(2)}% | 
                Transporte: ${parseFloat(indice.percenttransporte).toFixed(2)}% | 
                Alimentação: ${parseFloat(indice.percentalimentacao).toFixed(2)}%
            `;
            
            // =========================================================================
            // 1. MONTAGEM DO CABEÇALHO COMPLETO (SOLUÇÃO DA DUPLICAÇÃO E REPETIÇÃO)
            // =========================================================================
            let htmlCabecalho = '';

            // 📢 ENVOLVE TUDO NO CONTÊINER REPETÍVEL PARA O CSS
            htmlCabecalho += `<div class="cabecalho-relatorio-repetivel">`;

            // A. Bloco Principal (Logo e Título)
            htmlCabecalho += `<div class="print-header-top">
                                <img src="${empresaLogoPath}" alt="Logo Empresa" class="logo-ja">
                                <div class="header-title-container">
                                    <h1 class="header-title">Relatório de Comparação de Índices Aplicados</h1>
                                </div>
                                <span class="data-relatorio">${dataAtual}</span>
                            </div>`;

            // B. Informações do Índice (Ano, Data de Aplicação e Percentuais)
            htmlCabecalho += `
                <div class="info-percentuais-relatorio" style="text-align: center; margin-bottom: 20px;">
                    <p style="font-size: 14px; font-weight: bold;">
                        Índice Aplicado - Ano: ${indice.anoReferencia}<br>
                        Data de Aplicação: ${dataAplicacaoFormatada}<br> 
                        ${infoPercentuais}
                    </p>
                </div>`;
                
            htmlCabecalho += `</div>`; // Fecha .cabecalho-relatorio-repetivel
            // =========================================================================


            // 2. GERA O HTML DA TABELA
            const htmlTabela = gerarTabelaRelatorio(detalhes); 
            
            // 3. COMBINA E EXIBE
            const htmlRelatorioCompleto = htmlCabecalho + htmlTabela;
            
            ultimoHtmlRelatorio = htmlRelatorioCompleto;
            reportOutput.innerHTML = htmlRelatorioCompleto; 
            
            // 4. ATUALIZA O ESTADO DE SUCESSO AQUI: Desabilita o Gerar, Habilita o Imprimir
            atualizarStatusBotoes(true); 
            
            // 5. USA SWEETALERT PARA CONFIRMAR A IMPRESSÃO
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    title: 'Relatório Gerado!',
                    html: 'Os dados foram carregados na tela. <br> Deseja Imprimir?',
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonText: 'Sim, Imprimir',
                    cancelButtonText: 'Cancelar'
                }).then((result) => {
                    if (result.isConfirmed) {
                        imprimirRelatorio(ultimoHtmlRelatorio); 
                    }
                });
            } else {
                 imprimirRelatorio(ultimoHtmlRelatorio);
            }

        } else {
            // ... (código para caso de dados vazios)
            if (typeof Swal !== 'undefined') {
                Swal.fire('Atenção', 'Nenhum dado de comparação encontrado para este índice.', 'warning');
            }
            reportOutput.innerHTML = '<h2>Nenhum dado de comparação encontrado.</h2>';
            atualizarStatusBotoes(false); 
        }

    } catch (error) {
        // ... (código para caso de erro)
        if (typeof Swal !== 'undefined') {
            Swal.fire('Erro', 'Não foi possível buscar os dados do relatório.', 'error');
        } else {
            console.error('Erro ao buscar relatório:', error);
        }
        atualizarStatusBotoes(false);
        
    } finally {
        // Restaura o texto do botão de Geração
        btnGerar.textContent = originalText;
    }
}
/**
 * Inicia o processo de impressão usando o último HTML gerado.
 */
function imprimirNovamente() {
    if (ultimoHtmlRelatorio) {
        imprimirRelatorio(ultimoHtmlRelatorio);
    } else {
        if (typeof Swal !== 'undefined') {
             Swal.fire('Atenção', 'Nenhum relatório foi gerado ainda.', 'warning');
        } else {
            alert('Nenhum relatório foi gerado ainda.');
        }
    }
}



// --- Função de Desinicialização para Limpar Eventos ---
function desinicializarRelIndicesModal() {
    console.log("Desinicializando RelIndicesModal...");

    // 1. Remove os Event Listeners
    const btnGerarRelatorio = document.getElementById('gerarRelatorioBtn');
    if (btnGerarRelatorio) {
        btnGerarRelatorio.removeEventListener('click', gerarRelatorioEImprimir);
    }
    const btnImprimirNovamente = document.getElementById('btnImprimirNovamente');
    if (btnImprimirNovamente) {
        btnImprimirNovamente.removeEventListener('click', imprimirNovamente);
        btnImprimirNovamente.style.display = 'none'; // Esconde ao desinicializar
    }
    
    // 2. Limpa variáveis de estado e UI
    ultimoHtmlRelatorio = '';
    const reportOutput = document.getElementById('reportOutput');
    if (reportOutput) {
        reportOutput.innerHTML = '';
    }
    
    // 3. Limpa o conteúdo do SELECT (Dropdown)
    const select = document.getElementById('selectIndiceRelatorio');
    if (select) {
        select.innerHTML = '<option value="">Selecione...</option>';
        if (typeof $ !== 'undefined' && $.fn.select2) {
            if ($(select).hasClass('select2-hidden-accessible')) {
                $(select).select2('destroy');
            }
        }
    }
}

function limparConteudoRelatorio() {
    const container = document.getElementById('reportOutput'); // ID comum para containers de visualização
    
    
    if (container) {
        container.innerHTML = '<h2>Selecione o Índice e clique em "Gerar Relatório".</h2>';
    } else {
        // Se o container tiver outro ID ou estrutura, você pode precisar ajustar.
        // Se a visualização for direto na modal, talvez você precise limpar a modal-content.
        const modalContent = document.querySelector('#RelIndices .modal-content');
        if (modalContent) {
             // Limpa tudo, exceto os controles (selects, botões, etc.) se necessário
             // Se houver um container específico para o relatório, use-o!
             // Exemplo: document.getElementById('reportResultArea').innerHTML = '';
        }
    }
    
    // Zera o HTML armazenado
    ultimoHtmlRelatorio = '';
    relatorioGerado = false;
    
    console.log("✅ Conteúdo do relatório anterior limpo.");
}

window.desinicializarRelIndicesModal = desinicializarRelIndicesModal;

/**
 * Função principal para configurar eventos (chamada após o modal ser carregado).
 */
function configurarEventosRelIndices() {
    console.log("Configurando eventos RelIndices.js...");
    
    // 1. Carregar os dados iniciais do select
    carregarIndices();
    
    // 2. Configurar o evento do botão de geração
    const btnGerar = document.getElementById('gerarRelatorioBtn');
    if(btnGerar) {
        btnGerar.addEventListener('click', gerarRelatorioEImprimir);
    }
    
    const btnImprimir = document.getElementById('btnImprimirNovamente');
    if(btnImprimir) {
        btnImprimir.addEventListener('click', imprimirNovamente);
    }

    const selectIndice = document.getElementById('selectIndiceRelatorio');
    // Converte o elemento nativo para um objeto jQuery
    const $selectIndice = $(selectIndice); 
    
    if ($selectIndice.length) {
        // SUBSTITUÍDO: selectIndice.addEventListener('change', ...)
        // PELA FORMA JQUERY, MAIS COMPATÍVEL COM O SELECT2.
        $selectIndice.on('change', function() {
            
            console.log("➡️ EVENTO CHANGE SELECT2/JQUERY DISPARADO: Liberando botão Gerar.");
            // Habilita o botão Gerar e desabilita o Imprimir
            atualizarStatusBotoes(false);    
            
            limparConteudoRelatorio();
        });
    }

    // 3. Estado inicial: Desabilitar o botão Imprimir, Habilitar o Gerar
    atualizarStatusBotoes(false);
}

// Configuração de exportação e inicialização
window.configurarEventosRelIndices = configurarEventosRelIndices;

function configurarEventosEspecificos(modulo) {
  console.log("⚙️ configurarEventosEspecificos recebeu:", modulo);
  if (modulo.trim().toLowerCase() === 'relindices') {
    configurarEventosRelIndices();
    
    if (typeof aplicarPermissoes === "function" && window.permissoes) {
      aplicarPermissoes(window.permissoes);
    } else {
      console.warn("⚠️ aplicarPermissoes ou window.permissoes ainda não estão disponíveis para LocalMontagem.");
    }
  }
}
window.configurarEventosEspecificos = configurarEventosEspecificos;


window.moduloHandlers = window.moduloHandlers || {};

window.moduloHandlers['RelIndices'] = { // A chave 'RelIndices' (com R maiúsculo) deve corresponder ao seu Index.js
    configurar: configurarEventosRelIndices,
    desinicializar: desinicializarRelIndicesModal
};