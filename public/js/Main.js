import { fetchComToken, aplicarTema, fetchHtmlComToken  } from '/utils/utils.js';


const getRecordIdFromUrl = (url) => {
    const parts = url.split('/');
    const lastPart = parts[parts.length - 1];
    // Retorna o último segmento se for um número, caso contrário retorna null
    return !isNaN(parseInt(lastPart)) ? lastPart : null;
};



async function abrirModalLocal(url, modulo) {
  if (!modulo) modulo = window.moduloAtual || "Staff";
  console.log("[abrirModalLocal] iniciar:", { modulo, url });

  let html;
  try {
    console.log("[abrirModalLocal] fetchHtmlComToken ->", url);
    html = await fetchHtmlComToken(url);
    console.log("[abrirModalLocal] HTML recebido, tamanho:", html ? html.length : 0);
  } catch (err) {
    console.error("[abrirModalLocal] Erro ao carregar modal (local):", err);
    return;
  }

  const container = document.getElementById("modal-container");
  if (!container) {
    console.error("[abrirModalLocal] modal-container não encontrado no DOM.");
    return;
  }

  // injeta HTML do modal
  container.innerHTML = html;
  console.log("[abrirModalLocal] HTML injetado no #modal-container");

  // remove script anterior se existir
  const scriptId = 'scriptModuloDinamico';
  const scriptAntigo = document.getElementById(scriptId);
  if (scriptAntigo) {
    scriptAntigo.remove();
    console.log("[abrirModalLocal] script anterior removido");
  }

  // carrega script do módulo (Staff.js por exemplo)
  const scriptName = modulo.charAt(0).toUpperCase() + modulo.slice(1) + ".js";
  const scriptSrc = `js/${scriptName}`;

  // cria promise para aguardar load / execução do módulo
  await new Promise((resolve, reject) => {
    console.log("[abrirModalLocal] carregando script do módulo:", scriptSrc);
    const script = document.createElement("script");
    script.id = scriptId;
    script.src = scriptSrc;
    script.defer = true;
    script.type = "module";

    script.onload = () => {
      // aguarda um tick para garantir execução de exports/global assignments
      setTimeout(() => {
        console.log(`[abrirModalLocal] Script ${scriptName} carregado e executado.`);
        resolve();
      }, 50);
    };
    script.onerror = (e) => {
      console.error(`[abrirModalLocal] Erro ao carregar script ${scriptSrc}`, e);
      reject(new Error(`Erro ao carregar script ${scriptSrc}`));
    };
    document.body.appendChild(script);
  }).catch(err => {
    console.error("[abrirModalLocal] falha ao carregar script do módulo:", err);
    return;
  });

  // =========================================================================
      // 🎯 PONTO DE INSERÇÃO: BUSCA DE DADOS E CARREGAMENTO DE DATAS (Edição)
      // =========================================================================
      const recordId = getRecordIdFromUrl(url);

      console.log("RECORD ID", recordId);

      if (recordId) {
        try {
            // 1. Busca os dados do Staff/Evento (Assumindo que o endpoint é: /staff/data/ID)
            const dataUrl = `/${modulo.toLowerCase()}/data/${recordId}`; 
            const staffData = await fetchComToken(dataUrl);
            console.log("[abrirModalLocal] Dados do Staff para edição carregados:", staffData);


            if (staffData) {
                // Expõe os dados para que o applyModalPrefill ou o Staff.js possam usá-los
                window.__modalFetchedData = staffData;
                
                const datasOrcamento = staffData.datasOrcamento.map(item => item.data); // Array de datas no formato "YYYY-MM-DD"
                console.log("[abrirModalLocal] Datas do orçamento extraídas:", datasOrcamento);

                const datasDoStaff = staffData.datasevento;

                // 2. Preenchimento do Flatpickr
                // Deve usar window.datasEventoPicker (a instância global do Flatpickr)
//                 if (window.datasEventoPicker && datasDoStaff && Array.isArray(datasDoStaff)) {
//                     // Define as datas. 'true' garante que o evento 'onChange' dispare o debouncedOnCriteriosChanged.
//                     window.datasEventoPicker.setDate(datasDoStaff, true);
//                     console.log(`[abrirModalLocal] Datas carregadas no Flatpickr: ${datasDoStaff.length} dias.`);
//                 } else {
//                     console.warn("[abrirModalLocal] Flatpickr ou dados de staff (datasevento) ausentes/inválidos.", { picker: !!window.datasEventoPicker, data: datasDoStaff });
//                 }

                // 3. (Opcional) Chamar o debounce para garantir o carregamento do orçamento
                if (typeof window.debouncedOnCriteriosChanged === 'function') {
                    window.debouncedOnCriteriosChanged();
                    console.log("[abrirModalLocal] Verificação de orçamento (debounce) chamada.");
                }
                
                // 4. (Opcional) Disparar um evento para o Staff.js preencher os outros campos
                document.dispatchEvent(new CustomEvent("modal:data:loaded", { detail: staffData }));

            }
        } catch (error) {
            console.error(`[abrirModalLocal] Erro ao carregar dados do ${modulo} (ID: ${recordId}):`, error);
        }
      }
      // =========================================================================

  // mostra modal (espera elemento modal injetado)
  const modal = document.querySelector("#modal-container .modal");
  const overlay = document.getElementById("modal-overlay");
  if (modal && overlay) {
    modal.style.display = "block";
    overlay.style.display = "block";
    document.body.classList.add("modal-open");
    console.log("[abrirModalLocal] modal exibido");

    // fechar por overlay
    overlay.addEventListener("mousedown", (event) => {
      if (event.target === overlay) {
        console.log("[abrirModalLocal] overlay clicado -> fechar");
        if (typeof fecharModal === "function") {
            fecharModal();
        } else {
          overlay.style.display = "none";
          container.innerHTML = "";
          document.body.classList.remove("modal-open");
            // Chama o callback AQUI
            if (typeof window.onStaffModalClosed === 'function') {
                window.onStaffModalClosed(false);
            }
        }
      }
    });

    // modal.querySelector(".close")?.addEventListener("click", () => {
    //   console.log("[abrirModalLocal] fechar (botão X)");
    //   if (typeof fecharModal === "function") fecharModal();
    //   else {
    //     overlay.style.display = "none";
    //     container.innerHTML = "";
    //     document.body.classList.remove("modal-open");
    //   }
    // });

    modal.querySelector(".close")?.addEventListener("click", () => {
      console.log("[abrirModalLocal] fechar (botão X)");

      // Se a função global existir, use-a para garantir o comportamento de callback.
      if (typeof fecharModal === "function") {
        fecharModal(); 
      } else {
        // Fallback de fechamento, e aqui você DEVE incluir o callback.
        overlay.style.display = "none";
        container.innerHTML = "";
        document.body.classList.remove("modal-open");
        // Chama o callback AQUI para garantir que a tela volte, mesmo sem a função fecharModal
        if (typeof window.onStaffModalClosed === 'function') {
            window.onStaffModalClosed(false); // false indica que não foi fechado pela função principal, mas ainda deve voltar
        }
      }
      // A linha de window.location.reload() FOI REMOVIDA.
    });
  } else {
    console.warn("[abrirModalLocal] estrutura de modal não encontrada após injeção do HTML.");
  }

  // --- Inicializa o módulo carregado ---
  try {
    console.log("[abrirModalLocal] inicializando módulo:", modulo);

    // 1) preferencial: handler registrado pelo módulo (window.moduloHandlers)
    if (window.moduloHandlers && window.moduloHandlers[modulo] && typeof window.moduloHandlers[modulo].configurar === "function") {
      console.log("[abrirModalLocal] chamando window.moduloHandlers[...] .configurar");
      window.moduloHandlers[modulo].configurar();
    } else if (typeof window.configurarEventosEspecificos === "function") {
      console.log("[abrirModalLocal] chamando window.configurarEventosEspecificos");
      window.configurarEventosEspecificos(modulo);
    } else if (typeof window.configurarEventosStaff === "function" && modulo.toLowerCase() === "staff") {
      console.log("[abrirModalLocal] chamando window.configurarEventosStaff");
      window.configurarEventosStaff();
    } else {
      console.log("[abrirModalLocal] nenhuma função de configuração detectada");
    }

    // setTimeout(() => {
    //     console.log("[abrirModalLocal] Inicializando Flatpickr com limites após atraso.");
    //     window.inicializarFlatpickrStaffComLimites();
    // }, 100); 

    setTimeout(() => {
        if (typeof window.configurarEventosStaff === "function") {
            console.log("[abrirModalLocal] Chamando configurarEventosStaff após atraso.");
            window.configurarEventosStaff();
        }
    }, 100); 

    // 4) tenta aplicar prefill imediato (se o módulo já injetou selects/inputs)
    setTimeout(() => {
      try {
        console.log("[abrirModalLocal] tentando applyModalPrefill imediato");
        if (typeof window.applyModalPrefill === "function") {
          const ok = window.applyModalPrefill(window.__modalInitialParams || "");
          console.log("[abrirModalLocal] applyModalPrefill retornou:", ok);
        } else {
          const evt = new CustomEvent("modal:prefill", { detail: window.__modalInitialParams || "" });
          document.dispatchEvent(evt);
          console.log("[abrirModalLocal] evento modal:prefill disparado");
        }
      } catch (e) {
        console.warn("[abrirModalLocal] prefill falhou", e);
      }
    }, 800); //80

    // pequena garantia: re-tentar inicialização caso o módulo popule DOM com atraso
    setTimeout(() => {
      try {
        if (window.moduloHandlers && window.moduloHandlers[modulo] && typeof window.moduloHandlers[modulo].configurar === "function") {
          console.log("[abrirModalLocal] re-executando moduloHandlers.configurar (retry)");
          window.moduloHandlers[modulo].configurar();
        }
      } catch (e) { console.warn("[abrirModalLocal] retry configurar falhou", e); }
    }, 400);

    setTimeout(() => {
      const staffData = window.__modalFetchedData;
      const datasDoStaff = staffData?.datasevento; // Usa optional chaining para segurança
        
      // Verifica se o picker e os dados existem
      if (window.datasEventoPicker && datasDoStaff && Array.isArray(datasDoStaff)) {
          
          // Define as datas, disparando onChange (necessário para sincronizar com Diária Dobrada/Meia Diária)
          window.datasEventoPicker.setDate(datasDoStaff, true); 
          
          // 🌟 GARANTIA DE FORMATO: Força a re-renderização do altInput
          // Isso resolve o problema de YYYY-MM-DD e múltiplos campos.
          if (window.datasEventoPicker.altInput) {
              window.datasEventoPicker.altInput.value = window.datasEventoPicker.formatDate(
                  window.datasEventoPicker.selectedDates, 
                  window.datasEventoPicker.config.altFormat
              );
          }
          
          console.log(`[abrirModalLocal] [SetDate Seguro] Datas carregadas no Flatpickr: ${datasDoStaff.length} dias, formato corrigido.`);

      } else {
          console.warn("[abrirModalLocal] [SetDate Seguro] Flatpickr ou dados de staff (datasevento) ausentes/inválidos.");
      }
    }, 500);
  } catch (err) {
    console.warn("[abrirModalLocal] inicialização do módulo apresentou erro", err);
  }
}

window.applyModalPrefill = function(rawParams) {
  try {
    console.log("[applyModalPrefill] iniciar. rawParams:", rawParams);
    console.log("[applyModalPrefill] Parâmetros definidos:", window.__modalInitialParams);
    const raw = rawParams || window.__modalInitialParams || (window.location.search ? window.location.search.replace(/^\?/,'') : "");
    console.log("[applyModalPrefill] raw usado:", raw);
    if (!raw) {
      console.log("[applyModalPrefill] sem params, abortando");
      return false;
    }
    const params = new URLSearchParams(raw);

    console.log("[applyModalPrefill ABRIRMODALLOCAL] URLSearchParams:", Array.from(params.entries()));

    // leitura dos valores esperados
    const prefill = {
      idevento: params.get("idevento"),
      idfuncao: params.get("idfuncao"),
      idequipe: params.get("idequipe"),
      idcliente: params.get("idcliente"),
      idmontagem: params.get("idmontagem"),
      nmequipe: params.get("nmequipe") || params.get("idequipe_nome"),
      nmfuncao: params.get("nmfuncao"),
      nmevento: params.get("nmevento"),
      nmcliente: params.get("nmcliente"),
      nmlocalmontagem: params.get("nmlocalmontagem") || params.get("idmontagem_nome")
    };
    console.log("[applyModalPrefill] prefill parseado:", prefill);

    // expõe para uso posterior (Staff.js ou observers)
    window.__modalDesiredPrefill = prefill;

    // helper: tenta aplicar em hidden/input simples
    function setHidden(id, value) {
      if (!value) return;
      const el = document.getElementById(id);
      if (el) {
        el.value = value;
        console.log(`[applyModalPrefill] setHidden ${id}=${value}`);
      } else {
        console.log(`[applyModalPrefill] hidden ${id} não encontrado`);
      }
    }

    setHidden("idEvento", prefill.idevento);
    //setHidden("idStaffEvento", prefill.idstaffevento);
    setHidden("idEquipe", prefill.idequipe);
    setHidden("idFuncao", prefill.idfuncao);
    setHidden("idCliente", prefill.idcliente);
    setHidden("idMontagem", prefill.idmontagem);

    // helper: tenta selecionar option existente — NÃO cria option para evitar sobrescrever listas carregadas depois
    function trySelectIfExists(selectId, value, text) {
      if (!value && !text) return false;
      const sel = document.getElementById(selectId);
      if (!sel) {
        console.log(`[applyModalPrefill] select ${selectId} não existe ainda`);
        return false;
      }
      const options = Array.from(sel.options || []);
      // tenta por value primeiro
      let opt = options.find(o => String(o.value) === String(value));
      if (!opt && text) {
        opt = options.find(o => (o.textContent || o.text || "").trim() === String(text).trim());
      }
      if (opt) {
        sel.value = opt.value;
        sel.dispatchEvent(new Event("change", { bubbles: true }));
        console.log(`[applyModalPrefill] selecionado ${selectId} -> value:${opt.value} text:${opt.text}`);
        return true;
      }
      console.log(`[applyModalPrefill] opção não encontrada em ${selectId} para value:${value} text:${text}`);
      return false;
    }

    // Observador que aguarda opções serem adicionadas a um <select> e então tenta aplicar
    function observeSelectUntilPopulated(selectId, value, text, timeout = 3000) {
      const sel = document.getElementById(selectId);
      if (!sel) {
        console.log(`[applyModalPrefill] observe: select ${selectId} não existe, pulando`);
        return;
      }
      if (trySelectIfExists(selectId, value, text)) return;

      console.log(`[applyModalPrefill] observando select ${selectId} até popular (timeout ${timeout}ms)`);
      const mo = new MutationObserver((mutations) => {
        if (trySelectIfExists(selectId, value, text)) {
          try { mo.disconnect(); } catch(e) {}
          console.log(`[applyModalPrefill] observe: option aplicada em ${selectId}`);
        }
      });

      mo.observe(sel, { childList: true, subtree: true });

      setTimeout(() => {
        try { mo.disconnect(); } catch (e) {}
        const still = document.getElementById(selectId);
        
        // LINHA 244 ATUALIZADA (CORREÇÃO DO PRIMEIRO TypeError: reading 'length')
        if (still && still.options && (still.options.length === 0 || !trySelectIfExists(selectId, value, text))) { 
            console.log(`[applyModalPrefill] timeout atingido para ${selectId}. Criando option fallback (se tiver texto).`);
            if (text || value) {
                const opt = document.createElement("option");
                opt.value = value || text || "";
                opt.text = text || value || "Selecionado";
                opt.selected = true;
                still.appendChild(opt);

                // NOVA LINHA (CORREÇÃO DO SEGUNDO TypeError em Staff.js:3345)
                still.value = opt.value; 
                
                // LINHA 252 ATUALIZADA (agora mais segura)
                still.dispatchEvent(new Event('change', { bubbles: true }));
                console.log(`[applyModalPrefill] option fallback criado em ${selectId} value:${opt.value}`);
            }
        }
    }, timeout);
}

    // Campos para tentar aplicar agora / observar
    const selectsToTry = [
      { id: "nmEvento", val: prefill.idevento, txt: prefill.nmevento },
      { id: "nmCliente", val: prefill.idcliente, txt: prefill.nmcliente },
      { id: "nmLocalMontagem", val: prefill.idmontagem, txt: prefill.nmlocalmontagem },
      { id: "nmEquipe", val: prefill.idequipe, txt: prefill.nmequipe },
      { id: "descFuncao", val: prefill.idfuncao, txt: prefill.nmfuncao }
    ];

    console.log("[applyModalPrefill] selectsToTry:", selectsToTry);

    // tenta aplicar imediatamente, senão observa
    // selectsToTry.forEach(s => {
    //   console.log("[applyModalPrefill] tentativa imediata select:", s.id, s.val, s.txt);
    //   if (!trySelectIfExists(s.id, s.val, s.txt)) {
    //     observeSelectUntilPopulated(s.id, s.val, s.txt, 3000);
    //   }
    // });

    // selectsToTry.forEach(s => {
    //     console.log("[applyModalPrefill] tentativa imediata select:", s.id, s.val, s.txt);
    //     if (!trySelectIfExists(s.id, s.val, s.txt)) {
    //         // Para os campos dependentes (Equipe e Função), adicione um delay
    //         // Isso dá tempo para Evento/Cliente/Local serem selecionados e dispararem o carregamento das listas subsequentes.
    //         if (s.id === "nmEquipe" || s.id === "descFuncao") {
    //             // 💡 CORREÇÃO: Adiciona um pequeno delay antes de iniciar a observação para Equipe e Função.
    //             // O Evento e o Cliente precisam de tempo para carregar as Equipes.
    //             setTimeout(() => {
    //                 observeSelectUntilPopulated(s.id, s.val, s.txt, 3000);
    //             }, 500); // 500ms é um delay seguro para a maioria dos carregamentos assíncronos.
    //         } else {
    //             // Campos independentes (Evento, Cliente, LocalMontagem) observam imediatamente
    //             observeSelectUntilPopulated(s.id, s.val, s.txt, 3000);
    //         }
    //     }
    // });

    selectsToTry.forEach(s => {
        console.log("[applyModalPrefill] tentativa imediata select:", s.id, s.val, s.txt);
        
        if (!trySelectIfExists(s.id, s.val, s.txt)) {
            // Se a seleção imediata falhar, inicie a observação para *todos* os campos.
            // Atrasamos o início da observação na função abrirModalLocal (Passo 1), o que é suficiente.
            observeSelectUntilPopulated(s.id, s.val, s.txt, 3000);
        }
    });
  
// No Main.js, no bloco selectsToTry.forEach(...)



// Nota: Com esta abordagem, você pode APAGAR a função observeSelectUntilPopulated
// (ou pelo menos remover as chamadas a ela), pois não estamos mais usando o MutationObserver,
// mas sim o retry forçado via setTimeout.
    
    // Quando o usuário escolher um funcionário, aplicar campos dependentes (equipe/função/evento/cliente/local)
    const nmFuncionario = document.getElementById("nmFuncionario");
    if (nmFuncionario) {
      console.log("[applyModalPrefill] nmFuncionario existe -> adicionando listener para aplicar dependentes quando escolhido");
      nmFuncionario.addEventListener("change", function handler() {
        console.log("[applyModalPrefill] nmFuncionario change detectado, aplicando dependentes");
        selectsToTry.forEach(s => {
          const el = document.getElementById(s.id);
          const userSelected = el && el.value && el.value !== "" && Array.from(el.options || []).some(o => o.value === el.value);
          if (!userSelected) trySelectIfExists(s.id, s.val, s.txt);
        });
        nmFuncionario.removeEventListener("change", handler);
      }, { once: true });
    } else {
      console.log("[applyModalPrefill] nmFuncionario não existe ainda -> observando DOM para adicioná-lo");
      const bodyObs = new MutationObserver((mut, obs) => {
        const sel = document.getElementById("nmFuncionario");
        if (sel) {
          console.log("[applyModalPrefill] nmFuncionario injetado -> adicionando listener");
          sel.addEventListener("change", function handler() {
            console.log("[applyModalPrefill] nmFuncionario change detectado (via observer)");
            selectsToTry.forEach(s => {
              const el = document.getElementById(s.id);
              const userSelected = el && el.value && el.value !== "" && Array.from(el.options || []).some(o => o.value === el.value);
              if (!userSelected) trySelectIfExists(s.id, s.val, s.txt);
            });
            sel.removeEventListener("change", handler);
          }, { once: true });
          obs.disconnect();
        }
      });
      bodyObs.observe(document.body, { childList: true, subtree: true });
    }

    

    // notifica listeners que o prefill foi registrado (módulo pode reagir)
    console.log("[applyModalPrefill] prefill registrado, dispatching prefill:registered");
    document.dispatchEvent(new CustomEvent("prefill:registered", { detail: { prefill } }));

    // limpa var global inicial, mantemos __modalDesiredPrefill para possíveis usos posteriores
    try { delete window.__modalInitialParams; } catch(e) { window.__modalInitialParams = null; }

    return true;
  } catch (err) {
    console.error("[applyModalPrefill] erro:", err);
    return false;
  }
};




