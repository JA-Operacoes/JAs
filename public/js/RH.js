import { fetchComToken } from '/utils/utils.js';

// ===== RH — Holerite Virtual =====
// Painel "tela limpa" (mesmo padrão do CeoMode) para a folha de pagamento dos
// funcionários de salário fixo. Seletor de funcionário + competência (mês/ano);
// mostra salário base, proventos/descontos variáveis, líquido e status de pagamento.

// Número (3000) -> texto BR com símbolo, para preencher o input ("R$ 3.000,00").
const formatarReaisInput = (v) =>
  "R$ " + (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Texto formatado ("R$ 3.000,00" ou "3.000,00") -> número puro (3000). Vazio => 0.
const desformatarReais = (valor) => {
  if (valor === null || valor === undefined || valor === "") return 0;
  const limpo = String(valor).replace(/[^\d,-]/g, "").replace(",", ".");
  const n = parseFloat(limpo);
  return isNaN(n) ? 0 : n;
};

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

// Competência selecionada (default: mês/ano atuais).
const hoje = new Date();
let mesSel = hoje.getMonth() + 1;
let anoSel = hoje.getFullYear();
let tipoSel = "mensal"; // mensal | ferias | 13 | rescisao

// Tipos de holerite disponíveis (value usado no backend + rótulo exibido).
const TIPOS_HOLERITE = [
  { v: "mensal", label: "Mensal" },
  { v: "ferias", label: "Férias" },
  { v: "13", label: "13º salário" },
  { v: "rescisao", label: "Rescisão" },
];

// Forma de pagamento do 13º escolhida dentro do holerite de 13º.
let parcela13 = "unica"; // unica | 1 | 2

// Toggle "somar benefícios (VA/VT) no líquido". Default desligado (benefícios são
// informativos / pagos via cartão). Escolha de tela, não persiste.
let incluirBeneficios = false;

// Dias úteis da competência (seg–sex − feriados, calculado no backend). Editável no
// holerite mensal: VA/VT = valor/dia (cadastro do funcionário) × dias úteis.
let diasUteisSel = 0;

const VA_DESC = "Vale-Alimentação";
const VT_DESC = "Vale-Transporte";
const PLANO_SAUDE_DESC = "Plano de Saúde";

// Monta as linhas de benefício VA/VT a partir do valor/dia × dias úteis.
function presetBeneficiosVAVT(diaVA, diaVT, dias) {
  const itens = [];
  const va = Math.round((Number(diaVA) || 0) * dias * 100) / 100;
  const vt = Math.round((Number(diaVT) || 0) * dias * 100) / 100;
  itens.push({ tipo: "B", descricao: VA_DESC, valor: va });
  itens.push({ tipo: "B", descricao: VT_DESC, valor: vt });
  return itens;
}

// Dados específicos da rescisão (preenchidos dentro do holerite de rescisão).
let rescisaoInput = {
  desligamento: "",        // YYYY-MM-DD
  motivo: "sem_justa_causa", // sem_justa_causa | pedido | acordo | justa_causa | fim_contrato
  avisoPrevio: "indenizado", // indenizado | trabalhado | dispensado | nao_cumprido
  feriasVencidas: 0,       // nº de períodos aquisitivos vencidos não gozados
  saldoFgts: 0,            // saldo do FGTS depositado (informado manualmente)
};

const MOTIVOS_RESCISAO = [
  { v: "sem_justa_causa", label: "Sem justa causa (empregador)" },
  { v: "pedido", label: "Pedido de demissão" },
  { v: "acordo", label: "Acordo (art. 484-A)" },
  { v: "justa_causa", label: "Justa causa" },
  { v: "fim_contrato", label: "Término de contrato" },
];
const AVISOS_PREVIO = [
  { v: "indenizado", label: "Indenizado (pago)" },
  { v: "trabalhado", label: "Trabalhado/cumprido" },
  { v: "dispensado", label: "Dispensado (sem pagar)" },
  { v: "nao_cumprido", label: "Não cumprido (desconta)" },
];

// Itens do 13º conforme a forma de pagamento (lei permite parcela única ou 2 parcelas).
function preset13(parcela, salariobase) {
  const s = Number(salariobase) || 0;
  // 1ª parcela: metade do salário, SEM INSS/IRRF (adiantamento, pago até 30/11).
  if (parcela === "1") return [
    { tipo: "P", descricao: "13º salário (1ª parcela)", valor: s / 2 },
  ];
  // 2ª parcela: 13º cheio como provento, menos o adiantamento da 1ª; INSS/IRRF incidem
  // sobre o 13º CHEIO (clique em "Calcular INSS/IRRF" — o bruto já é o salário inteiro).
  if (parcela === "2") return [
    { tipo: "P", descricao: "13º salário", valor: s },
    { tipo: "D", descricao: "Adiantamento 1ª parcela", valor: s / 2 },
  ];
  // Parcela única: 13º cheio, com INSS/IRRF pelo botão calcular.
  return [{ tipo: "P", descricao: "13º salário", valor: s }];
}

// Proventos pré-preenchidos ao abrir um tipo novo (rascunho), com base no salário.
function presetItens(tipo, salariobase) {
  const s = Number(salariobase) || 0;
  // Mensal: VA/VT são montados por dias úteis (ver presetBeneficiosVAVT), não aqui.
  if (tipo === "ferias") return [
    { tipo: "P", descricao: "Férias", valor: s },
    { tipo: "P", descricao: "1/3 constitucional", valor: s / 3 },
  ];
  if (tipo === "13") return preset13(parcela13, s);
  // Rescisão: não há preset fixo — as verbas são calculadas pelo botão "Calcular rescisão"
  // a partir das datas/motivo/aviso prévio informados no holerite.
  if (tipo === "rescisao") return [];
  return [];
}
let holeriteAtual = null; // último holerite carregado (para salvar/pagar)
let empresaAtual = null;  // dados do empregador (empresa logada), p/ cabeçalho do holerite

// ===== Montagem do painel (lazy, só na 1ª ativação) =====
function montarPainel() {
  if (document.getElementById("rh-panel")) return;
  const main = document.getElementById("conteudo");
  if (!main) return;

  const anoAtual = hoje.getFullYear();
  const anos = [];
  for (let a = anoAtual + 1; a >= anoAtual - 5; a--) anos.push(a);

  const panel = document.createElement("div");
  panel.id = "rh-panel";
  panel.innerHTML = `
    <div class="rh-header">
      <h2>RH — Holerite Virtual</h2>
      <div class="rh-controls">
        <span class="material-symbols-outlined">search</span>
        <div class="rh-busca-func">
          <input type="text" id="rh-busca-func" placeholder="Buscar funcionário..." autocomplete="off">
          <input type="hidden" id="rh-func-id" value="">
          <ul id="rh-func-lista" class="rh-func-lista" style="display:none;"></ul>
        </div>
        <select id="rh-select-tipo">
          ${TIPOS_HOLERITE.map((t) => `<option value="${t.v}" ${t.v === tipoSel ? "selected" : ""}>${t.label}</option>`).join("")}
        </select>
        <select id="rh-select-mes">
          ${MESES.map((m, i) => `<option value="${i + 1}" ${i + 1 === mesSel ? "selected" : ""}>${m}</option>`).join("")}
        </select>
        <select id="rh-select-ano">
          ${anos.map((a) => `<option value="${a}" ${a === anoSel ? "selected" : ""}>${a}</option>`).join("")}
        </select>
        <button type="button" id="rh-aliquotas" class="secundario" title="Editar alíquotas (INSS/IRRF/FGTS)">⚙️ Alíquotas</button>
      </div>
    </div>
    <div id="rh-resumo" class="rh-resumo" style="display:none;"></div>
    <div id="rh-folha" class="rh-folha"></div>
    <div id="rh-detalhe" style="display:none;">
      <button type="button" id="rh-voltar" class="secundario rh-voltar">← Voltar para a lista</button>
      <h3 id="rh-titulo" class="rh-titulo"></h3>
      <div id="rh-holerite" class="rh-holerite"></div>
    </div>
    <p class="rh-nota">Salário base vem do cadastro do funcionário. Benefícios, bônus e descontos (INSS, IRRF, etc.) são lançados como itens da competência.</p>
  `;
  main.appendChild(panel);

  document.getElementById("rh-select-tipo").addEventListener("change", (e) => { tipoSel = e.target.value; aoMudarCompetencia(); });
  document.getElementById("rh-select-mes").addEventListener("change", (e) => { mesSel = parseInt(e.target.value, 10); aoMudarCompetencia(); });
  document.getElementById("rh-select-ano").addEventListener("change", (e) => { anoSel = parseInt(e.target.value, 10); aoMudarCompetencia(); });
  // Abre a tela de edição das alíquotas (módulo carregado sob demanda).
  document.getElementById("rh-aliquotas").addEventListener("click", async () => {
    try {
      const mod = await import("./Aliquotas.js");
      mod.abrirAliquotas();
    } catch (err) {
      console.error("Erro ao abrir tela de alíquotas:", err);
    }
  });

  document.getElementById("rh-voltar").addEventListener("click", mostrarLista);

  carregarFuncionarios();
  carregarFolha();
  carregarEmpresa();
}

// Alterna entre a lista (visão geral) e o holerite de um funcionário.
function mostrarHolerite() {
  document.getElementById("rh-resumo").style.display = "none";
  document.getElementById("rh-folha").style.display = "none";
  document.getElementById("rh-detalhe").style.display = "block";
}
function mostrarLista() {
  document.getElementById("rh-detalhe").style.display = "none";
  // Limpa a seleção atual.
  const hidden = document.getElementById("rh-func-id"); if (hidden) hidden.value = "";
  const input = document.getElementById("rh-busca-func"); if (input) input.value = "";
  document.getElementById("rh-folha").style.display = "";
  carregarFolha(); // recarrega para refletir holerites recém-salvos/pagos
}
// True quando a visão de lista está ativa (detalhe escondido).
function emModoLista() {
  const d = document.getElementById("rh-detalhe");
  return !d || d.style.display === "none";
}

// Carrega os dados do empregador (empresa em que o usuário está logado) uma única vez.
async function carregarEmpresa() {
  try {
    empresaAtual = await fetchComToken("/rh/empresas");
  } catch (err) {
    console.error("Erro ao carregar empresa (RH):", err);
    empresaAtual = null;
  }
}

function aoMudarCompetencia() {
  // Na lista, recarrega a folha do mês. No holerite, recarrega o do funcionário aberto.
  const id = funcSelecionado();
  if (!emModoLista() && id) carregarHolerite(id);
  else carregarFolha();
}

function funcSelecionado() {
  const hidden = document.getElementById("rh-func-id");
  return hidden ? hidden.value : "";
}

// Busca de funcionário estilo aside: input de texto + lista suspensa filtrada ao vivo.
async function carregarFuncionarios() {
  const input = document.getElementById("rh-busca-func");
  const lista = document.getElementById("rh-func-lista");
  if (!input || !lista) return;
  try {
    const funcs = await fetchComToken("/rh/funcionarios");

    // Renderiza todos os funcionários como itens da lista.
    lista.innerHTML = "";
    (funcs || []).forEach((f) => {
      const li = document.createElement("li");
      li.dataset.id = f.idfuncionario;
      li.dataset.nome = f.nome || "";
      li.textContent = f.nome || "";
      li.addEventListener("mousedown", (e) => {
        e.preventDefault(); // antes do blur, p/ registrar o clique
        input.value = f.nome || "";
        document.getElementById("rh-func-id").value = f.idfuncionario;
        lista.style.display = "none";
        onFuncChange(String(f.idfuncionario));
      });
      lista.appendChild(li);
    });

    const filtrar = () => {
      const termo = input.value.toLowerCase().trim();
      // Digitou algo diferente do selecionado => invalida a seleção atual.
      document.getElementById("rh-func-id").value = "";
      lista.querySelectorAll("li").forEach((li) => {
        li.style.display = li.dataset.nome.toLowerCase().includes(termo) ? "block" : "none";
      });
      lista.style.display = "block";
    };
    input.addEventListener("input", filtrar);
    input.addEventListener("focus", () => { lista.style.display = "block"; });

    // Esconde ao clicar fora.
    document.addEventListener("mousedown", (e) => {
      if (e.target !== input && !lista.contains(e.target)) lista.style.display = "none";
    });
  } catch (err) {
    console.error("Erro ao carregar funcionários (RH):", err);
    input.placeholder = "Erro ao carregar funcionários";
  }
}

function onFuncChange(id) {
  if (id) {
    mostrarHolerite();
    carregarHolerite(id);
  } else {
    mostrarLista();
  }
}

// ===== Holerite de um funcionário/competência =====
async function carregarHolerite(idfuncionario) {
  const cont = document.getElementById("rh-holerite");
  cont.innerHTML = '<p class="rh-vazio">Carregando holerite...</p>';
  try {
    const data = await fetchComToken(`/rh/holerite?idfuncionario=${idfuncionario}&mes=${mesSel}&ano=${anoSel}&tipo=${tipoSel}`);
    holeriteAtual = data.holerite;
    // Dias úteis da competência (do backend) para o cálculo de VA/VT.
    diasUteisSel = Number(holeriteAtual.diasUteis) || 0;
    // Holerite já salvo: recupera os dias úteis EFETIVAMENTE usados a partir do VA/VT salvo
    // (VA = valealimDia × dias), preservando uma edição manual de dias úteis. Sem isso, o
    // campo voltaria sempre ao cálculo automático ao recarregar após salvar.
    if (holeriteAtual.idholerite) {
      const diaVA = Number(holeriteAtual.valealimDia) || 0;
      const diaVT = Number(holeriteAtual.valetrnspDia) || 0;
      const itens = holeriteAtual.itens || [];
      const itVA = itens.find((i) => i.tipo === "B" && String(i.descricao).toUpperCase().includes("ALIMENTA"));
      const itVT = itens.find((i) => i.tipo === "B" && String(i.descricao).toUpperCase().includes("TRANSPORTE"));
      if (diaVA > 0 && itVA) diasUteisSel = Math.round(Number(itVA.valor) / diaVA);
      else if (diaVT > 0 && itVT) diasUteisSel = Math.round(Number(itVT.valor) / diaVT);
    }
    // Rascunho sem itens: mensal monta VA/VT por dias úteis; demais tipos usam preset.
    if (!holeriteAtual.idholerite && (holeriteAtual.itens || []).length === 0) {
      if (tipoSel === "mensal") {
        holeriteAtual.itens = presetBeneficiosVAVT(
          holeriteAtual.valealimDia, holeriteAtual.valetrnspDia, diasUteisSel);
      } else {
        const preset = presetItens(tipoSel, holeriteAtual.salariobase);
        if (preset.length) holeriteAtual.itens = preset;
      }
    }
    // Plano de saúde é desconto RECORRENTE: garante a linha em todo rascunho mensal de
    // quem aderiu (holerite ainda não salvo). Holerites já salvos mantêm o valor gravado.
    aplicarDescontoPlanoSaude();
    renderHolerite(holeriteAtual);
    // Holerite já salvo: já traz as bases (FGTS/INSS/IRRF) preenchidas, pois já foram calculadas.
    if (holeriteAtual.idholerite) atualizarBasesCalculadas();
  } catch (err) {
    console.error("Erro ao carregar holerite (RH):", err);
    cont.innerHTML = '<p class="rh-vazio">Erro ao carregar o holerite.</p>';
  }
}

// Itens: 'P' provento tributável, 'B' benefício não-tributável (VA/VT), 'D' desconto.
// Por padrão os benefícios NÃO entram no líquido (pagos via cartão/vale); o RH pode
// somá-los ligando o toggle (incluirBeneficios = true).
// No 13º (h.tipo === "13"), "salariobase" é só a referência do cadastro (mostrada/editável na
// tela, inclusive salva de volta no cadastro do funcionário via salvarSalarioBase) — o valor
// da parcela já vem inteiro nos itens (preset13). Somar a referência ao total duplicaria o
// valor pago, por isso ela entra só como "base" (exibição), não somada em proventos.
function totaisHolerite(h, incluirBeneficios) {
  const base = Number(h.salariobase) || 0;
  let proventosItens = 0, beneficios = 0, descontos = 0;
  (h.itens || []).forEach((i) => {
    const v = Number(i.valor) || 0;
    if (i.tipo === "D") descontos += v;
    else if (i.tipo === "B") beneficios += v;
    else proventosItens += v;
  });
  const proventos = (h.tipo === "13" ? 0 : base) + proventosItens; // salário + proventos tributáveis
  const liquido = proventos - descontos + (incluirBeneficios ? beneficios : 0);
  return { base, beneficios, proventos, descontos, liquido };
}

function renderHolerite(h) {
  const cont = document.getElementById("rh-holerite");
  const rotuloTipo = (TIPOS_HOLERITE.find((t) => t.v === (h.tipo || "mensal")) || {}).label || "Mensal";
  document.getElementById("rh-titulo").textContent =
    `${h.nome} — ${MESES[h.mes - 1]}/${h.ano} · ${rotuloTipo}`;

  const t = totaisHolerite(h, incluirBeneficios);
  const proventos = (h.itens || []).filter((i) => i.tipo === "P");
  const beneficios = (h.itens || []).filter((i) => i.tipo === "B");
  const descontos = (h.itens || []).filter((i) => i.tipo === "D");
  const pago = h.status === "Pago";
  // Só master/dev pode trocar um comprovante já anexado ou removê-lo. O primeiro
  // anexo é liberado para o usuário de RH.
  const podeAlterarComprovante =
    (window.temPermissao?.("Staff", "master") ?? false) ||
    (window.temPermissao?.("Staff", "devs") ?? false);

  const linha = (i, idx) => `
    <div class="rh-item" data-idx="${idx}">
      <input type="text" class="rh-item-desc" value="${(i.descricao || "").replace(/"/g, "&quot;")}" placeholder="Descrição">
      <input type="text" class="rh-item-valor" oninput="formatReais(this)" value="${formatarReaisInput(i.valor)}">
      <button type="button" class="rh-item-rm" title="Remover">✕</button>
    </div>`;

  cont.innerHTML = `
<div class="rh-card">
    <div class="rh-card-topo">
        <div class="rh-infos">
            <div class="empregador">
                <h1>Empregador</h1>
                <span>Nome: ${empresaAtual?.razaosocial || empresaAtual?.nmfantasia || "—"}</span>
                <span>CNPJ: ${empresaAtual?.cnpj || "—"}</span>
                <span>Endereco:
                        ${empresaAtual?.endereco || ""} —
                        ${empresaAtual?.numero || ""} —
                        ${empresaAtual?.complemento || ""} —
                        ${empresaAtual?.cep || ""} —
                        ${empresaAtual?.cidade || ""} —
                        ${empresaAtual?.estado || ""}
                </span>
            </div>
            <div class="registro">
                <h1>Demonstrativo de Pagamento </h1>
                <span>${mesSel}/${anoSel}</span>
                <br>
                <span class="rh-badge badge-${pago ? "pago" : "pendente"}">${pago ? "✅ Pago" : "⏳ Pendente"}</span>
            </div>
        </div>
                ${h.dtpagamento ? `<small>Pago em ${new Date(h.dtpagamento).toLocaleDateString("pt-BR")}</small>` : ""}
    </div>

    <div class="rh-sub">
        <div class="rh-sub-infos">
            <table>
                <thead>
                    <tr class="header-func">
                        <th><h5>Codigo</h5></th>
                        <th><h5>Nome do Funcionário</h5></th>
                        <th><h5>Funcão</h5></th>
                        <th><h5>CBO</h5></th>
                        <th><h5>Admissão</h5></th>
                    </tr>
                </thead>
                <tbody>
                    <tr class="body-func">
                        <td><span>${h.idfuncionario}</span></td>
                        <td><span>${h.nome}</span></td>
                        <td><span>${h.funcao}</span></td>
                        <td><span>${h.cbo}</span></td>
                        <td><span>${formatData(h.admissao)}</span></td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>


      <div class="rh-bloco rh-cadastro">
        <div>
          <label>Salário bruto</label>
          <input type="text" id="rh-salariobase" oninput="formatReais(this)" value="${formatarReaisInput(h.salariobase)}">
        </div>
        <div>
          <label>Dependentes</label>
          <input type="number" step="1" min="0" id="rh-dependentes" value="${Number(h.dependentes) || 0}">
        </div>
        <button type="button" id="rh-salvar-base" class="secundario">Salvar no cadastro</button>
      </div>

      ${h.tipo === "13" ? `
      <div class="rh-bloco rh-13">
        <label>Pagamento do 13º</label>
        <select id="rh-13-parcela">
          <option value="unica" ${parcela13 === "unica" ? "selected" : ""}>Parcela única</option>
          <option value="1" ${parcela13 === "1" ? "selected" : ""}>1ª parcela (50%, sem descontos)</option>
          <option value="2" ${parcela13 === "2" ? "selected" : ""}>2ª parcela (com INSS/IRRF sobre o 13º cheio)</option>
        </select>
      </div>` : ""}

      ${h.tipo === "rescisao" ? `
      <div class="rh-bloco rh-rescisao">
        <h4>Dados da rescisão</h4>
        <div class="rh-rescisao-campos">
          <div>
            <label>Admissão</label>
            <input type="date" id="rh-resc-admissao" value="${(h.admissao || "").toString().slice(0, 10)}">
          </div>
          <div>
            <label>Desligamento</label>
            <input type="date" id="rh-resc-desligamento" value="${rescisaoInput.desligamento || ""}">
          </div>
          <div>
            <label>Motivo</label>
            <select id="rh-resc-motivo">
              ${MOTIVOS_RESCISAO.map((m) => `<option value="${m.v}" ${m.v === rescisaoInput.motivo ? "selected" : ""}>${m.label}</option>`).join("")}
            </select>
          </div>
          <div>
            <label>Aviso prévio</label>
            <select id="rh-resc-aviso">
              ${AVISOS_PREVIO.map((a) => `<option value="${a.v}" ${a.v === rescisaoInput.avisoPrevio ? "selected" : ""}>${a.label}</option>`).join("")}
            </select>
          </div>
          <div>
            <label>Férias vencidas (períodos)</label>
            <input type="number" step="1" min="0" id="rh-resc-ferias" value="${Number(rescisaoInput.feriasVencidas) || 0}">
          </div>
          <div>
            <label>Saldo FGTS (p/ multa)</label>
            <input type="text" id="rh-resc-fgts" oninput="formatReais(this)" value="${formatarReaisInput(rescisaoInput.saldoFgts)}">
          </div>
        </div>
        <button type="button" id="rh-calc-rescisao" class="secundario">⚙️ Calcular rescisão</button>
        <small class="rh-calc-info">Aviso indenizado e férias (vencidas/proporcionais) + 1/3 são isentos de INSS/IRRF; o 13º é tributado em base separada. Confira e ajuste se precisar.</small>
      </div>` : ""}

      <div class="rh-bloco">
        <h4>Proventos</h4>
        <div id="rh-proventos">${proventos.map((i, idx) => linha(i, idx)).join("")}</div>
        <button type="button" id="rh-add-provento">+ Provento (bônus, hora extra…)</button>
      </div>

      <div class="rh-bloco">
        <h4>Benefícios (não-tributáveis)</h4>
        ${h.tipo === "mensal" ? `
        <div class="rh-dias-uteis">
          <label>Dias úteis</label>
          <input type="number" step="1" min="0" id="rh-dias-uteis" value="${diasUteisSel}">
          <small>VA/VT = valor por dia (cadastro) × dias úteis. Ajuste p/ faltas ou admissão no meio do mês.</small>
        </div>` : ""}
        <div id="rh-beneficios">${beneficios.map((i, idx) => linha(i, idx)).join("")}</div>
        <button type="button" id="rh-add-beneficio">+ Benefício (VA, VT…)</button>
        <small class="rh-calc-info">VA e VT não entram em INSS/IRRF/FGTS. Por padrão não somam no líquido (pagos via cartão/vale).</small>
      </div>

      <div class="rh-bloco">
        <h4>Descontos</h4>
        <div id="rh-descontos">${descontos.map((i, idx) => linha(i, idx)).join("")}</div>
        <button type="button" id="rh-add-desconto">+ Desconto</button>
        ${(h.tipo === "rescisao" || h.tipo === "13") ? "" : `<button type="button" id="rh-calcular" class="secundario">⚙️ Calcular INSS/IRRF</button>`}
        <small id="rh-calc-info" class="rh-calc-info"></small>
        ${descontos.some((i) => String(i.descricao) === PLANO_SAUDE_DESC) && h.planoSaude && h.planoSaude.itens && h.planoSaude.itens.length ? `
        <div class="rh-plano-detalhe">
          <strong>Plano de Saúde — cobrança por faixa etária</strong>
          <ul>
            ${h.planoSaude.itens.map((p) => `<li>${p.nome} — ${p.idade} anos: <strong>${formatarReaisInput(p.valor)}</strong>${
              p.titular
                ? ` <em>(faixa ${formatarReaisInput(p.valorFaixa)}; empresa paga ${Math.round((h.planoSaude.empresaPctTitular || 0) * 100)}% = ${formatarReaisInput(p.parteEmpresa)})</em>`
                : ""
            }</li>`).join("")}
          </ul>
          <div class="rh-plano-total">Total descontado do funcionário: <strong>${formatarReaisInput(h.planoSaude.total)}</strong></div>
        </div>` : ""}
      </div>

      <div class="rh-totais">
        <div><span>Proventos</span><strong class="pos" data-tot="proventos">${formatarReaisInput(t.proventos)}</strong></div>
        <div><span>Benefícios</span><strong class="ben" data-tot="beneficios">${formatarReaisInput(t.beneficios)}</strong></div>
        <div><span>Descontos</span><strong class="neg" data-tot="descontos">${formatarReaisInput(t.descontos)}</strong></div>
        <div><span>Líquido a receber</span><strong data-tot="liquido">${formatarReaisInput(t.liquido)}</strong></div>
      </div>

      <label class="rh-incluir-benef">
        <input type="checkbox" id="rh-incluir-beneficios" ${incluirBeneficios ? "checked" : ""}>
        Somar benefícios (VA/VT) no líquido a receber
      </label>

      <div class="rh-bases">
        <div><span>Sal. Cont. INSS</span><strong data-base="salContrInss">—</strong></div>
        <div><span>Base Cálculo FGTS</span><strong data-base="baseFgts">—</strong></div>
        <div><span>FGTS do Mês</span><strong data-base="fgtsMes">—</strong></div>
        <div><span>Base IRRF c/ Ded. Simpl.</span><strong data-base="baseIrrfSimpl">—</strong></div>
        <div><span>Faixa IRRF</span><strong data-base="faixaIrrf">—</strong></div>
      </div>

      <div class="rh-acoes">
        <button type="button" id="rh-salvar">Salvar holerite</button>
        <button type="button" id="rh-pagar" class="${pago ? "secundario" : ""}">${pago ? "Reverter p/ Pendente" : "Marcar como pago"}</button>
        ${pago ? (!h.comprovante ? `
        <button type="button" id="rh-comprovante">
            <svg aria-hidden="true" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" >
            <path stroke-width="2" stroke="#fffffff" d="M13.5 3H12H8C6.34315 3 5 4.34315 5 6V18C5 19.6569 6.34315 21 8 21H11M13.5 3L19 8.625M13.5 3V7.625C13.5 8.17728 13.9477 8.625 14.5 8.625H19M19 8.625V11.8125" stroke-linejoin="round" stroke-linecap="round"></path>
            <path stroke-linejoin="round" stroke-linecap="round" stroke-width="2" stroke="#fffffff" d="M17 15V18M17 21V18M17 18H14M17 18H20"></path></svg>
            ADD Comprovante
        </button>
        <input type="file" id="rh-comprovante-input" accept="image/*,application/pdf,.jfif" style="display:none">` : `
        <button type="button" id="rh-comprovante-ver">Ver comprovante</button>
        ${podeAlterarComprovante ? `<button type="button" id="rh-comprovante-rm" class="secundario">Remover comprovante</button>` : ""}`) : ""}
        ${pago && h.comprovante ? `<button type="button" id="rh-imprimir" class="secundario">🖨️ Imprimir (2 vias)</button>` : ""}
      </div>
    </div>
  `;

  // ---- binds ----
  cont.querySelectorAll(".rh-item-rm").forEach((b) =>
    b.addEventListener("click", (e) => { e.target.closest(".rh-item").remove(); recalcular(); }));
  // Delegação: recalcula a cada digitação em QUALQUER campo de item (descrição ou valor),
  // incluindo linhas adicionadas depois, além do salário base.
  ["rh-proventos", "rh-beneficios", "rh-descontos"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", recalcular);
  });
  document.getElementById("rh-salariobase").addEventListener("input", recalcular);
  const chkBenef = document.getElementById("rh-incluir-beneficios");
  if (chkBenef) chkBenef.addEventListener("change", (e) => { incluirBeneficios = e.target.checked; recalcular(); });
  const inpDias = document.getElementById("rh-dias-uteis");
  if (inpDias) inpDias.addEventListener("input", (e) => aplicarDiasUteis(parseInt(e.target.value, 10) || 0));

  const sel13 = document.getElementById("rh-13-parcela");
  if (sel13) sel13.addEventListener("change", (e) => {
    parcela13 = e.target.value;
    // Reaplica o preset da parcela escolhida (substitui os itens) e re-renderiza.
    holeriteAtual.itens = preset13(parcela13, holeriteAtual.salariobase);
    renderHolerite(holeriteAtual);
  });

  document.getElementById("rh-add-provento").addEventListener("click", () => addLinha("rh-proventos"));
  document.getElementById("rh-add-beneficio").addEventListener("click", () => addLinha("rh-beneficios"));
  document.getElementById("rh-add-desconto").addEventListener("click", () => addLinha("rh-descontos"));
  const btnCalc = document.getElementById("rh-calcular");
  if (btnCalc) btnCalc.addEventListener("click", calcularEncargos);
  const btnResc = document.getElementById("rh-calc-rescisao");
  if (btnResc) btnResc.addEventListener("click", calcularRescisao);
  document.getElementById("rh-salvar-base").addEventListener("click", salvarSalarioBase);
  document.getElementById("rh-salvar").addEventListener("click", () => salvarHolerite());
  document.getElementById("rh-pagar").addEventListener("click", () => alternarPagamento(!pago));

  // Comprovante de pagamento (imagem/PDF/JFIF): clique abre o seletor de arquivo.
  const btnComp = document.getElementById("rh-comprovante");
  const inpComp = document.getElementById("rh-comprovante-input");
  if (btnComp && inpComp) {
    btnComp.addEventListener("click", () => inpComp.click());
    inpComp.addEventListener("change", (e) => {
      const arq = e.target.files && e.target.files[0];
      if (arq) enviarComprovante(arq);
      e.target.value = ""; // permite reenviar o mesmo arquivo depois
    });
  }
  const btnCompVer = document.getElementById("rh-comprovante-ver");
  if (btnCompVer) btnCompVer.addEventListener("click", () => {
    if (holeriteAtual.comprovante)
      window.open(`/uploads/rh/comprovantes/${holeriteAtual.comprovante}`, "_blank", "noopener");
  });
  const btnCompRm = document.getElementById("rh-comprovante-rm");
  if (btnCompRm) btnCompRm.addEventListener("click", removerComprovante);
  const btnImprimir = document.getElementById("rh-imprimir");
  if (btnImprimir) btnImprimir.addEventListener("click", imprimirHolerite);
}

