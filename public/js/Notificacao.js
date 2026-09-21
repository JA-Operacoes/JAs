// public/js/Notificacoes.js
export { buscarNotificacoes };
import { exibirToastGeral, exibirToast } from './Toast.js?v=3';

const TOKEN = localStorage.getItem('token');

// ─────────────────────────────────────────────
// TOASTS
// ─────────────────────────────────────────────
function carregarToastsExibidos() {
  const salvo = JSON.parse(localStorage.getItem('toastsExibidos') || '{}');
  const hoje  = new Date().toISOString().split('T')[0];
  if (salvo.dia !== hoje) {
    localStorage.removeItem('toastsExibidos');
    return new Set();
  }
  return new Set(salvo.ids || []);
}

function salvarToastsExibidos() {
  const hoje = new Date().toISOString().split('T')[0];
  localStorage.setItem('toastsExibidos', JSON.stringify({
    dia: hoje,
    ids: [...toastsExibidos]
  }));
}

const toastsExibidos = carregarToastsExibidos();

// ─────────────────────────────────────────────
// API
// ─────────────────────────────────────────────
async function apiFetch(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      'idempresa': localStorage.getItem('idempresa'),
      ...options.headers
    }
  });
}

// ─────────────────────────────────────────────
// ESTADO GLOBAL
// ─────────────────────────────────────────────
let listaCompletaGlobal = [];
let abaAtiva = 'Todas';

// ─────────────────────────────────────────────
// NORMALIZAÇÃO DE STATUS
// ─────────────────────────────────────────────
function normalizarStatus(notif, fonte) {
  let status = 'Todas';

    const mapaClasse = {
    'Pendente':   'notif-pendente',
    'Aprovada':   'notif-aprovada',
    'Recusada':   'notif-recusada',
    'Finalizado': 'notif-finalizado',
    'Vencidos':   'notif-vencidos',
  };

  if (fonte === 'banco') {
    status = notif.status || 'Todas';

  } else if (fonte === 'sol') {
    // Backend já normaliza: 'Pendente', 'Aprovada', 'Recusada', 'Finalizado'
    status = notif.status || 'Pendente';

  } else if (fonte === 'inclusao') {
    status = notif.status || 'Aprovada';

  } else if (fonte === 'retornoInclusao') {
    status = notif.status || 'Finalizado';

  } else if (fonte === 'agenda') {
    status = 'Pendente';

  } else if (fonte === 'pag') {
    // Backend manda 'Vencidos' ou 'Pendente'
    status = notif.status || 'Pendente';

  } else if (fonte === 'empresaSemLogo') {
    // Fica em "Pendente" até alguém subir o que falta (logo/ícone) — não some
    // sozinho por tempo/leitura, só quando a empresa realmente ficar completa.
    status = 'Pendente';
  }

  // Para 'pag', o backend já calcula classeStatus (notif-vencidos, notif-hoje etc.) — preservar
  const classeStatus = fonte === 'pag'
      ? (notif.classeStatus || mapaClasse[status] || '')
      : (mapaClasse[status] || '');

  return { ...notif, status, classeStatus };
}

// ─────────────────────────────────────────────
// ABAS
// ─────────────────────────────────────────────
function montarAbas() {
  const master     = window.temPermissao?.('Staff', 'master')     ?? false;
  const financeiro = window.temPermissao?.('Staff', 'financeiro') ?? false;

  const abas = [
    { key: 'Todas',      label: 'Todas',       icon: 'notifications' },
    { key: 'Pendente',   label: 'Pendentes',   icon: 'schedule' },
    { key: 'Aprovada',   label: 'Aprovadas',   icon: 'check_circle' },
    { key: 'Recusada',   label: 'Recusadas',   icon: 'cancel' },
    { key: 'Finalizado', label: 'Finalizados', icon: 'task_alt' },
  ];

  if (master || financeiro) {
    abas.push({ key: 'Vencidos', label: 'Vencidos', icon: 'brightness_alert' });
  }

  // Ajusta altura da lista conforme quantidade de abas (cada aba extra = ~80px no aside)
  const altura = (master || financeiro) ? '560px' : '460px';
  document.documentElement.style.setProperty('--lista-height', altura);

  return abas;
}

