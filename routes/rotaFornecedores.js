const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB");
const { autenticarToken, contextoEmpresa } = require('../middlewares/authMiddlewares');
const { verificarPermissao } = require('../middlewares/permissaoMiddleware');
const logMiddleware = require('../middlewares/logMiddleware');

// Aplica autenticação em todas as rotas
router.use(autenticarToken());
router.use(contextoEmpresa);

// Campos cadastrais (globais, mesmo CNPJ em todas as empresas) vêm de `c` (fornecedores).
// Campos de vínculo (ativo/banco/contato, por empresa) vêm de `ce` (fornecedorempresas).
const CAMPOS_SELECT = `
    c.idfornecedor, c.nmfantasia, c.razaosocial, c.cnpj, c.inscestadual, c.emailfornecedor, c.pix, c.telefone,
    c.cep, c.rua, c.numero, c.complemento, c.bairro, c.cidade, c.estado, c.pais, c.tpfornecedor,
    ce.ativo, ce.nmcontato, ce.celcontato, ce.emailcontato, ce.observacao,
    ce.codbanco, ce.agencia, ce.digitoagencia, ce.conta, ce.digitoconta`;

// GET verifica se o CPF/CNPJ já existe (em qualquer empresa) — fornecedor pode ser
// pessoa física ou jurídica (tpfornecedor F/J) — usado no cadastro para detectar
// fornecedor já cadastrado em outra empresa e oferecer importação dos dados.
router.get("/verificar-cnpj/:cnpj", verificarPermissao('Fornecedores', 'cadastrar'), async (req, res) => {
    const { cnpj } = req.params;
    const idempresa = req.idempresa;

    try {
        const result = await pool.query(
            `SELECT idfornecedor, nmfantasia, razaosocial, cnpj, inscestadual, emailfornecedor, pix, telefone,
                    cep, rua, numero, complemento, bairro, cidade, estado, pais, tpfornecedor
             FROM fornecedores WHERE cnpj = $1`,
            [cnpj]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "CPF/CNPJ não encontrado." });
        }

        const fornecedor = result.rows[0];

        const vinculoAtual = await pool.query(
            `SELECT ${CAMPOS_SELECT}
             FROM fornecedores c
             INNER JOIN fornecedorempresas ce ON ce.idfornecedor = c.idfornecedor
             WHERE c.idfornecedor = $1 AND ce.idempresa = $2`,
            [fornecedor.idfornecedor, idempresa]
        );

        if (vinculoAtual.rowCount > 0) {
            return res.json({
                existeNaEmpresaAtual: true,
                idfornecedor: fornecedor.idfornecedor,
                dados: vinculoAtual.rows[0]
            });
        }

        const empresasVinculadas = await pool.query(
            `SELECT e.nmfantasia FROM fornecedorempresas fe
             INNER JOIN empresas e ON e.idempresa = fe.idempresa
             WHERE fe.idfornecedor = $1`,
            [fornecedor.idfornecedor]
        );

        // Sugestão de vínculo (ativo/banco/contato) vinda de um vínculo já existente —
        // não é "verdade" pra empresa nova, é só ponto de partida editável.
        const vinculoExemplo = await pool.query(
            `SELECT ativo, nmcontato, celcontato, emailcontato, observacao,
                    codbanco, agencia, digitoagencia, conta, digitoconta
             FROM fornecedorempresas WHERE idfornecedor = $1 LIMIT 1`,
            [fornecedor.idfornecedor]
        );

        return res.json({
            existeNaEmpresaAtual: false,
            idfornecedor: fornecedor.idfornecedor,
            empresasVinculadas: empresasVinculadas.rows.map(r => r.nmfantasia),
            dados: { ...fornecedor, ...(vinculoExemplo.rows[0] || {}) }
        });
    } catch (error) {
        console.error("Erro ao verificar CPF/CNPJ do fornecedor:", error);
        res.status(500).json({ message: "Erro ao verificar CPF/CNPJ." });
    }
});

