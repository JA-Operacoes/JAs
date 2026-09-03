const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB");
const logMiddleware = require('../middlewares/logMiddleware');
const registrarLog = require('../utils/logger');
const { exigirFlag } = require('../middlewares/permissaoMiddleware');
const { enviarEmail } = require('../utils/mailer');
const { criarNotificacao } = require('../src/services/NotificacaoServices');
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const multer = require("multer");

// Junta a contagem real de unidades (equipamentounidade) nos objetos de modelos (JSONB).
// qtdeestoque = unidades com status 'estoque'; qtdtotal = todas (qualquer status, exceto baixado).
async function anexarContagemUnidades(equipamentos, idempresa) {
  const contagemResult = await pool.query(
    `SELECT idmodelo,
            COUNT(*) FILTER (WHERE status = 'estoque') AS qtdeestoque,
            COUNT(*) FILTER (WHERE status <> 'baixado') AS qtdtotal
       FROM equipamentounidade
       WHERE idempresa = $1
       GROUP BY idmodelo`,
    [idempresa]
  );

  const contagemPorModelo = {};
  contagemResult.rows.forEach((c) => {
    contagemPorModelo[c.idmodelo] = { qtdeestoque: Number(c.qtdeestoque), qtdtotal: Number(c.qtdtotal) };
  });

  return equipamentos.map((e) => {
    const modelosComContagem = (e.modelos || []).map((m) => ({
      ...m,
      qtdeestoque: contagemPorModelo[m.id]?.qtdeestoque || 0,
      qtdtotal: contagemPorModelo[m.id]?.qtdtotal || 0,
    }));
    const qtdtotalCategoria = modelosComContagem.reduce((soma, m) => soma + m.qtdtotal, 0);
    return { ...e, modelos: modelosComContagem, qtdtotalCategoria };
  });
}

// GET lista de equipamentos (categorias), já com modelos/complementos e contagem real de unidades
router.get("/equipamentos", async (req, res) => {
  const idempresa = req.idempresa;

  try {
    const result = await pool.query(
      `SELECT e.* FROM equipamentos e
         INNER JOIN equipamentoempresas ee ON ee.idequip = e.idequip
         WHERE ee.idempresa = $1 ORDER BY e.descEquip ASC`,
      [idempresa]
    );
    const equipamentos = await anexarContagemUnidades(result.rows, idempresa);
    res.json(equipamentos);
  } catch (error) {
    console.error("Erro ao listar equipamentos (TI):", error);
    res.status(500).json({ message: "Erro ao listar equipamentos." });
  }
});

// PUT movimentação de estoque de um modelo específico.
// Entrada: cria N unidades novas (uma por patrimônio informado).
// Saída/baixa: marca as unidades escolhidas (idunidades) como 'baixado'.
router.put("/equipamentos/:idequip/modelos/:idmodelo/estoque",
  logMiddleware('TI', {
    buscarDadosAnteriores: async () => ({ dadosanteriores: null, idregistroalterado: null })
  }),
  async (req, res) => {
    const { idequip, idmodelo } = req.params;
    const idempresa = req.idempresa;
    const idusuario = req.usuario?.idusuario;
    const { tipo, patrimonios, idunidades, motivo } = req.body;

    if (!['entrada', 'saida'].includes(tipo)) {
      return res.status(400).json({ message: "Tipo de movimentação inválido." });
    }

    let client;
    try {
      client = await pool.connect();
      await client.query('BEGIN');

      const equipamentoResult = await client.query(
        `SELECT e.idequip, e.modelos FROM equipamentos e
           INNER JOIN equipamentoempresas ee ON ee.idequip = e.idequip
           WHERE e.idequip = $1 AND ee.idempresa = $2
           FOR UPDATE`,
        [idequip, idempresa]
      );

      if (!equipamentoResult.rowCount) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: "Equipamento não encontrado." });
      }

      const modelos = equipamentoResult.rows[0].modelos || [];
      if (!modelos.some((m) => m.id === idmodelo)) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: "Modelo não encontrado." });
      }

      let quantidade = 0;
      let unidadesCriadas = [];

      if (tipo === 'entrada') {
        const lista = (patrimonios || []).map((p) => String(p).trim()).filter(Boolean);
        if (!lista.length) {
          await client.query('ROLLBACK');
          return res.status(400).json({ message: "Informe ao menos um patrimônio para dar entrada." });
        }
        quantidade = lista.length;

        for (const patrimonio of lista) {
          const insertResult = await client.query(
            `INSERT INTO equipamentounidade (idequip, idmodelo, idempresa, patrimonio, status)
               VALUES ($1, $2, $3, $4, 'estoque') RETURNING *`,
            [idequip, idmodelo, idempresa, patrimonio]
          );
          unidadesCriadas.push(insertResult.rows[0]);
        }
      } else {
        const lista = (idunidades || []).filter(Boolean);
        if (!lista.length) {
          await client.query('ROLLBACK');
          return res.status(400).json({ message: "Selecione ao menos uma unidade para dar baixa." });
        }

        const updateUnidadesResult = await client.query(
          `UPDATE equipamentounidade SET status = 'baixado'
             WHERE idunidade = ANY($1::int[]) AND idmodelo = $2 AND idempresa = $3 AND status = 'estoque'
             RETURNING *`,
          [lista, idmodelo, idempresa]
        );
        quantidade = updateUnidadesResult.rowCount;
        if (!quantidade) {
          await client.query('ROLLBACK');
          return res.status(400).json({ message: "Nenhuma unidade válida em estoque encontrada para baixa." });
        }
      }

      await client.query(
        `INSERT INTO equipamentomovimentacao (idequip, idmodelo, idempresa, tipo, quantidade, motivo, idusuario)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [idequip, idmodelo, idempresa, tipo, quantidade, motivo || null, idusuario || null]
      );

      await client.query('COMMIT');

      res.locals.acao = tipo === 'entrada' ? 'registrou entrada de estoque' : 'registrou saída de estoque';
      res.locals.idregistroalterado = idequip;
      res.locals.idusuarioAlvo = null;
      res.locals.dadosnovos = req.body;

      res.json({ message: "Movimentação registrada com sucesso!", quantidade, unidades: unidadesCriadas });
    } catch (error) {
      if (client) await client.query('ROLLBACK');
      if (error.code === '23505') {
        return res.status(400).json({ message: "Um ou mais patrimônios já existem para esta empresa." });
      }
      console.error("Erro ao registrar movimentação de estoque:", error);
      res.status(500).json({ message: "Erro ao registrar movimentação de estoque." });
    } finally {
      if (client) client.release();
    }
  }
);

// GET unidades (patrimônios) de um modelo, com o funcionário atual (se houver)
router.get("/equipamentos/:idequip/modelos/:idmodelo/unidades", async (req, res) => {
  const { idequip, idmodelo } = req.params;
  const idempresa = req.idempresa;

  try {
    const result = await pool.query(
      `SELECT u.*, f.nome AS nome_funcionario_atual, ev.nmevento AS nmevento_atual
         FROM equipamentounidade u
         LEFT JOIN funcionarios f ON f.idfuncionario = u.idfuncionario_atual
         LEFT JOIN eventos ev ON ev.idevento = u.idevento_atual
         WHERE u.idequip = $1 AND u.idmodelo = $2 AND u.idempresa = $3
         ORDER BY u.status ASC, u.patrimonio ASC`,
      [idequip, idmodelo, idempresa]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Erro ao listar unidades do modelo:", error);
    res.status(500).json({ message: "Erro ao listar unidades do modelo." });
  }
});

// GET histórico de movimentações de um modelo
router.get("/equipamentos/:idequip/modelos/:idmodelo/movimentacoes", async (req, res) => {
  const { idequip, idmodelo } = req.params;
  const idempresa = req.idempresa;

  try {
    const result = await pool.query(
      `SELECT * FROM equipamentomovimentacao
         WHERE idequip = $1 AND idmodelo = $2 AND idempresa = $3
         ORDER BY criado_em DESC`,
      [idequip, idmodelo, idempresa]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Erro ao buscar movimentações do modelo:", error);
    res.status(500).json({ message: "Erro ao buscar movimentações do modelo." });
  }
});

// ===== Custódia por funcionário =====

// GET autocomplete de funcionário (mesmo padrão de /ceo/geral/funcionarios, dentro do TI)
router.get("/funcionarios/busca", async (req, res) => {
  const idempresa = req.idempresa;
  const busca = (req.query.busca || "").trim();

  if (!busca) return res.json([]);

  try {
    const result = await pool.query(
      `SELECT DISTINCT f.idfuncionario, f.nome
         FROM funcionarios f
         INNER JOIN funcionarioempresas fe ON fe.idfuncionario = f.idfuncionario
         WHERE fe.idempresa = $1 AND fe.ativo = true
           AND fe.perfil IN ('Interno', 'ExternoH', 'Externo')
           AND f.nome ILIKE $2
         ORDER BY f.nome ASC LIMIT 20`,
      [idempresa, `%${busca}%`]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Erro ao buscar funcionários (TI):", error);
    res.status(500).json({ message: "Erro ao buscar funcionários." });
  }
});

// GET autocomplete de usuário do sistema (pra vincular um e-mail corporativo ao login do usuário)
router.get("/usuarios/busca", async (req, res) => {
  const idempresa = req.idempresa;
  const busca = (req.query.busca || "").trim();

  if (!busca) return res.json([]);

  try {
    const result = await pool.query(
      `SELECT idusuario, nome, sobrenome, email
         FROM usuarios
         WHERE idempresadefault = $1 AND ativo = true
           AND (nome ILIKE $2 OR sobrenome ILIKE $2 OR email ILIKE $2)
         ORDER BY nome ASC LIMIT 20`,
      [idempresa, `%${busca}%`]
    );
    res.json(result.rows.map((u) => ({ idusuario: u.idusuario, nome: `${u.nome}${u.sobrenome ? " " + u.sobrenome : ""} (${u.email})` })));
  } catch (error) {
    console.error("Erro ao buscar usuários (TI):", error);
    res.status(500).json({ message: "Erro ao buscar usuários." });
  }
});

// GET usuário do sistema pelo e-mail exato (usado pra auto-sincronizar ao cadastrar um
// e-mail corporativo: se o e-mail digitado já é login de algum usuário, vincula sozinho).
router.get("/usuarios/por-email", async (req, res) => {
  const idempresa = req.idempresa;
  const email = (req.query.email || "").trim();
  const idfuncionario = req.query.idfuncionario;

  // fetchTI() no frontend trata qualquer corpo "null"/falsy como falha de requisição
  // (throw), então "não achou usuário" precisa ser um objeto vazio, não null.
  if (!email) return res.json({});

  try {
    const result = await pool.query(
      `SELECT idusuario, nome, sobrenome, email
         FROM usuarios
         WHERE idempresadefault = $1 AND ativo = true AND email ILIKE $2
         LIMIT 1`,
      [idempresa, email]
    );
    if (!result.rowCount) return res.json({});
    const u = result.rows[0];

    let compativel = true;
    if (idfuncionario) {
      const func = await pool.query(`SELECT nome FROM funcionarios WHERE idfuncionario = $1`, [idfuncionario]);
      if (func.rowCount) compativel = nomesCompativeis(func.rows[0].nome, u.nome, u.sobrenome);
    }

    res.json({ idusuario: u.idusuario, nome: `${u.nome}${u.sobrenome ? " " + u.sobrenome : ""}`, compativel });
  } catch (error) {
    console.error("Erro ao buscar usuário por e-mail (TI):", error);
    res.status(500).json({ message: "Erro ao buscar usuário por e-mail." });
  }
});

// GET todos os funcionários ativos (interno/externo/externo c/holerite) com os equipamentos que estão com cada um
router.get("/custodia/funcionarios", async (req, res) => {
  const idempresa = req.idempresa;
  const perfil = (req.query.perfil || "").trim();

  try {
    const params = [idempresa];
    let filtroPerfil = "";
    if (perfil) {
      params.push(perfil);
      filtroPerfil = ` AND fe.perfil = $${params.length}`;
    }

    const result = await pool.query(
      `SELECT f.idfuncionario, f.nome, fe.perfil,
              COALESCE(
                json_agg(
                  json_build_object(
                    'idunidade', u.idunidade, 'patrimonio', u.patrimonio,
                    'idequip', u.idequip, 'idmodelo', u.idmodelo, 'descequip', eq.descEquip
                  ) ORDER BY eq.descEquip
                ) FILTER (WHERE u.idunidade IS NOT NULL),
                '[]'
              ) AS equipamentos
         FROM funcionarios f
         INNER JOIN funcionarioempresas fe ON fe.idfuncionario = f.idfuncionario
         LEFT JOIN equipamentounidade u ON u.idfuncionario_atual = f.idfuncionario
           AND u.idempresa = $1 AND u.status = 'com_funcionario'
         LEFT JOIN equipamentos eq ON eq.idequip = u.idequip
         WHERE fe.idempresa = $1 AND fe.ativo = true
           AND fe.perfil IN ('Interno', 'ExternoH', 'Externo')${filtroPerfil}
         GROUP BY f.idfuncionario, f.nome, fe.perfil
         ORDER BY f.nome ASC`,
      params
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Erro ao listar funcionários para alocação:", error);
    res.status(500).json({ message: "Erro ao listar funcionários." });
  }
});

// GET todas as unidades atualmente com algum funcionário (visão "quem está com o quê")
router.get("/custodia/atual", async (req, res) => {
  const idempresa = req.idempresa;

  try {
    const result = await pool.query(
      `SELECT u.*, eq.descEquip, f.nome AS nome_funcionario_atual
         FROM equipamentounidade u
         INNER JOIN equipamentos eq ON eq.idequip = u.idequip
         INNER JOIN funcionarios f ON f.idfuncionario = u.idfuncionario_atual
         WHERE u.idempresa = $1 AND u.status = 'com_funcionario'
         ORDER BY f.nome ASC, eq.descEquip ASC`,
      [idempresa]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Erro ao listar custódia atual:", error);
    res.status(500).json({ message: "Erro ao listar custódia atual." });
  }
});

async function registrarCustodia(client, { idunidade, tipo, idfuncionario_origem, idfuncionario_destino, idevento, observacao, idusuario }) {
  await client.query(
    `INSERT INTO equipamentocustodiahistorico
       (idunidade, tipo, idfuncionario_origem, idfuncionario_destino, idevento, observacao, idusuario)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [idunidade, tipo, idfuncionario_origem || null, idfuncionario_destino || null, idevento || null, observacao || null, idusuario || null]
  );
}

