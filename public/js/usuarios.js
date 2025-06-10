let empresasOriginais = []; // Variável global para armazenar as empresas originais

document.getElementById("Registrar").addEventListener("submit", async function (e) {
    e.preventDefault();
  
    const nome = document.getElementById("nome").value;
    const sobrenome = document.getElementById("sobrenome").value;
    const email = document.getElementById("email").value;
    const senha = document.getElementById("senha").value;
    const ativo = document.getElementById('ativo').checked;
    const idempresaDefault = document.getElementById("empresaDefaultSelect").value;

    console.log("ID EMPRESA DEFAULT SELECT", idempresaDefault);
    // Captura empresas selecionadas (checkboxes)
    // const empresasSelecionadas = Array.from(document.querySelectorAll('#listaEmpresas input[type="checkbox"]:checked'))
    // .map(cb => cb.value);
   // const empresaSelecionada = document.getElementById("listaEmpresas").value;

    const confirmacaoSenha = document.getElementById("confirmasenha").value;

    // Validação básica
    if (!nome || !sobrenome || !email || !senha || !confirmacaoSenha) {
      return Swal.fire({
        icon: "warning",
        title: "Atenção",
        text: "Todos os campos devem ser preenchidos."
      });
    }


    if (senha !== confirmacaoSenha) {
        Swal.fire({
          icon: 'error',
          title: 'Erro',
          text: 'As senhas não coincidem.',
      });
      return;
    }

    // if (empresasSelecionadas.length === 0) {
    //   return Swal.fire({
    //     icon: "warning",
    //     title: "Atenção",
    //     text: "Selecione pelo menos uma empresa."
    //   });
    // }
    
    try {
      const resposta = await fetchComToken("/auth/cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // body: JSON.stringify({ nome, email, senha, sobrenome, ativo, empresas: empresasSelecionadas })
        body: JSON.stringify({ nome, email, senha, sobrenome, ativo, idempresadefault: idempresaDefault })
      });
  
      const dados = await resposta.json();
      console.log(dados);
  
      
      if (!dados || dados.erro) {
      return Swal.fire({
        icon: "error",
        title: "Erro",
        text: dados.erro || "Erro ao cadastrar."
      });
    }

    Swal.fire({
      icon: "success",
      title: "Sucesso",
      text: "Usuário cadastrado com sucesso!"
    });
  
      // limpa o formulário
      document.getElementById("Registrar").reset();
      document.getElementById("btnAlterar").style.display = "none";  // Esconde o botão de alterar após cadastro
  
    } catch (erro) {
      console.error("Erro na requisição:", erro);
      Swal.fire({
        icon: "error",
        title: "Erro inesperado",
        text: "Não foi possível completar o cadastro."
      });
    }
});
  
document.getElementById("confirmasenha").addEventListener("blur", function () {
    const senha = document.getElementById("senha").value;
    const confirmacaoSenha = document.getElementById("confirmasenha").value;
  
    if (senha && confirmacaoSenha && senha !== confirmacaoSenha) {
      Swal.fire({
        icon: 'warning',
        title: 'Atenção',
        text: 'As senhas não coincidem. Digite novamente.',
      });
      document.getElementById("senha").value = "";
      document.getElementById("confirmasenha").value = "";
      document.getElementById("senha").focus();
  
      return;
    }
});

  // Lógica para o botão "Alterar"
document.getElementById("btnAlterar").addEventListener("click", async function (e) {
  e.preventDefault();

  const nome = document.getElementById("nome").value;
  const sobrenome = document.getElementById("sobrenome").value;
  const email = document.getElementById("email").value;
  const senha = document.getElementById("senha").value;
  const confirmacaoSenha = document.getElementById("confirmasenha").value;
  const email_original = document.getElementById("email_original").value;
  const ativo = document.getElementById('ativo').checked;
  const idempresaDefault = document.getElementById("empresaDefaultSelect").value;

  // const empresasSelecionadas = Array.from(document.querySelectorAll('#listaEmpresas input[type="checkbox"]:checked'))
  //   .map(cb => cb.value);


  if (!nome || !sobrenome || !email || !idempresaDefault ) {
    Swal.fire({
      icon: 'warning',
      title: 'Atenção',
      text: 'Campos: Nome, Sobrenome, email e Empresa Default, devem ser preenchidos.',
    });
    return;
  }
  // Verifica se as senhas coincidem
  if (senha !== confirmacaoSenha) {
    Swal.fire({
      icon: 'error',
      title: 'Erro',
      text: 'As senhas não coincidem.',
    });
    return;
  }

 
 
  try {
     console.log("ENTROU NO TRY", nome, sobrenome, email, senha, idempresaDefault);
   
    const dados = await fetchComToken("/auth/cadastro", {
      method: "PUT",  // Mudamos para PUT para indicar alteração
      headers: { "Content-Type": "application/json" },
      // body: JSON.stringify({ nome, sobrenome, email, senha, email_original, ativo, empresas: empresasSelecionadas }),
      body: JSON.stringify({ nome, sobrenome, email, senha, email_original, ativo, idempresadefault: idempresaDefault }),

    });
 

    //const dados = await resposta.json();
    console.log("DADOS ALTERADOS", dados);

    console.log("Dados Mensagem", dados.mensagem);

    //testar 
   //const mensagem = dados.mensagem || "Usuário atualizado com sucesso!";

    // Swal.fire({
    //   icon: dados.mensagem === "Nenhuma alteração detectada no Usuário." ? "info" : "success",
    //   title: dados.mensagem === "Nenhuma alteração detectada no Usuário." ? "Aviso" : "Sucesso",
    //   text: mensagem
    // }).then((result) => {
    //   if (result.isConfirmed) flipBox();
    // });

    if (dados.erro) {
      Swal.fire({
        icon: "error",
        title: "Erro",
        text: dados.erro
      });
    } else {
      const mensagem = dados.mensagem;
      const isSemAlteracao = mensagem === "Nenhuma alteração detectada no Usuário.";

      Swal.fire({
        icon: isSemAlteracao ? "info" : "success",
        title: isSemAlteracao ? "Aviso" : "Sucesso",
        text: mensagem
      }).then((result) => {
        if (result.isConfirmed) flipBox();
      });
    }

    
    limparCampos(); // Limpa os campos do formulário após a atualização
    console.log("Chamando FlipBox");
  

  } catch (erro) {
    console.error("Erro na requisição:", erro);
    Swal.fire({
      icon: 'error',
      title: 'Erro inesperado',
      text: 'Não foi possível completar a ação.'
    });
  }
});

 document.getElementById("email").addEventListener("blur", function () { 
  // const emailValue = email.value;
//   console.log("Verificando email:", emailValue);
  // const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  //   if (!emailRegex.test(email)) {
  //     return Swal.fire({
  //       icon: "warning",
  //       title: "Email inválido",
  //       text: "Digite um email válido."
  //     });
  //   }
  
//   if (emailValue) {
//     verificarUsuarioExistenteFront();
//   }
});

