import { fetchComToken } from '../utils/utils.js';

const estado = {
  page: 1,
  limit: 50,
  total: 0,
  orderBy: 'criado_em',
  orderDir: 'desc'
};

function formatarData(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('pt-BR');
}

function formatarNome(nome, sobrenome) {
  if (!nome) return '-';
  return sobrenome ? `${nome} ${sobrenome}` : nome;
}

// ===== Autocomplete (mesmo padrão usado na busca de CBO em Funcionarios.js) =====
// Input de texto visível filtra uma lista já carregada; ao escolher, preenche o
// texto no input visível e o id no input oculto (usado nos filtros da busca).
function configurarAutocomplete(inputBusca, inputOculto, itens, montarItem) {
  const wrapper = inputBusca.parentNode;
  wrapper.style.position = 'relative';

  let lista = document.createElement('ul');
  lista.className = 'logs-autocomplete-lista';
  lista.style.cssText = 'position:absolute; left:0; right:0; top:100%; z-index:60;' +
    'background:#fff; border:1px solid #ccc; border-radius:6px; max-height:220px;' +
    'overflow-y:auto; margin:2px 0 0; padding:4px; list-style:none;' +
    'box-shadow:0 4px 12px rgba(0,0,0,.15); display:none;';
  wrapper.appendChild(lista);

  const fechar = () => { lista.style.display = 'none'; };

  function renderSugestoes(termo) {
    const termoNormalizado = termo.trim().toLowerCase();
    const filtrados = termoNormalizado
      ? itens.filter(item => montarItem(item).texto.toLowerCase().includes(termoNormalizado))
      : itens;

    lista.innerHTML = '';
    if (!filtrados.length) {
      lista.innerHTML = '<li style="padding:6px 10px; color:#999;">Nenhum resultado encontrado</li>';
      lista.style.display = 'block';
      return;
    }

    filtrados.forEach(item => {
      const { value, texto } = montarItem(item);
      const li = document.createElement('li');
      li.textContent = texto;
      li.style.cssText = 'padding:6px 10px; cursor:pointer; border-radius:4px;';
      li.addEventListener('mouseover', () => { li.style.background = '#f0f2f5'; });
      li.addEventListener('mouseout', () => { li.style.background = ''; });
      li.addEventListener('mousedown', (e) => {
        e.preventDefault();
        inputBusca.value = texto;
        inputOculto.value = value;
        fechar();
      });
      lista.appendChild(li);
    });
    lista.style.display = 'block';
  }

  inputBusca.addEventListener('input', function () {
    inputOculto.value = ''; // mudou o texto => invalida a seleção até escolher de novo
    renderSugestoes(this.value);
  });

  inputBusca.addEventListener('focus', function () { renderSugestoes(this.value); });

  document.addEventListener('mousedown', (e) => {
    if (e.target !== inputBusca && !lista.contains(e.target)) fechar();
  });
}

async function carregarListaAutocomplete(url, inputBusca, inputOculto, montarItem) {
  try {
    const dados = await fetchComToken(url);
    configurarAutocomplete(inputBusca, inputOculto, dados || [], montarItem);
  } catch (err) {
    console.error(`Erro ao carregar ${url}:`, err);
  }
}

// ===== Autocomplete remoto (mesmo padrão da busca de CBO: digita, aguarda 350ms, busca no servidor) =====
// Usado quando a lista é grande demais pra carregar inteira de uma vez (ex.: funcionários).
function configurarAutocompleteRemoto(inputBusca, inputOculto, urlBase, montarItem) {
  const wrapper = inputBusca.parentNode;
  wrapper.style.position = 'relative';

  let lista = document.createElement('ul');
  lista.className = 'logs-autocomplete-lista';
  lista.style.cssText = 'position:absolute; left:0; right:0; top:100%; z-index:60;' +
    'background:#fff; border:1px solid #ccc; border-radius:6px; max-height:220px;' +
    'overflow-y:auto; margin:2px 0 0; padding:4px; list-style:none;' +
    'box-shadow:0 4px 12px rgba(0,0,0,.15); display:none;';
  wrapper.appendChild(lista);

  const fechar = () => { lista.style.display = 'none'; };
  let debounceTimer = null;

  inputBusca.addEventListener('input', function () {
    inputOculto.value = ''; // mudou o texto => invalida a seleção até escolher de novo
    const termo = this.value.trim();
    clearTimeout(debounceTimer);
    if (termo.length < 2) { fechar(); return; }

    debounceTimer = setTimeout(async () => {
      try {
        const sugestoes = await fetchComToken(`${urlBase}?q=${encodeURIComponent(termo)}`);
        lista.innerHTML = '';
        if (!Array.isArray(sugestoes) || !sugestoes.length) {
          lista.innerHTML = '<li style="padding:6px 10px; color:#999;">Nenhum resultado encontrado</li>';
          lista.style.display = 'block';
          return;
        }
        sugestoes.forEach(item => {
          const { value, texto } = montarItem(item);
          const li = document.createElement('li');
          li.textContent = texto;
          li.style.cssText = 'padding:6px 10px; cursor:pointer; border-radius:4px;';
          li.addEventListener('mouseover', () => { li.style.background = '#f0f2f5'; });
          li.addEventListener('mouseout', () => { li.style.background = ''; });
          li.addEventListener('mousedown', (e) => {
            e.preventDefault();
            inputBusca.value = texto;
            inputOculto.value = value;
            fechar();
          });
          lista.appendChild(li);
        });
        lista.style.display = 'block';
      } catch (err) {
        console.error(`Erro ao buscar em ${urlBase}:`, err);
      }
    }, 350);
  });

  inputBusca.addEventListener('focus', () => { if (lista.children.length) lista.style.display = 'block'; });

  document.addEventListener('mousedown', (e) => {
    if (e.target !== inputBusca && !lista.contains(e.target)) fechar();
  });
}