// Rótulo do tipo de holerite para o cabeçalho do documento impresso.
const TIPO_LABEL = { mensal: "Mensal", ferias: "Férias", "13": "13º Salário", rescisao: "Rescisão" };

// Monta o HTML de UMA via do holerite (read-only) no formato clássico de recibo de
// pagamento: tabela única com colunas Vencimentos × Descontos, rodapé com bases e
// líquido, e linha de assinatura de ciência do funcionário.
function montarViaImpressao(h, t, titulo) {
  const esc = (s) => String(s || "").replace(/</g, "&lt;");
  const proventos = (h.itens || []).filter((i) => i.tipo === "P");
  const beneficios = (h.itens || []).filter((i) => i.tipo === "B");
  const descontos = (h.itens || []).filter((i) => i.tipo === "D");

  // Cada linha ocupa a coluna Vencimentos OU Descontos.
  let cod = 0;
  const linha = (desc, ref, venc, desc2) => `
    <tr>
      <td class="c">${String(++cod).padStart(3, "0")}</td>
      <td class="d">${esc(desc)}</td>
      <td class="r">${ref || ""}</td>
      <td class="v">${venc != null ? formatarReaisInput(venc) : ""}</td>
      <td class="v">${desc2 != null ? formatarReaisInput(desc2) : ""}</td>
    </tr>`;

  // No 13º o valor da parcela já vem inteiro nos itens (ex.: "13º salário (1ª parcela)") — a
  // linha "Salário base" aqui é só a referência do cadastro, não soma no total (ver
  // totaisHolerite), então não entra no recibo pra não sugerir uma soma que não existe.
  const linhasVenc = (h.tipo === "13" ? [] : [linha("Salário base", "30 dias", h.salariobase, null)])
    .concat(proventos.map((i) => linha(i.descricao, "", i.valor, null)));
  const linhasDesc = descontos.map((i) => linha(i.descricao, "", null, i.valor));

  // Benefícios (VA/VT) não integram o líquido — vão numa nota informativa.
  const benefInfo = beneficios.length
    ? `<div class="benef"><strong>Benefícios (não integram o líquido)</strong>: ${
        beneficios.map((i) => `${esc(i.descricao)} ${formatarReaisInput(i.valor)}`).join(" · ")}</div>`
    : "";

  // Detalhe do plano de saúde só quando há a linha de desconto correspondente.
  const temPlano = descontos.some((i) => String(i.descricao) === PLANO_SAUDE_DESC);
  const planoDet = (temPlano && h.planoSaude && h.planoSaude.itens && h.planoSaude.itens.length)
    ? `<div class="benef"><strong>Plano de Saúde (faixa etária)</strong>: ${
        h.planoSaude.itens.map((p) => `${esc(p.nome)} ${p.idade}a ${formatarReaisInput(p.valor)}${
          p.titular ? ` (empresa ${formatarReaisInput(p.parteEmpresa)})` : ""}`).join(" · ")}</div>`
    : "";

  return `
  <section class="via">
    <div class="via-tag">${titulo}</div>
    <table class="cab">
      <tr>
        <td class="emp">
          <strong>${esc(empresaAtual?.razaosocial || empresaAtual?.nmfantasia || "—")}</strong><br>
          CNPJ: ${esc(empresaAtual?.cnpj || "—")}<br>
          ${esc(empresaAtual?.endereco || "")} ${esc(empresaAtual?.numero || "")} — ${esc(empresaAtual?.cidade || "")}/${esc(empresaAtual?.estado || "")}
        </td>
        <td class="doc">
          <div class="doc-titulo">Recibo de Pagamento de Salário</div>
          <div>Competência: <strong>${String(mesSel).padStart(2, "0")}/${anoSel}</strong></div>
          <div>Tipo: ${TIPO_LABEL[h.tipo] || "Mensal"}</div>
        </td>
      </tr>
    </table>

    <table class="func">
      <colgroup>
        <col class="col-cod"><col><col><col class="col-cbo"><col class="col-adm">
      </colgroup>
      <tr><th>Código</th><th>Nome do Funcionário</th><th>Função</th><th>CBO</th><th>Admissão</th></tr>
      <tr><td>${esc(h.idfuncionario)}</td><td>${esc(h.nome)}</td><td>${esc(h.funcao || "—")}</td><td>${esc(h.cbo || "—")}</td><td>${formatData(h.admissao)}</td></tr>
    </table>

    <hr class="rh-separador">

    <table class="itens">
      <thead>
        <tr><th class="c">Cód.</th><th class="d">Descrição</th><th class="r">Ref.</th><th class="v">Vencimentos</th><th class="v">Descontos</th></tr>
      </thead>
      <tbody>
        ${linhasVenc.join("")}
        ${linhasDesc.join("")}
      </tbody>
      <tfoot>
        <tr class="tot">
          <td colspan="3">Totais</td>
          <td class="v">${formatarReaisInput(t.proventos)}</td>
          <td class="v">${formatarReaisInput(t.descontos)}</td>
        </tr>
      </tfoot>
    </table>

    ${benefInfo}
    ${planoDet}

    <table class="bases">
      <tr>
        <td><span>Salário base</span><strong>${formatarReaisInput(h.salariobase)}</strong></td>
        <td><span>Base de cálculo</span><strong>${formatarReaisInput(t.proventos)}</strong></td>
        <td><span>Total de descontos</span><strong>${formatarReaisInput(t.descontos)}</strong></td>
        <td class="liq"><span>Líquido a receber</span><strong>${formatarReaisInput(t.liquido)}</strong></td>
      </tr>
    </table>

    <div class="assinatura">
      <div class="linha"></div>
      <div>Assinatura do funcionário — ${esc(h.nome)}<br><small>Declaro estar ciente dos valores e descontos acima.</small></div>
    </div>
  </section>`;
}

