#!/usr/bin/env node
/**
 * Correção pontual de dados (não é migration de estrutura): marca
 * `tieventostatus.separado = true` para toda ocorrência de evento já
 * finalizada (dtfimrealizacao < hoje) que ainda não tinha o check marcado --
 * evento que já aconteceu não tem mais sentido cobrar confirmação manual de
 * "equipamentos separados" na tela de Eventos do TI Mode.
 *
 * Reaproveita a mesma regra de agrupamento por "ocorrência" da rota real
 * (GET /ti/eventos-ativos, routes/rotaTI.js): idorcamento_ancora = MIN(idorcamento)
 * dentro de idevento+idcliente+idmontagem+dtinirealizacao+dtfimrealizacao, por
 * empresa. Sem o filtro de "edição do ano corrente" que a tela usa (aqui
 * queremos TODO o histórico já finalizado, não só o que a tela mostra hoje).
 *
 * Uso:
 *    node scripts/marcar-separado-eventos-finalizados.js            (simulação)
 *    node scripts/marcar-separado-eventos-finalizados.js --aplicar  (grava)
 */

const pool = require('../db/conexaoDB');

const aplicar = process.argv.includes('--aplicar');

const SQL_OCORRENCIAS_FINALIZADAS_PENDENTES = `
  WITH base AS (
    SELECT
      o.idorcamento, o.idevento, o.idcliente, o.idmontagem,
      o.dtinirealizacao, o.dtfimrealizacao,
      oe.idempresa,
      MIN(o.idorcamento) OVER (
        PARTITION BY o.idevento, o.idcliente, o.idmontagem, o.dtinirealizacao, o.dtfimrealizacao, oe.idempresa
      ) AS idorcamento_ancora
    FROM orcamentoitens oi
    INNER JOIN orcamentos o ON o.idorcamento = oi.idorcamento
    INNER JOIN orcamentoempresas oe ON oe.idorcamento = o.idorcamento
    WHERE oi.idequipamento IS NOT NULL AND o.status <> 'R'
  ),
  ocorrencias AS (
    SELECT idorcamento_ancora, idempresa, MAX(dtfimrealizacao) AS dtfimrealizacao
    FROM base
    GROUP BY idorcamento_ancora, idempresa
  )
  SELECT oc.idorcamento_ancora, oc.idempresa, oc.dtfimrealizacao
  FROM ocorrencias oc
  LEFT JOIN tieventostatus tes
    ON tes.idorcamento_ancora = oc.idorcamento_ancora AND tes.idempresa = oc.idempresa
  WHERE oc.dtfimrealizacao < CURRENT_DATE
    AND COALESCE(tes.separado, false) = false
`;

async function main() {
  const { rows } = await pool.query(SQL_OCORRENCIAS_FINALIZADAS_PENDENTES);

  console.log(`${rows.length} ocorrência(s) finalizada(s) sem "separado = true":`);
  rows.forEach((r) => {
    console.log(`  idorcamento_ancora=${r.idorcamento_ancora} idempresa=${r.idempresa} fim=${new Date(r.dtfimrealizacao).toLocaleDateString('pt-BR')}`);
  });

  if (!rows.length) {
    console.log('Nada para corrigir.');
    await pool.end();
    return;
  }

  if (!aplicar) {
    console.log('\nSimulação — nada foi gravado. Use --aplicar para gravar.');
    await pool.end();
    return;
  }

  let gravados = 0;
  for (const r of rows) {
    await pool.query(
      `INSERT INTO tieventostatus (idorcamento_ancora, idempresa, separado, separado_em)
         VALUES ($1, $2, true, NOW())
         ON CONFLICT (idorcamento_ancora, idempresa)
         DO UPDATE SET separado = true, separado_em = COALESCE(tieventostatus.separado_em, NOW())`,
      [r.idorcamento_ancora, r.idempresa]
    );
    gravados++;
  }

  console.log(`\n✔ ${gravados} ocorrência(s) marcada(s) como separada(s).`);
  await pool.end();
}

main().catch((err) => {
  console.error('Erro ao corrigir "separado" dos eventos finalizados:', err);
  process.exit(1);
});
