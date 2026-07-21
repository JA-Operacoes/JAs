const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB");
const {
  autenticarToken,
  contextoEmpresa,
} = require("../middlewares/authMiddlewares");
const { verificarPermissao } = require("../middlewares/permissaoMiddleware");
const logMiddleware = require("../middlewares/logMiddleware");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const multer = require("multer");

// Aplica autenticação em todas as rotas
// router.use(autenticarToken);
// router.use(contextoEmpresa);

// GET todas ou por id
// C:\Users\JA\Ja System - Teste\ja\routes\rotaOrcamento.js

router.get(
  "/",
  autenticarToken(),
  contextoEmpresa,
  verificarPermissao("Orcamentos", "pesquisar"), // Permissão para visualizar orçamentos
  async (req, res) => {
    const client = await pool.connect();
    try {
      const idempresa = req.idempresa; // ID da empresa do middleware 'contextoEmpresa'
      const { nrOrcamento } = req.query; // Pega apenas o nrOrcamento

      let query = `
        SELECT
            o.idorcamento, o.status, o.idcliente, c.nmfantasia AS nomecliente,
            o.idevento, e.nmevento AS nomeevento, o.idmontagem,
            lm.descmontagem AS nomelocalmontagem, lm.ufmontagem, o.nrorcamento,
            o.inframontagem, o.dtinipreevento, o.dtfimpreevento,
            o.dtiniinframontagem, o.dtfiminframontagem, o.dtinimarcacao,
            o.dtfimmarcacao, o.dtinimontagem, o.dtfimmontagem,          
            o.dtinirealizacao, o.dtfimrealizacao,            
            o.dtinidesmontagem, o.dtfimdesmontagem,
            o.dtiniinfradesmontagem, o.dtfiminfradesmontagem,
            o.dtiniposevento, o.dtfimposevento, o.obsitens, o.obsproposta,
            o.totgeralvda, o.totgeralcto, o.totajdcto, o.lucrobruto,
            o.percentlucro, o.desconto, o.percentdesconto, o.acrescimo,
            o.percentacrescimo, o.lucroreal, o.percentlucroreal,
            o.vlrimposto, o.percentimposto, o.vlrcliente, o.nomenclatura,
            o.formapagamento, o.edicao, o.geradoanoposterior,
            o.indicesaplicados, o.vlrctofixo, o.percentctofixo,
            o.contratourl, o.contratarstaff  
        FROM orcamentos o
        JOIN orcamentoempresas oe ON o.idorcamento = oe.idorcamento
        LEFT JOIN clientes c ON o.idcliente = c.idcliente
        LEFT JOIN eventos e ON o.idevento = e.idevento
        LEFT JOIN localmontagem lm ON o.idmontagem = lm.idmontagem
        WHERE oe.idempresa = $1 
      `;
      
      const valuesOrcamento = [idempresa];
      let paramIndex = 2;

      if (nrOrcamento) {
        query += ` AND o.nrorcamento = $${paramIndex++}`;
        valuesOrcamento.push(nrOrcamento);
      } else {
        return res.status(400).json({ error: "Número do orçamento é obrigatório." });
      }

      query += ` ORDER BY o.nrorcamento DESC LIMIT 1;`;

      const resultOrcamento = await client.query(query, valuesOrcamento);

      if (resultOrcamento.rows.length === 0) {
        return res.status(404).json({ message: "Orçamento não encontrado." });
      }

      const orcamento = resultOrcamento.rows[0];

      // --- BUSCA DOS ITENS (ATUALIZADA COM VLRBASE) ---
      const queryItens = `
        SELECT
            idorcamentoitem, idorcamento, enviarnaproposta, categoria,
            produto, idfuncao, idequipamento, idsuprimento,
            qtditens, qtddias, periododiariasinicio, periododiariasfim,
            vlrbase, -- <-- ADICIONADO AQUI
            vlrdiaria, totvdadiaria, ctodiaria, totctodiaria,
            descontoitem, percentdescontoitem, acrescimoitem, percentacrescimoitem,
            tpajdctoalimentacao, vlrajdctoalimentacao, tpajdctotransporte,
            vlrajdctotransporte, totajdctoitem, hospedagem, transporte,
            totgeralitem, setor, cachefechado, adicional, idsolicitacao, obsbonificado
        FROM orcamentoitens
        WHERE idorcamento = $1
        ORDER BY idorcamentoitem ASC;
      `;
      
      const resultItens = await client.query(queryItens, [orcamento.idorcamento]);
      console.log("✅ Itens do orçamento encontrados:", resultItens.rows.length);
      orcamento.itens = resultItens.rows;

      // --- BUSCA DOS PAVILHÕES ---
      const queryPavilhoes = `
        SELECT op.idpavilhao AS id, p.nmpavilhao AS nomepavilhao
        FROM orcamentopavilhoes op
        JOIN localmontpavilhao p ON op.idpavilhao = p.idpavilhao
        WHERE op.idorcamento = $1;
      `;
      const resultPavilhoes = await client.query(queryPavilhoes, [orcamento.idorcamento]);
      orcamento.pavilhoes = resultPavilhoes.rows;

      res.status(200).json(orcamento);
    } catch (error) {
      console.error("Erro ao buscar orçamento:", error);
      res.status(500).json({ error: "Erro ao buscar orçamento.", detail: error.message });
    } finally {
      client.release();
    }
  }
);

