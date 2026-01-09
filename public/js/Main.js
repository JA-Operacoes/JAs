import { fetchComToken, aplicarTema, fetchHtmlComToken  } from '/utils/utils.js';


const CAMPO_ADITIVO_EXTRA = "statusaditivoextra"; 
const STATUS_PENDENTE = "pendente";
const STATUS_AUTORIZADO = "autorizado";
const STATUS_REJEITADO = "rejeitado";

const camposObrigatorios = [
    "status_ajuste_custo", 
    "status_caixinha", 
    "status_meia_diaria", 
    "status_diaria_dobrada", 
    CAMPO_ADITIVO_EXTRA // Deve ser 'statusaditivoextra'
];

const getRecordIdFromUrl = (url) => {
  const parts = url.split('/');
  const lastPart = parts[parts.length - 1];
  // Retorna o último segmento se for um número, caso contrário retorna null
  return !isNaN(parseInt(lastPart)) ? lastPart : null;
};



// async function abrirModalLocal(url, modulo) {
//   if (!modulo) modulo = window.moduloAtual || "Staff";
//   console.log("[abrirModalLocal] iniciar:", { modulo, url });

//   let html;
//   try {
//   console.log("[abrirModalLocal] fetchHtmlComToken ->", url);
//   html = await fetchHtmlComToken(url);
//   console.log("[abrirModalLocal] HTML recebido, tamanho:", html ? html.length : 0);
//   } catch (err) {
//   console.error("[abrirModalLocal] Erro ao carregar modal (local):", err);
//   return;
//   }

//   const container = document.getElementById("modal-container");
//   if (!container) {
//   console.error("[abrirModalLocal] modal-container não encontrado no DOM.");
//   return;
//   }

//   // injeta HTML do modal
//   container.innerHTML = html;
//   console.log("[abrirModalLocal] HTML injetado no #modal-container");

//   // remove script anterior se existir
//   const scriptId = 'scriptModuloDinamico';
//   const scriptAntigo = document.getElementById(scriptId);
//   if (scriptAntigo) {
//   scriptAntigo.remove();
//   console.log("[abrirModalLocal] script anterior removido");
//   }

//   // carrega script do módulo (Staff.js por exemplo)
//   const scriptName = modulo.charAt(0).toUpperCase() + modulo.slice(1) + ".js";
//   const scriptSrc = `js/${scriptName}`;

//   // cria promise para aguardar load / execução do módulo
//   await new Promise((resolve, reject) => {
//   console.log("[abrirModalLocal] carregando script do módulo:", scriptSrc);
//   const script = document.createElement("script");
//   script.id = scriptId;
//   script.src = scriptSrc;
//   script.defer = true;
//   script.type = "module";

//   script.onload = () => {
//   // aguarda um tick para garantir execução de exports/global assignments
//   setTimeout(() => {
//   console.log(`[abrirModalLocal] Script ${scriptName} carregado e executado.`);
//   resolve();
//   }, 50);
//   };
//   script.onerror = (e) => {
//   console.error(`[abrirModalLocal] Erro ao carregar script ${scriptSrc}`, e);
//   reject(new Error(`Erro ao carregar script ${scriptSrc}`));
//   };
//   document.body.appendChild(script);
//   }).catch(err => {
//   console.error("[abrirModalLocal] falha ao carregar script do módulo:", err);
//   return;
//   });

//   // =========================================================================
//   // 🎯 PONTO DE INSERÇÃO: BUSCA DE DADOS E CARREGAMENTO DE DATAS (Edição)
//   // =========================================================================
//   const recordId = getRecordIdFromUrl(url);

//   console.log("RECORD ID", recordId);

//   if (recordId) {
//   try {
//   // 1. Busca os dados do Staff/Evento (Assumindo que o endpoint é: /staff/data/ID)
//   const dataUrl = `/${modulo.toLowerCase()}/data/${recordId}`; 
//   const staffData = await fetchComToken(dataUrl);
//   console.log("[abrirModalLocal] Dados do Staff para edição carregados:", staffData);


//   if (staffData) {
//   // Expõe os dados para que o applyModalPrefill ou o Staff.js possam usá-los
//   window.__modalFetchedData = staffData;

//   const datasOrcamento = staffData.datasOrcamento.map(item => item.data); // Array de datas no formato "YYYY-MM-DD"
//   console.log("[abrirModalLocal] Datas do orçamento extraídas:", datasOrcamento);

//   const datasDoStaff = staffData.datasevento;

//   // 2. Preenchimento do Flatpickr
//   // Deve usar window.datasEventoPicker (a instância global do Flatpickr)
// //  if (window.datasEventoPicker && datasDoStaff && Array.isArray(datasDoStaff)) {
// //   // Define as datas. 'true' garante que o evento 'onChange' dispare o debouncedOnCriteriosChanged.
// //   window.datasEventoPicker.setDate(datasDoStaff, true);
// //   console.log(`[abrirModalLocal] Datas carregadas no Flatpickr: ${datasDoStaff.length} dias.`);
// //   } else {
// //   console.warn("[abrirModalLocal] Flatpickr ou dados de staff (datasevento) ausentes/inválidos.", { picker: !!window.datasEventoPicker, data: datasDoStaff });
// //   }

//   // 3. (Opcional) Chamar o debounce para garantir o carregamento do orçamento
//   if (typeof window.debouncedOnCriteriosChanged === 'function') {
//   window.debouncedOnCriteriosChanged();
//   console.log("[abrirModalLocal] Verificação de orçamento (debounce) chamada.");
//   }

//   // 4. (Opcional) Disparar um evento para o Staff.js preencher os outros campos
//   document.dispatchEvent(new CustomEvent("modal:data:loaded", { detail: staffData }));

//   }
//   } catch (error) {
//   console.error(`[abrirModalLocal] Erro ao carregar dados do ${modulo} (ID: ${recordId}):`, error);
//   }
//   }
//   // =========================================================================

//   // mostra modal (espera elemento modal injetado)
//   const modal = document.querySelector("#modal-container .modal");
//   const overlay = document.getElementById("modal-overlay");
//   if (modal && overlay) {
//   modal.style.display = "block";
//   overlay.style.display = "block";
//   document.body.classList.add("modal-open");
//   console.log("[abrirModalLocal] modal exibido");

//   // fechar por overlay
//   overlay.addEventListener("mousedown", (event) => {
//   if (event.target === overlay) {
//   console.log("[abrirModalLocal] overlay clicado -> fechar");
//   if (typeof fecharModal === "function") {
//   fecharModal();
//   window.location.reload();
//   } else {
//   overlay.style.display = "none";
//   container.innerHTML = "";
//   document.body.classList.remove("modal-open");
//   // Chama o callback AQUI
//   if (typeof window.onStaffModalClosed === 'function') {
//   window.onStaffModalClosed(false);
//   }
//   }
//   }
//   });

//   // modal.querySelector(".close")?.addEventListener("click", () => {
//   //   console.log("[abrirModalLocal] fechar (botão X)");
//   //   if (typeof fecharModal === "function") fecharModal();
//   //   else {
//   //   overlay.style.display = "none";
//   //   container.innerHTML = "";
//   //   document.body.classList.remove("modal-open");
//   //   }
//   // });

//   modal.querySelector(".close")?.addEventListener("click", () => {
//     console.log("[abrirModalLocal] fechar (botão X)");

//     // Se a função global existir, use-a para garantir o comportamento de callback.
//     if (typeof fecharModal === "function") {
//       fecharModal(); 
//       window.location.reload();
//     } else {
//     // Fallback de fechamento, e aqui você DEVE incluir o callback.
//       overlay.style.display = "none";
//       container.innerHTML = "";
//       document.body.classList.remove("modal-open");
//       // Chama o callback AQUI para garantir que a tela volte, mesmo sem a função fecharModal
//       if (typeof window.onStaffModalClosed === 'function') {
//         window.onStaffModalClosed(false); // false indica que não foi fechado pela função principal, mas ainda deve voltar
//       }
//       window.location.reload();
//     }
//     // A linha de window.location.reload() FOI REMOVIDA.
//     });
//     } else {
//     console.warn("[abrirModalLocal] estrutura de modal não encontrada após injeção do HTML.");
//     }

//   // --- Inicializa o módulo carregado ---
//   try {
//   console.log("[abrirModalLocal] inicializando módulo:", modulo);

//   // 1) preferencial: handler registrado pelo módulo (window.moduloHandlers)
//   if (window.moduloHandlers && window.moduloHandlers[modulo] && typeof window.moduloHandlers[modulo].configurar === "function") {
//   console.log("[abrirModalLocal] chamando window.moduloHandlers[...] .configurar");
//   window.moduloHandlers[modulo].configurar();
//   } else if (typeof window.configurarEventosEspecificos === "function") {
//   console.log("[abrirModalLocal] chamando window.configurarEventosEspecificos");
//   window.configurarEventosEspecificos(modulo);
//   } else if (typeof window.configurarEventosStaff === "function" && modulo.toLowerCase() === "staff") {
//   console.log("[abrirModalLocal] chamando window.configurarEventosStaff");
//   window.configurarEventosStaff();
//   } else {
//   console.log("[abrirModalLocal] nenhuma função de configuração detectada");
//   }

//   // setTimeout(() => {
//   //   console.log("[abrirModalLocal] Inicializando Flatpickr com limites após atraso.");
//   //   window.inicializarFlatpickrStaffComLimites();
//   // }, 100); 

//   setTimeout(() => {
//   if (typeof window.configurarEventosStaff === "function") {
//   console.log("[abrirModalLocal] Chamando configurarEventosStaff após atraso.");
//   window.configurarEventosStaff();
//   }
//   }, 100); 

//   // 4) tenta aplicar prefill imediato (se o módulo já injetou selects/inputs)
//   setTimeout(() => {
//   try {
//   console.log("[abrirModalLocal] tentando applyModalPrefill imediato");
//   if (typeof window.applyModalPrefill === "function") {
//   const ok = window.applyModalPrefill(window.__modalInitialParams || "");
//   console.log("[abrirModalLocal] applyModalPrefill retornou:", ok);
//   } else {
//   const evt = new CustomEvent("modal:prefill", { detail: window.__modalInitialParams || "" });
//   document.dispatchEvent(evt);
//   console.log("[abrirModalLocal] evento modal:prefill disparado");
//   }
//   } catch (e) {
//   console.warn("[abrirModalLocal] prefill falhou", e);
//   }
//   }, 800); //80

//   // pequena garantia: re-tentar inicialização caso o módulo popule DOM com atraso
//   setTimeout(() => {
//     try {
//     if (window.moduloHandlers && window.moduloHandlers[modulo] && typeof window.moduloHandlers[modulo].configurar === "function") {
//       console.log("[abrirModalLocal] re-executando moduloHandlers.configurar (retry)");
//       window.moduloHandlers[modulo].configurar();
//       }
//     } catch (e) { console.warn("[abrirModalLocal] retry configurar falhou", e); }
//   }, 400);

//     setTimeout(() => {
//       const staffData = window.__modalFetchedData;
//       const datasDoStaff = staffData?.datasevento; // Usa optional chaining para segurança

//       // Verifica se o picker e os dados existem
//       if (window.datasEventoPicker && datasDoStaff && Array.isArray(datasDoStaff)) {

//         // Define as datas, disparando onChange (necessário para sincronizar com Diária Dobrada/Meia Diária)
//           window.datasEventoPicker.setDate(datasDoStaff, true); 

//         // 🌟 GARANTIA DE FORMATO: Força a re-renderização do altInput
//         // Isso resolve o problema de YYYY-MM-DD e múltiplos campos.
//           if (window.datasEventoPicker.altInput) {
//             window.datasEventoPicker.altInput.value = window.datasEventoPicker.formatDate(
//             window.datasEventoPicker.selectedDates, 
//             window.datasEventoPicker.config.altFormat
//             );
//           }

//           console.log(`[abrirModalLocal] [SetDate Seguro] Datas carregadas no Flatpickr: ${datasDoStaff.length} dias, formato corrigido.`);

