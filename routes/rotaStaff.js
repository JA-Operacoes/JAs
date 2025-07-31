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

const comprovantesUploadDir = path.join(__dirname, '../uploads/staff_comprovantes');
if (!fs.existsSync(comprovantesUploadDir)) {
    fs.mkdirSync(comprovantesUploadDir, { recursive: true });
}

const storageComprovantes = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, comprovantesUploadDir); // Multer salva aqui
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilterComprovantes = (req, file, cb) => {
    // Permite imagens e PDFs
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
        cb(null, true);
    } else {
        cb(new Error('Tipo de arquivo não suportado para comprovantes! Apenas imagens e PDFs são permitidos.'), false);
    }
};
const uploadComprovantesMiddleware = multer({
    storage: storageComprovantes,
    fileFilter: fileFilterComprovantes,
    limits: {
        fileSize: 10 * 1024 * 1024 // Limite de 10MB para comprovantes (ajuste conforme necessário)
    }
}).fields([
    { name: 'comppgtocache', maxCount: 1 },
    { name: 'comppgtoajdcusto', maxCount: 1 },
    { name: 'comppgtoextras', maxCount: 1 }
]);

const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Tipo de arquivo não suportado! Apenas imagens são permitidas.'), false);
    }
};


// --- Fim da Configuração do Multer ---

function deletarArquivoAntigo(relativePath) {
    if (relativePath) {
        // Constrói o caminho absoluto no servidor usando o diretório base do projeto
        const absolutePath = path.join(__dirname, '..', relativePath);

        if (fs.existsSync(absolutePath)) {
            fs.unlink(absolutePath, (err) => {
                if (err) console.error(`Erro ao deletar arquivo antigo: ${absolutePath}`, err);
                else console.log(`Arquivo antigo deletado: ${absolutePath}`);
            });
        } else {
            console.warn(`Tentativa de deletar arquivo que não existe: ${absolutePath}`);
        }
    }
}

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

router.get('/check-duplicate', autenticarToken(), contextoEmpresa, async (req, res) => {
    console.log("🔥 Rota /staff/check-duplicate acessada");
    let client; // Declarar client aqui para garantir que esteja acessível no finally
    try {
        const { idFuncionario, nmFuncionario, setor, nmlocalmontagem, nmevento, nmcliente, datasevento } = req.query;

        if (!idFuncionario || !nmFuncionario || !nmlocalmontagem || !nmevento || !nmcliente || !datasevento) {
            return res.status(400).json({ message: 'Campos obrigatórios (ID Funcionário, Nome Funcionário, Local Montagem, Evento, Cliente, Datas Evento) não foram fornecidos para verificar duplicidade.' });
        }

        let datasEventoArray;
        try {
            datasEventoArray = JSON.parse(datasevento);
            if (!Array.isArray(datasEventoArray) || datasEventoArray.length === 0) {
                return res.status(400).json({ message: 'Formato inválido para datasevento.' });
            }
        } catch (parseError) {
            return res.status(400).json({ message: 'datasevento inválido: ' + parseError.message });
        }

        client = await pool.connect(); // Conectar ao pool

        // Iniciar a query base
        let query = `
            SELECT se.idstaffevento, se.vlrcache, se.vlrextra, se.vlrtransporte, se.vlralmoco, se.vlrjantar, se.vlrcaixinha,
                   se.descbonus, se.descbeneficios, se.setor, se.pavilhao, se.vlrtotal, se.comppgtocache, se.comppgtoajdcusto, se.comppgtoextras,
                   se.idfuncionario, se.idfuncao, se.nmfuncao, se.idcliente, se.idevento, se.idmontagem, se.datasevento,
                   se.nmfuncionario, se.nmcliente, se.nmevento, se.nmlocalmontagem,
                   s.idstaff, s.avaliacao
            FROM staffeventos se
            INNER JOIN staff s ON se.idstaff = s.idstaff
            WHERE se.idfuncionario = $1
        `;

        // Array para armazenar os valores dos parâmetros
        const queryValues = [idFuncionario];
        let paramIndex = 2; // Começa em 2 porque $1 já foi usado para idFuncionario

        // Adicionar condição para setor dinamicamente
        if (setor) { // Se setor foi fornecido (não é string vazia, null, undefined)
            query += ` AND UPPER(se.setor) = UPPER($${paramIndex})`;
            queryValues.push(setor);
            paramIndex++;
        } else { // Se setor está vazio/nulo
            query += ` AND (se.setor IS NULL OR se.setor = '')`;
            // Não adiciona nada a queryValues para esta condição
        }

        // Adicionar as demais condições
        query += ` AND UPPER(se.nmlocalmontagem) = UPPER($${paramIndex})`;
        queryValues.push(nmlocalmontagem);
        paramIndex++;

        query += ` AND UPPER(se.nmevento) = UPPER($${paramIndex})`;
        queryValues.push(nmevento);
        paramIndex++;

        query += ` AND UPPER(se.nmcliente) = UPPER($${paramIndex})`;
        queryValues.push(nmcliente);
        paramIndex++;

        query += ` AND se.datasevento::jsonb = $${paramIndex}::jsonb;`;
        queryValues.push(JSON.stringify(datasEventoArray));

        // Log da query e dos valores para depuração
        console.log("QUERY DINÂMICA:", query);
        console.log("VALUES DA QUERY:", queryValues);

        const result = await client.query(query, queryValues);

        if (result.rows.length > 0) {
            return res.status(200).json({ isDuplicate: true, existingEvent: result.rows[0] });
        } else {
            return res.status(200).json({ isDuplicate: false, message: 'Nenhum evento duplicado encontrado.' });
        }

    } catch (error) {
        console.error('Erro ao verificar duplicidade de evento:', error);
        // Garante que o erro é capturado e retornado para o frontend
        res.status(500).json({ message: 'Erro interno ao verificar duplicidade.', error: error.message });
    } finally {
        if (client) {
            client.release(); // Libera o cliente de volta para o pool
        }
    }
});

