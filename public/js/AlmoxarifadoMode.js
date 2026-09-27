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

// Aba de Compras (ver seção COMPRAS no fim do arquivo). Não é um local do
// almoxarifado, por isso o valor "reservado" que nunca bate com cacheLocais.
const ABA_COMPRAS = "__compras";

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
// Ícones do Remix Icon (CDN já carregado no OPER-index.html).
const ICONES_LOCAL = {
  "Escritório": "ri-file-paper-2-line",
  "Consumíveis Pavilhão": "ri-printer-line",
  "Camisetas": "ri-t-shirt-line",
};
const TAGS_LOCAL = { "Escritório": "escritorio", "Consumíveis Pavilhão": "pavilhao", "Camisetas": "camisetas" };

function classeIconeLocal(local) {
  return ICONES_LOCAL[local] || "ri-archive-2-line";
}

function iconeParaLocal(local) {
  return `<i class="${classeIconeLocal(local)}" aria-hidden="true"></i>`;
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
      ${cacheLocais
        .map(
          (local) => `<button type="button" class="ti-aba-btn" data-local="${escaparHtml(local)}">
            <i class="${classeIconeLocal(local)}" aria-hidden="true"></i>${escaparHtml(local)}
          </button>`
        )
        .join("")}
      <button type="button" class="ti-aba-btn" data-local="${ABA_COMPRAS}">
        <i class="ri-shopping-cart-2-line" aria-hidden="true"></i>Compras
      </button>
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
  if (local === ABA_COMPRAS) renderPainelCompras();
  else renderPainelAlmoxarifado();
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
// flags administrativas do backend (ver FLAGS_EDICAO_ITEM em rotaAlmoxarifado.js)
// — front só esconde o botão (UX), quem realmente bloqueia é o servidor.
// A flag `camisetas` NÃO entra aqui: ela libera o local, não a edição de cadastro.
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
      ${item.abaixo_minimo ? '<p style="color:var(--status-erro-fg); font-weight:700; text-align:center; margin:10px 0 0; font-size:12.5px; text-transform:uppercase; letter-spacing:.03em;">⚠ Abaixo do estoque mínimo</p>' : ""}
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
    <div class="almox-bloco">
      <div class="almox-bloco-titulo">
        <div><h4>Histórico — ${escaparHtml(descricao)}</h4></div>
        <div class="almox-bloco-acoes">
          <button type="button" id="almox-hist-filtrar" class="almox-btn-principal">Filtrar</button>
          <button type="button" id="almox-hist-limpar" class="almox-btn-secundario">Limpar</button>
        </div>
      </div>
      <div class="almox-form-grid">
        <label class="almox-campo">
          <span>De</span>
          <input type="date" id="almox-hist-data-inicio">
        </label>
        <label class="almox-campo">
          <span>Até</span>
          <input type="date" id="almox-hist-data-fim">
        </label>
        <label class="almox-campo">
          <span>Usuário</span>
          <input type="text" id="almox-hist-usuario-busca" placeholder="Buscar usuário..." autocomplete="off">
          <input type="hidden" id="almox-hist-usuario">
        </label>
        <label class="almox-campo">
          <span>Funcionário</span>
          <input type="text" id="almox-hist-funcionario-busca" placeholder="Buscar funcionário..." autocomplete="off">
          <input type="hidden" id="almox-hist-funcionario">
        </label>
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
      tbody.innerHTML = `<tr><td colspan="5" style="color:var(--status-erro-fg);">Erro ao carregar histórico.</td></tr>`;
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

// =============================================================================
// ===== COMPRAS =====
// Aba que fecha o ciclo do consumível: o que está abaixo/perto do mínimo vira
// lista de compra, o master aprova item a item, cada item recebe cotações de
// fornecedores diferentes e o recebimento é CONFIRMADO (quantidade editável)
// antes de virar entrada no estoque.
// Backend: seção COMPRAS em routes/rotaAlmoxarifado.js (/almoxarifado/compras/*).
// =============================================================================

let subAbaCompras = "sugestoes";
let localCompras = null;    // local usado nas sugestões e no pedido novo
let cacheSugestoes = [];
// Rascunho da lista em montagem (sugestões + compras pontuais no mesmo carrinho).
let rascunhoItens = [];
let rascunhoData = "";
let rascunhoObs = "";

const moedaBR = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function formatarValorAlmox(valor) {
  if (valor === null || valor === undefined || valor === "") return "—";
  return moedaBR.format(Number(valor));
}

// Data 'YYYY-MM-DD' não pode passar por new Date() (volta um dia por causa do
// fuso), por isso o split direto.
function formatarDataAlmox(data) {
  if (!data) return "—";
  const iso = String(data).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [ano, mes, dia] = iso.split("-");
    return `${dia}/${mes}/${ano}`;
  }
  return new Date(data).toLocaleDateString("pt-BR");
}

