// =============================================================================
//  PEDIDOS E SOLICITAÇÕES
//  ----------------------------------------------------------------------------
//  Tudo do painel de pedidos vive aqui: busca no backend, o pipeline que monta
//  os grupos (ver comentário em mostrarPedidosUsuario), os cards de cada tipo de
//  solicitação, as ações de aprovar/rejeitar e os contadores do resumo.
//
//  Separado do Main.js em 22/09/2026 — eram ~3.300 linhas no meio de um arquivo
//  de 19 mil. A fronteira já era limpa: o resto do sistema só chama
//  mostrarPedidosUsuario() e parseDateLocal(), e daqui só se usa a sessão do
//  usuário (Sessao.js) e o fetch autenticado (utils.js).
// =============================================================================

import { fetchComToken } from '/utils/utils.js';
import { getIdEmpresa, getIdExecutor, usuarioTemPermissao, usuarioTemPermissaoSupremo } from './Sessao.js';

// Campos de status que o backend manda e que têm ciclo de aprovação próprio.
export const CAMPO_ADITIVO_EXTRA = "statusaditivoextra";
export const STATUS_PENDENTE = "pendente";
export const STATUS_AUTORIZADO = "autorizado";
export const STATUS_REJEITADO = "rejeitado";

// ==============================================================================================
//  Pedidos Financeiros
// ==============================================================================================


async function buscarPedidosUsuario() {
    const idusuario = getIdExecutor(); 

    function preencherSolicitante(p) {
        const idSolicitante = p.solicitante || p.idusuariosolicitante || p.idusuario || p.idexecutor;
        return {
            ...p,
            id_log: p.id_log || p.idlog || null,
            solicitante: idSolicitante, 
            solicitante_nome: p.nomeSolicitante || p.solicitante_nome || (String(idSolicitante) === String(idusuario) ? "Você" : "Solicitante desconhecido")
        };
    }

    try {
        const resposta = await fetchComToken(`/main/notificacoes-financeiras`, {
            headers: { idempresa: getIdEmpresa() }
        });  

        if (!resposta || !Array.isArray(resposta)) return [];

        const ehSupremo = usuarioTemPermissaoSupremo(); 
        const ehMaster = usuarioTemPermissao(); 
        const usuarioPodeVerTudo = ehSupremo || ehMaster;

        // 1. Mapeamento e Normalização
        let pedidosProcessados = resposta.map(p => {
            const tempPedido = preencherSolicitante(p);
            
            // Prioriza o status que vem formatado do Back-end
            const statusReal = tempPedido.status_aprovacao || tempPedido.status_atual || tempPedido.status || 'pendente';
            
            // IMPORTANTE: Se o back já mandou 'categoria_item', usamos ela. 
            // Caso contrário, usamos a 'categoria' bruta.
            const categoriaFinal = p.categoria_item || p.categoria;

            return {
                ...tempPedido,
                status_aprovacao: statusReal.toString().toLowerCase().trim(),
                categoria_item: categoriaFinal, // Garante que o front use a categoria tratada
                ehMasterStaff: ehMaster,
                podeVerTodos: usuarioPodeVerTudo
            };
        });

        // 2. Filtro de privacidade (apenas para quem não é Master/Supremo)
        if (!usuarioPodeVerTudo) {
            pedidosProcessados = pedidosProcessados.filter(p => 
                String(p.solicitante).trim() === String(idusuario).trim()
            );
        }

        return pedidosProcessados; 

    } catch (err) {
        console.error("Erro na requisição de pedidos:", err);
        return [];
    }
}

function mostrarLoader(element) {
    if (element) {
        // Encontra o botão de aprovação ou adiciona uma classe de carregamento ao card
        const btn = element.querySelector('.btn-aprovar');
        if (btn) btn.disabled = true;
    }
}


function ocultarLoader(element) {
    if (element && typeof element.querySelector === 'function') {
        const btn = element.querySelector('.btn-aprovar');
        if (btn) btn.disabled = false;
    }
}




async function buscarAditivoExtraCompleto() {
   // console.log("🟡 Iniciando busca de TODAS as solicitações Aditivo/Extra...");
    try {
        // Altere a URL para a rota que busca todos os status
        const url = '/main/aditivoextra'; 
        const resposta = await fetchComToken(url);

        console.log("DEBUG: Resposta Bruta do Fetch AditivoExtra (length):", resposta.dados ? (Array.isArray(resposta.dados) ? resposta.dados.length : 'N/D') : 0);

        if (resposta && resposta.sucesso && Array.isArray(resposta.dados)) {
            //console.log(`✅ Sucesso! ${resposta.dados.length} solicitações Aditivo/Extra carregadas.`);
            return resposta.dados; 
        }

        console.error("❌Erro ao buscar AditivoExtra completo:", resposta?.erro || 'Resposta inválida do servidor.');
        return [];

    } catch (err) {
        console.error("🔥Erro de rede/conexão ao buscar AditivoExtra:", err);
        return [];
    }
}

// =============================================================================
//  PAINEL "PEDIDOS E SOLICITAÇÕES"
//  ----------------------------------------------------------------------------
//  O fluxo inteiro, em ordem (cada etapa é uma função nomeada abaixo):
//
//    buscarPedidosUsuario()            → linhas cruas do backend
//    desmembrarPedidosPorStatus()      → 1 item por campo de status preenchido
//    agruparPedidosPorFuncionario()    → 1 grupo (accordion) por funcionário/função
//    ordenarGruposPorSolicitacaoMaisRecente()
//    separarGruposPorAba()             → { funcionarios, funcoes }
//    contarStatusDosGrupos()           → { pendente, autorizado, rejeitado }
//    montarHtmlPainelPedidos()         → HTML das abas principais
//    ligarAbasPrincipaisPedidos()      → clique nas abas → sub-abas
//    ligarInteracoesPainelPedidos()    → sub-abas, botão voltar e busca
//
//  As cinco primeiras são puras (recebem array, devolvem array novo): dá para
//  testá-las isoladas e ler o fluxo de ponta a ponta em mostrarPedidosUsuario().
// =============================================================================

// Campos de status que um pedido pode carregar. Cada um preenchido vira um item
// separado no painel, com seu próprio ciclo de aprovação.
const CAMPOS_STATUS_PEDIDO = [
    "statusajustecusto",
    "statuscaixinha",
    "statusmeiadiaria",
    "statusdiariadobrada",
    "statuscustofechado",
    "statuscacheliberado",
    "statusvagaexcedida",
    "statusaditivoextra",
    CAMPO_ADITIVO_EXTRA
];

// De qual coluna sai o conteúdo (datas, valores, justificativa) de cada campo de
// status. Campo sem entrada aqui não passa por safeParse e chegaria ao render
// como a string JSON crua — foi o que acontecia com statuscaixinha, por isso ele
// mapeia para si mesmo (mesmo padrão de statusvagaexcedida/statusaditivoextra).
const CAMPO_DADOS_POR_STATUS = {
    "statusdiariadobrada": "dtdiariadobrada",
    "statusmeiadiaria": "dtmeiadiaria",
    "statuscustofechado": "vlrcache",
    "statuscacheliberado": "vlrcache",
    "statusvagaexcedida": "statusvagaexcedida",
    "statusaditivoextra": "statusaditivoextra",
    "statuscaixinha": "statuscaixinha"
};

const STATUS_PENDENTE_LOWER = (typeof STATUS_PENDENTE !== 'undefined' ? STATUS_PENDENTE : 'pendente').toLowerCase();
const STATUS_AUTORIZADO_LOWER = (typeof STATUS_AUTORIZADO !== 'undefined' ? STATUS_AUTORIZADO : 'autorizado').toLowerCase();
const STATUS_REJEITADO_LOWER = (typeof STATUS_REJEITADO !== 'undefined' ? STATUS_REJEITADO : 'rejeitado').toLowerCase();

// Normaliza qualquer grafia vinda do banco ("Aprovado", "RECUSADO", "pendente ")
// para um dos três status canônicos.
function normalizarStatusPedido(valor) {
    const texto = (valor ?? '').toString().toLowerCase().trim();
    if (texto.includes('autoriz') || texto.includes('aprov')) return STATUS_AUTORIZADO;
    if (texto.includes('rejeit') || texto.includes('recus')) return STATUS_REJEITADO;
    return STATUS_PENDENTE;
}

// Quais campos de status estão preenchidos neste pedido.
function categoriasPreenchidasDoPedido(pedido) {
    return CAMPOS_STATUS_PEDIDO.filter(campo => {
        const valor = pedido[campo];
        if (campo === 'statusvagaexcedida') {
            return valor && valor.toString().trim() !== '' && valor !== 'null';
        }
        if (campo === CAMPO_ADITIVO_EXTRA) {
            return pedido.categoria_item === CAMPO_ADITIVO_EXTRA && Array.isArray(valor) && valor.length > 0;
        }
        if (Array.isArray(valor)) return valor.length > 0;
        return valor && valor.toString().trim() !== '';
    });
}

// Status do item: enquanto a solicitação mãe está pendente, cada campo pode ter
// andado sozinho (a Diária Dobrada pode estar aprovada com a mãe pendente), então
// vale o status de dentro do JSON; se a mãe já foi decidida, ela manda em todos.
function statusDoItemDesmembrado(pedido, categoria, dadosDoCampo) {
    const statusMae = pedido.status_aprovacao || pedido.status || 'pendente';
    let status = statusMae;

    if (statusMae.toString().toLowerCase().trim() === 'pendente' && Array.isArray(dadosDoCampo) && dadosDoCampo.length > 0) {
        status = dadosDoCampo[0].status || dadosDoCampo[0].Status || status;
    }

    // Algumas colunas guardam o status direto no próprio campo, não no JSON.
    if (status === 'pendente' && pedido[categoria]) {
        const valorColuna = pedido[categoria].toString().toLowerCase();
        if (valorColuna.includes('autoriz') || valorColuna.includes('aprov') || valorColuna.includes('rejeit')) {
            status = valorColuna;
        }
    }

    return normalizarStatusPedido(status);
}

/**
 * Uma linha do backend pode trazer vários pedidos juntos (caixinha + meia diária
 * + diária dobrada na mesma solicitação). Aqui ela vira uma lista de itens, um
 * por campo de status preenchido, cada um com seu próprio status já resolvido.
 */
function desmembrarPedidosPorStatus(pedidos) {
    const itens = [];

    (pedidos || []).forEach(pedido => {
        const categorias = categoriasPreenchidasDoPedido(pedido);

        if (!categorias.length) {
            // Sem campo de status preenchido, só entra se já vier categorizado.
            if (pedido.categoria_item) itens.push(pedido);
            return;
        }

        categorias.forEach(categoria => {
            const campoDados = CAMPO_DADOS_POR_STATUS[categoria];
            const dadosDoCampo = (campoDados && pedido[campoDados]) ? safeParse(pedido[campoDados]) : null;
            const statusFinal = statusDoItemDesmembrado(pedido, categoria, dadosDoCampo);
            const statusMae = (pedido.status_aprovacao || pedido.status || 'pendente').toString().toLowerCase().trim();

            const item = {
                ...pedido,
                categoria_item: categoria,
                status: statusFinal,
                status_aprovacao: statusFinal
            };

            if (Array.isArray(dadosDoCampo)) {
                item[campoDados] = dadosDoCampo.map(dado => ({
                    ...dado,
                    status: statusMae === 'pendente' ? (dado.status || statusFinal) : statusMae
                }));
            }

            // O item carrega só a própria categoria — as outras já viraram itens.
            CAMPOS_STATUS_PEDIDO.forEach(campo => { if (campo !== categoria) delete item[campo]; });
            itens.push(item);
        });
    });

    return itens;
}

// Rótulo de um item que pertence a uma FUNÇÃO (vaga/aditivo), não a uma pessoa.
function rotuloDeItemDeFuncao(item) {
    const descricaoFuncao = item.descFuncao || item.descfuncao || '';
    const evento = item.evento && item.evento !== 'Sem Evento' && item.evento !== '-' ? item.evento : '';
    const nomeNoStaff = item.funcionario || item.nomefuncionario || '';
    return [descricaoFuncao, evento, nomeNoStaff].filter(Boolean).join(' — ');
}

function ehItemDeFuncao(item) {
    return item.categoria_item === 'statusvagaexcedida'
        || item.categoria_item === 'statusaditivoextra'
        || item.categoria === 'aditivoextra';
}

/**
 * Junta os itens em grupos — cada grupo é um accordion no painel.
 * Agrupa por idfuncionario (id real do backend) sempre que existir, para que
 * TODAS as solicitações da mesma pessoa caiam num accordion só, mesmo quando o
 * rótulo muda de categoria para categoria. Sem idfuncionario (item preso a uma
 * função, sem pessoa), cai no agrupamento antigo por nome/função.
 * Itens repetidos (mesmo grupo + categoria + id + solicitante) entram uma vez só.
 */
function agruparPedidosPorFuncionario(itens) {
    const grupos = {};
    const chavesJaAdicionadas = new Set();

    (itens || []).forEach(item => {
        const evento = item.evento || 'Sem Evento';
        const funcionario = item.funcionario || null;
        const itemDeFuncao = ehItemDeFuncao(item);
        const nmfuncao = itemDeFuncao ? rotuloDeItemDeFuncao(item) : (item.nmfuncao || null);

        const idGrupo = item.idpedido || item.idaditivoextra || Math.random();
        const nomeExibido = funcionario || nmfuncao || `Item-ID-${idGrupo}`;
        const chaveGrupo = item.idfuncionario
            ? `funcionario-${item.idfuncionario}`
            : (itemDeFuncao ? (nmfuncao || nomeExibido) : nomeExibido);

        const solicitante = item.nomeSolicitante || "N/D";
        const idItem = item.id_log || item.idpedido || item.idaditivoextra || item.idagrupamento || 'RANDOM-' + Math.random();

        if (item.categoria === 'statuscacheliberado') {
            item.categoria_item = 'statuscacheliberado';
        }

        const chaveItem = `${chaveGrupo}|${item.categoria_item || "geral"}|${idItem}|${solicitante}`;
        if (chavesJaAdicionadas.has(chaveItem)) return;
        chavesJaAdicionadas.add(chaveItem);

        if (!grupos[chaveGrupo]) {
            grupos[chaveGrupo] = {
                evento,
                funcionario: funcionario || (item.idfuncionario ? (item.nomefuncionario || null) : null),
                nmfuncao,
                idfuncionario: item.idfuncionario || null,
                idpedido: item.idpedido,
                dtCriacao: item.dtCriacao,
                todosSolicitantes: new Set(),
                registrosOriginais: []
            };
        } else if (!grupos[chaveGrupo].funcionario && (funcionario || item.nomefuncionario)) {
            grupos[chaveGrupo].funcionario = funcionario || item.nomefuncionario;
        }

        if (solicitante) grupos[chaveGrupo].todosSolicitantes.add(solicitante);
        grupos[chaveGrupo].registrosOriginais.push(item);
    });

    return Object.values(grupos).map(grupo => {
        grupo.nomeSolicitante = Array.from(grupo.todosSolicitantes).join(', ');
        delete grupo.todosSolicitantes;
        return grupo;
    });
}

// Solicitação mais recente primeiro (a query já vem nessa ordem; o agrupamento
// acima é que embaralhava, por isso reordenamos aqui).
function ordenarGruposPorSolicitacaoMaisRecente(grupos) {
    const maisRecente = (grupo) => (grupo.registrosOriginais || []).reduce((max, registro) => {
        const quando = new Date(registro.criado_em || registro.dtCriacao || 0).getTime();
        return quando > max ? quando : max;
    }, 0);

    return [...grupos].sort((a, b) => maisRecente(b) - maisRecente(a));
}

// Um aditivo/vaga excedida é "de funcionário" quando o tipo é FUNCEXCEDIDO
// (excedeu o limite de uma pessoa); os demais são "de função" (vaga do orçamento).
function aditivoEhDeFuncionario(registro) {
    const solicitacoes = safeParse(registro['statusvagaexcedida'] || registro[CAMPO_ADITIVO_EXTRA] || '[]');
    return (solicitacoes[0]?.tipoSolicitacao || '').toUpperCase() === 'FUNCEXCEDIDO';
}

function ehRegistroAditivo(registro) {
    return registro.categoria_item === CAMPO_ADITIVO_EXTRA
        || registro.categoria_item === 'statusaditivoextra'
        || registro.categoria_item === 'statusvagaexcedida';
}

/**
 * Divide os mesmos grupos nas duas abas do painel. Um grupo pode aparecer nas
 * duas — o que muda é quais registros ele leva em cada uma.
 */
function separarGruposPorAba(grupos) {
    const funcionarios = grupos.map(grupo => ({
        ...grupo,
        registrosOriginais: (grupo.registrosOriginais || []).filter(registro => {
            if (registro.isComboExtraDobrada || registro.categoria_item === 'extrabonificado_dobrada') return true;
            if (!ehRegistroAditivo(registro)) return true;
            return aditivoEhDeFuncionario(registro);
        })
    })).filter(grupo => !!grupo.funcionario && grupo.registrosOriginais.length > 0);

    const funcoes = grupos.map(grupo => ({
        ...grupo,
        registrosOriginais: (grupo.registrosOriginais || []).filter(registro => {
            if (registro.isComboExtraDobrada || registro.categoria_item === 'extrabonificado_dobrada') return false;
            if (!ehRegistroAditivo(registro)) return false;
            return !aditivoEhDeFuncionario(registro);
        })
    })).filter(grupo => grupo.registrosOriginais.length > 0);

    return { funcionarios, funcoes };
}

/**
 * Este registro conta como `statusDesejado`?
 * Espelha a lógica de matching de renderizarPedidos (campos com aprovação
 * própria — Diária Dobrada, Meia Diária, Caixinha etc — não herdam o status do
 * pedido mãe) para que o número do badge bata com o que é realmente renderizado
 * em cada sub-aba. Um mesmo registro pode contar em mais de um status (ex.: mãe
 * autorizada, mas Diária Dobrada ainda pendente).
 */
function pedidoTemStatus(pedidoOriginal, statusDesejado) {
    const statusMae = (pedidoOriginal.status_aprovacao || pedidoOriginal.status || '').toLowerCase().trim();

    // Combo Extra Bonificado + Diária Dobrada: só é autorizado com as duas pontas
    // autorizadas; basta uma pendente/rejeitada para contar como tal.
    if (pedidoOriginal.isComboExtraDobrada) {
        const bonificado = (pedidoOriginal.dadosBonificado?.status_aprovacao || 'pendente').toLowerCase();
        const dobrada = (pedidoOriginal.dadosDobrada?.status_aprovacao || 'pendente').toLowerCase();
        return (statusDesejado === STATUS_PENDENTE_LOWER && (bonificado === 'pendente' || dobrada === 'pendente'))
            || (statusDesejado === STATUS_AUTORIZADO_LOWER && bonificado === 'autorizado' && dobrada === 'autorizado')
            || (statusDesejado === STATUS_REJEITADO_LOWER && (bonificado === 'rejeitado' || dobrada === 'rejeitado'));
    }

    // Combos FuncExcedido: o status vem das solicitações individuais dos dois lados.
    if (pedidoOriginal.isComboFuncExcedidoAditivo || pedidoOriginal.isComboFuncExcedidoVaga) {
        const doAditivo = pedidoOriginal.dadosAditivo?.solicitacoes_individuais || [];
        const doFuncExcedido = pedidoOriginal.dadosFuncExcedido?.solicitacoes_individuais || [];
        const algumaCom = (solicitacoes, status) =>
            solicitacoes.some(s => (s.status || 'pendente').toLowerCase().trim() === status);
        return (statusDesejado === STATUS_PENDENTE_LOWER && (algumaCom(doAditivo, 'pendente') || algumaCom(doFuncExcedido, 'pendente')))
            || (statusDesejado === STATUS_AUTORIZADO_LOWER && (algumaCom(doAditivo, 'autorizado') || algumaCom(doFuncExcedido, 'autorizado')))
            || (statusDesejado === STATUS_REJEITADO_LOWER && (algumaCom(doAditivo, 'rejeitado') || algumaCom(doFuncExcedido, 'rejeitado')));
    }

    if (statusMae === statusDesejado) return true;

    // Campos que seguem a decisão da mãe assim que ela é tomada (os demais têm
    // aprovação própria e continuam valendo o status de dentro do JSON).
    const camposSincronizadosComMae = ['statusaditivoextra', 'statusvagaexcedida', 'statusvagasreaproveitadas', CAMPO_ADITIVO_EXTRA];
    const camposComStatusProprio = [
        "statusajustecusto", "statuscaixinha", "statusmeiadiaria", "statusdiariadobrada",
        "statuscustofechado", "statuscacheliberado", "statusvagaexcedida",
        "statusvagasreaproveitadas", CAMPO_ADITIVO_EXTRA
    ];

    return camposComStatusProprio.some(campo => {
        const itens = safeParse(pedidoOriginal[campo]).filter(item => item !== null && item !== undefined);
        return itens.some(item => {
            if (camposSincronizadosComMae.includes(campo) && (statusMae === 'autorizado' || statusMae === 'rejeitado')) {
                return statusMae === statusDesejado;
            }
            const status = (typeof item === 'object' && item !== null) ? (item.status || 'pendente') : item;
            return String(status).toLowerCase().trim() === statusDesejado;
        });
    });
}

// Contagem que alimenta os badges das sub-abas (pendente/autorizado/rejeitado).
function contarStatusDosGrupos(grupos) {
    const contagem = {
        [STATUS_PENDENTE_LOWER]: 0,
        [STATUS_AUTORIZADO_LOWER]: 0,
        [STATUS_REJEITADO_LOWER]: 0
    };

    (grupos || []).forEach(grupo => {
        (grupo.registrosOriginais || []).forEach(registro => {
            [STATUS_PENDENTE_LOWER, STATUS_AUTORIZADO_LOWER, STATUS_REJEITADO_LOWER].forEach(status => {
                if (pedidoTemStatus(registro, status)) contagem[status]++;
            });
        });
    });

    return contagem;
}

