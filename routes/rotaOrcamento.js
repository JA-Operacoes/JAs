const express = require('express');
const router = express.Router();
const pool = require("../db/conexaoDB");
const { autenticarToken, contextoEmpresa } = require('../middlewares/authMiddlewares');
const { verificarPermissao } = require('../middlewares/permissaoMiddleware');
const logMiddleware = require("../middlewares/logMiddleware");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const multer = require('multer');

// Aplica autenticação em todas as rotas
// router.use(autenticarToken);
// router.use(contextoEmpresa);


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
           -- o.idpavilhao,
           -- p.nmpavilhao AS nomepavilhao,
            o.nrorcamento,
            o.inframontagem,
            o.dtinipreevento,
            o.dtfimpreevento,
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
            o.dtiniposevento,
            o.dtfimposevento,
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
            o.vlrimposto,
            o.percentimposto,
            o.vlrcliente,
            o.nomenclatura,
            o.formapagamento,
            o.edicao,
            o.geradoanoposterior,
            o.indicesaplicados,
            o.vlrctofixo,
            o.percentctofixo    
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
        --LEFT JOIN
        --    localmontpavilhao p ON o.idpavilhao = p.idpavilhao
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
            idfuncao,
            idequipamento,
            idsuprimento,
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
            totgeralitem,
            setor
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

      console.log("Buscando pavilhões para o orçamento com ID:", orcamento.idorcamento);

      const queryPavilhoes = `
        SELECT
            op.idpavilhao AS id, -- Renomeado para 'id' para consistência
            p.nmpavilhao AS nomepavilhao
        FROM
            orcamentopavilhoes op
        JOIN
            localmontpavilhao p ON op.idpavilhao = p.idpavilhao
        WHERE
            op.idorcamento = $1;
      `;
      const resultPavilhoes = await client.query(queryPavilhoes, [orcamento.idorcamento]);
      orcamento.pavilhoes = resultPavilhoes.rows; // Anexa os pavilhões ao objeto do orçamento

      console.log("Pavilhões encontrados para o orçamento:", orcamento.pavilhoes.length, "pavilhões.");

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

router.get('/pavilhao', async (req, res) => {
  
 console.log("🔥 Rota /orcamento/pavilhao acessada");

  const idempresa = req.idempresa;
  const idmontagem = req.query.idmontagem; 

  console.log("IDMONTAGEM", idmontagem);

  try {
     
    const resultado = await pool.query(`
      SELECT p.*
      FROM localmontpavilhao p      
      WHERE p.idmontagem = $1
      ORDER BY p.nmpavilhao
    `, [idmontagem]);

    console.log("PAVILHAO", resultado);
    res.json(resultado.rows);

  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao buscar clientes' });
  }

});

router.get('/pavilhao/:id', async (req, res) => {
    console.log("🔥 Rota /orcamentos/pavilhao/:id acessada");

    const idempresa = req.idempresa; // Se idempresa for relevante para filtrar pavilhões individuais
    const idpavilhao = req.params.id; // Pega o ID da URL como um parâmetro de rota

    console.log("IDPAVILHAO", idpavilhao);

    try {
        const resultado = await pool.query(`
            SELECT p.*
            FROM localmontpavilhao p
            WHERE p.idpavilhao = $1 -- Altere para filtrar pelo ID do pavilhão
            ORDER BY p.nmpavilhao
        `, [idpavilhao]);

        if (resultado.rows.length > 0) {
            console.log("PAVILHÃO ENCONTRADO", resultado.rows[0]);
            res.json(resultado.rows[0]); // Retorna apenas o primeiro (e único) pavilhão encontrado
        } else {
            console.log("Nenhum pavilhão encontrado para o ID:", idpavilhao);
            res.status(404).json({ erro: 'Pavilhão não encontrado' });
        }

    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: 'Erro ao buscar pavilhão por ID' });
    }
});

