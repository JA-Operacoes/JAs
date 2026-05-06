const express = require('express');
const router = express.Router();
const svc = require('../src/services/NotificacaoServices.js');
const pool = require('../db');
const { autenticarToken, contextoEmpresa} = require('../middlewares/authMiddlewares');




// GET /notificacoes — lista + contagem
router.get('/', autenticarToken(), async (req, res) => {
  try {
    const idusuario = req.usuario.idusuario;
    const { apenasNaoLidas } = req.query;

    const [todasNotificacoes, naoLidas] = await Promise.all([
      svc.buscarNotificacoes(idusuario, { apenasNaoLidas: apenasNaoLidas === 'true' }),
      svc.contarNaoLidas(idusuario),
    ]);

    // FILTRO: Remove qualquer notificação que pertença a uma solicitação (idreferencia não nulo)
    // Esses itens já são tratados pela rota /solicitacoes-notificacao
    const notificacoes = todasNotificacoes.filter(n => n.idreferencia === null);

    res.json({ notificacoes, naoLidas });
  } catch (err) {
    console.error('Erro ao buscar notificações:', err);
    res.status(500).json({ error: 'Erro ao buscar notificações' });
  }
});

// PATCH /notificacoes/:id/lida
router.patch('/:id/lida', autenticarToken(), async (req, res) => {
    try {
        const { id } = req.params;
        const idusuario = req.usuario.idusuario;
        const idempresa = req.idempresa; 

        let idreferencia = null;
        let mensagemLog = '';

        // Identifica qual o tipo de ID e extrai o número
        if (id.startsWith('sol-')) {
            idreferencia = parseInt(id.replace('sol-', ''));
            mensagemLog = 'Solicitação visualizada';
        } else if (id.startsWith('contapagar-')) {
            idreferencia = parseInt(id.replace('contapagar-', ''));
            mensagemLog = 'Lançamento financeiro visualizado';
        } else if (id.startsWith('staff-ajuda-') || id.startsWith('staff-cache-')) {
            // Para staff, pegamos o ID do evento ou o ID que você definiu no prefixo
            idreferencia = parseInt(id.split('-').pop()); 
            mensagemLog = 'Pagamento de Staff visualizado';
        }

        if (idreferencia) {
            await pool.query(
                `INSERT INTO notificacao (
                    idusuario, idreferencia, idempresa, lido, tipo, mensagem, criado_em
                )
                VALUES ($1, $2, $3, true, 'info', $4, NOW())
                ON CONFLICT (idusuario, idreferencia) 
                DO UPDATE SET 
                    lido = true, 
                    idempresa = $3,
                    criado_em = NOW()`,
                [idusuario, idreferencia, idempresa, mensagemLog]
            );
            return res.json({ ok: true });
        }

        // Se for uma notificação que já existe no banco (ID numérico puro)
        if (!isNaN(id)) {
            await pool.query(
                `UPDATE notificacao SET lido = true WHERE idnotificacao = $1 AND idusuario = $2`,
                [id, idusuario]
            );
        }

        res.json({ ok: true });

    } catch (err) {
        console.error('❌ Erro no PATCH lida:', err);
        res.status(500).json({ error: 'Erro ao marcar como lida' });
    }
});

// PATCH /notificacoes/todas-lidas
router.patch('/todas-lidas', autenticarToken(), async (req, res) => {
  try {
    const idusuario = req.usuario?.idusuario;
    const idempresa = req.idempresa;

    // 1. Marcar notificações que já existem fisicamente na tabela
    await pool.query(
      `UPDATE notificacao SET lido = true WHERE idusuario = $1 AND idempresa = $2`,
      [idusuario, idempresa]
    );

    // 2. Criar registros de "lido" para Solicitações e Lançamentos que ainda não têm entrada na tabela
    // Este query insere na tabela de notificações referenciando os IDs de lançamentos ativos
    await pool.query(`
      INSERT INTO notificacao (idusuario, idreferencia, idempresa, lido, criado_em)
      SELECT $1, idlancamento, $2, true, NOW() FROM lancamentos WHERE idempresa = $2 AND ativo = true
      ON CONFLICT (idusuario, idreferencia) DO UPDATE SET lido = true
    `, [idusuario, idempresa]);

    await pool.query(`
      INSERT INTO notificacao (idusuario, idreferencia, idempresa, lido, criado_em)
      SELECT $1, idsolicitacao, $2, true, NOW() FROM solicitacoes WHERE idempresa = $2
      ON CONFLICT (idusuario, idreferencia) DO UPDATE SET lido = true
    `, [idusuario, idempresa]);

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao marcar todas como lidas' });
  }
});

