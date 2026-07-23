// db/migrate.js
// -----------------------------------------------------------------------------
// Runner de migrations em SQL puro. Aplica, EM ORDEM, os arquivos .sql da pasta
// db/migrations/ que ainda nao foram aplicados neste banco.
//
// Como funciona:
//   - Cria a tabela de controle `schema_migrations` (se nao existir).
//   - Le os arquivos .sql da pasta em ordem alfabetica (por isso o prefixo
//     numerico: 001_, 002_, ...).
//   - Aplica so os que ainda nao constam em schema_migrations, cada um dentro de
//     uma transacao (se der erro, faz ROLLBACK e para — nada fica pela metade).
//
// Usa as MESMAS variaveis de ambiente do app (.env / compose), entao roda igual
// no local (Postgres nativo) e dentro do container (teste/prod).
//
// Uso:
//   npm run migrate                        (local, usa o .env)
//   docker compose ... exec app npm run migrate   (dentro do container)
// -----------------------------------------------------------------------------
const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port: process.env.DB_PORT,
});

const DIR = path.join(__dirname, "migrations");

async function main() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        nome        text PRIMARY KEY,
        aplicada_em timestamptz NOT NULL DEFAULT now()
      )
    `);

    const res = await client.query("SELECT nome FROM schema_migrations");
    const aplicadas = new Set(res.rows.map((r) => r.nome));

    const arquivos = fs.existsSync(DIR)
      ? fs.readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort()
      : [];

    const pendentes = arquivos.filter((f) => !aplicadas.has(f));

    if (pendentes.length === 0) {
      console.log(`Nenhuma migration pendente. Banco '${process.env.DB_NAME}' atualizado.`);
      return;
    }

    console.log(`${pendentes.length} migration(s) pendente(s) em '${process.env.DB_NAME}':`);
    for (const arquivo of pendentes) {
      const sql = fs.readFileSync(path.join(DIR, arquivo), "utf8");
      console.log(`>> Aplicando ${arquivo}...`);
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (nome) VALUES ($1)", [arquivo]);
        await client.query("COMMIT");
        console.log(`   OK: ${arquivo}`);
      } catch (e) {
        await client.query("ROLLBACK");
        console.error(`   ERRO em ${arquivo} — nada foi aplicado deste arquivo:`);
        console.error(`   ${e.message}`);
        throw e;
      }
    }
    console.log(`Concluido: ${pendentes.length} migration(s) aplicada(s).`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Falha nas migrations:", err.message);
  process.exit(1);
});
