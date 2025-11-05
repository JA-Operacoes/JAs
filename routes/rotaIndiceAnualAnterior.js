const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB");
const { autenticarToken, contextoEmpresa } = require('../middlewares/authMiddlewares');
const { verificarPermissao } = require('../middlewares/permissaoMiddleware');
const logMiddleware = require('../middlewares/logMiddleware');

router.use(autenticarToken());
router.use(contextoEmpresa);

// GET todas ou por descrição
router.get("/", verificarPermissao('IndiceAnual', 'pesquisar'), async (req, res) => {
  const { anoIndice } = req.query;
  const idempresa = req.idempresa;
  console.log("anoIndice NA ROTA INDICEANUAL", anoIndice, idempresa);
  try {
    let result;

        if (anoIndice) { // Priorize a busca por código do banco se ele existir
            result = await pool.query(
                `SELECT id.idindice, id.ano, id.percentctovda, id.percentalimentacao, id.percenttransporte, id.dataatualizacao
                 FROM indiceanual id
                 INNER JOIN indiceanualempresas e ON e.idindice = id.idindice
                 WHERE e.idempresa = $1 AND id.ano = $2`, // Use = para correspondência exata do código
                [idempresa, anoIndice]
            );
            console.log("RESULTADO QUERY POR CODIGO", result.rows);
            return result.rows.length > 0
                ? res.json(result.rows[0]) // Retorna o primeiro encontrado, já que o código deve ser único
                : res.status(404).json({ message: "Índice Anual não encontrado com o ano fornecido para esta empresa." });
        } else { // Se nenhum parâmetro de busca, retorna todos os índices anuais da empresa
            result = await pool.query(
                `SELECT id.idindice, id.ano, id.percentctovda, id.percentalimentacao, id.percenttransporte, id.dataatualizacao
                 FROM indiceanual id
                 INNER JOIN indiceanualempresas e ON e.idindice = id.idindice
                 WHERE e.idempresa = $1
                 ORDER BY id.ano ASC`,
                [idempresa]
            );
            console.log("RESULTADO QUERY TODOS", result.rows);
            return result.rows.length > 0
                ? res.json(result.rows)
                : res.status(404).json({ message: "Nenhum índice anual encontrado para esta empresa." });
        }
    } catch (error) {
        console.error("❌ Erro ao buscar índices anuais:", error);
        return res.status(500).json({ error: error.message || "Erro ao buscar índices anuais" });
    }
});

// PUT atualizar
router.put("/:id", verificarPermissao('IndiceAnual', 'alterar'), 
  logMiddleware('IndiceAnual', { // ✅ Módulo 'bancos' para o log
      buscarDadosAnteriores: async (req) => {
          const idIndiceAnual = req.params.id;
          const idempresa = req.idempresa; 

          if (!idBanco) {
              return { dadosanteriores: null, idregistroalterado: null };
          }

          try {
              
              const result = await pool.query(
                  `SELECT id.* FROM indiceanual id
                    INNER JOIN indiceanualempresas e ON e.idindice = id.idindice
                    WHERE id.idindice = $1 AND e.idempresa = $2`, 
                  [idIndiceAnual, idempresa]
              );
              const linha = result.rows[0] || null;
              return {
                  dadosanteriores: linha, 
                  idregistroalterado: linha?.idindice || null 
              };
          } catch (error) {
              console.error("Erro ao buscar dados anteriores do índice anual:", error);
              return { dadosanteriores: null, idregistroalterado: null };
          }
      }
  }),
  async (req, res) => {
  const idIndiceAnual = req.params.id;
  const idempresa = req.idempresa;
  const { anoIndice, percentctovda, percentalimentacao, percenttransporte } = req.body;

  try {
    const result = await pool.query(
      `UPDATE indiceanual id
        SET ano = $1, percentctovda = $2, percentalimentacao = $3, percenttransporte = $4
        FROM indiceanualempresas e
        WHERE id.idindice = $5 AND e.idindice = id.idindice AND e.idempresa = $6
        RETURNING id.idindice`, // ✅ Retorna idindice para o log
      [anoIndice, percentctovda, percentalimentacao, percenttransporte, id, idempresa]
    );

    if (result.rowCount) {
      const indiceAnualAtualizadoId = result.rows[0].idindice;

      // --- Ponto Chave para o Log ---
      res.locals.acao = 'atualizou';
      res.locals.idregistroalterado = indiceAnualAtualizadoId;
      res.locals.idusuarioAlvo = null;

      return res.json({ message: "Índice anual atualizado com sucesso!", indiceAnual: result.rows[0] });
    } else {
        return res.status(404).json({ message: "Índice anual não encontrado ou você não tem permissão para atualizá-lo." });
    }
  } catch (error) {
      console.error("Erro ao atualizar banco:", error);
      res.status(500).json({ message: "Erro ao atualizar banco." });
  }
});

