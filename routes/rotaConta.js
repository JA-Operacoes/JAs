const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB");
const { autenticarToken, contextoEmpresa } = require('../middlewares/authMiddlewares');
const { verificarPermissao } = require('../middlewares/permissaoMiddleware');
const logMiddleware = require('../middlewares/logMiddleware');


router.get("/empresas", autenticarToken(), async (req, res) => {    
  const idempresa = req.idempresa;

  console.log('Query Params EMPRESAS recebidos em ROTA CONTAS:', req.query);

    try {
        const result = await pool.query(
            `SELECT idempresa, nmfantasia, razaosocial
             FROM empresas 
             WHERE ativo = true      
             ORDER BY nmfantasia ASC`             
        );

        console.log("Empresas buscadas com sucesso.");
        res.json(result.rows);
        
    } catch (error) {
        console.error("Erro ao buscar empresas:", error);
        res.status(500).json({ message: "Erro ao buscar empresas" });
    }
});

router.get("/tipoconta", autenticarToken(), async (req, res) => {
  
  const idempresa = req.idempresa;

  console.log('Query Params TIPO CONTA recebidos em ROTA CONTAS:', req.query);

  try {    
      const result = await pool.query(
        // CORREÇÃO: Order by nmtipoconta (nome da coluna correto)
        `SELECT * FROM tipoconta WHERE idempresa = $1 ORDER BY nmtipoconta ASC`,
        [idempresa]
      );
      return res.json(result.rows);
    
  } catch (error) {
    console.error("Erro ao buscar conta:", error);
    res.status(500).json({ message: "Erro ao buscar conta no banco de dados" });
  }
});

router.get("/planocontas", autenticarToken(), async (req, res) => {
  const idempresa = req.idempresa;

  console.log('Query Params PLANO CONTAS recebidos em ROTA CONTAS:', req.query);

  try {    
      const result = await pool.query(
        `SELECT * FROM planocontas WHERE idempresa = $1 ORDER BY nmplanocontas ASC`,
        [idempresa]
      );
      return result.rows.length
        ? res.json(result.rows)
        : res.status(404).json({ message: "Nenhuma conta encontrada" });
    
  } catch (error) {
    console.error("Erro ao buscar conta:", error);
    res.status(500).json({ message: "Erro ao buscar conta" });
  }
});

// router.get("/proximo-codigo/:prefixo", autenticarToken(), async (req, res) => {
//     const { prefixo } = req.params; // Recebe algo como "01.00"
//     const idempresa = req.idempresa;

//     try {
//         // Busca o maior código que comece com o prefixo
//         const result = await pool.query(
//             `SELECT codconta FROM contas 
//              WHERE idempresa = $1 AND codconta LIKE $2 
//              ORDER BY codconta DESC LIMIT 1`,
//             [idempresa, `${prefixo}.%`]
//         );

//         let novoSequencial = 1;

//         if (result.rows.length > 0) {
//             const ultimoCodigo = result.rows[0].codigo;
//             const partes = ultimoCodigo.split('.');
//             const ultimoSegmento = parseInt(partes[partes.length - 1]);
//             novoSequencial = ultimoSegmento + 1;
//         }

//         // Formata com zeros à esquerda (ex: 1 vira 01)
//         const proximoCodigo = `${prefixo}.${novoSequencial.toString().padStart(2, '0')}`;
        
//         res.json({ proximoCodigo });
//     } catch (error) {
//         console.error("Erro ao calcular próximo código:", error);
//         res.status(500).json({ message: "Erro interno" });
//     }
// });

// Aplica autenticação em todas as rotas


router.get("/proximo-codigo/:prefixo", autenticarToken(), async (req, res) => {
    const { prefixo } = req.params; 
    const idempresa = req.idempresa;

    try {
        // Busca o maior código que comece com o prefixo (ex: 01.00.%)
        const result = await pool.query(
            `SELECT codconta FROM contas 
             WHERE idempresa = $1 AND codconta LIKE $2 
             ORDER BY codconta DESC LIMIT 1`,
            [idempresa, `${prefixo}.%`]
        );

        let novoSequencial = 1;

        // VERIFICAÇÃO: Só tenta dar split se a query retornou algo e o campo não é nulo
        if (result.rows.length > 0 && result.rows[0].codigo) {
            const ultimoCodigo = result.rows[0].codigo;
            const partes = ultimoCodigo.split('.'); // Aqui não dará mais erro
            
            // Pega o último número da sequência
            const ultimoSegmento = parseInt(partes[partes.length - 1]);
            
            if (!isNaN(ultimoSegmento)) {
                novoSequencial = ultimoSegmento + 1;
            }
        }

        // Formata o próximo código (ex: 01.00.01)
        const proximoCodigo = `${prefixo}.${novoSequencial.toString().padStart(2, '0')}`;
        
        console.log(`Próximo código gerado para prefixo ${prefixo}: ${proximoCodigo}`);
        res.json({ proximoCodigo });

    } catch (error) {
        console.error("❌ Erro detalhado ao calcular próximo código:", error);
        res.status(500).json({ message: "Erro interno ao gerar sequência de código" });
    }
});