// Exemplo da sua rota de verificação de disponibilidade (no seu arquivo de rotas, ex: rotaStaff.js)
// staffRoutes.js (ou o nome do seu arquivo de rotas de staff)

router.post('/check-availability', autenticarToken(), contextoEmpresa, async (req, res) => {
    console.log("🔥 Rota /staff/check-availability (POST) acessada para verificação de disponibilidade");

    const { idfuncionario, datas, idEventoIgnorar } = req.body;
    const idEmpresa = req.idempresa;

    if (!idfuncionario || !datas || !Array.isArray(datas) || datas.length === 0 || !idEmpresa) {
        return res.status(400).json({ message: "Dados obrigatórios ausentes ou em formato incorreto para verificar disponibilidade (idfuncionario, datas, idempresa)." });
    }

    let client;
    try {
        client = await pool.connect();

        // 1. Iniciar o array de parâmetros com idfuncionario e idEmpresa
        let params = [idfuncionario, idEmpresa]; // Estes serão $1 e $2

        // 2. Determinar o índice de início dos placeholders para as datas
        // As datas começarão a partir do $3
        const dateStartParamIndex = params.length + 1; 
        const datePlaceholders = datas.map((_, i) => `$${dateStartParamIndex + i}`).join(', ');
        
        // 3. Adicionar as datas ao array de parâmetros
        params = params.concat(datas); // As datas agora ocupam os placeholders a partir do $3

        // 4. Determinar o placeholder para idEventoIgnorar (se existir)
        // Ele será o próximo placeholder disponível após todas as datas
        const idEventoIgnorarParamIndex = params.length + 1; 
        
        let query = `
            SELECT 
                se.nmevento, 
                se.nmcliente, 
                se.datasevento, 
                se.idstaffevento
            FROM 
                staffeventos se
            INNER JOIN 
                staff s ON se.idstaff = s.idstaff
            INNER JOIN 
                staffEmpresas se_emp ON s.idstaff = se_emp.idstaff 
            WHERE 
                se.idfuncionario = $1
                AND se_emp.idEmpresa = $2
                -- CLÁUSULA PARA VERIFICAR SOBREPOSIÇÃO DE DATAS
                AND EXISTS (
                    SELECT 1
                    FROM jsonb_array_elements_text(se.datasevento) AS existing_date
                    WHERE existing_date.value = ANY(ARRAY[${datePlaceholders}]::text[])
                )
        `;
        
        // 5. Adicionar a condição para IGNORAR o próprio evento em edição, se idEventoIgnorar for fornecido
        if (idEventoIgnorar !== null) { // Use !== null para garantir que 0 (zero) seja considerado
            query += ` AND se.idstaffevento != $${idEventoIgnorarParamIndex}`; 
            params.push(idEventoIgnorar); // Adiciona o valor de idEventoIgnorar por último no array de parâmetros
        }

        console.log("Query de disponibilidade (com EXISTS, ajustado):", query);
        console.log("Parâmetros de disponibilidade (com EXISTS, ajustado):", params);

        const result = await client.query(query, params);

        if (result.rows.length > 0) {
            return res.json({
                isAvailable: false,
                conflictingEvent: result.rows[0] 
            });
        } else {
            return res.json({ isAvailable: true, conflictingEvent: null });
        }

    } catch (error) {
        console.error("❌ Erro no backend ao verificar disponibilidade:", error);
        res.status(500).json({ message: "Erro interno do servidor ao verificar disponibilidade.", details: error.message });
    } finally {
        if (client) {
            client.release();
        }
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
                    se.descbeneficios,                
                    se.vlrtotal,
                    se.datasevento,
                    se.comppgtocache,
                    se.comppgtoajdcusto,
                    se.comppgtoextras,
                    se.setor,
                    se.statuspgto,
                    s.idstaff,
                    s.avaliacao

                    -- * ATENÇÃO AQUI: Como você armazena as datas do evento (período)? *
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
                se.datasevento ->> (jsonb_array_length(se.datasevento) - 1) DESC,
                se.nmcliente ASC,
                se.nmevento ASC;
                    
            `;

            //se.idevento DESC, se.idstaffevento DESC; -- Ordena por evento e depois pelo ID do registro de staffevento
            const queryParams = [idempresa, idFuncionarioParam];

            const result = await client.query(query, queryParams);

            // console.log(Foram encontrados ${result.rows.length} eventos para o funcionário ${idFuncionarioParam});

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


router.put("/:idStaffEvento", autenticarToken(), contextoEmpresa,
    verificarPermissao('staff', 'alterar'),
    // Removido: upload.single('foto') ou upload.none() - não é necessário se não houver campos de arquivo
    //upload.none(),
    uploadComprovantesMiddleware,
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
            descbonus, datasevento, vlrtotal, descbeneficios, setor, statuspgto
        } = req.body;

        const files = req.files;
        const comprovanteCacheFile = files?.comppgtocache ? files.comppgtocache[0] : null;
        const comprovanteAjdCustoFile = files?.comppgtoajdcusto ? files.comppgtoajdcusto[0] : null;
        const comprovanteExtrasFile = files?.comppgtoextras ? files.comppgtoextras[0] : null;
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
            console.log('Status Pagemento:', statuspgto);


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

            const oldRecordResult = await client.query(
                `SELECT comppgtocache, comppgtoajdcusto, comppgtoextras
                 FROM staffeventos se
                 INNER JOIN staff s ON se.idstaff = s.idstaff
                 INNER JOIN staffempresas sme ON sme.idstaff = s.idstaff
                 WHERE se.idstaffevento = $1 AND sme.idempresa = $2`,
                [idStaffEvento, idempresa]
            );
            const oldRecord = oldRecordResult.rows[0];
            console.log("Old Record retrieved:", oldRecord); // Log para verificar o oldRecord

            // 3. Determinar os novos caminhos dos comprovantes e deletar os antigos se houver substituição
            let newComppgtoCachePath = oldRecord ? oldRecord.comppgtocache : null;
            if (comprovanteCacheFile) {
                deletarArquivoAntigo(oldRecord ? oldRecord.comppgtocache : null); // Chamada CORRETA
                newComppgtoCachePath = `/uploads/staff_comprovantes/${comprovanteCacheFile.filename}`; // Caminho CORRETO para o BD
            } else if (req.body.comppgtocache === '') { // Se o frontend enviou string vazia (limpou o campo)
                deletarArquivoAntigo(oldRecord ? oldRecord.comppgtocache : null); // Chamada CORRETA
                newComppgtoCachePath = null;
            }
            // else: Se nenhum novo arquivo foi enviado E o campo não foi explicitamente limpo,
            // newComppgtoCachePath mantém o valor de oldRecord.comppgtocache (o arquivo existente é mantido).

            let newComppgtoAjdCustoPath = oldRecord ? oldRecord.comppgtoajdcusto : null;
            if (comprovanteAjdCustoFile) {
                deletarArquivoAntigo(oldRecord ? oldRecord.comppgtoajdcusto : null); // Chamada CORRETA
                newComppgtoAjdCustoPath = `/uploads/staff_comprovantes/${comprovanteAjdCustoFile.filename}`; // Caminho CORRETO para o BD
            } else if (req.body.comppgtoajdcusto === '') {
                deletarArquivoAntigo(oldRecord ? oldRecord.comppgtoajdcusto : null); // Chamada CORRETA
                newComppgtoAjdCustoPath = null;
            }

            let newComppgtoExtrasPath = oldRecord ? oldRecord.comppgtoextras : null;
            if (comprovanteExtrasFile) {
                deletarArquivoAntigo(oldRecord ? oldRecord.comppgtoextras : null); // Chamada CORRETA
                newComppgtoExtrasPath = `/uploads/staff_comprovantes/${comprovanteExtrasFile.filename}`; // Caminho CORRETO para o BD
            } else if (req.body.comppgtoextras === '') {
                deletarArquivoAntigo(oldRecord ? oldRecord.comppgtoextras : null); // Chamada CORRETA
                newComppgtoExtrasPath = null;
            }


            // 2. Executa a atualização no banco de dados (tabela staffeventos)
            // IMPORTANTE: Adicionamos o JOIN com staffempresas e a condição de idempresa
            // para garantir que apenas eventos de staffes pertencentes à empresa do usuário sejam atualizados.
            const queryStaffEventos = `
                UPDATE staffeventos se
                SET idfuncionario = $1, nmfuncionario = $2, idfuncao = $3, nmfuncao = $4,
                    idcliente = $5, nmcliente = $6, idevento = $7, nmevento = $8, idmontagem = $9,
                    nmlocalmontagem = $10, pavilhao = $11, vlrcache = $12, vlrextra = $13, vlrtransporte = $14,
                    vlralmoco = $15, vlrjantar = $16, vlrcaixinha = $17, descbonus = $18,
                    datasevento = $19, vlrtotal = $20, comppgtocache = $21, comppgtoajdcusto = $22, comppgtoextras = $23, descbeneficios = $24, setor = $25, statuspgto = $26                   
                FROM staff s
                INNER JOIN staffempresas sme ON sme.idstaff = s.idstaff
                WHERE se.idstaff = s.idstaff -- Garante que estamos atualizando o staffevento do staff correto
                  AND se.idstaffevento = $27
                  AND sme.idempresa = $28
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
                newComppgtoCachePath, // Caminho do novo comprovante de cache
                newComppgtoAjdCustoPath, // Caminho do novo comprovante de ajuda de custo
                newComppgtoExtrasPath, // Caminho do novo comprovante de extras    
                descbeneficios,
                setor, // Novo campo descbeneficios 
                statuspgto,                      
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
          
            if (comprovanteCacheFile) deletarArquivoAntigo(`/uploads/staff_comprovantes/${comprovanteCacheFile.filename}`);
            if (comprovanteAjdCustoFile) deletarArquivoAntigo(`/uploads/staff_comprovantes/${comprovanteAjdCustoFile.filename}`);
            if (comprovanteExtrasFile) deletarArquivoAntigo(`/uploads/staff_comprovantes/${comprovanteExtrasFile.filename}`);        

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
      
        }
    }
);