function hojeISO() {
  const hoje = new Date();
  return new Date(hoje.getTime() - hoje.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

const STATUS_PEDIDO = {
  pendente: { texto: "Aguardando aprovação", classe: "pendente" },
  aprovado: { texto: "Aprovado", classe: "aprovado" },
  comprado: { texto: "Comprado", classe: "comprado" },
  parcial: { texto: "Recebido parcial", classe: "parcial" },
  recebido: { texto: "Recebido", classe: "recebido" },
  recusado: { texto: "Recusado", classe: "recusado" },
  cancelado: { texto: "Cancelado", classe: "cancelado" },
};

const STATUS_ITEM = {
  pendente: { texto: "Pendente", classe: "pendente" },
  aprovado: { texto: "Aprovado", classe: "aprovado" },
  recusado: { texto: "Recusado", classe: "recusado" },
  recebido: { texto: "Recebido", classe: "recebido" },
};

function pillStatus(status, mapa = STATUS_PEDIDO) {
  const info = mapa[status] || { texto: status || "—", classe: "pendente" };
  return `<span class="almox-pedido-status ${info.classe}">${escaparHtml(info.texto)}</span>`;
}

async function renderPainelCompras() {
  const container = document.getElementById("almox-aba-conteudo");
  if (!container) return;
  if (!localCompras || !cacheLocais.includes(localCompras)) localCompras = cacheLocais[0];

  const subAbas = [
    { id: "sugestoes", texto: "Nova lista", icone: "ri-add-box-line" },
    { id: "pedidos", texto: "Listas de compra", icone: "ri-file-list-3-line" },
    { id: "precos", texto: "Preços e durabilidade", icone: "ri-line-chart-line" },
  ];

  container.innerHTML = `
    <div class="almox-compras-subabas">
      ${subAbas
        .map(
          (s) => `<button type="button" class="almox-subaba ${s.id === subAbaCompras ? "ativo" : ""}" data-sub="${s.id}">
            <i class="${s.icone}" aria-hidden="true"></i>${s.texto}
          </button>`
        )
        .join("")}
    </div>
    <div id="almox-compras-conteudo">${almoxLoading()}</div>
  `;

  container.querySelectorAll(".almox-subaba").forEach((btn) =>
    btn.addEventListener("click", () => {
      subAbaCompras = btn.dataset.sub;
      renderPainelCompras();
    })
  );

  if (subAbaCompras === "sugestoes") renderNovaLista();
  else if (subAbaCompras === "pedidos") renderListasCompra();
  else renderPrecosCompra();
}

// ===== Sub-aba: Nova lista (reposição + compra pontual) =====
// Um carrinho só: o que o estoque sugere e o que alguém precisa comprar avulso
// (mesmo sem nada perto do mínimo) entram na MESMA lista antes da aprovação.
// Por isso a tela abre com a lista vazia e um "+ Adicionar item" em destaque —
// as sugestões são um atalho pra encher a lista, não o único caminho.
async function renderNovaLista() {
  const alvo = document.getElementById("almox-compras-conteudo");
  if (!alvo) return;
  alvo.innerHTML = almoxLoading("Analisando o estoque...");

  try {
    cacheSugestoes = await fetchAlmox(`/compras/sugestoes?local=${encodeURIComponent(localCompras)}`);
  } catch (erro) {
    console.error("Erro ao carregar sugestões de compra:", erro);
    cacheSugestoes = [];
  }

  const criticos = cacheSugestoes.filter((s) => s.abaixo_minimo).length;

  alvo.innerHTML = `
    <section class="almox-bloco">
      <div class="almox-bloco-titulo">
        <div>
          <h4>Nova lista de compra</h4>
          <p class="almox-bloco-ajuda">Vale tanto pra repor o que está acabando quanto pra uma compra pontual.</p>
        </div>
      </div>
      <div class="almox-form-grid">
        <label class="almox-campo">
          <span>Local</span>
          <select id="almox-compras-local">
            ${cacheLocais.map((l) => `<option value="${escaparHtml(l)}" ${l === localCompras ? "selected" : ""}>${escaparHtml(l)}</option>`).join("")}
          </select>
        </label>
        <label class="almox-campo">
          <span>Precisa chegar até</span>
          <input type="date" id="almox-compras-data" value="${rascunhoData}">
        </label>
        <label class="almox-campo almox-campo-larga">
          <span>Observação da lista</span>
          <input type="text" id="almox-compras-obs" placeholder="Opcional — ex: compra para o evento X" value="${escaparHtml(rascunhoObs)}">
        </label>
      </div>
    </section>

    <section class="almox-bloco">
      <div class="almox-bloco-titulo">
        <div>
          <h4>Itens da lista <span class="almox-contador" id="almox-rascunho-contador">${rascunhoItens.length}</span></h4>
          <p class="almox-bloco-ajuda">Item que ainda não existe no cadastro pode entrar aqui — ele é criado no recebimento.</p>
        </div>
        <div class="almox-bloco-acoes">
          <button type="button" id="almox-compras-adicionar" class="almox-btn-secundario">+ Adicionar item</button>
          <button type="button" id="almox-compras-enviar" class="almox-btn-principal">Enviar para aprovação</button>
        </div>
      </div>
      <table class="ti-tabela">
        <thead><tr><th>Item</th><th style="width:130px;">Quantidade</th><th>Justificativa</th><th style="width:90px;"></th></tr></thead>
        <tbody id="almox-rascunho-tbody">${renderLinhasRascunho()}</tbody>
      </table>
    </section>

    <section class="almox-bloco">
      <div class="almox-bloco-titulo">
        <div>
          <h4>Sugestões de reposição</h4>
          <p class="almox-bloco-ajuda">${cacheSugestoes.length} item(ns) no radar${criticos ? ` · <strong class="almox-texto-critico">${criticos} abaixo do mínimo</strong>` : ""}.</p>
        </div>
        <div class="almox-bloco-acoes">
          ${cacheSugestoes.length ? `<button type="button" id="almox-sug-todos" class="almox-btn-secundario">Adicionar todos à lista</button>` : ""}
        </div>
      </div>
      <table class="ti-tabela">
        <thead>
          <tr><th>Item</th><th>Estoque</th><th>Mínimo</th><th>Cobertura</th><th>Última compra</th><th style="width:150px;">Sugestão</th></tr>
        </thead>
        <tbody id="almox-sug-tbody">${renderLinhasSugestao()}</tbody>
      </table>
    </section>
  `;

  document.getElementById("almox-compras-local").addEventListener("change", trocarLocalDaLista);
  document.getElementById("almox-compras-data").addEventListener("change", (e) => { rascunhoData = e.target.value; });
  document.getElementById("almox-compras-obs").addEventListener("input", (e) => { rascunhoObs = e.target.value; });
  document.getElementById("almox-compras-adicionar").addEventListener("click", () => abrirAdicionarItemLista());
  document.getElementById("almox-compras-enviar").addEventListener("click", enviarListaCompra);
  document.getElementById("almox-sug-todos")?.addEventListener("click", () => {
    cacheSugestoes.filter((s) => !s.ja_solicitado).forEach((s) => adicionarSugestaoAoRascunho(s, false));
    atualizarRascunho();
  });

  ligarAcoesRascunho();
  ligarAcoesSugestao();
}

// Trocar o local troca o destino do pedido inteiro — com itens já na lista isso
// misturaria estoques diferentes, então confirma antes de limpar.
async function trocarLocalDaLista(evento) {
  const novoLocal = evento.target.value;
  if (rascunhoItens.length) {
    const confirmacao = await Swal.fire({
      title: "Trocar o local?",
      text: "A lista em andamento é para o local atual e será limpa.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Trocar e limpar",
      cancelButtonText: "Manter",
      reverseButtons: true,
    });
    if (!confirmacao.isConfirmed) {
      evento.target.value = localCompras;
      return;
    }
    rascunhoItens = [];
  }
  localCompras = novoLocal;
  renderNovaLista();
}

function renderLinhasRascunho() {
  if (!rascunhoItens.length) {
    return `<tr><td colspan="4" class="almox-td-vazio">
      Lista vazia. Use <strong>+ Adicionar item</strong> para uma compra pontual ou pegue algo das sugestões abaixo.
    </td></tr>`;
  }
  return rascunhoItens
    .map(
      (item, indice) => `
        <tr>
          <td>
            ${escaparHtml(item.descricao)}
            <small class="almox-td-nota">${item.iditem ? escaparHtml(item.unidade_medida) : "item novo · " + escaparHtml(item.unidade_medida)}</small>
          </td>
          <td><input type="number" class="almox-rascunho-qtd" data-indice="${indice}" min="1" value="${item.quantidade_solicitada}"></td>
          <td>${escaparHtml(item.justificativa) || "—"}</td>
          <td><button type="button" class="almox-btn-mini recusar almox-rascunho-remover" data-indice="${indice}">remover</button></td>
        </tr>
      `
    )
    .join("");
}

function renderLinhasSugestao() {
  if (!cacheSugestoes.length) {
    return `<tr><td colspan="6" class="almox-td-vazio">Nenhum item perto do estoque mínimo neste local. 🎉</td></tr>`;
  }
  return cacheSugestoes
    .map((item) => {
      const cobertura =
        item.dias_cobertura === null
          ? `<span class="almox-td-nota">sem consumo registrado</span>`
          : `${item.dias_cobertura} dia(s)`;
      const naLista = rascunhoItens.some((r) => r.iditem === item.iditem);
      const acao = item.ja_solicitado
        ? `<span class="almox-pedido-status pendente">já solicitado</span>`
        : naLista
          ? `<span class="almox-pedido-status aprovado">na lista</span>`
          : `<button type="button" class="almox-btn-mini almox-sug-add" data-iditem="${item.iditem}">+ ${item.quantidade_sugerida}</button>`;

      return `
        <tr class="${item.abaixo_minimo ? "almox-linha-critica" : ""}">
          <td>${escaparHtml(item.descricao)}</td>
          <td>${item.quantidade_atual} ${escaparHtml(item.unidade_medida)}</td>
          <td>${item.estoque_minimo}</td>
          <td>${cobertura}</td>
          <td>${formatarDataAlmox(item.ultima_compra)}</td>
          <td>${acao}</td>
        </tr>
      `;
    })
    .join("");
}

// Redesenha só as duas tabelas — o formulário do topo continua com o que o
// usuário já digitou.
function atualizarRascunho() {
  const tbody = document.getElementById("almox-rascunho-tbody");
  const contador = document.getElementById("almox-rascunho-contador");
  const sugestoes = document.getElementById("almox-sug-tbody");
  if (!tbody) return;

  tbody.innerHTML = renderLinhasRascunho();
  contador.textContent = rascunhoItens.length;
  if (sugestoes) sugestoes.innerHTML = renderLinhasSugestao();
  ligarAcoesRascunho();
  ligarAcoesSugestao();
}

function ligarAcoesRascunho() {
  document.querySelectorAll(".almox-rascunho-remover").forEach((btn) =>
    btn.addEventListener("click", () => {
      rascunhoItens.splice(Number(btn.dataset.indice), 1);
      atualizarRascunho();
    })
  );
  document.querySelectorAll(".almox-rascunho-qtd").forEach((campo) =>
    campo.addEventListener("change", () => {
      const quantidade = parseInt(campo.value, 10);
      if (!Number.isInteger(quantidade) || quantidade <= 0) {
        campo.value = rascunhoItens[Number(campo.dataset.indice)].quantidade_solicitada;
        return;
      }
      rascunhoItens[Number(campo.dataset.indice)].quantidade_solicitada = quantidade;
    })
  );
}

function ligarAcoesSugestao() {
  document.querySelectorAll(".almox-sug-add").forEach((btn) =>
    btn.addEventListener("click", () => {
      const sugestao = cacheSugestoes.find((s) => s.iditem === Number(btn.dataset.iditem));
      if (sugestao) adicionarSugestaoAoRascunho(sugestao);
    })
  );
}

function adicionarSugestaoAoRascunho(sugestao, redesenhar = true) {
  if (rascunhoItens.some((r) => r.iditem === sugestao.iditem)) return;
  rascunhoItens.push({
    iditem: sugestao.iditem,
    descricao: sugestao.descricao,
    unidade_medida: sugestao.unidade_medida,
    quantidade_solicitada: Number(sugestao.quantidade_sugerida) || 1,
    justificativa: sugestao.abaixo_minimo ? "Abaixo do estoque mínimo" : "Perto do estoque mínimo",
  });
  if (redesenhar) atualizarRascunho();
}

// Compra pontual: qualquer item, cadastrado ou não, sem depender do mínimo.
async function abrirAdicionarItemLista() {
  const { value: dados } = await Swal.fire({
    title: "Adicionar item à lista",
    html: `
      <div class="ti-swal-form">
        <label class="ti-swal-label-outlined">
          <input type="text" id="swal-avulso-descricao" class="swal2-input" placeholder=" " autocomplete="off">
          <span>Item</span>
          <small>Busca no cadastro do local; se não existir, digite o nome e ele é criado no recebimento.</small>
        </label>
        <label class="ti-swal-label-outlined">
          <input type="text" id="swal-avulso-unidade" class="swal2-input" placeholder=" " value="unidade">
          <span>Unidade de medida</span>
        </label>
        <label class="ti-swal-label-outlined">
          <input type="number" id="swal-avulso-qtd" class="swal2-input" min="1" value="1">
          <span>Quantidade</span>
        </label>
        <label class="ti-swal-label-outlined">
          <input type="text" id="swal-avulso-justificativa" class="swal2-input" placeholder=" ">
          <span>Justificativa (opcional)</span>
        </label>
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: "Adicionar",
    cancelButtonText: "Cancelar",
    reverseButtons: true,
    didOpen: () => {
      // Item já cadastrado sai vinculado ao cadastro — assim o recebimento repõe
      // o estoque dele em vez de criar um item duplicado.
      const input = document.getElementById("swal-avulso-descricao");
      ligarBuscaComSugestoes(
        input,
        "swal-avulso-lista",
        (termo) => fetchAlmox(`/compras/itens/busca?local=${encodeURIComponent(localCompras)}&busca=${encodeURIComponent(termo)}`),
        (i) => `${i.descricao} (${i.quantidade_atual} em estoque)`,
        (i) => {
          input.value = i.descricao;
          input.dataset.iditem = i.iditem;
          document.getElementById("swal-avulso-unidade").value = i.unidade_medida;
        },
        { mensagemVazia: "Nenhum item cadastrado com esse nome — será criado como novo" }
      );
      input.addEventListener("input", () => delete input.dataset.iditem);
    },
    preConfirm: () => {
      const input = document.getElementById("swal-avulso-descricao");
      const descricao = input.value.trim();
      const quantidade_solicitada = parseInt(document.getElementById("swal-avulso-qtd").value, 10);
      if (!descricao) {
        Swal.showValidationMessage("Descreva o item.");
        return false;
      }
      if (!Number.isInteger(quantidade_solicitada) || quantidade_solicitada <= 0) {
        Swal.showValidationMessage("Informe uma quantidade válida.");
        return false;
      }
      return {
        iditem: input.dataset.iditem ? Number(input.dataset.iditem) : null,
        descricao,
        unidade_medida: document.getElementById("swal-avulso-unidade").value.trim() || "unidade",
        quantidade_solicitada,
        justificativa: document.getElementById("swal-avulso-justificativa").value.trim(),
      };
    },
  });

  if (!dados) return;

  // Mesmo item pedido duas vezes soma em vez de duplicar a linha.
  const existente = dados.iditem ? rascunhoItens.find((r) => r.iditem === dados.iditem) : null;
  if (existente) existente.quantidade_solicitada += dados.quantidade_solicitada;
  else rascunhoItens.push(dados);

  atualizarRascunho();
}

async function enviarListaCompra() {
  if (!rascunhoItens.length) {
    Swal.fire("Lista vazia", "Adicione pelo menos um item antes de enviar.", "info");
    return;
  }

  try {
    const { pedido } = await fetchAlmox("/compras/pedidos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        local: localCompras,
        dt_necessidade: rascunhoData || null,
        observacao: rascunhoObs.trim() || null,
        itens: rascunhoItens,
      }),
    });

    rascunhoItens = [];
    rascunhoData = "";
    rascunhoObs = "";
    await Swal.fire("Enviado!", `Lista #${pedido.idpedido} enviada para aprovação.`, "success");
    subAbaCompras = "pedidos";
    renderPainelCompras();
  } catch (erro) {
    console.error("Erro ao enviar lista de compra:", erro);
    Swal.fire("Erro", erro.message || "Erro ao enviar a lista.", "error");
  }
}


// ===== Sub-aba: Listas de compra =====
async function renderListasCompra(filtroStatus = "todos") {
  const alvo = document.getElementById("almox-compras-conteudo");
  if (!alvo) return;

  // Mesmo componente de pílulas do filtro de "Eventos em Aberto"
  // (.option > .input + .btn > .span) — ver #almox-panel .almox-pills no CSS.
  const situacoes = [
    { valor: "todos",     label: "Todas"       },
    { valor: "pendente",  label: "Aguardando"  },
    { valor: "aprovado",  label: "Aprovadas"   },
    { valor: "comprado",  label: "Compradas"   },
    { valor: "parcial",   label: "Parcial"     },
    { valor: "recebido",  label: "Recebidas"   },
    { valor: "recusado",  label: "Recusadas"   },
    { valor: "cancelado", label: "Canceladas"  },
  ];

  alvo.innerHTML = `
      <div class="almox-campo">
        <span>Situação</span>
        <div class="almox-pills">
          ${situacoes
            .map(
              (s) => `
                <div class="option">
                  <input ${s.valor === filtroStatus ? "checked" : ""} value="${s.valor}" name="almox-pedidos-status" type="radio" class="input">
                  <div class="btn"><span class="span">${s.label}</span></div>
                </div>
              `
            )
            .join("")}
        </div>
      </div>
    <table class="ti-tabela" style="margin-top:20px;">
      <thead>
        <tr><th>#</th><th>Local</th><th>Solicitante</th><th>Criada em</th><th>Precisa até</th><th>Itens</th><th>Valor estimado</th><th>Situação</th></tr>
      </thead>
      <tbody id="almox-pedidos-tbody"><tr><td colspan="8">Carregando...</td></tr></tbody>
    </table>
  `;

  alvo.querySelectorAll('input[name="almox-pedidos-status"]').forEach((radio) =>
    radio.addEventListener("change", () => renderListasCompra(radio.value))
  );

  const tbody = document.getElementById("almox-pedidos-tbody");
  try {
    const pedidos = await fetchAlmox(`/compras/pedidos?status=${encodeURIComponent(filtroStatus)}`);
    if (!pedidos.length) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-2);">Nenhuma lista nessa situação.</td></tr>`;
      return;
    }

    tbody.innerHTML = pedidos
      .map(
        (p) => `
          <tr class="almox-pedido-linha" data-idpedido="${p.idpedido}" style="cursor:pointer;">
            <td>#${p.idpedido}</td>
            <td>${escaparHtml(p.local)}</td>
            <td>${escaparHtml(p.nome_solicitante) || "—"}</td>
            <td>${formatarDataAlmox(p.criado_em)}</td>
            <td>${formatarDataAlmox(p.dt_necessidade)}</td>
            <td>${p.total_itens} item(ns)${Number(p.itens_pendentes) ? ` · ${p.itens_pendentes} pendente(s)` : ""}</td>
            <td>${Number(p.valor_estimado) ? formatarValorAlmox(p.valor_estimado) : "—"}</td>
            <td>${pillStatus(p.status)}</td>
          </tr>
        `
      )
      .join("");

    tbody.querySelectorAll(".almox-pedido-linha").forEach((linha) =>
      linha.addEventListener("click", () => abrirPedidoCompra(Number(linha.dataset.idpedido)))
    );
  } catch (erro) {
    console.error("Erro ao listar pedidos de compra:", erro);
    tbody.innerHTML = `<tr><td colspan="8" style="color:var(--status-erro-fg);">Erro ao carregar as listas.</td></tr>`;
  }
}

async function abrirPedidoCompra(idpedido) {
  const alvo = document.getElementById("almox-compras-conteudo");
  if (!alvo) return;
  alvo.innerHTML = almoxLoading("Carregando lista...");

  let pedido;
  try {
    pedido = await fetchAlmox(`/compras/pedidos/${idpedido}`);
  } catch (erro) {
    console.error("Erro ao abrir pedido de compra:", erro);
    alvo.innerHTML = almoxVazio("Erro ao carregar a lista.", "error");
    return;
  }

  const podeAprovar = pedido.pode_aprovar;
  const temAprovado = pedido.itens.some((i) => i.status === "aprovado");
  const temPendente = pedido.itens.some((i) => i.status === "pendente");
  const encerrado = ["cancelado", "recebido"].includes(pedido.status);

  alvo.innerHTML = `
    <div class="almox-bloco-acoes" style="margin-bottom:16px;">
      <button type="button" id="almox-pedido-voltar" class="almox-btn-secundario"><i class="ri-arrow-left-line" aria-hidden="true"></i>Voltar às listas</button>
      ${podeAprovar && temPendente && !encerrado ? `<button type="button" id="almox-pedido-aprovar-tudo" class="almox-btn-ok"><i class="ri-checkbox-multiple-line" aria-hidden="true"></i>Aprovar tudo</button>` : ""}
      ${podeAprovar && temAprovado ? `<button type="button" id="almox-pedido-receber" class="almox-btn-principal"><i class="ri-inbox-archive-line" aria-hidden="true"></i>Confirmar recebimento</button>` : ""}
      ${podeAprovar && !encerrado ? `<button type="button" id="almox-pedido-cancelar" class="almox-btn-erro"><i class="ri-close-circle-line" aria-hidden="true"></i>Cancelar lista</button>` : ""}
    </div>

    <div class="almox-bloco">
      <h3 style="margin:0 0 12px;">Lista #${pedido.idpedido} — ${escaparHtml(pedido.local)} ${pillStatus(pedido.status)}</h3>
      <div class="almox-pedido-info">
        <div><span>Solicitante</span><strong>${escaparHtml(pedido.nome_solicitante) || "—"}</strong></div>
        <div><span>Criada em</span><strong>${formatarDataAlmox(pedido.criado_em)}</strong></div>
        <div><span>Precisa chegar até</span><strong>${formatarDataAlmox(pedido.dt_necessidade)}</strong></div>
        <div><span>Aprovador</span><strong>${escaparHtml(pedido.nome_aprovador) || "—"}</strong></div>
      </div>
      ${pedido.observacao ? `<p style="margin:12px 0 0; color:var(--text-2);">${escaparHtml(pedido.observacao)}</p>` : ""}
    </div>

    <table class="ti-tabela" style="margin-top:20px;">
      <thead>
        <tr><th>Item</th><th>Solicitado</th><th>Aprovado</th><th>Recebido</th><th>Melhor cotação</th><th>Situação</th><th style="width:220px;">Ações</th></tr>
      </thead>
      <tbody>${pedido.itens.map((item) => renderLinhaItemPedido(item, podeAprovar, encerrado)).join("")}</tbody>
    </table>
  `;

  document.getElementById("almox-pedido-voltar").addEventListener("click", () => renderListasCompra(pedido.status));
  document.getElementById("almox-pedido-aprovar-tudo")?.addEventListener("click", () => aprovarListaInteira(pedido.idpedido));
  document.getElementById("almox-pedido-receber")?.addEventListener("click", () => abrirRecebimentoPedido(pedido));
  document.getElementById("almox-pedido-cancelar")?.addEventListener("click", () => cancelarPedidoCompra(pedido.idpedido));

  alvo.querySelectorAll("[data-acao-item]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const item = pedido.itens.find((i) => i.idpedidoitem === Number(btn.dataset.idpedidoitem));
      if (!item) return;
      if (btn.dataset.acaoItem === "cotacoes") abrirCotacoesItem(pedido, item);
      else decidirItemPedido(pedido, item, btn.dataset.acaoItem);
    })
  );
}

