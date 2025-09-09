import { fetchComToken } from '../utils/utils.js';

// Função para iniciar o módulo de relatórios
// function initRelatorios() {
//     // Busca os elementos do DOM
//     const reportDateInput = document.getElementById('reportDate');
//     const reportTypeSelect = document.getElementById('reportType');
//     const gerarRelatorioBtn = document.getElementById('gerarRelatorioBtn');
//     const printButton = document.getElementById('printButton');
//     const closeButton = document.querySelector('#Relatorios .close');

//     // Define a data atual como valor padrão
//     const today = new Date().toISOString().split('T')[0];
//     reportDateInput.value = today;

//     // Adiciona o event listener ao botão
//     if (gerarRelatorioBtn) {
//         gerarRelatorioBtn.addEventListener('click', gerarRelatorio);
//     }
//     
//     // Adiciona o event listener ao botão de imprimir
//     if (printButton) {
//         printButton.addEventListener('click', imprimirRelatorio);
//     }

//     // Adiciona o event listener ao botão de fechar para fechar o modal
//     if (closeButton) {
//         closeButton.addEventListener('click', () => {
//             const modal = document.getElementById('Relatorios');
//             modal.style.display = 'none';
//             document.body.classList.remove('modal-open');
//         });
//     }

//     const urlParams = new URLSearchParams(window.location.search);
//     const tipoRelatorioInicial = urlParams.get('tipo');

//     if (tipoRelatorioInicial && reportTypeSelect.querySelector(`option[value="${tipoRelatorioInicial}"]`)) {
//         reportTypeSelect.value = tipoRelatorioInicial;
//         gerarRelatorio();
//     }
// }

// Funções principais
// async function gerarRelatorio() {
//     const tipoRelatorio = document.getElementById('reportType').value;
//     const dataSelecionada = document.getElementById('reportDate').value;
//     const outputDiv = document.getElementById('reportOutput');
//     const printButton = document.getElementById('printButton');

//     if (!dataSelecionada) {
//         alert('Por favor, selecione uma data.');
//         return;
//     }
//     
//     const apiUrl = `/relatorios?tipo=${tipoRelatorio}&data=${dataSelecionada}`;
//     console.log("CAMINHO RELATORIO", apiUrl);
//     
//     try {
//         outputDiv.innerHTML = '<p>Carregando relatório...</p>';
//         
//         // A resposta da API agora é um objeto com seções
//         const dados = await fetchComToken(apiUrl);
//         console.log("Dados recebidos da API:", dados);

//         // Verifica se a tabela principal (fechamentoCache) tem registros
//         const temRegistros = dados.fechamentoCache && dados.fechamentoCache.length > 0;

//         if (!temRegistros) {
//             outputDiv.innerHTML = '<p>Nenhum registro encontrado para a data selecionada.</p>';
//             printButton.style.display = 'none';
//             return;
//         }

//         // Chama a função para montar o relatório completo
//         montarRelatorioCompleto(dados, outputDiv, tipoRelatorio);
//         printButton.style.display = 'inline-block';

//     } catch (error) {
//         console.error('Falha ao gerar o relatório:', error);
//         alert('Ocorreu um erro ao carregar o relatório.');
//         outputDiv.innerHTML = '';
//         printButton.style.display = 'none';
//     }
// }

// function montarRelatorioCompleto(dados, container, tipoRelatorio) {
//     let html = '';

//     // Cabeçalho do relatório (ISC, Data de Início, etc.)
//     html += `
//         <div class="report-header">
//             <h1>ISC</h1>
//             <p>Data de Início: ${dados.fechamentoCache[0].INÍCIO}</p>
//             <p>Data Final: ${dados.fechamentoCache[0].TÉRMINO}</p>
//         </div>
//     `;

//     // Seção 1: FECHAMENTO CACHÊ (Tabela principal)
//     html += '<h2>FECHAMENTO CACHÊ</h2>';
//     html += montarTabela(dados.fechamentoCache, ['FUNÇÃO', 'NOME', 'PIX', 'INÍCIO', 'TÉRMINO', 'VALOR ADICIONAL', 'VLR DIÁRIA', 'QTD', 'TOTAL DIÁRIAS', 'STATUS PAGAMENTO']);

