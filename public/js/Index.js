document.addEventListener("DOMContentLoaded", async function () {
  const resp = await fetchComToken("/auth/permissoes");
  if (!resp || !resp.ok) {
    const erroTexto = await resp?.text?.();
    console.error("Falha ao carregar permissões:", erroTexto || resp);
    await Swal.fire({
      icon: "error",
      title: "Erro",
      text: "Não foi possível carregar suas permissões.",
    });
    return;
  }

  const permissoes = await resp.json();
  window.permissoes = permissoes;

  // Função utilitária para verificar permissão
  window.temPermissao = function (modulo, acao) {
    if (!modulo) return false;
    const p = permissoes.find((x) => x.modulo.toLowerCase() === modulo.toLowerCase());
    return p && p[`pode_${acao}`];
  };

  const mapaModulos = {
    orcamentos: "Orçamentos",
    clientes: "Clientes",
    funcao: "Funcao",
    localmontagem: "Localmontagem",
    eventos: "Eventos",
    equipamentos: "Equipamentos",
    suprimentos: "Suprimentos",
    funcionarios: "Funcionarios",
    staff: "Staff",
  };

  document.querySelectorAll(".abrir-modal").forEach((botao) => {
    const url = botao.dataset.url || "";
    const explicitModulo = botao.dataset.modulo;
    const urlLower = url.toLowerCase();
    let modulo = explicitModulo || Object.keys(mapaModulos).find(k => urlLower.includes(k)) && mapaModulos[urlLower.match(/(\w+)/)[0]];

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

async function abrirModal(url, modulo) {
  if (!modulo || (!temPermissao(modulo, "acessar") && !temPermissao(modulo, "pesquisar"))) {
    Swal.fire("Acesso Negado", `Você não tem permissão para acessar o módulo ${modulo}.`, "warning");
    return;
  }

  let html;
  try {
    const resp = await fetchComToken(url);
    if (!resp?.ok) throw new Error(`Status ${resp?.status}`);
    html = await resp.text();
  } catch (err) {
    console.error("Erro ao carregar modal:", err);
    return;
  }

  const container = document.getElementById("modal-container");
  container.innerHTML = html;

  if (window.permissoes && typeof aplicarPermissoes === "function") {
    aplicarPermissoes(window.permissoes);
  }

  const scriptName = modulo.charAt(0).toUpperCase() + modulo.slice(1) + ".js";
  const scriptSrc = `js/${scriptName}`;
  if (!Array.from(document.scripts).some((s) => s.src.includes(scriptName))) {
    const script = document.createElement("script");
    script.src = scriptSrc;
    script.defer = true;
    script.onload = () => aplicarConfiguracoes(modulo);
    document.body.appendChild(script);
  } else {
    aplicarConfiguracoes(modulo);
  }

  const modal = document.querySelector("#modal-container .modal");
  const overlay = document.getElementById("modal-overlay");
  if (modal && overlay) {
    modal.style.display = "block";
    overlay.style.display = "block";
    document.body.classList.add("modal-open");
    modal.querySelector(".close")?.addEventListener("click", fecharModal);
  }
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





// document.addEventListener("DOMContentLoaded", async function () {
//   // 1) Buscar permissões do backend
//   const token = localStorage.getItem("token");
//   let permissoes = [];

//   try {
//     const resp = await fetch("/auth/permissoes", {
//       headers: { Authorization: `Bearer ${token}` }
//     });
//     if (resp.ok) {
//       permissoes = await resp.json();
//       window.permissoes = permissoes;
//     } else {
//       console.error("Falha ao carregar permissões:", await resp.text());
//     }
//   } catch (err) {
//     console.error("Erro ao buscar permissões:", err);
//   }

//   // 2) Função utilitária de permissão
//   window.temPermissao = function (modulo, acao) {
//     if (!modulo) return false;
//     const p = permissoes.find(x => x.modulo.toLowerCase() === modulo.toLowerCase());
//     return p && p[`pode_${acao}`];
//   };

//   // 3) Mostrar/ocultar e adicionar listener nos botões de modal
//   const mapaModulos = {
//     'orcamentos': 'Orçamentos',
//     'clientes': 'Clientes',
//     'funcao': 'Funcao',
//     'localmontagem': 'Localmontagem',
//     'eventos': 'Eventos',
//     'equipamentos': 'Equipamentos',
//     'suprimentos': 'Suprimentos',
//     'funcionarios': 'Funcionarios',
//     'staff': 'Staff',
    
//   };

//   document.querySelectorAll(".abrir-modal").forEach(botao => {
//     const url = botao.dataset.url || "";
//     const explicitModulo = botao.dataset.modulo; // leia data-modulo se existir
//     const urlLower = url.toLowerCase();
//     let modulo = null;

//     console.log("Botão:", botao.dataset.modulo, "| URL:", url, "| Módulo explícito:", explicitModulo);
   
//     if (explicitModulo) {
//       modulo = explicitModulo;
//     } else {
//       for (const chave in mapaModulos) {
//         if (urlLower.includes(chave)) {
//           modulo = mapaModulos[chave];
//           break;
//         }
//       }
//     }

//     console.log("URL:", url, "| Módulo identificado:", modulo);

//     if (!modulo) {
//       console.warn(`Botão de modal com URL '${url}' não mapeia para módulo.`, botao);
//       return;
//     }

//     // somente exibir se tiver permissão de acessar ou pesquisar
//     if (!temPermissao(modulo, 'acessar') && !temPermissao(modulo, 'pesquisar')) {
//       botao.style.display = 'none';
//       return;
//     }

//     botao.removeAttribute('onclick'); // remove qualquer onclick inline
//     // botao.addEventListener('click', () => abrirModal(url, modulo));
//     botao.addEventListener('click', () => {
//       // GUARDO o módulo antes de tudo
//       window.moduloAtual = modulo;
//       console.log("🏷️  janela.moduloAtual setado para:", window.moduloAtual);
//       abrirModal(url, modulo);
//     });
    
//   });
// });

// let moduloAtual = undefined;

// async function abrirModal(url, modulo) {
//   console.log("Tentando abrir modal de", modulo);

//   if (!modulo) {
//     console.warn("abrirModal chamado com módulo indefinido, abortando.");
//     return;
//   }

//   // checagem final de permissão
//   if (!window.temPermissao(modulo, 'acessar') && !window.temPermissao(modulo, 'pesquisar')) {
//     Swal.fire("Acesso Negado", `Você não tem permissão para acessar o módulo ${modulo}.`, "warning");
//     return;
//   }

//   // buscar HTML do modal
//   let html;
//   try {
//     const resp = await fetch(url);
//     if (!resp.ok) throw new Error(`Status ${resp.status}`);
//     html = await resp.text();
//   } catch (err) {
//     console.error("Erro ao carregar modal:", err);
//     return;
//   }


//   // inserir HTML e overlay
//   const container = document.getElementById('modal-container');
//   container.innerHTML = html;

//   // ** Aqui aplicamos as permissões internas do modal: **
//   if (window.permissoes && typeof aplicarPermissoes === 'function') {
//     aplicarPermissoes(window.permissoes);
//   }

//   // carregar script do módulo dinamicamente
//   const scriptName = modulo.charAt(0).toUpperCase() + modulo.slice(1) + '.js';
//   const scriptSrc = `js/${scriptName}`;
//   console.log("Carregando script do módulo:", scriptSrc);
//   if (!Array.from(document.scripts).some(s => s.src.includes(scriptName))) {
//     const script = document.createElement('script');
//     script.src = scriptSrc;
//     script.defer = true;
//     // script.onload = () => aplicarConfiguracoes(modulo);
//     script.onload = () => {
//       console.log("✅ Script do módulo carregado:", scriptName);
//       aplicarConfiguracoes(modulo);
//     };
//     document.body.appendChild(script);
//   } else {
//     aplicarConfiguracoes(modulo);
//   }

//   // exibir modal e overlay
//   const modal = document.querySelector('#modal-container .modal');
//   const overlay = document.getElementById('modal-overlay');
//   if (modal && overlay) {
//     modal.style.display = 'block';
//     overlay.style.display = 'block';
//     document.body.classList.add('modal-open');
//     modal.querySelector('.close')?.addEventListener('click', fecharModal);
//   }
// }

// function aplicarConfiguracoes(modulo) {
//   if (typeof configurarEventosEspecificos === 'function') {
//     configurarEventosEspecificos(modulo);
//   }

//   if (!temPermissao(modulo, 'cadastrar')) {
//     document.querySelectorAll('.btnCadastrar').forEach(btn => btn.style.display = 'none');
//   }
//   if (!temPermissao(modulo, 'alterar')) {
//     document.querySelectorAll('.btnEditar').forEach(btn => btn.style.display = 'none');
//   }
// }

// function fecharModal() {
//   document.getElementById('modal-container').innerHTML = '';
//   document.getElementById('modal-overlay').style.display = 'none';
//   document.body.classList.remove('modal-open');
// }