let clicouNaLista = false; // Flag de clique

document.getElementById('buscaUsuario').addEventListener('blur', function () {
  
  formatarNome("buscaUsuario");

  setTimeout(() => {
    if (!clicouNaLista) {
      verificarNomeExistente();
    }
    // Reseta a flag para próxima interação
    clicouNaLista = false;
  }, 150);
  
});

document.getElementById("nome").addEventListener("blur", function () {
  formatarNome("nome");
  verificarUsuarioExistenteFront();
});
  
document.getElementById("sobrenome").addEventListener("blur", function () {
  formatarNome("sobrenome");
  const nome = document.getElementById("nome").value.trim();
  const sobrenome = document.getElementById("sobrenome").value.trim();
  const email = document.getElementById("email").value.trim();

  console.log("Entrou no verificarNomeCompleto","nome:", nome, "sobrenome:", sobrenome, "email:", email);
   if (nome && sobrenome && !email) {
    console.log("Entrou no verificarNomeCompleto2");
     verificarNomeCompleto();
   }

  //verificarUsuarioExistenteFront();
});

document.getElementById("email").addEventListener("blur", function (){
  // if (!buscaUsuario){
    verificarUsuarioExistenteFront();
 //  }
    
});

document.getElementById("buscaUsuario").addEventListener("input", function () {
  const valor = this.value.trim();

  if (valor === "") {
    // Limpa campos relacionados ao usuário
    limparCampos();
  }
});


 const getCampo = (key) => document.querySelector(campos[key]);
    const setCampo = (key, value) => {
        const campo = getCampo(key);
        if (campo) {
            if (campo.type === "checkbox") {
                campo.checked = value === true || value === "true" || value === 1;
            } else {
                campo.value = value ?? "";
            }
        }
    };



async function verificarUsuarioExistenteFront() {
  const buscaUsuario = document.getElementById('buscaUsuario').value.trim();
  const nome = document.getElementById("nome").value.trim();
  const sobrenome = document.getElementById("sobrenome").value.trim();
  const email = document.getElementById("email").value.trim();
  const ativo = document.getElementById('ativo').checked;
  const idempresaDefault = document.getElementById("empresaDefaultSelect").value;

  console.log("Entrou no verificarUsuarioExistenteFront", nome, sobrenome, email, ativo, idempresaDefault);

  if (!nome || !sobrenome || !email) {
    return; // Só verifica se os três estiverem preenchidos
  } 
  
  try {
    
    const resposta = await fetchComToken("/auth/verificarUsuario", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, sobrenome, email, ativo, idempresaDefault: idempresaDefault, empresas: empresasSelecionadas }) // Envia idempresaDefault e empresas como array vazio,
    });

    const dados = await resposta.json();

    if (dados.usuarioExistente) {
      if (dados.usuarioExistente.ativo) {
        // Usuário ativo → só pode alterar
        document.getElementById("btnCadastrar").style.display = "none";
        document.getElementById("btnAlterar").style.display = "inline-block";

        Swal.fire({
          icon: "info",
          title: "Usuário já cadastrado",
          text: "Você pode atualizar os dados existentes."
        });
      } else {
        // Usuário inativo → permitir reativação ou novo cadastro
        document.getElementById("btnCadastrar").style.display = "inline-block";
        document.getElementById("btnAlterar").style.display = "inline-block";

        Swal.fire({
          icon: "warning",
          title: "Usuário inativo encontrado",
          text: "Você pode cadastrar novamente ou reativar este usuário."
        });
      }
    } else {
      // Usuário não existe → cadastro permitido
      document.getElementById("btnCadastrar").style.display = "inline-block";
      document.getElementById("btnAlterar").style.display = "none";
      
      Swal.fire({
        icon: "info",
        title: "Usuário não cadastrado",
        text: "Nenhum usuário foi encontrado com esses dados. Você pode cadastrá-lo agora."
      });
    }

  } catch (erro) {
    console.error("Erro ao verificar usuário:", erro);
  }
}

