import { fetchComToken } from '../utils/utils.js';

// Função para iniciar o módulo de relatórios
function initRelatorios() {
    // Busca os elementos do DOM
    const reportDateInput = document.getElementById('reportDate');
    const reportTypeSelect = document.getElementById('reportType');
    const gerarRelatorioBtn = document.getElementById('gerarRelatorioBtn');
    const printButton = document.getElementById('printButton');
    const closeButton = document.querySelector('#Relatorios .close');

    // Define a data atual como valor padrão
    const today = new Date().toISOString().split('T')[0];
    reportDateInput.value = today;

    // Adiciona o event listener ao botão
    if (gerarRelatorioBtn) {
        gerarRelatorioBtn.addEventListener('click', gerarRelatorio);
    }
    
    // Adiciona o event listener ao botão de imprimir
    if (printButton) {
        printButton.addEventListener('click', imprimirRelatorio);
    }

    // Adiciona o event listener ao botão de fechar para fechar o modal
    if (closeButton) {
        closeButton.addEventListener('click', () => {
            const modal = document.getElementById('Relatorios');
            modal.style.display = 'none';
            document.body.classList.remove('modal-open');
        });
    }

    // Lógica para ler parâmetros da URL e gerar relatório automaticamente, se necessário.
    const urlParams = new URLSearchParams(window.location.search);
    const tipoRelatorioInicial = urlParams.get('tipo');

    if (tipoRelatorioInicial && reportTypeSelect.querySelector(`option[value="${tipoRelatorioInicial}"]`)) {
        reportTypeSelect.value = tipoRelatorioInicial;
        gerarRelatorio();
    }
}

// Remova o mockApi completo. O código abaixo não precisa dele.
// ====================================================================
// === MOCK DE BACKEND (SIMULADO) =====================================
// === ... REMOVA ESTE BLOCO INTEIRO ... =============================
// ====================================================================
//RELATORIO AJDCUSTO/CACHE

// Funções principais
async function gerarRelatorio() {
    const tipoRelatorio = document.getElementById('reportType').value;
    const dataSelecionada = document.getElementById('reportDate').value;
    const outputDiv = document.getElementById('reportOutput');
    const printButton = document.getElementById('printButton');

    if (!dataSelecionada) {
        alert('Por favor, selecione uma data.');
        return;
    }
    
    // === NOVA CHAMADA DE API REAL ===
    // Use a URL da sua rota de backend. Ajuste 'http://localhost:3000' se necessário.
    const apiUrl = `/relatorios?tipo=${tipoRelatorio}&data=${dataSelecionada}`;

    console.log("CAMINHO RELATORIO", apiUrl);
    
    try {
        outputDiv.innerHTML = '<p>Carregando relatório...</p>';
        
        const dados = await fetchComToken(apiUrl);

        // if (!response.ok) {
        //     // Se a resposta da rede não for ok, lança um erro para o bloco catch
        //     throw new Error(`Erro na rede: ${response.status} ${response.statusText}`);
        // }
        
        // const dados = await response.json();
        console.log("Dados recebidos da API:", dados);

        // Verifica se o relatório retornou apenas a linha de total
        // Isso significa que não há registros, já que a API sempre retorna o total.
        const temRegistros = dados.some(item => item.Evento !== 'TOTAL GERAL');

        if (!temRegistros) {
            outputDiv.innerHTML = '<p>Nenhum registro encontrado para a data selecionada.</p>';
            printButton.style.display = 'none';
            return;
        }

        montarTabela(dados, outputDiv, tipoRelatorio);
        printButton.style.display = 'inline-block';

    } catch (error) {
        console.error('Falha ao gerar o relatório:', error);
        alert('Ocorreu um erro ao carregar o relatório.');
        outputDiv.innerHTML = '';
        printButton.style.display = 'none';
    }
}

function montarTabela(dados, container, tipoRelatorio) {
    const valorHeader = tipoRelatorio === 'ajuda_custo' ? 'Valor Ajuda de Custo' : 'Valor do Cachê';
    const headerMapping = {
        "Evento": "Evento",
        "Cliente": "Cliente",
        "Percentual Pgto": "Percentual Pgto",
        "Nome do Funcionario": "Nome do Funcionário",
        "Periodo": "Período",
        "Dados Bancarios": "Dados Bancários",
        [valorHeader]: valorHeader
    };

    let html = `
        <table class="report-table">
            <thead>
                <tr>
    `;
    for (const key in headerMapping) {
        if (headerMapping.hasOwnProperty(key)) {
            html += `<th>${headerMapping[key]}</th>`;
        }
    }
    html += `
                </tr>
            </thead>
            <tbody>
    `;

    dados.forEach(row => {
        const isTotalRow = row.Evento === 'TOTAL GERAL';
        const rowClass = isTotalRow ? 'total-row' : '';

        const valor = tipoRelatorio === 'ajuda_custo' ? row["Valor Ajuda de Custo"] : row["Valor do Cachê"];
        const valorFormatado = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
        
        const periodoFormatado = Array.isArray(row.Periodo) ? row.Periodo.join(', ') : row.Periodo;

        html += `
            <tr class="${rowClass}">
                <td>${row.Evento}</td>
                <td>${row.Cliente}</td>
                <td>${row["Percentual Pgto"]}</td>
                <td>${row["Nome do Funcionario"]}</td>
                <td>${periodoFormatado}</td>
                <td>${row["Dados Bancarios"]}</td>
                <td>${valorFormatado}</td>
            </tr>
        `;
    });

    html += `
            </tbody>
        </table>
    `;

    container.innerHTML = html;
}

function imprimirRelatorio() {
    console.log('Tentando imprimir...');
    
    // Armazena a classe atual do body
    const originalBodyClass = document.body.className;

    // Remove a classe que causa o conflito
    document.body.classList.remove('modal-open');

    // Usa um pequeno atraso para garantir que a classe foi removida antes de imprimir
    setTimeout(() => {
        window.print();
        
        // Retorna a classe original após um pequeno atraso, garantindo a impressão
        setTimeout(() => {
            document.body.className = originalBodyClass;
        }, 100);
    }, 100);
}

// Chame a função de inicialização
initRelatorios();