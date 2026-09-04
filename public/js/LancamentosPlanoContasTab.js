import { fetchComToken } from '../utils/utils.js';

export function configurarAbaPlanoContas(aoSalvar) {
    let elNome = document.querySelector("#lcPlanoContaNome");
    const elId = document.querySelector("#lcPlanoContaId");
    const elCodigo = document.querySelector("#lcPlanoContaCodigo");
    const elAtivo = document.querySelector("#lcPlanoContaAtivo");
    const btnEnviar = document.querySelector("#lcPlanoContaEnviar");
    const btnLimpar = document.querySelector("#lcPlanoContaLimpar");
    const btnPesquisar = document.querySelector("#lcPlanoContaPesquisar");

    if (!elNome || !elId || !elCodigo || !elAtivo || !btnEnviar || !btnLimpar || !btnPesquisar) return;

    function restaurarInputNome(valor) {
        const novoInput = document.createElement("input");
        novoInput.type = "text";
        novoInput.id = "lcPlanoContaNome";
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
        elCodigo.value = "";
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
        if (typeof temPermissao === "function" && !temPermissao("Planocontas", "pesquisar")) {
            return Swal.fire("Acesso negado", "Você não tem permissão para pesquisar.", "warning");
        }

        try {
            const lista = await fetchComToken("/planocontas");
            if (!lista || lista.length === 0) {
                return Swal.fire("Info", "Nenhum Plano de Contas cadastrado.", "info");
            }

            const select = document.createElement("select");
            select.id = "lcPlanoContaNome";
            select.innerHTML = '<option value="" disabled selected>Selecione um Plano de Contas...</option>' +
                lista.map(p => `<option value="${p.idplanocontas}">${p.codigo} - ${p.nmplanocontas}</option>`).join("");

            elNome.parentNode.replaceChild(select, elNome);
            elNome = select;

            select.addEventListener("change", function () {
                const plano = lista.find(p => String(p.idplanocontas) === this.value);
                if (!plano) return;
                elId.value = plano.idplanocontas;
                elCodigo.value = plano.codigo;
                elAtivo.checked = !!plano.ativo;
                restaurarInputNome(plano.nmplanocontas);
            });
        } catch (error) {
            console.error("Erro ao pesquisar Plano de Contas:", error);
            Swal.fire("Erro", "Não foi possível pesquisar o Plano de Contas.", "error");
        }
    });

    btnEnviar.addEventListener("click", async (e) => {
        e.preventDefault();

        const idPlanoConta = elId.value.trim();
        const codigo = elCodigo.value.trim();
        const nmPlanoConta = elNome.value.toUpperCase().trim();
        const ativo = elAtivo.checked;

        const temPermissaoCadastrar = typeof temPermissao === "function" && temPermissao("Planocontas", "cadastrar");
        const temPermissaoAlterar = typeof temPermissao === "function" && temPermissao("Planocontas", "alterar");

        if (!idPlanoConta && !temPermissaoCadastrar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para cadastrar novos Planos de Contas.", "error");
        }
        if (idPlanoConta && !temPermissaoAlterar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para alterar Planos de Contas.", "error");
        }

        if (!codigo || !nmPlanoConta) {
            return Swal.fire("Campos obrigatórios!", "Preencha código e nome do Plano de Contas.", "warning");
        }

        const metodo = idPlanoConta ? "PUT" : "POST";
        const url = idPlanoConta ? `/planocontas/${idPlanoConta}` : "/planocontas";

        try {
            if (metodo === "PUT") {
                const { isConfirmed } = await Swal.fire({
                    title: "Deseja salvar as alterações?",
                    text: "Você está prestes a atualizar os dados do Plano de Contas.",
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
                body: JSON.stringify({ codigo, nmPlanoConta, ativo })
            });

            await Swal.fire("Sucesso!", resposta.message || "Plano de Contas salvo com sucesso.", "success");
            limpar();
            if (typeof aoSalvar === "function") aoSalvar();
        } catch (error) {
            console.error("Erro ao salvar Plano de Contas:", error);
            Swal.fire("Erro", error.message || "Erro ao salvar Plano de Contas.", "error");
        }
    });
}
