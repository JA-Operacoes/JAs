import "https://cdn.jsdelivr.net/npm/flatpickr@latest/dist/flatpickr.min.js";
import "https://cdn.jsdelivr.net/npm/flatpickr@latest/dist/l10n/pt.js";


import { fetchComToken, aplicarTema } from "../utils/utils.js";

document.addEventListener("DOMContentLoaded", function () {
  const idempresa = localStorage.getItem("idempresa");

  if (idempresa) {
    const apiUrl = `/empresas/${idempresa}`; // Verifique o caminho da sua API

    fetchComToken(apiUrl)
      .then((empresa) => {
        // Usa o nome fantasia como tema
        const tema = empresa.nmfantasia;
        aplicarTema(tema);
      })
      .catch((error) => {
        console.error("❌ Erro ao buscar dados da empresa para o tema:", error);
        // aplicarTema('default');
      });
  }

  // Gerenciar botões baseado no status inicial
  const statusInput = document.getElementById("Status");
  gerenciarBotoesProposta(statusInput);
});
let idMontagemChangeListener = null;
let statusInputListener = null;
let edicaoInputListener = null;
let nrOrcamentoInputListener = null;
let nrOrcamentoBlurListener = null;
let btnAdicionarLinhaListener = null;
let btnAdicionarLinhaAdicionalListener = null;
let globalDescontoValorInputListener = null;
let globalDescontoValorBlurListener = null;
let globalDescontoPercentualInputListener = null;
let globalDescontoPercentualBlurListener = null;
let globalAcrescimoValorInputListener = null;
let globalAcrescimoValorBlurListener = null;
let globalAcrescimoPercentualInputListener = null;
let globalAcrescimoPercentualBlurListener = null;
let percentualImpostoInputListener = null;
let btnEnviarListener = null;
let btnLimparListener = null;
let percentualCtoFixoInputListener = null;
let isCleaning = false; 
//importado no inicio do js pois deve ser importado antes do restante do codigo

const fp = window.flatpickr;
const currentLocale = fp.l10ns.pt || fp.l10ns.default;

if (!currentLocale) {
  console.error(
    "Flatpickr locale 'pt' não carregado. Verifique o caminho do arquivo."
  );
} else {
  fp.setDefaults({
    locale: currentLocale,
  });
  //  console.log("Flatpickr locale definido para Português.");
}
//fim do tratamento do flatpickr

let locaisDeMontagem = [];

let flatpickrInstances = {};

let flatpickrInstancesOrcamento = [];

if (typeof window.hasRegisteredChangeListenerForAjdCusto === "undefined") {
  window.hasRegisteredChangeListenerForAjdCusto = false;
}

const commonFlatpickrOptions = {
  mode: "range",
  dateFormat: "d/m/Y",
  altInput: true, // Se quiser altInput para os da tabela também
  altFormat: "d/m/Y",
  //locale: flatpickr.l10ns.pt,
  locale: currentLocale,
  appendTo: document.body, // Certifique-se de que 'modal-flatpickr-container' existe e é o elemento correto
};

const commonFlatpickrOptionsTable = {
  mode: "range",
  dateFormat: "d/m/Y",
  altInput: true, // Se quiser altInput para os da tabela também
  altFormat: "d/m/Y",
  //locale: flatpickr.l10ns.pt,
  locale: currentLocale,
  appendTo: document.body, // Certifique-se de que 'modal-flatpickr-container' existe e é o elemento correto
  onChange: function (selectedDates, dateStr, instance) {
    // Isso garantirá que sua lógica de cálculo de dias e atualização do input
    // seja chamada para QUALQUER Flatpickr que use estas opções.
    atualizarQtdDias(instance.element, selectedDates);
  },
};

let idCliente;
let idEvento;
let idMontagem;
let idFuncao;
let idPavilhao;
let Categoria = "";
let idEquipamento = "";
let idSuprimento = "";
let vlrAlimentacao = 0;
let vlrTransporte = 0;
let funcoesDisponiveis = [];

let lastEditedFieldType = null; // 'valor' ou 'percentual'
let isRecalculatingDiscountAcrescimo = false;

let lastEditedGlobalFieldType = null; // 'valor' ou 'percentual' para os campos globais
let isRecalculatingGlobalDiscountAcrescimo = false;

let bProximoAno = false;
let idOrcamentoOriginalParaAtualizar = null;
let anoProximoOrcamento = null;
let GLOBAL_PERCENTUAL_GERAL = 0; // Para Custo/Venda
let GLOBAL_PERCENTUAL_AJUDA = 0; // Para Alimentação/Transporte

let nrOrcamentoOriginal = "";
let mensagemReajuste = "";

let selects = document.querySelectorAll(
  ".idFuncao, .idEquipamento, .idSuprimento, .idPavilhao"
);
selects.forEach((select) => {
  select.addEventListener("change", atualizaProdutoOrc);
});

const selectFuncao = document.getElementById("selectFuncao");
if (selectFuncao) {
  selectFuncao.addEventListener("change", function () {
    resetarOutrosSelectsOrc(selectFuncao); // Reseta outros selects quando este é alterado
  });
}
const selectEquipamento = document.getElementById("selectEquipamento");
if (selectEquipamento) {
  selectEquipamento.addEventListener("change", function () {
    resetarOutrosSelectsOrc(selectEquipamento); // Reseta outros selects quando este é alterado
  });
}
const selectSuprimento = document.getElementById("selectSuprimento");
if (selectSuprimento) {
  selectSuprimento.addEventListener("change", function () {
    resetarOutrosSelectsOrc(selectSuprimento); // Reseta outros selects quando este é alterado
  });
}

// function atualizarOuCriarCampoTexto(nmFantasia, texto) {
//     const campo = document.getElementById(nmFantasia);
//     if (campo) {
//         campo.textContent = texto || "";
//     } else {
//         console.warn(`Elemento com NomeFantasia '${nmFantasia}' não encontrado.`);
//     }
// }

// // Busca por nome fantasia
// async function buscarEExibirDadosClientePorNome(nmFantasia) {
//     try {
//         const dadosCliente = await fetchComToken(`orcamentos/clientes?nmFantasia=${encodeURIComponent(nmFantasia)}`);

//         // if (!dadosCliente.ok) {
//         //     throw new Error(`Erro ao buscar dados do cliente: ${dadosCliente.status}`);
//         // }

//        // const dadosCliente = await response.json();

//         console.log("Cliente selecionado! Dados:", {
//             nome: dadosCliente.nmcontato,
//             celular: dadosCliente.celcontato,
//             email: dadosCliente.emailcontato
//         });

//         // atualizarOuCriarCampoTexto("nmContato", dadosCliente.nmcontato);
//         // atualizarOuCriarCampoTexto("celContato", dadosCliente.celcontato);
//         // atualizarOuCriarCampoTexto("emailContato", dadosCliente.emailcontato);

//     } catch (error) {
//         console.error("Erro ao buscar dados do cliente:", error);
//         Swal.fire("Erro", "Erro ao buscar dados do cliente", "error");

//         atualizarOuCriarCampoTexto("nmContato", "");
//         atualizarOuCriarCampoTexto("celContato", "");
//         atualizarOuCriarCampoTexto("emailContato", "");
//     }
// }

async function carregarClientesOrc() {
  try {
    const clientes = await fetchComToken("orcamentos/clientes");

    console.log("Clientes recebidos:", clientes);

    let selects = document.querySelectorAll(".idCliente");

    selects.forEach((select) => {
      const valorSelecionadoAtual = select.value;
      select.innerHTML = '<option value="">Selecione Cliente</option>';

      clientes.forEach((cliente) => {
        let option = document.createElement("option");
        option.value = cliente.idcliente;
        option.textContent = cliente.nmfantasia;

        select.appendChild(option);
      });

      if (valorSelecionadoAtual) {
        select.value = String(valorSelecionadoAtual);
      }

      select.addEventListener("change", function () {
        idCliente = this.value; // O value agora é o ID
        console.log("idCliente selecionado:", idCliente);
      });
    });
  } catch (error) {
    console.error("Erro ao carregar clientes:", error);
  }
}

async function carregarEventosOrc() {
  try {
    const eventos = await fetchComToken("/orcamentos/eventos");

    let selects = document.querySelectorAll(".idEvento");

    selects.forEach((select) => {
      select.innerHTML = '<option value="">Selecione Evento</option>'; // Adiciona a opção padrão
      eventos.forEach((evento) => {
        let option = document.createElement("option");

        option.value = evento.idevento; // Atenção ao nome da propriedade (idMontagem)
        option.textContent = evento.nmevento;
        option.setAttribute("data-nmevento", evento.nmevento);
        option.setAttribute("data-idEvento", evento.idevento);
        select.appendChild(option);
      });

      select.addEventListener("change", function () {
        idEvento = this.value;
      });
    });
  } catch (error) {
    console.error("Erro ao carregar eventos:", error);
  }
}

// Função para carregar os locais de montagem
async function carregarLocalMontOrc() {
  try {
    const montagem = await fetchComToken("/orcamentos/localmontagem");

    let selects = document.querySelectorAll(".idMontagem");

    selects.forEach((select) => {
      // Adiciona as opções de Local de Montagem
      select.innerHTML =
        '<option value="">Selecione Local de Montagem</option>'; // Adiciona a opção padrão
      montagem.forEach((local) => {
        let option = document.createElement("option");

        option.value = local.idmontagem;
        option.textContent = local.descmontagem;
        option.setAttribute("data-idMontagem", local.idmontagem);
        option.setAttribute("data-descmontagem", local.descmontagem);
        option.setAttribute("data-ufmontagem", local.ufmontagem);
        select.appendChild(option);

        locaisDeMontagem = montagem;
      });
      select.addEventListener("change", function () {
        //idMontagem = this.value; // O value agora é o ID

        const selectedOption = this.options[this.selectedIndex];

        document.getElementById("idMontagem").value =
          selectedOption.getAttribute("data-idMontagem");

        idMontagem = selectedOption.value;
        console.log("IDLOCALMONTAGEM selecionado:", idMontagem);

        carregarPavilhaoOrc(idMontagem);
      });
    });
  } catch (error) {
    console.error("Erro ao carregar localmontagem:", error);
  }
}

let selectedPavilhoes = [];

function updatePavilhaoDisplayInputs() {
  const container = document.getElementById("pavilhoesSelecionadosContainer");
  const idsInput = document.getElementById("idsPavilhoesSelecionados");

  // 1. Limpa o contêiner de tags
  container.innerHTML = "";

  // 2. Preenche o contêiner e cria as tags
  selectedPavilhoes.forEach((pavilhao) => {
    const tag = document.createElement("span");
    tag.classList.add("pavilhao-tag");
    tag.innerHTML = `
            ${pavilhao.name}
            <button type="button" class="remover-pavilhao-btn" data-id="${pavilhao.id}">&times;</button>
        `;
    container.appendChild(tag);
  });

  // 3. Adiciona o listener de click para os botões de remover
  const removerBotoes = container.querySelectorAll(".remover-pavilhao-btn");
  removerBotoes.forEach((botao) => {
    botao.addEventListener("click", function (event) {
      const idPavilhao = parseInt(event.target.dataset.id, 10);

      // Filtra o array selectedPavilhoes para remover o item clicado
      selectedPavilhoes = selectedPavilhoes.filter((p) => p.id !== idPavilhao);

      // Recarrega a exibição dos inputs
      updatePavilhaoDisplayInputs();
    });
  });

  // 4. Atualiza o input hidden com a string JSON correta
  const idsParaOInput = selectedPavilhoes.map((p) => p.id);
  idsInput.value = JSON.stringify(idsParaOInput);
}

async function carregarPavilhaoOrc(idMontagem) {
  selectedPavilhoes = [];
  updatePavilhaoDisplayInputs();

  if (!idMontagem || idMontagem === "") {
    console.warn("ID da Montagem está vazio, não carregando pavilhões.");
    // Opcional: Limpe o select de pavilhão aqui, se ele tiver opções antigas
    const idPavilhaoSelect = document.querySelector(".idPavilhao");
    if (idPavilhaoSelect) {
      idPavilhaoSelect.innerHTML =
        '<option value="">Selecione um Pavilhão</option>';
    }
    selectedPavilhoes = [];
    updatePavilhaoDisplayInputs();

    // Limpar datalist do setor
    const datalist = document.getElementById("datalist-setor");
    if (datalist) datalist.innerHTML = "";

    return; // Não faça a requisição se idMontagem for vazio
  }

  try {
    const pavilhoes = await fetchComToken(
      `/orcamentos/pavilhao?idmontagem=${idMontagem}`
    );
    console.log("Pavilhões recebido:", pavilhoes);

    const selecionarPavilhaoSelect =
      document.getElementById("selecionarPavilhao"); // Use o ID correto do seu select
    if (selecionarPavilhaoSelect) {
      selecionarPavilhaoSelect.innerHTML =
        '<option value="">Selecione para Adicionar</option>'; // Adiciona a opção padrão
      pavilhoes.forEach((localpav) => {
        let option = document.createElement("option");
        option.value = localpav.idpavilhao;
        option.textContent = localpav.nmpavilhao;
        // Os data-attributes são úteis, mas para o que você quer, basta o value e textContent
        // option.setAttribute("data-idpavilhao", localpav.idpavilhao);
        // option.setAttribute("data-nmpavilhao", localpav.nmpavilhao);
        selecionarPavilhaoSelect.appendChild(option);
      });
      // O event listener agora será adicionado uma vez, fora desta função, no DOMContentLoaded
    }

    // Atualizar datalist do setor
    atualizarDatalistSetor(idMontagem);
  } catch (error) {
    console.error("Erro ao carregar pavilhao:", error);
    Swal.fire("Erro", "Não foi possível carregar os pavilhões.", "error");
  }
}

async function atualizarDatalistSetor(idMontagem) {
  const datalist = document.getElementById("datalist-setor");
  if (!datalist) return;

  datalist.innerHTML = ""; // Limpar opções anteriores

  if (!idMontagem || idMontagem === "") {
    return;
  }

  try {
    const pavilhoes = await fetchComToken(
      `/orcamentos/pavilhao?idmontagem=${idMontagem}`
    );
    console.log("Pavilhões para datalist:", pavilhoes);

    pavilhoes.forEach((localpav) => {
      let option = document.createElement("option");
      option.value = localpav.nmpavilhao;
      datalist.appendChild(option);
    });
  } catch (error) {
    console.error("Erro ao carregar pavilhões para datalist:", error);
  }
}

async function carregarFuncaoOrc() {
  try {
    const funcaofetch = await fetchComToken("/orcamentos/funcao");
    funcoesDisponiveis = funcaofetch;

    let selects = document.querySelectorAll(".idFuncao");

    selects.forEach((select) => {
      select.innerHTML = "";
      console.log("Funcao recebidos 2:", funcaofetch); // Log das Funções recebidas

      let opcaoPadrao = document.createElement("option");
      opcaoPadrao.setAttribute("value", "");
      opcaoPadrao.textContent = "Selecione Função";
      select.appendChild(opcaoPadrao);

      funcaofetch.forEach((funcao) => {
        let option = document.createElement("option");
        option.value = funcao.idfuncao;
        option.textContent = funcao.descfuncao;
        option.setAttribute("data-descproduto", funcao.descfuncao);
        if (funcao.ctofuncaobase > 0) {
          option.setAttribute("data-cto", funcao.ctofuncaobase);
        } else if (funcao.ctofuncaojunior > 0) {
          option.setAttribute("data-cto", funcao.ctofuncaojunior);
        } else if (funcao.ctofuncaopleno > 0) {
          option.setAttribute("data-cto", funcao.ctofuncaopleno);
        } else if (funcao.ctofuncaosenior > 0) {
          option.setAttribute("data-cto", funcao.ctofuncaosenior);
        } else {
          option.setAttribute("data-cto", 0);
        } //base, junior, pleno ou senior????

        option.setAttribute("data-vda", funcao.vdafuncao); // option.setAttribute("data-transporte", funcao.transporte); //option.setAttribute("data-almoco", funcao.almoco || 0); // Certifique-se de que almoco/jantar estão aqui

        option.setAttribute("data-alimentacao", funcao.alimentacao || 0);
        option.setAttribute("data-transporte", funcao.transporte || 0);
        option.setAttribute("data-categoria", "Produto(s)");
        select.appendChild(option);
      });

      select.addEventListener("change", function (event) {
        const linha = this.closest("tr");
        idFuncao = this.value; // O value agora é o ID

        console.log("IDFUNCAO selecionado change:", idFuncao);

        const selectedOption = this.options[this.selectedIndex];

        const idFuncaoAtual = selectedOption.value;

        if (linha) {
          linha.dataset.idfuncao = idFuncaoAtual; // Atualiza o data-idfuncao na linha
        } // Se a opção padrão "Selecione Função" for escolhida, zere os valores globais

        if (selectedOption.value === "") {
          vlrAlimentacao = 0;
          vlrTransporte = 0;
          idFuncao = ""; // Limpa também o idFuncao global
          Categoria = "Produto(s)"; // Reinicia a categoria se for relevante
          console.log(
            "Nenhuma função selecionada. Valores de almoço, jantar, transporte e ID limpos."
          );
        } else {
          // Pega o valor do ID da função selecionada
          idFuncao = selectedOption.value;
          console.log("IDFUNCAO selecionado:", idFuncao); // Pega os valores dos atributos 'data-' e os armazena nas variáveis globais // Use parseFloat para garantir que são números para cálculos futuros // vlrAlmoco = parseFloat(selectedOption.getAttribute("data-almoco")) || 0;

          vlrAlimentacao =
            parseFloat(selectedOption.getAttribute("data-alimentacao")) || 0;
          vlrTransporte =
            parseFloat(selectedOption.getAttribute("data-transporte")) || 0;
          Categoria = selectedOption.getAttribute("data-categoria") || "N/D";

          console.log(
            `Valores Globais Atualizados: Alimentação: ${vlrAlimentacao}, Transporte: ${vlrTransporte}, Categoria: ${Categoria}`
          );
        } // Categoria = selectedOption.getAttribute("data-categoria") || "N/D";

        recalcularLinha(linha);
        atualizaProdutoOrc(event);
      }); //  Categoria = "Produto(s)"; // define padrão ao carregar
    });
  } catch (error) {
    console.error("Erro ao carregar funcao:", error);
  }
}

//Função para carregar os Funcao
// A sua função carregarFuncaoOrc() corrigida.

async function carregarEquipamentosOrc() {
  try {
    const equipamentos = await fetchComToken("/orcamentos/equipamentos");

    let selects = document.querySelectorAll(".idEquipamento"); //
    selects.forEach((select) => {
      select.innerHTML = "";

      let opcaoPadrao = document.createElement("option");
      opcaoPadrao.setAttribute("value", "");
      opcaoPadrao.textContent = "Selecione Equipamento";
      select.appendChild(opcaoPadrao);
      equipamentos.forEach((equipamentos) => {
        let option = document.createElement("option");
        option.value = equipamentos.idequip;
        option.textContent = equipamentos.descequip;
        option.setAttribute("data-descproduto", equipamentos.descequip);
        option.setAttribute("data-cto", equipamentos.ctoequip);
        option.setAttribute("data-vda", equipamentos.vdaequip);
        option.setAttribute("data-categoria", "Equipamento(s)");
        select.appendChild(option);
      });
      select.addEventListener("change", function (event) {
        const selectedOption = select.options[select.selectedIndex];
        idEquipamento = this.value;
        Categoria = selectedOption.getAttribute("data-categoria") || "N/D";

        atualizaProdutoOrc(event);
      });

      Categoria = "Equipamento(s)"; // define padrão ao carregar
    });
  } catch (error) {
    console.error("Erro ao carregar equipamentos:", error);
  }
}

// Função para carregar os suprimentos
async function carregarSuprimentosOrc() {
  try {
    const suprimentos = await fetchComToken("/orcamentos/suprimentos");
    let selects = document.querySelectorAll(".idSuprimento");

    selects.forEach((select) => {
      select.innerHTML = '<option value="">Selecione Suprimento</option>';
      suprimentos.forEach((suprimentos) => {
        let option = document.createElement("option");
        option.value = suprimentos.idsup;
        option.textContent = suprimentos.descsup;
        option.setAttribute("data-descproduto", suprimentos.descsup);
        option.setAttribute("data-cto", suprimentos.ctosup);
        option.setAttribute("data-vda", suprimentos.vdasup);
        option.setAttribute("data-categoria", "Suprimento(s)");
        select.appendChild(option);
      });

      select.addEventListener("change", function (event) {
        const selectedOption = select.options[select.selectedIndex];
        idSuprimento = this.value;
        Categoria = selectedOption.getAttribute("data-categoria") || "N/D";

        atualizaProdutoOrc(event);
      });
      Categoria = "Suprimento(s)"; // define padrão ao carregar
    });
  } catch (error) {
    console.error("Erro ao carregar suprimentos:", error);
  }
}

function limparSelects() {
  const ids = ["selectFuncao", "selectEquipamento", "selectSuprimento"];

  ids.forEach(function (id) {
    const select = document.getElementById(id);
    if (select) {
      select.selectedIndex = 0; // Seleciona o primeiro item (geralmente uma opção vazia ou "Selecione...")
    }
  });
}

export function atualizarVisibilidadeInfra() {
  // Renomeada de 'atualizarVisibilidade'
  let checkbox = document.getElementById("ativo"); // Use o ID correto
  let bloco = document.getElementById("blocoInfra");
  let bloco2 = document.getElementById("blocoInfra2"); // Se você precisar de dois blocos

  if (!checkbox || !bloco) return;

  const isChecked = checkbox.checked;

  bloco.style.display = isChecked ? "block" : "none";
  if (bloco2) {
    bloco2.style.display = isChecked ? "block" : "none";
  }
}

// Função para Pré/Pós Evento
export function atualizarVisibilidadePrePos() {
  let checkbox = document.getElementById("prepos"); // Use o ID correto
  let blocoPre = document.getElementById("blocoPre");
  let blocoPos = document.getElementById("blocoPos");

  if (!checkbox || !blocoPre || !blocoPos) return;

  const isChecked = checkbox.checked;

  blocoPre.style.display = isChecked ? "block" : "none";
  blocoPos.style.display = isChecked ? "block" : "none";
}

function configurarInfraCheckbox() {
  let checkbox = document.getElementById("ativo"); // Ajuste o ID
  if (!checkbox) return;

  // Anexa o listener à função global
  checkbox.addEventListener("change", atualizarVisibilidadeInfra);
  // Chama a função global para estado inicial
  atualizarVisibilidadeInfra();
}

function configurarPrePosCheckbox() {
  let checkbox = document.getElementById("prepos"); // Ajuste o ID
  if (!checkbox) return;

  // Anexa o listener à função global
  checkbox.addEventListener("change", atualizarVisibilidadePrePos);
  // Chama a função global para estado inicial
  atualizarVisibilidadePrePos();
}

// function configurarInfraCheckbox() {
//     let checkbox = document.getElementById("ativo");
//     let bloco = document.getElementById("blocoInfra");
//     let bloco2 = document.getElementById("blocoInfra2");

//     if (!checkbox || !bloco || !bloco2) return;

//     function atualizarVisibilidade() {
//         bloco.style.display = checkbox.checked ? "block" : "none";
//         bloco2.style.display = checkbox.checked ? "block" : "none";
//     }

//     checkbox.addEventListener("change", atualizarVisibilidade);
// // console.log("entrou na função");
//     // Opcional: já configura o estado inicial com base no checkbox
//     atualizarVisibilidade();
// }

// function configurarPrePosCheckbox() {
//     let checkbox = document.getElementById("prepos");
//     let blocoPre = document.getElementById("blocoPre");
//     let blocoPos = document.getElementById("blocoPos");

//     if (!checkbox || !blocoPre || !blocoPos) return;

//     function atualizarVisibilidadePrePos() {
//         blocoPre.style.display = checkbox.checked ? "block" : "none";
//         blocoPos.style.display = checkbox.checked ? "block" : "none";
//     }

//     checkbox.addEventListener("change", atualizarVisibilidadePrePos);
// // console.log("entrou na função");
//     // Opcional: já configura o estado inicial com base no checkbox
//     atualizarVisibilidadePrePos();
// }

function configurarFormularioOrc() {
  let form = document.querySelector("#form");
  if (!form) return;

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    let idCliente = document.getElementById("idCliente").value;
    console.log("ID Cliente:", idCliente); // Log do ID do cliente
    // let idMontagem = document.getElementById("idMontagem").value;

    let tabela = document.getElementById("tabela");
    let linhas = tabela
      .getElementsByTagName("tbody")[0]
      .getElementsByTagName("tr");
    let orcamento = { idCliente, Pessoas: [] };

    for (let linha of linhas) {
      let dados = {
        // idFuncao: linha.cells[0].querySelector(".idFuncao").value,
        qtdProduto: linha.cells[0].textContent.trim(),
        qtdDias: linha.cells[1].textContent.trim(),
        valor: linha.cells[2].textContent.trim(),
        total: linha.cells[3].textContent.trim(),
      };
      orcamento.Pessoas.push(dados);
    }
  });

  // Adicionar datalist para setor
  let datalist = document.createElement("datalist");
  datalist.id = "datalist-setor";
  form.appendChild(datalist);
}

function desformatarMoeda(valor) {
  if (!valor) return 0;

  // Se for número, retorna direto
  if (typeof valor === "number") return valor;

  // Remove R$ e espaços
  valor = valor.replace(/[R$\s]/g, "");

  // Se valor contiver vírgula e ponto (R$ 1.234,56), remove o ponto (milhar) e troca vírgula por ponto
  if (valor.includes(",") && valor.includes(".")) {
    valor = valor.replace(/\./g, "").replace(",", ".");
  } else if (valor.includes(",")) {
    // Se só tiver vírgula, assume que vírgula é decimal
    valor = valor.replace(",", ".");
  }

  // Se tiver só ponto, assume que já está no formato decimal correto
  return parseFloat(valor) || 0;
}

