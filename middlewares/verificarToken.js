const jwt = require("jsonwebtoken");

const verificarToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Formato: "Bearer <token>"

  if (!token) {
    return res.status(401).json({ erro: "Token não fornecido" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, usuario) => {
    if (err) {
      return res.status(401).json({ erro: "Token inválido ou expirado" });
    }
    req.usuario = usuario; // adiciona info do usuário no request
    next();
  });
};

module.exports = verificarToken;
