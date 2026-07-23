// public/js/Notificacoes.js
export { buscarNotificacoes };
import { exibirToastGeral } from './Toast.js';

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

// ─────────────────────────────────────────────
// BUSCAR NOTIFICAÇÕES
// ─────────────────────────────────────────────
async function buscarNotificacoes() {
  try {
    const [resNotif, resAgenda, resSol, resPag, resInclusao, resRetornoInclusao] = await Promise.all([
      apiFetch(`/notificacoes?status=${abaAtiva === 'Todas' ? '' : abaAtiva}`),
      apiFetch('/notificacoes/agenda-notificacao'),
      apiFetch('/notificacoes/solicitacoes-notificacao'),
      apiFetch('/notificacoes/inclusao-orcamentos-notificacao'),
      apiFetch('/notificacoes/retorno-Inclusao'),
      apiFetch('/notificacoes/pagamentos-contas'),
    ]);

    const data                = await resNotif.json();
    const agendaData          = await resAgenda.json();
    const solData             = await resSol.json();
    const pagData             = await resPag.json();
    const inclusaoData        = await resInclusao.json();
    const retornoInclusaoData = await resRetornoInclusao.json();

    const notificacoesBanco    = data.notificacoes || [];
    const listaAgenda          = Array.isArray(agendaData)          ? agendaData          : [];
    const listaSol             = Array.isArray(solData)             ? solData             : [];
    const listaPag             = Array.isArray(pagData)             ? pagData             : [];
    const listaInclusao        = Array.isArray(inclusaoData)        ? inclusaoData        : [];
    const listaRetornoInclusao = Array.isArray(retornoInclusaoData) ? retornoInclusaoData : [];

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
    listaPag.forEach(notif => {
      if (!toastsExibidos.has(notif.id)) {
        toastsExibidos.add(notif.id);
        salvarToastsExibidos();
      }
    });

    // --- NORMALIZAÇÃO E MONTAGEM DA LISTA ---
    const listaAgendaNorm     = listaAgenda.map(n          => normalizarStatus(n, 'agenda'));
    const listaNotifBancoNorm = notificacoesBanco.map(n    => normalizarStatus(n, 'banco'));
    const listaSolNorm        = listaSol.map(n             => normalizarStatus(n, 'sol'));
    const listaPagNorm        = listaPag.map(n             => normalizarStatus(n, 'pag'));
    const listaInclusaoNorm   = listaInclusao.map(n        => normalizarStatus(n, 'inclusao'));
    const listaRetornoNorm    = listaRetornoInclusao.map(n => normalizarStatus(n, 'retornoInclusao'));

    listaCompletaGlobal = [
      ...listaAgendaNorm,
      ...listaNotifBancoNorm,
      ...listaSolNorm,
      ...listaPagNorm,
      ...listaInclusaoNorm,
      ...listaRetornoNorm,
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // --- BADGE ---
    const solNaoLidas             = listaSol.filter(s => !s.read).length;
    const pagNaoLidas             = listaPag.filter(p => !p.read).length;
    const inclusaoNaoLidas        = listaInclusao.filter(i => !i.read).length;
    const retornoInclusaoNaoLidas = listaRetornoInclusao.filter(r => !r.read).length;
    const totalNaoLidas = (data.naoLidas || 0) + listaAgenda.length + solNaoLidas + pagNaoLidas + inclusaoNaoLidas + retornoInclusaoNaoLidas;

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