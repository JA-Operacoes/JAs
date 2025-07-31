import { fetchComToken } from '../../utils/utils.js';
// No arquivo aside.js

console.log("entrou✅");

let clienteSelecionado = null;
let nomeClienteSelecionado = '';
let nomeEventoSelecionado = '';
let eventoSelecionado = null; // ✅ NOVO

document.addEventListener("DOMContentLoaded", async function () {
  console.log("Entrou no DOM");

  function temPermissao(modulo, acao) {
    const permissoes = JSON.parse(sessionStorage.getItem("permissoesUsuario") || "[]");

    console.log(`[Permissão] Verificando permissão: módulo="${modulo}", ação="${acao}"`);
    console.log("[Permissão] Permissões disponíveis:", permissoes);

    const resultado = permissoes.some(p => {
      const ehModulo = p.modulo?.toLowerCase() === modulo.toLowerCase();
      const temAcao = p[`pode_${acao}`] === true;

      console.log(`[Permissão] Verificando módulo "${p.modulo}": `, {
        ehModulo,
        temAcao,
        combinado: ehModulo && temAcao
      });

      return ehModulo && temAcao;
    });

    console.log(`[Permissão] Resultado da verificação para "${modulo}" / "${acao}":`, resultado);
    return resultado;
  }

   const btn = document.getElementById("toggle-btn");
  if (btn) {
    btn.addEventListener("click", alternarMenu);
  }

  // Executa a função ao iniciar para garantir estado inicial correto
  alternarMenu();

  carregarClientes("clientes");
  carregarDados("clientes");
  aplicarCliqueNosClientes();
});

// Carregar dados ao carregar a página

function mostrarPainel(tipo) {
  const paineis = document.querySelectorAll('.painel');
  const abas = document.querySelectorAll('.aba');

  paineis.forEach(p => p.classList.remove('ativo'));
  abas.forEach(a => a.classList.remove('ativa'));

  document.getElementById(`painel-${tipo}`)?.classList.add('ativo');
  document.getElementById(`aba-${tipo}`)?.classList.add('ativa');

  if (tipo === 'eventos') {
    if (clienteSelecionado) {
      carregarEventosDoCliente(clienteSelecionado);
    } else {
      Swal.fire("Atenção", "Selecione um cliente primeiro.", "warning");
      return;
    }
  }

  if (tipo === 'orcamento') {
    if (clienteSelecionado && eventoSelecionado) {
      document.getElementById('orcamento-selecionado').textContent =
        `Cliente: ${nomeClienteSelecionado} | Evento: ${nomeEventoSelecionado}`;
      carregarOrcamentos(clienteSelecionado, eventoSelecionado);
    } else {
      Swal.fire("Atenção", "Selecione um evento primeiro.", "warning");
      return;
    }
  }
}

window.navegarParaAba = function(tipo) {
  // 🔄 Limpar seleções ao voltar
  if (tipo === "clientes") {
    // LIMPA CLIENTE
    clienteSelecionado = null;
    nomeClienteSelecionado = '';

    // LIMPA EVENTO
    eventoSelecionado = null;
    nomeEventoSelecionado = '';

    // LIMPA ORÇAMENTO
    sessionStorage.removeItem("orcamentoSelecionado");

    // LIMPA LISTAS DA TELA
    const ulClientes = document.getElementById("lista-dados-clientes");
    const ulEventos = document.getElementById("lista-dados-eventos");
    const ulOrcamento = document.getElementById("lista-dados-orcamento");

    if (ulClientes) ulClientes.innerHTML = "";
    if (ulEventos) ulEventos.innerHTML = "";
    if (ulOrcamento) ulOrcamento.innerHTML = "";
  }

  if (tipo === "eventos") {
    eventoSelecionado = null;
    nomeEventoSelecionado = '';
    sessionStorage.removeItem("orcamentoSelecionado");

    const ulOrcamento = document.getElementById("lista-dados-orcamento");
    if (ulOrcamento) ulOrcamento.innerHTML = "";
  }

  // 🔒 Bloqueia todas as abas inicialmente
  document.querySelectorAll(".aba").forEach(aba => {
    aba.classList.add("desativada");
    aba.style.pointerEvents = "none";
  });

  // ✅ Aba "Clientes" sempre ativa
  document.getElementById("aba-clientes").classList.remove("desativada");
  document.getElementById("aba-clientes").style.pointerEvents = "auto";

  // ✅ Libera "Eventos" se cliente estiver selecionado
  if (clienteSelecionado) {
    document.getElementById("aba-eventos").classList.remove("desativada");
    document.getElementById("aba-eventos").style.pointerEvents = "auto";
  }

  // ✅ Libera "Orçamento" se evento selecionado
  if (clienteSelecionado && eventoSelecionado) {
    document.getElementById("aba-orcamento").classList.remove("desativada");
    document.getElementById("aba-orcamento").style.pointerEvents = "auto";
  }

  // Ativa painel e aba
  document.querySelectorAll(".painel").forEach(p => p.classList.remove("ativo"));
  document.querySelectorAll(".aba").forEach(a => a.classList.remove("ativa"));

  document.getElementById(`painel-${tipo}`)?.classList.add("ativo");
  document.getElementById(`aba-${tipo}`)?.classList.add("ativa");

  // Carregamento específico
  if (tipo === "clientes") carregarClientes();
  if (tipo === "eventos") carregarEventosDoCliente(clienteSelecionado);
  if (tipo === "orcamento") {
    document.getElementById("orcamento-selecionado").textContent =
      `Cliente: ${nomeClienteSelecionado} | Evento: ${nomeEventoSelecionado}`;
    carregarOrcamentos(clienteSelecionado, eventoSelecionado);
  }
};

