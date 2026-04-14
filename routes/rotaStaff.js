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
        console.log("📊 LINHAS ENCONTRADAS PELO BANCO:", orcamentoItems);

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

// router.post("/orcamento/consultar",
//   async (req, res) => {
//   console.log("Dados recebidos no backend:", req.body);
//   const client = await pool.connect();
//   try {
//         const {
//             idEvento,
//             idCliente, // Recebido do frontend mas não usado no WHERE (evita bug de race condition)
//             idLocalMontagem,
//             idFuncao,
//             setor,
//             datasEvento = [],
//         } = req.body;
 
//         const idempresa = req.idempresa;
 
//         console.log("ORCAMENTO/CONSULTAR", req.body);
 
//         if (!idEvento || !idLocalMontagem || !idFuncao) {
//             return res.status(400).json({ 
//                 error: "Evento, Local e Função são obrigatórios." 
//             });
//         }
 
//         if (!Array.isArray(datasEvento) || datasEvento.length === 0) {
//             return res.status(400).json({ error: "O array de datas é obrigatório para a pesquisa." });
//         }
 
//         // CORREÇÃO: idCliente removido do WHERE pois o frontend pode enviar o valor
//         // de um modal anterior (race condition entre prefill e carregamento do select).
//         // idEvento + idLocalMontagem + idEmpresa + idFuncao já identificam o orçamento unicamente.
//         const query = `
//             WITH datas_orcamento AS (
//                 SELECT
//                     oi.idorcamentoitem,
//                     ARRAY(
//                         SELECT * FROM gerar_periodo_diarias(oi.periododiariasinicio, oi.periododiariasfim)
//                     ) AS periodos_disponiveis
//                 FROM orcamentoitens oi
//                 WHERE oi.idorcamentoitem IS NOT NULL
//             )
//             SELECT
//                 o.status, o.idorcamento, o.contratarstaff,
//                 o.idcliente,
//                 dto.periodos_disponiveis AS datas_totais_orcadas,
 
//                 oi.qtditens AS quantidade_orcada,
//                 oi.idfuncao,
//                 f.descfuncao,
//                 e.nmevento,
//                 c.nmfantasia AS nmcliente,
//                 lm.descmontagem AS nmlocalmontagem,
//                 oi.setor AS setor,
//                 (
//                     SELECT COUNT(DISTINCT se.idfuncionario)
//                     FROM staffeventos se
//                     WHERE
//                         se.idevento = o.idevento
//                         AND se.idcliente = o.idcliente
//                         AND se.idmontagem = o.idmontagem
//                         AND se.idfuncao = oi.idfuncao
//                         -- Verifica staff escalado apenas nas datas que foram filtradas na busca ($4)
//                         AND se.datasevento @> to_jsonb($4::text[])
//                 ) AS quantidade_escalada
//             FROM
//                 orcamentoitens oi
//             JOIN
//                 orcamentos o ON oi.idorcamento = o.idorcamento
//             JOIN
//                 orcamentoempresas oe ON o.idorcamento = oe.idorcamento
//             LEFT JOIN
//                 funcao f ON oi.idfuncao = f.idfuncao
//             LEFT JOIN
//                 eventos e ON o.idevento = e.idevento
//             LEFT JOIN
//                 clientes c ON o.idcliente = c.idcliente
//             LEFT JOIN
//                 localmontagem lm ON o.idmontagem = lm.idmontagem
//             JOIN
//                 datas_orcamento dto ON oi.idorcamentoitem = dto.idorcamentoitem
//             WHERE
//                 oe.idempresa = $1
//                 AND o.idevento = $2
//                 AND o.idmontagem = $3
//                 -- idCliente removido do WHERE: era fonte de bug quando o frontend
//                 -- enviava o ID de um cliente de sessão anterior (race condition).
//                 AND oi.idfuncao = $5
//                 AND (oi.setor = $6 OR $6 IS NULL OR $6 = '' OR oi.setor IS NULL OR oi.setor = '')
//                 AND dto.periodos_disponiveis && $4::date[]
//             GROUP BY
//                 oi.idorcamentoitem,
//                 f.descfuncao,
//                 e.nmevento,
//                 c.nmfantasia,
//                 lm.descmontagem,
//                 oi.setor,
//                 o.idevento,
//                 o.idcliente,
//                 o.idmontagem,
//                 oi.idfuncao,
//                 o.status,
//                 o.idorcamento,
//                 oi.qtditens,
//                 o.contratarstaff,
//                 dto.periodos_disponiveis
//             ORDER BY
//                 oi.idorcamentoitem;
//         `;
 
//         console.log("QUERY", query);
//         const values = [
//             idempresa,       // $1
//             idEvento,        // $2
//             idLocalMontagem, // $3 (era $4, idCliente removido)
//             datasEvento,     // $4 (era $5)
//             idFuncao,        // $5 (era $6)
//             setor || null    // $6 (era $7)
//         ];
 
//         const result = await client.query(query, values);
//         const orcamentoItems = result.rows;
//         // console.log("📊 LINHAS ENCONTRADAS PELO BANCO:", orcamentoItems);
 
//         res.locals.acao = 'cadastrou';
//         res.locals.idregistroalterado = orcamentoItems.length > 0 ? orcamentoItems[0].idorcamento : null;
 
//         res.status(200).json(orcamentoItems);
//        } catch (error) {
//         console.error("Erro ao buscar itens de orçamento por critérios:", error);
//         res.status(500).json({
//             error: "Erro ao buscar orçamento por critérios.",
//             detail: error.message,
//         });
//        } finally {
//         client.release();
//       }
//     });

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
          se.obspospgto,
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

// router.put("/:idStaffEvento", autenticarToken(), contextoEmpresa, verificarPermissao('staff', 'alterar'), uploadComprovantesMiddleware, 
//     logMiddleware('staffeventos', {
//         buscarDadosAnteriores: async (req) => {
//             const idstaffEvento = req.params.idStaffEvento;
//             const idempresa = req.idempresa; // Captura o ID da empresa do contexto
//             if (!idstaffEvento) {
//                 return { dadosanteriores: null, idregistroalterado: null };
//             }
//             try {
//                 // Ajustar a query para buscar o registro de staffeventos
//                 // Incluímos o JOIN com staffempresas para verificar a posse da empresa
//                 // const result = await pool.query(
//                 //     `SELECT se.*, se.nmfuncionario AS nmfuncionario_principal,
//                 //             se.nmfuncao, se.nmcliente, se.nmevento, se.nmlocalmontagem
//                 //     FROM staffeventos se
//                 //     INNER JOIN staff s ON se.idfuncionario = s.idfuncionario
//                 //     INNER JOIN staffempresas sme ON sme.idstaff = s.idstaff                     
//                 //     WHERE se.idstaffevento = $1 AND sme.idempresa = $2`, // Verifica a empresa do staff
//                 //     [idstaffEvento, idempresa]
//                 // );

//                 // const result = await pool.query(
//                 //     `SELECT se.* FROM staffeventos se
//                 //     INNER JOIN staffempresas sme ON se.idstaff = sme.idstaff
//                 //     WHERE se.idstaffevento = $1 AND sme.idempresa = $2`,
//                 //     [idstaffEvento, idempresa]
//                 // );

//                 const result = await pool.query(
//                     `SELECT se.* FROM staffeventos se
//                     WHERE se.idstaffevento = $1 
//                     AND EXISTS (
//                         SELECT 1 FROM staffempresas sme 
//                         WHERE sme.idstaff = se.idstaff 
//                         AND sme.idempresa = $2
//                     )`, 
//                     [idstaffEvento, idempresa]
//                 );
//                 const linha = result.rows[0] || null;

//                 if (!linha) {
//                     console.warn(`⚠️ LogMiddleware: Nenhum dado anterior encontrado para ID ${idstaffEvento}`);
//                 }

//                 const dadosLimpos = linha ? JSON.parse(JSON.stringify(linha)) : null;
//                 console.log("DADOS ANTERIORES:", linha);
//                 return {
//                     dadosanteriores: dadosLimpos,
//                     //idregistroalterado: linha?.idstaffevento || null
//                     idregistroalterado: idstaffEvento
//                 };
//             } catch (error) {
//                 console.error("Erro ao buscar dados anteriores do evento de staff para log:", error);
//                 return { dadosanteriores: null, idregistroalterado: idstaffEvento };
//             }
//         }
//     }),
//     async (req, res) => {
//         const { idStaffEvento } = req.params;
//         const idempresa = req.idempresa;
//         const idUsuarioLogado = req.usuario.idusuario;
//         const body = req.body;

