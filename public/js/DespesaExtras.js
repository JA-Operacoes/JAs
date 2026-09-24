import { fetchComToken, aplicarTema } from '../utils/utils.js';

document.addEventListener("DOMContentLoaded", function () {
    const idempresa = localStorage.getItem("idempresa");
    if (idempresa) {
        fetchComToken(`/empresas/${idempresa}`)
            .then(empresa => aplicarTema(empresa.nmfantasia))
            .catch(error => console.error("❌ Erro ao buscar tema:", error));
    }
});

function formatarStatusBadge(status) {
    const statusLimpo = (status || 'Pendente').trim();
    const classe = statusLimpo.toLowerCase().replace(/\s+/g, '-');
    return `<span class="status-badge ${classe}">${statusLimpo}</span>`;
}

function formatarTipoBadge(tipo) {
    const classe = tipo === 'Estorno' ? 'estorno' : 'despesa';
    return `<span class="tipo-badge ${classe}">${tipo}</span>`;
}

function formatarMoedaDespesa(valor) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
}

function formatarDataCurta(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('pt-BR');
}

// dd/mm/aaaa (formato do <input type=date> exige aaaa-mm-dd) <-> ISO
function isoParaDataBr(iso) {
    if (!iso) return '—';
    return new Date(`${String(iso).substring(0, 10)}T00:00:00`).toLocaleDateString('pt-BR');
}

async function carregarFuncionariosResponsaveis() {
    const select = document.getElementById('idFuncionarioResponsavelSelect');
    try {
        const funcionarios = await fetchComToken('/staff/funcionarios');
        (funcionarios || []).forEach(f => {
            const option = document.createElement('option');
            option.value = f.idfuncionario;
            option.textContent = f.nome;
            select.appendChild(option);
        });

        if ($(select).hasClass('select2-hidden-accessible')) {
            $(select).select2('destroy');
        }
        $(select).select2({
            placeholder: 'Sem responsável vinculado',
            allowClear: true,
            width: '100%',
            matcher: function (params, data) {
                if ($.trim(params.term) === '') return data;
                if (typeof data.text === 'undefined') return null;
                if (data.text.toLowerCase().indexOf(params.term.toLowerCase()) > -1) return data;
                return null;
            }
        });
        $(select).on('select2:select select2:clear', function () {
            this.dispatchEvent(new Event('change', { bubbles: true }));
        });
    } catch (error) {
        console.error('Erro ao carregar funcionários:', error);
    }
}

let eventoSelecionado = null; // { idevento, nmevento, ano, dtinirealizacao, dtfimrealizacao }
let timeoutBuscaEvento = null;

// Só troca a VISIBILIDADE dos blocos (Evento x data de Escritório) e o título do histórico —
// não busca nada. Separado de aplicarTipoLancamento() pra não recarregar o histórico duas vezes
// quando editarDespesaExtra() já vai chamar selecionarEvento() (que recarrega) logo em seguida.
function alternarVisibilidadeTipoLancamento(tipo) {
    document.getElementById('blocoCamposEvento').style.display = (tipo === 'Escritorio') ? 'none' : '';
    document.getElementById('blocoCampoDataEscritorio').style.display = (tipo === 'Escritorio') ? '' : 'none';
    document.getElementById('tituloHistoricoDespesas').textContent =
        (tipo === 'Escritorio') ? 'Lançamentos de Escritório' : 'Lançamentos deste Evento';
}

// Troca de tipo pelo próprio <select> (usuário): além de alternar a visibilidade, recarrega
// o histórico certo pro tipo escolhido.
function aplicarTipoLancamento(tipo) {
    alternarVisibilidadeTipoLancamento(tipo);
    if (tipo === 'Escritorio') {
        carregarHistoricoEscritorio();
    } else {
        carregarHistorico(document.getElementById('idEventoSelecionado').value || null);
    }
}

