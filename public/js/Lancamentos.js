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
        ativo: true
    };
}

// async function verificaLancamento() {
//     console.log("Carregando Lançamento...");

//     const botaoEnviar = document.querySelector("#Enviar");
//     const botaoPesquisar = document.querySelector("#Pesquisar");
//     const botaoLimpar = document.querySelector("#Limpar");
    
//     // Inputs
//     const checkIndeterminado = document.querySelector("#indeterminado");
//     const campoTermino = document.querySelector("#dtTermino");

//     // Inicialização
//     validarFormulario();
//     carregarSelectsIniciais();    
//     renderizarPrevia();

//     // --- GATILHOS AUTOMÁTICOS (Validação e Prévia) ---
//     const camposGatilho = ["#idContaSelect", "#idCentroCusto", "#vlrEstimado", "#vctoBase", "#periodicidade", "#tipoRepeticao", "#dtTermino", "#indeterminado"];
    
//     camposGatilho.forEach(seletor => {
//         const el = document.querySelector(seletor);
//         if (el) {
//             // Unificamos input e change em um só lugar
//             ["input", "change"].forEach(evento => {
//                 el.addEventListener(evento, () => {
//                     validarFormulario();
//                     renderizarPrevia(); 
//                 });
//             });
//         }
//     });

//     // --- LOGICA DE CAMPO INDETERMINADO ---
//     if (checkIndeterminado) {
//         checkIndeterminado.addEventListener("change", function() {
//             campoTermino.disabled = this.checked;
//             if (this.checked) campoTermino.value = "";
//             // A prévia e validação já são chamadas pelo loop de camposGatilho acima
//         });
//     }

//     // --- Listener: LIMPAR ---
//     limparButtonListener = (e) => {
//         e.preventDefault();
//         limparCamposLancamento();
//         document.querySelector("#container-previa").innerHTML = ""; // Limpa a prévia ao limpar tudo
//     };
//     botaoLimpar.addEventListener("click", limparButtonListener);

//     // --- Listener: ENVIAR (POST/PUT) ---
//     enviarButtonListener = async (e) => {
//         e.preventDefault();

//         const idLancamento = document.querySelector("#idLancamento").value.trim();
//         const periodicidade = document.querySelector("#periodicidade").value;
//         const tipoRepeticao = document.querySelector("#tipoRepeticao").value;
//         const vctoBase = document.querySelector("#vctoBase").value;
//         const dtTermino = document.querySelector("#dtTermino").value;
//         const indeterminado = document.querySelector("#indeterminado").checked;

//         if (tipoRepeticao === "PARCELADO" && !dtTermino && !indeterminado) {
//             return Swal.fire("Erro", "Para lançamentos parcelados, a data de término é obrigatória.", "error");
//         }
    
//         // Lógica de Descrição Automática
//         let descricaoInput = document.querySelector("#descricao").value.trim().toUpperCase();
//         let descricaoFinal = descricaoInput;

//         if (!descricaoFinal) {
//             // 1. Pega o Nome da Conta (Corrigido de selConta para selectConta para evitar o erro)
//             const selectConta = document.querySelector("#idContaSelect");
//             const nomeConta = selectConta.options[selectConta.selectedIndex].text;

//             // 2. Pega o Centro de Custo e Empresa
//             const selectCentro = document.querySelector("#idCentroCusto");
//             const centroEmpresa = selectCentro.options[selectCentro.selectedIndex].text;

//             // 3. Pega o Mês/Ano (MM/YYYY)
//             const vctoBaseStr = document.querySelector("#vctoBase").value;
//             let mesAnoFormatado = "SEM DATA";

//             if (vctoBaseStr) {
//                 const [ano, mes] = vctoBaseStr.split('-'); 
//                 mesAnoFormatado = `${mes}/${ano}`;      
//             }

//             // Resultado: "CONTA - CENTRO/EMPRESA - 01/2026"
//             descricaoFinal = `${nomeConta.toUpperCase()} - ${centroEmpresa.toUpperCase()} - ${mesAnoFormatado}`;
//         }
        
//         const dados = {
//             idconta: document.querySelector("#idContaSelect").value,
//             idcentrocusto: document.querySelector("#idCentroCusto").value,
//             descricao: descricaoFinal,
//             vlrestimado: parseFloat(document.querySelector("#vlrEstimado").value),
//             vctobase: vctoBase,
//             periodicidade: periodicidade,
//             tiporepeticao: tipoRepeticao,
//             dttermino: dtTermino || null,
//             indeterminado: indeterminado,
//             ativo: document.querySelector("#ativo").checked
//         };

//         // --- NOVO TRECHO: TRAVA DE DUPLICIDADE ---
//         // Só verifica duplicidade se for um NOVO cadastro (sem idLancamento)
//         // --- NOVO TRECHO CORRIGIDO ---
//         if (!idLancamento) {
//             try {
//                 const existentes = await fetchComToken("/lancamentos");