//         console.log("BODY DO PUT STAFF", req.body);

//         let client;
//         try {
//             client = await pool.connect();
//             await client.query('BEGIN');

//             // 1. Buscar dados antigos para gerir ficheiros
//             const oldResult = await client.query(`
//                 SELECT se.* FROM staffeventos se 
//                 JOIN staffempresas sme ON se.idstaff = sme.idstaff 
//                 WHERE se.idstaffevento = $1 AND sme.idempresa = $2`, [idStaffEvento, idempresa]);
            
//             if (oldResult.rowCount === 0) throw new Error("Evento não encontrado ou sem permissão.");
//             const old = oldResult.rows[0];

//             const paths = {
//                 cache: req.files?.comppgtocache ? `/uploads/staff_comprovantes/${req.files.comppgtocache[0].filename}` : (body.limparComprovanteCache === 'true' ? null : old.comppgtocache),
//                 ajd: req.files?.comppgtoajdcusto ? `/uploads/staff_comprovantes/${req.files.comppgtoajdcusto[0].filename}` : (body.limparComprovanteAjdCusto === 'true' ? null : old.comppgtoajdcusto),
//                 ajd50: req.files?.comppgtoajdcusto50 ? `/uploads/staff_comprovantes/${req.files.comppgtoajdcusto50[0].filename}` : (body.limparComprovanteAjdCusto50 === 'true' ? null : old.comppgtoajdcusto50),
//                 cx: req.files?.comppgtocaixinha ? `/uploads/staff_comprovantes/${req.files.comppgtocaixinha[0].filename}` : (body.limparComprovanteCaixinha === 'true' ? null : old.comppgtocaixinha)
//             };

//             if (req.files?.comppgtocache) deletarArquivoAntigo(old.comppgtocache);
//             if (req.files?.comppgtoajdcusto) deletarArquivoAntigo(old.comppgtoajdcusto);

//             // 2. Query de Update Corrigida
//             const queryUpdate = `
//                 UPDATE staffeventos se
//                 SET
//                 idfuncionario = $1, nmfuncionario = $2, idfuncao = $3, nmfuncao = $4,
//                 idcliente = $5, nmcliente = $6, idevento = $7, nmevento = $8, idmontagem = $9,
//                 nmlocalmontagem = $10, pavilhao = $11, vlrcache = $12, vlrajustecusto = $13, vlrtransporte = $14,
//                 vlralimentacao = $15, vlrcaixinha = $16, descajustecusto = $17, datasevento = $18, 
//                 vlrtotal = $19, descbeneficios = $20, setor = $21, statuspgto = $22, statusajustecusto = $23,
//                 statuscaixinha = $24, statusdiariadobrada = $25, statusmeiadiaria = $26, dtdiariadobrada = $27, 
//                 dtmeiadiaria = $28, desccaixinha = $29, descdiariadobrada = $30, descmeiadiaria = $31,
//                 comppgtocache = $32, comppgtoajdcusto = $33, comppgtoajdcusto50 = $34, comppgtocaixinha = $35, 
//                 nivelexperiencia = $36, qtdpessoaslote = $37, idequipe = $38, nmequipe = $39, tipoajudacustoviagem = $40,
//                 statuspgtoajdcto = $41, statuspgtocaixinha = $42, idorcamento = $43, vlrtotcache = $44, vlrtotajdcusto = $45, 
//                 statuscustofechado = $46, desccustofechado = $47, obspospgto = $48
//                 FROM staffempresas sme
//                 WHERE se.idstaff = sme.idstaff AND se.idstaffevento = $49 AND sme.idempresa = $50
//                 RETURNING se.idstaffevento;
//             `;

//             const diariaDobradaFinal = typeof body.datadiariadobrada === 'string' 
//                 ? body.datadiariadobrada 
//                 : JSON.stringify(body.datadiariadobrada);

//             console.log("DEBUG DIARIA DOBRADA FINAL:", diariaDobradaFinal);

//             const values = [
//                 body.idfuncionario, body.nmfuncionario, body.idfuncao, body.nmfuncao,
//                 body.idcliente, body.nmcliente, body.idevento, body.nmevento, body.idmontagem,
//                 body.nmlocalmontagem, body.pavilhao,
//                 parseFloatOrNull(body.vlrcache), parseFloatOrNull(body.vlrajustecusto), parseFloatOrNull(body.vlrtransporte),
//                 parseFloatOrNull(body.vlralimentacao), parseFloatOrNull(body.vlrcaixinha),
//                 body.descajustecusto, body.datasevento, parseFloatOrNull(body.vlrtotal),
//                 body.descbeneficios, body.setor, body.statuspgto, body.statusajustecusto, body.statuscaixinha,
//                 body.statusdiariadobrada, body.statusmeiadiaria, body.datadiariadobrada, body.datameiadiaria,
//                 body.desccaixinha, body.descdiariadobrada, body.descmeiadiaria,
//                 paths.cache, paths.ajd, paths.ajd50, paths.cx,
//                 body.nivelexperiencia, body.qtdpessoas, body.idequipe, body.nmequipe, body.tipoajudacustoviagem,
//                 body.statuspgtoajdcto, body.statuspgtocaixinha, body.idorcamento,
//                 parseFloatOrNull(body.vlrtotcache), parseFloatOrNull(body.vlrtotajdcusto), body.statuscustofechado, body.desccustofechado,
//                 body.obspospgto,
//                 idStaffEvento, idempresa
//             ];

//             const resUp = await client.query(queryUpdate, values);
//             const itensFinanceiros = [
//                 { status: body.statuscaixinha, campo: 'statuscaixinha', valor: body.vlrcaixinha, desc: body.desccaixinha, tipo: 'Caixinha' },
//                 { status: body.statusajustecusto, campo: 'statusajustecusto', valor: body.vlrajustecusto, desc: body.descajustecusto, tipo: 'Ajuste de Custo' },
//                 { status: body.statuscustofechado, campo: 'statuscustofechado', valor: body.vlrcache, desc: body.desccustofechado, tipo: 'Cachê Fechado' },
//                 { status: body.statusdiariadobrada, campo: 'statusdiariadobrada', valor: 0, desc: body.descdiariadobrada, tipo: 'Diária Dobrada', datas: body.datadiariadobrada },
//                 { status: body.statusmeiadiaria, campo: 'statusmeiadiaria', valor: 0, desc: body.descmeiadiaria, tipo: 'Meia Diária', datas: body.datameiadiaria }
//             ];

//             // for (const item of itensFinanceiros) {
//             //     if (item.status === 'Pendente') {
//             //         await registrarSolicitacao(client, {
//             //             idempresa,
//             //             idorcamento: body.idorcamento,
//             //             idfuncionario: body.idfuncionario,
//             //             idfuncao: body.idfuncao,
//             //             idstaffevento: idStaffEvento,
//             //             idusuario: idUsuarioLogado,
//             //             tiposolicitacao: item.tipo,
//             //             categoria: item.campo,
//             //             valor: parseFloatOrNull(item.valor),
//             //             justificativa: item.desc,
//             //             datas: item.datas ? (typeof item.datas === 'string' ? JSON.parse(item.datas) : item.datas) : null
//             //         });
//             //     } else if (item.status === 'Aprovado' || item.status === 'Rejeitado') {
//             //         // Se o status mudou para algo final nesta rota, encerramos na solicitacoes
//             //         await client.query(
//             //             `UPDATE public.solicitacoes SET status = $1, dtresposta = CURRENT_TIMESTAMP, idusuarioresponsavel = $2 
//             //              WHERE idregistroalterado = $3 AND categoria_log = $4 AND status = 'Pendente'`,
//             //             [item.status, idUsuarioLogado, idStaffEvento, item.campo]
//             //         );
//             //     }
//             // }

//             for (const item of itensFinanceiros) {
//                 if (item.campo === 'statusdiariadobrada' || item.campo === 'statusmeiadiaria') {
//                     const datas = item.datas 
//                         ? (typeof item.datas === 'string' ? JSON.parse(item.datas) : item.datas) 
//                         : [];

