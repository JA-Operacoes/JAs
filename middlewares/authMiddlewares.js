// middlewares/authMiddleware.js
const jwt = require('jsonwebtoken');

function autenticarToken(opcoes = { verificarEmpresa: true }) {
  return (req, res, next) => {
  console.log("➡️ Entrou no autenticarToken");
   // console.log("Headers brutos recebidos:", JSON.stringify(req.headers, null, 2));
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ erro: 'Formato do token inválido.' });
    }

    console.log("Todos os headers recebidos AUTENTICAR TOKEN:", req.headers);
 
    const idempresaHeader = req.get('x-id-empresa') || req.get('idempresa');

    const token = authHeader.split(' ')[1];
  
     //jwt.verify(token, process.env.JWT_SECRET, (err, usuario) => {
     jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        console.log("Erro ao verificar token:", err);

        // ✅ Diferencia token expirado de token inválido
        if (err.name === 'TokenExpiredError') {
          return res.status(401).json({ erro: 'Token expirado.' });
        }

        return res.status(403).json({ erro: 'Token inválido.' });
      }
      //req.usuario = usuario;  
          
      req.usuario = decoded; 
      console.log("Token verificado com sucesso:", decoded);
      //console.log("ID da empresa do header:", idempresaHeader);
      
      
     
      // Verifica empresa, se necessário
      if (opcoes.verificarEmpresa) {
        const idempresaReq = Number(idempresaHeader);
        if (isNaN(idempresaReq)) {
          return res.status(400).json({ erro: 'ID da empresa inválido.' });
        }
        let empresaValida = false;
        let idempresaFinal = null;

        if (Array.isArray(decoded.empresas)) {
          empresaValida = decoded.empresas.some(e => e.idempresa === idempresaReq);
          idempresaFinal = empresaValida ? idempresaReq : decoded.idempresaDefault;
        } else if (decoded.idempresa) {
          empresaValida = (idempresaReq === decoded.idempresa);
          idempresaFinal = empresaValida ? idempresaReq : decoded.idempresa;
        } else {
          return res.status(403).json({ erro: 'Nenhuma empresa associada ao usuário.' });
        }

        req.idempresa = idempresaFinal;
        next(); // Chama next() após todas as verificações de empresa
       
      }else{
          req.idempresa = Number(idempresaHeader);
          next(); // Chama next() após todas as verificações de empresa
          //return res.status(403).json({ erro: 'Nenhuma empresa associada ao usuário.' });
      }

      console.log('Usuário autenticado:', decoded.nome || decoded.email || decoded.idusuario);
      console.log('Empresa definida para requisição:', req.idempresa);
     // next();
    });
  }
}

function contextoEmpresa(req, res, next) {
  console.log("➡️ Entrou no contextoEmpresa");
 
 // console.log('Headers recebidos:', req.headers);
  // const idempresa = parseInt(req.headers['idempresa']);
  // if (!idempresa || isNaN(idempresa)) {
  //   return res.status(400).json({ erro: 'Nenhuma Empresa associada ao usuário' });
  // }
  // req.idempresa = idempresa;
  
  // next();
  if (!req.idempresa) {
    const idempresa = parseInt(req.headers['idempresa'] || req.headers['x-id-empresa']);
    if (!idempresa || isNaN(idempresa)) {
      return res.status(400).json({ erro: 'Nenhuma empresa associada ao usuário.' });
    }
    req.idempresa = idempresa;
  }
  next();
  console.log("Contexto Empresa ok")
}


module.exports = { autenticarToken, contextoEmpresa };