// router.post("/", autenticarToken(), contextoEmpresa,
//    verificarPermissao('staff', 'cadastrar'), 
//     //upload.none(), 
//     uploadComprovantesMiddleware,   
//     logMiddleware('staff', {
//         buscarDadosAnteriores: async (req) => {
//             console.log("BUSCA DADOS ANTERIORES STAFF");
//             return { dadosanteriores: null, idregistroalterado: null };
//         }
//     }),
//     async (req, res) => {
//         console.log("🔥 Rota /staff/POST acessada");
//         const {
//             // Campos da tabela STAFF
//             idfuncionario, 
//             avaliacao,             

//             // Campos da tabela STAFFEVENTOS (para um único evento)
//             idevento, nmevento, idcliente, nmcliente,
//             idfuncao, nmfuncao, idmontagem, nmlocalmontagem, pavilhao,
//             vlrcache, vlralmoco, vlrjantar, vlrtransporte, vlrextra,
//             vlrcaixinha, nmfuncionario, datasevento: datasEventoRaw,
//             descbonus, descbeneficios, vlrtotal, setor
//         } = req.body;

//         const files = req.files;
//         const comprovanteCacheFile = files?.comppgtocache ? files.comppgtocache[0] : null;
//         const comprovanteAjdCustoFile = files?.comppgtoajdcusto ? files.comppgtoajdcusto[0] : null;
//         const comprovanteExtrasFile = files?.comppgtoextras ? files.comppgtoextras[0] : null;

