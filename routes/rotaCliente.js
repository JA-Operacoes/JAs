const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB");
const { autenticarToken, contextoEmpresa } = require('../middlewares/authMiddlewares');
const { verificarPermissao } = require('../middlewares/permissaoMiddleware');

// Aplica autenticação em todas as rotas
router.use(autenticarToken);
router.use(contextoEmpresa);

// GET todas ou por descrição
router.get("/", verificarPermissao('Clientes', 'pesquisar'), async (req, res) => {
  const { nmFantasia } = req.query;
  console.log("nmFantasia na Rota:", nmFantasia); // Log do valor de nmFantasia
  try {
    if (nmFantasia) {
      const result = await pool.query(
        "SELECT * FROM clientes WHERE nmfantasia ILIKE $1 ORDER BY nmfantasia ASC LIMIT 1 ",
        [nmFantasia]
      );
      return result.rows.length
        ? res.json(result.rows[0])
        : res.status(404).json({ message: "Cliente não encontrada" });
    } else {
      const result = await pool.query("SELECT * FROM clientes ORDER BY nmFantasia ASC");
      return result.rows.length
        ? res.json(result.rows)
        : res.status(404).json({ message: "Nenhum Cliente encontrado" });
    }
  } catch (error) {
    console.error("Erro ao buscar nome fantasia:", error);
    res.status(500).json({ message: "Erro ao buscar nome fantasia" });
  }
});

// PUT atualizar
router.put("/:id", verificarPermissao('Clientes', 'alterar'), async (req, res) => {
  const id = req.params.id;
  const ativo = req.body.ativo;
 // console.log("Ativo:", ativo); // Log do valor de ativo

  const { nmFantasia, razaoSocial, cnpj, inscEstadual, emailCliente, emailNfe, site, telefone, nmContato, celContato, emailContato,   cep, rua, numero, complemento, bairro, cidade, estado, pais, tpcliente } = req.body;

  try {
    const result = await pool.query(
      `UPDATE clientes SET nmfantasia = $1, razaosocial = $2, cnpj = $3, inscestadual = $4, emailcliente = $5, emailnfe = $6, site = $7, telefone = $8, nmcontato = $9, celcontato = $10, emailcontato = $11, cep = $12, rua = $13, numero = $14, complemento = $15, bairro = $16, cidade = $17, estado = $18, pais = $19, ativo = $20, tpcliente = $21 WHERE idcliente = $22 RETURNING *`,
      [nmFantasia, razaoSocial, cnpj, inscEstadual, emailCliente, emailNfe, site, telefone, nmContato, celContato, emailContato, cep, rua, numero, complemento, bairro, cidade, estado, pais, ativo, tpcliente, id]
    );

    return result.rowCount
      ? res.json({ message: "Cliente atualizada com sucesso!", cliente: result.rows[0] })
      : res.status(404).json({ message: "Cliente não encontrada para atualizar." });
  } catch (error) {
    console.error("Erro ao atualizar cliente:", error);
          // já imprime stack no terminal
    res.status(500).json({ message: "Erro ao atualizar cliente.", detail: error.message });
    
  }
});

// POST criar nova função
router.post("/", verificarPermissao('Clientes', 'cadastrar'), async (req, res) => {
  const ativo = req.body.ativo === "on" ? true : false;
  const { nmFantasia, razaoSocial, cnpj, inscEstadual, emailCliente, emailNfe, site, telefone, nmContato, celContato, emailContato,   cep, rua, numero, complemento, bairro, cidade, estado, pais, tpcliente } = req.body;

  try {
    const result = await pool.query(
      "INSERT INTO clientes (nmfantasia, razaosocial, cnpj, inscestadual, emailcliente, emailnfe, site, telefone, nmcontato, celcontato, emailcontato,  cep, rua, numero, complemento, bairro, cidade, estado, pais, ativo, tpcliente) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21) RETURNING *",
      [nmFantasia, razaoSocial, cnpj, inscEstadual, emailCliente, emailNfe,  site, telefone, nmContato, celContato, emailContato, cep, rua, numero, complemento, bairro, cidade, estado, pais, ativo, tpcliente]
    );
    res.json({ mensagem: "Cliente salvo com sucesso!", cliente: result.rows[0] });
  } catch (error) {
    console.error("Erro ao salvar cliente:", error);
    res.status(500).json({ erro: "Erro ao salvar cliente" });
  }
});



module.exports = router;