// controllers/authController.js
const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

// Cadastro de usuário
// controllers/authController.js
async function verificarUsuarioExistente(req, res) {
  const { nome, sobrenome, email, ativo, idempresadefault, empresas } = req.body;
  console.log("verificarUsuarioExistente AuthController", req.body);
  try {
    // const { rows } = await db.query("SELECT * FROM usuarios WHERE nome = $1 AND sobrenome = $2 AND email = $3 AND ativo = $4", [nome, sobrenome, email, ativo, idempresadefault]);
    const { rows } = await db.query("SELECT u.idusuario, u.nome, u.sobrenome, u.email, u.ativo, u.idempresadefault, e.nmfantasia AS empresadefaultnome FROM usuarios u LEFT JOIN empresas e ON u.idempresadefault = e.idempresa WHERE u.nome = $1 AND u.sobrenome = $2 AND u.email = $3 AND u.ativo = $4 AND u.idempresadefault = $5", [nome, sobrenome, email, ativo, idempresadefault, empresas]);
    if (rows.length > 0) {
      return res.status(200).json({ usuarioExistente: true });
    } else {
      return res.status(200).json({ usuarioExistente: false });
    }

  } catch (erro) {
    console.error('Erro ao verificar usuário:', erro);
    res.status(500).json({ erro: 'Erro ao verificar usuário.' });
  }
}

function arraysIguais(arr1, arr2) {
    
    if (!Array.isArray(arr1) || !Array.isArray(arr2)) return false;
    if (arr1.length !== arr2.length) return false;
    const sorted1 = [...arr1].map(Number).sort((a, b) => a - b);
    const sorted2 = [...arr2].map(Number).sort((a, b) => a - b);
    return sorted1.every((val, idx) => val === sorted2[idx]);
}

async function cadastrarOuAtualizarUsuario(req, res) {
 
  const { nome, sobrenome, email, senha, email_original, ativo, idempresadefault, empresas} = req.body;
   
  console.log('Dados recebidos cadastrarOuAtualizarUsuario:', req.body);
  try {
    // Busca o usuário pelo email original
    const { rows } = await db.query("SELECT * FROM usuarios WHERE email = $1", [email_original]);

    if (rows.length > 0) {
      const usuario = rows[0];    

      const empresasDoUsuario = await getEmpresasDoUsuario(usuario.idusuario);
    //  const empresasIguais = arraysIguais(empresas, empresasDoUsuario);
      console.log("Empresas do usuário:", empresasDoUsuario);
      //console.log("Empresas enviadas:", empresas);
     // console.log("Nome:", nome, "Sobrenome:", sobrenome, "Email:", email, "Ativo:", req.body.ativo, "IdEmpresaDefault:", idempresadefault, "Empresas:", empresas, "Empresas do Usuario:", empresasDoUsuario, "Empresas Iguais:", empresasIguais);

      const camposIguais =
        nome === usuario.nome &&
        sobrenome === usuario.sobrenome &&
        email === usuario.email &&
        Boolean(usuario.ativo) === Boolean(req.body.ativo) &&
        String(usuario.idempresadefault) === String(idempresadefault) &&
        !senha;
        //empresasIguais; // senha vazia significa que não foi alterada

      if (camposIguais) {
        return res.status(200).json({ mensagem: 'Nenhuma alteração detectada no Usuário.' });
      }

      const atualizacoes = [];
      const valores = [];
      let idx = 1;

      if (nome && nome !== usuario.nome) {
        atualizacoes.push(`nome = $${idx++}`);
        valores.push(nome);
      }

      if (sobrenome && sobrenome !== usuario.sobrenome) {
        atualizacoes.push(`sobrenome = $${idx++}`); 
        valores.push(sobrenome);
      }

      if (email && email !== email_original) {
        const { rows: emailJaUsado } = await db.query("SELECT 1 FROM usuarios WHERE email = $1", [email]);
        if (emailJaUsado.length > 0) {
          return res.status(400).json({ erro: "Novo e-mail já está em uso por outro usuário." });
        }

        atualizacoes.push(`email = $${idx++}`);
        valores.push(email);
      }

      if (typeof req.body.ativo !== 'undefined' && req.body.ativo !== usuario.ativo) {
        atualizacoes.push(`ativo = $${idx++}`);
        valores.push(req.body.ativo);
      }

      if (senha && senha !== '') {
        const senhaHash = await bcrypt.hash(senha, 10);
        atualizacoes.push(`senha_hash = $${idx++}`);
        valores.push(senhaHash);
      }

      // CORREÇÃO — incluir atualização de idempresadefault
      if (
        idempresadefault !== undefined &&
        idempresadefault !== null &&
        idempresadefault !== usuario.idempresadefault
      ) {
        atualizacoes.push(`idempresadefault = $${idx++}`);
        valores.push(idempresadefault);
      }

      if (atualizacoes.length > 0) {
        valores.push(email_original);
        const sql = `UPDATE usuarios SET ${atualizacoes.join(', ')} WHERE email = $${idx}`;
        await db.query(sql, valores);
       }

       // Atualizar empresas associadas somente se tiverem sido alteradas
      // if (Array.isArray(empresas) && !empresasIguais) {
      //   await db.query('DELETE FROM usuarioempresas WHERE idusuario = $1', [usuario.idusuario]);
      //   for (const idempresa of empresas) {
      //     await db.query('INSERT INTO usuarioempresas (idusuario, idempresa) VALUES ($1, $2)', [usuario.idusuario, idempresa]);
      //   }
      // }


      return res.status(200).json({ mensagem: 'Usuário atualizado com sucesso.' }); 

    } else {
    
      const { rows: usuariosComMesmoEmail } = await db.query("SELECT * FROM usuarios WHERE email = $1", [email]);
      if (usuariosComMesmoEmail.length > 0) {
        const usuarioExistente = usuariosComMesmoEmail[0];

        if (usuarioExistente.ativo) {
          return res.status(400).json({ erro: "E-mail já está em uso por outro usuário ativo." });
        }
      }

      const senhaHash = await bcrypt.hash(senha, 10);
      const result = await db.query(`
        INSERT INTO usuarios (nome, sobrenome, email, senha_hash, ativo, idempresadefault)
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
      `, [nome, sobrenome, email, senhaHash, ativo, idempresadefault]);

      
      const usuarioId = result.rows[0].idusuario;

      if (Array.isArray(empresas)) {
        for (const idempresa of empresas) {
          await db.query(`INSERT INTO usuarioempresas (idusuario, idempresa) VALUES ($1, $2) RETURNING *`, [usuarioId, idempresa]);
        }
      }
      res.locals.insertedId = result.rows[0].idusuario;
      return res.status(201).json({ mensagem: 'Usuário cadastrado com sucesso.' });
    }

  } catch (erro) {
    console.error('Erro ao cadastrar ou atualizar usuário:', erro);
    res.status(500).json({ erro: 'Erro ao cadastrar ou atualizar usuário.' });
  }
}

