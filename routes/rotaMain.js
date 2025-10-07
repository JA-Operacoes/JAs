const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB");
const logMiddleware = require("../middlewares/logMiddleware");

router.get("/", async (req, res) => {
    const idempresa = req.headers.idempresa || req.query.idempresa;
    console.log("ROTA MAIN - idempresa recebido:", idempresa);

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

        // Busca todos os eventos do mês/ano informado, incluindo idevento
        const { rows: eventos } = await pool.query(`
            SELECT DISTINCT ON (e.idevento, o.dtiniinframontagem, o.dtfiminframontagem,
                               o.dtinimarcacao, o.dtfimmarcacao,
                               o.dtinimontagem, o.dtfimmontagem,
                               o.dtinirealizacao, o.dtfimrealizacao,
                               o.dtinidesmontagem, o.dtfimdesmontagem,
                               o.dtiniinfradesmontagem, o.dtfiminfradesmontagem)
                   e.idevento,
                   e.nmevento || 
                   CASE 
                       WHEN COUNT(*) OVER (PARTITION BY e.idevento, o.dtiniinframontagem, o.dtfiminframontagem,
                                           o.dtinimarcacao, o.dtfimmarcacao,
                                           o.dtinimontagem, o.dtfimmontagem,
                                           o.dtinirealizacao, o.dtfimrealizacao,
                                           o.dtinidesmontagem, o.dtfimdesmontagem,
                                           o.dtiniinfradesmontagem, o.dtfiminfradesmontagem) > 1 
                       THEN ' - ' || COALESCE(o.nomenclatura, '') 
                       ELSE '' 
                   END AS evento_nome,
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
                  (EXTRACT(YEAR FROM o.dtiniinframontagem) = $2 AND EXTRACT(MONTH FROM o.dtiniinframontagem) = $3) OR
                  (EXTRACT(YEAR FROM o.dtfiminframontagem) = $2 AND EXTRACT(MONTH FROM o.dtfiminframontagem) = $3) OR
                  (EXTRACT(YEAR FROM o.dtinimarcacao) = $2 AND EXTRACT(MONTH FROM o.dtinimarcacao) = $3) OR
                  (EXTRACT(YEAR FROM o.dtfimmarcacao) = $2 AND EXTRACT(MONTH FROM o.dtfimmarcacao) = $3) OR
                  (EXTRACT(YEAR FROM o.dtinimontagem) = $2 AND EXTRACT(MONTH FROM o.dtinimontagem) = $3) OR
                  (EXTRACT(YEAR FROM o.dtfimmontagem) = $2 AND EXTRACT(MONTH FROM o.dtfimmontagem) = $3) OR
                  (EXTRACT(YEAR FROM o.dtinirealizacao) = $2 AND EXTRACT(MONTH FROM o.dtinirealizacao) = $3) OR
                  (EXTRACT(YEAR FROM o.dtfimrealizacao) = $2 AND EXTRACT(MONTH FROM o.dtfimrealizacao) = $3) OR
                  (EXTRACT(YEAR FROM o.dtinidesmontagem) = $2 AND EXTRACT(MONTH FROM o.dtinidesmontagem) = $3) OR
                  (EXTRACT(YEAR FROM o.dtfimdesmontagem) = $2 AND EXTRACT(MONTH FROM o.dtfimdesmontagem) = $3) OR
                  (EXTRACT(YEAR FROM o.dtiniinfradesmontagem) = $2 AND EXTRACT(MONTH FROM o.dtiniinfradesmontagem) = $3) OR
                  (EXTRACT(YEAR FROM o.dtfiminfradesmontagem) = $2 AND EXTRACT(MONTH FROM o.dtfiminfradesmontagem) = $3)
                )
            ORDER BY e.idevento, o.dtiniinframontagem, o.dtinimarcacao;
        `, [idempresa, ano, mes]);

        if (!eventos || eventos.length === 0) return res.json({ eventos: [] });

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
                if (f.inicio) {
                    resposta.push({
                        idevento: ev.idevento,
                        nome: ev.evento_nome,
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
router.get("/eventos-staff", async (req, res) => {
    try {
        const idempresa = req.headers.idempresa || req.query.idempresa;
        const idevento = req.query.idevento;

        if (!idempresa) return res.status(400).json({ error: "idempresa não fornecido" });
        if (!idevento) return res.status(400).json({ error: "idevento não fornecido" });

        const { rows } = await pool.query(
            `SELECT DISTINCT
                e.nmevento,
                se.nmfuncionario AS funcionario,
                se.nmfuncao AS funcao
              FROM staffeventos se
              JOIN staffempresas sem ON se.idstaff = sem.idstaff
              JOIN eventos e ON e.idevento = se.idevento
              WHERE sem.idempresa = $1
                AND se.idevento = $2
              ORDER BY se.nmfuncionario`,
            [idempresa, idevento]
        );

        if (rows.length === 0) {
            return res.json({ staff: null });
        }

        const resposta = {
            nmevento: rows[0].nmevento,
            pessoas: rows.map(r => ({
                funcionario: r.funcionario,
                funcao: r.funcao
            }))
        };

        res.json({ staff: resposta });
    } catch (err) {
        console.error("Erro em /eventos-staff:", err);
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
// GET /main/notificacoes-financeiras
router.get('/notificacoes-financeiras', async (req, res) => {
  try {
    const idempresa = req.idempresa || req.headers.idempresa;
    const idusuario = req.usuario?.idusuario || req.headers.idusuario;

    if (!idempresa) return res.status(400).json({ error: 'Empresa não informada' });
    if (!idusuario) return res.status(400).json({ error: 'Usuário não informado' });

    // Checa se o usuário é Master no Staff via tabela de permissões
    const { rows: permissoes } = await pool.query(`
      SELECT * FROM permissoes 
      WHERE idusuario = $1 AND modulo = 'Staff' AND master = 'true'
    `, [idusuario]);
    const ehMasterStaff = permissoes.length > 0;

    // Busca logs (trazendo também status atuais da tabela staffeventos e dtfim das "ordens")
    const { rows } = await pool.query(`
      SELECT 
        l.idregistroalterado AS id,
        l.idexecutor,
        l.idusuarioalvo,
        f.nome AS nomefuncionario,
        (u.nome || ' ' || u.sobrenome) AS nomesolicitante,
        l.dadosnovos,
        l.dadosnovos->>'datasevento' AS datasevento,
        l.dadosnovos->>'vlrcaixinha' AS vlrcaixinha,
        l.dadosnovos->>'desccaixinha' AS desccaixinha,
        l.dadosnovos->>'vlrajustecusto' AS vlrajustecusto,
        l.dadosnovos->>'descajustecusto' AS descajustecusto,
        l.dadosnovos->>'datameiadiaria' AS vlrmeiadiaria,
        l.dadosnovos->>'descmeiadiaria' AS descmeiadiaria,
        l.dadosnovos->>'datadiariadobrada' AS vlrdiariadobrada,
        l.dadosnovos->>'descdiariadobrada' AS descdiariadobrada,

        -- pega o status mais atual: primeiro do staffeventos (se), senão do dadosnovos (logs)
        COALESCE(se.statuscaixinha::text, l.dadosnovos->>'statuscaixinha') AS statuscaixinha,
        COALESCE(se.statusajustecusto::text, l.dadosnovos->>'statusajustecusto') AS statusajustecusto,
        COALESCE(se.statusmeiadiaria::text, l.dadosnovos->>'statusmeiadiaria') AS statusmeiadiaria,
        COALESCE(se.statusdiariadobrada::text, l.dadosnovos->>'statusdiariadobrada') AS statusdiariadobrada,

        e.nmevento AS evento,
        -- pega dt fim conforme sua regra: prefere o.dtfiminfradesmontagem, se null usa o.dtfimdesmontagem
        COALESCE(o.dtfiminfradesmontagem, o.dtfimdesmontagem) AS dtfimrealizacao,
        l.criado_em
      FROM logs l
      LEFT JOIN funcionarios f ON f.idfuncionario = l.idusuarioalvo
      LEFT JOIN usuarios u ON u.idusuario = l.idexecutor
      LEFT JOIN eventos e ON e.idevento = NULLIF(l.dadosnovos->>'idevento','')::int
      LEFT JOIN staffeventos se ON se.idstaffevento = l.idregistroalterado

      -- <<== ATENÇÃO: substitua 'ordens' e a condição abaixo pela tabela/coluna correta do seu esquema que contém
      -- dtfiminfradesmontagem / dtfimdesmontagem. Eu usei "ordens" como exemplo.
      LEFT JOIN orcamentos o ON o.idevento = e.idevento

      WHERE l.idempresa = $1
        AND l.modulo = 'staffeventos'
        AND ($2 = TRUE OR l.idexecutor = $3)
      ORDER BY l.criado_em DESC
    `, [idempresa, ehMasterStaff, idusuario]);

    // Monta os pedidos
    const pedidos = rows.map(r => {
      let dados = {};
      try { dados = JSON.parse(r.dadosnovos); } catch { /* ignore */ }

      function parseValor(v) {
        if (!v) return 0;
        if (typeof v === 'number') return v;
        return parseFloat(String(v).replace(',', '.')) || 0;
      }

      function montarCampo(info, valorRaw, descricaoRaw, datasRaw) {
        const valor = parseValor(valorRaw);
        const descricao = descricaoRaw && descricaoRaw !== '-' ? descricaoRaw : null;
        let datas = [];
        if (datasRaw) {
          try { datas = JSON.parse(datasRaw); } catch {}
        }

        // status normalizado + cor
        let status = 'Pendente';
        let cor = '#facc15';
        if (info && typeof info === 'string') {
          const lower = info.toLowerCase();
          if (lower === 'autorizado') { status = 'Autorizado'; cor = '#16a34a'; }
          else if (lower === 'rejeitado') { status = 'Rejeitado'; cor = '#dc2626'; }
          else status = info;
        }

        if (valor > 0 || descricao || (datas && datas.length > 0)) {
          return { evento: r.evento, status, cor, valor, descricao, datas };
        }
        return null;
      }

      return {
        idpedido: r.id,
        solicitante: r.idexecutor,
        nomeSolicitante: r.nomesolicitante || '-',
        funcionario: r.nomefuncionario || dados.nmfuncionario || '-',
        evento: r.evento,
        tipopedido: 'Financeiro',
        criado_em: r.criado_em,
        datasevento: r.datasevento || dados.datasevento || '-',
        dtfimrealizacao: r.dtfimrealizacao || dados.dtfimrealizacao || null,
        quantidade: r.quantidade || dados.quantidade || 1,
        vlrtotal: parseValor(r.vlrtotal || dados.vlrtotal),
        descricao: r.desccaixinha || r.descmeiadiaria || dados.desccaixinha || dados.descmeiadiaria || '-',

        statuscaixinha: montarCampo(r.statuscaixinha || dados.statuscaixinha, r.vlrcaixinha || dados.vlrcaixinha, r.desccaixinha || dados.desccaixinha),
        statusajustecusto: montarCampo(r.statusajustecusto || dados.statusajustecusto, r.vlrajustecusto || dados.vlrAjusteCusto, r.descajustecusto || dados.descajustecusto),
        statusdiariadobrada: montarCampo(r.statusdiariadobrada || dados.statusdiariadobrada, null, r.descdiariadobrada || dados.descdiariadobrada, r.vlrdiariadobrada || dados.vlrdiariadobrada),
        statusmeiadiaria: montarCampo(r.statusmeiadiaria || dados.statusmeiadiaria, null, r.descmeiadiaria || dados.descmeiadiaria, r.vlrmeiadiaria || dados.vlrmeiadiaria)
      };
    })
    .filter(p => {
      const campos = ['statuscaixinha','statusajustecusto','statusdiariadobrada','statusmeiadiaria'];
      // mantém apenas se tiver algum campo relevante
      const temRelevancia = campos.some(c => p[c] !== null);
      if (!temRelevancia) return false;

      // se qualquer campo já está aprovado ou rejeitado -> não mostrar (regra que você pediu)
      const jaFinalizado = campos.some(c => {
        const st = p[c]?.status;
        return st && ['Autorizado','Rejeitado'].includes(String(st).toLowerCase());
      });
      if (jaFinalizado) return false;

      // se existe dtfimrealizacao, remove 2 dias após fim do evento
      if (p.dtfimrealizacao) {
        const fim = new Date(p.dtfimrealizacao);
        if (!isNaN(fim.getTime())) {
          const limite = new Date(fim);
          limite.setDate(fim.getDate() + 2);
          if (new Date() > limite) return false; // passou 2 dias depois do fim -> remove
        }
      }

      return true;
    });

    res.json(pedidos);

  } catch (err) {
    console.error('Erro ao buscar notificações financeiras:', err.stack || err);
    res.status(500).json({ error: 'Erro ao buscar notificações financeiras' });
  }
});
router.post('/notificacoes-financeiras/atualizar-status', 
  logMiddleware('main', {
    buscarDadosAnteriores: async (req) => {
      const { idpedido } = req.body;
      if (!idpedido) return { dadosanteriores: null, idregistroalterado: null };

      // 🔹 Busca os status atuais antes da atualização
      const { rows } = await pool.query(`
        SELECT statuscaixinha, statusajustecusto, statusdiariadobrada, statusmeiadiaria
        FROM staffeventos
        WHERE idstaffevento = $1
      `, [idpedido]);

      if (!rows.length) return { dadosanteriores: null, idregistroalterado: null };

      return { 
        dadosanteriores: rows[0],
        idregistroalterado: idpedido
      };
    }
  }), 
  async (req, res) => {
    try {
      const idusuario = req.usuario?.idusuario || req.headers.idusuario;
      const { idpedido, categoria, acao } = req.body; // acao = 'aprovado' ou 'rejeitado'

      if (!idusuario) return res.status(400).json({ error: 'Usuário não informado' });
      if (!idpedido || !categoria || !acao) return res.status(400).json({ error: 'Dados incompletos' });

      // 🔹 Verifica se o usuário é Master
      const { rows: permissoes } = await pool.query(`
        SELECT * FROM permissoes 
        WHERE idusuario = $1 AND modulo = 'Staff' AND master = 'true'
      `, [idusuario]);

      if (permissoes.length === 0) return res.status(403).json({ error: 'Permissão negada' });

      // 🔹 Mapeia categorias para colunas da tabela staffeventos
      const mapCategorias = {
        statuscaixinha: "statuscaixinha",
        statusajustecusto: "statusajustecusto",
        statusdiariadobrada: "statusdiariadobrada",
        statusmeiadiaria: "statusmeiadiaria"
      };

      const coluna = mapCategorias[categoria];
      if (!coluna) return res.status(400).json({ error: "Categoria inválida" });

      // 🔹 Atualiza apenas o status na coluna correta
      const { rows: updatedRows } = await pool.query(`
        UPDATE staffeventos
        SET ${coluna} = $2
        WHERE idstaffevento = $1
        RETURNING idstaffevento, statuscaixinha, statusajustecusto, statusdiariadobrada, statusmeiadiaria;
      `, [idpedido, acao]);

      if (!updatedRows.length) return res.status(404).json({ error: 'Registro não encontrado' });

      res.json({ sucesso: true, atualizado: updatedRows[0] });

    } catch (err) {
      console.error('Erro ao atualizar status do pedido:', err.stack || err);
      res.status(500).json({ error: 'Erro ao atualizar status do pedido', detalhe: err.message });
    }
});

// =======================================
// AGENDA PESSOAL DO USUÁRIO
// =======================================
router.get("/agenda", async (req, res) => {
  try {
    const idusuario = req.usuario?.idusuario || req.headers.idusuario;
    if (!idusuario) return res.status(400).json({ erro: "Usuário não informado" });

    const resultado = await pool.query(
      `SELECT * FROM agendas WHERE idusuario = $1 ORDER BY data_evento ASC`,
      [idusuario]
    );

    res.json(resultado.rows);
  } catch (err) {
    console.error("Erro ao buscar agenda:", err);
    res.status(500).json({ erro: "Erro ao buscar agenda" });
  }
});

router.post("/agenda", async (req, res) => {
  try {
    const idusuario = req.usuario?.idusuario || req.headers.idusuario;
    const { titulo, descricao, data_evento, hora_evento, tipo } = req.body;

    if (!idusuario) return res.status(400).json({ erro: "Usuário não informado" });
    if (!titulo || !data_evento)
      return res.status(400).json({ erro: "Título e data são obrigatórios" });

    const resultado = await pool.query(
      `INSERT INTO agendas (idusuario, titulo, descricao, data_evento, hora_evento, tipo)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [idusuario, titulo, descricao, data_evento, hora_evento, tipo || "Evento"]
    );

    res.status(201).json(resultado.rows[0]);
  } catch (err) {
    console.error("Erro ao salvar agenda:", err);
    res.status(500).json({ erro: "Erro ao salvar agenda" });
  }
});


router.delete("/agenda/:idagenda", async (req, res) => {
  try {
    const idusuario = req.usuario?.idusuario || req.headers.idusuario;
    const { idagenda } = req.params;

    await pool.query(
      `DELETE FROM agendas WHERE idagenda = $1 AND idusuario = $2`,
      [idagenda, idusuario]
    );

    res.json({ sucesso: true });
  } catch (err) {
    console.error("Erro ao excluir evento:", err);
    res.status(500).json({ erro: "Erro ao excluir evento" });
  }
});


module.exports = router;