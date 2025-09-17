import { fetchComToken } from '../utils/utils.js';

// Função para iniciar o módulo de relatórios
function initRelatorios() {
    const reportStartDateInput = document.getElementById('reportStartDate');
    const reportEndDateInput = document.getElementById('reportEndDate');
    const reportTypeSelect = document.getElementById('reportType');
    const gerarRelatorioBtn = document.getElementById('gerarRelatorioBtn');
    const printButton = document.getElementById('printButton');
    const closeButton = document.querySelector('#Relatorios .close');

    const today = new Date().toISOString().split('T')[0];
    reportStartDateInput.value = today;
    reportEndDateInput.value = today;

    // 👉 Guardar referências dos listeners
    window.gerarRelatorioClickListener = function () {
        gerarRelatorio();
    };

    window.printButtonClickListener = function () {
        imprimirRelatorio();
    };

    window.closeButtonClickListener = function () {
        const modal = document.getElementById('Relatorios');
        modal.style.display = 'none';
        document.body.classList.remove('modal-open');
    };

    if (gerarRelatorioBtn) {
        gerarRelatorioBtn.addEventListener('click', window.gerarRelatorioClickListener);
    }

    if (printButton) {
        printButton.addEventListener('click', window.printButtonClickListener);
    }

    if (closeButton) {
        closeButton.addEventListener('click', window.closeButtonClickListener);
    }

    const urlParams = new URLSearchParams(window.location.search);
    const tipoRelatorioInicial = urlParams.get('tipo');

    if (tipoRelatorioInicial && reportTypeSelect.querySelector(`option[value="${tipoRelatorioInicial}"]`)) {
        reportTypeSelect.value = tipoRelatorioInicial;
        gerarRelatorio();
    }

    console.log("⚙️ Relatórios inicializado.");
}

// A sua função para formatar a data, se a string for yyyy-mm-dd
function formatarData(dataString) {
    if (!dataString) {
        return '';
    }
    const [ano, mes, dia] = dataString.split('-');
    return `${dia}-${mes}-${ano}`;
}



function preencherEventosPeriodo() {
    const startDate = document.getElementById('reportStartDate').value;
    const endDate = document.getElementById('reportEndDate').value;
    const eventSelect = document.getElementById('eventSelect');
    if (!startDate || !endDate) return;

    // Chame sua API que retorna eventos do período
fetchComToken(`/relatorios/eventos?inicio=${startDate}&fim=${endDate}`)
    .then(eventos => {
        eventSelect.innerHTML = '<option value="">Selecione um Evento</option>';
        eventos.forEach(ev => {
            const opt = document.createElement('option');
            opt.value = ev.idevento;
            opt.textContent = ev.nmevento;
            eventSelect.appendChild(opt);
        });
    })
    .catch(() => {
        eventSelect.innerHTML = '<option value="">Nenhum evento encontrado</option>';
    });
}

// Adicione listeners para atualizar o select quando as datas mudarem
document.getElementById('reportStartDate').addEventListener('change', preencherEventosPeriodo);
document.getElementById('reportEndDate').addEventListener('change', preencherEventosPeriodo);



// Sua função para montar a tabela
function montarTabela(dados, colunas, alinhamentosPorColuna = {}) {
    if (!dados) {
        return '<p>Nenhum dado para exibir.</p>';
    }

    const dadosArray = Array.isArray(dados) ? dados : [dados];

    if (dadosArray.length === 0) {
        return '<p>Nenhum dado para exibir.</p>';
    }

    let html = `
        <table class="report-table">
            <thead>
                <tr>
                    ${colunas.map(col => {
                        const alignClass = alinhamentosPorColuna[col] || '';
                        return `<th class="${alignClass}">${col}</th>`;
                    }).join('')}
                </tr>
            </thead>
            <tbody>
                ${dadosArray.map(item => `
                    <tr>
                        ${colunas.map(col => {
                            let valorCelula = item[col];
                            // Aplica a sua função formatarData para 'INÍCIO' ou 'TÉRMINO'
                            if (col === 'INÍCIO' || col === 'TÉRMINO') {
                                valorCelula = formatarData(item[col]);
                            }else if (['VLR ADICIONAL', 'VLR DIÁRIA', 'TOTAL DIÁRIAS'].includes(col) && typeof item[col] === 'number') {
                                    valorCelula = formatarMoeda(item[col]);
                            }

                            const alignClass = alinhamentosPorColuna[col] || '';
                            return `<td class="${alignClass}">${valorCelula || ''}</td>`;
                        }).join('')}
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    return html;
}

