const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB");
const { autenticarToken } = require('../middlewares/authMiddlewares');
const { verificarPermissao } = require('../middlewares/permissaoMiddleware');

// Aplica autenticação em todas as rotas
router.use(autenticarToken);

// GET todas ou por id
router.get("/", autenticarToken, verificarPermissao('Orcamentos', 'pesquisar'), async (req, res) => {
  const { idOrcamento } = req.query;

  try {
    if (idOrcamento) {
      const result = await pool.query(
        "SELECT * FROM orcamentos WHERE id = $1 LIMIT 1",
        [idOrcamento]
      );
      return result.rows.length
        ? res.json(result.rows[0])
        : res.status(404).json({ message: "Orçamento não encontrado" });
    } else {
      const result = await pool.query("SELECT * FROM orcamentos");
      return result.rows.length
        ? res.json(result.rows)
        : res.status(404).json({ message: "Nenhum orçamento encontrado" });
    }
  } catch (error) {
    console.error("Erro ao buscar orçamento:", error);
    res.status(500).json({ message: "Erro ao buscar orçamento" });
  }
});

// GET /orcamento/clientes
router.get('/clientes',  async (req, res) => {
    const permissoes = req.usuario?.permissoes;

    const temPermissaoOrcamento = permissoes?.some(p =>
        p.modulo === 'orcamentos' && (p.acessar || p.pesquisar)
    );

    if (!temPermissaoOrcamento) {
        return res.status(403).json({ erro: "Sem permissão ao módulo Orçamentos." });
    }

    try {
        const resultado = await pool.query('SELECT idcliente, nmfantasia FROM clientes ORDER BY nmfantasia');
        res.json(resultado.rows);
    } catch (erro) {
        console.error("Erro ao buscar clientes para orçamento:", erro);
        res.status(500).json({ erro: "Erro interno ao buscar clientes." });
    }
});


// POST criar novo orçamento com itens
router.post("/", autenticarToken, verificarPermissao('Orcamentos', 'cadastrar'), async (req, res) => {
  const client = await pool.connect();
  const dados = req.body;

  console.log("ENTROU NO POST", dados, client);
  try {
    await client.query('BEGIN');

    const insertOrcamento = `
      INSERT INTO orcamentos (idcliente, idevento, idlocalmontagem, dtinimarcacao, dtfimmarcacao, dtinimontagem, dtfimmontagem,
       dtinirealizacao, dtfimrealizacao, dtinidesmontagem, dtfimdesmontagem, totvdageral, totctogeral, desconto, acrescimo,
       lucrobruto, lucroreal, vlrcliente, observacao, status)
      VALUES ($1, $2, $3, $4, $5, $6,$7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      RETURNING idOrcamento
    `;

    const valoresOrcamento = [
      dados.idCliente || null,
      dados.idEvento || null,
      dados.idLocalMontagem || null,
      dados.dtIniMarcacao || null,
      dados.dtFimMarcacao || null,
      dados.dtIniMontagem || null,
      dados.dtFimMontagem || null,
      dados.dtIniRealizacao || null,
      dados.dtFimRealizacao || null,
      dados.dtIniDesmontagem || null,
      dados.dtFimRealizacao || null,
      dados.totVdaGeral || null,
      dados.totCtoGeral || null,
      dados.desconto || null,
      dados.acrescimo || null,
      dados.lucroBruto || null,
      dados.lucroReal || null,
      dados.vlrCliente || null,
      dados.status || null,
      dados.observacoes || ''
    ];

    const resOrcamento = await client.query(insertOrcamento, valoresOrcamento);
    const orcamentoId = resOrcamento.rows[0].id;

    console.log("resOrcamento", resOrcamento);

    const insertItem = `
      INSERT INTO orcamentoitens (
        idorcamento, categoria, idproduto, qtdproduto, qtddias,
        vdadiaria, totvdadiaria, ctodiaria, totctodiaria,
        ajdctodiaria, totajdctodiaria, vlrhospdiaria, vlrtranspdiaria, totgeralcto
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10, $11, $12, $13, $14)
        RETURNING idorcitem
    `;

    for (const item of dados.itens) {
      const valoresItem = [
        orcamentoId,
        item.categoria,
        item.produto,
        parseInt(item.qtdPessoas),
        parseInt(item.qtdDias),
        parseFloat(item.vlrVenda?.replace(/[R$.,\s]/g, '').replace(',', '.') || 0),
        parseFloat(item.totVdaDiaria?.replace(/[R$.,\s]/g, '').replace(',', '.') || 0),
        parseFloat(item.vlrCusto?.replace(/[R$.,\s]/g, '').replace(',', '.') || 0),
        parseFloat(item.totCtoDiaria?.replace(/[R$.,\s]/g, '').replace(',', '.') || 0),
        parseFloat(item.ajdCusto?.replace(/[R$.,\s]/g, '').replace(',', '.') || 0),
        parseFloat(item.totAjdCusto?.replace(/[R$.,\s]/g, '').replace(',', '.') || 0),
        parseFloat(item.hospedagem || 0),
        parseFloat(item.transporte || 0),
        parseFloat(item.totGeral?.replace(/[R$.,\s]/g, '').replace(',', '.') || 0)
      ];

      await client.query(insertItem, valoresItem);
    }

    await client.query('COMMIT');
    res.status(200).json({ mensagem: "Orçamento salvo com sucesso", id: orcamentoId });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Erro ao salvar orçamento:", error);
    res.status(500).json({ mensagem: "Erro ao salvar orçamento" });
  } finally {
    client.release();
  }
});

module.exports = router;