// Busca eventos (agrupados por edição/ano) — o backend já devolve ordenado com o ano
// atual primeiro, os demais do mais recente pro mais antigo, e por nome dentro do ano.
// Renderiza a <ul> de resultados (usada tanto pela busca por texto quanto pelo botão
// "ver todos") — separador de ano toda vez que o ano muda entre um item e o seguinte
// (o backend já entrega ordenado: ano atual primeiro, demais do mais recente pro mais
// antigo, alfabético dentro do ano).
function renderizarListaEventos(eventos) {
    const lista = document.getElementById('buscaEventoLista');
    if (!eventos || eventos.length === 0) {
        lista.innerHTML = '<li class="vazio">Nenhum evento encontrado.</li>';
        lista.style.display = 'block';
        return;
    }

    let anoAnterior = null;
    const linhas = [];
    eventos.forEach((ev) => {
        if (ev.ano !== anoAnterior) {
            linhas.push(`<li class="busca-ano-sep">${ev.ano}</li>`);
            anoAnterior = ev.ano;
        }
        linhas.push(
            `<li data-idevento="${ev.idevento}" data-nome="${ev.nmevento}" data-ano="${ev.ano}" ` +
            `data-ini="${ev.dtinirealizacao}" data-fim="${ev.dtfimrealizacao}">` +
            `${ev.nmevento} <small>${formatarDataCurta(ev.dtinirealizacao)} a ${formatarDataCurta(ev.dtfimrealizacao)}</small></li>`
        );
    });
    lista.innerHTML = linhas.join('');
    lista.querySelectorAll('li[data-idevento]').forEach((li) => {
        li.addEventListener('click', () => selecionarEvento({
            idevento: li.dataset.idevento,
            nmevento: li.dataset.nome,
            ano: li.dataset.ano,
            dtinirealizacao: li.dataset.ini,
            dtfimrealizacao: li.dataset.fim
        }));
    });
    lista.style.display = 'block';
}

async function buscarEventos(busca) {
    const lista = document.getElementById('buscaEventoLista');
    if (!busca) { lista.style.display = 'none'; lista.innerHTML = ''; return; }

    try {
        const eventos = await fetchComToken(`/despesaextra/eventos?busca=${encodeURIComponent(busca)}`);
        renderizarListaEventos(eventos);
    } catch (error) {
        console.error('Erro ao buscar eventos:', error);
    }
}

// Botão de seta (▾): mostra a lista inteira (sem filtro de texto) — mesma rota, só sem
// o parâmetro "busca", que o backend já trata como "sem filtro" (LIMIT 30).
async function mostrarTodosEventos() {
    try {
        const eventos = await fetchComToken('/despesaextra/eventos?busca=');
        renderizarListaEventos(eventos);
    } catch (error) {
        console.error('Erro ao listar eventos:', error);
    }
}

async function selecionarEvento(ev) {
    eventoSelecionado = ev;
    document.getElementById('buscaEventoInput').value = ev.nmevento;
    document.getElementById('buscaEventoLista').style.display = 'none';
    document.getElementById('idEventoSelecionado').value = ev.idevento;
    document.getElementById('anoEventoSelecionado').value = ev.ano;
    // dtreferencia guarda a data de início daquela edição — representa "quando aconteceu"
    // pra filtro de ano/período; a origem real do dado é o par idevento+ano escolhido aqui.
    document.getElementById('dtReferenciaSelecionada').value = String(ev.dtinirealizacao).substring(0, 10);
    document.getElementById('eventoSelecionadoResumo').innerHTML =
        `<strong>${ev.nmevento}</strong> — ${formatarDataCurta(ev.dtinirealizacao)} a ${formatarDataCurta(ev.dtfimrealizacao)}`;

    await carregarOrcamentosDoEvento(ev.idevento, ev.ano);
    await carregarHistorico(ev.idevento);
}

async function carregarOrcamentosDoEvento(idEvento, ano) {
    const select = document.getElementById('idOrcamentoSelect');
    select.innerHTML = '<option value="">Nenhum orçamento específico</option>';
    select.disabled = true;
    if (!idEvento) return;

    try {
        const orcamentos = await fetchComToken(`/despesaextra/eventos/${idEvento}/orcamentos?ano=${ano}`);
        (orcamentos || []).forEach((o) => {
            const option = document.createElement('option');
            option.value = o.idorcamento;
            option.textContent = `#${o.nrorcamento}`;
            select.appendChild(option);
        });
        select.disabled = false;
    } catch (error) {
        console.error('Erro ao carregar orçamentos do evento:', error);
    }
}

