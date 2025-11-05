const express = require('express');
const router = express.Router();
const pool = require('../db'); // ajuste o caminho conforme seu projeto
const { autenticarToken, contextoEmpresa } = require('../middlewares/authMiddlewares');
const { verificarPermissao } = require('../middlewares/permissaoMiddleware');
const logMiddleware = require('../middlewares/logMiddleware');

// Aplica autenticação em todas as rotas

router.get('/empresas',  verificarPermissao('Empresas', 'pesquisar'), async (req, res) => {
  console.log('✅ [GET /empresas] Rota acessada com sucesso');
  const { nmFantasia } = req.query;  
  
  try { 
      
      console.log("🔍 Buscando todas as empresas:");
      const result = await pool.query(
        `SELECT * 
        FROM empresas        
        ORDER BY nmfantasia`
        );
      console.log("✅ Consulta de todos as empresas retornou:", result.rows.length, "linhas.");
      return result.rows.length
        ? res.json(result.rows)
        : res.status(404).json({ message: "Nenhuma Empresa encontrada" });
  } catch (error) {
    console.error("❌ Erro ao buscar empresas:", error);
    res.status(500).json({ message: "Erro ao buscar empresas" });
  }
});

router.use(autenticarToken());
router.use(contextoEmpresa);

// router.get('/', verificarPermissao('Modulos', 'pesquisar'), async (req, res) => {
//    console.log("✅ ROTA MODULOS /modulos ACESSADA");
//    const { nmModulo } = req.query;
//    const idempresa = req.idempresa;
//   try {
    
//       if (nmModulo) {
//         const result = await pool.query(
//           `SELECT m.modulo 
//           FROM modulos m
//           INNER JOIN moduloempresas me ON m.idmodulo = me.idmodulo
//           WHERE me.idempresa = $1 AND m.modulo ILIKE $2 LIMIT 1`,
//           [idempresa, `%${nmModulo}%`]
//       );
//       return result.rows.length
//         ? res.json(result.rows[0])
//         : res.status(404).json({ message: "Equipamento não encontrada" });
//     } else {
//       const result = await pool.query(`SELECT m.modulo 
//         FROM modulos m
//         INNER JOIN moduloempresas me ON m.idmodulo = me.idmodulo
//         WHERE me.idempresa = $1
//         ORDER BY modulo`, [idempresa]);

//       return result.rows.length
//         ? res.json(result.rows)
//         : res.status(404).json({ message: "Nenhuma Módulo encontrado" });
//     }
   
//   } catch (err) {
//     console.error('Erro ao buscar módulos:', err);
//     res.status(500).json({ erro: 'Erro ao buscar módulos' });
//   }
// });

router.get('/', verificarPermissao('Modulos', 'pesquisar'), async (req, res) => {
    console.log("✅ ROTA MODULOS /modulos ACESSADA");
    const { nmModulo, idModuloPesquisa } = req.query; // Adicionamos idModuloPesquisa (caso precise buscar um único módulo por ID)
    const idempresa = req.idempresa; // ID da empresa principal do usuário logado

    try {
        let result;
        let queryBase = `
            SELECT 
                m.idmodulo,
                m.modulo AS "nmModulo",
                ARRAY_AGG(me.idempresa ORDER BY me.idempresa) AS empresas
            FROM modulos m
            INNER JOIN moduloempresas me ON m.idmodulo = me.idmodulo
        `;
        let whereClauses = [];
        let queryParams = [];
        let paramIndex = 1;

        // 1. FILTRO DE EMPRESA (Garantir que apenas módulos associados à empresa do usuário sejam vistos)
        // Isso é crucial se você quiser que a listagem geral filtre pelo ID da empresa principal
        whereClauses.push(`me.idempresa = $${paramIndex++}`);
        queryParams.push(idempresa);

        // 2. FILTRO POR NOME DO MÓDULO (Pesquisa ILIKE)
        if (nmModulo) {
            // Se estiver pesquisando por nome, filtramos por nome e limitamos a 1, mas AINDA precisamos do ID da empresa na lista
            whereClauses.push(`m.modulo ILIKE $${paramIndex++}`);
            queryParams.push(`%${nmModulo}%`);
        }
        
        // 3. FILTRO POR ID DO MÓDULO (Para carregar dados de edição)
        if (idModuloPesquisa) {
            whereClauses.push(`m.idmodulo = $${paramIndex++}`);
            queryParams.push(idModuloPesquisa);
        }
        
        // Constrói a cláusula WHERE
        if (whereClauses.length > 0) {
            queryBase += ` WHERE ${whereClauses.join(' AND ')}`;
        }
        
        // 4. AGRUPAMENTO e ORDENAÇÃO
        queryBase += ` 
            GROUP BY m.idmodulo, m.modulo
            ORDER BY m.modulo
        `;

        // Se estiver pesquisando por nome (e for uma busca de campo único), limitamos a 1
        if (nmModulo && !idModuloPesquisa) {
            queryBase += ` LIMIT 1`;
        }

        result = await pool.query(queryBase, queryParams);

        // --- Tratamento da Resposta ---

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Nenhum Módulo encontrado." });
        }
        
        // Se a busca for por nmModulo (busca de um único item), retorna o primeiro item
        if (nmModulo && !idModuloPesquisa) {
            return res.json(result.rows[0]);
        } 
        
        // Caso contrário, retorna a lista completa (ou o item único se for por ID)
        return res.json(result.rows);

    } catch (err) {
        console.error('Erro ao buscar módulos:', err);
        res.status(500).json({ erro: 'Erro ao buscar módulos', detail: err.message });
    }
});

