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
    { name: 'comppgtoajdcusto50', maxCount: 1 },
    { name: 'compcontrolegastos', maxCount: 1 }
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
      `SELECT func.*, s.avaliacao FROM funcionarios func
      INNER JOIN funcionarioempresas funce ON funce.idfuncionario = func.idfuncionario
      INNER JOIN staff s ON s.idfuncionario = func.idfuncionario
      WHERE funce.idempresa = $1 AND func.ativo = 'true' ORDER BY func.nome ASC`,
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
            ignorarFiltroData = false
        } = req.body;

        const idempresa = req.idempresa;

        console.log("ORCAMENTO/CONSULTAR", req.body);

        if (!ignorarFiltroData && (!Array.isArray(datasEvento) || datasEvento.length === 0)) {
            return res.status(400).json({ error: "O array de datas é obrigatório." });
        }

          if (!idEvento || !idLocalMontagem || !idFuncao) {
        return res.status(400).json({ 
            error: "Evento, Local e Função são obrigatórios." 
        });
    }

        if (!Array.isArray(datasEvento) || datasEvento.length === 0) {
            return res.status(400).json({ error: "O array de datas é obrigatório para a pesquisa." });
        }        

        const query = `WITH datas_orcamento AS (
                    SELECT
                        oi.idorcamentoitem,
                        ARRAY(
                            SELECT * FROM gerar_periodo_diarias(oi.periododiariasinicio, oi.periododiariasfim)
                        ) AS periodos_disponiveis
                    FROM orcamentoitens oi
                    WHERE oi.idorcamentoitem IS NOT NULL
                ),
                diarias_por_funcao AS (
                    SELECT
                        se.idorcamento,
                        se.idfuncao,
                        -- ✅ Soma datasevento + diárias dobradas Pendentes ou Autorizadas
                        SUM(jsonb_array_length(se.datasevento)) AS total
                        --+ 
                        --COALESCE(SUM((
                        --    SELECT COUNT(*)
                        --    FROM jsonb_array_elements(se.dtdiariadobrada) AS dd
                       --     WHERE (dd->>'status') IN ('Pendente', 'Autorizado')
                        --)), 0) AS total
                    FROM staffeventos se
                    WHERE se.ativo = true
                    AND se.statusstaff != 'Inativo'
                    GROUP BY se.idorcamento, se.idfuncao
                ),
                total_orcado_por_funcao AS (
                    SELECT
                        oi2.idorcamento,
                        oi2.idfuncao,
                        SUM(oi2.qtditens * oi2.qtddias) AS total
                    FROM orcamentoitens oi2
                    GROUP BY oi2.idorcamento, oi2.idfuncao
                )
                SELECT
                    o.status,
                    o.idorcamento,
                    o.contratarstaff,
                    dto.periodos_disponiveis AS datas_totais_orcadas,  -- front usa .datas_totais_orcadas.length
                    tof.total AS quantidade_orcada,                   -- d_escaladas no front (total orçado real)    
                    COALESCE(dpf.total, 0) AS quantidade_escalada,    -- pessoas distintas (mantém front)
                    COALESCE(dpf.total, 0) AS diarias_escaladas,      -- total de diárias já usadas
                                
                    oi.idfuncao,
                    f.descfuncao,
                    e.nmevento,
                    c.nmfantasia AS nmcliente,
                    lm.descmontagem AS nmlocalmontagem,
                    oi.setor
                FROM orcamentoitens oi
                JOIN orcamentos o ON oi.idorcamento = o.idorcamento
                JOIN orcamentoempresas oe ON o.idorcamento = oe.idorcamento
                LEFT JOIN funcao f ON oi.idfuncao = f.idfuncao
                LEFT JOIN eventos e ON o.idevento = e.idevento
                LEFT JOIN clientes c ON o.idcliente = c.idcliente
                LEFT JOIN localmontagem lm ON o.idmontagem = lm.idmontagem
                JOIN datas_orcamento dto ON oi.idorcamentoitem = dto.idorcamentoitem
                LEFT JOIN diarias_por_funcao dpf ON
                    dpf.idorcamento = o.idorcamento
                    AND dpf.idfuncao = oi.idfuncao
                LEFT JOIN total_orcado_por_funcao tof ON
                    tof.idorcamento = o.idorcamento
                    AND tof.idfuncao = oi.idfuncao
                WHERE
                    oe.idempresa = $1
                    AND o.idevento = $2
                    AND o.idcliente = $3
                    AND o.idmontagem = $4
                    AND o.status != 'R'
                    AND oi.idfuncao = $6
                    AND (oi.setor = $7 OR $7 IS NULL)
                    AND ($8 = true OR dto.periodos_disponiveis && $5::date[])
                GROUP BY
                    oi.idorcamentoitem, f.descfuncao, e.nmevento, c.nmfantasia,
                    lm.descmontagem, oi.setor, o.idevento, o.idcliente,
                    o.idmontagem, oi.idfuncao, o.status, o.idorcamento,
                    o.contratarstaff, dto.periodos_disponiveis,
                    dpf.total, tof.total
                ORDER BY oi.idorcamentoitem;`;

        console.log("QUERY", query);
        const values = [
            idempresa,
            idEvento,
            idCliente,
            idLocalMontagem,
            datasEvento,
            idFuncao,
            setor || null,
            ignorarFiltroData
        ];

        const result = await client.query(query, values);
        const orcamentoItems = result.rows;
        console.log("📊 LINHAS ENCONTRADAS PELO BANCO:", orcamentoItems);

        // =========================================================================
        // 🔀 MONTAGEM DO OBJETO INTELIGENTE PARA O FRONT-END
        // =========================================================================
        // Pegamos a primeira linha como base para os dados macro (id, nome do evento, etc.)
        const base = orcamentoItems[0];

        // Criamos arrays para mapear detalhadamente os setores e períodos disponíveis
        let itensOrcamentoDetail = [];
        let todasAsDatasOrcadas = [];

        orcamentoItems.forEach(item => {
            // Calcula o total orçado específico desta linha/setor
            // Como sua query já faz SUM(oi2.qtditens * oi2.qtddias) agrupado no tof, usamos a proporção real daqui:
            const qtdOrcadaItem = Number(item.quantidade_orcada || 0); 

            itensOrcamentoDetail.push({
                setor: item.setor || 'Geral',
                quantidade_orcada: qtdOrcadaItem,
                periodos_disponiveis: item.datas_totais_orcadas || []
            });

            // Une todas as datas para manter o funcionamento do front antigo
            if (Array.isArray(item.datas_totais_orcadas)) {
                todasAsDatasOrcadas = todasAsDatasOrcadas.concat(item.datas_totais_orcadas);
            }
        });

        // Remove duplicatas das datas acumuladas
        todasAsDatasOrcadas = [...new Set(todasAsDatasOrcadas)];

        // Monta o objeto final idêntico ao que o front espera, mas turbinado com os detalhes!
        const respostaFormatada = {
            status: base.status,
            idorcamento: base.idorcamento,
            contratarstaff: base.contratarstaff,
            idfuncao: base.idfuncao,
            descfuncao: base.descfuncao,
            nmevento: base.nmevento,
            nmcliente: base.nmcliente,
            nmlocalmontagem: base.nmlocalmontagem,
            
            // Totais consolidados (soma de todas as linhas encontradas para a função)
            quantidade_orcada: orcamentoItems.reduce((acc, curr) => acc + Number(curr.quantidade_orcada || 0), 0),
            quantidade_escalada: base.quantidade_escalada, // Mantém o total já escalado vindo do count do banco
            diarias_escaladas: base.diarias_escaladas,     // Mantém o total de diárias usadas
            datas_totais_orcadas: todasAsDatasOrcadas,
            
            // 🔥 AQUI ESTÁ A CHAVE DE OURO: O detalhamento por setor para o Swal usar!
            itensOrcamentoDetail: itensOrcamentoDetail 
        };

        res.locals.acao = 'cadastrou';
        res.locals.idregistroalterado = orcamentoItems.length > 0 ? orcamentoItems[0].idorcamento : null; 

        //res.status(200).json(orcamentoItems);
        res.status(200).json(respostaFormatada);
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



// router.post("/orcamento/vagas-disponiveis",
//     async (req, res) => {
//         console.log("\n🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑");
//         console.log("📥 ENTRANDO NA ROTA COM FILTRO DE EQUIPE E TRATAMENTO DE DOBRAS!");
//         console.log("Body recebido:", req.body);
//         console.log("🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑\n");

//         const client = await pool.connect();
//         try {
//             const {
//                 idOrcamento, 
//                 idEvento,
//                 idCliente,
//                 idLocalMontagem,
//                 idEquipe // 🔥 Recebe o idEquipe vindo do Front-end
//             } = req.body;

//             const idempresa = req.idempresa || 1; 

//             const query = `
//                 WITH orcamentos_validos AS (
//                     SELECT DISTINCT o2.idorcamento 
//                     FROM orcamentos o2
//                     JOIN orcamentoempresas oe2 ON o2.idorcamento = oe2.idorcamento
//                     WHERE oe2.idempresa = $1
//                       AND o2.status != 'R'            
//                       AND o2.contratarstaff = true     
//                       AND (
//                         ($2::int IS NOT NULL AND $3::int IS NOT NULL AND $4::int IS NOT NULL AND o2.idevento = $2 AND o2.idcliente = $3 AND o2.idmontagem = $4)
//                         OR
//                         ($5::int IS NOT NULL AND o2.idorcamento = $5)
//                       )
//                 ),
//                 orcado_por_item AS (
//                     SELECT 
//                         oi.idorcamento, -- 🎯 ADICIONADO: Mantém os orçamentos separados!
//                         oi.idfuncao,
//                         COALESCE(NULLIF(UPPER(TRIM(oi.setor)), ''), '') AS setor_normalizado,
//                         MAX(COALESCE(NULLIF(TRIM(oi.setor), ''), 'Geral / Sem Setor')) AS setor_original,
//                         COALESCE(TO_CHAR(oi.periododiariasinicio, 'DD/MM') || ' a ' || TO_CHAR(oi.periododiariasfim, 'DD/MM'), 'Período não definido') AS periodo_item,
                        
//                         -- 🌟 Aplica a regra exata que você validou no seu SELECT:
//                         CASE
//                             WHEN bool_or(oi.cachefechado = true) THEN SUM(oi.qtddias)  -- cache: soma diárias
//                             ELSE MAX(oi.qtditens)                                      -- pessoas: max de vagas
//                         END AS total_orcado,
                        
//                         bool_or(oi.cachefechado = true) AS tem_cache_fechado
//                     FROM orcamentoitens oi
//                     WHERE oi.idorcamento IN (SELECT idorcamento FROM orcamentos_validos)
//                       AND oi.categoria = 'Produto(s)' -- Filtro idêntico ao seu select de teste
//                     GROUP BY oi.idorcamento, oi.idfuncao, COALESCE(NULLIF(UPPER(TRIM(oi.setor)), ''), ''), oi.periododiariasinicio, oi.periododiariasfim
//                 ),
//                 consumo_consolidado AS (
//                     -- 1. Dias normais escalados na função original (Contratação Padrão)
//                     SELECT 
//                         se.idorcamento,
//                         se.idfuncao,
//                         COALESCE(NULLIF(UPPER(TRIM(se.setor)), ''), '') AS setor_normalizado,
//                         COALESCE(SUM(jsonb_array_length(se.datasevento)), 0) AS qtd_diarias
//                     FROM staffeventos se
//                     WHERE se.ativo = true
//                       AND se.statusstaff != 'Inativo'
//                       AND se.idorcamento IN (SELECT idorcamento FROM orcamentos_validos)
//                     GROUP BY se.idorcamento, se.idfuncao, COALESCE(NULLIF(UPPER(TRIM(se.setor)), ''), '')