let despesasCache = [];

function renderizarHistoricoDespesas(despesas) {
    const tbody = document.getElementById('corpoHistoricoDespesas');
    despesasCache = despesas || [];
    if (despesasCache.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; color:var(--text-3);">Nenhum lançamento ainda</td></tr>';
        return;
    }

    tbody.innerHTML = despesasCache.map((d) => {
        const comprovanteCel = d.comprovante
            ? `<a href="${d.comprovante}" target="_blank" class="comprovante-salvo-link btn-success" style="font-size:0.8em;">📎 Ver</a>`
            : '<span style="font-size:9px; color:var(--text-3);">—</span>';
        return `<tr>
            <td>${d.categoria}</td>
            <td>${isoParaDataBr(d.dtreferencia)}</td>
            <td>${formatarTipoBadge(d.tipo)}</td>
            <td>${formatarMoedaDespesa(d.valor)}</td>
            <td class="celula-obs" title="${(d.justificativa || '').replace(/"/g, '&quot;')}">${d.justificativa || ''}</td>
            <td>${d.nomefuncionario || '—'}</td>
            <td>${formatarStatusBadge(d.status)}</td>
            <td>${comprovanteCel}</td>
            <td>${formatarDataCurta(d.dtlancamento)}</td>
            <td><button type="button" class="btn-editar-despesa" title="Editar lançamento" onclick="editarDespesaExtra(${d.iddespesaextra})"><i class="fas fa-pencil-alt"></i></button></td>
        </tr>`;
    }).join('');
}

async function carregarHistorico(idEvento) {
    const tbody = document.getElementById('corpoHistoricoDespesas');
    if (!idEvento) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; color:var(--text-3);">Selecione um evento</td></tr>';
        return;
    }

    try {
        const despesas = await fetchComToken(`/despesaextra/${idEvento}`);
        renderizarHistoricoDespesas(despesas);
    } catch (error) {
        console.error('Erro ao carregar histórico de despesas extras:', error);
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; color:#c00;">Erro ao carregar histórico</td></tr>';
    }
}

async function carregarHistoricoEscritorio() {
    const tbody = document.getElementById('corpoHistoricoDespesas');
    try {
        const despesas = await fetchComToken('/despesaextra/escritorio');
        renderizarHistoricoDespesas(despesas);
    } catch (error) {
        console.error('Erro ao carregar histórico de despesas de escritório:', error);
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; color:#c00;">Erro ao carregar histórico</td></tr>';
    }
}

let idDespesaEmEdicao = null;
let comprovanteDespesaSalvoAtual = null;

function atualizarWidgetComprovanteDespesa(comprovanteSalvo) {
    const container = document.getElementById('containerComprovanteDespesa');
    const btnAnexar = document.getElementById('btnAnexarComprovanteDespesa');
    const linkVer = document.getElementById('linkVerComprovanteDespesa');
    const btnSubstituir = document.getElementById('btnSubstituirComprovanteDespesa');
    const btnRemover = document.getElementById('btnRemoverComprovanteDespesa');
    const fileInput = document.getElementById('fileComprovanteDespesa');
    const nomeArquivo = document.getElementById('nomeComprovanteDespesaEscolhido');
    if (!container || !btnAnexar || !linkVer || !btnSubstituir || !btnRemover || !fileInput || !nomeArquivo) return;

    const arquivoNovo = fileInput.files?.[0] || null;

    btnAnexar.style.display = 'none';
    linkVer.style.display = 'none';
    btnSubstituir.style.display = 'none';
    btnRemover.style.display = 'none';
    container.classList.toggle('tem-arquivo', !!(arquivoNovo || comprovanteSalvo));

    if (arquivoNovo) {
        nomeArquivo.textContent = arquivoNovo.name;
        btnSubstituir.style.display = 'inline-flex';
        btnRemover.style.display = 'inline-flex';
        return;
    }

    nomeArquivo.textContent = 'Nenhum arquivo selecionado';

    if (comprovanteSalvo) {
        linkVer.href = comprovanteSalvo;
        linkVer.style.display = 'inline-flex';
        btnSubstituir.style.display = 'inline-flex';
        btnRemover.style.display = 'inline-flex';
        return;
    }

    btnAnexar.style.display = 'inline-flex';
}

