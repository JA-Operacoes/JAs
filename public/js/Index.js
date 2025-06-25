document.addEventListener("DOMContentLoaded", async function () {
  
let resp;
  try {
    resp = await fetchComToken("/auth/permissoes");
    //commentado para evitar erro de CORS
    // if (!resp.ok) {
    //   const textoErro = await resp.text();
    //   throw new Error(textoErro);
    // }
  } catch (erro) {
    console.error("Falha ao carregar permissões:", erro);
    await Swal.fire({
      icon: "error",
      title: "Erro",
      text: "Não foi possível carregar suas permissões.",
    });
    return;
  }
  const permissoes = resp; // Aqui assumimos que resp já é o JSON esperado
  // Se resp for um Response, descomente a linha abaixo:
  //commentado para evitar erro de CORS
 // const permissoes = await resp.json();
  window.permissoes = permissoes;

  // Função utilitária para verificar permissão
  window.temPermissao = function (modulo, acao) {
    if (!modulo) return false;
    const p = permissoes.find((x) => x.modulo.toLowerCase() === modulo.toLowerCase());
    return p && p[`pode_${acao}`];
    
  };



  const mapaModulos = {
    orcamentos: "Orcamentos",
    clientes: "Clientes",
    funcao: "Funcao",
    localmontagem: "Localmontagem",
    eventos: "Eventos",
    equipamentos: "Equipamentos",
    suprimentos: "Suprimentos",
    funcionarios: "Funcionarios",
    staff: "Staff",
    usuarios: "Usuarios",
    empresas: "Empresas",
    bancos: "Bancos"
  };

  document.querySelectorAll(".abrir-modal").forEach((botao) => {
    const url = botao.dataset.url || "";
    const explicitModulo = botao.dataset.modulo;
    const urlLower = url.toLowerCase();
    
    let modulo = explicitModulo;
    if (!modulo) {
      const chave = Object.keys(mapaModulos).find(k => urlLower.includes(k));
      modulo = chave ? mapaModulos[chave] : null;
    }
    
    if (!modulo) {
      console.warn(`Botão com URL '${url}' não mapeia para módulo.`, botao);
      return;
    }

    if (!temPermissao(modulo, "acessar") && !temPermissao(modulo, "pesquisar")) {
      botao.style.display = "none";
      return;
    }

    botao.removeAttribute("onclick");
    botao.addEventListener("click", () => {
      window.moduloAtual = modulo;
      abrirModal(url, modulo);
    });
  });
});

async function atualizarPermissoes() {
  try {
    const resp = await fetchComToken("/auth/permissoes");
    if (!resp || !resp.length) throw new Error("Permissões vazias ou inválidas");
    window.permissoes = resp;
    console.log("Permissões atualizadas:", window.permissoes);
    return true;
  } catch (erro) {
    console.error("Erro ao atualizar permissões:", erro);
    await Swal.fire({
      icon: "error",
      title: "Erro",
      text: "Não foi possível atualizar suas permissões.",
    });
    return false;
  }
}


async function abrirModal(url, modulo) {
  if (!window.moduloAtual) {
    alert("Módulo atual não está definido. Não é possível abrir o modal.");
    return;
  }

  console.log("Abrindo modal para o módulo:", modulo, "com URL:", url);

  
  let html;
  try {
    html = await fetchHtmlComToken(url);
  } catch (err) {
    console.error("Erro ao carregar modal:", err);
    return;
  }

  const container = document.getElementById("modal-container");
  container.innerHTML = html;

  // ⚠️ Remover script anterior (se existir)
  const scriptId = 'scriptModuloDinamico';
  const scriptAntigo = document.getElementById(scriptId);
  if (scriptAntigo) {
    scriptAntigo.remove();
    console.log("🔁 Script anterior removido.");
  }

  const scriptName = modulo.charAt(0).toUpperCase() + modulo.slice(1) + ".js";
  const scriptSrc = `js/${scriptName}`;
  const script = document.createElement("script");
  script.id = scriptId;
  script.src = scriptSrc;
  script.defer = true;
  script.onload = () => {
    console.log(`✅ Script ${scriptName} carregado com sucesso.`);
    aplicarConfiguracoes(modulo);
    if (typeof aplicarPermissoes === "function") {
      aplicarPermissoes(window.permissoes);
      console.log(`🔐 Permissões aplicadas para o módulo ${modulo}.`);
    }
  };
  script.onerror = () => {
    console.error(`❌ Erro ao carregar o script ${scriptName}`);
  };
  document.body.appendChild(script);

  const modal = document.querySelector("#modal-container .modal");
  const overlay = document.getElementById("modal-overlay");
  if (modal && overlay) {
    modal.style.display = "block";
    overlay.style.display = "block";
    document.body.classList.add("modal-open");
    modal.querySelector(".close")?.addEventListener("click", fecharModal);
  }

  console.log("ABRIRMODAL", modal);
}

// fetchHtmlComToken retorna Response para controlar no chamador
async function fetchHtmlComToken(url, options = {}) {
  console.log("FETCH HTML", url, options);
  const token = localStorage.getItem("token");
  const idempresa = localStorage.getItem("idempresa");

  if (!options.headers) options.headers = {};
  options.headers["Authorization"] = "Bearer " + token;
  if (idempresa) options.headers["idempresa"] = idempresa;

  const resposta = await fetch(url, options);

  if (resposta.status === 401) {
    localStorage.clear();
    await Swal.fire({
      icon: "warning",
      title: "Sessão expirada",
      text: "Por favor, faça login novamente.",
    });
    window.location.href = "login.html";
    throw new Error("Sessão expirada");
  }

  if (!resposta.ok) {
    const textoErro = await resposta.text();
    throw new Error(`Erro ${resposta.status}: ${textoErro}`);
  }

  // Aqui quem chama decide se quer .text() ou .json()
  return resposta.text();
}

// Expõe as funções globalmente
window.fetchComToken = fetchComToken;
window.fetchHtmlComToken = fetchHtmlComToken;


function aplicarConfiguracoes(modulo) {
  if (typeof configurarEventosEspecificos === "function") {
    configurarEventosEspecificos(modulo);
  }

  if (!temPermissao(modulo, "cadastrar")) {
    document.querySelectorAll(".btnCadastrar").forEach((btn) => (btn.style.display = "none"));
  }
  if (!temPermissao(modulo, "alterar")) {
    document.querySelectorAll(".btnEditar").forEach((btn) => (btn.style.display = "none"));
  }
}

async function fetchComToken(url, options = {}) {
  console.log("URL da requisição 1:", url);
  const token = localStorage.getItem("token");
  const idempresa = localStorage.getItem("idempresa");

  console.log("ID da empresa no localStorage:", idempresa);
  console.log("Token no localStorage:", token);

  if (!options.headers) options.headers = {};

  options.headers['Authorization'] = 'Bearer ' + token;
  if (idempresa) options.headers['idempresa'] = idempresa;

  const resposta = await fetch(url, options);

  if (resposta.status === 401) {
    localStorage.clear();
    Swal.fire({
      icon: "warning",
      title: "Sessão expirada",
      text: "Por favor, faça login novamente."
    }).then(() => {
      window.location.href = "login.html"; // ajuste conforme necessário
    });
    //return;
    throw new Error('Sessão expirada'); 
  }
  
  return await resposta.json(); // Retorna o JSON já resolvido
}

function fecharModal() {
  document.getElementById("modal-container").innerHTML = "";
  document.getElementById("modal-overlay").style.display = "none";
  document.body.classList.remove("modal-open");
}