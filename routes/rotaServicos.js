// routes/rotaServicos.js
// Cadastro de servicos fiscais por empresa — usado na Emissao de Nota Fiscal.
// codigoservico, nbs, cindop e classificacaotributaria sao dados oficiais
// (nao inventados pelo usuario): o cadastro so guarda a correlacao ja
// resolvida pra empresa nao ter que digitar os 3 codigos nota a nota.

const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB");
const { autenticarToken, contextoEmpresa } = require('../middlewares/authMiddlewares');
const { verificarPermissao } = require('../middlewares/permissaoMiddleware');
const logMiddleware = require('../middlewares/logMiddleware');

router.use(autenticarToken());
router.use(contextoEmpresa);

// GET /servicos — lista os servicos cadastrados da empresa atual
router.get("/", verificarPermissao('servicos', 'pesquisar'), async (req, res) => {
  const idempresa = req.idempresa;
  const somenteAtivos = req.query.ativo === 'true';

  try {
    const query = somenteAtivos
      ? `SELECT * FROM servicos WHERE idempresa = $1 AND ativo = true ORDER BY codigoservico ASC`
      : `SELECT * FROM servicos WHERE idempresa = $1 ORDER BY codigoservico ASC`;
    const result = await pool.query(query, [idempresa]);
    return res.json(result.rows);
  } catch (error) {
    console.error("Erro ao buscar serviços:", error);
    res.status(500).json({ message: "Erro ao buscar serviços no banco de dados" });
  }
});

// POST /servicos — cadastra um novo serviço
router.post("/", verificarPermissao('servicos', 'cadastrar'),
  logMiddleware('Servicos', {
    buscarDadosAnteriores: async () => ({ dadosanteriores: null, idregistroalterado: null })
  }),
  async (req, res) => {
    const idempresa = req.idempresa;
    const { codigoServico, descricao, nbs, cindop, classificacaoTributaria, aliquotaIssRef } = req.body;

    if (!codigoServico || !descricao) {
      return res.status(400).json({ message: "Código de serviço e descrição são obrigatórios." });
    }

    try {
      const result = await pool.query(
        `INSERT INTO servicos (idempresa, codigoservico, descricao, nbs, cindop, classificacaotributaria, aliquotaissref, ativo)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true)
         RETURNING *`,
        [idempresa, codigoServico, descricao, nbs || null, cindop || null, classificacaoTributaria || null, aliquotaIssRef || null]
      );

      const novoServico = result.rows[0];
      res.locals.acao = 'cadastrou';
      res.locals.idregistroalterado = novoServico.idservico;
      res.locals.dadosnovos = novoServico;

      res.status(201).json({ message: "Serviço cadastrado com sucesso!", servico: novoServico });
    } catch (error) {
      if (error.code === '23505') { // unique_violation (idempresa, codigoservico)
        return res.status(409).json({ message: "Este código de serviço já está cadastrado para a empresa." });
      }
      console.error("Erro ao cadastrar serviço:", error);
      res.status(500).json({ message: "Erro ao cadastrar serviço.", detail: error.message });
    }
  });

// PUT /servicos/:id — atualiza um serviço existente
router.put("/:id", verificarPermissao('servicos', 'alterar'),
  logMiddleware('Servicos', {
    buscarDadosAnteriores: async (req) => {
      const result = await pool.query(
        `SELECT * FROM servicos WHERE idservico = $1 AND idempresa = $2`,
        [req.params.id, req.idempresa]
      );
      const linha = result.rows[0] || null;
      return { dadosanteriores: linha, idregistroalterado: linha?.idservico || null };
    }
  }),
  async (req, res) => {
    const { id } = req.params;
    const idempresa = req.idempresa;
    const { codigoServico, descricao, nbs, cindop, classificacaoTributaria, aliquotaIssRef, ativo } = req.body;

    if (!codigoServico || !descricao) {
      return res.status(400).json({ message: "Código de serviço e descrição são obrigatórios." });
    }

    try {
      const result = await pool.query(
        `UPDATE servicos
         SET codigoservico = $1, descricao = $2, nbs = $3, cindop = $4, classificacaotributaria = $5, aliquotaissref = $6, ativo = $7
         WHERE idservico = $8 AND idempresa = $9
         RETURNING *`,
        [codigoServico, descricao, nbs || null, cindop || null, classificacaoTributaria || null, aliquotaIssRef || null, ativo, id, idempresa]
      );

      if (!result.rowCount) {
        return res.status(404).json({ message: "Serviço não encontrado para atualizar." });
      }

      res.locals.acao = 'atualizou';
      res.locals.idregistroalterado = result.rows[0].idservico;
      res.locals.dadosnovos = result.rows[0];

      return res.json({ message: "Serviço atualizado com sucesso!", servico: result.rows[0] });
    } catch (error) {
      if (error.code === '23505') { // unique_violation (idempresa, codigoservico)
        return res.status(409).json({ message: "Este código de serviço já está cadastrado para a empresa." });
      }
      console.error("Erro ao atualizar serviço:", error);
      res.status(500).json({ message: "Erro ao atualizar serviço." });
    }
  });

module.exports = router;
