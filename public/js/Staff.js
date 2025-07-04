 console.log("Staff.js iniciou");
import { fetchComToken } from '../utils/utils.js';

//importado no inicio do js pois deve ser importado antes do restante do codigo
import "https://cdn.jsdelivr.net/npm/flatpickr@latest/dist/flatpickr.min.js";
import "https://cdn.jsdelivr.net/npm/flatpickr@latest/dist/l10n/pt.js";

const fp = window.flatpickr; 
const currentLocale = fp.l10ns.pt || fp.l10ns.default;

if (!currentLocale) {
    console.error("Flatpickr locale 'pt' não carregado. Verifique o caminho do arquivo.");
} else {
    fp.setDefaults({
        locale: currentLocale
    });
    console.log("Flatpickr locale definido para Português.");
}
//fim do tratamento do flatpickr

let flatpickrInstances = {};

const commonFlatpickrOptions = {
    mode: "multiple",
    dateFormat: "d/m/Y",
    altInput: true, // Se quiser altInput para os da tabela também
    altFormat: "d/m/Y",
    //locale: flatpickr.l10ns.pt,
    locale: currentLocale,
    appendTo: document.body, // Certifique-se de que 'modal-flatpickr-container' existe e é o elemento correto
    onChange: function(selectedDates) {
        const contador = document.getElementById('contadorDatas');
        if (contador) {
            if (selectedDates.length === 0) {
                contador.innerText = 'Nenhuma data selecionada';
            } else {
                contador.innerText = `${selectedDates.length} ${selectedDates.length === 1 ? 'Diaria Selecionada' : 'Diarias'}`;
            }
        }
    }
};

if (typeof window.StaffOriginal === "undefined") {
    window.StaffOriginal = {
        idStaff: "",
        avaliacao:"",
        nmFuncionario: "",
        descFuncao: "",
        vlrCusto: "",
        extra:"",
        transportes: "",
        alimentacao:"",
        caixinha:"",
        descBeneficio: "",
        nmCliente: "",
        nmEvento: "",
        datasEventos: "",   
        bonus: "",   
        vlrTotal: ""
    }
};

