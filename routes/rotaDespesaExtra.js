// Rota de Despesa Extra: lançamentos de custo imprevisto — de EVENTO (equipamento
// quebrado, multa, reposição de suprimento etc.) escopados por evento + período
// (não por orçamento — um evento pode ter vários orçamentos-irmãos pro mesmo
// período), ou de ESCRITÓRIO (café pra cliente, aluguel de sala, conserto de
// equipamento do escritório etc.), sem evento nem funcionário fixo. As duas
// dividem a mesma tabela (despesaextras) — idevento presente = Evento, ausente =
// Escritório; é só isso que diferencia, sem coluna de tipo redundante. Nenhuma
// das duas entra em Vencimentos: são lançadas e pagas direto por aqui.
// Espelha routes/rotaAjusteFinanceiro.js (Crédito/Débito de funcionário), que
// continua em tabela e tela própria — é sobre uma PESSOA, não uma despesa avulsa.
const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB");
const { verificarPermissao } = require("../middlewares/permissaoMiddleware");
const logMiddleware = require("../middlewares/logMiddleware");

const multer = require("multer");
const path = require("path");
const fs = require("fs");

const CATEGORIAS_VALIDAS = ["Quebra de Equipamento", "Multa", "Reposição de Suprimento", "Outro"];

const parseFloatOrNull = (v) => {
    if (v === undefined || v === null || v === "" || v === "NaN" || v === "null") return 0;
    const n = parseFloat(String(v).replace(",", "."));
    return Number.isNaN(n) ? 0 : n;
};

const comprovantesUploadDir = path.join(__dirname, "../uploads/despesaextra_comprovantes");
if (!fs.existsSync(comprovantesUploadDir)) {
    fs.mkdirSync(comprovantesUploadDir, { recursive: true });
}

const deletarArquivoAntigo = (relativePath) => {
    if (!relativePath) return;
    const absolutePath = path.join(__dirname, "..", relativePath);
    fs.unlink(absolutePath, (err) => {
        if (err && err.code !== "ENOENT") console.error("Erro ao deletar comprovante antigo:", err);
    });
};

const storageComprovanteDespesa = multer.diskStorage({
    destination: (req, file, cb) => cb(null, comprovantesUploadDir),
    filename: (req, file, cb) => {
        const id = req.params.idDespesaExtra || "novo";
        const nomeOriginalLimpo = path.parse(file.originalname).name
            .replace(/\s+/g, "")
            .replace(/[^a-zA-Z0-9]/g, "");
        // Data + hora LOCAL (AAAAMMDD-HHMMSS): só a data fazia dois uploads do mesmo
        // arquivo no mesmo dia colidirem e o multer sobrescrever o anterior no disco —
        // crítico aqui, onde o id cai em 'novo' enquanto a despesa ainda não foi salva.
        const agora = new Date();
        const p2 = n => String(n).padStart(2, "0");
        const dataHoje = `${agora.getFullYear()}${p2(agora.getMonth() + 1)}${p2(agora.getDate())}`;
        const horaAgora = `${p2(agora.getHours())}${p2(agora.getMinutes())}${p2(agora.getSeconds())}`;
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `comprovantedespesa-ID${id}-${dataHoje}-${horaAgora}-${nomeOriginalLimpo}${ext}`);
    }
});

const fileFilterComprovanteDespesa = (req, file, cb) => {
    if (file.mimetype.startsWith("image/") || file.mimetype === "application/pdf") {
        cb(null, true);
    } else {
        cb(new Error("Tipo de arquivo não suportado! Apenas imagens e PDFs são permitidos."), false);
    }
};

const uploadComprovanteDespesa = multer({
    storage: storageComprovanteDespesa,
    fileFilter: fileFilterComprovanteDespesa,
    limits: { fileSize: 10 * 1024 * 1024 }
}).single("comprovantedespesa");

