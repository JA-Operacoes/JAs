// // // Simulação de dados
// // import {aplicarTema } from '../utils/utils.js';

// // const usuario = {
// //   nome: "Gustavo",
// //   permissoes: ["financeiro"], // pode ser ["financeiro", "master"] ou []
// // };

// // const dadosResumo = {
// //   orcamentos: 12,
// //   eventos: 8,
// //   clientes: 25,
// //   pedidos: 4
// // };

// // const atividadesRecentes = [
// //   { usuario:"Ana", acao:"Criou orçamento #123", data:"01/09/2025 14:32" },
// //   { usuario:"Pedro", acao:"Alterou item em orçamento #120", data:"01/09/2025 13:10" },
// //   { usuario:"Maria", acao:"Aprovou orçamento #118", data:"31/08/2025 16:45" }
// // ];

// // const notificacoesFinanceiras = [
// //   { descricao:"Pedido de bônus de João", tipo:"bônus" },
// //   { descricao:"Pedido de caixinha de Maria", tipo:"caixinha" },
// //   { descricao:"Meia diária de Pedro", tipo:"meia diária" }
// // ];

// // // Atualiza cards de resumo
// // document.getElementById("orcamentos").textContent = dadosResumo.orcamentos;
// // document.getElementById("eventos").textContent = dadosResumo.eventos;
// // document.getElementById("clientes").textContent = dadosResumo.clientes;
// // document.getElementById("pedidos").textContent = dadosResumo.pedidos;
// // document.getElementById("pedidosPendentes").textContent = dadosResumo.pedidos;

// // // Preenche tabela de atividades

// // function atualizarOrcamentos(pendentes, fechados) {
// //   const total = pendentes + fechados;
// //   document.getElementById("orcamentosTotal").textContent = total;
// //   document.getElementById("orcamentosPendentes").textContent = pendentes;
// //   document.getElementById("orcamentosFechados").textContent = fechados;
// // }

// // // Exemplo de uso:
// // atualizarOrcamentos(8, 15);

// // function atualizarProximoEvento(eventosFechados) {
// //   if (!eventosFechados || eventosFechados.length === 0) {
// //     document.getElementById("proximoEventoNome").textContent = "Nenhum evento encontrado";
// //     document.getElementById("proximoEventoTempo").textContent = "--";
// //     return;
// //   }

// //   // Ordena pelo início mais próximo
// //   const hoje = new Date();
// //   const proximos = eventosFechados
// //     .map(e => ({ ...e, data: new Date(e.data_inicio) }))
// //     .filter(e => e.data >= hoje)
// //     .sort((a, b) => a.data - b.data);

// //   if (proximos.length === 0) {
// //     document.getElementById("proximoEventoNome").textContent = "Nenhum evento futuro";
// //     document.getElementById("proximoEventoTempo").textContent = "--";
// //     return;
// //   }

// //   const evento = proximos[0];
// //   const diffMs = evento.data - hoje;
// //   const diffDias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

// //   document.getElementById("proximoEventoNome").textContent = evento.nome;
// //   document.getElementById("proximoEventoTempo").textContent = `Faltam ${diffDias} dias`;
// // }

// // // Exemplo de uso (eventos vindos do backend)
// // const eventosFechadosExemplo = [
// //   { nome: "Show Sertanejo", data_inicio: "2025-09-10" },
// //   { nome: "Congresso Tech", data_inicio: "2025-09-20" },
// // ];

// // atualizarProximoEvento(eventosFechadosExemplo);

// // function atualizarAtividadesUsuario(usuarioId, dataFiltro = null) {
// //   let url = `/api/atividades/usuario/${usuarioId}`;
// //   if (dataFiltro) {
// //     url += `?data=${dataFiltro}`;
// //   }

// //   fetch(url)
// //     .then(res => res.json())
// //     .then(data => {
// //       const lista = document.getElementById("listaAtividadesUsuario");
// //       lista.innerHTML = "";

// //       data.forEach(ativ => {
// //         const li = document.createElement("li");
// //         li.innerHTML = `<span>${ativ.acao}</span><span>${new Date(ativ.data).toLocaleString()}</span>`;
// //         lista.appendChild(li);
// //       });
// //     })
// //     .catch(err => console.error("Erro ao carregar atividades do usuário:", err));
// // }