function renderLinhaItemPedido(item, podeAprovar, encerrado) {
  const cotacoes = item.cotacoes || [];
  const escolhida = cotacoes.find((c) => c.escolhida);
  const melhor = escolhida || cotacoes[0];
  const textoCotacao = melhor
    ? `${escaparHtml(melhor.fornecedor)} · ${formatarValorAlmox(melhor.valor_unitario)}${escolhida ? " ✓" : ""}`
    : "—";

  // Cada ação usa a cor do status que ela gera (ver .almox-btn-mini no Style.css).
  const acoes = [];
  if (podeAprovar && !encerrado && item.status === "pendente") {
    acoes.push(`<button type="button" class="almox-btn-mini aprovar" data-acao-item="aprovado" data-idpedidoitem="${item.idpedidoitem}"><i class="ri-check-line" aria-hidden="true"></i>Aprovar</button>`);
    acoes.push(`<button type="button" class="almox-btn-mini recusar" data-acao-item="recusado" data-idpedidoitem="${item.idpedidoitem}"><i class="ri-close-line" aria-hidden="true"></i>Recusar</button>`);
  }
  if (podeAprovar && item.status === "aprovado") {
    acoes.push(`<button type="button" class="almox-btn-mini info" data-acao-item="cotacoes" data-idpedidoitem="${item.idpedidoitem}"><i class="ri-price-tag-3-line" aria-hidden="true"></i>Cotações (${cotacoes.length})</button>`);
    acoes.push(`<button type="button" class="almox-btn-mini recusar" data-acao-item="recusado" data-idpedidoitem="${item.idpedidoitem}"><i class="ri-close-line" aria-hidden="true"></i>Recusar</button>`);
  }

  return `
    <tr>
      <td>
        ${escaparHtml(item.descricao)}
        ${item.iditem ? "" : `<span class="almox-pedido-status pendente" style="margin-left:6px;">item novo</span>`}
        ${item.justificativa ? `<br><small style="color:var(--text-2);">${escaparHtml(item.justificativa)}</small>` : ""}
        ${item.observacao_aprovacao ? `<br><small style="color:var(--status-erro-fg);">${escaparHtml(item.observacao_aprovacao)}</small>` : ""}
      </td>
      <td>${item.quantidade_solicitada} ${escaparHtml(item.unidade_medida)}</td>
      <td>${item.quantidade_aprovada ?? "—"}</td>
      <td>${item.quantidade_recebida || "—"}</td>
      <td>${textoCotacao}</td>
      <td>${pillStatus(item.status, STATUS_ITEM)}</td>
      <td>${acoes.join(" ") || "—"}</td>
    </tr>
  `;
}

