const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB");
const { autenticarToken, contextoEmpresa } = require('../middlewares/authMiddlewares');
const { verificarPermissao } = require('../middlewares/permissaoMiddleware');
const logMiddleware = require('../middlewares/logMiddleware');

// Normaliza/valida o corpo { nome, tipos:[{ nome, faixas:[{de,ate,valor}] }] }.
// Retorna { erro } quando invalido, ou { nome, tipos } limpo quando ok.
function normalizarPlano(body) {
  const nome = (body?.nome || "").trim();
  if (!nome) return { erro: "Informe o nome do plano." };

  const tiposEntrada = Array.isArray(body?.tipos) ? body.tipos : [];
  if (!tiposEntrada.length) return { erro: "Adicione ao menos um tipo de plano." };

  const tipos = [];
  for (const t of tiposEntrada) {
    const nomeTipo = (t?.nome || "").trim();
    if (!nomeTipo) return { erro: "Todo tipo precisa de um nome." };

    const faixas = (Array.isArray(t?.faixas) ? t.faixas : []).map((f) => ({
      de: f?.de != null ? Number(f.de) : null,
      ate: f?.ate != null ? Number(f.ate) : null, // null = idade em diante (ultima faixa)
      valor: f?.valor != null ? Number(f.valor) : null,
    }));
    if (!faixas.length) return { erro: `O tipo "${nomeTipo}" nao tem nenhuma faixa de valor.` };

    tipos.push({ nome: nomeTipo, faixas });
  }
  return { nome, tipos };
}

// jsonb[] no pg: passa um array de STRINGS json e casta com $n::jsonb[].
const paraJsonbArray = (tipos) => tipos.map((t) => JSON.stringify(t));

// Ao ler, cada elemento do jsonb[] pode vir como objeto (ja parseado) ou string.
const normalizarTiposLidos = (tipos) =>
  (Array.isArray(tipos) ? tipos : []).map((t) => (typeof t === "string" ? JSON.parse(t) : t));

// ---- Listar (para o Pesquisar / montar seletor) ----
router.get("/", verificarPermissao('PlanoSaude', 'pesquisar'), async (req, res) => {
  try {
    // Por padrao lista so os ativos; ?incluirInativos=1 traz todos.
    const incluirInativos = req.query.incluirInativos === '1' || req.query.incluirInativos === 'true';
    const { rows } = await pool.query(
      `SELECT idplanosaude, nome, tipos, ativo
         FROM planosaude
        WHERE idempresa = $1
          AND ($2::boolean OR ativo = true)
        ORDER BY lower(nome)`,
      [req.idempresa, incluirInativos]
    );
    res.json(rows.map((r) => ({ ...r, tipos: normalizarTiposLidos(r.tipos) })));
  } catch (err) {
    console.error("Erro ao listar planos de saude:", err);
    res.status(500).json({ erro: "Erro ao listar planos de saude." });
  }
});

