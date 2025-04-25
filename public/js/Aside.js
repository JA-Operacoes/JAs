async function carregarDados(tipo) {
  try {
    const resposta = await fetch(`http://localhost:3000/api/${tipo}`);
    const json = await resposta.json();

    if (!json.success || !json.data) {
      console.error("Erro ao buscar dados:", json.erro || 'Sem dados');
      return;
    }

    const dados = json.data;
    const ul = document.getElementById(tipo === 'clientes' ? 'lista-dados' : 'lista-dados-eventos');
    const destaque = document.getElementById(tipo === 'clientes' ? 'destaque-cliente' : 'destaque-evento');

    ul.innerHTML = '';
    destaque.innerHTML = dados.length > 0
      ? (tipo === 'clientes' ? dados[0].nmfantasia : dados[0].titulo)
      : 'Nenhum dado encontrado';

    dados.forEach(item => {
      const li = document.createElement('li');
      li.textContent = tipo === 'clientes' ? item.nmfantasia : item.titulo;
      ul.appendChild(li);
    });
  } catch (error) {
    console.error("Erro ao buscar dados:", error);
  }
}


window.onload = () => carregarDados(tipoAtual);

// ------------------------------------------------------------ teste---------------------------------------

let clienteSelecionado = null;
let nomeClienteSelecionado = '';
let nomeEventoSelecionado = '';

window.onload = () => {
  carregarDados('clientes');
};

function mostrarPainel(tipo) {
  const paineis = document.querySelectorAll('.painel');
  const abas = document.querySelectorAll('.aba');

  paineis.forEach(p => p.classList.remove('ativo'));
  abas.forEach(a => a.classList.remove('ativa'));

  document.getElementById(`painel-${tipo}`).classList.add('ativo');
  document.getElementById(`aba-${tipo}`).classList.add('ativa');

  if (tipo === 'eventos' && clienteSelecionado) {
    carregarEventosDoCliente(clienteSelecionado);
  } else if (tipo === 'orcamento') {
    const info = document.getElementById('orcamento-info');
    info.textContent = `Cliente: ${nomeClienteSelecionado} | Evento: ${nomeEventoSelecionado}`;
  }
}

async function carregarDados(tipo) {
  try {
    const resposta = await fetch(`http://localhost:3000/api/${tipo}`);
    const json = await resposta.json();

    if (!json.success || !json.data) {
      console.error("Erro ao buscar dados:", json.erro || 'Sem dados');
      return;
    }

    const ul = document.getElementById(`lista-dados-${tipo}`);
    ul.innerHTML = '';

    json.data.forEach(item => {
      const li = document.createElement('li');
      if (tipo === 'clientes') {
        li.textContent = item.nmfantasia;
        li.onclick = () => {
          clienteSelecionado = item.id;
          nomeClienteSelecionado = item.nmfantasia;
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

async function carregarEventosDoCliente(idCliente) {
  try {
    const resposta = await fetch(`http://localhost:3000/api/eventos?clienteId=${idCliente}`);
    const json = await resposta.json();

    const ul = document.getElementById('lista-dados-eventos');
    ul.innerHTML = '';

    document.getElementById('cliente-selecionado').textContent = nomeClienteSelecionado;

    if (!json.success || !json.data || json.data.length === 0) {
      const li = document.createElement('li');
      li.textContent = 'Nenhum evento encontrado.';
      ul.appendChild(li);
      return;
    }

    json.data.forEach(evento => {
      const li = document.createElement('li');
      li.textContent = evento.titulo;
      li.onclick = () => {
        nomeEventoSelecionado = evento.titulo;
        ativarAbaOrcamento();
        mostrarPainel('orcamento');
      };
      ul.appendChild(li);
    });
  } catch (error) {
    console.error("Erro ao carregar eventos:", error);
  }
}

function ativarAbaOrcamento() {
  const abaOrcamento = document.getElementById('aba-orcamento');
  abaOrcamento.classList.remove('desativada');
  abaOrcamento.style.pointerEvents = 'auto';
}


// ---------------------------------------- SIDEBAR BUTTON ---------------------------------------------------------
function alternarMenu() {
  const wrapper = document.getElementById("wrapper");
  const btn = document.getElementById("toggle-btn");

  wrapper.classList.toggle("menu-fechado");

  // Troca a seta visual
  if (wrapper.classList.contains("menu-fechado")) {
    btn.innerHTML = "»";
  } else {
    btn.innerHTML = "«";
  }
}

