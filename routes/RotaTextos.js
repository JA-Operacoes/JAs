const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB");
const { autenticarToken, contextoEmpresa } = require('../middlewares/authMiddlewares');
const { verificarPermissao } = require('../middlewares/permissaoMiddleware');
const logMiddleware = require('../middlewares/logMiddleware');

// Configuração básica de segurança e contexto
router.use(autenticarToken());
router.use(contextoEmpresa);

// Buscar todos os textos
router.get("/", 
    verificarPermissao('Textospredefinidos', 'pesquisar'), 
    async (req, res) => {
        const { titulo } = req.query; // Pega o título da URL
        try {
            let queryText = "SELECT * FROM propostatextos";
            let params = [];

            if (titulo) {
                // Busca exata (ignore case)
                queryText += " WHERE UPPER(titulo) = UPPER($1)";
                params.push(titulo);
            } else {
                queryText += " ORDER BY categoria ASC, id ASC";
            }

            const result = await pool.query(queryText, params);
            res.json({ success: true, data: result.rows });
        } catch (error) {
            res.status(500).json({ error: "Erro interno." });
        }
    }
);

// Salvar ou Atualizar um texto
router.post("/", 
    verificarPermissao('Textospredefinidos', 'cadastrar'), 
    logMiddleware('Cadastro de Texto da Proposta'),
    async (req, res) => {
        // Incluímos 'categoria' que vem do seu <select> no HTML
        const { idTexto, titulo, conteudo, ativo, categoria } = req.body;
        
        try {
            if (idTexto) {
                // Atualização: agora inclui a coluna categoria
                const result = await pool.query(
                    "UPDATE propostatextos SET titulo = $1, conteudo = $2, ativo = $3, categoria = $4 WHERE id = $5",
                    [titulo, conteudo, ativo, categoria, idTexto]
                );
                
                if (result.rowCount === 0) {
                    return res.status(404).json({ error: "Texto não encontrado para atualização." });
                }
            } else {
                // Inserção: agora inclui a coluna categoria
                await pool.query(
                    "INSERT INTO propostatextos (titulo, conteudo, ativo, categoria) VALUES ($1, $2, $3, $4)",
                    [titulo, conteudo, ativo, categoria]
                );
            }
            
            res.json({ success: true, message: "Texto salvo com sucesso!" });
        } catch (error) {
            console.error("Erro ao salvar o texto:", error);
            res.status(500).json({ error: "Erro ao salvar o texto." });
        }
    }
);

module.exports = router;