//                     for (const entrada of datas) {
//                         const statusDecidido = (entrada.status || '').trim();
//                         const dataAlvo = entrada.data;

//                         if (!dataAlvo || statusDecidido === '') continue;

//                         console.log(`Individualizando Diária: ${item.campo} | Data: ${dataAlvo} | Status: ${statusDecidido}`);

//                         // 1. Tenta atualizar o registro individual daquela data
              
//                         const updateRes = await client.query(
//                             `UPDATE public.solicitacoes 
//                             SET 
//                                 status = $1::character varying, 
//                                 dtresposta = CASE 
//                                     WHEN $1::character varying = 'Pendente' THEN NULL 
//                                     ELSE CURRENT_TIMESTAMP 
//                                 END, 
//                                 idusuarioresponsavel = CASE 
//                                     WHEN $1::character varying = 'Pendente' THEN NULL 
//                                     ELSE $2::integer 
//                                 END
//                             WHERE idregistroalterado = $3 
//                             AND categoria_log = $4::character varying 
//                             AND idempresa = $5 
//                             AND dtsolicitada = $6::date`, // Força o tipo DATE aqui também
//                             [statusDecidido, idUsuarioLogado, idStaffEvento, item.campo, idempresa, dataAlvo]
//                         );

//                         // 2. Se não existia o registro para essa data específica e o status é Pendente/Autorizado, cria
//                         if (updateRes.rowCount === 0 && (statusDecidido === 'Pendente' || statusDecidido === 'Autorizado')) {
//                             await client.query(`
//                                 INSERT INTO public.solicitacoes (
//                                     idorcamento, idregistroalterado, idfuncionario, idfuncao, idempresa, 
//                                     tiposolicitacao, status, dtsolicitacao, idusuariosolicitante, 
//                                     categoria_log, justificativa, dtsolicitada
//                                 ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, $8, $9, $10, $11)`,
//                                 [
//                                     body.idorcamento, idStaffEvento, body.idfuncionario, body.idfuncao, idempresa,
//                                     item.tipo, statusDecidido, idUsuarioLogado, item.campo, item.desc, dataAlvo
//                                 ]
//                             );
//                         }
//                     }
//                 }
//                 // 2. Tratamento para campos simples (Caixinha, Ajuste, etc)
//                 else {
//                     // Verificação usando a PK idsolicitacao que vimos no seu pgAdmin
//                     const checkExistencia = await client.query(
//                         `SELECT idsolicitacao FROM public.solicitacoes 
//                         WHERE idregistroalterado = $1 AND categoria_log = $2 AND idempresa = $3`,
//                         [idStaffEvento, item.campo, idempresa]
//                     );

//                     if (checkExistencia.rowCount > 0) {
//                         // Nomes corrigidos: dtresposta e vlrsolicitado
//                         await client.query(
//                             `UPDATE public.solicitacoes 
//                             SET status = $1::character varying, 
//                                 dtresposta = CASE WHEN $1::character varying = 'Pendente' THEN NULL ELSE CURRENT_TIMESTAMP END, 
//                                 idusuarioresponsavel = CASE WHEN $1::character varying = 'Pendente' THEN NULL ELSE $2::integer END,
//                                 vlrsolicitado = $6,
//                                 justificativa = $7
//                             WHERE idregistroalterado = $3 
//                             AND categoria_log = $4::character varying 
//                             AND idempresa = $5`,
//                             [
//                                 item.status, 
//                                 idUsuarioLogado, 
//                                 idStaffEvento, 
//                                 item.campo, 
//                                 idempresa,
//                                 parseFloatOrNull(item.valor),
//                                 item.desc
//                             ]
//                         );
//                     } else if (['Pendente', 'Autorizado', 'Aprovado'].includes(item.status)) {
//                         // Se não existe, cria novo registro
//                         await registrarSolicitacao(client, {
//                             idempresa,
//                             idorcamento: body.idorcamento,
//                             idfuncionario: body.idfuncionario,
//                             idfuncao: body.idfuncao,
//                             idstaffevento: idStaffEvento,
//                             idusuariosolicitante: idUsuarioLogado, // Nome da coluna no seu pgAdmin
//                             tiposolicitacao: item.tipo,
//                             categoria: item.campo,
//                             vlrsolicitado: parseFloatOrNull(item.valor), // Nome da coluna no seu pgAdmin
//                             justificativa: item.desc,
//                             datas: item.datas ? (typeof item.datas === 'string' ? JSON.parse(item.datas) : item.datas) : null
//                         });
//                     }
//                 }
//             }
            
//             await client.query('COMMIT');

//             const dadosParaLog = { 
//                 ...body, 
//                 comppgtocache: paths.cache,
//                 comppgtoajdcusto: paths.ajd,
//                 comppgtoajdcusto50: paths.ajd50,
//                 comppgtocaixinha: paths.cx
//             };

//             res.locals.acao = 'atualizou';
//             res.locals.idregistroalterado = idStaffEvento;
//             res.locals.dadosnovos = dadosParaLog;
//             res.locals.dadosanteriores = JSON.parse(JSON.stringify(old));

//             res.json({ message: "Atualizado", id: idStaffEvento});
//         } catch (e) {
//             if (client) await client.query('ROLLBACK');
//             res.status(500).json({ error: e.message });
//         } finally { if (client) client.release(); }
//     }
// );


