// // middlewares/permissaoMiddleware.js
 const db = require('../db');

// // middleware: verifica se o usuário pode executar uma ação em um módulo
// function verificarPermissao(modulo, acao) {
//   return async (req, res, next) => {
//     const usuarioId = req.usuario.id;

//     // Normaliza os nomes (garante que tudo seja minúsculo para comparação)
//     const moduloNormalizado = modulo.toLowerCase();
//     const acaoNormalizada = acao.toLowerCase();

//     console.log("🧪 Verificando permissões");
//     console.log("Usuário ID:", usuarioId);
//     console.log("Módulo:", moduloNormalizado);
//     console.log("Ação:", acaoNormalizada);

//     try {
//       const query = `
//         SELECT * FROM permissoes
//         WHERE idusuario = $1 AND LOWER(modulo) = $2
//       `;
//       const { rows } = await db.query(query, [usuarioId, moduloNormalizado]);
//       const permissao = rows[0];

//       if (!permissao || !permissao[acaoNormalizada]) {
//         return res.status(403).json({ erro: `Você não tem permissão para ${acaoNormalizada} neste módulo.` });
//       }

//       console.log(`✅ Acesso concedido para '${acaoNormalizada}' no módulo '${moduloNormalizado}'`);
//       next();
//     } catch (err) {
//       console.error('❌ Erro ao verificar permissão:', err);
//       res.status(500).json({ erro: 'Erro ao verificar permissões.' });
//     }
//   };
// }

// module.exports = { verificarPermissao };

// middleware: verifica se o usuário pode executar uma ação em um módulo e empresa
function verificarPermissao(modulo, acao) {
  return async (req, res, next) => {

    console.log("🔍 Verificando permissões para:", modulo, acao);
    const usuarioId = req.usuario.id;

    // Obtem idempresa do cabeçalho ou corpo (ajuste conforme sua arquitetura)
    const idempresa = req.headers['idempresa'] || req.body.idempresa || req.query.idempresa;

    if (!idempresa) {
      return res.status(400).json({ erro: "ID da empresa é obrigatório para verificação de permissões." });
    }

    const moduloNormalizado = modulo.toLowerCase();
    const acaoNormalizada = acao.toLowerCase();

    console.log("🧪 Verificando permissões");
    console.log("Usuário ID:", usuarioId);
    console.log("Empresa ID:", idempresa);
    console.log("Módulo:", moduloNormalizado);
    console.log("Ação:", acaoNormalizada);

    try {
      const query = `
        SELECT * FROM permissoes
        WHERE idusuario = $1 AND LOWER(modulo) = $2 AND idempresa = $3
      `;
      const { rows } = await db.query(query, [usuarioId, moduloNormalizado, idempresa]);

      const permissao = rows[0];

      if (!permissao || !permissao[acaoNormalizada]) {
        return res.status(403).json({ erro: `Você não tem permissão para ${acaoNormalizada} neste módulo da empresa.` });
      }

      console.log(`✅ Acesso concedido para '${acaoNormalizada}' no módulo '${moduloNormalizado}' da empresa ${idempresa}`);
      next();
    } catch (err) {
      console.error('❌ Erro ao verificar permissão:', err);
      res.status(500).json({ erro: 'Erro ao verificar permissões.' });
    }
  };
}
module.exports = { verificarPermissao };
