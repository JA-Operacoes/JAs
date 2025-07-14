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

const uploadDir = path.join(__dirname, '../uploads/fotos_staff');

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



router.get('/funcao', async (req, res) => {
  
 console.log("🔥 Rota /staff/funcao acessada");

  const idempresa = req.idempresa;

  try {
     
    const resultado = await pool.query(`
      SELECT f.*
      FROM funcao f
      INNER JOIN funcaoempresas fe ON fe.idfuncao = f.idfuncao
      WHERE fe.idempresa = $1
      ORDER BY f.descfuncao
    `, [idempresa]);

    res.json(resultado.rows);

  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao buscar clientes' });
  }

});

router.get("/funcionarios",  async (req, res) => { 
    const idempresa = req.idempresa;

    try {        
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
        
    } catch (error) {
        console.error("Erro ao buscar funcionário:", error);
        res.status(500).json({ message: "Erro ao buscar funcionário." });
    }
});

router.get('/clientes', async (req, res) => {
  
  console.log("🔥 Rota /staff/clientes acessada");

  const idempresa = req.idempresa;
  
  try {    
      console.log("🔍 Buscando todos os clientes para a empresa:", idempresa);
      const result = await pool.query(
        `SELECT c.* 
        FROM clientes c
        INNER JOIN clienteempresas ce ON ce.idcliente = c.idcliente
        WHERE ce.idempresa = $1 ORDER BY nmfantasia`
        , [idempresa]);
      console.log("✅ Consulta de todos os clientes retornou:", result.rows.length, "linhas.");
      return result.rows.length
        ? res.json(result.rows)
        : res.status(404).json({ message: "Nenhum Cliente encontrado" });
    
  } catch (error) {
    console.error("❌ Erro ao buscar clientes:", error);
    res.status(500).json({ message: "Erro ao buscar nome fantasia" });
  }
});

// GET /orcamento/eventos
router.get('/eventos', async (req, res) => {
  
 console.log("🔥 Rota /staff/eventos acessada");

  const idempresa = req.idempresa;

  try {
     
    const resultado = await pool.query(`
      SELECT e.*
      FROM eventos e
      INNER JOIN eventoempresas ee ON ee.idevento = e.idevento
      WHERE ee.idempresa = $1
      ORDER BY e.nmevento
    `, [idempresa]);

    res.json(resultado.rows);

  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao buscar clientes' });
  }
});

// GET /orcamento/localmontagem
router.get('/localmontagem', async (req, res) => {
  
 console.log("🔥 Rota /staff/localmontagem acessada");

  const idempresa = req.idempresa;

  try {
     
    const resultado = await pool.query(`
      SELECT l.*
      FROM localmontagem l
      INNER JOIN localmontempresas le ON le.idmontagem = l.idmontagem
      WHERE le.idempresa = $1
      ORDER BY l.descmontagem
    `, [idempresa]);

    res.json(resultado.rows);

  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao buscar clientes' });
  }

});

router.get('/pavilhao', async (req, res) => {
  
 console.log("🔥 Rota /staff/pavilhao acessada");

  const idempresa = req.idempresa;
  const idmontagem = req.query.idmontagem; 

  console.log("IDMONTAGEM", idmontagem);

  try {
     
    const resultado = await pool.query(`
      SELECT p.nmpavilhao
      FROM localmontpavilhao p      
      WHERE p.idmontagem = $1
      ORDER BY p.nmpavilhao
    `, [idmontagem]);

    console.log("PAVILHAO", resultado);
    res.json(resultado.rows);

  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao buscar clientes' });
  }

});

