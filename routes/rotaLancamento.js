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
    WHERE c.idempresa = $1
    ORDER BY c.nmconta ASC
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



// router.get("/contas", async (req, res) => {
//     console.log("ENTROU NA ROTA GET CONTA DE LANCAMENTOS")
 
//     const idempresa = req.idempresa;
    
//     try {
        
//         const result = await pool.query(
//             `SELECT 
//                 c.idconta,
//                 c.nmconta,
//                 c.idcentrocusto,
//                 c.idplanocontas,
//                 c.idvinculo,
//                 c.tipovinculo,
//                 c.idtipoconta,
//                 c.idempresapagadora,
//                 e.nmfantasia AS nmempresapagadora,
//                 tp.nmtipoconta,
//                 pc.nmplanocontas,
//                 cc.nmcentrocusto,
//                 COALESCE(cli.nmfantasia, forn.nmfantasia, func.nome) AS nmvinculo
//             FROM contas c
//             LEFT JOIN empresas e ON e.idempresa = c.idempresapagadora
//             LEFT JOIN tipoconta tp ON tp.idtipoconta = c.idtipoconta
//             LEFT JOIN planocontas pc ON pc.idplanocontas = c.idplanocontas
//             LEFT JOIN centrocusto cc ON cc.idcentrocusto = c.idcentrocusto
//             LEFT JOIN clientes cli ON c.idvinculo = cli.idcliente AND c.tipovinculo = 'cliente'
//             LEFT JOIN fornecedores forn ON c.idvinculo = forn.idfornecedor AND c.tipovinculo = 'fornecedor'
//             LEFT JOIN funcionarios func ON c.idvinculo = func.idfuncionario AND c.tipovinculo = 'funcionario'
//             WHERE c.idempresa = $1 AND c.ativo = true
//             ORDER BY c.nmconta ASC`,
//             [idempresa]
//         );
//         return result.rows.length
//             ? res.json(result.rows)
//             : res.status(404).json({ message: "Nenhuma conta encontrada" });
    
//     } catch (error) {
//         console.error("Erro ao buscar conta:", error);
//         res.status(500).json({ message: "Erro ao buscar conta" });
//     }
// });

// GET - Listar centros de custo ativos INATIVAMOS  CENTRO CUSTO
// router.get("/centrocusto",  async (req, res) => {
   
//   try {  const result = await pool.query(
//              `SELECT 
//                 cc.idcentrocusto, 
//                 cc.nmcentrocusto, 
//                 cc.ativo, 
//                 e.nmfantasia AS nmempresa 
//              FROM centrocusto cc
//              INNER JOIN empresas e ON cc.idempresa = e.idempresa
//              WHERE cc.ativo = true
//              ORDER BY e.nmfantasia ASC, cc.nmcentrocusto ASC`
//           );
//           return res.json(result.rows);
      
//   } catch (error) {
//       console.error("Erro ao buscar centrocusto:", error);
//       res.status(500).json({ message: "Erro ao buscar centrocusto" });
//   }
// });

// GET - Listar lançamentos ou buscar por descrição
// router.get("/", verificarPermissao('Lancamentos', 'pesquisar'), async (req, res) => {
//     const { descricao } = req.query;
//     const idempresa = req.idempresa;

//     try {
//         let query = `
//             SELECT 
//                 l.*, 
//                 c.nmconta 
//             FROM public.lancamentos l
//             LEFT JOIN contas c ON l.idconta = c.idconta
//             WHERE l.idempresa = $1            
//         `;
//         let params = [idempresa];

//         if (descricao) {
//             query += ` AND l.descricao ILIKE $2`;
//             params.push(`%${descricao}%`);
//         }
//         else{
//             query += ` ORDER BY l.descricao ASC`;  
//         }
        
              

//         const result = await pool.query(query, params);
        
//         return result.rows.length
//             ? res.json(result.rows)
//             : res.status(404).json({ message: "Nenhum lançamento encontrado" });

//     } catch (error) {
//         console.error("Erro ao buscar lançamentos:", error);
//         res.status(500).json({ message: "Erro ao buscar lançamentos" });
//     }
// });


// router.get("/", verificarPermissao('Lancamentos', 'pesquisar'), async (req, res) => {
//     const { descricao } = req.query;
//     const idempresa = req.idempresa;

