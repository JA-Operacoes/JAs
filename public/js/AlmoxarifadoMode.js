// ===== Almoxarifado Geral: itens consumíveis da empresa =====
// Mesmo padrão de RH/T.I/CEO Mode (public/js/RH.js, TIMode.js, CeoMode.js): clique
// no item do menu liga/desliga o modo tela cheia direto (sem dropdown). Reaproveita
// o modelo do almoxarifado de TI.
import { fetchComToken } from '/utils/utils.js';
import { ligarBuscaComSugestoes } from './Formataçoes.js';

let painelMontado = false;
let cacheItens = [];
let cacheLocais = [];
let abaAtiva = null;

async function fetchAlmox(caminho, opcoes = {}) {
  const resp = await fetchComToken(`/almoxarifado${caminho}`, opcoes);
  if (!resp) throw new Error("Falha na requisição ao módulo Almoxarifado.");
  return resp;
}

function escaparHtml(texto) {
  const div = document.createElement("div");
  div.textContent = texto ?? "";
  return div.innerHTML;
}

// Botão de upload (uiverse.io/SpatexDEV/blue-eagle-63) — o <input type="file">
// real fica escondido, o clique visível é no <label for="idInput"> estilizado.
function almoxCampoFoto(idInput, nomeAtual) {
  return `
    <div class="almox-file-row">
      <label class="almox-file-btn" for="${idInput}">
        <svg aria-hidden="true" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path stroke-width="2" stroke="#ffffff" d="M13.5 3H12H8C6.34315 3 5 4.34315 5 6V18C5 19.6569 6.34315 21 8 21H11M13.5 3L19 8.625M13.5 3V7.625C13.5 8.17728 13.9477 8.625 14.5 8.625H19M19 8.625V11.8125" stroke-linejoin="round" stroke-linecap="round"></path>
          <path stroke-linejoin="round" stroke-linecap="round" stroke-width="2" stroke="#ffffff" d="M17 15V18M17 21V18M17 18H14M17 18H20"></path>
        </svg>
        Escolher foto
      </label>
      <input type="file" id="${idInput}" accept="image/*" class="almox-file-input">
      <span id="${idInput}-nome" class="almox-file-nome">${nomeAtual ? escaparHtml(nomeAtual) : "Nenhum arquivo selecionado"}</span>
    </div>
  `;
}

// Atualiza o texto ao lado do botão com o nome do arquivo escolhido.
function ligarCampoFoto(idInput) {
  const input = document.getElementById(idInput);
  const nomeEl = document.getElementById(`${idInput}-nome`);
  input?.addEventListener("change", () => {
    nomeEl.textContent = input.files[0]?.name || "Nenhum arquivo selecionado";
  });
}

function almoxLoading(texto = "Carregando...") {
  return `
    <div class="ti-loading">
      <span class="ti-spinner"></span>
      <span>${texto}</span>
    </div>
  `;
}

function almoxVazio(texto, icone = "inbox") {
  return `
    <div class="ti-card-vazio">
      <span class="material-symbols-outlined">${icone}</span>
      <span>${texto}</span>
    </div>
  `;
}

// Ícone e cor da tag variam por local — só decoração, não afeta a regra de negócio.
const ICONES_LOCAL = { "Escritório": "📄", "Consumíveis Pavilhão": "🖨️", "Camisetas": "👕" };
const TAGS_LOCAL = { "Escritório": "escritorio", "Consumíveis Pavilhão": "pavilhao", "Camisetas": "camisetas" };

function iconeParaLocal(local) {
  return ICONES_LOCAL[local] || "📦";
}

function tagClasseParaLocal(local) {
  return TAGS_LOCAL[local] || "escritorio";
}

// Não existe um "estoque ideal" cadastrado — usamos 3x o mínimo como referência
// visual da barra (item com o triplo do mínimo já lê como "estoque cheio").
function progressoPercentual(item) {
  const ideal = item.estoque_minimo > 0 ? item.estoque_minimo * 3 : Math.max(item.quantidade_atual, 1);
  return Math.max(0, Math.min(100, Math.round((item.quantidade_atual / ideal) * 100)));
}

