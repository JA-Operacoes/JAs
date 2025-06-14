const express = require('express');
const router = express.Router();
const pool = require('../db'); // ajuste o caminho conforme seu projeto
const { autenticarToken } = require('../middlewares/authMiddlewares');

// Listar todas as empresas
router.get('/',  autenticarToken({ verificarEmpresa: false }), async (req, res) => {
  console.log('✅ [GET /empresas] Rota acessada com sucesso');
  try {
    const result = await pool.query('SELECT * FROM empresas ORDER BY nome');
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao buscar empresas:', err);
    res.status(500).send('Erro interno');
  }
});

// Criar nova empresa
router.post('/', async (req, res) => {
  const { nome, cnpj, razao_social, telefone, email } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO empresas (nome, cnpj, razao_social, telefone, email) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [nome, cnpj, razao_social, telefone, email]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao criar empresa:', err);
    res.status(500).send('Erro ao criar empresa');
  }
});

// Atualizar empresa
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { nome, cnpj, razao_social, telefone, email } = req.body;
  try {
    const result = await pool.query(
      'UPDATE empresas SET nome = $1, cnpj = $2, razao_social = $3, telefone = $4, email = $5 WHERE id = $6 RETURNING *',
      [nome, cnpj, razao_social, telefone, email, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao atualizar empresa:', err);
    res.status(500).send('Erro ao atualizar empresa');
  }
});

// Deletar empresa
// router.delete('/:id', async (req, res) => {
//   const { id } = req.params;
//   try {
//     await pool.query('DELETE FROM empresas WHERE id = $1', [id]);
//     res.sendStatus(204);
//   } catch (err) {
//     console.error('Erro ao deletar empresa:', err);
//     res.status(500).send('Erro ao deletar empresa');
//   }
// });

module.exports = router;