//     try {
//         let query = `
//             SELECT 
//                 l.*,                 
//                 f.perfil AS perfil_vinculo 
//             FROM public.lancamentos l            
//             LEFT JOIN funcionarios f ON l.idvinculo = f.idfuncionario AND l.tipovinculo = 'funcionario'
//             WHERE l.idempresa = $1            
//         `;
//         let params = [idempresa];

//         if (descricao) {
//             query += ` AND l.descricao ILIKE $2`;
//             params.push(`%${descricao}%`);
//         } else {
//             query += ` ORDER BY l.descricao ASC`;  
//         }

//         const result = await pool.query(query, params);
        
//         return result.rows.length
//             ? res.json(result.rows)
//             : res.status(404).json({ message: "Nenhum lançamento encontrado" });

//     } catch (error) {
//         console.error("Erro ao buscar lançamentos:", error);
//         res.status(500).json({ message: "Erro ao buscar lançamentos" });
//     }
// });

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

// PUT - Atualizar lançamento
// router.put("/:id", 
//     verificarPermissao('Lancamentos', 'alterar'),
//     logMiddleware('Lancamentos', {
//         buscarDadosAnteriores: async (req) => {
//             const id = req.params.id;
//             const idempresa = req.idempresa;
//             try {
//                 const result = await pool.query(
//                     `SELECT * FROM lancamentos WHERE idlancamento = $1 AND idempresa = $2`,
//                     [id, idempresa]
//                 );
//                 const linha = result.rows[0] || null;
//                 return {
//                     dadosanteriores: linha,
//                     idregistroalterado: linha?.idlancamento || null
//                 };
//             } catch (error) {
//                 console.error("Erro log lancamentos:", error);
//                 return { dadosanteriores: null, idregistroalterado: null };
//             }
//         }
//     }),
//     async (req, res) => {
//         const id = req.params.id;
//         const idempresa = req.idempresa;
//         const { 
//             idconta, //idcentrocusto, 
//             descricao, vlrestimado, 
//             vctobase, periodicidade, tiporepeticao, 
//             dttermino, indeterminado, ativo, locado,
//             qtdParcelas, dtRecebimento, observacao
//         } = req.body;

//         console.log("ROTA PUT LANCAMENTOS", req.body);
//         try {
//             const result = await pool.query(
//                 `UPDATE public.lancamentos 
//                 SET idconta = $1, descricao = $2, vlrestimado = $3, 
//                     vctobase = $4, periodicidade = $5, tiporepeticao = $6, 
//                     dttermino = $7, indeterminado = $8, ativo = $9, locado = $10,
//                     qtdeparcelas = $11, dtrecebimento = $12, observacao = $13
//                 WHERE idlancamento = $14 AND idempresa = $15
//                 RETURNING *`,
//                 [
//                     idconta, 
//                     descricao?.toUpperCase(), 
//                     vlrestimado, 
//                     vctobase, 
//                     periodicidade, 
//                     tiporepeticao, 
//                     dttermino || null,        // Garante NULL se estiver vazio
//                     indeterminado, 
//                     ativo, 
//                     locado, 
//                     qtdParcelas || null,      // Garante NULL se estiver vazio (evita erro integer)
//                     dtRecebimento || null, 
//                     observacao || null,   // Garante NULL se estiver vazio (salva dtrecebimento)
//                     id, 
//                     idempresa
//                 ]
//             );

//             if (result.rowCount) {
//                 res.locals.acao = 'atualizou';
//                 res.locals.idregistroalterado = result.rows[0].idlancamento;
//                 return res.json({ message: "Lançamento atualizado com sucesso!", data: result.rows[0] });
//             } else {
//                 return res.status(404).json({ message: "Lançamento não encontrado." });
//             }
//         } catch (error) {
//             console.error("Erro ao atualizar lançamento:", error);
//             res.status(500).json({ message: "Erro ao atualizar lançamento." });
//         }
//     }
// );

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

// POST - Criar novo lançamento
// router.post("/", 
//     verificarPermissao('Lancamentos', 'cadastrar'),
//     logMiddleware('Lancamentos', { 
//         buscarDadosAnteriores: async () => ({ dadosanteriores: null, idregistroalterado: null }) 
//     }),
//     async (req, res) => {
//         const idempresa = req.idempresa;
//         const { 
//             idconta, idcentrocusto, descricao, vlrestimado, 
//             vctobase, periodicidade, tiporepeticao, 
//             dttermino, indeterminado, ativo 
//         } = req.body;