function recalcularTotaisGerais() {
  let totalCustoGeral = 0;
  let totalVendaGeral = 0;
  let totalAjdCustoGeral = 0;
  let totalAjdGeralCustoGeral = 0;

  // Soma os custos
  document.querySelectorAll(".totCtoDiaria").forEach((cell) => {
    totalCustoGeral += desformatarMoeda(cell.textContent);
  });

  // Soma as vendas (excluindo itens bonificados)
  document.querySelectorAll(".totVdaDiaria").forEach((cell) => {
    const linha = cell.closest("tr");
    const isBonificado = linha?.dataset?.extrabonificado === "true";
    
    if (!isBonificado) {
      totalVendaGeral += desformatarMoeda(cell.textContent);
    }
  });

  document.querySelectorAll(".totAjdCusto").forEach((cell) => {
    totalAjdCustoGeral += desformatarMoeda(cell.textContent);
  });

  totalAjdGeralCustoGeral = totalCustoGeral + totalAjdCustoGeral;

  // Atualiza campos visuais
  document.querySelector("#totalGeralCto").value =
    totalCustoGeral.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

  document.querySelector("#totalGeralVda").value =
    totalVendaGeral.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

  document.querySelector("#totalAjdCusto").value =
    totalAjdCustoGeral.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

  document.querySelector("#totalGeral").value =
    totalAjdGeralCustoGeral.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

  // Atualiza o valor do cliente com o valor total de venda
  const campoValorCliente = document.querySelector("#valorCliente");
  if (campoValorCliente) {
    campoValorCliente.value = totalVendaGeral.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  console.log(
    "RECALCULO TOTAIS GERAIS",
    totalCustoGeral,
    totalVendaGeral,
    totalAjdCustoGeral
  );

  calcularLucro();
  calcularLucroReal();
}

function calcularLucro() {
  console.log("CALCULAR LUCRO");
  let totalCustoGeral = 0;
  let totalVendaGeral = 0;

  // Extraímos os valores numéricos das células, desformatados de moeda
  //totalCustoGeral = desformatarMoeda(document.querySelector('#totalGeralCto').value);
  totalCustoGeral = desformatarMoeda(
    document.querySelector("#totalGeral").value
  );
  totalVendaGeral = desformatarMoeda(
    document.querySelector("#totalGeralVda").value
  );

  console.log("CALCULAR LUCRO", totalCustoGeral, totalVendaGeral);
  // Calcula o lucro
  let lucro = totalVendaGeral - totalCustoGeral;

  let porcentagemLucro = 0;
  if (totalVendaGeral > 0) {
    porcentagemLucro = (lucro / totalVendaGeral) * 100;
  }

  // Exibe o lucro no console
  console.log("Lucro calculado:", lucro);
  console.log("Porcentagem de Lucro:", porcentagemLucro.toFixed(2) + "%");

  // Atualiza o campo de lucro com a formatação de moeda
  let inputLucro = document.querySelector("#Lucro");
  if (inputLucro) {
    inputLucro.value = formatarMoeda(lucro);
  }

  let inputPorcentagemLucro = document.querySelector("#percentLucro");
  if (inputPorcentagemLucro) {
    inputPorcentagemLucro.value = porcentagemLucro.toFixed(2) + "%";
  }
}

function calcularLucroReal() {
  let totalCustoGeral = 0;
  let totalAjdCusto = 0;
  let valorFinalCliente = 0;
  let valorPercImposto = 0;
  let valorPercCtoFixo = 0;

  const inputTotalGeral = document.querySelector("#totalGeralCto");
  const inputTotalAjdCusto = document.querySelector("#totalAjdCusto");
  const inputValorCliente = document.querySelector("#valorCliente");
  const inputPercImposto = document.querySelector("#percentImposto");
  const inputPercCtoFixo = document.querySelector("#percentCustoFixo");

  if (!inputTotalGeral || !inputValorCliente) {
    console.warn(
      "⚠️ Campo(s) #totalGeral ou #valorCliente não encontrados. Lucro não pode ser calculado."
    );
    return;
  }
  console.log(
    "CALCULAR LUCRO REAL",
    inputTotalGeral.value,
    inputValorCliente.value,
    inputTotalAjdCusto?.value
  );
  // Obtém os valores convertendo de moeda
  totalCustoGeral = desformatarMoeda(inputTotalGeral.value);
  totalAjdCusto = desformatarMoeda(inputTotalAjdCusto.value);
  valorFinalCliente = desformatarMoeda(inputValorCliente.value);
  valorPercImposto = desformatarMoeda(inputPercImposto.value);
  valorPercCtoFixo = desformatarMoeda(inputPercCtoFixo.value);

  console.log(
    "TOTAL AJDCUSTO",
    totalCustoGeral,
    totalAjdCusto,
    valorFinalCliente,
    valorPercImposto,
    valorPercCtoFixo
  );

  // Atualiza o campo de imposto com a formatação de moeda
  let vlrImposto =
    valorFinalCliente > 0 ? (valorFinalCliente * valorPercImposto) / 100 : 0;

  console.log("💰 Valor do Imposto calculado:", vlrImposto);

  let vlrCtoFixo =
    valorFinalCliente > 0 ? (valorFinalCliente * valorPercCtoFixo) / 100 : 0;

  console.log("💰 Valor do Custo Fixo:", vlrCtoFixo);

  // Calcula lucro
  let lucroReal =
    valorFinalCliente -
    (totalCustoGeral + totalAjdCusto + vlrImposto + vlrCtoFixo);
  let porcentagemLucroReal =
    valorFinalCliente > 0 ? (lucroReal / valorFinalCliente) * 100 : 0;

  console.log("📈 Lucro Real calculado:", lucroReal);
  console.log(
    "📊 Porcentagem de Lucro Real:",
    porcentagemLucroReal.toFixed(2) + "%"
  );

  // Atualiza os campos de resultado
  const inputLucro = document.querySelector("#lucroReal");
  if (inputLucro) {
    inputLucro.value = formatarMoeda(lucroReal);
  } else {
    console.warn("⚠️ Campo #lucroReal não encontrado.");
  }

  const inputPorcentagemLucro = document.querySelector("#percentReal");
  if (inputPorcentagemLucro) {
    inputPorcentagemLucro.value = porcentagemLucroReal.toFixed(2) + "%";
  } else {
    console.warn("⚠️ Campo #percentReal não encontrado.");
  }

  const inputValorImposto = document.querySelector("#valorImposto");
  if (inputValorImposto) {
    inputValorImposto.value = formatarMoeda(vlrImposto);
  } else {
    console.warn("⚠️ Campo #valorImposto não encontrado.");
  }

  const inputValorCtoFixo = document.querySelector("#valorCustoFixo");
  if (inputValorCtoFixo) {
    inputValorCtoFixo.value = formatarMoeda(vlrCtoFixo);
  } else {
    console.warn("⚠️ Campo #valorCustoFixo não encontrado.");
  }
}

// function aplicarDescontoEAcrescimo() {
//    console.log ("DESCONTO NO APLICAR DESCONTO E ACRESCIMO",document.querySelector('#Desconto').value, document.querySelector('#percentDesc').value);
//     const campoTotalVenda = document.querySelector('#totalGeralVda');
//     const campoDesconto = document.querySelector('#Desconto');
//     const campoPerCentDesc = document.querySelector('#percentDesc');
//     const campoAcrescimo = document.querySelector('#Acrescimo');
//     const campoPerCentAcresc = document.querySelector('#percentAcresc');
//     const campoValorCliente = document.querySelector('#valorCliente');

//     let totalVenda = desformatarMoeda(campoTotalVenda?.value || '0');
//     if (isNaN(totalVenda)) totalVenda = 0;

//     let valorDesconto = desformatarMoeda(campoDesconto?.value || '0');
//     let perCentDesc = parseFloat((campoPerCentDesc?.value || '0').replace('%', '').replace(',', '.')) || 0;

//     let valorAcrescimo = desformatarMoeda(campoAcrescimo?.value || '0');
//     let perCentAcresc = parseFloat((campoPerCentAcresc?.value || '0').replace('%', '').replace(',', '.')) || 0;

//     if (campoDesconto && totalVenda > 0) {
//         perCentDesc = (valorDesconto / totalVenda) * 100;
//         campoPerCentDesc.value = perCentDesc.toFixed(2) + '%';
//     } else if (campoPerCentDesc && totalVenda > 0) {
//         valorDesconto = totalVenda * (perCentDesc / 100);
//         campoDesconto.value = formatarMoeda(valorDesconto);
//     }

//     // Sincronizar acréscimo
//     if (campoAcrescimo && totalVenda > 0) {
//         perCentAcresc = (valorAcrescimo / totalVenda) * 100;
//         campoPerCentAcresc.value = perCentAcresc.toFixed(2) + '%';
//     } else if (campoPerCentAcresc && totalVenda > 0) {
//         valorAcrescimo = totalVenda * (perCentAcresc / 100);
//         campoAcrescimo.value = formatarMoeda(valorAcrescimo);
//     }

//     // valorDesconto = desformatarMoeda(campoDesconto?.value || '0');
//     // valorAcrescimo = desformatarMoeda(campoAcrescimo?.value || '0');
//     // Calcular valor final para o cliente
//     const valorFinal = totalVenda - valorDesconto + valorAcrescimo;

//     if (campoValorCliente) {
//         campoValorCliente.value = formatarMoeda(valorFinal);
//     }

//     calcularLucro();
//     calcularLucroReal();
// }

function aplicarDescontoEAcrescimo(changedInputId) {
  // Impede loops infinitos de cálculo
  if (isRecalculatingGlobalDiscountAcrescimo) {
    return;
  }

  const campoValorCliente = document.querySelector("#valorCliente");
  isRecalculatingGlobalDiscountAcrescimo = true;

  try {
    // 1. Obter referências dos elementos
    const inputDescontoValor = document.getElementById("Desconto");
    const inputDescontoPercentual = document.getElementById("percentDesc");
    const inputAcrescimoValor = document.getElementById("Acrescimo");
    const inputAcrescimoPercentual = document.getElementById("percentAcresc");

    // 2. Atualizar o total base (Venda bruta)
    if (typeof recalcularTotaisGerais === "function") {
      recalcularTotaisGerais();
    }
    
    const totalBaseParaCalculo = desformatarMoeda(
      document.getElementById("totalGeralVda")?.value || "0"
    );

    // --- SINCRONIZAÇÃO EM TEMPO REAL ---

    // Lógica para DESCONTO
    if (changedInputId === "Desconto") {
      const vlr = desformatarMoeda(inputDescontoValor.value);
      const perc = totalBaseParaCalculo > 0 ? (vlr / totalBaseParaCalculo) * 100 : 0;
      inputDescontoPercentual.value = formatarPercentual(perc);
    } 
    else if (changedInputId === "percentDesc") {
      const perc = desformatarPercentual(inputDescontoPercentual.value);
      const vlr = totalBaseParaCalculo * (perc / 100);
      inputDescontoValor.value = formatarMoeda(vlr);
    }

    // Lógica para ACRÉSCIMO
    if (changedInputId === "Acrescimo") {
      const vlr = desformatarMoeda(inputAcrescimoValor.value);
      const perc = totalBaseParaCalculo > 0 ? (vlr / totalBaseParaCalculo) * 100 : 0;
      inputAcrescimoPercentual.value = formatarPercentual(perc);
    } 
    else if (changedInputId === "percentAcresc") {
      const perc = desformatarPercentual(inputAcrescimoPercentual.value);
      const vlr = totalBaseParaCalculo * (perc / 100);
      inputAcrescimoValor.value = formatarMoeda(vlr);
    }

    // 3. CÁLCULO DO RESULTADO FINAL
    const valorDesconto = desformatarMoeda(inputDescontoValor?.value || "0");
    const valorAcrescimo = desformatarMoeda(inputAcrescimoValor?.value || "0");

    const valorFinal = totalBaseParaCalculo - valorDesconto + valorAcrescimo;

    // Atualiza o campo Valor Cliente
    if (campoValorCliente) {
      campoValorCliente.value = formatarMoeda(valorFinal);
    }

    // 4. ATUALIZAÇÃO DE LUCROS E TOTAIS
    if (typeof calcularLucro === "function") calcularLucro();
    if (typeof calcularLucroReal === "function") calcularLucroReal();

  } catch (err) {
    console.error("Erro no cálculo de desconto/acréscimo:", err);
  } finally {
    isRecalculatingGlobalDiscountAcrescimo = false;
  }
}

function calcularImposto(totalDeReferencia, percentualImposto) {
  console.log("CALCULAR IMPOSTO", totalDeReferencia, percentualImposto);
  const campoValorImposto = document.querySelector("#valorImposto"); // Supondo que você terá um campo com id 'valorImposto'
  const campoPercentualImposto = document.querySelector("#percentImposto"); // Supondo que você terá um campo com id 'percentualImposto'

  let valorTotal = parseFloat(totalDeReferencia) || 0;
  let percImposto =
    parseFloat((percentualImposto || "0").replace("%", "").replace(",", ".")) ||
    0;

  let valorCalculadoImposto = valorTotal * (percImposto / 100);

  if (campoValorImposto) {
    campoValorImposto.value = formatarMoeda(valorCalculadoImposto);
  }

  calcularLucroReal(); // Recalcula o lucro real após calcular o imposto
}

function calcularCustoFixo(totalDeReferencia, percentualCtoFixo) {
  console.log("CALCULAR CUSTO FIXO", totalDeReferencia, percentualCtoFixo);

  const campoCtoFixo = document.querySelector("#valorCustoFixo"); // Supondo que você terá um campo com id 'valorImposto'
  const campoPercentualCtoFixo = document.querySelector("#percentCustoFixo"); // Supondo que você terá um campo com id 'percentualImposto'

  let valorTotal = parseFloat(totalDeReferencia) || 0;
  let percCtoFixo =
    parseFloat((percentualCtoFixo || "0").replace("%", "").replace(",", ".")) ||
    0;

  let valorCalculadoCtoFixo = valorTotal * (percCtoFixo / 100);

  if (campoCtoFixo) {
    campoCtoFixo.value = formatarMoeda(valorCalculadoCtoFixo);
  }

  calcularLucroReal(); // Recalcula o lucro real após calcular o imposto
}
// document.getElementById("tabela").addEventListener("click", function (e) {
//     const botao = e.target.closest(".deleteBtn");
//     if (!botao) return;
//     const linha = botao.closest("tr");
//     if (linha) removerLinha(linha);
// });
// Exemplo de função para remover a linha
function removerLinha(linha) {
  // Remove a linha da DOM
  linha.remove();

  // Recalcular os totais após a remoção

  recalcularTotaisGerais();
  //  aplicarDescontoEAcrescimo();
  aplicarMascaraMoeda();
  calcularLucro();
  calcularLucroReal();
}

function inicializarLinha(linha) {
  // 1. Encontra o select de função na linha e o popula com as opções
  const selectFuncao = linha.querySelector(".idFuncao");
  if (selectFuncao) {
    selectFuncao.innerHTML = "";
    const opcaoPadrao = document.createElement("option");
    opcaoPadrao.setAttribute("value", "");
    opcaoPadrao.textContent = "Selecione Função";
    selectFuncao.appendChild(opcaoPadrao);

    if (window.funcoesDisponiveis) {
      window.funcoesDisponiveis.forEach((funcao) => {
        let option = document.createElement("option");
        option.value = funcao.idfuncao;
        option.textContent = funcao.descfuncao;
        option.setAttribute("data-descproduto", funcao.descfuncao);
        option.setAttribute("data-cto", funcao.ctofuncao);
        option.setAttribute("data-vda", funcao.vdafuncao);
        // option.setAttribute("data-almoco", funcao.almoco || 0);
        option.setAttribute("data-alimentacao", funcao.alimentacao || 0);
        option.setAttribute("data-transporte", funcao.transporte || 0);
        option.setAttribute("data-categoria", "Produto(s)");
        selectFuncao.appendChild(option);
      });
    }
  }

  // 2. Adiciona o listener de 'change' ao select de função
  selectFuncao?.addEventListener("change", function (event) {
    const linhaAtual = this.closest("tr");
    if (linhaAtual) {
      atualizaProdutoOrc(event, linhaAtual);
      recalcularLinha(linhaAtual);
    } else {
      console.error(
        "Erro: Não foi possível encontrar a linha (<tr>) pai para o select."
      );
    }
  });

  // 3. Adiciona listeners para os campos de Desconto e Acréscimo
  const descontoValorItem = linha.querySelector(".descontoItem .ValorInteiros");
  if (descontoValorItem) {
    descontoValorItem.addEventListener("input", function () {
      console.log("EVENTO INPUT: Campo ValorInteiros de Desconto alterado.");
      lastEditedFieldType = "valor";
      recalcularDescontoAcrescimo(
        this,
        "desconto",
        "valor",
        this.closest("tr")
      );
    });
    descontoValorItem.addEventListener("blur", function () {
      console.log("EVENTO BLUR: Campo ValorInteiros de Desconto.");
      this.value = formatarMoeda(desformatarMoeda(this.value));
      setTimeout(() => {
        const campoPercentual =
          this.closest(".descontoItem").querySelector(".valorPerCent");
        if (
          document.activeElement !== campoPercentual &&
          !this.closest(".Acres-Desc").contains(document.activeElement)
        ) {
          lastEditedFieldType = null;
          console.log(
            "lastEditedFieldType resetado para null após blur do ValorInteiros."
          );
        }
      }, 0);
    });
  }

  const descontoPercentualItem = linha.querySelector(
    ".descontoItem .valorPerCent"
  );
  if (descontoPercentualItem) {
    descontoPercentualItem.addEventListener("input", function () {
      console.log("EVENTO INPUT: Campo valorPerCent de Desconto alterado.");
      lastEditedFieldType = "percentual";
      recalcularDescontoAcrescimo(
        this,
        "desconto",
        "percentual",
        this.closest("tr")
      );
    });
    descontoPercentualItem.addEventListener("blur", function () {
      console.log("EVENTO BLUR: Campo valorPerCent de Desconto.");
      this.value = formatarPercentual(desformatarPercentual(this.value));
      setTimeout(() => {
        if (!this.closest(".Acres-Desc").contains(document.activeElement)) {
          lastEditedFieldType = null;
          console.log(
            "lastEditedFieldType resetado para null após blur do valorPerCent."
          );
        }
      }, 0);
    });
  }

  const acrescimoValorItem = linha.querySelector(
    ".acrescimoItem .ValorInteiros"
  );
  if (acrescimoValorItem) {
    acrescimoValorItem.addEventListener("input", function () {
      console.log("EVENTO INPUT: Campo ValorInteiros de Acréscimo alterado.");
      lastEditedFieldType = "valor";
      recalcularDescontoAcrescimo(
        this,
        "acrescimo",
        "valor",
        this.closest("tr")
      );
    });
    acrescimoValorItem.addEventListener("blur", function () {
      console.log("EVENTO BLUR: Campo ValorInteiros de Acréscimo.");
      this.value = formatarMoeda(desformatarMoeda(this.value));
      setTimeout(() => {
        const campoPercentual =
          this.closest(".acrescimoItem").querySelector(".valorPerCent");
        if (
          document.activeElement !== campoPercentual &&
          !this.closest(".Acres-Desc").contains(document.activeElement)
        ) {
          lastEditedFieldType = null;
          console.log(
            "lastEditedFieldType resetado para null após blur do ValorInteiros."
          );
        }
      }, 0);
    });
  }

  const acrescimoPercentualItem = linha.querySelector(
    ".acrescimoItem .valorPerCent"
  );
  if (acrescimoPercentualItem) {
    acrescimoPercentualItem.addEventListener("input", function () {
      console.log("EVENTO INPUT: Campo valorPerCent de Acréscimo alterado.");
      lastEditedFieldType = "percentual";
      recalcularDescontoAcrescimo(
        this,
        "acrescimo",
        "percentual",
        this.closest("tr")
      );
    });
    acrescimoPercentualItem.addEventListener("blur", function () {
      console.log("EVENTO BLUR: Campo valorPerCent de Acréscimo.");
      this.value = formatarPercentual(desformatarPercentual(this.value));
      setTimeout(() => {
        if (!this.closest(".Acres-Desc").contains(document.activeElement)) {
          lastEditedFieldType = null;
          console.log(
            "lastEditedFieldType resetado para null após blur do valorPerCent."
          );
        }
      }, 0);
    });
  }

  // 4. Inicializa o Flatpickr para o campo de data
  const novoInputData = linha.querySelector('input[type="text"].datas');
  if (novoInputData) {
    flatpickr(novoInputData, commonFlatpickrOptionsTable);
  } else {
    console.error("Erro: Novo input de data não encontrado na nova linha.");
  }

  // 5. Adiciona listeners para os botões de quantidade e inputs de quantidade/dias
  const incrementButton = linha.querySelector(".qtdProduto .increment");
  const decrementButton = linha.querySelector(".qtdProduto .decrement");
  const quantityInput = linha.querySelector('.qtdProduto input[type="number"]');

  if (incrementButton && quantityInput) {
    incrementButton.addEventListener("click", function () {
      quantityInput.value = parseInt(quantityInput.value) + 1;
      recalcularLinha(this.closest("tr"));
    });
  }

  if (decrementButton && quantityInput) {
    decrementButton.addEventListener("click", function () {
      let currentValue = parseInt(quantityInput.value);
      if (currentValue > 0) {
        quantityInput.value = currentValue - 1;
        recalcularLinha(this.closest("tr"));
      }
    });
  }
  linha
    .querySelector(".qtdProduto input")
    ?.addEventListener("input", function () {
      recalcularLinha(this.closest("tr"));
    });
  linha.querySelector(".qtdDias input")?.addEventListener("input", function () {
    recalcularLinha(this.closest("tr"));
  });

  // 6. Event listeners para campos de ajuda de custo e extras
  linha
    .querySelector(".tpAjdCusto-alimentacao")
    ?.addEventListener("change", function () {
      recalcularLinha(this.closest("tr"));
    });
  linha
    .querySelector(".tpAjdCusto-transporte")
    ?.addEventListener("change", function () {
      recalcularLinha(this.closest("tr"));
    });
  linha.querySelector(".hospedagem")?.addEventListener("input", function () {
    recalcularLinha(this.closest("tr"));
  });
  linha
    .querySelector(".transporteExtraInput")
    ?.addEventListener("input", function () {
      recalcularLinha(this.closest("tr"));
      console.log(
        "INPUT TRANSPORTE ALTERADO NO ADICIONARLINHAORC:",
        this.value
      );
    });

  // 7. Adiciona listener para o botão de apagar
  const temPermissaoApagar = temPermissao("Orcamentos", "apagar");
  const deleteButton = linha.querySelector(".btnApagar");
  const idItemInput = linha.querySelector("input.idItemOrcamento");

  if (deleteButton) {
    deleteButton.addEventListener("click", async function (event) {
      event.preventDefault();
      const linhaParaRemover = this.closest("tr");
      const idOrcamentoItem = idItemInput ? idItemInput.value : null;

      if (!idOrcamentoItem || idOrcamentoItem.trim() === "") {
        // ... (lógica de exclusão local) ...
      } else if (!temPermissaoApagar) {
        // ... (lógica de permissão negada) ...
      } else {
        // ... (lógica de exclusão via API) ...
      }
    });

    if (!temPermissaoApagar) {
      deleteButton.classList.add("btnDesabilitado");
      deleteButton.title =
        "Você não tem permissão para apagar itens de orçamento que já estão salvos.";
    }
  }
}


window.toggleEditavel = function(checkbox) {
    const linha = checkbox.closest("tr");
    const inputQtdDias = linha.querySelector("input.qtdDias");
    const inputQtdProduto = linha.querySelector("input.qtdProduto"); // Input de quantidade
    const increment = linha.querySelector(".increment");
    const decrement = linha.querySelector(".decrement");

    if (checkbox.checked) {
        // --- ATIVA CACHÊ FECHADO ---
        
        // 1. Libera o campo de Dias
        inputQtdDias.readOnly = false;
        inputQtdDias.removeAttribute("readonly");

        // 2. Bloqueia a Quantidade de Produtos/Pessoas
        // Usamos pointerEvents = "none" para ignorar o clique e opacity para feedback visual
        if (inputQtdProduto) {
            inputQtdProduto.style.pointerEvents = "none"; 
            inputQtdProduto.style.tabIndex = "-1"; // Impede acesso via tecla TAB
            inputQtdProduto.style.opacity = "0.6";
            inputQtdProduto.style.cursor = "not-allowed";
        }

        // 3. Bloqueia os botões + e -
        if (increment && decrement) {
            increment.disabled = true; // Desabilita o botão logicamente
            decrement.disabled = true;
            increment.style.pointerEvents = "none"; // Impede o clique fisicamente
            decrement.style.pointerEvents = "none";
            increment.style.cursor = "not-allowed";
            decrement.style.cursor = "not-allowed";
            increment.style.opacity = "0.5";
            decrement.style.opacity = "0.5";
        }

        inputQtdDias.focus();
        console.log("🔓 Modo Cachê Fechado: Dias liberados, Quantidade bloqueada.");

    } else {
        // --- VOLTA AO MODO AUTOMÁTICO ---
        
        // 1. Bloqueia o campo de Dias
        inputQtdDias.readOnly = true;
        inputQtdDias.setAttribute("readonly", "readonly");
        inputQtdDias.style.backgroundColor = "";
        inputQtdDias.style.border = "";

        // 2. Libera a Quantidade
        if (inputQtdProduto) {
            inputQtdProduto.style.pointerEvents = "auto";
            inputQtdProduto.style.tabIndex = "0";
            inputQtdProduto.style.opacity = "1";
        }

        // 3. Libera os botões + e -
        if (increment && decrement) {
            increment.disabled = false;
            decrement.disabled = false;
            increment.style.pointerEvents = "auto";
            decrement.style.pointerEvents = "auto";
            increment.style.cursor = "pointer";
            decrement.style.cursor = "pointer";
            increment.style.opacity = "1";
            decrement.style.opacity = "1";
        }

        // Volta para o cálculo automático do Flatpickr
        const inputData = linha.querySelector(".datas-item");
        if (inputData && inputData._flatpickr) {
            atualizarQtdDias(inputData, inputData._flatpickr.selectedDates);
        }
        console.log("🔒 Modo Automático: Bloqueado.");
    }

    // Recalcula a linha sempre que trocar a flag
    if (typeof recalcularLinha === "function") {
        recalcularLinha(linha);
    }
};

function adicionarLinhaOrc() {
  let tabela = document
    .getElementById("tabela")
    .getElementsByTagName("tbody")[0];

  const emptyRow = tabela.querySelector('td[colspan="20"]');
  if (emptyRow) {
    emptyRow.closest("tr").remove();
  }

  let ufAtual = document.getElementById("ufmontagem")?.value || "SP";
  const initialDisplayStyle =
    !ufAtual || ufAtual.toUpperCase() === "SP"
      ? "display: none;"
      : "display: table-cell;";

  let novaLinha = tabela.insertRow(0);
  //let novaLinha = document.createElement('tr');
  //

  // <td class="ajdCusto Moeda alimentacao">
  //         <input type="text" class="vlralimentacao-input Moeda" value="${formatarMoeda(0)}" data-original-ajdcusto readonly>
  //     </td>
  //     <td class="ajdCusto Moeda transporte">
  //         <input type="text" class="vlrtransporte-input Moeda" value="${formatarMoeda(0)}" data-original-ajdcusto readonly>
  //     </td>

  novaLinha.innerHTML = `
        <td style="display: none;"><input type="hidden" class="idItemOrcamento" style="display: none;" value=""></td> <!-- Corrigido: de <th> para <td> e adicionado input hidden -->
        <td style="display: none;"><input type="hidden" class="idFuncao" value=""></td>
        <td style="display: none;"><input type="hidden" class="idEquipamento" value=""></td>
        <td style="display: none;"><input type="hidden" class="idSuprimento" value=""></td>

        <td class="Proposta">
            <div class="checkbox-wrapper-33">
                <label class="checkbox">
                    <input class="checkbox__trigger visuallyhidden" type="checkbox" checked />
                    <span class="checkbox__symbol">
                        <svg aria-hidden="true" class="icon-checkbox" width="28px" height="28px" viewBox="0 0 28 28" version="1" xmlns="http://www.w3.org/2000/svg">
                            <path d="M4 14l8 7L24 7"></path>
                        </svg>
                    </span>
                    <p class="checkbox__textwrapper"></p>
                </label>
            </div>
        </td>
        <td class="cacheFechado">
            <div class="checkbox-wrapper-33">
                <label class="checkbox">
                    <input class="checkbox__trigger visuallyhidden chk-cache-fechado" type="checkbox" onchange="toggleEditavel(this)" />
                    <span class="checkbox__symbol">
                        <svg aria-hidden="true" class="icon-checkbox" width="28px" height="28px" viewBox="0 0 28 28" version="1" xmlns="http://www.w3.org/2000/svg">
                            <path d="M4 14l8 7L24 7"></path>
                        </svg>
                    </span>
                    <p class="checkbox__textwrapper"></p>
                </label>
            </div>
        </td>
        <td class="Categoria"><input type="text" class="categoria-input" value=""></td> <!-- Adicionado input para edição -->
        <td class="qtdProduto">
            <div class="add-less">
                <input type="number" class="qtdProduto" min="0" value="0" readonly>
                <div class="Bt">
                    <button type="button" class="increment">+</button>
                    <button type="button" class="decrement">-</button>
                </div>
            </div>
        </td>

        <td class="produto"><input type="text" class="produto-input" value=""></td> <!-- Adicionado input para edição -->
        <td class="setor"><input type="text" class="setor-input" list="datalist-setor" value=""></td> <!-- Adicionado input para edição -->

        <td class="qtdDias">
            <div class="add-less">
                <input type="number" readonly class="qtdDias" min="0" value="0">
            </div>
        </td>
        <td class="Periodo">
            <div class="flatpickr-container">
                <input type="text" class="datas datas-item" data-input required readonly placeholder="Clique para Selecionar">
            </div>
        </td>
        <td class="descontoItem Moeda">
            <div class="Acres-Desc">
                <input type="text" class="ValorInteiros" value="R$ 0,00">
                <input type="text" class="valorPerCent" value="0%">
            </div>
        </td>
        <td class="acrescimoItem Moeda">
            <div class="Acres-Desc">
                <input type="text" class="ValorInteiros" value="R$ 0,00">
                <input type="text" class="valorPerCent" value="0%">
            </div>
        </td>
        <td class="vlrVenda Moeda" data-original-venda="0">${formatarMoeda(
          0
        )}</td>
        <td class="totVdaDiaria Moeda">${formatarMoeda(0)}</td>
        <td class="vlrCusto Moeda">${formatarMoeda(0)}</td>
        <td class="totCtoDiaria Moeda">${formatarMoeda(0)}</td>
        <td class="ajdCusto Moeda alimentacao" data-original-ajdcusto="0">
            <span class="vlralimentacao-input">${formatarMoeda(0)}</span>
        </td>
        <td class="ajdCusto Moeda transporte" data-original-ajdcusto="0">
            <span class="vlrtransporte-input">${formatarMoeda(0)}</span>
        </td>
        <td class="totAjdCusto Moeda">${formatarMoeda(0)}</td>
        <td class="extraCampo" style="${initialDisplayStyle}">
            <input type="text" class="hospedagem Moeda" value=" R$ 0,00">
        </td>
        <td class="extraCampo" style="${initialDisplayStyle}">
            <input type="text" class="transporteExtraInput Moeda" value=" R$ 0,00">
        </td>
        <td class="totGeral Moeda">${formatarMoeda(0)}</td>
        <td>
            <div class="Acao">
                <button class="btnApagar" type="button">
                    <svg class="delete-svgIcon" viewBox="0 0 448 512">
                        <path d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z"></path>
                    </svg>
                </button>
            </div>
        </td>
    `;

  // const setorInputCheck = novaLinha.querySelector(".setor-input");
  // console.log(`DEBUG ADICIONAR LINHA: .setor-input na nova linha:`, setorInputCheck ? 'Encontrado!' : 'NÃO ENCONTRADO!');
  // if (setorInputCheck) {
  //     console.log(`DEBUG ADICIONAR LINHA: HTML do td .setor:`, novaLinha.querySelector('td.setor').outerHTML);
  // }
  tabela.insertBefore(novaLinha, tabela.firstChild);

  // Base do item (valor original sem desconto/acréscimo)
  novaLinha.dataset.vlrbase = "0";

  const descontoValorItem = novaLinha.querySelector(
    ".descontoItem .ValorInteiros"
  );
  if (descontoValorItem) {
    descontoValorItem.addEventListener("input", function () {
      console.log("EVENTO INPUT: Campo ValorInteiros de Desconto alterado.");
      lastEditedFieldType = "valor";
      recalcularDescontoAcrescimo(
        this,
        "desconto",
        "valor",
        this.closest("tr")
      );
    });
    descontoValorItem.addEventListener("blur", function () {
      console.log("EVENTO BLUR: Campo ValorInteiros de Desconto.");
      this.value = formatarMoeda(desformatarMoeda(this.value));
      // Adiciona um listener para o próximo tick, para verificar o foco.
      // Se o foco não está no campo percentual ou em outro campo da mesma célula, zera.
      setTimeout(() => {
        const campoPercentual =
          this.closest(".descontoItem").querySelector(".valorPerCent");
        // Se o foco não está no campo parceiro OU se o foco saiu da célula Acres-Desc
        if (
          document.activeElement !== campoPercentual &&
          !this.closest(".Acres-Desc").contains(document.activeElement)
        ) {
          lastEditedFieldType = null;
          console.log(
            "lastEditedFieldType resetado para null após blur do ValorInteiros."
          );
        }
      }, 0); // Pequeno atraso para o browser resolver o foco
    });
  }

  // Campo Percentual de Desconto
  const descontoPercentualItem = novaLinha.querySelector(
    ".descontoItem .valorPerCent"
  );
  if (descontoPercentualItem) {
    descontoPercentualItem.addEventListener("input", function () {
      console.log("EVENTO INPUT: Campo valorPerCent de Desconto alterado.");
      lastEditedFieldType = "percentual";
      recalcularDescontoAcrescimo(
        this,
        "desconto",
        "percentual",
        this.closest("tr")
      );
    });
    descontoPercentualItem.addEventListener("blur", function () {
      console.log("EVENTO BLUR: Campo valorPerCent de Desconto.");
      this.value = formatarPercentual(desformatarPercentual(this.value));
      // Ao sair do percentual, podemos resetar o lastEditedFieldType
      // já que o usuário provavelmente terminou a interação com este par de campos.
      setTimeout(() => {
        // Verifica se o foco não está dentro do mesmo grupo acres-desc
        if (!this.closest(".Acres-Desc").contains(document.activeElement)) {
          lastEditedFieldType = null;
          console.log(
            "lastEditedFieldType resetado para null após blur do valorPerCent."
          );
        }
      }, 0);
    });
  }
  const acrescimoValorItem = novaLinha.querySelector(
    ".acrescimoItem .ValorInteiros"
  );
  if (acrescimoValorItem) {
    acrescimoValorItem.addEventListener("input", function () {
      console.log("EVENTO INPUT: Campo ValorInteiros de Acréscimo alterado.");
      lastEditedFieldType = "valor";
      recalcularDescontoAcrescimo(
        this,
        "acrescimo",
        "valor",
        this.closest("tr")
      );
    });
    acrescimoValorItem.addEventListener("blur", function () {
      console.log("EVENTO BLUR: Campo ValorInteiros de Acréscimo.");
      this.value = formatarMoeda(desformatarMoeda(this.value));
      // Adiciona um listener para o próximo tick, para verificar o foco.
      // Se o foco não está no campo percentual ou em outro campo da mesma célula, zera.
      setTimeout(() => {
        const campoPercentual =
          this.closest(".acrescimoItem").querySelector(".valorPerCent");
        // Se o foco não está no campo parceiro OU se o foco saiu da célula Acres-Desc
        if (
          document.activeElement !== campoPercentual &&
          !this.closest(".Acres-Desc").contains(document.activeElement)
        ) {
          lastEditedFieldType = null;
          console.log(
            "lastEditedFieldType resetado para null após blur do ValorInteiros."
          );
        }
      }, 0); // Pequeno atraso para o browser resolver o foco
    });
  }

  // Campo Percentual de Desconto
  const acrescimoPercentualItem = novaLinha.querySelector(
    ".acrescimoItem .valorPerCent"
  );
  if (acrescimoPercentualItem) {
    acrescimoPercentualItem.addEventListener("input", function () {
      console.log("EVENTO INPUT: Campo valorPerCent de Acréscimo alterado.");
      lastEditedFieldType = "percentual";
      recalcularDescontoAcrescimo(
        this,
        "acrescimo",
        "percentual",
        this.closest("tr")
      );
    });
    acrescimoPercentualItem.addEventListener("blur", function () {
      console.log("EVENTO BLUR: Campo valorPerCent de Acréscimo.");
      this.value = formatarPercentual(desformatarPercentual(this.value));

      setTimeout(() => {
        // Verifica se o foco não está dentro do mesmo grupo acres-desc
        if (!this.closest(".Acres-Desc").contains(document.activeElement)) {
          lastEditedFieldType = null;
          console.log(
            "lastEditedFieldType resetado para null após blur do valorPerCent."
          );
        }
      }, 0);
    });
  }

  //Inicializa o Flatpickr para o campo de data na nova linha
  const novoInputData = novaLinha.querySelector('input[type="text"].datas');
  if (novoInputData) {
    flatpickr(novoInputData, commonFlatpickrOptionsTable);
    //  console.log("Flatpickr inicializado para nova linha adicionada:", novoInputData);
  } else {
    console.error("Erro: Novo input de data não encontrado na nova linha.");
  }

  const incrementButton = novaLinha.querySelector(".qtdProduto .increment");
  const decrementButton = novaLinha.querySelector(".qtdProduto .decrement");
  const quantityInput = novaLinha.querySelector(
    '.qtdProduto input[type="number"]'
  );

  if (incrementButton && quantityInput) {
    incrementButton.addEventListener("click", function () {
      quantityInput.value = parseInt(quantityInput.value) + 1;
      // Chame sua função de recalcular a linha aqui também, se necessário
      recalcularLinha(this.closest("tr"));
    });
  }

  if (decrementButton && quantityInput) {
    decrementButton.addEventListener("click", function () {
      let currentValue = parseInt(quantityInput.value);
      if (currentValue > 0) {
        // Garante que não decrementa abaixo de zero
        quantityInput.value = currentValue - 1;
        // Chame sua função de recalcular a linha aqui também, se necessário
        recalcularLinha(this.closest("tr"));
      }
    });
  }

  novaLinha
    .querySelector(".idFuncao")
    .addEventListener("change", function (event) {
      const linha = this.closest("tr");
      if (linha) {
        atualizaProdutoOrc(event, linha);
        recalcularLinha(linha);
      } else {
        console.error(
          "Erro: Não foi possível encontrar a linha (<tr>) pai para o select recém-adicionado."
        );
      }
    });

  novaLinha
    .querySelector(".qtdProduto input")
    ?.addEventListener("input", function () {
      recalcularLinha(this.closest("tr"));
    });
  novaLinha
    .querySelector(".qtdDias input")
    ?.addEventListener("input", function () {
      recalcularLinha(this.closest("tr"));
    });

  // Event listeners para campos de ajuda de custo (selects)
  // novaLinha.querySelector('.tpAjdCusto-alimentacao')?.addEventListener('change', function() {
  //     recalcularLinha(this.closest('tr'));
  // });
  // novaLinha.querySelector('.tpAjdCusto-transporte')?.addEventListener('change', function() {
  //     recalcularLinha(this.closest('tr'));
  // });

  novaLinha
    .querySelector(".vlralimentacao-input")
    ?.addEventListener("input", function () {
      recalcularLinha(this.closest("tr"));
    });
  // Usa a nova classe .vlrtransporte-input e o evento 'input'
  novaLinha
    .querySelector(".vlrtransporte-input")
    ?.addEventListener("input", function () {
      recalcularLinha(this.closest("tr"));
    });

  // Event listeners para campos extras (hospedagem, transporte)
  novaLinha
    .querySelector(".hospedagem")
    ?.addEventListener("input", function () {
      recalcularLinha(this.closest("tr"));
    });
  novaLinha
    .querySelector(".transporteExtraInput")
    ?.addEventListener("input", function () {
      recalcularLinha(this.closest("tr"));
      console.log(
        "INPUT TRANSPORTE ALTERADO NO ADICIONARLINHAORC:",
        this.value
      );
    });

  const temPermissaoApagar = temPermissao("Orcamentos", "apagar");
  const deleteButton = novaLinha.querySelector(".btnApagar");
  const idItemInput = novaLinha.querySelector("input.idItemOrcamento");

  if (deleteButton) {
    deleteButton.addEventListener("click", async function (event) {
      event.preventDefault(); // Sempre previne o comportamento padrão inicial

      const linhaParaRemover = this.closest("tr");
      const idOrcamentoItem = idItemInput ? idItemInput.value : null; // Pega o ID na hora do clique

      if (!idOrcamentoItem || idOrcamentoItem.trim() === "") {
        // Se NÃO tem ID (linha nova/vazia), SEMPRE permite remoção local
        console.log("DEBUG: Item sem ID. Permitindo exclusão local.");
        Swal.fire({
          title: "Remover item?",
          text: "Este item ainda não foi salvo no banco de dados. Deseja apenas removê-lo da lista?",
          icon: "warning",
          showCancelButton: true,
          confirmButtonColor: "#3085d6",
          cancelButtonColor: "#d33",
          confirmButtonText: "Sim, remover!",
          cancelButtonText: "Cancelar",
        }).then((result) => {
          if (result.isConfirmed) {
            linhaParaRemover.remove();
            recalcularTotaisGerais();
            calcularLucro();
            Swal.fire("Removido!", "O item foi removido da lista.", "success");
          }
        });
        // } else if (!temPermissaoApagar) {
        //     // Se TEM ID, mas o usuário NÃO tem permissão para apagar
        //     console.warn("Usuário não tem permissão para apagar itens de orçamento. Exibindo Swal.");
        //     Swal.fire({
        //         title: "Acesso Negado!",
        //         text: "Você não tem permissão para apagar itens de orçamento que já estão salvos.",
        //         icon: "error",
        //         confirmButtonText: "Entendi"
        //     });
      } else {
        // Se TEM ID E o usuário TEM permissão para apagar (lógica original)
        let currentItemProduct =
          linhaParaRemover.querySelector(".produto-input")?.value ||
          "este item";
        if (!currentItemProduct || currentItemProduct.trim() === "") {
          const produtoCell = linhaParaRemover.querySelector(".produto");
          if (produtoCell) {
            currentItemProduct = produtoCell.textContent.trim();
          }
        }

        const { isConfirmed } = await Swal.fire({
          title: `Tem Certeza que deseja EXCLUIR o item "${currentItemProduct}" ?`,
          text: "Você não poderá reverter esta ação!",
          icon: "warning",
          showCancelButton: true,
          confirmButtonColor: "#3085d6",
          cancelButtonColor: "#d33",
          confirmButtonText: "Sim, deletar!",
          cancelButtonText: "Cancelar",
        });

        if (isConfirmed) {
          try {
            const idOrcamentoPrincipal =
              document.getElementById("idOrcamento").value;
            console.log(
              "IDS ORCAMENTO:",
              idOrcamentoPrincipal,
              idOrcamentoItem
            );
            await fetchComToken(
              `/orcamentos/${idOrcamentoPrincipal}/itens/${idOrcamentoItem}`,
              {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
              }
            );

            linhaParaRemover.remove();
            recalcularTotaisGerais();
            calcularLucro();

            Swal.fire(
              "Deletado!",
              "O item foi removido com sucesso.",
              "success"
            );
          } catch (error) {
            console.error("Erro ao deletar item:", error);
            Swal.fire(
              "Erro!",
              `Não foi possível deletar o item: ${error.message}`,
              "error"
            );
          }
        }
      }
    });

    if (!temPermissaoApagar) {
      deleteButton.classList.add("btnDesabilitado");
      deleteButton.title =
        "Você não tem permissão para apagar itens de orçamento que já estão salvos.";
    }
  }

  recalcularLinha(novaLinha);
  recalcularTotaisGerais();
  aplicarMascaraMoeda();
  limparSelects();
}


async function adicionarLinhaAdicional(isBonificado = false) {
  // if (isCleaning) return;
    // 🎯 NOVA LÓGICA: Perguntar se é Aditivo ou Extra Bonificado usando botões nativos
    //if (isBonificado === false) { 
    if (isCleaning) {
      isBonificado = false; // Define como Aditivo por padrão na limpeza
      // Pula direto para a lógica de inserção (o bloco do Swal abaixo não executa)
    } else if (isBonificado === false) {
        const result = await Swal.fire({
            title: 'Tipo de Item Adicional',
            text: "Selecione o tipo de item que deseja adicionar:",
            icon: 'question',
            showCancelButton: true,
            showDenyButton: true,
            confirmButtonText: 'Aditivo ($)',
            denyButtonText: 'Extra Bonificado (Grátis)',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#3085d6',
            denyButtonColor: '#28a745',
        });

        if (result.isDismissed && result.dismiss === Swal.DismissReason.cancel) return; // Usuário cancelou no botão "Cancelar"
        if (!result.isConfirmed && !result.isDenied) return; // Proteção extra para fechamento do modal

        // result.isConfirmed -> Aditivo ($)
        // result.isDenied -> Extra Bonificado (Grátis)
        isBonificado = result.isDenied;
    }
    
    // 1. Configurações Iniciais e Preparação do DOM
    liberarSelectsParaAdicional();

    const tabelaBody = document.getElementById("tabela")?.getElementsByTagName("tbody")[0];
    if (!tabelaBody) {
        console.error("Erro: Elemento <tbody> da tabela de orçamento não encontrado.");
        return;
    }

    const ufAtual = document.getElementById("ufmontagem")?.value || "SP";
    const initialDisplayStyle = ufAtual.toUpperCase() === "SP" ? "display: none;" : "display: table-cell;";

    const novaLinha = tabelaBody.insertRow();

    // Aplica classes e dataset para identificação e estilo
    novaLinha.classList.add("liberada", "linhaAdicional", "adicional");
    novaLinha.dataset.adicional = "true";
    novaLinha.dataset.bonificado = isBonificado ? "true" : "false"; // Marcação para o cálculo
    novaLinha.dataset.extrabonificado = isBonificado ? "true" : "false"; // ✅ Novo atributo padronizado
    novaLinha.dataset.vlrbase = "0"; // Base inicial

    // Estilização visual para bonificados (Fundo verde claro + borda)
    if (isBonificado) {
        novaLinha.style.backgroundColor = "#f0fff4";
        novaLinha.style.borderLeft = "4px solid #48bb78"; // Borda verde
    }

    // 2. HTML da Nova Linha
    novaLinha.innerHTML = `
      <td style="display: none;"><input type="hidden" class="idItemOrcamento" value=""></td>
      <td style="display: none;"><input type="hidden" class="idFuncao" value=""></td>
      <td style="display: none;"><input type="hidden" class="idEquipamento" value=""></td>
      <td style="display: none;"><input type="hidden" class="idSuprimento" value=""></td>
      <td style="display: none;"><input type="hidden" class="isAdicional" value="true"></td>
      <td style="display: none;"><input type="hidden" class="isBonificadoHidden" value="${isBonificado}"></td>

      <td class="Proposta">
        <div class="checkbox-wrapper-33">
          <label class="checkbox">
            <input class="checkbox__trigger visuallyhidden" type="checkbox" ${isBonificado ? '' : 'checked'} ${isBonificado ? 'disabled' : ''} />
              <span class="checkbox__symbol">
                <svg aria-hidden="true" class="icon-checkbox" width="28px" height="28px" viewBox="0 0 28 28">
                  <path d="M4 14l8 7L24 7"></path>
                </svg>
              </span>
          </label>
          ${isBonificado ? '<br><span style="font-size: 10px; color: #48bb78; font-weight: bold;">🎁 BONIFICADO</span>' : ''}
        </div>
      </td>

      <td class="cacheFechado">
            <div class="checkbox-wrapper-33">
                <label class="checkbox">
                    <input class="checkbox__trigger visuallyhidden chk-cache-fechado" type="checkbox" onchange="toggleEditavel(this)" />
                    <span class="checkbox__symbol">
                        <svg aria-hidden="true" class="icon-checkbox" width="28px" height="28px" viewBox="0 0 28 28" version="1" xmlns="http://www.w3.org/2000/svg">
                            <path d="M4 14l8 7L24 7"></path>
                        </svg>
                    </span>
                    <p class="checkbox__textwrapper"></p>
                </label>
            </div>
        </td>

      <td class="Categoria"><input type="text" class="categoria-input" value=""></td>

      <td class="qtdProduto">
        <div class="add-less">
          <input type="number" class="qtdProduto" min="0" value="1">
            <div class="Bt">
              <button type="button" class="increment">+</button>
              <button type="button" class="decrement">-</button>
            </div>
        </div>
      </td>

      <td class="produto">
        <input type="text" class="produto-input" value="" placeholder="Nome do item...">
        ${isBonificado ? '<br><small style="color: #28a745; font-weight: bold;">[EXTRA BONIFICADO]</small>' : ''}
      </td>

      <td class="setor"><input type="text" class="setor-input" value=""></td>

      <td class="qtdDias">
        <div class="add-less">
          <input type="number" readonly class="qtdDias" min="0" value="1">
        </div>
      </td>

      <td class="Periodo">
        <div class="flatpickr-container">
          <input type="text" class="datas datas-item" data-input required readonly placeholder="Clique para Selecionar">
        </div>
      </td>
      <td class="descontoItem Moeda">
        <div class="Acres-Desc">
          <input type="text" class="ValorInteiros" value="R$ 0,00" ${isBonificado ? 'readonly' : ''}>
          <input type="text" class="valorPerCent" value="0%" ${isBonificado ? 'readonly' : ''}>
        </div>
      </td>
      <td class="acrescimoItem Moeda">
        <div class="Acres-Desc">
          <input type="text" class="ValorInteiros" value="R$ 0,00" ${isBonificado ? 'readonly' : ''}>
          <input type="text" class="valorPerCent" value="0%" ${isBonificado ? 'readonly' : ''}>
        </div>
      </td>
      <td class="vlrVenda Moeda" data-original-venda="0">${formatarMoeda(0)}</td>
      <td class="totVdaDiaria Moeda">${formatarMoeda(0)}</td>
      <td class="vlrCusto Moeda">${formatarMoeda(0)}</td>
      <td class="totCtoDiaria Moeda">${formatarMoeda(0)}</td>
      <td class="ajdCusto Moeda alimentacao">
        <input type="text" class="vlralimentacao-input" value="${formatarMoeda(0)}">
      </td>
      <td class="ajdCusto Moeda transporte">
        <input type="text" class="vlrtransporte-input" value="${formatarMoeda(0)}">
      </td>
      <td class="totAjdCusto Moeda">${formatarMoeda(0)}</td>
      <td class="extraCampo" style="${initialDisplayStyle}">
        <input type="text" class="hospedagem" value=" R$ 0,00">
      </td>
      <td class="extraCampo" style="${initialDisplayStyle}">
        <input type="text" class="transporteExtraInput" value=" R$ 0,00">
      </td>
      <td class="totGeral Moeda">${formatarMoeda(0)}</td>
      <td>
        <div class="Acao">
          <button class="btnApagar" type="button">
            <svg class="delete-svgIcon" viewBox="0 0 448 512">
              <path d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z"></path>
            </svg>
          </button>
        </div>
      </td>
    `;

    // Insere no topo
    tabelaBody.insertBefore(novaLinha, tabelaBody.firstChild);

    // 3. Listeners de Desconto/Acréscimo
    const attachAcresDescListeners = (linha, type) => {
        const selector = `.${type}Item`;
        const itemCell = linha.querySelector(selector);
        if (!itemCell) return;

        const valorInput = itemCell.querySelector(".ValorInteiros");
        const percentualInput = itemCell.querySelector(".valorPerCent");

        if (valorInput) {
            valorInput.addEventListener("input", function () {
                window.lastEditedFieldType = "valor";
                recalcularDescontoAcrescimo(this, type, "valor", this.closest("tr"));
            });
            valorInput.addEventListener("blur", function () {
                this.value = formatarMoeda(desformatarMoeda(this.value));
            });
        }

        if (percentualInput) {
            percentualInput.addEventListener("input", function () {
                window.lastEditedFieldType = "percentual";
                recalcularDescontoAcrescimo(this, type, "percentual", this.closest("tr"));
            });
            percentualInput.addEventListener("blur", function () {
                this.value = formatarPercentual(desformatarPercentual(this.value));
            });
        }
    };

    attachAcresDescListeners(novaLinha, "desconto");
    attachAcresDescListeners(novaLinha, "acrescimo");

    // 4. Inicialização do Flatpickr
    const novoInputData = novaLinha.querySelector('input[type="text"].datas');
    if (novoInputData && typeof flatpickr !== "undefined") {
        flatpickr(novoInputData, typeof commonFlatpickrOptionsTable !== "undefined" ? commonFlatpickrOptionsTable : {});
    }

    // 5. Event Listeners para Quantidade e Botões +/-
    const incrementButton = novaLinha.querySelector(".qtdProduto .increment");
    const decrementButton = novaLinha.querySelector(".qtdProduto .decrement");
    const quantityInput = novaLinha.querySelector('.qtdProduto input[type="number"]');

    if (incrementButton && quantityInput) {
        incrementButton.addEventListener("click", function () {
            // VERIFICAÇÃO: Se o checkbox de cache fechado estiver marcado, não faz nada
            const chk = novaLinha.querySelector(".chk-cache-fechado");
            if (chk && chk.checked) return; 

            quantityInput.value = parseInt(quantityInput.value) + 1;
            recalcularLinha(this.closest("tr"));
        });
    }

    if (decrementButton && quantityInput) {
        decrementButton.addEventListener("click", function () {
            // VERIFICAÇÃO: Se o checkbox de cache fechado estiver marcado, não faz nada
            const chk = novaLinha.querySelector(".chk-cache-fechado");
            if (chk && chk.checked) return;

            let currentValue = parseInt(quantityInput.value);
            if (currentValue > 0) {
                quantityInput.value = currentValue - 1;
                recalcularLinha(this.closest("tr"));
            }
        });
    }

    if (incrementButton && quantityInput) {
        incrementButton.addEventListener("click", function () {
            quantityInput.value = parseInt(quantityInput.value) + 1;
            recalcularLinha(this.closest("tr"));
        });
    }

    if (decrementButton && quantityInput) {
        decrementButton.addEventListener("click", function () {
            let currentValue = parseInt(quantityInput.value);
            if (currentValue > 0) {
                quantityInput.value = currentValue - 1;
                recalcularLinha(this.closest("tr"));
            }
        });
    }

    // Inputs Gerais que disparam recálculo
    novaLinha.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', () => recalcularLinha(novaLinha));
    });

    // 6. Lógica do Botão Apagar
    const deleteButton = novaLinha.querySelector(".btnApagar");
    if (deleteButton) {
        deleteButton.addEventListener("click", async function (event) {
            event.preventDefault();
            const result = await Swal.fire({
                title: "Remover item?",
                text: "Deseja remover este adicional da lista?",
                icon: "warning",
                showCancelButton: true,
                confirmButtonText: "Sim, remover!",
                cancelButtonText: "Cancelar",
            });

            if (result.isConfirmed) {
                novaLinha.remove();
                recalcularTotaisGerais();
                if (typeof calcularLucro === "function") calcularLucro();
            }
        });
    }

    // 7. Recálculos e Formatação Finais
    recalcularLinha(novaLinha);
    recalcularTotaisGerais();
    if (typeof aplicarMascaraMoeda === "function") aplicarMascaraMoeda();
    if (typeof limparSelects === "function") limparSelects();
}

