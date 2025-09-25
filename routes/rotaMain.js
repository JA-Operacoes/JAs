const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB");

router.get("/", async (req, res) => {
    const idempresa = req.headers.idempresa || req.query.idempresa;
    console.log("idempresa recebido:", idempresa);

    // Total de orçamentos
    const { rows: orcamentosTotal } = await pool.query(
        `SELECT COUNT(*)::int AS total
         FROM orcamentos o
         JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
         WHERE oe.idempresa = $1`, [idempresa]
    );

    // Orçamentos abertos (status = 'A')
    const { rows: orcamentosAbertos } = await pool.query(
        `SELECT COUNT(*)::int AS total
         FROM orcamentos o
         JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
         WHERE oe.idempresa = $1 AND o.status = 'A'`, [idempresa]
    );

    // Orçamentos fechados (status = 'F')
    const { rows: orcamentosFechados } = await pool.query(
        `SELECT COUNT(*)::int AS total
         FROM orcamentos o
         JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
         WHERE oe.idempresa = $1 AND o.status = 'F'`, [idempresa]
    );

    // ... (demais queries para eventos, clientes, etc)

    res.json({
        orcamentos: orcamentosTotal[0].total,
        orcamentosAbertos: orcamentosAbertos[0].total,
        orcamentosFechados: orcamentosFechados[0].total,
        // eventos, clientes, pedidos, pedidosPendentes...
    });
});

