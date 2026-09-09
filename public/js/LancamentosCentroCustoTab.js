import { fetchComToken } from '../utils/utils.js';

export function configurarAbaCentroCusto(aoSalvar) {
    let elNome = document.querySelector("#lcCentroCustoNome");
    const elId = document.querySelector("#lcCentroCustoId");
    const elSigla = document.querySelector("#lcCentroCustoSigla");
    const elAtivo = document.querySelector("#lcCentroCustoAtivo");
    const btnEnviar = document.querySelector("#lcCentroCustoEnviar");
    const btnLimpar = document.querySelector("#lcCentroCustoLimpar");
    const btnPesquisar = document.querySelector("#lcCentroCustoPesquisar");

    if (!elNome || !elId || !elSigla || !elAtivo || !btnEnviar || !btnLimpar || !btnPesquisar) return;

    function restaurarInputNome(valor) {
        const novoInput = document.createElement("input");
        novoInput.type = "text";
        novoInput.id = "lcCentroCustoNome";
        novoInput.className = "uppercase";
        novoInput.value = valor || "";
        novoInput.addEventListener("input", function () {
            this.value = this.value.toUpperCase();
        });
        elNome.parentNode.replaceChild(novoInput, elNome);
        elNome = novoInput;
    }

    function limpar() {
        elId.value = "";
        elSigla.value = "";
        elAtivo.checked = true;
        if (elNome.tagName === "SELECT") restaurarInputNome("");
        else elNome.value = "";
    }

    btnLimpar.addEventListener("click", (e) => {
        e.preventDefault();
        limpar();
    });

    btnPesquisar.addEventListener("click", async (e) => {
        e.preventDefault();
        if (typeof temPermissao === "function" && !temPermissao("CentroCusto", "pesquisar")) {
            return Swal.fire("Acesso negado", "Você não tem permissão para pesquisar.", "warning");
        }

        try {
            const lista = await fetchComToken("/centrocusto");
            if (!lista || lista.length === 0) {
                return Swal.fire("Info", "Nenhum Centro de Custo cadastrado.", "info");
            }

            const select = document.createElement("select");
            select.id = "lcCentroCustoNome";
            select.innerHTML = '<option value="" disabled selected>Selecione um Centro de Custo...</option>' +
                lista.map(c => `<option value="${c.idcentrocusto}">${c.sigla} - ${c.nmcentrocusto}</option>`).join("");

            elNome.parentNode.replaceChild(select, elNome);
            elNome = select;

            select.addEventListener("change", function () {
                const centro = lista.find(c => String(c.idcentrocusto) === this.value);
                if (!centro) return;
                elId.value = centro.idcentrocusto;
                elSigla.value = centro.sigla || "";
                elAtivo.checked = !!centro.ativo;
                restaurarInputNome(centro.nmcentrocusto);
            });
        } catch (error) {
            console.error("Erro ao pesquisar Centro de Custo:", error);
            Swal.fire("Erro", "Não foi possível pesquisar o Centro de Custo.", "error");
        }
    });

    btnEnviar.addEventListener("click", async (e) => {
        e.preventDefault();

        const idCentroCusto = elId.value.trim();
        const nmCentroCusto = elNome.value.toUpperCase().trim();
        const sgCentroCusto = elSigla.value.toUpperCase().trim();
        const ativo = elAtivo.checked;

        const temPermissaoCadastrar = typeof temPermissao === "function" && temPermissao("CentroCusto", "cadastrar");
        const temPermissaoAlterar = typeof temPermissao === "function" && temPermissao("CentroCusto", "alterar");

        if (!idCentroCusto && !temPermissaoCadastrar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para cadastrar.", "error");
        }
        if (idCentroCusto && !temPermissaoAlterar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para alterar.", "error");
        }

        if (!nmCentroCusto || !sgCentroCusto) {
            return Swal.fire("Campos obrigatórios", "Informe o nome e a sigla.", "warning");
        }

        const metodo = idCentroCusto ? "PUT" : "POST";
        const url = idCentroCusto ? `/CentroCusto/${idCentroCusto}` : "/CentroCusto";

        try {
            if (metodo === "PUT") {
                const { isConfirmed } = await Swal.fire({
                    title: "Deseja salvar as alterações?",
                    text: "Você está prestes a atualizar os dados do Centro de Custo.",
                    icon: "question",
                    showCancelButton: true,
                    confirmButtonText: "Sim, salvar",
                    cancelButtonText: "Cancelar",
                    reverseButtons: true
                });
                if (!isConfirmed) return;
            }

            const resposta = await fetchComToken(url, {
                method: metodo,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nmCentroCusto, sgCentroCusto, ativo })
            });

            await Swal.fire("Sucesso!", resposta.message || "Centro de Custo salvo com sucesso.", "success");
            limpar();
            if (typeof aoSalvar === "function") aoSalvar();
        } catch (error) {
            console.error("Erro ao salvar Centro de Custo:", error);
            Swal.fire("Erro", error.message || "Erro ao salvar Centro de Custo.", "error");
        }
    });
}
