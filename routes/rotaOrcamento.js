const express = require('express');
const router = express.Router();
const pool = require("../db/conexaoDB");
const { autenticarToken, contextoEmpresa } = require('../middlewares/authMiddlewares');
const { verificarPermissao } = require('../middlewares/permissaoMiddleware');
const logMiddleware = require("../middlewares/logMiddleware");

// Aplica autenticação em todas as rotas
//router.use(autenticarToken);
//router.use(contextoEmpresa);


// GET todas ou por id
// C:\Users\JA\Ja System - Teste\ja\routes\rotaOrcamento.js

router.get(
  "/", autenticarToken(), contextoEmpresa,
  verificarPermissao("Orcamentos", "pesquisar"), // Permissão para visualizar orçamentos
  async (req, res) => {
    const client = await pool.connect();
    try {
      const idempresa = req.idempresa; // ID da empresa do middleware 'contextoEmpresa'

      const { nrOrcamento } = req.query; // Pega apenas o nrOrcamento

      let query = `
        SELECT
            o.idorcamento,
            o.status,
            o.idcliente,
            c.nmfantasia AS nomecliente,
            o.idevento,
            e.nmevento AS nomeevento,
            o.idmontagem,
            lm.descmontagem AS nomelocalmontagem,
            o.nrorcamento,
            o.inframontagem,
            o.dtiniinframontagem,
            o.dtfiminframontagem,
            o.dtinimarcacao,
            o.dtfimmarcacao,
            o.dtinimontagem,
            o.dtfimmontagem,          
            o.dtinirealizacao,
            o.dtfimrealizacao,            
            o.dtinidesmontagem,
            o.dtfimdesmontagem,
            o.dtiniinfradesmontagem,
            o.dtfiminfradesmontagem,
            o.obsitens,
            o.obsproposta,
            o.totgeralvda,
            o.totgeralcto,
            o.totajdcto,
            o.lucrobruto,
            o.percentlucro,
            o.desconto,
            o.percentdesconto,
            o.acrescimo,
            o.percentacrescimo,
            o.lucroreal,
            o.percentlucroreal,
            o.vlrcliente
        FROM
            orcamentos o
        JOIN
            orcamentoempresas oe ON o.idorcamento = oe.idorcamento
        LEFT JOIN
            clientes c ON o.idcliente = c.idcliente
        LEFT JOIN
            eventos e ON o.idevento = e.idevento
        LEFT JOIN
            localmontagem lm ON o.idmontagem = lm.idmontagem
        WHERE
            oe.idempresa = $1 -- Sempre filtra pela empresa do usuário logado
      `;
      const valuesOrcamento = [idempresa];
      let paramIndex = 2; // Começa em 2 porque $1 já é idempresa

      // Adiciona condição WHERE para nrOrcamento
      if (nrOrcamento) {
        query += ` AND o.nrorcamento = $${paramIndex++}`;
        valuesOrcamento.push(nrOrcamento);
      } else {
        // Se nrOrcamento não for fornecido, não retorne nada ou retorne um erro 400.
        // Para esta funcionalidade, se não há nrOrcamento, não deve haver busca.
        return res.status(400).json({ error: "Número do orçamento é obrigatório para esta pesquisa." });
      }

      query += ` ORDER BY o.nrorcamento DESC LIMIT 1;`; // Adiciona LIMIT 1 para garantir apenas um resultado

      console.log("Query de busca por nrOrcamento:", query);
      console.log("Valores da busca por nrOrcamento:", valuesOrcamento);

      const resultOrcamento = await client.query(query, valuesOrcamento);

      console.log("Resultado da busca por nrOrcamento:", resultOrcamento.rows.length, "linhas.", resultOrcamento);

      if (resultOrcamento.rows.length === 0) {
        return res.status(404).json({ message: "Orçamento não encontrado com o número fornecido." });
      }

      // Retorna o primeiro (e único) orçamento encontrado
  //     res.status(200).json(resultOrcamento.rows[0]);

  //   } catch (error) {
  //     console.error("Erro ao buscar orçamento por número:", error);
  //     res.status(500).json({ error: "Erro ao buscar orçamento.", detail: error.message });
  //   } finally {
  //     client.release();
  //   }
  // }
      const orcamento = resultOrcamento.rows[0];

      // Agora, busque os itens do orçamento
      console.log("Buscando itens do orçamento com ID:", orcamento.idorcamento);
      
      // Query para buscar os itens do orçamento
  const queryItens = `
        SELECT
            idorcamentoitem,
            idorcamento,
            enviarnaproposta,
            categoria,
            produto,
            qtditens,
            qtddias,
            periododiariasinicio,
            periododiariasfim,
            vlrdiaria,
            totvdadiaria,
            ctodiaria,
            totctodiaria,
            descontoitem,
            percentdescontoitem,
            acrescimoitem,
            percentacrescimoitem,
            tpajdctoalimentacao,
            vlrajdctoalimentacao,
            tpajdctotransporte,
            vlrajdctotransporte,
            totajdctoitem,
            hospedagem,
            transporte,
            totgeralitem
        FROM
            orcamentoitens
        WHERE
            idorcamento = $1
        ORDER BY idorcamentoitem ASC;
      `;
      // Use o idorcamento que você acabou de buscar para encontrar os itens
      const resultItens = await client.query(queryItens, [orcamento.idorcamento]);
      const itensDoOrcamento = resultItens.rows;

      console.log("Itens encontrados para o orçamento:", itensDoOrcamento.length, "itens.");

      // --- PASSO CRUCIAL: ANEXAR OS ITENS AO OBJETO DO ORÇAMENTO ---
      orcamento.itens = itensDoOrcamento;

      // Retorna o orçamento completo, agora com os itens
      res.status(200).json(orcamento);

    } catch (error) {
      console.error("Erro ao buscar orçamento por número:", error);
      res.status(500).json({ error: "Erro ao buscar orçamento.", detail: error.message });
    } finally {
      client.release();
    }
  }
);

