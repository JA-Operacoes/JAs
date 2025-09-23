const express = require('express');
const router = express.Router();
const db = require('../db'); 


router.get('/modulos', async (req, res) => {

    console.log("ENTROU NA ROTA DE MODULOS PELO INDEX - RotaIndex");
    try {        
        const modulos = await db.query('SELECT modulo FROM modulos ORDER BY modulo');        
      
        if (!modulos || modulos.length === 0) {
            return res.status(404).json({ message: 'Nenhum módulo encontrado.' });
        }

        res.json(modulos);
    } catch (error) {
        console.error('Erro ao buscar módulos:', error);
        res.status(500).json({ erro: 'Erro interno do servidor ao buscar módulos.' });
    }
});

router.get('/empresas', async (req, res) => {
    console.log("🔍 Buscando lista de empresas na Rota Index");
    try {
        const result = await db.query('SELECT idempresa, nmfantasia FROM empresas');
        res.json(result.rows);
    } catch (err) {
        console.error('Erro ao listar empresas:', err);
        res.status(500).json({ erro: 'Erro interno do servidor.' });
    }
});

module.exports = router;