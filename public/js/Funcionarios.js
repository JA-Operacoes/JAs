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


console.log("Ainda não Entrou no Preview");

function configurarPreviewFoto() {
  const inputFile = document.getElementById('file');
  const preview = document.getElementById('previewFoto');
  const fileName = document.getElementById('fileName');
  const hiddenInput = document.getElementById('linkFotoFuncionarios');
  const header = document.getElementById('uploadHeader');

  if (!inputFile || !preview || !fileName || !hiddenInput || !header) {
    console.warn("Elementos do preview não encontrados.");
    return;
  }

  inputFile.addEventListener('change', function () {
    const file = inputFile.files[0];

    if (!file) {
      // Nenhum arquivo selecionado
      preview.style.display = 'none';
      header.style.display = 'block';
      fileName.textContent = 'Nenhum arquivo selecionado';
      hiddenInput.value = '';
      return;
    }

    if (!file.type.startsWith('image/')) {
      Swal.fire('Arquivo inválido', 'Selecione uma imagem válida.', 'warning');
      inputFile.value = '';
      preview.style.display = 'none';
      header.style.display = 'block';
      fileName.textContent = 'Nenhum arquivo selecionado';
      hiddenInput.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
      preview.src = e.target.result;
      preview.style.display = 'block';
      header.style.display = 'none';
      fileName.textContent = file.name;
      hiddenInput.value = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

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
    inputPT.style.marginBottom = "5px";
    container.appendChild(inputPT);
    container.appendChild(document.createElement("br"));

    if (valor === "1") {
      // Monolíngue: nada mais a fazer
      return;
    }

    if (valor === "2" || valor === "3") {
      const qtd = parseInt(valor) - 1; // Já temos "Português", agora só os restantes
      for (let i = 1; i <= qtd; i++) {
        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = `Idioma ${i + 1}`;
        input.name = `idioma${i + 1}`;
        input.className = "idiomaInput";
        container.appendChild(input);
        container.appendChild(document.createElement("br"));
      }
    } 
    else if (valor === "custom") {
      // Poliglota → campo para definir quantas línguas no total
      const label = document.createElement("p");
      label.textContent = "Quantos idiomas (incluindo Português)?";
      const inputQtd = document.createElement("input");
      label.style.fontSize = "10px";
      label.style.margin = "0";
      label.style.padding = "0";  
      label.style.lineHeight = "1";  
      inputQtd.type = "number";
      inputQtd.min = 4; // mínimo de 4 porque "Poliglota" não é monolíngue, bilíngue e nem Trílingue
      inputQtd.placeholder = "Min: 4";
      inputQtd.onchange = function () {
      label.style.display = "none";
      inputQtd.style.display = "none";
      gerarCamposPoliglota(parseInt(this.value));
      };
      container.appendChild(label);
      // container.appendChild(document.createElement("br"));
      container.appendChild(inputQtd);
    }
  }

  function gerarCamposPoliglota(qtd) {
    const container = document.getElementById('idiomasContainer');
    // Remove todos elementos exceto os dois primeiros (Português + campo de quantidade)
    while (container.children.length > 3) {
      container.removeChild(container.lastChild);
    }

    for (let i = 1; i < qtd; i++) { // Começa em 1 porque o primeiro já é "Português"
      const input = document.createElement("input");
      input.type = "text";
      input.placeholder = `Idioma ${i + 1}`;
      input.name = `idioma${i + 1}`;
      input.className = "idiomaInput";
      // container.appendChild(document.createElement("br"));
      container.appendChild(input);
    }
  }



 async function configurarEventosFuncionarioss() {
    console.log("Configurando eventos Funcionarioss...");
    verificaFuncionarioss(); // Carrega os Funcionarioss ao abrir o modal
    configurarPreviewFoto();
    inputFile.dataset.previewSet = "true"; // Evita configurar mais de uma vez
  }
