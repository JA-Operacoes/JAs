#!/usr/bin/env node
// Sugere que tipo de bump de versao (patch/minor/major) cabe nos commits da branch atual,
// comparados com a branch base (main/master). So AVISA no terminal — nunca altera nada nem
// bloqueia o push (chamado pelo hook githooks/pre-push, que sempre sai com exit 0).
const { execSync } = require("child_process");
const path = require("path");

function git(cmd) {
  return execSync(`git ${cmd}`, { encoding: "utf8" }).trim();
}

function branchBase() {
  try {
    execSync("git fetch origin main --quiet", { stdio: "ignore" });
  } catch {
    // sem rede ou sem remote "origin" — segue com o que já tem localmente
  }
  for (const ref of ["origin/main", "origin/master", "main", "master"]) {
    try {
      git(`rev-parse --verify ${ref}`);
      return ref;
    } catch {
      // ref não existe, tenta a próxima
    }
  }
  return null;
}

// Heurística simples em cima das mensagens de commit livres da equipe (não são Conventional
// Commits) — procura palavras-chave em português/inglês comuns no histórico do projeto.
function classificarCommit(msg) {
  const texto = msg.toLowerCase();
  const PALAVRAS_MAJOR = ["breaking change", "quebra compatibilidade", "incompatível", "incompativel"];
  const PALAVRAS_MINOR = ["adiciona", "inclusão", "inclusao", "nova tela", "novo módulo", "novo modulo", "feature", "implementa", "cria "];
  const PALAVRAS_PATCH = ["corrige", "correção", "correcao", "fix", "ajusta", "bug"];
  if (PALAVRAS_MAJOR.some((p) => texto.includes(p))) return "major";
  if (PALAVRAS_MINOR.some((p) => texto.includes(p))) return "minor";
  if (PALAVRAS_PATCH.some((p) => texto.includes(p))) return "patch";
  return null;
}

const COMANDO_NPM = { patch: "Bug-fix", minor: "Novidade", major: "Breaking" };

function main() {
  const branchAtual = git("rev-parse --abbrev-ref HEAD");
  if (branchAtual === "main" || branchAtual === "master" || branchAtual === "HEAD") return;

  const base = branchBase();
  if (!base) return; // repositório sem main/master pra comparar — pula silenciosamente

  let commits;
  try {
    commits = git(`log ${base}..HEAD --format=%s`).split("\n").filter(Boolean);
  } catch {
    return;
  }
  if (commits.length === 0) return;

  const contagem = { major: 0, minor: 0, patch: 0, semClassificacao: 0 };
  commits.forEach((msg) => {
    const tipo = classificarCommit(msg);
    if (tipo) contagem[tipo]++;
    else contagem.semClassificacao++;
  });

  const bump = contagem.major > 0 ? "major" : contagem.minor > 0 ? "minor" : contagem.patch > 0 ? "patch" : null;

  const pkg = require(path.join(__dirname, "..", "package.json"));
  const [maj, min, pat] = pkg.version.split(".").map(Number);
  const proximaVersao = {
    major: `${maj + 1}.0.0`,
    minor: `${maj}.${min + 1}.0`,
    patch: `${maj}.${min}.${pat + 1}`,
  };

  const baseCurto = base.replace("origin/", "");
  console.log("");
  console.log("📦 Sugestão de versão pra essa branch:");
  console.log(`   ${commits.length} commit(s) desde ${baseCurto} — patch:${contagem.patch} minor:${contagem.minor} major:${contagem.major}${contagem.semClassificacao ? ` (${contagem.semClassificacao} sem palavra-chave reconhecida)` : ""}`);
  if (bump) {
    console.log(`   → Sugerido: ${bump.toUpperCase()} (${pkg.version} → ${proximaVersao[bump]})`);
    console.log(`   Depois do merge, rodar na main: npm run ${COMANDO_NPM[bump]}`);
  } else {
    console.log("   → Não identifiquei um padrão claro nas mensagens de commit pra sugerir um bump.");
  }
  console.log("");
}

main();
