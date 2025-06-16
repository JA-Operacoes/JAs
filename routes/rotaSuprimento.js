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
router.get("/", verificarPermissao('Suprimentos', 'pesquisar'), async (req, res) => {
  const { descSup } = req.query;
  const idempresa = req.idempresa;
  try {
    if (descSup) {
      const result = await pool.query(
        `SELECT s.* FROM suprimentos s
          INNER JOIN suprimentoempresas se ON se.idsup = s.idsup
          WHERE se.idempresa = $1 AND s.descSup ILIKE $2 LIMIT 1`,
        [idempresa, `%${descSup}%`]
      );
      return result.rows.length
        ? res.json(result.rows[0])
        : res.status(404).json({ message: "Suprimento não encontrada" });
    } else {
      const result = await pool.query(`SELECT s.* FROM suprimentos s
                 INNER JOIN suprimentoempresas se ON se.idsup = s.idsup
                 WHERE se.idempresa = $1 ORDER BY descSup ASC`,
                [idempresa]);
      return result.rows.length
        ? res.json(result.rows)
        : res.status(404).json({ message: "Nenhuma suprimento encontrado" });
    }
  } catch (error) {
    console.error("Erro ao buscar suprimentos:", error);
    res.status(500).json({ message: "Erro ao buscar suprimentos" });
  }
});

// PUT atualizar
router.put("/:id", verificarPermissao('Suprimentos', 'alterar'), 
  logMiddleware('Suprimentos', {
    buscarDadosAnteriores: async (req) => {
        const idSup = req.params.id; 
        const idempresa = req.idempresa; 

        if (!idSup) {
            return { dadosanteriores: null, idregistroalterado: null };
        }
        
        try {
           
            const result = await pool.query(
                `SELECT s.* FROM suprimentos s
                  INNER JOIN suprimentoempresas se ON se.idsup = s.idsup
                  WHERE s.idSup = $1 AND se.idempresa = $2`, 
                [idSup, idempresa]
            );
            const linha = result.rows[0] || null;
            return {
                dadosanteriores: linha, 
                idregistroalterado: linha?.idsup || null 
            };
        } catch (error) {
            console.error("Erro ao buscar dados anteriores do suprimento:", error);
            return { dadosanteriores: null, idregistroalterado: null };
        }
    }
  }),
  async (req, res) => {
  const id = req.params.id;
  const idempresa = req.idempresa;
  const { descSup, custo, venda } = req.body;

  try {
    const result = await pool.query(
      `UPDATE suprimentos s
        SET descSup = $1, ctoSup = $2, vdaSup = $3
        FROM suprimentoempresas se
        WHERE s.idSup = $4 AND se.idsup = s.idSup AND se.idempresa = $5
        RETURNING s.idSup`, 
      [descSup, custo, venda, id, idempresa]
    );

    if (result.rowCount) {
        const suprimentoAtualizadoId = result.rows[0].idsup;         
      
        res.locals.acao = 'atualizou';
        res.locals.idregistroalterado = suprimentoAtualizadoId; 
        res.locals.idusuarioAlvo = null; 

        return res.json({ message: "Suprimento atualizado com sucesso!", suprimento: result.rows[0] });
    } else {
        return res.status(404).json({ message: "Suprimento não encontrado ou você não tem permissão para atualizá-lo." });
    }
  } catch (error) {
      console.error("Erro ao atualizar suprimento:", error);
      res.status(500).json({ message: "Erro ao atualizar suprimento." });
  }
});

// POST criar nova função
router.post("/", verificarPermissao('Suprimentos', 'cadastrar'), 
  logMiddleware('Suprimentos', { 
    buscarDadosAnteriores: async (req) => {
        return { dadosanteriores: null, idregistroalterado: null };
    }
  }),
  async (req, res) => {
  const { descSup, custo, venda } = req.body;
  const idempresa = req.idempresa;

  let client; // Variável para a conexão de transação

  try {
      client = await pool.connect(); // Inicia a transação
      await client.query('BEGIN');

      const resultSuprimento = await client.query(
          "INSERT INTO suprimentos (descSup, ctoSup, vdaSup) VALUES ($1, $2, $3) RETURNING idSup, descSup", // ✅ Retorna idSup
          [descSup, custo, venda]
      );

      const novoSuprimento = resultSuprimento.rows[0];
      const idSup = novoSuprimento.idsup;

      await client.query(
          "INSERT INTO suprimentoempresas (idsup, idempresa) VALUES ($1, $2)",
          [idSup, idempresa]
      );

      await client.query('COMMIT'); 
      
      const novoSuprimentoId = idSup; 
      res.locals.acao = 'cadastrou';
      res.locals.idregistroalterado = novoSuprimentoId; 
      res.locals.idusuarioAlvo = null;

      res.status(201).json({ mensagem: "Suprimento salvo com sucesso!", suprimento: novoSuprimento }); // Status 201 para criação
  } catch (error) {
      if (client) { 
          await client.query('ROLLBACK');
      }
      console.error("Erro ao salvar suprimento e/ou associá-lo à empresa:", error);
      res.status(500).json({ erro: "Erro ao salvar suprimento.", detail: error.message });
  } finally {
      if (client) {
          client.release(); 
      }
  }
    
});

module.exports = router;