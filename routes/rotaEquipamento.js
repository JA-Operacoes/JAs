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
router.get("/", verificarPermissao('Equipamentos', 'pesquisar'), async (req, res) => {
  const { descEquip } = req.query;
  const idempresa = req.idempresa;

  try {
    if (descEquip) {
      const result = await pool.query(
        `SELECT e.* FROM equipamentos e
          INNER JOIN equipamentoempresas ee ON ee.idequip = e.idequip
          WHERE ee.idempresa = $1 AND e.descEquip ILIKE $2 LIMIT 1`,
        [idempresa, `%${descEquip}%`]
      );
      return result.rows.length
        ? res.json(result.rows[0])
        : res.status(404).json({ message: "Equipamento não encontrada" });
    } else {
      const result = await pool.query(`SELECT e.* FROM equipamentos e
                 INNER JOIN equipamentoempresas ee ON ee.idequip = e.idequip
                 WHERE ee.idempresa = $1 ORDER BY descEquip ASC`,
                [idempresa]);
      return result.rows.length
        ? res.json(result.rows)
        : res.status(404).json({ message: "Nenhuma equipamento encontrada" });
    }
  } catch (error) {
    console.error("Erro ao buscar equipamento:", error);
    res.status(500).json({ message: "Erro ao buscar equipamento" });
  }
});

// PUT atualizar
router.put("/:id", 
  verificarPermissao('Equipamentos', 'alterar'),
  logMiddleware('Equipamentos', { // ✅ Módulo 'Equipamentos' para o log
      buscarDadosAnteriores: async (req) => {
          const idEquipamento = req.params.id; // O ID do equipamento vem do parâmetro da URL
          const idempresa = req.idempresa;

          if (!idEquipamento) {
              return { dadosanteriores: null, idregistroalterado: null };
          }
          
          try {
              // Seleciona todos os campos importantes do equipamento ANTES da atualização
              const result = await pool.query(
                  `SELECT e.* FROM equipamentos e
                     INNER JOIN equipamentoempresas ee ON ee.idequip = e.idequip
                     WHERE e.idequip = $1 AND ee.idempresa = $2`,
                    [idEquipamento, idempresa]
              );
              const linha = result.rows[0] || null;
              return {
                  dadosanteriores: linha, // O objeto equipamento antes da alteração
                  idregistroalterado: linha?.idequip || null // O ID do equipamento que está sendo alterado
              };
          } catch (error) {
              console.error("Erro ao buscar dados anteriores do equipamento:", error);
              return { dadosanteriores: null, idregistroalterado: null };
          }
      }
  }),
  async (req, res) => {
  const id = req.params.id;
  const idempresa = req.idempresa;
  const { descEquip, custo, venda } = req.body;

  try {
      const result = await pool.query(
        `UPDATE equipamentos e
          SET descEquip = $1, ctoEquip = $2, vdaEquip = $3
          FROM equipamentoempresas ee
          WHERE e.idequip = $4 AND ee.idequip = e.idequip AND ee.idempresa = $5
          RETURNING e.idequip`, 
        [descEquip, custo, venda, id, idempresa]
      );

      if (result.rowCount) {
        const equipamentoAtualizadoId = result.rows[0].idequip; 
        
        res.locals.acao = 'atualizou';
        res.locals.idregistroalterado = equipamentoAtualizadoId; 
        res.locals.idusuarioAlvo = null; 

        return res.json({ message: "Equipamento atualizado com sucesso!", equipamentos: result.rows[0] });
      } else {
          return res.status(404).json({ message: "Equipamento não encontrado para atualizar." });
      }
    } catch (error) {
            console.error("Erro ao atualizar equipamento:", error);
            res.status(500).json({ message: "Erro ao atualizar equipamentos." });
    }
});

// POST criar nova equipamentos
router.post("/", verificarPermissao('Equipamentos', 'cadastrar'), 
  logMiddleware('Equipamentos', { 
      buscarDadosAnteriores: async (req) => {
        return { dadosanteriores: null, idregistroalterado: null };
      }
  }),
  async (req, res) => {
  const { descEquip, custo, venda } = req.body;
  const idempresa = req.idempresa;

  let client; // Variável para a conexão de transação

  console.log("Dados recebidos:", req.body);
  try {
      client = await pool.connect(); // Inicia a transação
      await client.query('BEGIN');

      // 1. Insere o novo equipamento na tabela 'equipamentos'
      const resultEquipamento = await client.query(
          "INSERT INTO equipamentos (descEquip, ctoEquip, vdaEquip) VALUES ($1, $2, $3) RETURNING idequip, descEquip", // ✅ Retorna idequip
          [descEquip, custo, venda]
      );

      const novoEquipamento = resultEquipamento.rows[0];
      const idequip = novoEquipamento.idequip;

      // 2. Insere a associação na tabela 'equipamentoempresas'
      await client.query(
          "INSERT INTO equipamentoempresas (idequip, idempresa) VALUES ($1, $2)",
          [idequip, idempresa]
      );

      await client.query('COMMIT'); // Confirma a transação
      
      const novoEquipamentoId = idequip; // ID do equipamento recém-criado
      res.locals.acao = 'cadastrou';
      res.locals.idregistroalterado = novoEquipamentoId; 
      res.locals.idusuarioAlvo = null;

      res.status(201).json({ mensagem: "Equipamento salvo com sucesso!", equipamentos: novoEquipamento }); // Status 201 para criação
  } catch (error) {
      if (client) { // Se a conexão foi estabelecida, faz o rollback
          await client.query('ROLLBACK');
      }
      console.error("Erro ao salvar equipamento e/ou associá-lo à empresa:", error);
      res.status(500).json({ erro: "Erro ao salvar equipamentos.", detail: error.message });
  } finally {
      if (client) {
          client.release(); // Libera a conexão do pool
      }
  }    

});

module.exports = router;