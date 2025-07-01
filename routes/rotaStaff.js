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

const uploadDir = path.join(__dirname, '../uploads/fotos_Staff');

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
router.get("/", verificarPermissao('Staff', 'pesquisar'), async (req, res) => {
    const { nmFuncionario } = req.query;
    const idempresa = req.idempresa;

    try {
        if (nmFuncionario) {
            // Busca funcionário por nmFuncionario na empresa específica, limita 1
            const result = await pool.query(
                `SELECT func.* FROM Staff func
                 INNER JOIN Staffempresas funce ON funce.idStaff = func.idStaff
                 WHERE funce.idempresa = $1 AND func.nmFuncionario ILIKE $2 ORDER BY func.nmFuncionario ASC LIMIT 1`,
                [idempresa, `%${nmFuncionario}%`] // Use % para pesquisa parcial se for o caso
            );
            return result.rows.length
                ? res.json(result.rows[0])
                : res.status(404).json({ message: "Funcionário não encontrado." });
        } else {
            // Busca TODOS os funcionários associados à empresa do usuário logado
            const result = await pool.query(
                `SELECT func.* FROM Staff func
                 INNER JOIN Staffempresas funce ON funce.idStaff = func.idStaff
                 WHERE funce.idempresa = $1 ORDER BY func.nmFuncionario ASC`,
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
    verificarPermissao('Staff', 'alterar'),
    upload.single('foto'), // Middleware do Multer para o campo 'foto'
    logMiddleware('Staff', {
        buscarDadosAnteriores: async (req) => {
            const idStaff = req.params.id;
            const idempresa = req.idempresa;
            if (!idStaff) {
                return { dadosanteriores: null, idregistroalterado: null };
            }
            try {
                const result = await pool.query(
                    `SELECT func.* FROM Staff func
                     INNER JOIN Staffempresas funce ON funce.idStaff = func.idStaff
                     WHERE func.idStaff = $1 AND funce.idempresa = $2`,
                    [idStaff, idempresa]
                );
                const linha = result.rows[0] || null;
                return {
                    dadosanteriores: linha,
                    idregistroalterado: linha?.idStaff || null
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
            foto, nmFuncionario, descFuncao, custo, extra, transporte,
            alimentação, caixinha, beneficio, site, codigoBanco, pix, // ADICIONADO 'banco'
            numeroConta, digitoConta, agencia, digitoAgencia, tipoConta, cep, rua, numero, complemento, bairro,
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
            console.log('Valor de "foto" após desestruturação:', foto);

            // 1. Lógica para determinar o caminho da foto
            if (req.file) {
                // Se um novo arquivo foi enviado, use o caminho do novo arquivo
                // E converta barras invertidas para barras normais para compatibilidade de caminho
                fotoPathParaBD = path.join('uploads/fotos_Staff', req.file.filename).replace(/\\/g, '/');

                // Apagar foto antiga se uma nova for enviada
                const resultFotoAntiga = await client.query( // Usar 'client' para manter na transação
                    `SELECT foto FROM Staff WHERE idStaff = $1`,
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
                    `SELECT foto FROM Staff WHERE idStaff = $1`,
                    [id]
                );
                fotoPathParaBD = resultFotoExistente.rows[0]?.foto || null;
            }

            // --- Validação do campo 'foto' ---
            // Se 'foto' não é permitido ser nulo ou vazio no BD, force um erro aqui.
            if (!foto || foto.trim() === '') {
                // Se chegar aqui, significa que o frontend enviou um valor inválido,
                // ou o Multer/Express o transformou em vazio/nulo.
                // Reverter a transação e enviar erro 400.
                if (req.file) { // Se um arquivo foi carregado, apaga ele antes de sair
                    fs.unlink(req.file.path, (err) => {
                        if (err) console.error("Erro ao apagar upload de PUT falho (foto inválido):", err);
                    });
                }
                await client.query('ROLLBACK');
                return res.status(400).json({ message: "O campo 'foto' é obrigatório e não pode ser vazio." });
            }


            // 2. Executa a atualização no banco de dados
            const query = `
                UPDATE Staff func
                SET foto = $1, foto = $2, nmFuncionario = $3, descFuncao = $4, custo = $5, fluencia = $6, transporte = $7,
                    alimentação = $8, caixinha = $9, beneficio = $10, site = $11, codigobanco = $12,
                    pix = $13, numeroconta = $14, digitoConta = $15, agencia = $16, digitoAgencia = $17, tipoconta = $18, cep = $19, rua = $20, numero = $21,
                    complemento = $22, bairro = $23, cidade = $24, estado = $25, pais = $26
                WHERE func.idStaff = $27
                RETURNING func.idStaff, func.foto;
            `;

            const values = [
                foto, // O valor de 'foto' deve ser tratado como string
                fotoPathParaBD,
                nmFuncionario, descFuncao, custo, extra, transporte,
                alimentação, caixinha, beneficio, site, codigoBanco, 
                pix, numeroConta, digitoConta, agencia, digitoAgencia, tipoConta, cep, rua, numero,
                complemento, bairro, cidade, estado, pais,
                id // ID do funcionário para a cláusula WHERE
            ];

            const result = await client.query(query, values); // Usa 'client' para a query

            if (result.rowCount) {
                const StaffAtualizadoId = result.rows[0].idStaff;

                await client.query('COMMIT'); // Confirma a transação

                res.locals.acao = 'atualizou';
                res.locals.idregistroalterado = StaffAtualizadoId;
                res.locals.idusuarioAlvo = null;

                return res.json({
                    message: "Funcionário atualizado com sucesso!",
                    id: StaffAtualizadoId,
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
    verificarPermissao('Staff', 'cadastrar'),
    upload.single('foto'), // Middleware do Multer para o campo 'foto'
    logMiddleware('Staff', {
        buscarDadosAnteriores: async (req) => {
            return { dadosanteriores: null, idregistroalterado: null };
        }
    }),
    async (req, res) => {
        // req.body agora é preenchido pelo Multer para campos de texto
        // Adicione 'banco' aqui e verifique 'extra'
        const {
            foto, nmFuncionario, descFuncao, custo, extra, transporte, alimentação, caixinha,
            nmCliente, nmEvento, dataevento , total} = req.body;

        const idempresa = req.idempresa;
        let client;
        let fotoPathParaBD = null; // Inicializa com null

        // Adicione console.logs para depurar os valores recebidos
        console.log('--- Início da requisição POST ---');
        console.log('req.body:', req.body);
        console.log('req.file:', req.file);
        console.log('ID da empresa (req.idempresa):', idempresa);
        console.log('Valor de "foto" após desestruturação:', foto);

        if (req.file) {
            // Se uma foto foi enviada, use o caminho gerado pelo Multer
            fotoPathParaBD = path.join('uploads/fotos_Staff', req.file.filename).replace(/\\/g, '/');
        }

        try {
            client = await pool.connect();
            await client.query('BEGIN');

            // --- Validação do campo 'foto' para POST ---
            if (!foto || foto.trim() === '') {
                if (req.file) {
                    fs.unlink(req.file.path, (err) => {
                        if (err) console.error("Erro ao apagar upload de POST falho (foto inválido):", err);
                    });
                }
                await client.query('ROLLBACK');
                return res.status(400).json({ message: "O campo 'foto' é obrigatório e não pode ser vazio." });
            }

            const resultStaff = await client.query(
                `INSERT INTO Staff (
                    foto, nmFuncionario, descFuncao, custo, extra, transporte, alimentação, caixinha, linkFoto
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING idStaff, foto`, // Retorna o ID e o caminho da foto para o frontend
                [
                    foto, fotoPathParaBD, nmFuncionario, descFuncao, custo, extra, transporte, // Use extra
                    alimentação, caixinha, linkFoto
                ]
            );
            const novoStaff = resultStaff.rows[0];
            const idNovoStaff = novoStaff.idStaff;

            await client.query(
                "INSERT INTO StaffEmpresas (idStaff, idEmpresa) VALUES ($1, $2)",
                [idNovoStaff, idempresa]
            );
            await client.query('COMMIT');

            res.locals.acao = 'cadastrou';
            res.locals.idregistroalterado = idNovoStaff;
            res.locals.idusuarioAlvo = null;

            res.status(201).json({
                message: "Funcionário salvo e associado à empresa com sucesso!",
                id: idNovoStaff,
                fotoPath: novoStaff.foto // Retorna o caminho da foto
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