//         const idempresa = req.idempresa;
//         let client;        

//         console.log('--- Início da requisição POST ---');
//         console.log('req.body:', req.body);
//         console.log('req.file (Multer upload):', req.file); // Será undefined se o input for disabled
//         console.log('ID da empresa (req.idempresa):', idempresa);

//         if (
//             !idfuncionario || !nmfuncionario || !avaliacao ||
//             !idevento || !nmevento || !idcliente || !nmcliente ||
//             !idfuncao || !nmfuncao || !idmontagem || !nmlocalmontagem ||
//             !vlrcache 
//         ) {
//             return res.status(400).json({
//                 message: "Dados obrigatórios ausentes. Verifique os campos preenchidos e tente novamente."
//             });
//         }

//         try {
//             client = await pool.connect();
//             await client.query('BEGIN'); // Inicia a transação           

//             // Parsear o datasEvento
//             let datasEventoParsed = null;
//             if (datasEventoRaw) {
//                 try {
//                     datasEventoParsed = JSON.parse(datasEventoRaw);
//                     if (!Array.isArray(datasEventoParsed)) {
//                         throw new Error("datasevento não é um array válido.");
//                     }
//                 } catch (parseError) {
//                     return res.status(400).json({
//                         message: "Formato de 'datasevento' inválido. Esperado um array JSON.",
//                         details: parseError.message
//                     });
//                 }
//             }
//             console.log('Valor de "datasEvento" após parse (POST):', datasEventoParsed);

//             // --- INSERÇÃO NA TABELA STAFF ---
//             const staffInsertQuery = `
//                 INSERT INTO staff (
//                     idfuncionario, avaliacao
//                 ) VALUES ($1, $2)
//                 RETURNING idstaff;
//             `;

//             const staffInsertValues = [ idfuncionario, avaliacao];

//             const resultStaff = await client.query(staffInsertQuery, staffInsertValues);
//             const novoStaff = resultStaff.rows[0];
//             const idNovoStaff = novoStaff.idstaff;

//             // --- INSERÇÃO NA TABELA STAFFEMPRESAS ---
//             await client.query(
//                 "INSERT INTO staffEmpresas (idstaff, idEmpresa) VALUES ($1, $2)",
//                 [idNovoStaff, idempresa]
//             );

