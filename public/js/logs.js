import { fetchComToken } from '../utils/utils.js';

const estado = {
  page: 1,
  limit: 50,
  total: 0
};

function formatarData(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('pt-BR');
}

function formatarNome(nome, sobrenome) {
  if (!nome) return '-';
  return sobrenome ? `${nome} ${sobrenome}` : nome;
}

async function popularSelect(url, selectEl, montarOption) {
  try {
    const dados = await fetchComToken(url);
    (dados || []).forEach(item => {
      const option = document.createElement('option');
      const { value, texto } = montarOption(item);
      option.value = value;
      option.textContent = texto;
      selectEl.appendChild(option);
    });
  } catch (err) {
    console.error(`Erro ao carregar ${url}:`, err);
  }
}

function montarQueryString() {
  const params = new URLSearchParams();

  const modulo = document.getElementById('logModulo').value;
  const idexecutor = document.getElementById('logExecutor').value;
  const idempresa = document.getElementById('logEmpresa').value;
  const idregistroalterado = document.getElementById('logIdRegistro').value;
  const dataInicio = document.getElementById('logDataInicio').value;
  const dataFim = document.getElementById('logDataFim').value;

  if (modulo) params.set('modulo', modulo);
  if (idexecutor) params.set('idexecutor', idexecutor);
  if (idempresa) params.set('idempresa', idempresa);
  if (idregistroalterado) params.set('idregistroalterado', idregistroalterado);
  if (dataInicio) params.set('dataInicio', dataInicio);
  if (dataFim) params.set('dataFim', dataFim);

  params.set('page', estado.page);
  params.set('limit', estado.limit);

  return params.toString();
}

function renderLinhas(rows) {
  const tbody = document.getElementById('logsTbody');
  tbody.innerHTML = '';

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="logs-vazio">Nenhum log encontrado para os filtros informados.</td></tr>';
    return;
  }

  rows.forEach(log => {
    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td>${formatarData(log.criado_em)}</td>
      <td>${log.empresa_nome || '-'}</td>
      <td>${log.modulo || '-'}</td>
      <td>${log.acao || '-'}</td>
      <td>${formatarNome(log.executor_nome, log.executor_sobrenome)}</td>
      <td>${log.idregistroalterado ?? '-'}</td>
      <td>${formatarNome(log.usuarioalvo_nome, log.usuarioalvo_sobrenome)}</td>
      <td><button type="button" class="btn-ver-dados">Ver dados</button></td>
    `;

    tr.querySelector('.btn-ver-dados').addEventListener('click', () => {
      Swal.fire({
        title: `Log #${log.id}`,
        width: 700,
        html: `
          <div class="logs-swal-dados">
            <h3>Dados Anteriores</h3>
            <pre>${log.dadosanteriores ? JSON.stringify(log.dadosanteriores, null, 2) : '(vazio)'}</pre>
            <h3>Dados Novos</h3>
            <pre>${log.dadosnovos ? JSON.stringify(log.dadosnovos, null, 2) : '(vazio)'}</pre>
          </div>
        `
      });
    });

    tbody.appendChild(tr);
  });
}

function atualizarPaginacao() {
  const totalPaginas = Math.max(Math.ceil(estado.total / estado.limit), 1);
  document.getElementById('logsPaginaAtual').textContent = `Página ${estado.page} de ${totalPaginas}`;
  document.getElementById('btnLogsAnterior').disabled = estado.page <= 1;
  document.getElementById('btnLogsProxima').disabled = estado.page >= totalPaginas;
  document.getElementById('logsTotalInfo').textContent = `${estado.total} registro(s) encontrado(s)`;
}

async function buscarLogs() {
  try {
    const qs = montarQueryString();
    const resultado = await fetchComToken(`/logs?${qs}`);
    estado.total = resultado.total || 0;
    renderLinhas(resultado.rows || []);
    atualizarPaginacao();
  } catch (err) {
    console.error('Erro ao buscar logs:', err);
  }
}

function limparFiltros() {
  document.getElementById('logModulo').value = '';
  document.getElementById('logExecutor').value = '';
  document.getElementById('logEmpresa').value = '';
  document.getElementById('logIdRegistro').value = '';
  document.getElementById('logDataInicio').value = '';
  document.getElementById('logDataFim').value = '';
  estado.page = 1;
  estado.total = 0;
  document.getElementById('logsTbody').innerHTML = '<tr><td colspan="8" class="logs-vazio">Use os filtros acima e clique em Buscar.</td></tr>';
  document.getElementById('logsTotalInfo').textContent = '';
  document.getElementById('logsPaginaAtual').textContent = 'Página 1';
}

async function inicializar() {
  await Promise.all([
    popularSelect('/logs/modulos', document.getElementById('logModulo'), (modulo) => ({ value: modulo, texto: modulo })),
    popularSelect('/logs/executores', document.getElementById('logExecutor'), (u) => ({
      value: u.idusuario,
      texto: formatarNome(u.nome, u.sobrenome)
    })),
    popularSelect('/logs/empresas', document.getElementById('logEmpresa'), (e) => ({
      value: e.idempresa,
      texto: e.nmfantasia
    }))
  ]);

  document.getElementById('btnBuscarLogs').addEventListener('click', () => {
    estado.page = 1;
    buscarLogs();
  });

  document.getElementById('btnLimparLogs').addEventListener('click', limparFiltros);

  document.getElementById('btnLogsAnterior').addEventListener('click', () => {
    if (estado.page > 1) {
      estado.page--;
      buscarLogs();
    }
  });

  document.getElementById('btnLogsProxima').addEventListener('click', () => {
    const totalPaginas = Math.max(Math.ceil(estado.total / estado.limit), 1);
    if (estado.page < totalPaginas) {
      estado.page++;
      buscarLogs();
    }
  });
}

inicializar();

// Registra o handler do módulo (o Index.js chama desinicializar ao fechar o modal;
// sem esse registro window.moduloHandlers fica undefined e o fecharModal quebra).
window.moduloHandlers = window.moduloHandlers || {};
window.moduloHandlers['Logs'] = {
  desinicializar: () => {}
};