// Número entre parênteses nas abas: só o que está PENDENTE (é o que exige ação
// de quem abre o painel), não o total de registros.
function montarHtmlPainelPedidos(pendentesFuncionarios, pendentesFuncoes) {
    return `
        <div class="titulo-pedidos">Pedidos e Solicitações</div>
        <div class="tabs-container-wrapper">
            <div class="abas-principais">
                <button class="aba main-tab-btn ativa" data-tab-content="tab-content-funcionarios" data-categoria="funcionario">
                    Funcionários (${pendentesFuncionarios})
                </button>
                <button class="aba main-tab-btn" data-tab-content="tab-content-funcoes" data-categoria="funcao">
                    Funções (${pendentesFuncoes})
                </button>
            </div>
            <div id="tab-content-funcionarios" class="painel-tabs ativo">
                <p class="mt-3">Clique na aba 'Funcionários' ou 'Funções' para ver os pedidos.</p>
            </div>
            <div id="tab-content-funcoes" class="painel-tabs desativado">
                <p class="mt-3">Clique na aba 'Funcionários' ou 'Funções' para ver os pedidos.</p>
            </div>
        </div>
    `;
}

// Clique numa aba principal: esconde a barra de abas e abre as sub-abas
// (pendente/autorizado/rejeitado) daquela categoria.
function ligarAbasPrincipaisPedidos(statusCounts) {
    document.querySelectorAll('.abas-principais .main-tab-btn').forEach(botao => {
        botao.addEventListener('click', function () {
            const idPainel = this.getAttribute('data-tab-content');
            const categoria = this.getAttribute('data-categoria');

            document.querySelectorAll('.abas-principais .main-tab-btn').forEach(b => b.classList.remove('ativa'));
            this.classList.add('ativa');

            const barraAbas = document.querySelector('.abas-principais');
            if (barraAbas) barraAbas.style.display = 'none';

            document.querySelectorAll('.painel-tabs').forEach(painel => {
                painel.classList.remove('ativo');
                painel.classList.add('desativado');
            });

            const painelAlvo = document.getElementById(idPainel);
            if (painelAlvo) {
                painelAlvo.classList.add('ativo');
                painelAlvo.classList.remove('desativado');
            }

            const grupos = categoria === 'funcionario' ? window.gruposFuncionariosGlobais : window.gruposFuncoesGlobais;
            const contagem = categoria === 'funcionario' ? statusCounts.funcionario : statusCounts.funcao;
            carregarSubAbasInicial(painelAlvo, categoria, grupos, contagem);
        });
    });
}

// Remove acentos e caixa para não obrigar o usuário a digitar igual ao banco
// (ex.: "joao" acha "João").
function normalizarTextoBusca(texto) {
    return (texto || '')
        .toString()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .trim();
}

// Busca por funcionário filtra grupos inteiros; busca por solicitante filtra
// DENTRO do grupo (um accordion pode ter pedidos de vários solicitantes).
function filtrarGruposPorBusca(grupos, termoFuncionario, termoSolicitante) {
    return (grupos || [])
        .map(grupo => {
            if (!termoSolicitante) return grupo;
            return {
                ...grupo,
                registrosOriginais: (grupo.registrosOriginais || []).filter(registro => {
                    const solicitante = normalizarTextoBusca(registro.nomeSolicitante || registro.nomesolicitante || registro.solicitante_nome);
                    return solicitante.includes(termoSolicitante);
                })
            };
        })
        .filter(grupo => {
            const nome = normalizarTextoBusca(grupo.funcionario || grupo.nmfuncao);
            const passaFuncionario = !termoFuncionario || nome.includes(termoFuncionario);
            return passaFuncionario && (grupo.registrosOriginais || []).length > 0;
        });
}

// Delegação de eventos do painel — registrada uma vez só, sobrevive aos
// re-renders internos (por isso é delegação, e não listener por elemento).
function ligarInteracoesPainelPedidos(lista, podeAprovar) {
    lista.onclick = null;
    lista.addEventListener('click', function (evento) {
        const subAba = evento.target.closest('.sub-tab-btn');
        if (subAba) {
            const status = subAba.getAttribute('data-status');
            const categoria = subAba.getAttribute('data-categoria');
            const idContainer = subAba.getAttribute('data-list-id');

            document.querySelectorAll(`.sub-abas-pedidos[data-categoria="${categoria}"] .sub-tab-btn`)
                .forEach(botao => botao.classList.remove('ativa'));
            subAba.classList.add('ativa');

            lista.querySelectorAll('.pedidos-list-container').forEach(container => {
                container.classList.add('hidden');
                container.style.display = 'none';
            });

            const container = document.getElementById(idContainer);
            if (container) {
                container.classList.remove('hidden');
                container.style.display = 'flex';
                container.style.visibility = 'visible';
                container.style.height = '100%';
            }

            const grupos = categoria === 'funcionario' ? window.gruposFuncionariosGlobais : window.gruposFuncoesGlobais;
            renderizarPedidos(grupos, idContainer, categoria, status, podeAprovar);
            return;
        }

        const botaoVoltar = evento.target.closest('.btn-voltar-main-tabs');
        if (botaoVoltar) {
            const painelAtivo = botaoVoltar.closest('.painel-tabs.ativo');
            if (painelAtivo) {
                const rotulo = painelAtivo.id.includes('funcionarios') ? 'Funcionários' : 'Funções';
                painelAtivo.innerHTML = `<p class="mt-3">Clique na aba '${rotulo}' para ver os pedidos.</p>`;
                painelAtivo.classList.remove('ativo');
                painelAtivo.classList.add('desativado');
            }
            const barraAbas = document.querySelector('.abas-principais');
            if (barraAbas) barraAbas.style.display = 'flex';
        }
    });

    // Busca por funcionário e por solicitante: filtra a lista já carregada, sem
    // nova requisição.
    lista.oninput = null;
    lista.addEventListener('input', function (evento) {
        const campoBusca = evento.target.closest('[data-busca]');
        if (!campoBusca) return;

        const categoria = campoBusca.getAttribute('data-categoria');
        const subAbaAtiva = lista.querySelector(`.sub-abas-pedidos[data-categoria="${categoria}"] .sub-tab-btn.ativa`);
        if (!subAbaAtiva) return;

        const termoFuncionario = normalizarTextoBusca(lista.querySelector(`[data-busca="funcionario"][data-categoria="${categoria}"]`)?.value);
        const termoSolicitante = normalizarTextoBusca(lista.querySelector(`[data-busca="solicitante"][data-categoria="${categoria}"]`)?.value);

        const grupos = categoria === 'funcionario' ? window.gruposFuncionariosGlobais : window.gruposFuncoesGlobais;
        const filtrados = filtrarGruposPorBusca(grupos, termoFuncionario, termoSolicitante);

        renderizarPedidos(filtrados, subAbaAtiva.getAttribute('data-list-id'), categoria, subAbaAtiva.getAttribute('data-status'), podeAprovar);
    });
}

// Guarda a referência do recarregamento para quem aprova/rejeita poder pedir
// um refresh do painel sem reabrir a tela.
window.recarregarPainelPedidosGlobais = null;

async function mostrarPedidosUsuario() {
    const lista = document.getElementById("painelDetalhes");
    if (!lista) return;

    const ehMaster = usuarioTemPermissao();
    const ehSupremo = usuarioTemPermissaoSupremo();
    const podeAprovar = ehSupremo;
    window.ehMasterOuSupremo = ehMaster || ehSupremo;

    window.recarregarPainelPedidosGlobais = async function () {
        try {
            lista.innerHTML = `<div class="titulo-pedidos">Pedidos e Solicitações</div><p>Carregando dados...</p>`;

            const pedidos = await buscarPedidosUsuario();
            window.pedidosCompletosGlobais = pedidos;

            const grupos = ordenarGruposPorSolicitacaoMaisRecente(
                agruparPedidosPorFuncionario(desmembrarPedidosPorStatus(pedidos))
            );

            if (!grupos.length) {
                lista.innerHTML = `<div class="titulo-pedidos">Pedidos e Solicitações</div><p>Não há pedidos ou solicitações registradas.</p>`;
                return;
            }

            const { funcionarios, funcoes } = separarGruposPorAba(grupos);
            window.gruposFuncionariosGlobais = funcionarios;
            window.gruposFuncoesGlobais = funcoes;

            const statusCounts = {
                funcionario: contarStatusDosGrupos(funcionarios),
                funcao: contarStatusDosGrupos(funcoes)
            };

            lista.innerHTML = montarHtmlPainelPedidos(
                statusCounts.funcionario[STATUS_PENDENTE_LOWER],
                statusCounts.funcao[STATUS_PENDENTE_LOWER]
            );
            ligarAbasPrincipaisPedidos(statusCounts);
        } catch (err) {
            console.error("Erro ao processar/atualizar listagem:", err);
            lista.innerHTML = `<p class="erro">Erro ao carregar dados: ${err.message}</p>`;
        }
    };

    await window.recarregarPainelPedidosGlobais();
    ligarInteracoesPainelPedidos(lista, podeAprovar);
}

function criarSubTabsHTML(listContainerIdBase, categoria, statusCounts) {
    // statusCounts é o objeto de contagem que contém {pendente: X, autorizado: Y, rejeitado: Z}

    console.log("CRIARSUBTABS", listContainerIdBase, categoria, statusCounts);
    
    const statuses = [
        { status: STATUS_PENDENTE, label: "Pendentes" },
        { status: STATUS_AUTORIZADO, label: "Autorizados" },
        { status: STATUS_REJEITADO, label: "Rejeitados" }
    ];

    // Geração dos Botões de Sub-Abas
    const tabButtons = statuses.map(s => {
        const statusKey = s.status.toLowerCase(); // Usa a chave minúscula (pendente, autorizado, rejeitado)
        const count = statusCounts[statusKey] || 0; // Lê a contagem do objeto passado
        
        return `
            <button class="aba sub-tab-btn ${s.status === STATUS_PENDENTE ? 'ativa' : ''}" 
                data-status="${s.status}" data-categoria="${categoria}" data-list-id="${listContainerIdBase}-${s.status}">
                ${s.label} (<span id="${listContainerIdBase}-count-${s.status}">${count}</span>)
            </button>
        `;
    }).join('');

    // Conteúdo das Sub-Abas
    const tabContents = statuses.map(s => `
        <div id="${listContainerIdBase}-${s.status}" class="pedidos-list-container ${s.status === STATUS_PENDENTE ? '' : 'hidden'}">
            <p class="mt-2 text-sm text-gray-500">Carregando lista de pedidos ${s.label.toLowerCase()}...</p>
        </div>
    `).join('');

    // ESTRUTURA PRINCIPAL DO CONTEÚDO (INCLUI BOTÃO VOLTAR)
    return `
        <div class="sub-tab-view">
            <div class="sub-abas-pedidos" data-categoria="${categoria}">
                <button class="btn-voltar-main-tabs" type="button">
                    <i class="fas fa-arrow-left"></i> Voltar
                </button>
                ${tabButtons}
            </div>
            <div class="pedidos-busca-container">
                <input type="text" class="busca-funcionario-input" data-busca="funcionario" data-categoria="${categoria}" placeholder="Buscar por funcionário..." autocomplete="off">
                <input type="text" class="busca-funcionario-input" data-busca="solicitante" data-categoria="${categoria}" placeholder="Buscar por solicitante..." autocomplete="off">
            </div>
            <div class="sub-tabs-content">
                ${tabContents}
            </div>
        </div>
    `;
}


function carregarSubAbasInicial(targetContent, categoria, pedidos, statusCounts) {
    const listContainerIdBase = categoria === 'funcionario' ? "funcionarios-list" : "funcoes-list";
    const STATUS_PENDENTE_LOWER = (typeof STATUS_PENDENTE !== 'undefined' ? STATUS_PENDENTE : 'pendente').toLowerCase();
    
    // Verifica se o conteúdo já foi carregado para evitar re-criação
    if (targetContent.querySelector('.sub-abas-pedidos')) {
         // Se já foi carregado, apenas simula o clique em Pendentes
         const defaultSubTab = targetContent.querySelector(`.sub-tab-btn[data-status="${STATUS_PENDENTE}"]`);
         if(defaultSubTab) { 
             defaultSubTab.click(); 
         }
         return;
    }
    
    // Gera o HTML das sub-abas, passando o objeto de contagem CORRETO (statusCounts)
    const subTabsHTML = criarSubTabsHTML(listContainerIdBase, categoria, statusCounts); // <--- MUDANÇA CRÍTICA AQUI
    targetContent.innerHTML = subTabsHTML;

    // Simula o clique no primeiro sub-tab ("Pendentes")
    const defaultSubTab = targetContent.querySelector(`.sub-tab-btn[data-status="${STATUS_PENDENTE}"]`);
    if (defaultSubTab) {
        // Dispara o evento de clique, que será capturado pelo Listener na mostrarPedidosUsuario
        // O Listener usará o array 'pedidos' e o status 'STATUS_PENDENTE' para renderizar o conteúdo.
        defaultSubTab.click();
    }
}


function formatarNomeSolicitacao(campoNome, categoriaDoBanco) {

    if (!campoNome) return 'N/D';

    if (campoNome === 'statuscustofechado' && categoriaDoBanco === 'statuscacheliberado') {
        campoNome = 'statuscacheliberado';
    }
   // console.log(`DEBUG V72.0: Formatando campo "${campoNome}"...`);
    // 1. Remove o prefixo 'status' e converte para minúsculas para comparação
    let nomeLimpo = campoNome.toLowerCase().replace("status", "");
    
   // console.log(`DEBUG V72.0: Nome limpo "${nomeLimpo}"...`);
    // 2. Mapeamento de quebra de palavras conhecida (V72.0)
    const mapeamento = {
        "ajustecusto": "Ajuste de Custo",
        "caixinha": "Caixinha",
        "meiadiaria": "Meia Diária",
        "diariadobrada": "Diária Dobrada",
        "custofechado": "Cachê Fechado / Liberado",
        "cacheliberado": "Cachê Liberado",
        "aditivoextra": "Aditivo Extra",
        "vagasreaproveitadas": "Vagas Reaproveitadas"
    };

    if (mapeamento[nomeLimpo]) {
        return mapeamento[nomeLimpo];
    }

    // 3. Fallback: Tenta quebrar pelo Camel Case e Capitalizar
    let nomeFormatado = nomeLimpo.replace(/([a-z])([A-Z])/g, '$1 $2');

    console.log(`DEBUG V72.0: Campo "${campoNome}" formatado como "${nomeFormatado}".`);
    
    // Capitaliza a primeira letra de cada palavra
    return nomeFormatado.split(' ')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(' ');
}


function parseDateLocal(dateString) {
    if (!dateString) return null;
    // A string deve estar no formato 'YYYY-MM-DD'.
    const parts = dateString.split('-');
    if (parts.length !== 3) return null;

    const year = parseInt(parts[0], 10);
    // O mês em JavaScript é baseado em zero (0 = Janeiro, 11 = Dezembro).
    const month = parseInt(parts[1], 10) - 1; 
    const day = parseInt(parts[2], 10);

    // Cria o objeto Date usando o fuso horário LOCAL do ambiente.
    // Isso é a chave para evitar o deslocamento para o dia anterior (ex: 01/11)
    // quando o fuso horário local é negativo (ex: GMT-3).
    return new Date(year, month, day);
}


function safeParse(input) {
    if (Array.isArray(input)) return input;
    if (typeof input !== 'string') return [input];
    
    let result = input.trim();
    
    // 1. Caso de borda: Se for "null" ou "[]" (string vazia de array)
    if (result.toLowerCase() === 'null' || result === '[]') return [];

    // 2. Remove aspas externas se o JSON estiver envolto nelas (ex: '"{...}"')
    if (result.startsWith('"') && result.endsWith('"')) {
        result = result.substring(1, result.length - 1).trim();
    }
    
    // 3. Tenta corrigir aspas duplas incorretas (muito comum em serialização de DB)
    // Ex: Substitui [{""data"":...}] por [{"data":...}]
    let jsonString = result.replace(/""/g, '"');
    
    try {
        // Tenta parsear a string corrigida
        const parsed = JSON.parse(jsonString);
        return Array.isArray(parsed) ? parsed : [parsed];
    } catch (e) {
        // Fallback: Tenta parsear a string original sem correção de aspas (caso a correção tenha quebrado)
        try {
            const parsed = JSON.parse(result);
            return Array.isArray(parsed) ? parsed : [parsed];
        } catch (e) {
            // Fallback final: Se for uma string comum (ex: "Autorizado"), 
            // transforma em objeto para manter a compatibilidade com o filtro .status
            if (typeof result === 'string' && result.length > 0) {
                return [{ status: result }]; 
            }
            return input ? [input] : [];
        }
    }
}


function desbloquearFuncaoExcedidaAutorizada(secao2El, dataAlvo) {
    const linha = dataAlvo != null
        ? secao2El.querySelector(`.linha-data-aditivo[data-data="${String(dataAlvo).replace(/["\\]/g, '\\$&')}"]`)
        : null;
    if (linha) {
        const btnA = linha.querySelector('.aprovar-fe-func-ind');
        const btnR = linha.querySelector('.rejeitar-fe-func-ind');
        if (btnA) { btnA.disabled = false; btnA.style.opacity = '1'; btnA.style.cursor = 'pointer'; }
        if (btnR) { btnR.disabled = false; btnR.style.opacity = '1'; btnR.style.cursor = 'pointer'; }
    }
    // Header/título da seção só vira "tudo liberado" quando não sobrar nenhuma linha
    // ainda bloqueada — não assume mais estado uniforme pro card inteiro.
    const aindaBloqueadas = secao2El.querySelectorAll('.aprovar-fe-func-ind:disabled').length > 0;
    if (!aindaBloqueadas) {
        secao2El.style.borderLeftColor = '#16a34a';
        secao2El.style.background = 'var(--surface-3)';
        const titulo = secao2El.querySelector('.combo-fe-titulo-sec2');
        if (titulo) { titulo.innerHTML = '✅ Solicitação 2 — Autorizar Funcionário Excedido'; titulo.style.color = '#166534'; }
        const aviso = secao2El.querySelector('.combo-fe-aviso-lock');
        if (aviso) aviso.remove();
    }
}

