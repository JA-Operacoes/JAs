const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB"); // Seu pool de conexão com o PostgreSQL
const { autenticarToken, contextoEmpresa } = require('../middlewares/authMiddlewares');
const { verificarPermissao } = require('../middlewares/permissaoMiddleware');
const logMiddleware = require('../middlewares/logMiddleware');

// --- Importações e Configuração do Multer ---
const multer = require('multer');
const path = require('path');
const fs = require('fs'); // Para manipulação de arquivos (apagar antigos)

const uploadDir = path.join(__dirname, '../uploads/fotos_funcionarios');

// Garante que o diretório de uploads existe
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Tipo de arquivo não suportado! Apenas imagens são permitidas.'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // Limite de 5MB
    }
});
// --- Fim da Configuração do Multer ---


// Aplica autenticação em todas as rotas
router.use(autenticarToken());
router.use(contextoEmpresa);

// GET todas ou por descrição
router.get("/", verificarPermissao('Funcionarios', 'pesquisar'), async (req, res) => {
    const { nome } = req.query;
    const idempresa = req.idempresa;

    try {
        if (nome) {
            // Busca funcionário por nome na empresa específica, limita 1
            const result = await pool.query(
                `SELECT func.* FROM funcionarios func
                 INNER JOIN funcionarioempresas funce ON funce.idfuncionario = func.idfuncionario
                 WHERE funce.idempresa = $1 AND func.nome ILIKE $2 ORDER BY func.nome ASC LIMIT 1`,
                [idempresa, `%${nome}%`] // Use % para pesquisa parcial se for o caso
            );
            return result.rows.length
                ? res.json(result.rows[0])
                : res.status(404).json({ message: "Funcionário não encontrado." });
        } else {
            // Busca TODOS os funcionários associados à empresa do usuário logado
            const result = await pool.query(
                `SELECT func.* FROM funcionarios func
                 INNER JOIN funcionarioempresas funce ON funce.idfuncionario = func.idfuncionario
                 WHERE funce.idempresa = $1 ORDER BY func.nome ASC`,
                [idempresa]
            );
            return result.rows.length
                ? res.json(result.rows)
                : res.status(404).json({ message: "Nenhum funcionário encontrado para esta empresa." });
        }
    } catch (error) {
        console.error("Erro ao buscar funcionário:", error);
        res.status(500).json({ message: "Erro ao buscar funcionário." });
    }
});


