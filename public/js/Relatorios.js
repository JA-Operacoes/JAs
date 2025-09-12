import { fetchComToken } from '../utils/utils.js';

// Função para iniciar o módulo de relatórios
function initRelatorios() {
    const reportDateInput = document.getElementById('reportDate');
    const reportTypeSelect = document.getElementById('reportType');
    const gerarRelatorioBtn = document.getElementById('gerarRelatorioBtn');
    const printButton = document.getElementById('printButton');
    const closeButton = document.querySelector('#Relatorios .close');

    const today = new Date().toISOString().split('T')[0];
    reportDateInput.value = today;

    if (gerarRelatorioBtn) {
        gerarRelatorioBtn.addEventListener('click', gerarRelatorio);
    }
    
    if (printButton) {
        printButton.addEventListener('click', imprimirRelatorio);
    }

    if (closeButton) {
        closeButton.addEventListener('click', () => {
            const modal = document.getElementById('Relatorios');
            modal.style.display = 'none';
            document.body.classList.remove('modal-open');
        });
    }

    const urlParams = new URLSearchParams(window.location.search);
    const tipoRelatorioInicial = urlParams.get('tipo');

    if (tipoRelatorioInicial && reportTypeSelect.querySelector(`option[value="${tipoRelatorioInicial}"]`)) {
        reportTypeSelect.value = tipoRelatorioInicial;
        gerarRelatorio();
    }
}

// A sua função para formatar a data, se a string for yyyy-mm-dd
function formatarData(dataString) {
    if (!dataString) {
        return '';
    }
    const [ano, mes, dia] = dataString.split('-');
    return `${dia}-${mes}-${ano}`;
}

// // Sua função para montar a tabela, que parece estar funcionando
// function montarTabela(dados, colunas) {
//     if (!dados || dados.length === 0) {
//         return '<p>Nenhum dado para exibir.</p>';
//     }

//     let html = `
//         <table class="report-table">
//             <thead>
//                 <tr>
//                     ${colunas.map(col => `<th>${col}</th>`).join('')}
//                 </tr>
//             </thead>
//             <tbody>
//                 ${dados.map(item => `
//                     <tr>
//                         ${colunas.map(col => `<td>${item[col]}</td>`).join('')}
//                     </tr>
//                 `).join('')}
//             </tbody>
//         </table>
//     `;

//     return html;
// }



// function montarRelatorioHtmlEvento(dadosEvento, nomeRelatorio) {
//     let html = `
//         <div class="relatorio-evento">
//             <div class="print-header-top">
//                 <img src="http://localhost:3000/img/JA_Oper.png" alt="Logo JA" class="logo-ja">
//                 <div class="header-title-container">
//                     <h1 class="header-title">${dadosEvento.nomeEvento}</h1>
//                 </div>  
//             </div>
//             <h2>FECHAMENTO ${nomeRelatorio.toUpperCase()}</h2>
//     `;
    
//     if (dadosEvento.fechamento && dadosEvento.fechamento.length > 0) {
//         const dataInicio = formatarData(dadosEvento.fechamento[0].INÍCIO);
//         const dataTermino = formatarData(dadosEvento.fechamento[0].TÉRMINO);
    
//         html += `
//             <p>
//                 <span class="data-relatorio">Data de Início: ${dataInicio}</span>
//                 <span class="data-relatorio">Data Final: ${dataTermino}</span>
//             </p>
//         `;
        
//         html += montarTabela(dadosEvento.fechamento, ['FUNÇÃO', 'NOME', 'PIX', 'INÍCIO', 'TÉRMINO', 'VALOR ADICIONAL', 'VLR DIÁRIA', 'QTD', 'TOTAL DIÁRIAS', 'STATUS PAGAMENTO']);
//     } else {
//         html += '<p>Nenhum dado de fechamento de cachê encontrado.</p>';
//     }

//     // Adiciona a tabela de Utilização de Diárias dentro da mesma div
//     if (dadosEvento.utilizacaoDiarias && typeof dadosEvento.utilizacaoDiarias === 'object') {
//         const diarias = [{
//             diaria_em_uso: dadosEvento.utilizacaoDiarias.DIARIAS_EM_USO || '0.00',
//             diaria_contratada: dadosEvento.utilizacaoDiarias.DIARIAS_CONTRATADAS || '0.00'
//         }];
//         html += `
//             <div class="relatorio-secao-final">
//                 <h2>RELATÓRIO UTILIZAÇÃO DE DIÁRIAS</h2>
//                 ${montarTabela(diarias, ['diaria_em_uso', 'diaria_contratada'])}
//             </div>
//         `;
//     }

