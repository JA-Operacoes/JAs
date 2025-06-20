// public/js/permissoes.js

// Função para aplicar as permissões no DOM conforme o módulo atual
function aplicarPermissoes(permissoes) {
  const moduloAtual = window.moduloAtual;
 
  console.log("[Permissões] módulo atual:", moduloAtual);
  console.log("[Permissões] permissões recebidas:", permissoes);

  // Busca permissão correspondente ao módulo atual (ignorando case e espaços)
  const p = permissoes.find(x =>
    x.modulo &&
    moduloAtual &&
    x.modulo.trim().toLowerCase() === moduloAtual.trim().toLowerCase()
  );

  if (!p) {
    console.warn(`[Permissões] Nenhuma permissão para módulo: ${moduloAtual}`);
    return;
  }

  console.log("[Permissões] permissões para o módulo:", p);

  // Desabilita botões conforme permissões
  if (!p.pode_cadastrar) {
    document.querySelectorAll(".btnCadastrar").forEach(btn => btn.disabled = true);
  }
  if (!p.pode_alterar) {
    document.querySelectorAll(".btnAlterar").forEach(btn => btn.disabled = true);
  }
  if (!p.pode_pesquisar) {
    document.querySelectorAll(".btnPesquisar").forEach(btn => btn.disabled = true);
  }

  
  // Caso só possa pesquisar, oculta botões de envio
  if (p.pode_pesquisar && !p.pode_cadastrar && !p.pode_alterar) {
    document.querySelectorAll("button[type='submit'], .btnSalvar, .btnEnviar")
      .forEach(btn => btn.style.display = "none");
  }

  // Caso só possa alterar, altera texto e estilo do botão
  if (!p.pode_cadastrar && p.pode_alterar) {
    document.querySelectorAll("button[type='submit'], .btnSalvar, .btnEnviar").forEach(btn => {
      btn.textContent = "Atualizar";
      btn.title = "Você só pode alterar registros existentes";
      btn.classList.add("btnAtualizar");
    });
  }

  // Se não pode cadastrar nem alterar, desabilita botões de envio
  if (!p.pode_cadastrar && !p.pode_alterar) {
    document.querySelectorAll("button[type='submit'], .btnSalvar, .btnEnviar").forEach(btn => {
      btn.disabled = true;
      btn.title = "Você não tem permissão para salvar ou alterar";
      btn.classList.add("btnDesabilitado");
    });
  }
}

// Função para buscar permissões do usuário e aplicar filtros no menu
async function initPermissoes() {
  console.log("[Permissões] Iniciando initPermissoes()");
  const idusuario = localStorage.getItem("idusuario");
  const idempresa = localStorage.getItem("idempresa");

  if (!idusuario) {
    console.error("[Permissões] idusuario não encontrado no localStorage");
    return;
  }

  try {
    console.log("[Permissões] Buscando permissões para o usuário:", idusuario);

    const permissoes = await fetchComToken(`/permissoes/${idusuario}`);

    //comentado para evitar erro de CORS
  //   const response = await fetchComToken(`/permissoes/${idusuario}`);
  //    if (!response.ok) {
  //   console.error("[Permissões] Erro na resposta:", response.status);
  //   return;
  // }
  //   const permissoes = await response.json(); 

    console.log("[Permissões] Tipo do retorno:", typeof permissoes);
console.log("[Permissões] O retorno é instanceof Response?", permissoes instanceof Response);

console.log("[Permissões] Permissões recebidas:", permissoes);

    

    if (!permissoes || !Array.isArray(permissoes)) {
      console.error("[Permissões] Permissões inválidas ou não recebidas:", permissoes);
      Swal.fire("Erro", "Não foi possível carregar suas permissões.", "error");
      return;
    }

    filtrarMenuPorPermissoes(permissoes);
  
    aplicarPermissoes(permissoes);

  } catch (erro) {
    console.error("[Permissões] Erro ao carregar permissões:", erro);
    Swal.fire("Erro", "Não foi possível carregar suas permissões.", "error");
  }
}

// Função que oculta/mostra itens do menu conforme permissões
function filtrarMenuPorPermissoes(permissoes) {
  console.log("[Permissões] Iniciando filtrarMenuPorPermissoes()");
  if (!Array.isArray(permissoes)) {
    console.error("[Permissões] Formato inválido de permissões:", permissoes);
    return;
  }

  const links = document.querySelectorAll("a[data-modulo]");
  links.forEach(link => {
    const modulo = link.dataset.modulo.trim().toLowerCase();
    const permissao = permissoes.find(p => p.modulo && p.modulo.trim().toLowerCase() === modulo);

    if (!permissao || (!permissao.cadastrar && !permissao.alterar && !permissao.pesquisar)) {
      link.style.display = "none";
    } else {
      link.style.display = ""; // garante que fique visível se permitido
    }
  });
}

// Função genérica para fazer fetch com token e tratamento de erros
// async function fetchComToken(url, options = {}) {
//   const token = localStorage.getItem("token");
//   const idempresa = localStorage.getItem("idempresa");

//   if (!options.headers) options.headers = {};
//   options.headers["Authorization"] = "Bearer " + token;
//   if (idempresa) options.headers["idempresa"] = idempresa;

//   try {
//     const resposta = await fetch(url, options);
//     console.log("[fetchComToken] Resposta bruta recebida:", resposta); 

//     if (resposta.status === 401) {
//       localStorage.clear();
//       await Swal.fire({
//         icon: "warning",
//         title: "Sessão expirada",
//         text: "Por favor, faça login novamente."
//       });
//       window.location.href = "login.html";
//       throw new Error("Sessão expirada");
//     }

//     if (!resposta.ok) {
//       const textoErro = await resposta.text();
//       throw new Error(`Erro ${resposta.status}: ${textoErro}`);
//     }

//     const data = await resposta.json();
//     console.log("[fetchComToken] Dados convertidos de JSON:", data);
//     console.trace("Retornando dados JSON");
//     return data;

//   } catch (erro) {
//     console.error("[fetchComToken] Erro ao buscar:", erro);
//     throw erro;
//   }
// }

async function fetchComToken(url, options = {}) {
  const token = localStorage.getItem("token");
  const idempresa = localStorage.getItem("idempresa");

  if (!options.headers) options.headers = {};
  options.headers["Authorization"] = "Bearer " + token;
  if (idempresa) options.headers["idempresa"] = idempresa;

  try {
    const resposta = await fetch(url, options);

    if (resposta.status === 401) {
      localStorage.clear();
      await Swal.fire({
        icon: "warning",
        title: "Sessão expirada",
        text: "Por favor, faça login novamente."
      });
      window.location.href = "login.html";
      throw new Error("Sessão expirada");
    }

    if (!resposta.ok) {
      const textoErro = await resposta.text();
      throw new Error(`Erro ${resposta.status}: ${textoErro}`);
    }

    const data = await resposta.json();
    return data;

  } catch (erro) {
    console.error("[fetchComToken] Erro ao buscar:", erro);
    throw erro;
  }
}


// Expor globalmente para poder chamar de fora, se necessário
window.initPermissoes = initPermissoes;
window.aplicarPermissoes = aplicarPermissoes;

// Inicializa permissões quando a página carregar
document.addEventListener("DOMContentLoaded", () => {
  initPermissoes();
});