// GET /orcamento/clientes
router.get('/clientes', async (req, res) => {
  
  console.log("🔥 Rota /orcamentos/clientes acessada");

  const idempresa = req.idempresa;
  const { nmFantasia } = req.query;
  try {
    if (nmFantasia) {
      console.log("🔍 Buscando cliente por nmFantasia:", nmFantasia, idempresa);
      const result = await pool.query(
        `SELECT c.* 
        FROM clientes c
        INNER JOIN clienteempresas ce ON ce.idcliente = c.idcliente
        WHERE ce.idempresa = $1 AND c.nmfantasia ILIKE $2
        ORDER BY c.nmfantasia ASC LIMIT 1`,
        [idempresa,`%${nmFantasia}%`]
      );
      console.log("✅ Consulta por nmFantasia retornou:", result.rows.length, "linhas.");
      return result.rows.length
        ? res.json(result.rows[0])
        : res.status(404).json({ message: "Cliente não encontrado" });
    } else {
      console.log("🔍 Buscando todos os clientes para a empresa:", idempresa);
      const result = await pool.query(
        `SELECT c.* 
        FROM clientes c
        INNER JOIN clienteempresas ce ON ce.idcliente = c.idcliente
        WHERE ce.idempresa = $1 ORDER BY nmfantasia`
        , [idempresa]);
      console.log("✅ Consulta de todos os clientes retornou:", result.rows.length, "linhas.");
      return result.rows.length
        ? res.json(result.rows)
        : res.status(404).json({ message: "Nenhum Cliente encontrado" });
    }
  } catch (error) {
    console.error("❌ Erro ao buscar clientes:", error);
    res.status(500).json({ message: "Erro ao buscar nome fantasia" });
  }
});

