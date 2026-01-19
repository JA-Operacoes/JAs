const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB");
const { autenticarToken, contextoEmpresa } = require('../middlewares/authMiddlewares');
const { verificarPermissao } = require('../middlewares/permissaoMiddleware');
const logMiddleware = require('../middlewares/logMiddleware');

// Aplica autenticação e contexto em todas as rotas de lançamentos
router.use(autenticarToken());
router.use(contextoEmpresa);


router.get("/contas", async (req, res) => {
    console.log("ENTROU NA ROTA GET CONTA DE LANCAMENTOS")
 
    const idempresa = req.idempresa;
    
    try {
        
        const result = await pool.query(
            `SELECT * FROM contas WHERE idempresa = $1 ORDER BY nmconta ASC`,
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

router.get("/centrocusto",  async (req, res) => {
   
  try {  const result = await pool.query(
             `SELECT 
                cc.idcentrocusto, 
                cc.nmcentrocusto, 
                cc.ativo, 
                e.nmfantasia AS nmempresa 
             FROM centrocusto cc
             INNER JOIN empresas e ON cc.idempresa = e.idempresa
             WHERE cc.ativo = true
             ORDER BY e.nmfantasia ASC, cc.nmcentrocusto ASC`
          );
          return res.json(result.rows);
      
  } catch (error) {
      console.error("Erro ao buscar centrocusto:", error);
      res.status(500).json({ message: "Erro ao buscar centrocusto" });
  }
});

// GET - Listar lançamentos ou buscar por descrição
router.get("/", verificarPermissao('Lancamentos', 'pesquisar'), async (req, res) => {
    const { descricao } = req.query;
    const idempresa = req.idempresa;

    try {
        let query = `
            SELECT l.*, c.nmconta, cc.nmcentrocusto 
            FROM public.lancamentos l
            LEFT JOIN contas c ON l.idconta = c.idconta
            LEFT JOIN centrocusto cc ON l.idcentrocusto = cc.idcentrocusto
            WHERE l.idempresa = $1
        `;
        let params = [idempresa];

        if (descricao) {
            query += ` AND l.descricao ILIKE $2 ORDER BY l.vctobase DESC`;
            params.push(`%${descricao}%`);
        } else {
            query += ` ORDER BY l.vctobase DESC`;
        }

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
            idconta, idcentrocusto, descricao, vlrestimado, 
            vctobase, periodicidade, tiporepeticao, 
            dttermino, indeterminado, ativo 
        } = req.body;

        try {
            const result = await pool.query(
                `UPDATE public.lancamentos 
                 SET idconta = $1, idcentrocusto = $2, descricao = $3, vlrestimado = $4, 
                     vctobase = $5, periodicidade = $6, tiporepeticao = $7, 
                     dttermino = $8, indeterminado = $9, ativo = $10
                 WHERE idlancamento = $11 AND idempresa = $12
                 RETURNING *`,
                [idconta, idcentrocusto, descricao?.toUpperCase(), vlrestimado, 
                 vctobase, periodicidade, tiporepeticao, 
                 dttermino || null, indeterminado, ativo, id, idempresa]
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


router.post("/", 
    verificarPermissao('Lancamentos', 'cadastrar'),
    logMiddleware('Lancamentos', { 
        buscarDadosAnteriores: async () => ({ dadosanteriores: null, idregistroalterado: null }) 
    }),
    async (req, res) => {
        const idempresa = req.idempresa;
        const { 
            idconta, idcentrocusto, descricao, vlrestimado, 
            vctobase, periodicidade, tiporepeticao, 
            dttermino, indeterminado, ativo 
        } = req.body;

        const client = await pool.connect(); 

        try {
            await client.query('BEGIN'); 

            // 1. Insere apenas o Lançamento Mestre
            // Removemos a lógica de gerar parcelas automáticas em pagamentos
            const resLanc = await client.query(
                `INSERT INTO public.lancamentos (
                    idempresa, idconta, idcentrocusto, descricao, 
                    vlrestimado, vctobase, periodicidade, tiporepeticao, 
                    dttermino, indeterminado, ativo
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
                RETURNING idlancamento`,
                [idempresa, idconta, idcentrocusto, descricao?.toUpperCase(), 
                 vlrestimado, vctobase, periodicidade, tiporepeticao, 
                 dttermino || null, indeterminado, ativo]
            );

            const idlancamento = resLanc.rows[0].idlancamento;

            // A lógica de transação (COMMIT) agora acontece logo após inserir o mestre,
            // pois não há mais inserções em massa em outra tabela.
            await client.query('COMMIT'); 

            res.locals.acao = 'cadastrou';
            res.locals.idregistroalterado = idlancamento;
            
            // Mensagem atualizada para refletir que apenas o mestre foi salvo
            res.status(201).json({ 
                message: "Lançamento cadastrado com sucesso! As parcelas serão geradas conforme os pagamentos forem realizados.",
                idlancamento: idlancamento 
            });

        } catch (error) {
            await client.query('ROLLBACK'); 
            console.error(error);
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