function cardFuncaoExcedidaAditivo(pedido, statusDesejado, podeAprovar) {
    const adm = pedido.dadosAditivo;
    const fex = pedido.dadosFuncExcedido;
    const admSols  = adm?.solicitacoes_individuais || [];
    const fexSols  = fex?.solicitacoes_individuais || [];
    const idLogAdm = adm?.id_log || '';
    const idLogFex = fex?.id_log || '';
    const idsFexStr = fexSols.map(s => s.idsolicitacao).join(',');
    const justificativa = adm?.justificativaSolicitacao || pedido.justificativaSolicitacao
        || admSols[0]?.justificativa || fexSols[0]?.justificativa || '';
    const nmFunc       = pedido.nomefuncionario || '-';
    const descFunc     = pedido.descFuncao || pedido.descFuncaoOriginal || '-';
    const dtCriacao    = pedido.dtCriacao ? new Date(pedido.dtCriacao).toLocaleDateString('pt-BR') : '';
    const solicitante   = pedido.solicitante_nome || pedido.nomeSolicitante || adm?.solicitante_nome || adm?.nomeSolicitante || '';
    const idStaffEvento = pedido.idstaffevento || adm?.idstaffevento || '';

    const normalizarData = (sol) => {
        let datasRaw = sol.data;
        if (typeof datasRaw === 'string') datasRaw = datasRaw.replace(/[{}]/g, '').split(',');
        return String(Array.isArray(datasRaw) ? datasRaw[0] : datasRaw).trim();
    };
    // Solicitação 1 (Aditivo) e Solicitação 2 (FuncExcedido) são criadas em pares 1:1
    // por data — usamos isso pra travar/destravar cada linha da Seção 2 conforme SÓ a
    // data correspondente da Seção 1 (não mais um status único pro card inteiro).
    const admPorData = new Map(admSols.map(sol => [normalizarData(sol), sol]));

    const linhasDatas = (sols, classeAprovar, classeRejeitar, idLog, bloqueadoFn) => sols.map((sol, idx) => {
        let datasRaw = sol.data;
        if (typeof datasRaw === 'string') datasRaw = datasRaw.replace(/[{}]/g, '').split(',');
        const dataFmt = (Array.isArray(datasRaw) ? datasRaw : [datasRaw]).map(d => {
            const dt = String(d).trim();
            return dt.includes('-') ? dt.split('-').reverse().join('/') : dt;
        }).join(', ');
        const dataAttr = normalizarData(sol);
        const bloqueado = typeof bloqueadoFn === 'function' ? bloqueadoFn(sol, dataAttr) : !!bloqueadoFn;
        const solSt = (sol.status || 'pendente').toLowerCase();
        const jaResolvida = solSt === 'autorizado' || solSt === 'rejeitado';
        const isLast = idx === sols.length - 1;
        return `
            <div class="linha-data-aditivo" data-idsolicitacao="${sol.idsolicitacao}" data-data="${dataAttr}"
                 style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;border-bottom:${isLast ? 'none' : '1px solid #e5e7eb'};">
                <span style="font-size:13px;">📅 ${dataFmt}</span>
                <div style="display:flex;gap:6px;">
                    ${jaResolvida
                        ? `<span style="font-size:12px;font-weight:bold;color:${solSt === 'autorizado' ? '#16a34a' : '#dc2626'};border:1px solid ${solSt === 'autorizado' ? '#16a34a' : '#dc2626'};border-radius:3px;padding:2px 8px;">${solSt === 'autorizado' ? '✅ Autorizado' : '❌ Rejeitado'}</span>`
                        : (podeAprovar ? `
                            <button class="${classeAprovar}" data-id="${sol.idsolicitacao}" data-logid="${idLog}" data-data="${dataAttr}"
                                ${bloqueado ? 'disabled' : ''}
                                style="background:none;border:1px solid #16a34a;border-radius:3px;font-size:13px;padding:2px 6px;${bloqueado ? 'opacity:0.35;cursor:not-allowed;' : 'cursor:pointer;'}">✅</button>
                            <button class="${classeRejeitar}" data-id="${sol.idsolicitacao}" data-logid="${idLog}" data-data="${dataAttr}"
                                ${bloqueado ? 'disabled' : ''}
                                style="background:none;border:1px solid #dc2626;border-radius:3px;font-size:13px;padding:2px 6px;${bloqueado ? 'opacity:0.35;cursor:not-allowed;' : 'cursor:pointer;'}">❌</button>
                          ` : '')
                    }
                </div>
            </div>`;
    }).join('');

    const htmlSols1 = linhasDatas(admSols, 'aprovar-fe-aditivo-ind', 'rejeitar-fe-aditivo-ind', idLogAdm, false);
    const htmlSols2 = linhasDatas(fexSols, 'aprovar-fe-func-ind', 'rejeitar-fe-func-ind', idLogFex, (sol, dataAttr) => {
        const admMatch = admPorData.get(dataAttr);
        // Sem par encontrado (dado legado/órfão) → mantém bloqueado por segurança.
        if (!admMatch) return true;
        const stAdm = (admMatch.status || 'pendente').toLowerCase();
        return stAdm === 'pendente' || stAdm === 'rejeitado';
    });

    // Resumo agregado — só pra exibição do banner da Seção 2 (informativo). O
    // desbloqueio/travamento de cada linha já é individual, por data, acima.
    const statusUnicosAdm = new Set(admSols.map(sol => (sol.status || 'pendente').toLowerCase().trim()));
    const aditivoPendente         = admSols.length === 0 || statusUnicosAdm.has('pendente');
    const aditivoTodoRejeitado    = !aditivoPendente && statusUnicosAdm.size === 1 && statusUnicosAdm.has('rejeitado');
    const aditivoParcialRejeitado = !aditivoPendente && !aditivoTodoRejeitado && statusUnicosAdm.has('rejeitado');

    const corSec2Border = aditivoPendente ? '#9ca3af' : aditivoTodoRejeitado ? '#dc2626' : aditivoParcialRejeitado ? '#f59e0b' : '#16a34a';
    const bgSec2        = aditivoPendente ? '#f9fafb' : aditivoTodoRejeitado ? '#fef2f2' : aditivoParcialRejeitado ? '#fffbeb' : '#f0fdf4';
    const corSec2Titulo = aditivoPendente ? '#6b7280' : aditivoTodoRejeitado ? '#991b1b' : aditivoParcialRejeitado ? '#92400e' : '#166534';
    const iconeSec2     = aditivoPendente ? '🔒' : aditivoTodoRejeitado ? '❌' : aditivoParcialRejeitado ? '⚠️' : '✅';
    const tituloSec2    = aditivoPendente
        ? 'Solicitação 2 — Autorizar Funcionário Excedido (libera por data)'
        : aditivoTodoRejeitado
            ? 'Solicitação 2 — Cancelada (Aditivo Rejeitado)'
            : aditivoParcialRejeitado
                ? 'Solicitação 2 — Autorizar Funcionário Excedido (parte do Aditivo foi rejeitada)'
                : 'Solicitação 2 — Autorizar Funcionário Excedido';

    return `
        <div class="combo-fe-card"
             data-ids-funcexc="${idsFexStr}"
             data-idlog-funcexc="${idLogFex}"
             data-idstaffevento="${idStaffEvento}"
             style="background:var(--surface-1);border:1px solid #ddd;border-radius:8px;padding:16px;margin-bottom:10px;">
            <div style="font-size:12px;color:var(--text-2);margin-bottom:10px;">
                <strong>Funcionário:</strong> ${nmFunc} &nbsp;|&nbsp; <strong>Função:</strong> ${descFunc}
                ${dtCriacao ? `&nbsp;|&nbsp; <strong>Solicitado em:</strong> ${dtCriacao}${solicitante ? ` &nbsp; <strong>por:</strong> ${solicitante}` : ''}` : ''}
                ${justificativa ? `<br><span style="margin-top:4px;display:block;"><strong>Justificativa:</strong> ${justificativa}</span>` : ''}
            </div>
            <div class="combo-fe-secao-aditivo"
                 style="background:#fee2e2;border-radius:6px;padding:12px;margin-bottom:10px;border-left:4px solid #dc2626;">
                <div style="font-weight:700;color:#991b1b;margin-bottom:4px;">
                    🔴 Solicitação 1 — Aditivo: Criar Vaga no Orçamento (Limite Financeiro Excedido)
                </div>
                <div style="font-size:11px;color:#7f1d1d;margin-bottom:8px;line-height:1.5;">
                    Ao <strong>Autorizar</strong> uma data: vaga extra criada no orçamento pra ela, autorização do
                    funcionário nessa mesma data é desbloqueada.<br>
                    Ao <strong>Rejeitar</strong> uma data: só a autorização do funcionário nessa mesma data é
                    cancelada — as demais datas seguem seu próprio fluxo.
                </div>
                ${justificativa ? `<div style="font-size:11px;color:#92400e;margin-bottom:8px;"><strong>Justificativa:</strong> ${justificativa}</div>` : ''}
                <div style="border:1px solid #fca5a5;border-radius:4px;overflow:hidden;font-size:12px;">
                    <div style="background:var(--surface-3);padding:4px 10px;border-bottom:1px solid #fca5a5;font-size:11px;"><strong>DATAS EXCEDIDAS</strong></div>
                    ${htmlSols1 || '<div style="padding:8px 10px;color:var(--text-3);">—</div>'}
                </div>
            </div>
            <div class="combo-fe-secao-func" data-idlog="${idLogFex}"
                 style="background:${bgSec2};border-radius:6px;padding:12px;border-left:4px solid ${corSec2Border};">
                <div class="combo-fe-titulo-sec2" style="font-weight:700;color:${corSec2Titulo};margin-bottom:4px;">
                    ${iconeSec2} ${tituloSec2}
                </div>
                ${aditivoPendente ? `<div class="combo-fe-aviso-lock" style="font-size:11px;color:var(--text-2);margin-bottom:8px;">Cada data libera assim que a mesma data do Aditivo acima for autorizada.</div>` : ''}
                ${aditivoTodoRejeitado ? `<div style="font-size:11px;color:#991b1b;margin-bottom:8px;">Aditivo rejeitado em todas as datas — autorização do funcionário cancelada nessas datas.</div>` : ''}
                ${aditivoParcialRejeitado ? `<div style="font-size:11px;color:#92400e;margin-bottom:8px;">Parte das datas do Aditivo foi rejeitada — só as datas correspondentes do funcionário foram canceladas.</div>` : ''}
                <div style="border:1px solid ${aditivoPendente ? '#e5e7eb' : '#86efac'};border-radius:4px;overflow:hidden;font-size:12px;">
                    <div style="background:${aditivoPendente ? '#f3f4f6' : '#dcfce7'};padding:4px 10px;border-bottom:1px solid ${aditivoPendente ? '#e5e7eb' : '#86efac'};font-size:11px;"><strong>DATAS DO FUNCIONÁRIO</strong></div>
                    ${htmlSols2 || '<div style="padding:8px 10px;color:var(--text-3);">—</div>'}
                </div>
            </div>
        </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Combo FuncExcedido + Vaga Excedida — clone estrutural de cardFuncaoExcedidaAditivo
// (mesma trava por-data, mesmo par Solicitação 1/Solicitação 2), mas Solicitação 1
// pode ser Aditivo OU Extra Bonificado (pedido.isComboAditivoFuncVaga), e o motivo é
// "Vaga Excedida" (quantidade/dias orçados) em vez de "Limite Financeiro Excedido".
// Mantido como função separada (não generalizada dentro de cardFuncaoExcedidaAditivo)
// de propósito: aquela função é grande e foi corrigida recentemente nesta sessão —
// clonar aqui evita risco de regressão nela.

function desbloquearFuncaoExcedidaVagaAutorizada(secao2El, dataAlvo) {
    const linha = dataAlvo != null
        ? secao2El.querySelector(`.linha-data-aditivo[data-data="${String(dataAlvo).replace(/["\\]/g, '\\$&')}"]`)
        : null;
    if (linha) {
        const btnA = linha.querySelector('.aprovar-fev-func-ind');
        const btnR = linha.querySelector('.rejeitar-fev-func-ind');
        if (btnA) { btnA.disabled = false; btnA.style.opacity = '1'; btnA.style.cursor = 'pointer'; }
        if (btnR) { btnR.disabled = false; btnR.style.opacity = '1'; btnR.style.cursor = 'pointer'; }
    }
    const aindaBloqueadas = secao2El.querySelectorAll('.aprovar-fev-func-ind:disabled').length > 0;
    if (!aindaBloqueadas) {
        secao2El.style.borderLeftColor = '#16a34a';
        secao2El.style.background = 'var(--surface-3)';
        const titulo = secao2El.querySelector('.combo-fev-titulo-sec2');
        if (titulo) { titulo.innerHTML = '✅ Solicitação 2 — Autorizar Funcionário Excedido'; titulo.style.color = '#166534'; }
        const aviso = secao2El.querySelector('.combo-fev-aviso-lock');
        if (aviso) aviso.remove();
    }
}

