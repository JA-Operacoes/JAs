// routes/auth.js
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const { autenticarToken } = require('../middlewares/authMiddlewares');
const logMiddleware = require('../middlewares/logMiddleware');

// Trava de força bruta: 5 tentativas SEM SUCESSO de login por IP a cada 15 minutos.
// skipSuccessfulRequests: sem isso, o express-rate-limit conta TODA requisição
// pro /login (inclusive as que deram certo) — um usuário que loga normalmente
// várias vezes em 15 minutos (ex.: token expirou, trocou de aba) acabava sendo
// bloqueado mesmo digitando a senha certa toda vez.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { erro: 'Muitas tentativas de login. Tente novamente em alguns minutos.' },
});



const { cadastrarOuAtualizarUsuario, verificarUsuarioExistente, listarUsuarios, buscarUsuariosPorNome, buscarUsuarioPorEmail, listarPermissoes, verificarNomeExistente, listarEmpresasDoUsuario, buscarModulos, carregarTodasEmpresas  } = require('../controllers/authController');

router.post('/login', loginLimiter, authController.login);

router.post('/cadastro', autenticarToken({ verificarEmpresa: false }), cadastrarOuAtualizarUsuario);
router.put('/cadastro', autenticarToken({ verificarEmpresa: false }),  cadastrarOuAtualizarUsuario);
// Rota para verificar se o usuário existe
router.post('/verificarUsuario',autenticarToken({ verificarEmpresa: false }), verificarUsuarioExistente);
router.post('/verificarNomeExistente', autenticarToken({ verificarEmpresa: false }), verificarNomeExistente);
router.post('/verificarNomeCompleto', autenticarToken({ verificarEmpresa: false }), authController.verificarNomeCompleto);
router.get('/usuarios', autenticarToken({ verificarEmpresa: false }), listarUsuarios);
router.get('/buscarUsuarios', autenticarToken({ verificarEmpresa: false }), buscarUsuariosPorNome);

router.get('/usuarios/:id/empresas', autenticarToken({ verificarEmpresa: false }), listarEmpresasDoUsuario);

router.get('/usuarios/modulos', autenticarToken({ verificarEmpresa: false }), buscarModulos);

router.get('/email/:email', autenticarToken({ verificarEmpresa: false }), buscarUsuarioPorEmail );
// Rota para verificar se o usuário existe
router.get('/permissoes', autenticarToken({ verificarEmpresa: false }), authController.listarPermissoes);

router.get('/empresas', autenticarToken({ verificarEmpresa: false }), carregarTodasEmpresas);

module.exports = router;
