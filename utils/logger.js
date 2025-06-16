const pool = require('../db');

async function registrarLog({
  idexecutor,
  idempresa,
  acao,
  modulo,
  idregistroalterado = null,
  idusuarioalvo = null,
  dadosanteriores = null,
  dadosnovos = null
}) {
  try {
    if (!idexecutor || !acao || !modulo) {
      console.warn('Log ignorado: dados obrigatórios ausentes');
      return;
    }

    const dadosanterioresJSON = dadosanteriores && Object.keys(dadosanteriores).length
      ? JSON.stringify(dadosanteriores)
      : null;

    const dadosnovosJSON = dadosnovos && Object.keys(dadosnovos).length
      ? JSON.stringify(dadosnovos)
      : null;

    await pool.query(`
      INSERT INTO logs (
        idexecutor,
        idempresa,
        acao,
        modulo,
        idregistroalterado,
        idusuarioalvo,
        dadosanteriores,
        dadosnovos
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      idexecutor,
      idempresa || null,
      acao,
      modulo,
      idregistroalterado,
      idusuarioalvo,
      dadosanterioresJSON,
      dadosnovosJSON
    ]);
  } catch (err) {
    console.error('Erro ao registrar log:', err);
  }
}

module.exports = registrarLog;