function renderSmartCard(item) {
  const saudavel = !item.abaixo_minimo;
  const estadoClasse = saudavel ? "healthy" : "critical";
  return `
    <article class="almox-card ${estadoClasse}" data-iditem="${item.iditem}" data-busca="${escaparHtml(item.descricao)}"
              tabindex="0" role="button" title="Clique para repor, consumir ou ver o histórico">
      <div class="almox-card-top">
        <div class="almox-card-id">
          <div class="almox-thumb" aria-hidden="true">${item.foto ? `<img src="/${item.foto}" alt="">` : iconeParaLocal(item.local)}</div>
          <div class="almox-card-nome">${escaparHtml(item.descricao)}</div>
        </div>
        <span class="almox-tag ${tagClasseParaLocal(item.local)}">${escaparHtml(item.local)}</span>
      </div>
      <div class="almox-stock">
        <span class="almox-stock-num ${estadoClasse}">${item.quantidade_atual}</span><span class="almox-stock-unidade">${escaparHtml(item.unidade_medida)}(s)</span>
        <div class="almox-progress-track"><div class="almox-progress-fill ${estadoClasse}" style="width:${progressoPercentual(item)}%"></div></div>
      </div>
      <div class="almox-footer">
        <div class="almox-footer-texto">
          <span class="almox-footer-min">Mín: ${item.estoque_minimo} ${escaparHtml(item.unidade_medida)}(s)</span>
          <span class="almox-status-pill ${estadoClasse}"><span class="almox-status-dot"></span>${saudavel ? "Estoque saudável" : "Alerta crítico"}</span>
        </div>
        <div class="almox-quick-actions">
          <button type="button" class="almox-qa-btn minus" data-acao="consumir" data-iditem="${item.iditem}" aria-label="Consumir ${escaparHtml(item.descricao)}">−</button>
          <button type="button" class="almox-qa-btn plus" data-acao="repor" data-iditem="${item.iditem}" aria-label="Repor ${escaparHtml(item.descricao)}">+</button>
        </div>
      </div>
    </article>
  `;
}

function renderResumoCategoria(lista) {
  const total = lista.length;
  const criticos = lista.filter((item) => item.abaixo_minimo).length;
  const percentualOk = total ? Math.round(((total - criticos) / total) * 100) : 100;
  return `
    <div class="almox-summary">
      <div class="almox-summary-titulo">Estatísticas da categoria</div>
      <div class="almox-summary-stats">
        <div class="almox-stat"><span class="almox-stat-valor">${total}</span><span class="almox-stat-label">Itens totais</span></div>
        <div class="almox-stat"><span class="almox-stat-valor${criticos ? " critical" : ""}">${criticos}</span><span class="almox-stat-label">Alertas críticos</span></div>
        <div class="almox-stat"><span class="almox-stat-valor">${percentualOk}%</span><span class="almox-stat-label">Reposição em dia</span></div>
      </div>
    </div>
  `;
}

async function montarPainelAlmoxarifado() {
  if (painelMontado) return;
  painelMontado = true;

  const conteudo = document.getElementById("conteudo");
  if (!conteudo) return;

  const panel = document.createElement("div");
  panel.id = "almox-panel";
  conteudo.appendChild(panel);

  panel.innerHTML = almoxLoading("Carregando locais...");

  try {
    cacheLocais = await fetchAlmox("/locais");
  } catch (erro) {
    console.error("Erro ao carregar locais do almoxarifado:", erro);
    panel.innerHTML = almoxVazio("Erro ao carregar o almoxarifado.", "error");
    return;
  }

  panel.innerHTML = `
    <div class="ti-abas">
      ${cacheLocais.map((local) => `<button type="button" class="ti-aba-btn" data-local="${escaparHtml(local)}">${escaparHtml(local)}</button>`).join("")}
    </div>
    <div id="almox-aba-conteudo"></div>
  `;

  panel.querySelectorAll(".ti-aba-btn").forEach((btn) =>
    btn.addEventListener("click", () => trocarAbaAlmoxarifado(btn.dataset.local))
  );

  trocarAbaAlmoxarifado(cacheLocais[0]);
}

