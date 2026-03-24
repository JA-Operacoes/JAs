const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB");
const { autenticarToken, contextoEmpresa } = require('../middlewares/authMiddlewares');
const { verificarPermissao } = require('../middlewares/permissaoMiddleware');
const logMiddleware = require('../middlewares/logMiddleware');



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


async function buscarEntidadeVinculo(tabelaPrincipal, tabelaRelacao, idCol, nomeCol, fkCol, idempresa, perfil = null) {
    
    console.log("🔍 Buscando Vínculo:", { tabelaPrincipal, idempresa, perfil });
    
    let query = `
        SELECT p.${idCol} AS id, p.${nomeCol} AS nome 
        FROM ${tabelaPrincipal} p
        INNER JOIN ${tabelaRelacao} r ON p.${idCol} = r.${fkCol}
        WHERE r.idempresa = $1 AND p.ativo = true
    `;
    
    const params = [idempresa];

    if (perfil) {
        // Normaliza para minúsculas e remove espaços para comparação segura
        const p = perfil.toLowerCase().trim();

        if (p.includes('func')) { 
            // Se o valor do rádio for "funcionário", busca Interno ou Externo
            // O ILIKE garante que encontre "Interno" ou "interno" no banco
            query += ` AND (p.perfil ILIKE 'Interno' OR p.perfil ILIKE 'Externo')`;
        } else if (p.includes('free') || p.includes('sem')) {
            // Se o valor for "free-lancer", busca Freelancer ou Lote
            query += ` AND (p.perfil ILIKE 'Freelancer' OR p.perfil ILIKE 'Lote')`;
        }
    }

    query += ` ORDER BY nome`;
    
    const result = await pool.query(query, params);
    return result.rows;
}

// Rota Genérica de Vínculo com Suporte a Perfil
router.get("/vinculo/:tipo", autenticarToken(), async (req, res) => {
    const { tipo } = req.params; // clientes, fornecedores, funcionarios
    const { perfil } = req.query;
    const idempresa = req.idempresa;

    try {
        let dados = [];
        
        if (tipo === 'funcionarios') {
            dados = await buscarEntidadeVinculo(
                'funcionarios', 
                'funcionarioempresas', 
                'idfuncionario', 
                'nome', 
                'idfuncionario', 
                idempresa, 
                perfil 
            );
        } else if (tipo === 'fornecedores') {
            // CORREÇÃO AQUI: explicitando os nomes para evitar erro de concatenação
            dados = await buscarEntidadeVinculo(
                'fornecedores', 
                'fornecedorempresas', 
                'idfornecedor', 
                'nmfantasia', 
                'idfornecedor', 
                idempresa, 
                null
            );
        } else if (tipo === 'clientes') {
            dados = await buscarEntidadeVinculo(
                'clientes', 
                'clienteempresas', 
                'idcliente', 
                'nmfantasia', 
                'idcliente', 
                idempresa, 
                null
            );
        }
        
        res.json(dados);
    } catch (error) {
        console.error(`❌ ERRO NA ROTA /vinculo/${tipo}:`, error.message);
        res.status(500).json({ message: "Erro ao buscar dados do banco" });
    }
});

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


router.get("/", verificarPermissao('Contas', 'pesquisar'), async (req, res) => {
  const { nmConta } = req.query;
  const idempresa = req.idempresa;

  // Query que traz o perfil apenas se o vínculo for um funcionário
  const queryBase = `
    SELECT *        
    FROM contas    
    WHERE idempresa = $1
  `;

  try {
    if (nmConta) {
      const result = await pool.query(
        `${queryBase} AND nmconta ILIKE $2 LIMIT 1`,
        [idempresa, nmConta]
      );
      return result.rows.length
        ? res.json(result.rows[0])
        : res.status(404).json({ message: "Conta não encontrada" });
    } else {
      const result = await pool.query(
        `${queryBase} ORDER BY nmconta ASC`,
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
    
    const { nmConta, idPlanoContas, codConta } = req.body;

    console.log('Dados recebidos para atualização da conta:', req.body, `ID Empresa Contexto: ${idempresaContexto}`, `ID Conta: ${idConta}`);
     
    const ativo = req.body.ativo === true || req.body.ativo === 'true';
    
    try {
        // ATUALIZADO: Query incluindo idempresapagadora
        const result = await pool.query(
            `UPDATE contas 
            SET nmconta = $1, 
                ativo = $2,  
                codconta = $3, 
                idplanocontas = $4     
            WHERE idconta = $5 AND idempresa = $6
            RETURNING idconta`, 
            [
                nmConta,            // $1
                ativo,              // $2  
                codConta,           // $5
                idPlanoContas,      // $6             
                idConta,            // $10
                idempresaContexto   // $11
            ]
        )

        if (result.rowCount === 0) {
            return res.status(404).json({ message: "Conta não encontrada." });
        }

        res.locals.acao = 'atualizou';
        res.locals.idregistroalterado = result.rows[0].idconta;
        res.locals.dadosNovos = { // ✅ camelCase
            idconta: result.rows[0].idconta,
            nmconta: nmConta,
            ativo,
            codconta: codConta,
            idplanocontas: idPlanoContas
        };

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
    const { nmConta, ativo, codConta, idPlanoContas } = req.body;
    const idempresaContexto = req.idempresa; // Empresa que está realizando o cadastro

    try {
        // ATUALIZADO: Query usando idempresapagadora no INSERT
        const result = await pool.query(
            `INSERT INTO contas (nmconta, ativo, idempresa, codconta, idplanocontas) 
            VALUES ($1, $2, $3, $4, $5) 
            RETURNING idconta`, 
            [
            nmConta, 
            ativo, 
            idempresaContexto,      
            codConta, 
            idPlanoContas           
            ]
        );

        const novaConta = result.rows[0];
        res.locals.acao = 'cadastrou';
        res.locals.idregistroalterado = novaConta.idconta; 
        res.locals.dadosNovos = { // ✅ camelCase
            idconta: novaConta.idconta,
            nmconta: nmConta,
            ativo,
            codconta: codConta,
            idplanocontas: idPlanoContas
        };

        res.status(201).json({ message: "Conta salva com sucesso!", conta: novaConta });
    } catch (error) {
        console.error("Erro ao salvar conta:", error);
        res.status(500).json({ message: "Erro ao salvar conta.", detail: error.message });
    }
});

module.exports = router;