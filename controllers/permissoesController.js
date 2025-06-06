const db = require('../db');

// Listar todas permissões
async function listarPermissoes(req, res) {
  try {
    const { rows } = await db.query('SELECT * FROM permissoes');
    console.log("listarPermissoes", rows);
    res.status(200).json(rows);
  } catch (erro) {
    console.error('Erro ao listar permissões:', erro);
    res.status(500).json({ erro: 'Erro ao listar permissões.' });
  }
}

// Listar permissões por usuário

async function listarPermissoesPorUsuario(req, res) {
 // console.log("listarPermissoesPorUsuario", req.params, req.query, req.headers);
  const { idusuario } = req.params;
  const { modulo } = req.query;
  const idempresa = req.headers.idempresa;

  console.log("listarPermissoesPorUsuario", idusuario, modulo, idempresa);

  try {
    let query = `
      SELECT *
      FROM permissoes
      WHERE idusuario = $1
    `;
    const params = [idusuario];

    if (modulo) {
      // query += ` AND modulo = $2`;
      query += ` AND modulo = $${params.length + 1}`;
      params.push(modulo);
    }
    if (idempresa) {
          query += ` AND idempresa = $${params.length + 1}`;
          params.push(idempresa);
   }

   
    query += ` ORDER BY modulo`;

    console.log("query", query, params);

    const { rows } = await db.query(query, params);

    const permissoes = rows.map(row => ({
      idpermissao: row.idpermissao,
      idusuario: row.idusuario,
      email: row.email,
      modulo: row.modulo.charAt(0).toUpperCase() + row.modulo.slice(1).toLowerCase(),
      cadastrar: !!row.cadastrar,
      alterar: !!row.alterar,
      pesquisar: !!row.pesquisar,
      acesso: !!row.acesso,
      idempresa: row.idempresa
    }));
    console.log("listarPermissoesPorUsuario FINAL", permissoes);
    res.status(200).json(permissoes);

  } catch (erro) {
    console.error('Erro ao buscar permissões do usuário:', erro);
    res.status(500).json({ erro: 'Erro ao buscar permissões do usuário.' });
  }
}


// async function cadastrarOuAtualizarPermissoes(req, res) {
//   const { idusuario, email, permissoes } = req.body;

//   if (!idusuario || !Array.isArray(permissoes)) {
//     return res.status(400).json({ erro: 'Dados inválidos.' });
//   }

//   try {
//     const empresasVinculadas = new Set();

//     for (const perm of permissoes) {
//       let { idempresa, modulo, cadastrar, alterar, pesquisar, acesso } = perm;

//       if (!idempresa || !modulo) continue;

//       // Normaliza o módulo
//       modulo = modulo.charAt(0).toUpperCase() + modulo.slice(1).toLowerCase();

//       empresasVinculadas.add(idempresa);

//       const { rows } = await db.query(
//         'SELECT * FROM permissoes WHERE idusuario = $1 AND modulo = $2 AND idempresa = $3',
//         [idusuario, modulo, idempresa]
//       );

//       if (rows.length > 0) {
//         // Atualiza
//         await db.query(`
//           UPDATE permissoes
//           SET cadastrar = $1, alterar = $2, pesquisar = $3, acesso = $4
//           WHERE idusuario = $5 AND modulo = $6 AND idempresa = $7
//         `, [cadastrar, alterar, pesquisar, acesso, idusuario, modulo, idempresa]);
//       } else {
//         // Insere
//         await db.query(`
//           INSERT INTO permissoes (idusuario, email, modulo, cadastrar, alterar, pesquisar, acesso, idempresa)
//           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
//         `, [idusuario, email, modulo, cadastrar, alterar, pesquisar, acesso, idempresa]);
//       }
//     }

//     // Atualiza ou cria vínculo em usuarioempresas
//     for (const idempresa of empresasVinculadas) {
//       const { rowCount } = await db.query(
//         'SELECT 1 FROM usuarioempresas WHERE idusuario = $1 AND idempresa = $2',
//         [idusuario, idempresa]
//       );

//       if (rowCount === 0) {
//         await db.query(
//           'INSERT INTO usuarioempresas (idusuario, idempresa) VALUES ($1, $2)',
//           [idusuario, idempresa]
//         );
//       }
//     }

//     res.status(200).json({ mensagem: 'Permissões salvas com sucesso.' });
//   } catch (erro) {
//     console.error('Erro ao cadastrar/atualizar permissões:', erro);
//     res.status(500).json({ erro: 'Erro ao salvar permissões.' });
//   }
// }

// async function listarPermissoesPorUsuario(req, res) {
//   const { idusuario } = req.params;
//   let { modulo } = req.query;
//   const idempresa = req.headers.idempresa;

//   if (!idusuario) {
//     return res.status(400).json({ erro: 'Parâmetro idusuario é obrigatório.' });
//   }