function montarQueryString() {
  const params = new URLSearchParams();

  const modulo = document.getElementById('logModulo').value;
  const idexecutor = document.getElementById('logExecutor').value;
  const idempresa = document.getElementById('logEmpresa').value;
  const idregistroalterado = document.getElementById('logIdRegistro').value;
  const idfuncionario = document.getElementById('logIdFuncionario').value;
  const dataInicio = document.getElementById('logDataInicio').value;
  const dataFim = document.getElementById('logDataFim').value;

  if (modulo) params.set('modulo', modulo);
  if (idexecutor) params.set('idexecutor', idexecutor);
  if (idempresa) params.set('idempresa', idempresa);
  if (idregistroalterado) params.set('idregistroalterado', idregistroalterado);
  if (idfuncionario) params.set('idfuncionario', idfuncionario);
  if (dataInicio) params.set('dataInicio', dataInicio);
  if (dataFim) params.set('dataFim', dataFim);

  params.set('page', estado.page);
  params.set('limit', estado.limit);
  params.set('orderBy', estado.orderBy);
  params.set('orderDir', estado.orderDir);

  return params.toString();
}

function atualizarIndicadoresOrdenacao() {
  document.querySelectorAll('#tabelaLogs .th-sort').forEach(th => {
    th.classList.remove('th-sort-asc', 'th-sort-desc');
    if (th.dataset.sort === estado.orderBy) {
      th.classList.add(estado.orderDir === 'asc' ? 'th-sort-asc' : 'th-sort-desc');
    }
  });
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
  document.getElementById('logModuloBusca').value = '';
  document.getElementById('logExecutor').value = '';
  document.getElementById('logExecutorBusca').value = '';
  document.getElementById('logEmpresa').value = '';
  document.getElementById('logEmpresaBusca').value = '';
  document.getElementById('logIdRegistro').value = '';
  document.getElementById('logIdFuncionario').value = '';
  document.getElementById('logFuncionarioBusca').value = '';
  document.getElementById('logDataInicio').value = '';
  document.getElementById('logDataFim').value = '';
  estado.page = 1;
  estado.total = 0;
  estado.orderBy = 'criado_em';
  estado.orderDir = 'desc';
  atualizarIndicadoresOrdenacao();
  document.getElementById('logsTbody').innerHTML = '<tr><td colspan="8" class="logs-vazio">Use os filtros acima e clique em Buscar.</td></tr>';
  document.getElementById('logsTotalInfo').textContent = '';
  document.getElementById('logsPaginaAtual').textContent = 'Página 1';
}

async function inicializar() {
  await Promise.all([
    carregarListaAutocomplete(
      '/logs/modulos',
      document.getElementById('logModuloBusca'),
      document.getElementById('logModulo'),
      (modulo) => ({ value: modulo, texto: modulo })
    ),
    carregarListaAutocomplete(
      '/logs/executores',
      document.getElementById('logExecutorBusca'),
      document.getElementById('logExecutor'),
      (u) => ({ value: u.idusuario, texto: formatarNome(u.nome, u.sobrenome) })
    ),
    carregarListaAutocomplete(
      '/logs/empresas',
      document.getElementById('logEmpresaBusca'),
      document.getElementById('logEmpresa'),
      (e) => ({ value: e.idempresa, texto: e.nmfantasia })
    )
  ]);

  configurarAutocompleteRemoto(
    document.getElementById('logFuncionarioBusca'),
    document.getElementById('logIdFuncionario'),
    '/logs/funcionarios',
    (f) => ({ value: f.idfuncionario, texto: formatarNome(f.nome, f.apelido ? `(${f.apelido})` : '') })
  );

  document.getElementById('btnBuscarLogs').addEventListener('click', () => {
    estado.page = 1;
    buscarLogs();
  });

  document.querySelectorAll('#tabelaLogs .th-sort').forEach(th => {
    th.addEventListener('click', () => {
      const coluna = th.dataset.sort;
      if (estado.orderBy === coluna) {
        estado.orderDir = estado.orderDir === 'asc' ? 'desc' : 'asc';
      } else {
        estado.orderBy = coluna;
        estado.orderDir = 'asc';
      }
      estado.page = 1;
      atualizarIndicadoresOrdenacao();
      buscarLogs();
    });
  });

  atualizarIndicadoresOrdenacao();

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
window.moduloHandlers['ConsultaLogs'] = {
  desinicializar: () => {}
};