// GET /orcamento/funcao
router.get('/funcao', async (req, res) => {
  
  console.log("🔥 Rota /orcamentos/funcao acessada");

  const idempresa = req.idempresa;

  try {
     
    const resultado = await pool.query(`
      SELECT f.idcategoriafuncao, f.idfuncao, f.descfuncao, f.ativo, f.vdafuncao, f.obsproposta, f.obsfuncao,
       cf.ctofuncaobase, cf.ctofuncaojunior, cf.ctofuncaopleno, cf.ctofuncaosenior, cf.transporte, cf.transpsenior, cf.alimentacao
      FROM funcao f
      INNER JOIN categoriafuncao cf ON f.idcategoriafuncao = cf.idcategoriafuncao
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

router.get('/obsfuncao', async (req, res) => {
    const { nome } = req.query;
    console.log("📥 Requisição recebida para /obsfuncao com nome:", nome);

    if (!nome) {
        console.warn("⚠️ Parâmetro 'nome' não fornecido");
        return res.status(400).json({ erro: "Parâmetro 'nome' é obrigatório" });
    }

    try {
        console.log("🔎 Iniciando consulta no banco de dados...");

        const resultado = await pool.query(
            'SELECT obsfuncao FROM funcao WHERE LOWER(descfuncao) = LOWER($1)',
            [nome]
        );

        console.log("📊 Resultado da query:", resultado.rows);

        if (resultado.rows.length === 0) {
            console.warn("❌ Nenhum resultado encontrado para:", nome);
            return res.status(404).json({ erro: "Função não encontrada" });
        }

        console.log("✅ Observação encontrada:", resultado.rows[0].obsfuncao);
        return res.json({ obsfuncao: resultado.rows[0].obsfuncao });

    } catch (err) {
        console.error("💥 Erro ao buscar função:", err);
        return res.status(500).json({ erro: "Erro interno" });
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
    console.log("🔥 Rota /orcamentos acessada", req.body); // Removido 'req' para evitar logar objeto grande

    const { status, idCliente, idEvento, idMontagem, // nrOrcamento será gerado pelo DB, não o desestruture daqui se for novo
            infraMontagem, dtIniInfraMontagem, dtFimInfraMontagem,
            dtIniMontagem, dtFimMontagem, dtIniMarcacao, dtFimMarcacao,
            dtIniRealizacao, dtFimRealizacao, dtIniDesmontagem, dtFimDesmontagem,
            dtIniDesmontagemInfra, dtFimDesmontagemInfra, obsItens, obsProposta,
            totGeralVda, totGeralCto, totAjdCusto, lucroBruto, percentLucro,
            desconto, percentDesconto, acrescimo, percentAcrescimo,
            lucroReal, percentLucroReal, vlrImposto, percentImposto, vlrCliente, idsPavilhoes, nomenclatura, 
            formaPagamento, edicao, geradoAnoPosterior, dtIniPreEvento, dtFimPreEvento, dtIniPosEvento, dtFimPosEvento,
            avisoReajusteTexto, nrOrcamentoOriginal, vlrCtoFixo, percentCtoFixo, itens } = req.body;

    const idempresa = req.idempresa; 

    if (!idCliente) {
      return res.status(400).json({ 
        error: "Erro de validação.", 
        detail: "O campo 'Cliente' é obrigatório e não pode ser nulo." 
      });
    }
    if (!idEvento) {
      return res.status(400).json({ 
        error: "Erro de validação.", 
        detail: "O campo 'Evento' é obrigatório e não pode ser nulo." 
      });
    }
    if (!idMontagem) {
      return res.status(400).json({ 
        error: "Erro de validação.", 
        detail: "O campo 'Montagem' é obrigatório e não pode ser nulo." 
      });
    }

    try {
      await client.query("BEGIN"); 
      
      const insertOrcamentoQuery = `
                INSERT INTO orcamentos (
                    Status, idcliente, idevento, idmontagem,
                    inframontagem, dtiniinframontagem, dtfiminframontagem,
                    dtinimontagem, dtfimmontagem, dtinimarcacao, dtfimmarcacao,
                    dtinirealizacao, dtfimrealizacao, dtinidesmontagem, dtfimdesmontagem,
                    dtiniinfradesmontagem, dtfiminfradesmontagem, obsitens, obsproposta,
                    totgeralvda, totgeralcto, totajdcto, lucrobruto, percentlucro,
                    desconto, percentdesconto, acrescimo, percentacrescimo,
                    lucroreal, percentlucroreal, vlrimposto, percentimposto, vlrcliente, nomenclatura, 
                    formapagamento, edicao, geradoanoposterior, dtinipreevento, dtfimpreevento, dtiniposevento,
                    dtfimposevento, indicesAplicados, nrorcamentooriginal, vlrctofixo, percentctofixo
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                    $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
                    $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, 
                    $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, 
                    $41, $42, $43, $44, $45
                ) RETURNING idorcamento, nrorcamento; -- Adicionado nrorcamento aqui!
            `;

      // Os valores também precisam ser ajustados, removendo o nrOrcamento daqui
      const orcamentoValues = [
        status, idCliente, idEvento, idMontagem,
        infraMontagem, dtIniInfraMontagem, dtFimInfraMontagem,
        dtIniMontagem, dtFimMontagem, dtIniMarcacao, dtFimMarcacao,
        dtIniRealizacao, dtFimRealizacao, dtIniDesmontagem, dtFimDesmontagem,
        dtIniDesmontagemInfra, dtFimDesmontagemInfra, obsItens, obsProposta,
        totGeralVda, totGeralCto, totAjdCusto, lucroBruto, percentLucro,
        desconto, percentDesconto, acrescimo, percentAcrescimo,
        lucroReal, percentLucroReal, vlrImposto, percentImposto, vlrCliente, nomenclatura, 
        formaPagamento, edicao, geradoAnoPosterior, dtIniPreEvento, dtFimPreEvento, dtIniPosEvento, 
        dtFimPosEvento, avisoReajusteTexto, nrOrcamentoOriginal || null, vlrCtoFixo, percentCtoFixo
      ];

      const resultOrcamento = await client.query(insertOrcamentoQuery, orcamentoValues);
      const { idorcamento, nrorcamento } = resultOrcamento.rows[0]; // Agora desestrutura ambos


      if (nrOrcamentoOriginal) {
          try {
              const updateOriginalQuery = `
                  UPDATE orcamentos
                  SET geradoanoposterior = TRUE
                  WHERE idorcamento = $1
                  RETURNING idorcamento;
              `;
              const originalResult = await client.query(updateOriginalQuery, [nrOrcamentoOriginal]);
              if (originalResult.rowCount === 0) {
                  console.warn(`[WARNING] Orçamento Original ID ${nrOrcamentoOriginal} não encontrado para ser marcado como gerado.`);
                  // A falha em marcar o original não deve impedir o novo orçamento de ser salvo.
              } else {
                  console.log(`[GERAR_ESPELHO] Marcado Original ID ${nrOrcamentoOriginal} como gerado.`);
              }
          } catch (updateError) {
              console.error("Falha Crítica ao marcar o orçamento original:", updateError.message);
              // A falha aqui não faz um ROLLBACK completo, pois está dentro de um try/catch.
              // Para ser 100% seguro, você poderia forçar um throw aqui se esta marcação for CRÍTICA.
          }
      }


      // 2. Inserir na tabela 'orcamentoempresas' para associar o orçamento à empresa
      const insertOrcamentoEmpresasQuery = `
                INSERT INTO orcamentoempresas (idorcamento, idempresa)
                VALUES ($1, $2);
            `;
      await client.query(insertOrcamentoEmpresasQuery, [idorcamento, idempresa]);

      if (idsPavilhoes && Array.isArray(idsPavilhoes) && idsPavilhoes.length > 0) {
        for (const idPavilhao of idsPavilhoes) {
          const insertOrcamentoPavilhaoQuery = `
            INSERT INTO orcamentopavilhoes (idorcamento, idpavilhao)
            VALUES ($1, $2);
          `;
          await client.query(insertOrcamentoPavilhaoQuery, [idorcamento, idPavilhao]);
        }
      }


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
                            totajdctoitem, hospedagem, transporte, totgeralitem, setor
                        ) VALUES (
                            $1, $2, $3, $4, $5,
                            $6, $7, $8, $9, $10,
                            $11, $12, $13, $14,
                            $15, $16, $17, $18, $19,
                            $20, $21, $22, $23,
                            $24, $25, $26, $27, $28
                        );
                    `;
          const itemValues = [
            idorcamento, item.enviarnaproposta, item.categoria, item.qtditens, item.idfuncao,
            item.idequipamento, item.idsuprimento, item.produto, item.qtdDias, item.periododiariasinicio,
            item.periododiariasfim, item.descontoitem, item.percentdescontoitem, item.acrescimoitem,
            item.percentacrescimoitem, item.vlrdiaria, item.totvdadiaria, item.ctodiaria, item.totctodiaria,
            item.tpajdctoalimentacao, item.vlrajdctoalimentacao, item.tpajdctotransporte, item.vlrajdctotransporte,
            item.totajdctoitem, item.hospedagem, item.transporte, item.totgeralitem, item.setor
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



function capitalizarPalavras(texto) {
    if (!texto) {
        return "";
    }
    return texto
        .toLowerCase()
        .replace(/\b\w/g, letra => letra.toUpperCase());
}

router.get("/:nrOrcamento/contrato", 
    autenticarToken(), 
    contextoEmpresa,
    verificarPermissao("Orcamentos", "pesquisar"),
    async (req, res) => {
        const client = await pool.connect();
        try {
            const { nrOrcamento } = req.params;
            const idempresa = req.idempresa;

            // ✅ Etapa 1: Busca dados do orçamento (incluindo o idorcamento)
            const queryOrcamento = `
                SELECT 
                    o.idorcamento, o.nrorcamento, o.vlrcliente, o.nomenclatura AS nomenclatura,
                    o.dtinirealizacao AS inicio_realizacao , o.dtfimrealizacao AS fim_realizacao, o.formapagamento AS forma_pagamento, o.obsproposta AS escopo_servicos,
                    c.razaosocial AS cliente_nome, c.cnpj AS cliente_cnpj, c.inscestadual AS cliente_insc_estadual, c.nmcontato AS cliente_responsavel,
                    c.rua AS cliente_rua, c.numero AS cliente_numero, c.complemento AS cliente_complemento, c.cep AS cliente_cep,
                    e.nmevento AS evento_nome, lm.descmontagem AS local_montagem
                FROM orcamentos o
                JOIN orcamentoempresas oe ON o.idorcamento = oe.idorcamento
                LEFT JOIN clientes c ON o.idcliente = c.idcliente
                LEFT JOIN eventos e ON o.idevento = e.idevento
                LEFT JOIN localmontagem lm ON o.idmontagem = lm.idmontagem
                WHERE o.nrorcamento = $1 AND oe.idempresa = $2
                LIMIT 1
            `;

            const resultOrcamento = await client.query(queryOrcamento, [nrOrcamento, idempresa]);

            if (resultOrcamento.rows.length === 0) {
                return res.status(404).json({ error: "Orçamento não encontrado" });
            }

            const dados = resultOrcamento.rows[0];
            dados.data_assinatura = new Date().toLocaleDateString("pt-BR");
            dados.nr_orcamento = nrOrcamento;
            dados.valor_total = dados.vlrcliente;
            dados.ano_atual = new Date().getFullYear();

            // ✅ Etapa 2: Busca todos os itens do orçamento na tabela orcamentoitens
            const queryItens = `
                SELECT 
                    oi.qtditens AS qtd_itens, 
                    oi.produto AS produto, 
                    oi.setor,
                    oi.qtddias AS qtd_dias,
                    oi.categoria AS categoria,
                    oi.periododiariasinicio AS inicio_datas,
                    oi.periododiariasfim AS fim_datas
                FROM orcamentoitens oi
                LEFT JOIN funcao f ON oi.idfuncao = f.idfuncao
                WHERE oi.idorcamento = $1
            `;
            const resultItens = await client.query(queryItens, [dados.idorcamento]);

            const categoriasMap = {};
            const adicionais = [];

            // ✅ Etapa 3: Processa e organiza os itens
            resultItens.rows.forEach(item => {
                let categoria = item.categoria || "Outros";
                const isLinhaAdicional = item.is_adicional;

                const datasFormatadas = (item.inicio_datas && item.fim_datas) 
                    ? `de: ${new Date(item.inicio_datas).toLocaleDateString("pt-BR")} até: ${new Date(item.fim_datas).toLocaleDateString("pt-BR")}`
                    : "";

                let itemDescricao = `• ${item.qtd_itens} ${capitalizarPalavras(item.produto)}`;

                if (item.setor && item.setor.toLowerCase() !== 'null' && item.setor !== '') {
                    itemDescricao += `, (${item.setor})`;
                }

                if (item.qtd_dias !== '0' && datasFormatadas) {
                    itemDescricao += `, ${item.qtd_dias} Diária(s), ${datasFormatadas}`;
                }

                if (item.qtd_itens > 0) {
                    if (isLinhaAdicional) {
                        adicionais.push(itemDescricao);
                    } else {
                        if (categoria === "Produto(s)") {
                            categoria = "Equipe Operacional";
                        }
                        if (!categoriasMap[categoria]) categoriasMap[categoria] = [];
                        categoriasMap[categoria].push(itemDescricao);
                    }
                }
            });
            
            // ✅ Etapa 4: Adiciona os itens processados ao objeto de dados
            dados.itens_categorias = [];
            const ordemCategorias = ["Equipe Operacional", "Equipamento(s)", "Suprimento(s)"];
            
            // Primeiro, adiciona as categorias na ordem fixa
            ordemCategorias.forEach(categoria => {
                if (categoriasMap[categoria]) {
                    dados.itens_categorias.push({ nome: categoria, itens: categoriasMap[categoria] });
                    delete categoriasMap[categoria];
                }
            });
            
            // Em seguida, adiciona as categorias restantes
            for (const categoria in categoriasMap) {
                if (categoriasMap.hasOwnProperty(categoria)) {
                    dados.itens_categorias.push({ nome: categoria, itens: categoriasMap[categoria] });
                }
            }
            
            dados.adicionais = adicionais;

            console.log("📦 Dados enviados para o Python:", dados);

            const pythonExecutable = "python";
            const pythonScriptPath = path.join(__dirname, "../public/python/Contrato.py");

            const python = spawn(pythonExecutable, [pythonScriptPath]);

            let output = "";
            let errorOutput = "";

            python.stdin.write(JSON.stringify(dados));
            python.stdin.end();

            python.stdout.on("data", (data) => { output += data.toString(); });
            python.stderr.on("data", (data) => { errorOutput += data.toString(); });

            python.on("close", async (code) => {
                if (code !== 0) {
                    console.error("🐍 Erro Python:", errorOutput);
                    return res.status(500).json({ error: "Erro ao gerar contrato (Python)", detail: errorOutput });
                }

                const filePath = output.trim();
                const fileName = path.basename(filePath);
                const downloadUrl = `/orcamentos/download/contratos/${encodeURIComponent(fileName)}`;
                console.log("📝 Saída do Python (output):", output);
                console.log("📄 Caminho do arquivo processado:", filePath);

                if (!fs.existsSync(filePath)) {
                    console.error("❌ Arquivo do contrato não encontrado:", filePath);
                    return res.status(500).json({ error: "Arquivo do contrato não encontrado" });
                }

                  

            //     // ✅ NOVO: Etapa 4: Envia o contrato para o ClickSign e obtém o link de assinatura
            //      // ✅ Etapa 4: Envia o contrato para o ClickSign e obtém o link de assinatura
            //     console.log("🚀 Enviando contrato para o ClickSign...");

            //     // ✅ IMPORTANTE: Substitua esta chave pela sua chave de API válida do ClickSign
            //     const apiKey = "067ad4b9-d536-414f-bce9-90d491d187c6"; 
            //     const clicksignApiUrl = "https://sandbox.clicksign.com/api/v1/documents?access_token=067ad4b9-d536-414f-bce9-90d491d187c6";
                
            //     // ✅ NOVO LOGS: Para depuração do Access Token e do payload
            //     console.log("🔑 Chave de API a ser utilizada:", apiKey);

            //     const fileBase64 = fs.readFileSync(filePath, { encoding: "base64" });
            //     const nomeArquivoDownload = `Contrato_${dados.nomenclatura}_${dados.evento_nome || 'Sem Evento'}.docx`;

            //     const signers = [
            //         {
            //             email: "desenvolvedor1@japromocoes.com.br",
            //             auths: ["email"],
            //             sign_as: "sign",
            //             send_email: true,
            //             name: "JA Promoções",
            //             locale: "empresa_assinatura"
            //         },
            //         {
            //             email: "testemunha_email@dominio.com", // Substitua pelo e-mail da testemunha
            //             auths: ["email"],
            //             sign_as: "witness",
            //             send_email: true, // O tipo de assinatura para testemunha
            //             name: "Carla Lima",
            //             locale:"testemunhaJa_assinatura" // Substitua pelo nome da testemunha
            //         },
            //         {
            //             email: "desenvolvedor@japromocoes.com.br",
            //             auths: ["email"],
            //             sign_as: "sign",
            //             send_email: true,
            //             name: "desenvolvedor Padrao",
            //             locale: "cliente_assinatura"
            //         }
            //     ];

            //     // if (dados.cliente_email) {
            //     //     signers.push({
            //     //         email: dados.cliente_email, 
            //     //         auths: ["email"],
            // //            send_email: true,
            //     //         sign_as: "sign",
            //     //         name: dados.cliente_responsavel || dados.cliente_nome || "Cliente"
            //     //     });
            //     // }
                
            //     const clicksignPayload = {
            //         document: {
            //             path:`/contratos/${nomeArquivoDownload}`,
            //             content_base64: `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${fileBase64}`,
            //             name: nomeArquivoDownload,
            //             auto_close: true,
            //             signers: signers
            //         }
            //     };

            //     console.log("📄 Payload enviado ao ClickSign:", JSON.stringify(clicksignPayload, null, 2));
                
            //     let clicksignResponse;
            //     let clicksignResult;

            //     try {
            //         clicksignResponse = await fetch(clicksignApiUrl, {
            //             method: 'POST',
            //             headers: {
            //                 'Content-Type': 'application/json',
            //                 'Accept': 'application/json',
            //                 'Authorization': `Bearer ${apiKey}`
            //             },
            //             body: JSON.stringify(clicksignPayload)
            //         });
                    
            //         clicksignResult = await clicksignResponse.json();

            //     } catch (fetchError) {
            //         console.error("❌ Erro na requisição para o ClickSign:", fetchError);
            //         return res.status(500).json({ 
            //             error: "Erro na comunicação com a API do ClickSign.", 
            //             details: fetchError.message 
            //         });
            //     }

            //     if (!clicksignResponse.ok) {
            //         if (clicksignResponse.status === 401 || clicksignResponse.status === 403) {
            //             console.error("❌ Erro de autenticação da API do ClickSign:", `Status: ${clicksignResponse.status}, Erro: Token de acesso inválido.`);
            //             return res.status(clicksignResponse.status).json({
            //                 error: "Erro de autenticação: Verifique se sua chave de API está correta e tem permissões para o ambiente de testes (sandbox).",
            //                 details: clicksignResult.errors || 'Token de acesso inválido.'
            //             });
            //         }
            //         console.error("❌ Erro na API do ClickSign:", `Status: ${clicksignResponse.status}`, clicksignResult.errors);
            //         return res.status(clicksignResponse.status).json({ 
            //             error: "Erro na API do ClickSign", 
            //             details: clicksignResult.errors 
            //         });
            //     }

            //     const signingUrl = clicksignResult.document.signing_url|| null;
            //     const documentKey = clicksignResult.document?.key || null;

            //     console.log("✅ Contrato enviado para o ClickSign. Link de assinatura:", signingUrl);

            //     // Salva na tabela contratos_clicksign
            //     await pool.query(
            //         `INSERT INTO contratos_clicksign (doc_key, nr_orcamento, cliente, evento, urlcontrato) 
            //         VALUES ($1, $2, $3, $4, $5)`,
            //         [documentKey, dados.nrorcamento, dados.cliente_nome, dados.evento_nome, signingUrl]
            //     );

                // ✅ Etapa 6: Retorna a URL para o frontend
                    res.status(200).json({
                    success: true,
                    message: "Contrato gerado com sucesso",
                    // signingUrl: signingUrl,
                    fileUrl: downloadUrl
                    // clicksignResult: clicksignResult
                });
            });
            python.on("error", (err) => {
                console.error("❌ Erro ao iniciar Python:", err);
                res.status(500).json({ error: "Erro ao iniciar processo Python", detail: err.message });
            });

        } catch (error) {
            console.error("Erro ao gerar contrato:", error);
            res.status(500).json({ error: "Erro ao gerar contrato", detail: error.message });
        } finally {
            client.release();
        }
    }
);

// 🔽 Força o download do contrato
router.get('/download/contrato/:fileName', autenticarToken(), async (req, res) => {
    try {
        // Decodifica %20 e outros caracteres especiais
        const fileName = decodeURIComponent(req.params.fileName);

        // Caminho absoluto até a pasta upload/contratos
        const filePath = path.resolve(__dirname, '../../uploads/contratos', fileName);

        console.log('📂 Procurando arquivo em:', filePath);

        if (!fs.existsSync(filePath)) {
            console.warn('⚠️ Arquivo não encontrado:', filePath);
            return res.status(404).json({ error: 'Arquivo não encontrado' });
        }

        // Força download com o nome correto
        res.download(filePath, fileName, (err) => {
            if (err) {
                console.error('❌ Erro ao enviar arquivo:', err);
                res.status(500).json({ error: 'Erro ao baixar o arquivo', detail: err.message });
            } else {
                console.log('✅ Arquivo enviado com sucesso:', fileName);
            }
        });
    } catch (error) {
        console.error('❌ Erro no download do contrato:', error);
        res.status(500).json({ error: 'Erro ao baixar o arquivo', detail: error.message });
    }
});



const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'contratos');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuração do armazenamento do Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir); 
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const nrOrcamento = req.query.orcamento || 'desconhecido';
        const safeFileName = `contrato_${nrOrcamento}_${Date.now()}${ext}`;
        cb(null, safeFileName);
    }
});

