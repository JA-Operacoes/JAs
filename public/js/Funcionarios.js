let funcionarioOriginal = null;

async function verificaFuncionarios() {
    console.log("Configurando eventos do modal Funcionários...");
    
    configurarPreviewFoto();

    const botaoEnviar = document.querySelector("#Enviar");
    const botaoPesquisar = document.querySelector("#Pesquisar");
    const botaoLimpar = document.querySelector("#Limpar");
    
    const form = document.querySelector("#form-funcionario");

    if (!botaoEnviar|| !form) {
        console.error("Formulário ou botão não encontrado no DOM.");
        return;
    }

    botaoLimpar.addEventListener("click", (e) => {
        e.preventDefault();
        limparCamposFuncionarios();
    });

    botaoEnviar.addEventListener("click", async (event) => {
        event.preventDefault();

      const idFuncionarios = document.querySelector("#idFuncionarios").value.trim();
   
      const perfil = document.querySelector('input[name="radio"]:checked')?.value || '';
      const linkFoto = document.getElementById("linkFotoFuncionarios").value.trim();
      const nome = document.querySelector("#nome").value.toUpperCase().trim();
      const cpf = document.getElementById("cpf").value.trim();
      const rg = document.getElementById("rg").value.trim();
      const nivelFluenciaLinguas = document.getElementById("Linguas").value.trim();
      // Para idiomasAdicionais, você precisará de uma lógica para coletar de inputs dinâmicos
      // Por enquanto, vou pegar de um campo simples, mas ajuste conforme seu HTML
      const idiomasAdicionais = document.getElementById("idiomasAdicionais")?.value.trim() || ''; 
      const celularPessoal = document.getElementById("celularPessoal").value.trim();
      const celularFamiliar = document.getElementById("celularFamiliar").value.trim();
      const email = document.getElementById("email").value.trim();
      const site = document.getElementById("site").value.trim();
      const banco = document.getElementById("Banco").value.toUpperCase().trim();
      const codigoBanco = document.getElementById("CodBanco").value.trim();
      const pix = document.getElementById("Pix").value.trim();
      const numeroConta = document.getElementById("Nconta").value.trim();
      const agencia = document.getElementById("agencia").value.trim();
      const tipoConta = document.getElementById("TPconta").value.trim();
      const cep = document.getElementById("cep").value.trim();
      const rua = document.getElementById("rua").value.toUpperCase().trim();
      const numero = document.getElementById("numero").value.trim();
      const complemento = document.getElementById("complemento").value.toUpperCase().trim();
      const bairro = document.getElementById("bairro").value.toUpperCase().trim();
      const cidade = document.getElementById("cidade").value.toUpperCase().trim();
      const estado = document.getElementById("estado").value.toUpperCase().trim();
      const pais = document.getElementById("pais").value.toUpperCase().trim();

      // Validação de campos obrigatórios
      if (!nome || !cpf || !rg || !celularPessoal || !email || !cep || !rua || !numero || !bairro || !cidade || !estado || !pais || !perfil) {
          return Swal.fire("Campos obrigatórios!", "Preencha todos os campos obrigatórios: Nome, CPF, RG, Celular Pessoal, E-mail, CEP, Rua, Número, Bairro, Cidade, Estado, País e Perfil.", "warning");
      }

      // Permissões
      const temPermissaoCadastrar = temPermissao("Funcionarios", "cadastrar");
      const temPermissaoAlterar = temPermissao("Funcionarios", "alterar");

      const metodo = idFuncionarios ? "PUT" : "POST";
      const url = idFuncionarios ? `/funcionarios/${idFuncionarios}` : "/funcionarios";

      if (!idFuncionarios && !temPermissaoCadastrar) {
          return Swal.fire("Acesso negado", "Você não tem permissão para cadastrar novos funcionários.", "error");
      }

      if (idFuncionarios && !temPermissaoAlterar) {
          return Swal.fire("Acesso negado", "Você não tem permissão para alterar funcionários.", "error");
      }

      const dados = {
          perfil, linkFoto, nome, cpf, rg, nivelFluenciaLinguas, idiomasAdicionais,
          celularPessoal, celularFamiliar, email, site, banco, codigoBanco, pix,
          numeroConta, agencia, tipoConta, cep, rua, numero, complemento, bairro,
          cidade, estado, pais
      };

      // Verifica se houve alterações para PUT
      if (metodo === "PUT" && funcionarioOriginal) {
          const dadosAlterados = Object.keys(dados).some(key => {
              // Conversão de valores para comparação consistente (ex: null vs '')
              const oldValue = funcionarioOriginal[key] === null ? '' : String(funcionarioOriginal[key]);
              const newValue = dados[key] === null ? '' : String(dados[key]);
              return oldValue !== newValue;
          });

          if (!dadosAlterados) {
              return Swal.fire("Nenhuma alteração foi detectada!", "Faça alguma alteração antes de salvar.", "info");
          }
      }

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

          console.log("Enviando dados para o servidor:", dados, "URL:", url, "Método:", metodo);
          const respostaApi = await fetchComToken(url, {
              method: metodo,
              body: JSON.stringify(dados)
          });

          await Swal.fire("Sucesso!", respostaApi.mensagem || "Funcionário salvo com sucesso.", "success");
          limparCamposFuncionarios();
          funcionarioOriginal = null; // Reseta o estado original após sucesso

      } catch (error) {
          console.error("Erro ao enviar dados do funcionário:", error);
          Swal.fire("Erro", error.message || "Erro ao salvar funcionário.", "error");
      }
    });

    botaoPesquisar.addEventListener("click", async function (event) {
      event.preventDefault();
      limparCamposFuncionarios(); // Limpa os campos antes de pesquisar

      console.log("Pesquisando Funcionários...");

      const temPermissaoPesquisar = temPermissao('Funcionarios', 'pesquisar');
      if (!temPermissaoPesquisar) {
          return Swal.fire("Acesso negado", "Você não tem permissão para pesquisar funcionários.", "warning");
      }

      try {
          const funcionarios = await fetchComToken("/funcionarios"); // Busca todos os funcionários
          
          // Verifica se há funcionários para criar o select
          if (funcionarios && funcionarios.length > 0) {
              const select = criarSelectFuncionario(funcionarios);

              // Substitui o input de nome pelo select
              const inputNomeFuncionario = document.querySelector("#nome");
              if (inputNomeFuncionario && inputNomeFuncionario.parentNode) {
                  inputNomeFuncionario.parentNode.replaceChild(select, inputNomeFuncionario);
              }

              // Esconde a label associada ao input de nome, se necessário
              const labelNomeFuncionario = document.querySelector('label[for="nome"]');
              if (labelNomeFuncionario) labelNomeFuncionario.style.display = "none";

              // Adiciona listener para carregar o funcionário selecionado
              select.addEventListener("change", async function () {
                  const nomeSelecionado = this.value?.trim();
                  if (!nomeSelecionado) return;

                  await carregarFuncionarioDescricao(nomeSelecionado, this);

                  // Após carregar, substitui o select de volta para um input de texto
                  const novoInput = document.createElement("input");
                  novoInput.type = "text";
                  novoInput.id = "nome"; // Mantém o ID
                  novoInput.name = "nome";
                  novoInput.required = true;
                  novoInput.className = "form";
                  novoInput.value = nomeSelecionado; // Preenche com o nome selecionado
                  novoInput.readOnly = true; // Torna o campo somente leitura após a seleção

                  
                  novoInput.addEventListener("blur", async function() {
                      
                  });

                  this.parentNode.replaceChild(novoInput, this);
                  if (labelNomeFuncionario) { // Reexibe e atualiza a label
                      labelNomeFuncionario.style.display = "block";
                      labelNomeFuncionario.textContent = "Nome do Funcionário";
                  }
              });
          } else {
              Swal.fire("Nenhum funcionário", "Nenhum funcionário encontrado para pesquisa.", "info");
          }

      } catch (error) {
          console.error("Erro ao carregar lista de funcionários:", error);
          Swal.fire({
              icon: 'error',
              title: 'Erro',
              text: 'Não foi possível carregar a lista de funcionários.',
              confirmButtonText: 'Ok'
          });
      }
    });

}