//             // --- INSERÇÃO NA TABELA STAFFEVENTOS (SE HOUVER DADOS) ---
//             console.log("VAI SALVAR STAFFEVENTOS", idfuncionario, idNovoStaff);
//             if (idfuncionario && idNovoStaff) {
//                 const eventoInsertQuery = `
//                     INSERT INTO staffeventos (
//                         idstaff, idfuncionario, nmfuncionario, idevento, nmevento, idcliente, nmcliente,
//                         idfuncao, nmfuncao, idmontagem, nmlocalmontagem, pavilhao,
//                         vlrcache, vlralmoco, vlrjantar, vlrtransporte, vlrextra,
//                         vlrcaixinha, descbonus, datasevento, vlrtotal, comppgtocache, comppgtoajdcusto, comppgtoextras, descbeneficios, setor
//                     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
//                     RETURNING idstaffevento;
//                 `;
//                 // const eventoInsertValues = [
//                 //     idNovoStaff, idfuncionario, nmfuncionario, idevento, nmevento, idcliente, nmcliente,
//                 //     idfuncao, nmfuncao, idmontagem, nmlocalmontagem, pavilhao,
//                 //     vlrcache, vlralmoco, vlrjantar, vlrtransporte, vlrextra,
//                 //     vlrcaixinha, descbonus, comppgtocache, comppgtoajdcusto, comppgtoextras
//                 const eventoInsertValues = [
//                     idNovoStaff, idfuncionario, nmfuncionario, idevento, nmevento, idcliente, nmcliente,
//                     idfuncao, nmfuncao, idmontagem, nmlocalmontagem, pavilhao,
//                     parseFloat(String(vlrcache).replace(',', '.')),
//                     parseFloat(String(vlralmoco).replace(',', '.')),
//                     parseFloat(String(vlrjantar).replace(',', '.')),
//                     parseFloat(String(vlrtransporte).replace(',', '.')),
//                     parseFloat(String(vlrextra).replace(',', '.')),
//                     parseFloat(String(vlrcaixinha).replace(',', '.')),
//                     descbonus,
//                     JSON.stringify(datasEventoParsed),
//                     parseFloat(String(vlrtotal).replace(',', '.')), 
//                     // 🎉 CAMINHOS DOS ARQUIVOS SALVOS PELO MULTER 🎉
//                     comprovanteCacheFile ? `/uploads/staff_comprovantes/${comprovanteCacheFile.filename}` : null,
//                     comprovanteAjdCustoFile ? `/uploads/staff_comprovantes/${comprovanteAjdCustoFile.filename}` : null,
//                     comprovanteExtrasFile ? `/uploads/staff_comprovantes/${comprovanteExtrasFile.filename}` : null,
//                     descbeneficios,
//                     setor

//                 ];
//                 await client.query(eventoInsertQuery, eventoInsertValues);
//             } else {
//                 console.log("Nenhum dado de evento suficiente fornecido para inserção em staffeventos.");
//             }

//             await client.query('COMMIT'); // Confirma a transação

//             res.locals.acao = 'cadastrou';
//             res.locals.idregistroalterado = idNovoStaff;
//             res.locals.idusuarioAlvo = null;

//             res.status(201).json({
//                 message: "Staff e evento(s) salvos e associados à empresa com sucesso!",
//                 id: idNovoStaff,
//                 datasEvento: novoStaff.datasEvento
//             });
//         } catch (error) {
//             if (client) {
//                 await client.query('ROLLBACK');
//             }
//             console.error("❌ Erro ao salvar staff e/ou associá-lo à empresa:", error);
            
//             // if (comprovanteCacheFile) deletarArquivoAntigo(comprovanteCacheFile.path);
//             // if (comprovanteAjdCustoFile) deletarArquivoAntigo(comprovanteAjdCustoFile.path);
//             // if (comprovanteExtrasFile) deletarArquivoAntigo(comprovanteExtrasFile.path);
           
//             if (error.code === '23502') {
//                  return res.status(400).json({ message: `Campo obrigatório faltando ou inválido: ${error.column}. Por favor, verifique os dados e tente novamente.`, details: error.message });
//             }
//             res.status(500).json({ error: "Erro ao salvar funcionário", details: error.message });
//         } finally {
//             if (client) {
//                 client.release();
//             }
//             console.log('--- Fim da requisição POST ---');
//         }
//     }
// );


// router.post(
//   "/",
//   autenticarToken(),
//   contextoEmpresa,
//   verificarPermissao('staff', 'cadastrar'),
//   uploadComprovantesMiddleware,
//   logMiddleware('staff', {
//     buscarDadosAnteriores: async (req) => {
//       console.log("BUSCA DADOS ANTERIORES STAFF");
//       return { dadosanteriores: null, idregistroalterado: null };
//     }
//   }),
//   async (req, res) => {
//     console.log("🔥 Rota /staff/POST acessada");
//     const {
//       idfuncionario,
//       avaliacao,
//       idevento, nmevento, idcliente, nmcliente,
//       idfuncao, nmfuncao, idmontagem, nmlocalmontagem, pavilhao,
//       vlrcache, vlralmoco, vlrjantar, vlrtransporte, vlrextra,
//       vlrcaixinha, nmfuncionario, datasevento: datasEventoRaw,
//       descbonus, descbeneficios, vlrtotal, setor, statuspgto
//     } = req.body;

