import { fetchComToken } from '../utils/utils.js';

// Equipes vivem como aba do modal de Funções (CadFuncao.html), no mesmo arranjo de
// Categoria de Função: mesmo DOM, ids com prefixo "eq" pra não colidir com os campos
// das outras abas. A empresa do vínculo (equipeempresas) é sempre a empresa logada —
// quem resolve isso é a rota, pelo contexto, então a tela só pede o nome.

if (typeof window.EquipeOriginal === "undefined") {
    window.EquipeOriginal = {
        idEquipe: "",
        descEquipe: ""
    };
}

// aoSalvar: avisa a aba dona do modal (Funções) que uma equipe foi criada/alterada, pra
// ela recarregar o select "Equipe" sem precisar reabrir o modal.
let aoSalvarEquipe = null;

function verificaEquipe() {
    console.log("Carregando Equipe...");

    const botaoEnviar = document.querySelector("#eqEnviar");
    const botaoPesquisar = document.querySelector("#eqPesquisar");
    const botaoLimpar = document.querySelector("#eqLimpar");
    const form = document.querySelector("#eqForm");

    if (!botaoEnviar || !form) {
        console.error("Formulário ou botão de Equipe não encontrado no DOM.");
        return;
    }

    // Form de um campo só: Enter dispararia o submit implícito do navegador e recarregaria
    // a página por cima do modal. Quem salva é o botão Enviar.
    form.addEventListener("submit", (event) => event.preventDefault());

    botaoLimpar.addEventListener("click", function (event) {
        event.preventDefault();
        console.log("Limpando Equipe...");

        const campo = document.getElementById("eqDescEquipe");

        // Pesquisar troca o input por um select; Limpar devolve o input.
        if (campo && campo.tagName.toLowerCase() === "select") {
            const input = criarInputEquipe("");
            campo.parentNode.replaceChild(input, campo);
            adicionarEventoBlurEquipe();

            const label = document.querySelector('label[for="eqDescEquipe"]');
            if (label) label.style.display = "block";
        }

        limparCamposEquipe();
    });

    botaoEnviar.addEventListener("click", async function (event) {
        event.preventDefault();
        console.log("Enviando Equipe...");

        const idEquipe = document.querySelector("#eqIdEquipe").value;
        const descEquipe = document.querySelector("#eqDescEquipe").value.toUpperCase().trim();

        const temPermissaoCadastrar = temPermissao("Equipe", "cadastrar");
        const temPermissaoAlterar = temPermissao("Equipe", "alterar");

        if (!idEquipe && !temPermissaoCadastrar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para cadastrar novas equipes.", "error");
        }

        if (idEquipe && !temPermissaoAlterar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para alterar equipes.", "error");
        }

        if (!descEquipe) {
            Swal.fire({
                icon: 'warning',
                title: 'Campos obrigatórios!',
                text: 'Informe o nome da equipe antes de enviar.',
                confirmButtonText: 'Entendi'
            });
            return;
        }

        if (
            parseInt(idEquipe) === parseInt(window.EquipeOriginal.idEquipe) &&
            descEquipe === window.EquipeOriginal.descEquipe
        ) {
            console.log("Nenhuma alteração detectada.");
            await Swal.fire({
                icon: 'info',
                title: 'Nenhuma alteração foi detectada!',
                text: 'Faça alguma alteração antes de salvar.',
                confirmButtonText: 'Entendi'
            });
            return;
        }

        const dados = { descEquipe };
        console.log("Dados a serem enviados:", dados);

        if (idEquipe) {
            const { isConfirmed } = await Swal.fire({
                title: "Deseja salvar as alterações?",
                text: "Você está prestes a atualizar os dados da equipe.",
                icon: "question",
                showCancelButton: true,
                confirmButtonText: "Sim, salvar",
                cancelButtonText: "Cancelar",
                reverseButtons: true,
                focusCancel: true
            });

            if (!isConfirmed) return;

            try {
                const resultJson = await fetchComToken(`/equipe/${idEquipe}`, {
                    method: "PUT",
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(dados)
                });

                Swal.fire("Sucesso!", resultJson.message || "Alterações salvas com sucesso!", "success");
                limparCamposEquipe();
                limparEquipeOriginal();
                if (typeof aoSalvarEquipe === "function") aoSalvarEquipe();

            } catch (error) {
                console.error("Erro ao enviar dados (PUT):", error);
                Swal.fire("Erro", error.message || "Erro ao salvar a Equipe.", "error");
            }
        } else {
            try {
                const resultJson = await fetchComToken("/equipe", {
                    method: "POST",
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(dados)
                });

                Swal.fire("Sucesso!", resultJson.mensagem || "Equipe cadastrada!", "success");
                limparCamposEquipe();
                limparEquipeOriginal();
                if (typeof aoSalvarEquipe === "function") aoSalvarEquipe();

            } catch (error) {
                console.error("Erro ao enviar dados (POST):", error);
                Swal.fire("Erro", error.message || "Erro ao cadastrar a Equipe.", "error");
            }
        }
    });

    botaoPesquisar.addEventListener("click", async function (event) {
        event.preventDefault();
        console.log("Pesquisando Equipe...");

        const temPermissaoPesquisar = temPermissao('Equipe', 'pesquisar');
        if (!temPermissaoPesquisar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para pesquisar.", "warning");
        }

        limparCamposEquipe();

        try {
            const input = document.querySelector("#eqDescEquipe");
            const equipes = await fetchComToken(`/equipe`);

            if (!equipes || equipes.length === 0) {
                return Swal.fire({
                    icon: 'info',
                    title: 'Nenhuma equipe cadastrada',
                    text: 'Não foi encontrada nenhuma equipe no sistema.',
                    confirmButtonText: 'Ok'
                });
            }

            const select = criarSelectEquipe(equipes);

            if (input && input.parentNode) {
                input.parentNode.replaceChild(select, input);
            }

            const label = document.querySelector('label[for="eqDescEquipe"]');
            if (label) label.style.display = "none";

            select.addEventListener("change", async function () {
                const desc = this.value?.trim();
                if (!desc) return;

                await carregarEquipeDescricao(desc, this);

                const novoInput = criarInputEquipe(desc);
                this.parentNode.replaceChild(novoInput, this);
                adicionarEventoBlurEquipe();

                const label = document.querySelector('label[for="eqDescEquipe"]');
                if (label) {
                    label.style.display = "block";
                    label.textContent = "Nome da Equipe";
                }
            });

        } catch (error) {
            console.error("Erro ao carregar equipes:", error);
            Swal.fire({
                icon: 'error',
                title: 'Erro',
                text: 'Não foi possível carregar as equipes.',
                confirmButtonText: 'Ok'
            });
        }
    });
}

