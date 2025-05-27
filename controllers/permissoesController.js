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
async function cadastrarOuAtualizarPermissoes(req, res) {
  let { idusuario, email, modulo, cadastrar, alterar, pesquisar, acesso, leitura, idempresa } = req.body;

  if (!idempresa) {
    return res.status(400).json({ erro: 'ID da empresa é obrigatório.' });
  }

  // Normaliza o nome do módulo
  modulo = modulo.charAt(0).toUpperCase() + modulo.slice(1).toLowerCase();

  try {
    const { rows } = await db.query(
      'SELECT * FROM permissoes WHERE idusuario = $1 AND modulo = $2 AND idempresa = $3',
      [idusuario, modulo, idempresa]
    );

    if (rows.length > 0) {
      // Atualiza
      await db.query(`
        UPDATE permissoes
        SET cadastrar = $1, alterar = $2, pesquisar = $3, acesso = $4, leitura = $5
        WHERE idusuario = $6 AND modulo = $7 AND idempresa = $8
      `, [cadastrar, alterar, pesquisar, acesso, leitura, idusuario, modulo, idempresa]);

      return res.status(200).json({ mensagem: 'Permissões atualizadas com sucesso.' });
    } else {
      // Insere
      await db.query(`
        INSERT INTO permissoes (idusuario, email, modulo, cadastrar, alterar, pesquisar, acesso, leitura, idempresa)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [idusuario, email, modulo, cadastrar, alterar, pesquisar, acesso, leitura, idempresa]);

      return res.status(201).json({ mensagem: 'Permissões cadastradas com sucesso.' });
    }

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


module.exports = {
  listarPermissoes,
  listarPermissoesPorUsuario,
  cadastrarOuAtualizarPermissoes,
  deletarPermissao
};
