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
router.get("/", verificarPermissao('Clientes', 'pesquisar'), async (req, res) => {
    
  const { nmFantasia } = req.query;
  const idempresa = req.idempresa;
  console.log("nmFantasia na Rota:", nmFantasia); // Log do valor de nmFantasia
  try {
    if (nmFantasia) {
      console.log("🔍 Buscando cliente por nmFantasia:", nmFantasia, idempresa);
      const result = await pool.query(
        `SELECT c.* 
        FROM clientes c
        INNER JOIN clienteempresas ce ON ce.idcliente = c.idcliente
        WHERE ce.idempresa = $1 AND c.nmfantasia ILIKE $2
        ORDER BY c.nmfantasia ASC LIMIT 1`,
        [idempresa,`%${nmFantasia}%`]
      );
      console.log("✅ Consulta por nmFantasia retornou:", result.rows.length, "linhas.");
      return result.rows.length
        ? res.json(result.rows[0])
        : res.status(404).json({ message: "Cliente não encontrado" });
    } else {
      console.log("🔍 Buscando todos os clientes para a empresa:", idempresa);
      const result = await pool.query(
        `SELECT c.* 
        FROM clientes c
        INNER JOIN clienteempresas ce ON ce.idcliente = c.idcliente
        WHERE ce.idempresa = $1 ORDER BY nmfantasia`
        , [idempresa]);
      console.log("✅ Consulta de todos os clientes retornou:", result.rows.length, "linhas.");
      return result.rows.length
        ? res.json(result.rows)
        : res.status(404).json({ message: "Nenhum Cliente encontrado" });
    }
  } catch (error) {
    console.error("❌ Erro ao buscar clientes:", error);
    res.status(500).json({ message: "Erro ao buscar nome fantasia" });
  }
});


