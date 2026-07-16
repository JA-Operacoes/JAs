const fs = require("fs");
const path = require("path");
const acorn = require("acorn");

const MAIN_JS_PATH = path.join(__dirname, "../../../public/js/Main.js");

// public/js/Main.js é um módulo ES de 18k+ linhas carregado direto no browser,
// com código de topo (fetch, DOM, setInterval) que roda ao ser importado — não dá
// para fazer require() do arquivo inteiro em teste. Em vez disso, usamos o acorn
// para localizar apenas as declarações que renderizarPedidos precisa e as avaliamos
// via `new Function`, que roda no mesmo realm jsdom do teste (document/Swal/
// fetchComToken já definidos pelo teste ficam visíveis como globais).
const NAMES = [
  "CAMPO_ADITIVO_EXTRA",
  "STATUS_PENDENTE",
  "STATUS_AUTORIZADO",
  "STATUS_REJEITADO",
  "formatarNomeSolicitacao",
  "parseDateLocal",
  "safeParse",
  "desbloquearFuncaoExcedidaAutorizada",
  "cardFuncaoExcedidaAditivo",
  "desbloquearBonificadoAutorizado",
  "cardBonificadoDiariaDobrada",
  "renderizarPedidos",
];

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
    throw new Error(`loadMainFunctions: declarações não encontradas em Main.js: ${missing.join(", ")}`);
  }
  return names.map((n) => found.get(n)).join("\n\n");
}

let cachedSource = null;

/**
 * Retorna um objeto com as funções extraídas de Main.js (safeParse, renderizarPedidos, etc.)
 * prontas para uso no teste. Requer que globais como document/Swal/fetchComToken já
 * existam no ambiente (jsdom) antes de chamar as funções retornadas.
 */
function loadMainFunctions() {
  if (!cachedSource) {
    const fileSource = fs.readFileSync(MAIN_JS_PATH, "utf8");
    cachedSource = extractDeclarations(fileSource, NAMES);
  }
  const factory = new Function(`${cachedSource}\nreturn { ${NAMES.join(", ")} };`);
  return factory();
}

module.exports = { loadMainFunctions, MAIN_JS_PATH };
