const express = require('express');
const router = express.Router();
const {
  listarPermissoes,
  listarPermissoesPorUsuario,
  cadastrarOuAtualizarPermissoes,
  deletarPermissao
} = require('../controllers/permissoesController');

// Listar todas permissões
router.get('/', listarPermissoes);

// Listar permissões de um usuário
router.get('/:idusuario', listarPermissoesPorUsuario);

// Cadastrar ou atualizar permissões
router.post('/cadastro', cadastrarOuAtualizarPermissoes);

// Deletar uma permissão específica
router.delete('/:idpermissao', deletarPermissao);

module.exports = router;
