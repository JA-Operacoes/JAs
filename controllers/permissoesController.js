const db = require('../db');

// Listar todas permissões
async function listarPermissoes(req, res) {
console.log("➡️ Entrou na rota /permissoes (pública).");
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
 
  const { idusuario } = req.params;
  const { modulo } = req.query;
  // const idempresa = req.headers.idempresa;

  const idempresa = req.idempresa;

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
      modulo: row.modulo.charAt(0).toUpperCase() + row.modulo.slice(1).toLowerCase(),
      cadastrar: !!row.cadastrar,
      alterar: !!row.alterar,
      pesquisar: !!row.pesquisar,
      acesso: !!row.acesso,
      apagar: !!row.apagar,
      master: !!row.master,
      financeiro: !!row.financeiro,
      supremo: !!row.supremo,
      comercial: !!row.comercial,
      devs: !!row.devs,
      rh: !!row.rh,
      idempresa: row.idempresa
    }));
    console.log("listarPermissoesPorUsuario FINAL", permissoes);
    res.status(200).json(permissoes);

  } catch (erro) {
    console.error('Erro ao buscar permissões do usuário:', erro);
    res.status(500).json({ erro: 'Erro ao buscar permissões do usuário.' });
  }
}

// Insere ou atualiza a linha de permissão de um usuário para um módulo+empresa.
// `client` pode ser o pool (fora de transação) ou um client de `pool.connect()` (dentro de transação em lote).
async function upsertPermissao(client, idusuario, modulo, idempresa, flags) {
  const moduloFormatado = modulo.charAt(0).toUpperCase() + modulo.slice(1).toLowerCase();
  const {
    acesso, cadastrar, alterar, pesquisar, apagar,
    master, financeiro, supremo, comercial, devs, rh
  } = flags;

  const { rows } = await client.query(
    'SELECT id FROM permissoes WHERE idusuario = $1 AND modulo = $2 AND idempresa = $3',
    [idusuario, moduloFormatado, idempresa]
  );

  if (rows.length > 0) {
    const updateResult = await client.query(`
      UPDATE permissoes
      SET cadastrar = $1, alterar = $2, pesquisar = $3, acesso = $4, apagar = $5, master = $6, financeiro = $7, supremo = $8, comercial = $9, devs = $10, rh = $11
      WHERE idusuario = $12 AND modulo = $13 AND idempresa = $14
      RETURNING id;
    `, [!!cadastrar, !!alterar, !!pesquisar, !!acesso, !!apagar, !!master, !!financeiro, !!supremo, !!comercial, !!devs, !!rh, idusuario, moduloFormatado, idempresa]);

    return { idpermissao: updateResult.rows[0]?.id || null, acao: 'atualizou' };
  }

  const insertResult = await client.query(`
    INSERT INTO permissoes (idusuario, modulo, cadastrar, alterar, pesquisar, acesso, apagar, master, financeiro, supremo, comercial, devs, rh, idempresa)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    RETURNING id;
  `, [idusuario, moduloFormatado, !!cadastrar, !!alterar, !!pesquisar, !!acesso, !!apagar, !!master, !!financeiro, !!supremo, !!comercial, !!devs, !!rh, idempresa]);

  return { idpermissao: insertResult.rows[0].id, acao: 'cadastrou' };
}

// Garante o vínculo do usuário com a empresa em `usuarioempresas` (cria ou atualiza o status `ativo`).
async function garantirVinculoEmpresa(client, idusuario, idempresa, ativo) {
  const { rowCount } = await client.query(
    'SELECT 1 FROM usuarioempresas WHERE idusuario = $1 AND idempresa = $2',
    [idusuario, idempresa]
  );

  if (rowCount === 0) {
    await client.query(
      'INSERT INTO usuarioempresas (idusuario, idempresa, ativo) VALUES ($1, $2, $3)',
      [idusuario, idempresa, ativo]
    );
  } else {
    await client.query(
      'UPDATE usuarioempresas SET ativo = $1 WHERE idusuario = $2 AND idempresa = $3',
      [ativo, idusuario, idempresa]
    );
  }
}

async function cadastrarOuAtualizarPermissoes(req, res) {
  const {
    idusuario,
    modulo,
    acesso,
    cadastrar,
    alterar,
    pesquisar,
    apagar,
    master,
    financeiro,
    supremo,
    comercial,
    devs,
    rh
  } = req.body;

  const ativo = req.body.ativo !== undefined ? req.body.ativo : false; // Padrão para true se não fornecido
  const idempresa = req.headers.idempresa;

  console.log("ENTROU NA ROTA CADASTRAR PERMISSAO", req.body, req.headers);
  console.log("ATIVO", ativo);

  if (!idusuario || !modulo || !idempresa)  {
    return res.status(400).json({ erro: 'Dados inválidos ou incompletos.' });
  }

  try {
    const { idpermissao, acao } = await upsertPermissao(
      db, idusuario, modulo, idempresa,
      { acesso, cadastrar, alterar, pesquisar, apagar, master, financeiro, supremo, comercial, devs, rh }
    );

    await garantirVinculoEmpresa(db, idusuario, idempresa, ativo);

    res.locals.acao = acao;
    res.locals.idregistroalterado = idpermissao;
    res.locals.idusuarioAlvo = idusuario;

    res.status(200).json({
      sucesso: true,
      mensagem: 'Permissões salvas com sucesso.'
    });
  } catch (erro) {
    console.error('Erro ao salvar permissões:', erro);
    res.status(500).json({ erro: 'Erro ao salvar permissões no banco de dados.' });
  }
}

