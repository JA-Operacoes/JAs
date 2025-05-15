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
  try {
    const { rows } = await db.query(`
      SELECT *
      FROM permissoes
      WHERE idusuario = $1
      ORDER BY modulo
    `, [idusuario]);
    
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
async function cadastrarOuAtualizarPermissoes(req, res) {
  // const { idusuario, modulo, cadastrar, alterar, pesquisar, acesso } = req.body;
  let { idusuario, modulo, cadastrar, alterar, pesquisar, acesso } = req.body;

  // Normalizar o nome do módulo: primeira letra maiúscula, resto minúsculo
  modulo = modulo.charAt(0).toUpperCase() + modulo.slice(1).toLowerCase();
    console.log("cadastrarOuAtualizarPermissoes", req.body)
  try {
    const { rows } = await db.query(
      'SELECT * FROM permissoes WHERE idusuario = $1 AND modulo = $2',
      [idusuario, modulo]
    );

    if (rows.length > 0) {
      // Atualiza
      await db.query(`
        UPDATE permissoes
        SET cadastrar = $1, alterar = $2, pesquisar = $3, acesso = $4
        WHERE idusuario = $5 AND modulo = $6
      `, [cadastrar, alterar, pesquisar, acesso, idusuario, modulo]);

      return res.status(200).json({ mensagem: 'Permissões atualizadas com sucesso.' });
    } else {
      // Insere
      await db.query(`
        INSERT INTO permissoes (idusuario, modulo, cadastrar, alterar, pesquisar, acesso)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [idusuario, modulo, cadastrar, alterar, pesquisar, acesso]);

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