// GET /orcamento/eventos
router.get('/eventos', async (req, res) => {
  
 console.log("🔥 Rota /orcamentos/eventos acessada");

  const idempresa = req.idempresa;

  try {
     
    const resultado = await pool.query(`
      SELECT e.*
      FROM eventos e
      INNER JOIN eventoempresas ee ON ee.idevento = e.idevento
      WHERE ee.idempresa = $1
      ORDER BY e.nmevento
    `, [idempresa]);

    res.json(resultado.rows);

  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao buscar clientes' });
  }
});

// GET /orcamento/localmontagem
router.get('/localmontagem', async (req, res) => {
  
 console.log("🔥 Rota /orcamentos/localmontagem acessada");

  const idempresa = req.idempresa;

  try {
     
    const resultado = await pool.query(`
      SELECT l.*
      FROM localmontagem l
      INNER JOIN localmontempresas le ON le.idmontagem = l.idmontagem
      WHERE le.idempresa = $1
      ORDER BY l.descmontagem
    `, [idempresa]);

    res.json(resultado.rows);

  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao buscar clientes' });
  }

});

// GET /orcamento/funcao
router.get('/funcao', async (req, res) => {
  
 console.log("🔥 Rota /orcamentos/funcao acessada");

  const idempresa = req.idempresa;

  try {
     
    const resultado = await pool.query(`
      SELECT f.*
      FROM funcao f
      INNER JOIN funcaoempresas fe ON fe.idfuncao = f.idfuncao
      WHERE fe.idempresa = $1
      ORDER BY f.descfuncao
    `, [idempresa]);

    res.json(resultado.rows);

  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao buscar clientes' });
  }

});

// GET /orcamento/equipamentos
router.get('/equipamentos', async (req, res) => {
  
 console.log("🔥 Rota /orcamentos/equipamentos acessada");

  const idempresa = req.idempresa;

  try {
     
    const resultado = await pool.query(`
      SELECT eq.*
      FROM equipamentos eq
      INNER JOIN equipamentoempresas eqe ON eqe.idequip = eq.idequip
      WHERE eqe.idempresa = $1
      ORDER BY eq.descequip
    `, [idempresa]);

    res.json(resultado.rows);

  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao buscar clientes' });
  }

});

// GET /orcamento/suprimentos
router.get('/suprimentos', async (req, res) => {
  
 console.log("🔥 Rota /orcamentos/suprimentos acessada");

  const idempresa = req.idempresa;

  try {
     
    const resultado = await pool.query(`
      SELECT s.*
      FROM suprimentos s
      INNER JOIN suprimentoempresas se ON se.idsup = s.idsup
      WHERE se.idempresa = $1
      ORDER BY s.descsup
    `, [idempresa]);

    res.json(resultado.rows);

  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao buscar clientes' });
  }

});