router.get('/agenda-notificacao', autenticarToken(), async (req, res) => {
  try {
    const idusuario = req.usuario.idusuario;
    const agora = new Date();
    const horaAtual = agora.getHours();
    const diaDaSemana = agora.getDay(); // 0 = Domingo, 5 = Sexta, 6 = Sábado

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
      
      // Se for Sexta (5), estendemos o intervalo para 3 dias (até Segunda)
      if (diaDaSemana === 5) {
        intervalo = "'3 days'";
      }

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

    // 2. EXECUTAR A QUERY ÚNICA
    const agendaRaw = await pool.query(sql, [idusuario]);

    // 3. PROCESSAR OS RESULTADOS
    const lembretes = agendaRaw.rows.map(evento => {
      const config = {
        'Reunião': { icon: 'groups_2', type: 'danger' },
        'Evento':   { icon: 'event_available', type: 'info' },
        'Lembrete': { icon: 'priority_high', type: 'warning' },
        'Anotação': { icon: 'text_ad', type: 'info' }
      };

      const configRead = {
        false: { iconRead: 'check_small', typeRead: 'danger' },
        true:  { iconRead: 'done_all', typeRead: 'success' }
      };

      const tipoDb = evento.tipo || 'Evento';
      const { icon, type } = config[tipoDb] || { icon: 'calendar_today', type: 'warning' };
      
      // Tratando o status lido (convertendo null ou undefined para false)
      const statusLido = evento.lido === true;
      const { iconRead, typeRead } = configRead[statusLido];

      // Mensagem customizada se for de amanhã
      const prefixo = evento.quando === 'amanha' ? 'AMANHÃ' : tipoDb.toUpperCase();

      return {
        id: `agenda-${evento.idagenda}`,
        type: type,
        icon: icon,
        message: `${prefixo}: ${evento.titulo} às ${evento.hora_evento.substring(0, 5)}`,
        read: statusLido,
        ficticio: true,
        created_at: evento.criado_em || agora,
        typeRead: typeRead,
        iconRead: iconRead,
        quando: evento.quando // Enviamos a "coluna virtual" para o front
      };
    });

    res.json(lembretes);

  } catch (err) {
    console.error('Erro na agenda fictícia:', err);
    res.status(500).json([]);
  }
});