//     // Seção 2: RELATÓRIO UTILIZAÇÃO DE DIÁRIAS
//     html += '<h2>RELATÓRIO UTILIZAÇÃO DE DIÁRIAS</h2>';
//     html += montarTabela(
//         [dados.utilizacaoDiarias], 
//         ['DIÁRIAS CONTRATADAS', 'DIÁRIAS EM USO'],
//         (row) => `<td colspan="2">${row.DIARIAS_CONTRATADAS}</td><td></td><td colspan="2">${row.DIARIAS_EM_USO}</td>` // Exemplo de renderização
//     );

//     // Seção 3: CONTINGÊNCIA
//     html += '<h2>CONTINGÊNCIA</h2>';
//     html += montarTabela(
//         [dados.contingencia], 
//         ['Diária Dobrada', 'Meia Diária'],
//         (row) => `<td>${row['Diária Dobrada']}</td><td>${row['Meia Diária']}</td>`
//     );

//     // Exibindo o HTML gerado no container principal
//     container.innerHTML = html;
// }

// // Função genérica para montar tabelas, agora mais flexível
// function montarTabela(dados, headers, customRowRenderer = null) {
//     if (!dados || dados.length === 0) return '';
//     
//     let html = `
//         <table class="report-table">
//             <thead>
//                 <tr>
//                     ${headers.map(header => `<th>${header}</th>`).join('')}
//                 </tr>
//             </thead>
//             <tbody>
//     `;

//     if (customRowRenderer) {
//         dados.forEach(row => {
//             html += `<tr>${customRowRenderer(row)}</tr>`;
//         });
//     } else {
//         dados.forEach(row => {
//             html += '<tr>';
//             headers.forEach(header => {
//                 const value = row[header];
//                 let formattedValue = value;
//                 
//                 if (typeof value === 'number') {
//                     formattedValue = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
//                 } else if (Array.isArray(value)) {
//                     formattedValue = value.join(', ');
//                 } else if (value === null || value === undefined) {
//                     formattedValue = '';
//                 }
//                 
//                 html += `<td>${formattedValue}</td>`;
//             });
//             html += '</tr>';
//         });
//     }
//     
//     html += `
//             </tbody>
//         </table>
//     `;
//     return html;
// }


// function imprimirRelatorio() {
//     console.log('Tentando imprimir...');
//     
//     // Armazena a classe atual do body
//     const originalBodyClass = document.body.className;

//     // Remove a classe que causa o conflito
//     document.body.classList.remove('modal-open');

//     // Usa um pequeno atraso para garantir que a classe foi removida antes de imprimir
//     setTimeout(() => {
//         window.print();
//         
//         // Retorna a classe original após um pequeno atraso, garantindo a impressão
//         setTimeout(() => {
//             document.body.className = originalBodyClass;
//         }, 100);
//     }, 100);
// }



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

// // async function gerarRelatorio() {
// //     const tipoRelatorioSelect = document.getElementById('reportType');
// //     const tipoRelatorio = tipoRelatorioSelect.value;
// //     const dataSelecionada = document.getElementById('reportDate').value;
// //     const outputDiv = document.getElementById('reportOutput');
// //     const printButton = document.getElementById('printButton');
// //     const nomeRelatorio = tipoRelatorioSelect.options[tipoRelatorioSelect.selectedIndex].text;

// //     console.log("NOME DO RELATORIO:", nomeRelatorio);

// //     if (!dataSelecionada) {
// //         alert('Por favor, selecione uma data.');
// //         return;
// //     }
    
// //     const apiUrl = `/relatorios?tipo=${tipoRelatorio}&data=${dataSelecionada}`;
// //     console.log("CAMINHO RELATORIO", apiUrl);
    
// //     try {
// //         outputDiv.innerHTML = '<p>Carregando relatório...</p>';
// //         const dados = await fetchComToken(apiUrl);
// //         console.log("Dados recebidos da API:", dados);