async function decidirItemPedido(pedido, item, status) {
  const aprovando = status === "aprovado";
  const { value: dados } = await Swal.fire({
    title: aprovando ? `Aprovar — ${item.descricao}` : `Recusar — ${item.descricao}`,
    html: `
      <div class="ti-swal-form">
        ${
          aprovando
            ? `<label class="ti-swal-label-outlined">
                 <input type="number" id="swal-decisao-qtd" class="swal2-input" min="1" value="${item.quantidade_aprovada ?? item.quantidade_solicitada}">
                 <span>Quantidade aprovada</span>
                 <small>Solicitado: ${item.quantidade_solicitada} ${escaparHtml(item.unidade_medida)}. Dá pra aprovar menos.</small>
               </label>`
            : ""
        }
        <label class="ti-swal-label-outlined">
          <input type="text" id="swal-decisao-obs" class="swal2-input" placeholder=" ">
          <span>${aprovando ? "Observação (opcional)" : "Motivo da recusa"}</span>
        </label>
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: aprovando ? "Aprovar" : "Recusar",
    cancelButtonText: "Cancelar",
    reverseButtons: true,
    preConfirm: () => {
      const observacao_aprovacao = document.getElementById("swal-decisao-obs").value.trim();
      if (!aprovando && !observacao_aprovacao) {
        Swal.showValidationMessage("Explique o motivo da recusa.");
        return false;
      }
      const quantidade_aprovada = aprovando ? parseInt(document.getElementById("swal-decisao-qtd").value, 10) : null;
      if (aprovando && (!Number.isInteger(quantidade_aprovada) || quantidade_aprovada <= 0)) {
        Swal.showValidationMessage("Informe uma quantidade válida.");
        return false;
      }
      return { status, quantidade_aprovada, observacao_aprovacao };
    },
  });

  if (!dados) return;

  try {
    await fetchAlmox(`/compras/pedidos/${pedido.idpedido}/itens/${item.idpedidoitem}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados),
    });
    abrirPedidoCompra(pedido.idpedido);
  } catch (erro) {
    console.error("Erro ao registrar decisão do item:", erro);
    Swal.fire("Erro", erro.message || "Erro ao registrar a decisão.", "error");
  }
}

