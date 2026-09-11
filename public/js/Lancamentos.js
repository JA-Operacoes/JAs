import { fetchComToken, aplicarTema } from '../utils/utils.js';
import { configurarAbaPlanoContas } from './LancamentosPlanoContasTab.js';
import { configurarAbaCentroCusto } from './LancamentosCentroCustoTab.js';
import { ligarBuscaComSugestoes } from './Formataçoes.js';
// Reaproveita a tela real de Pagamentos (Registro de Pagamentos) tal como já
// existe — só o form é embutido aqui como aba, sem duplicar nenhuma regra de
// negócio dele (upload, permissões, histórico). Ver plano/nota no HTML.
import { configurarEventosPagamentos } from './Pagamentos.js';

document.addEventListener("DOMContentLoaded", function () {
    const idempresa = localStorage.getItem("idempresa");
    if (idempresa) {
        const apiUrl = `/empresas/${idempresa}`;
        fetchComToken(apiUrl)
            .then(empresa => {
                aplicarTema(empresa.nmfantasia);
            })
            .catch(error => console.error("❌ Erro ao buscar tema:", error));
    }
});

let limparButtonListener = null;
let enviarButtonListener = null;
let pesquisarButtonListener = null;

function removerAcentos(texto) {
    return String(texto || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Busca com sugestões (padrão do sistema, ver ligarBuscaComSugestoes em Formataçoes.js) pra
// um <select> escondido, no lugar do Select2 (visual/comportamento diferente do resto do
// sistema). O <select> continua existindo (mesmo id) só pra o resto do código ler/setar
// .value sem precisar mudar mais nada — só a busca/exibição passam a ser feitas pelo
// <input> ao lado dele.
const buscasSelectOcultoLigadas = new Set();
function ligarBuscaSelectOculto(idInputBusca, idSelectOculto, idListaSugestoes, mensagemVazia) {
    const inputBusca = document.querySelector(idInputBusca);
    const selectOculto = document.querySelector(idSelectOculto);
    if (!inputBusca || !selectOculto || buscasSelectOcultoLigadas.has(idSelectOculto)) return;
    buscasSelectOcultoLigadas.add(idSelectOculto);

    const listaOpcoes = () => Array.from(selectOculto.options)
        .filter(o => o.value !== "")
        .map(o => ({ value: o.value, label: o.textContent }));

    ligarBuscaComSugestoes(
        inputBusca,
        idListaSugestoes,
        (termo) => {
            const termoBusca = removerAcentos(termo).toLowerCase();
            return listaOpcoes().filter(o => removerAcentos(o.label).toLowerCase().includes(termoBusca));
        },
        (o) => o.label,
        (o) => {
            inputBusca.value = o.label;
            selectOculto.value = o.value;
            selectOculto.dispatchEvent(new Event('change', { bubbles: true }));
        },
        // minChars:0 — sem isso, clicar no campo vazio não mostra nada (só digitando 2+
        // letras a busca dispara), parecendo que as opções "não carregaram".
        { mensagemVazia: mensagemVazia || "Nenhum resultado encontrado", minChars: 0 }
    );

    // Ao focar um campo ainda vazio, mostra a lista inteira de uma vez (dispara o mesmo
    // "input" que a busca escuta, só que com termo vazio == sem filtro).
    inputBusca.addEventListener("focus", () => {
        if (!inputBusca.value.trim()) inputBusca.dispatchEvent(new Event("input"));
    });
}

// Sincroniza o texto exibido no <input> de busca com a opção atualmente selecionada no
// <select> escondido — chamar depois de popular as opções ou de setar o .value via código
// (ex: ao carregar um lançamento existente para edição).
function sincronizarTextoBuscaSelect(idInputBusca, idSelectOculto) {
    const inputBusca = document.querySelector(idInputBusca);
    const selectOculto = document.querySelector(idSelectOculto);
    if (!inputBusca || !selectOculto) return;
    const opcaoSelecionada = selectOculto.options[selectOculto.selectedIndex];
    inputBusca.value = (opcaoSelecionada && opcaoSelecionada.value !== "") ? opcaoSelecionada.textContent : "";
}

// Busca conforme digita (Select2), ignorando acentos dos dois lados da comparação
function aplicarBuscaIncremental(seletor, placeholder, extra) {
    const el = document.querySelector(seletor);
    if (!el || typeof $ === "undefined" || !$.fn || !$.fn.select2) return;

    const $el = $(el);
    if ($el.hasClass("select2-hidden-accessible")) {
        $el.select2('destroy');
    }
    $el.select2(Object.assign({
        placeholder: typeof placeholder === "string" ? placeholder : "Selecione...",
        allowClear: false,
        width: '100%',
        matcher: function (params, data) {
            if ($.trim(params.term) === '') return data;
            if (typeof data.text === 'undefined') return null;
            const termo = removerAcentos(params.term).toLowerCase();
            const texto = removerAcentos(data.text).toLowerCase();
            return texto.indexOf(termo) > -1 ? data : null;
        }
    }, extra || {}));
    $el.off('select2:select.lc select2:unselect.lc').on('select2:select.lc select2:unselect.lc', function () {
        this.dispatchEvent(new Event('change', { bubbles: true }));
    });
}

// Mapa DESCRICAO (maiúscula) -> lançamento completo, usado pela busca de descrição
let mapaDescricaoLancamento = {};
// Mapa idlancamento -> lançamento completo — mesmos objetos de mapaDescricaoLancamento,
// só que indexados por id (usado pelo duplo clique na Visão Geral, ver vgAbrirParaEdicao).
let mapaLancamentoPorId = {};
let buscaDescricaoLigada = false;

// Campo de Descrição: busca com sugestões (padrão do sistema, ver
// public/js/formatacoes.js) — digita e escolhe um lançamento existente (carrega
// os dados dele) ou só segue digitando um nome novo (cadastro). Continua sendo
// um <input> comum o tempo todo, sem trocar para <select>.
async function configurarComboboxDescricao() {
    try {
        const lista = await fetchComToken("/lancamentos");
        if (!lista || !Array.isArray(lista)) return;

        mapaDescricaoLancamento = {};
        mapaLancamentoPorId = {};
        lista.forEach(item => {
            mapaDescricaoLancamento[String(item.descricao).trim().toUpperCase()] = item;
            mapaLancamentoPorId[item.idlancamento] = item;
        });

        const el = document.querySelector("#descricao");
        if (!el) return;

        if (!buscaDescricaoLigada) {
            buscaDescricaoLigada = true;

            ligarBuscaComSugestoes(
                el,
                "descricao-sugestoes",
                (termo) => {
                    const termoBusca = removerAcentos(termo).toLowerCase();
                    return Object.values(mapaDescricaoLancamento).filter(item =>
                        removerAcentos(item.descricao).toLowerCase().includes(termoBusca)
                    );
                },
                (item) => `${item.descricao} - R$ ${item.vlrestimado}`,
                async (item) => {
                    el.value = item.descricao;
                    await preencherCampos(item);
                    renderizarPrevia();
                    validarFormulario();
                },
                // minChars:0 — sem isso, clicar no campo vazio não mostra nada (só digitando
                // 2+ letras a busca dispara), parecendo que os lançamentos cadastrados "não
                // carregaram". O listener de foco abaixo dispara a mesma busca com termo vazio
                // pra já mostrar a lista inteira assim que o campo ganha foco.
                { mensagemVazia: "Nenhum lançamento encontrado — segue como cadastro novo", minChars: 0 }
            );

            // Ao focar um campo ainda vazio, mostra a lista inteira de uma vez (dispara o
            // mesmo "input" que a busca escuta, só que com termo vazio == sem filtro).
            el.addEventListener("focus", () => {
                if (!el.value.trim()) el.dispatchEvent(new Event("input"));
            });

            // Descrição nova digitada (sem escolher sugestão) também precisa revalidar o formulário
            el.addEventListener("input", () => validarFormulario());
        }
    } catch (error) {
        console.error("Erro ao configurar busca de descrição:", error);
    }
}

const tipoRepeticao = document.querySelector("#tipoRepeticao");
const qtdParcelasInput = document.querySelector("#qtdeParcelas");
const indeterminadoCheck = document.querySelector("#indeterminado");
const dtTerminoInput = document.querySelector("#dtTermino");
const vctoBaseInput = document.querySelector("#vctoBase");

// Objeto para Dirty Checking (Estado Original)
if (typeof window.LancamentoOriginal === "undefined") {
    window.LancamentoOriginal = {
        idLancamento: "",
        idcentrocusto: "",
        descricao: "",
        vlrestimado: "",
        vctobase: "",
        periodicidade: "MENSAL",
        tiporepeticao: "FIXO",
        dttermino: "",
        indeterminado: false,
        ativo: true,
        locado: false,
        idplanocontas: "",
        idvinculo:"",
        tpvinculo:"",
        idempresapagadora:""           
    };
}


async function verificaLancamento() {
    console.log("Carregando Lançamento...");

    const botaoEnviar = document.querySelector("#lcLancEnviar");
    const botaoPesquisar = document.querySelector("#lcLancPesquisar");
    const botaoLimpar = document.querySelector("#lcLancLimpar");
    
    const checkIndeterminado = document.querySelector("#indeterminado");
    const campoTermino = document.querySelector("#dtTermino");    

    validarFormulario();
    gerenciarCampos();
    renderizarPrevia();
    carregarSelectPlanoContas();
    carregarSelectEmpresaPagadora();
    carregarSelectCentroCusto();
    configurarComboboxDescricao();
    configurarEventosVinculo();
    configurarVisaoGeralLancamentos();

    // --- GATILHOS AUTOMÁTICOS ---
    // Adicionamos os novos campos: #idVinculo, #empresaPagadora, #centroCusto
    const camposGatilho = [
        "#idPlanoContasSelect", "#centroCusto", "#vlrEstimado", "#vctoBase",
        "#periodicidade", "#tipoRepeticao", "#dtTermino", "#indeterminado",
        "#qtdeParcelas", "#idVinculo", "#empresaPagadora"
    ];
        
    camposGatilho.forEach(seletor => {
        const el = document.querySelector(seletor);
        if (el) {
            ["input", "change"].forEach(evento => {
                el.addEventListener(evento, () => {
                    validarFormulario();
                    renderizarPrevia(); 
                });
            });
        }
    });

    // Gatilho especial para os Radio Buttons (Tipo de Vínculo e Perfil)
    document.querySelectorAll('.tipo-vinculo, .perfil-radio').forEach(radio => {
        radio.addEventListener('change', () => {
            validarFormulario();
        });
    });    

    const locadoCheckbox = document.querySelector("#locadoCheck") || document.querySelector("#Locadocheck");

    if (locadoCheckbox) {
        locadoCheckbox.addEventListener("change", function() {
            // Pega o valor que veio do banco (se existir)
            const valorOriginal = window.LancamentoOriginal ? !!window.LancamentoOriginal.locado : false;
            const valorAtual = this.checked;

            // SÓ dispara o Swal se houver um ID (estamos editando) E o valor mudou do original
            const ehEdicao = document.querySelector("#idLancamento").value !== "";

            if (ehEdicao && valorAtual !== valorOriginal) {
                Swal.fire({
                    title: "Atenção: Vínculo de Pagamento",
                    text: "Você alterou o status 'Locado'. Lembre-se que esta mudança pode exigir a atualização da Empresa Pagadora.",
                    icon: "info",
                    confirmButtonText: "Entendido",
                    confirmButtonColor: "var(--primary-color)"
                });
            }
        });
    }

    botaoLimpar.addEventListener("click", (e) => {
        e.preventDefault();
        limparCamposLancamento();
        document.querySelector("#container-previa").innerHTML = "";
    });

    // --- LOGICA DE ENVIO COM VALIDAÇÃO DE DESCRIÇÃO ---
    botaoEnviar.onclick = async (e) => {
        e.preventDefault();

        const errosObrigatorios = coletarErrosLancamento();
        if (errosObrigatorios.length) {
            return Swal.fire({
                icon: "warning",
                title: "Campos obrigatórios faltando",
                html: "Preencha antes de enviar:<br>- " + errosObrigatorios.join("<br>- "),
            });
        }

        // Captura segura de elementos
        const elIdLancamento = document.querySelector("#idLancamento");
        const idLancamento = elIdLancamento ? elIdLancamento.value.trim() : "";
        
        const tipoRepeticao = document.querySelector("#tipoRepeticao").value;
        const dtTermino = document.querySelector("#dtTermino").value;
        const indeterminado = document.querySelector("#indeterminado").checked;
        
        const inputLocado = document.querySelector("#locadoCheck") || document.querySelector("#Locadocheck");
        const locado = inputLocado ? inputLocado.checked : false;

        const elQtde = document.querySelector("#qtdeParcelas");
        const qtdParcelas = (elQtde && elQtde.value.trim() !== "") ? parseInt(elQtde.value) : null;

        const elDtRec = document.querySelector("#dtRecebimento");
        const dtRecebimento = (elDtRec && elDtRec.value.trim() !== "") ? elDtRec.value : null;

        const idPlanoContas = document.querySelector("#idPlanoContasSelect").value;
        const idEmpresaPagadora = document.querySelector("#empresaPagadora").value;

        // Validação de Parcelados
        if (tipoRepeticao === "PARCELADO" && !dtTermino && !indeterminado) {
            return Swal.fire("Erro", "Para lançamentos parcelados, a data de término é obrigatória.", "error");
        }

        // Descrição é sempre digitada manualmente pelo Financeiro
        const descricaoFinal = document.querySelector("#descricao").value.trim().toUpperCase();

        if (!descricaoFinal) {
            return Swal.fire("Erro", "Por favor, preencha a descrição do lançamento.", "warning");
        }

        const elObs = document.querySelector("#observacao");
        const observacao = elObs ? elObs.value.trim().toUpperCase() : null; 

        const checkMarcado = document.querySelector('.tipo-vinculo:checked');
        const tipoVinculo = checkMarcado ? checkMarcado.value : null; // 'cliente', 'fornecedor' ou 'funcionario'
        const idVinculo = document.querySelector('#idVinculo')?.value || null;
        
        const idCentroCusto = document.querySelector("#centroCusto")?.value;

        const dados = {
            idPlanoContas: idPlanoContas,
            descricao: descricaoFinal,
            vlrEstimado: parseFloat(window.desformatarReais(document.querySelector("#vlrEstimado").value)) || 0,
            vctoBase: document.querySelector("#vctoBase").value,
            periodicidade: document.querySelector("#periodicidade").value,
            tipoRepeticao: tipoRepeticao,
            dtTermino: dtTermino || null,
            indeterminado: indeterminado,
            ativo: document.querySelector("#ativo").checked,
            locado: locado,
            qtdParcelas: qtdParcelas,
            dtRecebimento: dtRecebimento,
            observacao: observacao,
            tipoVinculo: tipoVinculo,
            idVinculo: idVinculo,
            idCentroCusto: idCentroCusto,
            idEmpresaPagadora: idEmpresaPagadora
        };

        console.log("Dados a serem enviados:", dados);

        // 2. VALIDAÇÃO DE DUPLICIDADE (Apenas para NOVOS cadastros)
        if (!idLancamento) {
            try {
                const existentes = await fetchComToken("/lancamentos");
                const duplicadoPorNome = existentes.find(l => 
                    l.descricao.trim().toUpperCase() === dados.descricao.trim().toUpperCase()
                );

                if (duplicadoPorNome) {
                    return Swal.fire({
                        title: "Descrição já existe!",
                        html: `Já existe um lançamento cadastrado como: <b>${dados.descricao}</b>.<br><br>` +
                            `Para diferenciar, por favor, altere a descrição manualmente.`,
                        icon: "warning",
                        confirmButtonText: "Entendido"
                    });
                }
            } catch (err) {
                console.error("Erro ao validar duplicidade", err);
            }
        }

        // --- Permissões ---
        const temPermissaoCadastrar = temPermissao("Lancamentos", "cadastrar");
        const temPermissaoAlterar = temPermissao("Lancamentos", "alterar");

        if (!idLancamento && !temPermissaoCadastrar) return Swal.fire("Acesso negado", "Sem permissão para cadastrar.", "error");
        if (idLancamento && !temPermissaoAlterar) return Swal.fire("Acesso negado", "Sem permissão para alterar.", "error");

        const url = idLancamento ? `/lancamentos/${idLancamento}` : "/lancamentos";
        const metodo = idLancamento ? "PUT" : "POST";

        try {
            if (metodo === "PUT") {
                const { isConfirmed } = await Swal.fire({
                    title: "Salvar alterações?",
                    text: "Você está editando um lançamento existente.",
                    icon: "question",
                    showCancelButton: true,
                    confirmButtonText: "Sim, salvar"
                });
                if (!isConfirmed) return;
            }

            await fetchComToken(url, {
                method: metodo,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dados)
            });

            await Swal.fire("Sucesso!", "Lançamento salvo com sucesso.", "success");

            // Atualiza o cache do autocomplete de Descrição (mapaDescricaoLancamento),
            // senão selecionar o mesmo lançamento de novo trazia os dados de antes da edição.
            await configurarComboboxDescricao();

            // Limpa e fecha/reseta se necessário
            limparCamposLancamento();
            renderizarPrevia(); 
        } catch (error) {
            Swal.fire("Erro", error.message, "error");
        }
    };

    // --- Listener: PESQUISAR ---
    // O campo Descrição já é sempre um combobox com busca incremental (ver
    // configurarComboboxDescricao) — Pesquisar só re-sincroniza com os dados
    // mais recentes do banco, mantido como atalho redundante a pedido.
    botaoPesquisar.onclick = async (e) => {
        e.preventDefault();
        const temPermissaoPesquisar = temPermissao('Lancamentos', 'pesquisar');
        if (!temPermissaoPesquisar) return Swal.fire("Acesso negado", "Sem permissão.", "warning");

        limparCamposLancamento();
        await configurarComboboxDescricao();
    };
}


function gerenciarCampos() {
    const tipoRep = document.querySelector("#tipoRepeticao");
    const qtdeInput = document.querySelector("#qtdeParcelas");
    const checkIndet = document.querySelector("#indeterminado");
    const campoTermino = document.querySelector("#dtTermino");

    if (!tipoRep || !qtdeInput || !checkIndet || !campoTermino) return;

    const atualizarEstado = () => {
        const valorTipo = tipoRep.value.toUpperCase();
        const isParcelado = valorTipo === "PARCELADO";

        // REGRA NOIVA: Se mudar para PARCELADO, remove o check de indeterminado
        if (isParcelado && checkIndet.checked) {
            checkIndet.checked = false;
        }

        const isIndeterminado = checkIndet.checked;

        // Gerencia bloqueios
        qtdeInput.disabled = !isParcelado || isIndeterminado;
        qtdeInput.style.backgroundColor = qtdeInput.disabled ? "#e9ecef" : "#ffffff";
        campoTermino.disabled = isIndeterminado;
        
        if (isIndeterminado) {
            qtdeInput.value = "";
            campoTermino.value = "";
        }
        
        validarFormulario(); // Revalida o botão Enviar sempre que mudar o estado
    };

    // Listeners existentes...
    tipoRep.addEventListener("change", atualizarEstado);
    
    checkIndet.addEventListener("change", () => {
        // Se o usuário tentar marcar indeterminado sendo parcelado, avisamos ou impedimos
        if (tipoRep.value.toUpperCase() === "PARCELADO" && checkIndet.checked) {
             checkIndet.checked = false;
             Swal.fire("Atenção", "Lançamentos parcelados devem ter uma duração definida.", "info");
        }
        atualizarEstado();
        renderizarPrevia();
    });

    campoTermino.addEventListener("change", () => {
        if (campoTermino.value) {
            checkIndet.checked = false;
            if (tipoRep.value.toUpperCase() !== "PARCELADO") tipoRep.value = "PARCELADO";
            atualizarEstado();
            calcularParcelasPelaDataTermino();
            renderizarPrevia();
        }
    });

    qtdeInput.addEventListener("input", () => {
        calcularDataTerminoPorParcelas();
        renderizarPrevia();
        validarFormulario();
    });

    atualizarEstado();
}

function calcularDataTerminoPorParcelas() {
    const vcto = document.querySelector("#vctoBase").value;
    const qtdeField = document.querySelector("#qtdeParcelas");
    const qtd = parseInt(qtdeField.value);
    const periodicidade = document.querySelector("#periodicidade").value; // Ex: "Mensal"
    const dtTerminoInput = document.querySelector("#dtTermino");

    if (vcto && qtd > 0) {
        let dataFim = new Date(vcto + 'T00:00:00');
        const multiplicador = qtd - 1;

        // Garante que o switch ignore diferenças de maiúsculas/minúsculas
        const p = periodicidade.charAt(0).toUpperCase() + periodicidade.slice(1).toLowerCase();

        switch (p) {
            case "Semanal":   dataFim.setDate(dataFim.getDate() + (multiplicador * 7)); break;
            case "Quinzenal": dataFim.setDate(dataFim.getDate() + (multiplicador * 15)); break;
            case "Mensal":    dataFim.setMonth(dataFim.getMonth() + multiplicador); break;
            case "Bimestral": dataFim.setMonth(dataFim.getMonth() + (multiplicador * 2)); break;
            case "Trimestral":dataFim.setMonth(dataFim.getMonth() + (multiplicador * 3)); break;
            case "Semestral": dataFim.setMonth(dataFim.getMonth() + (multiplicador * 6)); break;
            case "Anual":     dataFim.setFullYear(dataFim.getFullYear() + multiplicador); break;
        }

        dtTerminoInput.value = dataFim.toISOString().split('T')[0];
    }
}

function calcularParcelasPelaDataTermino() {
    const vcto = document.querySelector("#vctoBase").value;
    const termino = document.querySelector("#dtTermino").value;
    const periodicidade = document.querySelector("#periodicidade").value;
    const qtdeInput = document.querySelector("#qtdeParcelas");

    if (vcto && termino) {
        const d1 = new Date(vcto + 'T00:00:00');
        const d2 = new Date(termino + 'T00:00:00');

        if (d2 < d1) return; // Data de término menor que a inicial

        let difMeses = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
        let difDias = Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
        let qtd = 1;

        const p = periodicidade.charAt(0).toUpperCase() + periodicidade.slice(1).toLowerCase();

        switch (p) {
            case "Semanal":   qtd = Math.floor(difDias / 7) + 1; break;
            case "Quinzenal": qtd = Math.floor(difDias / 15) + 1; break;
            case "Mensal":    qtd = difMeses + 1; break;
            case "Bimestral": qtd = Math.floor(difMeses / 2) + 1; break;
            case "Trimestral":qtd = Math.floor(difMeses / 3) + 1; break;
            case "Semestral": qtd = Math.floor(difMeses / 6) + 1; break;
            case "Anual":     qtd = (d2.getFullYear() - d1.getFullYear()) + 1; break;
        }

        qtdeInput.value = qtd > 0 ? qtd : 1;
    }
}


// Interpreta uma data pegando só os componentes de calendário (ano/mês/dia), nunca
// via `new Date(string)` direto — uma string sem fuso ('YYYY-MM-DD', de <input
// type=date>) é lida como hora local, e uma com 'Z' (vinda do backend, JSON de
// coluna `date`) como UTC; num mesmo dia do mês isso pode virar dias diferentes
// dependendo do fuso. Sempre ancorada ao meio-dia local (mesmo truque do
// Main.js/expandirOcorrenciasNoAno) pra nunca cair num "23h do dia anterior" por
// causa de horário de verão.
function dataCalendario(valor) {
    if (!valor) return null;
    const [ano, mes, dia] = String(valor).slice(0, 10).split('-').map(Number);
    if (!ano || !mes || !dia) return null;
    return new Date(ano, mes - 1, dia, 12, 0, 0);
}

// Gera datas sucessivas a partir de `vctoBaseValor`, avançando conforme
// `periodicidade` — extraído de calcularPreviaParcelas pra ser reaproveitado pela
// projeção de ocorrências da Visão Geral (ver mais abaixo). `paraCadaOcorrencia(data,
// numero)` decide quando parar (retornar false encerra o laço) — cada chamador tem
// seu próprio critério de limite (data-fim, qtde de parcelas, etc).
function gerarDatasRecorrentes(vctoBaseValor, periodicidade, paraCadaOcorrencia) {
    const datas = [];
    let dataAtual = dataCalendario(vctoBaseValor);
    if (!dataAtual) return datas;

    let contador = 1;
    // Trava de segurança pra evitar loop infinito (~50 anos de periodicidade mensal)
    while (contador <= 600) {
        if (!paraCadaOcorrencia(dataAtual, contador)) break;
        datas.push({ numero: contador, data: new Date(dataAtual) });

        switch (String(periodicidade || 'MENSAL').toUpperCase()) {
            case 'SEMANAL':
                dataAtual.setDate(dataAtual.getDate() + 7);
                break;
            case 'QUINZENAL':
                dataAtual.setDate(dataAtual.getDate() + 15);
                break;
            case 'TRIMESTRAL':
                dataAtual.setMonth(dataAtual.getMonth() + 3);
                break;
            case 'SEMESTRAL':
                dataAtual.setMonth(dataAtual.getMonth() + 6);
                break;
            case 'ANUAL':
                dataAtual.setFullYear(dataAtual.getFullYear() + 1);
                break;
            default: // MENSAL (e BIMESTRAL, que nunca teve case próprio aqui)
                dataAtual.setMonth(dataAtual.getMonth() + 1);
        }
        contador++;
    }
    return datas;
}

function calcularPreviaParcelas(dados) {
    if (!dados.vctobase || dados.vlrestimado <= 0) return [];

    const baseData = dataCalendario(dados.vctobase);
    const anoAtual = new Date().getFullYear(); // era hard-coded (2026) — quebrava a prévia a partir de 2027

    let limite;
    if (dados.indeterminado) {
        // Se for fixo/indeterminado, projetamos até o final do ano atual
        limite = new Date(anoAtual, 11, 31, 12, 0, 0);
    } else {
        // Se for parcelado, usamos a data de término ou 1 ano de segurança
        limite = dados.dttermino
            ? dataCalendario(dados.dttermino)
            : new Date(baseData.getFullYear() + 1, baseData.getMonth(), baseData.getDate(), 12, 0, 0);
    }

    // Trava de segurança pra evitar loops infinitos (máximo 120 parcelas)
    return gerarDatasRecorrentes(dados.vctobase, dados.periodicidade, (d, n) => d <= limite && n <= 120)
        .map(({ numero, data }) => ({
            numero,
            vencimento: data.toLocaleDateString('pt-BR'),
            valor: dados.vlrestimado,
            dataObjeto: data // Útil para filtros posteriores
        }));
}


async function carregarSelectPlanoContas() {
    const selectPlanoContas = document.querySelector("#idPlanoContasSelect");
    if (!selectPlanoContas) return;

    const valorAtual = selectPlanoContas.value;

    try {
        const planos = await fetchComToken('/planocontas');
        selectPlanoContas.innerHTML = '<option value="" disabled selected>Selecione o Plano de Contas</option>';

        if (planos && Array.isArray(planos)) {
            planos.forEach(plano => {
                if (plano.ativo) {
                    const option = document.createElement("option");
                    option.value = plano.idplanocontas;
                    option.textContent = `${plano.codigo} - ${plano.nmplanocontas}`;
                    selectPlanoContas.appendChild(option);
                }
            });
        }

        if (valorAtual) selectPlanoContas.value = valorAtual;
        ligarBuscaSelectOculto("#idPlanoContasBusca", "#idPlanoContasSelect", "planocontas-sugestoes");
        sincronizarTextoBuscaSelect("#idPlanoContasBusca", "#idPlanoContasSelect");
    } catch (error) {
        console.error("Erro ao carregar select de plano de contas:", error);
    }
}

async function carregarSelectEmpresaPagadora() {
    const selectEmpresaPagadora = document.querySelector("#empresaPagadora");
    if (!selectEmpresaPagadora) return;

    try {
        const empresas = await fetchComToken('/lancamentos/empresas');
        selectEmpresaPagadora.innerHTML = '<option value="" disabled selected>Selecione a Empresa Pagadora</option>';
        if (empresas && Array.isArray(empresas)) {
            empresas.forEach(empresa => {
               // if (empresa.ativo) {
                    const option = document.createElement("option");
                    option.value = empresa.idempresa;
                    option.textContent = empresa.nmfantasia;
                    selectEmpresaPagadora.appendChild(option);
                //}
            });
        }
        ligarBuscaSelectOculto("#empresaPagadoraBusca", "#empresaPagadora", "empresapagadora-sugestoes");
        sincronizarTextoBuscaSelect("#empresaPagadoraBusca", "#empresaPagadora");
    } catch (error) {
        console.error("Erro ao carregar empresas:", error);
    }
}

async function carregarSelectCentroCusto() {
    const selectCentroCusto = document.querySelector("#centroCusto");
    if (!selectCentroCusto) return;

    try {
        const centrocusto = await fetchComToken('/lancamentos/centrocusto');
        selectCentroCusto.innerHTML = '<option value="" disabled selected>Selecione o Centro de Custo</option>';
        if (centrocusto && Array.isArray(centrocusto)) {
            centrocusto.forEach(ccusto => {
               // if (empresa.ativo) {
                    const option = document.createElement("option");
                    option.value = ccusto.idcentrocusto;
                    option.textContent = ccusto.nmcentrocusto;
                    selectCentroCusto.appendChild(option);
                //}
            });
        }
        ligarBuscaSelectOculto("#centroCustoBusca", "#centroCusto", "centrocusto-sugestoes");
        sincronizarTextoBuscaSelect("#centroCustoBusca", "#centroCusto");
    } catch (error) {
        console.error("Erro ao carregar centro de custo:", error);
    }
}


function configurarEventosVinculo() {
    const checks = document.querySelectorAll('.tipo-vinculo');
    const labelVinculo = document.querySelector('label[for="idVinculo"]'); // Captura o label do select
    const containerVinculo = document.querySelector('#containerVinculo');
    const containerPerfil = document.querySelector('#containerPerfilFuncionario');
    const perfilRadios = document.querySelectorAll('.perfil-radio');
    const selectVinculo = document.querySelector('#idVinculo');

    // Fica desabilitado até escolher Cliente/Fornecedor/Funcionário
    if (selectVinculo) {
        selectVinculo.disabled = true;
        aplicarBuscaIncremental("#idVinculo", "");
    }

    checks.forEach(check => {
        check.addEventListener('change', async function() {
            // Se DESMARCAR, limpamos e desabilitamos tudo
            if (!this.checked) {
                limparEBloquearVinculos();
            } else {
                // Comportamento de rádio entre os tipos de vínculo
                checks.forEach(c => { if (c !== this) c.checked = false; });

                // --- NOVA LÓGICA: TROCA O TEXTO DO LABEL ---
                if (labelVinculo) {
                    const nomes = {
                        'funcionario': 'Selecione o Funcionário',
                        'fornecedor': 'Selecione o Fornecedor',
                        'cliente': 'Selecione o Cliente'
                    };
                    labelVinculo.textContent = nomes[this.value];
                    
                }

                if (this.value === 'funcionario') {
                    perfilRadios.forEach(r => r.disabled = false);
                    if (containerPerfil) containerPerfil.classList.add('visivel');
                    if (selectVinculo) selectVinculo.disabled = true;
                    if (labelVinculo) labelVinculo.classList.add('active'); // Sobe o label
                } else {
                    perfilRadios.forEach(r => {
                        r.disabled = true;
                        r.checked = false;
                    });
                    if (containerPerfil) containerPerfil.classList.remove('visivel');

                    if (selectVinculo) {
                        selectVinculo.disabled = false;
                        await carregarDadosVinculo(this.value);

                        if (labelVinculo) labelVinculo.classList.add('active'); // Sobe o label
                        if (typeof M !== 'undefined') M.FormSelect.init(selectVinculo); // Reinicia Materialize
                    }
                }
            }
            validarFormulario();
        });
    });

    perfilRadios.forEach(radio => {
        radio.addEventListener('change', async function() {
            if (this.checked) {
                if (selectVinculo) {
                    selectVinculo.disabled = false;
                    await carregarDadosVinculo('funcionario', this.value);

                    if (labelVinculo) labelVinculo.classList.add('active');
                    if (typeof M !== 'undefined') M.FormSelect.init(selectVinculo);
                }
                validarFormulario();
            }
        });
    });

    function limparEBloquearVinculos() {
        // --- RESET DO LABEL PARA O PADRÃO ---
        if (labelVinculo) {
            labelVinculo.textContent = 'Selecione o Vínculo';
            labelVinculo.classList.remove('active');
        }

        perfilRadios.forEach(r => {
            r.checked = false;
            r.disabled = true;
        });
        if (containerPerfil) containerPerfil.classList.remove('visivel');
        if (selectVinculo) {
            selectVinculo.value = "";
            selectVinculo.disabled = true;
        }
    }
}

async function carregarDadosVinculo(tipo, perfilSelecionado) {
    const selectVinculo = document.querySelector('#idVinculo');
    selectVinculo.innerHTML = '<option value="" disabled selected>Carregando...</option>';

    const rotasPlurais = {
        'cliente': 'clientes',
        'fornecedor': 'fornecedores',
        'funcionario': 'funcionarios'
    };

    try {
        // CORREÇÃO: Adicionando o perfil na URL caso ele exista
        let url = `/lancamentos/vinculo/${rotasPlurais[tipo]}`;
        
        if (perfilSelecionado) {
            url += `?perfil=${encodeURIComponent(perfilSelecionado)}`;
        }
        
        console.log("Chamando URL:", url); // Aqui você verá se o perfil está indo corretamente

        const dados = await fetchComToken(url);

        selectVinculo.innerHTML = '<option value="" disabled selected>Selecione...</option>';

        if (!dados || dados.length === 0) {
            selectVinculo.innerHTML = '<option value="" disabled selected>Nenhum registro encontrado</option>';
            return;
        }

        dados.forEach(item => {
            const option = document.createElement('option');
            option.value = item.id;
            option.textContent = item.nome;
            selectVinculo.appendChild(option);
        });

    } catch (error) {
        console.error(`Erro ao carregar ${tipo}:`, error);
        selectVinculo.innerHTML = '<option value="" disabled selected>Erro ao carregar dados</option>';
    } finally {
        aplicarBuscaIncremental("#idVinculo", "");
    }
}


function renderizarPrevia() {
    const containerPrevia = document.querySelector("#container-previa");
    if (!containerPrevia) return;

    // 1. Define o ano atual dinamicamente para evitar o erro de ReferenceError
    const anoAtual = new Date().getFullYear();

    const vlr = window.desformatarReais(document.querySelector("#vlrEstimado").value);
    const vcto = document.querySelector("#vctoBase").value;

    // Se os campos essenciais estiverem vazios, mostra o informativo
    if (!vlr || !vcto || parseFloat(vlr) <= 0) {
        containerPrevia.style.display = "block";
        containerPrevia.innerHTML = `
            <div class="previa-placeholder">
                <div class="placeholder-conteudo">
                    <span class="placeholder-icone">📊</span>
                    <h4>Cronograma de Lançamentos</h4>
                    <p>Preencha o <b>Valor Estimado</b> e o <b>Vencimento Base</b> para visualizar a projeção das parcelas aqui.</p>
                </div>
            </div>
        `;
        return;
    }

    // 2. Coleta dados atuais (Certifique-se que o ID no HTML é #qtdeParcelas ou #qtdParcelas)
    const dados = {
        vlrestimado: parseFloat(vlr) || 0,
        vctobase: vcto,
        periodicidade: document.querySelector("#periodicidade").value,
        dttermino: document.querySelector("#dtTermino").value,
        indeterminado: document.querySelector("#indeterminado").checked,
        qtdparcelas: parseInt(document.querySelector("#qtdeParcelas")?.value) || 0,
        tipoRepeticao: document.querySelector("#tipoRepeticao").value,
        observacao: document.querySelector("#observacao").value
    };

    const todasParcelas = calcularPreviaParcelas(dados);
    
    // 3. Lógica de Filtro: 12 meses para indeterminado ou todas para fixo/parcelado
    const hoje = new Date();
    // Zera as horas para comparar apenas datas
    hoje.setHours(0, 0, 0, 0); 
    
    const dozeMesesParaFrente = new Date();
    dozeMesesParaFrente.setMonth(hoje.getMonth() + 12);

    const parcelasExibicao = dados.indeterminado 
        ? todasParcelas.filter(p => p.dataObjeto >= hoje && p.dataObjeto <= dozeMesesParaFrente)
        : todasParcelas;

    if (parcelasExibicao.length === 0) {
        containerPrevia.style.display = "none";
        return;
    }

    // Ativa o container
    containerPrevia.style.display = "block";

    // Lógica de divisão em 2 colunas
    const metade = Math.ceil(parcelasExibicao.length / 2);
    const col1 = parcelasExibicao.slice(0, metade);
    const col2 = parcelasExibicao.slice(metade);

    // 4. Montagem do HTML com o Título Dinâmico
    containerPrevia.innerHTML = `
        <div class="previa-wrapper">
            <h6 class="previa-titulo">
                ${dados.indeterminado 
                    ? `Projeção para os próximos 12 meses` 
                    : `Cronograma Previsto (${todasParcelas.length} parcelas)`}
            </h6>
            <div class="previa-grades">
                <div class="previa-coluna">${gerarTabelaHTML(col1, todasParcelas.length, dados.indeterminado)}</div>
                <div class="previa-coluna">${gerarTabelaHTML(col2, todasParcelas.length, dados.indeterminado)}</div>
            </div>
        </div>
    `;
}

// Função auxiliar para evitar repetição de código HTML
function gerarTabelaHTML(lista, total, isIndeterminado) {
    if (lista.length === 0) return "";
    return `
        <table class="table-previa">
            <thead>
                <tr>
                    <th>${isIndeterminado ? 'Seq.' : 'Parc.'}</th>
                    <th>Vencimento</th>
                    <th>Valor</th>
                </tr>
            </thead>
            <tbody>
                ${lista.map(p => `
                    <tr>
                        <td>${p.numero}${isIndeterminado ? '' : '/' + total}</td>
                        <td>${p.vencimento}</td>
                        <td>R$ ${p.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>`;
}


async function preencherCampos(lancamento) {
    console.log("Preenchendo campos com lançamento:", lancamento);
    
    // Use uma função auxiliar para evitar repetição e erros de null
    const setCampo = (id, valor) => {
        const el = document.querySelector(id);
        if (el) el.value = valor || "";
    };

    setCampo("#idLancamento", lancamento.idlancamento);
    setCampo("#idPlanoContasSelect", lancamento.idplanocontas);
    setCampo("#descricao", lancamento.descricao);
    const vlrEstimadoEl = document.querySelector("#vlrEstimado");
    if (vlrEstimadoEl) {
        const vlrNum = parseFloat(lancamento.vlrestimado) || 0;
        vlrEstimadoEl.value = "R$ " + vlrNum.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    setCampo("#periodicidade", lancamento.periodicidade);
    setCampo("#tipoRepeticao", lancamento.tiporepeticao);
    setCampo("#observacao", lancamento.observacao);

    // Tratamento de Datas com verificação de existência
    if (lancamento.vctobase) {
        setCampo("#vctoBase", lancamento.vctobase.split('T')[0]);
    }

    // Campo de Quantidade
    const qtde = (lancamento.qtdeparcelas !== null && lancamento.qtdeparcelas !== undefined) 
                 ? lancamento.qtdeparcelas 
                 : "";
    setCampo("#qtdeParcelas", qtde);

    // Data de Término
    if (lancamento.dttermino) {
        setCampo("#dtTermino", lancamento.dttermino.split('T')[0]);
    } else {
        setCampo("#dtTermino", "");
    }

    // O provável culpado (dtRecebimento)
    if (lancamento.dtrecebimento) {
        setCampo("#dtRecebimento", lancamento.dtrecebimento.split('T')[0]);
    } else {
        setCampo("#dtRecebimento", "");
    }

    // Checkboxes
    const chkIndet = document.querySelector("#indeterminado");
    if (chkIndet) chkIndet.checked = !!lancamento.indeterminado;

    const chkAtivo = document.querySelector("#ativo");
    if (chkAtivo) chkAtivo.checked = !!lancamento.ativo;

    const inputLocado = document.querySelector("#locadoCheck") || document.querySelector("#Locadocheck");

    if (lancamento.tipovinculo) {
        const checkVinculo = document.querySelector(`.tipo-vinculo[value="${lancamento.tipovinculo}"]`);
        if (checkVinculo) {
            checkVinculo.checked = true;

            // 1. Primeiro, garantimos que o container principal do vínculo apareça
            const selectVinculo = document.querySelector("#idVinculo");

            if (selectVinculo) selectVinculo.disabled = false;

            if (lancamento.tipovinculo === 'funcionario') {
                const containerPerfil = document.querySelector('#containerPerfilFuncionario');
                if (containerPerfil) containerPerfil.classList.add('visivel');

                let valorRadioPerfil = "";
                const p = String(lancamento.perfil_vinculo || "").toLowerCase();

                // Ajuste na verificação dos nomes dos rádios para bater com o HTML
                if (p.includes('interno') || p.includes('externo') || p.includes('funcionário')) {
                    valorRadioPerfil = "funcionário"; 
                } else if (p.includes('free') || p.includes('lote') || p.includes('free-lancer')) {
                    valorRadioPerfil = "free-lancer";
                }

                if (valorRadioPerfil) {
                    const radioPerfil = document.querySelector(`.perfil-radio[value="${valorRadioPerfil}"]`);
                    if (radioPerfil) {
                        radioPerfil.checked = true;
                        radioPerfil.disabled = false; // Garante que o rádio esteja clicável
                        
                        // ESPERA os dados carregarem para o Select ter opções dentro
                        await carregarDadosVinculo('funcionario', valorRadioPerfil);
                    }
                }
            } else {
                // Cliente ou Fornecedor
                await carregarDadosVinculo(lancamento.tipovinculo);
            }

            // 2. Agora que a lista foi montada pelo carregarDadosVinculo, setamos o ID
            if (selectVinculo && lancamento.idvinculo) {
                selectVinculo.value = String(lancamento.idvinculo);

                // Dispara o evento change caso existam outras dependências ligadas ao select
                selectVinculo.dispatchEvent(new Event('change'));
                aplicarBuscaIncremental("#idVinculo", "");
            }
        }

    }

    if (inputLocado) inputLocado.checked = !!lancamento.locado;

    const selectPlano = document.querySelector("#idPlanoContasSelect");
    if (selectPlano && lancamento.idplanocontas) {
        const valorBanco = String(lancamento.idplanocontas);
        selectPlano.value = valorBanco;

        if (selectPlano.selectedIndex <= 0) {
            console.warn("Aviso: Plano de contas não encontrado:", valorBanco);
        }
        ligarBuscaSelectOculto("#idPlanoContasBusca", "#idPlanoContasSelect", "planocontas-sugestoes");
        sincronizarTextoBuscaSelect("#idPlanoContasBusca", "#idPlanoContasSelect");
    }

    const selectEmpPagadora = document.querySelector("#empresaPagadora");
    if (selectEmpPagadora) {
        // Suporta tanto o ID vindo como Integer quanto o legado vindo como String
        const valorBanco = String(lancamento.idempresapagadora || lancamento.empresaPagadora);
        selectEmpPagadora.value = valorBanco;
        if (selectEmpPagadora.selectedIndex <= 0 && valorBanco !== "undefined" && valorBanco !== "null") {
            console.warn("Aviso: Empresa Pagadora legada ou não encontrada:", valorBanco);
        }
        ligarBuscaSelectOculto("#empresaPagadoraBusca", "#empresaPagadora", "empresapagadora-sugestoes");
        sincronizarTextoBuscaSelect("#empresaPagadoraBusca", "#empresaPagadora");
    }

    const selectCentroCusto = document.querySelector("#centroCusto");
    if (selectCentroCusto) {
        const valorBanco = String(lancamento.idcentrocusto || lancamento.centrocusto);
        selectCentroCusto.value = valorBanco;
        if (selectCentroCusto.selectedIndex <= 0 && valorBanco !== "undefined" && valorBanco !== "null") {
            console.warn("Aviso: Centro de Custo não encontrado:", valorBanco);
        }
        ligarBuscaSelectOculto("#centroCustoBusca", "#centroCusto", "centrocusto-sugestoes");
        sincronizarTextoBuscaSelect("#centroCustoBusca", "#centroCusto");
    }

    // Sincronização da Interface
    if (typeof gerenciarCampos === "function") gerenciarCampos();
    
    window.LancamentoOriginal = { ...lancamento };
    validarFormulario();
    renderizarPrevia();
}


function limparCamposLancamento() {
    const formulario = document.querySelector("form#form-lancamentos");
    
    if (formulario) {
        formulario.reset(); 
    }

    // 1. Checkboxes de estado
    const chkAtivo = document.querySelector("#ativo");
    if (chkAtivo) chkAtivo.checked = true;

    const chkIndeterminado = document.querySelector("#indeterminado");
    if (chkIndeterminado) chkIndeterminado.checked = false;

    // 2. IDs e Datas
    const idLanc = document.querySelector("#idLancamento");
    if (idLanc) idLanc.value = "";

    const dtTermino = document.querySelector("#dtTermino");
    if (dtTermino) dtTermino.disabled = false;

    // 3. Resete de Combos (planocontas, centrocusto, empresapagadora) — limpa o select
    // escondido e o input de busca visível junto.
    const camposSelectComBusca = [
        ["#idPlanoContasSelect", "#idPlanoContasBusca"],
        ["#centroCusto", "#centroCustoBusca"],
        ["#empresaPagadora", "#empresaPagadoraBusca"]
    ];
    camposSelectComBusca.forEach(([seletorSelect, seletorBusca]) => {
        const el = document.querySelector(seletorSelect);
        if (el) el.value = "";
        const inputBusca = document.querySelector(seletorBusca);
        if (inputBusca) inputBusca.value = "";
    });

    // 4. Resete de Vínculos (Lógica que criamos)
    const checksVinculo = document.querySelectorAll('.tipo-vinculo');
    checksVinculo.forEach(c => c.checked = false);

    const perfilRadios = document.querySelectorAll('.perfil-radio');
    perfilRadios.forEach(r => {
        r.checked = false;
        r.disabled = true; // Volta a ficar bloqueado/cinza
    });

    const selectVinculo = document.querySelector("#idVinculo");
    if (selectVinculo) {
        selectVinculo.value = "";
        selectVinculo.disabled = true; // Bloqueia o select de nomes
        aplicarBuscaIncremental("#idVinculo", "");
    }

    // Registrado/Sem Registro só aparece quando "Funcionário" está marcado
    const containerPerfil = document.querySelector("#containerPerfilFuncionario");
    if (containerPerfil) containerPerfil.classList.remove('visivel');

    // Reset do Label dinâmico do Vínculo para o padrão
    const labelVinculo = document.querySelector('label[for="idVinculo"]');
    if (labelVinculo) labelVinculo.textContent = 'Selecione o Vínculo';

    // 5. Interface e Prévia
    const containerPrevia = document.querySelector("#container-previa");
    if (containerPrevia) {
        containerPrevia.innerHTML = "";
        containerPrevia.style.display = "none";
    }

    // Descrição: só limpa o texto digitado/selecionado (continua sendo um input comum)
    const campoDescricao = document.querySelector("#descricao");
    if (campoDescricao) campoDescricao.value = "";

    // 6. Finalização
    window.LancamentoOriginal = {};
    validarFormulario();
    
    console.log("Campos de vínculo, conta e financeiros resetados.");
}


// Lista os campos obrigatórios que ainda faltam preencher — reaproveitada tanto
// pelo aviso visual (validarFormulario, abaixo) quanto pelo bloqueio de verdade
// no clique de Enviar (ver botaoEnviar.onclick): o botão fica sempre clicável
// (nunca disabled) porque um lançamento antigo pode ter vindo do banco sem
// Centro de Custo/Empresa Pagadora/Vínculo preenchidos — desabilitar o botão
// nesses casos travava até uma simples correção de valor, sem dar nenhuma pista
// visível do motivo. Agora o clique sempre roda, e só bloqueia o envio (com um
// Swal explicando o que falta) se algo realmente estiver em branco.
function coletarErrosLancamento() {
    const valor = window.desformatarReais(document.querySelector("#vlrEstimado").value);
    const vcto = document.querySelector("#vctoBase").value;

    const idPlanoContas = document.querySelector("#idPlanoContasSelect").value;
    const centroCusto = document.querySelector("#centroCusto").value;
    const empresaPag = document.querySelector("#empresaPagadora").value;

    const tipoRepeticao = document.querySelector("#tipoRepeticao")?.value.toUpperCase();
    const indeterminado = document.querySelector("#indeterminado")?.checked;
    const dtTermino = document.querySelector("#dtTermino")?.value;
    const qtdeParcelas = document.querySelector("#qtdeParcelas")?.value;

    const checksVinculo = document.querySelectorAll('.tipo-vinculo:checked');
    const perfilSelecionado = document.querySelector(".perfil-radio:checked");
    const vinculoSelecionado = document.querySelector("#idVinculo");

    const erros = [];

    if (!valor || valor <= 0) erros.push("Valor Estimado");
    if (!vcto) erros.push("Vencimento Base");
    if (!idPlanoContas) erros.push("Plano de Contas");
    if (!centroCusto) erros.push("Centro de Custo");
    if (!empresaPag) erros.push("Empresa Pagadora");

    if (checksVinculo.length > 0) {
        const tipo = checksVinculo[0].value;

        if (tipo === 'funcionario' && !perfilSelecionado) {
            erros.push("Perfil (Registrado/Sem Registro)");
        }

        if (!vinculoSelecionado || vinculoSelecionado.value === "" || vinculoSelecionado.value === "0") {
            const labelNome = tipo === 'funcionario' ? 'Funcionário' : (tipo === 'cliente' ? 'Cliente' : 'Fornecedor');
            erros.push(`Nome do ${labelNome}`);
        }
    } else {
        erros.push("Tipo de Vínculo (Cliente/Fornecedor/Funcionário)");
    }

    if (tipoRepeticao === "PARCELADO") {
        if (!indeterminado && !dtTermino && (!qtdeParcelas || qtdeParcelas <= 0)) {
            erros.push("Qtde de Parcelas ou Data de Término");
        }
    }

    return erros;
}

function validarFormulario() {
    const botao = document.querySelector("#lcLancEnviar");
    if (!botao) return;
    const erros = coletarErrosLancamento();
    botao.title = erros.length ? "Campos obrigatórios faltantes: \n- " + erros.join("\n- ") : "Tudo pronto para enviar";
}

// ===================== ABA "VISÃO GERAL" =====================
// Lista os lançamentos com filtros (plano de contas, centro de custo, nome, vínculo,
// período de vencimento/pagamento) — mesmo padrão da Visão Geral de Faturamento
// (Faturamento.js), adaptado pra lançamentos financeiros. Diferença central:
// lançamentos FIXO/PARCELADO recorrentes só ganham uma linha em `pagamentos` quando
// alguém baixa aquele mês — meses futuros não têm registro físico. Por isso o período
// de vencimento também projeta as ocorrências ainda não geradas (mesma regra de
// Main.js/expandirOcorrenciasNoAno, reaproveitando aqui gerarDatasRecorrentes), e o
// período de pagamento só bate em parcelas já realmente lançadas/pagas.

let vgListaBruta = [];   // resposta crua do backend (1 linha por lançamento x pagamento)
let vgLinhasAtuais = []; // ocorrências (reais+projetadas) já filtradas por período, prontas pra tabela
let vgOrdenacao = { campo: null, direcao: 1 };
let vgFiltrosCarregados = false;
let vgFiltroEmpresaPagadoraPopulado = false;
let vgEventosLigados = false;

const VG_STATUS_LABEL = { pago: 'Pago', pendente: 'A vencer', atrasado: 'Atrasado', previsto: 'Previsto' };
const VG_CAMPOS_NUMERICOS = new Set(['valor']);
const VG_CAMPOS_DATA = new Set(['dtvcto', 'dtpgto']);

function vgMoeda(n) {
    return 'R$ ' + (typeof window.formatarReaisValor === 'function' ? window.formatarReaisValor(n || 0) : (parseFloat(n) || 0).toFixed(2));
}

function vgMascararData(input) {
    const digitos = input.value.replace(/\D/g, '').slice(0, 8);
    if (digitos.length > 4) input.value = `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`;
    else if (digitos.length > 2) input.value = `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
    else input.value = digitos;
}

function vgDataBRParaISO(dataBR) {
    if (!dataBR || !dataBR.includes('/')) return null;
    const [d, m, a] = dataBR.split('/');
    if (!d || !m || !a || a.length < 4) return null;
    return `${a}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function vgFormatarDataBR(valor) {
    const d = dataCalendario(valor);
    return d ? d.toLocaleDateString('pt-BR') : '—';
}

// Resolve um dos dois grupos de período (Vencimento/Pagamento): só usa "Ano atual"
// quando os campos De/Até do próprio grupo estão vazios — mesma regra do Faturamento
// (periodoAnoAtualSeVazio). Pode devolver {de:null, ate:null} (sem filtro nenhum).
function vgPeriodo(checkboxId, deId, ateId) {
    const marcado = document.getElementById(checkboxId).checked;
    const de = document.getElementById(deId).value.trim();
    const ate = document.getElementById(ateId).value.trim();
    if (de || ate) return { de: vgDataBRParaISO(de), ate: vgDataBRParaISO(ate) };
    if (!marcado) return { de: null, ate: null };
    const ano = new Date().getFullYear();
    return { de: `${ano}-01-01`, ate: `${ano}-12-31` };
}

// Vencimento é sempre resolvido a um intervalo concreto (diferente de Pagamento, que
// pode ficar totalmente livre) — a projeção de FIXO/PARCELADO precisa de algum teto,
// senão um lançamento antigo sem parcela recente viraria uma lista infinita de
// "previsto" desde o início dele. Sem período informado, cai no ano corrente.
function vgPeriodoVencimento() {
    const resolvido = vgPeriodo('lcVgVencimentoAnoAtual', 'lcVgVencimentoDe', 'lcVgVencimentoAte');
    if (resolvido.de && resolvido.ate) return resolvido;
    const ano = new Date().getFullYear();
    return { de: `${ano}-01-01`, ate: `${ano}-12-31` };
}

function vgDescricaoPeriodoImpressao(checkboxId, deId, ateId) {
    const marcado = document.getElementById(checkboxId).checked;
    const de = document.getElementById(deId).value.trim();
    const ate = document.getElementById(ateId).value.trim();
    if (marcado && !de && !ate) return `Ano atual (${new Date().getFullYear()})`;
    if (!de && !ate) return 'Todos';
    return `${de || '—'} a ${ate || '—'}`;
}

function vgMontarQueryFiltros() {
    const params = new URLSearchParams();
    const idlancamento = document.getElementById('lcVgFiltroDescricao').value;
    const idplanocontas = document.getElementById('lcVgPlanoContasSelect').value;
    const idcentrocusto = document.getElementById('lcVgCentroCustoSelect').value;
    const idempresapagadora = document.getElementById('lcVgFiltroEmpresaPagadora').value;
    const tipoVinculoCheck = document.querySelector('.tipo-vinculo-vg:checked');
    const idvinculo = document.getElementById('lcVgFiltroVinculo').value;

    if (idlancamento) params.set('idlancamento', idlancamento);
    if (idplanocontas) params.set('idplanocontas', idplanocontas);
    if (idcentrocusto) params.set('idcentrocusto', idcentrocusto);
    if (idempresapagadora) params.set('idempresapagadora', idempresapagadora);
    // Marcar só o tipo (Cliente/Fornecedor/Funcionário), sem escolher um vínculo
    // específico ("Todos" no select), já filtra por esse tipo inteiro — antes só
    // filtrava quando os dois vinham preenchidos, e marcar só o tipo não fazia nada.
    if (tipoVinculoCheck) {
        params.set('tipovinculo', tipoVinculoCheck.value);
        if (idvinculo) params.set('idvinculo', idvinculo);
    }
    return params.toString();
}

// Plano de Contas / Centro de Custo do filtro — selects visíveis normais (não o
// padrão input-de-busca-com-sugestões do cadastro: aquele só mostra opções depois de
// digitar 2+ caracteres e nada aparece só de focar o campo, o que é ótimo pra reduzir
// uma lista longona no cadastro mas é ruim pra um filtro — aqui a pessoa quer ver tudo
// já ao abrir o combo).
async function vgCarregarFiltrosSelects() {
    if (vgFiltrosCarregados) return;
    vgFiltrosCarregados = true;

    try {
        const lancamentos = await fetchComToken('/lancamentos');
        const select = document.getElementById('lcVgFiltroDescricao');
        select.innerHTML = '<option value="">Todos</option>' +
            (Array.isArray(lancamentos) ? lancamentos : [])
                .map((l) => `<option value="${l.idlancamento}">${l.descricao}</option>`).join('');
    } catch (error) {
        console.error('Erro ao carregar lançamentos (Visão Geral):', error);
    }

    try {
        const planos = await fetchComToken('/planocontas');
        const select = document.getElementById('lcVgPlanoContasSelect');
        select.innerHTML = '<option value="">Todos</option>' +
            (Array.isArray(planos) ? planos : []).filter((p) => p.ativo)
                .map((p) => `<option value="${p.idplanocontas}">${p.codigo} - ${p.nmplanocontas}</option>`).join('');
    } catch (error) {
        console.error('Erro ao carregar plano de contas (Visão Geral):', error);
    }

    try {
        const centros = await fetchComToken('/lancamentos/centrocusto');
        const select = document.getElementById('lcVgCentroCustoSelect');
        select.innerHTML = '<option value="">Todos</option>' +
            (Array.isArray(centros) ? centros : []).map((c) => `<option value="${c.idcentrocusto}">${c.nmcentrocusto}</option>`).join('');
    } catch (error) {
        console.error('Erro ao carregar centro de custo (Visão Geral):', error);
    }
}

// Empresa Pagadora do filtro: montado a partir da 1ª carga (sem filtro nenhum) da
// própria Visão Geral, não de uma lista separada — só interessam aqui as empresas que
// realmente aparecem no ambiente atual (próprias + "emprestadas" do ambiente 1, ver
// GET /lancamentos/visao-geral). Só roda uma vez: um filtro aplicado depois não pode
// encolher as próprias opções do combo (mesma regra de popularFiltrosPendentes em
// Faturamento.js).
function vgPopularFiltroEmpresaPagadora(listaBruta) {
    if (vgFiltroEmpresaPagadoraPopulado) return;
    vgFiltroEmpresaPagadoraPopulado = true;

    const mapa = new Map();
    listaBruta.forEach((l) => {
        if (l.idempresapagadora != null && !mapa.has(l.idempresapagadora)) {
            mapa.set(l.idempresapagadora, l.empresapagadora_nome || `#${l.idempresapagadora}`);
        }
    });
    const opcoes = [...mapa.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));

    const select = document.getElementById('lcVgFiltroEmpresaPagadora');
    select.innerHTML = '<option value="">Todas</option>' +
        opcoes.map(([id, nome]) => `<option value="${id}">${nome}</option>`).join('');
}