// função auxiliar para buscar empresas do usuário do BD
async function getEmpresasDoUsuario(idusuario) {
  console.log("getEmpresasDoUsuario AuthController", idusuario);
  const { rows } = await db.query(`
    SELECT idempresa 
    FROM usuarioempresas 
    WHERE idusuario = $1`, [idusuario]);
  return rows.map(row => row.idempresa);
}

// Listar empresas do usuário controllers/authController.js
async function listarEmpresasDoUsuario(req, res) {
  console.log("listarEmpresasDoUsuario AuthController", req.params);
  const { id } = req.params;
  try {
    const empresasQuery = await db.query(`
      SELECT ue.idusuario, ue.idempresa, e.nmfantasia AS nome_empresa
      FROM usuarioempresas ue
      JOIN empresas e ON ue.idempresa = e.idempresa
      WHERE ue.idusuario = $1
    `, [id]);

    res.json(empresasQuery.rows);

    console.log("Empresas do usuário:", empresasQuery.rows);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao buscar empresas do usuário.' });
  }
}


async function listarUsuarios(req, res) {

    try {
     // console.log('Headers:', req.headers);
      console.log('req.user:', req.usuario);
      console.log('req.idempresa:', req.idempresa);
   
    // Se o endpoint for usado com verificarEmpresa = false, ignore o filtro por empresa
    const usuariosQuery = await db.query(`
      SELECT idusuario, nome, sobrenome, email, ativo, idempresadefault
      FROM usuarios
      ORDER BY nome
    `);

     res.json(usuariosQuery.rows);

    } catch (erro) {
      console.error(erro);
      res.status(500).json({ erro: 'Erro ao buscar usuários.' });
    }
}