//                     UNION ALL

//                     -- 2. Diárias Dobradas direcionadas para a FUNÇÃO ALVO (idfuncaodobra)
//                     SELECT 
//                         COALESCE((dd->>'idorcamento')::int, se.idorcamento) AS idorcamento,
//                         (dd->>'idfuncaodobra')::int AS idfuncao,
//                         COALESCE(NULLIF(UPPER(TRIM(se.setor)), ''), '') AS setor_normalizado, 
//                         COUNT(*) AS qtd_diarias
//                     FROM staffeventos se,
//                     jsonb_array_elements(
//                         CASE 
//                             WHEN jsonb_typeof(se.dtdiariadobrada) = 'array' THEN se.dtdiariadobrada 
//                             ELSE '[]'::jsonb 
//                         END
//                     ) AS dd
//                     WHERE se.ativo = true
//                       AND se.statusstaff != 'Inativo'
//                       AND se.idorcamento IN (SELECT idorcamento FROM orcamentos_validos)
//                       AND (dd->>'status') IN ('Pendente', 'Autorizado') 
//                       AND (dd->>'idfuncaodobra') IS NOT NULL 
//                       AND (dd->>'idfuncaodobra') <> 'null'
//                     GROUP BY COALESCE((dd->>'idorcamento')::int, se.idorcamento), (dd->>'idfuncaodobra')::int, COALESCE(NULLIF(UPPER(TRIM(se.setor)), ''), '')
//                 ),
//                 escalado_por_funcao AS (
//                     -- Agrupa unificando o consumo ligando também por IDORCAMENTO
//                     SELECT 
//                         cc.idorcamento,
//                         cc.idfuncao,
//                         cc.setor_normalizado,
//                         SUM(cc.qtd_diarias) AS total_consumido
//                     FROM consumo_consolidado cc
//                     GROUP BY cc.idorcamento, cc.idfuncao, cc.setor_normalizado
//                 )
//                 SELECT 
//                     o.idorcamento, -- 🎯 Retorna para o Front saber de quem é a vaga
//                     o.idfuncao,
//                     f.descfuncao AS nmfuncao,
//                     f.idequipe, 
//                     o.setor_original AS sector, 
//                     o.setor_original AS setor,
//                     o.periodo_item AS periodo, 
//                     o.total_orcado AS quantidade_orcada,
//                     o.tem_cache_fechado, 
//                     COALESCE(e.total_consumido, 0) AS quantidade_escalada,
//                     (o.total_orcado - COALESCE(e.total_consumido, 0)) AS saldo_disponivel,
                   
//                     -- 🚀 TRAZ OS VALORES DE CADA NÍVEL DA CATEGORIA
//                     COALESCE(cf.ctofuncaobase, 0) AS valor_base,
//                     COALESCE(cf.ctofuncaojunior, 0) AS valor_junior,
//                     COALESCE(cf.ctofuncaopleno, 0) AS valor_pleno,
//                     COALESCE(cf.ctofuncaosenior, 0) AS valor_senior,
//                     COALESCE(cf.alimentacao, 0) AS valor_alimentacao
                    
//                 FROM orcado_por_item o
//                 INNER JOIN funcao f ON o.idfuncao = f.idfuncao 
//                 LEFT JOIN categoriafuncao cf ON f.idcategoriafuncao = cf.idcategoriafuncao
//                 LEFT JOIN escalado_por_funcao e ON o.idfuncao = e.idfuncao 
//                                                AND o.setor_normalizado = e.setor_normalizado
//                                                AND o.idorcamento = e.idorcamento -- 🎯 Vínculo por orçamento!
//                 WHERE (o.total_orcado - COALESCE(e.total_consumido, 0)) > 0
//                   AND ($6::int IS NULL OR f.idequipe = $6) 
//                 ORDER BY o.idorcamento, f.descfuncao, o.setor_original;
//             `;

//             const values = [
//                 idempresa ? parseInt(idempresa) : null,
//                 idEvento ? parseInt(idEvento) : null,
//                 idCliente ? parseInt(idCliente) : null,
//                 idLocalMontagem ? parseInt(idLocalMontagem) : null,
//                 idOrcamento ? parseInt(idOrcamento) : null,
//                 idEquipe ? parseInt(idEquipe) : null 
//             ];

//             const result = await client.query(query, values);
//             return res.status(200).json(result.rows);

//         } catch (error) {
//             console.error("❌ Erro na rota de vagas por equipe:", error);
//             return res.status(500).json({ error: error.message });
//         } finally {
//             client.release();
//         }
//     }
// );