router.put("/:idStaffEvento", 
    autenticarToken(), 
    contextoEmpresa, 
    verificarPermissao('staff', 'alterar'), 
    uploadComprovantesMiddleware, 
    logMiddleware('staffeventos', {
        buscarDadosAnteriores: async (req) => {
            const idstaffEvento = req.params.idStaffEvento;
            const idempresa = req.idempresa;
            if (!idstaffEvento) return { dadosanteriores: null, idregistroalterado: null };
            
            try {
                const result = await pool.query(
                    `SELECT se.* FROM staffeventos se
                     WHERE se.idstaffevento = $1 
                     AND EXISTS (
                         SELECT 1 FROM staffempresas sme 
                         WHERE sme.idstaff = se.idstaff 
                         AND sme.idempresa = $2
                     )`, 
                    [idstaffEvento, idempresa]
                );
                const linha = result.rows[0] || null;

                if (!linha) {
                    console.warn(`⚠️ LogMiddleware: Nenhum dado anterior encontrado para ID ${idstaffEvento}`);
                }

                return {
                    dadosanteriores: linha ? JSON.parse(JSON.stringify(linha)) : null,
                    idregistroalterado: idstaffEvento
                };
            } catch (error) {
                console.error("Erro ao buscar dados anteriores para log:", error);
                return { dadosanteriores: null, idregistroalterado: idstaffEvento };
            }
        }
    }),   

    // ... (mantenha os middlewares de autenticação e log conforme o código anterior)

    async (req, res) => {
        const { idStaffEvento } = req.params;
        const idempresa = req.idempresa;
        const idUsuarioLogado = req.usuario.idusuario;
        const body = req.body;

        let client;
        try {
            client = await pool.connect();
            await client.query('BEGIN');

            // 1. BUSCA DADOS ANTIGOS
            const oldResult = await client.query(`
                SELECT se.*, f.perfil 
                FROM staffeventos se 
                JOIN staffempresas sme ON se.idstaff = sme.idstaff 
                JOIN funcionarios f ON se.idfuncionario = f.idfuncionario
                WHERE se.idstaffevento = $1 AND sme.idempresa = $2`, 
                [idStaffEvento, idempresa]
            );
            
            if (oldResult.rowCount === 0) throw new Error("Evento não encontrado ou sem permissão.");
            const old = oldResult.rows[0];
            const perfil = old.perfil?.toLowerCase() || 'freelancer';

            // 2. TRATAMENTO DE VALORES E STRINGS (Recalculo)
            const parseJSON = (val) => {
                if (!val) return [];
                if (typeof val === 'object') return val;
                try { return JSON.parse(val); } catch (e) { return []; }
            };

            const datasevento = parseJSON(body.datasevento);
            const dtdiariadobrada = parseJSON(body.datadiariadobrada);
            const dtmeiadiaria = parseJSON(body.datameiadiaria);

            const vlrCusto = parseFloat(String(body.vlrcache || 0).replace(',', '.')) || 0;
            const vlrTransp = parseFloat(String(body.vlrtransporte || 0).replace(',', '.')) || 0;
            const vlrAlim = parseFloat(String(body.vlralimentacao || 0).replace(',', '.')) || 0;
            const vlrAjuste = parseFloat(String(body.vlrajustecusto || 0).replace(',', '.')) || 0;
            const vlrCaixinha = parseFloat(String(body.vlrcaixinha || 0).replace(',', '.')) || 0;

            let total = 0, totalCache = 0, totalAjdCusto = 0;
            datasevento.forEach(dStr => {
                const d = new Date(dStr + 'T12:00:00');
                const isFDS = d.getDay() === 0 || d.getDay() === 6;
                if (body.statuscustofechado === 'Autorizado') {
                    total += vlrCusto + vlrTransp + vlrAlim;
                    totalCache += vlrCusto; totalAjdCusto += vlrTransp + vlrAlim;
                } else {
                    if (perfil === 'interno' || perfil === 'externo') {
                        total += vlrTransp + vlrAlim; totalAjdCusto += vlrTransp + vlrAlim;
                        if (isFDS) { total += vlrCusto; totalCache += vlrCusto; }
                    } else {
                        total += vlrCusto + vlrTransp + vlrAlim;
                        totalCache += vlrCusto; totalAjdCusto += vlrTransp + vlrAlim;
                    }
                }
            });
            if (body.statusajustecusto === 'Autorizado') { total += vlrAjuste; totalCache += vlrAjuste; }
            if (body.statuscaixinha === 'Autorizado') { total += vlrCaixinha; }
            const aplicarAdicionais = (lista, divisor) => {
                lista.forEach(item => { if (item.status === 'Autorizado') { const extra = vlrCusto / divisor; total += extra + vlrAlim; totalCache += extra + vlrAlim; } });
            };
            aplicarAdicionais(dtdiariadobrada, 1); aplicarAdicionais(dtmeiadiaria, 2);

            // 3. UPDATE PRINCIPAL STAFFEVENTOS
            await client.query(`
                UPDATE staffeventos SET
                    idfuncionario = $1, nmfuncionario = $2, idfuncao = $3, nmfuncao = $4,
                    idcliente = $5, nmcliente = $6, idevento = $7, nmevento = $8, idmontagem = $9,
                    nmlocalmontagem = $10, pavilhao = $11, vlrcache = $12, vlrajustecusto = $13, vlrtransporte = $14,
                    vlralimentacao = $15, vlrcaixinha = $16, descajustecusto = $17, datasevento = $18, 
                    vlrtotal = $19, descbeneficios = $20, setor = $21, statuspgto = $22, statusajustecusto = $23,
                    statuscaixinha = $24, statusdiariadobrada = $25, statusmeiadiaria = $26, dtdiariadobrada = $27, 
                    dtmeiadiaria = $28, desccaixinha = $29, descdiariadobrada = $30, descmeiadiaria = $31,
                    comppgtocache = $32, comppgtoajdcusto = $33, comppgtoajdcusto50 = $34, comppgtocaixinha = $35, 
                    nivelexperiencia = $36, qtdpessoaslote = $37, idequipe = $38, nmequipe = $39, tipoajudacustoviagem = $40,
                    statuspgtoajdcto = $41, statuspgtocaixinha = $42, idorcamento = $43, vlrtotcache = $44, vlrtotajdcusto = $45, 
                    statuscustofechado = $46, desccustofechado = $47, obspospgto = $48
                WHERE idstaffevento = $49 
                AND EXISTS (SELECT 1 FROM staffempresas sme WHERE sme.idstaff = staffeventos.idstaff AND sme.idempresa = $50)`,
                [
                    body.idfuncionario, body.nmfuncionario, body.idfuncao, body.nmfuncao,
                    body.idcliente, body.nmcliente, body.idevento, body.nmevento, body.idmontagem,
                    body.nmlocalmontagem, body.pavilhao, vlrCusto, vlrAjuste, vlrTransp, vlrAlim, vlrCaixinha,
                    body.descajustecusto, JSON.stringify(datasevento), total, body.descbeneficios, body.setor,
                    body.statuspgto, body.statusajustecusto, body.statuscaixinha, body.statusdiariadobrada,
                    body.statusmeiadiaria, JSON.stringify(dtdiariadobrada), JSON.stringify(dtmeiadiaria),
                    body.desccaixinha, body.descdiariadobrada, body.descmeiadiaria,
                    body.comppgtocache, body.comppgtoajdcusto, body.comppgtoajdcusto50, body.comppgtocaixinha,
                    body.nivelexperiencia, body.qtdpessoas || 0, body.idequipe, body.nmequipe, body.tipoajudacustoviagem,
                    body.statuspgtoajdcto, body.statuspgtocaixinha, body.idorcamento, totalCache, totalAjdCusto,
                    body.statuscustofechado, body.desccustofechado, body.obspospgto, idStaffEvento, idempresa
                ]
            );

            // 4. SINCRONIZAÇÃO DE SOLICITAÇÕES
            const itensFinanceiros = [
                { status: body.statuscaixinha, campo: 'statuscaixinha', valor: vlrCaixinha, desc: body.desccaixinha, tipo: 'Caixinha' },
                { status: body.statusajustecusto, campo: 'statusajustecusto', valor: vlrAjuste, desc: body.descajustecusto, tipo: 'Ajuste de Custo' },
                { status: body.statuscustofechado, campo: 'statuscustofechado', valor: vlrCusto, desc: body.desccustofechado, tipo: 'Cachê Fechado' },
                { status: body.statusdiariadobrada, campo: 'statusdiariadobrada', valor: 0, desc: body.descdiariadobrada, tipo: 'Diária Dobrada', datas: dtdiariadobrada },
                { status: body.statusmeiadiaria, campo: 'statusmeiadiaria', valor: 0, desc: body.descmeiadiaria, tipo: 'Meia Diária', datas: dtmeiadiaria }
            ];

            for (const item of itensFinanceiros) {
                if (item.campo === 'statusdiariadobrada' || item.campo === 'statusmeiadiaria') {
                    for (const entrada of item.datas) {
                        const statusDec = (entrada.status || '').trim();
                        if (!entrada.data || !statusDec) continue;

                        // CORREÇÃO: Usando o operador ANY para comparar data com array de datas (date[])
                        const updateRes = await client.query(
                            `UPDATE public.solicitacoes 
                             SET status = $1::varchar, 
                                 dtresposta = CASE WHEN $1::varchar = 'Pendente' THEN NULL ELSE CURRENT_TIMESTAMP END, 
                                 idusuarioresponsavel = CASE WHEN $1::varchar = 'Pendente' THEN NULL ELSE $2::integer END
                             WHERE idregistroalterado = $3::integer 
                               AND categoria_log = $4::varchar 
                               AND idempresa = $5::integer 
                               AND $6::date = ANY(dtsolicitada)`, 
                            [statusDec, idUsuarioLogado, idStaffEvento, item.campo, idempresa, entrada.data]
                        );

                        if (updateRes.rowCount === 0 && ['Pendente', 'Autorizado'].includes(statusDec)) {
                            // No INSERT, passamos a data dentro de um array literal do Postgres para bater com date[]
                            await client.query(`
                                INSERT INTO public.solicitacoes (
                                    idorcamento, idregistroalterado, idfuncionario, idfuncao, idempresa, 
                                    tiposolicitacao, status, dtsolicitacao, idusuariosolicitante, 
                                    categoria_log, justificativa, dtsolicitada
                                ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, $8, $9, $10, ARRAY[$11]::date[])`,
                                [body.idorcamento, idStaffEvento, body.idfuncionario, body.idfuncao, idempresa,
                                 item.tipo, statusDec, idUsuarioLogado, item.campo, item.desc, entrada.data]
                            );
                        }
                    }
                } else {
                    const updateRes = await client.query(
                        `UPDATE public.solicitacoes 
                         SET status = $1::varchar, 
                             dtresposta = CASE WHEN $1::varchar = 'Pendente' THEN NULL ELSE CURRENT_TIMESTAMP END, 
                             idusuarioresponsavel = CASE WHEN $1::varchar = 'Pendente' THEN NULL ELSE $2::integer END,
                             vlrsolicitado = $3, justificativa = $4::text
                         WHERE idregistroalterado = $5::integer AND categoria_log = $6::varchar AND idempresa = $7::integer`,
                        [item.status, idUsuarioLogado, item.valor, item.desc, idStaffEvento, item.campo, idempresa]
                    );

                    if (updateRes.rowCount === 0 && ['Pendente', 'Autorizado'].includes(item.status)) {
                        // Certifique-se que a função registrarSolicitacao trata dtsolicitada como array se necessário
                        await registrarSolicitacao(client, {
                            idempresa, idorcamento: body.idorcamento, idfuncionario: body.idfuncionario,
                            idfuncao: body.idfuncao, idstaffevento: idStaffEvento, idusuariosolicitante: idUsuarioLogado,
                            tiposolicitacao: item.tipo, categoria: item.campo, vlrsolicitado: item.valor, justificativa: item.desc
                        });
                    }
                }
            }

            await client.query('COMMIT');
            res.json({ message: "Atualizado", id: idStaffEvento });
        } catch (e) {
            if (client) await client.query('ROLLBACK');
            console.error("❌ Erro no PUT Staff:", e);
            res.status(500).json({ error: e.message });
        } finally { if (client) client.release(); }
    }

);


