// utils/enviarEmail.js
//
// Envio de e-mail via SMTP genérico (nodemailer) — funciona com qualquer
// provedor que dê usuário/senha de SMTP (Outlook/Microsoft 365, uma caixa de
// hospedagem própria, etc.), configurado pelas variáveis de ambiente abaixo.
// Não é específico de nenhum provedor de propósito: o financeiro/TI só
// precisa colocar no .env os dados de SMTP de saída que já usam no Outlook
// (Configurações da conta > servidor de saída), sem precisar de nada extra
// no código.
"use strict";

const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");

let transporter = null;

function obterTransportador() {
  if (transporter) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    throw new Error("SMTP não configurado — preencha SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS no .env.");
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    // Porta 465 é SSL direto (secure=true); 587/25 usam STARTTLS
    // (secure=false, o nodemailer negocia o TLS depois de conectar) — esse é
    // o padrão da maioria dos provedores, incluindo Microsoft 365.
    secure: SMTP_SECURE === 'true' || Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
}

// `anexo` é opcional: { nome, caminhoRelativo } (caminho relativo à raiz do
// projeto, mesmo padrão de arquivopdf/arquivoxml salvos em notasfiscais).
async function enviarEmailComAnexo({ para, assunto, corpoTexto, corpoHtml, anexo }) {
  const remetenteNome = process.env.SMTP_FROM_NOME || 'JA System';
  const transportador = obterTransportador();

  const anexos = [];
  if (anexo?.caminhoRelativo) {
    const caminhoAbsoluto = path.join(__dirname, "..", anexo.caminhoRelativo);
    if (!fs.existsSync(caminhoAbsoluto)) {
      throw new Error(`Arquivo do anexo não encontrado: ${anexo.caminhoRelativo}`);
    }
    anexos.push({ filename: anexo.nome || path.basename(caminhoAbsoluto), path: caminhoAbsoluto });
  }

  await transportador.sendMail({
    from: `"${remetenteNome}" <${process.env.SMTP_USER}>`,
    to: para,
    subject: assunto,
    text: corpoTexto,
    html: corpoHtml || undefined,
    attachments: anexos,
  });
}

module.exports = { enviarEmailComAnexo };
