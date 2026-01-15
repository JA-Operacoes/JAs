import { fetchComToken, aplicarTema } from '../utils/utils.js';

document.addEventListener("DOMContentLoaded", function () {
    const idempresa = localStorage.getItem("idempresa");

    if (idempresa) {
        const apiUrl = `/empresas/${idempresa}`; // Verifique o caminho da sua API

        fetchComToken(apiUrl)
            .then((empresa) => {
                // Usa o nome fantasia como tema
                const tema = empresa.nmfantasia;
                aplicarTema(tema);
            })
            .catch((error) => {
                console.error("❌ Erro ao buscar dados da empresa para o tema:", error);
                // aplicarTema('default');
            });
    }
});

let btnEnviarListener = null;
let btnLimparListener = null;
let btnPesquisarListener = null;
let selectTextosChangeListener = null;
let tituloBlurListener = null;

if (typeof window.textoOriginal === "undefined") {
    window.textoOriginal = {
        idTexto: "",
        titulo: "",
        conteudo: "",
        ativo: false,
        categoria: ""
    };
}

const campos = {
    idTexto: "#idTexto",
    titulo: "#Titulo",
    conteudo: "#conteudo",
    categoria: "#categoria",
    ativo: "#ativo"
};

const getCampo = (key) => document.querySelector(campos[key]);

const setCampo = (key, value) => {
    const campo = getCampo(key);
    if (campo) {
        if (campo.type === "checkbox") {
            campo.checked = value;
        } else {
            campo.value = value;
        }
    }
};

const preencherFormulario = (texto) => {
    console.log("PREENCHER FORMULARIO", texto);
    Object.entries(campos).forEach(([key]) => {
        setCampo(key, texto[key.toLowerCase()] || "");
    });

    window.textoOriginal = {
        idTexto: texto.id || "",
        titulo: texto.titulo || "",
        conteudo: texto.conteudo || "",
        ativo: texto.ativo || false,
        categoria: texto.categoria || ""
    };

    console.log("Texto original CarregarTexto:", window.textoOriginal);

    const campoCodigo = getCampo("idTexto");
    if (campoCodigo && campoCodigo.value.trim()) {
        campoCodigo.classList.add("has-value");
    }
    campoCodigo.readOnly = true; // bloqueia o campo
};

const limparFormulario = () => {
    const form = document.querySelector("#form");
    if (form) form.reset();
    document.querySelector("#idTexto").value = "";
    if (typeof limparTextoOriginal === "function") limparTextoOriginal();
};

const obterDadosFormulario = () => {
    const valor = (key) => getCampo(key)?.value?.trim() || "";
    const dados = {
        titulo: valor("titulo").toUpperCase(),
        conteudo: valor("conteudo"),
        categoria: valor("categoria"),
        ativo: getCampo("ativo")?.checked
    };
    console.log("Dados do formulário prontos para envio:", dados);
    return dados;
};