// Configuração do Upload (filtros e limites)
const upload = multer({
    storage: storage,
    limits: { 
        fileSize: 10 * 1024 * 1024 // Limite de 10MB
    },
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document' // .docx
        ];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            // Rejeita o arquivo, lançando um erro que será pego pelo router.use
            cb(new Error("Tipo de arquivo inválido. Apenas PDF, DOC ou DOCX são permitidos."), false);
        }
    }
});

// ========================================================
// 🛑 ROTA EM MODO DE TESTE (Passo 2: Apenas Multer)
// ========================================================
router.post('/uploadContratoManual', 
    
    // **Middlewares de Auth/Permissão REMOVIDOS TEMPORARIAMENTE**
    // ⚠️ Removido: autenticarToken()
    // ⚠️ Removido: contextoEmpresa
    // ⚠️ Removido: verificarPermissao("Orcamentos", "alterar")
    
    // 🔑 Multer processa o campo 'contrato' do FormData
    upload.single('contrato'), 
    
    async (req, res) => {
        const nrOrcamento = req.query.orcamento;
        const file = req.file;

        console.log('✅ ROTA /orcamentos/uploadContratoManual ATINGIDA (Teste Multer)');

        if (!file) {
            // Se o Multer terminou sem erro, mas não salvou o arquivo.
            return res.status(400).json({ 
                success: false, 
                message: "Nenhum arquivo enviado ou erro no campo 'contrato'."
            });
        }
        
        // **⚠️ LÓGICA DE NEGÓCIO DE CONEXÃO COM DB REMOVIDA PARA TESTE**
        // Substitua pelo seu código real quando o teste for concluído.
        
        console.log(`✅ TESTE: Contrato Manual SALVO (na pasta) como: ${file.filename} para Orçamento ${nrOrcamento}`);

        // ✅ Resposta de Sucesso para o Frontend
        return res.status(200).json({
            success: true,
            message: "Upload do contrato concluído com sucesso (Teste Multer OK).",
            fileName: file.filename, 
            filePath: file.path
        });
    }
);