// POST criar nova bancos
router.post("/", verificarPermissao('IndiceAnual', 'cadastrar'), 
  logMiddleware('IndiceAnual', {
        buscarDadosAnteriores: async (req) => {
            return { dadosanteriores: null, idregistroalterado: null };
        }
  }),
  async (req, res) => {
  const { anoIndice, percentCtoVda, percentAlimentacao, percentTransporte } = req.body; 
  const idempresa = req.idempresa; 

  let client; 
  console.log("indiceAnual na rota", anoIndice, percentCtoVda, percentAlimentacao, percentTransporte);
  try {
    client = await pool.connect(); 
    await client.query('BEGIN');
   
    const resultIndice = await client.query(
        "INSERT INTO indiceanual (ano, percentctovda, percentalimentacao, percenttransporte) VALUES ($1, $2, $3, $4) RETURNING idindice", 
        [anoIndice, percentCtoVda, percentAlimentacao, percentTransporte]
    );

    const novoIndiceAnual = resultIndice.rows[0];
    const idindice = novoIndiceAnual.idindice;

    await client.query(
        "INSERT INTO indiceanualempresas (idindice, idempresa) VALUES ($1, $2)",
        [idindice, idempresa]
    );

    await client.query('COMMIT'); 

    const novoIndiceAnualId = idindice; 
    res.locals.acao = 'cadastrou';
    res.locals.idregistroalterado = novoIndiceAnualId;
    res.locals.idusuarioAlvo = null;

    res.status(201).json({ mensagem: "Índice anual salvo com sucesso!", indiceAnual: novoIndiceAnual }); // Status 201 para criação
  } catch (error) {
      if (client) { // Se a conexão foi estabelecida, faz o rollback
          await client.query('ROLLBACK');
      }
      console.error("❌ Erro ao salvar índice anual e/ou associá-lo à empresa:", error);
      res.status(500).json({ erro: "Erro ao salvar índice anual", detalhes: error.message });
  } finally {
      if (client) {
          client.release(); // Libera a conexão do pool
      }
  }
    
});