router.get("/proximo-evento", async (req, res) => {
    try {
        const idempresa = req.headers.idempresa || req.query.idempresa;
        if (!idempresa) return res.status(400).json({ error: "idempresa não fornecido" });

        // Busca todos os eventos da empresa nos próximos 5 dias (inclusive hoje)
        const { rows: eventos } = await pool.query(
            `SELECT e.nmevento, o.dtinimontagem
            FROM orcamentos o
            JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
            JOIN eventos e ON e.idevento = o.idevento
            WHERE oe.idempresa = $1
              AND o.dtinimontagem >= CURRENT_DATE
              AND o.dtinimontagem <= CURRENT_DATE + INTERVAL '5 days'
            ORDER BY o.dtinimontagem`,
            [idempresa]
        );

        if (!eventos || eventos.length === 0) {
            return res.json({ eventos: [] });
        }

        // Monta resposta agrupando por data para facilitar o frontend
        const eventosPorData = {};
        eventos.forEach(ev => {
            const dataStr = ev.dtinimontagem.toISOString().split("T")[0]; // "YYYY-MM-DD"
            if (!eventosPorData[dataStr]) eventosPorData[dataStr] = [];
            eventosPorData[dataStr].push({ nmevento: ev.nmevento, data: ev.dtinimontagem });
        });

        // Flatten em um array para o frontend processar
        const respostaFormatada = [];
        Object.keys(eventosPorData).sort().forEach(data => {
            eventosPorData[data].forEach(ev => respostaFormatada.push(ev));
        });

        res.json({ eventos: respostaFormatada });

    } catch (err) {
        console.error("Erro em /proximo-evento:", err);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

router.get("/eventos-calendario", async (req, res) => {
    try {
        const idempresa = req.headers.idempresa || req.query.idempresa;
        const ano = req.query.ano;
        const mes = req.query.mes;

        if (!idempresa) return res.status(400).json({ error: "idempresa não fornecido" });
        if (!ano || !mes) return res.status(400).json({ error: "ano e mes são obrigatórios" });

        // Busca todos os eventos do mês/ano informado
        const { rows: eventos } = await pool.query(
            `SELECT 
                e.nmevento, 
                o.dtiniinframontagem, o.dtfiminframontagem,
                o.dtinimarcacao, o.dtfimmarcacao,
                o.dtinimontagem, o.dtfimmontagem,
                o.dtinirealizacao, o.dtfimrealizacao,
                o.dtinidesmontagem, o.dtfimdesmontagem,
                o.dtiniinfradesmontagem, o.dtfiminfradesmontagem
            FROM orcamentos o
            JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
            JOIN eventos e ON e.idevento = o.idevento
            WHERE oe.idempresa = $1
              AND (
                    -- Montagem Infra
                    (EXTRACT(YEAR FROM o.dtiniinframontagem) = $2 AND EXTRACT(MONTH FROM o.dtiniinframontagem) = $3) OR
                    (EXTRACT(YEAR FROM o.dtfiminframontagem) = $2 AND EXTRACT(MONTH FROM o.dtfiminframontagem) = $3) OR
                    
                    -- Marcação
                    (EXTRACT(YEAR FROM o.dtinimarcacao) = $2 AND EXTRACT(MONTH FROM o.dtinimarcacao) = $3) OR
                    (EXTRACT(YEAR FROM o.dtfimmarcacao) = $2 AND EXTRACT(MONTH FROM o.dtfimmarcacao) = $3) OR
                    
                    -- Montagem
                    (EXTRACT(YEAR FROM o.dtinimontagem) = $2 AND EXTRACT(MONTH FROM o.dtinimontagem) = $3) OR
                    (EXTRACT(YEAR FROM o.dtfimmontagem) = $2 AND EXTRACT(MONTH FROM o.dtfimmontagem) = $3) OR
                    
                    -- Realização
                    (EXTRACT(YEAR FROM o.dtinirealizacao) = $2 AND EXTRACT(MONTH FROM o.dtinirealizacao) = $3) OR
                    (EXTRACT(YEAR FROM o.dtfimrealizacao) = $2 AND EXTRACT(MONTH FROM o.dtfimrealizacao) = $3) OR
                    
                    -- Desmontagem
                    (EXTRACT(YEAR FROM o.dtinidesmontagem) = $2 AND EXTRACT(MONTH FROM o.dtinidesmontagem) = $3) OR
                    (EXTRACT(YEAR FROM o.dtfimdesmontagem) = $2 AND EXTRACT(MONTH FROM o.dtfimdesmontagem) = $3) OR
                    
                    -- Desmontagem Infra
                    (EXTRACT(YEAR FROM o.dtiniinfradesmontagem) = $2 AND EXTRACT(MONTH FROM o.dtiniinfradesmontagem) = $3) OR
                    (EXTRACT(YEAR FROM o.dtfiminfradesmontagem) = $2 AND EXTRACT(MONTH FROM o.dtfiminfradesmontagem) = $3)
                )
            ORDER BY o.dtinimontagem;`,
            [idempresa, ano, mes]
        );

        if (!eventos || eventos.length === 0) {
            return res.json({ eventos: [] });
        }

        const resposta = [];

        eventos.forEach(ev => {
            const fases = [
                { tipo: "Montagem Infra", inicio: ev.dtiniinframontagem, fim: ev.dtfiminframontagem },
                { tipo: "Marcação",        inicio: ev.dtinimarcacao,  fim: ev.dtfimmarcacao },
                { tipo: "Montagem",        inicio: ev.dtinimontagem,  fim: ev.dtfimmontagem },
                { tipo: "Realização",      inicio: ev.dtinirealizacao, fim: ev.dtfimrealizacao },
                { tipo: "Desmontagem",     inicio: ev.dtinidesmontagem, fim: ev.dtfimdesmontagem },
                { tipo: "Desmontagem Infra", inicio: ev.dtiniinfradesmontagem, fim: ev.dtfiminfradesmontagem },
            ];

            fases.forEach(f => {
                if (f.inicio) { // só adiciona se tiver data
                    resposta.push({
                        nome: ev.nmevento,
                        inicio: f.inicio.toISOString().split("T")[0],
                        fim: f.fim ? f.fim.toISOString().split("T")[0] : f.inicio.toISOString().split("T")[0],
                        tipo: f.tipo
                    });
                }
            });
        });

        res.json({ eventos: resposta });

    } catch (err) {
        console.error("Erro em /eventos-calendario:", err);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

router.get("/atividades-recentes", async (req, res) => {
    try {
        const idexecutor = req.headers.idexecutor || req.query.idexecutor;
        if (!idexecutor) {
            return res.status(400).json({ error: "Executor não informado" });
        }

        const { rows } = await pool.query(
            `SELECT acao, modulo, idregistroalterado, dadosanteriores, dadosnovos, criado_em
            FROM logs
            WHERE idexecutor = $1
            ORDER BY criado_em DESC`,
            [idexecutor]
        );

        res.json(rows);
    } catch (err) {
        console.error("Erro ao buscar atividades recentes:", err);
        res.status(500).json({ error: "Erro ao buscar atividades" });
    }
});

// routes/rotaMain.js
router.get('/notificacoes-financeiras', async (req, res) => {
  try {
    const idempresa = req.idempresa || req.headers.idempresa;
    if (!idempresa) return res.status(400).json({ error: 'Empresa não informada' });

    // Busca logs do módulo staffeventos e traz o nome do funcionário via JOIN
    const { rows } = await pool.query(`
      SELECT 
        l.idregistroalterado AS id,
        l.idexecutor,
        l.idusuarioalvo,
        f.nome AS nomefuncionario,
        l.dadosnovos,
        -- Extrai valores direto do JSON
        l.dadosnovos->>'datasevento'      AS datasevento,
        l.dadosnovos->>'quantidade'       AS quantidade,
        l.dadosnovos->>'vlrtotal'         AS vlrtotal,
        l.dadosnovos->>'vlrcache'         AS vlrcache,
        l.dadosnovos->>'vlrcaixinha'      AS vlrcaixinha,
        l.dadosnovos->>'desccaixinha'     AS desccaixinha,
        l.dadosnovos->>'vlrajustecusto'   AS vlrajustecusto,
        l.dadosnovos->>'descajustecusto'  AS descajustecusto,
        l.dadosnovos->>'datameiadiaria'    AS vlrmeiadiaria,
        l.dadosnovos->>'descmeiadiaria'   AS descmeiadiaria,
        l.dadosnovos->>'datadiariadobrada' AS vlrdiariadobrada,
        l.dadosnovos->>'descdiariadobrada' AS descdiariadobrada,
        l.dadosnovos->>'statuspgto'       AS statuspgto,
        l.dadosnovos->>'statuscaixinha'   AS statuscaixinha,
        l.dadosnovos->>'statusajustecusto' AS statusajustecusto,
        l.dadosnovos->>'statusmeiadiaria'  AS statusmeiadiaria,
        l.dadosnovos->>'statusdiariadobrada' AS statusdiariadobrada,
        l.criado_em
      FROM logs l
      LEFT JOIN funcionarios f 
        ON f.idfuncionario = l.idusuarioalvo
      WHERE l.idempresa = $1
        AND l.idexecutor = $1
        AND l.modulo = 'staffeventos'
      ORDER BY l.criado_em DESC
    `, [idempresa]);

    const pedidos = rows.map(r => {
      let dados;
      try {
        dados = JSON.parse(r.dadosnovos);
      } catch {
        dados = {};
      }

      // Função para converter string monetária "180,00" em número
      function parseValor(v) {
        if (!v) return 0;
        if (typeof v === 'number') return v;
        return parseFloat(v.toString().replace(',', '.')) || 0;
      }

      return {
        idpedido: r.id,
        solicitante: r.idexecutor,
        funcionario: r.nomefuncionario || dados.nmfuncionario || '-',
        tipopedido: 'Financeiro',
        criado_em: r.criado_em,
        datas: r.datasevento || dados.datasevento || '-',
        quantidade: r.quantidade || dados.quantidade || 1,
        descricao: r.desccaixinha || r.descmeiadiaria || dados.desccaixinha || dados.descmeiadiaria || '-',
        vlrtotal: parseValor(r.vlrtotal || dados.vlrtotal),

        // Status individuais com valor e descrição
        statuspgto: {
          status: r.statuspgto || dados.statuspgto || 'Pendente',
          valor: parseValor(r.vlrcache || dados.vlrcache),
          descricao: dados.descpgto || '-'
        },
        statuscaixinha: {
          status: r.statuscaixinha || dados.statuscaixinha || 'Pendente',
          valor: parseValor(r.vlrcaixinha || dados.vlrcaixinha),
          descricao: r.desccaixinha || dados.desccaixinha || '-'
        },
        statusajustecusto: {
          status: r.statusajustecusto || dados.statusajustecusto || 'Pendente',
          valor: parseValor(r.vlrajustecusto || dados.vlrajustecusto),
          descricao: r.descajustecusto || dados.descajustecusto || '-'
        },
        statusdiariadobrada: {
        status: r.statusdiariadobrada || dados.statusdiariadobrada || 'Pendente',
        datas: (() => {
          try {
            return JSON.parse(r.vlrdiariadobrada || dados.vlrdiariadobrada || '[]');
          } catch {
            return [];
          }
        })(),
        descricao: r.descdiariadobrada || dados.descdiariadobrada || '-'
      },
      statusmeiadiaria: {
        status: r.statusmeiadiaria || dados.statusmeiadiaria || 'Pendente',
        datas: (() => {
          try {
            return JSON.parse(r.vlrmeiadiaria || dados.vlrmeiadiaria || '[]');
          } catch {
            return [];
          }
        })(),
        descricao: r.descmeiadiaria || dados.descmeiadiaria || '-'
      },

      };
    });

    res.json(pedidos);

  } catch (err) {
    console.error('Erro ao buscar notificações financeiras:', err.stack || err);
    res.status(500).json({ error: 'Erro ao buscar notificações financeiras' });
  }
});

/**
 * POST /notificacoes-financeiras/:id/aprovar
 * Aprova um pedido financeiro.
 * Exige permissão 'financeiro' ou 'master' no req.usuario.permissoes (ajuste conforme seu middleware).
 */
// Aprovar pedido financeiro
router.post('/notificacoes-financeiras/:id/aprovar', async (req, res) => {
  try {
    const idpedido = parseInt(req.params.id, 10);
    if (isNaN(idpedido)) return res.status(400).json({ error: 'ID inválido' });

    const idempresa = req.headers.idempresa || req.body.idempresa || req.idempresa;
    if (!idempresa) return res.status(400).json({ error: 'Empresa não informada' });

    const idusuarioLogado = (req.usuario && req.usuario.idusuario) || (req.user && req.user.id);
    if (!idusuarioLogado) return res.status(401).json({ error: 'Usuário não autenticado' });

    const permissoes = (req.usuario && req.usuario.permissoes) || [];
    if (!permissoes.includes('financeiro') && !permissoes.includes('master')) {
      return res.status(403).json({ error: 'Sem permissão para aprovar' });
    }

    const qUpdate = `
      UPDATE pedidos_financeiros
      SET status = 'autorizado',
          aprovado_por = $1,
          aprovado_em = NOW()
      WHERE id = $2 AND idempresa = $3
      RETURNING id
    `;
    const { rowCount, rows } = await pool.query(qUpdate, [idusuarioLogado, idpedido, idempresa]);

    if (rowCount === 0) return res.status(404).json({ error: 'Pedido não encontrado' });

    return res.json({ ok: true, idpedido: rows[0].id });

  } catch (err) {
    console.error('Erro ao aprovar pedido financeiro:', err.stack || err);
    return res.status(500).json({ error: 'Erro ao aprovar pedido' });
  }
});

// Rejeitar pedido financeiro
router.post('/notificacoes-financeiras/:id/rejeitar', async (req, res) => {
  try {
    const idpedido = parseInt(req.params.id, 10);
    if (isNaN(idpedido)) return res.status(400).json({ error: 'ID inválido' });

    const idempresa = req.headers.idempresa || req.body.idempresa || req.idempresa;
    if (!idempresa) return res.status(400).json({ error: 'Empresa não informada' });

    const idusuarioLogado = (req.usuario && req.usuario.idusuario) || (req.user && req.user.id);
    if (!idusuarioLogado) return res.status(401).json({ error: 'Usuário não autenticado' });

    const permissoes = (req.usuario && req.usuario.permissoes) || [];
    if (!permissoes.includes('financeiro') && !permissoes.includes('master')) {
      return res.status(403).json({ error: 'Sem permissão para rejeitar' });
    }

    const motivo = req.body.motivo || null;

    const qUpdate = `
      UPDATE pedidos_financeiros
      SET status = 'recusado',
          rejeitado_por = $1,
          rejeitado_em = NOW(),
          motivo_rejeicao = $4
      WHERE id = $2 AND idempresa = $3
      RETURNING id
    `;
    const { rowCount, rows } = await pool.query(qUpdate, [idusuarioLogado, idpedido, idempresa, motivo]);

    if (rowCount === 0) return res.status(404).json({ error: 'Pedido não encontrado' });

    return res.json({ ok: true, idpedido: rows[0].id });

  } catch (err) {
    console.error('Erro ao rejeitar pedido financeiro:', err.stack || err);
    return res.status(500).json({ error: 'Erro ao rejeitar pedido' });
  }
});


module.exports = router;