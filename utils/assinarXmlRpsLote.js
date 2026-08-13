// utils/assinarXmlRpsLote.js
//
// As duas assinaturas que faltavam em utils/gerarXmlRpsLote.js: a cadeia de
// 85 caracteres de cada RPS (campo <Assinatura>, RSA-SHA1 "cru", sem XMLDSig)
// e o <ds:Signature> do envelope inteiro (XMLDSig, enveloped, C14N).
//
// IMPORTANTE sobre o <ds:Signature>: a referência tem que usar URI="" (o
// documento inteiro), SEM adicionar atributo Id no elemento raiz — testei
// isso empiricamente porque o comportamento padrão da xml-crypto (referenciar
// via xpath) adiciona um Id="_0" no <PedidoEnvioLoteRPS>, e esse elemento
// não tem NENHUM atributo declarado no XSD (só <Cabecalho> tem o atributo
// Versao) — um Id ali quebraria a validação contra o schema real.
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const forge = require("node-forge");
const { SignedXml } = require("xml-crypto");

// Lê o .pfx do disco (caminho relativo à raiz do projeto, ex.: "certs/EA.pfx"
// — é assim que fica salvo em NFE_CERTIFICADO_<SIGLA>_PATH) e devolve a
// chave privada + certificado já em PEM, prontos pra assinar.
function carregarCertificado(caminhoRelativo, senha) {
  const caminhoAbsoluto = path.join(__dirname, "..", caminhoRelativo);
  const bufferPfx = fs.readFileSync(caminhoAbsoluto);
  const asn1 = forge.asn1.fromDer(bufferPfx.toString("binary"));

  let p12;
  try {
    p12 = forge.pkcs12.pkcs12FromAsn1(asn1, senha);
  } catch (err) {
    throw new Error(`Não consegui abrir o certificado (senha incorreta ou arquivo inválido): ${err.message}`);
  }

  const bagsChave = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const bagChave = (bagsChave[forge.pki.oids.pkcs8ShroudedKeyBag] || [])[0];
  if (!bagChave) throw new Error("Não encontrei a chave privada dentro do certificado.");

  const bagsCert = p12.getBags({ bagType: forge.pki.oids.certBag });
  const bagCert = (bagsCert[forge.pki.oids.certBag] || [])[0];
  if (!bagCert) throw new Error("Não encontrei o certificado (parte pública) dentro do arquivo.");

  return {
    chavePrivadaPem: forge.pki.privateKeyToPem(bagChave.key),
    certificadoPem: forge.pki.certificateToPem(bagCert.cert),
  };
}

// Assina a cadeia de 85 caracteres do RPS (tpAssinatura do XSD) — RSA-SHA1
// "cru" sobre o texto, sem envelope XMLDSig nenhum, diferente do
// <ds:Signature> do documento inteiro (ver assinarEnvelopeXml). Devolve já
// em Base64, pronto pro campo <Assinatura>.
function assinarCadeiaRPS(cadeia, chavePrivadaPem) {
  const assinador = crypto.createSign("RSA-SHA1");
  assinador.update(cadeia, "ascii");
  assinador.end();
  return assinador.sign(chavePrivadaPem, "base64");
}

// Assina o envelope XML inteiro (enveloped signature, RSA-SHA1, C14N) e
// devolve o XML com o <ds:Signature> já inserido como último filho da raiz
// (mesma posição que o placeholder comentado ocupava, e a última posição
// exigida pela sequence do XSD: Cabecalho, RPS[1..50], ds:Signature).
function assinarEnvelopeXml(xml, chavePrivadaPem, certificadoPem) {
  const sig = new SignedXml({ privateKey: chavePrivadaPem, publicCert: certificadoPem });
  sig.getKeyInfoContent = SignedXml.getKeyInfoContent;
  sig.addReference({
    xpath: "/*",
    uri: "",
    isEmptyUri: true,
    transforms: [
      "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
      "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
    ],
    digestAlgorithm: "http://www.w3.org/2000/09/xmldsig#sha1",
  });
  sig.signatureAlgorithm = "http://www.w3.org/2000/09/xmldsig#rsa-sha1";
  sig.canonicalizationAlgorithm = "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";
  sig.computeSignature(xml, { prefix: "ds" });
  return sig.getSignedXml();
}

module.exports = { carregarCertificado, assinarCadeiaRPS, assinarEnvelopeXml };
