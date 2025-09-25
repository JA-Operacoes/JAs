import { fetchComToken } from '../utils/utils.js';

let todosOsDadosDoPeriodo = null;
let eventoSelecionadoId = null;

let nomeEquipe = null; 
let equipeId = null; // Variável global para armazenar o ID da equipe selecionada


// Função para iniciar o módulo de relatórios
function initRelatorios() {
    const reportStartDateInput = document.getElementById('reportStartDate');
    const reportEndDateInput = document.getElementById('reportEndDate');
    const reportTypeSelect = document.getElementById('reportType');
    const gerarRelatorioBtn = document.getElementById('gerarRelatorioBtn');
    //const printButton = document.getElementById('printButton');
    const closeButton = document.querySelector('#Relatorios .close');
   

    const today = new Date().toISOString().split('T')[0];
    reportStartDateInput.value = today;
    reportEndDateInput.value = today;

    // 👉 Guardar referências dos listeners
    window.gerarRelatorioClickListener = function () {
        gerarRelatorio();
    };    
    
    // window.printButtonClickListener = function () {
    //     imprimirRelatorio();
    // };

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



// function preencherEventosPeriodo() {
//     const startDate = document.getElementById('reportStartDate').value;
//     const endDate = document.getElementById('reportEndDate').value;
//     const eventSelect = document.getElementById('eventSelect');
//     if (!startDate || !endDate) return;

//     // Chame sua API que retorna eventos do período
//     fetchComToken(`/relatorios/eventos?inicio=${startDate}&fim=${endDate}`)
//     .then(eventos => {
//         eventSelect.innerHTML = '<option value="">Selecione um Evento</option>';
//         eventos.forEach(ev => {
//             const opt = document.createElement('option');
//             opt.value = ev.idevento;
//             opt.textContent = ev.nmevento;
//             eventSelect.appendChild(opt);
//         });
//     })
//     .catch(() => {
//         eventSelect.innerHTML = '<option value="">Nenhum evento encontrado</option>';
//     });
// }


async function preencherEventosPeriodo() {
    const startDate = document.getElementById('reportStartDate').value;
    const endDate = document.getElementById('reportEndDate').value;
    const eventSelect = document.getElementById('eventSelect');
    const clientSelect = document.getElementById('clientSelect'); // Supondo que você tenha um select de clientes

    if (!startDate || !endDate) {
        eventSelect.innerHTML = '<option value="">Selecione um Evento</option>';
        clientSelect.innerHTML = '<option value="">Selecione um Cliente</option>';
        return;
    }

    try {
        // Altere a rota da sua API para retornar todos os eventos e seus clientes
        // para o período selecionado.
        const url = `/relatorios/eventos?inicio=${startDate}&fim=${endDate}`;
        const dados = await fetchComToken(url);       

        const dadosAgrupados = {};

        dados.forEach(item => {
            if (!dadosAgrupados[item.idevento]) {
                dadosAgrupados[item.idevento] = {
                    idevento: item.idevento,
                    nmevento: item.nmevento,               
                    clientes: []
                };
            }
            dadosAgrupados[item.idevento].clientes.push({
                idcliente: item.idcliente,
                nomeCliente: item.cliente
            });
        });

        // Converte o objeto de volta para um array para facilitar a iteração
        todosOsDadosDoPeriodo = Object.values(dadosAgrupados);
        
        // Armazena os dados em uma variável global
      //  todosOsDadosDoPeriodo = dados;
        console.log('Dados AGRUPADOS para o período:', todosOsDadosDoPeriodo);
        // 1. Preencher o select de Eventos
        eventSelect.innerHTML = '<option value="">Todos os Eventos</option>';
        dados.forEach(evento => {
            const opt = document.createElement('option');
            opt.value = evento.idevento;
            opt.textContent = evento.nmevento;
            eventSelect.appendChild(opt);
        });

        // 2. Preencher o select de Clientes com todos os clientes
        preencherClientesEvento();


        preencherEquipesEvento();

    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        eventSelect.innerHTML = '<option value="">Nenhum evento encontrado</option>';
        clientSelect.innerHTML = '<option value="">Nenhum cliente encontrado</option>';
    }
}

function preencherClientesEvento() {
    const eventSelect = document.getElementById('eventSelect');
    const clientSelect = document.getElementById('clientSelect');
    const eventoId = eventSelect.value;

     console.log('Dados carregados para o período no PREENCHER CLIENTES:', todosOsDadosDoPeriodo);
    
    // Reseta o select de clientes
    clientSelect.innerHTML = '<option value="">Todos os Clientes</option>';

    if (!todosOsDadosDoPeriodo) {
        return; // Não há dados para preencher
    }

    // Se um evento específico foi selecionado
    if (eventoId) {
        console.log('Evento selecionado:', eventoId);
        const eventoIdNum = parseInt(eventoId, 10);
       // const eventoSelecionado = todosOsDadosDoPeriodo.find(ev => ev.idevento === eventoId);
       const eventoSelecionado = todosOsDadosDoPeriodo.find(ev => ev.idevento === eventoIdNum);
        if (eventoSelecionado && eventoSelecionado.clientes) {
            eventoSelecionado.clientes.forEach(cliente => {
                const opt = document.createElement('option');
                opt.value = cliente.idcliente;
                opt.textContent = cliente.nomeCliente;
                clientSelect.appendChild(opt);
            });
        }
    } else {
        // Se nenhum evento foi selecionado, carrega todos os clientes de todos os eventos
        const clientesUnicos = new Set();
        todosOsDadosDoPeriodo.forEach(evento => {
            if (evento.clientes) {
                evento.clientes.forEach(cliente => {
                    clientesUnicos.add(JSON.stringify({ id: cliente.idcliente, nome: cliente.nomeCliente }));
                });
            }
        });
        
        const clientesArray = Array.from(clientesUnicos).map(c => JSON.parse(c)).sort((a, b) => a.nome.localeCompare(b.nome));
        clientesArray.forEach(cliente => {
            const opt = document.createElement('option');
            opt.value = cliente.id;
            opt.textContent = cliente.nome;
            clientSelect.appendChild(opt);
        });
    }
}

async function preencherEquipesEvento() {
    
    const equipeSelect = document.getElementById('equipeSelect');
    equipeSelect.innerHTML = '<option value="">Todas as Equipes</option>';
    // Reseta o select de equipes

    try {
        // Altere a rota da sua API para retornar todos os eventos e seus clientes
        // para o período selecionado.
        const url = `/relatorios/equipe`;
        const equipes = await fetchComToken(url);       

        equipes.forEach(equipe => {
            const opt = document.createElement('option');
            opt.value = equipe.idequipe;
            opt.textContent = equipe.nmequipe;
            equipeSelect.appendChild(opt);
        });

    } catch (error) {
        console.error('Erro ao carregar dados:', error);        
        equipeSelect.innerHTML = '<option value="">Nenhuma equipe encontrada</option>';
    }
    
}


// Adicione listeners para atualizar o select quando as datas mudarem
document.getElementById('reportStartDate').addEventListener('change', preencherEventosPeriodo);
document.getElementById('reportEndDate').addEventListener('change', preencherEventosPeriodo);

document.getElementById('eventSelect').addEventListener('change', preencherClientesEvento);
//document.getElementById('equipeSelect').addEventListener('change', preencherEquipesEvento);



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
                            }else if (['VLR ADICIONAL', 'VLR DIÁRIA', 'TOT DIÁRIAS'].includes(col) && typeof item[col] === 'number') {
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
function montarRelatorioHtmlEvento(dadosFechamento, nomeEvento, nomeRelatorio, nomeCliente, dadosUtilizacao, dadosContingencia, totaisFechamentoCache) { // <<-- MODIFICAÇÃO: Adicionado totaisFechamentoCache
    // Função auxiliar para formatar moeda (adicione ela aqui ou mantenha global se já tiver)
    const formatarMoeda = (valor) => {
        return (valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const obterClasseStatus = (status) => {
        switch (status) {
            case 'Pago':
                return 'status-pago-100';
            case 'Pago 100%':
                return 'status-pago-100';
            case 'Pago 50%':
                return 'status-pago-50';
            default: // Para "Pendente" ou qualquer outro status
                return 'status-pendente';
        }
    };

    console.log("StatusClass", obterClasseStatus("Pago 100%")); // Teste rápido

 
    const equipeSelectElement = document.getElementById('equipeSelect');   
    const equipeId = equipeSelectElement.value; // 'todos' ou o ID numérico

    let nomeEquipe = ''; // Inicializa a variável para ser usada mais tarde
    
    const selectedIndex = equipeSelectElement.selectedIndex;

    if (selectedIndex >= 0) {
        nomeEquipe = ` - Equipe: ${equipeSelectElement.options[selectedIndex].text}`;
    } else {
        nomeEquipe = '';
    }

    let html = `
        <div class="relatorio-evento">
            <div class="print-header-top">
                <img src="http://localhost:3000/img/JA_Oper.png" alt="Logo JA" class="logo-ja">
                <div class="header-title-container">
                    <h1 class="header-title">${nomeEvento}</h1>
                </div>  
            </div>
            <h2>FECHAMENTO ${nomeRelatorio.toUpperCase()} - Cliente: ${nomeCliente} ${nomeEquipe}</h2>
    `;
    const dataInicioSelecionada = document.getElementById('reportStartDate').value;
    const dataFimSelecionada = document.getElementById('reportEndDate').value;

    if (dadosFechamento && dadosFechamento.length > 0) {
       // const dataInicio = formatarData(dadosFechamento[0].INÍCIO);
      //  const dataTermino = formatarData(dadosFechamento[0].TÉRMINO);        
        const dataInicio = formatarData(dataInicioSelecionada);
        const dataTermino = formatarData(dataFimSelecionada);
    
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
            'TOT DIÁRIAS': 'text-right',
            'STATUS PGTO': 'text-center',
            'TOT PAGAR': 'text-right' 
        };

        const colunasFechamento = ['FUNÇÃO', 'NOME', 'PIX', 'INÍCIO', 'TÉRMINO', 'VLR DIÁRIA', 'VLR ADICIONAL',  'QTD', 'TOT DIÁRIAS', 'STATUS PGTO', 'TOT PAGAR'];

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
                    ${dadosFechamento.map(item => {
                        const statusClass = obterClasseStatus(item["STATUS PGTO"]);
                        console.log('Status:', item["STATUS PGTO"], 'Classe gerada:', statusClass); // <-- Adicione esta linha de log

                        return `
                        <tr>
                            <td class="${alinhamentosFechamento['FUNÇÃO'] || ''}">${item.FUNÇÃO || ''}</td>
                            <td class="${alinhamentosFechamento['NOME'] || ''}">${item.NOME || ''}</td>
                            <td class="${alinhamentosFechamento['PIX'] || ''}">${item.PIX || ''}</td>
                            <td class="${alinhamentosFechamento['INÍCIO'] || ''}">${formatarData(item.INÍCIO) || ''}</td>
                            <td class="${alinhamentosFechamento['TÉRMINO'] || ''}">${formatarData(item.TÉRMINO) || ''}</td>
                            <td class="${alinhamentosFechamento['VLR DIÁRIA'] || ''}">${formatarMoeda(item["VLR DIÁRIA"])}</td>
                            <td class="${alinhamentosFechamento['VLR ADICIONAL'] || ''}">${formatarMoeda(item["VLR ADICIONAL"])}</td>                            
                            <td class="${alinhamentosFechamento['QTD'] || ''}">${item.QTD || ''}</td>
                            <td class="${alinhamentosFechamento['TOT DIÁRIAS'] || ''}">${formatarMoeda(item["TOT DIÁRIAS"])}</td>
                            <td class="${alinhamentosFechamento['STATUS PGTO'] || ''} ${statusClass}">${item["STATUS PGTO"] || ''}</td>
                            <td class="${alinhamentosFechamento['TOT PAGAR'] || ''}">${formatarMoeda(item["TOT PAGAR"])}</td>
                        </tr>
                    `}).join('')}
                    <tr>
                        <td colspan="5" style="text-align: right; font-weight: bold;">TOTAL GERAL DO EVENTO:</td>
                        <td class="${alinhamentosFechamento['VLR DIÁRIA'] || ''}" style="font-weight: bold;">${formatarMoeda(totaisFechamentoCache.totalVlrDiarias)}</td>
                        <td class="${alinhamentosFechamento['VLR ADICIONAL'] || ''}" style="font-weight: bold;">${formatarMoeda(totaisFechamentoCache.totalVlrAdicional)}</td> 
                        <td></td> <td class="${alinhamentosFechamento['TOT DIÁRIAS'] || ''}" style="font-weight: bold;">${formatarMoeda(totaisFechamentoCache.totalTotalDiarias)}</td>
                        <td></td>                       
                        <td class="${alinhamentosFechamento['TOT PAGAR'] || ''}" style="font-weight: bold;">${formatarMoeda(totaisFechamentoCache.totalTotalPagar)}</td>
                    </tr>
                </tbody>
            </table>
        `;
        html += tabelaFechamentoHtml; // <<-- Adiciona a tabela com o total
    } else {
        html += '<p>Nenhum dado de fechamento de cachê encontrado.</p>';
    }

    // Container para as tabelas de resumo lado a lado
    html += `<div class="relatorio-resumo-container">`;

    const alinhamentosUtilizacao = {
        'INFORMAÇÕES EM PROPOSTA': 'text-left',
        'QTD PROFISSIONAIS': 'text-center',
        'DIÁRIAS CONTRATADAS': 'text-center',
        'DIÁRIAS UTILIZADAS': 'text-center',
        'SALDO': 'text-right',
    };
    // 
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
                        ${montarTabelaBody(dadosUtilizacao, alinhamentosUtilizacao)}
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

// function montarTabelaBody(dados) {
//     if (!dados || dados.length === 0) {
//         return '<tr><td colspan="5">Nenhum dado disponível.</td></tr>';
//     }

//     let html = '';
//     dados.forEach(item => {
//         html += `
//             <tr>
//                 <td>${item['INFORMAÇÕES EM PROPOSTA'] || ''}</td>
//                 <td>${item['QTD PROFISSIONAIS'] || ''}</td>
//                 <td>${item['DIÁRIAS CONTRATADAS'] || ''}</td>
//                 <td>${item['DIÁRIAS UTILIZADAS'] || ''}</td>
//                 <td>${item.SALDO || ''}</td>
//             </tr>
//         `;
//     });
//     return html;
// }

function montarTabelaBody(dados, alinhamentosPorColuna = {}) {
    if (!dados || dados.length === 0) {
        return '<tr><td colspan="5">Nenhum dado disponível.</td></tr>';
    }

    const colunas = Object.keys(alinhamentosPorColuna);

    let html = '';
    dados.forEach(item => {
        html += `<tr>`;
        colunas.forEach(col => {
            const alignClass = alinhamentosPorColuna[col] || '';
            let valorCelula = item[col];
            
            // Lógica de formatação, se necessário
            if (['SALDO', 'DIÁRIAS CONTRATADAS', 'DIÁRIAS UTILIZADAS'].includes(col) && typeof valorCelula === 'number') {
                // Exemplo de formatação:
                // valorCelula = valorCelula.toLocaleString('pt-BR');
            }

            html += `<td class="${alignClass}">${valorCelula || ''}</td>`;
        });
        html += `</tr>`;
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

    // Obtém os dados dos campos
    //const tipo = document.getElementById('reportType').value;
    const tipo = document.querySelector('input[name="reportType"]:checked').value;
    const dataInicio = document.getElementById('reportStartDate').value;
    const dataFim = document.getElementById('reportEndDate').value;
    let evento = document.getElementById('eventSelect').value;
    //const nomeRelatorio = document.getElementById('reportType').options[document.getElementById('reportType').selectedIndex].text;
    const nomeRelatorio = document.querySelector('input[name="reportType"]:checked').nextElementSibling.textContent;

    const eventoId = document.getElementById('eventSelect').value;
    const clienteId = document.getElementById('clientSelect').value;

    const equipeSelectElement = document.getElementById('equipeSelect');
    const equipeId = equipeSelectElement ? equipeSelectElement.value : 'todos'; // ID ou 'todos'
    let nomeEquipe = '';

    // Obtém o nome da equipe se o elemento existir e houver uma seleção
    if (equipeSelectElement && equipeSelectElement.selectedIndex >= 0) {
        nomeEquipe = equipeSelectElement.options[equipeSelectElement.selectedIndex].text;
    }
    // Opcional: Se a opção for 'Todos' mas o texto estiver vazio
    if (equipeId === 'todos' && !nomeEquipe) {
        nomeEquipe = 'Todas';
    }
   

    if (!tipo || !dataInicio || !dataFim ) {
        Swal.fire({
            icon: 'warning',
            title: 'Campos obrigatórios',
            text: 'Por favor, preencha todos os campos.',
        });
        gerarRelatorioBtn.disabled = false;
        return;
    }

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
      //  const url = `/relatorios?tipo=${tipo}&dataInicio=${dataInicio}&dataFim=${dataFim}&evento=${evento}`;
        const url = `/relatorios?tipo=${tipo}&dataInicio=${dataInicio}&dataFim=${dataFim}&evento=${evento}&cliente=${clienteId}&equipe=${equipeId}`;
        const dados = await fetchComToken(url);
        console.log('Dados recebidos do backend:', dados);

        const temFechamento = dados.fechamentoCache && dados.fechamentoCache.length > 0;
        const temDiarias = dados.utilizacaoDiarias && dados.utilizacaoDiarias.length > 0;
        const temContingencia = dados.contingencia && dados.contingencia.length > 0;

        if (!temFechamento && !temDiarias && !temContingencia) {
            Swal.fire({
                icon: 'info',
                title: 'Nenhum Resultado Encontrado',
                text: 'Não foram encontrados dados para os filtros e período selecionados.',
            });
            // IMPORTANTE: O bloco 'finally' lida com o re-habilitação do botão, então basta o 'return'
            return; 
        }

        // Agrupar dados por evento
        const dadosAgrupadosPorEvento = {};

        // 1. Agrupar dados de Fechamento de Cachê
        if (dados.fechamentoCache && dados.fechamentoCache.length > 0) {
            dados.fechamentoCache.forEach(item => {
                const eventoId = item.idevento;
                if (!dadosAgrupadosPorEvento[eventoId]) {
                    dadosAgrupadosPorEvento[eventoId] = {
                        nomeEvento: item.nomeEvento,
                        nomeCliente: item.nomeCliente,
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
                    // Adiciona o evento de contingência mesmo que não haja fechamento de cachê
                    dadosAgrupadosPorEvento[eventoId] = {
                        nomeEvento: 'Evento não encontrado', // Ou outro nome padrão
                        fechamentoCache: [],
                        utilizacaoDiarias: [],
                        contingencia: [item]
                    };
                    console.warn(`Evento ${eventoId} de Contingência não encontrado em Fechamento de Cachê. Criando novo grupo.`);
                }
            });
        }

        // Abrir a caixa de diálogo para escolher o formato
        Swal.fire({
            title: 'Gerar Relatório',
            text: 'Em qual formato você deseja gerar o relatório?',
            icon: 'question',
            showDenyButton: true,
            confirmButtonText: 'PDF (Visualizar/Imprimir)',
            denyButtonText: 'XLS (Excel)',
            confirmButtonColor: '#3085d6',
            denyButtonColor: '#28a745',
        }).then((result) => {
            if (result.isConfirmed) {
                // Opção 1: Gerar HTML para impressão
                let relatorioHtmlCompleto = '';

                const eventosOrdenados = Object.values(dadosAgrupadosPorEvento).sort((a, b) => {
                    return a.nomeEvento.localeCompare(b.nomeEvento);
                });

                eventosOrdenados.forEach(evento => {
                    const eventoIdParaTotal = evento.fechamentoCache.length > 0 ? evento.fechamentoCache[0].idevento : null;
                    const totaisDoEventoAtual = eventoIdParaTotal && dados.fechamentoCacheTotaisPorEvento ?
                        (dados.fechamentoCacheTotaisPorEvento[eventoIdParaTotal] || { totalVlrDiarias: 0, totalVlrAdicional: 0, totalTotalDiarias: 0, totalTotalPagar: 0 }) :
                        { totalVlrDiarias: 0, totalVlrAdicional: 0, totalTotalDiarias: 0, totalTotalPagar: 0 };
                    console.log('Totais do evento atual:', totaisDoEventoAtual); // Log para verificar os totais
                    relatorioHtmlCompleto += montarRelatorioHtmlEvento(
                        evento.fechamentoCache,
                        evento.nomeEvento,
                        nomeRelatorio,
                        evento.nomeCliente,                        
                        evento.utilizacaoDiarias,
                        evento.contingencia,
                        totaisDoEventoAtual
                    );
                });

                imprimirRelatorio(relatorioHtmlCompleto);

            } else if (result.isDenied) {
                // Opção 2: Gerar XLS
               // const nomeDoArquivoGerado = exportarParaXls(dados, nomeRelatorio); // Certifique-se de que exportarParaXls() aceita os dados
                  const nomesDosArquivosGerados = exportarParaXls(dadosAgrupadosPorEvento, nomeRelatorio);
                  
                // Swal.fire({
                //     icon: 'success',
                //     title: 'Relatório XLS Gerado!',
                //     html: `O arquivo <strong>"${nomeDoArquivoGerado}"</strong> foi gerado com sucesso e está na sua pasta de <strong>DOWNLOADS</strong>.`,
                //     confirmButtonText: 'Entendido'
                // });

                Swal.fire({
                    icon: 'success',
                    title: 'Relatórios XLS Gerados!',
                    html: `Os arquivos foram gerados com sucesso e estão na sua pasta de <strong>DOWNLOADS</strong>.<br><br>
                           Arquivos gerados: <ul><li>${nomesDosArquivosGerados.join('</li><li>')}</li></ul>`,
                    confirmButtonText: 'Entendido'
                });
            }
        });

    } catch (error) {
        console.error('Falha ao gerar o relatório:', error.message || error);
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: 'Ocorreu um erro ao carregar o relatório.',
        });
    } finally {
        // Habilita o botão novamente após a conclusão
        gerarRelatorioBtn.disabled = false;
    }
}

// Nova função para exportar os dados para um arquivo Excel
// function exportarParaXls(dadosDoRelatorio, nomeRelatorio) {
//     // if (!ultimoRelatorioGerado) {
//     //     // Esta parte já está funcionando
//     //     alert('Por favor, gere um relatório primeiro.');
//     //     return;
//     // }

//     const { fechamentoCache, utilizacaoDiarias, contingencia } = dadosDoRelatorio;
//     const nomeEvento = fechamentoCache[0]?.nomeEvento || 'Relatorio';
    
//     // Constrói o nome final do arquivo
//    // const nomeArquivo = `${nomeEvento}_Fechamento.xlsx`;
//    const nomeArquivo = `${nomeRelatorio}_${dadosDoRelatorio.fechamentoCache[0]?.nomeEvento || 'Relatorio'}.xlsx`;

//     // Cria o workbook e as abas... (seu código aqui)
//     const wb = XLSX.utils.book_new();

//     if (fechamentoCache && fechamentoCache.length > 0) {
//         const wsFechamento = XLSX.utils.json_to_sheet(fechamentoCache);
//         XLSX.utils.book_append_sheet(wb, wsFechamento, 'Fechamento de Cachê');
//     }

//     if (utilizacaoDiarias && utilizacaoDiarias.length > 0) {
//         const wsUtilizacao = XLSX.utils.json_to_sheet(utilizacaoDiarias);
//         XLSX.utils.book_append_sheet(wb, wsUtilizacao, 'Utilização de Diárias');
//     }

//     if (contingencia && contingencia.length > 0) {
//         const wsContingencia = XLSX.utils.json_to_sheet(contingencia);
//         XLSX.utils.book_append_sheet(wb, wsContingencia, 'Contingência');
//     }
    
//     // Escreve o arquivo e força o download
//     XLSX.writeFile(wb, nomeArquivo);

//     // Retorna o nome do arquivo para ser usado no SweetAlert
//     return nomeArquivo;
// }

function exportarParaXls(dadosAgrupadosPorEvento, nomeRelatorio) {
    const nomesDosArquivos = [];

    // Itera sobre cada evento agrupado
    for (const eventoId in dadosAgrupadosPorEvento) {
        if (dadosAgrupadosPorEvento.hasOwnProperty(eventoId)) {
            const evento = dadosAgrupadosPorEvento[eventoId];
            const nomeEvento = evento.nomeEvento || 'Relatorio';
            const nomeArquivo = `${nomeRelatorio}_${nomeEvento}.xlsx`;
            
            const wb = XLSX.utils.book_new();

            if (evento.fechamentoCache && evento.fechamentoCache.length > 0) {
                const wsFechamento = XLSX.utils.json_to_sheet(evento.fechamentoCache);
                XLSX.utils.book_append_sheet(wb, wsFechamento, 'Fechamento de Cache');
            }

            if (evento.utilizacaoDiarias && evento.utilizacaoDiarias.length > 0) {
                const wsUtilizacao = XLSX.utils.json_to_sheet(evento.utilizacaoDiarias);
                XLSX.utils.book_append_sheet(wb, wsUtilizacao, 'Utilização de Diárias');
            }

            if (evento.contingencia && evento.contingencia.length > 0) {
                const wsContingencia = XLSX.utils.json_to_sheet(evento.contingencia);
                XLSX.utils.book_append_sheet(wb, wsContingencia, 'Contingência');
            }
            
            // Escreve o arquivo e força o download
            XLSX.writeFile(wb, nomeArquivo);
            nomesDosArquivos.push(nomeArquivo);
        }
    }

    // Retorna a lista de nomes dos arquivos gerados para a mensagem de sucesso
    return nomesDosArquivos;
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
        
        .status-pago-100 {
            color: green;
            font-weight: bold;
        }

        .status-pago-50 {
        color: orange;
        font-weight: bold;
        }

        .status-pendente {
        color: red;
        font-weight: bold;
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