function criarInputEquipe(valor) {
    const input = document.createElement("input");
    input.type = "text";
    input.id = "eqDescEquipe";
    input.name = "descEquipe";
    input.required = true;
    input.className = "form";
    input.classList.add('uppercase');
    input.value = valor || "";

    input.addEventListener("input", function () {
        this.value = this.value.toUpperCase();
    });

    return input;
}

function criarSelectEquipe(equipes) {
    const select = document.createElement("select");
    select.id = "eqDescEquipe";
    select.name = "descEquipe";
    select.required = true;
    select.className = "form";

    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.text = "Selecione uma equipe...";
    defaultOption.disabled = true;
    defaultOption.selected = true;
    select.appendChild(defaultOption);

    equipes.forEach(equipeAchada => {
        const option = document.createElement("option");
        option.value = equipeAchada.nmequipe;
        option.text = equipeAchada.nmequipe;
        select.appendChild(option);
    });

    return select;
}

// window.ultimoClique já é alimentado por Funcao.js/CategoriaFuncao.js (mesmo modal);
// a guarda abaixo mantém este arquivo autônomo caso a aba seja carregada sozinha.
if (!window.ultimoClique) {
    window.ultimoClique = null;
}
document.addEventListener("mousedown", (e) => {
    window.ultimoClique = e.target;
});