//           } else {
//             console.warn("[abrirModalLocal] [SetDate Seguro] Flatpickr ou dados de staff (datasevento) ausentes/inválidos.");
//           }
//     }, 500);
//   } catch (err) {
//     console.warn("[abrirModalLocal] inicialização do módulo apresentou erro", err);
//   }
// }

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

                // 2. Preenchimento do Flatpickr (COMENTADO PARA SER FEITO NO SEGUNDO SETTIMEOUT DE 500MS)
                // Se o picker não estiver pronto neste momento, o bloco de 500ms fará o preenchimento.

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
                    // 🟢 CORREÇÃO: RECARREGA A PÁGINA
                    window.location.reload(); 
                } else {
                    overlay.style.display = "none";
                    container.innerHTML = "";
                    document.body.classList.remove("modal-open");
                    // Chama o callback AQUI
                    if (typeof window.onStaffModalClosed === 'function') {
                        window.onStaffModalClosed(false);
                    }
                    // 🟢 CORREÇÃO: RECARREGA A PÁGINA (Fallback)
                    window.location.reload();
                }
            }
        });

        // fechar por botão ".close"
        modal.querySelector(".close")?.addEventListener("click", () => {
            console.log("[abrirModalLocal] fechar (botão X)");

            // Se a função global existir, use-a para garantir o comportamento de callback.
            if (typeof fecharModal === "function") {
                fecharModal();
                // 🟢 CORREÇÃO: RECARREGA A PÁGINA
                window.location.reload();
            } else {
                // Fallback de fechamento, e aqui você DEVE incluir o callback.
                overlay.style.display = "none";
                container.innerHTML = "";
                document.body.classList.remove("modal-open");
                // Chama o callback AQUI para garantir que a tela volte, mesmo sem a função fecharModal
                if (typeof window.onStaffModalClosed === 'function') {
                    window.onStaffModalClosed(false); // false indica que não foi fechado pela função principal, mas ainda deve voltar
                }
                // 🟢 CORREÇÃO: RECARREGA A PÁGINA (Fallback)
                window.location.reload();
            }
        });
    } else {
        console.warn("[abrirModalLocal] estrutura de modal não encontrada após injeção do HTML.");
    }

    // --- Inicializa o módulo carregado (LÓGICA LIMPA) ---
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

        // ❌ Bloco de 100ms removido para evitar a duplicação na inicialização.

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
        }, 800);

        // pequena garantia: re-tentar inicialização caso o módulo popule DOM com atraso
        // setTimeout(() => {
        //     try {
        //         if (window.moduloHandlers && window.moduloHandlers[modulo] && typeof window.moduloHandlers[modulo].configurar === "function") {
        //             console.log("[abrirModalLocal] re-executando moduloHandlers.configurar (retry 400ms)");
        //             window.moduloHandlers[modulo].configurar();
        //         }
        //     } catch (e) { console.warn("[abrirModalLocal] retry configurar falhou", e); }
        // }, 400);

        // 🌟 Bloco de preenchimento do Flatpickr (500ms) - Garante que o Flatpickr esteja pronto
        setTimeout(() => {
            const staffData = window.__modalFetchedData;
            const datasDoStaff = staffData?.datasevento; // Usa optional chaining para segurança

            // Verifica se o picker e os dados existem
            if (window.datasEventoPicker && datasDoStaff && Array.isArray(datasDoStaff)) {

                // Define as datas, disparando onChange (necessário para sincronizar com Diária Dobrada/Meia Diária)
                window.datasEventoPicker.setDate(datasDoStaff, true);

                if (typeof window.atualizarContadorEDatas === 'function') {
                    // Chama a função de atualização do contador com as datas do staff
                    window.atualizarContadorEDatas(window.datasEventoPicker.selectedDates);
                    console.log("[abrirModalLocal] Contador de datas do evento atualizado após SetDate.");
                }

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

function podeVisualizarTudo() {
    // Se for Master OU tiver permissão Financeiro, pode ver tudo.
    return usuarioTemPermissao() || usuarioTemPermissaoFinanceiro();
}
// Evento no card financeiro
const cardFinanceiro = document.querySelector(".card-financeiro");
if (cardFinanceiro) {
  cardFinanceiro.addEventListener("click", async () => {
  await mostrarPedidosUsuario();
  });
}

// =========================
//   Atividades
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
//  Eventos 
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
  <div><label>Ano: <select id="anoSelect"></select></label></div>
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


// =========================
//   Eventos em Aberto  
// =========================
document.addEventListener("DOMContentLoaded", function () {
  const cardEventos = document.querySelector(".card-eventos-em-abertos");

  if (cardEventos) {
  cardEventos.addEventListener("click", function () {
  mostrarEventosEmAberto(); // renderiza só ao clicar
  });
  }
});

function criarFiltroAnoCustom() {
    const anoAtual = new Date().getFullYear();
    const anos = [anoAtual, anoAtual - 1, anoAtual - 2]; 

    const filtroContainer = document.createElement("div");
    // Mantemos as classes para o alinhamento do Flexbox e respiros
    filtroContainer.className = "filtros-fechados"; 
    filtroContainer.innerHTML = `
        <label class="label-select-fechado">Filtrar por Ano</label>
        <div class="wrapper-select-custom"> 
            <select id="filtroAnoSelect" class="select-simples">
                ${anos.map(ano => `
                    <option value="${ano}">${ano}</option>
                `).join("")}
            </select>
        </div>
    `;
    return filtroContainer;
}

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

// const FiltrosVencimentos = criarControlesDeFiltro();
// container.appendChild(FiltrosVencimentos); 

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
        const target = btn.dataset.target; 
        const targetEl = document.getElementById(target);
        const idempresa = localStorage.getItem("idempresa");

        // 1. Troca visual de abas
        abas.querySelectorAll(".aba").forEach(b => b.classList.remove("ativo"));
        btn.classList.add("ativo");
        conteudos.querySelectorAll(".conteudo-aba").forEach(c => c.classList.remove("ativo"));
        targetEl.classList.add("ativo");

        // 2. Lógica para Encerrados (Finalizados)
        if (target === "finalizados") {
            targetEl.innerHTML = ""; // Limpa anterior

            // Renderiza o componente Select
            const filtroAnoCont = criarFiltroAnoCustom();
            targetEl.appendChild(filtroAnoCont);

            // Container onde a lista de cards aparecerá
            const listaCont = document.createElement("div");
            listaCont.className = "lista-eventos-fechados";
            targetEl.appendChild(listaCont);

            const carregarDadosFechados = async () => {
                const select = document.getElementById("filtroAnoSelect");
                const ano = select ? select.value : new Date().getFullYear();
                
                listaCont.innerHTML = `<div class="loading-spinner">Carregando eventos de ${ano}...</div>`;
                
                try {
                    const resp = await fetchComToken(`/main/eventos-fechados?ano=${ano}`, { headers: { idempresa } });
                    const eventos = resp && typeof resp.json === 'function' ? await resp.json() : resp;
                    
                    // Usa sua função existente de renderização para manter os cards e alertas
                    renderizarEventos(listaCont, eventos);
                } catch (err) {
                    console.error("Erro ao carregar encerrados:", err);
                    listaCont.innerHTML = `<div class="erro-carregar">Erro ao buscar eventos de ${ano}.</div>`;
                }
            };

            // Evento de mudança no Select
            const selectElement = filtroAnoCont.querySelector("#filtroAnoSelect");
            selectElement.addEventListener("change", carregarDadosFechados);

            // Carga inicial do ano atual
            carregarDadosFechados();

        } else {
            // 3. Lógica para Abertos (Se clicar de volta)
            if (!targetEl.dataset.populado) {
                targetEl.innerHTML = `<div class="loading-spinner">Carregando abertos...</div>`;
                try {
                    const resp = await fetchComToken(`/main/eventos-abertos`, { headers: { idempresa } });
                    const eventos = resp && typeof resp.json === 'function' ? await resp.json() : resp;
                    renderizarEventos(targetEl, eventos);
                    targetEl.dataset.populado = "1";
                } catch (err) {
                    targetEl.innerHTML = `<div class="erro-carregar">Erro ao buscar abertos.</div>`;
                }
            }
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
  const resumoEquipes = evt.resumoEquipes || "Nenhuma equipe cadastrada";


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
  sanitize(cleanAndNormalize(row.nome)),   // Limpeza
  sanitize(cleanAndNormalize(row.setor)), // Limpeza
  sanitize(cleanAndNormalize(row.status_pagamento)),   // Limpeza
  sanitize(valorTotalFormatado),   // Formato para moeda
  sanitize(cleanAndNormalize(row.nivelexperiencia)),   // Limpeza
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
    
    // Tenta pegar o ano da data do evento, se não existir, usa o ano atual
    const dataRef = evento.inicio_realizacao || evento.dtinirealizacao || new Date();
    const ano = new Date(dataRef).getFullYear();

    if (!idevento || !idequipe || !idempresa) {
      corpo.innerHTML = `<p class="erro">Erro: Dados incompletos (Evento: ${idevento}, Equipe: ${idequipe}, Empresa: ${idempresa}).</p>`;
      return;
    }

    // Adicionado idempresa e ano na query string para bater com o que o backend espera
    const url = `/main/ListarFuncionarios?idEvento=${idevento}&idEquipe=${idequipe}&idempresa=${idempresa}&ano=${ano}`;
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
  <span class="grupo-periodo">Status</span>
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
//    Pedidos Orçamentos 
// =========================

function montarOpcoesOrc(titulo, valores, conteudoGeral) {
    return `
        <label class="label-select">${titulo}</label>
        <div class="wrapper" style="width: ${valores.length * 90}px;">
            ${valores.map(v => `
                <div class="option" style="width: 80px;">
                    <input value="${v.value}" name="subOrc" type="radio" class="input" ${v.checked ? "checked" : ""} />
                    <div class="btn"><span class="span">${v.label}</span></div>
                </div>
            `).join("")}
        </div>`;
}

function construirParametrosOrcamentos() {
    const status = document.querySelector("input[name='statusOrc']:checked")?.value || 'aberto';
    const periodo = document.querySelector("input[name='periodoOrc']:checked")?.value || 'diario';
    const anoAtual = new Date().getFullYear();

    let query = `?status=${status}&periodo=${periodo}&ano=${anoAtual}`;

    const subData = document.querySelector("#sub-filtro-data-orc")?.value;
    const subSelect = document.querySelector("#sub-filtro-select-orc")?.value;
    const subRadio = document.querySelector("input[name='subOrc']:checked")?.value;

    if (subData) query += `&dataRef=${subData}`;
    if (subSelect) query += `&mes=${subSelect}`;
    if (subRadio) {
        if (periodo === 'trimestral') query += `&trimestre=${subRadio}`;
        if (periodo === 'semestral') query += `&semestre=${subRadio}`;
    }

    return query;
}

// --- CORE DOS FILTROS ---

function criarFiltrosOrcamentoCompletos(conteudoGeral) {
    const filtrosContainer = document.createElement("div");
    filtrosContainer.className = "filtros-vencimentos venc-container"; 

    const wrapperUnificado = document.createElement("div");
    wrapperUnificado.style.display = "flex";
    wrapperUnificado.style.flexWrap = "wrap";
    wrapperUnificado.style.gap = "20px";

    // 1. Grupo Status
    const grupoStatus = document.createElement("div");
    grupoStatus.className = "filtro-grupo";
    grupoStatus.innerHTML = `
        <label class="label-select">Nível do Orçamento</label>
        <div class="wrapper" style="width: 350px;"> 
            ${['Aberto', 'Negociação', 'Aprovado', 'Fechado', 'Recusado'].map((s, i) => `
                <div class="option" style="width: 50px;">
                    <input ${i === 0 ? 'checked' : ''} value="${s.toLowerCase()}" name="statusOrc" type="radio" class="input" />
                    <div class="btn"><span class="span">${s}</span></div>
                </div>
            `).join('')}
        </div>`;

    // 2. Grupo Período
    const grupoPeriodo = document.createElement("div");
    grupoPeriodo.className = "filtro-grupo";
    grupoPeriodo.innerHTML = `
        <label class="label-select">Período</label>
        <div class="wrapper" style="width: 300px;">
            <div class="option" style="width: 30px;"><input checked value="diario" name="periodoOrc" type="radio" class="input" /><div class="btn"><span class="span">Diário</span></div></div>
            <div class="option" style="width: 30px;"><input value="semanal" name="periodoOrc" type="radio" class="input" /><div class="btn"><span class="span">Semanal</span></div></div>
            <div class="option" style="width: 30px;"><input value="mensal" name="periodoOrc" type="radio" class="input" /><div class="btn"><span class="span">Mensal</span></div></div>
            <div class="option" style="width: 30px;"><input value="trimestral" name="periodoOrc" type="radio" class="input" /><div class="btn"><span class="span">Trimestral</span></div></div>
            <div class="option" style="width: 30px;"><input value="anual" name="periodoOrc" type="radio" class="input" /><div class="btn"><span class="span">Anual</span></div></div>
        </div>`;

    const subFiltroWrapper = document.createElement("div");
    subFiltroWrapper.id = "sub-filtro-orc-wrapper";
    subFiltroWrapper.className = "filtro-grupo";

    wrapperUnificado.appendChild(grupoStatus);
    wrapperUnificado.appendChild(grupoPeriodo);
    wrapperUnificado.appendChild(subFiltroWrapper);
    filtrosContainer.appendChild(wrapperUnificado);

    const atualizarSubFiltroInterno = (tipo) => {
        subFiltroWrapper.innerHTML = "";
        const anoAtual = new Date().getFullYear();

        if (tipo === "diario" || tipo === "semanal") {
            const hoje = new Date().toISOString().split("T")[0];
            subFiltroWrapper.innerHTML = `
                <label class="label-select">Data Base</label>
                <div class="wrapper select-wrapper">
                    <input type="date" id="sub-filtro-data-orc" class="input-data-simples" value="${hoje}">
                </div>`;
        } 
        else if (tipo === "mensal") {
            let options = "";
            for (let i = 1; i <= 12; i++) {
                // Aqui usamos a sua função nomeDoMes global
                options += `<option value="${i}" ${i === (new Date().getMonth()+1) ? 'selected' : ''}>${nomeDoMes(i)} / ${anoAtual}</option>`;
            }
            subFiltroWrapper.innerHTML = `<label class="label-select">Mês</label><div class="wrapper select-wrapper"><select id="sub-filtro-select-orc" class="select-simples">${options}</select></div>`;
        }
        else if (tipo === "trimestral") {
            const trimes = [1,2,3,4].map(t => ({ value: t, label: `T${t} / ${anoAtual}`, checked: t === Math.ceil((new Date().getMonth()+1)/3) }));
            subFiltroWrapper.innerHTML = montarOpcoesOrc("Trimestre", trimes);
        }
        else if (tipo === "anual") {
            subFiltroWrapper.innerHTML = `<label class="label-select">Ano Vigente</label><div class="wrapper select-wrapper"><select id="sub-filtro-select-orc" class="select-simples"><option value="${anoAtual}">${anoAtual}</option></select></div>`;
        }

        subFiltroWrapper.querySelectorAll("input, select").forEach(el => {
            el.addEventListener("change", () => carregarDetalhesOrcamentos(conteudoGeral));
        });
    };

    [grupoStatus, grupoPeriodo].forEach(g => {
        g.querySelectorAll("input").forEach(i => i.addEventListener("change", (e) => {
            if(e.target.name === 'periodoOrc') atualizarSubFiltroInterno(e.target.value);
            carregarDetalhesOrcamentos(conteudoGeral);
        }));
    });

    atualizarSubFiltroInterno("diario");
    return filtrosContainer;
}

// --- RENDERIZAÇÃO E CLIQUE ---

function renderizarListaOrcamentos(container, lista) {
    container.innerHTML = "";
    if (!lista || lista.length === 0) {
        container.innerHTML = `<p class="mt-3">Nenhum orçamento encontrado para 2026.</p>`;
        return;
    }

    const grid = document.createElement("div");
    grid.className = "orcamentos-grid mt-3";

    lista.forEach(orc => {
        const dataInicio = new Date(orc.dtinimarcacao).toLocaleDateString('pt-BR');
        const dataFimRaw = new Date(orc.data_final_ciclo);
        const dataFim = dataFimRaw.getFullYear() > 1950 
            ? dataFimRaw.toLocaleDateString('pt-BR') 
            : "Data de Desmontagem não definida";

        const item = document.createElement("div");
        item.className = "accordion-item";
        item.innerHTML = `
            <div class="accordion-orc-header">
                <div class="header-main">
                    <div class="orc-header-info">
                        <label>Status:</label>
                        <span class="orc-badge status-${orc.status.toLowerCase()}">${orc.status}</span>
                    </div>
                    <div class="orc-header-info">
                        <label>N Orçamento:</label>
                        <strong>#${orc.nrorcamento}</strong> 
                    </div>
                    <div class="orc-header-info">
                        <label>Evento:</label>
                        <strong>${orc.nome_evento || ''}</strong>
                    </div>
                </div>
                <div class="header-sub">
                    <label>Nomenclatura:</label>
                    <small>${orc.nomenclatura || ''}</small>
                </div>
            </div>
            <div class="accordion-content">
                <div class="accordion-orc-body">
                    <div class="periodo-container">
                        <p><strong><i class="fa fa-calendar-check"></i> Período Total:</strong></p>
                        <p class="data-range">${dataInicio} ➔ ${dataFim}</p>
                    </div>
                    <p><strong>Verba de Contratação:</strong> R$ ${parseFloat(orc.totgeralcto || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                    <button class="btn-detalhes-orcamento" data-nrorcamento="${orc.nrorcamento}">Ver Detalhes do Orçamento</button>
                </div>
            </div>
        `;

        item.querySelector(".accordion-orc-header").onclick = () => item.classList.toggle("active");

        // Lógica de abertura com validação
        item.querySelector(".btn-detalhes-orcamento").onclick = async (e) => {
            const nrOrcamento = e.target.getAttribute("data-nrorcamento");
            
            // 1. Verificar se o modal já existe no DOM (pode estar apenas escondido)
            let modalOrcamento = document.getElementById("modalOrcamentos"); // Ajuste o ID conforme seu HTML
            const linkModal = document.querySelector('.abrir-modal[data-modulo="Orcamentos"]');

            console.log("🟢 Iniciando abertura do orçamento:", nrOrcamento);

            if (!linkModal) {
                console.error("❌ Link de ativação do modal não encontrado.");
                return;
            }

            // 2. Disparar abertura (Simula o clique no menu lateral)
            linkModal.click();

            // 3. Função de verificação recursiva (Polling)
            // Em vez de um timeout fixo, vamos checar se o input apareceu
            let tentativas = 0;
            const maxTentativas = 20; // 2 segundos (100ms * 20)

            const verificarModalCarregado = setInterval(async () => {
                const inputNr = document.getElementById("nrOrcamento");
                tentativas++;

                if (inputNr) {
                    clearInterval(verificarModalCarregado);
                    console.log("✅ Modal carregado e input encontrado na tentativa:", tentativas);
                    
                    // Preencher e disparar Enter
                    inputNr.value = nrOrcamento;
                    const enterEvent = new KeyboardEvent('keydown', {
                        key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true
                    });
                    inputNr.dispatchEvent(enterEvent);

                    // Chamar preenchimento detalhado
                    try {
                        const orcDet = await fetchComToken(`orcamentos?nrOrcamento=${nrOrcamento}`);
                        const moduloOrcamento = await import('./Orcamentos.js');
                        moduloOrcamento.preencherFormularioComOrcamento(orcDet);
                    } catch (err) {
                        console.error("❌ Erro no preenchimento detalhado:", err);
                    }
                } else if (tentativas >= maxTentativas) {
                    clearInterval(verificarModalCarregado);
                    console.warn("⚠️ O modal demorou muito para abrir ou o input não existe.");
                }
            }, 100);
        };

        grid.appendChild(item);
    });

    container.appendChild(grid);
}
                    //  <hr class="orcamento-hr">
async function carregarDetalhesOrcamentos(conteudoGeral) {
    conteudoGeral.innerHTML = `<p class="mt-3">Buscando orçamentos...</p>`;
    const queryParams = construirParametrosOrcamentos();
    try {
        const idEmpresa = getIdEmpresa();
        const orcamentos = await fetchComToken(`/main/orcamentos${queryParams}`, { headers: { idempresa: idEmpresa } });
        renderizarListaOrcamentos(conteudoGeral, orcamentos);
    } catch (error) {
        conteudoGeral.innerHTML = `<p class="erro">Erro ao carregar dados.</p>`;
    }
}

document.getElementById("cardContainerOrcamentos").addEventListener("click", async function() {
    const painel = document.getElementById("painelDetalhes");
    if (!painel) return;
    
    painel.innerHTML = ""; 
    const container = document.createElement("div");
    container.id = "orc-container";
    container.className = "orc-container venc-container"; 

    const header = document.createElement("div");
    header.className = "orcamento-header";
    header.innerHTML = `<button id="btnVoltarorc" class="btn-voltar">←</button><h2 class="title-orc">Gestão de Orçamentos</h2>`;

    const conteudoGeral = document.createElement("div");
    conteudoGeral.className = "conteudo-geral"; 

    container.appendChild(header);
    container.appendChild(criarFiltrosOrcamentoCompletos(conteudoGeral));
    container.appendChild(conteudoGeral);
    painel.appendChild(container);
    
    document.getElementById("btnVoltarorc").onclick = () => painel.innerHTML = ""; 

    carregarDetalhesOrcamentos(conteudoGeral);
});

// function renderizarEstruturaAbasOrcamentos(container, dadosExtra, dadosAdic) {
//     container.innerHTML = `
//         <div class="tabs-container-wrapper">
//             <div class="abas-principais">
//                 <button class="aba main-tab-btn ativa" data-categoria="extra">
//                     Extra Bonificado (${dadosExtra.length})
//                 </button>
//                 <button class="aba main-tab-btn" data-categoria="adicional">
//                     Adicional (${dadosAdic.length})
//                 </button>
//             </div>
//             <div id="orc-tab-content-render" class="painel-tabs ativo" style="display: flex; flex-direction: column;"></div>
//         </div>
//     `;

//     container.querySelectorAll('.main-tab-btn').forEach(btn => {
//         btn.addEventListener('click', function() {
//             container.querySelectorAll('.main-tab-btn').forEach(b => b.classList.remove('ativa'));
//             this.classList.add('ativa');
            
//             const cat = this.getAttribute('data-categoria');
//             const lista = (cat === 'extra') ? dadosExtra : dadosAdic;
//             const statusAtual = document.querySelector("input[name='statusOrc']:checked")?.value;
            
//             // Chama sua função original de renderização (que está comentada no seu código)
//             if (typeof renderizarPedidosorc === "function") {
//                 renderizarPedidosorc(lista, "orc-tab-content-render", cat, statusAtual, false);
//             }
//         });
//     });

//     // Clique inicial para carregar a primeira aba
//     container.querySelector('.main-tab-btn.ativa').click();
// }

// let OrcamentosExtraBonificadoUnificados = [];
// let OrcamentosAdicionaisUnificados = [];

// /**
//  * Busca a lista de orçamentos Aprovados - Extra Bonificado.
//  * ✅ CORREÇÃO DE ROBUSTEZ: Adiciona 'headers' explicitamente para garantir o idempresa.
//  */
// async function buscarOrcamentosExtraBonificado() {
//     const URL_EXTRA = '/main/extra-bonificado';
//     const options = { headers: { idempresa: getIdEmpresa() } }; 
    
//     try {
//         // ✅ CORREÇÃO: fetchComToken retorna o JSON, então chame de 'dados'
//         const dados = await fetchComToken(URL_EXTRA, options); 
        
//         console.log("Dados Extra Bonificado:", dados);
//         // Garante que a função retorna um array, mesmo que o JSON retornado seja nulo ou não seja um array
//         return Array.isArray(dados) ? dados : []; 
        
//     } catch (error) {
//         // O erro já foi capturado e logado pelo fetchComToken se for falha HTTP.
//         // Se a requisição falhar totalmente, o catch captura e retorna [].
//         console.error("Falha ao buscar Extra Bonificado:", error);
//         return []; 
//     }
// }

// /**
//  * Busca a lista de orçamentos Aprovados - Adicionais.
//  * ✅ CORREÇÃO DE ROBUSTEZ: Adiciona 'headers' explicitamente para garantir o idempresa.
//  */
// async function buscarOrcamentosAdicionais() {
//     const URL_ADICIONAL = '/main/adicionais';
//     const options = { headers: { idempresa: getIdEmpresa() } };
    
//     try {
//         // ✅ CORREÇÃO: fetchComToken retorna o JSON, então chame de 'dados'
//         const dados = await fetchComToken(URL_ADICIONAL, options); 

        
//         console.log("Dados Adicionais:", dados);
//         // Garante que a função retorna um array
//         return Array.isArray(dados) ? dados : []; 
        
//     } catch (error) {
//         console.error("Falha ao buscar Adicionais:", error);
//         return []; 
//     }
// }

// // Sua função utilitária (sem modificação)
// function formatarTitulo(camelCase) {
//     let result = camelCase.replace('status', '').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
//     return result.split(' ').map(word => 
//         word.charAt(0).toUpperCase() + word.slice(1)
//     ).join(' ');
// }

// // Sua função principal (sem modificação)
// async function mostrarOrcamentosAprovados(conteudoGeral) {
//     conteudoGeral.innerHTML = `<p>Carregando pedidos aprovados...</p>`;
    
//     try {
//         // 1. CHAMA AS DUAS ROTAS EM PARALELO (CORREÇÃO APLICADA NAS FUNÇÕES DE BUSCA)
//         const [pedidosExtraBonificado, pedidosAdicionais] = await Promise.all([
//             buscarOrcamentosExtraBonificado(),
//             buscarOrcamentosAdicionais()
//         ]);
        
//         // 2. Armazena e Contagem
//         // 🔹 CORREÇÃO A: Mapeia e define o tipo de solicitação explicitamente
//         OrcamentosExtraBonificadoUnificados = pedidosExtraBonificado.map(p => ({
//             ...p,
//             categoriaSolicitacao: 'Extra Bonificado' // Define o tipo aqui
//         }));
        
//         // 🔹 CORREÇÃO A: Mapeia e define o tipo de solicitação explicitamente
//         OrcamentosAdicionaisUnificados = pedidosAdicionais.map(p => ({
//             ...p,
//             categoriaSolicitacao: 'Adicional' // Define o tipo aqui
//         }));
        
//         const countExtraBonificado = OrcamentosExtraBonificadoUnificados.length;
//         const countAdicionais = OrcamentosAdicionaisUnificados.length;
        
//         const statusFixo = 'Autorizado'; 

//         // 3. Cria a estrutura de Abas Principais
//         conteudoGeral.innerHTML = `
//             <div class="tabs-container-wrapper">
//                 <div class="abas-principais">
//                     <button class="aba main-tab-btn ativa" 
//                         data-tab-content="tab-content-extra" data-categoria="extra">
//                         Extra Bonificado (${countExtraBonificado})
//                     </button>
//                     <button class="aba main-tab-btn" 
//                         data-tab-content="tab-content-adicional" data-categoria="adicional">
//                         Adicional (${countAdicionais})
//                     </button>
//                 </div>
                
//                 <div id="tab-content-extra" class="painel-tabs ativo" style="display: flex;"></div>
//                 <div id="tab-content-adicional" class="painel-tabs desativado" style="display: none;"></div>
//             </div>
//         `;

//         // 4. Adiciona os Listeners
//         document.querySelectorAll('.abas-principais .main-tab-btn').forEach(button => {
//             button.addEventListener('click', function() {
//                 const targetId = this.getAttribute('data-tab-content');
//                 const categoria = this.getAttribute('data-categoria');
                
//                 // Gerencia classes da aba
//                 document.querySelectorAll('.abas-principais .main-tab-btn').forEach(btn => btn.classList.remove('ativa'));
//                 this.classList.add('ativa');
                
//                 // Gerencia visibilidade dos painéis
//                 document.querySelectorAll('.painel-tabs').forEach(content => {
//                     content.style.display = 'none';
//                 });
//                 const targetContent = document.getElementById(targetId);
//                 targetContent.style.display = 'flex'; 
                
//                 // Seleciona a lista correta
//                 const listaPedidos = categoria === 'extra' 
//                     ? OrcamentosExtraBonificadoUnificados 
//                     : OrcamentosAdicionaisUnificados;
                
//                 // Renderiza o conteúdo
//                 renderizarPedidosorc(listaPedidos, targetId, categoria, statusFixo, true);
//             });
//         });

//         // 5. Simula o clique inicial
//         const btnInicial = conteudoGeral.querySelector('.main-tab-btn.ativa');
//         if (btnInicial) {
//             btnInicial.click(); 
//         }
//     } catch (error) {
//         console.error("Erro ao carregar dados de orçamento:", error);
//         conteudoGeral.innerHTML = `<p class="erro">Erro ao carregar pedidos: ${error.message || 'Falha na comunicação com o servidor.'}</p>`;
//     }
// }

// // Sua função de renderização (sem modificação)
// function renderizarPedidosorc(listaPedidos, containerId, categoria, status, isStatusFixo) {
//     console.log(`Renderizando pedidos para categoria: ${categoria}, status: ${status}, isStatusFixo: ${isStatusFixo}`);
//     const container = document.getElementById(containerId);
//     if (!container) return;
    
//     // Helper function para escapar HTML
//     const escapeHTML = (str) => {
//         if (typeof str !== 'string') return str || '';
//         return str.replace(/[&<>"']/g, function(m) {
//             return ({
//                 '&': '&amp;',
//                 '<': '&lt;',
//                 '>': '&gt;',
//                 '"': '&quot;',
//                 "'": '&#39;'
//             }[m]);
//         });
//     };
    
//     // 🛑 LIMPA O CONTAINER
//     container.innerHTML = ''; 

//     const pedidosFiltrados = listaPedidos;
//     if (pedidosFiltrados.length === 0) {
//         container.innerHTML = `<p class="mt-3">Não há pedidos autorizados nesta categoria.</p>`;
//     }

//     // GERAÇÃO DO HTML (Usando a técnica robusta de appendChild)
//     pedidosFiltrados.forEach((p, index) => {

//       console.log(`⏳ Iterando pedido ${index} para categoria: ${categoria}`, p);
//         // Variáveis de Exibição
//         const nomeTipoExibicao = escapeHTML(p.categoriaSolicitacao || p.tiposolicitacao || 'Orçamento Complementar'); 
//         const tipoInterno = escapeHTML(p.tiposolicitacao || 'N/D');
//         const nomePrincipal = escapeHTML(p.nome_funcionario_afetado || p.nome_evento || `Orçamento ${p.nrdorcamento}` || 'N/D');       
//         const titulo = `${nomeTipoExibicao} - ${nomePrincipal}`; 
//         const tipoCor = 'aditivo-extra';
//         const tipoIcone = 'fa fa-plus-circle';
//         const collapseId = `collapse-${containerId}-${index}`;

//         // Detalhes (HTML interno) - APLICANDO escapeHTML EM TODOS OS CAMPOS DE DADOS
//         const detalhesHTML = `
//             <div class= "categoria">
//               <p><strong>Categoria:</strong> ${nomeTipoExibicao}</p>
//               <p><strong>Tipo Interno:</strong> ${tipoInterno}</p>
//             </div>  
            
//             <hr class="mt-2 mb-2">

//             <div class= "FuncionarioEvento">
//               ${p.nome_funcionario_afetado 
//                   ? `<p><strong>Funcionário Afetado:</strong> ${escapeHTML(p.nome_funcionario_afetado)} (ID: ${p.idfuncionario || 'N/D'})</p>` 
//                   : ''
//               }
//               ${p.idfuncao ? `<p><strong>ID da Função:</strong> ${p.idfuncao}</p>` : ''}
//               ${p.nome_evento ? `<p><strong>Evento:</strong> ${escapeHTML(p.nome_evento)}</p>` : ''}
//             </div>

//             <hr class="mt-2 mb-2">
            
//             <p><strong>Nº Orçamento:</strong> ${p.idorcamento || p.nrorcamento || 'N/D'}</p>
//             <p><strong>Status:</strong> ${p.status_aditivo || p.status || status}</p>
//             <p><strong>Solicitante:</strong> ${escapeHTML(p.nome_usuario_solicitante || 'N/D')}</p>
//             <p><strong>Justificativa:</strong> ${escapeHTML(p.justificativa || 'N/D')}</p>
//         `;

//         console.log(`✅ Gerando item de acordeão para pedido ${index}:`, { titulo, detalhesHTML });

//         const item = document.createElement('div');
//         item.className = 'accordion-item';
        
//         item.innerHTML = `
//             <div class="accordion-header ${tipoCor}"> 
//                 <i class="${tipoIcone}"></i>
//                 <span>${titulo}</span>
//                 <i class="fa fa-chevron-down"></i>
//             </div>
//             <div id="${collapseId}" class="accordion-content">
//                 <div class="accordion-body">
//                     ${detalhesHTML}
//                 </div>
//             </div>
//         `;
        
//         container.appendChild(item);
//     });

//     console.log(`✅ Elementos anexados. Total de filhos no container: ${container.children.length}`);

//     container.addEventListener('click', function(event) {
        
//         const header = event.target.closest('.accordion-header');
        
//         if (!header) return; // Não foi um clique no cabeçalho

//         event.preventDefault(); // Garante que nenhum link ou framework interfira
        
//         const item = header.closest('.accordion-item');
        
//         if (!item) return; 
        
//         console.log(`✅✅✅ SUCESSO! CLIQUE DETECTADO. Aplicando .active em:`, item); 

//         // 1. Toggle da classe 'active' no elemento PAI
//         item.classList.toggle('active');
        
//         // 2. Toggle da classe 'active' no header (para seta)
//         header.classList.toggle('active'); 
        
//         // 3. Fechar outros itens (opcional)
//         container.querySelectorAll('.accordion-item').forEach(otherItem => {
//             if (otherItem !== item && otherItem.classList.contains('active')) {
//                 otherItem.classList.remove('active');
//                 const otherHeader = otherItem.querySelector('.accordion-header');
//                 if(otherHeader) otherHeader.classList.remove('active');
//             }
//         });
//     });
//     // Não marque o container se você for executar renderizarPedidosorc apenas uma vez por aba.
//     // Se for executada múltiplas vezes, o listener será duplicado, mas é o preço pela certeza do clique.
// }

// document.addEventListener('click', function(event) {
//     const header = event.target.closest('.accordion-header');
//     if (header) {
//         console.log(`🌟 CLIQUE NO ACORDEÃO DETECTADO PELO DOCUMENT! O PROBLEMA É A EXECUÇÃO DO SEU LISTENER.`);
//         // Remove este listener temporário após o teste
//         // document.removeEventListener('click', arguments.callee); 
//     }
// });

// Seu Listener de Evento (sem modificação)

async function atualizarResumo() {
  const dadosResumo = await buscarResumo();
  document.getElementById("orcamentosTotal").textContent = dadosResumo.orcamentos;
  document.getElementById("orcamentosPendentes").textContent = dadosResumo.orcamentosAbertos;
  document.getElementById("orcamentosProposta").textContent = dadosResumo.orcamentosProposta;
  document.getElementById("orcamentosEmAndamento").textContent = dadosResumo.orcamentosEmAndamento;
  document.getElementById("orcamentosFechados").textContent = dadosResumo.orcamentosFechados;
  document.getElementById("orcamentosRecusados").textContent = dadosResumo.orcamentosRecusados;
 // document.getElementById("orcamentosPedidos").textContent = dadosResumo.orcamentosPedidos;
}



// ==============================================================================================
//  Pedidos Financeiros
// ==============================================================================================

async function buscarPedidosUsuario() {
    const idusuario = getIdExecutor(); 

    // ----------------------------------------------------
    // FUNÇÕES UTILS SIMPLIFICADAS (V43.0)
    // ----------------------------------------------------
    function preencherSolicitante(p) {
        return {
            ...p,
            // Usa idusuariosolicitante, ou idusuario (V40.0)
            solicitante: p.idusuariosolicitante || p.idusuario, 
            solicitante_nome: p.nomeSolicitante || p.solicitante_nome || (String(p.solicitante) === String(idusuario) ? "Você" : "Solicitante desconhecido")
        };
    }
    // A função garantirCamposDeStatus e desmembrarPedidos SÃO REMOVIDAS
    // ----------------------------------------------------

    try {
        const resposta = await fetchComToken(`/main/notificacoes-financeiras`, {
            headers: { idempresa: getIdEmpresa() }
        });  

        console.log("DEBUG: Resposta Bruta do Fetch (length):", resposta ? resposta.length : 0);
        
        const podeVerTodos = podeVisualizarTudo(); 
        const ehMasterStaff = usuarioTemPermissao(); 

        if (!resposta || !Array.isArray(resposta)) {
            console.error("Resposta inválida ou não é um array:", resposta);
            return [];
        }

        // 🛑 NOVO FLUXO V43.0: Os 412 itens são pedidos únicos (já desmembrados pelo servidor)
        let pedidosProcessados = resposta.map(p => preencherSolicitante(p));

        // pedidosProcessados = pedidosProcessados.map(p => ({
        //     ...p,
        //     // 🛑 CORREÇÃO V48.0: Converte o status para minúsculas.
        //     status_aprovacao: p.status ? p.status.toLowerCase() : null, 
        //     categoria_item: p.categoria 
        // }));

        pedidosProcessados = pedidosProcessados.map(p => {
    // Tenta encontrar o status real em diferentes colunas que o banco pode usar
    // Prioriza o que NÃO for pendente se houver outra info disponível
    const statusReal = p.status_item || p.status_aprovacao || p.status || 'pendente';
    
    return {
        ...p,
        status_aprovacao: statusReal.toString().toLowerCase().trim(),
        categoria_item: p.categoria || p.categoria_item
    };
});

        // 🛑 DEBUG V50: Confirma o status padronizado
        if (pedidosProcessados.length > 0) {
            console.log("DEBUG V50: Status Padronizado do 1º Pedido Financeiro:", pedidosProcessados[0].status_aprovacao);
        }

        // 🛑 DEBUG V37: Loga o resultado ANTES do filtro de usuário
        console.log("DEBUG V37: Pedidos Processados ANTES do filtro de usuário:", pedidosProcessados.length);


        // 3. APLICAÇÃO DA LÓGICA DE VISUALIZAÇÃO E FILTRO
        if (podeVerTodos) { 
            console.log(`✅ Usuário tem Visualização Total (Master/Financeiro) → Retornando ${pedidosProcessados.length} pedidos.`);
            
            pedidosProcessados = pedidosProcessados.map(p => ({ 
                ...p, 
                ehMasterStaff: ehMasterStaff,
                podeVerTodos: true 
            }));

        } else {
            console.log("👤 Usuário comum → Vendo apenas os próprios pedidos.");
            
            // Filtra no array de 412 itens, usando a chave 'solicitante'
            pedidosProcessados = pedidosProcessados
                .filter(p => String(p.solicitante) === String(idusuario))
                .map(p => ({ 
                    ...p, 
                    ehMasterStaff: false,
                    podeVerTodos: false
                }));
        }

        console.log(`RESPOSTA NO BUSCAR PEDIDOS (${pedidosProcessados.length})`);
        
        return pedidosProcessados; 

    } catch (err) {
        console.error("Erro na requisição de pedidos:", err);
        return [];
    }
}

function mostrarLoader(element) {
    if (element) {
        // Encontra o botão de aprovação ou adiciona uma classe de carregamento ao card
        const btn = element.querySelector('.btn-aprovar');
        if (btn) btn.disabled = true;
    }
}


function ocultarLoader(element) {
    if (element) {
        // Encontra o botão de aprovação e reabilita
        const btn = element.querySelector('.btn-aprovar');
        if (btn) btn.disabled = false;
    }
}


async function buscarAditivoExtraCompleto() {
   // console.log("🟡 Iniciando busca de TODAS as solicitações Aditivo/Extra...");
    try {
        // Altere a URL para a rota que busca todos os status
        const url = '/main/aditivoextra'; 
        const resposta = await fetchComToken(url);

        if (resposta && resposta.sucesso && Array.isArray(resposta.dados)) {
      //console.log(`✅ Sucesso! ${resposta.dados.length} solicitações Aditivo/Extra carregadas.`);
      return resposta.dados; 
        }

        console.error("❌Erro ao buscar AditivoExtra completo:", resposta?.erro || 'Resposta inválida do servidor.');
        return [];

    } catch (err) {
        console.error("🔥Erro de rede/conexão ao buscar AditivoExtra:", err);
        return [];
    }
}

async function mostrarPedidosUsuario() {
    const lista = document.getElementById("painelDetalhes");
    if (!lista) return;

    let pedidos = []; // Array final de grupos
    const podeAprovar = usuarioTemPermissao();

    // 🛑 NOVA CONFIGURAÇÃO: Mapeamento do campo de status para o campo de dados que é um JSON String de array
    const dataFieldMapping = {
        "statusdiariadobrada": "dtdiariadobrada",
        "statusmeiadiaria": "dtmeiadiaria",
        // Outros campos de status que contêm JSON Array devem ser adicionados aqui
    };

    const camposTodos = [
        "statusajustecusto", "statuscaixinha", "statusmeiadiaria", "statusdiariadobrada", CAMPO_ADITIVO_EXTRA
    ];

    try {
        lista.innerHTML = `<div class="titulo-pedidos">Pedidos e Solicitações</div><p>Carregando dados...</p>`;
    
        // 1. CHAMA AS DUAS FUNÇÕES DE BUSCA EM PARALELO
        const [pedidosPadrao, aditivosExtras] = await Promise.all([
            buscarPedidosUsuario(),
            buscarAditivoExtraCompleto()
        ]);

        window.pedidosCompletosGlobais = pedidosPadrao;
        // 2. NORMALIZA E UNE OS DADOS (CORREÇÃO DE MAPEAMENTO)
        let pedidosUnificados = pedidosPadrao;
        
        const aditivosMapeados = [];

        console.log(`DEBUG V44: Array Combinado Inicial (Financeiros): ${pedidosUnificados.length} itens.`);

        aditivosExtras.forEach(ae => {
            const nomeFuncionarioAjustado = ae.nomefuncionario; 
            const solicitanteAjustado = ae.nomesolicitante;
            const statusPadrao = typeof STATUS_PENDENTE !== 'undefined' ? STATUS_PENDENTE : 'pendente';
            
            const statusLower = (ae.status || ae.Status || statusPadrao).toLowerCase();
            const corStatus = (function(status) {
                if (status.includes('aprovado') || status.includes('autorizado')) return '#16a34a'; // Verde
                if (status.includes('rejeitado') || status.includes('recusado')) return '#dc2626'; // Vermelho
                return '#facc15'; // Amarelo (Pendente)
            })(statusLower);

            const pedidoAditivo = {
                funcionario: nomeFuncionarioAjustado, 
                nomeSolicitante: solicitanteAjustado,
                evento: ae.evento,
                nmfuncao: ae.funcao || null,
                idpedido: ae.idaditivoextra, 
                idaditivoextra: ae.idaditivoextra, 
                ehMasterStaff: ae.ehMasterStaff,
                podeVerTodos: ae.podeVerTodos, 
                solicitante: ae.idusuariosolicitante, 
                dtCriacao: ae.criado_em, 
                status_aprovacao: statusLower,
                categoria_item: CAMPO_ADITIVO_EXTRA,
                status: statusLower,
                cor: corStatus,
                [CAMPO_ADITIVO_EXTRA]: [{
                    idfuncionario: ae.idfuncionario,
                    status: statusLower,
                    tipoSolicitacao: ae.tipoSolicitacao || ae.tiposolicitacao || 'N/A',
                    descricao: ae.justificativa, 
                    quantidade: ae.qtdsolicitada,      
                }]
            };
            aditivosMapeados.push(pedidoAditivo);
        });

        pedidosUnificados.push(...aditivosMapeados);
        console.log(`DEBUG V55: Array Combinado (Financeiros + Aditivos Mapeados): ${pedidosUnificados.length} itens.`);
        window.pedidosCompletosGlobais = pedidosUnificados;
        
        // 🛑 PASSO 3: DESMEMBRAMENTO COM VARREDURA DE STATUS 🛑
        const pedidosDesmembrados = [];

        pedidosUnificados.forEach(pedidoOriginal => {
            const categoriasPresentes = camposTodos.filter(c => {
                const valor = pedidoOriginal[c];
                if (c === CAMPO_ADITIVO_EXTRA) {
                    return pedidoOriginal.categoria_item === CAMPO_ADITIVO_EXTRA && Array.isArray(valor) && valor.length > 0;
                }
                if (Array.isArray(valor)) return valor.length > 0;
                return valor && valor.toString().trim() !== ''; 
            });

            if (categoriasPresentes.length > 0) {
                categoriasPresentes.forEach(categoria => {
                    const dataField = dataFieldMapping[categoria];
                    let statusIdentificado = 'pendente'; 
                    let parsedData = null;

                    // 1. Tenta extrair do JSON interno (ex: dtdiariadobrada)
                    if (dataField && pedidoOriginal[dataField]) {
                        parsedData = safeParse(pedidoOriginal[dataField]);
                        if (Array.isArray(parsedData) && parsedData.length > 0) {
                            // Pega o status do primeiro item do array JSON
                            statusIdentificado = parsedData[0].status || parsedData[0].Status || statusIdentificado;
                        }
                    }

                    // 2. Se continuar pendente, verifica se a própria coluna de categoria tem o status
                    // Ex: pedidoOriginal["statusdiariadobrada"] pode conter "autorizado"
                    if (statusIdentificado === 'pendente' && pedidoOriginal[categoria]) {
                        const valorColuna = pedidoOriginal[categoria].toString().toLowerCase();
                        if (valorColuna.includes('autoriz') || valorColuna.includes('aprov') || valorColuna.includes('rejeit')) {
                            statusIdentificado = valorColuna;
                        }
                    }

                    // 3. Fallback para o status global do pedido
                    if (statusIdentificado === 'pendente') {
                        statusIdentificado = pedidoOriginal.status_aprovacao || pedidoOriginal.status || 'pendente';
                    }

                    // Normalização final para as chaves do seu contador
                    let statusFinal = statusIdentificado.toString().toLowerCase().trim();
                    if (statusFinal.includes('autoriz') || statusFinal.includes('aprov')) statusFinal = STATUS_AUTORIZADO;
                    else if (statusFinal.includes('rejeit') || statusFinal.includes('recus')) statusFinal = STATUS_REJEITADO;
                    else statusFinal = STATUS_PENDENTE;

                    const pedidoDesmembrado = { 
                        ...pedidoOriginal,
                        categoria_item: categoria,
                        status: statusFinal,
                        status_aprovacao: statusFinal // Garante que a função contarStatus leia este valor
                    };
                    
                    if (Array.isArray(parsedData)) {
                        pedidoDesmembrado[dataField] = parsedData;
                    }

                    camposTodos.forEach(c => { if (c !== categoria) delete pedidoDesmembrado[c]; });
                    pedidosDesmembrados.push(pedidoDesmembrado);
                });
            } else if (pedidoOriginal.categoria_item) {
                pedidosDesmembrados.push(pedidoOriginal);
            }
        });
        

        // 4. AGRUPAMENTO COM CONTROLE DE DUPLICATAS POR ITEM (REFINADO)
        const pedidosAgrupados = {};
        const chavesDosItensAdicionados = new Set(); 

        // 🛑 ITERAR AGORA SOBRE pedidosDesmembrados 🛑
        pedidosDesmembrados.forEach(p => {
            // Variáveis de Agrupamento
            const evento = p.evento || 'Sem Evento';
            const funcionario = p.funcionario || null; 
            const nmfuncao = p.nmfuncao || null;
            const idGrupo = p.idpedido || p.idaditivoextra || Math.random(); 
            const funcionarioOuFuncao = funcionario || nmfuncao || `Item-ID-${idGrupo}`; 
            const chaveAgrupamento = funcionarioOuFuncao; 
            const solicitanteAtual = p.nomeSolicitante; 
            
            const categoria = p.categoria_item || camposTodos.find(c => p[c] && (Array.isArray(p[c]) ? p[c].length > 0 : typeof p[c] === 'object' && p[c] !== null)); 
            
            const idUnicoItem = p.idpedido || p.idaditivoextra || p.idagrupamento || 'RANDOM-' + Math.random(); 

            const chaveItemUnico = `${chaveAgrupamento}|${categoria || 'Outro'}|${idUnicoItem}`;

            // Verifica e Adiciona a Chave
            if (chavesDosItensAdicionados.has(chaveItemUnico)) {
                console.warn(`🛑 DUPLICAÇÃO IGNORADA: Chave: ${chaveItemUnico}. ID Item: ${idUnicoItem}, Categoria: ${categoria}`);
                return; // Pula este item se ele já foi visto
            }
            if (categoria === CAMPO_ADITIVO_EXTRA) {
                console.log(`✅ Aditivo Extra ADICIONADO: Chave: ${chaveItemUnico}. ID Pedido: ${p.idpedido}, ID Aditivo Extra: ${p.idaditivoextra}`);
            }
            chavesDosItensAdicionados.add(chaveItemUnico);
            
            // LÓGICA DE CRIAÇÃO DO GRUPO
            if (!pedidosAgrupados[chaveAgrupamento]) {
                pedidosAgrupados[chaveAgrupamento] = {
                    evento: evento,
                    funcionario: funcionario, 
                    nmfuncao: nmfuncao,
                    idpedido: p.idpedido, 
                    dtCriacao: p.dtCriacao, 
                    todosSolicitantes: new Set(), 
                    registrosOriginais: [] 
                };
            }

            if (solicitanteAtual) {
                pedidosAgrupados[chaveAgrupamento].todosSolicitantes.add(solicitanteAtual);
            }
            
            // Adiciona o item (único) ao grupo
            pedidosAgrupados[chaveAgrupamento].registrosOriginais.push(p);
        });
       


        const pedidosParaClassificar = Object.values(pedidosAgrupados);
        console.log(`[CLASSIFICAÇÃO] Iniciando classificação de ${pedidosParaClassificar.length} pedidos agrupados.`);

        // 4. CONVERTE DE VOLTA PARA ARRAY E POPULA 'pedidos'
        pedidos = Object.values(pedidosAgrupados).map(p => { 
            const listaSolicitantes = Array.from(p.todosSolicitantes).join(', ');
            p.nomeSolicitante = listaSolicitantes;
            delete p.todosSolicitantes;
            return p;
        });

        console.log(`DEBUG V70: Total de itens após agrupamento final: ${pedidos.length}.`);

        // ORDENAÇÃO (Inalterado)
        pedidos.sort((a, b) => {
            const nomeA = (a.funcionario || a.nmfuncao || '').toLowerCase();
            const nomeB = (b.funcionario || b.nmfuncao || '').toLowerCase();
            
            if (nomeA < nomeB) return -1;
            if (nomeA > nomeB) return 1;

            const eventoA = (a.evento || '').toLowerCase();
            const eventoB = (b.evento || '').toLowerCase();
            
            if (eventoA < eventoB) return -1;
            if (eventoA > eventoB) return 1;

            return 0;
        });
        
        // Verifica se há pedidos após a unificação/agrupamento
        if (!pedidos.length) { 
            lista.innerHTML = `<div class="titulo-pedidos">Pedidos e Solicitações</div><p>Não há pedidos ou solicitações registradas.</p>`;
            return;
        }

            
        // Primeiro, filtramos os grupos
        // const gruposFuncionarios = pedidos.filter(p => !!p.funcionario);
        // const gruposFuncoes = pedidos.filter(p => !p.funcionario);        

        window.gruposFuncionariosGlobais = pedidos.filter(p => !!p.funcionario);
        window.gruposFuncoesGlobais = pedidos.filter(p => !p.funcionario);

        // Agora, contamos quantos registros individuais existem dentro de cada grupo
        const totalPedidosFuncionarios = window.gruposFuncionariosGlobais.reduce((acc, grupo) => 
            acc + (grupo.registrosOriginais ? grupo.registrosOriginais.length : 0), 0);

        const totalPedidosFuncoes = window.gruposFuncoesGlobais.reduce((acc, grupo) => 
            acc + (grupo.registrosOriginais ? grupo.registrosOriginais.length : 0), 0);

        //console.log(`Contagem Real - Pedidos de Funcionários: ${totalPedidosFuncionarios}, Pedidos de Funções: ${totalPedidosFuncoes}`);

        // --- 6. GERAÇÃO DA CONTAGEM FINAL POR STATUS (Inalterado) ---
        
        const STATUS_PENDENTE_LOWER = (typeof STATUS_PENDENTE !== 'undefined' ? STATUS_PENDENTE : 'pendente').toLowerCase();
        const STATUS_AUTORIZADO_LOWER = (typeof STATUS_AUTORIZADO !== 'undefined' ? STATUS_AUTORIZADO : 'autorizado').toLowerCase();
        const STATUS_REJEITADO_LOWER = (typeof STATUS_REJEITADO !== 'undefined' ? STATUS_REJEITADO : 'rejeitado').toLowerCase();

        
        const statusCountsFinal = {
            funcionario: { [STATUS_PENDENTE_LOWER]: 0, [STATUS_AUTORIZADO_LOWER]: 0, [STATUS_REJEITADO_LOWER]: 0 },
            funcao: { [STATUS_PENDENTE_LOWER]: 0, [STATUS_AUTORIZADO_LOWER]: 0, [STATUS_REJEITADO_LOWER]: 0 }
        };

        //console.log(`[CONTAGEM V92.1 INICIAL] Status por Categoria:`, statusCountsFinal, STATUS_AUTORIZADO_LOWER, STATUS_REJEITADO_LOWER, STATUS_PENDENTE_LOWER);
        
        function contarStatus(listaDeGrupos, categoriaDestino) {
            // Reinicia para não acumular lixo de cliques anteriores
            statusCountsFinal[categoriaDestino] = { 
                [STATUS_PENDENTE]: 0, 
                [STATUS_AUTORIZADO]: 0, 
                [STATUS_REJEITADO]: 0 
            };

            listaDeGrupos.forEach(grupo => {
                (grupo.registrosOriginais || []).forEach(item => {
                    // Usa o status_aprovacao que acabamos de normalizar no desmembramento
                    const st = item.status_aprovacao; 
                    if (statusCountsFinal[categoriaDestino][st] !== undefined) {
                        statusCountsFinal[categoriaDestino][st]++;
                    }
                });
            });
        }
       
        // DEBUG DE RASTREAMENTO DEFINITIVO



        contarStatus(window.gruposFuncionariosGlobais, 'funcionario');
        contarStatus(window.gruposFuncoesGlobais, 'funcao');

        //console.log(`[CONTAGEM V92.1] Status por Categoria:`, statusCountsFinal);
        
        const totalPendente = statusCountsFinal.funcionario[STATUS_PENDENTE_LOWER] + statusCountsFinal.funcao[STATUS_PENDENTE_LOWER];
        const totalAutorizado = statusCountsFinal.funcionario[STATUS_AUTORIZADO_LOWER] + statusCountsFinal.funcao[STATUS_AUTORIZADO_LOWER];
        const totalRejeitado = statusCountsFinal.funcionario[STATUS_REJEITADO_LOWER] + statusCountsFinal.funcao[STATUS_REJEITADO_LOWER];
        
        //console.log(`[CONTAGEM V92.1 TOTAL] Pendentes: ${totalPendente}, Autorizados: ${totalAutorizado}, Rejeitados: ${totalRejeitado}`);

        //--- 7. ESTRUTURA DE TABS (Renderização e Listeners) ---
        const tabsHTML = `
            <div class="titulo-pedidos">Pedidos e Solicitações</div>
            <div class="tabs-container-wrapper">
                <div class="abas-principais">
                    <button class="aba main-tab-btn ativa" 
                        data-tab-content="tab-content-funcionarios" data-categoria="funcionario">
                        Funcionários (${totalPedidosFuncionarios})
                    </button>
                    <button class="aba main-tab-btn" 
                        data-tab-content="tab-content-funcoes" data-categoria="funcao">
                        Funções (${totalPedidosFuncoes})
                    </button>
                </div>
                <div id="tab-content-funcionarios" class="painel-tabs ativo">
                    <p class="mt-3">Clique na aba 'Funcionários' ou 'Funções' para ver os pedidos.</p>
                </div>
                <div id="tab-content-funcoes" class="painel-tabs desativado">
                    <p class="mt-3">Clique na aba 'Funcionários' ou 'Funções' para ver os pedidos.</p>
                </div>
            </div>
        `;

        lista.innerHTML = tabsHTML; 

        // Listeners (Inalterados)
        document.querySelectorAll('.abas-principais .main-tab-btn').forEach(button => {
            button.addEventListener('click', function() {
                // ... (Lógica do clique da aba principal) ...
                const clickedButton = this;
                const targetId = clickedButton.getAttribute('data-tab-content');
                const categoria = clickedButton.getAttribute('data-categoria');
                const abasPrincipaisContainer = document.querySelector('.abas-principais'); 
                
                document.querySelectorAll('.abas-principais .main-tab-btn').forEach(btn => {
                    if (btn) { 
                        btn.classList.remove('ativa');
                        btn.classList.remove('desativada'); 
                    }
                }); 
                
                clickedButton.classList.add('ativa');

                if (abasPrincipaisContainer) {
                    abasPrincipaisContainer.style.display = 'none';
                }

                document.querySelectorAll('.painel-tabs').forEach(content => content.classList.remove('ativo'));
                document.querySelectorAll('.painel-tabs').forEach(content => content.classList.add('desativado'));

                const targetContent = document.getElementById(targetId);
                targetContent.classList.add('ativo');
                targetContent.classList.remove('desativado'); 

                const listaPedidos = categoria === 'funcionario' ? window.gruposFuncionariosGlobais : window.gruposFuncoesGlobais;
                const contagemCategoria = categoria === 'funcionario' ? statusCountsFinal.funcionario : statusCountsFinal.funcao;

                carregarSubAbasInicial(targetContent, categoria, listaPedidos, contagemCategoria);
            });
        });

        
        // Delegação de Eventos para as sub-abas (Inalterado)
        lista.addEventListener('click', function(event) {
            const button = event.target.closest('.sub-tab-btn');
            if (button) {
                // ... (Lógica do clique da sub-aba) ...
                const status = button.getAttribute('data-status');
                const categoria = button.getAttribute('data-categoria');
                const listContainerId = button.getAttribute('data-list-id');

                document.querySelectorAll(`.sub-abas-pedidos[data-categoria="${categoria}"] .sub-tab-btn`).forEach(btn => {
                    btn.classList.remove('ativa');
                });
                button.classList.add('ativa');

                lista.querySelectorAll('.pedidos-list-container').forEach(container => {
                    container.classList.add('hidden'); 
                    container.style.display = 'none'; 
                    container.style.visibility = 'hidden'; 
                    container.style.height = '0'; 
                });
                
                const targetContainer = document.getElementById(listContainerId);
                if (targetContainer) {
                    targetContainer.classList.remove('hidden');
                    targetContainer.style.visibility = 'visible';
                    targetContainer.style.height = 'auto'; 
                    targetContainer.style.display = 'flex'; 
                }

                //const listaPedidos = categoria === 'funcionario' ? pedidosFuncionariosUnicos : pedidosFuncoesUnicos;
                const listaPedidos = categoria === 'funcionario' ? window.gruposFuncionariosGlobais : window.gruposFuncoesGlobais;
                renderizarPedidos(listaPedidos, listContainerId, categoria, status, podeAprovar);
            }
        });

        // Delegação de Eventos para o botão "Voltar" (Inalterado)
        lista.addEventListener('click', function(event) {
            const backButton = event.target.closest('.btn-voltar-main-tabs');
            if (backButton) {
                // ... (Lógica do botão voltar) ...
                const abasPrincipaisContainer = document.querySelector('.abas-principais');
            
                const activeTabContent = backButton.closest('.painel-tabs.ativo');
            
                if(activeTabContent) {
                    const categoriaAtual = activeTabContent.id.includes('funcionarios') ? 'Funcionários' : 'Funções';
                    activeTabContent.innerHTML = `<p class="mt-3">Clique na aba '${categoriaAtual}' para ver os pedidos.</p>`;
                    
                    activeTabContent.classList.remove('ativo');
                    activeTabContent.classList.add('desativado');
                }

                if (abasPrincipaisContainer) {
                    abasPrincipaisContainer.style.display = 'flex'; 
                }

                const activeMainTabButton = document.querySelector('.abas-principais .main-tab-btn.ativa');
                if (activeMainTabButton) {
                    const targetContent = document.getElementById(activeMainTabButton.getAttribute('data-tab-content'));
                    if (targetContent) {
                        targetContent.classList.add('ativo');
                        targetContent.classList.remove('desativado');
                    }
                }
            }
        });

    } catch (err) {
        console.error("Erro CRÍTICO ao mostrar pedidos:", err);
        lista.innerHTML = `<p class="erro">Erro ao carregar pedidos: ${err.message || 'Verifique se as funções de busca e utilidade estão implementadas corretamente.'}</p>`;
    }
}


function criarSubTabsHTML(listContainerIdBase, categoria, statusCounts) {
    // statusCounts é o objeto de contagem que contém {pendente: X, autorizado: Y, rejeitado: Z}

    console.log("CRIARSUBTABS", listContainerIdBase, categoria, statusCounts);
    
    const statuses = [
        { status: STATUS_PENDENTE, label: "Pendentes" },
        { status: STATUS_AUTORIZADO, label: "Autorizados" },
        { status: STATUS_REJEITADO, label: "Rejeitados" }
    ];

    // Geração dos Botões de Sub-Abas
    const tabButtons = statuses.map(s => {
        const statusKey = s.status.toLowerCase(); // Usa a chave minúscula (pendente, autorizado, rejeitado)
        const count = statusCounts[statusKey] || 0; // Lê a contagem do objeto passado
        
        return `
            <button class="aba sub-tab-btn ${s.status === STATUS_PENDENTE ? 'ativa' : ''}" 
                data-status="${s.status}" data-categoria="${categoria}" data-list-id="${listContainerIdBase}-${s.status}">
                ${s.label} (<span id="${listContainerIdBase}-count-${s.status}">${count}</span>)
            </button>
        `;
    }).join('');

    // Conteúdo das Sub-Abas
    const tabContents = statuses.map(s => `
        <div id="${listContainerIdBase}-${s.status}" class="pedidos-list-container ${s.status === STATUS_PENDENTE ? '' : 'hidden'}">
            <p class="mt-2 text-sm text-gray-500">Carregando lista de pedidos ${s.label.toLowerCase()}...</p>
        </div>
    `).join('');

    // ESTRUTURA PRINCIPAL DO CONTEÚDO (INCLUI BOTÃO VOLTAR)
    return `
        <button class="btn-voltar-main-tabs" type="button">
            <i class="fas fa-arrow-left"></i> Voltar para Pedidos e Solicitações
        </button>

        <div class="sub-tab-view">
            <div class="sub-abas-pedidos" data-categoria="${categoria}">
                ${tabButtons}
            </div>
            <div class="sub-tabs-content">
                ${tabContents}
            </div>
        </div>
    `;
}


function carregarSubAbasInicial(targetContent, categoria, pedidos, statusCounts) {
    const listContainerIdBase = categoria === 'funcionario' ? "funcionarios-list" : "funcoes-list";
    const STATUS_PENDENTE_LOWER = (typeof STATUS_PENDENTE !== 'undefined' ? STATUS_PENDENTE : 'pendente').toLowerCase();
    
    // Verifica se o conteúdo já foi carregado para evitar re-criação
    if (targetContent.querySelector('.sub-abas-pedidos')) {
         // Se já foi carregado, apenas simula o clique em Pendentes
         const defaultSubTab = targetContent.querySelector(`.sub-tab-btn[data-status="${STATUS_PENDENTE}"]`);
         if(defaultSubTab) { 
             defaultSubTab.click(); 
         }
         return;
    }
    
    // Gera o HTML das sub-abas, passando o objeto de contagem CORRETO (statusCounts)
    const subTabsHTML = criarSubTabsHTML(listContainerIdBase, categoria, statusCounts); // <--- MUDANÇA CRÍTICA AQUI
    targetContent.innerHTML = subTabsHTML;

    // Simula o clique no primeiro sub-tab ("Pendentes")
    const defaultSubTab = targetContent.querySelector(`.sub-tab-btn[data-status="${STATUS_PENDENTE}"]`);
    if (defaultSubTab) {
        // Dispara o evento de clique, que será capturado pelo Listener na mostrarPedidosUsuario
        // O Listener usará o array 'pedidos' e o status 'STATUS_PENDENTE' para renderizar o conteúdo.
        defaultSubTab.click();
    }
}


function formatarNomeSolicitacao(campoNome) {
    if (!campoNome) return 'N/D';
    
    // 1. Remove o prefixo 'status' e converte para minúsculas para comparação
    let nomeLimpo = campoNome.toLowerCase().replace("status", "");
    
    // 2. Mapeamento de quebra de palavras conhecida (V72.0)
    const mapeamento = {
        "ajustecusto": "Ajuste de Custo",
        "caixinha": "Caixinha",
        "meiadiaria": "Meia Diária",
        "diariadobrada": "Diária Dobrada",
        "aditivoextra": "Aditivo Extra"
    };

    if (mapeamento[nomeLimpo]) {
        return mapeamento[nomeLimpo];
    }

    // 3. Fallback: Tenta quebrar pelo Camel Case e Capitalizar
    let nomeFormatado = nomeLimpo.replace(/([a-z])([A-Z])/g, '$1 $2');
    
    // Capitaliza a primeira letra de cada palavra
    return nomeFormatado.split(' ')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(' ');
}


function parseDateLocal(dateString) {
    if (!dateString) return null;
    // A string deve estar no formato 'YYYY-MM-DD'.
    const parts = dateString.split('-');
    if (parts.length !== 3) return null;

    const year = parseInt(parts[0], 10);
    // O mês em JavaScript é baseado em zero (0 = Janeiro, 11 = Dezembro).
    const month = parseInt(parts[1], 10) - 1; 
    const day = parseInt(parts[2], 10);

    // Cria o objeto Date usando o fuso horário LOCAL do ambiente.
    // Isso é a chave para evitar o deslocamento para o dia anterior (ex: 01/11)
    // quando o fuso horário local é negativo (ex: GMT-3).
    return new Date(year, month, day);
}


function safeParse(input) {
    if (Array.isArray(input)) return input;
    if (typeof input !== 'string') return [input];
    
    let result = input.trim();
    
    // 1. Caso de borda: Se for "null" ou "[]" (string vazia de array)
    if (result.toLowerCase() === 'null' || result === '[]') return [];

    // 2. Remove aspas externas se o JSON estiver envolto nelas (ex: '"{...}"')
    if (result.startsWith('"') && result.endsWith('"')) {
        result = result.substring(1, result.length - 1).trim();
    }
    
    // 3. Tenta corrigir aspas duplas incorretas (muito comum em serialização de DB)
    // Ex: Substitui [{""data"":...}] por [{"data":...}]
    let jsonString = result.replace(/""/g, '"');
    
    try {
        // Tenta parsear a string corrigida
        const parsed = JSON.parse(jsonString);
        return Array.isArray(parsed) ? parsed : [parsed];
    } catch (e) {
        // Fallback: Tenta parsear a string original sem correção de aspas (caso a correção tenha quebrado)
        try {
            const parsed = JSON.parse(result);
            return Array.isArray(parsed) ? parsed : [parsed];
        } catch (e) {
            // Fallback final: Se for uma string comum (ex: "Autorizado"), 
            // transforma em objeto para manter a compatibilidade com o filtro .status
            if (typeof result === 'string' && result.length > 0) {
                return [{ status: result }]; 
            }
            return input ? [input] : [];
        }
    }
}


function renderizarPedidos(pedidosCompletos, containerId, categoria, statusDesejado, podeAprovar) {
    window.pedidosCompletosGlobais = pedidosCompletos;
    const container = document.getElementById(containerId);
    if (!container) return;

    // 🛑 CORREÇÃO V61.0: Garante que o contêiner de lista se comporte como uma coluna.
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.flexWrap = 'nowrap';
    container.style.gap = '10px';

    container.innerHTML = '';

    const camposTodos = [
        "statusajustecusto",
        "statuscaixinha",
        "statusmeiadiaria",
        "statusdiariadobrada",
        CAMPO_ADITIVO_EXTRA
    ];
    // 🛑 V65.0: Inclui o campo placeholder para renderização na Seção 2
    const camposRenderizaveis = [...camposTodos, 'pedido_principal'];

    const STATUS_PENDENTE_LOWER = (typeof STATUS_PENDENTE !== 'undefined' ? STATUS_PENDENTE : 'pendente').toLowerCase();
    const STATUS_AUTORIZADO_LOWER = (typeof STATUS_AUTORIZADO !== 'undefined' ? STATUS_AUTORIZADO : 'autorizado').toLowerCase();
    const STATUS_REJEITADO_LOWER = (typeof STATUS_REJEITADO !== 'undefined' ? STATUS_REJEITADO : 'rejeitado').toLowerCase();

    let totalItensRenderizados = 0;
    // --- 1. FILTRAGEM E CONSOLIDAÇÃO ---
    const gruposFiltrados = [];
    const solicitantesPendentesPorChave = {}; // Resetamos para cada renderização

    pedidosCompletos.forEach(grupoConsolidado => {
        let chaveRenderizacao = categoria === 'funcionario'
            ? grupoConsolidado.funcionario
            : (grupoConsolidado.nmfuncao || 'SOLICITAÇÃO DE FUNÇÃO');

        if (!chaveRenderizacao) return;

        const registros = grupoConsolidado.registrosOriginais || [];
        const pedidosConsolidadosPorId = new Map();
        let temAlgumMatchNesteGrupo = false; // Flag crucial

        registros.forEach(pedidoOriginal => {
            const id = pedidoOriginal.idstaffevento || pedidoOriginal.idpedido || pedidoOriginal.id;
            let pedidoConsolidado = pedidosConsolidadosPorId.get(id);

            if (!pedidoConsolidado) {
                pedidoConsolidado = { ...pedidoOriginal, idpedido: id, temMatch: false };
                pedidosConsolidadosPorId.set(id, pedidoConsolidado);
            }

            // Verifica status principal
            const statusPrincipal = (pedidoOriginal.statuspgto || pedidoOriginal.status_aprovacao || '').toLowerCase().trim();
            if (statusPrincipal === statusDesejado) {
                pedidoConsolidado.temMatch = true;
                pedidoConsolidado.renderizarComoPedidoPrincipal = true;
                temAlgumMatchNesteGrupo = true;
            }

            // Verifica sub-itens (Meia diária, caixinha, etc)
            camposTodos.forEach(campo => {
                const itens = safeParse(pedidoOriginal[campo]);
                const itensFiltrados = itens.filter(it => {
                    const s = (typeof it === 'object' && it !== null) ? (it.status || 'pendente') : it;
                    return String(s).toLowerCase().trim() === statusDesejado;
                });

                if (itensFiltrados.length > 0) {
                    pedidoConsolidado.temMatch = true;
                    pedidoConsolidado[campo] = itensFiltrados;
                    temAlgumMatchNesteGrupo = true;
                } else {
                    delete pedidoConsolidado[campo]; // Remove para não lixo no card
                }
            });
        });

        // 🛑 CORREÇÃO FINAL: Só cria o grupo e o nome se houver match
        if (temAlgumMatchNesteGrupo) {
            const registrosValidos = Array.from(pedidosConsolidadosPorId.values()).filter(p => p.temMatch);

            if (registrosValidos.length > 0) {
                // SÓ AQUI criamos a entrada no dicionário de nomes
                if (!solicitantesPendentesPorChave[chaveRenderizacao]) {
                    solicitantesPendentesPorChave[chaveRenderizacao] = new Set();
                }

                registrosValidos.forEach(p => {
                    const nome = p.nomeSolicitante || p.nmfuncionario || chaveRenderizacao;
                    solicitantesPendentesPorChave[chaveRenderizacao].add(nome);
                });

                gruposFiltrados.push({
                    ...grupoConsolidado,
                    registrosOriginais: registrosValidos
                });
            }
        }
    });
    
    // FIM DA SEÇÃO 1: Consolidação.

    // Ordenação... (inalterada)
    // gruposFiltrados.sort((a, b) =>
    //     new Date(b.dtCriacao || '1970-01-01').getTime() -
    //     new Date(a.dtCriacao || '1970-01-01').getTime()
    // );

    if (gruposFiltrados.length === 0) {
        const msg = document.createElement("p");
        msg.textContent = `Não há pedidos com status "${statusDesejado}".`;
        container.appendChild(msg);
        
        // 🛑 V97.0: Atualiza a contagem para 0
        if (typeof atualizarBadgeDeStatus === 'function') {
             // Ex: atualizarBadgeDeStatus('pendente', 0, categoria);
             atualizarBadgeDeStatus(statusDesejado, 0, categoria);
        }
        return;
    }

    // --- 2. RENDERIZAÇÃO ---
    const listaGrupos = document.createElement("div");
    listaGrupos.className = "lista-funcionarios";

    gruposFiltrados.forEach(grupo => {
        const pedidosDoGrupo = grupo.registrosOriginais;
        if (!pedidosDoGrupo?.length) return;

        const chaveNome = categoria === 'funcionario'
            ? grupo.funcionario
            : (grupo.nmfuncao || 'SOLICITAÇÃO DE FUNÇÃO');

        const solicitantesGrupo = Array.from(solicitantesPendentesPorChave[chaveNome] || []).join(', ') || 'N/D';

        const divGrupo = document.createElement("div");
        divGrupo.className = "funcionario";

        const header = document.createElement("div");
        header.className = "funcionario-header";

        const body = document.createElement("div");
        body.className = "funcionario-body hidden";

        let htmlBody = '';
        let itensGrupo = 0;

        // Itera sobre os pedidos consolidados
        pedidosDoGrupo.forEach(pedido => {
            // Itera sobre camposTodos e o placeholder 'pedido_principal'
            camposRenderizaveis.forEach(campo => { 
                const itensFiltrados = pedido[campo];
                if (!itensFiltrados || (Array.isArray(itensFiltrados) && itensFiltrados.length === 0)) return;

                const itensParaRenderizar = Array.isArray(itensFiltrados) ? itensFiltrados : [itensFiltrados];

                itensParaRenderizar.forEach(infoItem => {
                    // 🛑 Validação extra: se for o principal mas não for o status da aba, pula
                    if (campo === 'pedido_principal' && !pedido.renderizarComoPedidoPrincipal) return;

                    itensGrupo++;
                    totalItensRenderizados++; // 🛑 V97.0: Contagem total atualizada

                    const statusTexto = (infoItem.status || statusDesejado).charAt(0).toUpperCase() + (infoItem.status || statusDesejado).slice(1);
                    const statusLower = (infoItem.status || statusDesejado).toLowerCase();
                    let corQuadrado = statusLower === STATUS_AUTORIZADO_LOWER ? "#16a34a" : statusLower === STATUS_REJEITADO_LOWER ? "#dc2626" : "#facc15";

                    let tituloCard;
                    const isAditivoExtra = campo === CAMPO_ADITIVO_EXTRA;
                    const isDataUnica = campo === "statusmeiadiaria" || campo === "statusdiariadobrada";
                    const isPedidoPrincipal = campo === 'pedido_principal'; 

                    if (isPedidoPrincipal) {
                        tituloCard = pedido.tipoSolicitacaoGeral || 'Solicitação Principal'; 
                        if (pedido.dataPrincipal) {
                            tituloCard += ` (${pedido.dataPrincipal})`;
                        } else if (pedido.valorPrincipal !== undefined && typeof pedido.valorPrincipal === 'number') {
                            const valorFmt = pedido.valorPrincipal.toFixed(2).replace('.', ',');
                            tituloCard += ` (R$ ${valorFmt})`;
                        }
                    } else if (isAditivoExtra) {
                        const tipo = infoItem.tipoSolicitacao;
                        tituloCard = (tipo?.toUpperCase() === 'FUNCEXCEDIDO')
                            ? "Limite Diário Excedido por Função/Evento"
                            : tipo;
                    } else {
                        tituloCard = formatarNomeSolicitacao(campo);
                        if (isDataUnica) { 
                            const dataBruta = String(infoItem.data || '').trim();
                            let dataFmt = '';
                            if (dataBruta !== '') {
                                const dataObj = parseDateLocal(dataBruta); 
                                dataFmt = dataObj?.toLocaleDateString('pt-BR') || '';
                            }
                            if (dataFmt) tituloCard += ` (${dataFmt})`;
                        } else if (campo.includes('custo') || campo.includes('caixinha')) {
                            const valor = parseFloat(infoItem.valor) || 0;
                            if (valor !== 0) {
                                const valorFmt = valor.toFixed(2).replace('.', ',');
                                tituloCard += ` (R$ ${valorFmt})`;
                            }
                        }
                    }

                    htmlBody += `
                        <div class="pedido-card">
                            <div>
                                <strong>${tituloCard}</strong><br>
                    `;

                    const nomeSolic = pedido.nomeSolicitante || "N/D";

                    if (pedido.evento) {
                        if (categoria === 'funcionario' && pedido.funcionario) {
                            htmlBody += `<strong>Evento:</strong> ${pedido.evento} - <strong>Funcionário:</strong> ${pedido.funcionario} - <strong>Solicitante:</strong> ${nomeSolic}<br>`;
                        } else {
                            htmlBody += `<strong>Evento:</strong> ${pedido.evento}<br>`;
                        }
                    }

                    if (isPedidoPrincipal) {
                        htmlBody += `Status do Pedido: <span class="status-text font-semibold"><strong>${statusTexto}</strong></span><br>`;
                    } else if (isAditivoExtra) {
                        if (infoItem.quantidade) htmlBody += `Qtd: ${infoItem.quantidade}<br>`;
                        htmlBody += `Status: <span class="status-text font-semibold"><strong>${statusTexto}</strong></span><br>`;
                    } else if (campo.includes('custo') || campo.includes('caixinha')) {
                        const valor = parseFloat(infoItem.valor) || 0; 
                        if (valor !== 0) {
                            const valorFmt = valor.toFixed(2).replace('.', ',');
                            htmlBody += `Valor: R$ ${valorFmt} - <span class="status-text font-semibold"><strong>${statusTexto}</strong></span><br>`;
                        } else {
                            htmlBody += `Status: <span class="status-text font-semibold"><strong>${statusTexto}</strong></span><br>`;
                        }
                    } else if (isDataUnica) {
                        const dataBruta = String(infoItem.data || '').trim();
                        let dataFmt = 'Data indefinida';
                        if (dataBruta !== '') {
                            const dataObj = parseDateLocal(dataBruta);
                            dataFmt = dataObj ? dataObj.toLocaleDateString('pt-BR') : 'Data indefinida';
                        }
                        htmlBody += `Data: ${dataFmt} - <span class="status-text font-semibold"><strong>${statusTexto}</strong></span><br>`;
                    } else if (infoItem.datas) {
                        const datasFmt = infoItem.datas
                            .map(d => parseDateLocal(d.data)?.toLocaleDateString('pt-BR'))
                            .filter(d => d)
                            .join(', ');
                        htmlBody += `Datas: ${datasFmt} - <span class="status-text font-semibold"><strong>${statusTexto}</strong></span><br>`;
                    }

                    if (infoItem.descricao) {
                        htmlBody += `Descrição: ${infoItem.descricao}<br>`;
                    }

                    if (statusDesejado === STATUS_PENDENTE_LOWER && podeAprovar) {
                        const campoParaAcao = isPedidoPrincipal ? 'status_aprovacao' : campo; 
                        const dataParaAcao = isPedidoPrincipal 
                            ? (pedido.dataEspecifica || '') 
                            : (isDataUnica ? (infoItem.data || '').trim() : '');
                        const idParaAcao = isAditivoExtra ? (infoItem.idAditivoExtra || pedido.idpedido) : pedido.idpedido;
                        
                        htmlBody += `
                            <div class="flex gap-2 mt-2"
                                data-id="${idParaAcao}"
                                data-campo="${campoParaAcao}"
                                data-data="${dataParaAcao}"
                                data-aditivo="${isAditivoExtra}">
                                <button class="aprovar">Autorizar</button>
                                <button class="negar">Rejeitar</button>
                            </div>
                        `;
                    }

                    htmlBody += `
                            </div>
                            <div class="quadrado-arredondado" style="background-color: ${corQuadrado};" title="Status: ${statusTexto}"></div>
                        </div>
                    `;
                });
            });
        });

        // 🛑 AQUI ESTÁ O PULO DO GATO:
        // Se após varrer tudo o itensGrupo for 0, não adicionamos o divGrupo ao container.
        if (itensGrupo === 0) return;

        body.innerHTML = htmlBody;

        header.innerHTML = `
            <div>
                ${categoria === 'funcionario' ? 'Funcionário' : 'Função'}:
                <strong>${chaveNome}</strong><br>
                <small class="text-xs text-gray-500">Solicitante(s): ${solicitantesGrupo}</small>
            </div>
            <div class="flex items-center gap-2">
                <span>${itensGrupo}</span>
                <i class="fas fa-chevron-down text-gray-500 text-xs transition-transform transform"></i>
            </div>
        `;

        header.addEventListener("click", () => {
            body.classList.toggle("hidden");
            header.querySelector('i').classList.toggle('rotate-180');
        });

        divGrupo.appendChild(header);
        divGrupo.appendChild(body);
        listaGrupos.appendChild(divGrupo);
    });

    container.appendChild(listaGrupos);

    // --- 3. LISTENERS DE AÇÃO (SWAL) 
    container.onclick = null; 

    container.addEventListener('click', async function(event) {
        const target = event.target;
        // Verifica se clicou nos botões
        if (!target.classList.contains('aprovar') && !target.classList.contains('negar')) return;

        const actionDiv = target.closest('[data-id]');
        if (!actionDiv) return;

        const isAprovar = target.classList.contains('aprovar');
        const idReferencia = actionDiv.getAttribute('data-id'); 
        const campoParaBackend = actionDiv.getAttribute('data-campo');
        const dataParaUpdate = actionDiv.getAttribute('data-data');
        const isAditivoExtra = actionDiv.getAttribute('data-aditivo') === 'true';

        // Determina qual função chamar e qual o status alvo
        const statusUpdateFn = isAditivoExtra ? atualizarStatusAditivoExtra : atualizarStatusPedido;
        const statusTarget = isAprovar ? STATUS_AUTORIZADO_LOWER : STATUS_REJEITADO_LOWER;
        const cardElement = target.closest('.pedido-card');

        // Modal de Confirmação
        const result = await Swal.fire({
            title: isAprovar ? 'Autorizar?' : 'Rejeitar?',
            text: "Tem certeza que deseja " + (isAprovar ? "AUTORIZAR" : "REJEITAR") + " esta solicitação?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: isAprovar ? '#16a34a' : '#dc2626',
            confirmButtonText: 'Confirmar'
        });

        if (result.isConfirmed) {
            try {
                console.log("🚀 Iniciando atualização no banco para ID:", idReferencia);
                
                let sucesso = false;
                if (isAditivoExtra) {
                    sucesso = await statusUpdateFn(idReferencia, statusTarget, cardElement); 
                } else {
                    sucesso = await statusUpdateFn(idReferencia, campoParaBackend, statusTarget, cardElement, dataParaUpdate);
                }

                
                // ... dentro da sua função de atualizar status, no bloco de sucesso:
                if (sucesso) {
                    console.log("✅ Sucesso confirmado! Atualizando para ID:", idReferencia);

                    // O status que queremos gravar na memória (ex: 'autorizado')
                    // Ajustado para pegar da variável que você está usando no seu escopo
                    const novoStatus = (typeof statusTarget !== 'undefined') ? statusTarget : 'autorizado';

                    // 1. ATUALIZAR STATUS NA MEMÓRIA
                    const listas = [window.gruposFuncionariosGlobais, window.gruposFuncoesGlobais].filter(l => l);
                    listas.forEach(lista => {
                        lista.forEach(grupo => {
                            grupo.registrosOriginais?.forEach(p => {
                                if (String(p.idpedido || p.idstaffevento) === String(idReferencia)) {
                                    // Atualiza o campo que a sua função de contagem "Original" usa
                                    p.status_aprovacao = novoStatus.toLowerCase().trim();
                                    console.log(`🧠 Memória sincronizada: Pedido ${idReferencia} agora é ${p.status_aprovacao}`);
                                }
                            });
                        });
                    });

                    // 2. REMOÇÃO VISUAL (Seu código de remover card)
                    // ... (dentro do if (sucesso), após a remoção do card)

                    if (cardElement) {
                        // 1. Antes de remover, vamos identificar quem é o "container do grupo"
                        // Ajuste as classes '.funcionario' ou '.funcao-group' para as que você usa no HTML
                        const grupoContainer = cardElement.closest('.funcionario') || cardElement.closest('.funcao-group');
                        const corpoGrupo = cardElement.closest('.funcionario-body') || cardElement.closest('.funcao-body');

                        // 2. Remove o card com um pequeno efeito
                        cardElement.style.transition = '0.3s';
                        cardElement.style.opacity = '0';
                        
                        setTimeout(() => {
                            cardElement.remove();
                            console.log("🗑️ Card removido.");

                            // 3. VERIFICAÇÃO DE GRUPO VAZIO
                            if (corpoGrupo) {
                                const cardsRestantes = corpoGrupo.querySelectorAll('.pedido-card').length;
                                
                                if (cardsRestantes === 0 && grupoContainer) {
                                    console.log("📦 Último pedido removido. Excluindo container do grupo...");
                                    
                                    grupoContainer.style.transition = '0.3s';
                                    grupoContainer.style.opacity = '0';
                                    
                                    setTimeout(() => {
                                        grupoContainer.remove();
                                    }, 300);
                                }
                            }
                            
                            // 4. CHAMA A SUA ATUALIZAÇÃO DE CONTADORES (que já está funcionando!)
                            atualizarContadoresGlobais();
                            
                        }, 300);
                    }

                    Swal.fire({ icon: 'success', title: 'Atualizado!', timer: 800, showConfirmButton: false });
                }
    
            } catch (err) {
                console.error("❌ Erro na execução:", err);
                Swal.fire('Erro', 'Falha ao processar solicitação.', 'error');
            }
        }
    });

    // 🛑 V97.0: Atualiza a contagem da sub-aba (Badge) com o valor exato
    if (typeof atualizarBadgeDeStatus === 'function') {
         // Ex: atualizarBadgeDeStatus('pendente', 171, 'funcionario');
         atualizarBadgeDeStatus(statusDesejado, totalItensRenderizados, categoria);
    }

    if (typeof atualizarContadoresGlobais === 'function') {
        atualizarContadoresGlobais();
    }
} 


async function atualizarStatusPedido(idpedido, categoria, acao, cardElement, dataParaUpdate) {
    try {
        // Garantimos que os nomes das chaves (idpedido, categoria, acao, data) 
        // sejam exatamente o que o seu backend recebia no código antigo.
        const bodyData = {
            idpedido: idpedido,
            categoria: categoria, // O backend espera 'categoria', que é o seu 'campo'
            acao: acao,
            data: dataParaUpdate && dataParaUpdate.trim() !== '' ? dataParaUpdate : null
        };

        console.log("📦 Enviando para o servidor:", bodyData);

        const resposta = await fetchComToken('/main/notificacoes-financeiras/atualizar-status', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyData)
        });

        // IMPORTANTE: fetchComToken já retorna o JSON. 
        // Não use await resposta.json() aqui.
        if (resposta && resposta.sucesso) {
            console.log("✅ Servidor respondeu com sucesso!");
            return true; 
        } else {
            Swal.fire('Erro', resposta.mensagem || 'Erro ao atualizar.', 'error');
            return false;
        }
    } catch (err) {
        console.error("❌ Erro ao atualizar status:", err);
        return false;
    }
}


async function atualizarStatusAditivoExtra(idAditivoExtra, novoStatus, cardElement) {
    console.log(`🚀 Iniciando atualização de status para AditivoExtra ID ${idAditivoExtra} para: ${novoStatus}`);

    // ... (seu código de confirmação com Swal.fire continua igual) ...
    const confirmacao = await Swal.fire({
        title: 'Confirmar Ação',
        html: `Tem certeza que deseja aplicar esta ação à solicitação de <strong>Aditivo / Extra</strong>?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: novoStatus.toLowerCase() === 'autorizado' ? '#16a34a' : '#dc2626',
        confirmButtonText: 'Confirmar'
    });

    if (!confirmacao.isConfirmed) return false;

    try {
        mostrarLoader(cardElement);

        const url = `/main/aditivoextra/${idAditivoExtra}/status`;
        const novoStatusCapitalizado = novoStatus.charAt(0).toUpperCase() + novoStatus.slice(1);
        
        // O fetchComToken já resolve o JSON
        const response = await fetchComToken(url, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ novoStatus: novoStatusCapitalizado })
        });

        ocultarLoader(cardElement);

        if (response && response.sucesso) {
            console.log("✅ Aditivo atualizado no banco. Sincronizando memória...");

            const statusFormatado = novoStatus.toLowerCase().trim();

            // 1. ATUALIZAÇÃO DA MEMÓRIA GLOBAL (CRUCIAL PARA TROCA DE ABAS)
            // Varremos as listas que o Main.js usa para renderizar as telas
            const listas = [window.gruposFuncionariosGlobais, window.gruposFuncoesGlobais, window.pedidosCompletosGlobais];
            
            listas.forEach(lista => {
                if (!lista) return;
                lista.forEach(grupo => {
                    grupo.registrosOriginais?.forEach(p => {
                        // No seu Main.js, Aditivos Extras ficam no campo 'statusaditivoextra'
                        if (p.statusaditivoextra && Array.isArray(p.statusaditivoextra)) {
                            p.statusaditivoextra.forEach(ad => {
                                if (String(ad.idAditivoExtra) === String(idAditivoExtra)) {
                                    console.log("🎯 Aditivo encontrado na memória e atualizado!");
                                    ad.status = statusFormatado;
                                    // Ativamos a flag para o renderizador encontrar este item na aba de destino
                                    p.temMatch = true; 
                                }
                            });
                        }
                    });
                });
            });

            // 2. REMOÇÃO VISUAL
            if (cardElement) {
                cardElement.style.transition = 'all 0.3s ease';
                cardElement.style.opacity = '0';
                cardElement.style.transform = 'scale(0.8)';
                setTimeout(() => {
                    cardElement.remove();
                    // Limpa o cabeçalho do grupo se não houver mais cards
                    const corpo = document.querySelector('.funcionario-body:has(.pedido-card)'); // Exemplo de seletor
                    if (corpo && corpo.querySelectorAll('.pedido-card').length === 0) {
                         corpo.closest('.funcionario')?.remove();
                    }
                }, 300);
            }

            // 3. ATUALIZA OS CONTADORES (BADGES)
            if (typeof atualizarContadoresGlobais === 'function') {
                atualizarContadoresGlobais();
            }

            Swal.fire({ icon: 'success', title: 'Aditivo Atualizado!', timer: 1000, showConfirmButton: false });
            return true;
        } else {
            Swal.fire('Erro', response.erro || 'Falha na atualização', 'error');
            return false;
        }

    } catch (err) {
        if (typeof ocultarLoader === 'function') ocultarLoader(cardElement);
        console.error("❌ Erro ao atualizar aditivo:", err);
        return false;
    }
}


function atualizarContadoresGlobais() {
    console.log("🔢 Sincronizando contadores (Lógica Original Corrigida)...");

    ['pendente', 'autorizado', 'rejeitado'].forEach(st => {
        // 1. Seu cálculo original (que você confirmou que funciona)
        const totalFunc = (window.gruposFuncionariosGlobais || []).reduce((acc, g) => 
            acc + (g.registrosOriginais?.filter(r => 
                (r.status_aprovacao || 'pendente').toLowerCase().trim() === st
            ).length || 0), 0);
        
        const totalFuncs = (window.gruposFuncoesGlobais || []).reduce((acc, g) => 
            acc + (g.registrosOriginais?.filter(r => 
                (r.status_aprovacao || 'pendente').toLowerCase().trim() === st
            ).length || 0), 0);

        // 2. ATUALIZAÇÃO DOS BADGES (Usando os IDs reais do seu HTML)
        // IDs: funcionarios-list-count-pendente, funcoes-list-count-pendente...
        
        const elFunc = document.getElementById(`funcionarios-list-count-${st}`);
        if (elFunc) elFunc.textContent = totalFunc;

        const elFuncs = document.getElementById(`funcoes-list-count-${st}`);
        if (elFuncs) elFuncs.textContent = totalFuncs;
        
        console.log(`✅ Aba ${st}: Func(${totalFunc}) Funções(${totalFuncs})`);
    });
}


function processarContagensResumo(pedidosBrutos) {
    const contagens = { totalItens: 0, autorizados: 0, pendentes: 0, rejeitados: 0 };
    const chavesVistas = new Set(); 

    const camposSub = ["statusajustecusto", "statuscaixinha", "statusmeiadiaria", "statusdiariadobrada", "statusaditivoextra"];

    const definirStatus = (valor) => {
        if (!valor) return 'pendentes';
        
        let lista = [];
        try {
            if (typeof valor === 'string' && valor.startsWith('[')) lista = JSON.parse(valor);
            else if (Array.isArray(valor)) lista = valor;
            else if (typeof valor === 'object') lista = [valor];
            else lista = [{ status: valor }];
        } catch (e) { lista = [{ status: valor }]; }

        // Mapeia os status reais encontrados
        const statusEncontrados = lista.map(item => {
            const s = (item.status || item.status_aprovacao || item.toString()).toLowerCase();
            if (s.includes('rejeit') || s.includes('recus') || s.includes('negad')) return 'rejeitados';
            if (s.includes('autoriz') || s.includes('aprov')) return 'autorizados';
            return 'pendentes';
        });

        if (statusEncontrados.includes('rejeitados')) return 'rejeitados';
        if (statusEncontrados.includes('autorizados')) return 'autorizados';
        return 'pendentes';
    };

    pedidosBrutos.forEach(p => {
        const idBase = p.idpedido || p.idaditivoextra || 'sem-id';
        const func = (p.funcionario || p.nmfuncao || 'sem-nome').trim();
        const categorias = camposSub.filter(c => p[c] && p[c] !== '[]' && p[c] !== '');

        if (categorias.length > 0) {
            categorias.forEach(cat => {
                const chave = `${func}|${cat}|${idBase}`.toLowerCase();
                if (!chavesVistas.has(chave)) {
                    contagens[definirStatus(p[cat])]++;
                    chavesVistas.add(chave);
                }
            });
        } else {
            const chaveRaiz = `${func}|geral|${idBase}`.toLowerCase();
            if (!chavesVistas.has(chaveRaiz)) {
                // Aqui é o segredo: checar o status da raiz do pedido
                const stRaiz = (p.status_aprovacao || p.status || 'pendente').toLowerCase();
                let final = 'pendentes';
                if (stRaiz.includes('rejeit') || stRaiz.includes('recus')) final = 'rejeitados';
                else if (stRaiz.includes('autoriz') || stRaiz.includes('aprov')) final = 'autorizados';
                
                contagens[final]++;
                chavesVistas.add(chaveRaiz);
            }
        }
    });

    contagens.totalItens = contagens.pendentes + contagens.autorizados + contagens.rejeitados;
    return contagens;
}

async function atualizarResumoPedidos() {
    // 🛑 Adição das constantes padronizadas para comparação (Manter)
    const STATUS_PENDENTE_LOWER = (typeof STATUS_PENDENTE !== 'undefined' ? STATUS_PENDENTE : 'pendente').toLowerCase();
    const STATUS_AUTORIZADO_LOWER = (typeof STATUS_AUTORIZADO !== 'undefined' ? STATUS_AUTORIZADO : 'autorizado').toLowerCase();
    const STATUS_REJEITADO_LOWER = (typeof STATUS_REJEITADO !== 'undefined' ? STATUS_REJEITADO : 'rejeitado').toLowerCase();

    try {
        // 1. Busca os dados brutos (Inalterado)
        const [pedidosPadrao, aditivosExtras] = await Promise.all([
            buscarPedidosUsuario(),
            buscarAditivoExtraCompleto()
        ]);

        let pedidosUnificados = [...pedidosPadrao];

        // 2. Unificação Aditivo Extra (Inalterado, apenas a variável mudou de nome para clareza)
        aditivosExtras.forEach(ae => {
            const statusPadrao = typeof STATUS_PENDENTE !== 'undefined' ? STATUS_PENDENTE : 'pendente';
            const pedidoAditivo = {
                // ... (propriedades do Aditivo Extra)
                funcionario: ae.nomefuncionario, 
                evento: ae.evento, 
                idpedido: ae.idaditivoextra, 
                [CAMPO_ADITIVO_EXTRA]: {
                    status: (ae.status || ae.Status || statusPadrao).toLowerCase(),
                    tipoSolicitacao: ae.tipoSolicitacao || ae.tiposolicitacao || 'N/A',
                },
            };
            pedidosUnificados.push(pedidoAditivo);
        });

        // 🛑 V98.0: Não é necessário filtrar por chave de dedup aqui (a contagem granular já lida com isso)
        // Usamos toda a lista unificada para a contagem (397 + Aditivos)
        const pedidosBrutosUnificados = pedidosUnificados;
        
        // --- SEÇÃO 3: CONTAGEM UNIFICADA DE ITENS (NOVA LÓGICA) ---
        
        // 🛑 AQUI ESTÁ A CHAVE: Usamos a função processarContagensResumo
        // para contar os itens (sub-itens e pedidos principais sem sub-itens)
        const contagensExatas = processarContagensResumo(pedidosBrutosUnificados);
        
        const total = contagensExatas.totalItens;
        const autorizados = contagensExatas.autorizados;
        const pendentes = contagensExatas.pendentes;
        const rejeitados = contagensExatas.rejeitados;
        
        // -----------------------------------------------------------

        // 4. ATUALIZAÇÃO DO CARD - Implementação Defensiva (Inalterada)
        console.log(`[ATUALIZAÇÃO CARD] Total: ${total}, Autorizados: ${autorizados}, Pendentes: ${pendentes}, Rejeitados: ${rejeitados}`);

        const elTotal = document.getElementById("pedidosTotal");
        const elAutorizados = document.getElementById("pedidosAutorizados");
        const elPendentes = document.getElementById("pedidosPendentes");
        const elRecusados = document.getElementById("pedidosRecusados");

        // DEBUG: Confirma se os elementos estão sendo encontrados
        console.log(`[DEBUG DOM] Elemento Pendentes Encontrado? ${!!elPendentes}`); 

        // Atualiza APENAS se o elemento existir
        if (elTotal) {
            elTotal.textContent = total;
        } else {
            console.error("ERRO CRÍTICO: Não foi possível encontrar o elemento #pedidosTotal.");
        }
        if (elAutorizados) {
            elAutorizados.textContent = autorizados;
        } else {
            console.error("ERRO CRÍTICO: Não foi possível encontrar o elemento #pedidosAutorizados.");
        }
        if (elPendentes) {
            elPendentes.textContent = pendentes;
        } else {
            console.error("ERRO CRÍTICO: Não foi possível encontrar o elemento #pedidosPendentes.");
        }
        if (elRecusados) {
            elRecusados.textContent = rejeitados;
        } else {
            console.error("ERRO CRÍTICO: Não foi possível encontrar o elemento #pedidosRecusados.");
        }
    } catch (err) {
        console.error("Erro ao atualizar resumo de pedidos:", err);
    }
}

// NOTA: A função processarContagensResumo (V97.0) e safeParse devem estar disponíveis globalmente.

setInterval(atualizarResumoPedidos, 10000);
//setInterval(atualizarResumoPedidos, 500);

// Chamada inicial ao carregar a página
atualizarResumoPedidos();

//===============================FIM DA SEÇÃO DE PEDIDOS===============================



// ===========================
// Vencimentos de Pagamentos
// ===========================

function formatarMoeda(valor) {
    // 1. Garante que o valor é um número (float). Se for null/undefined/NaN, usa 0.
    const num = parseFloat(valor) || 0; // ✅ CORREÇÃO: Trata null, undefined, "", e NaN como 0.

    // 2. Formata para o padrão Brasileiro
    return num.toLocaleString('pt-BR', { // .toLocaleString é apenas um alias para o Intl.NumberFormat().format()
        style: 'currency',
        currency: 'BRL',
    });
}

function formatarStatusFront(status) {
    if (!status || status === 'Pendente') return "Pendente";
    if (status === "Pago") return "Pago 100%";
    if (status.startsWith("Pago") && !status.includes("%")) {
        const valor = status.replace("Pago", "");
        return valor ? `Pago ${valor}%` : "Pago 100%";
    }
    return status;
}

async function carregarDetalhesVencimentos(conteudoGeral, valoresResumoElement) { 
    // Segurança: Se o container principal não existir, interrompe a função
    if (!conteudoGeral) return;

    conteudoGeral.innerHTML = '<h3>Carregando dados...</h3>';
    
    if (valoresResumoElement) {
        valoresResumoElement.innerHTML = '';
    }

    const params = construirParametrosFiltro();
    const url = `/main/vencimentos${params}`;

    try {
        const dados = await fetchComToken(url);
        
        let totalAjudaPendente = 0;
        let totalAjudaPaga = 0;
        let totalCachePendente = 0;
        let totalCachePago = 0;
        
        let temDados = dados && dados.eventos && dados.eventos.length > 0;

        if (!temDados) {
            conteudoGeral.innerHTML = '<p class="alerta-info">Nenhum evento encontrado para esse período.</p>';
        } else {
            conteudoGeral.innerHTML = "";
            const accordionContainer = document.createElement("div");
            accordionContainer.className = "accordion-vencimentos";

            dados.eventos.forEach(evento => {
                // Os nomes aqui devem bater com o que o backend envia no objeto 'evento'
                const ajudaPendente = evento.ajuda?.pendente || 0;
                const ajudaPaga = evento.ajuda?.pagos || 0;
                const cachePendente = evento.cache?.pendente || 0;
                const cachePaga = evento.cache?.pagos || 0;

                totalAjudaPendente += ajudaPendente;
                totalAjudaPaga += ajudaPaga;
                totalCachePendente += cachePendente;
                totalCachePago += cachePaga;

                const item = document.createElement("div");
                item.className = "accordion-item";

                const header = document.createElement("button");
                header.className = "accordion-header";
                header.innerHTML = `
                    <div class="evento-info">
                        <strong>${evento.nomeEvento}</strong>
                        <span class="total-geral">Total: ${formatarMoeda(evento.totalGeral)}</span> 
                    </div>
                `;
                header.addEventListener("click", () => item.classList.toggle("active"));

                const body = document.createElement("div");
                body.className = "accordion-body";

                body.innerHTML = `
                    <div class="resumo-categorias">
                        <div class="categoria-bloco">
                            <h3>Ajuda de Custo</h3>
                            <p class="datas-evento">
                                Período Evento: <strong>${evento.dataInicioEvento}</strong> a <strong>${evento.dataFimEvento}</strong>
                            </p>
                            <p class="vencimento">Vence em: <strong>${evento.dataVencimentoAjuda}</strong></p>
                            <p><strong>Pendentes:</strong> ${formatarMoeda(ajudaPendente)} - <strong>Pagos:</strong> ${formatarMoeda(ajudaPaga)}</p>
                        </div>
                        <div class="categoria-bloco">
                            <h3>Cachê</h3>
                            <p class="datas-evento">
                                Período Evento: <strong>${evento.dataInicioEvento}</strong> a <strong>${evento.dataFimEvento}</strong>
                            </p>
                            <p class="vencimento">Vence em: <strong>${evento.dataVencimentoCache}</strong></p>
                            <p><strong>Pendentes:</strong> ${formatarMoeda(cachePendente)} - <strong>Pagos:</strong> ${formatarMoeda(cachePaga)}</p>
                        </div>
                    </div>

                    <h4>Funcionários (${evento.funcionarios?.length || 0} Registros):</h4>
                    
                    <div class="funcionarios-scroll-container"> 
                        <table class="tabela-funcionarios-venc">
                            <thead>
                                <tr>
                                    <th>NOME / FUNÇÃO</th>
                                    <th>DIÁRIAS</th>
                                    ${usuarioTemPermissao() ? '<th>AÇÕES CACHÊ</th>' : ''}
                                    <th>CACHÊ</th>
                                    <th>STATUS CACHÊ</th>
                                    ${usuarioTemPermissao() ? '<th>AÇÕES A.J.CUSTO</th>' : ''}
                                    <th>A.J. CUSTO</th>
                                    <th>STATUS A.J.CUSTO</th>
                                    <th>TOTAL</th>
                                </tr>
                            </thead>
                            <tbody>
                            ${evento.funcionarios?.map(f => {
                                    const statusCache = formatarStatusFront(f.statuspgto);
                                    const statusAjuda = formatarStatusFront(f.statuspgtoajdcto);
                                    
                                    // As classes CSS também devem usar o status formatado para manter a cor correta
                                    const classeCache = statusCache.toLowerCase().replace(/\s+/g, '-').replace('%', '');
                                    const classeAjuda = statusAjuda.toLowerCase().replace(/\s+/g, '-').replace('%', '');


                                    // Se já estiver 100% Pago, mantém a célula mas remove os botões (mostra ícone fixo)
                                    const renderBotaoAcao = (tipo, statusAtual) => {
                                        if (!usuarioTemPermissao()) return '';

                                        // Caso 1: Pago (Bloqueado)
                                        if (statusAtual === 'Pago' || statusAtual === 'Pago 100%') {
                                            return `
                                                <td class="acoes-master">
                                                    <div class="btn-group-acoes">
                                                        <span class="check-finalizado"><i class="fas fa-lock"></i></span>
                                                    </div>
                                                </td>`; 
                                        }

                                        // Caso 2: Pago 50% (Botão de complemento)
                                        if (statusAtual === 'Pago 50%') {
                                            return `
                                                <td class="acoes-master">
                                                    <div class="btn-group-acoes">
                                                        <button class="btn-complementar" title="Pagar os 50% restantes" 
                                                            onclick="alterarStatusStaff(${f.idstaffevento}, '${tipo}', 'Pago 100%')">
                                                            <i class="fas fa-plus-circle"></i> +50%
                                                        </button>
                                                    </div>
                                                </td>`;
                                        }

                                        // Caso 3: Pendente (Botões padrão)
                                        return `
                                            <td class="acoes-master">
                                                <div class="btn-group-acoes">
                                                    <button class="btn-pago" onclick="alterarStatusStaff(${f.idstaffevento}, '${tipo}', 'Pago')">
                                                        <i class="fas fa-check"></i> Pago
                                                    </button>
                                                    <button class="btn-suspenso" onclick="alterarStatusStaff(${f.idstaffevento}, '${tipo}', 'Suspenso')">
                                                        <i class="fas fa-pause"></i> Suspender
                                                    </button>
                                                </div>
                                            </td>`;
                                    };
                                    return `
                                        <tr>
                                            <td><strong>${f.nome}</strong><br><small>${f.funcao}</small></td>
                                            <td>${f.qtddiarias || 0}</td>
                                            
                                            <td class="acoes-master col-acoes-cache">
                                                ${renderConteudoAcao(f.idstaffevento, 'Cache', statusCache)}
                                            </td>
                                            <td>${formatarMoeda(f.totalcache || 0)}</td>
                                            <td class="status-celula status-${classeCache} col-status-cache">${statusCache}</td>
                                            
                                            <td class="acoes-master col-acoes-ajuda">
                                                ${renderConteudoAcao(f.idstaffevento, 'Ajuda', statusAjuda)}
                                            </td>
                                            <td>${formatarMoeda(f.totalajudacusto || 0)}</td>
                                            <td class="status-celula status-${classeAjuda} col-status-ajuda">${statusAjuda}</td>
                                            
                                            <td><strong>${formatarMoeda(f.totalpagar || 0)}</strong></td>
                                        </tr>`;
                                }).join("")}
                            </tbody>
                        </table>
                    </div> 
                `;

                item.appendChild(header);
                item.appendChild(body);
                accordionContainer.appendChild(item);
            });

            conteudoGeral.appendChild(accordionContainer);
        }

        // 4. Atualiza a DIV de resumo
        if (valoresResumoElement) {
            const totalPagarGeral = totalAjudaPendente + totalCachePendente;
            const totalPagoGeral = totalAjudaPaga + totalCachePago;
            
            valoresResumoElement.innerHTML = `
                <div class="resumo-detalhado">
                    <div class="resumo-status">
                        <div class="bloco-pendente">
                            <h4>A Pagar (Pendente)</h4>
                            <span class="valor-pendente">${formatarMoeda(totalPagarGeral)}</span>
                        </div>
                        <div class="bloco-pago">
                            <h4>Pago (Total e Parcial)</h4>
                            <span class="valor-pago">${formatarMoeda(totalPagoGeral)}</span>
                        </div>
                    </div>
                    <div class="resumo-categorias-totais">
                        <div>
                            <label><strong>Ajuda de Custo:</strong></label>
                            <p>Pendente: ${formatarMoeda(totalAjudaPendente)} / Pago: ${formatarMoeda(totalAjudaPaga)}</p>
                        </div>
                        <div>
                            <label><strong>Cachê:</strong></label>
                            <p>Pendente: ${formatarMoeda(totalCachePendente)} / Pago: ${formatarMoeda(totalCachePago)}</p>
                        </div>
                    </div>
                </div>
            `;
        }

    } catch (error) {
        console.error("Erro ao carregar detalhes:", error);
        conteudoGeral.innerHTML = '<p class="alerta-erro">Erro ao carregar dados do servidor.</p>';
    }
}

function exibirToastSucesso(mensagem = 'Status atualizado!') {
    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2000,
        timerProgressBar: true
    });
    Toast.fire({ icon: 'success', title: mensagem });
}

async function alterarStatusStaff(idStaff, tipo, novoStatus, elementoBotao) {
    const btnClicado = elementoBotao;
    const linhaTr = btnClicado ? btnClicado.closest('tr') : null;
    let statusParaEnviar = novoStatus;

    // LÓGICA DO SWAL PARA AJUDA DE CUSTO (50% ou 100%)
    if (tipo === 'Ajuda' && novoStatus === 'Pago') {
        const { value: opcao } = await Swal.fire({
            title: 'Pagamento Ajuda de Custo',
            text: 'Escolha a modalidade do pagamento:',
            icon: 'question',
            showDenyButton: true,
            showCancelButton: true,
            confirmButtonText: 'Pago 100%',
            denyButtonText: 'Pago 50%',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#28a745',
            denyButtonColor: '#17a2b8',
        });

        if (opcao === true) { // Clicou em Pago 100%
            statusParaEnviar = 'Pago 100%';
        } else if (Swal.getDenyButton() && opcao === false) { // Clicou em Pago 50%
            // Nota: O Swal retorna false para o Deny Button se não configurado retorno específico
            statusParaEnviar = 'Pago 50%';
        } else {
            return; // Usuário cancelou, encerra a função
        }
    }

    try {
        const response = await fetch(`/main/vencimentos/update-status`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}` 
            },
            body: JSON.stringify({ idStaff, tipo, novoStatus: statusParaEnviar })
        });

        if (response.ok) {
            exibirToastSucesso(`Status atualizado para ${statusParaEnviar}`);

            if (linhaTr) {
                const sufixo = tipo.toLowerCase() === 'cache' ? 'cache' : 'ajuda';
                const celulaAcoes = linhaTr.querySelector(`.col-acoes-${sufixo}`);
                const celulaStatus = linhaTr.querySelector(`.col-status-${sufixo}`);

                // Atualiza o Status Visual na tabela
                if (celulaStatus) {
                    const classeStatus = statusParaEnviar.toLowerCase().replace(/\s+/g, '-').replace('%', '');
                    celulaStatus.className = `status-celula status-${classeStatus} col-status-${sufixo}`;
                    celulaStatus.innerText = statusParaEnviar;
                }

                // Atualiza os Botões na tabela
                if (celulaAcoes) {
                    celulaAcoes.innerHTML = renderConteudoAcao(idStaff, tipo, statusParaEnviar);
                }
            }

            // Atualiza os cards de totais no topo (opcional, mas recomendado)
            if (typeof carregarDadosVencimentos === "function") {
                const filtroAno = document.getElementById('filtroAnoVencimentos')?.value || 2026;
                carregarDadosVencimentos(filtroAno);
            }
        }
    } catch (error) {
        console.error("Erro ao atualizar:", error);
        Swal.fire('Erro', 'Não foi possível atualizar o status.', 'error');
    }
}

