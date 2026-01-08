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
    
    const client = await pool.connect(); 
    
    console.log(`Iniciando aplicarCalculo: idempresa=${idempresa}, idexecutor=${idexecutor}, anoReferencia=${anoReferencia}, idIndiceAnual=${idIndiceAnual}`);
    
    // Fórmula de arredondamento TETO para o próximo 0.10: CEIL(Valor * 10) / 10
    const ceilToTenCents = (valor) => `CEIL((${valor})::numeric * 10) / 10`;
    
    // Função auxiliar para o cálculo de aumento com proteção contra NULL (COALESCE)
    const ctoFormula = (coluna, percentual) => 
        `(COALESCE(${coluna},0) + (COALESCE(${coluna},0) * COALESCE(${percentual},0)) / 100)`; 

    try {
        await client.query('BEGIN');

        // =========================================================================
        // PASSO 1: DESATIVA OS LOTES (SNAPSHOT) ANTERIORES ATIVOS
        // =========================================================================
        console.log(`Desativando lotes ativos anteriores para Empresa ${idempresa}, Ano ${anoReferencia}...`);
        
        const desativacaoFuncao = `UPDATE atualizacaoanual SET revertido = NOW() WHERE idempresa = $1 AND anoreferencia = $2 AND revertido IS NULL;`;
        const desativacaoEquip = `UPDATE atualizacaoanualequipamento SET revertido = NOW() WHERE idempresa = $1 AND anoreferencia = $2 AND revertido IS NULL;`;
        const desativacaoSupr = `UPDATE atualizacaoanualsuprimento SET revertido = NOW() WHERE idempresa = $1 AND anoreferencia = $2 AND revertido IS NULL;`;
        
        await client.query(desativacaoFuncao, [idempresa, anoReferencia]);
        await client.query(desativacaoEquip, [idempresa, anoReferencia]);
        await client.query(desativacaoSupr, [idempresa, anoReferencia]);

        // =========================================================================
        // PASSO 2: CRIA NOVOS LOTES (SNAPSHOTS) COM OS VALORES ATUAIS
        // =========================================================================
        console.log(`Criando novos snapshots de valores originais...`);

        // Snapshot Funções
        const snapshotFuncaoQuery = `
            INSERT INTO atualizacaoanual (
                idempresa, idexecutor, idcategoriafuncao, idfuncao, anoreferencia, idindiceaplicado,
                ctoseniororiginal, transpseniororiginal, ctoplenooriginal, ctojuniororiginal, 
                ctobaseoriginal, transporteoriginal, alimentacaooriginal, vdaoriginal, datasalvamento
            )
            SELECT $1, $2, cf.idcategoriafuncao, f.idfuncao, $3, $4,
                cf.ctofuncaosenior, cf.transpsenior, cf.ctofuncaopleno, cf.ctofuncaojunior, 
                cf.ctofuncaobase, cf.transporte, cf.alimentacao, f.vdafuncao, NOW()
            FROM funcao f
            INNER JOIN categoriafuncao cf ON cf.idcategoriafuncao = f.idcategoriafuncao
            INNER JOIN categoriafuncaoempresas cfe ON cfe.idcategoriafuncao = cf.idcategoriafuncao
            WHERE cfe.idempresa = $1;
        `;
        console.log('Executando snapshotFuncaoQuery...');
        const snapshotFuncaoRes = await client.query(snapshotFuncaoQuery, [idempresa, idexecutor, anoReferencia, idIndiceAnual]);
        console.log('snapshotFuncao inserted rows:', snapshotFuncaoRes.rowCount);

        // Snapshot Equipamentos
        const snapshotEquipQuery = `
            INSERT INTO atualizacaoanualequipamento (
                idempresa, idexecutor, idequip, anoreferencia, idindiceaplicado,
                ctoequiporiginal, vdaequiporiginal, datasalvamento
            )
            SELECT $1, $2, e.idequip, $3, $4, e.ctoequip, e.vdaequip, NOW()
            FROM equipamentos e
            INNER JOIN equipamentoempresas ee ON ee.idequip = e.idequip
            WHERE ee.idempresa = $1;
        `;
        console.log('Executando snapshotEquipQuery...');
        const snapshotEquipRes = await client.query(snapshotEquipQuery, [idempresa, idexecutor, anoReferencia, idIndiceAnual]);
        console.log('snapshotEquip inserted rows:', snapshotEquipRes.rowCount);

        // Snapshot Suprimentos
        const snapshotSuprQuery = `
            INSERT INTO atualizacaoanualsuprimento (
                idempresa, idexecutor, idsup, anoreferencia, idindiceaplicado,
                ctosuporiginal, vdasuporiginal, datasalvamento
            )
            SELECT $1, $2, s.idsup, $3, $4, s.ctosup, s.vdasup, NOW()
            FROM suprimentos s
            INNER JOIN suprimentoempresas se ON se.idsup = s.idsup
            WHERE se.idempresa = $1;
        `;
        console.log('Executando snapshotSuprQuery...');
        const snapshotSuprRes = await client.query(snapshotSuprQuery, [idempresa, idexecutor, anoReferencia, idIndiceAnual]);
        console.log('snapshotSupr inserted rows:', snapshotSuprRes.rowCount);

        // =========================================================================
        // PASSO 3: APLICA O ÍNDICE NAS TABELAS PRINCIPAIS
        // =========================================================================
        
        // 3.1 UPDATE CategoriaFunção
        const aplicacaoCtoQuery = `
            UPDATE categoriafuncao cf
            SET 
                ctofuncaosenior = ${ceilToTenCents(ctoFormula('ctofuncaosenior', 'ia.percentctovda'))}, 
                ctofuncaopleno = ${ceilToTenCents(ctoFormula('ctofuncaopleno', 'ia.percentctovda'))}, 
                ctofuncaojunior = ${ceilToTenCents(ctoFormula('ctofuncaojunior', 'ia.percentctovda'))}, 
                ctofuncaobase = ${ceilToTenCents(ctoFormula('ctofuncaobase', 'ia.percentctovda'))},
                transpsenior = ${ceilToTenCents(ctoFormula('cf.transpsenior', 'ia.percenttransporte'))}, 
                transporte = ${ceilToTenCents(ctoFormula('cf.transporte', 'ia.percenttransporte'))}, 
                alimentacao = ${ceilToTenCents(ctoFormula('cf.alimentacao', 'ia.percentalimentacao'))}
            FROM categoriafuncaoempresas cfe, indiceanual ia 
            WHERE ia.idindice = $1 AND cfe.idempresa = $2 AND cf.idcategoriafuncao = cfe.idcategoriafuncao;
        `;
        console.log('Executando aplicacaoCtoQuery (Categoria Função)...');
        const aplicacaoCtoRes = await client.query(aplicacaoCtoQuery, [idIndiceAnual, idempresa]);
        console.log('aplicacaoCto affected rows:', aplicacaoCtoRes.rowCount);

        // 3.2 UPDATE Função (VDA)
        const aplicacaoVdaQuery = `
            UPDATE funcao f
            SET vdafuncao = ${ceilToTenCents(ctoFormula('f.vdafuncao', 'ia.percentctovda'))}
            FROM categoriafuncaoempresas cfe, indiceanual ia 
            WHERE ia.idindice = $1 AND cfe.idempresa = $2 AND f.idcategoriafuncao = cfe.idcategoriafuncao;
        `;
        console.log('Executando aplicacaoVdaQuery (Função VDA)...');
        const aplicacaoVdaRes = await client.query(aplicacaoVdaQuery, [idIndiceAnual, idempresa]);
        console.log('aplicacaoVda affected rows:', aplicacaoVdaRes.rowCount);

        // 3.3 UPDATE Equipamentos
        const aplicacaoEquipQuery = `
            UPDATE equipamentos e
            SET 
                ctoequip = ${ceilToTenCents(ctoFormula('e.ctoequip', 'ia.percentctovda'))},
                vdaequip = ${ceilToTenCents(ctoFormula('e.vdaequip', 'ia.percentctovda'))}
            FROM equipamentoempresas ee, indiceanual ia
            WHERE ia.idindice = $1 AND ee.idempresa = $2 AND e.idequip = ee.idequip;
        `;
        console.log('Executando aplicacaoEquipQuery (Equipamentos)...');
        const aplicacaoEquipRes = await client.query(aplicacaoEquipQuery, [idIndiceAnual, idempresa]);
        console.log('aplicacaoEquip affected rows:', aplicacaoEquipRes.rowCount);

        // 3.4 UPDATE Suprimentos
        const aplicacaoSuprQuery = `
            UPDATE suprimentos s
            SET 
                ctosup = ${ceilToTenCents(ctoFormula('s.ctosup', 'ia.percentctovda'))},
                vdasup = ${ceilToTenCents(ctoFormula('s.vdasup', 'ia.percentctovda'))}
            FROM suprimentoempresas se, indiceanual ia
            WHERE ia.idindice = $1 AND se.idempresa = $2 AND s.idsup = se.idsup;
        `;
        console.log('Executando aplicacaoSuprQuery (Suprimentos)...');
        const aplicacaoSuprRes = await client.query(aplicacaoSuprQuery, [idIndiceAnual, idempresa]);
        console.log('aplicacaoSupr affected rows:', aplicacaoSuprRes.rowCount);

        // =========================================================================
        // PASSO 4: REGISTRA A DATA DE APLICAÇÃO NO ÍNDICE
        // =========================================================================
        console.log('Atualizando dataatualizacao no indiceanual...');
        const updateIndiceRes = await client.query(`UPDATE indiceanual SET dataatualizacao = NOW() WHERE idindice = $1;`, [idIndiceAnual]);
        console.log('indiceanual update affected rows:', updateIndiceRes.rowCount);

        await client.query('COMMIT');
        return { success: true, message: 'Índice aplicado em Funções, Equipamentos e Suprimentos com sucesso.' };

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erro ao aplicar o cálculo:', error);
        return { success: false, message: 'Falha ao aplicar o índice.', error: error.message };
    } finally {
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
            return res.status(500).json({ message: resultado.message || "Erro desconhecido na aplicação do índice.", detalhes: resultado.error });
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

            console.log(`Aplicando índice na tabela 'equipamentos'...`);
            await client.query(`
                UPDATE equipamentos e
                SET 
                    ctoequip = aae.ctoequiporiginal,
                    vdaequip = aae.vdaequiporiginal
                FROM atualizacaoanualequipamento aae
                WHERE e.idequip = aae.idequip 
                AND aae.idindiceaplicado = $1
            `, [idIndiceLote]);

            // --- ATUALIZAÇÃO DE SUPRIMENTOS ---
            console.log(`Aplicando índice na tabela 'suprimentos'...`);
            await client.query(`
                UPDATE suprimentos s
                SET 
                    ctosup = aas.ctosuporiginal,
                    vdasup = aas.vdasuporiginal
                FROM atualizacaoanualsuprimento aas
                WHERE s.idsup = aas.idsup 
                AND aas.idindiceaplicado = $1
            `, [idIndiceLote]);

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


router.get("/:id/relatorio-comparacao", verificarPermissao('IndiceAnual', 'pesquisar'), async (req, res) => {
    const idIndiceAnual = req.params.id;
    const idempresa = req.idempresa;
    let client;
    try {
        client = await pool.connect();
        const indiceRes = await client.query(`SELECT ano, dataatualizacao, percentctovda FROM indiceanual WHERE idindice = $1`, [idIndiceAnual]);
        const idx = indiceRes.rows[0];

        const reportQuery = `
            -- Funções
            SELECT f.descfuncao as item, 'Função' as categoria, aa.vdaoriginal as valor_original, f.vdafuncao as valor_atual
            FROM atualizacaoanual aa
            JOIN funcao f ON f.idfuncao = aa.idfuncao
            WHERE aa.idindiceaplicado = $1 AND aa.idempresa = $2 AND aa.revertido IS NULL
            
            UNION ALL
            
            -- Equipamentos
            SELECT e.descequip as item, 'Equipamento' as categoria, aae.vdaequiporiginal as valor_original, e.vdaequip as valor_atual
            FROM atualizacaoanualequipamento aae
            JOIN equipamentos e ON e.idequip = aae.idequip
            WHERE aae.idindiceaplicado = $1 AND aae.idempresa = $2 AND aae.revertido IS NULL
            
            UNION ALL
            
            -- Suprimentos
            SELECT s.descsup as item, 'Suprimento' as categoria, aas.vdasuporiginal as valor_original, s.vdasup as valor_atual
            FROM atualizacaoanualsuprimento aas
            JOIN suprimentos s ON s.idsup = aas.idsup
            WHERE aas.idindiceaplicado = $1 AND aas.idempresa = $2 AND aas.revertido IS NULL
        `;

        const result = await client.query(reportQuery, [idIndiceAnual, idempresa]);

        res.json({
            indice: {
                anoReferencia: idx.ano,
                dataAplicacao: idx.dataatualizacao,
                percentctovda: idx.percentctovda
            },
            detalhes: result.rows
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        if (client) client.release();
    }
});

module.exports = router;