//     const files = req.files;
//     const comprovanteCacheFile = files?.comppgtocache ? files.comppgtoacache[0] : null; // corrigir nome da prop aqui
//     const comprovanteAjdCustoFile = files?.comppgtoajdcusto ? files.comppgtoajdcusto[0] : null;
//     const comprovanteExtrasFile = files?.comppgtoextras ? files.comppgtoextras[0] : null;

//     const idempresa = req.idempresa;
//     let client;

//     console.log('--- Início da requisição POST ---');
//     console.log('req.body:', req.body);
//     console.log('req.file (Multer upload):', req.file);
//     console.log('ID da empresa (req.idempresa):', idempresa);

//     if (
//       !idfuncionario || !nmfuncionario || !avaliacao ||
//       !idevento || !nmevento || !idcliente || !nmcliente ||
//       !idfuncao || !nmfuncao || !idmontagem || !nmlocalmontagem ||
//       !vlrcache
//     ) {
//       return res.status(400).json({
//         message: "Dados obrigatórios ausentes. Verifique os campos preenchidos e tente novamente."
//       });
//     }

//     try {
//       client = await pool.connect();
//       await client.query('BEGIN');

//       // --- PASSO 1: VERIFICAÇÃO DE DUPLICIDADE DE idfuncionario PARA A EMPRESA ---
//       const checkDuplicateQuery = `
//         SELECT s.idstaff
//         FROM staff s
//         JOIN staffempresas se ON s.idstaff = se.idstaff
//         WHERE s.idfuncionario = $1 AND se.idempresa = $2;
//       `;
//       const duplicateResult = await client.query(checkDuplicateQuery, [idfuncionario, idempresa]);

//       if (duplicateResult.rows.length > 0) {
//         await client.query('ROLLBACK');
//         console.warn(`Tentativa de cadastrar idfuncionario '${idfuncionario}' duplicado para empresa '${idempresa}'.`);
//         return res.status(409).json({ // 409 Conflict é o status ideal para duplicidade
//           message: "Este ID de funcionário já está cadastrado para sua empresa.",
//           details: `O ID de funcionário '${idfuncionario}' já existe.`
//         });
//       }

//       // Parsear o datasEvento
//       let datasEventoParsed = null;
//       if (datasEventoRaw) {
//         try {
//           datasEventoParsed = JSON.parse(datasEventoRaw);
//           if (!Array.isArray(datasEventoParsed)) {
//             throw new Error("datasevento não é um array válido.");
//           }
//         } catch (parseError) {
//           // Se o JSON.parse falhar, é um erro do cliente, retorna 400
//           await client.query('ROLLBACK'); // Reverte qualquer coisa que tenha começado
//           return res.status(400).json({
//             message: "Formato de 'datasevento' inválido. Esperado um array JSON.",
//             details: parseError.message
//           });
//         }
//       }
//       console.log('Valor de "datasEvento" após parse (POST):', datasEventoParsed);


//       // --- PASSO 2: INSERÇÃO NA TABELA STAFF ---
//       const staffInsertQuery = `
//         INSERT INTO staff (
//           idfuncionario, avaliacao
//         ) VALUES ($1, $2)
//         RETURNING idstaff;
//       `;
//       const staffInsertValues = [idfuncionario, avaliacao];

//       const resultStaff = await client.query(staffInsertQuery, staffInsertValues);
//       const novoStaff = resultStaff.rows[0];
//       const idNovoStaff = novoStaff.idstaff;

//       // --- PASSO 3: INSERÇÃO NA TABELA STAFFEMPRESAS ---
//       await client.query(
//         "INSERT INTO staffEmpresas (idstaff, idEmpresa) VALUES ($1, $2)",
//         [idNovoStaff, idempresa]
//       );

//       // --- PASSO 4: INSERÇÃO NA TABELA STAFFEVENTOS (SE HOUVER DADOS) ---
//       console.log("VAI SALVAR STAFFEVENTOS", idfuncionario, idNovoStaff);
//       if (idfuncionario && idNovoStaff) { // Condição já existente
//         const eventoInsertQuery = `
//           INSERT INTO staffeventos (
//             idstaff, idfuncionario, nmfuncionario, idevento, nmevento, idcliente, nmcliente,
//             idfuncao, nmfuncao, idmontagem, nmlocalmontagem, pavilhao,
//             vlrcache, vlralmoco, vlrjantar, vlrtransporte, vlrextra,
//             vlrcaixinha, descbonus, datasevento, vlrtotal, comppgtocache, comppgtoajdcusto, comppgtoextras, descbeneficios, setor, statuspgto,
//           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)
//           RETURNING idstaffevento;
//         `;
//         const eventoInsertValues = [
//           idNovoStaff, idfuncionario, nmfuncionario, idevento, nmevento, idcliente, nmcliente,
//           idfuncao, nmfuncao, idmontagem, nmlocalmontagem, pavilhao,
//           parseFloat(String(vlrcache).replace(',', '.')),
//           parseFloat(String(vlralmoco).replace(',', '.')),
//           parseFloat(String(vlrjantar).replace(',', '.')),
//           parseFloat(String(vlrtransporte).replace(',', '.')),
//           parseFloat(String(vlrextra).replace(',', '.')),
//           parseFloat(String(vlrcaixinha).replace(',', '.')),
//           descbonus,
//           JSON.stringify(datasEventoParsed), // datasEventoParsed já é um array, transforma em JSON string
//           parseFloat(String(vlrtotal).replace(',', '.')),
//           comprovanteCacheFile ? `/uploads/staff_comprovantes/${comprovanteCacheFile.filename}` : null,
//           comprovanteAjdCustoFile ? `/uploads/staff_comprovantes/${comprovanteAjdCustoFile.filename}` : null,
//           comprovanteExtrasFile ? `/uploads/staff_comprovantes/${comprovanteExtrasFile.filename}` : null,
//           descbeneficios,
//           setor,
//           statuspgto
//         ];
//         await client.query(eventoInsertQuery, eventoInsertValues);
//       } else {
//         console.log("Nenhum dado de evento suficiente fornecido para inserção em staffeventos.");
//       }

