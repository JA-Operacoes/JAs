// utils/gerarXmlRpsLote.js
//
// Monta o XML do "Pedido de Envio de Lote de RPS" — mesma interface que o
// financeiro usava manualmente (fazia login em nfe.prefeitura.sp.gov.br,
// escolhia o certificado, e subia o arquivo em "Envio de RPS em Lote";
// antes disso o sistema SAS gerava esse arquivo pra ela).
//
// Layout: versão 2 (Reforma Tributária 2026), XSD baixado oficialmente de
// https://notadomilhao.sf.prefeitura.sp.gov.br/schemas-reformatributaria-v02-5
// (atualizado 14/05/2026) — arquivos PedidoEnvioLoteRPS_v02.xsd e
// TiposNFe_v02.xsd. Ver "Manual de Utilização — Web Service" v3.3.7 (SP)
// pra tudo que não está literalmente no XSD (o formato da cadeia de 86
// caracteres da assinatura por RPS, por exemplo, só existe documentado em
// prosa dentro do próprio XSD, não como enumeração/pattern).
//
// IMPORTANTE — ainda NÃO assina digitalmente. Este módulo só monta a
// estrutura do XML; os dois pontos que precisam do certificado A1 (a
// assinatura de 85 caracteres de cada RPS, campo <Assinatura> — ver nota
// sobre a divergência de tamanho dentro de montarCadeiaAssinaturaRPS —, e
// o <ds:Signature> XMLDSig do envelope inteiro) ficam marcados como
// pendentes. Sem os dois, o arquivo NÃO é válido pra importar no portal.
//
// JÁ VALIDADO (2026-08-07) contra o PedidoEnvioLoteRPS_v02.xsd real, usando
// libxml2-wasm (ver scratchpad da sessão) — todo o conteúdo de <RPS> (todos
// os campos obrigatórios, incluindo o bloco <IBSCBS> inteiro) passa na
// validação de estrutura/ordem/tipo. Testado com um <ds:Signature> fake só
// pra confirmar que o <RPS> em si está 100% completo — o único erro que
// sobra depois disso é dentro do próprio <ds:Signature> (precisa de
// <KeyInfo>), que só é possível montar de verdade com o certificado.

const MUNICIPIO_SAO_PAULO_IBGE = "3550308";

// PIS 0,65% + COFINS 3% + CSLL 1% = 4,65% (Lei 10.833/2003 art. 30) — lei
// federal fixa, não faz parte da Reforma Tributária. O sistema guarda hoje
// só o total retido (notasfiscais.valorpiscofinscsll); o RPS pede os três
// valores em campos separados, então dividimos proporcionalmente aqui.
const ALIQ_PIS = 0.0065;
const ALIQ_COFINS = 0.03;
const ALIQ_CSLL = 0.01;
const ALIQ_PIS_COFINS_CSLL = ALIQ_PIS + ALIQ_COFINS + ALIQ_CSLL;

function arredondar2(numero) {
  return Math.round((Number(numero) || 0) * 100) / 100;
}

function separarPisCofinsCsll(valorTotalRetido) {
  const total = Number(valorTotalRetido) || 0;
  if (!total) return { pis: 0, cofins: 0, csll: 0 };
  return {
    pis: arredondar2(total * (ALIQ_PIS / ALIQ_PIS_COFINS_CSLL)),
    cofins: arredondar2(total * (ALIQ_COFINS / ALIQ_PIS_COFINS_CSLL)),
    csll: arredondar2(total * (ALIQ_CSLL / ALIQ_PIS_COFINS_CSLL)),
  };
}

function apenasDigitos(valor) {
  return String(valor || "").replace(/\D/g, "");
}

function formatarDataISO(data) {
  return new Date(data).toISOString().slice(0, 10); // AAAA-MM-DD
}

// tpValor do XSD: decimal com PONTO, sem separador de milhar (ex.: "11575.66",
// ou "0" pra zero) — diferente da cadeia de assinatura (ver mais abaixo),
// que usa um formato de inteiro em centavos totalmente à parte.
function formatarValorXml(valor) {
  const n = arredondar2(valor);
  return n === 0 ? "0" : n.toFixed(2);
}