// //         const temRegistros = dados.fechamentoCache && dados.fechamentoCache.length > 0;
// //         if (!temRegistros) {
// //             outputDiv.innerHTML = '<p>Nenhum registro encontrado para a data selecionada.</p>';
// //             printButton.style.display = 'none';
// //             return;
// //         }

// //         const eventosAgrupados = dados.fechamentoCache.reduce((acc, current) => {
// //             const evento = current.nomeEvento;
// //             if (!acc[evento]) {
// //                 acc[evento] = [];
// //             }
// //             acc[evento].push(current);
// //             return acc;
// //         }, {});

// //         let relatorioHtmlCompleto = '';
// //         const nomesDosEventos = Object.keys(eventosAgrupados);

// //         for (let i = 0; i < nomesDosEventos.length; i++) {
// //             const nomeEvento = nomesDosEventos[i];
// //             const dadosEvento = eventosAgrupados[nomeEvento];

// //             relatorioHtmlCompleto += montarRelatorioHtmlEvento(
// //                 dadosEvento,
// //                // dados.utilizacaoDiarias,
// //                // dados.contingencia,
// //                 null,
// //                 null,
// //                 nomeEvento,
// //                 nomeRelatorio
// //             );
// //         }
        
// //         if (Array.isArray(dados.utilizacaoDiarias) && dados.utilizacaoDiarias.length > 0) {
// //             relatorioHtmlCompleto += `
// //                 <div class="relatorio-secao-final">
// //                     <h2>RELATÓRIO UTILIZAÇÃO DE DIÁRIAS</h2>
// //                     ${montarTabela(dados.utilizacaoDiarias, ['DIARIAS_EM_USO', 'DIARIAS_CONTRATADAS'])}
// //                 </div>
// //             `;
// //         }
// //         if (Array.isArray(dados.contingencia) && dados.contingencia.length > 0) {
// //             relatorioHtmlCompleto += `
// //                 <div class="relatorio-secao-final">
// //                     <h2>CONTINGÊNCIA</h2>
// //                     ${montarTabela(dados.contingencia, ['Diária Dobrada', 'Meia Diária'])}
// //                 </div>
// //             `;
// //         }

// //         outputDiv.innerHTML = relatorioHtmlCompleto;
// //         printButton.style.display = 'inline-block';

// //     } catch (error) {
// //         console.error('Falha ao gerar o relatório:', error);
// //         alert('Ocorreu um erro ao carregar o relatório.');
// //         outputDiv.innerHTML = '';
// //         printButton.style.display = 'none';
// //     }
// // }

// // Função para gerar e montar o relatório completo
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

//         const temRegistros = dados.fechamentoCache && dados.fechamentoCache.length > 0;
//         if (!temRegistros) {
//             outputDiv.innerHTML = '<p>Nenhum registro encontrado para a data selecionada.</p>';
//             printButton.style.display = 'none';
//             return;
//         }

//         const eventosAgrupados = dados.fechamentoCache.reduce((acc, current) => {
//             const evento = current.nomeEvento;
//             if (!acc[evento]) {
//                 acc[evento] = [];
//             }
//             acc[evento].push(current);
//             return acc;
//         }, {});

//         let relatorioHtmlCompleto = '';
//         const nomesDosEventos = Object.keys(eventosAgrupados);

//         for (let i = 0; i < nomesDosEventos.length; i++) {
//             const nomeEvento = nomesDosEventos[i];
//             const dadosEvento = eventosAgrupados[nomeEvento];

//             // 1. Gera o HTML de Fechamento de Cachê para cada evento
//             relatorioHtmlCompleto += montarRelatorioHtmlEvento(
//                 dadosEvento,
//                 nomeEvento,
//                 nomeRelatorio
//             );
//         }

