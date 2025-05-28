// Descrição: Servidor Express para o sistema de orçamentos de eventos
// Autor: Marcia Lima


require("dotenv").config();
const express = require("express");
const path = require("path");

const app = express();
const port = process.env.PORT || 3000;

const contextoEmpresa = require('./middlewares/contextoEmpresaMiddleware');
const { autenticarToken } = require('./middlewares/authMiddlewares');

// --- antes de app.use('/auth', authRoutes); e de todas as outras rotas:
app.use(express.json());                 // lê JSON no corpo das requisições
app.use(express.urlencoded({ extended: true })); // lê formulários URL-encoded

const authRoutes = require('./routes/auth');
app.use('/auth', authRoutes);
 

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

// Middleware para definir o contexto da empresa
// Middleware para autenticação de token
app.use(autenticarToken);
app.use(contextoEmpresa); 

// Rotas
app.use("/funcao", require("./routes/rotaFuncao"));
app.use("/clientes", require("./routes/rotaCliente"));
app.use("/orcamentos", require("./routes/rotaOrcamento"));
app.use("/eventos", require("./routes/rotaEvento"));
app.use("/equipamentos", require("./routes/rotaEquipamento"));
app.use("/suprimentos", require("./routes/rotaSuprimento"));
app.use("/funcionarios", require("./routes/rotaFuncionario"));
app.use("/profissional", require("./routes/rotaProfissional"));
app.use("/localmontagem", require("./routes/rotaLocalMontagem"));

app.use("/auth", require("./routes/auth")); // Rota para login e cadastro de usuários
app.use("/permissoes", require("./routes/rotaPermissoes")); //Rota permissoes usuários

// Redireciona / para login.html (opcional)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Inicia o servidor
app.listen(port, () => {
  console.log(`✅ Servidor rodando em http://localhost:${port}`);
});