//       await client.query('COMMIT'); // Confirma a transação

//       res.locals.acao = 'cadastrou';
//       res.locals.idregistroalterado = idNovoStaff;
//       res.locals.idusuarioAlvo = null;

//       res.status(201).json({
//         message: "Staff e evento(s) salvos e associados à empresa com sucesso!",
//         id: idNovoStaff,
//         datasEvento: novoStaff.datasEvento // Este campo 'datasEvento' não foi retornado da inserção de staff, verifique se deveria vir de staffeventos
//       });
//     } catch (error) {
//       if (client) {
//         await client.query('ROLLBACK');
//       }
//       console.error("❌ Erro ao salvar staff e/ou associá-lo à empresa:", error);

//       // Você pode querer re-habilitar a deleção de arquivos em caso de erro,
//       // mas garanta que a função deletarArquivoAntigo esteja definida.
//       // if (comprovanteCacheFile) deletarArquivoAntigo(comprovanteCacheFile.path);
//       // if (comprovanteAjdCustoFile) deletarArquivoAntigo(comprovanteAjdCustoFile.path);
//       // if (comprovanteExtrasFile) deletarArquivoAntigo(comprovanteExtrasFile.path);

//       if (error.code === '23502') {
//         return res.status(400).json({ message: `Campo obrigatório faltando ou inválido: ${error.column}. Por favor, verifique os dados e tente novamente.`, details: error.message });
//       }
//       // Se for um erro de chave única (mas você já tratou isso acima com a checagem manual)
//       if (error.code === '23505') { // PostgreSQL unique violation error code
//         if (error.constraint === 'nome_da_constraint_de_unicidade_no_staff') { // Substitua pelo nome real da sua constraint
//           return res.status(409).json({ message: "Duplicidade de dados. Este funcionário já existe.", details: error.message });
//         }
//       }
//       res.status(500).json({ error: "Erro ao salvar funcionário", details: error.message });
//     } finally {
//       if (client) {
//         client.release();
//       }
//       console.log('--- Fim da requisição POST ---');
//     }
//   }
// );

