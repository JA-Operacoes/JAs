const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB");
const { autenticarToken, contextoEmpresa } = require('../middlewares/authMiddlewares');
const { verificarPermissao } = require('../middlewares/permissaoMiddleware');
const logMiddleware = require('../middlewares/logMiddleware');

// Aplica autenticação e contexto em todas as rotas de lançamentos

router.get("/empresas", autenticarToken(), async (req, res) => {    
  const idempresa = req.idempresa;

  console.log('Query Params EMPRESAS recebidos em ROTA CONTAS:', req.query);

    try {
        const result = await pool.query(
            `SELECT idempresa, nmfantasia, razaosocial
             FROM empresas 
             WHERE ativo = true      
             ORDER BY nmfantasia ASC`             
        );

        console.log("Empresas buscadas com sucesso.");
        res.json(result.rows);
        
    } catch (error) {
        console.error("Erro ao buscar empresas:", error);
        res.status(500).json({ message: "Erro ao buscar empresas" });
    }
});

router.get("/tipoconta", autenticarToken(), async (req, res) => {
  
  const idempresa = req.idempresa;

  console.log('Query Params TIPO CONTA recebidos em ROTA CONTAS:', req.query);

  try {    
      const result = await pool.query(
        // CORREÇÃO: Order by nmtipoconta (nome da coluna correto)
        `SELECT * FROM tipoconta WHERE idempresa = $1 ORDER BY nmtipoconta ASC`,
        [idempresa]
      );
      return res.json(result.rows);
    
  } catch (error) {
    console.error("Erro ao buscar conta:", error);
    res.status(500).json({ message: "Erro ao buscar conta no banco de dados" });
  }
});

router.get("/centrocusto",  autenticarToken(), async (req, res) => {
    const idempresa = req.idempresa;
  
    try {
        const result = await pool.query(
            `SELECT * FROM centrocusto  WHERE idempresa = $1 ORDER BY nmcentrocusto ASC`,
            [idempresa] 
        );
        return result.rows.length
        ? res.json(result.rows)
        : res.status(404).json({ message: "Nenhuma conta encontrada" });           
    
    } catch (error) {
        console.error("Erro ao buscar conta:", error);
        res.status(500).json({ message: "Erro ao buscar conta" });
    }      
});

router.get("/contas", autenticarToken(), async (req, res) => {
  
  const idempresa = req.idempresa;

  // Query que traz o perfil apenas se o vínculo for um funcionário
  const queryBase = `
    SELECT c.*, pc.nmplanocontas  
    FROM contas c
    LEFT JOIN planocontas pc ON pc.idplanocontas = c.idplanocontas  
    WHERE c.idempresa = $1 AND c.ativo = true    
  `;

  try {
    
      const result = await pool.query(
        `${queryBase} ORDER BY c.nmconta ASC`,
        [idempresa]
      );
      return result.rows.length
        ? res.json(result.rows)
        : res.status(404).json({ message: "Nenhuma conta encontrada" });
    
  } catch (error) {
    console.error("Erro ao buscar conta:", error);
    res.status(500).json({ message: "Erro ao buscar conta" });
  }
});

async function buscarEntidadeVinculo(tabelaPrincipal, tabelaRelacao, idCol, nomeCol, fkCol, idempresa, perfil = null) {
    
    console.log("🔍 Buscando Vínculo:", { tabelaPrincipal, idempresa, perfil });
    
    let query = `
        SELECT p.${idCol} AS id, p.${nomeCol} AS nome 
        FROM ${tabelaPrincipal} p
        INNER JOIN ${tabelaRelacao} r ON p.${idCol} = r.${fkCol}
        WHERE r.idempresa = $1 AND p.ativo = true
    `;
    
    const params = [idempresa];

    if (perfil) {
        // Normaliza para minúsculas e remove espaços para comparação segura
        const p = perfil.toLowerCase().trim();

        if (p.includes('func')) { 
            // Se o valor do rádio for "funcionário", busca Interno ou Externo
            // O ILIKE garante que encontre "Interno" ou "interno" no banco
            query += ` AND (p.perfil ILIKE 'Interno' OR p.perfil ILIKE 'Externo')`;
        } else if (p.includes('free') || p.includes('sem')) {
            // Se o valor for "free-lancer", busca Freelancer ou Lote
            query += ` AND (p.perfil ILIKE 'Freelancer' OR p.perfil ILIKE 'Lote')`;
        }
    }

    query += ` ORDER BY nome`;
    
    const result = await pool.query(query, params);
    return result.rows;
}