//GET pesquisar
router.get("/:idFuncionario", autenticarToken(), contextoEmpresa,
    verificarPermissao('staff', 'pesquisar'), // Permissão para visualizar
    async (req, res) => {
        console.log("🔥 Rota /staff/eventos-por-funcionario/GET acessada");
        const idempresa = req.idempresa;
        const idFuncionarioParam = req.params.idFuncionario; // O ID do funcionário a ser pesquisado

        let client;

        // Validação básica do parâmetro
        if (!idFuncionarioParam) {
            return res.status(400).json({ message: "ID do funcionário é obrigatório para esta consulta." });
        }

        try {
            client = await pool.connect();

            // A consulta SQL ajustada para filtrar por idfuncionario
            let query = `
                SELECT
                    se.idstaffevento,
                    se.idfuncionario,
                    se.nmfuncionario,
                    se.idevento,
                    se.nmevento,
                    se.idcliente,
                    se.nmcliente,
                    se.idfuncao,
                    se.nmfuncao,
                    se.idmontagem,
                    se.nmlocalmontagem,
                    se.pavilhao,
                    se.vlrcache,
                    se.vlralmoco,
                    se.vlrjantar,
                    se.vlrtransporte,
                    se.vlrextra,
                    se.vlrcaixinha,
                    se.descbonus,
                    se.vlrtotal,
                    se.datasevento,
                    s.idstaff,
                    s.avaliacao

                    -- *** ATENÇÃO AQUI: Como você armazena as datas do evento (período)? ***
                    -- Se 'datasevento' no seu POST é um array de datas ou um período,
                    -- você precisa ter uma coluna correspondente em staffeventos ou eventos.
                    -- Exemplo para um período (início e fim) se estiver na tabela 'eventos':
                    -- CONCAT(TO_CHAR(e.data_inicio, 'DD/MM/YYYY'), ' - ', TO_CHAR(e.data_fim, 'DD/MM/YYYY')) AS periodo,
                    -- JOIN eventos e ON se.idevento = e.idevento
                    -- Por enquanto, mantenho como um placeholder, você deve buscar este campo.
                    
                    -- Calcula o "Total" somando os valores, tratando NULLs como 0
                    --(se.vlrcache + COALESCE(se.vlralmoco, 0) + COALESCE(se.vlrjantar, 0) + COALESCE(se.vlrtransporte, 0) + COALESCE(se.vlrextra, 0) + COALESCE(se.vlrcaixinha, 0)) AS total
                FROM
                    staffeventos se
                INNER JOIN
                    staff s ON se.idstaff = s.idstaff
                INNER JOIN
                    staffEmpresas se_emp ON s.idstaff = se_emp.idstaff
                WHERE
                    se_emp.idEmpresa = $1 AND se.idfuncionario = $2
                ORDER BY
                    se.idevento DESC, se.idstaffevento DESC; -- Ordena por evento e depois pelo ID do registro de staffevento
            `;
            const queryParams = [idempresa, idFuncionarioParam];

            const result = await client.query(query, queryParams);

            console.log(`Foram encontrados ${result.rows.length} eventos para o funcionário ${idFuncionarioParam}.`);

            res.status(200).json(result.rows);

        } catch (error) {
            console.error("❌ Erro ao buscar eventos do funcionário:", error);
            res.status(500).json({ error: "Erro ao buscar eventos do funcionário", details: error.message });
        } finally {
            if (client) {
                client.release();
            }
            console.log('--- Fim da requisição GET /eventos-por-funcionario ---');
        }
    }
);


// // PUT atualizar
// router.put("/:idFuncionario", autenticarToken(), contextoEmpresa,
//     verificarPermissao('staff', 'alterar'),

//     logMiddleware('staff', {
//         buscarDadosAnteriores: async (req) => {
//             const idstaff = req.params.id;
//             const idempresa = req.idempresa;
//             if (!idstaff) {
//                 return { dadosanteriores: null, idregistroalterado: null };
//             }
//             try {
//                 const result = await pool.query(
//                     `SELECT func.* FROM staff func
//                      INNER JOIN staffempresas funce ON funce.idstaff = func.idstaff
//                      WHERE func.idstaff = $1 AND funce.idempresa = $2`,
//                     [idstaff, idempresa]
//                 );
//                 const linha = result.rows[0] || null;
//                 return {
//                     dadosanteriores: linha,
//                     idregistroalterado: linha?.idstaff || null
//                 };
//             } catch (error) {
//                 console.error("Erro ao buscar dados anteriores do funcionário para log:", error);
//                 return { dadosanteriores: null, idregistroalterado: null };
//             }
//         }
//     }),
//     async (req, res) => {
//         const id = req.params.id;
//         const idempresa = req.idempresa;
       
