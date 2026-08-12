const fs = require("fs");
const path = require("path");
const acorn = require("acorn");

const STAFF_JS_PATH = path.join(__dirname, "../../../public/js/Staff.js");

// public/js/Staff.js é um módulo de 20k+ linhas carregado direto no browser — não dá pra
// fazer require() do arquivo inteiro em teste. Usamos acorn pra localizar só as declarações
// pedidas e avaliá-las via `new Function`, que roda no mesmo realm jsdom do teste (document/
// Swal/checkboxes/etc. já definidos pelo teste como globais ficam visíveis como free vars).
function extractDeclarations(source, names) {
  const ast = acorn.parse(source, { ecmaVersion: "latest", sourceType: "module" });
  const wanted = new Set(names);
  const found = new Map();

  for (const node of ast.body) {
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
    throw new Error(`loadStaffFunctions: declarações não encontradas em Staff.js: ${missing.join(", ")}`);
  }
  return names.map((n) => found.get(n)).join("\n\n");
}

let cachedSource = null;

/**
 * Retorna um objeto com as funções extraídas de Staff.js prontas para uso no teste.
 * Requer que globais como document/Swal/checkboxes já existam no ambiente (jsdom) antes de
 * chamar as funções retornadas.
 */
function loadStaffFunctions(names) {
  if (!cachedSource) {
    cachedSource = fs.readFileSync(STAFF_JS_PATH, "utf8");
  }
  const declarations = extractDeclarations(cachedSource, names);
  const factory = new Function(`${declarations}\nreturn { ${names.join(", ")} };`);
  return factory();
}

module.exports = { loadStaffFunctions, STAFF_JS_PATH };
