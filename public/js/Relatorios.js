import { fetchComToken, aplicarTema } from '../utils/utils.js';
let empresaLogoPath = 'http://localhost:3000/img/JA_Oper.png';

function inicializarDadosEmpresa() {
    const idempresa = localStorage.getItem("idempresa");

    console.log("ID da empresa obtido do localStorage:", idempresa);

    if (idempresa) {
        const apiUrl = `/relatorios/empresas/${idempresa}`;

        fetchComToken(apiUrl)
            .then(empresa => {
                const tema = empresa.nmfantasia;
                aplicarTema(tema);
                const elEmpresa = document.getElementById('relEmpresaNome');
                if (elEmpresa) elEmpresa.textContent = `Empresa: ${tema}`;

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
let podeVerFinanceiro;

// Tela do Fechamento de Staff: último relatório gerado, colunas/blocos que o usuário desmarcou
// (salvas por usuário + tipo em relatoriopreferencias) e se a prévia mostra "como vai imprimir".
let relatorioAtual = null;
let ocultasAtuais = [];
let previaImpressao = false;
const BLOCO_UTIL = '_util';
const BLOCO_CONT = '_cont';


function usuarioTemPermissaoFinanceiro() {
  if (!window.permissoes || !Array.isArray(window.permissoes)) {
    console.log("%c❌ ERRO: window.permissoes não carregado.", "color: red; font-weight: bold;");
    return false;
  }

  // Usamos .includes para aceitar "relatorio" ou "relatorios"
  const permissaoRelatorio = window.permissoes.find(p => 
    p.modulo?.toLowerCase().includes("relatorio")
  );

  if (!permissaoRelatorio) {
    console.log("%c⚠️ Módulo Relatório não encontrado na lista de permissões.", "color: orange;");
    return false;
  }

  const temAcesso = !!permissaoRelatorio.pode_financeiro;
  podeVerFinanceiro= temAcesso;

  // Console que você pediu para mostrar se é financeiro ou não
  if (temAcesso) {
    console.log("%c✅ ACESSO: Você é usuário FINANCEIRO", "background: #2ecc71; color: #fff; padding: 2px 5px; border-radius: 3px;");
  } else {
    console.log("%cℹ️ ACESSO: Você é usuário OPERACIONAL", "background: #3498db; color: #fff; padding: 2px 5px; border-radius: 3px;");
  }

  return temAcesso;
}

function configurarLayoutPorPermissao() {
    const temAcessoFinanceiro = usuarioTemPermissaoFinanceiro();
    
    const divFinanceiro = document.getElementById('opcoesFinanceiro');
    const divOperacional = document.getElementById('opcaoOperacional');
    const divStatusPagamento = document.getElementById('filtrosPagamento'); 
    
    const operacionalRadio = document.getElementById('operacionalRadio');
    const ajudaCustoRadio = document.getElementById('ajudaCustoRadio');

    if (temAcessoFinanceiro) {
        console.log("💰 Modo Financeiro Ativo: Escondendo opção comum.");
        
        // MOSTRA Financeiro
        if (divFinanceiro) divFinanceiro.style.display = ''; 
        if (divStatusPagamento) divStatusPagamento.style.display = 'block';
        if (ajudaCustoRadio) ajudaCustoRadio.checked = true;

        // ESCONDE Operacional (Funcionários)
        if (divOperacional) divOperacional.style.display = 'none';

    } else {
        console.log("🔒 Modo Operacional Ativo: Escondendo opções financeiras.");
        
        // ESCONDE Financeiro
        if (divFinanceiro) divFinanceiro.style.display = 'none';
        if (divStatusPagamento) divStatusPagamento.style.display = 'none';

        // MOSTRA Operacional (Funcionários)
        if (divOperacional) divOperacional.style.display = '';
        if (operacionalRadio) operacionalRadio.checked = true;
    }
}

// Chame esta função sempre que o modal for aberto
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
        imprimirRelatorioAtual();
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

    configurarTelaEmbutida();
    document.getElementById('xlsButton')?.addEventListener('click', exportarExcelAtual);
    document.getElementById('btnMostrarTodasColunas')?.addEventListener('click', () => {
        if (!relatorioAtual) return;
        ocultasAtuais = [];
        salvarPreferenciaColunas(relatorioAtual.tipo, ocultasAtuais);
        desenharControlesColunas();
        renderizarPreviaRelatorio();
    });
    document.getElementById('btnPreviaImpressao')?.addEventListener('click', (e) => {
        previaImpressao = !previaImpressao;
        e.currentTarget.setAttribute('aria-pressed', String(previaImpressao));
        renderizarPreviaRelatorio();
    });
    // Evento/Cliente/Equipe listam o período aberto (hoje a hoje) desde o início, sem precisar mexer nas datas.
    preencherEventosPeriodo();

    const urlParams = new URLSearchParams(window.location.search);
    const tipoRelatorioInicial = urlParams.get('tipo');

    if (tipoRelatorioInicial && reportTypeSelect && reportTypeSelect.querySelector(`option[value="${tipoRelatorioInicial}"]`)) {
        reportTypeSelect.value = tipoRelatorioInicial;
        gerarRelatorio();
    }

    // Pagamentos a Empreiteiras: troca os filtros ao escolher o tipo; e, se a tela foi aberta
    // por "Ver pagamentos" (Cadastro de Fornecedor) ou "Histórico da empreiteira" (Vencimentos),
    // já abre nesse tipo, filtrada no fornecedor, e gera.
    document.querySelectorAll('input[name="reportType"]').forEach(radio => {
        radio.addEventListener('change', alternarFiltrosEmpreiteira);
    });
    const filtroInicial = window.filtroRelatorioEmpreiteira;
    window.filtroRelatorioEmpreiteira = null;

    console.log("⚙️ Relatórios inicializado.");
    configurarLayoutPorPermissao();
    // Sem permissão para ver fornecedores, o tipo de pagamentos de empreiteira nem aparece.
    if (!usuarioPodeVerFornecedores()) {
        document.getElementById('empreiteirasRadio')?.closest('label')?.remove();
    }
    alternarFiltrosEmpreiteira();

    if (filtroInicial) {
        const radioEmp = document.getElementById('empreiteirasRadio');
        if (radioEmp) {
            radioEmp.checked = true;
            alternarFiltrosEmpreiteira().then(() => {
                const sel = document.getElementById('empreiteiraSelect');
                if (sel && filtroInicial.idfornecedor) sel.value = String(filtroInicial.idfornecedor);
                // Ano escolhido no resumo do Cadastro de Fornecedor: período do ano inteiro.
                if (filtroInicial.ano) {
                    document.getElementById('reportStartDate').value = `${filtroInicial.ano}-01-01`;
                    document.getElementById('reportEndDate').value = `${filtroInicial.ano}-12-31`;
                }
                gerarRelatorio();
            });
        }
    }
    const temAcesso = usuarioTemPermissaoFinanceiro();
    if (temAcesso) {
        console.log("%c💰 STATUS: Usuário com Permissão FINANCEIRA", "color: white; background: green; padding: 5px; border-radius: 3px; font-weight: bold;");
    } else {
        console.log("%c🔒 STATUS: Usuário nível OPERACIONAL (Sem Financeiro)", "color: white; background: orange; padding: 5px; border-radius: 3px; font-weight: bold;");
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


// async function preencherEventosPeriodo() {
//     const startDate = document.getElementById('reportStartDate').value;
//     const endDate = document.getElementById('reportEndDate').value;
//     const eventSelect = document.getElementById('eventSelect');
//     const clientSelect = document.getElementById('clientSelect'); // Supondo que você tenha um select de clientes

//     if (!startDate || !endDate) {
//         eventSelect.innerHTML = '<option value="">Selecione um Evento</option>';
//         clientSelect.innerHTML = '<option value="">Selecione um Cliente</option>';
//         return;
//     }

//     try {
//         // Altere a rota da sua API para retornar todos os eventos e seus clientes
//         // para o período selecionado.
//         const url = `/relatorios/eventos?inicio=${startDate}&fim=${endDate}`;
//         const dados = await fetchComToken(url);       

//         const dadosAgrupados = {};

//         console.log('Dados brutos para o período:', dados);

//         dados.forEach(item => {
//             if (!dadosAgrupados[item.idevento]) {
//                 dadosAgrupados[item.idevento] = {
//                     idevento: item.idevento,
//                     nmevento: item.nmevento,
//                     nomenclatura: item.nomenclatura,
//                     dtiniinframontagem: item.dtiniinframontagem,
//                     dtfiminframontagem: item.dtfiminframontagem,
//                     dtinimarcacao: item.dtinimarcacao,
//                     dtfimmarcacao: item.dtfimmarcacao,
//                     dtinirealizacao: item.dtinirealizacao,
//                     dtfimrealizacao: item.dtfimrealizacao,
//                     dtinidesmontagem: item.dtinidesmontagem,
//                     dtfimdesmontagem: item.dtfimdesmontagem,
//                     dtiniinfradesmontagem: item.dtiniinfradesmontagem,
//                     dtfiminfradesmontagem: item.dtfiminfradesmontagem,
//                     clientes: []
//                 };
//             }
//             dadosAgrupados[item.idevento].clientes.push({
//                 idcliente: item.idcliente,
//                 nomeCliente: item.cliente
//             });
//         });

//         // Converte o objeto de volta para um array para facilitar a iteração
//         todosOsDadosDoPeriodo = Object.values(dadosAgrupados);
        
//         // Armazena os dados em uma variável global
//       //  todosOsDadosDoPeriodo = dados;
//         console.log('Dados AGRUPADOS para o período:', todosOsDadosDoPeriodo);
//         // 1. Preencher o select de Eventos
//         eventSelect.innerHTML = '<option value="">Todos os Eventos</option>';
//         dados.forEach(evento => {
//             const opt = document.createElement('option');
//             opt.value = evento.idevento;
//             //opt.textContent = evento.nmevento;
//             const nomenclaturaDisplay = evento.nomenclatura ? ` (${evento.nomenclatura})` : '';
//             opt.textContent = `${evento.nmevento}${nomenclaturaDisplay}`;
//             eventSelect.appendChild(opt);
//         });

//         // 2. Preencher o select de Clientes com todos os clientes
//         preencherClientesEvento();


//         preencherEquipesEvento();

//     } catch (error) {
//         console.error('Erro ao carregar dados:', error);
//         eventSelect.innerHTML = '<option value="">Nenhum evento encontrado</option>';
//         clientSelect.innerHTML = '<option value="">Nenhum cliente encontrado</option>';
//     }
// }

async function preencherEventosPeriodo() {
    const startDate = document.getElementById('reportStartDate').value;
    const endDate = document.getElementById('reportEndDate').value;
    const eventSelect = document.getElementById('eventSelect');
    const clientSelect = document.getElementById('clientSelect');

    if (!startDate || !endDate) {
        eventSelect.innerHTML = '<option value="">Selecione um Evento</option>';
        clientSelect.innerHTML = '<option value="">Selecione um Cliente</option>';
        return;
    }

    try {
        const url = `/relatorios/eventos?inicio=${startDate}&fim=${endDate}`;
        const dados = await fetchComToken(url);       

        const dadosAgrupados = {};

        // --- FILTRO DE SEGURANÇA NO FRONT-END ---
        // Garante que se o backend enviou algo de 2025 por engano, o front ignora
        const dadosFiltrados = dados.filter(item => {
            const dataItem = (item.dtinirealizacao || '').split('T')[0];
            return dataItem >= startDate && dataItem <= endDate;
        });

        console.log('Dados filtrados para o período:', dadosFiltrados);

        dadosFiltrados.forEach(item => {
            if (!dadosAgrupados[item.idevento]) {
                dadosAgrupados[item.idevento] = {
                    idevento: item.idevento,
                    nmevento: item.nmevento,
                    nomenclatura: item.nomenclatura,
                    dtinirealizacao: item.dtinirealizacao,
                    // ... (demais datas)
                    clientes: []
                };
            }
            
            // Evita duplicar clientes no mesmo evento
            const clienteJaExiste = dadosAgrupados[item.idevento].clientes.some(c => c.idcliente === item.idcliente);
            if (!clienteJaExiste) {
                dadosAgrupados[item.idevento].clientes.push({
                    idcliente: item.idcliente,
                    nomeCliente: item.cliente
                });
            }
        });

        // Atualiza a variável global com os dados filtrados e agrupados
        todosOsDadosDoPeriodo = Object.values(dadosAgrupados);
        
        // 1. Preencher o select de Eventos
        eventSelect.innerHTML = '<option value="">Todos os Eventos</option>';
        
        // USAMOS OS DADOS AGRUPADOS PARA NÃO REPETIR O NOME DO EVENTO NO SELECT
        todosOsDadosDoPeriodo.forEach(evento => {
            const opt = document.createElement('option');
            opt.value = evento.idevento;
            const nomenclaturaDisplay = evento.nomenclatura ? ` (${evento.nomenclatura})` : '';
            opt.textContent = `${evento.nmevento}${nomenclaturaDisplay}`;
            eventSelect.appendChild(opt);
        });

        // 2. Chama as funções dependentes
        preencherClientesEvento();
        preencherEquipesEvento();

    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        eventSelect.innerHTML = '<option value="">Erro ao carregar</option>';
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


// function preencherClientesEvento() {
//     const eventSelect = document.getElementById('eventSelect');
//     const clientSelect = document.getElementById('clientSelect');
//     const eventoId = eventSelect.value;

//      console.log('Dados carregados para o período no PREENCHER CLIENTES:', todosOsDadosDoPeriodo);
    
//     // Reseta o select de clientes
//     clientSelect.innerHTML = '<option value="">Todos os Clientes</option>';

//     if (!todosOsDadosDoPeriodo) {
//         return; // Não há dados para preencher
//     }

//     // Se um evento específico foi selecionado
//     if (eventoId) {
//         console.log('Evento selecionado:', eventoId);
//         const eventoIdNum = parseInt(eventoId, 10);
//        // const eventoSelecionado = todosOsDadosDoPeriodo.find(ev => ev.idevento === eventoId);
//        const eventoSelecionado = todosOsDadosDoPeriodo.find(ev => ev.idevento === eventoIdNum);
//         if (eventoSelecionado && eventoSelecionado.clientes) {
//             eventoSelecionado.clientes.forEach(cliente => {
//                 const opt = document.createElement('option');
//                 opt.value = cliente.idcliente;
//                 opt.textContent = cliente.nomeCliente;
//                 clientSelect.appendChild(opt);
//             });
//         }
//     // } else {
//     //     // Se nenhum evento foi selecionado, carrega todos os clientes de todos os eventos
//     //     const clientesUnicos = new Set();
//     //     todosOsDadosDoPeriodo.forEach(evento => {
//     //         if (evento.clientes) {
//     //             evento.clientes.forEach(cliente => {
//     //                 clientesUnicos.add(JSON.stringify({ id: cliente.idcliente, nome: cliente.nomeCliente }));
//     //             });
//     //         }
//     //     });
        
//     //     const clientesArray = Array.from(clientesUnicos).map(c => JSON.parse(c)).sort((a, b) => a.nome.localeCompare(b.nome));
//     //     clientesArray.forEach(cliente => {
//     //         const opt = document.createElement('option');
//     //         opt.value = cliente.id;
//     //         opt.textContent = cliente.nome;
//     //         clientSelect.appendChild(opt);
//     //     });
//     // }

//     }else {
//         const clientesUnicos = new Set();
//         const dataInicioFiltro = document.getElementById('reportStartDate').value;
//         const dataFimFiltro = document.getElementById('reportEndDate').value;

//         // Filtramos para garantir que o cliente só apareça se tiver evento no período de 2026
//         todosOsDadosDoPeriodo
//             .filter(e => {
//                 const d = (e.dtinirealizacao || '').split('T')[0];
//                 return d >= dataInicioFiltro && d <= dataFimFiltro;
//             })
//             .forEach(evento => {
//                 if (evento.clientes) {
//                     evento.clientes.forEach(cliente => {
//                         clientesUnicos.add(JSON.stringify({ id: cliente.idcliente, nome: cliente.nomeCliente }));
//                     });
//                 }
//             });
//     }
// }

function preencherClientesEvento() {
    // No relatório de pagamentos de empreiteira, Evento/Cliente só refiltram o que já foi carregado.
    if (estaNaTelaDeEmpreiteiras()) { renderizarEmpreiteiras(); return; }
    const eventSelect = document.getElementById('eventSelect');
    const clientSelect = document.getElementById('clientSelect');
    const eventoId = eventSelect.value;
    
    // Pegamos as datas dos filtros da tela para comparar
    const dataInicioFiltro = document.getElementById('reportStartDate').value;
    const dataFimFiltro = document.getElementById('reportEndDate').value;

    console.log('Dados carregados para o período no PREENCHER CLIENTES:', todosOsDadosDoPeriodo);
    
    clientSelect.innerHTML = '<option value="">Todos os Clientes</option>';

    if (!todosOsDadosDoPeriodo) return;

    if (eventoId) {
        // --- CORREÇÃO AQUI: Filtramos o evento, mas checamos se ele pertence ao período ---
        const eventoIdNum = parseInt(eventoId, 10);
        const eventoSelecionado = todosOsDadosDoPeriodo.find(ev => {
            const dataEvento = (ev.dtinirealizacao || '').split('T')[0];
            return ev.idevento === eventoIdNum && (dataEvento >= dataInicioFiltro && dataEvento <= dataFimFiltro);
        });

        if (eventoSelecionado && eventoSelecionado.clientes) {
            eventoSelecionado.clientes.forEach(cliente => {
                const opt = document.createElement('option');
                opt.value = cliente.idcliente;
                opt.textContent = cliente.nomeCliente;
                clientSelect.appendChild(opt);
            });
        }
    } else {
        // --- SEU TRECHO CORRIGIDO ---
        const clientesUnicos = new Set();

        todosOsDadosDoPeriodo
            .filter(e => {
                const d = (e.dtinirealizacao || '').split('T')[0];
                return d >= dataInicioFiltro && d <= dataFimFiltro;
            })
            .forEach(evento => {
                if (evento.clientes) {
                    evento.clientes.forEach(cliente => {
                        clientesUnicos.add(JSON.stringify({ id: cliente.idcliente, nome: cliente.nomeCliente }));
                    });
                }
            });

        // Não esqueça de renderizar os clientes únicos encontrados no else:
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
document.getElementById('clientSelect').addEventListener('change', () => { if (estaNaTelaDeEmpreiteiras()) renderizarEmpreiteiras(); });
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

function montarRelatorioHtmlEvento(dadosFechamento, nomeEvento, nomeRelatorio, nomeCliente, dadosUtilizacao, dadosContingencia, totaisFechamentoCache, filtroFaseDisplay, podeVerFinanceiro, tipo) { 
    
    const formatarMoeda = (valor) => {
        const num = parseFloat(valor) || 0;
        return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const formatarData = (data) => {
        if (!data) return '';
        if (typeof data === 'string' && data.includes('-')) {
            const [ano, mes, dia] = data.split('T')[0].split('-');
            return `${dia}/${mes}/${ano}`;
        }
        const d = new Date(data);
        return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
    };

    const obterClasseStatus = (status) => {
        if (!podeVerFinanceiro) return ''; 
        switch (status) {
            case 'Pago':
            case 'Pago 100%': return 'status-pago-100';
            case 'Pago 50%': return 'status-pago-50';
            default: return 'status-pendente';
        }
    };

    // `ajuste` = Crédito/Débito do funcionário. É um lançamento à parte (staffajustefinanceiro,
    // com status próprio) e nunca é dividido pelos 50%: entra inteiro DEPOIS de metade do valor
    // já ter sido abatida. Somá-lo ao valorTotal antes da divisão descontava só metade do débito
    // (ex.: cachê 460, Pago 50%, débito 120 -> mostrava 170 em vez de 230 - 120 = 110).
    const montarCelulaPendente = (rotulo, status, valorTotal, considerarPago = true, ajuste = 0) => {
        const valor = parseFloat(valorTotal) || 0;
        const prefixo = rotulo ? `${rotulo}: ` : '';
        const texto = `${prefixo}${formatarMoeda(valor + ajuste)}`;

        if (status === 'Rejeitado' || status === 'Recusado') {
            return `<span style="text-decoration: line-through; color: #d9534f;">${texto}</span>`;
        }
        if (status === 'Suspenso') {
            return `<span style="text-decoration: line-through; color: var(--text-2);">${texto}</span>`;
        }
        if (considerarPago && (status === 'Pago' || status === 'Pago 100%')) {
            return `${prefixo}${formatarMoeda(0)}`;
        }
        if (considerarPago && (status === 'Pago 50%' || status === 'Pago50')) {
            return `${prefixo}${formatarMoeda(valor / 2 + ajuste)}`;
        }
        return texto;
    };

    // Mostra o valor autorizado normalmente e, se houver caixinha ainda não
    // decidida, empilha o valor pendente (mais apagado) + aviso abaixo — em vez
    // de somar tudo junto, que dava a impressão de já estar tudo autorizado.
    // `linhaEscura` ajusta as cores pra continuar legível em cima do fundo
    // vermelho escuro usado quando a linha tem Ajuste de Custo aplicado.
    const montarCelulaCaixinha = (valorAutorizado, valorPendente, linhaEscura = false) => {
        const autorizado = parseFloat(valorAutorizado) || 0;
        const pendente = parseFloat(valorPendente) || 0;
        const corValorPendente = linhaEscura ? 'rgba(255,255,255,0.7)' : '#888';
        const corLabelPendente = linhaEscura ? '#ffe066' : '#b8860b';

        let html = autorizado > 0 || pendente <= 0 ? formatarMoeda(autorizado) : '';

        if (pendente > 0) {
            html += `${autorizado > 0 ? '<br>' : ''}<span style="color: ${corValorPendente};">${formatarMoeda(pendente)}</span><br><span style="color: ${corLabelPendente};">Pendente de Autorização</span>`;
        }

        return html;
    };

    const obterClasseCompStatus = (status) => {
        if (!status) return '';
        // 50% (ex.: "Cachê 50% Anexado", "50% Anexado") precisa vir antes do check de
        // "Anexado" — senão cai no branch de "ok" (verde) mesmo faltando a 2ª parcela.
        if (status.includes('50%')) return 'status-doc-alerta';
        if (status.includes('Anexado') && !status.includes('Falta')) return 'status-doc-ok';
        if (status === 'Isento') return 'status-doc-isento';
        return 'status-doc-erro';
    };

    const equipeSelectElement = document.getElementById('equipeSelect');   
    const selectedIndex = equipeSelectElement.selectedIndex;
    let nomeEquipe = selectedIndex >= 0 ? ` - Equipe: ${equipeSelectElement.options[selectedIndex].text}` : '';

    let html = `
        <div class="relatorio-evento">
            <div class="print-header-top">
                <img src="${empresaLogoPath}" alt="Logo Empresa" class="logo-ja">
                <div class="header-title-container">
                    <h1 class="header-title">${nomeEvento}</h1>
                </div>  
            </div>
            <h2>RELATÓRIO ${nomeRelatorio.toUpperCase()} - Cliente: ${nomeCliente} ${nomeEquipe} ${filtroFaseDisplay}</h2>
    `;

    if (dadosFechamento && dadosFechamento.length > 0) {
        const dataInicioSelecionada = document.getElementById('reportStartDate').value;
        const dataFimSelecionada = document.getElementById('reportEndDate').value;

        html += `
            <p>
                <span class="data-relatorio">Data de Início: <strong>${formatarData(dataInicioSelecionada)}</strong></span>
                <span class="data-relatorio">Data de Final: <strong>${formatarData(dataFimSelecionada)}</strong></span>
            </p>
            <p class="legenda-relatorio" style="font-size: 11px; margin: 4px 0 10px;">
                <span style="display:inline-block; margin-right:16px;">
                    <span style="display:inline-block; width:12px; height:12px; background-color:#e6f1fd; border:1px solid #999; vertical-align:middle; margin-right:4px;"></span>
                    Custo Fechado / Liberado
                </span>
                <span style="display:inline-block; margin-right:16px;">
                    <span style="display:inline-block; width:12px; height:12px; background-color:#fde4e4; border:1px solid #999; vertical-align:middle; margin-right:4px;"></span>
                    Ajuste de Custo aplicado
                </span>
                <span style="display:inline-block;">
                    <span style="display:inline-block; width:12px; height:12px; background-color:#fff9d6; border:1px solid #999; vertical-align:middle; margin-right:4px;"></span>
                    Aguardando Autorização / Inclusão no Orçamento
                </span>
            </p>
        `;

        let colunas;
        if (podeVerFinanceiro) {
            if (tipo === 'cache_ajuda') {
                colunas = ['FUNÇÃO', 'NOME', 'PIX', 'INÍCIO', 'TÉRMINO', 'QTD CACHÊ', 'VLR CACHÊ', 'VLR ADICIONAL','VLR CAIXINHA', 'TOT DIÁRIAS', 'QTD AJUDA', 'VLR AJUDA', 'TOT AJUDA', 'TOT GERAL', 'CRÉDITO/DÉBITO', 'TOT PAGAR', 'STATUS SOLICITAÇÃO', 'STATUS CACHÊ', 'STATUS AJUDA','STATUS CX','COMP CAIXINHA', 'COMP CACHÊ', 'COMP AJUDA' ];
            } else {
                colunas = ['FUNÇÃO', 'NOME', 'PIX', 'INÍCIO', 'TÉRMINO', 'VLR DIÁRIA', ...(tipo !== 'ajuda_custo' ? ['VLR ADICIONAL'] : []), ...(tipo === 'cache' ? ['VLR CAIXINHA','STATUS CX'] : []), 'QTD', 'TOT DIÁRIAS', 'TOT GERAL', ...(tipo === 'cache' ? ['CRÉDITO/DÉBITO', 'STATUS SOLICITAÇÃO'] : []) ,'STATUS PGTO', 'TOT PAGAR', 'STATUS COMPROVANTE'];
            }
        } else {
            colunas = ['FUNÇÃO', 'NOME', 'CPF', 'INÍCIO', 'TÉRMINO', 'QTD', 'TOT GERAL', 'STATUS PGTO'];
        }

        const alinhamentos = {
            'FUNÇÃO': 'text-left', 'NOME': 'text-left', 'PIX': 'text-left', 'CPF': 'text-left',
            'INÍCIO': 'text-left', 'TÉRMINO': 'text-left', 'VLR DIÁRIA': 'text-right',
            'VLR CACHÊ': 'text-right', 'VLR AJUDA': 'text-right', 'VLR ADICIONAL': 'text-right',
            'STATUS CX': 'text-center', 'QTD': 'text-center', 'QTD CACHÊ': 'text-center', 'QTD AJUDA': 'text-center',
            'TOT DIÁRIAS': 'text-right', 'TOT AJUDA': 'text-right', 'TOT GERAL': 'text-right',
            'STATUS CACHÊ': 'text-center', 'STATUS AJUDA': 'text-center', 'STATUS PGTO': 'text-center', 'VLR CAIXINHA': 'text-center',
            'TOT PAGAR': 'text-right', 'STATUS COMPROVANTE': 'text-center', 'COMP CACHÊ': 'text-center', 'COMP AJUDA': 'text-center', 'COMP CAIXINHA': 'text-center',
            'CRÉDITO/DÉBITO': 'text-right', 'STATUS SOLICITAÇÃO': 'text-center'
        };

        const colspanSubtotal = 5;

        html += `
    <table class="report-table">
        <thead>
            <tr>
                ${colunas.map(col => `<th class="${alinhamentos[col] || ''}">${col}</th>`).join('')}
            </tr>
        </thead>  
        <tbody>
            ${(() => {
                let subtotalFuncionario = {
                    TOT_DIARIAS: 0,
                    TOT_AJUDA: 0,
                    TOT_GERAL: 0,
                    TOT_PAGAR: 0,
                    VLR_CAIXINHA: 0,
                    CREDITO_DEBITO: 0
                };
                let linhas = '';

                console.log('Dados de fechamento para o relatório:', dadosFechamento);

                dadosFechamento.forEach((item, index) => {
                    const proximoItem = dadosFechamento[index + 1];
                    const ehUltimaLinhaFuncionario = !proximoItem || proximoItem.NOME !== item.NOME;
                    const linhasFuncionarioAtual = dadosFechamento.filter(d => d.NOME === item.NOME);
                    const funcionarioTemMultiplasLinhas = linhasFuncionarioAtual.length > 1;

                    // Acumula os valores do funcionário atual
                    subtotalFuncionario.TOT_DIARIAS  += parseFloat(item["TOT DIÁRIAS"]  || 0);
                    subtotalFuncionario.TOT_AJUDA    += parseFloat(item["TOT AJUDA"]    || 0);
                    subtotalFuncionario.TOT_GERAL    += parseFloat(item["TOT GERAL"]    || 0);
                    subtotalFuncionario.TOT_PAGAR    += parseFloat(item["TOT PAGAR"]    || 0);
                    subtotalFuncionario.VLR_CAIXINHA += parseFloat(item["VLR CAIXINHA"] || 0);
                    // CRÉDITO/DÉBITO vem do backend como saldo do FUNCIONÁRIO (não do evento/linha) —
                    // é o mesmo valor repetido em todas as linhas dele, então não pode ser somado
                    // por linha (senão dobra/triplica). Só capturamos o valor (é igual em todas).
                    subtotalFuncionario.CREDITO_DEBITO = parseFloat(item["CRÉDITO/DÉBITO"] || 0);


                    const vlrAdic = parseFloat(item["VLR ADICIONAL"]) || 0;
                    const nivelExp = item.nivelexperiencia ? item.nivelexperiencia.trim() : '';

                    // Cores de fundo suaves (legenda do topo): azul = Custo Fechado/Liberado, rosa =
                    // Ajuste de Custo aplicado, amarelo = aguardando autorização / inclusão no
                    // orçamento (as demais linhas). Todas claras, então o texto é sempre escuro e a
                    // caixinha "Pendente de Autorização" usa as cores normais (antes o fundo do ajuste
                    // era escuro e ela precisava de cores próprias).
                    let styleDestaque = '';
                    const linhaAjusteDestaque = false;
                    if (nivelExp === 'Custo Fechado' || nivelExp === 'Fechado' || nivelExp === 'Custo Liberado' || nivelExp === 'Liberado') {
                        styleDestaque = 'style="color: #1a1a1a; font-weight: bold; background-color: #e6f1fd;"';
                    } else if (vlrAdic !== 0) {
                        styleDestaque = 'style="color: #1a1a1a; font-weight: bold; background-color: #fde4e4;"';
                    } else {
                        styleDestaque = 'style="background-color: #fff9d6;"';
                    }

                    const ehFuncionario = item.PERFIL_STAFF && item.PERFIL_STAFF.includes('Interno');
                    const ehMei = item.PERFIL_MEI;
                    const ehFuncMei = ehFuncionario && ehMei;

                    // Pago via empreiteira: o backend já manda as pessoas de cada empreiteira
                    // juntas (ORDER BY "EMPREITEIRA") — abre o grupo com um cabeçalho aqui e fecha
                    // com o total no nome/PIX dela lá embaixo, depois do subtotal da pessoa.
                    const empreiteiraAtual = item.EMPREITEIRA || null;
                    const itemAnterior = dadosFechamento[index - 1];
                    if (podeVerFinanceiro && empreiteiraAtual && (!itemAnterior || itemAnterior.EMPREITEIRA !== empreiteiraAtual)) {
                        linhas += `
                        <tr class="row-grupo-empreiteira gr-emp">
                            <td colspan="${colunas.length}" style="text-align:left; padding:6px 8px; font-weight:bold; background: #e6e6e6;">
                                FORNECEDOR · ${empreiteiraAtual}
                            </td>
                        </tr>`;
                    }

                    // Moldura grossa em volta de cada funcionário (todas as linhas dele + o subtotal):
                    // bf = linha do bloco, bf-ini/bf-fim = primeira/última (o subtotal fecha o bloco
                    // quando existe). gr-emp = barra lateral contínua do grupo da empreiteira.
                    const primeiraLinhaFuncionario = index === 0 || dadosFechamento[index - 1].NOME !== item.NOME;
                    const temSubtotal = funcionarioTemMultiplasLinhas && podeVerFinanceiro;
                    const classesLinha = ['bf',
                        primeiraLinhaFuncionario ? 'bf-ini' : '',
                        ehUltimaLinhaFuncionario && !temSubtotal ? 'bf-fim' : '',
                        podeVerFinanceiro && empreiteiraAtual ? 'gr-emp' : ''].filter(Boolean).join(' ');

                    linhas += `
                    <tr class="${classesLinha}" ${styleDestaque}>
                        <td class="${alinhamentos['FUNÇÃO']}">${item.FUNÇÃO || ''}</td>
                        <td class="${alinhamentos['NOME']}">${item.NOME || ''}
                            ${ehFuncMei
                                ? '<br><span style="font-size: 8px; color: var(--on-brand); background: rgb(136, 9, 9); padding: 1px 3px; border-radius: 3px; font-weight: normal;">FUNC - MEI</span>'
                                : ehFuncionario
                                    ? '<br><span style="font-size: 8px; color: var(--on-brand); background: rgb(136, 9, 9); padding: 1px 3px; border-radius: 3px; font-weight: normal;">FUNCIONÁRIO</span>'
                                    : ehMei
                                        ? '<br><span style="font-size: 8px; color: var(--on-brand); background: rgb(136, 9, 9); padding: 1px 3px; border-radius: 3px; font-weight: normal;">MEI</span>'
                                        : ''}
                        </td>
                        ${podeVerFinanceiro
                            ? `<td class="${alinhamentos['PIX']}">${empreiteiraAtual ? `<span style="color: var(--text-3);">via ${empreiteiraAtual}</span>` : (item.PIX || '')}</td>`
                            : `<td class="${alinhamentos['CPF']}">${item.CPF || ''}</td>`}
                        <td class="${alinhamentos['INÍCIO']}">${formatarData(item.INÍCIO) || ''}</td>
                        <td class="${alinhamentos['TÉRMINO']}">${formatarData(item.TÉRMINO) || ''}</td>

                        ${podeVerFinanceiro ? (tipo === 'cache_ajuda' ? `
                            <td class="${alinhamentos['QTD CACHÊ']}">${item["QTD CACHÊ"] || item.QTD || ''}</td>
                            <td class="${alinhamentos['VLR CACHÊ']}">${formatarMoeda(item["VLR CACHÊ"])}</td>
                            <td class="${alinhamentos['VLR ADICIONAL']}">${formatarMoeda(item["VLR ADICIONAL"])}</td>
                            <td class="${alinhamentos['VLR CAIXINHA']}">${montarCelulaCaixinha(item["VLR CAIXINHA"], item["VLR CAIXINHA PENDENTE"], linhaAjusteDestaque)}</td>
                            <td class="${alinhamentos['TOT DIÁRIAS']}">${formatarMoeda(item["TOT DIÁRIAS"])}</td>
                            <td class="${alinhamentos['QTD AJUDA']}">${item.QTD_AJUDA || ''}</td>
                            <td class="${alinhamentos['VLR AJUDA']}">${formatarMoeda(item["VLR AJUDA"])}</td>
                            <td class="${alinhamentos['TOT AJUDA']}">${formatarMoeda(item["TOT AJUDA"])}</td>
                            <td class="${alinhamentos['TOT GERAL']}">${formatarMoeda(item["TOT GERAL"])}</td>
                            <td class="${alinhamentos['CRÉDITO/DÉBITO']}" style="${parseFloat(item["CRÉDITO/DÉBITO"] || 0) < 0 ? 'color:#c0392b;' : parseFloat(item["CRÉDITO/DÉBITO"] || 0) > 0 ? 'color:#27ae60;' : ''}">${ehUltimaLinhaFuncionario ? formatarMoeda(item["CRÉDITO/DÉBITO"]) : ''}</td>
                            <td class="${alinhamentos['TOT PAGAR']}">
                            ${montarCelulaPendente('Ajuda', item["STATUS AJUDA"], item["TOT AJUDA"])}<br>${montarCelulaPendente('Cachê', item["STATUS CACHÊ"], item["TOT DIÁRIAS"], true, ehUltimaLinhaFuncionario ? parseFloat(item["CRÉDITO/DÉBITO"] || 0) : 0)}
                            </td>
                            <td class="${alinhamentos['STATUS SOLICITAÇÃO']}">${item["STATUS SOLICITAÇÃO"] || '-'}</td>
                            <td class="${alinhamentos['STATUS CACHÊ']} ${obterClasseStatus(item["STATUS CACHÊ"])}">${item["STATUS CACHÊ"] || 'Pendente'}</td>
                            <td class="${alinhamentos['STATUS AJUDA']} ${obterClasseStatus(item["STATUS AJUDA"])}">${item["STATUS AJUDA"] || 'Pendente'}</td>
                            <td class="${alinhamentos['STATUS CX']} ${obterClasseStatus(item["STATUS CAIXINHA"])}">${item["STATUS CAIXINHA"] || 'Pendente'}</td>
                            <td class="${alinhamentos['COMP CAIXINHA']} ${obterClasseCompStatus(item["COMP CAIXINHA"])}">${item["COMP CAIXINHA"] || 'Pendente'}</td>
                            <td class="${alinhamentos['COMP CACHÊ']} ${obterClasseCompStatus(item["COMP CACHÊ"])}">${item["COMP CACHÊ"] || 'Pendente'}</td>
                            <td class="${alinhamentos['COMP AJUDA']} ${obterClasseCompStatus(item["COMP AJUDA"])}">${item["COMP AJUDA"] || 'Pendente'}</td>
                            
                        ` : `
                            <td class="${alinhamentos['VLR DIÁRIA']}">${formatarMoeda(item["VLR DIÁRIA"])}</td>
                            ${tipo !== 'ajuda_custo' ? `<td class="${alinhamentos['VLR ADICIONAL']}">${formatarMoeda(item["VLR ADICIONAL"])}</td>` : ''}
                            ${tipo === 'cache' ? `
                                <td class="${alinhamentos['VLR CAIXINHA']}">${montarCelulaCaixinha(item["VLR CAIXINHA"], item["VLR CAIXINHA PENDENTE"], linhaAjusteDestaque)}</td>
                                <td class="${alinhamentos['STATUS CX']} ${obterClasseStatus(item["STATUS CAIXINHA"])}">${item["STATUS CAIXINHA"] || '-'}</td>
                            ` : ''}
                            <td class="${alinhamentos['QTD']}">${item.QTD || ''}</td>
                            <td class="${alinhamentos['TOT DIÁRIAS']}">${formatarMoeda(item["TOT DIÁRIAS"])}</td>
                            <td class="${alinhamentos['TOT GERAL']}">${formatarMoeda(item["TOT GERAL"])}</td>
                            ${tipo === 'cache' ? `
                                <td class="${alinhamentos['CRÉDITO/DÉBITO']}" style="${parseFloat(item["CRÉDITO/DÉBITO"] || 0) < 0 ? 'color:#c0392b;' : parseFloat(item["CRÉDITO/DÉBITO"] || 0) > 0 ? 'color:#27ae60;' : ''}">${ehUltimaLinhaFuncionario ? formatarMoeda(item["CRÉDITO/DÉBITO"]) : ''}</td>
                                <td class="${alinhamentos['STATUS SOLICITAÇÃO']}">${item["STATUS SOLICITAÇÃO"] || '-'}</td>
                            ` : ''}
                            <td class="${alinhamentos['STATUS PGTO']} ${obterClasseStatus(item["STATUS PGTO"])}">${item["STATUS PGTO"] || ''}</td>
                            <td class="${alinhamentos['TOT PAGAR']}">${montarCelulaPendente('', item["STATUS PGTO"], (ehUltimaLinhaFuncionario ? (parseFloat(item["TOT PAGAR"] || 0) + parseFloat(item["CRÉDITO/DÉBITO"] || 0)) : item["TOT PAGAR"]), false)}</td>
                            <td class="${alinhamentos['STATUS COMPROVANTE']} ${obterClasseCompStatus(item["COMP STATUS"])}">${item["COMP STATUS"] || '---'}</td>
                            
                        `) : `
                            <td class="${alinhamentos['QTD']}">${item.QTD || ''}</td>
                            <td class="${alinhamentos['TOT GERAL']}">${formatarMoeda(item["TOT GERAL"])}</td>
                            <td class="${alinhamentos['STATUS PGTO']} ${obterClasseStatus(item["STATUS PGTO"])}">${item["STATUS PGTO"] || ''}</td>
                        `}
                    </tr>`;

                    // Insere separador/subtotal quando o funcionário muda ou é o último
                    if (!proximoItem || proximoItem.NOME !== item.NOME) {

                        const linhasFuncionario = dadosFechamento.filter(d => d.NOME === item.NOME);
                        const temMaisDeUmaLinha = linhasFuncionario.length > 1;

                        // Espaço em branco entre os blocos de funcionário (as molduras grossas, via
                        // .bf-ini/.bf-fim, fazem a separação). Dentro do grupo de uma empreiteira a barra
                        // lateral continua (gr-emp); ao sair/entrar num grupo o espaço é maior (sep-grupo).
                        const mesmoGrupoEmp = !!empreiteiraAtual && !!proximoItem && proximoItem.EMPREITEIRA === empreiteiraAtual;
                        const mudaGrupoEmp = (empreiteiraAtual || null) !== ((proximoItem && proximoItem.EMPREITEIRA) || null);
                        const linhaSeparador = `
                            <tr class="row-separador-funcionario${mesmoGrupoEmp ? ' gr-emp' : ''}${mudaGrupoEmp ? ' sep-grupo' : ''}">
                                <td colspan="${colunas.length}"></td>
                            </tr>`;
                        // Último do grupo da empreiteira: o TOTAL dela vem logo abaixo, sem espaço antes.
                        const fimGrupoEmpreiteira = podeVerFinanceiro && !!empreiteiraAtual && (!proximoItem || proximoItem.EMPREITEIRA !== empreiteiraAtual);

                        if (temMaisDeUmaLinha && podeVerFinanceiro) {
                            // Funcionário com múltiplas linhas → linha de SUBTOTAL + separador azul abaixo
                            linhas += `
                            <tr class="row-total bf bf-fim${podeVerFinanceiro && empreiteiraAtual ? ' gr-emp' : ''}" style="background-color: #eaeaea;">
                                <td colspan="${colspanSubtotal}" style="text-align: right; font-weight: bold;">
                                    SUBTOTAL ${item.NOME}:
                                </td>
                                ${tipo === 'cache_ajuda' ? `
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td class="text-right" style="font-weight: bold;">${formatarMoeda(subtotalFuncionario.VLR_CAIXINHA)}</td>
                                    <td class="text-right" style="font-weight: bold;">${formatarMoeda(subtotalFuncionario.TOT_DIARIAS)}</td>
                                    <td></td>
                                    <td></td>
                                    <td class="text-right" style="font-weight: bold;">${formatarMoeda(subtotalFuncionario.TOT_AJUDA)}</td>
                                    <td class="text-right" style="font-weight: bold;">${formatarMoeda(subtotalFuncionario.TOT_GERAL)}</td>
                                    <td class="text-right" style="font-weight: bold; ${subtotalFuncionario.CREDITO_DEBITO < 0 ? 'color:#c0392b;' : subtotalFuncionario.CREDITO_DEBITO > 0 ? 'color:#27ae60;' : ''}">${formatarMoeda(subtotalFuncionario.CREDITO_DEBITO)}</td>
                                    <td class="text-right" style="font-weight: bold;">${formatarMoeda(subtotalFuncionario.TOT_PAGAR + subtotalFuncionario.CREDITO_DEBITO)}</td>
                                    <td colspan="7"></td>
                                ` : tipo === 'cache' ? `
                                    <td></td>
                                    <td></td>
                                    <td class="text-right" style="font-weight: bold;">${formatarMoeda(subtotalFuncionario.VLR_CAIXINHA)}</td>
                                    <td></td>
                                    <td></td>
                                    <td class="text-right" style="font-weight: bold;">${formatarMoeda(subtotalFuncionario.TOT_DIARIAS)}</td>
                                    <td class="text-right" style="font-weight: bold;">${formatarMoeda(subtotalFuncionario.TOT_GERAL)}</td>
                                    <td class="text-right" style="font-weight: bold; ${subtotalFuncionario.CREDITO_DEBITO < 0 ? 'color:#c0392b;' : subtotalFuncionario.CREDITO_DEBITO > 0 ? 'color:#27ae60;' : ''}">${formatarMoeda(subtotalFuncionario.CREDITO_DEBITO)}</td>
                                    <td></td>
                                    <td></td>
                                    <td class="text-right" style="font-weight: bold;">${formatarMoeda(subtotalFuncionario.TOT_PAGAR + subtotalFuncionario.CREDITO_DEBITO)}</td>
                                    <td></td>
                                ` : `
                                    <td></td>
                                    <td></td>
                                    <td class="text-right" style="font-weight: bold;">${formatarMoeda(subtotalFuncionario.TOT_DIARIAS)}</td>
                                    <td class="text-right" style="font-weight: bold;">${formatarMoeda(subtotalFuncionario.TOT_GERAL)}</td>
                                    <td></td>
                                    <td class="text-right" style="font-weight: bold;">${formatarMoeda(subtotalFuncionario.TOT_PAGAR)}</td>
                                    <td></td>
                                `}
                            </tr>`;
                            // Espaço após o subtotal (não na última linha)
                            if (proximoItem && !fimGrupoEmpreiteira) linhas += linhaSeparador;
                        } else if (proximoItem && !fimGrupoEmpreiteira) {
                            // Funcionário com apenas 1 linha → só o espaço
                            linhas += linhaSeparador;
                        }

                        // Zera o acumulador para o próximo funcionário
                        subtotalFuncionario = { TOT_DIARIAS: 0, TOT_AJUDA: 0, TOT_GERAL: 0, TOT_PAGAR: 0, VLR_CAIXINHA: 0 };
                    }

                    // Fecha o grupo da empreiteira: total no nome e PIX dela. Soma o TOT GERAL
                    // (sem caixinha — caixinha continua por pessoa, fora do empreiteiro) + o
                    // Crédito/Débito de cada pessoa UMA vez (é saldo da pessoa, repetido em todas
                    // as linhas dela — ver comentário do CREDITO_DEBITO acima).
                    if (podeVerFinanceiro && empreiteiraAtual && (!proximoItem || proximoItem.EMPREITEIRA !== empreiteiraAtual)) {
                        const linhasEmpreiteira = dadosFechamento.filter(d => d.EMPREITEIRA === empreiteiraAtual);
                        const totGeralEmp = linhasEmpreiteira.reduce((s, d) => s + parseFloat(d["TOT GERAL"] || 0), 0);
                        const creditoPorPessoa = new Map();
                        linhasEmpreiteira.forEach(d => creditoPorPessoa.set(d.NOME, parseFloat(d["CRÉDITO/DÉBITO"] || 0)));
                        const creditoEmp = [...creditoPorPessoa.values()].reduce((s, v) => s + v, 0);
                        const qtdPessoasEmp = creditoPorPessoa.size;
                        linhas += `
                        <tr class="row-total row-total-empreiteira gr-emp" style="background: #e6e6e6;">
                            <td colspan="${colunas.length}" style="padding:8px; border-bottom: 2px solid var(--primary-color);">
                                <div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:6px 16px;">
                                    <span>
                                        <strong>TOTAL ${empreiteiraAtual}</strong>
                                        <span style="margin-left:8px;">PIX: <strong>${item["PIX EMPREITEIRA"] || '—'}</strong></span>
                                        <span style="margin-left:8px; color: var(--text-2);">${qtdPessoasEmp} pessoa${qtdPessoasEmp > 1 ? 's' : ''}</span>
                                    </span>
                                    <span style="display:flex; gap:16px; font-weight:bold;">
                                        <span>Tot. Geral: ${formatarMoeda(totGeralEmp)}</span>
                                        <span style="${creditoEmp < 0 ? 'color:#c0392b;' : creditoEmp > 0 ? 'color:#27ae60;' : ''}">Crédito/Débito: ${formatarMoeda(creditoEmp)}</span>
                                        <span>Total Lote de Funcionários: ${formatarMoeda(totGeralEmp + creditoEmp)}</span>
                                    </span>
                                </div>
                            </td>
                        </tr>`;
                        if (proximoItem) linhas += `
                            <tr class="row-separador-funcionario sep-grupo">
                                <td colspan="${colunas.length}"></td>
                            </tr>`;
                    }
                });

                return linhas;
            })()}

            ${podeVerFinanceiro && totaisFechamentoCache ? `
            <tr class="row-total">
                <td colspan="5" style="text-align: right; font-weight: bold;">TOTAL GERAL DO EVENTO:</td>
                
                ${tipo === 'cache_ajuda' ? `
                    <td class="text-center" style="font-weight: bold;">${totaisFechamentoCache.totalTotalQtdDiarias || ''}</td>
                    <td class="text-right" style="font-weight: bold;">-</td>
                    <td class="text-right" style="font-weight: bold;">${formatarMoeda(totaisFechamentoCache.totalTotalAdicional)}</td>
                    <td class="text-right" style="font-weight: bold;">${formatarMoeda(totaisFechamentoCache.totalTotalCaixinha)}</td>
                    <td class="text-right" style="font-weight: bold;">${formatarMoeda(totaisFechamentoCache.totalTotalDiarias)}</td>
                    <td class="text-center" style="font-weight: bold;">${totaisFechamentoCache.totalTotalQtdAjuda || ''}</td>
                    <td class="text-right" style="font-weight: bold;">-</td>
                    <td class="text-right" style="font-weight: bold;">${formatarMoeda(totaisFechamentoCache.totalTotalAjuda)}</td>
                    <td class="text-right" style="font-weight: bold;">${formatarMoeda(totaisFechamentoCache.totalTotalGeral)}</td>
                    <td></td><!-- CRÉDITO/DÉBITO: o total a pagar fica na coluna TOT PAGAR, não nesta -->
                    <td class="text-right" style="font-weight: bold;">${formatarMoeda(totaisFechamentoCache.totalTotalPagar)}</td>
                    <td colspan="7"></td>
                ` : `
                    <td class="text-right" style="font-weight: bold;">${formatarMoeda(totaisFechamentoCache.totalVlrDiarias)}</td>
                    ${tipo !== 'ajuda_custo' ? `<td class="text-right" style="font-weight: bold;">${formatarMoeda(totaisFechamentoCache.totalVlrAdicional)}</td>` : ''}
                    ${tipo === 'cache' ? `<td class="text-right" style="font-weight: bold;">${formatarMoeda(totaisFechamentoCache.totalTotalCaixinha)}</td><td></td>` : ''}
                    <td class="text-center" style="font-weight: bold;">${totaisFechamentoCache.totalTotalQtdDiarias || ''}</td>
                    <td class="text-right" style="font-weight: bold;">${formatarMoeda(totaisFechamentoCache.totalTotalDiarias)}</td>
                    <td class="text-right" style="font-weight: bold;">${formatarMoeda(totaisFechamentoCache.totalTotalGeral)}</td>
                    ${tipo === 'cache' ? '<td></td><td></td><td></td>' : '<td></td>'}
                    <td class="text-right" style="font-weight: bold;">${formatarMoeda(totaisFechamentoCache.totalTotalPagar)}</td>
                    <td></td>
                `}
            </tr>` : ''}
        </tbody>
    </table>
`;
    }

    html += `<div class="relatorio-resumo-container">`;
    if (dadosUtilizacao && dadosUtilizacao.length > 0) {
        const alinhamentosUtilizacao = { 'INFORMAÇÕES EM PROPOSTA': 'text-left', 'QTD PROFISSIONAIS': 'text-center', 'DIÁRIAS CONTRATADAS': 'text-center', 'DIÁRIAS UTILIZADAS': 'text-center', 'SALDO': 'text-right' };
        const utilizacaoAgrupada = dadosUtilizacao.reduce((acc, item) => { const nro = item.nrorcamento || 'N/A'; if (!acc[nro]) acc[nro] = []; acc[nro].push(item); return acc; }, {});
        Object.keys(utilizacaoAgrupada).filter(nro => nro !== 'N/A').forEach((nroOrcamento, index) => {
            const dadosUtilizacaoDoOrcamento = utilizacaoAgrupada[nroOrcamento] || [];
            const deveIncluirContingencia = (index === 0 && (nomeRelatorio.toUpperCase().includes('CACHÊ') || nomeRelatorio.toUpperCase().includes('AJUDA DE CUSTO')));
            html += `<div class="resumo-par-orcamento">
                <div class="tabela-resumo diarias">
                    <table class="report-table">
                        <thead>
                            <tr><th colspan="5" class="table-title-header">UTILIZAÇÃO DE DIÁRIAS (Orçamento: ${nroOrcamento})</th></tr>
                            <tr class="header-group-row"><th colspan="3" class="header-group">DIÁRIAS CONTRATADAS</th><th colspan="2" class="header-group">RESUMO DE USO</th></tr>
                            <tr><th>INFORMAÇÕES EM PROPOSTA</th><th>QTD PROFISSIONAIS</th><th>DIÁRIAS CONTRATADAS</th><th>DIÁRIAS UTILIZADAS</th><th>SALDO</th></tr>
                        </thead>
                        <tbody>${montarTabelaBody(dadosUtilizacaoDoOrcamento, alinhamentosUtilizacao)}</tbody>
                    </table>
                </div>`;
            if (deveIncluirContingencia) {
                html += `<div class="tabela-resumo contingencia">
                    ${dadosContingencia && dadosContingencia.length > 0 ? `
                        <table class="report-table">
                            <thead><tr><th colspan="3" class="table-title-header">CONTINGÊNCIA</th></tr><tr><th>Profissional</th><th>Informação</th><th>Observação</th></tr></thead>
                            <tbody>${montarTabelaBody(dadosContingencia, { 'Profissional': 'text-left', 'Informacao': 'text-left', 'Observacao': 'text-left' })}</tbody>
                       
                        </table>` : `<p>Nenhum dado de contingência.</p>`}
                </div>`;
            }
            html += `</div>`;
        });
    }
    html += `</div></div>`; 
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

            if (['SALDO', 'DIÁRIAS CONTRATADAS', 'DIÁRIAS UTILIZADAS'].includes(col) && typeof valorCelula === 'number') {
                // formatação numérica se necessário
            }

            // ✅ ADICIONE APENAS ESTE BLOCO:
            if (col === 'Observacao' && valorCelula) {
                valorCelula = valorCelula
                    .replace(/[\r\n]+/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim()
                    .replace(/(\[\d{2}\/\d{2},\s*\d{2}:\d{2}\])/g, '<br>$1')
                    .replace(/^<br>/, '');

                html += `<td class="${alignClass}" style="white-space: normal; vertical-align: top;">${valorCelula}</td>`;
                return; // pula o html += padrão abaixo
            }

            html += `<td class="${alignClass}">${valorCelula || ''}</td>`;
        });
        html += `</tr>`;
    });
    return html;
}


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

// ===== Pagamentos a Empreiteiras =====
// Consulta rápida dos ciclos pagos/em aberto de cada empreiteira (freelancers pagos via
// fornecedor, ver utils/cicloFornecedor.js). Só leitura: trocar/remover anexo e estornar ficam no
// CONFERIR do Vencimentos. O período é a data do PAGAMENTO (ciclo), não a do evento.
let empreiteirasCarregadas = false;

let lotesCarregados = false;
let lotesIndisponiveis = false;
let filtrosVieramDosCiclos = false;

function estaNaTelaDeEmpreiteiras() {
    return document.querySelector('input[name="reportType"]:checked')?.value === 'empreiteiras';
}

const usuarioPodeVerFornecedores = () =>
    !(typeof window.temFlag === 'function' && !window.temFlag('financeiro', 'master', 'supremo', 'devs'));

// Empreiteira / Lote de Funcionários: lista de fornecedores categoria empreiteira da empresa.
// Alimenta o filtro do Fechamento (quem é pago via lote) e o do relatório de pagamentos. Só quem
// tem flag financeiro/master/supremo/devs enxerga (a rota recusa os demais com um 403 que abriria
// um aviso de "Acesso negado" na cara do usuário), então nesse caso o filtro simplesmente some.
async function carregarLotes() {
    if (lotesCarregados || lotesIndisponiveis) return;
    if (!usuarioPodeVerFornecedores()) { lotesIndisponiveis = true; return; }
    try {
        const lista = await fetchComToken('/relatorios/empreiteiras/lista');
        const sel = document.getElementById('empreiteiraSelect');
        (Array.isArray(lista) ? lista : []).forEach(f => {
            const opt = document.createElement('option');
            opt.value = f.idfornecedor;
            opt.textContent = f.nmfantasia;
            sel.appendChild(opt);
        });
        lotesCarregados = true;
    } catch (e) {
        console.error('Erro ao carregar empreiteiras:', e);
    }
}

function limparSaidaRelatorio() {
    marcarRelatorioPronto(false);
    relatorioAtual = null;
    previaImpressao = false;
    const preview = document.getElementById('previewRelatorio');
    if (preview) { preview.removeAttribute('srcdoc'); preview.style.display = 'none'; }
    const saida = document.getElementById('reportOutput');
    if (saida) saida.innerHTML = '';
    const aviso = document.getElementById('avisoRelatorio');
    if (aviso) { aviso.style.display = 'none'; aviso.textContent = ''; }
    const caixa = document.getElementById('colunasBox');
    if (caixa) caixa.style.display = 'none';
    const btnPrev = document.getElementById('btnPreviaImpressao');
    if (btnPrev) btnPrev.setAttribute('aria-pressed', 'false');
    ['printButton', 'xlsButton'].forEach(id => { const b = document.getElementById(id); if (b) b.style.display = 'none'; });
}

async function alternarFiltrosEmpreiteira() {
    const tipoAtual = document.querySelector('input[name="reportType"]:checked')?.value;
    const ehEmpreiteiras = tipoAtual === 'empreiteiras';
    const financeiro = !!tipoAtual && tipoAtual !== 'operacional';
    const mostrar = (el, sim) => { if (el) el.style.display = sim ? '' : 'none'; };

    // Evento e Cliente valem para todos os tipos (no de empreiteiras filtram o que cada pagamento
    // tem daquele evento/cliente). Equipe e Fase só fazem sentido no Fechamento.
    ['.Equipes', '#fsFasesEvento'].forEach(sel => {
        document.querySelectorAll(`#Relatorios ${sel}`).forEach(el => mostrar(el, !ehEmpreiteiras));
    });
    mostrar(document.getElementById('filtroSituacaoEmp'), ehEmpreiteiras);
    mostrar(document.getElementById('filtroLote'), financeiro && !lotesIndisponiveis && usuarioPodeVerFornecedores());
    // "Sem empreiteira (staff direto)" só existe no Fechamento.
    const optSem = document.getElementById('optSemEmpreiteira');
    const selLote = document.getElementById('empreiteiraSelect');
    if (optSem) optSem.hidden = ehEmpreiteiras;
    if (ehEmpreiteiras && selLote && selLote.value === '__sem') selLote.value = '';

    limparSaidaRelatorio();

    // Saindo do relatório de pagamentos: Evento/Cliente voltam a listar o período (data do evento),
    // e não os eventos que tinham pagamento (que foi o que o relatório de empreiteiras colocou ali).
    if (!ehEmpreiteiras && filtrosVieramDosCiclos) {
        filtrosVieramDosCiclos = false;
        await preencherEventosPeriodo();
    }

    if (financeiro) await carregarLotes();
    mostrar(document.getElementById('filtroLote'), financeiro && !lotesIndisponiveis && usuarioPodeVerFornecedores());

    if (!ehEmpreiteiras) return;

    // Período padrão da tela é "hoje a hoje", que não faz sentido pra pagamento de ciclo —
    // abre no ano corrente inteiro (o usuário ajusta se quiser).
    const ini = document.getElementById('reportStartDate');
    const fim = document.getElementById('reportEndDate');
    if (ini && fim && ini.value === fim.value) {
        const ano = new Date().getFullYear();
        ini.value = `${ano}-01-01`;
        fim.value = `${ano}-12-31`;
    }
}

// Depois de gerar, Evento e Cliente passam a listar o que realmente tem pagamento no período
// (a lista normal vem da data de realização do evento, que pode não coincidir com a do ciclo).
function popularFiltrosPelosCiclos(ciclos) {
    const eventos = new Map();
    const clientes = new Map();
    ciclos.forEach(c => c.pessoas.forEach(p => {
        if (p.idevento) eventos.set(String(p.idevento), p.nmevento || `Evento ${p.idevento}`);
        if (p.idcliente) clientes.set(String(p.idcliente), p.nmcliente || `Cliente ${p.idcliente}`);
    }));
    const preencher = (sel, mapa, rotuloTodos) => {
        if (!sel) return;
        const atual = sel.value;
        sel.innerHTML = `<option value="">${rotuloTodos}</option>`;
        [...mapa.entries()].sort((a, b) => a[1].localeCompare(b[1])).forEach(([id, nome]) => {
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = nome;
            sel.appendChild(opt);
        });
        if (mapa.has(atual)) sel.value = atual;
    };
    preencher(document.getElementById('eventSelect'), eventos, 'Todos os Eventos');
    preencher(document.getElementById('clientSelect'), clientes, 'Todos os Clientes');
    filtrosVieramDosCiclos = true;
}

function filtroAtualEmpreiteiras() {
    const idevento = document.getElementById('eventSelect')?.value || '';
    const idcliente = document.getElementById('clientSelect')?.value || '';
    return { idevento, idcliente };
}

async function gerarRelatorioEmpreiteiras() {
    const dataInicio = document.getElementById('reportStartDate').value;
    const dataFim = document.getElementById('reportEndDate').value;
    const idfornecedor = document.getElementById('empreiteiraSelect').value;
    const situacao = document.getElementById('situacaoEmpreiteiraSelect').value;
    const saida = document.getElementById('reportOutput');

    if (!dataInicio || !dataFim) {
        return Swal.fire({ icon: 'warning', title: 'Período obrigatório', text: 'Informe a data de início e a de término do pagamento.' });
    }
    if (dataInicio > dataFim) {
        return Swal.fire({ icon: 'warning', title: 'Período inválido', text: 'A data de início não pode ser depois da data de término.' });
    }

    limparSaidaRelatorio();
    saida.innerHTML = '<p>Carregando pagamentos...</p>';
    let ciclos = [];
    try {
        const qs = new URLSearchParams({ dataInicio, dataFim, situacao });
        if (idfornecedor) qs.set('idfornecedor', idfornecedor);
        const resp = await fetchComToken(`/relatorios/empreiteiras?${qs.toString()}`);
        ciclos = resp?.ciclos || [];
    } catch (e) {
        saida.innerHTML = '';
        return Swal.fire({ icon: 'error', title: 'Erro', text: e.corpo?.erro || 'Não foi possível carregar os pagamentos.' });
    }

    if (!ciclos.length) {
        saida.innerHTML = '<p>Nenhum pagamento de empreiteira nesse período e filtro.</p>';
        return;
    }

    window._relatorioEmpreiteiras = { ciclos, dataInicio, dataFim, situacao };
    relatorioAtual = { tipo: 'empreiteiras' };
    popularFiltrosPelosCiclos(ciclos);
    renderizarEmpreiteiras();
    const btnImprimir = document.getElementById('printButton');
    if (btnImprimir) btnImprimir.style.display = '';
    marcarRelatorioPronto(true);
    expandirTelaRelatorios(true);
}

// Desenha (ou redesenha, ao trocar Evento/Cliente) os pagamentos já carregados, sem nova consulta.
function renderizarEmpreiteiras() {
    const dados = window._relatorioEmpreiteiras;
    const saida = document.getElementById('reportOutput');
    if (!dados || !saida) return;

    const filtro = filtroAtualEmpreiteiras();
    const filtroAtivo = !!(filtro.idevento || filtro.idcliente);
    const html = montarRelatorioEmpreiteirasHtml(dados.ciclos, { expandido: filtroAtivo, dataInicio: dados.dataInicio, dataFim: dados.dataFim, filtro });
    saida.innerHTML = html || '<p>Nenhum pagamento desse evento/cliente nesse período e filtro.</p>';

    saida.querySelectorAll('.rel-emp-ciclo').forEach(tr => {
        const alternar = () => {
            const det = saida.querySelector(`#${tr.dataset.detalhe}`);
            const abrir = tr.getAttribute('aria-expanded') !== 'true';
            tr.setAttribute('aria-expanded', abrir);
            if (det) det.style.display = abrir ? '' : 'none';
        };
        tr.addEventListener('click', alternar);
        tr.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); alternar(); } });
    });
    saida.querySelector('#btnImprimirEmpreiteiras')?.addEventListener('click', imprimirEmpreiteirasAtual);
}

function imprimirEmpreiteirasAtual() {
    const d = window._relatorioEmpreiteiras;
    if (!d) return;
    imprimirRelatorio(montarRelatorioEmpreiteirasHtml(d.ciclos, {
        expandido: true, impressao: true, dataInicio: d.dataInicio, dataFim: d.dataFim, filtro: filtroAtualEmpreiteiras()
    }));
}

// `expandido`: detalhe (evento → pessoa) já aberto — usado na impressão, que não tem clique.
// `filtro` (idevento/idcliente): só aparecem os pagamentos que têm pessoas daquele evento/cliente, o
// detalhe mostra só essas pessoas e ganha a coluna "Do evento"/"Do cliente" com a parte do filtro
// dentro de cada pagamento. Situação, Pago e Total continuam do ciclo inteiro (NF e comprovante
// também valem para o ciclo todo). Crédito/Débito aparece sempre no ciclo onde está, marcado quando
// a origem é de outro evento/cliente — e nesse caso não entra na coluna do filtro.
function montarRelatorioEmpreiteirasHtml(ciclos, { expandido = false, impressao = false, dataInicio, dataFim, filtro = {} } = {}) {
    const brl = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const dataBR = (iso) => iso ? iso.split('-').reverse().join('/') : '---';
    const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
    const corSituacao = (st) => st === 'Pago' ? 'rel-emp-pago' : st === 'Parcial' ? 'rel-emp-parcial' : 'rel-emp-aberto';
    const linkAnexo = (url, rotulo) => url
        ? (impressao ? `<span>${rotulo}</span>` : `<a href="${esc(url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">${rotulo}</a>`)
        : '<span class="rel-emp-vazio">—</span>';
    const celulaCreditoDebito = (v) => v === 0
        ? '<span class="rel-emp-vazio">—</span>'
        : `<span style="color:${v < 0 ? '#c0392b' : '#27ae60'};">${brl(v)}</span>`;

    const idEvento = String(filtro.idevento || '');
    const idCliente = String(filtro.idcliente || '');
    const filtroAtivo = !!(idEvento || idCliente);
    const rotuloFiltro = idEvento ? 'Do evento' : 'Do cliente';
    const pessoaNoFiltro = (p) => (!idEvento || String(p.idevento) === idEvento) && (!idCliente || String(p.idcliente) === idCliente);
    const ajusteForaDoFiltro = (a) => idEvento ? String(a.idevento_origem) !== idEvento : (idCliente ? String(a.idcliente_origem) !== idCliente : false);
    const somaAjustes = (lista) => lista.reduce((s, a) => s + (a.sinal || (a.tipo === 'Credito' ? 1 : -1)) * (Number(a.valor) || 0), 0);

    // Só os pagamentos que têm gente do filtro; os totais abaixo somam apenas esses.
    const visiveis = ciclos
        .map(c => ({ c, pf: filtroAtivo ? c.pessoas.filter(pessoaNoFiltro) : c.pessoas }))
        .filter(x => x.pf.length > 0);
    if (!visiveis.length) return '';

    const nCols = filtroAtivo ? 11 : 10;
    const porFornecedor = new Map();
    visiveis.forEach(x => {
        if (!porFornecedor.has(x.c.idfornecedor)) porFornecedor.set(x.c.idfornecedor, []);
        porFornecedor.get(x.c.idfornecedor).push(x);
    });

    const sel = (c, pf) => sum2(pf, p => p.total) + somaAjustes(c.ajustes.filter(a => !ajusteForaDoFiltro(a)));
    const sum2 = (l, f) => l.reduce((s, x) => s + (Number(f(x)) || 0), 0);

    const totalGeral = sum2(visiveis, x => x.c.total);
    const pagoGeral = sum2(visiveis, x => x.c.pago);
    const creditoGeral = sum2(visiveis, x => somaAjustes(x.c.ajustes));
    const selGeral = sum2(visiveis, x => sel(x.c, x.pf));
    let linhas = '';
    let idx = 0;

    porFornecedor.forEach((lista) => {
        const f = lista[0].c;
        const regra = f.tipopgto === 'INTERVALO' ? `a cada ${f.intervalodias} dias` : f.tipopgto === 'MENSAL' ? `todo dia ${f.diamespgto}` : 'por evento';
        linhas += `<tr class="rel-emp-grupo"><td colspan="${nCols}"><strong>${esc(f.nmfantasia)}</strong> · PIX ${esc(f.pix || '—')} · ${regra} · ${f.envianf ? 'emite NF' : 'não emite NF (listagem)'}</td></tr>`;

        lista.sort((a, b) => a.c.dtciclo.localeCompare(b.c.dtciclo)).forEach(({ c, pf }) => {
            const idDet = `rel-emp-det-${idx++}`;
            const periodo = c.dtinicio ? `${dataBR(c.dtinicio).slice(0, 5)} a ${dataBR(c.dtciclo).slice(0, 5)}` : 'por evento';
            const nomesEventos = [...new Map(c.pessoas.map(p => [String(p.idevento), p.nmevento])).entries()];
            const colEventos = nomesEventos.map(([id, nome]) => idEvento && id === idEvento ? `<strong>${esc(nome)}</strong>` : esc(nome)).join('<br>');
            linhas += `<tr class="rel-emp-ciclo" data-detalhe="${idDet}" tabindex="0" aria-expanded="${expandido}">
                <td>${impressao ? '' : '<span class="rel-emp-seta">▶</span> '}<strong>${dataBR(c.dtciclo)}</strong></td>
                <td class="text-center">${periodo}</td>
                <td class="text-left">${colEventos}</td>
                <td class="text-center">${c.qtdPessoas}</td>
                <td class="text-center"><span class="rel-emp-situacao ${corSituacao(c.status)}">${c.status === 'Pendente' ? 'Em aberto' : c.status}</span></td>
                <td class="text-center">${linkAnexo(c.notafiscal, c.envianf ? 'Ver NF' : 'Ver Listagem')}</td>
                <td class="text-right">${celulaCreditoDebito(somaAjustes(c.ajustes))}</td>
                <td class="text-right">${brl(c.pago)}</td>
                <td class="text-right">${brl(c.total)}</td>
                ${filtroAtivo ? `<td class="text-right rel-emp-sel"><strong>${brl(sel(c, pf))}</strong></td>` : ''}
                <td class="text-center">${linkAnexo(c.comprovante, 'Ver Comp.')}</td>
            </tr>`;

            // Detalhe: evento → pessoa, e crédito/débito do ciclo
            const porEvento = new Map();
            pf.forEach(p => {
                if (!porEvento.has(p.idevento)) porEvento.set(p.idevento, { nome: p.nmevento, pessoas: [] });
                porEvento.get(p.idevento).pessoas.push(p);
            });
            let det = `<table class="report-table rel-emp-det-tabela"><thead><tr>
                <th>Freelancer</th><th>Função</th><th class="text-center">Diárias</th><th class="text-right">Cachê</th>
                <th class="text-right">Ajuda</th><th class="text-center">Situação</th><th class="text-right">Total</th></tr></thead><tbody>`;
            porEvento.forEach(ev => {
                det += `<tr class="rel-emp-evento"><td colspan="7">${esc(ev.nome)}</td></tr>`;
                ev.pessoas.forEach(p => {
                    const sit = p.quitado ? 'Pago' : p.pendente ? 'Aguardando autorização' : p.suspenso ? 'Suspenso' : 'Em aberto';
                    det += `<tr><td>${esc(p.nome)}</td><td>${esc(p.funcao)}</td><td class="text-center">${p.qtddiarias}</td>
                        <td class="text-right">${brl(p.cache)}</td><td class="text-right">${brl(p.ajuda)}</td>
                        <td class="text-center">${sit}</td><td class="text-right">${brl(p.total)}</td></tr>`;
                });
            });
            (c.ajustes || []).forEach(a => {
                const fora = filtroAtivo && ajusteForaDoFiltro(a);
                const nota = fora
                    ? ` <em class="rel-emp-nota-fora">· origem: ${esc(a.nmevento_origem || 'outro evento')} (outro ${idEvento ? 'evento' : 'cliente'}; não entra em "${rotuloFiltro}")</em>`
                    : '';
                det += `<tr class="${fora ? 'rel-emp-fora' : ''}"><td>${esc(a.nome)}</td><td colspan="4">${a.tipo === 'Credito' ? 'Crédito' : 'Débito'} · ${esc(a.justificativa || '')}${nota}</td>
                    <td class="text-center">${a.status === 'Pago' ? 'Pago' : 'Em aberto'}</td>
                    <td class="text-right">${a.tipo === 'Credito' ? '' : '-'}${brl(a.valor)}</td></tr>`;
            });
            det += '</tbody></table>';
            linhas += `<tr class="rel-emp-detalhe" id="${idDet}" style="${expandido ? '' : 'display:none;'}"><td colspan="${nCols}">${det}</td></tr>`;
        });

        const tot = sum2(lista, x => x.c.total);
        const pago = sum2(lista, x => x.c.pago);
        const cred = sum2(lista, x => somaAjustes(x.c.ajustes));
        const selForn = sum2(lista, x => sel(x.c, x.pf));
        linhas += `<tr class="rel-emp-total"><td colspan="6" class="text-right">TOTAL ${esc(f.nmfantasia.toUpperCase())}</td>
            <td class="text-right">${celulaCreditoDebito(cred)}</td><td class="text-right">${brl(pago)}</td><td class="text-right">${brl(tot)}</td>
            ${filtroAtivo ? `<td class="text-right">${brl(selForn)}</td>` : ''}<td></td></tr>`;
    });

    linhas += `<tr class="rel-emp-total-geral"><td colspan="6" class="text-right">TOTAL GERAL</td>
        <td class="text-right">${celulaCreditoDebito(creditoGeral)}</td><td class="text-right">${brl(pagoGeral)}</td><td class="text-right">${brl(totalGeral)}</td>
        ${filtroAtivo ? `<td class="text-right">${brl(selGeral)}</td>` : ''}<td></td></tr>`;

    // Impressão roda num iframe sem o CSS da tela (ver imprimirRelatorio) — leva o próprio estilo.
    const estiloImpressao = impressao ? `<style>
        .rel-emp-cabecalho{display:flex;justify-content:space-between;margin:6px 0 10px}
        .rel-emp-cabecalho span{display:block;font-size:12px;color:#555}
        .rel-emp-resumo{display:flex;gap:24px;margin-bottom:10px;font-size:12px}
        .rel-emp-resumo span{display:block;color:#555}
        .rel-emp-grupo td{background:#e6e6e6;font-size:13px;border-left:4px solid #c8102e}
        .rel-emp-total td{font-weight:bold;background:#f4dadd}
        .rel-emp-total-geral td{font-weight:bold;background:#d8d8d8}
        .rel-emp-evento td{font-weight:bold;background:#f2f2f2}
        .rel-emp-detalhe > td{padding:4px 4px 10px 24px}
        .rel-emp-vazio{color:#999}
        .rel-emp-sel{background:#fff9d6}
        .rel-emp-fora{opacity:.65}
        .rel-emp-nota-fora{color:#b36b00}
    </style>` : '';

    return `
    <div class="relatorio-evento rel-emp">
        ${estiloImpressao}
        ${impressao ? `<div class="print-header-top">
            <img src="${empresaLogoPath}" alt="Logo Empresa" class="logo-ja">
            <div class="header-title-container"><h1 class="header-title">Pagamentos Empreiteira / Lote Funcionários</h1></div>
        </div>` : ''}
        <div class="rel-emp-cabecalho">
            <div>
                <strong>Pagamentos Empreiteira / Lote Funcionários</strong>
                <span>Pagamentos de ${dataBR(dataInicio)} a ${dataBR(dataFim)}</span>
            </div>
            ${impressao ? '' : '<button type="button" id="btnImprimirEmpreiteiras" class="rel-emp-btn">Imprimir</button>'}
        </div>
        <div class="rel-emp-resumo">
            <div><span>Ciclos</span><strong>${visiveis.length}</strong></div>
            <div><span>Pago</span><strong class="rel-emp-pago-txt">${brl(pagoGeral)}</strong></div>
            <div><span>Em aberto</span><strong class="rel-emp-aberto-txt">${brl(totalGeral - pagoGeral)}</strong></div>
            <div><span>Total</span><strong>${brl(totalGeral)}</strong></div>
            ${filtroAtivo ? `<div><span>${rotuloFiltro}</span><strong>${brl(selGeral)}</strong></div>` : ''}
        </div>
        <div class="rel-emp-rolagem">
            <table class="report-table">
                <thead><tr>
                    <th>Pagamento</th><th class="text-center">Período coberto</th><th class="text-center">Eventos</th>
                    <th class="text-center">Pessoas</th><th class="text-center">Situação</th><th class="text-center">NF / Listagem</th>
                    <th class="text-right">Crédito / Débito</th><th class="text-right">Pago</th><th class="text-right">Total do ciclo</th>
                    ${filtroAtivo ? `<th class="text-right rel-emp-sel">${rotuloFiltro}</th>` : ''}
                    <th class="text-center">Comprovante</th>
                </tr></thead>
                <tbody>${linhas}</tbody>
            </table>
        </div>
        ${filtroAtivo ? `<p class="rel-emp-dica">NF e comprovante valem para o ciclo inteiro. A coluna "${rotuloFiltro}" mostra só a parte do filtro dentro de cada pagamento.</p>` : ''}
        ${impressao ? '' : '<p class="rel-emp-dica">Clique num pagamento para ver os eventos e as pessoas. Para trocar ou remover anexos, ou estornar, use o CONFERIR em Vencimentos.</p>'}
    </div>`;
}

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

    // Pagamentos a Empreiteiras tem fluxo próprio (outra rota, sem evento/fase/cliente, mostrado
    // na própria tela em vez de ir direto pra impressão) — ver gerarRelatorioEmpreiteiras.
    if (tipo === 'empreiteiras') {
        try { await gerarRelatorioEmpreiteiras(); }
        finally { gerarRelatorioBtn.disabled = false; }
        return;
    }
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
            const labelText = input ? input.closest('label').querySelector('.checkbox__textwrapper, span').textContent.trim() : `ID ${value}`;
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
            const textWrapper = labelElement.querySelector('.checkbox__textwrapper, span');            
           
            nomeRelatorio = textWrapper ? textWrapper.textContent.trim() : 'Relatório Desconhecido';            
            console.log("Nome do Relatório:", nomeRelatorio);            
        }
    }

  //  const eventoId = document.getElementById('eventSelect').value;
  //  const clienteId = document.getElementById('clientSelect').value;

    //const eventoId = eventSelectElement ? eventSelectElement.value : null; // CORREÇÃO AQUI!
    let clienteId = document.getElementById('clientSelect').value;

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

    // Evento com mais de um cliente: escolher um ou imprimir todos (ver resolverClientesDoEvento).
    const resolucaoCliente = await resolverClientesDoEvento(eventoSelecionado, clienteId);
    if (!resolucaoCliente.ok) {
        gerarRelatorioBtn.disabled = false;
        return;
    }
    clienteId = resolucaoCliente.clienteId;
    limparSaidaRelatorio();

    try {
        //console.log("EVENTO FILTER FINAL ENVIADO", eventoFilter, dataFinalInicio, dataFinalFim);
        console.log("EVENTO FILTER FINAL ENVIADO", tipo, dataFinalInicio, dataFinalFim, eventoId, clienteId, equipeId, incluirPendentes,incluirPagos);
      
       const url = `/relatorios?tipo=${tipo}&dataInicio=${dataFinalInicio}&dataFim=${dataFinalFim}&evento=${eventoId}&cliente=${clienteId}&equipe=${equipeId}&pendentes=${incluirPendentes}&pagos=${incluirPagos}&fornecedor=${encodeURIComponent(document.getElementById('empreiteiraSelect')?.value || '')}`;
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

        // O topo do relatório lista TODOS os clientes que aparecem nas linhas do evento (antes ficava
        // só o do primeiro registro, e um evento com mais de um cliente saía sob o nome de um só).
        Object.values(dadosAgrupadosPorEvento).forEach(g => {
            const nomes = [...new Set((g.fechamentoCache || []).map(i => i.nomeCliente).filter(Boolean))].sort();
            if (nomes.length) g.nomeCliente = nomes.join(' / ');
        });

        // O relatório aparece na própria tela (com as colunas desmarcáveis); Imprimir e Excel são
        // botões da barra e respeitam as colunas ocultas.
        const eventosOrdenados = Object.values(dadosAgrupadosPorEvento).sort((a, b) => {
            return a.nomeEvento.localeCompare(b.nomeEvento);
        });
        let relatorioHtmlCompleto = '';
        eventosOrdenados.forEach(evento => {
            const eventoIdParaTotal = evento.fechamentoCache.length > 0 ? evento.fechamentoCache[0].idevento : null;
            const totaisDoEventoAtual = eventoIdParaTotal && dados.fechamentoCacheTotaisPorEvento ?
                (dados.fechamentoCacheTotaisPorEvento[eventoIdParaTotal] || { totalVlrDiarias: 0, totalQtdDiarias: 0, totalVlrAdicional: 0, totalTotalCaixinha: 0, totalTotalDiarias: 0, totalTotalGeral: 0, totalTotalPagar: 0 }) :
                { totalVlrDiarias: 0, totalQtdDiarias: 0, totalVlrAdicional: 0, totalTotalCaixinha: 0, totalTotalDiarias: 0, totalTotalGeral: 0, totalTotalPagar: 0 };
            relatorioHtmlCompleto += montarRelatorioHtmlEvento(
                evento.fechamentoCache,
                evento.nomeEvento,
                nomeRelatorio,
                evento.nomeCliente,
                evento.utilizacaoDiarias,
                evento.contingencia,
                totaisDoEventoAtual,
                filtroFaseDisplay,
                podeVerFinanceiro,
                tipo
            );
        });

        relatorioAtual = { tipo, nomeRelatorio, html: relatorioHtmlCompleto, dadosAgrupadosPorEvento };
        await mostrarRelatorioNaTela();

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

    // Documento novo a cada impressão (os mesmos estilos servem à prévia na tela).
    iframeDoc.open();
    iframeDoc.write(montarDocumentoRelatorio(conteudoRelatorio));
    iframeDoc.close();

    // Pequeno atraso para garantir que o iframe renderizou o conteúdo
    setTimeout(() => {
        printIframe.contentWindow.focus();
        printIframe.contentWindow.print();
    }, 500);
}

// CSS do relatório: o mesmo para a impressão e para a prévia na tela, assim a tela é idêntica ao papel.
// O iframe não herda o CSS da página, então as variáveis que o HTML do relatório usa são definidas aqui.
function estilosRelatorio() {
    let primaria = '#c8102e';
    try {
        const v = getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim();
        if (v) primaria = v;
    } catch (e) { /* mantém o padrão */ }
    const variaveis = `:root{--primary-color:${primaria};--surface-3:#e6e6e6;--on-brand:#ffffff;--on-brand-escuro:#1a1a1a;--text-2:#555555;--text-3:#888888;}\n`;
    return variaveis + `
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

        .status-doc-ok { color: green !important; font-weight: bold;}      /* Verde */
        .status-doc-alerta { color: orange !important; font-weight: bold;}  /* Laranja */
        .status-doc-erro { color: red !important; font-weight: bold;}    /* Vermelho */
        .status-doc-isento { color: #6c757d !important; font-weight: bold;}  /* Cinza */

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
    ` + `
        /* Moldura grossa em volta de cada funcionário (linhas + subtotal); o espaço em branco entre
           os blocos fica sem borda. gr-emp = barra lateral contínua do grupo da empreiteira. */
        .report-table tr.bf td:first-child { border-left: 3px solid #000; }
        .report-table tr.bf td:last-child { border-right: 3px solid #000; }
        .report-table tr.bf-ini td { border-top: 3px solid #000; }
        .report-table tr.bf-fim td { border-bottom: 3px solid #000; }
        .report-table tr.row-separador-funcionario td { height: 9px; padding: 0; background: #fff; border: 0; font-size: 0; }
        .report-table tr.row-separador-funcionario.sep-grupo td { height: 18px; }
        .report-table tr.gr-emp td:first-child { border-left: 5px solid var(--primary-color); }
        /* Só na prévia da tela: coluna/bloco que NÃO sai na impressão fica esmaecido. */
        .col-oculta { opacity: .32; background-image: repeating-linear-gradient(135deg, transparent 0 5px, rgba(0,0,0,.06) 5px 6px); }
        .bloco-oculto { opacity: .32; }
        .tag-oculta { display: block; font-size: 7px; font-weight: 400; font-style: italic; text-transform: none; }
        /* Utilização de Diárias + Contingência dividem a linha (antes 50% + 50% + 20px de espaço passava
           da largura e criava rolagem horizontal). */
        .resumo-par-orcamento > .tabela-resumo { flex: 1 1 0; width: auto !important; min-width: 0; box-sizing: border-box; }
    `;
}


// =====================================================================================
// TELA DO FECHAMENTO DE STAFF (pílula Relatórios): relatório na própria tela, colunas ocultáveis
// =====================================================================================

// Nomes das colunas da tabela principal (os mesmos rótulos do cabeçalho), na ordem em que saem.
function nomesDasColunas(raiz) {
    const tabela = raiz.querySelector('.relatorio-evento > table.report-table');
    if (!tabela) return [];
    return Array.from(tabela.querySelectorAll('thead tr:first-child > th')).map(th => th.textContent.trim());
}

// Esconde colunas/blocos que o usuário desmarcou. Trabalha sobre a tabela já pronta (e não no código
// que a monta) porque as linhas de SUBTOTAL, TOTAL e FORNECEDOR têm células de largura fixa
// (colspan); aqui cada célula é posicionada pelo índice da coluna e as de colspan encolhem.
//  modo 'marcar'  → só esmaece (tela): a coluna continua visível, com um aviso no cabeçalho.
//  modo 'remover' → tira de verdade (impressão/Excel).
function aplicarColunasOcultas(raiz, ocultas, modo) {
    const ocultasSet = new Set(ocultas || []);
    if (!ocultasSet.size) return;

    raiz.querySelectorAll('.relatorio-evento').forEach(ev => {
        const tabela = Array.from(ev.children).find(el => el.matches && el.matches('table.report-table'));
        if (tabela) {
            const cabecalho = tabela.querySelector('thead tr');
            const nomes = Array.from(cabecalho.children).map(th => th.textContent.trim());
            const indices = new Set();
            nomes.forEach((nome, i) => { if (ocultasSet.has(nome)) indices.add(i); });

            if (indices.size) {
                tabela.querySelectorAll('tr').forEach(tr => {
                    let coluna = 0;
                    Array.from(tr.children).forEach(cel => {
                        const span = cel.colSpan || 1;
                        if (span === 1) {
                            if (indices.has(coluna)) {
                                if (modo === 'remover') cel.remove();
                                else cel.classList.add('col-oculta');
                            }
                        } else if (modo === 'remover') {
                            let escondidas = 0;
                            for (let k = coluna; k < coluna + span; k++) if (indices.has(k)) escondidas++;
                            if (escondidas) {
                                const novo = span - escondidas;
                                if (novo > 0) cel.colSpan = novo; else cel.remove();
                            }
                        }
                        coluna += span;
                    });
                });
                if (modo === 'marcar') {
                    cabecalho.querySelectorAll('th.col-oculta').forEach(th => {
                        th.insertAdjacentHTML('beforeend', '<span class="tag-oculta">oculta na impressão</span>');
                    });
                }
            }
        }

        // Blocos Utilização de Diárias / Contingência
        [[BLOCO_UTIL, '.tabela-resumo.diarias'], [BLOCO_CONT, '.tabela-resumo.contingencia']].forEach(([chave, seletor]) => {
            if (!ocultasSet.has(chave)) return;
            ev.querySelectorAll(seletor).forEach(bloco => {
                if (modo === 'remover') { bloco.remove(); return; }
                bloco.classList.add('bloco-oculto');
                const titulo = bloco.querySelector('th.table-title-header');
                if (titulo) titulo.insertAdjacentHTML('beforeend', '<span class="tag-oculta">oculta na impressão</span>');
            });
        });
        if (modo === 'remover') {
            ev.querySelectorAll('.resumo-par-orcamento').forEach(par => { if (!par.children.length) par.remove(); });
            ev.querySelectorAll('.relatorio-resumo-container').forEach(c => { if (!c.children.length) c.remove(); });
        }
    });
}

function montarDocumentoRelatorio(corpo, paraTela = false) {
    const extraTela = paraTela ? 'body{min-width:1500px;padding:12px;box-sizing:border-box}' : '';
    return `<!doctype html><html><head><meta charset="utf-8"><style>${estilosRelatorio()}${extraTela}</style></head><body>${corpo}</body></html>`;
}

async function carregarPreferenciaColunas(tipo) {
    try {
        const resp = await fetchComToken(`/relatorios/preferencias?tipo=${encodeURIComponent(tipo)}`);
        return Array.isArray(resp?.ocultas) ? resp.ocultas : [];
    } catch (e) {
        console.warn('Não foi possível ler as colunas ocultas salvas:', e);
        return [];
    }
}

async function salvarPreferenciaColunas(tipo, ocultas) {
    try {
        await fetchComToken('/relatorios/preferencias', { method: 'PUT', body: { tipo, ocultas } });
    } catch (e) {
        console.warn('Não foi possível salvar as colunas ocultas:', e);
    }
}

function renderizarPreviaRelatorio() {
    if (!relatorioAtual || !relatorioAtual.html) return;
    const raiz = document.createElement('div');
    raiz.innerHTML = relatorioAtual.html;
    aplicarColunasOcultas(raiz, ocultasAtuais, previaImpressao ? 'remover' : 'marcar');

    const iframe = document.getElementById('previewRelatorio');
    const ajustarAltura = () => {
        try {
            const doc = iframe.contentDocument;
            if (!doc || !doc.documentElement || !doc.body) return;
            // Cabe na largura da tela: se o conteúdo passar da janela do iframe, reduz o zoom da prévia
            // na proporção (a impressão não é afetada — ela usa o documento do #printIframe).
            doc.body.style.zoom = '';
            const largura = doc.documentElement.scrollWidth;
            const visivel = iframe.clientWidth;
            if (visivel > 0 && largura > visivel + 1) doc.body.style.zoom = String(Math.max(0.4, visivel / largura).toFixed(3));
            iframe.style.height = `${doc.documentElement.scrollHeight + 24}px`;
        } catch (e) { /* mesmo origin; só por segurança */ }
    };
    iframe.onload = () => { ajustarAltura(); setTimeout(ajustarAltura, 400); };
    if (window.relPreviaResizeListener) window.removeEventListener('resize', window.relPreviaResizeListener);
    window.relPreviaResizeListener = () => ajustarAltura();
    window.addEventListener('resize', window.relPreviaResizeListener);
    iframe.style.display = 'block';
    iframe.srcdoc = montarDocumentoRelatorio(raiz.innerHTML, true);
}

function desenharControlesColunas() {
    const caixa = document.getElementById('colunasBox');
    const lista = document.getElementById('listaColunas');
    if (!caixa || !lista || !relatorioAtual) return;

    const raiz = document.createElement('div');
    raiz.innerHTML = relatorioAtual.html;
    const nomes = nomesDasColunas(raiz);
    const temUtil = !!raiz.querySelector('.tabela-resumo.diarias');
    const temCont = !!raiz.querySelector('.tabela-resumo.contingencia');
    const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

    const item = (chave, rotulo, extra = '') => {
        const off = ocultasAtuais.includes(chave);
        return `<label class="${off ? 'off' : ''} ${extra}"><input type="checkbox" data-chave="${esc(chave)}" ${off ? '' : 'checked'}> ${extra ? 'Bloco: ' : ''}${esc(rotulo)}</label>`;
    };
    lista.innerHTML = nomes.map(n => item(n, n)).join('')
        + (temUtil ? item(BLOCO_UTIL, 'Utilização de Diárias', 'bloco') : '')
        + (temCont ? item(BLOCO_CONT, 'Contingência', 'bloco') : '');

    lista.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', () => {
            const chave = cb.dataset.chave;
            ocultasAtuais = ocultasAtuais.filter(c => c !== chave);
            if (!cb.checked) ocultasAtuais.push(chave);
            salvarPreferenciaColunas(relatorioAtual.tipo, ocultasAtuais);
            cb.closest('label').classList.toggle('off', !cb.checked);
            renderizarPreviaRelatorio();
        });
    });
    caixa.style.display = '';
}

