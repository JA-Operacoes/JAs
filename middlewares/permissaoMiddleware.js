// middlewares/permissaoMiddleware.js
const db = require('../db');

// middleware: verifica se o usuário pode executar uma ação em um módulo
function verificarPermissao(modulo, acao) {
  return async (req, res, next) => {
    console.log("Usuário autenticado:", req.usuario);
    console.log("Ação:", acao);
    const usuarioId = req.usuario.id;

    try {
      const query = `
        SELECT * FROM permissoes
        WHERE idusuario = $1 AND modulo = $2
      `;
      const { rows } = await db.query(query, [usuarioId, modulo]);
      const permissao = rows[0];

      if (!permissao || !permissao[`pode_${acao}`]) {
        return res.status(403).json({ erro: `Você não tem permissão para ${acao} neste módulo.` });
      }
      console.log(`✅ Acesso concedido para '${acao}' no módulo '${modulo}'`);
      next();
    } catch (err) {
      console.error('Erro ao verificar permissão:', err);
      res.status(500).json({ erro: 'Erro ao verificar permissões.' });
    }
  };
}

module.exports = { verificarPermissao };
