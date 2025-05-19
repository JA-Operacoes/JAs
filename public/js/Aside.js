// let clienteSelecionado = null;
// let nomeClienteSelecionado = '';
// let nomeEventoSelecionado = '';

// // Carregar dados ao carregar a página
// window.onload = () => carregarDados('clientes');

// function mostrarPainel(tipo) {
//   const paineis = document.querySelectorAll('.painel');
//   const abas = document.querySelectorAll('.aba');

//   paineis.forEach(p => p.classList.remove('ativo'));
//   abas.forEach(a => a.classList.remove('ativa'));

//   document.getElementById(`painel-${tipo}`).classList.add('ativo');
//   document.getElementById(`aba-${tipo}`).classList.add('ativa');

//   if (tipo === 'eventos' && clienteSelecionado) {
//     carregarEventosDoCliente(clienteSelecionado);
//   } else if (tipo === 'orcamento') {
//     const info = document.getElementById('orcamento-info');
//     info.textContent = `Cliente: ${nomeClienteSelecionado} | Evento: ${nomeEventoSelecionado}`;
//   }
// }

// async function carregarDados(tipo) {
//   try {
//     const resposta = await fetch(`http://localhost:3000/${tipo}`);
//     const json = await resposta.json();
//     console.log("Json", json);

//     if (!Array.isArray(json) || json.length === 0) {
//       console.error("Erro ao buscar dados: Nenhum dado encontrado");
//       return;
//     }

//     const ul = document.getElementById(`lista-dados-${tipo}`);
//     ul.innerHTML = '';

//     json.forEach(item => {
//       const li = document.createElement('li');

//       if (tipo === 'clientes') {
//         li.textContent = item.nmfantasia;
//         li.onclick = () => {
//           clienteSelecionado = item.idcliente;
//           nomeClienteSelecionado = item.nmfantasia;

//           // Exibir nome do cliente na aba de eventos
//           document.getElementById('cliente-selecionado').textContent = `Eventos de ${nomeClienteSelecionado}`;

//           // Habilitar aba de eventos
//           document.getElementById('aba-eventos').classList.remove('desativada');

//           // Mostrar aba de eventos e carregar os dados
//           mostrarPainel('eventos');
//         };
//       } else {
//         li.textContent = item.titulo;
//         li.onclick = () => {
//           nomeEventoSelecionado = item.titulo;
//           ativarAbaOrcamento();
//           mostrarPainel('orcamento');
//         };
//       }

//       ul.appendChild(li);
//     });
//   } catch (error) {
//     console.error("Erro ao buscar dados:", error);
//   }
// }

// async function carregarEventosDoCliente(idCliente) {
//   try {
//     const resposta = await fetch(`http://localhost:3000/eventos?clienteId=${idCliente}`);
//     const json = await resposta.json();
//     console.log("Eventos:", json);

//     const ul = document.getElementById('lista-dados-eventos');
//     ul.innerHTML = '';

//     if (!Array.isArray(json) || json.length === 0) {
//       const li = document.createElement('li');
//       li.textContent = 'Nenhum evento encontrado.';
//       ul.appendChild(li);
//       return;
//     }

//     json.forEach(evento => {
//       const li = document.createElement('li');
//       li.textContent = evento.titulo;
//       li.onclick = () => {
//         nomeEventoSelecionado = evento.titulo;
//         ativarAbaOrcamento();
//         mostrarPainel('orcamento');
//       };
//       ul.appendChild(li);
//     });
//   } catch (error) {
//     console.error("Erro ao carregar eventos:", error);
//   }
// }

// function ativarAbaOrcamento() {
//   const abaOrcamento = document.getElementById('aba-orcamento');
//   abaOrcamento.classList.remove('desativada');
//   abaOrcamento.style.pointerEvents = 'auto';
// }

// // Função para alternar o menu lateral
// function alternarMenu() {
//   const wrapper = document.getElementById("wrapper");
//   const btn = document.getElementById("toggle-btn");

//   wrapper.classList.toggle("menu-fechado");

//   if (wrapper.classList.contains("menu-fechado")) {
//     btn.innerHTML = "»";
//   } else {
//     btn.innerHTML = "«";
//   }
// }

// Adicione no topo do arquivo
function fetchComToken(url, options = {}) {
  const token = localStorage.getItem("token");
  return fetch(url, {
    ...options,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
}

let clienteSelecionado = null;
let nomeClienteSelecionado = '';
let nomeEventoSelecionado = '';

// Carregar dados ao carregar a página
window.onload = () => {
  const token = localStorage.getItem("token");
  const permissoes = JSON.parse(sessionStorage.getItem("permissoesUsuario") || "[]");

  const podePesquisarClientes = permissoes.some(p => p.modulo === "Clientes" && p.pesquisar);

  if (token && podePesquisarClientes) {
    carregarDados('clientes');
  } else {
    // Se não pode pesquisar, esconde a seção inteira do aside
    const painelClientes = document.getElementById("painel-clientes");
    const abaClientes = document.getElementById("aba-clientes");

    if (painelClientes) painelClientes.style.display = "none";
    if (abaClientes) abaClientes.style.display = "none";
  }
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
    
    // const resposta = await fetchComToken(`http://localhost:3000/${tipo}`);
     const resposta = await fetchComToken(`{tipo}`);
    if (resposta.status === 401) {
      mostrarErro("Sessão expirada", "Por favor, faça login novamente.");
      return;
    }
    

    const json = await resposta.json();
    console.log("Json", json);

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

async function carregarEventosDoCliente(idCliente) {
  try {
    
    // const resposta = await fetchComToken(`http://localhost:3000/eventos?clienteId=${idCliente}`);
    const resposta = await fetchComToken(`/eventos?clienteId=${idCliente}`);
    
    if (resposta.status === 401) {
      mostrarErro("Sessão expirada", "Por favor, faça login novamente.");
      return;
    }

    const json = await resposta.json();
    console.log("Eventos:", json);

    const ul = document.getElementById('lista-dados-eventos');
    ul.innerHTML = '';

    if (!Array.isArray(json) || json.length === 0) {
      const li = document.createElement('li');
      li.textContent = 'Nenhum evento encontrado.';
      ul.appendChild(li);
      return;
    }

    json.forEach(evento => {
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

function alternarMenu() {
  const wrapper = document.getElementById("wrapper");
  const btn = document.getElementById("toggle-btn");

  wrapper.classList.toggle("menu-fechado");

  btn.innerHTML = wrapper.classList.contains("menu-fechado") ? "»" : "«";
}
