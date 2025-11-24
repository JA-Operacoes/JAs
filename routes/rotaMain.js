const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB");
const { autenticarToken, contextoEmpresa } = require('../middlewares/authMiddlewares');
const { verificarPermissao } = require('../middlewares/permissaoMiddleware');
const logMiddleware = require("../middlewares/logMiddleware");

router.get("/", async (req, res) => {
    const idempresa = req.headers.idempresa || req.query.idempresa;
    console.log("ROTA MAIN - idempresa recebido:", idempresa);

    // Total de orçamentos
    const { rows: orcamentosTotal } = await pool.query(
        `SELECT COUNT(*)::int AS total
         FROM orcamentos o
         JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
         WHERE oe.idempresa = $1`, [idempresa]
    );

    // Orçamentos abertos (status = 'A')
    const { rows: orcamentosAbertos } = await pool.query(
        `SELECT COUNT(*)::int AS total
         FROM orcamentos o
         JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
         WHERE oe.idempresa = $1 AND o.status = 'A'`, [idempresa]
    );

    // Orçamentos fechados (status = 'F')
    const { rows: orcamentosFechados } = await pool.query(
        `SELECT COUNT(*)::int AS total
         FROM orcamentos o
         JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
         WHERE oe.idempresa = $1 AND o.status = 'F'`, [idempresa]
    );

    // ... (demais queries para eventos, clientes, etc)

    res.json({
        orcamentos: orcamentosTotal[0].total,
        orcamentosAbertos: orcamentosAbertos[0].total,
        orcamentosFechados: orcamentosFechados[0].total,
        // eventos, clientes, pedidos, pedidosPendentes...
    });
});