//     // Adiciona a tabela de Contingência dentro da mesma div
//     if (dadosEvento.contingencia && typeof dadosEvento.contingencia === 'object') {
//         const contingencia = [{
//             diaria_dobrada: dadosEvento.contingencia['Diária Dobrada'] || '0.00',
//             meia_diaria: dadosEvento.contingencia['Meia Diária'] || '0.00'
//         }];
//         html += `
//             <div class="relatorio-secao-final">
//                 <h2>CONTINGÊNCIA</h2>
//                 ${montarTabela(contingencia, ['diaria_dobrada', 'meia_diaria'])}
//             </div>
//         `;
//     }
    
//     html += `</div>`;
//     return html;
// }

// async function gerarRelatorio() {
//     const tipoRelatorioSelect = document.getElementById('reportType');
//     const tipoRelatorio = tipoRelatorioSelect.value;
//     const dataSelecionada = document.getElementById('reportDate').value;
//     const outputDiv = document.getElementById('reportOutput');
//     const printButton = document.getElementById('printButton');
//     const nomeRelatorio = tipoRelatorioSelect.options[tipoRelatorioSelect.selectedIndex].text;

//     if (!dataSelecionada) {
//         alert('Por favor, selecione uma data.');
//         return;
//     }

//     const apiUrl = `/relatorios?tipo=${tipoRelatorio}&data=${dataSelecionada}`;

//     try {
//         outputDiv.innerHTML = '<p>Carregando relatório...</p>';
//         const dados = await fetchComToken(apiUrl);
//         let relatorioHtmlCompleto = '';
//         let temRegistrosParaImprimir = false;

//         const eventosAgrupados = dados.fechamentoCache.reduce((acc, current) => {
//             const evento = current.nomeEvento;
//             if (!acc[evento]) {
//                 acc[evento] = {
//                     nomeEvento: evento,
//                     fechamento: [],
//                     utilizacaoDiarias: dados.utilizacaoDiarias,
//                     contingencia: dados.contingencia
//                 };
//             }
//             acc[evento].fechamento.push(current);
//             return acc;
//         }, {});

//         const nomesDosEventos = Object.keys(eventosAgrupados);

//         if (nomesDosEventos.length > 0) {
//             temRegistrosParaImprimir = true;
//             for (let i = 0; i < nomesDosEventos.length; i++) {
//                 const nomeEvento = nomesDosEventos[i];
//                 const dadosDoEventoCompleto = eventosAgrupados[nomeEvento];
//                 relatorioHtmlCompleto += montarRelatorioHtmlEvento(dadosDoEventoCompleto, nomeRelatorio);
//             }
//         }

//         if (!temRegistrosParaImprimir) {
//             outputDiv.innerHTML = '<p>Nenhum registro encontrado para a data selecionada.</p>';
//             printButton.style.display = 'none';
//         } else {
//             outputDiv.innerHTML = relatorioHtmlCompleto;
//             printButton.style.display = 'inline-block';
//         }

//     } catch (error) {
//         console.error('Falha ao gerar o relatório:', error);
//         alert('Ocorreu um erro ao carregar o relatório.');
//         outputDiv.innerHTML = '';
//         printButton.style.display = 'none';
//     }
// }

// // Sua função de impressão
// function imprimirRelatorio() {
//     console.log('Iniciando a impressão...');
    
//     const conteudoRelatorio = document.getElementById('reportOutput').innerHTML;
//     const printIframe = document.getElementById('printIframe');
//     const iframeDoc = printIframe.contentDocument || printIframe.contentWindow.document;

//     iframeDoc.body.innerHTML = ''; // Limpa o conteúdo antes de adicionar

//     const styleElement = iframeDoc.createElement('style');