// Função para a busca simples pelo nome + sobrenome (ex: ao sair do campo)
async function verificarNomeExistente() {
  const nome = document.getElementById("buscaUsuario").value.trim();
  const sobrenome = document.getElementById("sobrenome").value.trim();

  if (!nome) return;  // Sem nome? nada a fazer

  if (clicouNaLista) {
    clicouNaLista = false;
    return;  // Seleção manual da lista, não mostrar alertas
  }

  if (sobrenome !== "") return;  // Usuário já digitou sobrenome, pular alerta


  try {
    const resposta = await fetchComToken("/auth/verificarNomeExistente", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome }),
    });

    const dados = await resposta.json();

    if (dados.nomeEncontrado) {
      // Se o sobrenome já está preenchido, não mostra a mensagem aqui

      if (!sobrenome) {
        Swal.fire({
          icon: "info",
          title: "Nome encontrado",
          text: "Digite também o sobrenome para refinar a busca.",
        }).then(() => {
           document.getElementById("nome").value = nome;
           document.getElementById("sobrenome").focus();
          
        });
      }
    } else {
      const confirmacao = await Swal.fire({
        icon: "question",
        title: "Usuário não encontrado",
        text: "Deseja cadastrar um novo usuário com esse nome?",
        showCancelButton: true,
        confirmButtonText: "Sim, cadastrar",
        cancelButtonText: "Cancelar"
      });

      if (confirmacao.isConfirmed) {
        document.getElementById("btnCadastrar").style.display = "inline-block";
        document.getElementById("btnAlterar").style.display = "none";
      }
    }

  } catch (erro) {
    //console.error("Erro na busca por nome:", erro); // verificar se funciona com isso comentado
  }
}


async function verificarNomeCompleto() {
  const nome = document.getElementById("buscaUsuario").value.trim();
  const sobrenome = document.getElementById("sobrenome").value.trim();
  
  if (!nome || !sobrenome) return;

  try {
    const resposta = await fetchComToken("/auth/verificarNomeCompleto", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, sobrenome }),
    });

    const dados = await resposta.json();

    if (dados.usuario) {
     // Se o usuário já existe, preenche os campos
      setCampo("email", dados.usuario.email);
      setCampo("ativo", dados.usuario.ativo);

      document.getElementById("btnCadastrar").style.display = "none";
      document.getElementById("btnAlterar").style.display = "inline-block";

      if (dados.usuario.email) {
        carregarPermissoesEEmpresasDoUsuario(dados.usuario.email);
      }
    } else {
      const confirmacao = await Swal.fire({
        icon: "question",
        title: "Usuário não encontrado",
        text: "Deseja cadastrar um novo usuário?",
        showCancelButton: true,
        confirmButtonText: "Sim, cadastrar",
        cancelButtonText: "Cancelar"
      });

      if (confirmacao.isConfirmed) {
        document.getElementById("btnCadastrar").style.display = "inline-block";
        document.getElementById("btnAlterar").style.display = "none";
      }
    }
  } catch (erro) {
    console.error("Erro ao verificar nome e sobrenome:", erro);
  }
}


document.getElementById("btnCancelar").addEventListener("click", async function (e) {
  e.preventDefault(); 

  const nome = document.getElementById("nome").value.trim();
  const sobrenome = document.getElementById("sobrenome").value.trim();
  const email = document.getElementById("email").value.trim();
  const senha = document.getElementById("senha").value.trim();
  const confirmasenha = document.getElementById("confirmasenha").value.trim();
  const ativo = document.getElementById('ativo').checked;

  if (!nome && !sobrenome && !email && !senha && !confirmasenha && !ativo) {
    // Todos os campos estão vazios

    console.log("Todos os campos estão vazios.");
   
     // Esconde o formulário de cadastro
  } else {
    
      limparCampos(); // Limpa os campos do formulário
  }
});

document.getElementById("btnFechar").addEventListener("click", async function (e) {
  e.preventDefault(); 

  //window.close(); 
   document.querySelector(".login-box").style.display = "none";
});

document.querySelectorAll(".toggle-senha").forEach((el) => {
  el.addEventListener("click", function () {
    const input = document.querySelector(this.getAttribute("toggle"));
    const icon = this.querySelector("i");

    if (input.type === "password") {
      input.type = "text";
      icon.classList.remove("fa-eye");
      icon.classList.add("fa-eye-slash");
    } else {
      input.type = "password";
      icon.classList.remove("fa-eye-slash");
      icon.classList.add("fa-eye");
    }
  });
});


const iconeBuscar = document.getElementById('iconebuscarUsuario');

