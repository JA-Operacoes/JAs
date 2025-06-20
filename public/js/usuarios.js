
document.getElementById("Registrar").addEventListener("submit", async function (e) {
    e.preventDefault();
  
    const nome = document.getElementById("nome").value;
    const sobrenome = document.getElementById("sobrenome").value;
    const email = document.getElementById("email").value;
    const senha = document.getElementById("senha").value;
    const ativo = document.getElementById('ativo').checked;
    const idempresaDefault = document.getElementById("empresaDefaultSelect").value;
const empresaSelecionada = document.getElementById("listaEmpresas");
    console.log("ID EMPRESA DEFAULT SELECT", idempresaDefault);
    
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
      const reponse = await fetchComToken("/auth/cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, email, senha, sobrenome, ativo, empresas: empresaSelecionada })
       // body: JSON.stringify({ nome, email, senha, sobrenome, ativo, idempresadefault: idempresaDefault })
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
const empresaSelecionada = document.getElementById("listaEmpresas");
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
       body: JSON.stringify({ nome, sobrenome, email, senha, email_original, ativo,idempresadefault: idempresaDefault, empresas: empresaSelecionada }),
      //body: JSON.stringify({ nome, sobrenome, email, senha, email_original, ativo, idempresadefault: idempresaDefault }),

    });

   
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
});

document.getElementById("email").addEventListener("blur", function (){

    verificarUsuarioExistenteFront();

    
});

document.getElementById("buscaUsuario").addEventListener("input", function () {
  const valor = this.value.trim();

  if (valor === "") {
    // Limpa campos relacionados ao usuário
    limparCampos();
  }
});

