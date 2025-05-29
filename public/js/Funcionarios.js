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



 async function configurarEventosFuncionarioss() {
    console.log("Configurando eventos Funcionarioss...");
    verificaFuncionarioss(); // Carrega os Funcionarioss ao abrir o modal
    configurarPreviewFoto();
    inputFile.dataset.previewSet = "true"; // Evita configurar mais de uma vez
  }