//         const {
//             nmFuncionario, descFuncao, custo, extra, transporte,
//             alimentação, caixinha, beneficio, datasEvento,
//             site, codigoBanco, 
//             pix, numeroConta, digitoConta, agencia, digitoAgencia, tipoConta, cep, rua, numero,
//             complemento, bairro, cidade, estado, pais} = req.body;

//         //let fotoPathParaBD = null;
//         let client; // Usaremos um cliente do pool para transação

//         try {
//             client = await pool.connect();
//             await client.query('BEGIN'); // Inicia a transação

//             // Adicione console.logs para depurar os valores recebidos
//             console.log('--- Início da requisição PUT ---');
//             console.log('req.body:', req.body);
//             console.log('req.file:', req.file);
//             console.log('ID do funcionário (param):', id);
//             console.log('ID da empresa (req.idempresa):', idempresa);
//          //   console.log('Valor de "foto" após desestruturação:', foto);

//             // 1. Lógica para determinar o caminho da foto
//             // if (req.file) {
//             //     // Se um novo arquivo foi enviado, use o caminho do novo arquivo
//             //     // E converta barras invertidas para barras normais para compatibilidade de caminho
//             //     fotoPathParaBD = path.join('uploads/fotos_staff', req.file.filename).replace(/\\/g, '/');

//             //     // Apagar foto antiga se uma nova for enviada
//             //     const resultFotoAntiga = await client.query( // Usar 'client' para manter na transação
//             //         `SELECT foto FROM staff WHERE idstaff = $1`,
//             //         [id]
//             //     );
//             //     if (resultFotoAntiga.rows.length > 0 && resultFotoAntiga.rows[0].foto) {
//             //         const fotoAntigaPath = path.join(__dirname, '..', resultFotoAntiga.rows[0].foto);
//             //         // Verifique se o arquivo existe antes de tentar apagar
//             //         if (fs.existsSync(fotoAntigaPath)) {
//             //             fs.unlink(fotoAntigaPath, (err) => {
//             //                 if (err) console.error("Erro ao apagar foto antiga:", err);
//             //             });
//             //         }
//             //     }
//             // } else {
//             //     // Se nenhum novo arquivo foi enviado, MANTENHA o caminho da foto existente no BD
//             //     // OU defina como NULL se a intenção for remover a foto sem upload de nova
//             //     const resultFotoExistente = await client.query( // Usar 'client' para manter na transação
//             //         `SELECT foto FROM staff WHERE idstaff = $1`,
//             //         [id]
//             //     );
//             //     fotoPathParaBD = resultFotoExistente.rows[0]?.foto || null;
//             // }

//             // // --- Validação do campo 'foto' ---
//             // // Se 'foto' não é permitido ser nulo ou vazio no BD, force um erro aqui.
//             // if (!foto || foto.trim() === '') {
//             //     // Se chegar aqui, significa que o frontend enviou um valor inválido,
//             //     // ou o Multer/Express o transformou em vazio/nulo.
//             //     // Reverter a transação e enviar erro 400.
//             //     if (req.file) { // Se um arquivo foi carregado, apaga ele antes de sair
//             //         fs.unlink(req.file.path, (err) => {
//             //             if (err) console.error("Erro ao apagar upload de PUT falho (foto inválido):", err);
//             //         });
//             //     }
//             //     await client.query('ROLLBACK');
//             //     return res.status(400).json({ message: "O campo 'foto' é obrigatório e não pode ser vazio." });
//             // }

