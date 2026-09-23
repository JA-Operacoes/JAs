const fs = require("fs");
const path = require("path");
const acorn = require("acorn");

const PEDIDOS_JS_PATH = path.join(__dirname, "../../../public/js/Pedidos.js");

// Mesma estratégia do loadMainFunctions: Main.js é um módulo ES gigante com
// código de topo que roda no import (fetch, setInterval, DOM), então não dá para
// fazer require() do arquivo. Extraímos via acorn só as declarações do pipeline
// de Pedidos e as avaliamos com `new Function` no realm do jsdom.
const NAMES = [
  "CAMPO_ADITIVO_EXTRA",
  "STATUS_PENDENTE",
  "STATUS_AUTORIZADO",
  "STATUS_REJEITADO",
  "safeParse",
  "CAMPOS_STATUS_PEDIDO",
  "CAMPO_DADOS_POR_STATUS",
  "STATUS_PENDENTE_LOWER",
  "STATUS_AUTORIZADO_LOWER",
  "STATUS_REJEITADO_LOWER",
  "normalizarStatusPedido",
  "categoriasPreenchidasDoPedido",
  "statusDoItemDesmembrado",
  "desmembrarPedidosPorStatus",
  "rotuloDeItemDeFuncao",
  "ehItemDeFuncao",
  "agruparPedidosPorFuncionario",
  "ordenarGruposPorSolicitacaoMaisRecente",
  "aditivoEhDeFuncionario",
  "ehRegistroAditivo",
  "separarGruposPorAba",
  "pedidoTemStatus",
  "contarStatusDosGrupos",
  "montarHtmlPainelPedidos",
  "normalizarTextoBusca",
  "filtrarGruposPorBusca",
  "contarPedidosParaResumo",
];

function extractDeclarations(source, names) {
  const ast = acorn.parse(source, { ecmaVersion: "latest", sourceType: "module" });
  const wanted = new Set(names);
  const found = new Map();

  for (const topo of ast.body) {
    // `export const X = …` chega como ExportNamedDeclaration embrulhando a
    // declaração de verdade — o que interessa aqui é o miolo (sem o `export`,
    // que não é válido dentro de `new Function`).
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
    throw new Error(`loadPedidosFunctions: declarações não encontradas em Pedidos.js: ${missing.join(", ")}`);
  }
  // Ordem de NAMES importa: constantes primeiro, porque são const (TDZ).
  return names.map((n) => found.get(n)).join("\n\n");
}

let cachedSource = null;

function loadPedidosFunctions() {
  if (!cachedSource) {
    cachedSource = extractDeclarations(fs.readFileSync(PEDIDOS_JS_PATH, "utf8"), NAMES);
  }
  const factory = new Function(`${cachedSource}\nreturn { ${NAMES.join(", ")} };`);
  return factory();
}

module.exports = { loadPedidosFunctions, PEDIDOS_JS_PATH };