function renderConteudoAcao(idStaff, tipo, statusAtual) {
    // Se estiver 100% ou Pago (Cache), mostra cadeado
    if (statusAtual === 'Pago' || statusAtual === 'Pago 100%') {
        return `<div class="btn-group-acoes"><span class="check-finalizado"><i class="fas fa-lock"></i></span></div>`;
    }

    // Se estiver 50%, mostra botão para completar o resto
    if (statusAtual === 'Pago 50%') {
        return `
            <div class="btn-group-acoes">
                <button class="btn-complementar" title="Pagar os 50% restantes" 
                    onclick="alterarStatusStaff(${idStaff}, '${tipo}', 'Pago 100%', this)">
                    <i class="fas fa-plus-circle"></i> +50%
                </button>
            </div>`;
    }

    // Pendente / Suspenso
    return `
        <div class="btn-group-acoes">
            <button class="btn-pago" onclick="alterarStatusStaff(${idStaff}, '${tipo}', 'Pago', this)">
                <i class="fas fa-check"></i> Pago
            </button>
            <button class="btn-suspenso" onclick="alterarStatusStaff(${idStaff}, '${tipo}', 'Suspenso', this)">
                <i class="fas fa-pause"></i> Suspenso
            </button>
        </div>`;
}

window.alterarStatusStaff = alterarStatusStaff;