iconeBuscar.addEventListener('click', async () => {
  const termo = inputBusca.value.trim();
  const idempresa = localStorage.getItem('idempresa') || '1';

  //console.log("Termo de busca ao clicar no ícone:", termo); // Log do termo de busca

  if (termo.length < 2) {
    // Se não tiver termo, buscar todos
   // console.log("Termo de busca muito curto, buscando todos os usuários.");
    try {
      const usuarios = await fetchComToken(`/auth/usuarios`);
      // const usuarios = await resposta.json();

     // const usuarios = await resposta.json();

      if (!Array.isArray(usuarios)) {
        console.error('Resposta não é uma lista de usuários:', usuarios);
        return; // ou trate o erro apropriadamente
      }

     // console.log('Resposta da API:', usuarios);

      lista.innerHTML = '';
      usuarios.forEach(usuario => {
        const li = document.createElement('li');
        li.textContent = `${usuario.nome} ${usuario.sobrenome}`;
        li.dataset.idusuario = usuario.idusuario;
        li.dataset.email = usuario.email;
        li.dataset.nome = usuario.nome;
        li.dataset.sobrenome = usuario.sobrenome;
        li.dataset.ativo = usuario.ativo;
        li.dataset.idempresadefault = usuario.idempresadefault;

        preencherEmpresaDefault(usuario.idempresadefault);

        lista.appendChild(li);
      });

      lista.style.display = 'block';
    } catch (error) {
      console.error('Erro ao buscar todos os usuários:', error);
    }
  } else {
    inputBusca.dispatchEvent(new Event('input')); // dispara a busca normal
  }

  inputBusca.focus(); // foca no input para interação do usuário
});

const listaUsuariosContainer = document.querySelector('#listaUsuarios'); 
// Evento ao clicar em um usuário da lista
listaUsuariosContainer.addEventListener('click', async (e) => {
  const item = e.target.closest('.usuario-item');
  if (!item) return;

  const idusuario = item.dataset.idusuario;

  try {
    // Buscar empresas vinculadas
    const empresas = await fetchComToken(`/usuarios/${idusuario}/empresas`);
   
    const [primeiroNome, ...resto] = item.dataset.nome.split(' ');
    document.querySelector('#nome').value = primeiroNome;
    document.querySelector('#sobrenome').value = item.dataset.sobrenome; // usa dataset diretamente
    document.querySelector('#email').value = item.dataset.email;
    document.querySelector('#email_original').value = item.dataset.email; // Armazena o email original para comparação
    document.querySelector('#idusuario').value = idusuario; // hidden input


    if (empresas.length === 0) {
      // Nenhuma empresa vinculada, virar o flipbox
      flipbox.classList.add('flip');
    } else {
      // Já possui vínculos, marcar checkboxes correspondentes
      empresas.forEach(emp => {
       // const checkbox = document.querySelector(`.empresa-checkbox[data-idempresa="${emp.idempresa}"]`);
       const checkbox = document.querySelector(`input[type="checkbox"][data-idempresa="${emp.idempresa}"]`);

        if (checkbox) checkbox.checked = true;
      });

      // Opcional: permitir editar ou apenas visualizar
      flipbox.classList.add('flip'); // Se desejar continuar para permissões
    }

  } catch (erro) {
    console.error('Erro ao buscar empresas do usuário:', erro);
    Swal.fire('Erro', 'Erro ao buscar empresas vinculadas.', 'error');
  }
});



function formatarNome(inputId) {
  const input = document.getElementById(inputId);
  const palavras = input.value
    .toLowerCase()
    .split(' ')
    .filter(p => p.trim() !== '')
    .map(p => p.charAt(0).toUpperCase() + p.slice(1));
  
  input.value = palavras.join(' ');
}


// Busca dinâmica conforme digita no campo buscaUsuario

const inputBusca = document.getElementById('buscaUsuario');
const lista = document.getElementById('listaUsuarios');

inputBusca.addEventListener('input', async () => {
  const termo = inputBusca.value.trim();

  //console.log("Termo de busca:", termo); // Log do termo de busca

  if (termo.length < 2) {
    lista.innerHTML = '';
    lista.style.display = 'none';
    return;
  }

  try {
    //console.log("Token no localStorage inputBusca:", localStorage.getItem("token"));
    const usuarios = await fetchComToken(`/auth/usuarios?nome=${encodeURIComponent(termo)}`);
   
   // console.log('Resposta da API:', usuarios);
       

    lista.innerHTML = '';

    // Ordena os usuários: primeiro os que começam com o termo
    usuarios.sort((a, b) => {
      const termoLower = termo.toLowerCase();
      const aNome = `${a.nome} ${a.sobrenome}`.toLowerCase();
      const bNome = `${b.nome} ${b.sobrenome}`.toLowerCase();

      const aStartsWith = aNome.startsWith(termoLower) ? 0 : 1;
      const bStartsWith = bNome.startsWith(termoLower) ? 0 : 1;

      // Se ambos começam ou não começam, mantém ordem atual
      if (aStartsWith !== bStartsWith) {
        return aStartsWith - bStartsWith;
      }

      // Ordena alfabeticamente como fallback
      return aNome.localeCompare(bNome);
  });

  if (usuarios.length === 0) {
      lista.innerHTML = '<li>Nenhum usuário encontrado</li>';
  } else {
    usuarios.forEach(usuario => {
      const li = document.createElement('li');
        li.textContent = `${usuario.nome} ${usuario.sobrenome}`;
        li.dataset.idusuario = usuario.idusuario;
        li.dataset.email = usuario.email;
        li.dataset.nome = usuario.nome;
        li.dataset.sobrenome = usuario.sobrenome;
        li.dataset.ativo = usuario.ativo;
        li.dataset.idempresaDefault = usuario.idempresadefault;
      // Preencher o select da empresa default
        preencherEmpresaDefault(usuario.idempresadefault);
        lista.appendChild(li);
      });
      
  }
  lista.style.display = 'block';

  } catch (error) {
    console.warn('Erro ao buscar usuários:', error);
    lista.innerHTML = '';
    lista.style.display = 'none';
  }
});