// PUT atualizar
router.put("/:id",
    verificarPermissao('Funcionarios', 'alterar'),
    upload.single('foto'), // Middleware do Multer para o campo 'foto'
    logMiddleware('Funcionarios', {
        buscarDadosAnteriores: async (req) => {
            const idFuncionario = req.params.id;
            const idempresa = req.idempresa;
            if (!idFuncionario) {
                return { dadosanteriores: null, idregistroalterado: null };
            }
            try {
                const result = await pool.query(
                    `SELECT func.* FROM funcionarios func
                     INNER JOIN funcionarioempresas funce ON funce.idfuncionario = func.idfuncionario
                     WHERE func.idfuncionario = $1 AND funce.idempresa = $2`,
                    [idFuncionario, idempresa]
                );
                const linha = result.rows[0] || null;
                return {
                    dadosanteriores: linha,
                    idregistroalterado: linha?.idfuncionario || null
                };
            } catch (error) {
                console.error("Erro ao buscar dados anteriores do funcionário para log:", error);
                return { dadosanteriores: null, idregistroalterado: null };
            }
        }
    }),
    async (req, res) => {
        const id = req.params.id;
        const idempresa = req.idempresa;

        // Desestruture todos os campos de texto do req.body.
        // Adicione 'banco' aqui.
        // Mantenha consistência nos nomes das variáveis (ex: nivelFluenciaLinguas vs fluencia)
        console.log('--- DEBUG: Início do Handler PUT ---');
    console.log('Conteúdo de req.body APÓS Multer:', req.body);
    console.log('Conteúdo de req.file APÓS Multer:', req.file);
    console.log('--- FIM DEBUG ---');
        const {
            perfil, nome, cpf, rg, nivelFluenciaLinguas, idiomasAdicionais,
            celularPessoal, celularFamiliar, email, site, codigoBanco, pix, // ADICIONADO 'banco'
            numeroConta, agencia, tipoConta, cep, rua, numero, complemento, bairro,
            cidade, estado, pais
        } = req.body;

        let fotoPathParaBD = null;
        let client; // Usaremos um cliente do pool para transação

        try {
            client = await pool.connect();
            await client.query('BEGIN'); // Inicia a transação

            // Adicione console.logs para depurar os valores recebidos
            console.log('--- Início da requisição PUT ---');
            console.log('req.body:', req.body);
            console.log('req.file:', req.file);
            console.log('ID do funcionário (param):', id);
            console.log('ID da empresa (req.idempresa):', idempresa);
            console.log('Valor de "perfil" após desestruturação:', perfil);

            // 1. Lógica para determinar o caminho da foto
            if (req.file) {
                // Se um novo arquivo foi enviado, use o caminho do novo arquivo
                // E converta barras invertidas para barras normais para compatibilidade de caminho
                fotoPathParaBD = path.join('uploads/fotos_funcionarios', req.file.filename).replace(/\\/g, '/');

                // Apagar foto antiga se uma nova for enviada
                const resultFotoAntiga = await client.query( // Usar 'client' para manter na transação
                    `SELECT foto FROM funcionarios WHERE idfuncionario = $1`,
                    [id]
                );
                if (resultFotoAntiga.rows.length > 0 && resultFotoAntiga.rows[0].foto) {
                    const fotoAntigaPath = path.join(__dirname, '..', resultFotoAntiga.rows[0].foto);
                    // Verifique se o arquivo existe antes de tentar apagar
                    if (fs.existsSync(fotoAntigaPath)) {
                        fs.unlink(fotoAntigaPath, (err) => {
                            if (err) console.error("Erro ao apagar foto antiga:", err);
                        });
                    }
                }
            } else {
                // Se nenhum novo arquivo foi enviado, MANTENHA o caminho da foto existente no BD
                // OU defina como NULL se a intenção for remover a foto sem upload de nova
                const resultFotoExistente = await client.query( // Usar 'client' para manter na transação
                    `SELECT foto FROM funcionarios WHERE idfuncionario = $1`,
                    [id]
                );
                fotoPathParaBD = resultFotoExistente.rows[0]?.foto || null;
            }

            // --- Validação do campo 'perfil' ---
            // Se 'perfil' não é permitido ser nulo ou vazio no BD, force um erro aqui.
            if (!perfil || perfil.trim() === '') {
                // Se chegar aqui, significa que o frontend enviou um valor inválido,
                // ou o Multer/Express o transformou em vazio/nulo.
                // Reverter a transação e enviar erro 400.
                if (req.file) { // Se um arquivo foi carregado, apaga ele antes de sair
                    fs.unlink(req.file.path, (err) => {
                        if (err) console.error("Erro ao apagar upload de PUT falho (perfil inválido):", err);
                    });
                }
                await client.query('ROLLBACK');
                return res.status(400).json({ message: "O campo 'perfil' é obrigatório e não pode ser vazio." });
            }


            // 2. Executa a atualização no banco de dados
            const query = `
                UPDATE funcionarios func
                SET perfil = $1, foto = $2, nome = $3, cpf = $4, rg = $5, fluencia = $6, idiomasadicionais = $7,
                    celularpessoal = $8, celularfamiliar = $9, email = $10, site = $11, codigobanco = $12,
                    pix = $13, numeroconta = $14, agencia = $15, tipoconta = $16, cep = $17, rua = $18, numero = $19,
                    complemento = $20, bairro = $21, cidade = $22, estado = $23, pais = $24
                WHERE func.idfuncionario = $25
                RETURNING func.idfuncionario, func.foto;
            `;

            const values = [
                perfil, // O valor de 'perfil' deve ser tratado como string
                fotoPathParaBD,
                nome, cpf, rg, nivelFluenciaLinguas, idiomasAdicionais,
                celularPessoal, celularFamiliar, email, site, codigoBanco, 
                pix, numeroConta, agencia, tipoConta, cep, rua, numero,
                complemento, bairro, cidade, estado, pais,
                id // ID do funcionário para a cláusula WHERE
            ];

            const result = await client.query(query, values); // Usa 'client' para a query

            if (result.rowCount) {
                const funcionarioAtualizadoId = result.rows[0].idfuncionario;

                await client.query('COMMIT'); // Confirma a transação

                res.locals.acao = 'atualizou';
                res.locals.idregistroalterado = funcionarioAtualizadoId;
                res.locals.idusuarioAlvo = null;

                return res.json({
                    message: "Funcionário atualizado com sucesso!",
                    id: funcionarioAtualizadoId,
                    fotoPath: result.rows[0].foto // Retorna o caminho da foto que foi salvo
                });
            } else {
                // Se nenhum funcionário foi encontrado ou não pertence à empresa do usuário
                if (req.file) { // Se houve upload mas a atualização falhou, apaga o arquivo
                    fs.unlink(req.file.path, (err) => {
                        if (err) console.error("Erro ao apagar arquivo de upload (PUT falho):", err);
                    });
                }
                await client.query('ROLLBACK'); // Reverte a transação
                return res.status(404).json({ message: "Funcionário não encontrado ou você não tem permissão para atualizá-lo." });
            }
        } catch (error) {
            if (client) {
                await client.query('ROLLBACK'); // Reverte a transação em caso de erro
            }
            console.error("Erro ao atualizar funcionário:", error);
            if (req.file) { // Se houve upload e erro, apaga o arquivo
                fs.unlink(req.file.path, (err) => {
                    if (err) console.error("Erro ao apagar arquivo de upload (PUT erro):", err);
                });
            }
            // Mensagem de erro mais específica para não-nulo
            if (error.code === '23502') { // PostgreSQL error code for not-null constraint violation
                 return res.status(400).json({ message: `Campo obrigatório faltando ou inválido: ${error.column}. Por favor, verifique os dados e tente novamente.`, details: error.message });
            }
            res.status(500).json({ message: "Erro ao atualizar funcionário.", details: error.message });
        } finally {
            if (client) {
                client.release(); // Libera o cliente de volta para o pool
            }
            console.log('--- Fim da requisição PUT ---');
        }
    }
);

