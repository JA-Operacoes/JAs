// Descrição: Servidor Express para o sistema de orçamentos de eventos
// Autor: Marcia Lima


require("dotenv").config();
const express = require("express");
const path = require("path");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public'))); // Para HTMLs, imagens etc.
app.use('/js', express.static(path.join(__dirname, 'js'))); // Scripts externos
app.use('/css', express.static(path.join(__dirname, 'css'))); // CSS externos

// Middlewares
//app.use(cors({ methods: ['GET', 'POST', 'PUT'], allowedHeaders: ['Content-Type'] }));
const allowedOrigins = ['http://127.0.0.1:5500', 'http://127.0.0.1:5501'];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

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



