// Cifra/decifra reversível pra dados sensíveis que o TI precisa poder LER de volta
// (ex.: senha de e-mail corporativo) — diferente de senha de login, que é hash (bcrypt)
// e nunca precisa ser lida. AES-256-CBC com IV aleatório por valor.
const crypto = require("crypto");

const ALGORITMO = "aes-256-cbc";

function getChave() {
  const segredo = process.env.CIFRA_CHAVE || process.env.JWT_SECRET || "chave-padrao-trocar-no-env";
  return crypto.createHash("sha256").update(segredo).digest();
}

function cifrar(textoPuro) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITMO, getChave(), iv);
  const cifrado = Buffer.concat([cipher.update(String(textoPuro), "utf8"), cipher.final()]);
  return `${iv.toString("hex")}:${cifrado.toString("hex")}`;
}

function decifrar(valorCifrado) {
  const [ivHex, dadosHex] = String(valorCifrado).split(":");
  if (!ivHex || !dadosHex) return null;
  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITMO, getChave(), iv);
  const decifrado = Buffer.concat([decipher.update(Buffer.from(dadosHex, "hex")), decipher.final()]);
  return decifrado.toString("utf8");
}

module.exports = { cifrar, decifrar };
