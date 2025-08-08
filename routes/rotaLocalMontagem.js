const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB");
const { autenticarToken, contextoEmpresa } = require('../middlewares/authMiddlewares');
const { verificarPermissao } = require('../middlewares/permissaoMiddleware');
const logMiddleware = require('../middlewares/logMiddleware'); 

// Aplica autenticação em todas as rotas
router.use(autenticarToken());
router.use(contextoEmpresa);

// GET todas ou por descrição
router.get("/", verificarPermissao('localmontagem', 'pesquisar'), async (req, res) => {
  const { descmontagem } = req.query;
  const idempresa = req.idempresa;
  console.log("descmontagem na rota", descmontagem);

  try {
    if (descmontagem) {
      const result = await pool.query(
        `SELECT lm.*,
            COALESCE(json_agg(lp.*) FILTER (WHERE lp.idpavilhao IS NOT NULL), '[]') AS pavilhoes
        FROM localmontagem lm
        INNER JOIN localmontempresas lme ON lme.idmontagem = lm.idmontagem
        LEFT JOIN localmontpavilhao lp ON lp.idmontagem = lm.idmontagem -- Adicione este JOIN
        WHERE lme.idempresa = $1 AND lm.descmontagem ILIKE $2
        GROUP BY lm.idmontagem -- Adicione este GROUP BY
        LIMIT 1`,
       [idempresa, `%${descmontagem}%`]
      );
      return result.rows.length
        ? res.json(result.rows[0])
        : res.status(404).json({ message: "Local Montagem não encontrada" });
    } else {
      const result = await pool.query(`SELECT lm.*,
            COALESCE(json_agg(lp.*) FILTER (WHERE lp.idpavilhao IS NOT NULL), '[]') AS pavilhoes
            FROM localmontagem lm
            INNER JOIN localmontempresas lme ON lme.idmontagem = lm.idmontagem
            LEFT JOIN localmontpavilhao lp ON lp.idmontagem = lm.idmontagem -- Adicione este JOIN
            WHERE lme.idempresa = $1
            GROUP BY lm.idmontagem -- Adicione este GROUP BY
            ORDER BY descmontagem ASC`,
               [idempresa]);
      return result.rows.length
        ? res.json(result.rows)
        : res.status(404).json({ message: "Nenhuma local montagem encontrada" });
    }
  } catch (error) {
    console.error("Erro ao buscar local montagem:", error);
    res.status(500).json({ message: "Erro ao buscar local montagem" });
  }
});

