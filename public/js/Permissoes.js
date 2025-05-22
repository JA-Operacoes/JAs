// public/js/permissoes.js

//Função genérica para aplicar as permissões no DOM
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

  if (!p) {
    console.warn(`[Permissões] Nenhuma permissão encontrada para o módulo: ${moduloAtual}`);
    return;
  }

  console.log("Entrou no aplicarPermissoes", p, permissoes);

  if (!p.pode_cadastrar) {
    document.querySelectorAll(".btnCadastrar")
            .forEach(btn => btn.disabled = true);
  }
  if (!p.pode_alterar){
    document.querySelectorAll(".btnAlterar")
            .forEach(btn => btn.disabled = true);            
  }         
  if (!p.pode_pesquisar){
    console.log("Habilitar btnPesquisar");
    document.querySelectorAll(".btnPesquisar")
            .forEach(btn => btn.disabled = true);
  }

  if (p.pode_pesquisar && !p.pode_cadastrar && !p.pode_alterar) {
    console.log("Usuário só pode pesquisar - ocultando botões de envio");
    
    document.querySelectorAll("button[type='submit'], .btnSalvar, .btnEnviar")
            .forEach(btn => btn.style.display = 'none');
  }

  // Se só pode alterar → muda botão para “Atualizar”
  if (!p.pode_cadastrar && p.pode_alterar) {
    console.log("Usuário só pode alterar - ajustando botão para 'Atualizar'");
    document.querySelectorAll("button[type='submit'], .btnSalvar, .btnEnviar")
      .forEach(btn => {
        btn.textContent = "Atualizar";
        btn.title = "Você só pode alterar registros existentes";
        btn.classList.add("btnAtualizar");
      });
  }

  // Se não pode salvar nem alterar → desabilita botão
  if (!p.pode_cadastrar && !p.pode_alterar) {
    console.log("Usuário sem permissão para salvar ou alterar - desabilitando botão");
    document.querySelectorAll("button[type='submit'], .btnSalvar, .btnEnviar")
      .forEach(btn => {
        btn.disabled = true;
        btn.title = "Você não tem permissão para salvar ou alterar";
        btn.classList.add("btnDesabilitado");
      });
    }
}


//Função init para buscar e aplicar logo que a página carrega
async function initPermissoes() {
  console.log("Entrou em iniPermissoes");
  console.log("[Permissões] Iniciando initPermissoes()");  

  const idusuario = localStorage.getItem('idusuario');
  console.log('[Permissões] idusuario =', idusuario);

   if (!idusuario) {
    console.error('[Permissões] idusuario não encontrado na localStorage.');
    return;
  }

  // fetch(`http://localhost:3000/permissoes/${idusuario}`)
  fetch(`/permissoes/${idusuario}`)
    .then(res => res.json())
    .then(permissoes => {
      console.log('[Permissões] Dados recebidos:', permissoes);
      filtrarMenuPorPermissoes(permissoes);  // em vez de filtrar por 'moduloAtual'
      //aplicarPermissoes(permissoes);
    });
}

function filtrarMenuPorPermissoes(permissoes) {
  
  const links = document.querySelectorAll('a[data-modulo]');

  links.forEach(link => {
    const modulo = link.dataset.modulo;
    const permissao = permissoes.find(p => p.modulo === modulo);

    if (!permissao || (!permissao.cadastrar && !permissao.alterar && !permissao.pesquisar)) {
   //   console.log(`[Permissões] Ocultando item do menu para módulo: ${modulo}`);
      link.style.display = 'none';
    } else {
      console.log(`[Permissões] Permitido acesso ao módulo: ${modulo}`);
    }
  });
}



//Expor globalmente
window.initPermissoes = initPermissoes;
window.aplicarPermissoes = aplicarPermissoes;

document.addEventListener("DOMContentLoaded", () => {
   initPermissoes();
});
