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


router.get("/bancos", verificarPermissao('Bancos', 'pesquisar'), async (req, res) => {
  const { nmBanco, codBanco } = req.query;
  const idempresa = req.idempresa;
  console.log("nmBanco NA ROTA FUNCIONARIOS", nmBanco, codBanco, idempresa);
  try {
    let result;

        if (codBanco) { // Priorize a busca por código do banco se ele existir
            result = await pool.query(
                `SELECT b.idbanco, b.codbanco, b.nmbanco
                 FROM bancos b
                 INNER JOIN bancoempresas be ON be.idbanco = b.idbanco
                 WHERE be.idempresa = $1 AND b.codbanco = $2`, // Use = para correspondência exata do código
                [idempresa, codBanco]
            );
            console.log("RESULTADO QUERY POR CODIGO", result.rows);
            return result.rows.length > 0
                ? res.json(result.rows[0]) // Retorna o primeiro encontrado, já que o código deve ser único
                : res.status(404).json({ message: "Banco não encontrado com o código fornecido para esta empresa." });
        } else if (nmBanco) { // Se não tem codBanco, verifica nmBanco
            result = await pool.query(
                `SELECT b.idbanco, b.codbanco, b.nmbanco
                 FROM bancos b
                 INNER JOIN bancoempresas be ON be.idbanco = b.idbanco
                 WHERE be.idempresa = $1 AND b.nmbanco ILIKE $2 LIMIT 1`,
                [idempresa, `%${nmBanco}%`]
            );
            console.log("RESULTADO QUERY POR NOME", result.rows);
            return result.rows.length > 0
                ? res.json(result.rows[0])
                : res.status(404).json({ message: "Banco não encontrado com o nome fornecido para esta empresa." });
        } 
    } catch (error) {
        console.error("❌ Erro ao buscar bancos:", error);
        return res.status(500).json({ error: error.message || "Erro ao buscar bancos" });
    }
});

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
       
        const {
            perfil, nome, cpf, rg, nivelFluenciaLinguas, idiomasAdicionais,
            celularPessoal, celularFamiliar, email, site, codigoBanco, pix, // ADICIONADO 'banco'
            numeroConta, digitoConta, agencia, digitoAgencia, tipoConta, cep, rua, numero, complemento, bairro,
            cidade, estado, pais, dataNascimento, nomeFamiliar, apelido, pcd
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
                    pix = $13, numeroconta = $14, digitoConta = $15, agencia = $16, digitoAgencia = $17, tipoconta = $18, cep = $19, rua = $20, numero = $21,
                    complemento = $22, bairro = $23, cidade = $24, estado = $25, pais = $26, datanascimento = $27, nomefamiliar = $28, apelido = $29, pcd= $30
                WHERE func.idfuncionario = $31
                RETURNING func.idfuncionario, func.foto;
            `;

            const values = [
                perfil, // O valor de 'perfil' deve ser tratado como string
                fotoPathParaBD,
                nome, cpf, rg, nivelFluenciaLinguas, idiomasAdicionais,
                celularPessoal, celularFamiliar, email, site, codigoBanco, 
                pix, numeroConta, digitoConta, agencia, digitoAgencia, tipoConta, cep, rua, numero,
                complemento, bairro, cidade, estado, pais,
                dataNascimento, nomeFamiliar, apelido, pcd,
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
            if (error.code === '22007') { // Código PostgreSQL para sintaxe de data inválida
                return res.status(400).json({
                    message: "A Data de Nascimento é obrigatória ou está em um formato inválido. Por favor, verifique.",
                    field: "dataNascimento", // Adiciona um campo para identificar qual input
                    details: error.message
                });
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
        console.log('--- Início da requisição POST ---');
        console.log('req.body:', req.body);
        const {
            perfil, nome, cpf, rg, nivelFluenciaLinguas, idiomasAdicionais, celularPessoal, celularFamiliar,
            email, site, codigoBanco, pix, numeroConta, digitoConta, agencia, digitoAgencia, tipoConta, cep, rua, numero, // ADICIONADO 'banco'
            complemento, bairro, cidade, estado, pais, dataNascimento, nomeFamiliar, apelido, pcd
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
                    numeroconta, digitoConta, agencia, digitoAgencia, tipoconta, cep, rua, numero, complemento, bairro,
                    cidade, estado, pais, datanascimento, nomefamiliar, apelido, pcd
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30)
                RETURNING idFuncionario, foto`, // Retorna o ID e o caminho da foto para o frontend
                [
                    perfil, fotoPathParaBD, nome, cpf, rg, nivelFluenciaLinguas, idiomasAdicionais, // Use nivelFluenciaLinguas
                    celularPessoal, celularFamiliar, email, site, codigoBanco, pix, 
                    numeroConta, digitoConta, agencia, digitoAgencia, tipoConta, cep, rua, numero, complemento, bairro,
                    cidade, estado, pais, dataNascimento, nomeFamiliar, apelido, pcd
                ]
            );
            const novoFuncionario = resultFuncionario.rows[0];
            const idNovoFuncionario = novoFuncionario.idfuncionario;

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
            // if (error.code === '23502') {
            //      return res.status(400).json({ message: `Campo obrigatório faltando ou inválido: ${error.column}. Por favor, verifique os dados e tente novamente.`, details: error.message });
            // }
            // if (error.code === '23505' && error.constraint === 'funcionarios_cpf_key') {
            //     if (error.constraint === 'funcionarios_cpf_key') {
            //     // Erro de CPF duplicado
            //     return res.status(409).json({ message: 'Erro ao salvar funcionário: Já existe um funcionário cadastrado com este CPF.' });
            //     } else if (error.constraint === 'funcionarios_email_key') {
            //     // Erro de e-mail duplicado
            //     return res.status(409).json({ message: 'Erro ao salvar funcionário: Já existe um funcionário cadastrado com este e-mail.' });
            //     }
            // }
            // if (error.code === '22007') { // Código PostgreSQL para sintaxe de data inválida
            //     return res.status(400).json({
            //         message: "A Data de Nascimento é obrigatória ou está em um formato inválido. Por favor, verifique.",
            //         field: "dataNascimento", // Adiciona um campo para identificar qual input
            //         details: error.message
            //     });
            // }

            if (error.code === '23505') { // '23505' é o código para restrição de unicidade
                if (error.constraint === 'funcionarios_email_key') {
                    return res.status(409).json({
                        message: 'Já existe um funcionário cadastrado com este e-mail.',
                        field: 'email'
                    });
                }
                if (error.constraint === 'funcionarios_cpf_key') {
                    return res.status(409).json({
                        message: 'Já existe um funcionário cadastrado com este CPF.',
                        field: 'cpf'
                    });
                }
                if (error.constraint === 'funcionarios_rg_key') {
                    return res.status(409).json({
                        message: 'Já existe um funcionário cadastrado com este RG.',
                        field: 'rg'
                    });
                }
            }
            
            // Tratamento de erros de campos obrigatórios
            if (error.code === '23502') {
                return res.status(400).json({
                    message: `Campo obrigatório faltando ou inválido: ${error.column}.`,
                    details: error.message
                });
            }

            // Tratamento de erro de data inválida
            if (error.code === '22007') {
                return res.status(400).json({
                    message: "A Data de Nascimento está em um formato inválido.",
                    field: "dataNascimento",
                    details: error.message
                });
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