//   console.log("listarPermissoesPorUsuario", idusuario, modulo, idempresa);

//   try {
//     const params = [idusuario];
//     let condicoes = [`idusuario = $1`];

//     if (modulo) {
//       // Normaliza nome do módulo
//       modulo = modulo.charAt(0).toUpperCase() + modulo.slice(1).toLowerCase();
//       params.push(modulo);
//       condicoes.push(`modulo = $${params.length}`);
//     }

//     if (idempresa) {
//       params.push(idempresa);
//       condicoes.push(`idempresa = $${params.length}`);
//     }

//     const query = `
//       SELECT *
//       FROM permissoes
//       WHERE ${condicoes.join(' AND ')}
//       ORDER BY modulo
//     `;

//     const { rows } = await db.query(query, params);

//     const permissoes = rows.map(row => ({
//       idpermissao: row.idpermissao,
//       idusuario: row.idusuario,
//       email: row.email,
//       modulo: row.modulo.charAt(0).toUpperCase() + row.modulo.slice(1).toLowerCase(),
//       cadastrar: !!row.cadastrar,
//       alterar: !!row.alterar,
//       pesquisar: !!row.pesquisar,
//       acesso: !!row.acesso,
//       idempresa: row.idempresa
//     }));

//     res.status(200).json(permissoes);

//   } catch (erro) {
//     console.error('Erro ao buscar permissões do usuário:', erro);
//     res.status(500).json({ erro: 'Erro ao buscar permissões do usuário.' });
//   }
// }

async function cadastrarOuAtualizarPermissoes(req, res) {
  const {
    idusuario,
    email,
    modulo,
    acesso,
    cadastrar,
    alterar,
    pesquisar,
    empresas
  } = req.body;

  if (!idusuario || !modulo || !Array.isArray(empresas) || empresas.length === 0) {
    return res.status(400).json({ erro: 'Dados inválidos ou incompletos.' });
  }

  try {
    // Normaliza o nome do módulo (capitaliza)
    const moduloFormatado = modulo.charAt(0).toUpperCase() + modulo.slice(1).toLowerCase();

    for (const idempresa of empresas) {
      // Verifica se já existe permissão para este usuário, empresa e módulo
      const { rows } = await db.query(
        'SELECT 1 FROM permissoes WHERE idusuario = $1 AND modulo = $2 AND idempresa = $3',
        [idusuario, moduloFormatado, idempresa]
      );

      if (rows.length > 0) {
        // Atualiza
        await db.query(`
          UPDATE permissoes
          SET cadastrar = $1, alterar = $2, pesquisar = $3, acesso = $4
          WHERE idusuario = $5 AND modulo = $6 AND idempresa = $7
        `, [cadastrar, alterar, pesquisar, acesso, idusuario, moduloFormatado, idempresa]);
      } else {
        // Insere nova permissão
        await db.query(`
          INSERT INTO permissoes (idusuario, email, modulo, cadastrar, alterar, pesquisar, acesso, idempresa)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [idusuario, email, moduloFormatado, cadastrar, alterar, pesquisar, acesso, idempresa]);
      }

      // Garante vínculo em usuarioempresas
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

    res.status(200).json({ sucesso: true, mensagem: 'Permissões salvas com sucesso.' });
  } catch (erro) {
    console.error('Erro ao salvar permissões:', erro);
    res.status(500).json({ erro: 'Erro ao salvar permissões no banco de dados.' });
  }
}



// // Deletar permissão
// async function deletarPermissao(req, res) {
//   const { idpermissao } = req.params;

//   try {
//     await db.query('DELETE FROM permissoes WHERE idpermissao = $1', [idpermissao]);
//     res.status(200).json({ mensagem: 'Permissão deletada com sucesso.' });
//   } catch (erro) {
//     console.error('Erro ao deletar permissão:', erro);
//     res.status(500).json({ erro: 'Erro ao deletar permissão.' });
//   }
// }

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

// async function listarEmpresasDoUsuario(req, res) {
//   const { idusuario } = req.params;

//   try {
//     const { rows } = await db.query(`
//       SELECT e.idempresa, e.nome 
//       FROM empresas e 
//       JOIN usuarioempresas ue ON e.idempresa = ue.idempresa 
//       WHERE ue.idusuario = $1
//     `, [idusuario]);

//     res.status(200).json(rows);
//   } catch (erro) {
//     console.error('Erro ao buscar empresas do usuário:', erro);
//     res.status(500).json({ erro: 'Erro ao buscar empresas do usuário.' });
//   }
// }




module.exports = {
  listarPermissoes,
  listarPermissoesPorUsuario,
  cadastrarOuAtualizarPermissoes,
  // deletarPermissao,
  atualizarEmpresasDoUsuario
};