async function mostrarRelatorioNaTela() {
    if (!relatorioAtual) return;
    ocultasAtuais = await carregarPreferenciaColunas(relatorioAtual.tipo);
    previaImpressao = false;
    document.getElementById('btnPreviaImpressao')?.setAttribute('aria-pressed', 'false');
    desenharControlesColunas();
    renderizarPreviaRelatorio();
    document.getElementById('reportOutput').innerHTML = '';
    document.getElementById('printButton').style.display = '';
    document.getElementById('xlsButton').style.display = '';
    marcarRelatorioPronto(true);
    expandirTelaRelatorios(true);
    document.getElementById('previewRelatorio').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Imprimir: o que sai no papel é o relatório SEM as colunas/blocos desmarcados.
function imprimirRelatorioAtual() {
    if (estaNaTelaDeEmpreiteiras()) { imprimirEmpreiteirasAtual(); return; }
    if (!relatorioAtual || !relatorioAtual.html) return;
    const raiz = document.createElement('div');
    raiz.innerHTML = relatorioAtual.html;
    aplicarColunasOcultas(raiz, ocultasAtuais, 'remover');
    imprimirRelatorio(raiz.innerHTML);
}

// Excel: um arquivo por evento, como sempre, mas sem as colunas desmarcadas (e sem as abas dos
// blocos desmarcados). O JSON do backend usa alguns nomes diferentes do cabeçalho — mapeados aqui.
const ALIAS_COLUNAS_XLS = {
    'QTD AJUDA': ['QTD_AJUDA'],
    'QTD CACHÊ': ['QTD', 'QTD_CALCULADA'],
    'QTD': ['QTD_CALCULADA'],
    'STATUS COMPROVANTE': ['COMP STATUS'],
    'VLR CAIXINHA': ['VLR CAIXINHA PENDENTE'],
    'PIX': ['PIX EMPREITEIRA']
};

function exportarExcelAtual() {
    if (!relatorioAtual || !relatorioAtual.dadosAgrupadosPorEvento) return;
    const ocultas = new Set(ocultasAtuais);
    const chavesOcultas = new Set();
    ocultas.forEach(c => { chavesOcultas.add(c); (ALIAS_COLUNAS_XLS[c] || []).forEach(a => chavesOcultas.add(a)); });

    const filtrado = {};
    Object.entries(relatorioAtual.dadosAgrupadosPorEvento).forEach(([id, ev]) => {
        filtrado[id] = {
            ...ev,
            fechamentoCache: (ev.fechamentoCache || []).map(linha => {
                const copia = { ...linha };
                chavesOcultas.forEach(k => delete copia[k]);
                return copia;
            }),
            utilizacaoDiarias: ocultas.has(BLOCO_UTIL) ? [] : ev.utilizacaoDiarias,
            contingencia: ocultas.has(BLOCO_CONT) ? [] : ev.contingencia
        };
    });

    const nomes = exportarParaXls(filtrado, relatorioAtual.nomeRelatorio);
    Swal.fire({
        icon: 'success',
        title: 'Relatórios XLS Gerados!',
        html: `Os arquivos foram gerados com sucesso e estão na sua pasta de <strong>DOWNLOADS</strong>.<br><br>
               Arquivos gerados: <ul><li>${nomes.join('</li><li>')}</li></ul>`,
        confirmButtonText: 'Entendido'
    });
}

// Evento com mais de um cliente: o nome do cliente no topo do relatório é um só, então sem escolher
// um cliente as linhas de clientes diferentes saíam todas sob o nome de um deles. Pergunta antes de
// gerar: escolher um cliente ou imprimir todos (aí o topo lista os nomes de todos).
async function resolverClientesDoEvento(eventoSelecionado, clienteId) {
    if (clienteId) return { ok: true, clienteId };
    const eventos = (todosOsDadosDoPeriodo || []).filter(ev =>
        !eventoSelecionado || eventoSelecionado === 'todos' || String(ev.idevento) === String(eventoSelecionado));
    const comVarios = eventos.filter(ev => (ev.clientes || []).length > 1);
    if (!comVarios.length) return { ok: true, clienteId };

    const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
    const opcoes = {};
    comVarios.forEach(ev => ev.clientes.forEach(c => { opcoes[c.idcliente] = c.nomeCliente; }));
    const lista = comVarios.map(ev => `<li><strong>${esc(ev.nmevento)}</strong>: ${ev.clientes.map(c => esc(c.nomeCliente)).join(', ')}</li>`).join('');

    const resposta = await Swal.fire({
        icon: 'question',
        title: comVarios.length === 1 ? 'Evento com mais de um cliente' : 'Eventos com mais de um cliente',
        html: `<ul style="text-align:left;margin:0 0 10px 18px;">${lista}</ul>Escolha um cliente ou imprima todos (o topo do relatório lista os nomes de todos os clientes).`,
        input: 'select',
        inputOptions: opcoes,
        inputPlaceholder: 'Escolha um cliente',
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: 'Gerar do cliente escolhido',
        denyButtonText: 'Imprimir todos',
        cancelButtonText: 'Cancelar',
        inputValidator: (valor) => (!valor ? 'Escolha um cliente ou use "Imprimir todos".' : undefined)
    });
    if (resposta.isConfirmed && resposta.value) {
        const select = document.getElementById('clientSelect');
        if (select && ![...select.options].some(o => o.value === String(resposta.value))) {
            const opt = document.createElement('option');
            opt.value = resposta.value;
            opt.textContent = opcoes[resposta.value];
            select.appendChild(opt);
        }
        if (select) select.value = String(resposta.value);
        return { ok: true, clienteId: String(resposta.value) };
    }
    if (resposta.isDenied) return { ok: true, clienteId: '' };
    return { ok: false };
}


// ---- Painel embutido sob a pílula (sem overlay) ----
function posicionarTelaRelatorios() {
    const modal = document.getElementById('Relatorios');
    const painel = document.getElementById('painelDetalhes');
    const pilulas = painel?.querySelector('.menu-pills');
    if (!modal || !painel || !pilulas) return false;
    const rp = painel.getBoundingClientRect();
    const rl = pilulas.getBoundingClientRect();
    modal.style.setProperty('--rel-top', `${Math.round(rl.bottom + 12)}px`);
    const cabecalho = document.querySelector('header');
    if (cabecalho) modal.style.setProperty('--rel-top-cheia', `${Math.round(cabecalho.getBoundingClientRect().bottom) + 8}px`);
    modal.style.setProperty('--rel-left', `${Math.round(rl.left)}px`);
    modal.style.setProperty('--rel-right', `${Math.round(window.innerWidth - rp.right + 12)}px`);
    return true;
}

// Fecha a tela embutida sem recarregar a página (o fecharModal padrão recarrega, o que não faz
// sentido para um relatório só de leitura). As pílulas continuam no painel.
function sairDaTelaRelatorios() {
    desinicializarRelatoriosModal();
    const container = document.getElementById('modal-container');
    if (container) container.innerHTML = '';
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.style.display = 'none';
    document.body.classList.remove('modal-open');
    document.querySelectorAll('.menu-pill.ativo').forEach(p => p.classList.remove('ativo'));
    window.moduloAtual = null;
}

function expandirTelaRelatorios(expandir) {
    const modal = document.getElementById('Relatorios');
    if (!modal || !modal.classList.contains('rel-embutida')) return;
    if (expandir) posicionarTelaRelatorios();
    modal.classList.toggle('rel-cheia', !!expandir);
    modal.scrollTop = 0;
}

function marcarRelatorioPronto(pronto) {
    document.getElementById('Relatorios')?.classList.toggle('rel-tem-relatorio', !!pronto);
}

function configurarTelaEmbutida() {
    const modal = document.getElementById('Relatorios');
    if (!modal) return;
    if (!posicionarTelaRelatorios()) {
        // Aberto sem as pílulas na tela (atalhos de Fornecedores/Vencimentos): tela cheia com overlay.
        modal.classList.remove('rel-embutida');
        return;
    }
    // Sem overlay a página continua clicável: tira o travamento do modal (dropdowns do menu etc.).
    document.body.classList.remove('modal-open');

    // "Fechar" sem recarregar a página — a não ser que alguém espere voltar para outra tela.
    window.relFecharCapturaListener = (e) => {
        if (!e.target.closest('.close')) return;
        if (typeof window.retornoAposFecharModal === 'function' || typeof window.onStaffModalClosed === 'function') return;
        e.stopPropagation();
        sairDaTelaRelatorios();
    };
    modal.addEventListener('click', window.relFecharCapturaListener, true);

    // Clicar em outro item do menu (RH, CEO, T.I., Cadastros...) fecha o relatório.
    window.relMenuCliqueListener = (e) => {
        if (e.target.closest('#menu-horizontal a')) sairDaTelaRelatorios();
    };
    document.addEventListener('click', window.relMenuCliqueListener, true);

    // "Fechar" da linha de ações (o do cabeçalho fica escondido nesta tela).
    document.getElementById('btnFecharAcao')?.addEventListener('click', () => {
        if (typeof window.retornoAposFecharModal === 'function' || typeof window.onStaffModalClosed === 'function') {
            modal.querySelector('.rel-topo .close')?.click();   // deixa o fecharModal padrão voltar à tela de origem
        } else {
            sairDaTelaRelatorios();
        }
    });

    document.getElementById('btnExpandir')?.addEventListener('click', () => expandirTelaRelatorios(true));
    document.getElementById('btnRecolher')?.addEventListener('click', () => expandirTelaRelatorios(false));

    window.relResizeListener = () => posicionarTelaRelatorios();
    window.addEventListener('resize', window.relResizeListener);
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

    relatorioAtual = null;
    ocultasAtuais = [];
    previaImpressao = false;
    window._relatorioEmpreiteiras = null;
    if (window.relMenuCliqueListener) { document.removeEventListener('click', window.relMenuCliqueListener, true); window.relMenuCliqueListener = null; }
    if (window.relResizeListener) { window.removeEventListener('resize', window.relResizeListener); window.relResizeListener = null; }
    if (window.relPreviaResizeListener) { window.removeEventListener('resize', window.relPreviaResizeListener); window.relPreviaResizeListener = null; }

    console.log("✅ Relatórios desinicializado.");
}


initRelatorios();

window.moduloHandlers = window.moduloHandlers || {};
window.moduloHandlers['Relatorios'] = { // A chave 'Relatorios' deve corresponder ao que o Index.js usa
    configurar: initRelatorios,          // ou configurarEventosRelatorios, se esse for o nome
    desinicializar: desinicializarRelatoriosModal
};