function removerLinhaOrc(botao) {
  let linha = botao.closest("tr"); // Encontra a linha mais próxima
  removerLinha(linha); // Remove a linha
}

function initializeAllFlatpickrsInModal() {
  //    console.log("Inicializando Flatpickr para todos os campos de data no modal...");

  for (const id in flatpickrInstances) {
    if (flatpickrInstances.hasOwnProperty(id)) {
      const instance = flatpickrInstances[id];
      if (instance && typeof instance.destroy === "function") {
        instance.destroy();
        //   console.log(`Flatpickr global #${id} destruído.`);
      }
    }
  }
  flatpickrInstances = {}; // Zera o objeto após destruir

  // Destruir Flatpickrs das linhas da tabela (os que você gerencia em flatpickrInstancesOrcamento)
  if (flatpickrInstancesOrcamento && flatpickrInstancesOrcamento.length > 0) {
    flatpickrInstancesOrcamento.forEach((instance) => {
      if (instance && typeof instance.destroy === "function") {
        instance.destroy();
        console.log(
          "Flatpickr de linha da tabela destruído:",
          instance.element
        );
      }
    });
    flatpickrInstancesOrcamento = []; // Zera o array após destruir
  }

  // --- PASSO 2: Inicializar/Recriar todas as instâncias Flatpickr ---

  // Inicializa os campos globais
  const dateInputIds = [
    "periodoPreEvento",
    "periodoInfraMontagem",
    "periodoMontagem",
    "periodoMarcacao",
    "periodoRealizacao",
    "periodoDesmontagem",
    "periodoDesmontagemInfra",
    "periodoPosEvento",
  ];
  dateInputIds.forEach((id) => {
    const element = document.getElementById(id);
    if (element) {
      // Sempre crie uma nova instância aqui, pois as antigas foram destruídas
      const picker = flatpickr(element, commonFlatpickrOptions);
      flatpickrInstances[id] = picker;
      //  console.log(`Flatpickr inicializado para campo global #${id}`);
    } else {
      console.warn(
        `Elemento com ID '${id}' não encontrado para inicialização do Flatpickr.`
      );
    }
  });

  // Inicializa Flatpickr para os inputs '.datas' que JÁ EXISTEM na tabela
  // (Isso será executado quando o modal é aberto e a tabela já está renderizada com itens)
  const tabela = document.getElementById("tabela");
  if (tabela) {
    // Seleciona os inputs type="text" visíveis, não os hidden que o Flatpickr pode criar
    const dataInputs = tabela.querySelectorAll('input[type="text"].datas-item'); // Use '.datas-item' para ser mais específico
    dataInputs.forEach((input) => {
      const fpInstance = flatpickr(input, commonFlatpickrOptionsTable); // Use commonFlatpickrOptionsTable
      flatpickrInstancesOrcamento.push(fpInstance); // Adiciona a nova instância ao array
      console.log(
        "Flatpickr inicializado para input da tabela (existente):",
        input
      );
    });
  } else {
    console.warn(
      "Tabela de orçamento não encontrada para inicializar Flatpickrs de linha."
    );
  }

  console.log(
    "✅ Todos os Flatpickrs no modal de orçamento inicializados/reinicializados."
  );

  // // 1. Inicializa os campos globais com a função já existente
  // inicializarFlatpickrsGlobais(); // Chamamos a função que você já tinha

  // // 2. Inicializa Flatpickr para os inputs '.datas' que JÁ EXISTEM na tabela no carregamento inicial do modal
  // document.querySelectorAll(".datas").forEach(input => {
  //     if (!input._flatpickr) { // Evita reinicialização
  //         flatpickr(input, commonFlatpickrOptions);
  //         console.log("Flatpickr inicializado para input da tabela (existente):", input);
  //     } else {
  //         console.log("Flatpickr já está inicializado para input da tabela (existente), pulando.");
  //     }
  // });
}
initializeAllFlatpickrsInModal = initializeAllFlatpickrsInModal;

// Crie esta nova função
function inicializarFlatpickrsGlobais() {
  //console.log("Inicializando Flatpickr para todos os campos de data (globais)...");
  const dateInputIds = [
    "periodoPreEvento",
    "periodoInfraMontagem",
    "periodoMontagem",
    "periodoMarcacao",
    "periodoRealizacao",
    "periodoDesmontagem",
    "periodoDesmontagemInfra",
    "periodoPosEvento",
  ];

  dateInputIds.forEach((id) => {
    const element = document.getElementById(id);
    if (element) {
      if (!element._flatpickr) {
        const picker = flatpickr(element, commonFlatpickrOptions);
        flatpickrInstances[id] = picker;
        //  console.log(`Flatpickr inicializado e salvo para campo global #${id}`);
      } else {
        //    console.log(`Flatpickr para campo global #${id} já estava inicializado.`);

        flatpickrInstances[id] = element._flatpickr;
      }
    } else {
      console.warn(
        `Elemento com ID '${id}' não encontrado para inicialização do Flatpickr.`
      );
    }
  });
}

// No seu Orcamentos.js

async function gerarObservacoesProposta(linhas) {
  const obsTextarea = document.getElementById("ObservacaoProposta");
  if (!obsTextarea) return;

  const textoAnterior = obsTextarea.value.trim(); // preserva o que já estava
  const linhasProcessadas = new Set();

  let novoTexto = "";

  for (const linha of linhas) {
    const produtoEl = linha.querySelector(".produto");
    const produto = produtoEl?.innerText?.trim();
    if (!produto) continue;

    const qtdDias = linha.querySelector(".qtdDias input")?.value?.trim();
    const qtdItens = linha.querySelector(".qtdProduto input")?.value?.trim();
    const datasRaw =
      linha.querySelector(".datas")?.value?.trim().replace(" to ", " até: ") ||
      "";

    const idUnico = `${produto}_${qtdItens}_${qtdDias}_${datasRaw}`;
    if (linhasProcessadas.has(idUnico)) {
      console.log(`🔁 Linha duplicada detectada (${produto}). Pulando.`);
      continue;
    }
    linhasProcessadas.add(idUnico);

    console.log(`🔎 Verificando produto: ${produto}`);

    let obs = "";
    try {
      const funcao = await fetchComToken(
        `/orcamentos/obsfuncao?nome=${encodeURIComponent(produto)}`
      );
      obs = funcao?.obsfuncao?.trim();
    } catch (erro) {
      console.warn(
        `❌ Erro ao buscar observação da função '${produto}':`,
        erro
      );
    }

    if (!obs) continue;

    let resumoTexto = "";
    if (qtdItens !== "0") {
      resumoTexto = `${qtdItens} ${produto}`;
      if (qtdDias !== "0") {
        resumoTexto += ` – atendimento por ${qtdDias} dias – iniciando de: ${datasRaw}`;
      }
    }

    const textoFormatado = [
      `${produto.toUpperCase()}`,
      "",
      obs,
      "",
      resumoTexto,
    ].join("\n");

    novoTexto += textoFormatado + "\n\n";
  }

  // Junta o texto antigo + novo, separados por duas quebras se necessário
  obsTextarea.value = [textoAnterior, novoTexto.trim()]
    .filter(Boolean)
    .join("\n\n");
}

// Certifique-se que linhaCounter está definida globalmente no topo do seu arquivo
let linhaCounter = 0;

function inicializarFlatpickr(inputElement, onDateChangeCallback = null) {
  //  console.log("Inicializando Flatpickr para o input:", inputElement);
  if (!inputElement) {
    console.error("Elemento de input inválido para inicializar Flatpickr.");
    return;
  }

  // Se já existe uma instância Flatpickr para este input, destrua-a
  if (inputElement._flatpickr) {
    inputElement._flatpickr.destroy();
    delete flatpickrInstances[inputElement.id]; // Remova do nosso gerenciador também
  }

  const config = {
    mode: "range",
    dateFormat: "d/m/Y", // Formato dia/mês/ano
    locale: flatpickr.l10ns.pt, // Importante: use 'pt_br' para português do Brasil
    altInput: true, // Se você quer o input formatado de um jeito e o valor real de outro
    altFormat: "d/m/Y", // Formato visível para o usuário
    enableTime: false,
    noCalendar: false,
    // O `appendTo` é crucial para modais
    appendTo: inputElement.closest(".modal-content") || document.body, // Se não estiver em modal, anexa ao body
    positionElement: inputElement,
  };

  // Adiciona o callback onChange SOMENTE se ele for fornecido
  if (onDateChangeCallback) {
    config.onChange = function (selectedDates, dateStr, instance) {
      onDateChangeCallback(selectedDates, dateStr, instance);
    };
  }

  // Cria e armazena a instância Flatpickr
  inputElement._flatpickr = flatpickr(inputElement, config);
  flatpickrInstances[inputElement.id] = inputElement._flatpickr; // Armazena no nosso objeto
  console.log(
    `Flatpickr inicializado para #${inputElement.id} com config:`,
    config
  ); // Adicionado para depuração
}

function atualizarQtdDias(input, selectedDatesArray) {
  console.log("⏱️ Campo de datas alterado:", input.value);

  var linha = input.closest("tr");
  var inputQtdDias = linha.querySelector("input.qtdDias");
  
  // Verifica se o modo Cachê Fechado está ativo
  var chkCacheFechado = linha.querySelector(".chk-cache-fechado"); 

  if (chkCacheFechado && chkCacheFechado.checked) {
    console.log("🚫 Cachê Fechado ativo: Mantendo valor manual e recalculando financeiros.");
    // No modo manual, não mexemos no inputQtdDias.value, apenas recalculamos a linha
    if (typeof recalcularLinha === "function") {
      recalcularLinha(linha);
    }
    return; // Interrompe aqui
  }

  // Lógica padrão de cálculo automático (só executa se o checkbox estiver desmarcado)
  let diffDias = 0;
  if (selectedDatesArray && selectedDatesArray.length === 2) {
    const startDate = selectedDatesArray[0];
    const endDate = selectedDatesArray[1];

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      diffDias = "-";
    } else if (endDate >= startDate) {
      const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
      diffDias = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    } else {
      diffDias = "-";
    }
  } else if (selectedDatesArray && selectedDatesArray.length === 1 && selectedDatesArray[0]) {
    diffDias = !isNaN(selectedDatesArray[0].getTime()) ? 1 : "-";
  } else {
    diffDias = 0;
  }

  inputQtdDias.value = diffDias;
  console.log("📤 Valor automático enviado para input.qtdDias:", inputQtdDias.value);

  if (typeof recalcularLinha === "function") {
    recalcularLinha(linha);
  }
}


function atualizarUFOrc(selectLocalMontagem) {
  // 1. Verifica se o elemento existe
  if (!selectLocalMontagem) return;

  // 2. Verifica se existe uma opção selecionada (selectedIndex >= 0)
  // e se essa opção não é a "Selecione..." (geralmente value "")
  const selectedOption = selectLocalMontagem.options[selectLocalMontagem.selectedIndex];
  
  if (!selectedOption || selectLocalMontagem.value === "") {
    const ufInput = document.getElementById("ufmontagem");
    if (ufInput) ufInput.value = ""; // Limpa o campo UF se nada estiver selecionado
    return;
  }

  // 3. Tenta pegar o atributo de forma segura
  const uf = selectedOption.getAttribute("data-uf");
  
  const ufInput = document.getElementById("ufmontagem");
  if (ufInput) {
    ufInput.value = uf || "";
  }
}

function ceilToTenCents(value, factor) {
    if (typeof value !== 'number' || isNaN(value)) {
        return 0;
    }
    const reajustedValue = value * factor;
    // Arredonda para o múltiplo de 0.10 (dez centavos) mais próximo (ceil)
    const roundedValue = Math.ceil(reajustedValue * 10) / 10;
    return parseFloat(roundedValue.toFixed(2));
}


// function atualizaProdutoOrc(event) {
//     let select = event.target;
//     console.log("Select alterado:", select);
//     let selectedOption = select.options[select.selectedIndex];
//     let valorSelecionado = selectedOption.value;
//     console.log("Valor :", valorSelecionado);
//     let produtoSelecionado = selectedOption.getAttribute("data-descproduto");
//     console.log("Produto selecionado:", produtoSelecionado);
//     let vlrCusto = selectedOption.getAttribute("data-cto");
//     let vlrVenda = selectedOption.getAttribute("data-vda");
//     let vlrCustoNumerico = parseFloat(vlrCusto) || 0;
//     let vlrVendaNumerico = parseFloat(vlrVenda) || 0;
//     if (typeof bProximoAno !== 'undefined' && bProximoAno) {
//       // Mantém o reajuste sempre que alterar/adicionar item
//       console.log("Aplicando reajuste de 'Próximo Ano' a item recém-selecionado.");
//       const fatorGeral = GLOBAL_PERCENTUAL_GERAL > 0 ? 1 + GLOBAL_PERCENTUAL_GERAL / 100 : 1;
//       const fatorAjuda = GLOBAL_PERCENTUAL_AJUDA > 0 ? 1 + GLOBAL_PERCENTUAL_AJUDA / 100 : 1;
//       vlrCustoNumerico = ceilToTenCents(vlrCustoNumerico, fatorGeral);
//       vlrVendaNumerico = ceilToTenCents(vlrVendaNumerico, fatorGeral);
//       if (typeof vlrAlimentacao !== 'undefined') {
//         vlrAlimentacao = ceilToTenCents(parseFloat(vlrAlimentacao) || 0, fatorAjuda);
//       }
//       if (typeof vlrTransporte !== 'undefined') {
//         vlrTransporte = ceilToTenCents(parseFloat(vlrTransporte) || 0, fatorAjuda);
//       }
//     }
//     let tabela = document.getElementById("tabela");
//     if (!tabela) return;
//     let ultimaLinha = tabela.querySelector("tbody tr:first-child");
//     if (ultimaLinha) {
//       ultimaLinha.dataset.valorTabela = vlrVendaNumerico;
//       // Mantém o valor reajustado no campo base para futuras edições
//       ultimaLinha.dataset.vlrbase = vlrVendaNumerico.toString();
//         let celulaProduto = ultimaLinha.querySelector(".produto");
//         let celulaCategoria = ultimaLinha.querySelector(".Categoria");
//         let inputIdFuncao = ultimaLinha.querySelector("input.idFuncao");
//         let inputIdEquipamento = ultimaLinha.querySelector("input.idEquipamento");
//         let inputIdSuprimento = ultimaLinha.querySelector("input.idSuprimento");
//         if (inputIdFuncao) inputIdFuncao.value = "";
//         if (inputIdEquipamento) inputIdEquipamento.value = "";
//         if (inputIdSuprimento) inputIdSuprimento.value = "";
//         if (celulaProduto) {
//             celulaProduto.textContent = produtoSelecionado;
//         }
//         if (celulaCategoria && Categoria !== "Pavilhao") {
//             celulaCategoria.textContent = Categoria;
//         }
//         console.log(" A categoria é :", Categoria);
//         if (select.classList.contains("idFuncao")) {
//             inputIdFuncao.value = valorSelecionado;
//         } else if (select.classList.contains("idEquipamento")) {
//             inputIdEquipamento.value = valorSelecionado;
//         } else if (select.classList.contains("idSuprimento")) {
//             inputIdSuprimento.value = valorSelecionado;
//         }
//         const spanAlimentacao = ultimaLinha.querySelector(".vlralimentacao-input");
//         const spanTransporte = ultimaLinha.querySelector(".vlrtransporte-input");
//         if (spanAlimentacao) {
//             spanAlimentacao.textContent = formatarMoeda(vlrAlimentacao);
//             ultimaLinha.querySelector(
//                 ".ajdCusto.alimentacao"
//             ).dataset.originalAjdcusto = vlrAlimentacao.toString();
//         }
//         if (spanTransporte) {
//             spanTransporte.textContent = formatarMoeda(vlrTransporte);
//             ultimaLinha.querySelector(
//                 ".ajdCusto.transporte"
//             ).dataset.originalAjdcusto = vlrTransporte.toString();
//         }
//         let celulaVlrCusto = ultimaLinha.querySelector(".vlrCusto");
//         if (celulaVlrCusto) celulaVlrCusto.textContent = formatarMoeda(vlrCustoNumerico);
//         console.log(" valor de Custo é:", vlrCustoNumerico);
//         let celulaVlrVenda = ultimaLinha.querySelector(".vlrVenda");
//         if (celulaVlrVenda) {
//             celulaVlrVenda.textContent = formatarMoeda(vlrVendaNumerico);
//             celulaVlrVenda.dataset.originalVenda = vlrVendaNumerico.toString();
//         }
//         ultimaLinha.dataset.vlrbase = vlrVendaNumerico.toString();
//         console.log(" valor de Venda é:", vlrVendaNumerico);
//     }
//     gerarObservacoesProposta([ultimaLinha]);
//     recalcularLinha(ultimaLinha);
// }



async function atualizaProdutoOrc(event, linhaFornecida) {
    let select = event.target;
    
    // 1. BUSCA EXAUSTIVA PELA LINHA (TR)
    let linha = linhaFornecida || select.closest('tr');

    // Plano B: Se o select estiver dentro de um componente customizado que esconde o original
    if (!linha) {
        // Tenta encontrar pelo ID ou classe pai se o closest falhar por causa de Shadow DOM ou bibliotecas de Select
        const container = select.parentElement;
        if (container) {
            linha = container.closest('tr');
        }
    }

    if (!linha) {
        // Plano C: Se ainda assim for null, tenta pegar a última linha clicada ou a primeira da tabela (Emergência)
        console.warn("Aviso: closest('tr') falhou. Tentando localizar via DOM estável.");
        linha = document.querySelector("#tabela tbody tr:first-child"); 
    }

    if (!linha) {
        console.error("Erro Fatal: Não foi possível encontrar a linha (TR) de nenhuma forma.");
        return;
    }

    console.log("Select alterado com sucesso na linha:", linha);

    let selectedOption = select.options[select.selectedIndex];
    if (!selectedOption) return;

    // Captura de dados com Fallback para evitar erros de undefined
    let valorSelecionado = selectedOption.value;
    let produtoSelecionado = selectedOption.getAttribute("data-descproduto") || "";
    let vlrCusto = selectedOption.getAttribute("data-cto") || "0";
    let vlrVenda = selectedOption.getAttribute("data-vda") || "0";
    
    // Garantindo que Categoria e Ajudas existam no escopo
    let Categoria = selectedOption.getAttribute("data-categoria") || "Produto(s)";
    let vlrAlimentacao = parseFloat(selectedOption.getAttribute("data-vlr_alimentacao")) || 0;
    let vlrTransporte = parseFloat(selectedOption.getAttribute("data-vlr_transporte")) || 0;

    let vlrCustoNumerico = parseFloat(vlrCusto) || 0;
    let vlrVendaNumerico = parseFloat(vlrVenda) || 0;
    

    // 2. PROTEÇÃO CONTRA REAJUSTE DUPLO
    if (linha.dataset.reajustadoTotal === 'true') return;

    if (typeof bProximoAno !== 'undefined' && bProximoAno && linha.dataset.reajustadoProximoAno === 'true') {
        //atualizarApenasDescricao(linha, produtoSelecionado, Categoria, valorSelecionado);
        recalcularLinha(linha);
        return;
    }

    // 3. APLICA REAJUSTE (Próximo Ano)
    if (typeof bProximoAno !== 'undefined' && bProximoAno) {
        const fG = (typeof GLOBAL_PERCENTUAL_GERAL !== 'undefined') ? 1 + GLOBAL_PERCENTUAL_GERAL / 100 : 1;
        const fA = (typeof GLOBAL_PERCENTUAL_AJUDA !== 'undefined') ? 1 + GLOBAL_PERCENTUAL_AJUDA / 100 : 1;
        
        vlrCustoNumerico = ceilToTenCents(vlrCustoNumerico, fG);
        vlrVendaNumerico = ceilToTenCents(vlrVendaNumerico, fG);
        vlrAlimentacao = ceilToTenCents(vlrAlimentacao, fA);
        vlrTransporte = ceilToTenCents(vlrTransporte, fA);
    }

    // 4. ATUALIZAÇÃO DA LINHA
    linha.dataset.vlrbase = vlrVendaNumerico.toString();
    linha.dataset.valorTabela = vlrVendaNumerico;

    // Atualiza Descrição e Categoria
    const celulaProd = linha.querySelector(".produto");
    const celulaCat = linha.querySelector(".Categoria");
    if (celulaProd) celulaProd.textContent = produtoSelecionado;
    if (celulaCat && Categoria !== "Pavilhao") celulaCat.textContent = Categoria;

    // Seta os IDs nos inputs hidden
    const inputFuncao = linha.querySelector("input.idFuncao");
    const inputEquip = linha.querySelector("input.idEquipamento");
    const inputSupri = linha.querySelector("input.idSuprimento");

    if (select.classList.contains("idFuncao") && inputFuncao) inputFuncao.value = valorSelecionado;
    if (select.classList.contains("idEquipamento") && inputEquip) inputEquip.value = valorSelecionado;
    if (select.classList.contains("idSuprimento") && inputSupri) inputSupri.value = valorSelecionado;

    // Atualiza Ajudas de Custo (Visual e Dataset)
    const spanAlim = linha.querySelector(".vlralimentacao-input");
    const spanTrans = linha.querySelector(".vlrtransporte-input");
    const tdAlim = linha.querySelector(".ajdCusto.alimentacao");
    const tdTrans = linha.querySelector(".ajdCusto.transporte");

    if (spanAlim) spanAlim.textContent = formatarMoeda(vlrAlimentacao);
    if (tdAlim) tdAlim.dataset.originalAjdcusto = vlrAlimentacao.toString();
    
    if (spanTrans) spanTrans.textContent = formatarMoeda(vlrTransporte);
    if (tdTrans) tdTrans.dataset.originalAjdcusto = vlrTransporte.toString();

    // Atualiza Valores Financeiros
    const celulaVlrCusto = linha.querySelector(".vlrCusto");
    const celulaVlrVenda = linha.querySelector(".vlrVenda");

    if (celulaVlrCusto) celulaVlrCusto.textContent = formatarMoeda(vlrCustoNumerico);
    if (celulaVlrVenda) {
        celulaVlrVenda.textContent = formatarMoeda(vlrVendaNumerico);
        celulaVlrVenda.dataset.originalVenda = vlrVendaNumerico.toString();
    }

    // 5. FINALIZAÇÃO
    // atualizarApenasDescricao(linha, produtoSelecionado, Categoria, valorSelecionado);
    gerarObservacoesProposta([linha]);
    recalcularLinha(linha);
}



// Sua função de atualização de valores (mantém-se a mesma)
function atualizarValoresAjdCustoNaLinha(linha) {
  // ... (sua implementação atual de atualizarValoresAjdCustoNaLinha) ...
  console.log("Chamando atualizarValoresAjdCustoNaLinha para:", linha);

  //const selectAlimentacao = linha.querySelector('.tpAjdCusto-alimentacao');
  // const selectTransporte = linha.querySelector('.tpAjdCusto-transporte');
  const idFuncaoCell = linha.querySelector(".idFuncao");

  // const valorAlimentacaoSpan = linha.querySelector('.valorbanco.alimentacao');
  // const valorTransporteSpan = linha.querySelector('.valorbanco.transporte');

  const celulaAlimentacao = linha.querySelector(".ajdCusto.alimentacao");
  const celulaTransporte = linha.querySelector(".ajdCusto.transporte");

  const totAjdCustoCell = linha.querySelector(".totAjdCusto");

  let totalAlimentacaoLinha = 0;
  let totalTransporteLinha = 0;
  let totalAjdCustoLinha = 0;

  const idFuncaoDaLinha = linha.dataset.idfuncao;
  // Atualiza o texto da célula com o ID da função

  console.log("ID da função na linha:", idFuncaoDaLinha);

  let baseAlimentacao = 0;
  let baseTransporte = 0;

  if (idFuncaoDaLinha && funcoesDisponiveis && funcoesDisponiveis.length > 0) {
    const funcaoCorrespondente = funcoesDisponiveis.find(
      (f) => String(f.idfuncao) === idFuncaoDaLinha
    );
    if (funcaoCorrespondente) {
      //  baseAlmoco = parseFloat(funcaoCorrespondente.almoco || 0);
      baseAlimentacao = parseFloat(funcaoCorrespondente.alimentaao || 0);
      baseTransporte = parseFloat(funcaoCorrespondente.transporte || 0);
      console.log(
        `Bases lidas (da linha ${idFuncaoDaLinha}): Alimentação: ${baseAlimentacao}, Transporte: ${baseTransporte}`
      );
    } else {
      // Se idFuncaoDaLinha existe mas a função não foi encontrada, usa os globais como fallback
      console.warn(
        `Função com ID ${idFuncaoDaLinha} não encontrada em funcoesDisponiveis. Usando valores globais.`
      );
      //baseAlmoco = parseFloat(vlrAlmoco || 0); // Use o valor global aqui
      baseAlimentacao = parseFloat(vlrAlimentacao || 0); // Use o valor global aqui
      baseTransporte = parseFloat(vlrTransporte || 0); // Use o valor global aqui
    }
  } else {
    // Se idFuncaoDaLinha não existe (para novas linhas) ou funcoesDisponiveis está vazio,
    // usa os valores globais como padrão.
    console.log(
      "idFuncaoDaLinha não encontrado ou funcoesDisponiveis vazio. Usando valores globais."
    );
    baseAlimentacao = parseFloat(vlrAlimentacao || 0); // Use o valor global aqui
    baseTransporte = parseFloat(vlrTransporte || 0); // Use o valor global aqui
  }

  const qtdItens = parseFloat(linha.querySelector(".qtdProduto input")?.value || 0) || 0;
  const qtdDias = parseFloat(linha.querySelector(".qtdDias input")?.value || 0) || 0;

  const alimEl = linha.querySelector(".vlralimentacao-input");
  const transpEl = linha.querySelector(".vlrtransporte-input");

  let valorAlimentacaoAtual = desformatarMoeda(
    alimEl?.tagName === "INPUT" ? alimEl.value : alimEl?.textContent || "0"
  );
  let valorTransporteAtual = desformatarMoeda(
    transpEl?.tagName === "INPUT" ? transpEl.value : transpEl?.textContent || "0"
  );

  if (valorAlimentacaoAtual === 0 && valorTransporteAtual === 0) {
    valorAlimentacaoAtual = baseAlimentacao;
    valorTransporteAtual = baseTransporte;
  }

  totalAlimentacaoLinha = valorAlimentacaoAtual;
  totalTransporteLinha = valorTransporteAtual;

  // Atualiza o display e o data-attribute (necessário para recalcularTotaisGerais)

  // Se você está usando as variáveis celulaAlimentacao / celulaTransporte do Passo 3.1:
  if (alimEl) {
    if (alimEl.tagName === "INPUT") {
      alimEl.value = formatarMoeda(totalAlimentacaoLinha);
    } else {
      alimEl.textContent = formatarMoeda(totalAlimentacaoLinha);
    }
  } else if (celulaAlimentacao) {
    celulaAlimentacao.textContent = formatarMoeda(totalAlimentacaoLinha);
  }

  if (transpEl) {
    if (transpEl.tagName === "INPUT") {
      transpEl.value = formatarMoeda(totalTransporteLinha);
    } else {
      transpEl.textContent = formatarMoeda(totalTransporteLinha);
    }
  } else if (celulaTransporte) {
    celulaTransporte.textContent = formatarMoeda(totalTransporteLinha);
  }

  if (celulaAlimentacao) {
    celulaAlimentacao.dataset.originalAjdcusto = totalAlimentacaoLinha;
  }
  if (celulaTransporte) {
    celulaTransporte.dataset.originalAjdcusto = totalTransporteLinha;
  }

  totalAjdCustoLinha = (totalAlimentacaoLinha + totalTransporteLinha) * qtdItens * qtdDias;

  if (totAjdCustoCell) {
    totAjdCustoCell.textContent = formatarMoeda(totalAjdCustoLinha);
    console.log(`Total Ajd Custo da Linha: ${totalAjdCustoLinha}`);
  }
}

// --- NOVA FUNÇÃO PARA INICIALIZAR OS LISTENERS DE AJUDA DE CUSTO ---
// Chame esta função SEMPRE que o conteúdo do modal for carregado/atualizado.
function inicializarListenersAjdCustoTabela() {
  console.log(
    "Inicializando listeners de Ajuda de Custo para a tabela de orçamento."
  );

  const tabelaBody = document.querySelector("#tabela tbody");

  if (!tabelaBody) {
    console.warn(
      "Corpo da tabela de orçamento (#tabela tbody) não encontrado. Não é possível anexar listeners de ajuda de custo."
    );
    return;
  }

  // Este listener delegado para 'change' nos selects de Ajuda de Custo
  // deve ser adicionado apenas UMA VEZ ao 'tabelaBody'.
  // Usaremos uma flag para garantir isso, mesmo que a função seja chamada múltiplas vezes.
  // if (!tabelaBody.dataset.hasAjdCustoChangeListener) { // Usamos um dataset na tabela para a flag
  //     tabelaBody.addEventListener('change', async function(event) {
  //         if (event.target.classList.contains('tpAjdCusto-alimentacao') || event.target.classList.contains('tpAjdCusto-transporte')) {
  //             console.log("--- Evento CHANGE disparado por select de ajuda de custo (delegado) ---");
  //             const linhaAtual = event.target.closest('tr');
  //             if (!linhaAtual) {
  //                 console.error("Erro: Não foi possível encontrar a linha (<tr>) pai para o select de ajuda de custo.");
  //                 return;
  //             }

  //             atualizarValoresAjdCustoNaLinha(linhaAtual);
  //             recalcularLinha(linhaAtual);
  //             recalcularTotaisGerais();
  //         }
  //     });
  //     tabelaBody.dataset.hasAjdCustoChangeListener = true; // Define a flag como true
  //     console.log("Listener de Ajuda de Custo delegado anexado ao tbody.");
  // } else {
  //     console.log("Listener de Ajuda de Custo delegado já está anexado ao tbody. Pulando.");
  // }

  if (!tabelaBody.dataset.hasAjdCustoInputListener) {
    // ⚠️ MUDANÇA 1: O evento agora é 'input' para recalcular enquanto o usuário digita
    tabelaBody.addEventListener("input", async function (event) {
      // ⚠️ MUDANÇA 2: As classes de destino são os novos inputs de Ajuda de Custo
      if (
        event.target.classList.contains("vlralimentacao-input") ||
        event.target.classList.contains("vlrtransporte-input")
      ) {
        console.log(
          "--- Evento INPUT disparado por campo de ajuda de custo (delegado) ---"
        );

        const linhaAtual = event.target.closest("tr");
        if (!linhaAtual) {
          console.error(
            "Erro: Não foi possível encontrar a linha (<tr>) pai para o input de ajuda de custo."
          );
          return;
        }

        // Não precisamos mais de 'atualizarValoresAjdCustoNaLinha' porque o valor já está no input.
        atualizarValoresAjdCustoNaLinha(linhaAtual); //remover????
        recalcularLinha(linhaAtual);
        recalcularTotaisGerais();
      }
    });

    tabelaBody.dataset.hasAjdCustoInputListener = true; // Define a nova flag
    console.log(
      "Listener de Ajuda de Custo delegado anexado ao tbody para eventos 'input'."
    );
  } else {
    console.log(
      "Listener de Ajuda de Custo delegado já está anexado ao tbody. Pulando."
    );
  }

  // Também recalcule os valores iniciais para todas as linhas já presentes na tabela
  // (inclusive a primeira linha que vem do HTML ou as que foram carregadas do backend).
  tabelaBody.querySelectorAll("tr").forEach((linha) => {
    atualizarValoresAjdCustoNaLinha(linha); //remover????
    recalcularLinha(linha);
  });
}

