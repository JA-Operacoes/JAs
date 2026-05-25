
import { fetchComToken } from '../../utils/utils.js';


const acessoCheckbox = document.getElementById('Acesso');
const listaEmpresas = document.getElementById('listaEmpresas');
const moduloSelect = document.getElementById('modulo');

const campos = {
    buscaUsuario: "buscaUsuario",
    nome: "nome",
    sobrenome: "sobrenome",
    idusuario: "idusuario",
    email: "email",
    ativo: "ativo" // Adicionado
};

let clicouNaLista = false; // Flag de clique

// Obtém todas as outras checkboxes de permissões
const outrasPermissoes = [
    document.getElementById('Cadastrar'),
    document.getElementById('Alterar'),
    document.getElementById('Pesquisar'),
    document.getElementById('Apagar'),
    document.getElementById('Master'),
    document.getElementById('Financeiro'),
    document.getElementById('AdminSupremo'),
    document.getElementById('Comercial'),
    document.getElementById('Devs')
];


function verificarE_HabilitarPermissoes() {

  console.log("ENTROU EM VERIFICARHABILITARPERMISSAO");
    const empresaPreenchida = listaEmpresas.value !== '' && listaEmpresas.value !== 'Selecione Empresa';
    const moduloPreenchido = moduloSelect.value !== '' && moduloSelect.value !== 'choose';
       
    const podeHabilitarAcesso = empresaPreenchida && moduloPreenchido;
    acessoCheckbox.disabled = !podeHabilitarAcesso;

    if (!podeHabilitarAcesso) {
        acessoCheckbox.checked = false;
    }    

    const acessoMarcado = acessoCheckbox.checked;
    outrasPermissoes.forEach(checkbox => {
        checkbox.disabled = !acessoMarcado;
        if (!acessoMarcado) {
            checkbox.checked = false;
        }
    });
}

acessoCheckbox.addEventListener('change', verificarE_HabilitarPermissoes);
listaEmpresas.addEventListener('change', verificarE_HabilitarPermissoes);
moduloSelect.addEventListener('change', verificarE_HabilitarPermissoes);