// Função para obter o idempresa do localStorage
function getIdEmpresa() {
  return localStorage.getItem("idempresa");
}

// Função para buscar resumo dos cards
  async function buscarResumo() {
  return await fetchComToken("/main");
}

function getUsuarioLogado() {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("Usuário não logado");

  const payload = JSON.parse(atob(token.split(".")[1]));

  return {
    idusuario: payload.idusuario,
    nome: payload.nome || "Usuário",
    permissoes: payload.permissoes || [] // garante que sempre retorna array
  };
}

async function atualizarResumo() {
  const dadosResumo = await buscarResumo();
  // Cards de orçamentos
  document.getElementById("orcamentosTotal").textContent = dadosResumo.orcamentos;
  document.getElementById("orcamentosPendentes").textContent = dadosResumo.orcamentosAbertos;
  document.getElementById("orcamentosFechados").textContent = dadosResumo.orcamentosFechados;
}

function usuarioTemPermissao() {
  if (!window.permissoes || !Array.isArray(window.permissoes)) return false;
console.log("Usuário tem permissão master no staff");
  const permissaoStaff = window.permissoes.find(p => p.modulo?.toLowerCase() === "staff");
  if (!permissaoStaff) return false;

  return !!permissaoStaff.pode_master; 
}

function usuarioTemPermissaoFinanceiro() {
    if (!window.permissoes || !Array.isArray(window.permissoes)) return false;
    console.log("Usuário tem permissão Financeiro no staff");
    const permissaoStaff = window.permissoes.find(p => p.modulo?.toLowerCase() === "staff");
    if (!permissaoStaff) return false;

    // A flag que você usa para determinar o acesso ao financeiro
    return !!permissaoStaff.pode_financeiro; 
}

// Evento no card financeiro
const cardFinanceiro = document.querySelector(".card-financeiro");
if (cardFinanceiro) {
  cardFinanceiro.addEventListener("click", async () => {
    await mostrarPedidosUsuario();
  });
}

// =========================
//         Atividades
// =========================


function getIdExecutor() {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("Usuário não logado");
  
  const payload = JSON.parse(atob(token.split(".")[1]));
  if (!payload.idusuario) throw new Error("ID do usuário não encontrado no token");
  return payload.idusuario;
}

// Função para buscar todos os logs do usuário
async function buscarLogsUsuario() {
  const idexecutor = getIdExecutor();
  if (!idexecutor) throw new Error("idexecutor não definido");

  const resposta = await fetchComToken(`/Main/atividades-recentes?idexecutor=${idexecutor}`, {
    headers: { 'Content-Type': 'application/json' }
  });

  return resposta;
}

// Função para atualizar o painel de logs
async function atualizarAtividades() {
  try {
    const atividades = await buscarLogsUsuario();
    const conteudo = document.getElementById("painelDetalhes");

    if (!conteudo) return;
    conteudo.innerHTML = "";

    if (!atividades || atividades.length === 0) {
      conteudo.innerHTML = "<p>Nenhuma atividade encontrada.</p>";
      return;
    }

    // Função auxiliar para renderizar dados
    function renderizarDados(dados) {
      if (!dados) return "<em>Vazio</em>";

      // Se for array de objetos
      if (Array.isArray(dados)) {
        if (dados.length === 0) return "<em>Array vazio</em>";

        // Se os elementos forem objetos -> mostrar em mini tabela
        if (typeof dados[0] === "object") {
          let html = "<table class='mini-tabela'>";
          html += "<thead><tr>";
          Object.keys(dados[0]).forEach(key => {
            html += `<th>${key}</th>`;
          });
          html += "</tr></thead><tbody>";

          dados.forEach(obj => {
            html += "<tr>";
            Object.values(obj).forEach(val => {
              html += `<td>${val !== null && val !== undefined ? val : ""}</td>`;
            });
            html += "</tr>";
          });

          html += "</tbody></table>";
          return html;
        }

        // Se for array simples (ex: [1,2,3])
        return `<pre>${JSON.stringify(dados, null, 2)}</pre>`;
      }

      // Se for objeto simples
      if (typeof dados === "object") {
        return `<pre>${JSON.stringify(dados, null, 2)}</pre>`;
      }

      // Se for string ou outro tipo primitivo
      return `<pre>${dados}</pre>`;
    }

    // Monta tabela principal
    const tabela = document.createElement("table");
    tabela.classList.add("tabela-atividades");

    tabela.innerHTML = `
      <thead>
        <tr>
          <th>Módulo</th>
          <th>Ação</th>
          <th>Data</th>
          <th>Antes</th>
          <th>Depois</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;

    const tbody = tabela.querySelector("tbody");

    atividades.forEach(ativ => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${ativ.modulo}</td>
        <td>${ativ.acao}</td>
        <td>${new Date(ativ.criado_em).toLocaleString()}</td>
        <td>${renderizarDados(ativ.dadosanteriores)}</td>
        <td>${renderizarDados(ativ.dadosnovos)}</td>
      `;
      tbody.appendChild(tr);
    });

    conteudo.appendChild(tabela);

  } catch (err) {
    console.error("Erro ao atualizar atividades:", err);
    const conteudo = document.getElementById("conteudoDetalhes");
    if (conteudo) {
      conteudo.innerHTML = "<p>Erro ao carregar atividades.</p>";
    }
  }
}

document.addEventListener("DOMContentLoaded", function () {
  const card = document.getElementById("card-atividades");
  if (card) {
    card.addEventListener("click", atualizarAtividades);
  }
});

// =========================
//          Eventos 
// =========================

async function atualizarProximoEvento() {
    const resposta = await fetchComToken("/main/proximo-evento", {
        headers: { idempresa: getIdEmpresa() }
    });

    const nomeSpan = document.getElementById("proximoEventoNome");
    const tempoSmall = document.getElementById("proximoEventoTempo");

    if (!resposta.eventos || resposta.eventos.length === 0) {
        nomeSpan.textContent = "Sem próximos eventos agendados.";
        tempoSmall.textContent = "--";
        return;
    }

    // Função para criar Date no fuso local a partir de "YYYY-MM-DD"
    function parseDateLocal(dateStr) {
        if (typeof dateStr === "string") {
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                const [y, m, d] = dateStr.split("-").map(Number);
                return new Date(y, m - 1, d);
            }
            return new Date(dateStr); // ISO
        }
        return new Date(dateStr); // Já é Date
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    let proximos = resposta.eventos
        .map(ev => ({ ...ev, data: parseDateLocal(ev.data) }))
        .filter(ev => ev.data.getTime() >= hoje.getTime());

    if (proximos.length === 0) {
        nomeSpan.textContent = "Sem próximos eventos agendados.";
        tempoSmall.textContent = "--";
        return;
    }

    function formatarTempoRestante(dataEvento) {
        const hojeTmp = new Date();
        hojeTmp.setHours(0,0,0,0);
        const diffDias = Math.round((dataEvento - hojeTmp) / (1000 * 60 * 60 * 24));
        if (diffDias > 0) return `(em ${diffDias} dia${diffDias > 1 ? "s" : ""})`;
        else if (diffDias === 0) return "(hoje)";
        else return "(já começou)";
    }

    const limite = new Date();
    limite.setDate(hoje.getDate() + 5);

    const proximos5Dias = proximos.filter(ev => ev.data <= limite);

    if (proximos5Dias.length === 1) {
        // Caso 1: apenas 1 evento
        const ev = proximos5Dias[0];
        nomeSpan.textContent = ev.nmevento;
        tempoSmall.textContent = `${ev.data.toLocaleDateString()} ${formatarTempoRestante(ev.data)}`;
        nomeSpan.style.fontSize = "1.5em";
    } else {
        // Caso 2: mais de 1 evento → ajustar fonte menor
        nomeSpan.style.fontSize = "1em";

        const eventosPorData = {};
        proximos5Dias.forEach(ev => {
            const dataStr = ev.data.toLocaleDateString();
            if (!eventosPorData[dataStr]) eventosPorData[dataStr] = [];
            eventosPorData[dataStr].push(ev.nmevento);
        });

        const datas = Object.keys(eventosPorData).sort((a,b) => {
            const [da, ma, ya] = a.split("/").map(Number);
            const [db, mb, yb] = b.split("/").map(Number);
            return new Date(ya, ma-1, da) - new Date(yb, mb-1, db);
        });

        if (datas.length === 1) {
            // Todos no mesmo dia
            const lista = eventosPorData[datas[0]];
            let nomes = "";
            if (lista.length <= 3) {
                nomes = lista.join(" | ");
            } else {
                const primeiros = lista.slice(0, 3).join(" | ");
                const restantes = lista.length - 3;
                nomes = `${primeiros} | +${restantes}`;
            }
            nomeSpan.textContent = nomes;
            tempoSmall.textContent = `${datas[0]} ${formatarTempoRestante(proximos5Dias[0].data)}`;
        } else {
            // Dias diferentes
            nomeSpan.innerHTML = datas.map(dataStr => {
                const [d, m, y] = dataStr.split("/").map(Number);
                const dataObj = new Date(y, m-1, d);
                return eventosPorData[dataStr]
                    .map(nome => `${nome} - ${dataStr} ${formatarTempoRestante(dataObj)}`)
                    .join("<br>");
            }).join("<br>");
            tempoSmall.textContent = "";
        }
    }
}

document.addEventListener("DOMContentLoaded", function () {
    const cardEventos = document.querySelector(".card-eventos");

    if (cardEventos) {
        cardEventos.addEventListener("click", function () {
            mostrarCalendarioEventos(); // renderiza só ao clicar
        });
    }
});