async function carregarClientes() {
  try {
    const clientes = await fetchComToken('/aside/clientes');

    if (!clientes || clientes.erro === "sessao_expirada") {
      Swal.fire("Sessão expirada", "Por favor, faça login novamente.", "warning");
      return;
    }

    if (!Array.isArray(clientes) || clientes.length === 0) {
      console.warn("Nenhum cliente encontrado.");
      const ul = document.getElementById("lista-dados-clientes");
      ul.innerHTML = "<li>Nenhum cliente encontrado.</li>";
      return;
    }

    const ul = document.getElementById("lista-dados-clientes");
    ul.innerHTML = "";

    clientes.forEach(cliente => {
      const li = document.createElement("li");
      li.textContent = cliente.nmfantasia;

      // Adiciona o atributo data-cliente-id para ser usado depois
      li.setAttribute('data-cliente-id', cliente.idcliente);

      li.addEventListener("click", () => {
        clienteSelecionado = cliente.idcliente;
        nomeClienteSelecionado = cliente.nmfantasia;

        // Visual: destaca cliente selecionado
        ul.querySelectorAll("li").forEach(item => item.classList.remove("selecionado"));
        li.classList.add("selecionado");

        // Atualiza texto da aba Eventos
        document.getElementById("cliente-selecionado").textContent = `Eventos de ${nomeClienteSelecionado}`;
        document.getElementById("aba-eventos").classList.remove("desativada");

        mostrarPainel("eventos");
      });

      ul.appendChild(li);
    });

  } catch (erro) {
    console.error("Erro ao carregar clientes:", erro);
    Swal.fire("Erro", "Não foi possível carregar os clientes.", "error");
  }
}

async function carregarEventosDoCliente(clienteId) {
  try {
    console.log("ID cliente:", clienteId, clienteSelecionado);
    const eventos = await fetchComToken(`aside/eventos?clienteId=${clienteId}`);


    const ul = document.getElementById('lista-dados-eventos');
    ul.innerHTML = '';

    if (!Array.isArray(eventos) || eventos.length === 0) {
      ul.innerHTML = '<li>Nenhum evento com orçamento em aberto</li>';
      return;
    }

    eventos.forEach(evento => {
      const li = document.createElement('li');
      li.textContent = evento.nmevento;

      li.onclick = () => {
        nomeEventoSelecionado = evento.nmevento;
        eventoSelecionado = evento.idevento; // ✅ SALVA o ID
        ativarAbaOrcamento();
        mostrarPainel('orcamento');
      };

      ul.appendChild(li);
    });
  } catch (erro) {
    console.error("Erro ao carregar eventos do cliente:", erro);
    Swal.fire("Erro", "Não foi possível carregar os eventos.", "error");
  }
}