function trocarAbaAlmoxarifado(local) {
  abaAtiva = local;
  document.querySelectorAll("#almox-panel .ti-aba-btn").forEach((btn) => {
    btn.classList.toggle("ativo", btn.dataset.local === local);
  });
  renderPainelAlmoxarifado();
}

async function renderPainelAlmoxarifado() {
  const container = document.getElementById("almox-aba-conteudo");
  if (!container) return;
  container.innerHTML = almoxLoading("Carregando almoxarifado...");

  try {
    const itens = await fetchAlmox(`/?local=${encodeURIComponent(abaAtiva)}`);
    cacheItens = itens;

    const renderGrid = (lista) => `
      ${!lista.length ? almoxVazio("Nenhum item encontrado.", "inventory") : `
        <div id="almox-cards" class="almox-grid">
          ${lista.map(renderSmartCard).join("")}
        </div>
        ${renderResumoCategoria(lista)}
      `}
    `;

    const bindCards = () => {
      container.querySelectorAll(".almox-card").forEach((card) => {
        card.addEventListener("click", (e) => {
          if (e.target.closest(".almox-qa-btn")) return;
          abrirDetalheItemAlmoxarifado(Number(card.dataset.iditem));
        });
        card.addEventListener("keydown", (e) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          abrirDetalheItemAlmoxarifado(Number(card.dataset.iditem));
        });
      });
      container.querySelectorAll(".almox-qa-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const item = cacheItens.find((i) => i.iditem === Number(btn.dataset.iditem));
          if (!item) return;
          abrirMovimentacaoItemAlmoxarifado(item, btn.dataset.acao === "repor" ? "entrada" : "saida");
        });
      });
    };

    container.innerHTML = `
      <div class="ti-custodia-filtros">
        <input type="text" id="almox-busca" class="ti-input-busca" placeholder="Buscar item pelo nome...">
        <button type="button" id="almox-btn-novo">+ Cadastrar item</button>
      </div>
      <div id="almox-lista" style="margin-top:20px;">${renderGrid(cacheItens)}</div>
    `;

    document.getElementById("almox-btn-novo")?.addEventListener("click", abrirCadastroItemAlmoxarifado);
    bindCards();

    document.getElementById("almox-busca")?.addEventListener("input", (e) => {
      const termo = e.target.value.trim().toLowerCase();
      const filtrados = itens.filter((item) => item.descricao.toLowerCase().includes(termo));
      document.getElementById("almox-lista").innerHTML = renderGrid(filtrados);
      bindCards();
    });
  } catch (erro) {
    console.error("Erro ao carregar almoxarifado:", erro);
    container.innerHTML = almoxVazio("Erro ao carregar almoxarifado.", "error");
  }
}