function cardFuncaoExcedidaVagaExcedida(pedido, statusDesejado, podeAprovar) {
    const adm = pedido.dadosAditivo;
    const fex = pedido.dadosFuncExcedido;
    const admSols  = adm?.solicitacoes_individuais || [];
    const fexSols  = fex?.solicitacoes_individuais || [];
    const idLogAdm = adm?.id_log || '';
    const idLogFex = fex?.id_log || '';
    const idsFexStr = fexSols.map(s => s.idsolicitacao).join(',');
    const justificativa = adm?.justificativaSolicitacao || pedido.justificativaSolicitacao
        || admSols[0]?.justificativa || fexSols[0]?.justificativa || '';
    const nmFunc       = pedido.nomefuncionario || '-';
    const descFunc     = pedido.descFuncao || pedido.descFuncaoOriginal || '-';
    const dtCriacao    = pedido.dtCriacao ? new Date(pedido.dtCriacao).toLocaleDateString('pt-BR') : '';
    const solicitante   = pedido.solicitante_nome || pedido.nomeSolicitante || adm?.solicitante_nome || adm?.nomeSolicitante || '';
    const idStaffEvento = pedido.idstaffevento || adm?.idstaffevento || '';

    const isAditivo  = !!(pedido.isComboAditivoFuncVaga);
    const labelTipo1 = isAditivo ? 'Aditivo' : 'Extra Bonificado';

    const normalizarData = (sol) => {
        let datasRaw = sol.data;
        if (typeof datasRaw === 'string') datasRaw = datasRaw.replace(/[{}]/g, '').split(',');
        return String(Array.isArray(datasRaw) ? datasRaw[0] : datasRaw).trim();
    };
    // Solicitação 1 (Aditivo/Extra Bonificado) e Solicitação 2 (FuncExcedido) são
    // criadas em pares 1:1 por data — trava/destrava cada linha da Seção 2 conforme
    // SÓ a data correspondente da Seção 1.
    const admPorData = new Map(admSols.map(sol => [normalizarData(sol), sol]));

    const linhasDatas = (sols, classeAprovar, classeRejeitar, idLog, bloqueadoFn) => sols.map((sol, idx) => {
        let datasRaw = sol.data;
        if (typeof datasRaw === 'string') datasRaw = datasRaw.replace(/[{}]/g, '').split(',');
        const dataFmt = (Array.isArray(datasRaw) ? datasRaw : [datasRaw]).map(d => {
            const dt = String(d).trim();
            return dt.includes('-') ? dt.split('-').reverse().join('/') : dt;
        }).join(', ');
        const dataAttr = normalizarData(sol);
        const bloqueado = typeof bloqueadoFn === 'function' ? bloqueadoFn(sol, dataAttr) : !!bloqueadoFn;
        const solSt = (sol.status || 'pendente').toLowerCase();
        const jaResolvida = solSt === 'autorizado' || solSt === 'rejeitado';
        const isLast = idx === sols.length - 1;
        return `
            <div class="linha-data-aditivo" data-idsolicitacao="${sol.idsolicitacao}" data-data="${dataAttr}"
                 style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;border-bottom:${isLast ? 'none' : '1px solid #e5e7eb'};">
                <span style="font-size:13px;">📅 ${dataFmt}</span>
                <div style="display:flex;gap:6px;">
                    ${jaResolvida
                        ? `<span style="font-size:12px;font-weight:bold;color:${solSt === 'autorizado' ? '#16a34a' : '#dc2626'};border:1px solid ${solSt === 'autorizado' ? '#16a34a' : '#dc2626'};border-radius:3px;padding:2px 8px;">${solSt === 'autorizado' ? '✅ Autorizado' : '❌ Rejeitado'}</span>`
                        : (podeAprovar ? `
                            <button class="${classeAprovar}" data-id="${sol.idsolicitacao}" data-logid="${idLog}" data-data="${dataAttr}"
                                ${bloqueado ? 'disabled' : ''}
                                style="background:none;border:1px solid #16a34a;border-radius:3px;font-size:13px;padding:2px 6px;${bloqueado ? 'opacity:0.35;cursor:not-allowed;' : 'cursor:pointer;'}">✅</button>
                            <button class="${classeRejeitar}" data-id="${sol.idsolicitacao}" data-logid="${idLog}" data-data="${dataAttr}"
                                ${bloqueado ? 'disabled' : ''}
                                style="background:none;border:1px solid #dc2626;border-radius:3px;font-size:13px;padding:2px 6px;${bloqueado ? 'opacity:0.35;cursor:not-allowed;' : 'cursor:pointer;'}">❌</button>
                          ` : '')
                    }
                </div>
            </div>`;
    }).join('');

    const htmlSols1 = linhasDatas(admSols, 'aprovar-fev-aditivo-ind', 'rejeitar-fev-aditivo-ind', idLogAdm, false);
    const htmlSols2 = linhasDatas(fexSols, 'aprovar-fev-func-ind', 'rejeitar-fev-func-ind', idLogFex, (sol, dataAttr) => {
        const admMatch = admPorData.get(dataAttr);
        if (!admMatch) return true;
        const stAdm = (admMatch.status || 'pendente').toLowerCase();
        return stAdm === 'pendente' || stAdm === 'rejeitado';
    });

    const statusUnicosAdm = new Set(admSols.map(sol => (sol.status || 'pendente').toLowerCase().trim()));
    const aditivoPendente         = admSols.length === 0 || statusUnicosAdm.has('pendente');
    const aditivoTodoRejeitado    = !aditivoPendente && statusUnicosAdm.size === 1 && statusUnicosAdm.has('rejeitado');
    const aditivoParcialRejeitado = !aditivoPendente && !aditivoTodoRejeitado && statusUnicosAdm.has('rejeitado');

    const corSec2Border = aditivoPendente ? '#9ca3af' : aditivoTodoRejeitado ? '#dc2626' : aditivoParcialRejeitado ? '#f59e0b' : '#16a34a';
    const bgSec2        = aditivoPendente ? '#f9fafb' : aditivoTodoRejeitado ? '#fef2f2' : aditivoParcialRejeitado ? '#fffbeb' : '#f0fdf4';
    const corSec2Titulo = aditivoPendente ? '#6b7280' : aditivoTodoRejeitado ? '#991b1b' : aditivoParcialRejeitado ? '#92400e' : '#166534';
    const iconeSec2     = aditivoPendente ? '🔒' : aditivoTodoRejeitado ? '❌' : aditivoParcialRejeitado ? '⚠️' : '✅';
    const tituloSec2    = aditivoPendente
        ? 'Solicitação 2 — Autorizar Funcionário Excedido (libera por data)'
        : aditivoTodoRejeitado
            ? `Solicitação 2 — Cancelada (${labelTipo1} Rejeitado)`
            : aditivoParcialRejeitado
                ? `Solicitação 2 — Autorizar Funcionário Excedido (parte do ${labelTipo1} foi rejeitada)`
                : 'Solicitação 2 — Autorizar Funcionário Excedido';

    return `
        <div class="combo-fev-card"
             data-ids-funcexc="${idsFexStr}"
             data-idlog-funcexc="${idLogFex}"
             data-idstaffevento="${idStaffEvento}"
             data-natureza="${isAditivo ? 'aditivo' : 'extra'}"
             style="background:var(--surface-1);border:1px solid #ddd;border-radius:8px;padding:16px;margin-bottom:10px;">
            <div style="font-size:12px;color:var(--text-2);margin-bottom:10px;">
                <strong>Funcionário:</strong> ${nmFunc} &nbsp;|&nbsp; <strong>Função:</strong> ${descFunc}
                ${dtCriacao ? `&nbsp;|&nbsp; <strong>Solicitado em:</strong> ${dtCriacao}${solicitante ? ` &nbsp; <strong>por:</strong> ${solicitante}` : ''}` : ''}
                ${justificativa ? `<br><span style="margin-top:4px;display:block;"><strong>Justificativa:</strong> ${justificativa}</span>` : ''}
            </div>
            <div class="combo-fev-secao-aditivo"
                 style="background:#fee2e2;border-radius:6px;padding:12px;margin-bottom:10px;border-left:4px solid #dc2626;">
                <div style="font-weight:700;color:#991b1b;margin-bottom:4px;">
                    🔴 Solicitação 1 — ${labelTipo1}: ${isAditivo ? 'Criar Vaga no Orçamento' : 'Diária Extra Bonificada'} (Vaga Excedida)
                </div>
                <div style="font-size:11px;color:#7f1d1d;margin-bottom:8px;line-height:1.5;">
                    Ao <strong>Autorizar</strong> uma data: ${isAditivo
                        ? 'vaga extra criada no orçamento pra ela, autorização do funcionário nessa mesma data é desbloqueada.'
                        : 'a empresa absorve o custo da diária extra sem criar vaga no orçamento, e a autorização do funcionário nessa mesma data é desbloqueada.'}<br>
                    Ao <strong>Rejeitar</strong> uma data: só a autorização do funcionário nessa mesma data é
                    cancelada — as demais datas seguem seu próprio fluxo.
                </div>
                ${justificativa ? `<div style="font-size:11px;color:#92400e;margin-bottom:8px;"><strong>Justificativa:</strong> ${justificativa}</div>` : ''}
                <div style="border:1px solid #fca5a5;border-radius:4px;overflow:hidden;font-size:12px;">
                    <div style="background:var(--surface-3);padding:4px 10px;border-bottom:1px solid #fca5a5;font-size:11px;"><strong>DATAS EXCEDIDAS</strong></div>
                    ${htmlSols1 || '<div style="padding:8px 10px;color:var(--text-3);">—</div>'}
                </div>
            </div>
            <div class="combo-fev-secao-func" data-idlog="${idLogFex}"
                 style="background:${bgSec2};border-radius:6px;padding:12px;border-left:4px solid ${corSec2Border};">
                <div class="combo-fev-titulo-sec2" style="font-weight:700;color:${corSec2Titulo};margin-bottom:4px;">
                    ${iconeSec2} ${tituloSec2}
                </div>
                ${aditivoPendente ? `<div class="combo-fev-aviso-lock" style="font-size:11px;color:var(--text-2);margin-bottom:8px;">Cada data libera assim que a mesma data do ${labelTipo1} acima for autorizada.</div>` : ''}
                ${aditivoTodoRejeitado ? `<div style="font-size:11px;color:#991b1b;margin-bottom:8px;">${labelTipo1} rejeitado em todas as datas — autorização do funcionário cancelada nessas datas.</div>` : ''}
                ${aditivoParcialRejeitado ? `<div style="font-size:11px;color:#92400e;margin-bottom:8px;">Parte das datas do ${labelTipo1} foi rejeitada — só as datas correspondentes do funcionário foram canceladas.</div>` : ''}
                <div style="border:1px solid ${aditivoPendente ? '#e5e7eb' : '#86efac'};border-radius:4px;overflow:hidden;font-size:12px;">
                    <div style="background:${aditivoPendente ? '#f3f4f6' : '#dcfce7'};padding:4px 10px;border-bottom:1px solid ${aditivoPendente ? '#e5e7eb' : '#86efac'};font-size:11px;"><strong>DATAS DO FUNCIONÁRIO</strong></div>
                    ${htmlSols2 || '<div style="padding:8px 10px;color:var(--text-3);">—</div>'}
                </div>
            </div>
        </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────

function desbloquearBonificadoAutorizado(secao2El) {
    const linhas = secao2El.querySelectorAll('.linha-data-aditivo');
    linhas.forEach(linha => {
        const btnA = linha.querySelector('.aprovar-edb-dobrada-ind');
        const btnR = linha.querySelector('.rejeitar-edb-dobrada-ind');
        if (btnA) { btnA.disabled = false; btnA.style.opacity = '1'; btnA.style.cursor = 'pointer'; }
        if (btnR) { btnR.disabled = false; btnR.style.opacity = '1'; btnR.style.cursor = 'pointer'; }
    });
    secao2El.style.borderLeftColor = '#16a34a';
    secao2El.style.background = 'var(--surface-3)';
    const titulo = secao2El.querySelector('.combo-edb-titulo-sec2');
    if (titulo) { titulo.innerHTML = '✅ Solicitação 2 — Autorizar Diária Dobrada'; titulo.style.color = '#166534'; }
    const aviso = secao2El.querySelector('.combo-edb-aviso-lock');
    if (aviso) aviso.remove();
}

function cardBonificadoDiariaDobrada(pedido, statusDesejado, podeAprovar) {
    const bonif  = pedido.dadosBonificado;
    const dobr   = pedido.dadosDobrada;
    const stBonif = (bonif?.status_aprovacao || 'pendente').toLowerCase();
    const bonifPendente  = stBonif === 'pendente';
    const bonifRejeitado = stBonif === 'rejeitado';
    const bonifSols = bonif?.solicitacoes_individuais || [];
    const dobrSols  = dobr?.solicitacoes_individuais  || [];
    const idLogBonif = bonif?.id_log || '';
    const idLogDobr  = dobr?.id_log  || '';
    const idsDobrStr = dobrSols.map(s => s.idsolicitacao).join(',');
    const justificativa     = bonif?.justificativaSolicitacao || pedido.justificativaSolicitacao
        || bonifSols[0]?.justificativa || '';
    const justificativaDobr = dobrSols[0]?.justificativa || dobr?.justificativaSolicitacao || '';
    const nmFunc        = pedido.nomefuncionario || '-';
    // descFuncPrincipal: função principal do staffevento (fn_orig = se.idfuncao)
    const descFuncPrincipal = bonif?.descFuncaoOriginal || pedido.descFuncaoOriginal || '-';
    // descFuncBonif: função do extra bonificado (fn = s.idfuncao da solicitação)
    const descFuncBonif = bonif?.descFuncao || pedido.descFuncao || descFuncPrincipal;
    // descFuncDobr: mesma função do extra bonificado (a dobrada cobre o mesmo slot excedido)
    const descFuncDobr  = descFuncBonif;
    const dtCriacao     = pedido.dtCriacao ? new Date(pedido.dtCriacao).toLocaleDateString('pt-BR') : '';
    const solicitante   = pedido.solicitante_nome || pedido.nomeSolicitante || bonif?.solicitante_nome || bonif?.nomeSolicitante || '';
    const idStaffEvento = pedido.idstaffevento || bonif?.idstaffevento || '';

    const linhasDatas = (sols, classeAprovar, classeRejeitar, idLog, bloqueado) => sols.map((sol, idx) => {
        let datasRaw = sol.data;
        if (typeof datasRaw === 'string') datasRaw = datasRaw.replace(/[{}]/g, '').split(',');
        const dataFmt = (Array.isArray(datasRaw) ? datasRaw : [datasRaw]).map(d => {
            const dt = String(d).trim();
            return dt.includes('-') ? dt.split('-').reverse().join('/') : dt;
        }).join(', ');
        const dataAttr = String(Array.isArray(datasRaw) ? datasRaw[0] : datasRaw).trim();
        const solSt = (sol.status || 'pendente').toLowerCase();
        const jaResolvida = solSt === 'autorizado' || solSt === 'rejeitado';
        const isLast = idx === sols.length - 1;
        return `
            <div class="linha-data-aditivo" data-idsolicitacao="${sol.idsolicitacao}"
                 style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;border-bottom:${isLast ? 'none' : '1px solid #e5e7eb'};">
                <span style="font-size:13px;">📅 ${dataFmt}</span>
                <div style="display:flex;gap:6px;">
                    ${jaResolvida
                        ? `<span style="font-size:12px;font-weight:bold;color:${solSt === 'autorizado' ? '#16a34a' : '#dc2626'};border:1px solid ${solSt === 'autorizado' ? '#16a34a' : '#dc2626'};border-radius:3px;padding:2px 8px;">${solSt === 'autorizado' ? '✅ Autorizado' : '❌ Rejeitado'}</span>`
                        : (podeAprovar ? `
                            <button class="${classeAprovar}" data-id="${sol.idsolicitacao}" data-logid="${idLog}" data-data="${dataAttr}"
                                ${bloqueado ? 'disabled' : ''}
                                style="background:none;border:1px solid #16a34a;border-radius:3px;font-size:13px;padding:2px 6px;${bloqueado ? 'opacity:0.35;cursor:not-allowed;' : 'cursor:pointer;'}">✅</button>
                            <button class="${classeRejeitar}" data-id="${sol.idsolicitacao}" data-logid="${idLog}" data-data="${dataAttr}"
                                ${bloqueado ? 'disabled' : ''}
                                style="background:none;border:1px solid #dc2626;border-radius:3px;font-size:13px;padding:2px 6px;${bloqueado ? 'opacity:0.35;cursor:not-allowed;' : 'cursor:pointer;'}">❌</button>
                          ` : '')
                    }
                </div>
            </div>`;
    }).join('');

    const htmlSols1 = linhasDatas(bonifSols, 'aprovar-edb-bonif-ind', 'rejeitar-edb-bonif-ind', idLogBonif, false);
    const htmlSols2 = linhasDatas(dobrSols, 'aprovar-edb-dobrada-ind', 'rejeitar-edb-dobrada-ind', idLogDobr, bonifPendente || bonifRejeitado);

    const corSec2Border = bonifPendente ? '#9ca3af' : bonifRejeitado ? '#dc2626' : '#16a34a';
    const bgSec2        = bonifPendente ? '#f9fafb' : bonifRejeitado ? '#fef2f2' : '#f0fdf4';
    const corSec2Titulo = bonifPendente ? '#6b7280' : bonifRejeitado ? '#991b1b' : '#166534';
    const iconeSec2     = bonifPendente ? '🔒' : bonifRejeitado ? '❌' : '✅';
    const isAditivo  = !!(pedido.isComboAditivoDobrada);
    const labelTipo1 = isAditivo ? 'Aditivo' : 'Extra Bonificado';
    const tituloSec2    = bonifPendente
        ? `Solicitação 2 — Diária Dobrada: ${descFuncDobr} (Bloqueado)`
        : bonifRejeitado
            ? `Solicitação 2 — Cancelada (${labelTipo1} Rejeitado)`
            : `Solicitação 2 — Autorizar Diária Dobrada: ${descFuncDobr}`;

    return `
        <div class="combo-edb-card"
             data-ids-dobrada="${idsDobrStr}"
             data-idlog-dobrada="${idLogDobr}"
             data-idstaffevento="${idStaffEvento}"
             style="background:var(--surface-1);border:1px solid #ddd;border-radius:8px;padding:16px;margin-bottom:10px;">
            <div style="font-size:12px;color:var(--text-2);margin-bottom:10px;">
                <strong>Funcionário:</strong> ${nmFunc} &nbsp;|&nbsp; <strong>Função:</strong> ${descFuncPrincipal}
                ${dtCriacao ? `&nbsp;|&nbsp; <strong>Solicitado em:</strong> ${dtCriacao}${solicitante ? ` &nbsp; <strong>por:</strong> ${solicitante}` : ''}` : ''}
            </div>
            <div class="combo-edb-secao-bonif"
                 style="background:#fef3c7;border-radius:6px;padding:12px;margin-bottom:10px;border-left:4px solid #d97706;">
                <div style="font-weight:700;color:#92400e;margin-bottom:4px;">
                    🟡 Solicitação 1 — ${isAditivo ? 'Aditivo' : 'Extra Bonificado'} para a função: <span style="text-decoration:underline;">${descFuncBonif}</span>
                    ${isAditivo ? '(Inclusão no Orçamento)' : '(Empresa Absorve)'}
                </div>
                <div style="font-size:11px;color:#78350f;margin-bottom:8px;line-height:1.5;">
                    ${isAditivo
                        ? `Ao <strong>Autorizar</strong>: aditivo incluído no orçamento, autorização da Diária Dobrada é desbloqueada.<br>
                           Ao <strong>Rejeitar</strong>: Diária Dobrada é cancelada automaticamente.`
                        : `Ao <strong>Autorizar</strong>: empresa absorve o custo extra, autorização da Diária Dobrada é desbloqueada.<br>
                           Ao <strong>Rejeitar</strong>: Diária Dobrada é cancelada automaticamente.`
                    }
                </div>
                ${justificativa ? `<div style="font-size:11px;color:#92400e;margin-bottom:8px;"><strong>Obs:</strong> ${justificativa}</div>` : ''}
                <div style="border:1px solid #fcd34d;border-radius:4px;overflow:hidden;font-size:12px;">
                    <div style="background:#fffbeb;padding:4px 10px;border-bottom:1px solid #fcd34d;font-size:11px;"><strong>DATAS SOLICITADAS</strong></div>
                    ${htmlSols1 || '<div style="padding:8px 10px;color:var(--text-3);">—</div>'}
                </div>
            </div>
            <div class="combo-edb-secao-dobrada" data-idlog="${idLogDobr}"
                 style="background:${bgSec2};border-radius:6px;padding:12px;border-left:4px solid ${corSec2Border};">
                <div class="combo-edb-titulo-sec2" style="font-weight:700;color:${corSec2Titulo};margin-bottom:4px;">
                    ${iconeSec2} ${tituloSec2}
                </div>
                ${justificativaDobr ? `<div style="font-size:11px;color:var(--text-1);margin-bottom:8px;"><strong>Justificativa:</strong> ${justificativaDobr}</div>` : ''}
                ${bonifPendente  ? `<div class="combo-edb-aviso-lock" style="font-size:11px;color:var(--text-2);margin-bottom:8px;">Aguardando resolução do ${isAditivo ? 'Aditivo' : 'Extra Bonificado'} acima antes de autorizar a Diária Dobrada.</div>` : ''}
                ${bonifRejeitado ? `<div style="font-size:11px;color:#991b1b;margin-bottom:8px;">${isAditivo ? 'Aditivo' : 'Extra Bonificado'} rejeitado — Diária Dobrada cancelada automaticamente.</div>` : ''}
                ${!bonifRejeitado ? `
                <div style="border:1px solid ${bonifPendente ? '#e5e7eb' : '#86efac'};border-radius:4px;overflow:hidden;font-size:12px;">
                    <div style="background:${bonifPendente ? '#f3f4f6' : '#dcfce7'};padding:4px 10px;border-bottom:1px solid ${bonifPendente ? '#e5e7eb' : '#86efac'};font-size:11px;"><strong>DATAS DA DIÁRIA DOBRADA</strong></div>
                    ${htmlSols2 || '<div style="padding:8px 10px;color:var(--text-3);">—</div>'}
                </div>` : ''}
            </div>
        </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────

function renderizarPedidos(pedidosCompletos, containerId, categoria, statusDesejado, podeAprovar) {
    // Autorizados/Rejeitados vêm em ordem alfabética (A-Z); Pendentes mantém a ordem que
    // já vinha (agrupado por idfuncionario, mais recente primeiro) — não mexer nessa.
    const statusOrdenacaoLower = (statusDesejado || '').toLowerCase();
    const STATUS_AUTORIZADO_ORDEM = (typeof STATUS_AUTORIZADO !== 'undefined' ? STATUS_AUTORIZADO : 'autorizado').toLowerCase();
    const STATUS_REJEITADO_ORDEM = (typeof STATUS_REJEITADO !== 'undefined' ? STATUS_REJEITADO : 'rejeitado').toLowerCase();
    if (statusOrdenacaoLower === STATUS_AUTORIZADO_ORDEM || statusOrdenacaoLower === STATUS_REJEITADO_ORDEM) {
        pedidosCompletos = [...pedidosCompletos].sort((a, b) => {
            const nomeA = (a.funcionario || a.nmfuncao || '').toLowerCase();
            const nomeB = (b.funcionario || b.nmfuncao || '').toLowerCase();
            return nomeA.localeCompare(nomeB, 'pt-BR');
        });
    }

    window.pedidosCompletosGlobais = pedidosCompletos;
    const container = document.getElementById(containerId);
    if (!container) return;

    // 🛑 CORREÇÃO V61.0: Garante que o contêiner de lista se comporte como uma coluna.
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.flexWrap = 'nowrap';
    container.style.gap = '10px';
    container.innerHTML = '';

    const camposTodos = [
        "statusajustecusto",
        "statuscaixinha",
        "statusmeiadiaria",
        "statusdiariadobrada",
        "statuscustofechado",
        "statuscacheliberado",
        "statusvagaexcedida",
        "statusvagasreaproveitadas",
        CAMPO_ADITIVO_EXTRA
    ];

    // 🛑 V65.0: Inclui o campo placeholder para renderização na Seção 2
    const camposRenderizaveis = [...camposTodos, 'pedido_principal'];

    const STATUS_PENDENTE_LOWER = (typeof STATUS_PENDENTE !== 'undefined' ? STATUS_PENDENTE : 'pendente').toLowerCase();
    const STATUS_AUTORIZADO_LOWER = (typeof STATUS_AUTORIZADO !== 'undefined' ? STATUS_AUTORIZADO : 'autorizado').toLowerCase();
    const STATUS_REJEITADO_LOWER = (typeof STATUS_REJEITADO !== 'undefined' ? STATUS_REJEITADO : 'rejeitado').toLowerCase();

    let totalItensRenderizados = 0;

    // --- 1. FILTRAGEM E CONSOLIDAÇÃO ---
    const gruposFiltrados = [];

    // --- 1. FILTRAGEM E CONSOLIDAÇÃO ---
    pedidosCompletos.forEach(grupoConsolidado => {
        let chaveRenderizacao;
        if (categoria === 'funcionario') {
            chaveRenderizacao = grupoConsolidado.funcionario;
        } else {
            // Tenta pegar nmfuncao, senão busca dentro dos registros
            chaveRenderizacao = grupoConsolidado.nmfuncao; // <--- 1º Ponto de falha
            
            if (!chaveRenderizacao) {
                // Fallback: pega tipoSolicitacao do primeiro registro de vaga excedida
                const primeiroAditivo = (grupoConsolidado.registrosOriginais || [])
                    .find(r => r.categoria_item === 'statusvagaexcedida' || r.categoria_item === 'statusaditivoextra');
                
                if (primeiroAditivo) {
                    const arr = safeParse(primeiroAditivo[CAMPO_ADITIVO_EXTRA] || '[]');
                    chaveRenderizacao = arr[0]?.tipoSolicitacao || 'SOLICITAÇÃO DE FUNÇÃO';
                } else {
                    chaveRenderizacao = 'SOLICITAÇÃO DE FUNÇÃO';
                }
            }
        }

        if (!chaveRenderizacao) return; // <--- Se por algum motivo for null/undefined, ele dá 'return' e ignora o card todo!

        const registros = grupoConsolidado.registrosOriginais || [];
        const pedidosConsolidadosPorId = new Map();
        let temAlgumMatchNesteGrupo = false;

        registros.forEach(pedidoOriginal => {
            const categoriaItem = pedidoOriginal.categoria_item || "geral";
            
            // 🚨 CORREÇÃO V99.0: GERAÇÃO DE ID ÚNICO COMBINADO PARA EVITAR CONFLITOS
            let idLog = 'sem-id';
            if (pedidoOriginal.id_log) {
                idLog = `log-${pedidoOriginal.id_log}`;
            } else {
                const idBase = pedidoOriginal.idaditivoextra || pedidoOriginal.idpedido || pedidoOriginal.idsolicitacao || pedidoOriginal.id || 'vaga';
                idLog = `sol-${idBase}-${categoriaItem}`; 
            }

            let pedidoConsolidado = pedidosConsolidadosPorId.get(idLog);
            if (!pedidoConsolidado) {
                pedidoConsolidado = { 
                    ...pedidoOriginal, 
                    idpedido: idLog, 
                    temMatch: false,
                    camposEncontrados: new Set()
                };
                pedidosConsolidadosPorId.set(idLog, pedidoConsolidado);
            }
            
            // 💥 TRAVA DE CORTE RE-ALINHADA (Checa se este item específico mudou)
            const statusMaeReal = (pedidoOriginal.status_aprovacao || pedidoOriginal.status || '').toLowerCase().trim();
            if (statusMaeReal === 'autorizado' || statusMaeReal === 'rejeitado') {
                pedidoOriginal.status = statusMaeReal;
                pedidoOriginal.status_aprovacao = statusMaeReal;

                // 🔑 Só sobrescreve campos JSON se NÃO forem arrays de datas individuais
                const camposJson = ['statusaditivoextra', 'statusvagaexcedida', 'statusvagasreaproveitadas'];
                camposJson.forEach(c => {
                    const v = pedidoOriginal[c];
                    const isArr = Array.isArray(v) || (typeof v === 'string' && v.trim().startsWith('['));
                    if (!isArr) pedidoOriginal[c] = statusMaeReal;
                });

                if (pedidoOriginal.solicitacoes_individuais && Array.isArray(pedidoOriginal.solicitacoes_individuais)) {
                    pedidoOriginal.solicitacoes_individuais.forEach(s => s.status = statusMaeReal);
                }
            }

            // Caso especial: combo Extra Bonificado + Diária Dobrada — status controlado independente
            if (pedidoOriginal.isComboExtraDobrada) {
                const stBonif   = (pedidoOriginal.dadosBonificado?.status_aprovacao || 'pendente').toLowerCase();
                const stDobrada = (pedidoOriginal.dadosDobrada?.status_aprovacao    || 'pendente').toLowerCase();
                const ok = (statusDesejado === STATUS_PENDENTE_LOWER   && (stBonif === 'pendente'   || stDobrada === 'pendente'))
                        || (statusDesejado === STATUS_AUTORIZADO_LOWER && stBonif === 'autorizado' && stDobrada === 'autorizado')
                        || (statusDesejado === STATUS_REJEITADO_LOWER  && (stBonif === 'rejeitado'  || stDobrada === 'rejeitado'));
                if (ok) { pedidoConsolidado.temMatch = true; temAlgumMatchNesteGrupo = true; }
                return;
            }

            // Caso especial: combos FuncExcedido + Estouro Financeiro / FuncExcedido + Vaga
            // Excedida — status controlado por data (cada lado pode ter datas em status
            // diferentes, então olhamos as datas individuais em vez de um status único do
            // card inteiro). Os dois combos usam exatamente os mesmos campos
            // dadosAditivo/dadosFuncExcedido, só o flag de origem muda.
            if (pedidoOriginal.isComboFuncExcedidoAditivo || pedidoOriginal.isComboFuncExcedidoVaga) {
                const admSolsBucket = pedidoOriginal.dadosAditivo?.solicitacoes_individuais || [];
                const feSolsBucket  = pedidoOriginal.dadosFuncExcedido?.solicitacoes_individuais || [];
                const statusDaSol = (s) => (s.status || 'pendente').toLowerCase().trim();
                const algumaCom = (sols, st) => sols.some(s => statusDaSol(s) === st);
                const ok = (statusDesejado === STATUS_PENDENTE_LOWER   && (algumaCom(admSolsBucket, 'pendente')   || algumaCom(feSolsBucket, 'pendente')))
                        || (statusDesejado === STATUS_AUTORIZADO_LOWER && (algumaCom(admSolsBucket, 'autorizado') || algumaCom(feSolsBucket, 'autorizado')))
                        || (statusDesejado === STATUS_REJEITADO_LOWER  && (algumaCom(admSolsBucket, 'rejeitado')  || algumaCom(feSolsBucket, 'rejeitado')));
                if (ok) { pedidoConsolidado.temMatch = true; temAlgumMatchNesteGrupo = true; }
                return; // pula o processamento normal de campos
            }

            // Verifica status principal
            const statusPrincipal = (pedidoOriginal.statuspgto || pedidoOriginal.status_aprovacao || '').toLowerCase().trim();
            if (statusPrincipal === statusDesejado) {
                pedidoConsolidado.temMatch = true;
                pedidoConsolidado.renderizarComoPedidoPrincipal = true;
                temAlgumMatchNesteGrupo = true;
            }

            // Verifica sub-itens (Meia diária, caixinha, etc)
            // Verifica sub-itens (Meia diária, caixinha, etc)
            camposTodos.forEach(campo => {
                const itens = safeParse(pedidoOriginal[campo]).filter(it => it !== null && it !== undefined);

                // 🔑 Para campos com array de datas individuais, inclui o card se houver ao menos
                // uma data pendente e passa TODAS as datas para o render.
                const camposComDatas = [CAMPO_ADITIVO_EXTRA, 'statusaditivoextra', 'statusvagasreaproveitadas', 'statusvagaexcedida'];
                const isArrayDatas = camposComDatas.includes(campo)
                    && Array.isArray(itens) && itens.length > 0 && typeof itens[0] === 'object';

                if (isArrayDatas) {
                    if (statusDesejado === 'pendente') {
                        const temPendente = itens.some(it =>
                            (it.status || 'pendente').toLowerCase().trim() === 'pendente'
                        );
                        if (temPendente) {
                            pedidoConsolidado.temMatch = true;
                            pedidoConsolidado[campo] = itens; // todas as datas
                            temAlgumMatchNesteGrupo = true;
                        } else {
                            pedidoConsolidado[campo] = [];
                        }
                    } else {
                        const filtrados = itens.filter(it =>
                            (it.status || 'pendente').toLowerCase().trim() === statusDesejado
                        );
                        if (filtrados.length > 0) {
                            pedidoConsolidado.temMatch = true;
                            pedidoConsolidado[campo] = filtrados;
                            temAlgumMatchNesteGrupo = true;
                        } else {
                            pedidoConsolidado[campo] = [];
                        }
                    }
                    return;
                }

                // Campos com workflow de aprovação PRÓPRIO (Diária Dobrada, Meia Diária,
                // Caixinha, Ajuste de Custo, Custo Fechado, Cachê Liberado) não podem herdar
                // o status do pedido mãe — cada um é aprovado/rejeitado independentemente
                // (ex.: combo Extra Bonificado + Diária Dobrada trata os dois status à parte,
                // ver isComboExtraDobrada acima). Só os campos que o backend mantém em sincronia
                // com o mãe (camposJson, linha ~10615) devem usar o statusMaeReal como atalho.
                const camposSincronizadosComMae = ['statusaditivoextra', 'statusvagaexcedida', 'statusvagasreaproveitadas', CAMPO_ADITIVO_EXTRA];
                const itensFiltrados = itens.filter(it => {
                    if (camposSincronizadosComMae.includes(campo) && (statusMaeReal === 'autorizado' || statusMaeReal === 'rejeitado')) {
                        return statusMaeReal === statusDesejado;
                    }
                    const s = (typeof it === 'object' && it !== null) ? (it.status || 'pendente') : it;
                    return String(s).toLowerCase().trim() === statusDesejado;
                });

                if (itensFiltrados.length > 0) {
                    pedidoConsolidado.temMatch = true;
                    pedidoConsolidado[campo] = itensFiltrados; 
                    temAlgumMatchNesteGrupo = true;
                } else {
                    pedidoConsolidado[campo] = [];
                }
            });
        });

        if (temAlgumMatchNesteGrupo) {
            const registrosValidos = Array.from(pedidosConsolidadosPorId.values()).filter(p => p.temMatch);
            if (registrosValidos.length > 0) {
                gruposFiltrados.push({
                    ...grupoConsolidado,
                    registrosOriginais: registrosValidos
                });
            }
        }
    });

    if (gruposFiltrados.length === 0) {
        const msg = document.createElement("p");
        msg.textContent = `Não há pedidos com status "${statusDesejado}".`;
        container.appendChild(msg);
        
        if (typeof atualizarBadgeDeStatus === 'function') {
             atualizarBadgeDeStatus(statusDesejado, 0, categoria);
        }
        return;
    }

    // --- 2. RENDERIZAÇÃO ---
    const listaGrupos = document.createElement("div");
    listaGrupos.className = "lista-funcionarios";
    container.appendChild(listaGrupos);

    gruposFiltrados.forEach(grupo => {
        // CORRIGIDO: alterado de 'group' para 'grupo'
        const pedidosDoGrupo = grupo.registrosOriginais;
        if (!pedidosDoGrupo?.length) return;

        const chaveNome = categoria === 'funcionario'
            ? grupo.funcionario
            : (grupo.nmfuncao || pedidosDoGrupo[0]?.descFuncao || 'SOLICITAÇÃO DE FUNÇÃO');

        const p = pedidosDoGrupo[0];
        // Sempre o solicitante da requisição mais recente do grupo (não a primeira do array) —
        // um mesmo funcionário/idfuncionario pode acumular pedidos de solicitantes diferentes.
        const ultimoPedidoDoGrupo = pedidosDoGrupo.reduce((maisRecente, atual) => {
            const dataAtual = new Date(atual.dtCriacao || atual.criado_em || 0).getTime();
            const dataMaisRecente = new Date(maisRecente.dtCriacao || maisRecente.criado_em || 0).getTime();
            return dataAtual > dataMaisRecente ? atual : maisRecente;
        }, p);
        const solicitantesGrupo = ultimoPedidoDoGrupo.nomesolicitante || ultimoPedidoDoGrupo.nomeSolicitante
            || ultimoPedidoDoGrupo.solicitante_nome || ultimoPedidoDoGrupo.funcionario || "N/D";

        const divGrupo = document.createElement("div");
        divGrupo.className = "funcionario";

        const header = document.createElement("div");
        header.className = "funcionario-header";
        header.innerHTML = `<strong>${chaveNome}</strong> <span class="text-sm text-gray-500">(Solicitado por: ${solicitantesGrupo})</span>`;
        divGrupo.appendChild(header);

        const body = document.createElement("div");
        body.className = "funcionario-body hidden";

        let htmlBody = '';
        let itensGrupo = 0;

        pedidosDoGrupo.forEach(pedido => {
            // ─── Combo Extra Bonificado + Diária Dobrada ──────────────────
            if (pedido.isComboExtraDobrada) {
                itensGrupo++;
                totalItensRenderizados++;
                htmlBody += cardBonificadoDiariaDobrada(pedido, statusDesejado, podeAprovar);
                return;
            }
            // ─── Combo FuncExcedido + Estouro Financeiro ─────────────────
            if (pedido.isComboFuncExcedidoAditivo) {
                itensGrupo++;
                totalItensRenderizados++;
                htmlBody += cardFuncaoExcedidaAditivo(pedido, statusDesejado, podeAprovar);
                return;
            }
            // ─── Combo FuncExcedido + Vaga Excedida ───────────────────────
            if (pedido.isComboFuncExcedidoVaga) {
                itensGrupo++;
                totalItensRenderizados++;
                htmlBody += cardFuncaoExcedidaVagaExcedida(pedido, statusDesejado, podeAprovar);
                return;
            }
            // ─────────────────────────────────────────────────────────────

            const solicitacoesIndividuais = pedido.solicitacoes_individuais || [];
            const temIndividuais = solicitacoesIndividuais.length > 0;

            camposRenderizaveis.forEach(campo => {
                const itensFiltrados = pedido[campo];
                if (!itensFiltrados || (Array.isArray(itensFiltrados) && itensFiltrados.length === 0)) return;

                const itensParaRenderizar = Array.isArray(itensFiltrados) ? itensFiltrados : [itensFiltrados];

                itensParaRenderizar.forEach(infoItem => {
                    let htmlBodyAditivoAgrupado = '';
                    let vlrSolBadge = 0; // valor que impacta o saldo — preenchido por tipo de card
                    if (campo === 'pedido_principal' && !pedido.renderizarComoPedidoPrincipal) return;
                    
                    itensGrupo++;
                    totalItensRenderizados++; 

                    const statusTexto = (infoItem.status || statusDesejado).charAt(0).toUpperCase() + (infoItem.status || statusDesejado).slice(1);
                    const statusLower = (infoItem.status || statusDesejado).toLowerCase();
                    let corQuadrado = statusLower === STATUS_AUTORIZADO_LOWER ? "#16a34a" : statusLower === STATUS_REJEITADO_LOWER ? "#dc2626" : "#facc15";

                    let tituloCard;
                    const isAditivoExtra = campo === CAMPO_ADITIVO_EXTRA || campo === 'statusvagaexcedida' || campo === 'aditivoextra' || campo === 'statusaditivoextra';
                    const isDataUnica = campo === "statusmeiadiaria" || campo === "statusdiariadobrada";
                    const isPedidoPrincipal = campo === 'pedido_principal';  

                    if (isPedidoPrincipal) {
                        tituloCard = pedido.tipoSolicitacaoGeral || 'Solicitação Principal'; 
                        if (pedido.dataPrincipal) {
                            tituloCard += ` (${pedido.dataPrincipal})`;
                        } else if (pedido.valorPrincipal !== undefined && typeof pedido.valorPrincipal === 'number') {
                            const valorFmt = pedido.valorPrincipal.toFixed(2).replace('.', ',');
                            tituloCard += ` (R$ ${valorFmt})`;                            
                        }
                    } else if (isAditivoExtra) {
                        const tipo = (infoItem.tipoSolicitacao || '').toUpperCase();
                        if (tipo.includes('REAPROVEITADA') || tipo.includes('OUTRA FUNÇÃO') || tipo.includes('OUTRA FUNCAO')) {
                            const ehOutraFuncao = tipo.includes('OUTRA');
                            tituloCard = ehOutraFuncao
                                ? "Vaga Reaproveitada - Diária de Outra Função e Datas fora do Orçamento"
                                : "Vaga Reaproveitada - Diária de Outra Função";
                        } else if (tipo.includes('BONIFICADO') && tipo.includes('VAGA EXCEDIDA')) {
                            tituloCard = "Extra Bonificado - Vaga Excedida";
                        } else if (tipo === 'FUNCEXCEDIDO') {
                            tituloCard = "Funcionário Excedido";
                        } else if (tipo.includes('VAGA') && !tipo.includes('REAPROVEITADA')) {
                            tituloCard = "Aditivo - Vaga Excedida";
                        } else if (tipo.includes('ORÇAMENTO') || tipo.includes('ORCAMENTO') || tipo.includes('FORA')) {
                            tituloCard = "Aditivo - Datas fora do Orçamento";
                        } else if (tipo.includes('EXTRA') || tipo.includes('BONIFICADO')) {
                            tituloCard = "Extra Bonificado";
                        } else {
                            tituloCard = infoItem.tipoSolicitacao || "Aditivo/Extra";
                        }

                        if (statusDesejado === STATUS_PENDENTE_LOWER && podeAprovar) {
                            const idsLote = temIndividuais ? solicitacoesIndividuais.map(s => s.idsolicitacao).join(',') : String(pedido.id_log);
                            const totalDatas = temIndividuais ? solicitacoesIndividuais.length : 1;
                            const temDetalhesReap = tituloCard.includes('Reaproveitada') &&
                                Array.isArray(pedido.vagasReaproveitadasDetalhes) &&
                                pedido.vagasReaproveitadasDetalhes.length > 0;

                            // Colunas alinhadas: data(105px) | função(flex:1) | cachê executado(110px) | botões(80px)
                            const headerHtml = temDetalhesReap
                                ? `<div style="background:var(--surface-3);padding:5px 10px;font-size:11px;border-bottom:1px solid #eee;display:flex;align-items:center;">
                                       <strong style="flex:0 0 105px;">DETALHAMENTO</strong>
                                       <span style="flex:1;font-size:10px;color:var(--text-2);font-weight:600;">FUNÇÃO / CACHÊ REAPROVEITADO</span>
                                       <span style="flex:0 0 110px;font-size:10px;color:var(--text-2);font-weight:600;text-align:right;">CACHÊ EXECUTADO</span>
                                       <span style="flex:0 0 80px;font-size:10px;color:var(--text-2);text-align:right;">${totalDatas} data(s)</span>
                                   </div>`
                                : `<div style="background:var(--surface-3);padding:5px 10px;font-size:11px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;">
                                       <strong>DETALHAMENTO POR DATA</strong>
                                       <span style="color:var(--text-2);">${totalDatas} data(s)</span>
                                   </div>`;
                            const rowFlexStyle  = temDetalhesReap ? 'display:flex;align-items:center;' : 'display:flex;justify-content:space-between;align-items:center;';
                            const dateSpanStyle = temDetalhesReap ? 'flex:0 0 105px;font-size:13px;' : 'font-size:13px;';
                            const btnsStyle     = temDetalhesReap ? 'flex:0 0 80px;display:flex;gap:6px;justify-content:flex-end;' : 'display:flex;gap:6px;';

                            htmlBodyAditivoAgrupado = `
                                <div style="margin:8px 0;">
                                    <div style="display:flex;gap:8px;margin-bottom:8px;">
                                        <button class="aprovar-lote-aditivo" data-ids="${idsLote}" data-logid="${pedido.id_log}" style="background:#16a34a;color:var(--on-brand);border:none;border-radius:4px;padding:5px 12px;cursor:pointer;font-size:12px;font-weight:bold;">
                                            ✅ Autorizar Todas (${totalDatas})
                                        </button>
                                        <button class="rejeitar-lote-aditivo" data-ids="${idsLote}" data-logid="${pedido.id_log}" style="background:#dc2626;color:var(--on-brand);border:none;border-radius:4px;padding:5px 12px;cursor:pointer;font-size:12px;font-weight:bold;">
                                            ❌ Rejeitar Todas (${totalDatas})
                                        </button>
                                    </div>
                                    <div class="lista-datas-aditivo" style="border:1px solid #eee;border-radius:4px;overflow:hidden;">
                                        ${headerHtml}
                            `;

                            if (temIndividuais) {
                                let categoriaCard = "statusaditivoextra";
                                if (tituloCard.includes("Vaga Excedida")) {
                                    categoriaCard = "statusvagaexcedida";
                                } else if (tituloCard.includes("Reaproveitada")) {
                                    categoriaCard = "statusvagasreaproveitadas";
                                }

                                solicitacoesIndividuais.forEach((sol, idx) => {
                                    let datasRaw = sol.data;
                                    if (typeof datasRaw === 'string') {
                                        datasRaw = datasRaw.replace(/[{}]/g, '').split(',');
                                    }

                                    const dataBrutaOriginal = Array.isArray(datasRaw) ? datasRaw[0] : datasRaw;
                                    const dataLimpaParaAtributo = String(dataBrutaOriginal || '').trim();

                                    const datasFormatadas = (Array.isArray(datasRaw) ? datasRaw : [datasRaw])
                                        .map(d => {
                                            const dt = String(d).trim();
                                            return dt.includes('-') ? dt.split('-').reverse().join('/') : dt;
                                        }).join(', ');

                                    const isLast = idx === solicitacoesIndividuais.length - 1;

                                    const solStatus = (sol.status || 'pendente').toLowerCase();
                                    const solJaResolvida = solStatus === 'autorizado' || solStatus === 'rejeitado';
                                    const corStatus = solStatus === 'autorizado' ? '#16a34a' : solStatus === 'rejeitado' ? '#dc2626' : '#facc15';
                                    const labelStatus = solStatus.charAt(0).toUpperCase() + solStatus.slice(1);

                                    // Para REAPROVEITADA: busca detalhe da função + custo por data (colunas alinhadas com header)
                                    let detalheColHtml = '';
                                    if (temDetalhesReap) {
                                        const dataKey = String(dataBrutaOriginal || '').trim().substring(0, 10);
                                        const dv = pedido.vagasReaproveitadasDetalhes.find(v =>
                                            String(v.data || '').substring(0, 10) === dataKey
                                        );
                                        if (dv) {
                                            const fmt2 = v => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                                            const vlrCache   = dv.vlr_cache_executado || 0;
                                            const vlrOrigem  = dv.vlr_cache_origem || 0;
                                            // null = campo não existia no JSON (registro antigo) → usa valor do staffevento
                                            const vlrAlim  = dv.vlralimentacao !== null ? (dv.vlralimentacao || 0) : (pedido.vlrAlimSol || 0);
                                            const ehDobrada = (dv.setor_origem || '').toUpperCase().includes('DOBRADA');
                                            const vlrTransp = ehDobrada ? 0 : (dv.vlrtransporte !== null ? (dv.vlrtransporte || 0) : (pedido.vlrTranspSol || 0));
                                            const origemTxt = vlrOrigem > 0 ? ` <span style="color:var(--text-2);font-size:11px;">(R$ ${fmt2(vlrOrigem)})</span>` : '';
                                            const adicParts = [];
                                            if (vlrAlim  > 0) adicParts.push(`Alim: R$${fmt2(vlrAlim)}`);
                                            if (vlrTransp > 0) adicParts.push(`Transp: R$${fmt2(vlrTransp)}`);
                                            const adicHtml = adicParts.length > 0
                                                ? `<div style="font-size:10px;color:var(--text-2);margin-top:1px;">${adicParts.join(' · ')}</div>`
                                                : '';
                                            detalheColHtml = `
                                                <span style="flex:1;font-size:12px;color:var(--text-1);overflow:hidden;min-width:0;">
                                                    <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${dv.nmfuncao_origem}${origemTxt}</div>
                                                    ${adicHtml}
                                                </span>
                                                <span style="flex:0 0 110px;font-size:12px;color:var(--text-1);text-align:right;white-space:nowrap;">R$ ${fmt2(vlrCache)}</span>
                                            `;
                                        } else {
                                            detalheColHtml = `<span style="flex:1;"></span><span style="flex:0 0 110px;"></span>`;
                                        }
                                    }

                                    htmlBodyAditivoAgrupado += `
                                        <div class="linha-data-aditivo" data-idsolicitacao="${sol.idsolicitacao}" data-status="${solStatus}" style="${rowFlexStyle} padding:6px 10px; border-bottom:${isLast ? 'none' : '1px solid #eee'}; transition:opacity 0.3s;">
                                            <span style="${dateSpanStyle}">📅 ${datasFormatadas}</span>
                                            ${detalheColHtml}
                                            <div style="${btnsStyle}">
                                                ${solJaResolvida
                                                    ? `<span style="font-size:12px;font-weight:bold;color:${corStatus};border:1px solid ${corStatus};border-radius:3px;padding:2px 8px;">${labelStatus}</span>`
                                                    : `<button class="aprovar-individual-aditivo" data-id="${sol.idsolicitacao}" data-logid="${pedido.id_log}" data-data="${dataLimpaParaAtributo}" data-categoria="${categoriaCard}" style="background:none;border:1px solid #16a34a;border-radius:3px; cursor:pointer;font-size:13px;padding:2px 6px;" title="Autorizar apenas esta data">✅</button>
                                                    <button class="rejeitar-individual-aditivo" data-id="${sol.idsolicitacao}" data-logid="${pedido.id_log}" data-data="${dataLimpaParaAtributo}" data-categoria="${categoriaCard}" style="background:none;border:1px solid #dc2626;border-radius:3px; cursor:pointer;font-size:13px;padding:2px 6px;" title="Rejeitar apenas esta data">❌</button>`
                                                }
                                            </div>
                                        </div>
                                    `;
                                });
                            }
                            htmlBodyAditivoAgrupado += `</div></div>`;
                        }
                    } else {
                        const categoriaParaFormatar = infoItem.categoria || campo;
                        const categoriaDoBanco = pedido.categoria;
                        const tipoSolItem = infoItem.tiposolicitacao || '';
                        if (tipoSolItem === 'Dobrada - Estouro Financeiro') {
                            tituloCard = 'Dobrada - Estouro Financeiro';
                        } else {
                            tituloCard = formatarNomeSolicitacao(categoriaParaFormatar, categoriaDoBanco);
                        }

                        if (isDataUnica) {
                            const dataBruta = String(infoItem.data || '').trim();
                            let dataFmt = '';
                            if (dataBruta !== '') {
                                const dataObj = parseDateLocal(dataBruta);
                                dataFmt = dataObj?.toLocaleDateString('pt-BR') || '';
                            }
                            if (dataFmt) tituloCard += ` (${dataFmt})`;
                        } else if (campo.includes('custo') || campo.includes('caixinha')) {
                            const valor = parseFloat(infoItem.valor) || 0;
                            if (valor !== 0) {
                                const valorFmt = valor.toFixed(2).replace('.', ',');
                                tituloCard += ` (R$ ${valorFmt})`;
                            }
                        } else if (campo === 'statusvagasreaproveitadas') {
                            if (Array.isArray(pedido.vagasReaproveitadasDetalhes) && pedido.vagasReaproveitadasDetalhes.length > 0) {
                                vlrSolBadge = pedido.vagasReaproveitadasDetalhes.reduce((sum, v) => {
                                    const ehDob  = (v.setor_origem || '').toUpperCase().includes('DOBRADA');
                                    const vAlim  = v.vlralimentacao !== null ? (v.vlralimentacao || 0) : (pedido.vlrAlimSol || 0);
                                    const vTransp = ehDob ? 0 : (v.vlrtransporte !== null ? (v.vlrtransporte || 0) : (pedido.vlrTranspSol || 0));
                                    return sum + (v.vlr_cache_executado || 0) + vAlim + vTransp;
                                }, 0);
                            } else if (pedido.vlrCacheSol > 0) {
                                const numDatas = solicitacoesIndividuais.length || 1;
                                vlrSolBadge = (pedido.vlrCacheSol + pedido.vlrAlimSol + pedido.vlrTranspSol) * numDatas;
                            }
                        }
                    }

                    // --- Formatação das datas de Log/Solicitação ---
                    let dataQfezSolicitacaoFormatada = '';
                    const dataRawLog = pedido.dataSolicitacao || pedido.dtCriacao;
                    if (dataRawLog) {
                        const dataObj = new Date(dataRawLog);
                        if (!isNaN(dataObj.getTime())) {
                            dataQfezSolicitacaoFormatada = dataObj.toLocaleDateString('pt-BR');
                        } else {
                            dataQfezSolicitacaoFormatada = dataRawLog;
                        }
                    } else {
                        dataQfezSolicitacaoFormatada = 'Data indefinida';
                    }

                    let dataFormatadaSolictacao = '';
                    if (pedido.dtsolicitada) {
                        let datasParaExibir = [];
                        if (Array.isArray(pedido.dtsolicitada) && pedido.dtsolicitada.length > 0 && typeof pedido.dtsolicitada[0] === 'object' && pedido.dtsolicitada[0].data) {
                            datasParaExibir = Array.isArray(pedido.dtsolicitada[0].data) ? pedido.dtsolicitada[0].data : [pedido.dtsolicitada[0].data];
                        } else if (Array.isArray(pedido.dtsolicitada)) {
                            datasParaExibir = pedido.dtsolicitada;
                        } else {
                            datasParaExibir = pedido.dtsolicitada.toString().split(',');
                        }

                        const datasMapeadas = datasParaExibir.map(item => {
                            if (!item) return '';
                            const dataLimpa = String(item).trim();
                            const dataObj = new Date(dataLimpa + 'T12:00:00');
                            if (!isNaN(dataObj.getTime())) {
                                return dataObj.toLocaleDateString('pt-BR');
                            }
                            return item;
                        });
                        dataFormatadaSolictacao = datasMapeadas.join(', ');
                    }

                    let dataEventoFormatada = '';
                    if (pedido.datasevento) {
                        const listaDatas = Array.isArray(pedido.datasevento) ? pedido.datasevento : pedido.datasevento.split(',');
                        const datasMapeadas = listaDatas.map(dStr => {
                            const d = new Date(dStr.trim() + 'T12:00:00');
                            return !isNaN(d) ? d.toLocaleDateString('pt-BR') : dStr;
                        });
                        dataEventoFormatada = datasMapeadas.join(', ');
                    }

                    const nomeSolic = pedido.nomeSolicitante || "N/D";
                    const nomeFuncionarioExibir = pedido.funcionario || pedido.nomefuncionario || null;
                    const aprovadorTxt = (statusLower !== STATUS_PENDENTE_LOWER && pedido.nomeAprovador) ? ` por <strong>${pedido.nomeAprovador}</strong> em <strong> ${dataQfezSolicitacaoFormatada}</strong>` : '';

                    // Montagem estruturada do HTML do Card
                    htmlBody += `
                        <div class="pedido-card">
                            <div class="infoPedido">
                                <div class="title">
                                    <span style="display:inline-block; width:12px; height:12px; background-color:${corQuadrado}; margin-right:6px; border-radius:2px;"></span>
                                    <strong>${tituloCard}</strong> - Solicitado em: <strong>${dataQfezSolicitacaoFormatada}</strong> por <strong>${nomeSolic}</strong>
                                </div>
                                <br>
                    `;

                    if (pedido.evento) {
                        if (categoria === 'funcionario') {
                            const funcaoPrincipal = pedido.descFuncaoOriginal || pedido.descFuncao || '';
                            const funcaoAtualTxt = funcaoPrincipal ? ` <span class="text-xs text-gray-500 font-normal">(${funcaoPrincipal})</span>` : '';
                            htmlBody += `
                                <div class="event-info">
                                    <strong>Evento:</strong> ${pedido.evento} - <strong>Funcionário:</strong> ${nomeFuncionarioExibir} ${funcaoAtualTxt}<br>
                                    <strong>Datas Contratadas:</strong> ${dataEventoFormatada}
                                </div><br>
                            `;
                        } else {
                            const isReaproveitada = tituloCard.includes('Reaproveitada');
                            const isBonificadoOuAditivo = tituloCard.includes('Bonificado') || tituloCard.includes('Aditivo');
                            let funcOrigemDestino = '';
                            if (isReaproveitada) {
                                // Função contratada do funcionário no evento (vem do staffevento idfuncao)
                                const funcAtual = pedido.descFuncaoOriginal || pedido.descFuncao || '';
                                if (funcAtual) {
                                    funcOrigemDestino += ` - <strong>Função:</strong> ${funcAtual}`;
                                }
                                // Função de origem cujas vagas estão sendo reaproveitadas (vem do JSON vagasreaproveitadas)
                                const detalhes = pedido.vagasReaproveitadasDetalhes;
                                if (Array.isArray(detalhes) && detalhes.length > 0) {
                                    const funcoesUnicas = [...new Set(detalhes.map(v => v.nmfuncao_origem).filter(Boolean))];
                                    if (funcoesUnicas.length > 0) {
                                        funcOrigemDestino += `<br><strong>Aproveitando vagas da Função:</strong> ${funcoesUnicas.join(', ')}`;
                                    }
                                } else if (pedido.nmfuncaoOrigem) {
                                    funcOrigemDestino += `<br><strong>Aproveitando vagas da Função:</strong> ${pedido.nmfuncaoOrigem}`;
                                }
                            } else if (isBonificadoOuAditivo) {
                                const detalhes = pedido.vagasReaproveitadasDetalhes;
                                if (Array.isArray(detalhes) && detalhes.length > 0) {
                                    const funcoesUnicas = [...new Set(detalhes.map(v => v.nmfuncao_origem).filter(Boolean))];
                                    if (funcoesUnicas.length > 0) {
                                        funcOrigemDestino = `<br><strong>Função:</strong> ${funcoesUnicas.join(', ')}`;
                                    }
                                } else if (pedido.nmfuncaoOrigem) {
                                    funcOrigemDestino = `<br><strong>Função:</strong> ${pedido.nmfuncaoOrigem}`;
                                } else if (pedido.descFuncaoOriginal || pedido.descFuncao) {
                                    funcOrigemDestino = `<br><strong>Função:</strong> ${pedido.descFuncaoOriginal || pedido.descFuncao}`;
                                }
                            }
                            htmlBody += `
                                <div class="event-info">
                                    <strong>Evento:</strong> ${pedido.evento} - <strong>Funcionário:</strong> ${nomeFuncionarioExibir}${funcOrigemDestino}
                                </div><br>
                            `;
                        }
                    }

                    if (isPedidoPrincipal) {
                        htmlBody += `Status do Pedido: <span class="status-text font-semibold"><strong>${statusTexto}</strong></span><br>`;
                    } else if (isAditivoExtra) {
                        const tipoUpper = (infoItem.tipoSolicitacao || '').toUpperCase();
                        if ((tipoUpper.includes('VAGA EXCEDIDA') || tipoUpper.includes('FUNCEXCEDIDO')) && !tipoUpper.includes('BONIFICADO')) {
                            let todasAsDatas = '';
                            if (solicitacoesIndividuais.length > 0) {
                                const solsFiltradas = solicitacoesIndividuais.filter(sol => (sol.status || '').toLowerCase().trim() === statusDesejado);
                                const solsParaExibir = solsFiltradas.length > 0 ? solsFiltradas : solicitacoesIndividuais;
                                todasAsDatas = solsParaExibir.map(sol => {
                                    let datasRaw = sol.data;
                                    if (typeof datasRaw === 'string') {
                                        datasRaw = datasRaw.replace(/[{}]/g, '').split(',');
                                    }
                                    return (Array.isArray(datasRaw) ? datasRaw : [datasRaw])
                                        .map(d => String(d).trim().split('-').reverse().join('/'))
                                        .join(', ');
                                }).join(', ');
                            } else {
                                todasAsDatas = dataFormatadaSolictacao;
                            }
                            const justifFex = pedido.justificativaSolicitacao || infoItem.descricao || '';
                            if (justifFex) {
                                htmlBody += `<strong>Justificativa:</strong> ${justifFex}<br>`;
                            }
                            if (tipoUpper === 'FUNCEXCEDIDO') {
                                // O evento/função no topo do card já é o "Sendo Solicitado" (o próprio
                                // registro pendente) — mostrar de novo aqui como "Função Solicitada" é
                                // redundante (mesmo campo) e nunca revela contra o que ele excede.
                                // Aqui mostramos o outro lado: onde ele JÁ está contratado.
                                const conflito = pedido.conflitoJaContratado;
                                if (conflito && (conflito.evento || conflito.funcao)) {
                                    htmlBody += `<strong>⚠️ Já contratado em:</strong> ${conflito.evento || 'evento não identificado'} - ${conflito.funcao || 'função não identificada'}<br>`;
                                }
                            }
                            htmlBody += `<strong> Excedido no(s) dia(s):</strong> ${todasAsDatas} - `;
                        } else if (tipoUpper.includes('REAPROVEITADA') || tipoUpper.includes('OUTRA FUNÇÃO') || tipoUpper.includes('OUTRA FUNCAO')) {
                            const justif = pedido.justificativaSolicitacao || infoItem.descricao || '';
                            if (justif) {
                                htmlBody += `<strong>Justificativa:</strong> ${justif}<br>`;
                            }
                        } else if (tipoUpper.includes('LIMITE FINANCEIRO')) {
                            const totalDatasLimFin = solicitacoesIndividuais.length || 1;
                            const justifLimFin = pedido.justificativaSolicitacao || infoItem.descricao || '';
                            if (justifLimFin) {
                                htmlBody += `<strong>Justificativa:</strong> ${justifLimFin}<br>`;
                            }
                            const cacheLimFin  = parseFloat(infoItem.valor) || 0;
                            const ajdDiaLimFin = (parseFloat(infoItem.vlralimentacao) || 0) + (parseFloat(infoItem.vlrtransporte) || 0);
                            const totalExcedido = cacheLimFin + (ajdDiaLimFin * totalDatasLimFin);
                            const custoLimFinFmt = totalExcedido > 0 ? `, excedido em R$ ${totalExcedido.toFixed(2).replace('.', ',')}` : '';
                            htmlBody += `<strong> Limite financeiro excedido:</strong> ${totalDatasLimFin} data(s) solicitada(s)${custoLimFinFmt} - `;
                        } else if (tipoUpper.includes('BONIFICADO')) {
                            const totalDatasBon = solicitacoesIndividuais.length || 1;
                            const justifBon = pedido.justificativaSolicitacao || infoItem.descricao || '';
                            if (justifBon) {
                                htmlBody += `<strong>Justificativa:</strong> ${justifBon}<br>`;
                            }
                            const cacheBon    = parseFloat(infoItem.valor) || 0;
                            const ajdDiaBon   = (parseFloat(infoItem.vlralimentacao) || 0) + (parseFloat(infoItem.vlrtransporte) || 0);
                            const custoBonTotal = cacheBon + (ajdDiaBon * totalDatasBon);
                            const custoBonFmt = custoBonTotal > 0 ? `R$ ${custoBonTotal.toFixed(2).replace('.', ',')}` : '—';
                            htmlBody += `<strong> Data(s) bonificada(s):</strong> ${totalDatasBon} dia(s) — <strong>Custo da bonificação:</strong> ${custoBonFmt} <span style="color:#b45309;font-size:11px;">(pago pela empresa)</span> - `;
                            vlrSolBadge = custoBonTotal;
                        } else {
                            htmlBody += `<strong> Data(s) fora do Orçamento:</strong> ${dataFormatadaSolictacao} - `;
                        }

                        htmlBody += `Status: <span class="status-text font-semibold"><strong>${statusTexto}</strong></span>${aprovadorTxt}<br>`;
                        // Para tipos sem custo explícito: fallback vlrcache × numDatas ou soma do JSON (apenas pendentes)
                        if (vlrSolBadge === 0) {
                            if (Array.isArray(pedido.vagasReaproveitadasDetalhes) && pedido.vagasReaproveitadasDetalhes.length > 0) {
                                vlrSolBadge = pedido.vagasReaproveitadasDetalhes.reduce((sum, v) => {
                                    const ehDob  = (v.setor_origem || '').toUpperCase().includes('DOBRADA');
                                    const vAlim  = v.vlralimentacao !== null ? (v.vlralimentacao || 0) : (pedido.vlrAlimSol || 0);
                                    const vTransp = ehDob ? 0 : (v.vlrtransporte !== null ? (v.vlrtransporte || 0) : (pedido.vlrTranspSol || 0));
                                    return sum + (v.vlr_cache_executado || 0) + vAlim + vTransp;
                                }, 0);
                            } else if (pedido.vlrCacheSol > 0) {
                                const numDatas = solicitacoesIndividuais.length || 1;
                                vlrSolBadge = (pedido.vlrCacheSol + pedido.vlrAlimSol + pedido.vlrTranspSol) * numDatas;
                            }
                        }
                        // Bonificado/Aditivo: staffevento fica ativo=false até inclusão no orçamento.
                        // Ao incluir, TODO o custo do staffevento (datasevento inteiro) entra no gasto de uma vez.
                        // → badge usa custo total do staffevento: cache + alim + transp do staff × total de datas
                        const ehBonificadoOuAditivo = tituloCard.includes('Bonificado') || tituloCard.includes('Aditivo');
                        const datasAll = (() => {
                            try {
                                const raw = pedido.datasevento;
                                if (!raw || raw === '-') return solicitacoesIndividuais.length || 1;
                                const arr = Array.isArray(raw) ? raw : JSON.parse(raw);
                                return Array.isArray(arr) && arr.length > 0 ? arr.length : (solicitacoesIndividuais.length || 1);
                            } catch(e) { return solicitacoesIndividuais.length || 1; }
                        })();
                        if (ehBonificadoOuAditivo) {
                            vlrSolBadge = (pedido.vlrCacheSol + pedido.vlrAlimSol + pedido.vlrTranspSol) * datasAll;
                        }
                        // Badge antes dos botões Autorizar Todas/Rejeitar Todas (card com múltiplas datas)
                        if (window.ehMasterOuSupremo && pedido.vlrOrcadoEquipe > 0 && vlrSolBadge > 0 && htmlBodyAditivoAgrupado) {
                            const orcado = pedido.vlrOrcadoEquipe, gasto = pedido.vlrGastoEquipe || 0, pendente = pedido.vlrPendenteEquipe || 0;
                            const saldoAtual = orcado - gasto, saldoApos = saldoAtual - vlrSolBadge, outrasPendentes = pendente - vlrSolBadge;
                            const fmt = v => { const p = Math.abs(v).toFixed(2).split('.'); p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.'); return 'R$ ' + p.join(','); };
                            const corSaldo = saldoApos < 0 ? '#dc2626' : '#16a34a', aviso = saldoApos < 0 ? ' ⚠️ Estoura o limite' : '';
                            const saldoAtualFmt = saldoAtual < 0
                                ? `<span style="color:#dc2626;font-weight:bold;">-${fmt(saldoAtual)} ⚠️ Já estourado</span>`
                                : fmt(saldoAtual);
                            // Previsionado inicial: desconta datas já rejeitadas antes do render
                            const vlrDia = pedido.vlrCacheSol + pedido.vlrAlimSol + pedido.vlrTranspSol;
                            const rejeitadasIni = solicitacoesIndividuais.filter(s => (s.status || '').toLowerCase() === 'rejeitado').length;
                            const previsionadoIni = saldoAtual - vlrDia * (datasAll - rejeitadasIni);
                            const corPrev = previsionadoIni < 0 ? '#dc2626' : '#16a34a';
                            htmlBody += `<div class="badge-financeiro-aditivo" data-saldo-atual="${saldoAtual}" data-vlr-dia="${vlrDia}" data-datas-all="${datasAll}" style="margin:4px 0 6px;padding:5px 10px;background:var(--surface-3);border-left:3px solid #6366f1;border-radius:3px;font-size:12.5px;color:var(--text-1);">💰 <strong>Custo Orçado:</strong> ${fmt(orcado)} &nbsp;|&nbsp;<strong>Saldo atual:</strong> ${saldoAtualFmt} &nbsp;|&nbsp;<strong>Saldo Após autorizar todos e incluir no orçamento:</strong> <span style="color:${corSaldo};font-weight:bold;">${saldoApos < 0 ? '-' : ''}${fmt(saldoApos)}${aviso}</span> &nbsp;|&nbsp;<strong>Saldo previsionado conforme decisão:</strong> <span class="saldo-previsionado-value" style="color:${corPrev};font-weight:bold;">${previsionadoIni < 0 ? '-' : ''}${fmt(previsionadoIni)}</span></div>`;
                            if (outrasPendentes > 0) {
                                const saldoEfetivo = saldoApos - outrasPendentes, corEfetivo = saldoEfetivo < 0 ? '#dc2626' : '#92400e';
                                htmlBody += `<div style="margin:0 0 6px;padding:3px 10px;background:#fffbeb;border-left:3px solid #f59e0b;border-radius:3px;font-size:11.5px;color:#78350f;">📋 Há outras ${fmt(outrasPendentes)} em sol. pendentes — saldo efetivo: <span style="color:${corEfetivo};font-weight:bold;">${saldoEfetivo < 0 ? '-' : ''}${fmt(saldoEfetivo)}</span>${saldoEfetivo < 0 ? ' — aguardar aprovações ou solicitar Aditivo' : ''}</div>`;
                            }
                            vlrSolBadge = 0; // evita renderizar novamente no bloco abaixo
                        }
                        htmlBody += htmlBodyAditivoAgrupado;
                    } else if (campo.includes('custo') || campo.includes('caixinha')) {
                        const valor = parseFloat(infoItem.valor) || 0;
                        const valorAliment = parseFloat(infoItem.vlralimentacao) || 0;
                        const valorTransp = parseFloat(infoItem.vlrtransporte) || 0;
                        const ehCustoFechado = pedido.categoria === 'statuscustofechado' || pedido.categoria === 'statuscacheliberado';
                        // Cachê Fechado/Liberado pode ser solicitado com cachê zerado (só alimentação/transporte),
                        // então aqui não basta olhar o "valor" (que é o cachê) — precisa checar os adicionais também.
                        if (valor !== 0 || (ehCustoFechado && (valorAliment !== 0 || valorTransp !== 0))) {
                            const valorFmt = valor.toFixed(2).replace('.', ',');
                            if (ehCustoFechado) {
                                const valorAlimentFmt = valorAliment.toFixed(2).replace('.', ',');
                                const valorTranspFmt = valorTransp.toFixed(2).replace('.', ',');
                                htmlBody += `<strong>Valor Cachê:</strong> R$ ${valorFmt} - <strong>Valor Alimentação:</strong> R$ ${valorAlimentFmt} - <strong>Valor Transporte:</strong> R$ ${valorTranspFmt} - <span class="status-text font-semibold"><strong>${statusTexto}</strong></span>${aprovadorTxt}<br>`;
                            } else {
                                htmlBody += `<strong>Valor:</strong> R$ ${valorFmt} - <span class="status-text font-semibold"><strong>${statusTexto}</strong></span>${aprovadorTxt}<br>`;
                            }
                            // Ajuste de custo e Caixinha positivos impactam o saldo da equipe (exibição informativa)
                            if ((campo === 'statusajustecusto' || campo === 'statuscaixinha') && valor > 0) vlrSolBadge = valor;
                        } else {
                            htmlBody += `Status: <span class="status-text font-semibold"><strong>${statusTexto}</strong></span>${aprovadorTxt}<br>`;
                        }
                        // Justificativa da Caixinha: vem por item (infoItem.descricao, mapeado de
                        // s.justificativa no backend) — faltava exibir, então o card nunca mostrava
                        // o motivo da solicitação.
                        if (campo === 'statuscaixinha') {
                            const justifCaixinha = infoItem.descricao || pedido.justificativaSolicitacao || '';
                            if (justifCaixinha) {
                                htmlBody += `<span class="text-xs text-gray-600" style="display:block;margin-top:2px;margin-bottom:6px;line-height:1.5;"><strong>Justificativa:</strong> ${justifCaixinha}</span>`;
                            }
                        }
                    } else if (isDataUnica) {
                        const dataBruta = String(infoItem.data || '').trim();
                        let dataFmt = 'Data indefinida';
                        if (dataBruta !== '') {
                            const dataObj = parseDateLocal(dataBruta);
                            dataFmt = dataObj ? dataObj.toLocaleDateString('pt-BR') : 'Data indefinida';
                        }

                        let justificativaDoCard = infoItem.justificativa || '';
                        if (pedido.categoria_item === 'statusdiariadobrada' && pedido.dtsolicitada && Array.isArray(pedido.dtsolicitada)) {
                            const itemDobraDestaData = pedido.dtsolicitada.find(d => {
                                let dataDobraRaw = d.data;
                                if (Array.isArray(dataDobraRaw)) dataDobraRaw = dataDobraRaw[0];
                                return String(dataDobraRaw).trim() === dataBruta;
                            });
                            if (itemDobraDestaData && itemDobraDestaData.justificativa) {
                                justificativaDoCard = itemDobraDestaData.justificativa;
                            }
                        }

                        if (pedido.categoria_item === 'statusdiariadobrada' && justificativaDoCard.includes('|')) {
                            const partesJustificativa = justificativaDoCard.split('|').map(parte => parte.trim());
                            const parteExclusivaDestaData = partesJustificativa.find(parte => parte.includes(dataFmt));
                            if (parteExclusivaDestaData) {
                                justificativaDoCard = parteExclusivaDestaData;
                            }
                        }

                        htmlBody += `<strong>Data Solicitada:</strong> ${dataFmt} - <span class="status-text font-semibold"><strong>${statusTexto}</strong></span>${aprovadorTxt}<br>`;
                        if ((infoItem.tiposolicitacao || '') === 'Dobrada - Estouro Financeiro') {
                            htmlBody += `<span style="color:#b45309;font-size:12px;font-weight:700;display:block;margin:4px 0 2px;">⚠️ Diária Dobrada com Estouro de Limite Financeiro</span><span style="color:#78350f;font-size:11px;display:block;margin-bottom:6px;line-height:1.6;">• <strong>Autorizar:</strong> o registro permanecerá Pendente até que a vaga seja incluída no orçamento — somente após essa inclusão o registro será ativado.<br>• <strong>Rejeitar:</strong> a diária dobrada é cancelada e o registro retorna automaticamente para Ativo.</span>`;
                        }
                        if (justificativaDoCard) {
                            htmlBody += `<span class="text-xs text-gray-600" style="display: block; margin-top: 2px; margin-bottom: 6px;"><strong>Justificativa:</strong> ${justificativaDoCard}</span>`;
                        }
                    }

                    // Badge financeiro — apenas pendentes (valores são sempre atuais, não históricos)
                    // isAditivoExtra já renderizou o badge interno (antes do DETALHAMENTO) — evita duplicata
                    if (window.ehMasterOuSupremo && pedido.vlrOrcadoEquipe > 0 && statusLower === STATUS_PENDENTE_LOWER && !isAditivoExtra) {
                        const orcado = pedido.vlrOrcadoEquipe;
                        const gasto = pedido.vlrGastoEquipe || 0;
                        const pendente = pedido.vlrPendenteEquipe || 0;
                        // vlr_gasto da rota não soma mais vlrajustecusto à parte (já embutido em vlrtotcache
                        // quando Autorizado) — não precisa mais de compensação manual pra Ajuste de Custo.
                        const saldoAtual = orcado - gasto;
                        const saldoApos = saldoAtual - vlrSolBadge;
                        const outrasPendentes = pendente - vlrSolBadge;
                        const fmt = v => {
                            const parts = Math.abs(v).toFixed(2).split('.');
                            parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
                            return 'R$ ' + parts.join(',');
                        };
                        const corSaldo = saldoApos < 0 ? '#dc2626' : '#16a34a';
                        const aviso = saldoApos < 0 ? ' ⚠️ Estoura o limite' : '';
                        const saldoAtualFmt2 = saldoAtual < 0
                            ? `<span style="color:#dc2626;font-weight:bold;">-${fmt(saldoAtual)} ⚠️ Já estourado</span>`
                            : fmt(saldoAtual);
                        const aposHtml = (vlrSolBadge > 0 && statusLower === STATUS_PENDENTE_LOWER)
                            ? `&nbsp;|&nbsp;<strong>Saldo Após autorizar:</strong> <span style="color:${corSaldo};font-weight:bold;">${saldoApos < 0 ? '-' : ''}${fmt(saldoApos)}${aviso}</span>`
                            : '';
                        htmlBody += `
                            <div style="margin:4px 0 2px;padding:5px 10px;background:var(--surface-3);border-left:3px solid #6366f1;border-radius:3px;font-size:12.5px;color:var(--text-1);">
                                💰 <strong>Custo Orçado:</strong> ${fmt(orcado)} &nbsp;|&nbsp;
                                <strong>Saldo atual:</strong> ${saldoAtualFmt2}${aposHtml}
                            </div>
                        `;
                        if (outrasPendentes > 0) {
                            const saldoEfetivo = saldoApos - outrasPendentes;
                            const corEfetivo = saldoEfetivo < 0 ? '#dc2626' : '#92400e';
                            htmlBody += `
                                <div style="margin:0 0 6px;padding:3px 10px;background:#fffbeb;border-left:3px solid #f59e0b;border-radius:3px;font-size:11.5px;color:#78350f;">
                                    📋 Há outras ${fmt(outrasPendentes)} em sol. pendentes — saldo efetivo:
                                    <span style="color:${corEfetivo};font-weight:bold;">
                                        ${saldoEfetivo < 0 ? '-' : ''}${fmt(saldoEfetivo)}
                                    </span>
                                    ${saldoEfetivo < 0 ? '— aguardar aprovações ou solicitar Aditivo' : ''}
                                </div>
                            `;
                        }
                    }

                    if (statusDesejado === STATUS_PENDENTE_LOWER && podeAprovar) {
                        if (isAditivoExtra) return;

                        const campoParaAcao = isPedidoPrincipal ? 'status_aprovacao' : campo;
                        const tratarData = (valor) => Array.isArray(valor) ? valor.join(',') : String(valor || '').trim();
                        const dataParaAcao = isPedidoPrincipal ? tratarData(pedido.dataEspecifica) : (isDataUnica ? tratarData(infoItem.data) : '');
                        const idParaAcao = infoItem.idsolicitacao || pedido.id_log;
                        const idLogParaAcao = infoItem.id_log || pedido.id_log || '';

                        htmlBody += `
                            <br>
                            <div class="AcoesPedido"
                                data-id="${idParaAcao}"
                                data-campo="${campoParaAcao}"
                                data-data="${dataParaAcao}"
                                data-logid="${idLogParaAcao}"
                                data-aditivo="false">
                                <button class="aprovar">Autorizar</button>
                                <button class="negar">Rejeitar</button>
                            </div>
                        `;
                    }

                    htmlBody += `
                            </div>
                        </div>
                    `;
                });
            });
        });

        body.innerHTML = htmlBody;
        divGrupo.appendChild(body);

        header.addEventListener('click', () => {
            body.classList.toggle('hidden');
        });

        if (itensGrupo > 0) {
            listaGrupos.appendChild(divGrupo);
        }
    });

    // --- 3. LISTENERS DE AÇÃO (SWAL) ---
    container.onclick = null;

    container.addEventListener('click', async function(event) {
        const target = event.target;

        //── COMBO FuncExcedido + Estouro Financeiro ──────────────
        // Seção 1 — Autorizar/Rejeitar Aditivo (individual)
        // Chama o backend diretamente e atualiza o DOM in-place para o card não fechar.
        if (target.classList.contains('aprovar-fe-aditivo-ind') ||
            target.classList.contains('rejeitar-fe-aditivo-ind')) {
            event.stopPropagation();
            const isAprovar  = target.classList.contains('aprovar-fe-aditivo-ind');
            const idSol      = target.getAttribute('data-id');
            const idLog      = target.getAttribute('data-logid');
            const dataEsp    = target.getAttribute('data-data');
            const cardCombo  = target.closest('.combo-fe-card');
            const linhaDom   = target.closest('.linha-data-aditivo');

            const result = await Swal.fire({
                title: isAprovar ? 'Autorizar Aditivo?' : 'Rejeitar Aditivo?',
                html: isAprovar
                    ? 'Ao autorizar, a vaga será criada no orçamento e a autorização do funcionário nesta mesma data será desbloqueada.'
                    : '<strong>Atenção:</strong> Rejeitar o Aditivo cancelará automaticamente a autorização do funcionário excedido apenas nesta data.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: isAprovar ? '#16a34a' : '#dc2626',
                confirmButtonText: 'Confirmar',
                cancelButtonText: 'Cancelar'
            });
            if (!result.isConfirmed) return;

            // Chama o backend sem re-render para manter o card aberto
            try {
                const novoStatus = isAprovar ? 'Autorizado' : 'Rejeitado';
                const resp = await fetchComToken('/main/notificacoes-financeiras/atualizar-status', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ idpedido: idSol, categoria: 'statusaditivoextra', acao: novoStatus, idlog_origem: idLog, data: dataEsp })
                });
                if (!resp?.sucesso) {
                    Swal.fire('Erro', resp?.erro || 'Falha na atualização', 'error');
                    return;
                }
            } catch (err) {
                Swal.fire('Erro', 'Falha ao comunicar com o servidor', 'error');
                return;
            }

            // Atualiza o badge da data na Seção 1 (DOM in-place, card permanece aberto)
            const corStatus = isAprovar ? '#16a34a' : '#dc2626';
            const textoStatus = isAprovar ? '✅ Autorizado' : '❌ Rejeitado';
            if (linhaDom) {
                const divBadge = linhaDom.querySelector('div');
                if (divBadge) divBadge.innerHTML = `<span style="font-size:12px;font-weight:bold;color:${corStatus};border:1px solid ${corStatus};border-radius:3px;padding:2px 8px;">${textoStatus}</span>`;
            }

            const secao2 = cardCombo?.querySelector('.combo-fe-secao-func');
            if (isAprovar) {
                // Desbloqueia só a linha da Seção 2 com a mesma data (card continua aberto)
                if (secao2) desbloquearFuncaoExcedidaAutorizada(secao2, dataEsp);
            } else {
                // Rejeição: auto-rejeita só a linha do FuncExcedido com a MESMA data, não todas
                const idLogFuncExc = cardCombo?.getAttribute('data-idlog-funcexc');
                const linhaFE = secao2?.querySelector(`.linha-data-aditivo[data-data="${String(dataEsp).replace(/["\\]/g, '\\$&')}"]`);
                const idSolFEAlvo = linhaFE?.getAttribute('data-idsolicitacao');
                if (idSolFEAlvo && idLogFuncExc) {
                    await atualizarStatusAditivoExtra(idSolFEAlvo, 'rejeitado', dataEsp, idLogFuncExc, true, 'statusvagaexcedida');
                    const divBadgeFE = linhaFE.querySelector('div');
                    if (divBadgeFE) divBadgeFE.innerHTML = `<span style="font-size:12px;font-weight:bold;color:#dc2626;border:1px solid #dc2626;border-radius:3px;padding:2px 8px;">❌ Cancelado (Aditivo rejeitado)</span>`;
                }
            }

            Swal.fire({ icon: 'success', title: isAprovar ? 'Aditivo Autorizado!' : 'Aditivo Rejeitado!', timer: 800, showConfirmButton: false });
            atualizarContadoresGlobais();
            return;
        }

        // Seção 2 — Autorizar/Rejeitar FuncExcedido (individual)
        if (target.classList.contains('aprovar-fe-func-ind') ||
            target.classList.contains('rejeitar-fe-func-ind')) {
            event.stopPropagation();
            const isAprovar = target.classList.contains('aprovar-fe-func-ind');
            const idSol     = target.getAttribute('data-id');
            const idLog     = target.getAttribute('data-logid');
            const dataEsp   = target.getAttribute('data-data');

            const result = await Swal.fire({
                title: isAprovar ? 'Autorizar Funcionário Excedido?' : 'Rejeitar Funcionário Excedido?',
                html: isAprovar
                    ? 'O funcionário será ativado no evento nas datas excedidas.'
                    : 'O funcionário permanecerá inativo. A vaga no orçamento foi criada mas não será ocupada por este funcionário.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: isAprovar ? '#16a34a' : '#dc2626',
                confirmButtonText: 'Confirmar',
                cancelButtonText: 'Cancelar'
            });
            if (!result.isConfirmed) return;

            const sucesso = await atualizarStatusAditivoExtra(idSol, isAprovar ? 'autorizado' : 'rejeitado', dataEsp, idLog, true, 'statusvagaexcedida');
            if (!sucesso) return;

            const linhaDom = target.closest('.linha-data-aditivo');
            if (linhaDom) {
                linhaDom.querySelector('div').innerHTML = `<span style="font-size:12px;font-weight:bold;color:${isAprovar ? '#16a34a' : '#dc2626'};border:1px solid ${isAprovar ? '#16a34a' : '#dc2626'};border-radius:3px;padding:2px 8px;">${isAprovar ? '✅ Autorizado' : '❌ Rejeitado'}</span>`;
            }
            atualizarContadoresGlobais();
            return;
        }

        //── COMBO FuncExcedido + Vaga Excedida ────────────────────
        // Seção 1 — Autorizar/Rejeitar Aditivo ou Extra Bonificado (individual)
        if (target.classList.contains('aprovar-fev-aditivo-ind') ||
            target.classList.contains('rejeitar-fev-aditivo-ind')) {
            event.stopPropagation();
            const isAprovar  = target.classList.contains('aprovar-fev-aditivo-ind');
            const idSol      = target.getAttribute('data-id');
            const idLog      = target.getAttribute('data-logid');
            const dataEsp    = target.getAttribute('data-data');
            const cardCombo  = target.closest('.combo-fev-card');
            const linhaDom   = target.closest('.linha-data-aditivo');
            const isAditivo  = cardCombo?.getAttribute('data-natureza') !== 'extra';
            const labelTipo1 = isAditivo ? 'Aditivo' : 'Extra Bonificado';

            const result = await Swal.fire({
                title: isAprovar ? `Autorizar ${labelTipo1}?` : `Rejeitar ${labelTipo1}?`,
                html: isAprovar
                    ? `Ao autorizar, ${isAditivo ? 'a vaga será criada no orçamento' : 'a empresa absorve o custo da diária extra'} e a autorização do funcionário nesta mesma data será desbloqueada.`
                    : `<strong>Atenção:</strong> Rejeitar o ${labelTipo1} cancelará automaticamente a autorização do funcionário excedido apenas nesta data.`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: isAprovar ? '#16a34a' : '#dc2626',
                confirmButtonText: 'Confirmar',
                cancelButtonText: 'Cancelar'
            });
            if (!result.isConfirmed) return;

            try {
                const novoStatus = isAprovar ? 'Autorizado' : 'Rejeitado';
                const resp = await fetchComToken('/main/notificacoes-financeiras/atualizar-status', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ idpedido: idSol, categoria: 'statusaditivoextra', acao: novoStatus, idlog_origem: idLog, data: dataEsp })
                });
                if (!resp?.sucesso) {
                    Swal.fire('Erro', resp?.erro || 'Falha na atualização', 'error');
                    return;
                }
            } catch (err) {
                Swal.fire('Erro', 'Falha ao comunicar com o servidor', 'error');
                return;
            }

            const corStatus = isAprovar ? '#16a34a' : '#dc2626';
            const textoStatus = isAprovar ? '✅ Autorizado' : '❌ Rejeitado';
            if (linhaDom) {
                const divBadge = linhaDom.querySelector('div');
                if (divBadge) divBadge.innerHTML = `<span style="font-size:12px;font-weight:bold;color:${corStatus};border:1px solid ${corStatus};border-radius:3px;padding:2px 8px;">${textoStatus}</span>`;
            }

            const secao2 = cardCombo?.querySelector('.combo-fev-secao-func');
            if (isAprovar) {
                if (secao2) desbloquearFuncaoExcedidaVagaAutorizada(secao2, dataEsp);
            } else {
                const idLogFuncExc = cardCombo?.getAttribute('data-idlog-funcexc');
                const linhaFE = secao2?.querySelector(`.linha-data-aditivo[data-data="${String(dataEsp).replace(/["\\]/g, '\\$&')}"]`);
                const idSolFEAlvo = linhaFE?.getAttribute('data-idsolicitacao');
                if (idSolFEAlvo && idLogFuncExc) {
                    await atualizarStatusAditivoExtra(idSolFEAlvo, 'rejeitado', dataEsp, idLogFuncExc, true, 'statusvagaexcedida');
                    const divBadgeFE = linhaFE.querySelector('div');
                    if (divBadgeFE) divBadgeFE.innerHTML = `<span style="font-size:12px;font-weight:bold;color:#dc2626;border:1px solid #dc2626;border-radius:3px;padding:2px 8px;">❌ Cancelado (${labelTipo1} rejeitado)</span>`;
                }
            }

            Swal.fire({ icon: 'success', title: isAprovar ? `${labelTipo1} Autorizado!` : `${labelTipo1} Rejeitado!`, timer: 800, showConfirmButton: false });
            atualizarContadoresGlobais();
            return;
        }

        // Seção 2 — Autorizar/Rejeitar FuncExcedido (individual)
        if (target.classList.contains('aprovar-fev-func-ind') ||
            target.classList.contains('rejeitar-fev-func-ind')) {
            event.stopPropagation();
            const isAprovar = target.classList.contains('aprovar-fev-func-ind');
            const idSol     = target.getAttribute('data-id');
            const idLog     = target.getAttribute('data-logid');
            const dataEsp   = target.getAttribute('data-data');

            const result = await Swal.fire({
                title: isAprovar ? 'Autorizar Funcionário Excedido?' : 'Rejeitar Funcionário Excedido?',
                html: isAprovar
                    ? 'O funcionário será ativado no evento nas datas excedidas.'
                    : 'O funcionário permanecerá inativo. A vaga não será ocupada por este funcionário.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: isAprovar ? '#16a34a' : '#dc2626',
                confirmButtonText: 'Confirmar',
                cancelButtonText: 'Cancelar'
            });
            if (!result.isConfirmed) return;

            const sucesso = await atualizarStatusAditivoExtra(idSol, isAprovar ? 'autorizado' : 'rejeitado', dataEsp, idLog, true, 'statusvagaexcedida');
            if (!sucesso) return;

            const linhaDom = target.closest('.linha-data-aditivo');
            if (linhaDom) {
                linhaDom.querySelector('div').innerHTML = `<span style="font-size:12px;font-weight:bold;color:${isAprovar ? '#16a34a' : '#dc2626'};border:1px solid ${isAprovar ? '#16a34a' : '#dc2626'};border-radius:3px;padding:2px 8px;">${isAprovar ? '✅ Autorizado' : '❌ Rejeitado'}</span>`;
            }
            atualizarContadoresGlobais();
            return;
        }

        //── COMBO Extra Bonificado + Diária Dobrada ───────────────
        // Seção 1 — Autorizar/Rejeitar Extra Bonificado (individual)
        if (target.classList.contains('aprovar-edb-bonif-ind') ||
            target.classList.contains('rejeitar-edb-bonif-ind')) {
            event.stopPropagation();
            const isAprovar  = target.classList.contains('aprovar-edb-bonif-ind');
            const idSol      = target.getAttribute('data-id');
            const idLog      = target.getAttribute('data-logid');
            const dataEsp    = target.getAttribute('data-data');
            const cardCombo  = target.closest('.combo-edb-card');
            const linhaDom   = target.closest('.linha-data-aditivo');

            const result = await Swal.fire({
                title: isAprovar ? 'Autorizar Extra Bonificado?' : 'Rejeitar Extra Bonificado?',
                html: isAprovar
                    ? 'Ao autorizar, a empresa absorve o custo extra e a autorização da Diária Dobrada será desbloqueada.'
                    : '<strong>Atenção:</strong> Rejeitar o Extra Bonificado cancelará automaticamente a Diária Dobrada vinculada.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: isAprovar ? '#16a34a' : '#dc2626',
                confirmButtonText: 'Confirmar',
                cancelButtonText: 'Cancelar'
            });
            if (!result.isConfirmed) return;

            try {
                const novoStatus = isAprovar ? 'Autorizado' : 'Rejeitado';
                const resp = await fetchComToken('/main/notificacoes-financeiras/atualizar-status', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ idpedido: idSol, categoria: 'statusaditivoextra', acao: novoStatus, idlog_origem: idLog, data: dataEsp })
                });
                if (!resp?.sucesso) {
                    Swal.fire('Erro', resp?.erro || 'Falha na atualização', 'error');
                    return;
                }
            } catch (err) {
                Swal.fire('Erro', 'Falha ao comunicar com o servidor', 'error');
                return;
            }

            const corStatus   = isAprovar ? '#16a34a' : '#dc2626';
            const textoStatus = isAprovar ? '✅ Autorizado' : '❌ Rejeitado';
            if (linhaDom) {
                const divBadge = linhaDom.querySelector('div');
                if (divBadge) divBadge.innerHTML = `<span style="font-size:12px;font-weight:bold;color:${corStatus};border:1px solid ${corStatus};border-radius:3px;padding:2px 8px;">${textoStatus}</span>`;
            }

            if (isAprovar) {
                const secao2 = cardCombo?.querySelector('.combo-edb-secao-dobrada');
                if (secao2) desbloquearBonificadoAutorizado(secao2);
            } else {
                const idsDobrStr   = cardCombo?.getAttribute('data-ids-dobrada');
                const idLogDobrada = cardCombo?.getAttribute('data-idlog-dobrada');
                if (idsDobrStr && idLogDobrada) {
                    for (const idSolD of idsDobrStr.split(',')) {
                        await atualizarStatusAditivoExtra(idSolD.trim(), 'rejeitado', null, idLogDobrada, true, 'statusdiariadobrada');
                    }
                }
                const secao2 = cardCombo?.querySelector('.combo-edb-secao-dobrada');
                if (secao2) secao2.innerHTML = `<div style="color:var(--text-2);font-size:12px;padding:8px;">❌ Extra Bonificado Rejeitado — Diária Dobrada cancelada automaticamente.</div>`;
            }

            Swal.fire({ icon: 'success', title: isAprovar ? 'Extra Bonificado Autorizado!' : 'Extra Bonificado Rejeitado!', timer: 800, showConfirmButton: false });
            atualizarContadoresGlobais();
            return;
        }

        // Seção 2 — Autorizar/Rejeitar Diária Dobrada (individual)
        if (target.classList.contains('aprovar-edb-dobrada-ind') ||
            target.classList.contains('rejeitar-edb-dobrada-ind')) {
            event.stopPropagation();
            const isAprovar = target.classList.contains('aprovar-edb-dobrada-ind');
            const idSol     = target.getAttribute('data-id');
            const idLog     = target.getAttribute('data-logid');
            const dataEsp   = target.getAttribute('data-data');

            const result = await Swal.fire({
                title: isAprovar ? 'Autorizar Diária Dobrada?' : 'Rejeitar Diária Dobrada?',
                html: isAprovar
                    ? 'O funcionário receberá a diária dobrada nas datas selecionadas.'
                    : 'A Diária Dobrada será rejeitada. O Extra Bonificado permanece autorizado.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: isAprovar ? '#16a34a' : '#dc2626',
                confirmButtonText: 'Confirmar',
                cancelButtonText: 'Cancelar'
            });
            if (!result.isConfirmed) return;

            const sucesso = await atualizarStatusAditivoExtra(idSol, isAprovar ? 'autorizado' : 'rejeitado', dataEsp, idLog, true, 'statusdiariadobrada');
            if (!sucesso) return;

            const linhaDom = target.closest('.linha-data-aditivo');
            if (linhaDom) {
                linhaDom.querySelector('div').innerHTML = `<span style="font-size:12px;font-weight:bold;color:${isAprovar ? '#16a34a' : '#dc2626'};border:1px solid ${isAprovar ? '#16a34a' : '#dc2626'};border-radius:3px;padding:2px 8px;">${isAprovar ? '✅ Autorizado' : '❌ Rejeitado'}</span>`;
            }
            atualizarContadoresGlobais();
            return;
        }

        //── INDIVIDUAL ───────────────────────────────────────────
        if (target.classList.contains('aprovar-individual-aditivo') ||
            target.classList.contains('rejeitar-individual-aditivo')) {
            event.stopPropagation();

            const isAprovar   = target.classList.contains('aprovar-individual-aditivo');
            const idSol       = target.getAttribute('data-id');
            const idLogOrigem = target.getAttribute('data-logid');
            const linhaDom    = target.closest('.linha-data-aditivo');

            const dataEspecifica = target.getAttribute('data-data');

            const dataFmt = dataEspecifica
                ? dataEspecifica.split('-').reverse().join('/')
                : '';

            const result = await Swal.fire({
                title: isAprovar ? 'Autorizar esta data?' : 'Rejeitar esta data?',
                html: dataFmt ? `<strong style="font-size:1.1em;">${dataFmt}</strong>` : '',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: isAprovar ? '#16a34a' : '#dc2626',
                confirmButtonText: 'Confirmar',
                cancelButtonText: 'Cancelar'
            });
            if (!result.isConfirmed) return;

            const sucesso = await atualizarStatusAditivoExtra(
                idSol,
                isAprovar ? STATUS_AUTORIZADO_LOWER : STATUS_REJEITADO_LOWER,
                dataEspecifica,
                idLogOrigem,
                true,
                'statusaditivoextra'
            );

            if (sucesso && linhaDom) {
                linhaDom.style.opacity = '0';
                setTimeout(() => { 
                    const isAutorizado = isAprovar;
                    const corStatus = isAutorizado ? '#16a34a' : '#dc2626';
                    const iconeStatus = isAutorizado ? '✅' : '❌';
                    const textoStatus = isAutorizado ? 'Autorizado' : 'Rejeitado';

                    const divBotoes = linhaDom.querySelector('div'); 
                    if (divBotoes) {
                        divBotoes.innerHTML = `
                            <span style="
                                background: ${corStatus}15; 
                                border: 1px solid ${corStatus}; 
                                color: ${corStatus}; 
                                border-radius: 4px; 
                                padding: 2px 8px; 
                                font-size: 11px; 
                                font-weight: bold;">
                                ${iconeStatus} ${textoStatus}
                            </span>
                        `;
                    }
                
                    linhaDom.style.opacity = '1';
                    linhaDom.dataset.status = isAprovar ? 'autorizado' : 'rejeitado';

                    // Atualiza saldo previsionado conforme decisão
                    const cardElPrev = linhaDom.closest('.pedido-card');
                    const badgeElPrev = cardElPrev?.querySelector('.badge-financeiro-aditivo');
                    if (badgeElPrev) {
                        const saldoAtBadge = parseFloat(badgeElPrev.dataset.saldoAtual);
                        const vlrDiaBadge  = parseFloat(badgeElPrev.dataset.vlrDia);
                        const datasAllBadge = parseInt(badgeElPrev.dataset.datasAll);
                        const listaContP   = linhaDom.closest('.lista-datas-aditivo');
                        const rejQty       = listaContP?.querySelectorAll('.linha-data-aditivo[data-status="rejeitado"]').length || 0;
                        const prev         = saldoAtBadge - vlrDiaBadge * (datasAllBadge - rejQty);
                        const spanPrev     = badgeElPrev.querySelector('.saldo-previsionado-value');
                        if (spanPrev) {
                            const fmtP = v => { const p = Math.abs(v).toFixed(2).split('.'); p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.'); return 'R$ ' + p.join(','); };
                            spanPrev.style.color = prev < 0 ? '#dc2626' : '#16a34a';
                            spanPrev.textContent = `${prev < 0 ? '-' : ''}${fmtP(prev)}`;
                        }
                    }

                    const novoStatus = isAprovar ? STATUS_AUTORIZADO_LOWER : STATUS_REJEITADO_LOWER;
                    const listas = [window.gruposFuncionariosGlobais, window.gruposFuncoesGlobais];
                    listas.forEach(lista => {
                        if (!lista) return;
                        lista.forEach(grupo => {
                            grupo.registrosOriginais?.forEach(p => {
                                if (String(p.id_log) === String(idLogOrigem)) {
                                    p.status_aprovacao = novoStatus;
                                }
                            });
                        });
                    });

                    const listaContainer = linhaDom.closest('.lista-datas-aditivo');
                    const totalPendentes = listaContainer?.querySelectorAll('.aprovar-individual-aditivo').length || 0;

                    const wrapperAditivo = listaContainer?.parentElement;
                    const btnAutorizarLote = wrapperAditivo?.querySelector('.aprovar-lote-aditivo');
                    const btnRejeitarLote = wrapperAditivo?.querySelector('.rejeitar-lote-aditivo');

                    if (totalPendentes === 0) {
                        const botoesDeLote = btnAutorizarLote?.closest('div');
                        if (botoesDeLote) {
                            botoesDeLote.style.transition = '0.3s';
                            botoesDeLote.style.opacity = '0';
                            setTimeout(() => botoesDeLote.remove(), 300);
                        }
                    } else {
                        if (btnAutorizarLote) btnAutorizarLote.textContent = `✅ Autorizar Todas (${totalPendentes})`;
                        if (btnRejeitarLote) btnRejeitarLote.textContent = `❌ Rejeitar Todas (${totalPendentes})`;
                    }

                    atualizarContadoresGlobais(); 
                }, 300);
            }
            return;
        }

        // ── LOTE ─────────────────────────────────────────────────
        if (target.classList.contains('aprovar-lote-aditivo') ||
            target.classList.contains('rejeitar-lote-aditivo')) {
            event.stopPropagation();

            const isAprovar   = target.classList.contains('aprovar-lote-aditivo');
            const ids         = target.getAttribute('data-ids').split(',').map(id => id.trim()).filter(Boolean);
            const idLogOrigem = target.getAttribute('data-logid');
            const cardElement = target.closest('.pedido-card');

            const result = await Swal.fire({
                title: isAprovar ? `Autorizar todas (${ids.length})?` : `Rejeitar todas (${ids.length})?`,
                text: 'Esta ação será aplicada a todas as datas desta solicitação.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: isAprovar ? '#16a34a' : '#dc2626',
                confirmButtonText: 'Confirmar',
                cancelButtonText: 'Cancelar'
            });
            if (!result.isConfirmed) return;

            const statusTarget = isAprovar ? STATUS_AUTORIZADO_LOWER : STATUS_REJEITADO_LOWER;
            let todosOk = true;

            for (const idSol of ids) {
                const ok = await atualizarStatusAditivoExtra(idSol, statusTarget, null, idLogOrigem, true);
                if (!ok) { todosOk = false; break; }
            }

            if (todosOk) {
                if (cardElement) {
                    cardElement.style.transition = '0.3s';
                    cardElement.style.opacity = '0';
                    setTimeout(() => {
                        const corpo = cardElement.closest('.funcionario-body');
                        const grupo = cardElement.closest('.funcionario');
                        cardElement.remove();
                        if (corpo?.querySelectorAll('.pedido-card').length === 0) {
                            if (grupo) { grupo.style.opacity = '0'; setTimeout(() => grupo.remove(), 300); }
                        }
                        atualizarContadoresGlobais();
                    }, 300);
                }
                Swal.fire({ icon: 'success', title: 'Todas atualizadas!', timer: 800, showConfirmButton: false })
                    .then(() => { if (typeof window.recarregarPainelPedidosGlobais === 'function') window.recarregarPainelPedidosGlobais(); });
            } else {
                Swal.fire('Erro', 'Falha ao processar uma ou mais datas.', 'error');
            }
            return;
        }

        if (!target.classList.contains('aprovar') && !target.classList.contains('negar')) return;

        const actionDiv = target.closest('[data-id]');
        if (!actionDiv) return;

        const isAprovar = target.classList.contains('aprovar');
        const idReferencia = actionDiv.getAttribute('data-id'); 
        const campoParaBackend = actionDiv.getAttribute('data-campo');
        const dataParaUpdate = actionDiv.getAttribute('data-data');
        const isAditivoExtra = actionDiv.getAttribute('data-aditivo') === 'true';

        const statusUpdateFn = isAditivoExtra ? atualizarStatusAditivoExtra : atualizarStatusPedido;
        const statusTarget = isAprovar ? STATUS_AUTORIZADO_LOWER : STATUS_REJEITADO_LOWER;
        const cardElement = target.closest('.pedido-card');

        const result = await Swal.fire({
            title: isAprovar ? 'Autorizar?' : 'Rejeitar?',
            text: "Tem certeza que deseja " + (isAprovar ? "AUTORIZAR" : "REJEITAR") + " esta solicitação?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: isAprovar ? '#16a34a' : '#dc2626',
            confirmButtonText: 'Confirmar'
        });

        if (result.isConfirmed) {
            try {
                console.log("🚀 Iniciando atualização no banco para ID:", idReferencia);
                const idLogOriginal = actionDiv.getAttribute('data-logid');
                const novoStatus = statusTarget;
                
                let sucesso = false;
                if (isAditivoExtra) {
                    sucesso = await statusUpdateFn(idReferencia, statusTarget, cardElement, idLogOriginal); 
                } else {
                    sucesso = await statusUpdateFn(idReferencia, campoParaBackend, statusTarget, cardElement, dataParaUpdate, idLogOriginal);
                }

                if (sucesso) {
                    const listas = [window.gruposFuncionariosGlobais, window.gruposFuncoesGlobais];
                    listas.forEach(lista => {
                        if (!lista) return;
                        lista.forEach(grupo => {
                            grupo.registrosOriginais?.forEach(p => {
                                if (String(p.id_log) === String(idLogOriginal)) {
                                    p.status_aprovacao = novoStatus;
                                }
                            });
                        });
                    });

                    if (cardElement) {
                        cardElement.style.transition = '0.3s';
                        cardElement.style.opacity = '0';
                        setTimeout(() => {
                            const corpoGrupo = cardElement.closest('.funcionario-body');
                            const grupoContainer = cardElement.closest('.funcionario');
                            cardElement.remove();

                            if (corpoGrupo && corpoGrupo.querySelectorAll('.pedido-card').length === 0) {
                                if (grupoContainer) {
                                    grupoContainer.style.transition = '0.3s';
                                    grupoContainer.style.opacity = '0';
                                    setTimeout(() => grupoContainer.remove(), 300);
                                }
                            }

                            atualizarContadoresGlobais();
                        }, 300);
                    }

                    Swal.fire({ icon: 'success', title: 'Atualizado!', timer: 800, showConfirmButton: false })
                        .then(() => { if (typeof window.recarregarPainelPedidosGlobais === 'function') window.recarregarPainelPedidosGlobais(); });
                }
            } catch (err) {
                console.error("❌ Erro na execução:", err);
                Swal.fire('Erro', 'Falha ao processar solicitação.', 'error');
            }
        }
    });

    // 🛑 V97.0: Atualiza a contagem da sub-aba (Badge) com o valor exato
    if (typeof atualizarBadgeDeStatus === 'function') {
         atualizarBadgeDeStatus(statusDesejado, totalItensRenderizados, categoria);
    }

    if (typeof atualizarContadoresGlobais === 'function') {
        atualizarContadoresGlobais();
    }
}