// Chamado ao clicar no toast-resumo de contas vencidas (ver listaPag.forEach
// em buscarNotificacoes) — abre o dropdown do sino já na aba "Vencidos".
function abrirNotificacoesVencidos() {
  abaAtiva = 'Vencidos';
  document.getElementById('notif-dropdown')?.classList.add('aberto');
  renderizarAbas(listaCompletaGlobal);
  renderizarLista(listaCompletaGlobal.filter(n => n.status === 'Vencidos'));
}

// ─────────────────────────────────────────────
// BUSCAR NOTIFICAÇÕES
// ─────────────────────────────────────────────
async function buscarNotificacoes() {
  try {
    // A ordem dos nomes aqui precisa bater exatamente com a ordem das chamadas
    // abaixo — bug antigo (anterior a essa sessão): a partir da 4ª posição os
    // nomes estavam desalinhados (ex.: "resPag" recebia na real a resposta de
    // inclusão de orçamentos, e "resRetornoInclusao" recebia a de pagamentos-
    // contas). Resultado: o toast de "Conta Vencida" disparava um por conta
    // (via o bloco de retornoInclusao, nunca tocado) mesmo depois de resumir
    // o bloco — porque o resumo tinha sido aplicado na variável errada.
    const [resNotif, resAgenda, resSol, resInclusao, resRetornoInclusao, resPag, resEmpresasSemLogo] = await Promise.all([
      apiFetch(`/notificacoes?status=${abaAtiva === 'Todas' ? '' : abaAtiva}`),
      apiFetch('/notificacoes/agenda-notificacao'),
      apiFetch('/notificacoes/solicitacoes-notificacao'),
      apiFetch('/notificacoes/inclusao-orcamentos-notificacao'),
      apiFetch('/notificacoes/retorno-Inclusao'),
      apiFetch('/notificacoes/pagamentos-contas'),
      apiFetch('/notificacoes/empresas-sem-logo'),
    ]);

    const data                = await resNotif.json();
    const agendaData          = await resAgenda.json();
    const solData             = await resSol.json();
    const inclusaoData        = await resInclusao.json();
    const retornoInclusaoData = await resRetornoInclusao.json();
    const pagData             = await resPag.json();
    // 403 pra quem não é Devs (rota gated por exigirFlag('devs')) cai aqui mesmo,
    // vira "não é array" e some — sem checagem de permissão duplicada no front.
    const empresasSemLogoData = await resEmpresasSemLogo.json();

    const notificacoesBanco    = data.notificacoes || [];
    const listaAgenda          = Array.isArray(agendaData)          ? agendaData          : [];
    const listaSol             = Array.isArray(solData)             ? solData             : [];
    const listaPag             = Array.isArray(pagData)             ? pagData             : [];
    const listaInclusao        = Array.isArray(inclusaoData)        ? inclusaoData        : [];
    const listaRetornoInclusao = Array.isArray(retornoInclusaoData) ? retornoInclusaoData : [];
    const listaEmpresasSemLogo = Array.isArray(empresasSemLogoData) ? empresasSemLogoData : [];

    // --- TOASTS ---
    listaAgenda.forEach(notif => {
      if (!toastsExibidos.has(notif.id)) {
        exibirToastGeral(notif);
        toastsExibidos.add(notif.id);
        salvarToastsExibidos();
      }
    });
    listaSol.forEach(notif => {
      if (!toastsExibidos.has(notif.id)) {
        exibirToastGeral(notif);
        toastsExibidos.add(notif.id);
        salvarToastsExibidos();
      }
    });
    listaInclusao.forEach(notif => {
      if (!toastsExibidos.has(notif.id)) {
        exibirToastGeral(notif);
        toastsExibidos.add(notif.id);
        salvarToastsExibidos();
      }
    });
    listaRetornoInclusao.forEach(notif => {
      if (!toastsExibidos.has(notif.id)) {
        exibirToastGeral(notif);
        toastsExibidos.add(notif.id);
        salvarToastsExibidos();
      }
    });
    // Contas vencidas: um toast por conta tomava a tela inteira quando havia
    // muitas de uma vez (o hover pra "desempilhar" cobria até o menu
    // principal). Um único toast-resumo, clicável, abre a lista completa
    // (aba "Vencidos" do sino) em vez de inundar a tela.
    const pagNovas = listaPag.filter(notif => !toastsExibidos.has(notif.id));
    if (pagNovas.length > 0) {
      const vencidasNovas = pagNovas.filter(n => n.status === 'Vencidos');
      if (vencidasNovas.length > 0) {
        exibirToast(
          'danger',
          vencidasNovas.length === 1 ? '1 conta vencida' : `${vencidasNovas.length} contas vencidas`,
          'Clique para ver todas',
          abrirNotificacoesVencidos
        );
      }
      pagNovas.forEach(notif => toastsExibidos.add(notif.id));
      salvarToastsExibidos();
    }

    // Empresas com logo/ícone incompleto (logo, logoclaro, iconeescuro ou
    // iconeclaro) — só quem tem a flag Devs recebe essa lista (rota já filtra no
    // backend, exigirFlag('devs') — não Supremo, só Devs cadastra logo/ícone).
    // O toast é só o "acabou de aparecer" (reaparece todo dia, mesma janela de
    // toastsExibidos dos outros); a lista persistente fica na aba "Pendentes"
    // do sino (ver normalizarStatus/listaCompletaGlobal mais abaixo) enquanto
    // a empresa continuar incompleta — não precisa gravar notificacao pra
    // isso, mesmo esquema computado na hora que já é usado em "pag"/Vencidos.
    const empresasSemLogoNovas = listaEmpresasSemLogo.filter(notif => !toastsExibidos.has(notif.id));
    if (empresasSemLogoNovas.length > 0) {
      const nomes = empresasSemLogoNovas.map(n => n.nmfantasia).join(', ');
      exibirToast(
        'warning',
        empresasSemLogoNovas.length === 1
          ? '1 empresa sem logo/ícone completo'
          : `${empresasSemLogoNovas.length} empresas sem logo/ícone completo`,
        nomes
      );
      empresasSemLogoNovas.forEach(notif => toastsExibidos.add(notif.id));
      salvarToastsExibidos();
    }

    // --- NORMALIZAÇÃO E MONTAGEM DA LISTA ---
    const listaAgendaNorm     = listaAgenda.map(n          => normalizarStatus(n, 'agenda'));
    const listaNotifBancoNorm = notificacoesBanco.map(n    => normalizarStatus(n, 'banco'));
    const listaSolNorm        = listaSol.map(n             => normalizarStatus(n, 'sol'));
    const listaPagNorm        = listaPag.map(n             => normalizarStatus(n, 'pag'));
    const listaInclusaoNorm   = listaInclusao.map(n        => normalizarStatus(n, 'inclusao'));
    const listaRetornoNorm    = listaRetornoInclusao.map(n => normalizarStatus(n, 'retornoInclusao'));
    const listaEmpresasSemLogoNorm = listaEmpresasSemLogo.map(n => normalizarStatus(n, 'empresaSemLogo'));

    listaCompletaGlobal = [
      ...listaAgendaNorm,
      ...listaNotifBancoNorm,
      ...listaSolNorm,
      ...listaPagNorm,
      ...listaEmpresasSemLogoNorm,
      ...listaInclusaoNorm,
      ...listaRetornoNorm,
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // --- BADGE ---
    const solNaoLidas             = listaSol.filter(s => !s.read).length;
    const pagNaoLidas             = listaPag.filter(p => !p.read).length;
    const inclusaoNaoLidas        = listaInclusao.filter(i => !i.read).length;
    const retornoInclusaoNaoLidas = listaRetornoInclusao.filter(r => !r.read).length;
    const empresasSemLogoNaoLidas = listaEmpresasSemLogo.filter(e => !e.read).length;
    const totalNaoLidas = (data.naoLidas || 0) + listaAgenda.length + solNaoLidas + pagNaoLidas + inclusaoNaoLidas + retornoInclusaoNaoLidas + empresasSemLogoNaoLidas;

    atualizarBadge(totalNaoLidas);
    renderizarAbas(listaCompletaGlobal);

    const filtradas = abaAtiva === 'Todas'
      ? listaCompletaGlobal
      : listaCompletaGlobal.filter(n => n.status === abaAtiva);
    renderizarLista(filtradas);

  } catch (e) {
    console.error('Erro ao buscar notificações:', e);
  }
}

// ─────────────────────────────────────────────
// RENDERIZAR ABAS
// ─────────────────────────────────────────────
function renderizarAbas(todasNotificacoes) {
  const container = document.getElementById('notif-abas');
  if (!container) return;

  const ABAS = montarAbas(); // monta aqui para garantir que window.temPermissao já está disponível

  container.innerHTML = ABAS.map(a => {
    const count = a.key === 'Todas'
      ? todasNotificacoes.length
      : todasNotificacoes.filter(n => n.status === a.key).length;

    return `
      <button class="aba-btn ${abaAtiva === a.key ? 'ativa' : ''}" data-key="${a.key}">
        <span class="material-symbols-outlined">${a.icon}</span>
        ${a.label}
        <span class="aba-badge">${count}</span>
      </button>
    `;
  }).join('');

  container.querySelectorAll('.aba-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      abaAtiva = btn.dataset.key;
      renderizarAbas(listaCompletaGlobal);
      const filtradas = abaAtiva === 'Todas'
        ? listaCompletaGlobal
        : listaCompletaGlobal.filter(n => n.status === abaAtiva);
      renderizarLista(filtradas);
    });
  });
}