// POST criar novo funcionário
router.post("/",
    verificarPermissao('Funcionarios', 'cadastrar'),
    upload.single('foto'), // Middleware do Multer para o campo 'foto'
    logMiddleware('Funcionarios', {
        buscarDadosAnteriores: async (req) => {
            return { dadosanteriores: null, idregistroalterado: null };
        }
    }),
    async (req, res) => {
        // req.body agora é preenchido pelo Multer para campos de texto
        // Adicione 'banco' aqui e verifique 'nivelFluenciaLinguas'
        const {
            perfil, nome, cpf, rg, nivelFluenciaLinguas, idiomasAdicionais, celularPessoal, celularFamiliar,
            email, site, codigoBanco, pix, numeroConta, agencia, tipoConta, cep, rua, numero, // ADICIONADO 'banco'
            complemento, bairro, cidade, estado, pais
        } = req.body;

        const idempresa = req.idempresa;
        let client;
        let fotoPathParaBD = null; // Inicializa com null

        // Adicione console.logs para depurar os valores recebidos
        console.log('--- Início da requisição POST ---');
        console.log('req.body:', req.body);
        console.log('req.file:', req.file);
        console.log('ID da empresa (req.idempresa):', idempresa);
        console.log('Valor de "perfil" após desestruturação:', perfil);

        if (req.file) {
            // Se uma foto foi enviada, use o caminho gerado pelo Multer
            fotoPathParaBD = path.join('uploads/fotos_funcionarios', req.file.filename).replace(/\\/g, '/');
        }

        try {
            client = await pool.connect();
            await client.query('BEGIN');

            // --- Validação do campo 'perfil' para POST ---
            if (!perfil || perfil.trim() === '') {
                if (req.file) {
                    fs.unlink(req.file.path, (err) => {
                        if (err) console.error("Erro ao apagar upload de POST falho (perfil inválido):", err);
                    });
                }
                await client.query('ROLLBACK');
                return res.status(400).json({ message: "O campo 'perfil' é obrigatório e não pode ser vazio." });
            }

            const resultFuncionario = await client.query(
                `INSERT INTO Funcionarios (
                    perfil, foto, nome, cpf, rg, fluencia, idiomasadicionais,
                    celularpessoal, celularfamiliar, email, site, codigobanco, pix,
                    numeroconta, agencia, tipoconta, cep, rua, numero, complemento, bairro,
                    cidade, estado, pais
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
                RETURNING idFuncionarios, foto`, // Retorna o ID e o caminho da foto para o frontend
                [
                    perfil, fotoPathParaBD, nome, cpf, rg, nivelFluenciaLinguas, idiomasAdicionais, // Use nivelFluenciaLinguas
                    celularPessoal, celularFamiliar, email, site, codigoBanco, pix, 
                    numeroConta, agencia, tipoConta, cep, rua, numero, complemento, bairro,
                    cidade, estado, pais
                ]
            );
            const novoFuncionario = resultFuncionario.rows[0];
            const idNovoFuncionario = novoFuncionario.idfuncionarios;

            await client.query(
                "INSERT INTO FuncionarioEmpresas (idFuncionario, idEmpresa) VALUES ($1, $2)",
                [idNovoFuncionario, idempresa]
            );
            await client.query('COMMIT');

            res.locals.acao = 'cadastrou';
            res.locals.idregistroalterado = idNovoFuncionario;
            res.locals.idusuarioAlvo = null;

            res.status(201).json({
                message: "Funcionário salvo e associado à empresa com sucesso!",
                id: idNovoFuncionario,
                fotoPath: novoFuncionario.foto // Retorna o caminho da foto
            });
        } catch (error) {
            if (client) {
                await client.query('ROLLBACK');
            }
            console.error("❌ Erro ao salvar funcionário e/ou associá-lo à empresa:", error);

            // Se houve upload e o banco de dados falhou, apaga o arquivo
            if (req.file && req.file.path && fs.existsSync(req.file.path)) {
                fs.unlink(req.file.path, (err) => {
                    if (err) console.error("Erro ao apagar arquivo de upload falho:", err);
                });
            }
            // Mensagem de erro mais específica para não-nulo
            if (error.code === '23502') {
                 return res.status(400).json({ message: `Campo obrigatório faltando ou inválido: ${error.column}. Por favor, verifique os dados e tente novamente.`, details: error.message });
            }
            res.status(500).json({ error: "Erro ao salvar funcionário", details: error.message });
        } finally {
            if (client) {
                client.release();
            }
            console.log('--- Fim da requisição POST ---');
        }
    }
);

