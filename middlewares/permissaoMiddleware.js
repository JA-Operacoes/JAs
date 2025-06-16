// // middlewares/permissaoMiddleware.js
 const db = require('../db');


// middleware: verifica se o usuário pode executar uma ação em um módulo e empresa
function verificarPermissao(modulo, acao) {
 
   return async (req, res, next) => {

    console.log("🔍 Verificando permissões para:", modulo, acao);
    
    const idusuario = req.usuario.idusuario; // O idusuario vem do token (definido em autenticarToken)
    const idempresa = req.idempresa; // idempresa já deve estar definido por autenticarToken ou contextoEmpresa

    // Verificação inicial se idusuario e idempresa estão presentes
    if (!idusuario || !idempresa) {
        console.warn(`⚠️ Erro de permissão: idusuario (${idusuario}) ou idempresa (${idempresa}) não definido.`);
        return res.status(401).json({ erro: "Autenticação ou contexto da empresa ausente ou inválido." });
    }    

    if (!idempresa) { // Adicione uma verificação se idempresa não foi definido
        console.warn("⚠️ ID da empresa não encontrado em req.idempresa. Certifique-se de que autenticarToken o define.");
        return res.status(400).json({ erro: "ID da empresa é obrigatório para verificação de permissões." });
    }

    const moduloNormalizado = modulo.toLowerCase();
    const acaoNormalizada = acao.toLowerCase();

    console.log("🧪 Verificando permissões");
    console.log("Usuário ID:", idusuario);
    console.log("Empresa ID:", idempresa);
    console.log("Módulo:", moduloNormalizado);
    console.log("Ação:", acaoNormalizada);

    try {
      const query = `
        SELECT * FROM permissoes
        WHERE idusuario = $1 AND LOWER(modulo) = $2 AND idempresa = $3
      `;
console.log('🔍 Iniciando consulta permissão...');
      const { rows } = await db.query(query, [idusuario, moduloNormalizado, idempresa]);
console.log('✅ Consulta permissão retornou:', rows);
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
