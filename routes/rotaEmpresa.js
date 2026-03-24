const express = require('express');
const router = express.Router();
const pool = require('../db'); // ajuste o caminho conforme seu projeto
const { autenticarToken, contextoEmpresa } = require('../middlewares/authMiddlewares');
const { verificarPermissao } = require('../middlewares/permissaoMiddleware');
const logMiddleware = require('../middlewares/logMiddleware');

router.use(autenticarToken());
router.use(contextoEmpresa);

// Listar todas as empresas
router.get('/',  verificarPermissao('Empresas', 'pesquisar'), async (req, res) => {
  console.log('✅ [GET /empresas] Rota acessada com sucesso');
  const { nmFantasia } = req.query;  
  
  try {
    if (nmFantasia) {
      console.log("🔍 Buscando empresa por nmFantasia:", nmFantasia);
      const result = await pool.query(
        `SELECT * 
        FROM empresas        
        WHERE nmfantasia ILIKE $1
        ORDER BY nmfantasia ASC LIMIT 1`,
        [`%${nmFantasia}%`]
      );
      console.log("✅ Consulta por nmFantasia retornou:", result.rows.length, "linhas.");
      return result.rows.length
        ? res.json(result.rows[0])
        : res.status(404).json({ message: "Empresa não encontrada" });
    } else {
      
      console.log("🔍 Buscando todas as empresas:");
      const result = await pool.query(
        `SELECT * 
        FROM empresas        
        ORDER BY nmfantasia`
        );
      console.log("✅ Consulta de todos as empresas retornou:", result.rows.length, "linhas.");
      return result.rows.length
        ? res.json(result.rows)
        : res.status(404).json({ message: "Nenhuma Empresa encontrada" });
    }
  } catch (error) {
    console.error("❌ Erro ao buscar empresas:", error);
    res.status(500).json({ message: "Erro ao buscar nome fantasia" });
  }
});

router.get('/:idempresa', verificarPermissao('Empresas', 'pesquisar'), async (req, res) => {
  const { idempresa } = req.params;
  console.log(`🔍 Buscando empresa por ID: ${idempresa}`);

  try {
    const result = await pool.query(
      `SELECT * FROM empresas WHERE idempresa = $1`,
      [idempresa]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Empresa não encontrada" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("❌ Erro ao buscar empresa por ID:", error);
    res.status(500).json({ message: "Erro ao buscar empresa" });
  }
});

// Criar nova empresa
router.post('/', verificarPermissao('Empresas', 'cadastrar'), 
  logMiddleware('Empresas', { // Módulo 'Empresas'
        // Para POST, não há dados anteriores
        buscarDadosAnteriores: async (req) => {
            return { dadosanteriores: null, idregistroalterado: null };
        }
  }),
  async (req, res) => {
  const ativo = req.body.ativo === "on" ? true : false;
  const { nmFantasia, razaoSocial, cnpj, inscEstadual, emailEmpresa, emailNfe, site, telefone, cep, endereco, numero, complemento, bairro, cidade, estado, pais  } = req.body;
  const idempresaDoUsuarioLogado = req.idempresa;
  try {
    const result = await pool.query(
      'INSERT INTO empresas (nmfantasia, razaosocial, cnpj, inscricaoestadual, emailemp, emailnf, site, telefone, cep, endereco, numero, complemento, bairro, cidade, estado, pais, ativo ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING *',
      [nmFantasia, razaoSocial, cnpj, inscEstadual, emailEmpresa, emailNfe, site, telefone, cep, endereco, numero, complemento, bairro, cidade, estado, pais, ativo ]
    );
    const novaEmpresa = result.rows[0];
          
    res.locals.acao = 'cadastrou';
    res.locals.idregistroalterado = novaEmpresa.idempresa; 
    res.locals.idusuarioAlvo = null;
    res.locals.dadosnovos = novaEmpresa;

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao criar empresa:', err);
    res.status(500).send('Erro ao criar empresa');
  }
});

// Atualizar empresa
router.put('/:id', verificarPermissao('Empresas', 'alterar'), 
  logMiddleware('Empresas', { // Módulo 'Empresas'
        buscarDadosAnteriores: async (req) => {
            const idEmpresaAAlterar = req.params.id; // ID da empresa vindo da URL
            // Aqui, a empresa do usuário logado (req.idempresa) não é relevante para buscar o registro *da* empresa.
            // A busca é por idEmpresaAAlterar.

            if (!idEmpresaAAlterar) {
                return { dadosanteriores: null, idregistroalterado: null };
            }

            try {
                const result = await pool.query(
                    'SELECT * FROM empresas WHERE idempresa = $1', // Busca a empresa pelo ID da URL
                    [idEmpresaAAlterar]
                );
                const linha = result.rows[0] || null;
                return {
                    dadosanteriores: linha,
                    idregistroalterado: linha?.idempresa || null
                };
            } catch (error) {
                console.error("Erro ao buscar dados anteriores da empresa:", error);
                return { dadosanteriores: null, idregistroalterado: null };
            }
        }
  }),
  async (req, res) => {
  const id = req.params.id; // idempresa da empresa a ser atualizado
  const idempresa = req.idempresa; // ID da empresa do usuário logado
  const ativo = req.body.ativo;
  

  console.log(`Atualizando empresa com ID: ${id} para a empresa do usuário logado: ${idempresa}`);

  const { nmFantasia, razaoSocial, cnpj, inscEstadual, emailEmpresa, emailNfe, site, telefone, cep, endereco, numero, complemento, bairro, cidade, estado, pais} = req.body;
  try {
    const result = await pool.query(
      `UPDATE empresas 
       SET nmfantasia = $1, razaosocial = $2, cnpj = $3, inscricaoestadual = $4, 
        emailemp = $5, emailnf = $6, site = $7, telefone = $8, cep = $9, endereco = $10,
        numero = $11, complemento = $12, bairro = $13, cidade= $14, estado = $15, pais = $16, ativo = $17 
      WHERE idempresa = $18 RETURNING idempresa`,
      [nmFantasia, razaoSocial, cnpj, inscEstadual, emailEmpresa, emailNfe, site, telefone, cep, endereco, numero, complemento, bairro, cidade, estado, pais, ativo, id]
    );
    if (result.rowCount) {
        const empresaAtualizada = result.rows[0];
        // --- Ponto Chave para o Log ---
        res.locals.acao = 'atualizou';
        res.locals.idregistroalterado = empresaAtualizada.idempresa; // O ID da empresa atualizada
        res.locals.idusuarioAlvo = null; // Não se aplica
        res.locals.dadosnovos = req.body;

        res.json(empresaAtualizada);
    } else {
        res.status(404).send('Empresa não encontrada ou não foi possível atualizar.');
    }
    
  } catch (err) {
    console.error('Erro ao atualizar empresa:', err);
    res.status(500).send('Erro ao atualizar empresa');
  }
});



module.exports = router;
