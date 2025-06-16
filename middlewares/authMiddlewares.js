// middlewares/authMiddleware.js
const jwt = require('jsonwebtoken');
const db = require('../db');
const JWT_SECRET = process.env.JWT_SECRET || 'sua_chave_super_secreta';

//function autenticarToken(opcoes = { verificarEmpresa: true }) {
//  return (req, res, next) => {
function autenticarToken(options = {}) {
    // Define opções padrão
    const { verificarEmpresa = true } = options; // Por padrão, verifica a empresa

    return (req, res, next) => { // ESTE É O MIDDLEWARE REAL
      console.log("➡️ Entrou no autenticarToken");
      console.log("Todos os headers recebidos AUTENTICAR TOKEN:", req.headers);

   
      const authHeader = req.headers['authorization'];
      const token = authHeader.split(' ')[1];

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ erro: 'Formato do token inválido.' });
      }
      if (!token) {
          console.warn("⚠️ Token não fornecido. Acesso negado.");
          return res.status(401).json({ erro: 'Token não fornecido.' });
      }
      if (token == null) {
              console.warn("⚠️ Token não fornecido. Acesso não autorizado.");
              return res.status(401).json({ erro: 'Token não fornecido. Acesso não autorizado.' });
      }

      console.log("Todos os headers recebidos AUTENTICAR TOKEN:", req.headers);
  
      const idempresaHeader = req.get('x-id-empresa') || req.get('idempresa');

    
  
     //jwt.verify(token, process.env.JWT_SECRET, (err, usuario) => {
     jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        console.error("❌ Erro ao verificar token:", err.message);

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
      
      // --- CORREÇÃO AQUI: Garante que req.idempresa seja definido ---
        if (decoded && typeof decoded.idempresaDefault === 'number') { // Verifica se é um número
            req.idempresa = decoded.idempresaDefault;
            console.log("Empresa default do token definida em req.idempresa:", req.idempresa);
        } else if (req.headers['idempresa']) { // Fallback para cabeçalho, se idempresaDefault não estiver no token
            req.idempresa = parseInt(req.headers['idempresa']); // Garante que é número
            console.log("Empresa definida a partir do cabeçalho em req.idempresa:", req.idempresa);
        } else {
            // Este console.warn é importante. Se o token não tem idempresaDefault E o header não tem,
            // então `req.idempresa` continuará undefined, o que pode causar o NaN.
            console.warn("⚠️ idempresaDefault não encontrado no token nem no cabeçalho. `req.idempresa` não definido em autenticarToken.");
            // Você pode decidir retornar um erro aqui se idempresa for *sempre* obrigatório para a rota.
            // Por enquanto, apenas avisamos e continuamos.
        }
        console.log(`Usuário autenticado: ${decoded.email}. idusuario: ${req.usuario.idusuario}.`); // Log corrigido
        console.log("Empresa definida para requisição (final de autenticarToken):", req.idempresa); // Log para ver o valor final
        next();
        
    //   // Verifica empresa, se necessário
    //   if (opcoes.verificarEmpresa) {
    //     const idempresaReq = Number(idempresaHeader);
    //     if (isNaN(idempresaReq)) {
    //       return res.status(400).json({ erro: 'ID da empresa inválido.' });
    //     }
    //     let empresaValida = false;
    //     let idempresaFinal = null;

    //     if (Array.isArray(decoded.empresas)) {
    //       //empresaValida = decoded.empresas.some(e => e.idempresa === idempresaReq);
    //       empresaValida = decoded.empresas.some(id => id === idempresaReq);
    //       idempresaFinal = empresaValida ? idempresaReq : decoded.idempresaDefault;
    //     } else if (decoded.idempresa) {
    //       empresaValida = (idempresaReq === decoded.idempresa);
    //       idempresaFinal = empresaValida ? idempresaReq : decoded.idempresa;
    //     } else {
    //       console.warn('Nenhuma empresa associada ao usuário no token.');
    //       return res.status(403).json({ erro: 'Nenhuma empresa associada ao usuário.' });
    //     }
       
    //     if (!empresaValida) {
    //         console.warn(`Tentativa de acesso a empresa não autorizada. Token decodificado: ${JSON.stringify(decoded)}, Empresa requerida: ${idempresaReq}`);
    //         return res.status(403).json({ erro: 'Acesso negado para esta empresa.' });
    //     }

    //     req.idempresa = idempresaFinal;
    //     console.log('Usuário autenticado:', decoded.nome || decoded.email || decoded.idusuario);
    //     console.log('Empresa definida para requisição:', req.idempresa);
    //     return next(); // ✅ CHAMA NEXT() E RETORNA AQUI!
       
    //   }else{
    //       req.idempresa = Number(idempresaHeader);
    //       console.log('Usuário autenticado (sem verificação de empresa):', decoded.nome || decoded.email || decoded.idusuario);
    //     console.log('Empresa definida para requisição (sem verificação de empresa):', req.idempresa);
    //       return next(); // Chama next() após todas as verificações de empresa
    //       //return res.status(403).json({ erro: 'Nenhuma empresa associada ao usuário.' });
    //   }

    //   console.log('Usuário autenticado:', decoded.nome || decoded.email || decoded.idusuario);
    //   console.log('Empresa definida para requisição:', req.idempresa);
    //  // next();
    });
  }
}

function contextoEmpresa(req, res, next) {
  console.log("➡️ Entrou no contextoEmpresa. req.idempresa atual:", req.idempresa); // Log corrigido para mostrar o valor
 
 // console.log('Headers recebidos:', req.headers);
  // const idempresa = parseInt(req.headers['idempresa']);
  // if (!idempresa || isNaN(idempresa)) {
  //   return res.status(400).json({ erro: 'Nenhuma Empresa associada ao usuário' });
  // }
  // req.idempresa = idempresa;
  
  // next();

  // if (!req.idempresa) {
  //   const idempresa = parseInt(req.headers['idempresa'] || req.headers['x-id-empresa']);
  //   if (!idempresa || isNaN(idempresa) || idempresa <= 0) {
  //     console.warn('ID da empresa inválido no contextoEmpresa.');
  //     return res.status(400).json({ erro: 'Nenhuma empresa associada ao usuário.' });
  //   }
  //   req.idempresa = idempresa;
  // }
  // console.log("Contexto Empresa ok. req.idempresa:", req.idempresa);
  // return next();
  

  // Se idempresa já veio do token em autenticarToken, use-o
    const idempresa = req.idempresa; 

    // Se não veio do token (raro para rotas protegidas), pode tentar de outros lugares
   if (!idempresa || isNaN(idempresa)) { // Adicionado isNaN para pegar o erro do NaN
        console.warn("⚠️ ID da empresa é obrigatório ou inválido (NaN) para verificação de contexto.");
        return res.status(400).json({ erro: "ID da empresa é obrigatório ou inválido." });
    }

    req.idempresa = parseInt(idempresa); // Garante que é um número inteiro
    console.log("Contexto Empresa ok. req.idempresa:", req.idempresa);
    next();
}


module.exports = { autenticarToken, contextoEmpresa };