module.exports = router;


// const express = require("express");
// const router = express.Router();
// const pool = require("../db/conexaoDB");
// const { autenticarToken, contextoEmpresa } = require('../middlewares/authMiddlewares');
// const { verificarPermissao } = require('../middlewares/permissaoMiddleware');
// const logMiddleware = require('../middlewares/logMiddleware');

// // Aplica autenticação em todas as rotas
// router.use(autenticarToken());
// router.use(contextoEmpresa);

// // GET todas ou por descrição
// router.get("/", verificarPermissao('Funcionarios', 'pesquisar'), async (req, res) => {
//   const { nome } = req.query;
//   const idempresa = req.idempresa;

//   try {
//     if (nome) {
//       const result = await pool.query(
//         `SELECT func.* FROM funcionarios func
//         INNER JOIN funcionarioempresas funce ON funce.idfuncionario = func.idfuncionario
//         WHERE funce.idempresa = $1 AND func.nome ILIKE $2 ORDER BY func.nome ASC LIMIT 1 `,
//         [idempresa, nome]
//       );
//       return result.rows.length
//         ? res.json(result.rows[0])
//         : res.status(404).json({ message: "funcionario não encontrada" });
//     } else {
//       const result = await pool.query("SELECT * FROM funcionarios ORDER BY nome ASC");
//       return result.rows.length
//         ? res.json(result.rows)
//         : res.status(404).json({ message: "Nenhum Funcionário Encontrado" });
//     }
//   } catch (error) {
//     console.error("Erro ao buscar nome :", error);
//     res.status(500).json({ message: "Erro ao buscar nome " });
//   }
// });