async function mostrarCalendarioEventos() {
    const lista = document.getElementById("painelDetalhes");
    lista.innerHTML = "";

    // Container
    const container = document.createElement("div");
    container.className = "calendario-container";

    // ======= CALENDÁRIO =======
    const calendario = document.createElement("div");
    calendario.className = "calendario";

    // ======= HEADER =======
    const header = document.createElement("div");
    header.className = "calendario-header";

    // Bloco de controles (ano/mês/visualização + semana)
    const controles = document.createElement("div");
    controles.className = "calendario-controles";
    controles.innerHTML = `
        <label>Ano: <select id="anoSelect"></select></label>
        <label>Mês: <select id="mesSelect"></select></label>
        <label>Visualização:
            <select id="viewSelect">
                <option value="semanal">Semanal</option>
                <option value="mensal" selected>Mensal</option>
                <option value="trimestral">Trimestral</option>
                <option value="semestral">Semestral</option>
                <option value="anual">Anual</option>
            </select>
        </label>
        <label id="semanaWrapper" style="display:none;">
            Semana:
            <select id="semanaSelect"></select>
        </label>
    `;

    // ======= LEGENDA =======
    const legenda = document.createElement("div");
    legenda.className = "legenda";
    legenda.innerHTML = `
        <h3><strong>Legenda</strong></h3>
        <div class="items">
          <div class="legenda-item"><div class="legenda-cor" style="background:#FFC657"></div> Montagem infra</div>
          <div class="legenda-item"><div class="legenda-cor" style="background:#73757A"></div> Marcação</div>
          <div class="legenda-item"><div class="legenda-cor" style="background:#F5E801"></div> Montagem</div>
          <div class="legenda-item"><div class="legenda-cor" style="background:#F46251"></div> Realização</div>
          <div class="legenda-item"><div class="legenda-cor" style="background:#23821F"></div> Desmontagem</div>
          <div class="legenda-item"><div class="legenda-cor" style="background:#704300ff"></div> Desmontagem Infra</div>
          <div class="legenda-item"><div class="legenda-cor" style="background:#5B0F85"></div> Feriado</div>
        </div>
    `;

    header.appendChild(controles);
    header.appendChild(legenda);
    calendario.appendChild(header);

    // Grid (usado para mensal e semanal)
    const grid = document.createElement("div");
    grid.className = "calendario-grid";
    calendario.appendChild(grid);

    container.appendChild(calendario);
    lista.appendChild(container);

    // ======= POPULAR SELECTS =======
    const anoSelect = header.querySelector("#anoSelect");
    const mesSelect = header.querySelector("#mesSelect");
    const viewSelect = header.querySelector("#viewSelect");
    const semanaWrapper = header.querySelector("#semanaWrapper");
    const semanaSelect = header.querySelector("#semanaSelect");

    const anoAtual = new Date().getFullYear();
    for (let a = anoAtual - 2; a <= anoAtual + 2; a++) {
        const opt = document.createElement("option");
        opt.value = a;
        opt.textContent = a;
        if (a === anoAtual) opt.selected = true;
        anoSelect.appendChild(opt);
    }

    const nomesMeses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
        "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
    nomesMeses.forEach((nome, idx) => {
        const opt = document.createElement("option");
        opt.value = idx + 1;
        opt.textContent = nome;
        if (idx === new Date().getMonth()) opt.selected = true;
        mesSelect.appendChild(opt);
    });

    // ======= HELPERS =======
    function getCorPeriodo(tipo) {
        switch (tipo) {
            case "Montagem Infra": return "#f8a500ff";
            case "Marcação": return "#73757A";
            case "Montagem": return "#F5E801";
            case "Realização": return "#F46251";
            case "Desmontagem": return "#23821F";
            case "Desmontagem Infra": return "#704300ff";
            case "Feriado": return "#5B0F85";
            default: return "#ccc";
        }
    }

    function criarEventoElemento(ev) {
        const evEl = document.createElement("span");
        evEl.className = "evento";
        evEl.style.background = getCorPeriodo(ev.tipo);
        evEl.textContent = ev.nome;
        if (ev.tipo === "Feriado") evEl.style.color = "#fff";

        const idevento = ev.id || ev.idevento;
        if (idevento) {
            evEl.addEventListener("click", () => abrirPopupEvento(idevento));
        }
        return evEl;
    }

    // ======= CALCULAR SEMANAS DO MÊS =======
    function calcularSemanasDoMes(ano, mes) {
        const semanas = [];
        const ultimoDia = new Date(ano, mes, 0).getDate();
        let inicio = 1;
        while (inicio <= ultimoDia) {
            const d = new Date(ano, mes - 1, inicio);
            const fim = Math.min(inicio + (6 - d.getDay()), ultimoDia);
            semanas.push({ inicio, fim });
            inicio = fim + 1;
        }
        return semanas;
    }

    function preencherSemanas(ano, mes) {
        semanaSelect.innerHTML = "";
        const semanas = calcularSemanasDoMes(ano, mes);
        semanas.forEach((s, idx) => {
            const opt = document.createElement("option");
            opt.value = idx;
            opt.textContent = `${idx+1}ª (${s.inicio}-${s.fim})`;
            semanaSelect.appendChild(opt);
        });
    }

    // ======= RENDER MENSAL (mantendo comportamento) =======
    async function renderMensal(ano, mes) {
        grid.innerHTML = "";
        // Cabeçalho dias da semana
        ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].forEach(d => {
            const el = document.createElement("div");
            el.className = "header-dias";
            el.innerHTML = `<strong>${d}</strong>`;
            grid.appendChild(el);
        });

        try {
            const idempresa = getIdEmpresa();
            const data = await fetchComToken(`/main/eventos-calendario?idempresa=${idempresa}&ano=${ano}&mes=${mes}`);
            const eventos = data.eventos || [];

            // Mapa de eventos por data
            const mapaEventos = {};
            eventos.forEach(ev => {
                const inicio = new Date(ev.inicio);
                const fim = new Date(ev.fim);
                for (let d = new Date(inicio); d <= fim; d.setDate(d.getDate() + 1)) {
                    const key = d.toISOString().split("T")[0];
                    if (!mapaEventos[key]) mapaEventos[key] = [];
                    mapaEventos[key].push(ev);
                }
            });

            const hoje = new Date();
            const hojeStr = hoje.toISOString().split("T")[0];

            const primeiroDia = new Date(ano, mes - 1, 1);
            const ultimoDia = new Date(ano, mes, 0).getDate();
            const diaSemanaInicio = primeiroDia.getDay();

            const ultimoDiaMesAnterior = new Date(ano, mes - 1, 0).getDate();
            let mesAnterior = mes - 1;
            let anoAnterior = ano;
            if (mesAnterior === 0) { mesAnterior = 12; anoAnterior -= 1; }

            // Dias do mês anterior (apenas os necessários)
            for (let i = diaSemanaInicio - 1; i >= 0; i--) {
                const dia = ultimoDiaMesAnterior - i;
                const dataStr = `${anoAnterior}-${String(mesAnterior).padStart(2,"0")}-${String(dia).padStart(2,"0")}`;
                const cell = document.createElement("div");
                cell.classList.add("dia-anterior");
                cell.style.opacity = "0.4";
                cell.innerHTML = `<span class="numero-dia">${dia}</span>`;
                if (dataStr === hojeStr) { cell.style.border = "2px solid var(--primary-color)"; cell.style.borderRadius = "6px"; }
                (mapaEventos[dataStr] || []).forEach(ev => cell.appendChild(criarEventoElemento(ev)));
                grid.appendChild(cell);
            }

            // Dias do mês atual
            for (let dia = 1; dia <= ultimoDia; dia++) {
                const dataStr = `${ano}-${String(mes).padStart(2,"0")}-${String(dia).padStart(2,"0")}`;
                const cell = document.createElement("div");
                cell.innerHTML = `<span class="numero-dia">${dia}</span>`;
                if (dataStr === hojeStr) { cell.style.border = "2px solid var(--primary-color)"; cell.style.borderRadius = "6px"; }
                (mapaEventos[dataStr] || []).forEach(ev => cell.appendChild(criarEventoElemento(ev)));
                grid.appendChild(cell);
            }

            // Dias do próximo mês (apenas até completar a última semana)
            const totalCelulas = grid.children.length;
            const linhasCompletas = Math.ceil(totalCelulas / 7) * 7;
            const diasProximoMes = linhasCompletas - totalCelulas;
            let mesProximo = mes + 1;
            let anoProximo = ano;
            if (mesProximo === 13) { mesProximo = 1; anoProximo += 1; }

            for (let i = 1; i <= diasProximoMes; i++) {
                const dataStr = `${anoProximo}-${String(mesProximo).padStart(2,"0")}-${String(i).padStart(2,"0")}`;
                const cell = document.createElement("div");
                cell.classList.add("dia-proximo");
                cell.style.opacity = "0.4";
                cell.innerHTML = `<span class="numero-dia">${i}</span>`;
                if (dataStr === hojeStr) { cell.style.border = "2px solid var(--primary-color)"; cell.style.borderRadius = "6px"; }
                (mapaEventos[dataStr] || []).forEach(ev => cell.appendChild(criarEventoElemento(ev)));
                grid.appendChild(cell);
            }

        } catch (err) {
            console.error("Erro ao carregar eventos do calendário (mensal):", err);
        }
    }

    // ======= RENDER SEMANAL =======
    async function renderSemanal(ano, mes, semanaIdx = 0) {
        grid.innerHTML = "";
        semanaWrapper.style.display = "inline-block";

        // cabeçalho dias da semana
        ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].forEach(d => {
            const el = document.createElement("div");
            el.className = "header-dias";
            el.innerHTML = `<strong>${d}</strong>`;
            grid.appendChild(el);
        });

        try {
            const semanas = calcularSemanasDoMes(ano, mes);
            if (semanas.length === 0) return;
            if (semanaIdx >= semanas.length) semanaIdx = 0;
            const { inicio, fim } = semanas[semanaIdx];

            const idempresa = getIdEmpresa();
            // carrega eventos do mês atual (já traz tudo que for necessário para os dias)
            const data = await fetchComToken(`/main/eventos-calendario?idempresa=${idempresa}&ano=${ano}&mes=${mes}`);
            const eventos = data.eventos || [];

            // mapa de eventos por data
            const mapaEventos = {};
            eventos.forEach(ev => {
                const inicioEv = new Date(ev.inicio);
                const fimEv = new Date(ev.fim);
                for (let d = new Date(inicioEv); d <= fimEv; d.setDate(d.getDate() + 1)) {
                    const key = d.toISOString().split("T")[0];
                    if (!mapaEventos[key]) mapaEventos[key] = [];
                    mapaEventos[key].push(ev);
                }
            });

            const hoje = new Date();
            const hojeStr = hoje.toISOString().split("T")[0];

            for (let dia = inicio; dia <= fim; dia++) {
                const d = new Date(ano, mes - 1, dia);
                const dataStr = d.toISOString().split("T")[0];
                const cell = document.createElement("div");
                cell.innerHTML = `<span class="numero-dia">${dia}</span>`;
                (mapaEventos[dataStr] || []).forEach(ev => cell.appendChild(criarEventoElemento(ev)));
                if (dataStr === hojeStr) {
                    cell.style.border = "2px solid var(--primary-color)";
                    cell.style.borderRadius = "6px";
                }
                grid.appendChild(cell);
            }
        } catch (err) {
            console.error("Erro ao carregar eventos do calendário (semanal):", err);
        }
    }

    // ======= RENDER POPUP FULLSCREEN PARA PERIODICIDADES > MÊS (3 em 3 lado a lado) =======
async function renderPopupPeriodico(ano, mes, tipoView) {
    // overlay
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.right = "0";
    overlay.style.bottom = "0";
    overlay.style.background = "rgba(0,0,0,0.6)";
    overlay.style.zIndex = "9999";
    overlay.style.display = "flex";
    overlay.style.justifyContent = "center";
    overlay.style.alignItems = "center";

    // inner fullscreen panel
    const panel = document.createElement("div");
    panel.style.width = "95%";
    panel.style.height = "92%";
    panel.style.background = "#fff";
    panel.style.borderRadius = "8px";
    panel.style.boxShadow = "0 8px 40px rgba(0,0,0,0.5)";
    panel.style.display = "flex";
    panel.style.flexDirection = "column";
    panel.style.overflow = "hidden";

    // header
    const ph = document.createElement("div");
    ph.style.display = "flex";
    ph.style.justifyContent = "space-between";
    ph.style.alignItems = "center";
    ph.style.padding = "12px 16px";
    ph.style.borderBottom = "1px solid #eee";

    const title = document.createElement("h2");
    title.style.margin = "0";
    title.textContent = `${tipoView.charAt(0).toUpperCase() + tipoView.slice(1)} - ${ano}`;

    // select principal (Geral, Trimestre, Semestre, Ano)
    const tipoSelect = document.createElement("select");
    ["geral","trimestral","semestral","anual"].forEach(opt => {
        const o = document.createElement("option");
        o.value = opt;
        o.textContent = opt.charAt(0).toUpperCase() + opt.slice(1);
        if (opt === tipoView) o.selected = true;
        tipoSelect.appendChild(o);
    });

    // selects extras (dinâmicos)
    const trimestreSelect = document.createElement("select");
    ["1º Trimestre","2º Trimestre","3º Trimestre","4º Trimestre"].forEach((txt, idx) => {
        const o = document.createElement("option");
        o.value = idx + 1;
        o.textContent = txt;
        trimestreSelect.appendChild(o);
    });
    trimestreSelect.style.display = (tipoView === "trimestral") ? "inline-block" : "none";

    const semestreSelect = document.createElement("select");
    ["1º Semestre","2º Semestre"].forEach((txt, idx) => {
        const o = document.createElement("option");
        o.value = idx + 1;
        o.textContent = txt;
        semestreSelect.appendChild(o);
    });
    semestreSelect.style.display = (tipoView === "semestral") ? "inline-block" : "none";

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "Fechar";
    closeBtn.style.padding = "6px 10px";
    closeBtn.style.cursor = "pointer";

    const leftControls = document.createElement("div");
    leftControls.style.display = "flex";
    leftControls.style.gap = "8px";
    leftControls.appendChild(title);
    leftControls.appendChild(tipoSelect);
    leftControls.appendChild(trimestreSelect);
    leftControls.appendChild(semestreSelect);

    ph.appendChild(leftControls);
    ph.appendChild(closeBtn);
    panel.appendChild(ph);

    // body
    const body = document.createElement("div");
    body.className = "multi-calendarios";
    body.style.display = "flex";
    body.style.flexWrap = "wrap";
    body.style.gap = "12px";
    body.style.padding = "12px";
    body.style.overflow = "auto";
    body.style.alignContent = "flex-start";
    panel.appendChild(body);

    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    closeBtn.addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", (ev) => { if (ev.target === overlay) overlay.remove(); });

    async function renderContent(view, trimestreSel = null, semestreSel = null) {
        body.innerHTML = "";
        title.textContent = `${view.charAt(0).toUpperCase() + view.slice(1)} - ${ano}`;
        let mesesParaMostrar = [];

        if (view === "trimestral") {
            const trimestreIdx = (trimestreSel !== null ? trimestreSel - 1 : Math.floor((mes - 1) / 3));
            mesesParaMostrar = [trimestreIdx*3 + 1, trimestreIdx*3 + 2, trimestreIdx*3 + 3];
        } else if (view === "semestral") {
            const semestreIdx = (semestreSel !== null ? semestreSel : (mes <= 6 ? 1 : 2));
            mesesParaMostrar = (semestreIdx === 1) ? [1,2,3,4,5,6] : [7,8,9,10,11,12];
        } else if (view === "anual") {
            mesesParaMostrar = [1,2,3,4,5,6,7,8,9,10,11,12];
        } else { 
            // Geral = mostra o mês atual
            mesesParaMostrar = [mes];
        }

        for (let m of mesesParaMostrar) {
            const mini = document.createElement("div");
            mini.className = "mini-calendario";
            mini.style.flex = "0 0 calc(33.333% - 12px)";
            mini.style.boxSizing = "border-box";
            mini.style.border = "1px solid #eee";
            mini.style.borderRadius = "6px";
            mini.style.padding = "8px";
            mini.style.background = "#fafafa";
            mini.style.minWidth = "220px";
            body.appendChild(mini);
            await renderMiniCalendario(mini, ano, m);
        }
    }

    // eventos dos selects
    tipoSelect.addEventListener("change", () => {
        trimestreSelect.style.display = (tipoSelect.value === "trimestral") ? "inline-block" : "none";
        semestreSelect.style.display = (tipoSelect.value === "semestral") ? "inline-block" : "none";
        renderContent(tipoSelect.value, parseInt(trimestreSelect.value), parseInt(semestreSelect.value));
    });

    trimestreSelect.addEventListener("change", () => {
        renderContent("trimestral", parseInt(trimestreSelect.value));
    });

    semestreSelect.addEventListener("change", () => {
        renderContent("semestral", null, parseInt(semestreSelect.value));
    });

    // render inicial
    renderContent(tipoView);
}


    // Mini calendário (um mês) — usado no popup
