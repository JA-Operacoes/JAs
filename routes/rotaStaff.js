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
          cf.ctofuncaobase, cf.ctofuncaojunior, cf.ctofuncaopleno, cf.ctofuncaosenior, cf.transporte, cf.transpsenior, cf.alimentacao, cf.vlrfuncionario
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
            datasEvento = [],
        } = req.body;

        const idempresa = req.idempresa;

        console.log("ORCAMENTO/CONSULTAR", req.body);

        if (!idEvento || !idCliente || !idLocalMontagem || !idFuncao) {
            return res
              .status(400)
              .json({
        error: "IDs de Evento, Cliente, Local de Montagem e Função são obrigatórios.",
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
                AND oi.idfuncao IS NOT NULL
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
        ];

        const result = await client.query(query, values);
        const orcamentoItems = result.rows;

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
        console.log("QUERY DINÂMICA:", query);
        console.log("VALUES DA QUERY:", queryValues);

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
                se.idstaffevento,
                se.idfuncao 
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
      vlrcache, vlrajustecusto, vlrtransporte, vlralimentacao, vlrcaixinha,
      descajustecusto, datasevento, vlrtotal, descbeneficios, setor, statuspgto, 
      statusajustecusto, statuscaixinha, statusdiariadobrada, statusmeiadiaria, datadiariadobrada, datameiadiaria,
      desccaixinha, descdiariadobrada, descmeiadiaria, nivelexperiencia, qtdpessoas, idequipe, nmequipe, tipoajudacustoviagem,  
      statuspgtoajdcto, statuspgtocaixinha, idorcamento
    } = req.body;

    console.log("BACKEND", req.body);

    // const dataDiariaDobradaCorrigida = (datadiariadobrada === '' || datadiariadobrada === '[]' || !datadiariadobrada) 
    //   ? null 
    //   : datadiariadobrada;

    // const dataMeiaDiariaCorrigida = (datameiadiaria === '' || datameiadiaria === '[]' || !datameiadiaria) 
    //   ? null 
    //   : datameiadiaria;

    // No início da função, após a desestruturação do 'req.body'


    let datasDiariaDobradaParsed = null;
    if (datadiariadobrada) {
      try {
      datasDiariaDobradaParsed = JSON.parse(datadiariadobrada);
      if (Array.isArray(datasDiariaDobradaParsed)) {
        datasDiariaDobradaParsed = ordenarDatas(datasDiariaDobradaParsed);
      }
      } catch (parseError) {
      console.error("Erro ao parsear datadiariadobrada:", parseError);
      }
    }

    let datasMeiaDiariaParsed = null;
    if (datameiadiaria) {
      try {
      datasMeiaDiariaParsed = JSON.parse(datameiadiaria);
      if (Array.isArray(datasMeiaDiariaParsed)) {
        datasMeiaDiariaParsed = ordenarDatas(datasMeiaDiariaParsed);
      }
      } catch (parseError) {
      console.error("Erro ao parsear datameiadiaria:", parseError);
      }
    }

    // let datasDiariaDobradaParsed = null;

    // if (datadiariadobrada && datadiariadobrada !== "" && datadiariadobrada !== "[]") {
    //   try {
    //     const json = JSON.parse(datadiariadobrada);
    //     datasDiariaDobradaParsed = Array.isArray(json) ? ordenarDatas(json) : null;
    //   } catch (err) {
    //     console.warn("Aviso: datadiariadobrada inválido:", err.message);
    //   }
    // }

    // let datasMeiaDiariaParsed = null;

    // if (datameiadiaria && datameiadiaria !== "" && datameiadiaria !== "[]") {
    //   try {
    //     const json = JSON.parse(datameiadiaria);
    //     datasMeiaDiariaParsed = Array.isArray(json) ? ordenarDatas(json) : null;
    //   } catch (err) {
    //     console.warn("Aviso: datameiadiaria inválido:", err.message);
    //   }
    // }

    const files = req.files;
    const comprovanteCacheFile = files?.comppgtocache ? files.comppgtocache[0] : null;
    const comprovanteAjdCustoFile = files?.comppgtoajdcusto ? files.comppgtoajdcusto[0] : null;
    const comprovanteAjdCusto50File = files?.comppgtoajdcusto50 ? files.comppgtoajdcusto50[0] : null;
    const comprovanteCaixinhaFile = files?.comppgtocaixinha ? files.comppgtocaixinha[0] : null;
     
    console.log("BODY ROTA PUT", req.body);

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
      // === ADICIONADO AQUI ===
      datasEventoParsed = ordenarDatas(datasEventoParsed);
    } catch (parseError) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: "Formato de 'datasevento' inválido. Esperado um array JSON.", details: parseError.message });
    }
      }
      console.log('Valor de "datasevento" após parse:', datasEventoParsed);

      const oldRecordResult = await client.query(            
    `select  se.comppgtocache, se.comppgtoajdcusto, se.comppgtocaixinha, se.comppgtoajdcusto50 from staffeventos se
        inner join staff s ON se.idfuncionario = s.idfuncionario
        inner join staffempresas semp on s.idstaff = semp.idstaff
        where se.idstaffevento = $1 and semp.idempresa = $2`,
    [idStaffEvento, idempresa]
      );
      const oldRecord = oldRecordResult.rows[0];
      console.log("Old Record retrieved:", oldRecord);

      
      let newComppgtoCachePath = oldRecord ? oldRecord.comppgtocache : null;
      if (comprovanteCacheFile) {         
        deletarArquivoAntigo(oldRecord?.comppgtocache);
        newComppgtoCachePath = `/uploads/staff_comprovantes/${comprovanteCacheFile.filename}`;
      }            
      else if (req.body.limparComprovanteCache === 'true') {            
        console.log("Removendo comprovante de cache...");
        deletarArquivoAntigo(oldRecord?.comppgtocache);
        newComppgtoCachePath = null; 
      }
      
      let newComppgtoAjdCustoPath = oldRecord ? oldRecord.comppgtoajdcusto : null;
      if (comprovanteAjdCustoFile) {
        deletarArquivoAntigo(oldRecord?.comppgtoajdcusto);
        newComppgtoAjdCustoPath = `/uploads/staff_comprovantes/${comprovanteAjdCustoFile.filename}`;
      } else if (req.body.limparComprovanteAjdCusto === 'true') {
        deletarArquivoAntigo(oldRecord?.comppgtoajdcusto);
        newComppgtoAjdCustoPath = null;
      }

      let newComppgtoAjdCusto50Path = oldRecord ? oldRecord.comppgtoajdcusto50 : null;
      if (comprovanteAjdCusto50File) {
        deletarArquivoAntigo(oldRecord?.comppgtoajdcusto50);
        newComppgtoAjdCusto50Path = `/uploads/staff_comprovantes/${comprovanteAjdCusto50File.filename}`;
      } else if (req.body.limparComprovanteAjdCusto50 === 'true') {
        deletarArquivoAntigo(oldRecord?.comppgtoajdcusto50);
        newComppgtoAjdCusto50Path = null;
      }
      
      let newComppgtoCaixinhaPath = oldRecord ? oldRecord.comppgtocaixinha : null;
      if (comprovanteCaixinhaFile) {
        deletarArquivoAntigo(oldRecord?.comppgtocaixinha);
        newComppgtoCaixinhaPath = `/uploads/staff_comprovantes/${comprovanteCaixinhaFile.filename}`;
      } else if (req.body.limparComprovanteCaixinha === 'true') {
        deletarArquivoAntigo(oldRecord?.comppgtocaixinha);
        newComppgtoCaixinhaPath = null;
      }

      //JSON.stringify(datasEventoParsed),
      
      const queryStaffEventos = `
        UPDATE staffeventos se
        SET
          idfuncionario = $1, nmfuncionario = $2, idfuncao = $3, nmfuncao = $4,
          idcliente = $5, nmcliente = $6, idevento = $7, nmevento = $8, idmontagem = $9,
          nmlocalmontagem = $10, pavilhao = $11, vlrcache = $12, vlrajustecusto = $13, vlrtransporte = $14,
          vlralimentacao = $15, vlrcaixinha = $16, descajustecusto = $17,
          datasevento = $18, vlrtotal = $19,
          descbeneficios = $20, setor = $21, statuspgto = $22, statusajustecusto = $23,
          statuscaixinha = $24, statusdiariadobrada = $25, statusmeiadiaria = $26,
          dtdiariadobrada = $27, dtmeiadiaria = $28,
          desccaixinha = $29, descdiariadobrada = $30, descmeiadiaria = $31,
          comppgtocache = $32, comppgtoajdcusto = $33, comppgtoajdcusto50 = $34, comppgtocaixinha = $35, 
          nivelexperiencia = $36, qtdpessoaslote = $37, idequipe = $38, nmequipe = $39, tipoajudacustoviagem = $40,
          statuspgtoajdcto = $41, statuspgtocaixinha = $42, idorcamento = $43
        FROM staff s
        INNER JOIN staffempresas sme ON sme.idstaff = s.idstaff
        WHERE se.idstaff = s.idstaff AND se.idstaffevento = $44 AND sme.idempresa = $45
        RETURNING se.idstaffevento, se.datasevento;
      
      `;

      const valuesStaffEventos = [
      // Campos de dados
      idfuncionario, nmfuncionario, idfuncao, nmfuncao,
      idcliente, nmcliente, idevento, nmevento, idmontagem,
      nmlocalmontagem, pavilhao,
      // Valores numéricos
      parseFloat(String(vlrcache).replace(',', '.')) || 0,
      parseFloat(String(vlrajustecusto).replace(',', '.')) || 0,
      parseFloat(String(vlrtransporte).replace(',', '.')) || 0,
      parseFloat(String(vlralimentacao).replace(',', '.')) || 0,
      parseFloat(String(vlrcaixinha).replace(',', '.')) || 0,
      // Descrições e JSON
      descajustecusto,
      JSON.stringify(datasEventoParsed),
      parseFloat(String(vlrtotal).replace(',', '.')) || 0,
      descbeneficios, setor,
      // Status de pagamento
      statuspgto, statusajustecusto, statuscaixinha,
      statusdiariadobrada, statusmeiadiaria,
      //dataDiariaDobradaCorrigida, dataMeiaDiariaCorrigida,
      JSON.stringify(datasDiariaDobradaParsed), 
      JSON.stringify(datasMeiaDiariaParsed),
      desccaixinha, descdiariadobrada, descmeiadiaria,
      // Caminhos dos comprovantes
      newComppgtoCachePath, newComppgtoAjdCustoPath, newComppgtoAjdCusto50Path, newComppgtoCaixinhaPath,
      nivelexperiencia, qtdpessoas, idequipe, nmequipe, tipoajudacustoviagem, statuspgtoajdcto, statuspgtocaixinha, idorcamento,
      // Parâmetros de identificação da linha
      idStaffEvento, idempresa
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
      if (comprovanteCaixinhaFile) deletarArquivoAntigo(`/uploads/staff_comprovantes/${comprovanteCaixinhaFile.filename}`);
      if (comprovanteAjdCusto50File) deletarArquivoAntigo(`/uploads/staff_comprovantes/${comprovanteAjdCusto50File.filename}`);
        
      if (error.code === '23502') {
      return res.status(400).json({ message: `Campo obrigatório faltando ou inválido: ${error.column}. Por favor, verifique os dados e tente novamente.`, details: error.message });
      }
      // Adicionado tratamento para erro de formato de número/float
      if (error.code === '22P02') { // Erro de sintaxe de entrada inválida (como texto em float)
      return res.status(400).json({
    message: "Um valor numérico inválido foi fornecido. Por favor, verifique os campos de custo, extra, transporte, alimentação, equipe e caixinha.",
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

function ordenarDatas(datas) {
    if (!datas || datas.length === 0) {
    return [];
    }
    // Supondo que as datas estejam no formato 'YYYY-MM-DD'
    return datas.sort((a, b) => new Date(a) - new Date(b));
}

// ...existing code...

router.post(
  "/",
  autenticarToken(),
  contextoEmpresa,
  verificarPermissao('staff', 'cadastrar'),
  uploadComprovantesMiddleware,
  // Registrar o log como 'staffeventos' para refletir corretamente o insert em staffeventos
  logMiddleware('staffeventos', {
    buscarDadosAnteriores: async (req) => {
  console.log("BUSCA DADOS ANTERIORES STAFFEVENTOS (POST)");
  return { dadosanteriores: null, idregistroalterado: null };
    }
  }),
  async (req, res) => {
    console.log("🔥 Rota /staff/POST acessada", req.body);

    const {
      idfuncionario,
      avaliacao,
      idevento, nmevento, idcliente, nmcliente,
      idfuncao, nmfuncao, idmontagem, nmlocalmontagem, pavilhao,
      vlrcache, vlralmoco, vlralimentacao, vlrtransporte, vlrajustecusto,
      vlrcaixinha, nmfuncionario, datasevento: datasEventoRaw,
      descajustecusto, descbeneficios, vlrtotal, setor, statuspgto, statusajustecusto, statuscaixinha,
      statusdiariadobrada, statusmeiadiaria, datadiariadobrada, datameiadiaria, desccaixinha,
      descdiariadobrada, descmeiadiaria, nivelexperiencia, qtdpessoas, idequipe, nmequipe, tipoajudacustoviagem,
      statuspgtoajdcto, statuspgtocaixinha, idorcamento
    } = req.body;

    // Parse opcionais de datas (sem rollback aqui, só validação)
    let datasDiariaDobradaParsed = null;
    if (datadiariadobrada) {
      try {
        datasDiariaDobradaParsed = JSON.parse(datadiariadobrada);
        if (Array.isArray(datasDiariaDobradaParsed)) {
          datasDiariaDobradaParsed = ordenarDatas(datasDiariaDobradaParsed);
        }
      } catch (parseError) {
        console.warn("Aviso: datadiariadobrada inválido:", parseError.message);
      }
    }

    let datasMeiaDiariaParsed = null;
    if (datameiadiaria) {
      try {
        datasMeiaDiariaParsed = JSON.parse(datameiadiaria);
        if (Array.isArray(datasMeiaDiariaParsed)) {
          datasMeiaDiariaParsed = ordenarDatas(datasMeiaDiariaParsed);
        }
      } catch (parseError) {
        console.warn("Aviso: datameiadiaria inválido:", parseError.message);
      }
    }

    
    let datasEventoParsed = null;
    if (datasEventoRaw) {
      try {
        datasEventoParsed = JSON.parse(datasEventoRaw);
        if (!Array.isArray(datasEventoParsed)) {
          return res.status(400).json({ message: "Formato de 'datasevento' inválido. Esperado um array JSON." });
        }
        datasEventoParsed = ordenarDatas(datasEventoParsed);
      } catch (parseError) {
        return res.status(400).json({ message: "Formato de 'datasevento' inválido. Esperado um array JSON.", details: parseError.message });
      }
    }

    const files = req.files;
    const comprovanteCacheFile = files?.comppgtocache ? files.comppgtocache[0] : null;
    const comprovanteAjdCustoFile = files?.comppgtoajdcusto ? files.comppgtoajdcusto[0] : null;
    const comprovanteCaixinhaFile = files?.comppgtocaixinha ? files.comppgtocaixinha[0] : null;
    const comprovanteAjdCusto50File = files?.comppgtoajdcusto50 ? files.comppgtoajdcusto50[0] : null;

    const idempresa = req.idempresa;
    let client;

    console.log('--- Início da requisição POST /staff ---');

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

    let idstaffExistente;
    if (staffResult.rows.length > 0) {
      idstaffExistente = staffResult.rows[0].idstaff;
      console.log(`idfuncionario ${idfuncionario} já existe. Usando idstaff existente: ${idstaffExistente}`);

      if (avaliacao) {
        const updateAvaliacaoQuery = `UPDATE staff SET avaliacao = $1 WHERE idstaff = $2`;
        await client.query(updateAvaliacaoQuery, [avaliacao, idstaffExistente]);
        console.log(`Avaliação do staff ${idstaffExistente} atualizada.`);
      }
    } else {
      console.log(`idfuncionario ${idfuncionario} não encontrado. Criando novo staff.`);
      const staffInsertQuery = `
        INSERT INTO staff (idfuncionario, avaliacao)
        VALUES ($1, $2)
        RETURNING idstaff;
      `;
      const resultStaff = await client.query(staffInsertQuery, [idfuncionario, avaliacao]);
      idstaffExistente = resultStaff.rows[0].idstaff;
      await client.query("INSERT INTO staffEmpresas (idstaff, idEmpresa) VALUES ($1, $2)", [idstaffExistente, idempresa]);
      console.log(`Novo staff ${idstaffExistente} criado e associado à empresa ${idempresa}.`);
    }

    // --- PASSO 2: INSERÇÃO NA TABELA STAFFEVENTOS ---
    if (!idstaffExistente) throw new Error("Falha lógica: idstaff não foi determinado para a inserção do evento.");

    const eventoInsertQuery = `
      INSERT INTO staffeventos (
        idstaff, idfuncionario, nmfuncionario, idevento, nmevento, idcliente, nmcliente,
        idfuncao, nmfuncao, idmontagem, nmlocalmontagem, pavilhao,
        vlrcache, vlralmoco, vlralimentacao, vlrtransporte, vlrajustecusto,
        vlrcaixinha, descajustecusto, datasevento, vlrtotal, comppgtocache, comppgtoajdcusto, comppgtocaixinha,
        descbeneficios, setor, statuspgto, statusajustecusto, statuscaixinha, statusdiariadobrada, statusmeiadiaria, dtdiariadobrada,
        comppgtoajdcusto50, dtmeiadiaria, desccaixinha, descdiariadobrada, descmeiadiaria, nivelexperiencia, qtdpessoaslote, idequipe, 
        nmequipe, tipoajudacustoviagem, statuspgtocaixinha, statuspgtoajdcto, idorcamento
        
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44, $45
      )
      RETURNING idstaffevento;
    `;

    const parseFloatOrNull = v => {
      if (v === undefined || v === null || v === '') return null;
      const n = parseFloat(String(v).replace(',', '.'));
      return Number.isNaN(n) ? null : n;
    };

    const eventoInsertValues = [
      idstaffExistente, idfuncionario, nmfuncionario, idevento, nmevento, idcliente, nmcliente,
      idfuncao, nmfuncao, idmontagem, nmlocalmontagem, pavilhao,
      parseFloatOrNull(vlrcache),
      parseFloatOrNull(vlralmoco),
      parseFloatOrNull(vlralimentacao),
      parseFloatOrNull(vlrtransporte),
      parseFloatOrNull(vlrajustecusto),
      parseFloatOrNull(vlrcaixinha),
      descajustecusto,
      JSON.stringify(datasEventoParsed),
      parseFloatOrNull(vlrtotal),
      comprovanteCacheFile ? `/uploads/staff_comprovantes/${comprovanteCacheFile.filename}` : null,
      comprovanteAjdCustoFile ? `/uploads/staff_comprovantes/${comprovanteAjdCustoFile.filename}` : null,
      comprovanteCaixinhaFile ? `/uploads/staff_comprovantes/${comprovanteCaixinhaFile.filename}` : null,
      descbeneficios,
      setor,
      statuspgto,
      statusajustecusto,
      statuscaixinha,
      statusdiariadobrada,
      statusmeiadiaria,
      JSON.stringify(datasDiariaDobradaParsed),
      comprovanteAjdCusto50File ? `/uploads/staff_comprovantes/${comprovanteAjdCusto50File.filename}` : null,
      JSON.stringify(datasMeiaDiariaParsed),
      desccaixinha,
      descdiariadobrada,
      descmeiadiaria,
      nivelexperiencia,
      qtdpessoas,
      idequipe, nmequipe, tipoajudacustoviagem, statuspgtocaixinha, statuspgtoajdcto, idorcamento
    
    ];

    const insertResult = await client.query(eventoInsertQuery, eventoInsertValues);
    const novoIdStaffEvento = insertResult.rows?.[0]?.idstaffevento || null;
    console.log(`Novo evento para o staff ${idstaffExistente} inserido em staffeventos. idstaffevento=${novoIdStaffEvento}`);

    await client.query('COMMIT');

    // Ajusta log/res.locals para indicar o id do registro criado (staffeventos)
    res.locals.acao = 'cadastrou';
    res.locals.idregistroalterado = novoIdStaffEvento || idstaffExistente;
    res.locals.idusuarioAlvo = idfuncionario;

    return res.status(201).json({
      message: "Evento(s) salvo(s) e associado(s) ao staff com sucesso!",
      idstaff: idstaffExistente,
      idstaffevento: novoIdStaffEvento
    });

      } catch (error) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch (e) { console.error('Erro ao ROLLBACK:', e); }
    }
    console.error("❌ Erro ao salvar staff ou evento:", error);

    // elimina arquivos temporários enviados em caso de erro
    if (files?.comppgtocache?.[0]) deletarArquivoAntigo(files.comppgtocache[0].path);
    if (files?.comppgtoajdcusto?.[0]) deletarArquivoAntigo(files.comppgtoajdcusto[0].path);
    if (files?.comppgtoajdcusto50?.[0]) deletarArquivoAntigo(files.comppgtoajdcusto50[0].path);
    if (files?.comppgtocaixinha?.[0]) deletarArquivoAntigo(files.comppgtocaixinha[0].path);

    if (error.code === '23502') {
      return res.status(400).json({ message: `Campo obrigatório faltando ou inválido: ${error.column}.`, details: error.message });
    }
    if (error.code === '22P02') {
      return res.status(400).json({ message: "Valor numérico inválido. Verifique os campos de valor.", details: error.message });
    }
    return res.status(500).json({ error: "Erro ao salvar funcionário/evento", details: error.message });
      } finally {
    if (client) client.release();
    console.log('--- Fim da requisição POST /staff ---');
      }
    }
);

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

    // 1. Desestruturar, Sanitizar e INCLUIR idEmpresa
    const { 
      idOrcamento, 
      idFuncao, 
      qtdSolicitada, 
      tipoSolicitacao, 
      justificativa, 
      idFuncionario  
    } = req.body; 

    const idEmpresaContexto = req.empresa?.idempresa || req.idempresa;
    const idUsuarioSolicitante = req.usuario?.idusuario; 
    
    // 💡 NOVO: Status inicial
    const statusInicial = 'Pendente';

    // 2. Validação Atualizada (incluindo idEmpresa)
    
    if (!idUsuarioSolicitante) {
        let erroDetalhe = "ID do usuário solicitante (idUsuarioSolicitante) não encontrado no token de autenticação.";
        return res.status(401).json({ // Retornar 401 (Não Autorizado) ou 500 para erro de contexto
            sucesso: false,
            erro: erroDetalhe
        });
    }
    if (!idEmpresaContexto) {
        let erroDetalhe = "ID da Empresa (idEmpresa) não encontrado no contexto da requisição.";
        return res.status(500).json({ // Erro interno se o contexto falhar
            sucesso: false,
            erro: erroDetalhe
        });
    }

    let campoFaltante = null;

    if (!idOrcamento) {
        campoFaltante = 'idOrcamento';
    } else if (!idFuncao) {
        campoFaltante = 'idFuncao';
    } else if (!qtdSolicitada) {
        campoFaltante = 'qtdSolicitada';
    } else if (!tipoSolicitacao) {
        campoFaltante = 'tipoSolicitacao';
    } else if (!justificativa) {
        campoFaltante = 'justificativa';
    }


    if (campoFaltante) { 
        // Se algum campo do BODY estiver faltando, retorna 400 com a mensagem específica
        const erroDetalhe = `Dados incompletos. O campo obrigatório **${campoFaltante}** está faltando na requisição.`;
        
        return res.status(400).json({ 
            sucesso: false,
            erro: erroDetalhe
        });
    }

    if (tipoSolicitacao === 'FuncExcedido' && !idFuncionario) {
        return res.status(400).json({ 
            sucesso: false, 
            erro: "Para o tipo de solicitação 'FuncExcedido', o campo idFuncionario é obrigatório." 
        });
    }

    // 3. Validação de Lógica
    if (qtdSolicitada <= 0) {
      return res.status(400).json({ sucesso: false, erro: "A quantidade solicitada deve ser maior que zero." });
    }

    try {
    // 4. Comando SQL de INSERÇÃO (Atualizado para incluir idEmpresa e status)
    const query = `
        INSERT INTO AditivoExtra (
          idOrcamento, 
          idFuncao, 
          idEmpresa,        
          tipoSolicitacao, 
          qtdSolicitada, 
          justificativa, 
          idUsuarioSolicitante,
          status,              
          idFuncionario      
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING idAditivoExtra;
   `;

    const values = [
      idOrcamento, 
      idFuncao, 
      idEmpresaContexto,        // $3: idempresa
      tipoSolicitacao, 
      qtdSolicitada, 
      justificativa, 
      idUsuarioSolicitante,
      statusInicial,      // $8: 'Pendente'
      tipoSolicitacao === 'FuncExcedido' ? idFuncionario : null // $9: idFuncionario (ou null)
    ];

    const resultado = await pool.query(query, values);

    // 5. Finalização e Log
    if (resultado.rows.length === 0) {
      throw new Error("A inserção falhou ou o ID não foi retornado.");
    }

    const idAditivoExtra = resultado.rows[0].idAditivoExtra;

    // 💡 Finaliza o Log de Auditoria
    if (req.logData && logMiddleware.salvarLog) {
      req.logData.idregistroalterado = idAditivoExtra;
      await logMiddleware.salvarLog(req.logData); 
    }

    // 6. Resposta de Sucesso (Status 201 Created)
    res.status(201).json({ 
      sucesso: true, 
      mensagem: `Solicitação de ${tipoSolicitacao} salva com sucesso com status ${statusInicial}.`,
      idAditivoExtra: idAditivoExtra
    });

    } catch (error) {
      console.error("Erro ao salvar solicitação AditivoExtra:", error.message || error);

      res.status(500).json({ 
        sucesso: false, 
        erro: "Erro interno do servidor ao processar a solicitação.",
          detalhe: error.message,
          valores_enviados: values // **CRÍTICO PARA VERIFICARMOS O UNDEFINED/NULL**
    });
  }
});


