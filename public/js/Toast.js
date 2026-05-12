// toast.js — Sistema de toasts empilháveis
// Substitui exibirToastAgenda e exibirToastSolicitacao do Notificacoes.js
// Uso: import { exibirToast } from './toast.js';

const DURATION = 8000;
const GAP = 10;
const STACK_OFFSET = 6;

let toasts = [];
let container = null;

function getContainer() {
  if (container && document.body.contains(container)) return container;

  container = document.createElement('div');
  container.id = 'toast-stack-container';
  document.body.appendChild(container);

  container.addEventListener('mouseenter', () => {
    container.classList.add('toast-hovered');
    layout(true);
    toasts.forEach(t => t.pauseFn && t.pauseFn());
  });

  container.addEventListener('mouseleave', () => {
    container.classList.remove('toast-hovered');
    layout(false);
    toasts.forEach(t => t.resumeFn && t.resumeFn());
  });

  return container;
}

function updateBadge() {
  const c = getContainer();
  let badge = c.querySelector('.toast-count-badge');
  if (!badge) {
    badge = document.createElement('div');
    badge.className = 'toast-count-badge';
    c.appendChild(badge);
  }
  if (toasts.length > 1) {
    badge.style.display = 'flex';
    badge.textContent = toasts.length;
  } else {
    badge.style.display = 'none';
  }
}

function layout(hovered) {
  const c = getContainer();
  const n = toasts.length;

  if (hovered) {
    let top = 0;
    for (let i = n - 1; i >= 0; i--) {
      toasts[i].el.style.transform = `translateY(${top}px) scale(1)`;
      toasts[i].el.style.opacity = '1';
      toasts[i].el.style.zIndex = i + 1;
      top += toasts[i].el.offsetHeight + GAP;
    }
    const totalH = toasts.reduce((acc, t) => acc + t.el.offsetHeight + GAP, 0);
    c.style.height = totalH + 'px';
  } else {
    toasts.forEach((t, i) => {
      const fromTop = n - 1 - i;
      const scale = 1 - fromTop * 0.04;
      const ty = fromTop * STACK_OFFSET;
      t.el.style.transform = `translateY(${ty}px) scale(${scale})`;
      t.el.style.opacity = fromTop > 3 ? '0' : String(1 - fromTop * 0.15);
      t.el.style.zIndex = i + 1;
    });
    const topEl = toasts.length ? toasts[toasts.length - 1].el : null;
    c.style.height = topEl
      ? topEl.offsetHeight + (toasts.length - 1) * STACK_OFFSET + 10 + 'px'
      : '0px';
  }
}

function removeToast(obj) {
  obj.el.style.opacity = '0';
  obj.el.style.transform += ' translateX(30px)';
  setTimeout(() => {
    obj.el.remove();
    toasts = toasts.filter(t => t !== obj);
    layout(getContainer().classList.contains('toast-hovered'));
    updateBadge();
    if (toasts.length === 0) getContainer().style.height = '0px';
  }, 250);
}

/**
 * Exibe um toast empilhável.
 * @param {string} type   - 'success' | 'warning' | 'danger' | 'info'
 * @param {string} msg    - Mensagem principal
 * @param {string} [sub]  - Subtítulo opcional
 */
export function exibirToast(type, msg, sub = '') {
  const c = getContainer();
  const isDark = document.body.classList.contains('dark-theme');

  const el = document.createElement('div');
  el.className = `toast-item toast-${type}`;

  const icons = {
    success: 'check_circle',
    warning: 'warning',
    danger: 'cancel',
    info: 'notifications'
  };

  el.innerHTML = `
    <span class="toast-icon material-symbols-outlined">${icons[type] || 'notifications'}</span>
    <div class="toast-body">
      <span class="toast-msg">${msg}</span>
      ${sub ? `<span class="toast-sub">${sub}</span>` : ''}
    </div>
    <button class="toast-close" title="Fechar">×</button>
    <div class="toast-bar"></div>
  `;

  c.appendChild(el);

  const obj = { el, type, msg };
  let elapsed = 0;
  let paused = false;
  let rafId = null;
  const bar = el.querySelector('.toast-bar');

  function startTick(offsetElapsed = 0) {
    elapsed = offsetElapsed;
    let lastTs = null;
    function tick(ts) {
      if (!lastTs) lastTs = ts;
      elapsed += ts - lastTs;
      lastTs = ts;
      const pct = Math.max(0, 100 - (elapsed / DURATION) * 100);
      bar.style.width = pct + '%';
      if (elapsed >= DURATION) { removeToast(obj); return; }
      if (!paused) rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);
  }

  obj.pauseFn = () => {
    paused = true;
    if (rafId) cancelAnimationFrame(rafId);
  };
  obj.resumeFn = () => {
    if (!paused) return;
    paused = false;
    startTick(elapsed);
  };

  el.querySelector('.toast-close').addEventListener('click', e => {
    e.stopPropagation();
    removeToast(obj);
  });

  toasts.push(obj);
  startTick();

  requestAnimationFrame(() => {
    layout(c.classList.contains('toast-hovered'));
    updateBadge();
  });
}

// ─── Funções de compatibilidade com o Notificacoes.js existente ───────────────
export function exibirToastGeral(notif) {
    exibirToast(
      notif.type === 'danger' ? 'danger' : (notif.type || 'info'),
      notif.message,
      notif.subtext || ''
    );
}