// POST entregar unidade a um funcionário
router.post("/custodia/entregar",
  logMiddleware('TI', { buscarDadosAnteriores: async () => ({ dadosanteriores: null, idregistroalterado: null }) }),
  async (req, res) => {
    const idempresa = req.idempresa;
    const idusuario = req.usuario?.idusuario;
    const { idunidade, idfuncionario, observacao } = req.body;

    if (!idunidade || !idfuncionario) {
      return res.status(400).json({ message: "idunidade e idfuncionario são obrigatórios." });
    }

    let client;
    try {
      client = await pool.connect();
      await client.query('BEGIN');

      const unidadeResult = await client.query(
        `SELECT * FROM equipamentounidade WHERE idunidade = $1 AND idempresa = $2 FOR UPDATE`,
        [idunidade, idempresa]
      );
      if (!unidadeResult.rowCount) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: "Unidade não encontrada." });
      }
      if (unidadeResult.rows[0].status !== 'estoque') {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: "Só é possível entregar unidades que estão em estoque." });
      }

      const updateResult = await client.query(
        `UPDATE equipamentounidade SET status = 'com_funcionario', idfuncionario_atual = $1
           WHERE idunidade = $2 RETURNING *`,
        [idfuncionario, idunidade]
      );

      await registrarCustodia(client, { idunidade, tipo: 'entrega', idfuncionario_destino: idfuncionario, observacao, idusuario });

      await client.query('COMMIT');

      res.locals.acao = 'entregou equipamento a funcionário';
      res.locals.idregistroalterado = idunidade;
      res.locals.idusuarioAlvo = idfuncionario;
      res.locals.dadosnovos = updateResult.rows[0];

      res.json({ message: "Equipamento entregue com sucesso!", unidade: updateResult.rows[0] });
    } catch (error) {
      if (client) await client.query('ROLLBACK');
      console.error("Erro ao entregar equipamento:", error);
      res.status(500).json({ message: "Erro ao entregar equipamento." });
    } finally {
      if (client) client.release();
    }
  }
);

// POST devolver unidade ao estoque
router.post("/custodia/devolver",
  logMiddleware('TI', { buscarDadosAnteriores: async () => ({ dadosanteriores: null, idregistroalterado: null }) }),
  async (req, res) => {
    const idempresa = req.idempresa;
    const idusuario = req.usuario?.idusuario;
    const { idunidade, observacao } = req.body;

    if (!idunidade) return res.status(400).json({ message: "idunidade é obrigatório." });

    let client;
    try {
      client = await pool.connect();
      await client.query('BEGIN');

      const unidadeResult = await client.query(
        `SELECT * FROM equipamentounidade WHERE idunidade = $1 AND idempresa = $2 FOR UPDATE`,
        [idunidade, idempresa]
      );
      if (!unidadeResult.rowCount) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: "Unidade não encontrada." });
      }
      if (unidadeResult.rows[0].status !== 'com_funcionario') {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: "Essa unidade não está com um funcionário no momento." });
      }

      const idfuncionarioAnterior = unidadeResult.rows[0].idfuncionario_atual;

      const updateResult = await client.query(
        `UPDATE equipamentounidade SET status = 'estoque', idfuncionario_atual = NULL
           WHERE idunidade = $1 RETURNING *`,
        [idunidade]
      );

      await registrarCustodia(client, { idunidade, tipo: 'devolucao', idfuncionario_origem: idfuncionarioAnterior, observacao, idusuario });

      await client.query('COMMIT');

      res.locals.acao = 'devolveu equipamento ao estoque';
      res.locals.idregistroalterado = idunidade;
      res.locals.idusuarioAlvo = idfuncionarioAnterior;
      res.locals.dadosnovos = updateResult.rows[0];

      res.json({ message: "Equipamento devolvido ao estoque!", unidade: updateResult.rows[0] });
    } catch (error) {
      if (client) await client.query('ROLLBACK');
      console.error("Erro ao devolver equipamento:", error);
      res.status(500).json({ message: "Erro ao devolver equipamento." });
    } finally {
      if (client) client.release();
    }
  }
);

// POST transferir unidade para outro funcionário
router.post("/custodia/transferir",
  logMiddleware('TI', { buscarDadosAnteriores: async () => ({ dadosanteriores: null, idregistroalterado: null }) }),
  async (req, res) => {
    const idempresa = req.idempresa;
    const idusuario = req.usuario?.idusuario;
    const { idunidade, idfuncionario_novo, observacao } = req.body;

    if (!idunidade || !idfuncionario_novo) {
      return res.status(400).json({ message: "idunidade e idfuncionario_novo são obrigatórios." });
    }

    let client;
    try {
      client = await pool.connect();
      await client.query('BEGIN');

      const unidadeResult = await client.query(
        `SELECT * FROM equipamentounidade WHERE idunidade = $1 AND idempresa = $2 FOR UPDATE`,
        [idunidade, idempresa]
      );
      if (!unidadeResult.rowCount) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: "Unidade não encontrada." });
      }
      if (unidadeResult.rows[0].status !== 'com_funcionario') {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: "Só é possível transferir unidades que já estão com um funcionário." });
      }

      const idfuncionarioAnterior = unidadeResult.rows[0].idfuncionario_atual;

      const updateResult = await client.query(
        `UPDATE equipamentounidade SET idfuncionario_atual = $1 WHERE idunidade = $2 RETURNING *`,
        [idfuncionario_novo, idunidade]
      );

      await registrarCustodia(client, {
        idunidade, tipo: 'transferencia',
        idfuncionario_origem: idfuncionarioAnterior, idfuncionario_destino: idfuncionario_novo,
        observacao, idusuario
      });

      await client.query('COMMIT');

      res.locals.acao = 'transferiu equipamento entre funcionários';
      res.locals.idregistroalterado = idunidade;
      res.locals.idusuarioAlvo = idfuncionario_novo;
      res.locals.dadosnovos = updateResult.rows[0];

      res.json({ message: "Equipamento transferido com sucesso!", unidade: updateResult.rows[0] });
    } catch (error) {
      if (client) await client.query('ROLLBACK');
      console.error("Erro ao transferir equipamento:", error);
      res.status(500).json({ message: "Erro ao transferir equipamento." });
    } finally {
      if (client) client.release();
    }
  }
);

// POST enviar unidade a um evento
router.post("/custodia/enviar-evento",
  logMiddleware('TI', { buscarDadosAnteriores: async () => ({ dadosanteriores: null, idregistroalterado: null }) }),
  async (req, res) => {
    const idempresa = req.idempresa;
    const idusuario = req.usuario?.idusuario;
    const { idunidade, idevento, observacao } = req.body;

    if (!idunidade || !idevento) {
      return res.status(400).json({ message: "idunidade e idevento são obrigatórios." });
    }

    let client;
    try {
      client = await pool.connect();
      await client.query('BEGIN');

      const unidadeResult = await client.query(
        `SELECT * FROM equipamentounidade WHERE idunidade = $1 AND idempresa = $2 FOR UPDATE`,
        [idunidade, idempresa]
      );
      if (!unidadeResult.rowCount) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: "Unidade não encontrada." });
      }
      if (!['estoque', 'com_funcionario'].includes(unidadeResult.rows[0].status)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: "Essa unidade não pode ser enviada a um evento no status atual." });
      }

      const updateResult = await client.query(
        `UPDATE equipamentounidade SET status = 'evento', idevento_atual = $1 WHERE idunidade = $2 RETURNING *`,
        [idevento, idunidade]
      );

      await registrarCustodia(client, { idunidade, tipo: 'envio_evento', idevento, observacao, idusuario });

      await client.query('COMMIT');

      res.locals.acao = 'enviou equipamento a evento';
      res.locals.idregistroalterado = idunidade;
      res.locals.idusuarioAlvo = null;
      res.locals.dadosnovos = updateResult.rows[0];

      res.json({ message: "Equipamento enviado ao evento!", unidade: updateResult.rows[0] });
    } catch (error) {
      if (client) await client.query('ROLLBACK');
      console.error("Erro ao enviar equipamento a evento:", error);
      res.status(500).json({ message: "Erro ao enviar equipamento a evento." });
    } finally {
      if (client) client.release();
    }
  }
);