async function abrirCadastroItemAlmoxarifado() {
  const { value: formValues } = await Swal.fire({
    title: "Cadastrar item no almoxarifado",
    html: `
      <div class="ti-swal-form">
        <label class="ti-swal-label-outlined">
          <input type="text" id="swal-almox-descricao" class="swal2-input" placeholder=" ">
          <span>Descrição</span>
        </label>
        <label class="ti-swal-label-outlined">
          <input type="text" id="swal-almox-unidade" class="swal2-input" placeholder=" " value="unidade">
          <span>Unidade de medida</span>
        </label>
        <label class="ti-swal-label-outlined">
          <input type="number" id="swal-almox-qtd" class="swal2-input" min="0" value="0">
          <span>Quantidade inicial</span>
        </label>
        <label class="ti-swal-label-outlined">
          <input type="number" id="swal-almox-minimo" class="swal2-input" min="0" value="0">
          <span>Estoque mínimo</span>
          <small>Dispara alerta quando o estoque bater nesse valor.</small>
        </label>
        <label class="ti-swal-label">Foto (opcional)
          ${almoxCampoFoto("swal-almox-foto")}
        </label>
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: "Cadastrar",
    cancelButtonText: "Cancelar",
    reverseButtons: true,
    didOpen: () => ligarCampoFoto("swal-almox-foto"),
    preConfirm: () => {
      const descricao = document.getElementById("swal-almox-descricao").value.trim();
      const unidade_medida = document.getElementById("swal-almox-unidade").value.trim() || "unidade";
      const quantidade_atual = parseInt(document.getElementById("swal-almox-qtd").value, 10) || 0;
      const estoque_minimo = parseInt(document.getElementById("swal-almox-minimo").value, 10) || 0;
      const foto = document.getElementById("swal-almox-foto").files[0] || null;
      if (!descricao) {
        Swal.showValidationMessage("Descreva o item.");
        return false;
      }
      return { local: abaAtiva, descricao, unidade_medida, quantidade_atual, estoque_minimo, foto };
    }
  });

  if (!formValues) return;
  const { foto, ...dadosItem } = formValues;

  try {
    const { item: novo } = await fetchAlmox("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dadosItem),
    });

    if (foto) {
      await enviarFotoItemAlmoxarifado(novo.iditem, foto);
    }

    await Swal.fire("Sucesso!", "Item cadastrado no almoxarifado.", "success");
    renderPainelAlmoxarifado();
  } catch (erro) {
    console.error("Erro ao cadastrar item do almoxarifado:", erro);
    Swal.fire("Erro", erro.message || "Erro ao cadastrar item.", "error");
  }
}

async function enviarFotoItemAlmoxarifado(iditem, arquivo) {
  const formData = new FormData();
  formData.append("foto", arquivo);
  await fetchAlmox(`/${iditem}/foto`, { method: "POST", body: formData });
}

async function abrirEditarItemAlmoxarifado(item) {
  const { value: formValues } = await Swal.fire({
    title: "Editar item do almoxarifado",
    html: `
      <div class="ti-swal-form">
        <label class="ti-swal-label-outlined">
          <select id="swal-almox-local" class="swal2-input">
            ${cacheLocais.map((local) => `<option value="${escaparHtml(local)}" ${local === item.local ? "selected" : ""}>${escaparHtml(local)}</option>`).join("")}
          </select>
          <span>Local</span>
        </label>
        <label class="ti-swal-label-outlined">
          <input type="text" id="swal-almox-descricao" class="swal2-input" value="${escaparHtml(item.descricao)}" placeholder=" ">
          <span>Descrição</span>
        </label>
        <label class="ti-swal-label-outlined">
          <input type="text" id="swal-almox-unidade" class="swal2-input" value="${escaparHtml(item.unidade_medida)}" placeholder=" ">
          <span>Unidade de medida</span>
        </label>
        <label class="ti-swal-label-outlined">
          <input type="number" id="swal-almox-minimo" class="swal2-input" min="0" value="${item.estoque_minimo}">
          <span>Estoque mínimo</span>
        </label>
        <label class="ti-swal-label">Foto ${item.foto ? "(deixe em branco pra manter a atual)" : "(opcional)"}
          ${item.foto ? `<img src="/${item.foto}" alt="" style="display:block; width:64px; height:64px; object-fit:cover; border-radius:8px; margin:6px 0;">` : ""}
          ${almoxCampoFoto("swal-almox-foto")}
        </label>
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: "Salvar",
    didOpen: () => ligarCampoFoto("swal-almox-foto"),
    cancelButtonText: "Cancelar",
    reverseButtons: true,
    preConfirm: () => {
      const local = document.getElementById("swal-almox-local").value;
      const descricao = document.getElementById("swal-almox-descricao").value.trim();
      const unidade_medida = document.getElementById("swal-almox-unidade").value.trim() || "unidade";
      const estoque_minimo = parseInt(document.getElementById("swal-almox-minimo").value, 10) || 0;
      const foto = document.getElementById("swal-almox-foto").files[0] || null;
      if (!descricao) {
        Swal.showValidationMessage("Descreva o item.");
        return false;
      }
      return { local, descricao, unidade_medida, estoque_minimo, foto };
    }
  });

  if (!formValues) return;
  const { foto, ...dadosItem } = formValues;

  try {
    await fetchAlmox(`/${item.iditem}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dadosItem),
    });

    if (foto) {
      await enviarFotoItemAlmoxarifado(item.iditem, foto);
    }

    trocarAbaAlmoxarifado(dadosItem.local);
  } catch (erro) {
    console.error("Erro ao editar item do almoxarifado:", erro);
    Swal.fire("Erro", erro.message || "Erro ao editar item.", "error");
  }
}

// Editar o cadastro do item (nome, local, unidade, mínimo) é restrito às mesmas
// flags especiais do backend (ver exigirFlagsEspeciais em rotaAlmoxarifado.js)
// — front só esconde o botão (UX), quem realmente bloqueia é o servidor.
function temFlagsEspeciaisAlmox() {
  return ["supremo", "master", "financeiro", "devs"].some(
    (flag) => window.temPermissao?.("Staff", flag) ?? false
  );
}

// Detalhe do item — igual ao padrão do almoxarifado de TI.
async function abrirDetalheItemAlmoxarifado(iditem) {
  const item = cacheItens.find((i) => i.iditem === iditem);
  if (!item) return;

  await Swal.fire({
    title: item.descricao,
    html: `
      ${item.foto ? `<img src="/${item.foto}" alt="" style="display:block; max-width:160px; max-height:160px; object-fit:cover; border-radius:12px; margin:0 auto 16px; box-shadow:0 6px 16px -8px rgba(0,0,0,0.35); border:1px solid #eee;">` : ""}
      <div class="ti-swal-modelo-numeros" style="justify-content:center;">
        <div style="align-items:center;"><strong>${item.quantidade_atual}</strong><span>${escaparHtml(item.unidade_medida)}(s) em estoque</span></div>
        <div style="align-items:center;"><strong>${item.estoque_minimo}</strong><span>estoque mínimo</span></div>
      </div>
      ${item.abaixo_minimo ? '<p style="color:#b3261e; font-weight:700; text-align:center; margin:10px 0 0; font-size:12.5px; text-transform:uppercase; letter-spacing:.03em;">⚠ Abaixo do estoque mínimo</p>' : ""}
      <div class="ti-swal-modelo-acoes" style="justify-content:center; margin-top:16px;">
        <button type="button" id="almox-detalhe-repor"><span class="material-symbols-outlined">add_circle</span>Repor</button>
        <button type="button" id="almox-detalhe-consumir" class="secundario"><span class="material-symbols-outlined">remove_circle</span>Consumir</button>
        ${temFlagsEspeciaisAlmox() ? `<button type="button" id="almox-detalhe-editar" class="secundario"><span class="material-symbols-outlined">edit</span>Editar</button>` : ""}
        <button type="button" id="almox-detalhe-historico" class="secundario"><span class="material-symbols-outlined">history</span>Histórico</button>
      </div>
    `,
    showConfirmButton: false,
    showCloseButton: true,
    didOpen: () => {
      document.getElementById("almox-detalhe-repor").addEventListener("click", () => {
        Swal.close();
        abrirMovimentacaoItemAlmoxarifado(item, "entrada");
      });
      document.getElementById("almox-detalhe-consumir").addEventListener("click", () => {
        Swal.close();
        abrirMovimentacaoItemAlmoxarifado(item, "saida");
      });
      document.getElementById("almox-detalhe-editar")?.addEventListener("click", () => {
        Swal.close();
        abrirEditarItemAlmoxarifado(item);
      });
      document.getElementById("almox-detalhe-historico").addEventListener("click", () => {
        Swal.close();
        verHistoricoItemAlmoxarifado(item.iditem, item.descricao);
      });
    },
  });
}

async function abrirMovimentacaoItemAlmoxarifado(item, tipo) {
  const titulo = tipo === "entrada" ? `Repor — ${item.descricao}` : `Consumir — ${item.descricao}`;
  const { value: formValues } = await Swal.fire({
    title: titulo,
    html: `
      <div class="ti-swal-form">
        <label class="ti-swal-label-outlined">
          <input type="number" id="swal-almox-mov-qtd" class="swal2-input" min="1" value="1">
          <span>Quantidade (${escaparHtml(item.unidade_medida)})</span>
          ${tipo === "saida" ? `<small>Disponível: ${item.quantidade_atual}</small>` : ""}
        </label>
        <label class="ti-swal-label-outlined">
          <input type="text" id="swal-almox-mov-funcionario-busca" class="swal2-input" placeholder=" " autocomplete="off">
          <input type="hidden" id="swal-almox-mov-funcionario">
          <span>Retirando para</span>
          <small>Opcional — deixe em branco se for para uso próprio.</small>
        </label>
        <label class="ti-swal-label-outlined">
          <input type="text" id="swal-almox-mov-motivo" class="swal2-input" placeholder=" ">
          <span>Motivo (opcional)</span>
        </label>
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: tipo === "entrada" ? "Repor" : "Consumir",
    cancelButtonText: "Cancelar",
    reverseButtons: true,
    didOpen: () => {
      const inputBusca = document.getElementById("swal-almox-mov-funcionario-busca");
      const inputOculto = document.getElementById("swal-almox-mov-funcionario");
      ligarBuscaComSugestoes(
        inputBusca,
        "swal-almox-mov-funcionario-lista",
        (termo) => fetchAlmox(`/funcionarios/busca?busca=${encodeURIComponent(termo)}`),
        (f) => f.nome,
        (f) => {
          inputBusca.value = f.nome;
          inputOculto.value = f.idfuncionario;
        },
        { mensagemVazia: "Nenhum funcionário encontrado" }
      );
      inputBusca.addEventListener("input", () => {
        if (!inputBusca.value.trim()) inputOculto.value = "";
      });
    },
    preConfirm: () => {
      const quantidade = parseInt(document.getElementById("swal-almox-mov-qtd").value, 10);
      const motivo = document.getElementById("swal-almox-mov-motivo").value.trim();
      const idfuncionario_solicitante = document.getElementById("swal-almox-mov-funcionario").value || null;
      if (!Number.isInteger(quantidade) || quantidade <= 0) {
        Swal.showValidationMessage("Informe uma quantidade válida.");
        return false;
      }
      return { quantidade, motivo, idfuncionario_solicitante };
    }
  });

  if (!formValues) return;

  try {
    await fetchAlmox(`/${item.iditem}/movimentacao`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo,
        quantidade: formValues.quantidade,
        motivo: formValues.motivo,
        idfuncionario_solicitante: formValues.idfuncionario_solicitante,
      }),
    });
    renderPainelAlmoxarifado();
  } catch (erro) {
    console.error("Erro ao movimentar item do almoxarifado:", erro);
    Swal.fire("Erro", erro.message || "Erro ao registrar movimentação.", "error");
  }
}

