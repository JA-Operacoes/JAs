// public/js/Notificacoes.js
export { buscarNotificacoes };
const TOKEN = localStorage.getItem('token');
const toastsExibidos = new Set();

async function apiFetch(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json', ...options.headers }
  });
}

async function atualizarTudo() {
    //console.log("%cAtualizando notificações...","background: #4FD1C5;");
    await buscarNotificacoes(); // Aquela função que faz os fetches
}
atualizarTudo();
setInterval(() => {
    atualizarTudo();
}, 30000);

async function buscarNotificacoes() {
  try {
    const [resNotif, resAgenda] = await Promise.all([
      apiFetch('/notificacoes'),
      apiFetch('/notificacoes/agenda-notificacao')
    ]);

    const data = await resNotif.json();
    const agendaData = await resAgenda.json();

    const notificacoesBanco = data.notificacoes || [];
    const listaAgenda = Array.isArray(agendaData) ? agendaData : [];

    // --- LÓGICA DO TOAST ---
    // Percorremos apenas a lista da agenda para disparar os alertas
    listaAgenda.forEach(notif => {
            // Se o ID é novo nesta sessão, dispara o Toast
            if (!toastsExibidos.has(notif.id)) {
                exibirToastAgenda(notif);
                toastsExibidos.add(notif.id);
            }
        });
    // -----------------------

    const listaCompleta = [...listaAgenda, ...notificacoesBanco];
    
    // Somamos as não lidas do banco com as "fictícias" da agenda
    const totalNaoLidas = (data.naoLidas || 0) + listaAgenda.length;

    atualizarBadge(totalNaoLidas);
    renderizarLista(listaCompleta);

  } catch (e) {
    console.error('Erro ao buscar notificações:', e);
  }
}

function atualizarBadge(count) {
  const badge = document.getElementById('notif-badge');
  if (!badge) return;
  badge.textContent = count > 9 ? '9+' : count;
  badge.style.display = count > 0 ? 'flex' : 'none';
}

function exibirToastAgenda(notif) {
    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 10000,
        timerProgressBar: true,
        didOpen: (toast) => {
            toast.addEventListener('mouseenter', Swal.stopTimer)
            toast.addEventListener('mouseleave', Swal.resumeTimer)
        }
    });

    Toast.fire({
        icon: notif.type === 'danger' ? 'error' : notif.type, // Ajusta o ícone do Swal
        title: notif.message,
        background: document.body.classList.contains('dark-theme') ? '#333' : '#fff',
        color: document.body.classList.contains('dark-theme') ? '#fff' : '#000'
    });
}

function renderizarLista(notificacoes) {
  console.log('entrou no renderizarLista com notificações');
  const lista = document.getElementById('notif-lista');
  if (!lista) return;

  if (!notificacoes.length) {
    lista.innerHTML = '<li class="notif-vazia">Nenhuma notificação</li>';
    return;
  }

  lista.innerHTML = notificacoes.map(n => `
      <li class="notif-item ${n.read ? '' : 'notif-nao-lida'}" data-id="${n.id}">
        
        <span class="notif-icone ${n.type}">
          <span class="material-symbols-outlined">
            ${n.icon || 'notifications'}
          </span>
        </span>

        <div class="notif-conteudo">
          <div class="notif-info">
            <p class="notif-mensagem">${n.message}</p>
            <small class="notif-data">${formatarData(n.created_at)}</small>
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
      if (item.dataset.lida === 'false') marcarComoLida(item.dataset.id);
    });
  });
}

function iconePorTipo(type) {
  const icons = { success: 'fa-check-circle', warning: 'fa-exclamation-triangle', danger: 'fa-times-circle', info: 'fa-info-circle' };
  return icons[type] || icons.info;
}

function formatarData(iso) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

async function marcarComoLida(id) {
  await apiFetch(`/notificacoes/${id}/lida`, { method: 'PATCH' });
  buscarNotificacoes();
}

async function marcarTodasComoLidas() {
  await apiFetch('/notificacoes/todas-lidas', { method: 'PATCH' });
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
  setInterval(buscarNotificacoes, 30000); // polling a cada 30s
});