// Vínculo do filtro: mesmo conceito do cadastro (checkbox tipo-rádio + select que
// carrega ao escolher o tipo, via GET /lancamentos/vinculo/:tipo já existente), só que
// mais simples — sem o sub-filtro de perfil (Registrado/Sem Registro), desnecessário
// pra um filtro de pesquisa. Classe própria (.tipo-vinculo-vg) pra não cair nos
// querySelectorAll('.tipo-vinculo') do cadastro (configurarEventosVinculo).
function vgConfigurarFiltroVinculo() {
    const checks = document.querySelectorAll('.tipo-vinculo-vg');
    const select = document.getElementById('lcVgFiltroVinculo');
    if (!select || !checks.length) return;

    const rotasPlurais = { cliente: 'clientes', fornecedor: 'fornecedores', funcionario: 'funcionarios' };

    checks.forEach((check) => {
        check.addEventListener('change', async function () {
            if (!this.checked) {
                select.innerHTML = '<option value="">Todos</option>';
                select.disabled = true;
                return;
            }
            checks.forEach((c) => { if (c !== this) c.checked = false; });
            select.disabled = true;
            select.innerHTML = '<option value="">Carregando...</option>';
            try {
                const dados = await fetchComToken(`/lancamentos/vinculo/${rotasPlurais[this.value]}`);
                select.innerHTML = '<option value="">Todos</option>' +
                    (dados || []).map((item) => `<option value="${item.id}">${item.nome}</option>`).join('');
            } catch (error) {
                console.error('Erro ao carregar vínculo (Visão Geral):', error);
                select.innerHTML = '<option value="">Erro ao carregar</option>';
            } finally {
                select.disabled = false;
            }
        });
    });
}