console.log("não carregou Verificar");
 async function verificaStaff() {

    console.log("Carregando Staff...");

      configurarPreviewPDF();
      configurarPreviewImagem();
      inicializarFlatpickrsGlobais();
      

    const botaoEnviar = document.querySelector("#Enviar");
    const botaoPesquisar = document.querySelector("#Pesquisar");
    const botaoLimpar = document.querySelector("#Limpar");

    const form = document.querySelector("#form");
    
    if (!botaoEnviar || !form) {
        console.error("Formulário ou botão não encontrado no DOM.");
        return;
    }

    botaoLimpar.addEventListener("click", function (event) {
        event.preventDefault(); // Previne o envio padrão do formulário 
        limparCamposStaff();
    });

    botaoEnviar.addEventListener("click", async (event) => {
        event.preventDefault(); // Previne o envio padrão do formulário

        const idStaff = document.querySelector("#idStaff").value.trim();
        const nmFuncionario = document.querySelector("#nmFuncionario").value.toUpperCase().trim();
        const descFuncao = document.querySelector("#descFuncao").value || '';
        const vlrCusto = document.querySelector("#vlrCusto").value.trim() || '';
        const extra = document.querySelector("#extra").value.trim() || '';
        const transporte = document.querySelector("#transportes").value.trim() || '';
        const alimentacao = document.querySelector("#alimentacao").value.trim() || '';
        const caixinha = document.querySelector("#caixinha").value.trim() || '';
        const nmCliente = document.querySelector("#nmCliente").value.trim();
        const nmEvento = document.querySelector("#nmEvento").value.trim();
        const dataevento = document.querySelector("#datasEvento").value.trim();
        const vlrTotal = document.querySelector("#vlrTotal").value;
    
        const custo = parseFloat(String(vlrCusto).replace(",", "."));
        const total = parseFloat(String(vlrTotal).replace(",", "."));

        if(!nmFuncionario || !descFuncao || !vlrCusto || !transporte || !alimentacao || !nmCliente || !nmEvento || !dataevento){
           return Swal.fire("Campos obrigatórios!", "Preencha todos os campos obrigatórios: Funcionario, Função, Cache, Transportes, Alimentação, Cliente, Evento e Periodo do Evento.", "warning");
        }

       // Permissões
        const temPermissaoCadastrar = temPermissao("Staff", "cadastrar");
        const temPermissaoAlterar = temPermissao("Staff", "alterar");

        const metodo = idStaff ? "PUT" : "POST";
        const url = idStaff ? `/staff/${idStaff}` : "/staff";

        if (!idStaff && !temPermissaoCadastrar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para cadastrar novas funções.", "error");
        }

        if (idStaff && !temPermissaoAlterar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para alterar funções.", "error");
        }
 
         console.log("Preparando dados para envio:", {
            nmFuncionario, descFuncao, vlrCusto, extra, transporte, alimentacao, caixinha,
            nmCliente, nmEvento, dataevento, vlrTotal
        });

         const formData = new FormData();
        // Adiciona todos os campos de texto ao FormData
        formData.append('Nome do Funcionario:', nmFuncionario);
        formData.append('Função:', descFuncao);
        formData.append('Cache:', vlrCusto);
        formData.append('Extra:', extra);
        formData.append('Transporte:', transporte);
        formData.append('Alimetação:', alimentacao);
        formData.append('Caixinha:', caixinha);
        formData.append('Cliente:', nmCliente);
        formData.append('Evento:', nmEvento);
        formData.append('Data de Evento:', dataevento);
        formData.append('Total a receber:', vlrTotal);


          // Adiciona o arquivo da foto APENAS SE UM NOVO ARQUIVO FOI SELECIONADO
        const inputFileElement = document.getElementById('file');
        const fotoArquivo = inputFileElement.files[0];
        if (fotoArquivo) {
            formData.append('foto', fotoArquivo); // 'foto' é o nome do campo esperado pelo Multer
        }
        
        console.log("Preparando envio de FormData. Método:", metodo, "URL:", url);
        console.log("Dados do FormData:", {
            nmFuncionario, descFuncao, vlrCusto, extra, transporte, alimentacao, caixinha,
            nmCliente, nmEvento, dataevento, vlrTotal
        });

          if (metodo === "PUT" && window.funcionarioOriginal) {
            let houveAlteracao = false;

            // 1. Verificar alteração na foto
            if (fotoArquivo) { // Se um novo arquivo foi selecionado
                houveAlteracao = true;
            } else {
            }

            // 2. Comparar os outros campos de texto
            if (!houveAlteracao) { // Só verifica os outros campos se a foto não causou uma alteração
                const camposTextoParaComparar = {
                    nmFuncionario, descFuncao, vlrCusto, extra, transporte, alimentacao, caixinha,
            nmCliente, nmEvento, dataevento, vlrTotal
                };
                for (const key in camposTextoParaComparar) {
                    // É importante que `funcionarioOriginal` tenha as chaves mapeadas para os nomes do frontend
                    // e que os valores sejam comparáveis (ex: ambos string, ambos uppercase se necessário).
                    const valorOriginal = String(window.StaffOriginal[key] || '').toUpperCase().trim();
                    const valorAtual = String(camposTextoParaComparar[key] || '').toUpperCase().trim();
                }
              }

              if (!houveAlteracao) {
                  return Swal.fire("Nenhuma alteração foi detectada!", "Faça alguma alteração antes de salvar.", "info");
              }

        //     if (
        //     parseInt(idStaff) === parseInt(window.StaffOriginal.idStaff) && 
        //     nmFuncionario === window.StaffOriginal.nmFuncionario && 
        //     descFuncao === window.StaffOriginal.descFuncao && 
        //     nmCliente === window.StaffOriginal.nmCliente && 
        //     nmEvento === window.StaffOriginal.nmEvento && 
        //     Number(custo).toFixed(2) === Number(window.StaffOriginal.vlrCusto).toFixed(2) &&
        //     Number(extra).toFixed(2) === Number(window.StaffOriginal.extra).toFixed(2) &&
        //     Number(transporte).toFixed(2) === Number(window.StaffOriginal.transporte).toFixed(2) &&
        //     Number(alimentacao).toFixed(2) === Number(window.StaffOriginal.alimentacao).toFixed(2) &&
        //     Number(caixinha).toFixed(2) === Number(window.StaffOriginal.caixinha).toFixed(2) &&
        //     Number(total).toFixed(2) === Number(window.StaffOriginal.vlrTotal).toFixed(2) &&
        //     dataevento === window.StaffOriginal.dataevento
        // ) {
        //     console.log("Nenhuma alteração detectada.");
        //     await Swal.fire({
        //         icon: 'info',
        //         title: 'Nenhuma alteração foi detectada!',
        //         text: 'Faça alguma alteração antes de salvar.',
        //         confirmButtonText: 'Entendi'
        //     });
        //     return;
        // }
    
        // const dados = { idStaff, nmFuncionario, descFuncao, custo, extra, transporte, alimentacao, caixinha, nmCliente, nmEvento, dataevento , total };

          try {
            // Confirmação para alteração (PUT)
            if (metodo === "PUT") {
                const { isConfirmed } = await Swal.fire({
                    title: "Deseja salvar as alterações?",
                    text: "Você está prestes a atualizar os dados do funcionário.",
                    icon: "question",
                    showCancelButton: true,
                    confirmButtonText: "Sim, salvar",
                    cancelButtonText: "Cancelar",
                    reverseButtons: true,
                    focusCancel: true
                });
                if (!isConfirmed) return;
            }

            // --- CHAMADA FETCH COM FORMDATA ---
            const respostaApi = await fetchComToken(url, {
                method: metodo,
                body: formData, // ENVIA O FORMDATA AQUI
                // O fetchComToken deve ser ajustado para NÃO adicionar Content-Type: application/json
                // quando o body é um FormData. O navegador cuida disso automaticamente.
            });

            await Swal.fire("Sucesso!", respostaApi.message || "Funcionário salvo com sucesso.", "success");
            limparCamposSidStaff();
            window.funcionarioOriginal = null; // Reseta o estado original após sucesso

        } catch (error) {
            console.error("Erro ao enviar dados do funcionário:", error);
            Swal.fire("Erro", error.message || "Erro ao salvar funcionário.", "error");
        }
      }
    });
    

    botaoPesquisar.addEventListener("click", async function (event) {
        event.preventDefault();
        console.log("Pesquisando Staff...");

        limparCamposStaff();
        console.log("Pesquisando Staff...");

        const temPermissaoPesquisar = temPermissao('Staff', 'pesquisar');
        console.log("Tem permissão para pesquisar Staff:", temPermissaoPesquisar);
        if (!temPermissaoPesquisar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para pesquisar.", "warning");
        }

        try {
            const response = await fetchComToken("/staff"); // ajuste a rota conforme sua API
            if (!response.ok) throw new Error("Erro ao buscar funções");
    
            const staff = await response.json();

            console.log("Staff encontrado:", staff);

            const select = criarSelectStaff(staff);
            limparCamposStaff();
            const input = document.querySelector("#descStaff");
               
            if (input && input.parentNode) {
                input.parentNode.replaceChild(select, input);
            }
   
            const label = document.querySelector('label[for="descStaff"]');
            if (label) {
              label.style.display = "none"; // ou guarda o texto, se quiser restaurar exatamente o mesmo
            }
    
            // Reativar o evento blur para o novo select
            select.addEventListener("change", async function () {
                const desc = this.value?.trim();
               
                if (!desc) {
                    console.warn("Valor do select está vazio ou indefinido.");
                    return;
                }

                await carregarStaffDescricao(desc, this);

                const novoInput = document.createElement("input");
                novoInput.type = "text";
                novoInput.id = "descStaff";
                novoInput.name = "descStaff";
                novoInput.required = true;
                novoInput.className = "form";
                novoInput.value = desc;
            
                novoInput.addEventListener("input", function() {
                    this.value = this.value.toUpperCase(); // transforma o texto em maiúsculo à medida que o usuário digita
                });

                this.parentNode.replaceChild(novoInput, this);
                adicionarEventoBlurStaff();
               
                const label = document.querySelector('label[for="descStaff"]');
                if (label) {
                label.style.display = "block";
                label.textContent = "Descrição do Staff"; // ou algum texto que você tenha guardado
                }
              
                novoInput.addEventListener("blur", async function () {
                    if (!this.value.trim()) return;
                    await carregarStaffDescricao(this.value, this);
                });
 
         });
    
        } catch (error) {
            console.error("Erro ao carregar staffs:", error);
            Swal.fire({
                icon: 'error',
                title: 'Erro',
                text: 'Não foi possível carregar os staffs.',
                confirmButtonText: 'Ok'
            });
        }
    });
    

}