//         try {
//             const result = await pool.query(
//                 `INSERT INTO public.lancamentos (
//                     idempresa, idconta, idcentrocusto, descricao, 
//                     vlrestimado, vctobase, periodicidade, tiporepeticao, 
//                     dttermino, indeterminado, ativo
//                 ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
//                 RETURNING *`,
//                 [idempresa, idconta, idcentrocusto, descricao?.toUpperCase(), 
//                  vlrestimado, vctobase, periodicidade, tiporepeticao, 
//                  dttermino || null, indeterminado, ativo]
//             );

//             const novo = result.rows[0];
//             res.locals.acao = 'cadastrou';
//             res.locals.idregistroalterado = novo.idlancamento;

//             res.status(201).json({ message: "Lançamento salvo com sucesso!", data: novo });
//         } catch (error) {
//             console.error("Erro ao salvar lançamento:", error.message);

//             // Verifica se o erro veio da nossa Unique Key do banco de dados
//             if (error.code === '23505' || error.message.includes("uk_lancamento_duplicado")) {
//                 return res.status(409).json({ 
//                     error: "duplicidade",
//                     message: "Este lançamento já existe no banco de dados (mesma conta, valor e data)." 
//                 });
//             }

//             res.status(500).json({ 
//                 error: "erro_interno",
//                 message: "Não foi possível salvar o lançamento: " + error.message 
//             });
//         }
//     }
// );


//a rota abaixo já salva na tabela de pagamentos as parcelas conforme a lógica de repetição
// router.post("/", 
//     verificarPermissao('Lancamentos', 'cadastrar'),
//     logMiddleware('Lancamentos', { 
//         buscarDadosAnteriores: async () => ({ dadosanteriores: null, idregistroalterado: null }) 
//     }),
//     async (req, res) => {
//         const idempresa = req.idempresa;
//         const { 
//             idconta, idcentrocusto, descricao, vlrestimado, 
//             vctobase, periodicidade, tiporepeticao, 
//             dttermino, indeterminado, ativo 
//         } = req.body;

//         const client = await pool.connect(); // Usamos client para garantir a transação

//         try {
//             await client.query('BEGIN'); // Inicia a transação

//             // 1. Insere o Lançamento Mestre
//             const resLanc = await client.query(
//                 `INSERT INTO public.lancamentos (
//                     idempresa, idconta, idcentrocusto, descricao, 
//                     vlrestimado, vctobase, periodicidade, tiporepeticao, 
//                     dttermino, indeterminado, ativo
//                 ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
//                 RETURNING idlancamento`,
//                 [idempresa, idconta, idcentrocusto, descricao?.toUpperCase(), 
//                  vlrestimado, vctobase, periodicidade, tiporepeticao, 
//                  dttermino || null, indeterminado, ativo]
//             );

//             const idlancamento = resLanc.rows[0].idlancamento;

//             // 2. LÓGICA DA EXPLOSÃO (Gerar as parcelas na tabela pagamentos)
//             let parcelas = [];
//             let dataVcto = new Date(vctobase + 'T00:00:00');
//             let numParcela = 1;
            
//             // Definir limite de repetições
//             // Se for ÚNICO, 1 vez. Se for PARCELADO/FIXO, calculamos até a data de término
//             // Para "Indeterminado", vamos gerar os próximos 12 meses por padrão
//             let dataLimite = dttermino ? new Date(dttermino + 'T00:00:00') : null;
//             if (indeterminado && !dataLimite) {
//                 dataLimite = new Date(dataVcto);
//                 dataLimite.setMonth(dataLimite.getMonth() + 11); // Gera 1 ano
//             }
//             if (tiporepeticao === "UNICO") {
//                 dataLimite = new Date(dataVcto);
//             }

//             while (dataVcto <= dataLimite) {
//                 parcelas.push([
//                     idlancamento, idempresa, numParcela, 
//                     vlrestimado, dataVcto.toISOString().split('T')[0], 'pendente'
//                 ]);

//                 // Incrementa a data baseado na periodicidade
//                 if (periodicidade === "MENSAL") dataVcto.setMonth(dataVcto.getMonth() + 1);
//                 else if (periodicidade === "SEMANAL") dataVcto.setDate(dataVcto.getDate() + 7);
//                 else if (periodicidade === "ANUAL") dataVcto.setFullYear(dataVcto.getFullYear() + 1);
//                 else break; // Para "UNICO" ou segurança