async function processarAcaoIndividual(idLog, dataEspecifica, novoStatus) {
    const confirm = await Swal.fire({
        title: 'Confirmar data única?',
        text: `Deseja definir como ${novoStatus} apenas a data ${dataEspecifica}?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sim',
        cancelButtonText: 'Cancelar'
    });

    if (confirm.isConfirmed) {
        // Aqui você chama seu backend passando o id_log e a data específica
        // Exemplo: await atualizarStatusAditivoExtra(idLog, novoStatus, null, idLog, dataEspecifica);
        console.log("Enviando para o banco:", { idLog, dataEspecifica, novoStatus });
        
        // Após o sucesso, você pode recarregar a lista ou remover a linha do HTML manualmente
        Swal.fire('Sucesso!', 'Data atualizada.', 'success');
        // window.recarregarSuaFuncao(); 
    }
}

async function atualizarStatusPedido(idpedido, categoria, acao, cardElement, dataParaUpdate, idLog) {
    try {
        // Garantimos que os nomes das chaves (idpedido, categoria, acao, data) 
        // sejam exatamente o que o seu backend recebia no código antigo.
        const bodyData = {
            id_log: idLog,
            idpedido: idpedido,
            categoria: categoria, // O backend espera 'categoria', que é o seu 'campo'
            acao: acao,            
            idlog_origem: idLog,
            data: dataParaUpdate && dataParaUpdate.trim() !== '' ? dataParaUpdate : null
        };

        console.log("📦 Enviando para o servidor:", bodyData);

        const resposta = await fetchComToken('/main/notificacoes-financeiras/atualizar-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyData)
        });

        // IMPORTANTE: fetchComToken já retorna o JSON. 
        // Não use await resposta.json() aqui.
        if (resposta && resposta.sucesso) {
            console.log("✅ Servidor respondeu com sucesso!");
            return true; 
        } else {
            Swal.fire('Erro', resposta.mensagem || 'Erro ao atualizar.', 'error');
            return false;
        }
    } catch (err) {
        console.error("❌ Erro ao atualizar status:", err);
        return false;
    }
}



async function atualizarStatusAditivoExtra(idAditivoExtra, novoStatus, dataEspecifica = null, idlog_origem = null, skipConfirm = false, categoriaDinamica = 'statusaditivoextra') {
    console.log(`🚀 Iniciando atualização de status para AditivoExtra ID ${idAditivoExtra} para: ${novoStatus} | Data Especifica: ${dataEspecifica} | Categoria: ${categoriaDinamica}`);

    if (!skipConfirm) {
        const confirmacao = await Swal.fire({
            title: 'Confirmar Ação',
            html: `Tem certeza que deseja aplicar esta ação à solicitação de <strong>Aditivo / Extra</strong>?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: novoStatus.toLowerCase() === 'autorizado' ? '#16a34a' : '#dc2626',
            confirmButtonText: 'Confirmar'
        });
        if (!confirmacao.isConfirmed) return false;
    }

    const cardElement = document.querySelector(`[data-idsolicitacao="${idAditivoExtra}"]`) || document.querySelector(`[data-id="${idAditivoExtra}"]`)?.closest('.pedido-card');

    try {
        if (cardElement && typeof cardElement.querySelector === 'function') {
            mostrarLoader(cardElement);
        }

        const containerBotoes = cardElement?.querySelector('.botoes-aditivo-container') || cardElement?.querySelector('div');
        if (containerBotoes && typeof containerBotoes.querySelectorAll === 'function') {
            containerBotoes.style.opacity = '0.5';
            containerBotoes.style.pointerEvents = 'none';
            containerBotoes.querySelectorAll('button').forEach(btn => btn.disabled = true);
        }

        const url = '/main/notificacoes-financeiras/atualizar-status';
        const novoStatusCapitalizado = novoStatus.charAt(0).toUpperCase() + novoStatus.slice(1).toLowerCase();
       
        const payload = { 
            idpedido: idAditivoExtra,
            categoria: categoriaDinamica, 
            acao: novoStatusCapitalizado,
            idlog_origem: idlog_origem
        };

        if (dataEspecifica && dataEspecifica !== 'null') {
            payload.data = dataEspecifica;
        }

        const response = await fetchComToken(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (cardElement && typeof cardElement.querySelector === 'function') {
            ocultarLoader(cardElement);
        }

        if (response && response.sucesso) {
            console.log("✅ Aditivo atualizado no banco. Sincronizando memória...");

            const statusFormatado = novoStatus.toLowerCase().trim();

            const ehAtualizacaoIndividual = dataEspecifica && dataEspecifica !== 'null';

            // Para batch: substitui os botões pelo status. Individual: o handler in-place cuida disso.
            if (!ehAtualizacaoIndividual && containerBotoes) {
                containerBotoes.innerHTML = `
                    <div style="padding:5px; background: var(--surface-3); border: 1px solid #16a34a; color: #16a34a; border-radius: 4px; font-size: 12px; font-weight: bold;">
                        ${statusFormatado} pelo sistema
                    </div>
                `;
            }

            // Para individual: restaura botões para o handler poder fazer fade+badge sem opacity travado
            if (ehAtualizacaoIndividual && containerBotoes) {
                containerBotoes.style.opacity = '';
                containerBotoes.style.pointerEvents = '';
                containerBotoes.querySelectorAll('button').forEach(btn => btn.disabled = false);
            }

            // ==================================================================
            // 🚨 NOVO CACHE CIRÚRGICO: ATUALIZAÇÃO BLINDADA ANTI-SUMIÇO DE CARDS
            // ==================================================================
            try {
                const idsAlterados = String(idAditivoExtra).split(',').map(id => parseInt(id.trim())).filter(Boolean);
                const statusDestino = statusFormatado === 'autorizado' ? 'Autorizado' : 'Rejeitado';

                console.log("🧠 [CACHE]IDs alvos da ação do botão:", idsAlterados);

                // Todos os campos que podem conter JSON de datas individuais
                const camposDatas = [CAMPO_ADITIVO_EXTRA, 'statusaditivoextra', 'statusvagasreaproveitadas', 'statusvagaexcedida'];

                const varrerEAtualizarCacheGeral = (listaDeGrupos) => {
                    if (!listaDeGrupos || !Array.isArray(listaDeGrupos)) return;

                    listaDeGrupos.forEach(grupo => {
                        const registros = grupo.registrosOriginais;
                        if (!registros || !Array.isArray(registros)) return;

                        registros.forEach(pedido => {
                            const matchPorLog = idsAlterados.includes(parseInt(pedido.id_log)) || idsAlterados.includes(parseInt(pedido.idlog));
                            const matchPorSolicitacao = idsAlterados.includes(parseInt(pedido.idsolicitacao)) ||
                                                        idsAlterados.includes(parseInt(pedido.idpedido)) ||
                                                        idsAlterados.includes(parseInt(pedido.id));

                            let matchNasIndividuais = false;
                            if (pedido.solicitacoes_individuais && Array.isArray(pedido.solicitacoes_individuais)) {
                                matchNasIndividuais = pedido.solicitacoes_individuais.some(sol =>
                                    idsAlterados.includes(parseInt(sol.idsolicitacao))
                                );
                            }

                            // Checa em TODOS os campos candidatos, não só statusaditivoextra
                            // Checa em TODOS os campos candidatos, não só statusaditivoextra
                            let matchNoJson = false;
                            camposDatas.forEach(campo => {
                                const raw = pedido[campo];
                                if (!raw || typeof raw !== 'string' && !Array.isArray(raw)) return;
                                const arr = safeParse(raw);
                                if (Array.isArray(arr) && arr.length > 0 && typeof arr[0] === 'object' && arr[0] !== null) {
                                    if (arr.some(it => idsAlterados.includes(parseInt(it.idsolicitacao)))) {
                                        matchNoJson = true;
                                    }
                                }
                            });

                            if (matchPorLog || matchPorSolicitacao || matchNasIndividuais || matchNoJson) {
                                console.warn(`🎯 [CACHE MATCH]`, { id_log: pedido.id_log, ehIndividual: ehAtualizacaoIndividual });
                                console.log('🔍 [CACHE DEBUG]', {
                                    id_log: pedido.id_log,
                                    idsolicitacao: pedido.idsolicitacao,
                                    categoria_item: pedido.categoria_item,
                                    ehAtualizacaoIndividual,
                                    dataEspecifica,
                                    idsAlterados,
                                    statusvagasreaproveitadas: pedido.statusvagasreaproveitadas,
                                    statusaditivoextra: pedido.statusaditivoextra,
                                    solicitacoes_individuais: pedido.solicitacoes_individuais
                                });
                                
                                if (ehAtualizacaoIndividual) {
                                    // Atualiza APENAS a data específica — NÃO muda status_aprovacao do pai

                                    if (pedido.solicitacoes_individuais && Array.isArray(pedido.solicitacoes_individuais)) {
                                        pedido.solicitacoes_individuais.forEach(sol => {
                                            console.log('🔎 [SOL]', {
                                                idsolicitacao: sol.idsolicitacao,
                                                data: sol.data,
                                                status: sol.status,
                                                incluiDataEspecifica: String(sol.data).includes(dataEspecifica),
                                                idMatch: idsAlterados.includes(parseInt(sol.idsolicitacao))
                                            });
                                            if (idsAlterados.includes(parseInt(sol.idsolicitacao)) ||
                                                String(sol.data).includes(dataEspecifica)) {
                                                sol.status = statusDestino;
                                            }
                                        });
                                         console.log('✅ [SOL APÓS UPDATE]', 
                                            pedido.solicitacoes_individuais.map(s => ({ id: s.idsolicitacao, status: s.status }))
                                        );
                                    }

                                    // Atualiza em TODOS os campos candidatos
                                    // Atualiza em TODOS os campos candidatos
                                    let aindaPendente = false;
                                    camposDatas.forEach(campo => {
                                        const raw = pedido[campo];
                                        if (!raw || typeof raw !== 'string' && !Array.isArray(raw)) return;
                                        const arr = safeParse(raw);
                                        if (!Array.isArray(arr) || arr.length === 0 || typeof arr[0] !== 'object' || arr[0] === null) return;
                                        let mudou = false;
                                        arr.forEach(it => {
                                            if (idsAlterados.includes(parseInt(it.idsolicitacao)) ||
                                                String(it.data || '').includes(dataEspecifica)) {
                                                it.status = statusDestino;
                                                mudou = true;
                                            }
                                            if ((it.status || 'pendente').toLowerCase() === 'pendente') {
                                                aindaPendente = true;
                                            }
                                        });
                                        if (mudou) pedido[campo] = arr;
                                    });

                                    // Só sobe o pai se TODAS as datas foram resolvidas
                                    if (!aindaPendente) {
                                        pedido.status = statusDestino;
                                        pedido.status_aprovacao = statusDestino;
                                    }
                                } else {
                                    // Lote: atualiza o registro inteiro
                                    pedido.status = statusDestino;
                                    pedido.status_aprovacao = statusDestino;
                                    camposDatas.forEach(campo => {
                                        if (pedido[campo]) pedido[campo] = statusDestino;
                                    });
                                    if (pedido.solicitacoes_individuais && Array.isArray(pedido.solicitacoes_individuais)) {
                                        pedido.solicitacoes_individuais.forEach(sol => { sol.status = statusDestino; });
                                    }
                                }
                            }
                        });
                    });
                };

                varrerEAtualizarCacheGeral(window.gruposFuncionariosGlobais);
                varrerEAtualizarCacheGeral(window.gruposFuncoesGlobais);

            } catch (errCache) {
                console.error("⚠️ Erro ao alinhar memória cache:", errCache);
            }
            // ==================================================================

            // ==================================================================
            // 🎬 RE-RENDERIZAR / ATUALIZAR CONTADORES
            // ==================================================================
            if (ehAtualizacaoIndividual) {
                // O handler de evento já fez o update in-place (badge + contador de lote).
                // Aqui apenas atualiza os badges de totais das abas.
                if (typeof atualizarContadoresGlobais === 'function') atualizarContadoresGlobais();
            } else {
                if (typeof sincronizarContadoresOriginais === 'function') sincronizarContadoresOriginais();
                else if (typeof sincronizarContadores === 'function') sincronizarContadores();

                const abaPrincipalAtiva = document.querySelector('.abas-principais .main-tab-btn.ativa');
                const categoriaAtiva = abaPrincipalAtiva ? abaPrincipalAtiva.getAttribute('data-categoria') : 'funcionario';
                const idContainer = categoriaAtiva === 'funcionario' ? 'container-funcionarios' : 'container-funcoes';
                const listaDadosFresh = categoriaAtiva === 'funcionario' ? window.gruposFuncionariosGlobais : window.gruposFuncoesGlobais;

                if (typeof renderizarPedidos === 'function' && listaDadosFresh) {
                    renderizarPedidos(listaDadosFresh, idContainer, categoriaAtiva, 'pendente', true);
                }
            }
            // ==================================================================

            Swal.fire({ icon: 'success', title: 'Aditivo Atualizado!', timer: 800, showConfirmButton: false });
            return true;
        } else {
            Swal.fire('Erro', response.erro || 'Falha na atualização', 'error');
            return false;
        }

    } catch (err) {
        if (cardElement && typeof ocultarLoader === 'function') ocultarLoader(cardElement);
        console.error("❌ Erro ao atualizar aditivo:", err);
        return false;
    }
}


