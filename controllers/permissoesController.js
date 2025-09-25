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
      idempresa: row.idempresa
    }));
    console.log("listarPermissoesPorUsuario FINAL", permissoes);
    res.status(200).json(permissoes);

  } catch (erro) {
    console.error('Erro ao buscar permissões do usuário:', erro);
    res.status(500).json({ erro: 'Erro ao buscar permissões do usuário.' });
  }
}

async function cadastrarOuAtualizarPermissoes(req, res) {
  console.log("ENTROU NA ROTA CADASTRAR PERMISSAO", req.body, req.headers);
  const {
    idusuario, 
    modulo,
    acesso,
    cadastrar,
    alterar,
    pesquisar,
    apagar,
    master,
    financeiro    
  } = req.body;

  const ativo = req.body.ativo !== undefined ? req.body.ativo : false; // Padrão para true se não fornecido

  console.log("ATIVO", ativo);
  

  const idempresa = req.headers.idempresa; 

  // if (!idusuario || !modulo || !Array.isArray(empresas) || empresas.length === 0) {
  //   return res.status(400).json({ erro: 'Dados inválidos ou incompletos.' });
  // }
  if (!idusuario || !modulo || !idempresa)  {
    return res.status(400).json({ erro: 'Dados inválidos ou incompletos.' });
  }

  try {
    // Normaliza o nome do módulo (capitaliza)
    const moduloFormatado = modulo.charAt(0).toUpperCase() + modulo.slice(1).toLowerCase();

    //for (const idempresa of empresas) {
      // Verifica se já existe permissão para este usuário, empresa e módulo
 
      const { rows } = await db.query(
        'SELECT 1 FROM permissoes WHERE idusuario = $1 AND modulo = $2 AND idempresa = $3',
        [idusuario, moduloFormatado, idempresa]
      );

      let idpermissao = null;
      let acao = '';

      console.log("ROWS", rows);

      if (rows.length > 0) {
        // Atualiza
        const updateResult = await db.query(`
          UPDATE permissoes
          SET cadastrar = $1, alterar = $2, pesquisar = $3, acesso = $4, apagar = $5, master = $6, financeiro = $7
          WHERE idusuario = $8 AND modulo = $9 AND idempresa = $10
          RETURNING id;
        `, [cadastrar, alterar, pesquisar, acesso, apagar, master, financeiro, idusuario, moduloFormatado, idempresa]);
        
  
        idpermissao = updateResult.rows[0]?.id || null;
        
        acao = 'atualizou';
      } else {
        // Insere nova permissão
        const insertResult = await db.query(`
          INSERT INTO permissoes (idusuario, modulo, cadastrar, alterar, pesquisar, acesso, apagar, master, financeiro, idempresa)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING id;
        `, [idusuario, moduloFormatado, cadastrar, alterar, pesquisar, acesso, apagar, master, financeiro, idempresa]);
        idpermissao = insertResult.rows[0].id;
        acao = 'cadastrou';
      }

      // Garante vínculo em usuarioempresas
      const { rowCount } = await db.query(
        'SELECT 1 FROM usuarioempresas WHERE idusuario = $1 AND idempresa = $2',
        [idusuario, idempresa]
      );

      // if (rowCount === 0) {
      //   await db.query(
      //     'INSERT INTO usuarioempresas (idusuario, idempresa) VALUES ($1, $2)',
      //     [idusuario, idempresa]
      //   );
      // }
      console.log('rowCount', rowCount, idusuario, idempresa, ativo);
      if (rowCount === 0) {
            // Se o vínculo não existe, insere com o status recebido
            await db.query(
                'INSERT INTO usuarioempresas (idusuario, idempresa, ativo) VALUES ($1, $2, $3)',
                [idusuario, idempresa, ativo]
            );
      } else {
          // Se o vínculo já existe, apenas atualiza o status
          await db.query(
              'UPDATE usuarioempresas SET ativo = $1 WHERE idusuario = $2 AND idempresa = $3',
              [ativo, idusuario, idempresa]
          );
      }
    //}
    res.locals.acao = acao;
    res.locals.idregistroalterado = idpermissao;
    res.locals.idusuarioAlvo = idusuario;

    res.status(200).json({ sucesso: true, mensagem: 'Permissões salvas com sucesso.' });
  } catch (erro) {
    console.error('Erro ao salvar permissões:', erro);
    res.status(500).json({ erro: 'Erro ao salvar permissões no banco de dados.' });
  }
}

// async function cadastrarOuAtualizarPermissoes(req, res) {
//   const {
//     idusuario,
//     modulo,
//     permissoesPorEmpresa // Array de objetos { idempresa, acesso, cadastrar, alterar, pesquisar }
//   } = req.body;