async function aprovarListaInteira(idpedido) {
  const confirmacao = await Swal.fire({
    title: "Aprovar a lista inteira?",
    text: "Todos os itens pendentes são aprovados na quantidade solicitada.",
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Aprovar tudo",
    cancelButtonText: "Cancelar",
    reverseButtons: true,
  });
  if (!confirmacao.isConfirmed) return;

  try {
    await fetchAlmox(`/compras/pedidos/${idpedido}/aprovar-tudo`, { method: "PUT" });
    abrirPedidoCompra(idpedido);
  } catch (erro) {
    console.error("Erro ao aprovar lista:", erro);
    Swal.fire("Erro", erro.message || "Erro ao aprovar a lista.", "error");
  }
}

async function cancelarPedidoCompra(idpedido) {
  const confirmacao = await Swal.fire({
    title: "Cancelar esta lista?",
    text: "A lista deixa de valer para compra. Itens já recebidos continuam no estoque.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Cancelar lista",
    cancelButtonText: "Voltar",
    reverseButtons: true,
  });
  if (!confirmacao.isConfirmed) return;

  try {
    await fetchAlmox(`/compras/pedidos/${idpedido}/cancelar`, { method: "PUT" });
    renderListasCompra("cancelado");
  } catch (erro) {
    console.error("Erro ao cancelar lista:", erro);
    Swal.fire("Erro", erro.message || "Erro ao cancelar a lista.", "error");
  }
}

