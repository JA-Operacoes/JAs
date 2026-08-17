const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /logs - consulta de logs com filtros (todas as empresas)
router.get('/', async (req, res) => {
  try {
    const {
      modulo,
      idexecutor,
      idregistroalterado,
      idempresa,
      dataInicio,
      dataFim,
      page = 1,
      limit = 50
    } = req.query;

    const condicoes = [];
    const params = [];
    let idx = 1;

    if (modulo) {
      condicoes.push(`l.modulo = $${idx++}`);
      params.push(modulo);
    }
    if (idexecutor) {
      condicoes.push(`l.idexecutor = $${idx++}`);
      params.push(idexecutor);
    }
    if (idregistroalterado) {
      condicoes.push(`l.idregistroalterado = $${idx++}`);
      params.push(idregistroalterado);
    }
    if (idempresa) {
      condicoes.push(`l.idempresa = $${idx++}`);
      params.push(idempresa);
    }
    if (dataInicio) {
      condicoes.push(`l.criado_em::date >= $${idx++}::date`);
      params.push(dataInicio);
    }
    if (dataFim) {
      condicoes.push(`l.criado_em::date <= $${idx++}::date`);
      params.push(dataFim);
    }

    const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';

    const limitNum = Math.min(parseInt(limit, 10) || 50, 200);
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const offset = (pageNum - 1) * limitNum;

    params.push(limitNum);
    const limitParamIdx = idx++;
    params.push(offset);
    const offsetParamIdx = idx++;

    const query = `
      SELECT
        l.id,
        l.criado_em,
        l.modulo,
        l.acao,
        l.idexecutor,
        ue.nome AS executor_nome,
        ue.sobrenome AS executor_sobrenome,
        l.idempresa,
        emp.nmfantasia AS empresa_nome,
        l.idregistroalterado,
        l.idusuarioalvo,
        ua.nome AS usuarioalvo_nome,
        ua.sobrenome AS usuarioalvo_sobrenome,
        l.dadosanteriores,
        l.dadosnovos,
        l.idlog_origem,
        COUNT(*) OVER() AS total
      FROM logs l
      JOIN usuarios ue ON ue.idusuario = l.idexecutor
      LEFT JOIN usuarios ua ON ua.idusuario = l.idusuarioalvo
      LEFT JOIN empresas emp ON emp.idempresa = l.idempresa
      ${where}
      ORDER BY l.criado_em DESC
      LIMIT $${limitParamIdx} OFFSET $${offsetParamIdx}
    `;

    const { rows } = await db.query(query, params);
    const total = rows.length ? parseInt(rows[0].total, 10) : 0;
    const dados = rows.map(({ total: _total, ...resto }) => resto);

    res.json({ rows: dados, total, page: pageNum, limit: limitNum });
  } catch (err) {
    console.error('Erro ao consultar logs:', err);
    res.status(500).json({ erro: 'Erro ao consultar logs.' });
  }
});

// GET /logs/modulos - lista de módulos distintos já gravados em logs
router.get('/modulos', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT DISTINCT modulo FROM logs WHERE modulo IS NOT NULL ORDER BY modulo`
    );
    res.json(rows.map(r => r.modulo));
  } catch (err) {
    console.error('Erro ao buscar módulos de logs:', err);
    res.status(500).json({ erro: 'Erro ao buscar módulos.' });
  }
});

// GET /logs/executores - usuários que já geraram algum log
router.get('/executores', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT DISTINCT ue.idusuario, ue.nome, ue.sobrenome
      FROM logs l
      JOIN usuarios ue ON ue.idusuario = l.idexecutor
      ORDER BY ue.nome
    `);
    res.json(rows);
  } catch (err) {
    console.error('Erro ao buscar executores de logs:', err);
    res.status(500).json({ erro: 'Erro ao buscar executores.' });
  }
});

// GET /logs/empresas - empresas que aparecem em algum log
router.get('/empresas', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT DISTINCT emp.idempresa, emp.nmfantasia
      FROM logs l
      JOIN empresas emp ON emp.idempresa = l.idempresa
      ORDER BY emp.nmfantasia
    `);
    res.json(rows);
  } catch (err) {
    console.error('Erro ao buscar empresas de logs:', err);
    res.status(500).json({ erro: 'Erro ao buscar empresas.' });
  }
});

module.exports = router;
