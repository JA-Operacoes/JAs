// Descrição: Servidor Express para o sistema de orçamentos de eventos
// Autor: Marcia Lima


require("dotenv").config();
const express = require("express");
const path = require("path");
const app = express();
const port = process.env.PORT || 3000;

const { autenticarToken } = require('./middlewares/authMiddlewares');

// --- antes de app.use('/auth', authRoutes); e de todas as outras rotas:
app.use(express.json());                 // lê JSON no corpo das requisições
app.use(express.urlencoded({ extended: true })); // lê formulários URL-encoded

// const authRoutes = require('./routes/auth');
// app.use('/auth', authRoutes);
 


// const cors = require("cors");

// app.use(cors({
//   origin: ["http://127.0.0.1:5501"],
//   methods: ['GET', 'POST', 'PUT', 'DELETE'],
//   allowedHeaders: ['Content-Type'],
//   credentials: true
// }));

// Middleware para parsear JSON
app.use(express.json());

// Serve todos os arquivos estáticos de "public" (HTML, JS, CSS, imagens)
app.use(express.static(path.join(__dirname, 'public')));

// // Middleware para autenticação de token
// app.use(autenticarToken);

// Rotas publicas sem autenticação
app.use("/auth", require("./routes/auth")); // Rota para login e cadastro de usuários
app.use("/permissoes", require("./routes/rotaPermissoes")); //Rota permissoes usuários

// Rotas protegidas com autenticação
app.use("/funcao",autenticarToken, require("./routes/rotaFuncao"));
app.use("/clientes", autenticarToken, require("./routes/rotaCliente"));
app.use("/orcamentos", autenticarToken, require("./routes/rotaOrcamento"));
app.use("/eventos", autenticarToken, require("./routes/rotaEvento"));
app.use("/equipamentos", autenticarToken, require("./routes/rotaEquipamento"));
app.use("/suprimentos", autenticarToken, require("./routes/rotaSuprimento"));
app.use("/funcionarios", autenticarToken, require("./routes/rotaFuncionario"));
app.use("/profissional", autenticarToken, require("./routes/rotaProfissional"));
app.use("/localmontagem", autenticarToken, require("./routes/rotaLocalMontagem"));
app.use("/staff", autenticarToken, require("./routes/rotaStaff"));
//app.use("/usuarios", autenticarToken, require("./routes/Usuarios"));



// Redireciona / para login.html (opcional)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Inicia o servidor
app.listen(port, () => {
  console.log(`✅ Servidor rodando em http://localhost:${port}`);
});



