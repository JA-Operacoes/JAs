// require("dotenv").config();
// const path = require("path");
// const express = require("express");
// const cors = require("cors");
// const { Pool } = require("pg"); // Importando PostgreSQL

// const app = express();

// app.use(cors({
//     // origin: 'http://localhost:3000', // Adapte para o endereço correto do frontend
//     methods: ['GET', 'POST', 'PUT'],
//     allowedHeaders: ['Content-Type']
// }));

// app.use(express.json());

// app.use('/js', express.static(__dirname + '/js'));


// // Configuração do banco de dados PostgreSQL
// const pool = new Pool({
//   user: process.env.DB_USER,    // Usuário do banco
//   host: process.env.DB_HOST,    // Host do banco (normalmente "localhost")
//   database: process.env.DB_NAME,// Nome do banco
//   password: process.env.DB_PASS,// Senha do banco
//   port: process.env.DB_PORT,    // Porta (normalmente 5432 a minha é 5433)
// });

// // Teste de conexão com o banco
// pool.connect()
//   .then(() => console.log("Banco de dados conectado!"))
//   .catch(err => console.error("Erro ao conectar no banco:", err));

// //===================ROTAS PARA FUNCAO================================

// // Rota para retornar os funcao
// app.get("/funcao", async (req, res) => {
//     const { descFuncao } = req.query;
//     console.log("Requisição recebida para funcao");

//     try {

//         if (descFuncao) {
//             console.log("Buscando Funcao por descrição:", descFuncao);

//             const result = await pool.query(
//                 "SELECT * FROM funcao WHERE descFuncao ILIKE $1 LIMIT 1",
//                 [descFuncao]
//             );

//             if (result.rows.length === 0) {
//                 return res.status(404).json({ message: 'Funcao não encontrado' });
//             }

//             return res.json(result.rows[0]); // Retorna só o primeiro resultado
//         } else {
//             console.log("Requisição recebida para Funcao");
//             const result = await pool.query('SELECT * FROM funcao ORDER BY descfuncao ASC');
//             console.log("Funcao retornados:", result.rows); // Log dos funcao retornados
//             // Verifica se o resultado está vazio   
//             if (result.rows.length === 0) {
//                 return res.status(404).json({ message: 'Nenhum Funcao encontrado' }); // Retorna erro se não encontrar
//             }
//             // Se encontrar, retorna os funcao
//             console.log("Funcao encontrados:", result.rows); // Log dos funcao encontrados
//             console.log(result.rows); // Log dos funcao encontrados 


//             res.json(result.rows); // Retorna um JSON corretamente
//         }
//     } catch (error) {
//         console.error('Erro ao buscar Funcao:', error);
//         res.status(500).json({ message: 'Erro ao buscar Funcao' }); // Retorna erro como JSON
//     }
// });

// // Rota para atualizar funcao existente
// app.put('/funcao/:id', async (req, res) => {
//     const id = req.params.id;
//     const { descFuncao, vlrCusto, vlrVenda } = req.body;

//     try {
//         const result = await pool.query(
//             `UPDATE Funcao
//              SET descFuncao = $1,
//                  vlrCusto = $2,
//                  vlrVenda = $3
//              WHERE idFuncao = $4
//              RETURNING *`,
//             [descFuncao, vlrCusto, vlrVenda, id]
//         );

//         if (result.rowCount === 0) {
//             return res.status(404).json({ message: 'Função não encontrado para atualizar.' });
//         }

//         res.json({ message: 'Função atualizado com sucesso!', Funcao: result.rows[0] });
//     } catch (error) {
//         console.error('Erro ao atualizar função:', error);
//         res.status(500).json({ message: 'Erro ao atualizar função.' });
//     }
// });

// // Rota para salvar os funcao no banco
// app.post("/salvaFuncao", async (req, res) => {
    
//     console.log("Requisição recebida para salvar função em Server.js:", req.body); // Log da requisição
//     const { descFuncao, vlrCusto, vlrVenda } = req.body;
   
//     try {
//         const result = await pool.query(
//             "INSERT INTO funcao (descFuncao, vlrCusto, vlrVenda) VALUES ($1, $2, $3) RETURNING *",
//             [descFuncao, vlrCusto, vlrVenda]
//         );

//         console.log("Dados salvos:", result.rows[0]);
//         res.json({ mensagem: "Função salvo com sucesso!", funcao: result.rows[0] });
//     } catch (err) {
//         console.error("Erro ao salvar no banco:", err);
//         res.status(500).json({ erro: "Erro ao salvar o função" });
//     }
// });