function carregarTextos() {
    console.log("Configurando eventos para o modal de textos");

    const form = document.querySelector("#form");
    const btnEnviar = document.querySelector("#Enviar");
    const btnLimpar = document.getElementById("Limpar");
    const btnPesquisar = document.getElementById("Pesquisar");

    if (!form || !btnEnviar) {
        console.error("Formulário ou botão Enviar não encontrado.");
        return;
    }

    btnEnviar.addEventListener("click", async (e) => {
        e.preventDefault();
        console.log("Entrou no botão Enviar");
        const dados = obterDadosFormulario();
        const valorIdTexto = document.querySelector("#idTexto").value.trim();

        const temPermissaoCadastrar = temPermissao("Textospredefinidos", "cadastrar");
        const temPermissaoAlterar = temPermissao("Textospredefinidos", "alterar");

        // Bloqueia tentativa de cadastro se não tem permissão
        if (!valorIdTexto && !temPermissaoCadastrar) {
            return Swal.fire({
                icon: "info",
                title: "Texto não cadastrado",
                text: "Você não tem permissão para cadastrar Textos.",
                confirmButtonText: "OK"
            });
        }

        // Bloqueia tentativa de edição se não tem permissão
        if (valorIdTexto && !temPermissaoAlterar) {
            return Swal.fire({
                icon: "info",
                title: "Acesso negado",
                text: "Você não tem permissão para alterar Textos.",
                confirmButtonText: "OK"
            });
        }

        // Valida campos obrigatórios
        if (!dados.titulo || !dados.conteudo || !dados.categoria) {
            return Swal.fire("Atenção!", "Preencha Título, Conteúdo e Categoria.", "warning");
        }

        // Valida alterações
        if (!houveAlteracao(dados)) {
            return Swal.fire("Nenhuma alteração foi detectada!", "Faça alguma alteração antes de salvar.", "info");
        }

        const url = "/propostatextos";
        const metodo = "POST";

        try {
            if (valorIdTexto) {
                const { isConfirmed } = await Swal.fire({
                    title: "Deseja salvar as alterações?",
                    text: "Você está prestes a atualizar os dados do texto.",
                    icon: "question",
                    showCancelButton: true,
                    confirmButtonText: "Sim, salvar",
                    cancelButtonText: "Cancelar",
                    reverseButtons: true,
                    focusCancel: true
                });
                if (!isConfirmed) return;
            }

            const respostaApi = await fetchComToken(url, {
                method: metodo,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...dados, idTexto: valorIdTexto })
            });

            await Swal.fire("Sucesso!", respostaApi.message || "Texto salvo com sucesso.", "success");
            limparFormulario();

        } catch (error) {
            console.error("Erro ao enviar dados:", error);
            Swal.fire("Erro", error.message || "Erro ao salvar texto.", "error");
        }
    });

    if (btnLimpar) {
        btnLimpar.addEventListener("click", () => {
            const campo = document.getElementById("Titulo");

            if (campo && campo.tagName.toLowerCase() === "select") {
                const input = document.createElement("input");
                input.type = "text";
                input.id = "Titulo";
                input.name = "Titulo";
                input.className = "form";
                input.required = true;
                input.classList.add("uppercase");

                campo.parentNode.replaceChild(input, campo);
                adicionarEventoBlurTexto();

                const label = document.querySelector('label[for="Titulo"]');
                if (label) {
                    label.style.display = "block";
                    label.textContent = "Título";
                }
            }

            limparFormulario(); // Se você quiser limpar o restante do formulário
        });
    }

    if (btnPesquisar) {
        console.log("Entrou no botão pesquisar antes do click");

        btnPesquisar.addEventListener("click", async (event) => {
            event.preventDefault();
            console.log("ENTROU NO BOTÃO PESQUISAR DEPOIS DO CLICK");

            limparFormulario();
            try {
                console.log("CarregarTextos");
                const textos = await fetchComToken("/propostatextos");

                if (!textos || textos.length === 0) {
                    return Swal.fire({
                        icon: 'info',
                        title: 'Nenhum texto cadastrado',
                        text: 'Não foi encontrado nenhum texto no sistema.',
                        confirmButtonText: 'Ok'
                    });
                }

                const input = getCampo("titulo");

                const select = criarSelectTextos(textos);
                if (input && input.parentNode) {
                    input.parentNode.replaceChild(select, input);
                }

                const label = document.querySelector('label[for="Titulo"]');
                if (label) label.style.display = "none";

                select.addEventListener("change", async function () {
                    const desc = this.value?.trim();
                    if (!desc) return;

                    await carregarTextosTitulo(desc, this);
                    console.log("Texto selecionado:", desc);
                });

            } catch (error) {
                console.error("Erro ao carregar textos:", error);
                mostrarErro("Erro", "Não foi possível carregar os textos.");
            }
        });
    }
}

function desinicializarTextosModal() {
    console.log("🧹 Desinicializando módulo Textospredefinidos.js");

    const btnEnviar = document.querySelector("#Enviar");
    const btnLimpar = document.getElementById("Limpar");
    const btnPesquisar = document.getElementById("Pesquisar");
    const tituloElement = document.getElementById("Titulo"); // Pode ser input ou select

    if (btnEnviar && btnEnviarListener) {
        btnEnviar.removeEventListener("click", btnEnviarListener);
        btnEnviarListener = null;
    }
    if (btnLimpar && btnLimparListener) {
        btnLimpar.removeEventListener("click", btnLimparListener);
        btnLimparListener = null;
    }
    if (btnPesquisar && btnPesquisarListener) {
        btnPesquisar.removeEventListener("click", btnPesquisarListener);
        btnPesquisarListener = null;
    }

    // Remover listener do select (se o #Titulo for um select)
    if (tituloElement && tituloElement.tagName === "SELECT" && selectTextosChangeListener) {
        tituloElement.removeEventListener("change", selectTextosChangeListener);
        selectTextosChangeListener = null;
    }
    // Remover listener do input #Titulo (se for um input)
    if (tituloElement && tituloElement.tagName === "INPUT" && tituloBlurListener) {
        tituloElement.removeEventListener("blur", tituloBlurListener);
        tituloBlurListener = null;
    }

    // Limpar o estado original do texto
    window.textoOriginal = {
        idTexto: "",
        titulo: "",
        conteudo: "",
        ativo: false,
        categoria: ""
    };
}