// Imprime 2 vias (Funcionário e Empresa) do holerite pago, cada uma com assinatura, seguidas
// do comprovante anexado (mesmo comportamento de imprimirHoleriteExterno) — o botão só existe
// quando já há comprovante (ver renderHolerite), então ele SEMPRE entra na impressão.
async function imprimirHolerite() {
  const h = lerHolerite();
  const t = totaisHolerite(h, incluirBeneficios);
  const win = window.open("", "_blank");
  if (!win) return Swal.fire("Bloqueado", "Permita pop-ups para imprimir.", "warning");

  const css = `
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; font-family: Arial, Helvetica, sans-serif; }
    body { margin: 0; color: #111; }
    /* As 2 vias cabem na MESMA página (cada uma usa ~metade da folha). */
    .via { padding: 6px 4px; break-inside: avoid; page-break-inside: avoid; }
    .via-tag { text-align: right; font-size: 11px; font-weight: bold; color: #666; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 4px; }
    .corte { border-top: 1px dashed #999; text-align: center; font-size: 10px; color: #999; margin: 10px 0; padding-top: 2px; letter-spacing: 1px; }

    table { border-collapse: collapse; width: 100%; }
    table.cab { border: 1px solid #333; }
    table.cab td { padding: 8px 10px; vertical-align: top; font-size: 12px; }
    table.cab .emp { width: 62%; border-right: 1px solid #333; line-height: 1.5; }
    table.cab .doc { font-size: 12px; line-height: 1.6; }
    table.cab .doc-titulo { font-size: 13px; font-weight: bold; text-transform: uppercase; margin-bottom: 4px; }

    table.func { border: 1px solid #333; border-top: none; font-size: 12px; table-layout: fixed; }
    table.func th, table.func td { border-right: 1px solid #ccc; padding: 5px 8px; text-align: left; vertical-align: middle; overflow: hidden; text-overflow: ellipsis; }
    table.func th { background: #efefef; font-size: 10px; text-transform: uppercase; letter-spacing: .5px; color: #444; }
    table.func th:last-child, table.func td:last-child { border-right: none; }
    table.func .col-cod { width: 9%; }
    table.func .col-cbo { width: 12%; }
    table.func .col-adm { width: 13%; }
    hr.rh-separador { border: none; border-top: 1px solid #333; margin: 8px 0; }

    table.itens { border: 1px solid #333; border-top: none; font-size: 12px; }
    table.itens th { background: #efefef; font-size: 10px; text-transform: uppercase; letter-spacing: .5px; color: #444; padding: 5px 8px; border-right: 1px solid #ccc; text-align: left; }
    table.itens td { padding: 4px 8px; border-right: 1px solid #eee; }
    table.itens th.v, table.itens td.v { text-align: right; white-space: nowrap; }
    table.itens th:last-child, table.itens td:last-child { border-right: none; }
    table.itens td.c { color: #888; width: 42px; }
    table.itens td.r { color: #666; width: 70px; }
    table.itens tbody tr:nth-child(even) { background: #fafafa; }
    table.itens tfoot .tot td { border-top: 2px solid #333; font-weight: bold; padding: 6px 8px; text-transform: uppercase; font-size: 11px; }

    .benef { font-size: 11px; color: #555; margin-top: 8px; }
    .benef strong { color: #333; }

    table.bases { margin-top: 12px; border: 1px solid #333; }
    table.bases td { padding: 8px 10px; border-right: 1px solid #ccc; text-align: center; }
    table.bases td:last-child { border-right: none; }
    table.bases span { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: .5px; color: #666; margin-bottom: 3px; }
    table.bases strong { font-size: 14px; }
    table.bases td.liq { background: #f2f2f2; }
    table.bases td.liq strong { font-size: 16px; }

    .assinatura { margin-top: 26px; font-size: 12px; }
    .assinatura .linha { border-top: 1px solid #333; width: 340px; margin: 0 auto 4px; }
    .assinatura > div:last-child { text-align: center; }
    .assinatura small { color: #666; }
    /* Sem height:100vh — em contexto de impressão isso pode passar da área útil da folha
       (@page já tem margem de 10mm) e sobrar uma página em branco extra. */
    .pagina-comprovante { page-break-before: always; text-align: center; }
    .pagina-comprovante img, .pagina-comprovante canvas { max-width: 100%; max-height: 260mm; }
  `;
  // Comprovante anexado, na mesma impressão (só existe o botão de imprimir quando já há
  // comprovante — ver renderHolerite).
  const paginaComprovante = h.comprovante
    ? `<div class="pagina-comprovante">${montarPaginaComprovante(`/uploads/rh/comprovantes/${h.comprovante}`)}</div>`
    : "";
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Holerite — ${h.nome} — ${mesSel}/${anoSel}</title><style>${css}</style></head>
  <body>${montarViaImpressao(h, t, "Via do Funcionário")}<div class="corte">✂ - - - - - - - - - - - - - - - - - - recorte aqui - - - - - - - - - - - - - - - - - -</div>${montarViaImpressao(h, t, "Via da Empresa")}${paginaComprovante}</body></html>`);
  win.document.close();
  win.focus();
  // Fecha a guia depois de imprimir OU cancelar (afterprint dispara nos dois casos).
  win.onafterprint = () => win.close();
  // Só imprime depois que o PDF de comprovante (se houver) já virou <canvas> — imprimir um
  // <iframe> de PDF sai cortado/espremido (ver renderizarPdfsEmComprovantes).
  await renderizarPdfsEmComprovantes(win);
  try { win.print(); } catch (e) {}
}

function addLinha(containerId) {
  const div = document.createElement("div");
  div.className = "rh-item";
  div.innerHTML = `
    <input type="text" class="rh-item-desc" placeholder="Descrição">
    <input type="text" class="rh-item-valor" oninput="formatReais(this)" value="${formatarReaisInput(0)}">
    <button type="button" class="rh-item-rm" title="Remover">✕</button>`;
  div.querySelector(".rh-item-rm").addEventListener("click", () => { div.remove(); recalcular(); });
  document.getElementById(containerId).appendChild(div);
  recalcular();
}

// Lê os campos atuais da tela e devolve o holerite normalizado.
function lerHolerite() {
  const salariobase = desformatarReais(document.getElementById("rh-salariobase").value);
  const ler = (containerId, tipo) =>
    Array.from(document.querySelectorAll(`#${containerId} .rh-item`)).map((el) => ({
      tipo,
      descricao: el.querySelector(".rh-item-desc").value.trim(),
      valor: desformatarReais(el.querySelector(".rh-item-valor").value),
    })).filter((i) => i.descricao);
  const itens = [...ler("rh-proventos", "P"), ...ler("rh-beneficios", "B"), ...ler("rh-descontos", "D")];
  return { ...holeriteAtual, salariobase, itens, tipo: tipoSel };
}