//     const estilosCompletos = `
//         @page {
//             size: A4 landscape;
//             margin: 1cm;
//         }
//         body {
//             font-family: Arial, sans-serif;
//             margin: 0;
//             padding: 0;
//             -webkit-print-color-adjust: exact;
//             print-color-adjust: exact;
//         }
//         .relatorio-evento {
//             page-break-after: always;
//         }
//         .relatorio-evento:last-child {
//             page-break-after: auto;
//         }
//         .print-header-top {
//             display: flex;
//             justify-content: space-between;
//             align-items: center;
//             padding: 10px 0;
//             background-color: silver;
//             margin-bottom: 20px;
//         }
//         .logo-ja {
//             max-width: 50px;
//             height: auto;
//             margin-left: 20px;
//         }
//         .header-title-container {
//             text-align: center;
//             flex-grow: 1;
//         }
//         .header-title {
//             font-size: 24px;
//             color: #333;
//         }
//         .report-table {
//             width: 100%;
//             border-collapse: collapse;
//             font-size: 10px;
//         }
//         .report-table th, .report-table td {
//             border: 1px solid #000;
//             padding: 4px 6px;
//             white-space: normal;
//             word-wrap: break-word;
//             overflow: hidden;
//         }
//         .report-table thead {
//             background-color: #a8a8a8ff;
//             color: black;
//         }
//         h2 {
//             page-break-before: auto;
//             font-size: 16px;
//             margin-top: 20px;
//             text-align: left;
//             color: #333;
//             border-bottom: 2px solid #ddd;
//             padding-bottom: 10px;
//             margin-bottom: 15px;
//         }
//         p {
//             margin: 5px 0;
//             text-align: left;
//         }
//         .data-relatorio {
//             margin-right: 20px;
//             font-weight: bold;
//             background-color: orange;
//             padding: 2px 5px;
//             border-radius: 3px;
//             display: inline-block;
//             color: #333;
//         }
//     `;

//     styleElement.innerHTML = estilosCompletos;
//     iframeDoc.head.appendChild(styleElement);
//     iframeDoc.body.innerHTML = conteudoRelatorio;

//     const relatorios = iframeDoc.body.querySelectorAll('.relatorio-evento');
//     if (relatorios.length > 0) {
//         relatorios[relatorios.length - 1].style.pageBreakAfter = 'auto';
//     }

//     setTimeout(() => {
//         printIframe.contentWindow.focus();
//         printIframe.contentWindow.print();
//         setTimeout(() => {
//             iframeDoc.body.innerHTML = '';
//         }, 100);
//     }, 500);
// }

// Sua função para montar a tabela
// Sua função para montar a tabela
function montarTabela(dados, colunas) {
    if (!dados) {
        return '<p>Nenhum dado para exibir.</p>';
    }

    // Se os dados não são um array, mas um objeto, crie um array com ele.
    const dadosArray = Array.isArray(dados) ? dados : [dados];

    if (dadosArray.length === 0) {
        return '<p>Nenhum dado para exibir.</p>';
    }

    let html = `
        <table class="report-table">
            <thead>
                <tr>
                    ${colunas.map(col => `<th>${col}</th>`).join('')}
                </tr>
            </thead>
            <tbody>
                ${dadosArray.map(item => `
                    <tr>
                        ${colunas.map(col => `<td>${item[col]}</td>`).join('')}
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    return html;
}

// A sua função que monta o relatório de Fechamento de Cachê por evento
// A sua função que monta o relatório de Fechamento de Cachê por evento
// function montarRelatorioHtmlEvento(dadosFechamento, nomeEvento, nomeRelatorio, dadosUtilizacao, dadosContingencia) {
//     let html = `
//         <div class="relatorio-evento">
//             <div class="print-header-top">
//                 <img src="http://localhost:3000/img/JA_Oper.png" alt="Logo JA" class="logo-ja">
//                 <div class="header-title-container">
//                     <h1 class="header-title">${nomeEvento}</h1>
//                 </div>  
//             </div>
//             <h2>FECHAMENTO ${nomeRelatorio.toUpperCase()}</h2>
//     `;
    
//     if (dadosFechamento && dadosFechamento.length > 0) {
//         const dataInicio = formatarData(dadosFechamento[0].INÍCIO);
//         const dataTermino = formatarData(dadosFechamento[0].TÉRMINO);
    
//         html += `
//             <p>
//                 <span class="data-relatorio">Data de Início: ${dataInicio}</span>
//                 <span class="data-relatorio">Data Final: ${dataTermino}</span>
//             </p>
//         `;
        
//         html += montarTabela(dadosFechamento, ['FUNÇÃO', 'NOME', 'PIX', 'INÍCIO', 'TÉRMINO', 'VALOR ADICIONAL', 'VLR DIÁRIA', 'QTD', 'TOTAL DIÁRIAS', 'STATUS PAGAMENTO']);
//     } else {
//         html += '<p>Nenhum dado de fechamento de cachê encontrado.</p>';
//     }
    
