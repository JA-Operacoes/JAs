const express = require('express');
const router = express.Router();
const svc = require('../src/services/NotificacaoServices.js');
const pool = require('../db');
const { autenticarToken, contextoEmpresa } = require('../middlewares/authMiddlewares');

// ─────────────────────────────────────────────
// GET /notificacoes
// ─────────────────────────────────────────────
router.get('/', autenticarToken(), async (req, res) => {
  try {
    const idusuario = req.usuario.idusuario;
    const { apenasNaoLidas, status } = req.query;

    const [todasNotificacoes, naoLidas] = await Promise.all([
      svc.buscarNotificacoes(idusuario, { apenasNaoLidas: apenasNaoLidas === 'true' }),
      svc.contarNaoLidas(idusuario),
    ]);

    let notificacoes = todasNotificacoes.filter(n => n.idreferencia === null);

    if (status && status !== 'Todas') {
      const mapStatus = {
        'Pendente':   ['Pendente'],
        'Aprovada':   ['Autorizado', 'Aprovado'],
        'Recusada':   ['Rejeitado', 'Recusado'],
        'Finalizado': ['Finalizado'],
        'Vencidos':   ['Vencidos'],
      };
      const statusPermitidos = mapStatus[status] || [];
      notificacoes = notificacoes.filter(n =>
        statusPermitidos.some(s => s.toLowerCase() === (n.status || '').toLowerCase())
      );
    }

    res.json({ notificacoes, naoLidas });
  } catch (err) {
    console.error('Erro ao buscar notificações:', err);
    res.status(500).json({ error: 'Erro ao buscar notificações' });
  }
});

// ─────────────────────────────────────────────
// PATCH /notificacoes/:id/lida
// ─────────────────────────────────────────────
router.patch('/:id/lida', autenticarToken(), async (req, res) => {
  try {
    const idusuario = req.usuario.idusuario;
    const { id } = req.params;
    await svc.marcarComoLida(idusuario, id);
    res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao marcar como lida:', err);
    res.status(500).json({ error: 'Erro ao marcar notificação' });
  }
});