// ✅ Tratamento de erros do Multer
router.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        // Erros do Multer (ex: FILE_TOO_LARGE)
        return res.status(400).json({ success: false, message: `Erro no upload: ${err.message}` });
    } else if (err) {
        // Erros do fileFilter ou outros erros lançados
        return res.status(400).json({ success: false, message: `Erro no upload: ${err.message || 'Erro desconhecido.'}` });
    }
    next();
});




router.get("/:nrOrcamento/proposta", 
    autenticarToken(), 
    contextoEmpresa,
    verificarPermissao("Orcamentos", "pesquisar"),
    async (req, res) => {
        const client = await pool.connect();
        try {
            const { nrOrcamento } = req.params;
            const idempresa = req.idempresa;

            // ✅ Etapa 1: Busca dados do orçamento
            const queryOrcamento = `
                SELECT 
                    o.idorcamento, o.nrorcamento, o.vlrcliente, o.nomenclatura AS nomenclatura,
                    o.dtinirealizacao AS inicio_realizacao, o.dtfimrealizacao AS fim_realizacao, 
                    o.dtinimarcacao AS inicio_marcacao, o.dtfimmarcacao AS fim_marcacao, 
                    o.dtinimontagem AS inicio_montagem, o.dtfimmontagem AS fim_montagem, 
                    o.dtinidesmontagem AS inicio_desmontagem, o.dtfimdesmontagem AS fim_desmontagem, 
                    o.formapagamento AS forma_pagamento, o.obsproposta AS escopo_servicos,
                    c.razaosocial AS cliente_nome, c.cnpj AS cliente_cnpj, c.inscestadual AS cliente_insc_estadual,
                    c.nmcontato AS cliente_responsavel, c.celcontato AS cliente_celular, c.emailcontato AS cliente_email, c.rua AS cliente_rua, c.numero AS cliente_numero,
                    c.complemento AS cliente_complemento, c.cep AS cliente_cep,
                    e.nmevento AS evento_nome, lm.descmontagem AS local_montagem, STRING_AGG(lp.nmpavilhao, ', ') AS pavilhoes
                FROM orcamentos o
                JOIN orcamentoempresas oe ON o.idorcamento = oe.idorcamento
                LEFT JOIN clientes c ON o.idcliente = c.idcliente
                LEFT JOIN eventos e ON o.idevento = e.idevento
                LEFT JOIN localmontagem lm ON o.idmontagem = lm.idmontagem
                LEFT JOIN orcamentopavilhoes op ON o.idorcamento = op.idorcamento
                LEFT JOIN localmontpavilhao lp ON op.idpavilhao = lp.idpavilhao
                WHERE o.nrorcamento = $1 AND oe.idempresa = $2
                GROUP BY 
                o.idorcamento, o.nrorcamento, o.vlrcliente, o.nomenclatura,
                o.dtinirealizacao, o.dtfimrealizacao, o.formapagamento, o.obsproposta,
                c.razaosocial, c.cnpj, c.inscestadual, c.nmcontato, c.celcontato, 
                c.emailcontato, c.rua, c.numero, c.complemento, c.cep,
                e.nmevento, lm.descmontagem
                LIMIT 1
            `;

            const resultOrcamento = await client.query(queryOrcamento, [nrOrcamento, idempresa]);

            if (resultOrcamento.rows.length === 0) {
                return res.status(404).json({ error: "Orçamento não encontrado" });
            }

            const dados = resultOrcamento.rows[0];
            dados.data_assinatura = new Date().toLocaleDateString("pt-BR");
            dados.nr_orcamento = nrOrcamento;
            dados.valor_total = dados.vlrcliente;
            dados.ano_atual = new Date().getFullYear();

            // ✅ Etapa 2: Busca itens do orçamento
            const queryItens = `
                SELECT 
                    oi.qtditens AS qtd_itens, 
                    oi.produto AS produto, 
                    oi.setor,
                    oi.qtddias AS qtd_dias,
                    oi.categoria AS categoria,
                    oi.periododiariasinicio AS inicio_datas,
                    oi.periododiariasfim AS fim_datas
                FROM orcamentoitens oi
                LEFT JOIN funcao f ON oi.idfuncao = f.idfuncao
                WHERE oi.idorcamento = $1
            `;
            const resultItens = await client.query(queryItens, [dados.idorcamento]);

            const categoriasMap = {};
            const adicionais = [];

            // ✅ Etapa 3: Processa itens
            resultItens.rows.forEach(item => {
                let categoria = item.categoria || "Outros";
                const isLinhaAdicional = item.is_adicional;

                const datasFormatadas = (item.inicio_datas && item.fim_datas) 
                    ? `de: ${new Date(item.inicio_datas).toLocaleDateString("pt-BR")} até: ${new Date(item.fim_datas).toLocaleDateString("pt-BR")}`
                    : "";

                let itemDescricao = `• ${item.qtd_itens} ${capitalizarPalavras(item.produto)}`;

                if (item.setor && item.setor.toLowerCase() !== 'null' && item.setor !== '') {
                    itemDescricao += `, (${item.setor})`;
                }

                if (item.qtd_dias !== '0' && datasFormatadas) {
                    itemDescricao += `, ${item.qtd_dias} Diária(s), ${datasFormatadas}`;
                }

                if (item.qtd_itens > 0) {
                    if (isLinhaAdicional) {
                        adicionais.push(itemDescricao);
                    } else {
                        if (categoria === "Produto(s)") categoria = "Equipe Operacional";
                        if (!categoriasMap[categoria]) categoriasMap[categoria] = [];
                        categoriasMap[categoria].push(itemDescricao);
                    }
                }
            });

            // ✅ Etapa 4: Adiciona itens ao objeto de dados
            dados.itens_categorias = [];
            const ordemCategorias = ["Equipe Operacional", "Equipamento(s)", "Suprimento(s)"];
            ordemCategorias.forEach(categoria => {
                if (categoriasMap[categoria]) {
                    dados.itens_categorias.push({ nome: categoria, itens: categoriasMap[categoria] });
                    delete categoriasMap[categoria];
                }
            });
            for (const categoria in categoriasMap) {
                if (categoriasMap.hasOwnProperty(categoria)) {
                    dados.itens_categorias.push({ nome: categoria, itens: categoriasMap[categoria] });
                }
            }
            dados.adicionais = adicionais;

            console.log("📦 Dados enviados para o Python (Proposta):", dados);

            // ✅ Etapa 5: Executa script Python
            const pythonExecutable = "python";
            const pythonScriptPath = path.join(__dirname, "../public/python/Proposta.py");
            const python = spawn(pythonExecutable, [pythonScriptPath]);

            let output = "";
            let errorOutput = "";

            python.stdin.write(JSON.stringify(dados));
            python.stdin.end();

            python.stdout.setEncoding("utf-8");
            python.stderr.setEncoding("utf-8");

            python.stdout.on("data", data => { output += data.toString(); });
            python.stderr.on("data", data => { errorOutput += data.toString(); });

            python.on("close", code => {
                if (code !== 0) {
                    console.error("🐍 Erro Python Proposta:", errorOutput);
                    return res.status(500).json({ error: "Erro ao gerar proposta (Python)", detail: errorOutput });
                }

                const filePath = output.trim();
                console.log("📝 Proposta gerada:", filePath);

                if (!fs.existsSync(filePath)) {
                    console.error("❌ Erro: Arquivo da proposta não encontrado:", filePath);
                    return res.status(500).json({ error: "Arquivo da proposta não encontrado" });
                }

                const fileName = path.basename(filePath);
                const downloadUrl = `/orcamentos/download/proposta/${encodeURIComponent(fileName)}`;

                res.status(200).json({
                    success: true,
                    message: "Proposta gerada com sucesso",
                    fileUrl: downloadUrl
                });
            });

            python.on("error", err => {
                console.error("❌ Erro ao iniciar o processo Python:", err);
            });

        } catch (error) {
            console.error("Erro ao gerar proposta:", error);
            res.status(500).json({ error: "Erro ao gerar proposta", detail: error.message });
        } finally {
            client.release();
        }
    });

    router.get("/download/proposta/:filename", autenticarToken(), contextoEmpresa, async (req, res) => {
    try {
        const { filename } = req.params;

        // Caminho absoluto do arquivo
        const filePath = path.join(__dirname, "..", "uploads", "Proposta", filename);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: "Arquivo não encontrado" });
        }

        // Força download no navegador
        res.download(filePath, filename, (err) => {
            if (err) {
                console.error("Erro ao enviar arquivo:", err);
                return res.status(500).json({ error: "Erro ao enviar arquivo" });
            }
        });

    } catch (error) {
        console.error("Erro na rota de download:", error);
        res.status(500).json({ error: "Erro interno no servidor" });
    }
});

