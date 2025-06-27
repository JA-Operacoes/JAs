// middlewares/authMiddleware.js
const jwt = require('jsonwebtoken');
const db = require('../db');
const JWT_SECRET = process.env.JWT_SECRET || 'sua_chave_super_secreta';


function autenticarToken(options = {}) {
    // Define opções padrão
    const { verificarEmpresa = true } = options; // Por padrão, verifica a empresa

    return (req, res, next) => { // ESTE É O MIDDLEWARE REAL
      console.log("➡️ Entrou no autenticarToken");
      console.log("Todos os headers recebidos AUTENTICAR TOKEN:", req.headers);
   
      const authHeader = req.headers['authorization'];
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.warn("⚠️ Formato do token inválido ou token não fornecido no cabeçalho Authorization.");
            return res.status(401).json({ erro: 'Token de autenticação ausente ou em formato inválido.' });
        }
      const token = authHeader.split(' ')[1];
      if (!token) {
            console.warn("⚠️ Token não fornecido após split do cabeçalho. Acesso negado.");
            return res.status(401).json({ erro: 'Token não fornecido.' });
        }

      // if (!authHeader || !authHeader.startsWith('Bearer ')) {
      //   return res.status(401).json({ erro: 'Formato do token inválido.' });
      // }
      // if (!token) {
      //     console.warn("⚠️ Token não fornecido. Acesso negado.");
      //     return res.status(401).json({ erro: 'Token não fornecido.' });
      // }
      
      if (token == null) {
              console.warn("⚠️ Token não fornecido. Acesso não autorizado.");
              return res.status(401).json({ erro: 'Token não fornecido. Acesso não autorizado.' });
      }

      console.log("Todos os headers recebidos AUTENTICAR TOKEN:", req.headers);
  
      const idempresaFromHeader = req.get('x-id-empresa') || req.get('idempresa');    
  
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
      
      // // --- CORREÇÃO AQUI: Garante que req.idempresa seja definido ---
      //   if (decoded && typeof decoded.idempresaDefault === 'number') { // Verifica se é um número
      //       req.idempresa = decoded.idempresaDefault;
      //       console.log("Empresa default do token definida em req.idempresa:", req.idempresa);
      //   } else if (req.headers['idempresa']) { // Fallback para cabeçalho, se idempresaDefault não estiver no token
      //       req.idempresa = parseInt(req.headers['idempresa']); // Garante que é número
      //       console.log("Empresa definida a partir do cabeçalho em req.idempresa:", req.idempresa);
      //   } else {
      //       // Este console.warn é importante. Se o token não tem idempresaDefault E o header não tem,
      //       // então `req.idempresa` continuará undefined, o que pode causar o NaN.
      //       console.warn("⚠️ idempresaDefault não encontrado no token nem no cabeçalho. `req.idempresa` não definido em autenticarToken.");
      //       // Você pode decidir retornar um erro aqui se idempresa for *sempre* obrigatório para a rota.
      //       // Por enquanto, apenas avisamos e continuamos.
      //   }

      if (verificarEmpresa) {
                let currentIdEmpresa;

                // Prioriza o cabeçalho se fornecido e válido
                if (idempresaFromHeader) {
                    const parsedHeaderId = parseInt(idempresaFromHeader, 10);
                    // Certifica-se de que é um número válido e que o usuário tem acesso a essa empresa
                    if (!isNaN(parsedHeaderId) && decoded.empresas && decoded.empresas.includes(parsedHeaderId)) {
                         currentIdEmpresa = parsedHeaderId;
                         console.log("Empresa selecionada do cabeçalho e validada:", currentIdEmpresa);
                    } else if (!isNaN(parsedHeaderId) && decoded.empresas && !decoded.empresas.includes(parsedHeaderId)) {
                        // O usuário tentou acessar uma empresa à qual não tem permissão
                        console.warn(`⚠️ Usuário ${decoded.idusuario} tentou acessar empresa ${parsedHeaderId} sem permissão.`);
                        return res.status(403).json({ erro: 'Acesso negado à empresa especificada.' });
                    }
                }
                
                // Retorna para idempresaDefault do token se não houver ID de cabeçalho válido ou se o cabeçalho não foi fornecido
                if (!currentIdEmpresa && typeof decoded.idempresaDefault === 'number') {
                    currentIdEmpresa = decoded.idempresaDefault;
                    console.log("Empresa definida como padrão do token:", currentIdEmpresa);
                }

                // Se ainda não houver empresa e o usuário tiver pelo menos uma empresa vinculada, usa a primeira como último recurso
                if (!currentIdEmpresa && decoded.empresas && decoded.empresas.length > 0) {
                    currentIdEmpresa = decoded.empresas[0];
                    console.log("Empresa definida como a primeira da lista de empresas acessíveis:", currentIdEmpresa);
                }

                if (currentIdEmpresa) {
                    req.idempresa = currentIdEmpresa;
                    console.log("req.idempresa final para verificação de empresa:", req.idempresa);
                } else {
                    console.warn("⚠️ Não foi possível determinar o ID da empresa para a requisição. req.idempresa não definido.");
                    // Este é um ponto crítico. Se uma rota exige `verificarEmpresa`, e nenhuma empresa pôde ser determinada,
                    // você provavelmente deve retornar um erro aqui.
                    return res.status(400).json({ erro: 'Contexto de empresa necessário, mas não especificado ou inválido.' });
                }
            } else {
                // Se verificarEmpresa for false, ainda podemos querer definir req.idempresa para logs ou outros fins
                // Tentará usar o cabeçalho primeiro, depois o padrão do token, depois o primeiro disponível.
                req.idempresa = parseInt(idempresaFromHeader || decoded.idempresaDefault || (decoded.empresas && decoded.empresas.length > 0 ? decoded.empresas[0] : null), 10);
                if (isNaN(req.idempresa)) {
                     req.idempresa = null; // Garante que não seja NaN se nenhuma empresa for encontrada
                }
                console.log("req.idempresa definido (verificarEmpresa=false):", req.idempresa);
            }
        console.log(`Usuário autenticado: ${decoded.email}. idusuario: ${req.usuario.idusuario}.`); // Log corrigido
        console.log("Empresa definida para requisição (final de autenticarToken):", req.idempresa); // Log para ver o valor final
        next();        
    
    });
  }
}

function contextoEmpresa(req, res, next) {
  console.log("➡️ Entrou no contextoEmpresa. req.idempresa atual:", req.idempresa); // Log corrigido para mostrar o valor
 
   // Se idempresa já veio do token em autenticarToken, use-o
    const idempresa = req.idempresa; 

    // Se não veio do token (raro para rotas protegidas), pode tentar de outros lugares
   if (!idempresa || isNaN(idempresa)) { // Adicionado isNaN para pegar o erro do NaN
        console.warn("⚠️ ID da empresa é obrigatório ou inválido (NaN) para verificação de contexto.");
        return res.status(400).json({ erro: "ID da empresa é obrigatório ou inválido." });
    }

   // req.idempresa = parseInt(idempresa); // Garante que é um número inteiro
    console.log("Contexto Empresa ok. req.idempresa:", req.idempresa);
    next();
}


module.exports = { autenticarToken, contextoEmpresa };