//         // 2. Adiciona as tabelas de diárias e contingência UMA ÚNICA VEZ, no final
//         if (Array.isArray(dados.utilizacaoDiarias) && dados.utilizacaoDiarias.length > 0) {
//             relatorioHtmlCompleto += `
//                 <div class="relatorio-secao-final relatorio-evento">
//                     <h2>RELATÓRIO UTILIZAÇÃO DE DIÁRIAS</h2>
//                     ${montarTabela(dados.utilizacaoDiarias, ['DIARIAS_EM_USO', 'DIARIAS_CONTRATADAS'])}
//                 </div>
//             `;
//         }
//         if (Array.isArray(dados.contingencia) && dados.contingencia.length > 0) {
//             relatorioHtmlCompleto += `
//                 <div class="relatorio-secao-final relatorio-evento">
//                     <h2>CONTINGÊNCIA</h2>
//                     ${montarTabela(dados.contingencia, ['Diária Dobrada', 'Meia Diária'])}
//                 </div>
//             `;
//         }

//         outputDiv.innerHTML = relatorioHtmlCompleto;
//         printButton.style.display = 'inline-block';

//     } catch (error) {
//         console.error('Falha ao gerar o relatório:', error);
//         alert('Ocorreu um erro ao carregar o relatório.');
//         outputDiv.innerHTML = '';
//         printButton.style.display = 'none';
//     }
// }
// function formatarData(dataString) {
//     if (!dataString) {
//         return '';
//     }
//     const [ano, mes, dia] = dataString.split('-');
//     return `${dia}-${mes}-${ano}`;
// }

// // function montarRelatorioHtmlEvento(dadosFechamento, dadosDiarias, dadosContingencia, nomeEvento, nomeRelatorio) {
// //     // let html = `
// //     //     <div class="relatorio-evento">
// //     //         <div class="print-header-top">
// //     //             <img src="img/icons/favicon.ico" alt="Logo JA" class="logo-ja">
// //     //             <div class="header-title-container">
// //     //                 <h1 class="header-title">${nomeEvento}</h1>
// //     //             </div>  
// //     //         </div>
// //     //         <p>${nomeRelatorio}</p>
// //     // `;

// //     let html = `
// //         <div class="relatorio-evento print-content">
// //             <div class="print-header-top">
// //                 <img src="http://localhost:3000/img/icons/favicon.ico" alt="Logo JA" class="logo-ja">
// //                 <div class="header-title-container">
// //                     <h1 class="header-title">${nomeEvento}</h1>
// //                 </div>  
// //             </div>
     
// //     `;
// //     // html += `<h2>FECHAMENTO DE ${nomeRelatorio.toUpperCase()}</h2>`;
// //     // if (dadosFechamento && dadosFechamento.length > 0) {
// //     //     const dataInicio = formatarData(dadosFechamento[0].INÍCIO);
// //     //     const dataTermino = formatarData(dadosFechamento[0].TÉRMINO);

// //     //     html += `
// //     //         <p>
// //     //             Data de Início: <span class="data-relatorio">${dataInicio}</span>
// //     //             Data Final: <span class="data-relatorio">${dataTermino}</span>
// //     //         </p>
// //     //     `;
// //     // }

   
// //     // html += montarTabela(dadosFechamento, ['FUNÇÃO', 'NOME', 'PIX', 'INÍCIO', 'TÉRMINO', 'QTD', 'VLR DIÁRIA','VLR ADICIONAL', 'TOTAL DIÁRIAS', 'STATUS PAGAMENTO']);

// //     // if (Array.isArray(dadosDiarias) && dadosDiarias.length > 0) {
// //     //     html += '<h2>RELATÓRIO UTILIZAÇÃO DE DIÁRIAS</h2>';
// //     //     html += montarTabela(dadosDiarias, ['DIARIAS_EM_USO', 'DIARIAS_CONTRATADAS']);
// //     // }

// //     // if (Array.isArray(dadosContingencia) && dadosContingencia.length > 0) {
// //     //     html += '<h2>CONTINGÊNCIA</h2>';
// //     //     html += montarTabela(dadosContingencia, ['Diária Dobrada', 'Meia Diária']);
// //     // }
    
// //     html += `</div>`;
// //     return html;
// // }