// POST retornar unidade de um evento (volta pro estoque, ou pro funcionário se ele ainda estiver setado)
router.post("/custodia/retornar-evento",
  logMiddleware('TI', { buscarDadosAnteriores: async () => ({ dadosanteriores: null, idregistroalterado: null }) }),
  async (req, res) => {
    const idempresa = req.idempresa;
    const idusuario = req.usuario?.idusuario;
    const { idunidade, observacao } = req.body;

    if (!idunidade) return res.status(400).json({ message: "idunidade é obrigatório." });

    let client;
    try {
      client = await pool.connect();
      await client.query('BEGIN');

      const unidadeResult = await client.query(
        `SELECT * FROM equipamentounidade WHERE idunidade = $1 AND idempresa = $2 FOR UPDATE`,
        [idunidade, idempresa]
      );
      if (!unidadeResult.rowCount) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: "Unidade não encontrada." });
      }
      if (unidadeResult.rows[0].status !== 'evento') {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: "Essa unidade não está em um evento no momento." });
      }

      const idEventoAnterior = unidadeResult.rows[0].idevento_atual;
      const novoStatus = unidadeResult.rows[0].idfuncionario_atual ? 'com_funcionario' : 'estoque';

      const updateResult = await client.query(
        `UPDATE equipamentounidade SET status = $1, idevento_atual = NULL WHERE idunidade = $2 RETURNING *`,
        [novoStatus, idunidade]
      );

      await registrarCustodia(client, { idunidade, tipo: 'retorno_evento', idevento: idEventoAnterior, observacao, idusuario });

      await client.query('COMMIT');

      res.locals.acao = 'retornou equipamento de evento';
      res.locals.idregistroalterado = idunidade;
      res.locals.idusuarioAlvo = null;
      res.locals.dadosnovos = updateResult.rows[0];

      res.json({ message: "Equipamento retornado do evento!", unidade: updateResult.rows[0] });
    } catch (error) {
      if (client) await client.query('ROLLBACK');
      console.error("Erro ao retornar equipamento de evento:", error);
      res.status(500).json({ message: "Erro ao retornar equipamento de evento." });
    } finally {
      if (client) client.release();
    }
  }
);

// GET histórico de máquinas que estiveram com um funcionário e foram para manutenção
router.get("/custodia/funcionario/:idfuncionario/historico-manutencao", async (req, res) => {
  const { idfuncionario } = req.params;
  const idempresa = req.idempresa;

  try {
    const result = await pool.query(
      `SELECT h.*, eq.descEquip, u.patrimonio
         FROM equipamentocustodiahistorico h
         INNER JOIN equipamentounidade u ON u.idunidade = h.idunidade
         INNER JOIN equipamentos eq ON eq.idequip = u.idequip
         WHERE h.idfuncionario_origem = $1 AND h.tipo = 'manutencao' AND u.idempresa = $2
         ORDER BY h.criado_em DESC`,
      [idfuncionario, idempresa]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Erro ao buscar histórico de manutenção do funcionário:", error);
    res.status(500).json({ message: "Erro ao buscar histórico de manutenção do funcionário." });
  }
});

// GET histórico de custódia de uma unidade
router.get("/custodia/unidade/:idunidade/historico", async (req, res) => {
  const { idunidade } = req.params;

  try {
    const result = await pool.query(
      `SELECT h.*, fo.nome AS nome_origem, fd.nome AS nome_destino, ev.nmevento
         FROM equipamentocustodiahistorico h
         LEFT JOIN funcionarios fo ON fo.idfuncionario = h.idfuncionario_origem
         LEFT JOIN funcionarios fd ON fd.idfuncionario = h.idfuncionario_destino
         LEFT JOIN eventos ev ON ev.idevento = h.idevento
         WHERE h.idunidade = $1
         ORDER BY h.criado_em DESC`,
      [idunidade]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Erro ao buscar histórico de custódia:", error);
    res.status(500).json({ message: "Erro ao buscar histórico de custódia." });
  }
});

// GET autocomplete de unidades em estoque (para incluir manualmente uma manutenção)
router.get("/estoque/busca", async (req, res) => {
  const idempresa = req.idempresa;
  const busca = (req.query.busca || "").trim();

  if (!busca) return res.json([]);

  try {
    const result = await pool.query(
      `SELECT u.idunidade, u.idequip, u.idmodelo, u.patrimonio, eq.descEquip,
              elem->>'marca' AS marca, elem->>'modelo' AS modelo
         FROM equipamentounidade u
         INNER JOIN equipamentos eq ON eq.idequip = u.idequip
         LEFT JOIN LATERAL jsonb_array_elements(eq.modelos) elem ON elem->>'id' = u.idmodelo
         WHERE u.idempresa = $1 AND u.status = 'estoque'
           AND (u.patrimonio ILIKE $2 OR eq.descEquip ILIKE $2 OR elem->>'marca' ILIKE $2 OR elem->>'modelo' ILIKE $2)
         ORDER BY eq.descEquip ASC, u.patrimonio ASC
         LIMIT 20`,
      [idempresa, `%${busca}%`]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Erro ao buscar unidades em estoque:", error);
    res.status(500).json({ message: "Erro ao buscar unidades em estoque." });
  }
});

// POST enviar unidade para manutenção
router.post("/manutencao",
  logMiddleware('TI', {
    buscarDadosAnteriores: async () => ({ dadosanteriores: null, idregistroalterado: null })
  }),
  async (req, res) => {
    const idempresa = req.idempresa;
    const idusuario = req.usuario?.idusuario;
    const { idunidade, descricaoproblema, orcamento_realizado, orcamento_valor, orcamento_obs } = req.body;

    if (!idunidade) {
      return res.status(400).json({ message: "idunidade é obrigatório." });
    }
    if (!descricaoproblema || !descricaoproblema.trim()) {
      return res.status(400).json({ message: "Descreva o problema do equipamento." });
    }

    let client;
    try {
      client = await pool.connect();
      await client.query('BEGIN');

      const unidadeResult = await client.query(
        `SELECT * FROM equipamentounidade WHERE idunidade = $1 AND idempresa = $2 FOR UPDATE`,
        [idunidade, idempresa]
      );
      if (!unidadeResult.rowCount) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: "Unidade não encontrada." });
      }
      if (!['estoque', 'com_funcionario'].includes(unidadeResult.rows[0].status)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: "Só é possível enviar para manutenção unidades que estão em estoque ou com um funcionário." });
      }

      const { idequip, idmodelo, idfuncionario_atual: idfuncionarioOrigem } = unidadeResult.rows[0];

      const manutencaoResult = await client.query(
        `INSERT INTO equipamentomanutencao
           (idequip, idmodelo, idunidade, idempresa, descricaoproblema, idusuario, orcamento_realizado, orcamento_valor, orcamento_obs)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [idequip, idmodelo, idunidade, idempresa, descricaoproblema.trim(), idusuario || null,
          !!orcamento_realizado, orcamento_valor || null, orcamento_obs || null]
      );

      await client.query(
        `UPDATE equipamentounidade SET status = 'manutencao', idfuncionario_atual = NULL WHERE idunidade = $1`,
        [idunidade]
      );

      await registrarCustodia(client, {
        idunidade, tipo: 'manutencao',
        idfuncionario_origem: idfuncionarioOrigem, observacao: descricaoproblema.trim(), idusuario
      });

      await client.query('COMMIT');

      const novaManutencao = manutencaoResult.rows[0];
      res.locals.acao = 'enviou para manutenção';
      res.locals.idregistroalterado = novaManutencao.idmanutencao;
      res.locals.idusuarioAlvo = null;
      res.locals.dadosnovos = novaManutencao;

      res.status(201).json({ message: "Equipamento enviado para manutenção.", manutencao: novaManutencao });
    } catch (error) {
      if (client) await client.query('ROLLBACK');
      console.error("Erro ao enviar equipamento para manutenção:", error);
      res.status(500).json({ message: "Erro ao enviar equipamento para manutenção." });
    } finally {
      if (client) client.release();
    }
  }
);

// GET fila de manutenção (junta marca/modelo via jsonb_array_elements)
router.get("/manutencao", async (req, res) => {
  const idempresa = req.idempresa;
  const { status } = req.query;

  try {
    const params = [idempresa];
    // Uma vez que já existe orçamento anexado, o item sai da fila — a partir daí ele é
    // acompanhado só pela aba Orçamentos (comparar cotações, aprovar/recusar).
    let where = "m.idempresa = $1 AND NOT EXISTS (SELECT 1 FROM equipamentoorcamentocompra o WHERE o.idmanutencao = m.idmanutencao)";
    if (status) {
      params.push(status);
      where += ` AND m.status = $${params.length}`;
    }

    const result = await pool.query(
      `SELECT m.*, eq.descEquip, u.patrimonio, elem->>'marca' AS marca, elem->>'modelo' AS modelo
         FROM equipamentomanutencao m
         INNER JOIN equipamentos eq ON eq.idequip = m.idequip
         LEFT JOIN equipamentounidade u ON u.idunidade = m.idunidade
         LEFT JOIN LATERAL jsonb_array_elements(eq.modelos) elem ON elem->>'id' = m.idmodelo
         WHERE ${where}
         ORDER BY m.data_entrada DESC`,
      params
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Erro ao listar fila de manutenção:", error);
    res.status(500).json({ message: "Erro ao listar fila de manutenção." });
  }
});

// PUT atualizar status de uma manutenção
router.put("/manutencao/:id",
  logMiddleware('TI', {
    buscarDadosAnteriores: async (req) => {
      try {
        const result = await pool.query(
          `SELECT * FROM equipamentomanutencao WHERE idmanutencao = $1 AND idempresa = $2`,
          [req.params.id, req.idempresa]
        );
        const linha = result.rows[0] || null;
        return { dadosanteriores: linha, idregistroalterado: linha?.idmanutencao || null };
      } catch (error) {
        console.error("Erro ao buscar dados anteriores da manutenção:", error);
        return { dadosanteriores: null, idregistroalterado: null };
      }
    }
  }),
  async (req, res) => {
    const idmanutencao = req.params.id;
    const idempresa = req.idempresa;
    const { status, observacoes } = req.body;

    if (!['aguardando', 'em_andamento', 'concluida'].includes(status)) {
      return res.status(400).json({ message: "Status inválido." });
    }

    let client;
    try {
      client = await pool.connect();
      await client.query('BEGIN');

      const dataConclusao = status === 'concluida' ? new Date() : null;
      const manutencaoResult = await client.query(
        `UPDATE equipamentomanutencao
           SET status = $1, observacoes = $2, data_conclusao = $3
           WHERE idmanutencao = $4 AND idempresa = $5
           RETURNING *`,
        [status, observacoes || null, dataConclusao, idmanutencao, idempresa]
      );

      if (!manutencaoResult.rowCount) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: "Registro de manutenção não encontrado." });
      }

      const manutencao = manutencaoResult.rows[0];
      if (status === 'concluida' && manutencao.idunidade) {
        await client.query(
          `UPDATE equipamentounidade SET status = 'estoque' WHERE idunidade = $1 AND status = 'manutencao'`,
          [manutencao.idunidade]
        );
      }

      await client.query('COMMIT');

      res.locals.acao = 'atualizou manutenção';
      res.locals.idregistroalterado = manutencao.idmanutencao;
      res.locals.idusuarioAlvo = null;
      res.locals.dadosnovos = manutencao;

      res.json({ message: "Manutenção atualizada com sucesso!", manutencao });
    } catch (error) {
      if (client) await client.query('ROLLBACK');
      console.error("Erro ao atualizar manutenção:", error);
      res.status(500).json({ message: "Erro ao atualizar manutenção." });
    } finally {
      if (client) client.release();
    }
  }
);

// ===== Dashboard =====
router.get("/dashboard", async (req, res) => {
  const idempresa = req.idempresa;

  try {
    const totaisResult = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM equipamentounidade WHERE idempresa = $1 AND status = 'estoque') AS total_estoque,
         (SELECT COUNT(*) FROM equipamentounidade WHERE idempresa = $1 AND status = 'manutencao') AS total_manutencao`,
      [idempresa]
    );

    // Conta a unidade física de verdade que está com o evento agora (status='evento'),
    // não a quantidade planejada no orçamento. Isso já resolve remanejamento sozinho:
    // a unidade só existe num lugar por vez, então uma que foi remanejada de outro
    // evento simplesmente passa a contar aqui, sem duplicar nem sumir de lugar nenhum.
    const alocadosResult = await pool.query(
      `SELECT COUNT(*) AS total_alocado
         FROM equipamentounidade
         WHERE idempresa = $1 AND status = 'evento'`,
      [idempresa]
    );

    const predestinadosResult = await pool.query(
      `SELECT COALESCE(SUM(quantidade), 0) AS total_predestinado, COUNT(*) AS qtd_itens
         FROM equipamentopredestinacao
         WHERE idempresa = $1 AND status = 'pendente'`,
      [idempresa]
    );

    res.json({
      total_estoque: Number(totaisResult.rows[0].total_estoque),
      total_manutencao: Number(totaisResult.rows[0].total_manutencao),
      total_alocado: Number(alocadosResult.rows[0].total_alocado),
      total_predestinado: Number(predestinadosResult.rows[0].total_predestinado),
      qtd_itens_predestinados: Number(predestinadosResult.rows[0].qtd_itens),
    });
  } catch (error) {
    console.error("Erro ao montar dashboard TI:", error);
    res.status(500).json({ message: "Erro ao montar dashboard." });
  }
});