console.log("não iniciou flat")
function inicializarFlatpickrsGlobais() {
console.log("Inicializando Flatpickr para todos os campos de data (globais)...");
    const dateInputIds = [
        'datasEvento'
    ];

    dateInputIds.forEach(id => { // Este é o loop correto
        const element = document.getElementById(id);
        if (element) { // Verificamos se o elemento existe
            // **IMPORTANTE**: Só inicialize se já não foi inicializado
            if (!element._flatpickr) { 
                const picker = flatpickr(element, commonFlatpickrOptions);
                // **CRUCIAL**: Salve a instância no objeto global 'flatpickrInstances'
                flatpickrInstances[id] = picker; 
                console.log(`Flatpickr inicializado e salvo para campo global #${id}`);
            } else {
                console.log(`Flatpickr para campo global #${id} já estava inicializado.`);
                // Se já estava inicializado, podemos simplesmente garantir que a instância está salva
                flatpickrInstances[id] = element._flatpickr; 
            }
        } else {
            console.warn(`Elemento com ID '${id}' não encontrado para inicialização do Flatpickr.`);
        }
    });
}

// function criarSelectStaff() {
   
//     const select = document.createElement("select");
//     select.id = "descStaff";
//     select.name = "descStaff";
//     select.required = true;
//     select.className = "form";

   
//     // Adicionar opções
//     const defaultOption = document.createElement("option");
//     defaultOption.value = "";
//     defaultOption.text = "Selecione uma função...";
//     defaultOption.disabled = true;
//     defaultOption.selected = true;
//     select.appendChild(defaultOption);
   
