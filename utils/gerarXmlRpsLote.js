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
// Assina digitalmente de verdade (2026-08-12) — ver utils/assinarXmlRpsLote.js:
// a cadeia de 85 caracteres de cada RPS (campo <Assinatura>, RSA-SHA1 cru) e
// o <ds:Signature> XMLDSig do envelope inteiro (enveloped, C14N, URI="" —
// ver nota dentro daquele arquivo sobre por que não pode usar Id no
// elemento raiz). gerarXmlPedidoEnvioLoteRPS exige um certificado (chave
// privada + certificado em PEM) pra gerar o XML agora.
//
// JÁ VALIDADO (2026-08-07, e de novo em 2026-08-12 já com assinatura real)
// contra o PedidoEnvioLoteRPS_v02.xsd real, usando libxml2-wasm — todo o
// conteúdo de <RPS> (todos os campos obrigatórios, incluindo o bloco
// <IBSCBS> inteiro) e o <ds:Signature> completo (com <KeyInfo> de verdade)
// passam na validação de estrutura/ordem/tipo.
//
// AINDA PENDENTE (não dá pra validar sem testar contra o portal/homologação
// de verdade): a divergência de tamanho "85 vs 86" citada no manual da
// prefeitura pra cadeia de tpAssinatura (ver nota dentro de
// montarCadeiaAssinaturaRPS), e se o RSA-SHA1/XMLDSig são aceitos sem
// rejeição — isso só se resolve testando o upload manual no portal.

const { assinarCadeiaRPS, assinarEnvelopeXml } = require("./assinarXmlRpsLote");

const MUNICIPIO_SAO_PAULO_IBGE = "3550308";

// PIS 0,65% + COFINS 3% + CSLL 1% = 4,65% (Lei 10.833/2003 art. 30) — lei
// federal fixa, não faz parte da Reforma Tributária. O sistema guarda hoje
// só o total retido (notasfiscais.valorpiscofinscsll), um único percentual
// combinado configurado em Parâmetros.
//
// Nova sistemática dos campos de tributos federais no RPS (manual
// "Web Service SP" v3.3.7, item 3.3.7 do changelog — vigente desde
// 14/05/2026): ValorCSLL passou a levar o TOTAL retido de PIS+COFINS+CSLL
// junto (documentado assim em 3 pontos do manual: "Valor da retenção do
// CSLL, PIS e COFINS em R$" / "...do PIS, COFINS e CSLL em R$") —
// ValorPIS/ValorCOFINS continuam campos obrigatórios no XSD mas vão
// zerados, confirmado contra uma nota real emitida (2026-09-02, nota
// 00001388) que mostrou exatamente essa divisão errada quando ainda
// mandávamos os três valores separados pelas alíquotas legais.
function arredondar2(numero) {
  return Math.round((Number(numero) || 0) * 100) / 100;
}