//     // Agora adicionamos as tabelas de resumo dentro do mesmo contêiner de evento
//     if (dadosUtilizacao) {
//         html += `
//             <div class="relatorio-secao-final">
//                 <h2 class="utilizacao-diarias-header">RELATÓRIO UTILIZAÇÃO DE DIÁRIAS</h2>
//                 ${montarTabela(dadosUtilizacao, ['INFORMAÇÕES EM PROPOSTA', 'QUANTIDADE DE PROFISSIONAIS', 'DIÁRIAS CONTRATADAS', 'DIÁRIAS UTILIZADAS', 'SALDO'])}
//             </div>
//         `;
//     }

//     if (dadosContingencia) {
//         html += `
//             <div class="relatorio-secao-final">
//                 <h2 class="contingencia-header">CONTINGÊNCIA</h2>
//                 ${montarTabela(dadosContingencia, ['Profissional', 'Informacao', 'Observacao'])}
//             </div>
//         `;
//     }
    
//     html += `</div>`;
//     return html;
// }

// A sua função que monta o relatório de Fechamento de Cachê por evento
function montarRelatorioHtmlEvento(dadosFechamento, nomeEvento, nomeRelatorio, dadosUtilizacao, dadosContingencia) {
    let html = `
        <div class="relatorio-evento">
            <div class="print-header-top">
                <img src="http://localhost:3000/img/JA_Oper.png" alt="Logo JA" class="logo-ja">
                <div class="header-title-container">
                    <h1 class="header-title">${nomeEvento}</h1>
                </div>  
            </div>
            <h2>FECHAMENTO ${nomeRelatorio.toUpperCase()}</h2>
    `;
    
    if (dadosFechamento && dadosFechamento.length > 0) {
        const dataInicio = formatarData(dadosFechamento[0].INÍCIO);
        const dataTermino = formatarData(dadosFechamento[0].TÉRMINO);
    
        html += `
            <p>
                <span class="data-relatorio">Data de Início: ${dataInicio}</span>
                <span class="data-relatorio">Data Final: ${dataTermino}</span>
            </p>
        `;
        
        html += montarTabela(dadosFechamento, ['FUNÇÃO', 'NOME', 'PIX', 'INÍCIO', 'TÉRMINO', 'VALOR ADICIONAL', 'VLR DIÁRIA', 'QTD', 'TOTAL DIÁRIAS', 'STATUS PAGAMENTO']);
    } else {
        html += '<p>Nenhum dado de fechamento de cachê encontrado.</p>';
    }

    // Container para as tabelas de resumo lado a lado
    html += `<div class="relatorio-resumo-container">`;
    
    if (dadosUtilizacao) {
        html += `
            <div class="tabela-resumo">
                <h2 class="utilizacao-diarias-header">RELATÓRIO UTILIZAÇÃO DE DIÁRIAS</h2>
                ${montarTabela(dadosUtilizacao, ['INFORMAÇÕES EM PROPOSTA', 'QTD PROFISSIONAIS', 'DIÁRIAS CONTRATADAS', 'DIÁRIAS UTILIZADAS', 'SALDO'])}
            </div>
        `;
    }

    if (dadosContingencia) {
        html += `
            <div class="tabela-resumo">
                <h2 class="contingencia-header">CONTINGÊNCIA</h2>
                ${montarTabela(dadosContingencia, ['Profissional', 'Informacao', 'Observacao'])}
            </div>
        `;
    }

    html += `</div>`; // Fechando o container Flexbox
    
    html += `</div>`;
    return html;
}