// Escapa caracteres que quebram o parser XML — tabela oficial do manual
// (item 3.4.5, "Tratamento de caracteres especiais no texto de XML").
function escaparXml(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/'/g, "&apos;")
    .replace(/"/g, "&quot;");
}

function elemento(nome, valor, obrigatorio = false) {
  if (valor === null || valor === undefined || valor === "") {
    if (obrigatorio) throw new Error(`Campo obrigatório "${nome}" está vazio.`);
    return ""; // campo opcional sem conteúdo: tag suprimida (padrão do manual, item 3.2.5)
  }
  return `<${nome}>${escaparXml(valor)}</${nome}>`;
}

// tpCPFCNPJ e tpCPFCNPJNIF não são elementos simples — são um <xs:choice>
// entre <CPF>/<CNPJ>(/<NIF>/<NaoNIF>), ANINHADO dentro do elemento nomeado
// (ex.: <CPFCNPJRemetente><CNPJ>...</CNPJ></CPFCNPJRemetente>), não um
// elemento substituído pelo filho.
function elementoCpfCnpj(nomeElemento, documento, obrigatorio = false) {
  const digitos = apenasDigitos(documento);
  if (!digitos) {
    if (obrigatorio) throw new Error(`Campo obrigatório "${nomeElemento}" está vazio.`);
    return "";
  }
  const filho = digitos.length === 11 ? elemento("CPF", digitos) : elemento("CNPJ", digitos);
  return `<${nomeElemento}>${filho}</${nomeElemento}>`;
}

// Monta a cadeia de posições que precisa ser assinada (RSA, com a chave
// privada do certificado) pra virar o conteúdo do campo <Assinatura> de
// cada RPS (tpAssinatura no XSD — é uma assinatura à parte, mais antiga,
// diferente do <ds:Signature> XMLDSig que cobre o envelope inteiro).
// Formato documentado em prosa no XSD, seção tpAssinatura:
//   CCM prestador (8) + Série RPS (5, espaços à direita) +
//   Número RPS (12, zeros à esquerda) + Data emissão AAAAMMDD (8) +
//   Tipo tributação (1: T/F/I/J) + Status RPS (1: N/C/E) +
//   ISS Retido (1: S/N) + Valor Serviços (15, centavos, zeros à esquerda) +
//   Valor Deduções (15, centavos, zeros à esquerda) +
//   Código Serviço (5, zeros à esquerda) + CPF/CNPJ tomador (14, zeros à esquerda)
// Soma dos tamanhos individuais documentados: 8+5+12+8+1+1+1+15+15+5+14 = 85.
//
// ATENÇÃO — inconsistência encontrada no próprio manual da Prefeitura: o
// texto introdutório desta seção do XSD diz "a cadeia... deverá conter 86
// posições", mas a soma dos tamanhos de cada campo, documentados logo
// abaixo NO MESMO bloco, dá 85, não 86. Segui os tamanhos individuais (mais
// específicos e verificáveis um a um) em vez do número "86" solto no texto
// — mas isso é uma suposição, não uma certeza. PRECISA validar contra um
// exemplo real ou o ambiente de teste da prefeitura antes de assinar/enviar
// qualquer coisa de verdade — se a cadeia assinada tiver o tamanho errado,
// a assinatura não bate e o RPS é rejeitado.
function montarCadeiaAssinaturaRPS({
  inscricaoMunicipalPrestador,
  serieRps,
  numeroRps,
  dataEmissao,
  tipoTributacao,
  statusRps,
  issRetido,
  valorServicos,
  valorDeducoes,
  codigoServico,
  cpfCnpjTomador,
}) {
  const ccm = apenasDigitos(inscricaoMunicipalPrestador).padStart(8, "0").slice(-8);
  const serie = String(serieRps || "1").padEnd(5, " ").slice(0, 5);
  const numero = String(numeroRps).padStart(12, "0").slice(-12);
  const data = formatarDataISO(dataEmissao).replace(/-/g, "");
  const issRet = issRetido ? "S" : "N";
  const valorServ = String(Math.round((Number(valorServicos) || 0) * 100)).padStart(15, "0");
  const valorDed = String(Math.round((Number(valorDeducoes) || 0) * 100)).padStart(15, "0");
  const cServico = apenasDigitos(codigoServico).padStart(5, "0").slice(-5);
  const cpfCnpj = apenasDigitos(cpfCnpjTomador).padStart(14, "0").slice(-14);

  const cadeia =
    ccm + serie + numero + data + tipoTributacao + statusRps + issRet +
    valorServ + valorDed + cServico + cpfCnpj;

  // 85 = soma dos tamanhos documentados campo a campo (ver nota acima sobre
  // a divergência com o "86" citado no texto solto do manual).
  if (cadeia.length !== 85) {
    throw new Error(`Cadeia de assinatura do RPS ficou com ${cadeia.length} caracteres (esperado 85): "${cadeia}"`);
  }
  return cadeia;
}

// Monta o <RPS> de uma nota — recebe os dados já carregados do banco
// (notasfiscais + join de empresas/clientes/servicos/orcamentoparcelas).
// `numeroRps` é o número sequencial do RPS pra essa inscrição municipal —
// usamos o próprio idnotafiscal (único, crescente, nunca reaproveitado,
// que é exatamente o que o layout pede — não precisa de contador à parte).
function montarXmlRps(dados) {
  const {
    idnotafiscal,
    inscricaoMunicipalPrestador,
    dataEmissao,
    codigoServico,
    aliquotaIss,
    cnpjTomador,
    inscricaoMunicipalTomador,
    emailTomador,
    discriminacaoServico,
    valorServico,
    valorPisCofinsCsllRetido, // total retido — separamos em 3 abaixo
    municipioPrestacaoIbge,
    nbs, // servicos.nbs — obrigatório no layout v2 (não existia no v1)
    cIndOp, // servicos.cindop — código indicador da operação (IBSCBS)
    classificacaoTributaria, // servicos.classificacaotributaria — cClassTrib (IBSCBS)
  } = dados;

  const numeroRps = idnotafiscal;
  const serieRps = "1";
  const tipoTributacao = "T"; // Tributação no município de São Paulo (ver nota real analisada)
  const statusRps = "N"; // Normal
  const issRetido = false; // nunca vimos retenção de ISS nas notas reais até agora — reavaliar se algum tomador exigir
  const { pis, cofins, csll } = separarPisCofinsCsll(valorPisCofinsCsllRetido);

  const assinatura = montarCadeiaAssinaturaRPS({
    inscricaoMunicipalPrestador,
    serieRps,
    numeroRps,
    dataEmissao,
    tipoTributacao,
    statusRps,
    issRetido,
    valorServicos: valorServico,
    valorDeducoes: 0,
    codigoServico,
    cpfCnpjTomador: cnpjTomador,
  });

  // PENDENTE DE VERDADE: isto NÃO é uma assinatura — é só a cadeia crua
  // (ver montarCadeiaAssinaturaRPS) convertida pra Base64 só pra o campo
  // ter um valor sintaticamente válido (tpAssinatura = base64Binary) e dar
  // pra testar/validar a estrutura do XML. Precisa assinar de verdade
  // (RSA-SHA1 com a chave privada do certificado A1) antes de usar isso
  // pra valer — ver utils/assinarXmlRpsLote.js (a implementar).
  const assinaturaBase64 = Buffer.from(assinatura, "ascii").toString("base64");

  return `
    <RPS>
      <Assinatura>${assinaturaBase64}</Assinatura>
      <ChaveRPS>
        ${elemento("InscricaoPrestador", apenasDigitos(inscricaoMunicipalPrestador), true)}
        ${elemento("SerieRPS", serieRps)}
        ${elemento("NumeroRPS", numeroRps, true)}
      </ChaveRPS>
      ${elemento("TipoRPS", "RPS", true)}
      ${elemento("DataEmissao", formatarDataISO(dataEmissao), true)}
      ${elemento("StatusRPS", statusRps, true)}
      ${elemento("TributacaoRPS", tipoTributacao, true)}
      ${elemento("ValorDeducoes", formatarValorXml(0), true)}
      ${elemento("ValorPIS", formatarValorXml(pis), true)}
      ${elemento("ValorCOFINS", formatarValorXml(cofins), true)}
      ${elemento("ValorINSS", formatarValorXml(0), true)}
      ${elemento("ValorIR", formatarValorXml(0), true)}
      ${elemento("ValorCSLL", formatarValorXml(csll), true)}
      ${elemento("CodigoServico", apenasDigitos(codigoServico), true)}
      ${elemento("AliquotaServicos", (Number(aliquotaIss) || 0).toFixed(4), true)}
      ${elemento("ISSRetido", issRetido ? "true" : "false", true)}
      <!-- CPFCNPJTomador ou InscricaoMunicipalTomador: com o CNPJ do
           tomador já preenchido, o próprio sistema da prefeitura ignora
           Endereco/RazaoSocial/InscEstadual do tomador (busca do cadastro
           dele) — por isso não mandamos esses campos aqui, mais simples. -->
      ${elementoCpfCnpj("CPFCNPJTomador", cnpjTomador)}
      ${elemento("InscricaoMunicipalTomador", apenasDigitos(inscricaoMunicipalTomador))}
      ${elemento("EmailTomador", emailTomador)}
      ${elemento("Discriminacao", discriminacaoServico, true)}
      ${elemento("MunicipioPrestacao", municipioPrestacaoIbge || MUNICIPIO_SAO_PAULO_IBGE, true)}
      ${elemento("ValorInicialCobrado", formatarValorXml(valorServico), true)}
      ${elemento("ValorMulta", formatarValorXml(0))}
      ${elemento("ValorJuros", formatarValorXml(0))}
      ${elemento("ValorIPI", formatarValorXml(0), true)}
      ${elemento("ExigibilidadeSuspensa", "0", true)}
      ${elemento("NBS", apenasDigitos(nbs), true)}
      <!-- gpPrestacao: escolha entre local no Brasil (cLocPrestacao, código
           IBGE) ou no exterior (cPaisPrestacao) — sempre Brasil por enquanto. -->
      ${elemento("cLocPrestacao", municipioPrestacaoIbge || MUNICIPIO_SAO_PAULO_IBGE, true)}
      <IBSCBS>
        ${elemento("finNFSe", "0", true)}
        ${elemento("indFinal", "0", true)}
        ${elemento("cIndOp", apenasDigitos(cIndOp), true)}
        ${elemento("indDest", "0", true)}
        <valores>
          <trib>
            <gIBSCBS>
              ${elemento("cClassTrib", classificacaoTributaria, true)}
            </gIBSCBS>
          </trib>
        </valores>
      </IBSCBS>
    </RPS>`;
}

// Monta o envelope <PedidoEnvioLoteRPS> completo — recebe um array de notas
// (cada item no mesmo formato aceito por montarXmlRps) e os dados da
// empresa emissora (prestador). Máximo 50 RPS por lote (limite do XSD).
function gerarXmlPedidoEnvioLoteRPS({ empresaEmissora, notas }) {
  if (!Array.isArray(notas) || !notas.length) {
    throw new Error("Nenhuma nota informada pra gerar o lote.");
  }
  if (notas.length > 50) {
    throw new Error(`Lote com ${notas.length} notas — o máximo permitido pelo layout é 50.`);
  }

  const cnpjRemetente = apenasDigitos(empresaEmissora.cnpj);
  const hoje = new Date();
  const dtInicio = formatarDataISO(notas.reduce((min, n) => n.dataEmissao < min ? n.dataEmissao : min, notas[0].dataEmissao));
  const dtFim = formatarDataISO(notas.reduce((max, n) => n.dataEmissao > max ? n.dataEmissao : max, notas[0].dataEmissao));

  const rpsXml = notas
    .map((nota) =>
      montarXmlRps({
        ...nota,
        inscricaoMunicipalPrestador: empresaEmissora.inscricaomunicipal,
      })
    )
    .join("\n");

  // O schema NÃO tem elementFormDefault="qualified" — ou seja, só o
  // elemento raiz (declaração global) fica no namespace do target;
  // Cabecalho/RPS/todos os campos internos (declarações locais) precisam
  // ficar SEM namespace. Por isso o namespace vai só no prefixo "ns:" do
  // elemento raiz, em vez de um xmlns default (que herdaria pra tudo e
  // invalidava o documento — foi exatamente esse o primeiro erro de
  // validação contra o XSD real). <ds:Signature> é o oposto: é uma
  // referência a elemento GLOBAL de outro schema (xmldsig, que É
  // qualified), por isso continua com prefixo "ds:" mesmo por dentro.
  return `<?xml version="1.0" encoding="utf-8"?>
<ns:PedidoEnvioLoteRPS xmlns:ns="http://www.prefeitura.sp.gov.br/nfe"
                        xmlns:tipos="http://www.prefeitura.sp.gov.br/nfe/tipos"
                        xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
  <Cabecalho Versao="2">
    ${elementoCpfCnpj("CPFCNPJRemetente", cnpjRemetente, true)}
    ${elemento("transacao", "true")}
    ${elemento("dtInicio", dtInicio, true)}
    ${elemento("dtFim", dtFim, true)}
    ${elemento("QtdRPS", notas.length, true)}
  </Cabecalho>${rpsXml}
  <!-- PENDENTE: <ds:Signature> — assinatura XMLDSig (Enveloped, RSA-SHA1,
       C14N) do envelope inteiro, com o certificado A1. Sem isso o portal
       rejeita o arquivo — ver utils/assinarXmlRpsLote.js (a implementar
       quando o certificado estiver disponível no servidor). -->
</ns:PedidoEnvioLoteRPS>`;
}

module.exports = {
  gerarXmlPedidoEnvioLoteRPS,
  montarXmlRps,
  montarCadeiaAssinaturaRPS,
  separarPisCofinsCsll,
  formatarValorXml,
  escaparXml,
  MUNICIPIO_SAO_PAULO_IBGE,
};