function construirParametrosFiltro() {
    // Captura o tipo de filtro principal (Obrigatório para o backend)
    const tipo = document.querySelector("input[name='periodo']:checked")?.value || 'diario';
    
    // Inicia a string de parâmetros com o tipo
    let params = `?periodo=${tipo}`;
    
    // Variável para o ano, usada em vários filtros
    const anoAtual = new Date().getFullYear(); 

    // ----------------------------------------------------
    // DIÁRIO
    // ----------------------------------------------------
    if (tipo === "diario") {
        const dia = document.querySelector("#sub-filtro-data")?.value;
        // O backend deve usar a dataInicio e a dataFim como o mesmo dia
        if (dia) {
      params += `&dataInicio=${dia}&dataFim=${dia}`;
        }
    }

    // ----------------------------------------------------
    // ✅ SEMANAL (NOVO BLOCO INSERIDO)
    // ----------------------------------------------------
    else if (tipo === "semanal") {
        const data = document.querySelector("#sub-filtro-data")?.value;
        // O backend usará esta data para calcular o Domingo anterior e o Sábado seguinte.
        if (data) {
      params += `&dataInicio=${data}`;
        }
    }

    // ----------------------------------------------------
    // MENSAL
    // ----------------------------------------------------
    else if (tipo === "mensal") {
        const mes = document.querySelector("#sub-filtro-select")?.value;
        if (mes) {
      // Envia mês e ano. O backend deve calcular dataInicio (dia 1) e dataFim (último dia).
      params += `&mes=${mes}&ano=${anoAtual}`;
        }
    }

    // ----------------------------------------------------
    // TRIMESTRAL
    // ----------------------------------------------------
    else if (tipo === "trimestral") {
        // Usa o seletor genérico 'sub' que criamos
        const tri = document.querySelector("input[name='sub']:checked")?.value;
        if (tri) {
      // Envia trimestre e ano. O backend deve calcular as datas de início e fim.
      params += `&trimestre=${tri}&ano=${anoAtual}`;
        }
    }

    // ----------------------------------------------------
    // SEMESTRAL
    // ----------------------------------------------------
    else if (tipo === "semestral") {
        // Usa o seletor genérico 'sub' que criamos
        const sem = document.querySelector("input[name='sub']:checked")?.value;
        if (sem) {
      // Envia semestre e ano. O backend deve calcular as datas de início e fim.
      params += `&semestre=${sem}&ano=${anoAtual}`;
        }
    }

    // ----------------------------------------------------
    // ANUAL
    // ----------------------------------------------------
    else if (tipo === "anual") {
        // Envia apenas o ano. O backend deve calcular dataInicio (Jan 1) e dataFim (Dez 31).
        params += `&ano=${anoAtual}`;
    }
    
    return params;
}