// Chave usada pra "casar" uma ocorrência projetada com uma parcela real já gerada, pra
// não contar a mesma competência duas vezes — mesmo critério (lançamento+ano+mês) que
// o Main.js já usa em expandirOcorrenciasNoAno/ocupacaoMensal.
function vgChaveCompetencia(idlancamento, data) {
    return `${idlancamento}-${data.getFullYear()}-${data.getMonth()}`;
}

function vgCamposComuns(base) {
    return {
        idlancamento: base.idlancamento, descricao: base.descricao,
        nmplanocontas: base.nmplanocontas, planocontas_codigo: base.planocontas_codigo,
        nmcentrocusto: base.nmcentrocusto, nome_vinculo: base.nome_vinculo,
        tipovinculo: base.tipovinculo, empresapagadora_nome: base.empresapagadora_nome,
        // "Emprestado" do ambiente 1 (ver comentário na rota /visao-geral) — proprioambiente
        // vem do backend já como boolean (comparação l.idempresa = $1 feita em SQL).
        proprioambiente: base.proprioambiente !== false, ambienteorigem_nome: base.ambienteorigem_nome,
    };
}

// Monta, por lançamento, a lista de ocorrências (reais + projetadas) dentro do
// período de vencimento resolvido (sempre concreto — ver vgPeriodoVencimento).
function vgExpandirOcorrencias(listaBruta, periodoVencimento) {
    const porLancamento = new Map();
    listaBruta.forEach((linha) => {
        if (!porLancamento.has(linha.idlancamento)) porLancamento.set(linha.idlancamento, []);
        porLancamento.get(linha.idlancamento).push(linha);
    });

    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const de = dataCalendario(periodoVencimento.de);
    const ate = dataCalendario(periodoVencimento.ate);
    const linhasFinais = [];

    porLancamento.forEach((linhas) => {
        const base = linhas[0]; // dados do lançamento são iguais em todas as linhas (join 1:N)
        const chavesReais = new Set();

        linhas.forEach((linha) => {
            if (!linha.idpagamento) return; // linha "vazia" do LEFT JOIN (lançamento sem nenhuma parcela ainda)
            const dataVcto = dataCalendario(linha.dtvcto);
            if (dataVcto) chavesReais.add(vgChaveCompetencia(linha.idlancamento, dataVcto));

            let status = 'pendente';
            if (linha.status === 'pago') status = 'pago';
            else if (dataVcto && dataVcto < hoje) status = 'atrasado';

            linhasFinais.push({
                ...vgCamposComuns(base),
                dtvcto: linha.dtvcto, dtpgto: linha.dtpgto,
                numparcela: linha.numparcela, totalparcelas: linha.totalparcelas,
                valor: parseFloat(linha.vlrreal ?? linha.vlrprevisto ?? base.vlrestimado) || 0,
                vlrpago: parseFloat(linha.vlrpago) || 0,
                status, origem: 'real',
            });
        });

        const ehFixo = base.tiporepeticao === 'FIXO' || base.indeterminado === true;
        const ehParcelado = base.tiporepeticao === 'PARCELADO';
        if (!ehFixo && !ehParcelado) return; // sem repetição conhecida: só a parcela real (se houver) entra

        const maxN = ehFixo ? Infinity : (parseInt(base.qtdeparcelas, 10) || 1);
        const termino = base.dttermino ? dataCalendario(base.dttermino) : null;

        gerarDatasRecorrentes(base.vctobase, base.periodicidade, (d, n) => {
            if (n > maxN) return false;
            if (termino && d > termino) return false;
            return d <= ate;
        }).forEach(({ numero, data }) => {
            if (data < de) return;
            if (chavesReais.has(vgChaveCompetencia(base.idlancamento, data))) return; // já tem parcela real nesse mês
            linhasFinais.push({
                ...vgCamposComuns(base),
                dtvcto: data.toISOString(), dtpgto: null,
                numparcela: numero, totalparcelas: ehParcelado ? base.qtdeparcelas : null,
                valor: parseFloat(base.vlrestimado) || 0, vlrpago: 0,
                status: 'previsto', origem: 'projetado',
            });
        });
    });

    return linhasFinais;
}