function montarQueryHistoricoAlmoxarifado(filtros) {
  const params = new URLSearchParams();
  if (filtros.data_inicio) params.set("data_inicio", filtros.data_inicio);
  if (filtros.data_fim) params.set("data_fim", filtros.data_fim);
  if (filtros.idusuario) params.set("idusuario", filtros.idusuario);
  if (filtros.idfuncionario_solicitante) params.set("idfuncionario_solicitante", filtros.idfuncionario_solicitante);
  return params.toString();
}

function renderLinhasHistoricoAlmoxarifado(historico) {
  const tipoLabel = { entrada: "Reposição", saida: "Consumo" };
  if (!historico.length) {
    return `<tr><td colspan="5" style="text-align:center; color:var(--text-2);">Nenhuma movimentação encontrada.</td></tr>`;
  }
  return historico.map((h) => {
    const motivoResumo = h.motivo && h.motivo.length > 30 ? `${h.motivo.slice(0, 30)}…` : h.motivo;
    return `
    <tr>
      <td>${new Date(h.criado_em).toLocaleString("pt-BR")}</td>
      <td>${tipoLabel[h.tipo] || h.tipo} de ${h.quantidade}</td>
      <td>${escaparHtml(h.nome_usuario) || "—"}</td>
      <td>${escaparHtml(h.nome_funcionario_solicitante) || "—"}</td>
      <td>${h.motivo ? `<button type="button" class="ti-btn-ver-motivo secundario" data-idmovimentacao="${h.idmovimentacao}">${escaparHtml(motivoResumo)}</button>` : "—"}</td>
    </tr>
  `;
  }).join("");
}