// ===== Eventos ativos com equipamentos alocados =====
// Prioridade de status de orçamento pra colorir o card quando o evento tem
// mais de um orçamento ativo simultâneo: o mais "avançado" vence.
const PRIORIDADE_STATUS_ORCAMENTO = { F: 4, E: 3, P: 2, A: 1 };

function statusMaisAvancado(statusCsv) {
  const statusList = (statusCsv || "").split(",").filter(Boolean);
  if (!statusList.length) return null;
  return statusList.reduce((melhor, atual) =>
    (PRIORIDADE_STATUS_ORCAMENTO[atual] || 0) > (PRIORIDADE_STATUS_ORCAMENTO[melhor] || 0) ? atual : melhor
  );
}

router.get("/eventos-ativos", async (req, res) => {
  const idempresa = req.idempresa;
  const { filtro } = req.query; // 'abertos' (padrão) | 'finalizados' | 'todos'

  // Precisa comparar a data JÁ AGREGADA (MAX por evento), não a de cada orçamento
  // individual — filtrar antes do GROUP BY distorcia o MIN/MAX (um evento com um
  // orçamento antigo e outro futuro "perdia" a data de início antiga, empurrando
  // o intervalo pra frente e sumindo de filtros de período como semanal/mensal).
  let condicaoData = "AND MAX(o.dtfimrealizacao) >= CURRENT_DATE";
  if (filtro === 'finalizados') condicaoData = "AND MAX(o.dtfimrealizacao) < CURRENT_DATE";
  else if (filtro === 'todos') condicaoData = "";

  // Fica só na edição do ano corrente pra não pesar a busca trazendo anos antigos/futuros
  // inteiros. A partir de novembro (mês 11) libera também janeiro do ano seguinte, já que
  // nessa altura já faz sentido começar a planejar o início do próximo ano.
  const hojeFiltro = new Date();
  const anoAtualFiltro = hojeFiltro.getFullYear();
  const mesAtualFiltro = hojeFiltro.getMonth() + 1;
  let condicaoEdicao = `o.edicao = '${anoAtualFiltro}'`;
  if (mesAtualFiltro >= 11) {
    condicaoEdicao = `(o.edicao = '${anoAtualFiltro}' OR (o.edicao = '${anoAtualFiltro + 1}' AND EXTRACT(MONTH FROM o.dtinirealizacao) = 1))`;
  }

  try {
    const result = await pool.query(
      `SELECT
         ev.idevento,
         ev.nmevento,
         MIN(o.dtinirealizacao) AS dtinirealizacao,
         MAX(o.dtfimrealizacao) AS dtfimrealizacao,
         MIN(o.dtinimontagem) AS dtinimontagem,
         MAX(o.dtfimmontagem) AS dtfimmontagem,
         MAX(o.dtfimdesmontagem) AS dtfimdesmontagem,
         MIN(o.dtinirealizacao) FILTER (WHERE o.dtinirealizacao > CURRENT_DATE) AS dtinirealizacao_futura,
         STRING_AGG(DISTINCT o.status, ',') AS status_orcamentos,
         COUNT(DISTINCT oi.idequipamento) AS qtd_equipamentos_distintos,
         COALESCE(SUM(oi.qtditens), 0) AS qtd_total_alocada,
         COALESCE((
           SELECT SUM(p.quantidade) FROM equipamentopredestinacao p
             WHERE p.idevento_origem = ev.idevento AND p.status = 'pendente'
         ), 0) AS qtd_predestinada,
         COALESCE(tes.status_controle, 'incerto') AS status_controle,
         COALESCE(tes.separado, false) AS separado,
         tes.separado_em,
         tes.separado_por
       FROM orcamentoitens oi
       INNER JOIN orcamentos o ON o.idorcamento = oi.idorcamento
       INNER JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
       INNER JOIN eventos ev ON ev.idevento = o.idevento
       LEFT JOIN tieventostatus tes ON tes.idevento = ev.idevento AND tes.idempresa = oe.idempresa
       WHERE oi.idequipamento IS NOT NULL
         AND o.status <> 'R'
         AND oe.idempresa = $1
         AND ${condicaoEdicao}
       GROUP BY ev.idevento, ev.nmevento, tes.status_controle, tes.separado, tes.separado_em, tes.separado_por
       HAVING TRUE ${condicaoData}
       ORDER BY MAX(o.dtfimrealizacao) ASC`,
      [idempresa]
    );

    const hoje = new Date();
    const eventos = result.rows.map((row) => ({
      ...row,
      status_orcamento_avancado: statusMaisAvancado(row.status_orcamentos),
      finalizado: row.dtfimrealizacao ? new Date(row.dtfimrealizacao) < hoje : false,
    }));

    res.json(eventos);
  } catch (error) {
    console.error("Erro ao listar eventos ativos (TI):", error);
    res.status(500).json({ message: "Erro ao listar eventos ativos." });
  }
});

// PUT status de controle da TI (confirmado/incerto/cancelado)
router.put("/eventos/:idevento/status-controle",
  logMiddleware('TI', { buscarDadosAnteriores: async () => ({ dadosanteriores: null, idregistroalterado: null }) }),
  async (req, res) => {
    const idevento = req.params.idevento;
    const idempresa = req.idempresa;
    const { status_controle } = req.body;

    if (!['confirmado', 'incerto', 'cancelado'].includes(status_controle)) {
      return res.status(400).json({ message: "Status de controle inválido." });
    }

    try {
      const result = await pool.query(
        `INSERT INTO tieventostatus (idevento, idempresa, status_controle)
           VALUES ($1, $2, $3)
           ON CONFLICT (idevento, idempresa)
           DO UPDATE SET status_controle = $3, atualizado_em = NOW()
           RETURNING *`,
        [idevento, idempresa, status_controle]
      );

      res.locals.acao = 'atualizou status de controle do evento';
      res.locals.idregistroalterado = idevento;
      res.locals.idusuarioAlvo = null;
      res.locals.dadosnovos = result.rows[0];

      res.json({ message: "Status atualizado com sucesso!", status: result.rows[0] });
    } catch (error) {
      console.error("Erro ao atualizar status de controle do evento:", error);
      res.status(500).json({ message: "Erro ao atualizar status de controle do evento." });
    }
  }
);

// PUT marcar/desmarcar "equipamentos separados"
router.put("/eventos/:idevento/separado",
  logMiddleware('TI', { buscarDadosAnteriores: async () => ({ dadosanteriores: null, idregistroalterado: null }) }),
  async (req, res) => {
    const idevento = req.params.idevento;
    const idempresa = req.idempresa;
    const idusuario = req.usuario?.idusuario;
    const { separado } = req.body;

    try {
      const result = await pool.query(
        `INSERT INTO tieventostatus (idevento, idempresa, separado, separado_em, separado_por)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (idevento, idempresa)
           DO UPDATE SET separado = $3, separado_em = $4, separado_por = $5, atualizado_em = NOW()
           RETURNING *`,
        [idevento, idempresa, !!separado, separado ? new Date() : null, separado ? idusuario : null]
      );

      res.locals.acao = separado ? 'marcou equipamentos separados' : 'desmarcou equipamentos separados';
      res.locals.idregistroalterado = idevento;
      res.locals.idusuarioAlvo = null;
      res.locals.dadosnovos = result.rows[0];

      res.json({ message: "Atualizado com sucesso!", status: result.rows[0] });
    } catch (error) {
      console.error("Erro ao atualizar separado do evento:", error);
      res.status(500).json({ message: "Erro ao atualizar separado do evento." });
    }
  }
);

// ===== Equipamentos alocados em um evento específico (já com modelos/complementos embutidos) =====
router.get("/eventos/:idevento/equipamentos", async (req, res) => {
  const idempresa = req.idempresa;
  const idevento = req.params.idevento;

  try {
    const itensResult = await pool.query(
      `SELECT
         eq.idequip,
         eq.descEquip,
         eq.modelos,
         eq.complementos,
         oi.idorcamento,
         SUM(oi.qtditens) AS qtdorcada
       FROM orcamentoitens oi
       INNER JOIN orcamentos o ON o.idorcamento = oi.idorcamento
       INNER JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
       INNER JOIN equipamentos eq ON eq.idequip = oi.idequipamento
       WHERE o.idevento = $1
         AND o.status <> 'R'
         AND oe.idempresa = $2
         AND oi.idequipamento IS NOT NULL
       GROUP BY eq.idequip, eq.descEquip, eq.modelos, eq.complementos, oi.idorcamento`,
      [idevento, idempresa]
    );

    const predestinacoesResult = await pool.query(
      `SELECT p.*, evd.nmevento AS nmevento_destino
         FROM equipamentopredestinacao p
         LEFT JOIN eventos evd ON evd.idevento = p.idevento_destino
         WHERE p.idevento_origem = $1 AND p.idempresa = $2 AND p.status = 'pendente'`,
      [idevento, idempresa]
    );

    const predestinacoesPorEquip = {};
    predestinacoesResult.rows.forEach((p) => {
      if (!predestinacoesPorEquip[p.idequip]) predestinacoesPorEquip[p.idequip] = [];
      predestinacoesPorEquip[p.idequip].push(p);
    });

    let equipamentos = itensResult.rows.map((item) => {
      const predestinacoes = predestinacoesPorEquip[item.idequip] || [];
      const qtdpredestinada = predestinacoes.reduce((soma, p) => soma + p.quantidade, 0);
      const qtdorcada = Number(item.qtdorcada);

      return {
        idequip: item.idequip,
        descequip: item.descequip,
        idorcamento: item.idorcamento,
        qtdorcada,
        qtdpredestinada,
        qtdlivre: qtdorcada - qtdpredestinada,
        predestinacoes,
        modelos: item.modelos || [],
        complementos: item.complementos || [],
      };
    });

    equipamentos = await anexarContagemUnidades(equipamentos, idempresa);

    res.json(equipamentos);
  } catch (error) {
    console.error("Erro ao listar equipamentos do evento (TI):", error);
    res.status(500).json({ message: "Erro ao listar equipamentos do evento." });
  }
});

