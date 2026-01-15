const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB");
const { autenticarToken, contextoEmpresa } = require('../middlewares/authMiddlewares');
const { verificarPermissao } = require('../middlewares/permissaoMiddleware');
const logMiddleware = require('../middlewares/logMiddleware');

router.use(autenticarToken());
router.use(contextoEmpresa);

// GET todas ou por nome
router.get("/", verificarPermissao('tipoconta', 'pesquisar'), async (req, res) => {
  const { nmTipoConta } = req.query;
  const idempresa = req.idempresa;

  try {
    if (nmTipoConta) {
      const result = await pool.query(
        // CORREÇÃO: Usando 'nmtipoconta' para bater com o banco de dados
        `SELECT * FROM tipoconta WHERE idempresa = $1 AND nmtipoconta ILIKE $2 LIMIT 1`,
        [idempresa, nmTipoConta]
      );
      
      if (result.rows.length > 0) {
          return res.json(result.rows[0]);
      } else {
          // 404 é o correto aqui para o JS abrir o modal de cadastro
          return res.status(404).json({ message: "Tipo Conta não encontrada" });
      }
    } else {
      const result = await pool.query(
        // CORREÇÃO: Order by nmtipoconta (nome da coluna correto)
        `SELECT * FROM tipoconta WHERE idempresa = $1 ORDER BY nmtipoconta ASC`,
        [idempresa]
      );
      return res.json(result.rows);
    }
  } catch (error) {
    console.error("Erro ao buscar conta:", error);
    res.status(500).json({ message: "Erro ao buscar conta no banco de dados" });
  }
});

// PUT atualizar
router.put("/:id", 
  verificarPermissao('tipoconta', 'alterar'),
  logMiddleware('TipoConta', {
      buscarDadosAnteriores: async (req) => {
          const idTipoConta = req.params.id;
          const idempresa = req.idempresa;
          try {
              const result = await pool.query(
                  `SELECT * FROM tipoconta WHERE idtipoconta = $1 AND idempresa = $2`,
                  [idTipoConta, idempresa]
              );
              const linha = result.rows[0] || null;
              return {
                  dadosanteriores: linha,
                  idregistroalterado: linha?.idtipoconta || null
              };
          } catch (error) {
              console.error("Erro ao buscar dados anteriores:", error);
              return { dadosanteriores: null, idregistroalterado: null };
          }
      }
  }),
  async (req, res) => {
    const id = req.params.id;
    const idempresa = req.idempresa;
    const { ativo, nmTipoConta } = req.body; 

    try {
        const result = await pool.query(
          `UPDATE tipoconta 
           SET nmtipoconta = $1, ativo = $2
           WHERE idtipoconta = $3 AND idempresa = $4 
           RETURNING idtipoconta, nmtipoconta, ativo`, 
          [nmTipoConta, ativo, id, idempresa]
        );

        if (result.rowCount) {
          res.locals.acao = 'atualizou';
          res.locals.idregistroalterado = result.rows[0].idtipoconta; 
          return res.json({ message: "Tipo de Conta atualizada com sucesso!", conta: result.rows[0] });
        } else {
          return res.status(404).json({ message: "Tipo de Conta não encontrada para atualizar." });
        }
    } catch (error) {
        console.error("Erro ao atualizar tipo de conta:", error);
        res.status(500).json({ message: "Erro ao atualizar tipo de conta no banco." });
    }
});

// POST criar nova conta
router.post("/", verificarPermissao('tipoconta', 'cadastrar'), 
  logMiddleware('TipoConta', { 
      buscarDadosAnteriores: async (req) => {
        return { dadosanteriores: null, idregistroalterado: null };
      }
  }),
  async (req, res) => {
    const { ativo, nmTipoConta } = req.body;
    const idempresa = req.idempresa;

    try {
        // CORREÇÃO: Garantindo que o INSERT use as colunas corretas e tenha 3 parâmetros ($1, $2, $3)
        const result = await pool.query(
            "INSERT INTO tipoconta (nmtipoconta, ativo, idempresa) VALUES ($1, $2, $3) RETURNING idtipoconta, nmtipoconta", 
            [nmTipoConta, ativo, idempresa]
        );

        const novaConta = result.rows[0];
        res.locals.acao = 'cadastrou';
        res.locals.idregistroalterado = novaConta.idtipoconta; 

        // PADRONIZAÇÃO: Use 'message' em vez de 'mensagem' para bater com o seu TipoConta.js
        res.status(201).json({ message: "Tipo de Conta salva com sucesso!", conta: novaConta });
    } catch (error) {
        console.error("Erro ao salvar tipo de conta:", error);
        res.status(500).json({ message: "Erro ao salvar tipo de conta.", detail: error.message });
    }
});

module.exports = router;