function vgAplicarFiltrosPeriodo(linhas, periodoVencimento, periodoPagamento) {
    const vDe = dataCalendario(periodoVencimento.de);
    const vAte = dataCalendario(periodoVencimento.ate);
    const pDe = dataCalendario(periodoPagamento.de);
    const pAte = dataCalendario(periodoPagamento.ate);

    return linhas.filter((l) => {
        if (vDe && vAte) {
            const d = dataCalendario(l.dtvcto);
            if (!d || d < vDe || d > vAte) return false;
        }
        if (pDe && pAte) {
            const d = dataCalendario(l.dtpgto);
            if (!d || d < pDe || d > pAte) return false;
        }
        return true;
    });
}

// "Previsto" (ocorrência projetada, ainda sem parcela real gerada) conta como
// "Pendente" pra esse filtro — pro usuário as duas são igualmente "ainda não venceu,
// ainda não foi paga"; a distinção real/projetado é só um detalhe técnico interno
// (ver vgExpandirOcorrencias), não algo que faça sentido filtrar separadamente aqui.
const VG_STATUS_PARA_FILTRO = { pago: 'pago', atrasado: 'atrasado', pendente: 'pendente', previsto: 'pendente' };

function vgLerFiltroStatus() {
    const marcados = new Set();
    document.querySelectorAll('.lc-vg-status:checked').forEach((c) => marcados.add(c.value));
    return marcados;
}