// function montarRelatorioHtmlEvento(dadosFechamento, nomeEvento, nomeRelatorio) {
//     let html = `
//         <div class="relatorio-evento">
//             <div class="print-header-top">
//                 <img src="http://localhost:3000/img/icons/favicon.ico" alt="Logo JA" class="logo-ja">
//                 <div class="header-title-container">
//                     <h1 class="header-title">${nomeEvento}</h1>
//                 </div>  
//             </div>
           
//     `;

//     html += `<h2>FECHAMENTO ${nomeRelatorio.toUpperCase()}</h2>`;
//     if (dadosFechamento && dadosFechamento.length > 0) {
//         const dataInicio = formatarData(dadosFechamento[0].INÍCIO);
//         const dataTermino = formatarData(dadosFechamento[0].TÉRMINO);
    
//         html += `
//             <p>
//                 Data de Início: <span class="data-relatorio">${dataInicio}</span>
//                 Data Final: <span class="data-relatorio">${dataTermino}</span>
//             </p>
//         `;
//     }

    
//     html += montarTabela(dadosFechamento, ['FUNÇÃO', 'NOME', 'PIX', 'INÍCIO', 'TÉRMINO', 'VALOR ADICIONAL', 'VLR DIÁRIA', 'QTD', 'TOTAL DIÁRIAS', 'STATUS PAGAMENTO']);
    
//     html += `</div>`;
//     return html;
// }

// function montarTabela(dados, headers) {
//     if (!Array.isArray(dados)) {
//         dados = [dados];
//     }
//     if (!dados || dados.length === 0) return '';
    
//     let html = `
//         <table class="report-table">
//             <thead>
//                 <tr>
//                     ${headers.map(header => `<th>${header}</th>`).join('')}
//                 </tr>
//             </thead>
//             <tbody>
//     `;

//     dados.forEach(row => {
//         html += '<tr>';
//         headers.forEach(header => {
//             const value = row[header];
//             let formattedValue = value;
            
//             if (typeof value === 'number') {
//                 formattedValue = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
//             } else if (Array.isArray(value)) {
//                 formattedValue = value.join(', ');
//             } else if (value === null || value === undefined) {
//                 formattedValue = '';
//             }
            
//             html += `<td>${formattedValue}</td>`;
//         });
//         html += '</tr>';
//     });
    
//     html += `
//             </tbody>
//         </table>
//     `;
//     return html;
// }

// // function imprimirRelatorio() {
// //     console.log('Tentando imprimir...');
// //     const originalBodyClass = document.body.className;
// //     document.body.classList.remove('modal-open');
    
// //     // Remova a lógica de setTimeout para evitar o problema de tempo
// //     window.print();
    
// //     setTimeout(() => {
// //         document.body.className = originalBodyClass;
// //     }, 100);
// // }

// // function imprimirRelatorio() {
// //     console.log('Tentando imprimir via iframe...');
    
// //     const conteudoRelatorio = document.getElementById('reportOutput').innerHTML;
// //     const printIframe = document.getElementById('printIframe');
// //     const iframeDoc = printIframe.contentWindow.document;
    
// //     const novoHtml = `
// //         <!DOCTYPE html>
// //         <html>
// //         <head>
// //             <title>Relatório de Eventos</title>
// //             <style>
// //                 @page {
// //                     size: A4 landscape;
// //                     margin: 1cm;
// //                 }
// //                 body {
// //                     font-family: Arial, sans-serif;
// //                     margin: 0;
// //                     padding: 0;
// //                     -webkit-print-color-adjust: exact;
// //                     print-color-adjust: exact;
// //                 }
// //                 .relatorio-evento {
// //                     page-break-after: always;
// //                 }
// //                 .relatorio-evento:last-child {
// //                     page-break-after: auto;
// //                 }
// //                 .print-header-top {
// //                     display: flex;
// //                     justify-content: space-between;
// //                     align-items: center;
// //                     padding: 10px 0;
// //                     background-color: silver;
// //                     margin-bottom: 20px;
// //                 }
// //                 .logo-ja {
// //                     max-width: 150px;
// //                     height: auto;
// //                     margin-left: 20px;
// //                 }
// //                 .header-title-container {
// //                     text-align: center;
// //                     flex-grow: 1;
// //                 }
// //                 .header-title {
// //                     font-size: 24px;
// //                     color: #333;
// //                 }
// //                 .report-table {
// //                     width: 100%;
// //                     border-collapse: collapse;
// //                     font-size: 10px;
// //                 }
// //                 .report-table th, .report-table td {
// //                     border: 1px solid #000;
// //                     padding: 4px 6px;
// //                     white-space: normal;
// //                     word-wrap: break-word;
// //                     overflow: hidden;
// //                 }
// //                 h2 {
// //                     page-break-before: auto;
// //                     font-size: 16px;                    
// //                     margin-top: 20px;
                    
