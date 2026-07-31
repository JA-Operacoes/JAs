import { fetchComToken, aplicarTema } from '../utils/utils.js';

// Devs, Admin Supremo e Master podem alterar um lançamento já Pago por completo; os
// demais usuários, uma vez Pago, só podem anexar/trocar o comprovante (valor/tipo/
// justificativa ficam travados). Mesma regra reforçada no backend (rotaAjusteFinanceiro.js).
const temPermissaoTotalAjuste = typeof temPermissao === 'function'
    ? (temPermissao('AjusteFinanceiro', 'devs') || temPermissao('AjusteFinanceiro', 'supremo') || temPermissao('AjusteFinanceiro', 'master'))
    : false;

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
    const classe = tipo === 'Credito' ? 'credito' : 'debito';
    const label = tipo === 'Credito' ? 'Crédito' : 'Débito';
    return `<span class="tipo-badge ${classe}">${label}</span>`;
}

function formatarMoedaAjuste(valor) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
}

async function carregarFuncionarios() {
    const select = document.getElementById('idFuncionarioSelect');
    try {
        const funcionarios = await fetchComToken('/staff/funcionarios');
        (funcionarios || []).forEach(f => {
            const option = document.createElement('option');
            option.value = f.idfuncionario;
            option.textContent = f.nome;
            select.appendChild(option);
        });

        // Busca por nome (mesmo padrão do select de funcionário em Staff.js)
        if ($(select).hasClass('select2-hidden-accessible')) {
            $(select).select2('destroy');
        }
        $(select).select2({
            placeholder: 'Digite para buscar o funcionário...',
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

function formatarPeriodoTrabalhado(datasevento) {
    if (!Array.isArray(datasevento) || datasevento.length === 0) return '—';
    const fmt = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR');
    const primeira = datasevento[0];
    const ultima = datasevento[datasevento.length - 1];
    return primeira === ultima ? fmt(primeira) : `${fmt(primeira)} a ${fmt(ultima)}`;
}

async function carregarParticipacoes(idFuncionario) {
    const select = document.getElementById('idParticipacaoSelect');
    select.innerHTML = '<option value="">Sem vínculo com participação específica</option>';
    if (!idFuncionario) return;

    try {
        const participacoes = await fetchComToken(`/staff/${idFuncionario}`);
        (participacoes || []).forEach(p => {
            const option = document.createElement('option');
            option.value = p.idstaffevento;
            const periodo = formatarPeriodoTrabalhado(p.datasevento_aggr);
            option.textContent = `${p.nmcliente || '—'} — ${p.nmevento || '—'} — ${p.nmlocalmontagem || '—'} — ${p.nmfuncao || '—'} — ${periodo}`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Erro ao carregar participações do funcionário:', error);
    }
}

let idAjusteEmEdicao = null;
let ajustesCache = [];
let comprovanteAjusteSalvoAtual = null;

// Atualiza o widget de comprovante do Ajuste Financeiro (Anexar / Ver / Substituir / Remover).
// Sem nada (nem salvo, nem recém-escolhido): mostra só "Anexar comprovante".
// Com algo (salvo no banco OU escolhido agora, ainda não salvo): mostra Ver (se salvo) + Substituir + Remover.
function atualizarWidgetComprovanteAjuste(comprovanteSalvo) {
    const container = document.getElementById('containerComprovanteAjuste');
    const btnAnexar = document.getElementById('btnAnexarComprovanteAjuste');
    const linkVer = document.getElementById('linkVerComprovanteAjuste');
    const btnSubstituir = document.getElementById('btnSubstituirComprovanteAjuste');
    const btnRemover = document.getElementById('btnRemoverComprovanteAjuste');
    const fileInput = document.getElementById('fileComprovanteAjuste');
    const nomeArquivo = document.getElementById('nomeComprovanteAjusteEscolhido');
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

async function carregarHistoricoAjustes(idFuncionario) {
    const tbody = document.getElementById('corpoHistoricoAjustes');
    if (!idFuncionario) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:#999;">Selecione um funcionário</td></tr>';
        return;
    }

    try {
        const ajustes = await fetchComToken(`/ajustefinanceiro/${idFuncionario}`);
        ajustesCache = ajustes || [];
        if (!ajustes || ajustes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:#999;">Nenhum lançamento ainda</td></tr>';
            return;
        }

        tbody.innerHTML = ajustes.map(a => {
            const origem = a.idstaffeventoorigem
                ? `${a.nmevento || '—'} (${a.nmfuncao || '—'})`
                : '—';
            const dataFmt = a.dtlancamento ? new Date(a.dtlancamento).toLocaleDateString('pt-BR') : '—';
            const podeAbrirParaEdicao = a.status === 'Pendente' || a.status === 'Pago';
            const tituloAcao = a.status === 'Pago' ? 'Anexar/trocar comprovante' : 'Editar lançamento';
            const acoes = podeAbrirParaEdicao
                ? `<button type="button" class="btn-editar-ajuste" title="${tituloAcao}" onclick="editarAjusteFinanceiro(${a.idajustefinanceiro})"><i class="fas fa-pencil-alt"></i></button>`
                : '';
            const comprovanteCel = a.comprovante
                ? `<a href="${a.comprovante}" target="_blank" class="comprovante-salvo-link btn-success" style="font-size:0.8em;">📎 Ver</a>`
                : '<span style="font-size:9px; color:#bbb;">—</span>';
            return `<tr>
                <td>${formatarTipoBadge(a.tipo)}</td>
                <td>${formatarMoedaAjuste(a.valor)}</td>
                <td class="celula-obs" title="${(a.justificativa || '').replace(/"/g, '&quot;')}">${a.justificativa || ''}</td>
                <td>${origem}</td>
                <td>${formatarStatusBadge(a.status)}</td>
                <td style="text-align:center;">${comprovanteCel}</td>
                <td>${dataFmt}</td>
                <td style="text-align:center;">${acoes}</td>
            </tr>`;
        }).join('');
    } catch (error) {
        console.error('Erro ao carregar histórico de ajustes:', error);
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:#c00;">Erro ao carregar histórico</td></tr>';
    }
}

function editarAjusteFinanceiro(idAjusteFinanceiro) {
    const ajuste = ajustesCache.find(a => a.idajustefinanceiro === idAjusteFinanceiro);
    if (!ajuste) return;

    idAjusteEmEdicao = ajuste.idajustefinanceiro;

    document.getElementById('idParticipacaoSelect').value = ajuste.idstaffeventoorigem || '';
    document.getElementById('tipoSelect').value = ajuste.tipo;
    document.getElementById('valorInput').value = Number(ajuste.valor).toFixed(2).replace('.', ',');
    document.getElementById('justificativaInput').value = ajuste.justificativa || '';

    // Lançamento já Pago: quem não é dev só pode mexer no comprovante — os demais campos
    // ficam travados (o backend também reforça essa regra, isso aqui é só o front).
    const travaSomenteComprovante = ajuste.status === 'Pago' && !temPermissaoTotalAjuste;
    ['idParticipacaoSelect', 'tipoSelect', 'valorInput', 'justificativaInput'].forEach(id => {
        document.getElementById(id).disabled = travaSomenteComprovante;
    });

    let avisoPago = document.getElementById('avisoAjustePago');
    if (ajuste.status === 'Pago') {
        if (!avisoPago) {
            avisoPago = document.createElement('div');
            avisoPago.id = 'avisoAjustePago';
            avisoPago.style.cssText = 'font-size:0.85em; font-weight:600; margin:6px 0; padding:8px 12px; border-radius:6px;';
            document.getElementById('justificativaInput').closest('.form-1coluna').insertAdjacentElement('beforebegin', avisoPago);
        }
        if (travaSomenteComprovante) {
            avisoPago.textContent = '🔒 Lançamento já Pago — só é possível anexar/trocar o comprovante.';
            avisoPago.style.background = '#fff3cd';
            avisoPago.style.color = '#856404';
        } else {
            avisoPago.textContent = '⚠️ Lançamento já Pago — seu nível de acesso permite alterar todos os campos.';
            avisoPago.style.background = '#f8d7da';
            avisoPago.style.color = '#721c24';
        }
        avisoPago.style.display = 'block';
    } else if (avisoPago) {
        avisoPago.style.display = 'none';
    }

    // Input de arquivo não pode ser preenchido via JS — o widget mostra Ver/Substituir/Remover
    // com base no que já está salvo. Escolher um novo arquivo substitui o atual ao salvar.
    document.getElementById('fileComprovanteAjuste').value = '';
    document.getElementById('limparComprovanteAjuste').value = 'false';
    comprovanteAjusteSalvoAtual = ajuste.comprovante || null;
    atualizarWidgetComprovanteAjuste(comprovanteAjusteSalvoAtual);

    const botaoEnviar = document.getElementById('Enviar');
    if (botaoEnviar) botaoEnviar.textContent = 'Salvar Alteração';

    if (!document.getElementById('CancelarEdicaoAjuste')) {
        const botaoCancelar = document.createElement('button');
        botaoCancelar.type = 'button';
        botaoCancelar.id = 'CancelarEdicaoAjuste';
        botaoCancelar.className = 'bntLimpar';
        botaoCancelar.textContent = 'Cancelar Edição';
        botaoCancelar.addEventListener('click', limparCamposLancamento);
        botaoEnviar.parentNode.insertBefore(botaoCancelar, botaoEnviar);
    }
}
window.editarAjusteFinanceiro = editarAjusteFinanceiro;

function limparCamposLancamento() {
    document.getElementById('idParticipacaoSelect').value = '';
    document.getElementById('tipoSelect').value = '';
    document.getElementById('valorInput').value = '';
    document.getElementById('justificativaInput').value = '';
    ['idParticipacaoSelect', 'tipoSelect', 'valorInput', 'justificativaInput'].forEach(id => {
        document.getElementById(id).disabled = false;
    });
    const avisoPago = document.getElementById('avisoAjustePago');
    if (avisoPago) avisoPago.style.display = 'none';
    document.getElementById('fileComprovanteAjuste').value = '';
    document.getElementById('limparComprovanteAjuste').value = 'false';
    comprovanteAjusteSalvoAtual = null;
    atualizarWidgetComprovanteAjuste(null);

    idAjusteEmEdicao = null;
    const botaoEnviar = document.getElementById('Enviar');
    if (botaoEnviar) botaoEnviar.textContent = 'Enviar';
    const botaoCancelar = document.getElementById('CancelarEdicaoAjuste');
    if (botaoCancelar) botaoCancelar.remove();
}

async function salvarAjusteFinanceiro(event) {
    event.preventDefault();

    const idFuncionario = document.getElementById('idFuncionarioSelect').value;
    const idStaffEventoOrigem = document.getElementById('idParticipacaoSelect').value;
    const tipo = document.getElementById('tipoSelect').value;
    const valor = document.getElementById('valorInput').value;
    const justificativa = document.getElementById('justificativaInput').value.trim();

    if (!idFuncionario) {
        return Swal.fire('Atenção', 'Selecione um funcionário.', 'warning');
    }
    if (!tipo) {
        return Swal.fire('Atenção', 'Selecione o tipo (Crédito ou Débito).', 'warning');
    }
    const valorNumerico = parseFloat(String(valor).replace(',', '.'));
    if (!valorNumerico || valorNumerico <= 0) {
        return Swal.fire('Atenção', 'Informe um valor maior que zero.', 'warning');
    }
    if (!justificativa) {
        return Swal.fire('Atenção', 'A justificativa é obrigatória.', 'warning');
    }

    const corpo = new FormData();
    corpo.append('idfuncionario', idFuncionario);
    corpo.append('idstaffeventoorigem', idStaffEventoOrigem || '');
    corpo.append('tipo', tipo);
    corpo.append('valor', valorNumerico);
    corpo.append('justificativa', justificativa);
    const arquivoComprovante = document.getElementById('fileComprovanteAjuste').files?.[0];
    if (arquivoComprovante) {
        corpo.append('comprovanteajuste', arquivoComprovante);
    } else if (document.getElementById('limparComprovanteAjuste').value === 'true') {
        corpo.append('limparComprovante', 'true');
    }

    try {
        if (idAjusteEmEdicao) {
            await fetchComToken(`/ajustefinanceiro/${idAjusteEmEdicao}`, { method: 'PUT', body: corpo });
        } else {
            await fetchComToken('/ajustefinanceiro', { method: 'POST', body: corpo });
        }

        Swal.fire({
            icon: 'success',
            title: idAjusteEmEdicao ? 'Lançamento atualizado!' : 'Lançamento salvo!',
            timer: 1500,
            showConfirmButton: false,
            position: 'top-end',
            toast: true
        });

        limparCamposLancamento();
        await carregarHistoricoAjustes(idFuncionario);
    } catch (error) {
        console.error('Erro ao salvar ajuste financeiro:', error);
        Swal.fire('Erro', error.message || 'Não foi possível salvar o lançamento.', 'error');
    }
}
window.salvarAjusteFinanceiro = salvarAjusteFinanceiro;

function inicializarAjusteFinanceiro() {
    carregarFuncionarios();

    const selectFuncionario = document.getElementById('idFuncionarioSelect');
    selectFuncionario.addEventListener('change', () => {
        const idFuncionario = selectFuncionario.value;
        if (idAjusteEmEdicao) limparCamposLancamento(); // evita editar lançamento de outro funcionário
        carregarParticipacoes(idFuncionario);
        carregarHistoricoAjustes(idFuncionario);
    });

    const botaoLimpar = document.getElementById('Limpar');
    botaoLimpar.addEventListener('click', limparCamposLancamento);

    const fileComprovanteAjuste = document.getElementById('fileComprovanteAjuste');
    fileComprovanteAjuste.addEventListener('change', () => {
        document.getElementById('limparComprovanteAjuste').value = 'false';
        atualizarWidgetComprovanteAjuste(comprovanteAjusteSalvoAtual);
    });

    document.getElementById('btnRemoverComprovanteAjuste').addEventListener('click', async () => {
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
        fileComprovanteAjuste.value = '';
        document.getElementById('limparComprovanteAjuste').value = 'true';
        comprovanteAjusteSalvoAtual = null;
        atualizarWidgetComprovanteAjuste(null);
    });
}

function configurarEventosEspecificos(modulo) {
    if (modulo.trim().toLowerCase() === 'ajustefinanceiro') {
        inicializarAjusteFinanceiro();
        if (typeof aplicarPermissoes === "function" && window.permissoes) {
            aplicarPermissoes(window.permissoes);
        }
    }
}
window.configurarEventosEspecificos = configurarEventosEspecificos;

window.moduloHandlers = window.moduloHandlers || {};

// Registra a função de configuração para este módulo ('AjusteFinanceiro' com A e F maiúsculos, igual ao data-modulo do EP-index.html)
window.moduloHandlers['AjusteFinanceiro'] = {
    configurar: inicializarAjusteFinanceiro
};
