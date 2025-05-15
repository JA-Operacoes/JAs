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
    const response = await fetch("http://localhost:3000/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email,
        senha: password
      })
    });
    console.log("response", response);
    const dados = await response.json();

    if (!response.ok) {
        // alert(dados.erro || "Erro ao realizar login.");
        Swal.fire({
            icon: 'error',
            title: 'Falha no login',
            text: dados.erro || 'Erro ao realizar login.',
            confirmButtonText: 'OK'
        });
        
        return;
    }
    const { token, idusuario } = dados;
    console.log("token, idusuario", token, idusuario);
    // guarda para usar nas outras páginas
    sessionStorage.setItem("token", token);
    sessionStorage.setItem("idusuario", idusuario);

   
    // Redirecionar para página inicial após login

    window.location.href = "OPER-index.html"; // ajuste conforme necessário

  } catch (erro) {
    console.error("Erro no login:", erro);
    // alert("Erro inesperado ao tentar fazer login.");
     Swal.fire({
        icon: 'error',
        title: 'Erro Inesperado',
        text: 'Erro inesperado ao tentar fazer login.',
    });
  }
});


document.getElementById("btnEntrar").addEventListener("click", function (e) {
  e.preventDefault();
  document.getElementById("btnEntrarReal").click();
});