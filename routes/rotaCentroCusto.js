const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB");
const { autenticarToken, contextoEmpresa } = require('../middlewares/authMiddlewares');
const { verificarPermissao } = require('../middlewares/permissaoMiddleware');
const logMiddleware = require('../middlewares/logMiddleware');

// Aplica autenticação em todas as rotas
router.use(autenticarToken());
router.use(contextoEmpresa);



// GET todas ou por nome
router.get("/", verificarPermissao('centrocusto', 'pesquisar'), async (req, res) => {
    const { nmCentrocusto, sigla } = req.query; // Pega ambos da query string
  
    try {
        let query = `SELECT * FROM centrocusto WHERE 1=1`;
        let params = [];

        if (nmCentrocusto) {
            query += ` AND nmcentrocusto ILIKE $1`;
            params.push(nmCentrocusto);
        } else if (sigla) {
            query += ` AND sigla = $1`; // Busca exata para sigla
            params.push(sigla.toUpperCase());
        } else {
            // Busca todos se não houver filtro
            const result = await pool.query(`SELECT * FROM centrocusto ORDER BY nmcentrocusto ASC`);
            return res.json(result.rows);
        }

        const result = await pool.query(query, params);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Nenhum registro encontrado" });
        }

        return res.json(result.rows);
    } catch (error) {
        console.error("Erro ao buscar:", error);
        res.status(500).json({ message: "Erro interno" });
    }
});


router.put("/:id", 
  verificarPermissao('centrocusto', 'alterar'),
  logMiddleware('CentroCusto', {
      buscarDadosAnteriores: async (req) => {
          const idCentrocusto = req.params.id;
          try {
              // Buscamos o registro principal para o log
              const result = await pool.query(
                  `SELECT * FROM centrocusto WHERE idcentrocusto = $1`,
                  [idCentrocusto]
              );
              const linha = result.rows[0] || null;
              return {
                  dadosanteriores: linha,
                  idregistroalterado: linha?.idcentrocusto || null
              };
          } catch (error) {
              return { dadosanteriores: null, idregistroalterado: null };
          }
      }
  }),
  async (req, res) => {
    const idCentroCusto = req.params.id;
    const idempresaContexto = req.idempresa;
    // Captura garantindo compatibilidade com o que vier do body
   
    const { nmCentroCusto, sgCentroCusto } = req.body; // 'ativo' vem do checkbox (Status do Centro de Custo)
    
    const ativo = req.body.ativo === true || req.body.ativo === 'true';

    try {        
        
        const result = await pool.query(
            `UPDATE centrocusto 
            SET ativo = $1, nmcentrocusto = $2, sigla = $3
            WHERE idcentrocusto = $4 AND idempresa = $5`,
            [ativo, nmCentroCusto, sgCentroCusto, idCentroCusto, idempresaContexto]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ message: "Registro não encontrado para esta empresa." });
        }

        res.json({ message: "Centro de Custo atualizado com sucesso!" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Erro ao salvar alterações." });
    }

});


router.post("/", 
  verificarPermissao('centrocusto', 'cadastrar'),  
  
  logMiddleware('CentroCusto', { 
      buscarDadosAnteriores: async (req) => {
        return { dadosanteriores: null, idregistroalterado: null };
      }
  }),
  async (req, res) => {
    const { nmCentroCusto, sgCentroCusto  } = req.body; // 'empresas' é um array [1, 2, 3]
    const ativo = req.body.ativo === true || req.body.ativo === 'true';
    const idempresaContexto = req.idempresa;

    try {
        const result = await pool.query(
            `INSERT INTO centrocusto (nmcentrocusto, sigla, ativo, idempresa) 
             VALUES ($1, $2, $3, $4) 
             RETURNING idcentrocusto`, 
            [nmCentroCusto, sgCentroCusto, ativo, idempresaContexto]
        );

        res.status(201).json({ message: "Centro de Custo cadastrado com sucesso!", id: result.rows[0].idcentrocusto });
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: "Erro ao salvar centro de custo." });
    }
});

module.exports = router;