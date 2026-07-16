// db/new-migration.js
// -----------------------------------------------------------------------------
// Gera um arquivo de migration VAZIO com nome baseado em TIMESTAMP, pra evitar
// colisao entre devs (dois nomes nunca batem, e a ordem alfabetica = cronologica).
//
// Uso:
//   npm run migrate:new "adiciona cpf em clientes"
//   npm run migrate:new -- "cria tabela folha"     (o -- garante o argumento)
//
// Resultado:
//   db/migrations/20260713_143052_adiciona_cpf_em_clientes.sql
// -----------------------------------------------------------------------------
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const DIR = path.join(__dirname, "migrations");

// Pergunta a descricao no terminal quando ela nao veio como argumento.
// Enter vazio = sair sem criar nada.
function perguntarDescricao() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(
      'Descricao da migration (Enter vazio para sair): ',
      (resposta) => {
        rl.close();
        resolve(resposta.trim());
      }
    );
  });
}

async function main() {
  // Junta tudo que veio depois do nome do script como a descricao.
  let descricao = process.argv.slice(2).join(" ").trim();

  // Sem descricao no argumento: pergunta de forma interativa.
  if (!descricao) {
    descricao = await perguntarDescricao();
  }

  if (!descricao) {
    console.error("Cancelado: nenhuma descricao informada.");
    process.exit(1);
  }

  criarMigration(descricao);
}

function criarMigration(descricao) {
// --- timestamp YYYYMMDD_HHMMSS ---
const d = new Date();
const p = (n) => String(n).padStart(2, "0");
const ts =
  `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_` +
  `${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;

// --- slug da descricao (sem acento, espacos viram _) ---
const slug = descricao
  .normalize("NFD")
  .replace(/[̀-ͯ]/g, "") // remove acentos (marcas combinantes)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "_") // nao-alfanumerico -> _
  .replace(/^_+|_+$/g, "") // tira _ das pontas
  .slice(0, 60);

const nome = `${ts}_${slug}.sql`;
const destino = path.join(DIR, nome);

if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });

const conteudo = `-- Migration: ${descricao}
-- Criada em: ${d.toISOString()}
--
-- Escreva abaixo o SQL da mudanca de ESTRUTURA (uma migration = uma mudanca).
-- Roda dentro de uma transacao; se der erro, nada deste arquivo e aplicado.
-- Depois de escrever: 'npm run migrate' pra aplicar no seu banco local.

`;

fs.writeFileSync(destino, conteudo, "utf8");
console.log(`Migration criada:\n  db/migrations/${nome}`);
console.log("Abra o arquivo, escreva o SQL da mudanca e rode: npm run migrate");
}

main();
