const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB");
const { autenticarToken, contextoEmpresa } = require('../middlewares/authMiddlewares');
const { verificarPermissao } = require('../middlewares/permissaoMiddleware');
const logMiddleware = require('../middlewares/logMiddleware');

// Configuração básica de segurança e contexto
router.use(autenticarToken());
router.use(contextoEmpresa);

router.get("/", 
    verificarPermissao('Textospredefinidos', 'pesquisar'), 
    async (req, res) => {
        try {
            // Verifique se o middleware injeta 'idempresa' ou 'id_empresa'
            const idempresa_logada = req.idempresa; 

            // Alterado para bater com seu banco: idtexto, idempresa
            const result = await pool.query(
                "SELECT idtexto as id, titulo, conteudo, categoria, ativo FROM propostatextos WHERE idempresa = $1 AND ativo = true ORDER BY titulo ASC",
                [idempresa_logada]
            );
            
            // O console log abaixo é seu melhor amigo agora:
            console.log(`Buscando textos para empresa ID: ${idempresa_logada}. Encontrados: ${result.rowCount}`);

            res.json({ success: true, data: result.rows });
        } catch (error) {
            console.error("❌ Erro ao buscar textos:", error.message);
            res.status(500).json({ error: "Erro ao carregar textos." });
        }
    }
);

// Salvar ou Atualizar um texto
// ROTA POST (Unificada para Salvar Novo ou Atualizar Existente)
router.post("/", 
    verificarPermissao('Textospredefinidos', 'cadastrar'), 
    logMiddleware('Cadastro de Texto da Proposta'),
    async (req, res) => {
        const { idTexto, titulo, conteudo, ativo, categoria } = req.body;
        
        // Tente usar req.idempresa ou req.user.id_empresa conforme seu sistema
        const idempresa_logada = req.idempresa || (req.user && req.user.id_empresa); 

        try {
            if (idTexto && idTexto !== "") {
                // UPDATE - Ajustado para 'idtexto' e 'idempresa'
                const result = await pool.query(
                    "UPDATE propostatextos SET titulo = $1, conteudo = $2, ativo = $3, categoria = $4 WHERE idtexto = $5 AND idempresa = $6",
                    [titulo, conteudo, ativo, categoria, idTexto, idempresa_logada]
                );
                
                return res.json({ success: true, message: "Texto atualizado com sucesso!" });

            } else {
                // INSERT - Ajustado para 'idempresa'
                await pool.query(
                    "INSERT INTO propostatextos (titulo, conteudo, ativo, categoria, idempresa) VALUES ($1, $2, $3, $4, $5)",
                    [titulo, conteudo, ativo, categoria, idempresa_logada]
                );
                
                return res.json({ success: true, message: "Texto cadastrado com sucesso!" });
            }
            
        } catch (error) {
            console.error("❌ Erro Crítico no Banco:", error.message);
            res.status(500).json({ error: "Erro interno ao processar banco de dados." });
        }
    }
);

router.put("/:id", 
    verificarPermissao('Textospredefinidos', 'alterar'), // Ou 'editar', dependendo da sua lógica
    logMiddleware('Atualização de Texto da Proposta'),
    async (req, res) => {
        const { id } = req.params; // Pega o ID da URL
        const { titulo, conteudo, ativo, categoria } = req.body;

        try {
            const result = await pool.query(
                "UPDATE propostatextos SET titulo = $1, conteudo = $2, ativo = $3, categoria = $4 WHERE id = $5",
                [titulo, conteudo, ativo, categoria, id]
            );

            if (result.rowCount === 0) {
                return res.status(404).json({ error: "Texto não encontrado para atualização." });
            }

            res.json({ success: true, message: "Texto atualizado com sucesso!" });
        } catch (error) {
            console.error("Erro ao atualizar o texto:", error);
            res.status(500).json({ error: "Erro ao atualizar o texto." });
        }
    }
);

module.exports = router;