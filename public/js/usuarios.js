
import { fetchComToken } from '../../utils/utils.js';


const listaEmpresas = document.getElementById('listaEmpresas');

const campos = {
    buscaUsuario: "buscaUsuario",
    nome: "nome",
    sobrenome: "sobrenome",
    idusuario: "idusuario",
    email: "email",
    ativo: "ativo" // Adicionado
};

let clicouNaLista = false; // Flag de clique

// Colunas de permissão renderizadas por módulo no grid (uma célula por linha).
// Os acessos especiais (supremo/master/financeiro/comercial/rh/devs) não são mais
// por módulo — viram um único controle global (ver CAMPOS_ESPECIAIS_GLOBAL) aplicado
// a todos os módulos com "Acesso" marcado no momento de salvar.
const CAMPOS_PADRAO = ['acesso', 'cadastrar', 'alterar', 'pesquisar', 'apagar'];

// Nomes de módulo são gravados no banco "grudados" (ex.: "Ajustefinanceiro"), sem
// como separar as palavras algoritmicamente com segurança — por isso um mapa manual
// só pra exibição. O nome salvo/comparado (linha.dataset.modulo) continua o original.
const NOMES_MODULO_EXIBICAO = {
  'Ajustefinanceiro': 'Ajuste Financeiro',
  'Categoriafuncao': 'Categoria Função',
  'Centrocusto': 'Centro Custo',
  'Indiceanual': 'Índice Anual',
  'Localmontagem': 'Local Montagem',
  'Planocontas': 'Plano Contas',
  'Tipoconta': 'Tipo Conta',
  'Funcao': 'Função'
};

// Numa linha do grid, as demais permissões só ficam disponíveis se "Acesso ao Módulo"
// estiver marcado (mesma regra que existia nos checkboxes fixos antigos).
function aplicarRegraAcessoNaLinha(linha) {
  const chkAcesso = linha.querySelector('input[data-campo="acesso"]');
  if (!chkAcesso) return;
  const acessoMarcado = chkAcesso.checked;
  linha.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
    if (checkbox === chkAcesso) return;
    checkbox.disabled = !acessoMarcado;
    if (!acessoMarcado) {
      checkbox.checked = false;
    }
  });
}

// Qualquer usuário com acesso a esta tela pode conceder a permissão Devs a outro
// usuário — não há mais restrição de "só quem já é devs pode conceder devs".

// Acessos especiais (Admin Supremo, Master, Financeiro, Comercial, RH, Devs) não são
// mais por módulo — é um único controle (ver CadUsuarios.html,
// .acessos-especiais-global-row) aplicado, no momento de salvar, a todos os módulos
// que estiverem com "Acesso" marcado (ver btnsalvarPermissao). Não liga o Acesso
// sozinho (decisão: acesso especial não deve dar acesso ao módulo).
const CAMPOS_ESPECIAIS_GLOBAL = ['supremo', 'master', 'financeiro', 'comercial', 'rh', 'devs'];

function configurarAcessosEspeciaisGlobal() {
  CAMPOS_ESPECIAIS_GLOBAL.forEach(campo => {
    const chkGlobal = document.getElementById(`global-${campo}`);
    if (!chkGlobal) return;

    chkGlobal.addEventListener('change', () => {
      if (!chkGlobal.checked) return;

      const existeModuloComAcesso = Array.from(document.querySelectorAll('#corpoTabelaPermissoes tr'))
        .some(linha => linha.querySelector('input[data-campo="acesso"]')?.checked);

      if (!existeModuloComAcesso) {
        chkGlobal.checked = false;
        Swal.fire({
          icon: 'warning',
          title: 'Atenção',
          text: 'Nenhum módulo com "Acesso" marcado. Marque o Acesso do módulo antes de aplicar acessos especiais.'
        });
      }
    });
  });
}

// Reseta os checkboxes globais sempre que a grade é recarregada (nova empresa,
// novo usuário) — evita que um estado marcado de uma consulta anterior confunda.
function resetarAcessosEspeciaisGlobal() {
  CAMPOS_ESPECIAIS_GLOBAL.forEach(campo => {
    const chkGlobal = document.getElementById(`global-${campo}`);
    if (chkGlobal) chkGlobal.checked = false;
  });
}

document.addEventListener('DOMContentLoaded', configurarAcessosEspeciaisGlobal);