async function buscarUsuariosPorNome(req, res) {
  const { nome } = req.query;
  console.log("buscarUsuarioPorNome", nome);
  try {
    const { rows } = await db.query(`
      SELECT idusuario, nome, sobrenome, email, senha_hash, ativo, idempresadefault
      FROM usuarios 
      WHERE LOWER(nome) LIKE LOWER($1) 
      ORDER BY nome 
      LIMIT 10
    `, [`${nome}%`]);

    res.status(200).json(rows)
  } catch (erro) {
    console.error('Erro ao buscar usuários por nome:', erro);
    res.status(500).json({ erro: 'Erro ao buscar usuários.' });
  }
}

async function verificarNomeExistente(req, res) {
    const { nome } = req.body;

    console.log("verificarNomeExistente AuthController", nome);

    if (!nome) {
      return res.status(400).json({ error: "Nome é obrigatório" });
    }

    try {
      const resultado = await db.query(`
        SELECT idusuario, nome, sobrenome, email, ativo, idempresadefault FROM usuarios WHERE LOWER(nome) = LOWER($1) LIMIT 1
      `, [nome]);

      const nomeEncontrado = resultado.rows.length > 0;
      console.log("NOME ENCONTRADO authController", nomeEncontrado);
      return res.json({ nomeEncontrado });

    } catch (error) {
      console.error("Erro ao buscar nome:", error.message);
      console.error(error.stack); // mostra a linha exata
      return res.status(500).json({ error: "Erro interno do servidor" });
    }
  }

async function verificarNomeCompleto(req, res) {
  const { nome, sobrenome } = req.body;

  if (!nome || !sobrenome) {
    return res.status(400).json({ error: "Nome e sobrenome são obrigatórios" });
  }

  try {
    const resultado = await db.query(`
      SELECT * FROM usuarios WHERE nome = $1 AND sobrenome = $2 LIMIT 1
    `, [nome, sobrenome]);

    if (resultado.rows.length > 0) {
      return res.json({ usuario: resultado.rows[0] });
    } else {
      return res.json({ usuario: null });
    }

  } catch (error) {
    console.error("Erro ao buscar nome e sobrenome:", error);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
}


// Login
async function login(req, res) {
  
  console.log("login AuthController ENTROU EM LOGIN", req.body);

  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ erro: "Email e senha são obrigatórios." });
    }

    // Buscar usuário pelo email
    const queryUsuario = "SELECT idusuario, email, senha_hash, nome, idempresadefault FROM usuarios WHERE email = $1";
    const resultUsuario = await db.query(queryUsuario, [email]);

    if (resultUsuario.rows.length === 0) {
      return res.status(401).json({ erro: "Usuário ou senha inválidos." });
    }

    const usuario = resultUsuario.rows[0];
    console.log("Usuário encontrado:", usuario);

    // Verificar senha com bcrypt
    const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);
    if (!senhaValida) {
      return res.status(401).json({ erro: "Usuário ou senha inválidos." });
    }

    // Buscar empresas associadas
    const queryEmpresas = `
      SELECT e.idempresa
      FROM usuarioempresas ue
      JOIN empresas e ON ue.idempresa = e.idempresa
      WHERE ue.idusuario = $1 `;

    const resultEmpresas = await db.query(queryEmpresas, [usuario.idusuario]);
   // const empresas = resultEmpresas.rows;
    const empresas = resultEmpresas.rows.map(row => row.idempresa);

    if (empresas.length === 0) {
      return res.status(403).json({ erro: "Usuário não está vinculado a nenhuma empresa. Contate o administrador." });
    }

    console.log("Empresas encontradas:", resultEmpresas.rows);

    
    // const idempresaDefault = empresas.length > 0 ? empresas[0] : null;   
    // console.log("Empresa default:", idempresaDefault);
    
    
    // const tokenPayload = {
    //   idusuario: usuario.idusuario,
    //   email: usuario.email,
    //   empresas, // já é array de IDs
    //   idempresaDefault
    // };


    const usuarioIdEmpresaDefault = usuario.idempresadefault; 

    // Verifique se a empresa padrão do usuário está entre as empresas às quais ele tem acesso
    if (usuarioIdEmpresaDefault && !empresas.includes(usuarioIdEmpresaDefault)) {
        // Se a empresa default não está na lista de empresas do usuário (ex: foi desvinculada),
        // você pode escolher uma nova empresa default (a primeira) ou forçar um erro.
        // Por simplicidade, vamos usar a primeira empresa da lista se a default não estiver lá.
        console.warn(`Empresa default (${usuarioIdEmpresaDefault}) do usuário não encontrada nas empresas vinculadas. Usando a primeira empresa vinculada.`);
        const empresaParaToken = empresas[0];
        // Você pode até atualizar o idempresadefault no banco aqui se quiser que seja persistente.
        // Ou apenas usar a primeira empresa como a "selecionada" para esta sessão.
    }

    const tokenPayload = {
        idusuario: usuario.idusuario,
        email: usuario.email,
        empresas, // array de IDs das empresas que o usuário tem acesso
        // Passe a idempresadefault do usuário para o token
        idempresaDefault: usuarioIdEmpresaDefault || (empresas.length > 0 ? empresas[0] : null) 
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '10h' });
    
    console.log("Token gerado authController:", token);
   
    // res.json({
    //   token,
    //   idusuario: usuario.idusuario,
    //   nome: usuario.nome,
    //   empresas,
    //   idempresaDefault
    //   // idempresaDefault: empresas[0] || null
    // });
    res.json({
        token,
        idusuario: usuario.idusuario,
        nome: usuario.nome,
        empresas, // Todas as empresas que ele pode acessar
        idempresaDefault: usuarioIdEmpresaDefault // A empresa padrão configurada para o usuário
    });

  } catch (error) {
    console.error("Erro no login:", error);
    return res.status(500).json({ erro: "Erro interno no servidor." });
  }
}