async function editarDespesaExtra(id) {
    const despesa = despesasCache.find((d) => d.iddespesaextra === id);
    if (!despesa) return;

    idDespesaEmEdicao = despesa.iddespesaextra;

    if (despesa.idevento) {
        document.getElementById('tipoLancamentoSelect').value = 'Evento';
        alternarVisibilidadeTipoLancamento('Evento');
        // Espera terminar (evento + orçamentos-irmãos + histórico) antes de preencher o resto —
        // senão o <select> de orçamento ainda não tem as <option> quando tentamos marcar o valor.
        await selecionarEvento({
            idevento: despesa.idevento,
            nmevento: eventoSelecionado?.nmevento || '',
            ano: new Date(despesa.dtreferencia).getFullYear(),
            dtinirealizacao: despesa.dtreferencia,
            dtfimrealizacao: despesa.dtreferencia
        });
        if (despesa.idorcamento) document.getElementById('idOrcamentoSelect').value = despesa.idorcamento;
    } else {
        document.getElementById('tipoLancamentoSelect').value = 'Escritorio';
        alternarVisibilidadeTipoLancamento('Escritorio');
        document.getElementById('dtReferenciaEscritorioInput').value = String(despesa.dtreferencia).substring(0, 10);
    }

    document.getElementById('categoriaSelect').value = despesa.categoria;
    document.getElementById('tipoSelect').value = despesa.tipo;
    document.getElementById('valorInput').value = Number(despesa.valor).toFixed(2).replace('.', ',');
    document.getElementById('justificativaInput').value = despesa.justificativa || '';
    document.getElementById('statusSelect').value = despesa.status;
    $('#idFuncionarioResponsavelSelect').val(despesa.idfuncionario || '').trigger('change');

    document.getElementById('fileComprovanteDespesa').value = '';
    document.getElementById('limparComprovanteDespesa').value = 'false';
    comprovanteDespesaSalvoAtual = despesa.comprovante || null;
    atualizarWidgetComprovanteDespesa(comprovanteDespesaSalvoAtual);

    const botaoEnviar = document.getElementById('Enviar');
    if (botaoEnviar) botaoEnviar.textContent = 'Salvar Alteração';

    if (!document.getElementById('CancelarEdicaoDespesa')) {
        const botaoCancelar = document.createElement('button');
        botaoCancelar.type = 'button';
        botaoCancelar.id = 'CancelarEdicaoDespesa';
        botaoCancelar.className = 'bntLimpar';
        botaoCancelar.textContent = 'Cancelar Edição';
        botaoCancelar.addEventListener('click', limparCamposLancamento);
        botaoEnviar.parentNode.insertBefore(botaoCancelar, botaoEnviar);
    }
}
window.editarDespesaExtra = editarDespesaExtra;

function limparCamposLancamento() {
    document.getElementById('buscaEventoInput').value = '';
    document.getElementById('idEventoSelecionado').value = '';
    document.getElementById('anoEventoSelecionado').value = '';
    document.getElementById('dtReferenciaSelecionada').value = '';
    document.getElementById('eventoSelecionadoResumo').innerHTML = '';
    eventoSelecionado = null;

    document.getElementById('idOrcamentoSelect').innerHTML = '<option value="">Selecione um evento primeiro...</option>';
    document.getElementById('idOrcamentoSelect').disabled = true;

    document.getElementById('dtReferenciaEscritorioInput').value = '';

    document.getElementById('categoriaSelect').value = '';
    document.getElementById('tipoSelect').value = '';
    document.getElementById('valorInput').value = '';
    document.getElementById('justificativaInput').value = '';
    document.getElementById('statusSelect').value = 'Pendente';
    $('#idFuncionarioResponsavelSelect').val('').trigger('change');

    document.getElementById('fileComprovanteDespesa').value = '';
    document.getElementById('limparComprovanteDespesa').value = 'false';
    comprovanteDespesaSalvoAtual = null;
    atualizarWidgetComprovanteDespesa(null);

    // Mantém o Tipo de Lançamento que já estava selecionado (Evento/Escritório) — só limpa os
    // campos do lançamento, e recarrega o histórico do tipo atual.
    if (document.getElementById('tipoLancamentoSelect').value === 'Escritorio') {
        carregarHistoricoEscritorio();
    } else {
        carregarHistorico(null);
    }

    idDespesaEmEdicao = null;
    const botaoEnviar = document.getElementById('Enviar');
    if (botaoEnviar) botaoEnviar.textContent = 'Enviar';
    const botaoCancelar = document.getElementById('CancelarEdicaoDespesa');
    if (botaoCancelar) botaoCancelar.remove();
}

