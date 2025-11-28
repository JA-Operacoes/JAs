import { fetchComToken, aplicarTema } from '../utils/utils.js';

let empresaLogoPath = 'http://localhost:3000/img/JA_Oper.png';

function inicializarDadosEmpresa() {
    const idempresa = localStorage.getItem("idempresa");

    console.log("ID da empresa obtido do localStorage:", idempresa);

    if (idempresa) {
        const apiUrl = `/empresas/${idempresa}`;

        fetchComToken(apiUrl)
            .then(empresa => {
                const tema = empresa.nmfantasia;
                aplicarTema(tema);

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
if (document.readyState === "loading") {
    // O DOM ainda está carregando, então ouvimos o evento
    document.addEventListener("DOMContentLoaded", inicializarDadosEmpresa);
} else {
    // O DOM já está pronto (readyState é 'interactive' ou 'complete'), executa imediatamente
    console.log("DOM já carregado, executando inicializarDadosEmpresa imediatamente.");
    inicializarDadosEmpresa();
}


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

        console.log('Dados brutos para o período:', dados);

        dados.forEach(item => {
            if (!dadosAgrupados[item.idevento]) {
                dadosAgrupados[item.idevento] = {
                    idevento: item.idevento,
                    nmevento: item.nmevento,
                    nomenclatura: item.nomenclatura,
                    dtiniinframontagem: item.dtiniinframontagem,
                    dtfiminframontagem: item.dtfiminframontagem,
                    dtinimarcacao: item.dtinimarcacao,
                    dtfimmarcacao: item.dtfimmarcacao,
                    dtinirealizacao: item.dtinirealizacao,
                    dtfimrealizacao: item.dtfimrealizacao,
                    dtinidesmontagem: item.dtinidesmontagem,
                    dtfimdesmontagem: item.dtfimdesmontagem,
                    dtiniinfradesmontagem: item.dtiniinfradesmontagem,
                    dtfiminfradesmontagem: item.dtfiminfradesmontagem,
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
            //opt.textContent = evento.nmevento;
            const nomenclaturaDisplay = evento.nomenclatura ? ` (${evento.nomenclatura})` : '';
            opt.textContent = `${evento.nmevento}${nomenclaturaDisplay}`;
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


const normalizeDate = (dateString, isEndOfDay = false) => {
    if (!dateString) return null;
    
    // Extrai apenas a parte da data (AAAA-MM-DD)
    const datePart = dateString.substring(0, 10); 
  
    
    let dateToParse = datePart;

    if (isEndOfDay) {
        // Se for uma data de FIM de período (como dtfimmarcacao), 
        // definimos a hora para o final do dia para garantir que o dia todo seja incluído.
        dateToParse += 'T23:59:59';
    } else {
        // Para datas de INÍCIO, definimos para o início do dia.
        dateToParse += 'T00:00:00';
    }
    
    // Remove o 'Z' para que o JS interprete como data/hora local
    // Isso é mais seguro para datas de eventos que podem ter sido inseridas no horário de Brasília.
    return new Date(dateToParse);
};


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
                            }else if (['VLR ADICIONAL', 'VLR DIÁRIA', 'TOT DIÁRIAS', 'TOT GERAL'].includes(col) && typeof item[col] === 'number') {
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
function montarRelatorioHtmlEvento(dadosFechamento, nomeEvento, nomeRelatorio, nomeCliente, dadosUtilizacao, dadosContingencia, totaisFechamentoCache, filtroFaseDisplay) { // <<-- MODIFICAÇÃO: Adicionado totaisFechamentoCache
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
                <img src= "${empresaLogoPath}" alt="Logo Empresa" class="logo-ja">
                <div class="header-title-container">
                    <h1 class="header-title">${nomeEvento}</h1>
                </div>  
            </div>
            <h2>FECHAMENTO ${nomeRelatorio.toUpperCase()} - Cliente: ${nomeCliente} ${nomeEquipe} ${filtroFaseDisplay}</h2>
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
            'TOT GERAL': 'text-right',
            'STATUS PGTO': 'text-center',
            'TOT PAGAR': 'text-right' 
        };

        const colunasFechamento = ['FUNÇÃO', 'NOME', 'PIX', 'INÍCIO', 'TÉRMINO', 'VLR DIÁRIA', 'VLR ADICIONAL',  'QTD', 'TOT DIÁRIAS', 'TOT GERAL', 'STATUS PGTO', 'TOT PAGAR'];

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
                            <td class="${alinhamentosFechamento['TOT GERAL'] || ''}">${formatarMoeda(item["TOT GERAL"])}</td>
                            <td class="${alinhamentosFechamento['STATUS PGTO'] || ''} ${statusClass}">${item["STATUS PGTO"] || ''}</td>
                            <td class="${alinhamentosFechamento['TOT PAGAR'] || ''}">${formatarMoeda(item["TOT PAGAR"])}</td>
                        </tr>
                    `}).join('')}
                    <tr>
                        <td colspan="5" style="text-align: right; font-weight: bold;">TOTAL GERAL DO EVENTO:</td>
                        <td class="${alinhamentosFechamento['VLR DIÁRIA'] || ''}" style="font-weight: bold;">${formatarMoeda(totaisFechamentoCache.totalVlrDiarias)}</td>
                        <td class="${alinhamentosFechamento['VLR ADICIONAL'] || ''}" style="font-weight: bold;">${formatarMoeda(totaisFechamentoCache.totalVlrAdicional)}</td> 
                        <td></td> <td class="${alinhamentosFechamento['TOT DIÁRIAS'] || ''}" style="font-weight: bold;">${formatarMoeda(totaisFechamentoCache.totalTotalDiarias)}</td>
                        <td class="${alinhamentosFechamento['TOT GERAL'] || ''}" style="font-weight: bold;">${formatarMoeda(totaisFechamentoCache.totalTotalGeral)}</td>
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
   

    const utilizacaoAgrupada = dadosUtilizacao.reduce((acc, item) => {
        const nro = item.nrorcamento || 'N/A';
        if (!acc[nro]) acc[nro] = [];
        acc[nro].push(item);
        return acc;
    }, {});  

    

    const todosOrcamentos = Object.keys(utilizacaoAgrupada).filter(nro => nro !== 'N/A');

    // Se houver orçamentos específicos para processar:
    if (todosOrcamentos.length > 0) {
        
        // Iterar sobre todos os orçamentos para montar os pares
        todosOrcamentos.forEach((nroOrcamento, index) => {
            const dadosUtilizacaoDoOrcamento = utilizacaoAgrupada[nroOrcamento] || [];
            
            // Se for o PRIMEIRO orçamento, ele pode ter a Contingência ao lado
            const deveIncluirContingencia = (index === 0 && (nomeRelatorio.toUpperCase() === 'CACHÊ' || nomeRelatorio.toUpperCase() === 'AJUDA DE CUSTO'));

            // INÍCIO DO WRAPPER: .resumo-par-orcamento (Lado a Lado)
            // O wrapper só precisa de duas colunas, então se só tiver Utilização, ele continua lado a lado
            // se a contingência estiver "vazia"
            html += `<div class="resumo-par-orcamento">`;

            // ------------------------------------------
            // A. Utilização de Diárias (Esquerda)
            // ------------------------------------------
            // ... (Seu código de Utilização de Diárias aqui, inalterado) ...

            html += `
                <div class="tabela-resumo diarias">
                    <table class="report-table">
                        <thead>
                            <tr>
                                <th colspan="5" class="table-title-header">UTILIZAÇÃO DE DIÁRIAS (Orçamento: ${nroOrcamento})</th>
                            </tr>
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
                            ${dadosUtilizacaoDoOrcamento.length > 0 ?
                                montarTabelaBody(dadosUtilizacaoDoOrcamento, alinhamentosUtilizacao)
                                : `<tr><td colspan="5">Sem diárias contratadas ou utilizadas neste orçamento.</td></tr>`}
                        </tbody>
                    </table>
                </div>
            `;


            // ------------------------------------------
            // B. Contingência (Direita) - APENAS NO PRIMEIRO ORÇAMENTO E SE FOR CACHÊ
            // ------------------------------------------
            if (deveIncluirContingencia) {
                html += `
                    <div class="tabela-resumo contingencia">
                        ${dadosContingencia && dadosContingencia.length > 0 ? `
                            <table class="report-table">
                                <thead>
                                    <tr>
                                        <th colspan="3" class="table-title-header">CONTINGÊNCIA</th>
                                    </tr>
                                    <tr>
                                        <th>Profissional</th>
                                        <th>Informacao</th>
                                        <th>Observacao</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${montarTabelaBody(dadosContingencia, {
                                        'Profissional': 'text-left',
                                        'Informacao': 'text-left',
                                        'Observacao': 'text-left'
                                    })}
                                </tbody>
                            </table>
                        ` : `<p>Nenhum dado de contingência para este evento.</p>`}
                    </div>
                `;
            } else if (index === 0 && (nomeRelatorio.toUpperCase() === 'CACHÊ' || nomeRelatorio.toUpperCase() === 'AJUDA DE CUSTO')) {
                // Garante que o espaço seja ocupado pela Utilização se não for relatório de Cachê
                html += `<div class="tabela-resumo contingencia" style="visibility: hidden;"></div>`;
            } else if (index > 0) {
                // Garante que os orçamentos posteriores à primeira não tenham a coluna de Contingência
                html += `<div class="tabela-resumo contingencia" style="display: none;"></div>`;
            }

            // FIM DO WRAPPER
            html += `</div>`; 
        });

    } else {
        // Caso não haja dados de utilização com orçamento definido
        html += `<p>Nenhum dado de resumo ou contingência para este evento e período.</p>`;
    }

    html += `</div>`; // Fechando o container Flexbox
    
    html += `</div>`; // Fechando o relatorio-evento
    return html;
}


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

const getPeriodoConsolidado = (evento, fasesSelecionadas, phaseKeyMap) => {
    let consolidatedStart = null;
    let consolidatedEnd = null;
    
    // Itera sobre as fases selecionadas (ex: ['montageminfra', 'marcacao'])
    fasesSelecionadas.forEach(fase => {
        const keys = phaseKeyMap[fase.toLowerCase()];
        
        if (keys) {
            // Usa as chaves da base de dados do evento
            const startStr = evento[keys.ini];
            const endStr = evento[keys.fim];

            // Normalize as datas (usando sua função normalizeDate, que deve estar corrigida!)
            const start = startStr ? new Date(startStr) : null;
            const end = endStr ? new Date(endStr) : null;
            
            if (start && start instanceof Date && !isNaN(start.getTime())) {
                if (!consolidatedStart || start < consolidatedStart) {
                    consolidatedStart = start;
                }
            }
            if (end && end instanceof Date && !isNaN(end.getTime())) {
                if (!consolidatedEnd || end > consolidatedEnd) {
                    consolidatedEnd = end;
                }
            }
        }
    });

    // Retorna as datas consolidadas no formato YYYY-MM-DD
    return {
        dtConsolidadaInicio: consolidatedStart ? consolidatedStart.toISOString().substring(0, 10) : null,
        dtConsolidadaFim: consolidatedEnd ? consolidatedEnd.toISOString().substring(0, 10) : null
    };
};

async function gerarRelatorio() {
    console.log('Iniciando a geração do relatório...');

    const checkPendentes = document.getElementById('checkPendentes');
    const checkPagos = document.getElementById('checkPagos');

    // Desabilita o botão para evitar cliques múltiplos
    const gerarRelatorioBtn = document.getElementById('gerarRelatorioBtn');
    gerarRelatorioBtn.disabled = true;

    // Obtém os dados dos campos
    //const tipo = document.getElementById('reportType').value;
    const tipo = document.querySelector('input[name="reportType"]:checked').value;
    const incluirPendentes = checkPendentes.checked; // Será true ou false
    const incluirPagos = checkPagos.checked;         // Será true ou false
    const dataInicio = document.getElementById('reportStartDate').value;
    const dataFim = document.getElementById('reportEndDate').value;
    // let evento = document.getElementById('eventSelect').value;
    
    //========NOVO TRECHO==========
    const eventSelectElement = document.getElementById('eventSelect');
    //let evento = eventSelectElement ? eventSelectElement.value : null;
    const eventoId = eventSelectElement ? eventSelectElement.value : 'todos';
    const eventoSelecionado = eventSelectElement ? eventSelectElement.value : 'todos';
    let evento = eventoSelecionado; 

    const fasesSelecionadas = Array.from(document.querySelectorAll('input[name="phaseFilter"]:checked'))
                                   .map(input => input.value);

    const fasesString = fasesSelecionadas.join(',');

    console.log("FASE SELECIONADA", fasesSelecionadas);

    let filtroFaseDisplay = '';
    if (fasesSelecionadas.length > 0) {
        // Para obter os nomes legíveis, você precisa do texto do label ou de um mapa de tradução.
        // Vamos assumir que você tem uma função auxiliar 'getPhaseNamesByIds' ou faz a busca no DOM.
        // Usando uma busca simples no DOM para obter o texto dos labels (mais robusto):
        const nomesFases = fasesSelecionadas.map(value => {
            const input = document.querySelector(`input[name="phaseFilter"][value="${value}"]`);
            // Procura pelo elemento label/span que contém o nome.
            const labelText = input ? input.closest('label').querySelector('.checkbox__textwrapper').textContent.trim() : `ID ${value}`;
            return labelText;
        });
        filtroFaseDisplay = ` (Fases: ${nomesFases.join(', ')})`;
    }                               

    const temFiltroDeFase = fasesSelecionadas.length > 0;    
    
    if (temFiltroDeFase && (!evento || evento === "todos")) {
        // Usamos uma mensagem mais genérica, pois pode haver múltiplas fases
        Swal.fire({
            icon: 'warning',
            title: 'Seleção de Evento Obrigatória',
            text: `Ao filtrar por **Fase(s) do Evento**, você deve selecionar um evento específico.`,
        });
        gerarRelatorioBtn.disabled = false;
        return;
    }

    const phaseKeyMap = { 
        'montagemInfra': { ini: 'dtiniinframontagem', fim: 'dtfiminframontagem' },
        'marcacao': { ini: 'dtinimarcacao', fim: 'dtfimmarcacao' },
        'realizacao': { ini: 'dtinirealizacao', fim: 'dtfimrealizacao' },
        'desmontagemInfra': { ini: 'dtiniinfradesmontagem', fim: 'dtfiminfradesmontagem' },
        'montagem': { ini: 'dtinimontagem', fim: 'dtfimmontagem' },
        'desmontagem': { ini: 'dtinidesmontagem', fim: 'dtfimdesmontagem' }
    };

    console.log("CHAVES", phaseKeyMap);

    let dataFinalInicio = dataInicio; // Inicia com a data original do relatório
    let dataFinalFim = dataFim;       // Inicia com a data original do relatório

    console.log("DEBUG ARRAY BRUTO BASE:", todosOsDadosDoPeriodo);


    if (temFiltroDeFase) {

        const eventoSelecionadoStr = String(eventoSelecionado).trim();

        // 1. FILTRO PRIMÁRIO (Mantemos o mais robusto para a maioria dos eventos)
        const dadosFiltradosPorEventoBase = todosOsDadosDoPeriodo.filter(evento => {
            if (eventoSelecionado === 'todos' || eventoSelecionado === '') {
                return true;
            }

            // Compara com coerção fraca após limpeza de string
            const eventoIdeventoLimpo = String(evento.idevento || '').trim();
            return eventoIdeventoLimpo == eventoSelecionadoStr;
        });

        let dadosFiltradosPorEvento = [...dadosFiltradosPorEventoBase];

        // 2. CORREÇÃO DE CONTINGÊNCIA: Se a filtragem falhou para o Evento 2 (BEAUTY FAIR)
        if (eventoSelecionadoStr === '2' && dadosFiltradosPorEvento.length <= 1) {

            console.warn("⚠️ Aplicando filtro de contingência por Nome para Evento 2 (BEAUTY FAIR 2025) devido à inconsistência de dados (USANDO INCLUDES).");

            // Usamos apenas a parte mais distinta do nome para a verificação
            const nomeParteParaComparacao = 'BEAUTY FAIR'; 
            const idEvento2 = 2;

            // Usamos um Set para garantir que não haja duplicatas
            const uniqueEvents = new Set(dadosFiltradosPorEvento);

            // Itera sobre o array de dados brutos e inclui manualmente os orçamentos do BEAUTY FAIR
            todosOsDadosDoPeriodo.forEach(evento => {
                const eventoNomeLimpo = String(evento.nmevento || '').trim().toUpperCase();

                // >>> MUDANÇA CRÍTICA: Aceita se o ID for 2 OU se o nome CONTIVER 'BEAUTY FAIR' (mais robusto)
                const isContingencyMatch = eventoNomeLimpo.includes(nomeParteParaComparacao.toUpperCase());

                if (Number(evento.idevento) === idEvento2 || isContingencyMatch) {
                     uniqueEvents.add(evento);
                }
            });

            // Converte o Set de volta para um array
            dadosFiltradosPorEvento = Array.from(uniqueEvents);
        }

        console.log("DEBUG ARRAY FILTRADO COMPLETO (SOLUÇÃO FINAL):", dadosFiltradosPorEvento); 


        // Se o filtro retornar 0 eventos, podemos sair aqui para evitar loop desnecessário.
        if (dadosFiltradosPorEvento.length === 0) {
            console.warn("NENHUM evento encontrado para o ID selecionado. Saindo.");
            // ... (Coloque o código de erro/retorno aqui)
        }

        // Inicializa com as datas limite originais, mas como objetos Date válidos
        let minDate = new Date('9999-12-31'); // Mantenha a inicialização extrema
        let maxDate = new Date('1900-01-01'); // Mantenha a inicialização extrema
        
        let foundAnyValidDate = false; // Flag para verificar se encontramos alguma data válida
      

        dadosFiltradosPorEvento.forEach(evento => {   

            console.log("[DEBUG EVENTO] Objeto sendo processado (Nomenclatura):", evento.nomenclatura, "Datas:", evento.dtinimontagem, evento.dtfimmontagem); // Adicionei a verificação direta

            fasesSelecionadas.forEach(fase => {
                const keys = phaseKeyMap[fase];                
                
                if (keys) {
                    const iniDateStr = evento[keys.ini] || ''; 
                    const fimDateStr = evento[keys.fim] || ''; 

                   console.log(`[DEBUG 2] Fase: ${fase} | Strings (dps do || ''): ${iniDateStr} - ${fimDateStr}`);
           
                    

                    if (iniDateStr.length > 0) {
                        // Correção de Estabilidade: Usa 'T00:00:00' para forçar a interpretação local
                        const iniDate = new Date(iniDateStr.split('T')[0] + 'T00:00:00'); 

                        console.log("INIDATE", iniDate);
                        
                        if (!isNaN(iniDate.getTime()) && iniDate < minDate) {
                            minDate = iniDate;
                            foundAnyValidDate = true;
                        }
                    }

                    // --- Processa Data de Fim ---
                    if (fimDateStr.length > 0) { 
                        const fimDate = new Date(fimDateStr.split('T')[0] + 'T00:00:00'); 
                        
                        if (!isNaN(fimDate.getTime()) && fimDate > maxDate) {
                            maxDate = fimDate;
                            foundAnyValidDate = true;
                        }
                    }
                }
            });
        });

        // Se encontramos pelo menos uma data válida, atualizamos as datas finais
        if (foundAnyValidDate) { // <<< CONDIÇÃO CORRIGIDA
            // Formata para YYYY-MM-DD
            dataFinalInicio = minDate.toISOString().split('T')[0];
            dataFinalFim = maxDate.toISOString().split('T')[0];
            console.log(`Período Consolidado da(s) Fase(s): ${dataFinalInicio} a ${dataFinalFim}`);
        } else {
            // Se a fase foi selecionada, mas não achamos nenhuma data válida em nenhum evento
            console.warn("NENHUMA data de fase encontrada para a seleção. Forçando período inválido.");
            dataFinalInicio = '1900-01-01'; 
            dataFinalFim = '1900-01-01';

            // Tratamento de Erro (o 'eventoSelecionado' agora está definido no topo)
            if (eventoSelecionado && eventoSelecionado !== "todos") {
                Swal.fire({
                    icon: 'info',
                    title: 'Evento Selecionado Sem Fase',
                    text: 'O evento selecionado não possui datas para a(s) fase(s) filtrada(s). O relatório será vazio.',
                });
                gerarRelatorioBtn.disabled = false;
                return;
            }
        }
        console.log("FASE SELECIONADA PARA ROTA", dataFinalInicio, dataFinalFim);
    }

    
    let eventoFilter = '';
    
   
    console.log("EVENTO SELECIONADO", eventoSelecionado);
    
    if (eventoSelecionado && eventoSelecionado !== "todos") {
        eventoFilter = ` AND tse.idevento = ${eventoSelecionado}`;
    } 
    
    
    const checkedInput = document.querySelector('input[name="reportType"]:checked');
    let nomeRelatorio = ""; // Inicializa a variável
    
    if (checkedInput) {       
        const labelElement = checkedInput.closest('label');

        if (labelElement) {           
            const textWrapper = labelElement.querySelector('.checkbox__textwrapper');            
           
            nomeRelatorio = textWrapper ? textWrapper.textContent.trim() : 'Relatório Desconhecido';            
            console.log("Nome do Relatório:", nomeRelatorio);            
        }
    }

  //  const eventoId = document.getElementById('eventSelect').value;
  //  const clienteId = document.getElementById('clientSelect').value;

    //const eventoId = eventSelectElement ? eventSelectElement.value : null; // CORREÇÃO AQUI!
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

    // if (!evento) {
    //     const escolha = await Swal.fire({
    //         title: 'Nenhum evento selecionado',
    //         text: "Você deseja escolher um evento ou gerar o relatório de TODOS os eventos do período?",
    //         icon: 'question',
    //         showCancelButton: true,
    //         confirmButtonText: 'Gerar de todos',
    //         cancelButtonText: 'Escolher evento'
    //     });

    //     if (escolha.isConfirmed) {
    //         evento = "todos"; // Gera relatório para todos os eventos
    //     } else {
    //         gerarRelatorioBtn.disabled = false;
    //         return; // Apenas fecha o Swal e não gera nada
    //     }
    // }


    if (!evento || evento === "todos") {
        // Se NENHUMA fase está selecionada, pergunte se quer gerar o relatório para todos os eventos
        if (!temFiltroDeFase) { 
             const escolha = await Swal.fire({
                title: 'Nenhum evento selecionado',
                text: "Você deseja escolher um evento ou gerar o relatório de TODOS os eventos do período?",
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Gerar de todos',
                cancelButtonText: 'Escolher evento'
            });
    
            if (escolha.isConfirmed) {
                evento = "todos"; 
            } else {
                gerarRelatorioBtn.disabled = false;
                return;
            }
        }
    }

    try {
        //console.log("EVENTO FILTER FINAL ENVIADO", eventoFilter, dataFinalInicio, dataFinalFim);
        console.log("EVENTO FILTER FINAL ENVIADO", tipo, dataFinalInicio, dataFinalFim, eventoId, clienteId, equipeId, incluirPendentes,incluirPagos);
      
       const url = `/relatorios?tipo=${tipo}&dataInicio=${dataFinalInicio}&dataFim=${dataFinalFim}&evento=${eventoId}&cliente=${clienteId}&equipe=${equipeId}&pendentes=${incluirPendentes}&pagos=${incluirPagos}`;
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
                const incluirPendentes = checkPendentes.checked; // Será true ou false
                const incluirPagos = checkPagos.checked;

                eventosOrdenados.forEach(evento => {
                    const eventoIdParaTotal = evento.fechamentoCache.length > 0 ? evento.fechamentoCache[0].idevento : null;
                    const totaisDoEventoAtual = eventoIdParaTotal && dados.fechamentoCacheTotaisPorEvento ?
                        (dados.fechamentoCacheTotaisPorEvento[eventoIdParaTotal] || { totalVlrDiarias: 0, totalVlrAdicional: 0, totalTotalDiarias: 0, totalTotalGeral: 0, totalTotalPagar: 0 }) :
                        { totalVlrDiarias: 0, totalVlrAdicional: 0, totalTotalDiarias: 0, totalTotalGeral: 0, totalTotalPagar: 0 };
                    console.log('Totais do evento atual:', totaisDoEventoAtual); // Log para verificar os totais
                    relatorioHtmlCompleto += montarRelatorioHtmlEvento(
                        evento.fechamentoCache,
                        evento.nomeEvento,
                        nomeRelatorio,
                        evento.nomeCliente,                        
                        evento.utilizacaoDiarias,
                        evento.contingencia,
                        totaisDoEventoAtual,
                        filtroFaseDisplay
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
        
        .table-title-header {
            /* Copia os estilos do seu antigo .utilizacao-diarias-header */
            background-color: #a8a8a8ff; /* Fundo cinza */
            color: black;
            padding: 8px 12px;
            font-size: 16px;
            text-align: center;
            
            /* Remove as bordas arredondadas, pois a próxima linha é laranja e colada */
            border-top-left-radius: 0; 
            border-top-right-radius: 0;
            
            /* Adiciona uma borda inferior para separar visualmente do cabeçalho laranja abaixo */
            border-bottom: 2px solid #999; 
            
            /* Garante que o conteúdo não quebre na impressão */
            page-break-inside: avoid; 
        }

        .report-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 8px;
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
          //  color: black;
            display: table-header-group;
        }

        .report-table thead, 
        .report-table thead tr {
            height: auto;
        }

        .report-table thead tr th {
            /* Garante que todas as células do cabeçalho tenham a cor de texto padrão */
            color: black;
        }

        .report-table thead tr:not(:first-child) th {
            /* Aplica a cor laranja a todas as linhas do thead, EXCETO a primeira (o título cinza) */
            background-color: orange;
            color: black; /* Cor do texto branco para o fundo laranja */
        }

        .relatorio-resumo-container {
            display: flex;
            gap: 20px;
            margin-top: 20px;
            flex-direction: column;
        }

        .resumo-par-orcamento {
            display: flex;
            flex-direction: row; /* CHAVE: Coloca as tabelas lado a lado */
            gap: 20px; /* Espaço entre as duas tabelas */
            width: 100%;
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


  document.querySelectorAll('input[type="radio"]').forEach(radio => {
    radio.addEventListener('mousedown', function(e) {
      if (e.button !== 0) return; // ignora clique que não seja o esquerdo
      if (this.checked) {
        e.preventDefault(); // previne seleção normal
        this.checked = false; // desmarca
      }
    });
  });


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