function resetarOutrosSelectsOrc(select) {
  const selects = document.querySelectorAll(
    ".idFuncao, .idEquipamento, .idSuprimento"
  );

  selects.forEach((outroSelect) => {
    if (outroSelect !== select) {
      outroSelect.selectedIndex = 0;
    }
  });
}

// Função para configurar eventos no modal de orçamento
async function verificaOrcamento() {
  initializeAllFlatpickrsInModal();

  carregarFuncaoOrc();
  carregarEventosOrc();
  carregarClientesOrc();
  carregarLocalMontOrc();
  carregarEquipamentosOrc();
  carregarSuprimentosOrc();
  configurarFormularioOrc();

  inicializarListenersAjdCustoTabela();

  adicionarLinhaOrc();

  configurarInfraCheckbox();

  configurarPrePosCheckbox();

  const selecionarPavilhaoSelect =
    document.getElementById("selecionarPavilhao");

  if (selecionarPavilhaoSelect) {
    selecionarPavilhaoSelect.addEventListener("change", function () {
      const selectedOption = this.options[this.selectedIndex];
      const id = parseInt(selectedOption.value, 10);
      const name = selectedOption.textContent;

      // Verifica se um pavilhão válido foi selecionado e se ele já não está na lista
      if (id && !selectedPavilhoes.some((p) => p.id === id)) {
        selectedPavilhoes.push({ id: id, name: name });
        updatePavilhaoDisplayInputs(); // Atualiza o input de exibição
        this.value = ""; // Reseta o select para "Selecione para Adicionar"
      } else if (id && selectedPavilhoes.some((p) => p.id === id)) {
        Swal.fire("Atenção", `O pavilhão "${name}" já foi adicionado.`, "info");
        this.value = ""; // Reseta o select mesmo se já estiver adicionado
      }
    });
  }

  // Event listener para a mudança do Local Montagem, para carregar os pavilhões
  const idMontagemSelect = document.getElementById("idMontagem");
  if (idMontagemSelect) {
    idMontagemSelect.addEventListener("change", function () {
      atualizarUFOrc(this);
      carregarPavilhaoOrc(this.value);
    });
    // Se a página já carrega com um idMontagem selecionado, chame a função para carregar os pavilhões iniciais
    if (idMontagemSelect.value) {
      carregarPavilhaoOrc(idMontagemSelect.value);
    }
  }

  // Chame updatePavilhaoDisplayInputs() inicialmente para garantir que os campos estejam vazios
  // ou preenchidos se o formulário for carregado para edição.
  updatePavilhaoDisplayInputs();

  const statusInput = document.getElementById("Status");
  if (statusInput) {
    statusInput.addEventListener("input", function (event) {
      const valor = event.target.value;
      const permitido = /^[aAfF]$/.test(valor); // Usa regex para verificar

      if (!permitido) {
        event.target.value = ""; // Limpa o campo se a entrada for inválida
        Swal.fire({
          title: "Entrada Inválida",
          text: 'Por favor, digite apenas "A", "P", "E", "R" ou "F"',
          icon: "warning",
          confirmButtonText: "Ok",
        });
      }
    });
  }
  gerenciarBotoesProposta(statusInput);

  const nrOrcamentoInput = document.getElementById("nrOrcamento");
  if (nrOrcamentoInput) {
    nrOrcamentoInput.addEventListener("input", function (event) {
      const valor = event.target.value;
      const permitido = /^[0-9]*$/.test(valor); // Permite apenas números
      if (!permitido) {
        event.target.value = ""; // Limpa o campo se a entrada for inválida
        Swal.fire({
          title: "Entrada Inválida",
          text: "Por favor, digite apenas números",
          icon: "warning",
          confirmButtonText: "Ok",
        });
      }
    });
    nrOrcamentoInput.addEventListener("blur", async function () {
      const nrOrcamento = this.value.trim(); // Pega o valor do campo e remove espaços

      // Se o campo estiver vazio, limpa o formulário e sai
      if (!nrOrcamento) {
        limparOrcamento(); // Implemente esta função para limpar o form
        return;
      }

      console.log(`Buscando orçamento com Nº: ${nrOrcamento}`);

      try {
        const url = `orcamentos?nrOrcamento=${nrOrcamento}`;

        const orcamento = await fetchComToken(url, { method: "GET" });
        preencherFormularioComOrcamento(orcamento);
      } catch (error) {
        console.error("Erro ao buscar orçamento:", error);

        let errorMessage = error.message;
        if (error.message.includes("404")) {
          errorMessage = `Orçamento com o número ${nrOrcamento} não encontrado.`;
          limparOrcamento();
        } else if (error.message.includes("400")) {
          errorMessage = "Número do orçamento é inválido ou vazio.";
          limparOrcamento();
        } else {
          errorMessage = `Erro ao carregar orçamento: ${error.message}`;
          limparOrcamento();
        }

        Swal.fire("Erro!", errorMessage, "error");
      }
    });
  }

  const btnAdicionarLinha = document.getElementById("adicionarLinha");
  if (btnAdicionarLinha) {
    btnAdicionarLinha.addEventListener("click", function () {
      console.log("Botão 'Adicionar Linha' clicado");
      adicionarLinhaOrc(); // Chama a função para adicionar uma nova linha
    });
  } else {
    console.error("Botão 'Adicionar Linha' não encontrado.");
  }

  const btnAdicionarLinhaAdicional = document.getElementById(
    "adicionarLinhaAdicional"
  );
  if (btnAdicionarLinhaAdicional) {
    btnAdicionarLinhaAdicional.addEventListener("click", function () {
      console.log("Botão 'Adicionar Linha Adicional' clicado");
      adicionarLinhaAdicional(); // Chama a função para adicionar uma nova linha adicional
    });
  } else {
    console.error("Botão 'Adicionar Linha Adicional' não encontrado.");
  }

  const btnGerarProximoAno = document.getElementById("GerarProximoAno");
  if (btnGerarProximoAno) {
    btnGerarProximoAno.addEventListener("click", function () {
      console.log("Botão 'Gerar Próximo Ano' clicado");
      gerarProximoAno(); // Chama a função para adicionar uma nova linha adicional
    });
  } else {
    console.error("Botão 'Gerar Próximo Ano' não encontrado.");
  }

  const globalDescontoValor = document.getElementById("Desconto");
  const globalDescontoPercentual = document.getElementById("percentDesc");

  if (globalDescontoValor) {
    globalDescontoValor.addEventListener("input", function () {
      console.log("EVENTO INPUT GLOBAL: Desconto Valor alterado.");
      lastEditedGlobalFieldType = "valorDesconto"; // Define qual campo foi editado
      aplicarDescontoEAcrescimo("Desconto");
    });
    globalDescontoValor.addEventListener("blur", function () {
      console.log("EVENTO BLUR GLOBAL: Desconto Valor.");
      this.value = formatarMoeda(desformatarMoeda(this.value));
      setTimeout(() => {
        if (
          document.activeElement !== globalDescontoPercentual &&
          document.activeElement !== globalDescontoValor
        ) {
          lastEditedGlobalFieldType = null;
          console.log(
            "lastEditedGlobalFieldType resetado para null após blur do Desconto Valor."
          );
        }
      }, 0);
    });
  }

  if (globalDescontoPercentual) {
    globalDescontoPercentual.addEventListener("input", function () {
      console.log("EVENTO INPUT GLOBAL: Desconto Percentual alterado.");
      lastEditedGlobalFieldType = "percentualDesconto"; // Define qual campo foi editado
      aplicarDescontoEAcrescimo("percentDesc");
    });
    globalDescontoPercentual.addEventListener("blur", function () {
      console.log("EVENTO BLUR GLOBAL: Desconto Percentual.");
      this.value = formatarPercentual(desformatarPercentual(this.value));
      setTimeout(() => {
        if (
          document.activeElement !== globalDescontoValor &&
          document.activeElement !== globalDescontoPercentual
        ) {
          lastEditedGlobalFieldType = null;
          console.log(
            "lastEditedGlobalFieldType resetado para null após blur do Desconto Percentual."
          );
        }
      }, 0);
    });
  }

  // Acréscimo Global
  const globalAcrescimoValor = document.getElementById("Acrescimo");
  const globalAcrescimoPercentual = document.getElementById("percentAcresc");

  if (globalAcrescimoValor) {
    globalAcrescimoValor.addEventListener("input", function () {
      console.log("EVENTO INPUT GLOBAL: Acrescimo Valor alterado.");
      lastEditedGlobalFieldType = "valorAcrescimo";
      aplicarDescontoEAcrescimo("Acrescimo");
    });
    globalAcrescimoValor.addEventListener("blur", function () {
      console.log("EVENTO BLUR GLOBAL: Acrescimo Valor.");
      this.value = formatarMoeda(desformatarMoeda(this.value));
      setTimeout(() => {
        if (
          document.activeElement !== globalAcrescimoPercentual &&
          document.activeElement !== globalAcrescimoValor
        ) {
          lastEditedGlobalFieldType = null;
          console.log(
            "lastEditedGlobalFieldType resetado para null após blur do Acrescimo Valor."
          );
        }
      }, 0);
    });
  }

  if (globalAcrescimoPercentual) {
    globalAcrescimoPercentual.addEventListener("input", function () {
      console.log("EVENTO INPUT GLOBAL: Acrescimo Percentual alterado.");
      lastEditedGlobalFieldType = "percentualAcrescimo";
      aplicarDescontoEAcrescimo("percentAcresc");
    });
    globalAcrescimoPercentual.addEventListener("blur", function () {
      console.log("EVENTO BLUR GLOBAL: Acrescimo Percentual.");
      this.value = formatarPercentual(desformatarPercentual(this.value));
      setTimeout(() => {
        if (
          document.activeElement !== globalAcrescimoValor &&
          document.activeElement !== globalAcrescimoPercentual
        ) {
          lastEditedGlobalFieldType = null;
          console.log(
            "lastEditedGlobalFieldType resetado para null após blur do Acrescimo Percentual."
          );
        }
      }, 0);
    });
  }

  const percentualImpostoInput = document.getElementById("percentImposto");
  if (percentualImpostoInput) {
    percentualImpostoInput.addEventListener("input", function () {
      const totalReferencia = desformatarMoeda(
        document.querySelector("#totalGeralVda").value || 0
      );

      calcularImposto(totalReferencia, this.value);
    });
  }

  const percentualCtoFixoInput = document.getElementById("percentCustoFixo");
  if (percentualCtoFixoInput) {
    percentualCtoFixoInput.addEventListener("input", function () {
      const totalReferencia = desformatarMoeda(
        document.querySelector("#totalGeralVda").value || 0
      );

      calcularCustoFixo(totalReferencia, this.value);
    });
  }

  const btnEnviar = document.getElementById("Enviar");
  btnEnviar.addEventListener("click", async function (event) {
    event.preventDefault(); // Previne o envio padrão do formulário
    console.log("Entrou no botão OK");

    btnEnviar.disabled = true;
    btnEnviar.textContent = "Salvando...";

    try {
      const form = document.getElementById("form");
      const formData = new FormData(form);

      const temPermissaoCadastrar = temPermissao("Orcamentos", "cadastrar");
      const temPermissaoAlterar = temPermissao("Orcamentos", "alterar");

      const idOrcamentoExistenteValue =
        document.getElementById("idOrcamento")?.value;
      // --- Converte para número ou define como null de forma segura ---
      const orcamentoId =
        idOrcamentoExistenteValue &&
        !isNaN(parseInt(idOrcamentoExistenteValue)) &&
        parseInt(idOrcamentoExistenteValue) > 0
          ? parseInt(idOrcamentoExistenteValue)
          : null;

      if (!orcamentoId && !temPermissaoCadastrar) {
        return Swal.fire(
          "Acesso negado",
          "Você não tem permissão para cadastrar novos funcionários.",
          "error"
        );
      }

      if (orcamentoId && !temPermissaoAlterar) {
        return Swal.fire(
          "Acesso negado",
          "Você não tem permissão para alterar funcionários.",
          "error"
        );
      }

      console.log("formData BTNSALVAR", formData);

      console.log(
        "Valor bruto de idOrcamentoExistenteValue:",
        idOrcamentoExistenteValue
      );
      console.log(
        "ID do Orçamento (parseado para número ou null):",
        orcamentoId
      );

      console.log(
        "idEvento BTNSALVAR",
        document.querySelector(".idEvento option:checked")?.value || null
      );
      console.log(
        "idMontagem BTNSALVAR",
        document.querySelector(".idMontagem option:checked")?.value || null
      );

      const infraMontagemDatas = getPeriodoDatas(
        formData.get("periodoInfraMontagem")
      );

      const textoAviso =
        document.getElementById("avisoReajusteMensagem")?.textContent.trim() ||
        null;

      for (const pair of formData.entries()) {
        console.log(`formData entry: ${pair[0]}, ${pair[1]}`);
      }
      const preEventoDatas = getPeriodoDatas(formData.get("periodoPreEvento"));
      const marcacaoDatas = getPeriodoDatas(formData.get("periodoMarcacao"));
      console.log("marcacaoDatas BTNSALVAR", marcacaoDatas);
      const montagemDatas = getPeriodoDatas(formData.get("periodoMontagem"));
      const realizacaoDatas = getPeriodoDatas(
        formData.get("periodoRealizacao")
      );
      const desmontagemDatas = getPeriodoDatas(
        formData.get("periodoDesmontagem")
      );
      const desmontagemInfraDatas = getPeriodoDatas(
        formData.get("periodoDesmontagemInfra")
      );
      const posEventoDatas = getPeriodoDatas(formData.get("periodoPosEvento"));

      if (!marcacaoDatas.inicio || !marcacaoDatas.fim) {
        Swal.fire(
          "Atenção!",
          "O campo de Datas de Marcação é obrigatório e não pode ser deixado em branco.",
          "warning"
        );
        btnEnviar.disabled = false;
        btnEnviar.textContent = "Salvar Orçamento";
        return; // Interrompe o envio
      }
      if (!montagemDatas.inicio || !montagemDatas.fim) {
        Swal.fire(
          "Atenção!",
          "O campo de Datas de Realização é obrigatório e não pode ser deixado em branco.",
          "warning"
        );
        btnEnviar.disabled = false;
        btnEnviar.textContent = "Salvar Orçamento";
        return; // Interrompe o envio
      }
      if (!realizacaoDatas.inicio || !realizacaoDatas.fim) {
        Swal.fire(
          "Atenção!",
          "O campo de Datas de Realização é obrigatório e não pode ser deixado em branco.",
          "warning"
        );
        btnEnviar.disabled = false;
        btnEnviar.textContent = "Salvar Orçamento";
        return; // Interrompe o envio
      }

      const idsPavilhoesSelecionadosInput = document.getElementById(
        "idsPavilhoesSelecionados"
      );
      console.log("PAVILHOES PARA ENVIAR", idsPavilhoesSelecionadosInput);
      let pavilhoesParaEnviar = [];
      if (
        idsPavilhoesSelecionadosInput &&
        idsPavilhoesSelecionadosInput.value
      ) {
        try {
          // Parseie a string JSON de volta para um array de IDs
          pavilhoesParaEnviar = JSON.parse(idsPavilhoesSelecionadosInput.value);
        } catch (e) {
          console.error("Erro ao parsear IDs de pavilhões selecionados:", e);
          // Se o JSON estiver malformado, você pode querer retornar um erro aqui
          Swal.fire(
            "Erro!",
            "Formato inválido para a lista de pavilhões.",
            "error"
          );
          //btnEnviar.disabled = false;
          //btnEnviar.textContent = 'Salvar Orçamento';
          return;
        }
      }
      console.log("Pavilhões para enviar:", pavilhoesParaEnviar);
      

      const dadosOrcamento = {
        id: orcamentoId,
        nomenclatura: document.querySelector("#nomenclatura")?.value,
        status: formData.get("Status"),
        contratarstaff: document.querySelector('#liberaContratacao')?.checked || false,
        idCliente:
          document.querySelector(".idCliente option:checked")?.value || null, // Se o campo for vazio, será null
        idEvento:
          document.querySelector(".idEvento option:checked")?.value || null, // Se o campo for vazio, será null

        idMontagem:
          document.querySelector(".idMontagem option:checked")?.value || null, // Se o campo for vazio, será null
        // idPavilhao: document.querySelector(".idPavilhao option:checked")?.value || null, // Se o campo for vazio, será null
        idsPavilhoes: pavilhoesParaEnviar,
        infraMontagem: formData.get("infraMontagem"),

        dtIniPreEvento: preEventoDatas.inicio,
        dtFimPreEvento: preEventoDatas.fim,
        dtIniInfraMontagem: infraMontagemDatas.inicio,
        dtFimInfraMontagem: infraMontagemDatas.fim,
        dtIniMontagem: montagemDatas.inicio,
        dtFimMontagem: montagemDatas.fim,
        dtIniMarcacao: marcacaoDatas.inicio,
        dtFimMarcacao: marcacaoDatas.fim,
        dtIniRealizacao: realizacaoDatas.inicio,
        dtFimRealizacao: realizacaoDatas.fim,
        dtIniDesmontagem: desmontagemDatas.inicio,
        dtFimDesmontagem: desmontagemDatas.fim,
        dtIniDesmontagemInfra: desmontagemInfraDatas.inicio,
        dtFimDesmontagemInfra: desmontagemInfraDatas.fim,
        dtIniPosEvento: posEventoDatas.inicio,
        dtFimPosEvento: posEventoDatas.fim,

        obsItens: formData.get("Observacao"),
        obsProposta: formData.get("ObservacaoProposta"),
        formaPagamento: formData.get("formaPagamento"),
        edicao: document.querySelector("#edicao")?.value,
        avisoReajusteTexto: textoAviso,
        totGeralVda: desformatarMoeda(
          document.querySelector("#totalGeralVda").value
        ),
        totGeralCto: desformatarMoeda(
          document.querySelector("#totalGeralCto").value
        ),
        totAjdCusto: desformatarMoeda(
          document.querySelector("#totalAjdCusto").value
        ),
        lucroBruto: desformatarMoeda(document.querySelector("#Lucro").value),
        percentLucro: parsePercentValue(
          document.querySelector("#percentLucro").value
        ),
        desconto: desformatarMoeda(document.querySelector("#Desconto").value),
        percentDesconto: parsePercentValue(
          document.querySelector("#percentDesc").value
        ),
        acrescimo: desformatarMoeda(document.querySelector("#Acrescimo").value),
        percentAcrescimo: parsePercentValue(
          document.querySelector("#percentAcresc").value
        ),
        lucroReal: desformatarMoeda(document.querySelector("#lucroReal").value),
        percentLucroReal: parsePercentValue(
          document.querySelector("#percentReal").value
        ),
        vlrCliente: desformatarMoeda(
          document.querySelector("#valorCliente").value
        ),
        vlrImposto: desformatarMoeda(
          document.querySelector("#valorImposto").value
        ),
        percentImposto: parsePercentValue(
          document.querySelector("#percentImposto").value
        ),
        vlrCtoFixo: desformatarMoeda(
          document.querySelector("#valorCustoFixo").value
        ),
        percentCtoFixo: parsePercentValue(
          document.querySelector("#percentCustoFixo").value
        ),
        nrOrcamentoOriginal: nrOrcamentoOriginal,
      };

      const itensOrcamento = [];
      //    const linhas = document.querySelectorAll("#tabela tbody tr");

      const tabelaBodyParaColeta = document.querySelector("#tabela tbody"); // Pegue o tbody novamente para garantir

      //console.log("DEBUG FRONTEND: HTML do tbody ANTES de coletar as linhas:", tabelaBodyParaColeta ? tabelaBodyParaColeta.innerHTML : "tbody não encontrado");

      const linhas = tabelaBodyParaColeta
        ? tabelaBodyParaColeta.querySelectorAll("tr")
        : []; // Use querySelectorAll no tbody específico

      console.log(
        "DEBUG FRONTEND: Quantidade de linhas encontradas por querySelectorAll:",
        linhas.length,
        linhas
      );

      linhas.forEach((linha) => {
    // 1. CORREÇÃO DE LEITURA (MAIS ROBUSTA):
    // Prioriza a leitura do input hidden, que é adicionado apenas na linha adicional.
      const isAdicionalInput = linha.querySelector(".isAdicional");
      const isAdicional = isAdicionalInput?.value === "true"; 

      // O console.log agora reflete o resultado da nova e mais robusta lógica
      console.log("Processando linha. É adicional?", isAdicional, linha);

      const descontoItemValor = desformatarMoeda(
        linha.querySelector(".descontoItem.Moeda .ValorInteiros")?.value ||
        "0"
      );
      const acrescimoItemValor = desformatarMoeda(
        linha.querySelector(".acrescimoItem.Moeda .ValorInteiros")?.value ||
        "0"
      );
      const vlrVendaAtual = desformatarMoeda(
        linha.querySelector(".vlrVenda.Moeda")?.textContent || "0"
      );
      const vlrBaseLinhaRaw = parseFloat(linha.dataset.vlrbase);
      const vlrBaseLinha = !isNaN(vlrBaseLinhaRaw) && vlrBaseLinhaRaw > 0
        ? vlrBaseLinhaRaw
        : (vlrVendaAtual + descontoItemValor - acrescimoItemValor);

      const item = {
          id: parseInt(linha.querySelector(".idItemOrcamento")?.value) || null,
          nrorcamento:
              parseInt(linha.querySelector(".nrOrcamento")?.value) || null,
          enviarnaproposta:
              linha.querySelector('.Proposta input[type="checkbox"]')?.checked ||
              false,
          cachefechado: !!linha.querySelector('.cacheFechado input[type="checkbox"]')?.checked || false,
          categoria: linha.querySelector(".Categoria")?.textContent.trim(),
          qtditens:
              parseInt(linha.querySelector(".qtdProduto input")?.value) || 0,
          idfuncao: parseInt(linha.querySelector(".idFuncao")?.value) || null,
          idequipamento:
              parseInt(linha.querySelector(".idEquipamento")?.value) || null,
          idsuprimento:
              parseInt(linha.querySelector(".idSuprimento")?.value) || null,
          produto: linha.querySelector(".produto")?.textContent.trim(),
          setor:
              linha.querySelector(".setor-input")?.value?.trim().toUpperCase() ||
              null,

          qtdDias:
            parseInt(linha.querySelector(".qtdDias input")?.value || "0", 10) ||
            0,
          qtddias:
            parseInt(linha.querySelector(".qtdDias input")?.value || "0", 10) ||
            0,

          descontoitem: descontoItemValor,
          percentdescontoitem: parsePercentValue(
              linha.querySelector(".descontoItem.Moeda .valorPerCent")?.value
          ),
          acrescimoitem: acrescimoItemValor,
          percentacrescimoitem: parsePercentValue(
              linha.querySelector(".acrescimoItem.Moeda .valorPerCent")?.value
          ),

          vlrdiaria: vlrVendaAtual,
          totvdadiaria: desformatarMoeda(
              linha.querySelector(".totVdaDiaria.Moeda")?.textContent || "0"
          ),
          ctodiaria: desformatarMoeda(
              linha.querySelector(".vlrCusto.Moeda")?.textContent || "0"
          ),
          totctodiaria: desformatarMoeda(
              linha.querySelector(".totCtoDiaria.Moeda")?.textContent || "0"
          ),

          tpajdctoalimentacao:
              linha.querySelector(".tpAjdCusto-alimentacao")?.value || null,
          vlrajdctoalimentacao: desformatarMoeda(
              linha.querySelector(".vlralimentacao-input")?.textContent || "0"
          ),
          tpajdctotransporte:
              linha.querySelector(".tpAjdCusto-transporte")?.value || null,
          vlrajdctotransporte: desformatarMoeda(
              linha.querySelector(".vlrtransporte-input")?.textContent || "0"
          ),
          totajdctoitem: desformatarMoeda(
              linha.querySelector(".totAjdCusto.Moeda")?.textContent || "0"
          ),

          hospedagem: desformatarMoeda(
              linha.querySelector(".extraCampo .hospedagem")?.value || "0"
          ),
          transporte: desformatarMoeda(
              linha.querySelector(".extraCampo .transporteExtraInput")?.value ||
              "0"
          ),

          totgeralitem: desformatarMoeda(
              linha.querySelector(".totGeral")?.textContent || "0"
          ),

          // Base do item para manter o valor original sem desconto/acréscimo
          vlrbase: vlrBaseLinha,

          // 2. CORREÇÃO DE ATRIBUIÇÃO:
          // Usa a variável local 'isAdicional' (calculada corretamente acima).
          adicional: isAdicional, // <--- ESSA LINHA GARANTE QUE O TRUE É ENVIADO
          
          // 3. ATRIBUTO EXTRA BONIFICADO:
          extrabonificado: linha.dataset?.extrabonificado === "true" || false,
      };

      // 🎯 Aqui vem o tratamento correto dos períodos:
      const campoPeriodo = linha.querySelector(".datas-item");
      const valorPeriodoInput = campoPeriodo?.value?.trim() || "";

      console.log(
          "valorPeriodoInput",
          valorPeriodoInput,
          item.idfuncao,
          item.idequipamento,
          item.idsuprimento
      );

      let dataInicioFormatada = null;
      let dataFimFormatada = null;

      if (valorPeriodoInput) {
          // Utilize a lógica de parsing que já existe na sua formatarRangeDataParaBackend
          const partes = valorPeriodoInput
              .replace(" até ", " to ")
              .replace(" a ", " to ")
              .split(" to ")
              .map((d) => d.trim());

          if (partes.length === 2) {
              // ASSUMINDO que você já tem a função `formatarDataParaBackend`
              // que converte "DD/MM/YYYY" para "YYYY-MM-DD"
              dataInicioFormatada = formatarDataParaBackend(partes[0]);
              dataFimFormatada = formatarDataParaBackend(partes[1]);
          } else if (partes.length === 1) {
              // Única data: "DD/MM/YYYY"
              dataInicioFormatada = formatarDataParaBackend(partes[0]);
              dataFimFormatada = formatarDataParaBackend(partes[0]); // Corrigido aqui!
          } else {
              // Formato inválido ou inesperado
              dataInicioFormatada = null;
              dataFimFormatada = null;
          }
      }

      // ATRIBUIÇÃO CORRETA:
      item.periododiariasinicio = dataInicioFormatada;
      item.periododiariasfim = dataFimFormatada; // <--- AGORA ESTAMOS ATRIBUINDO A DATA DE FIM SEPARADAMENTE

      console.log("ITENS", item);

      itensOrcamento.push(item);
      // --- FIM DO NOVO TRECHO ---

      // Seus logs de depuração (opcionais, mas úteis para confirmar)
      console.log("Valor do input recebido:", valorPeriodoInput); // Ex: "03/07/2025 a 05/07/2025"
      console.log(
          "item.periododiariasinicio (para o backend):",
          item.periododiariasinicio
      ); // Ex: "2025-07-03"
      console.log(
          "item.periododiariasfim (para o backend):",
          item.periododiariasfim
      ); // Ex: "2025-07-05"
  });

      dadosOrcamento.itens = itensOrcamento;

      console.log(
        "Payload Final do Orçamento (sem id_empresa):",
        dadosOrcamento
      );

      // Determina o método e a URL com base na existência do ID do orçamento
      const isUpdate = orcamentoId !== null;
      const method = isUpdate ? "PUT" : "POST";
      const url = isUpdate ? `orcamentos/${orcamentoId}` : "orcamentos";

      // 3. Enviar os dados para o backend usando fetchComToken
      const resultado = await fetchComToken(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dadosOrcamento),
      });

      // 4. Lidar com a resposta do backend
      //if (response.ok) {
      //    const resultado = await response.json();
      Swal.fire(
        "Sucesso!",
        resultado.message || "Orçamento salvo com sucesso!",
        "success"
      );
      btnEnviar.disabled = false;
      btnEnviar.textContent = "Salvo";
      // Se for uma criação e o backend retornar o ID, atualize o formulário
      if (!isUpdate && resultado.id) {
        document.getElementById("idOrcamento").value = resultado.id;
        if (resultado.nrOrcamento) {
          document.getElementById("nrOrcamento").value = resultado.nrOrcamento; // Atualiza o campo no formulário
        }
      }
      console.log("PROXIMO ANO", bProximoAno, idOrcamentoOriginalParaAtualizar);
      if (bProximoAno === true && idOrcamentoOriginalParaAtualizar !== null) {
        console.log(
          `Iniciando atualização do Orçamento Original: ${idOrcamentoOriginalParaAtualizar}`
        );

        // Faz a segunda chamada de API para atualizar apenas o campo
        // 'geradoanoposterior'
        const updateOriginal = await atualizarCampoGeradoAnoPosterior(
          idOrcamentoOriginalParaAtualizar,
          true
        );

        if (updateOriginal) {
          console.log("Orçamento Original marcado com sucesso como espelhado.");
          // Limpa o estado após o sucesso
          bProximoAno = false;
          idOrcamentoOriginalParaAtualizar = null;
        } else {
          // Alerta que o novo foi salvo, mas o original não foi marcado
          Swal.fire(
            "Atenção Crítica",
            "O novo orçamento foi salvo, mas **NÃO** foi possível marcar o orçamento original.",
            "warning"
          );
          // Mantenha bproximoano = true para possível retentativa ou log
        }
      }
    } catch (error) {
      console.error("Erro inesperado ao salvar orçamento:", error);
      // let errorMessage = "Ocorreu um erro inesperado ao salvar o orçamento.";
      // if (error.message) {
      //     errorMessage = error.message; // Pega a mensagem do erro lançada por fetchComToken
      // } else if (typeof error === 'string') {
      //     errorMessage = error; // Caso o erro seja uma string simples
      // }
      // Swal.fire("Erro!", "Falha ao salvar orçamento: " + errorMessage, "error");
      let errorMessage = "Ocorreu um erro inesperado ao salvar o orçamento.";
      let swalTitle = "Erro!";

      // Tentativa 1: Pegar a mensagem de erro da API (se for um objeto Error)
      if (error.message) {
        errorMessage = error.message; // Ex: "Erro na requisição: [object Object]"

        // Tentativa 2: Tentar extrair o detalhe do PostgreSQL se estiver em formato de string no erro
        // O erro do PG que você viu é: 'error: o valor nulo na coluna "dtinimarcacao"...'
        if (errorMessage.includes("o valor nulo na coluna")) {
          swalTitle = "Erro de Dados Faltantes";
          // Tenta simplificar a mensagem do PG para ser mais amigável
          errorMessage = errorMessage
            .replace(/(\r\n|\n|\r)/gm, " ") // Remove quebras de linha
            .match(/o valor nulo na coluna "([^"]+)"/i);

          if (errorMessage && errorMessage[1]) {
            const coluna = errorMessage[1].toUpperCase();
            errorMessage = `Atenção: O campo de data **${coluna}** não pode ficar em branco. Por favor, preencha o campo de Marcação.`;
          } else {
            errorMessage =
              "Um campo obrigatório (data) está faltando. Verifique as datas de Marcação, Montagem, etc.";
          }
        }
      } else if (typeof error === "string") {
        errorMessage = error;
      }
      // --- FIM DA LÓGICA DE EXTRAÇÃO ---

      Swal.fire({
        title: swalTitle,
        html: `Falha ao salvar orçamento:<br><br><strong>${errorMessage}</strong>`,
        icon: "error",
      });
    } finally {
      btnEnviar.disabled = false;
      btnEnviar.textContent = "Salvar Orçamento";
    }
  });

  

  // 2. Localize e substitua a configuração do botão Limpar
  const btnLimpar = document.getElementById("Limpar");

  if (btnLimpar) {
    // Remova qualquer listener antigo se necessário e adicione este:
    btnLimpar.addEventListener("click", async function (event) {
      event.preventDefault();

      // Ativa o modo de limpeza para silenciar Swals
      isCleaning = true; 

      try {
        // Chama a função de limpeza (certifique-se de NÃO usar os parênteses () no addEventListener antigo)
        if (typeof limparOrcamento === "function") {
          limparOrcamento(); 
        }
        
        // Limpa manualmente o Status para garantir
        const statusInput = document.getElementById("Status");
        if (statusInput) statusInput.value = "";

        recalcularTotaisGerais();
        
        console.log("🧹 Formulário limpo com sucesso.");
      } catch (error) {
        console.error("Erro ao limpar:", error);
      } finally {
        // Pequeno delay para garantir que eventos de 'change' disparados pela limpeza terminem
        setTimeout(() => {
          isCleaning = false;
        }, 500);
      }
    });
  }
}

async function atualizarCampoGeradoAnoPosterior(
  idorcamento,
  geradoAnoPosterior
) {
  console.log(
    `[ATUALIZAR_ORIGINAL] Tentando atualizar Orçamento ID: ${idorcamento}, Valor: ${geradoAnoPosterior}`
  );
  try {
    const url = `/orcamentos/${idorcamento}/update-status-espelho`;

    const options = {
      method: "PATCH", // Método HTTP para atualização parcial
      headers: {
        "Content-Type": "application/json",
      },
      // Envia o JSON { "geradoAnoPosterior": true } para o backend
      body: JSON.stringify({ geradoAnoPosterior: geradoAnoPosterior }),
    };

    // Usa a sua função utilitária para enviar a requisição
    const resposta = await fetchComToken(url, options);

    // Se fetchComToken não lançou erro, a requisição foi um sucesso (200)
    console.log(`[ATUALIZAR_ORIGINAL] Sucesso na API para ID ${idorcamento}.`);
    return true;
  } catch (error) {
    // Se houve qualquer erro (rede, 4xx, 5xx), ele será capturado aqui.
    console.error(
      `[ATUALIZAR_ORIGINAL] FALHA Crítica ao atualizar o Orçamento Original ${idorcamento}:`,
      error
    );
    // Retorna FALSE para que o bloco 'if (updateOriginal)' no frontend falhe.
    return false;
  }
}

function desinicializarOrcamentosModal() {
  console.log("🧹 Desinicializando módulo Orcamentos.js");

  const selectLocalMontagem = document.getElementById("idMontagem");
  if (selectLocalMontagem && idMontagemChangeListener) {
    selectLocalMontagem.removeEventListener("change", idMontagemChangeListener);
    idMontagemChangeListener = null;
  }

  const statusInput = document.getElementById("Status");
  if (statusInput && statusInputListener) {
    statusInput.removeEventListener("input", statusInputListener);
    statusInputListener = null;
  }

  const edicaoInput = document.getElementById("edicao");
  if (edicaoInput && edicaoInputListener) {
    edicaoInput.removeEventListener("input", edicaoInputListener);
    edicaoInputListener = null;
  }

  const nrOrcamentoInput = document.getElementById("nrOrcamento");
  if (nrOrcamentoInput && nrOrcamentoInputListener) {
    nrOrcamentoInput.removeEventListener("input", nrOrcamentoInputListener);
    nrOrcamentoInputListener = null;
  }
  if (nrOrcamentoInput && nrOrcamentoBlurListener) {
    nrOrcamentoInput.removeEventListener("blur", nrOrcamentoBlurListener);
    nrOrcamentoBlurListener = null;
  }

  const btnAdicionarLinha = document.getElementById("adicionarLinha");
  if (btnAdicionarLinha && btnAdicionarLinhaListener) {
    btnAdicionarLinha.removeEventListener("click", btnAdicionarLinhaListener);
    btnAdicionarLinhaListener = null;
  }

  const btnAdicionarLinhaAdicional = document.getElementById(
    "adicionarLinhaAdicional"
  );
  if (btnAdicionarLinhaAdicional && btnAdicionarLinhaAdicionalListener) {
    btnAdicionarLinhaAdicional.removeEventListener(
      "click",
      btnAdicionarLinhaAdicionalListener
    );
    btnAdicionarLinhaAdicionalListener = null;
  }

  const globalDescontoValor = document.getElementById("Desconto");
  if (globalDescontoValor && globalDescontoValorInputListener) {
    globalDescontoValor.removeEventListener(
      "input",
      globalDescontoValorInputListener
    );
    globalDescontoValorInputListener = null;
  }
  if (globalDescontoValor && globalDescontoValorBlurListener) {
    globalDescontoValor.removeEventListener(
      "blur",
      globalDescontoValorBlurListener
    );
    globalDescontoValorBlurListener = null;
  }

  const globalDescontoPercentual = document.getElementById("percentDesc");
  if (globalDescontoPercentual && globalDescontoPercentualInputListener) {
    globalDescontoPercentual.removeEventListener(
      "input",
      globalDescontoPercentualInputListener
    );
    globalDescontoPercentualInputListener = null;
  }
  if (globalDescontoPercentual && globalDescontoPercentualBlurListener) {
    globalDescontoPercentual.removeEventListener(
      "blur",
      globalDescontoPercentualBlurListener
    );
    globalDescontoPercentualBlurListener = null;
  }

  const globalAcrescimoValor = document.getElementById("Acrescimo");
  if (globalAcrescimoValor && globalAcrescimoValorInputListener) {
    globalAcrescimoValor.removeEventListener(
      "input",
      globalAcrescimoValorInputListener
    );
    globalAcrescimoValorInputListener = null;
  }
  if (globalAcrescimoValor && globalAcrescimoValorBlurListener) {
    globalAcrescimoValor.removeEventListener(
      "blur",
      globalAcrescimoValorBlurListener
    );
    globalAcrescimoValorBlurListener = null;
  }

  const globalAcrescimoPercentual = document.getElementById("percentAcresc");
  if (globalAcrescimoPercentual && globalAcrescimoPercentualInputListener) {
    globalAcrescimoPercentual.removeEventListener(
      "input",
      globalAcrescimoPercentualInputListener
    );
    globalAcrescimoPercentualInputListener = null;
  }
  if (globalAcrescimoPercentual && globalAcrescimoPercentualBlurListener) {
    globalAcrescimoPercentual.removeEventListener(
      "blur",
      globalAcrescimoPercentualBlurListener
    );
    globalAcrescimoPercentualBlurListener = null;
  }

  const percentualImpostoInput = document.getElementById("percentImposto");
  if (percentualImpostoInput && percentualImpostoInputListener) {
    percentualImpostoInput.removeEventListener(
      "input",
      percentualImpostoInputListener
    );
    percentualImpostoInputListener = null;
  }

  const percentualCtoFixoInput = document.getElementById("percentCustoFixo");
  if (percentualCtoFixoInput && percentualCtoFixoInputListener) {
    percentualCtoFixoInput.removeEventListener(
      "input",
      percentualCtoFixoInputListener
    );
    percentualCtoFixoInputListener = null;
  }

  const btnEnviar = document.getElementById("Enviar");
  if (btnEnviar && btnEnviarListener) {
    btnEnviar.removeEventListener("click", btnEnviarListener);
    btnEnviarListener = null;
  }

  const btnLimpar = document.getElementById("Limpar");
  if (btnLimpar && btnLimparListener) {
    btnLimpar.removeEventListener("click", btnLimparListener);
    btnLimparListener = null;
  }

  // Resetar estados e limpar formulário (se aplicável)
  limparOrcamento(); // Chame sua função de limpeza de formulário

  lastEditedGlobalFieldType = null;

  console.log("✅ Módulo Orcamentos.js desinicializado.");
}