//     // Definir data de hoje (YYYY-MM-DD)
//     const hoje = new Date();
//     const ano = hoje.getFullYear();
//     const mes = String(hoje.getMonth() + 1).padStart(2, '0');
//     const dia = String(hoje.getDate()).padStart(2, '0');
//     const dataAtualFormatada = `${ano}-${mes}-${dia}`;
//     // Data de referência (sem hora) para comparação
//     const dataComparacao = new Date(dataAtualFormatada + 'T00:00:00'); 

//     // URL para buscar todos os vencimentos no ANO atual.
//     const urlResumo = `/main/vencimentos?periodo=anual&ano=${ano}`;

//     // 🎯 Capturando os elementos
//     const cardVencimentos = document.getElementById('cardContainerVencimentos');
    
//     // Elementos de TOTAIS (Header)
//     const vencimentosTotalElement = document.getElementById('vencimentosTotal'); // Total Previsto
//     const vencimentosPagosElement = document.getElementById('vencimentosPagos'); // ✅ NOVO: Total Pagos

//     // Elementos DETALHADOS (Grupos)
//     const vencAjudaAVencerElement = document.getElementById('vencAjudaAVencer');
//     const vencCacheAVencerElement = document.getElementById('vencCacheAVencer');
//     const vencAjudaVencidosElement = document.getElementById('vencAjudaVencidos');
//     const vencCacheVencidosElement = document.getElementById('vencCacheVencidos');
    
