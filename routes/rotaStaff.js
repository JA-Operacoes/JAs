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
const { title } = require("process");
const { text } = require("stream/consumers");

const parseFloatOrNull = (v) => {
    if (v === undefined || v === null || v === '' || v === 'NaN' || v === 'null') return 0;
    // Se for string, remove vírgula. Se for número, mantém.
    const n = parseFloat(String(v).replace(',', '.'));
    return Number.isNaN(n) ? 0 : n;
};

const comprovantesUploadDir = path.join(__dirname, '../uploads/staff_comprovantes');
if (!fs.existsSync(comprovantesUploadDir)) {
    fs.mkdirSync(comprovantesUploadDir, { recursive: true });
}

// const storageComprovantes = multer.diskStorage({
//     destination: (req, file, cb) => {
//     cb(null, comprovantesUploadDir); // Multer salva aqui
//     },
//     filename: (req, file, cb) => {
//     const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
//     cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
//     }
// });

const storageComprovantes = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, comprovantesUploadDir); // Mantém o diretório definido para staff
    },
    filename: (req, file, cb) => {
        // 1. Captura o ID (Priorizando idStaffEvento que é o padrão para staff)
        console.log("REQ.BODY NO FILENAME:", req.body);
        const id = req.body.idstaffevento ||  req.body.id || '0';

        // 2. Define o contexto baseado no fieldname (ex: comppgtocache, comppgtoajdcusto)
        // Se houver um contexto personalizado (Aditivo, etc), ele prioriza
        const contexto = req.body.contexto || file.fieldname;

        // 3. Limpa o nome original do arquivo
        const nomeOriginalLimpo = path.parse(file.originalname).name
            .replace(/\s+/g, '') 
            .replace(/[^a-zA-Z0-9]/g, '');

        // 4. Data legível (AAAAMMDD) - Hoje é 20260303
        const dataHoje = new Date().toISOString().split('T')[0].replace(/-/g, ''); 

        const ext = path.extname(file.originalname).toLowerCase();
        
        // RESULTADO: comppgtocache-ID73-20260303-ReciboJoao.pdf
        const nomeFinal = `${contexto}-ID${id}-${dataHoje}-${nomeOriginalLimpo}${ext}`;
        
        cb(null, nomeFinal);
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
    { name: 'comppgtocaixinha', maxCount: 1 },
    { name: 'comppgtoajdcusto50', maxCount: 1 }
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


router.get('/equipe', async (req, res) => {
  
 console.log("🔥 Rota /staff/equipe acessada");
  const idempresa = req.idempresa;
  const idequipe = req.query.idequipe;

  try {
     
    const resultado = await pool.query(`
  SELECT e.*
  FROM equipe e
  INNER JOIN equipeempresas ee ON ee.idequipe = e.idequipe
  WHERE ee.idempresa = $1 AND e.idequipe = $2
  ORDER BY e.nmequipe
    `, [idempresa, idequipe]);

    res.json(resultado.rows);

  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao buscar clientes' });
  }

});

router.get('/funcao', async (req, res) => {
  
 console.log("🔥 Rota /staff/funcao acessada");

  const idempresa = req.idempresa;

  try {
     
    const resultado = await pool.query(`
      SELECT f.idcategoriafuncao, f.idfuncao, f.descfuncao, f.ativo, f.vdafuncao, f.obsproposta, f.obsfuncao,
          e.idequipe, e.nmequipe, cf.nmcategoriafuncao,
          cf.ctofuncaobase, cf.ctofuncaojunior, cf.ctofuncaopleno, cf.ctofuncaosenior, cf.transporte, cf.transpsenior, cf.alimentacao, cf.vlrfuncionario, cf.ctofuncaosenior2
      FROM funcao f
      INNER JOIN categoriafuncao cf ON f.idcategoriafuncao = cf.idcategoriafuncao
      INNER JOIN equipe e ON f.idequipe = e.idequipe
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
      WHERE funce.idempresa = $1 AND ativo = 'true' ORDER BY func.nome ASC`,
      [idempresa]
      );
      return result.rows.length
      ? res.json(result.rows)
      : res.status(404).json({ message: "Nenhum funcionário encontrado para esta empresa na RotaStaff." });
    
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
  const idorcamento = req.query.idorcamento;
  const idfuncao = req.query.idfuncao;

  console.log("IDMONTAGEM", idmontagem, "IDORCAMENTO", idorcamento, "IDFUNCAO", idfuncao);

  try {
    let query;
    let params;

    if (idorcamento && idfuncao) {
      // Verificar se há pavilhões no orcamentoitens para esta função
      const checkPavilhao = await pool.query(`
        SELECT DISTINCT oi.setor
        FROM orcamentoitens oi
        WHERE oi.idorcamento = $1 AND oi.idfuncao = $2 AND oi.setor IS NOT NULL AND oi.setor != ''
      `, [idorcamento, idfuncao]);

      if (checkPavilhao.rows.length > 0) {
        // Há pavilhões no orçamento, retornar apenas esses
        query = `
          SELECT DISTINCT oi.setor as nmpavilhao
          FROM orcamentoitens oi
          WHERE oi.idorcamento = $1 AND oi.idfuncao = $2 AND oi.setor IS NOT NULL AND oi.setor != ''
          ORDER BY oi.setor
        `;
        params = [idorcamento, idfuncao];
      } else {
        // Não há pavilhões no orçamento, retornar todos do local de montagem
        query = `
          SELECT p.nmpavilhao
          FROM localmontpavilhao p
          WHERE p.idmontagem = $1
          ORDER BY p.nmpavilhao
        `;
        params = [idmontagem];
      }
    } else {
      // Sem idorcamento e idfuncao, retornar todos do local de montagem
      query = `
        SELECT p.nmpavilhao
        FROM localmontpavilhao p
        WHERE p.idmontagem = $1
        ORDER BY p.nmpavilhao
      `;
      params = [idmontagem];
    }

    const resultado = await pool.query(query, params);

    console.log("PAVILHAO", resultado);
    res.json(resultado.rows);

  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao buscar pavilhões' });
  }

});


router.post("/orcamento/consultar",
  async (req, res) => {
  console.log("Dados recebidos no backend:", req.body);
  const client = await pool.connect();
  try {
        const {
            idEvento,
            idCliente,
            idLocalMontagem,
            idFuncao,
            setor,
            datasEvento = [],
        } = req.body;

        const idempresa = req.idempresa;

        console.log("ORCAMENTO/CONSULTAR", req.body);

          if (!idEvento || !idLocalMontagem || !idFuncao) {
        return res.status(400).json({ 
            error: "Evento, Local e Função são obrigatórios." 
        });
    }

        if (!Array.isArray(datasEvento) || datasEvento.length === 0) {
            return res.status(400).json({ error: "O array de datas é obrigatório para a pesquisa." });
        }

        const query = `
            WITH datas_orcamento AS (
                -- CTE: Gera o array de datas específico para CADA item individualmente
                SELECT
                    oi.idorcamentoitem,
                    ARRAY(
                        SELECT * FROM gerar_periodo_diarias(oi.periododiariasinicio, oi.periododiariasfim)
                    ) AS periodos_disponiveis
                FROM orcamentoitens oi
                WHERE oi.idorcamentoitem IS NOT NULL
            )
            SELECT
                o.status, o.idorcamento, o.contratarstaff,
                -- CORREÇÃO AQUI:
                -- Em vez de recalcular todas as datas do evento inteiro,
                -- pegamos apenas as datas deste item específico que já calculamos na CTE.
                dto.periodos_disponiveis AS datas_totais_orcadas,
                
                oi.qtditens AS quantidade_orcada, 
                oi.idfuncao,         
                f.descfuncao,
                e.nmevento,
                c.nmfantasia AS nmcliente,
                lm.descmontagem AS nmlocalmontagem,
                oi.setor AS setor,
                (
                    SELECT COUNT(DISTINCT se.idfuncionario)
                    FROM staffeventos se
                    WHERE
                        se.idevento = o.idevento
                        AND se.idcliente = o.idcliente
                        AND se.idmontagem = o.idmontagem
                        AND se.idfuncao = oi.idfuncao
                        -- Verifica staff escalado apenas nas datas que foram filtradas na busca ($5)
                        AND se.datasevento @> to_jsonb($5::text[])
                ) AS quantidade_escalada
            FROM
                orcamentoitens oi
            JOIN
                orcamentos o ON oi.idorcamento = o.idorcamento
            JOIN
                orcamentoempresas oe ON o.idorcamento = oe.idorcamento
            LEFT JOIN
                funcao f ON oi.idfuncao = f.idfuncao
            LEFT JOIN
                eventos e ON o.idevento = e.idevento
            LEFT JOIN
                clientes c ON o.idcliente = c.idcliente
            LEFT JOIN
                localmontagem lm ON o.idmontagem = lm.idmontagem
            JOIN
                datas_orcamento dto ON oi.idorcamentoitem = dto.idorcamentoitem
            WHERE
                oe.idempresa = $1
                AND o.idevento = $2
                AND o.idcliente = $3
                AND o.idmontagem = $4
                --AND oi.idfuncao IS NOT NULL
                AND oi.idfuncao = $6
                AND (oi.setor = $7 OR $7 IS NULL)
                -- Filtra para trazer apenas itens que tenham choque de data com o que foi pesquisado
                AND dto.periodos_disponiveis && $5::date[]
            GROUP BY
                oi.idorcamentoitem, 
                f.descfuncao, 
                e.nmevento, 
                c.nmfantasia, 
                lm.descmontagem, 
                oi.setor, 
                o.idevento, 
                o.idcliente, 
                o.idmontagem, 
                oi.idfuncao, 
                o.status, 
                o.idorcamento,
                oi.qtditens,
                o.contratarstaff,
                dto.periodos_disponiveis -- Necessário no Group By pois agora é coluna direta
            ORDER BY
                oi.idorcamentoitem;
        `;

        console.log("QUERY", query);
        const values = [
            idempresa,
            idEvento,
            idCliente,
            idLocalMontagem,
            datasEvento,
            idFuncao,
            setor || null
        ];

        const result = await client.query(query, values);
        const orcamentoItems = result.rows;

        res.locals.acao = 'cadastrou';
        res.locals.idregistroalterado = orcamentoItems.length > 0 ? orcamentoItems[0].idorcamento : null; 

        res.status(200).json(orcamentoItems);
       } catch (error) {
        console.error("Erro ao buscar itens de orçamento por critérios:", error);
        res.status(500).json({
            error: "Erro ao buscar orçamento por critérios.",
            detail: error.message,
        });
       } finally {
        client.release();
      }
    }
);


router.get('/check-duplicate', autenticarToken(), contextoEmpresa, async (req, res) => {
    console.log("🔥 Rota /staff/check-duplicate acessada");
    let client;
    try {
        // 🛑 REMOVEMOS 'setor' E 'nmFuncionario' da desestruturação para focar no que é relevante para o WHERE.
        // setor é ignorado por regra de negócio. nmFuncionario é apenas para log/mensagem.
        const { idFuncionario, nmlocalmontagem, nmevento, nmcliente, datasevento, idFuncao } = req.query; 

        if (!idFuncionario || !nmlocalmontagem || !nmevento || !nmcliente || !datasevento || !idFuncao) {
            return res.status(400).json({ message: 'Campos obrigatórios (Funcionário, Local, Evento, Cliente, Datas, Função) não foram fornecidos para verificar duplicidade.' });
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


        client = await pool.connect(); 

        let query = `
            SELECT se.idstaffevento, se.vlrcache, se.vlrajustecusto, se.vlrtransporte, se.vlralimentacao, se.vlrcaixinha,
                se.descajustecusto, se.descbeneficios, se.setor, se.pavilhao, se.vlrtotal, se.comppgtocache, se.comppgtoajdcusto, se.comppgtocaixinha,
                se.idfuncionario, se.idfuncao, se.nmfuncao, se.idcliente, se.idevento, se.idmontagem, se.datasevento,
                se.nmfuncionario, se.nmcliente, se.nmevento, se.nmlocalmontagem,
                s.idstaff, s.avaliacao, se.comppgtoajdcusto50
            FROM staffeventos se
            INNER JOIN staff s ON se.idstaff = s.idstaff
            WHERE se.idfuncionario = $1
        `;

        const queryValues = [idFuncionario];
        let paramIndex = 2; // Começa em $2, já que $1 é idFuncionario
        
        // 🟢 Setor foi IGNORADO, como solicitado.
        
        // CRITERIA 1: nmlocalmontagem ($2)
        query += ` AND UPPER(se.nmlocalmontagem) = UPPER($${paramIndex})`;
        queryValues.push(nmlocalmontagem);
        paramIndex++; // Agora é $3

        // CRITERIA 2: nmevento ($3)
        query += ` AND UPPER(se.nmevento) = UPPER($${paramIndex})`;
        queryValues.push(nmevento);
        paramIndex++; // Agora é $4

        // CRITERIA 3: nmcliente ($4)
        query += ` AND UPPER(se.nmcliente) = UPPER($${paramIndex})`;
        queryValues.push(nmcliente);
        paramIndex++; // Agora é $5

        // CRITERIA 4: datasevento ($5)
        query += ` AND se.datasevento::jsonb = $${paramIndex}::jsonb`;
        queryValues.push(JSON.stringify(datasEventoArray));
        
        // 🎯 O índice para idFuncao será o próximo: $6
        const idFuncaoParamIndex = paramIndex + 1; 

        // ORDER BY: Prioriza o conflito de mesma função (duplicidade estrita)
        query += `
            ORDER BY
                CASE WHEN se.idfuncao = $${idFuncaoParamIndex} THEN 0 ELSE 1 END, 
                se.idstaffevento ASC;`; 

        // 🟢 Adiciona idFuncao como o último parâmetro (que será referenciado como $6)
        queryValues.push(idFuncao); 

        // Log para depuração
        //console.log("QUERY DINÂMICA:", query);
        //console.log("VALUES DA QUERY:", queryValues);

        const result = await client.query(query, queryValues);

        if (result.rows.length > 0) {
            // O primeiro resultado será o registro 1974 (ou 1969) com a mesma função 48, 
            // garantindo que o frontend entre no bloco de Duplicidade Estrita.
            return res.status(200).json({ isDuplicate: true, existingEvent: result.rows[0] });
        } else {
            return res.status(200).json({ isDuplicate: false, message: 'Nenhum evento duplicado encontrado.' });
        }

    } catch (error) {
        console.error('Erro ao verificar duplicidade de evento:', error);
        res.status(500).json({ message: 'Erro interno ao verificar duplicidade.', error: error.message });
    } finally {
        if (client) {
            client.release();
        }
    }
});


router.post('/check-availability', autenticarToken(), contextoEmpresa, async (req, res) => {
    console.log("🔥 Rota /staff/check-availability (POST) acessada para verificação de disponibilidade");

    // idfuncao é mantido para validação de requisição (400), mesmo que não seja usado na query SQL atual.
    const { idfuncionario, datas, idEventoIgnorar, idfuncao } = req.body;
    const idEmpresa = req.idempresa;

    // Validação de dados obrigatórios
    if (!idfuncionario || !datas || !Array.isArray(datas) || datas.length === 0 || !idEmpresa || !idfuncao) {
        return res.status(400).json({ message: "Dados obrigatórios ausentes ou em formato incorreto para verificar disponibilidade." });
    }

    let client;
    try {
        client = await pool.connect();

        // Parâmetros iniciais: $1 e $2
        let params = [idfuncionario, idEmpresa];

        // 1. Placeholder das datas (começa em $3)
        const dateStartParamIndex = params.length + 1; 
        const datePlaceholders = datas.map((_, i) => `$${dateStartParamIndex + i}`).join(', ');
        params = params.concat(datas); // Adiciona as datas a params (ex: $3, $4, ...)

        // 💡 TRECHO REMOVIDO: A lógica para FUNCOES_FISCAL_IDS e idfuncao foi removida dos parâmetros
        // porque os placeholders não estavam sendo usados na query SQL.

        // 2. Placeholder para idEventoIgnorar (se existir)
        const idEventoIgnorarParamIndex = params.length + 1; // Próximo índice livre após as datas
        
        let query = `
            SELECT 
                se.nmevento, 
                se.nmcliente, 
                se.datasevento, 
                se.idevento,
                se.idstaffevento,
                se.idfuncao,
                se.nmfuncao 
            FROM 
                staffeventos se
            INNER JOIN 
                staff s ON se.idstaff = s.idstaff
            INNER JOIN 
                staffEmpresas se_emp ON s.idstaff = se_emp.idstaff 
            
            WHERE 
                se.idfuncionario = $1
                AND se_emp.idEmpresa = $2
                AND EXISTS (
                    SELECT 1
                    FROM jsonb_array_elements_text(se.datasevento) AS existing_date
                    WHERE existing_date.value = ANY(ARRAY[${datePlaceholders}]::text[])
                )
        `;
        
        // Condição para ignorar o evento que está sendo editado
        if (idEventoIgnorar !== null) {
            query += ` AND se.idstaffevento != $${idEventoIgnorarParamIndex}`; 
            params.push(idEventoIgnorar); // Adiciona idEventoIgnorar a params
        }

        console.log("Query de disponibilidade (ajustada):", query);
        console.log("Parâmetros de disponibilidade (ajustado):", params);

        const result = await client.query(query, params);

        res.locals.acao = 'cadastrou';
        res.locals.idregistroalterado = result.rows.length > 0 ? result.rows[0].idstaffevento : null; 

        if (result.rows.length > 0) {
            // Se houver conflito, retorna o primeiro encontrado
            return res.json({
                isAvailable: false,
                conflictingEvent: result.rows[0],
                conflicts: result.rows
            });
        } else {
            // Não há conflito de agenda
            return res.json({ isAvailable: true, conflictingEvent: null, conflicts: [] });
        }

        

    } catch (error) {
        console.error("❌ Erro no backend ao verificar disponibilidade:", error);
        // Retorna 500 com mensagem detalhada para debug
        res.status(500).json({ message: "Erro interno do servidor ao verificar disponibilidade.", details: error.message });
    } finally {
        if (client) {
            client.release();
        }
    }
});


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

      // Linha 1219 (aproximadamente, no seu log)
      let query = `SELECT
          se.idstaffevento,
          se.idfuncionario,
          se.nmfuncionario,
          se.idequipe,
          se.nmequipe,
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
          se.vlralimentacao,
          se.vlrtransporte,
          se.vlrajustecusto,
          se.vlrcaixinha,
          se.descajustecusto,
          se.descbeneficios,
          se.vlrtotal,
          se.vlrtotcache,
          se.vlrtotajdcusto,
          se.datasevento,
          se.comppgtocache,
          se.comppgtoajdcusto,
          se.comppgtoajdcusto50,
          se.comppgtocaixinha,
          se.setor,
          se.statuspgto,
          se.statusajustecusto,
          se.statuscaixinha,
          se.dtdiariadobrada,
          se.dtmeiadiaria,
          se.statusdiariadobrada,
          se.statusmeiadiaria,
          se.desccaixinha,
          se.descmeiadiaria,
          se.descdiariadobrada,
          se.nivelexperiencia,
          se.statuspgtoajdcto,
          se.statuspgtocaixinha,
          se.qtdpessoaslote,
          se.tipoajudacustoviagem,
          se.statuspgtocaixinha,
          se.statuspgtoajdcto,
          se.idorcamento,
          s.idstaff,
          s.avaliacao,
          se.statuscustofechado,
          se.desccustofechado,
          (
            SELECT jsonb_agg(elem ORDER BY elem::date)
            FROM jsonb_array_elements_text(
                CASE 
                    WHEN jsonb_typeof(se.datasevento) = 'array' 
                    THEN se.datasevento 
                    ELSE '[]'::jsonb 
                END
            ) elem
          ) AS datasevento_aggr, -- Renomeado para evitar conflito com a coluna original
          (
            SELECT jsonb_agg(elem ORDER BY (elem->>'data')::date)
            FROM jsonb_array_elements(
                CASE 
                    WHEN jsonb_typeof(se.dtdiariadobrada) = 'array' 
                    THEN se.dtdiariadobrada 
                    ELSE '[]'::jsonb 
                END
            ) elem
          ) AS dtdiariadobrada_aggr, -- Renomeado
          (
            SELECT jsonb_agg(elem ORDER BY (elem->>'data')::date)
            FROM jsonb_array_elements(
                CASE 
                    WHEN jsonb_typeof(se.dtmeiadiaria) = 'array' 
                    THEN se.dtmeiadiaria 
                    ELSE '[]'::jsonb 
                END
            ) elem
          ) AS dtmeiadiaria_aggr -- Renomeado
            FROM staffeventos se
            INNER JOIN staff s 
          ON se.idstaff = s.idstaff
            INNER JOIN staffEmpresas se_emp 
          ON s.idstaff = se_emp.idstaff
            WHERE
          se_emp.idEmpresa = $1
          AND se.idfuncionario = $2
            ORDER BY
          GREATEST(
            COALESCE(
                (
                    SELECT MAX(elem::date) 
                    FROM jsonb_array_elements_text(
                        CASE 
                            WHEN jsonb_typeof(se.datasevento) = 'array' 
                            THEN se.datasevento 
                            ELSE '[]'::jsonb 
                        END
                    ) elem
                ), '0001-01-01'
            ),
            COALESCE(
                (
                    SELECT MAX((elem->>'data')::date) 
                    FROM jsonb_array_elements(
                        CASE 
                            WHEN jsonb_typeof(se.dtdiariadobrada) = 'array' 
                            THEN se.dtdiariadobrada 
                            ELSE '[]'::jsonb 
                        END
                    ) elem
                ), '0001-01-01'
            ),
            COALESCE(
                (
                    SELECT MAX((elem->>'data')::date) 
                    FROM jsonb_array_elements(
                        CASE 
                            WHEN jsonb_typeof(se.dtmeiadiaria) = 'array' 
                            THEN se.dtmeiadiaria 
                            ELSE '[]'::jsonb 
                        END
                    ) elem
                ), '0001-01-01'
            )
          ) DESC,
          se.nmcliente ASC,
          se.nmevento ASC          
        `;

      const queryParams = [idempresa, idFuncionarioParam];

      const result = await client.query(query, queryParams);

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

function ordenarDatas(datas) {
    if (!datas || datas.length === 0) {
    return [];
    }
    // Supondo que as datas estejam no formato 'YYYY-MM-DD'
    return datas.sort((a, b) => new Date(a) - new Date(b));
}

router.put("/:idStaffEvento", autenticarToken(), contextoEmpresa, verificarPermissao('staff', 'alterar'), uploadComprovantesMiddleware, 
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
        const { idStaffEvento } = req.params;
        const idempresa = req.idempresa;
        const body = req.body;

        let client;
        try {
            client = await pool.connect();
            await client.query('BEGIN');

            // 1. Buscar dados antigos para gerir ficheiros
            const oldResult = await client.query(`
                SELECT se.* FROM staffeventos se 
                JOIN staffempresas sme ON se.idstaff = sme.idstaff 
                WHERE se.idstaffevento = $1 AND sme.idempresa = $2`, [idStaffEvento, idempresa]);
            
            if (oldResult.rowCount === 0) throw new Error("Evento não encontrado ou sem permissão.");
            const old = oldResult.rows[0];

            const paths = {
                cache: req.files?.comppgtocache ? `/uploads/staff_comprovantes/${req.files.comppgtocache[0].filename}` : (body.limparComprovanteCache === 'true' ? null : old.comppgtocache),
                ajd: req.files?.comppgtoajdcusto ? `/uploads/staff_comprovantes/${req.files.comppgtoajdcusto[0].filename}` : (body.limparComprovanteAjdCusto === 'true' ? null : old.comppgtoajdcusto),
                ajd50: req.files?.comppgtoajdcusto50 ? `/uploads/staff_comprovantes/${req.files.comppgtoajdcusto50[0].filename}` : (body.limparComprovanteAjdCusto50 === 'true' ? null : old.comppgtoajdcusto50),
                cx: req.files?.comppgtocaixinha ? `/uploads/staff_comprovantes/${req.files.comppgtocaixinha[0].filename}` : (body.limparComprovanteCaixinha === 'true' ? null : old.comppgtocaixinha)
            };

            if (req.files?.comppgtocache) deletarArquivoAntigo(old.comppgtocache);
            if (req.files?.comppgtoajdcusto) deletarArquivoAntigo(old.comppgtoajdcusto);

            // 2. Query de Update Corrigida
            const queryUpdate = `
                UPDATE staffeventos se
                SET
                idfuncionario = $1, nmfuncionario = $2, idfuncao = $3, nmfuncao = $4,
                idcliente = $5, nmcliente = $6, idevento = $7, nmevento = $8, idmontagem = $9,
                nmlocalmontagem = $10, pavilhao = $11, vlrcache = $12, vlrajustecusto = $13, vlrtransporte = $14,
                vlralimentacao = $15, vlrcaixinha = $16, descajustecusto = $17, datasevento = $18, 
                vlrtotal = $19, descbeneficios = $20, setor = $21, statuspgto = $22, statusajustecusto = $23,
                statuscaixinha = $24, statusdiariadobrada = $25, statusmeiadiaria = $26, dtdiariadobrada = $27, 
                dtmeiadiaria = $28, desccaixinha = $29, descdiariadobrada = $30, descmeiadiaria = $31,
                comppgtocache = $32, comppgtoajdcusto = $33, comppgtoajdcusto50 = $34, comppgtocaixinha = $35, 
                nivelexperiencia = $36, qtdpessoaslote = $37, idequipe = $38, nmequipe = $39, tipoajudacustoviagem = $40,
                statuspgtoajdcto = $41, statuspgtocaixinha = $42, idorcamento = $43, vlrtotcache = $44, vlrtotajdcusto = $45, statuscustofechado = $46, desccustofechado = $47
                FROM staffempresas sme
                WHERE se.idstaff = sme.idstaff AND se.idstaffevento = $48 AND sme.idempresa = $49
                RETURNING se.idstaffevento;
            `;

            const values = [
                body.idfuncionario, body.nmfuncionario, body.idfuncao, body.nmfuncao,
                body.idcliente, body.nmcliente, body.idevento, body.nmevento, body.idmontagem,
                body.nmlocalmontagem, body.pavilhao,
                parseFloatOrNull(body.vlrcache), parseFloatOrNull(body.vlrajustecusto), parseFloatOrNull(body.vlrtransporte),
                parseFloatOrNull(body.vlralimentacao), parseFloatOrNull(body.vlrcaixinha),
                body.descajustecusto, body.datasevento, parseFloatOrNull(body.vlrtotal),
                body.descbeneficios, body.setor, body.statuspgto, body.statusajustecusto, body.statuscaixinha,
                body.statusdiariadobrada, body.statusmeiadiaria, body.datadiariadobrada, body.datameiadiaria,
                body.desccaixinha, body.descdiariadobrada, body.descmeiadiaria,
                paths.cache, paths.ajd, paths.ajd50, paths.cx,
                body.nivelexperiencia, body.qtdpessoas, body.idequipe, body.nmequipe, body.tipoajudacustoviagem,
                body.statuspgtoajdcto, body.statuspgtocaixinha, body.idorcamento,
                parseFloatOrNull(body.vlrtotcache), parseFloatOrNull(body.vlrtotajdcusto), body.statuscustofechado, body.desccustofechado,
                idStaffEvento, idempresa
            ];

            const resUp = await client.query(queryUpdate, values);
            await client.query('COMMIT');

            const dadosParaLog = { 
                ...body, 
                comppgtocache: paths.cache,
                comppgtoajdcusto: paths.ajd,
                comppgtoajdcusto50: paths.ajd50,
                comppgtocaixinha: paths.cx
            };

            res.locals.acao = 'alterou';
            res.locals.idregistroalterado = idStaffEvento;
            res.locals.dadosnovos = dadosParaLog;

            res.json({ message: "Atualizado", id: resUp.rows[0].idstaffevento });
        } catch (e) {
            if (client) await client.query('ROLLBACK');
            res.status(500).json({ error: e.message });
        } finally { if (client) client.release(); }
    }
);

function ordenarDatas(datas) {
    if (!datas || datas.length === 0) {
    return [];
    }
    // Supondo que as datas estejam no formato 'YYYY-MM-DD'
    return datas.sort((a, b) => new Date(a) - new Date(b));
}


router.post("/", autenticarToken(), contextoEmpresa, verificarPermissao('staff', 'cadastrar'), 
    uploadComprovantesMiddleware, 
    logMiddleware('staffeventos', 
        { buscarDadosAnteriores: async () => ({ dadosanteriores: null, idregistroalterado: null }) 
    }), async (req, res) => {
    
    const {
       idfuncionario, nmfuncionario, idevento, nmevento, idcliente, nmcliente,
    idfuncao, nmfuncao, idmontagem, nmlocalmontagem, pavilhao,
    vlrcache, vlralimentacao, vlrtransporte, vlrajustecusto,
    vlrcaixinha, datasevento, descajustecusto, descbeneficios, vlrtotal, setor,
    statuspgto, statusajustecusto, statuscaixinha, statusdiariadobrada, statusmeiadiaria,
    datadiariadobrada, datameiadiaria, desccaixinha, descdiariadobrada, descmeiadiaria,
    nivelexperiencia, qtdpessoas, idequipe, nmequipe, tipoajudacustoviagem,
    statuspgtoajdcto, statuspgtocaixinha, idorcamento,
    vlrtotcache, vlrtotajdcusto, statuscustofechado, desccustofechado
    } = req.body;

    const idempresa = req.idempresa;
    let client;

    try {
        client = await pool.connect();
        await client.query('BEGIN');

        let datasArray = [];
        try {
            // Garante que datasArray seja um array, mesmo vindo via FormData (string)
            datasArray = Array.isArray(datasevento) ? datasevento : JSON.parse(datasevento || "[]");
        } catch (e) {
            console.error("Erro ao processar datasevento:", e);
            datasArray = [];
        }

        // --- 1. VALIDAÇÃO DE LIMITE (TRAVA) ---
        // Buscamos a definição da vaga no orçamento
        const queryOrca = `
            SELECT 
                bool_or(cachefechado) as eh_cache_fechado,
                SUM(CASE WHEN cachefechado = true THEN qtddias ELSE qtditens END) as limite_total
            FROM orcamentoitens 
            WHERE idorcamento = $1 AND idfuncao = $2 AND (setor = $3 OR $3 IS NULL)
            GROUP BY idfuncao
        `;
        const resOrca = await client.query(queryOrca, [idorcamento, idfuncao, setor]);

        if (resOrca.rows.length > 0) {
            const { eh_cache_fechado, limite_total } = resOrca.rows[0];

            // Buscamos o que já foi consumido no banco
            const queryConsumido = `
                SELECT 
                    COUNT(DISTINCT idfuncionario) as total_pessoas,
                    SUM(jsonb_array_length(datasevento)) as total_diarias
                FROM staffeventos 
                WHERE idorcamento = $1 AND idfuncao = $2 AND (setor = $3 OR $3 IS NULL)
            `;
            const resConsumido = await client.query(queryConsumido, [idorcamento, idfuncao, setor]);
            
            const jaUtilizado = eh_cache_fechado 
                ? parseInt(resConsumido.rows[0].total_diarias || 0) 
                : parseInt(resConsumido.rows[0].total_pessoas || 0);

            // Calculamos o que está sendo tentado agora
            // Se for cache fechado, somamos as novas diárias. Se não, somamos 1 pessoa.
            const datasArray = Array.isArray(datasevento) ? datasevento : JSON.parse(datasevento || "[]");
            const tentativaAtual = eh_cache_fechado ? datasArray.length : 1;

            if (jaUtilizado + tentativaAtual > limite_total) {
                await client.query('ROLLBACK');
                const saldoFinal = limite_total - jaUtilizado;
                
                // IMPORTANTE: Enviamos campos separados para o Swal usar no HTML
                return res.status(400).json({ 
                    tipoErro: "LIMITE_EXCEDIDO", 
                    title: "Limite de Orçamento Excedido",
                    tipo: eh_cache_fechado ? 'diárias' : 'vagas',
                    limite: limite_total,
                    tentativa: tentativaAtual,
                    usado: jaUtilizado,
                    saldo: saldoFinal < 0 ? 0 : saldoFinal
                });
            }
        }
        // --- FIM DA VALIDAÇÃO ---

        // 2. Verificar/Criar Staff (Sua lógica original continua abaixo...)
        const staffResult = await client.query(`
            SELECT s.idstaff FROM staff s 
            JOIN staffempresas se ON s.idstaff = se.idstaff 
            WHERE s.idfuncionario = $1 AND se.idempresa = $2`, [idfuncionario, idempresa]);

        let idstaffExistente = staffResult.rows[0]?.idstaff;
        if (!idstaffExistente) {
            const resS = await client.query(`INSERT INTO staff (idfuncionario) VALUES ($1) RETURNING idstaff`, [idfuncionario]);
            idstaffExistente = resS.rows[0].idstaff;
            await client.query(`INSERT INTO staffEmpresas (idstaff, idEmpresa) VALUES ($1, $2)`, [idstaffExistente, idempresa]);
        }

        // 3. Inserir Evento (Sua query de insert original...)
        const queryInsert = `
            INSERT INTO staffeventos (
                idstaff, idfuncionario, nmfuncionario, idevento, nmevento, idcliente, nmcliente,
                idfuncao, nmfuncao, idmontagem, nmlocalmontagem, pavilhao, vlrcache, 
                vlralimentacao, vlrtransporte, vlrajustecusto, vlrcaixinha, descajustecusto,
                datasevento, vlrtotal, comppgtocache, comppgtoajdcusto, comppgtocaixinha,
                descbeneficios, setor, statuspgto, statusajustecusto, statuscaixinha,
                statusdiariadobrada, statusmeiadiaria, dtdiariadobrada, comppgtoajdcusto50,
                dtmeiadiaria, desccaixinha, descdiariadobrada, descmeiadiaria, nivelexperiencia,
                qtdpessoaslote, idequipe, nmequipe, tipoajudacustoviagem, statuspgtocaixinha,
                statuspgtoajdcto, idorcamento, vlrtotcache, vlrtotajdcusto, statuscustofechado, desccustofechado
            ) VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44,$45,$46,$47,$48
            ) RETURNING idstaffevento;
        `;

        const values = [
            idstaffExistente, idfuncionario, nmfuncionario, idevento, nmevento, idcliente, nmcliente,
            idfuncao, nmfuncao, idmontagem, nmlocalmontagem, pavilhao,
            parseFloatOrNull(vlrcache), parseFloatOrNull(vlralimentacao),
            parseFloatOrNull(vlrtransporte), parseFloatOrNull(vlrajustecusto), parseFloatOrNull(vlrcaixinha),
            descajustecusto, datasevento, parseFloatOrNull(vlrtotal),
            req.files?.comppgtocache?.[0] ? `/uploads/staff_comprovantes/${req.files.comppgtocache[0].filename}` : null,
            req.files?.comppgtoajdcusto?.[0] ? `/uploads/staff_comprovantes/${req.files.comppgtoajdcusto[0].filename}` : null,
            req.files?.comppgtocaixinha?.[0] ? `/uploads/staff_comprovantes/${req.files.comppgtocaixinha[0].filename}` : null,
            descbeneficios, setor, statuspgto, statusajustecusto, statuscaixinha, statusdiariadobrada,
            statusmeiadiaria, datadiariadobrada,
            req.files?.comppgtoajdcusto50?.[0] ? `/uploads/staff_comprovantes/${req.files.comppgtoajdcusto50[0].filename}` : null,
            datameiadiaria, desccaixinha, descdiariadobrada, descmeiadiaria, nivelexperiencia, qtdpessoas,
            idequipe, nmequipe, tipoajudacustoviagem, statuspgtocaixinha, statuspgtoajdcto, idorcamento,
            parseFloatOrNull(vlrtotcache), parseFloatOrNull(vlrtotajdcusto), statuscustofechado, desccustofechado
        ];

        const resIns = await client.query(queryInsert, values);
        await client.query('COMMIT');

        // ✅ CORREÇÃO: Informa o logMiddleware qual registro foi criado
        res.locals.acao = 'cadastrou';
        res.locals.idregistroalterado = resIns.rows[0].idstaffevento;
        res.locals.dadosnovos = {
            idstaffevento: resIns.rows[0].idstaffevento,
            nmfuncionario,
            nmevento,
            nmfuncao,
            vlrtotal: parseFloat(vlrtotal) || 0,
            datasevento: datasArray, // Salva o array já tratado
            temComprovantes: !!(req.files?.comppgtocache || req.files?.comppgtoajdcusto)
        };
        

        res.status(201).json({ message: "Sucesso", idstaffevento: resIns.rows[0].idstaffevento });
    } catch (e) {
        if (client) await client.query('ROLLBACK');
        console.error("Erro ao salvar staff:", e);
        res.status(500).json({ error: e.message });
    } finally { 
        if (client) client.release(); 
    }
});


router.post('/aditivoextra/solicitacao', 
  autenticarToken(), 
  contextoEmpresa, 
  verificarPermissao('staff', 'cadastrar'), 

  logMiddleware('aditivoextra', { 
    buscarDadosAnteriores: async (req) => {
      return { dadosanteriores: null, idregistroalterado: null };
    }
  }),

  async (req, res) => {
    console.log("🔥 Rota /staff/aditivoextra/solicitacao acessada", req.body);

    const { 
      idOrcamento, 
      idFuncao, 
      qtdSolicitada, 
      tipoSolicitacao, 
      justificativa, 
      idFuncionario,
      dataSolicitada,
      idEventoSolicitado,    
      idEventoConflitante    
      
    } = req.body; 

    const idEmpresaContexto = req.empresa?.idempresa || req.idempresa;
    const idUsuarioSolicitante = req.usuario?.idusuario; 
    const statusInicial = 'Pendente';

   const dataParaBanco = (dataSolicitada && dataSolicitada !== 'undefined' && String(dataSolicitada).trim() !== "") 
    ? dataSolicitada.split(',').map(d => d.trim()) 
    : null;

    

    // Se idEvento vier como um objeto vazio {} como mostra o seu log, tratamos também
    // const idEventoTratado = (typeof idEvento === 'object' && Object.keys(idEvento).length === 0) || idEvento === '' 
    //     ? null 
    //     : idEvento;

    const idFuncionarioTratado = (idFuncionario === '' || idFuncionario === 'undefined') ? null : idFuncionario;

    const idEventoSolicitadoTratado = (idEventoSolicitado === '' || idEventoSolicitado === 'undefined' || idEventoSolicitado == null) ? null : idEventoSolicitado;
    const idEventoConflitanteTratado = (idEventoConflitante === '' || idEventoConflitante === 'undefined' || idEventoConflitante == null) ? null : idEventoConflitante;

    // 1. Validações de Contexto
    if (!idUsuarioSolicitante || !idEmpresaContexto) {
        return res.status(401).json({ 
            sucesso: false, 
            erro: "Usuário ou Empresa não identificados no contexto da requisição." 
        });
    }

    // 2. Validação de Campos Obrigatórios
    let campoFaltante = null;
    if (!idOrcamento) campoFaltante = 'idOrcamento';
    else if (!idFuncao) campoFaltante = 'idFuncao';
    else if (!qtdSolicitada) campoFaltante = 'qtdSolicitada';
    else if (!tipoSolicitacao) campoFaltante = 'tipoSolicitacao';
    else if (!justificativa) campoFaltante = 'justificativa';
    

    if (campoFaltante) { 
        return res.status(400).json({ 
            sucesso: false,
            erro: `O campo obrigatório **${campoFaltante}** está faltando.` 
        });
    }

    // // 3. Tratamento da Data (Crucial para evitar o erro de undefined)
    // const dataTratada = Array.isArray(dataSolicitada) ? dataSolicitada[0] : dataSolicitada;
    // const dataParaBanco = (dataTratada && dataTratada !== 'undefined' && String(dataTratada).trim() !== "") 
    //     ? dataTratada 
    //     : null;

    // 4. Verificação de Duplicidade (CORRIGIDA)
    try {
        const checkDuplicidade = await pool.query(`
            SELECT idAditivoExtra FROM AditivoExtra 
            WHERE idOrcamento = $1 
              AND idFuncionario = $2 
              AND idFuncao = $3 
              AND tipoSolicitacao = $4 
              --AND (dtsolicitada = $5 OR (dtsolicitada IS NULL AND $5 IS NULL))
              AND (dtsolicitada = ANY($5::date[]) OR (dtsolicitada IS NULL AND $5 IS NULL))
              AND idEmpresa = $6
              AND status = 'Pendente'
        `, [idOrcamento, idFuncionario, idFuncao, tipoSolicitacao, dataParaBanco, idEmpresaContexto]);

        if (checkDuplicidade.rows.length > 0) {
            return res.status(409).json({ 
                sucesso: false, 
                erro: "Já existe uma solicitação pendente idêntica para este funcionário." 
            });
        }

        // 5. Inserção no Banco
        const queryInsert = `
            INSERT INTO AditivoExtra (
              idOrcamento, idFuncao, idEmpresa, tipoSolicitacao, 
              qtdSolicitada, justificativa, idUsuarioSolicitante,
              status, idFuncionario, dtSolicitada, ideventosolicitado, ideventoconflitante
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING idAditivoExtra;
        `;

        const values = [
          idOrcamento, 
          idFuncao, 
          idEmpresaContexto, 
          tipoSolicitacao, 
          qtdSolicitada, 
          justificativa, 
          idUsuarioSolicitante,
          statusInicial,
          idFuncionarioTratado || null,
          dataParaBanco,
          idEventoSolicitadoTratado,
          idEventoConflitanteTratado
        ];

        const resultado = await pool.query(queryInsert, values);
        const idAditivoExtra = resultado.rows[0].idaditivoextra;

        // Log de Auditoria
        if (req.logData && logMiddleware.salvarLog) {
          req.logData.idregistroalterado = idAditivoExtra;
          await logMiddleware.salvarLog(req.logData); 
        }

        res.locals.acao = 'cadastrou';
        res.locals.idregistroalterado = idAditivoExtra;
        res.locals.dadosnovos = { // ❌ Estava faltando
            idAditivoExtra,
            idOrcamento,
            idFuncao,
            tipoSolicitacao,
            qtdSolicitada,
            justificativa,
            idFuncionario: idFuncionarioTratado,
            dataSolicitada: dataParaBanco,
            idEventoSolicitado: idEventoSolicitadoTratado,
            idEventoConflitante: idEventoConflitanteTratado,
            status: statusInicial
        };

        res.status(201).json({ 
          sucesso: true, 
          mensagem: `Solicitação salva com sucesso.`,
          idAditivoExtra: idAditivoExtra
        });

    } catch (error) {
        console.error("❌ Erro ao processar AditivoExtra:", error.message);
        res.status(500).json({ 
            sucesso: false, 
            erro: "Erro interno ao processar a solicitação.",
            detalhe: error.message 
        });
    }
});

router.get('/aditivoextra/verificar-status',
    autenticarToken(),
    contextoEmpresa,
    async (req, res) => {
        const { idOrcamento, idFuncao, tipoSolicitacao, idFuncionario, dataSolicitada, idEventoSolicitado, idEventoConflitante } = req.query;
        const idEmpresa = req.idempresa;

        if (!idOrcamento || !idFuncao || !idEmpresa || !tipoSolicitacao) {
            return res.status(400).json({ sucesso: false, erro: "Parâmetros incompletos." });
        }

        try {

            if (tipoSolicitacao === 'FuncExcedido') {
                const paramsFE = [idEmpresa, idFuncionario];
                let filtroData = "";

                if (dataSolicitada && dataSolicitada !== 'undefined' && dataSolicitada !== '') {
                    const arrayDatas = dataSolicitada.split(',').map(d => d.trim());
                    paramsFE.push(arrayDatas);
                    filtroData = ` AND (ae.dtsolicitada && $${paramsFE.length}::date[])`;
                }

                // BUSCA 1: Solicitação IDÊNTICA (mesmo evento + mesma função + mesma data)
                // Para bloquear completamente
                const paramsDuplicata = [...paramsFE];
                let filtroDuplicata = filtroData;

                if (idEventoSolicitado) {
                    paramsDuplicata.push(idEventoSolicitado);
                    filtroDuplicata += ` AND ae.ideventosolicitado = $${paramsDuplicata.length}`;
                }
                if (idFuncao) {
                    paramsDuplicata.push(idFuncao);
                    filtroDuplicata += ` AND ae.idfuncao = $${paramsDuplicata.length}`;
                }

                const queryDuplicata = `
                    SELECT ae.*, f.nome AS "nmfuncionariodono",
                    e.nmevento AS "nmeventosolicitado" 
                    FROM AditivoExtra ae
                    LEFT JOIN funcionarios f ON ae.idfuncionario = f.idfuncionario        
                    LEFT JOIN eventos e ON e.idevento = ae.ideventosolicitado
                    WHERE ae.idEmpresa = $1
                    AND ae.idfuncionario = $2
                    AND ae.tipoSolicitacao ILIKE '%FuncExcedido%'
                    AND ae.status = 'Pendente'
                    AND ae.ideventosolicitado IS NOT NULL   
                    ${filtroDuplicata}
                    ORDER BY ae.dtSolicitacao DESC LIMIT 1
                `;

                const resultDuplicata = await pool.query(queryDuplicata, paramsDuplicata);
                const solicitacaoDuplicada = resultDuplicata.rows[0] || null;

                // BUSCA 2: Qualquer solicitação na mesma data (mesmo que evento diferente)
                // Para avisar que existe outra pendente
                const queryGeral = `
                    SELECT ae.*, f.nome AS "nmfuncionariodono",
                    ev.nmevento AS "nmeventosolicitado"
                    FROM AditivoExtra ae
                    LEFT JOIN funcionarios f ON ae.idfuncionario = f.idfuncionario
                    LEFT JOIN eventos ev ON ev.idevento = ae.ideventosolicitado
                    WHERE ae.idEmpresa = $1
                    AND ae.idfuncionario = $2
                    AND ae.tipoSolicitacao ILIKE '%FuncExcedido%'
                    AND ae.status IN ('Pendente', 'Autorizado')
                    ${filtroData}
                    ORDER BY ae.dtSolicitacao DESC LIMIT 1
                `;

                const resultGeral = await pool.query(queryGeral, paramsFE);
                const solicitacaoGeral = resultGeral.rows[0] || null;
                
                return res.json({
                    sucesso: true,
                    dados: {
                        solicitacaoDuplicada,           // ← mesma data + mesmo evento + mesma função = BLOQUEAR
                        solicitacaoRecente: solicitacaoGeral, // ← mesma data, qualquer evento = AVISAR
                        autorizadoEspecifico: solicitacaoGeral?.status === 'Autorizado' && 
                                            String(solicitacaoGeral?.ideventosolicitado) === String(idEventoSolicitado),
                        totaisFuncao: null
                    }
                });
            }
            // ✅ FIM DO BLOCO FuncExcedido — código abaixo inalterado

            let params = [idOrcamento, idFuncao, idEmpresa];
            let filtroTipo = "";

            if (tipoSolicitacao === 'QUALQUER_VAGA') {
                filtroTipo = "AND UPPER(ae.tipoSolicitacao) IN ('ADITIVO - VAGA EXCEDIDA', 'EXTRA BONIFICADO - VAGA EXCEDIDA')";
            } else if (tipoSolicitacao === 'QUALQUER_DATA') {
                filtroTipo = "AND (UPPER(ae.tipoSolicitacao) LIKE '%DATA%FORA%ORÇAMENTO%')";
            } else if (tipoSolicitacao === 'QUALQUER_FUNC') {
                filtroTipo = "AND ae.tipoSolicitacao ILIKE '%FuncExcedido%'";
            } else {
                filtroTipo = "AND UPPER(ae.tipoSolicitacao) = UPPER($4)";
                params.push(tipoSolicitacao);
            }

            let filtroData = "";
            if (dataSolicitada && dataSolicitada !== 'undefined' && dataSolicitada !== '') {
                const dataIndex = params.length + 1;
                const arrayDatas = dataSolicitada.split(',').map(d => d.trim());
                filtroData = ` AND (ae.dtsolicitada && $${dataIndex}::date[] OR ae.dtsolicitada IS NULL)`;
                params.push(arrayDatas);
            }

            let filtroEvento = "";
            if (idEventoSolicitado || idEventoConflitante) {
                const idxEvento = params.length + 1;
                filtroEvento = `AND (ae.ideventosolicitado = $${idxEvento} OR ae.ideventoconflitante = $${idxEvento})`;
                params.push(idEventoSolicitado || idEventoConflitante);
            }

            const solicitacaoQuery = `
                SELECT ae.*, f.nome AS "nmfuncionariodono"
                FROM AditivoExtra ae
                LEFT JOIN funcionarios f ON ae.idfuncionario = f.idfuncionario
                WHERE ae.idOrcamento = $1 AND ae.idFuncao = $2 AND ae.idEmpresa = $3
                ${filtroTipo}
                ${filtroData}
                ${filtroEvento}
                ORDER BY ae.dtSolicitacao DESC LIMIT 1;
            `;
            const solicitacaoResult = await pool.query(solicitacaoQuery, params);
            const solicitacaoRecente = solicitacaoResult.rows[0] || null;

            let autorizadoEspecifico = false;
            if (idFuncionario && idFuncionario !== 'undefined') {
                let paramsCheck = [idOrcamento, idFuncao, idFuncionario, idEmpresa];
                let filtroTipoCheck = "";

                if (tipoSolicitacao === 'QUALQUER_VAGA') {
                    filtroTipoCheck = "AND UPPER(ae.tipoSolicitacao) IN ('ADITIVO - VAGA EXCEDIDA', 'EXTRA BONIFICADO - VAGA EXCEDIDA')";
                } else if (tipoSolicitacao === 'QUALQUER_DATA') {
                    filtroTipoCheck = "AND (UPPER(ae.tipoSolicitacao) LIKE '%DATA%FORA%ORÇAMENTO%')";
                } else {
                    filtroTipoCheck = "AND UPPER(ae.tipoSolicitacao) = UPPER($5)";
                    paramsCheck.push(tipoSolicitacao);
                }

                let filtroDataCheck = "";
                if (dataSolicitada && dataSolicitada !== 'undefined' && dataSolicitada !== '') {
                    const idxD = paramsCheck.length + 1;
                    const listaDatasCheck = dataSolicitada.split(',').map(d => d.trim());
                    filtroDataCheck = ` AND (ae.dtsolicitada && $${idxD}::date[] OR ae.dtsolicitada IS NULL)`;
                    paramsCheck.push(listaDatasCheck);
                }

                const checkQuery = `
                    SELECT ae.status, ae.tipoSolicitacao
                    FROM AditivoExtra ae 
                    WHERE ae.idOrcamento = $1 
                    AND ae.idFuncao = $2 
                    AND ae.idFuncionario = $3 
                    AND ae.idEmpresa = $4
                    AND ae.status IN ('Autorizado', 'Aprovado', 'Pendente', 'Em Análise')
                    ${filtroTipoCheck} 
                    ${filtroDataCheck}
                    ORDER BY ae.dtSolicitacao DESC LIMIT 1
                `;
                
                const checkResult = await pool.query(checkQuery, paramsCheck);
                
                if (checkResult.rows.length > 0) {
                    autorizadoEspecifico = checkResult.rows[0].status === 'Autorizado' || checkResult.rows[0].status === 'Aprovado';
                    solicitacaoPendente = checkResult.rows[0];
                }
            }

            const orcamentoQuery = `
                SELECT 
                    (SELECT COALESCE(SUM(oi.qtditens), 0) FROM orcamentoitens oi WHERE oi.idorcamento = $1 AND oi.idfuncao = $2) AS "totalOrcado",
                    (SELECT COALESCE(COUNT(DISTINCT se.idfuncionario), 0) FROM staffeventos se WHERE se.idorcamento = $1 AND se.idfuncao = $2) AS "totalVagasPreenchidas"
            `;
            const orcamentoResult = await pool.query(orcamentoQuery, [idOrcamento, idFuncao]);
            const dadosBase = orcamentoResult.rows[0];

            const aditivoResult = await pool.query(`
                SELECT COALESCE(SUM(qtdSolicitada), 0) AS total FROM AditivoExtra 
                WHERE idOrcamento = $1 AND idFuncao = $2 AND idEmpresa = $3 AND status = 'Autorizado' AND tipoSolicitacao ILIKE '%Aditivo%'
            `, [idOrcamento, idFuncao, idEmpresa]);

            const extraResult = await pool.query(`
                SELECT COALESCE(SUM(qtdSolicitada), 0) AS total FROM AditivoExtra 
                WHERE idOrcamento = $1 AND idFuncao = $2 AND idEmpresa = $3 AND status = 'Autorizado' AND tipoSolicitacao ILIKE '%Extra%'
            `, [idOrcamento, idFuncao, idEmpresa]);

            const totaisFuncao = {
                totalOrcado: parseInt(dadosBase.totalOrcado) || 0,
                totalVagasPreenchidas: parseInt(dadosBase.totalVagasPreenchidas) || 0,
                totalAditivoAprovado: parseInt(aditivoResult.rows[0].total) || 0,
                totalExtraAprovado: parseInt(extraResult.rows[0].total) || 0
            };

            res.json({
                sucesso: true,
                dados: { 
                    solicitacaoRecente, 
                    autorizadoEspecifico,
                    totaisFuncao: totaisFuncao
                }
            });

        } catch (error) {
            console.error("ERRO CRÍTICO NO BANCO:", error.stack);
            res.status(500).json({ sucesso: false, erro: error.message });
        }
    }
);
module.exports = router;