// =========================================================================
// ROTA 1: APLICAR CÁLCULOS (Salva Snapshot e Atualiza CategoriaFuncao)
// =========================================================================
router.post("/:id/aplicar-calculo", verificarPermissao('IndiceAnual', 'alterar'), 
    logMiddleware('IndiceAnual', { acao: 'aplicou_indices' }),
    async (req, res) => {

        const idIndiceAnual = req.params.id;
        const idempresa = req.idempresa;
        // Certifique-se de que o ID do usuário está injetado pelo middleware
        //const idexecutor = req.idusuario;

        const idexecutor = req.usuario.idusuario;
        // Log de diagnóstico
        console.log("==========================================");
        console.log("REQ KEYS:", Object.keys(req));
        console.log("REQ.IDUSUARIO:", req.idusuario);
        console.log("REQ.USER:", req.user); // Se você usa 'passport' ou 'express-jwt'
        console.log("REQ.EMPRESA:", req.idempresa);
        console.log("==========================================");

        

        let client;

        try {
            client = await pool.connect();
            await client.query('BEGIN');

            // 1. OBTÉM DADOS DO ÍNDICE
            const indiceResult = await client.query(
                `SELECT idindice, ano, percentctovda, percentalimentacao, percenttransporte 
                 FROM indiceanual WHERE idindice = $1`,
                [idIndiceAnual]
            );

            if (indiceResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ message: "Índice anual não encontrado." });
            }

            const indice = indiceResult.rows[0];
            const anoReferencia = indice.ano;

            const fatorCtoVda = 1 + (indice.percentctovda / 100);
            const fatorAlimentacao = 1 + (indice.percentalimentacao / 100);
            const fatorTransporte = 1 + (indice.percenttransporte / 100);            

            // 2. VERIFICA E CRIA SNAPSHOT (SALVA VALORES ORIGINAIS)
            // const checkSnapshot = await client.query(
            //     `SELECT 1 FROM atualizacaoanual 
            //      WHERE idempresa = $1 AND anoreferencia = $2 AND revertido IS NULL LIMIT 1`,
            //     [idempresa, anoReferencia]
            // );

            // if (checkSnapshot.rowCount === 0) {
                // Se NÃO existe, salva o estado ATUAL da categoriafuncao como ORIGINAL
                // await client.query(
                //     `INSERT INTO atualizacaoanual (
                //         idempresa, idexecutor, idcategoriafuncao, anoreferencia, idindiceaplicado,
                //         ctoseniororiginal, transpseniororiginal, ctoplenooriginal, ctojuniororiginal, 
                //         ctobaseoriginal, transporteoriginal, alimentacaooriginal, vdaoriginal
                //     )
                //     SELECT 
                //         $1 AS idempresa, 
                //         $2 AS idexecutor,
                //         cf.idcategoriafuncao, 
                //         $3 AS anoreferencia, 
                //         $4 AS idindiceaplicado,
                //         cf.ctofuncaosenior, cf.transpsenior, cf.ctofuncaopleno, cf.ctofuncaojunior, 
                //         cf.ctofuncaobase, cf.transporte, cf.alimentacao, cf.vdafuncao

                //         (SELECT f.vdafuncao 
                //          FROM funcao f 
                //          WHERE f.idcategoriafuncao = cf.idcategoriafuncao 
                //         LIMIT 1) AS vdaoriginal

                //     FROM categoriafuncao cf
                //     INNER JOIN categoriafuncaoempresas cfe ON cfe.idcategoriafuncao = cf.idcategoriafuncao
                //     WHERE cfe.idempresa = $1
                //     ON CONFLICT (idempresa, idcategoriafuncao, anoreferencia) DO NOTHING`,                     
                //     [idempresa, idexecutor, anoReferencia, idIndiceAnual]
                // );

                await client.query(
                    `INSERT INTO atualizacaoanual (
                        idempresa, idexecutor, idcategoriafuncao, idfuncao, anoreferencia, idindiceaplicado,
                        ctoseniororiginal, transpseniororiginal, ctoplenooriginal, ctojuniororiginal, 
                        ctobaseoriginal, transporteoriginal, alimentacaooriginal, vdaoriginal
                    )
                    SELECT 
                        $1 AS idempresa, 
                        $2 AS idexecutor,
                        f.idcategoriafuncao, 
                        f.idfuncao, -- <<< NOVO: ID FUNCAO
                        $3 AS anoreferencia, 
                        $4 AS idindiceaplicado,
                        
                        -- CUSTOS VÊM DE CATEGORIAFUNCAO (cf)
                        cf.ctofuncaosenior, cf.transpsenior, cf.ctofuncaopleno, cf.ctofuncaojunior, 
                        cf.ctofuncaobase, cf.transporte, cf.alimentacao, 
                        
                        -- VDA VEM DE FUNCAO (f)
                        f.vdafuncao AS vdaoriginal 
                        
                    -- BASE DO SELECT AGORA É A FUNCAO
                    FROM funcao f
                    
                    -- JUNTA COM CATEGORIAFUNCAO PARA PEGAR OS CUSTOS
                    INNER JOIN categoriafuncao cf ON cf.idcategoriafuncao = f.idcategoriafuncao
                    
                    -- JUNTA COM CATEGORIAFUNCAOEMPRESAS (para filtrar por empresa)
                    INNER JOIN categoriafuncaoempresas cfe ON cfe.idcategoriafuncao = cf.idcategoriafuncao
                    
                    WHERE cfe.idempresa = $1 -- Filtra pelas funções/categorias da empresa
                    
                    -- CHAVE DE CONFLITO ATUALIZADA
                    ON CONFLICT (idempresa, idfuncao, anoreferencia) DO NOTHING`, 
                    [idempresa, idexecutor, anoReferencia, idIndiceAnual]
                );
           // }

            // 3. APLICA OS CÁLCULOS E ATUALIZA A TABELA PRINCIPAL
            await client.query(
                `UPDATE categoriafuncao cf
                 SET 
                    -- Arredonda SEMPRE PARA BAIXO (FLOOR) para o 10 centavos (0.10) mais próximo
                    ctofuncaosenior = FLOOR( (cf.ctofuncaosenior * $1) / 0.10 ) * 0.10,
                    ctofuncaopleno = FLOOR( (cf.ctofuncaopleno * $1) / 0.10 ) * 0.10,
                    ctofuncaojunior = FLOOR( (cf.ctofuncaojunior * $1) / 0.10 ) * 0.10,
                    ctofuncaobase = FLOOR( (cf.ctofuncaobase * $1) / 0.10 ) * 0.10,
                    --vdafuncao = FLOOR( (cf.vdafuncao * $1) / 0.10 ) * 0.10,
                    
                    alimentacao = FLOOR( (cf.alimentacao * $2) / 0.10 ) * 0.10,

                    transporte = FLOOR( (cf.transporte * $3) / 0.10 ) * 0.10,
                    transpsenior = FLOOR( (cf.transpsenior * $3) / 0.10 ) * 0.10                   
                    
                    
                FROM categoriafuncaoempresas cfe
                WHERE 
                    cf.idcategoriafuncao = cfe.idcategoriafuncao
                    AND cfe.idempresa = $4`,
                [fatorCtoVda, fatorAlimentacao, fatorTransporte, idempresa]
            );

            await client.query(
                `UPDATE funcao f
                SET 
                    -- VDA/VENDA (Fator Cto/Vda - $1)
                    vdafuncao = FLOOR( (f.vdafuncao * $1) / 0.10 ) * 0.10
                    
                FROM categoriafuncao cf
                INNER JOIN categoriafuncaoempresas cfe ON cfe.idcategoriafuncao = cf.idcategoriafuncao
     
                WHERE 
                    f.idcategoriafuncao = cf.idcategoriafuncao  
                    AND cfe.idempresa = $2`,
                [fatorCtoVda, idempresa]
            );
            
            // 4. ATUALIZA A DATA DE APLICAÇÃO NO INDICE ANUAL (SUCESSO)
            // Esta é a linha que garante o seu requisito
            await client.query(
                `UPDATE indiceanual SET dataatualizacao = CURRENT_TIMESTAMP WHERE idindice = $1`,
                [idIndiceAnual]
            );

            await client.query('COMMIT');

            res.locals.acao = 'aplicou';
            res.locals.idregistroalterado = idIndiceAnual;
            
            res.json({ message: `Cálculos do ano ${anoReferencia} aplicados e valores originais salvos.` });

        } catch (error) {
            if (client) await client.query('ROLLBACK');
            console.error("❌ Erro ao aplicar índices e salvar snapshot:", error);
            if (error.code === '23505') { 
                 return res.status(409).json({ error: "Erro: Snapshot já existe para este ano/empresa." });
            }
            res.status(500).json({ error: "Erro ao aplicar índices e salvar snapshot.", detalhes: error.message });
        } finally {
            if (client) client.release();
        }
    }
);

