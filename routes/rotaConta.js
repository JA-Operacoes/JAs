const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB");
const { autenticarToken, contextoEmpresa } = require('../middlewares/authMiddlewares');
const { verificarPermissao } = require('../middlewares/permissaoMiddleware');
const logMiddleware = require('../middlewares/logMiddleware');

// Aplica autenticação em todas as rotas
router.use(autenticarToken());
router.use(contextoEmpresa);

// GET todas ou por nome
router.get("/", verificarPermissao('Contas', 'pesquisar'), async (req, res) => {
  const { nmConta } = req.query;
  const idempresa = req.idempresa;

  try {
    if (nmConta) {
      // Retorna idtipoconta agora
      const result = await pool.query(
        `SELECT * FROM contas WHERE idempresa = $1 AND nmconta ILIKE $2 LIMIT 1`,
        [idempresa, nmConta]
      );
      return result.rows.length
        ? res.json(result.rows[0])
        : res.status(404).json({ message: "Conta não encontrada" });
    } else {
      const result = await pool.query(
        `SELECT * FROM contas WHERE idempresa = $1 ORDER BY nmconta ASC`,
        [idempresa]
      );
      return result.rows.length
        ? res.json(result.rows)
        : res.status(404).json({ message: "Nenhuma conta encontrada" });
    }
  } catch (error) {
    console.error("Erro ao buscar conta:", error);
    res.status(500).json({ message: "Erro ao buscar conta" });
  }
});

// PUT atualizar
router.put("/:id", 
  verificarPermissao('Contas', 'alterar'),
  logMiddleware('Contas', {
      buscarDadosAnteriores: async (req) => {
          const idConta = req.params.id;
          const idempresa = req.idempresa;
          try {
              const result = await pool.query(
                  `SELECT * FROM contas WHERE idconta = $1 AND idempresa = $2`,
                  [idConta, idempresa]
              );
              const linha = result.rows[0] || null;
              return {
                  dadosanteriores: linha,
                  idregistroalterado: linha?.idconta || null
              };
          } catch (error) {
              console.error("Erro ao buscar dados anteriores da conta:", error);
              return { dadosanteriores: null, idregistroalterado: null };
          }
      }
  }),
  async (req, res) => {
    const id = req.params.id;
    const idempresa = req.idempresa;
    
    // ALTERADO: agora recebe idtipoconta do body (enviado pelo JS como dados)
    const { nmConta, idtipoconta } = req.body; 
    const ativo = req.body.ativo === true || req.body.ativo === 'true';
    
    try {
        // ATUALIZADO: Query usando a nova coluna idtipoconta
        const result = await pool.query(
          `UPDATE contas 
           SET nmconta = $1, ativo = $2, idtipoconta = $3 
           WHERE idconta = $4 AND idempresa = $5 
           RETURNING idconta, nmconta, ativo, idtipoconta`, 
          [nmConta, ativo, idtipoconta, id, idempresa]
        );

        if (result.rowCount) {
          res.locals.acao = 'atualizou';
          res.locals.idregistroalterado = result.rows[0].idconta; 
          return res.json({ message: "Conta atualizada com sucesso!", conta: result.rows[0] });
        } else {
          return res.status(404).json({ message: "Conta não encontrada para atualizar." });
        }
    } catch (error) {
        console.error("Erro ao atualizar conta:", error);
        res.status(500).json({ message: "Erro ao atualizar conta." });
    }
});

// POST criar nova conta
router.post("/", verificarPermissao('Contas', 'cadastrar'), 
  logMiddleware('Contas', { 
      buscarDadosAnteriores: async (req) => {
        return { dadosanteriores: null, idregistroalterado: null };
      }
  }),
  async (req, res) => {
    // ALTERADO: agora recebe idtipoconta
    const { nmConta, ativo, idtipoconta } = req.body;
    const idempresa = req.idempresa;

    try {
        // ATUALIZADO: Query usando idtipoconta no INSERT
        const result = await pool.query(
            "INSERT INTO contas (nmconta, ativo, idempresa, idtipoconta) VALUES ($1, $2, $3, $4) RETURNING idconta, nmconta, idtipoconta", 
            [nmConta, ativo, idempresa, idtipoconta]
        );

        const novaConta = result.rows[0];
        res.locals.acao = 'cadastrou';
        res.locals.idregistroalterado = novaConta.idconta; 

        // Padronizado para 'message' para facilitar no Frontend
        res.status(201).json({ message: "Conta salva com sucesso!", conta: novaConta });
    } catch (error) {
        console.error("Erro ao salvar conta:", error);
        res.status(500).json({ message: "Erro ao salvar conta.", detail: error.message });
    }
});

module.exports = router;