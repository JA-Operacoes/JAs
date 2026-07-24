// Cadastro de Plano de Saúde (modal CadPlanoSaude.html).
// Carregado como <script type="module"> pelo loader genérico (Index.js -> abrirModal),
// depois que o HTML do modal já está no #modal-container. Por isso os elementos já existem
// quando este módulo executa — não precisa esperar DOMContentLoaded.
//
// São "dois formulários em um":
//   1) Nome do plano + cadastro dos TIPOS que o plano possui (chips).
//   2) Para cada tipo, as FAIXAS de valor por período de idade (de X até Y anos -> R$).
//
// Como só uma tabela de faixas fica visível por vez (a do tipo escolhido no #tpPlanos),
// guardamos tudo no objeto `estado` em memória: ao trocar o select, salvamos as faixas
// do tipo anterior e carregamos as do novo. O backend (/planosaude) é implementado depois.

// utils.js não existe no disco deste projeto, então o helper de fetch é local e
// autossuficiente (mesmo padrão usado no restante do sistema).
async function fetchComToken(url, options = {}) {
  const token = localStorage.getItem("token");
  const idempresa = localStorage.getItem("idempresa");
  if (!options.headers) options.headers = {};
  options.headers["Authorization"] = "Bearer " + token;
  if (idempresa) options.headers["idempresa"] = idempresa;
  if (options.body && typeof options.body !== "string") {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(options.body);
  }

  const resposta = await fetch(url, options);
  if (resposta.status === 401) {
    localStorage.clear();
    await Swal.fire({ icon: "warning", title: "Sessão expirada", text: "Faça login novamente." });
    window.location.href = "login.html";
    throw new Error("Sessão expirada");
  }
  if (!resposta.ok) {
    const txt = await resposta.text();
    throw new Error(`Erro ${resposta.status}: ${txt}`);
  }
  // 204 (sem corpo) ou corpo vazio -> null
  const texto = await resposta.text();
  return texto ? JSON.parse(texto) : null;
}

// Helpers monetários (globais definidos em Formataçoes.js).
const moeda = (el) => {
  if (!el || el.value.trim() === "") return null;
  const n = window.desformatarReais(el.value);
  return n === "" ? null : n;
};
const fmtMoeda = (n) => (n != null && n !== "" ? "R$ " + window.formatarReaisValor(n) : "");

// Idade: inteiro (anos). "" = sem limite (usado no "Até" da última faixa).
const idade = (el) => {
  if (!el || el.value.trim() === "") return null;
  const n = parseInt(el.value, 10);
  return isNaN(n) ? null : n;
};

function aviso(icon, title, text) {
  if (window.Swal) return Swal.fire({ icon, title, text });
  alert(`${title}\n${text || ""}`);
}

// Fecha o modal (mesma limpeza visual do fecharModal do Index.js, que e interno
// daquele modulo e nao fica acessivel aqui).
function fecharModalPlano() {
  const container = document.getElementById("modal-container");
  if (container) container.innerHTML = "";
  const overlay = document.getElementById("modal-overlay");
  if (overlay) overlay.style.display = "none";
  document.body.classList.remove("modal-open");
}

// ---- Estado em memória ----
// tipos: [{ id, nome, faixas: [{ de, ate, valor }] }]
const estado = {
  nomeOriginal: null, // nome do plano ao abrir pela pesquisa (chave p/ editar); null = novo
  nome: "",
  tipos: [],
  tipoSelecionadoId: null, // id do tipo atualmente exibido na tabela
};
let seqTipo = 0; // gerador de id local (não usa Date.now/random)

const $ = (id) => document.getElementById(id);
const tbodyFaixas = () => document.querySelector("#plano-faixas tbody");