// =========================================================================
// ROTA 2: DESFAZER CÁLCULOS (Reverte CategoriaFuncao e Marca Snapshot)
// =========================================================================
router.post("/:id/desfazer-calculo", verificarPermissao('IndiceAnual', 'alterar'),
    logMiddleware('IndiceAnual', { acao: 'desfez_indices' }),
    async (req, res) => {
        const idIndiceAnual = req.params.id;
        const idempresa = req.idempresa;
        const idexecutor = req.usuario?.idusuario;
        const obsReversao = req.body.observacao || 'Motivo não informado.';
        //const idexecutor = req.idusuario;

        console.log("ID EXECUTOR NO DESFAZER:", idexecutor) ;

        let client;

        try {
            client = await pool.connect();
            await client.query('BEGIN');

            // 1. OBTÉM O ANO DO ÍNDICE A SER DESFEITO
            const indiceResult = await client.query(
                `SELECT ano, dataatualizacao FROM indiceanual WHERE idindice = $1 AND idempresa = $2`,
                [idIndiceAnual, idempresa]
            );
            if (indiceResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ message: "Índice anual não encontrado." });
            }

            const { ano: anoReferencia, dataatualizacao } = indiceResult.rows[0];

            if (dataatualizacao === null) {
                await client.query('ROLLBACK');
                return res.status(409).json({ message: `Não há aplicação ativa do ano ${anoReferencia} para ser desfeita. (dataatualizacao IS NULL)` });
            }

            // 2. VERIFICA SNAPSHOTS DISPONÍVEIS PARA REVERSÃO
        //     // Verificamos se há algum snapshot *não revertido* para este ano/empresa
        //     const checkRevertidos = await client.query(
        //         `SELECT 1 FROM atualizacaoanual 
        //          WHERE idempresa = $1 AND anoreferencia = $2 AND revertido IS NULL LIMIT 1`,
        //         [idempresa, anoReferencia]
        //     );

        //     if (checkRevertidos.rowCount === 0) {
        //         await client.query('ROLLBACK');
        //         return res.status(404).json({ message: `Não há aplicação ativa para o ano ${anoReferencia} para ser desfeita.` });
        //     }

        //     // 3. REVERTE OS DADOS NA TABELA PRINCIPAL
        //     // await client.query(
        //     //     `UPDATE categoriafuncao cf
        //     //      SET
        //     //         ctofuncaosenior = aa.ctoseniororiginal,
        //     //         transpsenior = aa.transpseniororiginal,
        //     //         ctofuncaopleno = aa.ctoplenooriginal,
        //     //         ctofuncaojunior = aa.ctojuniororiginal,
        //     //         ctofuncaobase = aa.ctobaseoriginal,
        //     //         transporte = aa.transporteoriginal,
        //     //         alimentacao = aa.alimentacaooriginal,
        //     //         vdafuncao = aa.vdaoriginal
                   
        //     //      FROM atualizacaoanual aa
        //     //      WHERE cf.idcategoriafuncao = aa.idcategoriafuncao
        //     //        AND aa.anoreferencia = $1
        //     //        AND aa.idempresa = $2
        //     //        AND aa.revertido IS NULL`, 
        //     //     [anoReferencia, idempresa]
        //     // );

        //     // A. REVERTE OS CUSTOS (na Categoria Função)
        //     await client.query(
        //         `UPDATE categoriafuncao cf
        //         SET
        //             ctofuncaosenior = aa.ctoseniororiginal,
        //             transpsenior = aa.transpseniororiginal,
        //             ctofuncaopleno = aa.ctoplenooriginal,
        //             ctofuncaojunior = aa.ctojuniororiginal,
        //             ctofuncaobase = aa.ctobaseoriginal,
        //             transporte = aa.transporteoriginal,
        //             alimentacao = aa.alimentacaooriginal
        //         FROM atualizacaoanual aa
        //         WHERE cf.idcategoriafuncao = aa.idcategoriafuncao
        //         AND aa.anoreferencia = $1
        //         AND aa.idempresa = $2
        //         AND aa.revertido IS NULL`, 
        //         [anoReferencia, idempresa]
        //     );

        //     // B. REVERTE O VDA (na Função)
        //     await client.query(
        //         `UPDATE funcao f
        //         SET
        //             vdafuncao = aa.vdaoriginal -- Restaura o valor original do VDA
        //         FROM atualizacaoanual aa
        //         WHERE f.idfuncao = aa.idfuncao -- Liga pelo novo idfuncao do snapshot
        //         AND aa.anoreferencia = $1
        //         AND aa.idempresa = $2
        //         AND aa.revertido IS NULL`, 
        //         [anoReferencia, idempresa]
        //     );

        //     // 4. MARCA OS SNAPSHOTS COMO REVERTIDOS
        //     await client.query(
        //         `UPDATE atualizacaoanual 
        //          SET 
        //             revertido = CURRENT_TIMESTAMP,
        //             idexecutorreversao = $1, -- Marca quem desfez a ação
        //             obsreversao = $4
        //          WHERE anoreferencia = $2 AND idempresa = $3 AND revertido IS NULL`,
        //         [idexecutor, anoReferencia, idempresa, obsReversao]
        //     );

        //     await client.query(
        //         `UPDATE indiceanual SET dataatualizacao = NULL WHERE idindice = $1`,
        //         [idIndiceAnual]
        //     );

        //     await client.query('COMMIT');
            
        //     // Log de sucesso
        //     res.locals.acao = 'desfez';
        //     res.locals.idregistroalterado = idIndiceAnual;

        //     res.json({ message: `Reversão dos cálculos do ano ${anoReferencia} concluída com sucesso.` });

        // } catch (error) {
        //     if (client) await client.query('ROLLBACK');
        //     console.error("❌ Erro ao desfazer índices:", error);
        //     res.status(500).json({ error: "Erro ao desfazer índices.", detalhes: error.message });
        // } finally {
        //     if (client) client.release();
        // }

        // ----------------------------------------------------------------------
            // 2. IDENTIFICAR O LOTE ATIVO (MAIS RECENTE) PELO ID DO ÍNDICE APLICADO
            // ----------------------------------------------------------------------
            // Buscamos o ID do índice aplicado no lote mais recente que AINDA NÃO FOI REVERTIDO.
            const ultimoLoteResult = await client.query(
                `SELECT idindiceaplicado
                FROM atualizacaoanual 
                WHERE idempresa = $1 
                  AND anoreferencia = $2 
                  AND revertido IS NULL
                ORDER BY datasalvamento DESC -- Pega o mais recente
                LIMIT 1`,
                [idempresa, anoReferencia]
            );

            if (ultimoLoteResult.rowCount === 0) {
                await client.query('ROLLBACK');
                return res.status(409).json({ message: `Não há aplicação ativa (não revertida) do ano ${anoReferencia} para ser desfeita.` });
            }

            const idIndiceLote = ultimoLoteResult.rows[0].idindiceaplicado; 
            console.log("LOTE ATIVO ENCONTRADO (idindiceaplicado):", idIndiceLote);
            // ----------------------------------------------------------------------


            // 3. REVERTE OS DADOS NA TABELA PRINCIPAL (USANDO O ID DO ÍNDICE DO LOTE)

            // A. REVERTE OS CUSTOS (na Categoria Função)
            await client.query(
                `UPDATE categoriafuncao cf
                SET
                    ctofuncaosenior = aa.ctoseniororiginal,
                    transpsenior = aa.transpseniororiginal,
                    ctofuncaopleno = aa.ctoplenooriginal,
                    ctofuncaojunior = aa.ctojuniororiginal,
                    ctofuncaobase = aa.ctobaseoriginal,
                    transporte = aa.transporteoriginal,
                    alimentacao = aa.alimentacaooriginal
                FROM atualizacaoanual aa
                WHERE cf.idcategoriafuncao = aa.idcategoriafuncao
                  AND aa.anoreferencia = $1
                  AND aa.idempresa = $2
                  AND aa.idindiceaplicado = $3 -- Chave estável do LOTE
                  AND aa.revertido IS NULL`, 
                [anoReferencia, idempresa, idIndiceLote]
            );

            // B. REVERTE O VDA (na Função)
            await client.query(
                `UPDATE funcao f
                SET
                    vdafuncao = aa.vdaoriginal
                FROM atualizacaoanual aa
                WHERE f.idfuncao = aa.idfuncao 
                  AND aa.anoreferencia = $1
                  AND aa.idempresa = $2
                  AND aa.idindiceaplicado = $3 -- Chave estável do LOTE
                  AND aa.revertido IS NULL`, 
                [anoReferencia, idempresa, idIndiceLote]
            );

            // ----------------------------------------------------------------------
            // 4. MARCA TODOS OS SNAPSHOTS DESTE LOTE COMO REVERTIDOS
            // ----------------------------------------------------------------------
            const resultReversao = await client.query( // Adicionado variável para log
                `UPDATE atualizacaoanual 
                SET 
                    revertido = CURRENT_TIMESTAMP,
                    idexecutorreversao = $1, 
                    obsreversao = $4
                WHERE anoreferencia = $2 
                  AND idempresa = $3 
                  AND idindiceaplicado = $5 -- Marcar todo o lote
                  AND revertido IS NULL`,
                [idexecutor, anoReferencia, idempresa, obsReversao, idIndiceLote]
            );
            
            console.log("Linhas afetadas em atualizacaoanual (Passo 4):", resultReversao.rowCount); // Log para conferência

            // 5. ATUALIZA O INDICEANUAL 
            await client.query(
                `UPDATE indiceanual SET dataatualizacao = NULL WHERE idindice = $1`,
                [idIndiceAnual]
            );

            await client.query('COMMIT');
            
            res.locals.acao = 'desfez';
            res.locals.idregistroalterado = idIndiceAnual;

            res.json({ message: `Reversão do último cálculo (Lote ID ${idIndiceLote}) do ano ${anoReferencia} concluída com sucesso.` });

        } catch (error) {
            if (client) await client.query('ROLLBACK');
            console.error("❌ Erro ao desfazer índices:", error);
            res.status(500).json({ error: "Erro ao desfazer índices.", detalhes: error.message });
        } finally {
            if (client) client.release();
        }
    }
);

