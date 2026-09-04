import { fetchComToken, aplicarTema } from '../utils/utils.js';
import { configurarAbaPlanoContas } from './LancamentosPlanoContasTab.js';
import { configurarAbaCentroCusto } from './LancamentosCentroCustoTab.js';

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

// Mapa DESCRICAO (maiúscula) -> lançamento completo, usado pelo combobox de descrição
let mapaDescricaoLancamento = {};

// Campo de Descrição sempre como combobox: escolhe um lançamento existente
// (carrega os dados dele) ou digita um nome novo (segue como cadastro).
async function configurarComboboxDescricao() {
    try {
        const lista = await fetchComToken("/lancamentos");
        if (!lista || !Array.isArray(lista)) return;

        mapaDescricaoLancamento = {};
        lista.forEach(item => {
            mapaDescricaoLancamento[String(item.descricao).trim().toUpperCase()] = item;
        });

        let el = document.querySelector("#descricao");
        if (!el) return;

        if (el.tagName !== "SELECT") {
            const select = document.createElement("select");
            select.id = "descricao";
            select.name = "descricao";
            select.required = true;
            select.className = "uppercase";
            el.parentNode.replaceChild(select, el);
            el = select;

            el.addEventListener("change", async function () {
                const valor = this.value.trim();
                if (!valor) return;

                const lancamento = mapaDescricaoLancamento[valor.toUpperCase()];
                if (lancamento) {
                    await preencherCampos(lancamento);
                    renderizarPrevia();
                }
                // Se não encontrado: é uma descrição nova digitada pelo usuário,
                // segue pronta para um cadastro — nada mais a fazer além de validar.
                validarFormulario();
            });
        }

        const valorAtual = el.value;
        el.innerHTML = '<option value="" selected></option>';
        lista.forEach(item => {
            const opt = new Option(`${item.descricao} - R$ ${item.vlrestimado}`, item.descricao);
            el.add(opt);
        });
        if (valorAtual) el.value = valorAtual;

        aplicarBuscaIncremental("#descricao", "Digite ou selecione um lançamento...", { tags: true });
    } catch (error) {
        console.error("Erro ao configurar combobox de descrição:", error);
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

    const botaoEnviar = document.querySelector("#Enviar");
    const botaoPesquisar = document.querySelector("#Pesquisar");
    const botaoLimpar = document.querySelector("#Limpar");
    
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
            vlrEstimado: parseFloat(document.querySelector("#vlrEstimado").value) || 0,
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


function calcularPreviaParcelas(dados) {
    const parcelas = [];
    if (!dados.vctobase || dados.vlrestimado <= 0) return parcelas;

    // Ajuste para evitar problemas de fuso horário na data (ISO para Local)
    let dataAtual = new Date(dados.vctobase + 'T00:00:00');
    const anoSistema = 2026; 

    let limite;
    if (dados.indeterminado) {
        // Se for fixo/indeterminado, projetamos até o final do ano atual
        limite = new Date(anoSistema, 11, 31); 
    } else {
        // Se for parcelado, usamos a data de término ou 1 ano de segurança
        limite = dados.dttermino ? new Date(dados.dttermino + 'T00:00:00') : new Date(dataAtual.getFullYear() + 1, dataAtual.getMonth(), dataAtual.getDate());
    }

    let contador = 1;
    // Trava de segurança para evitar loops infinitos (máximo 10 anos ou 120 parcelas)
    while (dataAtual <= limite && contador <= 120) {
        parcelas.push({
            numero: contador,
            vencimento: dataAtual.toLocaleDateString('pt-BR'),
            valor: dados.vlrestimado,
            dataObjeto: new Date(dataAtual) // Útil para filtros posteriores
        });

        // Incremento conforme periodicidade
        switch (dados.periodicidade.toUpperCase()) {
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
            default: // MENSAL
                dataAtual.setMonth(dataAtual.getMonth() + 1);
        }
        contador++;
    }
    return parcelas;
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
        aplicarBuscaIncremental("#idPlanoContasSelect", "Selecione o Plano de Contas");
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
        aplicarBuscaIncremental("#empresaPagadora", "Selecione a Empresa Pagadora");
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
        aplicarBuscaIncremental("#centroCusto", "Selecione o Centro de Custo");
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

    const vlr = document.querySelector("#vlrEstimado").value;
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
    setCampo("#vlrEstimado", lancamento.vlrestimado);
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
        aplicarBuscaIncremental("#idPlanoContasSelect", "Selecione o Plano de Contas");
    }

    const selectEmpPagadora = document.querySelector("#empresaPagadora");
    if (selectEmpPagadora) {
        // Suporta tanto o ID vindo como Integer quanto o legado vindo como String
        const valorBanco = String(lancamento.idempresapagadora || lancamento.empresaPagadora);
        selectEmpPagadora.value = valorBanco;
        if (selectEmpPagadora.selectedIndex <= 0 && valorBanco !== "undefined" && valorBanco !== "null") {
            console.warn("Aviso: Empresa Pagadora legada ou não encontrada:", valorBanco);
        }
        aplicarBuscaIncremental("#empresaPagadora", "Selecione a Empresa Pagadora");
    }

    const selectCentroCusto = document.querySelector("#centroCusto");
    if (selectCentroCusto) {
        const valorBanco = String(lancamento.idcentrocusto || lancamento.centrocusto);
        selectCentroCusto.value = valorBanco;
        if (selectCentroCusto.selectedIndex <= 0 && valorBanco !== "undefined" && valorBanco !== "null") {
            console.warn("Aviso: Centro de Custo não encontrado:", valorBanco);
        }
        aplicarBuscaIncremental("#centroCusto", "Selecione o Centro de Custo");
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

    // 3. Resete de Combos (planocontas, centrocusto, empresapagadora)
    // Forçamos o valor vazio para garantir que o label do Materialize/CSS volte ao normal
    const camposSelect = ["#idPlanoContasSelect", "#centroCusto", "#empresaPagadora"];
    camposSelect.forEach(seletor => {
        const el = document.querySelector(seletor);
        if (el) el.value = "";
    });
    aplicarBuscaIncremental("#idPlanoContasSelect", "Selecione o Plano de Contas");
    aplicarBuscaIncremental("#centroCusto", "Selecione o Centro de Custo");
    aplicarBuscaIncremental("#empresaPagadora", "Selecione a Empresa Pagadora");

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

    // Descrição é sempre o combobox — só limpa a seleção, sem trocar de volta para input
    const selectDesc = document.querySelector("#descricao");
    if (selectDesc && selectDesc.tagName === "SELECT") {
        selectDesc.value = "";
        aplicarBuscaIncremental("#descricao", "Digite ou selecione um lançamento...", { tags: true });
    }

    // 6. Finalização
    window.LancamentoOriginal = {};
    validarFormulario();
    
    console.log("Campos de vínculo, conta e financeiros resetados.");
}


function validarFormulario() {
    const valor = document.querySelector("#vlrEstimado").value;
    const vcto = document.querySelector("#vctoBase").value;

    // --- NOVOS CAMPOS FINANCEIROS ---
    const idPlanoContas = document.querySelector("#idPlanoContasSelect").value;
    const centroCusto = document.querySelector("#centroCusto").value;
    const empresaPag = document.querySelector("#empresaPagadora").value;

    const tipoRepeticao = document.querySelector("#tipoRepeticao")?.value.toUpperCase();
    const indeterminado = document.querySelector("#indeterminado")?.checked;
    const dtTermino = document.querySelector("#dtTermino")?.value;
    const qtdeParcelas = document.querySelector("#qtdeParcelas")?.value;
    const botao = document.querySelector("#Enviar");

    // Elementos de vínculo
    const checksVinculo = document.querySelectorAll('.tipo-vinculo:checked');
    const perfilSelecionado = document.querySelector(".perfil-radio:checked");
    const vinculoSelecionado = document.querySelector("#idVinculo");

    let erros = [];

    // 1. Validações Básicas (Financeiro)
    if (!valor || valor <= 0) erros.push("Valor Estimado");
    if (!vcto) erros.push("Vencimento Base");
    if (!idPlanoContas) erros.push("Plano de Contas");
    if (!centroCusto) erros.push("Centro de Custo");
    if (!empresaPag) erros.push("Empresa Pagadora");
    
    // 2. Validação de Vínculo
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
        // Se o vínculo é fixo e obrigatório, você pode exigir que ao menos um esteja marcado
        erros.push("Tipo de Vínculo (Cliente/Fornecedor/Funcionário)");
    }

    // 3. Regra para Parcelados
    if (tipoRepeticao === "PARCELADO") {
        if (!indeterminado && !dtTermino && (!qtdeParcelas || qtdeParcelas <= 0)) {
            erros.push("Qtde de Parcelas ou Data de Término");
        }
    }

    // 4. Atualização do Botão
    if (botao) {
        if (erros.length === 0) {
            botao.disabled = false;
            botao.style.opacity = "1";
            botao.style.cursor = "pointer";
            botao.title = "Tudo pronto para enviar";
        } else {
            botao.disabled = true;
            botao.style.opacity = "0.5";
            botao.style.cursor = "not-allowed";
            botao.title = "Campos obrigatórios faltantes: \n- " + erros.join("\n- ");
        }
    }
}

function mudarAba(nome) {
    document.querySelectorAll('#cadModalLancamentos .lc-tab-btn').forEach((b) =>
        b.classList.toggle('ativa', b.dataset.lcTab === nome));

    const nomesView = { lista: 'lcViewLista', planocontas: 'lcViewPlanoContas', centrocusto: 'lcViewCentroCusto' };
    document.querySelectorAll('#cadModalLancamentos .lc-view').forEach((v) =>
        v.classList.toggle('ativa', v.id === nomesView[nome]));

    document.querySelectorAll('#cadModalLancamentos .lc-btns').forEach((b) =>
        b.classList.toggle('ativa', b.dataset.lcTab === nome));
}

function configurarAbasLancamentos() {
    document.querySelectorAll('#cadModalLancamentos .lc-tab-btn').forEach((btn) => {
        btn.addEventListener('click', () => mudarAba(btn.dataset.lcTab));
    });
    configurarAbaPlanoContas(carregarSelectPlanoContas);
    configurarAbaCentroCusto(carregarSelectCentroCusto);
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
    const bnts = { Enviar: enviarButtonListener, Limpar: limparButtonListener, Pesquisar: pesquisarButtonListener };
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