/**
 * Recalcula os badges das sub-abas depois de uma aprovação/rejeição.
 *
 * Usa contarStatusDosGrupos — o mesmo critério da abertura do painel e da
 * pílula da home. Antes olhava só o status_aprovacao da raiz do registro, o que
 * ignorava os campos com aprovação própria (Diária Dobrada, Meia Diária,
 * Caixinha…): o badge mudava de valor depois de aprovar um item, sem nada ter
 * mudado naqueles campos.
 */
function atualizarContadoresGlobais() {
    const porAba = {
        funcionarios: contarStatusDosGrupos(window.gruposFuncionariosGlobais || []),
        funcoes: contarStatusDosGrupos(window.gruposFuncoesGlobais || [])
    };

    [STATUS_PENDENTE_LOWER, STATUS_AUTORIZADO_LOWER, STATUS_REJEITADO_LOWER].forEach(status => {
        Object.entries(porAba).forEach(([aba, contagem]) => {
            const el = document.getElementById(`${aba}-list-count-${status}`);
            if (el) el.textContent = contagem[status];
        });
    });
}



/**
 * Contagem da pílula "Pedidos" da home — roda o MESMO pipeline do painel
 * (desmembrar → agrupar → separar por aba → contar) e soma as duas abas.
 *
 * Antes existia uma contagem paralela (processarContagensResumo) com regras
 * próprias, e ela divergia do painel: olhava só 5 dos campos de status, então
 * quem tinha statuscustofechado / statuscacheliberado / statusvagaexcedida caía
 * no ramo "sem categoria" e era contado pelo status da RAIZ — que continua
 * 'pendente' mesmo depois do item ter sido decidido. Resultado: pendentes a
 * mais na pílula em relação ao que o painel lista.
 */
