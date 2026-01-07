const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB");
const { autenticarToken, contextoEmpresa } = require('../middlewares/authMiddlewares');
const { verificarPermissao } = require('../middlewares/permissaoMiddleware');
const logMiddleware = require('../middlewares/logMiddleware');


router.use(autenticarToken());
router.use(contextoEmpresa);

// GET todos os índices (Rota /indicesanual/all para preenchimento de SELECT)
router.get("/all", verificarPermissao('IndiceAnual', 'pesquisar'), async (req, res) => {
    const idempresa = req.idempresa;
    console.log("Rota /all - idempresa:", idempresa);
    try {
        const result = await pool.query(
            // Esta é a mesma query do bloco 'else' do router.get("/")
            `SELECT id.idindice, id.ano AS anoreferencia, id.percentctovda AS percentCtoVda, id.percentalimentacao AS percentAlimentacao, id.percenttransporte, id.dataatualizacao
             FROM indiceanual id
             INNER JOIN indiceanualempresas e ON e.idindice = id.idindice
             WHERE e.idempresa = $1
             ORDER BY id.ano ASC`,
            [idempresa]
        );
        
        // Renomeei as colunas no SELECT para corresponder exatamente ao esperado no frontend (anoreferencia, percentCtoVda, etc.)
        
        console.log("RESULTADO QUERY TODOS /ALL", result.rows);
        return result.rows.length > 0
            ? res.json(result.rows)
            : res.status(404).json({ message: "Nenhum índice anual encontrado para esta empresa." });
            
    } catch (error) {
        console.error("❌ Erro ao buscar todos os índices anuais (rota /all):", error);
        // Detecta erro de tabela ausente (Postgres code 42P01) e sugere a migration
        if (error && (error.code === '42P01' || /indiceanualempresas/i.test(error.message))) {
            const migrationSql = `
-- Cria tabela de associação entre índices anuais e empresas
CREATE TABLE IF NOT EXISTS indiceanualempresas (
  idindice INTEGER NOT NULL REFERENCES indiceanual(idindice) ON DELETE CASCADE,
  idempresa INTEGER NOT NULL REFERENCES empresas(idempresa) ON DELETE CASCADE,
  PRIMARY KEY (idindice, idempresa)
);
`;
            return res.status(500).json({
                error: "Tabela 'indiceanualempresas' não encontrada no banco de dados.",
                detalhes: error.message,
                sugestao_migracao: migrationSql.trim()
            });
        }
        return res.status(500).json({ error: error.message || "Erro ao buscar índices anuais" });
    }
});


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
        if (error && (error.code === '42P01' || /indiceanualempresas/i.test(error.message))) {
            const migrationSql = `
-- Cria tabela de associação entre índices anuais e empresas
CREATE TABLE IF NOT EXISTS indiceanualempresas (
  idindice INTEGER NOT NULL REFERENCES indiceanual(idindice) ON DELETE CASCADE,
  idempresa INTEGER NOT NULL REFERENCES empresas(idempresa) ON DELETE CASCADE,
  PRIMARY KEY (idindice, idempresa)
);
`;
            return res.status(500).json({
                error: "Tabela 'indiceanualempresas' não encontrada no banco de dados.",
                detalhes: error.message,
                sugestao_migracao: migrationSql.trim()
            });
        }
        return res.status(500).json({ error: error.message || "Erro ao buscar índices anuais" });
    }
});