export async function limparOrcamento() {
    console.log("DEBUG: Limpando formulário de orçamento...");

    const form = document.getElementById("form");
    if (!form) {
        console.error("Formulário com ID 'form' não encontrado.");
        return;
    }

    // Garante que o contêiner do formulário seja clicável.
    // Isso anula qualquer 'pointer-events: none;' aplicado a um elemento pai.
    form.style.pointerEvents = 'auto';

    form
        .querySelectorAll('input[type="text"], input[type="number"], textarea')
        .forEach((input) => {
            if (!input.readOnly) {
                input.value = "";
            }
        });

    document.getElementById("idOrcamento").value = "";
    document.getElementById("nrOrcamento").value = "";

    form.querySelectorAll("select").forEach((select) => {
        const defaultOption =
            select.querySelector("option[selected][disabled]") ||
            select.querySelector("option:first-child");
        if (defaultOption) {
            select.value = defaultOption.value;
        }
        const event = new Event("change");
        select.dispatchEvent(event);
    });

    form.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
        checkbox.checked = false;
    });

    const mainFlatpickrIds = [
        "periodoPreEvento",
        "periodoInfraMontagem",
        "periodoMarcacao",
        "periodoMontagem",
        "periodoRealizacao",
        "periodoDesmontagem",
        "periodoDesmontagemInfra",
        "periodoPosEvento",
    ];
    mainFlatpickrIds.forEach((id) => {
        const input = document.getElementById(id);
        if (input && input._flatpickr) {
            input._flatpickr.clear();
        } else if (input) {
            input.value = "";
        }
    });

    // Limpar a tabela de itens
    const tabelaBody = document.querySelector("#tabela tbody");
    if (tabelaBody) {
        tabelaBody.innerHTML = "";
    }

    // Resetar totais e percentuais
    document.getElementById("totalGeralVda").value = "R$ 0,00";
    document.getElementById("totalGeralCto").value = "R$ 0,00";
    document.getElementById("totalAjdCusto").value = "R$ 0,00";
    document.getElementById("Lucro").value = "R$ 0,00";
    document.getElementById("percentLucro").value = "0%";
    document.getElementById("Desconto").value = "R$ 0,00";
    document.getElementById("percentDesc").value = "0%";
    document.getElementById("Acrescimo").value = "R$ 0,00";
    document.getElementById("percentAcresc").value = "0%";
    document.getElementById("lucroReal").value = "R$ 0,00";
    document.getElementById("percentReal").value = "0%";
    document.getElementById("valorImposto").value = "R$ 0,00";
    document.getElementById("percentImposto").value = "0%";
    document.getElementById("valorCustoFixo").value = "R$ 0,00";
    document.getElementById("percentCustoFixo").value = "0%";
    document.getElementById("valorCliente").value = "R$ 0,00";

    adicionarLinhaAdicional();

    // Sempre alterar o status para "A" (Aberto)
    const statusInput = document.getElementById("Status");
    if (statusInput) {
        statusInput.value = "A";
    }

    // Desbloquear todos os campos e botões
    console.log("DEBUG: Desbloqueando campos e botões...");
    const campos = document.querySelectorAll("input, select, textarea");
    campos.forEach((campo) => {
        campo.classList.remove("bloqueado");
        campo.readOnly = false;
        campo.disabled = false;
        // Garante que os campos de busca/seleção sejam totalmente interativos
        campo.style.pointerEvents = 'auto';
    });

    const botoes = document.querySelectorAll("button");
    botoes.forEach((botao) => {
        const id = botao.id || "";
        const classes = botao.classList;

        // Exibe e habilita botões principais
        if (
            id === "fecharOrc" ||
            id === "Enviar" ||
            id === "Limpar" ||
            id === "Proposta" ||
            id === "adicionarLinha"
        ) {
            botao.style.display = "inline-block";
            botao.disabled = false;
        }
        // Oculta botões que só aparecem quando fechado
        else if (
            id === "GerarProximoAno" ||
            classes.contains("Excel") ||
            classes.contains("Contrato") ||
            classes.contains("Adicional")
        ) {
            botao.style.display = "none";
            botao.disabled = true;
        }
        // Garante visibilidade dos de navegação e pesquisa
        else if (classes.contains("pesquisar") || classes.contains("Close")) {
            botao.style.display = "inline-block";
            botao.disabled = false;
        }
    });

    // Remover o visual de bloqueio da tabela
    const tabela = document.querySelector("table");
    if (tabela) {
        tabela.classList.remove("bloqueada");
    }

    console.log(
        "DEBUG: Formulário de orçamento limpo, desbloqueado e status alterado para 'A'."
    );
}

let prePosAtivo = false;
let montagemInfraAtivo = false;

export async function preencherFormularioComOrcamento(orcamento) {
  console.log("ENTROU NO PREENCHER FORUMLARIO DO ORÇAMENTO")
  if (!orcamento) {
    limparOrcamento();
    return;
  }
  window.orcamentoAtual = orcamento;

  const idOrcamentoInput = document.getElementById("idOrcamento");
  if (idOrcamentoInput) {
    idOrcamentoInput.value = orcamento.idorcamento || "";
  } else {
    console.warn("Elemento com ID 'idOrcamento' não encontrado.");
  }

  const nrOrcamentoInput = document.getElementById("nrOrcamento");
  nrOrcamentoOriginal = nrOrcamentoInput.value;
  if (nrOrcamentoInput) {
    nrOrcamentoInput.value = orcamento.nrorcamento || "";
  } else {
    console.warn("Elemento com ID 'nrOrcamento' não encontrado.");
  }

  const nomenclaturaInput = document.getElementById("nomenclatura");
  if (nomenclaturaInput) {
    nomenclaturaInput.value = orcamento.nomenclatura || "";
  } else {
    console.warn("Elemento 'nomenclatura' não encontrado.");
  } // Define os valores dos selects.

  const statusInput = document.getElementById("Status");
  if (statusInput) {
    statusInput.value = orcamento.status || "";
    console.log("Status", statusInput.value);
    gerenciarBotoesProposta(statusInput);
  } else {
    console.warn("Elemento com ID 'Status' não encontrado.");
  }

  const edicaoInput = document.getElementById("edicao"); // ... (O restante da função é preenchimento de campos estáticos)
  if (edicaoInput) {
    edicaoInput.value = orcamento.edicao || "";
    console.log("Edição", edicaoInput.value);
  } else {
    console.warn("Elemento com ID 'Edição' não encontrado.");
  }

  const clienteSelect = document.querySelector(".idCliente");
  if (clienteSelect) {
    clienteSelect.value = orcamento.idcliente || "";
  } else {
    console.warn("Elemento com classe '.idCliente' não encontrado.");
  }

  const eventoSelect = document.querySelector(".idEvento");
  if (eventoSelect) {
    eventoSelect.value = orcamento.idevento || "";
  } else {
    console.warn("Elemento com classe '.idEvento' não encontrado.");
  }

  const localMontagemSelect = document.querySelector(".idMontagem");
  if (localMontagemSelect) {
    localMontagemSelect.value = orcamento.idmontagem || ""; // --- NOVO: Preencher o campo UF da montagem e atualizar visibilidade ---
    const ufMontagemInput = document.getElementById("ufmontagem");
    if (ufMontagemInput) {
      ufMontagemInput.value = orcamento.ufmontagem || "";
    } else {
      console.warn("Elemento com ID 'ufmontagem' não encontrado.");
    }

    atualizarUFOrc(localMontagemSelect);

    if (orcamento.idmontagem) {
      await carregarPavilhaoOrc(orcamento.idmontagem);
    } else {
      await carregarPavilhaoOrc(""); // Limpa o select se não houver montagem
    }
  } else {
    console.warn("Elemento com classe '.idMontagem' não encontrado.");
  }
  if (orcamento.pavilhoes && orcamento.pavilhoes.length > 0) {
    // Popula a variável global `selectedPavilhoes`
    // O `orcamento.pavilhoes` deve ser um array de objetos, ex: [{id: 8, nomepavilhao: "nome"}, ...]
    selectedPavilhoes = orcamento.pavilhoes.map((p) => ({
      id: p.id, // Supondo que o ID é 'id'
      name: p.nomepavilhao, // E o nome é 'nomepavilhao'
    }));
  } else {
    selectedPavilhoes = [];
  } // Chama a função que já sabe como preencher os inputs corretamente

  updatePavilhaoDisplayInputs();

  for (const id in flatpickrInstances) {
    // ... (todo o código do flatpickr permanece aqui)
    const pickerInstance = flatpickrInstances[id];

    if (
      pickerInstance &&
      typeof pickerInstance.setDate === "function" &&
      pickerInstance.config
    ) {
      let inicio = null;
      let fim = null;

      let isRelevantToPrePos = false; // Garante que seja redefinida em cada loop
      let isRelevantToMontagemInfra = false; // Garante que seja redefinida em cada loop

      switch (id) {
        case "periodoPreEvento":
          inicio = orcamento.dtinipreevento;
          fim = orcamento.dtfimpreevento;
          isRelevantToPrePos = true;
          break;
        case "periodoInfraMontagem":
          inicio = orcamento.dtiniinframontagem;
          fim = orcamento.dtfiminframontagem;
          isRelevantToMontagemInfra = true;
          break;
        case "periodoMontagem":
          inicio = orcamento.dtinimontagem;
          fim = orcamento.dtfimmontagem;
          break;
        case "periodoMarcacao":
          inicio = orcamento.dtinimarcacao;
          fim = orcamento.dtfimmarcacao;
          break;
        case "periodoRealizacao":
          inicio = orcamento.dtinirealizacao;
          fim = orcamento.dtfimrealizacao;
          break;
        case "periodoDesmontagem":
          inicio = orcamento.dtinidesmontagem;
          fim = orcamento.dtfimdesmontagem;
          break;
        case "periodoDesmontagemInfra":
          inicio = orcamento.dtiniinfradesmontagem;
          fim = orcamento.dtfiminfradesmontagem;
          break;
        case "periodoPosEvento":
          inicio = orcamento.dtiniposevento;
          fim = orcamento.dtfimposevento;
          isRelevantToPrePos = true;
          break;
      }

      const startDate = inicio ? new Date(inicio) : null;
      const endDate = fim ? new Date(fim) : null;

      const hasValidDates =
        (startDate && !isNaN(startDate.getTime())) ||
        (endDate && !isNaN(endDate.getTime()));

      if (pickerInstance.config.mode === "range") {
        // Adiciona verificação para datas válidas e tratamento para apenas uma data
        if (
          startDate &&
          endDate &&
          !isNaN(startDate.getTime()) &&
          !isNaN(endDate.getTime())
        ) {
          pickerInstance.setDate([startDate, endDate], true);
        } else if (startDate && !isNaN(startDate.getTime())) {
          // Se apenas a data de início for fornecida
          pickerInstance.setDate(startDate, true);
        } else {
          pickerInstance.clear();
        }
      } else {
        // Para modo de data única
        if (startDate && !isNaN(startDate.getTime())) {
          pickerInstance.setDate(startDate, true);
        } else {
          pickerInstance.clear();
        }
      }

      if (hasValidDates) {
        if (isRelevantToPrePos) {
          prePosAtivo = true;
        }
        if (isRelevantToMontagemInfra) {
          montagemInfraAtivo = true;
        }
      }
    } else {
      console.warn(
        `[preencherFormularioComOrcamento] Instância Flatpickr para ID '${id}' não encontrada ou inválida. Não foi possível preencher.`
      );
    }
  }

  const checkPrePos = document.getElementById("prepos");
  const checkMontagemInfra = document.getElementById("ativo"); // Assuma este ID

  console.log("CHECKS PARA ATIVAR", checkPrePos, checkMontagemInfra); // 1. Pré/Pós Evento

  if (checkPrePos) {
    checkPrePos.checked = prePosAtivo; // Se você tiver uma função que atualiza a visibilidade, chame-a aqui // Ex: toggleFieldVisibility('checkPrePos', 'periodoPrePosContainer', prePosAtivo); // Ou chame a função que é ativada no evento 'change' do checkbox:
    if (typeof atualizarVisibilidadePrePos === "function") {
      atualizarVisibilidadePrePos(); // A função deve ler o .checked e agir
    }
  } // 2. Montagem/Desmontagem Infra

  if (checkMontagemInfra) {
    checkMontagemInfra.checked = montagemInfraAtivo; // Ex: toggleFieldVisibility('checkMontagemInfra', 'periodoMontagemInfraContainer', montagemInfraAtivo); // Ou chame a função de atualização de visibilidade:
    if (typeof atualizarVisibilidadeInfra === "function") {
      atualizarVisibilidadeInfra();
    }
  }

  // 3. NOVO: Liberado Para Contratar Staff
const checkLiberaStaff = document.getElementById("liberaContratacao");
  if (checkLiberaStaff) {
    // 1. Define se o checkbox está marcado ou não baseado no banco
    checkLiberaStaff.checked = !!orcamento.contratarstaff;

    const statusInput = document.getElementById("Status");

function atualizarEstadoLiberaStaff(status) {
    const isBloqueado = status === "A";
    
    // 1. Desabilita o input (isso já impede a alteração do valor)
    checkLiberaStaff.disabled = isBloqueado; 

    // 2. Gerencia o estilo do cursor e eventos
    if (checkLiberaStaff.parentElement) {
        if (isBloqueado) {
            // Aplicamos o cursor de bloqueio
            checkLiberaStaff.parentElement.style.cursor = "not-allowed";
            checkLiberaStaff.style.cursor = "not-allowed";
            
            // IMPORTANTE: Mantemos pointer-events como "auto" ou "" 
            // para que o navegador consiga ler o cursor: not-allowed no hover.
            checkLiberaStaff.parentElement.style.pointerEvents = "auto";
            
            // Adicionamos a classe CSS que você criou para reforçar o estilo
            checkLiberaStaff.parentElement.classList.add("status-aprovado");
        } else {
            // Restaura o estado padrão
            checkLiberaStaff.parentElement.style.cursor = "pointer";
            checkLiberaStaff.style.cursor = "pointer";
            checkLiberaStaff.parentElement.style.pointerEvents = "";
            checkLiberaStaff.parentElement.classList.remove("status-aprovado");
        }
    }

    console.log(`Checkbox Staff ${isBloqueado ? 'bloqueado' : 'habilitado'}: Status ${status}`);
}

    // Estado inicial com base no orcamento carregado
    atualizarEstadoLiberaStaff(orcamento.status);

    // Se houver o campo de Status, escuta mudanças para atualizar em tempo real
    if (statusInput) {
      statusInput.addEventListener("input", function () {
        atualizarEstadoLiberaStaff(statusInput.value || "");
      });
      statusInput.addEventListener("change", function () {
        atualizarEstadoLiberaStaff(statusInput.value || "");
      });
    }

    // Garantir que cliques no checkbox sejam ignorados quando status for A (por segurança)
    checkLiberaStaff.addEventListener("click", function (e) {
      const currentStatus = (statusInput && statusInput.value) ? statusInput.value : (orcamento.status || "");
      if (currentStatus === "A") {
        e.preventDefault();
        e.stopPropagation();
        console.log("Clique bloqueado em 'liberaContratacao' porque status é 'A'");
      }
    });

    console.log("Liberado Contratação Staff:", checkLiberaStaff.checked);
  } else {
    console.warn("Elemento com ID 'liberaContratacao' não encontrado.");
  }
  
  // Preencher campos de texto

  const obsItensInput = document.getElementById("Observacao");
  if (obsItensInput) {
    obsItensInput.value = orcamento.obsitens || "";
  } else {
    console.warn(
      "Elemento com ID 'Observacao' (Observações sobre os Itens) não encontrado."
    );
  }

  const obsPropostaInput = document.getElementById("ObservacaoProposta");
  if (obsPropostaInput) {
    obsPropostaInput.value = orcamento.obsproposta || "";
  } else {
    console.warn(
      "Elemento com ID 'ObservacaoProposta' (Observações sobre a Proposta) não encontrado."
    );
  }

  const formaPagamentoInput = document.getElementById("formaPagamento");
  if (formaPagamentoInput) {
    formaPagamentoInput.value = orcamento.formapagamento || "";
  } else {
    console.warn(
      "Elemento com ID 'FormaPagamento' (Forma Pagamento) não encontrado."
    );
  }
  console.log("AVISO", orcamento.indicesaplicados);
  const avisoReajusteInput = document.getElementById("avisoReajusteMensagem");
  if (avisoReajusteInput) {
    avisoReajusteInput.textContent = orcamento.indicesaplicados || "";
  } else {
    console.warn("Elemento com ID 'avisoReajusteMensagem' não encontrado.");
  }

  const totalGeralVdaInput = document.getElementById("totalGeralVda");
  if (totalGeralVdaInput)
    totalGeralVdaInput.value = formatarMoeda(orcamento.totgeralvda || 0);

  const totalGeralCtoInput = document.getElementById("totalGeralCto");
  if (totalGeralCtoInput)
    totalGeralCtoInput.value = formatarMoeda(orcamento.totgeralcto || 0);

  const totalAjdCustoInput = document.getElementById("totalAjdCusto");
  if (totalAjdCustoInput)
    totalAjdCustoInput.value = formatarMoeda(orcamento.totajdcto || 0);

  const totalGeralInput = document.getElementById("totalGeral");
  if (totalGeralCtoInput && totalAjdCustoInput && totalGeralInput) {
    // Obter os valores dos campos.
    // Use uma função para remover a formatação de moeda e converter para número.
    const valorGeralCto = desformatarMoeda(totalGeralCtoInput.value);
    const valorAjdCusto = desformatarMoeda(totalAjdCustoInput.value); // Realizar a soma

    const somaTotal = valorGeralCto + valorAjdCusto; // Formatar o resultado de volta para moeda e atribuir ao campo totalGeral

    totalGeralInput.value = formatarMoeda(somaTotal);
  } else {
    console.warn(
      "Um ou mais elementos de input (totalGeralCto, totalAjdCusto, totalGeral) não foram encontrados."
    );
  }

  const lucroInput = document.getElementById("Lucro");
  if (lucroInput) lucroInput.value = formatarMoeda(orcamento.lucrobruto || 0);

  const percentLucroInput = document.getElementById("percentLucro");
  if (percentLucroInput)
    percentLucroInput.value = formatarPercentual(orcamento.percentlucro || 0);

  const descontoInput = document.getElementById("Desconto");
  if (descontoInput) {
    // Converte para número antes de toFixed
    descontoInput.value = parseFloat(orcamento.desconto || 0).toFixed(2);
  } else {
    console.warn("Elemento com ID 'Desconto' não encontrado.");
  }

  const percentDescInput = document.getElementById("percentDesc");
  if (percentDescInput) {
    percentDescInput.value = formatarPercentual(
      parseFloat(orcamento.percentdesconto || 0)
    );
  } else {
    console.warn("Elemento com ID 'percentDesc' não encontrado.");
  }

  const acrescimoInput = document.getElementById("Acrescimo");
  if (acrescimoInput) {
    // Converte para número antes de toFixed
    acrescimoInput.value = parseFloat(orcamento.acrescimo || 0).toFixed(2);
  } else {
    console.warn("Elemento com ID 'Acrescimo' não encontrado.");
  }

  const percentAcrescInput = document.getElementById("percentAcresc");
  if (percentAcrescInput) {
    percentAcrescInput.value = formatarPercentual(
      parseFloat(orcamento.percentacrescimo || 0)
    );
  } else {
    console.warn("Elemento com ID 'percentAcresc' não encontrado.");
  }

  const lucroRealInput = document.getElementById("lucroReal");
  if (lucroRealInput)
    lucroRealInput.value = formatarMoeda(orcamento.lucroreal || 0);

  const percentRealInput = document.getElementById("percentReal");
  if (percentRealInput)
    percentRealInput.value = formatarPercentual(
      orcamento.percentlucroreal || 0
    );

  const valorImpostoInput = document.getElementById("valorImposto");
  if (valorImpostoInput)
    valorImpostoInput.value = formatarMoeda(orcamento.vlrimposto || 0);
  const percentImpostoInput = document.getElementById("percentImposto");
  if (percentImpostoInput)
    percentImpostoInput.value = formatarPercentual(
      orcamento.percentimposto || 0
    );

  const valorCtoFixoInput = document.getElementById("valorCustoFixo");
  if (valorCtoFixoInput)
    valorCtoFixoInput.value = formatarMoeda(orcamento.vlrctofixo || 0);

  const percentCtoFixoInput = document.getElementById("percentCustoFixo");
  if (percentCtoFixoInput)
    percentCtoFixoInput.value = formatarPercentual(
      orcamento.percentctofixo || 0
    );

  const valorClienteInput = document.getElementById("valorCliente");
  if (valorClienteInput)
    valorClienteInput.value = formatarMoeda(orcamento.vlrcliente || 0);

  console.log(
    "VALOR DO CLIENTE VINDO DO BANCO",
    orcamento.vlrcliente || 0,
    orcamento.vlrctofixo,
    orcamento.percentctofixo
  ); // preencherItensOrcamentoTabela(orcamento.itens || []);

  if (orcamento.itens && orcamento.itens.length > 0) {
    preencherItensOrcamentoTabela(orcamento.itens); // Chamada crucial que gera os inputs
  } else {
    console.log(
      "Orçamento carregado não possui itens ou array de itens está vazio."
    );
    preencherItensOrcamentoTabela([]); // Limpa a tabela se não houver itens
  }
  if (localMontagemSelect) {
    // Verifica se o select existe antes de chamar
    atualizarUFOrc(localMontagemSelect);
  }

  // ========================================================
  // ⭐ NOVO BLOCO DE BLOQUEIO NO FINAL (SOLUÇÃO) ⭐
  // O status é verificado novamente após todos os campos estarem preenchidos/criados.
  // ========================================================
  const statusFinal = document.getElementById("Status")?.value;
  if (statusFinal === "F") {
    console.log("Status 'F' detectado no final da carga. Bloqueando campos.");
    bloquearCamposSeFechado();
  }
  // ========================================================
}

// export function preencherItensOrcamentoTabela(itens, isNewYearBudget = false) {
//   console.log("DEBUG FRONTEND: preencherItensOrcamentoTabela foi chamada com itens:", itens);

//   const tabelaBody = document.querySelector("#tabela tbody");

//   if (!tabelaBody) {
//     console.warn("Corpo da tabela de itens (seletor #tabela tbody) não encontrado.");
//     return;
//   }

//   tabelaBody.innerHTML = ""; // Limpa as linhas existentes

//   if (!itens || itens.length === 0) {
//     const emptyRow = tabelaBody.insertRow();
//     emptyRow.innerHTML = `<td colspan="20" style="text-align: center;">Nenhum item adicionado a este orçamento.</td>`;
//     return;
//   }

//   // --- LÓGICA DE REAJUSTE ---
//   const ceilToTenCents = (valor, fator) => Math.ceil(valor * fator * 10) / 10;
  
//   const aplicarReajuste = isNewYearBudget && (GLOBAL_PERCENTUAL_GERAL > 0 || GLOBAL_PERCENTUAL_AJUDA > 0);
//   const fatorGeral = aplicarReajuste && GLOBAL_PERCENTUAL_GERAL > 0 ? 1 + GLOBAL_PERCENTUAL_GERAL / 100 : 1;
//   const fatorAjuda = aplicarReajuste && GLOBAL_PERCENTUAL_AJUDA > 0 ? 1 + GLOBAL_PERCENTUAL_AJUDA / 100 : 1;

//   // =======================================================
//   // ✅ LÓGICA DE ORDENAÇÃO (CATEGORIA + ALFABÉTICA)
//   // =======================================================
//   const PRIORIDADE_CATEGORIAS = {
//     "PRODUTOS": 1,
//     "EQUIPAMENTOS": 2,
//     "SUPRIMENTOS": 3
//   };

//   itens.sort((a, b) => {
//     const catA = (a.categoria || "OUTROS").toUpperCase();
//     const catB = (b.categoria || "OUTROS").toUpperCase();

//     const pesoA = PRIORIDADE_CATEGORIAS[catA] || 99;
//     const pesoB = PRIORIDADE_CATEGORIAS[catB] || 99;

//     // 1º Passo: Comparar o peso da Categoria
//     if (pesoA !== pesoB) {
//       return pesoA - pesoB;
//     }

//     // 2º Passo: Se a categoria for a mesma, ordenar por ordem alfabética do PRODUTO
//     // (Verificamos todos os campos possíveis de nome para garantir a ordenação)
//     const nomeA = (a.produto || a.nmfuncao || a.nmequipamento || a.nmsuprimento || "").toLowerCase();
//     const nomeB = (b.produto || b.nmfuncao || b.nmequipamento || b.nmsuprimento || "").toLowerCase();
//     return nomeA.localeCompare(nomeB);
//   });
//   // =======================================================

//   itens.forEach((item) => {
//     let vlrDiaria = parseFloat(item.vlrdiaria || 0);
//     let ctoDiaria = parseFloat(item.ctodiaria || 0);
//     let vlrAjdAlimentacao = parseFloat(item.vlrajdctoalimentacao || 0);
//     let vlrAjdTransporte = parseFloat(item.vlrajdctotransporte || 0);
//     let vlrHospedagem = parseFloat(item.hospedagem || 0);
//     let vlrTransporte = parseFloat(item.transporte || 0);

//     let itemOrcamentoID = item.idorcamentoitem;
//     const qtdItens = item.qtditens || 0;
//     const qtdDias = item.qtddias || 0;

//     let totVdaDiaria = parseFloat(item.totvdadiaria || 0);
//     let totCtoDiaria = parseFloat(item.totctodiaria || 0);
//     let totAjuda = parseFloat(item.totajdctoitem || 0);
//     let totGeralItem = parseFloat(item.totgeralitem || 0);
//     let descontoItem = parseFloat(item.descontoitem || 0);
//     let acrescimoItem = parseFloat(item.acrescimoitem || 0);

//     if (aplicarReajuste) {
//       vlrDiaria = ceilToTenCents(vlrDiaria, fatorGeral);
//       ctoDiaria = ceilToTenCents(ctoDiaria, fatorGeral);
//       vlrAjdAlimentacao = ceilToTenCents(vlrAjdAlimentacao, fatorAjuda);
//       vlrAjdTransporte = ceilToTenCents(vlrAjdTransporte, fatorAjuda);
//       vlrHospedagem = ceilToTenCents(vlrHospedagem, fatorGeral);
//       vlrTransporte = ceilToTenCents(vlrTransporte, fatorGeral);

//       itemOrcamentoID = ""; // Novo ID para reajuste

//       totVdaDiaria = vlrDiaria * qtdItens * qtdDias + acrescimoItem - descontoItem;
//       totCtoDiaria = ctoDiaria * qtdItens * qtdDias;
//       totAjuda = (vlrAjdAlimentacao + vlrAjdTransporte) * qtdItens * qtdDias;
//       totGeralItem = totAjuda + totCtoDiaria;
//     }

//     // Fallback Ajuda de Custo
//     if (!aplicarReajuste && (vlrAjdAlimentacao === 0 && vlrAjdTransporte === 0) && parseFloat(item.totajdctoitem || 0) > 0) {
//       const multiplicador = (qtdItens * qtdDias) || 1;
//       vlrAjdAlimentacao = parseFloat(item.totajdctoitem) / multiplicador;
//       totAjuda = parseFloat(item.totajdctoitem);
//       totGeralItem = totAjuda + totCtoDiaria;
//     }

//     const vlrBaseItemRaw = parseFloat(item.vlrbase);
//     const vlrBaseItem = !isNaN(vlrBaseItemRaw) && vlrBaseItemRaw > 0 ? vlrBaseItemRaw : (vlrDiaria + descontoItem - acrescimoItem);

//     // Nome unificado do produto
//     const nomeProduto = item.produto || item.nmfuncao || item.nmequipamento || item.nmsuprimento || "";

//     const newRow = tabelaBody.insertRow();
//     newRow.dataset.idorcamentoitem = itemOrcamentoID || "";
//     newRow.dataset.idfuncao = item.idfuncao || "";
//     newRow.dataset.idequipamento = item.idequipamento || "";
//     newRow.dataset.idsuprimento = item.idsuprimento || "";
//     newRow.dataset.vlrbase = (vlrBaseItem || 0).toString();
//     newRow.dataset.adicional = item.adicional ? "true" : "false";
//     newRow.dataset.extrabonificado = item.extrabonificado ? "true" : "false";

//     if (item.extrabonificado) {
//         newRow.style.backgroundColor = "#f0fff4";
//         newRow.style.borderLeft = "4px solid #48bb78";
//     }

//     newRow.innerHTML = `
//             <td style="display: none;"><input type="hidden" class="idItemOrcamento" value="${itemOrcamentoID || ""}"></td>
//             <td style="display: none;"><input type="hidden" class="idFuncao" value="${item.idfuncao || ""}"></td>
//             <td style="display: none;"><input type="hidden" class="idEquipamento" value="${item.idequipamento || ""}"></td>
//             <td style="display: none;"><input type="hidden" class="idSuprimento" value="${item.idsuprimento || ""}"></td>
//             <td class="Proposta">
//                 <div class="checkbox-wrapper-33">
//                     <label class="checkbox">
//                         <input class="checkbox__trigger visuallyhidden" type="checkbox" ${item.enviarnaproposta && !item.extrabonificado ? "checked" : ""} ${item.extrabonificado ? "disabled" : ""} />
//                         <span class="checkbox__symbol"><svg aria-hidden="true" class="icon-checkbox" width="28px" height="28px" viewBox="0 0 28 28"><path d="M4 14l8 7L24 7"></path></svg></span>
//                     </label>
//                     ${item.extrabonificado ? '<span style="font-size: 10px; color: #48bb78; font-weight: bold;">🎁 BONIFICADO</span>' : ''}
//                 </div>
//             </td>
//             <td class="cacheFechado">
//             <div class="checkbox-wrapper-33">
//                 <label class="checkbox">
//                     <input class="checkbox__trigger visuallyhidden chk-cache-fechado" type="checkbox" onchange="toggleEditavel(this)" ${item.cachefechado ? "checked" : ""} />
//                     <span class="checkbox__symbol">
//                         <svg aria-hidden="true" class="icon-checkbox" width="28px" height="28px" viewBox="0 0 28 28" version="1" xmlns="http://www.w3.org/2000/svg">
//                             <path d="M4 14l8 7L24 7"></path>
//                         </svg>
//                     </span>
//                     <p class="checkbox__textwrapper"></p>
//                 </label>
//             </div>
//         </td>
//             <td class="Categoria">${item.categoria || ""}</td>
//             <td class="qtdProduto">
//                 <div class="add-less">
//                     <input type="number" class="qtdProduto" min="0" value="${qtdItens}">
//                     <div class="Bt">
//                         <button type="button" class="increment">+</button>
//                         <button type="button" class="decrement">-</button>
//                     </div>
//                 </div>
//             </td>
//             <td class="produto">${nomeProduto}</td>
//             <td class="setor"><input type="text" class="setor-input" value="${item.setor || ""}"></td>
//             <td class="qtdDias"><div class="add-less"><input type="number" readonly class="qtdDias" min="0" value="${qtdDias}"></div></td>
//             <td class="Periodo"><div class="flatpickr-container"><input type="text" class="datas datas-item" data-input required readonly placeholder="Selecionar"></div></td>
//             <td class="descontoItem Moeda">
//                 <div class="Acres-Desc">
//                     <input type="text" class="ValorInteiros" value="${formatarMoeda(item.descontoitem || 0)}">
//                     <input type="text" class="valorPerCent" value="${parseFloat(item.percentdescontoitem || 0).toFixed(2)}%">
//                 </div>
//             </td>
//             <td class="acrescimoItem Moeda">
//                 <div class="Acres-Desc">
//                     <input type="text" class="ValorInteiros" value="${formatarMoeda(item.acrescimoitem || 0)}">
//                     <input type="text" class="valorPerCent" value="${parseFloat(item.percentacrescimoitem || 0).toFixed(2)}%">
//                 </div>
//             </td>            
//             <td class="vlrVenda Moeda" data-original-venda="${vlrDiaria.toFixed(2)}">${formatarMoeda(vlrDiaria)}</td>
//             <td class="totVdaDiaria Moeda">${formatarMoeda(totVdaDiaria)}</td>
//             <td class="vlrCusto Moeda">${formatarMoeda(ctoDiaria)}</td>
//             <td class="totCtoDiaria Moeda">${formatarMoeda(totCtoDiaria)}</td>
//             <td class="ajdCusto Moeda alimentacao" data-original-ajdcusto="${vlrAjdAlimentacao}"><span class="vlralimentacao-input">${formatarMoeda(vlrAjdAlimentacao)}</span></td>
//             <td class="ajdCusto Moeda transporte" data-original-ajdcusto="${vlrAjdTransporte}"><span class="vlrtransporte-input">${formatarMoeda(vlrAjdTransporte)}</span></td>
//             <td class="totAjdCusto Moeda">${formatarMoeda(totAjuda)}</td>
//             <td class="extraCampo Moeda" style="display: none;"><input type="text" class="hospedagem" value="${vlrHospedagem}"></td>
//             <td class="extraCampo Moeda" style="display: none;"><input type="text" class="transporteExtraInput" value="${vlrTransporte}"></td>
//             <td class="totGeral Moeda">${formatarMoeda(totGeralItem)}</td>
//             <td><div class="Acao"><button class="btnApagar" type="button"><svg class="delete-svgIcon" viewBox="0 0 448 512"><path d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z"></path></svg></button></div></td>
//         `;

//     // --- EVENTOS ---
//     const setupAcresDesc = (sel, type) => {
//         const vi = newRow.querySelector(`${sel} .ValorInteiros`);
//         const vp = newRow.querySelector(`${sel} .valorPerCent`);
//         vi?.addEventListener("input", function() { lastEditedFieldType = "valor"; recalcularDescontoAcrescimo(this, type, "valor", newRow); });
//         vi?.addEventListener("blur", function() { this.value = formatarMoeda(desformatarMoeda(this.value)); });
//         vp?.addEventListener("input", function() { lastEditedFieldType = "percentual"; recalcularDescontoAcrescimo(this, type, "percentual", newRow); });
//         vp?.addEventListener("blur", function() { this.value = formatarPercentual(desformatarPercentual(this.value)); });
//     };

//     setupAcresDesc(".descontoItem", "desconto");
//     setupAcresDesc(".acrescimoItem", "acrescimo");

//     newRow.querySelector(".qtdProduto input")?.addEventListener("input", () => recalcularLinha(newRow));
//     newRow.querySelector(".increment")?.addEventListener("click", () => { const i = newRow.querySelector(".qtdProduto input"); i.value = parseInt(i.value) + 1; recalcularLinha(newRow); });
//     newRow.querySelector(".decrement")?.addEventListener("click", () => { const i = newRow.querySelector(".qtdProduto input"); if(parseInt(i.value) > 0){ i.value = parseInt(i.value) - 1; recalcularLinha(newRow); }});

//     const itemDateInput = newRow.querySelector(".datas-item");
//     if (itemDateInput) {
//       const dates = [];
//       if (item.periododiariasinicio) dates.push(new Date(item.periododiariasinicio));
//       if (item.periododiariasfim) dates.push(new Date(item.periododiariasfim));
//       flatpickr(itemDateInput, { mode: "range", dateFormat: "d/m/Y", locale: flatpickr.l10ns.pt, defaultDate: dates, onChange: (sd) => atualizarQtdDias(itemDateInput, sd) });
//         // Garante que o campo de datas seja sempre preenchido visualmente
//         if (item.datas && item.datas.length > 0) {
//           let fpInstance = itemDateInput._flatpickr;
//           if (!fpInstance) {
//             fpInstance = flatpickr(itemDateInput, commonFlatpickrOptionsTable);
//           }
//           fpInstance.setDate(item.datas, true);
//         }
//     }

