// public/js/permissoes.js

// 1) Função genérica para aplicar as permissões no DOM
function aplicarPermissoes(permissoes) {
  const moduloAtual = window.moduloAtual;
  console.log("moduloAtual:", moduloAtual);
  console.log("permissoes recebidas:", permissoes);
  permissoes.forEach(p => {
    console.log("Item de permissao:", p);
    console.log("p.modulo:", p.modulo);
  });

  const p = permissoes.find(x =>
    x.modulo &&
    moduloAtual &&
    x.modulo.trim().toLowerCase() === moduloAtual.trim().toLowerCase()
  );
  console.log("Comparando moduloAtual:", moduloAtual);
  permissoes.forEach(p => console.log("Comparando com:", p.modulo));

  console.log("Entrou no aplicarPermissoes", moduloAtual, p);
  console.log("PERMISSOES", permissoes);  
  
  // se não tiver acesso geral, bloqueia tudo
  if (!p || !p.acesso) {

    document.querySelectorAll("input, select, textarea, button")
            .forEach(el => el.disabled = true);
    return;
  }

  // se tiver apenas leitura
  if (p.leitura) {
    document.querySelectorAll("input, select, textarea")
            .forEach(el => el.readOnly = true);
    document.querySelectorAll("button")
            .forEach(btn => {
                if (!btn.classList.contains("btnPesquisar") && !btn.classList.contains("btnLimpar")) {
                      btn.disabled = true;

                      console.log("Habilitar btnPesquisar e btnLimpar");
                }
            });
    return;
  }

  // senão, vai desabilitar só o que o usuário não pode
  if (!p.cadastrar){ 
    document.querySelectorAll(".btnCadastrar")
            .forEach(btn => btn.disabled = true);
  }
  if (!p.alterar){
    document.querySelectorAll(".btnAlterar")
            .forEach(btn => btn.disabled = true);
  }         
  if (!p.pesquisar){
    console.log("Habilitar btnPesquisar");
    document.querySelectorAll(".btnPesquisar")
            .forEach(btn => btn.disabled = true);
  }
}

// 2) Função init para buscar e aplicar logo que a página carrega
async function initPermissoes() {
  console.log("Entrou em iniPermissoes");
  console.log("[Permissões] Iniciando initPermissoes()");  

  // const idusuario = localStorage.getItem("idusuario");
  // console.log("[Permissões] idusuario =", idusuario);

  // if (!idusuario) return;
  // try {
  //   const resp = await fetch(`http://localhost:3000/permissoes/${idusuario}`, {
  //     headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
  //   });
  //   if (!resp.ok) throw new Error("Sem permissão");
  //   const permissoes = await resp.json();
  //   console.log("[Permissões] Dados recebidos:", permissoes);
  //   aplicarPermissoes(permissoes);
  //   filtrarMenuPorPermissoes(permissoes);
  // } catch (e) {
  //   console.error("Permissões:", e);
  // }
  const idusuario = sessionStorage.getItem('idusuario');
  console.log('[Permissões] idusuario =', idusuario);

   if (!idusuario) {
    console.error('[Permissões] idusuario não encontrado na sessionStorage.');
    return;
  }

  fetch(`http://localhost:3000/permissoes/${idusuario}`)
    .then(res => res.json())
    .then(permissoes => {
      console.log('[Permissões] Dados recebidos:', permissoes);
      filtrarMenuPorPermissoes(permissoes);  // em vez de filtrar por 'moduloAtual'
    });
}

function filtrarMenuPorPermissoes(permissoes) {
  // const menu = document.getElementById('menu');
  // if (!menu) return;

  // const itens = menu.querySelectorAll('li[data-modulo]');
  // itens.forEach(item => {
  //   const modulo = item.getAttribute('data-modulo');
  //   const temPermissao = permissoes.some(p => 
  //     p.modulo.trim().toLowerCase() === modulo.trim().toLowerCase() && p.acesso
  //   );
  //   item.style.display = temPermissao ? 'block' : 'none';
  // });
  const links = document.querySelectorAll('a[data-modulo]');

  links.forEach(link => {
    const modulo = link.dataset.modulo;
    const permissao = permissoes.find(p => p.modulo === modulo);

    if (!permissao || (!permissao.cadastrar && !permissao.alterar && !permissao.pesquisar)) {
      console.log(`[Permissões] Ocultando item do menu para módulo: ${modulo}`);
      link.style.display = 'none';
    } else {
      console.log(`[Permissões] Permitido acesso ao módulo: ${modulo}`);
    }
  });
}



// 3) Expor globalmente
window.initPermissoes = initPermissoes;
window.aplicarPermissoes = aplicarPermissoes;

document.addEventListener("DOMContentLoaded", () => {
   initPermissoes();
});