// ===== Checklist de separação (gerado em Python/python-docx, mesmo padrão de Proposta.py/Contrato.py) =====
router.get("/eventos/:idevento/checklist-separacao", async (req, res) => {
  const idempresa = req.idempresa;
  const idevento = req.params.idevento;

  try {
    const eventoResult = await pool.query(`SELECT nmevento FROM eventos WHERE idevento = $1`, [idevento]);
    if (!eventoResult.rowCount) {
      return res.status(404).json({ message: "Evento não encontrado." });
    }
    const nmevento = eventoResult.rows[0].nmevento;

    const itensResult = await pool.query(
      `SELECT eq.descEquip, eq.complementos, SUM(oi.qtditens) AS qtdorcada
         FROM orcamentoitens oi
         INNER JOIN orcamentos o ON o.idorcamento = oi.idorcamento
         INNER JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
         INNER JOIN equipamentos eq ON eq.idequip = oi.idequipamento
         WHERE o.idevento = $1 AND o.status <> 'R' AND oe.idempresa = $2 AND oi.idequipamento IS NOT NULL
         GROUP BY eq.idequip, eq.descEquip, eq.complementos`,
      [idevento, idempresa]
    );

    if (!itensResult.rowCount) {
      return res.status(400).json({ message: "Nenhum equipamento orçado para este evento." });
    }

    const dados = {
      nmevento,
      categorias: itensResult.rows.map((item) => ({
        descequip: item.descequip,
        qtdorcada: Number(item.qtdorcada),
        complementos: item.complementos || [],
      })),
    };

    const pythonScriptPath = path.join(__dirname, "../public/python/ChecklistSeparacao.py");
    const python = spawn("python", [pythonScriptPath]);

    let output = "";
    let errorOutput = "";

    python.stdin.write(JSON.stringify(dados));
    python.stdin.end();

    python.stdout.setEncoding("utf-8");
    python.stderr.setEncoding("utf-8");
    python.stdout.on("data", (data) => { output += data.toString(); });
    python.stderr.on("data", (data) => { errorOutput += data.toString(); });

    python.on("close", (code) => {
      if (code !== 0) {
        console.error("🐍 Erro Python ChecklistSeparacao:", errorOutput);
        return res.status(500).json({ message: "Erro ao gerar checklist (Python)", detail: errorOutput });
      }

      const filePath = output.trim();
      if (!fs.existsSync(filePath)) {
        console.error("❌ Checklist não encontrado:", filePath);
        return res.status(500).json({ message: "Arquivo do checklist não encontrado." });
      }

      const fileName = path.basename(filePath);
      res.status(200).json({
        success: true,
        message: "Checklist gerado com sucesso",
        fileUrl: `/ti/download/checklist/${encodeURIComponent(fileName)}`,
      });
    });

    python.on("error", (err) => {
      console.error("❌ Erro ao iniciar o processo Python:", err);
      res.status(500).json({ message: "Erro ao iniciar geração do checklist." });
    });
  } catch (error) {
    console.error("Erro ao preparar checklist de separação:", error);
    res.status(500).json({ message: "Erro ao preparar checklist de separação." });
  }
});

router.get("/download/checklist/:filename", async (req, res) => {
  const { filename } = req.params;

  // Evita path traversal — só aceita o nome de arquivo gerado pelo próprio script.
  if (!/^[\w\-. ]+\.docx$/.test(filename)) {
    return res.status(400).json({ message: "Nome de arquivo inválido." });
  }

  const filePath = path.join(__dirname, "..", "uploads", "Checklist", filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: "Arquivo não encontrado." });
  }

  res.download(filePath, filename, (err) => {
    if (err) {
      console.error("Erro ao enviar checklist:", err);
      res.status(500).json({ message: "Erro ao enviar arquivo." });
    }
  });
});

// ===== Predestinação de equipamentos =====
router.post("/predestinacao",
  logMiddleware('TI', {
    buscarDadosAnteriores: async () => ({ dadosanteriores: null, idregistroalterado: null })
  }),
  async (req, res) => {
    const idempresa = req.idempresa;
    const idusuario = req.usuario?.idusuario;
    const {
      idequip, idmodelo, idevento_origem, idorcamento_origem, quantidade,
      tipo_destino, idevento_destino, destino_livre, observacao
    } = req.body;

    if (!idequip || !idevento_origem || !Number.isInteger(quantidade) || quantidade <= 0) {
      return res.status(400).json({ message: "Dados obrigatórios ausentes ou inválidos." });
    }
    if (!['estoque', 'evento', 'livre'].includes(tipo_destino)) {
      return res.status(400).json({ message: "Tipo de destino inválido." });
    }
    if (tipo_destino === 'evento' && !idevento_destino) {
      return res.status(400).json({ message: "Selecione o evento de destino." });
    }
    if (tipo_destino === 'livre' && !destino_livre) {
      return res.status(400).json({ message: "Informe o destino livre." });
    }
    if (tipo_destino === 'estoque' && !idmodelo) {
      return res.status(400).json({ message: "Selecione o modelo para o qual o estoque vai voltar." });
    }

    try {
      const orcadoResult = await pool.query(
        `SELECT COALESCE(SUM(oi.qtditens), 0) AS qtdorcada
           FROM orcamentoitens oi
           INNER JOIN orcamentos o ON o.idorcamento = oi.idorcamento
           INNER JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
           WHERE o.idevento = $1 AND o.status <> 'R' AND oe.idempresa = $2 AND oi.idequipamento = $3`,
        [idevento_origem, idempresa, idequip]
      );

      const predestinadoResult = await pool.query(
        `SELECT COALESCE(SUM(quantidade), 0) AS qtdpredestinada
           FROM equipamentopredestinacao
           WHERE idevento_origem = $1 AND idempresa = $2 AND idequip = $3 AND status = 'pendente'`,
        [idevento_origem, idempresa, idequip]
      );

      const qtdorcada = Number(orcadoResult.rows[0].qtdorcada);
      const qtdpredestinada = Number(predestinadoResult.rows[0].qtdpredestinada);
      const qtdlivre = qtdorcada - qtdpredestinada;

      if (quantidade > qtdlivre) {
        return res.status(400).json({ message: `Quantidade maior que a disponível para predestinar (livre: ${qtdlivre}).` });
      }

      const insertResult = await pool.query(
        `INSERT INTO equipamentopredestinacao
           (idequip, idmodelo, idempresa, idevento_origem, idorcamento_origem, quantidade, tipo_destino, idevento_destino, destino_livre, observacao, idusuario)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING *`,
        [idequip, idmodelo || null, idempresa, idevento_origem, idorcamento_origem || null, quantidade, tipo_destino, idevento_destino || null, destino_livre || null, observacao || null, idusuario || null]
      );

      const nova = insertResult.rows[0];
      res.locals.acao = 'predestinou equipamento';
      res.locals.idregistroalterado = nova.idpredestinacao;
      res.locals.idusuarioAlvo = null;
      res.locals.dadosnovos = nova;

      res.status(201).json({ message: "Destino definido com sucesso!", predestinacao: nova });
    } catch (error) {
      console.error("Erro ao criar predestinação:", error);
      res.status(500).json({ message: "Erro ao criar predestinação." });
    }
  }
);

router.get("/predestinacao", async (req, res) => {
  const idempresa = req.idempresa;
  const { idevento, status } = req.query;

  try {
    const params = [idempresa];
    let where = "p.idempresa = $1";
    if (idevento) {
      params.push(idevento);
      where += ` AND p.idevento_origem = $${params.length}`;
    }
    if (status) {
      params.push(status);
      where += ` AND p.status = $${params.length}`;
    }

    const result = await pool.query(
      `SELECT p.*, eq.descEquip, evo.nmevento AS nmevento_origem, evd.nmevento AS nmevento_destino
         FROM equipamentopredestinacao p
         INNER JOIN equipamentos eq ON eq.idequip = p.idequip
         INNER JOIN eventos evo ON evo.idevento = p.idevento_origem
         LEFT JOIN eventos evd ON evd.idevento = p.idevento_destino
         WHERE ${where}
         ORDER BY p.criado_em DESC`,
      params
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Erro ao listar predestinações:", error);
    res.status(500).json({ message: "Erro ao listar predestinações." });
  }
});

router.put("/predestinacao/:id",
  logMiddleware('TI', {
    buscarDadosAnteriores: async (req) => {
      try {
        const result = await pool.query(
          `SELECT * FROM equipamentopredestinacao WHERE idpredestinacao = $1 AND idempresa = $2`,
          [req.params.id, req.idempresa]
        );
        const linha = result.rows[0] || null;
        return { dadosanteriores: linha, idregistroalterado: linha?.idpredestinacao || null };
      } catch (error) {
        console.error("Erro ao buscar dados anteriores da predestinação:", error);
        return { dadosanteriores: null, idregistroalterado: null };
      }
    }
  }),
  async (req, res) => {
    const idpredestinacao = req.params.id;
    const idempresa = req.idempresa;
    const { status } = req.body;

    if (!['executada', 'cancelada'].includes(status)) {
      return res.status(400).json({ message: "Status inválido." });
    }

    let client;
    try {
      client = await pool.connect();
      await client.query('BEGIN');

      const dataExecucao = status === 'executada' ? new Date() : null;
      const updateResult = await client.query(
        `UPDATE equipamentopredestinacao
           SET status = $1, executado_em = $2
           WHERE idpredestinacao = $3 AND idempresa = $4
           RETURNING *`,
        [status, dataExecucao, idpredestinacao, idempresa]
      );

      if (!updateResult.rowCount) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: "Predestinação não encontrada." });
      }

      const predestinacao = updateResult.rows[0];
      if (status === 'executada' && predestinacao.tipo_destino === 'estoque' && predestinacao.idmodelo) {
        // Cria uma unidade nova por quantidade retornada (patrimônio gerado automaticamente;
        // pode ser renomeado depois na tela de unidades).
        for (let i = 1; i <= predestinacao.quantidade; i++) {
          const patrimonioGerado = `RETORNO-P${predestinacao.idpredestinacao}-${i}`;
          await client.query(
            `INSERT INTO equipamentounidade (idequip, idmodelo, idempresa, patrimonio, status)
               VALUES ($1, $2, $3, $4, 'estoque')
               ON CONFLICT (idempresa, patrimonio) DO NOTHING`,
            [predestinacao.idequip, predestinacao.idmodelo, idempresa, patrimonioGerado]
          );
        }
      }

      await client.query('COMMIT');

      res.locals.acao = 'atualizou predestinação';
      res.locals.idregistroalterado = predestinacao.idpredestinacao;
      res.locals.idusuarioAlvo = null;
      res.locals.dadosnovos = predestinacao;

      res.json({ message: "Predestinação atualizada com sucesso!", predestinacao });
    } catch (error) {
      if (client) await client.query('ROLLBACK');
      console.error("Erro ao atualizar predestinação:", error);
      res.status(500).json({ message: "Erro ao atualizar predestinação." });
    } finally {
      if (client) client.release();
    }
  }
);

