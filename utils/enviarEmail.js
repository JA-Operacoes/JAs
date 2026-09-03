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
const MailComposer = require("nodemailer/lib/mail-composer");
const { ImapFlow } = require("imapflow");

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

// SMTP puro (o que o transportador acima faz) só entrega o e-mail — quem
// salva a cópia na pasta "Enviados" normalmente é o próprio cliente de
// e-mail (Outlook, webmail), via uma chamada IMAP separada depois do envio.
// Como aqui o envio é direto por código, sem passar por nenhum cliente,
// replicamos essa segunda etapa na mão: reconstrói a mensagem crua (mesmo
// conteúdo/anexo que foi enviado) e grava com IMAP APPEND na pasta certa.
//
// Reaproveita host/usuário/senha do próprio SMTP por padrão (é a mesma
// caixa) — só precisa de variáveis IMAP_* separadas se o provedor usar um
// host diferente pra IMAP. Se IMAP não estiver configurável (faltando
// host/usuário/senha), simplesmente não tenta — o e-mail já foi entregue
// via SMTP de qualquer forma, isso aqui é só o registro.
async function salvarCopiaEnviados(mailOptions) {
  const host = process.env.IMAP_HOST || process.env.SMTP_HOST;
  const user = process.env.IMAP_USER || process.env.SMTP_USER;
  const pass = process.env.IMAP_PASS || process.env.SMTP_PASS;
  if (!host || !user || !pass) return;

  const mensagemCrua = await new Promise((resolve, reject) => {
    new MailComposer(mailOptions).compile().build((err, message) => (err ? reject(err) : resolve(message)));
  });

  const client = new ImapFlow({
    host,
    port: Number(process.env.IMAP_PORT) || 993,
    secure: process.env.IMAP_SECURE !== 'false',
    auth: { user, pass },
    logger: false,
  });

  await client.connect();
  try {
    const pasta = process.env.IMAP_PASTA_ENVIADOS || (await encontrarPastaEnviados(client));
    await client.append(pasta, mensagemCrua, ['\\Seen']);
  } finally {
    await client.logout();
  }
}

// A maioria dos servidores modernos anuncia qual pasta é a de enviados via
// a extensão IMAP SPECIAL-USE (RFC 6154, flag \Sent) — tenta isso primeiro.
// Hospedagens mais simples (cPanel/Horde etc.) às vezes não anunciam, então
// cai pra uma lista de nomes comuns em pt-BR/en-US como segunda tentativa.
async function encontrarPastaEnviados(client) {
  const pastas = await client.list();

  const porFlagEspecial = pastas.find((p) => p.specialUse === '\\Sent');
  if (porFlagEspecial) return porFlagEspecial.path;

  const candidatos = [
    'Sent', 'INBOX.Sent', 'Sent Items', 'INBOX.Sent Items',
    'Enviados', 'INBOX.Enviados', 'Enviadas', 'INBOX.Enviadas',
  ];
  const porNome = pastas.find((p) => candidatos.some((c) => c.toLowerCase() === p.path.toLowerCase()));
  if (porNome) return porNome.path;

  throw new Error(
    `Não achei a pasta de "Enviados" (pastas disponíveis: ${pastas.map((p) => p.path).join(', ')}). ` +
    `Configure IMAP_PASTA_ENVIADOS no .env com o nome exato.`
  );
}

// Quando a cópia em "Enviados" falha, manda o mesmo e-mail (mesmo anexo) de
// novo, só que como cópia pro financeiro — pra não perder o registro de que
// aquilo foi enviado, já que não deu pra guardar na pasta certa. Se ATÉ essa
// cópia falhar (SMTP fora do ar etc.), só loga: o e-mail original pro
// cliente já foi entregue de qualquer forma, isso aqui é só um extra.
async function enviarCopiaFalhaEnviados(transportador, mailOptionsOriginal, motivoFalha) {
  const copiaPara = process.env.EMAIL_COPIA_FALHA_ENVIADOS || process.env.SMTP_USER;
  if (!copiaPara) return;

  const aviso =
    `⚠️ Não foi possível salvar automaticamente uma cópia deste e-mail na pasta "Enviados" ` +
    `(motivo: ${motivoFalha}).\nPor isso ele foi reenviado como cópia pra cá, só pra manter o registro.\n` +
    `Destinatário original: ${mailOptionsOriginal.to}\n\n---\n\n`;

  await transportador.sendMail({
    ...mailOptionsOriginal,
    to: copiaPara,
    subject: `[Cópia — falha ao salvar em Enviados] ${mailOptionsOriginal.subject}`,
    text: aviso + (mailOptionsOriginal.text || ''),
  });
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

  const mailOptions = {
    from: `"${remetenteNome}" <${process.env.SMTP_USER}>`,
    to: para,
    subject: assunto,
    text: corpoTexto,
    html: corpoHtml || undefined,
    attachments: anexos,
  };

  await transportador.sendMail(mailOptions);

  // Devolve pro chamador se a cópia em "Enviados" deu certo (e em qual
  // caixa) — o front usa isso pra confirmar no swal de sucesso, em vez de só
  // dizer "e-mail enviado" e deixar a dúvida se ficou registrado ou não.
  const caixaEnviados = process.env.IMAP_USER || process.env.SMTP_USER;
  let salvouEmEnviados = false;
  try {
    await salvarCopiaEnviados(mailOptions);
    salvouEmEnviados = true;
  } catch (err) {
    console.error('Aviso: e-mail entregue, mas não consegui salvar a cópia em "Enviados":', err.message);
    try {
      await enviarCopiaFalhaEnviados(transportador, mailOptions, err.message);
    } catch (errCopia) {
      console.error('Também não consegui mandar a cópia de aviso por falha ao salvar em "Enviados":', errCopia.message);
    }
  }

  return { salvouEmEnviados, caixaEnviados };
}

module.exports = { enviarEmailComAnexo };
