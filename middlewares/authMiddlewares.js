// middlewares/authMiddleware.js
const jwt = require('jsonwebtoken');


// function autenticarToken(opcoes = { verificarEmpresa: true }) {
//   return (req, res, next) => {
//     console.log('JWT_SECRET:', process.env.JWT_SECRET);

//     const authHeader = req.headers['authorization'];
//     const idempresaHeader = req.headers['idempresa'];
//       if (!authHeader || !authHeader.startsWith('Bearer ')) {
//         return res.status(401).json({ erro: 'Formato do token inválido.' });
//       }

//       const token = authHeader.split(' ')[1];
//       if (!token) return res.status(401).json({ erro: 'Token não fornecido.' });

//       jwt.verify(token, process.env.JWT_SECRET, (err, usuario) => {
//          if (err) {
//           console.log("Erro ao verificar token:", err);
//           return res.status(403).json({ erro: 'Token inválido.' });
//         }
//         console.log("Token verificado com sucesso:", usuario);
       
//         req.usuario = usuario;

//         if (opcoes.verificarEmpresa) {
//           const idempresaReq = parseInt(idempresaHeader);
//           let empresaValida = false;
//           let idempresaFinal = null;

//           if (Array.isArray(usuario.empresas)) {
//             empresaValida = usuario.empresas.some(e => e.idempresa === idempresaReq);
//             idempresaFinal = empresaValida ? idempresaReq : usuario.idempresaDefault;
//           } else if (usuario.idempresa) {
//             empresaValida = (idempresaReq === usuario.idempresa);
//             idempresaFinal = empresaValida ? idempresaReq : usuario.idempresa;
//           } else {
//             return res.status(403).json({ erro: 'Nenhuma empresa associada ao usuário.' });
//           }

//           req.idempresa = idempresaFinal;
//         }
//       console.log('Usuário autenticado:', usuario.nome || usuario.email || usuario.idusuario);
//       console.log('Empresa definida para requisição:', req.idempresa);
//       next();
//     });
//   }
// }

function autenticarToken(opcoes = { verificarEmpresa: true }) {
  return (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const idempresaHeader = req.headers['idempresa'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ erro: 'Formato do token inválido.' });
    }

   const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.JWT_SECRET, (err, usuario) => {
      if (err) {
        console.log("Erro ao verificar token:", err);

        // ✅ Diferencia token expirado de token inválido
        if (err.name === 'TokenExpiredError') {
          return res.status(401).json({ erro: 'Token expirado.' });
        }

        return res.status(403).json({ erro: 'Token inválido.' });
      }

      console.log("Token verificado com sucesso:", usuario);
      req.usuario = usuario;

      // Verifica empresa, se necessário
      if (opcoes.verificarEmpresa) {
        const idempresaReq = Number(idempresaHeader);
        if (isNaN(idempresaReq)) {
          return res.status(400).json({ erro: 'ID da empresa inválido.' });
        }
        let empresaValida = false;
        let idempresaFinal = null;

        if (Array.isArray(usuario.empresas)) {
          empresaValida = usuario.empresas.some(e => e.idempresa === idempresaReq);
          idempresaFinal = empresaValida ? idempresaReq : usuario.idempresaDefault;
        } else if (usuario.idempresa) {
          empresaValida = (idempresaReq === usuario.idempresa);
          idempresaFinal = empresaValida ? idempresaReq : usuario.idempresa;
        } else {
          return res.status(403).json({ erro: 'Nenhuma empresa associada ao usuário.' });
        }

        req.idempresa = idempresaFinal;
      }

      console.log('Usuário autenticado:', usuario.nome || usuario.email || usuario.idusuario);
      console.log('Empresa definida para requisição:', req.idempresa);
      next();
    });
  }
}

module.exports = { autenticarToken };