router.get("/vinculo/:tipo", autenticarToken(), async (req, res) => {
    const { tipo } = req.params; // clientes, fornecedores, funcionarios
    const { perfil } = req.query;
    const idempresa = req.idempresa;

    try {
        let dados = [];
        
        if (tipo === 'funcionarios') {
            dados = await buscarEntidadeVinculo(
                'funcionarios', 
                'funcionarioempresas', 
                'idfuncionario', 
                'nome', 
                'idfuncionario', 
                idempresa, 
                perfil 
            );
        } else if (tipo === 'fornecedores') {
            // CORREÇÃO AQUI: explicitando os nomes para evitar erro de concatenação
            dados = await buscarEntidadeVinculo(
                'fornecedores', 
                'fornecedorempresas', 
                'idfornecedor', 
                'nmfantasia', 
                'idfornecedor', 
                idempresa, 
                null
            );
        } else if (tipo === 'clientes') {
            dados = await buscarEntidadeVinculo(
                'clientes', 
                'clienteempresas', 
                'idcliente', 
                'nmfantasia', 
                'idcliente', 
                idempresa, 
                null
            );
        }
        
        res.json(dados);
    } catch (error) {
        console.error(`❌ ERRO NA ROTA /vinculo/${tipo}:`, error.message);
        res.status(500).json({ message: "Erro ao buscar dados do banco" });
    }
});



router.use(autenticarToken());
router.use(contextoEmpresa);


router.get("/", verificarPermissao('Lancamentos', 'pesquisar'), async (req, res) => {
    const { descricao } = req.query;
    const idempresa = req.idempresa;

    try {
        let query = `
            SELECT 
                l.*,
                -- Busca o perfil se for funcionário
                f.perfil,
                -- Busca o nome do vínculo dependendo do tipo (COALESCE pega o primeiro não nulo)
                COALESCE(f.nome, forn.nmfantasia, c.nmfantasia) AS nome_vinculo,
                -- Dados extras das tabelas relacionadas
                cc.nmcentrocusto,
                tc.nmtipoconta,
                ep.nmfantasia
            FROM lancamentos l
            -- Joins para Vínculos
            LEFT JOIN funcionarios f ON l.idvinculo = f.idfuncionario AND l.tipovinculo = 'funcionario'
            LEFT JOIN fornecedores forn ON l.idvinculo = forn.idfornecedor AND l.tipovinculo = 'fornecedor'
            LEFT JOIN clientes c ON l.idvinculo = c.idcliente AND l.tipovinculo = 'cliente'
            -- Joins para Auxiliares Financeiros
            LEFT JOIN centrocusto cc ON l.idcentrocusto = cc.idcentrocusto
            LEFT JOIN tipoconta tc ON l.idtipoconta = tc.idtipoconta
            LEFT JOIN empresas ep ON l.idempresa = ep.idempresa
            WHERE l.idempresa = $1
        `;
        let params = [idempresa];

        if (descricao) {
            query += ` AND l.descricao ILIKE $2`;
            params.push(`%${descricao}%`);
        }
        
        query += ` ORDER BY l.descricao ASC`; // Geralmente melhor ver os últimos primeiro

        const result = await pool.query(query, params);
        
        return result.rows.length
            ? res.json(result.rows)
            : res.status(404).json({ message: "Nenhum lançamento encontrado" });

    } catch (error) {
        console.error("Erro ao buscar lançamentos:", error);
        res.status(500).json({ message: "Erro ao buscar lançamentos" });
    }
});


router.put("/:id", 
    verificarPermissao('Lancamentos', 'alterar'),
    logMiddleware('Lancamentos', {
        buscarDadosAnteriores: async (req) => {
            const id = req.params.id;
            const idempresa = req.idempresa;
            try {
                const result = await pool.query(
                    `SELECT * FROM lancamentos WHERE idlancamento = $1 AND idempresa = $2`,
                    [id, idempresa]
                );
                const linha = result.rows[0] || null;
                return {
                    dadosanteriores: linha,
                    idregistroalterado: linha?.idlancamento || null
                };
            } catch (error) {
                console.error("Erro log lancamentos:", error);
                return { dadosanteriores: null, idregistroalterado: null };
            }
        }
    }),
    async (req, res) => {
        const id = req.params.id;
        const idempresa = req.idempresa;
        const { 
            idConta, idCentroCusto, idTipoConta, idEmpresaPagadora, // Novos campos financeiros
            idVinculo, tipoVinculo,                                 // Novos campos de vínculo
            descricao, vlrEstimado, 
            vctoBase, periodicidade, tipoRepeticao, 
            dtTermino, indeterminado, ativo, locado,
            qtdParcelas, dtRecebimento, observacao
        } = req.body;

        try {
            const result = await pool.query(
                `UPDATE public.lancamentos 
                SET idconta = $1, descricao = $2, vlrestimado = $3, 
                    vctobase = $4, periodicidade = $5, tiporepeticao = $6, 
                    dttermino = $7, indeterminado = $8, ativo = $9, locado = $10,
                    qtdeparcelas = $11, dtrecebimento = $12, observacao = $13,
                    idcentrocusto = $14, idtipoconta = $15, idempresapagadora = $16,
                    idvinculo = $17, tipovinculo = $18
                WHERE idlancamento = $19 AND idempresa = $20
                RETURNING *`,
                [
                    idConta, 
                    descricao?.toUpperCase(), 
                    vlrEstimado, 
                    vctoBase, 
                    periodicidade, 
                    tipoRepeticao, 
                    dtTermino || null,
                    indeterminado, 
                    ativo, 
                    locado, 
                    qtdParcelas || null,
                    dtRecebimento || null, 
                    observacao || null,
                    idCentroCusto || null,   // $14
                    idTipoConta || null,     // $15
                    idEmpresaPagadora || null,// $16
                    idVinculo || null,       // $17
                    tipoVinculo || null,     // $18
                    id,                      // $19
                    idempresa                // $20
                ]
            );

            if (result.rowCount) {
                res.locals.acao = 'atualizou';
                res.locals.idregistroalterado = result.rows[0].idlancamento;
                res.locals.dadosNovos = result.rows[0];
                return res.json({ message: "Lançamento atualizado com sucesso!", data: result.rows[0] });
            } else {
                return res.status(404).json({ message: "Lançamento não encontrado." });
            }
        } catch (error) {
            console.error("Erro ao atualizar lançamento:", error);
            res.status(500).json({ message: "Erro ao atualizar lançamento." });
        }
    }
);


