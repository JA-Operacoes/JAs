const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB");
const { autenticarToken, contextoEmpresa } = require('../middlewares/authMiddlewares');
const { verificarPermissao } = require('../middlewares/permissaoMiddleware');
const logMiddleware = require('../middlewares/logMiddleware');



router.get("/clientes", async (req, res) => {   
 
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

router.use(autenticarToken());
router.use(contextoEmpresa);

// GET todas ou por descrição
// router.get("/", verificarPermissao('Eventos', 'pesquisar'), async (req, res) => {
//   const { nmEvento } = req.query;
//   const idempresa = req.idempresa;
//   console.log("nmEvento NA ROTA", nmEvento, idempresa);
//   try {
//     if (nmEvento) {
//       const result = await pool.query(
//         `SELECT e.* FROM eventos e
//           INNER JOIN eventoempresas ee ON ee.idevento = e.idevento
//           WHERE ee.idempresa = $1 AND e.nmevento ILIKE $2 LIMIT 1`,
//         [idempresa, `%${nmEvento}%`]
//       );
//       console.log("RESULTADO QUERY", result);
//       return result.rows.length
//         ? res.json(result.rows[0])
//         : res.status(404).json({ message: "Evento não encontrada" });
//     } else {
//       const result = await pool.query(`SELECT e.* FROM eventos e
//                  INNER JOIN eventoempresas ee ON ee.idevento = e.idevento
//                  WHERE ee.idempresa = $1 ORDER BY nmevento ASC`,
//                 [idempresa]);
//       return result.rows.length
//         ? res.json(result.rows)
//         : res.status(404).json({ message: "Nenhuma evento encontrada" });
//     }
//   } catch (error) {
//     console.error("Erro ao buscar evento:", error);
//     res.status(500).json({ message: "Erro ao buscar evento" });
//   }
// });

// PUT atualizar
// router.put("/:id", verificarPermissao('Eventos', 'alterar'), 
//   logMiddleware('Eventos', { // ✅ Módulo 'Eventos' para o log
//       buscarDadosAnteriores: async (req) => {
//           const idEvento = req.params.id; // O ID do evento vem do parâmetro da URL
//           const idempresa = req.idempresa; // ✅ Obtém o idempresa do contexto

//           if (!idEvento) {
//               return { dadosanteriores: null, idregistroalterado: null };
//           }

//           try {
//               // ✅ Seleciona os dados do evento, garantindo que pertence à empresa do usuário
//               const result = await pool.query(
//                   `SELECT e.* FROM eventos e
//                     INNER JOIN eventoempresas ee ON ee.idevento = e.idevento
//                     WHERE e.idevento = $1 AND ee.idempresa = $2`, // Assumindo que a coluna ID é 'idevento'
//                   [idEvento, idempresa]
//               );
//               const linha = result.rows[0] || null;
//               return {
//                   dadosanteriores: linha, // O objeto evento antes da alteração
//                   idregistroalterado: linha?.idevento || null // O ID do evento que está sendo alterado
//               };
//           } catch (error) {
//               console.error("Erro ao buscar dados anteriores do evento:", error);
//               return { dadosanteriores: null, idregistroalterado: null };
//           }
//       }
//   }),
//   async (req, res) => {
//   const id = req.params.id;
//   const idempresa = req.idempresa;
//   const { nmEvento } = req.body;

//   try {
//     const result = await pool.query(
//       `UPDATE eventos e
//         SET nmevento = $1
//         FROM eventoempresas ee
//         WHERE e.idevento = $2 AND ee.idevento = e.idevento AND ee.idempresa = $3
//         RETURNING e.idevento`, // ✅ Retorna idevento para o log
//       [nmEvento, id, idempresa]
//     );

//     if (result.rowCount) {
//       const eventoAtualizadoId = result.rows[0].idevento;

//       // --- Ponto Chave para o Log ---
//       res.locals.acao = 'atualizou';
//       res.locals.idregistroalterado = eventoAtualizadoId;
//       res.locals.idusuarioAlvo = null;

//       return res.json({ message: "Evento atualizado com sucesso!", eventos: result.rows[0] });
//     } else {
//         return res.status(404).json({ message: "Evento não encontrado ou você não tem permissão para atualizá-lo." });
//     }
//   } catch (error) {
//       console.error("Erro ao atualizar evento:", error);
//       res.status(500).json({ message: "Erro ao atualizar evento." });
//   }
// });

// // POST criar nova eventos
// router.post("/", verificarPermissao('Eventos', 'cadastrar'), 
//   logMiddleware('Eventos', {
//         buscarDadosAnteriores: async (req) => {
//             return { dadosanteriores: null, idregistroalterado: null };
//         }
//   }),
//   async (req, res) => {
//   const { nmEvento } = req.body;
//   const idempresa = req.idempresa; 

//   let client; 
//   console.log("nmEvento na rota", nmEvento);
//   try {
//     client = await pool.connect(); 
//     await client.query('BEGIN');
   
//     const resultEvento = await client.query(
//         "INSERT INTO eventos (nmevento) VALUES ($1) RETURNING idevento, nmevento", 
//         [nmEvento]
//     );

//     const novoEvento = resultEvento.rows[0];
//     const idevento = novoEvento.idevento;

//     await client.query(
//         "INSERT INTO eventoempresas (idevento, idempresa) VALUES ($1, $2)",
//         [idevento, idempresa]
//     );

//     await client.query('COMMIT'); // Confirma a transação

//     const novoEventoId = idevento; // ID do evento recém-criado
//     res.locals.acao = 'cadastrou';
//     res.locals.idregistroalterado = novoEventoId;
//     res.locals.idusuarioAlvo = null;

//     res.status(201).json({ mensagem: "Evento salvo com sucesso!", eventos: novoEvento }); // Status 201 para criação
//   } catch (error) {
//       if (client) { // Se a conexão foi estabelecida, faz o rollback
//           await client.query('ROLLBACK');
//       }
//       console.error("❌ Erro ao salvar evento e/ou associá-lo à empresa:", error);
//       res.status(500).json({ erro: "Erro ao salvar evento", detalhes: error.message });
//   } finally {
//       if (client) {
//           client.release(); // Libera a conexão do pool
//       }
//   }
    
// });


router.get("/", verificarPermissao('Eventos', 'pesquisar'), async (req, res) => {
    const { nmEvento } = req.query;
    const idempresa = req.idempresa;
    console.log("nmEvento NA ROTA", nmEvento, idempresa);
    
    try {
        if (nmEvento) {
            // ✅ Modificação aqui para incluir os IDs dos clientes
            const result = await pool.query(
                `SELECT 
                    e.*, 
                    COALESCE(array_agg(ec.idcliente) FILTER (WHERE ec.idcliente IS NOT NULL), '{}') AS clientes 
                 FROM eventos e
                 INNER JOIN eventoempresas ee ON ee.idevento = e.idevento
                 LEFT JOIN eventoclientes ec ON ec.idevento = e.idevento
                 WHERE ee.idempresa = $1 AND e.nmevento ILIKE $2
                 GROUP BY e.idevento
                 LIMIT 1`,
                [idempresa, nmEvento]
            );
            
            console.log("RESULTADO QUERY", result);
            return result.rows.length
                ? res.json(result.rows[0])
                : res.status(404).json({ message: "Evento não encontrado" });
        } else {
            // ✅ Modificação para a rota que lista todos os eventos
            const result = await pool.query(
                `SELECT 
                    e.*, 
                    COALESCE(array_agg(ec.idcliente) FILTER (WHERE ec.idcliente IS NOT NULL), '{}') AS clientes 
                 FROM eventos e
                 INNER JOIN eventoempresas ee ON ee.idevento = e.idevento
                 LEFT JOIN eventoclientes ec ON ec.idevento = e.idevento
                 WHERE ee.idempresa = $1
                 GROUP BY e.idevento
                 ORDER BY nmevento ASC`,
                [idempresa]
            );
            return result.rows.length
                ? res.json(result.rows)
                : res.status(404).json({ message: "Nenhum evento encontrado" });
        }
    } catch (error) {
        console.error("Erro ao buscar evento:", error);
        res.status(500).json({ message: "Erro ao buscar evento" });
    }
});

// POST criar novo evento
router.post("/", verificarPermissao('Eventos', 'cadastrar'), 
  logMiddleware('Eventos', {
    buscarDadosAnteriores: async (req) => {
      return { dadosanteriores: null, idregistroalterado: null };
    }
  }),
  async (req, res) => {
    const { nmEvento, clientesDoEvento } = req.body; // ✅ Agora recebemos também o array de clientes
    const idempresa = req.idempresa;

    let client; 
    console.log("nmEvento na rota", nmEvento);
    console.log("clientesDoEvento na rota", clientesDoEvento);

    // Validação básica para o array de clientes
    if (!clientesDoEvento || !Array.isArray(clientesDoEvento) || clientesDoEvento.length === 0) {
      return res.status(400).json({ erro: "É necessário selecionar pelo menos um cliente para o evento." });
    }

    try {
      client = await pool.connect();
      await client.query('BEGIN');

      // 1. Inserir o novo evento na tabela 'eventos'
      const resultEvento = await client.query(
        "INSERT INTO eventos (nmevento) VALUES ($1) RETURNING idevento, nmevento", 
        [nmEvento]
      );
      const novoEvento = resultEvento.rows[0];
      const idevento = novoEvento.idevento;

      // 2. Associar o evento à empresa
      await client.query(
        "INSERT INTO eventoempresas (idevento, idempresa) VALUES ($1, $2)",
        [idevento, idempresa]
      );

      // 3. ✅ Associar o evento a cada cliente na tabela 'eventoclientes'
      const queryAssociacaoClientes = "INSERT INTO eventoclientes (idevento, idcliente) VALUES ($1, $2)";
      for (const idCliente of clientesDoEvento) {
          await client.query(queryAssociacaoClientes, [idevento, idCliente]);
      }

      await client.query('COMMIT'); // Confirma a transação

      const novoEventoId = idevento;
      res.locals.acao = 'cadastrou';
      res.locals.idregistroalterado = novoEventoId;
      res.locals.idusuarioAlvo = null;
      res.locals.dadosnovos = { ...novoEvento, clientes: clientesDoEvento };

      res.status(201).json({ mensagem: "Evento e clientes associados com sucesso!", eventos: novoEvento });
    } catch (error) {
      if (client) {
        await client.query('ROLLBACK');
      }
      console.error("❌ Erro ao salvar evento e/ou associá-lo à empresa/clientes:", error);
      res.status(500).json({ erro: "Erro ao salvar evento", detalhes: error.message });
    } finally {
      if (client) {
        client.release();
      }
    }
  }
);

// PUT alterar evento
router.put("/:id", verificarPermissao('Eventos', 'alterar'), 
  logMiddleware('Eventos', {
      buscarDadosAnteriores: async (req) => {
          const idEvento = req.params.id;
          const idempresa = req.idempresa;

          if (!idEvento) {
              return { dadosanteriores: null, idregistroalterado: null };
          }

          try {
              // ✅ Buscar dados do evento e clientes associados para o log
              const result = await pool.query(
                  `SELECT e.*, array_agg(ec.idcliente) AS clientes FROM eventos e
                   INNER JOIN eventoempresas ee ON ee.idevento = e.idevento
                   LEFT JOIN eventoclientes ec ON ec.idevento = e.idevento
                   WHERE e.idevento = $1 AND ee.idempresa = $2
                   GROUP BY e.idevento`,
                  [idEvento, idempresa]
              );
              const linha = result.rows[0] || null;
              return {
                  dadosanteriores: linha,
                  idregistroalterado: linha?.idevento || null
              };
          } catch (error) {
              console.error("Erro ao buscar dados anteriores do evento:", error);
              return { dadosanteriores: null, idregistroalterado: null };
          }
      }
  }),
  async (req, res) => {
    const id = req.params.id;
    const idempresa = req.idempresa;
    const { nmEvento, clientesDoEvento } = req.body; // ✅ Recebemos o array de clientes
    
    let client;

    // Validação básica para o array de clientes
    if (!clientesDoEvento || !Array.isArray(clientesDoEvento) || clientesDoEvento.length === 0) {
      return res.status(400).json({ erro: "É necessário selecionar pelo menos um cliente para o evento." });
    }

    try {
      client = await pool.connect();
      await client.query('BEGIN');
      
      // 1. Atualizar o nome do evento na tabela 'eventos'
      const result = await client.query(
        `UPDATE eventos e
          SET nmevento = $1
          FROM eventoempresas ee
          WHERE e.idevento = $2 AND ee.idevento = e.idevento AND ee.idempresa = $3
          RETURNING e.idevento`,
        [nmEvento, id, idempresa]
      );
      
      if (result.rowCount) {
        const eventoAtualizadoId = result.rows[0].idevento;

        // 2. ✅ Excluir associações antigas na tabela 'eventoclientes'
        await client.query("DELETE FROM eventoclientes WHERE idevento = $1", [eventoAtualizadoId]);

        // 3. ✅ Inserir novas associações na tabela 'eventoclientes'
        const queryAssociacaoClientes = "INSERT INTO eventoclientes (idevento, idcliente) VALUES ($1, $2)";
        for (const idCliente of clientesDoEvento) {
            await client.query(queryAssociacaoClientes, [eventoAtualizadoId, idCliente]);
        }
        
        await client.query('COMMIT'); // Confirma a transação

        // --- Ponto Chave para o Log ---
        res.locals.acao = 'atualizou';
        res.locals.idregistroalterado = eventoAtualizadoId;
        res.locals.idusuarioAlvo = null;
        res.locals.dadosnovos = { idevento: eventoAtualizadoId, nmevento: nmEvento, clientes: clientesDoEvento };

        return res.json({ message: "Evento e associações de clientes atualizados com sucesso!", eventos: { idevento: eventoAtualizadoId, nmevento: nmEvento } });
      } else {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: "Evento não encontrado ou você não tem permissão para atualizá-lo." });
      }
    } catch (error) {
      if (client) {
        await client.query('ROLLBACK');
      }
      console.error("Erro ao atualizar evento e associações de clientes:", error);
      res.status(500).json({ message: "Erro ao atualizar evento." });
    } finally {
      if (client) {
        client.release();
      }
    }
});

module.exports = router;