import { fetchComToken } from '../utils/utils.js';

let codBancoBlurListener = null;
let selectLinguasChangeListener = null;
let limparFuncionariosButtonListener = null;
let enviarFuncionariosButtonListener = null;
let pesquisarFuncionariosButtonListener = null;
let selectNomeFuncionarioChangeListener = null; 
let selectApelidoFuncionarioChangeListener = null; 
let inputNomeFuncionarioBlurListener = null; 
let inputApelidoFuncionarioBlurListener = null; 
let inputNomeFuncionarioInputListener = null; 
let inputApelidoFuncionarioInputListener = null; 

if (typeof window.funcionarioOriginal === "undefined") {
    window.funcionarioOriginal = {
        idfuncionario: "",
        perfil: "",
        nome: "",
        cpf: "",
        rg: "",
        nivelFluenciaLinguas: "", 
        idiomasAdicionais: "[]", 
        celularPessoal: "", 
        celularFamiliar: "", 
        email: "",
        site: "",
        codigoBanco: "", 
        pix: "",
        numeroConta: "", 
        digitoConta: "", 
        agencia: "",
        digitoAgencia: "", 
        tipoConta: "", 
        cep: "",
        rua: "",
        numero: "",
        complemento: "",
        bairro: "",
        cidade: "",
        estado: "",
        pais: "",
        dataNascimento:"",
        nomeFamiliar:"",
        apelido:"",
        pcd:""
    };
}