function vgAplicarFiltroStatus(linhas, statusMarcados) {
    return linhas.filter((l) => statusMarcados.has(VG_STATUS_PARA_FILTRO[l.status] || l.status));
}

function vgCalcularTotais(linhas) {
    return linhas.reduce((acc, l) => {
        const valor = parseFloat(l.valor) || 0;
        acc.previsto += valor;
        if (l.status === 'pago') acc.pago += parseFloat(l.vlrpago) || valor;
        else {
            acc.aPagar += valor;
            if (l.status === 'atrasado') acc.vencido += valor;
        }
        return acc;
    }, { previsto: 0, pago: 0, aPagar: 0, vencido: 0 });
}

function vgAtualizarTotais(linhas) {
    const t = vgCalcularTotais(linhas);
    document.getElementById('lcVgTotalPrevisto').textContent = vgMoeda(t.previsto);
    document.getElementById('lcVgTotalPago').textContent = vgMoeda(t.pago);
    document.getElementById('lcVgTotalAPagar').textContent = vgMoeda(t.aPagar);
    document.getElementById('lcVgTotalVencido').textContent = vgMoeda(t.vencido);
}

function vgRenderizarLinhas(linhas) {
    const tbody = document.getElementById('lcVgTabelaBody');
    if (!linhas.length) {
        tbody.innerHTML = '<tr><td colspan="10">Nenhum lançamento encontrado para os filtros selecionados.</td></tr>';
        vgAtualizarTotais([]);
        return;
    }
    tbody.innerHTML = linhas.map((l) => `
        <tr class="${l.proprioambiente ? 'lc-row-editavel' : ''}" data-idlancamento="${l.idlancamento}" data-proprioambiente="${l.proprioambiente}"
            title="${l.proprioambiente ? 'Duplo clique para abrir esse lançamento' : 'Cadastrado em outro ambiente — só visualização por aqui'}">
            <td>${l.descricao || '—'}</td>
            <td>${l.nmplanocontas ? `${l.planocontas_codigo ? l.planocontas_codigo + ' - ' : ''}${l.nmplanocontas}` : '—'}</td>
            <td>${l.nmcentrocusto || '—'}</td>
            <td>${l.empresapagadora_nome || '—'}${l.proprioambiente ? '' : ` <span class="lc-chip emprestado" title="Cadastrado no ambiente ${l.ambienteorigem_nome || '—'}, só visualização por aqui">Ambiente ${l.ambienteorigem_nome || '—'}</span>`}</td>
            <td>${l.nome_vinculo || '—'}</td>
            <td>${vgFormatarDataBR(l.dtvcto)}</td>
            <td>${l.numparcela ? `${l.numparcela}${l.totalparcelas ? '/' + l.totalparcelas : ''}` : '—'}</td>
            <td class="lc-num">${vgMoeda(l.valor)}</td>
            <td>${l.dtpgto ? vgFormatarDataBR(l.dtpgto) : '—'}</td>
            <td><span class="lc-chip ${l.status}">${VG_STATUS_LABEL[l.status] || l.status}</span></td>
        </tr>`).join('');
    vgAtualizarTotais(linhas);
}