// //                     text-align: left; /* Ou center, dependendo do seu desejo */
// //                     color: #333;
// //                     border-bottom: 2px solid #ddd;
// //                     padding-bottom: 10px;
// //                     margin-bottom: 15px;
// //                 }
// //                 p {
// //                     margin: 5px 0;
// //                     text-align: left; /* Ajuste se necessário */
// //                 }
// //                 .data-relatorio {
// //                     margin-right: 20px; /* Ajuste o valor para o espaçamento desejado */
// //                     font-weight: bold;  /* Exemplo: opcionalmente, você pode estilizar as datas */
// //                     background-color: yellow; /* Adiciona a tarja amarela */
// //                     padding: 2px 5px; /* Adiciona um pequeno preenchimento para a tarja não ficar colada ao texto */
// //                     border-radius: 3px; /* Opcional: bordas arredondadas para a tarja */
// //                     display: inline-block; 
// //                     color: #333;
// //                 }
// //             </style>
// //         </head>
// //         <body>
// //             ${conteudoRelatorio}
// //         </body>
// //         </html>
// //     `;

// //     // Limpe o conteúdo do iframe e insira o novo HTML
// //     iframeDoc.open();
// //     iframeDoc.write(novoHtml);
// //     iframeDoc.close();

// //     // Chame a impressão
// //     printIframe.contentWindow.focus();
// //     printIframe.contentWindow.print();

// //     // Limpe o iframe após a impressão
// //     setTimeout(() => {
// //         iframeDoc.innerHTML = '';
// //     }, 100);
// // }

// function imprimirRelatorio() {
//     console.log('Iniciando a impressão...');
    
//     const conteudoRelatorio = document.getElementById('reportOutput').innerHTML;
//     const printIframe = document.getElementById('printIframe');
//     const iframeDoc = printIframe.contentDocument || printIframe.contentWindow.document;

//     // Remove o conteúdo do body para evitar duplicação em impressões consecutivas
//     iframeDoc.body.innerHTML = '';

//     // Cria o elemento <style>
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
//             max-width: 150px;
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
//             background-color: #007bff;
//             color: white;
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
//             background-color: yellow;
//             padding: 2px 5px;
//             border-radius: 3px;
//             display: inline-block;
//             color: #333;
//         }
//     `;

//     styleElement.innerHTML = estilosCompletos;

//     // Adiciona os estilos ao head do iframe
//     iframeDoc.head.appendChild(styleElement);
//     // Define o conteúdo do corpo do iframe
//     iframeDoc.body.innerHTML = conteudoRelatorio;

//     setTimeout(() => {
//         printIframe.contentWindow.focus();
//         printIframe.contentWindow.print();

//         // Limpa o iframe após a impressão para evitar duplicação em impressões futuras
//         setTimeout(() => {
//             iframeDoc.body.innerHTML = '';
//         }, 100);

//     }, 500);
// }

// A sua função para formatar a data, se a string for yyyy-mm-dd
function formatarData(dataString) {
    if (!dataString) {
        return '';
    }
    const [ano, mes, dia] = dataString.split('-');
    return `${dia}-${mes}-${ano}`;
}