document.getElementById("Registrar").addEventListener("submit", async function (e) {
    e.preventDefault();
  
    const nome = document.getElementById("nome").value;
    const sobrenome = document.getElementById("sobrenome").value;
    const email = document.getElementById("email").value;
    const senha = document.getElementById("senha").value;
    const ativo = document.getElementById('ativo').checked;
    const idempresaDefault = document.getElementById("empresaDefaultSelect").value;
   // const empresaSelecionada = document.getElementById("listaEmpresas");
   const empresaSelecionadaUnica = document.getElementById("listaEmpresas").value; // Obtém o VALOR da opção selecionada
    let empresasParaEnviar = []; // Inicializa como array vazio

    // Se houver um valor selecionado, adicione-o ao array
    if (empresaSelecionadaUnica) {
        empresasParaEnviar.push(parseInt(empresaSelecionadaUnica, 10)); 
    }
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

    if (senha.length < 8 || !/[^A-Za-z0-9]/.test(senha)) {
      Swal.fire({
        icon: 'warning',
        title: 'Atenção',
        text: 'A senha deve ter pelo menos 8 caracteres e incluir pelo menos 1 caractere especial.',
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
      const dados = await fetchComToken("/auth/cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        //body: JSON.stringify({ nome, email, senha, sobrenome, ativo, empresas: empresaSelecionada })
        body: JSON.stringify({ nome, email, senha, sobrenome, ativo, idempresadefault: idempresaDefault })
        // body: JSON.stringify({ nome, sobrenome, email, ativo, idempresaDefault: idempresaDefault, empresas: empresasSelecionadas })
      });
  
      //const dados = await resposta.json();


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

  // Campo vazio aqui significa "não alterar a senha" (ver authController.js) —
  // só valida a senha quando o usuário realmente digitou uma senha nova.
  if (senha && (senha.length < 8 || !/[^A-Za-z0-9]/.test(senha))) {
    Swal.fire({
      icon: 'warning',
      title: 'Atenção',
      text: 'A senha deve ter pelo menos 8 caracteres e incluir pelo menos 1 caractere especial.',
    });
    return;
  }

  try {
    const dados = await fetchComToken("/auth/cadastro", {
      method: "PUT",  // Mudamos para PUT para indicar alteração
      headers: { "Content-Type": "application/json" },
       body: JSON.stringify({ nome, sobrenome, email, senha, email_original, ativo,idempresadefault: idempresaDefault, empresas: empresaSelecionada }),

    });

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

  
   if (nome && sobrenome && !email) {
    console.log("Entrou no verificarNomeCompleto","nome:", nome, "sobrenome:", sobrenome, "email:", email);
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

let idEmpresaDefaultSelecionada = '';

document.getElementById('empresaDefaultSelect').addEventListener('change', function () {
  
  const selectDefault = this.value;
  idEmpresaDefaultSelecionada = selectDefault;

  console.log("EMPRESA DEFAULT SELECIONADA NO SELECT USUARIOS", idEmpresaDefaultSelecionada);
  
});


 const getCampo = (key) => document.querySelector(campos[key]);
    // const setCampo = (key, value) => {
    //     const campo = getCampo(key);
    //     if (campo) {
    //         if (campo.type === "checkbox") {
    //             campo.checked = value === true || value === "true" || value === 1;
    //         } else {
    //             campo.value = value ?? "";
    //         }
    //     }
    // };

  const setCampo = (id, valor) => {
    // Tenta pegar o elemento pelo ID direto (caso passe "email") 
    // ou pelo mapeamento (caso passe campos.email)
    const el = document.getElementById(id);
    
    if (!el) {
        console.warn(`⚠️ ERRO: Campo com ID "${id}" não foi encontrado no HTML.`);
        return;
    }

    if (el.type === 'checkbox') {
        // !!valor converte (1, true, "true") para o booleano true
        el.checked = !!valor; 
    } else {
        // Se o valor for null/undefined, define como string vazia para não aparecer "undefined" no input
        el.value = valor ?? ""; 
    }
};




// async function verificarUsuarioExistenteFront() {

  
//   const buscaUsuario = document.getElementById('buscaUsuario').value.trim();
//   const nome = document.getElementById("nome").value.trim();
//   const sobrenome = document.getElementById("sobrenome").value.trim();
//   const email = document.getElementById("email").value.trim();
//   const ativo = document.getElementById('ativo').checked;
//   const idempresaDefault = document.getElementById("empresaDefaultSelect").value;
//   const empresaSelecionada = document.getElementById("listaEmpresas");
//   console.log("Entrou no verificarUsuarioExistenteFront", nome, sobrenome, email, ativo, idempresaDefault);

//   if (!nome || !sobrenome || !email) {
//     return; // Só verifica se os três estiverem preenchidos
//   } 
  
//   try {
    
//     const dados = await fetchComToken("/auth/verificarUsuario", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       //body: JSON.stringify({ nome, sobrenome, email, ativo, idempresaDefault: idempresaDefault, empresas: empresasSelecionadas }) // Envia idempresaDefault e empresas como array vazio,
//       body: JSON.stringify({ nome, sobrenome, email, ativo, idempresaDefault: idempresaDefault, empresas: empresaSelecionada }) // Envia idempresaDefault e empresas como array vazio,
//     });

//     console.log("USUARIOEXISTENTE", dados.usuarioExistente);

//     if (dados.usuarioExistente) {
//       if (dados.usuarioExistente.ativo) {
//         // Usuário ativo → só pode alterar
//         document.getElementById("btnCadastrar").style.display = "none";
//         document.getElementById("btnAlterar").style.display = "inline-block";

//         Swal.fire({
//           icon: "info",
//           title: "Usuário já cadastrado",
//           text: "Você pode atualizar os dados existentes."
//         });
//       } else {
//         // Usuário inativo → permitir reativação ou novo cadastro
//         document.getElementById("btnCadastrar").style.display = "inline-block";
//         document.getElementById("btnAlterar").style.display = "inline-block";

//         Swal.fire({
//           icon: "warning",
//           title: "Usuário inativo encontrado",
//           text: "Você pode cadastrar novamente ou reativar este usuário."
//         });
//       }
//     } else {
//       // Usuário não existe → cadastro permitido
//       document.getElementById("btnCadastrar").style.display = "inline-block";
//       document.getElementById("btnAlterar").style.display = "none";
      
//       Swal.fire({
//         icon: "info",
//         title: "Usuário não cadastrado",
//         text: "Nenhum usuário foi encontrado com esses dados. Você pode cadastrá-lo agora."
//       });
//     }

//   } catch (erro) {
//     console.error("Erro ao verificar usuário:", erro);
//   }
// }



async function verificarUsuarioExistenteFront() {
  const idUsuarioAtual = document.getElementById('idusuario').value;
  
  // CORREÇÃO 1: Se já existe um ID, significa que estamos EDITANDO.
  // Não precisa verificar "se existe" para dar alerta de novo cadastro.
  if (idUsuarioAtual && idUsuarioAtual !== "") {
    console.log("Editando usuário existente (ID: " + idUsuarioAtual + "). Ignorando verificação de existência.");
    return;
  }

  const nome = document.getElementById("nome").value.trim();
  const sobrenome = document.getElementById("sobrenome").value.trim();
  const email = document.getElementById("email").value.trim();
  const ativo = document.getElementById('ativo').checked;
  const idempresaDefault = document.getElementById("empresaDefaultSelect").value;
  
  // CORREÇÃO 3: Pegar o valor e não o elemento
  const idEmpresaLista = document.getElementById("listaEmpresas").value;

  console.log("Verificando disponibilidade para novo cadastro:", nome, email);

  if (!nome || !sobrenome || !email) {
    return; 
  } 
  
  try {
    const dados = await fetchComToken("/auth/verificarUsuario", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        nome, 
        sobrenome, 
        email, 
        ativo, 
        idempresaDefault, 
        empresas: [idEmpresaLista] 
      })
    });

   
    console.log("Resultado da verificação:", dados.usuarioExistente);

    if (dados.usuarioExistente) {
      if (dados.usuarioExistente.ativo) {
        document.getElementById("btnCadastrar").style.display = "none";
        document.getElementById("btnAlterar").style.display = "inline-block";

        Swal.fire({
          icon: "info",
          title: "Usuário já cadastrado",
          text: "Este e-mail já está em uso por um usuário ativo."
        });
      } else {
        document.getElementById("btnCadastrar").style.display = "inline-block";
        document.getElementById("btnAlterar").style.display = "inline-block";

        Swal.fire({
          icon: "warning",
          title: "Usuário inativo encontrado",
          text: "Este e-mail pertence a um usuário desativado. Você pode reativá-lo."
        });
      }
    } else {
      // CORREÇÃO 2: Apenas alterna os botões, sem disparar Alerta de "Não cadastrado"
      // Isso evita o erro chato enquanto o usuário ainda está preenchendo.
      document.getElementById("btnCadastrar").style.display = "inline-block";
      document.getElementById("btnAlterar").style.display = "none";
      
      console.log("Usuário disponível para novo cadastro.");
    }

  } catch (erro) {
    console.error("Erro ao verificar usuário:", erro);
  }
}

// Função para a busca simples pelo nome + sobrenome (ex: ao sair do campo)
// async function verificarNomeExistente() {
//   const nome = document.getElementById("buscaUsuario").value.trim();
//   const sobrenome = document.getElementById("sobrenome").value.trim();

//   if (!nome) return;  // Sem nome? nada a fazer

//   if (clicouNaLista) {
//     clicouNaLista = false;
//     return;  // Seleção manual da lista, não mostrar alertas
//   }

//   if (sobrenome !== "") return;  // Usuário já digitou sobrenome, pular alerta


//   try {
//     const resposta = await fetchComToken("/auth/verificarNomeExistente", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ nome }),
//     });

//     const dados = await resposta.json();

//     if (dados.nomeEncontrado) {
//       // Se o sobrenome já está preenchido, não mostra a mensagem aqui

//       if (!sobrenome) {
//         Swal.fire({
//           icon: "info",
//           title: "Nome encontrado",
//           text: "Digite também o sobrenome para refinar a busca.",
//         }).then(() => {
//            document.getElementById("nome").value = nome;
//            document.getElementById("sobrenome").focus();
          
//         });
//       }
//     } else {
//       const confirmacao = await Swal.fire({
//         icon: "question",
//         title: "Usuário não encontrado",
//         text: "Deseja cadastrar um novo usuário com esse nome?",
//         showCancelButton: true,
//         confirmButtonText: "Sim, cadastrar",
//         cancelButtonText: "Cancelar"
//       });

//       if (confirmacao.isConfirmed) {
//         document.getElementById("btnCadastrar").style.display = "inline-block";
//         document.getElementById("btnAlterar").style.display = "none";
//       }
//     }

//   } catch (erro) {
//     //console.error("Erro na busca por nome:", erro); // verificar se funciona com isso comentado
//   }
// }

async function verificarNomeExistente() {
  const nome = document.getElementById("buscaUsuario").value.trim();
  const sobrenome = document.getElementById("sobrenome").value.trim();

  console.log("Verificando nome existente:", nome, sobrenome);

  // 1. Se clicou na lista ou se o sobrenome já veio preenchido da lista, interrompe
  //if (clicouNaLista || (nome && sobrenome)) {
  if (clicouNaLista || (nome)) {
    console.log("Ignorando verificação automática: preenchimento via lista.");
    clicouNaLista = false; 
    return;
  }

  if (!nome) return;

  try {
    const dados = await fetchComToken("/auth/verificarNomeExistente", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome }),
    });

    if (dados.nomeEncontrado) {
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
      // Lógica de "Deseja cadastrar novo" permanece...
    }
  } catch (erro) {
    console.error("Erro na busca por nome:", erro);
  }
}