// Adicione esta nova rota ao seu router
router.post("/pavilhoes-status", verificarPermissao('localmontagem', 'alterar'), async (req, res) => {
    const { pavilhoesParaVerificar } = req.body;
    const idempresa = req.idempresa;
    let client;
    try {
        client = await pool.connect();
        
        // ✅ LOG DE DEPURAÇÃO: Mostra o payload recebido do frontend
        console.log("DEBUG: Pavilhões recebidos para verificação:", pavilhoesParaVerificar);
        
        if (!pavilhoesParaVerificar || !Array.isArray(pavilhoesParaVerificar) || pavilhoesParaVerificar.length === 0) {
            return res.json({ pavilhoesRemoviveis: [], pavilhoesEmUso: [] });
        }
        
        const idsParaVerificar = pavilhoesParaVerificar.map(p => parseInt(p.idpavilhao));
        // ✅ LOG DE DEPURAÇÃO: Mostra os IDs que serão usados na query
        console.log("DEBUG: IDs a serem verificados:", idsParaVerificar);
        
        const pavilhoesEmUsoResult = await client.query(
            `SELECT DISTINCT idpavilhao FROM orcamentopavilhoes WHERE idpavilhao = ANY($1::int[])`,
            [idsParaVerificar]
        );
        
        const idsEmUso = new Set(pavilhoesEmUsoResult.rows.map(row => row.idpavilhao));
        // ✅ LOG DE DEPURAÇÃO: Mostra os IDs que o banco de dados retornou como em uso
        console.log("DEBUG: IDs encontrados em uso no banco:", idsEmUso);
        
        const pavilhoesEmUsoComNomes = pavilhoesParaVerificar.filter(p => idsEmUso.has(parseInt(p.idpavilhao)));
        const pavilhoesRemoviveis = pavilhoesParaVerificar.filter(p => !idsEmUso.has(parseInt(p.idpavilhao)));
        
        // ✅ LOG DE DEPURAÇÃO: Mostra a lista final de pavilhões em uso e removíveis
        console.log("DEBUG: Pavilhões em uso:", pavilhoesEmUsoComNomes);
        console.log("DEBUG: Pavilhões removíveis:", pavilhoesRemoviveis);

        return res.json({
            pavilhoesRemoviveis: pavilhoesRemoviveis,
            pavilhoesEmUso: pavilhoesEmUsoComNomes
        });

    } catch (error) {
        console.error("Erro ao verificar o status dos pavilhões:", error);
        return res.status(500).json({ message: "Erro ao verificar o status dos pavilhões." });
    } finally {
        if (client) client.release();
    }
});
// PUT atualizar
router.put("/:id",
    verificarPermissao('localmontagem', 'alterar'),
    logMiddleware('localmontagem', {
        buscarDadosAnteriores: async (req) => {
            const idMontagem = req.params.id;
            const idempresa = req.idempresa;

            if (!idMontagem) {
                return { dadosanteriores: null, idregistroalterado: null };
            }

            try {
                // ✅ Seleciona os dados do local de montagem E seus pavilhões associados
                const result = await pool.query(
                    `SELECT lm.*,
                            COALESCE(json_agg(lp.*) FILTER (WHERE lp.idpavilhao IS NOT NULL), '[]') AS pavilhoes
                     FROM localmontagem lm
                     INNER JOIN localmontempresas lme ON lme.idmontagem = lm.idmontagem
                     LEFT JOIN localmontpavilhao lp ON lp.idmontagem = lm.idmontagem
                     WHERE lm.idmontagem = $1 AND lme.idempresa = $2
                     GROUP BY lm.idmontagem`,
                    [idMontagem, idempresa]
                );
                const linha = result.rows[0] || null;
                return {
                    dadosanteriores: linha, // O objeto local de montagem com os pavilhões anteriores
                    idregistroalterado: linha?.idmontagem || null
                };
            } catch (error) {
                console.error("Erro ao buscar dados anteriores do local de montagem:", error);
                return { dadosanteriores: null, idregistroalterado: null };
            }
        }
    }),
    async (req, res) => {
        const id = req.params.id;
        const idempresa = req.idempresa;
        const { descMontagem, cidadeMontagem, ufMontagem, qtdPavilhao, pavilhoes } = req.body; // ✅ Novo campo e array
        let client;

        console.log("descMontagem na rota", descMontagem);

        try {
            client = await pool.connect();
            await client.query('BEGIN'); // Inicia a transação

            console.log("Payload de pavilhões recebido do frontend:", pavilhoes);
                        // 1. Atualiza o local de montagem, incluindo qtdpavilhao
            const resultUpdate = await client.query(
                `UPDATE localmontagem lm
                SET descmontagem = $1, cidademontagem = $2, ufmontagem = $3, qtdpavilhao = $4
                FROM localmontempresas lme
                WHERE lm.idmontagem = $5 AND lme.idmontagem = lm.idmontagem AND lme.idempresa = $6
                RETURNING lm.idmontagem, lm.qtdpavilhao`,
                [descMontagem, cidadeMontagem, ufMontagem, qtdPavilhao, id, idempresa]
            );

            if (!resultUpdate.rowCount) {
                await client.query('ROLLBACK');
                return res.status(404).json({ message: "Local de Montagem não encontrado ou você não tem permissão para atualizá-lo." });
            }

            const idmontagemAtualizada = resultUpdate.rows[0].idmontagem;

            // 2. Sincroniza os pavilhões:
            //  // 2.1. Extrai IDs dos pavilhões que devem ser mantidos (aqueles que já têm um ID e vieram do frontend)
            // const pavilionIdsToKeep = pavilhoes
            //  .filter(p => p.idpavilhao) // Filtra apenas pavilhões que já possuem um ID
            //  .map(p => p.idpavilhao); // Extrai apenas o ID

            const existingDbPavilionIdsResult = await client.query(
                `SELECT idpavilhao FROM localmontpavilhao WHERE idmontagem = $1`,
                [idmontagemAtualizada]
            );
            const existingDbPavilionIds = new Set(existingDbPavilionIdsResult.rows.map(row => row.idpavilhao));

            const allDbIds = Array.from(existingDbPavilionIds);
    
            // ✅ Adicione este log para ver o que está no banco antes da sincronização
            console.log("IDs de pavilhões no banco de dados (antes da sincronização):", allDbIds);
            
            // Lista para os IDs que foram enviados no payload e que deveriam permanecer no DB
            const idsFromPayloadToKeep = new Set(); 

            for (const newPavilion of pavilhoes) {
                const idDoPavilhao = newPavilion.idpavilhao ? parseInt(newPavilion.idpavilhao, 10) : null;
                
                if (idDoPavilhao) {
                    if (existingDbPavilionIds.has(idDoPavilhao)) {
                        // Se existe, atualiza
                        await client.query(
                            `UPDATE localmontpavilhao
                            SET nmpavilhao = $1
                            WHERE idpavilhao = $2 AND idmontagem = $3`,
                            [newPavilion.nmpavilhao, idDoPavilhao, idmontagemAtualizada]
                        );
                        // ✅ CORREÇÃO: Adiciona o ID como NÚMERO ao set.
                        idsFromPayloadToKeep.add(idDoPavilhao);
                    } else {
                        console.warn(`ID de pavilhão ${newPavilion.idpavilhao} fornecido, mas não encontrado para montagem ${idmontagemAtualizada}. Inserindo como novo.`);
                        const insertResult = await client.query(
                            `INSERT INTO localmontpavilhao (idmontagem, nmpavilhao)
                            VALUES ($1, $2) RETURNING idpavilhao`,
                            [idmontagemAtualizada, newPavilion.nmpavilhao]
                        );
                        idsFromPayloadToKeep.add(insertResult.rows[0].idpavilhao);
                    }
                } else {
                    // Se não tem ID, é um novo pavilhão, insere
                    const insertResult = await client.query(
                        `INSERT INTO localmontpavilhao (idmontagem, nmpavilhao)
                        VALUES ($1, $2) RETURNING idpavilhao`,
                        [idmontagemAtualizada, newPavilion.nmpavilhao]
                    );
                    idsFromPayloadToKeep.add(insertResult.rows[0].idpavilhao);
                }
            }

            const finalIdsToKeep = Array.from(idsFromPayloadToKeep);
            const idsToDelete = allDbIds.filter(id => !finalIdsToKeep.includes(id));
            console.log("IDs de pavilhões que o backend vai tentar deletar:", idsToDelete);
            
            if (idsToDelete.length > 0) {
                // Checa se algum dos pavilhões a serem excluídos está em orçamentos
                const checkOrcamento = await client.query(
                    `SELECT idpavilhao FROM orcamentopavilhoes WHERE idpavilhao = ANY($1::int[]) LIMIT 1`,
                    [idsToDelete]
                );

                if (checkOrcamento.rowCount > 0) {
                    // Encontrado um pavilhão em uso. Aborta a operação.
                    await client.query('ROLLBACK');
                    const idInUse = checkOrcamento.rows[0].idpavilhao;
                    const pavilionInUse = await client.query(`SELECT nmpavilhao FROM localmontpavilhao WHERE idpavilhao = $1`, [idInUse]);
                    const nomePavilhao = pavilionInUse.rows[0]?.nmpavilhao || `Pavilhão ${idInUse}`; 
                    return res.status(409).json({ // 409 Conflict é um código apropriado
                        message: `O pavilhão "${nomePavilhao}" não pode ser excluído porque está associado a um orçamento.`
                    });
                }
            }

            if (finalIdsToKeep.length > 0) {
                // Deleta os pavilhões que existiam no DB mas não foram enviados no payload
                await client.query(
                    `DELETE FROM localmontpavilhao
                     WHERE idmontagem = $1 AND idpavilhao NOT IN (SELECT unnest($2::int[]))`,
                    [idmontagemAtualizada, finalIdsToKeep]
                );
            } else {
                // Se nenhum ID foi enviado ou inserido (payload de pavilhões vazio ou só com IDs inválidos),
                // significa que todos os antigos devem ser removidos.
                await client.query(
                    `DELETE FROM localmontpavilhao
                     WHERE idmontagem = $1`,
                    [idmontagemAtualizada]
                );
            }

            await client.query('COMMIT'); // Confirma a transação

            // Busca o local de montagem completo com os pavilhões atualizados para retornar na resposta
            const localMontagemCompleto = await pool.query(
                `SELECT lm.*,
                        COALESCE(json_agg(lp.*) FILTER (WHERE lp.idpavilhao IS NOT NULL), '[]') AS pavilhoes
                 FROM localmontagem lm
                 LEFT JOIN localmontpavilhao lp ON lp.idmontagem = lm.idmontagem
                 WHERE lm.idmontagem = $1
                 GROUP BY lm.idmontagem`,
                [idmontagemAtualizada]
            );


            res.locals.acao = 'atualizou';
            res.locals.idregistroalterado = idmontagemAtualizada;
            res.locals.idusuarioAlvo = null;

            return res.json({ message: "Local de Montagem atualizado com sucesso!", localmontagem: localMontagemCompleto.rows[0] });

        } catch (error) {
            if (client) {
                await client.query('ROLLBACK'); // Rollback em caso de erro
            }
            console.error("Erro ao atualizar local de montagem:", error);
            res.status(500).json({ message: "Erro ao atualizar local de montagem.", detalhes: error.message });
        } finally {
            if (client) {
                client.release();
            }
        }
    }
);
// POST criar nova local montagem
router.post("/", verificarPermissao('localmontagem', 'cadastrar'), 
  logMiddleware('localmontagem', {
        buscarDadosAnteriores: async (req) => {
            return { dadosanteriores: null, idregistroalterado: null };
        }
  }),
  async (req, res) => {

    console.log("Requisição para criar novo local de montagem:", req.body);
  const { descMontagem, cidadeMontagem, ufMontagem, qtdPavilhao, pavilhoes } = req.body;
  const idempresa = req.idempresa;
  
  let client; 

  try {
      client = await pool.connect(); 
      await client.query('BEGIN');
     
      const resultLocalMontagem = await client.query(
          "INSERT INTO localmontagem (descmontagem, cidademontagem, ufmontagem, qtdpavilhao) VALUES ($1, $2, $3, $4) RETURNING idmontagem", // ✅ Retorna idmontagem
          [descMontagem, cidadeMontagem, ufMontagem, qtdPavilhao]
      );

      const novoLocalMontagem = resultLocalMontagem.rows[0];
      const idmontagem = novoLocalMontagem.idmontagem;
     
      await client.query(
          "INSERT INTO localmontempresas (idmontagem, idempresa) VALUES ($1, $2)",
          [idmontagem, idempresa]
      );

      // Inserir os pavilhões associados ao novo local de montagem
      for (const pavilhao of pavilhoes) {
          await client.query(
              `INSERT INTO localmontpavilhao (idmontagem, nmpavilhao)
                VALUES ($1, $2)`,
              [idmontagem, pavilhao.nmpavilhao]
          );
      }

      await client.query('COMMIT'); 

      const novoLocalMontagemId = idmontagem; 
      res.locals.acao = 'cadastrou';
      res.locals.idregistroalterado = novoLocalMontagemId;
      res.locals.idusuarioAlvo = null;

      // Opcional: Buscar o local de montagem completo com pavilhões para a resposta
      const localMontagemCompleto = await pool.query(
          `SELECT lm.*,
                  COALESCE(json_agg(lp.*) FILTER (WHERE lp.idpavilhao IS NOT NULL), '[]') AS pavilhoes
           FROM localmontagem lm
           LEFT JOIN localmontpavilhao lp ON lp.idmontagem = lm.idmontagem
           WHERE lm.idmontagem = $1
           GROUP BY lm.idmontagem`,
          [idmontagem]
      );

      res.status(201).json({ mensagem: "Local de Montagem salvo com sucesso!", localmontagem: novoLocalMontagem }); // Status 201 para criação
  } catch (error) {
      if (client) { 
          await client.query('ROLLBACK');
      }
      console.error("Erro ao salvar local de montagem e/ou associá-lo à empresa:", error);
      res.status(500).json({ erro: "Erro ao salvar local de montagem", detalhes: error.message });
  } finally {
      if (client) {
          client.release(); 
      }
  }
});

module.exports = router;