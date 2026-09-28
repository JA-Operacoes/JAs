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
router.get("/", verificarPermissao('Equipe', 'pesquisar'), async (req, res) => {
  console.log("Rota de equipe acessada - GET", req.query);
  const idempresa = req.idempresa;
  const { descEquipe } = req.query;

  try {
    if (descEquipe) {
      const result = await pool.query(
        `SELECT e.*
         FROM equipe e
         INNER JOIN equipeempresas ee ON e.idequipe = ee.idequipe
         WHERE ee.idempresa = $1 AND e.nmequipe ILIKE $2 LIMIT 1`,
        [idempresa, descEquipe]
      );
      return result.rows.length
        ? res.json(result.rows[0])
        : res.status(404).json({ message: "Equipe não encontrada" });
    } else {
      const result = await pool.query(
        `SELECT e.*
         FROM equipe e
         INNER JOIN equipeempresas ee ON e.idequipe = ee.idequipe
         WHERE ee.idempresa = $1
         ORDER BY e.nmequipe ASC`,
        [idempresa]
      );
      return result.rows.length
        ? res.json(result.rows)
        : res.status(404).json({ message: "Nenhuma equipe encontrada" });
    }
  } catch (error) {
    console.error("Erro ao buscar equipe:", error);
    res.status(500).json({ message: "Erro ao buscar equipe" });
  }
});

// PUT atualizar
router.put("/:id", autenticarToken({ verificarEmpresa: false }), verificarPermissao('Equipe', 'alterar'),
  logMiddleware('Equipe', {
    buscarDadosAnteriores: async (req) => {
      const idequipe = req.params.id;
      const idempresa = req.idempresa;

      if (!idequipe) {
        return { dadosanteriores: null, idregistroalterado: null };
      }

      try {
        const result = await pool.query(
          `SELECT e.* FROM equipe e
             INNER JOIN equipeempresas ee ON ee.idequipe = e.idequipe
             WHERE e.idequipe = $1 AND ee.idempresa = $2`,
          [idequipe, idempresa]
        );
        const linha = result.rows[0] || null;
        return {
          dadosanteriores: linha,
          idregistroalterado: linha?.idequipe || null
        };
      } catch (error) {
        console.error("Erro ao buscar dados anteriores da equipe:", error);
        return { dadosanteriores: null, idregistroalterado: null };
      }
    }
  }),
  async (req, res) => {
    console.log("Rota de equipe acessada - PUT", req.params);
    const id = req.params.id;
    const idempresa = req.idempresa;
    const descEquipe = (req.body?.descEquipe || "").trim();

    if (!descEquipe) {
      return res.status(400).json({ message: "Informe o nome da equipe." });
    }

    try {
      // nmequipe é UNIQUE global: barra antes de tentar o UPDATE pra devolver uma
      // mensagem clara em vez do erro cru da constraint.
      const duplicada = await pool.query(
        `SELECT 1 FROM equipe WHERE nmequipe ILIKE $1 AND idequipe <> $2 LIMIT 1`,
        [descEquipe, id]
      );
      if (duplicada.rowCount) {
        return res.status(409).json({ message: "Já existe uma equipe com esse nome." });
      }

      const result = await pool.query(
        `UPDATE equipe e
         SET nmequipe = $1
         FROM equipeempresas ee
         WHERE e.idequipe = $2 AND ee.idequipe = e.idequipe AND ee.idempresa = $3
         RETURNING e.idequipe, e.nmequipe`,
        [descEquipe, id, idempresa]
      );

      if (result.rowCount) {
        res.locals.acao = 'atualizou';
        res.locals.idregistroalterado = result.rows[0].idequipe;
        res.locals.idusuarioAlvo = null;
        res.locals.dadosnovos = req.body;

        return res.json({ message: "Equipe atualizada com sucesso!", equipe: result.rows[0] });
      } else {
        return res.status(404).json({ message: "Equipe não encontrada ou você não tem permissão para atualizá-la." });
      }
    } catch (error) {
      console.error("Erro ao atualizar equipe:", error);
      res.status(500).json({ message: "Erro ao atualizar equipe." });
    }
  });

// POST criar nova equipe
router.post("/", autenticarToken({ verificarEmpresa: false }), verificarPermissao('Equipe', 'cadastrar'),
  logMiddleware('Equipe', {
    buscarDadosAnteriores: async () => {
      return { dadosanteriores: null, idregistroalterado: null };
    }
  }),
  async (req, res) => {
    console.log("Rota de equipe acessada - POST", req.body);
    const idempresa = req.idempresa;
    const descEquipe = (req.body?.descEquipe || "").trim();

    if (!descEquipe) {
      return res.status(400).json({ erro: "Informe o nome da equipe." });
    }

    let client;
    try {
      client = await pool.connect();
      await client.query('BEGIN');

      // nmequipe é UNIQUE no banco inteiro, não por empresa: se a equipe já existe
      // (cadastrada por outra empresa), reaproveitamos o registro e só criamos o
      // vínculo em equipeempresas — duplicar o nome esbarraria na constraint.
      const existente = await client.query(
        `SELECT idequipe, nmequipe FROM equipe WHERE nmequipe ILIKE $1 LIMIT 1`,
        [descEquipe]
      );

      let equipe;
      if (existente.rowCount) {
        equipe = existente.rows[0];

        const vinculo = await client.query(
          `SELECT 1 FROM equipeempresas WHERE idequipe = $1 AND idempresa = $2`,
          [equipe.idequipe, idempresa]
        );

        if (vinculo.rowCount) {
          await client.query('ROLLBACK');
          return res.status(409).json({ erro: "Esta equipe já está cadastrada para esta empresa." });
        }
      } else {
        const resultEquipe = await client.query(
          `INSERT INTO equipe (nmequipe) VALUES ($1) RETURNING idequipe, nmequipe`,
          [descEquipe]
        );
        equipe = resultEquipe.rows[0];
      }

      await client.query(
        `INSERT INTO equipeempresas (idequipe, idempresa) VALUES ($1, $2)`,
        [equipe.idequipe, idempresa]
      );

      await client.query('COMMIT');

      res.locals.acao = 'cadastrou';
      res.locals.idregistroalterado = equipe.idequipe;
      res.locals.idusuarioAlvo = null;
      res.locals.dadosnovos = req.body;

      res.status(201).json({ mensagem: "Equipe salva com sucesso!", equipe });
    } catch (error) {
      if (client) {
        await client.query('ROLLBACK');
      }
      console.error("Erro ao salvar equipe e/ou associá-la à empresa:", error);
      res.status(500).json({ erro: "Erro ao salvar equipe." });
    } finally {
      if (client) {
        client.release();
      }
    }
  });

module.exports = router;