// ===== Cotações por item (comparar fornecedores) =====
async function abrirCotacoesItem(pedido, item) {
  const cotacoes = item.cotacoes || [];
  const quantidade = item.quantidade_aprovada ?? item.quantidade_solicitada;

  const linhas = cotacoes.length
    ? cotacoes
        .map(
          (c) => `
            <tr class="${c.escolhida ? "almox-cotacao-escolhida" : ""}">
              <td>${escaparHtml(c.fornecedor)}</td>
              <td>${formatarValorAlmox(c.valor_unitario)}</td>
              <td>${formatarValorAlmox(Number(c.valor_unitario) * quantidade)}</td>
              <td>${c.prazo_entrega_dias ?? "—"}</td>
              <td>
                ${c.escolhida
                  ? "<strong>escolhida</strong>"
                  : `<button type="button" class="almox-btn-mini aprovar" data-escolher="${c.idcotacao}"><i class="ri-check-line" aria-hidden="true"></i>escolher</button>`}
                <button type="button" class="almox-btn-mini recusar" data-excluir="${c.idcotacao}"><i class="ri-delete-bin-line" aria-hidden="true"></i></button>
              </td>
            </tr>
          `
        )
        .join("")
    : `<tr><td colspan="5" style="text-align:center; color:var(--text-2);">Nenhuma cotação ainda.</td></tr>`;

  await Swal.fire({
    title: `Cotações — ${item.descricao}`,
    width: 720,
    html: `
      <p style="margin:0 0 10px; color:var(--text-2); font-size:13px;">Quantidade a comprar: <strong>${quantidade} ${escaparHtml(item.unidade_medida)}</strong></p>
      <table class="ti-tabela almox-tabela-swal">
        <thead><tr><th>Fornecedor</th><th>Unitário</th><th>Total</th><th>Prazo (dias)</th><th></th></tr></thead>
        <tbody id="almox-cotacoes-tbody">${linhas}</tbody>
      </table>
      <div class="ti-swal-form" style="margin-top:16px;">
        <label class="ti-swal-label-outlined">
          <input type="text" id="swal-cot-fornecedor" class="swal2-input" placeholder=" " autocomplete="off">
          <span>Fornecedor</span>
          <small>Busca os fornecedores cadastrados; pode digitar um nome livre também.</small>
        </label>
        <label class="ti-swal-label-outlined">
          <input type="number" id="swal-cot-valor" class="swal2-input" min="0" step="0.01" placeholder=" ">
          <span>Valor unitário</span>
        </label>
        <label class="ti-swal-label-outlined">
          <input type="number" id="swal-cot-prazo" class="swal2-input" min="0" placeholder=" ">
          <span>Prazo de entrega (dias)</span>
        </label>
        <label class="ti-swal-label" style="display:flex; align-items:center; gap:8px;">
          <input type="checkbox" id="swal-cot-escolhida" checked> Marcar como a cotação escolhida
        </label>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: "Adicionar cotação",
    cancelButtonText: "Fechar",
    reverseButtons: true,
    didOpen: () => {
      const input = document.getElementById("swal-cot-fornecedor");
      ligarBuscaComSugestoes(
        input,
        "swal-cot-fornecedor-lista",
        (termo) => fetchAlmox(`/compras/fornecedores/busca?busca=${encodeURIComponent(termo)}`),
        (f) => f.nome,
        (f) => {
          input.value = f.nome;
          input.dataset.idfornecedor = f.idfornecedor;
        },
        { mensagemVazia: "Fornecedor não cadastrado — vai como nome livre" }
      );
      input.addEventListener("input", () => delete input.dataset.idfornecedor);

      // Escolher/excluir agem na hora (sem fechar o modal) e recarregam a tela.
      document.getElementById("almox-cotacoes-tbody").addEventListener("click", async (e) => {
        const escolher = e.target.closest("[data-escolher]");
        const excluir = e.target.closest("[data-excluir]");
        if (!escolher && !excluir) return;

        try {
          if (escolher) {
            await fetchAlmox(`/compras/pedidos/${pedido.idpedido}/cotacoes/${escolher.dataset.escolher}/escolher`, { method: "PUT" });
          } else {
            await fetchAlmox(`/compras/pedidos/${pedido.idpedido}/cotacoes/${excluir.dataset.excluir}`, { method: "DELETE" });
          }
          Swal.close();
          abrirPedidoCompra(pedido.idpedido);
        } catch (erro) {
          console.error("Erro ao atualizar cotação:", erro);
          Swal.fire("Erro", erro.message || "Erro ao atualizar a cotação.", "error");
        }
      });
    },
    preConfirm: () => {
      const input = document.getElementById("swal-cot-fornecedor");
      const fornecedor = input.value.trim();
      const valor = parseFloat(document.getElementById("swal-cot-valor").value);
      if (!fornecedor) {
        Swal.showValidationMessage("Informe o fornecedor.");
        return false;
      }
      if (!Number.isFinite(valor) || valor < 0) {
        Swal.showValidationMessage("Informe um valor unitário válido.");
        return false;
      }
      const prazo = parseInt(document.getElementById("swal-cot-prazo").value, 10);
      return {
        idfornecedor: input.dataset.idfornecedor ? Number(input.dataset.idfornecedor) : null,
        fornecedor_nome: input.dataset.idfornecedor ? null : fornecedor,
        valor_unitario: valor,
        prazo_entrega_dias: Number.isInteger(prazo) ? prazo : null,
        escolhida: document.getElementById("swal-cot-escolhida").checked,
      };
    },
  }).then(async (resultado) => {
    if (!resultado.isConfirmed || !resultado.value) return;
    try {
      await fetchAlmox(`/compras/pedidos/${pedido.idpedido}/itens/${item.idpedidoitem}/cotacoes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(resultado.value),
      });
      abrirPedidoCompra(pedido.idpedido);
    } catch (erro) {
      console.error("Erro ao registrar cotação:", erro);
      Swal.fire("Erro", erro.message || "Erro ao registrar a cotação.", "error");
    }
  });
}