// RetencaoPisCofins (campo novo, opcional, adicionado na mesma mudança de
// 14/05/2026) — código que informa qual combinação de PIS/COFINS/CSLL foi
// retida. O XSD tem 9 códigos pra combinações parciais (só PIS, só COFINS,
// etc.), mas o sistema só retém os três juntos como um grupo único ou
// nenhum deles — nunca um isolado — então só "3" (todos retidos) e "0"
// (nenhum retido) fazem sentido aqui, sem precisar de tela nova pra isso.
function codigoRetencaoPisCofins(valorTotalRetido) {
  return (Number(valorTotalRetido) || 0) > 0 ? "3" : "0";
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

// Discriminacao rejeitada pela prefeitura com "Pattern constraint failed"
// (confirmado contra o ambiente real, 2026-09-02, código 1001 — 3 RPS do
// mesmo lote, cada um citando seu próprio texto rejeitado). O XSD baixado
// localmente (docs/nfse/schemas/TiposNFe_v02.xsd) não mostra o padrão exato
// pra tpDiscriminacao, então o lado deles deve ter endurecido a validação
// depois do nosso download. Os 3 textos rejeitados tinham em comum só dois
// caracteres fora do padrão: travessão "—" (inserido pelos botões "Inserir
// parcela"/"Inserir dados bancários") e "º" de "Nº" (preenchimento
// automático da descrição) — troca esses por equivalentes ASCII antes de
// mandar, sem depender de saber o regex exato deles. Também colapsa quebra
// de linha em espaço — o XSD declara whiteSpace=collapse, mas não custa
// garantir aqui também em vez de confiar cegamente que o validador deles
// aplica isso antes do Pattern.
function normalizarDiscriminacao(texto) {
  return String(texto ?? "")
    .replace(/[‒-―]/g, "-")  // travessão/en dash/em dash (U+2012–U+2015) -> hífen
    .replace(/[‘’]/g, "'")   // aspas simples tipográficas (U+2018/U+2019)
    .replace(/[“”]/g, '"')   // aspas duplas tipográficas (U+201C/U+201D)
    .replace(/º/g, "o")      // º (ordinal masculino, ex.: "Nº")
    .replace(/ª/g, "a")      // ª (ordinal feminino)
    .replace(/\s+/g, " ")    // quebras de linha/tabs -> espaço único
    .trim();
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
//
// CONFIRMADO CONTRA O AMBIENTE REAL DA PREFEITURA (2026-08-21, via
// TesteEnvioLoteRPS): nem 85 nem 86 — são 90 posições. A prosa do manual
// (que já divergia entre si, 85 x 86) estava incompleta em dois pontos, só
// visíveis testando de verdade (erro 1206 "Assinatura Digital do RPS
// incorreta" devolve a string que a prefeitura esperava, dava pra comparar
// campo a campo com a nossa):
//   CCM prestador (12, não 8 como o manual documentava) + Série RPS (5,
//   espaços à direita) + Número RPS (12, zeros à esquerda) + Data emissão
//   AAAAMMDD (8) + Tipo tributação (1: T/F/I/J) + Status RPS (1: N/C/E) +
//   ISS Retido (1: S/N) + Valor Serviços (15, centavos, zeros à esquerda) +
//   Valor Deduções (15, centavos, zeros à esquerda) + Código Serviço (5,
//   zeros à esquerda) + Tipo Documento Tomador (1: "1"=CPF/"2"=CNPJ — campo
//   que faltava por completo) + CPF/CNPJ tomador (14, zeros à esquerda).
// Soma: 12+5+12+8+1+1+1+15+15+5+1+14 = 90.
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
  const ccm = apenasDigitos(inscricaoMunicipalPrestador).padStart(12, "0").slice(-12);
  const serie = String(serieRps || "1").padEnd(5, " ").slice(0, 5);
  const numero = String(numeroRps).padStart(12, "0").slice(-12);
  const data = formatarDataISO(dataEmissao).replace(/-/g, "");
  const issRet = issRetido ? "S" : "N";
  const valorServ = String(Math.round((Number(valorServicos) || 0) * 100)).padStart(15, "0");
  const valorDed = String(Math.round((Number(valorDeducoes) || 0) * 100)).padStart(15, "0");
  const cServico = apenasDigitos(codigoServico).padStart(5, "0").slice(-5);
  const digitosTomador = apenasDigitos(cpfCnpjTomador);
  const tipoDocTomador = digitosTomador.length > 11 ? "2" : "1";
  const cpfCnpj = digitosTomador.padStart(14, "0").slice(-14);

  const cadeia =
    ccm + serie + numero + data + tipoTributacao + statusRps + issRet +
    valorServ + valorDed + cServico + tipoDocTomador + cpfCnpj;

  if (cadeia.length !== 90) {
    throw new Error(`Cadeia de assinatura do RPS ficou com ${cadeia.length} caracteres (esperado 90): "${cadeia}"`);
  }
  return cadeia;
}

// Monta o <RPS> de uma nota — recebe os dados já carregados do banco
// (notasfiscais + join de empresas/clientes/servicos/orcamentoparcelas).
// `numeroRps` é o número sequencial do RPS pra essa inscrição municipal —
// usamos o próprio idnotafiscal (único, crescente, nunca reaproveitado,
// que é exatamente o que o layout pede — não precisa de contador à parte).
// `chavePrivadaPem` vem do certificado A1 da empresa emissora (ver
// utils/assinarXmlRpsLote.js) — obrigatório, sem ele não tem como assinar
// a cadeia de verdade.
function montarXmlRps(dados, chavePrivadaPem) {
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
    valorPisCofinsCsllRetido, // total retido — vai inteiro em ValorCSLL (ver nota acima)
    valorIrrfRetido,
    municipioPrestacaoIbge,
    nbs, // servicos.nbs — obrigatório no layout v2 (não existia no v1)
    cIndOp, // servicos.cindop — código indicador da operação (IBSCBS)
    classificacaoTributaria, // servicos.classificacaotributaria — cClassTrib (IBSCBS)
    nomeEvento,
    dataInicioEvento,
    dataFimEvento,
    cepEvento,
    ruaEvento,
    numeroEvento,
    bairroEvento,
  } = dados;

  const numeroRps = idnotafiscal;
  const serieRps = "1";
  // TributacaoRPS: "T" = tributado em São Paulo (nosso caso normal), "F" =
  // tributado fora de São Paulo — usado quando o evento está em outro
  // município (exceção do art. 3º da LC 116/2003 / art. 3º da Lei municipal
  // 13.701/2003). Com "T" a prefeitura IGNORA AliquotaServicos (documentado
  // no manual); só com "F" a alíquota digitada pelo financeiro é respeitada,
  // e só com "F" o MunicipioPrestacao pode ser enviado (com "T" dá erro
  // 1223, confirmado 2026-08-21).
  const tributadoForaDeSaoPaulo = !!municipioPrestacaoIbge && String(municipioPrestacaoIbge) !== MUNICIPIO_SAO_PAULO_IBGE;
  const tipoTributacao = tributadoForaDeSaoPaulo ? "F" : "T";
  const statusRps = "N"; // Normal
  const issRetido = false; // nunca vimos retenção de ISS nas notas reais até agora — reavaliar se algum tomador exigir
  const valorCsllCombinado = arredondar2(valorPisCofinsCsllRetido);
  const retencaoPisCofins = codigoRetencaoPisCofins(valorPisCofinsCsllRetido);
  const valorIrCalculado = arredondar2(valorIrrfRetido);

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

  // RSA-SHA1 "cru" da cadeia (tpAssinatura) — diferente do <ds:Signature>
  // XMLDSig do envelope inteiro, que é aplicado depois, em cima do XML
  // completo (ver gerarXmlPedidoEnvioLoteRPS / assinarEnvelopeXml).
  const assinaturaBase64 = assinarCadeiaRPS(assinatura, chavePrivadaPem);

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
      <!-- ValorPIS/ValorCOFINS obrigatórios no XSD mas vão zerados — o total
           retido de PIS+COFINS+CSLL vai inteiro em ValorCSLL, nova
           sistemática vigente desde 14/05/2026 (ver nota em
           codigoRetencaoPisCofins acima). -->
      ${elemento("ValorPIS", formatarValorXml(0), true)}
      ${elemento("ValorCOFINS", formatarValorXml(0), true)}
      ${elemento("ValorINSS", formatarValorXml(0), true)}
      <!-- Estava fixo em 0 até 2026-09-02 mesmo quando havia retenção de
           IRRF calculada e cobrada do cliente (notasfiscais.valorirrf) —
           bug real, o valor nunca chegava a ser declarado pra prefeitura.
           Corrigido: agora usa o valor de verdade. -->
      ${elemento("ValorIR", formatarValorXml(valorIrCalculado), true)}
      ${elemento("ValorCSLL", formatarValorXml(valorCsllCombinado), true)}
      ${elemento("CodigoServico", apenasDigitos(codigoServico), true)}
      <!-- AliquotaServicos espera fração decimal (0.025 = 2,5%), não
           percentual (2.5) — confirmado contra o ambiente real da prefeitura
           (2026-08-21, alerta 208: "aliquota informada (2,5) difere da
           vigente (0,025)"). Na prática esse campo é ignorado quando
           TributacaoRPS = "T" (documentado no próprio XSD), mas mandamos
           certo mesmo assim pra não gerar alerta à toa. -->
      ${elemento("AliquotaServicos", ((Number(aliquotaIss) || 0) / 100).toFixed(4), true)}
      ${elemento("ISSRetido", issRetido ? "true" : "false", true)}
      <!-- CPFCNPJTomador ou InscricaoMunicipalTomador: com o CNPJ do
           tomador já preenchido, o próprio sistema da prefeitura ignora
           Endereco/RazaoSocial/InscEstadual do tomador (busca do cadastro
           dele) — por isso não mandamos esses campos aqui, mais simples. -->
      ${elementoCpfCnpj("CPFCNPJTomador", cnpjTomador)}
      ${elemento("InscricaoMunicipalTomador", apenasDigitos(inscricaoMunicipalTomador))}
      ${elemento("EmailTomador", emailTomador)}
      ${elemento("Discriminacao", normalizarDiscriminacao(discriminacaoServico), true)}
      <!-- Só enviamos MunicipioPrestacao quando TributacaoRPS="F" (evento
           fora de São Paulo) — com "T" a prefeitura rejeita esse campo (erro
           1223, 2026-08-21). municipioPrestacaoIbge já vem resolvido (código
           IBGE) por quem chamou; ver utils/buscarMunicipioIbge.js. -->
      ${elemento("MunicipioPrestacao", tributadoForaDeSaoPaulo ? municipioPrestacaoIbge : null, tributadoForaDeSaoPaulo)}
      <!-- Campo novo (opcional), mesma mudança de 14/05/2026 — precisa vir
           ANTES de ValorFinalCobrado nessa posição do XSD (NumeroEncapsulamento
           / ValorTotalRecebido / RetencaoPisCofins / [ValorInicialCobrado |
           ValorFinalCobrado], nessa ordem — TiposNFe_v02.xsd). -->
      ${elemento("RetencaoPisCofins", retencaoPisCofins)}
      <!-- ValorInicialCobrado x ValorFinalCobrado é um <xs:choice> no XSD —
           só pode mandar um dos dois. Confirmado contra o ambiente real da
           prefeitura (2026-08-21, erro 640): ValorInicialCobrado foi
           descontinuado, a prefeitura agora exige ValorFinalCobrado (mesmo
           valor — nosso valorServico já é o valor total cobrado do cliente,
           que é exatamente o que esse campo pede: "calcula os impostos do
           fim pro início" a partir dele). -->
      ${elemento("ValorFinalCobrado", formatarValorXml(valorServico), true)}
      ${elemento("ValorMulta", formatarValorXml(0))}
      ${elemento("ValorJuros", formatarValorXml(0))}
      ${elemento("ValorIPI", formatarValorXml(0), true)}
      ${elemento("ExigibilidadeSuspensa", "0", true)}
      ${elemento("NBS", apenasDigitos(nbs), true)}
      <!-- atvEvento: exigido pela prefeitura (confirmado 2026-08-21, erro
           637) pro indicador de operação "040101" (evento), que é o único
           que o sistema usa hoje — por isso sempre incluído, sem condicional.
           Dados vêm de eventos.nmevento / orcamentos.dtinirealizacao-
           dtfimrealizacao / localmontagem (rua/numero/bairro/cep). -->
      <atvEvento>
        ${elemento("xNomeEvt", nomeEvento, true)}
        ${elemento("dtIniEvt", formatarDataISO(dataInicioEvento), true)}
        ${elemento("dtFimEvt", formatarDataISO(dataFimEvento), true)}
        <end>
          ${elemento("CEP", apenasDigitos(cepEvento), true)}
          ${elemento("xLgr", ruaEvento, true)}
          ${elemento("nro", numeroEvento, true)}
          ${elemento("xBairro", bairroEvento, true)}
        </end>
      </atvEvento>
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

// Monta o envelope <PedidoEnvioLoteRPS> completo, já assinado — recebe um
// array de notas (cada item no mesmo formato aceito por montarXmlRps), os
// dados da empresa emissora (prestador) e o certificado A1 dela (chave
// privada + certificado, em PEM — ver utils/assinarXmlRpsLote.js
// carregarCertificado). Máximo 50 RPS por lote (limite do XSD).
function gerarXmlPedidoEnvioLoteRPS({ empresaEmissora, notas, certificado }) {
  if (!Array.isArray(notas) || !notas.length) {
    throw new Error("Nenhuma nota informada pra gerar o lote.");
  }
  if (notas.length > 50) {
    throw new Error(`Lote com ${notas.length} notas — o máximo permitido pelo layout é 50.`);
  }
  if (!certificado?.chavePrivadaPem || !certificado?.certificadoPem) {
    throw new Error("Certificado digital da empresa emissora não informado — sem ele não é possível assinar o RPS.");
  }

  const cnpjRemetente = apenasDigitos(empresaEmissora.cnpj);
  const hoje = new Date();
  const dtInicio = formatarDataISO(notas.reduce((min, n) => n.dataEmissao < min ? n.dataEmissao : min, notas[0].dataEmissao));
  const dtFim = formatarDataISO(notas.reduce((max, n) => n.dataEmissao > max ? n.dataEmissao : max, notas[0].dataEmissao));

  const rpsXml = notas
    .map((nota) =>
      montarXmlRps(
        { ...nota, inscricaoMunicipalPrestador: empresaEmissora.inscricaomunicipal },
        certificado.chavePrivadaPem
      )
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
  const envelopeSemAssinatura = `<?xml version="1.0" encoding="utf-8"?>
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
</ns:PedidoEnvioLoteRPS>`;

  return assinarEnvelopeXml(envelopeSemAssinatura, certificado.chavePrivadaPem, certificado.certificadoPem);
}

module.exports = {
  gerarXmlPedidoEnvioLoteRPS,
  montarXmlRps,
  montarCadeiaAssinaturaRPS,
  codigoRetencaoPisCofins,
  formatarValorXml,
  escaparXml,
  MUNICIPIO_SAO_PAULO_IBGE,
};
