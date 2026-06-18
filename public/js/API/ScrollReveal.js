const SR = window.ScrollReveal;

// --- Instâncias por lista ---

export function animarListaEventos() {
    SR({
        origin: 'left',
        distance: '30px',
        duration: 1000,
        easing: 'ease-out',
        reset: true,
        viewFactor: 0,
        container: document.getElementById('lista-dados-eventos'),
    }).reveal('#lista-dados-eventos li', { interval: 10 });
}

export function animarListaClientes() {
    SR({
        origin: 'right',
        distance: '30px',
        duration: 1000,
        easing: 'ease-out',
        reset: false,
        viewFactor: 0,
        container: document.getElementById('lista-dados-clientes'),
    }).reveal('#lista-dados-clientes li', { interval: 80 });
}

export function animarListaOrcamentos() {
    SR({
        origin: 'right',
        distance: '20px',
        duration: 1000,
        easing: 'ease-out',
        reset: false,
        viewFactor: 0,
        container: document.getElementById('lista-dados-orcamento'),
    }).reveal('#lista-dados-orcamento > li', { interval: 100 });
}

export function animarListaOrcEdicao() {
    SR({
      origin: 'left',
      distance: '50px',
      duration: 4000,
      easing: 'ease-in-out',
      reset: false,
      viewFactor: 0,
      container: document.getElementsByClassName('lista-dados-orcamento'),
    }).reveal('.pasta-Edicao > li',{interval: 80 });
}