async function verificaFuncionarios() {
    console.log("Configurando eventos do modal Funcionários...");
    
    configurarPreviewFoto();

    const botaoEnviar = document.querySelector("#Enviar");
    const botaoPesquisar = document.querySelector("#Pesquisar");
    const botaoLimpar = document.querySelector("#Limpar");
    
    const form = document.querySelector("#form-funcionario");

    const codBancoInput = document.getElementById("codBanco");

    if (!botaoEnviar|| !form) {
        console.error("Formulário ou botão não encontrado no DOM.");
        return;
    }

    codBancoInput.addEventListener("blur", async function () {
        const codBanco = this.value.trim();
        if (!codBanco) {
            console.warn("Código do banco vazio, não fazendo busca.");
            return;
        }
        preencherDadosBancoPeloCodigo(codBanco);
    });

    const selectLinguas = document.getElementById('Linguas');
    if (selectLinguas) {
        selectLinguas.addEventListener('change', async function () {
            atualizarCamposLinguas(); 
        });        
    }

    botaoLimpar.addEventListener("click", (e) => {
        e.preventDefault();
        limparCamposFuncionarios();
    });

botaoEnviar.addEventListener("click", async (event) => {
    event.preventDefault();

    const idFuncionario = document.querySelector("#idFuncionario").value.trim();
    const perfil = document.querySelector('input[name="perfil"]:checked')?.value || '';
    const nome = document.querySelector("#nome")?.value.toUpperCase().trim();
    const cpf = document.getElementById("cpf")?.value.trim() || '';
    const rg = document.getElementById("rg")?.value.trim() || '';
    const nivelFluenciaLinguas = document.getElementById("Linguas")?.value.trim() || '';
    const inputsIdioma = idiomasContainer.querySelectorAll('.idiomaInput');
    const dataNascimento = document.getElementById("dataNasc").value;
    const nomeFamiliar = document.getElementById("nomeFamiliar")?.value.toUpperCase().trim();
    const apelido = document.getElementById("apelido")?.value.toUpperCase().trim();

    const idiomasAdicionaisArray = [];
    inputsIdioma.forEach(input => {
        const valor = input.value.trim();
        if (valor) idiomasAdicionaisArray.push(valor);
    });
    const idiomasAdicionais = JSON.stringify(idiomasAdicionaisArray);

    const celularPessoal = document.getElementById("celularPessoal")?.value.trim() || '';
    const celularFamiliar = document.getElementById("celularFamiliar")?.value.trim() || '';
    const email = document.getElementById("email")?.value.trim() || '';
    const site = document.getElementById("site")?.value.trim() || '';
    const codigoBanco = document.getElementById("codBanco")?.value.trim() || '';
    const pix = document.getElementById("pix")?.value.trim() || '';
    const numeroConta = document.getElementById("nConta")?.value.trim() || '';
    const digitoConta = document.getElementById("digitoConta")?.value.trim() || '';
    const agencia = document.getElementById("agencia")?.value.trim() || '';
    const digitoAgencia = document.getElementById("digitoAgencia")?.value.trim() || '';
    const tipoConta = document.getElementById("tpConta")?.value.trim() || '';
    const cep = document.getElementById("cep")?.value.trim() || '';
    const rua = document.getElementById("rua")?.value.trim() || '';
    const numero = document.getElementById("numero")?.value.trim() || '';
    const complemento = document.getElementById("complemento")?.value.trim() || '';
    const bairro = document.getElementById("bairro")?.value.toUpperCase().trim() || '';
    const cidade = document.getElementById("cidade")?.value.toUpperCase().trim() || '';
    const estado = document.getElementById("estado")?.value.toUpperCase().trim() || '';
    const pais = document.getElementById("pais")?.value.toUpperCase().trim() || '';

    const campoPcd = document.getElementById("pcd").value || "";
    const pcd = campoPcd?.checked === true;
     

        // Validação de campos obrigatórios
        // if (!nome || !cpf || !rg || !celularPessoal || !cep || !rua || !numero || !bairro || !cidade || !estado || !pais || !perfil || !celularFamiliar || !nomeFamiliar) {
        // console.log("VALIDACAO", "nome", nome, "cpf", cpf, "rg", rg, "celularPessoal", celularPessoal, "cep", cep,  "rua", rua,  "numero", numero, "bairro", bairro, "cidade", cidade, "estado", estado, "pais", pais, "perfil", perfil, "celularFamiliar", celularFamiliar, "nomeFamiliar", nomeFamiliar )
        //     return Swal.fire("Campos obrigatórios!", "Preencha todos os campos obrigatórios: Perfil, Nome, Data de Nascimento, CPF, RG, Celular Pessoal, Celular Contato, Nome do Contato, E-mail, CEP, Rua, Número, Bairro, Cidade, Estado e País.", "warning");
        // }
        
        if (!nome || !cpf || !rg || !celularPessoal || !perfil) {
        console.log("VALIDACAO", "nome", nome, "cpf", cpf, "rg", rg, "celularPessoal", celularPessoal, "cep", cep,  "rua", rua,  "numero", numero, "bairro", bairro, "cidade", cidade, "estado", estado, "pais", pais, "perfil", perfil, "celularFamiliar", celularFamiliar, "nomeFamiliar", nomeFamiliar, "apelido", apelido )
            return Swal.fire("Campos obrigatórios!", "Preencha todos os campos obrigatórios: Perfil, Nome, Data de Nascimento, CPF, RG, Celular Pessoal, Celular Contato, Nome do Contato, E-mail, CEP, Rua, Número, Bairro, Cidade, Estado e País.", "warning");
        }
        // Permissões
        const temPermissaoCadastrar = temPermissao("Funcionarios", "cadastrar");
        const temPermissaoAlterar = temPermissao("Funcionarios", "alterar");

        const metodo = idFuncionario ? "PUT" : "POST";
        const url = idFuncionario ? `/funcionarios/${idFuncionario}` : "/funcionarios";

        if (!idFuncionario && !temPermissaoCadastrar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para cadastrar novos funcionários.", "error");
        }

        if (idFuncionario && !temPermissaoAlterar) {
            return Swal.fire("Acesso negado", "Você não tem permissão para alterar funcionários.", "error");
        }

        console.log("Preparando dados para envio:", {
            perfil, nome, cpf, rg, nivelFluenciaLinguas, idiomasAdicionais,
            celularPessoal, celularFamiliar, email, site, codigoBanco, pix,
            numeroConta, digitoConta, agencia, digitoAgencia, tipoConta, cep, rua, 
            numero, complemento, bairro, cidade, estado, pais, dataNascimento, nomeFamiliar, apelido, pcd
        });
       // --- CRIANDO O FORMDATA ---
    const formData = new FormData();
    formData.append("perfil", perfil);
    formData.append("nome", nome);
    formData.append("cpf", cpf);
    formData.append("rg", rg);
    formData.append("nivelFluenciaLinguas", nivelFluenciaLinguas);
    formData.append("idiomasAdicionais", idiomasAdicionais);
    formData.append("celularPessoal", celularPessoal);
    formData.append("celularFamiliar", celularFamiliar);
    formData.append("email", email);
    formData.append("site", site);
    formData.append("codigoBanco", codigoBanco);
    formData.append("pix", pix);
    formData.append("numeroConta", numeroConta);
    formData.append("digitoConta", digitoConta);
    formData.append("agencia", agencia);
    formData.append("digitoAgencia", digitoAgencia);
    formData.append("tipoConta", tipoConta);
    formData.append("cep", cep);
    formData.append("rua", rua);
    formData.append("numero", numero);
    formData.append("complemento", complemento);
    formData.append("bairro", bairro);
    formData.append("cidade", cidade);
    formData.append("estado", estado);
    formData.append("pais", pais);
    formData.append("dataNascimento", dataNascimento);
    formData.append("nomeFamiliar", nomeFamiliar);
    formData.append("apelido", apelido);
    formData.append("pcd", pcd); // <- envia como string "true" ou "false"

        console.log("valor de pcd:", pcd);

        // Adiciona o arquivo da foto APENAS SE UM NOVO ARQUIVO FOI SELECIONADO
        const inputFileElement = document.getElementById('file');
        const fotoArquivo = inputFileElement.files[0];
        if (fotoArquivo) {
            formData.append('foto', fotoArquivo); // 'foto' é o nome do campo esperado pelo Multer
        }

        console.log("Preparando envio de FormData. Método:", metodo, "URL:", url);
        console.log("Dados do FormData:", {
            perfil, nome, cpf, rg, nivelFluenciaLinguas, idiomasAdicionais,
            celularPessoal, celularFamiliar, email, site, codigoBanco, pix,
            numeroConta, digitoConta, agencia, digitoAgencia, tipoConta, cep, rua, numero, complemento, bairro,
            cidade, estado, pais, dataNascimento, nomeFamiliar, apelido, pcd
        });
        if (metodo === "PUT" && window.funcionarioOriginal) {
            let houveAlteracao = false;

            // 1. Verificar alteração na foto
            if (fotoArquivo) { // Se um novo arquivo foi selecionado
                houveAlteracao = true;
            } else {
                // Se nenhum novo arquivo foi selecionado, verifique se a foto existente foi removida (se tiver uma lógica para isso)
                // ou se o link da foto no BD mudaria para null (se o frontend permitisse "deselecionar" a foto)
                // Por enquanto, vamos assumir que se não há novo arquivo, a foto antiga é mantida,
                // a menos que você adicione um botão "remover foto".
                // Para ser exato: se `funcionarioOriginal.foto` existe e `fotoArquivo` é nulo, mas o backend não apaga, não é alteração.
                // Se `funcionarioOriginal.foto` é nulo e `fotoArquivo` é nulo, não é alteração.
            }

            // 2. Comparar os outros campos de texto
            if (!houveAlteracao) { // Só verifica os outros campos se a foto não causou uma alteração
                const camposTextoParaComparar = {
                    perfil, nome, cpf, rg, nivelFluenciaLinguas, idiomasAdicionais,
                    celularPessoal, celularFamiliar, email, site, codigoBanco, pix,
                    numeroConta, digitoConta, agencia, digitoAgencia, tipoConta, cep, rua, numero, complemento, bairro,
                    cidade, estado, pais, dataNascimento, nomeFamiliar, apelido, pcd
                };

                for (const key in camposTextoParaComparar) {
                    // É importante que `funcionarioOriginal` tenha as chaves mapeadas para os nomes do frontend
                    // e que os valores sejam comparáveis (ex: ambos string, ambos uppercase se necessário).
                    const valorOriginal = String(window.funcionarioOriginal[key] || '').toUpperCase().trim();
                    const valorAtual = String(camposTextoParaComparar[key] || '').toUpperCase().trim();

                    if (key === 'idiomasAdicionais') {
                        try {
                            const oldParsed = JSON.parse(String(window.funcionarioOriginal.idiomasAdicionais || '[]'));
                            const newParsed = JSON.parse(String(idiomasAdicionais || '[]'));
                            // Ordena os arrays para comparação consistente
                            if (JSON.stringify(oldParsed.sort()) !== JSON.stringify(newParsed.sort())) {
                                houveAlteracao = true;
                                break;
                            }
                        } catch (e) {
                            // Fallback para comparação de string simples se o parse falhar
                            if (valorOriginal !== valorAtual) {
                                houveAlteracao = true;
                                break;
                            }
                        }
                    } else if (valorOriginal !== valorAtual) {
                        houveAlteracao = true;
                        break;
                    }
                }
            }

            if (!houveAlteracao) {
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

            // --- CHAMADA FETCH COM FORMDATA ---
            const respostaApi = await fetchComToken(url, {
                method: metodo,
                body: formData, // ENVIA O FORMDATA AQUI
                // O fetchComToken deve ser ajustado para NÃO adicionar Content-Type: application/json
                // quando o body é um FormData. O navegador cuida disso automaticamente.
            });

            await Swal.fire("Sucesso!", respostaApi.message || "Funcionário salvo com sucesso.", "success");
            limparCamposFuncionarios();
            window.funcionarioOriginal = null; // Reseta o estado original após sucesso

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

                   const campoApelido = document.querySelector("#apelido");
                        if (campoApelido.tagName === "SELECT") {
                            const input = document.createElement("input");
                            input.type = "text";
                            input.id = "apelido";
                            input.name = "apelido";
                            input.className = "form-2colunas";
                            input.value = "Apelido"; 
                            input.classList.add("uppercase");
                            input.required = true;
                            campoApelido.parentNode.replaceChild(input, campoApelido);
                        }
                         const labelApelido = document.querySelector('label[for="apelido"]');
                    if (labelApelido) {
                        labelApelido.style.display = "block";
                        labelApelido.textContent = "Apelido"; // ou algum texto que você tenha guardado
                    }

                  await carregarFuncionarioDescricao(nomeSelecionado, this);

                  // Após carregar, substitui o select de volta para um input de texto
                  const novoInput = document.createElement("input");
                  novoInput.type = "text";
                  novoInput.id = "nome"; // Mantém o ID
                  novoInput.name = "nome";
                  novoInput.required = true;
                  novoInput.className = "form-2colunas";
                  novoInput.classList.add('uppercase');
                  novoInput.value = nomeSelecionado; // Preenche com o nome selecionado
                 // novoInput.readOnly = true; // Torna o campo somente leitura após a seleção
                  
                  novoInput.addEventListener("blur", async function() {
                    this.value = this.value.toUpperCase();                      
                  });

                  this.parentNode.replaceChild(novoInput, this);
                  adicionarEventoBlurFuncionario();

                  const label = document.querySelector('label[for="nome"]');
                if (label) {
                    label.style.display = "block";
                    label.textContent = "Nome do Funcionário"; // ou algum texto que você tenha guardado
                }
                novoInput.addEventListener("blur", async function () {
                    if (!this.value.trim()) return;

                    const campoApelido = document.querySelector("#apelido");
                        if (campoApelido.tagName === "SELECT") {
                            const input = document.createElement("input");
                            input.type = "text";
                            input.id = "nome";
                            input.name = "nome";
                            input.className = "form-2colunas";
                            input.value = "Nome"; 
                            input.classList.add("uppercase");
                            input.required = true;
                            campoApelido.parentNode.replaceChild(input, campoApelido);
                        }
                         const labelApelido = document.querySelector('label[for="apelido"]');
                    if (labelApelido) {
                        labelApelido.style.display = "block";
                        labelApelido.textContent = "Apelido"; // ou algum texto que você tenha guardado
                    }

                    await carregarFuncionarioDescricao(this.value, this);
                });
              });
          } else {
              Swal.fire("Nenhum funcionário", "Nenhum funcionário encontrado para pesquisa.", "info");
          }

          if (funcionarios && funcionarios.length > 0) {
              const select = criarSelectApelido(funcionarios);

              // Substitui o input de nome pelo select
              const inputApelido = document.querySelector("#apelido");
              if (inputApelido && inputApelido.parentNode) {
                  inputApelido.parentNode.replaceChild(select, inputApelido);
              }

              // Esconde a label associada ao input de nome, se necessário
              const labelApelido = document.querySelector('label[for="apelido"]');
              if (labelApelido) labelApelido.style.display = "none";

              // Adiciona listener para carregar o funcionário selecionado
              select.addEventListener("change", async function () {
                  const apelidoSelecionado = this.value?.trim();
                const optionSelecionada = this.options[this.selectedIndex];
                const nomeSelecionado = optionSelecionada?.getAttribute("data-nome")?.trim();
                if (!apelidoSelecionado) return;
                  if (!apelidoSelecionado) return;


                     const campoNome = document.querySelector("#nome");
                        if (campoNome.tagName === "SELECT") {
                            const input = document.createElement("input");
                            input.type = "text";
                            input.id = "nome";
                            input.name = "nome";
                            input.className = "form-2colunas";
                            input.value = "Nome"; 
                            input.classList.add("uppercase");
                            input.required = true;
                            campoNome.parentNode.replaceChild(input, campoNome);
                        }
                         const labelnome = document.querySelector('label[for="nome"]');
                    if (labelnome) {
                        labelnome.style.display = "block";
                        labelnome.textContent = "Nome do Funcionário"; // ou algum texto que você tenha guardado
                    }

                  await carregarFuncionarioDescricao(nomeSelecionado, this);

                  // Após carregar, substitui o select de volta para um input de texto
                  const novoInput = document.createElement("input");
                  novoInput.type = "text";
                  novoInput.id = "apelido"; // Mantém o ID
                  novoInput.name = "apelido";
                  novoInput.required = true;
                  novoInput.className = "form-2colunas";
                  novoInput.classList.add('uppercase');
                  novoInput.value = apelidoSelecionado; // Preenche com o nome selecionado
                 // novoInput.readOnly = true; // Torna o campo somente leitura após a seleção
                  
                  novoInput.addEventListener("blur", async function() {
                    this.value = this.value.toUpperCase();                      
                  });

                  this.parentNode.replaceChild(novoInput, this);
                  adicionarEventoBlurFuncionario();

                  const label = document.querySelector('label[for="apelido"]');
                if (label) {
                    label.style.display = "block";
                    label.textContent = "Apelido"; // ou algum texto que você tenha guardado
                }
                novoInput.addEventListener("blur", async function () {
                    if (!this.value.trim()) return;
                    await carregarFuncionarioDescricao(this.value, this);
                });
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

function adicionarListenersAoInputNomeFuncionario(inputElement) {
    // Remove listeners anteriores para evitar duplicidade
    if (inputNomeFuncionarioInputListener) {
        inputElement.removeEventListener("input", inputNomeFuncionarioInputListener);
    }
    if (inputNomeFuncionarioBlurListener) {
        inputElement.removeEventListener("blur", inputNomeFuncionarioBlurListener);
    }

    inputNomeFuncionarioInputListener = function() {
        this.value = this.value.toUpperCase();
    };
    inputElement.addEventListener("input", inputNomeFuncionarioInputListener);

    inputNomeFuncionarioBlurListener = async function() {
        if (!this.value.trim()) return;
        await carregarFuncionarioDescricao(this.value); // Carrega pelo nome
    };
    inputElement.addEventListener("blur", inputNomeFuncionarioBlurListener);
}

function adicionarListenersAoInputApelidoFuncionario(inputElement) {
    // Remove listeners anteriores para evitar duplicidade
    if (inputApelidoFuncionarioInputListener) {
        inputElement.removeEventListener("input", inputApelidoFuncionarioInputListener);
    }
    if (inputApelidoFuncionarioBlurListener) {
        inputElement.removeEventListener("blur", inputApelidoFuncionarioBlurListener);
    }

    inputApelidoFuncionarioInputListener = function() {
        this.value = this.value.toUpperCase();
    };
    inputElement.addEventListener("input", inputApelidoFuncionarioInputListener);

    inputApelidoFuncionarioBlurListener = async function() {
        if (!this.value.trim()) return;
        // Se o blur do apelido deve carregar o funcionário, chame a função com o apelido
        // Pode ser necessário ajustar `carregarFuncionarioDescricao` para lidar com a busca por apelido
        await carregarFuncionarioDescricao(null, this.value); // Exemplo: Carrega pelo apelido
    };
    inputElement.addEventListener("blur", inputApelidoFuncionarioBlurListener);
}


function resetarCamposNomeApelidoParaInput() {
    const nomeCampo = document.getElementById("nome");
    if (nomeCampo && nomeCampo.tagName.toLowerCase() === "select") {
        const input = document.createElement("input");
        input.type = "text";
        input.id = "nome";
        input.name = "nome";
        input.value = "";
        input.placeholder = "Nome do Funcionário";
        input.className = "form-2colunas";
        input.classList.add('uppercase');
        input.required = true;
        nomeCampo.parentNode.replaceChild(input, nomeCampo);
        adicionarListenersAoInputNomeFuncionario(input);
        const label = document.querySelector('label[for="nome"]');
        if (label) label.style.display = "block";
    }

    const apelidoCampo = document.getElementById("apelido");
    if (apelidoCampo && apelidoCampo.tagName.toLowerCase() === "select") {
        const input = document.createElement("input");
        input.type = "text";
        input.id = "apelido";
        input.name = "apelido";
        input.value = "";
        input.placeholder = "Apelido";
        input.className = "form-2colunas";
        input.classList.add('uppercase');
        input.required = true;
        apelidoCampo.parentNode.replaceChild(input, apelidoCampo);
        adicionarListenersAoInputApelidoFuncionario(input);
        const label = document.querySelector('label[for="apelido"]');
        if (label) label.style.display = "block";
    }
}


// =============================================================================
// Função de Desinicialização do Módulo Funcionarios
// =============================================================================
function desinicializarFuncionariosModal() {
    console.log("🧹 Desinicializando módulo Funcionarios.js...");

    const botaoEnviar = document.querySelector("#Enviar");
    const botaoPesquisar = document.querySelector("#Pesquisar");
    const botaoLimpar = document.querySelector("#Limpar");
    const codBancoInput = document.getElementById("codBanco");
    const selectLinguas = document.getElementById('Linguas');
    const inputNomeFuncionario = document.getElementById("nome"); // Pode ser input ou select
    const inputApelido = document.getElementById("apelido"); // Pode ser input ou select


    // 1. Remover listeners de eventos dos elementos fixos
    if (codBancoInput && codBancoBlurListener) {
        codBancoInput.removeEventListener("blur", codBancoBlurListener);
        codBancoBlurListener = null;
        console.log("Listener de blur do codBanco removido.");
    }
    if (selectLinguas && selectLinguasChangeListener) {
        selectLinguas.removeEventListener("change", selectLinguasChangeListener);
        selectLinguasChangeListener = null;
        console.log("Listener de change do selectLinguas removido.");
    }
    if (botaoLimpar && limparFuncionariosButtonListener) {
        botaoLimpar.removeEventListener("click", limparFuncionariosButtonListener);
        limparFuncionariosButtonListener = null;
        console.log("Listener de click do Limpar (Funcionarios) removido.");
    }
    if (botaoEnviar && enviarFuncionariosButtonListener) {
        botaoEnviar.removeEventListener("click", enviarFuncionariosButtonListener);
        enviarFuncionariosButtonListener = null;
        console.log("Listener de click do Enviar (Funcionarios) removido.");
    }
    if (botaoPesquisar && pesquisarFuncionariosButtonListener) {
        botaoPesquisar.removeEventListener("click", pesquisarFuncionariosButtonListener);
        pesquisarFuncionariosButtonListener = null;
        console.log("Listener de click do Pesquisar (Funcionarios) removido.");
    }

    // 2. Remover listeners de elementos dinâmicos (#nome e #apelido)
    if (inputNomeFuncionario) {
        if (inputNomeFuncionario.tagName.toLowerCase() === "select" && selectNomeFuncionarioChangeListener) {
            inputNomeFuncionario.removeEventListener("change", selectNomeFuncionarioChangeListener);
            selectNomeFuncionarioChangeListener = null;
            console.log("Listener de change do select de nome de Funcionário removido.");
        }
        if (inputNomeFuncionario.tagName.toLowerCase() === "input") {
            if (inputNomeFuncionarioInputListener) {
                inputNomeFuncionario.removeEventListener("input", inputNomeFuncionarioInputListener);
                inputNomeFuncionarioInputListener = null;
                console.log("Listener de input do nome de Funcionário (input) removido.");
            }
            if (inputNomeFuncionarioBlurListener) {
                inputNomeFuncionario.removeEventListener("blur", inputNomeFuncionarioBlurListener);
                inputNomeFuncionarioBlurListener = null;
                console.log("Listener de blur do nome de Funcionário (input) removido.");
            }
        }
    }

    if (inputApelido) {
        if (inputApelido.tagName.toLowerCase() === "select" && selectApelidoFuncionarioChangeListener) {
            inputApelido.removeEventListener("change", selectApelidoFuncionarioChangeListener);
            selectApelidoFuncionarioChangeListener = null;
            console.log("Listener de change do select de apelido de Funcionário removido.");
        }
        if (inputApelido.tagName.toLowerCase() === "input") {
            if (inputApelidoFuncionarioInputListener) {
                inputApelido.removeEventListener("input", inputApelidoFuncionarioInputListener);
                inputApelidoFuncionarioInputListener = null;
                console.log("Listener de input do apelido de Funcionário (input) removido.");
            }
            if (inputApelidoFuncionarioBlurListener) {
                inputApelido.removeEventListener("blur", inputApelidoFuncionarioBlurListener);
                inputApelidoFuncionarioBlurListener = null;
                console.log("Listener de blur do apelido de Funcionário (input) removido.");
            }
        }
    }

    // Lógica para desinicializar 'configurarPreviewFoto()' se ela adicionar listeners
    // Isso depende de como 'configurarPreviewFoto()' é implementada.
    // Se ela adicionar um listener ao 'file' input, você precisaria de uma variável 'let' para isso.
    // Ex: if (inputFileElement && previewFotoChangeListener) { inputFileElement.removeEventListener('change', previewFotoChangeListener); }


    // 3. Limpar o estado global e campos do formulário
    window.funcionarioOriginal = null; // Zera o objeto de funcionário original
    limparCamposFuncionarios(); // Limpa todos os campos visíveis do formulário
   // document.querySelector("#form-funcionario").reset(); // Garante que o formulário seja completamente resetado
    document.querySelector("#idFuncionario").value = ""; // Limpa o ID oculto
    resetarCamposNomeApelidoParaInput(); // Garante que nome e apelido voltem a ser inputs padrão

    console.log("✅ Módulo Funcionarios.js desinicializado.");
}


if (!window.ultimoClique) {
    window.ultimoClique = null;
  
}
// Captura o último elemento clicado no documento (uma única vez)
document.addEventListener("mousedown", (e) => {
    window.ultimoClique = e.target;
});

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
            await carregarFuncionarioDescricao(desc, this);
            console.log("Funcionário selecionado depois de carregarFuncionariosDescricao:", this.value);
        } catch (error) {
            console.error("Erro ao buscar Funcionario:", error);
        }
    });
}


async function salvarFuncionario(dados) {
  const idFuncionario = document.querySelector("#idFuncionario").value;

  if (idFuncionario) {
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
                const response = await fetchComToken(`/funcionarios/${idFuncionario}`, {
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
            document.querySelector("#idFuncionario").value = "";
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
        document.querySelector("#idFuncionario").value = "";
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

function configurarPreviewFoto() {
  const inputFile = document.getElementById('file');
  const preview = document.getElementById('previewFoto');
  const fileName = document.getElementById('fileName');
  //const hiddenInput = document.getElementById('linkFotoFuncionarios');
  const header = document.getElementById('uploadHeader');

  if (!inputFile || !preview || !fileName || !header) {
    console.warn("Elementos do preview não encontrados.");
    return;
  }

  inputFile.addEventListener('change', function () {
    const file = inputFile.files[0];

    if (!file) {
      // Nenhum arquivo selecionado
      previewFoto.src = '#';
      preview.style.display = 'none';
      header.style.display = 'block';
      fileName.textContent = 'Nenhum arquivo selecionado';
      hiddenInput.value = '';
      return;
    }

    if (!file.type.startsWith('image/')) {
      Swal.fire('Arquivo inválido', 'Selecione uma imagem válida.', 'warning');
      inputFile.value = '';
      preview.src = '#';
      preview.style.display = 'none';
      header.style.display = 'block';
      fileName.textContent = 'Nenhum arquivo selecionado';
    //  hiddenInput.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
      preview.src = e.target.result;
      preview.style.display = 'block';
      header.style.display = 'none';
      fileName.textContent = file.name;
      //hiddenInput.value = e.target.result;
    };
    reader.readAsDataURL(file);
    console.log("pegou a imagem do ", fileNameImg)
  });
}

async function carregarFuncionarioDescricao(nome, elementoInputOuSelect) {
    try {
        console.log("nome:", nome);
        const funcionario = await fetchComToken(`/funcionarios?nome=${encodeURIComponent(nome)}`);
        
        if (funcionario) {

            //window.funcionarioOriginal = { ...funcionario }; // Salva o estado original
            document.getElementById("idFuncionario").value = funcionario.idfuncionario || '';
            document.getElementById("nome").value = funcionario.nome || '';
            document.getElementById("apelido").value = funcionario.apelido || '';
            console.log("Apelido:", apelido);

            const checkboxPcd = document.getElementById("pcd");
            checkboxPcd.checked = funcionario.pcd === true;

            const radiosPerfil = document.querySelectorAll('input[name="perfil"]'); // Ou input[name="radio"] se você não mudou o name
            radiosPerfil.forEach(radio => {
                if (radio.value === funcionario.perfil) {
                    radio.checked = true;
                } else {
                    radio.checked = false; // Desmarcar outros, caso haja
                }
            });

            const previewFoto = document.getElementById('previewFoto'); // ID da sua tag <img>
            const fileNameSpan = document.getElementById('fileName');       // ID do span/p que mostra o nome do arquivo
            const uploadHeader = document.getElementById('uploadHeader');

            if (funcionario.foto) {
                
                previewFoto.src = `/${funcionario.foto}`;
                previewFoto.style.display = 'block'; 
                uploadHeader.style.display = 'none';              
                fileNameSpan.textContent = funcionario.foto.split('/').pop() || 'Foto carregada';
            } else {
               
                previewFoto.src = '#'; 
                previewFoto.style.display = 'none'; 
                uploadHeader.style.display = 'block'; 
                fileNameSpan.textContent = 'Nenhum arquivo selecionado'; 
            }

           
            document.getElementById("cpf").value = funcionario.cpf || '';
            document.getElementById("rg").value = funcionario.rg || '';
            document.getElementById("Linguas").value = funcionario.fluencia || '';
            console.log("Linguas recebidas:", funcionario.fluencia);
            atualizarCamposLinguas();
            console.log("Linguas atualizadas");
           // document.getElementById("idiomasContainer").value = funcionario.idiomasadicionais ? JSON.stringify(funcionario.idiomasadicionais) : '';

            if (funcionario.idiomasadicionais) {
                try {
                    const idiomasSalvos = JSON.parse(funcionario.idiomasadicionais);
                    const inputsIdioma = document.querySelectorAll('#idiomasContainer .idiomaInput'); // Pega os inputs recém-gerados

                    // Percorre os inputs e preenche com os idiomas salvos
                    inputsIdioma.forEach((input, index) => {
                        if (idiomasSalvos[index]) {
                            input.value = idiomasSalvos[index];
                        }
                    });
                } catch (e) {
                    console.error("Erro ao fazer parse dos idiomas salvos:", e);
                }
            }

            console.log("Dados recebidos no Back:", funcionario);

document.getElementById("dataNasc").value = funcionario.datanascimento?.split('T')[0] || '';
console.log("dataNascimento recebida:", funcionario.datanascimento);

document.getElementById("celularPessoal").value = funcionario.celularpessoal || '';
document.getElementById("celularFamiliar").value = funcionario.celularfamiliar || '';
document.getElementById("email").value = funcionario.email || '';
document.getElementById("site").value = funcionario.site || '';

document.getElementById("codBanco").value = funcionario.codigobanco || '';
const inputCodBanco = document.getElementById("codBanco");
if (inputCodBanco) {
    console.log("[Funcionarios.js] Elemento 'codigobanco' encontrado no DOM. Preenchendo automaticamente o banco.");
    preencherDadosBancoPeloCodigo();
} else {
    console.warn("[Funcionarios.js] Elemento 'codigobanco' não encontrado no DOM.");
}

document.getElementById("pix").value = funcionario.pix || '';
document.getElementById("agencia").value = funcionario.agencia || '';
document.getElementById("digitoAgencia").value = funcionario.digitoagencia || '';
document.getElementById("nConta").value = funcionario.numeroconta || '';
document.getElementById("digitoConta").value = funcionario.digitoconta || '';

const selectTipoConta = document.getElementById('tpConta');
if (selectTipoConta) {
    selectTipoConta.value = funcionario.tipoconta || 'selecionado';
}

document.getElementById("cep").value = funcionario.cep || '';
document.getElementById("rua").value = funcionario.rua || '';
document.getElementById("numero").value = funcionario.numero || '';
document.getElementById("complemento").value = funcionario.complemento || '';
document.getElementById("bairro").value = funcionario.bairro || '';
document.getElementById("cidade").value = funcionario.cidade || '';
document.getElementById("estado").value = funcionario.estado || '';
document.getElementById("pais").value = funcionario.pais || '';

document.getElementById("nomeFamiliar").value = funcionario.nomefamiliar || '';
document.getElementById("apelido").value = funcionario.apelido || '';
console.log("nomeFamiliar recebido:", funcionario.nomefamiliar);

// Armazena o estado original, se necessário
window.funcionarioOriginal = { ...funcionario };
           
            const selectLinguas = document.getElementById('Linguas'); 
            if (selectLinguas) {
                selectLinguas.value = funcionario.fluencia || '';
            }            
           
            const formInputs = document.querySelectorAll('#formFuncionarios input, #formFuncionarios select, #formFuncionarios textarea');
            formInputs.forEach(input => input.removeAttribute('disabled'));            
         } 
    } catch (error) {
       console.warn("Funcionário não encontrado.");

        const inputIdFuncionario = document.querySelector("#idFuncionario");
        const podeCadastrarFuncionario = temPermissao("Funcionarios", "cadastrar");

        console.log("Verificando se pode cadastrar funcionário:", podeCadastrarFuncionario, inputIdFuncionario.value);
       if (!inputIdFuncionario.value && podeCadastrarFuncionario) {
             const resultado = await Swal.fire({
                icon: 'question',
                title: `Deseja cadastrar "${nome.toUpperCase()}" como novo Funcionário?`,
                text: `Funcionário "${nome.toUpperCase()}" não encontrado.`,
                showCancelButton: true,
                confirmButtonText: "Sim, cadastrar",
                cancelButtonText: "Cancelar",
                reverseButtons: true,
                focusCancel: true
            });

            
            if (!resultado.isConfirmed) {
                console.log("Usuário cancelou o cadastro do Funcionário.");
                elementoAtual.value = ""; // Limpa o campo se não for cadastrar
                setTimeout(() => {
                    elementoAtual.focus();
                }, 0);
                return;
            }
        } else if (!podeCadastrarFuncionario) {
            Swal.fire({
                icon: "info",
                title: "Funcionário não cadastrado",
                text: "Você não tem permissão para cadastrar funcionários.",
                confirmButtonText: "OK"
            });
        }       
    }
}

async function preencherDadosBancoPeloCodigo() {
 
    const codBancoInput = document.getElementById('codBanco');
  
    if (!codBancoInput) {
        console.warn("Elemento 'inputBanco' (nome do banco) não encontrado no DOM do modal de Funcionários.");
        return;
    }

    if (!codBancoInput.value) {       
        codBancoInput.value = '';
        return;
    }    

    try {
        const codBanco = document.getElementById("codBanco").value;
        const url = `/bancos?codBanco=${encodeURIComponent(codBanco)}`;
        const nomeBanco = await fetchComToken(url);            
        
        if (nomeBanco && nomeBanco.codbanco) { 
            document.getElementById("banco").value = nomeBanco.nmbanco;        
        } else {        
    
            Swal.fire({
                icon: 'info',
                title: 'Banco não encontrado',
                text: `Nenhum banco encontrado com o código '${codBanco}'.`,
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000
            });           
        }
    } catch (error) {        
           
        if (error.message !== 'Sessão expirada') {
            Swal.fire({
                icon: 'error',
                title: 'Erro de busca de banco',
                text: 'Não foi possível buscar as informações do banco. Verifique o código e tente novamente.',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000
            });
        }
    }
}

// --- Função auxiliar para criar o SELECT de funcionários ---
function criarSelectFuncionario(funcionarios) {
    const select = document.createElement("select");
    select.id = "nome"; // Usamos 'nome' como ID para manter a consistência
    select.name = "nome";
    select.className = "form-2colunas";
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
        option.setAttribute('data-id', funcionario.idFuncionario); // Armazenar o ID no data-attribute
        select.appendChild(option);
    });
    
    return select;
}
function criarSelectApelido(funcionarios) {
    const select = document.createElement("select");
    select.id = "apelido"; // Usamos 'nome' como ID para manter a consistência
    select.name = "apelido";
    select.className = "form-2colunas";
    select.required = true;

    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "Selecione um apelido...";
    defaultOption.disabled = true;
    defaultOption.selected = true;
    select.appendChild(defaultOption);

    funcionarios.forEach(funcionario => {
        const option = document.createElement("option");
        option.value = funcionario.apelido; // O valor da opção será o nome para a busca
        option.textContent = funcionario.apelido;
        option.setAttribute('data-id', funcionario.idFuncionario); // Armazenar o ID no data-attribute
        option.setAttribute('data-nome', funcionario.nome); 
        select.appendChild(option);
    });

    return select;
}


function atualizarCamposLinguas() {
  const select = document.getElementById('Linguas');
  const container = document.getElementById('idiomasContainer');
  const selectFluencia = select.value;
  let valor = "";

  switch (selectFluencia) {
    case "Monolingue":
        valor = "1";
        break; 
    case "Bilingue":
        valor = "2";
        break;
    case "Trilingue":
        valor = "3";
        break;
    case "Poliglota":
        valor = "custom";
        break;
    default:        
        valor = ""; 
        break;
}
  container.innerHTML = ""; // Limpa campos anteriores

if (valor === "") return;

// Sempre adiciona o campo "Português"
const inputPT = document.createElement("input");
inputPT.type = "text";
inputPT.value = "Português";
inputPT.disabled = true;
inputPT.className = "idiomaInput";
// inputPT.style.marginBottom = "5px";
inputPT.style.width = "100px";
container.appendChild(inputPT);

  if (valor === "1") {
    return; // Monolíngue
  }

  console.log("QTD LINGUAS", valor);

if (valor === "2" || valor === "3") {
const qtd = parseInt(valor) - 1;
for (let i = 1; i <= qtd; i++) {
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = `Idioma ${i + 1}`;
    input.name = `idioma${i + 1}`;
    input.className = "idiomaInput";
    input.style.width = "100px";

    container.appendChild(input);
}
} else if (valor === "custom") {
const grupo = document.createElement("div");
grupo.style.display = "flex";
grupo.style.flexDirection = "column";
grupo.style.alignItems = "center";
    grupo.style.width = "100px";
    grupo.style.marginLeft = "50px";


const label = document.createElement("p");
label.textContent = "Quantos idiomas (incluindo Português)?";
label.style.fontSize = "15px";
label.style.marginleft = "150px";
label.style.padding = "0";
label.style.lineHeight = "1.2";
label.style.width = "300px";

const inputQtd = document.createElement("input");
inputQtd.type = "number";
inputQtd.min = 4;
inputQtd.placeholder = "Min: 4";
    inputQtd.style.width = "100px";


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


function limparCamposFuncionarios(){
    const camposParaLimpar = [
        "idFuncionario", "nome", "cpf", "rg",
        "celularPessoal", "celularFamiliar", "email", "site",
        "banco", "codBanco", "pix", "nConta", "digitoConta",
        "agencia", "digitoAgencia", "dataNasc", "tpConta",
        "cep", "rua", "numero", "complemento", "bairro",
        "cidade", "estado", "pais", "nomeFamiliar", "apelido"
    ];

    const campoPcd = document.getElementById("pcd");
    if (campoPcd && campoPcd.type === "checkbox") {
        campoPcd.checked = false; // ou true dependendo do trecho
    }
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
    const radioPerfil = document.querySelectorAll('input[name="perfil"]'); // Seleciona todos os rádios com name="perfil"
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
        campoNome.parentNode.replaceChild(input, campoNome);
    }
    
    const campoApelido = document.querySelector("#apelido");
    if (campoApelido.tagName === "SELECT") {
        const input = document.createElement("input");
        input.type = "text";
        input.id = "apelido";
        input.name = "apelido";
        input.className = "form";
        input.value = "Nome"; 
        input.classList.add("uppercase");
        input.required = true;
        campoApelido.parentNode.replaceChild(input, campoApelido);
    }
}

 function configurarEventosFuncionarios() {
    console.log("Configurando eventos Funcionarios...");
    verificaFuncionarios(); // Carrega os Funcionarios ao abrir o modal
    configurarPreviewFoto();
    atualizarCamposLinguas();
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

window.moduloHandlers = window.moduloHandlers || {};

window.moduloHandlers['Funcionarios'] = { // A chave 'Funcionarios' (com F maiúsculo) deve corresponder ao seu Index.js
    configurar: configurarEventosFuncionarios,
    desinicializar: desinicializarFuncionariosModal
};