// ─────────────────────────────────────────────
// RENDERIZAR LISTA
// ─────────────────────────────────────────────
function renderizarLista(notificacoes) {
  const lista = document.getElementById('notif-lista');
  if (!lista) return;

  if (!notificacoes.length) {
    lista.innerHTML = '<li class="notif-vazia">Nenhuma notificação</li>';
    return;
  }

  lista.innerHTML = notificacoes.map(n => `
    <li class="notif-item ${n.read ? 'notif-lida' : 'notif-nao-lida'} ${n.classeStatus || ''} ${n.type || ''}"
        data-id="${n.id}" 
        data-lida="${n.read}" 
        style="${n.read ? 'opacity: 0.6; pointer-events: none;' : ''}">
      
      <span class="notif-icone ${n.type}">
        <span class="material-symbols-outlined">${n.icon || 'notifications'}</span>
      </span>

      <div class="notif-conteudo">
        <div class="notif-info">
          <p class="notif-mensagem">${n.message}</p>
          <small class="notif-data">${n.subtext || ''}</small>
          <small class="notif-data">${n.subtext2 || ''}</small>
          </div>
          <div class="notif-icone-read ${n.typeRead || ''}">
          <small class="notif-data">${formatarData(n.created_at)}</small>
          <span class="material-symbols-outlined">${n.iconRead || 'check_small'}</span>
        </div>
      </div>
    </li>
  `).join('');

  lista.querySelectorAll('.notif-item').forEach(item => {
    item.addEventListener('click', () => {
      if (item.dataset.lida === 'false' || !item.classList.contains('notif-lida')) {
        marcarComoLida(item.dataset.id);
      }
    });
  });
}

