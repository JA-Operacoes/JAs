document.addEventListener('DOMContentLoaded', () => {
    // Função para ler parâmetros da URL
    const urlParams = new URLSearchParams(window.location.search);
    const tipoRelatorioInicial = urlParams.get('tipo');

    // Define a data atual como valor padrão
    const today = new Date().toISOString().split('T')[0];
    const reportDateInput = document.getElementById('reportDate');
    reportDateInput.value = today;

    const reportTypeSelect = document.getElementById('reportType');
    if (tipoRelatorioInicial && reportTypeSelect.querySelector(`option[value="${tipoRelatorioInicial}"]`)) {
        // Se a URL tiver o parâmetro "tipo" e ele for válido, seleciona a opção
        reportTypeSelect.value = tipoRelatorioInicial;
        gerarRelatorio(); // Gera o relatório automaticamente
    }
});

// ====================================================================
// === Mock de Backend (SIMULADO) =====================================
// === Substitua esta parte pela sua chamada `fetch` real =========
// ====================================================================
const mockApi = {
    ajuda_custo: () => new Promise(resolve => {
        setTimeout(() => {
            resolve([
                {
                    "Evento": "Evento Anual Corporativo",
                    "Cliente": "Tech Solutions Inc.",
                    "Percentual Pgto": "100%",
                    "Nome do Funcionario": "João Silva",
                    "Periodo": ["2025-07-30"],
                    "Dados Bancarios": "001 - Banco do Brasil - 12345-6 - Corrente",
                    "Valor Ajuda de Custo": 150.00
                },
                {
                    "Evento": "Lançamento de Produto",
                    "Cliente": "Innovate Marketing",
                    "Percentual Pgto": "0%",
                    "Nome do Funcionario": "Maria Oliveira",
                    "Periodo": ["2025-07-30", "2025-07-31"],
                    "Dados Bancarios": "237 - Bradesco - 98765-4 - Poupança",
                    "Valor Ajuda de Custo": 200.00
                },
                {
                    "Evento": "TOTAL GERAL",
                    "Cliente": "",
                    "Percentual Pgto": "",
                    "Nome do Funcionario": "",
                    "Periodo": "",
                    "Dados Bancarios": "",
                    "Valor Ajuda de Custo": 350.00
                }
            ]);
        }, 500); // Simula um atraso de rede
    }),
    cache: () => new Promise(resolve => {
        setTimeout(() => {
            resolve([
                {
                    "Evento": "Lançamento de Produto",
                    "Cliente": "Innovate Marketing",
                    "Percentual Pgto": "100%",
                    "Nome do Funcionario": "Maria Oliveira",
                    "Periodo": ["2025-07-30", "2025-07-31"],
                    "Dados Bancarios": "237 - Bradesco - 98765-4 - Poupança",
                    "Valor do Cachê": 800.00
                },
                {
                    "Evento": "TOTAL GERAL",
                    "Cliente": "",
                    "Percentual Pgto": "",
                    "Nome do Funcionario": "",
                    "Periodo": "",
                    "Dados Bancarios": "",
                    "Valor do Cachê": 800.00
                }
            ]);
        }, 500); // Simula um atraso de rede
    })
};
// ====================================================================
// === FIM do Mock de Backend =========================================
// ====================================================================

async function gerarRelatorio() {
    const tipoRelatorio = document.getElementById('reportType').value;
    const dataSelecionada = document.getElementById('reportDate').value;
    const outputDiv = document.getElementById('reportOutput');
    const printButton = document.getElementById('printButton');

    if (!dataSelecionada) {
        alert('Por favor, selecione uma data.');
        return;
    }
    
    // Na implementação real, use:
    // const url = `/api/relatorio-${tipoRelatorio}?data=${dataSelecionada}`;
    // const response = await fetch(url);
    // const dados = await response.json();
    
    // Na simulação, chamamos o mockApi
    const apiCall = mockApi[tipoRelatorio];

    try {
        outputDiv.innerHTML = '<p>Carregando relatório...</p>';
        const dados = await apiCall();

        if (dados.length === 0) {
            outputDiv.innerHTML = '<p>Nenhum registro encontrado para a data selecionada.</p>';
            printButton.style.display = 'none';
            return;
        }

        montarTabela(dados, outputDiv, tipoRelatorio);
        printButton.style.display = 'inline-block';

    } catch (error) {
        console.error('Falha ao gerar o relatório:', error);
        outputDiv.innerHTML = '<p style="color:red;">Ocorreu um erro ao carregar o relatório.</p>';
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
        [valorHeader]: valorHeader // Usa a variável como chave
    };

    let html = `
        <table class="report-table">
            <thead>
                <tr>
    `;
    // Cria os cabeçalhos da tabela dinamicamente a partir do mapeamento
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
    window.print();
}