function houveAlteracao(dados) {
    if (!window.textoOriginal) return true;

    return Object.keys(dados).some(key => {
        const original = window.textoOriginal[key];
        const atual = dados[key];
        return String(original ?? "").trim() !== String(atual ?? "").trim();
    });
}

function criarSelectTextos(textos) {
    const select = document.createElement("select");
    select.id = "Titulo";
    select.name = "Titulo";
    select.required = true;
    select.className = "form";

    const defaultOption = document.createElement("option");

    defaultOption.text = "Selecione um texto...";
    defaultOption.disabled = true;
    defaultOption.selected = true;
    defaultOption.value = "";
    select.appendChild(defaultOption);

    console.log("Textos encontrados no CriarSelects:", textos);

    textos.forEach(textoachado => {
        const option = document.createElement("option");
        option.value = textoachado.titulo;
        option.text = textoachado.titulo;
        select.appendChild(option);
    });

    return select;
}

function adicionarEventoBlurTexto() {

    // Event: Preencher campos ao sair do campo Título
    let ultimoClique = null;

    // Captura o último elemento clicado no documento
    document.addEventListener("mousedown", (e) => {
        ultimoClique = e.target;
    });

    getCampo("titulo").addEventListener("blur", async function () {

        const botoesIgnorados = ["Limpar", "Pesquisar", "Close"];
        const ehBotaoIgnorado =
            ultimoClique?.id && botoesIgnorados.includes(ultimoClique.id) ||
            ultimoClique?.classList.contains("close");

        if (ehBotaoIgnorado) {
            console.log("🔁 Blur ignorado: clique em botão de controle (Fechar/Limpar/Pesquisar).");
            return;
        }

        const titulo = this.value.trim();
        if (!titulo) return;

        try {
            const response = await fetchComToken(`/propostatextos?titulo=${encodeURIComponent(titulo)}`);
            const textoEncontrado = response.data;

            const dado = Array.isArray(textoEncontrado) ? textoEncontrado[0] : textoEncontrado;

            if (dado && Object.keys(dado).length > 0) {
                console.log("Texto encontrado:", dado);
                preencherFormulario(dado);
                console.log("Texto carregado:", dado);
            } else {
                throw new Error("Texto não encontrado");
            }

        } catch (error) {
            console.log("Erro ao buscar texto:", titulo, getCampo("idTexto").value, error);

            //  Se texto não existe e ainda não tem ID preenchido
            if (!getCampo("idTexto").value) {
                const podeCadastrar = temPermissao("Textospredefinidos", "cadastrar");
                console.log("PODE CADASTRAR ", podeCadastrar);
                // Só pergunta se deseja cadastrar se tiver permissão
                if (podeCadastrar) {
                    const { isConfirmed } = await Swal.fire({
                        icon: 'question',
                        title: `Deseja cadastrar "${titulo.toUpperCase()}" como novo Texto?`,
                        text: `Texto "${titulo.toUpperCase()}" não encontrado`,
                        showCancelButton: true,
                        confirmButtonText: 'Sim, cadastrar',
                        cancelButtonText: 'Cancelar'
                    });

                    if (!isConfirmed) return;

                    // Se confirmado, pode continuar com o formulário em branco
                    limparFormulario(); // opcional
                    getCampo("titulo").value = titulo; // mantém o nome digitado
                } else {
                    //  Sem permissão: apenas alerta
                    await Swal.fire({
                        icon: 'info',
                        title: "Texto não encontrado",
                        text: `Você não tem permissão para cadastrar um novo texto.`,
                    });
                    getCampo("titulo").value = '';
                    // ⚠️ Aguardar fechamento do Swal e forçar foco no campo
                    setTimeout(() => {
                        getCampo("titulo").focus();
                    }, 100); // Pequeno delay (100ms)

                    getCampo("titulo").focus();
                }
            }
        }
    });
}