// =========================================================================
// ROTA 3: GERAR RELATÓRIO DE COMPARAÇÃO (Lógica Dinâmica)
// =========================================================================
router.get("/:id/relatorio-comparacao", verificarPermissao('IndiceAnual', 'pesquisar'),
    async (req, res) => {
        const idIndiceAnual = req.params.id;
        const idempresa = req.idempresa;
        
        let client;
        try {
            client = await pool.connect();

            // 1. OBTÉM O ANO DE REFERÊNCIA E O STATUS ATUAL (dataatualizacao)
            const indiceResult = await client.query(
                `SELECT ano, dataatualizacao FROM indiceanual WHERE idindice = $1`,
                [idIndiceAnual]
            );

            if (indiceResult.rows.length === 0) {
                return res.status(404).json({ message: "Índice Anual não encontrado." });
            }
            const anoReferencia = indiceResult.rows[0].ano;
            const dataAtualizacao = indiceResult.rows[0].dataatualizacao;
            const estaAtivo = dataAtualizacao !== null;

            // 2. LÓGICA DE IDENTIFICAÇÃO DO LOTE DE COMPARAÇÃO
            let idIndiceComparacao = null;

            if (estaAtivo) {
                // SE ATIVO: Usamos o próprio idIndiceAnual, buscando o snapshot NÃO revertido
                idIndiceComparacao = idIndiceAnual;

            } else {
                // SE REVERTIDO: Buscamos o ID do LOTE que foi o ÚLTIMO A SER REVERTIDO para este índice
                const ultimoLoteRevertido = await client.query(
                    `SELECT idindiceaplicado
                    FROM atualizacaoanual
                    WHERE idempresa = $1 
                      AND anoreferencia = $2 
                      AND revertido IS NOT NULL -- Busca os revertidos
                    ORDER BY revertido DESC -- Pega o mais recente revertido
                    LIMIT 1`,
                    [idempresa, anoReferencia]
                );

                if (ultimoLoteRevertido.rowCount > 0) {
                    idIndiceComparacao = ultimoLoteRevertido.rows[0].idindiceaplicado;
                }
            }

            // 3. VERIFICA SE ENCONTROU UM LOTE
            if (!idIndiceComparacao) {
                return res.status(404).json({ 
                    message: "Não há dados de aplicação para gerar o relatório de comparação deste índice. Tente aplicar os cálculos primeiro." 
                });
            }

            console.log("ID do Lote de Comparação:", idIndiceComparacao);


            // 4. BUSCA OS DADOS DE COMPARAÇÃO
            const reportQuery = `
                SELECT
                    f.descfuncao,
                    cf.nmcategoriafuncao,
                    
                    -- VALORES ORIGINAIS (DO SNAPSHOT)
                    aa.ctobaseoriginal AS cto_base_original,
                    aa.ctojuniororiginal AS cto_junior_original,
                    aa.ctoplenooriginal AS cto_pleno_original,
                    aa.ctoseniororiginal AS cto_senior_original,
                    aa.vdaoriginal AS vda_original,
                    
                    -- VALORES ATUAIS (DA TABELA PRINCIPAL)
                    cf_atual.ctofuncaobase AS cto_base_atual,
                    cf_atual.ctofuncaojunior AS cto_junior_atual,
                    cf_atual.ctofuncaopleno AS cto_pleno_atual,
                    cf_atual.ctofuncaosenior AS cto_senior_atual,
                    f_atual.vdafuncao AS vda_atual
                    
                FROM atualizacaoanual aa
                INNER JOIN funcao f ON f.idfuncao = aa.idfuncao
                INNER JOIN categoriafuncao cf ON cf.idcategoriafuncao = aa.idcategoriafuncao

                INNER JOIN categoriafuncao cf_atual ON cf_atual.idcategoriafuncao = aa.idcategoriafuncao
                INNER JOIN funcao f_atual ON f_atual.idfuncao = aa.idfuncao

                WHERE 
                    aa.idindiceaplicado = $1 -- Usamos o ID do LOTE ENCONTRADO
                    AND aa.idempresa = $2
                    AND aa.anoreferencia = $3
                ORDER BY cf.nmcategoriafuncao, f.descfuncao
            `;

            const result = await client.query(
                reportQuery,
                [idIndiceComparacao, idempresa, anoReferencia] // Passamos o idIndiceComparacao
            );

            // A verificação de result.rows.length já foi feita indiretamente acima, 
            // mas mantemos para segurança
            if (result.rows.length === 0) {
                return res.status(404).json({ message: "Nenhum dado encontrado para o lote de comparação selecionado." });
            }

            res.json(result.rows);

        } catch (error) {
            console.error("❌ Erro ao gerar relatório de comparação:", error);
            res.status(500).json({ error: "Erro ao gerar relatório de comparação.", detalhes: error.message });
        } finally {
            if (client) client.release();
        }
    }
);

module.exports = router;