router.post(
  "/", autenticarToken(), contextoEmpresa,
  verificarPermissao("Orcamentos", "cadastrar"),
  logMiddleware("Orcamentos", {
    buscarDadosAnteriores: async (req) => {
      return { dadosanteriores: null, idregistroalterado: null };
    },
  }),
  
  async (req, res) => {
    const client = await pool.connect();
    console.log("🔥 Rota /orcamentos acessada"); // Removido 'req' para evitar logar objeto grande

    const { idStatus, idCliente, idEvento, idMontagem, // nrOrcamento será gerado pelo DB, não o desestruture daqui se for novo
            infraMontagem, dtiniInfraMontagem, dtfimInfraMontagem,
            dtIniMontagem, dtFimMontagem, dtIniMarcacao, dtFimMarcacao,
            dtIniRealizacao, dtFimRealizacao, dtIniDesmontagem, dtFimDesmontagem,
            dtIniDesmontagemInfra, dtFimDesmontagemInfra, obsItens, obsProposta,
            totGeralVda, totGeralCto, totAjdCusto, lucroBruto, percentLucro,
            desconto, percentDesconto, acrescimo, percentAcrescimo,
            lucroReal, percentLucroReal, vlrCliente, itens } = req.body;

    const idempresa = req.idempresa; // ID da empresa do middleware 'contextoEmpresa'

    try {
      await client.query("BEGIN"); // Inicia a transação

      // 1. Inserir na tabela 'orcamentos'
      // Remova 'nrorcamento' da lista de colunas, o DB irá gerá-lo.
      // E adicione 'nrorcamento' no RETURNING para capturá-lo.
      const insertOrcamentoQuery = `
                INSERT INTO orcamentos (
                    Status, idcliente, idevento, idmontagem,
                    inframontagem, dtiniinframontagem, dtfiminframontagem,
                    dtinimontagem, dtfimmontagem, dtinimarcacao, dtfimmarcacao,
                    dtinirealizacao, dtfimrealizacao, dtinidesmontagem, dtfimdesmontagem,
                    dtiniinfradesmontagem, dtfiminfradesmontagem, obsitens, obsproposta,
                    totgeralvda, totgeralcto, totajdcto, lucrobruto, percentlucro,
                    desconto, percentdesconto, acrescimo, percentacrescimo,
                    lucroreal, percentlucroreal, vlrcliente
                ) VALUES (
                    $1, $2, $3, $4,
                    $5, $6, $7, $8, $9, $10, $11,
                    $12, $13, $14, $15, $16, $17, $18, $19,
                    $20, $21, $22, $23, $24,
                    $25, $26, $27, $28,
                    $29, $30, $31
                ) RETURNING idorcamento, nrorcamento; -- Adicionado nrorcamento aqui!
            `;

      // Os valores também precisam ser ajustados, removendo o nrOrcamento daqui
      const orcamentoValues = [
        idStatus, idCliente, idEvento, idMontagem,
        infraMontagem, dtiniInfraMontagem, dtfimInfraMontagem,
        dtIniMontagem, dtFimMontagem, dtIniMarcacao, dtFimMarcacao,
        dtIniRealizacao, dtFimRealizacao, dtIniDesmontagem, dtFimDesmontagem,
        dtIniDesmontagemInfra, dtFimDesmontagemInfra, obsItens, obsProposta,
        totGeralVda, totGeralCto, totAjdCusto, lucroBruto, percentLucro,
        desconto, percentDesconto, acrescimo, percentAcrescimo,
        lucroReal, percentLucroReal, vlrCliente
      ];

      const resultOrcamento = await client.query(insertOrcamentoQuery, orcamentoValues);
      const { idorcamento, nrorcamento } = resultOrcamento.rows[0]; // Agora desestrutura ambos

      // 2. Inserir na tabela 'orcamentoempresas' para associar o orçamento à empresa
      const insertOrcamentoEmpresasQuery = `
                INSERT INTO orcamentoempresas (idorcamento, idempresa)
                VALUES ($1, $2);
            `;
      await client.query(insertOrcamentoEmpresasQuery, [idorcamento, idempresa]);

      // 3. Inserir os itens na tabela 'orcamentoitens'
      if (itens && itens.length > 0) {
        for (const item of itens) {
          const insertItemQuery = `
                        INSERT INTO orcamentoitens (
                            idorcamento, enviarnaproposta, categoria, qtditens, idfuncao,
                            idequipamento, idsuprimento, produto, qtddias, periododiariasinicio,
                            periododiariasfim, descontoitem, percentdescontoitem, acrescimoitem,
                            percentacrescimoitem, vlrdiaria, totvdadiaria, ctodiaria, totctodiaria,
                            tpajdctoalimentacao, vlrajdctoalimentacao, tpajdctotransporte, vlrajdctotransporte,
                            totajdctoitem, hospedagem, transporte, totgeralitem
                        ) VALUES (
                            $1, $2, $3, $4, $5,
                            $6, $7, $8, $9, $10,
                            $11, $12, $13, $14,
                            $15, $16, $17, $18, $19,
                            $20, $21, $22, $23,
                            $24, $25, $26, $27
                        );
                    `;
          const itemValues = [
            idorcamento, item.enviarnaproposta, item.categoria, item.qtditens, item.idfuncao,
            item.idequipamento, item.idsuprimento, item.produto, item.qtdDias, item.periododiariasinicio,
            item.periododiariasfim, item.descontoitem, item.percentdescontoitem, item.acrescimoitem,
            item.percentacrescimoitem, item.vlrdiaria, item.totvdadiaria, item.ctodiaria, item.totctodiaria,
            item.tpajdctoalimentacao, item.vlrajdctoalimentacao, item.tpajdctotransporte, item.vlrajdctotransporte,
            item.totajdctoitem, item.hospedagem, item.transporte, item.totgeralitem
          ];
          await client.query(insertItemQuery, itemValues);
        }
      }

      await client.query("COMMIT"); // Confirma a transação
      
      // Define os dados para o log middleware
      res.locals.acao = 'cadastrou';
      res.locals.idregistroalterado = idorcamento;
      res.locals.idusuarioAlvo = null; 

      // Retorne o nrOrcamento gerado para o frontend
      res.status(201).json({ message: "Orçamento salvo com sucesso!", id: idorcamento, nrOrcamento: nrorcamento });
    } catch (error) {
      await client.query("ROLLBACK"); // Reverte a transação em caso de erro
      console.error("Erro ao salvar orçamento e seus itens:", error);
      res.status(500).json({ error: "Erro ao salvar orçamento.", detail: error.message });
    } finally {
      client.release(); // Libera o cliente do pool
    }
  }
);

