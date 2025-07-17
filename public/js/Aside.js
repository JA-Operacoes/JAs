import { fetchComToken } from '../../utils/utils.js';
console.log("entrou✅");

let clienteSelecionado = null;
let nomeClienteSelecionado = '';
let nomeEventoSelecionado = '';
let eventoSelecionado = null; // ✅ NOVO

function mostrarPainel(tipo) {
  const paineis = document.querySelectorAll('.painel');
  const abas = document.querySelectorAll('.aba');

  paineis.forEach(p => p.classList.remove('ativo'));
  abas.forEach(a => a.classList.remove('ativa'));

  document.getElementById(`painel-${tipo}`)?.classList.add('ativo');
  document.getElementById(`aba-${tipo}`)?.classList.add('ativa');

  if (tipo === 'eventos' && clienteSelecionado) {
    carregarEventosDoCliente(clienteSelecionado);
  } else if (tipo === 'orcamento') {
    const info = document.getElementById('orcamento-selecionado');
    if (clienteSelecionado && eventoSelecionado) {
      carregarOrcamentos(clienteSelecionado, eventoSelecionado); // ✅ CORRETO
    }
    if (info) {
      info.textContent = `Cliente: ${nomeClienteSelecionado} | Evento: ${nomeEventoSelecionado}`;
    }
  }
}

async function carregarClientes() {
  try {
    const clientes = await fetchComToken('/clientes');

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

async function carregarOrcamentos(clienteId, idevento) {
  try {
    const url = `/orcamentos?clienteId=${clienteId}&eventoId=${idevento}`;
    const orcamentos = await fetchComToken(url);

    const ul = document.getElementById('lista-dados-orcamentos');
    ul.innerHTML = '';

    if (!Array.isArray(orcamentos) || orcamentos.length === 0) {
      ul.innerHTML = '<li>Nenhum orçamento encontrado</li>';
      return;
    }

    orcamentos.forEach(orc => {
      const li = document.createElement('li');
      li.textContent = `Orçamento nº ${orc.nrorcamento} | Status: ${orc.status}`;

      li.onclick = () => {
        // Aqui você pode definir ações, como preencher o formulário
        preencherFormularioComOrcamento(orc);
        mostrarPainel('orcamento');
      };

      ul.appendChild(li);
    });
  } catch (erro) {
    console.error("Erro ao carregar orçamentos:", erro);
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

  wrapper.classList.toggle("menu-fechado");

  btn.innerHTML = wrapper.classList.contains("menu-fechado") ? "»" : "«";
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
