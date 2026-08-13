// utils/envFile.js
//
// Atualiza (ou cria) uma variável no arquivo .env em disco E em process.env
// ao mesmo tempo. Só regravar o arquivo não basta: o servidor lê o .env uma
// única vez, na subida (dotenv.config()) — sem atualizar process.env também,
// a mudança só valeria a partir do próximo restart, deixando quem acabou de
// salvar achando que já está pronto quando não está.
"use strict";

const fs = require("fs");
const path = require("path");

const CAMINHO_ENV = path.join(__dirname, "..", ".env");

// Só aceita chaves nesse formato exato — quem chama nunca deve montar uma
// chave livre a partir de entrada do usuário (a sigla sempre vem do
// nmfantasia já salvo no banco, nunca do corpo da requisição). Isso evita
// que esse utilitário vire uma porta pra sobrescrever qualquer variável do
// .env (DB_PASS, JWT_SECRET etc.) por engano ou má-fé.
const CHAVE_VALIDA = /^NFE_CERTIFICADO_[A-Z0-9]{1,6}_(PATH|SENHA)$/;

function definirVariavelEnv(chave, valor) {
  if (!CHAVE_VALIDA.test(chave)) {
    throw new Error(`Chave de .env não permitida: ${chave}`);
  }

  const conteudoAtual = fs.existsSync(CAMINHO_ENV) ? fs.readFileSync(CAMINHO_ENV, "utf8") : "";
  const linhas = conteudoAtual.split(/\r?\n/);
  const valorSeguro = String(valor).replace(/\r?\n/g, " ");
  const novaLinha = `${chave}=${valorSeguro}`;
  const prefixo = `${chave}=`;

  const indice = linhas.findIndex((l) => l.startsWith(prefixo));
  if (indice >= 0) {
    linhas[indice] = novaLinha;
  } else {
    if (linhas.length && linhas[linhas.length - 1].trim() !== "") linhas.push("");
    linhas.push(novaLinha);
  }

  fs.writeFileSync(CAMINHO_ENV, linhas.join("\n"), "utf8");
  process.env[chave] = valor;
}

module.exports = { definirVariavelEnv };
