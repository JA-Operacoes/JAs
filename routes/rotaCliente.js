const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB");
const { autenticarToken, contextoEmpresa } = require('../middlewares/authMiddlewares');
const { verificarPermissao } = require('../middlewares/permissaoMiddleware');
const logMiddleware = require('../middlewares/logMiddleware');

// Aplica autenticação em todas as rotas
router.use(autenticarToken());
router.use(contextoEmpresa);

// Campos cadastrais (globais, mesmo CNPJ em todas as empresas) vêm de `c` (clientes).
// Campos de vínculo (ativo/contato/nfe/responsável, por empresa) vêm de `ce` (clienteempresas).
const CAMPOS_SELECT = `
    c.idcliente, c.nmfantasia, c.razaosocial, c.cnpj, c.inscestadual, c.inscricaomunicipal, c.emailcliente, c.site, c.telefone,
    c.cep, c.rua, c.numero, c.complemento, c.bairro, c.cidade, c.estado, c.pais, c.tpcliente,
    ce.ativo, ce.nmcontato, ce.celcontato, ce.emailcontato, ce.emailnfe, ce.responsavelcontrato`;

// GET verifica se o CPF/CNPJ já existe (em qualquer empresa) — cliente pode ser
// pessoa física ou jurídica (tpcliente F/J) — usado no cadastro para detectar
// cliente já cadastrado em outra empresa e oferecer importação dos dados.
router.get("/verificar-cnpj/:cnpj", verificarPermissao('Clientes', 'cadastrar'), async (req, res) => {
    const { cnpj } = req.params;
    const idempresa = req.idempresa;

    try {
        const result = await pool.query(
            `SELECT idcliente, nmfantasia, razaosocial, cnpj, inscestadual, inscricaomunicipal, emailcliente, site, telefone,
                    cep, rua, numero, complemento, bairro, cidade, estado, pais, tpcliente
             FROM clientes WHERE cnpj = $1`,
            [cnpj]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "CPF/CNPJ não encontrado." });
        }

        const cliente = result.rows[0];

        const vinculoAtual = await pool.query(
            `SELECT ${CAMPOS_SELECT}
             FROM clientes c
             INNER JOIN clienteempresas ce ON ce.idcliente = c.idcliente
             WHERE c.idcliente = $1 AND ce.idempresa = $2`,
            [cliente.idcliente, idempresa]
        );

        if (vinculoAtual.rowCount > 0) {
            return res.json({
                existeNaEmpresaAtual: true,
                idcliente: cliente.idcliente,
                dados: vinculoAtual.rows[0]
            });
        }

        const empresasVinculadas = await pool.query(
            `SELECT e.nmfantasia FROM clienteempresas ce
             INNER JOIN empresas e ON e.idempresa = ce.idempresa
             WHERE ce.idcliente = $1`,
            [cliente.idcliente]
        );

        // Sugestão de vínculo (ativo/contato/nfe/responsável) vinda de um vínculo já
        // existente — não é "verdade" pra empresa nova, é só ponto de partida editável.
        const vinculoExemplo = await pool.query(
            `SELECT ativo, nmcontato, celcontato, emailcontato, emailnfe, responsavelcontrato
             FROM clienteempresas WHERE idcliente = $1 ORDER BY id DESC LIMIT 1`,
            [cliente.idcliente]
        );

        return res.json({
            existeNaEmpresaAtual: false,
            idcliente: cliente.idcliente,
            empresasVinculadas: empresasVinculadas.rows.map(r => r.nmfantasia),
            dados: { ...cliente, ...(vinculoExemplo.rows[0] || {}) }
        });
    } catch (error) {
        console.error("Erro ao verificar CPF/CNPJ do cliente:", error);
        res.status(500).json({ message: "Erro ao verificar CPF/CNPJ." });
    }
});