function adicionarEventoBlurEquipe() {
    const input = document.querySelector("#eqDescEquipe");
    if (!input || input.tagName.toLowerCase() !== "input") return;

    input.addEventListener("blur", async function () {
        const botoesIgnorados = ["eqLimpar", "eqPesquisar", "Close"];
        const ehBotaoIgnorado =
            (window.ultimoClique?.id && botoesIgnorados.includes(window.ultimoClique.id)) ||
            (window.ultimoClique?.classList && window.ultimoClique.classList.contains("close"));

        if (ehBotaoIgnorado) {
            console.log("🔁 Blur ignorado: clique em botão de controle (Fechar/Limpar/Pesquisar).");
            return;
        }

        const desc = this.value.trim();
        if (!desc) return;

        try {
            await carregarEquipeDescricao(desc, this);
        } catch (error) {
            console.error("Erro ao buscar Equipe:", error);
        }
    });
}

async function carregarEquipeDescricao(desc, elementoAtual) {
    console.log("Carregando Equipe com descrição:", desc);
    try {
        const equipe = await fetchComToken(`/equipe?descEquipe=${encodeURIComponent(desc)}`);

        if (!equipe || !equipe.idequipe) {
            throw new Error("Equipe não encontrada ou resposta inválida.");
        }

        document.querySelector("#eqIdEquipe").value = equipe.idequipe;

        window.EquipeOriginal = {
            idEquipe: equipe.idequipe,
            descEquipe: equipe.nmequipe
        };

    } catch (error) {
        const inputIdEquipe = document.querySelector("#eqIdEquipe");
        const podeCadastrarEquipe = temPermissao("Equipe", "cadastrar");

        // Já tem ID: é edição, não mexe.
        if (inputIdEquipe?.value) return;

        if (podeCadastrarEquipe) {
            const resultado = await Swal.fire({
                icon: 'question',
                title: `Deseja cadastrar "${desc.toUpperCase()}" como nova Equipe?`,
                text: `Equipe "${desc.toUpperCase()}" não encontrada`,
                showCancelButton: true,
                confirmButtonText: "Sim, cadastrar",
                cancelButtonText: "Cancelar",
                reverseButtons: true,
                focusCancel: true
            });

            if (!resultado.isConfirmed) {
                elementoAtual.value = "";
                setTimeout(() => elementoAtual.focus(), 0);
                return;
            }

            elementoAtual.value = desc.toUpperCase();

        } else {
            Swal.fire({
                icon: "info",
                title: "Equipe não cadastrada",
                text: "Você não tem permissão para cadastrar equipe.",
                confirmButtonText: "OK"
            });
            elementoAtual.value = "";
        }
    }
}

function limparEquipeOriginal() {
    window.EquipeOriginal = {
        idEquipe: "",
        descEquipe: ""
    };
}

function limparCamposEquipe() {
    ["eqIdEquipe", "eqDescEquipe"].forEach(id => {
        const campo = document.getElementById(id);
        if (campo) campo.value = "";
    });
}

export function configurarEventosEquipe(aoSalvar) {
    console.log("Configurando eventos Equipe...");
    aoSalvarEquipe = typeof aoSalvar === "function" ? aoSalvar : null;
    verificaEquipe();
    adicionarEventoBlurEquipe();
}
window.configurarEventosEquipe = configurarEventosEquipe;

// Equipe não abre como modal próprio: é aba do modal de Funções (CadFuncao.html), que é
// quem importa este arquivo. Por isso não existe configurarEventosEspecificos aqui —
// essa função é global e sobrescreveria a do módulo dono do modal (Funcao.js).

export function desinicializarEquipeModal() {
    console.log("🧹 Desinicializando módulo Equipe.js...");

    limparEquipeOriginal();
    limparCamposEquipe();
    aoSalvarEquipe = null;

    // O modal pode ter sido aberto sem a aba de Equipe configurada (usuário sem
    // permissão), daí o acesso opcional.
    document.getElementById('eqForm')?.reset();
    const campoIdEquipe = document.querySelector("#eqIdEquipe");
    if (campoIdEquipe) campoIdEquipe.value = "";

    console.log("✅ Módulo Equipe.js desinicializado.");
}

window.moduloHandlers = window.moduloHandlers || {};

window.moduloHandlers['Equipe'] = {
    configurar: configurarEventosEquipe,
    desinicializar: desinicializarEquipeModal
};