//                 console.log("Verificando duplicidade entre:", existentes, "lançamentos existentes.");
                
//                 // Usamos Number() e toFixed(2) para garantir que 125 seja igual a 125.00
//                 const duplicado = existentes.find(l => {
//                     const contaIgual = String(l.idconta) === String(dados.idconta);
//                     const centroIgual = String(l.idcentrocusto) === String(dados.idcentrocusto);
//                     const empresaIgual = String(l.idempresa) === String(dados.idempresa);
//                     const valorIgual = Number(l.vlrestimado).toFixed(2) === Number(dados.vlrestimado).toFixed(2);
//                     const dataIgual = l.vctobase === dados.vctobase;

//                     return contaIgual && centroIgual && empresaIgual && valorIgual && dataIgual;
//                 });

//                 if (duplicado) {
//                     const result = await Swal.fire({
//                         title: "Lançamento Duplicado!",
//                         html: `Atenção: Já existe um registro para <b>${duplicado.descricao}</b>.<br><br>Deseja salvar uma cópia?`,
//                         icon: "warning",
//                         showCancelButton: true,
//                         confirmButtonColor: "#3085d6",
//                         cancelButtonColor: "#d33",
//                         confirmButtonText: "Sim, salvar cópia",
//                         cancelButtonText: "Não, cancelar"
//                     });

//                     // Se o usuário NÃO confirmar (clicar em cancelar), paramos aqui
//                     if (!result.isConfirmed) {
//                         return; 
//                     }
//                 }
//             } catch (err) {
//                 console.error("Erro ao validar duplicidade", err);
//             }
//         }
//         // Permissões e Dirty Checking
//         const temPermissaoCadastrar = temPermissao("Lancamentos", "cadastrar");
//         const temPermissaoAlterar = temPermissao("Lancamentos", "alterar");

//         if (!idLancamento && !temPermissaoCadastrar) return Swal.fire("Acesso negado", "Sem permissão para cadastrar.", "error");
//         if (idLancamento && !temPermissaoAlterar) return Swal.fire("Acesso negado", "Sem permissão para alterar.", "error");

//         const semAlteracao = idLancamento && 
//             String(idLancamento) === String(window.LancamentoOriginal?.idlancamento) &&
//             dados.descricao === window.LancamentoOriginal?.descricao &&
//             dados.vlrestimado === window.LancamentoOriginal?.vlrestimado &&
//             dados.idconta === window.LancamentoOriginal?.idconta &&
//             dados.idcentrocusto === window.LancamentoOriginal?.idcentrocusto;

//         if (semAlteracao) return Swal.fire("Aviso", "Nenhuma alteração detectada.", "info");

//         const url = idLancamento ? `/lancamentos/${idLancamento}` : "/lancamentos";
//         const metodo = idLancamento ? "PUT" : "POST";

//         try {
//             if (metodo === "PUT") {
//                 const { isConfirmed } = await Swal.fire({
//                     title: "Salvar alterações?",
//                     icon: "question",
//                     showCancelButton: true,
//                     confirmButtonText: "Sim"
//                 });
//                 if (!isConfirmed) return;
//             }

//             await fetchComToken(url, {
//                 method: metodo,
//                 headers: { 'Content-Type': 'application/json' },
//                 body: JSON.stringify(dados)
//             });

//             await Swal.fire("Sucesso!", "Lançamento salvo.", "success");
//             limparCamposLancamento();
//             renderizarPrevia(); // Limpa ou atualiza a prévia após salvar
//         } catch (error) {
//             Swal.fire("Erro", error.message, "error");
//         }
//     };
//     botaoEnviar.addEventListener("click", enviarButtonListener);

//     // --- Listener: PESQUISAR ---
//     pesquisarButtonListener = async (e) => {
//         e.preventDefault();
//         const temPermissaoPesquisar = temPermissao('Lancamentos', 'pesquisar');
//         if (!temPermissaoPesquisar) return Swal.fire("Acesso negado", "Sem permissão.", "warning");

//         try {
//             const lista = await fetchComToken("/lancamentos");
//             if (!lista || lista.length === 0) return Swal.fire("Info", "Nenhum lançamento encontrado.", "info");

//             const select = criarSelectPesquisa(lista);
//             const inputDesc = document.querySelector("#descricao");
            
//             // --- CORREÇÃO AQUI: Esconder o Label ---
//             const labelDesc = document.querySelector('label[for="descricao"]');
//             if (labelDesc) labelDesc.style.display = 'none'; 
//             // ---------------------------------------

//             inputDesc.parentNode.replaceChild(select, inputDesc);

//             select.addEventListener("change", async function() {
//                 const idEscolhido = this.value;
//                 const lancamento = lista.find(l => String(l.idlancamento) === String(idEscolhido));
                