//     // ✅ NOVO: Elementos Detalhados Pagos
//     const vencAjudaPagosElement = document.getElementById('vencAjudaPagos');
//     const vencCachePagosElement = document.getElementById('vencCachePagos');

//     // Verificação de existência dos elementos
//     if (!vencimentosTotalElement || !vencimentosPagosElement || !vencAjudaAVencerElement || 
//         !vencCacheAVencerElement || !vencAjudaVencidosElement || !vencCacheVencidosElement ||
//         !vencAjudaPagosElement || !vencCachePagosElement) {
        
//         console.error("Erro: Um ou mais elementos do card de vencimentos não foram encontrados no DOM. Verifique as IDs.");
//         return;
//     }
    
//     // Inicializa somadores DETALHADOS
//     let totalGeralPrevisto = 0; // Soma de A VENCER + VENCIDOS
//     let ajudaAVencer = 0;
//     let cacheAVencer = 0;
//     let ajudaVencidos = 0;
//     let cacheVencidos = 0;

//     // ✅ NOVO: Inicializa somadores PAGOS
//     let ajudaPagos = 0;
//     let cachePagos = 0;
    
//     try {
//         const dadosResumo = await fetchComToken(urlResumo); 

//         if (dadosResumo && dadosResumo.eventos && dadosResumo.eventos.length > 0) {
            