async function carregarOrcamentos(clienteId, eventoId) {
  try {
    const orcamentos = await fetchComToken(`aside/orcamento?clienteId=${clienteId}&eventoId=${eventoId}`);

    const ul = document.getElementById('lista-dados-orcamento');
    ul.innerHTML = '';

    if (!Array.isArray(orcamentos) || orcamentos.length === 0) {
      ul.innerHTML = '<li>Nenhum orçamento encontrado</li>';
      return;
    }

    orcamentos.forEach(orc => {
      const li = document.createElement('li');
      li.textContent = `Orçamento nº ${orc.nrorcamento} | Status: ${orc.status}`;

      li.onclick = () => {
        console.log("🟢 Clique no orçamento:", orc.nrorcamento);

        // Salva o orçamento no sessionStorage
        sessionStorage.setItem("orcamentoSelecionado", JSON.stringify(orc));

        const linkModal = document.querySelector('.abrir-modal[data-modulo="Orcamentos"]');
        if (linkModal) {
          console.log("🟡 Abrindo modal de orçamento...");
          linkModal.click();

          setTimeout(async () => {
            console.log("🔵 Timeout disparado: tentando preencher o modal");

            const input = document.getElementById("nrOrcamento");
            if (input) {
              console.log("🟣 Campo nrOrcamento encontrado. Preenchendo com:", orc.nrorcamento);
              input.value = orc.nrorcamento;
              input.dispatchEvent(new Event('input'));

              try {
                console.log("🟤 Buscando orçamento detalhado via API...");
                const orcamento = await fetchComToken(`orcamentos?nrOrcamento=${orc.nrorcamento}`);

                // 👉 Importação dinâmica do módulo Orcamentos.js
                const moduloOrcamento = await import('./Orcamentos.js');

                console.log("✅ Dados recebidos, preenchendo formulário.");
                moduloOrcamento.preencherFormularioComOrcamento(orcamento);
              } catch (error) {
                console.error("❌ Erro ao buscar orçamento:", error);
                const moduloOrcamento = await import('./Orcamentos.js');
                moduloOrcamento.limparFormularioOrcamento();
                Swal.fire("Erro", `Não foi possível buscar o orçamento ${orc.nrorcamento}.`, "error");
              }
            } else {
              console.warn("⚠️ Campo #nrOrcamento NÃO encontrado dentro do modal.");
            }
          }, 500);
        } else {
          console.error("❌ Botão para abrir o modal não encontrado.");
          Swal.fire("Erro", "Botão para abrir o modal não encontrado.", "error");
        }
      };

      ul.appendChild(li);
    });
  } catch (erro) {
    console.error("❌ Erro ao carregar orçamentos:", erro);
    Swal.fire("Erro", "Não foi possível carregar os orçamentos.", "error");
  }
}


async function carregarDados(tipo) {
  try {
    const json = await fetchComToken(`/${tipo}`);

    if (!Array.isArray(json) || json.length === 0) {
      console.error("Erro ao buscar dados: Nenhum dado encontrado");
      return;
    }

    if (!Array.isArray(json) || json.length === 0) {
      console.error("Erro ao buscar dados: Nenhum dado encontrado");
      return;
    }

    const ul = document.getElementById(`lista-dados-${tipo}`);
    ul.innerHTML = '';

    json.forEach(item => {
      const li = document.createElement('li');

      if (tipo === 'clientes') {
        li.textContent = item.nmfantasia;
        li.onclick = () => {
          clienteSelecionado = item.idcliente;
          nomeClienteSelecionado = item.nmfantasia;

          document.getElementById('cliente-selecionado').textContent = `Eventos de ${nomeClienteSelecionado}`;
          document.getElementById('aba-eventos').classList.remove('desativada');
          mostrarPainel('eventos');
        };
      } else {
        li.textContent = item.titulo;
        li.onclick = () => {
          nomeEventoSelecionado = item.titulo;
          ativarAbaOrcamento();
          mostrarPainel('orcamento');
        };
      }

      ul.appendChild(li);
    });
  } catch (error) {
    console.error("Erro ao buscar dados:", error);
  }
}

function ativarAbaOrcamento() {
  const abaOrcamento = document.getElementById('aba-orcamento');
  abaOrcamento.classList.remove('desativada');
  abaOrcamento.style.pointerEvents = 'auto';
}

function alternarMenu() {
  const wrapper = document.getElementById("wrapper");
  const btn = document.getElementById("toggle-btn");

  const estaFechado = wrapper.classList.toggle("menu-fechado");
  btn.innerHTML = estaFechado ? "»" : "«";
}

function aplicarCliqueNosClientes() {
  var clientes = document.querySelectorAll('#lista-dados-clientes li');

  for (var i = 0; i < clientes.length; i++) {
    clientes[i].addEventListener('click', function () {
      var clienteId = this.getAttribute('data-cliente-id');
      carregarEventosDoCliente(clienteId);
    });
  }
}