//                 preencherCampos(lancamento);
//                 renderizarPrevia(); 
                
//                 // Ao restaurar, a função restaurarInputDescricao cuidará de mostrar o label
//                 const novoInput = restaurarInputDescricao(lancamento.descricao);
//                 this.parentNode.replaceChild(novoInput, this);
//             });
//         } catch (error) {
//             Swal.fire("Erro", "Erro ao pesquisar.", "error");
//         }
//     };
//     botaoPesquisar.addEventListener("click", pesquisarButtonListener);

//     adicionarEventoBlurDescricao();
// }


async function verificaLancamento() {
    console.log("Carregando Lançamento...");

    const botaoEnviar = document.querySelector("#Enviar");
    const botaoPesquisar = document.querySelector("#Pesquisar");
    const botaoLimpar = document.querySelector("#Limpar");
    
    const checkIndeterminado = document.querySelector("#indeterminado");
    const campoTermino = document.querySelector("#dtTermino");

    validarFormulario();
    carregarSelectsIniciais();    
    renderizarPrevia();

    // --- GATILHOS AUTOMÁTICOS ---
    const camposGatilho = ["#idContaSelect", "#idCentroCusto", "#vlrEstimado", "#vctoBase", "#periodicidade", "#tipoRepeticao", "#dtTermino", "#indeterminado"];
    
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

    if (checkIndeterminado) {
        checkIndeterminado.addEventListener("change", function() {
            campoTermino.disabled = this.checked;
            if (this.checked) campoTermino.value = "";
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

        const idLancamento = document.querySelector("#idLancamento").value.trim();
        const tipoRepeticao = document.querySelector("#tipoRepeticao").value;
        const dtTermino = document.querySelector("#dtTermino").value;
        const indeterminado = document.querySelector("#indeterminado").checked;

        if (tipoRepeticao === "PARCELADO" && !dtTermino && !indeterminado) {
            return Swal.fire("Erro", "Para lançamentos parcelados, a data de término é obrigatória.", "error");
        }
    
        // 1. GERAÇÃO DA DESCRIÇÃO FINAL (SEM DATA)
        let descricaoInput = document.querySelector("#descricao").value.trim().toUpperCase();
        let descricaoFinal = descricaoInput;

        if (!descricaoFinal) {
            const selectConta = document.querySelector("#idContaSelect");
            const nomeConta = selectConta.options[selectConta.selectedIndex].text;

            const selectCentro = document.querySelector("#idCentroCusto");
            const centroEmpresa = selectCentro.options[selectCentro.selectedIndex].text;

            // Removido o mês/ano conforme solicitado para evitar textos datados em contas fixas
            descricaoFinal = `${nomeConta.toUpperCase()} - ${centroEmpresa.toUpperCase()}`;
        }
        
        const dados = {
            idconta: document.querySelector("#idContaSelect").value,
            idcentrocusto: document.querySelector("#idCentroCusto").value,
            descricao: descricaoFinal,
            vlrestimado: parseFloat(document.querySelector("#vlrEstimado").value),
            vctobase: document.querySelector("#vctoBase").value,
            periodicidade: document.querySelector("#periodicidade").value,
            tiporepeticao: tipoRepeticao,
            dttermino: dtTermino || null,
            indeterminado: indeterminado,
            ativo: document.querySelector("#ativo").checked
        };

        // 2. VALIDAÇÃO DE DUPLICIDADE POR DESCRIÇÃO
        if (!idLancamento) {
            try {
                const existentes = await fetchComToken("/lancamentos");
                
                // Busca se já existe um lançamento com o MESMO NOME (descrição)
                const duplicadoPorNome = existentes.find(l => 
                    l.descricao.trim().toUpperCase() === dados.descricao.trim().toUpperCase()
                );

                if (duplicadoPorNome) {
                    return Swal.fire({
                        title: "Descrição já existe!",
                        html: `Já existe um lançamento cadastrado como: <b>${dados.descricao}</b>.<br><br>` +
                              `Para diferenciar (ex: duas manutenções), por favor, <b>altere a descrição</b> manualmente no campo de texto.`,
                        icon: "warning",
                        confirmButtonText: "Entendido"
                    });
                }
            } catch (err) {
                console.error("Erro ao validar duplicidade por nome", err);
            }
        }

        // --- Permissões e Dirty Checking ---
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
                    icon: "question",
                    showCancelButton: true,
                    confirmButtonText: "Sim"
                });
                if (!isConfirmed) return;
            }

            await fetchComToken(url, {
                method: metodo,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dados)
            });

            await Swal.fire("Sucesso!", "Lançamento salvo.", "success");
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

