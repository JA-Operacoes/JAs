// utils/gerarXmlCancelamentoNFe.js
//
// Monta e assina o XML de PEDIDO DE CANCELAMENTO de uma NFS-e já emitida
// (docs/nfse/schemas/PedidoCancelamentoNFe_v02.xsd). Confirmado no WSDL real
// (2026-08-26, docs/nfse/lotenfe.wsdl): o método se chama "CancelamentoNFe",
// SOAPAction "http://www.prefeitura.sp.gov.br/nfe/ws/cancelamentoNFe" —
// mesmo padrão VersaoSchema/MensagemXML do envio de lote.
//
// IMPORTANTE: não existe um "TesteCancelamentoNFe" — conferido a lista
// completa de operações do WSDL, só existe a operação real. Todo
// cancelamento chamado por aqui é definitivo, sem como simular antes.
"use strict";

const { escaparXml } = require("./gerarXmlRpsLote");
const { assinarCadeiaRPS, assinarEnvelopeXml } = require("./assinarXmlRpsLote");

function apenasDigitos(valor) {
  return String(valor || "").replace(/\D/g, "");
}

function elemento(nome, valor, obrigatorio = false) {
  if (valor === null || valor === undefined || valor === "") {
    if (obrigatorio) throw new Error(`Campo obrigatório "${nome}" está vazio.`);
    return "";
  }
  return `<${nome}>${escaparXml(valor)}</${nome}>`;
}

function elementoCpfCnpj(nomeElemento, documento) {
  const digitos = apenasDigitos(documento);
  if (!digitos) throw new Error(`Campo obrigatório "${nomeElemento}" está vazio.`);
  const tag = digitos.length > 11 ? "CNPJ" : "CPF";
  return `<${nomeElemento}><${tag}>${digitos}</${tag}></${nomeElemento}>`;
}

// Cadeia de 20 posições — confirmado no XSD (tpAssinaturaCancelamento,
// TiposNFe_v02.xsd): CCM do prestador com 8 dígitos (zero à esquerda) +
// Número da NFS-e com 12 dígitos (zero à esquerda). ATENÇÃO: o CCM aqui é de
// 8 dígitos — DIFERENTE dos 12 dígitos exigidos na assinatura do RPS
// (montarCadeiaAssinaturaRPS, gerarXmlRpsLote.js) — não é o mesmo número
// formatado, são exigências distintas confirmadas em partes diferentes do
// schema. Assinado com o mesmo certificado/algoritmo (RSA, base64) do RPS.
function montarCadeiaAssinaturaCancelamento({ inscricaoMunicipalPrestador, numeroNFe }) {
  const ccm = apenasDigitos(inscricaoMunicipalPrestador).padStart(8, "0").slice(-8);
  const numero = String(numeroNFe).padStart(12, "0").slice(-12);
  const cadeia = `${ccm}${numero}`;
  if (cadeia.length !== 20) {
    throw new Error(`Cadeia de assinatura de cancelamento com tamanho errado: ${cadeia.length} (esperado 20).`);
  }
  return cadeia;
}

// `notas`: array de { inscricaoMunicipalPrestador, numeroNFe, codigoVerificacao,
// chaveNotaNacional } — uma por NFS-e a cancelar (o schema aceita até 50 por
// pedido, mas a tela só deve mandar 1 de cada vez por enquanto).
// `certificado` é o {chavePrivadaPem, certificadoPem} de carregarCertificado —
// devolve o envelope já com o <ds:Signature> do documento inteiro, pronto
// pra mandar pro Web Service (mesmo formato de gerarXmlPedidoEnvioLoteRPS).
function montarXmlCancelamentoNFe({ cnpjPrestador, notas, certificado, versaoSchema = 2, transacao = true }) {
  if (!notas?.length) throw new Error("Nenhuma nota informada para cancelamento.");
  if (!certificado?.chavePrivadaPem || !certificado?.certificadoPem) {
    throw new Error("Certificado digital da empresa emissora não informado — sem ele não é possível assinar o cancelamento.");
  }

  const detalhes = notas.map((nota) => {
    const assinaturaCadeia = montarCadeiaAssinaturaCancelamento(nota);
    const assinaturaBase64 = assinarCadeiaRPS(assinaturaCadeia, certificado.chavePrivadaPem);
    return `
      <Detalhe>
        <ChaveNFe>
          ${elemento("InscricaoPrestador", apenasDigitos(nota.inscricaoMunicipalPrestador), true)}
          ${elemento("NumeroNFe", nota.numeroNFe, true)}
          ${elemento("CodigoVerificacao", nota.codigoVerificacao)}
          ${elemento("ChaveNotaNacional", nota.chaveNotaNacional)}
        </ChaveNFe>
        ${elemento("AssinaturaCancelamento", assinaturaBase64, true)}
      </Detalhe>`;
  }).join("");

  // Mesma convenção observada em montarXmlRps (gerarXmlRpsLote.js): o schema
  // não tem elementFormDefault="qualified", então só a raiz fica no
  // namespace (via prefixo "ns:"), nunca um xmlns default — um xmlns default
  // qualificaria também os filhos e quebraria a validação contra o XSD real.
  const envelopeSemAssinatura = `<?xml version="1.0" encoding="utf-8"?>
<ns:PedidoCancelamentoNFe xmlns:ns="http://www.prefeitura.sp.gov.br/nfe"
                           xmlns:tipos="http://www.prefeitura.sp.gov.br/nfe/tipos"
                           xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
  <Cabecalho Versao="${versaoSchema}">
    ${elementoCpfCnpj("CPFCNPJRemetente", cnpjPrestador)}
    ${elemento("transacao", transacao ? "true" : "false", true)}
  </Cabecalho>${detalhes}
</ns:PedidoCancelamentoNFe>`;

  return assinarEnvelopeXml(envelopeSemAssinatura, certificado.chavePrivadaPem, certificado.certificadoPem);
}

module.exports = { montarXmlCancelamentoNFe, montarCadeiaAssinaturaCancelamento };