// ─────────────────────────────────────────────
// UTILITÁRIOS
// ─────────────────────────────────────────────
function atualizarBadge(count) {
  const badge = document.getElementById('notif-badge');
  if (!badge) return;
  badge.textContent = count > 9 ? '9+' : count;
  badge.style.display = count > 0 ? 'flex' : 'none';
}

function formatarData(iso) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

async function marcarComoLida(id) {
  await apiFetch(`/notificacoes/${id}/lida`, { method: 'PATCH' });
  buscarNotificacoes();
}

async function marcarTodasComoLidas() {
  await apiFetch('/notificacoes/todas-lidas', { method: 'PATCH' });
  buscarNotificacoes();
}

// ─────────────────────────────────────────────
// SINO / DROPDOWN
// ─────────────────────────────────────────────
function iniciarSino() {
  const bell     = document.getElementById('notif-sino');
  const dropdown = document.getElementById('notif-dropdown');
  const btnTodas = document.getElementById('notif-marcar-todas');

  if (!bell || !dropdown) return;

  bell.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('aberto');
  });

  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target) && e.target !== bell) {
      dropdown.classList.remove('aberto');
    }
  });

  if (btnTodas) btnTodas.addEventListener('click', marcarTodasComoLidas);
}

// ─────────────────────────────────────────────
// INICIALIZAÇÃO
// ─────────────────────────────────────────────
async function atualizarTudo() {
  await buscarNotificacoes();
}

document.addEventListener('DOMContentLoaded', () => {
  iniciarSino();
  atualizarTudo();

  // Polling a cada 10s
  setInterval(atualizarTudo, 10000);

  // Reset de toasts à meia-noite (verifica a cada minuto)
  setInterval(() => {
    const agora = new Date();
    if (agora.getHours() === 0 && agora.getMinutes() === 0) {
      toastsExibidos.clear();
      salvarToastsExibidos();
      buscarNotificacoes();
    }
  }, 60000);
});