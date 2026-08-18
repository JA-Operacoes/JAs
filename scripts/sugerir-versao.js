#!/usr/bin/env node
// Sugere que tipo de bump de versao (patch/minor/major) cabe nos commits da branch atual,
// comparados com a branch base (main/master). So AVISA — nunca altera nada nem bloqueia o
// push (chamado pelo hook githooks/pre-push, que sempre sai com exit 0).
//
// Escreve o resultado em SUGESTAO-VERSAO.txt (raiz do projeto, no .gitignore) além do
// console — programas de git sem console visível (GitHub Desktop, por ex.) não mostram
// saída de hook que termina sem erro, então o arquivo é a forma confiável de conferir.
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ARQUIVO_SAIDA = path.join(__dirname, "..", "SUGESTAO-VERSAO.txt");

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

// Imprime no console E grava no arquivo — sempre sobrescreve, pra nunca sobrar sugestão
// velha de uma branch anterior.
function registrar(mensagem) {
  console.log(`\n${mensagem}\n`);
  try {
    fs.writeFileSync(ARQUIVO_SAIDA, mensagem + "\n", "utf8");
  } catch (err) {
    console.error("⚠️  Não consegui gravar SUGESTAO-VERSAO.txt:", err.message);
  }
}

function main() {
  const agora = new Date().toLocaleString("pt-BR");
  const branchAtual = git("rev-parse --abbrev-ref HEAD");

  if (branchAtual === "main" || branchAtual === "master" || branchAtual === "HEAD") {
    registrar(`[${agora}] Push direto em "${branchAtual}" — sugestão de versão só se aplica ao publicar uma branch de feature.`);
    return;
  }

  const base = branchBase();
  if (!base) {
    registrar(`[${agora}] Não encontrei uma branch main/master pra comparar — sem sugestão.`);
    return;
  }

  let commits;
  try {
    commits = git(`log ${base}..HEAD --format=%s`).split("\n").filter(Boolean);
  } catch {
    registrar(`[${agora}] Não consegui comparar "${branchAtual}" com "${base}" — sem sugestão.`);
    return;
  }
  if (commits.length === 0) {
    registrar(`[${agora}] Nenhum commit novo em "${branchAtual}" em relação a "${base}" — sem sugestão.`);
    return;
  }

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
  const linhas = [
    `[${agora}] 📦 Sugestão de versão pra branch "${branchAtual}"`,
    `${commits.length} commit(s) desde ${baseCurto} — patch:${contagem.patch} minor:${contagem.minor} major:${contagem.major}${contagem.semClassificacao ? ` (${contagem.semClassificacao} sem palavra-chave reconhecida)` : ""}`,
  ];
  if (bump) {
    linhas.push(`→ Sugerido: ${bump.toUpperCase()} (${pkg.version} → ${proximaVersao[bump]})`);
    linhas.push(`Depois do merge, rodar na main: npm run ${COMANDO_NPM[bump]}`);
  } else {
    linhas.push("→ Não identifiquei um padrão claro nas mensagens de commit pra sugerir um bump.");
  }
  registrar(linhas.join("\n"));
}

main();
