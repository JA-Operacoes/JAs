const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB");
const { autenticarToken, contextoEmpresa } = require('../middlewares/authMiddlewares');
const { verificarPermissao } = require('../middlewares/permissaoMiddleware');
const logMiddleware = require('../middlewares/logMiddleware');

router.use(autenticarToken());
router.use(contextoEmpresa);

// GET todas ou por descrição
router.get("/", verificarPermissao('Bancos', 'pesquisar'), async (req, res) => {
  const { nmBanco, codBanco } = req.query;
  const idempresa = req.idempresa;
  console.log("nmBanco NA ROTA", nmBanco, codBanco, idempresa);
  try {
    let result;

        if (codBanco) { // Priorize a busca por código do banco se ele existir
            result = await pool.query(
                `SELECT b.idbanco, b.codbanco, b.nmbanco
                 FROM bancos b
                 INNER JOIN bancoempresas be ON be.idbanco = b.idbanco
                 WHERE be.idempresa = $1 AND b.codbanco = $2`, // Use = para correspondência exata do código
                [idempresa, codBanco]
            );
            console.log("RESULTADO QUERY POR CODIGO", result.rows);
            return result.rows.length > 0
                ? res.json(result.rows[0]) // Retorna o primeiro encontrado, já que o código deve ser único
                : res.status(404).json({ message: "Banco não encontrado com o código fornecido para esta empresa." });
        } else if (nmBanco) { // Se não tem codBanco, verifica nmBanco
            result = await pool.query(
                `SELECT b.idbanco, b.codbanco, b.nmbanco
                 FROM bancos b
                 INNER JOIN bancoempresas be ON be.idbanco = b.idbanco
                 WHERE be.idempresa = $1 AND b.nmbanco ILIKE $2 LIMIT 1`,
                [idempresa, `%${nmBanco}%`]
            );
            console.log("RESULTADO QUERY POR NOME", result.rows);
            return result.rows.length > 0
                ? res.json(result.rows[0])
                : res.status(404).json({ message: "Banco não encontrado com o nome fornecido para esta empresa." });
        } else { // Se nenhum parâmetro de busca, retorna todos os bancos da empresa
            result = await pool.query(
                `SELECT b.idbanco, b.codbanco, b.nmbanco
                 FROM bancos b
                 INNER JOIN bancoempresas be ON be.idbanco = b.idbanco
                 WHERE be.idempresa = $1
                 ORDER BY b.nmbanco ASC`,
                [idempresa]
            );
            console.log("RESULTADO QUERY TODOS", result.rows);
            return result.rows.length > 0
                ? res.json(result.rows)
                : res.status(404).json({ message: "Nenhum banco encontrado para esta empresa." });
        }
    } catch (error) {
        console.error("❌ Erro ao buscar bancos:", error);
        return res.status(500).json({ error: error.message || "Erro ao buscar bancos" });
    }
});

// PUT atualizar
router.put("/:id", verificarPermissao('Bancos', 'alterar'), 
  logMiddleware('Bancos', { // ✅ Módulo 'bancos' para o log
      buscarDadosAnteriores: async (req) => {
          const idBanco = req.params.id; 
          const idempresa = req.idempresa; 

          if (!idBanco) {
              return { dadosanteriores: null, idregistroalterado: null };
          }

          try {
              
              const result = await pool.query(
                  `SELECT b.* FROM bancos b
                    INNER JOIN bancoempresas be ON be.idbanco = b.idbanco
                    WHERE b.idbanco = $1 AND be.idempresa = $2`, 
                  [idBanco, idempresa]
              );
              const linha = result.rows[0] || null;
              return {
                  dadosanteriores: linha, 
                  idregistroalterado: linha?.idbanco || null 
              };
          } catch (error) {
              console.error("Erro ao buscar dados anteriores do banco:", error);
              return { dadosanteriores: null, idregistroalterado: null };
          }
      }
  }),
  async (req, res) => {
  const id = req.params.id;
  const idempresa = req.idempresa;
  const { nmBanco } = req.body;

  try {
    const result = await pool.query(
      `UPDATE bancos b
        SET nmbanco = $1
        FROM bancoempresas be
        WHERE b.idbanco = $2 AND be.idbanco = b.idbanco AND be.idempresa = $3
        RETURNING b.idbanco`, // ✅ Retorna idbanco para o log
      [nmBanco, id, idempresa]
    );

    if (result.rowCount) {
      const bancoAtualizadoId = result.rows[0].idbanco;

      // --- Ponto Chave para o Log ---
      res.locals.acao = 'atualizou';
      res.locals.idregistroalterado = bancoAtualizadoId;
      res.locals.idusuarioAlvo = null;

      return res.json({ message: "Banco atualizado com sucesso!", bancos: result.rows[0] });
    } else {
        return res.status(404).json({ message: "Banco não encontrado ou você não tem permissão para atualizá-lo." });
    }
  } catch (error) {
      console.error("Erro ao atualizar banco:", error);
      res.status(500).json({ message: "Erro ao atualizar banco." });
  }
});

// POST criar nova bancos
router.post("/", verificarPermissao('Bancos', 'cadastrar'), 
  logMiddleware('Bancos', {
        buscarDadosAnteriores: async (req) => {
            return { dadosanteriores: null, idregistroalterado: null };
        }
  }),
  async (req, res) => {
  const { nmBanco, codBanco } = req.body; 
  const idempresa = req.idempresa; 

  let client; 
  console.log("nmBanco na rota", nmBanco, codBanco);
  try {
    client = await pool.connect(); 
    await client.query('BEGIN');
   
    const resultBanco = await client.query(
        "INSERT INTO bancos (codbanco, nmbanco) VALUES ($1, $2) RETURNING idbanco, codbanco, nmbanco", 
        [codBanco, nmBanco]
    );

    const novoBanco = resultBanco.rows[0];
    const idbanco = novoBanco.idbanco;

    await client.query(
        "INSERT INTO bancoempresas (idbanco, idempresa) VALUES ($1, $2)",
        [idbanco, idempresa]
    );

    await client.query('COMMIT'); 

    const novoBancoId = idbanco; 
    res.locals.acao = 'cadastrou';
    res.locals.idregistroalterado = novoBancoId;
    res.locals.idusuarioAlvo = null;

    res.status(201).json({ mensagem: "Banco salvo com sucesso!", bancos: novoBanco }); // Status 201 para criação
  } catch (error) {
      if (client) { // Se a conexão foi estabelecida, faz o rollback
          await client.query('ROLLBACK');
      }
      console.error("❌ Erro ao salvar banco e/ou associá-lo à empresa:", error);
      res.status(500).json({ erro: "Erro ao salvar banco", detalhes: error.message });
  } finally {
      if (client) {
          client.release(); // Libera a conexão do pool
      }
  }
    
});

module.exports = router;