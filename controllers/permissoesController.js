const db = require('../db');

// Listar todas permissões
async function listarPermissoes(req, res) {
  try {
    const { rows } = await db.query('SELECT * FROM permissoes');
    res.status(200).json(rows);
  } catch (erro) {
    console.error('Erro ao listar permissões:', erro);
    res.status(500).json({ erro: 'Erro ao listar permissões.' });
  }
}

// Listar permissões por usuário

async function listarPermissoesPorUsuario(req, res) {
  const { idusuario } = req.params;
  const { modulo } = req.query;

  try {
    let query = `
      SELECT *
      FROM permissoes
      WHERE idusuario = $1
    `;
    const params = [idusuario];

    if (modulo) {
      query += ` AND modulo = $2`;
      params.push(modulo);
    }

    query += ` ORDER BY modulo`;

    const { rows } = await db.query(query, params);

    // Capitaliza o nome do módulo (ex: 'clientes' → 'Clientes')
    rows.forEach(row => {
      row.modulo = row.modulo.charAt(0).toUpperCase() + row.modulo.slice(1).toLowerCase();
    });

    res.status(200).json(rows);
  } catch (erro) {
    console.error('Erro ao buscar permissões do usuário:', erro);
    res.status(500).json({ erro: 'Erro ao buscar permissões do usuário.' });
  }
}


// Cadastrar ou atualizar permissões
// async function cadastrarOuAtualizarPermissoes(req, res) {
//   // const { idusuario, modulo, cadastrar, alterar, pesquisar, acesso } = req.body;
//   let { idusuario, modulo, cadastrar, alterar, pesquisar, acesso } = req.body;

//   // Normalizar o nome do módulo: primeira letra maiúscula, resto minúsculo
//   modulo = modulo.charAt(0).toUpperCase() + modulo.slice(1).toLowerCase();
//     console.log("cadastrarOuAtualizarPermissoes", req.body)
//   try {
//     const { rows } = await db.query(
//       'SELECT * FROM permissoes WHERE idusuario = $1 AND modulo = $2',
//       [idusuario, modulo]
//     );

//     if (rows.length > 0) {
//       // Atualiza
//       await db.query(`
//         UPDATE permissoes
//         SET cadastrar = $1, alterar = $2, pesquisar = $3, acesso = $4
//         WHERE idusuario = $5 AND modulo = $6
//       `, [cadastrar, alterar, pesquisar, acesso, idusuario, modulo]);

//       return res.status(200).json({ mensagem: 'Permissões atualizadas com sucesso.' });
//     } else {
//       // Insere
//       await db.query(`
//         INSERT INTO permissoes (idusuario, modulo, cadastrar, alterar, pesquisar, acesso)
//         VALUES ($1, $2, $3, $4, $5, $6)
//       `, [idusuario, modulo, cadastrar, alterar, pesquisar, acesso]);

//       return res.status(201).json({ mensagem: 'Permissões cadastradas com sucesso.' });
//     }

//   } catch (erro) {
//     console.error('Erro ao cadastrar/atualizar permissões:', erro);
//     res.status(500).json({ erro: 'Erro ao salvar permissões.' });
//   }
// }


// Cadastrar ou atualizar permissões por empresa
// async function cadastrarOuAtualizarPermissoes(req, res) {
//   let { idusuario, email, modulo, cadastrar, alterar, pesquisar, acesso, idempresa } = req.body;

//   if (!idempresa) {
//     return res.status(400).json({ erro: 'ID da empresa é obrigatório.' });
//   }

//   // Normaliza o nome do módulo
//   modulo = modulo.charAt(0).toUpperCase() + modulo.slice(1).toLowerCase();

//   try {
//     const { rows } = await db.query(
//       'SELECT * FROM permissoes WHERE idusuario = $1 AND modulo = $2 AND idempresa = $3',
//       [idusuario, modulo, idempresa]
//     );

//     if (rows.length > 0) {
//       // Atualiza
//       await db.query(`
//         UPDATE permissoes
//         SET cadastrar = $1, alterar = $2, pesquisar = $3, acesso = $4, leitura = $5
//         WHERE idusuario = $6 AND modulo = $7 AND idempresa = $8
//       `, [cadastrar, alterar, pesquisar, acesso, leitura, idusuario, modulo, idempresa]);

//       return res.status(200).json({ mensagem: 'Permissões atualizadas com sucesso.' });
//     } else {
//       // Insere
//       await db.query(`
//         INSERT INTO permissoes (idusuario, email, modulo, cadastrar, alterar, pesquisar, acesso, leitura, idempresa)
//         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
//       `, [idusuario, email, modulo, cadastrar, alterar, pesquisar, acesso, idempresa]);

