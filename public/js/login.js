document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("form");

  form.addEventListener("submit", (e) => {
      e.preventDefault(); // Impede o envio padrão do formulário

      const email = document.getElementById("email").value.trim();
      const senha = document.getElementById("password").value.trim();

      // Recupera os usuários cadastrados do LocalStorage
      const users = JSON.parse(localStorage.getItem("users")) || [];

      // Verifica se o usuário existe
      const user = users.find(user => user.email === email);

      if (!user) {
          alert("Usuário não encontrado! Verifique o e-mail.");
          return;
      }

      // Verifica se a senha está correta
      if (user.senha !== senha) {
          alert("Senha incorreta!");
          return;
      }

      alert("Login realizado com sucesso!");
      window.location.href = "OPER-index.html"; // Redireciona para a página inicial
  });
});
