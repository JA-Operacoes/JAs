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

    // Monta tabela
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
        <td><pre>${ativ.dadosanteriores}</pre></td>
        <td><pre>${ativ.dadosnovos }</pre></td>
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

  // Agrupa pedidos por funcionário
  const funcionariosMap = {};
  pedidos.forEach(p => {
    if (!funcionariosMap[p.funcionario]) funcionariosMap[p.funcionario] = [];
    funcionariosMap[p.funcionario].push(p);
  });

  Object.keys(funcionariosMap).forEach(funcNome => {
    const pedidosFunc = funcionariosMap[funcNome];

    // Contar número total de categorias
    let totalCategorias = 0;
    pedidosFunc.forEach(p => {
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

    pedidosFunc.forEach(pedido => {
      const campos = ["statusajustecusto", "statuscaixinha", "statusmeiadiaria", "statusdiariadobrada"];

      campos.forEach(campo => {
        if (!pedido[campo]) return;

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
    lista.appendChild(divFuncionario);
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