function vgAplicarOrdenacaoAtual(lista) {
    if (!vgOrdenacao.campo) return lista;
    const campo = vgOrdenacao.campo;
    const numerico = VG_CAMPOS_NUMERICOS.has(campo);
    const data = VG_CAMPOS_DATA.has(campo);

    return [...lista].sort((a, b) => {
        let va = a[campo]; let vb = b[campo];
        if (va == null && vb == null) return 0;
        if (va == null) return 1;
        if (vb == null) return -1;
        if (numerico) { va = parseFloat(va) || 0; vb = parseFloat(vb) || 0; }
        else if (data) { va = new Date(va).getTime(); vb = new Date(vb).getTime(); }
        else { va = String(va).toLowerCase(); vb = String(vb).toLowerCase(); }
        if (va < vb) return -1 * vgOrdenacao.direcao;
        if (va > vb) return 1 * vgOrdenacao.direcao;
        return 0;
    });
}

function vgAtualizarSetasOrdenacao() {
    document.querySelectorAll('#lcVgTabelaHead th[data-sort]').forEach((th) => {
        const seta = th.querySelector('.lc-seta');
        if (!seta) return;
        seta.textContent = th.dataset.sort === vgOrdenacao.campo ? (vgOrdenacao.direcao === 1 ? '▲' : '▼') : '';
    });
}

