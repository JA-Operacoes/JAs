// Descrição: Servidor Express para o sistema de orçamentos de eventos
// Autor: Marcia Lima


require("dotenv").config();
const express = require("express");
const path = require("path");
const app = express();
const port = process.env.PORT || 3000;


const { autenticarToken, contextoEmpresa } = require('./middlewares/authMiddlewares');
//const contextoEmpresa = require('./middlewares/contextoEmpresa');

// --- antes de app.use('/auth', authRoutes); e de todas as outras rotas:
app.use(express.json());                 // lê JSON no corpo das requisições
app.use(express.urlencoded({ extended: true })); // lê formulários URL-encoded

// const authRoutes = require('./routes/auth');
// app.use('/auth', authRoutes);
 
// const cors = require('cors');

// const allowedOrigins = [
//   'http://127.0.0.1:5500',  // Live Server, VS Code, etc.
//   'http://localhost:5500',
//   'http://localhost:5173',  // Vite (se usar)
//   'http://localhost:3001',  // Outro frontend separado
//   // adicione mais se precisar
// ];



// Serve todos os arquivos estáticos de "public" (HTML, JS, CSS, imagens)
app.use(express.static(path.join(__dirname, 'public')));

// // Middleware para autenticação de token
// app.use(autenticarToken);

// Rotas publicas sem autenticação
app.use("/auth", require("./routes/auth")); // Rota para login e cadastro de usuários
app.use("/permissoes", require("./routes/rotaPermissoes")); //Rota permissoes usuários

// Rotas protegidas com autenticação
app.use("/funcao",autenticarToken(), contextoEmpresa, require("./routes/rotaFuncao"));
app.use("/clientes", autenticarToken(), contextoEmpresa, require("./routes/rotaCliente"));
app.use("/orcamentos", autenticarToken(), contextoEmpresa, require("./routes/rotaOrcamento"));
app.use("/eventos",autenticarToken(), contextoEmpresa, require("./routes/rotaEvento"));
app.use("/equipamentos", autenticarToken(), contextoEmpresa, require("./routes/rotaEquipamento"));
app.use("/suprimentos", autenticarToken(), contextoEmpresa, require("./routes/rotaSuprimento"));
app.use("/funcionarios", autenticarToken(), contextoEmpresa, require("./routes/rotaFuncionario"));
app.use("/profissional", autenticarToken(), contextoEmpresa, require("./routes/rotaProfissional"));
app.use("/localmontagem", autenticarToken(), contextoEmpresa, require("./routes/rotaLocalMontagem"));
app.use("/staff", autenticarToken(), contextoEmpresa, require("./routes/rotaStaff"));
app.use("/empresas", autenticarToken(), contextoEmpresa, require("./routes/rotaEmpresa"));
app.use("/modulos", autenticarToken(), require("./routes/rotaModulo"));




// Redireciona / para login.html (opcional)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Inicia o servidor
app.listen(port, () => {
  console.log(`✅ Servidor rodando em http://localhost:${port}`);
});