async function registrarSolicitacao(client, dados) {
    const formatarParaJsonB = (valor) => {
        if (!valor) return null;
        if (typeof valor === 'object') return JSON.stringify(valor);
        return valor; // Se já for string, o driver do pg lida com o cast ::jsonb
    };

    // Ajustamos a ordem para refletir exatamente os dados.
    // Importante: Justificativa costuma ser TEXT, dtsolicitada é que é JSONB (as datas).
    const query = `
        INSERT INTO public.solicitacoes (
            idempresa,              -- $1
            idorcamento,            -- $2
            idfuncionario,          -- $3
            idfuncao,               -- $4
            idregistroalterado,     -- $5
            idusuariosolicitante,   -- $6
            tiposolicitacao,        -- $7
            categoria_log,          -- $8
            vlrsolicitado,          -- $9
            justificativa,          -- $10
            dtsolicitada,           -- $11 (O campo JSONB com as datas)
            status,                 -- $12
            dtsolicitacao           -- Automático
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, NOW())
        ON CONFLICT (idregistroalterado, categoria_log) 
        WHERE status = 'Pendente' AND idregistroalterado IS NOT NULL
        DO UPDATE SET 
            vlrsolicitado = EXCLUDED.vlrsolicitado,
            justificativa = EXCLUDED.justificativa,
            dtsolicitada = EXCLUDED.dtsolicitada,
            dtsolicitacao = CURRENT_TIMESTAMP;
    `;

    const values = [
        dados.idempresa,                // $1
        dados.idorcamento,              // $2
        dados.idfuncionario || null,    // $3
        dados.idfuncao,                 // $4
        dados.idstaffevento || null,    // $5
        dados.idusuario,                // $6
        dados.tiposolicitacao,          // $7
        dados.categoria,                // $8
        dados.valor || 0,               // $9
        dados.justificativa,            // $10 (Texto comum)
        formatarParaJsonB(dados.datas), // $11 (JSONB - datas selecionadas)
        'Pendente'                      // $12
    ];

    await client.query(query, values);
}

function ordenarDatas(datas) {
    if (!datas || datas.length === 0) {
    return [];
    }
    // Supondo que as datas estejam no formato 'YYYY-MM-DD'
    return datas.sort((a, b) => new Date(a) - new Date(b));
}


