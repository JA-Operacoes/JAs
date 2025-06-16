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
router.get("/", verificarPermissao('Eventos', 'pesquisar'), async (req, res) => {
  const { nmEvento } = req.query;
  const idempresa = req.idempresa;
  console.log("nmEvento NA ROTA", nmEvento, idempresa);
  try {
    if (nmEvento) {
      const result = await pool.query(
        `SELECT e.* FROM eventos e
          INNER JOIN eventoempresas ee ON ee.idevento = e.idevento
          WHERE ee.idempresa = $1 AND e.nmevento ILIKE $2 LIMIT 1`,
        [idempresa, `%${nmEvento}%`]
      );
      console.log("RESULTADO QUERY", result);
      return result.rows.length
        ? res.json(result.rows[0])
        : res.status(404).json({ message: "Evento não encontrada" });
    } else {
      const result = await pool.query(`SELECT e.* FROM eventos e
                 INNER JOIN eventoempresas ee ON ee.idevento = e.idevento
                 WHERE ee.idempresa = $1 ORDER BY nmevento ASC`,
                [idempresa]);
      return result.rows.length
        ? res.json(result.rows)
        : res.status(404).json({ message: "Nenhuma evento encontrada" });
    }
  } catch (error) {
    console.error("Erro ao buscar evento:", error);
    res.status(500).json({ message: "Erro ao buscar evento" });
  }
});

// PUT atualizar
router.put("/:id", verificarPermissao('Eventos', 'alterar'), 
  logMiddleware('Eventos', { // ✅ Módulo 'Eventos' para o log
      buscarDadosAnteriores: async (req) => {
          const idEvento = req.params.id; // O ID do evento vem do parâmetro da URL
          const idempresa = req.idempresa; // ✅ Obtém o idempresa do contexto

          if (!idEvento) {
              return { dadosanteriores: null, idregistroalterado: null };
          }

          try {
              // ✅ Seleciona os dados do evento, garantindo que pertence à empresa do usuário
              const result = await pool.query(
                  `SELECT e.* FROM eventos e
                    INNER JOIN eventoempresas ee ON ee.idevento = e.idevento
                    WHERE e.idevento = $1 AND ee.idempresa = $2`, // Assumindo que a coluna ID é 'idevento'
                  [idEvento, idempresa]
              );
              const linha = result.rows[0] || null;
              return {
                  dadosanteriores: linha, // O objeto evento antes da alteração
                  idregistroalterado: linha?.idevento || null // O ID do evento que está sendo alterado
              };
          } catch (error) {
              console.error("Erro ao buscar dados anteriores do evento:", error);
              return { dadosanteriores: null, idregistroalterado: null };
          }
      }
  }),
  async (req, res) => {
  const id = req.params.id;
  const idempresa = req.idempresa;
  const { nmEvento } = req.body;

  try {
    const result = await pool.query(
      `UPDATE eventos e
        SET nmevento = $1
        FROM eventoempresas ee
        WHERE e.idevento = $2 AND ee.idevento = e.idevento AND ee.idempresa = $3
        RETURNING e.idevento`, // ✅ Retorna idevento para o log
      [nmEvento, id, idempresa]
    );

    if (result.rowCount) {
      const eventoAtualizadoId = result.rows[0].idevento;

      // --- Ponto Chave para o Log ---
      res.locals.acao = 'atualizou';
      res.locals.idregistroalterado = eventoAtualizadoId;
      res.locals.idusuarioAlvo = null;

      return res.json({ message: "Evento atualizado com sucesso!", eventos: result.rows[0] });
    } else {
        return res.status(404).json({ message: "Evento não encontrado ou você não tem permissão para atualizá-lo." });
    }
  } catch (error) {
      console.error("Erro ao atualizar evento:", error);
      res.status(500).json({ message: "Erro ao atualizar evento." });
  }
});

// POST criar nova eventos
router.post("/", verificarPermissao('Eventos', 'cadastrar'), 
  logMiddleware('Eventos', {
        buscarDadosAnteriores: async (req) => {
            return { dadosanteriores: null, idregistroalterado: null };
        }
  }),
  async (req, res) => {
  const { nmEvento } = req.body;
  const idempresa = req.idempresa; 

  let client; 
  console.log("nmEvento na rota", nmEvento);
  try {
    client = await pool.connect(); 
    await client.query('BEGIN');
   
    const resultEvento = await client.query(
        "INSERT INTO eventos (nmevento) VALUES ($1) RETURNING idevento, nmevento", 
        [nmEvento]
    );

    const novoEvento = resultEvento.rows[0];
    const idevento = novoEvento.idevento;

    await client.query(
        "INSERT INTO eventoempresas (idevento, idempresa) VALUES ($1, $2)",
        [idevento, idempresa]
    );

    await client.query('COMMIT'); // Confirma a transação

    const novoEventoId = idevento; // ID do evento recém-criado
    res.locals.acao = 'cadastrou';
    res.locals.idregistroalterado = novoEventoId;
    res.locals.idusuarioAlvo = null;

    res.status(201).json({ mensagem: "Evento salvo com sucesso!", eventos: novoEvento }); // Status 201 para criação
  } catch (error) {
      if (client) { // Se a conexão foi estabelecida, faz o rollback
          await client.query('ROLLBACK');
      }
      console.error("❌ Erro ao salvar evento e/ou associá-lo à empresa:", error);
      res.status(500).json({ erro: "Erro ao salvar evento", detalhes: error.message });
  } finally {
      if (client) {
          client.release(); // Libera a conexão do pool
      }
  }
    
});

module.exports = router;