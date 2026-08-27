// utils/enviarLoteWebService.js
//
// Chamada SOAP de verdade pro Web Service síncrono da prefeitura de SP
// (https://nfews.prefeitura.sp.gov.br/lotenfe.asmx), método EnvioLoteRPS (ou
// TesteEnvioLoteRPS pra validar sem substituir o RPS por NF-e de verdade —
// mesmo formato de pedido/retorno, sem efeito colateral no lado da
// prefeitura). Ver Manual_WebService_SP_v3.3.7.pdf, seções 4.3.1 e 4.3.3.
//
// Autenticação é TLS mútuo (certificado digital do próprio contribuinte),
// não usuário/senha nem token — por isso o https.Agent carrega cert/key.
//
// Não faz nenhum retry automático: uma falha de rede/timeout pode significar
// que a prefeitura já processou o lote mas a resposta não chegou de volta —
// tentar de novo sozinho arriscaria duplicar o envio. Quem chama decide o que
// fazer com o resultado "incerto".
"use strict";

const https = require("https");
const { DOMParser } = require("@xmldom/xmldom");

const HOST = "nfews.prefeitura.sp.gov.br";
const CAMINHO = "/lotenfe.asmx";
const NAMESPACE = "http://www.prefeitura.sp.gov.br/nfe";

// SOAPAction de cada método — confirmado direto no WSDL real (baixado com o
// certificado em 2026-08-20 e salvo em docs/nfse/lotenfe.wsdl como
// referência). NÃO segue um padrão previsível a partir do nome do método
// (ex.: "TesteEnvioLoteRPS" usa a action "testeenvio", bem diferente do nome
// da operação) — por isso é uma tabela fixa, não algo montado por convenção.
const SOAP_ACTIONS = {
  EnvioLoteRPS: `${NAMESPACE}/ws/envioLoteRPS`,
  TesteEnvioLoteRPS: `${NAMESPACE}/ws/testeenvio`,
  // Confirmado no WSDL real (re-baixado em 2026-08-26): não existe um
  // "TesteCancelamentoNFe" — essa é a única operação de cancelamento, sempre
  // definitiva, sem modo de simulação.
  CancelamentoNFe: `${NAMESPACE}/ws/cancelamentoNFe`,
};

