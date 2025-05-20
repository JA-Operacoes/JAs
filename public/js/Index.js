//  document.addEventListener("DOMContentLoaded", function () {
//   document.querySelectorAll(".abrir-modal").forEach(botao => {
//     botao.addEventListener("click", function () {
//       let url = botao.getAttribute("data-url");
//       abrirModal(url);
//     });
//   });
// })

// function abrirModal(url) {
//     console.log("ABRIR  MODAL  Carregando modal de:", url);

//     if (!url) {
//         console.error("URL do modal não fornecida.");
//         return;
//     }else {
//         console.log("URL do modal fornecida:", url);
//         if (url.includes("Orcamento")) {
//             console.log("URL do modal é de orçamento");
           
//         }
//     }

//     fetch(url)
//         .then(response => response.text())
//         .then(html => {
//             let modalContainer = document.getElementById("modal-container");
//             modalContainer.innerHTML = html;

//             let scriptSrc = null;

//             if (url.includes("CadClientes")) {
//                 scriptSrc = "js/Clientes.js";
//                 window.moduloAtual = "Clientes";
//             } else if (url.includes("CadFuncao")) {
//                 scriptSrc = "js/Funcao.js";
//                 window.moduloAtual = "Funções";
//             } else if (url.includes("Orcamento")) {
//                 scriptSrc = "js/Orcamento.js";
//                 window.moduloAtual = "Orcamento";
//             } else if (url.includes("CadLocalMontagem")) {
//                 scriptSrc = "js/LocalMontagem.js";
//                 window.moduloAtual = "Locais";
//             } else if (url.includes("CadEventos")) {
//                 scriptSrc = "js/Eventos.js";
//                 window.moduloAtual = "Eventos";
//             } else if (url.includes("CadEquipamentos")) {
//                 scriptSrc = "js/Equipamentos.js";
//                 window.moduloAtual = "Equipamentos";
//             } else if (url.includes("CadSuprimentos")) {
//                 scriptSrc = "js/Suprimentos.js";
//                 window.moduloAtual = "Suprimentos";
//             }


//             console.log("MODULO ATUAL:", window.moduloAtual);

//             // Verifica se o script já está carregado
//             const scriptsExistentes = Array.from(document.scripts);
//             const jaCarregado = scriptsExistentes.some(s => s.src.includes(scriptSrc));

//             if (scriptSrc && !jaCarregado) {
//                 let script = document.createElement("script");
//                 script.src = scriptSrc;
//                 script.defer = true;
//                 script.onload = () => {
//                     // Só configurar eventos e permissões depois do script carregar
//                     configurarEventosEspecificos(url);

//                     if (window.initPermissoes) {
//                         setTimeout(() => {
//                             console.log("Reexecutando initPermissoes após carregar modal");
//                             initPermissoes();
//                         }, 100); // para garantir que DOM está pronto
//                     }
//                 };
//                 document.body.appendChild(script);
//             } else {
//                 // Script já carregado, só configurar eventos e permissões
//                 configurarEventosEspecificos(url);

//                 if (window.initPermissoes) {
//                     setTimeout(() => {
//                         console.log("Reexecutando initPermissoes após carregar modal (sem recarregar script)");
//                         initPermissoes();
//                     }, 100);
//                 }
//             }


//             let modal = modalContainer.querySelector(".modal");
//             let overlay = document.getElementById("modal-overlay");

//             if (modal) {
//                 modal.style.display = "block";
//                 overlay.style.display = "block";
//                 document.body.classList.add("modal-open");

//                 let closeButton = modal.querySelector('.close');
//                 if (closeButton) closeButton.addEventListener('click', fecharModal);          
                
//             }
//         })
//         .catch(error => console.error("Erro ao carregar modal:", error));
// }

// function fecharModal() {
//     console.log("FECHANDO  MODAL PELO MODAL.JS " );
//     let modalContainer = document.getElementById("modal-container");
//     let overlay = document.getElementById("modal-overlay");

//     if (modalContainer) {
//         modalContainer.innerHTML = "";
//         // modalContainer.style.display = "none";
//     }
    
//     if (overlay) {
//         // overlay.style.display = "none";
//     }

//     document.body.classList.remove("modal-open");
// }

// function configurarEventosEspecificos(url) {
//     console.log("Modal.js - Configurando eventos para:", url);

//     const rotas = [
//         { keyword: "Orcamento", func: configurarEventosOrcamento },
//         { keyword: "CadFuncao", func: configurarEventosFuncao },
//         { keyword: "CadLocalMontagem", func: configurarEventosMontagem },
//         { keyword: "CadEventos", func: configurarEventosCadEvento},
//         { keyword: "CadEquipamentos", func: configurarEventosEquipamento },
//         { keyword: "CadSuprimentos", func: configurarEventosSuprimento },
//         { keyword: "CadClientes", func: configurarEventosClientes },
//     ];