// GET /despesaextra/eventos?busca=texto — pra busca do campo "Evento" do lançamento.
// Cada linha é uma EDIÇÃO do evento (idevento + ano), não um orçamento: agrupa todos os
// orçamentos-irmãos daquele período num só resultado, com o período (min/max das datas
// de realização) pronto pra virar dtreferencia ao escolher o item.
// Ordenação: ano atual sempre primeiro, demais anos do mais recente pro mais antigo,
// dentro de cada ano por nome em ordem alfabética.
router.get("/eventos",
    verificarPermissao("DespesaExtra", "pesquisar"),
    async (req, res) => {
        const idempresa = req.idempresa;
        const busca = String(req.query.busca || "").trim();
        try {
            const { rows } = await pool.query(
                `SELECT o.idevento, e.nmevento,
                        EXTRACT(YEAR FROM o.dtinirealizacao)::int AS ano,
                        MIN(o.dtinirealizacao) AS dtinirealizacao,
                        MAX(o.dtfimrealizacao) AS dtfimrealizacao
                 FROM orcamentos o
                 JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
                 JOIN eventos e ON e.idevento = o.idevento
                 WHERE oe.idempresa = $1
                   AND o.status <> 'R'
                   AND o.idevento IS NOT NULL
                   AND o.dtinirealizacao IS NOT NULL
                   AND ($2 = '' OR e.nmevento ILIKE '%' || $2 || '%')
                 GROUP BY o.idevento, e.nmevento, EXTRACT(YEAR FROM o.dtinirealizacao)
                 ORDER BY (EXTRACT(YEAR FROM o.dtinirealizacao) = EXTRACT(YEAR FROM CURRENT_DATE)) DESC,
                          ano DESC,
                          e.nmevento ASC
                 LIMIT 30`,
                [idempresa, busca]
            );
            res.json(rows);
        } catch (error) {
            console.error("Erro ao buscar eventos (Despesa Extra):", error);
            res.status(500).json({ erro: "Erro ao buscar eventos." });
        }
    }
);

// GET /despesaextra/eventos/:idEvento/orcamentos?ano=2026 — orçamentos-irmãos daquela
// edição, pro select opcional "Orçamento de referência".
router.get("/eventos/:idEvento/orcamentos",
    verificarPermissao("DespesaExtra", "pesquisar"),
    async (req, res) => {
        const idempresa = req.idempresa;
        const { idEvento } = req.params;
        const { ano } = req.query;
        try {
            const { rows } = await pool.query(
                `SELECT o.idorcamento, o.nrorcamento
                 FROM orcamentos o
                 JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
                 WHERE oe.idempresa = $1 AND o.idevento = $2 AND o.status <> 'R'
                   AND ($3::int IS NULL OR EXTRACT(YEAR FROM o.dtinirealizacao)::int = $3::int)
                 ORDER BY o.nrorcamento`,
                [idempresa, idEvento, ano || null]
            );
            res.json(rows);
        } catch (error) {
            console.error("Erro ao buscar orçamentos do evento (Despesa Extra):", error);
            res.status(500).json({ erro: "Erro ao buscar orçamentos do evento." });
        }
    }
);

// GET /despesaextra/escritorio — histórico de lançamentos de ESCRITÓRIO (idevento NULL),
// mais recentes primeiro. Precisa vir ANTES de /:idEvento pra não ser engolida por ela
// (Express bateria "escritorio" como se fosse um idEvento).
router.get("/escritorio",
    verificarPermissao("DespesaExtra", "pesquisar"),
    async (req, res) => {
        const idempresa = req.idempresa;
        try {
            const { rows } = await pool.query(
                `SELECT d.iddespesaextra, d.dtreferencia, d.categoria, d.tipo, d.valor, d.justificativa,
                        d.comprovante, d.status, d.idfuncionario, f.nome AS nomefuncionario,
                        d.dtlancamento, d.dtpagamento
                 FROM despesaextras d
                 LEFT JOIN funcionarios f ON f.idfuncionario = d.idfuncionario
                 WHERE d.idevento IS NULL AND d.idempresa = $1
                 ORDER BY d.dtreferencia DESC, d.dtlancamento DESC
                 LIMIT 200`,
                [idempresa]
            );
            res.json(rows);
        } catch (error) {
            console.error("Erro ao buscar despesas extras de escritório:", error);
            res.status(500).json({ erro: "Erro ao buscar despesas extras de escritório." });
        }
    }
);

