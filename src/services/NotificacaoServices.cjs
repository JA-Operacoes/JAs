const pool = require('../../db');

async function criarNotificacao(idusuario, idempresa, { tipo = 'info', mensagem, metadata = null }) {
  const { rows } = await pool.query(
    `INSERT INTO notificacao (idusuario, idempresa, tipo, mensagem, metadata)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [idusuario, idempresa, tipo, mensagem, metadata]
  );
  return rows[0];
}

async function buscarNotificacoes(idusuario, { apenasNaoLidas = false } = {}) {
  const filtro = apenasNaoLidas ? 'AND lido = FALSE' : '';
  const { rows } = await pool.query(
    `SELECT 
        idnotificacao AS id, 
        tipo AS type, 
        mensagem AS message, 
        lido AS read, 
        metadata, 
        criado_em AS created_at 
     FROM notificacao
     WHERE idusuario = $1 ${filtro}
     ORDER BY criado_em DESC LIMIT 50`,
    [idusuario]
  );
  return rows;
}

async function contarNaoLidas(idusuario) {
  const { rows } = await pool.query(
    `SELECT COUNT(*) AS count FROM notificacao WHERE idusuario = $1 AND lido = FALSE`,
    [idusuario]
  );
  return Number(rows[0].count);
}

async function marcarComoLida(idnotificacao, idusuario) {
  await pool.query(
    `UPDATE notificacao SET lido = TRUE WHERE idnotificacao = $1 AND idusuario = $2`,
    [idnotificacao, idusuario]
  );
}

async function marcarTodasComoLidas(idusuario) {
  await pool.query(
    `UPDATE notificacao SET lido = TRUE WHERE idusuario = $1 AND lido = FALSE`,
    [idusuario]
  );
}

module.exports = { criarNotificacao, buscarNotificacoes, contarNaoLidas, marcarComoLida, marcarTodasComoLidas };