// Sua função para montar a tabela, que parece estar funcionando
function montarTabela(dados, colunas) {
    if (!dados || dados.length === 0) {
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
                ${dados.map(item => `
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
// function montarRelatorioHtmlEvento(dadosFechamento, nomeEvento, nomeRelatorio) {
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
//     // html += `<h2>FECHAMENTO ${nomeRelatorio.toUpperCase()}</h2>`;
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
    
//     html += `</div>`;
//     return html;
// }

// // A sua função principal que gera o relatório completo e chama a impressão
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
//         console.log('Dados da API:', dados); // Para depuração
        
//         let relatorioHtmlCompleto = '';
//         let temRegistrosParaImprimir = false;

//         // Seção 1: Fechamento de Cache por evento
//        const eventosAgrupados = dados.fechamentoCache.reduce((acc, current) => {
//             const evento = current.nomeEvento;
//             if (!acc[evento]) {
//                 acc[evento] = {
//                     fechamento: [],
//                     utilizacaoDiarias: null, // Inicializa com null
//                     contingencia: null     // Inicializa com null
//                 };
//             }
//             acc[evento].fechamento.push(current);
            
//             // Adiciona as tabelas de resumo a cada evento, se existirem na API
//             if (dados.utilizacaoDiarias) {
//                 acc[evento].utilizacaoDiarias = dados.utilizacaoDiarias;
//             }
//             if (dados.contingencia) {
//                 acc[evento].contingencia = dados.contingencia;
//             }
//             return acc;
//         }, {});

//         const nomesDosEventos = Object.keys(eventosAgrupados);

//         if (nomesDosEventos.length > 0) {
//             temRegistrosParaImprimir = true;
//             for (let i = 0; i < nomesDosEventos.length; i++) {
//                 const nomeEvento = nomesDosEventos[i];
//                 const dadosEvento = eventosAgrupados[nomeEvento];

//                 // 1. Gera o relatório de Fechamento para o evento atual
//                 relatorioHtmlCompleto += montarRelatorioHtmlEvento(dadosEvento.fechamento, nomeEvento, nomeRelatorio);
                
//                 // 2. Adiciona a tabela de Utilização de Diárias logo abaixo
//                 if (dadosEvento.utilizacaoDiarias && typeof dadosEvento.utilizacaoDiarias === 'object') {
//                     const diarias = [{
//                         diaria_em_uso: dadosEvento.utilizacaoDiarias.DIARIAS_EM_USO || '0.00',
//                         diaria_contratada: dadosEvento.utilizacaoDiarias.DIARIAS_CONTRATADAS || '0.00'
//                     }];
//                     relatorioHtmlCompleto += `
//                         <div class="relatorio-secao-final">
//                             <h2>RELATÓRIO UTILIZAÇÃO DE DIÁRIAS</h2>
//                             ${montarTabela(diarias, ['diaria_em_uso', 'diaria_contratada'])}
//                         </div>
//                     `;
//                 }

//                 // 3. Adiciona a tabela de Contingência logo depois
//                 if (dadosEvento.contingencia && typeof dadosEvento.contingencia === 'object') {
//                     const contingencia = [{
//                         diaria_dobrada: dadosEvento.contingencia['Diária Dobrada'] || '0.00',
//                         meia_diaria: dadosEvento.contingencia['Meia Diária'] || '0.00'
//                     }];
//                     relatorioHtmlCompleto += `
//                         <div class="relatorio-secao-final">
//                             <h2>CONTINGÊNCIA</h2>
//                             ${montarTabela(contingencia, ['diaria_dobrada', 'meia_diaria'])}
//                         </div>
//                     `;
//                 }
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

function montarRelatorioHtmlEvento(dadosEvento, nomeRelatorio) {
    let html = `
        <div class="relatorio-evento">
            <div class="print-header-top">
                <img src="http://localhost:3000/img/JA_Oper.png" alt="Logo JA" class="logo-ja">
                <div class="header-title-container">
                    <h1 class="header-title">${dadosEvento.nomeEvento}</h1>
                </div>  
            </div>
            <h2>FECHAMENTO ${nomeRelatorio.toUpperCase()}</h2>
    `;
    
    if (dadosEvento.fechamento && dadosEvento.fechamento.length > 0) {
        const dataInicio = formatarData(dadosEvento.fechamento[0].INÍCIO);
        const dataTermino = formatarData(dadosEvento.fechamento[0].TÉRMINO);
    
        html += `
            <p>
                <span class="data-relatorio">Data de Início: ${dataInicio}</span>
                <span class="data-relatorio">Data Final: ${dataTermino}</span>
            </p>
        `;
        
        html += montarTabela(dadosEvento.fechamento, ['FUNÇÃO', 'NOME', 'PIX', 'INÍCIO', 'TÉRMINO', 'VALOR ADICIONAL', 'VLR DIÁRIA', 'QTD', 'TOTAL DIÁRIAS', 'STATUS PAGAMENTO']);
    } else {
        html += '<p>Nenhum dado de fechamento de cachê encontrado.</p>';
    }

    // Adiciona a tabela de Utilização de Diárias dentro da mesma div
    if (dadosEvento.utilizacaoDiarias && typeof dadosEvento.utilizacaoDiarias === 'object') {
        const diarias = [{
            diaria_em_uso: dadosEvento.utilizacaoDiarias.DIARIAS_EM_USO || '0.00',
            diaria_contratada: dadosEvento.utilizacaoDiarias.DIARIAS_CONTRATADAS || '0.00'
        }];
        html += `
            <div class="relatorio-secao-final">
                <h2>RELATÓRIO UTILIZAÇÃO DE DIÁRIAS</h2>
                ${montarTabela(diarias, ['diaria_em_uso', 'diaria_contratada'])}
            </div>
        `;
    }

    // Adiciona a tabela de Contingência dentro da mesma div
    if (dadosEvento.contingencia && typeof dadosEvento.contingencia === 'object') {
        const contingencia = [{
            diaria_dobrada: dadosEvento.contingencia['Diária Dobrada'] || '0.00',
            meia_diaria: dadosEvento.contingencia['Meia Diária'] || '0.00'
        }];
        html += `
            <div class="relatorio-secao-final">
                <h2>CONTINGÊNCIA</h2>
                ${montarTabela(contingencia, ['diaria_dobrada', 'meia_diaria'])}
            </div>
        `;
    }
    
    html += `</div>`;
    return html;
}

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

        const eventosAgrupados = dados.fechamentoCache.reduce((acc, current) => {
            const evento = current.nomeEvento;
            if (!acc[evento]) {
                acc[evento] = {
                    nomeEvento: evento,
                    fechamento: [],
                    utilizacaoDiarias: dados.utilizacaoDiarias,
                    contingencia: dados.contingencia
                };
            }
            acc[evento].fechamento.push(current);
            return acc;
        }, {});

        const nomesDosEventos = Object.keys(eventosAgrupados);

        if (nomesDosEventos.length > 0) {
            temRegistrosParaImprimir = true;
            for (let i = 0; i < nomesDosEventos.length; i++) {
                const nomeEvento = nomesDosEventos[i];
                const dadosDoEventoCompleto = eventosAgrupados[nomeEvento];
                relatorioHtmlCompleto += montarRelatorioHtmlEvento(dadosDoEventoCompleto, nomeRelatorio);
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
        console.error('Falha ao gerar o relatório:', error);
        alert('Ocorreu um erro ao carregar o relatório.');
        outputDiv.innerHTML = '';
        printButton.style.display = 'none';
    }
}

// Sua função de impressão
function imprimirRelatorio() {
    console.log('Iniciando a impressão...');
    
    const conteudoRelatorio = document.getElementById('reportOutput').innerHTML;
    const printIframe = document.getElementById('printIframe');
    const iframeDoc = printIframe.contentDocument || printIframe.contentWindow.document;

    iframeDoc.body.innerHTML = ''; // Limpa o conteúdo antes de adicionar

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
        .relatorio-evento:last-child {
            page-break-after: auto;
        }
        .print-header-top {
            display: flex;
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