// PUT atualizar
router.put("/:id", verificarPermissao('IndiceAnual', 'alterar'), 
  logMiddleware('IndiceAnual', { // ✅ Módulo 'bancos' para o log
      buscarDadosAnteriores: async (req) => {
          const idIndiceAnual = req.params.id;
          const idempresa = req.idempresa; 

          if (!idIndiceAnual) {
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
      [anoIndice, percentctovda, percentalimentacao, percenttransporte, idIndiceAnual, idempresa]
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

      if (error && (error.code === '42P01' || /indiceanualempresas/i.test(error.message))) {
          const migrationSql = `
-- Cria tabela de associação entre índices anuais e empresas
CREATE TABLE IF NOT EXISTS indiceanualempresas (
  idindice INTEGER NOT NULL REFERENCES indiceanual(idindice) ON DELETE CASCADE,
  idempresa INTEGER NOT NULL REFERENCES empresas(idempresa) ON DELETE CASCADE,
  PRIMARY KEY (idindice, idempresa)
);
`;
          return res.status(500).json({
              erro: "Tabela 'indiceanualempresas' não encontrada no banco de dados.",
              detalhes: error.message,
              sugestao_migracao: migrationSql.trim()
          });
      }

      res.status(500).json({ erro: "Erro ao salvar índice anual", detalhes: error.message });
  } finally {
      if (client) {
          client.release(); // Libera a conexão do pool
      }
  }
    
});



async function aplicarCalculo(idempresa, idexecutor, anoReferencia, idIndiceAnual) {
    
    const client = await pool.connect(); // Assumindo uma conexão de banco de dados
    
    // Fórmula de arredondamento TETO para o próximo 0.10: CEIL(Valor * 10) / 10
    const ceilToTenCents = (valor) => `CEIL((${valor})::numeric * 10) / 10`;

    try {
        // 1. INÍCIO DA TRANSAÇÃO
        await client.query('BEGIN');

        // =========================================================================
        // PASSO 1: DESATIVA O LOTE (SNAPSHOT) ANTERIOR ATIVO
        // (Se existir um, marca como revertido, permitindo que um novo seja criado)
        // =========================================================================
        console.log(`Desativando lotes ativos anteriores para Empresa ${idempresa}, Ano ${anoReferencia}...`);
        
        const desativacaoQuery = `
            UPDATE atualizacaoanual
            SET 
                revertido = NOW()
            WHERE 
                idempresa = $1 AND 
                anoreferencia = $2 AND 
                revertido IS NULL; -- Busca apenas o lote que ainda não foi revertido
        `;
        await client.query(desativacaoQuery, [idempresa, anoReferencia]);

        // =========================================================================
        // PASSO 2: CRIA NOVO LOTE (SNAPSHOT) COM OS VALORES ATUAIS
        // (Salva os valores que ESTÃO AGORA em 'funcao' antes da aplicação do índice)
        // =========================================================================
        console.log(`Criando novo lote (snapshot) de valores originais...`);

        const novoLoteQuery = `
            INSERT INTO atualizacaoanual (
                idempresa, idexecutor, idcategoriafuncao, idfuncao, anoreferencia, idindiceaplicado,
                ctoseniororiginal, transpseniororiginal, ctoplenooriginal, ctojuniororiginal, 
                ctobaseoriginal, transporteoriginal, alimentacaooriginal, vdaoriginal,
                datasalvamento
            )
            SELECT 
                $1 AS idempresa, 
                $2 AS idexecutor,
                cf.idcategoriafuncao, 
                f.idfuncao, 
                $3 AS anoreferencia, 
                $4 AS idindiceaplicado,
                -- Buscando campos de custo da CATEGORIAFUNCAO (cf)
                cf.ctofuncaosenior AS ctoseniororiginal, 
                cf.transpsenior AS transpseniororiginal, 
                cf.ctofuncaopleno AS ctoplenooriginal, 
                cf.ctofuncaojunior AS ctojuniororiginal, 
                cf.ctofuncaobase AS ctobaseoriginal, 
                cf.transporte AS transporteoriginal, 
                cf.alimentacao AS alimentacaooriginal, 
                
                -- Buscando VDA da FUNCAO (f)
                f.vdafuncao AS vdaoriginal,

                NOW() AS datasalvamento
            FROM funcao f
            INNER JOIN categoriafuncao cf ON cf.idcategoriafuncao = f.idcategoriafuncao
            INNER JOIN categoriafuncaoempresas cfe ON cfe.idcategoriafuncao = cf.idcategoriafuncao
            WHERE cfe.idempresa = $1;
        `;
        await client.query(novoLoteQuery, [idempresa, idexecutor, anoReferencia, idIndiceAnual]);
        console.log(`Novo lote criado com sucesso.`);

        // =========================================================================
        // PASSO 3: APLICA O ÍNDICE NA TABELA 'categoriafuncao'
        // (Atualiza os valores da tabela principal com o novo cálculo)
        // =========================================================================
        console.log(`Aplicando índice na tabela 'categoriafuncao' com arredondamento de 10 centavos...`);

        // Função auxiliar para o cálculo de aumento
        const ctoFormula = (coluna, percentual) => 
            `(${coluna} + (${coluna} * ${percentual}) / 100)`;

        // Aplicando a fórmula de arredondamento nos resultados dos cálculos
        const aplicacaoCtoQuery = `
            UPDATE categoriafuncao cf
            SET 
                -- Aplica o percentual CTO/VDA em todos os campos de custo e ARREDONDA
                ctofuncaosenior = ${ceilToTenCents(ctoFormula('ctofuncaosenior', 'ia.percentctovda'))}, 
                ctofuncaopleno = ${ceilToTenCents(ctoFormula('ctofuncaopleno', 'ia.percentctovda'))}, 
                ctofuncaojunior = ${ceilToTenCents(ctoFormula('ctofuncaojunior', 'ia.percentctovda'))}, 
                ctofuncaobase = ${ceilToTenCents(ctoFormula('ctofuncaobase', 'ia.percentctovda'))},
                
                -- Aplica os percentuais específicos em Transporte e Alimentação e ARREDONDA
                transpsenior = ${ceilToTenCents(ctoFormula('cf.transpsenior', 'ia.percenttransporte'))}, 
                transporte = ${ceilToTenCents(ctoFormula('cf.transporte', 'ia.percenttransporte'))}, 
                alimentacao = ${ceilToTenCents(ctoFormula('cf.alimentacao', 'ia.percentalimentacao'))}

            FROM categoriafuncaoempresas cfe
            INNER JOIN indiceanual ia ON ia.idindice = $1
            WHERE 
                cfe.idempresa = $2 AND
                cf.idcategoriafuncao = cfe.idcategoriafuncao;
        `;
        await client.query(aplicacaoCtoQuery, [idIndiceAnual, idempresa]);

        console.log(`Aplicando índice na tabela 'funcao' (VDA) com arredondamento de 10 centavos...`);

        // 2. UPDATE na tabela FUNCAO (VDA)
        const aplicacaoVdaQuery = `
            UPDATE funcao f
            SET 
                vdafuncao = ${ceilToTenCents(ctoFormula('f.vdafuncao', 'ia.percentctovda'))}
            FROM categoriafuncao cf -- JOIN necessário para conseguir filtrar pela empresa
            INNER JOIN categoriafuncaoempresas cfe ON cfe.idcategoriafuncao = cf.idcategoriafuncao
            INNER JOIN indiceanual ia ON ia.idindice = $1
            WHERE 
                cfe.idempresa = $2 AND
                f.idcategoriafuncao = cf.idcategoriafuncao;
        `;
        await client.query(aplicacaoVdaQuery, [idIndiceAnual, idempresa]);
        
        // =========================================================================
        // PASSO 4: REGISTRA A DATA DE APLICAÇÃO NO ÍNDICE
        // (Marca o índice como 'utilizado')
        // =========================================================================
        console.log(`Registrando data de aplicação no índice anual...`);

        const indiceAtualizacaoQuery = `
            UPDATE indiceanual
            SET dataatualizacao = NOW()
            WHERE idindice = $1;
        `;
        await client.query(indiceAtualizacaoQuery, [idIndiceAnual]);

        // 5. FIM DA TRANSAÇÃO
        await client.query('COMMIT');
        
        console.log('Aplicação do índice concluída com sucesso!');
        return { success: true, message: 'Índice aplicado e snapshot histórico criado com sucesso.' };

    } catch (error) {
        // Se algo der errado, desfaz todas as operações acima
        await client.query('ROLLBACK');
        console.error('Erro ao aplicar o cálculo:', error);
        return { success: false, message: 'Falha ao aplicar o índice. A operação foi desfeita.', error: error.message };

    } finally {
        // Libera a conexão do cliente
        client.release();
    }
};


// =========================================================================
// ROTA 1: APLICAR CÁLCULOS (Chama a função aplicarCalculo)
// =========================================================================
router.post("/:id/aplicar-calculo", verificarPermissao('IndiceAnual', 'alterar'),
    logMiddleware('IndiceAnual', { acao: 'aplicou_indices' }),
    async (req, res) => {
        const idIndiceAnual = req.params.id;
        const idempresa = req.idempresa;
        const idexecutor = req.usuario?.idusuario || null; 
        
        const client = await pool.connect();
        let anoReferencia;
        try {
            // Obtém o ano de referência do índice para o Snapshot
            const result = await client.query(
                `SELECT ano FROM indiceanual WHERE idindice = $1`,
                [idIndiceAnual]
            );
            
            if (result.rows.length === 0) {
                client.release();
                return res.status(404).json({ message: "Índice anual não encontrado." });
            }
            anoReferencia = result.rows[0].ano;
        } catch (error) {
            client.release();
            return res.status(500).json({ message: "Erro ao buscar ano de referência." });
        } finally {
             // Garante que a conexão seja liberada antes de chamar a próxima função
             // que também vai pegar uma conexão do pool.
             if (client) client.release();
        }

        // CHAMA A FUNÇÃO PRINCIPAL DE LÓGICA (Corrigida acima)
        const resultado = await aplicarCalculo(idempresa, idexecutor, anoReferencia, idIndiceAnual);
        
        // RETORNA O RESULTADO
        if (resultado.success) {
            return res.json({ message: resultado.message });
        } else {
            console.error("Erro na aplicação:", resultado.error);
            return res.status(500).json({ message: resultado.message || "Erro desconhecido na aplicação do índice." });
        }
    }
);

// =========================================================================
// ROTA 2: DESFAZER CÁLCULOS (Reverte Valores e Marca Snapshot como Revertido)
// =========================================================================
router.post("/:id/desfazer-calculo", verificarPermissao('IndiceAnual', 'alterar'),
    logMiddleware('IndiceAnual', { acao: 'desfez_indices' }),
    async (req, res) => {
        const idIndiceAnual = req.params.id; // ID do Índice na tabela indiceanual
        const idempresa = req.idempresa;
        const idexecutor = req.usuario?.idusuario;
        const obsReversao = req.body.observacao || 'Motivo não informado.';

        let client;

        try {
            client = await pool.connect();
            await client.query('BEGIN');

            // 1. OBTÉM O ANO E VERIFICA O STATUS (dataatualizacao)
            const indiceResult = await client.query(
                `SELECT ano, dataatualizacao FROM indiceanual WHERE idindice = $1`, 
                [idIndiceAnual]
            );
            
            if (indiceResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ message: "Índice anual não encontrado." });
            }

            const indiceRow = indiceResult.rows[0];
            const anoReferencia = indiceRow.ano;
            const dataatualizacao = indiceRow.dataatualizacao; // 🛑 CORREÇÃO 1: Variável declarada

            // 🛑 GUARDA-ROTA 1: Só reverte se houver aplicação ativa
            if (dataatualizacao === null) { 
                await client.query('ROLLBACK');
                return res.status(409).json({ message: `Não há aplicação ativa (dataatualizacao IS NULL) do ano ${anoReferencia} para ser desfeita.` });
            }

            // 2. IDENTIFICA O LOTE ATIVO (O ÚLTIMO NÃO REVERTIDO)
            const ultimoLoteResult = await client.query(
                `SELECT idatualizacao, idindiceaplicado 
                FROM atualizacaoanual 
                WHERE idempresa = $1 
                AND anoreferencia = $2
                AND revertido IS NULL -- Busca o ATIVO
                ORDER BY datasalvamento DESC 
                LIMIT 1`,
                [idempresa, anoReferencia]
            );

            // 🛑 GUARDA-ROTA 2: Se dataatualizacao não é NULL, DEVE haver um lote ativo
            if (ultimoLoteResult.rowCount === 0) {
                await client.query('ROLLBACK');
                return res.status(500).json({ 
                    message: "Inconsistência de dados: Índice marcado como ATIVO, mas nenhum lote não-revertido foi encontrado.",
                    detalhes: "Por favor, contate o suporte."
                });
            }

            // 🛑 CORREÇÃO 2: Atribuição robusta de idLoteAtivo (resolve 'undefined')
            const loteAtivoRow = ultimoLoteResult.rows[0];
            
            // Tenta o casing mais provável (minúsculo)
            let idLoteAtivo = loteAtivoRow.idatualizacao; 
            
            // Se for undefined, tenta o casing alternativo (para BDs com aspas)
            if (idLoteAtivo === undefined) {
                 idLoteAtivo = loteAtivoRow.idAtualizacao; 
            }
            
            // Log e validação final do ID
            if (idLoteAtivo === undefined) {
                throw new Error("Erro de atribuição: Chave primária do lote ('idatualizacao') não encontrada. Verifique o SELECT no Passo 2.");
            }
            
            const idIndiceLote = loteAtivoRow.idindiceaplicado; 
            
            console.log("LOTE ATIVO ENCONTRADO para Reversão (idatualizacao):", idLoteAtivo); // Agora deve logar um número!
            console.log("LOTE ATIVO ENCONTRADO para Reversão (idindiceaplicado):", idIndiceLote);


            // 3. REVERTE OS CUSTOS (na Categoria Função) - SINTAXE CORRIGIDA
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
                AND aa.idindiceaplicado = $1`, // 🛑 CORREÇÃO: Usa o ID do LOTE!
                [idIndiceLote] // Passa o ID do lote (ex: 1)
            );

            // 4. REVERTE O VDA (na Função) - SINTAXE CORRIGIDA
            await client.query(
                `UPDATE funcao f
                SET
                    vdafuncao = aa.vdaoriginal
                FROM atualizacaoanual aa
                WHERE f.idfuncao = aa.idfuncao 
                AND aa.idindiceaplicado = $1`, // 🛑 CORREÇÃO: Usa o ID do LOTE!
                [idIndiceLote] // Passa o ID do lote (ex: 1)
            );

            // 5. MARCA TODO O LOTE ATIVO COMO REVERTIDO (Bulk Update pelo Lote ID)
            const resultReversao = await client.query(
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
            
            // 6. ATUALIZA O INDICEANUAL (dataatualizacao = NULL)
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


router.get("/:id/relatorio-comparacao", verificarPermissao('IndiceAnual', 'pesquisar'),
    async (req, res) => {
        const idIndiceAnual = req.params.id;
        const idempresa = req.idempresa;
        
        let client;
        try {
            client = await pool.connect();

            // 1. OBTÉM O ANO DE REFERÊNCIA E O STATUS DE ATUALIZAÇÃO DO ÍNDICE
            const indiceResult = await client.query(
                `SELECT ano AS anoreferencia, 
                        dataatualizacao, 
                        percentctovda, 
                        percentalimentacao, 
                        percenttransporte 
                 FROM indiceanual 
                 WHERE idindice = $1`,
                [idIndiceAnual]
            );

            if (indiceResult.rows.length === 0) {
                return res.status(404).json({ message: "Índice Anual não encontrado." });
            }
            
            // O JS acessa 'anoreferencia' graças ao alias acima
            const indiceData = indiceResult.rows[0];
            const anoReferencia = indiceData.anoreferencia; 
            const dataAtualizacao = indiceData.dataatualizacao;
          

            // 2. DEFINE A CONDIÇÃO DO LOTE
            let condicaoRevertido = 'NULL'; // Padrão para buscar o último lote revertido
            
            
            const reportQuery = `
                SELECT
                    aa.idatualizacao, 
                    f.descfuncao,
                    cf.nmcategoriafuncao,
                    
                    -- VALORES ORIGINAIS (DO SNAPSHOT - Tabela atualizacaoanual)
                    aa.ctobaseoriginal AS cto_base_original,
                    aa.ctojuniororiginal AS cto_junior_original,
                    aa.ctoplenooriginal AS cto_pleno_original,
                    aa.ctoseniororiginal AS cto_senior_original,
                    aa.vdaoriginal AS vda_original,
                    aa.transporteoriginal AS transporte_original,
                    aa.alimentacaooriginal AS alimentacao_original,
                    
                    -- VALORES ATUAIS (DA TABELA PRINCIPAL - Tabela funcao / categoriafuncao)
                    cf_atual.ctofuncaobase AS cto_base_atual,
                    cf_atual.ctofuncaojunior AS cto_junior_atual,
                    cf_atual.ctofuncaopleno AS cto_pleno_atual,
                    cf_atual.ctofuncaosenior AS cto_senior_atual,
                    cf_atual.alimentacao AS alimentacao_atual,
                    cf_atual.transporte AS transporte_atual,
                    f_atual.vdafuncao AS vda_atual
                   
                    
                FROM atualizacaoanual aa
                INNER JOIN funcao f ON f.idfuncao = aa.idfuncao
                INNER JOIN categoriafuncao cf ON cf.idcategoriafuncao = aa.idcategoriafuncao

                INNER JOIN categoriafuncao cf_atual ON cf_atual.idcategoriafuncao = aa.idcategoriafuncao
                INNER JOIN funcao f_atual ON f_atual.idfuncao = aa.idfuncao

                WHERE 
                    aa.anoreferencia = $1 
                    AND aa.idempresa = $2 
                    AND aa.revertido IS ${condicaoRevertido}
                ORDER BY cf.nmcategoriafuncao, f.descfuncao
            `.trim();

            const result = await client.query(
                reportQuery,
                [anoReferencia, idempresa] 
            );
                        
            if (result.rows.length === 0) {
                return res.status(404).json({ message: "Nenhum dado de funções encontrado para o lote de comparação selecionado." });
            }

            //res.json(result.rows);
            res.json({
                indice: {
                    anoReferencia: anoReferencia,
                    dataAplicacao: dataAtualizacao, // O campo que você precisa
                    percentctovda: indiceData.percentctovda,
                    percentalimentacao: indiceData.percentalimentacao,
                    percenttransporte: indiceData.percenttransporte
                },
                detalhes: result.rows
            });

        } catch (error) {
            console.error("❌ Erro ao gerar relatório de comparação:", error);
            res.status(500).json({ error: "Erro ao gerar relatório de comparação.", detalhes: error.message });
        } finally {
            if (client) client.release();
        }
    }
);

module.exports = router;