// Clique na sugestão
lista.addEventListener('mousedown', async (e) => {
//  console.log("Elemento clicado:", e.target); // Log do elemento clicado
//  console.log("Tag do elemento clicado:", e.target.tagName); // Log da tag do elemento clicado
  if (e.target.tagName === 'LI') {
    clicouNaLista = true; // Define que foi um clique na lista

    const nome = e.target.dataset.nome;
    const sobrenome = e.target.dataset.sobrenome;
    const email = e.target.dataset.email;
    const ativo = e.target.dataset.ativo === 'true'; 
    const idusuario = e.target.dataset.idusuario;

 //   console.log("Usuário selecionado:", nome, sobrenome, email, ativo, idusuario); // Log do usuário selecionado

    document.getElementById('idusuario').value = idusuario;
    document.getElementById('nome').value = nome;
    document.getElementById('sobrenome').value = sobrenome;
    document.getElementById('email').value = email;
    document.getElementById("email_original").value = email; // Armazena o email original para comparação
    document.getElementById('ativo').checked = ativo;
    document.getElementById('buscaUsuario').value = `${nome} ${sobrenome}`;

    
   
    document.getElementById("btnCadastrar").style.display = "none";
    document.getElementById("btnAlterar").style.display = "inline-block";
    
//    console.log("clicou na lista", clicouNaLista); // Log do clique na lista
    lista.innerHTML = '';
    lista.style.display = 'none';

    preencherUsuarioPeloEmail(email);

    // Limpar checkboxes de empresas e permissões antes de carregar
    limparCheckboxesEmpresas();
    limparCheckboxesPermissao();

     // 🔽 Aqui começa a parte nova: buscar empresas vinculadas
    try {
      // Limpa os checkboxes antes
     // document.querySelectorAll('.empresa-checkbox').forEach(cb => cb.checked = false);

//      console.log("Buscando empresas vinculadas ao usuário com ID:", idusuario);

      //const empresas = await fetchComToken(`/usuarios/${idusuario}/empresas`);
      const empresas = await fetchComToken(`/auth/usuarios/${idusuario}/empresas`);
    //  const empresas = await resposta.json(); // verificar se funciona com isso comentado


      if (!Array.isArray(empresas)) {
        console.error('Resposta inesperada ao buscar empresas:', empresas);
        Swal.fire('Erro', 'Erro ao buscar empresas do usuário.', 'error');
        return;
      }

      if (empresas.length === 0) {
        // Nenhuma empresa vinculada → vira flipbox
        document.querySelector('.flip-container').classList.add('flip');
      } else {
        // Marca checkboxes das empresas vinculadas
        empresas.forEach(emp => {
          const checkbox = document.querySelector(`.empresa-checkbox[data-idempresa="${emp.idempresa}"]`);
          if (checkbox) checkbox.checked = true;
        });

        // Mostra o lado de permissões
        document.querySelector('.flip-container').classList.add('flip');
      }
      await carregarPermissoesUsuario(idusuario); //novo 02/06/2025
    } catch (erro) {
      console.error('Erro ao buscar empresas do usuário:', erro);
      Swal.fire('Erro', 'Erro ao buscar empresas vinculadas.', 'error');
    }
  
  }
 
});

function preencherEmpresaDefault(idempresadefault) {
  const empresaDefaultSelect = document.getElementById('empresaDefaultSelect');
  if (empresaDefaultSelect && idempresadefault) {
    const option = [...empresaDefaultSelect.options].find(opt => opt.value === idempresadefault);
    if (option) {
      empresaDefaultSelect.value = idempresadefault;
    } else {
      const novaOption = new Option(`Empresa ID ${idempresadefault}`, idempresadefault);
      empresaDefaultSelect.add(novaOption);
      empresaDefaultSelect.value = idempresadefault;
    }
  }
}


// Função para limpar checkboxes de empresas
function limparCheckboxesEmpresas() {
  document.querySelectorAll('.empresa-checkbox').forEach(cb => cb.checked = false);
}


function limparPermissoes() {
  document.querySelectorAll('.modulo-container input[type="checkbox"]').forEach(cb => cb.checked = false);
  //document.querySelectorAll('.checkbox-empresa').forEach(cb => cb.checked = false);
}

function limparCampos() {
  document.getElementById('Registrar').reset();
  document.getElementById("nome").value = "";
  document.getElementById("sobrenome").value = "";
  document.getElementById("email").value = "";
  document.getElementById("senha").value = "";
  document.getElementById("confirmasenha").value = "";
  document.getElementById("buscaUsuario").value = "";
  document.getElementById("email_original").value = ""; // Limpa o email original
  document.getElementById("btnCadastrar").style.display = "inline-block";
  document.getElementById("btnAlterar").style.display = "none"; // Esconde o botão de alterar após cadastro
  document.getElementById("ativo").checked = false;
  document.getElementById('listaUsuarios').innerHTML = '';
  document.getElementById('listaUsuarios').style.display = 'none';
  limparPermissoes(); // Limpa as permissões
 
}

document.addEventListener('click', (event) => {
  const inputBusca = document.getElementById('buscaUsuario');
  const lista = document.getElementById('listaUsuarios');

  if (!inputBusca.contains(event.target) && !lista.contains(event.target)) {
    lista.innerHTML = '';
    lista.style.display = 'none';
  }
});

document.getElementById('buscaUsuario').addEventListener('blur', () => {
  setTimeout(() => {
    const lista = document.getElementById('listaUsuarios');
    lista.innerHTML = '';
    lista.style.display = 'none';
  }, 150); // tempo suficiente para permitir clique em item
});

