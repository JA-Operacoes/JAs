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
router.put("/:id", verificarPermissao('Clientes', 'alterar'), 
  logMiddleware('Clientes', { // 'Clientes' é o nome do módulo no log
        buscarDadosAnteriores: async (req) => {
            const idcliente = req.params.id; // O ID do cliente vem do parâmetro da URL
            const idempresa = req.idempresa; // O ID da empresa vem do req.idempresa

            if (!idcliente) { // Se não tem ID, não há dados anteriores para buscar
                return { dadosanteriores: null, idregistroalterado: null };
            }
            
            try {
                // Seleciona todos os campos importantes do cliente ANTES da atualização
                // Certifique-se de que a query pega os dados apenas do cliente da empresa correta
                const result = await pool.query(
                    `SELECT c.* FROM clientes c
                    INNER JOIN clienteempresas ce ON ce.idcliente = c.idcliente
                    WHERE c.idcliente = $1 AND ce.idempresa = $2`,
                    [idcliente, idempresa]
                );
                const linha = result.rows[0] || null; // Pega a primeira linha ou null se não encontrar
                return {
                    dadosanteriores: linha, // O objeto cliente antes da alteração
                    idregistroalterado: linha?.idcliente || null // O ID do cliente que está sendo alterado
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

    const { nmFantasia, razaoSocial, cnpj, inscEstadual, emailCliente, emailNfe, site, telefone, nmContato, celContato, emailContato, cep, rua, numero, complemento, bairro, cidade, estado, pais, tpcliente, responsavelContrato } = req.body;
  console.log("DADOS RECEBIDOS", req.body);
    try {
        // Adiciona a condição 'idempresa' para garantir que o usuário só possa atualizar clientes de sua empresa
        const result = await pool.query(
            `UPDATE clientes c
             SET nmfantasia = $1, razaosocial = $2, cnpj = $3, inscestadual = $4, emailcliente = $5, emailnfe = $6, site = $7, telefone = $8, nmcontato = $9, celcontato = $10, emailcontato = $11, cep = $12, rua = $13, numero = $14, complemento = $15, bairro = $16, cidade = $17, estado = $18, pais = $19, ativo = $20, tpcliente = $21, responsavelcontrato = $22
             FROM clienteempresas ce
             WHERE c.idcliente = $23 AND ce.idcliente = c.idcliente AND ce.idempresa = $24
             RETURNING c.idcliente`, // Retorna os dados do cliente atualizado
            [nmFantasia, razaoSocial, cnpj, inscEstadual, emailCliente, emailNfe, site, telefone, nmContato, celContato, emailContato, cep, rua, numero, complemento, bairro, cidade, estado, pais, ativo, tpcliente, responsavelContrato , id, idempresa]
        );

        if (result.rowCount) {
                // --- Ponto Chave para o Log ---
                res.locals.acao = 'atualizou';
                res.locals.idregistroalterado = result.rows[0].idcliente; // ID do cliente atualizado
                res.locals.idusuarioAlvo = null; // Não se aplica um 'usuário alvo' ao alterar um cliente

                return res.json({ message: "Cliente atualizado com sucesso!", cliente: result.rows[0] });
            } else {
                return res.status(404).json({ message: "Cliente não encontrado ou você não tem permissão para atualizá-lo." });
        }
      } catch (error) {
      console.error("❌ Erro ao atualizar cliente:", error);
      res.status(500).json({ message: "Erro ao atualizar cliente.", detail: error.message });
    }
});

// POST criar nova função
router.post("/", verificarPermissao('Clientes', 'cadastrar'),
  logMiddleware('Clientes', { // 'Clientes' é o nome do módulo no log
        // Para POST, não há dados anteriores para buscar, então a função retorna nulo
        buscarDadosAnteriores: async (req) => {
            return { dadosanteriores: null, idregistroalterado: null };
        }
  }),

  async (req, res) => {
  const ativo = req.body.ativo !== undefined ? req.body.ativo : false;
  const { nmFantasia, razaoSocial, cnpj, inscEstadual, emailCliente, emailNfe, site, telefone, nmContato, celContato, emailContato, cep, rua, numero, complemento, bairro, cidade, estado, pais, tpcliente, responsavelContrato } = req.body;
  const idempresa = req.idempresa;
 console.log("DADOS RECEBIDOS", req.body);
  let client; // Declara a variável client para uso em transação

    try {
        client = await pool.connect(); // Inicia uma transação para garantir atomicidade
        await client.query('BEGIN'); // Inicia a transação

        // 1. Insere o novo cliente na tabela 'clientes'
        const resultCliente = await client.query( // Usar 'client' ao invés de 'pool' para a transação
            "INSERT INTO clientes (nmfantasia, razaosocial, cnpj, inscestadual, emailcliente, emailnfe, site, telefone, nmcontato, celcontato, emailcontato, cep, rua, numero, complemento, bairro, cidade, estado, pais, ativo, tpcliente, responsavelcontrato) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22) RETURNING idcliente, nmfantasia",
            [nmFantasia, razaoSocial, cnpj, inscEstadual, emailCliente, emailNfe, site, telefone, nmContato, celContato, emailContato, cep, rua, numero, complemento, bairro, cidade, estado, pais, ativo, tpcliente, responsavelContrato]
        );

        const newCliente = resultCliente.rows[0];
        const idcliente = newCliente.idcliente;

        // 2. Insere a associação na tabela 'clienteempresas'
        await client.query(
            "INSERT INTO clienteempresas (idcliente, idempresa) VALUES ($1, $2)",
            [idcliente, idempresa]
        );

        await client.query('COMMIT'); // Confirma a transação
        console.log(`✅ Cliente "${newCliente.nmfantasia}" (ID: ${idcliente}) salvo e associado à empresa ${idempresa} com sucesso!`);
        
        res.locals.acao = 'cadastrou';
        res.locals.idregistroalterado = idcliente; // ID do novo cliente
        res.locals.idusuarioAlvo = null; 

        res.status(201).json({ mensagem: "Cliente salvo com sucesso!", cliente: newCliente }); // Status 201 para criação
    } catch (error) {
        await client.query('ROLLBACK'); // Desfaz a transação em caso de erro
        if (error.code === '23505') {
            console.warn("⚠️ CNPJ já existe na base de dados!");
            return res.status(409).json({
                erro: "CNPJ já cadastrado.",
                detalhe: "Já existe um cliente com este CNPJ no sistema."
            });
        }
        console.error("❌ Erro ao salvar cliente e/ou associá-lo à empresa:", error);
        res.status(500).json({ erro: "Erro ao salvar cliente.", detail: error.message });
    } finally {
        if (client) {
            client.release(); // Libera o cliente do pool
        }
    }
});



module.exports = router;