//                 numParcela++;
//                 if (numParcela > 500) break; // Trava de segurança para não travar o banco
//             }

//             // 3. Insere todas as parcelas geradas
//             for (let p of parcelas) {
//                 await client.query(
//                     `INSERT INTO pagamentos (idlancamento, idempresa, numparcela, vlrprevisto, dtvcto, status)
//                      VALUES ($1, $2, $3, $4, $5, $6)`,
//                     p
//                 );
//             }

//             await client.query('COMMIT'); // Finaliza e salva tudo no banco

//             res.locals.acao = 'cadastrou';
//             res.locals.idregistroalterado = idlancamento;
//             res.status(201).json({ message: "Lançamento e parcelas gerados com sucesso!" });

//         } catch (error) {
//             await client.query('ROLLBACK'); // Se der erro em qualquer parte, desfaz tudo
//             console.error(error);
//             if (error.code === '23505') {
//                 res.status(409).json({ message: "Este lançamento já existe (Duplicidade)." });
//             } else {
//                 res.status(500).json({ message: "Erro ao processar: " + error.message });
//             }
//         } finally {
//             client.release();
//         }
//     }
// );


// router.post("/", 
//     verificarPermissao('Lancamentos', 'cadastrar'),
//     logMiddleware('Lancamentos', { 
//         buscarDadosAnteriores: async () => ({ dadosanteriores: null, idregistroalterado: null }) 
//     }),
//     async (req, res) => {
//         const idempresa = req.idempresa;
//         const { 
//             idconta, descricao, vlrestimado, 
//             vctobase, periodicidade, tiporepeticao, 
//             dttermino, indeterminado, ativo, locado, qtdParcelas, dtRecebimento, observacao
//         } = req.body;

//         const client = await pool.connect(); 

//         try {
//             await client.query('BEGIN'); 

//             // 1. Insere apenas o Lançamento Mestre
//             // Removemos a lógica de gerar parcelas automáticas em pagamentos
//             const resLanc = await client.query(
//                 `INSERT INTO public.lancamentos (
//                     idempresa, idconta, descricao, 
//                     vlrestimado, vctobase, periodicidade, tiporepeticao, 
//                     dttermino, indeterminado, ativo, locado, qtdeparcelas, dtrecebimento, observacao
//                 ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) 
//                 RETURNING idlancamento`,
//                 [
//                     idempresa, 
//                     idconta, 
//                     descricao?.toUpperCase(), 
//                     vlrestimado, 
//                     vctobase, 
//                     periodicidade, 
//                     tiporepeticao, 
//                     dttermino || null, 
//                     indeterminado, 
//                     ativo, 
//                     locado, 
//                     qtdParcelas || null,   // Garante NULL em vez de ""
//                     dtRecebimento || null,
//                     observacao  // Garante NULL em vez de ""
//                 ]
//             );

//             const idlancamento = resLanc.rows[0].idlancamento;

//             // A lógica de transação (COMMIT) agora acontece logo após inserir o mestre,
//             // pois não há mais inserções em massa em outra tabela.
//             await client.query('COMMIT'); 

//             res.locals.acao = 'cadastrou';
//             res.locals.idregistroalterado = idlancamento;
            
//             // Mensagem atualizada para refletir que apenas o mestre foi salvo
//             res.status(201).json({ 
//                 message: "Lançamento cadastrado com sucesso! As parcelas serão geradas conforme os pagamentos forem realizados.",
//                 idlancamento: idlancamento 
//             });

//         } catch (error) {
//             await client.query('ROLLBACK'); 
//             console.error(error);
//             if (error.code === '23505') {
//                 res.status(409).json({ message: "Este lançamento já existe (Duplicidade)." });
//             } else {
//                 res.status(500).json({ message: "Erro ao processar: " + error.message });
//             }
//         } finally {
//             client.release();
//         }
//     }
// );


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
            
            res.status(201).json({ 
                message: "Lançamento cadastrado com sucesso!", 
                idlancamento: idlancamento 
            });

        } catch (error) {
            await client.query('ROLLBACK'); 
            console.error("Erro no POST Lancamentos:", error);
            if (error.code === '23505') {
                res.status(409).json({ message: "Este lançamento já existe (Duplicidade)." });
            } else {
                res.status(500).json({ message: "Erro ao processar: " + error.message });
            }
        } finally {
            client.release();
        }
    }
);
module.exports = router;