// Garante o desconto RECORRENTE de plano de saúde no rascunho mensal de quem aderiu.
// Só age em holerite ainda NÃO salvo (idholerite null) — os salvos preservam o valor
// gravado, igual VA/VT. Atualiza o valor se as faixas/idades mudarem e remove a linha
// se o total zerar (ex.: adesão desmarcada ou sem faixas cadastradas).
function aplicarDescontoPlanoSaude() {
  if (!holeriteAtual || tipoSel !== "mensal" || holeriteAtual.idholerite) return;
  const total = Number(holeriteAtual.planoSaude?.total) || 0;
  const itens = holeriteAtual.itens || (holeriteAtual.itens = []);
  const idx = itens.findIndex((i) => i.tipo === "D" && String(i.descricao) === PLANO_SAUDE_DESC);
  if (total > 0) {
    if (idx >= 0) itens[idx].valor = total;
    else itens.push({ tipo: "D", descricao: PLANO_SAUDE_DESC, valor: total });
  } else if (idx >= 0) {
    itens.splice(idx, 1);
  }
}

// Recalcula VA/VT (valor/dia × dias úteis) nos campos da seção Benefícios, sem
// re-renderizar (preserva o foco do input de dias úteis).
function aplicarDiasUteis(dias) {
  diasUteisSel = dias;
  const diaVA = Number(holeriteAtual?.valealimDia) || 0;
  const diaVT = Number(holeriteAtual?.valetrnspDia) || 0;
  const cont = document.getElementById("rh-beneficios");
  if (cont) {
    Array.from(cont.querySelectorAll(".rh-item")).forEach((el) => {
      const desc = el.querySelector(".rh-item-desc").value.trim().toUpperCase();
      const inp = el.querySelector(".rh-item-valor");
      if (desc.includes("ALIMENTA")) inp.value = formatarReaisInput(Math.round(diaVA * dias * 100) / 100);
      else if (desc.includes("TRANSPORTE")) inp.value = formatarReaisInput(Math.round(diaVT * dias * 100) / 100);
    });
  }
  recalcular();
}

