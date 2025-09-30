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
  // Demais cards
  // document.getElementById("eventos").textContent = dadosResumo.eventos;
  // document.getElementById("clientes").textContent = dadosResumo.clientes;
  // document.getElementById("pedidos").textContent = dadosResumo.pedidos;
  // document.getElementById("pedidosPendentes").textContent = dadosResumo.pedidosPendentes;
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

    // Bloco de controles (ano/mês)
    const controles = document.createElement("div");
    controles.className = "calendario-controles";
    controles.innerHTML = `
        <label>Ano: <select id="anoSelect"></select></label>
        <label>Mês: <select id="mesSelect"></select></label>
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

    // Grid
    const grid = document.createElement("div");
    grid.className = "calendario-grid";
    calendario.appendChild(grid);

    container.appendChild(calendario);
    lista.appendChild(container);

    // ======= POPULAR SELECTS =======
    const anoSelect = header.querySelector("#anoSelect");
    const mesSelect = header.querySelector("#mesSelect");
    const anoAtual = new Date().getFullYear();

    for (let a = anoAtual - 2; a <= anoAtual + 2; a++) {
        const opt = document.createElement("option");
        opt.value = a;
        opt.textContent = a;
        if (a === anoAtual) opt.selected = true;
        anoSelect.appendChild(opt);
    }

    const nomesMeses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
    nomesMeses.forEach((nome, idx) => {
        const opt = document.createElement("option");
        opt.value = idx + 1;
        opt.textContent = nome;
        if (idx === new Date().getMonth()) opt.selected = true;
        mesSelect.appendChild(opt);
    });

    // ======= FUNÇÃO DE RENDER =======
    async function renderCalendario(ano, mes) {
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

            // ======== Mapear eventos por data para performance ========
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

            // ===== Dias do mês anterior =====
            for (let i = diaSemanaInicio - 1; i >= 0; i--) {
                const dia = ultimoDiaMesAnterior - i;
                const dataStr = `${anoAnterior}-${String(mesAnterior).padStart(2,"0")}-${String(dia).padStart(2,"0")}`;
                const cell = document.createElement("div");
                cell.classList.add("dia-anterior");
                cell.style.opacity = "0.4";
                cell.innerHTML = `<span class="numero-dia">${dia}</span>`;

                if (dataStr === hojeStr) { cell.style.border = "2px solid var(--primary-color)"; cell.style.borderRadius = "6px"; }

                (mapaEventos[dataStr] || []).forEach(ev => {
                    const evEl = document.createElement("span");
                    evEl.className = "evento";
                    evEl.style.background = getCorPeriodo(ev.tipo);
                    evEl.textContent = ev.nome;
                    if (ev.tipo === "Feriado") evEl.style.color = "#fff";
                    cell.appendChild(evEl);
                });

                grid.appendChild(cell);
            }

            // ===== Dias do mês atual =====
            for (let dia = 1; dia <= ultimoDia; dia++) {
                const dataStr = `${ano}-${String(mes).padStart(2,"0")}-${String(dia).padStart(2,"0")}`;
                const cell = document.createElement("div");
                cell.innerHTML = `<span class="numero-dia">${dia}</span>`;

                if (dataStr === hojeStr) { cell.style.border = "2px solid var(--primary-color)"; cell.style.borderRadius = "6px"; }

                (mapaEventos[dataStr] || []).forEach(ev => {
                    const evEl = document.createElement("span");
                    evEl.className = "evento";
                    evEl.style.background = getCorPeriodo(ev.tipo);
                    evEl.textContent = ev.nome;
                    if (ev.tipo === "Feriado") evEl.style.color = "#fff";
                    cell.appendChild(evEl);
                });

                grid.appendChild(cell);
            }

            // ===== Dias do próximo mês =====
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

                (mapaEventos[dataStr] || []).forEach(ev => {
                    const evEl = document.createElement("span");
                    evEl.className = "evento";
                    evEl.style.background = getCorPeriodo(ev.tipo);
                    evEl.textContent = ev.nome;
                    if (ev.tipo === "Feriado") evEl.style.color = "#fff";
                    cell.appendChild(evEl);
                });

                grid.appendChild(cell);
            }

        } catch (err) {
            console.error("Erro ao carregar eventos do calendário:", err);
        }
    }

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

    // Render inicial
    renderCalendario(parseInt(anoSelect.value), parseInt(mesSelect.value));

    anoSelect.addEventListener("change", () => {
        renderCalendario(parseInt(anoSelect.value), parseInt(mesSelect.value));
    });
    mesSelect.addEventListener("change", () => {
        renderCalendario(parseInt(anoSelect.value), parseInt(mesSelect.value));
    });
}




// Função para buscar pedidos do usuário logado
// Busca pedidos financeiros do usuário logado
async function buscarPedidosUsuario() {
  const idusuario = getIdExecutor(); // pega do token
  try {
    const resposta = await fetchComToken(`/main/notificacoes-financeiras`, {
      headers: { idempresa: getIdEmpresa() }
    });

    console.log("Resposta bruta do fetch:", resposta);

    if (!resposta || !Array.isArray(resposta)) {
      console.error("Resposta inválida ou não é um array:", resposta);
      return [];
    }

    // Usa o campo correto para filtrar
    const pedidosDoUsuario = resposta.filter(p => String(p.solicitante) === String(idusuario));

    console.log("Pedidos do usuário:", pedidosDoUsuario);
    return pedidosDoUsuario;

  } catch (err) {
    console.error("Erro na requisição de pedidos:", err);
    return [];
  }
}


// Atualiza o painelDetalhes com os pedidos
async function mostrarPedidosUsuario() {
  const lista = document.getElementById("painelDetalhes");
  if (!lista) return;

  const pedidos = await buscarPedidosUsuario();
  lista.innerHTML = "";

  const titulo = document.createElement("div");
  titulo.className = "titulo-pedidos font-bold text-lg mb-3";
  titulo.textContent = "Pedidos por Funcionário";
  lista.appendChild(titulo);

  if (!pedidos.length) {
    const msg = document.createElement("p");
    msg.textContent = "Você não possui pedidos registrados.";
    lista.appendChild(msg);
    return;
  }

  // Wrapper para rolagem dos funcionários
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

    // Filtra apenas os pedidos que tiveram atualização
    const pedidosComAtualizacao = pedidosFunc.filter(p => {
      const campos = ["statusajustecusto", "statuscaixinha", "statusmeiadiaria", "statusdiariadobrada"];
      return campos.some(campo => p[campo]); // só entra se tiver algum campo com valor
    });

    // Se não tiver nenhum pedido atualizado, pula esse funcionário
    if (pedidosComAtualizacao.length === 0) return;

    // Contar número total de categorias realmente atualizadas
    let totalCategorias = 0;
    pedidosComAtualizacao.forEach(p => {
      const campos = ["statusajustecusto", "statuscaixinha", "statusmeiadiaria", "statusdiariadobrada"];
      campos.forEach(campo => {
        if (p[campo]) totalCategorias++;
      });
    });

    const divFuncionario = document.createElement("div");
    divFuncionario.className = "funcionario border rounded mb-3";

    // Header do funcionário
    const header = document.createElement("div");
    header.className = "funcionario-header p-2 cursor-pointer bg-gray-200 flex justify-between items-center";
    header.innerHTML = `<strong>${funcNome}</strong> <span>Pedidos: ${totalCategorias}</span>`;

    // Container que vai expandir
    const container = document.createElement("div");
    container.className = "funcionario-body p-2 hidden";

    pedidosComAtualizacao.forEach(pedido => {
      const campos = ["statusajustecusto", "statuscaixinha", "statusmeiadiaria", "statusdiariadobrada"];

      campos.forEach(campo => {
        if (!pedido[campo]) return; // só exibe se realmente tiver atualização

        const card = document.createElement("div");
        card.className = "pedido-card border rounded p-2 mb-2 bg-gray-50 flex justify-between items-start";

        // Define a cor do quadrado baseado no status
        let corQuadrado = "#facc15"; // amarelo = pendente
        if (pedido[campo].status.toLowerCase() === "aprovado") corQuadrado = "#16a34a"; // verde
        if (pedido[campo].status.toLowerCase() === "rejeitado") corQuadrado = "#dc2626"; // vermelho

        // Conteúdo do card
        let innerHTML = `<div>
          <strong>${campo.replace("status", "").replace(/([A-Z])/g, ' $1')}</strong><br>`;

        if (pedido[campo].valor !== undefined) {
          innerHTML += `Valor: R$ ${pedido[campo].valor} - Status: ${pedido[campo].status}<br>`;
        } else if (pedido[campo].datas) {
          innerHTML += `Datas: ${pedido[campo].datas.map(d => d.data).join(", ")} - Status: ${pedido[campo].status}<br>`;
        }

        if (pedido[campo].descricao) {
          innerHTML += `Descrição: ${pedido[campo].descricao}<br>`;
        }

        // Botões apenas se tiver permissão
        const podeAlterar = temPermissaoMaster || temPermissaoTotal;
        if (podeAlterar) {
          innerHTML += `
            <div class="flex gap-2 mt-1">
              <button class="aprovar bg-green-500 text-white px-2 py-1 rounded">Aprovar</button>
              <button class="negar bg-red-500 text-white px-2 py-1 rounded">Negar</button>
            </div>
          `;
        }
        innerHTML += `</div>`; // fecha div do conteúdo

        // Quadrado arredondado com cor dinâmica
        innerHTML += `<div class="quadrado-arredondado" style="background-color: ${corQuadrado};"></div>`;

        card.innerHTML = innerHTML;
        container.appendChild(card);
      });
    });

    header.addEventListener("click", () => {
      container.classList.toggle("hidden");
    });

    divFuncionario.appendChild(header);
    divFuncionario.appendChild(container);
    listaFuncionarios.appendChild(divFuncionario);
  });
}




// Evento no card financeiro
const cardFinanceiro = document.querySelector(".card-financeiro");
if (cardFinanceiro) {
  cardFinanceiro.addEventListener("click", async () => {
    await mostrarPedidosUsuario();
  });
}

// Chame na inicialização:
document.addEventListener("DOMContentLoaded", async function () {
  await atualizarResumo();
  // await atualizarAtividades();
  // await mostrarPedidosUsuario();
  await atualizarProximoEvento();
});

function usuarioTemPermissao(modulo, acao) {
  console.log("Verificando permissão para:", modulo, acao);
  if (!window.permissoes || !Array.isArray(window.permissoes)) return false;
  return window.permissoes.some(p => 
    console.log("Permissão encontrada:", p),
    p.modulo?.toLowerCase() === modulo.toLowerCase() && 
    p.acao?.toLowerCase() === acao.toLowerCase()
  );
}

const temPermissaoMaster = usuarioTemPermissao("staff", "master");
const temPermissaoFinanceiro = usuarioTemPermissao("staff", "financeiro");
const temPermissaoTotal = (temPermissaoMaster || temPermissaoFinanceiro);

console.log("Permissões do usuário:", window.permissoes);