async function renderMiniCalendario(container, ano, mes) {
    container.innerHTML = "";
    const titulo = document.createElement("h3");
    titulo.style.margin = "0 0 8px 0";
    titulo.textContent = nomesMeses[mes - 1] + " " + ano;
    container.appendChild(titulo);

    const gridMini = document.createElement("div");
    gridMini.style.display = "grid";
    gridMini.style.gridTemplateColumns = "repeat(7, 1fr)";
    gridMini.style.gap = "6px";
    container.appendChild(gridMini);

    // cabeçalho abreviado
    ["D","S","T","Q","Q","S","S"].forEach(d => {
        const hd = document.createElement("div");
        hd.className = "header-dias";
        hd.style.height = "22px";
        hd.style.display = "flex";
        hd.style.alignItems = "center";
        hd.style.justifyContent = "center";
        hd.innerHTML = `<strong>${d}</strong>`;
        gridMini.appendChild(hd);
    });

    try {
        const idempresa = getIdEmpresa();
        const data = await fetchComToken(`/main/eventos-calendario?idempresa=${idempresa}&ano=${ano}&mes=${mes}`);
        const eventos = data.eventos || [];

        // mapa eventos por data
        const mapaEventos = {};
        eventos.forEach(ev => {
            const inicio = new Date(ev.inicio);
            const fim = new Date(ev.fim);
            for (let d = new Date(inicio); d <= fim; d.setDate(d.getDate() + 1)) {
                const key = d.toISOString().split("T")[0];
                if (!mapaEventos[key]) mapaEventos[key] = [];
                mapaEventos[key].push(ev);
            }
        });

        const primeiroDia = new Date(ano, mes - 1, 1);
        const ultimoDia = new Date(ano, mes, 0).getDate();
        const diaSemanaInicio = primeiroDia.getDay();

        // espaços vazios antes do 1º dia
        for (let i = 0; i < diaSemanaInicio; i++) {
            const empty = document.createElement("div");
            empty.style.minHeight = "48px";
            gridMini.appendChild(empty);
        }

        const hoje = new Date();
        const hojeStr = hoje.toISOString().split("T")[0];

        // dias do mês
        for (let dia = 1; dia <= ultimoDia; dia++) {
            const dataStr = `${ano}-${String(mes).padStart(2,"0")}-${String(dia).padStart(2,"0")}`;
            const cell = document.createElement("div");
            cell.style.minHeight = "48px";
            cell.style.padding = "2px";
            cell.style.display = "flex";
            cell.style.flexDirection = "column";

            cell.innerHTML = `<span class="numero-dia" style="font-size:12px;font-weight:600;">${dia}</span>`;
            if (dataStr === hojeStr) cell.style.outline = "1px solid var(--primary-color)";

            // container com scroll só pros eventos
            const eventosBox = document.createElement("div");
            eventosBox.className = "eventos-scroll"; // classe para estilizar no CSS
            eventosBox.style.flex = "1";
            eventosBox.style.overflowY = "auto";
            eventosBox.style.maxHeight = "70px"; // controla altura antes do scroll
            eventosBox.style.marginTop = "2px";

            (mapaEventos[dataStr] || []).forEach(ev => {
                const evEl = criarEventoElemento(ev);
                // estilo compactado para mini
                evEl.style.display = "block";
                evEl.style.padding = "2px 4px";
                evEl.style.fontSize = "8px";
                evEl.style.marginTop = "2px";
                eventosBox.appendChild(evEl);
            });

            cell.appendChild(eventosBox);
            gridMini.appendChild(cell);
        }

        // completar última linha
        const totalDayCells = diaSemanaInicio + ultimoDia;
        const faltam = (7 - (totalDayCells % 7)) % 7;
        for (let i = 0; i < faltam; i++) {
            const empty = document.createElement("div");
            empty.style.minHeight = "48px";
            gridMini.appendChild(empty);
        }

    } catch (err) {
        console.error("Erro no mini-calendário:", err);
        container.appendChild(document.createTextNode("Erro ao carregar mês"));
    }
}
    // ===== Render inicial =====
    preencherSemanas(parseInt(anoSelect.value), parseInt(mesSelect.value));
    renderMensal(parseInt(anoSelect.value), parseInt(mesSelect.value));

    // ===== Listeners =====
    anoSelect.addEventListener("change", () => {
        preencherSemanas(parseInt(anoSelect.value), parseInt(mesSelect.value));
        const view = viewSelect.value;
        if (view === "semanal") renderSemanal(parseInt(anoSelect.value), parseInt(mesSelect.value), parseInt(semanaSelect.value || 0));
        else if (view === "mensal") renderMensal(parseInt(anoSelect.value), parseInt(mesSelect.value));
    });

    mesSelect.addEventListener("change", () => {
        preencherSemanas(parseInt(anoSelect.value), parseInt(mesSelect.value));
        const view = viewSelect.value;
        if (view === "semanal") renderSemanal(parseInt(anoSelect.value), parseInt(mesSelect.value), parseInt(semanaSelect.value || 0));
        else if (view === "mensal") renderMensal(parseInt(anoSelect.value), parseInt(mesSelect.value));
    });

    viewSelect.addEventListener("change", async () => {
        const view = viewSelect.value;
        if (view === "semanal") {
            preencherSemanas(parseInt(anoSelect.value), parseInt(mesSelect.value));
            await renderSemanal(parseInt(anoSelect.value), parseInt(mesSelect.value), parseInt(semanaSelect.value || 0));
        } else if (view === "mensal") {
            semanaWrapper.style.display = "none";
            await renderMensal(parseInt(anoSelect.value), parseInt(mesSelect.value));
        } else {
            // trimestral / semestral / anual -> popup full screen
            semanaWrapper.style.display = "none";
            await renderPopupPeriodico(parseInt(anoSelect.value), parseInt(mesSelect.value), view);
        }
    });

    semanaSelect.addEventListener("change", () =>
        renderSemanal(parseInt(anoSelect.value), parseInt(mesSelect.value), parseInt(semanaSelect.value))
    );
}
// ===== Popup global de staff =====
async function abrirPopupEvento(idevento) {
    if (!idevento) {
        console.warn("idevento indefinido ao abrir popup de staff");
        return;
    }
    try {
        const idempresa = getIdEmpresa();
        const resp = await fetchComToken(`/main/eventos-staff?idempresa=${idempresa}&idevento=${idevento}`);

        const staff = resp.staff?.pessoas || [];
        if (staff.length === 0) {
            alert("Nenhum funcionário encontrado para este evento.");
            return;
        }

        // Criar popup
        const popup = document.createElement("div");
        popup.className = "popup-evento";
        popup.innerHTML = `
            <div class="popup-header">
                <h2>Funcionários do Evento: ${resp.staff.nmevento}</h2>
                <button class="popup-close">X</button>
            </div>
            <div class="popup-body">
                <ul>
                    ${staff.map(f => `<li>${f.funcionario} - ${f.funcao}</li>`).join("")}
                </ul>
            </div>
        `;

        // Fechar popup
        popup.querySelector(".popup-close").addEventListener("click", () => popup.remove());

        // Tornar arrastável
        let isDragging = false, offsetX = 0, offsetY = 0;
        const header = popup.querySelector(".popup-header");

        header.addEventListener("mousedown", (e) => {
            isDragging = true;
            offsetX = e.clientX - popup.offsetLeft;
            offsetY = e.clientY - popup.offsetTop;
            popup.style.cursor = "grabbing";
        });

        document.addEventListener("mousemove", (e) => {
            if (isDragging) {
                popup.style.left = e.clientX - offsetX + "px";
                popup.style.top = e.clientY - offsetY + "px";
                popup.style.transform = "none"; // remove centralização automática
            }
        });

        document.addEventListener("mouseup", () => {
            if (isDragging) {
                isDragging = false;
                popup.style.cursor = "move";
            }
        });

        document.body.appendChild(popup);

    } catch (err) {
        console.error("Erro ao carregar staff:", err);
    }
}

document.addEventListener("DOMContentLoaded", function () {
    const cardEventos = document.querySelector(".card-eventos-em-abertos");

    if (cardEventos) {
        cardEventos.addEventListener("click", function () {
            mostrarEventosEmAberto(); // renderiza só ao clicar
        });
    }
});

async function atualizarEventosEmAberto() {
  const qtdSpan = document.getElementById("qtdEventosAbertos");
  const lista = document.querySelector(".card-eventos-em-abertos .evt-body");
  const footer = document.querySelector(".card-eventos-em-abertos .evt-footer");

  if (!qtdSpan || !lista || !footer) {
    console.warn("Elementos de eventos em aberto não encontrados no DOM.");
    return;
  }

  try {
    const idempresa = getIdEmpresa();
    const resposta = await fetchComToken("/main/eventos-abertos", {
      headers: { idempresa }
    });

    if (!resposta || !resposta.length) {
      qtdSpan.textContent = "0";
      lista.innerHTML = `<div class="evento-vazio">Nenhum evento em aberto 🎉</div>`;
      footer.style.display = "none";
      return;
    }

    // Função utilitária para converter data local
    function parseDateLocal(dateStr) {
      if (typeof dateStr === "string") {
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          const [y, m, d] = dateStr.split("-").map(Number);
          return new Date(y, m - 1, d);
        }
        return new Date(dateStr);
      }
      return new Date(dateStr);
    }

    // Ordena pelo evento mais próximo
    resposta.sort((a, b) => new Date(a.data_referencia) - new Date(b.data_referencia));

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    lista.innerHTML = "";
    qtdSpan.textContent = resposta.length;

    // Mostra apenas o evento mais próximo
    const primeiroEvento = resposta[0];
    const dataEvento = parseDateLocal(primeiroEvento.data_referencia);
    const diffDias = Math.ceil((dataEvento - hoje) / (1000 * 60 * 60 * 24));

    let statusTexto = "";
    let statusClasse = "";

    if (primeiroEvento.fim_evento && new Date(primeiroEvento.fim_evento) < hoje) {
      statusTexto = "✔ Realizado com sucesso";
      statusClasse = "status-realizado";
    } else if (diffDias <= 5 && diffDias >= 0) {
      statusTexto = `⚠ Sem staff - faltam ${diffDias} dia${diffDias > 1 ? "s" : ""} p/ Realizar`;
      statusClasse = "status-urgente";
    } else if (diffDias > 5) {
      statusTexto = "Sem staff definido";
      statusClasse = "status-pendente";
    } else {
      statusTexto = "Em andamento";
      statusClasse = "status-andamento";
    }

    const item = `
        <div class="evento-nome"> Evento: ${primeiroEvento.nmevento}</div>
        <div class="evento-local">Local: ${primeiroEvento.nmlocalmontagem || "Local não informado"}</div>
        <div class="evento-status ${statusClasse}">status: ${statusTexto}</div>
    `;

    lista.insertAdjacentHTML("beforeend", item);

    // Mostra "clique para ver mais" se houver outros eventos
    if (resposta.length > 1) {
      footer.style.display = "block";
      footer.innerHTML = `<span class="verMais"> Clique para ver mais (${resposta.length - 1} outros)</span>`;
    } else {
      footer.style.display = "none";
    }

  } catch (err) {
    console.error("Erro ao carregar eventos em aberto:", err);
    lista.innerHTML = `<div class="evento-erro">Erro ao carregar eventos ⚠</div>`;
    qtdSpan.textContent = "–";
    footer.style.display = "none";
  }
}


async function mostrarEventosEmAberto() {
 const painel = document.getElementById("painelDetalhes");
 if (!painel) return;

 painel.innerHTML = "";

 // ======= CONTAINER PRINCIPAL =======
 const container = document.createElement("div");
 container.className = "painel-eventos-em-aberto";

 // ======= HEADER =======
 const header = document.createElement("div");
 header.className = "header-eventos-em-aberto";
 header.textContent = "⚠ Eventos em Aberto";
 container.appendChild(header);

 // ======= ABAS =======
 const abas = document.createElement("div");
 abas.className = "abas-eventos";
 abas.innerHTML = `
  <div class="aba ativo" data-target="abertos">Abertos</div>
  <div class="aba" data-target="finalizados">Encerrados</div>
 `;
 container.appendChild(abas);

 // ======= CONTEÚDOS DAS ABAS =======
 const conteudos = document.createElement("div");
 conteudos.className = "conteudos-abas";

 const abaAbertos = document.createElement("div");
 abaAbertos.className = "conteudo-aba ativo";
 abaAbertos.id = "abertos";

 const abaFinalizados = document.createElement("div");
 abaFinalizados.className = "conteudo-aba";
 abaFinalizados.id = "finalizados";

 conteudos.appendChild(abaAbertos);
 conteudos.appendChild(abaFinalizados);
 container.appendChild(conteudos);
 painel.appendChild(container);

 // ------------------------------------------------------------------
 // ======= EVENTO DE TROCA DE ABAS - CORRIGIDO =======
 // ------------------------------------------------------------------
  abas.querySelectorAll(".aba").forEach(btn => {
    btn.addEventListener("click", async () => {
      // 1. Identifica os elementos
      const target = btn.dataset.target; // 'abertos' ou 'finalizados'
      const targetEl = document.getElementById(target);
      const idempresa = getIdEmpresa(); // Obtemos idempresa uma vez

      // 2. Troca visual de aba ativa (MANTIDO)
      abas.querySelectorAll(".aba").forEach(b => b.classList.remove("ativo"));
      btn.classList.add("ativo");

      // 3. Esconde conteúdos e mostra o alvo (MANTIDO)
      conteudos.querySelectorAll(".conteudo-aba").forEach(c => c.classList.remove("ativo"));
      targetEl.classList.add("ativo");

      // 4. FORÇA O RECARREGAMENTO e mostra o loading
      targetEl.innerHTML = `<div class="loading-spinner">Carregando eventos ${target}...</div>`;

      let rota;
      try {
        if (target === "finalizados") {
          rota = "i-fechados";
          
          // **ROTA 1: EVENTOS FECHADOS**
          const resp = await fetchComToken(`/main/eventos-fechados`, { headers: { idempresa } });
          const eventos = resp && typeof resp.json === 'function' ? await resp.json() : resp;
          
          renderizarEventos(targetEl, eventos);

        } else { // target === "abertos"
          rota = "eventos-abertos";
          
          // **ROTA 2: EVENTOS ABERTOS**
          const resp = await fetchComToken(`/main/eventos-abertos`, { headers: { idempresa } });
          const eventos = resp && typeof resp.json === 'function' ? await resp.json() : resp;

          renderizarEventos(targetEl, eventos);
        }
        
      } catch (err) {
        // 5. Tratamento de erro detalhado
        console.error(`Falha ao carregar a rota ${rota}:`, err);
        targetEl.innerHTML = `<div class="erro-carregar">Erro ao carregar eventos de ${target} (Rota: <b>/main/${rota}</b>). Verifique o console.</div>`;
      }
  });
});

// FUNÇÃO AUXILIAR PARA EVITAR DUPLICAÇÃO DE CÓDIGO DE RENDERIZAÇÃO
function renderizarEventos(targetEl, eventos) {
    // 🛑 CORREÇÃO PARA O TypeError: Adiciona a checagem '!eventos'
    // Se for null/undefined, a condição é satisfeita e retorna a mensagem de erro.
    if (!eventos || !Array.isArray(eventos) || eventos.length === 0) {
        targetEl.innerHTML = `<div class="nenhum-evento">Nenhum evento encontrado</div>`;
        return;
    }

      targetEl.innerHTML = ""; // Limpa o loading

    // 🛠️ Melhoria: Usamos forEach com try...catch para isolar a renderização de cada evento.
    // Isso impede que um evento com dados malformados quebre o loop e a lista inteira (o seu problema dos 4->3).
    eventos.forEach((evt, index) => {
        try {
            // Mapeamos e criamos o card dentro do try/catch
            const eventoNormalizado = normalizarEvento(evt);
            const card = criarCard(eventoNormalizado);
            
            card.style.setProperty('--index', index);
            targetEl.appendChild(card);
        } catch (error) {
            // Caso um evento específico falhe (ex: JSON truncado), loga o erro e insere um alerta.
            console.error(`❌ Erro crítico ao renderizar evento ID ${evt.idevento || 'desconhecido'} (${evt.nmevento || 'Sem Nome'}).`, error);
            const erroCard = document.createElement("div");
            erroCard.className = "evento-card erro-render";
            erroCard.innerHTML = `⚠️ Erro ao carregar o evento <b>${evt.nmevento || 'Desconhecido'}</b> (ID: ${evt.idevento || '??'}).`;
            targetEl.appendChild(erroCard);
        }
    });
}
 // ------------------------------------------------------------------
 // ======= CARREGAMENTO INICIAL - CORRIGIDO =======
 // ------------------------------------------------------------------
 // REMOVIDAS as declarações eventosAbertos/Finalizados vazias

  try {
    const idempresa = localStorage.getItem("idempresa");
    // URL CORRIGIDA PARA A NOVA ROTA ESPECÍFICA
    const resp = await fetchComToken(`/main/eventos-abertos`, { headers: { idempresa } });
    const eventos = resp?.ok ? await resp.json() : resp;

    if (!Array.isArray(eventos)) {
    abaAbertos.innerHTML = `<span class="erro-carregar">Erro ao carregar eventos</span>`;
    console.error("Erro backend: resposta inesperada", eventos);
    return;
    }

    if (!eventos.length) {
    abaAbertos.innerHTML = `<span class="nenhum-evento">Nenhum evento em aberto 🎉</span>`;
    abaAbertos.dataset.populado = "1";
    return;
    }

    // Transforma eventos para o formato UI e preenche
    eventos.map(evt => normalizarEvento(evt)).forEach(evt => {
    abaAbertos.appendChild(criarCard(evt));
    });
    
    abaAbertos.dataset.populado = "1"; // Marca como populado

  } catch (err) {
    console.error("Erro ao carregar eventos em aberto:", err);
    abaAbertos.innerHTML = `<span class="erro-carregar">Erro ao buscar eventos</span>`;
  }


  // ------------------------------------------------------------------
  // ======= FUNÇÕES AUXILIARES - REORGANIZADAS/SIMPLIFICADAS =======
  // ------------------------------------------------------------------

  // Movida a lógica de mapeamento para uma função separada para reuso
  function normalizarEvento(ev) {
    const inicio_realizacao = ev.dtinirealizacao || ev.dtinimontagem || ev.dtinimarcacao;
    const fim_realizacao = ev.dtfimrealizacao || ev.dtfimdesmontagem || ev.dtfimmontagem;
    const data_referencia = ev.dtinimontagem || ev.dtinirealizacao || ev.dtinimarcacao;
    const fim_evento = ev.dtfimdesmontagem || ev.dtfimrealizacao;

    // O backend já está retornando equipes_detalhes, vamos usá-lo se disponível
    let equipesDetalhes = Array.isArray(ev.equipes_detalhes) ? ev.equipes_detalhes : [];
    
    return {
    ...ev,
    data_referencia,
    inicio_realizacao,
    fim_realizacao,
    fim_evento,
    total_staff: ev.total_staff ?? ev.totalStaff ?? 0,
    equipes_detalhes: equipesDetalhes // Garante que o campo existe
    };
  }

  function parseDateLocal(dataISO) {
    if (!dataISO) return "";
    const data = new Date(dataISO);
    if (isNaN(data)) return dataISO; // se não for uma data válida
    // Usa o toLocaleDateString com fuso horário UTC para evitar problemas de offset
    return data.toLocaleDateString("pt-BR", { timeZone: "UTC" }); 
  }
  
  // Ajuste para criarCard para aceitar o formato de data no cálculo de dias
  function parseDateForComparison(dateStr) {
    if (!dateStr) return null;
    if (typeof dateStr === "string") {
    // Regex simples para ISO date sem time
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [y, m, d] = dateStr.split("-").map(Number);
      // Cria a data no fuso zero (meia-noite UTC)
      return new Date(Date.UTC(y, m - 1, d)); 
    }
    // Tenta criar a data normal, mas ajusta para meia-noite local para comparação
    const d = new Date(dateStr);
    if (isNaN(d)) return null;
    d.setHours(0, 0, 0, 0);
    return d;
    }
    if (dateStr instanceof Date) {
    dateStr.setHours(0, 0, 0, 0);
    return dateStr;
    }
    return null;
  }


  // ======= Função para criar card de evento =======
  // MANTIDA A LÓGICA DE ALERTA, MAS USANDO FUNÇÕES CORRIGIDAS PARA DATA
  function normalizarEvento(ev) {
      const inicio_realizacao = ev.dtinirealizacao || ev.dtinimontagem || ev.dtinimarcacao;
      const fim_realizacao = ev.dtfimrealizacao || ev.dtfimdesmontagem || ev.dtfimmontagem;
      const data_referencia = ev.dtinimontagem || ev.dtinirealizacao || ev.dtinimarcacao;
      const fim_evento = ev.dtfimdesmontagem || ev.dtfimrealizacao;

      let equipesDetalhes = Array.isArray(ev.equipes_detalhes) ? ev.equipes_detalhes : [];
      
      // 🛑 CORREÇÃO DE DADOS: Recalcula totais a partir dos detalhes das equipes para garantir consistência
      const totalVagasCalculado = equipesDetalhes.reduce((sum, item) => sum + (item.total_vagas || 0), 0);
      const totalStaffCalculado = equipesDetalhes.reduce((sum, item) => sum + (item.preenchidas || 0), 0);
      const vagasRestantesCalculado = totalVagasCalculado - totalStaffCalculado;
      
      return {
          ...ev,
          data_referencia,
          inicio_realizacao,
          fim_realizacao,
          fim_evento,
          
          // 🛑 Usa os totais calculados para o status principal
          total_vagas: totalVagasCalculado,
          total_staff: totalStaffCalculado,
          vagas_restantes: vagasRestantesCalculado,
          
          total_staff_api: ev.total_staff, // Mantém o valor original do backend para referência (opcional)
          equipes_detalhes: equipesDetalhes
      };
  }