// // PUT atualizar
// router.put("/:id", verificarPermissao('Funcionarios', 'alterar'), 
//   logMiddleware('Funcionarios', { // Módulo 'Funcionarios'
//         buscarDadosAnteriores: async (req) => {
//           const idFuncionario = req.params.id; // O ID do funcionario vem do parâmetro da URL
//           const idempresa = req.idempresa;
//             // Para POST, não há dados anteriores para buscar de um ID existente
//           if (!idFuncionario) {
//               return { dadosanteriores: null, idregistroalterado: null };
//           }
//           try {
//               // ✅ Seleciona os dados do funcionário, garantindo que pertence à empresa do usuário
//               const result = await pool.query(
//                   `SELECT func.* FROM funcionarios func
//                     INNER JOIN funcionarioempresas funce ON funce.idfuncionario = func.idfuncionario
//                     WHERE func.idfuncionario = $1 AND funce.idempresa = $2`, // Assumindo que a coluna ID é 'idfuncionario'
//                   [idFuncionario, idempresa]
//               );
//               const linha = result.rows[0] || null;
//               return {
//                   dadosanteriores: linha, // O objeto funcionário antes da alteração
//                   idregistroalterado: linha?.idfuncionario || null // O ID do funcionário que está sendo alterado
//               };
//           } catch (error) {
//               console.error("Erro ao buscar dados anteriores do funcionário:", error);
//               return { dadosanteriores: null, idregistroalterado: null };
//           }
//         }
//     }),
//   async (req, res) => {
//   const id = req.params.id;
//   const idempresa = req.idempresa; 
// //   const ativo = req.body.ativo;
//  // console.log("Ativo:", ativo); // Log do valor de ativo
//  console.log("Dados recebidos:", req.body); // Log dos dados recebidos

//   const { perfil, linkFoto, nome, cpf, rg, nivelFluenciaLinguas, idiomasAdicionais, celularPessoal, celularFamiliar, email, site, codigoBanco, pix, numeroConta, agencia, tipoconta, cep, rua, numero, complemento, bairro, cidade, estado, pais} = req.body;

//   try {
//     const result = await pool.query(
//       `UPDATE funcionarios func
//       SET perfil = $1, foto = $2, nome = $3, cpf = $4, rg = $5, fluencia = $6, idiomasadicionais= $7, 
//           celularpessoal = $8, celularfamiliar = $9, email = $10, site = $11, codigobanco = $12,
//           pix = $13, numeroconta = $14, agencia = $15, tipoconta = $16, cep = $17, rua = $18, numero = $19, 
//           complemento = $20, bairro = $21, cidade = $22, estado = $23, pais = $24 
//       FROM funcionarioempresas funce 
//       WHERE func.idfuncionario = $25 AND funce.idfuncionario = $26
//       RETURNING func.idfuncionario`,
//       [ perfil, linkFoto, nome, cpf, rg, nivelFluenciaLinguas, idiomasAdicionais, celularPessoal, celularFamiliar, email, site, codigoBanco, pix, numeroConta, agencia, tipoconta, cep, rua, numero, complemento, bairro, cidade, estado, pais, id, idempresa]
//     );