//             let datasEventoParsed = null;
//             if (datasEvento) {
//                 try {
//                     datasEventoParsed = JSON.parse(datasEvento);
//                     // Opcional: Se precisar validar que é um array, e que os elementos são strings, etc.
//                     if (!Array.isArray(datasEventoParsed)) {
//                         throw new Error("datasEvento não é um array válido.");
//                     }
//                 } catch (parseError) {
//                     await client.query('ROLLBACK');
//                     // Se o frontend enviou um JSON inválido, retorna um erro 400
//                     return res.status(400).json({ message: "Formato de 'datasEvento' inválido. Esperado um array JSON.", details: parseError.message });
//                 }
//             }
//             console.log('Valor de "datasEvento" após parse:', datasEventoParsed);
//             // 2. Executa a atualização no banco de dados
//             const query = `
//                 UPDATE staffeventos
//                 SET nmFuncionario = $1, descFuncao = $2, custo = $3, fluencia = $4, transporte = $6,
//                     alimentação = $7, caixinha = $8, beneficio = $9, site = $10, codigobanco = $11, pix = $12, numeroconta = $13,
//                     digitoConta = $14, agencia = $15, digitoAgencia = $16, tipoconta = $17, cep = $18, rua = $19, numero = $20,
//                     complemento = $21, bairro = $22, cidade = $23, estado = $24, pais = $25, datasEvento = $26
//                 WHERE idstaff = $27
//                 RETURNING idstaff, datasEvento;
//             `;

//             const values = [
//         //        foto, // O valor de 'foto' deve ser tratado como string
//         //        fotoPathParaBD,
//                 nmFuncionario, descFuncao, custo, extra, transporte,
//                 alimentação, caixinha, beneficio, site, codigoBanco, 
//                 pix, numeroConta, digitoConta, agencia, digitoAgencia, tipoConta, cep, rua, numero,
//                 complemento, bairro, cidade, estado, pais, datasEventoParsed,
//                 id // ID do funcionário para a cláusula WHERE
//             ];

//             const result = await client.query(query, values); // Usa 'client' para a query

//             if (result.rowCount) {
//                 const staffAtualizadoId = result.rows[0].idstaff;

//                 await client.query('COMMIT'); // Confirma a transação

//                 res.locals.acao = 'atualizou';
//                 res.locals.idregistroalterado = staffAtualizadoId;
//                 res.locals.idusuarioAlvo = null;

//                 return res.json({
//                     message: "Funcionário atualizado com sucesso!",
//                     id: staffAtualizadoId,
//         //            fotoPath: result.rows[0].foto, // Retorna o caminho da foto que foi salvo
//                     datasEvento: staffAtualizado.datasevento 
//                 });
//             } else {
//                 // Se nenhum funcionário foi encontrado ou não pertence à empresa do usuário
//                 if (req.file) { // Se houve upload mas a atualização falhou, apaga o arquivo
//                     fs.unlink(req.file.path, (err) => {
//                         if (err) console.error("Erro ao apagar arquivo de upload (PUT falho):", err);
//                     });
//                 }
//                 await client.query('ROLLBACK'); // Reverte a transação
//                 return res.status(404).json({ message: "Funcionário não encontrado ou você não tem permissão para atualizá-lo." });
//             }
//         } catch (error) {
//             if (client) {
//                 await client.query('ROLLBACK'); // Reverte a transação em caso de erro
//             }
//             console.error("Erro ao atualizar funcionário:", error);
//             if (req.file) { // Se houve upload e erro, apaga o arquivo
//                 fs.unlink(req.file.path, (err) => {
//                     if (err) console.error("Erro ao apagar arquivo de upload (PUT erro):", err);
//                 });
//             }
//             // Mensagem de erro mais específica para não-nulo
//             if (error.code === '23502') { // PostgreSQL error code for not-null constraint violation
//                  return res.status(400).json({ message: `Campo obrigatório faltando ou inválido: ${error.column}. Por favor, verifique os dados e tente novamente.`, details: error.message });
//             }
//             res.status(500).json({ message: "Erro ao atualizar funcionário.", details: error.message });
//         } finally {
//             if (client) {
//                 client.release(); // Libera o cliente de volta para o pool
//             }
//             console.log('--- Fim da requisição PUT ---');
//         }
//     }
// );

