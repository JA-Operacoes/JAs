// routes/auth.js
const express = require('express');
const router = express.Router();
const { cadastrarOuAtualizarUsuario, login, verificarUsuarioExistente, listarUsuarios, buscarUsuariosPorNome } = require('../controllers/authController');

router.post('/cadastro', cadastrarOuAtualizarUsuario);
router.put('/cadastro', cadastrarOuAtualizarUsuario);
// Rota para verificar se o usuário existe
router.post('/verificarUsuario', verificarUsuarioExistente);
router.get('/usuarios', listarUsuarios);
router.get('/buscarUsuarios', buscarUsuariosPorNome);

router.post('/login', login);

module.exports = router;