function recalcular() {
  const h = lerHolerite();
  const t = totaisHolerite(h, incluirBeneficios);
  const set = (chave, valor) => {
    const el = document.querySelector(`.rh-totais [data-tot="${chave}"]`);
    if (el) el.textContent = formatarReaisInput(valor);
  };
  set("proventos", t.proventos);
  set("beneficios", t.beneficios);
  set("descontos", t.descontos);
  set("liquido", t.liquido);
}

async function salvarSalarioBase() {
  const salariobase = desformatarReais(document.getElementById("rh-salariobase").value);
  const dependentes = parseInt(document.getElementById("rh-dependentes").value, 10) || 0;
  try {
    await fetchComToken(`/rh/funcionario/${holeriteAtual.idfuncionario}/salario`, {
      method: "PUT", body: { salariobase, dependentes },
    });
    holeriteAtual.dependentes = dependentes;
    alert("Salário base e dependentes atualizados no cadastro do funcionário.");
  } catch (err) {
    console.error("Erro ao salvar salário base (RH):", err);
    alert("Erro ao salvar o cadastro.");
  }
}

// Insere ou atualiza uma linha de desconto pela descrição (evita duplicar INSS/IRRF).
function setDescontoPorDescricao(descricao, valor) {
  const cont = document.getElementById("rh-descontos");
  const existente = Array.from(cont.querySelectorAll(".rh-item"))
    .find((el) => el.querySelector(".rh-item-desc").value.trim().toUpperCase() === descricao.toUpperCase());
  if (existente) {
    existente.querySelector(".rh-item-valor").value = formatarReaisInput(valor);
    return;
  }
  const div = document.createElement("div");
  div.className = "rh-item";
  div.innerHTML = `
    <input type="text" class="rh-item-desc" value="${descricao}" placeholder="Descrição">
    <input type="text" class="rh-item-valor" oninput="formatReais(this)" value="${formatarReaisInput(valor)}">
    <button type="button" class="rh-item-rm" title="Remover">✕</button>`;
  div.querySelector(".rh-item-rm").addEventListener("click", () => { div.remove(); recalcular(); });
  cont.appendChild(div);
}

// Calcula INSS/IRRF no backend (não persiste) e preenche os descontos.
// Preenche o painel de bases informativas (INSS/FGTS/IRRF) a partir do retorno do cálculo.
function pintarBases(r) {
  const setBase = (chave, txt) => {
    const el = document.querySelector(`.rh-bases [data-base="${chave}"]`);
    if (el) el.textContent = txt;
  };
  setBase("salContrInss", formatarReaisInput(r.salContrInss));
  setBase("baseFgts", formatarReaisInput(r.baseFgts));
  setBase("fgtsMes", formatarReaisInput(r.fgtsMes));
  setBase("baseIrrfSimpl", formatarReaisInput(r.baseIrrfSimplificada));
  setBase("faixaIrrf", `${((Number(r.aliquotaIrrf) || 0) * 100).toLocaleString("pt-BR")}%`);
}

// Ao abrir um holerite já salvo, preenche as bases (FGTS/INSS/IRRF) SEM alterar os descontos
// já gravados — só para exibição, já que esses valores já foram calculados antes.
async function atualizarBasesCalculadas() {
  if (tipoSel === "rescisao") return; // rescisão tem painel próprio (calcularRescisao)
  const h = lerHolerite();
  if (!h.idfuncionario) return;
  try {
    const r = await fetchComToken("/rh/holerite/calcular", {
      method: "POST",
      body: { idfuncionario: h.idfuncionario, mes: h.mes, ano: h.ano, salariobase: h.salariobase, itens: h.itens },
    });
    pintarBases(r);
  } catch (err) {
    console.error("Erro ao atualizar bases calculadas (RH):", err);
  }
}

async function calcularEncargos() {
  const h = lerHolerite();
  const info = document.getElementById("rh-calc-info");
  try {
    const r = await fetchComToken("/rh/holerite/calcular", {
      method: "POST",
      body: { idfuncionario: h.idfuncionario, mes: h.mes, ano: h.ano, salariobase: h.salariobase, itens: h.itens },
    });
    setDescontoPorDescricao("INSS", r.inss);
    setDescontoPorDescricao("IRRF", r.irrf);
    recalcular();
    pintarBases(r);
    if (info) info.textContent =
      `Base: bruto ${formatarReaisInput(r.bruto)} · INSS ${formatarReaisInput(r.inss)} · base IRRF ${formatarReaisInput(r.baseIrrf)} · ${r.dependentes} dependente(s). Confira e ajuste se precisar.`;
  } catch (err) {
    console.error("Erro ao calcular encargos (RH):", err);
    alert("Erro ao calcular INSS/IRRF.");
  }
}

