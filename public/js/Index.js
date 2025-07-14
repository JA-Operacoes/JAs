import { fetchComToken, fetchHtmlComToken } from '../utils/utils.js';


document.addEventListener("DOMContentLoaded", async function () { 

  let permissoesArray; // Renomeado para clareza
  let permissoesPromise;

  try {
      // fetchComToken JÁ retorna o JSON. resp vai ser o ARRAY.
      console.log("Início da busca de permissões...");
      permissoesPromise = await fetchComToken("/auth/permissoes");
      console.log("Promise das permissões obtida:", permissoesPromise);

      permissoesArray = await permissoesPromise;
      console.log("DEBUG: Valor de permissoesArray ANTES de isArray check:", permissoesArray);
      console.log("DEBUG: Tipo de permissoesArray ANTES de isArray check:", typeof permissoesArray);

      // VERIFIQUE SE permissoesArray É REALMENTE UM ARRAY AQUI
      if (!Array.isArray(permissoesArray)) {
          console.error("Erro: /auth/permissoes não retornou um array de permissões.", permissoesArray);
          throw new Error("Formato de permissões inválido.");
      }

  } catch (erro) {
      console.error("Falha ao carregar permissões:", erro);
      await Swal.fire({
          icon: "error",
          title: "Erro",
          text: "Não foi possível carregar suas permissões.",
      });
      return;
  }

  // Armazena o array de permissões na variável global window.permissoes
  window.permissoes = permissoesArray; // <--- AGORA ESTÁ CORRETO
  console.log("Permissões carregadas e armazenadas em window.permissoes:", window.permissoes);


  // Função utilitária para verificar permissão
  window.temPermissao = function (modulo, acao) {
      if (!modulo) return false;
      // Use window.permissoes diretamente aqui
      // Adicione uma verificação defensiva caso window.permissoes não seja um array
      if (!Array.isArray(window.permissoes)) {
          console.warn("window.permissoes não é um array para temPermissao.");
          return false;
      }
      const p = window.permissoes.find((x) => x.modulo.toLowerCase() === modulo.toLowerCase());
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
  script.type = "module";
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
  const modalContent = document.querySelector("#modal-container .modal-content");
  const overlay = document.getElementById("modal-overlay");
  if (modal && overlay && modalContent) {
    modal.style.display = "block";
    overlay.style.display = "block";
    document.body.classList.add("modal-open");
    // Listener para o clique no overlay (fecha o modal)
         overlay.addEventListener("mousedown", (event) => {
            if (event.target === overlay) {
                fecharModal(); 
                console.log("Mousedown no overlay do modal detectado. Fechando modal.");
            }
        });

        // Listener para o mousedown no conteúdo do modal (impede a propagação)
        // Este listener agora roda na fase de CAPTURA (true como terceiro argumento)
        modalContent.addEventListener("mousedown", (event) => {
            event.stopPropagation();
            console.log("Mousedown dentro do modal-content detectado (CAPTURA). Propagação interrompida.");
        }, true); // <--- TRUE AQUI PARA FASE DE CAPTURA

        // Adicionar listener para mouseup no modalContent também (fase de CAPTURA)
        modalContent.addEventListener("mouseup", (event) => {
            event.stopPropagation();
            console.log("Mouseup dentro do modal-content detectado (CAPTURA). Propagação interrompida.");
        }, true);

    modal.querySelector(".close")?.addEventListener("click", fecharModal);
  }

  console.log("ABRIRMODAL", modal);
}

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

function fecharModal() {
  document.getElementById("modal-container").innerHTML = "";
  document.getElementById("modal-overlay").style.display = "none";
  document.body.classList.remove("modal-open");
}