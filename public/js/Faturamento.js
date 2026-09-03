
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
const normalizarTexto = (t) => String(t || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase().trim();

// Só pra valores colocados dentro de atributo HTML (ex.: title="...") — aqui
// aspas duplas sem escapar fecham o atributo antes da hora e quebram a linha.
const escaparAtributo = (texto) => String(texto ?? '').replace(/"/g, '&quot;');

// Testar envio / Enviar direto / Cancelar / Cancelar NF na Prefeitura são
// restritos à flag especial "master" (pedido explícito) — front só esconde
// (UX), o backend é quem realmente bloqueia (ver docs/PERMISSOES.md). Segue a
// convenção do projeto: a flag é concedida na linha do módulo "Staff".
const temMasterFaturamento = () => typeof window.temPermissao === 'function' && window.temPermissao('Staff', 'master');

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
  if (nome === 'emitidas') carregarEmitidas();
  if (nome === 'canceladas') carregarCanceladas();
  if (nome === 'rejeitadas') carregarRejeitadas();
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

// "Ano atual" (ver nf-check-ano-atual no HTML — Visão Geral tem dois grupos
// independentes, Realização/Vencimento; Emitidas/Canceladas têm só Registro)
// só entra em ação quando os campos De/Até do próprio grupo estão vazios:
// digitar um período manualmente já desmarca o check sozinho (ver listener
// de input), então aqui nunca sobrescreve o que a pessoa escolheu a dedo.
function periodoAnoAtualSeVazio(checkboxId, deId, ateId) {
  const marcado = document.getElementById(checkboxId).checked;
  const de = document.getElementById(deId).value.trim();
  const ate = document.getElementById(ateId).value.trim();
  if (!marcado || de || ate) {
    return { de: converterDataBRParaISO(de), ate: converterDataBRParaISO(ate) };
  }
  const ano = new Date().getFullYear();
  return { de: `${ano}-01-01`, ate: `${ano}-12-31` };
}

function montarQueryFiltrosPendentes() {
  const params = new URLSearchParams();
  const idcliente = document.getElementById('nfFiltroCliente').value;
  const idevento = document.getElementById('nfFiltroEvento').value;
  const idempresaemissora = document.getElementById('nfFiltroEmpresaEmissora').value;
  const statusFatura = document.getElementById('nfFiltroStatusFatura').value;
  const periodoRealizacao = periodoAnoAtualSeVazio('nfFiltroRealizacaoAnoAtual', 'nfFiltroRealizacaoDe', 'nfFiltroRealizacaoAte');
  const periodoVencimento = periodoAnoAtualSeVazio('nfFiltroVencimentoAnoAtual', 'nfFiltroVencimentoDe', 'nfFiltroVencimentoAte');
  const dtRealizacaoDe = periodoRealizacao.de;
  const dtRealizacaoAte = periodoRealizacao.ate;
  const dtVencimentoDe = periodoVencimento.de;
  const dtVencimentoAte = periodoVencimento.ate;

  if (idcliente) params.set('idcliente', idcliente);
  if (idevento) params.set('idevento', idevento);
  if (idempresaemissora) params.set('idempresaemissora', idempresaemissora);
  if (statusFatura) params.set('statusFatura', statusFatura);
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
  document.getElementById('nfFiltroStatusFatura').value = '';
  ['nfFiltroRealizacaoDe', 'nfFiltroRealizacaoAte', 'nfFiltroVencimentoDe', 'nfFiltroVencimentoAte'].forEach((id) => {
    document.getElementById(id).value = '';
  });
  // Volta pro padrão: Ano atual em Realização, desmarcado em Vencimento.
  document.getElementById('nfFiltroRealizacaoAnoAtual').checked = true;
  document.getElementById('nfFiltroVencimentoAnoAtual').checked = false;
  carregarPendentes();
}

// Soma Valor total/Faturado/Saldo da lista já filtrada (backend já aplicou
// cliente/evento/emissora/status/período — aqui só soma o que veio).
// Extraído pra ser reaproveitado pela impressão "Só Total" (calcula os mesmos
// 4 totais, mas por grupo de empresa emissora em vez de só o geral da tela).
function calcularTotaisLista(lista) {
  // Datas do backend são tratadas como UTC em toda a tela (ver formatarDataBR
  // com timeZone:'UTC') — "hoje" precisa ser comparado do mesmo jeito, senão
  // uma parcela que vence hoje pode contar como vencida ou não dependendo do
  // fuso de quem está usando o sistema.
  const hojeUTC = new Date();
  hojeUTC.setUTCHours(0, 0, 0, 0);

  return lista.reduce((acc, o) => {
    const saldo = parseFloat(o.saldo) || 0;
    acc.valor += parseFloat(o.vlrcliente) || 0;
    acc.faturado += parseFloat(o.faturado) || 0;
    acc.saldo += saldo;
    if (saldo > 0.009 && o.proximovencimento && new Date(o.proximovencimento) < hojeUTC) {
      acc.vencido += saldo;
    }
    // Recebimento (regime de caixa) — só existe pra nota já Emitida, vem
    // pronto agregado do backend (subquery "recb" em GET /pendentes).
    // "A Receber" não vem pronto (só Pago e Atrasado) — é o resto do que foi
    // faturado que ainda não caiu em nenhum dos dois: já emitida, dentro do
    // prazo, sem confirmação de recebido ainda.
    const pago = parseFloat(o.pago) || 0;
    const atrasadoRecebimento = parseFloat(o.atrasadorecebimento) || 0;
    acc.pago += pago;
    acc.atrasadoRecebimento += atrasadoRecebimento;
    acc.aReceber += Math.max(0, (parseFloat(o.faturado) || 0) - pago - atrasadoRecebimento);
    return acc;
  }, { valor: 0, faturado: 0, saldo: 0, vencido: 0, pago: 0, aReceber: 0, atrasadoRecebimento: 0 });
}

// Rótulo discreto no rodapé indicando qual escopo de ano está por trás dos
// totais abaixo — mesma regra de vazio/marcado de periodoAnoAtualSeVazio,
// só que aqui é puro texto (não refiltra nada). Some (string vazia) quando
// a pessoa digitou um período manual em vez de usar "Ano atual": um período
// customizado não cabe num rótulo de "Ano X", então melhor não inventar um.
function descricaoEscopoAnoPendentes() {
  const ano = new Date().getFullYear();
  const vazio = (id) => !document.getElementById(id).value.trim();
  const realizacaoAnoAtual = document.getElementById('nfFiltroRealizacaoAnoAtual').checked
    && vazio('nfFiltroRealizacaoDe') && vazio('nfFiltroRealizacaoAte');
  const vencimentoAnoAtual = document.getElementById('nfFiltroVencimentoAnoAtual').checked
    && vazio('nfFiltroVencimentoDe') && vazio('nfFiltroVencimentoAte');

  const partes = [];
  if (realizacaoAnoAtual) partes.push(`Ano Realização ${ano}`);
  if (vencimentoAnoAtual) partes.push(`Ano Vencimentos ${ano}`);
  if (partes.length) return partes.join(' + ');

  const temPeriodoManual = ['nfFiltroRealizacaoDe', 'nfFiltroRealizacaoAte', 'nfFiltroVencimentoDe', 'nfFiltroVencimentoAte']
    .some((id) => !vazio(id));
  return temPeriodoManual ? '' : 'Todos os Anos';
}

function atualizarTotaisGeraisPendentes(lista) {
  const totais = calcularTotaisLista(lista);
  document.getElementById('nfTotalGeralValor').textContent = fmtMoeda(totais.valor);
  document.getElementById('nfTotalGeralFaturado').textContent = fmtMoeda(totais.faturado);
  document.getElementById('nfTotalGeralSaldo').textContent = fmtMoeda(totais.saldo);
  document.getElementById('nfTotalGeralVencido').textContent = fmtMoeda(totais.vencido);
  document.getElementById('nfTotalGeralPago').textContent = fmtMoeda(totais.pago);
  document.getElementById('nfTotalGeralAReceber').textContent = fmtMoeda(totais.aReceber);
  document.getElementById('nfTotalGeralAtrasadoRecebimento').textContent = fmtMoeda(totais.atrasadoRecebimento);
  document.getElementById('nfEscopoAnoPendentes').textContent = descricaoEscopoAnoPendentes();
}

let pendentesListaAtual = [];
let pendentesOrdenacao = { campo: null, direcao: 1 }; // direcao: 1 = crescente, -1 = decrescente

async function carregarPendentes() {
  const tbody = document.getElementById('nfTabelaPendentesBody');
  tbody.innerHTML = '<tr><td colspan="12">Carregando...</td></tr>';

  try {
    const query = montarQueryFiltrosPendentes();
    const lista = await fetchComToken(`/faturamento/pendentes${query ? '?' + query : ''}`);
    popularFiltrosPendentes(lista);
    pendentesListaAtual = lista;
    // Cada filtragem nova volta a ordenar pelo padrão do backend (vencimento).
    pendentesOrdenacao = { campo: null, direcao: 1 };
    atualizarSetasOrdenacaoPendentes();
    renderizarLinhasPendentes(lista);
  } catch (err) {
    console.error('Erro ao carregar orçamentos pendentes:', err);
    tbody.innerHTML = '<tr><td colspan="12">Erro ao carregar orçamentos.</td></tr>';
  }
}

function renderizarLinhasPendentes(lista) {
  const tbody = document.getElementById('nfTabelaPendentesBody');
  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="12">Nenhum orçamento fechado com saldo a faturar para os filtros selecionados.</td></tr>';
    atualizarTotaisGeraisPendentes([]);
    return;
  }
  tbody.innerHTML = '';
  lista.forEach((o) => {
    const saldo = parseFloat(o.saldo) || 0;
    const totalparcelas = parseInt(o.totalparcelas, 10) || 0;
    const parcelaspagas = parseInt(o.parcelaspagas, 10) || 0;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${o.nrorcamento}</td>
      <td>${nomeClienteComFantasia(o.cliente_nome, o.cliente_nmfantasia) || '—'}</td>
      <td>${o.evento_nome || '—'}</td>
      <td>${o.emissora_nome || '—'}</td>
      <td>${o.evento_cidade ? `${o.evento_cidade}${o.evento_uf ? '/' + o.evento_uf : ''}` : '—'}</td>
      <td>${totalparcelas <= 1 ? 'À vista' : `${parcelaspagas}/${totalparcelas}`}</td>
      <td>${formatarDataBR(o.dtinirealizacao)}${o.dtfimrealizacao ? ' – ' + formatarDataBR(o.dtfimrealizacao) : ''}</td>
      <td>${o.proximovencimento ? formatarDataBR(o.proximovencimento) : '—'}</td>
      <td class="nf-num">${fmtMoeda(o.vlrcliente)}</td>
      <td class="nf-num">${fmtMoeda(o.faturado)}</td>
      <td class="nf-num">${fmtMoeda(saldo)}</td>
      <td>${!o.proprioambiente
          ? `<span class="nf-chip rascunho" title="Só visualização por aqui — o processo continua no ambiente de origem">Feito pelo ambiente ${escaparAtributo(o.ambienteorigem_nome || '—')}</span>`
          : saldo > 0.009
            ? `${parseFloat(o.faturado) > 0 ? '<span class="nf-chip parcial" title="Já tem parcela(s) faturada(s), mas ainda falta faturar o restante"><i class="fa-solid fa-circle-half-stroke"></i> Faturada parcialmente</span> ' : ''}${temMasterFaturamento() ? `<button type="button" class="nf-row-btn" data-idorcamento="${o.idorcamento}">Emitir nota</button>` : ''}`
            : '<span class="nf-chip emitida">Faturado</span>'}</td>`;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('.nf-row-btn').forEach((btn) => {
    btn.addEventListener('click', () => abrirEmissaoParaOrcamento(btn.dataset.idorcamento));
  });

  atualizarTotaisGeraisPendentes(lista);
}

// Colunas com valor numérico "de verdade" guardado num campo diferente do
// exibido (Parcelas mostra "X/Y", mas ordena por parcelas pagas) ou que
// precisam de comparação numérica/de data em vez de texto.
const PENDENTES_CAMPOS_NUMERICOS = new Set(['nrorcamento', 'vlrcliente', 'faturado', 'saldo', 'parcelaspagas']);
const PENDENTES_CAMPOS_DATA = new Set(['dtinirealizacao', 'proximovencimento']);

// Extraído de ordenarPendentes pra ser reaproveitado pela impressão (ver
// gerarImpressaoVisaoGeral) — a impressão precisa refletir a MESMA ordem que
// está na tela, mas pendentesListaAtual nunca é reordenada de verdade (só o
// que é renderizado no DOM), então sem isso a impressão sairia sempre na
// ordem original do backend, ignorando um clique de ordenação já feito.
function aplicarOrdenacaoAtual(lista) {
  if (!pendentesOrdenacao.campo) return lista;
  const campo = pendentesOrdenacao.campo;
  const numerico = PENDENTES_CAMPOS_NUMERICOS.has(campo);
  const data = PENDENTES_CAMPOS_DATA.has(campo);

  return [...lista].sort((a, b) => {
    let va = a[campo];
    let vb = b[campo];
    // Nulo/vazio sempre no fim, não importa a direção — senão "sem vencimento"
    // ficaria confuso pulando pro topo quando inverte a seta.
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;

    if (numerico) { va = parseFloat(va) || 0; vb = parseFloat(vb) || 0; }
    else if (data) { va = new Date(va).getTime(); vb = new Date(vb).getTime(); }
    else { va = String(va).toLowerCase(); vb = String(vb).toLowerCase(); }

    if (va < vb) return -1 * pendentesOrdenacao.direcao;
    if (va > vb) return 1 * pendentesOrdenacao.direcao;
    return 0;
  });
}

function ordenarPendentes(campo) {
  pendentesOrdenacao.direcao = (pendentesOrdenacao.campo === campo) ? -pendentesOrdenacao.direcao : 1;
  pendentesOrdenacao.campo = campo;

  atualizarSetasOrdenacaoPendentes();
  renderizarLinhasPendentes(aplicarOrdenacaoAtual(pendentesListaAtual));
}

function atualizarSetasOrdenacaoPendentes() {
  document.querySelectorAll('#nfTabelaPendentesHead th[data-sort]').forEach((th) => {
    th.classList.remove('nf-sort-asc', 'nf-sort-desc');
    const seta = th.querySelector('.nf-seta');
    if (th.dataset.sort === pendentesOrdenacao.campo) {
      th.classList.add(pendentesOrdenacao.direcao === 1 ? 'nf-sort-asc' : 'nf-sort-desc');
      seta.textContent = pendentesOrdenacao.direcao === 1 ? '▲' : '▼';
    } else {
      seta.textContent = '▲';
    }
  });
}

// ---- Impressão (Visão Geral) ----
// Logo da empresa atual — vem do cadastro de Empresas (campo logo, upload de
// verdade, ver CadEmpresa.html/rotaEmpresa.js). Nada de adivinhar o nome do
// arquivo a partir de nmfantasia: já tentamos isso e deu errado pra EA/EXPO
// (nmfantasia no banco não bate direito com o arquivo real).
let nfEmpresaLogoPath = null; // null = não mostra nenhum logo (em vez de mostrar um errado)

async function inicializarLogoEmpresaImpressao() {
  const idempresa = localStorage.getItem('idempresa');
  if (!idempresa) return;
  try {
    const empresa = await fetchComToken(`/relatorios/empresas/${idempresa}`);
    if (empresa?.logo) {
      nfEmpresaLogoPath = `/${empresa.logo}`;
    }
  } catch (err) {
    console.warn('Não consegui buscar o logo da empresa pra impressão:', err);
  }
}

// Status combinado pra impressão em Detalhes — útil sobretudo quando o
// filtro Status fica em "Todas" e a lista mistura orçamentos em situações
// diferentes, sem nenhuma coluna que deixe isso claro de cara.
// O status de Faturamento (base) e o de Recebimento são independentes: um
// orçamento "Faturada parcialmente" ou até "Emissão NF atrasada" (parte
// ainda não faturada) já pode ter uma parte faturada com recebimento em
// dia, atrasado ou recebido — por isso o recebimento entra junto sempre que
// existir algo faturado, não só quando está 100% faturado.
function textoStatusImpressao(o) {
  const saldo = parseFloat(o.saldo) || 0;
  const faturado = parseFloat(o.faturado) || 0;
  const hojeUTC = new Date();
  hojeUTC.setUTCHours(0, 0, 0, 0);
  const emissaoAtrasada = saldo > 0.009 && o.proximovencimento && new Date(o.proximovencimento) < hojeUTC;

  let base;
  if (saldo <= 0.009) base = 'Faturada';
  else if (emissaoAtrasada) base = 'Emissão NF atrasada';
  else base = faturado > 0.009 ? 'Faturada parcialmente' : 'Em aberto';

  if (faturado <= 0.009) return base; // nada faturado ainda — não existe recebimento pra mostrar

  const pago = parseFloat(o.pago) || 0;
  const atrasadoRecebimento = parseFloat(o.atrasadorecebimento) || 0;
  const recebimento = (faturado - pago) <= 0.009 ? 'Recebida'
    : atrasadoRecebimento > 0.009 ? 'Recebimento Atrasado'
    : 'A Receber';
  return `${base}/${recebimento}`;
}

const NF_COLUNAS_IMPRESSAO = [
  { chave: 'nrorcamento', label: 'Nº orçamento', valor: (o) => o.nrorcamento },
  { chave: 'cliente', label: 'Cliente', valor: (o) => nomeClienteComFantasia(o.cliente_nome, o.cliente_nmfantasia) || '—' },
  { chave: 'evento', label: 'Evento', valor: (o) => o.evento_nome || '—' },
  { chave: 'emissora', label: 'Empresa emissora', valor: (o) => o.emissora_nome || '—' },
  { chave: 'municipio', label: 'Município', valor: (o) => o.evento_cidade ? `${o.evento_cidade}${o.evento_uf ? '/' + o.evento_uf : ''}` : '—' },
  {
    chave: 'parcelas', label: 'Parcelas', valor: (o) => {
      const totalparcelas = parseInt(o.totalparcelas, 10) || 0;
      const parcelaspagas = parseInt(o.parcelaspagas, 10) || 0;
      return totalparcelas <= 1 ? 'À vista' : `${parcelaspagas}/${totalparcelas}`;
    }
  },
  { chave: 'realizacao', label: 'Realização', valor: (o) => `${formatarDataBR(o.dtinirealizacao)}${o.dtfimrealizacao ? ' – ' + formatarDataBR(o.dtfimrealizacao) : ''}` },
  { chave: 'vencimento', label: 'Vencimento', valor: (o) => o.proximovencimento ? formatarDataBR(o.proximovencimento) : '—' },
  { chave: 'valorTotal', label: 'Valor total', valor: (o) => fmtMoeda(o.vlrcliente), numerica: true },
  { chave: 'faturado', label: 'Faturado', valor: (o) => fmtMoeda(o.faturado), numerica: true },
  { chave: 'saldo', label: 'Saldo', valor: (o) => fmtMoeda(parseFloat(o.saldo) || 0), numerica: true },
  { chave: 'status', label: 'Status', valor: (o) => textoStatusImpressao(o) },
];

// Resumo dos filtros ativos em Visão Geral, pra aparecer no cabeçalho da
// impressão — sobretudo no modo "Só Total", que não mostra as linhas, só os
// totais e o que foi filtrado pra chegar neles.
// Sempre mostra os 6 filtros de Visão Geral, mesmo os não preenchidos (com
// "Todos"/"Todas"/"—") — pedido explícito: deixa claro o escopo completo do
// relatório em vez de só citar o que foi de fato restringido.
// Texto do período pro cabeçalho da impressão — mostra "Ano atual (2026)"
// quando o check está ativo e ninguém digitou nada (mesma regra de
// periodoAnoAtualSeVazio), senão mostra o período digitado ou "Todos".
function descricaoPeriodoImpressao(checkboxId, deId, ateId) {
  const marcado = document.getElementById(checkboxId).checked;
  const de = document.getElementById(deId).value.trim();
  const ate = document.getElementById(ateId).value.trim();
  if (marcado && !de && !ate) return `Ano atual (${new Date().getFullYear()})`;
  if (!de && !ate) return 'Todos';
  return `${de || '—'} a ${ate || '—'}`;
}

function resumoFiltrosPendentesAtivos() {
  const cliente = document.getElementById('nfBuscaCliente').value.trim();
  const evento = document.getElementById('nfBuscaEvento').value.trim();
  const selectEmpresa = document.getElementById('nfFiltroEmpresaEmissora');
  const selectStatus = document.getElementById('nfFiltroStatusFatura');

  return [
    `Cliente: ${cliente || 'Todos'}`,
    `Evento: ${evento || 'Todos'}`,
    `Empresa emissora: ${selectEmpresa.options[selectEmpresa.selectedIndex].text}`,
    `Status: ${selectStatus.value ? selectStatus.options[selectStatus.selectedIndex].text : 'Todas'}`,
    `Realização do Evento: ${descricaoPeriodoImpressao('nfFiltroRealizacaoAnoAtual', 'nfFiltroRealizacaoDe', 'nfFiltroRealizacaoAte')}`,
    `Vencimento da NF: ${descricaoPeriodoImpressao('nfFiltroVencimentoAnoAtual', 'nfFiltroVencimentoDe', 'nfFiltroVencimentoAte')}`,
  ];
}

// Genérico o bastante pra qualquer aba com impressão (Visão Geral, Emitidas,
// ...) — cada uma monta sua própria lista de filtros (colunas/dimensões
// diferentes), mas o "quadro" (logo + título + barra + badges) é sempre o
// mesmo. Sem "Gerado em ..." aqui — o navegador já imprime data/hora sozinho
// no cabeçalho automático da página (pedido: informação duplicada).
function cabecalhoImpressao(secao, subtitulo, filtros) {
  return `
    <div class="nf-print-topo${nfEmpresaLogoPath ? '' : ' sem-logo'}">
      ${nfEmpresaLogoPath ? `<img src="${nfEmpresaLogoPath}" alt="Logo" class="nf-print-logo" onerror="this.style.display='none'">` : ''}
      <h1>Faturamento</h1>
    </div>
    <div class="nf-print-barra-titulo">${escaparAtributo(secao)} — ${escaparAtributo(subtitulo)}</div>
    <div class="nf-print-filtros">${filtros.map((f) => `<span class="nf-print-badge">${escaparAtributo(f)}</span>`).join('')}</div>`;
}

// Escreve o conteúdo no iframe oculto e dispara a impressão — mesmo padrão
// já usado em Relatorios.js (window.print() direto na tela brigaria com o
// layout do modal/overlay, por isso um iframe isolado com CSS próprio). O
// estilo do documento impresso fica todo nesse único <style>, não espalhado
// em atributos style="" pelo HTML gerado.
function imprimirHtmlEmIframe(conteudoHtml) {
  const iframe = document.getElementById('nfPrintIframe');
  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open();
  doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Faturamento — Visão Geral</title>
    <style>
      @page { size: A4 landscape; margin: 1cm; }
      /* Sem isso, o Chrome ignora background/cor de fundo na impressão real
         (só mostra na pré-visualização) a menos que o usuário marque
         "Gráficos de segundo plano" manualmente nas opções de impressão —
         força a cor a sair sempre, sem depender dessa opção. */
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact; }
      body { font-family: Arial, sans-serif; color: #222; margin: 0; }
      .nf-print-topo { display: flex; align-items: center; gap: 16px; background: #eef0f2; padding: 10px 16px; border-radius: 6px 6px 0 0; }
      .nf-print-logo { max-height: 40px; }
      .nf-print-topo h1 { flex: 1; text-align: center; margin: 0; margin-right: 56px; font-size: 24px; letter-spacing: .04em; color: #050505; }
      .nf-print-topo.sem-logo h1 { margin-right: 0; }
      .nf-print-barra-titulo { background: #7e7e7e; color: #fff; font-size: 13px; font-weight: bold; letter-spacing: .03em; padding: 6px 16px; }
      .nf-print-filtros { margin: 8px 16px 14px; }
      .nf-print-badge { display: inline-block; background: #eef0f2; border: 1px solid #c8ccd0; border-radius: 12px; padding: 3px 10px; margin: 2px 4px 2px 0; font-size: 11px; color: #7e7e7e; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; margin: 0 0 12px; }
      th, td { border: 1px solid #ccc; padding: 5px 7px; text-align: left; }
      th { background: #ddd; color: #000; font-weight: bold; }
      tbody tr:nth-child(even) { background: #f5f6f7; }
      td.num, th.num { text-align: right; }
      .nf-print-total-geral td { background: #7e7e7e; color: #fff; font-weight: bold; font-size: 12px; }
      .nf-print-vazio { margin: 0 16px; color: #777; }
    </style>
  </head><body>${conteudoHtml}</body></html>`);
  doc.close();
  // Pequeno atraso pra garantir que o iframe renderizou antes de imprimir.
  setTimeout(() => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
  }, 300);
}

// titulo null = sem a 1ª coluna (usado no total geral do modo "Detalhes",
// que não é quebrado por empresa — ver gerarImpressaoDetalhes). Faturamento
// (Valor total/Faturado/A Faturar/Emissão NF atrasada) e Recebimento
// (Recebida/A Receber/Recebimento Atrasado) juntos na mesma linha — os dois
// já vêm prontos de calcularTotaisLista, sem custo extra de mostrar os dois.
function linhaTotaisImpressao(titulo, totais, destaque) {
  return `<tr${destaque ? ' class="nf-print-total-geral"' : ''}>
    ${titulo != null ? `<td>${escaparAtributo(titulo)}</td>` : ''}
    <td class="num">${fmtMoeda(totais.valor)}</td>
    <td class="num">${fmtMoeda(totais.faturado)}</td>
    <td class="num">${fmtMoeda(totais.saldo)}</td>
    <td class="num">${fmtMoeda(totais.vencido)}</td>
    <td class="num">${fmtMoeda(totais.pago)}</td>
    <td class="num">${fmtMoeda(totais.aReceber)}</td>
    <td class="num">${fmtMoeda(totais.atrasadoRecebimento)}</td>
  </tr>`;
}

// "Só Total" sempre mostra de qual empresa emissora é o valor (pedido
// explícito) — com um filtro de empresa específico, pendentesListaAtual já
// só tem uma; com "Todas", agrupa uma linha de subtotal por empresa, mais
// uma linha de Total Geral no final juntando todas. Colunas em vez de linhas
// empilhadas — mais compacto e fácil de comparar entre empresas.
function gerarImpressaoSoTotal() {
  const lista = pendentesListaAtual;
  const grupos = new Map(); // nome da empresa emissora -> orçamentos dela
  lista.forEach((o) => {
    const nome = o.emissora_nome || 'Sem empresa emissora';
    if (!grupos.has(nome)) grupos.set(nome, []);
    grupos.get(nome).push(o);
  });
  const nomesEmpresas = [...grupos.keys()].sort((a, b) => a.localeCompare(b, 'pt-BR'));

  let corpo;
  if (!nomesEmpresas.length) {
    corpo = '<p class="nf-print-vazio">Nenhum orçamento para os filtros selecionados.</p>';
  } else {
    let linhas = nomesEmpresas.map((nome) => linhaTotaisImpressao(nome, calcularTotaisLista(grupos.get(nome)))).join('');
    if (nomesEmpresas.length > 1) {
      linhas += linhaTotaisImpressao('Total Geral (todas as empresas)', calcularTotaisLista(lista), true);
    }
    corpo = `
      <table>
        <thead><tr><th>Empresa Emissora</th><th class="num">Valor total</th><th class="num">Faturado</th><th class="num">A Faturar</th><th class="num">Emissão NF atrasada</th><th class="num">Recebida</th><th class="num">A Receber</th><th class="num">Recebimento Atrasado</th></tr></thead>
        <tbody>${linhas}</tbody>
      </table>`;
  }

  const html = cabecalhoImpressao('VISÃO GERAL', 'Somente totais', resumoFiltrosPendentesAtivos()) + corpo;
  imprimirHtmlEmIframe(html);
}

function gerarImpressaoDetalhes(colunasEscolhidas) {
  const colunas = NF_COLUNAS_IMPRESSAO.filter((c) => colunasEscolhidas.includes(c.chave));
  // Mesma ordem que está na tela (respeita clique em ordenação já feito).
  const lista = aplicarOrdenacaoAtual(pendentesListaAtual);
  const linhas = lista.map((o) => `<tr>${colunas.map((c) => `<td${c.numerica ? ' class="num"' : ''}>${c.valor(o)}</td>`).join('')}</tr>`).join('');

  // Total geral (Faturamento + Recebimento) da lista inteira — pedido
  // explícito, pra não precisar gerar "Só Total" à parte só pra ver os
  // totais de uma impressão em Detalhes. Sem quebra por empresa emissora
  // aqui (esse detalhamento é o papel do modo "Só Total").
  const blocoTotalGeral = lista.length ? `
    <table>
      <thead><tr><th class="num">Valor total</th><th class="num">Faturado</th><th class="num">A Faturar</th><th class="num">Emissão NF atrasada</th><th class="num">Recebida</th><th class="num">A Receber</th><th class="num">Recebimento Atrasado</th></tr></thead>
      <tbody>${linhaTotaisImpressao(null, calcularTotaisLista(lista), true)}</tbody>
    </table>` : '';

  const html = cabecalhoImpressao('VISÃO GERAL', `Detalhes — ${lista.length} orçamento${lista.length === 1 ? '' : 's'}`, resumoFiltrosPendentesAtivos()) + `
    <table>
      <thead><tr>${colunas.map((c) => `<th${c.numerica ? ' class="num"' : ''}>${c.label}</th>`).join('')}</tr></thead>
      <tbody>${linhas || `<tr><td colspan="${colunas.length}">Nenhum orçamento para os filtros selecionados.</td></tr>`}</tbody>
    </table>` + blocoTotalGeral;
  imprimirHtmlEmIframe(html);
}

// Checkboxes de coluna, todas marcadas por padrão — o financeiro só desmarca
// o que não quer ver impresso (pedido explícito: "vir com todos setados").
// Classes .nf-print-colunas/.nf-print-coluna-check ficam em Faturamento.css
// (sem escopo #cadModalNotaFiscal, já que o Swal renderiza fora do modal).
async function abrirEscolhaColunasImpressao() {
  const checkboxesHtml = NF_COLUNAS_IMPRESSAO.map((c) => `
    <label class="nf-print-coluna-check">
      <input type="checkbox" checked value="${c.chave}"> ${c.label}
    </label>`).join('');

  const { value: colunasEscolhidas } = await Swal.fire({
    title: 'Escolha as colunas',
    html: `<div class="nf-print-colunas">${checkboxesHtml}</div>`,
    showCancelButton: true,
    confirmButtonText: 'Imprimir',
    cancelButtonText: 'Cancelar',
    preConfirm: () => {
      const marcadas = [...document.querySelectorAll('.swal2-html-container input[type=checkbox]:checked')].map((el) => el.value);
      if (!marcadas.length) {
        Swal.showValidationMessage('Escolha pelo menos uma coluna.');
        return false;
      }
      return marcadas;
    }
  });
  if (!colunasEscolhidas) return;
  gerarImpressaoDetalhes(colunasEscolhidas);
}

async function imprimirVisaoGeral() {
  const { isConfirmed, isDenied } = await Swal.fire({
    title: 'Imprimir Visão Geral',
    text: '"Detalhes" mostra a lista com as colunas que você escolher; "Só Total" mostra apenas os totais e os filtros aplicados.',
    showDenyButton: true,
    showCancelButton: true,
    confirmButtonText: 'Detalhes',
    denyButtonText: 'Só Total',
    cancelButtonText: 'Cancelar',
    reverseButtons: true
  });
  if (isConfirmed) await abrirEscolhaColunasImpressao();
  else if (isDenied) gerarImpressaoSoTotal();
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
    parcelasDoOrcamentoAtual = await fetchComToken(`/faturamento/orcamento/${idorcamento}/parcelas`);
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
    // (de propósito — ver rotaFaturamento), mas já pode ter uma nota "XML
    // Gerada" pendente vinculada. Nesse caso trava o botão (mostra o
    // status da nota, não deixa clicar de novo) pra não duplicar registro.
    let botao = '';
    if (p.status === 'Aberta') {
      botao = p.notaativaid
        ? `<button type="button" class="nf-row-btn" disabled title="Esta parcela já tem uma nota registrada">${p.notaativastatus}</button>
           <button type="button" class="nf-btn-acao gerar" data-idnotafiscal="${p.notaativaid}" title="Gera o XML do RPS (ainda sem assinatura digital)"><i class="fa-solid fa-file-code"></i> Baixar XML</button>`
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
    const xml = await fetchComToken(`/faturamento/${idnotafiscal}/xml`);
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
    await atualizarEmitidasSeVisivel();
  } catch (err) {
    console.error('Erro ao gerar XML da nota:', err);
    aviso('error', 'Erro ao gerar XML', err?.message || 'Não foi possível gerar o XML desta nota.');
  }
}

// Escapa só o suficiente pra texto livre (nome de cliente/evento, descrição
// do serviço etc.) não quebrar a marcação da prévia — diferente de
// escaparAtributo (que só cobre aspas, pensado pra ir dentro de atributo),
// aqui o texto vira conteúdo visível, então também precisa escapar <, > e &.
function escaparTextoPrevia(texto) {
  return String(texto ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Resumo legível (não o XML cru) de tudo que a nota mandaria pra prefeitura —
// pedido explícito do financeiro pra conferir os dados antes de "Enviar
// direto". Os dados vêm do backend (GET /:id/previa), que usa exatamente o
// mesmo cálculo usado pra gerar o XML de verdade — o que aparece aqui é
// garantido bater com o que seria enviado.
async function mostrarPreviaNota(idnotafiscal) {
  let previa;
  try {
    previa = await fetchComToken(`/faturamento/${idnotafiscal}/previa`);
  } catch (err) {
    console.error('Erro ao buscar prévia da nota:', err);
    return aviso('error', 'Erro', 'Não foi possível carregar a prévia desta nota.');
  }

  const linha = (label, valor) => `<div style="display:flex;justify-content:space-between;gap:14px;padding:3px 0;border-bottom:1px solid #f0f0f0;"><span style="color:#666;">${escaparTextoPrevia(label)}</span><span style="font-weight:600;text-align:right;">${valor != null && valor !== '' ? escaparTextoPrevia(valor) : '—'}</span></div>`;
  const secao = (titulo, conteudo) => `
    <div style="margin-bottom:14px;">
      <div style="font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:.03em;color:#942123;margin-bottom:2px;">${escaparTextoPrevia(titulo)}</div>
      ${conteudo}
    </div>`;

  const enderecoEvento = [previa.evento.rua, previa.evento.numero, previa.evento.bairro].filter(Boolean).join(', ')
    + (previa.evento.cep ? ` — CEP ${previa.evento.cep}` : '');

  const html = `
    <div style="text-align:left;max-height:60vh;overflow-y:auto;padding-right:6px;font-size:13.5px;">
      ${previa.aviso ? `<div style="background:#fff3cd;color:#664d03;border:1px solid #ffe69c;border-radius:6px;padding:8px 10px;margin-bottom:14px;font-size:13px;">⚠️ ${escaparTextoPrevia(previa.aviso)}</div>` : ''}
      ${secao('Emissora', linha('Nome', previa.emissora.nome) + linha('CNPJ', previa.emissora.cnpj) + linha('Insc. Municipal', previa.emissora.inscricaomunicipal))}
      ${secao('Cliente', linha('Nome', previa.cliente.nome) + linha('CNPJ', previa.cliente.cnpj) + linha('Insc. Municipal', previa.cliente.inscricaomunicipal) + linha('E-mail NF-e', previa.cliente.email))}
      ${secao('Evento', linha('Nome', previa.evento.nome) + linha('Realização', `${previa.evento.datainicio ? formatarDataBR(previa.evento.datainicio) : '—'} a ${previa.evento.datafim ? formatarDataBR(previa.evento.datafim) : '—'}`) + linha('Endereço', enderecoEvento || null) + linha('Cidade/UF', `${previa.evento.cidade || '—'}/${previa.evento.uf || '—'}`))}
      ${secao('Serviço', linha('Descrição', previa.servico.descricao) + linha('Código', previa.servico.codigoservico) + linha('NBS', previa.servico.nbs) + linha('CIndOp', previa.servico.cindop) + linha('Classificação Tributária', previa.servico.classificacaotributaria))}
      ${secao('Tributação', linha('Município de prestação', previa.tributacao.municipioPrestacao) + (previa.tributacao.foraDeSaoPaulo ? linha('Código IBGE', previa.tributacao.municipioPrestacaoIbge) : ''))}
      ${secao('Valores', linha('Valor do serviço', fmtMoeda(previa.valores.valorservico)) + linha('Alíquota ISS', previa.valores.aliquotaiss != null ? `${previa.valores.aliquotaiss}%` : null) + linha('Valor ISS', previa.valores.valoriss != null ? fmtMoeda(previa.valores.valoriss) : null) + linha('IRRF', previa.valores.valorirrf != null ? fmtMoeda(previa.valores.valorirrf) : null) + linha('PIS/COFINS/CSLL', previa.valores.valorpiscofinscsll != null ? fmtMoeda(previa.valores.valorpiscofinscsll) : null) + linha('CBS', previa.valores.valorcbs != null ? fmtMoeda(previa.valores.valorcbs) : null) + linha('IBS', previa.valores.valoribs != null ? fmtMoeda(previa.valores.valoribs) : null))}
      ${secao('Pagamento', linha('Meio de pagamento', previa.meiopagamento) + linha('Parcela', previa.parcela.numparcela ? `${previa.parcela.numparcela}/${previa.parcela.totalparcelas}` : 'Única'))}
    </div>`;

  await Swal.fire({
    title: `Prévia — ${escaparTextoPrevia(previa.rotulo)}`,
    html,
    width: 640,
    confirmButtonText: 'Fechar'
  });
}

// idorcamento é opcional em todas as ações abaixo: quando a ação parte da
// aba "Notas registradas" (dentro de um orçamento aberto), ele existe e
// recarrega o histórico daquele orçamento; quando parte da aba "Prontas
// para Envio" (que mistura notas de vários orçamentos), ele não existe —
// só a lista de prontas para envio é atualizada nesse caso.
async function atualizarProntasParaEnvioSeVisivel() {
  if (document.getElementById('nfEnvioBody')) await carregarProntasParaEnvio();
}

// Mesma ideia acima, pra aba "Emitidas" — uma nota pode entrar nela (Marcar
// emitida/envio automático com sucesso) ou sair dela (Cancelar).
async function atualizarEmitidasSeVisivel() {
  if (document.getElementById('nfEmitidasBody')) await carregarEmitidas();
}

// Mesma ideia, pra aba "Canceladas" — uma nota entra nela tanto pelo
// cancelamento local quanto pelo cancelamento na prefeitura.
async function atualizarCanceladasSeVisivel() {
  if (document.getElementById('nfCanceladasBody')) await carregarCanceladas();
}

// Mesma ideia, pra aba "Rejeitadas" — uma nota entra nela quando um envio é
// rejeitado/fica incerto, e sai quando é cancelada ou confirmada Emitida.
async function atualizarRejeitadasSeVisivel() {
  if (document.getElementById('nfRejeitadasBody')) await carregarRejeitadas();
}

// ---- Aba "Prontas para Envio" ----
let notasProntasParaEnvioCache = [];

async function carregarProntasParaEnvio() {
  const tbody = document.getElementById('nfEnvioBody');
  tbody.innerHTML = '<tr><td colspan="9">Carregando...</td></tr>';
  document.getElementById('nfEnvioMarcarTodas').checked = false;

  try {
    const notas = await fetchComToken('/faturamento/prontas-envio');
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
          <button type="button" class="nf-btn-acao previa" data-previa="${n.idnotafiscal}" title="Resumo legível de tudo que essa nota mandaria pra prefeitura — pra conferir antes de enviar"><i class="fa-solid fa-eye"></i> Prévia</button>
          <button type="button" class="nf-btn-acao confirmar" data-marcar="${n.idnotafiscal}"><i class="fa-solid fa-check"></i> Marcar emitida</button>
          ${temMasterFaturamento() ? `<button type="button" class="nf-btn-acao cancelar" data-cancelar="${n.idnotafiscal}" title="Cancela apenas no Sistema, não cancela na prefeitura"><i class="fa-solid fa-xmark"></i> Cancelar</button>` : ''}
          ${n.arquivoxml ? `<a class="nf-btn-acao ver" href="/${n.arquivoxml}" target="_blank" title="Abre o último XML gerado, sem gerar de novo"><i class="fa-solid fa-file-lines"></i> Ver XML</a>` : ''}
          ${n.arquivopdf ? `<a class="nf-btn-acao ver" href="/${n.arquivopdf}" target="_blank"><i class="fa-solid fa-file-lines"></i> Ver PDF</a>` : `<button type="button" class="nf-btn-acao anexar" data-anexar="${n.idnotafiscal}"><i class="fa-solid fa-paperclip"></i> Anexar PDF</button>`}
          <button type="button" class="nf-btn-acao gerar" data-idnotafiscal="${n.idnotafiscal}" title="${n.arquivoxml ? 'Gera de novo (sobrescreve o atual) — use se algum dado mudou' : 'Gera o XML do RPS individual desta nota'}"><i class="fa-solid fa-file-code"></i> ${n.arquivoxml ? 'Gerar XML novamente' : 'Baixar XML individual'}</button>
        </td>
      </tr>`).join('');

    tbody.querySelectorAll('[data-previa]').forEach((btn) => {
      btn.addEventListener('click', () => mostrarPreviaNota(btn.dataset.previa));
    });
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

// ---- Aba "Emitidas" ----
function montarQueryFiltrosEmitidas() {
  const params = new URLSearchParams();
  const idcliente = document.getElementById('nfFiltroEmiCliente').value;
  const idempresaemissora = document.getElementById('nfEmiFiltroEmpresaEmissora').value;
  const statusRecebimento = document.getElementById('nfEmiFiltroStatusRecebimento').value;
  const periodo = periodoAnoAtualSeVazio('nfEmiFiltroAnoAtual', 'nfEmiFiltroDe', 'nfEmiFiltroAte');
  const dtDe = periodo.de;
  const dtAte = periodo.ate;

  if (idcliente) params.set('idcliente', idcliente);
  if (idempresaemissora) params.set('idempresaemissora', idempresaemissora);
  if (statusRecebimento) params.set('statusRecebimento', statusRecebimento);
  if (dtDe) params.set('dtDe', dtDe);
  if (dtAte) params.set('dtAte', dtAte);
  return params.toString();
}

function limparFiltrosEmitidas() {
  preencherComboFiltro('EmiCliente', opcoesUnicasOrdenadas(emitidasTodasParaFiltro, 'idcliente', 'cliente_nome'));
  document.getElementById('nfEmiFiltroEmpresaEmissora').value = '';
  document.getElementById('nfEmiFiltroStatusRecebimento').value = '';
  document.getElementById('nfEmiFiltroDe').value = '';
  document.getElementById('nfEmiFiltroAte').value = '';
  document.getElementById('nfEmiFiltroAnoAtual').checked = true;
  carregarEmitidas();
}

let emitidasTodasParaFiltro = [];
let filtrosEmitidasPopulados = false;
let emitidasListaAtual = []; // última lista carregada (já com os filtros atuais) — usada pela impressão

// Recebimento (dinheiro entrou de verdade) é diferente de emissão (obrigação
// fiscal existe) — "Atrasado" aqui é sobre o cliente não ter pago ainda,
// nada a ver com o "Vencida"/"Emissão NF atrasada" da Visão Geral (que é
// sobre não ter emitido a nota a tempo). Mesma comparação em UTC-meia-noite
// já usada em atualizarTotaisGeraisPendentes, pra não depender do fuso de
// quem está usando o sistema.
function estaVencidoParaRecebimento(dtvencimento) {
  if (!dtvencimento) return false;
  const hojeUTC = new Date();
  hojeUTC.setUTCHours(0, 0, 0, 0);
  return new Date(dtvencimento) < hojeUTC;
}

// Totais (Valor total faturado/Recebida/A Receber/Recebimento Atrasado) pros
// filtros atuais da aba Emitidas — pedido explícito. Como aqui cada linha já
// é uma nota Emitida, "Valor total faturado" desses filtros já é, por
// definição, o que foi faturado no período — não precisa ir em Visão Geral
// pra cruzar faturado x recebido, os dois aparecem juntos aqui.
function atualizarTotaisEmitidas(notas) {
  const totais = notas.reduce((acc, n) => {
    const valor = parseFloat(n.valorservico) || 0;
    acc.valor += valor;
    if (n.recebido) acc.pago += valor;
    else if (estaVencidoParaRecebimento(n.dtvencimento)) acc.atrasado += valor;
    else acc.aReceber += valor;
    return acc;
  }, { valor: 0, pago: 0, atrasado: 0, aReceber: 0 });
  document.getElementById('nfEmiTotalValor').textContent = fmtMoeda(totais.valor);
  document.getElementById('nfEmiTotalPago').textContent = fmtMoeda(totais.pago);
  document.getElementById('nfEmiTotalAReceber').textContent = fmtMoeda(totais.aReceber);
  document.getElementById('nfEmiTotalAtrasado').textContent = fmtMoeda(totais.atrasado);
}

async function carregarEmitidas() {
  const tbody = document.getElementById('nfEmitidasBody');
  tbody.innerHTML = '<tr><td colspan="9">Carregando...</td></tr>';

  try {
    const query = montarQueryFiltrosEmitidas();
    const notas = await fetchComToken(`/faturamento/emitidas${query ? '?' + query : ''}`);
    atualizarTotaisEmitidas(notas);
    emitidasListaAtual = notas;

    if (!filtrosEmitidasPopulados) {
      filtrosEmitidasPopulados = true;
      emitidasTodasParaFiltro = notas;
      preencherComboFiltro('EmiCliente', opcoesUnicasOrdenadas(notas, 'idcliente', 'cliente_nome'));
      preencherSelectFiltro('nfEmiFiltroEmpresaEmissora', opcoesUnicasOrdenadas(notas, 'idempresaemissora', 'emissora_nome'), 'Todas');
    }

    if (!notas.length) {
      tbody.innerHTML = '<tr><td colspan="9">Nenhuma nota emitida para os filtros selecionados.</td></tr>';
      return;
    }

    tbody.innerHTML = notas.map((n) => `
      <tr>
        <td>${n.nrorcamento}</td>
        <td>
          ${nomeClienteComFantasia(n.cliente_nome, n.cliente_nmfantasia) || '—'}
          ${!n.cliente_email ? `<br><span class="nf-chip rascunho" title="Preencha em Clientes (campo E-mail NF-e) pra não precisar digitar toda vez que enviar por e-mail">Falta E-mail NF-e</span>` : ''}
        </td>
        <td>${n.evento_nome || '—'}</td>
        <td>${n.numparcela ? `${n.numparcela}/${n.totalparcelas}` : '—'}</td>
        <td>${n.numeronota || '—'}</td>
        <td class="nf-num">${fmtMoeda(n.valorservico)}</td>
        <td>${n.dtregistro ? formatarDataBR(n.dtregistro) : '—'}</td>
        <td>
          ${n.recebido
            ? `<span class="nf-chip pago" title="${n.dtrecebimento ? `Recebido em ${formatarDataBR(n.dtrecebimento)}` : 'Recebido'}"><i class="fa-solid fa-circle-check"></i> Recebida</span>`
            : (estaVencidoParaRecebimento(n.dtvencimento) ? `<span class="nf-chip atrasado"><i class="fa-solid fa-clock"></i> Recebimento Atrasado</span>` : `<span class="nf-chip rascunho">A Receber</span>`)}
          ${n.proprioambiente && temMasterFaturamento() ? `<br><button type="button" class="nf-btn-acao ${n.recebido ? 'cancelar' : 'confirmar'}" data-marcar-recebido="${n.idnotafiscal}" data-recebido-atual="${n.recebido ? '1' : '0'}" title="${n.recebido ? 'Cliente ainda não pagou de verdade? Desfaça aqui' : 'Confirma que o dinheiro realmente entrou (depósito/boleto compensado) — diferente de já ter emitido a nota'}">${n.recebido ? '<i class="fa-solid fa-rotate-left"></i> Desfazer' : '<i class="fa-solid fa-check"></i> Marcar como recebido'}</button>` : ''}
        </td>
        <td>
          ${n.arquivoxml ? `<a class="nf-btn-acao ver" href="/${n.arquivoxml}" target="_blank" title="Abre o último XML gerado, sem gerar de novo"><i class="fa-solid fa-file-lines"></i> Ver XML</a>` : ''}
          ${n.arquivopdf ? `<a class="nf-btn-acao ver" href="/${n.arquivopdf}" target="_blank"><i class="fa-solid fa-file-lines"></i> Ver PDF</a>` : ''}
          ${n.proprioambiente
            ? `${n.arquivopdf && temMasterFaturamento() ? `<button type="button" class="nf-btn-icone remover-pdf" data-remover-pdf="${n.idnotafiscal}" title="Remover PDF anexado (só Master) — libera pra anexar outro no lugar"><i class="fa-solid fa-trash"></i></button>` : ''}
               ${!n.arquivopdf ? `<button type="button" class="nf-btn-acao anexar" data-anexar="${n.idnotafiscal}"><i class="fa-solid fa-paperclip"></i> Anexar PDF</button>` : ''}
               ${n.arquivopdf
                  ? `<button type="button" class="nf-btn-acao email${n.dtenvioemailcliente ? ' ja-enviado' : ''}" data-enviar-email="${n.idnotafiscal}" data-email-cliente="${escaparAtributo(n.cliente_email || '')}" title="${n.dtenvioemailcliente ? `Já enviado em ${formatarDataBR(n.dtenvioemailcliente)} — clique pra enviar de novo` : 'Manda o PDF anexado pro e-mail do cliente'}">${n.dtenvioemailcliente ? '<i class="fa-solid fa-rotate-right"></i> Reenviar e-mail' : '<i class="fa-solid fa-paper-plane"></i> Enviar por E-mail'}</button>`
                  : `<button type="button" class="nf-btn-acao email" disabled title="Anexe o PDF antes de poder enviar por e-mail"><i class="fa-solid fa-paper-plane"></i> Enviar por E-mail</button>`}
               ${temMasterFaturamento() ? `<button type="button" class="nf-btn-acao cancelar-webservice" data-cancelar-webservice="${n.idnotafiscal}" title="Cancela de verdade na prefeitura, via Web Service"><i class="fa-solid fa-triangle-exclamation"></i> Cancelar NF na Prefeitura</button>` : ''}
               <button type="button" class="nf-btn-acao gerar" data-idnotafiscal="${n.idnotafiscal}" title="${n.arquivoxml ? 'Gera de novo (sobrescreve o atual) — use se algum dado mudou' : 'Gera o XML do RPS individual desta nota'}"><i class="fa-solid fa-file-code"></i> ${n.arquivoxml ? 'Gerar XML novamente' : 'Baixar XML individual'}</button>`
            : `<span class="nf-chip rascunho" title="Só visualização por aqui — o processo continua no ambiente de origem">Feito pelo ambiente ${escaparAtributo(n.ambienteorigem_nome || '—')}</span>`}
        </td>
      </tr>`).join('');

    tbody.querySelectorAll('[data-idnotafiscal]').forEach((btn) => {
      btn.addEventListener('click', () => baixarXmlNota(btn.dataset.idnotafiscal));
    });
    tbody.querySelectorAll('[data-anexar]').forEach((btn) => {
      btn.addEventListener('click', () => anexarPdf(btn.dataset.anexar));
    });
    tbody.querySelectorAll('[data-cancelar-webservice]').forEach((btn) => {
      btn.addEventListener('click', () => cancelarNotaWebService(btn.dataset.cancelarWebservice));
    });
    tbody.querySelectorAll('[data-enviar-email]').forEach((btn) => {
      btn.addEventListener('click', () => enviarNotaPorEmail(btn.dataset.enviarEmail, btn.dataset.emailCliente));
    });
    tbody.querySelectorAll('[data-remover-pdf]').forEach((btn) => {
      btn.addEventListener('click', () => removerPdfAnexado(btn.dataset.removerPdf));
    });
    tbody.querySelectorAll('[data-marcar-recebido]').forEach((btn) => {
      btn.addEventListener('click', () => marcarRecebido(btn.dataset.marcarRecebido, btn.dataset.recebidoAtual === '1'));
    });
  } catch (err) {
    console.error('Erro ao carregar notas emitidas:', err);
    tbody.innerHTML = '<tr><td colspan="9">Erro ao carregar notas.</td></tr>';
  }
}

// ---- Impressão (Emitidas) ----
// Mesma ideia do resumoFiltrosPendentesAtivos, mas com as dimensões de
// Emitidas (Cliente/Empresa emissora/Recebimento/Registro) em vez das de
// Visão Geral — por isso não reaproveita a mesma função, os filtros são
// outros.
function resumoFiltrosEmitidasAtivos() {
  const cliente = document.getElementById('nfBuscaEmiCliente').value.trim();
  const selectEmpresa = document.getElementById('nfEmiFiltroEmpresaEmissora');
  const selectRecebimento = document.getElementById('nfEmiFiltroStatusRecebimento');

  return [
    `Cliente: ${cliente || 'Todos'}`,
    `Empresa emissora: ${selectEmpresa.options[selectEmpresa.selectedIndex].text}`,
    `Recebimento: ${selectRecebimento.value ? selectRecebimento.options[selectRecebimento.selectedIndex].text : 'Todas'}`,
    `Registro: ${descricaoPeriodoImpressao('nfEmiFiltroAnoAtual', 'nfEmiFiltroDe', 'nfEmiFiltroAte')}`,
  ];
}

// Texto de status pra impressão — igual ao chip da tela, mas em texto puro
// (impressão não tem botão de ação).
function textoStatusRecebimentoImpressao(n) {
  if (n.recebido) return `Recebida${n.dtrecebimento ? ` (${formatarDataBR(n.dtrecebimento)})` : ''}`;
  return estaVencidoParaRecebimento(n.dtvencimento) ? 'Recebimento Atrasado' : 'A Receber';
}

function linhaTotaisImpressaoEmitidas(totais) {
  return `<tr class="nf-print-total-geral">
    <td class="num">${fmtMoeda(totais.valor)}</td>
    <td class="num">${fmtMoeda(totais.pago)}</td>
    <td class="num">${fmtMoeda(totais.aReceber)}</td>
    <td class="num">${fmtMoeda(totais.atrasado)}</td>
  </tr>`;
}

// Modo único (sem escolha de colunas nem Detalhes/Só Total como em Visão
// Geral) — aqui cada linha já é uma nota individual só, não um orçamento com
// várias parcelas em estados diferentes, então a mesma tabela da tela +
// totais no fim já cobre o que se precisa.
function imprimirEmitidas() {
  const notas = emitidasListaAtual;
  const linhas = notas.map((n) => `<tr>
    <td>${n.nrorcamento}</td>
    <td>${nomeClienteComFantasia(n.cliente_nome, n.cliente_nmfantasia) || '—'}</td>
    <td>${n.evento_nome || '—'}</td>
    <td>${n.numparcela ? `${n.numparcela}/${n.totalparcelas}` : '—'}</td>
    <td>${n.numeronota || '—'}</td>
    <td class="num">${fmtMoeda(n.valorservico)}</td>
    <td>${n.dtregistro ? formatarDataBR(n.dtregistro) : '—'}</td>
    <td>${textoStatusRecebimentoImpressao(n)}</td>
  </tr>`).join('');

  const totais = notas.reduce((acc, n) => {
    const valor = parseFloat(n.valorservico) || 0;
    acc.valor += valor;
    if (n.recebido) acc.pago += valor;
    else if (estaVencidoParaRecebimento(n.dtvencimento)) acc.atrasado += valor;
    else acc.aReceber += valor;
    return acc;
  }, { valor: 0, pago: 0, atrasado: 0, aReceber: 0 });

  const blocoTotal = notas.length ? `
    <table>
      <thead><tr><th class="num">Valor total faturado</th><th class="num">Recebida</th><th class="num">A Receber</th><th class="num">Recebimento Atrasado</th></tr></thead>
      <tbody>${linhaTotaisImpressaoEmitidas(totais)}</tbody>
    </table>` : '';

  const html = cabecalhoImpressao('EMITIDAS', `${notas.length} nota${notas.length === 1 ? '' : 's'}`, resumoFiltrosEmitidasAtivos()) + `
    <table>
      <thead><tr><th>Nº orçamento</th><th>Cliente</th><th>Evento</th><th>Parcela</th><th>Nº da nota</th><th class="num">Valor</th><th>Registrada em</th><th>Recebimento</th></tr></thead>
      <tbody>${linhas || '<tr><td colspan="8">Nenhuma nota emitida para os filtros selecionados.</td></tr>'}</tbody>
    </table>` + blocoTotal;
  imprimirHtmlEmIframe(html);
}

// ---- Aba "Canceladas" ----
function montarQueryFiltrosCanceladas() {
  const params = new URLSearchParams();
  const idcliente = document.getElementById('nfFiltroCancCliente').value;
  const idempresaemissora = document.getElementById('nfCancFiltroEmpresaEmissora').value;
  const periodo = periodoAnoAtualSeVazio('nfCancFiltroAnoAtual', 'nfCancFiltroDe', 'nfCancFiltroAte');
  const dtDe = periodo.de;
  const dtAte = periodo.ate;

  if (idcliente) params.set('idcliente', idcliente);
  if (idempresaemissora) params.set('idempresaemissora', idempresaemissora);
  if (dtDe) params.set('dtDe', dtDe);
  if (dtAte) params.set('dtAte', dtAte);
  return params.toString();
}

function limparFiltrosCanceladas() {
  preencherComboFiltro('CancCliente', opcoesUnicasOrdenadas(canceladasTodasParaFiltro, 'idcliente', 'cliente_nome'));
  document.getElementById('nfCancFiltroEmpresaEmissora').value = '';
  document.getElementById('nfCancFiltroDe').value = '';
  document.getElementById('nfCancFiltroAte').value = '';
  document.getElementById('nfCancFiltroAnoAtual').checked = true;
  carregarCanceladas();
}

let canceladasTodasParaFiltro = [];
let filtrosCanceladasPopulados = false;

async function carregarCanceladas() {
  const tbody = document.getElementById('nfCanceladasBody');
  tbody.innerHTML = '<tr><td colspan="9">Carregando...</td></tr>';

  try {
    const query = montarQueryFiltrosCanceladas();
    const notas = await fetchComToken(`/faturamento/canceladas${query ? '?' + query : ''}`);

    if (!filtrosCanceladasPopulados) {
      filtrosCanceladasPopulados = true;
      canceladasTodasParaFiltro = notas;
      preencherComboFiltro('CancCliente', opcoesUnicasOrdenadas(notas, 'idcliente', 'cliente_nome'));
      preencherSelectFiltro('nfCancFiltroEmpresaEmissora', opcoesUnicasOrdenadas(notas, 'idempresaemissora', 'emissora_nome'), 'Todas');
    }

    if (!notas.length) {
      tbody.innerHTML = '<tr><td colspan="9">Nenhuma nota cancelada para os filtros selecionados.</td></tr>';
      return;
    }

    tbody.innerHTML = notas.map((n) => `
      <tr>
        <td>${n.nrorcamento}</td>
        <td>${nomeClienteComFantasia(n.cliente_nome, n.cliente_nmfantasia) || '—'}</td>
        <td>${n.evento_nome || '—'}</td>
        <td>${n.numparcela ? `${n.numparcela}/${n.totalparcelas}` : '—'}</td>
        <td>${n.numeronota || '—'}</td>
        <td class="nf-num">${fmtMoeda(n.valorservico)}</td>
        <td>${n.dtcancelamento ? formatarDataBR(n.dtcancelamento) : '—'}</td>
        <td${n.justificativacancelamento ? ` title="${escaparAtributo(n.justificativacancelamento)}"` : ''}>${n.justificativacancelamento ? (n.justificativacancelamento.length > 40 ? n.justificativacancelamento.slice(0, 40) + '…' : n.justificativacancelamento) : '—'}</td>
        <td>
          ${n.proprioambiente
            ? `${n.arquivoxml ? `<a class="nf-btn-acao ver" href="/${n.arquivoxml}" target="_blank" title="Abre o último XML gerado antes do cancelamento"><i class="fa-solid fa-file-lines"></i> Ver XML</a>` : ''}
               ${n.arquivopdf ? `<a class="nf-btn-acao ver" href="/${n.arquivopdf}" target="_blank"><i class="fa-solid fa-file-lines"></i> Ver PDF</a>` : `<button type="button" class="nf-btn-acao anexar" data-anexar="${n.idnotafiscal}"><i class="fa-solid fa-paperclip"></i> Anexar PDF</button>`}
               ${n.arquivopdf && temMasterFaturamento() ? `<button type="button" class="nf-btn-icone remover-pdf" data-remover-pdf="${n.idnotafiscal}" title="Remover PDF anexado (só Master) — libera pra anexar outro no lugar"><i class="fa-solid fa-trash"></i></button>` : ''}`
            : `<span class="nf-chip rascunho" title="Só visualização por aqui — o processo continua no ambiente de origem">Feito pelo ambiente ${escaparAtributo(n.ambienteorigem_nome || '—')}</span>`}
        </td>
      </tr>`).join('');

    tbody.querySelectorAll('[data-anexar]').forEach((btn) => {
      btn.addEventListener('click', () => anexarPdf(btn.dataset.anexar));
    });
    tbody.querySelectorAll('[data-remover-pdf]').forEach((btn) => {
      btn.addEventListener('click', () => removerPdfAnexado(btn.dataset.removerPdf));
    });
  } catch (err) {
    console.error('Erro ao carregar notas canceladas:', err);
    tbody.innerHTML = '<tr><td colspan="9">Erro ao carregar notas.</td></tr>';
  }
}

// ---- Aba "Rejeitadas" ----
// Rejeitada (a prefeitura confirmadamente não emitiu) e Envio Incerto
// (falha de rede/timeout, não se sabe se foi processado) juntas numa aba só
// — as duas são "precisa de atenção", nunca viraram NF-e de verdade no
// nosso controle. Antes só dava pra ver abrindo orçamento por orçamento em
// "Emitir nota" (pedido 2026-09-01, depois de um caso real de timeout que
// travou a parcela — ver comentário em GET /orcamento/:id/parcelas).
function montarQueryFiltrosRejeitadas() {
  const params = new URLSearchParams();
  const idcliente = document.getElementById('nfFiltroRejCliente').value;
  const idempresaemissora = document.getElementById('nfRejFiltroEmpresaEmissora').value;
  const periodo = periodoAnoAtualSeVazio('nfRejFiltroAnoAtual', 'nfRejFiltroDe', 'nfRejFiltroAte');
  const dtDe = periodo.de;
  const dtAte = periodo.ate;

  if (idcliente) params.set('idcliente', idcliente);
  if (idempresaemissora) params.set('idempresaemissora', idempresaemissora);
  if (dtDe) params.set('dtDe', dtDe);
  if (dtAte) params.set('dtAte', dtAte);
  return params.toString();
}

function limparFiltrosRejeitadas() {
  preencherComboFiltro('RejCliente', opcoesUnicasOrdenadas(rejeitadasTodasParaFiltro, 'idcliente', 'cliente_nome'));
  document.getElementById('nfRejFiltroEmpresaEmissora').value = '';
  document.getElementById('nfRejFiltroDe').value = '';
  document.getElementById('nfRejFiltroAte').value = '';
  document.getElementById('nfRejFiltroAnoAtual').checked = true;
  carregarRejeitadas();
}

let rejeitadasTodasParaFiltro = [];
let filtrosRejeitadasPopulados = false;

async function carregarRejeitadas() {
  const tbody = document.getElementById('nfRejeitadasBody');
  tbody.innerHTML = '<tr><td colspan="8">Carregando...</td></tr>';

  try {
    const query = montarQueryFiltrosRejeitadas();
    const notas = await fetchComToken(`/faturamento/rejeitadas${query ? '?' + query : ''}`);

    if (!filtrosRejeitadasPopulados) {
      filtrosRejeitadasPopulados = true;
      rejeitadasTodasParaFiltro = notas;
      preencherComboFiltro('RejCliente', opcoesUnicasOrdenadas(notas, 'idcliente', 'cliente_nome'));
      preencherSelectFiltro('nfRejFiltroEmpresaEmissora', opcoesUnicasOrdenadas(notas, 'idempresaemissora', 'emissora_nome'), 'Todas');
    }

    if (!notas.length) {
      tbody.innerHTML = '<tr><td colspan="8">Nenhuma nota rejeitada ou com envio incerto para os filtros selecionados.</td></tr>';
      return;
    }

    tbody.innerHTML = notas.map((n) => `
      <tr>
        <td>${n.nrorcamento}</td>
        <td>${nomeClienteComFantasia(n.cliente_nome, n.cliente_nmfantasia) || '—'}</td>
        <td>${n.evento_nome || '—'}</td>
        <td>${n.numparcela ? `${n.numparcela}/${n.totalparcelas}` : '—'}</td>
        <td class="nf-num">${fmtMoeda(n.valorservico)}</td>
        <td>${n.dtregistro ? formatarDataBR(n.dtregistro) : '—'}</td>
        <td>
          <span class="nf-chip ${n.status === 'Rejeitada' ? 'bloqueio' : 'rascunho'}">${n.status}</span>
          ${n.mensagemenvio ? `<br><span class="nf-hint warn" title="${escaparAtributo(n.mensagemenvio)}">${n.mensagemenvio.length > 60 ? escaparAtributo(n.mensagemenvio.slice(0, 60)) + '…' : escaparAtributo(n.mensagemenvio)}</span>` : ''}
        </td>
        <td>
          ${n.proprioambiente
            ? `${n.status === 'Envio Incerto' ? `<button type="button" class="nf-btn-acao confirmar" data-marcar="${n.idnotafiscal}" title="Confirme no portal da prefeitura antes de marcar"><i class="fa-solid fa-check"></i> Marcar emitida</button>` : ''}
               ${temMasterFaturamento() ? `<button type="button" class="nf-btn-acao cancelar" data-cancelar="${n.idnotafiscal}" title="Cancela apenas no Sistema, não cancela na prefeitura"><i class="fa-solid fa-xmark"></i> Cancelar</button>` : ''}
               ${n.arquivoxml ? `<a class="nf-btn-acao ver" href="/${n.arquivoxml}" target="_blank" title="Abre o último XML gerado, sem gerar de novo"><i class="fa-solid fa-file-lines"></i> Ver XML</a>` : ''}`
            : `<span class="nf-chip rascunho" title="Só visualização por aqui — o processo continua no ambiente de origem">Feito pelo ambiente ${escaparAtributo(n.ambienteorigem_nome || '—')}</span>`}
        </td>
      </tr>`).join('');

    tbody.querySelectorAll('[data-marcar]').forEach((btn) => {
      btn.addEventListener('click', () => marcarComoEmitida(btn.dataset.marcar));
    });
    tbody.querySelectorAll('[data-cancelar]').forEach((btn) => {
      btn.addEventListener('click', () => cancelarNota(btn.dataset.cancelar));
    });
  } catch (err) {
    console.error('Erro ao carregar notas rejeitadas:', err);
    tbody.innerHTML = '<tr><td colspan="8">Erro ao carregar notas.</td></tr>';
  }
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
    const resultado = await fetchComToken('/faturamento/xml-lote/enviar', {
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

    if (!teste) {
      await atualizarProntasParaEnvioSeVisivel();
      await atualizarEmitidasSeVisivel();
    }
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
// Consulta ao vivo (BrasilAPI, via nosso backend) se o cliente é optante do
// Simples Nacional, pra decidir a retenção de IRRF/PIS-COFINS-CSLL — cliente
// Simples Nacional não é obrigado a reter, então "optante confirmado"
// desmarca E trava as caixinhas (ver travarRetencaoSimples); "não
// optante"/"não deu pra confirmar" deixa como está, financeiro decide.
// Trava/destrava as caixinhas de retenção quando o Simples Nacional é
// confirmado — cliente Simples não é obrigado a reter IRRF/PIS-COFINS-CSLL,
// então não faz sentido deixar marcar por engano. `dataset.forcado` registra
// se foi destravada manualmente (ver forcarRetencaoApesarDoSimples), pra
// registrarNota() deixar isso anotado na observação da nota.
function travarRetencaoSimples(travar) {
  const checkIrrf = document.getElementById('nfCheckIrrf');
  const checkPisCofins = document.getElementById('nfCheckPisCofins');
  checkIrrf.disabled = travar;
  checkPisCofins.disabled = travar;
  delete checkIrrf.dataset.forcado;
  delete checkPisCofins.dataset.forcado;
  document.getElementById('nfAvisoRetencaoTravada').style.display = travar ? 'flex' : 'none';
}

// Escape da trava acima — o financeiro pode saber de algo que a BrasilAPI não
// sabe (dado desatualizado, CNPJ errado etc.), então não é uma trava sem
// saída. Fica marcado em dataset.forcado pra entrar na observação da nota.
function forcarRetencaoApesarDoSimples() {
  const checkIrrf = document.getElementById('nfCheckIrrf');
  const checkPisCofins = document.getElementById('nfCheckPisCofins');
  checkIrrf.disabled = false;
  checkPisCofins.disabled = false;
  checkIrrf.dataset.forcado = '1';
  checkPisCofins.dataset.forcado = '1';
  document.getElementById('nfAvisoRetencaoTravada').style.display = 'none';
}

// A BrasilAPI limita a 3 requisições/minuto (ver buscarSimplesNacional.js) —
// depois de 3 respostas 429 seguidas, para de tentar por 3 minutos em vez de
// continuar batendo (só pioraria o bloqueio do lado da BrasilAPI). Zera
// assim que uma consulta der certo.
let tentativas429Consecutivas = 0;
let bloqueadoSimplesAte = 0;
const TEXTO_BTN_VERIFICAR_SIMPLES = 'Verificar Regime Tributário';

async function consultarRegimeSimplesNacional(idcliente, idorcamentoQuandoChamado) {
  const spanSimples = document.getElementById('nfStatusSimplesNacional');
  const btnVerificar = document.getElementById('nfBtnVerificarSimples');

  if (Date.now() < bloqueadoSimplesAte) {
    spanSimples.textContent = 'Limite de consulta excedido, aguarde 3 minutos para nova consulta.';
    spanSimples.className = 'nf-hint';
    spanSimples.style.display = 'block';
    btnVerificar.style.display = '';
    btnVerificar.disabled = true;
    btnVerificar.textContent = 'Aguarde...';
    return;
  }

  let resultado;
  try {
    resultado = await fetchComToken(`/faturamento/cliente/${idcliente}/regime-simples`);
  } catch (err) {
    console.warn('Não deu pra consultar o regime Simples Nacional do cliente:', err);
    // Falha de rede/token — mesmo tratamento do erro== null abaixo: avisa
    // sem travar nada, e deixa o botão "Verificar agora" disponível.
    if (document.getElementById('nfIdOrcamentoAtual').value != idorcamentoQuandoChamado) return;
    spanSimples.textContent = 'Não consegui confirmar o regime tributário agora — verifique manualmente.';
    spanSimples.className = 'nf-hint';
    spanSimples.style.display = 'block';
    btnVerificar.style.display = '';
    return;
  }

  // Enquanto esperava a resposta, o usuário pode ter trocado de orçamento
  // ou fechado a tela — descarta se não for mais o caso atual.
  if (document.getElementById('nfIdOrcamentoAtual').value != idorcamentoQuandoChamado) return;

  if (resultado.optanteSimples === true) {
    tentativas429Consecutivas = 0;
    spanSimples.textContent = 'Cliente optante do Simples Nacional (consultado agora na Receita Federal) — retenção de IRRF/PIS-COFINS-CSLL não se aplica.';
    spanSimples.className = 'nf-hint warn';
    spanSimples.style.display = 'block';
    // Só desmarca se o usuário não tiver marcado manualmente enquanto
    // esperava a resposta — não sobrescreve uma decisão já tomada.
    const checkIrrf = document.getElementById('nfCheckIrrf');
    const checkPisCofins = document.getElementById('nfCheckPisCofins');
    if (!checkIrrf.dataset.tocado) checkIrrf.checked = false;
    if (!checkPisCofins.dataset.tocado) checkPisCofins.checked = false;
    travarRetencaoSimples(true);
    recalcularTributos();
  } else if (resultado.optanteSimples === false) {
    tentativas429Consecutivas = 0;
    spanSimples.textContent = 'Cliente não é optante do Simples Nacional (consultado agora na Receita Federal).';
    spanSimples.className = 'nf-hint ok';
    spanSimples.style.display = 'block';
    travarRetencaoSimples(false);
  } else if (String(resultado.erro || '').includes('429')) {
    tentativas429Consecutivas++;
    if (tentativas429Consecutivas >= 3) {
      const TRES_MINUTOS_MS = 3 * 60 * 1000;
      bloqueadoSimplesAte = Date.now() + TRES_MINUTOS_MS;
      spanSimples.textContent = 'Limite de consulta excedido, aguarde 3 minutos para nova consulta.';
      spanSimples.className = 'nf-hint';
      spanSimples.style.display = 'block';
      btnVerificar.style.display = '';
      btnVerificar.disabled = true;
      btnVerificar.textContent = 'Aguarde...';
      setTimeout(() => {
        tentativas429Consecutivas = 0;
        bloqueadoSimplesAte = 0;
        btnVerificar.disabled = false;
        btnVerificar.textContent = TEXTO_BTN_VERIFICAR_SIMPLES;
      }, TRES_MINUTOS_MS);
      return;
    }
    spanSimples.textContent = `Não consegui confirmar o regime tributário agora (${resultado.erro}) — tente de novo em instantes ou verifique manualmente.`;
    spanSimples.className = 'nf-hint';
    spanSimples.style.display = 'block';
    travarRetencaoSimples(false);
  } else {
    // optanteSimples === null por outro motivo (CNPJ inválido, timeout,
    // etc., não rate-limit) — antes não mostrava nada; agora avisa que não
    // deu pra confirmar em vez de ficar em silêncio.
    tentativas429Consecutivas = 0;
    spanSimples.textContent = `Não consegui confirmar o regime tributário agora${resultado.erro ? ` (${resultado.erro})` : ''} — tente de novo em instantes ou verifique manualmente.`;
    spanSimples.className = 'nf-hint';
    spanSimples.style.display = 'block';
    travarRetencaoSimples(false);
  }
  btnVerificar.style.display = '';
  btnVerificar.disabled = false;
}

async function abrirEmissaoParaOrcamento(idorcamento) {
  mudarAba('emissao');

  try {
    const dados = await fetchComToken(`/faturamento/orcamento/${idorcamento}`);

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
    document.getElementById('nfMunicipioPrestacao').value = dados.montagem_cidade
      ? `${dados.montagem_cidade}${dados.montagem_uf ? '/' + dados.montagem_uf : ''}`
      : 'São Paulo/SP';
    const eventoForaDeSaoPaulo = dados.montagem_cidade && normalizarTexto(dados.montagem_cidade) !== 'SAO PAULO';
    document.getElementById('nfAvisoAliquotaIss').style.display = eventoForaDeSaoPaulo ? 'block' : 'none';
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
    const checkIrrfEl = document.getElementById('nfCheckIrrf');
    const checkPisCofinsEl = document.getElementById('nfCheckPisCofins');
    checkIrrfEl.checked = false;
    checkPisCofinsEl.checked = false;
    delete checkIrrfEl.dataset.tocado;
    delete checkPisCofinsEl.dataset.tocado;
    const spanSimples = document.getElementById('nfStatusSimplesNacional');
    spanSimples.style.display = 'none';
    document.getElementById('nfBtnVerificarSimples').style.display = 'none';
    travarRetencaoSimples(false);
    // Não usa await de propósito — é uma consulta externa (BrasilAPI) que
    // pode demorar; não faz sentido travar o resto da tela esperando ela.
    // Roda em paralelo e só aplica o resultado se o usuário ainda estiver
    // no mesmo orçamento/cliente e não tiver mexido nos checkboxes.
    if (dados.idcliente) consultarRegimeSimplesNacional(dados.idcliente, dados.idorcamento);

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
    const resultado = await fetchComToken(`/faturamento/parametros?ano=${ano}`);
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
    await fetchComToken(`/faturamento/parametros/${ano}`, { method: 'PUT', body });
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
    return aviso('warning', 'Selecione um orçamento', 'Escolha um orçamento na aba "Visão Geral" antes de registrar.');
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

  // Se o financeiro destravou a retenção manualmente (Simples Nacional
  // confirmado, mas decidiu reter mesmo assim), fica anotado na própria nota
  // — é o registro pedido pra esse caso excepcional.
  const forcouRetencao = document.getElementById('nfCheckIrrf').dataset.forcado || document.getElementById('nfCheckPisCofins').dataset.forcado;

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
    observacao: forcouRetencao ? 'Retenção de IRRF/PIS-COFINS-CSLL forçada manualmente pelo financeiro — cliente confirmado como optante do Simples Nacional na Receita Federal.' : null,
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
        await fetchComToken(`/faturamento/parcela/${idparcela}`, { method: 'PATCH', body: { dtvencimento: vencimentoIso } }).catch((err) => {
          console.error('Erro ao atualizar vencimento da parcela:', err);
        });
      }
    }

    await fetchComToken('/faturamento', { method: 'POST', body });
    await aviso('success', 'Registrada', 'Nota fiscal registrada. Emita no portal da prefeitura e depois marque como "Emitida" aqui.');
    await renderHistorico(idorcamento);
    await carregarParcelasNota(idorcamento);
    await carregarPendentes();
    // Se essa parcela tinha uma nota Rejeitada, o backend já cancelou ela
    // automaticamente ao registrar esta nova — atualiza a aba pra sumir com
    // ela de lá também, sem precisar trocar de aba manualmente.
    await atualizarRejeitadasSeVisivel();
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
    const notas = await fetchComToken(`/faturamento/orcamento/${idorcamento}/historico`);
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
          ${podeMarcarEmitida.includes(n.status) ? `<button type="button" class="nf-btn-acao confirmar" data-marcar="${n.idnotafiscal}"><i class="fa-solid fa-check"></i> Marcar emitida</button>` : ''}
          ${podeCancelar.includes(n.status) && temMasterFaturamento() ? `<button type="button" class="nf-btn-acao cancelar" data-cancelar="${n.idnotafiscal}" title="Cancela apenas no Sistema, não cancela na prefeitura"><i class="fa-solid fa-xmark"></i> Cancelar</button>` : ''}
          ${n.arquivoxml ? `<a class="nf-btn-acao ver" href="/${n.arquivoxml}" target="_blank" title="Abre o último XML gerado, sem gerar de novo"><i class="fa-solid fa-file-lines"></i> Ver XML</a>` : ''}
          ${n.status !== 'Cancelada' ? `<button type="button" class="nf-btn-acao gerar" data-idnotafiscal="${n.idnotafiscal}" title="${n.arquivoxml ? 'Gera de novo (sobrescreve o atual) — use se algum dado mudou' : 'Gera o XML do RPS (ainda sem assinatura digital)'}"><i class="fa-solid fa-file-code"></i> ${n.arquivoxml ? 'Gerar XML novamente' : 'Baixar XML'}</button>` : ''}
          ${n.arquivopdf ? `<a class="nf-btn-acao ver" href="/${n.arquivopdf}" target="_blank"><i class="fa-solid fa-file-lines"></i> Ver PDF</a>` : `<button type="button" class="nf-btn-acao anexar" data-anexar="${n.idnotafiscal}"><i class="fa-solid fa-paperclip"></i> Anexar PDF</button>`}
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
  const hoje = new Date().toISOString().slice(0, 10);
  const { value: dados } = await Swal.fire({
    title: 'Confirmar nota emitida',
    html: `
      <div style="text-align:left;display:flex;flex-direction:column;gap:10px;">
        <div style="display:flex;flex-direction:column;gap:3px;">
          <label style="font-size:13px;font-weight:600;">Número da nota *</label>
          <input id="swalNumeroNota" class="swal2-input" placeholder="Ex.: 00001261" style="margin:0;width:auto;">
        </div>
        <div style="display:flex;flex-direction:column;gap:3px;">
          <label style="font-size:13px;font-weight:600;">Data de emissão *</label>
          <input id="swalDataEmissao" type="date" class="swal2-input" value="${hoje}" style="margin:0;width:auto;">
        </div>
        <div style="display:flex;flex-direction:column;gap:3px;">
          <label style="font-size:13px;font-weight:600;">Chave de acesso (opcional)</label>
          <input id="swalChaveAcesso" class="swal2-input" placeholder="Chave de acesso da NFS-e" style="margin:0;width:auto;">
        </div>
        <div style="display:flex;flex-direction:column;gap:3px;">
          <label style="font-size:13px;font-weight:600;">Código de verificação (opcional)</label>
          <input id="swalCodigoVerificacao" class="swal2-input" placeholder="Ex.: R2UY-RKLC" style="margin:0;width:auto;">
        </div>
      </div>`,
    showCancelButton: true,
    confirmButtonText: 'Salvar',
    focusConfirm: false,
    preConfirm: () => {
      const numeronota = document.getElementById('swalNumeroNota').value.trim();
      const dtemissao = document.getElementById('swalDataEmissao').value;
      if (!numeronota || !dtemissao) {
        Swal.showValidationMessage('Informe pelo menos o número da nota e a data de emissão.');
        return false;
      }
      return {
        numeronota,
        dtemissao,
        chaveacesso: document.getElementById('swalChaveAcesso').value.trim() || null,
        codigoverificacao: document.getElementById('swalCodigoVerificacao').value.trim() || null,
      };
    }
  });
  if (!dados) return;

  try {
    await fetchComToken(`/faturamento/${idnotafiscal}`, {
      method: 'PUT',
      body: { status: 'Emitida', ...dados }
    });
    if (idorcamento) await renderHistorico(idorcamento);
    await atualizarProntasParaEnvioSeVisivel();
    await atualizarEmitidasSeVisivel();
    await atualizarRejeitadasSeVisivel();
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
    html: 'A nota será cancelada no sistema e a parcela vinculada será liberada, voltando a ficar "Aberta" pra você registrar outra nota no lugar dela. Essa nota cancelada continua no histórico, só pra referência.<br><br><b>Cancela apenas no Sistema, não cancela na prefeitura</b> — essa nota nunca chegou a ser emitida de verdade lá.',
    showCancelButton: true,
    confirmButtonText: 'Sim, cancelar',
    cancelButtonText: 'Voltar',
    reverseButtons: true,
    focusCancel: true
  });
  if (!isConfirmed) return;

  // Mesma trava do "Cancelar NF na Prefeitura": exige justificativa antes de
  // confirmar — evita perder o controle da parcela com um clique errado sem
  // deixar rastro do motivo. Fica na mesma coluna (justificativacancelamento).
  const { value: justificativa } = await Swal.fire({
    icon: 'warning',
    title: 'Justificativa do cancelamento',
    input: 'textarea',
    inputPlaceholder: 'Explique o motivo do cancelamento (obrigatório)...',
    showCancelButton: true,
    confirmButtonText: 'Confirmar cancelamento',
    cancelButtonText: 'Voltar',
    reverseButtons: true,
    inputValidator: (valor) => {
      if (!valor || !valor.trim()) return 'Informe a justificativa antes de confirmar.';
    }
  });
  if (!justificativa) return;

  try {
    await fetchComToken(`/faturamento/${idnotafiscal}`, {
      method: 'PUT',
      body: { status: 'Cancelada', justificativa: justificativa.trim() }
    });
    if (idorcamento) {
      await renderHistorico(idorcamento);
      await carregarParcelasNota(idorcamento);
    }
    await atualizarProntasParaEnvioSeVisivel();
    await atualizarEmitidasSeVisivel();
    await atualizarCanceladasSeVisivel();
    await atualizarRejeitadasSeVisivel();
    await carregarPendentes();
  } catch (err) {
    console.error('Erro ao cancelar nota:', err);
    aviso('error', 'Erro', 'Não foi possível cancelar a nota.');
  }
}

// Diferente de cancelarNota (que só marca 'Cancelada' no nosso banco): aqui a
// prefeitura é avisada de verdade, via Web Service (CancelamentoNFe). Não
// existe modo de teste pra isso — por isso o texto do Swal é mais forte que o
// do cancelamento local, deixando claro que não tem volta.
async function cancelarNotaWebService(idnotafiscal) {
  const { isConfirmed } = await Swal.fire({
    icon: 'warning',
    title: 'Cancelar NF na Prefeitura?',
    html: 'Isso vai <b>avisar a prefeitura de verdade</b>, via Web Service — diferente do botão "Cancelar" comum, que só mexe no nosso sistema.<br><br>Não existe modo de teste pra cancelamento: essa ação é <b>definitiva e não pode ser desfeita</b>.',
    showCancelButton: true,
    confirmButtonText: 'Sim, cancelar na prefeitura',
    cancelButtonText: 'Voltar',
    reverseButtons: true,
    focusCancel: true,
    confirmButtonColor: '#c0392b'
  });
  if (!isConfirmed) return;

  // Segunda trava: exige justificativa antes de mandar o pedido de verdade —
  // fica salva na nota (justificativacancelamento) pra consulta futura.
  const { value: justificativa } = await Swal.fire({
    icon: 'warning',
    title: 'Justificativa do cancelamento',
    input: 'textarea',
    inputPlaceholder: 'Explique o motivo do cancelamento (obrigatório)...',
    showCancelButton: true,
    confirmButtonText: 'Confirmar cancelamento',
    cancelButtonText: 'Voltar',
    reverseButtons: true,
    confirmButtonColor: '#c0392b',
    inputValidator: (valor) => {
      if (!valor || !valor.trim()) return 'Informe a justificativa antes de confirmar.';
    }
  });
  if (!justificativa) return;

  try {
    const resultado = await fetchComToken(`/faturamento/${idnotafiscal}/cancelar-webservice`, {
      method: 'POST',
      body: { justificativa: justificativa.trim() }
    });
    await Swal.fire({ icon: 'success', title: 'Cancelada na prefeitura', text: resultado.mensagem || 'Nota cancelada com sucesso.' });
    await carregarEmitidas();
    await atualizarCanceladasSeVisivel();
    await carregarPendentes();
  } catch (err) {
    console.error('Erro ao cancelar nota na prefeitura:', err);
    await Swal.fire({
      icon: 'error',
      title: 'Não foi possível cancelar',
      text: (err.corpo && err.corpo.message) || 'A prefeitura não confirmou o cancelamento — confira manualmente antes de tentar de novo.'
    });
  }
}

// Manda o PDF já anexado pro e-mail do cliente, por SMTP (ver
// utils/enviarEmail.js no backend). emailPadrao vem do cadastro do cliente
// (clienteempresas.emailnfe) mas fica editável no Swal — dá pra corrigir na
// hora se estiver errado/desatualizado, sem precisar sair da tela pra
// atualizar o cadastro primeiro.
async function enviarNotaPorEmail(idnotafiscal, emailPadrao) {
  const { value: destinatario } = await Swal.fire({
    icon: emailPadrao ? 'question' : 'warning',
    title: 'Enviar nota por e-mail',
    html: emailPadrao ? '' : '<div style="color:#b45309;font-size:13px;margin-bottom:8px;">Esse cliente não tem "E-mail NF-e" cadastrado. Pode digitar um só pra esse envio, mas cadastre em Clientes pra não precisar digitar de novo da próxima vez.</div>',
    input: 'email',
    inputValue: emailPadrao || '',
    inputPlaceholder: 'email@cliente.com.br',
    showCancelButton: true,
    confirmButtonText: 'Enviar',
    cancelButtonText: 'Cancelar',
    reverseButtons: true,
    inputValidator: (valor) => {
      if (!valor || !valor.trim()) return 'Informe o e-mail de destino.';
    }
  });
  if (!destinatario) return;

  // Busca o texto padrão (assunto + corpo) pra pré-preencher o swal de
  // revisão — se falhar, deixa em branco e o usuário digita na mão (o
  // backend ainda cai no próprio texto padrão se mandar vazio).
  let padrao = { assunto: '', corpoTexto: '' };
  try {
    padrao = await fetchComToken(`/faturamento/${idnotafiscal}/preview-email`);
  } catch (err) {
    console.error('Erro ao buscar prévia do e-mail:', err);
  }

  const { value: dadosEmail } = await Swal.fire({
    title: 'Como o e-mail vai ser enviado',
    html:
      '<div style="text-align:left;">' +
      '<label for="swal-email-assunto" style="display:block;font-size:12.5px;font-weight:600;margin-bottom:4px;">Assunto</label>' +
      '<input id="swal-email-assunto" class="swal2-input" style="margin:0 0 16px;width:100%;max-width:100%;font-size:15px;">' +
      '<label for="swal-email-corpo" style="display:block;font-size:12.5px;font-weight:600;margin-bottom:4px;">Corpo do e-mail</label>' +
      '<textarea id="swal-email-corpo" class="swal2-textarea" style="margin:0;width:100%;max-width:100%;height:320px;font-size:15px;"></textarea>' +
      '</div>',
    width: 720,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'Enviar',
    cancelButtonText: 'Cancelar',
    reverseButtons: true,
    didOpen: () => {
      document.getElementById('swal-email-assunto').value = padrao.assunto || '';
      document.getElementById('swal-email-corpo').value = padrao.corpoTexto || '';
    },
    preConfirm: () => {
      const assunto = document.getElementById('swal-email-assunto').value.trim();
      const corpoTexto = document.getElementById('swal-email-corpo').value.trim();
      if (!assunto || !corpoTexto) {
        Swal.showValidationMessage('Preencha o assunto e o corpo do e-mail.');
        return false;
      }
      return { assunto, corpoTexto };
    }
  });
  if (!dadosEmail) return;

  Swal.fire({
    title: 'Aguarde',
    text: 'Enviando e-mail...',
    allowOutsideClick: false,
    allowEscapeKey: false,
    showConfirmButton: false,
    didOpen: () => Swal.showLoading()
  });

  try {
    const resultado = await fetchComToken(`/faturamento/${idnotafiscal}/enviar-email`, {
      method: 'POST',
      body: { destinatario: destinatario.trim(), assunto: dadosEmail.assunto, corpoTexto: dadosEmail.corpoTexto }
    });
    await Swal.fire({
      icon: 'success',
      title: 'E-mail enviado',
      html: `Nota enviada para ${destinatario.trim()}.<br><br>` +
        (resultado.salvouEmEnviados
          ? `<span style="color:#046800;"><i class="fa-solid fa-check"></i> Cópia salva na pasta "Enviados" de ${resultado.caixaEnviados || 'financeiro'}.</span>`
          : `<span style="color:#b45309;"><i class="fa-solid fa-triangle-exclamation"></i> Não deu pra salvar a cópia na pasta "Enviados" — foi mandada uma cópia de aviso por e-mail pro financeiro.</span>`)
    });
    await carregarEmitidas();
  } catch (err) {
    console.error('Erro ao enviar nota por e-mail:', err);
    await Swal.fire({
      icon: 'error',
      title: 'Não foi possível enviar',
      text: (err.corpo && err.corpo.message) || 'Não foi possível enviar o e-mail — confira as configurações de SMTP.'
    });
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
      await fetchComToken(`/faturamento/${idnotafiscal}/anexo`, { method: 'POST', body: formData });
      if (idorcamento) await renderHistorico(idorcamento);
      await atualizarProntasParaEnvioSeVisivel();
      await atualizarEmitidasSeVisivel();
      await atualizarCanceladasSeVisivel();
    } catch (err) {
      console.error('Erro ao anexar arquivo:', err);
      aviso('error', 'Erro', 'Não foi possível anexar o arquivo.');
    }
  };
  input.click();
}

// Restrito a Master (botão só aparece pra quem tem a flag — ver
// temMasterFaturamento) — desfaz um PDF anexado por engano, liberando
// "Anexar PDF" de novo pra subir o correto. Mesma trava de justificativa do
// cancelamento: some com o comprovante de uma nota já emitida, não é uma
// ação qualquer.
async function removerPdfAnexado(idnotafiscal) {
  const { isConfirmed } = await Swal.fire({
    icon: 'warning',
    title: 'Remover o PDF anexado?',
    text: 'O arquivo atual será apagado e o botão "Anexar PDF" volta a aparecer pra subir o correto no lugar.',
    showCancelButton: true,
    confirmButtonText: 'Sim, remover',
    cancelButtonText: 'Voltar',
    reverseButtons: true,
    focusCancel: true
  });
  if (!isConfirmed) return;

  const { value: justificativa } = await Swal.fire({
    icon: 'warning',
    title: 'Justificativa da remoção',
    input: 'textarea',
    inputPlaceholder: 'Explique o motivo (obrigatório)...',
    showCancelButton: true,
    confirmButtonText: 'Confirmar remoção',
    cancelButtonText: 'Voltar',
    reverseButtons: true,
    inputValidator: (valor) => {
      if (!valor || !valor.trim()) return 'Informe a justificativa antes de confirmar.';
    }
  });
  if (!justificativa) return;

  try {
    await fetchComToken(`/faturamento/${idnotafiscal}/remover-anexo`, {
      method: 'POST',
      body: { justificativa: justificativa.trim() }
    });
    await atualizarEmitidasSeVisivel();
    await atualizarCanceladasSeVisivel();
  } catch (err) {
    console.error('Erro ao remover PDF anexado:', err);
    aviso('error', 'Erro', (err.corpo && err.corpo.message) || 'Não foi possível remover o PDF anexado.');
  }
}

// Confirma (ou desfaz) que o cliente realmente pagou — diferente de "emitir
// a nota" (obrigação fiscal), esse é o regime de caixa: só marca quando o
// dinheiro entrou de verdade (depósito/boleto compensado conferido pelo
// financeiro). Restrito a Master (pedido explícito), sem justificativa
// exigida (diferente de cancelar/remover PDF).
async function marcarRecebido(idnotafiscal, recebidoAtual) {
  let dtrecebimento = null;

  if (recebidoAtual) {
    const { isConfirmed } = await Swal.fire({
      icon: 'question',
      title: 'Desfazer marcação de recebido?',
      text: 'Volta a aparecer como "A Receber" ou "Recebimento Atrasado" (conforme o vencimento).',
      showCancelButton: true,
      confirmButtonText: 'Sim, desfazer',
      cancelButtonText: 'Voltar',
      reverseButtons: true
    });
    if (!isConfirmed) return;
  } else {
    const hoje = new Date();
    const hojeBR = `${String(hoje.getDate()).padStart(2, '0')}/${String(hoje.getMonth() + 1).padStart(2, '0')}/${hoje.getFullYear()}`;

    // Data editável, pré-preenchida com hoje — o dinheiro pode ter entrado
    // numa sexta à noite e só ser conferido/confirmado no sistema na
    // segunda, então "agora" nem sempre é a data certa de recebimento.
    const { value: dataDigitada } = await Swal.fire({
      icon: 'question',
      title: 'Confirmar recebimento',
      html: 'Confirme só depois de já ter conferido o depósito ou o boleto compensado.<br>Informe a data em que o dinheiro <strong>realmente entrou</strong> (pode ser diferente de hoje).',
      input: 'text',
      inputValue: hojeBR,
      inputPlaceholder: 'dd/mm/aaaa',
      inputAttributes: { maxlength: '10', autocomplete: 'off' },
      showCancelButton: true,
      confirmButtonText: 'Sim, confirmar',
      cancelButtonText: 'Voltar',
      reverseButtons: true,
      didOpen: () => {
        const input = Swal.getInput();
        input.addEventListener('input', () => mascararDataDigitada(input));
      },
      inputValidator: (valor) => {
        const iso = converterDataBRParaISO((valor || '').trim());
        if (!iso) return 'Informe uma data válida (dd/mm/aaaa).';
        const hojeMeiaNoite = new Date();
        hojeMeiaNoite.setHours(0, 0, 0, 0);
        if (new Date(`${iso}T00:00:00`) > hojeMeiaNoite) return 'A data de recebimento não pode ser no futuro.';
      }
    });
    if (!dataDigitada) return;
    dtrecebimento = converterDataBRParaISO(dataDigitada.trim());
  }

  try {
    await fetchComToken(`/faturamento/${idnotafiscal}/recebido`, {
      method: 'PUT',
      body: { recebido: !recebidoAtual, dtrecebimento }
    });
    await atualizarEmitidasSeVisivel();
  } catch (err) {
    console.error('Erro ao atualizar recebimento:', err);
    aviso('error', 'Erro', (err.corpo && err.corpo.message) || 'Não foi possível atualizar o recebimento.');
  }
}

// ---- Inicialização (chamada pelo loader genérico de módulos) ----
function configurarEventosNotaFiscal() {
  inicializarLogoEmpresaImpressao();

  document.querySelectorAll('#cadModalNotaFiscal .nf-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => mudarAba(btn.dataset.nfTab));
  });

  document.getElementById('nfMeioPagamento').addEventListener('change', (e) => {
    document.getElementById('nfCampoOutrosPag').style.display = e.target.value === '99' ? 'flex' : 'none';
    atualizarDadosBancarios();
  });
  document.getElementById('nfBtnInserirDadosBancarios').addEventListener('click', inserirDadosBancariosNaDescricao);
  document.getElementById('nfBtnVerificarSimples').addEventListener('click', () => {
    const idcliente = document.getElementById('nfIdClienteAtual').value;
    const idorcamento = document.getElementById('nfIdOrcamentoAtual').value;
    if (idcliente && idorcamento) consultarRegimeSimplesNacional(idcliente, idorcamento);
  });
  document.getElementById('nfBtnForcarRetencao').addEventListener('click', forcarRetencaoApesarDoSimples);
  document.getElementById('nfBtnInserirValor').addEventListener('click', inserirValorNaDescricao);
  document.getElementById('nfBtnInserirParcela').addEventListener('click', inserirParcelaNaDescricao);
  document.getElementById('nfBtnInserirVencimento').addEventListener('click', inserirVencimentoNaDescricao);

  document.getElementById('nfBtnTestarEnvio').addEventListener('click', () => enviarLote(true));
  document.getElementById('nfBtnEnviarDireto').addEventListener('click', () => enviarLote(false));
  if (!temMasterFaturamento()) {
    document.getElementById('nfBtnTestarEnvio').style.display = 'none';
    document.getElementById('nfBtnEnviarDireto').style.display = 'none';
  }
  document.getElementById('nfEnvioFiltroEmpresa').addEventListener('change', renderizarNotasProntasParaEnvio);
  document.getElementById('nfEnvioMarcarTodas').addEventListener('change', (e) => {
    document.querySelectorAll('.nf-envio-check:not(:disabled)').forEach((chk) => { chk.checked = e.target.checked; });
    atualizarContagemEnvio();
  });

  document.getElementById('nfParcelaVencimento').addEventListener('input', (e) => {
    mascararDataDigitada(e.target);
  });

  // Cada par De/Até tem seu próprio check "Ano atual" (Realização/Vencimento
  // são independentes — ver periodoAnoAtualSeVazio): digitar um período
  // manualmente nesse grupo desmarca o check sozinho, e marcar o check de
  // novo limpa os campos (o período digitado não faria mais sentido
  // convivendo com "Ano atual").
  [
    { de: 'nfFiltroRealizacaoDe', ate: 'nfFiltroRealizacaoAte', check: 'nfFiltroRealizacaoAnoAtual' },
    { de: 'nfFiltroVencimentoDe', ate: 'nfFiltroVencimentoAte', check: 'nfFiltroVencimentoAnoAtual' },
    { de: 'nfEmiFiltroDe', ate: 'nfEmiFiltroAte', check: 'nfEmiFiltroAnoAtual' },
    { de: 'nfCancFiltroDe', ate: 'nfCancFiltroAte', check: 'nfCancFiltroAnoAtual' },
    { de: 'nfRejFiltroDe', ate: 'nfRejFiltroAte', check: 'nfRejFiltroAnoAtual' },
  ].forEach(({ de, ate, check }) => {
    [de, ate].forEach((id) => {
      document.getElementById(id).addEventListener('input', (e) => {
        mascararDataDigitada(e.target);
        if (e.target.value.trim()) document.getElementById(check).checked = false;
      });
    });
    document.getElementById(check).addEventListener('change', (e) => {
      if (e.target.checked) {
        document.getElementById(de).value = '';
        document.getElementById(ate).value = '';
      }
    });
  });
  document.getElementById('nfBtnFiltrarPendentes').addEventListener('click', carregarPendentes);
  document.getElementById('nfBtnLimparFiltrosPendentes').addEventListener('click', limparFiltrosPendentes);
  document.getElementById('nfBtnImprimirPendentes').addEventListener('click', imprimirVisaoGeral);
  ligarComboFiltro('Cliente', aoMudarClienteFiltro);
  ligarComboFiltro('Evento', aoMudarEventoFiltro);
  document.querySelectorAll('#nfTabelaPendentesHead th[data-sort]').forEach((th) => {
    th.addEventListener('click', () => ordenarPendentes(th.dataset.sort));
  });

  document.getElementById('nfBtnFiltrarEmitidas').addEventListener('click', carregarEmitidas);
  document.getElementById('nfBtnLimparFiltrosEmitidas').addEventListener('click', limparFiltrosEmitidas);
  document.getElementById('nfBtnImprimirEmitidas').addEventListener('click', imprimirEmitidas);
  ligarComboFiltro('EmiCliente', () => {});

  document.getElementById('nfBtnFiltrarCanceladas').addEventListener('click', carregarCanceladas);
  document.getElementById('nfBtnLimparFiltrosCanceladas').addEventListener('click', limparFiltrosCanceladas);
  ligarComboFiltro('CancCliente', () => {});

  document.getElementById('nfBtnFiltrarRejeitadas').addEventListener('click', carregarRejeitadas);
  document.getElementById('nfBtnLimparFiltrosRejeitadas').addEventListener('click', limparFiltrosRejeitadas);
  ligarComboFiltro('RejCliente', () => {});

  ['nfValorServico', 'nfAliquotaIss'].forEach((id) => {
    document.getElementById(id).addEventListener('input', recalcularTributos);
  });
  ['nfCheckIrrf', 'nfCheckPisCofins'].forEach((id) => {
    const el = document.getElementById(id);
    el.addEventListener('change', recalcularTributos);
    // Marca que o usuário mexiu manualmente, pra consultarRegimeSimplesNacional
    // não sobrescrever a escolha dele se a resposta da BrasilAPI chegar depois.
    el.addEventListener('change', () => { el.dataset.tocado = '1'; });
  });

  document.getElementById('nfBtnRegistrar').addEventListener('click', registrarNota);
  if (!temMasterFaturamento()) document.getElementById('nfBtnRegistrar').style.display = 'none';
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
  if (modulo.trim().toLowerCase() === 'faturamento') {
    configurarEventosNotaFiscal();
  }
};

// A chave precisa bater EXATAMENTE com o data-modulo do link do menu
// ("Faturamento") — fecharModal() em Index.js busca por window.moduloAtual
// sem normalizar caixa, então 'faturamento' (minúsculo) nunca seria encontrado.
window.moduloHandlers = window.moduloHandlers || {};
window.moduloHandlers['Faturamento'] = {
  configurar: configurarEventosNotaFiscal,
  desinicializar: destravarScrollDeFundo
};