//     const delBtn = newRow.querySelector(".btnApagar");
//     if (delBtn) {
//       delBtn.addEventListener("click", async (e) => {
//         e.preventDefault();
//         const id = newRow.dataset.idorcamentoitem;
//         if (!id) { newRow.remove(); recalcularTotaisGerais(); }
//         else {
//           const { isConfirmed } = await Swal.fire({ title: `Excluir "${nomeProduto}"?`, icon: "warning", showCancelButton: true, confirmButtonText: "Sim, deletar!" });
//           if (isConfirmed) {
//             try {
//               const principalId = document.getElementById("idOrcamento").value;
//               await fetchComToken(`/orcamentos/${principalId}/itens/${id}`, { method: "DELETE" });
//               newRow.remove();
//               recalcularTotaisGerais();
//               Swal.fire("Deletado!", "", "success");
//             } catch (err) { Swal.fire("Erro!", err.message, "error"); }
//           }
//         }
//       });
//       if (!temPermissao("Orcamentos", "apagar")) delBtn.classList.add("btnDesabilitado");
//     }
//       if (item.cachefechado === true || item.cachefechado === "true") {
//         const chkCache = newRow.querySelector(".chk-cache-fechado");
//         if (chkCache) {
//             // Chamamos a função passando o elemento para que ela trave os botões
//             window.toggleEditavel(chkCache); 
//         }
//     }
//   });


//   if (aplicarReajuste) {
//     const aviso = document.getElementById("avisoReajusteMensagem");
//     if (aviso) aviso.textContent = `Reajuste aplicado sobre o orçamento original.`;
//     recalcularTotaisGerais();
//     aplicarDescontoEAcrescimo("Desconto"); 
//   }

//   aplicarMascaraMoeda();
// }
// =============================
// VERIFICA LINHAS PELO PERÍODO
// =============================


export function preencherItensOrcamentoTabela(itens, isNewYearBudget = false) {
  console.log("DEBUG FRONTEND: preencherItensOrcamentoTabela foi chamada com itens:", itens);

  const tabelaBody = document.querySelector("#tabela tbody");

  if (!tabelaBody) {
    console.warn("Corpo da tabela de itens (seletor #tabela tbody) não encontrado.");
    return;
  }

  tabelaBody.innerHTML = ""; // Limpa as linhas existentes

  if (!itens || itens.length === 0) {
    const emptyRow = tabelaBody.insertRow();
    emptyRow.innerHTML = `<td colspan="20" style="text-align: center;">Nenhum item adicionado a este orçamento.</td>`;
    return;
  }

  // --- LÓGICA DE REAJUSTE ---
  const ceilToTenCents = (valor, fator) => Math.ceil(valor * fator * 10) / 10;
  
  const aplicarReajuste = isNewYearBudget && (GLOBAL_PERCENTUAL_GERAL > 0 || GLOBAL_PERCENTUAL_AJUDA > 0);
  const fatorGeral = aplicarReajuste && GLOBAL_PERCENTUAL_GERAL > 0 ? 1 + GLOBAL_PERCENTUAL_GERAL / 100 : 1;
  const fatorAjuda = aplicarReajuste && GLOBAL_PERCENTUAL_AJUDA > 0 ? 1 + GLOBAL_PERCENTUAL_AJUDA / 100 : 1;

  // =======================================================
  // ✅ LÓGICA DE ORDENAÇÃO (CATEGORIA + ALFABÉTICA)
  // =======================================================
  const PRIORIDADE_CATEGORIAS = {
    "PRODUTOS": 1,
    "EQUIPAMENTOS": 2,
    "SUPRIMENTOS": 3
  };

  itens.sort((a, b) => {
    const catA = (a.categoria || "OUTROS").toUpperCase();
    const catB = (b.categoria || "OUTROS").toUpperCase();

    const pesoA = PRIORIDADE_CATEGORIAS[catA] || 99;
    const pesoB = PRIORIDADE_CATEGORIAS[catB] || 99;

    // 1º Passo: Comparar o peso da Categoria
    if (pesoA !== pesoB) {
      return pesoA - pesoB;
    }

    // 2º Passo: Se a categoria for a mesma, ordenar por ordem alfabética do PRODUTO
    // (Verificamos todos os campos possíveis de nome para garantir a ordenação)
    const nomeA = (a.produto || a.nmfuncao || a.nmequipamento || a.nmsuprimento || "").toLowerCase();
    const nomeB = (b.produto || b.nmfuncao || b.nmequipamento || b.nmsuprimento || "").toLowerCase();
    return nomeA.localeCompare(nomeB);
  });
  // =======================================================

itens.forEach((item) => {
  // VALORES ORIGINAIS (NÃO mexer!)
  let vlrDiaria = parseFloat(item.vlrdiaria || 0);
  let ctoDiaria = parseFloat(item.ctodiaria || 0);
  let vlrAjdAlimentacao = parseFloat(item.vlrajdctoalimentacao || 0);
  let vlrAjdTransporte = parseFloat(item.vlrajdctotransporte || 0);
  let vlrHospedagem = parseFloat(item.hospedagem || 0);
  let vlrTransporte = parseFloat(item.transporte || 0);

  let itemOrcamentoID = item.idorcamentoitem;
  const qtdItens = item.qtditens || 0;
  const qtdDias = item.qtddias || 0;

  // TOTAIS ORIGINAIS do banco
  let totVdaDiaria = parseFloat(item.totvdadiaria || 0);
  let totCtoDiaria = parseFloat(item.totctodiaria || 0);
  let totAjuda = parseFloat(item.totajdctoitem || 0);
  let totGeralItem = parseFloat(item.totgeralitem || 0);
  let descontoItem = parseFloat(item.descontoitem || 0);
  let acrescimoItem = parseFloat(item.acrescimoitem || 0);

  // ✅ REAJUSTA SÓ OS TOTAIS FINAIS (+8% exato)
  if (aplicarReajuste) {
    totVdaDiaria = ceilToTenCents(totVdaDiaria, fatorGeral);
    totCtoDiaria = ceilToTenCents(totCtoDiaria, fatorGeral);
    totAjuda = ceilToTenCents(totAjuda, fatorAjuda);
    totGeralItem = totCtoDiaria + totAjuda;

    itemOrcamentoID = ""; // Novo orçamento
  }

  const vlrBaseItem = vlrDiaria; // Unitário ORIGINAL

  const nomeProduto = item.produto || item.nmfuncao || item.nmequipamento || item.nmsuprimento || "";

  const newRow = tabelaBody.insertRow();
  newRow.dataset.idorcamentoitem = itemOrcamentoID || "";
  newRow.dataset.idfuncao = item.idfuncao || "";
  newRow.dataset.idequipamento = item.idequipamento || "";
  newRow.dataset.idsuprimento = item.idsuprimento || "";
  newRow.dataset.vlrbase = vlrBaseItem.toString(); // ORIGINAL
  newRow.dataset.reajustadoTotal = aplicarReajuste ? 'true' : 'false'; // Flag
  newRow.dataset.adicional = item.adicional ? "true" : "false";
  newRow.dataset.extrabonificado = item.extrabonificado ? "true" : "false";

  if (item.extrabonificado) {
    newRow.style.backgroundColor = "#f0fff4";
    newRow.style.borderLeft = "4px solid #48bb78";
  }

    newRow.innerHTML = `
            <td style="display: none;"><input type="hidden" class="idItemOrcamento" value="${itemOrcamentoID || ""}"></td>
            <td style="display: none;"><input type="hidden" class="idFuncao" value="${item.idfuncao || ""}"></td>
            <td style="display: none;"><input type="hidden" class="idEquipamento" value="${item.idequipamento || ""}"></td>
            <td style="display: none;"><input type="hidden" class="idSuprimento" value="${item.idsuprimento || ""}"></td>
            <td class="Proposta">
                <div class="checkbox-wrapper-33">
                    <label class="checkbox">
                        <input class="checkbox__trigger visuallyhidden" type="checkbox" ${item.enviarnaproposta && !item.extrabonificado ? "checked" : ""} ${item.extrabonificado ? "disabled" : ""} />
                        <span class="checkbox__symbol"><svg aria-hidden="true" class="icon-checkbox" width="28px" height="28px" viewBox="0 0 28 28"><path d="M4 14l8 7L24 7"></path></svg></span>
                    </label>
                    ${item.extrabonificado ? '<span style="font-size: 10px; color: #48bb78; font-weight: bold;">🎁 BONIFICADO</span>' : ''}
                </div>
            </td>
            <td class="cacheFechado">
            <div class="checkbox-wrapper-33">
                <label class="checkbox">
                    <input class="checkbox__trigger visuallyhidden chk-cache-fechado" type="checkbox" onchange="toggleEditavel(this)" ${item.cachefechado ? "checked" : ""} />
                    <span class="checkbox__symbol">
                        <svg aria-hidden="true" class="icon-checkbox" width="28px" height="28px" viewBox="0 0 28 28" version="1" xmlns="http://www.w3.org/2000/svg">
                            <path d="M4 14l8 7L24 7"></path>
                        </svg>
                    </span>
                    <p class="checkbox__textwrapper"></p>
                </label>
            </div>
        </td>
            <td class="Categoria">${item.categoria || ""}</td>
            <td class="qtdProduto">
                <div class="add-less">
                    <input type="number" class="qtdProduto" min="0" value="${qtdItens}">
                    <div class="Bt">
                        <button type="button" class="increment">+</button>
                        <button type="button" class="decrement">-</button>
                    </div>
                </div>
            </td>
            <td class="produto">${nomeProduto}</td>
            <td class="setor"><input type="text" class="setor-input" value="${item.setor || ""}"></td>
            <td class="qtdDias"><div class="add-less"><input type="number" readonly class="qtdDias" min="0" value="${qtdDias}"></div></td>
            <td class="Periodo"><div class="flatpickr-container"><input type="text" class="datas datas-item" data-input required readonly placeholder="Selecionar"></div></td>
            <td class="descontoItem Moeda">
                <div class="Acres-Desc">
                    <input type="text" class="ValorInteiros" value="${formatarMoeda(descontoItem)}">
                    <input type="text" class="valorPerCent" value="${parseFloat(item.percentdescontoitem || 0).toFixed(2)}%">
                </div>
            </td>
            <td class="acrescimoItem Moeda">
                <div class="Acres-Desc">
                    <input type="text" class="ValorInteiros" value="${formatarMoeda(acrescimoItem)}">
                    <input type="text" class="valorPerCent" value="${parseFloat(item.percentacrescimoitem || 0).toFixed(2)}%">
                </div>
            </td>            
            <td class="vlrVenda Moeda" data-original-venda="${vlrDiaria.toFixed(2)}">${formatarMoeda(vlrDiaria)}</td>
            <td class="totVdaDiaria Moeda">${formatarMoeda(totVdaDiaria)}</td>
            <td class="vlrCusto Moeda">${formatarMoeda(ctoDiaria)}</td>
            <td class="totCtoDiaria Moeda">${formatarMoeda(totCtoDiaria)}</td>
            <td class="ajdCusto Moeda alimentacao" data-original-ajdcusto="${vlrAjdAlimentacao}"><span class="vlralimentacao-input">${formatarMoeda(vlrAjdAlimentacao)}</span></td>
            <td class="ajdCusto Moeda transporte" data-original-ajdcusto="${vlrAjdTransporte}"><span class="vlrtransporte-input">${formatarMoeda(vlrAjdTransporte)}</span></td>
            <td class="totAjdCusto Moeda">${formatarMoeda(totAjuda)}</td>
            <td class="extraCampo Moeda" style="display: none;"><input type="text" class="hospedagem" value="${vlrHospedagem}"></td>
            <td class="extraCampo Moeda" style="display: none;"><input type="text" class="transporteExtraInput" value="${vlrTransporte}"></td>
            <td class="totGeral Moeda">${formatarMoeda(totGeralItem)}</td>
            <td><div class="Acao"><button class="btnApagar" type="button"><svg class="delete-svgIcon" viewBox="0 0 448 512"><path d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z"></path></svg></button></div></td>
        `;

    // --- EVENTOS ---
    const setupAcresDesc = (sel, type) => {
        const vi = newRow.querySelector(`${sel} .ValorInteiros`);
        const vp = newRow.querySelector(`${sel} .valorPerCent`);
        vi?.addEventListener("input", function() { lastEditedFieldType = "valor"; recalcularDescontoAcrescimo(this, type, "valor", newRow); });
        vi?.addEventListener("blur", function() { this.value = formatarMoeda(desformatarMoeda(this.value)); });
        vp?.addEventListener("input", function() { lastEditedFieldType = "percentual"; recalcularDescontoAcrescimo(this, type, "percentual", newRow); });
        vp?.addEventListener("blur", function() { this.value = formatarPercentual(desformatarPercentual(this.value)); });
    };

    setupAcresDesc(".descontoItem", "desconto");
    setupAcresDesc(".acrescimoItem", "acrescimo");

    newRow.querySelector(".qtdProduto input")?.addEventListener("input", () => recalcularLinha(newRow));
    newRow.querySelector(".increment")?.addEventListener("click", () => { const i = newRow.querySelector(".qtdProduto input"); i.value = parseInt(i.value) + 1; recalcularLinha(newRow); });
    newRow.querySelector(".decrement")?.addEventListener("click", () => { const i = newRow.querySelector(".qtdProduto input"); if(parseInt(i.value) > 0){ i.value = parseInt(i.value) - 1; recalcularLinha(newRow); }});

    const itemDateInput = newRow.querySelector(".datas-item");
    if (itemDateInput) {
      const dates = [];
      if (item.periododiariasinicio) dates.push(new Date(item.periododiariasinicio));
      if (item.periododiariasfim) dates.push(new Date(item.periododiariasfim));
      flatpickr(itemDateInput, { mode: "range", dateFormat: "d/m/Y", locale: flatpickr.l10ns.pt, defaultDate: dates, onChange: (sd) => atualizarQtdDias(itemDateInput, sd) });
        // Garante que o campo de datas seja sempre preenchido visualmente
        if (item.datas && item.datas.length > 0) {
          let fpInstance = itemDateInput._flatpickr;
          if (!fpInstance) {
            fpInstance = flatpickr(itemDateInput, commonFlatpickrOptionsTable);
          }
          fpInstance.setDate(item.datas, true);
        }
    }

    const delBtn = newRow.querySelector(".btnApagar");
    if (delBtn) {
      delBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        const id = newRow.dataset.idorcamentoitem;
        if (!id) { newRow.remove(); recalcularTotaisGerais(); }
        else {
          const { isConfirmed } = await Swal.fire({ title: `Excluir "${nomeProduto}"?`, icon: "warning", showCancelButton: true, confirmButtonText: "Sim, deletar!" });
          if (isConfirmed) {
            try {
              const principalId = document.getElementById("idOrcamento").value;
              await fetchComToken(`/orcamentos/${principalId}/itens/${id}`, { method: "DELETE" });
              newRow.remove();
              recalcularTotaisGerais();
              Swal.fire("Deletado!", "", "success");
            } catch (err) { Swal.fire("Erro!", err.message, "error"); }
          }
        }
      });
      if (!temPermissao("Orcamentos", "apagar")) delBtn.classList.add("btnDesabilitado");
    }
      if (item.cachefechado === true || item.cachefechado === "true") {
        const chkCache = newRow.querySelector(".chk-cache-fechado");
        if (chkCache) {
            // Chamamos a função passando o elemento para que ela trave os botões
            window.toggleEditavel(chkCache); 
        }
    }
  });


  if (aplicarReajuste) {
    const aviso = document.getElementById("avisoReajusteMensagem");
    if (aviso) aviso.textContent = `Reajuste aplicado sobre o orçamento original.`;
    recalcularTotaisGerais();
    aplicarDescontoEAcrescimo("Desconto"); 
  }

  aplicarMascaraMoeda();
}

function inicializarControleDatasELinhas() {
  const anoAtual = new Date().getFullYear();
  const linhas = document.querySelectorAll("tbody tr");

  linhas.forEach((linha) => {
    const inputPeriodo = linha.querySelector("input.datas-item");

    if (!inputPeriodo) return;

    // Inicializa Flatpickr se ainda não tiver
    if (!inputPeriodo._flatpickr) {
      let inicio = linha.dataset.inicio ? new Date(linha.dataset.inicio) : null;
      let fim = linha.dataset.fim ? new Date(linha.dataset.fim) : null;
      let defaultDates = [];
      if (inicio) defaultDates.push(inicio);
      if (fim) defaultDates.push(fim);

      flatpickr(inputPeriodo, {
        mode: "range",
        dateFormat: "d/m/Y",
        locale: flatpickr.l10ns.pt,
        defaultDate: defaultDates.length ? defaultDates : [],
        onChange: function (selectedDates, dateStr, instance) {
          const input = instance.input;

          // Atualiza quantidade de dias
          atualizarQtdDias(input, selectedDates);

          // Atualiza cor da linha
          atualizarCorLinha(input.closest("tr"));

          // Recalcula valores da linha
          recalcularLinha(input.closest("tr"));
        },
      });
    }

    // Atualiza cor da linha no carregamento
    atualizarCorLinha(linha);
  });

  // =========================================
  // Função para atualizar a cor da linha
  // =========================================
  function atualizarCorLinha(linha) {
    const input = linha.querySelector("input.datas-item.flatpickr-input");
    if (!input || !input.value) {
      linha.classList.remove("linha-vermelha");
      return;
    }

    const partes = input.value.split(" a ");
    if (partes.length === 2) {
      const anoInicio = parseInt(partes[0].split("/")[2], 10);
      const anoFim = parseInt(partes[1].split("/")[2], 10);

      if (anoInicio <= anoAtual || anoFim <= anoAtual) {
        linha.classList.add("linha-vermelha");
      } else {
        linha.classList.remove("linha-vermelha");
      }
    } else {
      linha.classList.remove("linha-vermelha");
    }
  }
}

// EXECUÇÃO AO CARREGAR PÁGINA
document.addEventListener("DOMContentLoaded", function () {
  inicializarControleDatasELinhas();
});

function formatarDatasParaInputPeriodo(inicioStr, fimStr) {
  const formatarSimples = (data) => {
    if (!data) return "";
    const d = new Date(data);
    if (isNaN(d.getTime())) return ""; // Verifica se a data é válida
    const dia = String(d.getDate()).padStart(2, "0");
    const mes = String(d.getMonth() + 1).padStart(2, "0"); // Mês é base 0
    const ano = d.getFullYear();
    return `${dia}/${mes}/${ano}`;
  };

  const inicioFormatado = formatarSimples(inicioStr);
  const fimFormatado = formatarSimples(fimStr);

  if (inicioFormatado && fimFormatado) {
    if (inicioFormatado === fimFormatado) {
      return inicioFormatado; // Se for a mesma data, mostra apenas uma vez
    }
    return `${inicioFormatado} até ${fimFormatado}`;
  } else if (inicioFormatado) {
    return inicioFormatado; // Se só tiver data de início
  }
  return ""; // Se não tiver nenhuma data
}

// --- Função para Limpar o Formulário Principal ---

export function limparFormularioOrcamento() {
  document.getElementById("form").reset();
  idOrcamentoInput.value = "";

  // Limpar seleções de Flatpickr para todos os inputs
  for (const id in flatpickrInstances) {
    const pickerInstance = flatpickrInstances[id];
    if (pickerInstance) {
      pickerInstance.clear();
    }
  }

  // Resetar selects para a opção padrão (Selecione...)
  if (statusSelect) statusSelect.value = "";
  if (clienteSelect) clienteSelect.value = "";
  if (eventoSelect) eventoSelect.value = "";
  if (localMontagemSelect) localMontagemSelect.value = "";

  // TODO: Se você tiver uma função para limpar a tabela de itens, chame-a aqui
  // Ex: limparItensOrcamentoTabela();

  const avisoMensagem = document.getElementById("avisoReajusteMensagem");
  if (avisoMensagem) {
    avisoMensagem.textContent = ""; // Limpa o texto da mensagem
  }

  // 2. Reseta o input hidden de status (se for o caso)
  const avisoStatusInput = document.getElementById("inputAvisoReajusteStatus");
  if (avisoStatusInput) {
    avisoStatusInput.value = "false";
  }

  // 3. Limpa o input hidden de texto (se você o estiver usando)
  const avisoTextoInput = document.getElementById("avisoReajusteTexto");
  if (avisoTextoInput) {
    avisoTextoInput.value = "";
  }
}

function getPeriodoDatas(inputValue) {
  // Recebe diretamente o valor do input

  console.log("Valor do input recebido:", inputValue);

  if (typeof inputValue !== "string" || inputValue.trim() === "") {
    // Se o input estiver vazio ou não for uma string, retorna null para as datas.
    // Isso é exatamente o que você quer para campos opcionais não preenchidos.
    return { inicio: null, fim: null };
  }
  const datas = inputValue.split(" até ");

  let dataInicial = null;
  let dataFinal = null;

  if (datas.length === 2) {
    // Se há duas partes, é um período completo (início e fim)
    dataInicial = formatarDataParaBackend(datas[0].trim()); // Trim para remover espaços extras
    dataFinal = formatarDataParaBackend(datas[1].trim());
  } else if (datas.length === 1) {
    // Se há apenas uma parte, é uma única data selecionada
    dataInicial = formatarDataParaBackend(datas[0].trim());
    dataFinal = formatarDataParaBackend(datas[0].trim()); // Ou null, dependendo da sua regra para um único dia
    // Deixei como a mesma data para um período de 1 dia.
  }
  // Caso contrário (datas.length é 0, já tratado pela validação inicial)
  console.log("Datas retornadas:", { inicio: dataInicial, fim: dataFinal });
  return { inicio: dataInicial, fim: dataFinal };
}

function formatarDataParaBackend(dataString) {
  if (!dataString) return null;
  const partes = dataString.split("/");
  if (partes.length === 3) {
    let dia = partes[0];
    let mes = partes[1];
    let ano = partes[2];

    // Adiciona 2000 para anos de 2 dígitos, assumindo que são anos do século 21
    // Se você tiver datas antes de 2000, essa lógica precisará ser mais robusta
    if (ano.length === 2) {
      const currentYear = new Date().getFullYear();
      const century = Math.floor(currentYear / 100) * 100; // Ex: 2000

      // Heurística simples: se o ano de 2 dígitos for maior que o ano atual de 2 dígitos (ex: 95 para 2024),
      // assume século passado (19xx). Caso contrário, assume século atual (20xx).
      // A melhor prática é que o campo de data sempre retorne 4 dígitos do frontend.
      if (parseInt(ano) > currentYear % 100) {
        ano = century - 100 + parseInt(ano); // Ex: 1995
      } else {
        ano = century + parseInt(ano); // Ex: 2025
      }
    }

    // Garante que mês e dia tenham 2 dígitos (adiciona '0' à esquerda se necessário)
    mes = mes.padStart(2, "0");
    dia = dia.padStart(2, "0");

    return `${ano}-${mes}-${dia}`; // Retorna no formato YYYY-MM-DD
  }
  //return dataString; // Retorna como está se não for DD/MM/YYYY
  return null; // Retorna null se a data não estiver no formato esperado
}

function formatarRangeDataParaBackend(dataRange) {
  if (!dataRange) return null;

  const partes = dataRange
    .replace(" até ", " to ")
    .replace(" a ", " to ")
    .split(" to ")
    .map((d) => d.trim());

  if (partes.length !== 2) return null;

  const dataInicio = formatarDataParaBackend(partes[0]);
  const dataFim = formatarDataParaBackend(partes[1]);

  return `${dataInicio} a ${dataFim}`;
}

function formatarRangeParaInput(dataRangeISO) {
  console.log("DATAS", dataRangeISO);

  if (dataRangeISO === null || dataRangeISO === undefined) {
    return ""; // Retorna uma string vazia se a data for nula
  }

  if (!dataRangeISO.includes(" a ")) {
    return ""; // formato inválido
  }

  const [inicio, fim] = dataRangeISO.split(" a ");
  return formatarDataParaBR(inicio) + " a " + formatarDataParaBR(fim);
}

// function formatarDataParaBR(dataISO) {
//     const [ano, mes, dia] = dataISO.split('-');
//     return `${dia}/${mes}/${ano}`;
// }

function formatarDataParaBR(dataISOString) {
  if (!dataISOString) {
    return ""; // Retorna vazio se a string for nula ou vazia
  }

  try {
    // Tenta criar um objeto Date a partir da string ISO.
    // O construtor Date() é inteligente o suficiente para lidar com ISO 8601.
    const data = new Date(dataISOString);

    // Verifica se o objeto Date resultante é válido
    if (isNaN(data.getTime())) {
      console.warn(
        `[formatarDataParaBR] Data inválida recebida: "${dataISOString}". Retornando vazio.`
      );
      return "";
    }

    // Extrai dia, mês e ano.
    // `getDate()` retorna o dia do mês (1-31).
    // `getMonth()` retorna o mês (0-11), então adicionamos 1.
    // `getFullYear()` retorna o ano.
    // `padStart(2, '0')` garante que dia e mês tenham sempre dois dígitos (ex: "05" em vez de "5").
    const dia = String(data.getDate()).padStart(2, "0");
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const ano = data.getFullYear();

    return `${dia}/${mes}/${ano}`; // Retorna no formato DD/MM/YYYY
  } catch (e) {
    // Captura qualquer erro durante o processo de formatação
    console.error(
      `[formatarDataParaBR] Erro ao formatar data "${dataISOString}":`,
      e
    );
    return ""; // Em caso de erro, retorna vazio
  }
}

function parsePercentValue(valueString) {
  if (typeof valueString !== "string" || !valueString) {
    return 0; // Ou null, dependendo do que seu banco espera para campos vazios
  }
  // Remove o '%' e espaços, depois substitui vírgula por ponto para parseFloat
  const cleanedValue = valueString.replace("%", "").trim().replace(",", ".");
  return parseFloat(cleanedValue) || 0; // Retorna 0 se não for um número válido após a limpeza
}