// ===== Orçamentos de compra de equipamento (Orçamentos / Aprovados / Reprovados) =====

const dirOrcamentosEquip = path.join(__dirname, "../uploads/ti/orcamentos-equipamento");
fs.mkdirSync(dirOrcamentosEquip, { recursive: true });

const storageOrcamentoEquip = multer.diskStorage({
  destination: (req, file, cb) => cb(null, dirOrcamentosEquip),
  filename: (req, file, cb) => {
    const nomeLimpo = path.parse(file.originalname).name
      .replace(/\s+/g, "")
      .replace(/[^a-zA-Z0-9]/g, "");
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${nomeLimpo}-${Date.now()}${ext}`);
  },
});

const fileFilterOrcamentoEquip = (req, file, cb) => {
  if (file.mimetype.startsWith("image/") || file.mimetype === "application/pdf") {
    cb(null, true);
  } else {
    cb(new Error("Apenas imagens e PDFs são permitidos."), false);
  }
};

const uploadOrcamentoEquip = multer({
  storage: storageOrcamentoEquip,
  fileFilter: fileFilterOrcamentoEquip,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
}).single("arquivo");

// GET lista de orçamentos por status (pendente | aprovado | reprovado)
router.get("/orcamentos-compra", async (req, res) => {
  const idempresa = req.idempresa;
  const status = ["pendente", "aprovado", "reprovado"].includes(req.query.status) ? req.query.status : "pendente";

  try {
    const result = await pool.query(
      `SELECT o.*, eq.descEquip, u.patrimonio, elem->>'marca' AS marca, elem->>'modelo' AS modelo,
              us.nome AS nome_solicitante,
              ud.nome AS nome_decisao
         FROM equipamentoorcamentocompra o
         INNER JOIN equipamentomanutencao m ON m.idmanutencao = o.idmanutencao
         INNER JOIN equipamentos eq ON eq.idequip = m.idequip
         LEFT JOIN equipamentounidade u ON u.idunidade = m.idunidade
         LEFT JOIN LATERAL jsonb_array_elements(eq.modelos) elem ON elem->>'id' = m.idmodelo
         LEFT JOIN usuarios us ON us.idusuario = o.idusuario_solicitante
         LEFT JOIN usuarios ud ON ud.idusuario = o.idusuario_decisao
         WHERE o.idempresa = $1 AND o.status = $2
         ORDER BY o.criado_em DESC`,
      [idempresa, status]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Erro ao listar orçamentos de equipamento:", error);
    res.status(500).json({ message: "Erro ao listar orçamentos de equipamento." });
  }
});

// GET sugestão de destinatários (usuários master/supremo da empresa) para o envio de aprovação
router.get("/orcamentos-compra/aprovadores-sugeridos", async (req, res) => {
  const idempresa = req.idempresa;
  try {
    const result = await pool.query(
      `SELECT DISTINCT u.email, u.nome
         FROM usuarios u
         INNER JOIN permissoes p ON p.idusuario = u.idusuario
         WHERE p.idempresa = $1 AND (p.master = true OR p.supremo = true) AND u.ativo = true AND u.email IS NOT NULL
         ORDER BY u.nome`,
      [idempresa]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Erro ao buscar aprovadores sugeridos:", error);
    res.status(500).json({ message: "Erro ao buscar aprovadores sugeridos." });
  }
});

// POST cadastrar novo orçamento de equipamento (com anexo)
router.post("/orcamentos-compra", (req, res) => {
  uploadOrcamentoEquip(req, res, async (err) => {
    if (err) return res.status(400).json({ message: err.message });

    const idempresa = req.idempresa;
    const idusuario = req.usuario?.idusuario;
    const { idmanutencao, descricao, fornecedor, valor } = req.body;

    if (!idmanutencao) return res.status(400).json({ message: "Selecione a manutenção." });
    if (!req.file) return res.status(400).json({ message: "Anexe uma imagem ou PDF do orçamento." });

    try {
      const result = await pool.query(
        `INSERT INTO equipamentoorcamentocompra
           (idmanutencao, idempresa, descricao, fornecedor, valor, arquivo, idusuario_solicitante)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [Number(idmanutencao), idempresa, descricao || null, fornecedor || null, valor || null, req.file.filename, idusuario || null]
      );

      const novo = result.rows[0];
      if (idusuario) {
        registrarLog({
          idexecutor: idusuario,
          idempresa,
          acao: 'anexou orçamento de manutenção',
          modulo: 'TI',
          idregistroalterado: novo.idorcamento,
          dadosnovos: novo,
        });
      }

      res.status(201).json({ message: "Orçamento cadastrado.", orcamento: novo });
    } catch (error) {
      console.error("Erro ao cadastrar orçamento de equipamento:", error);
      res.status(500).json({ message: "Erro ao cadastrar orçamento de equipamento." });
    }
  });
});

// POST enviar orçamentos selecionados por e-mail para aprovação (aprovar/recusar direto no link)
router.post("/orcamentos-compra/enviar-aprovacao",
  logMiddleware('TI', { buscarDadosAnteriores: async () => ({ dadosanteriores: null, idregistroalterado: null }) }),
  async (req, res) => {
    const idempresa = req.idempresa;
    const { idorcamentos, emails } = req.body;

    if (!Array.isArray(idorcamentos) || !idorcamentos.length) {
      return res.status(400).json({ message: "Selecione ao menos um orçamento." });
    }
    if (!Array.isArray(emails) || !emails.length) {
      return res.status(400).json({ message: "Informe ao menos um e-mail." });
    }

    try {
      const result = await pool.query(
        `SELECT o.*, eq.descEquip, u.patrimonio FROM equipamentoorcamentocompra o
           INNER JOIN equipamentomanutencao m ON m.idmanutencao = o.idmanutencao
           INNER JOIN equipamentos eq ON eq.idequip = m.idequip
           LEFT JOIN equipamentounidade u ON u.idunidade = m.idunidade
           WHERE o.idorcamento = ANY($1::int[]) AND o.idempresa = $2 AND o.status = 'pendente'`,
        [idorcamentos, idempresa]
      );

      if (!result.rowCount) {
        return res.status(404).json({ message: "Nenhum orçamento pendente encontrado para os itens selecionados." });
      }

      // Bloqueia o envio se o usuário ativo não tem e-mail corporativo sincronizado —
      // não existe mais fallback silencioso pra conta padrão do .env.
      const idusuarioAtivo = req.usuario?.idusuario;
      const meuEmail = idusuarioAtivo
        ? await pool.query(
            `SELECT email, senha_cifrada FROM tiemailcorporativo WHERE idusuario = $1 AND idempresa = $2 LIMIT 1`,
            [idusuarioAtivo, idempresa]
          )
        : { rowCount: 0 };

      if (!meuEmail.rowCount) {
        return res.status(400).json({
          message: "Você não possui nenhum e-mail sincronizado. Entre em contato com o pessoal do Sistema ou com os Devs pra configurar isso.",
        });
      }

      let remetente;
      try {
        remetente = {
          email: meuEmail.rows[0].email,
          senha: decifrar(meuEmail.rows[0].senha_cifrada),
          nome: req.usuario?.nomeusuario || null,
        };
      } catch (erroDecifrar) {
        console.error("Erro ao decifrar senha do e-mail do usuário ativo:", erroDecifrar);
        return res.status(500).json({ message: "Erro ao acessar o e-mail sincronizado. Entre em contato com o TI." });
      }

      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const blocosHtml = [];

      for (const o of result.rows) {
        const token = crypto.randomBytes(24).toString("hex");
        await pool.query(
          `UPDATE equipamentoorcamentocompra SET token_aprovacao = $1, enviado_email_em = NOW() WHERE idorcamento = $2`,
          [token, o.idorcamento]
        );

        const linkAprovar = `${baseUrl}/aprovacao-orcamento/${token}/aprovar`;
        const linkRecusar = `${baseUrl}/aprovacao-orcamento/${token}/recusar`;
        const arquivoUrl = `${baseUrl}/uploads/ti/orcamentos-equipamento/${o.arquivo}`;

        const valorFormatado = o.valor != null
          ? Number(o.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })
          : null;

        blocosHtml.push(`
          <div style="background:#ffffff;border:1px solid #ececec;border-left:4px solid #942123;border-radius:12px;padding:20px 22px;margin-bottom:16px;font-family:'Segoe UI',Arial,sans-serif;">
            <table role="presentation" width="100%" style="border-collapse:collapse;">
              <tr>
                <td style="vertical-align:top;">
                  <p style="margin:0 0 4px;font-size:15px;color:#1a1a1a;font-weight:700;">${o.descequip}${o.patrimonio ? ` <span style="color:#999;font-weight:400;">(${o.patrimonio})</span>` : ""}</p>
                  ${o.descricao ? `<p style="margin:0 0 10px;color:#666;font-size:13px;line-height:1.5;">${o.descricao}</p>` : ""}
                  <p style="margin:0 0 14px;color:#666;font-size:13px;">🏢 Fornecedor: <strong style="color:#333;">${o.fornecedor || "não informado"}</strong></p>
                </td>
                <td style="vertical-align:top; text-align:right; white-space:nowrap; padding-left:16px;">
                  <div style="background:#fdf1f1;border-radius:10px;padding:10px 16px;display:inline-block;">
                    <div style="font-size:10px;color:#942123;font-weight:700;text-transform:uppercase;letter-spacing:.5px;">Valor</div>
                    <div style="font-size:18px;color:#942123;font-weight:700;">${valorFormatado ? "R$ " + valorFormatado : "—"}</div>
                  </div>
                </td>
              </tr>
            </table>
            <a href="${arquivoUrl}" target="_blank" style="display:inline-block;margin-bottom:16px;color:#942123;font-size:12px;font-weight:600;text-decoration:none;border:1px solid #f0d3d3;border-radius:20px;padding:5px 14px;">📎 Ver orçamento anexado</a>
            <div>
              <a href="${linkAprovar}" style="background:#2e7d32;color:#fff;padding:11px 26px;border-radius:24px;text-decoration:none;margin-right:10px;font-weight:700;font-size:13px;display:inline-block;">✓ Aprovar</a>
              <a href="${linkRecusar}" style="background:#942123;color:#fff;padding:11px 26px;border-radius:24px;text-decoration:none;font-weight:700;font-size:13px;display:inline-block;">✕ Recusar</a>
            </div>
          </div>
        `);
      }

      const nomeSolicitante = remetente.nome || "A equipe de TI";
      const plural = result.rowCount > 1;

      const html = `
        <div style="max-width:580px;margin:0 auto;font-family:'Segoe UI',Arial,sans-serif;background:#f3f4f6;padding:24px 0;">
          <div style="background:linear-gradient(135deg,#942123,#641516);padding:26px 28px;border-radius:14px 14px 0 0;">
            <span style="color:#fff;font-weight:700;font-size:13px;letter-spacing:1px;opacity:.85;">JA SISTEMA · TI</span>
            <h1 style="color:#fff;font-size:20px;margin:8px 0 0;">Aprovação de orçamento${plural ? "s" : ""} de manutenção</h1>
          </div>
          <div style="background:#ffffff;padding:26px 28px;border:1px solid #eee;border-top:none;">
            <p style="margin:0 0 20px;font-size:14px;color:#444;line-height:1.6;">
              Olá! <strong>${nomeSolicitante}</strong> está solicitando sua aprovação pra ${plural ? `os ${result.rowCount} orçamentos` : "o orçamento"} de manutenção de equipamento abaixo. Dá uma olhada nos detalhes e responda com um clique — não precisa entrar no sistema.
            </p>
            ${blocosHtml.join("")}
          </div>
          <div style="background:#ffffff;border:1px solid #eee;border-top:none;border-radius:0 0 14px 14px;padding:16px 28px;">
            <p style="font-size:11px;color:#aaa;margin:0;">Este é um e-mail automático do sistema interno da JA Promoções. Cada link acima registra sua decisão direto, sem precisar logar em lugar nenhum.</p>
          </div>
        </div>
      `;

      await enviarEmail({ to: emails.join(","), subject: "Orçamentos de equipamento pendentes de aprovação", html, remetente });

      res.locals.acao = 'enviou orçamentos de manutenção para aprovação por e-mail';
      res.locals.idregistroalterado = result.rows[0].idorcamento;
      res.locals.dadosnovos = { idorcamentos: result.rows.map((o) => o.idorcamento), emails };

      res.json({ message: "E-mail enviado para aprovação." });
    } catch (error) {
      console.error("Erro ao enviar orçamentos para aprovação:", error);
      res.status(500).json({ message: error.message || "Erro ao enviar e-mail." });
    }
  }
);

