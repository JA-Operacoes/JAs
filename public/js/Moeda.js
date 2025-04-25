function inicializarMoeda() {
    setTimeout(() => {
        const inputCusto = document.getElementById('Custo');
        const inputVenda = document.getElementById('Venda');
        const inputBeneficios = document.getElementById('Beneficios');

        if (!inputCusto || !inputVenda || !inputBeneficios) {
            console.error("Erro: Um ou mais inputs não encontrados!");
            return;
        }

        // Função para formatar os valores em moeda
        function formatarMoeda(valor) {
            let numero = valor.replace(/\D/g, ''); // Remove tudo que não for número
            if (numero === "") numero = "0"; // Se estiver vazio, define como "0"

            // Converte para número e divide por 100 para incluir os centavos
            let valorFormatado = (parseInt(numero, 10) / 100).toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL'
            });

            return valorFormatado;
        }

        // Função que aplica a formatação ao digitar
        function atualizarValor(e) {
            e.target.value = formatarMoeda(e.target.value);
        }

        // Função que garante que o campo de valor tenha um valor mínimo
        function garantirValorMinimo(e) {
            if (e.target.value.trim() === "" || e.target.value === "R$ 0,00") {
                e.target.value = "R$ 0,00";
            }
        }

        // Aplica a formatação inicial para ambos os campos
        inputCusto.value = "R$ 0,00";
        inputVenda.value = "R$ 0,00";
        inputBeneficios.value = "R$ 0,00";

        // Atualiza a formatação enquanto digita
        inputCusto.addEventListener('input', atualizarValor);
        inputVenda.addEventListener('input', atualizarValor);
        inputBeneficios.addEventListener('input', atualizarValor);

        // Garante que "R$ 0,00" apareça ao perder o foco
        inputCusto.addEventListener('blur', garantirValorMinimo);
        inputVenda.addEventListener('blur', garantirValorMinimo);
        inputBeneficios.addEventListener('blur', garantirValorMinimo);

        console.log("Formatador de moeda inicializado.");
    }, 200); // Pequeno atraso para garantir que o modal foi carregado
}

// Inicialize a função ao carregar a página ou ao abrir o modal
document.addEventListener('DOMContentLoaded', inicializarMoeda);