//     rotas.forEach(({ keyword, func }) => {
//         if (url.includes(keyword)) {
//             setTimeout(() => {
//                 if (typeof func === "function") {
//                     console.log(`Chamando ${func.name}()`);
//                     func();
//                 } else {
//                     console.error(`Função ${func.name} não encontrada!`);
//                 }
//             }, 500);
//         }
//     });

// }

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

//   // 2) Função utilitária
//   window.temPermissao = function(modulo, acao) {
//     const p = permissoes.find(x => x.modulo.toLowerCase() === modulo.toLowerCase());
//     return p && p[`pode_${acao}`];
//   };

//   // 3) Mostrar ou ocultar botões de cada modal
//   document.querySelectorAll(".abrir-modal").forEach(botao => {
//     const url = botao.dataset.url || "";
//     let modulo = "";

//     if (url.includes("Orcamento"))       modulo = "Orcamentos";
//     else if (url.includes("CadClientes")) modulo = "Clientes";
//     else if (url.includes("CadFuncao"))   modulo = "Funcao";
//     else if (url.includes("CadLocalMontagem")) modulo = "LocalMontagem";
//     else if (url.includes("CadEventos"))  modulo = "Eventos";
//     else if (url.includes("CadEquipamentos")) modulo = "Equipamentos";
//     else if (url.includes("CadSuprimentos"))  modulo = "Suprimentos";

//     // só exibe se tiver pelo menos pesquisar ou acessar
//     if (!temPermissao(modulo, "pesquisar") && !temPermissao(modulo, "acessar")) {
//       botao.style.display = "none";
//     } else {
//       // adiciona o listener só nos visíveis
//       botao.addEventListener("click", () => abrirModal(url, modulo));
//     }
//   });
// });

// async function abrirModal(url, modulo) {
//   console.log("tentando abrir modal de", modulo);

//   // 4) Verificação final antes de carregar
//   if (!window.temPermissao(modulo, "pesquisar") && !window.temPermissao(modulo, "acessar")) {
//     Swal.fire("Acesso Negado",
//       `Você não tem permissão para acessar o módulo ${modulo}.`,
//       "warning");
//     return;
//   }

//   // 5) Busca e injeta o HTML
//   try {
//     const resp = await fetch(url);
//     if (!resp.ok) throw new Error(`${resp.status}`);
//     const html = await resp.text();
//     const container = document.getElementById("modal-container");
//     container.innerHTML = html;
//   } catch (err) {
//     console.error("Erro ao carregar modal:", err);
//     return;
//   }

//   // 6) Carrega script específico do módulo
//   let scriptSrc = `js/${modulo.charAt(0).toUpperCase() + modulo.slice(1)}.js`;
//   if (!Array.from(document.scripts).some(s => s.src.includes(scriptSrc))) {
//     const script = document.createElement("script");
//     script.src = scriptSrc;
//     script.defer = true;
//     script.onload = () => configurarEPermissoes(modulo);
//     document.body.appendChild(script);
//   } else {
//     configurarEPermissoes(modulo);
//   }

//   // 7) Exibe o modal
//   const modal = document.querySelector("#modal-container .modal");
//   const overlay = document.getElementById("modal-overlay");
//   if (modal && overlay) {
//     modal.style.display = "block";
//     overlay.style.display = "block";
//     document.body.classList.add("modal-open");
//     modal.querySelector('.close')?.addEventListener('click', fecharModal);
//   }
// }

// function configurarEPermissoes(modulo) {
//   configurarEventosEspecificos(modulo);  // sua função de dentro do modal.js
//   // revalida permissões em campos/botões internos, se precisar:
//   if (!temPermissao(modulo, "cadastrar")) {
//     document.querySelectorAll(".btnCadastrar").forEach(btn => btn.style.display = "none");
//   }
//   if (!temPermissao(modulo, "alterar")) {
//     document.querySelectorAll(".btnEditar").forEach(btn => btn.style.display = "none");
//   }
// }

// function fecharModal() {
//   document.getElementById("modal-container").innerHTML = "";
//   document.getElementById("modal-overlay").style.display = "none";
//   document.body.classList.remove("modal-open");
// }

