// Descrição: Servidor Express para o sistema de orçamentos de eventos
// Autor: Marcia Lima


require("dotenv").config();
const express = require("express");
const cors = require("cors");
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
app.use('/js', express.static(path.join(__dirname, 'js')));


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

app.use("/enviar-pdf", require("./routes/rotaEnviarPdf"));

app.use("/auth", require("./routes/auth")); // Rota para login e cadastro de usuários
app.use("/permissoes", require("./routes/rotaPermissoes")); //Rota permissoes usuários

// Start
app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});



