// Rota PÚBLICA (sem autenticação) — links de aprovar/recusar orçamento de equipamento
// enviados por e-mail. O segredo é o token (aleatório, uso único, invalidado após a decisão).
const express = require("express");
const router = express.Router();
const pool = require("../db/conexaoDB");
const registrarLog = require("../utils/logger");
const { criarNotificacao } = require("../src/services/NotificacaoServices");

function paginaResposta({ mensagem, sucesso, icone, detalhe = null }) {
  const cor = sucesso ? "#2e7d32" : "#942123";
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
    <title>Orçamento de equipamento — JA Sistema</title>
    <style>
      * { box-sizing: border-box; }
      body {
        font-family: 'Segoe UI', system-ui, sans-serif;
        display: flex; align-items: center; justify-content: center;
        min-height: 100vh; margin: 0; background: #f3f4f6;
      }
      .card {
        background: #fff; border-radius: 16px; overflow: hidden;
        box-shadow: 0 8px 28px rgba(0,0,0,.12); max-width: 440px; width: 90%;
        text-align: center;
      }
      .topo { background: #942123; padding: 18px; }
      .topo span { color: #fff; font-weight: 700; font-size: 14px; letter-spacing: .5px; }
      .conteudo { padding: 36px 32px 32px; }
      .icone {
        width: 64px; height: 64px; border-radius: 50%; margin: 0 auto 18px;
        display: flex; align-items: center; justify-content: center;
        background: ${cor}1a; color: ${cor}; font-size: 32px;
      }
      h1 { font-size: 19px; color: #222; margin: 0 0 8px; }
      .detalhe { font-size: 14px; color: #666; margin: 0; line-height: 1.5; }
    </style></head>
    <body>
      <div class="card">
        <div class="topo"><span>JA SISTEMA — TI</span></div>
        <div class="conteudo">
          <div class="icone">${icone || (sucesso ? "✓" : "✕")}</div>
          <h1>${mensagem}</h1>
          ${detalhe ? `<p class="detalhe">${detalhe}</p>` : ""}
        </div>
      </div>
    </body></html>`;
}

async function decidir(req, res, novoStatus) {
  const { token } = req.params;

  try {
    const result = await pool.query(
      `UPDATE equipamentoorcamentocompra o
         SET status = $1::varchar, data_decisao = NOW(), token_aprovacao = NULL,
             motivo_recusa = CASE WHEN $1::varchar = 'reprovado' THEN 'Recusado via e-mail' ELSE motivo_recusa END
         FROM equipamentomanutencao m
         INNER JOIN equipamentos eq ON eq.idequip = m.idequip
         WHERE o.idmanutencao = m.idmanutencao AND o.token_aprovacao = $2 AND o.status = 'pendente'
         RETURNING o.*, eq.descEquip, o.fornecedor, o.valor`,
      [novoStatus, token]
    );

    if (!result.rowCount) {
      return res.send(paginaResposta({
        mensagem: "Este link já foi usado ou não é mais válido.",
        sucesso: false,
        icone: "!",
        detalhe: "Se você acha que isso é um engano, peça pra reenviarem o e-mail de aprovação.",
      }));
    }

    const orcamento = result.rows[0];
    const valorFormatado = orcamento.valor != null
      ? "R$ " + Number(orcamento.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })
      : null;
    const resumo = `${orcamento.descequip || "Equipamento"}${orcamento.fornecedor ? " — " + orcamento.fornecedor : ""}${valorFormatado ? " — " + valorFormatado : ""}`;

    // Decisão veio por link de e-mail (sem login) — não há usuário autenticado, então o log
    // fica registrado em nome de quem solicitou o orçamento, deixando claro na ação que a
    // decisão em si foi tomada via e-mail por um aprovador externo.
    if (orcamento.idusuario_solicitante) {
      registrarLog({
        idexecutor: orcamento.idusuario_solicitante,
        idempresa: orcamento.idempresa,
        acao: novoStatus === "aprovado" ? "orçamento de manutenção aprovado via e-mail" : "orçamento de manutenção recusado via e-mail",
        modulo: "TI",
        idregistroalterado: orcamento.idorcamento,
        dadosnovos: orcamento,
      });

      // Avisa quem pediu o orçamento que a decisão saiu, pelo sininho de notificações.
      criarNotificacao(orcamento.idusuario_solicitante, orcamento.idempresa, {
        tipo: novoStatus === "aprovado" ? "sucesso" : "erro",
        mensagem: novoStatus === "aprovado"
          ? `Orçamento aprovado: ${resumo}`
          : `Orçamento recusado: ${resumo}`,
        metadata: { modulo: "TI", idorcamento: orcamento.idorcamento, idmanutencao: orcamento.idmanutencao },
      }).catch((erro) => console.error("Erro ao criar notificação de decisão de orçamento:", erro));
    }

    res.send(paginaResposta({
      mensagem: novoStatus === "aprovado" ? "Orçamento aprovado com sucesso!" : "Orçamento recusado.",
      sucesso: novoStatus === "aprovado",
      detalhe: `${orcamento.descequip || "Equipamento"}${orcamento.fornecedor ? " — " + orcamento.fornecedor : ""}${valorFormatado ? " — " + valorFormatado : ""}`,
    }));
  } catch (error) {
    console.error("Erro ao decidir orçamento de equipamento via e-mail:", error);
    res.status(500).send(paginaResposta({
      mensagem: "Erro ao processar sua decisão.",
      sucesso: false,
      icone: "✕",
      detalhe: "Tente novamente mais tarde ou avise o TI.",
    }));
  }
}

router.get("/:token/aprovar", (req, res) => decidir(req, res, "aprovado"));
router.get("/:token/recusar", (req, res) => decidir(req, res, "reprovado"));

module.exports = router;