router.get('/aditivoextra/verificar-status',
    autenticarToken(),
    contextoEmpresa,
    async (req, res) => {
        const { idOrcamento, idFuncao, tipoSolicitacao, idFuncionario } = req.query;
        const idEmpresa = req.idempresa; 

        console.log(`🔥 Rota GET /aditivoextra/verificar-status: Orcamento: ${idOrcamento}, Funcao: ${idFuncao}`);

        if (!idOrcamento || !idFuncao || !idEmpresa || !tipoSolicitacao) {
            return res.status(400).json({
                sucesso: false,
                erro: "Parâmetros idOrcamento, idFuncao e/ou idEmpresa são obrigatórios."
            });
        }

        if (tipoSolicitacao === 'FuncExcedido' && !idFuncionario) {
             return res.status(400).json({
                 sucesso: false,
                 erro: "Para tipoSolicitacao 'FuncExcedido', o parâmetro idFuncionario é obrigatório."
             });
        }

        try {
            // --- 1. BUSCA A ÚLTIMA SOLICITAÇÃO DE ADITIVO/EXTRA PENDENTE/REJEITADO ---
            let solicitacaoQuery = `
                SELECT 
                    idAditivoExtra, 
                    status, 
                    tipoSolicitacao, 
                    dtSolicitacao 
                FROM AditivoExtra
                WHERE 
                    idOrcamento = $1 AND 
                    idFuncao = $2 AND 
                    idEmpresa = $3 AND
                    tipoSolicitacao = $4
            `;
            let params = [idOrcamento, idFuncao, idEmpresa, tipoSolicitacao];
            
            // 🎯 CORREÇÃO CRÍTICA: Filtra por idFuncionario se o tipo for 'FuncExcedido'
            if (tipoSolicitacao === 'FuncExcedido' && idFuncionario) {
                solicitacaoQuery += ` AND idFuncionario = $5`;
                params.push(idFuncionario); // Adiciona idFuncionario como 5º parâmetro
            }

            solicitacaoQuery += ` ORDER BY dtSolicitacao DESC LIMIT 1;`;

            const solicitacaoResult = await pool.query(solicitacaoQuery, params);
            const solicitacaoRecente = solicitacaoResult.rows[0] || null;

            // --- 2. BUSCA TOTAIS DO ORÇAMENTO E QUANTIDADES APROVADAS ---
            
            // 2a. Busca Qtd. Orçada (SUM(qtditens)) e Qtd. Escalada (COUNT no staffeventos)
            // sqlanterior WITH OrcamentoContexto AS (
            //         SELECT 
            //             o.idevento, o.idcliente, o.idmontagem
            //         FROM orcamentos o
            //         WHERE o.idorcamento = $1
            //     )
            //     SELECT 
            //         -- Total orçado é a soma de todos os itens com aquela função no orçamento
            //         COALESCE(SUM(oi.qtditens), 0) AS "totalOrcado",
            //         -- Total escalado (vagas preenchidas) é o COUNT(DISTINCT staff)
            //         (
            //             SELECT COALESCE(COUNT(DISTINCT se.idfuncionario), 0)
            //             FROM staffeventos se
            //             JOIN OrcamentoContexto c ON 
            //                 se.idevento = c.idevento AND 
            //                 se.idcliente = c.idcliente AND 
            //                 se.idmontagem = c.idmontagem
            //             WHERE
            //                 se.idfuncao = $2
            //         ) AS "totalVagasPreenchidas"
            //     FROM orcamentoitens oi -- 🎯 CORRIGIDO O NOME DA TABELA
            //     WHERE 
            //         oi.idorcamento = $1 AND 
            //         oi.idfuncao = $2;
            const orcamentoQuery = `
                SELECT 
                -- Total de vagas definidas no Orçamento
                (SELECT COALESCE(SUM(oi.qtditens), 0) 
                FROM orcamentoitens oi 
                WHERE oi.idorcamento = $1 AND oi.idfuncao = $2) AS "totalOrcado",

                -- Total de pessoas já escaladas para ESTE orçamento específico
                (SELECT COALESCE(COUNT(DISTINCT se.idfuncionario), 0)
                FROM staffeventos se
                WHERE se.idorcamento = $1 AND se.idfuncao = $2) AS "totalVagasPreenchidas";
            `;
            const orcamentoResult = await pool.query(orcamentoQuery, [idOrcamento, idFuncao]);
            
            if (orcamentoResult.rows.length === 0) {
                 // Deve retornar 0, 0 se a função não estiver no orçamento, mas não 404.
                 // Neste caso, se a query não retornou linhas (o que não deve acontecer devido ao COALESCE), tratamos como 0.
                 let totaisFuncao = {
                    totalOrcado: 0,
                    totalVagasPreenchidas: 0
                 };
            } else {
                 // Usa o resultado da query
                 var totaisFuncao = orcamentoResult.rows[0];
            }
            
            // 2b. Soma das Quantidades de Aditivos APROVADOS
            const aditivoAprovadoQuery = `
                SELECT 
                    COALESCE(SUM(qtdSolicitada), 0) AS "totalAditivoAprovado"
                FROM AditivoExtra
                WHERE 
                    idOrcamento = $1 AND 
                    idFuncao = $2 AND 
                    idEmpresa = $3 AND
                    tipoSolicitacao = 'Aditivo' AND
                    status = 'Autorizado';
            `;
            const aditivoResult = await pool.query(aditivoAprovadoQuery, [idOrcamento, idFuncao, idEmpresa]);
            
            // 2c. Soma das Quantidades de Extra Bonificado APROVADOS
            const extraAprovadoQuery = `
                SELECT 
                    COALESCE(SUM(qtdSolicitada), 0) AS "totalExtraAprovado"
                FROM AditivoExtra
                WHERE 
                    idOrcamento = $1 AND 
                    idFuncao = $2 AND 
                    idEmpresa = $3 AND
                    tipoSolicitacao = 'ExtraBonificado' AND
                    status = 'Autorizado';
            `;
            const extraResult = await pool.query(extraAprovadoQuery, [idOrcamento, idFuncao, idEmpresa]);


            // 3. Monta o objeto final de totais
            totaisFuncao = {
                totalOrcado: parseInt(totaisFuncao.totalOrcado), // Garante que é um número
                totalVagasPreenchidas: parseInt(totaisFuncao.totalVagasPreenchidas), // Garante que é um número
                totalAditivoAprovado: parseInt(aditivoResult.rows[0].totalAditivoAprovado),
                totalExtraAprovado: parseInt(extraResult.rows[0].totalExtraAprovado)
            };


            // 4. Resposta de Sucesso
            res.json({
                sucesso: true,
                dados: {
                    solicitacaoRecente: solicitacaoRecente,
                    totaisFuncao: totaisFuncao
                }
            });

        } catch (error) {
            console.error("Erro ao buscar status AditivoExtra:", error.message || error);
            res.status(500).json({
                sucesso: false,
                erro: "Erro interno do servidor ao buscar dados de Aditivo/Extra."
            });
        }
});

module.exports = router;