// Monta o envelope SOAP 1.1. O elemento do pedido tem que se chamar
// "<Metodo>Request" (confirmado no WSDL — é o "document/literal wrapped"
// padrão do ASP.NET, não "<Metodo>" like a prosa do manual dava a entender),
// com VersaoSchema/MensagemXML como filhos diretos.
function montarEnvelopeSoap(metodo, xmlAssinado, versaoSchema) {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <${metodo}Request xmlns="${NAMESPACE}">
      <VersaoSchema>${versaoSchema}</VersaoSchema>
      <MensagemXML><![CDATA[${xmlAssinado}]]></MensagemXML>
    </${metodo}Request>
  </soap:Body>
</soap:Envelope>`;
}

function textoDireto(el) {
  return el ? (el.textContent || "").trim() : null;
}

function primeiroFilho(pai, nomeLocal) {
  if (!pai) return null;
  return pai.getElementsByTagNameNS("*", nomeLocal)[0] || null;
}

// Erro/Alerta (tpEvento): Codigo, Descricao, e opcionalmente qual RPS causou
// (pelo NumeroRPS — que no nosso gerador é sempre o idnotafiscal, ver
// utils/gerarXmlRpsLote.js). Pode não ter ChaveRPS quando o erro é do
// cabeçalho do lote inteiro, não de um RPS específico.
function mapEvento(el) {
  const chaveRps = primeiroFilho(el, "ChaveRPS");
  return {
    codigo: textoDireto(primeiroFilho(el, "Codigo")),
    descricao: textoDireto(primeiroFilho(el, "Descricao")),
    numeroRps: chaveRps ? Number(textoDireto(primeiroFilho(chaveRps, "NumeroRPS"))) : null,
  };
}

// ChaveNFeRPS: a nota gerada (ChaveNFe) + o RPS que ela substituiu (ChaveRPS).
function mapChaveNFeRPS(el) {
  const chaveNFe = primeiroFilho(el, "ChaveNFe");
  const chaveRps = primeiroFilho(el, "ChaveRPS");
  return {
    numeroRps: Number(textoDireto(primeiroFilho(chaveRps, "NumeroRPS"))),
    numeroNFe: textoDireto(primeiroFilho(chaveNFe, "NumeroNFe")),
    codigoVerificacao: textoDireto(primeiroFilho(chaveNFe, "CodigoVerificacao")),
    chaveNotaNacional: textoDireto(primeiroFilho(chaveNFe, "ChaveNotaNacional")),
  };
}

// Interpreta o corpo da resposta HTTP em um de três desfechos:
//   'falha_soap' — a prefeitura respondeu com um SOAP Fault (ex.: SOAPAction
//                  errado, XML malformado) — o pedido nem chegou a ser
//                  avaliado como lote de RPS.
//   'sucesso'/'rejeitado' — a prefeitura processou de verdade e devolveu um
//                  RetornoEnvioLoteRPS (Sucesso true ou false).
//   'incerto'    — resposta em formato inesperado (nem Fault, nem o Result
//                  esperado) — trata como se não soubéssemos o que houve.
function interpretarResposta({ corpo }) {
  let doc;
  try {
    doc = new DOMParser({ errorHandler: { warning() {}, error() {}, fatalError() {} } }).parseFromString(corpo, "text/xml");
  } catch (err) {
    return { tipo: "incerto", mensagem: `Resposta da prefeitura não é um XML válido: ${err.message}`, xmlRetorno: corpo };
  }

  const fault = doc.getElementsByTagNameNS("*", "Fault")[0];
  if (fault) {
    const mensagem = textoDireto(primeiroFilho(fault, "faultstring")) || "Erro SOAP sem descrição (SOAPAction ou XML do pedido podem estar incorretos).";
    return { tipo: "falha_soap", mensagem, xmlRetorno: corpo };
  }

  // Confirmado no WSDL real: toda resposta traz o XML de retorno dentro de um
  // campo chamado "RetornoXML" (mesmo nome pra qualquer método), não um
  // "<Metodo>Result" como a prosa do manual dava a entender.
  const resultado = doc.getElementsByTagNameNS("*", "RetornoXML")[0];
  const textoResultado = textoDireto(resultado);
  if (!textoResultado) {
    return { tipo: "incerto", mensagem: "Resposta da prefeitura não veio no formato esperado (sem SOAP Fault nem RetornoXML reconhecível).", xmlRetorno: corpo };
  }

  let docRetorno;
  try {
    docRetorno = new DOMParser({ errorHandler: { warning() {}, error() {}, fatalError() {} } }).parseFromString(textoResultado, "text/xml");
  } catch (err) {
    return { tipo: "incerto", mensagem: `Não consegui interpretar o RetornoEnvioLoteRPS: ${err.message}`, xmlRetorno: corpo };
  }

  const cabecalho = docRetorno.getElementsByTagNameNS("*", "Cabecalho")[0];
  const sucessoTexto = textoDireto(primeiroFilho(cabecalho, "Sucesso"));
  if (sucessoTexto !== "true" && sucessoTexto !== "false") {
    return { tipo: "incerto", mensagem: "RetornoEnvioLoteRPS sem o campo Sucesso esperado.", xmlRetorno: corpo };
  }

  const sucesso = sucessoTexto === "true";
  const erros = Array.from(docRetorno.getElementsByTagNameNS("*", "Erro")).map(mapEvento);
  const alertas = Array.from(docRetorno.getElementsByTagNameNS("*", "Alerta")).map(mapEvento);
  const notas = Array.from(docRetorno.getElementsByTagNameNS("*", "ChaveNFeRPS")).map(mapChaveNFeRPS);

  return {
    tipo: sucesso ? "sucesso" : "rejeitado",
    mensagem: sucesso ? "Lote aceito pela prefeitura." : (erros[0]?.descricao || "Lote rejeitado pela prefeitura."),
    erros,
    alertas,
    notas,
    xmlRetorno: corpo,
  };
}

// Envia o lote assinado pro Web Service. `metodo` é 'EnvioLoteRPS' (envio de
// verdade, substitui o RPS por NF-e) ou 'TesteEnvioLoteRPS' (mesma validação,
// sem substituir nada — seguro pra testar contra o ambiente real).
// `certificado` é o {chavePrivadaPem, certificadoPem} de carregarCertificado
// (utils/assinarXmlRpsLote.js) — o mesmo certificado usado pra assinar o XML
// serve pra autenticar a conexão TLS mútua.
function enviarLoteRPS({ xmlAssinado, certificado, metodo = "EnvioLoteRPS", versaoSchema = 2 }) {
  if (!SOAP_ACTIONS[metodo]) {
    throw new Error(`Método "${metodo}" não reconhecido — SOAPAction não cadastrada.`);
  }
  const envelope = montarEnvelopeSoap(metodo, xmlAssinado, versaoSchema);
  const corpoRequisicao = Buffer.from(envelope, "utf8");

  return new Promise((resolve) => {
    const agent = new https.Agent({
      cert: certificado.certificadoPem,
      key: certificado.chavePrivadaPem,
      minVersion: "TLSv1.2",
    });

    const req = https.request(
      {
        hostname: HOST,
        path: CAMINHO,
        method: "POST",
        agent,
        timeout: 60000,
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          "Content-Length": corpoRequisicao.length,
          SOAPAction: `"${SOAP_ACTIONS[metodo]}"`,
        },
      },
      (res) => {
        let corpoResposta = "";
        res.setEncoding("utf8");
        res.on("data", (pedaco) => { corpoResposta += pedaco; });
        res.on("end", () => {
          const resultado = interpretarResposta({ corpo: corpoResposta });
          resolve({ ...resultado, envelopeEnviado: envelope });
        });
      }
    );

    // Timeout e erro de conexão são tratados do mesmo jeito: não sabemos se a
    // prefeitura chegou a processar antes da conexão cair, então o desfecho
    // tem que ser "incerto", nunca sucesso nem rejeição.
    req.on("timeout", () => {
      req.destroy(new Error("Tempo limite excedido aguardando resposta da prefeitura."));
    });
    req.on("error", (err) => {
      resolve({
        tipo: "incerto",
        mensagem: `Conexão com a prefeitura falhou antes de uma resposta completa: ${err.message}`,
        envelopeEnviado: envelope,
        xmlRetorno: null,
      });
    });

    req.end(corpoRequisicao);
  });
}

module.exports = { enviarLoteRPS };
