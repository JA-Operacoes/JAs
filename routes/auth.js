// routes/auth.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { autenticarToken } = require('../middlewares/authMiddlewares');
const { getEmpresasDoUsuario } = require('../controllers/authController');

const { cadastrarOuAtualizarUsuario, login, verificarUsuarioExistente, listarUsuarios, buscarUsuariosPorNome, buscarUsuarioPorEmail, listarPermissoes, verificarNomeExistente  } = require('../controllers/authController');

router.post('/cadastro', autenticarToken({ verificarEmpresa: false }), cadastrarOuAtualizarUsuario);
router.put('/cadastro', autenticarToken({ verificarEmpresa: false }), cadastrarOuAtualizarUsuario);
// Rota para verificar se o usuário existe
router.post('/verificarUsuario',autenticarToken({ verificarEmpresa: false }), verificarUsuarioExistente);
router.post('/verificarNomeExistente', autenticarToken({ verificarEmpresa: false }), verificarNomeExistente);
router.post('/verificarNomeCompleto', authController.verificarNomeCompleto);
router.get('/usuarios', autenticarToken({ verificarEmpresa: false }), listarUsuarios);
router.get('/buscarUsuarios', autenticarToken({ verificarEmpresa: false }), buscarUsuariosPorNome);


router.post('/login', authController.login);

router.get('/email/:email', autenticarToken({ verificarEmpresa: false }), buscarUsuarioPorEmail );
// Rota para verificar se o usuário existe
router.get('/permissoes', autenticarToken({ verificarEmpresa: false }), authController.listarPermissoes);

module.exports = router;