// Lê os campos do bloco de rescisão para o estado rescisaoInput.
function lerRescisaoInput() {
  rescisaoInput = {
    desligamento: document.getElementById("rh-resc-desligamento").value || "",
    motivo: document.getElementById("rh-resc-motivo").value,
    avisoPrevio: document.getElementById("rh-resc-aviso").value,
    feriasVencidas: parseInt(document.getElementById("rh-resc-ferias").value, 10) || 0,
    saldoFgts: desformatarReais(document.getElementById("rh-resc-fgts").value),
  };
  return {
    admissao: document.getElementById("rh-resc-admissao").value || null,
    ...rescisaoInput,
  };
}

// Calcula todas as verbas rescisórias no backend e substitui os itens do holerite.
async function calcularRescisao() {
  const dados = lerRescisaoInput();
  if (!dados.desligamento) { alert("Informe a data de desligamento."); return; }
  const h = lerHolerite();
  try {
    const r = await fetchComToken("/rh/rescisao/calcular", {
      method: "POST",
      body: {
        idfuncionario: h.idfuncionario, ano: h.ano, salariobase: h.salariobase,
        admissao: dados.admissao, desligamento: dados.desligamento, motivo: dados.motivo,
        avisoPrevio: dados.avisoPrevio, feriasVencidas: dados.feriasVencidas, saldoFgts: dados.saldoFgts,
      },
    });
    // Substitui os itens pelas verbas calculadas e re-renderiza.
    holeriteAtual.salariobase = h.salariobase;
    holeriteAtual.itens = [...(r.proventos || []), ...(r.descontos || [])];
    renderHolerite(holeriteAtual);

    // Preenche as bases informativas do rodapé.
    const setBase = (chave, txt) => {
      const el = document.querySelector(`.rh-bases [data-base="${chave}"]`);
      if (el) el.textContent = txt;
    };
    const res = r.resumo || {};
    setBase("salContrInss", formatarReaisInput(res.baseMensal));
    setBase("baseFgts", formatarReaisInput(res.baseFgts));
    setBase("fgtsMes", formatarReaisInput(res.fgtsMes));
    setBase("baseIrrfSimpl", formatarReaisInput(res.valor13)); // base do 13º (tributada à parte)
    setBase("faixaIrrf", `${res.anosServico || 0} ano(s) · aviso ${res.diasAviso || 0}d`);
    const info = document.querySelector(".rh-rescisao .rh-calc-info");
    if (info) info.textContent =
      `13º ${res.avos13 || 0}/12 · férias prop. ${res.avosFerias || 0}/12 · multa FGTS ${formatarReaisInput(res.multaFgts)}. Verbas indenizatórias isentas; 13º tributado à parte. Ajuste se precisar.`;
  } catch (err) {
    console.error("Erro ao calcular rescisão (RH):", err);
    alert("Erro ao calcular a rescisão: " + (err?.message || ""));
  }
}

// silencioso=true suprime o Swal de sucesso (usado quando o pagamento salva antes de pagar).
async function salvarHolerite(silencioso = false) {
  const h = lerHolerite();
  try {
    await fetchComToken("/rh/holerite", {
      method: "POST",
      body: {
        idfuncionario: h.idfuncionario, mes: h.mes, ano: h.ano, tipo: h.tipo,
        salariobase: h.salariobase, obs: h.obs || null, itens: h.itens,
      },
    });

    await carregarHolerite(h.idfuncionario); // recarrega (pega o idholerite e persistência)
    carregarFolha();
    if (!silencioso) {
      Swal.fire({
        icon: 'success',
        title: 'Salvo',
        text: 'Holerite salvo com sucesso.',
        timer: 1800,
        showConfirmButton: false,
      });
    }
  } catch (err) {
    Swal.fire({
          icon: 'error',
          title: 'Erro',
          text: 'Não foi possível Salvar o Holerite.',
          confirmButtonText: 'Ok'
      });
  }
}

async function alternarPagamento(pago) {
  // Garante que o holerite está persistido antes de marcar pagamento (sem Swal de "salvo").
  if (!holeriteAtual.idholerite) {
    await salvarHolerite(true);
    if (!holeriteAtual || !holeriteAtual.idholerite) return;
  }
  try {
    await fetchComToken(`/rh/holerite/${holeriteAtual.idholerite}/pagar`, {
      method: "PUT", body: { pago },
    });
    await carregarHolerite(holeriteAtual.idfuncionario);
    carregarFolha();
    Swal.fire({
      icon: 'success',
      title: pago ? 'Pago' : 'Revertido',
      text: pago ? 'Holerite marcado como pago.' : 'Holerite revertido para pendente.',
      timer: 1800,
      showConfirmButton: false,
    });
  } catch (err) {
    console.error("Erro ao alterar pagamento (RH):", err);
    Swal.fire({
      icon: 'error',
      title: 'Erro',
      text: 'Não foi possível alterar o status de pagamento.',
      confirmButtonText: 'Ok',
    });
  }
}

// Envia o comprovante de pagamento (imagem/PDF/JFIF) do holerite atual.
// Garante que o holerite esteja persistido antes (precisa do idholerite).
async function enviarComprovante(arquivo) {
  if (!holeriteAtual.idholerite) {
    await salvarHolerite(true);
    if (!holeriteAtual || !holeriteAtual.idholerite) return;
  }
  try {
    const fd = new FormData();
    fd.append("comprovante", arquivo);
    const r = await fetchComToken(`/rh/holerite/${holeriteAtual.idholerite}/comprovante`, {
      method: "POST",
      body: fd,
    });
    if (!r || !r.ok) throw new Error((r && r.error) || "Falha no envio.");
    await carregarHolerite(holeriteAtual.idfuncionario);
    Swal.fire({ icon: "success", title: "Comprovante anexado", timer: 1600, showConfirmButton: false });
  } catch (err) {
    console.error("Erro ao enviar comprovante (RH):", err);
    Swal.fire({ icon: "error", title: "Erro", text: "Não foi possível anexar o comprovante.", confirmButtonText: "Ok" });
  }
}

async function removerComprovante() {
  if (!holeriteAtual.idholerite) return;
  const conf = await Swal.fire({
    icon: "warning", title: "Remover comprovante?", showCancelButton: true,
    confirmButtonText: "Remover", cancelButtonText: "Cancelar",
  });
  if (!conf.isConfirmed) return;
  try {
    const r = await fetchComToken(`/rh/holerite/${holeriteAtual.idholerite}/comprovante`, { method: "DELETE" });
    if (!r || !r.ok) throw new Error((r && r.error) || "Falha ao remover.");
    await carregarHolerite(holeriteAtual.idfuncionario);
    Swal.fire({ icon: "success", title: "Comprovante removido", timer: 1600, showConfirmButton: false });
  } catch (err) {
    console.error("Erro ao remover comprovante (RH):", err);
    Swal.fire({ icon: "error", title: "Erro", text: "Não foi possível remover o comprovante.", confirmButtonText: "Ok" });
  }
}

// ===== Visão geral da folha do mês (todos os funcionários) =====
// Mostra, por funcionário, o que será pago/descontado no mês. Quem já tem holerite entra
// com valores reais; quem não tem entra como PREVISÃO (réplica do mês anterior recalculando
// VA/VT pelos dias úteis). Clicar numa linha abre o holerite daquele funcionário.
async function carregarFolha() {
  const elTab = document.getElementById("rh-folha");
  const elTot = document.getElementById("rh-resumo");
  if (!elTab) return;
  elTab.innerHTML = '<p class="rh-vazio">Carregando folha do mês...</p>';
  try {
    const data = await fetchComToken(`/rh/folha?mes=${mesSel}&ano=${anoSel}`);
    const linhas = data.linhas || [];
    const t = data.totais || { proventos: 0, descontos: 0, liquido: 0, pagos: 0, pendentes: 0, previsoes: 0, qtd: 0 };

    // Só exibe a lista/totais quando estamos no modo lista; no holerite isto roda em 2º
    // plano (ex.: após salvar/pagar) e não deve reaparecer por cima do holerite.
    if (!emModoLista()) return;

    if (elTot) {
      elTot.style.display = "grid";
      elTot.innerHTML = `
        <div class="rh-resumo-card"><span>Folha de ${MESES[mesSel - 1]}/${anoSel}</span><strong>${t.qtd} funcionário(s)</strong></div>
        <div class="rh-resumo-card"><span>Total proventos</span><strong>${formatarReaisInput(t.proventos)}</strong></div>
        <div class="rh-resumo-card"><span>Total descontos</span><strong>${formatarReaisInput(t.descontos)}</strong></div>
        <div class="rh-resumo-card"><span>Líquido da folha</span><strong>${formatarReaisInput(t.liquido)}</strong></div>
        <div class="rh-resumo-card"><span>Pagos / Pendentes / Previsão</span><strong>${t.pagos} / ${t.pendentes} / ${t.previsoes}</strong></div>
      `;
    }

    if (!linhas.length) {
      elTab.innerHTML = '<p class="rh-vazio">Nenhum funcionário de salário fixo nesta empresa.</p>';
      return;
    }

    const badge = (l) => {
      if (l.origem !== "real") return `<span class="rh-badge badge-previsao">Previsão</span>`;
      const cls = l.status === "Pago" ? "badge-pago" : "badge-pendente";
      return `<span class="rh-badge ${cls}">${l.status}</span>`;
    };

    elTab.innerHTML = `
      <table class="rh-folha-tab">
        <thead>
          <tr><th>Funcionário</th><th>Proventos</th><th>Descontos</th><th>Líquido</th><th>Status</th></tr>
        </thead>
        <tbody>
          ${linhas.map((l) => `
            <tr data-id="${l.idfuncionario}" data-nome="${(l.nome || "").replace(/"/g, "&quot;")}" title="Abrir holerite">
              <td>${l.nome || ""}</td>
              <td>${formatarReaisInput(l.proventos)}</td>
              <td>${formatarReaisInput(l.descontos)}</td>
              <td><strong>${formatarReaisInput(l.liquido)}</strong></td>
              <td>${badge(l)}</td>
            </tr>`).join("")}
        </tbody>
      </table>`;

    elTab.querySelectorAll("tbody tr").forEach((tr) => {
      tr.addEventListener("click", () => selecionarFuncionarioDaFolha(tr.dataset.id, tr.dataset.nome));
    });
  } catch (err) {
    console.error("Erro ao carregar folha (RH):", err);
    elTab.innerHTML = '<p class="rh-vazio">Erro ao carregar a folha do mês.</p>';
    if (elTot) elTot.style.display = "none";
  }
}

