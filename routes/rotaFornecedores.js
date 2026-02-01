const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB");
const { autenticarToken, contextoEmpresa } = require('../middlewares/authMiddlewares');
const { verificarPermissao } = require('../middlewares/permissaoMiddleware');
const logMiddleware = require('../middlewares/logMiddleware');

// Aplica autenticação em todas as rotas
router.use(autenticarToken());
router.use(contextoEmpresa);

// GET todas ou por descrição
router.get("/", verificarPermissao('Fornecedores', 'pesquisar'), async (req, res) => {
    
  const { nmFantasia } = req.query;
  const idempresa = req.idempresa;
  console.log("nmFantasia na Rota:", nmFantasia); // Log do valor de nmFantasia
  try {
    if (nmFantasia) {
      console.log("🔍 Buscando fornecedor por nmFantasia:", nmFantasia, idempresa);
      const result = await pool.query(
        `SELECT c.* 
        FROM fornecedores c
        INNER JOIN fornecedorempresas ce ON ce.idfornecedor = c.idfornecedor
        WHERE ce.idempresa = $1 AND c.nmfantasia ILIKE $2
        ORDER BY c.nmfantasia ASC LIMIT 1`,
        [idempresa, nmFantasia]
      );
      console.log("✅ Consulta por nmFantasia retornou:", result.rows.length, "linhas.");
      return result.rows.length
        ? res.json(result.rows[0])
        : res.status(404).json({ message: "Fornecedore não encontrado" });
    } else {
      console.log("🔍 Buscando todos os fornecedores para a empresa:", idempresa);
      const result = await pool.query(
        `SELECT c.* 
        FROM fornecedores c
        INNER JOIN fornecedorempresas ce ON ce.idfornecedor = c.idfornecedor
        WHERE ce.idempresa = $1 ORDER BY nmfantasia`
        , [idempresa]);
      console.log("✅ Consulta de todos os fornecedores retornou:", result.rows.length, "linhas.");
      return result.rows.length
        ? res.json(result.rows)
        : res.status(404).json({ message: "Nenhum Fornecedore encontrado" });
    }
  } catch (error) {
    console.error("❌ Erro ao buscar fornecedores:", error);
    res.status(500).json({ message: "Erro ao buscar nome fantasia" });
  }
});


// PUT atualizar
// PUT atualizar fornecedor
router.put(
  "/:id",
  verificarPermissao('Fornecedores', 'alterar'),
  logMiddleware('Fornecedores', {
    buscarDadosAnteriores: async (req) => {
      const idfornecedor = req.params.id;
      const idempresa = req.idempresa;

      if (!idfornecedor) {
        return { dadosanteriores: null, idregistroalterado: null };
      }

      try {
        const result = await pool.query(
          `SELECT c.*
           FROM fornecedores c
           INNER JOIN fornecedorempresas ce ON ce.idfornecedor = c.idfornecedor
           WHERE c.idfornecedor = $1
             AND ce.idempresa = $2`,
          [idfornecedor, idempresa]
        );

        const linha = result.rows[0] || null;

        return {
          dadosanteriores: linha,
          idregistroalterado: linha?.idfornecedor || null
        };
      } catch (error) {
        console.error("Erro ao buscar dados anteriores do fornecedor:", error);
        return { dadosanteriores: null, idregistroalterado: null };
      }
    }
  }),
  async (req, res) => {

    const id = req.params.id;
    const idempresa = req.idempresa;
    const ativo = req.body.ativo !== undefined ? req.body.ativo : false;

    const {
      nmFantasia, razaoSocial, cnpj, inscEstadual,
      emailFornecedor, pix, telefone,
      nmContato, celContato, emailContato,
      cep, rua, numero, complemento, bairro,
      cidade, estado, pais, tpfornecedor, observacao
      
    } = req.body;

    const codbanco = req.body.codbanco || null;
    const agencia = req.body.agencia || null;
    const conta = req.body.conta || null;
    const digitoconta = req.body.digitoconta || null;
    const digitoagencia = req.body.digitoagencia || null;
    console.log("DADOS RECEBIDOS", req.body);

    try {

      // 🔒 Validação: impede CNPJ duplicado NA MESMA EMPRESA
      const verificaCnpj = await pool.query(
        `SELECT 1
         FROM fornecedores c
         INNER JOIN fornecedorempresas ce ON ce.idfornecedor = c.idfornecedor
         WHERE c.cnpj = $1
           AND ce.idempresa = $2
           AND c.idfornecedor <> $3`,
        [cnpj, idempresa, id]
      );

      if (verificaCnpj.rowCount > 0) {
        return res.status(409).json({
          message: "Já existe outro fornecedor com este CNPJ nesta empresa."
        });
      }

      // ✅ Atualização protegida por empresa
      const result = await pool.query(
        `UPDATE fornecedores c
         SET nmfantasia = $1,
             razaosocial = $2,
             cnpj = $3,
             inscestadual = $4,
             emailfornecedor = $5,
             pix = $6,
             telefone = $7,
             nmcontato = $8,
             celcontato = $9,
             emailcontato = $10,
             cep = $11,
             rua = $12,
             numero = $13,
             complemento = $14,
             bairro = $15,
             cidade = $16,
             estado = $17,
             pais = $18,
             ativo = $19,
             tpfornecedor = $20,
             observacao = $21,
             codbanco = $22,
              agencia = $23,
              digitoagencia = $24,
              conta = $25,
              digitoconta = $26
         FROM fornecedorempresas ce
         WHERE c.idfornecedor = $27
           AND ce.idfornecedor = c.idfornecedor
           AND ce.idempresa = $28
         RETURNING c.idfornecedor`,
        [
          nmFantasia, razaoSocial, cnpj, inscEstadual,
          emailFornecedor, pix, telefone,
          nmContato, celContato, emailContato,
          cep, rua, numero, complemento, bairro,
          cidade, estado, pais, ativo,
          tpfornecedor, observacao, codbanco, agencia, digitoagencia, conta, digitoconta,
          id, idempresa
        ]
      );

      if (!result.rowCount) {
        return res.status(404).json({
          message: "Fornecedore não encontrado ou você não tem permissão para atualizá-lo."
        });
      }

      // 🔹 Dados para o log
      res.locals.acao = 'atualizou';
      res.locals.idregistroalterado = result.rows[0].idfornecedor;
      res.locals.idusuarioAlvo = null;

      return res.json({
        message: "Fornecedore atualizado com sucesso!",
        fornecedor: result.rows[0]
      });

    } catch (error) {
      console.error("❌ Erro ao atualizar fornecedor:", error);
      res.status(500).json({
        message: "Erro ao atualizar fornecedor.",
        detail: error.message
      });
    }
  }
);


