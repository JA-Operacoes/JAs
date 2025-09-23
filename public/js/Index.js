import { fetchComToken, fetchHtmlComToken } from '../utils/utils.js';

document.addEventListener("DOMContentLoaded", async function () { 

    // --- INÍCIO: Controle de empresas permitidas ---
  function getEmpresasDoUsuario() {
    const token = localStorage.getItem("token");
    if (!token) return [];
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.empresas || [];
    } catch (e) {
      console.warn("Token inválido ou sem empresas:", e);
      return [];
    }
  }

  // Mapeie os logotipos para seus IDs de empresa
  // const logos = [
  //   { selector: '.logo-Oper', id: 1 },
  //   { selector: '.logo-ES', id: 2 },
  //   { selector: '.logo-EA', id: 3 },
  //   { selector: '.logo-EP', id: 4 },
  //   { selector: '.logo-SNFoods', id: 5 },
  //   { selector: '.logo-TSD', id: 6 }
  // ];

  // const empresasPermitidas = getEmpresasDoUsuario();

  // logos.forEach(logo => {
  //   const el = document.querySelector(logo.selector);
  //   if (el) {
  //     if (!empresasPermitidas.includes(logo.id)) {
  //       el.style.display = 'none'; // Esconde se não tem permissão
  //     } else {
  //       el.setAttribute('data-idempresa', logo.id);
  //       el.addEventListener('click', function() {
  //         localStorage.setItem('idempresa', logo.id);
  //         // O redirecionamento já acontece pelo href do <a>
  //       });
  //     }
  //   }
  // });


  try {
        // 1. Pega a lista de empresas permitidas do token do usuário.
        const empresasPermitidas = getEmpresasDoUsuario();

        // 2. Busca a lista de todas as empresas do backend (usando a nova rota /empresas).
        const empresasDoBackend = await fetchComToken("/index/empresas"); 

        console.log("Empresas do backend e empresas permitidas:", empresasDoBackend, empresasPermitidas);
        
        // 3. Mapeia as empresas para uma lista de logos com os IDs e seletores corretos.
        //    O nome fantasia deve ser limpo para corresponder ao seletor CSS.
        const logos = empresasDoBackend.map(empresa => {
            const nmfantasiaLower = empresa.nmfantasia.toLowerCase().replace(/ /g, '');
            return {
                selector: `.logo-${nmfantasiaLower}`,
                id: empresa.idempresa
            };
        });

        // 4. Itera sobre a nova lista de logos dinâmica para mostrar/esconder.
        logos.forEach(logo => {
        //  console.log("Processando logo:", logo);
            const el = document.querySelector(logo.selector);
          //  console.log(`el: ${el} para seletor ${logo.selector}`);
            if (el) {
               
                // Se o ID da empresa do backend não estiver na lista do token, esconde o logo.
                if (!empresasPermitidas.includes(logo.id)) {                 
                    el.style.display = 'none';
                } else {
                    // Se o usuário tem permissão, mostra o logo e configura o evento de clique.
                    el.setAttribute('data-idempresa', logo.id);
                    
                    el.addEventListener('click', function() {
                      console.log(`Empresa selecionada: ${logo.id}`);
                        localStorage.setItem('idempresa', logo.id);
                        // O redirecionamento já acontece pelo href do <a>
                        window.location.reload(); // Recarrega a página para aplicar o tema
                        
                    });
                }
              //  console.log(`PROCESSADO LOGO: ${logo.selector} PARA EMPRESA ID: ${logo.id}`);
            }
        });

    } catch (error) {
        console.error("Falha ao carregar a lista de empresas do backend:", error);
        // Exibe um SweetAlert de erro ou lide com a situação
    }

  let permissoesArray; // Renomeado para clareza
  let permissoesPromise; 
  let mapaModulos = {};

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

  // try {
  //     console.log("Buscando lista de módulos do banco de dados...");
  //     const modulosDoBanco = await fetchComToken("/index/modulos"); // Chame seu novo endpoint

  //     console.log("MODULOS", modulosDoBanco.value);
      
  //     if (!Array.isArray(modulosDoBanco) || modulosDoBanco.length === 0) {
  //         console.warn("Nenhum módulo retornado do banco de dados ou formato inválido.", modulosDoBanco);
  //         // Poderia lançar um erro ou continuar com um mapa vazio, dependendo da sua necessidade
  //     } else {
  //         // Constrói o mapaModulos a partir dos dados do banco
  //         modulosDoBanco.forEach(m => {
  //             mapaModulos[m.modulo.toLowerCase()] = m.modulo; // Assumindo 'nome_modulo' é a chave e 'nome_exibicao' é o valor
  //         });
  //         console.log("Mapa de módulos carregado dinamicamente:", mapaModulos);
  //     }
  // } catch (error) {
  //     console.error("Falha ao carregar lista de módulos do banco de dados:", error);
  // }
      
  try {
      console.log("Buscando lista de módulos do banco de dados...");
      const modulosDoBanco = await fetchComToken("/index/modulos");

      console.log("Resposta do banco de dados:", modulosDoBanco);

      // CORREÇÃO: Acessar a propriedade 'rows' do objeto retornado.
      if (!modulosDoBanco || !Array.isArray(modulosDoBanco.rows) || modulosDoBanco.rows.length === 0) {
          console.warn("Nenhum módulo retornado do banco de dados ou formato inválido.", modulosDoBanco);
      } else {
          // Constrói o mapaModulos a partir dos dados da propriedade 'rows'
          modulosDoBanco.rows.forEach(m => {
              if (m.modulo && typeof m.modulo === 'string') {
                  mapaModulos[m.modulo.toLowerCase()] = m.modulo;
              }
          });
          console.log("Mapa de módulos carregado dinamicamente:", mapaModulos);
      }
  } catch (error) {
      console.error("Falha ao carregar lista de módulos do banco de dados:", error);
  }

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

  // const mapaModulos = {
  //   orcamentos: "Orcamentos",
  //   clientes: "Clientes",
  //   funcao: "Funcao",
  //   localmontagem: "Localmontagem",
  //   eventos: "Eventos",
  //   equipamentos: "Equipamentos",
  //   suprimentos: "Suprimentos",
  //   funcionarios: "Funcionarios",
  //   staff: "Staff",
  //   usuarios: "Usuarios",
  //   empresas: "Empresas",
  //   bancos: "Bancos",
  //   aside: "Aside"
  // };

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
        // modalContent.addEventListener("mousedown", (event) => {
        //     event.stopPropagation();
        //     console.log("Mousedown dentro do modal-content detectado (CAPTURA). Propagação interrompida.");
        // }, true); // <--- TRUE AQUI PARA FASE DE CAPTURA

        // // Adicionar listener para mouseup no modalContent também (fase de CAPTURA)
        // modalContent.addEventListener("mouseup", (event) => {
        //     event.stopPropagation();
        //     console.log("Mouseup dentro do modal-content detectado (CAPTURA). Propagação interrompida.");
        // }, true);

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

  const moduloQueEstaFechando = window.moduloAtual;
    if (window.moduloHandlers[moduloQueEstaFechando] && typeof window.moduloHandlers[moduloQueEstaFechando].desinicializar === 'function') {
        console.log(`Desinicializando módulo ${moduloQueEstaFechando} antes de fechar o modal.`);
        window.moduloHandlers[moduloQueEstaFechando].desinicializar();
        window.location.reload();
    }

  document.getElementById("modal-container").innerHTML = "";
  document.getElementById("modal-overlay").style.display = "none";
  document.body.classList.remove("modal-open");
}