// //====================ROTAS PARA CLIENTES=================================

// //Rota pesquisa para retornar os clientes

// app.get("/clientes", async (req, res) => {
//     const { nmFantasia } = req.query;

//     console.log("Requisição recebida para clientes");
//     try {
//         if (nmFantasia) {
//             console.log("Buscando cliente por nome fantasia:", nmFantasia);

//             const result = await pool.query(
//                 "SELECT * FROM clientes WHERE nmFantasia ILIKE $1 LIMIT 1",
//                 [nmFantasia]
//             );

//             if (result.rows.length === 0) {
//                 return res.status(404).json({ message: 'Cliente não encontrado' });
//             }

//             return res.json(result.rows[0]); // Retorna só o primeiro resultado
//         } else {
//             console.log("Requisição recebida para cliente");
//             const result = await pool.query('SELECT * FROM clientes ORDER BY nmFantasia ASC');
//             console.log("Clientes retornados:", result.rows); // Log dos clientes retornados
//             // Verifica se o resultado está vazio   
//             if (result.rows.length === 0) {
//                 return res.status(404).json({ message: 'Nenhum cliente encontrado' }); // Retorna erro se não encontrar
//             }
//             // Se encontrar, retorna os clientes
//             console.log("Clientes encontrados:", result.rows); // Log dos funcao encontrados
//             console.log(result.rows); // Log dos funcao encontrados 


//             res.json(result.rows); // Retorna um JSON corretamente
//         }
//     } catch (err) {
//         console.error("Erro ao carregar clientes:", err);
//         res.status(500).json({ erro: "Erro ao carregar clientes" });
//     }
// });

// app.post("/salvarCliente", async (req, res) => {
//     console.log("Entrou SalvarClientes", req.body);
    
//     const ativo = req.body.ativo === "on" ? true : false;
//     console.log("Ativo:", ativo); // Log do valor de ativo

//     const { nmFantasia, razaoSocial, cnpj, inscEstadual, emailCliente, emailNfe, site, telefone, nmContato, celContato, emailContato,   cep, rua, numero, complemento, bairro, cidade, estado, pais } = req.body;
    
//     try {
//         const result = await pool.query(
//             "INSERT INTO clientes (nmfantasia, razaosocial, cnpj, inscestadual, emailcliente, emailnfe, site, telefone, nmcontato, celcontato, emailcontato,  cep, rua, numero, complemento, bairro, cidade, estado, pais, ativo) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20) RETURNING *",
//             [nmFantasia, razaoSocial, cnpj, inscEstadual, emailCliente, emailNfe,  site, telefone, nmContato, celContato, emailContato, cep, rua, numero, complemento, bairro, cidade, estado, pais, ativo]
//         );

//         console.log("Dados salvos:", result.rows[0]);
//         res.json({ mensagem: "Cliente salvo com sucesso!", cliente: result.rows[0] });
//     } catch (err) {
//         console.error("Erro ao salvar no banco:", err);
//         res.status(500).json({ erro: "Erro ao salvar o cliente" });
//     }
// });




// app.post("/salvarOrcamento", async (req, res) => {
//     const { itens } = req.body;

//     if (!Array.isArray(itens) || itens.length === 0) {
//         return res.status(400).json({ erro: "Dados inválidos" });
//     }

//     try {
//         for (const item of itens) {
//             const { produto, vlrCusto, vlrVenda } = item;

//             await pool.query(
//                 "INSERT INTO orcamento (produto, vlrcusto, vlrvenda) VALUES ($1, $2, $3)",
//                 [produto, vlrCusto, vlrVenda]
//             );
//         }

//         res.status(200).json({ mensagem: "Orçamento salvo com sucesso" });
//     } catch (err) {
//         console.error("Erro ao salvar orçamento:", err);
//         res.status(500).json({ erro: "Erro no servidor" });
//     }
// });

// //===================ROTAS DE PESQUISA=================================

// app.get("/localmontagem", async (req, res) => {

//     try {
//         console.log("Requisição recebida para montagem");
//         const result = await pool.query('SELECT * FROM localMontagem ORDER BY descMontagem ASC');
//         console.log("Montagem retornados:", result.rows); // Log dos funcao retornados
//         // Verifica se o resultado está vazio   
//         if (result.rows.length === 0) {
//             return res.status(404).json({ message: 'Nenhum Local de Montagem encontrado' }); // Retorna erro se não encontrar
//         }
//         // Se encontrar, retorna os funcao
//         console.log("Montagem encontrados:", result.rows); // Log dos funcao encontrados
//         console.log(result.rows); // Log dos funcao encontrados 