document.getElementById('empresaDefaultSelect').addEventListener('change', function () {
  
  const selectDefault = this.value;
  idEmpresaDefaultSelecionada = selectDefault;

  console.log("EMPRESA DEFAULT SELECIONADA NO SELECT USUARIOS", idEmpresaDefaultSelecionada);
  
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
  const empresaSelecionada = document.getElementById("listaEmpresas");
  console.log("Entrou no verificarUsuarioExistenteFront", nome, sobrenome, email, ativo, idempresaDefault);

  if (!nome || !sobrenome || !email) {
    return; // Só verifica se os três estiverem preenchidos
  } 
  
  try {
    
    const dados = await fetchComToken("/auth/verificarUsuario", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // body: JSON.stringify({ nome, sobrenome, email, ativo, idempresaDefault: idempresaDefault, empresas: empresasSelecionadas }) // Envia idempresaDefault e empresas como array vazio,
    body: JSON.stringify({ nome, sobrenome, email, ativo, idempresaDefault: idempresaDefault, empresas: empresaSelecionada }) // Envia idempresaDefault e empresas como array vazio,
    });

    //const dados = await resposta.json();

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
  limparCampos(); // Limpa os campos do formulário antes de buscar
  const termo = inputBusca.value.trim();
  const idempresa = localStorage.getItem('idempresa') || '1'; 

  if (termo.length < 2) {
   
    try {
      const usuarios = await fetchComToken(`/auth/usuarios`);
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

        console.log("ID Empresa Default:", usuario.idempresadefault);

        //preencherEmpresaDefault(usuario.idempresadefault);

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
  console.log("Clicou na lista de usuários listaUsuariosContainer");
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
      console.log("ID Empresa Default2:", usuario.idempresadefault);
      //  preencherEmpresaDefault(usuario.idempresadefault);
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
   // Limpa os campos do formulário antes de preencher com os dados do usuário clicado
  console.log("mousedown Elemento clicado:", e.target); // Log do elemento clicado
//  console.log("Tag do elemento clicado:", e.target.tagName); // Log da tag do elemento clicado
  if (e.target.tagName === 'LI') {
    clicouNaLista = true; // Define que foi um clique na lista

    const nome = e.target.dataset.nome;
    const sobrenome = e.target.dataset.sobrenome;
    const email = e.target.dataset.email;
    const ativo = e.target.dataset.ativo === 'true'; 
    const idusuario = e.target.dataset.idusuario;
    const idEmpresaDefaultDoLi = e.target.dataset.idempresadefault;
console.log("Valor de idEmpresaDefaultDoLi antes de chamar preencherEmpresaDefault:", idEmpresaDefaultDoLi); // <-- NOVO LOG AQUI
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

    if (idEmpresaDefaultDoLi) { // Apenas tenta se não for indefinido/vazio
          preencherEmpresaDefault(idEmpresaDefaultDoLi);
    } else {
          console.warn("DEBUG: idEmpresaDefaultDoLi está indefinido ou vazio para este usuário. O select não será preenchido.");
          // Opcional: Se o ID da empresa padrão for opcional, você pode resetar o select aqui
          // document.getElementById('empresaDefaultSelect').value = '';
    }

     preencherUsuarioPeloEmail(email);

     //limparSelectsEmpresas();

    limparCheckboxesPermissao();

//      // 🔽 Aqui começa a parte nova: buscar empresas vinculadas
     try {
//       // Limpa os checkboxes antes
//      // document.querySelectorAll('.empresa-checkbox').forEach(cb => cb.checked = false);

// //      console.log("Buscando empresas vinculadas ao usuário com ID:", idusuario);

//       //const empresas = await fetchComToken(`/usuarios/${idusuario}/empresas`);
       const empresas = await fetchComToken(`/auth/usuarios/${idusuario}/empresas`);
//     //  const empresas = await resposta.json(); // verificar se funciona com isso comentado


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
  const listaEmpresasSelect = document.getElementById('listaEmpresas');
  const empresaDefaultSelect = document.getElementById('empresaDefaultSelect');

  if (listaEmpresasSelect) {
      listaEmpresasSelect.value = ""; // Volta para a opção de "Todas as empresas"     
  }
  if (empresaDefaultSelect) {
      empresaDefaultSelect.value = ""; // Volta para a opção "Selecione"     
  }
 
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

    if (!dados) {
      console.warn("Nenhum dado de permissão ou empresa retornado para o usuário:", email);
      // Opcional: Limpar ou definir valores padrão para as variáveis originais
      permissoesOriginais = {};
      empresasOriginais = [];
      return;
    }


    if (Array.isArray(dados.empresas)) {
            empresasOriginais = [...dados.empresas]; // Cria uma cópia para evitar modificações diretas
    } else {
        empresasOriginais = []; // Garante que seja um array vazio se não vier no formato esperado
        console.warn("Dados de empresas não estão no formato de array para o usuário:", email, dados.empresas);
    }
    console.log("Empresas Originais Inicializadas:", empresasOriginais);
    

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
    // const checkboxesEmpresa = document.querySelectorAll('.checkbox-empresa');
    // checkboxesEmpresa.forEach(checkbox => {
    //   if (dados.empresas.includes(parseInt(checkbox.dataset.idempresa))) {
    //     checkbox.checked = true;
    //   }
    // });

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
let permissoesOriginais = {
  modulo:   null,
  acesso:   false,
  cadastrar:false,
  alterar:  false,
  pesquisar:false
};
let empresasOriginais = []; // Variável global para armazenar as empresas originais

async function flipBox() {
   var container = document.getElementById("flip-container");
   container.classList.toggle("flipped");

  const idusuario = document.getElementById("idusuario").value;
  const nomeUsuarioDisplay = document.getElementById("nome_usuario"); // O campo de exibição do nome do usuário no verso
  const nomeUsuarioFrente = document.getElementById("nome").value; // Nome do usuário do formulário da frente
  
  

// Preenche o nome do usuário no verso
  if (container.classList.contains("flipped")) {
      if (nomeUsuarioDisplay && nomeUsuarioFrente) {
          nomeUsuarioDisplay.value = nomeUsuarioFrente;
          nomeUsuarioDisplay.readOnly = true; // Torna somente leitura para não ser editado
      } 
      
      ////inserido para teste
if (idusuario) {
    console.log("Vai entrar em carregarEmpresasUsuario IdUsuario",idusuario);
     

            console.log("Vai entrar em carregarEmpresasUsuario IdUsuario", idusuario);
            // AGORA COM AWAIT DIRETO NA FUNÇÃO ASYNC flipBox
            await carregarEmpresasUsuario(idusuario); // Espere aqui
            console.log("carregarEmpresasUsuario CONCLUÍDO. Empresas Originais:", empresasOriginais);

            // Agora que empresasOriginais está preenchida, e o select está (ou deveria estar) atualizado
            const selectModuloElement = document.getElementById("modulo");
            const selectEmpresaElement = document.getElementById("listaEmpresas");

            if (!selectModuloElement || !selectEmpresaElement) {
                console.error("Elementos de select (modulo ou listaEmpresas) não encontrados no DOM.");
                return;
            }

            
            const empresaAlvoAtual = selectEmpresaElement.value;
            const moduloAtual = "";

            console.log("Modulo Atual para carregarPermissoes:", moduloAtual);
            console.log("Empresa Alvo Atual para carregarPermissoes:", empresaAlvoAtual);

            if (selectModuloElement.options.length > 1) { // Mais de uma opção (além do "choose")
                moduloAtual = selectModuloElement.options[1].value; // Pega o valor do primeiro módulo real
                selectModuloElement.value = moduloAtual; // Pré-seleciona
            } else {
                // Caso não haja módulos carregados ainda (menos provável se DOMContentLoaded já chamou carregarModulos)
                console.warn("Nenhum módulo real disponível para seleção inicial.");
            }
            console.log("Módulo Atual (APÓS AJUSTE) para carregarPermissoes:", moduloAtual);
            console.log("Empresa Alvo Atual (APÓS AJUSTE) para carregarPermissoes:", empresaAlvoAtual);

            // Agora, chame carregarPermissoesUsuario com os valores que *tentamos* pré-selecionar.
            // A condição agora verifica se temos valores válidos.
            if (moduloAtual && moduloAtual !== 'choose' && empresaAlvoAtual && empresaAlvoAtual !== '' && empresaAlvoAtual !== 'Selecione') {
                // Seu backend espera o NOME do módulo, não o value, certo?
                const nomeModuloParaAPI = selectModuloElement.options[selectModuloElement.selectedIndex].textContent;
                await carregarPermissoesUsuario(idusuario, empresaAlvoAtual, nomeModuloParaAPI);
                console.log("carregarPermissoesUsuario CONCLUÍDO.");
            } else {
                console.warn("Ainda sem dados suficientes para carregar permissões iniciais. Módulo:", moduloAtual, "Empresa:", empresaAlvoAtual);
                permissoesOriginais = { modulo: null, acesso: false, cadastrar: false, alterar: false, pesquisar: false };
            }
        } else {
            console.warn("ID de usuário não encontrado ao virar para o verso para carregar permissões/empresas.");
            empresasOriginais = [];
            permissoesOriginais = { modulo: null, acesso: false, cadastrar: false, alterar: false, pesquisar: false };
        }

        // Removi selectModulo.disabled = true; daqui. É melhor habilitar/desabilitar baseado na seleção
        // da empresa e módulo, talvez no `change` listener.
        console.log("Entrou no flipBox - Flipped.");
      ///fim


      selectModulo.disabled = true;
      //carregarModulos();     
    } else {
      // Se virou para a frente (cadastro de usuário)
      console.log("Voltou para a frente do cadastro de usuário.");
      // Opcional: Limpar campos do verso ao voltar, se necessário.
      limparListaEmpresas(); // Se essa função limpa o HTML do container de empresas
        empresasOriginais = []; // E garante que a variável global esteja vazia
        permissoesOriginais = { modulo: null, acesso: false, cadastrar: false, alterar: false, pesquisar: false };
        limparCheckboxesPermissao(); // Limpa os checkboxes de permissão
    }
   console.log("Entrou no flipBox");
  
}


document.getElementById("btnVoltar").addEventListener("click", function() {
  console.log("clicou no voltar");
   flipBox();
   // pega o idusuario que já está armazenado em um campo hidden
  
});


document.getElementById("btnsalvarPermissao").addEventListener("click", async function (e) {
  e.preventDefault();
  document.getElementById("btnPermissaoReal").click();

  const idusuario = document.getElementById("idusuario").value;
  const modulo = document.getElementById("modulo").value;
   
  const empresaSelecionada = document.getElementById("listaEmpresas");
  const idEmpresaAtual = empresaSelecionada.value;
  const empresasAtualmenteSelecionadas = [idEmpresaAtual];

  
  if (!idusuario) {
        Swal.fire("Atenção", "Selecione um usuário primeiro.", "warning");
        return;
    }
    if (modulo === "choose" || !modulo) {
        Swal.fire("Atenção", "Selecione um módulo.", "warning");
        return;
    }

    if (!idEmpresaSelecionada || idEmpresaSelecionada === 'all' || idEmpresaSelecionada === "Selecione") {
        Swal.fire("Atenção", "Selecione uma empresa válida para aplicar as permissões.", "warning");
        return;
    }
  //const empresasSelecionadas = [empresaSelecionadaUnica];
  
  console.log("EMPRESA SELECIONADA BT SALVAR", empresaSelecionada);

  if (!empresaSelecionada.length) {
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

    console.log("Permissões Originais:", permissoesOriginais);
    console.log("Permissões Atuais:", atuais);

  const semAlteracaoEmpresas = empresasOriginais.length === empresasAtualmenteSelecionadas.length &&
                               empresasOriginais.every(empId => empresasAtualmenteSelecionadas.includes(empId));

  console.log("Empresas Originais:", empresasOriginais);
  console.log("Empresas Atualmente Selecionadas:", empresasAtualmenteSelecionadas);
  console.log("Sem Alteração nas Empresas:", semAlteracaoEmpresas);

  if (semAlteracaoPermissoes && semAlteracaoEmpresas) {
    return Swal.fire("Aviso", "Nenhuma alteração detectada nas Permissões ou Empresas.", "info");
  }

  const payload = {
    idusuario,
    modulo,
    acesso: atuais.acesso,
    cadastrar: atuais.cadastrar,
    alterar: atuais.alterar,
    pesquisar: atuais.pesquisar,

  };

  try {
    const dados = await fetchComToken("/permissoes/cadastro", {
      method: "POST",
      //headers: { "Content-Type": "application/json" },
      headers: {"Content-Type": "application/json",
                // Passa o idEmpresaAtual diretamente no cabeçalho para esta requisição
                'idempresa': idEmpresaAtual
            },
      body: JSON.stringify(payload)
    });

    if (dados && dados.sucesso) {
      Swal.fire("Sucesso", "Permissões e empresas salvas com sucesso!", "success");

      // Atualiza os dados originais
      permissoesOriginais = { ...atuais };
      empresasOriginais = [...empresasAtualmenteSelecionadas];
       // Atualiza com as empresas atualmente selecionadas
       console.log("empresasOriginais atualizadas após salvar:", empresasOriginais);

    } else {
      Swal.fire("Erro", dados.erro || "Erro ao salvar permissões.", "error");
    }

  } catch (err) {
    console.error("Erro ao salvar permissões:", err);
    Swal.fire("Erro", "Erro inesperado ao salvar permissões.", "error");
  }
});


async function carregarEmpresasUsuario(idusuario) {
    const container = document.getElementById('listaEmpresas'); // Note que 'listaEmpresas' agora é um select, não um container de checkboxes
    // A sua função 'carregarEmpresasUsuario' atualmente parece estar manipulando DIVs e checkboxes,
    // mas seu HTML do salvamento mostra um <select id="listaEmpresas">.
    // Se 'listaEmpresas' for o <select> para TODAS as empresas, e você tiver outro elemento
    // para exibir as empresas DO USUARIO (como um grupo de checkboxes),
    // então essa função precisa ser revisada.

    // **ASSUMINDO QUE '/usuario_empresas/:idusuario' RETORNA AS EMPRESAS DO USUÁRIO:**
    try {
        // Este endpoint deve retornar apenas as empresas que o usuário já possui.
        const empresasDoUsuario = await fetchComToken(`usuarios/${idusuario}/empresas`);
        console.log("Empresas DO USUÁRIO carregadas (para empresasOriginais):", empresasDoUsuario);

        if (Array.isArray(empresasDoUsuario)) {
            // Mapeie apenas os IDs das empresas que o usuário já possui
            empresasOriginais = empresasDoUsuario.map(emp => String(emp.id)); // Converte para string para consistência com `value` do select
            console.log("empresasOriginais inicializada com:", empresasOriginais);

            // Opcional: Se você quiser que o select 'listaEmpresas' (o que tem TODAS as empresas)
            // selecione a empresa padrão do usuário automaticamente ao carregar:
            if (empresasOriginais.length > 0) {
                const selectEmpresa = document.getElementById("listaEmpresas");
                if (selectEmpresa) {
                    selectEmpresa.value = empresasOriginais[0]; // Seleciona a primeira empresa do usuário como padrão
                    // Dispare um evento 'change' para acionar a lógica de carregar módulos/permissões se necessário
                    selectEmpresa.dispatchEvent(new Event('change'));
                }
            }

        } else {
            empresasOriginais = [];
            console.warn("Formato inesperado para empresas do usuário:", empresasDoUsuario);
        }

        // Se o seu 'listaEmpresas' é um SELECT para escolher UMA empresa para o usuário,
        // então você não deve criar checkboxes aqui. Sua função 'carregarEmpresas' já preenche esse SELECT.
        // A sua `carregarEmpresasUsuario` pode ser mais para carregar o *estado* das empresas do usuário
        // e preencher `empresasOriginais`.

    } catch (e) {
        console.error("Erro ao carregar empresas do usuário para inicializar empresasOriginais:", e);
        empresasOriginais = []; // Garante que seja vazio em caso de erro
    }
}

function limparListaEmpresas() {
  const container = document.getElementById('listaEmpresas');
  container.innerHTML = '';
  empresasOriginais = [];
}

async function carregarPermissoesUsuario(idusuario, idEmpresaAtual, nomeModulo) {
  limparCheckboxesPermissao();
  const selectModulo = document.getElementById("modulo");
 
  const chkAcesso    = document.getElementById("Acesso");
  const chkCadastrar = document.getElementById("Cadastrar");
  const chkAlterar   = document.getElementById("Alterar");
  const chkPesquisar = document.getElementById("Pesquisar");
  

  try {
    console.log("Entrou no carregarPermissoesUsuario", idusuario, "Empresa:", idEmpresaAtual, "Módulo:", nomeModulo);
    const url = `/permissoes/${idusuario}?modulo=${encodeURIComponent(nomeModulo)}`; 
    const options = {
            method: 'GET', // Método GET para consulta
            headers: {
                // Passa o idEmpresaAtual diretamente no cabeçalho para esta requisição
                'idempresa': idEmpresaAtual
            }
            // fetchComToken vai adicionar o Authorization e Content-Type, etc.
        };
    const permissoes = await fetchComToken(url, options);    
   
    console.log("Permissões carregadas:", permissoes);

    if (permissoes && permissoes.length > 0) {
      const p = permissoes[0];       
      const optionParaSelecionar = Array.from(selectModulo.options).find(
        option => option.textContent === p.modulo // Compara o texto da opção com o nome do módulo
      );

      if (optionParaSelecionar) {
        selectModulo.value = optionParaSelecionar.value; // Atribui o ID (value) da opção
      } else {
        console.warn(`Módulo '${p.modulo}' não encontrado nas opções do select.`);
        // Se o módulo não for encontrado, talvez você queira limpar ou manter "choose"
      }
      
      chkAcesso.checked     = Boolean(p.acesso);
      chkCadastrar.checked  = Boolean(p.cadastrar);
      chkAlterar.checked    = Boolean(p.alterar);
      chkPesquisar.checked  = Boolean(p.pesquisar);
      

      permissoesOriginais = {
        modulo: p.modulo,
        acesso: Boolean(p.acesso),
        cadastrar: Boolean(p.cadastrar),
        alterar: Boolean(p.alterar),
        pesquisar: Boolean(p.pesquisar)
       
      };
    } else {
      console.log("16. Nenhuma permissão encontrada. Permissões Originais serão falsas.");
      permissoesOriginais = {
        modulo: nomeModulo || null, // Se não houver módulo, mantém null
        acesso: false,
        cadastrar: false,
        alterar: false,
        pesquisar: false
      
      };
    }
    console.log("Permissões originais:", permissoesOriginais);
    console.log("Permissões", permissoes)
  } catch (err) {
    console.error("Erro ao carregar permissões:", err);
  }
}

async function fetchComToken(url, options = {}) {
  console.log("URL da requisição:", url);
  const token = localStorage.getItem("token");
  const idempresaLocalStorage = localStorage.getItem("idempresa");

  console.log("ID da empresa no localStorage:", idempresaLocalStorage);
  console.log("Token no localStorage:", token);

  if (!options.headers) options.headers = {};

  if (options.body && typeof options.body === 'string' && options.body.startsWith('{')) {
        options.headers['Content-Type'] = 'application/json';
    }

  options.headers['Authorization'] = 'Bearer ' + token;

  
 
  if (!options.headers['idempresa']) { // Se o header 'idempresa' ainda não foi definido
        if (
            idempresaLocalStorage &&
            idempresaLocalStorage !== 'null' &&
            idempresaLocalStorage !== 'undefined' &&
            idempresaLocalStorage.trim() !== '' &&
            !isNaN(idempresaLocalStorage) &&
            Number(idempresaLocalStorage) > 0
        ) {
            options.headers['idempresa'] = idempresaLocalStorage;
            console.log('[fetchComToken] Enviando idempresa do localStorage no header:', idempresaLocalStorage);
        } else {
            console.warn('[fetchComToken] idempresa inválido no localStorage, não será enviado no header:', idempresaLocalStorage);
        }
  } else {
        console.log('[fetchComToken] idempresa já definido no options.headers, usando-o:', options.headers['idempresa']);
  }

  console.log("URL OPTIONS", url, options);
  const resposta = await fetch(url, options);
  console.log("Resposta da requisição:", resposta);
  
  
  let responseBody = null;
  try {
      // Primeiro, tente ler como JSON, pois é o mais comum para APIs
      responseBody = await resposta.json();
  } catch (jsonError) {
      // Se falhar (não é JSON, ou resposta vazia, etc.), tente ler como texto
      try {
          responseBody = await resposta.text();
      } catch (textError) {
          // Se nem como texto conseguir, assume que não há corpo lido ou que é inválido
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
      window.location.href = "login.html"; // ajuste conforme necessário
    });
    //return;
    throw new Error('Sessão expirada'); 
  }

  if (!resposta.ok) {
        // Se a resposta NÃO foi bem-sucedida (status 4xx ou 5xx)
        // Use o responseBody já lido para obter a mensagem de erro
        const errorMessage = (responseBody && responseBody.erro) || (responseBody && responseBody.message) || responseBody || resposta.statusText;
        throw new Error(`Erro na requisição: ${errorMessage}`);
  }

  return responseBody;
}

let idEmpresaSelecionada = null;

function preencherEmpresaDefault(idEmpresaDefault) {
    console.log("Preenchendo empresa default com ID:", idEmpresaDefault); 
    const selectEmpresa = document.getElementById('empresaDefaultSelect');

    if (!selectEmpresa) {
        console.error("ERRO CRÍTICO: Select de empresa (#empresaDefaultSelect) NÃO ENCONTRADO para preenchimento.");
        return;
    }

    const valorParaSelecionar = String(idEmpresaDefault || ''); 
    console.log(`Tentando setar select.value para: '${valorParaSelecionar}'`);

    selectEmpresa.value = valorParaSelecionar;

    const selectedOption = selectEmpresa.options[selectEmpresa.selectedIndex];
    if (selectedOption && selectedOption.value === valorParaSelecionar) {
        console.log(`SUCESSO: Select agora exibe: '<span class="math-inline">\{selectedOption\.textContent\}' \(Valor\: '</span>{selectedOption.value}')`);
    } else {
        console.error(`FALHA NA SELEÇÃO VISUAL: O valor '${valorParaSelecionar}' não foi encontrado ou selecionado no select. Atualmente exibe: ${selectedOption ? selectedOption.textContent : 'Nenhum'}`);
        console.error("Valores disponíveis no select (verifique se '"+ valorParaSelecionar +"' está entre eles):");
        Array.from(selectEmpresa.options).forEach((opt, index) => {
            console.log(`  Opção <span class="math-inline">\{index\}\: Texto\='</span>{opt.textContent}', Valor='${opt.value}'`);
        });
    }
}

async function carregarEmpresas(selectIds = ['listaEmpresas', 'empresaDefaultSelect']) {
    try {
        console.log("Carregando empresas...");
        const empresas = await fetchComToken('/empresas');
        console.log("Empresas carregadas:", empresas);

        selectIds.forEach(id => {
            const selectElement = document.getElementById(id);

            if (selectElement) {
                selectElement.innerHTML = ''; // Limpa todas as opções

                let defaultOptionText = "Selecione";
                if (id === 'listaEmpresas') {
                    defaultOptionText = "Todas as empresas";
                }
                const defaultOption = document.createElement('option');
                defaultOption.value = "";
                defaultOption.textContent = defaultOptionText;
                defaultOption.selected = true;
                defaultOption.disabled = true;
                selectElement.appendChild(defaultOption);

                empresas.forEach(emp => {
                    const option = document.createElement('option');
                    option.value = String(emp.idempresa); // Mantenha como String
                    option.textContent = emp.nmfantasia;
                    selectElement.appendChild(option);
                }); 
                console.log(`Select #${id} preenchido com ${empresas.length + 1} opções.`);
            } else {
                console.error(`ERRO CRÍTICO: Elemento select com ID '${id}' NÃO ENCONTRADO no DOM.`); // Altere para error
            }
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
  idEmpresaSelecionada = idempresa;

console.log("EMPRESA SELECIONADA NO SELECT PERMISSOES", idEmpresaSelecionada);
  const selectModulos = document.getElementById('modulo');

  let moduloAnteriorSelecionado = selectModulos.value;
  if (idempresa && idempresa !== 'all') {
    selectModulos.disabled = false;   
  
    carregarModulos().then(() => {
        
      if (moduloAnteriorSelecionado && selectModulos.querySelector(`option[value="${moduloAnteriorSelecionado}"]`)) {
        selectModulos.value = moduloAnteriorSelecionado;       
        selectModulos.dispatchEvent(new Event('change'));       
      } else {        
        limparCheckboxesPermissao();
      }
    });
  } else {
   
    selectModulos.disabled = true;
    selectModulos.value = ""; // limpa seleção anterior se houver
    selectModulos.innerHTML = '<option value="" selected>Escolha o Módulo</option>';
    limparCheckboxesPermissao();
  } 
});

async function carregarModulos() {
  
  try {
    
    const idempresa = idEmpresaSelecionada;

    console.log("CARREGAR MODULO", idempresa);
    const modulos = await fetchComToken('/modulos');
    const selectModulo = document.getElementById('modulo');
    
    selectModulo.innerHTML = '<option value="choose" selected>Escolha o Módulo</option>';

    modulos.forEach(modulo => {
    
      const option = document.createElement('option');
      option.value = modulo.modulo;
     // option.value = modulo.modulo;
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

  const idusuarioAtual = document.getElementById("idusuario").value;
  const idEmpresaAtual = document.getElementById('listaEmpresas').value
  const moduloSelecionado = selectModulo.value; 
  const moduloSelecionadoNome = selectModulo.options[selectModulo.selectedIndex].textContent; // Para pegar o nome
  
  console.log("IDEMPRESA DA LISTA DE EMPRESAS", idEmpresaAtual);

  if (idusuarioAtual && idEmpresaAtual && idEmpresaAtual !== 'all' && moduloSelecionadoNome && moduloSelecionadoNome !== 'Escolha o Módulo') {
        carregarPermissoesUsuario(idusuarioAtual, idEmpresaAtual, moduloSelecionadoNome);
    } else {
        
        limparCheckboxesPermissao; // Chame sua função para limpar os checkboxes de permissão
    }
});

document.addEventListener('DOMContentLoaded', async () => {
  console.log("DOMContentLoaded disparado. Iniciando carregamento de dados...");
  await carregarEmpresas();
  await carregarModulos();
  console.log("--> carregarEmpresas() e carregarModulos() concluídos.");


  const btnFechar = document.getElementById('btnFechar');
  if (btnFechar) {
    btnFechar.addEventListener('click', () => {
      window.location.href = 'login.html'; // Substitua pelo caminho correto se estiver em outra pasta
    });
  }

});