//     console.log("PESQUISANDO FUNCAO:", funcoes);

//     funcoes.forEach(staffachada => {
//         const option = document.createElement("option");
//         option.value = staffachada.descstaff;
//         option.text = staffachada.descstaff;
//         select.appendChild(option);
//     });
 
//     return select;
// }

console.log("ainda n adicionou Blur")
function adicionarEventoBlurStaff() {
    const input = document.querySelector("#nmFuncionario");
    if (!input) return;

    let ultimoClique = null;

    // Captura o último elemento clicado no documento
    document.addEventListener("mousedown", (e) => {
        ultimoClique = e.target;
    });
    
    input.addEventListener("blur", async function () {
       
        const botoesIgnorados = ["Limpar", "Pesquisar", "Enviar"];
        const ehBotaoIgnorado =
            ultimoClique?.id && botoesIgnorados.includes(ultimoClique.id) ||
            ultimoClique?.classList.contains("close");

        if (ehBotaoIgnorado) {
            console.log("🔁 Blur ignorado: clique em botão de controle (Fechar/Limpar/Pesquisar).");
            return;
        }
        const desc = this.value.trim();
        console.log("Campo descStaff procurado:", desc);

        if (!desc) return;

        try {
            await carregarStaffDescricao(desc, this);
            console.log("Staff selecionada depois de carregarStaffDescricao:", this.value);
        } catch (error) {
            console.error("Erro ao buscar Staff:", error);
        }
    });
}
console.log("n carregou a descrição staff");
async function carregarStaffDescricao(desc, elementoAtual) {
    try {
        const response = await fetchComToken(`/staff?descStaff=${encodeURIComponent(desc)}`);
        if (!response.ok) throw new Error();
           
        const staff = await response.json();
        document.querySelector("#idStaff").value = staff.idstaff;
        document.querySelector("#nmFuncionario").value = staff.nmFuncionario;
        document.querySelector("#descFuncao").value = staff.descFuncao;
        document.querySelector("#vlrCusto").value = staff.vlrcusto;
        document.querySelector("#vlrBeneficio").value = staff.vlrbeneficio;
        document.querySelector("#descBeneficio").value = staff.descbeneficio;
        document.querySelector("#nmCliente").value = staff.nmcliente;
        document.querySelector("#nmEvento").value = staff.nmevento;
        document.querySelector("#dtInicio").value = staff.dtinicio ? staff.dtinicio.split('T')[0] : "";
        document.querySelector("#dtFim").value = staff.dtfim ? staff.dtfim.split('T')[0] : "";
        document.querySelector("#vlrTotal").value = staff.vlrtotal;
        
        window.StaffOriginal = {
            idStaff: staff.idstaff,
            nmFuncionario: staff.nmfuncionario,
            descFuncao: staff.descfuncao,            
            vlrCusto: staff.vlrCusto,
            vlrBeneficio: staff.vlrbeneficio,
            descBeneficio: staff.descbeneficio,            
            nmCliente: staff.nmcliente,
            nmEvento: staff.nmevento,
            dtInicio: staff.dtinicio ? staff.dtinicio.split('T')[0] : "",
            dtFim: staff.dtfim ? staff.dtfim.split('T')[0] : "",
            vlrTotal: staff.vlrtotal
        };
   
       

    } catch (error) {
        
        const inputIdStaff = document.querySelector("#idStaff");
        const podeCadastrarStaff = temPermissao("Staff", "cadastrar");

       if (!inputIdStaff.value && podeCadastrarStaff) {
    
            const resultado = await Swal.fire({
                icon: 'question',
                title: `Deseja cadastrar "${desc.toUpperCase()}" como Staff?`,
                text: `Staff "${desc.toUpperCase()}" não encontrado`,
                showCancelButton: true,
                confirmButtonText: "Sim, cadastrar",
                cancelButtonText: "Cancelar",
                reverseButtons: true,
                focusCancel: true
            });

                console.log("Resultado do Swal:", resultado);
            if (!resultado.isConfirmed) {
                console.log("Usuário cancelou o cadastro do Staff.");
                elementoAtual.value = ""; // Limpa o campo se não for cadastrar
                setTimeout(() => {
                    elementoAtual.focus();
                }, 0);
                return;
            }
        
        }else if (!podeCadastrarStaff) {
            Swal.fire({
                icon: "info",
                title: "Staff não cadastrada",
                text: "Você não tem permissão para cadastrar Staff.",
                confirmButtonText: "OK"
            });
        }
        
    }
}