router.post(
  "/",
  autenticarToken(),
  contextoEmpresa,
  verificarPermissao('staff', 'cadastrar'),
  uploadComprovantesMiddleware,
  logMiddleware('staff', {
    buscarDadosAnteriores: async (req) => {
      console.log("BUSCA DADOS ANTERIORES STAFF");
      return { dadosanteriores: null, idregistroalterado: null };
    }
  }),
  async (req, res) => {
    console.log("🔥 Rota /staff/POST acessada");
    const {
      idfuncionario,
      avaliacao,
      idevento, nmevento, idcliente, nmcliente,
      idfuncao, nmfuncao, idmontagem, nmlocalmontagem, pavilhao,
      vlrcache, vlralmoco, vlrjantar, vlrtransporte, vlrextra,
      vlrcaixinha, nmfuncionario, datasevento: datasEventoRaw,
      descbonus, descbeneficios, vlrtotal, setor, statuspgto
    } = req.body;

    const files = req.files;
    const comprovanteCacheFile = files?.comppgtocache ? files.comppgtocache[0] : null;
    const comprovanteAjdCustoFile = files?.comppgtoajdcusto ? files.comppgtoajdcusto[0] : null;
    const comprovanteExtrasFile = files?.comppgtoextras ? files.comppgtoextras[0] : null;

    const idempresa = req.idempresa;
    let client;
    let idstaffExistente = null; // Variável para armazenar o ID do staff se ele já existir

    console.log('--- Início da requisição POST ---');

    if (
      !idfuncionario || !nmfuncionario ||
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
      await client.query('BEGIN');

      // --- PASSO 1: VERIFICAÇÃO SE O FUNCIONÁRIO JÁ EXISTE NA TABELA STAFF ---
      const checkStaffQuery = `
        SELECT s.idstaff
        FROM staff s
        JOIN staffempresas se ON s.idstaff = se.idstaff
        WHERE s.idfuncionario = $1 AND se.idempresa = $2;
      `;
      const staffResult = await client.query(checkStaffQuery, [idfuncionario, idempresa]);

      if (staffResult.rows.length > 0) {
        // Funcionário já existe, apenas pegamos o idstaff para usar depois
        idstaffExistente = staffResult.rows[0].idstaff;
        console.log(`idfuncionario ${idfuncionario} já existe. Usando idstaff existente: ${idstaffExistente}`);

        // AQUI VOCÊ PODE ADICIONAR LÓGICA PARA ATUALIZAR 'avaliacao' se for o caso
        if (avaliacao) {
          const updateAvaliacaoQuery = `
            UPDATE staff SET avaliacao = $1 WHERE idstaff = $2
          `;
          await client.query(updateAvaliacaoQuery, [avaliacao, idstaffExistente]);
          console.log(`Avaliação do staff ${idstaffExistente} atualizada.`);
        }
        
      } else {
        // Funcionário NÃO existe, então criamos um novo registro em 'staff' e 'staffEmpresas'
        console.log(`idfuncionario ${idfuncionario} não encontrado. Criando novo staff.`);
        
        const staffInsertQuery = `
          INSERT INTO staff (idfuncionario, avaliacao)
          VALUES ($1, $2)
          RETURNING idstaff;
        `;
        const resultStaff = await client.query(staffInsertQuery, [idfuncionario, avaliacao]);
        idstaffExistente = resultStaff.rows[0].idstaff;

        await client.query(
          "INSERT INTO staffEmpresas (idstaff, idEmpresa) VALUES ($1, $2)",
          [idstaffExistente, idempresa]
        );
        console.log(`Novo staff ${idstaffExistente} criado e associado à empresa ${idempresa}.`);
      }

      // --- PASSO 2: INSERÇÃO NA TABELA STAFFEVENTOS ---
      // Esta parte agora usa o idstaffExistente, que será o novo ID ou o ID pré-existente
      if (idstaffExistente) {
        const eventoInsertQuery = `
          INSERT INTO staffeventos (
            idstaff, idfuncionario, nmfuncionario, idevento, nmevento, idcliente, nmcliente,
            idfuncao, nmfuncao, idmontagem, nmlocalmontagem, pavilhao,
            vlrcache, vlralmoco, vlrjantar, vlrtransporte, vlrextra,
            vlrcaixinha, descbonus, datasevento, vlrtotal, comppgtocache, comppgtoajdcusto, comppgtoextras, descbeneficios, setor, statuspgto
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)
          RETURNING idstaffevento;
        `;
        const eventoInsertValues = [
          idstaffExistente, idfuncionario, nmfuncionario, idevento, nmevento, idcliente, nmcliente,
          idfuncao, nmfuncao, idmontagem, nmlocalmontagem, pavilhao,
          parseFloat(String(vlrcache).replace(',', '.')),
          parseFloat(String(vlralmoco).replace(',', '.')),
          parseFloat(String(vlrjantar).replace(',', '.')),
          parseFloat(String(vlrtransporte).replace(',', '.')),
          parseFloat(String(vlrextra).replace(',', '.')),
          parseFloat(String(vlrcaixinha).replace(',', '.')),
          descbonus,
          // Garanta que `datasEventoRaw` seja parseado corretamente aqui
          datasEventoRaw ? JSON.stringify(JSON.parse(datasEventoRaw)) : null,
          parseFloat(String(vlrtotal).replace(',', '.')),
          comprovanteCacheFile ? `/uploads/staff_comprovantes/${comprovanteCacheFile.filename}` : null,
          comprovanteAjdCustoFile ? `/uploads/staff_comprovantes/${comprovanteAjdCustoFile.filename}` : null,
          comprovanteExtrasFile ? `/uploads/staff_comprovantes/${comprovanteExtrasFile.filename}` : null,
          descbeneficios,
          setor,
          statuspgto
        ];

        await client.query(eventoInsertQuery, eventoInsertValues);
        console.log(`Novo evento para o staff ${idstaffExistente} inserido em staffeventos.`);
      } else {
        throw new Error("Falha lógica: idstaff não foi determinado para a inserção do evento.");
      }

      await client.query('COMMIT');

      res.locals.acao = 'cadastrou';
      res.locals.idregistroalterado = idstaffExistente;
      res.locals.idusuarioAlvo = null;

      res.status(201).json({
        message: "Evento(s) salvo(s) e associado(s) ao staff com sucesso!",
        id: idstaffExistente,
      });

    } catch (error) {
      if (client) {
        await client.query('ROLLBACK');
      }
      console.error("❌ Erro ao salvar staff ou evento:", error);

      // Lembre-se de corrigir a propriedade do arquivo de cache aqui
      // const comprovanteCacheFile = files?.comppgtocache ? files.comppgtoacache[0] : null; -> files.comppgtocache[0]
      if (files?.comppgtocache?.[0]) deletarArquivoAntigo(files.comppgtocache[0].path);
      if (files?.comppgtoajdcusto?.[0]) deletarArquivoAntigo(files.comppgtoajdcusto[0].path);
      if (files?.comppgtoextras?.[0]) deletarArquivoAntigo(files.comppgtoextras[0].path);
      
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