function vgOrdenar(campo) {
    vgOrdenacao.direcao = (vgOrdenacao.campo === campo) ? -vgOrdenacao.direcao : 1;
    vgOrdenacao.campo = campo;
    vgAtualizarSetasOrdenacao();
    vgRenderizarLinhas(vgAplicarOrdenacaoAtual(vgLinhasAtuais));
}

async function carregarVisaoGeralLancamentos() {
    const tbody = document.getElementById('lcVgTabelaBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="10">Carregando...</td></tr>';

    try {
        const query = vgMontarQueryFiltros();
        vgListaBruta = await fetchComToken(`/lancamentos/visao-geral${query ? '?' + query : ''}`);
        vgPopularFiltroEmpresaPagadora(vgListaBruta || []);

        const periodoVencimento = vgPeriodoVencimento();
        const periodoPagamento = vgPeriodo('lcVgPagamentoAnoAtual', 'lcVgPagamentoDe', 'lcVgPagamentoAte');

        let linhas = vgExpandirOcorrencias(vgListaBruta || [], periodoVencimento);
        linhas = vgAplicarFiltrosPeriodo(linhas, periodoVencimento, periodoPagamento);
        linhas = vgAplicarFiltroStatus(linhas, vgLerFiltroStatus());

        vgLinhasAtuais = linhas;
        vgOrdenacao = { campo: null, direcao: 1 };
        vgAtualizarSetasOrdenacao();
        vgRenderizarLinhas(linhas);
    } catch (error) {
        console.error('Erro ao carregar visão geral de lançamentos:', error);
        tbody.innerHTML = '<tr><td colspan="10">Erro ao carregar lançamentos.</td></tr>';
    }
}

function vgLimparFiltros() {
    document.getElementById('lcVgFiltroDescricao').value = '';
    document.getElementById('lcVgPlanoContasSelect').value = '';
    document.getElementById('lcVgCentroCustoSelect').value = '';
    document.getElementById('lcVgFiltroEmpresaPagadora').value = '';
    document.querySelectorAll('.tipo-vinculo-vg').forEach((c) => { c.checked = false; });
    const selectVinculo = document.getElementById('lcVgFiltroVinculo');
    selectVinculo.innerHTML = '<option value="">Todos</option>';
    selectVinculo.disabled = true;
    ['lcVgVencimentoDe', 'lcVgVencimentoAte', 'lcVgPagamentoDe', 'lcVgPagamentoAte'].forEach((id) => {
        document.getElementById(id).value = '';
    });
    document.getElementById('lcVgVencimentoAnoAtual').checked = true;
    document.getElementById('lcVgPagamentoAnoAtual').checked = false;
    document.querySelectorAll('.lc-vg-status').forEach((c) => { c.checked = true; });
    carregarVisaoGeralLancamentos();
}

function vgEscaparAtributo(texto) { return String(texto ?? '').replace(/"/g, '&quot;'); }

function vgCabecalhoImpressao(subtitulo, filtros) {
    return `
        <div class="lc-print-topo">Lançamentos Financeiros</div>
        <div class="lc-print-barra-titulo">Visão Geral — ${vgEscaparAtributo(subtitulo)}</div>
        <div class="lc-print-filtros">${filtros.map((f) => `<span class="lc-print-badge">${vgEscaparAtributo(f)}</span>`).join('')}</div>`;
}

function vgImprimirHtmlEmIframe(conteudoHtml) {
    const iframe = document.getElementById('lcPrintIframe');
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Lançamentos — Visão Geral</title>
        <style>
            @page { size: A4 landscape; margin: 1cm; }
            * { -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact; }
            body { font-family: Arial, sans-serif; color: #222; margin: 0; }
            .lc-print-topo { background: #eef0f2; padding: 10px 16px; border-radius: 6px 6px 0 0; text-align: center; font-size: 24px; font-weight: bold; }
            .lc-print-barra-titulo { background: #7e7e7e; color: #fff; font-size: 13px; font-weight: bold; padding: 6px 16px; }
            .lc-print-filtros { margin: 8px 16px 14px; }
            .lc-print-badge { display: inline-block; background: #eef0f2; border: 1px solid #c8ccd0; border-radius: 12px; padding: 3px 10px; margin: 2px 4px 2px 0; font-size: 11px; color: #7e7e7e; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; margin: 0 0 12px; }
            th, td { border: 1px solid #ccc; padding: 5px 7px; text-align: left; }
            th { background: #ddd; color: #000; font-weight: bold; }
            tbody tr:nth-child(even) { background: #f5f6f7; }
            td.num, th.num { text-align: right; }
            tr.total-geral td { background: #7e7e7e; color: #fff; font-weight: bold; }
        </style>
    </head><body>${conteudoHtml}</body></html>`);
    doc.close();
    // Pequeno atraso pra garantir que o iframe renderizou antes de imprimir.
    setTimeout(() => { iframe.contentWindow.focus(); iframe.contentWindow.print(); }, 300);
}

function vgTextoSelecionado(idSelect) {
    const select = document.getElementById(idSelect);
    return select.options[select.selectedIndex]?.textContent || 'Todos';
}

const VG_STATUS_FILTRO_LABEL = { pendente: 'Pendentes', atrasado: 'Vencidas', pago: 'Pagas' };

function vgDescricaoFiltroStatus() {
    const marcados = ['pendente', 'atrasado', 'pago'].filter((v) => document.querySelector(`.lc-vg-status[value="${v}"]`).checked);
    if (marcados.length === 3 || marcados.length === 0) return 'Todas';
    return marcados.map((v) => VG_STATUS_FILTRO_LABEL[v]).join(', ');
}

function vgImprimir() {
    const linhas = vgAplicarOrdenacaoAtual(vgLinhasAtuais);
    const totais = vgCalcularTotais(linhas);

    const filtros = [
        `Nome: ${vgTextoSelecionado('lcVgFiltroDescricao')}`,
        `Plano de Contas: ${vgTextoSelecionado('lcVgPlanoContasSelect')}`,
        `Centro de Custo: ${vgTextoSelecionado('lcVgCentroCustoSelect')}`,
        `Empresa Pagadora: ${vgTextoSelecionado('lcVgFiltroEmpresaPagadora')}`,
        `Status: ${vgDescricaoFiltroStatus()}`,
        `Vencimento: ${vgDescricaoPeriodoImpressao('lcVgVencimentoAnoAtual', 'lcVgVencimentoDe', 'lcVgVencimentoAte')}`,
        `Pagamento: ${vgDescricaoPeriodoImpressao('lcVgPagamentoAnoAtual', 'lcVgPagamentoDe', 'lcVgPagamentoAte')}`,
    ];

    const linhasHtml = linhas.map((l) => `
        <tr>
            <td>${vgEscaparAtributo(l.descricao)}</td>
            <td>${vgEscaparAtributo(l.nmplanocontas)}</td>
            <td>${vgEscaparAtributo(l.nmcentrocusto)}</td>
            <td>${vgEscaparAtributo(l.empresapagadora_nome)}${l.proprioambiente ? '' : ` (ambiente ${vgEscaparAtributo(l.ambienteorigem_nome)})`}</td>
            <td>${vgEscaparAtributo(l.nome_vinculo)}</td>
            <td>${vgFormatarDataBR(l.dtvcto)}</td>
            <td class="num">${vgMoeda(l.valor)}</td>
            <td>${l.dtpgto ? vgFormatarDataBR(l.dtpgto) : '—'}</td>
            <td>${VG_STATUS_LABEL[l.status] || l.status}</td>
        </tr>`).join('');

    const conteudo = `
        ${vgCabecalhoImpressao('Lançamentos filtrados', filtros)}
        <table>
            <thead><tr><th>Descrição</th><th>Plano de Contas</th><th>Centro de Custo</th><th>Empresa Pagadora</th><th>Vínculo</th><th>Vencimento</th><th class="num">Valor</th><th>Dt Pagto</th><th>Status</th></tr></thead>
            <tbody>${linhasHtml || '<tr><td colspan="9">Nenhum lançamento encontrado.</td></tr>'}</tbody>
            <tfoot>
                <tr class="total-geral">
                    <td colspan="6">Total previsto</td>
                    <td class="num">${vgMoeda(totais.previsto)}</td>
                    <td colspan="2"></td>
                </tr>
            </tfoot>
        </table>`;

    vgImprimirHtmlEmIframe(conteudo);
}

// Duplo clique numa linha da Visão Geral abre aquele lançamento pra edição na aba
// "Lançamentos" — reaproveita mapaLancamentoPorId (já carregado por
// configurarComboboxDescricao, mesmo formato que preencherCampos espera) e a própria
// preencherCampos, exatamente como já acontece ao escolher uma sugestão na Descrição.
// Linhas "emprestadas" de outro ambiente (ver proprioambiente) não abrem — o cadastro
// real continua exclusivo de quem estiver logado no ambiente dono do lançamento.
async function vgAbrirLancamentoParaEdicao(idlancamento, proprioambiente) {
    if (proprioambiente !== 'true') {
        if (window.Swal) {
            Swal.fire({ icon: 'info', title: 'Só visualização', text: 'Esse lançamento foi cadastrado em outro ambiente — abra-o de lá pra editar.' });
        }
        return;
    }
    const item = mapaLancamentoPorId[idlancamento];
    if (!item) {
        if (window.Swal) {
            Swal.fire({ icon: 'warning', title: 'Ainda carregando', text: 'Aguarde a lista de lançamentos terminar de carregar e tente de novo.' });
        }
        return;
    }
    mudarAba('lista');
    await preencherCampos(item);
}

function configurarVisaoGeralLancamentos() {
    vgCarregarFiltrosSelects();
    carregarVisaoGeralLancamentos();

    if (vgEventosLigados) return;
    vgEventosLigados = true;

    vgConfigurarFiltroVinculo();
    document.getElementById('lcVgBtnFiltrar')?.addEventListener('click', carregarVisaoGeralLancamentos);
    document.getElementById('lcVgBtnLimpar')?.addEventListener('click', vgLimparFiltros);
    document.getElementById('lcVgBtnImprimir')?.addEventListener('click', vgImprimir);
    document.querySelectorAll('#lcVgTabelaHead th[data-sort]').forEach((th) => {
        th.addEventListener('click', () => vgOrdenar(th.dataset.sort));
    });
    ['lcVgVencimentoDe', 'lcVgVencimentoAte', 'lcVgPagamentoDe', 'lcVgPagamentoAte'].forEach((id) => {
        document.getElementById(id)?.addEventListener('input', function () { vgMascararData(this); });
    });
    document.getElementById('lcVgTabelaBody')?.addEventListener('dblclick', (e) => {
        const tr = e.target.closest('tr[data-idlancamento]');
        if (tr) vgAbrirLancamentoParaEdicao(tr.dataset.idlancamento, tr.dataset.proprioambiente);
    });
}

function mudarAba(nome) {
    document.querySelectorAll('#cadModalLancamentos .lc-tab-btn').forEach((b) =>
        b.classList.toggle('ativa', b.dataset.lcTab === nome));

    const nomesView = { visaogeral: 'lcViewVisaoGeral', lista: 'lcViewLista', planocontas: 'lcViewPlanoContas', centrocusto: 'lcViewCentroCusto', pagamentos: 'lcViewPagamentos' };
    document.querySelectorAll('#cadModalLancamentos .lc-view').forEach((v) =>
        v.classList.toggle('ativa', v.id === nomesView[nome]));

    document.querySelectorAll('#cadModalLancamentos .lc-btns').forEach((b) =>
        b.classList.toggle('ativa', b.dataset.lcTab === nome));

    // Recarrega ao entrar na Visão Geral — pode ter cadastrado/editado um lançamento
    // na aba "Lançamentos" desde a última vez que essa lista foi buscada.
    if (nome === 'visaogeral') carregarVisaoGeralLancamentos();
}

let pagamentosConfigurados = false;

function configurarAbasLancamentos() {
    document.querySelectorAll('#cadModalLancamentos .lc-tab-btn').forEach((btn) => {
        btn.addEventListener('click', () => mudarAba(btn.dataset.lcTab));
    });
    configurarAbaPlanoContas(carregarSelectPlanoContas);
    configurarAbaCentroCusto(carregarSelectCentroCusto);

    // configurarEventosPagamentos (Pagamentos.js) usa addEventListener em vários
    // campos sem nenhuma trava própria — chamar mais de uma vez empilharia
    // listeners duplicados a cada reabertura do modal.
    if (!pagamentosConfigurados) {
        pagamentosConfigurados = true;
        configurarEventosPagamentos();
    }
}

function configurarEventosLancamentos() {
    console.log("Configurando eventos Lancamentos...");
    verificaLancamento(); // Carrega os Funcao ao abrir o modal
    configurarAbasLancamentos();
    console.log("Entrou configurar Funcao no LANCAMENTOS.js.");
}
window.configurarEventosLancamentos = configurarEventosLancamentos;

function configurarEventosEspecificos(modulo) {
  console.log("⚙️ configurarEventosEspecificos recebeu:", modulo);
  
  if (modulo.trim().toLowerCase() === 'lancamentos') {
    
    configurarEventosLancamentos();

    if (typeof aplicarPermissoes === "function" && window.permissoes) {// 01/06/2025
      aplicarPermissoes(window.permissoes);
    } else {
      console.warn("⚠️ aplicarPermissoes ou window.permissoes ainda não estão disponíveis.");
    }
  
  }
}
window.configurarEventosEspecificos = configurarEventosEspecificos;


function desinicializarLancamentosModal() {
    const bnts = { lcLancEnviar: enviarButtonListener, lcLancLimpar: limparButtonListener, lcLancPesquisar: pesquisarButtonListener };
    for (const [id, listener] of Object.entries(bnts)) {
        const el = document.querySelector(`#${id}`);
        if (el && listener) el.removeEventListener("click", listener);
    }
}

window.moduloHandlers = window.moduloHandlers || {};
window.moduloHandlers['Lancamentos'] = {
    configurar: configurarEventosLancamentos,
    desinicializar: desinicializarLancamentosModal
};