router.get('/solicitacoes-notificacao', autenticarToken(), async (req, res) => {
  try {
    const idempresa = req.idempresa;
    const idusuario = req.usuario?.idusuario;
     

    // 1. Busca todas as permissões do usuário
    const { rows: allPermissoes } = await pool.query(
        `SELECT modulo, master, supremo FROM permissoes WHERE idusuario = $1`,
        [idusuario]
    );

    // 2. Corrigindo a lógica de permissão (Aceita booleano ou string 'true')
    const ehMasterStaff  = allPermissoes.some(p => p.modulo === 'Staff' && (p.master === true || p.master === 'true'));
    const ehSupremoStaff = allPermissoes.some(p => p.modulo === 'Staff' && (p.supremo === true || p.supremo === 'true'));
    const temAcessoTotal = ehMasterStaff || ehSupremoStaff;

    // 3. Query com JOIN para saber se o usuário já leu a notificação "fictícia"
    let sqlBase = `
      SELECT 
        s.idsolicitacao,
        (u.nome || ' ' || u.sobrenome) AS funcionario,
        s.tiposolicitacao, 
        s.status, 
        s.dtsolicitacao, 
        s.dtresposta, 
        s.idusuariosolicitante,
        EXISTS (
            SELECT 1 FROM notificacao n 
            WHERE n.idreferencia = s.idsolicitacao 
            AND n.idusuario = $1 
            AND n.lido = true
        ) as ja_lido
      FROM solicitacoes s
      LEFT JOIN usuarios u ON s.idusuariosolicitante = u.idusuario
      WHERE s.idempresa = $2
    `;

    let params = [idusuario, idempresa];
    let finalSql = "";

    if (temAcessoTotal) {
      finalSql = `${sqlBase} AND (s.status = 'Pendente' OR s.dtresposta > NOW() - INTERVAL '24 hours')`;
    } else {
      finalSql = `${sqlBase} AND s.idusuariosolicitante = $3 AND (s.status = 'Pendente' OR s.dtresposta > NOW() - INTERVAL '24 hours')`;
      params.push(idusuario);
    }

    finalSql += ` ORDER BY COALESCE(s.dtresposta, s.dtsolicitacao) DESC`;

    const result = await pool.query(finalSql, params);

    // 4. MAPEA para o formato que o Notificacao.js entende
    //  const configTipo = {
    //   'Ajuste Custo':    { icon: 'paid' },
    //   'Ajuste de Custo': { icon: 'paid' },
    //   'Caixinha':        { icon: 'attach_money' },
    //   'Meia Diária':     { icon: 'speed_0_5' },
    //   'Diária Dobrada':  { icon: 'speed_2x' },
    //   'EXTRA BONIFICADO - VAGA EXCEDIDA': { icon: 'star' },
    // };

    const configStatus = {
      'pendente':   { icon: 'pending_actions', type: 'warning' },
      'autorizado': { icon: 'check_circle',        type: 'success' },
      'rejeitado':  { icon: 'block',           type: 'danger'  }
    };

    const listaFormatada = result.rows.map(sol => {
      const statusLower = (sol.status || 'pendente').toLowerCase();
      const tipoDb = sol.tiposolicitacao || 'Solicitação';

      // const { icon: iconTipo } = configTipo[tipoDb] || { icon: 'request_quote' };
      const { icon: iconStatus, type } = configStatus[statusLower] || configStatus['pendente'];

      const statusLido = sol.ja_lido === true;
      const configRead = {
        false: { iconRead: 'check_small', typeRead: 'danger' },
        true:  { iconRead: 'done_all', typeRead: 'success' }
      };
      const { iconRead, typeRead } = configRead[statusLido];

      if (temAcessoTotal){
          return {
            id: `sol-${sol.idsolicitacao}`,
            type,
            icon: iconStatus,
            message: statusLower === 'pendente'
              ? `Nova Solicitação: ${tipoDb}`
              : `Solicitação ${sol.status}: ${tipoDb}`,
            subtext: `Solicitante: ${sol.funcionario} · ${statusLower === 'pendente' ? 'aguarda resposta' : 'foi ' + sol.status.toLowerCase()}`,
            created_at: sol.dtresposta || sol.dtsolicitacao,
            read: statusLido,
            ficticio: true,
            iconRead,
            typeRead
          };
      } else {
        return {
            id: `sol-${sol.idsolicitacao}`,
            type: type,
            icon: iconStatus,
            message: statusLower === 'pendente'
              ? `Sua Solicitação: ${tipoDb}`
              : `Solicitação ${sol.status}: ${tipoDb}`,
            subtext:`${tipoDb} ${statusLower === 'pendente' ? 'aguarda resposta' : 'foi ' + sol.status.toLowerCase()}`,
            created_at: sol.dtresposta || sol.dtsolicitacao,
            read: statusLido,
            ficticio: true,
            iconRead,
            typeRead
          };
        }
    });

    res.json(listaFormatada);
  } catch (err) {
    console.error('Erro ao processar solicitações:', err.message, err.hint, err.detail);
    res.status(500).json([]);
  }
});