// GET /orcamento/clientes
router.get("/clientes", async (req, res) => {
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
        [idempresa, `%${nmFantasia}%`]
      );
      console.log(
        "✅ Consulta por nmFantasia retornou:",
        result.rows.length,
        "linhas."
      );
      return result.rows.length
        ? res.json(result.rows[0])
        : res.status(404).json({ message: "Cliente não encontrado" });
    } else {
      console.log("🔍 Buscando todos os clientes para a empresa:", idempresa);
      const result = await pool.query(
        `SELECT c.* 
        FROM clientes c
        INNER JOIN clienteempresas ce ON ce.idcliente = c.idcliente
        WHERE ce.idempresa = $1 ORDER BY nmfantasia`,
        [idempresa]
      );
      console.log(
        "✅ Consulta de todos os clientes retornou:",
        result.rows.length,
        "linhas."
      );
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
router.get("/eventos", async (req, res) => {
  console.log("🔥 Rota /orcamentos/eventos acessada");

  const idempresa = req.idempresa;

  try {
    const resultado = await pool.query(
      `
      SELECT e.*
      FROM eventos e
      INNER JOIN eventoempresas ee ON ee.idevento = e.idevento
      WHERE ee.idempresa = $1
      ORDER BY e.nmevento
    `,
      [idempresa]
    );

    res.json(resultado.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro ao buscar clientes" });
  }
});

// GET /orcamento/localmontagem
router.get("/localmontagem", async (req, res) => {
  console.log("🔥 Rota /orcamentos/localmontagem acessada");

  const idempresa = req.idempresa;

  try {
    const resultado = await pool.query(
      `
      SELECT l.*
      FROM localmontagem l
      INNER JOIN localmontempresas le ON le.idmontagem = l.idmontagem
      WHERE le.idempresa = $1
      ORDER BY l.descmontagem
    `,
      [idempresa]
    );

    res.json(resultado.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro ao buscar clientes" });
  }
});

router.get("/pavilhao", async (req, res) => {
  console.log("🔥 Rota /orcamento/pavilhao acessada");

  const idempresa = req.idempresa;
  const idmontagem = req.query.idmontagem;

  console.log("IDMONTAGEM", idmontagem);

  try {
    const resultado = await pool.query(
      `
      SELECT p.*
      FROM localmontpavilhao p      
      WHERE p.idmontagem = $1
      ORDER BY p.nmpavilhao
    `,
      [idmontagem]
    );

    console.log("PAVILHAO", resultado);
    res.json(resultado.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro ao buscar clientes" });
  }
});

router.get("/pavilhao/:id", async (req, res) => {
  console.log("🔥 Rota /orcamentos/pavilhao/:id acessada");

  const idempresa = req.idempresa; // Se idempresa for relevante para filtrar pavilhões individuais
  const idpavilhao = req.params.id; // Pega o ID da URL como um parâmetro de rota

  console.log("IDPAVILHAO", idpavilhao);

  try {
    const resultado = await pool.query(
      `
            SELECT p.*
            FROM localmontpavilhao p
            WHERE p.idpavilhao = $1 -- Altere para filtrar pelo ID do pavilhão
            ORDER BY p.nmpavilhao
        `,
      [idpavilhao]
    );

    if (resultado.rows.length > 0) {
      console.log("PAVILHÃO ENCONTRADO", resultado.rows[0]);
      res.json(resultado.rows[0]); // Retorna apenas o primeiro (e único) pavilhão encontrado
    } else {
      console.log("Nenhum pavilhão encontrado para o ID:", idpavilhao);
      res.status(404).json({ erro: "Pavilhão não encontrado" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro ao buscar pavilhão por ID" });
  }
});

// GET /orcamento/funcao
router.get("/funcao", async (req, res) => {
  console.log("🔥 Rota /orcamentos/funcao acessada");

  const idempresa = req.idempresa;

  try {
    const resultado = await pool.query(
      `
      SELECT f.idcategoriafuncao, f.idfuncao, f.descfuncao, f.ativo, f.vdafuncao, f.obsproposta, f.obsfuncao,
       cf.ctofuncaobase, cf.ctofuncaojunior, cf.ctofuncaopleno, cf.ctofuncaosenior, cf.transporte, cf.transpsenior, cf.alimentacao
      FROM funcao f
      INNER JOIN categoriafuncao cf ON f.idcategoriafuncao = cf.idcategoriafuncao
      INNER JOIN funcaoempresas fe ON fe.idfuncao = f.idfuncao
      WHERE fe.idempresa = $1
      ORDER BY f.descfuncao
    `,
      [idempresa]
    );

    res.json(resultado.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro ao buscar clientes" });
  }
});

// GET /orcamento/equipamentos
router.get("/equipamentos", async (req, res) => {
  console.log("🔥 Rota /orcamentos/equipamentos acessada");

  const idempresa = req.idempresa;

  try {
    const resultado = await pool.query(
      `
      SELECT eq.*
      FROM equipamentos eq
      INNER JOIN equipamentoempresas eqe ON eqe.idequip = eq.idequip
      WHERE eqe.idempresa = $1
      ORDER BY eq.descequip
    `,
      [idempresa]
    );

    res.json(resultado.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro ao buscar clientes" });
  }
});

// GET /orcamento/suprimentos
router.get("/suprimentos", async (req, res) => {
  console.log("🔥 Rota /orcamentos/suprimentos acessada");

  const idempresa = req.idempresa;

  try {
    const resultado = await pool.query(
      `
      SELECT s.*
      FROM suprimentos s
      INNER JOIN suprimentoempresas se ON se.idsup = s.idsup
      WHERE se.idempresa = $1
      ORDER BY s.descsup
    `,
      [idempresa]
    );

    res.json(resultado.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro ao buscar clientes" });
  }
});

router.get("/obsfuncao", async (req, res) => {
  const { nome } = req.query;
  console.log("📥 Requisição recebida para /obsfuncao com nome:", nome);

  if (!nome) {
    console.warn("⚠️ Parâmetro 'nome' não fornecido");
    return res.status(400).json({ erro: "Parâmetro 'nome' é obrigatório" });
  }

  try {
    console.log("🔎 Iniciando consulta no banco de dados...");

    const resultado = await pool.query(
      "SELECT obsfuncao FROM funcao WHERE LOWER(descfuncao) = LOWER($1)",
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
  "/",
  autenticarToken(),
  contextoEmpresa,
  verificarPermissao("Orcamentos", "cadastrar"),
  logMiddleware("Orcamentos", {
    buscarDadosAnteriores: async (req) => {
      return { dadosanteriores: null, idregistroalterado: null };
    },
  }),

  async (req, res) => {
    const client = await pool.connect();
    console.log("🔥 Rota /orcamentos acessada", req.body); // Removido 'req' para evitar logar objeto grande

    const {
      status,
      idCliente,
      idEvento,
      idMontagem, // nrOrcamento será gerado pelo DB, não o desestruture daqui se for novo
      infraMontagem,
      dtIniInfraMontagem,
      dtFimInfraMontagem,
      dtIniMontagem,
      dtFimMontagem,
      dtIniMarcacao,
      dtFimMarcacao,
      dtIniRealizacao,
      dtFimRealizacao,
      dtIniDesmontagem,
      dtFimDesmontagem,
      dtIniDesmontagemInfra,
      dtFimDesmontagemInfra,
      obsItens,
      obsProposta,
      totGeralVda,
      totGeralCto,
      totAjdCusto,
      lucroBruto,
      percentLucro,
      desconto,
      percentDesconto,
      acrescimo,
      percentAcrescimo,
      lucroReal,
      percentLucroReal,
      vlrImposto,
      percentImposto,
      vlrCliente,
      idsPavilhoes,
      nomenclatura,
      formaPagamento,
      edicao,
      geradoAnoPosterior,
      dtIniPreEvento,
      dtFimPreEvento,
      dtIniPosEvento,
      dtFimPosEvento,
      avisoReajusteTexto,
      nrOrcamentoOriginal,
      vlrCtoFixo,
      percentCtoFixo,
      itens,
      contratarstaff
    } = req.body;

    const idempresa = req.idempresa;

    if (!idCliente) {
      return res.status(400).json({
        error: "Erro de validação.",
        detail: "O campo 'Cliente' é obrigatório e não pode ser nulo.",
      });
    }
    if (!idEvento) {
      return res.status(400).json({
        error: "Erro de validação.",
        detail: "O campo 'Evento' é obrigatório e não pode ser nulo.",
      });
    }
    if (!idMontagem) {
      return res.status(400).json({
        error: "Erro de validação.",
        detail: "O campo 'Montagem' é obrigatório e não pode ser nulo.",
      });
    }
    if (!edicao) {
      return res.status(400).json({
        error: "Erro de validação.",
        detail: "O campo 'Edição' é obrigatório e não pode ser nulo.",
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
                    dtfimposevento, indicesAplicados, nrorcamentooriginal, vlrctofixo, percentctofixo, contratarstaff
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                    $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
                    $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, 
                    $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, 
                    $41, $42, $43, $44, $45, $46
                ) RETURNING idorcamento, nrorcamento; -- Adicionado nrorcamento aqui!
            `;

      // Os valores também precisam ser ajustados, removendo o nrOrcamento daqui
      const orcamentoValues = [
        status,
        idCliente,
        idEvento,
        idMontagem,
        infraMontagem,
        dtIniInfraMontagem,
        dtFimInfraMontagem,
        dtIniMontagem,
        dtFimMontagem,
        dtIniMarcacao,
        dtFimMarcacao,
        dtIniRealizacao,
        dtFimRealizacao,
        dtIniDesmontagem,
        dtFimDesmontagem,
        dtIniDesmontagemInfra,
        dtFimDesmontagemInfra,
        obsItens,
        obsProposta,
        totGeralVda,
        totGeralCto,
        totAjdCusto,
        lucroBruto,
        percentLucro,
        desconto,
        percentDesconto,
        acrescimo,
        percentAcrescimo,
        lucroReal,
        percentLucroReal,
        vlrImposto,
        percentImposto,
        vlrCliente,
        nomenclatura,
        formaPagamento,
        edicao,
        geradoAnoPosterior,
        dtIniPreEvento,
        dtFimPreEvento,
        dtIniPosEvento,
        dtFimPosEvento,
        avisoReajusteTexto,
        nrOrcamentoOriginal || null,
        vlrCtoFixo,
        percentCtoFixo,
        contratarstaff
      ];

      const resultOrcamento = await client.query(
        insertOrcamentoQuery,
        orcamentoValues
      );
      const { idorcamento, nrorcamento } = resultOrcamento.rows[0]; // Agora desestrutura ambos

      if (nrOrcamentoOriginal) {
        try {
          const updateOriginalQuery = `
                  UPDATE orcamentos
                  SET geradoanoposterior = TRUE
                  WHERE idorcamento = $1
                  RETURNING idorcamento;
              `;
          const originalResult = await client.query(updateOriginalQuery, [
            nrOrcamentoOriginal,
          ]);
          if (originalResult.rowCount === 0) {
            console.warn(
              `[WARNING] Orçamento Original ID ${nrOrcamentoOriginal} não encontrado para ser marcado como gerado.`
            );
            // A falha em marcar o original não deve impedir o novo orçamento de ser salvo.
          } else {
            console.log(
              `[GERAR_ESPELHO] Marcado Original ID ${nrOrcamentoOriginal} como gerado.`
            );
          }
        } catch (updateError) {
          console.error(
            "Falha Crítica ao marcar o orçamento original:",
            updateError.message
          );
          // A falha aqui não faz um ROLLBACK completo, pois está dentro de um try/catch.
          // Para ser 100% seguro, você poderia forçar um throw aqui se esta marcação for CRÍTICA.
        }
      }

      // 2. Inserir na tabela 'orcamentoempresas' para associar o orçamento à empresa
      const insertOrcamentoEmpresasQuery = `
                INSERT INTO orcamentoempresas (idorcamento, idempresa)
                VALUES ($1, $2);
            `;
      await client.query(insertOrcamentoEmpresasQuery, [
        idorcamento,
        idempresa,
      ]);

      if (
        idsPavilhoes &&
        Array.isArray(idsPavilhoes) &&
        idsPavilhoes.length > 0
      ) {
        for (const idPavilhao of idsPavilhoes) {
          const insertOrcamentoPavilhaoQuery = `
            INSERT INTO orcamentopavilhoes (idorcamento, idpavilhao)
            VALUES ($1, $2);
          `;
          await client.query(insertOrcamentoPavilhaoQuery, [
            idorcamento,
            idPavilhao,
          ]);
        }
      }

      // 3. Inserir os itens na tabela 'orcamentoitens'
      if (itens && itens.length > 0) {
        for (const item of itens) {
          // Se este for um orçamento gerado para o ano seguinte (espelho),
          // re-hidratar valores canônicos (VDA / CTO) a partir das tabelas mestres
          // para garantir que o espelho use os valores atuais do sistema.
          if (geradoAnoPosterior === true || nrOrcamentoOriginal) {
            try {
              // Valores iniciais vindos do payload (fallback)
              let vlrdiaria = parseFloat(item.vlrdiaria || 0) || 0;
              let ctodiaria = parseFloat(item.ctodiaria || 0) || 0;

              // 1) Função
              if (item.idfuncao) {
                const funcRes = await client.query(
                  `SELECT f.vdafuncao AS vda, cf.ctofuncaobase AS cto
                   FROM funcao f
                   LEFT JOIN categoriafuncao cf ON cf.idcategoriafuncao = f.idcategoriafuncao
                   WHERE f.idfuncao = $1 LIMIT 1`,
                  [item.idfuncao]
                );
                if (funcRes.rows && funcRes.rows[0]) {
                  vlrdiaria = parseFloat(funcRes.rows[0].vda) || vlrdiaria;
                  ctodiaria = parseFloat(funcRes.rows[0].cto) || ctodiaria;
                }
              }

              // 2) Equipamento
              else if (item.idequipamento) {
                const eqRes = await client.query(
                  `SELECT e.vdaequip AS vda, e.ctoequip AS cto
                   FROM equipamentos e
                   INNER JOIN equipamentoempresas ee ON ee.idequip = e.idequip
                   WHERE e.idequip = $1 AND ee.idempresa = $2 LIMIT 1`,
                  [item.idequipamento, idempresa]
                );
                if (eqRes.rows && eqRes.rows[0]) {
                  vlrdiaria = parseFloat(eqRes.rows[0].vda) || vlrdiaria;
                  ctodiaria = parseFloat(eqRes.rows[0].cto) || ctodiaria;
                }
              }

              // 3) Suprimento
              else if (item.idsuprimento) {
                const supRes = await client.query(
                  `SELECT s.vdasup AS vda, s.ctosup AS cto
                   FROM suprimentos s
                   INNER JOIN suprimentoempresas se ON se.idsup = s.idsup
                   WHERE s.idsup = $1 AND se.idempresa = $2 LIMIT 1`,
                  [item.idsuprimento, idempresa]
                );
                if (supRes.rows && supRes.rows[0]) {
                  vlrdiaria = parseFloat(supRes.rows[0].vda) || vlrdiaria;
                  ctodiaria = parseFloat(supRes.rows[0].cto) || ctodiaria;
                }
              }

              // Recalcular totais com base nas quantidades (mantendo desconto/acréscimo do item)
              const qtdItens = parseFloat(item.qtditens || item.qtdItens || 0) || 0;
              const qtdDias = parseFloat(item.qtddias || item.qtdDias || 0) || 0;
              const descontoItem = parseFloat(item.descontoitem || 0) || 0;
              const acrescimoItem = parseFloat(item.acrescimoitem || 0) || 0;

              const totvdadiaria = Math.round((vlrdiaria * qtdItens * qtdDias + acrescimoItem - descontoItem) * 100) / 100;
              const totctodiaria = Math.round((ctodiaria * qtdItens * qtdDias) * 100) / 100;
              const vlrajd = parseFloat(item.vlrajdctoalimentacao || 0) + parseFloat(item.vlrajdctotransporte || 0);
              const totajdctoitem = Math.round(vlrajd * qtdItens * qtdDias * 100) / 100;
              const totgeralitem = Math.round((totctodiaria + totajdctoitem) * 100) / 100;

              // Atualiza o objeto item para ser inserido com valores atualizados
              item.vlrdiaria = vlrdiaria;
              item.ctodiaria = ctodiaria;
              item.totvdadiaria = totvdadiaria;
              item.totctodiaria = totctodiaria;
              item.totajdctoitem = totajdctoitem;
              item.totgeralitem = totgeralitem;
            } catch (err) {
              console.warn('[GERAR_ESPELHO] Falha ao re-hidratar valores canônicos para item:', err.message);
              // Em caso de falha, prossegue com os valores já presentes no item
            }
          }

          const insertItemQuery = `
                        INSERT INTO orcamentoitens (
                            idorcamento, enviarnaproposta, categoria, qtditens, idfuncao,
                            idequipamento, idsuprimento, produto, qtddias, periododiariasinicio,
                            periododiariasfim, descontoitem, percentdescontoitem, acrescimoitem,
                            percentacrescimoitem, vlrdiaria, totvdadiaria, ctodiaria, totctodiaria,
                            tpajdctoalimentacao, vlrajdctoalimentacao, tpajdctotransporte, vlrajdctotransporte,
                            totajdctoitem, hospedagem, transporte, totgeralitem, setor, cachefechado
                        ) VALUES (
                            $1, $2, $3, $4, $5,
                            $6, $7, $8, $9, $10,
                            $11, $12, $13, $14,
                            $15, $16, $17, $18, $19,
                            $20, $21, $22, $23,
                            $24, $25, $26, $27, $28, $29
                        );
                    `;
          const itemValues = [
            idorcamento,
            item.enviarnaproposta,
            item.categoria,
            item.qtditens,
            item.idfuncao,
            item.idequipamento,
            item.idsuprimento,
            item.produto,
            item.qtdDias,
            item.periododiariasinicio,
            item.periododiariasfim,
            item.descontoitem,
            item.percentdescontoitem,
            item.acrescimoitem,
            item.percentacrescimoitem,
            item.vlrdiaria,
            item.totvdadiaria,
            item.ctodiaria,
            item.totctodiaria,
            item.tpajdctoalimentacao,
            item.vlrajdctoalimentacao,
            item.tpajdctotransporte,
            item.vlrajdctotransporte,
            item.totajdctoitem,
            item.hospedagem,
            item.transporte,
            item.totgeralitem,
            item.setor,
            item.cachefechado
          ];
          await client.query(insertItemQuery, itemValues);
        }
      }

      await client.query("COMMIT"); // Confirma a transação

      // Define os dados para o log middleware
      res.locals.acao = "cadastrou";
      res.locals.idregistroalterado = idorcamento;
      res.locals.idusuarioAlvo = null;

      res.locals.dadosNovos = {
        idorcamento,
        nrorcamento,
        status,
        idCliente,
        idEvento,
        idMontagem,
        edicao,
        totGeralVda,
        totGeralCto,
        vlrCliente,
        desconto,
        acrescimo,
        lucroBruto,
        percentLucro,
        lucroReal,
        percentLucroReal,
        vlrImposto,
        percentImposto,
        nomenclatura,
        formaPagamento,
        contratarstaff,
        qtdItens: itens?.length ?? 0,
      };


      // Retorne o nrOrcamento gerado para o frontend
      res
        .status(201)
        .json({
          message: "Orçamento salvo com sucesso!",
          id: idorcamento,
          nrOrcamento: nrorcamento,
        });
    } catch (error) {
      await client.query("ROLLBACK"); // Reverte a transação em caso de erro
      console.error("Erro ao salvar orçamento e seus itens:", error);
      res
        .status(500)
        .json({ error: "Erro ao salvar orçamento.", detail: error.message });
    } finally {
      client.release(); // Libera o cliente do pool
    }
  }
);

function capitalizarPalavras(texto) {
  if (!texto) {
    return "";
  }
  return texto.toLowerCase().replace(/\b\w/g, (letra) => letra.toUpperCase());
}

router.get(
  "/:nrOrcamento/contrato",
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
                    c.razaosocial AS cliente_nome, c.cnpj AS cliente_cnpj, c.inscestadual AS cliente_insc_estadual, c.responsavelcontrato AS cliente_responsavel,
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

      const resultOrcamento = await client.query(queryOrcamento, [
        nrOrcamento,
        idempresa,
      ]);

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
      resultItens.rows.forEach((item) => {
        let categoria = item.categoria || "Outros";
        const isLinhaAdicional = item.is_adicional;

        const datasFormatadas =
          item.inicio_datas && item.fim_datas
            ? `de: ${new Date(item.inicio_datas).toLocaleDateString(
                "pt-BR"
              )} até: ${new Date(item.fim_datas).toLocaleDateString("pt-BR")}`
            : "";

        let itemDescricao = `• ${item.qtd_itens} ${capitalizarPalavras(
          item.produto
        )}`;

        if (
          item.setor &&
          item.setor.toLowerCase() !== "null" &&
          item.setor !== ""
        ) {
          itemDescricao += `, (${item.setor})`;
        }

        if (item.qtd_dias !== "0" && datasFormatadas) {
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
      const ordemCategorias = [
        "Equipe Operacional",
        "Equipamento(s)",
        "Suprimento(s)",
      ];

      // Primeiro, adiciona as categorias na ordem fixa
      ordemCategorias.forEach((categoria) => {
        if (categoriasMap[categoria]) {
          dados.itens_categorias.push({
            nome: categoria,
            itens: categoriasMap[categoria],
          });
          delete categoriasMap[categoria];
        }
      });

      // Em seguida, adiciona as categorias restantes
      for (const categoria in categoriasMap) {
        if (categoriasMap.hasOwnProperty(categoria)) {
          dados.itens_categorias.push({
            nome: categoria,
            itens: categoriasMap[categoria],
          });
        }
      }

      dados.adicionais = adicionais;

      console.log("📦 Dados enviados para o Python:", dados);

      const pythonExecutable = "python";
      const pythonScriptPath = path.join(
        __dirname,
        "../public/python/Contrato.py"
      );

      const python = spawn(pythonExecutable, [pythonScriptPath]);

      let output = "";
      let errorOutput = "";

      python.stdin.write(JSON.stringify(dados));
      python.stdin.end();

      python.stdout.on("data", (data) => {
        output += data.toString();
      });
      python.stderr.on("data", (data) => {
        errorOutput += data.toString();
      });

      python.on("close", async (code) => {
        if (code !== 0) {
          console.error("🐍 Erro Python:", errorOutput);
          return res
            .status(500)
            .json({
              error: "Erro ao gerar contrato (Python)",
              detail: errorOutput,
            });
        }

        const filePath = output.trim();
        const fileName = path.basename(filePath);
        const downloadUrl = `/orcamentos/download/contratos/${encodeURIComponent(
          fileName
        )}`;
        console.log("📝 Saída do Python (output):", output);
        console.log("📄 Caminho do arquivo processado:", filePath);

        if (!fs.existsSync(filePath)) {
          console.error("❌ Arquivo do contrato não encontrado:", filePath);
          return res
            .status(500)
            .json({ error: "Arquivo do contrato não encontrado" });
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
          fileUrl: downloadUrl,
          // clicksignResult: clicksignResult
        });
      });
      python.on("error", (err) => {
        console.error("❌ Erro ao iniciar Python:", err);
        res
          .status(500)
          .json({
            error: "Erro ao iniciar processo Python",
            detail: err.message,
          });
      });
    } catch (error) {
      console.error("Erro ao gerar contrato:", error);
      res
        .status(500)
        .json({ error: "Erro ao gerar contrato", detail: error.message });
    } finally {
      client.release();
    }
  }
);

// 🔽 Força o download do contrato
router.get(
  "/download/contrato/:fileName",
  autenticarToken(),
  async (req, res) => {
    try {
      // Decodifica %20 e outros caracteres especiais
      const fileName = decodeURIComponent(req.params.fileName);

      // Caminho absoluto até a pasta upload/contratos
      const filePath = path.resolve(
        __dirname,
        "../../uploads/contratos",
        fileName
      );

      console.log("📂 Procurando arquivo em:", filePath);

      if (!fs.existsSync(filePath)) {
        console.warn("⚠️ Arquivo não encontrado:", filePath);
        return res.status(404).json({ error: "Arquivo não encontrado" });
      }

      // Força download com o nome correto
      res.download(filePath, fileName, (err) => {
        if (err) {
          console.error("❌ Erro ao enviar arquivo:", err);
          res
            .status(500)
            .json({ error: "Erro ao baixar o arquivo", detail: err.message });
        } else {
          console.log("✅ Arquivo enviado com sucesso:", fileName);
        }
      });
    } catch (error) {
      console.error("❌ Erro no download do contrato:", error);
      res
        .status(500)
        .json({ error: "Erro ao baixar o arquivo", detail: error.message });
    }
  }
);

const contratosUploadDir = path.join(__dirname, "../uploads/contratos");
if (!fs.existsSync(contratosUploadDir)) {
  fs.mkdirSync(contratosUploadDir, { recursive: true });
}

if (!fs.existsSync(contratosUploadDir))
  fs.mkdirSync(contratosUploadDir, { recursive: true });

const storageContratos = multer.diskStorage({
  destination: (req, file, cb) => cb(null, contratosUploadDir),
  filename: (req, file, cb) => {
    const nomeLimpo = file.originalname
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "_")
      .replace(/[^\w.-]/g, "");
    cb(null, nomeLimpo);
  },
});

const fileFilterContratos = (req, file, cb) => {
  const tiposPermitidos = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];
  if (tiposPermitidos.includes(file.mimetype)) cb(null, true);
  else cb(new Error("Apenas arquivos PDF, DOC e DOCX são permitidos."), false);
};

const uploadContratosMiddleware = multer({
  storage: storageContratos,
  fileFilter: fileFilterContratos,
  limits: { fileSize: 50 * 1024 * 1024 },
}).fields([{ name: "contrato", maxCount: 1 }]);

const handleMulterError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        return res.status(400).json({ success: false, message: `Erro do Multer: ${err.message}` });
    }
    if (err) {
        return res.status(400).json({ success: false, message: err.message });
    }
    next();
};

router.post("/uploadContratoManual", 
  verificarPermissao('Orcamentos', 'alterar'),
    uploadContratosMiddleware, // middleware direto, não callback
    handleMulterError, 
    logMiddleware('Orcamentos', {
      buscarDadosAnteriores: async (req) => {
          const idOrcamento = req.query.orcamento;
          const idempresa = req.idempresa;
          if (!idOrcamento) return null;
          
          const result = await pool.query(
              `SELECT o.nrorcamento, o.contratourl 
              FROM orcamentos o
              INNER JOIN orcamentoempresas oe ON oe.nrorcamento = o.nrorcamento
              WHERE o.nrorcamento = $1 AND oe.idempresa = $2`,
              [idOrcamento, idempresa]
          );
          return result.rows[0] ? { 
              dadosanteriores: result.rows[0], 
              idregistroalterado: idOrcamento 
          } : null;
      }
  }),
   async (req, res) => {
    try {
      

      if (!req.files || !req.files.contrato)
        return res
          .status(400)
          .json({ success: false, message: "Nenhum arquivo enviado." });

      const arquivo = req.files.contrato[0];
      const idOrcamento = req.query.orcamento;
      const idempresa = req.idempresa;

      if (!idOrcamento)
        return res
          .status(400)
          .json({
            success: false,
            message: "Número do orçamento não informado.",
          });

      // URL pública do arquivo
      const baseUrl = process.env.BASE_URL || "http://localhost:3000";
      const contratourl = `${baseUrl}/uploads/contratos/${arquivo.filename}`;

      console.log(
        `📁 Contrato "${arquivo.filename}" salvo para orçamento ${idOrcamento}`
      );

      // 🔹 Atualiza no banco de dados
      await pool.query(
          `UPDATE orcamentos o
          SET contratourl = $1, dataatualizacao = NOW()
          FROM orcamentoempresas oe
          WHERE o.nrorcamento = $2 AND oe.nrorcamento = o.nrorcamento AND oe.idempresa = $3`,
          [contratourl, idOrcamento, idempresa]
      );

      // 🔹 Retorno JSON
      res.setHeader("Content-Type", "application/json");

      res.locals.acao = 'atualizou';
      res.locals.idregistroalterado = idOrcamento;
      res.locals.dadosnovos = { contratourl, fileName: arquivo.filename };

      return res.status(200).json({
        success: true,
        message: "Contrato enviado e salvo com sucesso!",
        fileName: arquivo.filename,
        contratourl,
      });
    } catch (error) {
      console.error("Erro ao processar upload:", error);
      return res
        .status(500)
        .json({
          success: false,
          message: "Erro ao processar upload ou salvar no banco.",
        });
    }
  //});
});

router.post("/salvarContratoUrl", 
  verificarPermissao('Orcamentos', 'alterar'), // ❌ Estava faltando
  logMiddleware('Orcamentos', { // ❌ Estava faltando
    buscarDadosAnteriores: async (req) => {
      const idorcamento = req.body.idorcamento;
      const idempresa = req.idempresa;
      if (!idorcamento) return null;
      const result = await pool.query(
        `SELECT o.nrorcamento, o.contratourl 
         FROM orcamentos o
         INNER JOIN orcamentoempresas oe ON oe.nrorcamento = o.nrorcamento
         WHERE o.nrorcamento = $1 AND oe.idempresa = $2`,
        [idorcamento, idempresa]
      );
      return result.rows[0] ? { dadosanteriores: result.rows[0], idregistroalterado: idorcamento } : null;
    }
  }),async (req, res) => {
  try {
    const { idorcamento, contratourl } = req.body;
    const idempresa = req.idempresa;

    if (!idorcamento || !contratourl) {
      return res
        .status(400)
        .json({ success: false, message: "Dados incompletos." });
    }

    await pool.query(
        `UPDATE orcamentos o
        SET contratourl = $1, dataatualizacao = NOW()
        FROM orcamentoempresas oe
        WHERE o.nrorcamento = $2 AND oe.nrorcamento = o.nrorcamento AND oe.idempresa = $3`,
        [contratourl, idorcamento, idempresa]
    );

    res.locals.acao = 'atualizou'; // ❌ Estava faltando
    res.locals.idregistroalterado = idorcamento;
    res.locals.dadosnovos = { contratourl };
    
    return res.json({
      success: true,
      message: "Contrato vinculado com sucesso!",
    });
  } catch (error) {
    console.error("Erro ao salvar contratourl:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Erro ao salvar contratourl no banco.",
      });
  }
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

      const resultOrcamento = await client.query(queryOrcamento, [
        nrOrcamento,
        idempresa,
      ]);

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
                    oi.periododiariasfim AS fim_datas,
                    oi.adicional AS is_adicional
                FROM orcamentoitens oi
                LEFT JOIN funcao f ON oi.idfuncao = f.idfuncao
                WHERE oi.idorcamento = $1
            `;
      const resultItens = await client.query(queryItens, [dados.idorcamento]);

      const categoriasMap = {};
      const adicionais = [];

      // ✅ Etapa 3: Processa itens
      resultItens.rows.forEach((item) => {
        let categoria = item.categoria || "Outros";
        const isLinhaAdicional = item.is_adicional;

        const datasFormatadas =
          item.inicio_datas && item.fim_datas
            ? `de: ${new Date(item.inicio_datas).toLocaleDateString(
                "pt-BR"
              )} até: ${new Date(item.fim_datas).toLocaleDateString("pt-BR")}`
            : "";

        let itemDescricao = `• ${item.qtd_itens} ${capitalizarPalavras(
          item.produto
        )}`;

        if (
          item.setor &&
          item.setor.toLowerCase() !== "null" &&
          item.setor !== ""
        ) {
          itemDescricao += `, (${item.setor})`;
        }

        if (item.qtd_dias !== "0" && datasFormatadas) {
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
      const ordemCategorias = [
        "Equipe Operacional",
        "Equipamento(s)",
        "Suprimento(s)",
      ];
      ordemCategorias.forEach((categoria) => {
        if (categoriasMap[categoria]) {
          dados.itens_categorias.push({
            nome: categoria,
            itens: categoriasMap[categoria],
          });
          delete categoriasMap[categoria];
        }
      });
      for (const categoria in categoriasMap) {
        if (categoriasMap.hasOwnProperty(categoria)) {
          dados.itens_categorias.push({
            nome: categoria,
            itens: categoriasMap[categoria],
          });
        }
      }
      dados.adicionais = adicionais;

      console.log("📦 Dados enviados para o Python (Proposta):", dados);

      // ✅ Etapa 5: Executa script Python
      const pythonExecutable = "python";
      const pythonScriptPath = path.join(
        __dirname,
        "../public/python/Proposta.py"
      );
      const python = spawn(pythonExecutable, [pythonScriptPath]);

      let output = "";
      let errorOutput = "";

      python.stdin.write(JSON.stringify(dados));
      python.stdin.end();

      python.stdout.setEncoding("utf-8");
      python.stderr.setEncoding("utf-8");

      python.stdout.on("data", (data) => {
        output += data.toString();
      });
      python.stderr.on("data", (data) => {
        errorOutput += data.toString();
      });

      python.on("close", (code) => {
        if (code !== 0) {
          console.error("🐍 Erro Python Proposta:", errorOutput);
          return res
            .status(500)
            .json({
              error: "Erro ao gerar proposta (Python)",
              detail: errorOutput,
            });
        }

        const filePath = output.trim();
        console.log("📝 Proposta gerada:", filePath);

        if (!fs.existsSync(filePath)) {
          console.error(
            "❌ Erro: Arquivo da proposta não encontrado:",
            filePath
          );
          return res
            .status(500)
            .json({ error: "Arquivo da proposta não encontrado" });
        }

        const fileName = path.basename(filePath);
        const downloadUrl = `/orcamentos/download/proposta/${encodeURIComponent(
          fileName
        )}`;

        res.status(200).json({
          success: true,
          message: "Proposta gerada com sucesso",
          fileUrl: downloadUrl,
        });
      });

      python.on("error", (err) => {
        console.error("❌ Erro ao iniciar o processo Python:", err);
      });
    } catch (error) {
      console.error("Erro ao gerar proposta:", error);
      res
        .status(500)
        .json({ error: "Erro ao gerar proposta", detail: error.message });
    } finally {
      client.release();
    }
  }
);

router.get("/:nrOrcamento/proposta/adicionais",
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

      const resultOrcamento = await client.query(queryOrcamento, [
        nrOrcamento,
        idempresa,
      ]);

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
                    oi.periododiariasfim AS fim_datas,
                    oi.adicional AS is_adicional,
                    oi.vlrdiaria AS vlr_diaria,
                    oi.totvdadiaria AS total_cliente
                FROM orcamentoitens oi
                LEFT JOIN funcao f ON oi.idfuncao = f.idfuncao
                WHERE oi.idorcamento = $1
                AND oi.adicional = true
            `;
      const resultItens = await client.query(queryItens, [dados.idorcamento]);

      const categoriasMap = {};
      const adicionais = [];
      let valorTotalAdicionais = 0;

      // ✅ Etapa 3: Processa itens
      resultItens.rows.forEach((item) => {
          let valorItem = parseFloat(item.total_cliente);
          if (!Number.isFinite(valorItem)) {
              valorItem = (parseFloat(item.qtd_itens) || 0)
                        * (parseFloat(item.qtd_dias) || 0)
                        * (parseFloat(item.vlr_diaria) || 0);
          }

          if (!(parseFloat(item.qtd_itens) > 0)) return;

          valorTotalAdicionais += valorItem;

          const datasFormatadas =
              item.inicio_datas && item.fim_datas
                  ? `de: ${new Date(item.inicio_datas).toLocaleDateString("pt-BR")} até: ${new Date(item.fim_datas).toLocaleDateString("pt-BR")}`
                  : "";

          let itemDescricao = `• ${item.qtd_itens} ${capitalizarPalavras(item.produto)}`;

          if (item.setor && item.setor.toLowerCase() !== "null" && item.setor !== "") {
              itemDescricao += `, (${item.setor})`;
          }

          if (item.qtd_dias !== "0" && datasFormatadas) {
              itemDescricao += `, ${item.qtd_dias} Diária(s), ${datasFormatadas}`;
          }

          if (item.qtd_itens > 0) {
              adicionais.push(itemDescricao);
          }
      });

      // ✅ Etapa 4: Adiciona itens ao objeto de dados
      dados.valor_total = valorTotalAdicionais;
      dados.itens_categorias = [];
      dados.adicionais = adicionais;

      console.log("📦 Dados enviados para o Python (Adicionais):", dados);

      // ✅ Etapa 5: Executa script Python
      const pythonExecutable = "python";
      const pythonScriptPath = path.join(
        __dirname,
        "../public/python/Adicionais.py"
      );
      const python = spawn(pythonExecutable, [pythonScriptPath]);

      let output = "";
      let errorOutput = "";

      python.stdin.write(JSON.stringify(dados));
      python.stdin.end();

      python.stdout.setEncoding("utf-8");
      python.stderr.setEncoding("utf-8");

      python.stdout.on("data", (data) => {
        output += data.toString();
      });
      python.stderr.on("data", (data) => {
        errorOutput += data.toString();
      });

      python.on("close", (code) => {
        if (code !== 0) {
          console.error("🐍 Erro Python Proposta:", errorOutput);
          return res
            .status(500)
            .json({
              error: "Erro ao gerar proposta (Python)",
              detail: errorOutput,
            });
        }

        const filePath = output.trim();
        console.log("📝 Proposta gerada:", filePath);

        if (!fs.existsSync(filePath)) {
          console.error(
            "❌ Erro: Arquivo da proposta não encontrado:",
            filePath
          );
          return res
            .status(500)
            .json({ error: "Arquivo da proposta não encontrado" });
        }

        const fileName = path.basename(filePath);
        const downloadUrl = `/orcamentos/download/proposta/${encodeURIComponent(
          fileName
        )}`;

        res.status(200).json({
          success: true,
          message: "Proposta gerada com sucesso",
          fileUrl: downloadUrl,
        });
      });

      python.on("error", (err) => {
        console.error("❌ Erro ao iniciar o processo Python:", err);
      });
    } catch (error) {
      console.error("Erro ao gerar proposta:", error);
      res
        .status(500)
        .json({ error: "Erro ao gerar proposta", detail: error.message });
    } finally {
      client.release();
    }
  }
);

router.get("/download/proposta/:filename",
  autenticarToken(),
  contextoEmpresa,
  async (req, res) => {
    try {
      const { filename } = req.params;

      // Caminho absoluto do arquivo
      const filePath = path.join(
        __dirname,
        "..",
        "uploads",
        "Proposta",
        filename
      );

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
  }
);

router.post(
  "/:nrOrcamento/proposta",
  autenticarToken(),
  contextoEmpresa,
  verificarPermissao("Orcamentos", "pesquisar"),
  async (req, res) => {
    const client = await pool.connect();
    try {
      const { nrOrcamento } = req.params;
      const { textosIds } = req.body; // IDs selecionados no modal do frontend
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

      // ✅ NOVO: Busca o conteúdo das cláusulas selecionadas para enviar ao Python
      dados.clausulas = [];
      if (textosIds && textosIds.length > 0) {
        const queryTextos = `
          SELECT titulo, conteudo 
          FROM propostatextos 
          WHERE id = ANY($1::int[])
          ORDER BY array_position($1::int[], id)
        `;
        const resultTextos = await client.query(queryTextos, [textosIds]);
        dados.clausulas = resultTextos.rows;
      }

      // ✅ Etapa 2: Busca itens do orçamento
      const queryItens = `
                SELECT 
                    oi.qtditens AS qtd_itens, 
                    oi.produto AS produto, 
                    oi.setor,
                    oi.qtddias AS qtd_dias,
                    oi.categoria AS categoria,
                    oi.periododiariasinicio AS inicio_datas,
                    oi.periododiariasfim AS fim_datas,
                    oi.adicional AS is_adicional
                FROM orcamentoitens oi
                WHERE oi.idorcamento = $1
            `;
      const resultItens = await client.query(queryItens, [dados.idorcamento]);

      const categoriasMap = {};
      const adicionais = [];

      // ✅ Etapa 3: Processa itens
      resultItens.rows.forEach((item) => {
        let categoria = item.categoria || "Outros";
        const isLinhaAdicional = item.is_adicional;

        const datasFormatadas = item.inicio_datas && item.fim_datas
            ? `de: ${new Date(item.inicio_datas).toLocaleDateString("pt-BR")} até: ${new Date(item.fim_datas).toLocaleDateString("pt-BR")}`
            : "";

        let itemDescricao = `• ${item.qtd_itens} ${item.produto}`;

        if (item.setor && item.setor.toLowerCase() !== "null" && item.setor !== "") {
          itemDescricao += `, (${item.setor})`;
        }

        if (item.qtd_dias !== "0" && datasFormatadas) {
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

      // ✅ Etapa 4: Organiza categorias
      dados.itens_categorias = [];
      const ordemCategorias = ["Equipe Operacional", "Equipamento(s)", "Suprimento(s)"];
      ordemCategorias.forEach((cat) => {
        if (categoriasMap[cat]) {
          dados.itens_categorias.push({ nome: cat, itens: categoriasMap[cat] });
          delete categoriasMap[cat];
        }
      });
      for (const cat in categoriasMap) {
        dados.itens_categorias.push({ nome: cat, itens: categoriasMap[cat] });
      }
      dados.adicionais = adicionais;

      // ✅ Etapa 5: Executa script Python
      const pythonExecutable = "python";
      const pythonScriptPath = path.join(__dirname, "../public/python/Proposta.py");
      const python = spawn(pythonExecutable, [pythonScriptPath]);

      let output = "";
      let errorOutput = "";

      python.stdin.write(JSON.stringify(dados));
      python.stdin.end();

      python.stdout.on("data", (data) => { output += data.toString(); });
      python.stderr.on("data", (data) => { errorOutput += data.toString(); });

      python.on("close", (code) => {
        if (code !== 0) {
          return res.status(500).json({ error: "Erro Python", detail: errorOutput });
        }

        const filePath = output.trim();
        if (!fs.existsSync(filePath)) {
          return res.status(500).json({ error: "Arquivo não encontrado" });
        }

        const fileName = path.basename(filePath);
        const downloadUrl = `/orcamentos/download/proposta/${encodeURIComponent(fileName)}`;

        res.status(200).json({
          success: true,
          message: "Proposta gerada",
          fileUrl: downloadUrl,
        });
      });

    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Erro interno", detail: error.message });
    } finally {
      client.release();
    }
  }
);

// Dentro do seu arquivo de rotas (ex: routes/orcamentos.js)
router.post('/verificar-duplicidade', async (req, res) => {
    const { idOrcamento, idFuncao, setor } = req.body;

    try {
        if (!idOrcamento) {
            return res.status(200).send('Novo orçamento, sem duplicidade.');
        }

        const setorTrimmed = (setor || '').trim();

        // 1. Verificar dentro do mesmo orçamento
        const checkMesmoOrc = await pool.query(
            `SELECT idorcamentoitem FROM orcamentoitens
             WHERE idorcamento = $1
               AND idfuncao = $2
               AND (setor = $3 OR (setor IS NULL AND $3 = ''))
             LIMIT 1`,
            [idOrcamento, idFuncao, setorTrimmed]
        );

        if (checkMesmoOrc.rows.length > 0) {
            return res.status(409).json({
                status: 'duplicado',
                message: 'Já existe este item com o mesmo setor neste orçamento.'
            });
        }

        // 2. Verificar em outros orçamentos do mesmo evento, cliente e ANO
        const checkOutrosOrc = await pool.query(
            `SELECT oi.idorcamentoitem, o.nrorcamento
             FROM orcamentoitens oi
             JOIN orcamentos o      ON oi.idorcamento     = o.idorcamento
             JOIN orcamentos oatual ON oatual.idorcamento = $1
             WHERE o.idevento                            = oatual.idevento
               AND o.idcliente                           = oatual.idcliente
               AND EXTRACT(YEAR FROM o.dtinirealizacao)  = EXTRACT(YEAR FROM oatual.dtinirealizacao)
               AND o.idorcamento                        != $1
               AND oatual.idevento                      IS NOT NULL
               AND oi.idfuncao                           = $2
               AND (oi.setor = $3 OR (oi.setor IS NULL AND $3 = ''))
             LIMIT 1`,
            [idOrcamento, idFuncao, setorTrimmed]
        );

        if (checkOutrosOrc.rows.length > 0) {
            const nrOrc = checkOutrosOrc.rows[0].nrorcamento;
            return res.status(409).json({
                status: 'duplicado',
                message: `Já existe este item com o mesmo setor no Orçamento nº ${nrOrc} do mesmo evento.`
            });
        }

        res.status(200).send('OK');
    } catch (err) {
        console.error('Erro na verificação de duplicidade:', err);
        res.status(500).send('Erro interno ao verificar duplicidade');
    }
});

// GET /solicitacoes/verificar?idorcamento=364&idfuncao=22
router.get('/solicitacoes/verificar',autenticarToken(), async (req, res) => {
    const { idorcamento, idfuncao, idequipamento, idsuprimento } = req.query;
     console.log('🔍 [verificar] Params recebidos:', { idorcamento, idfuncao, idequipamento, idsuprimento });


    try {
        let filtroItem = '';
        let params = [idorcamento];

        if (idfuncao) {
            filtroItem = 'AND s.idfuncao = $2';
            params.push(idfuncao);
        } else if (idequipamento) {
            filtroItem = 'AND s.idequipamento = $2';
            params.push(idequipamento);
        } else if (idsuprimento) {
            filtroItem = 'AND s.idsuprimento = $2';
            params.push(idsuprimento);
        }

         console.log('📋 [verificar] Filtro montado:', filtroItem || '(sem filtro de item)');
        console.log('📋 [verificar] Params da query:', params);


        // const result = await pool.query(`
        //     SELECT 
        //         s.idsolicitacao,
        //         s.tiposolicitacao,
        //         s.qtdsolicitada,
        //         s.status,
        //         (SELECT setor FROM orcamentoitens WHERE idorcamento = o.idorcamento LIMIT 1) AS setor,
        //         s.dtsolicitada,
        //         s.justificativa,
        //         s.dtsolicitacao,
        //         s.dtresposta,
        //         s.idusuariosolicitante,
        //         s.idusuarioresponsavel,
        //         u1.nome AS nomesolicitante,
        //         u2.nome AS nomeresponsavel
        //     FROM solicitacoes s
        //     LEFT JOIN usuarios u1 ON u1.idusuario = s.idusuariosolicitante
        //     LEFT JOIN usuarios u2 ON u2.idusuario = s.idusuarioresponsavel
        //     LEFT JOIN orcamentoitens oi ON oi.idsolicitacao = s.idsolicitacao
        //     LEFT JOIN orcamentos o ON o.idorcamento = s.idorcamento
        //     WHERE s.idorcamento = $1
        //       ${filtroItem}
        //       AND s.tiposolicitacao IN ('Aditivo - Vaga Excedida', 'Extra Bonificado - Vaga Excedida')
        //       AND s.status = 'Autorizado'
        //       AND s.idsolicitacao NOT IN (
        //           SELECT idsolicitacao FROM orcamentoitens WHERE idsolicitacao IS NOT NULL
        //       )
        //     ORDER BY s.dtresposta DESC
        // `, params);

        const result = await pool.query(`
          SELECT 
              MIN(s.idsolicitacao)                                    AS idsolicitacao,
              s.tiposolicitacao,
              f.nome,
              COALESCE(
                  se.setor,
                  (
                      SELECT elem->>'setordobra'
                      FROM jsonb_array_elements(COALESCE(se.dtdiariadobrada::jsonb, '[]'::jsonb)) AS elem
                      WHERE (elem->>'tiposolicitacao') = 'Dobrada - Estouro Financeiro'
                      LIMIT 1
                  )
              )                                                       AS setor,
              se.idfuncao                                             AS idfuncao,
              s.idusuariosolicitante,
              s.idusuarioresponsavel,
              s.idregistroalterado,
              array_agg(s.idsolicitacao ORDER BY s.dtsolicitada[1] ASC) AS ids_solicitacoes,
              MIN(s.qtdsolicitada)                                    AS qtdsolicitada,
              MIN(s.justificativa)                                    AS justificativa,
              MIN(s.dtsolicitacao)                                    AS dtsolicitacao,
              MAX(s.dtresposta)                                       AS dtresposta,
              u1.nome                                                 AS nomesolicitante,
              u2.nome                                                 AS nomeresponsavel,
              -- Todas as datas agrupadas num array ordenado (apenas autorizadas)
              array_agg(s.dtsolicitada[1]::date ORDER BY s.dtsolicitada[1] ASC) AS datas_solicitadas,
              -- Datas rejeitadas do mesmo staffevento/tipo (para exibir obs e calcular período completo)
              COALESCE((
                  SELECT array_agg(s2.dtsolicitada[1]::date ORDER BY s2.dtsolicitada[1] ASC)
                  FROM solicitacoes s2
                  WHERE s2.idregistroalterado = s.idregistroalterado
                    AND s2.idorcamento = o.idorcamento
                    AND s2.tiposolicitacao = s.tiposolicitacao
                    AND s2.status = 'Rejeitado'
              ), ARRAY[]::date[]) AS datas_rejeitadas
          FROM solicitacoes s
          LEFT JOIN funcionarios f ON f.idfuncionario = s.idfuncionario
          LEFT JOIN staffeventos se ON se.idstaffevento = s.idregistroalterado
          LEFT JOIN usuarios u1 ON u1.idusuario = s.idusuariosolicitante
          LEFT JOIN usuarios u2 ON u2.idusuario = s.idusuarioresponsavel
          LEFT JOIN orcamentos o ON o.idorcamento = s.idorcamento
          WHERE s.idorcamento = $1
            ${filtroItem}
            AND s.tiposolicitacao IN ('Aditivo - Vaga Excedida', 'Aditivo - Limite Excedido', 'Aditivo - Datas fora do Orçamento', 'Extra Bonificado - Vaga Excedida', 'Extra Bonificado - Datas fora do Orçamento', 'Aditivo - Limite Financeiro da Equipe Excedido', 'Dobrada - Estouro Financeiro')
            AND s.status = 'Autorizado'
            AND NOT EXISTS (
                SELECT 1 FROM orcamentoitens oi
                WHERE s.idsolicitacao = oi.idsolicitacao
            )
          GROUP BY
              s.idregistroalterado,
              f.nome,
              se.setor,
              se.idfuncao,
              se.dtdiariadobrada,
              s.tiposolicitacao,
              s.idusuariosolicitante,
              s.idusuarioresponsavel,
              o.idorcamento,
              u1.nome,
              u2.nome
          ORDER BY MAX(s.dtresposta) DESC
      `, params);

        console.log(`✅ [verificar] Resultado: ${result.rows.length} solicitação(ões) encontrada(s)`);
        if (result.rows.length > 0) {
            console.log('📌 [verificar] Solicitações:', result.rows.map(r => ({
                id: r.ids_solicitacoes,
                tipo: r.tiposolicitacao,
                status: r.status,
                setor: r.setor,
                solicitante: r.nomesolicitante,
                dtsolicitada: r.datas_solicitadas
            })));
        }

        res.json({
          encontrou: result.rows.length > 0,
          solicitacoes: result.rows.map(sol => {
            const fmt = d => {
                const str = typeof d === 'string' ? d.split('T')[0] : d.toISOString().split('T')[0];
                return new Date(str + 'T00:00:00').toLocaleDateString('pt-BR');
            };

            // Datas autorizadas
            const datas = Array.isArray(sol.datas_solicitadas)
              ? [...sol.datas_solicitadas].map(d => typeof d === 'string' ? d.split('T')[0] : d.toISOString().split('T')[0]).sort()
              : [sol.datas_solicitadas];

            // Datas rejeitadas
            const datasRejeitadas = Array.isArray(sol.datas_rejeitadas)
              ? sol.datas_rejeitadas.map(d => typeof d === 'string' ? d.split('T')[0] : d.toISOString().split('T')[0]).sort()
              : [];

            // Período usa range completo (autorizado + rejeitado)
            const todasDatas = [...datas, ...datasRejeitadas].sort();
            const periodoStr = todasDatas.length === 1
                ? fmt(todasDatas[0])
                : `${fmt(todasDatas[0])} até ${fmt(todasDatas[todasDatas.length - 1])}`;

            // Obs das datas rejeitadas para exibir no orçamento
            const obsbonificado = datasRejeitadas.length > 0
                ? `Rejeitadas: ${datasRejeitadas.map(fmt).join(', ')}`
                : null;

            return { ...sol, periodoStr, datas_rejeitadas: datasRejeitadas, obsbonificado };
        })
      });

    } catch (err) {
        console.error('Erro ao verificar solicitação:', err);
        res.status(500).json({ erro: 'Erro ao verificar solicitações.' });
    }
});

// router.put("/:id",
//   autenticarToken(), contextoEmpresa,
//   verificarPermissao("Orcamentos", "alterar"),
//   logMiddleware("Orcamentos", {
//     buscarDadosAnteriores: async (req) => {
//       const idOrcamento = req.params.id;
//       const client = await pool.connect();
//       try {
//         const result = await client.query(`SELECT
//                         o.*,
//                         oe.idempresa,
//                         json_agg(oi.*) AS itens
//                  FROM orcamentos o
//                  JOIN orcamentoempresas oe ON o.idorcamento = oe.idorcamento
//                  LEFT JOIN orcamentoitens oi ON o.idorcamento = oi.idorcamento
//                  WHERE o.idorcamento = $1
//                  GROUP BY o.idorcamento, oe.idempresa;
//              `, [idOrcamento]);
//         return {
//           dadosanteriores: result.rows[0] || null,
//           idregistroalterado: idOrcamento
//         };
//       } catch (error) {
//         console.error("Erro ao buscar dados anteriores para log:", error);
//         return { dadosanteriores: null, idregistroalterado: idOrcamento };
//       } finally {
//         client.release();
//       }
//     },
//   }),

//   async (req, res) => {
//     const client = await pool.connect();
//     const idOrcamento = req.params.id;
//     const { 
//       status, idCliente, idEvento, idMontagem,
//       infraMontagem, dtIniInfraMontagem, dtFimInfraMontagem,
//       dtIniMontagem, dtFimMontagem, dtIniMarcacao, dtFimMarcacao,
//       dtIniRealizacao, dtFimRealizacao, dtIniDesmontagem, dtFimDesmontagem,
//       dtIniDesmontagemInfra, dtFimDesmontagemInfra, obsItens, obsProposta,
//       totGeralVda, totGeralCto, totAjdCusto, lucroBruto, percentLucro,
//       desconto, percentDesconto, acrescimo, percentAcrescimo,
//       lucroReal, percentLucroReal, vlrImposto, percentImposto, vlrCliente, idsPavilhoes, nomenclatura,
//       formaPagamento, edicao, geradoAnoPosterior, dtIniPreEvento, dtFimPreEvento, dtIniPosEvento,
//       dtFimPosEvento, avisoReajusteTexto, vlrCtoFixo, percentCtoFixo, itens, contratarstaff 
//     } = req.body;

//     const idempresa = req.idempresa;

//     try {
//       await client.query("BEGIN");

//       // 1. Atualizar a tabela 'orcamentos'
//       const updateOrcamentoQuery = `UPDATE orcamentos SET
//                         "status" = $1, idcliente = $2, idevento = $3, idmontagem = $4,
//                         inframontagem = $5, dtiniinframontagem = $6, dtfiminframontagem = $7,
//                         dtinimontagem = $8, dtfimmontagem = $9, dtinimarcacao = $10, dtfimmarcacao = $11,
//                         dtinirealizacao = $12, dtfimrealizacao = $13, dtinidesmontagem = $14, dtfimdesmontagem = $15,
//                         dtiniinfradesmontagem = $16, dtfiminfradesmontagem = $17, obsitens = $18, obsproposta = $19,
//                         totgeralvda = $20, totgeralcto = $21, totajdcto = $22, lucrobruto = $23, percentlucro = $24,
//                         desconto = $25, percentdesconto = $26, acrescimo = $27, percentacrescimo = $28,
//                         lucroreal = $29, percentlucroreal = $30, vlrimposto = $31, percentimposto = $32, vlrcliente = $33, 
//                         nomenclatura = $34, formapagamento = $35, edicao = $36, geradoanoposterior = $37, dtinipreevento = $38, 
//                         dtfimpreevento = $39, dtiniposevento = $40, dtfimposevento = $41, indicesaplicados = $42, vlrctofixo = $43,
//                         percentctofixo = $44, contratarstaff = $45
//                  WHERE idorcamento = $46  AND (SELECT idempresa FROM orcamentoempresas WHERE idorcamento = $46) =$47 ;`;

//       const orcamentoValues = [
//         status, idCliente, idEvento, idMontagem,
//         infraMontagem, dtIniInfraMontagem, dtFimInfraMontagem,
//         dtIniMontagem, dtFimMontagem, dtIniMarcacao, dtFimMarcacao,
//         dtIniRealizacao, dtFimRealizacao, dtIniDesmontagem, dtFimDesmontagem,
//         dtIniDesmontagemInfra, dtFimDesmontagemInfra, obsItens, obsProposta,
//         totGeralVda, totGeralCto, totAjdCusto, lucroBruto, percentLucro,
//         desconto, percentDesconto, acrescimo, percentAcrescimo,
//         lucroReal, percentLucroReal, vlrImposto, percentImposto, vlrCliente, nomenclatura,
//         formaPagamento, edicao, geradoAnoPosterior, dtIniPreEvento, dtFimPreEvento, dtIniPosEvento, dtFimPosEvento,
//         avisoReajusteTexto, vlrCtoFixo, percentCtoFixo, contratarstaff,
//         idOrcamento, idempresa
//       ];

//       await client.query(updateOrcamentoQuery, orcamentoValues);

//       // 2. Lidar com Pavilhões
//       const currentPavilhoesResult = await client.query(
//         `SELECT idpavilhao FROM orcamentopavilhoes WHERE idorcamento = $1;`,
//         [idOrcamento]
//       );
//       const currentPavilhaoIds = new Set(currentPavilhoesResult.rows.map(row => row.idpavilhao));
//       const newPavilhaoIds = new Set(idsPavilhoes && Array.isArray(idsPavilhoes) ? idsPavilhoes : []);

//       const pavilhoesToRemove = [...currentPavilhaoIds].filter(id => !newPavilhaoIds.has(id));
//       for (const idPavilhao of pavilhoesToRemove) {
//         await client.query(`DELETE FROM orcamentopavilhoes WHERE idorcamento = $1 AND idpavilhao = $2;`, [idOrcamento, idPavilhao]);
//       }

//       const pavilhoesToAdd = [...newPavilhaoIds].filter(id => !currentPavilhaoIds.has(id));
//       for (const idPavilhao of pavilhoesToAdd) {
//         await client.query(`INSERT INTO orcamentopavilhoes (idorcamento, idpavilhao) VALUES ($1, $2);`, [idOrcamento, idPavilhao]);
//       }

//       // 3. Lidar com os ITENS do orçamento (orcamentoitens)
//       const existingItemsResult = await client.query(
//         `SELECT idorcamentoitem FROM orcamentoitens WHERE idorcamento = $1`,
//         [idOrcamento]
//       );
//       const existingItemIds = new Set(existingItemsResult.rows.map(r => Number(r.idorcamentoitem)));
//       const receivedItemIds = new Set(itens.filter(item => item.id).map(item => Number(item.id)));

//       const itemsToDelete = [...existingItemIds].filter(id => !receivedItemIds.has(id));
//       if (itemsToDelete.length > 0) {
//         await client.query(
//           `DELETE FROM orcamentoitens WHERE idorcamento = $1 AND idorcamentoitem = ANY($2)`,
//           [idOrcamento, itemsToDelete]
//         );
//       }

//       for (const item of itens) {
//         const isAdicional = item.adicional === true;
//         // Se o frontend não enviar vlrbase, usamos o vlrdiaria como fallback (mas o ideal é enviar)
//         const valorBase = item.vlrbase ?? item.vlrdiaria; 
//         const setorItem = (item.setor || '').trim();


//         // Se for um item NOVO (sem item.id) e o frontend não enviou a flag 'ignorarDuplicata'
//         if (!item.id && !req.body.ignorarDuplicata) {
//             const checkDuplicidade = await client.query(`
//                 SELECT idorcamentoitem 
//                 FROM orcamentoitens 
//                 WHERE idorcamento = $1 
//                   AND idfuncao = $2 
//                   AND (setor = $3 OR (setor IS NULL AND $3 = ''))
//                 LIMIT 1
//             `, [idOrcamento, item.idfuncao, setorItem]);

//             if (checkDuplicidade.rows.length > 0) {
//                 await client.query("ROLLBACK");
//                 return res.status(409).json({ // 409 = Conflict
//                     status: "duplicado",
//                     isDuplicado: true,
//                     idFuncao: item.idfuncao,
//                     produto: item.produto,
//                     setor: setorItem || "Geral",
//                     message: `Já existe um item "${item.produto}" para o setor "${setorItem || 'Geral'}" neste orçamento.`
//                 });
//             }
//         }

//         console.log(`Processando item: ${item.idfuncao}, orçamento: ${idOrcamento} -  (Adicional: ${isAdicional})`);        
      
//         if (isAdicional) {
//           // 1. Tenta buscar a solicitação autorizada que bata exatamente com o setor enviado (ou Geral)
//           const itensSemSetorPermitidos = req.body.itensSemSetorPermitidos ?? [];
//           const ignorarValidacaoSetor = itensSemSetorPermitidos.includes(item.idfuncao);

//           if (!ignorarValidacaoSetor) {
//             const checkSolicitacao = await client.query(`
//                 SELECT 
//                     se.statusstaff, 
//                     sol.status as status_solicitacao,
//                     se.setor,
//                     se.pavilhao,
//                     se.idstaffevento
//                 FROM staffeventos se
//                 INNER JOIN solicitacoes sol ON (
//                     sol.idregistroalterado = se.idstaffevento
//                     AND sol.idorcamento = se.idorcamento
//                 )
//                 WHERE se.idorcamento = $1 
//                   AND se.idfuncao = $2 
//                   AND (se.setor = $3 OR (se.setor IS NULL AND $3 = ''))
//                   AND se.statusstaff != 'Deletado'
//                   AND sol.status != 'Deletado'
//                 LIMIT 1
//             `, [idOrcamento, item.idfuncao, setorItem]);

//             if (checkSolicitacao.rows.length > 0) {
//                 const { status_solicitacao, idstaffevento, statusstaff } = checkSolicitacao.rows[0];

//                 if (status_solicitacao === 'Autorizado') {
//                     if (statusstaff === 'Pendente') {
//                         await client.query(`UPDATE staffeventos SET statusstaff = 'Ativo' WHERE idstaffevento = $1`, [idstaffevento]);
//                     }
//                     // Segue o fluxo de salvamento normal
//                 } 
//                 else if (status_solicitacao === 'Pendente') {
//                     await client.query("ROLLBACK");
//                     return res.status(400).json({ 
//                         isSwal: true, icon: 'info', title: 'Processo em Análise',
//                         message: `A função "${item.produto}" ainda aguarda aprovação financeira.`,
//                         suprimirErroDefault: true
//                     });
//                 }
//             } else {
//                 // --- CASO O SETOR ESTEJA VAZIO NO ORÇAMENTO MAS PREENCHIDO NO STAFF ---
//                 // Se o setorItem for vazio, procuramos se existe qualquer aditivo autorizado para essa função
//                 const buscaQualquerSetor = await client.query(`
//                     SELECT se.setor, se.pavilhao
//                     FROM staffeventos se
//                     INNER JOIN solicitacoes sol ON (sol.idregistroalterado = se.idstaffevento)
//                     WHERE se.idorcamento = $1 
//                       AND se.idfuncao = $2 
//                       AND sol.status = 'Autorizado'
//                       AND se.setor IS NOT NULL 
//                       AND se.setor != ''
//                     LIMIT 1
//                 `, [idOrcamento, item.idfuncao]);

 
//                 if (buscaQualquerSetor.rows.length > 0 && (!setorItem || setorItem === '')) {
//                     await client.query("ROLLBACK");
//                     const sug = buscaQualquerSetor.rows[0];

//                     // IMPORTANTE: Use .json() em vez de .send() ou retornar apenas a string
//                     return res.status(400).json({ 
//                         isConfirmarSetor: true, 
//                         idFuncao: item.idfuncao,
//                         produto: item.produto,
//                         setorSugerido: sug.setor,
//                         message: `O item "${item.produto}" está sem setor no orçamento, mas existe um aditivo aprovado para o setor "<strong>${sug.setor}</strong>".`
//                     });
//                 }
//                 // Se realmente não houver nada
//                 // await client.query("ROLLBACK");
//                 // return res.status(400).json({ 
//                 //     isSwal: true, icon: 'warning', title: 'Divergência',
//                 //     message: `Não existe aditivo aprovado para "${item.produto}".`,
//                 //     suprimirErroDefault: true
//                 // });
//             }
//           }
//         }
      

//         if (item.id && existingItemIds.has(Number(item.id))) {
//           // UPDATE DO ITEM EXISTENTE
//           const updateItemQuery = `
//             UPDATE orcamentoitens SET
//                 enviarnaproposta = $1, categoria = $2, qtditens = $3, idfuncao = $4,
//                 idequipamento = $5, idsuprimento = $6, produto = $7, qtddias = $8, periododiariasinicio = $9,
//                 periododiariasfim = $10, descontoitem = $11, percentdescontoitem = $12, acrescimoitem = $13,
//                 percentacrescimoitem = $14, vlrdiaria = $15, totvdadiaria = $16, ctodiaria = $17, totctodiaria = $18,
//                 tpajdctoalimentacao = $19, vlrajdctoalimentacao = $20, tpajdctotransporte = $21, vlrajdctotransporte = $22,
//                 totajdctoitem = $23, hospedagem = $24, transporte = $25, totgeralitem = $26, setor = $27,
//                 adicional = $28, 
//                 vlrbase = $29, cachefechado = $30, idsolicitacao = $31
//             WHERE idorcamentoitem = $32 AND idorcamento = $33;
//           `;

//           const itemValues = [
//             item.enviarnaproposta, item.categoria, item.qtditens, item.idfuncao,
//             item.idequipamento, item.idsuprimento, item.produto, item.qtdDias,
//             item.periododiariasinicio, item.periododiariasfim, item.descontoitem,
//             item.percentdescontoitem, item.acrescimoitem, item.percentacrescimoitem,
//             item.vlrdiaria, item.totvdadiaria, item.ctodiaria, item.totctodiaria,
//             item.tpajdctoalimentacao, item.vlrajdctoalimentacao,
//             item.tpajdctotransporte, item.vlrajdctotransporte,
//             item.totajdctoitem, item.hospedagem, item.transporte,
//             item.totgeralitem, item.setor ?? '', isAdicional,
//             valorBase, // $29
//             item.cachefechado, // $30
//             item.idsolicitacao, // $31
//             item.id,   // $32
//             idOrcamento // $33
//           ];

//           await client.query(updateItemQuery, itemValues);

//         } else {
//           // INSERT DE NOVO ITEM
//           const insertItemQuery = `
//             INSERT INTO orcamentoitens (
//                 idorcamento, enviarnaproposta, categoria, qtditens,
//                 idfuncao, idequipamento, idsuprimento, produto,
//                 qtddias, periododiariasinicio, periododiariasfim,
//                 descontoitem, percentdescontoitem, acrescimoitem,
//                 percentacrescimoitem, vlrdiaria, totvdadiaria,
//                 ctodiaria, totctodiaria, tpajdctoalimentacao,
//                 vlrajdctoalimentacao, tpajdctotransporte,
//                 vlrajdctotransporte, totajdctoitem,
//                 hospedagem, transporte, totgeralitem,
//                 setor, adicional, 
//                 vlrbase, cachefechado, idsolicitacao
//             ) VALUES (
//                 $1, $2, $3, $4,
//                 $5, $6, $7, $8,
//                 $9, $10, $11,
//                 $12, $13, $14,
//                 $15, $16, $17,
//                 $18, $19, $20,
//                 $21, $22, $23,
//                 $24, $25, $26,
//                 $27, $28, $29,
//                 $30, $31, $32
//             )
//           `;

//           const itemValues = [
//             idOrcamento, item.enviarnaproposta, item.categoria, item.qtditens,
//             item.idfuncao, item.idequipamento, item.idsuprimento, item.produto,
//             item.qtdDias, item.periododiariasinicio, item.periododiariasfim,
//             item.descontoitem, item.percentdescontoitem, item.acrescimoitem,
//             item.percentacrescimoitem, item.vlrdiaria, item.totvdadiaria,
//             item.ctodiaria, item.totctodiaria, item.tpajdctoalimentacao,
//             item.vlrajdctoalimentacao, item.tpajdctotransporte,
//             item.vlrajdctotransporte, item.totajdctoitem,
//             item.hospedagem, item.transporte, item.totgeralitem,
//             item.setor ?? '', isAdicional,
//             valorBase, // $30
//             item.cachefechado, // $31
//             item.idsolicitacao // $32
//           ];

//           await client.query(insertItemQuery, itemValues);
//         }
//         // ✅ APÓS INSERT OU UPDATE DO ITEM — ativa staffevento se solicitação aditivo foi incluída no orçamento
//         if (item.idsolicitacao) {
//             const solicitacaoResult = await client.query(`
//                 SELECT idregistroalterado, status, categoria_log 
//                 FROM solicitacoes 
//                 WHERE idsolicitacao = $1 
//                 AND categoria_log = 'aditivoextra'
//                 AND status = 'Autorizado'
//                 LIMIT 1
//             `, [item.idsolicitacao]);

//             if (solicitacaoResult.rows.length > 0) {
//                 const { idregistroalterado } = solicitacaoResult.rows[0];

//                 await client.query(`
//                     UPDATE staffeventos 
//                     SET statusstaff = 'Ativo'
//                     WHERE idstaffevento = $1
//                     AND statusstaff = 'Pendente'
//                     AND EXISTS (
//                         SELECT 1 FROM staffempresas sem 
//                         WHERE sem.idstaff = staffeventos.idstaff 
//                         AND sem.idempresa = $2
//                     )
//                 `, [idregistroalterado, idempresa]);

//                 console.log(`✅ Staffevento ${idregistroalterado} ativado após inclusão no orçamento (solicitação ${item.idsolicitacao})`);
//             }
//         }
//       }

//       await client.query("COMMIT");

//       res.locals.acao = 'atualizou';
//       res.locals.idregistroalterado = idOrcamento;
//       res.locals.dadosNovos = {
//         idorcamento: idOrcamento,
//         status,
//         idCliente,
//         idEvento,
//         idMontagem,
//         edicao,
//         totGeralVda,
//         totGeralCto,
//         vlrCliente,
//         desconto,
//         acrescimo,
//         lucroBruto,
//         percentLucro,
//         lucroReal,
//         percentLucroReal,
//         vlrImposto,
//         percentImposto,
//         nomenclatura,
//         formaPagamento,
//         contratarstaff,
//         qtdItens: itens?.length ?? 0,
//       };



//       res.status(200).json({ message: "Orçamento atualizado com sucesso!", id: idOrcamento });
//     } catch (error) {
//       await client.query("ROLLBACK");
//       console.error("Erro ao atualizar orçamento e seus itens:", error);
//       res.status(500).json({ error: "Erro ao atualizar orçamento.", detail: error.message });
//     } finally {
//       client.release();
//     }
//   }
// );

router.put("/:id",
  autenticarToken(), contextoEmpresa,
  verificarPermissao("Orcamentos", "alterar"),
  logMiddleware("Orcamentos", {
    buscarDadosAnteriores: async (req) => {
      const idOrcamento = req.params.id;
      const client = await pool.connect();
      try {
        const result = await client.query(`SELECT
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
    const idOrcamento = req.params.id;
    const { 
      status, idCliente, idEvento, idMontagem,
      infraMontagem, dtIniInfraMontagem, dtFimInfraMontagem,
      dtIniMontagem, dtFimMontagem, dtIniMarcacao, dtFimMarcacao,
      dtIniRealizacao, dtFimRealizacao, dtIniDesmontagem, dtFimDesmontagem,
      dtIniDesmontagemInfra, dtFimDesmontagemInfra, obsItens, obsProposta,
      totGeralVda, totGeralCto, totAjdCusto, lucroBruto, percentLucro,
      desconto, percentDesconto, acrescimo, percentAcrescimo,
      lucroReal, percentLucroReal, vlrImposto, percentImposto, vlrCliente, idsPavilhoes, nomenclatura,
      formaPagamento, edicao, geradoAnoPosterior, dtIniPreEvento, dtFimPreEvento, dtIniPosEvento,
      dtFimPosEvento, avisoReajusteTexto, vlrCtoFixo, percentCtoFixo, itens, contratarstaff 
    } = req.body;

    const idempresa = req.idempresa;

    // Antes de ativar um staffevento (statusstaff = 'Ativo') na inclusão no orçamento,
    // verifica se ainda existe OUTRA solicitação Pendente pro mesmo staffevento (de
    // qualquer categoria) — se houver, statusstaff deve continuar 'Pendente' mesmo com
    // esta solicitação específica já incluída. Mesmo padrão do `pendenciasReais` já
    // usado em routes/rotaMain.js.
    const temOutrasPendencias = async (idstaffeventoAlvo, idsExcluir = []) => {
      const idsParaExcluir = idsExcluir.length ? idsExcluir : [0];
      const { rows } = await client.query(`
        SELECT 1 FROM public.solicitacoes
        WHERE idregistroalterado = $1 AND status = 'Pendente' AND idsolicitacao != ALL($2::int[])
        LIMIT 1
      `, [idstaffeventoAlvo, idsParaExcluir]);
      return rows.length > 0;
    };

    try {
      await client.query("BEGIN");

      // 1. Atualizar a tabela 'orcamentos'
      const updateOrcamentoQuery = `UPDATE orcamentos SET
                        "status" = $1, idcliente = $2, idevento = $3, idmontagem = $4,
                        inframontagem = $5, dtiniinframontagem = $6, dtfiminframontagem = $7,
                        dtinimontagem = $8, dtfimmontagem = $9, dtinimarcacao = $10, dtfimmarcacao = $11,
                        dtinirealizacao = $12, dtfimrealizacao = $13, dtinidesmontagem = $14, dtfimdesmontagem = $15,
                        dtiniinfradesmontagem = $16, dtfiminfradesmontagem = $17, obsitens = $18, obsproposta = $19,
                        totgeralvda = $20, totgeralcto = $21, totajdcto = $22, lucrobruto = $23, percentlucro = $24,
                        desconto = $25, percentdesconto = $26, acrescimo = $27, percentacrescimo = $28,
                        lucroreal = $29, percentlucroreal = $30, vlrimposto = $31, percentimposto = $32, vlrcliente = $33, 
                        nomenclatura = $34, formapagamento = $35, edicao = $36, geradoanoposterior = $37, dtinipreevento = $38, 
                        dtfimpreevento = $39, dtiniposevento = $40, dtfimposevento = $41, indicesaplicados = $42, vlrctofixo = $43,
                        percentctofixo = $44, contratarstaff = $45
                 WHERE idorcamento = $46  AND (SELECT idempresa FROM orcamentoempresas WHERE idorcamento = $46) =$47 ;`;

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
        avisoReajusteTexto, vlrCtoFixo, percentCtoFixo, contratarstaff,
        idOrcamento, idempresa
      ];

      await client.query(updateOrcamentoQuery, orcamentoValues);

      // 2. Lidar com Pavilhões
      const currentPavilhoesResult = await client.query(
        `SELECT idpavilhao FROM orcamentopavilhoes WHERE idorcamento = $1;`,
        [idOrcamento]
      );
      const currentPavilhaoIds = new Set(currentPavilhoesResult.rows.map(row => row.idpavilhao));
      const newPavilhaoIds = new Set(idsPavilhoes && Array.isArray(idsPavilhoes) ? idsPavilhoes : []);

      const pavilhoesToRemove = [...currentPavilhaoIds].filter(id => !newPavilhaoIds.has(id));
      for (const idPavilhao of pavilhoesToRemove) {
        await client.query(`DELETE FROM orcamentopavilhoes WHERE idorcamento = $1 AND idpavilhao = $2;`, [idOrcamento, idPavilhao]);
      }

      const pavilhoesToAdd = [...newPavilhaoIds].filter(id => !currentPavilhaoIds.has(id));
      for (const idPavilhao of pavilhoesToAdd) {
        await client.query(`INSERT INTO orcamentopavilhoes (idorcamento, idpavilhao) VALUES ($1, $2);`, [idOrcamento, idPavilhao]);
      }

      // 3. Lidar com os ITENS do orçamento (orcamentoitens)
      const existingItemsResult = await client.query(
        `SELECT idorcamentoitem FROM orcamentoitens WHERE idorcamento = $1`,
        [idOrcamento]
      );
      const existingItemIds = new Set(existingItemsResult.rows.map(r => Number(r.idorcamentoitem)));
      const receivedItemIds = new Set(itens.filter(item => item.id).map(item => Number(item.id)));

      const itemsToDelete = [...existingItemIds].filter(id => !receivedItemIds.has(id));
      if (itemsToDelete.length > 0) {
        await client.query(
          `DELETE FROM orcamentoitens WHERE idorcamento = $1 AND idorcamentoitem = ANY($2)`,
          [idOrcamento, itemsToDelete]
        );
      }

      for (const item of itens) {
        const isAdicional = item.adicional === true;
        // Se o frontend não enviar vlrbase, usamos o vlrdiaria como fallback (mas o ideal é enviar)
        const valorBase = item.vlrbase ?? item.vlrdiaria;
        let setorItem = (item.setor || '').trim();

        // Auto-enumera setores ADITIVO/BONIFICADO quando já existe item com mesmo setor+função.
        if (setorItem && /\b(ADITIVO|BONIFICADO)\b$/i.test(setorItem)) {
            const baseSetor = setorItem;
            let candidato = baseSetor;
            let contador = 2;
            while (true) {
                const params = item.id
                    ? [idOrcamento, item.idfuncao, candidato, item.id]
                    : [idOrcamento, item.idfuncao, candidato];
                const excluirAtual = item.id ? 'AND idorcamentoitem != $4' : '';
                const conflito = await client.query(`
                    SELECT idorcamentoitem FROM orcamentoitens
                    WHERE idorcamento = $1 AND idfuncao = $2 AND setor = $3
                    ${excluirAtual}
                    LIMIT 1
                `, params);
                if (conflito.rows.length === 0) break;
                candidato = `${baseSetor} ${contador++}`;
            }
            setorItem = candidato;
        }

        // Sincroniza setor_origem em vagasreaproveitadas via idregistroalterado da solicitação.
        if (/\b(ADITIVO|BONIFICADO)\b/i.test(setorItem) && (item.ids_solicitacoes || []).filter(Boolean).length > 0) {
            const idsSols = (item.ids_solicitacoes || []).filter(Boolean).map(Number);
            if (idsSols.length > 0) {
                const solRes = await client.query(`
                    SELECT DISTINCT idregistroalterado AS idstaffevento
                    FROM solicitacoes
                    WHERE idsolicitacao = ANY($1) AND idregistroalterado IS NOT NULL
                    LIMIT 1
                `, [idsSols]);
                if (solRes.rows.length > 0) {
                    const idStaffAlvo = solRes.rows[0].idstaffevento;
                    await client.query(`
                        UPDATE staffeventos
                        SET vagasreaproveitadas = (
                            SELECT COALESCE(jsonb_agg(
                                CASE
                                    WHEN (v->>'idfuncao_origem')::int = $2
                                         AND (v->>'idorcamento_origem')::int = $3
                                         AND regexp_replace(COALESCE(v->>'setor_origem',''), '[[:space:]]+[[:digit:]]+$', '')
                                             = regexp_replace($4, '[[:space:]]+[[:digit:]]+$', '')
                                    THEN jsonb_set(v, '{setor_origem}', to_jsonb($4::text))
                                    ELSE v
                                END
                            ), vagasreaproveitadas::jsonb)
                            FROM jsonb_array_elements(COALESCE(vagasreaproveitadas::jsonb, '[]'::jsonb)) AS v
                        )
                        WHERE idstaffevento = $1
                    `, [idStaffAlvo, item.idfuncao, idOrcamento, setorItem]);
                }
            }
        }

        // Se for um item NOVO (sem item.id) e o frontend não enviou a flag 'ignorarDuplicata'
        if (!item.id && !req.body.ignorarDuplicata) {
            const checkDuplicidade = await client.query(`
                SELECT idorcamentoitem
                FROM orcamentoitens
                WHERE idorcamento = $1
                  AND idfuncao = $2
                  AND (setor = $3 OR (setor IS NULL AND $3 = ''))
                LIMIT 1
            `, [idOrcamento, item.idfuncao, setorItem]);

            if (checkDuplicidade.rows.length > 0) {
                await client.query("ROLLBACK");
                return res.status(409).json({ // 409 = Conflict
                    status: "duplicado",
                    isDuplicado: true,
                    idFuncao: item.idfuncao,
                    produto: item.produto,
                    setor: setorItem || "Geral",
                    message: `Já existe um item "${item.produto}" para o setor "${setorItem || 'Geral'}" neste orçamento.`
                });
            }
        }

        console.log(`Processando item: ${item.idfuncao}, orçamento: ${idOrcamento} -  (Adicional: ${isAdicional})`);        
      
        if (isAdicional) {
          // 1. Tenta buscar a solicitação autorizada que bata exatamente com o setor enviado (ou Geral)
          const itensSemSetorPermitidos = req.body.itensSemSetorPermitidos ?? [];
          const ignorarValidacaoSetor = itensSemSetorPermitidos.includes(item.idfuncao);

          if (!ignorarValidacaoSetor) {
            // Tenta lookup direto via ids_solicitacoes (mais preciso — evita ambiguidade de setor)
            const idsSolicitacoes = (item.ids_solicitacoes || []).filter(Boolean).map(Number);
            let checkSolicitacao = { rows: [] };

            if (idsSolicitacoes.length > 0) {
                checkSolicitacao = await client.query(`
                    SELECT
                        se.statusstaff,
                        sol.status as status_solicitacao,
                        se.setor,
                        se.pavilhao,
                        se.idstaffevento,
                        sol.tiposolicitacao,
                        sol.categoria_log,
                        sol.dtsolicitada[1]::date as dtsolicitada_item
                    FROM staffeventos se
                    INNER JOIN solicitacoes sol ON sol.idregistroalterado = se.idstaffevento
                    WHERE sol.idsolicitacao = ANY($1)
                      AND se.idorcamento = $2
                      AND se.statusstaff != 'Deletado'
                      AND sol.status != 'Deletado'
                    ORDER BY (se.statusstaff = 'Pendente') DESC
                    LIMIT 1
                `, [idsSolicitacoes, idOrcamento]);
            }

            // Fallback: lookup por setor (itens sem ids_solicitacoes ou lookup direto vazio)
            if (checkSolicitacao.rows.length === 0) {
                checkSolicitacao = await client.query(`
                    SELECT
                        se.statusstaff,
                        sol.status as status_solicitacao,
                        se.setor,
                        se.pavilhao,
                        se.idstaffevento,
                        sol.tiposolicitacao,
                        sol.categoria_log,
                        sol.dtsolicitada[1]::date as dtsolicitada_item
                    FROM staffeventos se
                    INNER JOIN solicitacoes sol ON (
                        sol.idregistroalterado = se.idstaffevento
                        AND sol.idorcamento = se.idorcamento
                    )
                    WHERE se.idorcamento = $1
                      AND se.idfuncao = $2
                      AND (
                          se.setor = $3
                          OR (se.setor IS NULL AND $3 = '')
                          OR (
                              $3 ~* '(ADITIVO|BONIFICADO)([[:space:]]+[[:digit:]]+)?$'
                              AND se.setor = trim(regexp_replace(
                                  regexp_replace($3, '[[:space:]]+[[:digit:]]+$', ''),
                                  '[[:space:]]+(ADITIVO|BONIFICADO)$', '', 'i'
                              ))
                          )
                      )
                      AND se.statusstaff != 'Deletado'
                      AND sol.status != 'Deletado'
                    ORDER BY (se.statusstaff = 'Pendente') DESC
                    LIMIT 1
                `, [idOrcamento, item.idfuncao, setorItem]);
            }

            if (checkSolicitacao.rows.length > 0) {
                const { status_solicitacao, idstaffevento, statusstaff, tiposolicitacao, categoria_log, dtsolicitada_item } = checkSolicitacao.rows[0];

                if (status_solicitacao === 'Autorizado') {
                    // Sincroniza setor_origem nas vagasreaproveitadas independente do statusstaff atual.
                    // Necessário para setores enumerados (ex: "EXCEDIDO ADITIVO 2"):
                    // remove o sufixo numérico para comparar a base e atualiza para o setor exato do item.
                    if (setorItem) {
                        await client.query(`
                            UPDATE staffeventos
                            SET vagasreaproveitadas = (
                                SELECT COALESCE(jsonb_agg(
                                    CASE
                                        WHEN (v->>'idfuncao_origem')::int = $2
                                             AND (v->>'idorcamento_origem')::int = $3
                                             AND regexp_replace(COALESCE(v->>'setor_origem',''), '[[:space:]]+[[:digit:]]+$', '')
                                                 = regexp_replace($4, '[[:space:]]+[[:digit:]]+$', '')
                                        THEN jsonb_set(v, '{setor_origem}', to_jsonb($4::text))
                                        ELSE v
                                    END
                                ), vagasreaproveitadas::jsonb)
                                FROM jsonb_array_elements(
                                    COALESCE(vagasreaproveitadas::jsonb, '[]'::jsonb)
                                ) AS v
                            )
                            WHERE idstaffevento = $1
                        `, [idstaffevento, item.idfuncao, idOrcamento, setorItem]);
                    }

                    if (statusstaff === 'Pendente') {
                        if (categoria_log === 'statusdiariadobrada' && tiposolicitacao === 'Dobrada - Estouro Financeiro') {
                            const seResult = await client.query(`
                                SELECT dtdiariadobrada, vlrtotcache, vlrtotajdcusto, vlrtotal, statuspgtoajdcto
                                FROM staffeventos WHERE idstaffevento = $1
                            `, [idstaffevento]);

                            if (seResult.rows.length > 0) {
                                const se = seResult.rows[0];
                                let dtdiariadobrada = se.dtdiariadobrada;
                                if (typeof dtdiariadobrada === 'string') { try { dtdiariadobrada = JSON.parse(dtdiariadobrada); } catch(e) { dtdiariadobrada = []; } }

                                const dataEsperada = dtsolicitada_item ? String(dtsolicitada_item).split('T')[0] : null;
                                const entradaEstouro = (Array.isArray(dtdiariadobrada) ? dtdiariadobrada : [])
                                    .find(d => d.tiposolicitacao === 'Dobrada - Estouro Financeiro' && (!dataEsperada || d.data === dataEsperada));

                                let novoCacheTotal = parseFloat(se.vlrtotcache) || 0;
                                let novoAjdTotal   = parseFloat(se.vlrtotajdcusto) || 0;

                                if (entradaEstouro) {
                                    const vlrItemCache = entradaEstouro.vlr_cache != null ? parseFloat(entradaEstouro.vlr_cache) : 0;
                                    const vlrItemAlim  = entradaEstouro.vlr_alimentacao != null ? parseFloat(entradaEstouro.vlr_alimentacao) : 0;
                                    const isAjdPago = (se.statuspgtoajdcto || '').toLowerCase() === 'pago';
                                    novoCacheTotal += vlrItemCache;
                                    if (isAjdPago) novoCacheTotal += vlrItemAlim;
                                    else           novoAjdTotal   += vlrItemAlim;
                                }

                                const setorOrcamentoItemP1 = item.setor || null;

                                console.log(`[Path 1] idstaffevento=${idstaffevento} setor="${setorOrcamentoItemP1}" dataEsperada="${dataEsperada}"`);

                                // 1. Ativa o staffevento e soma os valores (apenas se ainda Pendente),
                                //    mas só vira 'Ativo' se não houver outra solicitação pendente
                                const novoStatusStaffP1 = (await temOutrasPendencias(idstaffevento, idsSolicitacoes)) ? 'Pendente' : 'Ativo';
                                await client.query(`
                                    UPDATE staffeventos
                                    SET statusstaff = $5, ativo = $6,
                                        vlrtotcache = $2, vlrtotajdcusto = $3, vlrtotal = $4
                                    WHERE idstaffevento = $1 AND statusstaff = 'Pendente'
                                `, [idstaffevento, novoCacheTotal, novoAjdTotal, novoCacheTotal + novoAjdTotal, novoStatusStaffP1, novoStatusStaffP1 === 'Ativo']);

                                // 2. Atualiza setordobra no JSON — sem condição de statusstaff
                                if (setorOrcamentoItemP1) {
                                    await client.query(`
                                        UPDATE staffeventos
                                        SET dtdiariadobrada = (
                                            SELECT jsonb_agg(
                                                CASE
                                                    WHEN (d->>'tiposolicitacao') = 'Dobrada - Estouro Financeiro'
                                                         AND ($2::text IS NULL OR (d->>'data') = $2)
                                                    THEN jsonb_set(d, '{setordobra}', to_jsonb($3::text))
                                                    ELSE d
                                                END
                                            )
                                            FROM jsonb_array_elements(COALESCE(dtdiariadobrada::jsonb, '[]'::jsonb)) AS d
                                        )
                                        WHERE idstaffevento = $1
                                    `, [idstaffevento, dataEsperada, setorOrcamentoItemP1]);
                                }

                                console.log(`✅ [Path 1] Staffevento ${idstaffevento} (Dobrada Estouro) ativado, setordobra → "${setorOrcamentoItemP1}"`);
                            }
                        } else {
                            const novoStatusStaffP1Generico = (await temOutrasPendencias(idstaffevento, idsSolicitacoes)) ? 'Pendente' : 'Ativo';
                            await client.query(`
                                UPDATE staffeventos SET statusstaff = $2, ativo = $3
                                WHERE idstaffevento = $1 AND statusstaff = 'Pendente'
                            `, [idstaffevento, novoStatusStaffP1Generico, novoStatusStaffP1Generico === 'Ativo']);
                        }
                    }
                    // Segue o fluxo de salvamento normal
                }
                else if (status_solicitacao === 'Pendente') {
                    await client.query("ROLLBACK");
                    return res.status(400).json({ 
                        isSwal: true, icon: 'info', title: 'Processo em Análise',
                        message: `A função "${item.produto}" ainda aguarda aprovação financeira.`,
                        suprimirErroDefault: true
                    });
                }
            } else {
                // --- CASO O SETOR ESTEJA VAZIO NO ORÇAMENTO MAS PREENCHIDO NO STAFF ---
                // Se o setorItem for vazio, procuramos se existe qualquer aditivo autorizado para essa função
                const buscaQualquerSetor = await client.query(`
                    SELECT se.setor, se.pavilhao
                    FROM staffeventos se
                    INNER JOIN solicitacoes sol ON (sol.idregistroalterado = se.idstaffevento)
                    WHERE se.idorcamento = $1 
                      AND se.idfuncao = $2 
                      AND sol.status = 'Autorizado'
                      AND se.setor IS NOT NULL 
                      AND se.setor != ''
                    LIMIT 1
                `, [idOrcamento, item.idfuncao]);

 
                if (buscaQualquerSetor.rows.length > 0 && (!setorItem || setorItem === '')) {
                    await client.query("ROLLBACK");
                    const sug = buscaQualquerSetor.rows[0];

                    // IMPORTANTE: Use .json() em vez de .send() ou retornar apenas a string
                    return res.status(400).json({ 
                        isConfirmarSetor: true, 
                        idFuncao: item.idfuncao,
                        produto: item.produto,
                        setorSugerido: sug.setor,
                        message: `O item "${item.produto}" está sem setor no orçamento, mas existe um aditivo aprovado para o setor "<strong>${sug.setor}</strong>".`
                    });
                }
                // Se realmente não houver nada
                // await client.query("ROLLBACK");
                // return res.status(400).json({ 
                //     isSwal: true, icon: 'warning', title: 'Divergência',
                //     message: `Não existe aditivo aprovado para "${item.produto}".`,
                //     suprimirErroDefault: true
                // });
            }
          }
        }
      

        if (item.id && existingItemIds.has(Number(item.id))) {
          // UPDATE DO ITEM EXISTENTE
          const updateItemQuery = `
            UPDATE orcamentoitens SET
                enviarnaproposta = $1, categoria = $2, qtditens = $3, idfuncao = $4,
                idequipamento = $5, idsuprimento = $6, produto = $7, qtddias = $8, periododiariasinicio = $9,
                periododiariasfim = $10, descontoitem = $11, percentdescontoitem = $12, acrescimoitem = $13,
                percentacrescimoitem = $14, vlrdiaria = $15, totvdadiaria = $16, ctodiaria = $17, totctodiaria = $18,
                tpajdctoalimentacao = $19, vlrajdctoalimentacao = $20, tpajdctotransporte = $21, vlrajdctotransporte = $22,
                totajdctoitem = $23, hospedagem = $24, transporte = $25, totgeralitem = $26, setor = $27,
                adicional = $28,
                vlrbase = $29, cachefechado = $30, idsolicitacao = $31, obsbonificado = $32
            WHERE idorcamentoitem = $33 AND idorcamento = $34;
          `;

          // Usa ids_solicitacoes (array agrupado do GET) ou wrapa idsolicitacao singular
          const idsArray = item.ids_solicitacoes ?? (item.idsolicitacao ? [item.idsolicitacao] : null);

          // Itens com setor BONIFICADO não cobram o cliente — vlrdiaria e totvdadiaria devem ser 0
          const setorItemUpd = (item.setor ?? '').toUpperCase();
          const ehBonificadoUpd = setorItemUpd.includes('BONIFICADO');
          const vlrDiariaUpd    = ehBonificadoUpd ? 0 : item.vlrdiaria;
          const totVdaDiariaUpd = ehBonificadoUpd ? 0 : item.totvdadiaria;
          const vlrBaseUpd      = ehBonificadoUpd ? 0 : valorBase;

          const itemValues = [
            item.enviarnaproposta, item.categoria, item.qtditens, item.idfuncao,
            item.idequipamento, item.idsuprimento, item.produto, item.qtdDias,
            item.periododiariasinicio, item.periododiariasfim, item.descontoitem,
            item.percentdescontoitem, item.acrescimoitem, item.percentacrescimoitem,
            vlrDiariaUpd, totVdaDiariaUpd, item.ctodiaria, item.totctodiaria,
            item.tpajdctoalimentacao, item.vlrajdctoalimentacao,
            item.tpajdctotransporte, item.vlrajdctotransporte,
            item.totajdctoitem, item.hospedagem, item.transporte,
            item.totgeralitem, item.setor ?? '', isAdicional,
            vlrBaseUpd,                      // $29
            item.cachefechado,               // $30
            idsArray ? idsArray[0] : null,   // $31 — coluna integer, guarda só o ID primário
            item.obsbonificado ?? null,      // $32
            item.id,              // $33
            idOrcamento           // $34
          ];

          await client.query(updateItemQuery, itemValues);

        } else {
          // INSERT DE NOVO ITEM
          const insertItemQuery = `
            INSERT INTO orcamentoitens (
                idorcamento, enviarnaproposta, categoria, qtditens,
                idfuncao, idequipamento, idsuprimento, produto,
                qtddias, periododiariasinicio, periododiariasfim,
                descontoitem, percentdescontoitem, acrescimoitem,
                percentacrescimoitem, vlrdiaria, totvdadiaria,
                ctodiaria, totctodiaria, tpajdctoalimentacao,
                vlrajdctoalimentacao, tpajdctotransporte,
                vlrajdctotransporte, totajdctoitem,
                hospedagem, transporte, totgeralitem,
                setor, adicional,
                vlrbase, cachefechado, idsolicitacao, obsbonificado
            ) VALUES (
                $1, $2, $3, $4,
                $5, $6, $7, $8,
                $9, $10, $11,
                $12, $13, $14,
                $15, $16, $17,
                $18, $19, $20,
                $21, $22, $23,
                $24, $25, $26,
                $27, $28, $29,
                $30, $31, $32, $33
            )
          `;

          // Usa ids_solicitacoes (array agrupado do GET) ou wrapa idsolicitacao singular
          const idsArray = item.ids_solicitacoes ?? (item.idsolicitacao ? [item.idsolicitacao] : null);

          // Itens com setor BONIFICADO não cobram o cliente — vlrdiaria e totvdadiaria devem ser 0
          const setorItem = (item.setor ?? '').toUpperCase();
          const ehBonificadoItem = setorItem.includes('BONIFICADO');
          const vlrDiariaInsert    = ehBonificadoItem ? 0 : item.vlrdiaria;
          const totVdaDiariaInsert = ehBonificadoItem ? 0 : item.totvdadiaria;
          const vlrBaseInsert      = ehBonificadoItem ? 0 : valorBase;

          const itemValues = [
            idOrcamento, item.enviarnaproposta, item.categoria, item.qtditens,
            item.idfuncao, item.idequipamento, item.idsuprimento, item.produto,
            item.qtdDias, item.periododiariasinicio, item.periododiariasfim,
            item.descontoitem, item.percentdescontoitem, item.acrescimoitem,
            item.percentacrescimoitem, vlrDiariaInsert, totVdaDiariaInsert,
            item.ctodiaria, item.totctodiaria, item.tpajdctoalimentacao,
            item.vlrajdctoalimentacao, item.tpajdctotransporte,
            item.vlrajdctotransporte, item.totajdctoitem,
            item.hospedagem, item.transporte, item.totgeralitem,
            item.setor ?? '', isAdicional,
            vlrBaseInsert,                    // $30
            item.cachefechado,                // $31
            idsArray ? idsArray[0] : null,    // $32 — coluna integer, guarda só o ID primário
            item.obsbonificado ?? null        // $33
          ];

          await client.query(insertItemQuery, itemValues);
        }

        // Ativar staffevento com suporte a array de solicitacoes
        const _idsAtivacao = item.ids_solicitacoes ?? (item.idsolicitacao ? [item.idsolicitacao] : null);
        if (_idsAtivacao) {
            const idsArray = _idsAtivacao;

            const solicitacaoResult = await client.query(`
                SELECT idregistroalterado, status, categoria_log 
                FROM solicitacoes 
                WHERE idsolicitacao = ANY($1) 
                AND categoria_log = 'aditivoextra'
                AND status = 'Autorizado'
                LIMIT 1
            `, [idsArray]);  // ✅ MUDOU - Passar array

            if (solicitacaoResult.rows.length > 0) {
                const { idregistroalterado } = solicitacaoResult.rows[0];

                const novoStatusStaffAditivo = (await temOutrasPendencias(idregistroalterado, idsArray)) ? 'Pendente' : 'Ativo';
                await client.query(`
                    UPDATE staffeventos
                    SET statusstaff = $3, ativo = $4
                    WHERE idstaffevento = $1
                    AND ativo = false
                    AND statusstaff NOT IN ('Inativo', 'Deletado')
                    AND EXISTS (
                        SELECT 1 FROM staffempresas sem
                        WHERE sem.idstaff = staffeventos.idstaff
                        AND sem.idempresa = $2
                    )
                `, [idregistroalterado, idempresa, novoStatusStaffAditivo, novoStatusStaffAditivo === 'Ativo']);

                console.log(`✅ Staffevento ${idregistroalterado} ativado após inclusão no orçamento (solicitações: ${idsArray.join(', ')})`);
            } else {
                // Dobrada - Estouro Financeiro: categoria_log = 'statusdiariadobrada'
                const dobradaEstouroResult = await client.query(`
                    SELECT idregistroalterado, dtsolicitada
                    FROM solicitacoes
                    WHERE idsolicitacao = ANY($1)
                    AND categoria_log = 'statusdiariadobrada'
                    AND tiposolicitacao = 'Dobrada - Estouro Financeiro'
                    AND status = 'Autorizado'
                    LIMIT 1
                `, [idsArray]);

                if (dobradaEstouroResult.rows.length > 0) {
                    const { idregistroalterado, dtsolicitada } = dobradaEstouroResult.rows[0];
                    const dataEsperada = dtsolicitada ? String(dtsolicitada).split('T')[0] : null;

                    const seResult = await client.query(`
                        SELECT dtdiariadobrada, vlrtotcache, vlrtotajdcusto, vlrtotal, statuspgtoajdcto
                        FROM staffeventos WHERE idstaffevento = $1
                    `, [idregistroalterado]);

                    if (seResult.rows.length > 0) {
                        const se = seResult.rows[0];
                        let dtdiariadobrada = se.dtdiariadobrada;
                        if (typeof dtdiariadobrada === 'string') { try { dtdiariadobrada = JSON.parse(dtdiariadobrada); } catch(e) { dtdiariadobrada = []; } }

                        const entradaEstouro = (Array.isArray(dtdiariadobrada) ? dtdiariadobrada : [])
                            .find(d => d.tiposolicitacao === 'Dobrada - Estouro Financeiro' && (!dataEsperada || d.data === dataEsperada));

                        let novoCacheTotal = parseFloat(se.vlrtotcache) || 0;
                        let novoAjdTotal   = parseFloat(se.vlrtotajdcusto) || 0;

                        if (entradaEstouro) {
                            const vlrItemCache = entradaEstouro.vlr_cache != null ? parseFloat(entradaEstouro.vlr_cache) : 0;
                            const vlrItemAlim  = entradaEstouro.vlr_alimentacao != null ? parseFloat(entradaEstouro.vlr_alimentacao) : 0;
                            const isAjdPago = (se.statuspgtoajdcto || '').toLowerCase() === 'pago';

                            novoCacheTotal += vlrItemCache;
                            if (isAjdPago) novoCacheTotal += vlrItemAlim;
                            else           novoAjdTotal   += vlrItemAlim;
                        }

                        const novoTotal = novoCacheTotal + novoAjdTotal;
                        const setorOrcamentoItem = item.setor || null;

                        console.log(`[Path 2] idstaffevento=${idregistroalterado} setor="${setorOrcamentoItem}" dataEsperada="${dataEsperada}" novoCache=${novoCacheTotal}`);

                        // 1. Ativa o staffevento e soma os valores (apenas se ainda Pendente),
                        //    mas só vira 'Ativo' se não houver outra solicitação pendente
                        const novoStatusStaffDobrada = (await temOutrasPendencias(idregistroalterado, idsArray)) ? 'Pendente' : 'Ativo';
                        await client.query(`
                            UPDATE staffeventos
                            SET statusstaff = $5, ativo = $6,
                                vlrtotcache = $2, vlrtotajdcusto = $3, vlrtotal = $4
                            WHERE idstaffevento = $1 AND statusstaff = 'Pendente'
                        `, [idregistroalterado, novoCacheTotal, novoAjdTotal, novoTotal, novoStatusStaffDobrada, novoStatusStaffDobrada === 'Ativo']);

                        // 2. Atualiza setordobra no JSON — sem condição de statusstaff
                        //    para garantir que sempre reflete o setor real do orcamentoitem
                        if (setorOrcamentoItem) {
                            await client.query(`
                                UPDATE staffeventos
                                SET dtdiariadobrada = (
                                    SELECT jsonb_agg(
                                        CASE
                                            WHEN (d->>'tiposolicitacao') = 'Dobrada - Estouro Financeiro'
                                                 AND ($2::text IS NULL OR (d->>'data') = $2)
                                            THEN jsonb_set(d, '{setordobra}', to_jsonb($3::text))
                                            ELSE d
                                        END
                                    )
                                    FROM jsonb_array_elements(COALESCE(dtdiariadobrada::jsonb, '[]'::jsonb)) AS d
                                )
                                WHERE idstaffevento = $1
                            `, [idregistroalterado, dataEsperada, setorOrcamentoItem]);
                        }

                        console.log(`✅ [Path 2] Staffevento ${idregistroalterado} (Dobrada Estouro) ativado, setordobra → "${setorOrcamentoItem}"`);
                    }
                }
            }
        }
      }

      await client.query("COMMIT");

      res.locals.acao = 'atualizou';
      res.locals.idregistroalterado = idOrcamento;
      res.locals.dadosNovos = {
        idorcamento: idOrcamento,
        status,
        idCliente,
        idEvento,
        idMontagem,
        edicao,
        totGeralVda,
        totGeralCto,
        vlrCliente,
        desconto,
        acrescimo,
        lucroBruto,
        percentLucro,
        lucroReal,
        percentLucroReal,
        vlrImposto,
        percentImposto,
        nomenclatura,
        formaPagamento,
        contratarstaff,
        qtdItens: itens?.length ?? 0,
      };



      res.status(200).json({ message: "Orçamento atualizado com sucesso!", id: idOrcamento });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Erro ao atualizar orçamento e seus itens:", error);
      res.status(500).json({ error: "Erro ao atualizar orçamento.", detail: error.message });
    } finally {
      client.release();
    }
  }
);

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
        const result = await client.query(
          "SELECT status FROM orcamentos WHERE idorcamento = $1",
          [idOrcamento]
        );
        return {
          dadosanteriores: result.rows[0]
            ? { status: result.rows[0].status }
            : null,
          idregistroalterado: idOrcamento,
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
        throw new Error(
          "Orçamento não encontrado, já está fechado ou você não tem permissão para editá-lo."
        );
      }

      await client.query("COMMIT");

      res.locals.acao = "fechou"; // Nova ação para o log
      res.locals.idregistroalterado = idOrcamento;
      res.locals.dadosNovos = {
        status: 'F'
      };

      res.status(200).json({ message: "Orçamento fechado com sucesso!" });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Erro ao fechar o orçamento:", error);
      res
        .status(500)
        .json({ error: "Erro ao fechar o orçamento.", detail: error.message });
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
  logMiddleware("OrcamentoItens", {
    // Nome da entidade para o log
    buscarDadosAnteriores: async (req) => {
      const { idorcamento, idorcamentoitem } = req.params;
      const client = await pool.connect();
      try {
        //esse salva apenas o item que está sendo excluido
        // const result = await client.query(
        //   `SELECT * FROM orcamentoitens WHERE idorcamento = $1 AND idorcamentoitem = $2;`,
        //   [idorcamento, idorcamentoitem]
        // );

        //essa salva todos os itens antes de deletar
        const result = await client.query(
          `SELECT * FROM orcamentoitens WHERE idorcamento = $1`,
          [idorcamento] // ✅ Todos os itens, não só o deletado
        );
        return {
          dadosanteriores: { itens: result.rows },
          idregistroalterado: idorcamentoitem,
        };
      } catch (error) {
        console.error(
          "Erro ao buscar dados anteriores do item para log:",
          error
        );
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

    console.log(
      `🔥 Rota DELETE /orcamentos/${idorcamento}/itens/${idorcamentoitem} acessada.`
    );

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
      const ownershipResult = await client.query(checkOwnershipQuery, [
        idorcamento,
        idorcamentoitem,
        idempresa,
      ]);

      if (ownershipResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res
          .status(403)
          .json({
            error:
              "Permissão negada ou item não encontrado para este orçamento/empresa.",
          });
      }

      // 2. Procede com a deleção do item
      const deleteItemQuery = `
                DELETE FROM orcamentoitens
                WHERE idorcamento = $1 AND idorcamentoitem = $2;
            `;
      const result = await client.query(deleteItemQuery, [
        idorcamento,
        idorcamentoitem,
      ]);

      if (result.rowCount === 0) {
        await client.query("ROLLBACK");
        return res
          .status(404)
          .json({ error: "Item do orçamento não encontrado para deletar." });
      }

      await client.query("COMMIT");

      const client2 = await pool.connect();
      let itensRestantes = { rows: [] };
      try {
        itensRestantes = await client2.query(
          `SELECT * FROM orcamentoitens WHERE idorcamento = $1`,
          [idorcamento]
        );
      } finally {
        client2.release();
      }

      res.locals.acao = "deletou";
      res.locals.idregistroalterado = idorcamentoitem;
      res.locals.idusuarioAlvo = null;
      res.locals.dadosNovos = {
        itens: itensRestantes.rows
      };

      res
        .status(200)
        .json({ message: "Item do orçamento deletado com sucesso." });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Erro ao deletar item do orçamento:", error);
      res
        .status(500)
        .json({
          error: "Erro interno ao deletar item do orçamento.",
          detail: error.message,
        });
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
      const idOrcamento = req.params.idOrcamento;
      const client = await pool.connect();
      try {
        const result = await client.query(
          "SELECT status FROM orcamentos WHERE idorcamento = $1",
          [idOrcamento]
        );
        // return {
        //   dadosanteriores: result.rows[0]
        //     ? { status: result.rows[0].status }
        //     : null,
        //   idregistroalterado: idOrcamento,
        // };
        return {
          dadosanteriores: result.rows[0]
            ? { geradoanoposterior: result.rows[0].geradoanoposterior }
            : null,
          idregistroalterado: idOrcamento,
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
      console.log(
        `[BACKEND PATCH] Recebidos: ID:${idorcamento}, Empresa:${idempresa}, GeradoAnoPosterior:${geradoAnoPosterior}`
      );

      // Validação
      if (isNaN(idorcamento) || idorcamento <= 0) {
        return res.status(400).json({ error: "ID do Orçamento inválido." });
      }
      if (typeof geradoAnoPosterior !== "boolean") {
        return res
          .status(400)
          .json({
            error: "Valor 'geradoanoposterior' deve ser booleano (true/false).",
          });
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
      const checkResult = await client.query(checkQuery, [
        idorcamento,
        idempresa,
      ]);

      if (checkResult.rows.length === 0) {
        await client.query("ROLLBACK");
        // Aqui uma resposta 404 é enviada. O código continua.
        return res
          .status(404)
          .json({ error: "Orçamento não encontrado ou permissão negada." });
      }

      // 🛑 PONTO D: Antes de executar o UPDATE
      console.log(
        "[BACKEND PATCH] 3. Orçamento verificado e pronto para UPDATE."
      );

      // 2. Atualiza o campo específico
      const updateQuery = `
              UPDATE orcamentos
              SET geradoanoposterior = $1
              WHERE idorcamento = $2;
            `;
      const result = await client.query(updateQuery, [
        geradoAnoPosterior,
        idorcamento,
      ]);

      console.log("[BACKEND PATCH] Query Bruta (visível):", updateQuery);
      console.log(
        "[BACKEND PATCH] Query Bruta (sem espaços):",
        updateQuery.replace(/\s/g, "_")
      );

      if (result.rowCount === 0) {
        await client.query("ROLLBACK");
        // Aqui uma resposta 404 é enviada. O código continua.
        return res.status(404).json({ error: "Orçamento não foi atualizado." });
      }

      await client.query("COMMIT");

      // 🛑 PONTO E: Antes de enviar a resposta final
      console.log("[BACKEND PATCH] 4. COMMIT OK. Enviando resposta 200.");

      // Configuração para o log (se o logMiddleware estiver ativo)
      res.locals.acao = "espelhou";
      res.locals.idregistroalterado = idorcamento;
      res.locals.dadosNovos = {
        geradoanoposterior: geradoAnoPosterior // ✅ Só o campo que mudou
      };

      res
        .status(200)
        .json({
          message:
            "Status de espelhamento do orçamento atualizado com sucesso.",
        });
    } catch (error) {
      // 🛑 NOVO LOG PARA SABER SE CAIU NO CATCH
      console.error(
        "[BACKEND PATCH] !!! CAIU NO CATCH !!! Erro ao atualizar status:",
        error.message
      );

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
        const result = await client.query(
          "SELECT status FROM orcamentos WHERE idorcamento = $1",
          [idOrcamento]
        );
        return {
          dadosanteriores: result.rows[0]
            ? { status: result.rows[0].status }
            : null,
          idregistroalterado: idOrcamento,
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

    console.log(
      `[BACKEND PATCH] Tentando atualizar o status do Orçamento ${idorcamento} para: ${status}`
    );

    try {
      if (isNaN(idorcamento) || idorcamento <= 0) {
        return res.status(400).json({ error: "ID do Orçamento inválido." });
      }
      if (!status || typeof status !== "string") {
        return res
          .status(400)
          .json({
            error: "O campo 'status' é obrigatório e deve ser uma string.",
          });
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

      const result = await client.query(updateQuery, [
        status,
        idorcamento,
        idempresa,
      ]);

      if (result.rowCount === 0) {
        await client.query("ROLLBACK");
        return res
          .status(404)
          .json({ error: "Orçamento não encontrado ou permissão negada." });
      }

      await client.query("COMMIT");

      // Configuração para o log (logMiddleware)
      res.locals.acao = "atualizou status";
      res.locals.idregistroalterado = idorcamento;   
      res.locals.dadosNovos = {
        status // ✅ Só o campo que mudou
      };

      res
        .status(200)
        .json({
          success: true,
          message: `Status do orçamento atualizado para '${status}' com sucesso.`,
        });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(
        "❌ Erro ao atualizar o status do orçamento:",
        error.message
      );
      res
        .status(500)
        .json({
          error: "Erro interno ao atualizar o status do orçamento.",
          detail: error.message,
        });
    } finally {
      client.release();
    }
  }
);
module.exports = router;
