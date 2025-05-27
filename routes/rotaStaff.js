const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB");
const { autenticarToken } = require('../middlewares/authMiddlewares');
const { verificarPermissao } = require('../middlewares/permissaoMiddleware');

// Aplica autenticação em todas as rotas
router.use(autenticarToken);

// GET todas ou por descrição
router.get("/", autenticarToken, verificarPermissao('Staff', 'pesquisar'), async (req, res) => {
  const { descFuncao } = req.query;
  console.log("descFuncao na ROTAFUNCAO", descFuncao);
  try {
    if (descFuncao) {
      const result = await pool.query(
        "SELECT * FROM staff WHERE descFuncao ILIKE $1 LIMIT 1",
        [descFuncao]
      );
      return result.rows.length
        ? res.json(result.rows[0])
        : res.status(404).json({ message: "Staff não encontrada" });
    } else {
      const result = await pool.query("SELECT * FROM staff ORDER BY descFuncao ASC");
      return result.rows.length
        ? res.json(result.rows)
        : res.status(404).json({ message: "Nenhum staff encontrada" });
    }
  } catch (error) {
    console.error("Erro ao buscar função:", error);
    res.status(500).json({ message: "Erro ao buscar Staff" });
  }
});

// PUT atualizar
router.put("/:id", autenticarToken, verificarPermissao('Staff', 'alterar'), async (req, res) => {
   try {
    const idStaff = parseInt(req.params.id);
    const {nmFuncionario, descFuncao, vlrCusto, vlrBeneficio, descBeneficio, nmCliente, nmEvento, dtInicio, dtFim, vlrTotal, filePath } = req.body;

    if ( !nmFuncionario || !descFuncao || !vlrCusto || !vlrBeneficio || !nmCliente || !nmEvento || !dtInicio || !dtFim || !vlrTotal) {
      return res.status(400).json({ error: 'Preencha todos os campos obrigatórios.' });
    }

    const query = `UPDATE staff SET nmFuncionario = $1, descFuncao = $2, vlrCusto = $3, vlrBeneficio = $4, descBeneficio = $5, nmCliente = $6,
        nmEvento = $7, dtInicio = $8, dtFim = $9, vlrTotal = $10, filePath = $11 WHERE idStaff = $12  RETURNING *`;

    const values = [nmFuncionario, descFuncao, vlrCusto, vlrBeneficio, descBeneficio || null, nmCliente, nmEvento, dtInicio, dtFim, vlrTotal, filePath || null, idStaff];

    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Staff não encontrado.' });
    }

    res.json(result.rows[0]);

  } catch (error) {
    console.error('Erro ao atualizar staff:', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// POST criar nova função
router.post("/", autenticarToken, verificarPermissao('Funcao', 'cadastrar'), async (req, res) => {
    try {
    const {nmFuncionario, descFuncao, vlrCusto, vlrBeneficio, descBeneficio, nmCliente, nmEvento,
      dtInicio, dtFim, vlrTotal, filePath } = req.body;

    if (
      !nmFuncionario || !descFuncao || !vlrCusto || !vlrBeneficio ||
      !nmCliente || !nmEvento || !dtInicio || !dtFim || !vlrTotal
    ) {
      return res.status(400).json({ error: 'Preencha todos os campos obrigatórios.' });
    }

    const query = `
      INSERT INTO staff ( nmfuncionario, descfuncao, vlrcusto, vlrbeneficio, descbeneficio,
        nmcliente, nmevento, dtinicio, dtfim, vlrtotal, filepath
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *
    `;

    const values = [nmFuncionario, descFuncao, vlrCusto, vlrBeneficio, descBeneficio || null, nmCliente,
      nmEvento, dtInicio, dtFim, vlrTotal, filePath || null ];

    const result = await pool.query(query, values);
    res.status(201).json(result.rows[0]);

  } catch (error) {
    console.error('Erro ao cadastrar staff:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});


module.exports = router;