router.get('/pagamentos-contas', autenticarToken(), async (req, res) => {
  try {
    const idempresa = req.idempresa;
    const idusuario = req.usuario?.idusuario;
    console.log('👤 idusuario:', idusuario, '| idempresa:', idempresa);
    const anoFiltro = new Date().getFullYear();

    const { rows: allPermissoes } = await pool.query(
      `SELECT modulo, master, supremo, financeiro FROM permissoes WHERE idusuario = $1`,
      [idusuario]
    );

    const temAcessoTotal = allPermissoes.some(p =>
      p.modulo === 'Staff' && (p.master === true || p.supremo === true || p.financeiro === true)
    );

    if (!temAcessoTotal) return res.json([]);
    console.log('👤Usuario Tem Acesso Total:', temAcessoTotal);

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const fmt = d => d.toISOString().split('T')[0];
    const startDate = fmt(new Date(hoje.getTime() - 90 * 86400000));
    const endDate = fmt(new Date(hoje.getTime() + 1 * 86400000));

    // --- PARTE A: BUSCA CONTAS A PAGAR COM STATUS DE LEITURA ---
    const queryContasPagar = `
      SELECT 
          l.idlancamento, l.descricao, 
          COALESCE(p.dtvcto, l.vctobase) AS data_vencimento,
          CAST(COALESCE(p.vlrreal, p.vlrprevisto, l.vlrestimado, 0) AS FLOAT) AS valor_pendente,
          -- Verificamos se este usuário já leu esta notificação específica
          EXISTS (
            SELECT 1 FROM notificacao n 
            WHERE n.idreferencia = l.idlancamento 
            AND n.idusuario = $3 
            AND n.lido = true
          ) as ja_lido,
          COALESCE(forn.nmfantasia, func.nome, cli.nmfantasia, 'Lançamento Geral') AS nome_vinculo
      FROM lancamentos l
      LEFT JOIN pagamentos p ON l.idlancamento = p.idlancamento
      LEFT JOIN fornecedores forn ON (LOWER(TRIM(l.tipovinculo)) = 'fornecedor' AND l.idvinculo = forn.idfornecedor)
      LEFT JOIN funcionarios func ON (LOWER(TRIM(l.tipovinculo)) = 'funcionario' AND l.idvinculo = func.idfuncionario)
      LEFT JOIN clientes cli ON (LOWER(TRIM(l.tipovinculo)) = 'cliente' AND l.idvinculo = cli.idcliente)
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
        AND ((o.dtinimontagem + INTERVAL '2 days')::date BETWEEN $2 AND $3 OR (o.dtfimdesmontagem + INTERVAL '2 days')::date BETWEEN $2 AND $3)
        GROUP BY o.idevento, e.nmevento
      `, [idempresa, startDate, endDate])
    ]);

    const notificacoes = [];

    // --- FUNÇÃO AUXILIAR CORRIGIDA ---
    function gerarEstruturaNotif(idBase, tipo, titulo, dataVenc, valor, jaLido, meta) {
      if (valor <= 0) return null;
      
      const dVenc = new Date(dataVenc + 'T00:00:00');
      const dias = Math.round((dVenc - hoje) / 86400000);
      if (dias > 1) return null;

      const estado = dias < 0 ? 'vencido' : (dias === 0 ? 'hoje' : 'amanha');
      const formatarReais = v => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

      const config = {
        'vencido': { icon: 'brightness_alert', type: 'danger' },
        'hoje':    { icon: 'paid', type: 'warning' },
        'amanha':  { icon: 'notification_important', type: 'info' }
      };
      const { icon, type } = config[estado] || { icon: 'calendar_today', type: 'info' };

      const statusLido = jaLido === true;
      const configRead = {
        false: { iconRead: 'check_small', typeRead: 'danger' },
        true:  { iconRead: 'done_all', typeRead: 'success' }
      };
      const { iconRead, typeRead } = configRead[statusLido];

      return {
        id: idBase,
        type,
        icon,
        message: `${tipo} ${estado === 'vencido' ? 'vencido' : 'vence ' + estado}: ${titulo}`,
        subtext: `Valor: ${formatarReais(valor)} · ${meta.fornecedor || 'Staff'}`,
        badge: estado.toUpperCase(),
        estado,
        created_at: dataVenc,
        read:statusLido,
        iconRead,
        typeRead,
        meta
      };
    }

    // Processar Contas
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

    // Processar Staff (Aqui você pode adicionar um check de leitura similar se necessário)
    if (resEventosRaw.rows.length > 0) {
        // ... (sua lógica de busca de totais de staff permanece igual)
    }

    const ordem = { vencido: 0, hoje: 1, amanha: 2 };
    notificacoes.sort((a, b) => (ordem[a.estado] - ordem[b.estado]));

    res.json(notificacoes);

  } catch (err) {
    console.error('Erro:', err);
    res.status(500).json([]);
  }
});

module.exports = router;