router.post("/", 
    verificarPermissao('Lancamentos', 'cadastrar'),
    logMiddleware('Lancamentos', { 
        buscarDadosAnteriores: async () => ({ dadosanteriores: null, idregistroalterado: null }) 
    }),
    async (req, res) => {
        const idempresa = req.idempresa;
        const { 
            idConta, idCentroCusto, idTipoConta, idEmpresaPagadora, // Novos campos financeiros
            idVinculo, tipoVinculo,                                 // Novos campos de vínculo
            descricao, vlrEstimado, 
            vctoBase, periodicidade, tipoRepeticao, 
            dtTermino, indeterminado, ativo, locado, 
            qtdParcelas, dtRecebimento, observacao
        } = req.body;

        const client = await pool.connect(); 

        try {
            await client.query('BEGIN'); 

            const resLanc = await client.query(
                `INSERT INTO public.lancamentos (
                    idempresa, idconta, idcentrocusto, idtipoconta, idempresapagadora,
                    idvinculo, tipovinculo, descricao, 
                    vlrestimado, vctobase, periodicidade, tiporepeticao, 
                    dttermino, indeterminado, ativo, locado, 
                    qtdeparcelas, dtrecebimento, observacao
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19) 
                RETURNING idlancamento`,
                [
                    idempresa,           // $1
                    idConta,             // $2
                    idCentroCusto || null, // $3
                    idTipoConta || null,   // $4
                    idEmpresaPagadora || null, // $5
                    idVinculo || null,     // $6
                    tipoVinculo || null,   // $7
                    descricao?.toUpperCase(), // $8
                    vlrEstimado,         // $9
                    vctoBase,            // $10
                    periodicidade,       // $11
                    tipoRepeticao,       // $12
                    dtTermino || null,   // $13
                    indeterminado,       // $14
                    ativo,               // $15
                    locado,              // $16
                    qtdParcelas || null, // $17
                    dtRecebimento || null, // $18
                    observacao || null   // $19
                ]
            );

            const idlancamento = resLanc.rows[0].idlancamento;
            await client.query('COMMIT'); 

            res.locals.acao = 'cadastrou';
            res.locals.idregistroalterado = idlancamento;
            res.locals.dadosNovos = { // ✅ era dadosnovos
                idlancamento,
                idconta: idConta,
                idcentrocusto: idCentroCusto || null,
                idtipoconta: idTipoConta || null,
                idempresapagadora: idEmpresaPagadora || null,
                idvinculo: idVinculo || null,
                tipovinculo: tipoVinculo || null,
                descricao: descricao?.toUpperCase(),
                vlrestimado: vlrEstimado,
                vctobase: vctoBase,
                periodicidade,
                tiporepeticao: tipoRepeticao,
                dttermino: dtTermino || null,
                indeterminado,
                ativo,
                locado,
                qtdeparcelas: qtdParcelas || null,
                dtrecebimento: dtRecebimento || null,
                observacao: observacao || null
            };
            
            res.status(201).json({ 
                message: "Lançamento cadastrado com sucesso!", 
                idlancamento: idlancamento 
            });

        } catch (error) {
           if (client) await client.query('ROLLBACK');
            console.error("Erro no POST Lancamentos:", error);
            if (error.code === '23505') {
                res.status(409).json({ message: "Este lançamento já existe (Duplicidade)." });
            } else {
                res.status(500).json({ message: "Erro ao processar: " + error.message });
            }
        } finally {
            if (client) client.release();
        }
    }
);
module.exports = router;