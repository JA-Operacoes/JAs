// middlewares/logMiddleware.js
const registrarLog = require('../utils/logger');

function logMiddleware(modulo, options = {}) {
  const { acao: defaultAcao = '', buscarDadosAnteriores = null } = options;

  return async (req, res, next) => {
    let fetchedDadosAnteriores = null;
    let fetchedIdRegistroAlterado = null;

    // AQUI: Tenta buscar dados anteriores *antes* da operação do controller.
    // É importante que essa busca aconteça ANTES do controller modificar o DB.
    // Isso é feito pela função `buscarDadosAnteriores` que o router passa.
    if (typeof buscarDadosAnteriores === 'function') {
      try {
        const result = await buscarDadosAnteriores(req);
        fetchedDadosAnteriores = result?.dadosanteriores || null;
        fetchedIdRegistroAlterado = result?.idregistroalterado || null;
      } catch (error) {
        console.error('Erro ao buscar dados anteriores para log no middleware:', error);
      }
    }

    res.on('finish', async () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          const acaoFinal = res.locals.acao || defaultAcao || 'modificou';
          const idregistroalterado = res.locals.idregistroalterado || fetchedIdRegistroAlterado || null;
          const idusuarioAlvo = res.locals.idusuarioAlvo || null;

          const dadosnovos = req.body;

          // AQUI: Decidimos se queremos registrar os dados anteriores.
          // Se a ação final for 'cadastrou', não há dados anteriores para esse ID.
          // Se for 'atualizou' ou 'deletou', e fetchedDadosAnteriores existe, use-o.
          const finalDadosAnteriores = (acaoFinal === 'atualizou' || acaoFinal === 'deletou')
                                       ? fetchedDadosAnteriores
                                       : null;

          await registrarLog({
            idexecutor: req.usuario?.idusuario,
            idempresa: req.headers.idempresa || null,
            acao: acaoFinal,
            modulo: modulo,
            idregistroalterado: idregistroalterado,
            idusuarioalvo: idusuarioAlvo,
            dadosanteriores: finalDadosAnteriores, // Passa o objeto RAW (ou null)
            dadosnovos: dadosnovos // Passa o objeto RAW
          });

        } catch (erro) {
          console.error('Erro ao registrar log final:', erro);
        }
      }
    });

    next();
  };
}

module.exports = logMiddleware;