// GET /despesaextra/:idEvento — histórico de lançamentos do evento (todos os anos;
// o front decide se filtra por ano selecionado)
router.get("/:idEvento",
    verificarPermissao("DespesaExtra", "pesquisar"),
    async (req, res) => {
        const idempresa = req.idempresa;
        const { idEvento } = req.params;
        try {
            const { rows } = await pool.query(
                `SELECT d.iddespesaextra, d.idevento, d.dtreferencia, d.idorcamento, o.nrorcamento,
                        d.categoria, d.tipo, d.valor, d.justificativa, d.comprovante, d.status,
                        d.idfuncionario, f.nome AS nomefuncionario,
                        d.dtlancamento, d.dtpagamento
                 FROM despesaextras d
                 LEFT JOIN orcamentos o ON o.idorcamento = d.idorcamento
                 LEFT JOIN funcionarios f ON f.idfuncionario = d.idfuncionario
                 WHERE d.idevento = $1 AND d.idempresa = $2
                 ORDER BY d.dtreferencia DESC, d.dtlancamento DESC`,
                [idEvento, idempresa]
            );
            res.json(rows);
        } catch (error) {
            console.error("Erro ao buscar despesas extras do evento:", error);
            res.status(500).json({ erro: "Erro ao buscar despesas extras do evento." });
        }
    }
);

// POST /despesaextra — cria um lançamento
router.post("/",
    verificarPermissao("DespesaExtra", "cadastrar"),
    uploadComprovanteDespesa,
    logMiddleware("DespesaExtra", {
        buscarDadosAnteriores: async () => ({ dadosanteriores: null, idregistroalterado: null })
    }),
    async (req, res) => {
        const idempresa = req.idempresa;
        const idUsuarioLogado = req.usuario.idusuario;
        const { idevento, dtreferencia, idorcamento, categoria, tipo, valor, justificativa, idfuncionario } = req.body;
        // idevento presente = Despesa de Evento, ausente = Despesa de Escritório. A tela é
        // quem obriga escolher um evento quando o tipo "Despesa de Evento" está marcado —
        // aqui só confia no que chegou: se não veio idevento, é escritório.
        const idEventoFinal = idevento || null;

        if (!dtreferencia) {
            return res.status(400).json({ erro: "Data de referência é obrigatória." });
        }
        if (!categoria || !CATEGORIAS_VALIDAS.includes(categoria)) {
            return res.status(400).json({ erro: "Categoria inválida." });
        }
        if (!tipo || !["Despesa", "Estorno"].includes(tipo)) {
            return res.status(400).json({ erro: "Tipo (Despesa/Estorno) é obrigatório." });
        }
        const valorNumerico = parseFloatOrNull(valor);
        if (!valorNumerico || valorNumerico <= 0) {
            return res.status(400).json({ erro: "Valor deve ser maior que zero." });
        }
        if (!justificativa || !String(justificativa).trim()) {
            return res.status(400).json({ erro: "Justificativa é obrigatória." });
        }

        try {
            if (idEventoFinal) {
                const eventoValido = await pool.query(
                    `SELECT 1 FROM orcamentos o
                       JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
                      WHERE o.idevento = $1 AND oe.idempresa = $2 LIMIT 1`,
                    [idEventoFinal, idempresa]
                );
                if (eventoValido.rowCount === 0) {
                    return res.status(404).json({ erro: "Evento não encontrado nesta empresa." });
                }
            }

            const comprovantePath = req.file ? `/uploads/despesaextra_comprovantes/${req.file.filename}` : null;

            const result = await pool.query(
                `INSERT INTO despesaextras
                    (idevento, dtreferencia, idorcamento, idempresa, categoria, tipo, valor,
                     justificativa, idfuncionario, idusuariolancamento, comprovante)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                 RETURNING *`,
                [idEventoFinal, dtreferencia, (idEventoFinal ? (idorcamento || null) : null), idempresa, categoria, tipo, valorNumerico,
                    String(justificativa).trim(), idfuncionario || null, idUsuarioLogado, comprovantePath]
            );

            const novaDespesa = result.rows[0];

            res.locals.acao = "cadastrou";
            res.locals.idregistroalterado = novaDespesa.iddespesaextra;
            res.locals.dadosnovos = novaDespesa;

            res.status(201).json(novaDespesa);
        } catch (error) {
            console.error("Erro ao criar despesa extra do evento:", error);
            res.status(500).json({ erro: "Erro ao criar despesa extra do evento." });
        }
    }
);