async function salvarDespesaExtra(event) {
    event.preventDefault();

    const tipoLancamento = document.getElementById('tipoLancamentoSelect').value;
    const idEvento = (tipoLancamento === 'Evento') ? document.getElementById('idEventoSelecionado').value : '';
    const dtReferencia = (tipoLancamento === 'Evento')
        ? document.getElementById('dtReferenciaSelecionada').value
        : document.getElementById('dtReferenciaEscritorioInput').value;
    const idOrcamento = (tipoLancamento === 'Evento') ? document.getElementById('idOrcamentoSelect').value : '';
    const categoria = document.getElementById('categoriaSelect').value;
    const tipo = document.getElementById('tipoSelect').value;
    const valor = document.getElementById('valorInput').value;
    const justificativa = document.getElementById('justificativaInput').value.trim();
    const idFuncionario = document.getElementById('idFuncionarioResponsavelSelect').value;
    const status = document.getElementById('statusSelect').value;

    if (tipoLancamento === 'Evento' && !idEvento) {
        return Swal.fire('Atenção', 'Selecione um evento.', 'warning');
    }
    if (tipoLancamento === 'Escritorio' && !dtReferencia) {
        return Swal.fire('Atenção', 'Informe a data da despesa.', 'warning');
    }
    if (!categoria) {
        return Swal.fire('Atenção', 'Selecione a categoria.', 'warning');
    }
    if (!tipo) {
        return Swal.fire('Atenção', 'Selecione o tipo (Despesa ou Estorno).', 'warning');
    }
    const valorNumerico = parseFloat(String(valor).replace(',', '.'));
    if (!valorNumerico || valorNumerico <= 0) {
        return Swal.fire('Atenção', 'Informe um valor maior que zero.', 'warning');
    }
    if (!justificativa) {
        return Swal.fire('Atenção', 'A justificativa é obrigatória.', 'warning');
    }

    const corpo = new FormData();
    if (idEvento) corpo.append('idevento', idEvento);
    corpo.append('dtreferencia', dtReferencia);
    corpo.append('idorcamento', idOrcamento || '');
    corpo.append('categoria', categoria);
    corpo.append('tipo', tipo);
    corpo.append('valor', valorNumerico);
    corpo.append('justificativa', justificativa);
    corpo.append('idfuncionario', idFuncionario || '');
    corpo.append('status', status);
    const arquivoComprovante = document.getElementById('fileComprovanteDespesa').files?.[0];
    if (arquivoComprovante) {
        corpo.append('comprovantedespesa', arquivoComprovante);
    } else if (document.getElementById('limparComprovanteDespesa').value === 'true') {
        corpo.append('limparComprovante', 'true');
    }

    try {
        if (idDespesaEmEdicao) {
            await fetchComToken(`/despesaextra/${idDespesaEmEdicao}`, { method: 'PUT', body: corpo });
        } else {
            await fetchComToken('/despesaextra', { method: 'POST', body: corpo });
        }

        Swal.fire({
            icon: 'success',
            title: idDespesaEmEdicao ? 'Lançamento atualizado!' : 'Lançamento salvo!',
            timer: 1500,
            showConfirmButton: false,
            position: 'top-end',
            toast: true
        });

        const idEventoAtual = idEvento;
        limparCamposLancamento();
        // limparCamposLancamento() já recarrega o histórico de Escritório sozinha (mantém o
        // Tipo de Lançamento atual); pro caso de Evento, recarrega explicitamente o histórico
        // DAQUELE evento (o campo já foi limpo, por isso usa o id capturado antes).
        if (tipoLancamento === 'Evento') {
            await carregarHistorico(idEventoAtual);
        }
    } catch (error) {
        console.error('Erro ao salvar despesa extra do evento:', error);
        Swal.fire('Erro', error.message || 'Não foi possível salvar o lançamento.', 'error');
    }
}
window.salvarDespesaExtra = salvarDespesaExtra;

