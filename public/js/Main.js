import { fetchComToken, aplicarTema } from '/utils/utils.js';

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



// Atualiza cards de resumo

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





// Função para buscar pedidos do usuário logado
// Busca pedidos financeiros do usuário logado
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
    function normalizarStatus(info) {
      if (!info) return { status: "pendente" };
      if (typeof info === "string") return { status: info.toLowerCase() };
      if (typeof info === "object" && info.status) return { ...info, status: info.status.toLowerCase() };
      return { status: "pendente" };
    }

    // Aplica normalização para todos os campos de status do pedido
    function normalizarPedido(p) {
      return {
        ...p,
        statuscaixinha: normalizarStatus(p.statuscaixinha),
        statusajustecusto: normalizarStatus(p.statusajustecusto),
        statusdiariadobrada: normalizarStatus(p.statusdiariadobrada),
        statusmeiadiaria: normalizarStatus(p.statusmeiadiaria)
      };
    }

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
setInterval(atualizarResumoPedidos, 1000);

// Chamada inicial ao carregar a página
atualizarResumoPedidos();


function usuarioTemPermissao() {
  if (!window.permissoes || !Array.isArray(window.permissoes)) return false;
console.log("Usuário tem permissão master no staff");
  const permissaoStaff = window.permissoes.find(p => p.modulo?.toLowerCase() === "staff");
  if (!permissaoStaff) return false;

  return !!permissaoStaff.pode_master; 
}

// Evento no card financeiro
const cardFinanceiro = document.querySelector(".card-financeiro");
if (cardFinanceiro) {
  cardFinanceiro.addEventListener("click", async () => {
    await mostrarPedidosUsuario();
  });
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
  // await atualizarAtividades();
  // await mostrarPedidosUsuario();
  await atualizarProximoEvento();
});