//             dadosResumo.eventos.forEach(evento => {
                
//                 // ------------------------------------
//                 // 1. Lógica de PENDENTES (A VENCER vs. VENCIDOS)
//                 // ------------------------------------
//                 const ajudaPendente = evento.ajuda.pendente || 0;
//                 if (ajudaPendente > 0 && evento.dataVencimentoAjuda && evento.dataVencimentoAjuda !== 'N/A') {
                    
//                     const [d, m, y] = evento.dataVencimentoAjuda.split('/').map(n => parseInt(n, 10));
//                     const dataVencimentoAjuda = new Date(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T00:00:00`);

//                     if (dataVencimentoAjuda < dataComparacao) {
//                         ajudaVencidos += ajudaPendente; 
//                     } else {
//                         ajudaAVencer += ajudaPendente; 
//                     }
//                     totalGeralPrevisto += ajudaPendente;
//                 }

//                 const cachePendente = evento.cache.pendente || 0;
//                 if (cachePendente > 0 && evento.dataVencimentoCache && evento.dataVencimentoCache !== 'N/A') {
                    
//                     const [d, m, y] = evento.dataVencimentoCache.split('/').map(n => parseInt(n, 10));
//                     const dataVencimentoCache = new Date(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T00:00:00`);

//                     if (dataVencimentoCache < dataComparacao) {
//                         cacheVencidos += cachePendente; 
//                     } else {
//                         cacheAVencer += cachePendente; 
//                     }
//                     totalGeralPrevisto += cachePendente;
//                 }
                
//                 // ------------------------------------
//                 // ✅ 2. Lógica de PAGOS (Valores explícitos do Servidor)
//                 // ------------------------------------
//                 ajudaPagos += evento.ajuda.pagos || 0;
//                 cachePagos += evento.cache.pagos || 0;
                
//             });
//         }
        
//         const totalGeralPagos = ajudaPagos + cachePagos;

//         // 🎯 ATUALIZAÇÃO DO CARD (TODOS COM formatarMoeda)
        
//         // 1. Header
//         vencimentosTotalElement.textContent = formatarMoeda(totalGeralPrevisto); // Previsto (Pendentes: A Vencer + Vencidos)
//         vencimentosPagosElement.textContent = formatarMoeda(totalGeralPagos);    // ✅ NOVO: Pagos (Total)
        
//         // 2. A Vencer (Detalhado)
//         vencAjudaAVencerElement.textContent = formatarMoeda(ajudaAVencer); 
//         vencCacheAVencerElement.textContent = formatarMoeda(cacheAVencer); 
        
//         // 3. Vencidos (Detalhado)
//         vencAjudaVencidosElement.textContent = formatarMoeda(ajudaVencidos); 
//         vencCacheVencidosElement.textContent = formatarMoeda(cacheVencidos); 
        
//         // 4. Pagos (Detalhado)
//         vencAjudaPagosElement.textContent = formatarMoeda(ajudaPagos);          // ✅ NOVO: Ajuda Paga
//         vencCachePagosElement.textContent = formatarMoeda(cachePagos);          // ✅ NOVO: Cachê Pago
        