function criarCard(evt) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0); // Zera hora para comparação de dia

    const dataRef = parseDateForComparison(evt.data_referencia);
    const dataFimDesmontagem = parseDateForComparison(evt.fim_evento); // Usado para status
    const inicioRealizacao = parseDateForComparison(evt.inicio_realizacao);
    const fimRealizacao = parseDateForComparison(evt.fim_realizacao);

    // === Cálculo de percentual de staff preenchido ===
    const total = evt.total_vagas || 0;
    const preenchido = evt.total_staff || 0;
    const percentual = total > 0 ? Math.round((preenchido / total) * 100) : 0;

    let diasFaltam = null;
    if (dataRef) diasFaltam = Math.ceil((dataRef.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

    let alertaTexto = "";
    let alertaClasse = "";

    // === Lógica de Status do Evento (Sem alteração) ===
    if (dataFimDesmontagem && dataFimDesmontagem < hoje) {
        if (percentual === 0) {
            alertaTexto = "✔ Realizado sem staff";
            alertaClasse = "status-realizado-vermelho";
        } else if (percentual < 100) {
            alertaTexto = `✔ Realizado - Staff parcial (${percentual}% Cadastrado)`;
            alertaClasse = "status-realizado-amarelo";
        } else { // >= 100%
            alertaTexto = "✔ Realizado - Staff OK";
            alertaClasse = "status-realizado-verde";
        }

    } else if (inicioRealizacao && fimRealizacao && hoje >= inicioRealizacao && hoje <= fimRealizacao) {
        if (percentual === 0) {
            alertaTexto = "🚨 Sem staff — Realizando";
            alertaClasse = "status-realizando-vermelho";
        } else if (percentual < 100) {
            alertaTexto = `⚠️ Staff faltando - Realizando (${percentual}%)`;
            alertaClasse = "status-realizando-amarelo";
        } else { // >= 100%
            alertaTexto = "✅ Staff OK - Realizando";
            alertaClasse = "status-realizando-verde";
        }

    } else if (diasFaltam !== null && diasFaltam <= 5 && diasFaltam >= 0) {
        const diasText = `${diasFaltam} dia${diasFaltam !== 1 ? "s" : ""}`;

        if (percentual === 0) {
            alertaTexto = `🚨 Sem staff — faltam ${diasText}`;
            alertaClasse = "status-urgente-vermelho";
        } else if (percentual < 100) {
            alertaTexto = `⚠️ Staff faltando (${percentual}% Cadastrado) — faltam ${diasText} p/ realização`;
            alertaClasse = "status-urgente-amarelo";
        } else { // >= 100%
            alertaTexto = `✅ Staff OK — faltam ${diasText}`;
            alertaClasse = "status-urgente-verde";
        }

    } else {
        if (percentual === 0) {
            alertaTexto = "🚨 Sem staff";
            alertaClasse = "status-pendente-vermelho";
        } else if (percentual < 100) {
            alertaTexto = `⚠️ Staff faltando (${percentual}% Cadastrado)`;
            alertaClasse = "status-pendente-amarelo";
        } else { // >= 100%
            alertaTexto = "✅ Staff OK";
            alertaClasse = "status-pendente-verde";
        }
    }

    // Converte a data de Fim de Desmontagem para exibição (string formatada)
    const dataExibicaoFimDesmontagem = evt.fim_evento ? parseDateLocal(evt.fim_evento) : null;

    const nomeEvento = (dataFimDesmontagem && dataFimDesmontagem < hoje)
        ? `<del>${evt.nmevento || evt.nome || "Evento"}</del>`
        : `<strong>${evt.nmevento || evt.nome || "Evento"}</strong>`;

    const localEvento = evt.nmlocalmontagem || evt.local || "Local não informado";

    const pavilhoes = evt.pavilhoes_nomes || [];
    let pavilhoesTexto = "Pavilhões não informados";

    if (pavilhoes.length > 0) {
        pavilhoesTexto = pavilhoes.join(", ");
    } else {
        // Se a lista de pavilhões estiver vazia, usa o local de montagem principal como fallback
        pavilhoesTexto = localEvento;
    }

    // 🌟 BLOCO DE PERÍODO ATUALIZADO: Montagem (Marcação) a Desmontagem
    let periodoTexto = "Período não definido";
    
    const inicioMarcacao = evt.dtinimarcacao ? parseDateLocal(evt.dtinimarcacao) : 'ND';
    const inicioRealizacaoFormatado = evt.dtinirealizacao ? parseDateLocal(evt.dtinirealizacao) : 'ND';
    const fimRealizacaoFormatado = evt.dtfimrealizacao ? parseDateLocal(evt.dtfimrealizacao) : 'ND';
    const fimDesmontagem = evt.dtfimdesmontagem ? parseDateLocal(evt.dtfimdesmontagem) : (evt.fim_evento ? parseDateLocal(evt.fim_evento) : 'ND');

    if (inicioMarcacao !== 'ND' || fimDesmontagem !== 'ND') {
        periodoTexto = `🗓️ Marcação: ${inicioMarcacao} | Realização: ${inicioRealizacaoFormatado} a ${fimRealizacaoFormatado} | Desmontagem: ${fimDesmontagem}`;
    }
    // 🌟 FIM DO BLOCO DE PERÍODO ATUALIZADO
    
    // ======= Resumo das equipes/funções em uma linha (Sem alteração) =======
    const equipes = evt.equipes_detalhes || [];
    const resumoEquipes = equipes.length
        ? equipes.map(f => {
              const total = f.total_vagas || 0;
              const preenchido = f.preenchidas || 0;
              const restante = total - preenchido;
              let cor = "🟢";
              if (restante === total) cor = "🔴"; // 0 preenchido
              else if (restante > 0) cor = "🟡"; // Parcialmente preenchido
              return `${f.equipe}: ${cor} ${preenchido}/${total}`;
          }).join(" | ")
        : "Nenhuma equipe cadastrada";


    const card = document.createElement("div");
    card.className = "evento-card";

    const headerEvt = document.createElement("div");
    headerEvt.className = "evento-header";
    headerEvt.innerHTML = `
        <div class="evt-info">
            <div class="evento-nome">${nomeEvento}</div>
            <span class="evento-status ${alertaClasse}">${alertaTexto}</span>
        </div>
        <div class="evt-local-periodo">
            <div class="evento-local">📍 ${localEvento}</div>
            <div class="evento-local">Pavilhões: ${pavilhoesTexto}</div>
        </div>
        <div class="evt-periodo"><div class="evento-periodo">${periodoTexto}</div></div>
        `;

    const bodyEvt = document.createElement("div");
    bodyEvt.className = "evento-body";

    const resumoDiv = document.createElement("div");
    resumoDiv.className = "equipes-resumo";
    resumoDiv.textContent = resumoEquipes;
    bodyEvt.appendChild(resumoDiv);

    headerEvt.addEventListener("click", () => {
        bodyEvt.classList.toggle("open");
    });

    resumoDiv.addEventListener("click", () => {
        // Assumindo que abrirTelaEquipesEvento está disponível no escopo global
        if (typeof abrirTelaEquipesEvento === 'function') {
            abrirTelaEquipesEvento(evt);
        } else {
            console.warn("Função 'abrirTelaEquipesEvento' não está definida.");
        }
    });

    card.appendChild(headerEvt);
    card.appendChild(bodyEvt);
    return card;
  }
}


  async function abrirTelaEquipesEvento(evento) {
    const painel = document.getElementById("painelDetalhes");
    if (!painel) return;
    painel.innerHTML = "";

    const container = document.createElement("div");
    container.className = "painel-equipes-evento";

    // ... (código do HEADER, CORPO e RODAPÉ permanece o mesmo) ...

    // ===== HEADER =====
    const header = document.createElement("div");
    header.className = "header-equipes-evento";
    header.innerHTML = `
      <button class="btn-voltar" title="Voltar">←</button>
      <div class="info-evento">
        <h2>${evento.nmevento || "Evento sem nome"}</h2>
        <p>📍 ${evento.local || evento.nmlocalmontagem || "Local não informado"}</p>
        <p>📅 ${formatarPeriodo(evento.inicio_realizacao, evento.fim_realizacao)}</p>
      </div>
    `;
    container.appendChild(header);

    // ===== CORPO (LISTA DE EQUIPES) =====
    const corpo = document.createElement("div");
    corpo.className = "corpo-equipes";
    corpo.innerHTML = `<div class="loading">Carregando equipes…</div>`;
    container.appendChild(corpo);

    // rodapé / controles
    const rodape = document.createElement("div");
    rodape.className = "rodape-equipes";
    rodape.innerHTML = `
      <button class="btn-voltar-rodape"> ← Voltar</button>
      <button class="btn-relatorio">📄 Gerar Relatório</button>
    `;
    container.appendChild(rodape);

    painel.appendChild(container);

    // eventos de navegação
    container.querySelector(".btn-voltar")?.addEventListener("click", mostrarEventosEmAberto);
    container.querySelector(".btn-voltar-rodape")?.addEventListener("click", mostrarEventosEmAberto);
    container.querySelector(".btn-relatorio")?.addEventListener("click", () => {
      alert("Função de relatório ainda em desenvolvimento.");
    });

    // helper local
    function formatarPeriodo(inicio, fim) {
      const fmt = d => d ? new Date(d).toLocaleDateString("pt-BR") : "—";
      return inicio && fim ? `${fmt(inicio)} a ${fmt(fim)}` : fmt(inicio || fim);
    }

    // utilitário simples para escapar texto antes de inserir no innerHTML
    function escapeHtml(str) {
      if (!str && str !== 0) return "";
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    try {
      const idevento = evento.idevento || evento.id || evento.id_evento;
      const idempresa = localStorage.getItem("idempresa") || sessionStorage.getItem("idempresa");

      if (!idevento || !idempresa) {
        console.error("ID do evento ou empresa não encontrado:", { idevento, idempresa });
        corpo.innerHTML = `<p class="erro">Erro: evento ou empresa não identificados.</p>`;
        return;
      }

      const resp = await fetchComToken(`/main/detalhes-eventos-abertos?idevento=${idevento}&idempresa=${idempresa}`);

      // tratar formatos possíveis do retorno (fetchComToken já retorna JSON)
      let dados;
      if (resp && typeof resp === "object" && (Array.isArray(resp) || resp.equipes !== undefined)) {
        dados = resp;
      } else if (resp && typeof resp === "object" && "ok" in resp) {
        if (!resp.ok) throw new Error("Erro ao buscar detalhes das equipes.");
        dados = await resp.json();
      } else {
        console.error("Resposta inválida ao buscar detalhes das equipes:", resp);
        corpo.innerHTML = `<p class="erro">Erro ao carregar detalhes das equipes.</p>`;
        return;
      }

      // normaliza array de equipes: suportar {equipes: [...] } ou array direto
      const equipesRaw = Array.isArray(dados.equipes) ? dados.equipes : (Array.isArray(dados) ? dados : []);

      // CONSOLE 1: Dados Brutos do Backend
      console.log("=================================================");
      console.log(`[${evento.nmevento}] Dados Brutos (equipesRaw) do Backend:`);
      console.log(equipesRaw);
      console.log("=================================================");

      if (!equipesRaw.length) {
        corpo.innerHTML = `<p class="sem-equipes">Nenhuma equipe cadastrada para este evento.</p>`;
        return;
      }
      
      // NOVO HELPER: Mapeia e filtra funções sem vagas no orçamento e sem staff alocado.
      const mapFuncoes = (funcoesArray) => {
          if (!Array.isArray(funcoesArray)) return [];

          return funcoesArray.map(f => {
              // Mapeamento dos campos de Total e Preenchidas
              const total = Number(f.qtd_orcamento ?? f.qtd_orcamento ?? f.total_vagas ?? f.total ?? f.qtditens ?? 0);
              const preenchidas = Number(f.qtd_cadastrada ?? f.qtd_cadastrada ?? f.preenchidas ?? f.preenchidos ?? f.preenchidos ?? 0);
              
              // Filtro: Se não tem vaga NO ORÇAMENTO E não tem staff PREENCHIDO, ignora.
              if (total === 0 && preenchidas === 0) {
                  return null;
              }

              return {
                  idfuncao: f.idfuncao ?? f.idFuncao ?? null,
                  nome: f.nome ?? f.descfuncao ?? f.categoria ?? f.nmfuncao ?? "Função",
                  total,
                  preenchidas,
                  concluido: total > 0 && preenchidas >= total,
                  dtini_vaga: f.dtini_vaga ?? null,
                  dtfim_vaga: f.dtfim_vaga ?? null,

                  // ✅ ADICIONADO: Datas preenchidas (do staffeventos)
                  datas_staff: f.datas_staff ?? []

              };
          }).filter(f => f !== null); // Remove as funções que retornaram null (0/0)
      };


      // converte e normaliza cada item
      let equipes = equipesRaw.map(item => {
        // Obter nome e ID da equipe
        const equipeNome = item.equipe || item.nmequipe || item.nome || item.categoria || (`Equipe ${item.idequipe ?? ""}`);
        const equipeId = item.idequipe;
        let funcoesResult = [];
        
        // se veio com funcoes já montadas (compatível com rota atual)
        if (item.funcoes && Array.isArray(item.funcoes)) {
          funcoesResult = mapFuncoes(item.funcoes);
        }
        // se veio como categorias agregadas (campo 'categorias' do backend)
        else if (item.categorias && Array.isArray(item.categorias)) {
          funcoesResult = mapFuncoes(item.categorias);
        }
        // item vindo como categoria direta
        else if (item.categoria) {
          const total = Number(item.total_vagas ?? item.total ?? item.qtd_orcamento ?? 0);
          const preenchidas = Number(item.preenchidos ?? item.qtd_cadastrada ?? 0);
          
          // Cria função apenas se houver vagas/staff
          if (total > 0 || preenchidas > 0) { 
                funcoesResult = [{
                  idfuncao: item.idfuncao ?? null,
                  nome: item.categoria || "Função",
                  total,
                  preenchidas,
                  concluido: total > 0 && preenchidas >= total
              }];
          }
        }
        // fallback genérico (usando funcoes original, se houver)
        else if (Array.isArray(item.funcoes)) {
            funcoesResult = mapFuncoes(item.funcoes);
        }
        
        return {
            equipe: equipeNome,
            idequipe: equipeId,
            funcoes: funcoesResult
        };
      })
      // 🛑 NOVO FILTRO DE NOME: Remove o item que vem nomeado explicitamente como "Sem equipe"
      .filter(eq => eq.equipe.toLowerCase() !== "sem equipe")
      // FILTRO FINAL: Remove equipes que não contêm NENHUMA função relevante
      .filter(eq => eq.funcoes && eq.funcoes.length > 0);

      // CONSOLE 2: Dados Filtrados e Normalizados para Renderização
      console.log("=================================================");
      console.log(`[${evento.nmevento}] Dados Filtrados e Prontos (equipes):`);
      console.log(equipes);
      console.log("=================================================");


      if (!equipes.length) {
        corpo.innerHTML = `<p class="sem-equipes">Nenhuma equipe com vagas (Produto(s)) cadastrada para este evento.</p>`;
        return;
      }

      // renderiza lista mantendo o visual atual mas usando total/preenchidas corretos
      corpo.innerHTML = "";
      equipes.forEach(eq => {
        
        const equipeBox = document.createElement("div");
        equipeBox.className = "equipe-box";

        const totalFuncoes = eq.funcoes?.length || 0;
        const concluidas = eq.funcoes?.filter(f => f.concluido)?.length || 0;
        const perc = totalFuncoes > 0 ? Math.round((concluidas / totalFuncoes) * 100) : 0;

        // resumo de vagas por função (compacto) usando total/preenchidas
        const resumo = eq.funcoes?.map(f => {
          const preench = Number(f.preenchidas ?? 0);
          const total = Number(f.total ?? 0);
          let cor = "🟢";
          if (total === 0) cor = "⚪";
          else if (preench === 0) cor = "🔴";
          else if (preench < total) cor = "🟡";

          const periodoVaga = formatarPeriodo(f.dtini_vaga, f.dtfim_vaga);
          console.log("Período da vaga", f.nome, f.dtini_vaga, f.dtfim_vaga, "=>", periodoVaga);
        
          return `${f.nome}: ${cor} (${periodoVaga}) ${preench}/${total}`;
        }).join(" | ");

      // <div class="equipe-resumo">${escapeHtml(resumo || "Nenhuma função cadastrada")}</div>

        equipeBox.innerHTML = `
          <div class="equipe-header" role="button" tabindex="0">
            <span class="equipe-nome">${escapeHtml(eq.equipe || "Equipe")}</span>
            <span class="equipe-status">${concluidas}/${totalFuncoes} concluídas</span>
          </div>
          <div class="barra-progresso">
            <div class="progresso" style="width:${perc}%;"></div>
          </div>
          
          <div class="equipe-resumo">${resumo || "Nenhuma função cadastrada"}</div>
          <div class="equipe-actions">
            <button type="button" class="ver-funcionarios-btn">
              <i class="fas fa-users"></i> Funcionários
            </button>
          </div>
        `;

        // clique / tecla Enter abre detalhes (passa evento original e equipe transformada)
        const headerBtn = equipeBox.querySelector(".equipe-header");
        headerBtn.addEventListener("click", () => abrirDetalhesEquipe(eq, evento));
        headerBtn.addEventListener("keypress", (e) => {
          if (e.key === "Enter") abrirDetalhesEquipe(eq, evento);
        });
        
        // 🛑 NOVO LISTENER: Botão 'Funcionários'
        const funcionariosBtn = equipeBox.querySelector(".ver-funcionarios-btn");
        if (funcionariosBtn) {
            // Passa o objeto equipe (eq) e o objeto evento (evento) para a função
            funcionariosBtn.addEventListener("click", (e) => {
                e.stopPropagation(); // Evita que o clique no botão ative o clique do header
                abrirListaFuncionarios(eq, evento); 
            });
        }
        // 🛑 FIM NOVO LISTENER
        
        corpo.appendChild(equipeBox);
      });

    } catch (err) {
      console.error("Erro ao buscar detalhes das equipes.", err);
      const msg = (err && err.message) ? err.message : "Erro ao carregar detalhes das equipes.";
      corpo.innerHTML = `<p class="erro">${escapeHtml(msg)}</p>`;
    }
  }



/**
 * Abre a tela de lista de funcionários de uma equipe específica no painelDetalhes.
 * Substitui o Modal pela visualização integrada.
 * @param {object} equipe - Objeto da equipe com 'equipe' e 'idequipe'.
 * @param {object} evento - Objeto do evento com 'nmevento' e 'idevento'.
 */
async function abrirListaFuncionarios(equipe, evento) {
    const painel = document.getElementById("painelDetalhes");
    if (!painel) return;
    painel.innerHTML = ""; 

    const container = document.createElement("div");
    container.className = "painel-lista-funcionarios";

    // ... (Helpers locais escapeHtml, agruparFuncionariosPorFuncao, formatarPeriodo permanecem os mesmos) ...

    function escapeHtml(str) {
        if (!str && str !== 0) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    const agruparFuncionariosPorFuncao = (lista) => {
        return lista.reduce((grupos, funcionario) => {
            const funcao = funcionario.funcao || 'Não Classificado';
            if (!grupos[funcao]) {
                grupos[funcao] = [];
            }
            grupos[funcao].push(funcionario);
            return grupos;
        }, {});
    };

    function formatarPeriodo(inicio, fim) {
        const fmt = d => d ? new Date(d).toLocaleDateString("pt-BR") : "—";
        return inicio && fim ? `${fmt(inicio)} a ${fmt(fim)}` : fmt(inicio || fim);
    }
   function cleanAndNormalize(str) {
        if (!str && str !== 0) return "";
        let cleanStr = String(str);
        
        // 1. Remove pontuações e acentos (normaliza para NFD e remove caracteres diacríticos)
        cleanStr = cleanStr.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        // 2. Remove caracteres não alfanuméricos exceto espaços e delimitadores comuns (mantendo o texto legível)
        cleanStr = cleanStr.replace(/[^\w\s\-\.\/]/g, ' '); 
        
        return cleanStr.trim();
    }

    // --- HELPER: Exportação para CSV (AGORA COM LIMPEZA E MOEDA) ---
    function exportarParaCSV(data, nomeEquipe, nomeEvento) {
        if (!Array.isArray(data) || data.length === 0) {
            alert("Não há dados para exportar.");
            return;
        }

        const DELIMITADOR = ';'; 

        // 1. Define os cabeçalhos das colunas
        const headers = [
            "Funcao", // Sem acento
            "Nome", 
            "Setor", 
            "Status Pagamento", 
            "Valor Total (R$)", // Indicando a moeda
            "Nivel Experiencia", // Sem acento
            "ID Funcionario",
            "ID Staff Evento"
        ];
        
        // 2. Mapeia os dados e trata campos
        const csvRows = data.map(row => {
            // Função para envolver o valor em aspas se contiver PONTO E VÍRGULA, aspas ou quebra de linha
            const sanitize = val => {
                let str = String(val ?? '');
                // Trata aspas duplas internas (escapa)
                str = str.replace(/"/g, '""'); 
                // Envolve o valor em aspas se houver PONTO E VÍRGULA, aspas ou quebra de linha
                if (str.includes(DELIMITADOR) || str.includes('\n') || str.includes('"')) {
                    return `"${str}"`;
                }
                return str;
            };

            // Tratamento do Valor Total: Remove R$, substitui ponto por vírgula para decimal
            const valorTotalRaw = row.vlrtotal ? String(row.vlrtotal).replace(/[R$\s]/g, '') : '0';
            // Garante que o separador decimal seja a vírgula (padrão brasileiro no CSV)
            const valorTotalFormatado = valorTotalRaw.replace('.', ','); 


            return [
                sanitize(cleanAndNormalize(row.funcao || 'Nao Classificado')), // Limpeza
                sanitize(cleanAndNormalize(row.nome)),                         // Limpeza
                sanitize(cleanAndNormalize(row.setor)),                        // Limpeza
                sanitize(cleanAndNormalize(row.status_pagamento)),             // Limpeza
                sanitize(valorTotalFormatado),                                 // Formato para moeda
                sanitize(cleanAndNormalize(row.nivelexperiencia)),             // Limpeza
                sanitize(row.idfuncionario),
                sanitize(row.idstaffevento)
            ].join(DELIMITADOR); 
        });
        
        // 3. Combina cabeçalhos e linhas
        const csvContent = [
            headers.join(DELIMITADOR), 
            ...csvRows
        ].join('\n');

        // 4. Cria e dispara o download
        const nomeArquivo = `Lista_Funcionarios_${cleanAndNormalize(nomeEquipe).replace(/\s/g, '_')}_${cleanAndNormalize(nomeEvento).replace(/\s/g, '_')}.csv`;
        
        // Adicionando BOM (Byte Order Mark) para melhor compatibilidade com caracteres UTF-8 no Excel
        const BOM = '\uFEFF'; 
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' }); 
        const link = document.createElement("a");

        if (link.download !== undefined) { 
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", nomeArquivo);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } else {
            alert("Seu navegador não suporta download automático.");
        }
    }
    // ------------------------------------------

    let listaFuncionariosCarregada = [];
    
    // ... (Estrutura HTML do HEADER, CORPO e RODAPÉ permanece a mesma) ...

    // ===== HEADER (Adaptado) =====
    const header = document.createElement("div");
    header.className = "header-equipes-evento"; 
    header.innerHTML = `
        <button class="btn-voltar-detalhe" title="Voltar para Detalhe da Equipe">←</button>
        <div class="info-evento">
            <h2>${escapeHtml(equipe.equipe || "Equipe")}</h2>
            <p><strong>Evento:</strong> ${escapeHtml(evento.nmevento || "Evento")}</p>
            <p>📍 ${evento.local || evento.nmlocalmontagem || "Local não informado"}</p>
            <p>📅 ${formatarPeriodo(evento.inicio_realizacao, evento.fim_realizacao)}</p>
        </div>
    `;
    container.appendChild(header);

    // ===== CORPO (Conteúdo Dinâmico - Funcionários) =====
    const corpo = document.createElement("div");
    corpo.className = "corpo-funcionarios";
    corpo.innerHTML = `<div class="loading">Carregando funcionários...</div>`;
    container.appendChild(corpo);

    // ===== RODAPÉ (Adaptado) =====
    const rodape = document.createElement("div");
    rodape.className = "rodape-equipes"; 
    rodape.innerHTML = `
        <button class="btn-voltar-rodape-detalhe"> ← Voltar</button>
        <button class="btn-exportar-lista">📥 Exportar Lista</button>
    `;
    container.appendChild(rodape);

    painel.appendChild(container);

    // === Eventos de Navegação ===
    const voltarParaEquipes = () => abrirTelaEquipesEvento(evento); 
    container.querySelector(".btn-voltar-detalhe")?.addEventListener("click", voltarParaEquipes);
    container.querySelector(".btn-voltar-rodape-detalhe")?.addEventListener("click", voltarParaEquipes);
    
    // 🛑 EVENTO DO BOTÃO EXPORTAR (CHAMA O HELPER CORRIGIDO)
    container.querySelector(".btn-exportar-lista")?.addEventListener("click", () => {
        exportarParaCSV(
            listaFuncionariosCarregada, 
            equipe.equipe || "Equipe", 
            evento.nmevento || "Evento"
        );
    });

    // === Carregamento de Dados ===
    try {
        const idevento = evento.idevento || evento.id || evento.id_evento;
        const idequipe = equipe.idequipe;
        const idempresa = localStorage.getItem("idempresa") || sessionStorage.getItem("idempresa");

        if (!idevento || !idequipe || !idempresa) {
            corpo.innerHTML = `<p class="erro">Erro: IDs de evento, equipe ou empresa não identificados.</p>`;
            return;
        }

        const url = `/main/ListarFuncionarios?idEvento=${idevento}&idEquipe=${idequipe}`;
        const funcionarios = await fetchComToken(url);
        
        if (!Array.isArray(funcionarios)) {
             throw new Error("Resposta inválida ou vazia do servidor.");
        }
        
        listaFuncionariosCarregada = funcionarios; 
        
        if (funcionarios.length === 0) {
            corpo.innerHTML = `<p class="sem-funcionarios-msg">Nenhum funcionário cadastrado nesta equipe para este evento.</p>`;
            return;
        }

        // --- Renderização da Lista de Funcionários ---
        const gruposPorFuncao = agruparFuncionariosPorFuncao(funcionarios);
        let conteudoAgrupadoHtml = '';

        for (const funcao in gruposPorFuncao) {
            if (gruposPorFuncao.hasOwnProperty(funcao)) {
                const funcionariosDaFuncao = gruposPorFuncao[funcao];
                
                // Header do Grupo
                conteudoAgrupadoHtml += `
                    <div class="funcionario-grupo-header">
                        <h4 class="grupo-titulo">${escapeHtml(funcao)}</h4>
                        <span class="grupo-badge">${funcionariosDaFuncao.length} Pessoa(s)</span>
                    </div>
                    <div class="grupo-divisor"></div>
                `;

                // Lista de Funcionários
                let listaFuncionariosHtml = '<ul class="funcionario-lista">';
                
                funcionariosDaFuncao.forEach(f => {
                    let statusClass = 'status-pendente';
                    const statusTexto = f.status_pagamento || 'Pendente';
                    
                    if (statusTexto === 'Pago') {
                        statusClass = 'status-pago'; 
                    } else if (statusTexto) {
                        statusClass = 'status-atencao'; 
                    }
                    
                    // Renderização do item - Aplicando escapeHtml
                    listaFuncionariosHtml += `
                        <li class="funcionario-item">
                            <span class="funcionario-nome">${escapeHtml(f.nome)}</span>
                            <span class="funcionario-status-badge ${statusClass}">
                                ${escapeHtml(statusTexto)}
                            </span>
                        </li>
                    `;
                });
                
                listaFuncionariosHtml += '</ul>';
                conteudoAgrupadoHtml += listaFuncionariosHtml;
            }
        }
        
        corpo.innerHTML = conteudoAgrupadoHtml; 

    } catch (err) {
        console.error("Erro ao buscar lista de funcionários:", err);
        const msg = (err && err.message) ? err.message : "Erro interno ao carregar a lista de funcionários.";
        corpo.innerHTML = `<p class="erro">${escapeHtml(msg)}</p>`;
    }
}

function formatarPeriodo(inicio, fim) {
    const fmt = d => d ? new Date(d).toLocaleDateString("pt-BR") : "—";
    return inicio && fim ? `${fmt(inicio)} a ${fmt(fim)}` : fmt(inicio || fim);
}

function abrirDetalhesEquipe(equipe, evento) {
    const painel = document.getElementById("painelDetalhes");
    if (!painel) return;
    painel.innerHTML = "";

    const container = document.createElement("div");
    container.className = "painel-equipes-evento";

    const totalFuncoes = equipe.funcoes?.length || 0;
    const concluidas = equipe.funcoes?.filter(f => f.concluido)?.length || 0;

    // Funções de utilidade
    function escapeHtml(str) {
        if (!str && str !== 0) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }
    
    // helper local (assumindo que está definido globalmente ou em escopo superior)
    function formatarPeriodo(inicio, fim) {
        const fmt = d => d ? new Date(d).toLocaleDateString("pt-BR") : "—";
        return inicio && fim ? `${fmt(inicio)} a ${fmt(fim)}` : fmt(inicio || fim);
    }

    // 1. FUNÇÃO DE VOLTA DEFINIDA AQUI
    const voltarParaEquipes = () => abrirTelaEquipesEvento(evento);

    // ===== HEADER - COMPACTADO PARA REMOVER #text =====
    const header = document.createElement("div");
    header.className = "header-equipes-evento";
    header.innerHTML = `<button class="btn-voltar" title="Voltar">←</button><div class="info-evento"><h2>${escapeHtml(equipe.equipe || equipe.nome || "Equipe")}</h2><p>${escapeHtml(evento.nmevento || "Evento sem nome")} — ${concluidas}/${totalFuncoes} concluídas</p><p>📍 ${escapeHtml(evento.nmlocalmontagem || evento.local || "Local não informado")}</p><p>👤 Cliente: ${escapeHtml(evento.nmfantasia || evento.cliente || "")}</p></div>`;
    container.appendChild(header);

    // ===== LISTA DE FUNÇÕES =====
    const lista = document.createElement("ul");
    lista.className = "funcoes-lista";

    (equipe.funcoes || []).forEach(func => {
        const total = Number(func.total ?? func.total_vagas ?? func.qtd_orcamento ?? 0);
        const preenchidas = Number(func.preenchidas ?? func.qtd_cadastrada ?? 0);
        const concluido = total > 0 && preenchidas >= total;

        const li = document.createElement("li");
        li.className = "funcao-item";
        if (concluido) li.classList.add("concluido");
        li.setAttribute("role", "button");
        li.tabIndex = 0;

        const periodoVaga = formatarPeriodo(func.dtini_vaga, func.dtfim_vaga);

        // NÓS DE TEXTO criados por createElement geralmente não são um problema,
        // mas vamos garantir que o HTML injetado seja compacto.
        
        // CORREÇÃO: Usando a abordagem de wrapper para evitar nós #text.
        li.innerHTML = `
<div class="func-wrapper">
    <div class="func-nome">${escapeHtml(func.nome || func.nmfuncao || "Função")} <span class="func-data-vaga">(${periodoVaga})</span></div>
    <div class="func-estado">${preenchidas}/${total}</div>
    <div class="func-detalhes">
        ${concluido 
            ? '✅ Completa' 
            : `<button class="btn-abrir-staff status-urgente-vermelho">⏳ Abrir staff</button>`
        }
    </div>
</div>
        `;
        
        // Se não estiver concluído, precisamos adicionar o listener ao botão.
        if (!concluido) {
             const botao = li.querySelector(".btn-abrir-staff");
             if (botao) {
                 botao.addEventListener("click", (e) => {
                     e.stopPropagation(); // evita conflito com o clique no <li>
                     abrirStaffModal();
                 });
             }
        }

        function abrirStaffModal() {
            if (concluido) return;

            const params = new URLSearchParams();

            params.set("idfuncao", func.idfuncao ?? func.idFuncao);
            params.set("nmfuncao", func.nome ?? func.nmfuncao);
            params.set("idequipe", equipe.idequipe || "");
            params.set("nmequipe", equipe.equipe || "");
            params.set("idmontagem", evento.idmontagem || "");
            params.set("nmlocalmontagem", evento.nmlocalmontagem || "");
            params.set("idcliente", evento.idcliente || "");
            params.set("nmcliente", evento.nmfantasia || evento.cliente || "");
            params.set("idevento", evento.idevento || "");
            params.set("nmevento", evento.nmevento || "");

            if (Array.isArray(evento.dataeventos)) {
                params.set("dataeventos", JSON.stringify(evento.dataeventos));
            } else if (evento.dataeventos) {
                params.set("dataeventos", evento.dataeventos);
            }

            params.set("dtini_vaga", func.dtini_vaga || null);
            params.set("dtfim_vaga", func.dtfim_vaga || null);

            // 2. LÓGICA DE CALLBACK: Define uma função global temporária.
            // O código de fechar o modal deve chamar window.onStaffModalClosed()
            window.onStaffModalClosed = function(modalClosedSuccessfully) {
                // Limpa a função global logo após ser chamada.
                delete window.onStaffModalClosed;
                console.log("Callback do modal Staff acionado. Atualizando a tela...");
                
                // Chama a função para voltar à tela anterior e recarregar os dados.
                voltarParaEquipes(); 
            };

            console.log("Abrindo modal Staff com parâmetros:", Object.fromEntries(params.entries()));

            window.__modalInitialParams = params.toString();
            window.moduloAtual = "Staff";

            const targetUrl = `CadStaff.html?${params.toString()}`;

            if (typeof abrirModalLocal === "function") {
                abrirModalLocal(targetUrl, "Staff");
            } else if (typeof abrirModal === "function") {
                abrirModal(targetUrl, "Staff");
            } else {
                console.error("ERRO FATAL: Nenhuma função global para abrir o modal foi encontrada.");
            }
        }

        li.addEventListener("click", abrirStaffModal);
        li.addEventListener("keypress", (e) => { if (e.key === "Enter") abrirStaffModal(); });
        
        lista.appendChild(li);
    });

    container.appendChild(lista);

    // ===== RODAPÉ - COMPACTADO PARA REMOVER #text =====
    const rodape = document.createElement("div");
    rodape.className = "rodape-equipes";
    rodape.innerHTML = `<button class="btn-voltar-rodape">← Voltar</button><span class="status-texto">${concluidas === totalFuncoes ? "✅ Finalizado" : "⏳ Em andamento"}</span>`;
    container.appendChild(rodape);

    painel.appendChild(container);

    // Eventos de navegação
    container.querySelector(".btn-voltar")?.addEventListener("click", voltarParaEquipes);
    container.querySelector(".btn-voltar-rodape")?.addEventListener("click", voltarParaEquipes);
}


// =========================
//    Pedidos Financeiros 
// =========================

async function buscarPedidosUsuario() {
  const idusuario = getIdExecutor(); // pega do token
  try {
    const resposta = await fetchComToken(`/main/notificacoes-financeiras`, {
      headers: { idempresa: getIdEmpresa() }
    });
   
    const ehMasterStaff = usuarioTemPermissao();
    console.log("Usuário é Master no Staff?", ehMasterStaff);
    console.log("Resposta bruta do fetch:", resposta);

    if (!resposta || !Array.isArray(resposta)) {
      console.error("Resposta inválida ou não é um array:", resposta);
      return [];
    }

    // Função para preencher sempre o nome do solicitante
    function preencherSolicitante(p) {
      return {
        ...p,
        solicitante_nome: p.nomeSolicitante || p.solicitante_nome || (String(p.solicitante) === String(idusuario) ? "Você" : "Solicitante desconhecido")
      };
    }

    // Normaliza status: sempre retorna objeto { status: 'pendente' | 'autorizado' | 'rejeitado', ...outrosCampos }
    function normalizarCampoJSON(campo) {
      if (!campo) return { status: "pendente" };
      if (typeof campo === "string") {
        try {
          const parsed = JSON.parse(campo);
          return { ...parsed, status: parsed.status?.toLowerCase() || "pendente" };
        } catch {
          return { status: campo.toLowerCase() };
        }
      }
      if (typeof campo === "object") {
        return { ...campo, status: campo.status?.toLowerCase() || "pendente" };
      }
      return { status: "pendente" };
    }

    function normalizarPedido(p) {
      return {
        ...p,
        statuscaixinha: normalizarCampoJSON(p.statuscaixinha),
        statusajustecusto: normalizarCampoJSON(p.statusajustecusto),
        statusdiariadobrada: normalizarCampoJSON(p.statusdiariadobrada),
        statusmeiadiaria: normalizarCampoJSON(p.statusmeiadiaria)
      };
    }

    // Mapeia todos os pedidos
    let pedidosProcessados = resposta.map(p => normalizarPedido(preencherSolicitante(p)));

    if (ehMasterStaff) {
      console.log("✅ Usuário é MASTER → vendo todos os pedidos.");
      pedidosProcessados = pedidosProcessados.map(p => ({ ...p, ehMasterStaff: true }));
      console.log("PEDIDOS PROCESSADOS", pedidosProcessados);
    } else {
      // Usuário comum → vê apenas os próprios pedidos
      pedidosProcessados = pedidosProcessados
        .filter(p => String(p.solicitante) === String(idusuario))
        .map(p => ({ ...p, ehMasterStaff: false }));
      console.log("👤 Usuário comum → pedidos do próprio usuário:", pedidosProcessados);
    }

    return pedidosProcessados;

  } catch (err) {
    console.error("Erro na requisição de pedidos:", err);
    return [];
  }
}
// Atualiza o painelDetalhes com os pedidos
async function mostrarPedidosUsuario() {
  const lista = document.getElementById("painelDetalhes");
  if (!lista) return;

  try {
    let pedidos = await buscarPedidosUsuario(); // já retorna todos os pedidos que o usuário pode ver
    lista.innerHTML = "";

    // 🔹 Remove duplicados (mesmo funcionário, evento, valor e tipo)
    const vistos = new Set();
    pedidos = pedidos.filter(p => {
      const chave =
        `${p.funcionario || ""}|${p.evento || ""}|${p.valor || ""}|${p.statusajustecusto?.valor || ""}|${p.statuscaixinha?.valor || ""}|${p.statusmeiadiaria?.valor || ""}|${p.statusdiariadobrada?.valor || ""}`;
      if (vistos.has(chave)) return false;
      vistos.add(chave);
      return true;
    });

    const titulo = document.createElement("div");
    titulo.className = "titulo-pedidos font-bold text-lg mb-3";
    titulo.textContent = "Pedidos por Funcionário";
    lista.appendChild(titulo);

    if (!pedidos.length) {
      const msg = document.createElement("p");
      msg.textContent = "Não há pedidos registrados.";
      lista.appendChild(msg);
      return;
    }

    const listaFuncionarios = document.createElement("div");
    listaFuncionarios.className = "lista-funcionarios";
    lista.appendChild(listaFuncionarios);

    // Agrupa pedidos por funcionário
    const funcionariosMap = {};
    pedidos.forEach(p => {
      if (!funcionariosMap[p.funcionario]) funcionariosMap[p.funcionario] = [];
      funcionariosMap[p.funcionario].push(p);
    });

    Object.keys(funcionariosMap).forEach(funcNome => {
      const pedidosFunc = funcionariosMap[funcNome];

      // Filtra só pedidos com alterações
      const pedidosComAtualizacao = pedidosFunc.filter(p => {
        const campos = ["statusajustecusto", "statuscaixinha", "statusmeiadiaria", "statusdiariadobrada"];
        return campos.some(campo => {
          const info = p[campo];
          return info && (info.valor !== undefined || (info.datas && info.datas.length > 0) || info.descricao);
        });
      });

      if (pedidosComAtualizacao.length === 0) return;

      // Conta categorias realmente alteradas
      let totalCategorias = 0;
      pedidosComAtualizacao.forEach(p => {
        ["statusajustecusto", "statuscaixinha", "statusmeiadiaria", "statusdiariadobrada"].forEach(campo => {
          const info = p[campo];
          // Conta apenas se houver valor/descrição/datas **e** status for pendente
          if (info && (info.valor !== undefined || (info.datas && info.datas.length > 0) || info.descricao)) {
            if (!info.status || info.status.toLowerCase() === "pendente") {
              totalCategorias++;
            }
          }
        });
      });


      const divFuncionario = document.createElement("div");
      divFuncionario.className = "funcionario border rounded mb-3";

      const header = document.createElement("div");
      header.className = "funcionario-header p-2 cursor-pointer bg-gray-200 flex justify-between items-center";

      const nomeFuncionario = funcNome || "Desconhecido";
      const nomeSolicitante = pedidosFunc[0].nomeSolicitante || "Você";

      header.innerHTML = `
        <div>
          <strong>Funcionário:</strong> ${nomeFuncionario}<br>
          <small>Solicitante: ${nomeSolicitante}</small>
        </div>
        <span>Pendentes: ${totalCategorias}</span>
      `;

      const container = document.createElement("div");
      container.className = "funcionario-body p-2 hidden";

      pedidosComAtualizacao.forEach(pedido => {
  ["statusajustecusto", "statuscaixinha", "statusmeiadiaria", "statusdiariadobrada"].forEach(campo => {
    const info = pedido[campo];
    if (!info) return;

    const valorAlterado = info.valor !== undefined || (info.datas && info.datas.length > 0) || info.descricao;
    if (!valorAlterado) return;

    const statusAtual = (info.status || "Pendente").toLowerCase();

    const card = document.createElement("div");
    card.className = "pedido-card border rounded p-2 mb-2 bg-gray-50 flex justify-between items-start";

    let corQuadrado = "#facc15"; // padrão = pendente
    if (statusAtual === "autorizado") corQuadrado = "#16a34a";
    if (statusAtual === "rejeitado") corQuadrado = "#dc2626";

    let innerHTML = `<div>
      <strong>${campo.replace("status", "").replace(/([A-Z])/g, ' $1')}</strong><br>`;

    if (pedido.evento) {
      innerHTML += `<strong>Evento:</strong> ${pedido.evento}<br>`;
    }

    if (info.valor !== undefined) {
      innerHTML += `Valor: R$ ${info.valor} - <span class="status-text">${info.status || "Pendente"}</span><br>`;
    } else if (info.datas) {
      innerHTML += `Datas: ${info.datas.map(d => d.data).join(", ")} - <span class="status-text">${info.status || "Pendente"}</span><br>`;
    }

    if (info.descricao) {
      innerHTML += `Descrição: ${info.descricao}<br>`;
    }

    // 🔹 Só mostra botões se for Master e o status ainda for pendente
    if (pedido.ehMasterStaff && statusAtual === "pendente") {
      innerHTML += `
        <div class="flex gap-2 mt-1">
          <button class="aprovar bg-green-500 text-white px-2 py-1 rounded">Autorizar</button>
          <button class="negar bg-red-500 text-white px-2 py-1 rounded">Rejeitar</button>
        </div>
      `;
    }

    innerHTML += `</div>`;
    innerHTML += `<div class="quadrado-arredondado w-4 h-4 rounded" style="background-color: ${corQuadrado};"></div>`;

    card.innerHTML = innerHTML;
    container.appendChild(card);

    // 🔹 Adiciona eventos somente se status for pendente
    if (pedido.ehMasterStaff && statusAtual === "pendente") {
      const aprovarBtn = card.querySelector(".aprovar");
      const negarBtn = card.querySelector(".negar");

      aprovarBtn?.addEventListener("click", async () => {
        await atualizarStatusPedido(pedido.idpedido, campo, "Autorizado", card);
      });

      negarBtn?.addEventListener("click", async () => {
        await atualizarStatusPedido(pedido.idpedido, campo, "Rejeitado", card);
      });
    }
  });
});


      header.addEventListener("click", () => {
        container.classList.toggle("hidden");
      });

      divFuncionario.appendChild(header);
      divFuncionario.appendChild(container);
      listaFuncionarios.appendChild(divFuncionario);
    });

  } catch (err) {
    console.error("Erro ao mostrar pedidos:", err);
  }
}

// Função para atualizar status via fetch
async function atualizarStatusPedido(idpedido, categoria, acao, cardElement) {
  try {
    const resposta = await fetchComToken('/main/notificacoes-financeiras/atualizar-status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'idempresa': getIdEmpresa()
      },
      body: JSON.stringify({ idpedido, categoria, acao })
    });

    if (resposta.sucesso && resposta.atualizado) {
      // Pega os dados atualizados da coluna certa
      const campoAtualizado = resposta.atualizado[categoria]; // Ex: statuscaixinha
      let info = campoAtualizado;
      if (typeof info === "string") {
        try { info = JSON.parse(info); } catch { info = { status: info }; }
      }
      const statusNormalized = (info.status || "Pendente").toLowerCase();

      // Atualiza quadrado visualmente
      const quadrado = cardElement.querySelector(".quadrado-arredondado");
      if (quadrado) {
        let cor = "#facc15"; // pendente
        if (statusNormalized === "autorizado") cor = "#16a34a";
        if (statusNormalized === "rejeitado") cor = "#dc2626";
        quadrado.style.transition = "background-color 0.5s ease";
        quadrado.style.backgroundColor = cor;
      }

      // Atualiza status no span correto
      const statusSpan = cardElement.querySelector(".status-text");
      if (statusSpan) statusSpan.textContent = info.status || "Pendente";

      // Atualiza valor, descrição e datas do card
      const innerDiv = cardElement.querySelector("div");
      if (innerDiv) {
        let html = `<strong>${categoria.replace("status", "").replace(/([A-Z])/g, ' $1')}</strong><br>`;
        if (resposta.atualizado.evento) html += `Evento: ${resposta.atualizado.evento}<br>`;
        if (info.valor !== undefined) html += `Valor: R$ ${info.valor}<br>`;
        if (info.descricao) html += `Descrição: ${info.descricao}<br>`;
        if (info.datas && info.datas.length > 0) html += `Datas: ${info.datas.map(d => d.data).join(", ")}<br>`;
        html += `<span class="status-text">${info.status}</span>`;
        innerDiv.innerHTML = html;
      }

      // 🔹 Alert temporário
      const alerta = document.createElement("div");
      alerta.textContent = `Status atualizado para ${acao.toUpperCase()}`;
      alerta.style.position = "fixed";
      alerta.style.top = "20px";
      alerta.style.right = "20px";
      alerta.style.backgroundColor = "#16a34a";
      alerta.style.color = "#fff";
      alerta.style.padding = "10px 15px";
      alerta.style.borderRadius = "6px";
      alerta.style.zIndex = 9999;
      document.body.appendChild(alerta);
      setTimeout(() => alerta.remove(), 2500);

    } else {
      console.error("Falha ao atualizar pedido:", resposta);
    }
  } catch (err) {
    console.error("Erro ao atualizar pedido:", err);
  }
}

async function atualizarResumoPedidos() {
  try {
    // Busca todos os pedidos que o usuário pode ver
    const pedidos = await buscarPedidosUsuario(); // retorna array de pedidos

    let total = 0;
    let autorizados = 0;
    let pendentes = 0;
    let rejeitados = 0;

    console.log("PEDIDOS ATUALIZAR RESUMO", pedidos);

    pedidos.forEach(p => {
      ["statusajustecusto", "statuscaixinha", "statusmeiadiaria", "statusdiariadobrada"].forEach(campo => {
        const info = p[campo];
        if (!info) return;

        const temAlteracao = info.valor !== undefined || (info.datas && info.datas.length > 0) || info.descricao;
        if (!temAlteracao) return;

        total++;

        const status = (info.status || "Pendente").toLowerCase();
        if (status === "autorizado") autorizados++;
        else if (status === "rejeitado") rejeitados++;
        else pendentes++; // considera pendente qualquer outro caso
      });
    });

    // Atualiza os spans do card
    document.getElementById("pedidosTotal").textContent = total;
    document.getElementById("pedidosAutorizados").textContent = autorizados;
    document.getElementById("pedidosPendentes").textContent = pendentes;
    document.getElementById("pedidosRecusados").textContent = rejeitados;

  } catch (err) {
    console.error("Erro ao atualizar resumo de pedidos:", err);
  }
}

// Atualiza automaticamente a cada 10 segundos
setInterval(atualizarResumoPedidos, 10000);

// Chamada inicial ao carregar a página
atualizarResumoPedidos();


// ==================================================================================
// FUNÇÕES DE EXIBIÇÃO E CARREGAMENTO DE CARDS DO DASHBOARD
// ==================================================================================


async function inicializarCardVencimentos() {
    const temAcessoFinanceiro = usuarioTemPermissaoFinanceiro();
    console.log("Usuário tem permissão Financeiro?", temAcessoFinanceiro);

    // 1. Seleciona o slot principal que será reutilizado
    const cardSlotPrincipal = document.getElementById('cardSlotPrincipal');
    
    // 2. Seleciona o template escondido com o conteúdo de Vencimentos
    const vencimentosTemplate = document.getElementById('vencimentosTemplate');

    if (!cardSlotPrincipal || !vencimentosTemplate) {
        console.warn("Elemento HTML essencial não encontrado (cardSlotPrincipal ou vencimentosTemplate).");
        return;
    }

    if (temAcessoFinanceiro) {
        // AÇÃO: Substituir o conteúdo do slot principal pelo template de Vencimentos.
        
        // 1. Clona o conteúdo do template (que é o HTML de Vencimentos)
        const vencimentosContent = vencimentosTemplate.content.cloneNode(true);
        
        // 2. O slot principal recebe o novo conteúdo (substituindo o de Orçamentos)
        cardSlotPrincipal.innerHTML = ''; // Limpa o conteúdo anterior
        cardSlotPrincipal.appendChild(vencimentosContent);
        
        // 3. Carrega os dados (atualizando os IDs injetados)
        carregarDadosVencimentos();
    } else {
        // AÇÃO: Manter o card de Orçamentos (que é o conteúdo inicial do slot)
        
        // 1. Remove o template para limpeza do DOM (opcional, já que <template> não renderiza)
        vencimentosTemplate.remove();
        
        // ℹ️ Se houver, chame aqui a função para carregar dados de Orçamentos
        // carregarDadosOrcamentos(); 
    }
}
async function carregarDadosVencimentos() {
    try {
        // ⚠️ PASSO 2: IMPLEMENTE O FETCH REAL DOS DADOS DE VENCIMENTOS
        // Use a sua função fetchComToken para obter os dados do backend.
        // const dados = await fetchComToken('/financeiro/dashboard/vencimentos');
        
        // Exemplo de dados de retorno:
        const dados = {
            proximos: 5, // Títulos a vencer nos próximos X dias
            atrasados: 2  // Títulos em atraso
        };
        
        document.getElementById('vencimentosProximos').textContent = dados.proximos;
        document.getElementById('vencimentosAtrasados').textContent = dados.atrasados;
    } catch (err) {
        console.error("Erro ao carregar dados de vencimentos:", err);
        // Em caso de erro, pode ser útil definir os valores como '-' ou manter '0'
        document.getElementById('vencimentosProximos').textContent = '-';
        document.getElementById('vencimentosAtrasados').textContent = '-';
    }
}




// ======================
// ABRIR AGENDA
// ======================
document.getElementById("card-agenda").addEventListener("click", async function() {
  const painel = document.getElementById("painelDetalhes");
  painel.innerHTML = "";

  const container = document.createElement("div");
  container.id = "agenda-container";
  container.className = "agenda-container";

  // HEADER
  const header = document.createElement("div");
  header.className = "agenda-header";

  const btnVoltar = document.createElement("button");
  btnVoltar.id = "btnVoltarAgenda";
  btnVoltar.className = "btn-voltar";
  btnVoltar.textContent = "←";

  const titulo = document.createElement("h2");
  titulo.textContent = "Agenda Pessoal";

  header.appendChild(btnVoltar);
  header.appendChild(titulo);
  container.appendChild(header);

  // ===== CONTEÚDO GERAL =====
  const conteudoGeral = document.createElement("div");
  conteudoGeral.className = "conteudo-geral";

  // ===== CALENDÁRIO =====
  const calendarioDiv = document.createElement("div");
  calendarioDiv.className = "agenda-calendario";
  calendarioDiv.id = "calendarioVertical";

  // --- SELECT DE MÊS ---
  const seletorMes = document.createElement("select");
  seletorMes.id = "seletorMes";
  seletorMes.className = "select-mes";

  const meses = [
    "Janeiro", "Fevereiro", "Março", "Abril",
    "Maio", "Junho", "Julho", "Agosto",
    "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  meses.forEach((mes, index) => {
    const option = document.createElement("option");
    option.value = index;
    option.textContent = mes;
    seletorMes.appendChild(option);
  });

  seletorMes.value = new Date().getMonth();
  calendarioDiv.appendChild(seletorMes);

  // container dos dias
  const diasDiv = document.createElement("div");
  diasDiv.id = "diasCalendario";
  diasDiv.className = "dias-calendario";
  calendarioDiv.appendChild(diasDiv);

  // ===== CONTEÚDO =====
  const conteudo = document.createElement("div");
  conteudo.className = "agenda-conteudo";

  const dataSelecionada = document.createElement("h3");
  dataSelecionada.id = "dataSelecionada";
  dataSelecionada.textContent = "Selecione um dia";
  conteudo.appendChild(dataSelecionada);

  const listaEventos = document.createElement("ul");
  listaEventos.id = "listaEventosDia";
  conteudo.appendChild(listaEventos);

  const btnAdicionar = document.createElement("button");
  btnAdicionar.id = "btnAdicionarEvento";
  btnAdicionar.className = "btn-adicionar";
  btnAdicionar.textContent = "+ Novo Evento";
  conteudo.appendChild(btnAdicionar);

  conteudoGeral.appendChild(calendarioDiv);
  conteudoGeral.appendChild(conteudo);
  container.appendChild(conteudoGeral);
  painel.appendChild(container);

  // =======================
  // EVENTOS E CALENDÁRIO
  // =======================
  if (typeof window.eventosSalvos === "undefined") window.eventosSalvos = [];

  // 🔹 Carrega os eventos salvos no banco
  window.eventosSalvos = await carregarAgendaUsuario();
  console.log("Eventos carregados no frontend:", window.eventosSalvos)

  gerarCalendarioMensal(parseInt(seletorMes.value, 10));

  seletorMes.addEventListener("change", function() {
    gerarCalendarioMensal(parseInt(this.value, 10));
  });

  btnVoltar.addEventListener("click", function() {
    painel.innerHTML = "";
  });

  btnAdicionar.addEventListener("click", abrirPopupNovoEvento);
});

