const express = require('express');
const router = express.Router();
const pool = require("../db/conexaoDB");
const { autenticarToken } = require('../middlewares/authMiddlewares');
const { verificarPermissao } = require('../middlewares/permissaoMiddleware');

// Aplica autenticação em todas as rotas
router.use(autenticarToken);

// GET todas ou por id
router.get("/", autenticarToken, verificarPermissao('Orcamentos', 'pesquisar'), async (req, res) => {
  const { idOrcamento } = req.query;

  try {
    if (idOrcamento) {
      const result = await pool.query(
        "SELECT * FROM orcamentos WHERE id = $1 LIMIT 1",
        [idOrcamento]
      );
      return result.rows.length
        ? res.json(result.rows[0])
        : res.status(404).json({ message: "Orçamento não encontrado" });
    } else {
      const result = await pool.query("SELECT * FROM orcamentos");
      return result.rows.length
        ? res.json(result.rows)
        : res.status(404).json({ message: "Nenhum orçamento encontrado" });
    }
  } catch (error) {
    console.error("Erro ao buscar orçamento:", error);
    res.status(500).json({ message: "Erro ao buscar orçamento" });
  }
});

// GET /orcamento/clientes
router.get('/clientes',  async (req, res) => {
    const permissoes = req.usuario?.permissoes;

    const temPermissaoOrcamento = permissoes?.some(p =>
        p.pode_modulo === 'orcamentos' && (p.pode_acessar || p.pode_pesquisar)
    );

    if (!temPermissaoOrcamento) {
        return res.status(403).json({ erro: "Sem permissão ao módulo Orçamentos." });
    }

    try {
        const resultado = await pool.query('SELECT idcliente, nmfantasia FROM clientes ORDER BY nmfantasia');
        res.json(resultado.rows);
    } catch (erro) {
        console.error("Erro ao buscar clientes para orçamento:", erro);
        res.status(500).json({ erro: "Erro interno ao buscar clientes." });
    }
});


// POST criar novo orçamento com itens
router.post("/", autenticarToken, verificarPermissao('Orcamentos', 'cadastrar'), async (req, res) => {
  const client = await pool.connect();
  const dados = req.body;

    try {
        await client.query('BEGIN');

        const insertOrcamento = `
            INSERT INTO orcamentos1 (
                cliente, evento, local, data_inicio, data_fim,
                montagem_infra, periodo_marcacao, periodo_montagem,
                periodo_realizacao, periodo_desmontagem, desmontagem_infra
            ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8, $9, $10, $11
            ) RETURNING id
        `;

        const values = [
            cliente, evento, local, data_inicio, data_fim,
            montagem_infra, periodo_marcacao, periodo_montagem,
            periodo_realizacao, periodo_desmontagem, desmontagem_infra
        ];

        const result = await client.query(insertOrcamento, values);
        const orcamentoId = result.rows[0].id;

        for (const item of itens) {
            await client.query(`
                INSERT INTO itens_orcamento (
                    orcamento_id, categoria, produto, quantidade, dias
                ) VALUES ($1, $2, $3, $4, $5)
            `, [orcamentoId, item.categoria, item.produto, item.quantidade, item.dias]);
        }

        await client.query('COMMIT');
        res.json({ success: true, id: orcamentoId });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erro ao salvar orçamento:', error);
        res.status(500).json({ error: 'Erro ao salvar orçamento' });
    } finally {
        client.release();
    }
});

module.exports = router;