router.use(autenticarToken());
router.use(contextoEmpresa);

// GET todas ou por nome
router.get("/", verificarPermissao('Contas', 'pesquisar'), async (req, res) => {
  const { nmConta } = req.query;
  const idempresa = req.idempresa;

  try {
    if (nmConta) {
      // Retorna idtipoconta agora
      const result = await pool.query(
        `SELECT * FROM contas WHERE idempresa = $1 AND nmconta ILIKE $2 LIMIT 1`,
        [idempresa, nmConta]
      );
      return result.rows.length
        ? res.json(result.rows[0])
        : res.status(404).json({ message: "Conta não encontrada" });
    } else {
      const result = await pool.query(
        `SELECT * FROM contas WHERE idempresa = $1 ORDER BY nmconta ASC`,
        [idempresa]
      );
      return result.rows.length
        ? res.json(result.rows)
        : res.status(404).json({ message: "Nenhuma conta encontrada" });
    }
  } catch (error) {
    console.error("Erro ao buscar conta:", error);
    res.status(500).json({ message: "Erro ao buscar conta" });
  }
});

// PUT atualizar
// router.put("/:id", 
//   verificarPermissao('Contas', 'alterar'),
//   logMiddleware('Contas', {
//       buscarDadosAnteriores: async (req) => {
//           const idConta = req.params.id;
//           const idempresa = req.idempresa;
//           try {
//               const result = await pool.query(
//                   `SELECT * FROM contas WHERE idconta = $1 AND idempresa = $2`,
//                   [idConta, idempresa]
//               );
//               const linha = result.rows[0] || null;
//               return {
//                   dadosanteriores: linha,
//                   idregistroalterado: linha?.idconta || null
//               };
//           } catch (error) {
//               console.error("Erro ao buscar dados anteriores da conta:", error);
//               return { dadosanteriores: null, idregistroalterado: null };
//           }
//       }
//   }),
//   async (req, res) => {
//     const id = req.params.id;
//     const idempresa = req.idempresa;
    
//     // ALTERADO: agora recebe idtipoconta do body (enviado pelo JS como dados)
//     const { nmConta, idtipoconta } = req.body; 
//     const ativo = req.body.ativo === true || req.body.ativo === 'true';
    
//     try {
//         // ATUALIZADO: Query usando a nova coluna idtipoconta
//         const result = await pool.query(
//           `UPDATE contas 
//            SET nmconta = $1, ativo = $2, idtipoconta = $3 
//            WHERE idconta = $4 AND idempresa = $5 
//            RETURNING idconta, nmconta, ativo, idtipoconta`, 
//           [nmConta, ativo, idtipoconta, id, idempresa]
//         );

//         if (result.rowCount) {
//           res.locals.acao = 'atualizou';
//           res.locals.idregistroalterado = result.rows[0].idconta; 
//           return res.json({ message: "Conta atualizada com sucesso!", conta: result.rows[0] });
//         } else {
//           return res.status(404).json({ message: "Conta não encontrada para atualizar." });
//         }
//     } catch (error) {
//         console.error("Erro ao atualizar conta:", error);
//         res.status(500).json({ message: "Erro ao atualizar conta." });
//     }
// });

// // POST criar nova conta
// router.post("/", verificarPermissao('Contas', 'cadastrar'), 
//   logMiddleware('Contas', { 
//       buscarDadosAnteriores: async (req) => {
//         return { dadosanteriores: null, idregistroalterado: null };
//       }
//   }),
//   async (req, res) => {
//     // ALTERADO: agora recebe idtipoconta
//     const { nmConta, ativo, idtipoconta } = req.body;
//     const idempresa = req.idempresa;