// ==================================================================================
// GERA CALENDÁRIO MENSAL
// ==================================================================================
function gerarCalendarioMensal(mesParam) {
  const diasDiv = document.getElementById("diasCalendario");
  if (!diasDiv) return;
  diasDiv.innerHTML = "";

  const ano = new Date().getFullYear();
  const mes = typeof mesParam === "number" ? mesParam : new Date().getMonth();
  const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();

  diasDiv.classList.add("grade-calendario");

  // 🔹 Função auxiliar para garantir comparação local (sem UTC)
  function formatarDataLocal(data) {
    const d = new Date(data);
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, "0");
    const dia = String(d.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
  }

  // Preenche dias vazios no início
  for (let i = 0; i < primeiroDiaSemana; i++) {
    const vazio = document.createElement("div");
    vazio.className = "dia vazio";
    diasDiv.appendChild(vazio);
  }

  // Gera cada dia do mês
  for (let dia = 1; dia <= diasNoMes; dia++) {
    const data = new Date(ano, mes, dia);
    const dataISO = formatarDataLocal(data); // agora em horário local
    const div = document.createElement("div");
    div.className = "dia";
    div.dataset.date = dataISO;
    div.textContent = dia;

    // 🔹 Verifica se há eventos nesse dia
    const eventosDia = (window.eventosSalvos || []).filter(
      ev => formatarDataLocal(ev.data_evento) === dataISO
    );

    if (eventosDia.length > 0) {
      const indicador = document.createElement("span");
      indicador.className = "indicador-evento";
      div.appendChild(indicador);
    }

    div.addEventListener("click", function() {
      selecionarDia(this, data);
    });

    diasDiv.appendChild(div);
  }

  // 🔹 Destaca o dia atual
  const hoje = new Date();
  if (hoje.getFullYear() === ano && hoje.getMonth() === mes) {
    const hojeStr = formatarDataLocal(hoje);
    const hojeDiv = diasDiv.querySelector(`div[data-date="${hojeStr}"]`);
    if (hojeDiv) {
      hojeDiv.classList.add("dia-atual");
      selecionarDia(hojeDiv, hoje);
    }
  }
}

