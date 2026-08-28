const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB");
const logMiddleware = require('../middlewares/logMiddleware');
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

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
         WHERE fe.idempresa = $1 AND fe.ativo = true AND f.nome ILIKE $2
         ORDER BY f.nome ASC LIMIT 20`,
      [idempresa, `%${busca}%`]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Erro ao buscar funcionários (TI):", error);
    res.status(500).json({ message: "Erro ao buscar funcionários." });
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

// POST enviar modelo para manutenção
router.post("/manutencao",
  logMiddleware('TI', {
    buscarDadosAnteriores: async () => ({ dadosanteriores: null, idregistroalterado: null })
  }),
  async (req, res) => {
    const idempresa = req.idempresa;
    const idusuario = req.usuario?.idusuario;
    const { idequip, idmodelo, descricaoproblema } = req.body;

    if (!idequip || !idmodelo) {
      return res.status(400).json({ message: "idequip e idmodelo são obrigatórios." });
    }

    let client;
    try {
      client = await pool.connect();
      await client.query('BEGIN');

      const equipamentoResult = await client.query(
        `SELECT modelos FROM equipamentos WHERE idequip = $1 FOR UPDATE`,
        [idequip]
      );

      if (!equipamentoResult.rowCount) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: "Equipamento não encontrado." });
      }

      const modelos = equipamentoResult.rows[0].modelos || [];
      const indice = modelos.findIndex((m) => m.id === idmodelo);
      if (indice === -1) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: "Modelo não encontrado." });
      }

      modelos[indice] = { ...modelos[indice], status: 'manutencao' };

      const manutencaoResult = await client.query(
        `INSERT INTO equipamentomanutencao (idequip, idmodelo, idempresa, descricaoproblema, idusuario)
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [idequip, idmodelo, idempresa, descricaoproblema || null, idusuario || null]
      );

      await client.query(
        `UPDATE equipamentos SET modelos = $1::jsonb WHERE idequip = $2`,
        [JSON.stringify(modelos), idequip]
      );

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
    let where = "m.idempresa = $1";
    if (status) {
      params.push(status);
      where += ` AND m.status = $${params.length}`;
    }

    const result = await pool.query(
      `SELECT m.*, eq.descEquip, elem->>'marca' AS marca, elem->>'modelo' AS modelo
         FROM equipamentomanutencao m
         INNER JOIN equipamentos eq ON eq.idequip = m.idequip
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
      if (status === 'concluida') {
        const equipamentoResult = await client.query(
          `SELECT modelos FROM equipamentos WHERE idequip = $1 FOR UPDATE`,
          [manutencao.idequip]
        );
        if (equipamentoResult.rowCount) {
          const modelos = equipamentoResult.rows[0].modelos || [];
          const indice = modelos.findIndex((m) => m.id === manutencao.idmodelo);
          if (indice !== -1) {
            modelos[indice] = { ...modelos[indice], status: 'disponivel' };
            await client.query(
              `UPDATE equipamentos SET modelos = $1::jsonb WHERE idequip = $2`,
              [JSON.stringify(modelos), manutencao.idequip]
            );
          }
        }
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
         (SELECT COUNT(DISTINCT e.idequip) FROM equipamentos e
            INNER JOIN equipamentoempresas ee ON ee.idequip = e.idequip
            WHERE ee.idempresa = $1) AS total_equipamentos,
         (SELECT COUNT(*) FROM equipamentounidade WHERE idempresa = $1 AND status = 'estoque') AS total_estoque,
         (SELECT COUNT(*)
            FROM equipamentos e
            INNER JOIN equipamentoempresas ee ON ee.idequip = e.idequip
            LEFT JOIN LATERAL jsonb_array_elements(e.modelos) modelo ON true
            WHERE ee.idempresa = $1 AND modelo->>'status' = 'manutencao') AS total_manutencao`,
      [idempresa]
    );

    const alocadosResult = await pool.query(
      `SELECT COALESCE(SUM(oi.qtditens), 0) AS total_alocado
         FROM orcamentoitens oi
         INNER JOIN orcamentos o ON o.idorcamento = oi.idorcamento
         INNER JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
         WHERE oi.idequipamento IS NOT NULL
           AND o.status <> 'R'
           AND oe.idempresa = $1
           AND CURRENT_DATE BETWEEN o.dtinirealizacao AND o.dtfimrealizacao`,
      [idempresa]
    );

    const predestinadosResult = await pool.query(
      `SELECT COALESCE(SUM(quantidade), 0) AS total_predestinado, COUNT(*) AS qtd_itens
         FROM equipamentopredestinacao
         WHERE idempresa = $1 AND status = 'pendente'`,
      [idempresa]
    );

    res.json({
      total_equipamentos: Number(totaisResult.rows[0].total_equipamentos),
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

  let condicaoData = "AND o.dtfimrealizacao >= CURRENT_DATE";
  if (filtro === 'finalizados') condicaoData = "AND o.dtfimrealizacao < CURRENT_DATE";
  else if (filtro === 'todos') condicaoData = "";

  try {
    const result = await pool.query(
      `SELECT
         ev.idevento,
         ev.nmevento,
         MIN(o.dtinirealizacao) AS dtinirealizacao,
         MAX(o.dtfimrealizacao) AS dtfimrealizacao,
         MIN(o.dtinimontagem) AS dtinimontagem,
         MAX(o.dtfimmontagem) AS dtfimmontagem,
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
         ${condicaoData}
       GROUP BY ev.idevento, ev.nmevento, tes.status_controle, tes.separado, tes.separado_em, tes.separado_por
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

module.exports = router;