// async function verificarNomeCompleto() {
//   let nomeParaVerificar = document.getElementById(campos.buscaUsuario).value.trim();
    
//   // Se o campo de busca estiver vazio, pega o valor do campo "nome"
//   if (!nomeParaVerificar) {
//       nomeParaVerificar = document.getElementById(campos.nome).value.trim();
//   }
//   const sobrenome = document.getElementById(campos.sobrenome).value.trim();

//   console.log("Verificando nome completo:", nomeParaVerificar, sobrenome);

//   if (!nomeParaVerificar || !sobrenome) return;

//   console.log("VERIFICADO nome completo:", nomeParaVerificar, sobrenome);

//   try {
//     const dados = await fetchComToken("/auth/verificarNomeCompleto", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ nome: nomeParaVerificar, sobrenome }),
//     });

//     console.log("Resultado da verificação de nome completo:", dados);

//     if (dados.usuario) {
//      // Se o usuário já existe, preenche os campos
//       setCampo("email", dados.usuario.email);
//       setCampo("ativo", dados.usuario.ativo);

//       document.getElementById("btnCadastrar").style.display = "none";
//       document.getElementById("btnAlterar").style.display = "inline-block";

//       if (dados.usuario.email) {
//         carregarPermissoesEEmpresasDoUsuario(dados.usuario.email);
//       }
//     } else {
//       const confirmacao = await Swal.fire({
//         icon: "question",
//         title: "Usuário não encontrado",
//         text: "Deseja cadastrar um novo usuário?",
//         showCancelButton: true,
//         confirmButtonText: "Sim, cadastrar",
//         cancelButtonText: "Cancelar"
//       });

//       if (confirmacao.isConfirmed) {
//         document.getElementById("btnCadastrar").style.display = "inline-block";
//         document.getElementById("btnAlterar").style.display = "none";
//       }
//     }
//   } catch (erro) {
//     console.error("Erro ao verificar nome e sobrenome:", erro);
//   }
// }


//este é certo e funciona
// async function verificarNomeCompleto() {
//   // Tenta buscaUsuario, se vazio tenta nome
//   let nomeParaVerificar = document.getElementById(campos.buscaUsuario).value.trim();
//   if (!nomeParaVerificar) {
//     nomeParaVerificar = document.getElementById(campos.nome).value.trim();
//   }
//   const sobrenome = document.getElementById(campos.sobrenome).value.trim();

//   if (!nomeParaVerificar || !sobrenome) return;

//   try {
//     const dados = await fetchComToken("/auth/verificarNomeCompleto", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ nome: nomeParaVerificar, sobrenome }),
//     });

//     if (dados.usuario) {
//       // Mensagem de Usuário Encontrado
//       Swal.fire({
//         icon: 'success',
//         title: 'Usuário Encontrado!',
//         text: `Os dados de ${dados.usuario.nome} foram carregados.`,
//         timer: 2000,
//         showConfirmButton: false
//       });

//       // PREENCHIMENTO DOS CAMPOS
//       setCampo(campos.idusuario, dados.usuario.idusuario);
//       setCampo(campos.nome, dados.usuario.nome);
//       setCampo(campos.sobrenome, dados.usuario.sobrenome);
//       setCampo(campos.email, dados.usuario.email);
//       setCampo("email_original", dados.usuario.email); // CAMPO CRUCIAL PARA O PUT
//       setCampo("ativo", dados.usuario.ativo);

//       // Troca de botões
//       document.getElementById("btnCadastrar").style.display = "none";
//       document.getElementById("btnAlterar").style.display = "inline-block";

//       if (dados.usuario.email) {
//         await carregarPermissoesEEmpresasDoUsuario(dados.usuario.email);
//       }
//     } else {
//       // Lógica de novo cadastro permanece a mesma...
//     }
//   } catch (erro) {
//     console.error("Erro ao verificar nome completo:", erro);
//   }
// }