// Função auxiliar para formatar percentuais (se você precisar)
function formatarPercentual(valor) {
  //if (valor === null || valor === undefined) return '';
  //return (parseFloat(valor)).toFixed(2) + '%'; // Converte 0.1 para 10.00%

  if (valor === null || valor === undefined || valor === "") {
    return "0,00%"; // Retorna um valor padrão para nulos/vazios
  }
  const numero = parseFloat(valor);
  if (isNaN(numero)) {
    console.warn(
      `Valor inválido para formatarPercentual: ${valor}. Retornando 0,00%.`
    );
    return "0,00%";
  }
  const numeroFormatado = numero;
  // Usa toLocaleString para formatação com vírgula e 2 casas decimais, depois adiciona o '%'
  return `${numeroFormatado.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function desformatarPercentual(texto) {
  if (!texto) return 0;
  return parseFloat(texto.replace("%", "").replace(",", ".").trim()) || 0;
}

//SALVANDO ORCAMENTO
function enviarOrcamento() {
  const tabela = document.getElementById("tabela");
  const linhas = tabela.querySelectorAll("tbody tr");
  const dados = [];

  linhas.forEach((linha) => {
    const produto = linha.querySelector(".produto")?.textContent.trim();
    const vlrCusto = linha.querySelector(".vlrCusto")?.textContent.trim();
    const vlrVenda = linha.querySelector(".vlrVenda")?.textContent.trim();

    // Só adiciona se tiver produto
    if (produto) {
      dados.push({
        produto,
        vlrCusto: parseFloat(vlrCusto),
        vlrVenda: parseFloat(vlrVenda),
      });
    }
  });

  console.log("Dados a enviar:", dados);

  fetchComToken("/orcamento", {
    method: "POST",
    // headers: {
    //     "Content-Type": "application/json",
    //     'Authorization': `Bearer ${token}`
    //     // 'x-id-empresa': idEmpresa
    // },
    body: JSON.stringify({ Pessoas: dados }),
  })
    .then((res) => res.json())
    .then((res) => {
      console.log("Resposta do servidor:", res);
      alert("Orçamento enviado com sucesso!");
    })
    .catch((err) => {
      console.error("Erro ao enviar orçamento:", err);
      alert("Erro ao enviar orçamento.");
    });
}

// Exportar as funções se necessário

// -------------------------------------- input Desconto e Acrésimo -----------------------------------------------------------
// window.addEventListener('DOMContentLoaded', () => {

//     console.log("ENTROU NO ADD PARA APLICAR DESCONTO E ACRESCIMO");
//     aplicarDescontoEAcrescimo(); // ✅ Atualiza o valor do cliente assim que a tela carregar

//     // Seu listener existente
//     document.body.addEventListener('blur', function (e) {
//         const input = e.target;
//         const inputId = input.id || input.className;
//         console.log(`DEBUG: Evento blur disparado por: ${inputId}`);
//         // Campos por linha
//         if (
//             input.matches('.descontoItem .ValorInteiros') ||
//             input.matches('.acrescimoItem .ValorInteiros') ||
//             input.matches('.descontoItem .valorPerCent') ||
//             input.matches('.acrescimoItem .valorPerCent')
//         ) {
//             const linha = input.closest('tr');
//             if (linha) {
//                 recalcularLinha(linha);
//             }
//         }

//         // Campos gerais
//         if (
//             input.matches('#Desconto') ||
//             input.matches('#percentDesc') ||
//             input.matches('#Acrescimo') ||
//             input.matches('#percentAcresc')
//         ) {
//             aplicarDescontoEAcrescimo();
//         }
//     }, true);
// });

// ------------------------------- Preenchimento automatico -------------------------
document.querySelectorAll(".form2 input").forEach((input) => {
  // Verifica se o campo já tem valor ao carregar
  if (input.value.trim() !== "") {
    input.classList.add("preenchido");
  }

  // Ao digitar ou colar algo
  input.addEventListener("input", () => {
    if (input.value.trim() !== "") {
      input.classList.add("preenchido");
    } else {
      input.classList.remove("preenchido");
    }
  });

  // Em caso de preenchimento via script
  input.addEventListener("blur", () => {
    if (input.value.trim() !== "") {
      input.classList.add("preenchido");
    } else {
      input.classList.remove("preenchido");
    }
  });
});

//   ------------------ exibição de Moeda --------------------------------
function formatarMoeda(valor) {
  // return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  if (valor === null || valor === undefined || valor === "") {
    return "R$ 0,00"; // Retorna um valor padrão para nulos/vazios
  }
  // Converte o valor para float e verifica se é um número válido
  const numero = parseFloat(valor);
  if (isNaN(numero)) {
    console.warn(
      `Valor inválido para formatarMoeda: ${valor}. Retornando R$ 0,00.`
    );
    return "R$ 0,00";
  }
  return numero.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function recalcularLinha(linha) {
    if (!linha) return;

    try {
        // --- 1. VERIFICAÇÃO DE CACHÊ FECHADO ---
        const chkCacheFechado = linha.querySelector(".chk-cache-fechado");
        const isCacheFechado = chkCacheFechado && chkCacheFechado.checked;

        // --- 2. CAPTURA DE QUANTIDADES ---
        const qtdItens = parseFloat(linha.querySelector(".qtdProduto input")?.value || linha.querySelector(".qtdItens")?.value) || 0;
        const qtdDias = parseFloat(linha.querySelector(".qtdDias input")?.value || linha.querySelector(".qtddias")?.value) || 0;

        // LÓGICA NOVA: Se for cachê fechado, a quantidade de itens não multiplica o valor (fator vira apenas os dias)
        const fatorMultiplicador = isCacheFechado ? qtdDias : (qtdItens * qtdDias);
        
        // Mantemos o totalFator original caso precise para algum log, 
        // mas usaremos o fatorMultiplicador para o dinheiro.
        const totalFator = fatorMultiplicador; 

        // --- 3. VALOR DE VENDA (Base Imutável e REAJUSTADO) ---
        const celulaVenda = linha.querySelector(".vlrVenda");
        let vlrVendaOriginal = parseFloat(linha.dataset.vlrbase);
        if (isNaN(vlrVendaOriginal) || vlrVendaOriginal <= 0) {
          vlrVendaOriginal = parseFloat(celulaVenda?.dataset.originalVenda) || desformatarMoeda(celulaVenda?.textContent) || 0;
          linha.dataset.vlrbase = vlrVendaOriginal;
        }

        // --- 4. AJUSTES (Desconto e Acréscimo) ---
        const lerAjuste = (seletor) => {
            const el = linha.querySelector(seletor);
            if (!el) return 0;
            return el.mask ? (parseFloat(el.mask.unmaskedValue) || 0) : (desformatarMoeda(el.value) || 0);
        };

        const desconto = lerAjuste(".descontoItem .ValorInteiros");
        const acrescimo = lerAjuste(".acrescimoItem .ValorInteiros");

        // --- 5. LOGÍSTICA (Alimentação, Transporte, Hospedagem) ---
        const lerCustoUnitario = (seletor) => {
            const el = linha.querySelector(seletor);
            return desformatarMoeda(el?.tagName === "INPUT" ? el.value : el?.textContent) || 0;
        };

        const vlrAlimUnit = lerCustoUnitario(".vlralimentacao-input") || lerCustoUnitario(".ajdCusto.alimentacao");
        const vlrTranspUnit = lerCustoUnitario(".vlrtransporte-input") || lerCustoUnitario(".ajdCusto.transporte");
        const vlrCustoFixoUnit = lerCustoUnitario(".vlrCusto");
        
        const hospedagemTotal = desformatarMoeda(linha.querySelector(".hospedagem")?.value) || 0;
        const transporteExtra = desformatarMoeda(linha.querySelector(".transporteExtraInput")?.value) || 0;

        // --- 6. MATEMÁTICA FINANCEIRA ---
        let vlrVendaFinalUnit = vlrVendaOriginal - desconto + acrescimo;

        // Regra de Bonificação (Se for brinde, venda é zero)
        if (linha.dataset?.extrabonificado === "true") vlrVendaFinalUnit = 0;

        // O cálculo agora usa o fatorMultiplicador que respeita a flag de Cachê Fechado
        const totalVendaLinha = (vlrVendaFinalUnit * totalFator) + (hospedagemTotal * totalFator) + transporteExtra;
        const totalAjudaCusto = (vlrAlimUnit + vlrTranspUnit) * totalFator;
        const totalCustoBase = vlrCustoFixoUnit * totalFator;
        const custoTotalReal = totalCustoBase + totalAjudaCusto;

        // --- 7. ATUALIZAÇÃO SEGURA DA DOM ---
        const atualizar = (seletor, valor, isInput = false) => {
            const el = linha.querySelector(seletor);
            if (!el) return;
            const formatado = valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
            if (isInput) el.value = formatado; else el.textContent = formatado;
        };

        atualizar(".vlrVenda", vlrVendaFinalUnit);
        atualizar(".totVdaDiaria", totalVendaLinha);
        atualizar(".totCtoDiaria", totalCustoBase);
        atualizar(".totAjdCusto", totalAjudaCusto);
        atualizar(".totGeral", custoTotalReal);

        // --- 8. SINCRONIA GERAL ---
        if (typeof recalcularTotaisGerais === "function") {
            recalcularTotaisGerais();
        }

    } catch (error) {
        console.error("Falha crítica no cálculo da linha:", error);
    }
}

let isRecalculandoSincronizado = false;

function recalcularDescontoAcrescimo(input, type, fieldType, linha) {
  if (isRecalculatingDiscountAcrescimo) return;
  isRecalculatingDiscountAcrescimo = true;

  try {
    const valorInput = linha.querySelector(`.${type}Item .ValorInteiros`);
    const percentualInput = linha.querySelector(`.${type}Item .valorPerCent`);

    if (!valorInput || !percentualInput) {
      isRecalculatingDiscountAcrescimo = false;
      return;
    }


    // Usa sempre o valor base da linha (dataset.vlrbase) para o cálculo
    let vlrBase = parseFloat(linha.dataset.vlrbase) || 0;
    if (vlrBase <= 0) {
      // fallback para o valor exibido, se necessário
      vlrBase = desformatarMoeda(linha.querySelector(".vlrVenda")?.textContent) || 0;
    }

    if (fieldType === "valor") {
      // Se editou o valor em R$, calcula a nova porcentagem
      const valor = desformatarMoeda(input.value);
      let percentual = 0;
      if (vlrBase > 0) {
        percentual = (valor / vlrBase) * 100;
      }
      percentualInput.value = formatarPercentual(percentual);
    } else if (fieldType === "percentual") {
      // Se editou a %, calcula o novo valor em R$
      const percentual = desformatarPercentual(input.value);
      const valor = (percentual / 100) * vlrBase;
      valorInput.value = formatarMoeda(valor);
    }

    // Se o usuário alterou um campo, sempre atualiza o outro para garantir sincronização
    // (Evita loop usando o isRecalculatingDiscountAcrescimo)

    recalcularLinha(linha);

  } finally {
    isRecalculatingDiscountAcrescimo = false;
  }
}


function aplicarMascaraMoeda() {
  // Formatar valores de <td> com a classe .Moeda
  document.querySelectorAll("td.Moeda").forEach((td) => {
    let valor = parseFloat(td.textContent);
    console.log("valor1", valor);
    if (!isNaN(valor)) {
      td.textContent = valor.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });
    }
  });

  // Formatar inputs somente se forem readonly (apenas visual)
  document.querySelectorAll("input.Moeda[readonly]").forEach((input) => {
    let valor = parseFloat(input.value);
    console.log("valor2", valor);
    if (!isNaN(valor)) {
      input.dataset.valorOriginal = input.value; // guarda o valor real
      input.value = valor.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });
    }
  });
}

function removerMascaraMoedaInputs() {
  document.querySelectorAll("input.Moeda[readonly]").forEach((input) => {
    if (input.dataset.valorOriginal) {
      input.value = input.dataset.valorOriginal;
    }
  });
}

// Chame após o cálculo ou inserção de valores
aplicarMascaraMoeda();

/**
 * Bloqueia ou desbloqueia campos de formulário e botões
 * com base no status do orçamento ('F' para Fechado).
 */
/**
 * Bloqueia ou desbloqueia campos de formulário e botões
 * com base no status do orçamento ('F' para Fechado).
 */
function bloquearCamposSeFechado() {
    const statusInput = document.getElementById('Status');
    const fechado = statusInput?.value === 'F';

    const orcamentoAtual = getOrcamentoAtualCarregado();
    const bProximoAnoCarregado = orcamentoAtual?.geradoanoposterior === true; 

    // Campos que podem ser editados mesmo em status 'F' (Observações)
    const idsPermitidos = ['ObservacaoProposta', 'Observacao'];

    const tabela = document.querySelector('table');

    if (fechado) {
        // ----------------------------------------------------
        // BLOQUEIO DE CAMPOS (Status = 'F')
        // ----------------------------------------------------
        const campos = document.querySelectorAll('input, select, textarea');
        campos.forEach(campo => {
            const id = campo.id;
            const dentroDeAdicional = campo.closest('.linhaAdicional');

            // 🛑 EXCEÇÃO: NÃO bloquear se for linha adicional ou campo permitido
            if (         
                idsPermitidos.includes(id) ||
                dentroDeAdicional
            ) return;

            // Bloqueio Seletivo:
            if (campo.tagName === 'INPUT' || campo.tagName === 'TEXTAREA') {
                // Para inputs (incluindo datas), use readOnly para impedir digitação.
                campo.readOnly = true;
                
                // 🔑 NOVO: Use pointerEvents para impedir cliques e abertura do Flatpickr/Calendário.
                // Isso NÃO impede o envio do valor.
                campo.style.pointerEvents = 'none'; 
                
            } else if (campo.tagName === 'SELECT') {
                // Para selects, disabled é o único que funciona para bloquear interação.
                campo.disabled = true;
            }

            campo.classList.add('bloqueado');
        });

        // Gerencia os botões (Mantido inalterado)
        const botoes = document.querySelectorAll('button');
        botoes.forEach(botao => {
            const id = botao.id || '';
            const classes = botao.classList;

            const deveContinuarAtivo =
                id === 'Enviar' ||
                id === 'Close' ||
                id === 'Limpar' ||
                classes.contains('Close') ||
                classes.contains('pesquisar') ||
                classes.contains('Adicional') || 
                classes.contains('Excel') ||
                classes.contains('Contrato') ;

            if (id === 'GerarProximoAno') {
                botao.style.display = 'inline-block'; 
                
                if (bProximoAnoCarregado) {
                    botao.disabled = true; 
                    botao.textContent = 'Próximo Ano JÁ Gerado';
                    botao.title = 'Um orçamento para o ano seguinte já foi gerado a partir deste.';
                } else {
                    botao.disabled = false;
                    botao.textContent = 'Gerar Próximo Ano';
                    botao.title = 'Clique para espelhar este orçamento para o próximo ano.';
                }
            } 
            
            else if (id === 'fecharOrc' || id ==='Excel' || classes ==='Contrato' || id === 'adicionarLinha') {
                botao.style.display = 'none';
            } else if (deveContinuarAtivo) {
                botao.style.display = 'inline-block';
                botao.disabled = false;
            } else {
                // Outros botões ficam desabilitados
                botao.disabled = true;
            }
            
            if (id === 'Proposta' || classes.contains('Proposta')) {
                botao.disabled = true;
                botao.style.display = 'none';
            }
        });

        // Altera a cor da tabela
        if (tabela) {
            tabela.classList.add('bloqueada');
        }

    } else {
        // ----------------------------------------------------
        // DESBLOQUEIO DE CAMPOS (Status != 'F')
        // ----------------------------------------------------
        const campos = document.querySelectorAll('input, select, textarea');
        campos.forEach(campo => {
            campo.classList.remove('bloqueado');
            campo.readOnly = false;
            // Garante que os selects e outros campos desabilitados sejam re-habilitados
            campo.disabled = false; 
            
            // 🔑 NOVO: Remove o bloqueio de evento para permitir interação total (cliques e calendários)
            campo.style.pointerEvents = 'auto'; 
        });

        const botoes = document.querySelectorAll('button');
        botoes.forEach(botao => {
            const id = botao.id || '';
            const classes = botao.classList;
            
            if (id === 'GerarProximoAno') {
                botao.style.display = 'none';
                return;
            } 

            if (classes.contains('Excel') || classes.contains('Contrato') || classes.contains('Adicional')) {
                botao.style.display = 'none';
            } 
            
            else if (id === 'fecharOrc' || id === 'Enviar' || id === 'Limpar' || id === 'Proposta' || id === 'adicionarLinha') {
                botao.style.display = 'inline-block';
                botao.disabled = false;
            } 
            
            else if (classes.contains('pesquisar') || classes.contains('Close')) {
                botao.style.display = 'inline-block';
                botao.disabled = false;
            }
        });

        if (tabela) {
            tabela.classList.remove('bloqueada');
        }
    }
}


/**
 * Função para tratar o foco nos campos e disparar alerta de bloqueio. (Mantido inalterado)
 */
function handleCampoFocus(event) {
    const statusInput = document.getElementById("Status");
    const fechado = statusInput?.value === "F";
    const campo = event.currentTarget;

    // Campos permitidos para edição mesmo se fechado (Desconto, Acrescimo, etc.)
    const idsPermitidos = [
        "Desconto",
        "perCentDesc",
        "Acrescimo",
        "perCentAcresc",
        "ObservacaoProposta",
        "Observacao",
    ];
    
    // Verifica se o campo está dentro de uma linha adicional
    const dentroDeAdicional = campo.closest(".linhaAdicional");

    // Se estiver fechado E NÃO for campo permitido OU NÃO for campo de adicional
    if (
        fechado &&
        !campo.classList.contains("idFuncao") &&
        !campo.classList.contains("idEquipamento") &&
        !campo.classList.contains("idSuprimento") &&
        !idsPermitidos.includes(campo.id) &&
        !dentroDeAdicional 
    ) {
        Swal.fire(
            "Orçamento fechado",
            "Este orçamento está fechado. Não é possível fazer alterações, apenas inserir adicionais.",
            "warning"
        );
        
        // 🔑 Adicionado: Garante que o contêiner do SweetAlert tenha interação.
        const swalContainer = document.querySelector('.swal2-container');
        if (swalContainer) {
            swalContainer.style.pointerEvents = 'auto';
            swalContainer.campo.disabled = false;
        }
        
        campo.blur(); // Tira o foco
    }
}

// ----------------------------------------------------
// Bloco de Anexação de Listeners (Para Elementos Estáticos)
// ----------------------------------------------------

const elementosEditaveis = document.querySelectorAll(
    "input, select, textarea, .Proposta input"
);
elementosEditaveis.forEach((el) => {
    // Adiciona o listener uma única vez
    el.addEventListener("focus", handleCampoFocus);
});

function liberarSelectsParaAdicional() {
  const selectsParaLiberar = [
    document.getElementById("selectFuncao"),
    document.getElementById("selectEquipamento"),
    document.getElementById("selectSuprimento"),
    // Adicione aqui os IDs/elementos reais dos seus selects externos
  ];

  selectsParaLiberar.forEach((select) => {
    if (select) {
      select.disabled = false;
      select.classList.remove("bloqueado");
      // Nota: Se você usar readOnly para selects, use: select.readOnly = false;
    }
  });

  // Você também pode liberar o botão de 'Adicionar Item' aqui se ele estiver bloqueado
  // const btnAddItem = document.getElementById('adicionarLinha');
  // if (btnAddItem) {
  //     btnAddItem.disabled = false;
  // }
}
// Adicione esta função em Orcamentos.js
function verificarStatusParaAdicional() {
    const statusOrcamento = document.getElementById('Status')?.value;
    const btnAdicional = document.getElementById('adicionarLinhaAdicional');
    const btnNormal = document.getElementById('adicionarLinha');
    const tabelaBody = document.getElementById("tabela")?.getElementsByTagName("tbody")[0];
    
    // Mostra o botão 'Adicional' se o status for 'F' (Fechado) e esconde o normal
    if (statusOrcamento === 'F') {
        if (btnAdicional) {
            btnAdicional.style.display = 'block';
            console.log("Status Fechado, botão 'Adicional' habilitado.");
        }
        if (btnNormal) {
            btnNormal.style.display = 'none'; // Impede adição normal quando fechado
        }
        
        // Se o orçamento estiver fechado, todos os itens existentes
        // (que não são adicionais) devem ser bloqueados para edição
        if(tabelaBody) {
             const linhas = tabelaBody.querySelectorAll('tr');
             linhas.forEach(linha => {
                 const inputAdicional = linha.querySelector('input.adicional-input');
                 // Se não for um item adicional, bloqueia a edição
                 if (!inputAdicional || inputAdicional.value !== 'true') {
                     bloquearCamposLinha(linha); // Assumindo que você tem uma função que bloqueia os campos
                 }
             });
        }

    } else {
        // Se não for 'F', mostra o botão normal e esconde o adicional
        if (btnAdicional) {
            btnAdicional.style.display = 'none';
        }
        if (btnNormal) {
            btnNormal.style.display = 'block';
        }
        // Desbloqueia todos os campos se estiver Aberto/Proposta/etc.
        if(tabelaBody) {
             const linhas = tabelaBody.querySelectorAll('tr');
             linhas.forEach(linha => {
                 desbloquearCamposLinha(linha); // Assumindo que você tem uma função que desbloqueia os campos
             });
        }
    }
}

// Chame esta função dentro de `configurarEventosOrcamento` e no `load`
// e adicione um listener para o `#Status`
document.addEventListener("DOMContentLoaded", verificarStatusParaAdicional); // Chama no carregamento

const statusInput = document.getElementById('Status');
if (statusInput) {
    statusInput.addEventListener('change', verificarStatusParaAdicional);
    // Para garantir que a verificação rode após carregar um orçamento
    statusInput.addEventListener('blur', verificarStatusParaAdicional);
}

document
  .getElementById("fecharOrc")
  .addEventListener("click", function (event) {
    event.preventDefault();
    fecharOrcamento();
  });

function fecharOrcamento() {
  const statusInput = document.getElementById("Status");

  if (statusInput.value === "F") {
    Swal.fire(
      "Orçamento fechado",
      "Este orçamento está fechado e não pode ser alterado.",
      "warning"
    );
    return;
  }

  // Swal.fire({
  //     title: 'Deseja realmente fechar este orçamento?',
  //     text: "Você não poderá reabrir diretamente.",
  //     icon: 'warning',
  //     showCancelButton: true,
  //     cancelButtonText: 'Cancelar',
  //     confirmButtonText: 'Sim, fechar',
  //     reverseButtons: true,
  //     focusCancel:true
  // }).then((result) => {
  //     if (result.isConfirmed) {
  //     statusInput.value = 'F';
  //     bloquearCamposSeFechado();
  //     Swal.fire('Fechado!', 'O orçamento foi fechado com sucesso.', 'success');
  //     }
  // });
  Swal.fire({
    title: "Deseja realmente fechar este orçamento?",
    text: "Você não poderá reabrir diretamente.",
    icon: "warning",
    showCancelButton: true,
    cancelButtonText: "Cancelar",
    confirmButtonText: "Sim, fechar",
    reverseButtons: true,
    focusCancel: true,
  }).then(async (result) => {
    // Adicionado 'async' aqui para usar 'await'
    if (result.isConfirmed) {
      try {
        const idOrcamento = document.getElementById("idOrcamento")?.value;
        const orcamentoIdNumerico = parseInt(idOrcamento, 10);

        if (!orcamentoIdNumerico || isNaN(orcamentoIdNumerico)) {
          Swal.fire(
            "Erro!",
            "ID do orçamento inválido. Salve-o antes de fechar.",
            "error"
          );
          return;
        }
        // 1. Prepare os dados para enviar ao backend
        const resultado = await fetchComToken(
          `orcamentos/fechar/${orcamentoIdNumerico}`,
          {
            method: "PUT",
            // Não precisa de body, o status 'F' é definido no backend
          }
        );

        // Verifique a resposta e atualize a UI
        if (resultado.message) {
          document.getElementById("Status").value = "F"; // Atualiza o input localmente
          bloquearCamposSeFechado();
          Swal.fire("Fechado!", resultado.message, "success");
        }
      } catch (error) {
        console.error("Erro ao fechar o orçamento:", error);
        let errorMessage =
          error.message || "Ocorreu um erro ao fechar o orçamento.";
        Swal.fire("Erro!", errorMessage, "error");
      }
    }
  });
}

async function gerarProximoAno() {
  // 1. Obter o orçamento atual (ajuste esta linha se a fonte dos dados for diferente)
  const orcamentoFechado = getOrcamentoAtualCarregado(); // Função hipotética para pegar o objeto

  if (!orcamentoFechado) {
    Swal.fire(
      "Erro",
      "Nenhum orçamento atual encontrado para espelhamento.",
      "error"
    );
    return;
  }

  // =======================================================
  // NOVO PASSO: Confirmação de Reajuste
  // =======================================================
  const { isConfirmed: deveReajustar } = await Swal.fire({
    title: "Próximo Ano",
    text: "Deseja aplicar um percentual de reajuste nos valores (Custo e Venda) do novo orçamento, ou usar os valores atuais do orçamento espelhado?",
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Aplicar Reajuste",
    cancelButtonText: "Usar Valores Atuais",
    reverseButtons: true, // Inverte a ordem para o "Confirmar" ficar à direita
  });
  
  // Se o usuário escolher 'Usar Valores Atuais' (cancelButtonText), 'deveReajustar' será false.
  // Neste caso, GLOBAL_PERCENTUAL_GERAL e GLOBAL_PERCENTUAL_AJUDA permanecerão 0.
  let percentualGeral = 0;
  let percentualAjuda = 0;

  // =======================================================
  // PASSO CONDICIONAL: Solicitar Percentuais de Reajuste
  // =======================================================
  if (deveReajustar) {
    const { value: formValues } = await Swal.fire({
      title: "Reajuste para o Próximo Ano",
      html:
        '<div class="swal-container">' +
        '  <label for="swal-percentual-geral">Percentual Geral (%) (Custo/Venda):</label>' +
        '  <input id="swal-percentual-geral" type="number" step="0.01" min="0" tabindex="1" placeholder="Ex: 10.50">' +
        "  <small>Será aplicado ao valor unitário de todos os itens (venda e custo).</small>" +
        '  <label for="swal-percentual-ajuda">Percentual Ajuda de Custo (%) (Diárias):</label>' +
        '  <input id="swal-percentual-ajuda" type="number" step="0.01" min="0" tabindex="2" placeholder="Ex: 5.00">' +
        "  <small>Será aplicado à Alimentação e Transporte.</small>" +
        "</div>",

      focusConfirm: false,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showCancelButton: true,
      confirmButtonText: "Aplicar Reajuste",
      cancelButtonText: "Cancelar",

      didOpen: (popup) => {
        const inputs = popup.querySelectorAll("input");
        inputs.forEach((input) => {
          input.removeAttribute("readonly");
          input.style.pointerEvents = "auto";
        });
        inputs[0].focus();
      },

      preConfirm: () => {
        const geral = parseFloat(
          document
            .getElementById("swal-percentual-geral")
            .value.replace(",", ".") || "0"
        );
        const ajuda = parseFloat(
          document
            .getElementById("swal-percentual-ajuda")
            .value.replace(",", ".") || "0"
        );

        if (isNaN(geral) || isNaN(ajuda)) {
          Swal.showValidationMessage(
            "Por favor, insira valores numéricos válidos."
          );
          return false;
        }
        return { percentualGeral: geral, percentualAjuda: ajuda };
      },
    });

    // Se o usuário cancelou o *segundo* Swal (o de reajuste), interrompe
    if (!formValues) {
      return;
    }
    
    percentualGeral = formValues.percentualGeral;
    percentualAjuda = formValues.percentualAjuda;
  }
  
  // =======================================================
  // 2. ARMAZENAMENTO E LÓGICA DE ESPELHAMENTO
  // =======================================================

  // Armazena os percentuais globalmente (0 se o usuário escolheu 'Usar Valores Atuais')
  GLOBAL_PERCENTUAL_GERAL = percentualGeral;
  GLOBAL_PERCENTUAL_AJUDA = percentualAjuda;

  idOrcamentoOriginalParaAtualizar = orcamentoFechado.idorcamento;
  bProximoAno = true;

  const anoCorrente = new Date().getFullYear();
  anoProximoOrcamento = anoCorrente + 1;

  console.log("PROXIMO ANO EM GERARPROXIMOANO", anoProximoOrcamento);

  // 2. Criar o objeto para o novo orçamento
  const novoOrcamento = { ...orcamentoFechado };

  // 3. Limpar/Atualizar campos de controle

  // a. IDs e Status (Deve ser um novo orçamento)
  novoOrcamento.idorcamento = null;
  novoOrcamento.nrorcamento = ""; // O número deve ser gerado na hora de salvar
  novoOrcamento.status = "A"; // 'A' de Aberto (novo orçamento)

  // b. Incrementar a Edição (Ano)
  let anoAtual = parseInt(orcamentoFechado.edicao);
  if (!isNaN(anoAtual) && anoAtual > 0) {
    novoOrcamento.edicao = (anoAtual + 1).toString();
    // Opcional: Atualizar a nomenclatura (ex: 'Evento 2025' -> 'Evento 2026')
    if (orcamentoFechado.nomenclatura) {
      novoOrcamento.nomenclatura = orcamentoFechado.nomenclatura.replace(
        anoAtual.toString(),
        novoOrcamento.edicao
      );
    }
  } else {
    Swal.fire(
      "Atenção",
      "Não foi possível determinar a Edição (Ano) para o próximo orçamento. Defina manualmente.",
      "warning"
    );
    // Mantém a edição original ou define como vazio
    novoOrcamento.edicao = "";
  }

  // c. Limpar Datas (Devem ser preenchidas manualmente)
  const camposDeData = [
    "dtinipremontagem",
    "dtfimpremontagem",
    "dtiniinframontagem",
    "dtfiminframontagem",
    "dtinimontagem",
    "dtfimmontagem",
    "dtinimarcacao",
    "dtfimmarcacao",
    "dtinirealizacao",
    "dtfimrealizacao",
    "dtinidesmontagem",
    "dtfiminfradesmontagem",
    "dtfiminfradesmontagem",
    "dtfiminfradesmontagem",
    "dtiniposmontagem",
    "dtfimposmontagem",
  ];
  camposDeData.forEach((campo) => {
    novoOrcamento[campo] = null;
  });

  atualizarFlatpickrParaProximoAno();

  // 4. Limpar Desconto/Acréscimo
  // (Bloco comentado mantido)

  // 5. Chamar a função de preenchimento com o novo objeto
  preencherFormularioComOrcamentoParaProximoAno(novoOrcamento);

  // 6. Alerta de sucesso e foco na edição
  Swal.fire({
    title: "Orçamento Espelhado!",
    html: `O novo orçamento foi criado com sucesso. **Edição: ${novoOrcamento.edicao}**. <br>Por favor, preencha as novas datas.`,
    icon: "success",
  });

  // 7. Foco no campo Edição (ou Datas, para guiar o usuário)
  const edicaoInput = document.getElementById("edicao");
  if (edicaoInput) edicaoInput.focus();
}

/**
 * Função adaptada para o espelhamento. É quase idêntica à original,
 * mas tem o papel de limpar os campos que não queremos preencher.
 */
async function preencherFormularioComOrcamentoParaProximoAno(orcamento) {
  console.log(
    "ENTROU EM PREENCHERFORMULARIOCOMORCAMENTOPARAPROXIMOANO",
    orcamento
  );
  // 1. CHAMA LIMPAR ORÇAMENTO (se existir)
  if (typeof limparOrcamento === "function") {
    limparOrcamento(); // Garante que todos os campos e a tabela estão limpos
  }

  // 2. Preenche os campos espelhados (usa a mesma lógica da sua função original)
  const idOrcamentoInput = document.getElementById("idOrcamento");
  if (idOrcamentoInput) {
    idOrcamentoInput.value = orcamento.idorcamento || "";
  } else {
    console.warn("Elemento com ID 'idOrcamento' não encontrado.");
  }

  const nrOrcamentoInput = document.getElementById("nrOrcamento");
  if (nrOrcamentoInput) {
    nrOrcamentoInput.value = orcamento.nrorcamento || "";
  } else {
    console.warn("Elemento com ID 'nrOrcamento' não encontrado.");
  }

  const nomenclaturaInput = document.getElementById("nomenclatura");
  if (nomenclaturaInput) {
    nomenclaturaInput.value = orcamento.nomenclatura || "";
  } else {
    console.warn("Elemento 'nomenclatura' não encontrado.");
  }

  const statusInputNovo = document.getElementById("Status");
  if (statusInputNovo) {
    statusInputNovo.value = orcamento.status || "";
    console.log("Status", statusInputNovo.value);

    if (statusInputNovo.value === "F") {
      bloquearCamposSeFechado();
    }
  } else {
    console.warn("Elemento com ID 'Status' não encontrado.");
  }

  const edicaoInput = document.getElementById("edicao");
  if (edicaoInput) {
    edicaoInput.value = orcamento.edicao || "";
    console.log("Edição", edicaoInput.value);
  } else {
    console.warn("Elemento com ID 'Edição' não encontrado.");
  }

  const clienteSelect = document.querySelector(".idCliente");
  if (clienteSelect) {
    clienteSelect.value = orcamento.idcliente || "";
  } else {
    console.warn("Elemento com classe '.idCliente' não encontrado.");
  }

  const eventoSelect = document.querySelector(".idEvento");
  if (eventoSelect) {
    eventoSelect.value = orcamento.idevento || "";
  } else {
    console.warn("Elemento com classe '.idEvento' não encontrado.");
  }

  const localMontagemSelect = document.querySelector(".idMontagem");
  if (localMontagemSelect) {
    localMontagemSelect.value = orcamento.idmontagem || "";
    const ufMontagemInput = document.getElementById("ufmontagem");
    if (ufMontagemInput) {
      ufMontagemInput.value = orcamento.ufmontagem || "";
    } else {
      console.warn("Elemento com ID 'ufmontagem' não encontrado.");
    }

    atualizarUFOrc(localMontagemSelect);

    if (orcamento.idmontagem) {
      await carregarPavilhaoOrc(orcamento.idmontagem);
    } else {
      await carregarPavilhaoOrc("");
    }
  } else {
    console.warn("Elemento com classe '.idMontagem' não encontrado.");
  }

  if (orcamento.pavilhoes && orcamento.pavilhoes.length > 0) {
    selectedPavilhoes = orcamento.pavilhoes.map((p) => ({
      id: p.id,
      name: p.nomepavilhao,
    }));
  } else {
    selectedPavilhoes = [];
  }

  updatePavilhaoDisplayInputs();

  for (const id in flatpickrInstances) {
    const pickerInstance = flatpickrInstances[id];
    if (
      pickerInstance &&
      typeof pickerInstance.setDate === "function" &&
      pickerInstance.config
    ) {
      let inicio = null;
      let fim = null;

      switch (id) {
        case "periodoPreEvento":
          inicio = orcamento.dtinipreevento;
          fim = orcamento.dtfimpreevento;
          break;
        case "periodoInfraMontagem":
          inicio = orcamento.dtiniinframontagem;
          fim = orcamento.dtfiminframontagem;
          break;
        case "periodoMontagem":
          inicio = orcamento.dtinimontagem;
          fim = orcamento.dtfimmontagem;
          break;
        case "periodoMarcacao":
          inicio = orcamento.dtinimarcacao;
          fim = orcamento.dtfimmarcacao;
          break;
        case "periodoRealizacao":
          inicio = orcamento.dtinirealizacao;
          fim = orcamento.dtfimrealizacao;
          break;
        case "periodoDesmontagem":
          inicio = orcamento.dtinidesmontagem;
          fim = orcamento.dtfimdesmontagem;
          break;
        case "periodoDesmontagemInfra":
          inicio = orcamento.dtiniinfradesmontagem;
          fim = orcamento.dtfiminfradesmontagem;
          break;
        case "periodoPosEvento":
          inicio = orcamento.dtiniposevento;
          fim = orcamento.dtfimposevento;
          break;
      }

      const startDate = inicio ? new Date(inicio) : null;
      const endDate = fim ? new Date(fim) : null;

      if (pickerInstance.config.mode === "range") {
        if (
          startDate &&
          endDate &&
          !isNaN(startDate.getTime()) &&
          !isNaN(endDate.getTime())
        ) {
          pickerInstance.setDate([startDate, endDate], true);
        } else if (startDate && !isNaN(startDate.getTime())) {
          pickerInstance.setDate(startDate, true);
        } else {
          pickerInstance.clear();
        }
      } else {
        if (startDate && !isNaN(startDate.getTime())) {
          pickerInstance.setDate(startDate, true);
        } else {
          pickerInstance.clear();
        }
      }
    } else {
      console.warn(
        `[preencherFormularioComOrcamento] Instância Flatpickr para ID '${id}' não encontrada ou inválida.`
      );
    }
  }

  const obsItensInput = document.getElementById("Observacao");
  if (obsItensInput) {
    obsItensInput.value = orcamento.obsitens || "";
  }

  const obsPropostaInput = document.getElementById("ObservacaoProposta");
  if (obsPropostaInput) {
    obsPropostaInput.value = orcamento.obsproposta || "";
  }

  const formaPagamentoInput = document.getElementById("formaPagamento");
  if (formaPagamentoInput) {
    formaPagamentoInput.value = orcamento.formapagamento || "";
  }

  const totalGeralVdaInput = document.getElementById("totalGeralVda");
  if (totalGeralVdaInput)
    totalGeralVdaInput.value = formatarMoeda(orcamento.totgeralvda || 0);

  const totalGeralCtoInput = document.getElementById("totalGeralCto");
  if (totalGeralCtoInput)
    totalGeralCtoInput.value = formatarMoeda(orcamento.totgeralcto || 0);

  const totalAjdCustoInput = document.getElementById("totalAjdCusto");
  if (totalAjdCustoInput)
    totalAjdCustoInput.value = formatarMoeda(orcamento.totajdcto || 0);

  const totalGeralInput = document.getElementById("totalGeral");
  if (totalGeralCtoInput && totalAjdCustoInput && totalGeralInput) {
    const valorGeralCto = desformatarMoeda(totalGeralCtoInput.value);
    const valorAjdCusto = desformatarMoeda(totalAjdCustoInput.value);
    totalGeralInput.value = formatarMoeda(valorGeralCto + valorAjdCusto);
  }

  const lucroInput = document.getElementById("Lucro");
  if (lucroInput) lucroInput.value = formatarMoeda(orcamento.lucrobruto || 0);

  const percentLucroInput = document.getElementById("percentLucro");
  if (percentLucroInput)
    percentLucroInput.value = formatarPercentual(orcamento.percentlucro || 0);

  const descontoInput = document.getElementById("Desconto");
  if (descontoInput) {
    descontoInput.value = parseFloat(orcamento.desconto || 0).toFixed(2);
  }

  const percentDescInput = document.getElementById("percentDesc");
  if (percentDescInput) {
    percentDescInput.value = formatarPercentual(
      parseFloat(orcamento.percentdesconto || 0)
    );
  }

  const acrescimoInput = document.getElementById("Acrescimo");
  if (acrescimoInput) {
    acrescimoInput.value = parseFloat(orcamento.acrescimo || 0).toFixed(2);
  }

  const percentAcrescInput = document.getElementById("percentAcresc");
  if (percentAcrescInput) {
    percentAcrescInput.value = formatarPercentual(
      parseFloat(orcamento.percentacrescimo || 0)
    );
  }

  const lucroRealInput = document.getElementById("lucroReal");
  if (lucroRealInput)
    lucroRealInput.value = formatarMoeda(orcamento.lucroreal || 0);

  const percentRealInput = document.getElementById("percentReal");
  if (percentRealInput)
    percentRealInput.value = formatarPercentual(
      orcamento.percentlucroreal || 0
    );

  const valorImpostoInput = document.getElementById("valorImposto");
  if (valorImpostoInput)
    valorImpostoInput.value = formatarMoeda(orcamento.vlrimposto || 0);

  const percentImpostoInput = document.getElementById("percentImposto");
  if (percentImpostoInput)
    percentImpostoInput.value = formatarPercentual(
      orcamento.percentimposto || 0
    );

  const valorCtoFixoInput = document.getElementById("valorCustoFixo");
  if (valorCtoFixoInput)
    valorCtoFixoInput.value = formatarMoeda(orcamento.vlrctofixo || 0);

  const percentCtoFixoInput = document.getElementById("percentCustoFixo");
  if (percentCtoFixoInput)
    percentCtoFixoInput.value = formatarPercentual(
      orcamento.percentctofixo || 0
    );

  const valorClienteInput = document.getElementById("valorCliente");
  if (valorClienteInput)
    valorClienteInput.value = formatarMoeda(orcamento.vlrcliente || 0);

  console.log("VALOR DO CLIENTE VINDO DO BANCO", orcamento.vlrcliente || 0);

  if (orcamento.itens && orcamento.itens.length > 0) {
    try {
      // Se for um orçamento 'Próximo Ano', tenta re-hidratar os valores canônicos
      if (bProximoAno) {
        await rehidrateItemsForNewYear(orcamento.itens);
      }
    } catch (err) {
      console.warn("[REHIDRATE] Falha ao re-hidratar itens no frontend:", err);
    }

    preencherItensOrcamentoTabela(orcamento.itens, true);
  } else {
    preencherItensOrcamentoTabela([]);
  }

  if (localMontagemSelect) {
    atualizarUFOrc(localMontagemSelect);
  }

  if (typeof desbloquearTodosOsCampos === "function") {
    desbloquearTodosOsCampos();
  } else {
    bloquearCamposSeFechado();
  }

  const statusInput = document.getElementById("Status");
  if (statusInput) statusInput.value = "A";

  function verificarLinhasPorPeriodo() {
    const anoAtual = new Date().getFullYear();
    const inputs = document.querySelectorAll(
      "tbody input.datas.datas-item.flatpickr-input"
    );

    inputs.forEach((input) => {
      const linha = input.closest("tr");
      if (!linha) return;

      const valor = input.value.trim();
      if (!valor) {
        linha.classList.remove("linha-vermelha");
        return;
      }

      const anos = (valor.match(/\b\d{4}\b/g) || []).map((a) =>
        parseInt(a, 10)
      );
      if (anos.length === 0) {
        linha.classList.remove("linha-vermelha");
        return;
      }

      const maiorAno = Math.max(...anos);
      if (maiorAno <= anoAtual) {
        linha.classList.add("linha-vermelha");
      } else {
        linha.classList.remove("linha-vermelha");
      }
    });
  }
  setTimeout(verificarLinhasPorPeriodo, 400);

  document.addEventListener("change", function (e) {
    if (e.target.classList.contains("flatpickr-input")) {
      verificarLinhasPorPeriodo();
    }
  });
}

function atualizarFlatpickrParaProximoAno() {
  // 1. OBTÉM DATA DE REFERÊNCIA
  const dataReferencia = anoProximoOrcamento
    ? `01/01/${anoProximoOrcamento}`
    : null;

  const idsInputsData = [
    "periodoPreEvento",
    "periodoInfraMontagem",
    "periodoMarcacao",
    "periodoMontagem",
    "periodoRealizacao",
    "periodoDesmontagem",
    "periodoDesmontagemInfra",
    "periodoPosEvento",
  ];

  // 2. DESTROI E LIMPA OS VALORES
  idsInputsData.forEach((id) => {
    const input = document.getElementById(id);
    if (input) {
      // Se houver uma instância Flatpickr antiga, DESTRÓI
      if (input._flatpickr) {
        input._flatpickr.destroy();
      }
      // LIMPA o valor do campo DOM explicitamente, garantindo que não há valor a ser copiado
      input.value = "";
    }
  });

  // 3. RECria o Flatpickr com a nova opção defaultDate
  const newOptions = {
    ...commonFlatpickrOptions,
    defaultDate: dataReferencia,
  };

  // Limpa o array de instâncias global para armazenar apenas as novas
  flatpickrInstancesOrcamento = [];

  idsInputsData.forEach((id) => {
    const input = document.getElementById(id);
    if (input) {
      flatpickrInstancesOrcamento.push(flatpickr(input, newOptions));
    }
  });

  // 4. ABRE O CALENDÁRIO para o usuário
  const inputMarcacao = document.getElementById("periodoMarcacao");
  // Verifica se a nova instância foi criada antes de tentar abrir
  if (inputMarcacao && inputMarcacao._flatpickr) {
    inputMarcacao._flatpickr.open();
  }
}

// OBTENHA OS DADOS DO ORÇAMENTO ATUAL:
// Você deve garantir que tem uma forma de buscar o objeto 'orcamento' que está na tela
function getOrcamentoAtualCarregado() {
  // Exemplo: se você armazena o orçamento em uma variável global
  // return window.orcamentoAtual || null;

  // Ou, se precisar buscar novamente no banco usando o idOrcamento da tela
  // const id = document.getElementById('idOrcamento').value;
  // return buscarDadosOrcamento(id); // Chamada AJAX / Promise

  // Por enquanto, use a variável global que armazena os dados
  return window.orcamentoAtual || null;
}

/**
 * Re-hidrata os itens do orçamento com os valores canônicos atuais
 * (VDA / CTO) para Função / Equipamento / Suprimento antes de exibir o
 * orçamento do 'Próximo Ano' no frontend. Isso melhora a experiência do
 * usuário mostrando já os valores atualizados mesmo antes de salvar.
 */
async function rehidrateItemsForNewYear(itens) {
  if (!itens || !Array.isArray(itens) || itens.length === 0) return;

  try {
    const [funcs, equips, suprs] = await Promise.all([
      fetchComToken('/orcamentos/funcao').then((r) => r),
      fetchComToken('/orcamentos/equipamentos').then((r) => r),
      fetchComToken('/orcamentos/suprimentos').then((r) => r),
    ]);

    const funcMap = (Array.isArray(funcs) ? funcs : []).reduce((acc, f) => {
      acc[String(f.idfuncao)] = f;
      return acc;
    }, {});

    // ... (manter eqMap e supMap iguais)

    for (const item of itens) {
      // 1. PRIORIDADE TOTAL: Se o item já tem um vlrbase (do orçamento anterior), 
      // esse deve ser o valor "mãe" para o novo reajuste.
      let vlrReferencia = parseFloat(item.vlrbase || item.vlrdiaria || 0);
      let ctoReferencia = parseFloat(item.ctodiaria || 0);

      // 2. Fallback: Se por algum motivo o item veio zerado, busca na tabela mestra
      if (vlrReferencia === 0) {
        if (item.idfuncao && funcMap[String(item.idfuncao)]) {
          vlrReferencia = parseFloat(funcMap[String(item.idfuncao)].vdafuncao) || 0;
          ctoReferencia = parseFloat(funcMap[String(item.idfuncao)].ctofuncaobase) || 0;
        }
        // ... (repetir lógica para equip e suprimento se necessário)
      }

      // 3. APLICAÇÃO DO REAJUSTE (O "8% + 8%")
      // Se bProximoAno está ativo, pegamos o valor que veio do banco (que já tinha os primeiros 8%)
      // e aplicamos o novo percentual em cima.
      if (typeof bProximoAno !== 'undefined' && bProximoAno) {
        const fatorGeral = 1 + (GLOBAL_PERCENTUAL_GERAL / 100);
        const fatorAjuda = 1 + (GLOBAL_PERCENTUAL_AJUDA / 100);

        // Aplica reajuste sobre o valor que já era reajustado (Efeito Composto)
        vlrReferencia = vlrReferencia * fatorGeral;
        ctoReferencia = ctoReferencia * fatorGeral;

        if (item.vlrajdctoalimentacao) {
            item.vlrajdctoalimentacao = parseFloat(item.vlrajdctoalimentacao) * fatorAjuda;
        }
        if (item.vlrajdctotransporte) {
            item.vlrajdctotransporte = parseFloat(item.vlrajdctotransporte) * fatorAjuda;
        }
      }

      // 4. ATUALIZAÇÃO DOS CAMPOS DO ITEM
      item.vlrbase = vlrReferencia; // O novo valor base agora é o valor composto
      item.vlrdiaria = vlrReferencia;
      item.ctodiaria = ctoReferencia;

      const qtdItens = parseFloat(item.qtditens || item.quantidade || 0);
      const qtdDias = parseFloat(item.qtddias || 0);
      const descontoItem = parseFloat(item.descontoitem || item.desconto || 0);
      const acrescimoItem = parseFloat(item.acrescimoitem || item.acrescimo || 0);

      // Recálculo final da linha
      item.totvdadiaria = Math.round((vlrReferencia * qtdItens * qtdDias + acrescimoItem - descontoItem) * 100) / 100;
      item.totctodiaria = Math.round((ctoReferencia * qtdItens * qtdDias) * 100) / 100;
      
      const vlrAlim = parseFloat(item.vlrajdctoalimentacao || 0);
      const vlrTransp = parseFloat(item.vlrajdctotransporte || 0);
      item.totajdctoitem = Math.round((vlrAlim + vlrTransp) * qtdItens * qtdDias * 100) / 100;
      item.totgeralitem = Math.round((item.totctodiaria + item.totajdctoitem) * 100) / 100;
    }
  } catch (err) {
    console.warn('[REHIDRATE] Erro no cálculo composto:', err);
  }
}

async function PropostaouContrato() {
    let orcamentoValue = nrOrcamento;

    // 🛑 CORREÇÃO OBRIGATÓRIA: Verifica e extrai o valor se a variável for um objeto HTML
    if (
        typeof orcamentoValue === "object" &&
        orcamentoValue !== null &&
        orcamentoValue.value !== undefined
    ) {
        // [LOG REMOVIDO] console.log("[CORREÇÃO DEBUG] Variável nrOrcamento detectada como objeto HTML. Extraindo .value...");
        orcamentoValue = orcamentoValue.value;
    }

    // Garante que o valor final é uma string limpa
    const nrOrcamentoStr = String(orcamentoValue).trim();

    if (!nrOrcamentoStr || nrOrcamentoStr.length === 0) {
        Swal.fire(
            "Erro",
            "Número do Orçamento inválido ou não encontrado.",
            "error"
        );
        return;
    }

    try {
        const fetchOrcamentoUrl = `/orcamentos?nrOrcamento=${nrOrcamentoStr}`;

        const orcamentoData = await fetchComToken(fetchOrcamentoUrl, {
            method: "GET",
        });

  
        const orcamento = orcamentoData || null;



        if (!orcamento) {
            Swal.fire("Erro", "Orçamento não encontrado para verificação.", "error");
            return;
        }

        const contratoExistenteUrl = orcamento.contratourl;




        if (contratoExistenteUrl && contratoExistenteUrl.trim() !== "") {


            const filename = contratoExistenteUrl.substring(
                contratoExistenteUrl.lastIndexOf("/") + 1
            );

            Swal.fire({
                title: "Contrato Vinculado!",
                html: `Já existe um contrato (${filename}) vinculado ao orçamento <b>${nrOrcamentoStr}</b>.`,
                icon: "warning",
                showCancelButton: true,
                denyButtonText: "Gerar Proposta", 
                cancelButtonText: "Fechar",
                confirmButtonText: "Visualizar Contrato",
                reverseButtons: true,
            }).then((res) => {

                if (res.isConfirmed) {
                    window.open(contratoExistenteUrl, "_blank");
                }

                else if (res.isDenied) {

                    gerarPropostaPDF(); 
                }
            });

            return; 
        }
    } catch (error) {
        console.error(
            "[PROPOSTA/CONTRATO] ERRO durante a verificação inicial. Prosseguindo para o seletor.",
            error
        ); 
    }

    Swal.fire({
        title: "Selecione a ação com o documento",
        text: "Escolha qual ação deseja realizar para este orçamento.",
        icon: "question",
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: "Gerar Proposta",
        cancelButtonText: "Gerar Contrato",
        denyButtonText: "Incluir Contrato",
        reverseButtons: false,
        customClass: {
            confirmButton: "Proposta",
            cancelButton: "Contrato",
            denyButton: "IncluirContrato",
        },
    }).then((result) => {
        if (result.isConfirmed) {
            // Clicou no botão CONFIRM (Gerar Proposta)
            // [LOG REMOVIDO] console.log("[FLUXO SELETOR] Ação selecionada: Gerar Proposta.");
            gerarPropostaPDF();
        } else if (result.dismiss === Swal.DismissReason.cancel) {
            // Clicou no botão CANCEL (Gerar Contrato)
            // [LOG REMOVIDO] console.log("[FLUXO SELETOR] Ação selecionada: Gerar Contrato.");
            gerarContrato(nrOrcamentoStr);
        } else if (result.isDenied) {
            // Clicou no botão DENY (Incluir Contrato)
            /* * 🚨 PONTO DE ATENÇÃO (Conversão de Upload): 
             * A função 'incluirContrato' deve ser responsável por:
             * 1. Solicitar o upload do arquivo ao usuário.
             * 2. Enviar o arquivo para o servidor (Node.js/Backend).
             * 3. O BACKEND DEVE VERIFICAR A EXTENSÃO DO ARQUIVO UPLOADADO (ex: .docx) 
             * E CONVERTÊ-LO PARA .PDF antes de salvar o arquivo final e sua URL no DB.
             * * A conversão não pode ser feita diretamente aqui no frontend.
             */
            // [LOG REMOVIDO] console.log("[FLUXO SELETOR] Ação selecionada: Incluir Contrato. Chamando incluirContrato(nrOrcamento)...");
            incluirContrato(nrOrcamentoStr);
        }
    });
}

document.getElementById("Contrato").addEventListener("click", function (event) {
  event.preventDefault();
  PropostaouContrato();
});

document.getElementById("Proposta").addEventListener("click", function (event) {
  event.preventDefault();
  gerarPropostaPDF();
});

/**
 * Gerencia o texto e a visibilidade dos botões de Proposta, Aprovação e Reprovação 
 * com base no status atual do orçamento.
 * @param {string} status - O status atual do orçamento (ex: 'P', 'A', 'R', 'E', 'F').
 */
function gerenciarBotoesProposta(status) {
    const btnProposta = document.getElementById('Proposta');
    const btnAprovar = document.getElementById('AprovarProposta');
    const btnReprovar = document.getElementById('ReprovarProposta');
    const btnFecharOrc = document.getElementById('fecharOrc');
    //const status = document.getElementById('Status');
    
    if (!btnProposta) return; 

    const statusFinalizado = ['A', 'R', 'E', 'F'];

    let statusValue = '';
    
    if (typeof status === 'string') {
        statusValue = status;
    } else if (status && status.tagName) {
        // É um elemento HTML (INPUT, SELECT, etc.)
        if (status.tagName === 'INPUT' || status.tagName === 'SELECT') {
            statusValue = status.value;
        } else {
            statusValue = status.innerText;
        }
    }
    
    // Garante que o valor final seja tratado corretamente
    const statusLimpo = String(statusValue || '').trim().toUpperCase();
    console.log("STATUS LIMPO", statusLimpo);

    // 1. Lógica do botão Gerar Proposta
    if ((statusLimpo === 'P') || (statusLimpo === 'E')){
        console.log("STATUS LIMPO DENTRO DO IF", statusLimpo);
        // Status P (Proposta): Permite gerar uma nova.
        btnProposta.textContent = 'Gerar Nova Proposta';
    } else {
        // Qualquer outro status: Volta ao padrão.
        btnProposta.textContent = 'Gerar Proposta';
    }

    // 2. Lógica dos botões Aprovar/Reprovar
    if (statusFinalizado.includes(statusLimpo)) {
        // Ocultar se o status for Aprovado (A), Reprovado (R), Em Fechamento (E) ou Fechado (F).
        if (btnAprovar) btnAprovar.style.display = 'none';
        if (btnReprovar) btnReprovar.style.display = 'none';
    } else {
        // Mostrar em todos os outros status (incluindo P e status intermediários).
        if (btnAprovar) btnAprovar.style.display = 'inline-block';
        if (btnReprovar) btnReprovar.style.display = 'inline-block';
    }

    // 3. Lógica do botão Fechar Orçamento
    if (statusLimpo === 'E') {
        if (btnFecharOrc) btnFecharOrc.style.display = 'inline-block';
    } else {
        if (btnFecharOrc) btnFecharOrc.style.display = 'none';
    }
}

// async function gerarPropostaPDF() {
//     // 1. Pegar IDs básicos do formulário (seu código original)
//     let nrOrcamentoElem = document.getElementById("nrOrcamento");
//     let nrOrcamento = nrOrcamentoElem?.value?.trim() || nrOrcamentoElem?.innerText?.trim() || "";

//     if (!nrOrcamento) {
//         return Swal.fire("Erro!", "Número do orçamento não encontrado!", "error");
//     }

//     try {
//         // 2. BUSCAR TEXTOS DO BANCO DE DADOS
//         // Você precisará de uma rota que retorne os 12 textos (id, titulo, conteudo)
//         const responseTextos = await fetchComToken('/configuracoes/textos-proposta');
//         const textosDisponiveis = responseTextos.data; // Array de objetos

//         // 3. MONTAR O HTML DOS CHECKBOXES
//         let htmlCheckboxes = `<div style="text-align: left; max-height: 300px; overflow-y: auto; padding: 10px;">
//             <p class="mb-3 text-sm text-gray-600">Selecione as cláusulas que deseja incluir nesta proposta:</p>`;
//         textosDisponiveis.forEach(t => {
//             htmlCheckboxes += `
//                 <div style="margin-bottom: 8px; display: flex; align-items: center; gap: 10px;">
//                     <input type="checkbox" id="texto_${t.id}" value="${t.id}" class="swal2-checkbox-custom" checked style="margin:0;">
//                     <label for="texto_${t.id}" style="cursor:pointer; font-size: 14px;">${t.titulo}</label>
//                 </div>`;
//         });
//         htmlCheckboxes += `</div>`;

//         // 4. ABRIR SWAL PARA SELEÇÃO
//         const { value: formValues, isConfirmed } = await Swal.fire({
//             title: 'Configurar Cláusulas',
//             html: htmlCheckboxes,
//             focusConfirm: false,
//             showCancelButton: true,
//             confirmButtonText: 'Gerar PDF <i class="fas fa-file-pdf"></i>',
//             cancelButtonText: 'Cancelar',
//             preConfirm: () => {
//                 const selecionados = [];
//                 textosDisponiveis.forEach(t => {
//                     if (document.getElementById(`texto_${t.id}`).checked) {
//                         selecionados.push(t.id);
//                     }
//                 });
//                 return selecionados;
//             }
//         });

//         if (!isConfirmed) return;

//         // 5. SEGUIR COM A GERAÇÃO ENVIANDO OS TEXTOS SELECIONADOS
//         Swal.fire({
//             title: "Gerando Proposta...",
//             html: `<div id="page"><div id="container"><div id="ring"></div><div id="ring"></div><div id="ring"></div><div id="ring"></div><div id="ring"></div><div id="ring"></div><div id="h1">JA</div></div></div>`,
//             allowOutsideClick: false,
//             showConfirmButton: false,
//         });

//         const result = await fetchComToken(`/orcamentos/${nrOrcamento}/proposta`, {
//             method: "POST", // Mudamos para POST para enviar o corpo
//             headers: { "Content-Type": "application/json" },
//             body: JSON.stringify({ textosIds: formValues }) // Enviamos os IDs dos textos selecionados
//         });

//         // ... resto do seu código de download e atualização de status ...
//         Swal.close();
//         if (result.success) {
//             // Lógica de download que você já possui
//         }

//     } catch (err) {
//         console.error(err);
//         Swal.fire("Erro", "Falha ao processar textos da proposta.", "error");
//     }
// }

async function gerarPropostaPDF() {
  let nrOrcamentoElem = document.getElementById("nrOrcamento");
  let nrOrcamento = "";

  if (nrOrcamentoElem) {
    nrOrcamento =
      nrOrcamentoElem.tagName === "INPUT"
        ? nrOrcamentoElem.value.trim()
        : nrOrcamentoElem.innerText.trim();
  }

    let idOrcamentoElem = document.getElementById('idOrcamento');   
    let idOrcamento = "";

    if (idOrcamentoElem) {
        idOrcamento = idOrcamentoElem.tagName === "INPUT"
            ? idOrcamentoElem.value.trim()
            : idOrcamentoElem.innerText.trim();
    } 

  if (!nrOrcamento) {
    Swal.fire({
      icon: "error",
      title: "Erro!",
      text: "Número do orçamento não encontrado!",
      confirmButtonText: "Fechar",
    });
    console.warn("Número do orçamento não encontrado!");
    return;
  }

  try {
    console.log("🔍 Iniciando requisição para gerar a proposta...");

    Swal.fire({
      title: "Gerando Proposta...",
      html: `<div id="page"><div id="container"><div id="ring"></div><div id="ring"></div><div id="ring"></div><div id="ring"></div><div id="ring"></div><div id="ring"></div><div id="h1">JA</div></div></div><p class="text-gray-500 text-sm mt-2">Aguarde enquanto a proposta é gerada.</p>`,
      allowOutsideClick: false,
      showConfirmButton: false,
    });

    const result = await fetchComToken(`/orcamentos/${nrOrcamento}/proposta`, {
      method: "GET",
    });

    Swal.close();

    if (result.success) {
      console.log("✅ Proposta gerada com sucesso!");
      console.log("🔄 Tentando atualizar o status do orçamento para 'P'...");
      if (!idOrcamento) {
          console.warn("⚠️ Falha ao atualizar o status: ID do Orçamento não encontrado no HTML!");
          // Não interrompe, mas avisa que o status não será atualizado.
      } else {
          console.log("🔄 Tentando atualizar o status do orçamento para 'P'...");

          // USA O ID OBTIDO DO HTML
          const statusUpdateResult = await fetchComToken(`/orcamentos/${idOrcamento}/status`, {
              method: "PATCH", // Ou 'PUT', dependendo da sua API
              headers: {
                  "Content-Type": "application/json",
              },
              body: JSON.stringify({
                  status: "P" 
              })
          });

          if (statusUpdateResult.success) {
              console.log("✅ Status do orçamento atualizado para 'P' com sucesso!", nrOrcamento);
              
              try {
                  const url = `orcamentos?nrOrcamento=${nrOrcamento}`;

                  const orcamento = await fetchComToken(url, { method: 'GET' });
                  preencherFormularioComOrcamento(orcamento);

              } catch (error) {
                  console.error("Erro ao buscar orçamento:", error);

                  let errorMessage = error.message;
                  if (error.message.includes("404")) {
                      errorMessage = `Orçamento com o número ${nrOrcamento} não encontrado.`;
                      limparOrcamento();
                  } else if (error.message.includes("400")) {
                      errorMessage = "Número do orçamento é inválido ou vazio.";
                      limparOrcamento();
                  } else {
                      errorMessage = `Erro ao carregar orçamento: ${error.message}`;
                      limparOrcamento();
                  }

                  Swal.fire("Erro!", errorMessage, "error");
              }
              //gerenciarBotoesProposta('P'); 
                              
          } else {
              console.warn("⚠️ Falha ao atualizar o status do orçamento para 'P':", statusUpdateResult.message);
              // Você pode decidir se isso deve interromper o fluxo ou apenas mostrar um aviso.
          }
      }
      Swal.fire({
        icon: "success",
        title: "Proposta gerada!",
        text: "A proposta foi gerada com sucesso.",
        showCancelButton: true,
        confirmButtonText: "📥 Baixar Proposta",
        cancelButtonText: "OK",
        reverseButtons: true,
      }).then((res) => {
        if (res.isConfirmed) {
          (async () => {
            try {
              const fileUrl = result.fileUrl;
              const fileName = decodeURIComponent(fileUrl.split("/").pop());

              const response = await fetch(fileUrl, {
                headers: {
                  Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
              });

              if (!response.ok) throw new Error("Erro ao baixar o arquivo");

              const blob = await response.blob();
              const link = document.createElement("a");
              link.href = window.URL.createObjectURL(blob);
              link.download = fileName;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            } catch (err) {
              console.error("❌ Erro no download:", err);
              Swal.fire("Erro", "Não foi possível baixar o arquivo", "error");
            }
          })();
        }
      });
    } else {
      throw new Error(
        result.message || "Ocorreu um erro desconhecido ao gerar a proposta."
      );
    }
  } catch (err) {
    console.error("❌ Erro ao gerar proposta:", err);

    Swal.close();

    Swal.fire({
      icon: "error",
      title: "Erro!",
      text: `Ocorreu um erro ao gerar a proposta: ${err.message}`,
      confirmButtonText: "Fechar",
    });
  }
}

async function gerarContrato() {
  let nrOrcamentoElem = document.getElementById("nrOrcamento");
  let nrOrcamento = "";

  if (nrOrcamentoElem) {
    if (nrOrcamentoElem.tagName === "INPUT") {
      nrOrcamento = nrOrcamentoElem.value.trim();
    } else {
      nrOrcamento = nrOrcamentoElem.innerText.trim();
    }
  }
  let idOrcamentoElem = document.getElementById('idOrcamento'); 
    let idOrcamento = "";
    
    if (idOrcamentoElem) {
        idOrcamento = idOrcamentoElem.tagName === "INPUT"
            ? idOrcamentoElem.value.trim()
            : idOrcamentoElem.innerText.trim();
    }

  if (!nrOrcamento) {
    Swal.fire({
      icon: "error",
      title: "Erro!",
      text: "Número do orçamento não encontrado!",
      confirmButtonText: "Fechar",
    });
    console.warn("Número do orçamento não encontrado!");
    return;
  }

  try {
    console.log("🔍 Iniciando requisição para gerar o contrato...");

    // Exibe o loading
    Swal.fire({
      title: "Gerando Contrato...",
      html: `
                <div id="page">
                    <div id="container">
                        <div id="ring"></div>
                        <div id="ring"></div>
                        <div id="ring"></div>
                        <div id="ring"></div>
                        <div id="ring"></div>
                        <div id="ring"></div>
                        <div id="h1">JA</div>
                    </div>
                </div>
                <p class="text-gray-500 text-sm mt-2">Aguarde enquanto o contrato é gerado.</p>
            `,
      allowOutsideClick: false,
      showConfirmButton: false,
    });

    // Faz a requisição para gerar o contrato
    const result = await fetchComToken(`/orcamentos/${nrOrcamento}/contrato`, {
      method: "GET",
    });

    Swal.close();

    if (result.success) {
      console.log("✅ Contrato pronto para download!");

      Swal.fire({
        icon: "success",
        title: "Contrato gerado!",
        text: "O contrato foi gerado com sucesso.",
        showCancelButton: true,
        confirmButtonText: "📥 Baixar Contrato",
        cancelButtonText: "OK",
        reverseButtons: true,
      }).then(async (res) => {
        if (res.isConfirmed) {
          try {
            const fileName =
              result.fileName ||
              decodeURIComponent(result.fileUrl.split("/").pop());
            const fileUrl = `/uploads/contratos/${encodeURIComponent(
              fileName
            )}`;
            const token = localStorage.getItem("token");

            const response = await fetch(fileUrl, {
              method: "GET",
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });

            if (!response.ok)
              throw new Error("Não autorizado ou arquivo não encontrado");

            const blob = await response.blob();

            // Cria link temporário invisível para download
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);

            console.log("📥 Download iniciado:", fileName);
          } catch (downloadErr) {
            console.error("❌ Erro no download do contrato:", downloadErr);
            Swal.fire("Erro", "Não foi possível baixar o contrato", "error");
          }
        }
      });
    } else {
      throw new Error(
        result.message || "Ocorreu um erro desconhecido ao gerar o contrato."
      );
    }
  } catch (err) {
    console.error("❌ Erro ao gerar contrato:", err);
    Swal.fire({
      icon: "error",
      title: "Erro!",
      text: `Ocorreu um erro ao gerar o contrato: ${err.message}`,
      confirmButtonText: "Fechar",
    });
  }
}

document.getElementById('AprovarProposta')?.addEventListener('click', function(event) {
        event.preventDefault();
        aprovarProposta();
});

/**
 * Tenta atualizar o status do orçamento para 'E' (Em Fechamento) após aprovação.
 */
async function aprovarProposta() {
    // Busca o ID do Orçamento no elemento com ID 'idOrcamento'

    let nrOrcamentoElem = document.getElementById('nrOrcamento');
    let nrOrcamento = "";

    if (nrOrcamentoElem) {
        if (nrOrcamentoElem.tagName === "INPUT") {
            nrOrcamento = nrOrcamentoElem.value.trim();
        } else {
            nrOrcamento = nrOrcamentoElem.innerText.trim();
        }
    }

    let idOrcamentoElem = document.getElementById('idOrcamento'); 
    let idOrcamento = "";

    if (idOrcamentoElem) {
        idOrcamento = idOrcamentoElem.tagName === "INPUT"
            ? idOrcamentoElem.value.trim()
            : idOrcamentoElem.innerText.trim();
    } 

    if (!idOrcamento) {
        Swal.fire({
            icon: "error",
            title: "Erro!",
            text: "ID do Orçamento não encontrado. Não é possível aprovar.",
            confirmButtonText: "Fechar"
        });
        console.warn("ID do orçamento não encontrado!");
        return;
    }

    try {
        console.log("🔍 Iniciando requisição para Aprovar Proposta (Status 'E')...");

        const statusUpdateResult = await fetchComToken(`/orcamentos/${idOrcamento}/status`, {
            method: "PATCH", 
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                status: "E" // Status: Em Fechamento
            })
        });

        if (statusUpdateResult.success) {
            console.log("✅ Status do orçamento atualizado para 'E' com sucesso!");
            
            try {
                const url = `orcamentos?nrOrcamento=${nrOrcamento}`;

                const orcamento = await fetchComToken(url, { method: 'GET' });
                preencherFormularioComOrcamento(orcamento);

            } catch (error) {
                console.error("Erro ao buscar orçamento:", error);

                let errorMessage = error.message;
                if (error.message.includes("404")) {
                    errorMessage = `Orçamento com o número ${nrOrcamento} não encontrado.`;
                    limparOrcamento();
                } else if (error.message.includes("400")) {
                    errorMessage = "Número do orçamento é inválido ou vazio.";
                    limparOrcamento();
                } else {
                    errorMessage = `Erro ao carregar orçamento: ${error.message}`;
                    limparOrcamento();
                }

                Swal.fire("Erro!", errorMessage, "error");
            }

            Swal.fire({
                icon: "success",
                title: "Proposta Aprovada!",
                text: "O status do orçamento foi alterado para 'Em Fechamento'.",
                confirmButtonText: "OK",
            });
        } else {
            throw new Error(statusUpdateResult.message || "Falha ao atualizar o status para 'E'.");
        }

    } catch (err) {
        console.error("❌ Erro ao Aprovar Proposta:", err);
        Swal.fire({
            icon: "error",
            title: "Erro!",
            text: `Ocorreu um erro ao aprovar a proposta: ${err.message}`,
            confirmButtonText: "Fechar"
        });
    }
}