// Seleciona um funcionário a partir da tabela da folha e abre o holerite dele.
function selecionarFuncionarioDaFolha(id, nome) {
  if (!id) return;
  const input = document.getElementById("rh-busca-func");
  const hidden = document.getElementById("rh-func-id");
  if (input) input.value = nome || "";
  if (hidden) hidden.value = id;
  onFuncChange(String(id));
}

// Monta a "página" do comprovante anexado a um holerite, pra entrar logo depois da via
// impressa (Holerite → Comprovante, Holerite → Comprovante...). Imagem (jpg/png/jfif) entra
// direto como <img>; PDF vira um container vazio que renderizarPdfsEmComprovantes() preenche
// depois (imprimir um <iframe> de PDF sai cortado/espremido — bug conhecido do Chrome).
function montarPaginaComprovante(url) {
  // Absoluta: a janela de impressão começa em about:blank (document.write), então uma URL
  // relativa ("/uploads/...") pode não resolver pro host certo e a imagem/PDF falha em
  // carregar silenciosamente — aí a página do comprovante sai em branco na impressão.
  const abs = url.startsWith("http") ? url : `${window.location.origin}${url}`;
  const ehPdf = /\.pdf(\?|$)/i.test(abs);
  return ehPdf
    ? `<div class="pdf-render-container" data-pdf-url="${abs}"><small style="color:#999;">Carregando comprovante...</small></div>`
    : `<img src="${abs}" style="display:block; margin:0 auto;">`;
}

// Checa por amostragem (grade de pontos, não pixel a pixel — ficaria lento em canvas grandes
// renderizados em scale 2) se um canvas não tem nada além de branco/transparente.
function canvasEstaEmBranco(ctx, width, height) {
  const passo = 10;
  for (let y = 0; y < height; y += passo) {
    for (let x = 0; x < width; x += passo) {
      const [r, g, b, a] = ctx.getImageData(x, y, 1, 1).data;
      if (a > 0 && (r < 250 || g < 250 || b < 250)) return false;
    }
  }
  return true;
}

// Renderiza cada PDF de comprovante (dentro da janela de impressão `win`) como <canvas>, via
// PDF.js — imprimir um PDF direto num <iframe> sai cortado/espremido, mas uma imagem renderizada
// no tamanho certo imprime normalmente junto com o resto do documento. Precisa rodar (e
// terminar) ANTES de chamar win.print().
async function renderizarPdfsEmComprovantes(win) {
  // Comprovante em imagem (jpg/png/jfif): não tem preparo nenhum, mas o <img> pode ainda
  // estar carregando quando win.print() for chamado — sem esperar o load, a imagem sai em
  // branco na impressão mesmo com a URL certa. PDFs não usam <img>, então não entram aqui.
  const imgs = Array.from(win.document.querySelectorAll(".pagina-comprovante img"));
  await Promise.all(imgs.map((img) => img.complete ? Promise.resolve() : new Promise((resolve) => {
    img.addEventListener("load", resolve, { once: true });
    img.addEventListener("error", resolve, { once: true }); // não travar a impressão se a imagem falhar
  })));

  const containers = win.document.querySelectorAll(".pdf-render-container");
  if (!containers.length) return;

  if (!win.pdfjsLib) {
    await new Promise((resolve, reject) => {
      const script = win.document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      script.onload = resolve;
      script.onerror = () => reject(new Error("Falha ao carregar o leitor de PDF."));
      win.document.head.appendChild(script);
    }).catch((err) => console.error(err));
  }
  if (!win.pdfjsLib) {
    containers.forEach((c) => { c.innerHTML = '<small style="color:#c00;">Não foi possível carregar o comprovante (PDF).</small>'; });
    return;
  }
  win.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  for (const container of containers) {
    const url = container.dataset.pdfUrl;
    try {
      const pdf = await win.pdfjsLib.getDocument(url).promise;
      container.innerHTML = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = win.document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.maxWidth = "100%";
        canvas.style.maxHeight = "100%";
        const ctx = canvas.getContext("2d");
        await page.render({ canvasContext: ctx, viewport }).promise;
        // Comprovante bancário exportado como PDF costuma vir com uma 2ª página em branco
        // (artefato do banco, não do nosso código) — checar operatorList não bastou (o
        // template do banco pode desenhar bordas/fundo mesmo numa página "vazia"), então a
        // partir da 2ª página checa os PIXELS de verdade: se não sobrar nada além de
        // branco/transparente, pula — senão sobra uma página em branco extra na impressão.
        if (i > 1 && canvasEstaEmBranco(ctx, canvas.width, canvas.height)) continue;
        container.appendChild(canvas);
      }
    } catch (err) {
      console.error("Erro ao renderizar PDF do comprovante:", url, err);
      container.innerHTML = '<small style="color:#c00;">Não foi possível carregar o comprovante (PDF).</small>';
    }
  }
}

// ===== Integração externa (chamada de Vencimentos > Contas a Pagar > Funcionário) =====
// Abre o holerite de um funcionário/competência a partir de outra tela: ativa o modo RH
// (se ainda não estiver ativo), monta o painel (lazy) e seleciona a competência/funcionário.
async function abrirHoleriteExterno(idfuncionario, mes, ano, tipo = "mensal") {
  if (!idfuncionario) return;
  const link = document.querySelector("li.RH a");
  const jaAtivo = document.body.classList.contains("rh-mode");
  if (!jaAtivo && link) link.click(); // dispara o listener de initRH (ativa rh-mode + montarPainel)

  // Carrega os dados do empregador ANTES de renderizar — montarPainel() já dispara isso
  // sozinho, mas sem aguardar; vindo de fora (Vencimentos), o holerite podia renderizar
  // antes da resposta chegar, deixando nome/CNPJ/endereço da empresa em branco.
  if (!empresaAtual) await carregarEmpresa();

  const tentar = () => {
    const panel = document.getElementById("rh-panel");
    if (!panel) { requestAnimationFrame(tentar); return; } // aguarda montarPainel (lazy)

    tipoSel = tipo; mesSel = Number(mes); anoSel = Number(ano);
    const selTipo = document.getElementById("rh-select-tipo"); if (selTipo) selTipo.value = tipoSel;
    const selMes = document.getElementById("rh-select-mes"); if (selMes) selMes.value = mesSel;
    const selAno = document.getElementById("rh-select-ano"); if (selAno) selAno.value = anoSel;

    document.getElementById("rh-func-id").value = idfuncionario;
    onFuncChange(String(idfuncionario));
  };
  tentar();
}
window.abrirHoleriteRH = abrirHoleriteExterno;