//         res.json(result.rows); // Retorna um JSON corretamente
//     } catch (error) {
//         console.error('Erro ao buscar montagem:', error);
//         res.status(500).json({ message: 'Erro ao buscar montagem' }); // Retorna erro como JSON
//     }
// });

// app.get("/equipamentos", async (req, res) => {

//     try {
//         console.log("Requisição recebida para equipamentos");
//         const result = await pool.query('SELECT * FROM equipamentos ORDER BY descequip ASC');
//         console.log("Equipamentos retornados:", result.rows); // Log dos funcao retornados
//         // Verifica se o resultado está vazio   
//         if (result.rows.length === 0) {
//             return res.status(404).json({ message: 'Nenhum Equipamento encontrado' }); // Retorna erro se não encontrar
//         }
//         // Se encontrar, retorna os funcao
//         console.log("Equipamentos encontrados:", result.rows); // Log dos funcao encontrados
//         console.log(result.rows); // Log dos funcao encontrados 


//         res.json(result.rows); // Retorna um JSON corretamente
//     } catch (error) {
//         console.error('Erro ao buscar equipamentos:', error);
//         res.status(500).json({ message: 'Erro ao buscar equipamento' }); // Retorna erro como JSON
//     }
// });

// app.get("/suprimentos", async (req, res) => {

//     try {
//         console.log("Requisição recebida para suprimentos");
//         const result = await pool.query('SELECT * FROM suprimentos ORDER BY descsup ASC');
//         console.log("Suprimentos retornados:", result.rows); // Log dos funcao retornados
//         // Verifica se o resultado está vazio   
//         if (result.rows.length === 0) {
//             return res.status(404).json({ message: 'Nenhum Suprimento encontrado' }); // Retorna erro se não encontrar
//         }
//         // Se encontrar, retorna os funcao
//         console.log("Suprimentos encontrados:", result.rows); // Log dos funcao encontrados
//         console.log(result.rows); // Log dos funcao encontrados 


//         res.json(result.rows); // Retorna um JSON corretamente
//     } catch (error) {
//         console.error('Erro ao buscar suprimentos:', error);
//         res.status(500).json({ message: 'Erro ao buscar suprimentos' }); // Retorna erro como JSON
//     }
// });

// app.get("/eventos", async (req, res) => {

//     try {
//         console.log("Requisição recebida para eventos");
//         const result = await pool.query('SELECT * FROM eventos ORDER BY nmevento ASC');
//         console.log("Eventos retornados:", result.rows); // Log dos funcao retornados
//         // Verifica se o resultado está vazio   
//         if (result.rows.length === 0) {
//             return res.status(404).json({ message: 'Nenhum Evento encontrado' }); // Retorna erro se não encontrar
//         }
//         // Se encontrar, retorna os funcao
//         console.log("Eventos encontrados:", result.rows); // Log dos funcao encontrados
//         console.log(result.rows); // Log dos funcao encontrados 


//         res.json(result.rows); // Retorna um JSON corretamente
//     } catch (error) {
//         console.error('Erro ao buscar eventos:', error);
//         res.status(500).json({ message: 'Erro ao buscar eventos' }); // Retorna erro como JSON
//     }
// });

// // Iniciar servidor na porta configurada ou 3000
// const port = process.env.PORT || 3000;
// app.listen(port, () => {
//     console.log(`Servidor rodando em http://localhost:${port}`);
// });

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
app.use(cors({ methods: ['GET', 'POST', 'PUT'], allowedHeaders: ['Content-Type'] }));
app.use(express.json());
app.use('/js', express.static(path.join(__dirname, 'js')));

// app.get("/", (req, res) => {
//     res.redirect("/JA/OPER-index.html");
//   });
// Rotas
app.use("/funcao", require("./routes/rotaFuncao"));
app.use("/clientes", require("./routes/rotaCliente"));
app.use("/orcamento", require("./routes/rotaOrcamento"));
app.use("/evento", require("./routes/rotaEvento"));
app.use("/equipamento", require("./routes/rotaEquipamento"));
app.use("/suprimento", require("./routes/rotaSuprimento"));
app.use("/funcionario", require("./routes/rotaFuncionario"));
app.use("/profissional", require("./routes/rotaProfissional"));
app.use("/localmontagem", require("./routes/rotaLocalMontagem"));
// app.use("/pesquisa", require("./routes/pesquisa"));


// Start
app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});