// ==================================================================================
// SELEÇÃO DE DIA
// ==================================================================================
function selecionarDia(div, data) {
  const calendario = document.getElementById("diasCalendario");
  if (calendario) {
    calendario.querySelectorAll(".dia").forEach(d => d.classList.remove("selecionado"));
  }
  div.classList.add("selecionado");

  const dataTexto = data.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  const tituloFormatado = dataTexto.charAt(0).toUpperCase() + dataTexto.slice(1);
  const elDataSelecionada = document.getElementById("dataSelecionada");
  if (elDataSelecionada) elDataSelecionada.textContent = tituloFormatado;

  carregarEventosDoDia(data);
}

// ==================================================================================
// CARREGA EVENTOS DO DIA
// ==================================================================================
function carregarEventosDoDia(data) {
  const lista = document.getElementById("listaEventosDia");
  if (!lista) return;
  lista.innerHTML = "";

  // 🔹 Função auxiliar para normalizar datas (sem UTC)
  function formatarDataLocal(data) {
    const d = new Date(data);
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, "0");
    const dia = String(d.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
  }

  const dataStr = formatarDataLocal(data);

  // 🔹 Agora a filtragem ignora o fuso horário
  const eventosDia = (window.eventosSalvos || []).filter(
    ev => formatarDataLocal(ev.data_evento) === dataStr
  );

  if (eventosDia.length === 0) {
    const li = document.createElement("li");
    li.textContent = "Nenhum evento para este dia.";
    li.style.color = "#777";
    lista.appendChild(li);
  } else {
    eventosDia.forEach(ev => {
      const li = document.createElement("li");
      li.className = "evento-item";

      let icone = "";
      if (ev.tipo === "Reunião") {
        icone = `<svg class="icon" viewBox="0 0 24 24">
          <g stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/>
            <path d="M16 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/>
            <path d="M2 20a6 6 0 0 1 12 0"/>
            <path d="M10 20a6 6 0 0 1 12 0"/>
            <path d="M12 14c-1.5 0-3 .5-4 1.5"/>
          </g>
        </svg>`;
      } else if (ev.tipo === "Lembrete") {
        icone = `<svg class="icon" viewBox="0 0 24 24">
          <g stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="14" height="16" rx="2"/>
            <path d="M7 8h8"/>
            <path d="M16 5v2"/>
          </g>
        </svg>`;
      } else if (ev.tipo === "Anotação") {
        icone = `<svg class="icon" viewBox="0 0 24 24">
          <g stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 3h10l6 6v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/>
            <path d="M14 3v6h6"/>
            <path d="M8 13h8"/>
            <path d="M8 16h5"/>
          </g>
        </svg>`;
      }

      li.innerHTML = `
        ${icone}
        <div class="evento-info">
          <strong>${ev.tipo || "Evento"}</strong> - ${ev.titulo || ""}
          <br>
          <small>${ev.hora_evento || ""} ${ev.descricao ? " | " + ev.descricao : ""}</small>
        </div>
      `;
      lista.appendChild(li);
    });
  }
}


