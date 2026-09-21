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
        // ORDER BY ordem (fixa, ver migration adiciona_ordem_fixa_nas_empresas) — antes
        // era alfabético, e como cada página exclui a própria empresa da barra "Trocar
        // empresa", a ordem relativa das demais mudava dependendo de onde você estava,
        // dando impressão de ícone "pulando de lugar". NULLS LAST cobre empresa futura
        // sem essa coluna preenchida ainda (cai no fim, alfabética entre si).
        const result = await db.query(
            'SELECT idempresa, nmfantasia, urlindex, ativo, logo, iconeescuro, iconeclaro FROM empresas ORDER BY ordem NULLS LAST, nmfantasia'
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Erro ao listar empresas:', err);
        res.status(500).json({ erro: 'Erro interno do servidor.' });
    }
});

module.exports = router;