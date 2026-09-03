const nodemailer = require("nodemailer");

let transporterPadrao = null;

function getTransporterPadrao() {
  if (transporterPadrao) return transporterPadrao;
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;

  transporterPadrao = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: SMTP_SECURE ? SMTP_SECURE === "true" : Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporterPadrao;
}

// Transporter avulso pra uma conta de e-mail corporativo específica (não cacheado —
// é montado na hora com a senha decifrada do tiemailcorporativo do usuário ativo).
// Assume o mesmo host/porta/segurança do .env (todas as contas @japromocoes.com.br
// ficam no mesmo provedor de e-mail).
function getTransporterPara(email, senha) {
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE } = process.env;
  if (!SMTP_HOST || !email || !senha) return null;

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: SMTP_SECURE ? SMTP_SECURE === "true" : Number(SMTP_PORT) === 465,
    auth: { user: email, pass: senha },
  });
}

// remetente (opcional): { email, senha, nome } — quando informado, envia usando a
// própria conta de e-mail corporativo do usuário ativo em vez da conta padrão do .env.
async function enviarEmail({ to, subject, html, remetente = null }) {
  let t;
  let from;

  if (remetente?.email && remetente?.senha) {
    t = getTransporterPara(remetente.email, remetente.senha);
    from = remetente.nome ? `${remetente.nome} <${remetente.email}>` : remetente.email;
  } else {
    t = getTransporterPadrao();
    from = process.env.SMTP_FROM_NOME
      ? `${process.env.SMTP_FROM_NOME} <${process.env.SMTP_USER}>`
      : process.env.SMTP_USER;
  }

  if (!t) {
    throw new Error("Envio de e-mail não configurado. Defina SMTP_HOST, SMTP_PORT, SMTP_USER e SMTP_PASS no .env.");
  }

  await t.sendMail({ from, to, subject, html });
}

module.exports = { enviarEmail };