router.put("/:id", 
  verificarPermissao('Modulos', 'alterar'),
  logMiddleware('Modulos', { // ✅ Módulo 'Modulos' para o log
      buscarDadosAnteriores: async (req) => {
          const idModulo = parseInt(req.params.id); // O ID do módulo vem do parâmetro da URL
          const idempresa = req.idempresa;

          if (!idModulo) {
              return { dadosanteriores: null, idregistroalterado: null };
          }
          
          try {
              // Seleciona todos os campos importantes do módulo ANTES da atualização
              const result = await pool.query(
                  `SELECT m.* FROM modulos m
                     INNER JOIN moduloempresas me ON me.idmodulo = m.idmodulo
                     WHERE m.idmodulo = $1 AND me.idempresa = $2`,
                    [idModulo, idempresa]
              );
              const linha = result.rows[0] || null;
              return {
                  dadosanteriores: linha, // O objeto módulo antes da alteração
                  idregistroalterado: linha?.idmodulo || null // O ID do módulo que está sendo alterado
              };
          } catch (error) {
              console.error("Erro ao buscar dados anteriores do módulo:", error);
              return { dadosanteriores: null, idregistroalterado: null };
          }
      }
  }),
  async (req, res) => {
  const id = req.params.id;
  const idempresa = req.idempresa;
  const { nmModulo} = req.body;

  if (isNaN(id)) {
      return res.status(400).json({ message: "ID do módulo inválido. Por favor, corrija o front-end." });
  }

  try {
      const result = await pool.query(
        `UPDATE modulos m
          SET modulo = $1
          FROM moduloempresas me
          WHERE m.idmodulo = $2 AND me.idmodulo = m.idmodulo AND me.idempresa = $3
          RETURNING m.idmodulo`, 
        [nmModulo, id, idempresa]
      );

      if (result.rowCount) {
        const moduloAtualizadoId = result.rows[0].idmodulo; 
        
        res.locals.acao = 'atualizou';
        res.locals.idregistroalterado = moduloAtualizadoId; 
        res.locals.idusuarioAlvo = null; 

        return res.json({ message: "Módulo atualizado com sucesso!", modulos: result.rows[0] });
      } else {
          return res.status(404).json({ message: "Módulo não encontrado para atualizar." });
      }
    } catch (error) {
            console.error("Erro ao atualizar módulo:", error);
            res.status(500).json({ message: "Erro ao atualizar módulos." });
    }
});

// POST criar nova módulos
router.post("/", verificarPermissao('Modulos', 'cadastrar'), 
  logMiddleware('Modulos', { 
      buscarDadosAnteriores: async (req) => {
        return { dadosanteriores: null, idregistroalterado: null };
      }
  }),
  async (req, res) => {
  const { nmModulo, empresas } = req.body;
  const idempresa = req.idempresa;

  let client; // Variável para a conexão de transação

  if (!empresas || empresas.length === 0) {
      return res.status(400).json({ erro: "Pelo menos uma empresa deve ser selecionada para o módulo." });
  }

  console.log("Dados recebidos:", req.body);
  try {
      client = await pool.connect(); // Inicia a transação
      await client.query('BEGIN');

      // 1. Insere o novo equipamento na tabela 'equipamentos'
      const resultModulo = await client.query(
          "INSERT INTO modulos (modulo) VALUES ($1) RETURNING idmodulo, modulo",
          [nmModulo]
      );

      const novoModulo = resultModulo.rows[0];
      const idmodulo = novoModulo.idmodulo;

      // // 2. Insere a associação na tabela 'moduloempresas'
      // await client.query(
      //     "INSERT INTO moduloempresas (idmodulo, idempresa) VALUES ($1, $2)",
      //     [idmodulo, idempresa]
      // );

      const insertPromises = empresas.map(id => {
          // Garante que o ID é um número (segurança)
          const idEmpresaNum = parseInt(id); 
          if (isNaN(idEmpresaNum)) return null; 

          return client.query(
              "INSERT INTO moduloempresas (idmodulo, idempresa) VALUES ($1, $2) ON CONFLICT DO NOTHING",
              [idmodulo, idEmpresaNum]
          );
      }).filter(p => p !== null); // Remove promessas nulas (se o ID não for válido)

      // Executa todas as inserções
      await Promise.all(insertPromises);

      await client.query('COMMIT'); // Confirma a transação

      const novoModuloId = idmodulo; // ID do módulo recém-criado
      res.locals.acao = 'cadastrou';
      res.locals.idregistroalterado = novoModuloId; 
      res.locals.idusuarioAlvo = null;

      res.status(201).json({ mensagem: "Módulos salvo com sucesso!", modulos: novoModuloId }); // Status 201 para criação
  } catch (error) {
      if (client) { // Se a conexão foi estabelecida, faz o rollback
          await client.query('ROLLBACK');
      }
      console.error("Erro ao salvar módulos e/ou associá-lo à empresa:", error);
      res.status(500).json({ erro: "Erro ao salvar módulos.", detail: error.message });
  } finally {
      if (client) {
          client.release(); // Libera a conexão do pool
      }
  }    

});

module.exports = router;
