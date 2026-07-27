const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB");
const { autenticarToken, contextoEmpresa } = require('../middlewares/authMiddlewares');
const { verificarPermissao } = require('../middlewares/permissaoMiddleware');
const logMiddleware = require('../middlewares/logMiddleware');

// Modelo relacional em 2 tabelas:
//   tipoplanosaude   -> um registro por tipo; nomeplano repete entre os tipos do plano
//   faixasplanosaude -> faixas (de/ate/valor) de cada tipo (ON DELETE CASCADE)
// Um "plano" nao tem tabela propria: e identificado por (idempresa, nomeplano).

// Valida/normaliza o corpo { nome, tipos:[{ nome, faixas:[{de,ate,valor}] }] }.
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
      ate: f?.ate != null ? Number(f.ate) : null, // null = idade em diante
      valor: f?.valor != null ? Number(f.valor) : null,
    }));
    if (!faixas.length) return { erro: `O tipo "${nomeTipo}" nao tem nenhuma faixa de valor.` };
    if (faixas.some((f) => f.valor == null)) return { erro: `Preencha o valor de todas as faixas de "${nomeTipo}".` };

    tipos.push({ nome: nomeTipo, faixas });
  }
  return { nome, tipos };
}

// Insere um plano inteiro (tipos + faixas) usando o client de uma transacao.
async function inserirPlano(client, idempresa, nome, tipos) {
  for (const t of tipos) {
    const { rows } = await client.query(
      `INSERT INTO tipoplanosaude (idempresa, nomeplano, nometipo)
       VALUES ($1, $2, $3) RETURNING idtipoplanosaude`,
      [idempresa, nome, t.nome]
    );
    const idtipo = rows[0].idtipoplanosaude;
    for (const f of t.faixas) {
      await client.query(
        `INSERT INTO faixasplanosaude (idtipoplanosaude, de, ate, valor)
         VALUES ($1, $2, $3, $4)`,
        [idtipo, f.de, f.ate, f.valor]
      );
    }
  }
}

// Monta o objeto { nome, tipos:[{ idtipo, nome, faixas }] } de um plano.
async function carregarPlano(idempresa, nomeplano) {
  const { rows } = await pool.query(
    `SELECT t.idtipoplanosaude, t.nometipo,
            f.idfaixaplano, f.de, f.ate, f.valor
       FROM tipoplanosaude t
       LEFT JOIN faixasplanosaude f ON f.idtipoplanosaude = t.idtipoplanosaude
      WHERE t.idempresa = $1 AND lower(t.nomeplano) = lower($2) AND t.ativo = true
      ORDER BY t.idtipoplanosaude, f.de NULLS LAST, f.idfaixaplano`,
    [idempresa, nomeplano]
  );
  if (!rows.length) return null;

  const mapa = new Map();
  for (const r of rows) {
    if (!mapa.has(r.idtipoplanosaude)) {
      mapa.set(r.idtipoplanosaude, { idtipo: r.idtipoplanosaude, nome: r.nometipo, faixas: [] });
    }
    if (r.idfaixaplano != null) {
      mapa.get(r.idtipoplanosaude).faixas.push({
        de: r.de, ate: r.ate, valor: r.valor != null ? Number(r.valor) : null,
      });
    }
  }
  return { nome: nomeplano, tipos: [...mapa.values()] };
}

// ---- Listar planos (nomes distintos + qtd de tipos) ----
router.get("/", verificarPermissao('PlanoSaude', 'pesquisar'), async (req, res) => {
  try {
    const incluirInativos = req.query.incluirInativos === '1' || req.query.incluirInativos === 'true';
    const { rows } = await pool.query(
      `SELECT nomeplano AS nome, COUNT(*)::int AS qtdtipos
         FROM tipoplanosaude
        WHERE idempresa = $1 AND ($2::boolean OR ativo = true)
        GROUP BY nomeplano
        ORDER BY lower(nomeplano)`,
      [req.idempresa, incluirInativos]
    );
    res.json(rows);
  } catch (err) {
    console.error("Erro ao listar planos de saude:", err);
    res.status(500).json({ erro: "Erro ao listar planos de saude." });
  }
});