async function verificarNomeCompleto() {
    // 1. Pega os valores
    let nomeParaVerificar = document.getElementById(campos.buscaUsuario).value.trim();
    if (!nomeParaVerificar) {
        nomeParaVerificar = document.getElementById(campos.nome).value.trim();
    }
    const sobrenome = document.getElementById(campos.sobrenome).value.trim();

    // Só prossegue se tiver nome e sobrenome
    if (!nomeParaVerificar || !sobrenome) return;

    console.log("Iniciando busca no banco para:", nomeParaVerificar, sobrenome);

    try {
        // 2. Chama o backend
        const dados = await fetchComToken("/auth/verificarNomeCompleto", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nome: nomeParaVerificar, sobrenome }),
        });

        // NOTA: Se o fetchComToken já retorna o JSON, não use .json() aqui.
        console.log("Resposta do Servidor:", dados);

        if (dados && dados.usuario) {
            const u = dados.usuario;

            // 3. Alerta de Sucesso
            Swal.fire({
                icon: 'success',
                title: 'Usuário Encontrado!',
                text: `Dados de ${u.nome} carregados.`,
                timer: 1500,
                showConfirmButton: false
            });

            // 4. Preencher Frente (Cadastro)
            setCampo(campos.idusuario, u.idusuario);
            setCampo(campos.nome, u.nome);
            setCampo(campos.sobrenome, u.sobrenome);
            setCampo(campos.email, u.email);
            setCampo(campos.ativo, u.ativo);
            
            // Campo crucial para evitar erro de "E-mail em uso" no Alterar
            const elEmailOriginal = document.getElementById("email_original");
            if (elEmailOriginal) elEmailOriginal.value = u.email;

            // 5. PREENCHER O NOME NO VERSO (PERMISSÕES)
            const campoNomeVerso = document.getElementById("nome_usuario");
            if (campoNomeVerso) {
                campoNomeVerso.value = `${u.nome} ${u.sobrenome}`;
            }

            // 6. PREENCHER EMPRESA PADRÃO
            if (u.idempresadefault) {
                const idPadrao = String(u.idempresadefault); // Garante que seja string para comparar com o .value do select
                console.log("Sincronizando empresa padrão ID:", idPadrao);

                // Seleciona no select da FRENTE (Cadastro)
                const selectFrente = document.getElementById("empresaDefaultSelect");
                if (selectFrente) {
                    selectFrente.value = idPadrao;
                }
                atualizarLogoEmpresaDefault(idPadrao);

                // Seleciona no select do VERSO (Permissões)
                const selectVerso = document.getElementById("listaEmpresas");
                if (selectVerso) {
                    selectVerso.value = idPadrao;
                    
                    // IMPORTANTE: Dispara o evento 'change' manualmente. 
                    // Isso ativa o listener que você tem na linha 628 do Usuarios.js 
                    // e carrega os módulos/permissões automaticamente.
                    selectVerso.dispatchEvent(new Event('change'));
                }
            }

            // 7. Alternar botões
            document.getElementById("btnCadastrar").style.display = "none";
            document.getElementById("btnAlterar").style.display = "inline-block";

            // 8. Carregar Permissões e Empresas vinculadas
            if (u.email) {
                await carregarPermissoesEEmpresasDoUsuario(u.email);
            }

        } else {
            console.log("Usuário não encontrado no banco.");
            // Lógica de perguntar se quer cadastrar novo...
        }
    } catch (erro) {
        console.error("Erro na verificação:", erro);
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
     console.log('Lista completa de usuários:', usuarios);

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

// const listaUsuariosContainer = document.querySelector('#listaUsuarios'); 
// // Evento ao clicar em um usuário da lista
// listaUsuariosContainer.addEventListener('click', async (e) => {
//   console.log("Clicou na lista de usuários listaUsuariosContainer");
//   const item = e.target.closest('.usuario-item');
//   if (!item) return;

//   const idusuario = item.dataset.idusuario;

//   try {
//     // Buscar empresas vinculadas
//     const empresas = await fetchComToken(`/auth/usuarios/${idusuario}/empresas`);

//     console.log("Empresas vinculadas ao usuário:", empresas);
   
//     const [primeiroNome, ...resto] = item.dataset.nome.split(' ');
//     document.querySelector('#nome').value = primeiroNome;
//     document.querySelector('#sobrenome').value = item.dataset.sobrenome; // usa dataset diretamente
//     document.querySelector('#email').value = item.dataset.email;
//     document.querySelector('#email_original').value = item.dataset.email; // Armazena o email original para comparação
//     document.querySelector('#idusuario').value = idusuario; // hidden input


//     if (empresas.length === 0) {
//       // Nenhuma empresa vinculada, virar o flipbox
//       flipbox.classList.add('flip');
//     } else {
//       // Já possui vínculos, marcar checkboxes correspondentes
//       empresas.forEach(emp => {
//        // const checkbox = document.querySelector(`.empresa-checkbox[data-idempresa="${emp.idempresa}"]`);
//        console.log("ID Empresa no forEach:", emp );
//        const checkbox = document.querySelector(`input[type="checkbox"][data-idempresa="${emp.idempresa}"]`);

//         if (checkbox) checkbox.checked = true;
//       });

//       // Opcional: permitir editar ou apenas visualizar
//       flipbox.classList.add('flip'); // Se desejar continuar para permissões
//     }

//   } catch (erro) {
//     console.error('Erro ao buscar empresas do usuário:', erro);
//     Swal.fire('Erro', 'Erro ao buscar empresas vinculadas.', 'error');
//   }
// });


const listaUsuariosContainer = document.querySelector('#listaUsuarios'); 

listaUsuariosContainer.addEventListener('click', async (e) => {
    console.log("Clicou na lista de usuários listaUsuariosContainer");
    const item = e.target.closest('.usuario-item');
    if (!item) return;

    // Marcamos que a seleção veio da lista para evitar que o blur do campo dispare alertas desnecessários
    clicouNaLista = true; 

    const idusuario = item.dataset.idusuario;
    const emailUsuario = item.dataset.email;    
    

    try {
        // 1. Preenchimento dos campos da FRENTE
        const [primeiroNome, ...resto] = item.dataset.nome.split(' ');
        document.querySelector('#nome').value = primeiroNome;
        document.querySelector('#sobrenome').value = item.dataset.sobrenome;
        document.querySelector('#email').value = emailUsuario;
        document.querySelector('#email_original').value = emailUsuario;
        document.querySelector('#idusuario').value = idusuario;

        // 2. Preenchimento do Nome no VERSO (Permissões)
        const campoUsuarioVerso = document.querySelector('#nome_usuario');
        if (campoUsuarioVerso) {
            campoUsuarioVerso.value = `${primeiroNome} ${item.dataset.sobrenome}`;
        }

        // 3. Sincronização da Empresa Padrão (Frente e Verso)
        const idEmpresaPadrao = item.dataset.idempresadefault || item.dataset.idempresaDefault;
        if (idEmpresaPadrao) {
            // Select da Frente
            const selectFrente = document.querySelector('#empresaDefaultSelect');
            if (selectFrente) selectFrente.value = idEmpresaPadrao;
            atualizarLogoEmpresaDefault(idEmpresaPadrao);

            // Select do Verso
            const selectVerso = document.querySelector('#listaEmpresas');
            if (selectVerso) {
                selectVerso.value = idEmpresaPadrao;
                // Disparar o evento change para carregar os módulos daquela empresa no verso
                selectVerso.dispatchEvent(new Event('change'));
            }
        }

        // 4. Buscar e marcar empresas vinculadas (Checkboxes)
        const empresas = await fetchComToken(`/auth/usuarios/${idusuario}/empresas`);
        console.log("Empresas vinculadas:", empresas);

        // Limpar todos os checkboxes antes de marcar os novos
        document.querySelectorAll('input[type="checkbox"][data-idempresa]').forEach(chk => chk.checked = false);

        if (empresas && Array.isArray(empresas)) {
            empresas.forEach(emp => {
                // Aqui garantimos que buscamos pelo ID numérico retornado do banco
                const checkbox = document.querySelector(`input[type="checkbox"][data-idempresa="${emp.idempresa}"]`);
                if (checkbox) checkbox.checked = true;
            });
        }

        // 5. Carregar permissões específicas (se houver função para isso)
        if (emailUsuario) {
            await carregarPermissoesEEmpresasDoUsuario(emailUsuario);
        }

        // 6. Virar o Card
        flipbox.classList.add('flip');

    } catch (erro) {
        console.error('Erro ao processar dados do usuário:', erro);
        Swal.fire('Erro', 'Não foi possível carregar todos os dados do usuário.', 'error');
    } finally {
        // Resetamos a flag após um pequeno delay para garantir que eventos de input não conflitem
        setTimeout(() => { clicouNaLista = false; }, 300);
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
        li.dataset.idempresadefault = usuario.idempresadefault;
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

  if (e.target.tagName === 'LI') {
    clicouNaLista = true; // Define que foi um clique na lista
  //  const nomeCompleto = `${nome} ${sobrenome}`;
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
  //  document.getElementById('nome_usuario').value = nomeCompleto;
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
      // 🔽 Aqui começa a parte nova: buscar empresas vinculadas
     try {

      console.log("ID USUARIO PARA BUSCAR EMPRESAS:", idusuario);

      const empresas = await fetchComToken(`/auth/usuarios/${idusuario}/empresas`);



      if (!Array.isArray(empresas)) {
        console.error('Resposta inesperada ao buscar empresas:', empresas);
        Swal.fire('Erro', 'Erro ao buscar empresas do usuário.', 'error');
        return;
      }

      console.log("EMPRESAS VINCULADAS AO USUARIO:", empresas);
      if (empresas.length === 0) {
        // Nenhuma empresa vinculada → vira flipbox
        document.querySelector('.flip-container').classList.add('flip');

      } else {
        // Marca checkboxes das empresas vinculadas
        empresas.forEach(emp => {
          console.log("ID Empresa no forEach de PERMISSAO:", emp.idempresa, emp.ativo );
          const checkbox = document.querySelector(`.empresa-checkbox[data-idempresa="${emp.idempresa}"]`);

          if (checkbox) checkbox.checked = true;
          //if (checkbox) checkbox.checked = emp.ativo;
          console.log("Checkbox encontrado para empresa ID:", emp.idempresa, checkbox);
        });

        // Mostra o lado de permissões
        document.querySelector('.flip-container').classList.add('flip');

      }

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
  atualizarLogoEmpresaDefault(null);
 
}

document.addEventListener('click', (event) => {
  const inputBusca = document.getElementById('buscaUsuario');
  const lista = document.getElementById('listaUsuarios');

  if (!inputBusca.contains(event.target) && !lista.contains(event.target)) {
    lista.innerHTML = '';
    lista.style.display = 'none';
  }
});

// document.getElementById('buscaUsuario').addEventListener('blur', () => {
//   setTimeout(() => {
//     const lista = document.getElementById('listaUsuarios');
//     lista.innerHTML = '';
//     lista.style.display = 'none';
//   }, 150); // tempo suficiente para permitir clique em item
// });

document.getElementById('buscaUsuario').addEventListener('blur', function () {  
  formatarNome("buscaUsuario");
  setTimeout(() => {
    // Se o usuário clicou na lista, o evento de clique já terá setado clicouNaLista = true
    if (!clicouNaLista) {
      verificarNomeExistente();
    }
    // Removido o reset da flag daqui para não atropelar o preenchimento
  }, 300); // Aumentado para 300ms por segurança
});

document.getElementById("btnCadastrar").addEventListener("click", function (e) {
  e.preventDefault();
  document.getElementById("btnCadastrarReal").click();
});

// async function carregarPermissoesEEmpresasDoUsuario(email) {
//   try {
//     const dados = await fetchComToken(`/auth/permissoes-usuario/${email}`);
//    // const dados = await resposta.json();// verificar se funciona com isso comentado

//     if (!dados) {
//       console.warn("Nenhum dado de permissão ou empresa retornado para o usuário:", email);
//       // Opcional: Limpar ou definir valores padrão para as variáveis originais
//       permissoesOriginais = {};
//       empresasOriginais = [];
//       return;
//     }


//     if (Array.isArray(dados.empresas)) {
//             empresasOriginais = [...dados.empresas]; // Cria uma cópia para evitar modificações diretas
//     } else {
//         empresasOriginais = []; // Garante que seja um array vazio se não vier no formato esperado
//         console.warn("Dados de empresas não estão no formato de array para o usuário:", email, dados.empresas);
//     }
//     console.log("Empresas Originais Inicializadas:", empresasOriginais);
    

//     // Marca os checkboxes de permissões
//     dados.permissoes.forEach(permissao => {
//       const checkbox = document.querySelector(
//         `.modulo-container[data-modulo="${permissao.modulo}"] input[type="checkbox"][data-tipo="${permissao.tipo}"]`
//       );
//       if (checkbox) {
//         console.log("CHECKBOX", checkbox);
//         checkbox.checked = true;
//       }
       
//     });

//     // Marca as empresas selecionadas
//     // const checkboxesEmpresa = document.querySelectorAll('.checkbox-empresa');
//     // checkboxesEmpresa.forEach(checkbox => {
//     //   if (dados.empresas.includes(parseInt(checkbox.dataset.idempresa))) {
//     //     checkbox.checked = true;
//     //   }
//     // });

   

//   } catch (erro) {
//     console.error("Erro ao carregar permissões e empresas:", erro);
//   }
// }

async function carregarPermissoesEEmpresasDoUsuario(email) {
  try {
    const dados = await fetchComToken(`/auth/permissoes-usuario/${email}`);

    // 1. Verificação básica de retorno
    if (!dados) {
      console.warn("Nenhum dado retornado para:", email);
      window.permissoesOriginais = {};
      window.empresasOriginais = [];
      return;
    }

    // 2. Tratamento das Empresas (Garante que seja Array antes do log/uso)
    if (dados.empresas && Array.isArray(dados.empresas)) {
      window.empresasOriginais = [...dados.empresas];
    } else {
      window.empresasOriginais = [];
      console.warn("Empresas não encontradas ou formato inválido para:", email);
    }
    console.log("Empresas Originais Inicializadas:", window.empresasOriginais);

    // 3. Tratamento das Permissões (PROTEÇÃO CONTRA O ERRO DO FOREACH)
    if (dados.permissoes && Array.isArray(dados.permissoes)) {
      dados.permissoes.forEach(permissao => {
        const checkbox = document.querySelector(
          `.modulo-container[data-modulo="${permissao.modulo}"] input[type="checkbox"][data-tipo="${permissao.tipo}"]`
        );
        if (checkbox) {
          console.log("Marcando checkbox permissão:", permissao.modulo, permissao.tipo);
          checkbox.checked = true;
        }
      });
    } else {
      console.log("Nenhuma permissão específica encontrada no banco para este usuário.");
    }

  } catch (erro) {
    console.error("Erro ao carregar permissões e empresas:", erro);
  }
}

async function preencherUsuarioPeloEmail(email) {
  try {
    const dados = await fetchComToken(`/auth/email/${encodeURIComponent(email)}`);
 
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
let empresasOriginais = []; // Variável global para armazenar as empresas do usuário (idempresa, ativo)

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

    if (idusuario) {
      console.log("Vai entrar em carregarEmpresasUsuario IdUsuario", idusuario);
      await carregarEmpresasUsuario(idusuario); // preenche empresasOriginais e o select "Copiar de"

      const selectEmpresaElement = document.getElementById("listaEmpresas");
      const empresaAlvoAtual = selectEmpresaElement ? selectEmpresaElement.value : "";

      if (empresaAlvoAtual && empresaAlvoAtual !== '' && empresaAlvoAtual !== 'Selecione') {
          await carregarGradePermissoes(idusuario, empresaAlvoAtual);
      } else {
          console.warn("Ainda sem empresa selecionada para carregar o grid de permissões.");
          renderizarGradePermissoes([]);
      }
    } else {
        console.warn("ID de usuário não encontrado ao virar para o verso para carregar permissões/empresas.");
        empresasOriginais = [];
        renderizarGradePermissoes([]);
    }

    console.log("Entrou no flipBox - Flipped.");
  } else {
    // Se virou para a frente (cadastro de usuário)
    console.log("Voltou para a frente do cadastro de usuário.");
    // Opcional: Limpar campos do verso ao voltar, se necessário.
    limparListaEmpresas(); // Se essa função limpa o HTML do container de empresas
      empresasOriginais = []; // E garante que a variável global esteja vazia
      renderizarGradePermissoes([]); // Limpa o grid de permissões
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
  const idEmpresaAtual = document.getElementById("listaEmpresas").value;
  const empresaAtiva = document.getElementById("empresaAtiva").checked;

  if (!idusuario) {
    Swal.fire("Atenção", "Selecione um usuário primeiro.", "warning");
    return;
  }
  if (!idEmpresaAtual || idEmpresaAtual === 'all' || idEmpresaAtual === "Selecione") {
    Swal.fire("Atenção", "Selecione uma empresa válida para aplicar as permissões.", "warning");
    return;
  }

  const linhas = document.querySelectorAll('#corpoTabelaPermissoes tr');
  if (linhas.length === 0) {
    Swal.fire("Aviso", "Nenhum módulo disponível para salvar nesta empresa.", "info");
    return;
  }

  // Os acessos especiais vêm do controle único (global-supremo, global-master, ...)
  // e são aplicados a todo módulo com "Acesso" marcado — não existem mais como
  // checkbox por linha (ver .acessos-especiais-global-row em CadUsuarios.html).
  const especiaisGlobais = {};
  CAMPOS_ESPECIAIS_GLOBAL.forEach(campo => {
    especiaisGlobais[campo] = document.getElementById(`global-${campo}`)?.checked || false;
  });

  const permissoes = Array.from(linhas).map(linha => {
    const lerCampo = campo => linha.querySelector(`input[data-campo="${campo}"]`)?.checked || false;
    const flags = { modulo: linha.dataset.modulo, idmodulo: linha.dataset.idmodulo };
    CAMPOS_PADRAO.forEach(campo => { flags[campo] = lerCampo(campo); });
    CAMPOS_ESPECIAIS_GLOBAL.forEach(campo => { flags[campo] = flags.acesso && especiaisGlobais[campo]; });
    return flags;
  });

  const payload = { idusuario, ativo: empresaAtiva, permissoes };

  console.log("PAYLOAD LOTE", payload);

  try {
    const dados = await fetchComToken("/permissoes/cadastro-lote", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        'idempresa': idEmpresaAtual
      },
      body: JSON.stringify(payload)
    });

    if (dados && dados.sucesso) {
      Swal.fire("Sucesso", "Permissões salvas com sucesso!", "success");

      // Garante que a empresa recém-salva conste em empresasOriginais com o status atual
      empresasOriginais = empresasOriginais.filter(emp => emp.idempresa !== String(idEmpresaAtual));
      empresasOriginais.push({ idempresa: String(idEmpresaAtual), ativo: empresaAtiva });
      atualizarSelectCopiarDe();
    } else {
      Swal.fire("Erro", dados?.erro || "Erro ao salvar permissões.", "error");
    }

  } catch (err) {
    console.error("Erro ao salvar permissões:", err);
    Swal.fire("Erro", "Erro inesperado ao salvar permissões.", "error");
  }
});

// Copia a grade de permissões de uma empresa de origem para a empresa atualmente selecionada,
// respeitando os módulos disponíveis na empresa de DESTINO (não insere módulo que não existe nela).
async function copiarPermissoesDeEmpresa(idusuario, idEmpresaOrigem, idEmpresaDestino) {
  const [modulosOrigem, modulosDestino] = await Promise.all([
    fetchComToken(`/permissoes/grade/${idusuario}`, { method: 'GET', headers: { idempresa: idEmpresaOrigem } }),
    fetchComToken(`/permissoes/grade/${idusuario}`, { method: 'GET', headers: { idempresa: idEmpresaDestino } })
  ]);

  const porModuloOrigem = new Map((modulosOrigem || []).map(m => [m.modulo, m]));

  const modulosCopiados = (modulosDestino || []).map(m => {
    const origem = porModuloOrigem.get(m.modulo);
    if (!origem) return m; // módulo não existe na empresa de origem: mantém como estava na de destino
    return { ...m, ...origem, idmodulo: m.idmodulo, modulo: m.modulo };
  });

  renderizarGradePermissoes(modulosCopiados);
}

document.getElementById('btnCopiarPermissoes').addEventListener('click', async function () {
  const idusuario = document.getElementById('idusuario').value;
  const idEmpresaOrigem = document.getElementById('empresaOrigemCopia').value;
  const idEmpresaDestino = document.getElementById('listaEmpresas').value;

  if (!idusuario) {
    return Swal.fire('Atenção', 'Selecione um usuário primeiro.', 'warning');
  }
  if (!idEmpresaDestino || idEmpresaDestino === 'all' || idEmpresaDestino === 'Selecione') {
    return Swal.fire('Atenção', 'Selecione a empresa de destino antes de copiar.', 'warning');
  }
  if (!idEmpresaOrigem) {
    return Swal.fire('Atenção', 'Selecione a empresa de origem para copiar as permissões.', 'warning');
  }
  if (idEmpresaOrigem === idEmpresaDestino) {
    return Swal.fire('Atenção', 'Selecione uma empresa de origem diferente da empresa atual.', 'warning');
  }

  try {
    await copiarPermissoesDeEmpresa(idusuario, idEmpresaOrigem, idEmpresaDestino);
    Swal.fire('Copiado', 'Permissões copiadas para revisão. Ajuste o que for necessário e clique em "Salvar Todas as Permissões".', 'success');
  } catch (err) {
    console.error('Erro ao copiar permissões de outra empresa:', err);
    Swal.fire('Erro', 'Erro ao copiar permissões da empresa selecionada.', 'error');
  }
});

// Popula o select "Copiar permissões de" com as empresas em que o usuário já é ativo,
// excluindo a empresa atualmente selecionada em "listaEmpresas".
function atualizarSelectCopiarDe() {
  const select = document.getElementById('empresaOrigemCopia');
  if (!select) return;

  const idEmpresaAtual = document.getElementById('listaEmpresas').value;
  const valorAnterior = select.value;
  // Nome de exibição vem das <option> já carregadas em #listaEmpresas (por carregarEmpresas()),
  // não do localStorage.empresas — este só guarda {id, ativo}, sem o nome da empresa.
  const opcoesListaEmpresas = document.getElementById('listaEmpresas').options;

  select.innerHTML = '<option value="" selected disabled>Selecione empresa de origem</option>';

  empresasOriginais
    .filter(emp => emp.idempresa !== String(idEmpresaAtual))
    .forEach(emp => {
      const opcaoOrigem = Array.from(opcoesListaEmpresas).find(o => o.value === emp.idempresa);
      const option = document.createElement('option');
      option.value = emp.idempresa;
      option.textContent = opcaoOrigem ? opcaoOrigem.textContent : `Empresa ${emp.idempresa}`;
      select.appendChild(option);
    });

  if (Array.from(select.options).some(o => o.value === valorAnterior)) {
    select.value = valorAnterior;
  }
}


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
        console.log("Carregando empresas do usuário com ID:", idusuario);
        const empresasDoUsuario = await fetchComToken(`/auth/usuarios/${idusuario}/empresas`);
        console.log("Empresas DO USUÁRIO carregadas (para empresasOriginais):", empresasDoUsuario);

        if (Array.isArray(empresasDoUsuario)) {
            // Mapeie apenas os IDs das empresas que o usuário já possui
            //empresasOriginais = empresasDoUsuario.map(emp => String(emp.idusuario, emp.ativo)); // Converte para string para consistência com `value` do select
            empresasOriginais = empresasDoUsuario.map(emp => ({ 
                idempresa: String(emp.idempresa), 
                ativo: emp.ativo 
            }));
            console.log("empresasOriginais inicializada com:", empresasOriginais);
        } else {
            empresasOriginais = [];
            console.warn("Formato inesperado para empresas do usuário:", empresasDoUsuario);
        }

    } catch (e) {
        console.error("Erro ao carregar empresas do usuário para inicializar empresasOriginais:", e);
        empresasOriginais = []; // Garante que seja vazio em caso de erro
    }

    atualizarSelectCopiarDe();
}

// function limparListaEmpresas() {
//   const container = document.getElementById('listaEmpresas');
//   container.innerHTML = '';
//   empresasOriginais = [];
// }

function limparListaEmpresas() {
  const select = document.getElementById('listaEmpresas');
  if (select) {
      select.value = ""; // Apenas volta para "Selecione Empresa"
  }
  empresasOriginais = []; // Limpa o estado da memória, mas mantém o HTML
}

// Renderiza o grid de permissões (uma linha por módulo) a partir dos dados
// retornados por `/permissoes/grade/:idusuario` (ou de uma cópia de outra empresa).
function renderizarGradePermissoes(modulos) {
  const corpo = document.getElementById('corpoTabelaPermissoes');
  if (!corpo) return;
  corpo.innerHTML = '';
  resetarAcessosEspeciaisGlobal();

  (modulos || []).forEach(m => {
    const linha = document.createElement('tr');
    linha.dataset.modulo = m.modulo;
    linha.dataset.idmodulo = m.idmodulo;

    const celModulo = document.createElement('td');
    celModulo.textContent = NOMES_MODULO_EXIBICAO[m.modulo] || m.modulo;
    celModulo.className = 'celula-modulo';
    linha.appendChild(celModulo);

    CAMPOS_PADRAO.forEach(campo => {
      const td = document.createElement('td');
      td.dataset.col = campo;

      const container = document.createElement('div');
      container.className = 'checkbox-container';

      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.className = 'checkbox-input';
      chk.id = `chk-${m.idmodulo}-${campo}`;
      chk.dataset.campo = campo;
      chk.checked = Boolean(m[campo]);
      chk.disabled = campo !== 'acesso' && !m.acesso;
      if (campo === 'acesso') {
        chk.addEventListener('change', () => aplicarRegraAcessoNaLinha(linha));
      }

      const label = document.createElement('label');
      label.className = 'checkbox-permission';
      label.htmlFor = chk.id;
      label.innerHTML = '<span class="line line1"></span><span class="line line2"></span>';

      container.appendChild(chk);
      container.appendChild(label);
      td.appendChild(container);
      linha.appendChild(td);
    });

    const tdLimpar = document.createElement('td');
    const btnLimparLinha = document.createElement('button');
    btnLimparLinha.type = 'button';
    btnLimparLinha.className = 'btn-limpar-linha';
    btnLimparLinha.textContent = 'Limpar';
    btnLimparLinha.addEventListener('click', () => limparLinhaPermissoes(linha));
    tdLimpar.appendChild(btnLimparLinha);
    linha.appendChild(tdLimpar);

    corpo.appendChild(linha);
  });

  // Reflete no controle único de "Acessos Especiais" o que já está salvo no banco:
  // marca cada checkbox global se ALGUM módulo já tiver aquele campo true.
  CAMPOS_ESPECIAIS_GLOBAL.forEach(campo => {
    const chkGlobal = document.getElementById(`global-${campo}`);
    if (chkGlobal) chkGlobal.checked = (modulos || []).some(m => Boolean(m[campo]));
  });
}

// Desmarca todas as permissões de uma linha (módulo) do grid.
function limparLinhaPermissoes(linha) {
  linha.querySelectorAll('input[type="checkbox"]').forEach(chk => { chk.checked = false; });
  aplicarRegraAcessoNaLinha(linha);
}

document.getElementById('btnLimparTudoPermissoes').addEventListener('click', function (e) {
  e.preventDefault();
  document.querySelectorAll('#corpoTabelaPermissoes tr').forEach(limparLinhaPermissoes);
});

// Busca todos os módulos disponíveis na empresa informada + permissões do usuário
// e renderiza o grid. Base do fluxo normal (empresa já selecionada) e do "copiar de".
async function carregarGradePermissoes(idusuario, idempresa) {
  if (!idusuario || !idempresa) {
    renderizarGradePermissoes([]);
    return;
  }
  try {
    const modulos = await fetchComToken(`/permissoes/grade/${idusuario}`, {
      method: 'GET',
      headers: { idempresa }
    });
    renderizarGradePermissoes(Array.isArray(modulos) ? modulos : []);
  } catch (err) {
    console.error('Erro ao carregar grade de permissões:', err);
    renderizarGradePermissoes([]);
  }
}

//função para limpar o grid de permissões
function limparCheckboxesPermissao() {
  renderizarGradePermissoes([]);
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
    atualizarLogoEmpresaDefault(valorParaSelecionar);

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


// async function carregarEmpresas(selectIds = ['listaEmpresas', 'empresaDefaultSelect']) {
//     try {
//         console.log("Carregando empresas...");
//         const empresas = await fetchComToken('auth/empresas');
//         console.log("Empresas carregadas:", empresas);            

//         selectIds.forEach(id => {
//             const selectElement = document.getElementById(id);

//             if (selectElement) {
//                 selectElement.innerHTML = ''; // Limpa todas as opções

//                 //let defaultOptionText = "Selecione uma empresa";
//                 // if (id === 'listaEmpresas') {
//                 //     defaultOptionText = "Todas as empresas";
//                 // }
//                 const defaultOption = document.createElement('option');
//                 defaultOption.value = "";
//                 defaultOption.textContent = "Selecione Empresa";
//                 defaultOption.selected = true;
//                 defaultOption.disabled = true;
//                 selectElement.appendChild(defaultOption);

//                 empresas.forEach(emp => {
//                     const option = document.createElement('option');
//                     option.value = String(emp.idempresa); // Mantenha como String
//                     option.textContent = emp.nmfantasia;
//                     selectElement.appendChild(option);
//                 }); 
//                 console.log(`Select #${id} preenchido com ${empresas.length + 1} opções.`);
//             } else {
//                 console.error(`ERRO CRÍTICO: Elemento select com ID '${id}' NÃO ENCONTRADO no DOM.`); // Altere para error
//             }
//         });

//     } catch (error) {
//         console.error('Erro ao carregar empresas:', error);
//         Swal.fire({
//             icon: 'error',
//             title: 'Erro',
//             text: 'Não foi possível carregar a lista de empresas.'
//         });
//     }
// }

let empresasCarregadas = [];

// Remove acentos/espaços/prefixo "JA" para comparar o alt da logo com o nmfantasia do banco
function normalizarNomeEmpresa(texto) {
    return String(texto || '')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toUpperCase()
        .replace(/^JA[_\-\s]*/, '')
        .replace(/[^A-Z0-9]/g, '');
}

function getIdEmpresaPorAlt(alt) {
    const codigo = normalizarNomeEmpresa(alt);
    const empresa = empresasCarregadas.find(emp => {
        const nome = normalizarNomeEmpresa(emp.nmfantasia);
        return nome === codigo || nome.includes(codigo) || codigo.includes(nome);
    });
    return empresa ? String(empresa.idempresa) : null;
}

// Tira a classe "minilogos" da empresa padrão (fica em destaque, maior) e devolve às demais
function atualizarLogoEmpresaDefault(idempresa) {
    const logos = document.querySelectorAll('#logotipoEmpresas > div');
    logos.forEach(div => {
        const img = div.querySelector('img');
        const idLogo = img ? getIdEmpresaPorAlt(img.alt) : null;
        div.classList.toggle('minilogos', !(idempresa && idLogo === String(idempresa)));
    });
}

// Define a empresa padrão a partir do clique na logo, refletindo no select e disparando o change
function selecionarEmpresaDefaultPorId(idempresa) {
    if (!idempresa) return;

    const selectFrente = document.getElementById('empresaDefaultSelect');
    if (selectFrente) {
        selectFrente.value = idempresa;
        selectFrente.dispatchEvent(new Event('change'));
    }

    const selectVerso = document.getElementById('listaEmpresas');
    if (selectVerso) {
        selectVerso.value = idempresa;
        selectVerso.dispatchEvent(new Event('change'));
    }

    atualizarLogoEmpresaDefault(idempresa);
}

document.querySelectorAll('#logotipoEmpresas > div').forEach(div => {
    div.addEventListener('click', function () {
        const img = this.querySelector('img');
        const idempresa = img ? getIdEmpresaPorAlt(img.alt) : null;
        if (!idempresa) {
            console.warn('Não foi possível identificar a empresa pela logo clicada:', img?.alt);
            return;
        }
        selecionarEmpresaDefaultPorId(idempresa);
    });
});

async function carregarEmpresas(selectIds = ['empresaDefaultSelect', 'listaEmpresas']) {
    try {
        const empresas = await fetchComToken('auth/empresas');
        if (!empresas) return;

        empresasCarregadas = empresas;

        selectIds.forEach(id => {
            const selectElement = document.getElementById(id);
            if (selectElement) {
                selectElement.innerHTML = ''; // Limpa
                
                // Opção padrão
                const defaultOption = document.createElement('option');
                defaultOption.value = "";
                defaultOption.textContent = "Selecione Empresa";
                defaultOption.disabled = true;
                defaultOption.selected = true;
                selectElement.appendChild(defaultOption);

                // Preenche com os dados do banco
                empresas.forEach(emp => {
                    const option = document.createElement('option');
                    option.value = String(emp.idempresa);
                    option.textContent = emp.nmfantasia;
                    selectElement.appendChild(option);
                });
            } else {
                console.warn(`Aviso: Elemento #${id} não encontrado nesta tela.`);
            }
        });
    } catch (error) {
        console.error('Erro ao carregar empresas:', error);
    }
}

document.getElementById('listaEmpresas').addEventListener('change', function () {
  const idempresa = this.value;
  idEmpresaSelecionada = idempresa;

  console.log("EMPRESA SELECIONADA NO SELECT PERMISSOES", idEmpresaSelecionada);

  // O checkbox "Empresa Ativa" reflete o vínculo do USUÁRIO com a empresa (usuarioempresas.ativo),
  // não o cadastro da empresa em si — por isso a fonte é empresasOriginais, não a lista global de empresas.
  const empresaVinculada = empresasOriginais.find(emp => emp.idempresa === String(idempresa));
  const ativoCheckbox = document.getElementById('empresaAtiva');
  if (ativoCheckbox) {
    ativoCheckbox.checked = empresaVinculada ? empresaVinculada.ativo : false;
  }

  atualizarSelectCopiarDe();

  const idusuario = document.getElementById('idusuario').value;
  if (idusuario && idempresa && idempresa !== 'all') {
    carregarGradePermissoes(idusuario, idempresa);
  } else {
    renderizarGradePermissoes([]);
  }
});

document.addEventListener('DOMContentLoaded', async () => {
  console.log("DOMContentLoaded disparado. Iniciando carregamento de dados...");
  await carregarEmpresas(['empresaDefaultSelect', 'listaEmpresas']);
  console.log("--> carregarEmpresas() concluído.");


  const btnFechar = document.getElementById('btnFechar');
  if (btnFechar) {
    btnFechar.addEventListener('click', () => {
      window.location.href = 'login.html'; // Substitua pelo caminho correto se estiver em outra pasta
    });
  }

});