//atualizar com numero do idorcamento

router.put(
  "/:id", 
  (req, res, next) => {
        console.log("DEBUG: req.body antes de middlewares:", req.body);
        next();
    },
  autenticarToken(), contextoEmpresa,
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
    const { status, idCliente, idEvento, idMontagem, //nrOrcamento, // nrOrcamento pode vir para validação, mas não será atualizado se for gerado
            infraMontagem, dtIniInfraMontagem, dtFimInfraMontagem,
            dtIniMontagem, dtFimMontagem, dtIniMarcacao, dtFimMarcacao,
            dtIniRealizacao, dtFimRealizacao, dtIniDesmontagem, dtFimDesmontagem,
            dtIniDesmontagemInfra, dtFimDesmontagemInfra, obsItens, obsProposta,
            totGeralVda, totGeralCto, totAjdCusto, lucroBruto, percentLucro,
            desconto, percentDesconto, acrescimo, percentAcrescimo,
            lucroReal, percentLucroReal, vlrImposto, percentImposto, vlrCliente, idsPavilhoes, nomenclatura, 
            formaPagamento, edicao, geradoAnoPosterior, dtIniPreEvento, dtFimPreEvento, dtIniPosEvento, 
            dtFimPosEvento, avisoReajusteTexto, vlrCtoFixo, percentCtoFixo, itens } = req.body;

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
                    lucroreal = $29, percentlucroreal = $30, vlrimposto = $31, percentimposto = $32, vlrcliente = $33, 
                    nomenclatura = $34, formapagamento = $35, edicao = $36, geradoanoposterior = $37, dtinipreevento = $38, 
                    dtfimpreevento = $39, dtiniposevento = $40, dtfimposevento = $41, indicesaplicados = $42, vlrctofixo = $43,
                    percentctofixo = $44
                WHERE idorcamento = $45 AND (SELECT idempresa FROM orcamentoempresas WHERE idorcamento = $45) = $46;
            `;

      const orcamentoValues = [
        status, idCliente, idEvento, idMontagem,
        infraMontagem, dtIniInfraMontagem, dtFimInfraMontagem,
        dtIniMontagem, dtFimMontagem, dtIniMarcacao, dtFimMarcacao,
        dtIniRealizacao, dtFimRealizacao, dtIniDesmontagem, dtFimDesmontagem,
        dtIniDesmontagemInfra, dtFimDesmontagemInfra, obsItens, obsProposta,
        totGeralVda, totGeralCto, totAjdCusto, lucroBruto, percentLucro,
        desconto, percentDesconto, acrescimo, percentAcrescimo,
        lucroReal, percentLucroReal, vlrImposto, percentImposto, vlrCliente, nomenclatura,
        formaPagamento, edicao, geradoAnoPosterior, dtIniPreEvento, dtFimPreEvento, dtIniPosEvento, dtFimPosEvento,
        avisoReajusteTexto, vlrCtoFixo, percentCtoFixo,
        idOrcamento, // $36
        idempresa    // $37
      ];

      const resultUpdateOrcamento = await client.query(updateOrcamentoQuery, orcamentoValues);
      console.log("result",resultUpdateOrcamento);

      if (resultUpdateOrcamento.rowCount === 0) {
          throw new Error('Orçamento não encontrado ou você não tem permissão para editá-lo.');
      }

      const currentPavilhoesResult = await client.query(
          `SELECT idpavilhao FROM orcamentopavilhoes WHERE idorcamento = $1;`,
          [idOrcamento]
      );
      const currentPavilhaoIds = new Set(currentPavilhoesResult.rows.map(row => row.idpavilhao));
      
      // 2. Converta a lista de IDs recebida do frontend para um Set para comparação eficiente
      const newPavilhaoIds = new Set(idsPavilhoes && Array.isArray(idsPavilhoes) ? idsPavilhoes : []);

      // 3. Identificar pavilhões a serem REMOVIDOS (estão no DB mas não na nova lista)
      const pavilhoesToRemove = [...currentPavilhaoIds].filter(id => !newPavilhaoIds.has(id));
      if (pavilhoesToRemove.length > 0) {
        for (const idPavilhao of pavilhoesToRemove) {
          await client.query(
            `DELETE FROM orcamentopavilhoes WHERE idorcamento = $1 AND idpavilhao = $2;`,
            [idOrcamento, idPavilhao]
          );
        }
      }

      // 4. Identificar pavilhões a serem ADICIONADOS (estão na nova lista mas não no DB)
      const pavilhoesToAdd = [...newPavilhaoIds].filter(id => !currentPavilhaoIds.has(id));
      if (pavilhoesToAdd.length > 0) {
        for (const idPavilhao of pavilhoesToAdd) {
          await client.query(
            `INSERT INTO orcamentopavilhoes (idorcamento, idpavilhao) VALUES ($1, $2);`,
            [idOrcamento, idPavilhao]
          );
        }
      }
      // 2. Lidar com os itens do orçamento (orcamentoitens)
      // Primeiro, busque os IDs dos itens existentes para este orçamento
      const existingItemsResult = await client.query(
          `SELECT idorcamentoitem FROM orcamentoitens WHERE idorcamento = $1`,
          [idOrcamento]
      );
      const existingItemIds = new Set(existingItemsResult.rows.map(row => row.idorcamentoitem));
      const receivedItemIds = new Set(itens.filter(item => item.id).map(item => item.id));

// Identificar itens a serem deletados (estão no DB mas não foram recebidos no payload)
      // const itemsToDelete = [...existingItemIds].filter(id => !receivedItemIds.has(id));
      // if (itemsToDelete.length > 0) {
      //     for (const itemId of itemsToDelete) {
      //         await client.query(
      //             `DELETE FROM orcamentoitens WHERE idorcamentoitem = $1 AND idorcamento = $2;`,
      //             [itemId, idOrcamento]
      //         );
      //     }
      // }

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
                            totajdctoitem = $23, hospedagem = $24, transporte = $25, totgeralitem = $26, setor = $27
                        WHERE idorcamentoitem = $28 AND idorcamento = $29;
                    `;
          const itemValues = [
            item.enviarnaproposta, item.categoria, item.qtditens, item.idfuncao,
            item.idequipamento, item.idsuprimento, item.produto, item.qtdDias, item.periododiariasinicio,
            item.periododiariasfim, item.descontoitem, item.percentdescontoitem, item.acrescimoitem,
            item.percentacrescimoitem, item.vlrdiaria, item.totvdadiaria, item.ctodiaria, item.totctodiaria,
            item.tpajdctoalimentacao, item.vlrajdctoalimentacao, item.tpajdctotransporte, item.vlrajdctotransporte,
            item.totajdctoitem, item.hospedagem, item.transporte, item.totgeralitem, item.setor,
            item.id, // $28 (idorcamentoitem)
            idOrcamento // $29 (idorcamento)
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
                            totajdctoitem, hospedagem, transporte, totgeralitem, setor
                        ) VALUES (
                            $1, $2, $3, $4, $5,
                            $6, $7, $8, $9, $10,
                            $11, $12, $13, $14,
                            $15, $16, $17, $18, $19,
                            $20, $21, $22, $23,
                            $24, $25, $26, $27, $28
                        );
                    `;
          const itemValues = [
            idOrcamento, item.enviarnaproposta, item.categoria, item.qtditens, item.idfuncao,
            item.idequipamento, item.idsuprimento, item.produto, item.qtdDias, item.periododiariasinicio,
            item.periododiariasfim, item.descontoitem, item.percentdescontoitem, item.acrescimoitem,
            item.percentacrescimoitem, item.vlrdiaria, item.totvdadiaria, item.ctodiaria, item.totctodiaria,
            item.tpajdctoalimentacao, item.vlrajdctoalimentacao, item.tpajdctotransporte, item.vlrajdctotransporte,
            item.totajdctoitem, item.hospedagem, item.transporte, item.totgeralitem, item.setor
          ];
          await client.query(insertItemQuery, itemValues);
        }
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

                // if (dados.cliente_email) {
                //     signers.push({
                //         email: dados.cliente_email, 
                //         auths: ["email"],
            //            send_email: true,
                //         sign_as: "sign",
                //         name: dados.cliente_responsavel || dados.cliente_nome || "Cliente"
                //     });
                // }

router.put(
  "/fechar/:id", 
  autenticarToken(), 
  contextoEmpresa,
  verificarPermissao("Orcamentos", "alterar"), // Reutiliza a permissão de alterar
  logMiddleware("Orcamentos", {
    buscarDadosAnteriores: async (req) => {
      const idOrcamento = req.params.id;
      const client = await pool.connect();
      try {
        const result = await client.query('SELECT status FROM orcamentos WHERE idorcamento = $1', [idOrcamento]);
        return {
          dadosanteriores: result.rows[0] ? { status: result.rows[0].status } : null,
          idregistroalterado: idOrcamento
        };
      } finally {
        client.release();
      }
    },
  }),
  async (req, res) => {
    const client = await pool.connect();
    const idOrcamento = req.params.id;
    const idempresa = req.idempresa;
    console.log("required", req.body);

    try {
      await client.query("BEGIN");
      
      const updateQuery = `
        UPDATE orcamentos
        SET status = 'F'
        WHERE idorcamento = $1
        AND (SELECT idempresa FROM orcamentoempresas WHERE idorcamento = $1) = $2
        AND status != 'F'
        RETURNING idorcamento;
      `;
      const result = await client.query(updateQuery, [idOrcamento, idempresa]);

      if (result.rowCount === 0) {
        throw new Error('Orçamento não encontrado, já está fechado ou você não tem permissão para editá-lo.');
      }
      
      await client.query("COMMIT");
      
      res.locals.acao = 'fechou'; // Nova ação para o log
      res.locals.idregistroalterado = idOrcamento;

      res.status(200).json({ message: "Orçamento fechado com sucesso!" });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Erro ao fechar o orçamento:", error);
      res.status(500).json({ error: "Erro ao fechar o orçamento.", detail: error.message });
    } finally {
      client.release();
    }
  }
);

router.delete(
    "/:idorcamento/itens/:idorcamentoitem",
    autenticarToken(),
    contextoEmpresa,
    verificarPermissao("Orcamentos", "apagar"), // Crie/verifique essa permissão
    logMiddleware("OrcamentoItens", { // Nome da entidade para o log
        buscarDadosAnteriores: async (req) => {
            const { idorcamento, idorcamentoitem } = req.params;
            const client = await pool.connect();
            try {
                const result = await client.query(
                    `SELECT * FROM orcamentoitens WHERE idorcamento = $1 AND idorcamentoitem = $2;`,
                    [idorcamento, idorcamentoitem]
                );
                return {
                    dadosanteriores: result.rows[0] || null,
                    idregistroalterado: idorcamentoitem
                };
            } catch (error) {
                console.error("Erro ao buscar dados anteriores do item para log:", error);
                return { dadosanteriores: null, idregistroalterado: idorcamentoitem };
            } finally {
                client.release();
            }
        },
    }),
    async (req, res) => {
        const client = await pool.connect();
        const { idorcamento, idorcamentoitem } = req.params;
        const idempresa = req.idempresa; // ID da empresa do middleware

        console.log(`🔥 Rota DELETE /orcamentos/${idorcamento}/itens/${idorcamentoitem} acessada.`);

        try {
            await client.query("BEGIN");

            // 1. Verifique se o item pertence ao orçamento E se o orçamento pertence à empresa do usuário
            const checkOwnershipQuery = `
                SELECT 1
                FROM orcamentoitens oi
                JOIN orcamentoempresas oe ON oi.idorcamento = oe.idorcamento
                WHERE oi.idorcamento = $1
                AND oi.idorcamentoitem = $2
                AND oe.idempresa = $3;
            `;
            const ownershipResult = await client.query(checkOwnershipQuery, [idorcamento, idorcamentoitem, idempresa]);

            if (ownershipResult.rows.length === 0) {
                await client.query("ROLLBACK");
                return res.status(403).json({ error: "Permissão negada ou item não encontrado para este orçamento/empresa." });
            }

            // 2. Procede com a deleção do item
            const deleteItemQuery = `
                DELETE FROM orcamentoitens
                WHERE idorcamento = $1 AND idorcamentoitem = $2;
            `;
            const result = await client.query(deleteItemQuery, [idorcamento, idorcamentoitem]);

            if (result.rowCount === 0) {
                await client.query("ROLLBACK");
                return res.status(404).json({ error: "Item do orçamento não encontrado para deletar." });
            }

            await client.query("COMMIT");

            res.locals.acao = 'deletou';
            res.locals.idregistroalterado = idorcamentoitem;
            res.locals.idusuarioAlvo = null; 

            res.status(200).json({ message: "Item do orçamento deletado com sucesso." });

        } catch (error) {
            await client.query("ROLLBACK");
            console.error("Erro ao deletar item do orçamento:", error);
            res.status(500).json({ error: "Erro interno ao deletar item do orçamento.", detail: error.message });
        } finally {
            client.release();
        }
    }
);


router.patch(
    "/:idorcamento/update-status-espelho",
     autenticarToken(),
     contextoEmpresa,
     verificarPermissao("Orcamentos", "alterar"),
     logMiddleware("Orcamentos", {
      buscarDadosAnteriores: async (req) => {
        const idOrcamento = req.params.id;
        const client = await pool.connect();
        try {
          const result = await client.query('SELECT status FROM orcamentos WHERE idorcamento = $1', [idOrcamento]);
          return {
            dadosanteriores: result.rows[0] ? { status: result.rows[0].status } : null,
            idregistroalterado: idOrcamento
          };
        } finally {
          client.release();
        }
      },
    }),
    async (req, res) => {
        // 🛑 PONTO A: Logo na entrada da função
        console.log("[BACKEND PATCH] 0. Rota alcançada."); 

        const client = await pool.connect();
        try {
            // 🛑 PONTO B: Após conectar ao pool
            console.log("[BACKEND PATCH] 1. Conexão com o DB estabelecida.");

            const idempresa = req.idempresa;
            const idorcamento = parseInt(req.params.idorcamento);
            const { geradoAnoPosterior } = req.body; 

            // Logando os dados recebidos, crucial para validação
            console.log(`[BACKEND PATCH] Recebidos: ID:${idorcamento}, Empresa:${idempresa}, GeradoAnoPosterior:${geradoAnoPosterior}`);
            
            // Validação
            if (isNaN(idorcamento) || idorcamento <= 0) {
                return res.status(400).json({ error: "ID do Orçamento inválido." });
            }
            if (typeof geradoAnoPosterior !== 'boolean') {
                return res.status(400).json({ error: "Valor 'geradoanoposterior' deve ser booleano (true/false)." });
            }

            await client.query("BEGIN");
            // 🛑 PONTO C: Após iniciar a transação
            console.log("[BACKEND PATCH] 2. Transação iniciada (BEGIN).");
            
            // 1. Verifica se o orçamento existe
            const checkQuery = `
                SELECT orc.idorcamento 
                FROM orcamentos orc
                INNER JOIN orcamentoempresas orcemp ON orc.idorcamento = orcemp.idorcamento
                WHERE orc.idorcamento = $1 AND orcemp.idempresa = $2;
            `;
            const checkResult = await client.query(checkQuery, [idorcamento, idempresa]);

            if (checkResult.rows.length === 0) {
                await client.query("ROLLBACK");
                // Aqui uma resposta 404 é enviada. O código continua.
                return res.status(404).json({ error: "Orçamento não encontrado ou permissão negada." });
            }

            // 🛑 PONTO D: Antes de executar o UPDATE
            console.log("[BACKEND PATCH] 3. Orçamento verificado e pronto para UPDATE.");

            // 2. Atualiza o campo específico
            const updateQuery = `
              UPDATE orcamentos
              SET geradoanoposterior = $1
              WHERE idorcamento = $2;
            `
            const result = await client.query(updateQuery, [geradoAnoPosterior, idorcamento]);

console.log("[BACKEND PATCH] Query Bruta (visível):", updateQuery);
console.log("[BACKEND PATCH] Query Bruta (sem espaços):", updateQuery.replace(/\s/g, '_'));

            if (result.rowCount === 0) {
                await client.query("ROLLBACK");
                // Aqui uma resposta 404 é enviada. O código continua.
                return res.status(404).json({ error: "Orçamento não foi atualizado." });
            }

            await client.query("COMMIT");

            // 🛑 PONTO E: Antes de enviar a resposta final
            console.log("[BACKEND PATCH] 4. COMMIT OK. Enviando resposta 200.");
            
            // Configuração para o log (se o logMiddleware estiver ativo)
            res.locals.acao = 'alterou';
            // ... restante da configuração de res.locals ...

            res.status(200).json({ message: "Status de espelhamento do orçamento atualizado com sucesso." });

        } catch (error) {
  // 🛑 NOVO LOG PARA SABER SE CAIU NO CATCH
            console.error("[BACKEND PATCH] !!! CAIU NO CATCH !!! Erro ao atualizar status:", error.message);
            

            // ...
        } finally {
            // 🛑 PONTO F: Última linha executada
            console.log("[BACKEND PATCH] 5. Liberando cliente do pool.");
            client.release();
        }
    }
);


router.patch(
    // Novo endpoint: /orcamentos/:idorcamento/status
    "/:idorcamento/status",
    autenticarToken(),
    contextoEmpresa,
    verificarPermissao("Orcamentos", "alterar"),
    logMiddleware("Orcamentos", {
        buscarDadosAnteriores: async (req) => {
            const idOrcamento = req.params.idorcamento;
            const client = await pool.connect();
            try {
                // Busca o status anterior para o log
                const result = await client.query('SELECT status FROM orcamentos WHERE idorcamento = $1', [idOrcamento]);
                return {
                    dadosanteriores: result.rows[0] ? { status: result.rows[0].status } : null,
                    idregistroalterado: idOrcamento
                };
            } finally {
                client.release();
            }
        },
    }),
    async (req, res) => {
        const client = await pool.connect();
        const idempresa = req.idempresa;
        const idorcamento = parseInt(req.params.idorcamento);
        // Recebe o novo status do corpo da requisição
        const { status } = req.body; 

        console.log(`[BACKEND PATCH] Tentando atualizar o status do Orçamento ${idorcamento} para: ${status}`);

        try {
            if (isNaN(idorcamento) || idorcamento <= 0) {
                return res.status(400).json({ error: "ID do Orçamento inválido." });
            }
            if (!status || typeof status !== 'string') {
                return res.status(400).json({ error: "O campo 'status' é obrigatório e deve ser uma string." });
            }

            await client.query("BEGIN");
            
            // Query para atualizar APENAS o campo status.
            // A condição de subconsulta garante que o orçamento pertence à empresa do usuário.
            const updateQuery = `
                UPDATE orcamentos
                SET status = $1
                WHERE idorcamento = $2
                AND (SELECT idempresa FROM orcamentoempresas WHERE idorcamento = $2) = $3
                RETURNING idorcamento;
            `;
            
            const result = await client.query(updateQuery, [status, idorcamento, idempresa]);

            if (result.rowCount === 0) {
                await client.query("ROLLBACK");
                return res.status(404).json({ error: "Orçamento não encontrado ou permissão negada." });
            }

            await client.query("COMMIT");
            
            // Configuração para o log (logMiddleware)
            res.locals.acao = 'alterou o status';
            res.locals.idregistroalterado = idorcamento;

            res.status(200).json({ success: true, message: `Status do orçamento atualizado para '${status}' com sucesso.` });

        } catch (error) {
            await client.query("ROLLBACK");
            console.error("❌ Erro ao atualizar o status do orçamento:", error.message);
            res.status(500).json({ error: "Erro interno ao atualizar o status do orçamento.", detail: error.message });
        } finally {
            client.release();
        }
    }
);
module.exports = router;