function limparStaffOriginal() {
    window.StaffOriginal = {
        idStaff: "",
        nmFuncionario: "",
        descFuncao: "",
        vlrCusto: "",
        vlrBeneficio: "",
        descBeneficio: "",
        nmCliente: "",
        nmEvento: "",
        dtInicio: "",
        dtFim: "",
        vlrTotal: ""
    };
}

function limparCamposStaff() {
const campos = ["idStaff", "nmFuncionario", "descFuncao", "vlrCusto", "vlrBeneficio", "descBeneficio", "nmCliente", "nmEvento", "dtInicio", "dtFim", "vlrTotal"];
    campos.forEach(id => {
        const campo = document.getElementById(id);
        if (campo) campo.value = "";
    });
    
}

document.getElementById('Extracheck').addEventListener('change', function () {
  const campo = document.getElementById('campoExtra');
  const input = document.getElementById('extra');

  if (this.checked) {
    campo.style.display = 'block';
    input.required = true;
    input.style.width = '100%'; // aplica largura total
  } else {
    campo.style.display = 'none';
    input.value = '';
    input.required = false;
  }

  calcularValorTotal();
});

document.getElementById('Caixinhacheck').addEventListener('change', function () {
  const campo = document.getElementById('campoCaixinha');
  const input = document.getElementById('caixinha');

  if (this.checked) {
    campo.style.display = 'block';
    input.required = true;
    input.style.width = '100%'; // aplica largura total
  } else {
    campo.style.display = 'none';
    input.value = '';
    input.required = false;
  }

  calcularValorTotal();
});

  function calcularValorTotal() {
    const cache = parseFloat(document.getElementById('vlrCusto').value.replace(',', '.')) || 0;
    const extra = parseFloat(document.getElementById('extra').value.replace(',', '.')) || 0;
    const transportes = parseFloat(document.getElementById('transportes').value.replace(',', '.')) || 0;
    const alimentacao = parseFloat(document.getElementById('alimentacao').value.replace(',', '.')) || 0;
    const caixinha = parseFloat(document.getElementById('caixinha').value.replace(',', '.')) || 0;

    const contadorTexto = document.getElementById('contadorDatas').innerText;
    const match = contadorTexto.match(/\d+/);
    const numeroDias = match ? parseInt(match[0]) : 0;

    const soma = cache + extra + transportes + alimentacao + caixinha;
    const total = soma * numeroDias;

    const valorFormatado = 'R$ ' + total.toFixed(2).replace('.', ',');
    const valorLimpo = total.toFixed(2);

    document.getElementById('vlrTotal').value = valorFormatado;
    document.getElementById('vlrTotalHidden').value = valorLimpo;

    console.log(`Cálculo: (${cache} + ${extra} + ${transportes} + ${alimentacao} + ${caixinha}) * ${numeroDias} = ${valorFormatado}`);
  }

  // Adiciona listeners de input para os campos que impactam no cálculo
  ['vlrCusto', 'extra', 'transportes', 'alimentacao', 'caixinha'].forEach(function(id) {
    const el = document.getElementById(id);
    if(el) el.addEventListener('input', calcularValorTotal);
  });

  // Cria um observer para o contadorDatas para recalcular quando mudar texto
  const contadorDatasEl = document.getElementById('contadorDatas');
  if (contadorDatasEl) {
    const observer = new MutationObserver(calcularValorTotal);
    observer.observe(contadorDatasEl, { childList: true, characterData: true, subtree: true });
  }

  // Pode chamar a função na inicialização para garantir valor correto
  calcularValorTotal();



