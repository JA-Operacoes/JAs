
if (typeof window.StaffOriginal === "undefined") {
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
        
    }
};

function verificaStaff() {

    console.log("Carregando Staff...");
       
    const botaoEnviar = document.querySelector("#Enviar");
    const botaoPesquisar = document.querySelector("#Pesquisar");
    const form = document.querySelector("#form");
    const botaoLimpar = document.querySelector("#Limpar");

    if (!botaoEnviar || !form) {
        console.error("Formulário ou botão não encontrado no DOM.");
        return;
    }

    botaoLimpar.addEventListener("click", function (event) {
        event.preventDefault(); // Previne o envio padrão do formulário 
        const campo = document.getElementById("descStaff");

        if (campo && campo.tagName.toLowerCase() === "select") {
            const input = document.createElement("input");
            input.type = "text";
            input.id = "descStaff";
            input.name = "descStaff";
            input.value = "Descrição da Função";
            input.className = "form";
            input.required = true;

            campo.parentNode.replaceChild(input, campo);
            adicionarEventoBlurStaff();

            const label = document.querySelector('label[for="descStaff"]');
            if (label) label.style.display = "block";

            // Adiciona o evento blur ao novo input
        
        }
        limparCamposStaff();

    });

    botaoEnviar.addEventListener("click", async function (event) {
        event.preventDefault(); // Previne o envio padrão do formulário

        const idStaff = document.querySelector("#idStaff").value;
        const nmFuncionario = document.querySelector("#nmFuncionario").value.toUpperCase().trim();
        const descFuncao = document.querySelector("#descFuncao").value;
        const vlrBeneficio = document.querySelector("#vlrBeneficio").value;
        const vlrCusto = document.querySelector("#vlrCusto").value;
        const descBeneficio = document.querySelector("#descBeneficio").value;
        const nmCliente = document.querySelector("#nmCliente").value.trim();
        const nmEvento = document.querySelector("#nmEvento").value.trim();
        const dtInicio = document.querySelector("#dtInicio").value.trim();
        const dtFim = document.querySelector("#dtFim").value.trim();
        const vlrTotal = document.querySelector("#vlrTotal").value;
    
        const beneficio = parseFloat(String(vlrBeneficio).replace(",", "."));
        const custo = parseFloat(String(vlrCusto).replace(",", "."));
        const total = parseFloat(String(vlrTotal).replace(",", "."));

       // Permissões
        const temPermissaoCadastrar = temPermissao("Staff", "cadastrar");
        const temPermissaoAlterar = temPermissao("Staff", "alterar");

        const metodo = idStaff ? "PUT" : "POST";

        if (!idStaff && !temPermissaoCadastrar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para cadastrar novas funções.", "error");
        }

        if (idStaff && !temPermissaoAlterar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para alterar funções.", "error");
        }
 
        let formValido = true;
        let mensagens = [];

        // Lista de IDs dos campos obrigatórios (exceto o campo "file")
        const camposObrigatorios = [
            "nmFuncionario", "descFuncao", "vlrCusto", "vlrBeneficio",
            "nmCliente", "nmEvento", "dtInicio", "dtFim", "vlrTotal"
        ];

        camposObrigatorios.forEach(id => {
            const campo = document.getElementById(id);
            if (!campo || campo.value.trim() === "") {
            formValido = false;
            mensagens.push(`- Campo "${campo?.previousElementSibling?.textContent || id}" é obrigatório.`);
            }
        });

        // Se não for válido, cancelar o envio e mostrar mensagem
        if (!formValido) {
            e.preventDefault();
            alert("Preencha os campos obrigatórios:\n\n" + mensagens.join("\n"));
        }


        // if (!descStaff || !vlrCusto || !vlrVenda) {
           
        //     Swal.fire({
        //         icon: 'warning',
        //         title: 'Campos obrigatórios!',
        //         text: 'Preencha todos os campos antes de enviar.',
        //         confirmButtonText: 'Entendi'
        //     });
        //     return;
        // }

        // console.log("Valores do Staff:", idStaff, descStaff, custo, venda, ajcstaff, obsstaff);
        // console.log("Valores do Staff Original:", window.StaffOriginal.idStaff, window.StaffOriginal.descStaff, window.StaffOriginal.vlrCusto, window.StaffOriginal.vlrVenda, window.StaffOriginal.vlrajdcusto, window.StaffOriginal.obsStaff);
            
        // Comparar com os valores originais

        const formatarData = (dataStr) => new Date(dataStr).toISOString().split('T')[0];

        
        

        if (
            parseInt(idStaff) === parseInt(window.StaffOriginal.idStaff) && 
            nmFuncionario === window.StaffOriginal.nmFuncionario && 
            descFuncao === window.StaffOriginal.descFuncao && 
            nmCliente === window.StaffOriginal.nmCliente && 
            nmEvento === window.StaffOriginal.nmEvento && 
            Number(custo).toFixed(2) === Number(window.StaffOriginal.vlrCusto).toFixed(2) &&
            Number(beneficio).toFixed(2) === Number(window.StaffOriginal.vlrBeneficio).toFixed(2) &&
            Number(total).toFixed(2) === Number(window.StaffOriginal.vlrTotal).toFixed(2) &&
            descBeneficio=== window.StaffOriginal.descBeneficio &&
            formatarData(dtInicio) === formatarData(window.StaffOriginal.dtInicio) &&
            formatarData(dtFim) === formatarData(window.StaffOriginal.dtFim)
        ) {
            console.log("Nenhuma alteração detectada.");
            await Swal.fire({
                icon: 'info',
                title: 'Nenhuma alteração foi detectada!',
                text: 'Faça alguma alteração antes de salvar.',
                confirmButtonText: 'Entendi'
            });
            return;
        }
    
        const dados = { idStaff, nmFuncionario, descFuncao, custo,  beneficio, descBeneficio, nmCliente, nmEvento, dtInicio: formatarData(dtInicio), dtFim: formatarData(dtFim), total };

     
        if (idStaff) {
            Swal.fire({
                title: "Deseja salvar as alterações?",
                text: "Você está prestes a atualizar os dados do Staff.",
                icon: "question",
                showCancelButton: true,
                confirmButtonText: "Sim, salvar",
                cancelButtonText: "Cancelar",
                reverseButtons: true,
                focusCancel: true
                
            }).then(async (result) => {
                if (result.isConfirmed) {
                    try {
                        const response = await fetchComToken(`/staff/${idStaff}`, {
                            method: "PUT",
                            headers: {
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify(dados)
                        });
        
                        const resultJson = await response.json();
        
                        if (response.ok) {
                            document.getElementById('form').reset();
                            Swal.fire("Sucesso!", resultJson.mensagem || "Alterações salvas com sucesso!", "success");
                            //form.reset();
                            document.querySelector("#idStaff").value = "";
                            limparStaffOriginal();  
                        } else {
                            Swal.fire("Erro", resultJson.erro || "Erro ao salvar o Staff.", "error");
                        }
                    } catch (error) {
                        console.error("Erro ao enviar dados:", error);
                        Swal.fire("Erro de conexão", "Não foi possível conectar ao servidor.", "error");
                    }
                } else {
                    console.log("Usuário cancelou a alteração.");
                }
            });
        } else {
            // Se for novo, salva direto
            try {
                const response = await fetchComToken("/staff", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(dados)
                });
        
                const resultJson = await response.json();
        
                if (response.ok) {
                    Swal.fire("Sucesso!", resultJson.mensagem || "Staff cadastrado!", "success");
                    form.reset();
                    limparStaffOriginal();
                    document.querySelector("#idStaff").value = "";
                } else {
                    Swal.fire("Erro", resultJson.erro || "Erro ao cadastrar o Staff.", "error");
                }
            } catch (error) {
                console.error("Erro ao enviar dados:", error);
                Swal.fire("Erro de conexão", "Não foi possível conectar ao servidor.", "error");
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
function criarSelectStaff(funcoes) {
   
    const select = document.createElement("select");
    select.id = "descStaff";
    select.name = "descStaff";
    select.required = true;
    select.className = "form";

   
    // Adicionar opções
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.text = "Selecione uma função...";
    defaultOption.disabled = true;
    defaultOption.selected = true;
    select.appendChild(defaultOption);
   
    console.log("PESQUISANDO FUNCAO:", funcoes);

    funcoes.forEach(staffachada => {
        const option = document.createElement("option");
        option.value = staffachada.descstaff;
        option.text = staffachada.descstaff;
        select.appendChild(option);
    });
 
    return select;
}

function adicionarEventoBlurStaff() {
    const input = document.querySelector("#descStaff");
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
                text: `Função "${desc.toUpperCase()}" não encontrado`,
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
  const hiddenImg = document.getElementById('linkFotoFuncionarios');
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

window.addEventListener('DOMContentLoaded', function () {
  configurarPreviewPDF();
  configurarPreviewImagem();
});


let contadorFieldsets = 1;
let datasGlobaisSelecionadas = [];

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

    atualizarFlatpickrs();
  };

  novoFieldset.appendChild(botaoRemover);
  container.appendChild(novoFieldset);
  console.log("✅ Novo fieldset adicionado ao container");

  inicializarFlatpickr(`#${novoId}`, novoContadorId);

}
  
function inicializarFlatpickr(selector, contadorId) {
  console.log("📅 Inicializando Flatpickr para:", selector);

  const input = typeof selector === "string"
    ? document.querySelector(selector)
    : selector;

  if (!input) {
    console.warn("⚠️ Campo não encontrado para o seletor:", selector);
    return;
  }else{
    console.log("✅ campo encontrado para o seletor");
  }

  if (input._flatpickr) {
  input._flatpickr.destroy();
}

  

  flatpickr(input, {
    mode: "multiple",
    dateFormat: "d/m/Y",
    locale: "pt",
    altInput:true,
    altFormat: "d/m/Y",
    disable: datasGlobaisSelecionadas,
    onChange: function (selectedDates, dateStr, instance) {
      console.log("🖊️ onChange disparado. Datas selecionadas:", dateStr);

      // Remove datas antigas
      datasGlobaisSelecionadas = datasGlobaisSelecionadas.filter(
        d => !instance.previousSelectedDates?.some(sd => sd.getTime() === d.getTime())
      );

      // Adiciona novas
      selectedDates.forEach(data => {
        if (!datasGlobaisSelecionadas.some(d => d.getTime() === data.getTime())) {
          datasGlobaisSelecionadas.push(data);
        }
      });

      // Atualiza contador
      const contador = document.getElementById(contadorId);
      if (contador) {
        contador.textContent = selectedDates.length > 0
          ? `${selectedDates.length} data(s) selecionada(s).`
          : "Nenhuma data selecionada.";
        console.log("📊 Contador atualizado:", contador.textContent);
      }

      instance.previousSelectedDates = [...selectedDates];
      atualizarFlatpickrs();
    },
    onReady: function (selectedDates, dateStr, instance) {
      instance.previousSelectedDates = [...selectedDates];
      console.log("📂 Flatpickr pronto com datas:", selectedDates);
    }
  });
}

function atualizarFlatpickrs() {
  console.log("♻️ Atualizando todos os Flatpickrs");

  document.querySelectorAll("input[id^='datasEvento']").forEach(input => {
    const fpInstance = input._flatpickr;
    if (fpInstance) {
      fpInstance.set("disable", datasGlobaisSelecionadas);
      console.log("🚫 Datas desabilitadas atualizadas para:", input.id);
    }
  });
}

// Inicializa o primeiro campo ao carregar a página
document.addEventListener("DOMContentLoaded", function () {
  console.log("📦 DOM totalmente carregado. Inicializando primeiro Flatpickr.");
  inicializarFlatpickr("#datasEvento", "contadorDatas");
});

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



function fetchComToken(url, options = {}) {
  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("fetchComToken: nenhum token encontrado. Faça login primeiro.");
  }

  // Monta os headers sempre incluindo Authorization
  const headers = {
    "Authorization": `Bearer ${token}`,
    // só coloca Content-Type se houver body (POST/PUT)
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...options.headers
  };

  return fetch(url, {
    ...options,
    headers,
    // caso seu back-end esteja em outro host e precisa de CORS:
    mode: "cors",
    // se precisar enviar cookies de sessão:
    credentials: "include"
  });
}

function configurarEventosStaff() {
    console.log("Configurando eventos Staff...");
    verificaStaff(); // Carrega os Staff ao abrir o modal
    adicionarEventoBlurStaff();
    console.log("Entrou configurar Staff no FUNCAO.js.");
    

} 
window.configurarEventosStaff = configurarEventosStaff;

function configurarEventosEspecificos(modulo) {
  console.log("⚙️ configurarEventosEspecificos recebeu:", modulo);
  if (modulo.trim().toLowerCase() === 'staff') {
    configurarEventosStaff();
  }
}
window.configurarEventosEspecificos = configurarEventosEspecificos;