// // // Exemplo: usuário logado
// // const usuarioLogadoId = 1;
// // atualizarAtividadesUsuario(usuarioLogadoId);

// // // Filtrar por data
// // document.getElementById("filtroData").addEventListener("change", function() {
// //   atualizarAtividadesUsuario(usuarioLogadoId, this.value);
// // });


// // // Verifica permissões e mostra notificações financeiras se autorizado
// // if(usuario.permissoes.includes("financeiro") || usuario.permissoes.includes("master")) {
// //   document.getElementById("notificacoesFinanceiras").style.display = "block";
// //   const lista = document.getElementById("listaNotificacoes");
// //   notificacoesFinanceiras.forEach(n => {
// //     const div = document.createElement("div");
// //     div.className = "notificacao";
// //     div.innerHTML = `<span>${n.descricao}</span>
// //                      <div>
// //                        <button class="aprovar">Aprovar</button>
// //                        <button class="rejeitar">Rejeitar</button>
// //                      </div>`;
// //     lista.appendChild(div);
// //   });
// // }


import { fetchComToken, aplicarTema } from '../utils/utils.js';

// Função para obter o idempresa do localStorage
function getIdEmpresa() {
  return localStorage.getItem("idempresa");
}

// Função para buscar resumo dos cards
async function buscarResumo() {
  // const resposta = await fetchComToken("/main"); 
  // if (!resposta.ok) {
  //   throw new Error("Erro ao buscar resumo: " + resposta.status);
  // }
  // return await resposta.json(); 
}

// Função para buscar atividades recentes
async function buscarAtividadesRecentes() {
  // const resposta = await fetchComToken(`/Main/atividades-recentes`, {
  //   headers: { idempresa: getIdEmpresa() }
  // });
  // return resposta.json();
}

// Função para buscar notificações financeiras
async function buscarNotificacoesFinanceiras() {
  // const resposta = await fetchComToken(`/Main/notificacoes-financeiras`, {
  //   headers: { idempresa: getIdEmpresa() }
  // });
  // return resposta.json();
}

// Atualiza cards de resumo
async function atualizarResumo() {
  const dadosResumo = await buscarResumo();
  // document.getElementById("orcamentos").textContent = dadosResumo.orcamentos;
  // document.getElementById("eventos").textContent = dadosResumo.eventos;
  // document.getElementById("clientes").textContent = dadosResumo.clientes;
  // document.getElementById("pedidos").textContent = dadosResumo.pedidos;
  // document.getElementById("pedidosPendentes").textContent = dadosResumo.pedidosPendentes;
}

// Preenche tabela de atividades
async function atualizarAtividades() {
  // const atividades = await buscarAtividadesRecentes();
  // const lista = document.getElementById("listaAtividadesUsuario");
  // lista.innerHTML = "";
  // atividades.forEach(ativ => {
  //   const li = document.createElement("li");
  //   li.innerHTML = `<span>${ativ.acao}</span><span>${new Date(ativ.data).toLocaleString()}</span>`;
  //   lista.appendChild(li);
  // });
}

// Notificações financeiras
async function atualizarNotificacoesFinanceiras() {
  // const usuario = JSON.parse(localStorage.getItem("usuario"));
  // if (usuario.permissoes.includes("financeiro") || usuario.permissoes.includes("master")) {
  //   document.getElementById("notificacoesFinanceiras").style.display = "block";
  //   const notificacoes = await buscarNotificacoesFinanceiras();
  //   const lista = document.getElementById("listaNotificacoes");
  //   lista.innerHTML = "";
  //   notificacoes.forEach(n => {
  //     const div = document.createElement("div");
  //     div.className = "notificacao";
  //     div.innerHTML = `<span>${n.descricao}</span>
  //                      <div>
  //                        <button class="aprovar">Aprovar</button>
  //                        <button class="rejeitar">Rejeitar</button>
  //                      </div>`;
  //     lista.appendChild(div);
  //   });
  // }
}

// Inicialização
document.addEventListener("DOMContentLoaded", async function () {
  await atualizarResumo();
  await atualizarAtividades();
  await atualizarNotificacoesFinanceiras();
  // ... outras inicializações ...
});