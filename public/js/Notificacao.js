// public/js/Notificacoes.js
export { buscarNotificacoes };
import { exibirToastGeral } from './Toast.js';
const TOKEN = localStorage.getItem('token');

function carregarToastsExibidos() {
  const salvo = JSON.parse(localStorage.getItem('toastsExibidos') || '{}');
  const hoje = new Date().toISOString().split('T')[0]; // "2025-04-22"

  // Se o dia salvo for diferente do hoje, reseta
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

async function apiFetch(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json', ...options.headers }
  });
}

async function atualizarTudo() {
    console.log("%cAtualizando notificações...","background: #4FD1C5;");
    await buscarNotificacoes();
}
atualizarTudo();
setInterval(() => {
    atualizarTudo();
}, 10000);

async function buscarNotificacoes() {
  try {
    const [resNotif, resAgenda, resSol, resPag, resInclusao, resRetornoInclusao] = await Promise.all([
      apiFetch('/notificacoes'),
      apiFetch('/notificacoes/agenda-notificacao'),
      apiFetch('/notificacoes/solicitacoes-notificacao'),
      apiFetch('/notificacoes/inclusao-orcamentos-notificacao'),
      apiFetch('/notificacoes/retorno-Inclusao'),
      apiFetch('/notificacoes/pagamentos-contas')
    ]);

    const data = await resNotif.json();
    const agendaData = await resAgenda.json();
    const solData = await resSol.json();
    const pagData = await resPag.json();
    const inclusaoData = await resInclusao.json();
    const retornoInclusaoData = await resRetornoInclusao.json();

    console.log('📋 notificações do banco:', data.notificacoes);
    console.log('📋 notificações da agenda:', agendaData);
    console.log('📋 solicitações recebidas:', solData);
    console.log('📋 pagamentos a vencer:', pagData);
    console.log('📋 aditivos extras autorizados:', inclusaoData);
    console.log('📋 retornos do usuário:', retornoInclusaoData);

    const notificacoesBanco = data.notificacoes || [];
    const listaAgenda = Array.isArray(agendaData) ? agendaData : [];
    const listaSol = Array.isArray(solData) ? solData : [];
    const listaPag = Array.isArray(pagData) ? pagData : [];
    const listaInclusao = Array.isArray(inclusaoData) ? inclusaoData : [];
    const listaRetornoInclusao = Array.isArray(retornoInclusaoData) ? retornoInclusaoData : [];

    // --- LÓGICA DO TOAST ---
    // Percorremos apenas a lista da agenda para disparar os alertas
    listaAgenda.forEach(notif => {
        // Se o ID é novo nesta sessão, dispara o Toast
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
    // -----------------------

    const listaCompleta = [
      ...listaAgenda, ...notificacoesBanco, ...listaSol, ...listaPag, ...listaInclusao, ...listaRetornoInclusao
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    // Somamos as não lidas do banco com as "fictícias" da agenda
    const solNaoLidas = listaSol.filter(s => !s.read).length;
    const pagNaoLidas = listaPag.filter(p => !p.read).length;
    const inclusaoNaoLidas = listaInclusao.filter(i => !i.read).length;
    const retornoInclusaoNaoLidas = listaRetornoInclusao.filter(r => !r.read).length;
    const totalNaoLidas = (data.naoLidas || 0) + listaAgenda.length + solNaoLidas + pagNaoLidas + inclusaoNaoLidas + retornoInclusaoNaoLidas;

    atualizarBadge(totalNaoLidas);
    renderizarLista(listaCompleta);

  } catch (e) {
    console.error('Erro ao buscar notificações:', e);
  }
}

function renderizarLista(notificacoes) {
  //console.log('entrou no renderizarLista com notificações');
  const lista = document.getElementById('notif-lista');
  if (!lista) return;

  if (!notificacoes.length) {
    lista.innerHTML = '<li class="notif-vazia">Nenhuma notificação</li>';
    return;
  }

  lista.innerHTML = notificacoes.map(n => `
      <li class="notif-item ${n.read ? 'notif-lida' : 'notif-nao-lida'}" 
          data-id="${n.id}" 
          data-lida="${n.read}" 
          style="${n.read ? 'opacity: 0.6; pointer-events: none;' : ''}">
        
        <span class="notif-icone ${n.type}">
          <span class="material-symbols-outlined">
            ${n.icon || 'notifications'}
          </span>
        </span>

        <div class="notif-conteudo">
          <div class="notif-info">
            <p class="notif-mensagem">${n.message}</p>
            <small class="notif-data">${formatarData(n.created_at)}</small>
            <small class="notif-data">${n.subtext || ''}</small>
          </div>

          <div class="notif-icone-read ${n.typeRead || ''}">
            <span class="material-symbols-outlined"> ${n.iconRead || 'check_small'} </span>
          </div>

        </div>

      </li>
  `).join('');

  console.log('Renderizando notificações:', notificacoes);

  lista.querySelectorAll('.notif-item').forEach(item => {
    item.addEventListener('click', () => {
        // Verifica se é "false" (string) porque dataset sempre retorna string
        if (item.dataset.lida === 'false' || !item.classList.contains('notif-lida')) {
            marcarComoLida(item.dataset.id);
        }
    });
  });
}

function atualizarBadge(count) {
  const badge = document.getElementById('notif-badge');
  if (!badge) return;
  badge.textContent = count > 9 ? '9+' : count;
  badge.style.display = count > 0 ? 'flex' : 'none';
}


function iconePorTipo(type) {
  const icons = { success: 'fa-check-circle', warning: 'fa-exclamation-triangle', danger: 'fa-times-circle', info: 'fa-info-circle' };
  const solicitacaoIcons = { 'Aprovada': 'check_circle', 'Rejeitada': 'cancel', 'Pendente': 'hourglass_top' };
  return icons[type] || solicitacaoIcons[notif.tiposolicitacao] || icons.info;
}

function formatarData(iso) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

async function marcarComoLida(id) {
  console.log('🖱️ Clicou para marcar como lida:', id); // ← ADICIONE
  const res = await apiFetch(`/notificacoes/${id}/lida`, { method: 'PATCH' });
  console.log('✅ Resposta:', res.status); // ← ADICIONE
  buscarNotificacoes();
}

async function marcarTodasComoLidas() {
  await apiFetch('/notificacoes/${id}/todas-lidas', { method: 'PATCH' });
  buscarNotificacoes();
}

function iniciarSino() {
  const bell = document.getElementById('notif-sino');
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

// Inicializa ao carregar
document.addEventListener('DOMContentLoaded', () => {
  iniciarSino();
  buscarNotificacoes();
  setInterval(buscarNotificacoes, 10000); // polling a cada 10s

   setInterval(() => {
    const agora = new Date();
    if (agora.getHours() === 17 && agora.getMinutes() === 50) {
      toastsExibidos.clear();
      salvarToastsExibidos();
      buscarNotificacoes(); // vai reexibir todos os toasts
    }
  }, 60000);

});