// PUT decisão manual (aprovar/recusar) feita dentro do sistema — só master/supremo
router.put("/orcamentos-compra/:id/decisao",
  exigirFlag('master', 'supremo'),
  logMiddleware('TI', {
    buscarDadosAnteriores: async (req) => {
      try {
        const result = await pool.query(
          `SELECT * FROM equipamentoorcamentocompra WHERE idorcamento = $1 AND idempresa = $2`,
          [req.params.id, req.idempresa]
        );
        const linha = result.rows[0] || null;
        return { dadosanteriores: linha, idregistroalterado: linha?.idorcamento || null };
      } catch (error) {
        return { dadosanteriores: null, idregistroalterado: null };
      }
    }
  }),
  async (req, res) => {
    const idempresa = req.idempresa;
    const idusuario = req.usuario?.idusuario;
    const { id } = req.params;
    const { status, motivo_recusa } = req.body;

    if (!['aprovado', 'reprovado'].includes(status)) {
      return res.status(400).json({ message: "Status inválido." });
    }

    try {
      const result = await pool.query(
        `UPDATE equipamentoorcamentocompra o
           SET status = $1, motivo_recusa = $2, idusuario_decisao = $3, data_decisao = NOW(), token_aprovacao = NULL
           FROM equipamentomanutencao m
           INNER JOIN equipamentos eq ON eq.idequip = m.idequip
           WHERE o.idmanutencao = m.idmanutencao AND o.idorcamento = $4 AND o.idempresa = $5 AND o.status = 'pendente'
           RETURNING o.*, eq.descEquip`,
        [status, status === 'reprovado' ? (motivo_recusa || null) : null, idusuario, id, idempresa]
      );

      if (!result.rowCount) {
        return res.status(404).json({ message: "Orçamento não encontrado ou já decidido." });
      }

      const orcamento = result.rows[0];

      res.locals.acao = status === 'aprovado' ? 'aprovou orçamento de equipamento' : 'recusou orçamento de equipamento';
      res.locals.idregistroalterado = Number(id);
      res.locals.dadosnovos = orcamento;

      if (orcamento.idusuario_solicitante && orcamento.idusuario_solicitante !== idusuario) {
        const valorFormatado = orcamento.valor != null
          ? "R$ " + Number(orcamento.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })
          : null;
        const resumo = `${orcamento.descequip || "Equipamento"}${orcamento.fornecedor ? " — " + orcamento.fornecedor : ""}${valorFormatado ? " — " + valorFormatado : ""}`;
        criarNotificacao(orcamento.idusuario_solicitante, idempresa, {
          tipo: status === 'aprovado' ? 'sucesso' : 'erro',
          mensagem: status === 'aprovado' ? `Orçamento aprovado: ${resumo}` : `Orçamento recusado: ${resumo}`,
          metadata: { modulo: 'TI', idorcamento: orcamento.idorcamento, idmanutencao: orcamento.idmanutencao },
        }).catch((erro) => console.error("Erro ao criar notificação de decisão de orçamento:", erro));
      }

      res.json({ message: "Decisão registrada.", orcamento });
    } catch (error) {
      console.error("Erro ao registrar decisão do orçamento:", error);
      res.status(500).json({ message: "Erro ao registrar decisão do orçamento." });
    }
  }
);

// ===== E-mails corporativos (áreas + e-mails/senhas por funcionário) =====
const { cifrar, decifrar } = require("../utils/criptografia");

