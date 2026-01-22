const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB");
const { autenticarToken, contextoEmpresa } = require('../middlewares/authMiddlewares');
const { verificarPermissao } = require('../middlewares/permissaoMiddleware');
const logMiddleware = require('../middlewares/logMiddleware');

// Aplica autenticação em todas as rotas
router.use(autenticarToken());
router.use(contextoEmpresa);

router.get("/empresas", autenticarToken(), async (req, res) => {    
  console.log("Chegou na rota de empresas do centro de custo");
    try {
        const result = await pool.query(
            `SELECT idempresa, nmfantasia, razaosocial
             FROM empresas           
             ORDER BY nmfantasia ASC`,
        );

        console.log("Empresas do usuário buscadas com sucesso.");
        res.json(result.rows);
        
    } catch (error) {
        console.error("Erro ao buscar empresas do usuário:", error);
        res.status(500).json({ message: "Erro ao buscar empresas do usuário" });
    }
});

router.get("/contas",  async (req, res) => {
  
  const idempresa = req.idempresa;
  try {
    
      const result = await pool.query(
        `SELECT * FROM contas WHERE idempresa = $1 ORDER BY nmconta ASC`,
        [idempresa]
      );
      return result.rows.length
        ? res.json(result.rows)
        : res.status(404).json({ message: "Nenhuma conta encontrada" });
    
  } catch (error) {
    console.error("Erro ao buscar conta:", error);
    res.status(500).json({ message: "Erro ao buscar conta" });
  }
});

// GET todas ou por nome
router.get("/", verificarPermissao('centrocusto', 'pesquisar'), async (req, res) => {
  const nmCentrocusto = req.query.nmCentrocusto || null;
  
  try {
      if (nmCentrocusto) {
          // Quando buscamos por um nome específico, queremos TODOS os vínculos (empresas) desse nome
          // Incluímos 'ativoempresa' para o frontend saber quem desmarcar
          const result = await pool.query(
              `SELECT c.idcentrocusto, c.nmcentrocusto, c.ativo, c.idempresa, c.ativoempresa, e.nmfantasia 
               FROM centrocusto c
               LEFT JOIN empresas e ON e.idempresa = c.idempresa
               WHERE c.nmcentrocusto ILIKE $1::text`, 
              [nmCentrocusto]
          );

          if (result.rows.length === 0) {
              return res.status(404).json({ message: "Centro de custo não encontrado" });
          }

          return res.json(result.rows);
      } else {
   
          const result = await pool.query(
              `SELECT DISTINCT ON (nmcentrocusto) 
                      idcentrocusto, nmcentrocusto, ativo 
               FROM centrocusto 
               ORDER BY nmcentrocusto ASC`
          );
          return res.json(result.rows);
      }
  } catch (error) {
      console.error("Erro ao buscar centrocusto:", error);
      res.status(500).json({ message: "Erro ao buscar centrocusto" });
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
    const idReferencia = req.params.id;
    // Captura garantindo compatibilidade com o que vier do body
   
    const { ativo, empresas } = req.body; // 'ativo' vem do checkbox (Status do Centro de Custo)
    const nmCentroCusto = req.body.nmCentroCusto;

    try {
        await pool.query("BEGIN");

        // 1. Tratamos as empresas que foram DESMARCADAS
        // Elas continuam existindo, mas o vínculo (ativoempresa) passa a ser FALSE
        const idsString = (empresas && empresas.length > 0) ? empresas.join(',') : '0';
        
        await pool.query(
            `UPDATE centrocusto 
            SET ativoempresa = false 
            WHERE nmcentrocusto = $1 AND idempresa NOT IN (${idsString})`,
            [nmCentroCusto]
        );

        // 2. Tratamos as empresas que estão MARCADAS (Selecionadas)
        for (const idEmp of empresas) {
            await pool.query(
                `INSERT INTO centrocusto (nmcentrocusto, ativo, idempresa, ativoempresa)
                VALUES ($1, $2, $3, true)
                ON CONFLICT (nmcentrocusto, idempresa) 
                DO UPDATE SET 
                    ativo = EXCLUDED.ativo, -- Atualiza o status global (checkbox)
                    ativoempresa = true     -- Garante que o vínculo desta empresa está ativo
                `,
                [nmCentroCusto, ativo, idEmp]
            );
        }

        await pool.query("COMMIT");
        res.json({ message: "Centro de Custo e vínculos atualizados com sucesso!" });
    } catch (error) {
        await pool.query("ROLLBACK");
        console.error("Erro no processamento:", error);
        res.status(500).json({ message: "Erro ao salvar alterações." });
    }

});


router.post("/", 
  verificarPermissao('centrocusto', 'cadastrar'), 
  // Removido o console.log solto. Se quiser logar, faça dentro de uma função:
  (req, res, next) => {
    console.log("Chegou na rota de criação de centro de custo");
    next();
  },
  logMiddleware('CentroCusto', { 
      buscarDadosAnteriores: async (req) => {
        return { dadosanteriores: null, idregistroalterado: null };
      }
  }),
  async (req, res) => {
    const { nmCentroCusto, ativo, empresas } = req.body; // 'empresas' é um array [1, 2, 3]

    try {
        // Iniciamos uma transação para garantir que ou salva todos ou nenhum
        await pool.query("BEGIN");

        const promessas = empresas.map(idEmp => {
            return pool.query(
                "INSERT INTO centrocusto (nmcentrocusto, ativo, idempresa) VALUES ($1, $2, $3)", 
                [nmCentroCusto, ativo, idEmp]
            );
        });

        await Promise.all(promessas);
        await pool.query("COMMIT");

        res.status(201).json({ mensagem: "Centro de Custo vinculado às empresas com sucesso!" });
    } catch (error) {
        await pool.query("ROLLBACK");
        console.error("Erro ao salvar:", error);
        res.status(500).json({ erro: "Erro ao salvar centro de custo múltiplo." });
    }
});

module.exports = router;