// A sua função principal que gera o relatório completo
async function gerarRelatorio() {
    const tipoRelatorioSelect = document.getElementById('reportType');
    const tipoRelatorio = tipoRelatorioSelect.value;
    const dataSelecionada = document.getElementById('reportDate').value;
    const outputDiv = document.getElementById('reportOutput');
    const printButton = document.getElementById('printButton');
    const nomeRelatorio = tipoRelatorioSelect.options[tipoRelatorioSelect.selectedIndex].text;

    if (!dataSelecionada) {
        alert('Por favor, selecione uma data.');
        return;
    }

    const apiUrl = `/relatorios?tipo=${tipoRelatorio}&data=${dataSelecionada}`;

    try {
        outputDiv.innerHTML = '<p>Carregando relatório...</p>';
        const dados = await fetchComToken(apiUrl);
        
        let relatorioHtmlCompleto = '';
        let temRegistrosParaImprimir = false;

        if (dados.fechamentoCache && dados.fechamentoCache.length > 0) {
            temRegistrosParaImprimir = true;
            const eventosAgrupados = dados.fechamentoCache.reduce((acc, current) => {
                const evento = current.nomeEvento;
                if (!acc[evento]) {
                    acc[evento] = [];
                }
                acc[evento].push(current);
                return acc;
            }, {});

            const nomesDosEventos = Object.keys(eventosAgrupados);

            for (let i = 0; i < nomesDosEventos.length; i++) {
                const nomeEvento = nomesDosEventos[i];
                const dadosEvento = eventosAgrupados[nomeEvento];

                // Chama a função que agora cria o relatório completo do evento, incluindo as tabelas de resumo.
                relatorioHtmlCompleto += montarRelatorioHtmlEvento(dadosEvento, nomeEvento, nomeRelatorio, dados.utilizacaoDiarias, dados.contingencia);
            }
        }
        
        if (!temRegistrosParaImprimir) {
            outputDiv.innerHTML = '<p>Nenhum registro encontrado para a data selecionada.</p>';
            printButton.style.display = 'none';
        } else {
            outputDiv.innerHTML = relatorioHtmlCompleto;
            printButton.style.display = 'inline-block';
        }

    } catch (error) {
        console.error('Falha ao gerar o relatório:', error.message || error);
        alert('Ocorreu um erro ao carregar o relatório.');
        outputDiv.innerHTML = '';
        printButton.style.display = 'none';
    }
}
// A sua função de impressão
function imprimirRelatorio() {
    console.log('Iniciando a impressão...');
    
    const conteudoRelatorio = document.getElementById('reportOutput').innerHTML;
    const printIframe = document.getElementById('printIframe');
    const iframeDoc = printIframe.contentDocument || printIframe.contentWindow.document;

    iframeDoc.body.innerHTML = '';

    const styleElement = iframeDoc.createElement('style');

    const estilosCompletos = `
        @page {
            size: A4 landscape;
            margin: 1cm;
        }
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        .relatorio-evento {
            page-break-after: always;
        }
        .print-header-top {
            display: flow-root;
            justify-content: space-between;
            align-items: center;
            padding: 10px 0;
            background-color: silver;
            margin-bottom: 20px;
        }
        .logo-ja {
            max-width: 50px;
            height: auto;
            margin-left: 20px;
        }
        .header-title-container {
            text-align: center;
            flex-grow: 1;
        }
        .header-title {
            font-size: 24px;
            color: #333;
        }
        .report-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
        }
        .report-table th, .report-table td {
            border: 1px solid #000;
            padding: 4px 6px;
            white-space: normal;
            word-wrap: break-word;
            overflow: hidden;
        }
        .report-table thead {
            background-color: #a8a8a8ff;
            color: black;
        }
            /* Nova regra para o container das tabelas lado a lado */
        .relatorio-resumo-container {
            display: flex;
            gap: 20px;
            margin-top: 20px;
        }

        /* Nova regra para cada tabela de resumo */
        .tabela-resumo {
            flex: 1;
            width: 50%; /* Define que cada tabela ocupe 50% do espaço */
        }
        .tabela-resumo .report-table {
            font-size: 8px; /* Reduz o tamanho da fonte para 8px */
        }
        .utilizacao-diarias-header + .report-table thead {
            background-color: orange;
        }
        h2 {
            page-break-before: auto;
            font-size: 16px;
            margin-top: 20px;
            text-align: left;
            color: #333;
            border-bottom: 2px solid #ddd;
            padding-bottom: 10px;
            margin-bottom: 15px;
        }
        p {
            margin: 5px 0;
            text-align: left;
        }
        .data-relatorio {
            margin-right: 20px;
            font-weight: bold;
            background-color: orange;
            padding: 2px 5px;
            border-radius: 3px;
            display: inline-block;
            color: #333;
        }
    `;

    styleElement.innerHTML = estilosCompletos;
    iframeDoc.head.appendChild(styleElement);
    iframeDoc.body.innerHTML = conteudoRelatorio;

    const relatorios = iframeDoc.body.querySelectorAll('.relatorio-evento');
    if (relatorios.length > 0) {
        relatorios[relatorios.length - 1].style.pageBreakAfter = 'auto';
    }

    setTimeout(() => {
        printIframe.contentWindow.focus();
        printIframe.contentWindow.print();
        setTimeout(() => {
            iframeDoc.body.innerHTML = '';
        }, 100);
    }, 500);
}

initRelatorios();