function renderizarPrevia() {
    const containerPrevia = document.querySelector("#container-previa");
    if (!containerPrevia) return;

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

    // Coleta dados atuais do formulário
    const dados = {
        vlrestimado: parseFloat(document.querySelector("#vlrEstimado").value) || 0,
        vctobase: document.querySelector("#vctoBase").value,
        periodicidade: document.querySelector("#periodicidade").value,
        dttermino: document.querySelector("#dtTermino").value,
        indeterminado: document.querySelector("#indeterminado").checked
    };

    // // Validação para exibição
    // if (!dados.vctobase || dados.vlrestimado <= 0) {
    //     containerPrevia.style.display = "block"; // Mantém visível para mostrar a mensagem
    //     containerPrevia.innerHTML = `
    //         <div class="previa-vazia">
    //             <i class="fas fa-calendar-alt"></i>
    //             <p>Preencha o <b>Valor</b> e o <b>Vencimento Base</b> para visualizar o cronograma de parcelas aqui.</p>
    //         </div>
    //     `;
    //     return;
    // }

    const todasParcelas = calcularPreviaParcelas(dados);
    
    // Filtro para Indeterminado: Mostrar apenas o ano de 2026
    const anoAtual = 2026;
    const parcelasExibicao = dados.indeterminado 
        ? todasParcelas.filter(p => p.dataObjeto.getFullYear() === anoAtual)
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

    containerPrevia.innerHTML = `
        <div class="previa-wrapper">
            <h6 class="previa-titulo">
                ${dados.indeterminado ? `Projeção de Gastos em ${anoAtual}` : `Cronograma Previsto (${todasParcelas.length} parcelas)`}
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

async function carregarSelectsIniciais() {
    try {
        const [contas, centros] = await Promise.all([
            fetchComToken('/lancamentos/contas'),
            fetchComToken('/lancamentos/centrocusto') // Esta rota deve trazer nmempresa agora
        ]);

        const selConta = document.querySelector("#idContaSelect");
        const selCentro = document.querySelector("#idCentroCusto");

        selConta.innerHTML = '<option value="" disabled selected>Selecione a Conta...</option>';
        contas.forEach(c => selConta.add(new Option(c.nmconta, c.idconta)));

        selCentro.innerHTML = '<option value="" disabled selected>Centro de Custo (Setor - Empresa)...</option>';
        centros.forEach(cc => {
            // Aqui fazemos a concatenação: "ADMINISTRATIVO - MATRIZ"
            const labelAjustado = `${cc.nmcentrocusto.toUpperCase()} - ${cc.nmempresa.toUpperCase()}`;
            selCentro.add(new Option(labelAjustado, cc.idcentrocusto));
        });
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

function preencherCampos(l) {
    document.querySelector("#idLancamento").value = l.idlancamento;
    document.querySelector("#descricao").value = l.descricao;
    document.querySelector("#idContaSelect").value = l.idconta;
    document.querySelector("#idCentroCusto").value = l.idcentrocusto;
    document.querySelector("#vlrEstimado").value = l.vlrestimado;
    document.querySelector("#vctoBase").value = l.vctobase.split('T')[0];
    document.querySelector("#periodicidade").value = l.periodicidade;
    document.querySelector("#tipoRepeticao").value = l.tiporepeticao;
    document.querySelector("#indeterminado").checked = l.indeterminado;
    document.querySelector("#ativo").checked = l.ativo;
    
    const campoTermino = document.querySelector("#dtTermino");
    campoTermino.value = l.dttermino ? l.dttermino.split('T')[0] : "";
    campoTermino.disabled = l.indeterminado;

    window.LancamentoOriginal = { ...l };
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
    const centro = document.querySelector("#idCentroCusto").value;
    
    // Novas condições de parada
    const indeterminado = document.querySelector("#indeterminado").checked;
    const dtTermino = document.querySelector("#dtTermino").value;
    const tipoRepeticao = document.querySelector("#tipoRepeticao").value;

    const botao = document.querySelector("#Enviar");

    let erros = [];
    if (!valor || valor <= 0) erros.push("Valor Estimado");
    if (!vcto) erros.push("Vencimento Base");
    if (!conta) erros.push("Conta");
    if (!centro) erros.push("Centro de Custo");
    
    // Regra de término
    if (tipoRepeticao !== "UNICO" && !indeterminado && !dtTermino) {
        erros.push("Data de Término ou marcar Indeterminado");
    }

    if (erros.length === 0) {
        botao.disabled = false;
        botao.style.opacity = "1";
        botao.title = "Clique para salvar o lançamento";
    } else {
        botao.disabled = true;
        botao.style.opacity = "0.5";
        // O popup nativo que aparece ao passar o mouse:
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
    console.log("Configurando eventos Funcao...");
    verificaLancamento(); // Carrega os Funcao ao abrir o modal
    adicionarEventoBlurDescricao();
    console.log("Entrou configurar Funcao no FUNCAO.js.");
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