router.post("/", autenticarToken(), contextoEmpresa, verificarPermissao('staff', 'cadastrar'), 
    uploadComprovantesMiddleware, 
    logMiddleware('staffeventos', { 
        buscarDadosAnteriores: async () => ({ dadosanteriores: null, idregistroalterado: null }) 
    }), async (req, res) => {
    
    // 1. No cadastro (POST /), não existe idStaffEvento nos params ainda.
    const idUsuarioLogado = req.usuario.idusuario;
    const body = req.body;
    const idempresa = req.idempresa;

    const {
        idfuncionario, nmfuncionario, idevento, nmevento, idcliente, nmcliente,
        idfuncao, nmfuncao, idmontagem, nmlocalmontagem, pavilhao,
        vlrcache, vlralimentacao, vlrtransporte, vlrajustecusto,
        vlrcaixinha, datasevento, descajustecusto, descbeneficios, vlrtotal, setor,
        statuspgto, statusajustecusto, statuscaixinha, statusdiariadobrada, statusmeiadiaria,
        datadiariadobrada, datameiadiaria, desccaixinha, descdiariadobrada, descmeiadiaria,
        nivelexperiencia, qtdpessoas, idequipe, nmequipe, tipoajudacustoviagem,
        statuspgtoajdcto, statuspgtocaixinha, idorcamento,
        vlrtotcache, vlrtotajdcusto, statuscustofechado, desccustofechado, obspospgto
    } = req.body;

    let client;

    try {
        client = await pool.connect();
        await client.query('BEGIN');

        // 2. Tratamento das datas (converte string do FormData para Array)
        let datasArray = [];
        try {
            datasArray = Array.isArray(datasevento) ? datasevento : JSON.parse(datasevento || "[]");
        } catch (e) { datasArray = []; }

        // --- [SUA VALIDAÇÃO DE LIMITE DE ORÇAMENTO AQUI] ---

        // 3. Verificar/Criar Staff (Tabela Base)
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

        // 4. Inserir na staffeventos
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
                statuspgtoajdcto, idorcamento, vlrtotcache, vlrtotajdcusto, statuscustofechado, desccustofechado, obspospgto
            ) VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44,$45,$46,$47,$48,$49
            ) RETURNING idstaffevento;
        `;

        const values = [
            idstaffExistente, idfuncionario, nmfuncionario, idevento, nmevento, idcliente, nmcliente,
            idfuncao, nmfuncao, idmontagem, nmlocalmontagem, pavilhao,
            parseFloatOrNull(vlrcache), parseFloatOrNull(vlralimentacao),
            parseFloatOrNull(vlrtransporte), parseFloatOrNull(vlrajustecusto), parseFloatOrNull(vlrcaixinha),
            descajustecusto, JSON.stringify(datasArray), parseFloatOrNull(vlrtotal),
            req.files?.comppgtocache?.[0] ? `/uploads/staff_comprovantes/${req.files.comppgtocache[0].filename}` : null,
            req.files?.comppgtoajdcusto?.[0] ? `/uploads/staff_comprovantes/${req.files.comppgtoajdcusto[0].filename}` : null,
            req.files?.comppgtocaixinha?.[0] ? `/uploads/staff_comprovantes/${req.files.comppgtocaixinha[0].filename}` : null,
            descbeneficios, setor, statuspgto, statusajustecusto, statuscaixinha, statusdiariadobrada,
            statusmeiadiaria, datadiariadobrada,
            req.files?.comppgtoajdcusto50?.[0] ? `/uploads/staff_comprovantes/${req.files.comppgtoajdcusto50[0].filename}` : null,
            datameiadiaria, desccaixinha, descdiariadobrada, descmeiadiaria, nivelexperiencia, qtdpessoas,
            idequipe, nmequipe, tipoajudacustoviagem, statuspgtocaixinha, statuspgtoajdcto, idorcamento,
            parseFloatOrNull(vlrtotcache), parseFloatOrNull(vlrtotajdcusto), statuscustofechado, desccustofechado, obspospgto
        ];

        const resIns = await client.query(queryInsert, values);
        const novoIdStaffEvento = resIns.rows[0].idstaffevento;

        // 5. REGISTRAR SOLICITAÇÕES FINANCEIRAS (Se houver campos pendentes)
        const itensFinanceiros = [
            { status: body.statuscaixinha, campo: 'statuscaixinha', valor: body.vlrcaixinha, desc: body.desccaixinha, tipo: 'Caixinha' },
            { status: body.statusajustecusto, campo: 'statusajustecusto', valor: body.vlrajustecusto, desc: body.descajustecusto, tipo: 'Ajuste de Custo' },
            { status: body.statuscustofechado, campo: 'statuscustofechado', valor: body.vlrcache, desc: body.desccustofechado, tipo: 'Cachê Fechado' },
            { status: body.statusdiariadobrada, campo: 'statusdiariadobrada', valor: 0, desc: body.descdiariadobrada, tipo: 'Diária Dobrada', datas: body.datadiariadobrada },
            { status: body.statusmeiadiaria, campo: 'statusmeiadiaria', valor: 0, desc: body.descmeiadiaria, tipo: 'Meia Diária', datas: body.datameiadiaria }
        ];

        for (const item of itensFinanceiros) {
            if (item.status === 'Pendente') {
                await registrarSolicitacao(client, {
                    idempresa,
                    idorcamento: body.idorcamento,
                    idfuncionario: body.idfuncionario,
                    idfuncao: body.idfuncao,
                    idstaffevento: novoIdStaffEvento, // Usa o ID que acabamos de criar
                    idusuario: idUsuarioLogado,
                    tiposolicitacao: item.tipo,
                    categoria: item.campo,
                    valor: parseFloatOrNull(item.valor),
                    justificativa: item.desc,
                    datas: item.datas ? (typeof item.datas === 'string' ? JSON.parse(item.datas) : item.datas) : null
                });
            }
        }

        await client.query('COMMIT');

        res.locals.acao = 'cadastrou';
        res.locals.idregistroalterado = resIns.rows[0].idstaffevento;
        res.locals.dadosnovos = {...req.body,
            idstaffevento: resIns.rows[0].idstaffevento,
            ...req.body, // 👈 Isso espalha TODAS as informações enviadas no corpo da requisição
            datasevento: datasArray, // Garante o array tratado e não a string crua do FormData
            comprovantes: { // Salva os caminhos exatos dos arquivos gerados, se existirem
                comppgtocache: req.files?.comppgtocache?.[0] ? `/uploads/staff_comprovantes/${req.files.comppgtocache[0].filename}` : null,
                comppgtoajdcusto: req.files?.comppgtoajdcusto?.[0] ? `/uploads/staff_comprovantes/${req.files.comppgtoajdcusto[0].filename}` : null,
                comppgtocaixinha: req.files?.comppgtocaixinha?.[0] ? `/uploads/staff_comprovantes/${req.files.comppgtocaixinha[0].filename}` : null,
                comppgtoajdcusto50: req.files?.comppgtoajdcusto50?.[0] ? `/uploads/staff_comprovantes/${req.files.comppgtoajdcusto50[0].filename}` : null
            }
        };

        res.status(201).json({ sucesso: true, message: "Sucesso", idstaffevento: novoIdStaffEvento });

    } catch (e) {
        if (client) await client.query('ROLLBACK');
        console.error("Erro ao salvar staff:", e);
        res.status(500).json({ sucesso: false, error: e.message });
    } finally { 
        if (client) client.release(); 
    }
});


// router.post('/aditivoextra/solicitacao', 
//   autenticarToken(), 
//   contextoEmpresa, 
//   verificarPermissao('staff', 'cadastrar'), 

//   logMiddleware('aditivoextra', { 
//     buscarDadosAnteriores: async (req) => {
//       return { dadosanteriores: null, idregistroalterado: null };
//     }
//   }),

//   async (req, res) => {
//     console.log("🔥 Rota /staff/aditivoextra/solicitacao acessada", req.body);

//     const { 
//       idOrcamento, 
//       idFuncao, 
//       qtdSolicitada, 
//       tipoSolicitacao, 
//       justificativa, 
//       idFuncionario,
//       dataSolicitada,
//       idEventoSolicitado,    
//       idEventoConflitante    
      
//     } = req.body; 

//     const idEmpresaContexto = req.empresa?.idempresa || req.idempresa;
//     const idUsuarioSolicitante = req.usuario?.idusuario; 
//     const statusInicial = 'Pendente';

//    const dataParaBanco = (dataSolicitada && dataSolicitada !== 'undefined' && String(dataSolicitada).trim() !== "") 
//     ? dataSolicitada.split(',').map(d => d.trim()) 
//     : null;

    

//     // Se idEvento vier como um objeto vazio {} como mostra o seu log, tratamos também
//     // const idEventoTratado = (typeof idEvento === 'object' && Object.keys(idEvento).length === 0) || idEvento === '' 
//     //     ? null 
//     //     : idEvento;

//     const idFuncionarioTratado = (idFuncionario === '' || idFuncionario === 'undefined') ? null : idFuncionario;

//     const idEventoSolicitadoTratado = (idEventoSolicitado === '' || idEventoSolicitado === 'undefined' || idEventoSolicitado == null) ? null : idEventoSolicitado;
//     const idEventoConflitanteTratado = (idEventoConflitante === '' || idEventoConflitante === 'undefined' || idEventoConflitante == null) ? null : idEventoConflitante;

//     // 1. Validações de Contexto
//     if (!idUsuarioSolicitante || !idEmpresaContexto) {
//         return res.status(401).json({ 
//             sucesso: false, 
//             erro: "Usuário ou Empresa não identificados no contexto da requisição." 
//         });
//     }

//     // 2. Validação de Campos Obrigatórios
//     let campoFaltante = null;
//     if (!idOrcamento) campoFaltante = 'idOrcamento';
//     else if (!idFuncao) campoFaltante = 'idFuncao';
//     else if (!qtdSolicitada) campoFaltante = 'qtdSolicitada';
//     else if (!tipoSolicitacao) campoFaltante = 'tipoSolicitacao';
//     else if (!justificativa) campoFaltante = 'justificativa';
    

//     if (campoFaltante) { 
//         return res.status(400).json({ 
//             sucesso: false,
//             erro: `O campo obrigatório **${campoFaltante}** está faltando.` 
//         });
//     }

//     // // 3. Tratamento da Data (Crucial para evitar o erro de undefined)
//     // const dataTratada = Array.isArray(dataSolicitada) ? dataSolicitada[0] : dataSolicitada;
//     // const dataParaBanco = (dataTratada && dataTratada !== 'undefined' && String(dataTratada).trim() !== "") 
//     //     ? dataTratada 
//     //     : null;

//     // 4. Verificação de Duplicidade (CORRIGIDA)
//     try {
//         const checkDuplicidade = await pool.query(`
//             SELECT idAditivoExtra FROM AditivoExtra 
//             WHERE idOrcamento = $1 
//               AND idFuncionario = $2 
//               AND idFuncao = $3 
//               AND tipoSolicitacao = $4 
//               --AND (dtsolicitada = $5 OR (dtsolicitada IS NULL AND $5 IS NULL))
//               AND (dtsolicitada = ANY($5::date[]) OR (dtsolicitada IS NULL AND $5 IS NULL))
//               AND idEmpresa = $6
//               AND status = 'Pendente'
//         `, [idOrcamento, idFuncionario, idFuncao, tipoSolicitacao, dataParaBanco, idEmpresaContexto]);

//         if (checkDuplicidade.rows.length > 0) {
//             return res.status(409).json({ 
//                 sucesso: false, 
//                 erro: "Já existe uma solicitação pendente idêntica para este funcionário." 
//             });
//         }

//         // 5. Inserção no Banco
//         const queryInsert = `
//             INSERT INTO AditivoExtra (
//               idOrcamento, idFuncao, idEmpresa, tipoSolicitacao, 
//               qtdSolicitada, justificativa, idUsuarioSolicitante,
//               status, idFuncionario, dtSolicitada, ideventosolicitado, ideventoconflitante
//             )
//             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
//             RETURNING idAditivoExtra;
//         `;

//         const values = [
//           idOrcamento, 
//           idFuncao, 
//           idEmpresaContexto, 
//           tipoSolicitacao, 
//           qtdSolicitada, 
//           justificativa, 
//           idUsuarioSolicitante,
//           statusInicial,
//           idFuncionarioTratado || null,
//           dataParaBanco,
//           idEventoSolicitadoTratado,
//           idEventoConflitanteTratado
//         ];

//         const resultado = await pool.query(queryInsert, values);
//         const idAditivoExtra = resultado.rows[0].idaditivoextra;

//         // Log de Auditoria
//         if (req.logData && logMiddleware.salvarLog) {
//           req.logData.idregistroalterado = idAditivoExtra;
//           await logMiddleware.salvarLog(req.logData); 
//         }

//         res.locals.acao = 'cadastrou';
//         res.locals.idregistroalterado = idAditivoExtra;
//         res.locals.dadosnovos = { // ❌ Estava faltando
//             idAditivoExtra,
//             idOrcamento,
//             idFuncao,
//             tipoSolicitacao,
//             qtdSolicitada,
//             justificativa,
//             idFuncionario: idFuncionarioTratado,
//             dataSolicitada: dataParaBanco,
//             idEventoSolicitado: idEventoSolicitadoTratado,
//             idEventoConflitante: idEventoConflitanteTratado,
//             status: statusInicial
//         };

//         res.status(201).json({ 
//           sucesso: true, 
//           mensagem: `Solicitação salva com sucesso.`,
//           idAditivoExtra: idAditivoExtra
//         });

//     } catch (error) {
//         console.error("❌ Erro ao processar AditivoExtra:", error.message);
//         res.status(500).json({ 
//             sucesso: false, 
//             erro: "Erro interno ao processar a solicitação.",
//             detalhe: error.message 
//         });
//     }
// });

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
      idOrcamento, idFuncao, qtdSolicitada, tipoSolicitacao, 
      justificativa, idFuncionario, dataSolicitada, idregistroalterado,
      idEventoSolicitado, idEventoConflitante, vlrSolicitado, categoria_log
    } = req.body; 

    const idEmpresaContexto = req.empresa?.idempresa || req.idempresa;
    const idUsuarioSolicitante = req.usuario?.idusuario; 
    const statusInicial = 'Pendente';