// ===== Recebimento: confirmação manual antes de entrar no estoque =====
// A quantidade vem preenchida com a aprovada, mas é editável — comprou mais ou
// menos do que estava na lista, corrige aqui e é isso que entra no estoque.
async function abrirRecebimentoPedido(pedido) {
  const itens = pedido.itens.filter((i) => i.status === "aprovado");
  if (!itens.length) {
    Swal.fire("Nada a receber", "Nenhum item aprovado pendente de recebimento.", "info");
    return;
  }

  const linhas = itens
    .map((item) => {
      const escolhida = (item.cotacoes || []).find((c) => c.escolhida);
      return `
        <tr>
          <td style="text-align:left;">
            ${escaparHtml(item.descricao)}
            <br><small style="color:var(--text-2);">aprovado: ${item.quantidade_aprovada ?? item.quantidade_solicitada} ${escaparHtml(item.unidade_medida)}</small>
          </td>
          <td><input type="number" class="almox-rec-qtd" data-idpedidoitem="${item.idpedidoitem}" min="0"
                     value="${item.quantidade_aprovada ?? item.quantidade_solicitada}" style="width:80px;"></td>
          <td><input type="text" class="almox-rec-fornecedor" data-idpedidoitem="${item.idpedidoitem}"
                     data-idfornecedor="${escolhida?.idfornecedor || ""}" value="${escolhida ? escaparHtml(escolhida.fornecedor) : ""}"
                     placeholder="Fornecedor" style="width:150px;"></td>
          <td><input type="number" class="almox-rec-valor" data-idpedidoitem="${item.idpedidoitem}" min="0" step="0.01"
                     value="${escolhida?.valor_unitario ?? ""}" placeholder="0,00" style="width:100px;"></td>
        </tr>
      `;
    })
    .join("");

  const { value: confirmado } = await Swal.fire({
    title: `Confirmar recebimento — lista #${pedido.idpedido}`,
    width: 760,
    html: `
      <p style="margin:0 0 10px; color:var(--text-2); font-size:13px;">
        Confira o que realmente chegou. Só o que for confirmado aqui entra no estoque — deixe <strong>0</strong> no que não veio.
      </p>
      <div class="ti-swal-form" style="margin-bottom:12px;">
        <label class="ti-swal-label-outlined">
          <input type="date" id="swal-rec-data" class="swal2-input" value="${hojeISO()}">
          <span>Data da compra</span>
        </label>
      </div>
      <table class="ti-tabela almox-tabela-swal">
        <thead><tr><th>Item</th><th>Recebido</th><th>Fornecedor</th><th>Valor unit.</th></tr></thead>
        <tbody>${linhas}</tbody>
      </table>
    `,
    showCancelButton: true,
    confirmButtonText: "Confirmar e dar entrada",
    cancelButtonText: "Cancelar",
    reverseButtons: true,
    didOpen: () => {
      // Se o usuário reescrever o fornecedor, o vínculo com o cadastro cai e o
      // nome digitado é o que vale.
      document.querySelectorAll(".almox-rec-fornecedor").forEach((input) =>
        input.addEventListener("input", () => {
          input.dataset.idfornecedor = "";
        })
      );
    },
    preConfirm: () => {
      const dt_compra = document.getElementById("swal-rec-data").value || null;
      const linhasConfirmadas = [];

      for (const campo of document.querySelectorAll(".almox-rec-qtd")) {
        const idpedidoitem = Number(campo.dataset.idpedidoitem);
        const quantidade = parseInt(campo.value, 10);
        if (!Number.isInteger(quantidade) || quantidade < 0) {
          Swal.showValidationMessage("Quantidade recebida inválida.");
          return false;
        }
        if (quantidade === 0) continue;

        const inputFornecedor = document.querySelector(`.almox-rec-fornecedor[data-idpedidoitem="${idpedidoitem}"]`);
        const inputValor = document.querySelector(`.almox-rec-valor[data-idpedidoitem="${idpedidoitem}"]`);
        const idfornecedor = inputFornecedor.dataset.idfornecedor;

        linhasConfirmadas.push({
          idpedidoitem,
          quantidade,
          dt_compra,
          idfornecedor: idfornecedor ? Number(idfornecedor) : null,
          fornecedor_nome: idfornecedor ? null : inputFornecedor.value.trim() || null,
          valor_unitario: inputValor.value === "" ? null : Number(inputValor.value),
        });
      }

      if (!linhasConfirmadas.length) {
        Swal.showValidationMessage("Confirme a quantidade de pelo menos um item.");
        return false;
      }
      return linhasConfirmadas;
    },
  });

  if (!confirmado) return;

  try {
    const resposta = await fetchAlmox(`/compras/pedidos/${pedido.idpedido}/receber`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itens: confirmado }),
    });
    await Swal.fire("Recebido!", resposta.message, "success");
    abrirPedidoCompra(pedido.idpedido);
  } catch (erro) {
    console.error("Erro ao confirmar recebimento:", erro);
    Swal.fire("Erro", erro.message || "Erro ao confirmar o recebimento.", "error");
  }
}