document.getElementById("btnCadastrar").addEventListener("click", function (e) {
  e.preventDefault();
  document.getElementById("btnCadastrarReal").click();
});

async function carregarPermissoesEEmpresasDoUsuario(email) {
  try {
    const dados = await fetchComToken(`/auth/permissoes-usuario/${email}`);
   // const dados = await resposta.json();// verificar se funciona com isso comentado

    if (!resposta.ok) {
      console.error("Erro ao buscar permissões:", dados);
      return;
    }

    // Marca os checkboxes de permissões
    dados.permissoes.forEach(permissao => {
      const checkbox = document.querySelector(
        `.modulo-container[data-modulo="${permissao.modulo}"] input[type="checkbox"][data-tipo="${permissao.tipo}"]`
      );
      if (checkbox) {
        checkbox.checked = true;
      }
    });

    // Marca as empresas selecionadas
    const checkboxesEmpresa = document.querySelectorAll('.checkbox-empresa');
    checkboxesEmpresa.forEach(checkbox => {
      if (dados.empresas.includes(parseInt(checkbox.dataset.idempresa))) {
        checkbox.checked = true;
      }
    });

  } catch (erro) {
    console.error("Erro ao carregar permissões e empresas:", erro);
  }
}

async function preencherUsuarioPeloEmail(email) {
  try {
    const dados = await fetchComToken(`/auth/email/${encodeURIComponent(email)}`);
  //  if (!resposta.ok) throw new Error('Usuário não encontrado - Preencher Usuário pelo Email'); // verificar se funciona com isso comentado

   // const dados = await resposta.json(); // verificar se funciona com isso comentado

    const campoUsuario = document.getElementById('nome_usuario');
    campoUsuario.value = `${dados.nome} ${dados.sobrenome}`; // mostra nome e sobrenome

  } catch (erro) {
    console.error('Erro ao buscar usuário:', erro);
  }
}

// async function preencherUsuarioPeloEmail() {
//   const email = document.getElementById('nome_usuario').value.trim();
//   if (email.length < 3) return; // espera mais caracteres para buscar

//   try {
//     const usuario = await fetchComToken(`/auth/email=${encodeURIComponent(email)}`);
//     if (usuario && usuario.idusuario) {
//       document.getElementById('idusuario').value = usuario.idusuario;
//       carregarPermissoesUsuario(usuario.idusuario);
//       carregarEmpresasUsuario(usuario.idusuario); // Se usar empresas também
//     } else {
//       document.getElementById('idusuario').value = '';
//       limparCheckboxesPermissao();
//       limparListaEmpresas();
//     }
//   } catch (e) {
//     console.error("Erro ao buscar usuário pelo email:", e);
//   }
// }


//PERMISSÕES

function flipBox() {
   var container = document.getElementById("flip-container");
   container.classList.toggle("flipped");
  const idusuario = document.getElementById("idusuario").value;
  if (idusuario) {
    console.log("Vai entrar em carregarPermissoesUsuario IdUsuario",idusuario);
    carregarPermissoesUsuario(idusuario);
  }

   console.log("Entrou no flipBox");
}

// function carregarPermissoesUsuarioSelecionadas() {
//   const idusuario = document.getElementById("idusuario").value;
//   if (idusuario && idusuario.trim() !== '') {
//     carregarPermissoesUsuario(idusuario);
//   }
// }

document.getElementById("btnVoltar").addEventListener("click", function() {
  console.log("clicou no voltar");
   flipBox();

   // pega o idusuario que já está armazenado em um campo hidden
  
});

let permissoesOriginais = {
  modulo:   null,
  acesso:   false,
  cadastrar:false,
  alterar:  false,
  pesquisar:false
};

// Salvando permissões
// document.getElementById("btnsalvarPermissao").addEventListener("click", async function (e) {
//   e.preventDefault();
//   document.getElementById("btnPermissaoReal").click();

//   const idusuario = document.getElementById("idusuario").value;
//   const email = document.getElementById("nome_usuario").value.trim();
//   const modulo = document.getElementById("modulo").value;
 
//   if (!email || modulo === "choose") {
//     Swal.fire("Atenção", "Informe um usuário e selecione um módulo.", "warning");
//     return;
//   }

//    // Captura empresas selecionadas (checkboxes)
//   const empresasSelecionadas = Array.from(document.querySelectorAll('#listaEmpresas input[type="checkbox"]:checked'))
//     .map(cb => cb.value);


//   if (!empresasSelecionadas.length) {
//     Swal.fire("Atenção", "Selecione ao menos uma empresa.", "warning");
//     return;
//   }

//   // valores atuais
//   const atuais = {
//     modulo,
//     acesso:    document.getElementById("Acesso").checked,
//     cadastrar: document.getElementById("Cadastrar").checked,
//     alterar:   document.getElementById("Alterar").checked,
//     pesquisar: document.getElementById("Pesquisar").checked
//   };

//    // compara tudo
//   // 
//   if (typeof permissoesOriginais === "object") {
//     const semAlteracao = Object.keys(atuais).every(key => atuais[key] === permissoesOriginais[key]);
//     if (semAlteracao) {
//       return Swal.fire("Aviso", "Nenhuma alteração detectada em Permissões.", "info");
//     }
//   }

