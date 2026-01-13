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

// ... (mantenha o início do arquivo igual)

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
    // ADICIONADO: tpConta extraído do corpo da requisição
    const { nmConta, ativo, tpConta } = req.body; 

    try {
        // ATUALIZADO: Query agora inclui tpconta
        const result = await pool.query(
          `UPDATE contas 
           SET nmconta = $1, ativo = $2, tpconta = $3 
           WHERE idconta = $4 AND idempresa = $5 
           RETURNING idconta, nmconta, ativo, tpconta`, 
          [nmConta, ativo, tpConta, id, idempresa]
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
    // ADICIONADO: tpConta extraído do corpo da requisição
    const { nmConta, ativo, tpConta } = req.body;
    const idempresa = req.idempresa;

    try {
        // ATUALIZADO: Query agora inclui tpconta no INSERT
        const result = await pool.query(
            "INSERT INTO contas (nmconta, ativo, idempresa, tpconta) VALUES ($1, $2, $3, $4) RETURNING idconta, nmconta", 
            [nmConta, ativo, idempresa, tpConta]
        );

        const novaConta = result.rows[0];
        res.locals.acao = 'cadastrou';
        res.locals.idregistroalterado = novaConta.idconta; 

        res.status(201).json({ mensagem: "Conta salva com sucesso!", conta: novaConta });
    } catch (error) {
        console.error("Erro ao salvar conta:", error);
        res.status(500).json({ erro: "Erro ao salvar conta.", detail: error.message });
    }
});

module.exports = router;