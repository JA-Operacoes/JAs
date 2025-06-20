document.getElementById("Login").addEventListener("submit", async function (e) {
  e.preventDefault();

//   const username = document.getElementById("nome").value.trim();
   const email= document.getElementById("emailusuario").value.trim();
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

    // ← você precisa desta linha:
    const dados = await response.json();

        
    const { token, idusuario, empresas, idempresaDefault } = dados;
    console.log("token, idusuario", token, idusuario, empresas);
    localStorage.clear();
    localStorage.setItem("token", token);
    localStorage.setItem("idusuario", idusuario);    
    localStorage.setItem("empresas", JSON.stringify(empresas));
   
    if (idempresaDefault) {
      localStorage.setItem("idempresa", idempresaDefault);
      // Aqui busca as permissões para essa empresa e salva localmente 04/06/2025
      // const permissoes = await fetchComToken('/auth/permissoes');
      // localStorage.setItem('permissoes', JSON.stringify(permissoes));

    } else {
      localStorage.removeItem("idempresa"); // para evitar lixo
      localStorage.removeItem('permissoes');//04/06/2025
    }

    // const permissoes = await fetchComToken('/auth/permissoes');
    // localStorage.setItem('permissoes', JSON.stringify(permissoes));
    // // você pode salvar a empresa ativa inicial como a primeira da lista
    // if (empresas.length > 0) {
    //   localStorage.setItem("idempresa", empresas[0].idempresa);
    // }

    // Redireciona só depois de buscar permissões etc.
    window.location.href = "OPER-index.html";

  } catch (err) {
    console.error("Erro no login:", err);
    Swal.fire({ icon: 'error', title: 'Erro Inesperado', text: 'Erro ao tentar fazer login.' });
  }
});


document.getElementById("btnEntrar").addEventListener("click", function (e) {
  e.preventDefault();
  document.getElementById("btnEntrarReal").click();
});