async function verHistoricoItemAlmoxarifado(id, descricao) {
  const container = document.getElementById("almox-aba-conteudo");
  if (!container) return;

  container.innerHTML = `
    <div class="ti-custodia-filtros" style="margin-bottom:16px;">
      <button type="button" id="almox-hist-voltar" class="secundario">← Voltar ao almoxarifado</button>
    </div>
    <div class="Evt-container">
      <h3 style="margin:0 0 16px;">Histórico — ${escaparHtml(descricao)}</h3>
      <div style="display:flex; gap:20px; flex-wrap:wrap; align-items:flex-end;">
        <div class="filtro-grupo">
          <label class="label-select">De</label>
          <input type="date" id="almox-hist-data-inicio" class="busca-evento-input" style="width:150px;">
        </div>
        <div class="filtro-grupo">
          <label class="label-select">Até</label>
          <input type="date" id="almox-hist-data-fim" class="busca-evento-input" style="width:150px;">
        </div>
        <div class="filtro-grupo">
          <label class="label-select">Usuário</label>
          <div class="wrapper select-wrapper busca-evento-wrapper" style="width:220px;">
            <input type="text" id="almox-hist-usuario-busca" class="busca-evento-input" placeholder="Buscar usuário..." autocomplete="off">
            <input type="hidden" id="almox-hist-usuario">
          </div>
        </div>
        <div class="filtro-grupo">
          <label class="label-select">Funcionário</label>
          <div class="wrapper select-wrapper busca-evento-wrapper" style="width:220px;">
            <input type="text" id="almox-hist-funcionario-busca" class="busca-evento-input" placeholder="Buscar funcionário..." autocomplete="off">
            <input type="hidden" id="almox-hist-funcionario">
          </div>
        </div>
        <div class="ti-custodia-filtros filtro-grupo">
          <button type="button" id="almox-hist-filtrar">Filtrar</button>
          <button type="button" id="almox-hist-limpar" class="secundario">Limpar</button>
        </div>
      </div>
    </div>
    <table class="ti-tabela" style="margin-top:20px;">
      <thead><tr><th>Data</th><th>Movimentação</th><th>Usuário</th><th>Funcionário</th><th>Motivo</th></tr></thead>
      <tbody id="almox-hist-tbody"><tr><td colspan="5">Carregando...</td></tr></tbody>
    </table>
  `;

  document.getElementById("almox-hist-voltar").addEventListener("click", renderPainelAlmoxarifado);

  let historicoAtual = [];
  document.getElementById("almox-hist-tbody").addEventListener("click", (e) => {
    const btn = e.target.closest(".ti-btn-ver-motivo");
    if (!btn) return;
    const item = historicoAtual.find((h) => String(h.idmovimentacao) === btn.dataset.idmovimentacao);
    if (!item) return;
    Swal.fire({ title: "Motivo", html: `<p style="text-align:left; white-space:pre-wrap;">${escaparHtml(item.motivo)}</p>` });
  });

  const tbody = document.getElementById("almox-hist-tbody");
  const inputUsuarioBusca = document.getElementById("almox-hist-usuario-busca");
  const inputUsuarioOculto = document.getElementById("almox-hist-usuario");
  const inputFuncionarioBusca = document.getElementById("almox-hist-funcionario-busca");
  const inputFuncionarioOculto = document.getElementById("almox-hist-funcionario");

  ligarBuscaComSugestoes(
    inputUsuarioBusca,
    "almox-hist-usuario-lista",
    (termo) => fetchAlmox(`/usuarios/busca?busca=${encodeURIComponent(termo)}`),
    (u) => u.nome,
    (u) => { inputUsuarioBusca.value = u.nome; inputUsuarioOculto.value = u.idusuario; },
    { mensagemVazia: "Nenhum usuário encontrado" }
  );
  inputUsuarioBusca.addEventListener("input", () => { if (!inputUsuarioBusca.value.trim()) inputUsuarioOculto.value = ""; });

  ligarBuscaComSugestoes(
    inputFuncionarioBusca,
    "almox-hist-funcionario-lista",
    (termo) => fetchAlmox(`/funcionarios/busca?busca=${encodeURIComponent(termo)}`),
    (f) => f.nome,
    (f) => { inputFuncionarioBusca.value = f.nome; inputFuncionarioOculto.value = f.idfuncionario; },
    { mensagemVazia: "Nenhum funcionário encontrado" }
  );
  inputFuncionarioBusca.addEventListener("input", () => { if (!inputFuncionarioBusca.value.trim()) inputFuncionarioOculto.value = ""; });

  const carregar = async () => {
    tbody.innerHTML = `<tr><td colspan="5">Carregando...</td></tr>`;
    try {
      const query = montarQueryHistoricoAlmoxarifado({
        data_inicio: document.getElementById("almox-hist-data-inicio").value,
        data_fim: document.getElementById("almox-hist-data-fim").value,
        idusuario: inputUsuarioOculto.value,
        idfuncionario_solicitante: inputFuncionarioOculto.value,
      });
      const historico = await fetchAlmox(`/${id}/movimentacoes${query ? `?${query}` : ""}`);
      historicoAtual = historico;
      tbody.innerHTML = renderLinhasHistoricoAlmoxarifado(historico);
    } catch (erro) {
      console.error("Erro ao carregar histórico do item:", erro);
      tbody.innerHTML = `<tr><td colspan="5" style="color:#a11919;">Erro ao carregar histórico.</td></tr>`;
    }
  };

  document.getElementById("almox-hist-filtrar").addEventListener("click", carregar);
  document.getElementById("almox-hist-limpar").addEventListener("click", () => {
    document.getElementById("almox-hist-data-inicio").value = "";
    document.getElementById("almox-hist-data-fim").value = "";
    inputUsuarioBusca.value = "";
    inputUsuarioOculto.value = "";
    inputFuncionarioBusca.value = "";
    inputFuncionarioOculto.value = "";
    carregar();
  });

  carregar();
}

// ===== Toggle do modo Almoxarifado =====
function initAlmoxarifadoMode() {
  const li = document.querySelector("li.Almoxarifado");
  const link = li?.querySelector("a");
  if (!li || !link) return;

  const temAcesso =
    (window.temPermissao?.("Almoxarifado", "pesquisar") ?? false) ||
    (window.temPermissao?.("Staff", "supremo") ?? false);

  if (!temAcesso) {
    li.style.display = "none";
    return;
  }

  link.addEventListener("click", (e) => {
    e.preventDefault();
    const ativo = document.body.classList.toggle("almox-mode");
    if (ativo) {
      // Só um "modo de tela cheia" por vez — mesma regra espelhada em CeoMode.js/RH.js/TIMode.js.
      document.body.classList.remove("ceo-mode", "rh-mode", "ti-mode");
      montarPainelAlmoxarifado();
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  if (Array.isArray(window.permissoes)) initAlmoxarifadoMode();
  else document.addEventListener("permissoesCarregadas", initAlmoxarifadoMode, { once: true });
});
