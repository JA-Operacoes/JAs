const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB");

// GET todas ou por descrição
router.get("/", async (req, res) => {
  const { nome } = req.query;

  try {
    if (nome) {
      const result = await pool.query(
        "SELECT * FROM funcionarios WHERE nome ILIKE $1 ORDER BY nome ASC LIMIT 1 ",
        [nome]
      );
      return result.rows.length
        ? res.json(result.rows[0])
        : res.status(404).json({ message: "funcionario não encontrada" });
    } else {
      const result = await pool.query("SELECT * FROM funcionarios ORDER BY nome ASC");
      return result.rows.length
        ? res.json(result.rows)
        : res.status(404).json({ message: "Nenhum funcionario encontrado" });
    }
  } catch (error) {
    console.error("Erro ao buscar nome :", error);
    res.status(500).json({ message: "Erro ao buscar nome " });
  }
});


// PUT atualizar
router.put("/:id", async (req, res) => {
  const id = req.params.id;
//   const ativo = req.body.ativo;
 // console.log("Ativo:", ativo); // Log do valor de ativo

  const { areadeatuacao, foto, nome, cpf, rg, contatoPessoal, contatoFamiliar, email, cep, rua, numero, complemento, bairro, cidade, estado, pais  } = req.body;

  try {
    const result = await pool.query(
      `UPDATE funcionarios SET areadeatuacao = $1, foto = &2, nome = &3, cpf = &4, rg = &5, contatoPessoal = &6, contatoFamiliar = &7, email = &8, cep = &9, rua = &10, numero = &11, complemento = &12, bairro = &13, cidade = &14, estado = &15, pais = &16 RETURNING *`,
      [areadeatuacao, foto, nome, cpf, rg, contatoPessoal, contatoFamiliar, email, cep, rua, numero, complemento, bairro, cidade, estado, pais]
    );

    return result.rowCount
      ? res.json({ message: "Funcionario atualizado com sucesso!", funcionarios: result.rows[0] })
      : res.status(404).json({ message: "Funcionario não encontrada para atualizar." });
  } catch (error) {
    console.error("Erro ao atualizar funcionarios:", error);
          // já imprime stack no terminal
    res.status(500).json({ message: "Erro ao atualizar funcionarios.", detail: error.message });
    
  }
});

// POST criar nova função
router.post("/", async (req, res) => {
//   const ativo = req.body.ativo === "on" ? true : false;
  const { areadeatuacao, foto, nome, cpf, rg, contatoPessoal, contatoFamiliar, email, cep, rua, numero, complemento, bairro, cidade, estado, pais} = req.body;

  try {
    const result = await pool.query(
      "areadeatuacao, foto, nome, cpf, rg, contatoPessoal, contatoFamiliar, email, cep, rua, numero, complemento, bairro, cidade, estado, pais) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING *",
      [areadeatuacao, foto, nome, cpf, rg, contatoPessoal, contatoFamiliar, email, cep, rua, numero, complemento, bairro, cidade, estado, pais]
    );
    res.json({ mensagem: "funcionarios salvo com sucesso!", funcionarios: result.rows[0] });
  } catch (error) {
    console.error("Erro ao salvar funcionarios:", error);
    res.status(500).json({ erro: "Erro ao salvar funcionarios" });
  }
});



module.exports = router;