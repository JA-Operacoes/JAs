import { fetchComToken } from "../../utils/utils.js";

// Evento de submit do formulário de login
document.getElementById("Login").addEventListener("submit", async function (e) {
  e.preventDefault();

  const email = document.getElementById("emailusuario").value.trim();
  const password = document.getElementById("senha").value;

  if (!email || !password) {
    alert("Por favor, preencha todos os campos.");
    return;
  }

  try {
    const response = await fetch("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, senha: password })
    });

    if (!response.ok) {
      const erro = await response.json();
      return Swal.fire({ icon: 'error', title: 'Falha no login', text: erro.erro || 'Erro ao realizar login.' });
    }

    const dados = await response.json();
    const { token, idusuario, empresas, idempresaDefault } = dados;

    console.log("token, idusuario", token, idusuario);

    // Limpa storage e salva dados do usuário
    localStorage.clear();
    localStorage.setItem("token", token);
    localStorage.setItem("idusuario", idusuario);    
    localStorage.setItem("empresas", JSON.stringify(empresas));

    if (idempresaDefault) {
      localStorage.setItem("idempresa", idempresaDefault);  
    } else {
      localStorage.removeItem("idempresa"); 
      localStorage.removeItem("permissoes");
      window.location.href = "OPER-index.html";
        return;
    }

    // 🔹 Mapeamento de idempresa → página
    // const paginas = {
    //   1: "OPER-index.html",
    //   2: "ES-index.html",
    //   3: "EA-index.html",
    //   4: "EP-index.html",
    //   5: "SNFOODS-index.html",
    //   6: "TSD-index.html"
    // };
    console.log("IDEmpresaDefault:", idempresaDefault);
    const empresaDefaultResponse = await fetchComToken(`/aside/empresasTema/${idempresaDefault}`);
    //   method: "GET",
    //   headers: {
    //     "Content-Type": "application/json",
    //     "Authorization": `Bearer ${token}` // Passa o token na requisição
    //   }
    // });
   
    // // Se a empresa for válida, abre a página correspondente
    // if (idempresaDefault && paginas[idempresaDefault]) {
    //   window.location.href = paginas[idempresaDefault];
    //   return;
    // }

    // // Caso não tenha empresa default ou não esteja mapeada → página padrão
    // window.location.href = "OPER-index.html";
    console.log("Empresa default response:", empresaDefaultResponse);

    if (!empresaDefaultResponse.ok) {
        console.error("Não foi possível buscar os dados da empresa default.");
        // Em caso de falha, redireciona para uma página genérica
        window.location.href = "OPER-index.html";
        return;
    }
    
    const empresaDefaultData = await empresaDefaultResponse.json();
    const nmfantasia = empresaDefaultData.nmfantasia;

    // ✅ CONSTRUÇÃO DINÂMICA DA URL
    const pagina = `${nmfantasia.replace(/ /g, '').toUpperCase()}-index.html`;

    console.log(`Redirecionando para: ${pagina}`);
    window.location.href = pagina;

  

  } catch (err) {
    console.error("Erro no login:", err);
    Swal.fire({ icon: 'error', title: 'Erro Inesperado', text: 'Erro ao tentar fazer login.' });
  }
});

// Botão de login alternativo
document.getElementById("btnEntrar").addEventListener("click", function (e) {
  e.preventDefault();
  document.getElementById("btnEntrarReal").click();
});

