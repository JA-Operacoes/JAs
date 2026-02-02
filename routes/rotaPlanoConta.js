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
router.get("/", verificarPermissao('Planocontas', 'pesquisar'), async (req, res) => {
  const { codigo, nmPlanoConta } = req.query;
  const idempresa = req.idempresa;

  console.log('Query Params recebidos:', req.query);

  try {
    if (nmPlanoConta) {
      // Retorna idtipoconta agora
      const result = await pool.query(
        `SELECT * FROM planocontas WHERE idempresa = $1 AND nmplanocontas ILIKE $2 LIMIT 1`,
        [idempresa, nmPlanoConta]
      );
      return result.rows.length
        ? res.json(result.rows[0])
        : res.status(404).json({ message: "Plano de Contas não encontrado" });
    } else if (codigo) {
      const result = await pool.query(
        `SELECT * FROM planocontas WHERE idempresa = $1 AND codigo ILIKE $2 LIMIT 1`,
        [idempresa, codigo]
      );
      return result.rows.length
        ? res.json(result.rows[0])
        : res.status(404).json({ message: "Plano de Contas não encontrado" });
    } else {
      const result = await pool.query(
        `SELECT * FROM planocontas WHERE idempresa = $1 ORDER BY nmplanocontas ASC`,
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



router.put("/:id", 
  verificarPermissao('planocontas', 'alterar'),
  logMiddleware('PlanoContas', {
      buscarDadosAnteriores: async (req) => {
          const idPlanoConta = req.params.id;
          const idempresaContexto = req.idempresa; // Empresa logada (contexto)

          
          try {
              const result = await pool.query(
                  `SELECT * FROM planocontas WHERE idplanocontas = $1 AND idempresa = $2`,
                  [idPlanoConta, idempresaContexto]
              );
              const linha = result.rows[0] || null;
              return {
                  dadosanteriores: linha,
                  idregistroalterado: linha?.idplanocontas || null
              };
          } catch (error) {
              console.error("Erro ao buscar dados anteriores da conta:", error);
              return { dadosanteriores: null, idregistroalterado: null };
          }
      }
  }),
  async (req, res) => {
    const id = req.params.id;
    const idempresaContexto = req.idempresa;
    
    // INCLUÍDO: idempresapagadora vindo do body
    let { codigo, nmPlanoConta } = req.body; 
    const ativo = req.body.ativo === true || req.body.ativo === 'true';

    if (codigo && typeof codigo === 'string') {
            codigo = codigo.replace(',', '.');
          }
    
    try {
        // ATUALIZADO: Query incluindo idempresapagadora
        const result = await pool.query(
          `UPDATE planocontas 
           SET codigo = $1, nmplanocontas = $2, ativo = $3
           WHERE idplanocontas = $4 AND idempresa = $5 
           RETURNING idplanocontas, codigo, nmplanocontas, ativo`, 
          [codigo, nmPlanoConta, ativo, id, idempresaContexto]
        );

        if (result.rowCount) {
          res.locals.acao = 'atualizou';
          res.locals.idregistroalterado = result.rows[0].idplanocontas; 
          return res.json({ message: "Plano de Contas atualizado com sucesso!", conta: result.rows[0] });
        } else {
          return res.status(404).json({ message: "Plano de Contas não encontrado para atualizar." });
        }
    } catch (error) {
        console.error("Erro ao atualizar plano de contas:", error);
        res.status(500).json({ message: "Erro ao atualizar plano de contas." });
    }
});

// POST criar nova conta
router.post("/", verificarPermissao('Planocontas', 'cadastrar'), 
  logMiddleware('PlanoContas', { 
      buscarDadosAnteriores: async (req) => {
        return { dadosanteriores: null, idregistroalterado: null };
      }
  }),
  async (req, res) => {
    // INCLUÍDO: idempresapagadora vindo do body
    let { codigo, nmPlanoConta, ativo } = req.body;
    const idempresaContexto = req.idempresa; // Empresa que está realizando o cadastro

    if (codigo && typeof codigo === 'string') {
        // O /g garante que TODAS as vírgulas sejam trocadas por pontos
        codigo = codigo.replace(/,/g, '.'); 
    }

    try {
        // ATUALIZADO: Query usando idempresapagadora no INSERT
        const result = await pool.query(
            `INSERT INTO planocontas (codigo, nmplanocontas, ativo, idempresa) 
             VALUES ($1, $2, $3, $4) 
             RETURNING idplanocontas, codigo, nmplanocontas, ativo`,
            [codigo, nmPlanoConta, ativo, idempresaContexto]
        );

        const novaConta = result.rows[0];
        res.locals.acao = 'cadastrou';
        res.locals.idregistroalterado = novaConta.idplanocontas; 

        res.status(201).json({ message: "Plano de Contas salvo com sucesso!", conta: novaConta });
    } catch (error) {
        console.error("Erro ao salvar plano de contas:", error);
        res.status(500).json({ message: "Erro ao salvar plano de contas.", detail: error.message });
    }
});

module.exports = router;