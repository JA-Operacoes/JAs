// public/js/permissoes.js

// 1) Função genérica para aplicar as permissões no DOM
function aplicarPermissoes(permissoes) {
  const moduloAtual = document.body.dataset.modulo;
  const p = permissoes.find(x => x.modulo === moduloAtual);

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
              if (!btn.classList.contains("btnPesquisar")) 
                btn.disabled = true;
            });
    return;
  }

  // senão, vai desabilitar só o que o usuário não pode
  if (!p.cadastrar) 
    document.querySelectorAll(".btnCadastrar")
            .forEach(btn => btn.disabled = true);
  if (!p.alterar)   
    document.querySelectorAll(".btnAlterar")
            .forEach(btn => btn.disabled = true);
  if (!p.pesquisar) 
    document.querySelectorAll(".btnPesquisar")
            .forEach(btn => btn.disabled = true);
}

// 2) Função init para buscar e aplicar logo que a página carrega
async function initPermissoes() {
  console.log("Entrou em iniPermissoes");

  const idusuario = localStorage.getItem("idusuario");
  if (!idusuario) return;
  try {
    const resp = await fetch(`/permissoes/${idusuario}`, {
      headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
    });
    if (!resp.ok) throw new Error("Sem permissão");
    const permissoes = await resp.json();
    aplicarPermissoes(permissoes);
  } catch (e) {
    console.error("Permissões:", e);
  }
}

// 3) Expor globalmente
window.initPermissoes = initPermissoes;
window.aplicarPermissoes = aplicarPermissoes;
