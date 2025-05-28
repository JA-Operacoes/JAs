// routes/auth.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { autenticarToken } = require('../middlewares/authMiddlewares');
const { getEmpresasDoUsuario } = require('../controllers/authController');

const { cadastrarOuAtualizarUsuario, login, verificarUsuarioExistente, listarUsuarios, buscarUsuariosPorNome, buscarUsuarioPorEmail, listarPermissoes, verificarNomeExistente  } = require('../controllers/authController');

router.post('/cadastro', cadastrarOuAtualizarUsuario);
router.put('/cadastro', cadastrarOuAtualizarUsuario);
// Rota para verificar se o usuário existe
router.post('/verificarUsuario', verificarUsuarioExistente);
router.post('/verificarNomeExistente', verificarNomeExistente);
router.post('/verificarNomeCompleto', authController.verificarNomeCompleto);
router.get('/usuarios', listarUsuarios);
router.get('/buscarUsuarios', buscarUsuariosPorNome);


router.post('/login', authController.login);

router.get('/email/:email', buscarUsuarioPorEmail );
// Rota para verificar se o usuário existe
router.get('/permissoes', autenticarToken, authController.listarPermissoes);

module.exports = router;