//     if (result.rowCount) {
//       const funcionarioAtualizadoId = result.rows[0].idfuncionario;

//       // --- Ponto Chave para o Log ---
//       res.locals.acao = 'atualizou';
//       res.locals.idregistroalterado = funcionarioAtualizadoId;
//       res.locals.idusuarioAlvo = null;

//       return res.json({ message: "Funcionário atualizado com sucesso!", funcionario: result.rows[0] });
//     } else {
//         return res.status(404).json({ message: "Funcionário não encontrado ou você não tem permissão para atualizá-lo." });
//     }
//   } catch (error) {
//       console.error("Erro ao atualizar funcionário:", error);
//       res.status(500).json({ message: "Erro ao atualizar funcionário." });
//   }
// });

// // POST criar nova função
// router.post("/", verificarPermissao('Funcionarios', 'cadastrar'), 
//   logMiddleware('Funcionarios', {
//     buscarDadosAnteriores: async (req) => {
//         return { dadosanteriores: null, idregistroalterado: null };
//     }
//   }),
//   async (req, res) => {
//   const { perfil, foto, nome, cpf, rg, fluencia, idiomasadicionais, celularpessoal, celularfamiliar, email, site, codigobanco, pix, numeroconta, agencia, tipoconta, cep, rua, numero, complemento, bairro, cidade, estado, pais} = req.body;
//   const idempresa = req.idempresa; 

//   let client;   

//   try {
//     client = await pool.connect(); 
//     await client.query('BEGIN');

//     const resultFuncionario = await client.query(
//                 `INSERT INTO Funcionarios (
//                     perfil, foto, nome, cpf, rg, fluencia, idiomasadicionais,
//                     celularpessoal, celularfamiliar, email, site, codigobanco, pix,
//                     numeroConta, agencia, tipoConta, cep, rua, numero, complemento, bairro,
//                     cidade, estado, pais
//                 ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
//                 RETURNING idFuncionarios`, // Retorna o ID do novo funcionário
//                 [
//                     perfil, foto, nome, cpf, rg, fluencia, idiomasadicionais,
//                     celularpessoal, celularfamiliar, email, site, codigobanco, pix,
//                     numeroconta, agencia, tipoconta, cep, rua, numero, complemento, bairro,
//                     cidade, estado, pais
//                 ]
//     );
//     const novoFuncionario = resultFuncionario.rows[0];
//     const idNovoFuncionario = novoFuncionario.idfuncionarios; 

//     await client.query(
//         "INSERT INTO FuncionarioEmpresas (idFuncionario, idEmpresa) VALUES ($1, $2)",
//         [idNovoFuncionario, idempresa]
//     );
//     await client.query('COMMIT');

//     res.locals.acao = 'cadastrou';
//     res.locals.idregistroalterado = idNovoFuncionario;
//     res.locals.idusuarioAlvo = null;

//     res.status(201).json({ mensagem: "Funcionário salvo e associado à empresa com sucesso!", funcionario: novoFuncionario });
//   } catch (error) {
//       if (client) { // Se a conexão foi estabelecida, faz o rollback
//           await client.query('ROLLBACK');
//       }
//       console.error("❌ Erro ao salvar funcionário e/ou associá-lo à empresa:", error);
//       res.status(500).json({ erro: "Erro ao salvar funcionário", detalhes: error.message });
//   } finally {
//       if (client) {
//           client.release(); // Libera a conexão do pool, esteja o try/catch no que estiver
//       }
//   }
    
// });



// module.exports = router;