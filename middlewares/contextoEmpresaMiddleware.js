function contextoEmpresaMiddleware(req, res, next) {
  const idempresa = req.headers['idempresa'] || req.body.idempresa || req.query.idempresa;

  if (!idempresa) {
    return res.status(400).json({ erro: 'ID da empresa não foi fornecido.' });
  }

  // Armazena no request para uso em outros middlewares ou rotas
  req.idempresa = idempresa;

  next();
}

module.exports = contextoEmpresaMiddleware;
