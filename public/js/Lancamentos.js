import { fetchComToken, aplicarTema } from '../utils/utils.js';

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

const tipoRepeticao = document.querySelector("#tipoRepeticao");
const qtdParcelasInput = document.querySelector("#qtdeParcelas");
const indeterminadoCheck = document.querySelector("#indeterminado");
const dtTerminoInput = document.querySelector("#dtTermino");
const vctoBaseInput = document.querySelector("#vctoBase");

// Objeto para Dirty Checking (Estado Original)
if (typeof window.LancamentoOriginal === "undefined") {
    window.LancamentoOriginal = {
        idLancamento: "",
        idconta: "",
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
    carregarSelectContas();
    carregarSelectTipoConta();
    carregarSelectEmpresaPagadora();
    carregarSelectCentroCusto();
    configurarEventosVinculo();

    // --- GATILHOS AUTOMÁTICOS ---
    // Adicionamos os novos campos: #idVinculo, #tpConta, #empresaPagadora, #centroCusto
    const camposGatilho = [
        "#idContaSelect", "#centroCusto", "#vlrEstimado", "#vctoBase", 
        "#periodicidade", "#tipoRepeticao", "#dtTermino", "#indeterminado", 
        "#qtdeParcelas", "#idVinculo", "#tpConta", "#empresaPagadora"
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
        
        const idTipoConta = document.querySelector("#tpConta").value; 
        const idEmpresaPagadora = document.querySelector("#empresaPagadora").value;        
       

        // Validação de Parcelados
        if (tipoRepeticao === "PARCELADO" && !dtTermino && !indeterminado) {
            return Swal.fire("Erro", "Para lançamentos parcelados, a data de término é obrigatória.", "error");
        }

        // 1. GESTÃO DA DESCRIÇÃO (EDIÇÃO vs CADASTRO)
        let descricaoInput = document.querySelector("#descricao").value.trim().toUpperCase();
        let descricaoFinal = descricaoInput;

        // Se estiver vazio e NÃO for edição, tenta gerar descrição automática
        // if (!descricaoFinal && !idLancamento) {
        //     const selectConta = document.querySelector("#idContaSelect");
        //     if (selectConta && selectConta.selectedIndex >= 0) {
        //         descricaoFinal = selectConta.options[selectConta.selectedIndex].text.toUpperCase();
        //     }
        // }

        if (!descricaoFinal && !idLancamento) {
            // Função para capturar texto e limitar tamanho
            const obterTextoLimitado = (seletor, limite = 40) => {
                const el = document.querySelector(seletor);
                if (el && el.selectedIndex >= 0) {
                    let texto = el.options[el.selectedIndex].text.toUpperCase().trim();
                    
                    // Ignora placeholders e IDs numéricos acidentais
                    if (texto.includes("SELECIONE") || texto === "" || !isNaN(texto)) return "";
                    
                    // Corta se for maior que o limite e adiciona .. se necessário
                    return texto.length > limite ? texto.substring(0, limite).trim() : texto;
                }
                return "";
            };

            // Captura com limites individuais para não estourar os ~255 do banco
            const nomeConta     = obterTextoLimitado("#idContaSelect", 50);
            const nomeVinculo   = obterTextoLimitado("#idVinculo", 50); // Ajustado para pegar o TEXT do select
            const nomePlano     = obterTextoLimitado("#planoContas", 40);
            const nomeCentro    = obterTextoLimitado("#centroCusto", 40);
            const nomeEmpresa   = obterTextoLimitado("#empresaPagadora", 30);
            const nomeTipoConta = obterTextoLimitado("#tpConta", 30);

            // Filtra partes vazias
            const partes = [
                nomeConta, 
                nomeVinculo, 
                nomePlano, 
                nomeCentro, 
                nomeEmpresa, 
                nomeTipoConta
            ].filter(p => p !== "");

            // Une tudo e garante que o total final não passe de 250 (margem de segurança)
            let resultadoParcial = partes.join(" - ");
            descricaoFinal = resultadoParcial.length > 250 
                ? resultadoParcial.substring(0, 247) + "..." 
                : resultadoParcial;
        }
        

        // Se ainda assim estiver vazio, impede o envio
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
            idConta: document.querySelector("#idContaSelect").value,
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
            idEmpresaPagadora: idEmpresaPagadora,
            idTipoConta: idTipoConta
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
    botaoPesquisar.onclick = async (e) => {
        e.preventDefault();
        const temPermissaoPesquisar = temPermissao('Lancamentos', 'pesquisar');
        if (!temPermissaoPesquisar) return Swal.fire("Acesso negado", "Sem permissão.", "warning");

        limparCamposLancamento();
        
        try {
            const lista = await fetchComToken("/lancamentos");
            if (!lista || lista.length === 0) return Swal.fire("Info", "Nenhum lançamento encontrado.", "info");

            const select = criarSelectPesquisa(lista);
            const inputDesc = document.querySelector("#descricao");
            const labelDesc = document.querySelector('label[for="descricao"]');
            
            if (labelDesc) labelDesc.style.display = 'none'; 

            inputDesc.parentNode.replaceChild(select, inputDesc);            

            select.addEventListener("change", async function() {
                const idEscolhido = this.value;
                if (!idEscolhido) return; // Evita erro se selecionar o placeholder

                const lancamento = lista.find(l => String(l.idlancamento) === String(idEscolhido));
                
                if (lancamento) {
                    // 1. Usamos await pois o preencherCampos carrega dados do banco para os selects de vínculo
                    await preencherCampos(lancamento);
                    
                    // 2. Renderiza a prévia visual
                    renderizarPrevia(); 
                    
                    // 3. Restaura o input de descrição com o texto do lançamento escolhido
                    const novoInput = restaurarInputDescricao(lancamento.descricao);
                    this.parentNode.replaceChild(novoInput, this);
                    if (labelDesc) labelDesc.style.display = 'block';

                    // 4. Força uma nova validação para liberar o botão "Enviar/Alterar"
                    validarFormulario();
                }
            });
        } catch (error) {
            Swal.fire("Erro", "Erro ao pesquisar.", "error");
        }
    };

    adicionarEventoBlurDescricao();
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


async function carregarSelectContas() {
    const selectConta = document.querySelector("#idContaSelect");
    if (!selectConta) return;

    try {
        // Rota simples de contas sem a necessidade de joins complexos aqui
        const contas = await fetchComToken('/lancamentos/contas');
        selectConta.innerHTML = '<option value="" disabled selected>Selecione a Conta</option>';

        if (contas && Array.isArray(contas)) {
            contas.forEach(conta => {
                if (conta.ativo) {
                    const option = document.createElement("option");
                    option.value = conta.idconta;
                    const nomeExibicao = `${conta.nmconta} | ${conta.nmplano || 'Sem Plano de Contas'}`;
                    option.textContent = nomeExibicao;
                    selectConta.appendChild(option);
                }
            });
        }
    } catch (error) {
        console.error("Erro ao carregar select de contas:", error);
    }
}

async function carregarSelectTipoConta() {
    const selectTpConta = document.querySelector("#tpConta");
    if (!selectTpConta) return;

    try {
        const tipos = await fetchComToken('/lancamentos/tipoconta');
        selectTpConta.innerHTML = '<option value="" disabled selected>Selecione o Tipo de Conta</option>';

        if (tipos && Array.isArray(tipos)) {
            tipos.forEach(tipo => {
                if (tipo.ativo) {
                    const option = document.createElement("option");
                    option.value = tipo.idtipoconta;
                    option.textContent = tipo.nmtipoconta;
                    selectTpConta.appendChild(option);
                }
            });
        }
    } catch (error) {
        console.error("Erro ao carregar tipos de conta:", error);
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
                    containerPerfil.style.opacity = "1";
                    if (selectVinculo) selectVinculo.disabled = true;
                } else {
                    perfilRadios.forEach(r => {
                        r.disabled = true;
                        r.checked = false;
                    });
                    
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
        if (labelVinculo) labelVinculo.textContent = 'Selecione o Vínculo';

        perfilRadios.forEach(r => {
            r.checked = false;
            r.disabled = true;
        });
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
    setCampo("#idContaSelect", lancamento.idconta);
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
            const containerVinculo = document.querySelector("#containerVinculo");
            const selectVinculo = document.querySelector("#idVinculo");
            
            if (containerVinculo) containerVinculo.style.display = 'block';
            if (selectVinculo) selectVinculo.disabled = false;

            if (lancamento.tipovinculo === 'funcionario') {
                const containerPerfil = document.querySelector('#containerPerfilFuncionario');
                if (containerPerfil) containerPerfil.style.display = 'block';

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
            }
        }
    
    }

    if (inputLocado) inputLocado.checked = !!lancamento.locado;

    const selectTp = document.querySelector("#tpConta");
    if (selectTp) {
        // Suporta tanto o ID vindo como Integer quanto o legado vindo como String
        const valorBanco = String(lancamento.idtipoconta || lancamento.tpconta); 
        selectTp.value = valorBanco;

        if (selectTp.selectedIndex <= 0 && valorBanco !== "undefined" && valorBanco !== "null") {
            console.warn("Aviso: Tipo de conta legado ou não encontrado:", valorBanco);
        }
    }

    const selectEmpPagadora = document.querySelector("#empresaPagadora");
    if (selectEmpPagadora) {
        // Suporta tanto o ID vindo como Integer quanto o legado vindo como String
        const valorBanco = String(lancamento.idempresapagadora || lancamento.empresaPagadora); 
        selectEmpPagadora.value = valorBanco;
        if (selectEmpPagadora.selectedIndex <= 0 && valorBanco !== "undefined" && valorBanco !== "null") {
            console.warn("Aviso: Empresa Pagadora legada ou não encontrada:", valorBanco);
        }
    }

    const selectCentroCusto = document.querySelector("#centroCusto");
    if (selectCentroCusto) {
        const valorBanco = String(lancamento.idcentrocusto || lancamento.centrocusto); 
        selectCentroCusto.value = valorBanco;
        if (selectCentroCusto.selectedIndex <= 0 && valorBanco !== "undefined" && valorBanco !== "null") {
            console.warn("Aviso: Centro de Custo não encontrado:", valorBanco);
        }   
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

    // 3. Resete de Combos (tpconta, centrocusto, empresapagadora)
    // Forçamos o valor vazio para garantir que o label do Materialize/CSS volte ao normal
    const camposSelect = ["#tpConta", "#centroCusto", "#empresaPagadora", "#idContaSelect"];
    camposSelect.forEach(seletor => {
        const el = document.querySelector(seletor);
        if (el) el.value = "";
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
    }

    const containerVinculo = document.querySelector("#containerVinculo");
    if (containerVinculo) {
        // Se você quer que ele fique SEMPRE visível, mude para 'block' ou remova a linha
        containerVinculo.style.display = 'block'; 
    }
    
    // Se o perfil do funcionário também deve ficar visível mas "apagado" (opacidade baixa)
    const containerPerfil = document.querySelector("#containerPerfilFuncionario");
    if (containerPerfil) {
        containerPerfil.style.display = 'block'; // Garante que não suma
        // Opcional: containerPerfil.style.opacity = "0.5"; // Deixa clarinho enquanto não seleciona
    }

    // Reset do Label dinâmico do Vínculo para o padrão
    const labelVinculo = document.querySelector('label[for="idVinculo"]');
    if (labelVinculo) labelVinculo.textContent = 'Selecione o Vínculo';

    // 5. Interface e Prévia
    const containerPrevia = document.querySelector("#container-previa");
    if (containerPrevia) {
        containerPrevia.innerHTML = "";
        containerPrevia.style.display = "none";
    }

    const inputDesc = document.querySelector("#descricao");
    if (inputDesc && inputDesc.tagName === "SELECT") {
        const novoInput = restaurarInputDescricao("");
        inputDesc.parentNode.replaceChild(novoInput, inputDesc);
    }

    const labelDesc = document.querySelector('label[for="descricao"]');
    if (labelDesc) labelDesc.style.display = 'block';

    // 6. Finalização
    window.LancamentoOriginal = {};
    validarFormulario();
    
    console.log("Campos de vínculo, conta e financeiros resetados.");
}


function validarFormulario() {
    const valor = document.querySelector("#vlrEstimado").value;
    const vcto = document.querySelector("#vctoBase").value;
    const contaMestre = document.querySelector("#idContaSelect").value; // Conta Bancária
    
    // --- NOVOS CAMPOS FINANCEIROS ---
    const tpConta = document.querySelector("#tpConta").value; // Tipo de Conta
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
    if (!contaMestre) erros.push("Conta Bancária");
    if (!tpConta) erros.push("Tipo de Conta");
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

function adicionarEventoBlurDescricao() {
    const input = document.querySelector("#descricao");
    if (!input) return;
    input.addEventListener("blur", async function () {
        if (window.ultimoClique?.id === "Limpar" || window.ultimoClique?.id === "Pesquisar") return;
        const desc = this.value.trim();
        if (!desc || document.querySelector("#idLancamento").value) return;

        // Tenta buscar se já existe lançamento com essa descrição
        try {
            const dados = await fetchComToken(`/lancamentos?descricao=${encodeURIComponent(desc)}`);
            if (dados && dados.length > 0) {
                const res = await Swal.fire({
                    title: "Lançamento encontrado",
                    text: "Deseja carregar os dados deste lançamento?",
                    icon: "question",
                    showCancelButton: true
                });
                if (res.isConfirmed) preencherCampos(dados[0]);
            }
        } catch (e) { console.log("Novo lançamento detectado"); }
    });
}

function criarSelectPesquisa(lista) {
    const sel = document.createElement("select");
    sel.id = "descricao";
    sel.className = "form";
    sel.innerHTML = '<option value="" disabled selected>Selecione um Lançamento...</option>';
    lista.forEach(item => {
        const opt = new Option(`${item.descricao} - R$ ${item.vlrestimado}`, item.idlancamento);
        sel.add(opt);
    });
    return sel;
}

function restaurarInputDescricao(valor) {
    const input = document.createElement("input");
    input.type = "text";
    input.id = "descricao";
    input.className = "form uppercase";
    input.value = valor;
    input.addEventListener("input", function() {
        this.value = this.value.toUpperCase();
        validarFormulario();
    });
    return input;
}

function configurarEventosLancamentos() {
    console.log("Configurando eventos Lancamentos...");
    verificaLancamento(); // Carrega os Funcao ao abrir o modal
    adicionarEventoBlurDescricao();
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