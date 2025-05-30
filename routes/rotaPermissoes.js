const express = require('express');
const router = express.Router();
const { autenticarToken } = require('../middlewares/authMiddlewares');
const {
  listarPermissoes,
  listarPermissoesPorUsuario,
  cadastrarOuAtualizarPermissoes,
  deletarPermissao
} = require('../controllers/permissoesController');

// Listar todas permissões
router.get('/', autenticarToken({ verificarEmpresa: false }), listarPermissoes);

// Listar permissões de um usuário
router.get('/:idusuario', autenticarToken({ verificarEmpresa: false }), listarPermissoesPorUsuario);

// Cadastrar ou atualizar permissões
router.post('/cadastro', autenticarToken({ verificarEmpresa: false }), cadastrarOuAtualizarPermissoes);

// Deletar uma permissão específica
router.delete('/:idpermissao', autenticarToken({ verificarEmpresa: false }), deletarPermissao);

module.exports = router;
