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
router.get("/", verificarPermissao('categoriafuncao', 'pesquisar'), async (req, res) => {
  console.log("Rota de categoria função acessada - GET", req.query);
  const idempresa = req.idempresa;
  const { descCatFuncao } = req.query;
  console.log("descCatFuncao na ROTACATEGORIAFUNCAO", descCatFuncao);
  try {
    if (descCatFuncao) {
      const result = await pool.query(
        `SELECT cf.* 
        FROM categoriafuncao cf
        INNER JOIN categoriafuncaoempresas cfe ON cf.idcategoriafuncao = cfe.idcategoriafuncao
        WHERE cfe.idempresa = $1 AND nmcategoriafuncao ILIKE $2 LIMIT 1`, 
        [idempresa, descCatFuncao]
      );
      return result.rows.length
        ? res.json(result.rows[0])
        : res.status(404).json({ message: "Categoria Funcao não encontrada" });
    } else {
      const result = await pool.query(`
        SELECT cf.* 
        FROM categoriafuncao cf
        INNER JOIN categoriafuncaoempresas cfe ON cf.idcategoriafuncao = cfe.idcategoriafuncao
        WHERE cfe.idempresa = $1
        ORDER BY cf.nmcategoriafuncao ASC`,
        [idempresa]
      );
      return result.rows.length
        ? res.json(result.rows)
        : res.status(404).json({ message: "Nenhuma categoria função encontrada" });
    }
  } catch (error) {
    console.error("Erro ao buscar categoria função:", error);
    res.status(500).json({ message: "Erro ao buscar categoria função" });
  }
});

// PUT atualizar
router.put("/:id", autenticarToken({ verificarEmpresa: false }), verificarPermissao('categoriafuncao', 'alterar'),
  logMiddleware('Categoria Funcao', { // ✅ Módulo 'Funcoes' para o log
    buscarDadosAnteriores: async (req) => {
      const idCatFuncao = req.params.id; 
      const idempresa = req.idempresa; 
     
      if (!idFuncao) {
          return { dadosanteriores: null, idregistroalterado: null };
      }
      
      try {          
          const result = await pool.query(
              `SELECT cf.* FROM categoriafuncao cf
                INNER JOIN categoriafuncaoempresas cfe ON cfe.idcategoriafuncao = cf.idcategoriafuncao
                WHERE cf.idcatFuncao = $1 AND cfe.idempresa = $2`,
              [idCatFuncao, idempresa]
          );
          const linha = result.rows[0] || null;
          return {
              dadosanteriores: linha, // O objeto função antes da alteração
              idregistroalterado: linha?.idcategoriafuncao || null // O ID da função que está sendo alterada
          };
      } catch (error) {
          console.error("Erro ao buscar dados anteriores da categoria função:", error);
          return { dadosanteriores: null, idregistroalterado: null };
      }
    }
  }),
  async (req, res) => {
    console.log("Rota de categoria função acessada - PUT", req.query);
    const id = req.params.id;
    const idempresa = req.idempresa;
    const body = req.body || {};

    const toNumeric = (val) => {
        // Converte para Number, e se for NaN (ex: Number(undefined), Number("")), retorna 0.
        const num = Number(val);
        return isNaN(num) ? 0 : num;
    };
    
    
   // const { descFuncao, custoSenior, custoPleno, custoJunior, custoBase, venda, transporte, transporteSenior, obsProposta, alimentacao, obsFuncao} = req.body;
    const { descCatFuncao } = body; 
    const custoSenior = toNumeric(body.custoSenior);
    const custoPleno = toNumeric(body.custoPleno);
    const custoJunior = toNumeric(body.custoJunior);
    const custoBase = toNumeric(body.custoBase);
    const venda = toNumeric(body.venda);
    const transporte = toNumeric(body.transporte);
    const transporteSenior = toNumeric(body.transporteSenior);
    const alimentacao = toNumeric(body.alimentacao);

    console.log("ESTÁ NA ROTA PUT");

    try {
      const result = await pool.query(
        `UPDATE categoriafuncao cf
         SET nmcategoriafunca = $1, ctofuncaosenior = $2, ctofuncaopleno = $3, ctofuncaojunior = $4, ctofuncaobase = $5, vdafuncao = $6, transporte = $7, 
              transpsenior = $8, alimentacao = $10
         FROM categoriafuncaoempresas cfe
         WHERE cf.idcatFuncao = $11 AND cfe.idcategoriafuncao = cf.idcategoriafuncao AND cfe.idempresa = $12
         RETURNING cf.idcategoriafuncao`,
        [descCatFuncao, custoSenior, custoPleno, custoJunior, custoBase, venda, transporte, transporteSenior, alimentacao, id, idempresa]
      );

     if (result.rowCount) {
               
        res.locals.acao = 'atualizou';
        res.locals.idregistroalterado = result.rows[0].idcategoriafuncao; 
        res.locals.idusuarioAlvo = null; 

        return res.json({ message: "Categoria Função atualizada com sucesso!", categoriafuncao: result.rows[0] });
    } else {
        return res.status(404).json({ message: "Categoria Função não encontrada ou você não tem permissão para atualizá-la." });
    }
  } catch (error) {
      console.error("Erro ao atualizar categoria função:", error);
      res.status(500).json({ message: "Erro ao atualizar categoria função." });
  }
});