//     try {
//         // ATUALIZADO: Query usando idtipoconta no INSERT
//         const result = await pool.query(
//             "INSERT INTO contas (nmconta, ativo, idempresa, idtipoconta) VALUES ($1, $2, $3, $4) RETURNING idconta, nmconta, idtipoconta", 
//             [nmConta, ativo, idempresa, idtipoconta]
//         );

//         const novaConta = result.rows[0];
//         res.locals.acao = 'cadastrou';
//         res.locals.idregistroalterado = novaConta.idconta; 

//         // Padronizado para 'message' para facilitar no Frontend
//         res.status(201).json({ message: "Conta salva com sucesso!", conta: novaConta });
//     } catch (error) {
//         console.error("Erro ao salvar conta:", error);
//         res.status(500).json({ message: "Erro ao salvar conta.", detail: error.message });
//     }
// });

// ... (outras rotas e middlewares)

// PUT atualizar
router.put("/:id", 
  verificarPermissao('Contas', 'alterar'),
  logMiddleware('Contas', {
      buscarDadosAnteriores: async (req) => {
          const idConta = req.params.id;
          const idempresaContexto = req.idempresa; // Empresa logada (contexto)
          try {
              const result = await pool.query(
                  `SELECT * FROM contas WHERE idconta = $1 AND idempresa = $2`,
                  [idConta, idempresaContexto]
              );
              const linha = result.rows[0] || null;
              return {
                  dadosanteriores: linha,
                  idregistroalterado: linha?.idconta || null
              };
          } catch (error) {
              console.error("Erro ao buscar dados anteriores da conta:", error);
              return { dadosanteriores: null, idregistroalterado: null };
          }
      }
  }),
  async (req, res) => {
    const idConta = req.params.id;
    const idempresaContexto = req.idempresa;
    
    // INCLUÍDO: idempresapagadora vindo do body
    
    const { nmConta, idTipoConta, idEmpresaPagadora, idPlanoContas, codConta } = req.body;

    console.log('Dados recebidos para atualização da conta:', req.body, `ID Empresa Contexto: ${idempresaContexto}`, `ID Conta: ${idConta}`);
     
    const ativo = req.body.ativo === true || req.body.ativo === 'true';
    
    try {
        // ATUALIZADO: Query incluindo idempresapagadora
        const result = await pool.query(
          `UPDATE contas 
           SET nmconta = $1, ativo = $2, idtipoconta = $3, idempresapagadora = $4, codconta = $5, idplanocontas = $6
           WHERE idconta = $7 AND idempresa = $8 
           RETURNING idconta, nmconta, ativo, idtipoconta, idempresapagadora`, 
          [nmConta, ativo, idTipoConta, idEmpresaPagadora, codConta, idPlanoContas, idConta, idempresaContexto]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ message: "Conta não encontrada." });
        }
        res.json({ message: "Conta atualizada com sucesso!" });

    } catch (error) {
        console.error("Erro ao atualizar conta:", error);
        res.status(500).json({ message: "Erro ao atualizar conta." });
    }
});

// POST criar nova conta
router.post("/", verificarPermissao('Contas', 'cadastrar'), 
  logMiddleware('Contas', { 
      buscarDadosAnteriores: async (req) => {
        return { dadosanteriores: null, idregistroalterado: null };
      }
  }),
  async (req, res) => {
    // INCLUÍDO: idempresapagadora vindo do body
    const { nmConta, ativo, idTipoConta, idEmpresaPagadora, codConta, idPlanoContas } = req.body;
    const idempresaContexto = req.idempresa; // Empresa que está realizando o cadastro

    try {
        // ATUALIZADO: Query usando idempresapagadora no INSERT
        const result = await pool.query(
            `INSERT INTO contas (nmconta, ativo, idempresa, idtipoconta, idempresapagadora, codconta, idplanocontas) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) 
             RETURNING idconta, nmconta, idtipoconta, idempresapagadora, codconta, idplanocontas`, 
            [nmConta, ativo, idempresaContexto, idTipoConta, idEmpresaPagadora, codConta, idPlanoContas]
        );

        const novaConta = result.rows[0];
        res.locals.acao = 'cadastrou';
        res.locals.idregistroalterado = novaConta.idconta; 

        res.status(201).json({ message: "Conta salva com sucesso!", conta: novaConta });
    } catch (error) {
        console.error("Erro ao salvar conta:", error);
        res.status(500).json({ message: "Erro ao salvar conta.", detail: error.message });
    }
});

module.exports = router;