const express = require('express');
const router = express.Router();
const svc = require('../src/services/NotificacaoServices.cjs');
const pool = require('../db');
const { autenticarToken, contextoEmpresa} = require('../middlewares/authMiddlewares');




// GET /notificacoes — lista + contagem
router.get('/', autenticarToken(), async (req, res) => {
  try {
    const idusuario = req.usuario.idusuario;
    const { apenasNaoLidas } = req.query;

    const [notificacoes, naoLidas] = await Promise.all([
      svc.buscarNotificacoes(idusuario, { apenasNaoLidas: apenasNaoLidas === 'true' }),
      svc.contarNaoLidas(idusuario),
    ]);

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

    // Se o usuário clicar em "lida" num item da agenda, apenas ignoramos
    if (id.startsWith('agenda-')) {
      return res.json({ ok: true });
    }

    await svc.marcarComoLida(id, req.usuario.idusuario);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao marcar como lida' });
  }
});

// PATCH /notificacoes/todas-lidas
router.patch('/todas-lidas', autenticarToken(), async (req, res) => {
  try {
    await svc.marcarTodasComoLidas(req.usuario.idusuario);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao marcar todas como lidas' });
  }
});

// rotaNotificacao.js

// router.get('/agenda-notificacao', autenticarToken(), async (req, res) => {
//   try {
//     const idusuario = req.usuario.idusuario;
//     console.log(`Buscando notificações de agenda para usuário ${idusuario}...`);

//     const agendaRaw = await pool.query(`
//     SELECT a.idagenda, a.titulo, a.hora_evento, a.tipo, n.lido, a.criado_em
//     FROM agendas a
//     LEFT JOIN notificacao n ON n.idusuario = a.idusuario 
//       AND n.idreferencia = a.idagenda
//     WHERE a.idusuario = $1 
//       AND data_evento = CURRENT_DATE
//       AND hora_evento BETWEEN (CURRENT_TIME - INTERVAL '10 minutes') AND (CURRENT_TIME + INTERVAL '1 hour')
//     ORDER BY hora_evento ASC`,
//     [idusuario]
//     );

//     console.log(`Eventos de agenda encontrados: ${agendaRaw.rows.length}`);

//     const lembretes = agendaRaw.rows.map(evento => {

//       const config = {
//         'Reunião': { icon: 'groups_2', type: 'danger' },     // Nome do ícone no Google Fonts
//         'Evento':   { icon: 'event_available', type: 'info' },
//         'Lembrete': { icon: 'priority_high', type: 'warning' },
//         'Anotação': { icon: 'text_ad', type: 'info' }
//       };
//       const configRead = {
//         'false':{iconRead: 'check_small', typeRead: 'danger' },
//         'true':{iconRead: 'done_all', typeRead: 'success' }
//       }
//       const tipoDb = evento.tipo || 'evento';
//       const { icon, type} = config[tipoDb] || { icon: 'calendar', type: 'warning' };
//       const { iconRead, typeRead } = configRead[evento.lido] || { iconRead: 'check_small', typeRead: 'danger' };
//       const createIn =  evento.criado_em || new Date();

//       return {
//         id: `agenda-${evento.idagenda}`,
//         type: type,
//         icon: icon, // Enviamos o nome do ícone para o front
//         message: `${evento.tipo.toUpperCase()}: ${evento.titulo} às ${evento.hora_evento.substring(0, 5)}`,
//         read: false,
//         ficticio: true,
//         created_at: createIn,
//         typeRead: typeRead,
//         iconRead: iconRead
//       };
//     });

//     res.json(lembretes);
//   } catch (err) {
//     console.error('Erro na agenda fictícia:', err);
//     res.status(500).json([]);
//   }
// });

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

router.get('/pedidos-notificacao', autenticarToken(), async (req, res) => {
  try {
    const idusuario = req.usuario.idusuario;
    console.log(`Buscando notificações de pedidos para usuário ${idusuario}...`);

    const pedidosRaw = await pool.query(`
      SELECT
      FROM 
    `);
    const pedidos = pedidosRaw.rows.map(pedido => ({
      id: `pedido-${pedido.idpedido}`,
      type: pedido.status === 'pendente' ? 'warning' : 'success',
      icon: pedido.status === 'pendente' ? 'hourglass_empty' : 'check_circle',
      message: `Pedido ${pedido.status}: ${pedido.idpedido}`,
      read: pedido.lido,
      created_at: pedido.criado_em
    }));
    res.json(pedidos);
  } catch (err) {
    console.error('Erro ao buscar notificações de pedidos:', err);
    res.status(500).json({ error: 'Erro ao buscar notificações de pedidos' });
  }
});


module.exports = router;