// GET áreas + total de e-mails de cada uma (cards do dashboard)
router.get("/emails/areas", async (req, res) => {
  const idempresa = req.idempresa;
  try {
    const result = await pool.query(
      `SELECT a.idarea, a.nome, COUNT(e.idemail)::int AS total_emails
         FROM tiarea a
         LEFT JOIN tiemailcorporativo e ON e.idarea = a.idarea AND e.idempresa = a.idempresa
         WHERE a.idempresa = $1
         GROUP BY a.idarea, a.nome
         ORDER BY a.nome ASC`,
      [idempresa]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Erro ao listar áreas de e-mail:", error);
    res.status(500).json({ message: "Erro ao listar áreas." });
  }
});

// Padrão do nome de área: primeira letra maiúscula, o resto minúsculo.
function capitalizarNomeArea(nome) {
  const limpo = nome.trim();
  return limpo ? limpo.charAt(0).toUpperCase() + limpo.slice(1).toLowerCase() : limpo;
}

// Confere se o nome do funcionário (nome completo) "contém" o nome + sobrenome do
// usuário, pra impedir vincular um e-mail ao funcionário/usuário errado (ex: funcionário
// Gustavo vinculado ao usuário da Marcia). Ignora acentos/maiúsculas.
function normalizarNome(texto) {
  return (texto || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().trim();
}

function nomesCompativeis(nomeFuncionario, nomeUsuario, sobrenomeUsuario) {
  const palavrasFunc = normalizarNome(nomeFuncionario).split(/\s+/).filter(Boolean);
  const primeiroUsuario = normalizarNome(nomeUsuario);
  const palavrasSobrenome = normalizarNome(sobrenomeUsuario).split(/\s+/).filter(Boolean);

  if (primeiroUsuario && !palavrasFunc.includes(primeiroUsuario)) return false;
  if (palavrasSobrenome.length && !palavrasSobrenome.every((p) => palavrasFunc.includes(p))) return false;
  return true;
}

// POST cadastrar área
router.post("/emails/areas",
  logMiddleware('TI', { buscarDadosAnteriores: async () => ({ dadosanteriores: null, idregistroalterado: null }) }),
  async (req, res) => {
    const idempresa = req.idempresa;
    const { nome } = req.body;
    if (!nome || !nome.trim()) return res.status(400).json({ message: "Informe o nome da área." });

    try {
      const result = await pool.query(
        `INSERT INTO tiarea (idempresa, nome) VALUES ($1, $2) RETURNING *`,
        [idempresa, capitalizarNomeArea(nome)]
      );
      res.locals.acao = 'cadastrou área de e-mail';
      res.locals.idregistroalterado = result.rows[0].idarea;
      res.locals.dadosnovos = result.rows[0];
      res.status(201).json({ message: "Área cadastrada.", area: result.rows[0] });
    } catch (error) {
      if (error.code === '23505') return res.status(400).json({ message: "Já existe uma área com esse nome." });
      console.error("Erro ao cadastrar área de e-mail:", error);
      res.status(500).json({ message: "Erro ao cadastrar área." });
    }
  }
);

// PUT renomear área
router.put("/emails/areas/:id",
  logMiddleware('TI', {
    buscarDadosAnteriores: async (req) => {
      try {
        const result = await pool.query(`SELECT * FROM tiarea WHERE idarea = $1 AND idempresa = $2`, [req.params.id, req.idempresa]);
        const linha = result.rows[0] || null;
        return { dadosanteriores: linha, idregistroalterado: linha?.idarea || null };
      } catch (error) {
        return { dadosanteriores: null, idregistroalterado: null };
      }
    }
  }),
  async (req, res) => {
    const idempresa = req.idempresa;
    const { id } = req.params;
    const { nome } = req.body;
    if (!nome || !nome.trim()) return res.status(400).json({ message: "Informe o nome da área." });

    try {
      const result = await pool.query(
        `UPDATE tiarea SET nome = $1 WHERE idarea = $2 AND idempresa = $3 RETURNING *`,
        [capitalizarNomeArea(nome), id, idempresa]
      );
      if (!result.rowCount) return res.status(404).json({ message: "Área não encontrada." });
      res.locals.acao = 'renomeou área de e-mail';
      res.locals.idregistroalterado = Number(id);
      res.locals.dadosnovos = result.rows[0];
      res.json({ message: "Área atualizada.", area: result.rows[0] });
    } catch (error) {
      if (error.code === '23505') return res.status(400).json({ message: "Já existe uma área com esse nome." });
      console.error("Erro ao renomear área de e-mail:", error);
      res.status(500).json({ message: "Erro ao renomear área." });
    }
  }
);

// DELETE área (só se não tiver e-mail nenhum vinculado)
router.delete("/emails/areas/:id",
  logMiddleware('TI', {
    buscarDadosAnteriores: async (req) => {
      try {
        const result = await pool.query(`SELECT * FROM tiarea WHERE idarea = $1 AND idempresa = $2`, [req.params.id, req.idempresa]);
        const linha = result.rows[0] || null;
        return { dadosanteriores: linha, idregistroalterado: linha?.idarea || null };
      } catch (error) {
        return { dadosanteriores: null, idregistroalterado: null };
      }
    }
  }),
  async (req, res) => {
    const idempresa = req.idempresa;
    const { id } = req.params;
    try {
      const result = await pool.query(`DELETE FROM tiarea WHERE idarea = $1 AND idempresa = $2 RETURNING idarea`, [id, idempresa]);
      if (!result.rowCount) return res.status(404).json({ message: "Área não encontrada." });
      res.locals.acao = 'removeu área de e-mail';
      res.locals.idregistroalterado = Number(id);
      res.json({ message: "Área removida." });
    } catch (error) {
      if (error.code === '23503') return res.status(400).json({ message: "Essa área tem e-mails cadastrados — remova ou mude eles de área primeiro." });
      console.error("Erro ao remover área de e-mail:", error);
      res.status(500).json({ message: "Erro ao remover área." });
    }
  }
);

// GET e-mails de uma área (senha vem decifrada — rota já é restrita a TI/supremo)
router.get("/emails", async (req, res) => {
  const idempresa = req.idempresa;
  const { idarea } = req.query;
  if (!idarea) return res.status(400).json({ message: "Informe a área." });

  try {
    const result = await pool.query(
      `SELECT e.idemail, e.idfuncionario, e.idarea, e.idusuario, e.email, e.senha_cifrada, e.criado_em, e.atualizado_em,
              f.nome AS nome_funcionario, a.nome AS nome_area,
              u.nome AS nome_usuario, u.email AS email_usuario
         FROM tiemailcorporativo e
         LEFT JOIN funcionarios f ON f.idfuncionario = e.idfuncionario
         LEFT JOIN usuarios u ON u.idusuario = e.idusuario
         INNER JOIN tiarea a ON a.idarea = e.idarea
         WHERE e.idempresa = $1 AND e.idarea = $2
         ORDER BY f.nome ASC NULLS FIRST`,
      [idempresa, idarea]
    );
    const emails = result.rows.map(({ senha_cifrada, ...resto }) => ({
      ...resto,
      senha: (() => { try { return decifrar(senha_cifrada); } catch { return null; } })(),
    }));
    res.json(emails);
  } catch (error) {
    console.error("Erro ao listar e-mails:", error);
    res.status(500).json({ message: "Erro ao listar e-mails." });
  }
});

// POST cadastrar e-mail
router.post("/emails",
  logMiddleware('TI', { buscarDadosAnteriores: async () => ({ dadosanteriores: null, idregistroalterado: null }) }),
  async (req, res) => {
    const idempresa = req.idempresa;
    const idusuarioLogado = req.usuario?.idusuario;
    const { idfuncionario, idarea, email, senha, idusuario } = req.body;

    if (!idfuncionario || !idarea || !email || !senha) {
      return res.status(400).json({ message: "Preencha funcionário, área, e-mail e senha." });
    }

    try {
      if (idusuario) {
        const func = await pool.query(`SELECT nome FROM funcionarios WHERE idfuncionario = $1`, [idfuncionario]);
        const usu = await pool.query(`SELECT nome, sobrenome FROM usuarios WHERE idusuario = $1`, [idusuario]);
        if (func.rowCount && usu.rowCount && !nomesCompativeis(func.rows[0].nome, usu.rows[0].nome, usu.rows[0].sobrenome)) {
          return res.status(400).json({ message: "O funcionário e o usuário selecionados parecem ser pessoas diferentes — confira antes de vincular." });
        }
      }

      const result = await pool.query(
        `INSERT INTO tiemailcorporativo (idempresa, idfuncionario, idarea, idusuario, email, senha_cifrada, idusuario_cadastro)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING idemail, idfuncionario, idarea, idusuario, email, criado_em`,
        [idempresa, Number(idfuncionario), Number(idarea), idusuario ? Number(idusuario) : null, email.trim(), cifrar(senha), idusuarioLogado || null]
      );
      res.locals.acao = 'cadastrou e-mail corporativo';
      res.locals.idregistroalterado = result.rows[0].idemail;
      res.locals.dadosnovos = { ...result.rows[0], senha: '(oculta no log)' };
      res.status(201).json({ message: "E-mail cadastrado.", emailCorporativo: result.rows[0] });
    } catch (error) {
      if (error.code === '23505') return res.status(400).json({ message: "Já existe um cadastro com esse e-mail." });
      console.error("Erro ao cadastrar e-mail corporativo:", error);
      res.status(500).json({ message: "Erro ao cadastrar e-mail." });
    }
  }
);

// PUT alterar senha do e-mail
router.put("/emails/:id/senha",
  logMiddleware('TI', { buscarDadosAnteriores: async () => ({ dadosanteriores: null, idregistroalterado: null }) }),
  async (req, res) => {
    const idempresa = req.idempresa;
    const { id } = req.params;
    const { senha } = req.body;
    if (!senha) return res.status(400).json({ message: "Informe a nova senha." });

    try {
      const result = await pool.query(
        `UPDATE tiemailcorporativo SET senha_cifrada = $1, atualizado_em = NOW()
           WHERE idemail = $2 AND idempresa = $3 RETURNING idemail, email`,
        [cifrar(senha), id, idempresa]
      );
      if (!result.rowCount) return res.status(404).json({ message: "E-mail não encontrado." });
      res.locals.acao = 'alterou senha de e-mail corporativo';
      res.locals.idregistroalterado = Number(id);
      res.locals.dadosnovos = { idemail: Number(id), senha: '(alterada, oculta no log)' };
      res.json({ message: "Senha atualizada.", emailCorporativo: result.rows[0] });
    } catch (error) {
      console.error("Erro ao alterar senha de e-mail corporativo:", error);
      res.status(500).json({ message: "Erro ao alterar senha." });
    }
  }
);

// PUT trocar o funcionário responsável pelo e-mail
router.put("/emails/:id/funcionario",
  logMiddleware('TI', {
    buscarDadosAnteriores: async (req) => {
      try {
        const result = await pool.query(`SELECT idemail, idfuncionario FROM tiemailcorporativo WHERE idemail = $1 AND idempresa = $2`, [req.params.id, req.idempresa]);
        const linha = result.rows[0] || null;
        return { dadosanteriores: linha, idregistroalterado: linha?.idemail || null };
      } catch (error) {
        return { dadosanteriores: null, idregistroalterado: null };
      }
    }
  }),
  async (req, res) => {
    const idempresa = req.idempresa;
    const { id } = req.params;
    const { idfuncionario } = req.body;

    try {
      if (idfuncionario) {
        const atual = await pool.query(`SELECT idusuario FROM tiemailcorporativo WHERE idemail = $1 AND idempresa = $2`, [id, idempresa]);
        if (atual.rowCount && atual.rows[0].idusuario) {
          const func = await pool.query(`SELECT nome FROM funcionarios WHERE idfuncionario = $1`, [idfuncionario]);
          const usu = await pool.query(`SELECT nome, sobrenome FROM usuarios WHERE idusuario = $1`, [atual.rows[0].idusuario]);
          if (func.rowCount && usu.rowCount && !nomesCompativeis(func.rows[0].nome, usu.rows[0].nome, usu.rows[0].sobrenome)) {
            return res.status(400).json({ message: "Esse funcionário parece ser uma pessoa diferente do usuário já vinculado a esse e-mail — confira antes de trocar." });
          }
        }
      }

      const result = await pool.query(
        `UPDATE tiemailcorporativo SET idfuncionario = $1, atualizado_em = NOW()
           WHERE idemail = $2 AND idempresa = $3 RETURNING idemail, idfuncionario, email`,
        [idfuncionario ? Number(idfuncionario) : null, id, idempresa]
      );
      if (!result.rowCount) return res.status(404).json({ message: "E-mail não encontrado." });
      res.locals.acao = 'trocou funcionário do e-mail corporativo';
      res.locals.idregistroalterado = Number(id);
      res.locals.dadosnovos = result.rows[0];
      res.json({ message: "Funcionário atualizado.", emailCorporativo: result.rows[0] });
    } catch (error) {
      console.error("Erro ao trocar funcionário do e-mail corporativo:", error);
      res.status(500).json({ message: "Erro ao trocar funcionário." });
    }
  }
);

// PUT vincular/trocar o usuário do sistema dono desse e-mail (pra futuramente enviar
// e-mails usando as credenciais do próprio usuário logado, em vez de sempre uma conta fixa)
router.put("/emails/:id/usuario",
  logMiddleware('TI', {
    buscarDadosAnteriores: async (req) => {
      try {
        const result = await pool.query(`SELECT idemail, idusuario FROM tiemailcorporativo WHERE idemail = $1 AND idempresa = $2`, [req.params.id, req.idempresa]);
        const linha = result.rows[0] || null;
        return { dadosanteriores: linha, idregistroalterado: linha?.idemail || null };
      } catch (error) {
        return { dadosanteriores: null, idregistroalterado: null };
      }
    }
  }),
  async (req, res) => {
    const idempresa = req.idempresa;
    const { id } = req.params;
    const { idusuario } = req.body;

    try {
      if (idusuario) {
        const atual = await pool.query(`SELECT idfuncionario FROM tiemailcorporativo WHERE idemail = $1 AND idempresa = $2`, [id, idempresa]);
        if (atual.rowCount && atual.rows[0].idfuncionario) {
          const func = await pool.query(`SELECT nome FROM funcionarios WHERE idfuncionario = $1`, [atual.rows[0].idfuncionario]);
          const usu = await pool.query(`SELECT nome, sobrenome FROM usuarios WHERE idusuario = $1`, [idusuario]);
          if (func.rowCount && usu.rowCount && !nomesCompativeis(func.rows[0].nome, usu.rows[0].nome, usu.rows[0].sobrenome)) {
            return res.status(400).json({ message: "Esse usuário parece ser uma pessoa diferente do funcionário já cadastrado nesse e-mail — confira antes de vincular." });
          }
        }
      }

      const result = await pool.query(
        `UPDATE tiemailcorporativo SET idusuario = $1, atualizado_em = NOW()
           WHERE idemail = $2 AND idempresa = $3 RETURNING idemail, idusuario, email`,
        [idusuario ? Number(idusuario) : null, id, idempresa]
      );
      if (!result.rowCount) return res.status(404).json({ message: "E-mail não encontrado." });
      res.locals.acao = 'vinculou usuário ao e-mail corporativo';
      res.locals.idregistroalterado = Number(id);
      res.locals.dadosnovos = result.rows[0];
      res.json({ message: "Usuário atualizado.", emailCorporativo: result.rows[0] });
    } catch (error) {
      console.error("Erro ao vincular usuário ao e-mail corporativo:", error);
      res.status(500).json({ message: "Erro ao vincular usuário." });
    }
  }
);

// DELETE remover e-mail
router.delete("/emails/:id",
  logMiddleware('TI', {
    buscarDadosAnteriores: async (req) => {
      try {
        const result = await pool.query(`SELECT idemail, email FROM tiemailcorporativo WHERE idemail = $1 AND idempresa = $2`, [req.params.id, req.idempresa]);
        const linha = result.rows[0] || null;
        return { dadosanteriores: linha, idregistroalterado: linha?.idemail || null };
      } catch (error) {
        return { dadosanteriores: null, idregistroalterado: null };
      }
    }
  }),
  async (req, res) => {
    const idempresa = req.idempresa;
    const { id } = req.params;
    try {
      const result = await pool.query(`DELETE FROM tiemailcorporativo WHERE idemail = $1 AND idempresa = $2 RETURNING idemail`, [id, idempresa]);
      if (!result.rowCount) return res.status(404).json({ message: "E-mail não encontrado." });
      res.locals.acao = 'removeu e-mail corporativo';
      res.locals.idregistroalterado = Number(id);
      res.json({ message: "E-mail removido." });
    } catch (error) {
      console.error("Erro ao remover e-mail corporativo:", error);
      res.status(500).json({ message: "Erro ao remover e-mail." });
    }
  }
);

module.exports = router;