// Imprime em lote os holerites de uma lista de competências (usado pelo botão "Imprimir
// todos" em Vencimentos > Contas a Pagar > Funcionário — respeita o que já está filtrado
// na tela, já que a lista vem das linhas efetivamente renderizadas ali). Busca cada holerite
// e monta tudo num único documento, com quebra de página entre eles.
async function imprimirHoleritesEmLote(lista) {
  if (!Array.isArray(lista) || !lista.length) return;
  try {
    if (!empresaAtual) await carregarEmpresa();
    const win = window.open("", "_blank");
    if (!win) { Swal.fire("Bloqueado", "Permita pop-ups para imprimir.", "warning"); return; }

    const css = `
      @page { size: A4 portrait; margin: 10mm; }
      * { box-sizing: border-box; font-family: Arial, Helvetica, sans-serif; }
      body { margin: 0; color: #111; }
      /* Cada página (holerite OU comprovante) começa numa folha nova, exceto a primeira —
         intercalando Holerite/Comprovante/Holerite/Comprovante na ordem em que forem inseridas. */
      .pagina-impressao + .pagina-impressao { page-break-before: always; }
      /* Sem height:100vh — em contexto de impressão isso pode passar da área útil da folha
         (@page já tem margem de 10mm) e sobrar uma página em branco extra. */
      .pagina-comprovante { text-align: center; }
      .pagina-comprovante img, .pagina-comprovante canvas { max-width: 100%; max-height: 260mm; }
      .via { padding: 6px 4px; break-inside: avoid; page-break-inside: avoid; }
      .via-tag { text-align: right; font-size: 11px; font-weight: bold; color: #666; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 4px; }
      .corte { border-top: 1px dashed #999; text-align: center; font-size: 10px; color: #999; margin: 10px 0; padding-top: 2px; letter-spacing: 1px; }
      table { border-collapse: collapse; width: 100%; }
      table.cab { border: 1px solid #333; }
      table.cab td { padding: 8px 10px; vertical-align: top; font-size: 12px; }
      table.cab .emp { width: 62%; border-right: 1px solid #333; line-height: 1.5; }
      table.cab .doc { font-size: 12px; line-height: 1.6; }
      table.cab .doc-titulo { font-size: 13px; font-weight: bold; text-transform: uppercase; margin-bottom: 4px; }
      table.func { border: 1px solid #333; border-top: none; font-size: 12px; }
      table.func th, table.func td { border-right: 1px solid #ccc; padding: 5px 8px; text-align: left; }
      table.func th { background: #efefef; font-size: 10px; text-transform: uppercase; letter-spacing: .5px; color: #444; }
      table.func th:last-child, table.func td:last-child { border-right: none; }
      table.itens { border: 1px solid #333; border-top: none; font-size: 12px; }
      table.itens th { background: #efefef; font-size: 10px; text-transform: uppercase; letter-spacing: .5px; color: #444; padding: 5px 8px; border-right: 1px solid #ccc; text-align: left; }
      table.itens td { padding: 4px 8px; border-right: 1px solid #eee; }
      table.itens th.v, table.itens td.v { text-align: right; white-space: nowrap; }
      table.itens th:last-child, table.itens td:last-child { border-right: none; }
      table.itens td.c { color: #888; width: 42px; }
      table.itens td.r { color: #666; width: 70px; }
      table.itens tbody tr:nth-child(even) { background: #fafafa; }
      table.itens tfoot .tot td { border-top: 2px solid #333; font-weight: bold; padding: 6px 8px; text-transform: uppercase; font-size: 11px; }
      .benef { font-size: 11px; color: #555; margin-top: 8px; }
      .benef strong { color: #333; }
      table.bases { margin-top: 12px; border: 1px solid #333; }
      table.bases td { padding: 8px 10px; border-right: 1px solid #ccc; text-align: center; }
      table.bases td:last-child { border-right: none; }
      table.bases span { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: .5px; color: #666; margin-bottom: 3px; }
      table.bases strong { font-size: 14px; }
      table.bases td.liq { background: #f2f2f2; }
      table.bases td.liq strong { font-size: 16px; }
      .assinatura { margin-top: 26px; font-size: 12px; }
      .assinatura .linha { border-top: 1px solid #333; width: 340px; margin: 0 auto 4px; }
      .assinatura > div:last-child { text-align: center; }
      .assinatura small { color: #666; }
    `;

    const mesAntes = mesSel, anoAntes = anoSel;
    let corpo = "";
    for (const item of lista) {
      const { idfuncionario, mes, ano, tipo } = item || {};
      if (!idfuncionario || !mes || !ano) continue;
      try {
        const data = await fetchComToken(`/rh/holerite?idfuncionario=${idfuncionario}&mes=${mes}&ano=${ano}&tipo=${tipo || "mensal"}`);
        const h = data.holerite;
        const t = totaisHolerite(h, false);
        mesSel = Number(mes); anoSel = Number(ano); // usados por montarViaImpressao no cabeçalho
        // Holerite (2 vias) e, logo em seguida, o comprovante dele — intercalando
        // Holerite/Comprovante/Holerite/Comprovante conforme a lista vai sendo impressa.
        corpo += `<div class="pagina-impressao bloco-holerite">${montarViaImpressao(h, t, "Via do Funcionário")}<div class="corte">✂ - - - - - - - - - - - - - - - - - - recorte aqui - - - - - - - - - - - - - - - - - -</div>${montarViaImpressao(h, t, "Via da Empresa")}</div>`;
        if (h.comprovante) {
          corpo += `<div class="pagina-impressao pagina-comprovante">${montarPaginaComprovante(`/uploads/rh/comprovantes/${h.comprovante}`)}</div>`;
        }
      } catch (err) {
        console.error("Erro ao carregar holerite p/ impressão em lote:", item, err);
      }
    }
    mesSel = mesAntes; anoSel = anoAntes;

    if (!corpo) {
      win.close();
      Swal.fire("Nada para imprimir", "Não foi possível carregar nenhum holerite da lista.", "warning");
      return;
    }

    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Holerites</title><style>${css}</style></head><body>${corpo}</body></html>`);
    win.document.close();
    win.focus();
    win.onafterprint = () => win.close();
    // Só imprime depois que os PDFs de comprovante (se houver) já viraram <canvas> — imprimir
    // um <iframe> de PDF sai cortado/espremido (ver renderizarPdfsEmComprovantes).
    await renderizarPdfsEmComprovantes(win);
    try { win.print(); } catch (e) {}
  } catch (err) {
    console.error("Erro ao imprimir holerites em lote:", err);
    Swal.fire("Erro", "Não foi possível gerar a impressão em lote.", "error");
  }
}
window.imprimirHoleritesEmLote = imprimirHoleritesEmLote;

// Imprime 2 vias (Funcionário/Empresa) do holerite de um funcionário/competência sem
// precisar abrir a tela de RH — busca o holerite (real ou prévia) direto da API.
async function imprimirHoleriteExterno(idfuncionario, mes, ano, tipo = "mensal") {
  if (!idfuncionario) return;
  try {
    if (!empresaAtual) await carregarEmpresa();
    const data = await fetchComToken(`/rh/holerite?idfuncionario=${idfuncionario}&mes=${mes}&ano=${ano}&tipo=${tipo}`);
    const h = data.holerite;
    const t = totaisHolerite(h, false);
    const mesAntes = mesSel, anoAntes = anoSel;
    mesSel = Number(mes); anoSel = Number(ano); // usados por montarViaImpressao no cabeçalho
    const win = window.open("", "_blank");
    if (!win) { Swal.fire("Bloqueado", "Permita pop-ups para imprimir.", "warning"); return; }

    const css = `
      @page { size: A4 portrait; margin: 10mm; }
      * { box-sizing: border-box; font-family: Arial, Helvetica, sans-serif; }
      body { margin: 0; color: #111; }
      .via { padding: 6px 4px; break-inside: avoid; page-break-inside: avoid; }
      .via-tag { text-align: right; font-size: 11px; font-weight: bold; color: #666; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 4px; }
      .corte { border-top: 1px dashed #999; text-align: center; font-size: 10px; color: #999; margin: 10px 0; padding-top: 2px; letter-spacing: 1px; }
      table { border-collapse: collapse; width: 100%; }
      table.cab { border: 1px solid #333; }
      table.cab td { padding: 8px 10px; vertical-align: top; font-size: 12px; }
      table.cab .emp { width: 62%; border-right: 1px solid #333; line-height: 1.5; }
      table.cab .doc { font-size: 12px; line-height: 1.6; }
      table.cab .doc-titulo { font-size: 13px; font-weight: bold; text-transform: uppercase; margin-bottom: 4px; }
      table.func { border: 1px solid #333; border-top: none; font-size: 12px; }
      table.func th, table.func td { border-right: 1px solid #ccc; padding: 5px 8px; text-align: left; }
      table.func th { background: #efefef; font-size: 10px; text-transform: uppercase; letter-spacing: .5px; color: #444; }
      table.func th:last-child, table.func td:last-child { border-right: none; }
      table.itens { border: 1px solid #333; border-top: none; font-size: 12px; }
      table.itens th { background: #efefef; font-size: 10px; text-transform: uppercase; letter-spacing: .5px; color: #444; padding: 5px 8px; border-right: 1px solid #ccc; text-align: left; }
      table.itens td { padding: 4px 8px; border-right: 1px solid #eee; }
      table.itens th.v, table.itens td.v { text-align: right; white-space: nowrap; }
      table.itens th:last-child, table.itens td:last-child { border-right: none; }
      table.itens td.c { color: #888; width: 42px; }
      table.itens td.r { color: #666; width: 70px; }
      table.itens tbody tr:nth-child(even) { background: #fafafa; }
      table.itens tfoot .tot td { border-top: 2px solid #333; font-weight: bold; padding: 6px 8px; text-transform: uppercase; font-size: 11px; }
      .benef { font-size: 11px; color: #555; margin-top: 8px; }
      .benef strong { color: #333; }
      table.bases { margin-top: 12px; border: 1px solid #333; }
      table.bases td { padding: 8px 10px; border-right: 1px solid #ccc; text-align: center; }
      table.bases td:last-child { border-right: none; }
      table.bases span { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: .5px; color: #666; margin-bottom: 3px; }
      table.bases strong { font-size: 14px; }
      table.bases td.liq { background: #f2f2f2; }
      table.bases td.liq strong { font-size: 16px; }
      .assinatura { margin-top: 26px; font-size: 12px; }
      .assinatura .linha { border-top: 1px solid #333; width: 340px; margin: 0 auto 4px; }
      .assinatura > div:last-child { text-align: center; }
      .assinatura small { color: #666; }
      /* Sem height:100vh — em contexto de impressão isso pode passar da área útil da folha
         (@page já tem margem de 10mm) e sobrar uma página em branco extra. */
      .pagina-comprovante { page-break-before: always; text-align: center; }
      .pagina-comprovante img, .pagina-comprovante canvas { max-width: 100%; max-height: 260mm; }
    `;
    // Holerite (2 vias) seguido do comprovante anexado, na mesma impressão — só chega aqui
    // com comprovante já anexado (ver gate em Main.js/celulaHolerite).
    const paginaComprovante = h.comprovante
      ? `<div class="pagina-comprovante">${montarPaginaComprovante(`/uploads/rh/comprovantes/${h.comprovante}`)}</div>`
      : "";
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Holerite — ${h.nome} — ${mesSel}/${anoSel}</title><style>${css}</style></head>
    <body>${montarViaImpressao(h, t, "Via do Funcionário")}<div class="corte">✂ - - - - - - - - - - - - - - - - - - recorte aqui - - - - - - - - - - - - - - - - - -</div>${montarViaImpressao(h, t, "Via da Empresa")}${paginaComprovante}</body></html>`);
    win.document.close();
    win.focus();
    win.onafterprint = () => win.close();
    // Só imprime depois que o PDF de comprovante (se houver) já virou <canvas> — imprimir um
    // <iframe> de PDF sai cortado/espremido (ver renderizarPdfsEmComprovantes).
    await renderizarPdfsEmComprovantes(win);
    try { win.print(); } catch (e) {}

    mesSel = mesAntes; anoSel = anoAntes; // restaura a competência da tela de RH (se estava aberta)
  } catch (err) {
    console.error("Erro ao imprimir holerite:", err);
    Swal.fire("Erro", "Não foi possível carregar o holerite para impressão.", "error");
  }
}
window.imprimirHoleriteRH = imprimirHoleriteExterno;

// ===== Toggle do modo RH =====
function initRH() {
  const li = document.querySelector("li.RH");
  const link = li?.querySelector("a");
  if (!li || !link) return;

  // RH mode só para quem tem a flag 'rh' OU 'supremo'.
  const temPermissaoRH = temPermissao("Staff", "rh");
  const temPermissaoSupremo = temPermissao("Staff", "master");
  
  const temAcessoRH = temPermissaoRH || temPermissaoSupremo

  if (!temAcessoRH) {
    li.style.display = "none";
    return;
  }

  const icone = link.querySelector(".material-symbols-outlined");

  link.addEventListener("click", (e) => {
    e.preventDefault();
    const ativo = document.body.classList.toggle("rh-mode");
    if (icone) icone.textContent = ativo ? "logout" : "";
    if (ativo) montarPainel();
  });
}

// Espera window.permissoes estar disponível antes de checar temPermissao (evita esconder
// o RH por engano por causa do carregamento assíncrono das permissões no Index.js).
document.addEventListener("DOMContentLoaded", () => {
  if (Array.isArray(window.permissoes)) initRH();
  else document.addEventListener("permissoesCarregadas", initRH, { once: true });
});
