document.getElementById("Registrar").addEventListener("submit", async function (e) {
    e.preventDefault();
  
    const nome = document.getElementById("nome").value;
    const sobrenome = document.getElementById("sobrenome").value;
    const email = document.getElementById("email").value;
    const senha = document.getElementById("senha").value;
  //  const confirmacaoSenha = document.getElementById("confirmasenha").value;
    const ativo = document.getElementById('ativo').checked;
   
  
    try {
      const resposta = await fetch("/auth/cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, email, senha, sobrenome, ativo })
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
   
    const resposta = await fetch("/auth/cadastro", {
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
    console.log("Dados Mensagem", dados.mensagem);
    if (dados.mensagem === 'Nenhuma alteração detectada no Usuário.') {
      Swal.fire({
        icon: 'info',
        title: 'Aviso',
        text: dados.mensagem
      }).then((result) => {
        if (result.isConfirmed) {
          flipBox(); // Só executa após o usuário clicar em OK
        }
      });
    
    } else {
        Swal.fire({
          icon: 'success',
          title: 'Sucesso',
          text: dados.mensagem || 'Usuário atualizado com sucesso!'
        }).then((result) => {
          if (result.isConfirmed) {
            flipBox(); // Só executa após o usuário clicar em OK
          }
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
  const ativo = document.getElementById('ativo').checked;

  if (!nome || !sobrenome || !email) {
    return; // Só verifica se os três estiverem preenchidos
  }

  try {
    
    const resposta = await fetch("/auth/verificarUsuario", {
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
    const resposta = await fetch(`/auth/usuarios?nome=${encodeURIComponent(termo)}`);
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
  li.dataset.idusuario = usuario.idusuario;
  li.dataset.email = usuario.email;
  li.dataset.nome = usuario.nome;
  li.dataset.sobrenome = usuario.sobrenome;
  li.dataset.ativo = usuario.ativo;
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
    const idusuario = e.target.dataset.idusuario;

    console.log("Usuário selecionado:", nome, sobrenome, email, ativo, idusuario); // Log do usuário selecionado

    document.getElementById('idusuario').value = idusuario;
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
 
}

document.getElementById("btnCadastrar").addEventListener("click", function (e) {
  e.preventDefault();
  document.getElementById("btnCadastrarReal").click();
});

async function preencherUsuarioPeloEmail(email) {
  try {
    const resposta = await fetch(`/auth/email/${encodeURIComponent(email)}`);
    if (!resposta.ok) throw new Error('Usuário não encontrado');

    const dados = await resposta.json();

    const campoUsuario = document.getElementById('nome_usuario');
    campoUsuario.value = `${dados.nome} ${dados.sobrenome}`; // mostra nome e sobrenome

  } catch (erro) {
    console.error('Erro ao buscar usuário:', erro);
  }
}

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
  pesquisar:false,
  leitura:  false
};

// Salvando permissões
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
  // valores atuais
  const atuais = {
    modulo,
    acesso:    document.getElementById("Acesso").checked,
    cadastrar: document.getElementById("Cadastrar").checked,
    alterar:   document.getElementById("Alterar").checked,
    pesquisar: document.getElementById("Pesquisar").checked,
    leitura:   document.getElementById("Leitura").checked
  };

   // compara tudo
  const semAlteracao = Object.keys(atuais).every(key => atuais[key] === permissoesOriginais[key]);
  if (semAlteracao) {
    return Swal.fire("Aviso", "Nenhuma alteração detectada em Permissões.", "info");
  }

  // monta o body
  const permissoes = {
    idusuario,
    email,
    modulo,
    acesso: document.getElementById("Acesso").checked,
    cadastrar: document.getElementById("Cadastrar").checked,
    alterar: document.getElementById("Alterar").checked,
    pesquisar: document.getElementById("Pesquisar").checked,
    leitura: document.getElementById("Leitura").checked
  };

  try {
    const res = await fetch("/permissoes/cadastro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(permissoes)
    });

    if (res.ok) {
      Swal.fire("Sucesso", "Permissões salvas com sucesso!", "success");
      permissoesOriginais = { ...atuais };
    } else {
      const resultado = await res.json();
      Swal.fire("Erro", resultado.error || "Erro ao salvar permissões.", "error");
    }
  } catch (err) {
    console.error("Erro ao salvar permissões:", err);
  }
  
});

async function carregarPermissoesUsuario(idusuario) {
  
  limparCheckboxesPermissao();
  const selectModulo = document.getElementById("modulo");
  const chkAcesso    = document.getElementById("Acesso");
  const chkCadastrar = document.getElementById("Cadastrar");
  const chkAlterar   = document.getElementById("Alterar");
  const chkPesquisar = document.getElementById("Pesquisar");
  const chkLeitura   = document.getElementById("Leitura");

  // // 1. limpa tudo
  // selectModulo.value = "choose";
  // [chkAcesso, chkCadastrar, chkAlterar, chkPesquisar, chkLeitura]
  //   .forEach(chk => chk.checked = false);

  try {
    console.log("Entrou no carregarPermissoesUsuario", idusuario);
    const resp = await fetch(`/permissoes/${idusuario}`);
    if (!resp.ok) throw new Error("Falha ao buscar permissões");
    const permissoes = await resp.json();
    console.log("Permissões carregadas:", permissoes);
    if (permissoes.length > 0) {
    const p = permissoes[0];
    // seta o select e checkboxes
    selectModulo.value    = p.modulo;
    chkAcesso.checked     = Boolean(p.acesso);
    chkCadastrar.checked  = Boolean(p.cadastrar);
    chkAlterar.checked    = Boolean(p.alterar);
    chkPesquisar.checked  = Boolean(p.pesquisar);
    chkLeitura.checked    = Boolean(p.leitura);

    // guarda no original
    permissoesOriginais = {
      modulo:    p.modulo,
      acesso:    Boolean(p.acesso),
      cadastrar: Boolean(p.cadastrar),
      alterar:   Boolean(p.alterar),
      pesquisar: Boolean(p.pesquisar),
      leitura:   Boolean(p.leitura)
    };
    } else {
    // sem permissões ainda → zera original também
      permissoesOriginais = {
        modulo:   selectModulo.value,
        acesso:   false,
        cadastrar:false,
        alterar:  false,
        pesquisar:false,
        leitura:  false
      };
    }

  } catch (err) {
    console.error("Erro ao carregar permissões:", err);
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
  // Limpa tudo imediatamente
  limparCheckboxesPermissao();
  // Zera o estado original também, para que o "Salvar" não indique nenhuma alteração
  permissoesOriginais = {
    modulo: selectModulo.value,
    acesso: false,
    cadastrar: false,
    alterar: false,
    pesquisar: false,
    leitura: false
  };
});

// function aplicarPermissoes(permissoes) {
//   console.log("[Permissões] aplicando em módulo:", document.body.dataset.modulo);
//   console.log("[Permissões] lista de permissões:", permissoes);


//   // Define qual é o módulo desta página; 
//   // pode vir de uma variável global, do próprio select, ou do nome da rota.
//   // Por exemplo, num <body data-modulo="Clientes">:
//   const moduloAtual = document.body.dataset.modulo;  

//   // Encontra o objeto de permissão correspondente
//   const p = permissoes.find(x => x.modulo === moduloAtual);

//   // Se não existir ou não tiver acesso geral, bloqueia tudo:
//   if (!p || !p.acesso) {
//     document.querySelectorAll("input, select, textarea, button").forEach(el => {
//       el.disabled = true;
//     });
//     return;
//   }

//   // Se tiver acesso mas não puder cadastrar:
//   if (!p.cadastrar) {
//     document.querySelectorAll(".btnCadastrar").forEach(btn => btn.disabled = true);
//   }

//   // Se não puder alterar:
//   if (!p.alterar) {
//     document.querySelectorAll(".btnAlterar").forEach(btn => btn.disabled = true);
//   }

//   // Se não puder pesquisar:
//   if (!p.pesquisar) {
//     document.querySelectorAll(".btnPesquisar").forEach(btn => btn.disabled = true);
//   }

//   // Se for “apenas leitura”, desabilita todos os campos, deixando só o pesquisar habilitado:
//   if (p.leitura) {
//     document.querySelectorAll("input, select, textarea").forEach(el => el.readOnly = true);
//     document.querySelectorAll("button").forEach(btn => {
//       if (!btn.classList.contains("btnPesquisar")) btn.disabled = true;
//     });
//   }
// }





  