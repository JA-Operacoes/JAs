function salvarFuncao() {
        var select = document.getElementById("Funcao");
        var funcaoSelecionada = select.value;

        console.log("Função selecionada:", funcaoSelecionada);

        if (funcaoSelecionada === "select") {
            Swal.fire("Selecione uma função válida.");
            console.log("Nenhuma função válida foi selecionada.");
            return;
        }

        adicionarLinhaFuncao(funcaoSelecionada);
        select.selectedIndex = 0; // Limpa o select
    }

    function adicionarLinhaFuncao(funcao) {
        console.log("Adicionando função à tabela:", funcao);

        var tabela = document.getElementById("tabelaFuncoes").getElementsByTagName("tbody")[0];
        if (!tabela) {
            console.log("Erro: tbody da tabela não encontrado.");
            return;
        }

        var novaLinha = tabela.insertRow();
        novaLinha.innerHTML = `
            <td class="Funcao">${funcao}</td>
            <td>
                <div class="Acao">
                    <button class="deleteBtn" onclick="removerLinhaOrc(this)">
                        <svg class="delete-svgIcon" viewBox="0 0 448 512">
                            <path d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z"></path>
                        </svg>
                    </button>
                </div>
            </td>
        `;

        console.log("Linha adicionada com sucesso!");
    }

    function removerLinhaOrc(botao) {
        var linha = botao.closest("tr");
        linha.remove();
        console.log("Linha removida.");
    }