function inicializarDespesaExtras() {
    carregarFuncionariosResponsaveis();
    document.getElementById('idOrcamentoSelect').disabled = true;

    document.getElementById('tipoLancamentoSelect').addEventListener('change', (e) => {
        // Troca manual de tipo: limpa só o que é específico do OUTRO tipo (evento selecionado
        // ou data de escritório) — categoria/valor/justificativa etc. continuam preenchidos.
        document.getElementById('buscaEventoInput').value = '';
        document.getElementById('idEventoSelecionado').value = '';
        document.getElementById('anoEventoSelecionado').value = '';
        document.getElementById('dtReferenciaSelecionada').value = '';
        document.getElementById('eventoSelecionadoResumo').innerHTML = '';
        eventoSelecionado = null;
        document.getElementById('idOrcamentoSelect').innerHTML = '<option value="">Selecione um evento primeiro...</option>';
        document.getElementById('idOrcamentoSelect').disabled = true;
        document.getElementById('dtReferenciaEscritorioInput').value = '';

        aplicarTipoLancamento(e.target.value);
    });

    const inputBusca = document.getElementById('buscaEventoInput');
    const listaEventos = document.getElementById('buscaEventoLista');
    const listaEventosAberta = () => listaEventos.style.display === 'block';

    inputBusca.addEventListener('input', () => {
        clearTimeout(timeoutBuscaEvento);
        timeoutBuscaEvento = setTimeout(() => buscarEventos(inputBusca.value.trim()), 250);
    });
    // 'click' (não 'focus'): um clique num input já focado não dispara 'focus' de novo, então
    // só 'click' dá o toggle de verdade — clicou com a lista fechada abre (filtrada se já tem
    // texto, ou a lista inteira), clicou nela de novo (já aberta) fecha. Igual um select nativo.
    inputBusca.addEventListener('click', () => {
        if (listaEventosAberta()) {
            listaEventos.style.display = 'none';
        } else if (inputBusca.value.trim()) {
            buscarEventos(inputBusca.value.trim());
        } else {
            mostrarTodosEventos();
        }
    });
    document.getElementById('btnMostrarTodosEventos').addEventListener('click', () => {
        if (listaEventosAberta()) {
            listaEventos.style.display = 'none';
            return;
        }
        inputBusca.value = '';
        mostrarTodosEventos();
    });
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.busca-evento-wrap')) {
            document.getElementById('buscaEventoLista').style.display = 'none';
        }
    });

    const botaoLimpar = document.getElementById('Limpar');
    botaoLimpar.addEventListener('click', limparCamposLancamento);

    const fileComprovanteDespesa = document.getElementById('fileComprovanteDespesa');
    fileComprovanteDespesa.addEventListener('change', () => {
        document.getElementById('limparComprovanteDespesa').value = 'false';
        atualizarWidgetComprovanteDespesa(comprovanteDespesaSalvoAtual);
    });

    document.getElementById('btnRemoverComprovanteDespesa').addEventListener('click', async () => {
        const confirmacao = await Swal.fire({
            title: 'Remover comprovante?',
            text: 'O comprovante será removido ao salvar o lançamento.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sim, remover',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#c0392b'
        });
        if (!confirmacao.isConfirmed) return;
        fileComprovanteDespesa.value = '';
        document.getElementById('limparComprovanteDespesa').value = 'true';
        comprovanteDespesaSalvoAtual = null;
        atualizarWidgetComprovanteDespesa(null);
    });
}

function configurarEventosEspecificos(modulo) {
    if (modulo.trim().toLowerCase() === 'despesaextras') {
        inicializarDespesaExtras();
        if (typeof aplicarPermissoes === "function" && window.permissoes) {
            aplicarPermissoes(window.permissoes);
        }
    }
}
window.configurarEventosEspecificos = configurarEventosEspecificos;

window.moduloHandlers = window.moduloHandlers || {};
window.moduloHandlers['DespesaExtras'] = {
    configurar: inicializarDespesaExtras
};