router.post("/orcamento/vagas-disponiveis",
    async (req, res) => {
        console.log("\n🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑");
        console.log("📥 ENTRANDO NA ROTA COM FILTRO DE EQUIPE E TRATAMENTO DE DOBRAS CORRIGIDO!");
        console.log("Body recebido:", req.body);
        console.log("🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑\n");

        const client = await pool.connect();
        try {
            const {
                idOrcamento, 
                idEvento,
                idCliente,
                idLocalMontagem,
                idEquipe 
            } = req.body;

            const idempresa = req.idempresa || 1; 

            const query = `
                WITH orcamentos_validos AS (
                    SELECT DISTINCT o2.idorcamento 
                    FROM orcamentos o2
                    JOIN orcamentoempresas oe2 ON o2.idorcamento = oe2.idorcamento
                    WHERE oe2.idempresa = $1
                      AND o2.status != 'R'            
                      AND o2.contratarstaff = true     
                      AND (
                        ($2::int IS NOT NULL AND $3::int IS NOT NULL AND $4::int IS NOT NULL AND o2.idevento = $2 AND o2.idcliente = $3 AND o2.idmontagem = $4)
                        OR
                        ($5::int IS NOT NULL AND o2.idorcamento = $5)
                      )
                ),
                orcado_por_item AS (
                    SELECT 
                        oi.idorcamento,
                        oi.idfuncao,
                        COALESCE(NULLIF(UPPER(TRIM(oi.setor)), ''), '') AS setor_normalizado,
                        MAX(COALESCE(NULLIF(TRIM(oi.setor), ''), 'Geral / Sem Setor')) AS setor_original,
                        -- Período informativo consolidado
                        MAX(COALESCE(TO_CHAR(oi.periododiariasinicio, 'DD/MM') || ' a ' || TO_CHAR(oi.periododiariasfim, 'DD/MM'), 'Período não definido')) AS periodo_item,
                        
                        -- 🌟 CORREÇÃO 1: Calcula o teto absoluto de diárias contratadas para o evento
                        CASE
                            WHEN bool_or(oi.cachefechado = true) THEN SUM(oi.qtddias)
                            ELSE SUM(oi.qtditens * oi.qtddias)
                        END AS total_orcado,
                        
                        bool_or(oi.cachefechado = true) AS tem_cache_fechado
                    FROM orcamentoitens oi
                    WHERE oi.idorcamento IN (SELECT idorcamento FROM orcamentos_validos)
                      AND oi.categoria = 'Produto(s)'
                    -- 🌟 CORREÇÃO 2: Removemos datas do GROUP BY para consolidar o saldo total por Função/Setor
                    GROUP BY oi.idorcamento, oi.idfuncao, COALESCE(NULLIF(UPPER(TRIM(oi.setor)), ''), '')
                ),
                consumo_consolidado AS (
                    -- 1. Dias normais escalados na função original (Contratação Padrão)
                    SELECT 
                        se.idorcamento,
                        se.idfuncao,
                        COALESCE(NULLIF(UPPER(TRIM(se.setor)), ''), '') AS setor_normalizado,
                        COALESCE(SUM(jsonb_array_length(se.datasevento)), 0) AS qtd_diarias
                    FROM staffeventos se
                    WHERE se.ativo = true
                      AND se.statusstaff != 'Inativo'
                      AND se.idorcamento IN (SELECT idorcamento FROM orcamentos_validos)
                    GROUP BY se.idorcamento, se.idfuncao, COALESCE(NULLIF(UPPER(TRIM(se.setor)), ''), '')

                    UNION ALL

                    -- 2. Diárias Dobradas direcionadas para a FUNÇÃO ALVO (idfuncaodobra) E SETOR ALVO (setordobra)
                SELECT 
                    COALESCE((dd->>'idorcamento')::int, se.idorcamento) AS idorcamento,
                    (dd->>'idfuncaodobra')::int AS idfuncao,
                    -- 🌟 CORREÇÃO: Pega o setor real da dobra de dentro do JSON, se não existir usa o do staff
                    COALESCE(NULLIF(UPPER(TRIM(dd->>'setordobra')), ''), COALESCE(NULLIF(UPPER(TRIM(se.setor)), ''), '')) AS setor_normalizado, 
                    COUNT(*) AS qtd_diarias
                FROM staffeventos se,
                jsonb_array_elements(
                    CASE 
                        WHEN jsonb_typeof(se.dtdiariadobrada) = 'array' THEN se.dtdiariadobrada 
                        ELSE '[]'::jsonb 
                    END
                ) AS dd
                WHERE se.ativo = true
                AND se.statusstaff != 'Inativo'
                AND se.idorcamento IN (SELECT idorcamento FROM orcamentos_validos)
                AND (dd->>'status') IN ('Pendente', 'Autorizado') 
                AND (dd->>'idfuncaodobra') IS NOT NULL 
                AND (dd->>'idfuncaodobra') <> 'null'
                GROUP BY 
                    COALESCE((dd->>'idorcamento')::int, se.idorcamento), 
                    (dd->>'idfuncaodobra')::int, 
                    COALESCE(NULLIF(UPPER(TRIM(dd->>'setordobra')), ''), COALESCE(NULLIF(UPPER(TRIM(se.setor)), ''), '')
                    ),
                escalado_por_funcao AS (
                    SELECT 
                        cc.idorcamento,
                        cc.idfuncao,
                        cc.setor_normalizado,
                        SUM(cc.qtd_diarias) AS total_consumido
                    FROM consumo_consolidado cc
                    GROUP BY cc.idorcamento, cc.idfuncao, cc.setor_normalizado
                )
                SELECT 
                    o.idorcamento,
                    o.idfuncao,
                    f.descfuncao AS nmfuncao,
                    f.idequipe, 
                    o.setor_original AS sector, 
                    o.setor_original AS setor,
                    o.periodo_item AS periodo, 
                    o.total_orcado AS quantidade_orcada,
                    o.tem_cache_fechado, 
                    COALESCE(e.total_consumido, 0) AS quantidade_escalada,
                    (o.total_orcado - COALESCE(e.total_consumido, 0)) AS saldo_disponivel,
                   
                    COALESCE(cf.ctofuncaobase, 0) AS valor_base,
                    COALESCE(cf.ctofuncaojunior, 0) AS valor_junior,
                    COALESCE(cf.ctofuncaopleno, 0) AS valor_pleno,
                    COALESCE(cf.ctofuncaosenior, 0) AS valor_senior,
                    COALESCE(cf.alimentacao, 0) AS valor_alimentacao
                    
                FROM orcado_por_item o
                INNER JOIN funcao f ON o.idfuncao = f.idfuncao 
                LEFT JOIN categoriafuncao cf ON f.idcategoriafuncao = cf.idcategoriafuncao
                LEFT JOIN escalado_por_funcao e ON o.idfuncao = e.idfuncao 
                                               AND o.setor_normalizado = e.setor_normalizado
                                               AND o.idorcamento = e.idorcamento
                WHERE (o.total_orcado - COALESCE(e.total_consumido, 0)) > 0
                  AND ($6::int IS NULL OR f.idequipe = $6) 
                ORDER BY o.idorcamento, f.descfuncao, o.setor_original;
            `;

            const values = [
                idempresa ? parseInt(idempresa) : null,
                idEvento ? parseInt(idEvento) : null,
                idCliente ? parseInt(idCliente) : null,
                idLocalMontagem ? parseInt(idLocalMontagem) : null,
                idOrcamento ? parseInt(idOrcamento) : null,
                idEquipe ? parseInt(idEquipe) : null 
            ];

            const result = await client.query(query, values);
            return res.status(200).json(result.rows);

        } catch (error) {
            console.error("❌ Erro na rota de vagas por equipe:", error);
            return res.status(500).json({ error: error.message });
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
                s.idstaff, s.avaliacao, se.comppgtoajdcusto50, se.compcontgastos
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
                se.nmfuncao,
                se.statusstaff
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
          se.compcontgastos,
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
          se.obsgeral,
          se.ativo,
          se.desccustofechado,
          se.statusstaff,
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
          ) AS dtmeiadiaria_aggr, -- Renomeado
           (
                SELECT jsonb_build_object(
                    'idsolicitacao', sol.idsolicitacao,
                    'status', sol.status,
                    'noOrcamento', EXISTS (
                        SELECT 1 FROM orcamentoitens oi WHERE oi.idsolicitacao = sol.idsolicitacao
                    )
                )
                FROM solicitacoes sol
                WHERE sol.idregistroalterado = se.idstaffevento
                AND sol.categoria_log = 'aditivoextra'
                ORDER BY sol.dtsolicitacao DESC
                LIMIT 1
            ) AS solicitacao_aditivo
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

      console.log("RESULTADO DA QUERY DE EVENTOS POR FUNCIONÁRIO:", result.rows);

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
        //const { idStaffEvento } = req.params;
        const idStaffEvento = req.params.idStaffEvento;
        const idempresa = req.idempresa;
        const idUsuarioLogado = req.usuario.idusuario;
        const body = req.body;

        console.log("BODY DO PUT STAFF", req.body);
        console.log("ID Staff Evento (param):", req.params.idStaffEvento);
        console.log("ID Staff Evento (req):", idStaffEvento);

        // ====================================================================
        // 🚀 1. LOCAL EXATO PARA O TRATAMENTO DA DESCRIÇÃO (ANTI-ARRAY)
        // ====================================================================
        let descDiariaDobradaFinalText = '';
        if (body.descdiariadobrada) {
            if (Array.isArray(body.descdiariadobrada)) {
                // Se veio como array de textos duplicados, pega apenas o primeiro item
                descDiariaDobradaFinalText = String(body.descdiariadobrada[0] || '').trim();
            } else if (typeof body.descdiariadobrada === 'string' && body.descdiariadobrada.startsWith('{')) {
                // Evita que vire chaves do Postgres {"Texto"} e limpa resíduos de aspas e chaves
                descDiariaDobradaFinalText = body.descdiariadobrada.replace(/[\{\}"]/g, '').trim();
            } else {
                descDiariaDobradaFinalText = String(body.descdiariadobrada).trim();
            }
        }
        // ====================================================================

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

            const paths = {
                cache:  req.files?.comppgtocache    ? `/uploads/staff_comprovantes/${req.files.comppgtocache[0].filename}`    : (body.limparComprovanteCache      === 'true' ? null : old.comppgtocache),
                ajd:    req.files?.comppgtoajdcusto ? `/uploads/staff_comprovantes/${req.files.comppgtoajdcusto[0].filename}` : (body.limparComprovanteAjdCusto    === 'true' ? null : old.comppgtoajdcusto),
                ajd50:  req.files?.comppgtoajdcusto50 ? `/uploads/staff_comprovantes/${req.files.comppgtoajdcusto50[0].filename}` : (body.limparComprovanteAjdCusto2 === 'true' ? null : old.comppgtoajdcusto50),
                cx:     req.files?.comppgtocaixinha ? `/uploads/staff_comprovantes/${req.files.comppgtocaixinha[0].filename}` : (body.limparComprovanteCaixinha     === 'true' ? null : old.comppgtocaixinha),
                contgastos: req.files?.compcontrolegastos ? `/uploads/staff_comprovantes/${req.files.compcontrolegastos[0].filename}` : (body.limparComprovanteControleGastos     === 'true' ? null : old.compcontgastos)
            };

            if (req.files?.comppgtocache)     deletarArquivoAntigo(old.comppgtocache);
            if (req.files?.comppgtoajdcusto)  deletarArquivoAntigo(old.comppgtoajdcusto);
            if (req.files?.comppgtoajdcusto50)deletarArquivoAntigo(old.comppgtoajdcusto50);
            if (req.files?.comppgtocaixinha)  deletarArquivoAntigo(old.comppgtocaixinha);
            if (req.files?.compcontrolegastos) deletarArquivoAntigo(old.compcontgastos); // ← corrigido

            // 2. TRATAMENTO DE VALORES E STRINGS (Recalculo)
            const parseJSON = (val) => {
                if (!val) return [];
                if (typeof val === 'object') return val;
                try { return JSON.parse(val); } catch (e) { return []; }
            };

            const datasevento = parseJSON(body.datasevento);
            //const dtdiariadobrada = parseJSON(body.datadiariadobrada);
            const dtmeiadiaria = parseJSON(body.datameiadiaria);

            // Substitui o parseJSON de dtdiariadobrada por isto:
            let dtdiariadobrada = [];
            try {
                const rawDobrada = Array.isArray(body.datadiariadobrada) 
                    ? body.datadiariadobrada[0]   // se veio duplicado, pega o primeiro
                    : body.datadiariadobrada;
                
                if (rawDobrada) {
                    const parsed = typeof rawDobrada === 'object' ? rawDobrada : JSON.parse(rawDobrada);
                    // Normaliza os tipos numéricos que chegam como string via formData
                    dtdiariadobrada = parsed.map(item => ({
                        ...item,
                        idfuncaodobra:   item.idfuncaodobra != null ? parseInt(item.idfuncaodobra)     : null,
                        idorcamento:     item.idorcamento   != null ? parseInt(item.idorcamento)       : null,
                        vlr_cache:       item.vlr_cache     != null ? parseFloat(item.vlr_cache)       : null,
                        vlr_alimentacao: item.vlr_alimentacao != null ? parseFloat(item.vlr_alimentacao) : null,
                    }));
                }
            } catch(e) {
                console.error("❌ Erro ao parsear datadiariadobrada:", e);
                dtdiariadobrada = [];
            }

            console.log("🔍 dtdiariadobrada normalizado:", JSON.stringify(dtdiariadobrada, null, 2));

            const vlrCusto = parseFloat(String(body.vlrcache || 0).replace(',', '.')) || 0;
            const vlrTransp = parseFloat(String(body.vlrtransporte || 0).replace(',', '.')) || 0;
            const vlrAlim = parseFloat(String(body.vlralimentacao || 0).replace(',', '.')) || 0;
            const vlrAjuste = parseFloat(String(body.vlrajustecusto || 0).replace(',', '.')) || 0;
            const vlrCaixinha = parseFloat(String(body.vlrcaixinha || 0).replace(',', '.')) || 0;

            // let total = 0, totalCache = 0, totalAjdCusto = 0;
            // datasevento.forEach(dStr => {
            //     const d = new Date(dStr + 'T12:00:00');
            //     const isFDS = d.getDay() === 0 || d.getDay() === 6;
            //     if (body.statuscustofechado === 'Autorizado') {
            //         total += vlrCusto + vlrTransp + vlrAlim;
            //         totalCache += vlrCusto; totalAjdCusto += vlrTransp + vlrAlim;
            //     } else {
            //         if (perfil === 'interno' || perfil === 'externo') {
            //             total += vlrTransp + vlrAlim; totalAjdCusto += vlrTransp + vlrAlim;
            //             if (isFDS) { total += vlrCusto; totalCache += vlrCusto; }
            //         } else {
            //             total += vlrCusto + vlrTransp + vlrAlim;
            //             totalCache += vlrCusto; totalAjdCusto += vlrTransp + vlrAlim;
            //         }
            //     }
            // });
            // if (body.statusajustecusto === 'Autorizado') { total += vlrAjuste; totalCache += vlrAjuste; }
            // if (body.statuscaixinha === 'Autorizado') { total += vlrCaixinha; }
            // const aplicarAdicionais = (lista, divisor) => {
            //     lista.forEach(item => { if (item.status === 'Autorizado') { const extra = vlrCusto / divisor; total += extra + vlrAlim; totalCache += extra + vlrAlim; } });
            // };
            // aplicarAdicionais(dtdiariadobrada, 1); aplicarAdicionais(dtmeiadiaria, 2);

            // ✅ Substitui todo o bloco de recálculo por isto:
            const totalCache = parseFloat(String(body.vlrtotcache || 0).replace(',', '.')) || 0;
            const totalAjdCusto = parseFloat(String(body.vlrtotajdcusto || 0).replace(',', '.')) || 0;
            const total = parseFloat(String(body.vlrtotal || 0).replace(',', '.')) || 0;

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
                    statuscustofechado = $46, desccustofechado = $47, obspospgto = $48, statusstaff = COALESCE($51, statusstaff),
                    compcontgastos = $52
                WHERE idstaffevento = $49 
                AND EXISTS (SELECT 1 FROM staffempresas sme WHERE sme.idstaff = staffeventos.idstaff AND sme.idempresa = $50)`,
                [
                    body.idfuncionario, body.nmfuncionario, body.idfuncao, body.nmfuncao,
                    body.idcliente, body.nmcliente, body.idevento, body.nmevento, body.idmontagem,
                    body.nmlocalmontagem, body.pavilhao, vlrCusto, vlrAjuste, vlrTransp, vlrAlim, vlrCaixinha,
                    body.descajustecusto, JSON.stringify(datasevento), total, body.descbeneficios, body.setor,
                    body.statuspgto, body.statusajustecusto, body.statuscaixinha, body.statusdiariadobrada,
                    body.statusmeiadiaria, JSON.stringify(dtdiariadobrada), JSON.stringify(dtmeiadiaria),
                    body.desccaixinha, descDiariaDobradaFinalText, body.descmeiadiaria,
                    paths.cache, paths.ajd, paths.ajd50, paths.cx,
                    body.nivelexperiencia, body.qtdpessoas || 0, body.idequipe, body.nmequipe, body.tipoajudacustoviagem,
                    body.statuspgtoajdcto, body.statuspgtocaixinha, body.idorcamento, totalCache, totalAjdCusto,
                    body.statuscustofechado, body.desccustofechado, body.obspospgto, idStaffEvento, idempresa, body.statusstaff || null,
                    paths.contgastos
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
                        
                        const idOrcamentoRegistro = entrada.idorcamento ? parseInt(entrada.idorcamento) : parseInt(body.idorcamento);  
                    
                        // 🚀 TRATAMENTO SEGURO ANTI-DUPLICAÇÃO DA JUSTIFICATIVA INDIVIDUAL:
                        // Pega a justificativa limpa da data. Se não existir, pega a geral tratada.
                        let justificativaItemIndividual = entrada.justificativa ? entrada.justificativa : item.desc;

                        // Força a conversão para string e remove espaços, garantindo que não seja null/undefined
                        justificativaItemIndividual = String(justificativaItemIndividual || '').trim();

                        // Agora é 100% seguro usar o .startsWith() porque garantimos que é uma string
                        if (justificativaItemIndividual.startsWith('{')) {
                            justificativaItemIndividual = justificativaItemIndividual.replace(/[\{\}"]/g, '').trim();
                        }                 

                        // CORREÇÃO: Usando o operador ANY para comparar data com array de datas (date[])
                        const updateRes = await client.query(
                            `UPDATE public.solicitacoes 
                             SET status = $1::varchar, 
                                 idorcamento = $2::integer,
                                 dtresposta = CASE WHEN $1::varchar = 'Pendente' THEN NULL ELSE CURRENT_TIMESTAMP END, 
                                 idusuarioresponsavel = CASE WHEN $1::varchar = 'Pendente' THEN NULL ELSE $3::integer END
                             WHERE idregistroalterado = $4::integer 
                               AND categoria_log = $5::varchar 
                               AND idempresa = $6::integer 
                               AND $7::date = ANY(dtsolicitada)`, 
                            [statusDec, idOrcamentoRegistro, idUsuarioLogado, idStaffEvento, item.campo, idempresa, entrada.data]
                        );

                        if (updateRes.rowCount === 0 && ['Pendente', 'Autorizado'].includes(statusDec)) {
                            // No INSERT, passamos a data dentro de um array literal do Postgres para bater com date[]
                            await client.query(`
                                INSERT INTO public.solicitacoes (
                                    idorcamento, idregistroalterado, idfuncionario, idfuncao, idempresa, 
                                    tiposolicitacao, status, dtsolicitacao, idusuariosolicitante, 
                                    categoria_log, justificativa, dtsolicitada
                                ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, $8, $9, $10, ARRAY[$11]::date[])`,
                                [idOrcamentoRegistro,
                                 idStaffEvento, 
                                 body.idfuncionario,
                                 entrada.idfuncaodobra ? entrada.idfuncaodobra : body.idfuncao, // Usa a função da dobra se disponível 
                                 idempresa,
                                 item.tipo, 
                                 statusDec, 
                                 idUsuarioLogado, 
                                 item.campo, 
                                 //item.desc, 
                                 justificativaItemIndividual,
                                 entrada.data]
                            );
                        }
                    }            

                } else {

            // // ====================================================================
            // // 4. SINCRONIZAÇÃO DE SOLICITAÇÕES (ATUALIZADO PARA COMPORTAR IDFUNCAODOBRA)
            // // ====================================================================
            // const itensFinanceiros = [
            //     { status: body.statuscaixinha, campo: 'statuscaixinha', valor: vlrCaixinha, desc: body.desccaixinha, tipo: 'Caixinha' },
            //     { status: body.statusajustecusto, campo: 'statusajustecusto', valor: vlrAjuste, desc: body.descajustecusto, tipo: 'Ajuste de Custo' },
            //     { status: body.statuscustofechado, campo: 'statuscustofechado', valor: vlrCusto, desc: body.desccustofechado, tipo: 'Cachê Fechado' },
            //     { status: body.statusdiariadobrada, campo: 'statusdiariadobrada', valor: 0, desc: body.descdiariadobrada, tipo: 'Diária Dobrada', datas: dtdiariadobrada },
            //     { status: body.statusmeiadiaria, campo: 'statusmeiadiaria', valor: 0, desc: body.descmeiadiaria, tipo: 'Meia Diária', datas: dtmeiadiaria }
            // ];

            // for (const item of itensFinanceiros) {
            //     if (item.campo === 'statusdiariadobrada' || item.campo === 'statusmeiadiaria') {
            //         for (const entrada of item.datas) {
            //             const statusDec = (entrada.status || '').trim();
            //             if (!entrada.data || !statusDec) continue;

            //             // 🚀 REGRA OPERACIONAL CRÍTICA: Se a diária dobrada possui "idfuncaodobra", 
            //             // significa que ela reaproveitou saldo de outra vaga. Não gera solicitação/aditivo!
            //             if (item.campo === 'statusdiariadobrada' && entrada.idfuncaodobra) {
            //                 console.log(`ℹ️ Data ${entrada.data} é uma dobra reaproveitada (Função ID: ${entrada.idfuncaodobra}). Pulando tabela de solicitações.`);
            //                 continue; 
            //             }

            //             // CORREÇÃO: Usando o operador ANY para comparar data com array de datas (date[])
            //             const updateRes = await client.query(
            //                 `UPDATE public.solicitacoes 
            //                 SET status = $1::varchar, 
            //                     dtresposta = CASE WHEN $1::varchar = 'Pendente' THEN NULL ELSE CURRENT_TIMESTAMP END, 
            //                     idusuarioresponsavel = CASE WHEN $1::varchar = 'Pendente' THEN NULL ELSE $2::integer END
            //                 WHERE idregistroalterado = $3::integer 
            //                 AND categoria_log = $4::varchar 
            //                 AND idempresa = $5::integer 
            //                 AND $6::date = ANY(dtsolicitada)`, 
            //                 [statusDec, idUsuarioLogado, idStaffEvento, item.campo, idempresa, entrada.data]
            //             );

            //             if (updateRes.rowCount === 0 && ['Pendente', 'Autorizado'].includes(statusDec)) {
            //                 // No INSERT, passamos a data dentro de um array literal do Postgres para bater com date[]
            //                 await client.query(`
            //                     INSERT INTO public.solicitacoes (
            //                         idorcamento, idregistroalterado, idfuncionario, idfuncao, idempresa, 
            //                         tiposolicitacao, status, dtsolicitacao, idusuariosolicitante, 
            //                         categoria_log, justificativa, dtsolicitada
            //                     ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, $8, $9, $10, ARRAY[$11]::date[])`,
            //                     [body.idorcamento, idStaffEvento, body.idfuncionario, body.idfuncao, idempresa,
            //                     item.tipo, statusDec, idUsuarioLogado, item.campo, item.desc, entrada.data]
            //                 );
            //             }
            //         }            
            //     } else {
       
                    // 1. Tenta atualizar. Incluímos o idusuariosolicitante no SET para garantir que ele seja gravado.
                    const updateRes = await client.query(
                        `UPDATE public.solicitacoes 
                        SET status = $1::varchar, 
                            dtresposta = CASE WHEN $1::varchar = 'Pendente' THEN NULL ELSE CURRENT_TIMESTAMP END, 
                            idusuarioresponsavel = CASE WHEN $1::varchar = 'Pendente' THEN NULL ELSE $2::integer END,
                            vlrsolicitado = $3, 
                            justificativa = $4::text,
                            idusuariosolicitante = $2::integer -- Adicionado para não ficar NULL no update
                        WHERE idregistroalterado = $5::integer 
                        AND categoria_log = $6::varchar 
                        AND idempresa = $7::integer`,
                        [item.status, idUsuarioLogado, item.valor, item.desc, idStaffEvento, item.campo, idempresa]
                    );

                    if (updateRes.rowCount === 0 && ['Pendente', 'Autorizado'].includes(item.status)) {
                        // Certifique-se que a função registrarSolicitacao trata dtsolicitada como array se necessário
                        await registrarSolicitacao(client, {
                        idempresa: idempresa, // $1
                        idorcamento: body.idorcamento, // $2
                        idfuncionario: body.idfuncionario, // $3
                        idfuncao: body.idfuncao, // $4
                        idstaffevento: idStaffEvento, // $5
                        idusuariosolicitante: idUsuarioLogado, // $6 (Atenção aqui!)
                        tiposolicitacao: item.tipo, // $7
                        categoria: item.campo, // $8
                        valor: item.valor, // $9
                        justificativa: item.desc, // $10
                        datas: item.datas // $11
                    });
                    }
                }
            }
            

            await client.query(
                `INSERT INTO notificacao (
                    idusuario, 
                    idreferencia, 
                    idempresa,   -- Adicionado
                    lido, 
                    tipo,        -- Recomendado para evitar null
                    mensagem,    -- Recomendado para evitar null
                    criado_em
                ) 
                VALUES ($1, $2, $3, true, 'info', 'Cadastro de Staff realizado', NOW()) 
                ON CONFLICT (idusuario, idreferencia) 
                DO UPDATE SET lido = true, idempresa = $3`, 
                [idUsuarioLogado, idStaffEvento, idempresa] // $3 é o idempresa
            );

            // 2. "Reseta" para os outros usuários: remove o status de lido deles 
            // para que a solicitação volte a brilhar/aparecer como pendente no painel deles.
            await client.query(
                `DELETE FROM notificacao WHERE idreferencia = $1 AND idusuario != $2`,
                [idStaffEvento, idUsuarioLogado]
            );

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
    console.log("DEBUG registrarSolicitacao - Objeto recebido:", JSON.stringify(dados, null, 2));
    
    const formatarParaJsonB = (valor) => {
        if (!valor) return null;
        if (typeof valor === 'object') return JSON.stringify(valor);
        return valor;
    };

    // 1. Tenta atualizar registro existente
    const updateRes = await client.query(`
        UPDATE public.solicitacoes SET
            vlrsolicitado = $1,
            justificativa = $2,
            dtsolicitacao = CURRENT_TIMESTAMP,
            idusuariosolicitante = $3
        WHERE idregistroalterado = $4
          AND categoria_log = $5
          AND status = 'Pendente'
          AND idregistroalterado IS NOT NULL
    `, [
        dados.valor || 0,
        dados.justificativa,
        dados.idusuariosolicitante,
        dados.idstaffevento || null,
        dados.categoria
    ]);

    // 2. Se não achou nada para atualizar, insere
    if (updateRes.rowCount === 0) {
        await client.query(`
            INSERT INTO public.solicitacoes (
                idempresa, idorcamento, idfuncionario, idfuncao,
                idregistroalterado, idusuariosolicitante, tiposolicitacao,
                categoria_log, vlrsolicitado, justificativa,
                dtsolicitada, status, dtsolicitacao
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::date[], $12, NOW())
        `, [
            dados.idempresa,
            dados.idorcamento,
            dados.idfuncionario || null,
            dados.idfuncao,
            dados.idstaffevento || null,
            dados.idusuariosolicitante,
            dados.tiposolicitacao,
            dados.categoria,
            dados.valor || 0,
            dados.justificativa,
            formatarParaJsonB(dados.datas),
            'Pendente'
        ]);
    }
}

function ordenarDatas(datas) {
    if (!datas || datas.length === 0) {
    return [];
    }
    // Supondo que as datas estejam no formato 'YYYY-MM-DD'
    return datas.sort((a, b) => new Date(a) - new Date(b));
}

// router.post("/", autenticarToken(), contextoEmpresa, verificarPermissao('staff', 'cadastrar'), 
//     uploadComprovantesMiddleware, 
//     logMiddleware('staffeventos', { 
//         buscarDadosAnteriores: async () => ({ dadosanteriores: null, idregistroalterado: null }) 
//     }), async (req, res) => {
    
//     const idUsuarioLogado = req.usuario.idusuario;
//     const body = req.body;
//     const idempresa = req.idempresa;

//     console.log("BODY DO PUT STAFF", req.body);
    

//     const {
//         idfuncionario, nmfuncionario, idevento, nmevento, idcliente, nmcliente,
//         idfuncao, nmfuncao, idmontagem, nmlocalmontagem, pavilhao,
//         vlrcache, vlralimentacao, vlrtransporte, vlrajustecusto,
//         vlrcaixinha, datasevento, descajustecusto, descbeneficios, vlrtotal, setor,
//         statuspgto, statusajustecusto, statuscaixinha, statusdiariadobrada, statusmeiadiaria,
//         datadiariadobrada, datameiadiaria, desccaixinha, descdiariadobrada, descmeiadiaria,
//         nivelexperiencia, qtdpessoas, idequipe, nmequipe, tipoajudacustoviagem,
//         statuspgtoajdcto, statuspgtocaixinha, idorcamento, statusstaff, //ativo,
//         vlrtotcache, vlrtotajdcusto, statuscustofechado, desccustofechado, obspospgto, obsgeral, 
//         // Novos campos vindos do frontend para Aditivo/Extra
//         tipoSolicitacaoAditivo, justificativaAditivo, datasExcecao
//     } = req.body;

//    // const isAtivo = (ativo === false || ativo === 'false') ? false : true;

   
//    const statusStaff = statusstaff || (justificativaAditivo ? 'Pendente' : 'Ativo');
    

//     let client;

//     try {
//         client = await pool.connect();
//         await client.query('BEGIN');

//         // 1. Tratamento das datas
//         let datasArray = [];
//         try {
//             datasArray = Array.isArray(datasevento) ? datasevento : JSON.parse(datasevento || "[]");
//         } catch (e) { datasArray = []; }


//         // 🛠️ TRATAMENTO SEGURO PARA AS DATAS DE DIÁRIA DOBRADA E MEIA DIÁRIA
//         let safeDataDiariaDobrada = null;
//         let safeDataMeiaDiaria = null;

//         try {
//             if (datadiariadobrada) {
//                 const parsed = typeof datadiariadobrada === 'string' ? JSON.parse(datadiariadobrada) : datadiariadobrada;
//                 safeDataDiariaDobrada = Array.isArray(parsed) ? parsed : [parsed];
//             }
//         } catch (e) {
//             // Se não for JSON válido, assume que é string de uma data única ou formato texto array {YYYY-MM-DD}
//             safeDataDiariaDobrada = datadiariadobrada;
//         }

//         try {
//             if (datameiadiaria) {
//                 const parsed = typeof datameiadiaria === 'string' ? JSON.parse(datameiadiaria) : datameiadiaria;
//                 safeDataMeiaDiaria = Array.isArray(parsed) ? parsed : [parsed];
//             }
//         } catch (e) {
//             safeDataMeiaDiaria = datameiadiaria;
//         }

//         // 2. Verificar/Criar Staff (Tabela Base)
//         const staffResult = await client.query(`
//             SELECT s.idstaff FROM staff s 
//             JOIN staffempresas se ON s.idstaff = se.idstaff 
//             WHERE s.idfuncionario = $1 AND se.idempresa = $2`, [idfuncionario, idempresa]);

//         let idstaffExistente = staffResult.rows[0]?.idstaff;
//         if (!idstaffExistente) {
//             const resS = await client.query(`INSERT INTO staff (idfuncionario) VALUES ($1) RETURNING idstaff`, [idfuncionario]);
//             idstaffExistente = resS.rows[0].idstaff;
//             await client.query(`INSERT INTO staffEmpresas (idstaff, idEmpresa) VALUES ($1, $2)`, [idstaffExistente, idempresa]);
//         }

//         // 3. Inserir na staffeventos
//         const queryInsert = `
//             INSERT INTO staffeventos (
//                 idstaff, idfuncionario, nmfuncionario, idevento, nmevento, idcliente, nmcliente,
//                 idfuncao, nmfuncao, idmontagem, nmlocalmontagem, pavilhao, vlrcache, 
//                 vlralimentacao, vlrtransporte, vlrajustecusto, vlrcaixinha, descajustecusto,
//                 datasevento, vlrtotal, comppgtocache, comppgtoajdcusto, comppgtocaixinha,
//                 descbeneficios, setor, statuspgto, statusajustecusto, statuscaixinha,
//                 statusdiariadobrada, statusmeiadiaria, dtdiariadobrada, comppgtoajdcusto50,
//                 dtmeiadiaria, desccaixinha, descdiariadobrada, descmeiadiaria, nivelexperiencia,
//                 qtdpessoaslote, idequipe, nmequipe, tipoajudacustoviagem, statuspgtocaixinha,
//                 statuspgtoajdcto, idorcamento, vlrtotcache, vlrtotajdcusto, statuscustofechado, 
//                 desccustofechado, obspospgto, obsgeral, statusstaff, compcontgastos
//             ) VALUES (
//                 $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,
//                 $26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44,$45,$46,$47,$48,
//                 $49,$50,$51,$52
//             ) RETURNING idstaffevento;
//         `;

//         const dbDiariaDobrada = Array.isArray(safeDataDiariaDobrada) ? JSON.stringify(safeDataDiariaDobrada) : safeDataDiariaDobrada;
//         const dbMeiaDiaria = Array.isArray(safeDataMeiaDiaria) ? JSON.stringify(safeDataMeiaDiaria) : safeDataMeiaDiaria;

//         const values = [
//             idstaffExistente, idfuncionario, nmfuncionario, idevento, nmevento, idcliente, nmcliente,
//             idfuncao, nmfuncao, idmontagem, nmlocalmontagem, pavilhao,
//             parseFloatOrNull(vlrcache), parseFloatOrNull(vlralimentacao),
//             parseFloatOrNull(vlrtransporte), parseFloatOrNull(vlrajustecusto), parseFloatOrNull(vlrcaixinha),
//             descajustecusto, JSON.stringify(datasArray), parseFloatOrNull(vlrtotal),
//             req.files?.comppgtocache?.[0] ? `/uploads/staff_comprovantes/${req.files.comppgtocache[0].filename}` : null,
//             req.files?.comppgtoajdcusto?.[0] ? `/uploads/staff_comprovantes/${req.files.comppgtoajdcusto[0].filename}` : null,
//             req.files?.comppgtocaixinha?.[0] ? `/uploads/staff_comprovantes/${req.files.comppgtocaixinha[0].filename}` : null,
//             descbeneficios, setor, statuspgto, statusajustecusto, statuscaixinha, statusdiariadobrada,
//             statusmeiadiaria, dbDiariaDobrada,
//             req.files?.comppgtoajdcusto50?.[0] ? `/uploads/staff_comprovantes/${req.files.comppgtoajdcusto50[0].filename}` : null,
//             dbMeiaDiaria, desccaixinha, descdiariadobrada, descmeiadiaria, nivelexperiencia, qtdpessoas,
//             idequipe, nmequipe, tipoajudacustoviagem, statuspgtocaixinha, statuspgtoajdcto, idorcamento,
//             parseFloatOrNull(vlrtotcache), parseFloatOrNull(vlrtotajdcusto), statuscustofechado, desccustofechado, obspospgto, obsgeral, 
//             //ativo === 'false' ? false : true
//             statusStaff, req.files?.comppgtocontgastos ? `/uploads/staff_comprovantes/${req.files.comppgtocontgastos[0].filename}` : null
//         ];

//         const resIns = await client.query(queryInsert, values);
//         const novoIdStaffEvento = resIns.rows[0].idstaffevento;

//         // 4. REGISTRAR SOLICITAÇÕES FINANCEIRAS (Status Pendente de Diárias/Cachê)
//         const itensFinanceiros = [
//             { status: body.statuscaixinha, campo: 'statuscaixinha', valor: body.vlrcaixinha, desc: body.desccaixinha, tipo: 'Caixinha' },
//             { status: body.statusajustecusto, campo: 'statusajustecusto', valor: body.vlrajustecusto, desc: body.descajustecusto, tipo: 'Ajuste de Custo' },
//             { status: body.statuscustofechado, campo: 'statuscustofechado', valor: body.vlrcache, desc: body.desccustofechado, tipo: 'Cachê Fechado' },
//             { status: body.statusdiariadobrada, campo: 'statusdiariadobrada', valor: 0, desc: body.descdiariadobrada, tipo: 'Diária Dobrada', datas: body.datadiariadobrada },
//             { status: body.statusmeiadiaria, campo: 'statusmeiadiaria', valor: 0, desc: body.descmeiadiaria, tipo: 'Meia Diária', datas: body.datameiadiaria }
//         ];

//         for (const item of itensFinanceiros) {
//             if (item.status === 'Pendente') {
//                 await registrarSolicitacao(client, {
//                     idempresa, idorcamento, idfuncionario, idfuncao,
//                     idstaffevento: novoIdStaffEvento,
//                     idusuario: idUsuarioLogado,
//                     tiposolicitacao: item.tipo,
//                     categoria: item.campo,
//                     valor: parseFloatOrNull(item.valor),
//                     justificativa: item.desc,
//                     datas: item.datas ? (typeof item.datas === 'string' ? JSON.parse(item.datas) : item.datas) : null
//                 });
//             }
//         }

//         // 🎯 5. VÍNCULO DE ADITIVO / EXTRA (Desmembrado por data)
//         if (statusStaff === 'Pendente' && tipoSolicitacaoAditivo) {
//             let datasSolicitadasArray = [];
//             try {
//                 const fonteDatas = datasExcecao 
//                     ? (Array.isArray(datasExcecao) ? datasExcecao : JSON.parse(datasExcecao))
//                     : datasArray;
                
//                 datasSolicitadasArray = fonteDatas
//                     .filter(d => d)
//                     .map(d => String(d).split('T')[0]);
                    
//             } catch (e) { 
//                 console.warn("⚠️ Falha ao processar datas:", e.message);
//                 datasSolicitadasArray = datasArray.map(d => String(d).split('T')[0]);
//             }

//             // 🚀 A MÁGICA: Iterar sobre as datas para criar solicitações individuais
//             for (const dataUnica of datasSolicitadasArray) {
//                 const queryAditivo = `
//                     INSERT INTO public.solicitacoes (
//                         idorcamento, idfuncionario, idfuncao, idempresa, tiposolicitacao, 
//                         qtdsolicitada, vlrsolicitado, status, justificativa, 
//                         idusuariosolicitante, dtsolicitada, ideventosolicitado, 
//                         categoria_log, idregistroalterado
//                     )
//                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
//                 `;

//                 // Note que passamos [dataUnica] como um array de uma posição só 
//                 // para manter a compatibilidade se o campo for DATE[] ou apenas DATE
//                 const valuesAditivo = [
//                     idorcamento,
//                     idfuncionario,
//                     idfuncao,
//                     idempresa,
//                     tipoSolicitacaoAditivo,
//                     1, 
//                     0, 
//                     'Pendente',
//                     justificativaAditivo || obsgeral,
//                     idUsuarioLogado,
//                     `{${dataUnica}}`, // Formato de array do Postgres para uma única data
//                     idevento,
//                     'aditivoextra',
//                     novoIdStaffEvento
//                 ];

//                 await client.query(queryAditivo, valuesAditivo);
//             }
//         }

//         // FIM DA TRANSAÇÃO: Se qualquer INSERT falhou acima, o código pula para o CATCH e nada é salvo.
//         await client.query('COMMIT');

//         // Preparação da resposta de log
//         res.locals.acao = 'cadastrou';
//         res.locals.idregistroalterado = novoIdStaffEvento;
//         res.locals.dadosnovos = { ...req.body, idstaffevento: novoIdStaffEvento, datasevento: datasArray };

//         res.status(201).json({ sucesso: true, message: "Sucesso", idstaffevento: novoIdStaffEvento });

//     } catch (e) {
//         if (client) await client.query('ROLLBACK');
//         console.error("❌ Erro Crítico ao salvar staff (Transação Revertida):", e);
//         res.status(500).json({ sucesso: false, error: e.message });
//     } finally { 
//         if (client) client.release(); 
//     }
// });

//salva diaria dobrada certa no staffeventos, mas não gera solicitação se for dobra reaproveitada (idfuncaodobra presente). Se for nova, gera solicitação normalmente.
// router.post("/", autenticarToken(), contextoEmpresa, verificarPermissao('staff', 'cadastrar'), 
//     uploadComprovantesMiddleware, 
//     logMiddleware('staffeventos', { 
//         buscarDadosAnteriores: async () => ({ dadosanteriores: null, idregistroalterado: null }) 
//     }), async (req, res) => {
    
//     const idUsuarioLogado = req.usuario.idusuario;
//     const body = req.body;
//     const idempresa = req.idempresa;

//     console.log("BODY DO POST STAFF", req.body);

//     const {
//         idfuncionario, nmfuncionario, idevento, nmevento, idcliente, nmcliente,
//         idfuncao, nmfuncao, idmontagem, nmlocalmontagem, pavilhao,
//         vlrcache, vlralimentacao, vlrtransporte, vlrajustecusto,
//         vlrcaixinha, datasevento, descajustecusto, descbeneficios, vlrtotal, setor,
//         statuspgto, statusajustecusto, statuscaixinha, statusdiariadobrada, statusmeiadiaria,
//         datadiariadobrada, datameiadiaria, desccaixinha, descdiariadobrada, descmeiadiaria,
//         nivelexperiencia, qtdpessoas, idequipe, nmequipe, tipoajudacustoviagem,
//         statuspgtoajdcto, statuspgtocaixinha, idorcamento, statusstaff,
//         vlrtotcache, vlrtotajdcusto, statuscustofechado, desccustofechado, obspospgto, obsgeral, 
//         tipoSolicitacaoAditivo, justificativaAditivo, datasExcecao
//     } = req.body;

//     const statusStaff = statusstaff || (justificativaAditivo ? 'Pendente' : 'Ativo');
    
//     // ====================================================================
//     // 🚀 1. TRATAMENTO DA DESCRIÇÃO DA DIÁRIA DOBRADA (IGUAL AO SEU PUT)
//     // ====================================================================
//     let descDiariaDobradaFinalText = '';
//     if (descdiariadobrada) {
//         if (Array.isArray(descdiariadobrada)) {
//             descDiariaDobradaFinalText = String(descdiariadobrada[0] || '').trim();
//         } else if (typeof descdiariadobrada === 'string' && descdiariadobrada.startsWith('{')) {
//             descDiariaDobradaFinalText = descdiariadobrada.replace(/[\{\}"]/g, '').trim();
//         } else {
//             descDiariaDobradaFinalText = String(descdiariadobrada).trim();
//         }
//     }

//     let client;

//     try {
//         client = await pool.connect();
//         await client.query('BEGIN');

//         // Tratamento das datas normais do evento
//         const parseJSON = (val) => {
//             if (!val) return [];
//             if (typeof val === 'object') return val;
//             try { return JSON.parse(val); } catch (e) { return []; }
//         };

//         const datasArray = parseJSON(datasevento);
//         const dtmeiadiaria = parseJSON(datameiadiaria);

//         // ====================================================================
//         // 🚀 2. NORMALIZAÇÃO DA DIÁRIA DOBRADA (IGUALZINHO AO SEU PUT)
//         // ====================================================================
//         let dtdiariadobrada = [];
//         try {
//             const rawDobrada = Array.isArray(datadiariadobrada) ? datadiariadobrada[0] : datadiariadobrada;
            
//             if (rawDobrada) {
//                 const parsed = typeof rawDobrada === 'object' ? rawDobrada : JSON.parse(rawDobrada);
//                 dtdiariadobrada = parsed.map(item => ({
//                     ...item,
//                     idfuncaodobra:   item.idfuncaodobra != null ? parseInt(item.idfuncaodobra)     : null,
//                     idorcamento:     item.idorcamento   != null ? parseInt(item.idorcamento)       : null,
//                     vlr_cache:       item.vlr_cache     != null ? parseFloat(item.vlr_cache)       : null,
//                     vlr_alimentacao: item.vlr_alimentacao != null ? parseFloat(item.vlr_alimentacao) : null,
//                 }));
//             }
//         } catch(e) {
//             console.error("❌ Erro ao parsear datadiariadobrada no POST:", e);
//             dtdiariadobrada = [];
//         }

//         // 3. Verificar/Criar Staff (Tabela Base)
//         const staffResult = await client.query(`
//             SELECT s.idstaff FROM staff s 
//             JOIN staffempresas se ON s.idstaff = se.idstaff 
//             WHERE s.idfuncionario = $1 AND se.idempresa = $2`, [idfuncionario, idempresa]);

//         let idstaffExistente = staffResult.rows[0]?.idstaff;
//         if (!idstaffExistente) {
//             const resS = await client.query(`INSERT INTO staff (idfuncionario) VALUES ($1) RETURNING idstaff`, [idfuncionario]);
//             idstaffExistente = resS.rows[0].idstaff;
//             await client.query(`INSERT INTO staffEmpresas (idstaff, idEmpresa) VALUES ($1, $2)`, [idstaffExistente, idempresa]);
//         }

//         // 4. Inserir na staffeventos
//         const queryInsert = `
//             INSERT INTO staffeventos (
//                 idstaff, idfuncionario, nmfuncionario, idevento, nmevento, idcliente, nmcliente,
//                 idfuncao, nmfuncao, idmontagem, nmlocalmontagem, pavilhao, vlrcache, 
//                 vlralimentacao, vlrtransporte, vlrajustecusto, vlrcaixinha, descajustecusto,
//                 datasevento, vlrtotal, comppgtocache, comppgtoajdcusto, comppgtocaixinha,
//                 descbeneficios, setor, statuspgto, statusajustecusto, statuscaixinha,
//                 statusdiariadobrada, statusmeiadiaria, dtdiariadobrada, comppgtoajdcusto50,
//                 dtmeiadiaria, desccaixinha, descdiariadobrada, descmeiadiaria, nivelexperiencia,
//                 qtdpessoaslote, idequipe, nmequipe, tipoajudacustoviagem, statuspgtocaixinha,
//                 statuspgtoajdcto, idorcamento, vlrtotcache, vlrtotajdcusto, statuscustofechado, 
//                 desccustofechado, obspospgto, obsgeral, statusstaff, compcontgastos
//             ) VALUES (
//                 $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,
//                 $26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44,$45,$46,$47,$48,
//                 $49,$50,$51,$52
//             ) RETURNING idstaffevento;
//         `;

//         const values = [
//             idstaffExistente, idfuncionario, nmfuncionario, idevento, nmevento, idcliente, nmcliente,
//             idfuncao, nmfuncao, idmontagem, nmlocalmontagem, pavilhao,
//             parseFloatOrNull(vlrcache), parseFloatOrNull(vlralimentacao),
//             parseFloatOrNull(vlrtransporte), parseFloatOrNull(vlrajustecusto), parseFloatOrNull(vlrcaixinha),
//             descajustecusto, JSON.stringify(datasArray), parseFloatOrNull(vlrtotal),
//             req.files?.comppgtocache?.[0] ? `/uploads/staff_comprovantes/${req.files.comppgtocache[0].filename}` : null,
//             req.files?.comppgtoajdcusto?.[0] ? `/uploads/staff_comprovantes/${req.files.comppgtoajdcusto[0].filename}` : null,
//             req.files?.comppgtocaixinha?.[0] ? `/uploads/staff_comprovantes/${req.files.comppgtocaixinha[0].filename}` : null,
//             descbeneficios, setor, statuspgto, statusajustecusto, statuscaixinha, statusdiariadobrada,
//             statusmeiadiaria, JSON.stringify(dtdiariadobrada), // 🚀 SALVA COMO STRING JSON EXATAMENTE IGUAL AO SEU PUT
//             req.files?.comppgtoajdcusto50?.[0] ? `/uploads/staff_comprovantes/${req.files.comppgtoajdcusto50[0].filename}` : null,
//             JSON.stringify(dtmeiadiaria), desccaixinha, descDiariaDobradaFinalText, descmeiadiaria, nivelexperiencia, qtdpessoas,
//             idequipe, nmequipe, tipoajudacustoviagem, statuspgtocaixinha, statuspgtoajdcto, idorcamento,
//             parseFloatOrNull(vlrtotcache), parseFloatOrNull(vlrtotajdcusto), statuscustofechado, desccustofechado, obspospgto, obsgeral, 
//             statusStaff, req.files?.comppgtocontgastos ? `/uploads/staff_comprovantes/${req.files.comppgtocontgastos[0].filename}` : null
//         ];

//         const resIns = await client.query(queryInsert, values);
//         const novoIdStaffEvento = resIns.rows[0].idstaffevento;

//         // ====================================================================
//         // 🚀 5. REGISTRAR SOLICITAÇÕES FINANCEIRAS (CORRIGIDO PARA ARRAY DE DATAS)
//         // ====================================================================
//         const itensFinanceiros = [
//             { status: body.statuscaixinha, campo: 'statuscaixinha', valor: body.vlrcaixinha, desc: body.desccaixinha, tipo: 'Caixinha' },
//             { status: body.statusajustecusto, campo: 'statusajustecusto', valor: body.vlrajustecusto, desc: body.descajustecusto, tipo: 'Ajuste de Custo' },
//             { status: body.statuscustofechado, campo: 'statuscustofechado', valor: body.vlrcache, desc: body.desccustofechado, tipo: 'Cachê Fechado' },
//             { status: body.statusdiariadobrada, campo: 'statusdiariadobrada', valor: 0, desc: descDiariaDobradaFinalText, tipo: 'Diária Dobrada', datas: dtdiariadobrada },
//             { status: body.statusmeiadiaria, campo: 'statusmeiadiaria', valor: 0, desc: body.descmeiadiaria, tipo: 'Meia Diária', datas: dtmeiadiaria }
//         ];

//         for (const item of itensFinanceiros) {
//             if (item.status === 'Pendente') {
//                 if (item.campo === 'statusdiariadobrada' || item.campo === 'statusmeiadiaria') {
//                     // Percorre o array de datas estruturado igualzinho ao seu PUT
//                     for (const entrada of item.datas) {
//                         const statusDec = (entrada.status || '').trim();
//                         if (!entrada.data || !statusDec) continue;

//                         const idOrcamentoRegistro = entrada.idorcamento ? parseInt(entrada.idorcamento) : parseInt(idorcamento);
//                         let justificativaItemIndividual = entrada.justificativa ? entrada.justificativa : item.desc;
//                         justificativaItemIndividual = String(justificativaItemIndividual || '').trim();

//                         if (justificativaItemIndividual.startsWith('{')) {
//                             justificativaItemIndividual = justificativaItemIndividual.replace(/[\{\}"]/g, '').trim();
//                         }

//                         await registrarSolicitacao(client, {
//                             idempresa,
//                             idorcamento: idOrcamentoRegistro,
//                             idfuncionario,
//                             idfuncao: entrada.idfuncaodobra ? entrada.idfuncaodobra : idfuncao,
//                             idstaffevento: novoIdStaffEvento,
//                             idusuariosolicitante: idUsuarioLogado,
//                             tiposolicitacao: item.tipo,
//                             categoria: item.campo,
//                             valor: item.valor,
//                             justificativa: justificativaItemIndividual,
//                             // 💡 SOLUÇÃO AQUI: Força a data individual a ir dentro de um Array [ "2026-05-10" ]
//                             // para que a função consiga salvar na coluna date[] do Postgres sem quebrar
//                             datas: [entrada.data] 
//                         });
//                     }
//                 } else {
//                     // Itens comuns (Caixinha, Ajuste, etc.) repassam todas as datas originais salvas no array
//                     await registrarSolicitacao(client, {
//                         idempresa, idorcamento, idfuncionario, idfuncao,
//                         idstaffevento: novoIdStaffEvento,
//                         idusuariosolicitante: idUsuarioLogado,
//                         tiposolicitacao: item.tipo,
//                         categoria: item.campo,
//                         valor: parseFloatOrNull(item.valor),
//                         justificativa: item.desc,
//                         datas: datasArray
//                     });
//                 }
//             }
//         }

//         // 🎯 6. VÍNCULO DE ADITIVO / EXTRA
//         if (statusStaff === 'Pendente' && tipoSolicitacaoAditivo) {
//             let datasSolicitadasArray = [];
//             try {
//                 const fonteDatas = datasExcecao 
//                     ? (Array.isArray(datasExcecao) ? datasExcecao : JSON.parse(datasExcecao))
//                     : datasArray;
                
//                 datasSolicitadasArray = fonteDatas
//                     .filter(d => d)
//                     .map(d => String(d).split('T')[0]);
                    
//             } catch (e) { 
//                 datasSolicitadasArray = datasArray.map(d => String(d).split('T')[0]);
//             }

//             for (const dataUnica of datasSolicitadasArray) {
//                 const queryAditivo = `
//                     INSERT INTO public.solicitacoes (
//                         idorcamento, idfuncionario, idfuncao, idempresa, tiposolicitacao, 
//                         qtdsolicitada, vlrsolicitado, status, justificativa, 
//                         idusuariosolicitante, dtsolicitada, ideventosolicitado, 
//                         categoria_log, idregistroalterado
//                     )
//                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
//                 `;

//                 await client.query(queryAditivo, [
//                     idorcamento, idfuncionario, idfuncao, idempresa, tipoSolicitacaoAditivo,
//                     1, 0, 'Pendente', justificativaAditivo || obsgeral, idUsuarioLogado,
//                     `{${dataUnica}}`, idevento, 'aditivoextra', novoIdStaffEvento
//                 ]);
//             }
//         }

//         await client.query('COMMIT');

//         res.locals.acao = 'cadastrou';
//         res.locals.idregistroalterado = novoIdStaffEvento;
//         res.locals.dadosnovos = { ...req.body, idstaffevento: novoIdStaffEvento, datasevento: datasArray };

//         res.status(201).json({ sucesso: true, message: "Sucesso", idstaffevento: novoIdStaffEvento });

//     } catch (e) {
//         if (client) await client.query('ROLLBACK');
//         console.error("❌ Erro Crítico ao salvar staff (Transação Revertida):", e);
//         res.status(500).json({ sucesso: false, error: e.message });
//     } finally { 
//         if (client) client.release(); 
//     }
// });

router.post("/", autenticarToken(), contextoEmpresa, verificarPermissao('staff', 'cadastrar'), 
    uploadComprovantesMiddleware, 
    logMiddleware('staffeventos', { 
        buscarDadosAnteriores: async () => ({ dadosanteriores: null, idregistroalterado: null }) 
    }), async (req, res) => {
    
    const idUsuarioLogado = req.usuario.idusuario;
    const body = req.body;
    const idempresa = req.idempresa;

    console.log("====================================================");
    console.log("🚀 [POST STAFF] - BODY RECEBIDO DO FRONT-END:");
    console.log(JSON.stringify(req.body, null, 2));
    console.log("====================================================");

    const {
        idfuncionario, nmfuncionario, idevento, nmevento, idcliente, nmcliente,
        idfuncao, nmfuncao, idmontagem, nmlocalmontagem, pavilhao,
        vlrcache, vlralimentacao, vlrtransporte, vlrajustecusto,
        vlrcaixinha, datasevento, descajustecusto, descbeneficios, vlrtotal, setor,
        statuspgto, statusajustecusto, statuscaixinha, statusdiariadobrada, statusmeiadiaria,
        datadiariadobrada, datameiadiaria, desccaixinha, descdiariadobrada, descmeiadiaria,
        nivelexperiencia, qtdpessoas, idequipe, nmequipe, tipoajudacustoviagem,
        statuspgtoajdcto, statuspgtocaixinha, idorcamento, statusstaff,
        vlrtotcache, vlrtotajdcusto, statuscustofechado, desccustofechado, obspospgto, obsgeral, 
        tipoSolicitacaoAditivo, justificativaAditivo, datasExcecao
    } = req.body;

    //const statusStaff = statusstaff || (justificativaAditivo ? 'Pendente' : 'Ativo');
    const tiposQuePermitemAtivo = [
        'Vaga Reaproveitada',
        'ALOCACAO_NORMAL'
    ];

    const statusStaff = statusstaff || (
        justificativaAditivo && tipoSolicitacaoAditivo &&
        !tiposQuePermitemAtivo.includes(tipoSolicitacaoAditivo)
            ? 'Pendente'
            : 'Ativo'
    );
   
    
    let descDiariaDobradaFinalText = '';
    if (body.descdiariadobrada) {
        if (Array.isArray(body.descdiariadobrada)) {
            // Se veio como array de textos duplicados, pega apenas o primeiro item
            descDiariaDobradaFinalText = String(body.descdiariadobrada[0] || '').trim();
        } else if (typeof body.descdiariadobrada === 'string' && body.descdiariadobrada.startsWith('{')) {
            // Evita que vire chaves do Postgres {"Texto"} e limpa resíduos de aspas e chaves
            descDiariaDobradaFinalText = body.descdiariadobrada.replace(/[\{\}"]/g, '').trim();
        } else {
            descDiariaDobradaFinalText = String(body.descdiariadobrada).trim();
        }
    }

    let client;

    try {
        client = await pool.connect();
        await client.query('BEGIN');

        const parseJSON = (val) => {
            if (!val) return [];
            if (typeof val === 'object') return val;
            try { return JSON.parse(val); } catch (e) { return []; }
        };

        const datasArray = parseJSON(datasevento);
        const dtmeiadiaria = parseJSON(datameiadiaria);

        let dtdiariadobrada = [];
        try {
            const rawDobrada = Array.isArray(body.datadiariadobrada) 
                ? body.datadiariadobrada[0]   // se veio duplicado, pega o primeiro
                : body.datadiariadobrada;
            
            if (rawDobrada) {
                const parsed = typeof rawDobrada === 'object' ? rawDobrada : JSON.parse(rawDobrada);
                // Normaliza os tipos numéricos que chegam como string via formData
                dtdiariadobrada = parsed.map(item => ({
                    ...item,
                    idfuncaodobra:   item.idfuncaodobra != null ? parseInt(item.idfuncaodobra)     : null,
                    idorcamento:     item.idorcamento   != null ? parseInt(item.idorcamento)       : null,
                    vlr_cache:       item.vlr_cache     != null ? parseFloat(item.vlr_cache)       : null,
                    vlr_alimentacao: item.vlr_alimentacao != null ? parseFloat(item.vlr_alimentacao) : null,
                }));
            }
        } catch(e) {
            console.error("❌ Erro ao parsear datadiariadobrada:", e);
            dtdiariadobrada = [];
        }

        // ====================================================================
        // 🚀 TRATAMENTO DE DATADIARIADOBRADA ANTI-DUPLICAÇÃO (IGUAL AO PUT)
        // ====================================================================
      
        // let dtdiariadobrada = [];
        // let descDiariaDobradaFinalText = body.descdiariadobrada || "";
        // const tagsDescricaoGeral = [];

        // try {
        //     const rawDobrada = Array.isArray(body.datadiariadobrada) 
        //         ? body.datadiariadobrada[0] 
        //         : body.datadiariadobrada;
            
        //     if (rawDobrada) {
        //         const parsed = typeof rawDobrada === 'object' ? rawDobrada : JSON.parse(rawDobrada);
                
        //        // ✅ DEPOIS — usa a justificativa pronta do front, sem reconstruir
        //         dtdiariadobrada = parsed.map(item => {
        //             const dataFormatadaBR = item.data.split('-').reverse().join('/');

        //             // Usa direto o que veio do front (já tem o nome correto da função)
        //             // Remove a tag de data se vier duplicada, mas preserva o conteúdo
        //             let textoLimpo = item.justificativa
        //                 ? item.justificativa.replace(/\[Diária Dobrada\s+\d{2}\/\d{2}\/\d{4}\]\s*/g, '').trim()
        //                 : '';

        //             const tagComData = `[Diária Dobrada ${dataFormatadaBR}] ${textoLimpo}`;
        //             tagsDescricaoGeral.push(tagComData);

        //             return {
        //                 data: item.data,
        //                 justificativa: textoLimpo,
        //                 idfuncaodobra:   item.idfuncaodobra   != null ? parseInt(item.idfuncaodobra)    : (item.idFuncaoDobra    != null ? parseInt(item.idFuncaoDobra)    : null),
        //                 idorcamento:     item.idorcamento     != null ? parseInt(item.idorcamento)      : (item.idOrcamento      != null ? parseInt(item.idOrcamento)      : null),
        //                 vlr_cache:       item.vlr_cache       != null ? parseFloat(item.vlr_cache)      : (item.vlrCache         != null ? parseFloat(item.vlrCache)        : null),
        //                 vlr_alimentacao: item.vlr_alimentacao != null ? parseFloat(item.vlr_alimentacao): (item.vlrAlimentacao   != null ? parseFloat(item.vlrAlimentacao)  : null),
        //                 setordobra:      item.setordobra || item.setorDobra || '',
        //                 status:          item.status || 'Pendente'
        //             };
        //         });

        //         // Se o campo geral veio vazio do front, alimenta ele com a junção das tags usando o separador '|'
        //         if (!descDiariaDobradaFinalText && tagsDescricaoGeral.length > 0) {
        //             descDiariaDobradaFinalText = tagsDescricaoGeral.join(' | ');
        //         }
        //     }
        // } catch(e) {
        //     console.error("❌ Erro ao parsear datadiariadobrada no POST:", e);
        //     dtdiariadobrada = [];
        // }



        console.log("🔍 [PROCESSED] dtdiariadobrada 100% normalizado no POST:", JSON.stringify(dtdiariadobrada, null, 2));
        console.log("🔍 [PROCESSED] dtdiariadobrada normalizado:", dtdiariadobrada);

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

        console.log("📝 descDiariaDobradaFinalText que vai salvar:", descDiariaDobradaFinalText);
       // console.log("📝 tagsDescricaoGeral:", tagsDescricaoGeral);

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
                statuspgtoajdcto, idorcamento, vlrtotcache, vlrtotajdcusto, statuscustofechado, 
                desccustofechado, obspospgto, obsgeral, statusstaff, compcontgastos
            ) VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,
                $26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44,$45,$46,$47,$48,
                $49,$50,$51,$52
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
            statusmeiadiaria, JSON.stringify(dtdiariadobrada), 
            req.files?.comppgtoajdcusto50?.[0] ? `/uploads/staff_comprovantes/${req.files.comppgtoajdcusto50[0].filename}` : null,
            JSON.stringify(dtmeiadiaria), desccaixinha, descDiariaDobradaFinalText, descmeiadiaria, nivelexperiencia, qtdpessoas,
            idequipe, nmequipe, tipoajudacustoviagem, statuspgtocaixinha, statuspgtoajdcto, idorcamento,
            parseFloatOrNull(vlrtotcache), parseFloatOrNull(vlrtotajdcusto), statuscustofechado, desccustofechado, obspospgto, obsgeral, 
            statusStaff, req.files?.comppgtocontgastos ? `/uploads/staff_comprovantes/${req.files.comppgtocontgastos[0].filename}` : null
        ];

        const resIns = await client.query(queryInsert, values);
        const novoIdStaffEvento = resIns.rows[0].idstaffevento;
        console.log(`📌 [INSERT STAFFEVENTOS] - Sucesso! ID Gerado: ${novoIdStaffEvento}`);

        // ====================================================================
        // 🚀 5. REGISTRAR SOLICITAÇÕES FINANCEIRAS
        // ====================================================================
        const itensFinanceiros = [
            { status: body.statuscaixinha, campo: 'statuscaixinha', valor: body.vlrcaixinha, desc: body.desccaixinha, tipo: 'Caixinha' },
            { status: body.statusajustecusto, campo: 'statusajustecusto', valor: body.vlrajustecusto, desc: body.descajustecusto, tipo: 'Ajuste de Custo' },
            { status: body.statuscustofechado, campo: 'statuscustofechado', valor: body.vlrcache, desc: body.desccustofechado, tipo: 'Cachê Fechado' },
            { status: body.statusdiariadobrada, campo: 'statusdiariadobrada', valor: 0, desc: descDiariaDobradaFinalText, tipo: 'Diária Dobrada', datas: dtdiariadobrada },
            { status: body.statusmeiadiaria, campo: 'statusmeiadiaria', valor: 0, desc: body.descmeiadiaria, tipo: 'Meia Diária', datas: dtmeiadiaria }
        ];

        for (const item of itensFinanceiros) {
            if (item.status === 'Pendente') {
                if (item.campo === 'statusdiariadobrada' || item.campo === 'statusmeiadiaria') {
                    
                    for (const entrada of item.datas) {
                        const statusDec = (entrada.status || item.status || '').trim();
                        if (!entrada.data || !statusDec) continue;

                        const idOrcamentoRegistro = entrada.idorcamento ? parseInt(entrada.idorcamento) : parseInt(body.idorcamento);
                        
                        // Captura a justificativa que já foi limpa no passo anterior (sem a tag de data)
                        let justificativaItemIndividual = entrada.justificativa || item.desc;

                        if (Array.isArray(justificativaItemIndividual)) {
                            justificativaItemIndividual = String(justificativaItemIndividual[0] || '').trim();
                        } else {
                            justificativaItemIndividual = String(justificativaItemIndividual || '').trim();
                        }

                        if (justificativaItemIndividual.startsWith('{')) {
                            justificativaItemIndividual = justificativaItemIndividual.replace(/[\{\}"]/g, '').trim();
                        }

                        const dataFormatadaPostgres = `{${String(entrada.data).trim()}}`;

                        await registrarSolicitacao(client, {
                            idempresa,
                            idorcamento: idOrcamentoRegistro,
                            idfuncionario,
                            idfuncao: entrada.idfuncaodobra ? entrada.idfuncaodobra : idfuncao,
                            idstaffevento: novoIdStaffEvento,
                            idusuariosolicitante: idUsuarioLogado,
                            tiposolicitacao: item.tipo,
                            categoria: item.campo,
                            valor: item.valor,
                            justificativa: justificativaItemIndividual, // Grava "Consumiu vaga da função..."
                            datas: dataFormatadaPostgres 
                        });
                    }
                } else {
                    // Bloco para itens comuns (Caixinha, Ajuste de Custo, Cachê Fechado)
                    let justificativaComum = item.desc;
                    if (Array.isArray(justificativaComum)) {
                        justificativaComum = String(justificativaComum[0] || '').trim();
                    } else {
                        justificativaComum = String(justificativaComum || '').trim();
                    }

                    if (justificativaComum.startsWith('{')) {
                        justificativaComum = justificativaComum.replace(/[\{\}"]/g, '').trim();
                    }

                    const formatoDatasGeral = `{${datasArray.map(d => String(d).trim()).join(',')}}`;
                    
                    await registrarSolicitacao(client, {
                        idempresa, idorcamento, idfuncionario, idfuncao,
                        idstaffevento: novoIdStaffEvento,
                        idusuariosolicitante: idUsuarioLogado,
                        tiposolicitacao: item.tipo,
                        categoria: item.campo,
                        valor: parseFloat(item.valor || 0),
                        justificativa: justificativaComum,
                        datas: formatoDatasGeral
                    });
                }
            }
        }

        // 🎯 6. VÍNCULO DE ADITIVO / EXTRA
        if (statusStaff === 'Pendente' && tipoSolicitacaoAditivo) {
            console.log(`\n➕ [ADITIVO/EXTRA DETECTADO]: ${tipoSolicitacaoAditivo}`);
            let datasSolicitadasArray = [];
            try {
                const fonteDatas = datasExcecao 
                    ? (Array.isArray(datasExcecao) ? datasExcecao : JSON.parse(datasExcecao))
                    : datasArray;
                
                datasSolicitadasArray = fonteDatas
                    .filter(d => d)
                    .map(d => String(d).split('T')[0]);
                    
            } catch (e) { 
                datasSolicitadasArray = datasArray.map(d => String(d).split('T')[0]);
            }

            for (const dataUnica of datasSolicitadasArray) {
                const queryAditivo = `
                    INSERT INTO public.solicitacoes (
                        idorcamento, idfuncionario, idfuncao, idempresa, tiposolicitacao, 
                        qtdsolicitada, vlrsolicitado, status, justificativa, 
                        idusuariosolicitante, dtsolicitada, ideventosolicitado, 
                        categoria_log, idregistroalterado
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                `;

                console.log(`  💾 Gravando exceção para data: ${dataUnica}`);
                await client.query(queryAditivo, [
                    idorcamento, idfuncionario, idfuncao, idempresa, tipoSolicitacaoAditivo,
                    1, 0, 'Pendente', justificativaAditivo || obsgeral, idUsuarioLogado,
                    `{${dataUnica}}`, idevento, 'aditivoextra', novoIdStaffEvento
                ]);
            }
        }

        await client.query('COMMIT');
        console.log("\n🚀 [COMMIT] - Transação finalizada e salva no banco de dados com sucesso!");

        res.locals.acao = 'cadastrou';
        res.locals.idregistroalterado = novoIdStaffEvento;
        res.locals.dadosnovos = { ...req.body, idstaffevento: novoIdStaffEvento, datasevento: datasArray };

        res.status(201).json({ sucesso: true, message: "Sucesso", idstaffevento: novoIdStaffEvento });

    } catch (e) {
        if (client) await client.query('ROLLBACK');
        console.error("\n❌ Erro Crítico ao salvar staff (Transação Revertida):", e);
        res.status(500).json({ sucesso: false, error: e.message });
    } finally { 
        if (client) client.release(); 
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
                let filtroDataExcedida = "";

                if (dataSolicitada && dataSolicitada !== 'undefined' && dataSolicitada !== '') {
                    const arrayDatas = dataSolicitada.split(',').map(d => d.trim());
                    paramsFE.push(arrayDatas);
                    filtroDataExcedida = ` AND (s.dtsolicitada && $${paramsFE.length}::date[])`;
                }

                // BUSCA 1: Solicitação IDÊNTICA (mesmo evento + mesma função + mesma data)
                // Para bloquear completamente
                const paramsDuplicata = [...paramsFE];
                let filtroDuplicata = filtroDataExcedida;

                if (idOrcamento) {
                    paramsDuplicata.push(idOrcamento);
                    filtroDuplicata += ` AND s.idorcamento = $${paramsDuplicata.length}`;
                }

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

                console.log("🔍 Query de Verificação de Duplicata (FuncExcedido):", queryDuplicata);
                const paramsGeral = [...paramsFE];
                paramsGeral.push(idOrcamento);
                const idxOrcamento = paramsGeral.length;
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
                    AND s.idorcamento = $${idxOrcamento}        
                    AND s.tipoSolicitacao ILIKE '%FuncExcedido%'
                    AND s.status IN ('Pendente', 'Autorizado')                   
                    ${filtroDataExcedida}
                    ORDER BY s.dtSolicitacao DESC LIMIT 1
                `;

                console.log("🔍 Query de Verificação Geral (FuncExcedido):", queryGeral);

                const resultGeral = await pool.query(queryGeral, paramsGeral);
                const solicitacaoGeral = resultGeral.rows[0] || null;
                
                return res.json({
                    sucesso: true,
                    dados: {
                        solicitacaoDuplicada,           // ← mesma data + mesmo evento + mesma função = BLOQUEAR
                        solicitacaoRecente: solicitacaoGeral, // ← mesma data, qualquer evento = AVISAR
                        //autorizadoEspecifico: solicitacaoGeral?.status === 'Autorizado' && 
                        //                    String(solicitacaoGeral?.ideventosolicitado) === String(idEventoSolicitado), 
                        autorizadoEspecifico: solicitacaoGeral?.status === 'Autorizado' &&
                            String(solicitacaoGeral?.idorcamento) === String(idOrcamento) &&
                            (
                                String(solicitacaoGeral?.ideventosolicitado) === String(idEventoSolicitado) ||
                                String(solicitacaoGeral?.ideventoconflitante) === String(idEventoConflitante)
                            ),
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

            let filtroDataPadrao = "";
            if (dataSolicitada && dataSolicitada !== 'undefined' && dataSolicitada !== '') {
                const dataIndex = params.length + 1;
                const arrayDatas = dataSolicitada.split(',').map(d => d.trim());
                filtroDataPadrao = ` AND (s.dtsolicitada && $${dataIndex}::date[] OR s.dtsolicitada IS NULL)`;
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
                ${filtroDataPadrao}
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