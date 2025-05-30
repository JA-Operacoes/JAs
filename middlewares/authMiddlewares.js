// middlewares/authMiddleware.js
const jwt = require('jsonwebtoken');

function autenticarToken(opcoes = { verificarEmpresa: true }) {
  return (req, res, next) => {
    console.log("Headers brutos recebidos:", JSON.stringify(req.headers, null, 2));
    const authHeader = req.headers['authorization'];
    
    console.log("Todos os headers recebidos:", req.headers);
  //  const idempresaHeader = req.headers['x-id-empresa'];
  //const idempresaHeader = req.headers['x-id-empresa'] || req.headers['idempresa'];
const idempresaHeader = req.get('x-id-empresa') || req.get('idempresa');



    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ erro: 'Formato do token inválido.' });
    }

   const token = authHeader.split(' ')[1];

     jwt.verify(token, process.env.JWT_SECRET, (err, usuario) => {
      //jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        console.log("Erro ao verificar token:", err);

        // ✅ Diferencia token expirado de token inválido
        if (err.name === 'TokenExpiredError') {
          return res.status(401).json({ erro: 'Token expirado.' });
        }

        return res.status(403).json({ erro: 'Token inválido.' });
      }

      console.log("Token verificado com sucesso:", usuario);
      console.log("ID da empresa do header:", idempresaHeader);
      
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

function contextoEmpresa(req, res, next) {
  const { idempresa } = req.usuario || {};
  req.empresaId = idempresa; // define mesmo que as rotas não usem
  next();
}
// module.exports = contextoEmpresa;

// function contextoEmpresa(opcoes = {}) {
//   return (req, res, next) => {
//     const idEmpresa = req.headers['x-id-empresa'];
    
//     if (!idEmpresa && !opcoes.permitirSemEmpresa) {
//       console.log("[contextoEmpresa] Empresa não informada.");
//       return res.status(400).json({ erro: 'Empresa não informada' });
//     }

//     if (idEmpresa) {
//       req.idEmpresa = parseInt(idEmpresa, 10);
//     }

//     next();
//   };
// }

module.exports = { autenticarToken, contextoEmpresa };