async function carregarTextosTitulo(desc, elementoAtual) {
    try {
        const response = await fetchComToken(`/propostatextos?titulo=${encodeURIComponent(desc.trim())}`);
        const textoEncontrado = response.data;

        const texto = Array.isArray(textoEncontrado) ? textoEncontrado[0] : textoEncontrado;

        if (!texto || Object.keys(texto).length === 0) {
            throw new Error("Texto não encontrado");
        }

        console.log("Texto encontrado:", texto);

        // Preencher os campos...
        document.querySelector("#idTexto").value = texto.id || "";
        document.querySelector("#Titulo").value = texto.titulo || "";
        document.querySelector("#conteudo").value = texto.conteudo || "";
        document.querySelector("#categoria").value = texto.categoria || "";
        document.querySelector("#ativo").checked =
            texto.ativo === true || texto.ativo === "true" || texto.ativo === 1;

        textoOriginal = { ...texto };

        const novoInput = document.createElement("input");
        novoInput.type = "text";
        novoInput.id = "Titulo";
        novoInput.name = "Titulo";
        novoInput.required = true;
        novoInput.className = "form";
        novoInput.classList.add("uppercase");
        novoInput.value = texto.titulo;

        elementoAtual.parentNode.replaceChild(novoInput, elementoAtual);
        adicionarEventoBlurTexto();

        const label = document.querySelector('label[for="Titulo"]');
        if (label) {
            label.style.display = "block";
            label.textContent = "Título";
        }

        novoInput.addEventListener("blur", async function () {
            if (!this.value.trim()) return;
            await carregarTextosTitulo(this.value, this);
        });

    } catch {
        mostrarErro("Texto não encontrado", "Nenhum texto com esse título foi encontrado.");
        limparTextoOriginal();
    }
}

function mostrarErro(titulo, texto) {
    Swal.fire({
        icon: 'warning',
        title: titulo,
        text: texto,
        confirmButtonText: 'Ok'
    });
}

function limparTextoOriginal() {
    textoOriginal = {
        idTexto: "",
        titulo: "",
        conteudo: "",
        ativo: false,
        categoria: ""
    };
}

function limparCamposTexto() {
    const campos = ["idTexto", "Titulo", "conteudo", "categoria"];

    campos.forEach(id => {
        const campo = document.getElementById(id);
        if (campo) {
            campo.value = "";
        }
    });

    // Garante que o campo "ativo" (checkbox) seja desmarcado
    const campoAtivo = document.getElementById("ativo");
    if (campoAtivo && campoAtivo.type === "checkbox") {
        campoAtivo.checked = false;
    }
    const campoTitulo = document.querySelector("#Titulo");
    if (campoTitulo.tagName === "SELECT") {
        const novoInput = document.createElement("input");
        novoInput.type = "text";
        novoInput.id = "Titulo";
        novoInput.name = "Titulo";
        novoInput.required = true;
        novoInput.className = "form";
        novoInput.classList.add("uppercase");

        campoTitulo.parentNode.replaceChild(novoInput, campoTitulo);
        adicionarEventoBlurTexto();

        const label = document.querySelector('label[for="Titulo"]');
        if (label) {
            label.style.display = "block";
            label.textContent = "Título";
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const inputCodigo = document.querySelector("#idTexto");

    if (!inputCodigo) return;

    const atualizarLabelCodigo = () => {
        const label = document.querySelector('label[for="idTexto"]');
        if (label) {
            label.style.display = inputCodigo.value.trim() ? "block" : "none";
        }
    };

    inputCodigo.addEventListener("input", atualizarLabelCodigo);
    inputCodigo.addEventListener("blur", atualizarLabelCodigo);
});

function configurarTextosCadTexto() {
    carregarTextos();
    adicionarEventoBlurTexto();
}
window.configurarTextosCadTexto = configurarTextosCadTexto;

function configurarEventosEspecificos(modulo) {
    if (modulo.trim().toLowerCase() === 'textospredefinidos') {
        configurarTextosCadTexto();
        if (typeof aplicarPermissoes === "function" && window.permissoes) {
            aplicarPermissoes(window.permissoes);
        }
    }
}
window.configurarEventosEspecificos = configurarEventosEspecificos;

window.moduloHandlers = window.moduloHandlers || {};

// Registra as funções de configuração e desinicialização para este módulo
window.moduloHandlers['Textospredefinidos'] = { // Use 'Textospredefinidos' (com T maiúsculo) para corresponder ao seu mapaModulos no Index.js
    configurar: configurarTextosCadTexto,
    desinicializar: desinicializarTextosModal
};