router.put("/:idStaffEvento", autenticarToken(), contextoEmpresa,
    verificarPermissao('staff', 'alterar'),
    // Removido: upload.single('foto') ou upload.none() - não é necessário se não houver campos de arquivo
    upload.none(),
    logMiddleware('staffeventos', {
        buscarDadosAnteriores: async (req) => {
            const idstaffEvento = req.params.idStaffEvento;
            const idempresa = req.idempresa; // Captura o ID da empresa do contexto
            if (!idstaffEvento) {
                return { dadosanteriores: null, idregistroalterado: null };
            }
            try {
                // Ajustar a query para buscar o registro de staffeventos
                // Incluímos o JOIN com staffempresas para verificar a posse da empresa
                const result = await pool.query(
                    `SELECT se.*, se.nmfuncionario AS nmfuncionario_principal,
                            se.nmfuncao, se.nmcliente, se.nmevento, se.nmlocalmontagem
                     FROM staffeventos se
                     INNER JOIN staff s ON se.idfuncionario = s.idstaff
                     INNER JOIN staffempresas sme ON sme.idstaff = s.idstaff                     
                     WHERE se.idstaffevento = $1 AND sme.idempresa = $2`, // Verifica a empresa do staff
                    [idstaffEvento, idempresa]
                );
                const linha = result.rows[0] || null;
                return {
                    dadosanteriores: linha,
                    idregistroalterado: linha?.idstaffevento || null
                };
            } catch (error) {
                console.error("Erro ao buscar dados anteriores do evento de staff para log:", error);
                return { dadosanteriores: null, idregistroalterado: null };
            }
        }
    }),
    async (req, res) => {
        const idStaffEvento = req.params.idStaffEvento;
        const idempresa = req.idempresa; // ID da empresa do token autenticado

        // Desestruturar TODOS os campos enviados pelo FormData do frontend
        const {
            idfuncionario, nmfuncionario, idfuncao, nmfuncao, idcliente, nmcliente,
            idevento, nmevento, idmontagem, nmlocalmontagem, pavilhao,
            vlrcache, vlrextra, vlrtransporte, vlralmoco, vlrjantar, vlrcaixinha,
            descbonus, datasevento, vlrtotal
        } = req.body;


        console.log("BODY", req.body);

        let client;

        try {
            client = await pool.connect();
            await client.query('BEGIN'); // Inicia a transação

            console.log('--- Início da requisição PUT (StaffEvento) ---');
            console.log('req.body:', req.body);
            console.log('ID do StaffEvento (param):', idStaffEvento);
            console.log('ID do Funcionário (do body - associado ao evento):', idfuncionario);
            console.log('ID da empresa (req.idempresa):', idempresa);

            // 1. Parsear o datasEvento (array de datas)
            let datasEventoParsed = null;
            if (datasevento) {
                try {
                    datasEventoParsed = JSON.parse(datasevento);
                    if (!Array.isArray(datasEventoParsed)) {
                        throw new Error("datasevento não é um array JSON válido.");
                    }
                } catch (parseError) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "Formato de 'datasevento' inválido. Esperado um array JSON.", details: parseError.message });
                }
            }
            console.log('Valor de "datasevento" após parse:', datasEventoParsed);

            // 2. Executa a atualização no banco de dados (tabela staffeventos)
            // IMPORTANTE: Adicionamos o JOIN com staffempresas e a condição de idempresa
            // para garantir que apenas eventos de staffes pertencentes à empresa do usuário sejam atualizados.
            const queryStaffEventos = `
                UPDATE staffeventos se
                SET idfuncionario = $1, nmfuncionario = $2, idfuncao = $3, nmfuncao = $4,
                    idcliente = $5, nmcliente = $6, idevento = $7, nmevento = $8, idmontagem = $9,
                    nmlocalmontagem = $10, pavilhao = $11, vlrcache = $12, vlrextra = $13, vlrtransporte = $14,
                    vlralmoco = $15, vlrjantar = $16, vlrcaixinha = $17, descbonus = $18,
                    datasevento = $19, vlrtotal = $20
                FROM staff s
                INNER JOIN staffempresas sme ON sme.idstaff = s.idstaff
                WHERE se.idstaff = s.idstaff -- Garante que estamos atualizando o staffevento do staff correto
                  AND se.idstaffevento = $21
                  AND sme.idempresa = $22
                RETURNING se.idstaffevento, se.datasevento;
            `;

            const valuesStaffEventos = [
                idfuncionario,
                nmfuncionario,
                idfuncao,
                nmfuncao,
                idcliente,
                nmcliente,
                idevento,
                nmevento,
                idmontagem,
                nmlocalmontagem,
                pavilhao,
                parseFloat(String(vlrcache).replace(',', '.')),
                parseFloat(String(vlrextra).replace(',', '.')),
                parseFloat(String(vlrtransporte).replace(',', '.')),
                parseFloat(String(vlralmoco).replace(',', '.')),
                parseFloat(String(vlrjantar).replace(',', '.')),
                parseFloat(String(vlrcaixinha).replace(',', '.')),
                descbonus,
                JSON.stringify(datasEventoParsed),
                parseFloat(String(vlrtotal).replace(',', '.')),            
                idStaffEvento,
                idempresa // Parâmetro para a verificação de idempresa
            ];

            const resultStaffEventos = await client.query(queryStaffEventos, valuesStaffEventos);

            console.log("Resultado Eventos",resultStaffEventos);

            if (resultStaffEventos.rowCount) {
                const staffEventoAtualizadoId = resultStaffEventos.rows[0].idstaffevento;

                await client.query('COMMIT'); // Confirma a transação

                res.locals.acao = 'atualizou';
                res.locals.idregistroalterado = staffEventoAtualizadoId;
                res.locals.idusuarioAlvo = idfuncionario;

                return res.json({
                    message: "Evento de Staff atualizado com sucesso!",
                    id: staffEventoAtualizadoId,
                    datasEvento: resultStaffEventos.rows[0].datasevento
                });
            } else {
                await client.query('ROLLBACK'); // Reverte a transação
                // A mensagem de 404 agora também cobre o caso de não pertencer à empresa
                return res.status(404).json({ message: "Evento de Staff não encontrado ou você não tem permissão para atualizá-lo." });
            }
        } catch (error) {
            if (client) {
                await client.query('ROLLBACK');
            }
            console.error("Erro ao atualizar evento de Staff:", error);

            if (error.code === '23502') {
                return res.status(400).json({ message: `Campo obrigatório faltando ou inválido: ${error.column}. Por favor, verifique os dados e tente novamente.`, details: error.message });
            }
            // Adicionado tratamento para erro de formato de número/float
            if (error.code === '22P02') { // Erro de sintaxe de entrada inválida (como texto em float)
                 return res.status(400).json({
                    message: "Um valor numérico inválido foi fornecido. Por favor, verifique os campos de custo, extra, transporte, alimentação, jantar e caixinha.",
                    details: error.message
                 });
            }
            res.status(500).json({ message: "Erro ao atualizar evento de Staff.", details: error.message });
        } finally {
            if (client) {
                client.release();
            }
            console.log('--- Fim da requisição PUT (StaffEvento) ---');
        }
    }
);


