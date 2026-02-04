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

router.get("/centrocusto",  autenticarToken(), async (req, res) => {
    const idempresa = req.idempresa;
  
    try {
        const result = await pool.query(
            `SELECT * FROM centrocusto  WHERE idempresa = $1 ORDER BY nmcentrocusto ASC`,
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

// Função auxiliar para evitar repetição de código
async function buscarEntidadeVinculo(tabelaPrincipal, tabelaRelacao, idCol, nomeCol, fkCol, idempresa) {
    // tabelaPrincipal: ex 'clientes'
    // tabelaRelacao: ex 'clienteempresas'
    // fkCol: a coluna que liga as duas, ex 'idcliente'
    
    const query = `
        SELECT p.${idCol} AS id, p.${nomeCol} AS nome 
        FROM ${tabelaPrincipal} p
        INNER JOIN ${tabelaRelacao} r ON p.${idCol} = r.${fkCol}
        WHERE r.idempresa = $1 AND p.ativo = true 
        ORDER BY nome
    `;
    
    const result = await pool.query(query, [idempresa]);
    return result.rows;
}

// Rota Genérica de Vínculo
router.get("/vinculo/:tipo", autenticarToken(), async (req, res) => {
    const { tipo } = req.params;
    const idempresa = req.idempresa;

    try {
        let dados = [];
        if (tipo === 'clientes') {
            dados = await buscarEntidadeVinculo('clientes', 'clienteempresas', 'idcliente', 'nmfantasia', 'idcliente', idempresa);
        } else if (tipo === 'fornecedores') {
            // Usando nmfantasia conforme sua estrutura
            dados = await buscarEntidadeVinculo('fornecedores', 'fornecedorempresas', 'idfornecedor', 'nmfantasia', 'idfornecedor', idempresa);
        } else if (tipo === 'funcionarios') {
            dados = await buscarEntidadeVinculo('funcionarios', 'funcionarioempresas', 'idfuncionario', 'nome', 'idfuncionario', idempresa);
        }
        
        res.json(dados);
    } catch (error) {
        console.error(`❌ ERRO NA ROTA /vinculo/${tipo}:`, error.message);
        res.status(500).json({ message: "Erro ao buscar dados do banco", detail: error.message });
    }
});

// router.get("/centrocusto", autenticarToken(), async (req, res) => {
//     try {
//         const idempresa = req.idempresa;
        
//         const query = `
//             SELECT idcentrocusto, nmcentrocusto 
//             FROM centrocusto 
//             WHERE idempresa = $1 AND ativo = true 
//             ORDER BY nmcentrocusto
//         `;
        
//         const result = await pool.query(query, [idempresa]);
//         res.json(result.rows);
//     } catch (error) {
//         console.error("❌ Erro ao buscar centros de custo:", error.message);
//         res.status(500).json({ message: "Erro ao buscar centros de custo" });
//     }
// });

// router.get("/proximo-codigo/:prefixo", autenticarToken(), async (req, res) => {
//     const { prefixo } = req.params; 
//     const idempresa = req.idempresa;

//     try {
//         // Busca o maior código que comece com o prefixo (ex: 01.00.%)
//         const result = await pool.query(
//             `SELECT codconta FROM contas 
//              WHERE idempresa = $1 AND codconta LIKE $2 
//              ORDER BY codconta DESC LIMIT 1`,
//             [idempresa, `${prefixo}.%`]
//         );

//         let novoSequencial = 1;

//         // VERIFICAÇÃO: Só tenta dar split se a query retornou algo e o campo não é nulo
//         if (result.rows.length > 0 && result.rows[0].codigo) {
//             const ultimoCodigo = result.rows[0].codigo;
//             const partes = ultimoCodigo.split('.'); // Aqui não dará mais erro
            
//             // Pega o último número da sequência
//             const ultimoSegmento = parseInt(partes[partes.length - 1]);
            
//             if (!isNaN(ultimoSegmento)) {
//                 novoSequencial = ultimoSegmento + 1;
//             }
//         }

//         // Formata o próximo código (ex: 01.00.01)
//         const proximoCodigo = `${prefixo}.${novoSequencial.toString().padStart(2, '0')}`;
        
//         console.log(`Próximo código gerado para prefixo ${prefixo}: ${proximoCodigo}`);
//         res.json({ proximoCodigo });

//     } catch (error) {
//         console.error("❌ Erro detalhado ao calcular próximo código:", error);
//         res.status(500).json({ message: "Erro interno ao gerar sequência de código" });
//     }
// });


router.get("/proximo-codigo/:idplanocontas", autenticarToken(), async (req, res) => {
    try {
        const idplanocontas = parseInt(req.params.idplanocontas);
        const idempresa = req.idempresa;

        // Se o parseInt falhar (ex: receber "02.00"), retorna erro 400 amigável
        if (isNaN(idplanocontas)) {
            return res.status(400).json({ message: "ID inválido recebido no servidor." });
        }

        const planoResult = await pool.query(
            `SELECT codigo FROM planocontas WHERE idplanocontas = $1 AND idempresa = $2`,
            [idplanocontas, idempresa]
        );

        if (planoResult.rows.length === 0) {
            return res.status(404).json({ message: "Plano não encontrado." });
        }

        const codPai = planoResult.rows[0].codigo;
        
        // Proteção para o Split: verifica se codPai existe e tem pontos
        if (!codPai || typeof codPai !== 'string' || !codPai.includes('.')) {
            throw new Error(`Código do plano pai inválido: ${codPai}`);
        }

        const partesPai = codPai.split('.');
        const prefixo = partesPai.slice(0, 2).join('.'); 

        const result = await pool.query(
            `SELECT codconta FROM contas 
             WHERE idempresa = $1 AND idplanocontas = $2 
             ORDER BY codconta DESC LIMIT 1`,
            [idempresa, idplanocontas]
        );

        let novoSequencial = 1;
        if (result.rows.length > 0 && result.rows[0].codconta) {
            const ultimoCodigo = String(result.rows[0].codconta);
            if (ultimoCodigo.includes('.')) {
                const partes = ultimoCodigo.split('.');
                const ultimoSegmento = parseInt(partes[partes.length - 1]);
                if (!isNaN(ultimoSegmento)) novoSequencial = ultimoSegmento + 1;
            }
        }

        const proximoCodigo = `${prefixo}.${novoSequencial.toString().padStart(2, '0')}`;
        res.json({ proximoCodigo });

    } catch (error) {
        console.error("❌ ERRO NO BACKEND:", error.message);
        res.status(500).json({ message: error.message });
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
    
    const { nmConta, idTipoConta, idEmpresaPagadora, idPlanoContas, codConta, idCentroCusto, idVinculo, tipoVinculo } = req.body;

    console.log('Dados recebidos para atualização da conta:', req.body, `ID Empresa Contexto: ${idempresaContexto}`, `ID Conta: ${idConta}`);
     
    const ativo = req.body.ativo === true || req.body.ativo === 'true';
    
    try {
        // ATUALIZADO: Query incluindo idempresapagadora
        const result = await pool.query(
            `UPDATE contas 
            SET nmconta = $1, 
                ativo = $2, 
                idtipoconta = $3, 
                idempresapagadora = $4, 
                codconta = $5, 
                idplanocontas = $6, 
                idcentrocusto = $7, 
                idvinculo = $8, 
                tipovinculo = $9
            WHERE idconta = $10 AND idempresa = $11 
            RETURNING idconta`, 
            [
                nmConta,            // $1
                ativo,              // $2
                idTipoConta,        // $3
                idEmpresaPagadora,  // $4
                codConta,           // $5
                idPlanoContas,      // $6
                idCentroCusto || null, // $7 (Garante null se vier vazio)
                idVinculo || null,     // $8 (Garante null se vier vazio)
                tipoVinculo || null,   // $9
                idConta,            // $10
                idempresaContexto   // $11
            ]
        )

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
    const { nmConta, ativo, idTipoConta, idEmpresaPagadora, codConta, idPlanoContas, idCentroCusto, idVinculo, tipoVinculo } = req.body;
    const idempresaContexto = req.idempresa; // Empresa que está realizando o cadastro

    try {
        // ATUALIZADO: Query usando idempresapagadora no INSERT
        const result = await pool.query(
            `INSERT INTO contas (nmconta, ativo, idempresa, idtipoconta, idempresapagadora, codconta, idplanocontas, idcentrocusto, idvinculo, tipovinculo) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
            RETURNING idconta`, 
            [
            nmConta, 
            ativo, 
            idempresaContexto, 
            idTipoConta, 
            idEmpresaPagadora, 
            codConta, 
            idPlanoContas, 
            idCentroCusto || null, // Se vier string vazia, vira NULL no banco
            idVinculo || null, 
            tipoVinculo || null
            ]
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