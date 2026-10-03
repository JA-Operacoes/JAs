import { fetchComToken } from '/utils/utils.js';

// ===== RH — Empréstimos consignados descontados em folha =====
// Cadastro simples (valor mensal + nº de parcelas + mês inicial): o empréstimo é feito pelo
// funcionário e a contabilidade controla juros/quitação — o RH só replica o que vem no holerite
// da contabilidade. As parcelas viram o desconto "Empréstimo (n/N)" do holerite mensal sozinhas
// (ver emprestimosDoMes em rotaRH.js) e são ajustadas mês a mês no bloco "Empréstimos" do holerite.
// Carregado sob demanda pelo botão "Empréstimos" do RH (mesmo padrão de RHFerias.js).

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const MESES_CURTOS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const reais = (v) => "R$ " + (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const competencia = (mes, ano) => `${MESES_CURTOS[mes - 1]}/${ano}`;
// fetchComToken lança "Erro ...: {"error":"..."}" — extrai só o texto da API.
const msgErro = (err, padrao) => {
  const m = String(err?.message || "").match(/\{.*\}/);
  try { if (m) return JSON.parse(m[0]).error || padrao; } catch (_) { /* usa o padrão */ }
  return err?.corpo?.error || padrao;
};

// Mês/ano do vencimento da 1ª parcela a partir do mês TRABALHADO informado (+1 mês).
function vencimentoDe(mesTrab, anoTrab) {
  const total = anoTrab * 12 + (mesTrab - 1) + 1;
  return { mes: (total % 12) + 1, ano: Math.floor(total / 12) };
}

let mostrarEncerrados = false;

export async function abrirEmprestimos(aoMudar) {
  let mudou = false;
  let proxima = { tela: "lista" };
  while (proxima) {
    const atual = proxima;
    proxima = null;
    if (atual.tela === "lista") {
      proxima = await telaLista();
    } else if (atual.tela === "novo") {
      if (await telaNovo()) mudou = true;
      proxima = { tela: "lista" };
    } else if (atual.tela === "detalhe") {
      const r = await telaDetalhe(atual.id);
      if (r?.mudou) mudou = true;
      proxima = r?.fechar ? null : { tela: "lista" };
    }
  }
  if (mudou && typeof aoMudar === "function") aoMudar();
}

// ---- Lista ----
async function telaLista() {
  let emprestimos = [];
  try {
    const data = await fetchComToken(`/rh/emprestimos?todos=${mostrarEncerrados ? 1 : 0}`);
    emprestimos = data?.emprestimos || [];
  } catch (err) {
    await Swal.fire("Erro", msgErro(err, "Não foi possível carregar os empréstimos."), "error");
    return null;
  }

  const linhas = emprestimos.map((e) => {
    const fim = (() => { const t = e.anoinicio * 12 + (e.mesinicio - 1) + (e.qtdparcelas - 1); return { mes: (t % 12) + 1, ano: Math.floor(t / 12) }; })();
    return `<tr class="${e.ativo ? "" : "rhe-encerrado"}">
      <td>${esc(e.nome)}</td>
      <td>${esc(e.descricao)}</td>
      <td class="rhe-num">${reais(e.valorparcela)}</td>
      <td class="rhe-num">${e.conferidas}/${e.qtdparcelas}</td>
      <td>${competencia(e.mesinicio, e.anoinicio)} a ${competencia(fim.mes, fim.ano)}</td>
      <td>${e.ativo ? '<span class="rhe-badge ativo">Ativo</span>' : '<span class="rhe-badge encerrado">Encerrado</span>'}</td>
      <td><button type="button" class="rhe-btn" data-rhe-id="${e.idemprestimo}">Ver parcelas</button></td>
    </tr>`;
  }).join("");

  let escolha = null;
  await Swal.fire({
    title: "Empréstimos consignados",
    html: `
      <div class="rhe-topo">
        <small>Datas = mês de <strong>vencimento</strong> da folha (o mesmo da tela de RH). "Conferidas" = parcelas já em holerite conferido.</small>
        <label class="rhe-check"><input type="checkbox" id="rhe-encerrados" ${mostrarEncerrados ? "checked" : ""}> Mostrar encerrados</label>
      </div>
      ${emprestimos.length ? `
      <table class="rhe-tab">
        <thead><tr><th>Funcionário</th><th>Descrição</th><th class="rhe-num">Parcela</th><th class="rhe-num">Conferidas</th><th>Descontos (vencimento)</th><th>Status</th><th></th></tr></thead>
        <tbody>${linhas}</tbody>
      </table>` : `<p class="rhe-vazio">Nenhum empréstimo cadastrado.</p>`}`,
    width: "min(1000px, 96vw)",
    showCloseButton: true,
    showConfirmButton: true,
    confirmButtonText: "+ Novo empréstimo",
    customClass: { popup: "rhe-popup" },
    didOpen: () => {
      document.getElementById("rhe-encerrados")?.addEventListener("change", (ev) => {
        mostrarEncerrados = ev.target.checked;
        escolha = { tela: "lista" };
        Swal.close();
      });
      document.querySelectorAll("[data-rhe-id]").forEach((b) => b.addEventListener("click", () => {
        escolha = { tela: "detalhe", id: Number(b.dataset.rheId) };
        Swal.close();
      }));
    },
  }).then((r) => { if (r.isConfirmed) escolha = { tela: "novo" }; });
  return escolha;
}

// ---- Novo empréstimo ----
async function telaNovo() {
  let funcionarios = [];
  try { funcionarios = await fetchComToken("/rh/funcionarios"); }
  catch (err) { await Swal.fire("Erro", msgErro(err, "Não foi possível carregar os funcionários."), "error"); return false; }

  const hoje = new Date();
  const opcoesFunc = (funcionarios || []).map((f) => `<option value="${f.idfuncionario}">${esc(f.nome)}</option>`).join("");
  const opcoesMes = MESES.map((m, i) => `<option value="${i + 1}" ${i === hoje.getMonth() ? "selected" : ""}>${m}</option>`).join("");

  const r = await Swal.fire({
    title: "Novo empréstimo consignado",
    html: `
      <div class="rhe-form">
        <label>Funcionário
          <select id="rhe-func"><option value="">Selecione…</option>${opcoesFunc}</select>
        </label>
        <div class="rhe-linha2">
          <label>Valor mensal a descontar
            <input type="text" id="rhe-valor" inputmode="numeric" oninput="formatReais(this)" placeholder="R$ 0,00">
          </label>
          <label>Quantidade de parcelas
            <input type="number" id="rhe-qtd" min="1" max="120" step="1" value="12">
          </label>
        </div>
        <div class="rhe-linha2">
          <label>Mês trabalhado inicial
            <select id="rhe-mes">${opcoesMes}</select>
          </label>
          <label>Ano
            <input type="number" id="rhe-ano" min="2020" max="2100" step="1" value="${hoje.getFullYear()}">
          </label>
        </div>
        <label>Descrição (opcional)
          <input type="text" id="rhe-desc" maxlength="120" placeholder="Empréstimo consignado">
        </label>
        <label>Observação (opcional)
          <textarea id="rhe-obs" rows="2" placeholder="Ex.: contrato, banco, nº do contrato…"></textarea>
        </label>
        <div class="rhe-resumo" id="rhe-resumo"></div>
      </div>`,
    width: "min(560px, 96vw)",
    showCancelButton: true,
    confirmButtonText: "Cadastrar",
    cancelButtonText: "Voltar",
    focusConfirm: false,
    customClass: { popup: "rhe-popup" },
    didOpen: () => {
      const atualizarResumo = () => {
        const valor = window.desformatarReais ? Number(window.desformatarReais(document.getElementById("rhe-valor").value)) || 0 : 0;
        const qtd = parseInt(document.getElementById("rhe-qtd").value, 10) || 0;
        const mes = parseInt(document.getElementById("rhe-mes").value, 10);
        const ano = parseInt(document.getElementById("rhe-ano").value, 10);
        const el = document.getElementById("rhe-resumo");
        if (!mes || !ano || qtd < 1) { el.textContent = ""; return; }
        const ini = vencimentoDe(mes, ano);
        const t = ini.ano * 12 + (ini.mes - 1) + (qtd - 1);
        const fim = { mes: (t % 12) + 1, ano: Math.floor(t / 12) };
        el.innerHTML = `1º desconto no holerite com vencimento <strong>${competencia(ini.mes, ini.ano)}</strong> (mês trabalhado ${competencia(mes, ano)}); `
          + `última parcela em <strong>${competencia(fim.mes, fim.ano)}</strong>. Total: <strong>${reais(valor * qtd)}</strong>.`;
      };
      ["rhe-valor", "rhe-qtd", "rhe-mes", "rhe-ano"].forEach((id) => document.getElementById(id).addEventListener("input", atualizarResumo));
      atualizarResumo();
    },
    preConfirm: async () => {
      const idfuncionario = document.getElementById("rhe-func").value;
      const valorparcela = window.desformatarReais ? Number(window.desformatarReais(document.getElementById("rhe-valor").value)) || 0 : 0;
      const qtdparcelas = parseInt(document.getElementById("rhe-qtd").value, 10);
      if (!idfuncionario) { Swal.showValidationMessage("Selecione o funcionário."); return false; }
      if (!(valorparcela > 0)) { Swal.showValidationMessage("Informe o valor mensal a descontar."); return false; }
      if (!Number.isInteger(qtdparcelas) || qtdparcelas < 1 || qtdparcelas > 120) { Swal.showValidationMessage("Quantidade de parcelas inválida (1 a 120)."); return false; }
      try {
        await fetchComToken("/rh/emprestimos", {
          method: "POST",
          body: {
            idfuncionario, valorparcela, qtdparcelas,
            mestrabalhado: parseInt(document.getElementById("rhe-mes").value, 10),
            anotrabalhado: parseInt(document.getElementById("rhe-ano").value, 10),
            descricao: document.getElementById("rhe-desc").value,
            obs: document.getElementById("rhe-obs").value,
          },
        });
        return true;
      } catch (err) {
        Swal.showValidationMessage(msgErro(err, "Não foi possível cadastrar o empréstimo."));
        return false;
      }
    },
  });
  return r.isConfirmed === true;
}

// ---- Parcelas de um empréstimo ----
async function telaDetalhe(id) {
  let dados;
  try { dados = await fetchComToken(`/rh/emprestimos/${id}`); }
  catch (err) { await Swal.fire("Erro", msgErro(err, "Não foi possível carregar o empréstimo."), "error"); return null; }
  const { emprestimo: e, parcelas } = dados;

  const linhas = parcelas.map((p) => {
    const status = p.conferido ? '<span class="rhe-badge ativo">Conferido</span>'
      : p.statusholerite ? '<span class="rhe-badge neutro">Holerite aberto</span>'
      : '<span class="rhe-badge neutro">A gerar</span>';
    return `<tr>
      <td>${competencia(p.mes, p.ano)}</td>
      <td class="rhe-num">${p.numparcela}/${e.qtdparcelas}</td>
      <td class="rhe-num">${p.semdesconto ? "—" : reais(p.valor)}</td>
      <td>${p.semdesconto ? '<span class="rhe-badge encerrado">Sem desconto</span>' : status}</td>
    </tr>`;
  }).join("");

  const r = await Swal.fire({
    title: `${esc(e.nome)} — ${esc(e.descricao)}`,
    html: `
      <p class="rhe-sub">${reais(e.valorparcela)} × ${e.qtdparcelas} parcelas · ${e.ativo ? "ativo" : "<strong>encerrado</strong>"}
        ${e.obs ? `<br><em>${esc(e.obs)}</em>` : ""}</p>
      <div class="rhe-scroll">
        <table class="rhe-tab">
          <thead><tr><th>Vencimento</th><th class="rhe-num">Parcela</th><th class="rhe-num">Valor</th><th>Situação</th></tr></thead>
          <tbody>${linhas}</tbody>
        </table>
      </div>
      <small>Para ajustar valor, nº da parcela ou marcar "sem desconto" em um mês, abra o holerite daquele mês (bloco "Empréstimos").</small>`,
    width: "min(640px, 96vw)",
    showCancelButton: true,
    showDenyButton: true,
    confirmButtonText: "Voltar",
    cancelButtonText: "Fechar",
    denyButtonText: e.ativo ? "Encerrar empréstimo" : "Reativar empréstimo",
    customClass: { popup: "rhe-popup" },
  });

  if (r.isDenied) {
    const conf = await Swal.fire({
      icon: "question",
      title: e.ativo ? "Encerrar este empréstimo?" : "Reativar este empréstimo?",
      text: e.ativo
        ? "As parcelas deixam de entrar nos holerites ainda não conferidos. Os já conferidos ficam como estão."
        : "As parcelas voltam a entrar nos holerites ainda não conferidos.",
      showCancelButton: true, confirmButtonText: "Confirmar", cancelButtonText: "Cancelar",
    });
    if (!conf.isConfirmed) return { mudou: false };
    try {
      await fetchComToken(`/rh/emprestimos/${id}/ativo`, { method: "PUT", body: { ativo: !e.ativo } });
      return { mudou: true };
    } catch (err) {
      await Swal.fire("Erro", msgErro(err, "Não foi possível alterar o empréstimo."), "error");
    }
  }
  if (r.dismiss === Swal.DismissReason.cancel) return { mudou: false, fechar: true };
  return { mudou: false };
}