console.log("Ainda não Entrou no Previewpdf");

function configurarPreviewPDF() {
  const inputPDF = document.getElementById('filePDF');
  const previewPDF = document.getElementById('previewPDF');
  const fileNamePDF = document.getElementById('fileNamePDF');
  const hiddenPDF = document.getElementById('ComprovantePagamentos');
  const headerPDF = document.getElementById('uploadHeaderPDF');

  inputPDF.addEventListener('change', function () {
    const file = inputPDF.files[0];

    if (!file || file.type !== 'application/pdf') {
      if (previewPDF) previewPDF.style.display = 'none';
      if (headerPDF) headerPDF.style.display = 'block';
      if (fileNamePDF) fileNamePDF.textContent = 'Nenhum arquivo selecionado';
      if (hiddenPDF) hiddenPDF.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
      if (previewPDF) {
        previewPDF.src = e.target.result;
        previewPDF.style.display = 'block';
      }
      if (headerPDF) headerPDF.style.display = 'none';
      if (fileNamePDF) fileNamePDF.textContent = file.name;
      if (hiddenPDF) hiddenPDF.value = e.target.result;
    };
    reader.readAsDataURL(file);
    console.log("funcionou pdf", fileNamePDF)
  });
}
console.log("Ainda não Entrou no PreviewIMg");
function configurarPreviewImagem() {
  const inputImg = document.getElementById('file');
  const previewImg = document.getElementById('previewFoto');
  const fileNameImg = document.getElementById('fileName');
  const hiddenImg = document.getElementById('linkFotoSidStaff');
  const headerImg = document.getElementById('uploadHeader');

  inputImg.addEventListener('change', function () {
    const file = inputImg.files[0];
    if (!file || !file.type.startsWith('image/')) {
      previewImg.style.display = 'none';
      headerImg.style.display = 'block';
      fileNameImg.textContent = 'Nenhum arquivo selecionado';
      hiddenImg.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
      previewImg.src = e.target.result;
      previewImg.style.display = 'block';
      headerImg.style.display = 'none';
      fileNameImg.textContent = file.name;
      hiddenImg.value = e.target.result;
    };
    reader.readAsDataURL(file);
    console.log("pegou a imagem do ", fileNameImg)
  });
}

