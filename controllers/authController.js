// controllers/authController.js
const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Cadastro de usuário
// controllers/authController.js
async function verificarUsuarioExistente(req, res) {
    const { nome, sobrenome, email, ativo } = req.body;
  
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
  const { nome, sobrenome, email, senha, email_original, ativo } = req.body;
  console.log('Dados recebidos cadastrarOuAtualizarUsuario:', req.body);
  try {
    // Busca o usuário pelo email original
    const { rows } = await db.query("SELECT * FROM usuarios WHERE email = $1", [email_original]);

    if (rows.length > 0) {
      const usuario = rows[0];
      const atualizacoes = [];
      const valores = [];
      let idx = 1;

      const camposIguais =
        nome === usuario.nome &&
        sobrenome === usuario.sobrenome &&
        email === usuario.email &&
        usuario.ativo === req.body.ativo &&
        !senha; // senha vazia significa que não foi alterada

      if (camposIguais) {
        return res.status(200).json({ mensagem: 'Nenhuma alteração detectada no Usuário.' });
      }

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

      valores.push(email_original);
      const sql = `UPDATE usuarios SET ${atualizacoes.join(', ')} WHERE email = $${idx}`;
      await db.query(sql, valores);

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
      await db.query(`
        INSERT INTO usuarios (nome, sobrenome, email, senha_hash, ativo)
        VALUES ($1, $2, $3, $4, true)
      `, [nome, sobrenome, email, senhaHash, ativo]);

      return res.status(201).json({ mensagem: 'Usuário cadastrado com sucesso.' });
    }

  } catch (erro) {
    console.error('Erro ao cadastrar ou atualizar usuário:', erro);
    res.status(500).json({ erro: 'Erro ao cadastrar ou atualizar usuário.' });
  }
}

  
  async function listarUsuarios(req, res) {
    try {
      console.log("listarUsuarios AuthController", req );
      const { rows } = await db.query('SELECT idusuario, nome, sobrenome, email, senha_hash, ativo FROM usuarios ORDER BY nome');
      res.status(200).json(rows);
    } catch (erro) {
      console.error('Erro ao listar usuários:', erro);
      res.status(500).json({ erro: 'Erro ao listar usuários.' });
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

// async function login(req, res) {
//     const { email, senha } = req.body;

//     try {
//         const { rows } = await db.query('SELECT * FROM usuarios WHERE email = $1', [email]);
//         const usuario = rows[0];

//         if (!usuario) return res.status(401).json({ erro: 'Usuário não encontrado.' });

//         const senhaCorreta = await bcrypt.compare(senha, usuario.senha_hash);
//         if (!senhaCorreta) return res.status(401).json({ erro: 'Senha inválida.' });

//         // 🔍 Buscar permissões do usuário no banco
//         const { rows: permissoes } = await db.query(`
//             SELECT modulo,  pesquisar, cadastrar, alterar, acesso
//             FROM permissoes
//             WHERE idusuario = $1
//         `, [usuario.idusuario]);

//         // 📦 Gerar token com permissões no payload
//         const token = jwt.sign(
//             {
//                 id: usuario.idusuario,
//                 nome: usuario.nome,
//                 permissoes: permissoes  // <-- importante!
//             },
//             process.env.JWT_SECRET,
//             { expiresIn: '8h' }
//         );

//         res.status(200).json({
//             token,
//             idusuario: usuario.idusuario,
//             nome: usuario.nome,
//             permissoes // também pode enviar separado se quiser usar no frontend
//         });

//     } catch (error) {
//         console.error('Erro ao fazer login:', error);
//         res.status(500).json({ erro: 'Erro no login.' });
//     }
// }

// Login de usuário
async function login(req, res) {
  const { email, senha } = req.body;

  try {
    const { rows } = await db.query(
      'SELECT * FROM usuarios WHERE email = $1',
      [email]
    );
    const usuario = rows[0];
    if (!usuario) return res.status(401).json({ erro: 'Usuário não encontrado.' });

    const senhaCorreta = await bcrypt.compare(senha, usuario.senha_hash);
    if (!senhaCorreta) return res.status(401).json({ erro: 'Senha inválida.' });

    // 🔍 Buscar permissões do usuário no banco
    const { rows: permissoesRaw } = await db.query(
      `
      SELECT
        modulo,
        acesso   AS pode_acessar,
        pesquisar AS pode_pesquisar,
        cadastrar AS pode_cadastrar,
        alterar   AS pode_alterar
      FROM permissoes
      WHERE idusuario = $1
      `,
      [usuario.idusuario]
    );

    // 📦 Gerar token com permissões no payload
    const token = jwt.sign(
      {
        id: usuario.idusuario,
        nome: usuario.nome,
        permissoes: permissoesRaw
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    // Retorna token, dados do usuário e permissões
    res.status(200).json({
      token,
      idusuario: usuario.idusuario,
      nome: usuario.nome,
      permissoes: permissoesRaw
    });

  } catch (error) {
    console.error('Erro ao fazer login:', error);
    res.status(500).json({ erro: 'Erro no login.' });
  }
}

// → Nova função para listar permissões do usuário logado
async function listarPermissoes(req, res) {
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



module.exports = { cadastrarOuAtualizarUsuario, login, verificarUsuarioExistente, listarUsuarios, buscarUsuariosPorNome, buscarUsuarioPorEmail, listarPermissoes };