// ---- Linha de faixa (De idade / Até idade / Valor) ----
function criarLinhaFaixa(faixa = {}) {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><input type="number" min="0" step="1" class="f-de" value="${faixa.de ?? ""}"></td>
    <td><input type="number" min="0" step="1" class="f-ate" value="${faixa.ate ?? ""}" placeholder="∞"></td>
    <td><input type="text" inputmode="numeric" oninput="formatReais(this)" class="f-valor" value="${fmtMoeda(faixa.valor)}"></td>
    <td><button type="button" class="plano-rm" title="Remover">✕</button></td>`;
  tr.querySelector(".plano-rm").addEventListener("click", () => tr.remove());
  tbodyFaixas().appendChild(tr);
}

// Lê a tabela visível -> array de faixas.
function coletarFaixasDaTabela() {
  return Array.from(document.querySelectorAll("#plano-faixas tbody tr"))
    .map((tr) => ({
      de: idade(tr.querySelector(".f-de")),
      ate: idade(tr.querySelector(".f-ate")), // null = idade em diante (última faixa)
      valor: moeda(tr.querySelector(".f-valor")),
    }))
    // descarta linhas totalmente vazias
    .filter((f) => f.de != null || f.ate != null || f.valor != null);
}

// Salva as faixas atualmente na tela no tipo que está selecionado.
function salvarFaixasDoTipoAtual() {
  const t = estado.tipos.find((x) => x.id === estado.tipoSelecionadoId);
  if (t) t.faixas = coletarFaixasDaTabela();
}

// ---- Tipos (chips + <option> do select) ----
function renderTipos() {
  const cont = $("planosContainer");
  const sel = $("tpPlanos");
  cont.innerHTML = "";
  // mantém só o placeholder no select
  sel.querySelectorAll("option:not([value=''])").forEach((o) => o.remove());

  estado.tipos.forEach((t) => {
    const chip = document.createElement("span");
    chip.className = "plano-chip";
    chip.innerHTML = `${t.nome} <small>(${t.faixas.length})</small> <button type="button" class="plano-chip-rm" title="Remover">✕</button>`;
    chip.querySelector(".plano-chip-rm").addEventListener("click", () => removerTipo(t.id));
    cont.appendChild(chip);

    const opt = document.createElement("option");
    opt.value = String(t.id);
    opt.textContent = t.nome;
    sel.appendChild(opt);
  });

  // reseleciona o tipo ativo (se ainda existir)
  sel.value = estado.tipoSelecionadoId != null ? String(estado.tipoSelecionadoId) : "";
}

function addTipo() {
  const input = $("nmTipo");
  const nome = input.value.trim();
  if (!nome) return aviso("warning", "Informe o tipo", "Digite o nome do tipo de plano.");
  if (estado.tipos.some((t) => t.nome.toLowerCase() === nome.toLowerCase())) {
    return aviso("warning", "Tipo repetido", `O tipo "${nome}" já foi adicionado.`);
  }
  const novo = { id: ++seqTipo, nome, faixas: [] };
  estado.tipos.push(novo);
  input.value = "";
  renderTipos();
  // já seleciona o tipo recém-criado para o usuário emendar as faixas
  selecionarTipo(novo.id);
}

function removerTipo(id) {
  const eraSelecionado = estado.tipoSelecionadoId === id;
  estado.tipos = estado.tipos.filter((t) => t.id !== id);
  if (eraSelecionado) {
    estado.tipoSelecionadoId = null;
    tbodyFaixas().innerHTML = "";
  }
  renderTipos();
}

// Carrega as faixas de um tipo na tabela (salvando antes as do tipo anterior).
function selecionarTipo(id) {
  salvarFaixasDoTipoAtual();
  estado.tipoSelecionadoId = id != null ? Number(id) : null;
  renderTipos(); // atualiza contadores dos chips e o valor do select

  const tbody = tbodyFaixas();
  tbody.innerHTML = "";
  const t = estado.tipos.find((x) => x.id === estado.tipoSelecionadoId);
  if (t) {
    if (t.faixas.length) t.faixas.forEach(criarLinhaFaixa);
    else criarLinhaFaixa(); // começa com uma linha em branco
  }
}

// ---- Ações do rodapé ----
async function salvar() {
  estado.nome = $("nmPlano").value.trim();
  salvarFaixasDoTipoAtual();

  if (!estado.nome) return aviso("warning", "Falta o nome", "Informe o nome do plano.");
  if (!estado.tipos.length) return aviso("warning", "Sem tipos", "Adicione ao menos um tipo de plano.");
  const semFaixa = estado.tipos.find((t) => !t.faixas.length);
  if (semFaixa) return aviso("warning", "Faltam faixas", `O tipo "${semFaixa.nome}" não tem nenhuma faixa de valor.`);

  const body = {
    nome: estado.nome,
    tipos: estado.tipos.map((t) => ({ nome: t.nome, faixas: t.faixas })),
  };

  const editando = estado.nomeOriginal != null;
  const url = editando ? `/planosaude/${encodeURIComponent(estado.nomeOriginal)}` : "/planosaude";
  const method = editando ? "PUT" : "POST";

  try {
    await fetchComToken(url, { method, body });
    await aviso("success", "Salvo", `Plano "${estado.nome}" ${editando ? "atualizado" : "salvo"} com sucesso.`);
    limpar();
  } catch (err) {
    console.error("Erro ao salvar plano de saúde:", err);
    aviso("error", "Erro", err?.message || "Não foi possível salvar o plano.");
  }
}

// Preenche o formulário com um plano vindo do backend (modo edição).
function carregarPlano(plano) {
  limpar();
  estado.nomeOriginal = plano.nome || "";
  estado.nome = plano.nome || "";
  estado.tipos = (plano.tipos || []).map((t) => ({
    id: ++seqTipo,
    nome: t.nome,
    faixas: Array.isArray(t.faixas) ? t.faixas : [],
  }));
  $("nmPlano").value = estado.nome;
  renderTipos();
  if (estado.tipos.length) selecionarTipo(estado.tipos[0].id);
}

function limpar() {
  estado.nomeOriginal = null;
  estado.nome = "";
  estado.tipos = [];
  estado.tipoSelecionadoId = null;
  seqTipo = 0;
  $("nmPlano").value = "";
  $("nmTipo").value = "";
  tbodyFaixas().innerHTML = "";
  renderTipos();
}

// Pesquisar no mesmo estilo do Funcionarios.js: lista suspensa ancorada no campo
// "Nome do Plano", com filtro ao vivo enquanto digita, clique carrega o plano.
async function pesquisar() {
  let lista;
  try {
    lista = await fetchComToken("/planosaude");
  } catch (err) {
    console.error("Erro ao pesquisar planos de saúde:", err);
    return aviso("error", "Erro", err?.message || "Não foi possível carregar os planos.");
  }
  if (!lista || !lista.length) {
    return aviso("info", "Nenhum plano", "Ainda não há planos de saúde cadastrados.");
  }
  limpar();
  ativarModoBusca(lista);
}

function ativarModoBusca(planos) {
  const campoNome = $("nmPlano");
  if (!campoNome) return;

  const wrapper = campoNome.parentNode; // .form2
  wrapper.style.position = "relative";
  let lista = document.getElementById("plano-busca-lista");
  if (!lista) {
    lista = document.createElement("ul");
    lista.id = "plano-busca-lista";
    lista.className = "plano-busca-lista";
    lista.style.cssText =
      "position:absolute; left:0; right:0; top:100%; z-index:50;" +
      "background:#fff; border:1px solid #ccc; border-radius:6px; max-height:220px;" +
      "overflow-y:auto; margin:0; padding:4px; list-style:none;" +
      "box-shadow:0 4px 12px rgba(0,0,0,.15);";
    wrapper.appendChild(lista);
  }

  lista.innerHTML = "";
  planos.forEach((p) => {
    const li = document.createElement("li");
    li.dataset.nome = p.nome || "";
    li.textContent = `${p.nome} (${p.qtdtipos} tipo${p.qtdtipos == 1 ? "" : "s"})`;
    li.style.cssText = "padding:6px 10px; cursor:pointer; border-radius:4px; color:#000;";
    li.addEventListener("mouseover", () => { li.style.background = "#f0f2f5"; });
    li.addEventListener("mouseout", () => { li.style.background = ""; });
    // mousedown dispara antes do blur do campo, evitando que a lista suma antes do clique.
    li.addEventListener("mousedown", async (e) => {
      e.preventDefault();
      sairModoBusca();
      try {
        const plano = await fetchComToken(`/planosaude/${encodeURIComponent(li.dataset.nome)}`);
        if (plano) carregarPlano(plano);
      } catch (err) {
        console.error("Erro ao carregar plano de saúde:", err);
        aviso("error", "Erro", err?.message || "Não foi possível abrir o plano.");
      }
    });
    lista.appendChild(li);
  });

  campoNome.addEventListener("input", filtrarBusca);
  campoNome.addEventListener("focus", mostrarBusca);
  filtrarBusca();
  campoNome.focus();
  document.addEventListener("mousedown", fecharBuscaSeFora);
}

function mostrarBusca() {
  const lista = document.getElementById("plano-busca-lista");
  if (lista) lista.style.display = "block";
}

function filtrarBusca() {
  const lista = document.getElementById("plano-busca-lista");
  if (!lista) return;
  const termo = ($("nmPlano")?.value || "").toUpperCase().trim();
  lista.querySelectorAll("li").forEach((li) => {
    const nome = (li.dataset.nome || "").toUpperCase();
    li.style.display = (!termo || nome.includes(termo)) ? "block" : "none";
  });
  lista.style.display = "block";
}

function fecharBuscaSeFora(e) {
  const lista = document.getElementById("plano-busca-lista");
  if (!lista) return;
  const campoNome = $("nmPlano");
  if (e.target === campoNome || lista.contains(e.target)) return;
  lista.style.display = "none";
}

function sairModoBusca() {
  const lista = document.getElementById("plano-busca-lista");
  if (lista) lista.remove();
  document.removeEventListener("mousedown", fecharBuscaSeFora);
  const campoNome = $("nmPlano");
  if (campoNome) {
    campoNome.removeEventListener("input", filtrarBusca);
    campoNome.removeEventListener("focus", mostrarBusca);
  }
}

// ---- Ligação dos eventos (elementos já existem no DOM) ----
$("plano-add-tipo")?.addEventListener("click", addTipo);
$("nmTipo")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); addTipo(); }
});
$("plano-add-faixa")?.addEventListener("click", () => {
  if (estado.tipoSelecionadoId == null) {
    return aviso("warning", "Selecione um tipo", "Escolha um tipo de plano antes de adicionar faixas.");
  }
  criarLinhaFaixa();
});
$("tpPlanos")?.addEventListener("change", (e) => selecionarTipo(e.target.value || null));
$("Enviar")?.addEventListener("click", salvar);
$("Limpar")?.addEventListener("click", limpar);
$("Pesquisar")?.addEventListener("click", pesquisar);
$("Fechar")?.addEventListener("click", fecharModalPlano);

// Registra o handler do modulo (o Index.js chama desinicializar ao fechar o modal;
// sem esse registro window.moduloHandlers fica undefined e o fecharModal quebra).
window.moduloHandlers = window.moduloHandlers || {};
window.moduloHandlers['PlanoSaude'] = {
  desinicializar: () => {
    sairModoBusca(); // remove a lista de busca e seus listeners globais, se abertos
  },
};