//         if (totalGeralPrevisto > 0 || totalGeralPagos > 0) {
//             cardVencimentos.style.display = 'block';
//         } else {
//             cardVencimentos.style.display = 'none';
//         }

//     } catch (error) {
//         console.error("Erro ao carregar dados do card de vencimentos:", error);
//         // Em caso de erro, zera os valores de forma consistente
//         vencimentosTotalElement.textContent = `R$ 0,00`;
//         vencimentosPagosElement.textContent = `R$ 0,00`;
//         vencAjudaAVencerElement.textContent = `R$ 0,00`; 
//         vencCacheAVencerElement.textContent = `R$ 0,00`; 
//         vencAjudaVencidosElement.textContent = `R$ 0,00`; 
//         vencCacheVencidosElement.textContent = `R$ 0,00`; 
//         vencAjudaPagosElement.textContent = `R$ 0,00`; 
//         vencCachePagosElement.textContent = `R$ 0,00`; 
//     }
// }

// 1. Gatilho para o Select
window.carregarDadosDoFiltro = function() {
    const select = document.getElementById('selectAno');
    if (select) {
        console.log("Filtrando para o ano:", select.value);
        carregarDadosVencimentos(parseInt(select.value, 10));
    }
};

function configurarSelectAno() {
    const select = document.getElementById('selectAno');
    if (!select) return;

    const anoAtual = new Date().getFullYear();
    const anosParaExibir = [anoAtual - 1, anoAtual, anoAtual + 1]; // Ex: 2024, 2025, 2026

    // Limpa opções existentes
    select.innerHTML = '';

    anosParaExibir.forEach(ano => {
        const option = document.createElement('option');
        option.value = ano;
        option.textContent = ano;
        
        // Define o ano vigente como selecionado
        if (ano === anoAtual) {
            option.selected = true;
        }
        
        select.appendChild(option);
    });

    // Após configurar, carrega os dados do ano atual pela primeira vez
    carregarDadosVencimentos(anoAtual);
}

// Chame esta função quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    configurarSelectAno();
    // outras inicializações...
});

async function carregarDadosVencimentos(anoFiltro) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const ano = anoFiltro || hoje.getFullYear();
    const url = `/main/vencimentos?periodo=anual&ano=${ano}`;

    try {
        const dados = await fetchComToken(url);
        
        let soma = {
            previsto: 0, pagos: 0, 
            ajAVencer: 0, ajVencidos: 0, ajPagos: 0,
            chAVencer: 0, chVencidos: 0, chPagos: 0
        };

        if (dados && dados.eventos) {
            dados.eventos.forEach(ev => {
                // --- AJUDA DE CUSTO ---
                const ajPendente = parseFloat(ev.ajuda.pendente) || 0;
                const ajJaPago = parseFloat(ev.ajuda.pagos) || 0;

                // Regra: Soma no card de PAGOS tudo que já foi pago (Total ou 50%)
                soma.ajPagos += ajJaPago;

                // Regra: Se ainda tem algo pendente, verifica o vencimento
                if (ajPendente > 0) {
                    const [da, ma, ya] = ev.dataVencimentoAjuda.split('/').map(Number);
                    const dtAj = new Date(ya, ma - 1, da);
                    
                    if (dtAj < hoje) {
                        soma.ajVencidos += ajPendente;
                    } else {
                        soma.ajAVencer += ajPendente;
                    }
                }

                // --- CACHÊ ---
                const chPendente = parseFloat(ev.cache.pendente) || 0;
                const chJaPago = parseFloat(ev.cache.pagos) || 0;

                // Soma o que já foi pago de Cachê
                soma.chPagos += chJaPago;

                // Se houver cachê pendente, calcula se está vencido
                if (chPendente > 0 && ev.dataVencimentoCache !== 'N/A') {
                    const [dc, mc, yc] = ev.dataVencimentoCache.split('/').map(Number);
                    const dtCh = new Date(yc, mc - 1, dc);
                    
                    if (dtCh < hoje) {
                        soma.chVencidos += chPendente;
                    } else {
                        soma.chAVencer += chPendente;
                    }
                }
            });
        }

        // Cálculos dos Totais Gerais dos Cards Superiores
        soma.previsto = soma.ajAVencer + soma.ajVencidos + soma.chAVencer + soma.chVencidos;
        soma.pagos = soma.ajPagos + soma.chPagos;

        // Função auxiliar para injetar os valores no HTML
        const atualizarTexto = (id, valor) => {
            const el = document.getElementById(id);
            if (el) el.textContent = formatarMoeda(valor);
        };

        // Atualização Visual
        atualizarTexto('vencimentosTotal', soma.previsto);
        atualizarTexto('vencimentosPagos', soma.pagos);
        
        atualizarTexto('vencAjudaAVencer', soma.ajAVencer);
        atualizarTexto('vencAjudaVencidos', soma.ajVencidos);
        atualizarTexto('vencAjudaPagos', soma.ajPagos);
        
        atualizarTexto('vencCacheAVencer', soma.chAVencer);
        atualizarTexto('vencCacheVencidos', soma.chVencidos);
        atualizarTexto('vencCachePagos', soma.chPagos);

        if (document.getElementById('cardContainerVencimentos')) {
            document.getElementById('cardContainerVencimentos').style.display = 'block';
        }

    } catch (error) {
        console.error("Erro ao carregar dados financeiros:", error);
    }
}

async function inicializarCardVencimentos() {
    // Checa as duas permissões (Assumindo que estão definidas globalmente)
    const eMaster = usuarioTemPermissao();
    const eFinanceiro = usuarioTemPermissaoFinanceiro();

    // Seleciona os containers principais
    const cardVencimentos = document.getElementById('cardContainerVencimentos');
    const cardOrcamentos = document.getElementById('cardContainerOrcamentos');

    if (!cardVencimentos || !cardOrcamentos) {
        console.warn("Um dos cards não foi encontrado (Vencimentos ou Orçamentos).");
        return;
    }

    // Padrão: Ambos ocultos, depois exibimos o(s) necessário(s)
    cardVencimentos.style.display = 'none';
    cardOrcamentos.style.display = 'none';
    
    // ===========================================
    // Lógica de Visibilidade
    // ===========================================
    
    if (eMaster || eFinanceiro) {
        // Se for Master OU Financeiro: Mostra VENCIMENTOS
        cardVencimentos.style.display = 'flex';
        carregarDadosVencimentos(); // Chama a função que preenche o card
    }

    if (eMaster) {
        // Se for Master: Mostra ORÇAMENTOS também
        cardOrcamentos.style.display = 'flex';
    } 
    else if (!eMaster && !eFinanceiro) {
         // Se for Nenhum (não Master e não Financeiro): Mostra APENAS ORÇAMENTOS
        cardOrcamentos.style.display = 'flex';
    }
}

function criarControlesDeFiltro(conteudoGeral, valoresResumoElement) { 
    const anoAtual = new Date().getFullYear();

    const filtrosContainer = document.createElement("div");
    filtrosContainer.className = "filtros-vencimentos";

    // ------------------------------
    // 1. Filtro Principal (RADIO CUSTOM)
    // ------------------------------
    const grupoPeriodo = document.createElement("div");
    grupoPeriodo.className = "filtro-periodo";
    grupoPeriodo.innerHTML = `
      <label class="label-select">Tipo de Filtro</label>
      <div class="wrapper" id="periodo-wrapper">
        <div class="option">
            <input checked value="diario" name="periodo" type="radio" class="input" />
            <div class="btn"><span class="span">Diário</span></div>
        </div>
        <div class="option">
          <input value="semanal" name="periodo" type="radio" class="input" />
          <div class="btn"><span class="span">Semanal</span></div>
        </div>
        <div class="option">
          <input value="mensal" name="periodo" type="radio" class="input" />
          <div class="btn"><span class="span">Mensal</span></div>
        </div>
        <div class="option">
          <input value="trimestral" name="periodo" type="radio" class="input" />
          <div class="btn"><span class="span">Trimestral</span></div>
        </div>
        <div class="option">
          <input value="semestral" name="periodo" type="radio" class="input" />
          <div class="btn"><span class="span">Semestral</span></div>
        </div>
        <div class="option">
          <input value="anual" name="periodo" type="radio" class="input" />
          <div class="btn"><span class="span">Anual</span></div>
        </div>
      </div>
`;

    filtrosContainer.appendChild(grupoPeriodo);

    // ------------------------------
    // 2. Sub-Filtro (DINÂMICO, TB CUSTOM)
    // ------------------------------
    const subFiltroWrapper = document.createElement("div");
    subFiltroWrapper.id = "sub-filtro-wrapper";
    subFiltroWrapper.className = "sub-filtro";
    filtrosContainer.appendChild(subFiltroWrapper);


    // --------------------------------------
    // FUNÇÃO PARA CRIAR BOTÕES CUSTOMIZADOS
    // --------------------------------------
    function montarOpcoes(titulo, valores) {
        return `
            <label class="label-select">${titulo}</label>
            <div class="wrapper" id="sub-opcoes">
                ${valores.map(v => `
                    <div class="option">
                        <input value="${v.value}" name="sub" type="radio" class="input" ${v.checked ? "checked" : ""} />
                        <div class="btn"><span class="span">${v.label}</span></div>
                    </div>
                `).join("")}
            </div>
        `;
    }

    // ------------------------------
    //  FUNÇÃO PARA ATUALIZAR SUB-FILTRO
    // ------------------------------

    function atualizarSubFiltro(tipo) {
        // Limpa o conteúdo anterior do sub-filtro
        subFiltroWrapper.innerHTML = "";

        // O ano atual (anoAtual)
        const anoAtual = new Date().getFullYear(); 

        // --------------------------
        // 1. DIÁRIO → INPUT DE DATA
        // --------------------------
        if (tipo === "diario") {
            // Data atual como padrão
            const hoje = new Date().toISOString().split("T")[0];

            subFiltroWrapper.innerHTML = `
                <label class="label-select">Selecione o Dia</label>

                <div class="wrapper select-wrapper">
                    <input 
                        type="date"
                        id="sub-filtro-data"
                        class="input-data-simples" 
                        value="${hoje}"
                    >
                </div>
            `;

            // Aciona o carregamento ao mudar a data (listener)
            subFiltroWrapper
            .querySelector("#sub-filtro-data")
            .addEventListener("change", () => 
                carregarDetalhesVencimentos(conteudoGeral, valoresResumoElement) // ✅ PASSANDO
            );

            // Dispara a busca Imediatamente com o filtro padrão (hoje)
            carregarDetalhesVencimentos(conteudoGeral, valoresResumoElement); // ✅ PASSANDO

            return; 
        }

        // --------------------------
        // 2. SEMANAL → INPUT DE DATA
        // --------------------------
        else if (tipo === "semanal") {
            // Data atual como padrão
            const hoje = new Date().toISOString().split("T")[0]; 

            subFiltroWrapper.innerHTML = `
                <label class="label-select">Selecione uma data na semana</label>

                <div class="wrapper select-wrapper">
                    <input 
                        type="date"
                        id="sub-filtro-data"
                        class="input-data-simples" 
                        value="${hoje}"
                    >
                </div>
            `;

            // Aciona o carregamento ao mudar a data (listener)
            subFiltroWrapper
            .querySelector("#sub-filtro-data")
            .addEventListener("change", () => 
            carregarDetalhesVencimentos(conteudoGeral, valoresResumoElement) // ✅ PASSANDO
            );

            // Dispara a busca Imediatamente com o filtro padrão (hoje)
            carregarDetalhesVencimentos(conteudoGeral, valoresResumoElement); // ✅ PASSANDO

            return;
        }


        // --------------------------
        // 3. MENSAL → SELECT ESTILIZADO
        // --------------------------
        else if (tipo === "mensal") { 
            let optionsHtml = "";
            const mesAtual = new Date().getMonth() + 1; // 1 a 12

            for (let i = 1; i <= 12; i++) {
                const isCurrentMonth = (i === mesAtual);
                optionsHtml += `
                    <option value="${i}" ${isCurrentMonth ? "selected" : ""}>
                        ${nomeDoMes(i)} / ${anoAtual}
                    </option>
                `;
            }

            subFiltroWrapper.innerHTML = `
                <label class="label-select">Selecione o Mês</label>
                <div class="wrapper select-wrapper">
                    <select id="sub-filtro-select" class="select-simples">
                        ${optionsHtml}
                    </select>
                </div>
            `;

            // Aciona o carregamento ao mudar o mês (listener)
            subFiltroWrapper.querySelector("#sub-filtro-select")
            .addEventListener("change", () => carregarDetalhesVencimentos(conteudoGeral, valoresResumoElement)); // ✅ PASSANDO

            // Dispara a busca Imediatamente com o filtro padrão (mês atual)
            carregarDetalhesVencimentos(conteudoGeral, valoresResumoElement); // ✅ PASSANDO

            return;
        }

        // --------------------------
        // 4. TRIMESTRAL → RADIO CUSTOM
        // --------------------------
        else if (tipo === "trimestral") {
            const mesAtual = new Date().getMonth() + 1; // 1 a 12
            const trimestreAtual = Math.ceil(mesAtual / 3); // 1, 2, 3 ou 4

            const trimes = [1, 2, 3, 4].map(t => ({
                value: t,
                label: `Trimestre ${t} / ${anoAtual}`,
                checked: t === trimestreAtual
            }));

            subFiltroWrapper.innerHTML = montarOpcoes("Selecione o Trimestre", trimes);
        }

        // --------------------------
        // 5. SEMESTRAL → RADIO CUSTOM
        // --------------------------
        else if (tipo === "semestral") {
            const mesAtual = new Date().getMonth() + 1; // 1 a 12
            const semestreAtual = mesAtual <= 6 ? 1 : 2; // 1 ou 2

            const semestres = [
                { value: 1, label: `1º Semestre / ${anoAtual}`, checked: semestreAtual === 1 },
                { value: 2, label: `2º Semestre / ${anoAtual}`, checked: semestreAtual === 2 }
            ];

            subFiltroWrapper.innerHTML = montarOpcoes("Selecione o Semestre", semestres);
        }


        // --------------------------
        // 6. ANUAL → Exibe Ano Atual
        // --------------------------
        else if (tipo === "anual") {
            subFiltroWrapper.innerHTML = `
                <label class="label-select">Período Anual</label>
                <p class="anual-info">Eventos do ano de ${anoAtual}</p>
            `;

            // Dispara a busca Imediatamente com o filtro padrão (ano atual)
            carregarDetalhesVencimentos(conteudoGeral, valoresResumoElement); // ✅ PASSANDO

            return;
        }

        // --------------------------
        // LISTENER GENÉRICO PARA SUB-FILTROS DE RÁDIO (TRIMESTRAL/SEMESTRAL)
        // --------------------------
        // Este bloco só é executado para 'trimestral' ou 'semestral'
        const radios = subFiltroWrapper.querySelectorAll("input[name='sub']");
        radios.forEach(r => r.addEventListener("change", () => carregarDetalhesVencimentos(conteudoGeral, valoresResumoElement))); // ✅ PASSANDO

        // Dispara a busca Imediatamente para o filtro padrão
        if (tipo === 'trimestral' || tipo === 'semestral') {
            carregarDetalhesVencimentos(conteudoGeral, valoresResumoElement); // ✅ PASSANDO
        }
    }
    // Inicializa
    atualizarSubFiltro("diario");

    // Listener Periodo
    grupoPeriodo.querySelectorAll("input[name='periodo']").forEach(radio => {
        radio.addEventListener("change", (e) => {
            const tipo = e.target.value;
            atualizarSubFiltro(tipo);

            if (tipo === "anual") carregarDetalhesVencimentos(conteudoGeral, valoresResumoElement); // ✅ PASSANDO
        });
    });


    return filtrosContainer;
}

function nomeDoMes(num) {
    const meses = [
        "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
        "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"
    ];
    return meses[num - 1];
}

function construirQueryDeFiltro() {
    // Definido localmente para garantir o escopo
    const anoAtual = new Date().getFullYear(); 
    
    const periodoSelect = document.getElementById('periodo-select');
    const periodo = periodoSelect.value;
    let queryString = `?periodo=${periodo}&ano=${anoAtual}`;

    // Adiciona o parâmetro de seleção específico se não for Diário ou Anual
    if (periodo === 'mensal') {
        const mesSelect = document.getElementById('sub-filtro-select');
        if (mesSelect) {
      queryString += `&mes=${mesSelect.value}`;
        }
    } else if (periodo === 'trimestral') {
        const trimestreSelect = document.getElementById('sub-filtro-select');
        if (trimestreSelect) {
      queryString += `&trimestre=${trimestreSelect.value}`;
        }
    } else if (periodo === 'semestral') {
        const semestreSelect = document.getElementById('sub-filtro-select');
        if (semestreSelect) {
      queryString += `&semestre=${semestreSelect.value}`;
        }
    }

    // Para o filtro diário, usamos a data atual como referência (se não houver um seletor de data)
    if (periodo === 'diario') {
         const hoje = new Date().toISOString().split('T')[0];
         queryString += `&dataInicio=${hoje}`;
    }

    return queryString;
}

document.getElementById("cardContainerVencimentos").addEventListener("click", async function() {
    const painel = document.getElementById("painelDetalhes");
    painel.innerHTML = "";

    const container = document.createElement("div");
    container.id = "venc-container";
    container.className = "venc-container";

    const header = document.createElement("div");
    header.className = "venc-header";

    const btnVoltar = document.createElement("button"); 
    btnVoltar.id = "btnVoltarVencimentos";
    btnVoltar.className = "btn-voltar";
    btnVoltar.textContent = "←";

    const titulo = document.createElement("h2");
    titulo.textContent = "Vencimentos de Pagamentos"; 

    header.appendChild(btnVoltar);
    header.appendChild(titulo);
    container.appendChild(header);

    const valoresResumoElement = document.createElement("div");
    valoresResumoElement.id = "valores-resumo-vencimentos"; 
    valoresResumoElement.className = "resumo-periodo-vencimentos";
    
    const conteudoGeral = document.createElement("div");
    conteudoGeral.className = "conteudo-geral"; 
    
    const FiltrosVencimentos = criarControlesDeFiltro(conteudoGeral, valoresResumoElement);
    container.appendChild(FiltrosVencimentos); 
    container.appendChild(valoresResumoElement); 
    container.appendChild(conteudoGeral);

    // Anexe o container completo ao painel
    painel.appendChild(container);
  
    btnVoltar.addEventListener('click', () => {
        painel.innerHTML = ""; // Volta para a tela anterior
    });
});

// ===========================


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

  // --- CRIAÇÃO DO CABEÇALHO DOS DIAS DA SEMANA ---
const cabecalhoDiasSemana = document.createElement("div");
cabecalhoDiasSemana.id = "cabecalhoDiasSemana";
cabecalhoDiasSemana.className = "cabecalho-semana";

// Nomes dos dias da semana (começando no Domingo, ajuste se necessário)
const nomesDias = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]; 

nomesDias.forEach(nome => {
    const nomeDiaDiv = document.createElement("div");
    nomeDiaDiv.className = "nome-dia";
    nomeDiaDiv.textContent = nome;
    cabecalhoDiasSemana.appendChild(nomeDiaDiv);
});

// ADICIONA O CABEÇALHO DA SEMANA
calendarioDiv.appendChild(cabecalhoDiasSemana);

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