// Retorna, para um usuário e uma empresa, TODOS os módulos cadastrados (tabela
// `modulos`) já com as flags de permissão do usuário (ou tudo false se ainda não
// houver linha em `permissoes` para aquele módulo). É a base do grid de permissões:
// usada tanto para a empresa de destino quanto, ao "copiar", para a empresa de
// origem (mesma consulta, idempresa diferente).
//
// Não filtra por `moduloempresas`: a tela não tem mais um seletor de módulo — se o
// módulo existe no cadastro de Módulos, ele deve poder receber permissão em
// qualquer empresa.
async function listarGradePermissoes(req, res) {
  const { idusuario } = req.params;
  const idempresa = req.idempresa;

  if (!idusuario || !idempresa) {
    return res.status(400).json({ erro: 'Usuário e empresa são obrigatórios.' });
  }

  try {
    const { rows } = await db.query(`
      SELECT
        m.idmodulo,
        m.modulo,
        COALESCE(p.acesso, false)      AS acesso,
        COALESCE(p.cadastrar, false)   AS cadastrar,
        COALESCE(p.alterar, false)     AS alterar,
        COALESCE(p.pesquisar, false)   AS pesquisar,
        COALESCE(p.apagar, false)      AS apagar,
        COALESCE(p.master, false)      AS master,
        COALESCE(p.financeiro, false)  AS financeiro,
        COALESCE(p.supremo, false)     AS supremo,
        COALESCE(p.comercial, false)   AS comercial,
        COALESCE(p.devs, false)        AS devs,
        COALESCE(p.rh, false)          AS rh
      FROM modulos m
      LEFT JOIN permissoes p ON LOWER(p.modulo) = LOWER(m.modulo) AND p.idusuario = $1 AND p.idempresa = $2
      ORDER BY m.modulo
    `, [idusuario, idempresa]);

    res.status(200).json(rows);
  } catch (erro) {
    console.error('Erro ao buscar grade de permissões:', erro);
    res.status(500).json({ erro: 'Erro ao buscar grade de permissões.' });
  }
}

// Salva de uma vez as permissões de TODOS os módulos informados, para um usuário+empresa.
// Substitui o fluxo de salvar módulo a módulo: o front-end manda o grid inteiro e aqui
// tudo é gravado numa única transação.
async function cadastrarOuAtualizarPermissoesLote(req, res) {
  const { idusuario, permissoes } = req.body;
  const ativo = req.body.ativo !== undefined ? req.body.ativo : false;
  const idempresa = req.headers.idempresa;

  if (!idusuario || !idempresa || !Array.isArray(permissoes)) {
    return res.status(400).json({ erro: 'Dados inválidos ou incompletos.' });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const idsAlterados = [];
    for (const item of permissoes) {
      if (!item.modulo) continue;
      const { idpermissao } = await upsertPermissao(client, idusuario, item.modulo, idempresa, item);
      idsAlterados.push(idpermissao);
    }

    await garantirVinculoEmpresa(client, idusuario, idempresa, ativo);

    await client.query('COMMIT');

    res.locals.acao = 'atualizou-lote';
    res.locals.idregistroalterado = idsAlterados.filter(Boolean).join(',');
    res.locals.idusuarioAlvo = idusuario;

    res.status(200).json({
      sucesso: true,
      mensagem: 'Permissões salvas com sucesso.'
    });
  } catch (erro) {
    await client.query('ROLLBACK');
    console.error('Erro ao salvar permissões em lote:', erro);
    res.status(500).json({ erro: 'Erro ao salvar permissões no banco de dados.' });
  } finally {
    client.release();
  }
}



async function atualizarEmpresasDoUsuario(req, res) {
  const { idusuario, empresas } = req.body;

  if (!Array.isArray(empresas)) {
    return res.status(400).json({ erro: 'Empresas inválidas.' });
  }

  try {
    // Remove vínculos antigos ???
    //await db.query('DELETE FROM usuarioempresas WHERE idusuario = $1', [idusuario]);

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
  listarGradePermissoes,
  cadastrarOuAtualizarPermissoesLote,
  // deletarPermissao,
  atualizarEmpresasDoUsuario
};