// PUT /despesaextra/:idDespesaExtra — edita um lançamento (categoria/tipo/valor/justificativa/
// funcionário/status seguem editáveis mesmo Pago, diferente do ajuste de staff — aqui não há
// ainda uma tela de Vencimentos própria que processe o pagamento, então o status também é
// mudado por aqui).
router.put("/:idDespesaExtra",
    verificarPermissao("DespesaExtra", "alterar"),
    uploadComprovanteDespesa,
    logMiddleware("DespesaExtra", {
        buscarDadosAnteriores: async (req) => {
            const result = await pool.query(
                `SELECT * FROM despesaextras WHERE iddespesaextra = $1`,
                [req.params.idDespesaExtra]
            );
            return {
                dadosanteriores: result.rows[0] || null,
                idregistroalterado: req.params.idDespesaExtra
            };
        }
    }),
    async (req, res) => {
        const idempresa = req.idempresa;
        const idUsuarioLogado = req.usuario.idusuario;
        const idDespesaExtra = req.params.idDespesaExtra;
        const {
            idevento, dtreferencia, idorcamento, categoria, tipo, valor,
            justificativa, idfuncionario, status, limparComprovante
        } = req.body;
        const idEventoFinal = idevento || null;

        if (!dtreferencia) {
            return res.status(400).json({ erro: "Data de referência é obrigatória." });
        }
        if (!categoria || !CATEGORIAS_VALIDAS.includes(categoria)) {
            return res.status(400).json({ erro: "Categoria inválida." });
        }
        if (!tipo || !["Despesa", "Estorno"].includes(tipo)) {
            return res.status(400).json({ erro: "Tipo (Despesa/Estorno) é obrigatório." });
        }
        const valorNumerico = parseFloatOrNull(valor);
        if (!valorNumerico || valorNumerico <= 0) {
            return res.status(400).json({ erro: "Valor deve ser maior que zero." });
        }
        if (!justificativa || !String(justificativa).trim()) {
            return res.status(400).json({ erro: "Justificativa é obrigatória." });
        }
        if (!status || !["Pendente", "Pago"].includes(status)) {
            return res.status(400).json({ erro: "Status inválido." });
        }

        try {
            const atual = await pool.query(
                `SELECT comprovante, status FROM despesaextras WHERE iddespesaextra = $1 AND idempresa = $2`,
                [idDespesaExtra, idempresa]
            );
            if (atual.rowCount === 0) {
                return res.status(404).json({ erro: "Lançamento não encontrado." });
            }

            if (idEventoFinal) {
                const eventoValido = await pool.query(
                    `SELECT 1 FROM orcamentos o
                       JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
                      WHERE o.idevento = $1 AND oe.idempresa = $2 LIMIT 1`,
                    [idEventoFinal, idempresa]
                );
                if (eventoValido.rowCount === 0) {
                    return res.status(404).json({ erro: "Evento não encontrado nesta empresa." });
                }
            }

            const comprovanteAntigo = atual.rows[0].comprovante;
            const comprovantePath = req.file
                ? `/uploads/despesaextra_comprovantes/${req.file.filename}`
                : (limparComprovante === "true" ? null : comprovanteAntigo);

            if (req.file || limparComprovante === "true") {
                deletarArquivoAntigo(comprovanteAntigo);
            }

            const statusMudouParaPago = status === "Pago" && atual.rows[0].status !== "Pago";
            const dtPagamentoClause = statusMudouParaPago ? "NOW()" : "dtpagamento";

            const result = await pool.query(
                `UPDATE despesaextras
                    SET idevento = $1, dtreferencia = $2, idorcamento = $3, categoria = $4, tipo = $5,
                        valor = $6, justificativa = $7, idfuncionario = $8, comprovante = $9,
                        status = $10, idusuarioaprovacao = $11, dtpagamento = ${dtPagamentoClause}
                 WHERE iddespesaextra = $12 AND idempresa = $13
                 RETURNING *`,
                [idEventoFinal, dtreferencia, (idEventoFinal ? (idorcamento || null) : null), categoria, tipo, valorNumerico,
                    String(justificativa).trim(), idfuncionario || null, comprovantePath,
                    status, idUsuarioLogado, idDespesaExtra, idempresa]
            );

            const despesaAtualizada = result.rows[0];

            res.locals.acao = "alterou";
            res.locals.idregistroalterado = idDespesaExtra;
            res.locals.dadosnovos = despesaAtualizada;

            res.json(despesaAtualizada);
        } catch (error) {
            console.error("Erro ao editar despesa extra do evento:", error);
            res.status(500).json({ erro: "Erro ao editar despesa extra do evento." });
        }
    }
);

module.exports = router;