// POST criar nova função
router.post("/", autenticarToken({ verificarEmpresa: false }), verificarPermissao('categoriafuncao', 'cadastrar'),
  logMiddleware('Categoria Função', { 
    buscarDadosAnteriores: async (req) => {
        return { dadosanteriores: null, idregistroalterado: null };
    }
  }),
  async (req, res) => {
  
   console.log("Rota de categoria função acessada - POST", req.query);
    
   // const { descFuncao, custoSenior, custoPleno, custoJunior, custoBase, venda, transporte, transporteSenior, obsFuncao, alimentacao, obsProposta } = req.body;
    const idempresa = req.idempresa;
    
    const body = req.body || {};

    const toNumeric = (val) => {
        // Converte para Number, e se for NaN (ex: Number(undefined), Number("")), retorna 0.
        const num = Number(val);
        return isNaN(num) ? 0 : num;
    };

    const { descCatFuncao} = body; 
    const custoSenior = toNumeric(body.custoSenior);
    const custoPleno = toNumeric(body.custoPleno);
    const custoJunior = toNumeric(body.custoJunior);
    const custoBase = toNumeric(body.custoBase);
    const venda = toNumeric(body.venda);
    const transporte = toNumeric(body.transporte);
    const transporteSenior = toNumeric(body.transporteSenior);
    const alimentacao = toNumeric(body.alimentacao);

    let client;
    try {
      client = await pool.connect(); 
        await client.query('BEGIN');
       
        const resultFuncao = await client.query(
            "INSERT INTO categoriafuncao (nmcategoriafuncao, ctofuncaosenior, ctofuncaopleno, ctofuncaojunior, ctofuncaobase, vdafuncao, transporte, transpsenior, alimentacao) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING idcategoriafuncao, nmcategoriafuncao", // ✅ Retorna idFuncao
            [descCatFuncao, custoSenior, custoPleno, custoJunior, custoBase, venda, transporte, transporteSenior, alimentacao]
        );

        const novaFuncao = resultFuncao.rows[0];
        const idcategoriafuncao = novaFuncao.idcategoriafuncao;
        
        await client.query(
            "INSERT INTO categoriafuncaoempresas (idcategoriafuncao, idempresa) VALUES ($1, $2)",
            [idcategoriafuncao, idempresa]
        );

        await client.query('COMMIT'); 
        
        res.locals.acao = 'cadastrou';
        res.locals.idregistroalterado = idcategoriafuncao; 
        res.locals.idusuarioAlvo = null; 

        res.status(201).json({ mensagem: "Função salva com sucesso!", categoriafuncao: novaFuncao });
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