//   if (!idusuario || !modulo || !Array.isArray(permissoesPorEmpresa)) {
//     return res.status(400).json({ erro: 'Dados inválidos ou incompletos.' });
//   }

//   const client = await db.connect(); // Inicia a conexão do pool
//   try {
//     await client.query('BEGIN'); // Inicia a transação

//     const moduloFormatado = modulo.charAt(0).toUpperCase() + modulo.slice(1).toLowerCase();

//     // 1. Obter as permissões ATUAIS para este usuário e módulo
//     const { rows: currentPerms } = await client.query(
//       'SELECT idempresa, acesso, cadastrar, alterar, pesquisar FROM permissoes WHERE idusuario = $1 AND modulo = $2',
//       [idusuario, moduloFormatado]
//     );

//     const currentPermsMap = new Map();
//     currentPerms.forEach(p => {
//       currentPermsMap.set(p.idempresa, p);
//     });

//     const incomingEmpresaIds = new Set(permissoesPorEmpresa.map(p => p.idempresa));

//     // 2. Processar permissões recebidas (UPSERT)
//     for (const permData of permissoesPorEmpresa) {
//       const { idempresa, acesso, cadastrar, alterar, pesquisar } = permData;

//       if (currentPermsMap.has(idempresa)) {
//         // PERMISSÃO EXISTE: VERIFICAR SE HOUVE ALTERAÇÃO E ATUALIZAR
//         const existingPerm = currentPermsMap.get(idempresa);
//         if (
//           existingPerm.acesso !== acesso ||
//           existingPerm.cadastrar !== cadastrar ||
//           existingPerm.alterar !== alterar ||
//           existingPerm.pesquisar !== pesquisar
//         ) {
//           await client.query(`
//             UPDATE permissoes
//             SET acesso = $1, cadastrar = $2, alterar = $3, pesquisar = $4
//             WHERE idusuario = $5 AND modulo = $6 AND idempresa = $7
//           `, [acesso, cadastrar, alterar, pesquisar, idusuario, moduloFormatado, idempresa]);
//           console.log(`Permissão atualizada para usuário ${idusuario}, módulo ${moduloFormatado}, empresa ${idempresa}.`);
//         } else {
//             console.log(`Nenhuma alteração detectada para permissão de usuário ${idusuario}, módulo ${moduloFormatado}, empresa ${idempresa}.`);
//         }
//       } else {
//         // PERMISSÃO NÃO EXISTE: INSERIR NOVA
//         await client.query(`
//           INSERT INTO permissoes (idusuario, modulo, acesso, cadastrar, alterar, pesquisar, idempresa)
//           VALUES ($1, $2, $3, $4, $5, $6, $7)
//         `, [idusuario, moduloFormatado, acesso, cadastrar, alterar, pesquisar, idempresa]);
//         console.log(`Permissão inserida para usuário ${idusuario}, módulo ${moduloFormatado}, empresa ${idempresa}.`);
//       }

//       // Garante vínculo em usuarioempresas (mantido)
//       const { rowCount } = await client.query(
//         'SELECT 1 FROM usuarioempresas WHERE idusuario = $1 AND idempresa = $2',
//         [idusuario, idempresa]
//       );
//       if (rowCount === 0) {
//         await client.query(
//           'INSERT INTO usuarioempresas (idusuario, idempresa) VALUES ($1, $2)',
//           [idusuario, idempresa]
//         );
//         console.log(`Vínculo de usuário ${idusuario} com empresa ${idempresa} criado.`);
//       }
//     }

//     // 3. Deletar permissões que não estão mais na lista recebida
//     for (const existingPerm of currentPerms) {
//       if (!incomingEmpresaIds.has(existingPerm.idempresa)) {
//         await client.query(
//           'DELETE FROM permissoes WHERE idusuario = $1 AND modulo = $2 AND idempresa = $3',
//           [idusuario, moduloFormatado, existingPerm.idempresa]
//         );
//         console.log(`Permissão deletada para usuário ${idusuario}, módulo ${moduloFormatado}, empresa ${existingPerm.idempresa} (não mais selecionada).`);
//       }
//     }

//     await client.query('COMMIT'); // Confirma a transação
//     res.status(200).json({ sucesso: true, mensagem: 'Permissões salvas com sucesso.' });

//   } catch (erro) {
//     await client.query('ROLLBACK'); // Reverte a transação em caso de erro
//     console.error('Erro ao salvar permissões (Transação Revertida):', erro);
//     res.status(500).json({ erro: 'Erro ao salvar permissões no banco de dados.' });
//   } finally {
//     client.release(); // Libera o cliente de volta para o pool
//   }
// }


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
  // deletarPermissao,
  atualizarEmpresasDoUsuario
};