router.put(
  "/:id", autenticarToken(), contextoEmpresa,
  verificarPermissao("Orcamentos", "alterar"), // Permissão para editar
  logMiddleware("Orcamentos", {
    buscarDadosAnteriores: async (req) => {
        const idOrcamento = req.params.id;
        const client = await pool.connect();
        try {
            // Busca os dados do orçamento e seus itens antes da alteração
            const result = await client.query(`
                SELECT
                    o.*,
                    oe.idempresa,
                    json_agg(oi.*) AS itens
                FROM orcamentos o
                JOIN orcamentoempresas oe ON o.idorcamento = oe.idorcamento
                LEFT JOIN orcamentoitens oi ON o.idorcamento = oi.idorcamento
                WHERE o.idorcamento = $1
                GROUP BY o.idorcamento, oe.idempresa;
            `, [idOrcamento]);
            return {
                dadosanteriores: result.rows[0] || null,
                idregistroalterado: idOrcamento
            };
        } catch (error) {
            console.error("Erro ao buscar dados anteriores para log:", error);
            return { dadosanteriores: null, idregistroalterado: idOrcamento };
        } finally {
            client.release();
        }
    },
  }),
  
  async (req, res) => {
    const client = await pool.connect();
    const idOrcamento = req.params.id; // ID do orçamento a ser atualizado
    const { idStatus, idCliente, idEvento, idMontagem, nrOrcamento, // nrOrcamento pode vir para validação, mas não será atualizado se for gerado
            infraMontagem, dtiniInfraMontagem, dtfimInfraMontagem,
            dtIniMontagem, dtFimMontagem, dtIniMarcacao, dtFimMarcacao,
            dtIniRealizacao, dtFimRealizacao, dtIniDesmontagem, dtFimDesmontagem,
            dtIniDesmontagemInfra, dtFimDesmontagemInfra, obsItens, obsProposta,
            totGeralVda, totGeralCto, totAjdCusto, lucroBruto, percentLucro,
            desconto, percentDesconto, acrescimo, percentAcrescimo,
            lucroReal, percentLucroReal, vlrCliente, itens } = req.body;

    const idempresa = req.idempresa; // ID da empresa do middleware 'contextoEmpresa'

    console.log("🔥 Rota PUT /orcamentos/:id acessada para atualizar o orçamento:", req.body);

    try {
      await client.query("BEGIN"); // Inicia a transação

      // 1. Atualizar a tabela 'orcamentos'
      const updateOrcamentoQuery = `
                UPDATE orcamentos SET
                    status = $1, idcliente = $2, idevento = $3, idmontagem = $4,
                    inframontagem = $5, dtiniinframontagem = $6, dtfiminframontagem = $7,
                    dtinimontagem = $8, dtfimmontagem = $9, dtinimarcacao = $10, dtfimmarcacao = $11,
                    dtinirealizacao = $12, dtfimrealizacao = $13, dtinidesmontagem = $14, dtfimdesmontagem = $15,
                    dtiniinfradesmontagem = $16, dtfiminfradesmontagem = $17, obsitens = $18, obsproposta = $19,
                    totgeralvda = $20, totgeralcto = $21, totajdcto = $22, lucrobruto = $23, percentlucro = $24,
                    desconto = $25, percentdesconto = $26, acrescimo = $27, percentacrescimo = $28,
                    lucroreal = $29, percentlucroreal = $30, vlrcliente = $31
                WHERE idorcamento = $32 AND (SELECT idempresa FROM orcamentoempresas WHERE idorcamento = $32) = $33;
            `;

      const orcamentoValues = [
        idStatus, idCliente, idEvento, idMontagem,
        infraMontagem, dtiniInfraMontagem, dtfimInfraMontagem,
        dtIniMontagem, dtFimMontagem, dtIniMarcacao, dtFimMarcacao,
        dtIniRealizacao, dtFimRealizacao, dtIniDesmontagem, dtFimDesmontagem,
        dtIniDesmontagemInfra, dtFimDesmontagemInfra, obsItens, obsProposta,
        totGeralVda, totGeralCto, totAjdCusto, lucroBruto, percentLucro,
        desconto, percentDesconto, acrescimo, percentAcrescimo,
        lucroReal, percentLucroReal, vlrCliente,
        idOrcamento, // $32
        idempresa    // $33
      ];

      const resultUpdateOrcamento = await client.query(updateOrcamentoQuery, orcamentoValues);

      if (resultUpdateOrcamento.rowCount === 0) {
          throw new Error('Orçamento não encontrado ou você não tem permissão para editá-lo.');
      }

      // 2. Lidar com os itens do orçamento (orcamentoitens)
      // Primeiro, busque os IDs dos itens existentes para este orçamento
      const existingItemsResult = await client.query(
          `SELECT idorcamentoitem FROM orcamentoitens WHERE idorcamento = $1`,
          [idOrcamento]
      );
      const existingItemIds = new Set(existingItemsResult.rows.map(row => row.idorcamentoitem));
      const receivedItemIds = new Set(itens.filter(item => item.id).map(item => item.id));

      // Iterar sobre os itens recebidos no payload
      for (const item of itens) {
        if (item.id && existingItemIds.has(item.id)) {
          // Item existente: UPDATE
          const updateItemQuery = `
                        UPDATE orcamentoitens SET
                            enviarnaproposta = $1, categoria = $2, qtditens = $3, idfuncao = $4,
                            idequipamento = $5, idsuprimento = $6, produto = $7, qtddias = $8, periododiariasinicio = $9,
                            periododiariasfim = $10, descontoitem = $11, percentdescontoitem = $12, acrescimoitem = $13,
                            percentacrescimoitem = $14, vlrdiaria = $15, totvdadiaria = $16, ctodiaria = $17, totctodiaria = $18,
                            tpajdctoalimentacao = $19, vlrajdctoalimentacao = $20, tpajdctotransporte = $21, vlrajdctotransporte = $22,
                            totajdctoitem = $23, hospedagem = $24, transporte = $25, totgeralitem = $26
                        WHERE idorcamentoitem = $27 AND idorcamento = $28;
                    `;
          const itemValues = [
            item.enviarnaproposta, item.categoria, item.qtditens, item.idfuncao,
            item.idequipamento, item.idsuprimento, item.produto, item.qtdDias, item.periododiariasinicio,
            item.periododiariasfim, item.descontoitem, item.percentdescontoitem, item.acrescimoitem,
            item.percentacrescimoitem, item.vlrdiaria, item.totvdadiaria, item.ctodiaria, item.totctodiaria,
            item.tpajdctoalimentacao, item.vlrajdctoalimentacao, item.tpajdctotransporte, item.vlrajdctotransporte,
            item.totajdctoitem, item.hospedagem, item.transporte, item.totgeralitem,
            item.id, // $27 (idorcamentoitem)
            idOrcamento // $28 (idorcamento)
          ];
          await client.query(updateItemQuery, itemValues);
        } else {
          // Novo item: INSERT
          const insertItemQuery = `
                        INSERT INTO orcamentoitens (
                            idorcamento, enviarnaproposta, categoria, qtditens, idfuncao,
                            idequipamento, idsuprimento, produto, qtddias, periododiariasinicio,
                            periododiariasfim, descontoitem, percentdescontoitem, acrescimoitem,
                            percentacrescimoitem, vlrdiaria, totvdadiaria, ctodiaria, totctodiaria,
                            tpajdctoalimentacao, vlrajdctoalimentacao, tpajdctotransporte, vlrajdctotransporte,
                            totajdctoitem, hospedagem, transporte, totgeralitem
                        ) VALUES (
                            $1, $2, $3, $4, $5,
                            $6, $7, $8, $9, $10,
                            $11, $12, $13, $14,
                            $15, $16, $17, $18, $19,
                            $20, $21, $22, $23,
                            $24, $25, $26, $27
                        );
                    `;
          const itemValues = [
            idOrcamento, item.enviarnaproposta, item.categoria, item.qtditens, item.idfuncao,
            item.idequipamento, item.idsuprimento, item.produto, item.qtdDias, item.periododiariasinicio,
            item.periododiariasfim, item.descontoitem, item.percentdescontoitem, item.acrescimoitem,
            item.percentacrescimoitem, item.vlrdiaria, item.totvdadiaria, item.ctodiaria, item.totctodiaria,
            item.tpajdctoalimentacao, item.vlrajdctoalimentacao, item.tpajdctotransporte, item.vlrajdctotransporte,
            item.totajdctoitem, item.hospedagem, item.transporte, item.totgeralitem
          ];
          await client.query(insertItemQuery, itemValues);
        }
      }

      // 3. Deletar itens que não foram enviados no payload (removidos pelo usuário)
      const itemsToDelete = Array.from(existingItemIds).filter(id => !receivedItemIds.has(id));
      if (itemsToDelete.length > 0) {
          const deleteItemQuery = `DELETE FROM orcamentoitens WHERE idorcamentoitem = ANY($1) AND idorcamento = $2;`;
          await client.query(deleteItemQuery, [itemsToDelete, idOrcamento]);
      }

      await client.query("COMMIT"); // Confirma a transação
      
      // Define os dados para o log middleware
      res.locals.acao = 'editou'; // Altera a ação para 'editou'
      res.locals.idregistroalterado = idOrcamento;
      res.locals.idusuarioAlvo = null; 

      res.status(200).json({ message: "Orçamento atualizado com sucesso!", id: idOrcamento });
    } catch (error) {
      await client.query("ROLLBACK"); // Reverte a transação em caso de erro
      console.error("Erro ao atualizar orçamento e seus itens:", error);
      res.status(500).json({ error: "Erro ao atualizar orçamento.", detail: error.message });
    } finally {
      client.release(); // Libera o cliente do pool
    }
  }
);





module.exports = router;