// ---- Buscar um ----
router.get("/:id", verificarPermissao('PlanoSaude', 'pesquisar'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT idplanosaude, nome, tipos, ativo
         FROM planosaude
        WHERE idplanosaude = $1 AND idempresa = $2`,
      [req.params.id, req.idempresa]
    );
    if (!rows.length) return res.status(404).json({ erro: "Plano nao encontrado." });
    const r = rows[0];
    res.json({ ...r, tipos: normalizarTiposLidos(r.tipos) });
  } catch (err) {
    console.error("Erro ao buscar plano de saude:", err);
    res.status(500).json({ erro: "Erro ao buscar plano de saude." });
  }
});

// ---- Criar ----
router.post("/",
  verificarPermissao('PlanoSaude', 'cadastrar'),
  logMiddleware('PlanoSaude', { acao: 'cadastrou' }),
  async (req, res) => {
    const dados = normalizarPlano(req.body);
    if (dados.erro) return res.status(400).json({ erro: dados.erro });

    try {
      const { rows } = await pool.query(
        `INSERT INTO planosaude (idempresa, nome, tipos)
         VALUES ($1, $2, $3::jsonb[])
         RETURNING idplanosaude, nome, tipos`,
        [req.idempresa, dados.nome, paraJsonbArray(dados.tipos)]
      );
      const novo = rows[0];
      res.locals.idregistroalterado = novo.idplanosaude;
      res.status(201).json({ ...novo, tipos: normalizarTiposLidos(novo.tipos) });
    } catch (err) {
      if (err.code === '23505') { // unique_violation
        return res.status(409).json({ erro: "Ja existe um plano com esse nome." });
      }
      console.error("Erro ao criar plano de saude:", err);
      res.status(500).json({ erro: "Erro ao criar plano de saude." });
    }
  }
);

// ---- Atualizar ----
router.put("/:id",
  verificarPermissao('PlanoSaude', 'alterar'),
  logMiddleware('PlanoSaude', {
    acao: 'editou',
    buscarDadosAnteriores: async (req) => {
      const { rows } = await pool.query(
        `SELECT * FROM planosaude WHERE idplanosaude = $1 AND idempresa = $2`,
        [req.params.id, req.idempresa]
      );
      return { dadosanteriores: rows[0] || null, idregistroalterado: req.params.id };
    }
  }),
  async (req, res) => {
    const dados = normalizarPlano(req.body);
    if (dados.erro) return res.status(400).json({ erro: dados.erro });

    try {
      // ativo e opcional: quando enviado, permite reativar/inativar junto da edicao.
      const ativo = typeof req.body?.ativo === 'boolean' ? req.body.ativo : null;
      const { rows } = await pool.query(
        `UPDATE planosaude
            SET nome = $1, tipos = $2::jsonb[],
                ativo = COALESCE($3::boolean, ativo), atualizadoem = now()
          WHERE idplanosaude = $4 AND idempresa = $5
        RETURNING idplanosaude, nome, tipos, ativo`,
        [dados.nome, paraJsonbArray(dados.tipos), ativo, req.params.id, req.idempresa]
      );
      if (!rows.length) return res.status(404).json({ erro: "Plano nao encontrado." });
      const atualizado = rows[0];
      res.json({ ...atualizado, tipos: normalizarTiposLidos(atualizado.tipos) });
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ erro: "Ja existe um plano com esse nome." });
      }
      console.error("Erro ao atualizar plano de saude:", err);
      res.status(500).json({ erro: "Erro ao atualizar plano de saude." });
    }
  }
);

// ---- Inativar (soft delete) ----
// Nao apaga o registro: marca ativo = false, preservando historico e vinculos.
router.delete("/:id",
  verificarPermissao('PlanoSaude', 'apagar'),
  logMiddleware('PlanoSaude', {
    acao: 'inativou',
    buscarDadosAnteriores: async (req) => {
      const { rows } = await pool.query(
        `SELECT * FROM planosaude WHERE idplanosaude = $1 AND idempresa = $2`,
        [req.params.id, req.idempresa]
      );
      return { dadosanteriores: rows[0] || null, idregistroalterado: req.params.id };
    }
  }),
  async (req, res) => {
    try {
      const { rows } = await pool.query(
        `UPDATE planosaude
            SET ativo = false, atualizadoem = now()
          WHERE idplanosaude = $1 AND idempresa = $2
        RETURNING idplanosaude, nome, tipos, ativo`,
        [req.params.id, req.idempresa]
      );
      if (!rows.length) return res.status(404).json({ erro: "Plano nao encontrado." });
      const r = rows[0];
      res.json({ ...r, tipos: normalizarTiposLidos(r.tipos) });
    } catch (err) {
      console.error("Erro ao inativar plano de saude:", err);
      res.status(500).json({ erro: "Erro ao inativar plano de saude." });
    }
  }
);

module.exports = router;