//   const payload = {
//     idusuario,
//     email,
//     modulo,
//     acesso: atuais.acesso,
//     cadastrar: atuais.cadastrar,
//     alterar: atuais.alterar,
//     pesquisar: atuais.pesquisar,
//     empresas: empresasSelecionadas // <- aqui está a diferença
//   };
  
 
//   try {
    
//       const res = await fetchComToken("/permissoes/cadastro", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(payload)
//       });

//       const resultado = await res.json();

//       if (res.ok) {
//        // sucesso++;
//         Swal.fire("Sucesso", "Permissões e empresas salvas com sucesso!", "success");
//         permissoesOriginais = { ...atuais };
//       }else {
//         //const resultado = await res.json();
//         Swal.fire("Erro", resultado.error || "Erro ao salvar permissões.", "error");;
//       } 
  
//   } catch (err) {
//     console.error("Erro ao salvar permissões:", err);
//   }
  
// });

document.getElementById("btnsalvarPermissao").addEventListener("click", async function (e) {
  e.preventDefault();
  document.getElementById("btnPermissaoReal").click();

  const idusuario = document.getElementById("idusuario").value;
  const email = document.getElementById("nome_usuario").value.trim();
  const modulo = document.getElementById("modulo").value;

  if (!email || modulo === "choose") {
    Swal.fire("Atenção", "Informe um usuário e selecione um módulo.", "warning");
    return;
  }

  // Empresas selecionadas atualmente
  const empresasSelecionadas = Array.from(document.querySelectorAll('#listaEmpresas input[type="checkbox"]:checked'))
    .map(cb => cb.value);

  if (!empresasSelecionadas.length) {
    Swal.fire("Atenção", "Selecione ao menos uma empresa.", "warning");
    return;
  }

  // Permissões atuais
  const atuais = {
    modulo,
    acesso:    document.getElementById("Acesso").checked,
    cadastrar: document.getElementById("Cadastrar").checked,
    alterar:   document.getElementById("Alterar").checked,
    pesquisar: document.getElementById("Pesquisar").checked
  };

  // Verifica se há mudança nas permissões
  const semAlteracaoPermissoes = typeof permissoesOriginais === "object" &&
    Object.keys(atuais).every(key => atuais[key] === permissoesOriginais[key]);

  // Verifica se há mudança nas empresas
  const empresasOriginaisOrdenadas = (empresasOriginais || []).slice().sort();
  const empresasSelecionadasOrdenadas = empresasSelecionadas.slice().sort();
  const semAlteracaoEmpresas = JSON.stringify(empresasOriginaisOrdenadas) === JSON.stringify(empresasSelecionadasOrdenadas);

  if (semAlteracaoPermissoes && semAlteracaoEmpresas) {
    return Swal.fire("Aviso", "Nenhuma alteração detectada nas Permissões ou Empresas.", "info");
  }

  const payload = {
    idusuario,
    email,
    modulo,
    acesso: atuais.acesso,
    cadastrar: atuais.cadastrar,
    alterar: atuais.alterar,
    pesquisar: atuais.pesquisar,
    empresas: empresasSelecionadas
  };

  try {
    const dados = await fetchComToken("/permissoes/cadastro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (dados && dados.sucesso) {
      Swal.fire("Sucesso", "Permissões e empresas salvas com sucesso!", "success");

      // Atualiza os dados originais
      permissoesOriginais = { ...atuais };
      empresasOriginais = [...empresasSelecionadas];
    } else {
      Swal.fire("Erro", dados.erro || "Erro ao salvar permissões.", "error");
    }

  } catch (err) {
    console.error("Erro ao salvar permissões:", err);
    Swal.fire("Erro", "Erro inesperado ao salvar permissões.", "error");
  }
});

async function carregarEmpresasUsuario(idusuario) {
  const container = document.getElementById('listaEmpresas');
  container.innerHTML = ''; // limpa

  try {
    const empresas = await fetchComToken(`/usuario_empresas/${idusuario}`); // endpoint hipotético
    empresas.forEach(emp => {
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.id = 'empresa_' + emp.id;
      cb.value = emp.id;
      cb.checked = emp.selecionada; // ou conforme sua resposta
      const label = document.createElement('label');
      label.htmlFor = cb.id;
      label.textContent = emp.nome;

      const div = document.createElement('div');
      div.appendChild(cb);
      div.appendChild(label);

      container.appendChild(div);
    });

    // Armazena lista original para comparar alterações
    empresasOriginais = empresas.filter(e => e.selecionada).map(e => e.id);

  } catch (e) {
    console.error("Erro ao carregar empresas do usuário:", e);
  }
}

function limparListaEmpresas() {
  const container = document.getElementById('listaEmpresas');
  container.innerHTML = '';
  empresasOriginais = [];
}