router.post("/", autenticarToken(), contextoEmpresa,
   verificarPermissao('staff', 'cadastrar'), 
    upload.none(),    
    logMiddleware('staff', {
        buscarDadosAnteriores: async (req) => {
            console.log("BUSCA DADOS ANTERIORES STAFF");
            return { dadosanteriores: null, idregistroalterado: null };
        }
    }),
    async (req, res) => {
        console.log("🔥 Rota /staff/POST acessada");
        const {
            // Campos da tabela STAFF
            idfuncionario, 
            avaliacao,             

            // Campos da tabela STAFFEVENTOS (para um único evento)
            idevento, nmevento, idcliente, nmcliente,
            idfuncao, nmfuncao, idmontagem, nmlocalmontagem, pavilhao,
            vlrcache, vlralmoco, vlrjantar, vlrtransporte, vlrextra,
            vlrcaixinha, nmfuncionario, datasevento: datasEventoRaw,
            descbonus, comppgtocache, comppgtoajdcusto, comppgtoextras
        } = req.body;

        const idempresa = req.idempresa;
        let client;        

        console.log('--- Início da requisição POST ---');
        console.log('req.body:', req.body);
        console.log('req.file (Multer upload):', req.file); // Será undefined se o input for disabled
        console.log('ID da empresa (req.idempresa):', idempresa);

        if (
            !idfuncionario || !nmfuncionario || !avaliacao ||
            !idevento || !nmevento || !idcliente || !nmcliente ||
            !idfuncao || !nmfuncao || !idmontagem || !nmlocalmontagem ||
            !vlrcache 
        ) {
            return res.status(400).json({
                message: "Dados obrigatórios ausentes. Verifique os campos preenchidos e tente novamente."
            });
        }

        try {
            client = await pool.connect();
            await client.query('BEGIN'); // Inicia a transação           

            // Parsear o datasEvento
            let datasEventoParsed = null;
            if (datasEventoRaw) {
                try {
                    datasEventoParsed = JSON.parse(datasEventoRaw);
                    if (!Array.isArray(datasEventoParsed)) {
                        throw new Error("datasevento não é um array válido.");
                    }
                } catch (parseError) {
                    return res.status(400).json({
                        message: "Formato de 'datasevento' inválido. Esperado um array JSON.",
                        details: parseError.message
                    });
                }
            }
            console.log('Valor de "datasEvento" após parse (POST):', datasEventoParsed);

            // --- INSERÇÃO NA TABELA STAFF ---
            const staffInsertQuery = `
                INSERT INTO staff (
                    idfuncionario, avaliacao
                ) VALUES ($1, $2)
                RETURNING idstaff;
            `;

            const staffInsertValues = [ idfuncionario, avaliacao,  ];

            const resultStaff = await client.query(staffInsertQuery, staffInsertValues);
            const novoStaff = resultStaff.rows[0];
            const idNovoStaff = novoStaff.idstaff;

            // --- INSERÇÃO NA TABELA STAFFEMPRESAS ---
            await client.query(
                "INSERT INTO staffEmpresas (idstaff, idEmpresa) VALUES ($1, $2)",
                [idNovoStaff, idempresa]
            );

            // --- INSERÇÃO NA TABELA STAFFEVENTOS (SE HOUVER DADOS) ---
            console.log("VAI SALVAR STAFFEVENTOS", idfuncionario, idNovoStaff);
            if (idfuncionario && idNovoStaff) {
                const eventoInsertQuery = `
                    INSERT INTO staffeventos (
                        idstaff, idfuncionario, nmfuncionario, idevento, nmevento, idcliente, nmcliente,
                        idfuncao, nmfuncao, idmontagem, nmlocalmontagem, pavilhao,
                        vlrcache, vlralmoco, vlrjantar, vlrtransporte, vlrextra,
                        vlrcaixinha, descbonus, comppgtocache, comppgtoajdcusto, comppgtoextras
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
                    RETURNING idstaffevento;
                `;
                const eventoInsertValues = [
                    idNovoStaff, idfuncionario, nmfuncionario, idevento, nmevento, idcliente, nmcliente,
                    idfuncao, nmfuncao, idmontagem, nmlocalmontagem, pavilhao,
                    vlrcache, vlralmoco, vlrjantar, vlrtransporte, vlrextra,
                    vlrcaixinha, descbonus, comppgtocache, comppgtoajdcusto, comppgtoextras
                    
                ];
                await client.query(eventoInsertQuery, eventoInsertValues);
            } else {
                console.log("Nenhum dado de evento suficiente fornecido para inserção em staffeventos.");
            }

            await client.query('COMMIT'); // Confirma a transação

            res.locals.acao = 'cadastrou';
            res.locals.idregistroalterado = idNovoStaff;
            res.locals.idusuarioAlvo = null;

            res.status(201).json({
                message: "Staff e evento(s) salvos e associados à empresa com sucesso!",
                id: idNovoStaff,
                datasEvento: novoStaff.datasEvento
            });
        } catch (error) {
            if (client) {
                await client.query('ROLLBACK');
            }
            console.error("❌ Erro ao salvar staff e/ou associá-lo à empresa:", error);

           
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