// ---- Buscar um plano pelo nome ----
router.get("/:nome", verificarPermissao('PlanoSaude', 'pesquisar'), async (req, res) => {
  try {
    const plano = await carregarPlano(req.idempresa, req.params.nome);
    if (!plano) return res.status(404).json({ erro: "Plano nao encontrado." });
    plano.nome = req.params.nome;
    res.json(plano);
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

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const existe = await client.query(
        `SELECT 1 FROM tipoplanosaude
          WHERE idempresa = $1 AND lower(nomeplano) = lower($2) AND ativo = true LIMIT 1`,
        [req.idempresa, dados.nome]
      );
      if (existe.rows.length) {
        await client.query('ROLLBACK');
        return res.status(409).json({ erro: "Ja existe um plano com esse nome." });
      }

      await inserirPlano(client, req.idempresa, dados.nome, dados.tipos);
      await client.query('COMMIT');
      res.locals.acao = 'cadastrou';
      res.status(201).json({ nome: dados.nome, tipos: dados.tipos });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error("Erro ao criar plano de saude:", err);
      res.status(500).json({ erro: "Erro ao criar plano de saude." });
    } finally {
      client.release();
    }
  }
);

// ---- Atualizar (substitui tudo do plano; :nome e o nome ORIGINAL) ----
router.put("/:nome",
  verificarPermissao('PlanoSaude', 'alterar'),
  logMiddleware('PlanoSaude', { acao: 'editou' }),
  async (req, res) => {
    const dados = normalizarPlano(req.body);
    if (dados.erro) return res.status(400).json({ erro: dados.erro });

    const nomeOriginal = req.params.nome;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Se renomeou, garante que o novo nome nao colide com outro plano ativo.
      if (dados.nome.toLowerCase() !== nomeOriginal.toLowerCase()) {
        const colide = await client.query(
          `SELECT 1 FROM tipoplanosaude
            WHERE idempresa = $1 AND lower(nomeplano) = lower($2) AND ativo = true LIMIT 1`,
          [req.idempresa, dados.nome]
        );
        if (colide.rows.length) {
          await client.query('ROLLBACK');
          return res.status(409).json({ erro: "Ja existe um plano com esse nome." });
        }
      }

      // Remove os tipos atuais do plano (cascata apaga as faixas) e reinsere.
      const del = await client.query(
        `DELETE FROM tipoplanosaude
          WHERE idempresa = $1 AND lower(nomeplano) = lower($2)`,
        [req.idempresa, nomeOriginal]
      );
      if (!del.rowCount) {
        await client.query('ROLLBACK');
        return res.status(404).json({ erro: "Plano nao encontrado." });
      }

      await inserirPlano(client, req.idempresa, dados.nome, dados.tipos);
      await client.query('COMMIT');
      res.json({ nome: dados.nome, tipos: dados.tipos });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error("Erro ao atualizar plano de saude:", err);
      res.status(500).json({ erro: "Erro ao atualizar plano de saude." });
    } finally {
      client.release();
    }
  }
);

// ---- Inativar (soft delete) todos os tipos do plano ----
router.delete("/:nome",
  verificarPermissao('PlanoSaude', 'apagar'),
  logMiddleware('PlanoSaude', { acao: 'inativou' }),
  async (req, res) => {
    try {
      const { rowCount } = await pool.query(
        `UPDATE tipoplanosaude SET ativo = false, atualizadoem = now()
          WHERE idempresa = $1 AND lower(nomeplano) = lower($2) AND ativo = true`,
        [req.idempresa, req.params.nome]
      );
      if (!rowCount) return res.status(404).json({ erro: "Plano nao encontrado." });
      res.json({ nome: req.params.nome, inativado: true });
    } catch (err) {
      console.error("Erro ao inativar plano de saude:", err);
      res.status(500).json({ erro: "Erro ao inativar plano de saude." });
    }
  }
);

module.exports = router;