async function carregarPermissoesUsuario(idusuario) {
  limparCheckboxesPermissao();
  const selectModulo = document.getElementById("modulo");
  const modulo = selectModulo.value;

  const chkAcesso    = document.getElementById("Acesso");
  const chkCadastrar = document.getElementById("Cadastrar");
  const chkAlterar   = document.getElementById("Alterar");
  const chkPesquisar = document.getElementById("Pesquisar");
  // const chkLeitura   = document.getElementById("Leitura");

  try {
    console.log("Entrou no carregarPermissoesUsuario", idusuario, "Módulo:", modulo);
    const permissoes = await fetchComToken(`/permissoes/${idusuario}?modulo=${modulo}`);
   // if (!resp.ok) throw new Error("Falha ao buscar permissões"); // verificar se funciona com isso comentado

   // const permissoes = await resp.json();// verificar se funciona com isso comentado
    console.log("Permissões carregadas:", permissoes);

    if (permissoes.length > 0) {
      const p = permissoes[0];
      console.log("Permissões encontradas:", p);
      selectModulo.value    = p.modulo;
      chkAcesso.checked     = Boolean(p.acesso);
      chkCadastrar.checked  = Boolean(p.cadastrar);
      chkAlterar.checked    = Boolean(p.alterar);
      chkPesquisar.checked  = Boolean(p.pesquisar);
      // chkLeitura.checked    = Boolean(p.leitura);

      permissoesOriginais = {
        modulo,
        acesso: Boolean(p.acesso),
        cadastrar: Boolean(p.cadastrar),
        alterar: Boolean(p.alterar),
        pesquisar: Boolean(p.pesquisar)
        // leitura: Boolean(p.leitura)
      };
    } else {
      permissoesOriginais = {
        modulo,
        acesso: false,
        cadastrar: false,
        alterar: false,
        pesquisar: false
        // leitura: false
      };
    }
    console.log("Permissões originais:", permissoesOriginais);
    console.log("Permissões", permissoes)
  } catch (err) {
    console.error("Erro ao carregar permissões:", err);
  }
}

async function fetchComToken(url, options = {}) {

  const token = localStorage.getItem("token");
  const idempresa = localStorage.getItem("idempresa");

  if (!options.headers) options.headers = {};

  options.headers['Authorization'] = 'Bearer ' + token;
  if (idempresa) options.headers['idempresa'] = idempresa;

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

  const resposta = await fetch(url, options);

  if (resposta.status === 401) {
    localStorage.clear();
    Swal.fire({
      icon: "warning",
      title: "Sessão expirada",
      text: "Por favor, faça login novamente."
    }).then(() => {
      window.location.href = "login.html"; // ajuste conforme necessário
    });
    //return;
    throw new Error('Sessão expirada'); 
  }

  let dados;

  try {
    // Tenta parsear JSON
    dados = await resposta.json();
  } catch {
    // Se não for JSON, tenta pegar texto puro
    const texto = await resposta.text();
    dados = texto || null;
  }

  if (!resposta.ok) {
    // lança erro com a mensagem retornada (se houver)
    const mensagemErro = (dados && dados.erro) || JSON.stringify(dados) || resposta.statusText;
    throw new Error(`Erro na requisição: ${mensagemErro}`);
  }
  return dados;
}

async function carregarEmpresas() {
  try {
    console.log("Carregando empresas...");
    const empresas = await fetchComToken('/empresas'); // substitua pela rota correta se for diferente
    //if (!response.ok) throw new Error('Erro ao carregar empresas');

   // const empresas = await response.json();

    const select = document.getElementById('listaEmpresas');

    console.log("Empresas carregadas:", empresas);

    // Remove todas as opções exceto a primeira
    select.innerHTML = '<option value="all">Todas as empresas</option>';

    // Preenche com as empresas
    empresas.forEach(emp => {
      const option = document.createElement('option');
      option.value = emp.idempresa;
      option.textContent = emp.nome;
      select.appendChild(option);
    });

  } catch (error) {
    console.error('Erro ao carregar empresas:', error);
    Swal.fire({
      icon: 'error',
      title: 'Erro',
      text: 'Não foi possível carregar a lista de empresas.'
    });
  }
}

document.getElementById('listaEmpresas').addEventListener('change', function () {
  const idempresa = this.value;
  const selectModulos = document.getElementById('modulo');

  if (idempresa && idempresa !== 'all') {
    selectModulos.disabled = false;
    
  } else {
    selectModulos.disabled = true;
    selectModulos.value = ""; // limpa seleção anterior se houver
  }
});

async function carregarModulos() {
  try {
    console.log("CARREGAR MODULO");
    const modulos = await fetchComToken('/modulos');
    console.log('Módulos retornados:', modulos); // ajuste se necessário
    //if (!response.ok) throw new Error('Erro ao buscar módulos.');

    //const modulos = await response.json();

    const selectModulo = document.getElementById('modulo');
    selectModulo.innerHTML = '<option value="choose" selected>Escolha o Módulo</option>';

    modulos.forEach(modulo => {
      const option = document.createElement('option');
      option.value = modulo.modulo;
      option.textContent = modulo.modulo;
      selectModulo.appendChild(option);
    });

    selectModulo.disabled = false;

  } catch (error) {
    console.error('Erro ao carregar módulos:', error);
  }
}

//função para limpar todos os checkboxes de permissão
function limparCheckboxesPermissao() {
  ['Acesso','Cadastrar','Alterar','Pesquisar','Leitura']
    .forEach(id => {
      const chk = document.getElementById(id);
      if (chk) chk.checked = false;
    });
}

const selectModulo = document.getElementById("modulo");
selectModulo.addEventListener("change", () => {
  const idusuario = document.getElementById("idusuario").value;
  if (idusuario) {
    carregarPermissoesUsuario(idusuario);
  }
});

document.addEventListener('DOMContentLoaded', () => {
  
  carregarEmpresas();
  carregarModulos();
  const btnFechar = document.getElementById('btnFechar');
  if (btnFechar) {
    btnFechar.addEventListener('click', () => {
      window.location.href = 'login.html'; // Substitua pelo caminho correto se estiver em outra pasta
    });
  }
});