//       return res.status(201).json({ mensagem: 'Permissões cadastradas com sucesso.' });
//     }

//   } catch (erro) {
//     console.error('Erro ao cadastrar/atualizar permissões:', erro);
//     res.status(500).json({ erro: 'Erro ao salvar permissões.' });
//   }
// }
async function cadastrarOuAtualizarPermissoes(req, res) {
  const { idusuario, email, permissoes } = req.body;

  if (!idusuario || !Array.isArray(permissoes)) {
    return res.status(400).json({ erro: 'Dados inválidos.' });
  }

  try {
    const empresasVinculadas = new Set();

    for (const perm of permissoes) {
      let { idempresa, modulo, cadastrar, alterar, pesquisar, acesso } = perm;

      if (!idempresa || !modulo) continue;

      // Normaliza o módulo
      modulo = modulo.charAt(0).toUpperCase() + modulo.slice(1).toLowerCase();

      empresasVinculadas.add(idempresa);

      const { rows } = await db.query(
        'SELECT * FROM permissoes WHERE idusuario = $1 AND modulo = $2 AND idempresa = $3',
        [idusuario, modulo, idempresa]
      );

      if (rows.length > 0) {
        // Atualiza
        await db.query(`
          UPDATE permissoes
          SET cadastrar = $1, alterar = $2, pesquisar = $3, acesso = $4
          WHERE idusuario = $5 AND modulo = $6 AND idempresa = $7
        `, [cadastrar, alterar, pesquisar, acesso, idusuario, modulo, idempresa]);
      } else {
        // Insere
        await db.query(`
          INSERT INTO permissoes (idusuario, email, modulo, cadastrar, alterar, pesquisar, acesso, idempresa)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [idusuario, email, modulo, cadastrar, alterar, pesquisar, acesso, idempresa]);
      }
    }

    // Atualiza ou cria vínculo em usuarioempresas
    for (const idempresa of empresasVinculadas) {
      const { rowCount } = await db.query(
        'SELECT 1 FROM usuarioempresas WHERE idusuario = $1 AND idempresa = $2',
        [idusuario, idempresa]
      );

      if (rowCount === 0) {
        await db.query(
          'INSERT INTO usuarioempresas (idusuario, idempresa) VALUES ($1, $2)',
          [idusuario, idempresa]
        );
      }
    }

    res.status(200).json({ mensagem: 'Permissões salvas com sucesso.' });
  } catch (erro) {
    console.error('Erro ao cadastrar/atualizar permissões:', erro);
    res.status(500).json({ erro: 'Erro ao salvar permissões.' });
  }
}



// Deletar permissão
async function deletarPermissao(req, res) {
  const { idpermissao } = req.params;

  try {
    await db.query('DELETE FROM permissoes WHERE idpermissao = $1', [idpermissao]);
    res.status(200).json({ mensagem: 'Permissão deletada com sucesso.' });
  } catch (erro) {
    console.error('Erro ao deletar permissão:', erro);
    res.status(500).json({ erro: 'Erro ao deletar permissão.' });
  }
}

async function atualizarEmpresasDoUsuario(req, res) {
  const { idusuario, empresas } = req.body;

  if (!Array.isArray(empresas)) {
    return res.status(400).json({ erro: 'Empresas inválidas.' });
  }

  try {
    // Remove vínculos antigos
    await db.query('DELETE FROM usuarioempresas WHERE idusuario = $1', [idusuario]);

    // Insere novos vínculos
    for (const idempresa of empresas) {
      await db.query(
        'INSERT INTO usuarioempresas (idusuario, idempresa) VALUES ($1, $2)',
        [idusuario, idempresa]
      );
    }

    res.status(200).json({ mensagem: 'Empresas atualizadas com sucesso.' });
  } catch (erro) {
    console.error('Erro ao atualizar empresas do usuário:', erro);
    res.status(500).json({ erro: 'Erro ao atualizar empresas do usuário.' });
  }
}

async function listarEmpresasDoUsuario(req, res) {
  const { idusuario } = req.params;

  try {
    const { rows } = await db.query(`
      SELECT e.idempresa, e.nome 
      FROM empresas e 
      JOIN usuarioempresas ue ON e.idempresa = ue.idempresa 
      WHERE ue.idusuario = $1
    `, [idusuario]);

    res.status(200).json(rows);
  } catch (erro) {
    console.error('Erro ao buscar empresas do usuário:', erro);
    res.status(500).json({ erro: 'Erro ao buscar empresas do usuário.' });
  }
}



module.exports = {
  listarPermissoes,
  listarPermissoesPorUsuario,
  cadastrarOuAtualizarPermissoes,
  deletarPermissao,
  atualizarEmpresasDoUsuario,
  listarEmpresasDoUsuario
};