router.get("/proximo-evento", async (req, res) => {
    try {
        const idempresa = req.headers.idempresa || req.query.idempresa;
        if (!idempresa) return res.status(400).json({ error: "idempresa não fornecido" });

        // Busca todos os eventos da empresa nos próximos 5 dias (inclusive hoje)
        const { rows: eventos } = await pool.query(
            `SELECT e.nmevento, o.dtinimontagem
            FROM orcamentos o
            JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
            JOIN eventos e ON e.idevento = o.idevento
            WHERE oe.idempresa = $1
              AND o.dtinimontagem >= CURRENT_DATE
              AND o.dtinimontagem <= CURRENT_DATE + INTERVAL '5 days'
            ORDER BY o.dtinimontagem`,
            [idempresa]
        );

        if (!eventos || eventos.length === 0) {
            return res.json({ eventos: [] });
        }

        // Monta resposta agrupando por data para facilitar o frontend
        const eventosPorData = {};
        eventos.forEach(ev => {
            const dataStr = ev.dtinimontagem.toISOString().split("T")[0]; // "YYYY-MM-DD"
            if (!eventosPorData[dataStr]) eventosPorData[dataStr] = [];
            eventosPorData[dataStr].push({ nmevento: ev.nmevento, data: ev.dtinimontagem });
        });

        // Flatten em um array para o frontend processar
        const respostaFormatada = [];
        Object.keys(eventosPorData).sort().forEach(data => {
            eventosPorData[data].forEach(ev => respostaFormatada.push(ev));
        });

        res.json({ eventos: respostaFormatada });

    } catch (err) {
        console.error("Erro em /proximo-evento:", err);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

router.get("/eventos-calendario", async (req, res) => {
    try {
        const idempresa = req.headers.idempresa || req.query.idempresa;
        const ano = req.query.ano;
        const mes = req.query.mes;

        if (!idempresa) return res.status(400).json({ error: "idempresa não fornecido" });
        if (!ano || !mes) return res.status(400).json({ error: "ano e mes são obrigatórios" });

        // Busca todos os eventos do mês/ano informado, incluindo idevento
        const { rows: eventos } = await pool.query(`
            SELECT DISTINCT ON (e.idevento, o.dtiniinframontagem, o.dtfiminframontagem,
                               o.dtinimarcacao, o.dtfimmarcacao,
                               o.dtinimontagem, o.dtfimmontagem,
                               o.dtinirealizacao, o.dtfimdesmontagem,
                               o.dtinidesmontagem, o.dtfimdesmontagem,
                               o.dtiniinfradesmontagem, o.dtfiminfradesmontagem)
                   e.idevento,
                   e.nmevento || 
                   CASE 
                       WHEN COUNT(*) OVER (PARTITION BY e.idevento, o.dtiniinframontagem, o.dtfiminframontagem,
                                           o.dtinimarcacao, o.dtfimmarcacao,
                                           o.dtinimontagem, o.dtfimmontagem,
                                           o.dtinirealizacao, o.dtfimdesmontagem,
                                           o.dtinidesmontagem, o.dtfimdesmontagem,
                                           o.dtiniinfradesmontagem, o.dtfiminfradesmontagem) > 1 
                       THEN ' - ' || COALESCE(o.nomenclatura, '') 
                       ELSE '' 
                   END AS evento_nome,
                   o.dtiniinframontagem, o.dtfiminframontagem,
                   o.dtinimarcacao, o.dtfimmarcacao,
                   o.dtinimontagem, o.dtfimmontagem,
                   o.dtinirealizacao, o.dtfimdesmontagem,
                   o.dtinidesmontagem, o.dtfimdesmontagem,
                   o.dtiniinfradesmontagem, o.dtfiminfradesmontagem
            FROM orcamentos o
            JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
            JOIN eventos e ON e.idevento = o.idevento
            WHERE oe.idempresa = $1
            AND (
                  (EXTRACT(YEAR FROM o.dtiniinframontagem) = $2 AND EXTRACT(MONTH FROM o.dtiniinframontagem) = $3) OR
                  (EXTRACT(YEAR FROM o.dtfiminframontagem) = $2 AND EXTRACT(MONTH FROM o.dtfiminframontagem) = $3) OR
                  (EXTRACT(YEAR FROM o.dtinimarcacao) = $2 AND EXTRACT(MONTH FROM o.dtinimarcacao) = $3) OR
                  (EXTRACT(YEAR FROM o.dtfimmarcacao) = $2 AND EXTRACT(MONTH FROM o.dtfimmarcacao) = $3) OR
                  (EXTRACT(YEAR FROM o.dtinimontagem) = $2 AND EXTRACT(MONTH FROM o.dtinimontagem) = $3) OR
                  (EXTRACT(YEAR FROM o.dtfimmontagem) = $2 AND EXTRACT(MONTH FROM o.dtfimmontagem) = $3) OR
                  (EXTRACT(YEAR FROM o.dtinirealizacao) = $2 AND EXTRACT(MONTH FROM o.dtinirealizacao) = $3) OR
                  (EXTRACT(YEAR FROM o.dtfimdesmontagem) = $2 AND EXTRACT(MONTH FROM o.dtfimdesmontagem) = $3) OR
                  (EXTRACT(YEAR FROM o.dtinidesmontagem) = $2 AND EXTRACT(MONTH FROM o.dtinidesmontagem) = $3) OR
                  (EXTRACT(YEAR FROM o.dtfimdesmontagem) = $2 AND EXTRACT(MONTH FROM o.dtfimdesmontagem) = $3) OR
                  (EXTRACT(YEAR FROM o.dtiniinfradesmontagem) = $2 AND EXTRACT(MONTH FROM o.dtiniinfradesmontagem) = $3) OR
                  (EXTRACT(YEAR FROM o.dtfiminfradesmontagem) = $2 AND EXTRACT(MONTH FROM o.dtfiminfradesmontagem) = $3)
                )
            ORDER BY e.idevento, o.dtiniinframontagem, o.dtinimarcacao;
        `, [idempresa, ano, mes]);

        if (!eventos || eventos.length === 0) return res.json({ eventos: [] });

        const resposta = [];

        eventos.forEach(ev => {
            const fases = [
                { tipo: "Montagem Infra", inicio: ev.dtiniinframontagem, fim: ev.dtfiminframontagem },
                { tipo: "Marcação",        inicio: ev.dtinimarcacao,  fim: ev.dtfimmarcacao },
                { tipo: "Montagem",        inicio: ev.dtinimontagem,  fim: ev.dtfimmontagem },
                { tipo: "Realização",      inicio: ev.dtinirealizacao, fim: ev.dtfimdesmontagem },
                { tipo: "Desmontagem",     inicio: ev.dtinidesmontagem, fim: ev.dtfimdesmontagem },
                { tipo: "Desmontagem Infra", inicio: ev.dtiniinfradesmontagem, fim: ev.dtfiminfradesmontagem },
            ];

            fases.forEach(f => {
                if (f.inicio) {
                    resposta.push({
                        idevento: ev.idevento,
                        nome: ev.evento_nome,
                        inicio: f.inicio.toISOString().split("T")[0],
                        fim: f.fim ? f.fim.toISOString().split("T")[0] : f.inicio.toISOString().split("T")[0],
                        tipo: f.tipo
                    });
                }
            });
        });

        res.json({ eventos: resposta });

    } catch (err) {
        console.error("Erro em /eventos-calendario:", err);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});
router.get("/eventos-staff", async (req, res) => {
    try {
        const idempresa = req.headers.idempresa || req.query.idempresa;
        const idevento = req.query.idevento;

        if (!idempresa) return res.status(400).json({ error: "idempresa não fornecido" });
        if (!idevento) return res.status(400).json({ error: "idevento não fornecido" });

        const { rows } = await pool.query(
            `SELECT DISTINCT
                e.nmevento,
                se.nmfuncionario AS funcionario,
                se.nmfuncao AS funcao
              FROM staffeventos se
              JOIN staffempresas sem ON se.idstaff = sem.idstaff
              JOIN eventos e ON e.idevento = se.idevento
              WHERE sem.idempresa = $1
                AND se.idevento = $2
              ORDER BY se.nmfuncionario`,
            [idempresa, idevento]
        );

        if (rows.length === 0) {
            return res.json({ staff: null });
        }

        const resposta = {
            nmevento: rows[0].nmevento,
            pessoas: rows.map(r => ({
                funcionario: r.funcionario,
                funcao: r.funcao
            }))
        };

        res.json({ staff: resposta });
    } catch (err) {
        console.error("Erro em /eventos-staff:", err);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});


// ROTA: /eventos-abertos
router.get("/eventos-abertos", async (req, res) => {
    try {
        // Validação e setup
        const idempresa = req.headers.idempresa || req.query.idempresa;
        // Assume ano atual se não fornecido
        const ano = req.query.ano ? Number(req.query.ano) : new Date().getFullYear();

        if (!idempresa) return res.status(400).json({ error: "idempresa não fornecido" });
        
        const params = [idempresa, ano];

        // SQL base com CTEs - Focada em Orçamentos e Vagas
        const baseSql = `
            WITH vagas_orc AS (
                SELECT 
                    o.idevento,
                    lm.descmontagem AS nmlocalmontagem,
                    o.idmontagem, 
                    MAX(o.nrorcamento) AS nrorcamento,
                    SUM(i.qtditens) AS total_vagas,
                    MIN(o.dtinimarcacao) AS dtinimarcacao,
                    MAX(o.dtfimmarcacao) AS dtfimmarcacao,
                    MIN(o.dtinimontagem) AS dtinimontagem,
                    MAX(o.dtfimmontagem) AS dtfimmontagem,
                    MIN(o.dtinirealizacao) AS dtinirealizacao,
                    MAX(o.dtfimrealizacao) AS dtfimrealizacao,
                    MIN(o.dtinidesmontagem) AS dtinidesmontagem,
                    MAX(o.dtfimdesmontagem) AS dtfimdesmontagem,
                    MIN(o.dtiniinframontagem) AS dtiniinframontagem,
                    MAX(o.dtfiminframontagem) AS dtfiminframontagem,
                    MIN(o.dtiniinfradesmontagem) AS dtiniinfradesmontagem,
                    MAX(o.dtfiminfradesmontagem) AS dtfiminfradesmontagem,
                    array_agg(DISTINCT f.idequipe) FILTER (WHERE f.idequipe IS NOT NULL) AS equipes_ids,
                    array_agg(DISTINCT eq.nmequipe) FILTER (WHERE eq.nmequipe IS NOT NULL) AS equipes_nomes,
                    array_agg(DISTINCT p.nmpavilhao) FILTER (WHERE p.nmpavilhao IS NOT NULL) AS pavilhoes_nomes,
                    (
                        SELECT json_agg(row_to_json(t))
                        FROM (
                            SELECT 
                                eq2.idequipe,
                                eq2.nmequipe AS equipe,
                                i2.idfuncao, -- << ADICIONE AQUI O ID DA FUNÇÃO
                                f2.descfuncao AS nome_funcao, -- << TALVEZ VOCÊ PRECISE DO NOME DA FUNÇÃO AQUI
                                SUM(i2.qtditens) AS total_vagas
                            FROM orcamentoitens i2
                            JOIN funcao f2 ON f2.idfuncao = i2.idfuncao
                            JOIN equipe eq2 ON eq2.idequipe = f2.idequipe
                            JOIN orcamentos o2 ON o2.idorcamento = i2.idorcamento
                            WHERE o2.idevento = o.idevento
                            -- ✅ FILTRO CORRIGIDO: i2.categoria = 'Produto(s)' (SUBQUERY)
                            AND i2.categoria = 'Produto(s)' 
                            --GROUP BY eq2.nmequipe, lm.descmontagem, o.idmontagem
                            GROUP BY eq2.idequipe, eq2.nmequipe, i2.idfuncao, f2.descfuncao
                        ) AS t
                    ) AS equipes_detalhes_base
                FROM orcamentoitens i
                JOIN orcamentos o ON i.idorcamento = o.idorcamento
                JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
                LEFT JOIN localmontagem lm ON lm.idmontagem = o.idmontagem
                LEFT JOIN funcao f ON f.idfuncao = i.idfuncao
                LEFT JOIN equipe eq ON eq.idequipe = f.idequipe
                LEFT JOIN orcamentopavilhoes op ON op.idorcamento = o.idorcamento
                LEFT JOIN localmontpavilhao p ON p.idpavilhao = op.idpavilhao
                WHERE o.idevento IS NOT NULL
                    AND oe.idempresa = $1 
                    AND EXTRACT(YEAR FROM o.dtinirealizacao) = $2
                    -- ✅ FILTRO CORRIGIDO: i.categoria = 'Produto(s)' (MAIN QUERY)
                    AND i.categoria = 'Produto(s)' 
                GROUP BY o.idevento, lm.descmontagem, o.idmontagem
            ),
            staff_contagem AS (
                SELECT 
                    se.idevento,
                    COUNT(se.idstaffevento) AS total_staff
                FROM staffeventos se
                JOIN orcamentos o ON se.idevento = o.idevento
                JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
                WHERE oe.idempresa = $1
                    AND EXISTS (
                        SELECT 1
                        FROM jsonb_array_elements_text(se.datasevento) AS d(dt)
                        WHERE (d.dt)::date BETWEEN o.dtinimontagem AND o.dtfimdesmontagem
                    )
                GROUP BY se.idevento
            ),
            staff_por_equipe AS (
                SELECT 
                    se.idevento,
                    eq.nmequipe,
                    COUNT(se.idstaffevento) AS preenchidas
                FROM staffeventos se
                JOIN funcao f ON f.idfuncao = se.idfuncao
                JOIN equipe eq ON eq.idequipe = f.idequipe
                JOIN orcamentos o ON o.idevento = se.idevento
                JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
                WHERE oe.idempresa = $1 
                GROUP BY se.idevento, eq.nmequipe
            ),
            staff_datas_por_funcao AS (
                SELECT
                    se.idevento,
                    se.idfuncao,
                    array_agg(DISTINCT d.dt) AS datas_staff
                FROM staffeventos se
                LEFT JOIN LATERAL jsonb_array_elements_text(se.datasevento) AS d(dt) 
                    ON TRUE
                JOIN orcamentos o ON se.idevento = o.idevento
                JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
                WHERE oe.idempresa = $1
                GROUP BY se.idevento, se.idfuncao
            ),
            cliente_info AS (
                -- CTE para buscar o idcliente e nmfantasia (nome do cliente)
                SELECT DISTINCT ON (o.idevento)
                    o.idevento,
                    c.idcliente,
                    c.nmfantasia
                FROM orcamentos o
                JOIN clientes c ON c.idcliente = o.idcliente
                WHERE o.idevento IS NOT NULL
                ORDER BY o.idevento, o.dtinirealizacao DESC 
            )
            SELECT 
                e.idevento,
                e.nmevento,
                vo.nmlocalmontagem,
                vo.idmontagem,
                vo.nrorcamento,
                ci.idcliente,      
                ci.nmfantasia,
                COALESCE(vo.pavilhoes_nomes, ARRAY[]::text[]) AS pavilhoes_nomes,    
                COALESCE(vo.dtinirealizacao, CURRENT_DATE) AS dtinirealizacao,
                COALESCE(vo.dtfimrealizacao, CURRENT_DATE) AS dtfimrealizacao,
                COALESCE(vo.dtinimarcacao, CURRENT_DATE) AS dtinimarcacao,
                COALESCE(vo.dtfimdesmontagem, CURRENT_DATE) AS dtfimdesmontagem,
                COALESCE(vo.total_vagas, 0) AS total_vagas,
                COALESCE(sc.total_staff, 0) AS total_staff,
                (COALESCE(vo.total_vagas, 0) - COALESCE(sc.total_staff, 0)) AS vagas_restantes,
                COALESCE(vo.equipes_ids, ARRAY[]::int[]) AS equipes_ids,
                COALESCE(vo.equipes_nomes, ARRAY[]::text[]) AS equipes_nomes,
                (
                    SELECT json_agg(
                        json_build_object(
                            'idequipe', (b->>'idequipe')::int,
                            'equipe', b->>'equipe',
                            'idfuncao', (b->>'idfuncao')::int,
                            'nome_funcao', b->>'nome_funcao',
                            'total_vagas', (b->>'total_vagas')::int,
                            'preenchidas', COALESCE(sp.preenchidas, 0),
                            'datas_staff', COALESCE(sdf.datas_staff, ARRAY[]::text[])
                        )
                    )
                    FROM json_array_elements(vo.equipes_detalhes_base) AS b
                    LEFT JOIN staff_por_equipe sp ON sp.idevento = e.idevento AND sp.nmequipe = b->>'equipe'
                    LEFT JOIN staff_datas_por_funcao sdf ON sdf.idevento = e.idevento AND sdf.idfuncao = (b->>'idfuncao')::int
                ) AS equipes_detalhes,
                'aberto' AS status_evento
            FROM eventos e
            INNER JOIN vagas_orc vo ON vo.idevento = e.idevento
            LEFT JOIN staff_contagem sc ON sc.idevento = e.idevento
            LEFT JOIN cliente_info ci ON ci.idevento = e.idevento
        `;

        // CLÁUSULA WHERE para eventos ABERTOS (data futura OU vagas restantes)
        const whereClause = `
            WHERE (vo.dtfimdesmontagem IS NULL OR vo.dtfimdesmontagem >= CURRENT_DATE) 
        `;

        // Ordem crescente para próximos eventos
        const orderClause = ` ORDER BY COALESCE(vo.dtinirealizacao, CURRENT_DATE) ASC;`;

        const finalSql = baseSql + "\n" + whereClause + "\n" + orderClause;

        const { rows } = await pool.query(finalSql, params);
        return res.json(rows);
    } catch (err) {
        console.error("Erro em /eventos-abertos:", err);
        // Não expõe detalhes do erro em produção
        res.status(500).json({ error: "Erro interno ao buscar eventos abertos." });
    }
});

// ROTA: /eventos-fechados
router.get("/eventos-fechados", async (req, res) => {
    try {
        // Validação e setup
        const idempresa = req.headers.idempresa || req.query.idempresa;
        // Assume ano atual se não fornecido
        const ano = req.query.ano ? Number(req.query.ano) : new Date().getFullYear();

        if (!idempresa) {
            return res.status(400).json({ error: "idempresa não fornecido." });
        }
        
        const params = [idempresa, ano];

        // SQL base com CTEs - Focada em Orçamentos e Vagas
        const baseSql = `
            WITH vagas_orc AS (
                SELECT 
                    o.idevento, o.idmontagem,
                    lm.descmontagem AS nmlocalmontagem,
                    MAX(o.nrorcamento) AS nrorcamento,
                    SUM(i.qtditens) AS total_vagas,
                    MIN(o.dtinimarcacao) AS dtinimarcacao,
                    MAX(o.dtfimmarcacao) AS dtfimmarcacao,
                    MIN(o.dtinimontagem) AS dtinimontagem,
                    MAX(o.dtfimmontagem) AS dtfimmontagem,
                    MIN(o.dtinirealizacao) AS dtinirealizacao,
                    MAX(o.dtfimrealizacao) AS dtfimrealizacao,
                    MIN(o.dtinidesmontagem) AS dtinidesmontagem,
                    MAX(o.dtfimdesmontagem) AS dtfimdesmontagem,
                    MIN(o.dtiniinframontagem) AS dtiniinframontagem,
                    MAX(o.dtfiminframontagem) AS dtfiminframontagem,
                    MIN(o.dtiniinfradesmontagem) AS dtiniinfradesmontagem,
                    MAX(o.dtfiminfradesmontagem) AS dtfiminfradesmontagem,
                    array_agg(DISTINCT f.idequipe) FILTER (WHERE f.idequipe IS NOT NULL) AS equipes_ids,
                    array_agg(DISTINCT eq.nmequipe) FILTER (WHERE eq.nmequipe IS NOT NULL) AS equipes_nomes,
                    array_agg(DISTINCT p.nmpavilhao) FILTER (WHERE p.nmpavilhao IS NOT NULL) AS pavilhoes_nomes,
                    (
                        SELECT json_agg(row_to_json(t))
                        FROM (
                            SELECT 
                                eq2.idequipe,
                                eq2.nmequipe AS equipe,
                                i2.idfuncao, -- << ADICIONE AQUI O ID DA FUNÇÃO
                                f2.descfuncao AS nome_funcao, -- << TALVEZ VOCÊ PRECISE DO NOME DA FUNÇÃO AQUI
                                SUM(i2.qtditens) AS total_vagas,
                                MIN(i2.periododiariasinicio) AS dtini_vaga,
                                MAX(i2.periododiariasfim) AS dtfim_vaga
                            FROM orcamentoitens i2
                            JOIN funcao f2 ON f2.idfuncao = i2.idfuncao
                            JOIN equipe eq2 ON eq2.idequipe = f2.idequipe
                            JOIN orcamentos o2 ON o2.idorcamento = i2.idorcamento
                            WHERE o2.idevento = o.idevento
                            -- 🛑 FILTRO APLICADO: CATEGORIA 'Produto(s)' (SUBQUERY)
                            AND i2.categoria = 'Produto(s)' 
                            GROUP BY eq2.idequipe, eq2.nmequipe, i2.idfuncao, f2.descfuncao
                        ) AS t
                    ) AS equipes_detalhes_base
                FROM orcamentoitens i
                JOIN orcamentos o ON i.idorcamento = o.idorcamento
                JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
                LEFT JOIN localmontagem lm ON lm.idmontagem = o.idmontagem
                LEFT JOIN funcao f ON f.idfuncao = i.idfuncao
                LEFT JOIN equipe eq ON eq.idequipe = f.idequipe
                LEFT JOIN orcamentopavilhoes op ON op.idorcamento = o.idorcamento
                LEFT JOIN localmontpavilhao p ON p.idpavilhao = op.idpavilhao
                WHERE o.idevento IS NOT NULL
                    AND oe.idempresa = $1
                    AND EXTRACT(YEAR FROM o.dtinirealizacao) = $2
                    -- 🛑 FILTRO APLICADO: CATEGORIA 'Produto(s)' (MAIN QUERY)
                    AND i.categoria = 'Produto(s)'
                GROUP BY o.idevento, o.idmontagem, lm.descmontagem
            ),
            staff_contagem AS (
                SELECT 
                    se.idevento,
                    COUNT(se.idstaffevento) AS total_staff
                FROM staffeventos se
                JOIN orcamentos o ON se.idevento = o.idevento
                JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
                WHERE oe.idempresa = $1
                    AND EXISTS (
                        SELECT 1
                        FROM jsonb_array_elements_text(se.datasevento) AS d(dt)
                        WHERE (d.dt)::date BETWEEN o.dtinimontagem AND o.dtfimdesmontagem
                    )
                GROUP BY se.idevento
            ),
            staff_por_equipe AS (
                SELECT 
                    se.idevento,
                    eq.nmequipe,
                    COUNT(se.idstaffevento) AS preenchidas
                FROM staffeventos se
                JOIN funcao f ON f.idfuncao = se.idfuncao
                JOIN equipe eq ON eq.idequipe = f.idequipe
                JOIN orcamentos o ON o.idevento = se.idevento
                JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
                WHERE oe.idempresa = $1
                GROUP BY se.idevento, eq.nmequipe
            ),
            staff_datas_por_funcao AS (
                SELECT
                    se.idevento,
                    se.idfuncao,
                    -- ✅ CORRIGIDO: Agrega as colunas retornadas pelo LATERAL JOIN
                    array_agg(DISTINCT d.dt) AS datas_staff
                FROM staffeventos se
                -- ✅ NOVO: Usa LATERAL para expandir o array JSON em linhas
                LEFT JOIN LATERAL jsonb_array_elements_text(se.datasevento) AS d(dt) 
                    ON TRUE
                JOIN orcamentos o ON se.idevento = o.idevento
                JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
                WHERE oe.idempresa = $1
                GROUP BY se.idevento, se.idfuncao
            ),        
            cliente_info AS (
                -- CTE para buscar o idcliente e nmfantasia (nome do cliente)
                SELECT DISTINCT ON (o.idevento)
                    o.idevento,
                    c.idcliente,
                    c.nmfantasia
                FROM orcamentos o
                JOIN clientes c ON c.idcliente = o.idcliente
                WHERE o.idevento IS NOT NULL
                ORDER BY o.idevento, o.dtinirealizacao DESC 
            )
            SELECT 
                e.idevento,
                e.nmevento,
                vo.idmontagem,
                vo.nmlocalmontagem,
                vo.nrorcamento,
                ci.idcliente,      
                ci.nmfantasia,
                COALESCE(vo.pavilhoes_nomes, ARRAY[]::text[]) AS pavilhoes_nomes,
                COALESCE(vo.pavilhoes_nomes, ARRAY[]::text[]) AS pavilhoes_nomes,     
                COALESCE(vo.dtinirealizacao, CURRENT_DATE) AS dtinirealizacao,
                COALESCE(vo.dtfimrealizacao, CURRENT_DATE) AS dtfimrealizacao,
                COALESCE(vo.dtinimarcacao, CURRENT_DATE) AS dtinimarcacao,
                COALESCE(vo.dtfimdesmontagem, CURRENT_DATE) AS dtfimdesmontagem,
                COALESCE(vo.total_vagas, 0) AS total_vagas,
                COALESCE(sc.total_staff, 0) AS total_staff,
                (COALESCE(vo.total_vagas, 0) - COALESCE(sc.total_staff, 0)) AS vagas_restantes,
                COALESCE(vo.equipes_ids, ARRAY[]::int[]) AS equipes_ids,
                COALESCE(vo.equipes_nomes, ARRAY[]::text[]) AS equipes_nomes,
                (
                    SELECT json_agg(
                        json_build_object(
                            'idequipe', (b->>'idequipe')::int,
                            'equipe', b->>'equipe',
                            'idfuncao', (b->>'idfuncao')::int,
                            'nome_funcao', b->>'nome_funcao',
                            'total_vagas', (b->>'total_vagas')::int,
                            'preenchidas', COALESCE(sp.preenchidas, 0),
                            'dtini_vaga', b->>'dtini_vaga',
                            'dtfim_vaga', b->>'dtfim_vaga',
                            'datas_staff', COALESCE(sdf.datas_staff, ARRAY[]::text[])
                        )
                    )
                    FROM json_array_elements(vo.equipes_detalhes_base) AS b
                    LEFT JOIN staff_por_equipe sp ON sp.idevento = e.idevento AND sp.nmequipe = b->>'equipe'
                    LEFT JOIN staff_datas_por_funcao sdf ON sdf.idevento = e.idevento AND sdf.idfuncao = (b->>'idfuncao')::int
                ) AS equipes_detalhes,
                'fechado' AS status_evento
            FROM eventos e
            -- CHAVE DE CORREÇÃO: Usar INNER JOIN para garantir que o evento tenha orçamento
            INNER JOIN vagas_orc vo ON vo.idevento = e.idevento
            LEFT JOIN staff_contagem sc ON sc.idevento = e.idevento
            LEFT JOIN cliente_info ci ON ci.idevento = e.idevento -- NOVO JOIN para cliente
          `;

        // CLÁUSULA WHERE para eventos FECHADOS:
        const whereClause = `
            -- Eventos com data de desmontagem anterior à data atual OU eventos com vagas completas
            WHERE (vo.dtfimdesmontagem IS NOT NULL AND vo.dtfimdesmontagem < CURRENT_DATE) 
          `;

        // Ordem decrescente para eventos mais recentes
        const orderClause = ` ORDER BY COALESCE(vo.dtinirealizacao, CURRENT_DATE) DESC;`;

        const finalSql = baseSql + "\n" + whereClause + "\n" + orderClause;

        const { rows } = await pool.query(finalSql, params);

        return res.json(rows);
    } catch (err) {
        console.error("Erro em /eventos-fechados:", err);
        res.status(500).json({ error: "Erro interno ao buscar eventos fechados." });
    }
});





router.get("/detalhes-eventos-abertos", async (req, res) => {
  try {
    const idevento = req.query.idevento || req.headers.idevento;
    const idempresa = req.query.idempresa || req.headers.idempresa;

    if (!idevento || !idempresa) {
      return res.status(400).json({ error: "idevento e idempresa são obrigatórios." });
    }

    // 1️⃣ Busca orçamento vinculado
    const { rows: orcamentos } = await pool.query(
      `SELECT o.nrorcamento, o.idcliente, o.idmontagem
       FROM orcamentos o
       JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
       WHERE o.idevento = $1 AND oe.idempresa = $2
       LIMIT 1`,
      [idevento, idempresa]
    );

    if (!orcamentos.length) {
      return res.status(200).json({ equipes: [] });
    }

    const { nrorcamento, idcliente, idmontagem } = orcamentos[0];



    // 2️⃣ Busca equipes e funções previstas
    const { rows: itensOrcamento } = await pool.query(
      `SELECT 
         e.idequipe,
         e.nmequipe AS equipe,
         f.idfuncao,
         f.descfuncao AS funcao,
         COALESCE(SUM(oi.qtditens), 0) AS qtd_orcamento,
         MIN(oi.periododiariasinicio) AS dtini_vaga,
         MAX(oi.periododiariasfim) AS dtfim_vaga
       FROM orcamentoitens oi
       LEFT JOIN funcao f ON f.idfuncao = oi.idfuncao
       LEFT JOIN equipe e ON e.idequipe = f.idequipe
       LEFT JOIN orcamentos o ON o.idorcamento = oi.idorcamento
       JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
       WHERE o.idevento = $1 AND oe.idempresa = $2
       GROUP BY e.idequipe, e.nmequipe, f.idfuncao, f.descfuncao
       ORDER BY e.nmequipe, f.descfuncao`,
      [idevento, idempresa]
    );

    if (!itensOrcamento.length) {
      return res.status(200).json({ equipes: [] });
    }

    // 3️⃣ Busca quantidades cadastradas
    const { rows: staff } = await pool.query(
      `SELECT 
         se.idfuncao,
         COUNT(se.idstaffevento) AS qtd_cadastrada
       FROM staffeventos se
       WHERE se.idevento = $1 AND se.idcliente = $2
       GROUP BY se.idfuncao`,
      [idevento, idcliente]
    );

    // 4️⃣ Agrupa por equipe
    // const equipesMap = {};
    // for (const item of itensOrcamento) {
    //   const equipeNome = item.equipe || "Sem equipe";
    //   if (!equipesMap[equipeNome]) equipesMap[equipeNome] = [];

    //   const cadastrado = staff.find(s => s.idfuncao === item.idfuncao);
    //   const qtd_cadastrada = cadastrado ? Number(cadastrado.qtd_cadastrada) : 0;

    //   equipesMap[equipeNome].push({
    //     nome: item.funcao,
    //     qtd_orcamento: Number(item.qtd_orcamento) || 0,
    //     qtd_cadastrada,
    //     concluido: qtd_cadastrada >= (Number(item.qtd_orcamento) || 0)
    //   });
    // }

    // // 5️⃣ Monta retorno final
    // const equipesDetalhes = Object.entries(equipesMap).map(([nome, funcoes]) => ({
    //   equipe: nome,
    //   funcoes
    // }));

    // res.status(200).json({ equipes: equipesDetalhes });


    // 4️⃣ Busca Datas de Staff por Função
    const { rows: datasStaffRaw } = await pool.query(
      `SELECT
        se.idfuncao,
        -- Expande o array JSON em linhas e agrega novamente (resolvendo o problema 0A000)
        array_agg(DISTINCT d.dt ORDER BY d.dt) AS datas_staff
      FROM staffeventos se
      LEFT JOIN LATERAL jsonb_array_elements_text(se.datasevento) AS d(dt) 
        ON TRUE
      WHERE se.idevento = $1 AND se.idcliente = $2 AND se.datasevento IS NOT NULL
      GROUP BY se.idfuncao`,
      [idevento, idcliente]
    );

    // Mapeia para fácil acesso (idfuncao -> array de datas)
    const datasStaffMap = datasStaffRaw.reduce((acc, row) => {
        acc[String(row.idfuncao)] = row.datas_staff;
        return acc;
    }, {});

    // 5️⃣ Agrupa por equipe
    // 🚨 CORREÇÃO: Usar idequipe como chave e preservar idfuncao
    const equipesMap = {};
    for (const item of itensOrcamento) {
        const idequipe = item.idequipe; // Objeto item tem idequipe (do SELECT)
        const idequipeKey = idequipe || "SEM_EQUIPE"; // Chave de agrupamento robusta

        // 1. Inicializa o objeto de equipe se ainda não existir
        if (!equipesMap[idequipeKey]) {
            equipesMap[idequipeKey] = {
                equipe: item.equipe || "Sem equipe",
                idequipe: idequipe, // ✅ idequipe incluído
                funcoes: [],
            };
        }

        // 2. Encontra a quantidade de staff já cadastrada
        const cadastrado = staff.find(s => String(s.idfuncao) === String(item.idfuncao)); 
        const qtd_cadastrada = cadastrado ? Number(cadastrado.qtd_cadastrada) : 0;
        
        // 3. Obtém as datas preenchidas
        const datas_staff = datasStaffMap[String(item.idfuncao)] || [];

        // 4. Adiciona a função com todos os detalhes
        equipesMap[idequipeKey].funcoes.push({
            idfuncao: item.idfuncao, // ✅ idfuncao incluído
            nome: item.funcao,
            qtd_orcamento: Number(item.qtd_orcamento) || 0,
            qtd_cadastrada,
            concluido: qtd_cadastrada >= (Number(item.qtd_orcamento) || 0),
            // ✅ ADICIONADO: Datas da Vaga (do itensOrcamento)
            dtini_vaga: item.dtini_vaga,
            dtfim_vaga: item.dtfim_vaga,

            // ✅ ADICIONADO: Datas Staff (do datasStaffMap)
            datas_staff: datas_staff
        });
    }

    // 6️⃣ Monta retorno final
    // Usa Object.values para obter a lista de equipes já com idequipe
    const equipesDetalhes = Object.values(equipesMap);

    // 7 Retorna o objeto completo com os IDs
    res.status(200).json({ equipes: equipesDetalhes, idmontagem });
    // // ...

  } catch (err) {
    console.error("Erro ao buscar detalhes dos eventos abertos:", err);
    res.status(500).json({ error: "Erro interno ao buscar detalhes dos eventos abertos." });
  }
});


router.get("/ListarFuncionarios", async (req, res) => {

  console.log("entrou na ListarFuncionarios");
    
    // 🛑 ATUALIZAÇÃO 1: Coleta IDs de Evento/Equipe de req.query (como o frontend envia)
    const { idEvento, idEquipe } = req.query;

    // 🛑 ATUALIZAÇÃO 2: Coleta idempresa de forma flexível (como o /eventos-fechados)
    // Prioriza o que vem do middleware (req.idempresa) ou, em fallback, da query string.
    const idempresa = req.idempresa || req.query.idempresa; 

    if (!idEvento || !idEquipe || !idempresa) {
        return res.status(400).json({ erro: 'IDs de Evento, Equipe e Empresa são obrigatórios.' });
    }

    console.log("IDs recebidos - Evento:", idEvento, "Equipe:", idEquipe, "Empresa:", idempresa);

    // Conversão para inteiro e validação de segurança
    const ideventoNum = parseInt(idEvento);
    const idequipeNum = parseInt(idEquipe);
    const idempresaNum = parseInt(idempresa);
    
    if (isNaN(ideventoNum) || isNaN(idequipeNum) || isNaN(idempresaNum)) {
        return res.status(400).json({ erro: 'Um ou mais IDs fornecidos não são válidos (devem ser numéricos).' });
    }

    try {
        // idevento é $1, idequipe é $2, idempresa é $3
        const query = `
            SELECT 
                se.idstaffevento,
                se.idfuncionario,
                se.nmfuncionario AS nome,
                se.nmevento AS evento,
                se.nmequipe AS equipe,
                se.nmfuncao AS funcao,    
                se.nivelexperiencia,
                se.vlrtotal,
                se.statuspgto AS status_pagamento, 
                se.setor,
                se.qtdpessoaslote
            FROM 
                public.staffeventos se
            
            INNER JOIN 
                orcamentos o ON o.idevento = se.idevento
            INNER JOIN
                orcamentoempresas oe ON oe.idorcamento = o.idorcamento
            
            WHERE 
                se.idevento = $1   
                AND se.idequipe = $2   
                AND oe.idempresa = $3  
            ORDER BY 
                se.nmfuncao, se.nmfuncionario; 
        `;
        
        const { rows } = await pool.query(query, [ideventoNum, idequipeNum, idempresaNum]);

        res.status(200).json(rows);

    } catch (erro) {
        console.error('❌ Erro ao buscar funcionários por equipe:', erro);
        res.status(500).json({ erro: 'Erro interno ao listar funcionários da equipe.' });
    }
});




router.get("/atividades-recentes", async (req, res) => {
    try {
        const idexecutor = req.headers.idexecutor || req.query.idexecutor;
        if (!idexecutor) {
            return res.status(400).json({ error: "Executor não informado" });
        }

        const { rows } = await pool.query(
            `SELECT acao, modulo, idregistroalterado, dadosanteriores, dadosnovos, criado_em
            FROM logs
            WHERE idexecutor = $1
            ORDER BY criado_em DESC`,
            [idexecutor]
        );

        res.json(rows);
    } catch (err) {
        console.error("Erro ao buscar atividades recentes:", err);
        res.status(500).json({ error: "Erro ao buscar atividades" });
    }
});

// routes/rotaMain.js
// GET /main/notificacoes-financeiras
router.get('/notificacoes-financeiras', async (req, res) => {
  try {
    const idempresa = req.idempresa || req.headers.idempresa;
    const idusuario = req.usuario?.idusuario || req.headers.idusuario;

    if (!idempresa) return res.status(400).json({ error: 'Empresa não informada' });
    if (!idusuario) return res.status(400).json({ error: 'Usuário não informado' });

    // Checa se o usuário é Master no Staff via tabela de permissões
    const { rows: permissoes } = await pool.query(`
      SELECT * FROM permissoes 
      WHERE idusuario = $1 AND modulo = 'Staff' AND master = 'true'
    `, [idusuario]);
    const ehMasterStaff = permissoes.length > 0;

    // Busca logs (trazendo também status atuais da tabela staffeventos e dtfim das "ordens")
    const { rows } = await pool.query(`
   SELECT DISTINCT ON (
    COALESCE(l.idusuarioalvo, (l.dadosnovos->>'idfuncionario')::int),
    COALESCE(e.idevento, (l.dadosnovos->>'idevento')::int),
    COALESCE(se.vlrcaixinha, (l.dadosnovos->>'vlrcaixinha')::numeric),
    COALESCE(se.vlrajustecusto, (l.dadosnovos->>'vlrajustecusto')::numeric),
    COALESCE(se.dtdiariadobrada::text, l.dadosnovos->>'datadiariadobrada'),
    COALESCE(se.dtmeiadiaria::text, l.dadosnovos->>'datameiadiaria'),
    COALESCE(se.descajustecusto, l.dadosnovos->>'descajustecusto'),
    COALESCE(se.desccaixinha, l.dadosnovos->>'desccaixinha'),
    COALESCE(se.descdiariadobrada, l.dadosnovos->>'descdiariadobrada'),
    COALESCE(se.descmeiadiaria, l.dadosnovos->>'descmeiadiaria'),
    l.idexecutor
)
    l.idregistroalterado AS id,
    l.idexecutor,
    COALESCE(l.idusuarioalvo, (l.dadosnovos->>'idfuncionario')::int) AS idusuarioalvo,
    COALESCE(f.nome, l.dadosnovos->>'nmfuncionario') AS nomefuncionario,
    (u.nome || ' ' || u.sobrenome) AS nomesolicitante,

    -- JSON completo
    l.dadosnovos,

    -- Datas e valores (prioriza staffeventos)
    COALESCE(se.datasevento::text, l.dadosnovos->>'datasevento') AS datasevento,
    COALESCE(se.vlrcaixinha::text, l.dadosnovos->>'vlrcaixinha') AS vlrcaixinha,
    COALESCE(se.desccaixinha, l.dadosnovos->>'desccaixinha') AS desccaixinha,
    COALESCE(se.vlrajustecusto::text, l.dadosnovos->>'vlrajustecusto') AS vlrajustecusto,
    COALESCE(se.descajustecusto, l.dadosnovos->>'descajustecusto') AS descajustecusto,
    COALESCE(se.dtmeiadiaria::text, l.dadosnovos->>'datameiadiaria') AS vlrmeiadiaria,
    COALESCE(se.descmeiadiaria, l.dadosnovos->>'descmeiadiaria') AS descmeiadiaria,
    COALESCE(se.dtdiariadobrada::text, l.dadosnovos->>'datadiariadobrada') AS vlrdiariadobrada,
    COALESCE(se.descdiariadobrada, l.dadosnovos->>'descdiariadobrada') AS descdiariadobrada,

    -- Status atualizados (prioriza staffeventos)
    COALESCE(se.statuscaixinha::text, l.dadosnovos->>'statuscaixinha') AS statuscaixinha,
    COALESCE(se.statusajustecusto::text, l.dadosnovos->>'statusajustecusto') AS statusajustecusto,
    COALESCE(se.statusmeiadiaria::text, l.dadosnovos->>'statusmeiadiaria') AS statusmeiadiaria,
    COALESCE(se.statusdiariadobrada::text, l.dadosnovos->>'statusdiariadobrada') AS statusdiariadobrada,

    e.nmevento AS evento,
    COALESCE(o.dtfiminfradesmontagem, o.dtfimdesmontagem) AS dtfimrealizacao,
    l.criado_em,
    l.modulo

FROM logs l
LEFT JOIN funcionarios f ON f.idfuncionario = l.idusuarioalvo
LEFT JOIN usuarios u ON u.idusuario = l.idexecutor
LEFT JOIN eventos e ON e.idevento = NULLIF(l.dadosnovos->>'idevento','')::int
LEFT JOIN staffeventos se 
       ON se.idstaffevento = l.idregistroalterado 
       OR se.idfuncionario = COALESCE(l.idusuarioalvo, (l.dadosnovos->>'idfuncionario')::int)
LEFT JOIN orcamentos o ON o.idevento = e.idevento

WHERE l.idempresa = $1
  AND l.modulo IN ('staffeventos')
  AND ($2 = TRUE OR l.idexecutor = $3)

  -- ✅ FILTRO: só traz se algum valor for diferente de zero
  AND (
    COALESCE(se.vlrcaixinha, (l.dadosnovos->>'vlrcaixinha')::numeric, 0) <> 0 OR
    COALESCE(se.vlrajustecusto, (l.dadosnovos->>'vlrajustecusto')::numeric, 0) <> 0 OR
    COALESCE((l.dadosnovos->>'vlrdiariadobrada')::numeric, 0) <> 0 OR
    COALESCE((l.dadosnovos->>'vlrmeiadiaria')::numeric, 0) <> 0
  )

-- 🔥 O ORDER BY precisa começar com os mesmos campos do DISTINCT ON
ORDER BY 
    COALESCE(l.idusuarioalvo, (l.dadosnovos->>'idfuncionario')::int),
    COALESCE(e.idevento, (l.dadosnovos->>'idevento')::int),
    COALESCE(se.vlrcaixinha, (l.dadosnovos->>'vlrcaixinha')::numeric),
    COALESCE(se.vlrajustecusto, (l.dadosnovos->>'vlrajustecusto')::numeric),
    COALESCE(se.dtdiariadobrada::text, l.dadosnovos->>'datadiariadobrada'),
    COALESCE(se.dtmeiadiaria::text, l.dadosnovos->>'datameiadiaria'),
    COALESCE(se.descajustecusto, l.dadosnovos->>'descajustecusto'),
    COALESCE(se.desccaixinha, l.dadosnovos->>'desccaixinha'),
    COALESCE(se.descdiariadobrada, l.dadosnovos->>'descdiariadobrada'),
    COALESCE(se.descmeiadiaria, l.dadosnovos->>'descmeiadiaria'),
    l.idexecutor,
    l.criado_em DESC;
    `, [idempresa, ehMasterStaff, idusuario]);

    // Monta os pedidos
    const pedidos = rows.map(r => {
      let dados = {};
      try { dados = JSON.parse(r.dadosnovos); } catch { /* ignore */ }    

      function parseValor(v) {
        if (!v) return 0;
        if (typeof v === 'number') return v;
        return parseFloat(String(v).replace(',', '.')) || 0;
      }

      function montarCampo(info, valorRaw, descricaoRaw, datasRaw) {
        const valor = parseValor(valorRaw);
        const descricao = descricaoRaw && descricaoRaw !== '-' ? descricaoRaw : null;
        let datas = [];
        if (datasRaw) {
          try { datas = JSON.parse(datasRaw); } catch {}
        }

        // status normalizado + cor
        let status = 'Pendente';
        let cor = '#facc15';
        if (info && typeof info === 'string') {
          const lower = info.toLowerCase();
          if (lower === 'autorizado') { status = 'Autorizado'; cor = '#16a34a'; }
          else if (lower === 'rejeitado') { status = 'Rejeitado'; cor = '#dc2626'; }
          else status = info;
        }

        if (valor > 0 || descricao || (datas && datas.length > 0)) {
          return { evento: r.evento, status, cor, valor, descricao, datas };
        }
        return null;
      }

      return {
        idpedido: r.id,
        solicitante: r.idexecutor,
        nomeSolicitante: r.nomesolicitante || '-',
        funcionario: r.nomefuncionario || dados.nmfuncionario || '-',
        evento: r.evento,
        tipopedido: 'Financeiro',
        criado_em: r.criado_em,
        datasevento: r.datasevento || dados.datasevento || '-',
        dtfimdesmontagem: r.dtfimdesmontagem || dados.dtfimdesmontagem || null,
        quantidade: r.quantidade || dados.quantidade || 1,
        vlrtotal: parseValor(r.vlrtotal || dados.vlrtotal),
        descricao: r.desccaixinha || r.descmeiadiaria || dados.desccaixinha || dados.descmeiadiaria || '-',

        statuscaixinha: montarCampo(r.statuscaixinha || dados.statuscaixinha, r.vlrcaixinha || dados.vlrcaixinha, r.desccaixinha || dados.desccaixinha),
        statusajustecusto: montarCampo(r.statusajustecusto || dados.statusajustecusto, r.vlrajustecusto || dados.vlrAjusteCusto, r.descajustecusto || dados.descajustecusto),
        statusdiariadobrada: montarCampo(r.statusdiariadobrada || dados.statusdiariadobrada, null, r.descdiariadobrada || dados.descdiariadobrada, r.vlrdiariadobrada || dados.vlrdiariadobrada),
        statusmeiadiaria: montarCampo(r.statusmeiadiaria || dados.statusmeiadiaria, null, r.descmeiadiaria || dados.descmeiadiaria, r.vlrmeiadiaria || dados.vlrmeiadiaria)
      };
    })

    
    .filter(p => {
      const campos = ['statuscaixinha','statusajustecusto','statusdiariadobrada','statusmeiadiaria'];
      // mantém apenas se tiver algum campo relevante
      const temRelevancia = campos.some(c => p[c] !== null);
      if (!temRelevancia) return false;

      // se qualquer campo já está aprovado ou rejeitado -> não mostrar (regra que você pediu)
      const jaFinalizado = campos.some(c => {
        const st = p[c]?.status;
        return st && ['Autorizado','Rejeitado'].includes(String(st).toLowerCase());
      });
      if (jaFinalizado) return false;

      // se existe dtfimdesmontagem, remove 2 dias após fim do evento
      if (p.dtfiminfradesmontagem || p.dtfimdesmontagem) {
      const fim = new Date(p.dtfiminfradesmontagem || p.dtfimdesmontagem);

      if (!isNaN(fim.getTime())) {
        const limite = new Date(fim);
        limite.setDate(fim.getDate() + 10); // mantém o prazo de 10 dias após o fim

        if (new Date() > limite) return false; // passou do prazo -> remove
      }
  }


      return true;
    });    

    res.json(pedidos);

  } catch (err) {
    console.error('Erro ao buscar notificações financeiras:', err.stack || err);
    res.status(500).json({ error: 'Erro ao buscar notificações financeiras' });
  }
});

router.post('/notificacoes-financeiras/atualizar-status', 
  logMiddleware('main', {
    buscarDadosAnteriores: async (req) => {
      const { idpedido } = req.body;
      if (!idpedido) return { dadosanteriores: null, idregistroalterado: null };

      const { rows } = await pool.query(`
        SELECT statuscaixinha, statusajustecusto, statusdiariadobrada, statusmeiadiaria
        FROM staffeventos
        WHERE idstaffevento = $1
      `, [idpedido]);

      if (!rows.length) return { dadosanteriores: null, idregistroalterado: null };

      return {
        dadosanteriores: rows[0],
        idregistroalterado: idpedido
      };
    }
  }),
  async (req, res) => {
    try {
      const idusuario = req.usuario?.idusuario || req.headers.idusuario;
      const { idpedido, categoria, acao } = req.body; // acao = 'Aprovado' ou 'Rejeitado'

      if (!idusuario) return res.status(400).json({ error: 'Usuário não informado' });
      if (!idpedido || !categoria || !acao) return res.status(400).json({ error: 'Dados incompletos' });

      // 🔹 Verifica se o usuário é Master
      const { rows: permissoes } = await pool.query(`
        SELECT * FROM permissoes 
        WHERE idusuario = $1 AND modulo = 'Staff' AND master = 'true'
      `, [idusuario]);

      if (permissoes.length === 0) return res.status(403).json({ error: 'Permissão negada' });

      // 🔹 Mapeia categorias para colunas da tabela staffeventos
      const mapCategorias = {
        statuscaixinha: "statuscaixinha",
        statusajustecusto: "statusajustecusto",
        statusdiariadobrada: "statusdiariadobrada",
        statusmeiadiaria: "statusmeiadiaria"
      };

      const coluna = mapCategorias[categoria];
      if (!coluna) return res.status(400).json({ error: "Categoria inválida" });

      // 🔹 Atualiza apenas como string (mantendo compatibilidade com o que já existe)
      const statusParaAtualizar = acao.charAt(0).toUpperCase() + acao.slice(1).toLowerCase(); 
      // exemplo: 'Aprovado' ou 'Rejeitado'

      // 🔹 Atualiza na tabela staffeventos
      let { rows: updatedRows } = await pool.query(`
        UPDATE staffeventos
        SET ${coluna} = $2
        WHERE idstaffevento = $1
        RETURNING idstaffevento, statuscaixinha, statusajustecusto, statusdiariadobrada, statusmeiadiaria;
      `, [idpedido, statusParaAtualizar]);

      // 🔹 Se não encontrou no staffeventos, tenta atualizar na tabela staff
      if (updatedRows.length === 0) {
        const { rows: updatedStaff } = await pool.query(`
          UPDATE staff
          SET ${coluna} = $2
          WHERE idstaffevento = $1
          RETURNING idstaff, idstaffevento, statuscaixinha, statusajustecusto, statusdiariadobrada, statusmeiadiaria;
        `, [idpedido, statusParaAtualizar]);

        updatedRows = updatedStaff;
      }

      if (!updatedRows.length) return res.status(404).json({ error: 'Registro não encontrado em nenhuma tabela' });

      res.json({ sucesso: true, atualizado: updatedRows[0] });

    } catch (err) {
      console.error('Erro ao atualizar status do pedido:', err.stack || err);
      res.status(500).json({ error: 'Erro ao atualizar status do pedido', detalhe: err.message });
    }
  }
);


router.get("/vencimentos", async (req, res) => {
    // dataInicio é o dia que estamos checando (o dia do vencimento)
    const { dataInicio, tipoVencimento } = req.query; 
    const idempresa = req.idempresa; // Assumindo que o ID da empresa vem do middleware (req.idempresa)

    // ➡️ 1. Define o dia de filtro e valida o tipo de vencimento
    if (!dataInicio) {
        return res.status(400).json({ error: "dataInicio é obrigatório." });
    }
    const dataFiltro = dataInicio; // YYYY-MM-DD

    const tipo = tipoVencimento || 'cache'; // Padrão: cache
    
    // As novas regras de vencimento serão mapeadas aqui:
    let vencimentoDateLogic = '';
    
    // A tabela 'staffeventos' (tse) não tem as datas de marco (dtinimarcacao, dtfimrealizacao).
    // Assumimos que a tabela 'eventos' (te) está ligada ao 'staffeventos' (tse) através do 'idevento'.
    // Precisamos de um JOIN para a tabela 'eventos' e a tabela 'orcamentos' (to).

    // Para esta implementação, vamos assumir uma View ou JOIN que traz as datas:
    // Vou usar a tabela 'eventos' (te) e presumir que ela já possui ou pode ser JOINed para as datas necessárias.

    const joinOrcamento = `
        INNER JOIN eventos te ON tse.idevento = te.idevento 
    `;

    // -------------------------------------------------
    // ➡️ 2. Define a Lógica de Vencimento no SQL
    // -------------------------------------------------
    if (tipo === 'ajuda_custo') {
        // Vencimento: 2 dias após a dtinimarcacao do Orçamento (te.dtinimarcacao)
        // O dia de vencimento (dataFiltro) deve ser igual a (dtinimarcacao + 2 dias)
        vencimentoDateLogic = `
            te.dtinimarcacao + INTERVAL '2 days'
        `;
    } else if (tipo === 'cache') {
        // Vencimento: 10 dias após a dtfimrealizacao (te.dtfimrealizacao)
        // O dia de vencimento (dataFiltro) deve ser igual a (dtfimrealizacao + 10 dias)
        vencimentoDateLogic = `
            te.dtfimrealizacao + INTERVAL '10 days'
        `;
    } else {
         return res.status(400).json({ error: "tipoVencimento deve ser 'cache' ou 'ajuda_custo'." });
    }
    
    // -------------------------------------------------
    // ➡️ 3. Lógica WHERE para o dia do Vencimento
    // -------------------------------------------------
    const whereVencimento = `
        ${vencimentoDateLogic}::date = $2::date
    `;

    try {
        const vencimentos = {};

        // --- CONSULTA PRINCIPAL (CACHÊ E AJUDA DE CUSTO DETALHADO) ---
        // A lógica do 'QTD DIÁRIAS' está mantida, mas a filtragem principal mudou
        const queryVencimentosDetalhe = `
            SELECT
                tse.idevento AS "idevento",
                tse.nmevento AS "nomeEvento",
                tse.nmfuncao AS "FUNÇÃO",
                tbf.nome AS "NOME",
                tbf.pix AS "PIX",
                -- Valor unitário do Cachê
                COALESCE(tse.vlrcache, 0.00) AS "VLR CACHÊ", 
                -- Valor unitário da Ajuda de Custo (Diária)
                (COALESCE(tse.vlralmoco, 0.00) + COALESCE(tse.vlrjantar, 0.00) + COALESCE(tse.vlrtransporte, 0.00)) AS "VLR AJUDA CUSTO UNITÁRIO",
                
                -- Quantidade de diárias (dias de evento) - MANTIDA
                jsonb_array_length(tse.datasevento) AS "QTD DIÁRIAS",

                -- Valor Adicional
                (
                    COALESCE(CASE WHEN tse.statusajustecusto = 'Autorizado' THEN tse.vlrajustecusto ELSE 0.00 END, 0.00) +
                    COALESCE(CASE WHEN tse.statuscaixinha = 'Autorizado' THEN tse.vlrcaixinha ELSE 0.00 END, 0.00)
                ) AS "VLR ADICIONAL",
                tse.statuspgto AS "STATUS PGTO"
            FROM
                staffeventos tse
            JOIN
                funcionarios tbf ON tse.idfuncionario = tbf.idfuncionario
            JOIN 
                staffempresas semp ON tse.idstaff = semp.idstaff
            ${joinOrcamento} -- Adiciona o JOIN para a tabela eventos (te)
            WHERE
                semp.idempresa = $1 AND 
                ${whereVencimento} -- AQUI ESTÁ A NOVA LÓGICA
            ORDER BY
                tse.nmevento,
                tbf.nome
        `;

        // ➡️ 4. Executa a query com os parâmetros: $1 (idempresa) e $2 (dataFiltro)
        const resultDetalhe = await pool.query(queryVencimentosDetalhe, [idempresa, dataFiltro]);
        const dadosBrutos = resultDetalhe.rows;

        // --- AGRUPAMENTO E PROCESSAMENTO NO NODE.JS (MANTIDO) ---
        const vencimentosAgrupados = {};

        dadosBrutos.forEach(item => {
            const eventoId = item.idevento;
            const nomeEvento = item.nomeEvento;
            // 🛑 A QTD DIÁRIAS AGORA É O TAMANHO TOTAL DO ARRAY DE DATAS, POIS ESTAMOS FILTRANDO APENAS O DIA DE VENCIMENTO.
            // Se você quiser a quantidade de diárias dentro do evento, deve usar o valor completo, não o filtro de dia.
            // Para manter a lógica que calcula o total do funcionário (VLR * QTD DIÁRIAS), assumirei que
            // QTD DIÁRIAS deve ser o total de dias do evento, não apenas o dia de vencimento.
            // Se precisar do total de diárias apenas no dia de vencimento, use '1' ou a lógica de filtro de dia do seu código original.
            const qtdDiarias = parseInt(item["QTD DIÁRIAS"] || 0);

            // Calcula os totais do item (MANTIDO)
            const totalAjudaCusto = parseFloat(item["VLR AJUDA CUSTO UNITÁRIO"] || 0) * qtdDiarias;
            const totalCache = parseFloat(item["VLR CACHÊ"] || 0) * qtdDiarias;
            const totalAdicional = parseFloat(item["VLR ADICIONAL"] || 0);
            const totalPagar = totalAjudaCusto + totalCache + totalAdicional;
            
            // ... (Lógica de agrupamento do seu código original, mantida) ...
            if (!vencimentosAgrupados[eventoId]) {
                vencimentosAgrupados[eventoId] = {
                    nomeEvento: nomeEvento,
                    totalAjudaCustoEvento: 0,
                    totalCacheEvento: 0,
                    totalAdicionalEvento: 0,
                    totalPagarEvento: 0,
                    funcionarios: []
                };
            }

            // Atualiza os totais acumulados do Evento
            vencimentosAgrupados[eventoId].totalAjudaCustoEvento += totalAjudaCusto;
            vencimentosAgrupados[eventoId].totalCacheEvento += totalCache;
            vencimentosAgrupados[eventoId].totalAdicionalEvento += totalAdicional;
            vencimentosAgrupados[eventoId].totalPagarEvento += totalPagar;

            // Adiciona o detalhe do funcionário
            vencimentosAgrupados[eventoId].funcionarios.push({
                nome: item.NOME,
                funcao: item.FUNÇÃO,
                pix: item.PIX,
                qtdDiarias: qtdDiarias,
                vlrAjudaCustoUnitario: parseFloat(item["VLR AJUDA CUSTO UNITÁRIO"] || 0).toFixed(2),
                totalAjudaCusto: totalAjudaCusto.toFixed(2),
                vlrCacheUnitario: parseFloat(item["VLR CACHÊ"] || 0).toFixed(2),
                totalCache: totalCache.toFixed(2),
                totalAdicional: totalAdicional.toFixed(2),
                totalPagar: totalPagar.toFixed(2), 
                statusPgto: item["STATUS PGTO"]
            });
            // ... (Fim da lógica de agrupamento) ...
        });

        // Formata os totais do evento (para exibição no cabeçalho)
        Object.values(vencimentosAgrupados).forEach(evento => {
             evento.totalAjudaCustoEvento = evento.totalAjudaCustoEvento.toFixed(2);
             evento.totalCacheEvento = evento.totalCacheEvento.toFixed(2);
             evento.totalAdicionalEvento = evento.totalAdicionalEvento.toFixed(2);
             evento.totalPagarEvento = evento.totalPagarEvento.toFixed(2);
        });

        vencimentos.eventos = Object.values(vencimentosAgrupados);
        
        return res.json({ tipoVencimento: tipo, dataFiltro: dataFiltro, ...vencimentos });
        
    } catch (error) {
        console.error("❌ Erro ao buscar vencimentos:", error);
        // Em caso de erro com a data ou JOIN, retorna uma mensagem clara.
        return res.status(500).json({ error: error.message || "Erro ao listar vencimentos." });
    }
});


// =======================================
// AGENDA PESSOAL DO USUÁRIO
// =======================================
router.get("/agenda", async (req, res) => {
  try {
  // Tenta obter o idusuario do objeto de requisição (middleware de autenticação) ou do header
  const idusuario = req.usuario?.idusuario || req.headers.idusuario; 
  if (!idusuario) return res.status(400).json({ erro: "Usuário não informado" });

  const resultado = await pool.query(
  `SELECT idagenda, idusuario, titulo, descricao, data_evento, hora_evento, tipo
    FROM agendas
    WHERE idusuario = $1
    ORDER BY data_evento ASC, hora_evento ASC`,
  [idusuario]
);


  res.json(resultado.rows);
  } catch (err) {
  console.error("Erro ao buscar agenda:", err);
  res.status(500).json({ erro: "Erro ao buscar agenda" });
  }
});

// Rota para adicionar um novo evento na agenda
router.post("/agenda", async (req, res) => {
  try {
  const idusuario = req.usuario?.idusuario || req.headers.idusuario;
  const { titulo, descricao, data_evento, hora_evento, tipo } = req.body;

  if (!idusuario) return res.status(400).json({ erro: "Usuário não informado" });
  if (!titulo || !data_evento)
  return res.status(400).json({ erro: "Título e data são obrigatórios" });

  const resultado = await pool.query(
  `INSERT INTO agendas (idusuario, titulo, descricao, data_evento, hora_evento, tipo)
   VALUES ($1, $2, $3, $4, $5, $6)
   RETURNING *`,
  [idusuario, titulo, descricao, data_evento, hora_evento, tipo || "Evento"]
);


  res.status(201).json(resultado.rows[0]);
  } catch (err) {
  console.error("Erro ao salvar agenda:", err);
  res.status(500).json({ erro: "Erro ao salvar agenda" });
  }
});


// Rota para excluir um evento específico
router.delete("/agenda/:idagenda", async (req, res) => {
  try {
  const idusuario = req.usuario?.idusuario || req.headers.idusuario;
  const { idagenda } = req.params;

  if (!idusuario) return res.status(400).json({ erro: "Usuário não informado" });

  // Garantindo que o usuário só possa excluir seus próprios eventos
  const resultado = await pool.query(
  `DELETE FROM agendas
    WHERE idagenda = $1 AND idusuario = $2
    RETURNING idagenda`,
  [idagenda, idusuario]
);


  if (resultado.rowCount === 0) {
  return res.status(404).json({ erro: "Evento não encontrado ou não pertence ao usuário." });
  }

  res.json({ sucesso: true, idagenda: idagenda });
  } catch (err) {
  console.error("Erro ao excluir evento:", err);
  res.status(500).json({ erro: "Erro ao excluir evento" });
  }
});

// router.patch('/aditivoextra/:idAditivoExtra/status',
//    // autenticarToken(),
//    // contextoEmpresa,
//     // verificarPermissao('staff', 'aprovar_aditivo_extra'), // ⚠️ Assuma uma permissão específica para aprovação
//     logMiddleware('aditivoextra', {
//         // Lógica para buscar os dados ANTES da alteração (para o log de auditoria)
//         buscarDadosAnteriores: async (req) => {
//             const id = req.params.idAditivoExtra;
//             const query = `SELECT idaditivoextra, status, tiposolicitacao, justificativa FROM AditivoExtra WHERE idAditivoExtra = $1`;
//             const result = await pool.query(query, [id]);
//             return result.rows[0] ? { dadosanteriores: result.rows[0], idregistroalterado: id } : null;
//         }
//     }),
//     async (req, res) => {
//         const idAditivoExtra = req.params.idAditivoExtra;
//         const { novoStatus, justificativaStatus } = req.body;
//         const idUsuarioAprovador = req.usuario?.idusuario;

//         console.log(`🔥 Rota /aditivoextra/${idAditivoExtra}/status acessada: Novo Status: ${novoStatus}`);

//         // 1. Validação
//         if (!novoStatus || !idUsuarioAprovador) {
//             return res.status(400).json({
//                 sucesso: false,
//                 erro: "Novo status e/ou ID do usuário aprovador não fornecidos."
//             });
//         }
        
//         const statusPermitidos = ['Autorizado', 'Rejeitado'];
//         if (!statusPermitidos.includes(novoStatus)) {
//             return res.status(400).json({
//                 sucesso: false,
//                 erro: "Status inválido. Use 'Autorizado' ou 'Rejeitado'."
//             });
//         }

//         if (novoStatus === 'Rejeitado' && (!justificativaStatus || justificativaStatus.trim() === '')) {
//             return res.status(400).json({
//                 sucesso: false,
//                 erro: "A justificativa é obrigatória ao rejeitar a solicitação."
//             });
//         }

//         try {
//             // 2. Verifica o status atual da solicitação
//             const checkQuery = `SELECT status, tiposolicitacao FROM AditivoExtra WHERE idAditivoExtra = $1 AND idEmpresa = $2`;
//             const checkResult = await pool.query(checkQuery, [idAditivoExtra, req.idempresa]);

//             if (checkResult.rows.length === 0) {
//                 return res.status(404).json({ sucesso: false, erro: "Solicitação de Aditivo/Extra não encontrada para esta empresa." });
//             }

//             const currentStatus = checkResult.rows[0].status;

//             if (currentStatus !== 'Pendente') {
//                 return res.status(400).json({
//                     sucesso: false,
//                     erro: `A solicitação não pode ser alterada. Status atual: ${currentStatus}.`
//                 });
//             }

//             // 3. Comando SQL de Atualização
//             let query;
//             let values;

//             if (novoStatus === 'Autorizado') {
//                 query = `
//                     UPDATE AditivoExtra
//                     SET status = $1, 
//                         dtAprovacao = NOW(), 
//                         idUsuarioAprovador = $2
//                     WHERE idAditivoExtra = $3 AND idEmpresa = $4
//                     RETURNING *;
//                 `;
//                 values = [novoStatus, idUsuarioAprovador, idAditivoExtra, req.idempresa];
//             } else if (novoStatus === 'Rejeitado') {
//                 query = `
//                     UPDATE AditivoExtra
//                     SET status = $1, 
//                         dtRejeicao = NOW(), 
//                         idUsuarioAprovador = $2,
//                         --justificativaStatus = $5
//                     WHERE idAditivoExtra = $3 AND idEmpresa = $4
//                     RETURNING *;
//                 `;
//                 //values = [novoStatus, idUsuarioAprovador, idAditivoExtra, req.idempresa, justificativaStatus];
//                 values = [novoStatus, idUsuarioAprovador, idAditivoExtra, req.idempresa];
//             } else {
//                 // Caso haja um erro de lógica que permita um status não mapeado
//                 throw new Error("Erro de lógica: Status de atualização inválido.");
//             }

//             const resultado = await pool.query(query, values);

//             if (resultado.rows.length === 0) {
//                 throw new Error("A atualização falhou. Nenhuma linha afetada.");
//             }

//             // 4. Resposta de Sucesso
//             res.json({
//                 sucesso: true,
//                 mensagem: `Status da solicitação ${idAditivoExtra} atualizado para ${novoStatus} com sucesso.`,
//                 dados: resultado.rows[0]
//             });

//         } catch (error) {
//             console.error("Erro ao atualizar status AditivoExtra:", error.message || error);
//             res.status(500).json({
//                 sucesso: false,
//                 erro: "Erro interno do servidor ao processar a atualização do status."
//             });
//         }
//     });

// Exemplo no seu arquivo de rotas (main.js ou similar)

// router.get('/aditivoextra/pendentes', async (req, res) => {
//     // ⚠️ Você precisará garantir que apenas usuários com permissão vejam isso
//     const idEmpresa = req.idempresa; 

//     // Checa se o usuário é Master no Staff via tabela de permissões
//     const { rows: permissoes } = await pool.query(`
//       SELECT * FROM permissoes 
//       WHERE idusuario = $1 AND modulo = 'Staff' AND master = 'true'
//     `, [idusuario]);
   
//     const ehMasterStaff = permissoes.length > 0;

//     if (permissoes.length === 0) return res.status(403).json({ error: 'Permissão negada' });

//     try {
//         const query = `
//             SELECT 
//                 ae.idAditivoExtra,
//                 ae.tipoSolicitacao,
//                 ae.justificativa,
//                 ae.status,
//                 ae.qtdSolicitada, -- Se houver
//                 ae.dtSolicitacao AS criado_em,
//                 func.nome AS nomeFuncionario,
//                 f.descfuncao AS funcao,
//                 e.nmevento AS evento,
//                 s.nome || ' ' || s.sobrenome AS nomesolicitante,
//                 -- 💡 Adicione aqui quaisquer outros campos necessários para a exibição 
//                 --TRUE AS ehMasterStaff -- Assumindo que quem acessa a rota tem permissão de aprovação
//             FROM 
//                 AditivoExtra ae
//             JOIN 
//                 Funcao f ON ae.idFuncao = f.idFuncao
//             JOIN 
//                 Funcionarios func ON ae.idFuncionario = func.idFuncionario
//             JOIN 
//                 Orcamentos o ON ae.idOrcamento = o.idOrcamento
//             JOIN 
//                 Eventos e ON o.idEvento = e.idEvento
//             JOIN 
//                 Usuarios s ON ae.idUsuarioSolicitante = s.idUsuario
//             WHERE 
//                 ae.idEmpresa = $1 AND ae.status = 'Pendente'
//             ORDER BY 
//                 e.nmevento, f.descfuncao, ae.tipoSolicitacao;
//         `;
        
//         // ⚠️ Substitua $1 pela sua variável de ID da empresa
//         const resultado = await pool.query(query, [req.idempresa]); 

//         res.json({
//             sucesso: true,
//             dados: resultado.rows
//         });

//     } catch (error) {
//         console.error("Erro ao listar AditivoExtra pendentes:", error);
//         res.status(500).json({ sucesso: false, erro: "Erro interno ao buscar solicitações Aditivo/Extra." });
//     }
// });

router.patch('/aditivoextra/:idAditivoExtra/status',
    autenticarToken(),
    contextoEmpresa,
    verificarPermissao('staff', 'cadastrar'),
    logMiddleware('aditivoextra', {
        buscarDadosAnteriores: async (req) => {
        const id = req.params.idAditivoExtra;
            
        // 💡 Mantida a correção de segurança para evitar erro 22P02 no log middleware
            if (!id || isNaN(parseInt(id))) return null;

        // Usa a coluna justificativa que já existe no banco
        const query = `SELECT idaditivoextra, status, tiposolicitacao, justificativa FROM AditivoExtra WHERE idAditivoExtra = $1`;
        const result = await pool.query(query, [id]);
        return result.rows[0] ? { dadosanteriores: result.rows[0], idregistroalterado: id } : null;
        }
    }),
    async (req, res) => {
        const idAditivoExtra = req.params.idAditivoExtra;
        // ⚠️ Vamos ignorar a justificativaStatus na lógica
        const { novoStatus } = req.body; 
        const idUsuarioAprovador = req.usuario?.idusuario;

        console.log(`🔥 Rota /aditivoextra/${idAditivoExtra}/status acessada: Novo Status: ${novoStatus}`, idUsuarioAprovador);

        // 1. Validação
    if (!novoStatus || !idUsuarioAprovador) {
        return res.status(400).json({
            sucesso: false,
            erro: "Novo status e/ou ID do usuário aprovador não fornecidos."
        });
    }
    
    console.log(`Validando novoStatus: ${novoStatus}`);

    const statusPermitidos = ['Autorizado', 'Rejeitado'];
    if (!statusPermitidos.includes(novoStatus)) {
        return res.status(400).json({
            sucesso: false,
            erro: "Status inválido. Use 'Autorizado' ou 'Rejeitado'."
        });
    }
    
    console.log(`Status permitido: ${novoStatus}`);
     

    try {
        // 2. Verifica o status atual da solicitação
        const checkQuery = `SELECT status, tiposolicitacao FROM AditivoExtra WHERE idaditivoextra = $1 AND idempresa = $2`;
        const checkResult = await pool.query(checkQuery, [idAditivoExtra, req.idempresa]);

        if (checkResult.rows.length === 0) {
        return res.status(404).json({ sucesso: false, erro: "Solicitação de Aditivo/Extra não encontrada para esta empresa." });
    }
    console.log(`Status atual da solicitação: ${checkResult.rows[0].status}`);

    const currentStatus = checkResult.rows[0].status;

    if (currentStatus !== 'Pendente') {
        return res.status(400).json({
        sucesso: false,
        erro: `A solicitação não pode ser alterada. Status atual: ${currentStatus}.`
        });
    }

    // 3. Comando SQL de Atualização
    let query;
    let values;

    console.log(`Preparando atualização para status: ${novoStatus}`, idAditivoExtra, req.idempresa);

    // A query de Autorizado já estava correta, sem a justificativa
    if (novoStatus === 'Autorizado') {
        query = `
            UPDATE AditivoExtra
            SET status = $1, 
            dtresposta = NOW(), 
            idusuarioresponsavel = $2
            WHERE idaditivoextra = $3 AND idempresa = $4
            RETURNING *;
        `;
        values = [novoStatus, idUsuarioAprovador, idAditivoExtra, req.idempresa];
    } else if (novoStatus === 'Rejeitado') {
        query = `
            UPDATE AditivoExtra
            SET status = $1, 
            dtresposta = NOW(), 
            idusuarioresponsavel = $2                       
            WHERE idaditivoextra = $3 AND idempresa = $4
            RETURNING *;
        `;
                    // 💡 CORREÇÃO FINAL: A lista de valores volta a ter 4 itens. O valor para justificativa é NULL.
        values = [novoStatus, idUsuarioAprovador, idAditivoExtra, req.idempresa]; 
    } else {
        throw new Error("Erro de lógica: Status de atualização inválido.");
    }

    const resultado = await pool.query(query, values);

    if (resultado.rows.length === 0) {
        throw new Error("A atualização falhou. Nenhuma linha afetada.");
    }

    // 4. Resposta de Sucesso
    res.json({
        sucesso: true,
        mensagem: `Status da solicitação ${idAditivoExtra} atualizado para ${novoStatus} com sucesso.`,
        dados: resultado.rows[0]
    });

    } catch (error) {
        console.error("Erro ao atualizar status AditivoExtra:", error.message || error);
        res.status(500).json({
        sucesso: false,
        erro: "Erro interno do servidor ao processar a atualização do status."
        });
    }
});


router.get('/aditivoextra/pendentes', async (req, res) => {
    
    // 💡 CORREÇÃO 1: Utiliza a mesma lógica robusta para obter ID da Empresa e do Usuário
    const idEmpresa = req.idempresa || req.headers.idempresa; 
    const idUsuario = req.usuario?.idusuario || req.headers.idusuario; 

    if (!idEmpresa) return res.status(400).json({ erro: 'Empresa não informada' });
    if (!idUsuario) return res.status(400).json({ erro: 'Usuário não informado' });


    // 1. Checa se o usuário é Master no Staff
    // Agora idUsuario deve estar preenchido corretamente
    const { rows: permissoes } = await pool.query(`
        SELECT * FROM permissoes 
        WHERE idusuario = $1 AND modulo = 'Staff' AND master = 'true'
    `, [idUsuario]);
    
    const ehMasterStaff = permissoes.length > 0;

    // Mantendo o bloqueio de acesso à rota para usuários sem permissão
    if (!ehMasterStaff) {
        return res.status(403).json({ erro: 'Permissão negada. Você não é Master Staff no módulo de Staff.' }); 
    }

    try {
        const query = `
            SELECT 
                ae.idAditivoExtra,
                ae.tipoSolicitacao,
                ae.justificativa,
                ae.status,
                ae.qtdSolicitada,
                ae.dtSolicitacao AS criado_em,
                func.nome AS nomeFuncionario,
                f.descfuncao AS funcao,
                e.nmevento AS evento,
                s.nome || ' ' || s.sobrenome AS nomesolicitante
            FROM 
                AditivoExtra ae
            JOIN 
                Funcao f ON ae.idFuncao = f.idFuncao
            JOIN 
                Funcionarios func ON ae.idFuncionario = func.idFuncionario
            JOIN 
                Orcamentos o ON ae.idOrcamento = o.idOrcamento
            JOIN 
                Eventos e ON o.idEvento = e.idEvento
            JOIN 
                Usuarios s ON ae.idUsuarioSolicitante = s.idUsuario
            WHERE 
                ae.idEmpresa = $1 AND ae.status = 'Pendente'
            ORDER BY 
                e.nmevento, f.descfuncao, ae.tipoSolicitacao;
        `;
        
        const resultado = await pool.query(query, [idEmpresa]); 

        // 2. INJETA a flag ehMasterStaff em CADA linha antes de retornar.
        const dadosComPermissao = resultado.rows.map(row => ({
            ...row,
            ehMasterStaff: ehMasterStaff // Passa o valor booleano calculado (TRUE)
        }));

        res.json({
            sucesso: true,
            dados: dadosComPermissao // Retorna o array modificado
        });

    } catch (error) {
        console.error("Erro ao listar AditivoExtra pendentes:", error);
        res.status(500).json({ sucesso: false, erro: "Erro interno ao buscar solicitações Aditivo/Extra." });
    }
});

module.exports = router;