
import { fetchComToken } from '../utils/utils.js';
//
// As alíquotas de CBS/IBS/retenções de serviço NÃO ficam fixas no código —
// vêm da tabela `aliquotasnf` (aba "Parâmetros" desta mesma tela), porque
// mudam por lei todo ano até 2033 (Reforma Tributária).

let parametrosFiscais = null; // { ano, cbsaliq, ibsaliq, irrfservicoaliq, piscofinscsllservicoaliq }
let parcelasDoOrcamentoAtual = []; // parcelas do orçamento aberto na aba "Emitir nota" (vazio = à vista)
let dadosBancariosEmissoraAtual = null; // banco/agência/conta/PIX da empresa emissora do orçamento aberto (ver atualizarDadosBancarios)

const moeda = (el) => {
  if (!el || el.value.trim() === '') return 0;
  const n = window.desformatarReais(el.value);
  return n === '' || n == null ? 0 : n;
};
const fmtMoeda = (n) => 'R$ ' + window.formatarReaisValor(n || 0);
const fmtPct = (frac) => ((Number(frac) || 0) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';

// Só pra valores colocados dentro de atributo HTML (ex.: title="...") — aqui
// aspas duplas sem escapar fecham o atributo antes da hora e quebram a linha.
const escaparAtributo = (texto) => String(texto ?? '').replace(/"/g, '&quot;');

// Razão social + nome fantasia entre parênteses (quando existe e é diferente
// da razão social — evita "Nome (Nome)" redundante quando são iguais).
const nomeClienteComFantasia = (razaoSocial, nomeFantasia) => {
  if (!razaoSocial) return nomeFantasia || '';
  if (!nomeFantasia || nomeFantasia === razaoSocial) return razaoSocial;
  return `${razaoSocial} (${nomeFantasia})`;
};

function formatarDataBR(dataStr) {
  if (!dataStr) return '—';
  const d = new Date(dataStr);
  return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

function converterDataBRParaISO(dataBR) {
  if (!dataBR || !dataBR.includes('/')) return null;
  const [d, m, a] = dataBR.split('/');
  if (!d || !m || !a) return null;
  return `${a}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

// Máscara de digitação dd/mm/aaaa — mesmo padrão usado nas parcelas do
// Orçamento (Orcamentos.js), sem flatpickr aqui: campo simples, só corrige
// vencimento já existente antes de emitir.
function mascararDataDigitada(input) {
  const digitos = input.value.replace(/\D/g, '').slice(0, 8);
  if (digitos.length > 4) {
    input.value = `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`;
  } else if (digitos.length > 2) {
    input.value = `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
  } else {
    input.value = digitos;
  }
}

function aviso(icon, title, text) {
  if (window.Swal) return Swal.fire({ icon, title, text });
  alert(`${title}\n${text || ''}`);
}

// ---- Abas ----
function mudarAba(nome) {
  document.querySelectorAll('#cadModalNotaFiscal .nf-tab-btn').forEach((b) =>
    b.classList.toggle('ativa', b.dataset.nfTab === nome));
  document.querySelectorAll('#cadModalNotaFiscal .nf-view').forEach((v) =>
    v.classList.toggle('ativa', v.id === `nfView${nome.charAt(0).toUpperCase()}${nome.slice(1)}`));

  // Trocar de aba não reseta o scroll do form sozinho — quem clicava
  // "Emitir nota" vindo de mais embaixo na lista de pendentes caía na
  // nova aba já rolado pro meio, no ponto onde a rolagem estava antes.
  const formNotaFiscal = document.getElementById('form-notafiscal');
  if (formNotaFiscal) formNotaFiscal.scrollTop = 0;

  // Recarrega sempre que entra na aba — pode ter registrado/cancelado uma
  // nota na aba "Emitir nota" desde a última vez que olhou aqui.
  if (nome === 'envio') carregarProntasParaEnvio();
}

// ---- Aba 1: orçamentos pendentes de faturamento ----
let filtrosPendentesPopulados = false; // selects de Cliente/Evento/Empresa emissora só são
                                        // montados uma vez, a partir da 1ª carga (sem filtro) —
                                        // senão um filtro aplicado "encolheria" as próprias opções
let pendentesTodosParaFiltro = []; // cópia completa (sem filtro) só pra cruzar Cliente<->Evento

function opcoesUnicasOrdenadas(lista, chaveId, chaveNome) {
  const mapa = new Map();
  lista.forEach((o) => {
    if (o[chaveId] != null && !mapa.has(o[chaveId])) mapa.set(o[chaveId], o[chaveNome] || `#${o[chaveId]}`);
  });
  return [...mapa.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
}

// valorParaManter: se ainda estiver entre as novas opções, continua selecionado;
// senão volta pra "Todos/Todas" (evita ficar com um valor que não existe mais).
function preencherSelectFiltro(idSelect, opcoes, rotuloTodos, valorParaManter) {
  const select = document.getElementById(idSelect);
  const aindaExiste = valorParaManter && opcoes.some(([id]) => String(id) === String(valorParaManter));
  select.innerHTML = `<option value="">${rotuloTodos}</option>` +
    opcoes.map(([id, nome]) => `<option value="${id}">${nome}</option>`).join('');
  select.value = aindaExiste ? valorParaManter : '';
}

// ---- Combobox "digitar pra buscar" (Cliente/Evento) — mesmo padrão da busca
// de funcionário no RH: input de texto + input escondido com o id de verdade
// + <ul> de sugestões filtradas ao vivo enquanto digita. `prefixo` é
// "Cliente" ou "Evento" e bate com os ids nfBusca{prefixo}/nfFiltro{prefixo}/nfLista{prefixo}.

// Troca as opções disponíveis pro combo (cruzamento Cliente<->Evento ou
// "Limpar filtros"). valorParaManter: mantém selecionado se ainda existir
// entre as novas opções; senão volta pra "Todos".
function preencherComboFiltro(prefixo, opcoes, valorParaManter) {
  const input = document.getElementById(`nfBusca${prefixo}`);
  const hidden = document.getElementById(`nfFiltro${prefixo}`);
  const lista = document.getElementById(`nfLista${prefixo}`);
  lista._opcoesCombo = opcoes; // fonte usada pelo filtro ao digitar (ver renderizarListaCombo)

  const encontrada = valorParaManter && opcoes.find(([id]) => String(id) === String(valorParaManter));
  hidden.value = encontrada ? valorParaManter : '';
  input.value = encontrada ? encontrada[1] : '';
  lista.classList.remove('aberta');
}

function renderizarListaCombo(prefixo, termo) {
  const lista = document.getElementById(`nfLista${prefixo}`);
  const opcoes = lista._opcoesCombo || [];
  const termoNorm = (termo || '').trim().toLowerCase();
  const filtradas = termoNorm ? opcoes.filter(([, nome]) => nome.toLowerCase().includes(termoNorm)) : opcoes;

  lista.innerHTML = '';
  if (!filtradas.length) {
    const vazio = document.createElement('li');
    vazio.className = 'nf-combo-vazio';
    vazio.textContent = 'Nenhum resultado';
    lista.appendChild(vazio);
  } else {
    filtradas.forEach(([id, nome]) => {
      const li = document.createElement('li');
      li.dataset.id = id;
      li.textContent = nome;
      lista.appendChild(li);
    });
  }
  lista.classList.add('aberta');
}

// Liga os eventos do combo uma única vez (na montagem da tela). `aoSelecionar`
// é chamado quando o usuário efetivamente escolhe algo (clique numa opção)
// ou limpa o campo de vez — nunca a cada tecla digitada, só numa decisão real.
function ligarComboFiltro(prefixo, aoSelecionar) {
  const input = document.getElementById(`nfBusca${prefixo}`);
  const hidden = document.getElementById(`nfFiltro${prefixo}`);
  const lista = document.getElementById(`nfLista${prefixo}`);

  input.addEventListener('input', () => {
    hidden.value = ''; // digitou algo diferente do que tinha escolhido -> invalida até clicar de novo
    renderizarListaCombo(prefixo, input.value);
    if (!input.value.trim()) aoSelecionar();
  });
  input.addEventListener('focus', () => renderizarListaCombo(prefixo, input.value));

  lista.addEventListener('mousedown', (e) => {
    const li = e.target.closest('li[data-id]');
    if (!li) return;
    e.preventDefault(); // antes do blur do input, senão a lista some antes do clique registrar
    hidden.value = li.dataset.id;
    input.value = li.textContent;
    lista.classList.remove('aberta');
    aoSelecionar();
  });

  document.addEventListener('mousedown', (e) => {
    if (e.target !== input && !lista.contains(e.target)) lista.classList.remove('aberta');
  });
}

// Cruzamento Cliente <-> Evento: escolher um restringe as opções do outro aos
// que aparecem juntos em algum orçamento pendente (ex.: cliente só mostra os
// eventos que ele realmente fez). Só atualiza o combo OPOSTO ao que mudou —
// nunca o que o usuário acabou de mexer, senão a própria seleção dele podia
// sumir da lista que ele está olhando.
function aoMudarClienteFiltro() {
  const idCliente = document.getElementById('nfFiltroCliente').value;
  const idEventoAtual = document.getElementById('nfFiltroEvento').value;
  const base = idCliente
    ? pendentesTodosParaFiltro.filter((o) => String(o.idcliente) === idCliente)
    : pendentesTodosParaFiltro;
  preencherComboFiltro('Evento', opcoesUnicasOrdenadas(base, 'idevento', 'evento_nome'), idEventoAtual);
}

function aoMudarEventoFiltro() {
  const idEvento = document.getElementById('nfFiltroEvento').value;
  const idClienteAtual = document.getElementById('nfFiltroCliente').value;
  const base = idEvento
    ? pendentesTodosParaFiltro.filter((o) => String(o.idevento) === idEvento)
    : pendentesTodosParaFiltro;
  preencherComboFiltro('Cliente', opcoesUnicasOrdenadas(base, 'idcliente', 'cliente_nome'), idClienteAtual);
}

function montarQueryFiltrosPendentes() {
  const params = new URLSearchParams();
  const idcliente = document.getElementById('nfFiltroCliente').value;
  const idevento = document.getElementById('nfFiltroEvento').value;
  const idempresaemissora = document.getElementById('nfFiltroEmpresaEmissora').value;
  const dtRealizacaoDe = converterDataBRParaISO(document.getElementById('nfFiltroRealizacaoDe').value.trim());
  const dtRealizacaoAte = converterDataBRParaISO(document.getElementById('nfFiltroRealizacaoAte').value.trim());
  const dtVencimentoDe = converterDataBRParaISO(document.getElementById('nfFiltroVencimentoDe').value.trim());
  const dtVencimentoAte = converterDataBRParaISO(document.getElementById('nfFiltroVencimentoAte').value.trim());

  if (idcliente) params.set('idcliente', idcliente);
  if (idevento) params.set('idevento', idevento);
  if (idempresaemissora) params.set('idempresaemissora', idempresaemissora);
  if (dtRealizacaoDe) params.set('dtRealizacaoDe', dtRealizacaoDe);
  if (dtRealizacaoAte) params.set('dtRealizacaoAte', dtRealizacaoAte);
  if (dtVencimentoDe) params.set('dtVencimentoDe', dtVencimentoDe);
  if (dtVencimentoAte) params.set('dtVencimentoAte', dtVencimentoAte);
  return params.toString();
}

// Monta os selects de Cliente/Evento/Empresa emissora a partir dos orçamentos
// pendentes existentes (evita depender de permissão em outros módulos pra
// buscar listas completas de clientes/eventos/empresas).
function popularFiltrosPendentes(lista) {
  if (filtrosPendentesPopulados) return;
  filtrosPendentesPopulados = true;
  pendentesTodosParaFiltro = lista;

  preencherComboFiltro('Cliente', opcoesUnicasOrdenadas(lista, 'idcliente', 'cliente_nome'));
  preencherComboFiltro('Evento', opcoesUnicasOrdenadas(lista, 'idevento', 'evento_nome'));
  preencherSelectFiltro('nfFiltroEmpresaEmissora', opcoesUnicasOrdenadas(lista, 'idempresaemissora', 'emissora_nome'), 'Todas');
}

function limparFiltrosPendentes() {
  // Cliente/Evento não é só zerar o valor — o cruzamento pode ter encolhido
  // as opções de um deles, então as listas completas voltam também.
  preencherComboFiltro('Cliente', opcoesUnicasOrdenadas(pendentesTodosParaFiltro, 'idcliente', 'cliente_nome'));
  preencherComboFiltro('Evento', opcoesUnicasOrdenadas(pendentesTodosParaFiltro, 'idevento', 'evento_nome'));
  document.getElementById('nfFiltroEmpresaEmissora').value = '';
  ['nfFiltroRealizacaoDe', 'nfFiltroRealizacaoAte', 'nfFiltroVencimentoDe', 'nfFiltroVencimentoAte'].forEach((id) => {
    document.getElementById(id).value = '';
  });
  carregarPendentes();
}

async function carregarPendentes() {
  const tbody = document.getElementById('nfTabelaPendentesBody');
  tbody.innerHTML = '<tr><td colspan="9">Carregando...</td></tr>';

  try {
    const query = montarQueryFiltrosPendentes();
    const lista = await fetchComToken(`/notafiscal/pendentes${query ? '?' + query : ''}`);
    popularFiltrosPendentes(lista);
    if (!lista.length) {
      tbody.innerHTML = '<tr><td colspan="9">Nenhum orçamento fechado com saldo a faturar para os filtros selecionados.</td></tr>';
      return;
    }
    tbody.innerHTML = '';
    lista.forEach((o) => {
      const saldo = parseFloat(o.saldo) || 0;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${o.nrorcamento}</td>
        <td>${nomeClienteComFantasia(o.cliente_nome, o.cliente_nmfantasia) || '—'}</td>
        <td>${o.evento_nome || '—'}</td>
        <td>${formatarDataBR(o.dtinirealizacao)}${o.dtfimrealizacao ? ' – ' + formatarDataBR(o.dtfimrealizacao) : ''}</td>
        <td>${o.proximovencimento ? formatarDataBR(o.proximovencimento) : '—'}</td>
        <td class="nf-num">${fmtMoeda(o.vlrcliente)}</td>
        <td class="nf-num">${fmtMoeda(o.faturado)}</td>
        <td class="nf-num">${fmtMoeda(saldo)}</td>
        <td>${saldo > 0.009
            ? `<button type="button" class="nf-row-btn" data-idorcamento="${o.idorcamento}">Emitir nota</button>`
            : '<span class="nf-chip emitida">Faturado</span>'}</td>`;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.nf-row-btn').forEach((btn) => {
      btn.addEventListener('click', () => abrirEmissaoParaOrcamento(btn.dataset.idorcamento));
    });
  } catch (err) {
    console.error('Erro ao carregar orçamentos pendentes:', err);
    tbody.innerHTML = '<tr><td colspan="9">Erro ao carregar orçamentos.</td></tr>';
  }
}

// ---- Cadastro de serviços da empresa (select) ----
async function carregarServicosSelect() {
  const select = document.getElementById('nfServicoSelect');
  try {
    const servicos = await fetchComToken('/servicos?ativo=true');
    if (!servicos.length) {
      select.innerHTML = '<option value="">Nenhum serviço cadastrado — cadastre em Serviços</option>';
      return;
    }
    select.innerHTML = servicos.map((s) =>
      `<option value="${s.idservico}" data-aliquota="${s.aliquotaissref || ''}">${s.codigoservico} — ${s.descricao}</option>`
    ).join('');

    // Sugere a alíquota de ISS de referência cadastrada no serviço selecionado.
    select.onchange = () => {
      const opt = select.selectedOptions[0];
      const aliq = opt?.dataset.aliquota;
      if (aliq) {
        document.getElementById('nfAliquotaIss').value = aliq;
        recalcularTributos();
      }
    };
    select.dispatchEvent(new Event('change'));
  } catch (err) {
    console.error('Erro ao carregar cadastro de serviços:', err);
    select.innerHTML = '<option value="">Erro ao carregar serviços</option>';
  }
}

// ---- Parcelas do orçamento (só existe quando o orçamento é parcelado —
// definidas na tela de Orçamento, no fechamento) ----
async function carregarParcelasNota(idorcamento) {
  const secao = document.getElementById('nfSecaoParcelas');
  const tbody = document.getElementById('nfParcelasBody');
  document.getElementById('nfIdParcelaAtual').value = '';
  document.getElementById('nfCampoParcelaNum').style.display = 'none';
  document.getElementById('nfCampoParcelaVencimento').style.display = 'none';

  try {
    parcelasDoOrcamentoAtual = await fetchComToken(`/notafiscal/orcamento/${idorcamento}/parcelas`);
  } catch (err) {
    console.error('Erro ao carregar parcelas do orçamento:', err);
    parcelasDoOrcamentoAtual = [];
  }

  if (!parcelasDoOrcamentoAtual.length) {
    secao.style.display = 'none';
    tbody.innerHTML = '';
    return;
  }

  secao.style.display = 'block';
  const chipClasse = { Aberta: 'rascunho', Faturada: 'emitida', Cancelada: 'cancelada' };
  tbody.innerHTML = parcelasDoOrcamentoAtual.map((p) => {
    // Parcela continua "Aberta" enquanto a nota não é confirmada Emitida
    // (de propósito — ver rotaNotaFiscal), mas já pode ter uma nota "XML
    // Gerada" pendente vinculada. Nesse caso trava o botão (mostra o
    // status da nota, não deixa clicar de novo) pra não duplicar registro.
    let botao = '';
    if (p.status === 'Aberta') {
      botao = p.notaativaid
        ? `<button type="button" class="nf-row-btn" disabled title="Esta parcela já tem uma nota registrada">${p.notaativastatus}</button>
           <button type="button" class="nf-link" data-idnotafiscal="${p.notaativaid}" title="Gera o XML do RPS (ainda sem assinatura digital)">Baixar XML</button>`
        : `<button type="button" class="nf-row-btn" data-idparcela="${p.idparcela}">Selecionar</button>`;
    }
    return `
    <tr>
      <td>${p.numparcela}</td>
      <td>${p.descricao || '—'}</td>
      <td class="nf-num">${fmtMoeda(p.vlrparcela)}</td>
      <td>${p.dtvencimento ? formatarDataBR(p.dtvencimento) : '—'}</td>
      <td><span class="nf-chip ${chipClasse[p.status] || 'rascunho'}">${p.status}</span></td>
      <td>${botao}</td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('[data-idparcela]').forEach((btn) => {
    btn.addEventListener('click', () => selecionarParcela(btn.dataset.idparcela));
  });
  tbody.querySelectorAll('[data-idnotafiscal]').forEach((btn) => {
    btn.addEventListener('click', () => baixarXmlNota(btn.dataset.idnotafiscal, idorcamento));
  });
}

// Gera (no backend, na hora) e baixa o XML do RPS dessa nota. Ainda sem
// assinatura digital (falta o certificado A1) — serve só de conferência por
// enquanto, não pode ser subido de verdade no portal da prefeitura.
// idorcamento é opcional, só pra recarregar as tabelas que dependem do
// arquivoxml recém-salvo (senão o link "Ver XML" só aparece depois de trocar
// de aba — o usuário pode achar que não gerou nada).
async function baixarXmlNota(idnotafiscal, idorcamento) {
  try {
    const xml = await fetchComToken(`/notafiscal/${idnotafiscal}/xml`);
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RPS-${idnotafiscal}.xml`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    if (idorcamento) {
      await renderHistorico(idorcamento);
      await carregarParcelasNota(idorcamento);
    }
    await atualizarProntasParaEnvioSeVisivel();
  } catch (err) {
    console.error('Erro ao gerar XML da nota:', err);
    aviso('error', 'Erro ao gerar XML', err?.message || 'Não foi possível gerar o XML desta nota.');
  }
}

// idorcamento é opcional em todas as ações abaixo: quando a ação parte da
// aba "Notas registradas" (dentro de um orçamento aberto), ele existe e
// recarrega o histórico daquele orçamento; quando parte da aba "Prontas
// para Envio" (que mistura notas de vários orçamentos), ele não existe —
// só a lista de prontas para envio é atualizada nesse caso.
async function atualizarProntasParaEnvioSeVisivel() {
  if (document.getElementById('nfEnvioBody')) await carregarProntasParaEnvio();
}

// ---- Aba "Prontas para Envio" ----
let notasProntasParaEnvioCache = [];

async function carregarProntasParaEnvio() {
  const tbody = document.getElementById('nfEnvioBody');
  tbody.innerHTML = '<tr><td colspan="9">Carregando...</td></tr>';
  document.getElementById('nfEnvioMarcarTodas').checked = false;

  try {
    const notas = await fetchComToken('/notafiscal/prontas-envio');
    notasProntasParaEnvioCache = notas;

    const filtroSelect = document.getElementById('nfEnvioFiltroEmpresa');
    const valorFiltroAtual = filtroSelect.value;
    preencherSelectFiltro('nfEnvioFiltroEmpresa', opcoesUnicasOrdenadas(notas, 'idempresaemissora', 'emissora_nome'), 'Todas', valorFiltroAtual);

    renderizarNotasProntasParaEnvio();
  } catch (err) {
    console.error('Erro ao carregar notas prontas para envio:', err);
    tbody.innerHTML = '<tr><td colspan="9">Erro ao carregar notas.</td></tr>';
  }
}

// Refiltra/redesenha a partir do cache já buscado — trocar o filtro de
// empresa emissora não precisa ir no servidor de novo, os dados já estão
// todos aqui (é só a mesma lista de sempre, filtrada na hora).
function renderizarNotasProntasParaEnvio() {
  const tbody = document.getElementById('nfEnvioBody');
  const idEmpresaFiltro = document.getElementById('nfEnvioFiltroEmpresa').value;
  const notas = idEmpresaFiltro
    ? notasProntasParaEnvioCache.filter((n) => String(n.idempresaemissora) === idEmpresaFiltro)
    : notasProntasParaEnvioCache;

  try {
    if (!notas.length) {
      tbody.innerHTML = `<tr><td colspan="9">Nenhuma nota Pronta para Envio${idEmpresaFiltro ? ' para essa empresa emissora' : ''} no momento.</td></tr>`;
      atualizarContagemEnvio();
      return;
    }
    // Toda linha aqui já é "Pronta para Envio" por definição da consulta —
    // Marcar emitida/Cancelar aparecem sempre, sem precisar checar status
    // (diferente de "Notas registradas", que mistura vários status juntos).
    tbody.innerHTML = notas.map((n) => `
      <tr>
        <td><input type="checkbox" class="nf-envio-check" data-id="${n.idnotafiscal}" ${n.pendencia ? `disabled title="${escaparAtributo(n.pendencia.mensagem)}"` : ''}></td>
        <td>${n.nrorcamento}</td>
        <td>
          ${nomeClienteComFantasia(n.cliente_nome, n.cliente_nmfantasia) || '—'}
          ${!n.cliente_inscricaomunicipal ? `<br><span class="nf-chip rascunho" title="Preencha na tela de Emitir Nota ou direto no cadastro de Clientes">Falta Insc. Municipal</span>` : ''}
          ${n.pendencia ? `<br><span class="nf-chip bloqueio" title="${escaparAtributo(n.pendencia.mensagem)}">${escaparAtributo(n.pendencia.curto)}</span>` : ''}
        </td>
        <td${n.descricaoservico ? ` title="${escaparAtributo(n.descricaoservico)}"` : ''}>${n.descricaoservico ? n.descricaoservico.slice(0, 50) + '…' : '—'}</td>
        <td>${n.numparcela ? `${n.numparcela}/${n.totalparcelas}` : '—'}</td>
        <td>${n.dtvencimento ? formatarDataBR(n.dtvencimento) : '—'}</td>
        <td class="nf-num">${fmtMoeda(n.valorservico)}</td>
        <td>${n.emissora_nome || '—'}</td>
        <td>
          <button type="button" class="nf-link" data-marcar="${n.idnotafiscal}">Marcar emitida</button>
          <button type="button" class="nf-link" data-cancelar="${n.idnotafiscal}">Cancelar</button>
          ${n.arquivoxml ? `<a class="nf-link nf-link-ok" href="/${n.arquivoxml}" target="_blank" title="Abre o último XML gerado, sem gerar de novo">Ver XML</a>` : ''}
          <button type="button" class="nf-link" data-idnotafiscal="${n.idnotafiscal}" title="${n.arquivoxml ? 'Gera de novo (sobrescreve o atual) — use se algum dado mudou' : 'Gera o XML do RPS individual desta nota'}">${n.arquivoxml ? 'Gerar XML novamente' : 'Baixar XML individual'}</button>
          ${n.arquivopdf ? `<a class="nf-link" href="/${n.arquivopdf}" target="_blank">Ver PDF</a>` : `<button type="button" class="nf-link" data-anexar="${n.idnotafiscal}">Anexar PDF</button>`}
        </td>
      </tr>`).join('');

    tbody.querySelectorAll('[data-marcar]').forEach((btn) => {
      btn.addEventListener('click', () => marcarComoEmitida(btn.dataset.marcar));
    });
    tbody.querySelectorAll('[data-cancelar]').forEach((btn) => {
      btn.addEventListener('click', () => cancelarNota(btn.dataset.cancelar));
    });
    tbody.querySelectorAll('[data-idnotafiscal]').forEach((btn) => {
      btn.addEventListener('click', () => baixarXmlNota(btn.dataset.idnotafiscal));
    });
    tbody.querySelectorAll('[data-anexar]').forEach((btn) => {
      btn.addEventListener('click', () => anexarPdf(btn.dataset.anexar));
    });

    tbody.querySelectorAll('.nf-envio-check').forEach((chk) => {
      chk.addEventListener('change', atualizarContagemEnvio);
    });
    atualizarContagemEnvio();
  } catch (err) {
    console.error('Erro ao carregar notas prontas para envio:', err);
    tbody.innerHTML = '<tr><td colspan="9">Erro ao carregar notas.</td></tr>';
  }
}

function atualizarContagemEnvio() {
  const total = document.querySelectorAll('.nf-envio-check:not(:disabled)').length;
  const marcadas = document.querySelectorAll('.nf-envio-check:checked').length;
  document.getElementById('nfEnvioContagem').textContent =
    `${marcadas} nota${marcadas === 1 ? '' : 's'} selecionada${marcadas === 1 ? '' : 's'}`;

  const marcarTodas = document.getElementById('nfEnvioMarcarTodas');
  marcarTodas.checked = total > 0 && marcadas === total;
  marcarTodas.indeterminate = marcadas > 0 && marcadas < total;
}

// Resume erros/alertas do retorno do Web Service num texto legível — cada
// item já vem com Codigo/Descricao (e o número do RPS quando é específico de
// uma nota, que pra nós é o próprio idnotafiscal).
function resumirEventos(eventos) {
  if (!eventos || !eventos.length) return '';
  return eventos
    .map((e) => `${e.numeroRps ? `Nota #${e.numeroRps}: ` : ''}${e.descricao || `Código ${e.codigo}`}`)
    .join('\n');
}

// Testar/Enviar de verdade compartilham a mesma chamada — só muda o `teste`
// no body e o texto de confirmação/resultado. TesteEnvioLoteRPS não tem
// nenhum efeito colateral na prefeitura (não substitui RPS por NF-e), então
// não precisa de confirmação prévia; "Enviar direto" precisa, porque é real.
async function enviarLote(teste) {
  const ids = [...document.querySelectorAll('.nf-envio-check:checked')].map((chk) => Number(chk.dataset.id));
  if (!ids.length) {
    return aviso('warning', 'Nenhuma nota selecionada', 'Marque ao menos uma nota pra enviar.');
  }

  if (!teste) {
    const confirmacao = await Swal.fire({
      icon: 'warning',
      title: 'Enviar de verdade?',
      text: `Isso vai enviar ${ids.length} nota(s) pra prefeitura de verdade — se aceito, substitui o RPS pela NF-e (não dá pra desfazer). Recomendado só depois de "Testar envio" ter dado certo.`,
      showCancelButton: true,
      confirmButtonText: 'Sim, enviar',
      cancelButtonText: 'Cancelar'
    });
    if (!confirmacao.isConfirmed) return;
  }

  const botao = document.getElementById(teste ? 'nfBtnTestarEnvio' : 'nfBtnEnviarDireto');
  botao.disabled = true;

  try {
    const resultado = await fetchComToken('/notafiscal/xml-lote/enviar', {
      method: 'POST',
      body: { idsNotasFiscais: ids, teste }
    });

    if (resultado.tipo === 'sucesso') {
      const numeros = (resultado.notas || []).map((n) => `Nota #${n.numeroRps}: NF-e ${n.numeroNFe}`).join('\n');
      await Swal.fire({
        icon: 'success',
        title: teste ? 'Validação OK' : 'Enviado com sucesso',
        text: teste
          ? 'A prefeitura aceitaria esse lote — nenhum RPS foi substituído de verdade (foi só o teste).'
          : (numeros || 'Lote aceito pela prefeitura.')
      });
    } else if (resultado.tipo === 'rejeitado') {
      await Swal.fire({
        icon: 'error',
        title: 'Rejeitado pela prefeitura',
        text: resumirEventos(resultado.erros) || resultado.mensagem
      });
    } else {
      // 'incerto' ou 'falha_soap' — não sabemos (ou sabemos que nem chegou a
      // ser avaliado). Nunca tratar como sucesso silencioso.
      await Swal.fire({
        icon: 'warning',
        title: 'Não deu pra confirmar',
        text: resultado.mensagem || 'Não foi possível confirmar o resultado do envio — confira manualmente antes de tentar de novo.'
      });
    }

    if (resultado.alertas?.length) {
      aviso('info', 'Alertas da prefeitura', resumirEventos(resultado.alertas));
    }

    if (!teste) await atualizarProntasParaEnvioSeVisivel();
  } catch (err) {
    console.error('Erro ao enviar lote pro Web Service:', err);
    aviso('error', 'Erro ao enviar', err?.message || 'Não foi possível enviar o lote.');
  } finally {
    botao.disabled = false;
  }
}

function selecionarParcela(idparcela) {
  const parcela = parcelasDoOrcamentoAtual.find((p) => String(p.idparcela) === String(idparcela));
  if (!parcela) return;

  document.getElementById('nfIdParcelaAtual').value = parcela.idparcela;
  document.getElementById('nfValorServico').value = fmtMoeda(parcela.vlrparcela);

  document.getElementById('nfCampoParcelaNum').style.display = 'flex';
  document.getElementById('nfParcelaSelecionadaNum').value = `Parcela ${parcela.numparcela}${parcela.descricao ? ' — ' + parcela.descricao : ''}`;

  document.getElementById('nfCampoParcelaVencimento').style.display = 'flex';
  document.getElementById('nfParcelaVencimento').value = parcela.dtvencimento ? formatarDataBR(parcela.dtvencimento) : '';

  recalcularTributos();

  // Trava visualmente qual foi selecionada — reabilita o botão de qualquer
  // outra que estava travada antes (troca de seleção).
  document.querySelectorAll('#nfParcelasBody [data-idparcela]').forEach((btn) => {
    const ehSelecionada = String(btn.dataset.idparcela) === String(idparcela);
    btn.disabled = ehSelecionada;
    btn.textContent = ehSelecionada ? 'Selecionada' : 'Selecionar';
  });
}

// ---- Aba 2: abrir emissão a partir de um orçamento ----
async function abrirEmissaoParaOrcamento(idorcamento) {
  mudarAba('emissao');

  try {
    const dados = await fetchComToken(`/notafiscal/orcamento/${idorcamento}`);

    document.getElementById('nfIdOrcamentoAtual').value = dados.idorcamento;
    document.getElementById('nfIdClienteAtual').value = dados.idcliente || '';

    document.getElementById('nfOrigemOrcamento').textContent = `Nº ${dados.nrorcamento}`;
    document.getElementById('nfOrigemEvento').textContent = dados.nmevento || '—';
    document.getElementById('nfOrigemRealizacao').textContent =
      `${formatarDataBR(dados.dtinirealizacao)}${dados.dtfimrealizacao ? ' – ' + formatarDataBR(dados.dtfimrealizacao) : ''}`;
    document.getElementById('nfOrigemValor').textContent = fmtMoeda(dados.vlrcliente);
    document.getElementById('nfOrigemCondicao').textContent = dados.formapagamento || '—';

    document.getElementById('nfClienteRazao').value = dados.razaosocial || '';
    document.getElementById('nfClienteFantasia').value = dados.cliente_nmfantasia || '';
    document.getElementById('nfClienteCnpj').value = dados.cnpj || '';
    document.getElementById('nfClienteEmail').value = dados.emailnfe || '';
    document.getElementById('nfClienteEndereco').value =
      [dados.rua, dados.numero, dados.complemento, dados.bairro, dados.cidade, dados.estado]
        .filter(Boolean).join(', ');

    const campoInscMun = document.getElementById('nfClienteInscMun');
    campoInscMun.value = dados.inscricaomunicipal || '';
    document.getElementById('nfAvisoInscMun').style.display = dados.inscricaomunicipal ? 'none' : 'block';

    document.getElementById('nfIdMontagemAtual').value = dados.idmontagem || '';
    document.getElementById('nfMontagemDesc').value = dados.descmontagem || '—';
    document.getElementById('cep').value = dados.montagem_cep || '';
    document.getElementById('rua').value = dados.montagem_rua || '';
    document.getElementById('nfMontagemNumero').value = dados.montagem_numero || '';
    document.getElementById('bairro').value = dados.montagem_bairro || '';
    // Cidade/UF/país não aparecem na tela (são os campos escondidos que
    // Formataçoes.js/preencherEndereco usa) — só ficam guardados pra
    // reenviar junto no PATCH sem sobrescrever com vazio; só mudam de
    // verdade se o usuário digitar um CEP novo (buscarCEP corrige os dois).
    document.getElementById('cidade').value = dados.montagem_cidade || '';
    document.getElementById('estado').value = dados.montagem_uf || '';
    document.getElementById('pais').value = dados.montagem_cidade ? 'Brasil' : '';
    const enderecoMontagemCompleto = dados.montagem_rua && dados.montagem_numero && dados.montagem_bairro && dados.montagem_cep;
    document.getElementById('nfAvisoMontagem').style.display = (dados.idmontagem && !enderecoMontagemCompleto) ? 'block' : 'none';

    dadosBancariosEmissoraAtual = {
      nome: dados.emissora_nome,
      banconome: dados.emissora_banconome,
      bancocodigo: dados.emissora_bancocodigo,
      agencia: dados.emissora_agencia,
      digitoagencia: dados.emissora_digitoagencia,
      numeroconta: dados.emissora_numeroconta,
      digitoconta: dados.emissora_digitoconta,
      tipoconta: dados.emissora_tipoconta,
      pix: dados.emissora_pix,
    };
    atualizarDadosBancarios();

    document.getElementById('nfDescricaoServico').value =
      `Nota fiscal referente ao contrato operacional do evento "${dados.nmevento || ''}"` +
      (dados.dtinirealizacao ? `, realizado em ${formatarDataBR(dados.dtinirealizacao)}` : '') +
      `, conforme condições do Orçamento Nº ${dados.nrorcamento}.`;

    document.getElementById('nfValorServico').value = '';
    document.getElementById('nfCheckIrrf').checked = false;
    document.getElementById('nfCheckPisCofins').checked = false;

    await carregarServicosSelect();
    await carregarParcelasNota(idorcamento);

    // À vista (sem parcelas) não passa pelo "Selecionar parcela", que é
    // quem preenche o valor pro caso parcelado — preenche aqui com o saldo
    // (não o valor total bruto, pra continuar certo se já faturou uma parte
    // antes).
    if (!parcelasDoOrcamentoAtual.length) {
      document.getElementById('nfValorServico').value = fmtMoeda(dados.saldo);
    }
    recalcularTributos();

    await renderHistorico(idorcamento);
  } catch (err) {
    console.error('Erro ao abrir emissão do orçamento:', err);
    aviso('error', 'Erro', 'Não foi possível carregar os dados deste orçamento.');
  }
}

// Monta as linhas de banco/agência/conta (depósito e transferência) ou chave
// PIX da empresa emissora, em texto puro — usado tanto pra exibir na tela
// quanto pra inserir na descrição do serviço (ver inserirDadosBancariosNaDescricao).
// Só faz sentido pra esses meios de pagamento; boleto é gerado por transação
// (não é dado fixo da empresa) e cartão/outros não usam dado bancário aqui.
function montarLinhasDadosBancarios() {
  const meio = document.getElementById('nfMeioPagamento').value;
  const dados = dadosBancariosEmissoraAtual;
  if (!['16', '17', '18'].includes(meio) || !dados) return [];

  const linhas = [];
  if (meio === '17') {
    if (dados.pix) linhas.push(`Chave PIX: ${dados.pix}`);
  } else {
    if (dados.banconome) linhas.push(`Banco: ${dados.banconome}${dados.bancocodigo ? ' (' + dados.bancocodigo + ')' : ''}`);
    const ag = [dados.agencia, dados.digitoagencia].filter(Boolean).join('-');
    if (ag) linhas.push(`Agência: ${ag}`);
    const ct = [dados.numeroconta, dados.digitoconta].filter(Boolean).join('-');
    if (ct) linhas.push(`Conta: ${ct}${dados.tipoconta ? ' (' + dados.tipoconta + ')' : ''}`);
  }
  return linhas;
}

function atualizarDadosBancarios() {
  const bloco = document.getElementById('nfDadosBancariosEmissora');
  const conteudo = document.getElementById('nfDadosBancariosConteudo');
  const meio = document.getElementById('nfMeioPagamento').value;
  const dados = dadosBancariosEmissoraAtual;

  if (!['16', '17', '18'].includes(meio) || !dados) {
    bloco.style.display = 'none';
    return;
  }

  const linhas = montarLinhasDadosBancarios();
  conteudo.innerHTML = linhas.length
    ? linhas.map((l) => `<div><strong>${l}</strong></div>`).join('')
    : `<span class="nf-hint warn">Dados bancários não cadastrados para ${dados.nome || 'a empresa emissora'} — cadastre em Empresas.</span>`;
  bloco.style.display = 'block';
}

// "16 — Depósito bancário" -> "Depósito bancário" (tira o código, só o nome
// legível pra ir na descrição).
function obterRotuloMeioPagamento() {
  const opt = document.getElementById('nfMeioPagamento').selectedOptions[0];
  return opt ? opt.textContent.replace(/^\d+\s*—\s*/, '').trim() : '';
}

// Acrescenta uma linha de texto ao final da descrição do serviço — usado
// pelos botões "Inserir" (dados bancários, valor, parcela, vencimento). É
// ali (texto livre) que essa informação chega de fato na NFS-e, já que o
// layout de SP não tem campo próprio pra isso.
function inserirTextoNaDescricao(texto) {
  const campo = document.getElementById('nfDescricaoServico');
  campo.value = campo.value.trim() ? `${campo.value.trim()}\n${texto}` : texto;

  // O campo fica numa seção acima — sem isso o usuário clica no botão e não
  // vê nada mudar na tela.
  campo.scrollIntoView({ behavior: 'smooth', block: 'center' });
  campo.focus();
}

function inserirDadosBancariosNaDescricao() {
  const linhas = montarLinhasDadosBancarios();
  if (!linhas.length) {
    return aviso('warning', 'Nada pra inserir', 'Não há dados bancários cadastrados pra esse meio de pagamento.');
  }
  const rotuloMeio = obterRotuloMeioPagamento();
  inserirTextoNaDescricao(rotuloMeio ? `${rotuloMeio} — ${linhas.join(' — ')}` : linhas.join(' — '));
}

function inserirValorNaDescricao() {
  const valor = document.getElementById('nfValorServico').value.trim();
  if (!valor) {
    return aviso('warning', 'Nada pra inserir', 'Informe o valor do serviço antes de inserir na descrição.');
  }
  inserirTextoNaDescricao(`Valor desta parcela: ${valor}`);
}

function inserirParcelaNaDescricao() {
  const texto = document.getElementById('nfParcelaSelecionadaNum').value.trim();
  if (!texto) {
    return aviso('warning', 'Nada pra inserir', 'Nenhuma parcela selecionada.');
  }
  inserirTextoNaDescricao(texto);
}

function inserirVencimentoNaDescricao() {
  const vencimento = document.getElementById('nfParcelaVencimento').value.trim();
  if (!vencimento) {
    return aviso('warning', 'Nada pra inserir', 'Informe o vencimento da parcela antes de inserir na descrição.');
  }
  inserirTextoNaDescricao(`Vencimento: ${vencimento}`);
}

// ---- Cálculo dos tributos (ao vivo, conforme o usuário digita) ----
function recalcularTributos() {
  const p = parametrosFiscais || { cbsaliq: 0, ibsaliq: 0, irrfservicoaliq: 0, piscofinscsllservicoaliq: 0 };

  const valor = moeda(document.getElementById('nfValorServico'));
  const aliqIss = parseFloat(document.getElementById('nfAliquotaIss').value) || 0;

  const valorIss = valor * (aliqIss / 100);
  const valorIrrf = document.getElementById('nfCheckIrrf').checked ? valor * p.irrfservicoaliq : 0;
  const valorPisCofins = document.getElementById('nfCheckPisCofins').checked ? valor * p.piscofinscsllservicoaliq : 0;

  const baseCbsIbs = Math.max(valor - valorIss, 0);
  const valorCbs = baseCbsIbs * p.cbsaliq;
  const valorIbs = baseCbsIbs * p.ibsaliq;

  document.getElementById('nfValorIss').value = fmtMoeda(valorIss);
  document.getElementById('nfValorIrrf').value = fmtMoeda(valorIrrf);
  document.getElementById('nfValorPisCofins').value = fmtMoeda(valorPisCofins);
  document.getElementById('nfBaseCbsIbs').textContent = fmtMoeda(baseCbsIbs);
  document.getElementById('nfValorCbs').textContent = fmtMoeda(valorCbs);
  document.getElementById('nfValorIbs').textContent = fmtMoeda(valorIbs);

  const totalDescontos = valorIrrf + valorPisCofins;
  document.getElementById('nfTotalDescontos').textContent = fmtMoeda(totalDescontos);
  document.getElementById('nfTotalLiquido').textContent = fmtMoeda(valor - valorIss - totalDescontos);
  document.getElementById('nfTotalNota').textContent = fmtMoeda(valor);

  return { valor, aliqIss, valorIss, valorIrrf, valorPisCofins, valorCbs, valorIbs };
}

function atualizarLabelsPercentuais() {
  if (!parametrosFiscais) return;
  document.getElementById('nfLabelIrrfPct').textContent = fmtPct(parametrosFiscais.irrfservicoaliq);
  document.getElementById('nfLabelPisCofinsPct').textContent = fmtPct(parametrosFiscais.piscofinscsllservicoaliq);
  document.getElementById('nfLabelCbsPct').textContent = fmtPct(parametrosFiscais.cbsaliq);
  document.getElementById('nfLabelIbsPct').textContent = fmtPct(parametrosFiscais.ibsaliq);
  document.getElementById('nfLabelAnoParametros').textContent = parametrosFiscais.ano;

  // Mostra bem visível qual ano de alíquota está sendo usado nos cálculos
  // desta nota — inclusive um aviso se esse ano não tem nada salvo em
  // Parâmetros (cálculo saindo tudo zerado, não é "sem alíquota" de verdade).
  const elParametro = document.getElementById('nfParametroEmUso');
  const elAno = document.getElementById('nfAnoEmUso');
  if (elParametro && elAno) {
    if (parametrosFiscais._semDadosSalvos) {
      elAno.textContent = `${parametrosFiscais.ano} — sem alíquota salva, usando 0%`;
      elParametro.classList.add('warn');
    } else {
      elAno.textContent = parametrosFiscais.ano;
      elParametro.classList.remove('warn');
    }
  }
}

// ---- Aba 3: parâmetros fiscais (CBS/IBS/retenções), por ano ----
async function carregarParametros(ano) {
  const zerado = { ano, cbsaliq: 0, ibsaliq: 0, irrfservicoaliq: 0, piscofinscsllservicoaliq: 0, _semDadosSalvos: true };
  try {
    const resultado = await fetchComToken(`/notafiscal/parametros?ano=${ano}`);
    // fetchComToken devolve [] em resposta 404 (pensado pra endpoints de
    // lista, tipo "buscar bancos") em vez de lançar erro — aqui o endpoint
    // devolve um objeto único, então esse ano-sem-parâmetro nunca caía no
    // catch abaixo: parametrosFiscais virava array, e toda alíquota lida
    // dele (irrfservicoaliq, cbsaliq...) dava "undefined" → "NaN%" na tela.
    parametrosFiscais = (resultado && !Array.isArray(resultado)) ? resultado : zerado;
  } catch (err) {
    console.warn(`Sem parâmetros cadastrados para ${ano}, usando zerado:`, err.message);
    parametrosFiscais = zerado;
  }

  document.getElementById('nfParamCbs').value = (parametrosFiscais.cbsaliq * 100).toFixed(4);
  document.getElementById('nfParamIbs').value = (parametrosFiscais.ibsaliq * 100).toFixed(4);
  document.getElementById('nfParamIrrf').value = (parametrosFiscais.irrfservicoaliq * 100).toFixed(4);
  document.getElementById('nfParamPisCofins').value = (parametrosFiscais.piscofinscsllservicoaliq * 100).toFixed(4);

  atualizarLabelsPercentuais();
  recalcularTributos();
}

async function salvarParametros() {
  const ano = document.getElementById('nfParamAno').value;
  const body = {
    cbsaliq: (parseFloat(document.getElementById('nfParamCbs').value) || 0) / 100,
    ibsaliq: (parseFloat(document.getElementById('nfParamIbs').value) || 0) / 100,
    irrfservicoaliq: (parseFloat(document.getElementById('nfParamIrrf').value) || 0) / 100,
    piscofinscsllservicoaliq: (parseFloat(document.getElementById('nfParamPisCofins').value) || 0) / 100,
  };

  try {
    await fetchComToken(`/notafiscal/parametros/${ano}`, { method: 'PUT', body });
    await aviso('success', 'Salvo', `Parâmetros fiscais de ${ano} atualizados.`);
    await carregarParametros(ano);
  } catch (err) {
    console.error('Erro ao salvar parâmetros fiscais:', err);
    aviso('error', 'Erro', err?.message || 'Não foi possível salvar os parâmetros.');
  }
}

function popularSeletorAno() {
  const select = document.getElementById('nfParamAno');
  const atual = new Date().getFullYear();
  select.innerHTML = '';
  for (let a = atual + 1; a >= atual - 2; a--) {
    const o = document.createElement('option');
    o.value = a; o.textContent = a;
    select.appendChild(o);
  }
  select.value = atual;
  select.addEventListener('change', () => carregarParametros(select.value));
}

// ---- Registrar a nota (rascunho — a emissão em si é feita manualmente no portal) ----
async function registrarNota() {
  const idorcamento = document.getElementById('nfIdOrcamentoAtual').value;
  const idcliente = document.getElementById('nfIdClienteAtual').value;
  const idservico = document.getElementById('nfServicoSelect').value;
  const valores = recalcularTributos();

  if (!idorcamento || !idcliente) {
    return aviso('warning', 'Selecione um orçamento', 'Escolha um orçamento na aba "Orçamentos a faturar" antes de registrar.');
  }
  if (!valores.valor) {
    return aviso('warning', 'Valor obrigatório', 'Informe o valor do serviço desta parcela.');
  }

  const meiopagamento = document.getElementById('nfMeioPagamento').value;
  const descricaoMeioPagamento = meiopagamento === '99'
    ? document.getElementById('nfDescricaoMeioPagamento').value
    : null;
  if (meiopagamento === '99' && !descricaoMeioPagamento) {
    return aviso('warning', 'Descrição obrigatória', 'Descreva o meio de pagamento quando escolher "Outros".');
  }

  const idparcela = document.getElementById('nfIdParcelaAtual').value || null;
  const parcelaSelecionada = idparcela
    ? parcelasDoOrcamentoAtual.find((p) => String(p.idparcela) === String(idparcela))
    : null;

  const body = {
    idorcamento, idcliente,
    idservico: idservico || null,
    idparcela,
    descricaoparcela: parcelaSelecionada ? (parcelaSelecionada.descricao || `Parcela ${parcelaSelecionada.numparcela}`) : null,
    descricaoservico: document.getElementById('nfDescricaoServico').value,
    municipioprestacao: document.getElementById('nfMunicipioPrestacao').value,
    valorservico: valores.valor,
    aliquotaiss: valores.aliqIss,
    valoriss: valores.valorIss,
    valorirrf: valores.valorIrrf,
    valorpiscofinscsll: valores.valorPisCofins,
    valorcbs: valores.valorCbs,
    valoribs: valores.valorIbs,
    meiopagamento,
    descricaomeiopagamento: descricaoMeioPagamento,
    status: 'Pronta para Envio'
  };

  try {
    const inscMun = document.getElementById('nfClienteInscMun').value;
    if (inscMun) {
      // Rota dedicada a esse único campo — o PUT genérico de clientes reescreve
      // o cadastro inteiro a partir do body e apagaria o resto se usado aqui.
      // Não trava o registro da nota se isso falhar, mas avisa em vez de
      // ficar em silêncio — sem isso o financeiro não teria como saber que
      // precisa corrigir depois pelo cadastro de Clientes.
      try {
        await fetchComToken(`/clientes/${idcliente}/inscricao-municipal`, { method: 'PATCH', body: { inscricaomunicipal: inscMun } });
      } catch (errInscMun) {
        console.error('Erro ao salvar inscrição municipal do cliente:', errInscMun);
        aviso('warning', 'Inscrição municipal não salva', 'A nota foi registrada, mas não consegui salvar a inscrição municipal no cadastro do cliente. Tente preencher direto no cadastro de Clientes.');
      }
    }

    const idmontagem = document.getElementById('nfIdMontagemAtual').value;
    if (idmontagem) {
      const enderecoMontagem = {
        rua: document.getElementById('rua').value.trim() || null,
        numero: document.getElementById('nfMontagemNumero').value.trim() || null,
        bairro: document.getElementById('bairro').value.trim() || null,
        cep: document.getElementById('cep').value.trim() || null,
        cidade: document.getElementById('cidade').value.trim() || null,
        uf: document.getElementById('estado').value.trim() || null,
      };
      // Mesma ideia da inscrição municipal: rota dedicada, não trava o
      // registro da nota se falhar, só avisa.
      try {
        await fetchComToken(`/localmontagem/${idmontagem}/endereco`, { method: 'PATCH', body: enderecoMontagem });
      } catch (errMontagem) {
        console.error('Erro ao salvar endereço do local de montagem:', errMontagem);
        aviso('warning', 'Endereço não salvo', 'A nota foi registrada, mas não consegui salvar o endereço do local de montagem. Tente preencher direto no cadastro de Local de Montagem.');
      }
    }

    if (idparcela) {
      // O financeiro pode ter corrigido a data na hora de gerar — grava
      // antes de emitir a nota (idempotente se não mudou nada).
      const vencimentoDigitado = document.getElementById('nfParcelaVencimento').value.trim();
      const vencimentoIso = converterDataBRParaISO(vencimentoDigitado);
      if (vencimentoIso) {
        await fetchComToken(`/notafiscal/parcela/${idparcela}`, { method: 'PATCH', body: { dtvencimento: vencimentoIso } }).catch((err) => {
          console.error('Erro ao atualizar vencimento da parcela:', err);
        });
      }
    }

    await fetchComToken('/notafiscal', { method: 'POST', body });
    await aviso('success', 'Registrada', 'Nota fiscal registrada. Emita no portal da prefeitura e depois marque como "Emitida" aqui.');
    await renderHistorico(idorcamento);
    await carregarParcelasNota(idorcamento);
    await carregarPendentes();
  } catch (err) {
    console.error('Erro ao registrar nota fiscal:', err);
    aviso('error', 'Erro', err?.message || 'Não foi possível registrar a nota fiscal.');
  }
}

// ---- Histórico de notas do orçamento aberto ----
async function renderHistorico(idorcamento) {
  const tbody = document.getElementById('nfHistoricoBody');
  tbody.innerHTML = '<tr><td colspan="7">Carregando...</td></tr>';

  try {
    const notas = await fetchComToken(`/notafiscal/orcamento/${idorcamento}/historico`);
    if (!notas.length) {
      tbody.innerHTML = '<tr><td colspan="7">Nenhuma nota registrada ainda para este orçamento.</td></tr>';
      return;
    }
    tbody.innerHTML = '';
    // Rejeitada/Envio Incerto podem ser marcadas como emitidas manualmente
    // (financeiro confere no portal e confirma) e sempre podem ser
    // canceladas (pra liberar a parcela e registrar uma nota corrigida) —
    // só "Rejeitada" não entra no "Marcar emitida", já que rejeitada
    // significa que a prefeitura garantidamente NÃO emitiu.
    const podeMarcarEmitida = ['Pronta para Envio', 'Envio Incerto'];
    const podeCancelar = ['Pronta para Envio', 'Rejeitada', 'Envio Incerto'];

    notas.forEach((n) => {
      const chipClasse = n.status === 'Emitida' ? 'emitida'
        : n.status === 'Cancelada' ? 'cancelada'
        : (n.status === 'Rejeitada' || n.status === 'Envio Incerto') ? 'bloqueio'
        : 'rascunho';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td${n.descricaoservico ? ` title="${escaparAtributo(n.descricaoservico)}"` : ''}>${n.descricaoservico ? n.descricaoservico.slice(0, 60) + '…' : `Nota #${n.idnotafiscal}`}</td>
        <td>${n.numparcela ? `${n.numparcela}/${n.totalparcelas}` : '—'}</td>
        <td>${n.dtvencimento ? formatarDataBR(n.dtvencimento) : '—'}</td>
        <td class="nf-num">${fmtMoeda(n.valorservico)}</td>
        <td>${n.numeronota || '—'}</td>
        <td>
          <span class="nf-chip ${chipClasse}"${n.mensagemenvio ? ` title="${escaparAtributo(n.mensagemenvio)}"` : ''}>${n.status}</span>
          ${n.mensagemenvio ? `<br><span class="nf-hint warn">${escaparAtributo(n.mensagemenvio)}</span>` : ''}
        </td>
        <td>
          ${podeMarcarEmitida.includes(n.status) ? `<button type="button" class="nf-link" data-marcar="${n.idnotafiscal}">Marcar emitida</button>` : ''}
          ${podeCancelar.includes(n.status) ? `<button type="button" class="nf-link" data-cancelar="${n.idnotafiscal}">Cancelar</button>` : ''}
          ${n.arquivoxml ? `<a class="nf-link nf-link-ok" href="/${n.arquivoxml}" target="_blank" title="Abre o último XML gerado, sem gerar de novo">Ver XML</a>` : ''}
          ${n.status !== 'Cancelada' ? `<button type="button" class="nf-link" data-idnotafiscal="${n.idnotafiscal}" title="${n.arquivoxml ? 'Gera de novo (sobrescreve o atual) — use se algum dado mudou' : 'Gera o XML do RPS (ainda sem assinatura digital)'}">${n.arquivoxml ? 'Gerar XML novamente' : 'Baixar XML'}</button>` : ''}
          ${n.arquivopdf ? `<a class="nf-link" href="/${n.arquivopdf}" target="_blank">Ver PDF</a>` : `<button type="button" class="nf-link" data-anexar="${n.idnotafiscal}">Anexar PDF</button>`}
        </td>`;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('[data-marcar]').forEach((btn) => {
      btn.addEventListener('click', () => marcarComoEmitida(btn.dataset.marcar, idorcamento));
    });
    tbody.querySelectorAll('[data-cancelar]').forEach((btn) => {
      btn.addEventListener('click', () => cancelarNota(btn.dataset.cancelar, idorcamento));
    });
    tbody.querySelectorAll('[data-idnotafiscal]').forEach((btn) => {
      btn.addEventListener('click', () => baixarXmlNota(btn.dataset.idnotafiscal, idorcamento));
    });
    tbody.querySelectorAll('[data-anexar]').forEach((btn) => {
      btn.addEventListener('click', () => anexarPdf(btn.dataset.anexar, idorcamento));
    });
  } catch (err) {
    console.error('Erro ao carregar histórico de notas:', err);
    tbody.innerHTML = '<tr><td colspan="5">Erro ao carregar histórico.</td></tr>';
  }
}

async function marcarComoEmitida(idnotafiscal, idorcamento) {
  const { value: numeronota } = await Swal.fire({
    title: 'Número da nota emitida',
    input: 'text',
    inputPlaceholder: 'Ex.: 00001261',
    showCancelButton: true,
    confirmButtonText: 'Salvar'
  });
  if (!numeronota) return;

  try {
    await fetchComToken(`/notafiscal/${idnotafiscal}`, {
      method: 'PUT',
      body: { status: 'Emitida', numeronota }
    });
    if (idorcamento) await renderHistorico(idorcamento);
    await atualizarProntasParaEnvioSeVisivel();
    await carregarPendentes();
  } catch (err) {
    console.error('Erro ao marcar nota como emitida:', err);
    aviso('error', 'Erro', 'Não foi possível atualizar a nota.');
  }
}

async function cancelarNota(idnotafiscal, idorcamento) {
  const { isConfirmed } = await Swal.fire({
    icon: 'warning',
    title: 'Cancelar esta nota?',
    text: 'A parcela vinculada volta a ficar "Aberta" pra você registrar outra nota no lugar dela. Essa nota cancelada continua no histórico, só pra referência.',
    showCancelButton: true,
    confirmButtonText: 'Sim, cancelar',
    cancelButtonText: 'Voltar',
    reverseButtons: true,
    focusCancel: true
  });
  if (!isConfirmed) return;

  try {
    await fetchComToken(`/notafiscal/${idnotafiscal}`, {
      method: 'PUT',
      body: { status: 'Cancelada' }
    });
    if (idorcamento) {
      await renderHistorico(idorcamento);
      await carregarParcelasNota(idorcamento);
    }
    await atualizarProntasParaEnvioSeVisivel();
    await carregarPendentes();
  } catch (err) {
    console.error('Erro ao cancelar nota:', err);
    aviso('error', 'Erro', 'Não foi possível cancelar a nota.');
  }
}

function anexarPdf(idnotafiscal, idorcamento) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/pdf,image/*';
  input.onchange = async () => {
    if (!input.files.length) return;
    const formData = new FormData();
    formData.append('arquivo', input.files[0]);
    try {
      await fetchComToken(`/notafiscal/${idnotafiscal}/anexo`, { method: 'POST', body: formData });
      if (idorcamento) await renderHistorico(idorcamento);
      await atualizarProntasParaEnvioSeVisivel();
    } catch (err) {
      console.error('Erro ao anexar arquivo:', err);
      aviso('error', 'Erro', 'Não foi possível anexar o arquivo.');
    }
  };
  input.click();
}

// ---- Inicialização (chamada pelo loader genérico de módulos) ----
function configurarEventosNotaFiscal() {
  document.querySelectorAll('#cadModalNotaFiscal .nf-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => mudarAba(btn.dataset.nfTab));
  });

  document.getElementById('nfMeioPagamento').addEventListener('change', (e) => {
    document.getElementById('nfCampoOutrosPag').style.display = e.target.value === '99' ? 'flex' : 'none';
    atualizarDadosBancarios();
  });
  document.getElementById('nfBtnInserirDadosBancarios').addEventListener('click', inserirDadosBancariosNaDescricao);
  document.getElementById('nfBtnInserirValor').addEventListener('click', inserirValorNaDescricao);
  document.getElementById('nfBtnInserirParcela').addEventListener('click', inserirParcelaNaDescricao);
  document.getElementById('nfBtnInserirVencimento').addEventListener('click', inserirVencimentoNaDescricao);

  document.getElementById('nfBtnTestarEnvio').addEventListener('click', () => enviarLote(true));
  document.getElementById('nfBtnEnviarDireto').addEventListener('click', () => enviarLote(false));
  document.getElementById('nfEnvioFiltroEmpresa').addEventListener('change', renderizarNotasProntasParaEnvio);
  document.getElementById('nfEnvioMarcarTodas').addEventListener('change', (e) => {
    document.querySelectorAll('.nf-envio-check:not(:disabled)').forEach((chk) => { chk.checked = e.target.checked; });
    atualizarContagemEnvio();
  });

  document.getElementById('nfParcelaVencimento').addEventListener('input', (e) => {
    mascararDataDigitada(e.target);
  });

  ['nfFiltroRealizacaoDe', 'nfFiltroRealizacaoAte', 'nfFiltroVencimentoDe', 'nfFiltroVencimentoAte'].forEach((id) => {
    document.getElementById(id).addEventListener('input', (e) => mascararDataDigitada(e.target));
  });
  document.getElementById('nfBtnFiltrarPendentes').addEventListener('click', carregarPendentes);
  document.getElementById('nfBtnLimparFiltrosPendentes').addEventListener('click', limparFiltrosPendentes);
  ligarComboFiltro('Cliente', aoMudarClienteFiltro);
  ligarComboFiltro('Evento', aoMudarEventoFiltro);

  ['nfValorServico', 'nfAliquotaIss'].forEach((id) => {
    document.getElementById(id).addEventListener('input', recalcularTributos);
  });
  ['nfCheckIrrf', 'nfCheckPisCofins'].forEach((id) => {
    document.getElementById(id).addEventListener('change', recalcularTributos);
  });

  document.getElementById('nfBtnRegistrar').addEventListener('click', registrarNota);
  document.getElementById('nfBtnSalvarParametros').addEventListener('click', salvarParametros);

  popularSeletorAno();
  carregarParametros(new Date().getFullYear());
  carregarPendentes();

  travarScrollDeFundo();
}

// Trava o scroll da página de fundo direto via style inline em <html> E
// <body> (não sabemos ao certo qual dos dois é o elemento que realmente rola
// nesta página — trava os dois pra cobrir qualquer um). Não depende da
// classe .modal-open nem do CSS de terceiros.
let _overflowOriginalHtml = null;
let _overflowOriginalBody = null;
function travarScrollDeFundo() {
  if (_overflowOriginalHtml === null) {
    _overflowOriginalHtml = document.documentElement.style.overflow || '';
    _overflowOriginalBody = document.body.style.overflow || '';
  }
  document.documentElement.style.overflow = 'hidden';
  document.body.style.overflow = 'hidden';
}
function destravarScrollDeFundo() {
  document.documentElement.style.overflow = _overflowOriginalHtml || '';
  document.body.style.overflow = _overflowOriginalBody || '';
  _overflowOriginalHtml = null;
  _overflowOriginalBody = null;
}

// Segue o mesmo contrato do loader genérico de módulos (abrirModal/Index.js):
// cada módulo sobrescreve window.configurarEventosEspecificos diretamente —
// só um modal fica aberto por vez, então não precisa encadear com o anterior.
window.configurarEventosEspecificos = function (modulo) {
  if (modulo.trim().toLowerCase() === 'notafiscal') {
    configurarEventosNotaFiscal();
  }
};

// A chave precisa bater EXATAMENTE com o data-modulo do link do menu
// ("NotaFiscal") — fecharModal() em Index.js busca por window.moduloAtual
// sem normalizar caixa, então 'notafiscal' (minúsculo) nunca seria encontrado.
window.moduloHandlers = window.moduloHandlers || {};
window.moduloHandlers['NotaFiscal'] = {
  configurar: configurarEventosNotaFiscal,
  desinicializar: destravarScrollDeFundo
};
