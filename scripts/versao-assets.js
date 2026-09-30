// scripts/versao-assets.js
// -----------------------------------------------------------------------------
// Troca os "?v=..." dos <script>/<link> de CSS e JS em public/*.html pela versão do
// package.json, pra o navegador buscar os arquivos novos depois de um deploy.
//
// Roda sozinho no gancho "version" do npm (ver package.json): `npm run Bug-fix`,
// `Novidade` e `Breaking` chamam `npm version`, que sobe o número no package.json, roda
// este script e junta os HTML alterados no MESMO commit da versão (o `git add` do gancho).
// Ninguém precisa lembrar de editar o ?v= à mão.
//
// Só mexe em referência que JÁ tem ?v= — arquivo sem versão continua sem.
//
// Uso manual (conferir sem gravar):  node scripts/versao-assets.js --dry
// -----------------------------------------------------------------------------
const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const PASTA_PUBLIC = path.join(RAIZ, "public");
const soConferir = process.argv.includes("--dry");

const { version } = JSON.parse(fs.readFileSync(path.join(RAIZ, "package.json"), "utf8"));
if (!version) {
  console.error("package.json sem campo version.");
  process.exit(1);
}

// "arquivo.js?v=20260922a" / "arquivo.css?v=1.18.0" — para no fim do valor do atributo.
const PADRAO = /(\.(?:js|css))\?v=[^"'\s>&]+/g;

let arquivosAlterados = 0;
let referencias = 0;

for (const nome of fs.readdirSync(PASTA_PUBLIC)) {
  if (!nome.endsWith(".html")) continue;
  const caminho = path.join(PASTA_PUBLIC, nome);
  const original = fs.readFileSync(caminho, "utf8");

  let trocasNoArquivo = 0;
  const novo = original.replace(PADRAO, (_, ext) => {
    trocasNoArquivo++;
    return `${ext}?v=${version}`;
  });

  if (novo !== original) {
    arquivosAlterados++;
    referencias += trocasNoArquivo;
    if (!soConferir) fs.writeFileSync(caminho, novo, "utf8");
    console.log(`${soConferir ? "[conferir] " : ""}${nome}: ${trocasNoArquivo} referência(s)`);
  }
}

console.log(
  `${soConferir ? "Conferência" : "Pronto"}: ?v=${version} em ${referencias} referência(s), ${arquivosAlterados} arquivo(s).`
);
