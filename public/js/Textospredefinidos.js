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
        
        // Disparar evento para cada campo preenchido
        const el = getCampo(key);
        if (el) {
            el.dispatchEvent(new Event('input'));
            if (el.value) el.classList.add("has-value");
        }
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

    // Guarda o listener do Enviar
    btnEnviarListener = async (e) => {
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
    };

    btnEnviar.addEventListener("click", btnEnviarListener);

    // Guarda o listener do Limpar
    btnLimparListener = () => {
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

        limparFormulario();
    };

    if (btnLimpar) {
        btnLimpar.addEventListener("click", btnLimparListener);
    }

    // Guarda o listener do Pesquisar
    btnPesquisarListener = async (event) => {
        event.preventDefault();
        console.log("✅ Botão Pesquisar clicado - Carregando textos...");

        try {
            console.log("📤 Chamando API: GET /propostatextos");
            const response = await fetchComToken("/propostatextos");
            const textos = response.data;
            console.log("📋 Textos retornados da API:", textos);
            console.log("   Tipo:", typeof textos);
            console.log("   É array?", Array.isArray(textos));
            console.log("   Quantidade:", textos?.length || 0);

            if (!textos || (Array.isArray(textos) && textos.length === 0)) {
                console.warn("⚠️ Nenhum texto retornado");
                return Swal.fire({
                    icon: 'info',
                    title: 'Nenhum texto cadastrado',
                    text: 'Não foi encontrado nenhum texto no sistema.',
                    confirmButtonText: 'Ok'
                });
            }

            // Limpa antes de transformar
            limparFormulario();

            // Substitui input por select
            const inputTitulo = getCampo("titulo");
            console.log("🔍 Input Título encontrado:", inputTitulo);

            if (!inputTitulo) {
                console.error("❌ Campo #Titulo não encontrado no DOM");
                return Swal.fire({
                    icon: 'error',
                    title: 'Erro',
                    text: 'Campo Título não encontrado. Contate o administrador.',
                    confirmButtonText: 'Ok'
                });
            }

            const select = criarSelectTextos(textos);
            console.log("✅ Select criado com sucesso");
            
            if (inputTitulo && inputTitulo.parentNode) {
                inputTitulo.parentNode.replaceChild(select, inputTitulo);
                console.log("✅ Input substituído por select no DOM");
            } else {
                console.error("❌ Não foi possível substituir o input");
                return Swal.fire({
                    icon: 'error',
                    title: 'Erro',
                    text: 'Não foi possível carregar o formulário. Contate o administrador.',
                    confirmButtonText: 'Ok'
                });
            }

            const label = document.querySelector('label[for="Titulo"]');
            if (label) label.style.display = "none";

            // Listener para quando seleciona um texto
            selectTextosChangeListener = async function () {
                const desc = this.value?.trim();
                console.log("🎯 Texto selecionado no select:", desc);
                if (!desc) {
                    console.log("⚠️ Nenhum texto selecionado");
                    return;
                }

                await carregarTextosTitulo(desc, this);
            };

            select.addEventListener("change", selectTextosChangeListener);
            console.log("✅ Evento 'change' adicionado ao select");

        } catch (error) {
            console.error("❌ Erro ao carregar textos:", error);
            console.error("   Mensagem:", error.message);
            console.error("   Stack:", error.stack);
            Swal.fire({
                icon: 'error',
                title: 'Erro ao carregar textos',
                text: error.message || 'Não foi possível carregar os textos. Verifique a API.',
                confirmButtonText: 'Ok'
            });
        }
    };

    if (btnPesquisar) {
        btnPesquisar.addEventListener("click", btnPesquisarListener);
        console.log("✅ Listener 'click' adicionado ao botão Pesquisar");
    } else {
        console.error("❌ Botão Pesquisar não encontrado!");
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
    console.log("🔧 Criando select com textos:", textos);

    const select = document.createElement("select");
    select.id = "Titulo";
    select.name = "Titulo";
    select.required = true;
    select.className = "form2";

    const defaultOption = document.createElement("option");
    defaultOption.text = "Selecione um texto...";
    defaultOption.disabled = true;
    defaultOption.selected = true;
    defaultOption.value = "";
    select.appendChild(defaultOption);

    // Verifica se textos é um array ou objeto com propriedade rows/data
    let arrayTextos = textos;
    if (textos && textos.data) {
        arrayTextos = textos.data;
    } else if (textos && textos.rows) {
        arrayTextos = textos.rows;
    }

    console.log("📊 Array de textos a processar:", arrayTextos);

    if (!Array.isArray(arrayTextos)) {
        console.error("❌ Textos não é um array:", arrayTextos);
        return select;
    }

    arrayTextos.forEach((textoachado, index) => {
        console.log(`📝 Adicionando texto ${index}:`, textoachado);
        const option = document.createElement("option");
        option.value = textoachado.titulo || textoachado.id;
        option.text = textoachado.titulo || `Texto ${textoachado.id}`;
        select.appendChild(option);
    });

    console.log(`✅ Select criado com ${arrayTextos.length} opções`);
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
        console.log("🔍 Procurando texto com título:", desc);
        const response = await fetchComToken(`/propostatextos?titulo=${encodeURIComponent(desc.trim())}`);
        
        console.log("📥 Resposta da API:", response);

        // Trata diferentes formatos de resposta
        let textoEncontrado;
        if (Array.isArray(response)) {
            textoEncontrado = response[0];
        } else if (response && response.data) {
            textoEncontrado = Array.isArray(response.data) ? response.data[0] : response.data;
        } else if (response && response.success) {
            textoEncontrado = Array.isArray(response.data) ? response.data[0] : response.data;
        } else {
            textoEncontrado = response;
        }

        console.log("✅ Texto encontrado:", textoEncontrado);

        if (!textoEncontrado || Object.keys(textoEncontrado).length === 0) {
            throw new Error("Texto não encontrado");
        }

        // Preencher os campos com os dados do texto
        setCampo("idTexto", textoEncontrado.id || "");
        setCampo("titulo", textoEncontrado.titulo || "");
        setCampo("conteudo", textoEncontrado.conteudo || "");
        setCampo("categoria", textoEncontrado.categoria || "");
        setCampo("ativo", textoEncontrado.ativo === true || textoEncontrado.ativo === "true" || textoEncontrado.ativo === 1);

        // Atualiza o textoOriginal para rastrear mudanças
        window.textoOriginal = {
            idTexto: textoEncontrado.id || "",
            titulo: textoEncontrado.titulo || "",
            conteudo: textoEncontrado.conteudo || "",
            ativo: textoEncontrado.ativo === true || textoEncontrado.ativo === "true" || textoEncontrado.ativo === 1,
            categoria: textoEncontrado.categoria || ""
        };

        console.log("✅ Texto original atualizado:", window.textoOriginal);

        // Marca o campo idTexto como bloqueado
        const campoCodigo = getCampo("idTexto");
        if (campoCodigo) {
            campoCodigo.classList.add("has-value");
            campoCodigo.readOnly = true;
        }

    } catch (error) {
        console.error("❌ Erro ao carregar texto:", error);
        Swal.fire({
            icon: 'warning',
            title: 'Texto não encontrado',
            text: 'Nenhum texto com esse título foi encontrado.',
            confirmButtonText: 'Ok'
        });
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