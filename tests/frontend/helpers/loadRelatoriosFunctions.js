const fs = require("fs");
const path = require("path");
const acorn = require("acorn");

const RELATORIOS_JS_PATH = path.join(__dirname, "../../../public/js/Relatorios.js");

// public/js/Relatorios.js é um módulo ES com código de topo (import de utils, fetch, listeners no
// DOM) que roda ao ser importado — não dá para fazer require() do arquivo inteiro. Mesmo esquema
// de loadMainFunctions: o acorn localiza só as declarações pedidas e `new Function` as avalia no
// realm jsdom do teste (document/Swal/etc. definidos pelo teste ficam visíveis como globais).
function extractDeclarations(source, names) {
  const ast = acorn.parse(source, { ecmaVersion: "latest", sourceType: "module" });
  const wanted = new Set(names);
  const found = new Map();

  for (const topo of ast.body) {
    const node = topo.type === "ExportNamedDeclaration" && topo.declaration ? topo.declaration : topo;
    if (node.type === "FunctionDeclaration" && node.id && wanted.has(node.id.name)) {
      found.set(node.id.name, source.slice(node.start, node.end));
    } else if (node.type === "VariableDeclaration") {
      for (const decl of node.declarations) {
        if (decl.id.type === "Identifier" && wanted.has(decl.id.name)) {
          found.set(decl.id.name, source.slice(node.start, node.end) + ";");
        }
      }
    }
  }

  const missing = names.filter((n) => !found.has(n));
  if (missing.length) {
    throw new Error(`loadRelatoriosFunctions: declarações não encontradas em Relatorios.js: ${missing.join(", ")}`);
  }
  return names.map((n) => found.get(n)).join("\n\n");
}

/**
 * `nomes` = funções/constantes de Relatorios.js que o teste quer. `globais` = variáveis de módulo
 * que essas funções leem (ex.: empresaLogoPath), injetadas como parâmetros.
 */
function loadRelatoriosFunctions(nomes, globais = {}) {
  const fonte = extractDeclarations(fs.readFileSync(RELATORIOS_JS_PATH, "utf8"), nomes);
  const chaves = Object.keys(globais);
  const factory = new Function(...chaves, `${fonte}\nreturn { ${nomes.join(", ")} };`);
  return factory(...chaves.map((k) => globais[k]));
}

module.exports = { loadRelatoriosFunctions, RELATORIOS_JS_PATH };
