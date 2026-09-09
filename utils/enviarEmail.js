// utils/enviarEmail.js
//
// Envio de e-mail via SMTP genérico (nodemailer) — sempre pela conta de
// e-mail corporativo (tiemailcorporativo) da pessoa logada que disparou o
// envio, nunca por uma conta única do .env: assim fica registrado no
// provedor quem de fato mandou aquele e-mail pro cliente, em vez de tudo
// sair como "financeiro@...". SMTP_HOST/SMTP_PORT/SMTP_SECURE no .env só
// definem o servidor de saída (mesmo provedor pra todas as contas
// @japromocoes.com.br); usuário/senha vêm do remetente informado pelo
// chamador (ver rotaFaturamento.js, que resolve isso a partir do usuário
// ativo antes de chamar enviarEmailComAnexo).
"use strict";

const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");
const MailComposer = require("nodemailer/lib/mail-composer");
const { ImapFlow } = require("imapflow");

// Não cacheado — é montado na hora com a senha decifrada do
// tiemailcorporativo do remetente ativo, que muda a cada chamada.
function criarTransportadorPara(email, senha) {
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE } = process.env;
  if (!SMTP_HOST || !email || !senha) {
    throw new Error("SMTP não configurado — preencha SMTP_HOST/SMTP_PORT no .env e verifique o e-mail corporativo do remetente.");
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    // Porta 465 é SSL direto (secure=true); 587/25 usam STARTTLS
    // (secure=false, o nodemailer negocia o TLS depois de conectar) — esse é
    // o padrão da maioria dos provedores, incluindo Microsoft 365.
    secure: SMTP_SECURE === 'true' || Number(SMTP_PORT) === 465,
    auth: { user: email, pass: senha },
  });
}

// SMTP puro (o que o transportador acima faz) só entrega o e-mail — quem
// salva a cópia na pasta "Enviados" normalmente é o próprio cliente de
// e-mail (Outlook, webmail), via uma chamada IMAP separada depois do envio.
// Como aqui o envio é direto por código, sem passar por nenhum cliente,
// replicamos essa segunda etapa na mão: reconstrói a mensagem crua (mesmo
// conteúdo/anexo que foi enviado) e grava com IMAP APPEND na pasta certa.
//
// Login IMAP usa o mesmo e-mail/senha do remetente (é a mesma caixa que
// mandou por SMTP) — só precisa de IMAP_HOST separado se o provedor usar um
// host diferente do SMTP pra IMAP. Se IMAP não estiver configurável
// (faltando host), simplesmente não tenta — o e-mail já foi entregue via
// SMTP de qualquer forma, isso aqui é só o registro.
async function salvarCopiaEnviados(mailOptions, remetente) {
  const host = process.env.IMAP_HOST || process.env.SMTP_HOST;
  const { email: user, senha: pass } = remetente;
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
    'Itens Enviados', 'INBOX.Itens Enviados',
  ];
  const porNome = pastas.find((p) => candidatos.some((c) => c.toLowerCase() === p.path.toLowerCase()));
  if (porNome) return porNome.path;

  throw new Error(
    `Não achei a pasta de "Enviados" (pastas disponíveis: ${pastas.map((p) => p.path).join(', ')}). ` +
    `Configure IMAP_PASTA_ENVIADOS no .env com o nome exato.`
  );
}

// Quando a cópia em "Enviados" falha, manda o mesmo e-mail (mesmo anexo) de
// novo, só que como cópia pro próprio remetente — pra não perder o registro
// de que aquilo foi enviado, já que não deu pra guardar na pasta certa. Se
// ATÉ essa cópia falhar (SMTP fora do ar etc.), só loga: o e-mail original
// pro cliente já foi entregue de qualquer forma, isso aqui é só um extra.
async function enviarCopiaFalhaEnviados(transportador, mailOptionsOriginal, motivoFalha, remetente) {
  const copiaPara = process.env.EMAIL_COPIA_FALHA_ENVIADOS || remetente.email;
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
// `remetente` é obrigatório: { email, senha, nome } — a conta de e-mail
// corporativo (tiemailcorporativo) da pessoa que disparou o envio. Quem
// resolve isso a partir do usuário ativo é o chamador (rotaFaturamento.js);
// aqui não existe fallback pra uma conta genérica do .env.
async function enviarEmailComAnexo({ para, assunto, corpoTexto, corpoHtml, anexo, remetente }) {
  if (!remetente?.email || !remetente?.senha) {
    throw new Error("Remetente não informado — é preciso o e-mail corporativo (tiemailcorporativo) de quem está enviando.");
  }
  const transportador = criarTransportadorPara(remetente.email, remetente.senha);

  const anexos = [];
  if (anexo?.caminhoRelativo) {
    const caminhoAbsoluto = path.join(__dirname, "..", anexo.caminhoRelativo);
    if (!fs.existsSync(caminhoAbsoluto)) {
      throw new Error(`Arquivo do anexo não encontrado: ${anexo.caminhoRelativo}`);
    }
    anexos.push({ filename: anexo.nome || path.basename(caminhoAbsoluto), path: caminhoAbsoluto });
  }

  const mailOptions = {
    from: remetente.nome ? `"${remetente.nome}" <${remetente.email}>` : remetente.email,
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
  const caixaEnviados = remetente.email;
  let salvouEmEnviados = false;
  try {
    await salvarCopiaEnviados(mailOptions, remetente);
    salvouEmEnviados = true;
  } catch (err) {
    console.error('Aviso: e-mail entregue, mas não consegui salvar a cópia em "Enviados":', err.message);
    try {
      await enviarCopiaFalhaEnviados(transportador, mailOptions, err.message, remetente);
    } catch (errCopia) {
      console.error('Também não consegui mandar a cópia de aviso por falha ao salvar em "Enviados":', errCopia.message);
    }
  }

  return { salvouEmEnviados, caixaEnviados };
}

module.exports = { enviarEmailComAnexo };