function contarPedidosParaResumo(pedidos) {
    const grupos = agruparPedidosPorFuncionario(desmembrarPedidosPorStatus(pedidos));
    const { funcionarios, funcoes } = separarGruposPorAba(grupos);

    const deFuncionarios = contarStatusDosGrupos(funcionarios);
    const deFuncoes = contarStatusDosGrupos(funcoes);

    const somar = (status) => deFuncionarios[status] + deFuncoes[status];
    const pendentes = somar(STATUS_PENDENTE_LOWER);
    const autorizados = somar(STATUS_AUTORIZADO_LOWER);
    const rejeitados = somar(STATUS_REJEITADO_LOWER);

    return { pendentes, autorizados, rejeitados, totalItens: pendentes + autorizados + rejeitados };
}

async function atualizarResumoPedidos() {
    try {
        const pedidos = await buscarPedidosUsuario();
        const { totalItens: total, autorizados, pendentes, rejeitados } = contarPedidosParaResumo(pedidos);

        // A pílula da home pode não existir (outras telas importam este módulo),
        // por isso cada elemento é opcional.
        const escrever = (id, valor) => {
            const el = document.getElementById(id);
            if (el) el.textContent = valor;
        };

        escrever("pedidosTotal", total);
        escrever("pedidosAutorizados", autorizados);
        escrever("pedidosPendentes", pendentes);
        escrever("pedidosRecusados", rejeitados);
    } catch (err) {
        console.error("Erro ao atualizar resumo de pedidos:", err);
    }
}

setInterval(atualizarResumoPedidos, 10000);

// Chamada inicial ao carregar a página
atualizarResumoPedidos();

//===============================FIM DA SEÇÃO DE PEDIDOS===============================

// Chamadas pelo Main.js (o painel é aberto pela pílula "Pedidos" da home).
export { mostrarPedidosUsuario, parseDateLocal };
