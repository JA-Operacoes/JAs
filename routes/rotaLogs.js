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
      idfuncionario,
      idempresa,
      dataInicio,
      dataFim,
      page = 1,
      limit = 50,
      orderBy = 'criado_em',
      orderDir = 'desc'
    } = req.query;

    const colunasOrdenaveis = {
      criado_em: 'l.criado_em',
      empresa_nome: 'emp.nmfantasia',
      modulo: 'l.modulo',
      acao: 'l.acao',
      executor_nome: 'ue.nome',
      idregistroalterado: 'l.idregistroalterado',
      usuarioalvo_nome: 'ua.nome'
    };
    const colunaOrdenacao = colunasOrdenaveis[orderBy] || colunasOrdenaveis.criado_em;
    const direcaoOrdenacao = String(orderDir).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

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
    if (idfuncionario && /^\d+$/.test(String(idfuncionario))) {
      // Não existe coluna de funcionário na tabela logs. O vínculo é achado de duas formas:
      // 1) idregistroalterado do módulo "Funcionarios" (PK gravada por logMiddleware);
      // 2) qualquer referência ao id dentro dos JSONBs dadosanteriores/dadosnovos, já que
      //    outros módulos (Orçamentos, Staff, etc.) guardam o idfuncionario dentro do payload.
      const idxIdReg = idx++;
      const idxJson = idx++;
      // Casa uma chave contendo "funcionario" seguida do valor exato do id, delimitado por
      // vírgula, fechamento de objeto/array ou fim de string (evita casar 123 dentro de 1234).
      const regexFuncionario = `"[a-zA-Z_]*funcionario[a-zA-Z_]*"\\s*:\\s*"?${idfuncionario}"?(,|\\}|\\]|$)`;
      condicoes.push(`(
        (l.modulo = 'Funcionarios' AND l.idregistroalterado = $${idxIdReg})
        OR l.dadosanteriores::text ~* $${idxJson}
        OR l.dadosnovos::text ~* $${idxJson}
      )`);
      params.push(idfuncionario, regexFuncionario);
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
      ORDER BY ${colunaOrdenacao} ${direcaoOrdenacao}, l.id ${direcaoOrdenacao}
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

// GET /logs/funcionarios?q= - busca funcionários por nome (autocomplete do filtro de logs)
router.get('/funcionarios', async (req, res) => {
  try {
    const termo = (req.query.q || '').trim();
    if (termo.length < 2) return res.json([]);

    const { rows } = await db.query(
      `SELECT idfuncionario, nome, apelido
       FROM funcionarios
       WHERE unaccent(nome) ILIKE unaccent($1)
       ORDER BY nome
       LIMIT 20`,
      [`%${termo}%`]
    );
    res.json(rows);
  } catch (err) {
    console.error('Erro ao buscar funcionários para logs:', err);
    res.status(500).json({ erro: 'Erro ao buscar funcionários.' });
  }
});

module.exports = router;