// A sua função que monta o relatório de Fechamento de Cachê por evento
function montarRelatorioHtmlEvento(dadosFechamento, nomeEvento, nomeRelatorio, dadosUtilizacao, dadosContingencia, totaisFechamentoCache) { // <<-- MODIFICAÇÃO: Adicionado totaisFechamentoCache
    // Função auxiliar para formatar moeda (adicione ela aqui ou mantenha global se já tiver)
    const formatarMoeda = (valor) => {
        return (valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

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
        
        const alinhamentosFechamento = {
            'FUNÇÃO': 'text-left',
            'NOME': 'text-left',
            'PIX': 'text-left',
            'INÍCIO': 'text-left',
            'TÉRMINO': 'text-left',
            'VLR DIÁRIA': 'text-right',
            'VLR ADICIONAL': 'text-right',            
            'QTD': 'text-center',
            'TOTAL DIÁRIAS': 'text-right',
            'STATUS PGTO': 'text-center'
        };

        const colunasFechamento = ['FUNÇÃO', 'NOME', 'PIX', 'INÍCIO', 'TÉRMINO', 'VLR DIÁRIA', 'VLR ADICIONAL',  'QTD', 'TOTAL DIÁRIAS', 'STATUS PGTO'];

        // <<-- MODIFICAÇÃO PRINCIPAL AQUI: Reconstrução da tabela de fechamento para adicionar a linha de total
        let tabelaFechamentoHtml = `
            <table class="report-table">
                <thead>
                    <tr>
                        ${colunasFechamento.map(col => {
                            const alignClass = alinhamentosFechamento[col] || '';
                            return `<th class="${alignClass}">${col}</th>`;
                        }).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${dadosFechamento.map(item => `
                        <tr>
                            <td class="${alinhamentosFechamento['FUNÇÃO'] || ''}">${item.FUNÇÃO || ''}</td>
                            <td class="${alinhamentosFechamento['NOME'] || ''}">${item.NOME || ''}</td>
                            <td class="${alinhamentosFechamento['PIX'] || ''}">${item.PIX || ''}</td>
                            <td class="${alinhamentosFechamento['INÍCIO'] || ''}">${formatarData(item.INÍCIO) || ''}</td>
                            <td class="${alinhamentosFechamento['TÉRMINO'] || ''}">${formatarData(item.TÉRMINO) || ''}</td>
                            <td class="${alinhamentosFechamento['VLR DIÁRIA'] || ''}">${formatarMoeda(item["VLR DIÁRIA"])}</td>
                            <td class="${alinhamentosFechamento['VLR ADICIONAL'] || ''}">${formatarMoeda(item["VLR ADICIONAL"])}</td>                            
                            <td class="${alinhamentosFechamento['QTD'] || ''}">${item.QTD || ''}</td>
                            <td class="${alinhamentosFechamento['TOTAL DIÁRIAS'] || ''}">${formatarMoeda(item["TOTAL DIÁRIAS"])}</td>
                            <td class="${alinhamentosFechamento['STATUS PGTO'] || ''}">${item["STATUS PGTO"] || ''}</td>
                        </tr>
                    `).join('')}
                    <tr>
                        <td colspan="5" style="text-align: right; font-weight: bold;">TOTAL GERAL DO EVENTO:</td>
                        <td class="${alinhamentosFechamento['VLR DIÁRIA'] || ''}" style="font-weight: bold;">${formatarMoeda(totaisFechamentoCache.totalVlrDiarias)}</td>
                        <td class="${alinhamentosFechamento['VLR ADICIONAL'] || ''}" style="font-weight: bold;">${formatarMoeda(totaisFechamentoCache.totalVlrAdicional)}</td> 
                        <td></td> <td class="${alinhamentosFechamento['TOTAL DIÁRIAS'] || ''}" style="font-weight: bold;">${formatarMoeda(totaisFechamentoCache.totalTotalDiarias)}</td>
                        <td></td> </tr>
                </tbody>
            </table>
        `;
        html += tabelaFechamentoHtml; // <<-- Adiciona a tabela com o total
    } else {
        html += '<p>Nenhum dado de fechamento de cachê encontrado.</p>';
    }

    // Container para as tabelas de resumo lado a lado
    html += `<div class="relatorio-resumo-container">`;
    
    if (dadosUtilizacao && dadosUtilizacao.length > 0) { // <<-- MODIFICAÇÃO: Adicionada verificação de length
        const nroOrcamento = dadosUtilizacao[0].nrorcamento || 'N/A'; 
        html += `
            <div class="tabela-resumo diarias">
                <h2 class="utilizacao-diarias-header">RELATÓRIO DE UTILIZAÇÃO DE DIÁRIAS (Orçamento: ${nroOrcamento})</h2> <table class="report-table">
                <table class="report-table">
                    <thead>
                        <tr class="header-group-row">
                            <th colspan="3" class="header-group">DIÁRIAS CONTRATADAS</th>
                            <th colspan="2" class="header-group">RESUMO DE USO</th>
                        </tr>
                        <tr>
                            <th>INFORMAÇÕES EM PROPOSTA</th>
                            <th>QTD PROFISSIONAIS</th>
                            <th>DIÁRIAS CONTRATADAS</th>
                            <th>DIÁRIAS UTILIZADAS</th>
                            <th>SALDO</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${montarTabelaBody(dadosUtilizacao)}
                    </tbody>
                </table>
            </div>
        `;
    } else { // <<-- MODIFICAÇÃO: Mensagem para quando não há dados
         html += `<div class="tabela-resumo diarias"><p>Nenhum dado de utilização de diárias para este evento.</p></div>`;
    }

    if (dadosContingencia && dadosContingencia.length > 0) { // <<-- MODIFICAÇÃO: Adicionada verificação de length
        // Assumindo que montarTabela(dadosContingencia, ['Profissional', 'Informacao', 'Observacao']) funciona para isso
        html += `
            <div class="tabela-resumo contingencia">
                <h2 class="contingencia-header">CONTINGÊNCIA</h2>
                ${montarTabela(dadosContingencia, ['Profissional', 'Informacao', 'Observacao'])}
            </div>
        `;
    } else { // <<-- MODIFICAÇÃO: Mensagem para quando não há dados
        html += `<div class="tabela-resumo contingencia"><p>Nenhum dado de contingência para este evento.</p></div>`;
    }

    html += `</div>`; // Fechando o container Flexbox
    
    html += `</div>`; // Fechando o relatorio-evento
    return html;
}

function montarTabelaBody(dados) {
    if (!dados || dados.length === 0) {
        return '<tr><td colspan="5">Nenhum dado disponível.</td></tr>';
    }

    let html = '';
    dados.forEach(item => {
        html += `
            <tr>
                <td>${item['INFORMAÇÕES EM PROPOSTA'] || ''}</td>
                <td>${item['QTD PROFISSIONAIS'] || ''}</td>
                <td>${item['DIÁRIAS CONTRATADAS'] || ''}</td>
                <td>${item['DIÁRIAS UTILIZADAS'] || ''}</td>
                <td>${item.SALDO || ''}</td>
            </tr>
        `;
    });
    return html;
}

// A sua função que busca os dados e renderiza o relatório
// Função para mostrar alertas na tela (pode ser uma função simples para o seu teste)
function mostrarAlerta(mensagem, tipo) {
    console.log(`[ALERTA - ${tipo.toUpperCase()}] ${mensagem}`);
    // Se você tiver um componente de alerta na sua interface,
    // adicione o código aqui para mostrá-lo.
}

async function gerarRelatorio() {
    console.log('Iniciando a geração do relatório...');

    // Desabilita o botão para evitar cliques múltiplos
    const gerarRelatorioBtn = document.getElementById('gerarRelatorioBtn');
    gerarRelatorioBtn.disabled = true;

    // Oculta a div do relatório para que ele não seja visível na tela
    const outputDiv = document.getElementById('reportOutput');
    outputDiv.style.display = 'none';

    // Obtém os dados dos campos
    const tipo = document.getElementById('reportType').value;
    const dataInicio = document.getElementById('reportStartDate').value;
    const dataFim = document.getElementById('reportEndDate').value;
    let evento = document.getElementById('eventSelect').value;
    const nomeRelatorio = document.getElementById('reportType').options[document.getElementById('reportType').selectedIndex].text;

    if (!tipo || !dataInicio || !dataFim) {
        alert('Por favor, preencha todos os campos.');
        gerarRelatorioBtn.disabled = false;
        return;
    }

    // Permite gerar relatório de todos os eventos se nenhum for selecionado
    if (!evento) {
        const escolha = await Swal.fire({
            title: 'Nenhum evento selecionado',
            text: "Você deseja escolher um evento ou gerar o relatório de TODOS os eventos do período?",
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Gerar de todos',
            cancelButtonText: 'Escolher evento'
        });

        if (escolha.isConfirmed) {
            evento = "todos"; // Gera relatório para todos os eventos
        } else {
            gerarRelatorioBtn.disabled = false;
            return; // Apenas fecha o Swal e não gera nada
        }
    }

    try {
        const url = `/relatorios?tipo=${tipo}&dataInicio=${dataInicio}&dataFim=${dataFim}&evento=${evento}`;
        const dados = await fetchComToken(url);
        console.log('Dados recebidos do backend:', dados);

        let relatorioHtmlCompleto = '';

        const dadosAgrupadosPorEvento = {};

        // 1. Agrupar dados de Fechamento de Cachê
        if (dados.fechamentoCache && dados.fechamentoCache.length > 0) {
            dados.fechamentoCache.forEach(item => {
                const eventoId = item.idevento;
                if (!dadosAgrupadosPorEvento[eventoId]) {
                    dadosAgrupadosPorEvento[eventoId] = {
                        nomeEvento: item.nomeEvento,
                        fechamentoCache: [],
                        utilizacaoDiarias: [],
                        contingencia: []
                    };
                }
                dadosAgrupadosPorEvento[eventoId].fechamentoCache.push(item);
            });
        }

        // 2. Agrupar dados de Utilização de Diárias
        if (dados.utilizacaoDiarias && dados.utilizacaoDiarias.length > 0) {
            dados.utilizacaoDiarias.forEach(item => {
                const eventoId = item.idevento;
                if (dadosAgrupadosPorEvento[eventoId]) {
                    dadosAgrupadosPorEvento[eventoId].utilizacaoDiarias.push(item);
                }
            });
        }

        // 3. Agrupar dados de Contingência
        if (dados.contingencia && dados.contingencia.length > 0) {
            dados.contingencia.forEach(item => {
                const eventoId = item.idevento;
                if (dadosAgrupadosPorEvento[eventoId]) {
                    dadosAgrupadosPorEvento[eventoId].contingencia.push(item);
                } else {
                    // Se um evento tiver apenas contingência e não fechamentoCache, ele não será criado.
                    // Considere criar o evento aqui também se for um cenário válido.
                    console.warn(`Evento ${eventoId} de Contingência não encontrado em Fechamento de Cachê.`);
                }
            });
        }

        // Agora, iteramos sobre os eventos agrupados e geramos o HTML para cada um
        const eventosOrdenados = Object.values(dadosAgrupadosPorEvento).sort((a, b) => {
            return a.nomeEvento.localeCompare(b.nomeEvento);
        });

        eventosOrdenados.forEach(evento => {
            // AQUI PEGAMOS OS TOTAIS DO EVENTO ESPECÍFICO
            const eventoIdParaTotal = evento.fechamentoCache.length > 0 ? evento.fechamentoCache[0].idevento : null;
            const totaisDoEventoAtual = eventoIdParaTotal && dados.fechamentoCacheTotaisPorEvento ?
                (dados.fechamentoCacheTotaisPorEvento[eventoIdParaTotal] || { totalVlrDiarias: 0, totalVlrAdicional: 0, totalTotalDiarias: 0 }) :
                { totalVlrDiarias: 0, totalVlrAdicional: 0, totalTotalDiarias: 0 };

            relatorioHtmlCompleto += montarRelatorioHtmlEvento(
                evento.fechamentoCache,
                evento.nomeEvento,
                nomeRelatorio,
                evento.utilizacaoDiarias,
                evento.contingencia,
                totaisDoEventoAtual
            );
        });

        // Chamamos a função de impressão passando o HTML gerado
        imprimirRelatorio(relatorioHtmlCompleto);

    } catch (error) {
        console.error('Falha ao gerar o relatório:', error.message || error);
        alert('Ocorreu um erro ao carregar o relatório.');
    } finally {
        // Habilita o botão novamente após a conclusão
        gerarRelatorioBtn.disabled = false;
    }
}

function imprimirRelatorio(conteudoRelatorio) {
    if (!conteudoRelatorio) {
        alert('Nenhum dado para imprimir.');
        return;
    }

    const printIframe = document.getElementById('printIframe');
    const iframeDoc = printIframe.contentDocument || printIframe.contentWindow.document;

    // Limpa o iframe antes de adicionar o conteúdo
    iframeDoc.body.innerHTML = '';

    const styleElement = iframeDoc.createElement('style');
    // Cole todos os seus estilos de impressão aqui dentro
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
        .text-left {
            text-align: left !important;
        }
        .text-center {
            text-align: center !important;
        }
        .text-right {
            text-align: right !important;
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
        .header-group-row {
            font-weight: bold;
            text-transform: uppercase;
            height: auto;
        }

        // .header-group {   
        //     background-color: orange; /* Fundo cinza */
        //     text-align: center;
        //     border-bottom: 2px solid #777; /* Adiciona uma borda na parte de baixo */    
   
        //     vertical-align: middle; /* Centraliza verticalmente o texto */
        //     display: table-cell; /* Garante que ele se comporte como célula de tabela */
        //     height: auto; /* Permite que a altura se ajuste automaticamente */
        //     padding-top: 5px; /* Ajuste o padding conforme necessário */
        //     padding-bottom: 5px; /* Ajuste o padding conforme necessário */

        // }

        .header-group {
            background-color: #a8a8a8ff; /* Fundo cinza */
            color: black; /* Cor do texto */
            text-align: center;
            vertical-align: middle; /* Centraliza verticalmente o texto */
            border-bottom: 2px solid #777;
            padding: 8px 12px; /* Adicionado padding para espaço interno */
            
            /* ******** PROPRIEDADES CRUCIAIS AQUI ******** */
            white-space: normal; /* Permite que o texto quebre para a próxima linha */
            word-wrap: break-word; /* Força a quebra de palavras longas */
            box-sizing: border-box; /* Garante que padding e border sejam incluídos na largura/altura */
            height: auto; /* Permite que a altura da célula se ajuste ao conteúdo */
            line-height: 1.2; /* Pode ajudar a controlar o espaçamento entre linhas */
        }

        .report-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9px;
        }
        .report-table th, .report-table td {
            border: 1px solid #000;
            padding: 4px 6px;
            white-space: normal;
            word-wrap: break-word;
            overflow: hidden;
        }
        .report-table th {
            white-space: normal; /* MUITO IMPORTANTE: Garante que o texto quebre */
            word-wrap: break-word; /* Força quebra de palavras longas */
            height: auto; /* Garante que a altura da célula se adapte ao conteúdo */
            vertical-align: middle; /* Centraliza verticalmente o texto */
        }
        .report-table thead {
            background-color: #a8a8a8ff;
            color: black;
        }

        .report-table thead, 
        .report-table thead tr {
            height: auto;
        }


        .relatorio-resumo-container {
            display: flex;
            gap: 20px;
            margin-top: 20px;
        }

        /* --- REGRAS PARA A SEÇÃO DE RESUMO DE DIÁRIAS --- */

        .tabela-resumo.diarias {
            /* O contêiner principal para a seção, incluindo bordas e padding */
            width: 50%;
            border: 1px solid #777;
            border-radius: 5px;
            background-color: white; /* O fundo do contêiner é branco */
            padding: 0; /* O espaçamento interno será controlado pelo H2 e pela tabela */
        }
        .tabela-resumo .report-table {
            font-size: 8px;
            background-color: white; /* O fundo da tabela é branco */
            height: auto;
        }
        .utilizacao-diarias-header {
            background-color: #a8a8a8ff; /* Fundo cinza para o título */
            color: black;
            padding: 8px 12px;
            margin: 0; /* Remove a margem para encostar na borda */
            font-size: 16px;
            text-align: center;
            border-top-left-radius: 5px; /* Bordas arredondadas no topo */
            border-top-right-radius: 5px;
        }

        /* O estilo do cabeçalho da tabela de diárias, que permanece laranja */
        .utilizacao-diarias-header + .report-table thead {
            background-color: orange;
        }

        /* Estilos para a seção de Contingência */
        .tabela-resumo.contingencia {
            /* Mesmo estilo do contêiner de diárias */
            width: 50%;
            border: 1px solid #777;
            border-radius: 5px;
            background-color: white; 
            padding: 0; 
        }

        .contingencia-header {
            background-color: #a8a8a8ff; /* Fundo cinza para o título */
            color: black;
            padding: 8px 12px;
            margin: 0;
            font-size: 16px;
            text-align: center; 
            border-top-left-radius: 5px;
            border-top-right-radius: 5px;
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
    
    // Pequeno atraso para garantir que o iframe renderizou o conteúdo
    setTimeout(() => {
        printIframe.contentWindow.focus();
        printIframe.contentWindow.print();
        // Limpa o iframe após a impressão, para o caso de um novo relatório
        setTimeout(() => {
            iframeDoc.body.innerHTML = '';
        }, 100);
    }, 500);
}
function desinicializarRelatoriosModal() {
    console.log("🧹 Desinicializando módulo Relatórios...");

    const gerarRelatorioBtn = document.getElementById('gerarRelatorioBtn');
    const printButton = document.getElementById('printButton');
    const closeButton = document.querySelector('#Relatorios .close');

    if (gerarRelatorioBtn && window.gerarRelatorioClickListener) {
        gerarRelatorioBtn.removeEventListener('click', window.gerarRelatorioClickListener);
        window.gerarRelatorioClickListener = null;
    }

    if (printButton && window.printButtonClickListener) {
        printButton.removeEventListener('click', window.printButtonClickListener);
        window.printButtonClickListener = null;
    }

    if (closeButton && window.closeButtonClickListener) {
        closeButton.removeEventListener('click', window.closeButtonClickListener);
        window.closeButtonClickListener = null;
    }

    console.log("✅ Relatórios desinicializado.");
}

initRelatorios();

window.moduloHandlers = window.moduloHandlers || {};
window.moduloHandlers['Relatorios'] = { // A chave 'Relatorios' deve corresponder ao que o Index.js usa
    configurar: initRelatorios,          // ou configurarEventosRelatorios, se esse for o nome
    desinicializar: desinicializarRelatoriosModal
};
