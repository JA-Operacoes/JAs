const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB");
const { autenticarToken, contextoEmpresa} = require('../middlewares/authMiddlewares');
const { verificarPermissao } = require('../middlewares/permissaoMiddleware');
const logMiddleware = require('../middlewares/logMiddleware');

// Aplica autenticação em todas as rotas
router.use(autenticarToken());
router.use(contextoEmpresa);

// GET todas ou por descrição
router.get("/", verificarPermissao('Funcao', 'pesquisar'), async (req, res) => {
  console.log("Rota de função acessada - GET", req.query);
  const idempresa = req.idempresa;
  const { descFuncao } = req.query;
  console.log("descFuncao na ROTAFUNCAO", descFuncao);
  try {
    if (descFuncao) {
      const result = await pool.query(
        `SELECT f.* 
        FROM funcao f
        INNER JOIN funcaoempresas fe ON f.idfuncao = fe.idfuncao
        WHERE fe.idempresa = $1 AND descFuncao ILIKE $2 LIMIT 1`, 
        [idempresa, descFuncao]
      );
      return result.rows.length
        ? res.json(result.rows[0])
        : res.status(404).json({ message: "Funcao não encontrada" });
    } else {
      const result = await pool.query(`
        SELECT f.* 
        FROM funcao f
        INNER JOIN funcaoempresas fe ON f.idfuncao = fe.idfuncao
        WHERE fe.idempresa = $1
        ORDER BY descFuncao ASC`,
        [idempresa]
      );
      return result.rows.length
        ? res.json(result.rows)
        : res.status(404).json({ message: "Nenhuma função encontrada" });
    }
  } catch (error) {
    console.error("Erro ao buscar função:", error);
    res.status(500).json({ message: "Erro ao buscar função" });
  }
});

// PUT atualizar
router.put("/:id", autenticarToken({ verificarEmpresa: false }),
  logMiddleware('Funcoes', { // ✅ Módulo 'Funcoes' para o log
    buscarDadosAnteriores: async (req) => {
      const idFuncao = req.params.id; 
      const idempresa = req.idempresa; 

      if (!idFuncao) {
          return { dadosanteriores: null, idregistroalterado: null };
      }
      
      try {          
          const result = await pool.query(
              `SELECT f.* FROM funcao f
                INNER JOIN funcaoempresas fe ON fe.idfuncao = f.idfuncao
                WHERE f.idFuncao = $1 AND fe.idempresa = $2`,
              [idFuncao, idempresa]
          );
          const linha = result.rows[0] || null;
          return {
              dadosanteriores: linha, // O objeto função antes da alteração
              idregistroalterado: linha?.idfuncao || null // O ID da função que está sendo alterada
          };
      } catch (error) {
          console.error("Erro ao buscar dados anteriores da função:", error);
          return { dadosanteriores: null, idregistroalterado: null };
      }
    }
  }),
  async (req, res) => {
    console.log("Rota de função acessada - PUT", req.query);
    const id = req.params.id;
    const idempresa = req.idempresa;
    const { descFuncao, custoSenior, custoPleno, custoJunior, custoBase, venda, transporte, transporteSenior, obsProposta, almoco, jantar, obsFuncao } = req.body;

    try {
      const result = await pool.query(
        `UPDATE Funcao f
         SET descFuncao = $1, ctofuncaosenior = $2, ctofuncaopleno = $3, ctofuncaojunior = $4, ctofuncaobase = $5, vdafuncao = $6, transporte = $7, transpsenior = $8, obsFuncao = $9, almoco = $10, jantar = $11, obsProposta = $12
         FROM funcaoempresas fe
         WHERE f.idFuncao = $13 AND fe.idfuncao = f.idFuncao AND fe.idempresa = $14
         RETURNING f.idFuncao`,
        [descFuncao, custoSenior, custoPleno, custoJunior, custoBase, venda, transporte, transporteSenior, obsFuncao, almoco, jantar, obsProposta, id, idempresa]
      );

     if (result.rowCount) {
               
        res.locals.acao = 'atualizou';
        res.locals.idregistroalterado = result.rows[0].idfuncao; 
        res.locals.idusuarioAlvo = null; 

        return res.json({ message: "Função atualizada com sucesso!", funcao: result.rows[0] });
    } else {
        return res.status(404).json({ message: "Função não encontrada ou você não tem permissão para atualizá-la." });
    }
  } catch (error) {
      console.error("Erro ao atualizar função:", error);
      res.status(500).json({ message: "Erro ao atualizar função." });
  }
});

// POST criar nova função
router.post("/", autenticarToken({ verificarEmpresa: false }), 
  logMiddleware('Funcoes', { 
    buscarDadosAnteriores: async (req) => {
        return { dadosanteriores: null, idregistroalterado: null };
    }
  }),
  async (req, res) => {
  
   console.log("Rota de função acessada - POST", req.query);
    const { descFuncao, custoSenior, custoPleno, custoJunior, custoBase, venda, transporte, transporteSenior, obsFuncao, almoco, jantar, obsProposta } = req.body;
    const idempresa = req.idempresa;

    let client;
    try {
      client = await pool.connect(); 
        await client.query('BEGIN');
       
        const resultFuncao = await client.query(
            "INSERT INTO funcao (descFuncao, ctofuncaosenior, ctofuncaopleno, ctofuncaojunior, ctofuncaobase, vdafuncao, transporte, transpsenior, obsFuncao, almoco, jantar, obsProposta) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING idFuncao, descFuncao", // ✅ Retorna idFuncao
            [descFuncao, custoSenior, custoPleno, custoJunior, custoBase, venda, transporte, transporteSenior, obsFuncao, almoco, jantar, obsProposta]
        );

        const novaFuncao = resultFuncao.rows[0];
        const idfuncao = novaFuncao.idfuncao;
        
        await client.query(
            "INSERT INTO funcaoempresas (idfuncao, idempresa) VALUES ($1, $2)",
            [idfuncao, idempresa]
        );

        await client.query('COMMIT'); 
        
        res.locals.acao = 'cadastrou';
        res.locals.idregistroalterado = idfuncao; 
        res.locals.idusuarioAlvo = null; 

        res.status(201).json({ mensagem: "Função salva com sucesso!", funcao: novaFuncao });
    } catch (error) {
        if (client) { 
            await client.query('ROLLBACK');
        }
        console.error("Erro ao salvar função e/ou associá-la à empresa:", error);
        res.status(500).json({ erro: "Erro ao salvar função.", detail: error.message });
    } finally {
        if (client) {
            client.release(); 
        }
    }
    
});

module.exports = router;