// POST criar nova função
router.post(
  "/",
  verificarPermissao('Fornecedores', 'cadastrar'),
  logMiddleware('Fornecedores', {
    buscarDadosAnteriores: async () => {
      return { dadosanteriores: null, idregistroalterado: null };
    }
  }),
  async (req, res) => {

    const ativo = req.body.ativo !== undefined ? req.body.ativo : false;
    const {
      nmFantasia, razaoSocial, cnpj, inscEstadual, emailFornecedor, pix,
      telefone, nmContato, celContato, emailContato,
      cep, rua, numero, complemento, bairro, cidade, estado, pais,
      tpfornecedor, observacao  } = req.body;

    const codbanco = req.body.codbanco || null;
    const agencia = req.body.agencia || null;
    const conta = req.body.conta || null;
    const digitoconta = req.body.digitoconta || null;
    const digitoagencia = req.body.digitoagencia || null;
    
    console.log("DADOS RECEBIDOS NO POST:", req.body);

    const idempresa = req.idempresa;
    let client;

    try {
      client = await pool.connect();
      await client.query('BEGIN');

      // 1️⃣ Verifica se já existe fornecedor com este CNPJ
      const fornecedorExistente = await client.query(
        `SELECT idfornecedor, nmfantasia FROM fornecedores WHERE cnpj = $1`,
        [cnpj]
      );

      let idfornecedor;

      if (fornecedorExistente.rowCount > 0) {
        // Fornecedore já existe
        idfornecedor = fornecedorExistente.rows[0].idfornecedor;

        // 2️⃣ Verifica se já está vinculado à empresa
        const vinculoExistente = await client.query(
          `SELECT 1 FROM fornecedorempresas 
           WHERE idfornecedor = $1 AND idempresa = $2`,
          [idfornecedor, idempresa]
        );

        if (vinculoExistente.rowCount > 0) {
          await client.query('ROLLBACK');
          return res.status(409).json({
            erro: "Fornecedore já cadastrado nesta empresa.",
            detalhe: "Este CNPJ já está vinculado à empresa atual."
          });
        }

        // 3️⃣ Apenas vincula o fornecedor existente à nova empresa
        await client.query(
          `INSERT INTO fornecedorempresas (idfornecedor, idempresa)
           VALUES ($1, $2)`,
          [idfornecedor, idempresa]
        );

        await client.query('COMMIT');

        res.locals.acao = 'vinculou';
        res.locals.idregistroalterado = idfornecedor;

        return res.status(201).json({
          mensagem: "Fornecedore já existente vinculado à empresa com sucesso!",
          fornecedor: fornecedorExistente.rows[0]
        });
      }

      // 4️⃣ Fornecedore NÃO existe → cria novo
      const resultFornecedore = await client.query(
        `INSERT INTO fornecedores (
          nmfantasia, razaosocial, cnpj, inscestadual, emailfornecedor, 
          pix, telefone, nmcontato, celcontato, emailcontato,
          cep, rua, numero, complemento, bairro, cidade, estado, pais,
          ativo, tpfornecedor, observacao, codbanco, agencia, digitoagencia, conta, digitoconta
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
          $12,$13,$14,$15,$16,$17,$18,$19,
          $20,$21,$22,$23,$24,$25,$26
        )
        RETURNING idfornecedor, nmfantasia`,
        [
          nmFantasia, razaoSocial, cnpj, inscEstadual, emailFornecedor, 
          pix, telefone, nmContato, celContato, emailContato,
          cep, rua, numero, complemento, bairro, cidade, estado, pais,
          ativo, tpfornecedor, observacao, codbanco, agencia, digitoagencia, conta, digitoconta
        ]
      );

      idfornecedor = resultFornecedore.rows[0].idfornecedor;

      await client.query(
        `INSERT INTO fornecedorempresas (idfornecedor, idempresa)
         VALUES ($1, $2)`,
        [idfornecedor, idempresa]
      );

      await client.query('COMMIT');

      res.locals.acao = 'cadastrou';
      res.locals.idregistroalterado = idfornecedor;

      res.status(201).json({
        mensagem: "Fornecedore cadastrado e vinculado à empresa com sucesso!",
        fornecedor: resultFornecedore.rows[0]
      });

    } catch (error) {
      if (client) await client.query('ROLLBACK');
      console.error("❌ Erro ao salvar fornecedor:", error);
      res.status(500).json({ erro: "Erro ao salvar fornecedor.", detalhe: error.message });
    } finally {
      if (client) client.release();
    }
  }
);




module.exports = router;