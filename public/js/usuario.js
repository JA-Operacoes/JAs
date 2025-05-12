document.getElementById("Registrar").addEventListener("submit", async function (e) {
    e.preventDefault();
  
    const nome = document.getElementById("nome").value;
    const sobrenome = document.getElementById("sobrenome").value;
    const email = document.getElementById("email").value;
    const senha = document.getElementById("senha").value;
    const confirmacaoSenha = document.getElementById("confirmasenha").value;
   
  
    try {
      const resposta = await fetch("http://localhost:3000/auth/cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, email, senha, sobrenome })
      });
  
      const dados = await resposta.json();
      console.log(dados);
  
      if (!resposta.ok) {
        Swal.fire({
          icon: "error",
          title: "Erro",
          text: dados.erro || "Erro ao cadastrar."
        });
      
        return;
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
  

  if (!nome || !sobrenome || !email ) {
    Swal.fire({
      icon: 'warning',
      title: 'Atenção',
      text: 'Todos os campos devem ser preenchidos.',
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
     console.log("ENTROU NO TRY", nome, sobrenome, email, senha);
   
    const resposta = await fetch("http://localhost:3000/auth/cadastro", {
      method: "PUT",  // Mudamos para PUT para indicar alteração
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, email, senha, sobrenome, email_original, ativo  })

    });
 


    const dados = await resposta.json();
    console.log("DADOS ALTERADOS", dados);

    if (!resposta.ok) {
      Swal.fire({
        icon: 'error',
        title: 'Erro',
        text: dados.erro || 'Erro ao atualizar.'
      });
      return;
    }

    if (dados.mensagem === 'Nenhuma alteração detectada.') {
      Swal.fire({
        icon: 'info',
        title: 'Aviso',
        text: dados.mensagem
      });
    } else {
      Swal.fire({
        icon: 'success',
        title: 'Sucesso',
        text: dados.mensagem || 'Usuário atualizado com sucesso!'
      });

    }
    limparCampos(); // Limpa os campos do formulário após a atualização

  } catch (erro) {
    console.error("Erro na requisição:", erro);
    Swal.fire({
      icon: 'error',
      title: 'Erro inesperado',
      text: 'Não foi possível completar a ação.'
    });
  }
});

// document.getElementById("email").addEventListener("blur", function () { 
//   const emailValue = email.value;
//   console.log("Verificando email:", emailValue);

  
//   if (emailValue) {
//     verificarUsuarioExistenteFront();
//   }
// }
// );
document.getElementById("nome").addEventListener("blur", function () {
  formatarNome("nome");
  verificarUsuarioExistenteFront();
});
  
document.getElementById("sobrenome").addEventListener("blur", function () {
  formatarNome("sobrenome");
  verificarUsuarioExistenteFront();
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

document.getElementById("email").addEventListener("blur", function (){
   if (!buscaUsuario){
    verificarUsuarioExistenteFront();
   }
 
    
});

async function verificarUsuarioExistenteFront() {
  const nome = document.getElementById("nome").value.trim();
  const sobrenome = document.getElementById("sobrenome").value.trim();
  const email = document.getElementById("email").value.trim();
  

  if (!nome || !sobrenome || !email) {
    return; // Só verifica se os três estiverem preenchidos
  }

  try {
    const resposta = await fetch("http://localhost:3000/auth/verificarUsuario", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, sobrenome, email, ativo })
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
    }

  } catch (erro) {
    console.error("Erro ao verificar usuário:", erro);
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
    // document.getElementById("buscaUsuario").value = "";
    // document.getElementById("nome").value = "";
    // document.getElementById("sobrenome").value = "";
    // document.getElementById("email").value = "";
    // document.getElementById("senha").value = "";
    // document.getElementById("confirmasenha").value = "";
    // console.log("Algum campo foi preenchido.");
  }
});

document.getElementById("btnFechar").addEventListener("click", async function (e) {
  e.preventDefault(); 

  window.close(); 
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

  console.log("Termo de busca:", termo); // Log do termo de busca

  if (termo.length < 2) {
    lista.innerHTML = '';
    lista.style.display = 'none';
    return;
  }

  try {
    const resposta = await fetch(`http://localhost:3000/auth/usuarios?nome=${encodeURIComponent(termo)}`);
    const usuarios = await resposta.json();

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

usuarios.forEach(usuario => {
  const li = document.createElement('li');
  li.textContent = `${usuario.nome} ${usuario.sobrenome}`;
  li.dataset.email = usuario.email;
  li.dataset.nome = usuario.nome;
  li.dataset.sobrenome = usuario.sobrenome;
 // li.dataset.senha = usuario.senha_hash; // Adiciona o hash da senha como dataset
  lista.appendChild(li);
});

    lista.style.display = 'block';

  } catch (error) {
    console.error('Erro ao buscar usuários:', error);
  }
});

// Clique na sugestão
lista.addEventListener('click', (e) => {
  console.log("Elemento clicado:", e.target); // Log do elemento clicado
  console.log("Tag do elemento clicado:", e.target.tagName); // Log da tag do elemento clicado
  if (e.target.tagName === 'LI') {
    const nome = e.target.dataset.nome;
    const sobrenome = e.target.dataset.sobrenome;
    const email = e.target.dataset.email;
    const ativo = e.target.dataset.ativo === 'true'; 
  

    console.log("Usuário selecionado:", nome, sobrenome, email, senha); // Log do usuário selecionado

    document.getElementById('nome').value = nome;
    document.getElementById('sobrenome').value = sobrenome;
    document.getElementById('email').value = email;
    document.getElementById("email_original").value = email; // Armazena o email original para comparação
    document.getElementById('ativo').checked = ativo;
   
    document.getElementById('buscaUsuario').value = `${nome} ${sobrenome}`;
    lista.innerHTML = '';
    lista.style.display = 'none';

    preencherUsuarioPeloEmail(email);
  }
  document.getElementById("btnCadastrar").style.display = "none";
  document.getElementById("btnAlterar").style.display = "inline-block";
});

function limparCampos() {
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
}

document.getElementById("btnCadastrar").addEventListener("click", function (e) {
  e.preventDefault();
  document.getElementById("btnCadastrarReal").click();
});


function flipBox() {
  var container = document.getElementById("flip-container");
  container.classList.toggle("flipped");
}

document.getElementById("btnsalvarPermissao").addEventListener("click", function (e) {
  e.preventDefault();
  document.getElementById("btnPermissaoReal").click();
});

async function preencherUsuarioPeloEmail(email) {
  try {
    const resposta = await fetch(`http://localhost:3000/auth/email/${encodeURIComponent(email)}`);
    if (!resposta.ok) throw new Error('Usuário não encontrado');

    const dados = await resposta.json();

    const campoUsuario = document.getElementById('nome_usuario');
    campoUsuario.value = `${dados.nome} ${dados.sobrenome}`; // mostra nome e sobrenome

  } catch (erro) {
    console.error('Erro ao buscar usuário:', erro);
  }
}