// 🔴 Evento para o botão Reprovar Proposta
document.getElementById('ReprovarProposta')?.addEventListener('click', function(event) {
    event.preventDefault();
    reprovarProposta();
});

/**
 * Tenta atualizar o status do orçamento para 'R' (Reprovado) após reprovação.
 */
async function reprovarProposta() {
    // Busca o ID do Orçamento no elemento com ID 'idOrcamento'

    let nrOrcamentoElem = document.getElementById('nrOrcamento');
    let nrOrcamento = "";

    if (nrOrcamentoElem) {
        if (nrOrcamentoElem.tagName === "INPUT") {
            nrOrcamento = nrOrcamentoElem.value.trim();
        } else {
            nrOrcamento = nrOrcamentoElem.innerText.trim();
        }
    }
    
    let idOrcamentoElem = document.getElementById('idOrcamento'); 
    let idOrcamento = "";

    if (idOrcamentoElem) {
        idOrcamento = idOrcamentoElem.tagName === "INPUT"
            ? idOrcamentoElem.value.trim()
            : idOrcamentoElem.innerText.trim();
    } 

    if (!idOrcamento) {
        Swal.fire({
            icon: "error",
            title: "Erro!",
            text: "ID do Orçamento não encontrado. Não é possível reprovar.",
            confirmButtonText: "Fechar"
        });
        console.warn("ID do orçamento não encontrado!");
        return;
    }

    try {
        console.log("🔍 Iniciando requisição para Reprovar Proposta (Status 'R')...");

        const statusUpdateResult = await fetchComToken(`/orcamentos/${idOrcamento}/status`, {
            method: "PATCH", 
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                status: "R" // Status: Reprovado
            })
        });

        if (statusUpdateResult.success) {
            console.log("✅ Status do orçamento atualizado para 'R' com sucesso!");
            
            try {
                const url = `orcamentos?nrOrcamento=${nrOrcamento}`;

                const orcamento = await fetchComToken(url, { method: 'GET' });
                preencherFormularioComOrcamento(orcamento);

            } catch (error) {
                console.error("Erro ao buscar orçamento:", error);

                let errorMessage = error.message;
                if (error.message.includes("404")) {
                    errorMessage = `Orçamento com o número ${nrOrcamento} não encontrado.`;
                    limparOrcamento();
                } else if (error.message.includes("400")) {
                    errorMessage = "Número do orçamento é inválido ou vazio.";
                    limparOrcamento();
                } else {
                    errorMessage = `Erro ao carregar orçamento: ${error.message}`;
                    limparOrcamento();
                }

                Swal.fire("Erro!", errorMessage, "error");
            }

            Swal.fire({
                icon: "success",
                title: "Proposta Reprovada!",
                text: "O status do orçamento foi alterado para 'Reprovado'.",
                confirmButtonText: "OK",
            });
        } else {
            throw new Error(statusUpdateResult.message || "Falha ao atualizar o status para 'R'.");
        }

    } catch (err) {
        console.error("❌ Erro ao Reprovar Proposta:", err);
        Swal.fire({
            icon: "error",
            title: "Erro!",
            text: `Ocorreu um erro ao reprovar a proposta: ${err.message}`,
            confirmButtonText: "Fechar"
        });
    }
}

/**
 * Abre um SweetAlert2 com campo de upload para incluir o arquivo do contrato.
 * Se já houver contrato vinculado, mostra a opção de visualizá-lo.
 * @param {string|object} nrOrcamento - O número do orçamento para vincular o contrato.
 */
async function incluirContrato(nrOrcamento) {
  if (typeof nrOrcamento === "object" && nrOrcamento?.value !== undefined) {
    nrOrcamento = nrOrcamento.value;
  }

  nrOrcamento = String(nrOrcamento);
  const uploadUrl = `/orcamentos/uploadContratoManual?orcamento=${nrOrcamento}`;

  // 🔑 CONSOLE 1: Início da função e valor do orçamento
  console.log(
    `[FRONTEND DEBUG] 1. Início de incluirContrato para Orçamento: ${nrOrcamento}`
  );

  // 2. LÓGICA DE UPLOAD
  const { value: uploadResult } = await Swal.fire({
    title: `Incluir Contrato para Orçamento ${nrOrcamento}`,

    html: `
            <p style="margin-bottom: 15px;">Selecione o arquivo do contrato (PDF ou Word). Máx: 10MB.</p>

            <input id="file" type="file" name="contrato" accept=".pdf, .doc, .docx" required style="display: none;"> 

            <div class="container">

                <label for="file" class="header" id="uploadHeader" style="cursor: pointer;"> 
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M7 10V9C7 6.23858 9.23858 4 12 4C14.7614 4 17 6.23858 17 9V10C19.2091 10 21 11.7909 21 14C21 15.4806 20.1956 16.8084 19 17.5M7 10C4.79086 10 3 11.7909 3 14C3 15.4806 3.8044 16.8084 5 17.5M7 10C7.43285 10 7.84965 10.0688 8.24006 10.1959M12 12V21M12 12L15 15M12 12L9 15" stroke="#000000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <p>Clique para upload!</p>
                </label><label for="file" class="footer" style="cursor: pointer;">
                <svg fill="#000000" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                        <path d="M15.331 6H8.5v20h15V14.154h-8.169z"/>
                        <path d="M18.153 6h-.009v5.342H23.5v-.002z"/>
                    </svg>
                    <p id="fileName">Nenhum arquivo selecionado</p>
                </label>
            </div>`,

    // 🛑 Gerenciamento de Foco e Listener de Mudança de Arquivo (didOpen)
    didOpen: (popup) => {
      const inputFile = popup.querySelector("#file");
      const fileNameDisplay = popup.querySelector("#fileName");
      const uploadHeader = popup.querySelector("#uploadHeader");
      const label = popup.querySelector(".upload-area-wrapper");

      if (inputFile) {
        inputFile.addEventListener("change", function () {
          if (this.files.length > 0) {
            fileNameDisplay.textContent = this.files[0].name;
            label.style.borderColor = "#28a745"; // Cor de sucesso
            uploadHeader.style.color = "#28a745";
          } else {
            fileNameDisplay.textContent = "Nenhum arquivo selecionado";
            label.style.borderColor = "#007bff";
            uploadHeader.style.color = "#007bff";
          }
        });
      }
    },

    icon: "info",
    showCancelButton: true,
    confirmButtonText: "Fazer Upload e Salvar",
    cancelButtonText: "Cancelar",
    focusConfirm: false,
    allowOutsideClick: false,
    allowEscapeKey: false,
    backdrop: false,
    showLoaderOnConfirm: true,

    preConfirm: () => {
      const inputFile = document.getElementById("file");
      const file = inputFile.files[0];

      if (!file) {
        Swal.showValidationMessage("Por favor, selecione um arquivo.");
        return false;
      }

      const formData = new FormData();
      formData.append("contrato", file);
      // 🔑 CONSOLE 8: Antes de fazer a requisição POST de upload
      console.log(
        `[FRONTEND DEBUG] 8. Iniciando upload POST para: ${uploadUrl} com arquivo: ${file.name}`
      );

      return fetchComToken(uploadUrl, { method: "POST", body: formData })
        .then((data) => {
          // 🔑 CONSOLE 9: Upload POST bem-sucedido
          console.log(
            `[FRONTEND DEBUG] 9. Upload POST SUCESSO. Resposta do Backend:`,
            data
          );
          if (!data.success)
            throw new Error(data.message || "Falha no upload.");
          return data;
        })

        .catch((error) => {
          // 🔑 CONSOLE 10: Upload POST com falha
          console.error(
            `[FRONTEND DEBUG] 10. Upload POST FALHA. Mensagem:`,
            error.message || error
          );
          Swal.showValidationMessage(error.message || "Falha no upload.");
          return false;
        });
    },
  });

  if (!uploadResult) {
    // 🔑 CONSOLE 11: Upload cancelado ou falhou no preConfirm
    console.log(
      "[FRONTEND DEBUG] 11. Upload cancelado ou bloqueado por validação."
    );
    return;
  }

  // 3. MENSAGEM FINAL DE SUCESSO
  const uploadedFileName = uploadResult.fileName;
  const finalFileUrl = uploadResult.contratourl;

  // 🔑 CONSOLE 12: URL Final para Visualização
  console.log(
    `[FRONTEND DEBUG] 12. Finalizado. URL para visualização: ${finalFileUrl}`
  );

  Swal.fire({
    title: "Contrato Vinculado!",
    html: `O arquivo <b>${uploadedFileName}</b> foi salvo e vinculado ao orçamento <b>${nrOrcamento}</b>.`,
    icon: "success",
    showCancelButton: true,
    confirmButtonText: "Visualizar Contrato",
    cancelButtonText: "Fechar",
    reverseButtons: true,
  }).then((res) => {
    if (res.isConfirmed) {
      window.open(finalFileUrl, "_blank");
    }
  });
}

function exportarParaExcel() {
  const linhas = document.querySelectorAll("#tabela tbody tr");
  const dados = [];

  // Cabeçalhos
  const cabecalhos = [
    "P/ Proposta",
    "Categoria",
    "Qtd Itens",
    "Produto",
    "Setor",
    "Qtd Dias",
    "Período das diárias",
    "Desconto",
    "Acréscimo",
    "Vlr Diária",
    "Tot Venda Diária",
    "Cto Diária",
    "Tot Custo Diária",
    "AjdCusto Alimentação",
    "AjdCusto Transporte",
    "Tot AjdCusto",
    "Hospedagem",
    "Transporte",
    "Tot Geral",
  ];
  dados.push(cabecalhos);

  // Linhas da tabela
  linhas.forEach((tr) => {
    const linha = [];

    linha.push(
      tr.querySelector('input[type="checkbox"]')?.checked ? "Sim" : "Não"
    );
    linha.push(tr.querySelector(".Categoria")?.innerText.trim() || "");
    linha.push(tr.querySelector(".qtdProduto input")?.value || "0");
    linha.push(tr.querySelector(".produto")?.innerText.trim() || "");
    linha.push(tr.querySelector(".setor")?.innerText.trim() || "");
    linha.push(tr.querySelector(".qtdDias input")?.value || "0");
    linha.push(tr.querySelector(".datas")?.value || "");

    const descontoValor =
      tr.querySelector(".descontoItem .ValorInteiros")?.value || "R$ 0,00";
    const descontoPerc =
      tr.querySelector(".descontoItem .valorPerCent")?.value || "0%";
    linha.push(`${descontoValor} (${descontoPerc})`);

    const acrescValor =
      tr.querySelector(".acrescimoItem .ValorInteiros")?.value || "R$ 0,00";
    const acrescPerc =
      tr.querySelector(".acrescimoItem .valorPerCent")?.value || "0%";
    linha.push(`${acrescValor} (${acrescPerc})`);

    linha.push(tr.querySelector(".vlrVenda")?.innerText.trim() || "");
    linha.push(tr.querySelector(".totVdaDiaria")?.innerText.trim() || "");
    linha.push(tr.querySelector(".vlrCusto")?.innerText.trim() || "");
    linha.push(tr.querySelector(".totCtoDiaria")?.innerText.trim() || "");

    // const selectAlim = tr.querySelectorAll(".ajdCusto select")[0];
    // linha.push(selectAlim?.value || "");

    // const selectTrans = tr.querySelectorAll(".ajdCusto select")[1];
    // linha.push(selectTrans?.value || "");

    linha.push(
      tr.querySelector(".ajdCusto.alimentacao")?.innerText.trim() || ""
    );
    linha.push(
      tr.querySelector(".ajdCusto.transporte")?.innerText.trim() || ""
    );

    linha.push(tr.querySelector(".totAjdCusto")?.innerText.trim() || "0");
    linha.push(tr.querySelector("input.hospedagem")?.value || "");
    linha.push(tr.querySelector("input.transporteExtraInput")?.value || "");
    linha.push(tr.querySelector(".totGeral")?.innerText.trim() || "0");

    dados.push(linha);
  });

  // Criar planilha
  const ws = XLSX.utils.aoa_to_sheet(dados);

  // Aplicar largura das colunas
  ws["!cols"] = [
    { wch: 10 },
    { wch: 14 },
    { wch: 9 },
    { wch: 20 },
    { wch: 9 },
    { wch: 20 },
    { wch: 13 },
    { wch: 13 },
    { wch: 13 },
    { wch: 15 },
    { wch: 11 },
    { wch: 15 },
    { wch: 19 },
    { wch: 18 },
    { wch: 16 },
    { wch: 20 },
    { wch: 20 },
    { wch: 15 },
  ];

  // Aplicar estilo no cabeçalho (linha 0)
  const headerStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" } }, // texto branco
    fill: { fgColor: { rgb: "2f3330" } }, // fundo azul
    alignment: { horizontal: "center", vertical: "center" },
    border: {
      top: { style: "thin", color: { rgb: "000000" } },
      bottom: { style: "thin", color: { rgb: "000000" } },
      left: { style: "thin", color: { rgb: "000000" } },
      right: { style: "thin", color: { rgb: "000000" } },
    },
  };
  const range = XLSX.utils.decode_range(ws["!ref"]);

  // Aplica estilo ao cabeçalho
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: C });
    if (!ws[cellAddress]) continue;
    ws[cellAddress].s = headerStyle;
  }

  // Alinha todas as células ao centro
  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
      if (!ws[cellAddress]) continue;
      if (!ws[cellAddress].s) ws[cellAddress].s = {};
      ws[cellAddress].s.alignment = {
        horizontal: "center",
        vertical: "center",
      };
    }
  }
  // Criar e salvar arquivo
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Orçamento");
  XLSX.writeFile(wb, "orcamento_formatado.xlsx");
}

function configurarEventosOrcamento() {
  console.log("Configurando eventos Orcamento...");
  //inicializarFlatpickrsGlobais();
  initializeAllFlatpickrsInModal();
  verificaOrcamento();

  console.log("Entrou configurar Orcamento no ORCAMENTO.js.");
}

window.configurarEventosOrcamento = configurarEventosOrcamento;

function gerenciarVisibilidadeValores(permissoes) {
  // ✅ MUDANÇA: Em vez de pegar o índice [0], buscamos pelo nome do módulo
  let p;
  if (Array.isArray(permissoes)) {
    p = permissoes.find(item => item.modulo.toLowerCase() === "orcamentos");
  } else {
    p = permissoes;
  }

  if (!p) {
    console.warn("⚠️ Permissão do módulo Orcamentos não encontrada no array.");
    return;
  }

  // No servidor as propriedades são 'pode_pesquisar', 'pode_alterar', etc.
  const ocultarFinanceiro = p.pode_pesquisar === true && 
                            p.pode_alterar === false && 
                            p.pode_cadastrar === false;

  console.log("Debug Permissão encontrada:", p);

  if (ocultarFinanceiro) {
    document.body.classList.add('restrito-visualizacao');
    console.log("🔒 Sistema em modo restrito (Financeiro oculto)");

    const camposData = document.querySelectorAll('.Periodo input, .flatpickr-input');
    camposData.forEach(input => {
      input.style.pointerEvents = 'none'; 
      input.readOnly = true; 
      if (input._flatpickr) {
        input._flatpickr.close();
      }
    });

  } else {
    document.body.classList.remove('restrito-visualizacao');
    
    const camposData = document.querySelectorAll('.Periodo input, .flatpickr-input');
    camposData.forEach(input => {
      input.style.pointerEvents = 'auto';
      input.readOnly = false;
    });

    console.log("✅ Sistema em modo completo");
  }
}

function configurarEventosEspecificos(modulo) {
  console.log("⚙️ configurarEventosEspecificos recebeu:", modulo);

  if (modulo.trim().toLowerCase() === "orcamentos") {
    initializeAllFlatpickrsInModal();
    configurarEventosOrcamento();

    if (typeof aplicarPermissoes === "function" && window.permissoes) {
      aplicarPermissoes(window.permissoes);
      gerenciarVisibilidadeValores(window.permissoes);
    } else {
      console.warn(
        "⚠️ aplicarPermissoes ou window.permissoes ainda não estão disponíveis."
      );
    }
  }
}
window.configurarEventosEspecificos = configurarEventosEspecificos;

document.addEventListener("DOMContentLoaded", function () {
  const orcamento = JSON.parse(
    sessionStorage.getItem("orcamentoSelecionado") || "{}"
  );

  if (orcamento?.nrorcamento) {
    document.getElementById("nrOrcamento").textContent = orcamento.nrorcamento;
    // ...adicione os campos necessários
  }
});

window.moduloHandlers = window.moduloHandlers || {};

window.moduloHandlers["Orcamentos"] = {
  // A chave 'Orcamentos' deve ser a mesma do seu mapaModulos no Index.js
  configurar: verificaOrcamento,
  desinicializar: desinicializarOrcamentosModal,
};

console.log(`Módulo Orcamentos.js registrado em window.moduloHandlers`);