//    const dataParaBanco = (dataSolicitada && dataSolicitada !== 'undefined' && String(dataSolicitada).trim() !== "") 
//       ? JSON.stringify(dataSolicitada.split(',').map(d => d.trim()))
//       : null;

    // const dataParaBanco = (dataSolicitada && String(dataSolicitada).trim() !== "" && dataSolicitada !== 'undefined') 
    //     ? JSON.stringify(dataSolicitada.split(',').map(d => d.trim()))
    //     : null;

    // Remova o JSON.stringify. O driver 'pg' converte arrays JS em arrays Postgres automaticamente.
   // O driver 'pg' converte automaticamente ['2026-04-01'] para {2026-04-01}
    const dataParaBanco = (dataSolicitada && String(dataSolicitada).trim() !== "" && dataSolicitada !== 'undefined') 
        ? dataSolicitada.split(',').map(d => d.trim()) 
        : null;

    const idFuncionarioTratado = (idFuncionario === '' || idFuncionario === 'undefined') ? null : idFuncionario;
    const idEventoSolicitadoTratado = (!idEventoSolicitado || idEventoSolicitado === 'undefined') ? null : idEventoSolicitado;
    const idEventoConflitanteTratado = (!idEventoConflitante || idEventoConflitante === 'undefined') ? null : idEventoConflitante;

    if (!idUsuarioSolicitante || !idEmpresaContexto) {
      return res.status(401).json({ sucesso: false, erro: "Usuário ou Empresa não identificados." });
    }

    let campoFaltante = null;
    if (!idOrcamento) campoFaltante = 'idOrcamento';
    else if (!idFuncao) campoFaltante = 'idFuncao';
    else if (!qtdSolicitada && !vlrSolicitado) campoFaltante = 'qtdSolicitada ou vlrSolicitado';
    else if (!tipoSolicitacao) campoFaltante = 'tipoSolicitacao';
    else if (!justificativa) campoFaltante = 'justificativa';

    if (campoFaltante) { 
      return res.status(400).json({ sucesso: false, erro: `O campo obrigatório **${campoFaltante}** está faltando.` });
    }

    // // 3. Tratamento da Data (Crucial para evitar o erro de undefined)
    // const dataTratada = Array.isArray(dataSolicitada) ? dataSolicitada[0] : dataSolicitada;
    // const dataParaBanco = (dataTratada && dataTratada !== 'undefined' && String(dataTratada).trim() !== "") 
    //     ? dataTratada 
    //     : null;

    // 4. Verificação de Duplicidade (CORRIGIDA)
    try {
        // const checkDuplicidade = await pool.query(`
        //     SELECT idAditivoExtra FROM AditivoExtra 
        //     WHERE idOrcamento = $1 
        //       AND idFuncionario = $2 
        //       AND idFuncao = $3 
        //       AND tipoSolicitacao = $4 
        //       --AND (dtsolicitada = $5 OR (dtsolicitada IS NULL AND $5 IS NULL))
        //       --AND (dtsolicitada = ANY($5::date[]) OR (dtsolicitada IS NULL AND $5 IS NULL))
        //       --AND (dtsolicitada && $5::date[] OR (dtsolicitada IS NULL AND $5 IS NULL))
        //       AND (dtsolicitada::jsonb = $5::jsonb OR (dtsolicitada IS NULL AND $5 IS NULL))
        //       AND idEmpresa = $6
        //       AND status = 'Pendente'
        // `, [idOrcamento, idFuncionario, idFuncao, tipoSolicitacao, dataParaBanco, idEmpresaContexto]);

        const checkDuplicidade = await pool.query(`
            SELECT idsolicitacao FROM solicitacoes 
            WHERE idOrcamento = $1 
            AND (idFuncionario = $2 OR (idFuncionario IS NULL AND $2 IS NULL))
            AND idFuncao = $3 
            AND tipoSolicitacao = $4 
            -- Comparação de Arrays nativos
            AND (dtsolicitada = $5::date[] OR (dtsolicitada IS NULL AND $5 IS NULL))
            AND idEmpresa = $6
            AND idregistroalterado = $7
            AND status = 'Pendente'
        `, [idOrcamento, idFuncionarioTratado, idFuncao, tipoSolicitacao, dataParaBanco, idEmpresaContexto, idregistroalterado]);

      if (checkDuplicidade.rows.length > 0) {
        return res.status(409).json({ sucesso: false, erro: "Solicitação Duplicada:Já existe uma solicitação pendente idêntica." });
      }

      // ✅ INSERT na tabela solicitacoes
      // 1. A QUERY (Ajustada com as vírgulas que faltavam e ordem lógica)
        // const queryInsert = `
        //     INSERT INTO public.solicitacoes (
        //         idorcamento,            -- $1
        //         idfuncionario,          -- $2
        //         idfuncao,               -- $3
        //         idempresa,              -- $4
        //         tiposolicitacao,        -- $5
        //         qtdsolicitada,          -- $6
        //         vlrsolicitado,          -- $7
        //         status,                 -- $8
        //         justificativa,          -- $9
        //         idusuariosolicitante,   -- $10
        //         dtsolicitada,           -- $11
        //         ideventosolicitado,     -- $12
        //         ideventoconflitante,    -- $13
        //         categoria_log,          -- $14
        //         dtsolicitacao           -- (Automático pelo Banco se omitido, ou use DEFAULT)
        //     )
        //     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13, $14)
        //     RETURNING idsolicitacao;
        // `;

        const queryInsert = `
            INSERT INTO public.solicitacoes (
                idorcamento, idfuncionario, idfuncao, idempresa, tiposolicitacao, 
                qtdsolicitada, vlrsolicitado, status, justificativa, 
                idusuariosolicitante, dtsolicitada, ideventosolicitado, 
                ideventoconflitante, categoria_log, idregistroalterado
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::date[], $12, $13, $14, $15)
            RETURNING idsolicitacao;
        `;

        // 2. OS VALUES (Mapeados exatamente na ordem acima)
        const values = [
            idOrcamento,                        // $1
            idFuncionarioTratado || null,       // $2
            idFuncao,                           // $3
            idEmpresaContexto,                  // $4
            tipoSolicitacao,                    // $5
            qtdSolicitada || 1,                 // $6
            vlrSolicitado || 0,                 // $7
            statusInicial || 'Pendente',        // $8
            justificativa,                      // $9
            idUsuarioSolicitante,               // $10
            dataParaBanco,                      // $11 (O array de datas em formato JSON)
            idEventoSolicitadoTratado || null,  // $12
            idEventoConflitanteTratado || null, // $13
            categoria_log,                      // $14
            idregistroalterado || null          // $15 (Para vincular a um registro específico, se necessário)
        ];

      const resultado = await pool.query(queryInsert, values);
      const idSolicitacao = resultado.rows[0].idsolicitacao;

      if (req.logData && logMiddleware.salvarLog) {
        req.logData.idregistroalterado = idSolicitacao;
        await logMiddleware.salvarLog(req.logData); 
      }

      res.locals.acao = 'cadastrou';
      res.locals.idregistroalterado = idSolicitacao;
      res.locals.dadosnovos = {
        idSolicitacao, idOrcamento, idFuncao, tipoSolicitacao,
        qtdSolicitada, vlrSolicitado, justificativa,
        idFuncionario: idFuncionarioTratado,
        dataSolicitada: dataParaBanco,
        idEventoSolicitado: idEventoSolicitadoTratado,
        idEventoConflitante: idEventoConflitanteTratado,
        status: statusInicial
      };

      res.status(201).json({ 
        sucesso: true, 
        mensagem: `Solicitação salva com sucesso.`,
        idSolicitacao
      });

    } catch (error) {
      console.error("❌ Erro AditivoExtra | message:", error.message);
      console.error("❌ Erro AditivoExtra | code:", error.code);
      console.error("❌ Erro AditivoExtra | detail:", error.detail);
      
      res.status(500).json({ 
        sucesso: false, 
        erro: "Erro interno ao processar a solicitação.",
        detalhe: error.message,
        code: error.code,
        detail: error.detail
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
                    filtroData = ` AND (s.dtsolicitada && $${paramsFE.length}::date[])`;
                }

                // BUSCA 1: Solicitação IDÊNTICA (mesmo evento + mesma função + mesma data)
                // Para bloquear completamente
                const paramsDuplicata = [...paramsFE];
                let filtroDuplicata = filtroData;

                if (idEventoSolicitado) {
                    paramsDuplicata.push(idEventoSolicitado);
                    filtroDuplicata += ` AND s.ideventosolicitado = $${paramsDuplicata.length}`;
                }
                if (idFuncao) {
                    paramsDuplicata.push(idFuncao);
                    filtroDuplicata += ` AND s.idfuncao = $${paramsDuplicata.length}`;
                }

                const queryDuplicata = `
                    SELECT s.*, f.nome AS "nmfuncionariodono",
                    e.nmevento AS "nmeventosolicitado" 
                    FROM solicitacoes s
                    LEFT JOIN funcionarios f ON s.idfuncionario = f.idfuncionario        
                    LEFT JOIN eventos e ON e.idevento = s.ideventosolicitado
                    WHERE s.idEmpresa = $1
                    AND s.idfuncionario = $2
                    AND s.tipoSolicitacao ILIKE '%FuncExcedido%'
                    AND s.status = 'Pendente'
                    AND s.ideventosolicitado IS NOT NULL   
                    ${filtroDuplicata}
                    ORDER BY s.dtSolicitacao DESC LIMIT 1
                `;

                const resultDuplicata = await pool.query(queryDuplicata, paramsDuplicata);
                const solicitacaoDuplicada = resultDuplicata.rows[0] || null;

                // BUSCA 2: Qualquer solicitação na mesma data (mesmo que evento diferente)
                // Para avisar que existe outra pendente
                const queryGeral = `
                    SELECT s.*, f.nome AS "nmfuncionariodono",
                    ev.nmevento AS "nmeventosolicitado"
                    FROM solicitacoes s
                    LEFT JOIN funcionarios f ON s.idfuncionario = f.idfuncionario
                    LEFT JOIN eventos ev ON ev.idevento = s.ideventosolicitado
                    WHERE s.idEmpresa = $1
                    AND s.idfuncionario = $2
                    AND s.tipoSolicitacao ILIKE '%FuncExcedido%'
                    AND s.status IN ('Pendente', 'Autorizado')
                    ${filtroData}
                    ORDER BY s.dtSolicitacao DESC LIMIT 1
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
                filtroTipo = "AND UPPER(s.tipoSolicitacao) IN ('ADITIVO - VAGA EXCEDIDA', 'EXTRA BONIFICADO - VAGA EXCEDIDA')";
            } else if (tipoSolicitacao === 'QUALQUER_DATA') {
                filtroTipo = "AND (UPPER(s.tipoSolicitacao) LIKE '%DATA%FORA%ORÇAMENTO%')";
            } else if (tipoSolicitacao === 'QUALQUER_FUNC') {
                filtroTipo = "AND s.tipoSolicitacao ILIKE '%FuncExcedido%'";
            } else {
                filtroTipo = "AND UPPER(s.tipoSolicitacao) = UPPER($4)";
                params.push(tipoSolicitacao);
            }

            let filtroData = "";
            if (dataSolicitada && dataSolicitada !== 'undefined' && dataSolicitada !== '') {
                const dataIndex = params.length + 1;
                const arrayDatas = dataSolicitada.split(',').map(d => d.trim());
                filtroData = ` AND (s.dtsolicitada && $${dataIndex}::date[] OR s.dtsolicitada IS NULL)`;
                params.push(arrayDatas);
            }

            let filtroEvento = "";
            if (idEventoSolicitado || idEventoConflitante) {
                const idxEvento = params.length + 1;
                filtroEvento = `AND (s.ideventosolicitado = $${idxEvento} OR s.ideventoconflitante = $${idxEvento})`;
                params.push(idEventoSolicitado || idEventoConflitante);
            }

            const solicitacaoQuery = `
                SELECT s.*, f.nome AS "nmfuncionariodono"
                FROM solicitacoes s
                LEFT JOIN funcionarios f ON s.idfuncionario = f.idfuncionario
                WHERE s.idOrcamento = $1 AND s.idFuncao = $2 AND s.idEmpresa = $3
                ${filtroTipo}
                ${filtroData}
                ${filtroEvento}
                ORDER BY s.dtSolicitacao DESC LIMIT 1;
            `;
            const solicitacaoResult = await pool.query(solicitacaoQuery, params);
            const solicitacaoRecente = solicitacaoResult.rows[0] || null;

            let autorizadoEspecifico = false;
            if (idFuncionario && idFuncionario !== 'undefined') {
                let paramsCheck = [idOrcamento, idFuncao, idFuncionario, idEmpresa];
                let filtroTipoCheck = "";

                if (tipoSolicitacao === 'QUALQUER_VAGA') {
                    filtroTipoCheck = "AND UPPER(s.tipoSolicitacao) IN ('ADITIVO - VAGA EXCEDIDA', 'EXTRA BONIFICADO - VAGA EXCEDIDA')";
                } else if (tipoSolicitacao === 'QUALQUER_DATA') {
                    filtroTipoCheck = "AND (UPPER(s.tipoSolicitacao) LIKE '%DATA%FORA%ORÇAMENTO%')";
                } else {
                    filtroTipoCheck = "AND UPPER(s.tipoSolicitacao) = UPPER($5)";
                    paramsCheck.push(tipoSolicitacao);
                }

                let filtroDataCheck = "";
                if (dataSolicitada && dataSolicitada !== 'undefined' && dataSolicitada !== '') {
                    const idxD = paramsCheck.length + 1;
                    const listaDatasCheck = dataSolicitada.split(',').map(d => d.trim());
                    filtroDataCheck = ` AND (s.dtsolicitada && $${idxD}::date[] OR s.dtsolicitada IS NULL)`;
                    paramsCheck.push(listaDatasCheck);
                }

                const checkQuery = `
                    SELECT s.status, s.tipoSolicitacao
                    FROM solicitacoes s 
                    WHERE s.idOrcamento = $1 
                    AND s.idFuncao = $2 
                    AND s.idFuncionario = $3 
                    AND s.idEmpresa = $4
                    AND s.status IN ('Autorizado', 'Aprovado', 'Pendente', 'Em Análise')
                    ${filtroTipoCheck} 
                    ${filtroDataCheck}
                    ORDER BY s.dtSolicitacao DESC LIMIT 1
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
                SELECT COALESCE(SUM(qtdSolicitada), 0) AS total FROM solicitacoes 
                WHERE idOrcamento = $1 AND idFuncao = $2 AND idEmpresa = $3 AND status = 'Autorizado' AND tipoSolicitacao ILIKE '%Aditivo%'
            `, [idOrcamento, idFuncao, idEmpresa]);

            const extraResult = await pool.query(`
                SELECT COALESCE(SUM(qtdSolicitada), 0) AS total FROM solicitacoes 
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