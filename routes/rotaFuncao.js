const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB");
const { autenticarToken, contextoEmpresa} = require('../middlewares/authMiddlewares');
const { verificarPermissao } = require('../middlewares/permissaoMiddleware');
const logMiddleware = require('../middlewares/logMiddleware');



router.get("/categoriafuncao",  async (req, res) => {
  console.log("Rota de categoria função acessada em ROTA FUNCAO - GET", req.query);
  const idempresa = req.idempresa;
 // const { descCatFuncao } = req.query;
 // console.log("descCatFuncao na ROTACATEGORIAFUNCAO", descCatFuncao);
  try {
    // if (descCatFuncao) {
    //   const result = await pool.query(
    //     `SELECT cf.* 
    //     FROM categoriafuncao cf
    //     INNER JOIN categoriafuncaoempresas cfe ON cf.idcategoriafuncao = cfe.idcategoriafuncao
    //     WHERE cfe.idempresa = $1 AND nmcategoriafuncao ILIKE $2 LIMIT 1`, 
    //     [idempresa, descCatFuncao]
    //   );
    //   return result.rows.length
    //     ? res.json(result.rows[0])
    //     : res.status(404).json({ message: "Categoria Funcao não encontrada" });
    // } else {
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
    //}
  } catch (error) {
    console.error("Erro ao buscar categoria função:", error);
    res.status(500).json({ message: "Erro ao buscar categoria função" });
  }
});


router.get("/equipe",  async (req, res) => {
  console.log("Rota de equipe acessada em ROTA FUNCAO - GET", req.query);
  const idempresa = req.idempresa;
 
  try {    
      const result = await pool.query(`
        SELECT e.* 
        FROM equipe e
        INNER JOIN equipeempresas ee ON e.idequipe = ee.idequipe
        WHERE ee.idempresa = $1
        ORDER BY e.nmequipe ASC`,
        [idempresa]
      );
      return result.rows.length
        ? res.json(result.rows)
        : res.status(404).json({ message: "Nenhuma equipe encontrada" });
  } catch (error) {
    console.error("Erro ao buscar equipe:", error);
    res.status(500).json({ message: "Erro ao buscar equipe" });
  }
});


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
        `SELECT f.idfuncao, f.descfuncao, f.vdafuncao, f.obsfuncao, f.obsproposta, f.ativo, f.idcategoriafuncao, f.idequipe,
         e.nmequipe,
         cf.idcategoriafuncao, cf.ctofuncaobase, cf.ctofuncaojunior, cf.ctofuncaopleno, cf.ctofuncaosenior,
         cf.transporte, cf.transpsenior, cf.alimentacao
        FROM funcao f
        INNER JOIN categoriafuncao cf ON f.idcategoriafuncao = cf.idcategoriafuncao
        INNER JOIN funcaoempresas fe ON f.idfuncao = fe.idfuncao 
        INNER JOIN equipe e ON f.idequipe = e.idequipe       
        WHERE fe.idempresa = $1 AND descFuncao ILIKE $2 LIMIT 1`, 
        [idempresa, descFuncao]
      );
      return result.rows.length
        ? res.json(result.rows[0])
        : res.status(404).json({ message: "Funcao não encontrada" });
    } else {
      const result = await pool.query(`
        SELECT f.*, cf.*, e.*
        FROM funcao f
        INNER JOIN categoriafuncao cf ON f.idcategoriafuncao = cf.idcategoriafuncao
        INNER JOIN funcaoempresas fe ON f.idfuncao = fe.idfuncao
        INNER JOIN equipe e ON f.idequipe = e.idequipe
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

// --- ROTA PUT (ATUALIZAR) ---
const toNumeric = (val) => isNaN(Number(val)) ? 0 : Number(val);

// ROTA PUT
router.put("/:id", autenticarToken({ verificarEmpresa: false }), async (req, res) => {
    const id = req.params.id;
    const idempresa = req.idempresa;
    const b = req.body;

    try {
        const result = await pool.query(
            `UPDATE Funcao f
             SET descFuncao = $1, vdafuncao = $2, obsFuncao = $3, obsProposta = $4, ativo = $5, 
                 idcategoriafuncao = $6, idequipe = $7, ctofuncaobase = $8, transporte = $9,
                 almoco = $10, alimentacao = $11, transpsenior = $12, ctofuncaosenior = $13,
                 ctofuncaopleno = $14, ctofuncaojunior = $15
             FROM funcaoempresas fe
             WHERE f.idFuncao = $16 AND fe.idfuncao = f.idFuncao AND fe.idempresa = $17
             RETURNING f.idFuncao`,
            [
                b.descFuncao, toNumeric(b.venda), b.obsFuncao, b.obsProposta, b.ativo,
                b.idCatFuncao, b.idEquipe, toNumeric(b.custoBase), toNumeric(b.transporte),
                toNumeric(b.almoco), toNumeric(b.alimentacao), toNumeric(b.transpSenior),
                toNumeric(b.custoSenior), toNumeric(b.custoPleno), toNumeric(b.custoJunior),
                id, idempresa
            ]
        );
        res.json({ message: "Atualizado!" });
    } catch (error) {
        res.status(500).send("Erro no servidor");
    }
});

// ROTA POST
router.post("/", autenticarToken({ verificarEmpresa: false }), async (req, res) => {
    const b = req.body;
    const idempresa = req.idempresa;

    try {
        await pool.query('BEGIN');
        const resFuncao = await pool.query(
            `INSERT INTO funcao (
                descFuncao, vdafuncao, obsFuncao, obsProposta, ativo, 
                idcategoriafuncao, idequipe, ctofuncaobase, transporte, 
                almoco, alimentacao, transpsenior, ctofuncaosenior, 
                ctofuncaopleno, ctofuncaojunior
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING idFuncao`,
            [
                b.descFuncao, toNumeric(b.venda), b.obsFuncao, b.obsProposta, b.ativo,
                b.idCatFuncao, b.idEquipe, toNumeric(b.custoBase), toNumeric(b.transporte),
                toNumeric(b.almoco), toNumeric(b.alimentacao), toNumeric(b.transpSenior),
                toNumeric(b.custoSenior), toNumeric(b.custoPleno), toNumeric(b.custoJunior)
            ]
        );
        const idfuncao = resFuncao.rows[0].idfuncao;
        await pool.query("INSERT INTO funcaoempresas (idfuncao, idempresa) VALUES ($1, $2)", [idfuncao, idempresa]);
        await pool.query('COMMIT');
        res.status(201).json({ mensagem: "Criado!" });
    } catch (error) {
        await pool.query('ROLLBACK');
        res.status(500).send("Erro ao criar");
    }
});

module.exports = router;