// window.addEventListener('DOMContentLoaded', function () {
//   configurarPreviewPDF();
//   configurarPreviewImagem();
// });


let contadorFieldsets = 1;
const datasGlobaisSelecionadas = [];

function adicionarCampos() {
  console.log("✅ Função adicionarCampos chamada");

  const container = document.getElementById("containerFieldsets");
  const fieldsetOriginal = container.querySelector("fieldset");
  const novoFieldset = fieldsetOriginal.cloneNode(true);
  console.log("📋 Fieldset clonado");

  contadorFieldsets++;

  const novoId = "datasEvento" + contadorFieldsets;
  const novoContadorId = "contadorDatas" + contadorFieldsets;
  const novoFileId = "filePDF" + contadorFieldsets;
  const novoFileNameId = "fileNamePDF" + contadorFieldsets;
  const novoHiddenId = "ComprovantePagamentos" + contadorFieldsets;

  // Atualiza campo de datas
  const inputDatas = novoFieldset.querySelector("input[id^='datasEvento']");
  inputDatas.id = novoId;
  inputDatas.value = "";
  console.log("📅 Novo input de datas ID:", novoId);

  // Atualiza contador de datas
  const contador = novoFieldset.querySelector("p[id^='contadorDatas']");
  contador.id = novoContadorId;
  contador.textContent = "Nenhuma data selecionada.";
  console.log("🔢 Contador de datas atualizado:", novoContadorId);

  // Atualiza campo de arquivo PDF
  const inputFile = novoFieldset.querySelector("input[type='file']");
  const labelFile = novoFieldset.querySelector("label[for^='filePDF']");
  const pFileName = novoFieldset.querySelector("p[id^='fileNamePDF']");
  const hiddenInput = novoFieldset.querySelector("input[type='hidden']");

  inputFile.id = novoFileId;
  labelFile.setAttribute("for", novoFileId);
  pFileName.id = novoFileNameId;
  pFileName.textContent = "Nenhum arquivo selecionado";
  hiddenInput.id = novoHiddenId;
  hiddenInput.name = "foto[]";
  hiddenInput.value = "";
  console.log("📁 Input de arquivo atualizado:", novoFileId);

  // Evento de conversão do PDF para base64
  inputFile.addEventListener("change", function () {
    const file = this.files[0];
    const fileNameDisplay = document.getElementById(novoFileNameId);
    const hiddenInputTarget = document.getElementById(novoHiddenId);

    if (file) {
      console.log("📎 Arquivo selecionado:", file.name);
      fileNameDisplay.textContent = file.name;

      const reader = new FileReader();
      reader.onload = function (e) {
        hiddenInputTarget.value = e.target.result;
        console.log("📦 Arquivo convertido para Base64");
      };
      reader.readAsDataURL(file);
    } else {
      console.log("⚠️ Nenhum arquivo selecionado");
      fileNameDisplay.textContent = "Nenhum arquivo selecionado";
      hiddenInputTarget.value = "";
    }
  });

  // Botão de remover
  const botaoExistente = novoFieldset.querySelector(".btn-remover");
  if (botaoExistente) {
    botaoExistente.remove();
    console.log("🧽 Botão de remover antigo excluído");
  }

  const botaoRemover = document.createElement("button");
  botaoRemover.type = "button";
  botaoRemover.textContent = "Remover";
  botaoRemover.className = "btn-remover";
  botaoRemover.style.marginTop = "10px";
  botaoRemover.onclick = function () {
    const fpInstance = inputDatas._flatpickr;
    if (fpInstance) {
      fpInstance.selectedDates.forEach(data => {
        datasGlobaisSelecionadas = datasGlobaisSelecionadas.filter(
          d => d.getTime() !== data.getTime()
        );
      });
      console.log("🗑️ Datas removidas do array global");
    }

    container.removeChild(novoFieldset);
    console.log("❌ Fieldset removido");

  };

  novoFieldset.appendChild(botaoRemover);
  container.appendChild(novoFieldset);
  console.log("✅ Novo fieldset adicionado ao container");


}


  // Setup do primeiro input file
  const inputFile = document.getElementById("filePDF");
  const fileName = document.getElementById("fileNamePDF");
  const hiddenInput = document.getElementById("ComprovantePagamentos");

  inputFile.addEventListener("change", function () {
    const file = this.files[0];
    if (file) {
      fileName.textContent = file.name;
      const reader = new FileReader();
      reader.onload = function (e) {
        hiddenInput.value = e.target.result;
      };
      reader.readAsDataURL(file);
    } else {
      fileName.textContent = "Nenhum arquivo selecionado";
      hiddenInput.value = "";
    }
  });

 function mostrarTarja() {
    var select = document.getElementById('avaliacao');
    var tarja = document.getElementById('tarjaAvaliacao');

    tarja.className = 'tarja-avaliacao'; // Reseta classes
    tarja.style.display = 'none'; // Oculta por padrão

    if (select.value === 'muito_bom') {
      tarja.classList.add('muito-bom');
      tarja.textContent = 'Funcionário Muito Bom';
      tarja.style.display = 'block';
    } else if (select.value === 'satisfatorio') {
      tarja.classList.add('satisfatorio');
      tarja.textContent = 'Funcionário Satisfatório';
      tarja.style.display = 'block';
    } else if (select.value === 'regular') {
      tarja.classList.add('regular');
      tarja.textContent = 'Funcionário Regular';
      tarja.style.display = 'block';
    }
  }


function configurarEventosStaff() {
    console.log("Configurando eventos Staff...");
    verificaStaff(); // Carrega os Staff ao abrir o modal
    adicionarEventoBlurStaff();
    inicializarFlatpickrsGlobais();
    console.log("Entrou configurar Staff no FUNCAO.js.");
    

} 
window.configurarEventosStaff = configurarEventosStaff;

function configurarEventosEspecificos(modulo) {
  console.log("⚙️ configurarEventosEspecificos recebeu:", modulo);
  if (modulo.trim().toLowerCase() === 'staff') {
    configurarEventosStaff();

    if (typeof aplicarPermissoes === "function" && window.permissoes) {
      aplicarPermissoes(window.permissoes);
    } else {
      console.warn("⚠️ aplicarPermissoes ou window.permissoes ainda não estão disponíveis.");
    }

    console.log("Entrou configurar Staff no STAFF.js.");
  }
}
window.configurarEventosEspecificos = configurarEventosEspecificos;