// ==================================================================================
// POPUP DE NOVO EVENTO
// ==================================================================================
function abrirPopupNovoEvento() {
  const overlay = document.createElement("div");
  overlay.className = "popup-overlay";

  const popup = document.createElement("div");
  popup.className = "popup-agenda";

  const diaSelecionado = document.querySelector(".agenda-calendario .dia.selecionado");
  const dataDefault = diaSelecionado
    ? diaSelecionado.dataset.date
    : new Date().toISOString().split("T")[0];

  const agora = new Date();
  const horaDefault = agora.toTimeString().slice(0, 5);

  popup.innerHTML = `
    <h3>Novo Evento</h3>
    <label>Tipo:</label>
    <select id="tipoEvento">
      <option value="Evento">Evento</option>
      <option value="Reunião">Reunião</option>
      <option value="Lembrete">Lembrete</option>
      <option value="Anotação">Anotação</option>
    </select>

    <label>Título:</label>
    <input type="text" id="tituloEvento" placeholder="Título do evento">

    <label>Data:</label>
    <input type="date" id="dataEvento" value="${dataDefault}">

    <label>Hora:</label>
    <input type="time" id="horaEvento" value="${horaDefault}">

    <label>Descrição:</label>
    <textarea id="descricaoEvento" placeholder="Detalhes..."></textarea>

    <div class="popup-botoes">
      <button id="btnSalvarEvento">Salvar</button>
      <button id="btnCancelarEvento">Cancelar</button>
    </div>
  `;

  overlay.appendChild(popup);
  document.body.appendChild(overlay);

  document.getElementById("btnCancelarEvento").addEventListener("click", () => overlay.remove());

  document.getElementById("btnSalvarEvento").addEventListener("click", async () => {
    const tipo = document.getElementById("tipoEvento").value;
    const titulo = document.getElementById("tituloEvento").value.trim();
    const data = document.getElementById("dataEvento").value;
    const hora = document.getElementById("horaEvento").value;
    const descricao = document.getElementById("descricaoEvento").value.trim();

    if (!titulo || !data) {
      alert("Preencha pelo menos o título e a data!");
      return;
    }

    const novoEvento = await salvarEventoAgenda({
      tipo,
      titulo,
      data_evento: data,
      hora_evento: hora,
      descricao
    });

    window.eventosSalvos.push(novoEvento);
    overlay.remove();

    carregarEventosDoDia(new Date(data));
  });
}

// ==================================================================================
// FUNÇÕES DE INTEGRAÇÃO COM O BACKEND
// ==================================================================================
async function salvarEventoAgenda(dadosEvento) {
  try {
    const json = await fetchComToken("/main/agenda", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...dadosEvento,
        tipo: dadosEvento.tipo || "Evento" // 🔹 garante tipo padrão
      })
    });

    Swal.fire({
      title: "Evento salvo!",
      text: `O evento "${dadosEvento.titulo}" foi adicionado à sua agenda.`,
      icon: "success",
      confirmButtonText: "Ok",
      confirmButtonColor: "#3085d6",
      timer: 2500,
      timerProgressBar: true
    });

    return json; // 🔹 aqui já é o JSON retornado
  } catch (err) {
    console.error("Erro ao salvar evento:", err);
    alert("Erro ao salvar evento.");
  }
}

async function carregarAgendaUsuario() {
  try {
    const eventos = await fetchComToken("/main/agenda");
    console.log("Eventos carregados no frontend:", eventos);
    return eventos || [];
  } catch (err) {
    console.error("Erro ao buscar agenda:", err);
    return [];
  }
}


// Chame na inicialização:
document.addEventListener("DOMContentLoaded", async function () {
  await atualizarResumo();
  await atualizarEventosEmAberto();
  await atualizarProximoEvento();
  await inicializarCardVencimentos();
});




