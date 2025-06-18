function configurarEventosFuncionarios() {
    console.log("Configurando eventos do modal Funcionários...");
    
    configurarPreviewFoto();

    // Outras configurações específicas do modal de funcionários
}
async function salvarFuncionario(dados) {
  const idFuncionarios = document.querySelector("#idFuncionarios").value;

  if (idFuncionarios) {
    Swal.fire({
      title: "Deseja salvar as alterações?",
      text: "Você está prestes a atualizar os dados do funcionário.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sim, salvar",
      cancelButtonText: "Cancelar",
      reverseButtons: true,
      focusCancel: true
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                const response = await fetch(`/funcionarios/${idFuncionarios}`, {
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
            document.querySelector("#idFuncionarios").value = "";
            limparFuncionariosOriginal();  
          } else {
            Swal.fire("Erro", resultJson.erro || "Erro ao salvar o funcionário.", "error");
          }
        } catch (error) {
          console.error("Erro ao enviar dados:", error);
          Swal.fire("Erro de conexão", "Não foi possível conectar ao servidor.", "error");
        }
      }
    });
  } else {
    // Se for novo, salva direto
    try {
        const response = await fetch("/funcionarios", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(dados)
        });

      const resultJson = await response.json();

      if (response.ok) {
        Swal.fire("Sucesso!", resultJson.mensagem || "Funcionário cadastrado com sucesso!", "success");
        document.getElementById('form').reset();
        limparFuncionariosOriginal();
        document.querySelector("#idFuncionarios").value = "";
      } else {
        Swal.fire("Erro", resultJson.erro || "Erro ao cadastrar o funcionário.", "error");
      }
    } catch (error) {
      console.error("Erro ao enviar dados:", error);
      Swal.fire("Erro de conexão", "Não foi possível conectar ao servidor.", "error");
    }
  }
}

function verificarPerfil() {
  const internoSelecionado = document.getElementById("interno").checked;
  const container = document.getElementById("campoFuncaoContainer");

  // Limpa o campo, caso já exista
  container.innerHTML = "";

  if (internoSelecionado) {
    const div = document.createElement("div");
    div.classList.add("form2");

    const input = document.createElement("input");
    input.type = "text";
    input.name = "funcao";
    input.id = "funcao";
    input.required = true;
    input.spellcheck = false;

    const label = document.createElement("label");
    label.setAttribute("for", "funcao");
    label.innerText = "Função";
    

    div.appendChild(input);
    div.appendChild(label);
    container.appendChild(div);
  }
}


console.log("Ainda não Entrou no Preview");

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

  configurarPreviewImagem();
});

function atualizarCamposLinguas() {
  const select = document.getElementById('Linguas');
  const container = document.getElementById('idiomasContainer');
  const valor = select.value;

  container.innerHTML = ""; // Limpa campos anteriores

  if (valor === "") return;

  // Sempre adiciona o campo "Português"
  const inputPT = document.createElement("input");
  inputPT.type = "text";
  inputPT.value = "Português";
  inputPT.disabled = true;
  inputPT.className = "idiomaInput";
  // inputPT.style.marginBottom = "5px";
  inputPT.style.width = "90px";
  container.appendChild(inputPT);

  if (valor === "1") {
    return; // Monolíngue
  }

  if (valor === "2" || valor === "3") {
    const qtd = parseInt(valor) - 1;
    for (let i = 1; i <= qtd; i++) {
      const input = document.createElement("input");
      input.type = "text";
      input.placeholder = `Idioma ${i + 1}`;
      input.name = `idioma${i + 1}`;
      input.className = "idiomaInput";
        input.style.width = "90px";

      container.appendChild(input);
    }
  } else if (valor === "custom") {
    const grupo = document.createElement("div");
    grupo.style.display = "flex";
    grupo.style.flexDirection = "column";
    grupo.style.alignItems = "center";
      grupo.style.width = "200px";


    const label = document.createElement("p");
    label.textContent = "Quantos idiomas (incluindo Português)?";
    label.style.fontSize = "10px";
    label.style.marginleft = "150px";
    label.style.padding = "0";
    label.style.lineHeight = "1.2";
    label.style.width = "300px";

    const inputQtd = document.createElement("input");
    inputQtd.type = "number";
    inputQtd.min = 4;
    inputQtd.placeholder = "Min: 4";
      inputQtd.style.width = "90px";


    inputQtd.onchange = function () {
      grupo.style.display = "none";
      gerarCamposPoliglota(parseInt(this.value));
    };

    grupo.appendChild(label);
    grupo.appendChild(inputQtd);
    container.appendChild(grupo);
  }
}

function gerarCamposPoliglota(qtd) {
  const container = document.getElementById('idiomasContainer');
  while (container.children.length > 3) {
    container.removeChild(container.lastChild);
  }

  for (let i = 1; i < qtd; i++) {
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = `Idioma ${i + 1}`;
    input.name = `idioma${i + 1}`;
    input.className = "idiomaInput";
    input.style.width = "90px";
    container.appendChild(input);
  }
}


 async function configurarEventosFuncionarioss() {
    console.log("Configurando eventos Funcionarioss...");
    verificaFuncionarioss(); // Carrega os Funcionarioss ao abrir o modal
    configurarPreviewFoto();
    inputFile.dataset.previewSet = "true"; // Evita configurar mais de uma vez
  }