// GET todas ou por descrição
router.get("/", verificarPermissao('Clientes', 'pesquisar'), async (req, res) => {

  const { nmFantasia } = req.query;
  const idempresa = req.idempresa;
  console.log("nmFantasia na Rota:", nmFantasia); // Log do valor de nmFantasia
  try {
    if (nmFantasia) {
      console.log("🔍 Buscando cliente por nmFantasia:", nmFantasia, idempresa);
      const result = await pool.query(
        `SELECT ${CAMPOS_SELECT}
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
        `SELECT ${CAMPOS_SELECT}
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


// PUT atualizar cliente
// PATCH /:id/inscricao-municipal — atualiza SÓ esse campo (dado de cadastro
// global, não por-empresa). Rota dedicada de propósito: o PUT "/:id" abaixo
// espera o formulário inteiro de CadClientes.html e reescreve todas as
// colunas a partir do body, sem COALESCE — mandar um body parcial ali
// apagaria o resto do cadastro do cliente.
router.patch("/:id/inscricao-municipal", verificarPermissao('Clientes', 'alterar'), async (req, res) => {
  const { id } = req.params;
  const { inscricaomunicipal } = req.body;

  try {
    const result = await pool.query(
      `UPDATE clientes SET inscricaomunicipal = $1 WHERE idcliente = $2 RETURNING idcliente, inscricaomunicipal`,
      [inscricaomunicipal || null, id]
    );
    if (!result.rowCount) {
      return res.status(404).json({ message: "Cliente não encontrado." });
    }
    res.locals.acao = 'atualizou';
    res.locals.idregistroalterado = id;
    res.locals.dadosnovos = result.rows[0];
    return res.json(result.rows[0]);
  } catch (error) {
    console.error("Erro ao atualizar inscrição municipal do cliente:", error);
    res.status(500).json({ message: "Erro ao atualizar inscrição municipal." });
  }
});

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
          `SELECT ${CAMPOS_SELECT}
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
      nmFantasia, razaoSocial, cnpj, inscEstadual, inscricaoMunicipal,
      emailCliente, emailNfe, site, telefone,
      nmContato, celContato, emailContato,
      cep, rua, numero, complemento, bairro,
      cidade, estado, pais, tpcliente, responsavelContrato
    } = req.body;

    console.log("DADOS RECEBIDOS", req.body);

    let client;

    try {
      client = await pool.connect();
      await client.query('BEGIN');

      // 🔒 Validação: impede CNPJ duplicado NA MESMA EMPRESA
      const verificaCnpj = await client.query(
        `SELECT 1
         FROM clientes c
         INNER JOIN clienteempresas ce ON ce.idcliente = c.idcliente
         WHERE c.cnpj = $1
           AND ce.idempresa = $2
           AND c.idcliente <> $3`,
        [cnpj, idempresa, id]
      );

      if (verificaCnpj.rowCount > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          message: "Já existe outro cliente com este CNPJ nesta empresa."
        });
      }

      // ✅ Atualiza os dados CADASTRAIS (globais, mesmo CNPJ em todas as empresas)
      const resultPessoal = await client.query(
        `UPDATE clientes c
         SET nmfantasia = $1,
             razaosocial = $2,
             cnpj = $3,
             inscestadual = $4,
             inscricaomunicipal = $5,
             emailcliente = $6,
             site = $7,
             telefone = $8,
             cep = $9,
             rua = $10,
             numero = $11,
             complemento = $12,
             bairro = $13,
             cidade = $14,
             estado = $15,
             pais = $16,
             tpcliente = $17
         FROM clienteempresas ce
         WHERE c.idcliente = $18
           AND ce.idcliente = c.idcliente
           AND ce.idempresa = $19
         RETURNING c.idcliente`,
        [
          nmFantasia, razaoSocial, cnpj, inscEstadual, inscricaoMunicipal || null,
          emailCliente, site, telefone,
          cep, rua, numero, complemento, bairro,
          cidade, estado, pais, tpcliente,
          id, idempresa
        ]
      );

      if (!resultPessoal.rowCount) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          message: "Cliente não encontrado ou você não tem permissão para atualizá-lo."
        });
      }

      // ✅ Atualiza os dados de VÍNCULO (por empresa: ativo, contato, nfe, responsável)
      await client.query(
        `UPDATE clienteempresas
         SET ativo = $1,
             nmcontato = $2,
             celcontato = $3,
             emailcontato = $4,
             emailnfe = $5,
             responsavelcontrato = $6
         WHERE idcliente = $7 AND idempresa = $8`,
        [
          ativo, nmContato, celContato, emailContato, emailNfe, responsavelContrato,
          id, idempresa
        ]
      );

      await client.query('COMMIT');

      // 🔹 Dados para o log
      res.locals.acao = 'atualizou';
      res.locals.idregistroalterado = resultPessoal.rows[0].idcliente;
      res.locals.idusuarioAlvo = null;
      res.locals.dadosnovos = req.body;

      return res.json({
        message: "Cliente atualizado com sucesso!",
        cliente: resultPessoal.rows[0]
      });

    } catch (error) {
      if (client) await client.query('ROLLBACK');
      console.error("❌ Erro ao atualizar cliente:", error);
      res.status(500).json({
        message: "Erro ao atualizar cliente."
      });
    } finally {
      if (client) client.release();
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
      nmFantasia, razaoSocial, cnpj, inscEstadual, inscricaoMunicipal, emailCliente, emailNfe,
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

        // 3️⃣ Vincula o cliente existente à nova empresa, já com os dados de
        // vínculo (ativo/contato/nfe/responsável) preenchidos neste formulário —
        // antes esses valores eram descartados silenciosamente (só as duas FKs
        // eram gravadas).
        await client.query(
          `INSERT INTO clienteempresas (
            idcliente, idempresa, ativo, nmcontato, celcontato, emailcontato, emailnfe, responsavelcontrato
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [idcliente, idempresa, ativo, nmContato, celContato, emailContato, emailNfe, responsavelContrato]
        );

        await client.query('COMMIT');

        res.locals.acao = 'vinculou';
        res.locals.idregistroalterado = idcliente;
        res.locals.dadosnovos = clienteExistente.rows[0];

        return res.status(201).json({
          mensagem: "Cliente já existente vinculado à empresa com sucesso!",
          cliente: clienteExistente.rows[0]
        });
      }

      // 4️⃣ Cliente NÃO existe → cria novo (dados cadastrais globais)
      const resultCliente = await client.query(
        `INSERT INTO clientes (
          nmfantasia, razaosocial, cnpj, inscestadual, inscricaomunicipal, emailcliente,
          site, telefone, cep, rua, numero, complemento, bairro, cidade, estado, pais, tpcliente
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17
        )
        RETURNING idcliente, nmfantasia`,
        [
          nmFantasia, razaoSocial, cnpj, inscEstadual, inscricaoMunicipal || null, emailCliente,
          site, telefone, cep, rua, numero, complemento, bairro, cidade, estado, pais, tpcliente
        ]
      );

      idcliente = resultCliente.rows[0].idcliente;

      // Vínculo (por empresa: ativo, contato, nfe, responsável)
      await client.query(
        `INSERT INTO clienteempresas (
          idcliente, idempresa, ativo, nmcontato, celcontato, emailcontato, emailnfe, responsavelcontrato
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [idcliente, idempresa, ativo, nmContato, celContato, emailContato, emailNfe, responsavelContrato]
      );

      await client.query('COMMIT');

      res.locals.acao = 'cadastrou';
      res.locals.idregistroalterado = idcliente;
      res.locals.dadosnovos = resultCliente.rows[0];

      res.status(201).json({
        mensagem: "Cliente cadastrado e vinculado à empresa com sucesso!",
        cliente: resultCliente.rows[0]
      });

    } catch (error) {
      if (client) await client.query('ROLLBACK');
      console.error("❌ Erro ao salvar cliente:", error);
      res.status(500).json({ erro: "Erro ao salvar cliente." });
    } finally {
      if (client) client.release();
    }
  }
);




module.exports = router;