document.addEventListener("DOMContentLoaded", async function () {
  // 1) Buscar permissões do backend
  const token = localStorage.getItem("token");
  let permissoes = [];
  
  try {
    const resp = await fetch("/auth/permissoes", {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (resp.ok) {
      permissoes = await resp.json();
      window.permissoes = permissoes;
    } else {
      console.error("Falha ao carregar permissões:", await resp.text());
    }
  } catch (err) {
    console.error("Erro ao buscar permissões:", err);
  }

  // 2) Função utilitária de permissão
  window.temPermissao = function(modulo, acao) {
    if (!modulo) return false;
    const p = permissoes.find(x => x.modulo.toLowerCase() === modulo.toLowerCase());
    return p && p[`pode_${acao}`];
  };

  // 3) Mostrar/ocultar e adicionar listener nos botões de modal
  document.querySelectorAll(".abrir-modal").forEach(botao => {
    const url = botao.dataset.url || "";
    const explicitModulo = botao.dataset.modulo; // leia data-modulo se existir
    const urlLower = url.toLowerCase();
    let modulo = null;

    if (explicitModulo) {
      modulo = explicitModulo.toLowerCase();
    } else {
      // mapeamento de URL para módulo, baseado em lowercase
      if (urlLower.includes("orcamento"))            modulo = 'Orçamentos';
      else if (urlLower.includes("clientes"))         modulo = 'Clientes';
      else if (urlLower.includes("funcao"))           modulo = 'Função';
      else if (urlLower.includes("localmontagem"))    modulo = 'LocalMontagem';
      else if (urlLower.includes("eventos"))          modulo = 'Eventos';
      else if (urlLower.includes("equipamentos"))     modulo = 'Equipamentos';
      else if (urlLower.includes("suprimentos"))      modulo = 'Suprimentos';
    }

    if (!modulo) {
      console.warn(`Botão de modal com URL '${url}' não mapeia para módulo.`, botao);
      return;
    }

    // somente exibir se tiver permissão de acessar ou pesquisar
    if (!temPermissao(modulo, 'acessar') && !temPermissao(modulo, 'pesquisar')) {
      botao.style.display = 'none';
      return;
    }

    // adiciona listener se for visível
    botao.removeAttribute('onclick'); // remove qualquer onclick inline
    // botao.addEventListener('click', () => abrirModal(url, modulo));
    botao.addEventListener('click', () => {
      // GUARDO o módulo antes de tudo
      window.moduloAtual = modulo;
      console.log("🏷️  janela.moduloAtual setado para:", window.moduloAtual);
      abrirModal(url, modulo);
    });
    
  });
});

async function abrirModal(url, modulo) {
  console.log("Tentando abrir modal de", modulo);

  if (!modulo) {
    console.warn("abrirModal chamado com módulo indefinido, abortando.");
    return;
  }

  // checagem final de permissão
  if (!window.temPermissao(modulo, 'acessar') && !window.temPermissao(modulo, 'pesquisar')) {
    Swal.fire("Acesso Negado", `Você não tem permissão para acessar o módulo ${modulo}.`, "warning");
    return;
  }

  // buscar HTML do modal
  let html;
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Status ${resp.status}`);
    html = await resp.text();
  } catch (err) {
    console.error("Erro ao carregar modal:", err);
    return;
  }


  // inserir HTML e overlay
  const container = document.getElementById('modal-container');
  container.innerHTML = html;

  // ** Aqui aplicamos as permissões internas do modal: **
  if (window.permissoes && typeof aplicarPermissoes === 'function') {
    aplicarPermissoes(window.permissoes);
  }

  // carregar script do módulo dinamicamente
  const scriptName = modulo.charAt(0).toUpperCase() + modulo.slice(1) + '.js';
  const scriptSrc = `js/${scriptName}`;
  if (!Array.from(document.scripts).some(s => s.src.includes(scriptName))) {
    const script = document.createElement('script');
    script.src = scriptSrc;
    script.defer = true;
    // script.onload = () => aplicarConfiguracoes(modulo);
    script.onload = () => {
      console.log("✅ Script do módulo carregado:", scriptName);
      aplicarConfiguracoes(modulo);
    };
    document.body.appendChild(script);
  } else {
    aplicarConfiguracoes(modulo);
  }

  // exibir modal e overlay
  const modal = document.querySelector('#modal-container .modal');
  const overlay = document.getElementById('modal-overlay');
  if (modal && overlay) {
    modal.style.display = 'block';
    overlay.style.display = 'block';
    document.body.classList.add('modal-open');
    modal.querySelector('.close')?.addEventListener('click', fecharModal);
  }
}

function aplicarConfiguracoes(modulo) {
  // configura eventos específicos do módulo
  if (typeof configurarEventosEspecificos === 'function') {
    configurarEventosEspecificos(modulo);
  }

  // aplicar permissões internas (botões de ação)
  if (!temPermissao(modulo, 'cadastrar')) {
    document.querySelectorAll('.btnCadastrar').forEach(btn => btn.style.display = 'none');
  }
  if (!temPermissao(modulo, 'alterar')) {
    document.querySelectorAll('.btnEditar').forEach(btn => btn.style.display = 'none');
  }
}

function fecharModal() {
  document.getElementById('modal-container').innerHTML = '';
  document.getElementById('modal-overlay').style.display = 'none';
  document.body.classList.remove('modal-open');
}