function adicionarEventoBlurFuncionario() {
    const input = document.querySelector("#nome");
    if (!input) return;

    input.addEventListener("blur", async function () {
        
        const botoesIgnorados = ["Limpar", "Pesquisar", "Enviar"];
        const ehBotaoIgnorado =
            ultimoClique?.id && botoesIgnorados.includes(ultimoClique.id) ||
             (ultimoClique?.classList && ultimoClique.classList.contains("close"));

        if (ehBotaoIgnorado) {
            console.log("🔁 Blur ignorado: clique em botão de controle (Fechar/Limpar/Pesquisar).");
            return;
        }

        const desc = this.value.trim();
        console.log("Campo nome procurado:", desc);

        if (!desc) return;

        try {
            await carregarEventoDescricao(desc, this);
            console.log("Funcionário selecionado depois de carregarFuncionarioDescricao:", this.value);
        } catch (error) {
            console.error("Erro ao buscar Funcionario:", error);
        }
    });
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
                const response = await fetchComToken(`/funcionarios/${idFuncionarios}`, {
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
        const response = await fetchComToken("/funcionarios", {
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

async function carregarFuncionarioDescricao(nome, elementoInputOuSelect) {
    try {
        const funcionario = await fetchComToken(`/funcionarios?nome=${encodeURIComponent(nome)}`);
        
        if (funcionario) {
            // Preenche os campos do formulário com os dados do funcionário
            idFuncionariosInput.value = funcionario.idfuncionarios || '';
            nomeFuncionarioInput.value = funcionario.nome || '';
            document.getElementById("perfil").value = funcionario.perfil || '';
            document.getElementById("linkFoto").value = funcionario.linkfoto || '';
            document.getElementById("cpf").value = funcionario.cpf || '';
            document.getElementById("rg").value = funcionario.rg || '';
            document.getElementById("nivelFluenciaLinguas").value = funcionario.nivelfluencialinguas || '';

            // Lógica para preencher o campo de idiomas adicionais (se for um JSON ou string)
            // Você precisará adaptar isso dependendo de como 'idiomasAdicionais' é gerenciado no seu HTML
            // Exemplo simples:
            document.getElementById("idiomasAdicionais").value = funcionario.idiomasadicionais ? JSON.stringify(funcionario.idiomasadicionais) : '';

            document.getElementById("celularPessoal").value = funcionario.celularpessoal || '';
            document.getElementById("celularFamiliar").value = funcionario.celularfamiliar || '';
            document.getElementById("email").value = funcionario.email || '';
            document.getElementById("site").value = funcionario.site || '';
            document.getElementById("banco").value = funcionario.banco || '';
            document.getElementById("codigoBanco").value = funcionario.codigobanco || '';
            document.getElementById("pix").value = funcionario.pix || '';
            document.getElementById("numeroConta").value = funcionario.numeroconta || '';
            document.getElementById("agencia").value = funcionario.agencia || '';
            document.getElementById("tipoConta").value = funcionario.tipoconta || '';
            document.getElementById("cep").value = funcionario.cep || '';
            document.getElementById("rua").value = funcionario.rua || '';
            document.getElementById("numero").value = funcionario.numero || '';
            document.getElementById("complemento").value = funcionario.complemento || '';
            document.getElementById("bairro").value = funcionario.bairro || '';
            document.getElementById("cidade").value = funcionario.cidade || '';
            document.getElementById("estado").value = funcionario.estado || '';
            document.getElementById("pais").value = funcionario.pais || '';

            // Armazena o estado original do funcionário para futuras comparações (PUT)
            funcionarioOriginal = { ...funcionario }; // Copia o objeto para não modificar o original

            // Lógica para rádio buttons de perfil
            const radioPerfilElements = document.querySelectorAll('input[name="radio"]');
            radioPerfilElements.forEach(radio => {
                if (radio.value === funcionario.perfil) {
                    radio.checked = true;
                } else {
                    radio.checked = false;
                }
            });

            // Lógica para select de nível de fluência (se "Linguas" é o ID correto)
            const selectLinguas = document.getElementById('Linguas'); // Verifique se 'Linguas' é o ID certo
            if (selectLinguas) {
                selectLinguas.value = funcionario.nivelfluencialinguas || '';
            }

            // Lógica para select de tipo de conta (se "TPconta" é o ID correto)
            const selectTipoConta = document.getElementById('TPconta'); // Verifique se 'TPconta' é o ID certo
            if (selectTipoConta) {
                selectTipoConta.value = funcionario.tipoconta || 'selecionado';
            }

            // Ativa os campos de formulário (se estiverem desativados após uma pesquisa)
            const formInputs = document.querySelectorAll('#formFuncionarios input, #formFuncionarios select, #formFuncionarios textarea');
            formInputs.forEach(input => input.removeAttribute('disabled'));

            Swal.fire("Sucesso", "Funcionário carregado com sucesso!", "success");
        } else {
            Swal.fire("Não encontrado", "Funcionário não encontrado.", "info");
            limparCamposFuncionarios(); // Limpa os campos se não encontrar
        }
    } catch (error) {
        console.error("Erro ao carregar funcionário por descrição:", error);
        Swal.fire("Erro", error.message || "Erro ao carregar funcionário.", "error");
        limparCamposFuncionarios();
    }
}

// --- Função auxiliar para criar o SELECT de funcionários ---
function criarSelectFuncionario(funcionarios) {
    const select = document.createElement("select");
    select.id = "nome"; // Usamos 'nome' como ID para manter a consistência
    select.name = "nome";
    select.className = "form";
    select.required = true;

    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "Selecione um funcionário...";
    defaultOption.disabled = true;
    defaultOption.selected = true;
    select.appendChild(defaultOption);

    funcionarios.forEach(funcionario => {
        const option = document.createElement("option");
        option.value = funcionario.nome; // O valor da opção será o nome para a busca
        option.textContent = funcionario.nome;
        option.setAttribute('data-id', funcionario.idfuncionarios); // Armazenar o ID no data-attribute
        select.appendChild(option);
    });

    return select;
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

  async function fetchComToken(url, options = {}) {
  console.log("URL da requisição:", url);
  const token = localStorage.getItem("token");
  const idempresa = localStorage.getItem("idempresa");

  console.log("ID da empresa no localStorage:", idempresa);
  console.log("Token no localStorage:", token);

  if (!options.headers) options.headers = {};
  
  if (options.body && typeof options.body === 'string' && options.body.startsWith('{')) {
        options.headers['Content-Type'] = 'application/json';
  }else if (options.body && typeof options.body === 'object' && options.headers['Content-Type'] !== 'multipart/form-data') {
       
        options.body = JSON.stringify(options.body);
        options.headers['Content-Type'] = 'application/json';
  }

  options.headers['Authorization'] = 'Bearer ' + token; 

  if (
      idempresa && 
      idempresa !== 'null' && 
      idempresa !== 'undefined' && 
      idempresa.trim() !== '' &&
      !isNaN(idempresa) && 
      Number(idempresa) > 0
  ) {
      options.headers['idempresa'] = idempresa;
      console.log('[fetchComToken] Enviando idempresa no header:', idempresa);
  } else {
    console.warn('[fetchComToken] idempresa inválido, não será enviado no header:', idempresa);
  }
  console.log("URL OPTIONS", url, options)
 
  const resposta = await fetch(url, options);

  console.log("Resposta da requisição:", resposta);

  let responseBody = null;
  try {     
      responseBody = await resposta.json();
  } catch (jsonError) {    
      try {
          responseBody = await resposta.text();
      } catch (textError) {        
          responseBody = null;
      }
  }

  if (resposta.status === 401) {
    localStorage.clear();
    Swal.fire({
      icon: "warning",
      title: "Sessão expirada",
      text: "Por favor, faça login novamente."
    }).then(() => {
      window.location.href = "login.html"; 
    });
   
    throw new Error('Sessão expirada'); 
  }

  if (!resposta.ok) {        
        const errorMessage = (responseBody && responseBody.erro) || (responseBody && responseBody.message) || responseBody || resposta.statusText;
        throw new Error(`Erro na requisição: ${errorMessage}`);
  }

  return responseBody;
}

function limparCamposFuncionarios(){
    const camposParaLimpar = [
        "idFuncionarios", 
        "nome", "cpf", "rg",
        "celularPessoal", "celularFamiliar", "email", "site",
        "Banco", "CodBanco", "Pix", "Nconta", "agencia",
        "cep", "rua", "numero", "complemento", "bairro",
        "cidade", "estado", "pais"
    ];

    // Limpa campos de texto e inputs de forma genérica
    camposParaLimpar.forEach(id => {
        const campo = document.getElementById(id);
        if (campo) {
            campo.value = "";
            // Remove a classe 'active' de labels para garantir que a UI volte ao estado inicial
            const label = document.querySelector(`label[for="${id}"]`);
            if (label) {
                label.classList.remove('active');
            }
        }
    });

    // --- Limpeza específica para Radio Buttons (Perfil) ---
    const radioPerfil = document.querySelectorAll('input[name="radio"]'); // Seleciona todos os rádios com name="radio"
    radioPerfil.forEach(radio => {
        radio.checked = false; // Desmarca cada radio button
    });

    // --- Limpeza específica para Selects ---
    const selectLinguas = document.getElementById('Linguas');
    if (selectLinguas) {
        selectLinguas.value = ""; // Define o valor para a opção "Selecione o nível de fluência" (assumindo value="" para ela)
        // Opcional: selectLinguas.selectedIndex = 0; // Se a primeira opção for sempre a de placeholder
    }

    const selectTipoConta = document.getElementById('TPconta');
    if (selectTipoConta) {
        selectTipoConta.value = "selecionado"; // Define o valor para a opção "Tipo de Conta" (assumindo value="selecionado" para ela)
        // Opcional: selectTipoConta.selectedIndex = 0; // Se a primeira opção for sempre a de placeholder
    }

    // --- Limpeza de campos de Idiomas gerados dinamicamente ---
    const idiomasContainer = document.getElementById('idiomasContainer');
    if (idiomasContainer) {
        idiomasContainer.innerHTML = ""; // Remove todos os campos filhos do container
    }

    // --- Limpeza do Preview de Foto ---
    const previewFoto = document.getElementById('previewFoto');
    const fileName = document.getElementById('fileName');
    const hiddenInputFoto = document.getElementById('linkFotoFuncionarios');
    const uploadHeader = document.getElementById('uploadHeader');
    const inputFile = document.getElementById('file');

    if (previewFoto) {
        previewFoto.src = "#";
        previewFoto.style.display = 'none'; // Esconde a pré-visualização
    }
    if (fileName) {
        fileName.textContent = 'Nenhum arquivo selecionado'; // Reseta o texto do nome do arquivo
    }
    if (hiddenInputFoto) {
        hiddenInputFoto.value = ''; // Limpa o valor do input hidden
    }
    if (uploadHeader) {
        uploadHeader.style.display = 'block'; // Mostra o cabeçalho de upload novamente
    }
    if (inputFile) {
        inputFile.value = ''; // Limpa o input de arquivo selecionado
    }

    
    // Garante que o campo "ativo" (checkbox) seja desmarcado se existir (não presente no seu HTML de funcionário)
    const campoAtivo = document.getElementById("ativo");
    if (campoAtivo && campoAtivo.type === "checkbox") {
        campoAtivo.checked = false;
    };

    
    const campoNome = document.querySelector("#nome");
    if (campoNome.tagName === "SELECT") {
        const input = document.createElement("input");
        input.type = "text";
        input.id = "nome";
        input.name = "nome";
        input.className = "form";
        input.value = "Nome"; 
        input.classList.add("uppercase");
        input.required = true;
        campoNomeFantasia.parentNode.replaceChild(input, campoNomeFantasia);
    }
}

 function configurarEventosFuncionarios() {
    console.log("Configurando eventos Funcionarios...");
    verificaFuncionarios(); // Carrega os Funcionarios ao abrir o modal
    configurarPreviewFoto();
    adicionarEventoBlurFuncionario();
   // inputFile.dataset.previewSet = "true"; // Evita configurar mais de uma vez
  }
  window.configurarEventosFuncionarios = configurarEventosFuncionarios;

  function configurarEventosEspecificos(modulo) {
  console.log("⚙️ configurarEventosEspecificos recebeu:", modulo);
  if (modulo.trim().toLowerCase() === 'funcionarios') {
    configurarEventosFuncionarios();
    
    if (typeof aplicarPermissoes === "function" && window.permissoes) {
      aplicarPermissoes(window.permissoes);
    } else {
      console.warn("⚠️ aplicarPermissoes ou window.permissoes ainda não estão disponíveis para LocalMontagem.");
    }
  }
}
window.configurarEventosEspecificos = configurarEventosEspecificos;