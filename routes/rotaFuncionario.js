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
router.get("/", verificarPermissao('Funcionarios', 'pesquisar'), async (req, res) => {
  const { nome } = req.query;
  const idempresa = req.idempresa;

  try {
    if (nome) {
      const result = await pool.query(
        `SELECT func.* FROM funcionarios func
        INNER JOIN funcionarioempresas funce ON funce.idfuncionario = func.idfuncionario
        WHERE funce.idempresa = $1 AND func.nome ILIKE $2 ORDER BY func.nome ASC LIMIT 1 `,
        [idempresa, nome]
      );
      return result.rows.length
        ? res.json(result.rows[0])
        : res.status(404).json({ message: "funcionario não encontrada" });
    } else {
      const result = await pool.query("SELECT * FROM funcionarios ORDER BY nome ASC");
      return result.rows.length
        ? res.json(result.rows)
        : res.status(404).json({ message: "Nenhum Funcionário Encontrado" });
    }
  } catch (error) {
    console.error("Erro ao buscar nome :", error);
    res.status(500).json({ message: "Erro ao buscar nome " });
  }
});


// PUT atualizar
router.put("/:id", verificarPermissao('Funcionarios', 'alterar'), 
  logMiddleware('Funcionarios', { // Módulo 'Funcionarios'
        buscarDadosAnteriores: async (req) => {
          const idFuncionario = req.params.id; // O ID do evento vem do parâmetro da URL
          const idempresa = req.idempresa;
            // Para POST, não há dados anteriores para buscar de um ID existente
          if (!idFuncionario) {
              return { dadosanteriores: null, idregistroalterado: null };
          }
          try {
              // ✅ Seleciona os dados do evento, garantindo que pertence à empresa do usuário
              const result = await pool.query(
                  `SELECT func.* FROM funcionarios func
                    INNER JOIN funcionarioempresas funce ON funce.idfuncionario = func.idfuncionario
                    WHERE func.idfuncionario = $1 AND funce.idempresa = $2`, // Assumindo que a coluna ID é 'idevento'
                  [idFuncionario, idempresa]
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
//   const ativo = req.body.ativo;
 // console.log("Ativo:", ativo); // Log do valor de ativo

  const { perfil, foto, nome, cpf, rg, influencia, idiomasadicionais, contatopessoal, contatoFamiliar, email, site, banco, codigobanco, pix, numeroconta, agencia, tipoconta, cep, rua, numero, complemento, bairro, cidade, estado, pais} = req.body;

  try {
    const result = await pool.query(
      `UPDATE funcionarios func
      SET perfil = $1, foto = &2, nome = &3, cpf = &4, rg = &5, influencia = &6, idiomasadicionais= &7, 
          contatoPessoal = &8, contatoFamiliar = &9, email = &10, site = &11, banco = &12, codigobanco = &13,
          pix = &14, numeroconta = &15, agencia = &16, tipoconta = &17, cep = &18, rua = &19, numero = &20, 
          complemento = &21, bairro = &22, cidade = &23, estado = &24, pais = &25 
      FROM funcionarioempresas funce 
      WHERE func.idfuncionario = $26 AND funce.idfuncionario = $27
      RETURNING func.idfuncionario`,
      [ perfil, foto, nome, cpf, rg, influencia, idiomasadicionais, contatopessoal, contatoFamiliar, email, site, banco, codigobanco, pix, numeroconta, agencia, tipoconta, cep, rua, numero, complemento, bairro, cidade, estado, pais, id, idempresa]
    );

    if (result.rowCount) {
      const funcionarioAtualizadoId = result.rows[0].idfuncionario;

      // --- Ponto Chave para o Log ---
      res.locals.acao = 'atualizou';
      res.locals.idregistroalterado = funcionarioAtualizadoId;
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

// POST criar nova função
router.post("/", verificarPermissao('Funcionarios', 'cadastrar'), 
  logMiddleware('Funcionarios', {
    buscarDadosAnteriores: async (req) => {
        return { dadosanteriores: null, idregistroalterado: null };
    }
  }),
  async (req, res) => {
  const { perfil, foto, nome, cpf, rg, influencia, idiomasadicionais, contatopessoal, contatofamiliar, email, site, banco, codigobanco, pix, numeroconta, agencia, tipoconta, cep, rua, numero, complemento, bairro, cidade, estado, pais} = req.body;
  const idempresa = req.idempresa; 

  let client;   

  try {
    client = await pool.connect(); 
    await client.query('BEGIN');

    const resultFuncionario = await client.query(
                `INSERT INTO Funcionarios (
                    perfil, foto, nome, cpf, rg, influencia, idiomasadicionais,
                    contatopessoal, contatofamiliar, email, site, banco, codigobanco, pix,
                    numeroConta, agencia, tipoConta, cep, rua, numero, complemento, bairro,
                    cidade, estado, pais
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
                RETURNING idFuncionarios`, // Retorna o ID do novo funcionário
                [
                    perfil, foto, nome, cpf, rg, influencia, idiomasadicionais,
                    contatopessoal, contatofamiliar, email, site, banco, codigobanco, pix,
                    numeroconta, agencia, tipoconta, cep, rua, numero, complemento, bairro,
                    cidade, estado, pais
                ]
    );
    const novoFuncionario = resultFuncionario.rows[0];
    const idNovoFuncionario = novoFuncionario.idfuncionarios; 

    await client.query(
        "INSERT INTO FuncionarioEmpresas (idFuncionario, idEmpresa) VALUES ($1, $2)",
        [idNovoFuncionario, idempresa]
    );
    await client.query('COMMIT');

    res.locals.acao = 'cadastrou';
    res.locals.idregistroalterado = idNovoFuncionario;
    res.locals.idusuarioAlvo = null;

    res.status(201).json({ mensagem: "Funcionário salvo e associado à empresa com sucesso!", funcionario: novoFuncionario });
  } catch (error) {
      if (client) { // Se a conexão foi estabelecida, faz o rollback
          await client.query('ROLLBACK');
      }
      console.error("❌ Erro ao salvar funcionário e/ou associá-lo à empresa:", error);
      res.status(500).json({ erro: "Erro ao salvar funcionário", detalhes: error.message });
  } finally {
      if (client) {
          client.release(); // Libera a conexão do pool, esteja o try/catch no que estiver
      }
  }
    
});



module.exports = router;