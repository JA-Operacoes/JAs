const express = require('express');
const router = express.Router();
const db = require("../db/conexaoDB");
const { autenticarToken } = require('../middlewares/authMiddlewares');
const permissoesController = require('../controllers/permissoesController'); // Importe o controller
const logMiddleware = require('../middlewares/logMiddleware');

// Listar todas permissões
router.get('/', autenticarToken({ verificarEmpresa: false }), permissoesController.listarPermissoes);

// Listar permissões de um usuário
router.get('/:idusuario', autenticarToken({ verificarEmpresa: false }), permissoesController.listarPermissoesPorUsuario);

// Cadastrar ou atualizar permissões
//router.post('/cadastro', autenticarToken({ verificarEmpresa: false }), logMiddleware('permissoes'),permissoesController.cadastrarOuAtualizarPermissoes);
router.post('/cadastro', autenticarToken({ verificarEmpresa: false }), 
    logMiddleware('permissoes', {
        buscarDadosAnteriores: async (req) => {
            const { idusuario, modulo } = req.body;
            const idempresa = req.headers.idempresa;

            console.log('Buscando dados anteriores para:', { idusuario, modulo, idempresa }); // NOVO LOG
            const result = await db.query(
                'SELECT acesso, modulo, cadastrar, alterar, pesquisar FROM permissoes WHERE idusuario = $1 AND modulo = $2 AND idempresa = $3',
                [idusuario, modulo, idempresa]
            );
            const linha = result.rows[0] || null; // Se não encontrar, será null
            console.log('Dados anteriores encontrados:', linha); // NOVO LOG
            return {
                dadosanteriores: linha, // Passa o OBJETO encontrado (ou null)
                idregistroalterado: linha?.id || null // Usa 'id' para o ID do registro existente
            };
        }
    }),
    permissoesController.cadastrarOuAtualizarPermissoes);
// Deletar uma permissão específica
//router.delete('/:idpermissao', autenticarToken({ verificarEmpresa: false }), deletarPermissao);

module.exports = router;