// ─────────────────────────────────────────────
// PATCH /notificacoes/todas-lidas
// ─────────────────────────────────────────────
router.patch('/todas-lidas', autenticarToken(), async (req, res) => {
  try {
    const idusuario = req.usuario.idusuario;
    await svc.marcarTodasComoLidas(idusuario);
    res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao marcar todas como lidas:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ─────────────────────────────────────────────
// GET /notificacoes/agenda-notificacao
// ─────────────────────────────────────────────
router.get('/agenda-notificacao', autenticarToken(), async (req, res) => {
  try {
    const idusuario = req.usuario.idusuario;
    const agora = new Date();
    const horaAtual = agora.getHours();
    const diaDaSemana = agora.getDay();

    let sql = `
      SELECT a.idagenda, a.titulo, a.hora_evento, a.data_evento, a.tipo, n.lido, a.criado_em, 'hoje' as quando
      FROM agendas a
      LEFT JOIN notificacao n ON n.idusuario = a.idusuario AND n.idreferencia = a.idagenda
      WHERE a.idusuario = $1 
        AND a.data_evento = CURRENT_DATE
        AND a.hora_evento BETWEEN (CURRENT_TIME - INTERVAL '1 minutes') AND (CURRENT_TIME + INTERVAL '1 hour')
    `;

    if (horaAtual >= 18) {
      let intervalo = "'1 day'";
      if (diaDaSemana === 5) intervalo = "'3 days'";

      sql += `
        UNION ALL
        SELECT a.idagenda, a.titulo, a.hora_evento, a.data_evento, a.tipo, n.lido, a.criado_em, 'futuro' as quando
        FROM agendas a
        LEFT JOIN notificacao n ON n.idusuario = a.idusuario AND n.idreferencia = a.idagenda
        WHERE a.idusuario = $1 
          AND a.data_evento > CURRENT_DATE 
          AND a.data_evento <= CURRENT_DATE + INTERVAL ${intervalo}
      `;
    }

    sql += ` ORDER BY hora_evento ASC`;

    const agendaRaw = await pool.query(sql, [idusuario]);

    const lembretes = agendaRaw.rows.map(evento => {
      const config = {
        'Reunião':  { icon: 'groups_2',        type: 'danger' },
        'Evento':   { icon: 'event_available', type: 'info' },
        'Lembrete': { icon: 'priority_high',   type: 'warning' },
        'Anotação': { icon: 'text_ad',         type: 'info' }
      };
      const configRead = {
        false: { iconRead: 'check_small', typeRead: 'danger' },
        true:  { iconRead: 'done_all',    typeRead: 'success' }
      };

      const tipoDb = evento.tipo || 'Evento';
      const { icon, type } = config[tipoDb] || { icon: 'calendar_today', type: 'warning' };
      const statusLido = evento.lido === true;
      const { iconRead, typeRead } = configRead[statusLido];
      const prefixo = evento.quando === 'futuro' ? 'AMANHÃ' : tipoDb.toUpperCase();

      return {
        id: `agenda-${evento.idagenda}`,
        type,
        icon,
        message: `${prefixo}: ${evento.titulo} às ${evento.hora_evento.substring(0, 5)}`,
        read: statusLido,
        ficticio: true,
        created_at: evento.criado_em || agora,
        typeRead,
        iconRead,
        quando: evento.quando,
        status: 'Pendente',
      };
    });

    res.json(lembretes);
  } catch (err) {
    console.error('Erro na agenda fictícia:', err);
    res.status(500).json([]);
  }
});

// ─────────────────────────────────────────────
// GET /notificacoes/solicitacoes-notificacao
// ─────────────────────────────────────────────
router.get('/solicitacoes-notificacao', autenticarToken(), async (req, res) => {
  try {
    const idempresa = req.idempresa;
    const idusuario = req.usuario?.idusuario;

    const { rows: allPermissoes } = await pool.query(
      `SELECT modulo, master, supremo FROM permissoes WHERE idusuario = $1`,
      [idusuario]
    );

    const ehMasterStaff  = allPermissoes.some(p => p.modulo === 'Staff' && (p.master === true || p.master === 'true'));
    const ehSupremoStaff = allPermissoes.some(p => p.modulo === 'Staff' && (p.supremo === true || p.supremo === 'true'));
    const temAcessoTotal = ehMasterStaff || ehSupremoStaff;

    let sqlBase = `
      SELECT 
        MIN(s.idsolicitacao)                                         AS idsolicitacao,
        s.tiposolicitacao,
        s.idusuariosolicitante,
        s.idfuncionario,                                                
        s.status,                        
        (u.nome || ' ' || u.sobrenome)            AS funcionario,
        (f.nome)                                  AS nomefuncionario,   
        o.idorcamento,
        e.nmevento                                AS evento,           
        COUNT(s.idsolicitacao)                    AS total_solicitacoes,
        MIN(s.dtsolicitacao)                      AS dtsolicitacao,
        MAX(s.dtresposta)                         AS dtresposta,
        to_char(MIN(s.dtsolicitada[1]), 'DD/MM/YYYY') AS dt_inicio,
        to_char(MAX(s.dtsolicitada[1]), 'DD/MM/YYYY') AS dt_fim,
        array_agg(to_char(s.dtsolicitada[1], 'DD/MM/YYYY') ORDER BY s.dtsolicitada[1] ASC) AS datas_solicitadas,
        json_agg(
            json_build_object(
                'idsolicitacao', s.idsolicitacao,
                'status',        s.status,
                'dtsolicitada',  s.dtsolicitada[1]::date,
                'dtresposta',    s.dtresposta
            )
            ORDER BY s.dtsolicitada[1] ASC
        ) AS solicitacoes_agrupadas,
        COALESCE(bool_and(notif.lido), false)     AS ja_lido
    FROM solicitacoes s
    LEFT JOIN usuarios u      ON s.idusuariosolicitante = u.idusuario
    LEFT JOIN funcionarios f  ON s.idfuncionario = f.idfuncionario    
    LEFT JOIN orcamentos o    ON s.idorcamento = o.idorcamento         
    LEFT JOIN eventos e       ON o.idevento = e.idevento               
    LEFT JOIN notificacao notif ON notif.idreferencia = s.idsolicitacao AND notif.idusuario = $1
    WHERE s.idempresa = $2
    `;

    let params = [idusuario, idempresa];
    let finalSql = '';

    if (temAcessoTotal) {
      finalSql = `${sqlBase} AND (s.status = 'Pendente' OR s.dtresposta > NOW() - INTERVAL '24 hours')`;
    } else {
      finalSql = `${sqlBase} AND s.idusuariosolicitante = $3 AND (s.status = 'Pendente' OR s.dtresposta > NOW() - INTERVAL '24 hours')`;
      params.push(idusuario);
    }

    finalSql += `
      GROUP BY 
          s.tiposolicitacao,
          s.idusuariosolicitante,
          s.idfuncionario,             
          s.status,
          u.nome, u.sobrenome,
          f.nome,          
          o.idorcamento,      
          e.nmevento             
      ORDER BY COALESCE(MAX(s.dtresposta), MIN(s.dtsolicitacao)) DESC
    `;

    const result = await pool.query(finalSql, params);

    const configStatus = {
      'pendente':   { icon: 'pending_actions', type: 'warning' },
      'autorizado': { icon: 'check_circle',    type: 'success' },
      'rejeitado':  { icon: 'block',           type: 'danger'  }
    };

    const listaFormatada = result.rows.map(sol => {
      const statusLower = (sol.status || 'pendente').toLowerCase();
      const tipoDb = sol.tiposolicitacao || 'Solicitação';

      const statusNormalizado = (() => {
        if (statusLower === 'pendente')                                  return 'Pendente';
        if (statusLower === 'autorizado' || statusLower === 'aprovado')  return 'Aprovada';
        if (statusLower === 'rejeitado'  || statusLower === 'recusado')  return 'Recusada';
        if (statusLower === 'finalizado')                                 return 'Finalizado';
        return 'Pendente';
      })();

      const { icon: iconStatus, type } = configStatus[statusLower] || configStatus['pendente'];
      const statusLido = sol.ja_lido === true;
      const { iconRead, typeRead } = statusLido
        ? { iconRead: 'done_all',    typeRead: 'success' }
        : { iconRead: 'check_small', typeRead: 'danger'  };

      const periodoStr = sol.dt_inicio === sol.dt_fim
        ? sol.dt_inicio
        : `${sol.dt_inicio} até ${sol.dt_fim}`;

      const base = {
        id: `sol-${sol.idsolicitacao}`,
        type,
        icon: iconStatus,
        created_at: sol.dtresposta || sol.dtsolicitacao,
        read: statusLido,
        ficticio: true,
        iconRead,
        typeRead,
        status: statusNormalizado,
        solicitacoes_agrupadas: sol.solicitacoes_agrupadas,
        total_solicitacoes: sol.total_solicitacoes,
        periodoStr,
      };

      if (temAcessoTotal) {
        return {
          ...base,
          message: statusLower === 'pendente'
            ? `Nova Solicitação: ${tipoDb}`
            : `Solicitação ${sol.status}: ${tipoDb}`,
          subtext: `Solicitante: ${sol.funcionario} · ${sol.nomefuncionario} · ${sol.evento} · ${periodoStr}`,
        };
      } else {
        return {
          ...base,
          message: statusLower === 'pendente'
            ? `Sua Solicitação: ${tipoDb}`
            : `Solicitação ${sol.status}: ${tipoDb}`,
          subtext: `${sol.nomefuncionario} - ${statusLower === 'pendente' ? 'aguarda resposta' : 'foi ' + statusLower} · ${periodoStr}`,
        };
      }
    });

    res.json(listaFormatada);
  } catch (err) {
    console.error('Erro ao processar solicitações:', err.message, err.hint, err.detail);
    res.status(500).json([]);
  }
});

// ─────────────────────────────────────────────
// GET /notificacoes/inclusao-orcamentos-notificacao
// ─────────────────────────────────────────────
router.get('/inclusao-orcamentos-notificacao', autenticarToken(), async (req, res) => {
  try {
    const idempresa = req.idempresa;
    const idusuario = req.usuario?.idusuario;

    const { rows: allPermissoes } = await pool.query(
      `SELECT modulo, master, supremo, comercial FROM permissoes WHERE idusuario = $1`,
      [idusuario]
    );

    const ehMasterStaff        = allPermissoes.some(p => p.modulo === 'Staff'      && (p.master === true    || p.master === 'true'));
    const ehSupremoStaff       = allPermissoes.some(p => p.modulo === 'Staff'      && (p.supremo === true   || p.supremo === 'true'));
    const ehComercialOrcamento = allPermissoes.some(p => p.modulo === 'Orcamentos' && (p.comercial === true || p.comercial === 'true'));
    const temAcessoTotal = ehMasterStaff || ehSupremoStaff || ehComercialOrcamento;

    if (!temAcessoTotal) return res.status(200).json([]);

    const sqlBase = `
      SELECT 
        MIN(s.idsolicitacao)                                        AS idsolicitacao,
        s.tiposolicitacao,
        s.idfuncionario,                                            
        o.nrorcamento,
        o.idorcamento,
        f.descfuncao,
        fn.nome                                                     AS nomefuncionario,  
        COUNT(s.idsolicitacao)                                      AS total_solicitacoes,
        (SELECT setor FROM orcamentoitens 
        WHERE idorcamento = o.idorcamento LIMIT 1)                 AS setor,
        MIN(s.dtresposta)                                           AS dtresposta,
        MIN(s.dtsolicitacao)                                        AS dtsolicitacao,
        to_char(MIN(s.dtsolicitada[1]), 'DD/MM/YYYY')               AS dt_inicio,
        to_char(MAX(s.dtsolicitada[1]), 'DD/MM/YYYY')               AS dt_fim,
        json_agg(
            json_build_object(
                'idsolicitacao', s.idsolicitacao,
                'funcionario',   (u.nome || ' ' || u.sobrenome),
                'status',        s.status,
                'dtresposta',    s.dtresposta,
                'dtsolicitacao', to_char(s.dtsolicitada[1], 'DD/MM/YYYY')
            )
            ORDER BY s.dtsolicitada[1] DESC
        ) AS solicitacoes_agrupadas,
        COALESCE(bool_and(n.lido), false)                           AS ja_lido
    FROM solicitacoes s
    LEFT JOIN usuarios u      ON s.idusuariosolicitante = u.idusuario
    LEFT JOIN orcamentos o    ON s.idorcamento = o.idorcamento
    LEFT JOIN funcao f        ON s.idfuncao = f.idfuncao
    LEFT JOIN funcionarios fn ON s.idfuncionario = fn.idfuncionario  
    LEFT JOIN notificacao n   ON n.idreferencia = s.idsolicitacao AND n.idusuario = $1
    WHERE s.idempresa = $2
      AND s.tiposolicitacao IN ('Aditivo - Vaga Excedida', 'Extra Bonificado - Vaga Excedida', 'Aditivo - Datas fora do Orçamento', 'Extra Bonificado - Datas fora do Orçamento')
      AND s.status = 'Autorizado'
      AND s.dtresposta > NOW() - INTERVAL '7 days'
      AND NOT EXISTS (
          SELECT 1 FROM orcamentoitens oi
          WHERE s.idsolicitacao = oi.idsolicitacao
      )
    GROUP BY 
        s.tiposolicitacao,
        s.idfuncionario,   
        o.nrorcamento,
        o.idorcamento,
        f.descfuncao,
        fn.nome            
    ORDER BY MIN(s.dtresposta) DESC
    `;

    const result = await pool.query(sqlBase, [idusuario, idempresa]);

    const mensagensPorTipo = {
      'Aditivo - Vaga Excedida':         'Aditivo de Vaga Excedida Autorizado — incluir no orçamento',
      'Aditivo - Datas fora do orçamento': 'Aditivo - Datas fora do orçamento Autorizado — incluir no orçamento',
      'Extra Bonificado - Vaga Excedida': 'Extra Bonificado Autorizado — incluir no orçamento',
      'Extra Bonificado - Datas fora do orçamento': 'Extra Bonificado - Datas fora do orçamento Autorizado — incluir no orçamento',
    };

    const listaFormatada = result.rows.map(sol => {
      const statusLido = sol.ja_lido === true;
      const { iconRead, typeRead } = statusLido
        ? { iconRead: 'done_all',    typeRead: 'success' }
        : { iconRead: 'check_small', typeRead: 'danger'  };

      const periodoStr = sol.dt_inicio === sol.dt_fim
        ? sol.dt_inicio
        : `${sol.dt_inicio} até ${sol.dt_fim}`;

      return {
        id: `sol-${sol.idsolicitacao}`,
        type: 'success',
        icon: 'add_circle',
        message: mensagensPorTipo[sol.tiposolicitacao] ?? 'Solicitação Autorizada — incluir no orçamento',
        subtext: `Função: ${sol.descfuncao} — Orçamento: ${sol.nrorcamento} — Setor: ${sol.setor}`,
        subtext2: `${periodoStr}`,
        created_at: sol.dtresposta,
        read: statusLido,
        ficticio: true,
        iconRead,
        typeRead,
        idsolicitacao: sol.idsolicitacao,
        nrorcamento: sol.nrorcamento,
        total_solicitacoes: sol.total_solicitacoes,
        solicitacoes_agrupadas: sol.solicitacoes_agrupadas,
        status: 'Pendente',
      };
    });

    return res.status(200).json(listaFormatada);
  } catch (err) {
    console.error('Erro ao buscar aditivos extras autorizados:', err);
    return res.status(500).json({ erro: 'Erro interno ao buscar aditivos extras.' });
  }
});

// ─────────────────────────────────────────────
// GET /notificacoes/retorno-Inclusao
// ─────────────────────────────────────────────
router.get('/retorno-Inclusao', autenticarToken(), async (req, res) => {
  const idempresa = req.idempresa;
  const idusuario = req.usuario?.idusuario;

  try {
    const { rows } = await pool.query(
      `SELECT 
          array_agg(s.idsolicitacao ORDER BY s.idsolicitacao) AS ids_solicitacoes,
          (u.nome || ' ' || u.sobrenome) AS funcionario_solicitante,
          s.tiposolicitacao,
          MAX(s.dtresposta) AS dtresposta,
          f.descfuncao,
          o.nrorcamento,
          MIN(oi.idorcamentoitem) AS orcamento_item,
          MIN(oi.setor) AS setor,
          BOOL_OR(EXISTS (
              SELECT 1 FROM notificacao n 
              WHERE n.idreferencia = s.idsolicitacao 
              AND n.idusuario = $1
              AND n.lido = true
          )) AS ja_lido
      FROM solicitacoes s
      INNER JOIN orcamentoitens oi ON s.idsolicitacao = oi.idsolicitacao
      INNER JOIN orcamentos o ON s.idorcamento = o.idorcamento
      LEFT JOIN usuarios u ON s.idusuariosolicitante = u.idusuario
      LEFT JOIN funcao f ON s.idfuncao = f.idfuncao
      WHERE s.status = 'Autorizado'
        AND s.idempresa = $2
        AND s.dtresposta > NOW() - INTERVAL '7 days'
      GROUP BY 
          u.idusuario,
          u.nome,
          u.sobrenome,
          s.tiposolicitacao,
          f.idfuncao,
          f.descfuncao,
          o.idorcamento,
          o.nrorcamento
      ORDER BY MAX(s.dtresposta) DESC`,
      [idusuario, idempresa]
    );

    const listaFormatada = rows.map(sol => {
      const statusLido = sol.ja_lido === true;
      const { iconRead, typeRead } = statusLido
        ? { iconRead: 'done_all',    typeRead: 'success' }
        : { iconRead: 'check_small', typeRead: 'danger'  };
        

      return {
        id: `inc-${sol.idsolicitacao}`,
        type: 'success-finished',
        icon: 'task_alt',
        message: `${sol.tiposolicitacao} Incluído!`,
        subtext: `${sol.descfuncao} - ${sol.setor} (Orçamento N° ${sol.nrorcamento}) já consta nos itens do orçamento.`,
        created_at: sol.dtresposta,
        read: statusLido,
        ficticio: true,
        iconRead,
        typeRead,
        idsolicitacao: sol.idsolicitacao,
        idorcamentoitem: sol.idorcamentoitem,
        status: 'Finalizado',
      };
    });

    return res.status(200).json(listaFormatada);
  } catch (err) {
    console.error('Erro ao buscar retorno de inclusão:', err);
    return res.status(500).json({ erro: 'Erro interno.' });
  }
});

// ─────────────────────────────────────────────
// GET /notificacoes/pagamentos-contas
// ─────────────────────────────────────────────
router.get('/pagamentos-contas', autenticarToken(), async (req, res) => {
  try {
    const idempresa = req.idempresa;
    const idusuario = req.usuario?.idusuario;
    const anoFiltro = new Date().getFullYear();

    const { rows: allPermissoes } = await pool.query(
      `SELECT modulo, master, supremo, financeiro FROM permissoes WHERE idusuario = $1`,
      [idusuario]
    );

    const temAcessoTotal = allPermissoes.some(p =>
      p.modulo === 'Staff' && (p.master === true || p.supremo === true || p.financeiro === true)
    );

    if (!temAcessoTotal) return res.json([]);

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const fmt = d => d.toISOString().split('T')[0];
    const startDate = fmt(new Date(hoje.getTime() - 90 * 86400000));
    const endDate   = fmt(new Date(hoje.getTime() + 1  * 86400000));

    const queryContasPagar = `
      SELECT 
          l.idlancamento, l.descricao, 
          COALESCE(p.dtvcto, l.vctobase) AS data_vencimento,
          CAST(COALESCE(p.vlrreal, p.vlrprevisto, l.vlrestimado, 0) AS FLOAT) AS valor_pendente,
          EXISTS (
            SELECT 1 FROM notificacao n 
            WHERE n.idreferencia = l.idlancamento 
            AND n.idusuario = $3 
            AND n.lido = true
          ) as ja_lido,
          COALESCE(forn.nmfantasia, func.nome, cli.nmfantasia, 'Lançamento Geral') AS nome_vinculo
      FROM lancamentos l
      LEFT JOIN pagamentos p ON l.idlancamento = p.idlancamento
      LEFT JOIN fornecedores forn ON (LOWER(TRIM(l.tipovinculo)) = 'fornecedor'   AND l.idvinculo = forn.idfornecedor)
      LEFT JOIN funcionarios func ON (LOWER(TRIM(l.tipovinculo)) = 'funcionario'  AND l.idvinculo = func.idfuncionario)
      LEFT JOIN clientes cli      ON (LOWER(TRIM(l.tipovinculo)) = 'cliente'      AND l.idvinculo = cli.idcliente)
      WHERE l.ativo = true AND l.idempresa = $1
        AND (p.status IS NULL OR p.status != 'PAGO')
        AND (
            EXTRACT(YEAR FROM COALESCE(p.dtvcto, l.vctobase)) = $2
            OR (l.tiporepeticao = 'FIXO' AND (l.dttermino IS NULL OR EXTRACT(YEAR FROM l.dttermino) >= $2))
        )
    `;

    const [resContas, resEventosRaw] = await Promise.all([
      pool.query(queryContasPagar, [idempresa, anoFiltro, idusuario]),
      pool.query(`
        SELECT o.idevento, e.nmevento, MIN(o.dtinimontagem) AS dtinimontagem, MAX(o.dtfimdesmontagem) AS dtfimdesmontagem
        FROM orcamentos o
        JOIN orcamentoempresas oe ON o.idorcamento = oe.idorcamento
        JOIN eventos e ON o.idevento = e.idevento
        WHERE oe.idempresa = $1
          AND (
            (o.dtinimontagem   + INTERVAL '2 days')::date BETWEEN $2 AND $3
            OR (o.dtfimdesmontagem + INTERVAL '2 days')::date BETWEEN $2 AND $3
          )
        GROUP BY o.idevento, e.nmevento
      `, [idempresa, startDate, endDate])
    ]);

    const notificacoes = [];

    function gerarEstruturaNotif(idBase, tipo, titulo, dataVenc, valor, jaLido, meta) {
      if (valor <= 0) return null;

      const dVenc = new Date(dataVenc + 'T00:00:00');
      const dias  = Math.round((dVenc - hoje) / 86400000);
      if (dias > 5) return null;

      let estado = '';
      let mensagemData = '';
      let classeStatus = '';

      if (dias < 0) {
        estado = 'vencido';  mensagemData = 'VENCIDA';               classeStatus = 'notif-vencidos';
      } else if (dias === 0) {
        estado = 'hoje';     mensagemData = 'VENCE HOJE';            classeStatus = 'notif-hoje';
      } else if (dias === 1) {
        estado = 'amanha';   mensagemData = 'VENCE AMANHÃ';          classeStatus = 'notif-amanha';
      } else {
        estado = 'pendente'; mensagemData = `VENCE EM ${dias} DIAS`; classeStatus = 'notif-a-vencer';
      }

      const formatarReais = v => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

      const config = {
        'vencido': { icon: 'brightness_alert',        type: 'danger'  },
        'hoje':    { icon: 'paid',                    type: 'warning' },
        'amanha':  { icon: 'notification_important',  type: 'info'    },
      };
      const { icon, type } = config[estado] || { icon: 'calendar_today', type: 'info' };

      const statusLido = jaLido === true;
      const { iconRead, typeRead } = statusLido
        ? { iconRead: 'done_all',    typeRead: 'success' }
        : { iconRead: 'check_small', typeRead: 'danger'  };

      return {
        id: idBase,
        type,
        icon,
        message: `${tipo} ${mensagemData}: ${titulo}`,
        subtext: `Valor: ${formatarReais(valor)} · ${meta.fornecedor || 'Staff'}`,
        badge: estado === 'amanha'  ? 'AMANHÃ'
             : estado === 'pendente' ? `FALTAM ${dias}D`
             : estado.toUpperCase(),
        diasAteVencimento: dias,
        estado,
        classeStatus,
        created_at: dataVenc,
        read: statusLido,
        iconRead,
        typeRead,
        meta,
        status: estado === 'vencido' ? 'Vencidos' : 'Pendente',
      };
    }

    resContas.rows.forEach(conta => {
      const n = gerarEstruturaNotif(
        `contapagar-${conta.idlancamento}`,
        'Conta',
        conta.descricao,
        fmt(new Date(conta.data_vencimento)),
        conta.valor_pendente,
        conta.ja_lido,
        { idlancamento: conta.idlancamento, fornecedor: conta.nome_vinculo }
      );
      if (n) notificacoes.push(n);
    });

    if (resEventosRaw.rows.length > 0) {
      // lógica de staff permanece igual — adicione aqui se necessário
    }

    const ordem = { vencido: 0, hoje: 1, amanha: 2, pendente: 3 };
    notificacoes.sort((a, b) => (ordem[a.estado] ?? 9) - (ordem[b.estado] ?? 9));

    res.json(notificacoes);
  } catch (err) {
    console.error('Erro:', err);
    res.status(500).json([]);
  }
});

module.exports = router;