document.addEventListener('DOMContentLoaded', verificarE_HabilitarPermissoes);


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
  
    });
   
    console.log("DADOS ALTERADOS", dados);

    console.log("Dados Mensagem", dados.mensagem);    

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
      let moduloAtual = "";

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
          permissoesOriginais = { modulo: null, acesso: false, cadastrar: false, alterar: false, pesquisar: false, apagar: false };
      }
    } else {
        console.warn("ID de usuário não encontrado ao virar para o verso para carregar permissões/empresas.");
        empresasOriginais = [];
        permissoesOriginais = { modulo: null, acesso: false, cadastrar: false, alterar: false, pesquisar: false, apagar: false };
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
      permissoesOriginais = { modulo: null, acesso: false, cadastrar: false, alterar: false, pesquisar: false, apagar: false };
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
  //const empresasAtualmenteSelecionadas = [idEmpresaAtual];
  const empresaAtiva = document.getElementById("empresaAtiva").checked;

  const empresasAtualmenteSelecionadas = [{
    idempresa: String(idEmpresaAtual), // Use idempresa para ser consistente com o backend
    ativo: empresaAtiva
  }];
  
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
  
 // const empresasSelecionadas = [empresaSelecionadaUnica];
  
  console.log("EMPRESA SELECIONADA BT SALVAR", empresaSelecionada);

  // if (!empresaSelecionadas.length) {
  //   Swal.fire("Atenção", "Selecione ao menos uma empresa.", "warning");
  //   return;
  // }

  // Permissões atuais
  const atuais = {
    modulo,
    acesso:       document.getElementById("Acesso").checked,
    cadastrar:    document.getElementById("Cadastrar").checked,
    alterar:      document.getElementById("Alterar").checked,
    pesquisar:    document.getElementById("Pesquisar").checked,
    apagar:       document.getElementById("Apagar").checked,
    master:       document.getElementById("Master").checked,
    financeiro:   document.getElementById("Financeiro").checked,
    supremo:      document.getElementById("AdminSupremo").checked,
    comercial:    document.getElementById("Comercial").checked,
    devs:         document.getElementById("Devs").checked
  };

  // Verifica se há mudança nas permissões
  const semAlteracaoPermissoes = typeof permissoesOriginais === "object" &&
    Object.keys(atuais).every(key => atuais[key] === permissoesOriginais[key]);

    console.log("Permissões Originais:", permissoesOriginais);
    console.log("Permissões Atuais:", atuais);

  // const semAlteracaoEmpresas = empresasOriginais.length === empresasAtualmenteSelecionadas.length &&
  //                              empresasOriginais.every(empId => empresasAtualmenteSelecionadas.includes(empId));

  const semAlteracaoEmpresas = empresasOriginais.length === empresasAtualmenteSelecionadas.length &&
    empresasOriginais.every(empOriginal => {
            const empAtual = empresasAtualmenteSelecionadas.find(
            emp => emp.idempresa === empOriginal.idempresa
        );                
        return empAtual && empAtual.ativo === empOriginal.ativo;
    });

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
    apagar: atuais.apagar,
    master: atuais.master,
    financeiro: atuais.financeiro,
    supremo: atuais.supremo,
    comercial: atuais.comercial,
    devs: atuais.devs,
    ativo: empresaAtiva
  };

  
  console.log("PAYLOAD", payload);

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

            // Opcional: Se você quiser que o select 'listaEmpresas' (o que tem TODAS as empresas)
            // selecione a empresa padrão do usuário automaticamente ao carregar:
            if (empresasOriginais.length > 0) {
                const selectEmpresa = document.getElementById("listaEmpresas");
                if (selectEmpresa) {
                  //  selectEmpresa.value = empresasOriginais[0]; // Seleciona a primeira empresa do usuário como padrão
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

async function carregarPermissoesUsuario(idusuario, idEmpresaAtual, nomeModulo) {
  limparCheckboxesPermissao();
  const selectModulo = document.getElementById("modulo");
 
  const chkAcesso    = document.getElementById("Acesso");
  const chkCadastrar = document.getElementById("Cadastrar");
  const chkAlterar   = document.getElementById("Alterar");
  const chkPesquisar = document.getElementById("Pesquisar");
  const chkApagar    = document.getElementById("Apagar");
  const chkMaster    = document.getElementById("Master");
  const chkFinanceiro= document.getElementById("Financeiro");
  const chkSupremo   = document.getElementById("AdminSupremo");
  const chkComercial = document.getElementById("Comercial");
  const chkDevs      = document.getElementById("Devs");
  

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
      chkApagar.checked     = Boolean(p.apagar);
      chkMaster.checked     = Boolean(p.master);
      chkFinanceiro.checked = Boolean(p.financeiro);      
      chkSupremo.checked    = Boolean(p.supremo);
      chkComercial.checked  = Boolean(p.comercial);
      chkDevs.checked       = Boolean(p.devs);
      verificarE_HabilitarPermissoes();

      permissoesOriginais = {
        modulo: p.modulo,
        acesso: Boolean(p.acesso),
        cadastrar: Boolean(p.cadastrar),
        alterar: Boolean(p.alterar),
        pesquisar: Boolean(p.pesquisar),
        apagar: Boolean(p.apagar),
        master: Boolean(p.master),
        financeiro: Boolean(p.financeiro),
        supremo: Boolean(p.supremo),
        comercial: Boolean(p.comercial),
        devs: Boolean(p.devs)
       
      };
    } else {
      console.log("16. Nenhuma permissão encontrada. Permissões Originais serão falsas.");
      permissoesOriginais = {
        modulo: nomeModulo || null, // Se não houver módulo, mantém null
        acesso: false,
        cadastrar: false,
        alterar: false,
        pesquisar: false,
        apagar: false,
        master: false,
        financeiro: false,
        supremo: false,
        comercial: false,
        devs: false
      };
    }
    console.log("Permissões originais:", permissoesOriginais);
    console.log("Permissões", permissoes)
  } catch (err) {
    console.error("Erro ao carregar permissões:", err);
  }
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

async function carregarEmpresas(selectIds = ['empresaDefaultSelect', 'listaEmpresas']) {
    try {
        const empresas = await fetchComToken('auth/empresas');
        if (!empresas) return;

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
  const selectModulos = document.getElementById('modulo');


  const empresasDoUsuario = JSON.parse(localStorage.getItem('empresas'));
    const empresaInfo = empresasDoUsuario.find(emp => String(emp.id) === idempresa);
    
    // 📌 PASSO 2: Acessa o checkbox 'ativo' no formulário
    const ativoCheckbox = document.getElementById('empresaAtiva');

    // 📌 PASSO 3: Verifica e atualiza o estado do checkbox
    if (ativoCheckbox && empresaInfo) {
        ativoCheckbox.checked = empresaInfo.ativo;
        console.log(`Checkbox 'ativo' para a empresa ${empresaInfo.id} setado como: ${empresaInfo.ativo}`);
    } else if (ativoCheckbox) {
        // Se a empresa não for encontrada (o que não deveria acontecer se a lista estiver correta),
        // desmarca o checkbox por segurança.
        ativoCheckbox.checked = false;
    }

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

    
    const modulos = await fetchComToken('/auth/usuarios/modulos');
    const selectModulo = document.getElementById('modulo');
    
    selectModulo.innerHTML = '<option value="choose" selected>Escolha o Módulo</option>';

    console.log("CARREGAR MODULO", idempresa, modulos);

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
  ['Acesso','Cadastrar','Alterar','Pesquisar','Apagar']
    .forEach(id => {
      const chk = document.getElementById(id);
      if (chk) chk.checked = false;
    });
}

// const selectModulo = document.getElementById("modulo");
// selectModulo.addEventListener("change", () => {

//   const idusuarioAtual = document.getElementById("idusuario").value;
//   const idEmpresaAtual = document.getElementById('listaEmpresas').value
//   const moduloSelecionado = selectModulo.value; 
//   const moduloSelecionadoNome = selectModulo.options[selectModulo.selectedIndex].textContent; // Para pegar o nome
  
//   console.log("IDEMPRESA DA LISTA DE EMPRESAS", idEmpresaAtual);

//   if (idusuarioAtual && idEmpresaAtual && idEmpresaAtual !== 'all' && moduloSelecionadoNome && moduloSelecionadoNome !== 'Escolha o Módulo') {
//         carregarPermissoesUsuario(idusuarioAtual, idEmpresaAtual, moduloSelecionadoNome);
//     } else {
        
//         limparCheckboxesPermissao; // Chame sua função para limpar os checkboxes de permissão
//     }
// });

const selectModulo = document.getElementById("modulo");
selectModulo.addEventListener("change", () => {
  const idusuarioAtual = document.getElementById("idusuario").value;
  const idEmpresaAtual = document.getElementById('listaEmpresas').value;
  const moduloSelecionadoNome = selectModulo.options[selectModulo.selectedIndex].textContent;

  // VALIDAÇÃO: Só chama o banco se todos os campos forem válidos
  const empresaValida = idEmpresaAtual && idEmpresaAtual !== "" && idEmpresaAtual !== "all";
  const moduloValido = moduloSelecionadoNome && moduloSelecionadoNome !== "Escolha o Modulo" && selectModulo.value !== "choose";

  if (idusuarioAtual && empresaValida && moduloValido) {
      console.log("Buscando permissões para:", moduloSelecionadoNome);
      carregarPermissoesUsuario(idusuarioAtual, idEmpresaAtual, moduloSelecionadoNome);
  } else {
      console.warn("Dados insuficientes para carregar permissões. Limpando campos.");
      // Certifique-se de que limparCheckboxesPermissao é uma função ()
      if(typeof limparCheckboxesPermissao === 'function') {
          limparCheckboxesPermissao(); 
      }
  }
});

document.addEventListener('DOMContentLoaded', async () => {
  console.log("DOMContentLoaded disparado. Iniciando carregamento de dados...");
  await carregarEmpresas(['empresaDefaultSelect', 'listaEmpresas']);
  await carregarModulos();
  console.log("--> carregarEmpresas() e carregarModulos() concluídos.");


  const btnFechar = document.getElementById('btnFechar');
  if (btnFechar) {
    btnFechar.addEventListener('click', () => {
      window.location.href = 'login.html'; // Substitua pelo caminho correto se estiver em outra pasta
    });
  }

});