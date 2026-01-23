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
    //    idcentrocusto: "",
        descricao: "",
        vlrestimado: "",
        vctobase: "",
        periodicidade: "MENSAL",
        tiporepeticao: "FIXO",
        dttermino: "",
        indeterminado: false,
        ativo: true,
        locado: false // Novo campo
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
    carregarSelectsIniciais();   
    gerenciarCampos(); 
    renderizarPrevia();

    // --- GATILHOS AUTOMÁTICOS ---
    const camposGatilho = ["#idContaSelect", "#idCentroCusto", "#vlrEstimado", "#vctoBase", "#periodicidade", "#tipoRepeticao", "#dtTermino", "#indeterminado", "#qtdeParcelas"];
    
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

    // if (checkIndeterminado) {
    //     checkIndeterminado.addEventListener("change", function() {
    //         campoTermino.disabled = this.checked;
    //         if (this.checked) campoTermino.value = "";
    //     });
    // }

    const locadoCheckbox = document.querySelector("#locadoCheck") || document.querySelector("#Locadocheck");

    if (locadoCheckbox) {
        locadoCheckbox.addEventListener("change", function() {
            // Este Swal aparece tanto na troca para TRUE quanto para FALSE
            Swal.fire({
                title: "Atenção: Vínculo de Pagamento",
                text: "Você alterou o status 'Locado'. Lembre-se que esta mudança pode exigir a atualização de quem irá pagar no cadastro do Centro de Custo.",
                icon: "info",
                confirmButtonText: "Entendido",
                confirmButtonColor: "var(--primary-color)"
            });
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

        // Validação de Parcelados
        if (tipoRepeticao === "PARCELADO" && !dtTermino && !indeterminado) {
            return Swal.fire("Erro", "Para lançamentos parcelados, a data de término é obrigatória.", "error");
        }

        // 1. GESTÃO DA DESCRIÇÃO (EDIÇÃO vs CADASTRO)
        let descricaoInput = document.querySelector("#descricao").value.trim().toUpperCase();
        let descricaoFinal = descricaoInput;

        // Se estiver vazio e NÃO for edição, tenta gerar descrição automática
        if (!descricaoFinal && !idLancamento) {
            const selectConta = document.querySelector("#idContaSelect");
            if (selectConta && selectConta.selectedIndex >= 0) {
                descricaoFinal = selectConta.options[selectConta.selectedIndex].text.toUpperCase();
            }
        }

        // Se ainda assim estiver vazio, impede o envio
        if (!descricaoFinal) {
            return Swal.fire("Erro", "Por favor, preencha a descrição do lançamento.", "warning");
        }

        const dados = {
            idconta: document.querySelector("#idContaSelect").value,
            descricao: descricaoFinal,
            vlrestimado: parseFloat(document.querySelector("#vlrEstimado").value) || 0,
            vctobase: document.querySelector("#vctoBase").value,
            periodicidade: document.querySelector("#periodicidade").value,
            tiporepeticao: tipoRepeticao,
            dttermino: dtTermino || null,
            indeterminado: indeterminado,
            ativo: document.querySelector("#ativo").checked,
            locado: locado,
            qtdParcelas: qtdParcelas,
            dtRecebimento: dtRecebimento
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
                const lancamento = lista.find(l => String(l.idlancamento) === String(idEscolhido));
                
                preencherCampos(lancamento);
                renderizarPrevia(); 
                
                const novoInput = restaurarInputDescricao(lancamento.descricao);
                this.parentNode.replaceChild(novoInput, this);
                if (labelDesc) labelDesc.style.display = 'block';
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

// function renderizarPrevia() {
//     const containerPrevia = document.querySelector("#container-previa");
//     if (!containerPrevia) return;

//     const vlr = document.querySelector("#vlrEstimado").value;
//     const vcto = document.querySelector("#vctoBase").value;

//     // Se os campos essenciais estiverem vazios, mostra o informativo
//     if (!vlr || !vcto || parseFloat(vlr) <= 0) {
//         containerPrevia.style.display = "block";
//         containerPrevia.innerHTML = `
//             <div class="previa-placeholder">
//                 <div class="placeholder-conteudo">
//                     <span class="placeholder-icone">📊</span>
//                     <h4>Cronograma de Lançamentos</h4>
//                     <p>Preencha o <b>Valor Estimado</b> e o <b>Vencimento Base</b> para visualizar a projeção das parcelas aqui.</p>
//                 </div>
//             </div>
//         `;
//         return;
//     }

//     // Coleta dados atuais do formulário
//     const dados = {
//         vlrestimado: parseFloat(document.querySelector("#vlrEstimado").value) || 0,
//         vctobase: vcto,
//         periodicidade: document.querySelector("#periodicidade").value,
//         dttermino: document.querySelector("#dtTermino").value,
//         indeterminado: document.querySelector("#indeterminado").checked,
//         qtdparcelas: parseInt(document.querySelector("#qtdeParcelas").value) || 0,
//         tipoRepeticao: document.querySelector("#tipoRepeticao").value
//     };

//     // // Validação para exibição
//     // if (!dados.vctobase || dados.vlrestimado <= 0) {
//     //     containerPrevia.style.display = "block"; // Mantém visível para mostrar a mensagem
//     //     containerPrevia.innerHTML = `
//     //         <div class="previa-vazia">
//     //             <i class="fas fa-calendar-alt"></i>
//     //             <p>Preencha o <b>Valor</b> e o <b>Vencimento Base</b> para visualizar o cronograma de parcelas aqui.</p>
//     //         </div>
//     //     `;
//     //     return;
//     // }

//     const todasParcelas = calcularPreviaParcelas(dados);
    
//     // Filtro para Indeterminado: Mostrar apenas o ano do sistema
//     // const anoAtual = new Date().getFullYear();
//     // const parcelasExibicao = dados.indeterminado 
//     //     ? todasParcelas.filter(p => p.dataObjeto.getFullYear() === anoAtual)
//     //     : todasParcelas;

//     const hoje = new Date();
//     const dozeMesesParaFrente = new Date();
//     dozeMesesParaFrente.setMonth(hoje.getMonth() + 12);

//     const parcelasExibicao = dados.indeterminado 
//         ? todasParcelas.filter(p => p.dataObjeto >= hoje && p.dataObjeto <= dozeMesesParaFrente)
//         : todasParcelas;


//     if (parcelasExibicao.length === 0) {
//         containerPrevia.style.display = "none";
//         return;
//     }

//     // Ativa o container
//     containerPrevia.style.display = "block";

//     // Lógica de divisão em 2 colunas
//     const metade = Math.ceil(parcelasExibicao.length / 2);
//     const col1 = parcelasExibicao.slice(0, metade);
//     const col2 = parcelasExibicao.slice(metade);

//     containerPrevia.innerHTML = `
//         <div class="previa-wrapper">
//             <h6 class="previa-titulo">
//                 ${dados.indeterminado ? `Projeção de Gastos em ${anoAtual}` : `Cronograma Previsto (${todasParcelas.length} parcelas)`}
//             </h6>
//             <div class="previa-grades">
//                 <div class="previa-coluna">${gerarTabelaHTML(col1, todasParcelas.length, dados.indeterminado)}</div>
//                 <div class="previa-coluna">${gerarTabelaHTML(col2, todasParcelas.length, dados.indeterminado)}</div>
//             </div>
//         </div>
//     `;
// }

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
        tipoRepeticao: document.querySelector("#tipoRepeticao").value
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

// async function carregarSelectsIniciais() {
//     try {
//             //const [contas, centros] = await Promise.all([
//             const [contas] = await Promise.all([
//             fetchComToken('/lancamentos/contas'),
//           //  fetchComToken('/lancamentos/centrocusto') // Esta rota deve trazer nmempresa agora
//         ]);

//         const selConta = document.querySelector("#idContaSelect");
//       //  const selCentro = document.querySelector("#idCentroCusto");

//         selConta.innerHTML = '<option value="" disabled selected>Selecione a Conta (Setor - Empresa)...</option>';
//         contas.forEach(c => {
//             const labelAjustado = `${c.nmconta.toUpperCase()} - ${c.nmempresa.toUpperCase()}`;
//             selConta.add(new Option(labelAjustado, c.idconta));
//         });

//         // selCentro.innerHTML = '<option value="" disabled selected>Centro de Custo (Setor - Empresa)...</option>';
//         // centros.forEach(cc => {
//         //     // Aqui fazemos a concatenação: "ADMINISTRATIVO - MATRIZ"
//         //     const labelAjustado = `${cc.nmcentrocusto.toUpperCase()} - ${cc.nmempresa.toUpperCase()}`;
//         //     selCentro.add(new Option(labelAjustado, cc.idcentrocusto));
//         // });
//     } catch (e) { 
//         console.error("Erro ao carregar selects:", e); 
//     }
// }

async function carregarSelectsIniciais() {
    try {
        // Busca apenas as contas
        const contas = await fetchComToken('/lancamentos/contas');

        const selConta = document.querySelector("#idContaSelect");
        if (!selConta) return;

        selConta.innerHTML = '<option value="" disabled selected>Selecione a Conta (Setor - Empresa)...</option>';
        
        if (contas && Array.isArray(contas)) {
            contas.forEach(c => {
                // Proteção contra valores nulos
                const conta = (c.nmconta || "").toUpperCase();
                const empresa = (c.nmempresapagadora || "").toUpperCase();
                
                const labelAjustado = `${conta} - ${empresa}`;
                selConta.add(new Option(labelAjustado, c.idconta));
            });
        }
    } catch (e) { 
        console.error("Erro ao carregar selects:", e); 
    }
}

function gerarTabelaPrevia(lista, total, isIndeterminado) {
    if (lista.length === 0) return '';
    return `
        <table class="table-previa">
            <thead>
                <tr><th>Parc.</th><th>Vencimento</th><th>Valor</th></tr>
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


function preencherCampos(lancamento) {
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
    if (inputLocado) inputLocado.checked = !!lancamento.locado;

    // Sincronização da Interface
    if (typeof gerenciarCampos === "function") gerenciarCampos();
    
    window.LancamentoOriginal = { ...lancamento };
    validarFormulario();
    renderizarPrevia();
}

function limparCamposLancamento() {
    // 1. Seleciona o elemento formulário corretamente
    const formulario = document.querySelector("form#form-lancamentos");
    
    if (formulario) {
        formulario.reset(); // Agora funciona porque o ID é único do form
    }

    const chkAtivo = document.querySelector("#ativo");
    if (chkAtivo) chkAtivo.checked = true;

    // Força o "Indeterminado" a ficar desmarcado
    const chkIndeterminado = document.querySelector("#indeterminado");
    if (chkIndeterminado) chkIndeterminado.checked = false;

    // 2. Garante a limpeza manual de campos ocultos ou persistentes
    const idLanc = document.querySelector("#idLancamento");
    if (idLanc) idLanc.value = "";

    const dtTermino = document.querySelector("#dtTermino");
    if (dtTermino) dtTermino.disabled = false;

    // 3. Limpa a Prévia de Visualização e esconde o container
    const containerPrevia = document.querySelector("#container-previa");
    if (containerPrevia) {
        containerPrevia.innerHTML = "";
        containerPrevia.style.display = "none";
    }

    // 4. Se houver um Select de Pesquisa no lugar da Descrição, volta para Input
    const inputDesc = document.querySelector("#descricao");
    if (inputDesc && inputDesc.tagName === "SELECT") {
        const novoInput = restaurarInputDescricao("");
        inputDesc.parentNode.replaceChild(novoInput, inputDesc);
    }

    // 5. Garante que o Label da descrição apareça
    const labelDesc = document.querySelector('label[for="descricao"]');
    if (labelDesc) labelDesc.style.display = 'block';

    // 6. Reseta objetos de controle e valida a interface
    window.LancamentoOriginal = {};
    validarFormulario();
    
    console.log("Formulário e prévia resetados.");
}

// function validarFormulario() {
   
//     const conta = document.querySelector("#idContaSelect")?.value;
//     const valor = document.querySelector("#vlrEstimado")?.value;
//     const botao = document.querySelector("#Enviar");

//     if (conta && valor) {
//         botao.disabled = false;
//         botao.style.opacity = "1";
//     } else {
//         botao.disabled = true;
//         botao.style.opacity = "0.5";
//     }
// }

function validarFormulario() {
    const valor = document.querySelector("#vlrEstimado").value;
    const vcto = document.querySelector("#vctoBase").value;
    const conta = document.querySelector("#idContaSelect").value;
    const tipoRepeticao = document.querySelector("#tipoRepeticao").value.toUpperCase();
    const indeterminado = document.querySelector("#indeterminado").checked;
    const dtTermino = document.querySelector("#dtTermino").value;
    const qtdeParcelas = document.querySelector("#qtdeParcelas").value;
    const botao = document.querySelector("#Enviar");

    let erros = [];
    if (!valor || valor <= 0) erros.push("Valor Estimado");
    if (!vcto) erros.push("Vencimento Base");
    if (!conta) erros.push("Conta");
    
    // REGRA DE OURO PARA PARCELADOS
    if (tipoRepeticao === "PARCELADO") {
        if (!indeterminado && !dtTermino && (!qtdeParcelas || qtdeParcelas <= 0)) {
            erros.push("Qtde de Parcelas ou Data de Término");
        }
    }

    if (erros.length === 0) {
        botao.disabled = false;
        botao.style.opacity = "1";
    } else {
        botao.disabled = true;
        botao.style.opacity = "0.5";
        botao.title = "Campos obrigatórios: " + erros.join(", ");
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