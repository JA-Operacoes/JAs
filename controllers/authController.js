// controllers/authController.js
const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;


// Cadastro de usuário
// controllers/authController.js
async function verificarUsuarioExistente(req, res) {
    const { nome, sobrenome, email, ativo } = req.body;
    console.log("verificarUsuarioExistente AuthController", req.body);
    try {
      const { rows } = await db.query("SELECT * FROM usuarios WHERE nome = $1 AND sobrenome = $2 AND email = $3 AND ativo = $4", [nome, sobrenome, email, ativo]);
  
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


async function cadastrarOuAtualizarUsuario(req, res) {
  const { nome, sobrenome, email, senha, email_original, ativo, empresas } = req.body;
  
  function arraysIguais(arr1, arr2) {
    if (!Array.isArray(arr1) || !Array.isArray(arr2)) return false;
    if (arr1.length !== arr2.length) return false;
    const sorted1 = [...arr1].sort();
    const sorted2 = [...arr2].sort();
    return sorted1.every((val, idx) => val === sorted2[idx]);
  }
  console.log('Dados recebidos cadastrarOuAtualizarUsuario:', req.body);
  try {
    // Busca o usuário pelo email original
    const { rows } = await db.query("SELECT * FROM usuarios WHERE email = $1", [email_original]);


    if (rows.length > 0) {
      const usuario = rows[0];

      // Aqui pegamos as empresas do usuário do banco para comparação
      const empresasDoUsuario = await getEmpresasDoUsuario(usuario.idusuario);
      const empresasIguais = arraysIguais(empresas, empresasDoUsuario);

      const camposIguais =
        nome === usuario.nome &&
        sobrenome === usuario.sobrenome &&
        email === usuario.email &&
        usuario.ativo === req.body.ativo &&
        !senha &&
        empresasIguais; // senha vazia significa que não foi alterada

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
      if (atualizacoes.length > 0) {
        valores.push(email_original);
        const sql = `UPDATE usuarios SET ${atualizacoes.join(', ')} WHERE email = $${idx}`;
        await db.query(sql, valores);
       }
      // Atualizar empresas associadas se fornecido
      if (Array.isArray(empresas)) {
        // Remove todas associações antigas
        await db.query('DELETE FROM usuarioempresas WHERE idusuario = $1', [usuario.idusuario]);
        // Insere as novas associações
        for (const idempresa of empresas) {
          await db.query('INSERT INTO usuarioempresas (idusuario, idempresa) VALUES ($1, $2)', [usuario.idusuario, idempresa]);
        }
      }

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
        INSERT INTO usuarios (nome, sobrenome, email, senha_hash, ativo)
        VALUES ($1, $2, $3, $4, true) RETURNING *
      `, [nome, sobrenome, email, senhaHash, ativo]);

      
      const usuarioId = result.rows[0].idusuario;

      if (Array.isArray(empresas)) {
        for (const idempresa of empresas) {
          await db.query(`INSERT INTO usuarioempresas (idusuario, idempresa) VALUES ($1, $2) RETURNING *`, [usuarioId, idempresa]);
        }
      }

      return res.status(201).json({ mensagem: 'Usuário cadastrado com sucesso.' });
    }

  } catch (erro) {
    console.error('Erro ao cadastrar ou atualizar usuário:', erro);
    res.status(500).json({ erro: 'Erro ao cadastrar ou atualizar usuário.' });
  }
}

// função auxiliar para buscar empresas do usuário do BD
async function getEmpresasDoUsuario(idusuario) {
  const { rows } = await db.query('SELECT idempresa FROM usuarioempresas WHERE idusuario = $1', [idusuario]);
  return rows.map(row => row.idempresa);
}

async function listarUsuarios(req, res) {
  
    // try {
    //   console.log("listarUsuarios AuthController", req );
    //   //  const { rows } = await db.query('SELECT idusuario, nome, sobrenome, email, senha_hash, ativo FROM usuarios ORDER BY nome');
    //   //  res.status(200).json(rows);
    //   // Busca as empresas vinculadas ao usuário
    //   const empresasQuery = await db.query(`
    //     SELECT e.idempresa, e.nome 
    //     FROM usuarioempresas ue
    //     JOIN empresas e ON ue.idempresa = e.idempresa
    //     WHERE ue.idusuario = $1
    //   `, [usuario.idusuario]);

    //   const empresas = empresasQuery.rows;

    //   if (empresas.length === 0) {
    //     return res.status(403).json({ erro: 'Usuário não possui empresas vinculadas.' });
    //   }

    //   // Criar o token com idusuario e (opcional) idempresaDefault
    //   const tokenPayload = {
    //     idusuario: usuario.idusuario,
    //     email: usuario.email,
    //     idempresaDefault: empresas[0].idempresa, // opcional
    //   };

    //   const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '8h' });

    //   res.status(200).json({
    //     token,
    //     idusuario: usuario.idusuario,
    //     empresas,
    //     idempresaDefault: empresas[0].idempresa, // opcional
    //   });

    // } catch (erro) {
    //   console.error('Erro ao listar usuários:', erro);
    //   res.status(500).json({ erro: 'Erro ao listar usuários.' });
    // }
    try {
      console.log('Headers:', req.headers);
      console.log('req.user:', req.user);
      console.log('req.idempresa:', req.idempresa);
   
      const { idusuario } = req.usuario;
      const idempresa = req.idempresa;

      console.log('req.user:', req.user);
      console.log('req.idempresa:', req.idempresa);

      // valida se o usuário tem acesso a essa empresa, por exemplo:
      const empresasQuery = await db.query(
        `SELECT * FROM usuarioempresas WHERE idusuario = $1 AND idempresa = $2`,
        [idusuario, idempresa]
      );
      if (empresasQuery.rows.length === 0) {
        return res.status(403).json({ erro: 'Usuário não tem acesso a essa empresa.' });
      }

      // busca usuários da empresa
      const usuariosQuery = await db.query(`
        SELECT u.idusuario, u.nome, u.sobrenome, u.email, u.ativo
        FROM usuarios u
        JOIN usuarioempresas ue ON u.idusuario = ue.idusuario
        WHERE ue.idempresa = $1
        ORDER BY u.nome
      `, [idempresa]);

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
      SELECT idusuario, nome, sobrenome, email, senha_hash, ativo
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
        SELECT * FROM usuarios WHERE LOWER(nome) = LOWER($1) LIMIT 1
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


// Login de usuário
// async function login(req, res) {
//   const { email, senha } = req.body;

//   try {
//     const { rows } = await db.query(
//       'SELECT * FROM usuarios WHERE email = $1',
//       [email]
//     );
//     const usuario = rows[0];
//     if (!usuario) return res.status(401).json({ erro: 'Usuário não encontrado.' });

//     const senhaCorreta = await bcrypt.compare(senha, usuario.senha_hash);
//     if (!senhaCorreta) return res.status(401).json({ erro: 'Senha inválida.' });

//     // 🔍 Buscar permissões do usuário no banco
//     const { rows: permissoesRaw } = await db.query(
//       `
//       SELECT
//         modulo,
//         acesso   AS pode_acessar,
//         pesquisar AS pode_pesquisar,
//         cadastrar AS pode_cadastrar,
//         alterar   AS pode_alterar
//       FROM permissoes
//       WHERE idusuario = $1
//       `,
//       [usuario.idusuario]
//     );

//     // 📦 Gerar token com permissões no payload
//     const token = jwt.sign(
//       {
//         id: usuario.idusuario,
//         nome: usuario.nome,
//         permissoes: permissoesRaw
//       },
//       process.env.JWT_SECRET,
//       { expiresIn: '8h' }
//     );

//     const { rows: empresas } = await db.query(
//       `SELECT e.idempresa, e.nome_fantasia FROM empresas e
//       JOIN usuario_empresas ue ON e.idempresa = ue.idempresa
//       WHERE ue.idusuario = $1`, 
//       [usuario.idusuario]
//     );

//     // Retorna token, dados do usuário e permissões
//     res.status(200).json({
//       token,
//       idusuario: usuario.idusuario,
//       nome: usuario.nome,
//       permissoes: permissoesRaw,
//       empresas
//     });

//   } catch (error) {
//     console.error('Erro ao fazer login:', error);
//     res.status(500).json({ erro: 'Erro no login.' });
//   }
// }

// Login
async function login(req, res) {
  // const { email, senha } = req.body;

  // try {
  //   const { rows } = await db.query('SELECT * FROM usuarios WHERE email = $1', [email]);
  //   const usuario = rows[0];

  //   if (!usuario) return res.status(401).json({ erro: 'Usuário não encontrado.' });

  //   const senhaCorreta = await bcrypt.compare(senha, usuario.senha_hash);
  //   if (!senhaCorreta) return res.status(401).json({ erro: 'Senha inválida.' });

  //   const { rows: permissoesRaw } = await db.query(
  //     `SELECT modulo, acesso AS pode_acessar, pesquisar AS pode_pesquisar, cadastrar AS pode_cadastrar, alterar AS pode_alterar
  //      FROM permissoes WHERE idusuario = $1`,
  //     [usuario.idusuario]
  //   );

  //   const token = jwt.sign(
  //     { id: usuario.idusuario, nome: usuario.nome, permissoes: permissoesRaw },
  //     process.env.JWT_SECRET,
  //     { expiresIn: '8h' }
  //   );

  //   const { rows: empresas } = await db.query(
  //     `SELECT e.idempresa, e.nome FROM empresas e
  //      JOIN usuarioempresas ue ON e.idempresa = ue.idempresa
  //      WHERE ue.idusuario = $1`,
  //     [usuario.idusuario]
  //   );

  //   res.status(200).json({
  //     token,
  //     idusuario: usuario.idusuario,
  //     nome: usuario.nome,
  //     permissoes: permissoesRaw,
  //     empresas
  //   });
  // } catch (error) {
  //   console.error('Erro ao fazer login:', error);
  //   res.status(500).json({ erro: 'Erro no login.' });
  // }
  // const { email, senha } = req.body;
  // try {
  //   // Buscar usuário pelo email
  //   const { rows } = await db.query('SELECT idusuario, nome, email, senha_hash FROM usuarios WHERE email = $1', [email]);
  //   if (rows.length === 0) {
  //     return res.status(401).json({ erro: 'Usuário ou senha inválidos' });
  //   }
  //   const usuario = rows[0];

  //   // Aqui você deve verificar a senha (ex: bcrypt.compare), exemplo simplificado:
  //   if (senha !== usuario.senha_hash) {
  //     return res.status(401).json({ erro: 'Usuário ou senha inválidos' });
  //   }

  //   // Criar token
  //   const tokenPayload = { idusuario: usuario.idusuario, email: usuario.email, idempresaDefault: empresas[0].idempresa, };
  //   const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '8h' });

  //   res.json({ token, idusuario: usuario.idusuario, nome: usuario.nome });
  // } catch (erro) {
  //   console.error('Erro no login:', erro);
  //   res.status(500).json({ erro: 'Erro interno' });
  // }

  console.log("login AuthController ENTROU EM LOGIN", req.body);

  //  const { email, senha } = req.body;

  // try {
  //   const resultado = await db.query('SELECT * FROM usuarios WHERE email = $1', [email]);
  //   const usuario = resultado.rows[0];

  //   if (!usuario) {
  //     return res.status(401).json({ erro: 'Usuário não encontrado.' });
  //   }

  //   // Substitua isso por verificação com bcrypt na versão final
  //   const senhaCorreta = senha === usuario.senha;
  //   if (!senhaCorreta) {
  //     return res.status(401).json({ erro: 'Senha inválida.' });
  //   }

  //   const empresasQuery = await db.query(`
  //     SELECT e.idempresa, e.nome 
  //     FROM usuarioempresas ue
  //     JOIN empresas e ON ue.idempresa = e.idempresa
  //     WHERE ue.idusuario = $1
  //   `, [usuario.idusuario]);

  //   const empresas = empresasQuery.rows;
  //   if (empresas.length === 0) {
  //     return res.status(403).json({ erro: 'Usuário sem empresas vinculadas.' });
  //   }

  //   console.log("EMPRESAS DO USUÁRIO", empresas);
  //   const { rows: permissoesRaw } = await db.query(
  //     `SELECT modulo, acesso AS pode_acessar, pesquisar AS pode_pesquisar, cadastrar AS pode_cadastrar, alterar AS pode_alterar
  //      FROM permissoes
  //      WHERE idusuario = $1`,
  //     [usuario.idusuario]
  //   );
  //   console.log("PERMISSOES DO USUÁRIO", permissoesRaw);
  //   const tokenPayload = {
  //     id: usuario.idusuario,
  //     nome: usuario.nome,
  //     empresas,
  //     idempresaDefault: empresas[0].idempresa,
  //     permissoes: permissoesRaw,
     
  //   };
  //   console.log("TOKEN PAYLOAD", tokenPayload);
  //   const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '8h' });

  //   res.status(200).json({
  //     token,
  //     idusuario: usuario.idusuario,
  //     nome: usuario.nome,
  //     empresas,
  //     idempresaDefault: empresas[0].idempresa,
  //     permissoes: permissoesRaw,
  //   });

  // } catch (erro) {
  //   console.error('Erro no login:', erro);
  //   res.status(500).json({ erro: 'Erro ao fazer login.' });
  // }

  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ erro: "Email e senha são obrigatórios." });
    }

    // Buscar usuário pelo email
    const queryUsuario = "SELECT idusuario, email, senha_hash, nome FROM usuarios WHERE email = $1";
    const resultUsuario = await db.query(queryUsuario, [email]);

    if (resultUsuario.rows.length === 0) {
      return res.status(401).json({ erro: "Usuário ou senha inválidos." });
    }

    const usuario = resultUsuario.rows[0];

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
      WHERE ue.idusuario = $1
    `;
    const resultEmpresas = await db.query(queryEmpresas, [usuario.idusuario]);
    const empresas = resultEmpresas.rows;

    // Definir empresa padrão (a primeira da lista ou null)
    const idempresaDefault = empresas.length > 0 ? empresas[0].idempresa : null;

    // Gerar token JWT (pode incluir mais dados se quiser)
    const token = jwt.sign(
      { idusuario: usuario.idusuario, email: usuario.email },
      JWT_SECRET,
      { expiresIn: "10h" }
    );

    // Retornar resposta para o frontend
    return res.json({
      token,
      idusuario: usuario.idusuario,
      empresas,
      idempresaDefault,
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
  try {
    const { rows } = await db.query(
      `
      SELECT
        modulo,
        acesso   AS acessar,
        pesquisar AS pesquisar,
        cadastrar AS cadastrar,
        alterar   AS alterar
      FROM permissoes
      WHERE idusuario = $1
      `,
      [idusuario]
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