// → Nova função para listar permissões do usuário logado
async function listarPermissoes(req, res) {
  console.log("listarPermissoes AuthController", req.usuario);
  const idusuario = req.usuario.idusuario || req.usuario.id;
  const idempresa = req.idempresa;
  
  console.log(`➡️ [listarPermissoes] idusuario: ${idusuario}, idempresa: ${idempresa}`);
  console.log(`➡️ [listarPermissoes] Tipo de idusuario: ${typeof idusuario}, Tipo de idempresa: ${typeof idempresa}`);
  try {
     console.log("🚨 Tentando consultar permissões no banco", idusuario, idempresa);
  // console.log("Query params:", {
  //   usuarioId,
  //   moduloNormalizado,
  //   idempresa,
  //   tipos: {
  //   usuarioId: typeof usuarioId,
  //   moduloNormalizado: typeof moduloNormalizado,
  //   idempresa: typeof idempresa
  // }
  // });
  
    const { rows } = await db.query(
      `
      SELECT
        modulo,
        acesso   AS acessar,
        pesquisar AS pesquisar,
        cadastrar AS cadastrar,
        alterar   AS alterar
      FROM permissoes
      WHERE idusuario = $1 AND idempresa = $2
      `,
      [idusuario, idempresa]
    );

    // padroniza tudo em lowercase caso necessário
    const permissoes = rows.map(p => ({
      modulo: p.modulo.toLowerCase(),
      pode_acessar: p.acessar,
      pode_pesquisar: p.pesquisar,
      pode_cadastrar: p.cadastrar,
      pode_alterar: p.alterar
    }));

    res.json(permissoes);
    console.log("PERMISSOES EM LISTAR PERMISSOES", permissoes);
    
  } catch (err) {
    console.error('Erro ao buscar permissões:', err);
    res.status(500).json({ erro: 'Erro ao buscar permissões.' });
  }
}

async function buscarUsuarioPorEmail(req, res) {
  const { email } = req.params;

  try {
    const { rows } = await db.query(
      'SELECT idusuario, nome, sobrenome FROM usuarios WHERE email = $1',
      [email]
    );

    if (rows.length === 0) {
      return res.status(404).json({ erro: 'Usuário não encontrado' });
    }

    const usuario = rows[0];
    return res.status(200).json({
      id: usuario.id,
      nome: usuario.nome,
      sobrenome: usuario.sobrenome
    });

  } catch (erro) {
    console.error('Erro ao buscar usuário por e-mail:', erro);
    return res.status(500).json({ erro: 'Erro ao buscar usuário.' });
  }
}


module.exports = {
  listarEmpresasDoUsuario,
  getEmpresasDoUsuario,
  verificarUsuarioExistente,
  cadastrarOuAtualizarUsuario,
  listarUsuarios,
  buscarUsuariosPorNome,
  verificarNomeExistente,
  verificarNomeCompleto,
  login,
  listarPermissoes,
  buscarUsuarioPorEmail
};