// GET todas ou por descrição
router.get("/", verificarPermissao('Fornecedores', 'pesquisar'), async (req, res) => {

  const { nmFantasia } = req.query;
  const idempresa = req.idempresa;
  console.log("nmFantasia na Rota:", nmFantasia); // Log do valor de nmFantasia
  try {
    if (nmFantasia) {
      console.log("🔍 Buscando fornecedor por nmFantasia:", nmFantasia, idempresa);
      const result = await pool.query(
        `SELECT ${CAMPOS_SELECT}
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
        `SELECT ${CAMPOS_SELECT}
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
          `SELECT ${CAMPOS_SELECT}
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

    let client;

    try {
      client = await pool.connect();
      await client.query('BEGIN');

      // 🔒 Validação: impede CNPJ duplicado NA MESMA EMPRESA
      const verificaCnpj = await client.query(
        `SELECT 1
         FROM fornecedores c
         INNER JOIN fornecedorempresas ce ON ce.idfornecedor = c.idfornecedor
         WHERE c.cnpj = $1
           AND ce.idempresa = $2
           AND c.idfornecedor <> $3`,
        [cnpj, idempresa, id]
      );

      if (verificaCnpj.rowCount > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          message: "Já existe outro fornecedor com este CNPJ nesta empresa."
        });
      }

      // ✅ Atualiza os dados CADASTRAIS (globais, mesmo CNPJ em todas as empresas)
      const resultPessoal = await client.query(
        `UPDATE fornecedores c
         SET nmfantasia = $1,
             razaosocial = $2,
             cnpj = $3,
             inscestadual = $4,
             emailfornecedor = $5,
             pix = $6,
             telefone = $7,
             cep = $8,
             rua = $9,
             numero = $10,
             complemento = $11,
             bairro = $12,
             cidade = $13,
             estado = $14,
             pais = $15,
             tpfornecedor = $16
         FROM fornecedorempresas ce
         WHERE c.idfornecedor = $17
           AND ce.idfornecedor = c.idfornecedor
           AND ce.idempresa = $18
         RETURNING c.idfornecedor`,
        [
          nmFantasia, razaoSocial, cnpj, inscEstadual,
          emailFornecedor, pix, telefone,
          cep, rua, numero, complemento, bairro,
          cidade, estado, pais, tpfornecedor,
          id, idempresa
        ]
      );

      if (!resultPessoal.rowCount) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          message: "Fornecedore não encontrado ou você não tem permissão para atualizá-lo."
        });
      }

      // ✅ Atualiza os dados de VÍNCULO (por empresa: ativo, banco, contato)
      await client.query(
        `UPDATE fornecedorempresas
         SET ativo = $1,
             nmcontato = $2,
             celcontato = $3,
             emailcontato = $4,
             observacao = $5,
             codbanco = $6,
             agencia = $7,
             digitoagencia = $8,
             conta = $9,
             digitoconta = $10
         WHERE idfornecedor = $11 AND idempresa = $12`,
        [
          ativo, nmContato, celContato, emailContato, observacao,
          codbanco, agencia, digitoagencia, conta, digitoconta,
          id, idempresa
        ]
      );

      await client.query('COMMIT');

      // 🔹 Dados para o log
      res.locals.acao = 'atualizou';
      res.locals.idregistroalterado = resultPessoal.rows[0].idfornecedor;
      res.locals.idusuarioAlvo = null;
      res.locals.dadosnovos = req.body;

      return res.json({
        message: "Fornecedore atualizado com sucesso!",
        fornecedor: resultPessoal.rows[0]
      });

    } catch (error) {
      if (client) await client.query('ROLLBACK');
      console.error("❌ Erro ao atualizar fornecedor:", error);
      res.status(500).json({
        message: "Erro ao atualizar fornecedor."
      });
    } finally {
      if (client) client.release();
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
      tpfornecedor, observacao } = req.body;

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

        // 3️⃣ Vincula o fornecedor existente à nova empresa, já com os dados de
        // vínculo (ativo/banco/contato) preenchidos neste formulário — antes esses
        // valores eram descartados silenciosamente (só as duas FKs eram gravadas).
        await client.query(
          `INSERT INTO fornecedorempresas (
            idfornecedor, idempresa, ativo, nmcontato, celcontato, emailcontato, observacao,
            codbanco, agencia, digitoagencia, conta, digitoconta
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            idfornecedor, idempresa, ativo, nmContato, celContato, emailContato, observacao,
            codbanco, agencia, digitoagencia, conta, digitoconta
          ]
        );

        await client.query('COMMIT');

        res.locals.acao = 'vinculou';
        res.locals.idregistroalterado = idfornecedor;
        res.locals.dadosnovos = fornecedorExistente.rows[0];

        return res.status(201).json({
          mensagem: "Fornecedore já existente vinculado à empresa com sucesso!",
          fornecedor: fornecedorExistente.rows[0]
        });
      }

      // 4️⃣ Fornecedore NÃO existe → cria novo (dados cadastrais globais)
      const resultFornecedore = await client.query(
        `INSERT INTO fornecedores (
          nmfantasia, razaosocial, cnpj, inscestadual, emailfornecedor,
          pix, telefone, cep, rua, numero, complemento, bairro, cidade, estado, pais, tpfornecedor
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16
        )
        RETURNING idfornecedor, nmfantasia`,
        [
          nmFantasia, razaoSocial, cnpj, inscEstadual, emailFornecedor,
          pix, telefone, cep, rua, numero, complemento, bairro, cidade, estado, pais, tpfornecedor
        ]
      );

      idfornecedor = resultFornecedore.rows[0].idfornecedor;

      // Vínculo (por empresa: ativo, banco, contato)
      await client.query(
        `INSERT INTO fornecedorempresas (
          idfornecedor, idempresa, ativo, nmcontato, celcontato, emailcontato, observacao,
          codbanco, agencia, digitoagencia, conta, digitoconta
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          idfornecedor, idempresa, ativo, nmContato, celContato, emailContato, observacao,
          codbanco, agencia, digitoagencia, conta, digitoconta
        ]
      );

      await client.query('COMMIT');

      res.locals.acao = 'cadastrou';
      res.locals.idregistroalterado = idfornecedor;
      res.locals.dadosnovos = resultFornecedore.rows[0];

      res.status(201).json({
        mensagem: "Fornecedore cadastrado e vinculado à empresa com sucesso!",
        fornecedor: resultFornecedore.rows[0]
      });

    } catch (error) {
      if (client) await client.query('ROLLBACK');
      console.error("❌ Erro ao salvar fornecedor:", error);
      res.status(500).json({ erro: "Erro ao salvar fornecedor." });
    } finally {
      if (client) client.release();
    }
  }
);




module.exports = router;