// ===== Sub-aba: Preços e durabilidade =====
async function renderPrecosCompra(iditemSelecionado = null) {
  const alvo = document.getElementById("almox-compras-conteudo");
  if (!alvo) return;
  alvo.innerHTML = almoxLoading("Carregando itens...");

  let itens = [];
  try {
    itens = await fetchAlmox("/compras/itens");
  } catch (erro) {
    console.error("Erro ao listar itens com compras:", erro);
    alvo.innerHTML = almoxVazio("Erro ao carregar os itens.", "error");
    return;
  }

  const comCompras = itens.filter((i) => Number(i.compras) > 0);
  if (!comCompras.length) {
    alvo.innerHTML = almoxVazio("Nenhuma compra registrada ainda. Assim que uma lista for recebida, o histórico aparece aqui.", "receipt_long");
    return;
  }

  const idSelecionado = iditemSelecionado || comCompras[0].iditem;

  alvo.innerHTML = `
    <div class="almox-bloco">
      <div class="almox-form-grid">
        <label class="almox-campo almox-campo-larga">
          <span>Item</span>
          <select id="almox-precos-item">
          ${comCompras
            .map(
              (i) =>
                `<option value="${i.iditem}" ${i.iditem === idSelecionado ? "selected" : ""}>${escaparHtml(i.descricao)} — ${escaparHtml(i.local)} (${i.compras} compra(s))</option>`
            )
            .join("")}
          </select>
        </label>
      </div>
    </div>
    <div id="almox-precos-detalhe">${almoxLoading()}</div>
  `;

  document.getElementById("almox-precos-item").addEventListener("change", (e) => renderPrecosCompra(Number(e.target.value)));
  carregarDetalhePrecos(idSelecionado);
}

async function carregarDetalhePrecos(iditem) {
  const alvo = document.getElementById("almox-precos-detalhe");
  if (!alvo) return;

  try {
    const [precos, historico] = await Promise.all([
      fetchAlmox(`/compras/itens/${iditem}/precos`),
      fetchAlmox(`/compras/itens/${iditem}/historico`),
    ]);

    const menorMedia = precos.length ? Number(precos[0].valor_medio) : null;

    const linhasFornecedor = precos.length
      ? precos
          .map(
            (f) => `
              <tr>
                <td>${escaparHtml(f.fornecedor)}${Number(f.valor_medio) === menorMedia ? ' <span class="almox-pedido-status aprovado">melhor média</span>' : ""}</td>
                <td>${f.compras}</td>
                <td>${formatarValorAlmox(f.menor_valor)}</td>
                <td>${formatarValorAlmox(f.valor_medio)}</td>
                <td>${formatarValorAlmox(f.ultimo_valor)}</td>
                <td>${formatarDataAlmox(f.ultima_compra)}</td>
                <td>${formatarValorAlmox(f.total_gasto)}</td>
              </tr>
            `
          )
          .join("")
      : `<tr><td colspan="7" style="text-align:center; color:var(--text-2);">Nenhuma compra com valor informado.</td></tr>`;

    const linhasHistorico = historico.compras.length
      ? historico.compras
          .map((c) => {
            const duracao =
              c.duracao_estimada_dias === null
                ? "<span style='color:var(--text-2);'>sem consumo no período</span>"
                : `${c.duracao_estimada_dias} dia(s)${c.periodo_fechado ? "" : " <small style='color:var(--text-2);'>(em curso)</small>"}`;
            return `
              <tr>
                <td>${formatarDataAlmox(c.dt_compra)}</td>
                <td>${c.quantidade} ${escaparHtml(historico.item.unidade_medida)}</td>
                <td>${escaparHtml(c.fornecedor) || "—"}</td>
                <td>${formatarValorAlmox(c.valor_unitario)}</td>
                <td>${formatarValorAlmox(c.valor_total)}</td>
                <td>${c.consumo_periodo}</td>
                <td>${duracao}</td>
                <td>${c.idpedido ? `#${c.idpedido}` : "—"}</td>
              </tr>
            `;
          })
          .join("")
      : `<tr><td colspan="8" style="text-align:center; color:var(--text-2);">Nenhuma compra registrada.</td></tr>`;

    alvo.innerHTML = `
      <h4 style="margin:20px 0 8px;">Comparativo por fornecedor</h4>
      <table class="ti-tabela">
        <thead><tr><th>Fornecedor</th><th>Compras</th><th>Menor unit.</th><th>Média unit.</th><th>Último unit.</th><th>Última compra</th><th>Total gasto</th></tr></thead>
        <tbody>${linhasFornecedor}</tbody>
      </table>

      <h4 style="margin:24px 0 8px;">Histórico do item — quanto durou cada compra</h4>
      <p style="margin:0 0 10px; color:var(--text-2); font-size:12.5px;">
        A duração é estimada pelo consumo registrado depois de cada compra (saídas do almoxarifado).
      </p>
      <table class="ti-tabela">
        <thead><tr><th>Data</th><th>Quantidade</th><th>Fornecedor</th><th>Unitário</th><th>Total</th><th>Consumo no período</th><th>Duração</th><th>Lista</th></tr></thead>
        <tbody>${linhasHistorico}</tbody>
      </table>
    `;
  } catch (erro) {
    console.error("Erro ao carregar preços do item:", erro);
    alvo.innerHTML = almoxVazio("Erro ao carregar o comparativo.", "error");
  }
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
