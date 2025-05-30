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

  const moduloNormalizado = moduloAtual ? moduloAtual.trim().toLowerCase() : null;

  if (!p) {
    console.warn(`[Permissões] Nenhuma permissão encontrada para o módulo: ${moduloNormalizado}`);
    return;
  }

  console.log("Entrou no aplicarPermissoes", p, permissoes);

  if (!p.cadastrar) {
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

  if (p.pesquisar && !p.cadastrar && !p.alterar) {
    console.log("Usuário só pode pesquisar - ocultando botões de envio");
    
    document.querySelectorAll("button[type='submit'], .btnSalvar, .btnEnviar")
            .forEach(btn => btn.style.display = 'none');
  }

  // Se só pode alterar → muda botão para “Atualizar”
  if (!p.cadastrar && p.alterar) {
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

 
  // fetch(`/permissoes/${idusuario}`)
  //   .then(res => res.json())
  //   .then(permissoes => {
  //     console.log('[Permissões] Dados recebidos:', permissoes);
  //     filtrarMenuPorPermissoes(permissoes);  // em vez de filtrar por 'moduloAtual'
   
  //   });

  try {
    const permissoes = await fetchComToken(`/permissoes/${idusuario}`);

    if (!permissoes || !Array.isArray(permissoes)) {
      console.error('Permissões inválidas:', permissoes);
      // console.error("[Permissões] Permissões inválidas ou não recebidas:", permissoes);
      // Swal.fire("Erro", "Não foi possível carregar suas permissões.", "error");
      // return;
    }

    console.log('[Permissões] Dados recebidos com token:', permissoes);
    filtrarMenuPorPermissoes(permissoes);
   } catch (erro) {
     console.error('[Permissões] Erro ao carregar permissões:', erro);
     Swal.fire("Erro", "Não foi possível carregar suas permissões.", "error");
   }

  
}

function filtrarMenuPorPermissoes(permissoes) {
  console.log("[Permissões] Iniciando filtrarMenuPorPermissoes()");
  console.log("[Permissões] Permissões recebidas:", permissoes);

  if (!Array.isArray(permissoes)) {
    console.error("[Permissões] Formato inválido de permissões:", permissoes);
    return;
  }
  
  const links = document.querySelectorAll('a[data-modulo]');
  console.log("[Permissões] Links encontrados:", links.length, links);

  links.forEach(link => {
     const modulo = link.dataset.modulo.trim().toLowerCase();
     
    console.log(`[Permissões] Verificando link para módulo: ${modulo}`, link);

    const permissao = permissoes.find(p => p.modulo && p.modulo.trim().toLowerCase() === modulo);


    console.log(`[Permissões] Verificando módulo: ${modulo}`, permissao);
    

    if (!permissao || (!permissao.cadastrar && !permissao.alterar && !permissao.pesquisar)) {
   //   console.log(`[Permissões] Ocultando item do menu para módulo: ${modulo}`);
      link.style.display = 'none';
    } else {
      console.log(`[Permissões] Permitido acesso ao módulo: ${modulo}`);
    }
  });
}

async function fetchComToken(url, options = {}) {
  console.log("URL da requisição:", url);
  const token = localStorage.getItem("token");
  const idempresa = localStorage.getItem("idempresa");

  console.log("ID da empresa no localStorage:", idempresa);
  console.log("Token no localStorage:", token);

  if (!options.headers) options.headers = {};

  options.headers['Authorization'] = 'Bearer ' + token;
  if (idempresa) options.headers['idempresa'] = idempresa;

  try {
    const resposta = await fetch(url, options);

    if (resposta.status === 401) {
      localStorage.clear();
      Swal.fire({
        icon: "warning",
        title: "Sessão expirada",
        text: "Por favor, faça login novamente."
      }).then(() => {
        window.location.href = "login.html";
      });
      throw new Error('Sessão expirada');
    }

    if (!resposta.ok) {
      const textoErro = await resposta.text();
      console.error("[fetchComToken] Erro HTTP:", resposta.status, textoErro);
      throw new Error(`Erro ${resposta.status}: ${textoErro}`);
    }

    // const conteudo = await resposta.json();
    // console.log("[fetchComToken] JSON resolvido:", conteudo);
    // return conteudo;
    const data = await resposta.json();
    return data;
    
  } catch (erro) {
    console.error("[fetchComToken] Erro ao buscar:", erro);
    return null;
  }
}

//Expor globalmente
window.initPermissoes = initPermissoes;
window.aplicarPermissoes = aplicarPermissoes;

document.addEventListener("DOMContentLoaded", () => {
   initPermissoes();
});