// PUT atualizar
// PUT atualizar cliente
router.put(
  "/:id",
  verificarPermissao('Clientes', 'alterar'),
  logMiddleware('Clientes', {
    buscarDadosAnteriores: async (req) => {
      const idcliente = req.params.id;
      const idempresa = req.idempresa;

      if (!idcliente) {
        return { dadosanteriores: null, idregistroalterado: null };
      }

      try {
        const result = await pool.query(
          `SELECT c.*
           FROM clientes c
           INNER JOIN clienteempresas ce ON ce.idcliente = c.idcliente
           WHERE c.idcliente = $1
             AND ce.idempresa = $2`,
          [idcliente, idempresa]
        );

        const linha = result.rows[0] || null;

        return {
          dadosanteriores: linha,
          idregistroalterado: linha?.idcliente || null
        };
      } catch (error) {
        console.error("Erro ao buscar dados anteriores do cliente:", error);
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
      emailCliente, emailNfe, site, telefone,
      nmContato, celContato, emailContato,
      cep, rua, numero, complemento, bairro,
      cidade, estado, pais, tpcliente, responsavelContrato
    } = req.body;

    console.log("DADOS RECEBIDOS", req.body);

    try {

      // 🔒 Validação: impede CNPJ duplicado NA MESMA EMPRESA
      const verificaCnpj = await pool.query(
        `SELECT 1
         FROM clientes c
         INNER JOIN clienteempresas ce ON ce.idcliente = c.idcliente
         WHERE c.cnpj = $1
           AND ce.idempresa = $2
           AND c.idcliente <> $3`,
        [cnpj, idempresa, id]
      );

      if (verificaCnpj.rowCount > 0) {
        return res.status(409).json({
          message: "Já existe outro cliente com este CNPJ nesta empresa."
        });
      }

      // ✅ Atualização protegida por empresa
      const result = await pool.query(
        `UPDATE clientes c
         SET nmfantasia = $1,
             razaosocial = $2,
             cnpj = $3,
             inscestadual = $4,
             emailcliente = $5,
             emailnfe = $6,
             site = $7,
             telefone = $8,
             nmcontato = $9,
             celcontato = $10,
             emailcontato = $11,
             cep = $12,
             rua = $13,
             numero = $14,
             complemento = $15,
             bairro = $16,
             cidade = $17,
             estado = $18,
             pais = $19,
             ativo = $20,
             tpcliente = $21,
             responsavelcontrato = $22
         FROM clienteempresas ce
         WHERE c.idcliente = $23
           AND ce.idcliente = c.idcliente
           AND ce.idempresa = $24
         RETURNING c.idcliente`,
        [
          nmFantasia, razaoSocial, cnpj, inscEstadual,
          emailCliente, emailNfe, site, telefone,
          nmContato, celContato, emailContato,
          cep, rua, numero, complemento, bairro,
          cidade, estado, pais, ativo,
          tpcliente, responsavelContrato,
          id, idempresa
        ]
      );

      if (!result.rowCount) {
        return res.status(404).json({
          message: "Cliente não encontrado ou você não tem permissão para atualizá-lo."
        });
      }

      // 🔹 Dados para o log
      res.locals.acao = 'atualizou';
      res.locals.idregistroalterado = result.rows[0].idcliente;
      res.locals.idusuarioAlvo = null;

      return res.json({
        message: "Cliente atualizado com sucesso!",
        cliente: result.rows[0]
      });

    } catch (error) {
      console.error("❌ Erro ao atualizar cliente:", error);
      res.status(500).json({
        message: "Erro ao atualizar cliente.",
        detail: error.message
      });
    }
  }
);


// POST criar nova função
router.post(
  "/",
  verificarPermissao('Clientes', 'cadastrar'),
  logMiddleware('Clientes', {
    buscarDadosAnteriores: async () => {
      return { dadosanteriores: null, idregistroalterado: null };
    }
  }),
  async (req, res) => {

    const ativo = req.body.ativo !== undefined ? req.body.ativo : false;
    const {
      nmFantasia, razaoSocial, cnpj, inscEstadual, emailCliente, emailNfe,
      site, telefone, nmContato, celContato, emailContato,
      cep, rua, numero, complemento, bairro, cidade, estado, pais,
      tpcliente, responsavelContrato
    } = req.body;

    const idempresa = req.idempresa;
    let client;

    try {
      client = await pool.connect();
      await client.query('BEGIN');

      // 1️⃣ Verifica se já existe cliente com este CNPJ
      const clienteExistente = await client.query(
        `SELECT idcliente, nmfantasia FROM clientes WHERE cnpj = $1`,
        [cnpj]
      );

      let idcliente;

      if (clienteExistente.rowCount > 0) {
        // Cliente já existe
        idcliente = clienteExistente.rows[0].idcliente;

        // 2️⃣ Verifica se já está vinculado à empresa
        const vinculoExistente = await client.query(
          `SELECT 1 FROM clienteempresas 
           WHERE idcliente = $1 AND idempresa = $2`,
          [idcliente, idempresa]
        );

        if (vinculoExistente.rowCount > 0) {
          await client.query('ROLLBACK');
          return res.status(409).json({
            erro: "Cliente já cadastrado nesta empresa.",
            detalhe: "Este CNPJ já está vinculado à empresa atual."
          });
        }

        // 3️⃣ Apenas vincula o cliente existente à nova empresa
        await client.query(
          `INSERT INTO clienteempresas (idcliente, idempresa)
           VALUES ($1, $2)`,
          [idcliente, idempresa]
        );

        await client.query('COMMIT');

        res.locals.acao = 'vinculou';
        res.locals.idregistroalterado = idcliente;

        return res.status(201).json({
          mensagem: "Cliente já existente vinculado à empresa com sucesso!",
          cliente: clienteExistente.rows[0]
        });
      }

      // 4️⃣ Cliente NÃO existe → cria novo
      const resultCliente = await client.query(
        `INSERT INTO clientes (
          nmfantasia, razaosocial, cnpj, inscestadual, emailcliente, emailnfe,
          site, telefone, nmcontato, celcontato, emailcontato,
          cep, rua, numero, complemento, bairro, cidade, estado, pais,
          ativo, tpcliente, responsavelcontrato
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
          $12,$13,$14,$15,$16,$17,$18,$19,
          $20,$21,$22
        )
        RETURNING idcliente, nmfantasia`,
        [
          nmFantasia, razaoSocial, cnpj, inscEstadual, emailCliente, emailNfe,
          site, telefone, nmContato, celContato, emailContato,
          cep, rua, numero, complemento, bairro, cidade, estado, pais,
          ativo, tpcliente, responsavelContrato
        ]
      );

      idcliente = resultCliente.rows[0].idcliente;

      await client.query(
        `INSERT INTO clienteempresas (idcliente, idempresa)
         VALUES ($1, $2)`,
        [idcliente, idempresa]
      );

      await client.query('COMMIT');

      res.locals.acao = 'cadastrou';
      res.locals.idregistroalterado = idcliente;

      res.status(201).json({
        mensagem: "Cliente cadastrado e vinculado à empresa com sucesso!",
        cliente: resultCliente.rows[0]
      });

    } catch (error) {
      if (client) await client.query('ROLLBACK');
      console.error("❌ Erro ao salvar cliente:", error);
      res.status(500).json({ erro: "Erro ao salvar cliente.", detalhe: error.message });
    } finally {
      if (client) client.release();
    }
  }
);




module.exports = router;