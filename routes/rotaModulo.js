const express = require('express');
const router = express.Router();
const pool = require('../db'); // ajuste o caminho conforme seu projeto
const { autenticarToken, contextoEmpresa } = require('../middlewares/authMiddlewares');
const { verificarPermissao } = require('../middlewares/permissaoMiddleware');
const logMiddleware = require('../middlewares/logMiddleware');

// Aplica autenticação em todas as rotas

router.use(autenticarToken());
router.use(contextoEmpresa);

router.get('/', verificarPermissao('Modulos', 'pesquisar'), async (req, res) => {
   console.log("✅ ROTA MODULOS /modulos ACESSADA");
   const { nmModulo } = req.query;
   const idempresa = req.idempresa;
  try {
    
      if (nmModulo) {
        const result = await pool.query(
          `SELECT m.modulo 
          FROM modulos m
          INNER JOIN moduloempresas me ON m.idmodulo = me.idmodulo
          WHERE me.idempresa = $1 AND m.modulo ILIKE $2 LIMIT 1`,
          [idempresa, `%${nmModulo}%`]
      );
      return result.rows.length
        ? res.json(result.rows[0])
        : res.status(404).json({ message: "Equipamento não encontrada" });
    } else {
      const result = await pool.query(`SELECT m.modulo 
        FROM modulos m
        INNER JOIN moduloempresas me ON m.idmodulo = me.idmodulo
        WHERE me.idempresa = $1
        ORDER BY modulo`, [idempresa]);

      return result.rows.length
        ? res.json(result.rows)
        : res.status(404).json({ message: "Nenhuma Módulo encontrado" });
    }
   
  } catch (err) {
    console.error('Erro ao buscar módulos:', err);
    res.status(500).json({ erro: 'Erro ao buscar módulos' });
  }
});

router.put("/:id", 
  verificarPermissao('Modulos', 'alterar'),
  logMiddleware('Modulos', { // ✅ Módulo 'Modulos' para o log
      buscarDadosAnteriores: async (req) => {
          const idModulo = req.params.id; // O ID do módulo vem do parâmetro da URL
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

  try {
      const result = await pool.query(
        `UPDATE modulos m
          SET descModulo = $1
          FROM moduloempresas me
          WHERE m.idmodulo = $2 AND me.idmodulo = m.idmodulo AND me.idempresa = $3
          RETURNING m.idmodulo`, 
        [nmModulo, id, idempresa]
      );

      if (result.rowCount) {
        const equipamentoAtualizadoId = result.rows[0].idequip; 
        
        res.locals.acao = 'atualizou';
        res.locals.idregistroalterado = equipamentoAtualizadoId; 
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
  const { nmModulo } = req.body;
  const idempresa = req.idempresa;

  let client; // Variável para a conexão de transação

  console.log("Dados recebidos:", req.body);
  try {
      client = await pool.connect(); // Inicia a transação
      await client.query('BEGIN');

      // 1. Insere o novo equipamento na tabela 'equipamentos'
      const resultModulo = await client.query(
          "INSERT INTO modulos (descModulo) VALUES ($1) RETURNING idmodulo, descModulo",
          [nmModulo]
      );

      const novoModulo = resultModulo.rows[0];
      const idmodulo = novoModulo.idmodulo;

      // 2. Insere a associação na tabela 'moduloempresas'
      await client.query(
          "INSERT INTO moduloempresas (idmodulo, idempresa) VALUES ($1, $2)",
          [idmodulo, idempresa]
      );

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
