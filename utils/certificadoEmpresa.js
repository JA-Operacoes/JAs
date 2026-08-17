// utils/certificadoEmpresa.js
//
// Cada empresa emissora tem seu próprio certificado A1 pra assinar o XML da
// Nota Fiscal (o CNPJ da assinatura tem que bater com o CNPJ do RPS). Em vez
// de guardar id numérico ou pedir pra alguém digitar uma sigla à mão no
// .env, a sigla é derivada automaticamente do nmfantasia já cadastrado em
// `empresas` — sem risco de divergência entre banco e .env. A coluna
// `empresas.siglacertificado` só existe pro caso raro de duas empresas
// derivarem a mesma sigla: aí um valor manual ali sobrepõe a derivação
// automática só pra essa empresa (ver resolverSiglaCertificado).
"use strict";

// Sempre até 6 letras (pode ser menor se o nome já for curto, ex.: "EP").
// Remove acento, hífen, espaço e qualquer outro caractere que variável de
// ambiente não aceita. Usado tanto pra derivar do nmfantasia quanto pra
// normalizar uma sigla digitada manualmente na resolução de conflito.
function normalizarSigla(texto) {
  return (texto || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "") // remove acento (ex.: JOÃO -> JOAO)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "") // remove hífen, espaço, etc.
    .slice(0, 6);
}

function derivarSiglaCertificado(nmfantasia) {
  return normalizarSigla(nmfantasia);
}

// Sigla que vale de verdade pra uma empresa: o override manual
// (empresas.siglacertificado), quando preenchido, sempre vence a derivação
// automática do nmfantasia.
function resolverSiglaCertificado(empresa) {
  const manual = normalizarSigla(empresa?.siglacertificado);
  if (manual) return manual;
  return derivarSiglaCertificado(empresa?.nmfantasia);
}

// caminho/senha ficam null quando a variável correspondente não existe ou
// está vazia no .env — quem chamar decide o que fazer (bloquear emissão,
// avisar, etc.), este módulo só resolve o nome da variável.
function obterCertificadoEmpresa(empresa) {
  const sigla = resolverSiglaCertificado(empresa);
  if (!sigla) return null;
  return {
    sigla,
    caminho: process.env[`NFE_CERTIFICADO_${sigla}_PATH`] || null,
    senha: process.env[`NFE_CERTIFICADO_${sigla}_SENHA`] || null,
  };
}

// Duas empresas com a mesma sigla (derivada ou manual) usariam sem querer o
// mesmo par de variáveis de certificado — ou seja, uma assinaria nota com o
// certificado (CNPJ) da outra. Roda uma vez na subida do servidor contra
// todas as empresas cadastradas; retorna a lista de colisões encontradas
// (vazia = tudo certo).
function verificarColisaoDeSiglas(empresas) {
  const porSigla = new Map();
  const colisoes = [];

  empresas.forEach((empresa) => {
    const sigla = resolverSiglaCertificado(empresa);
    if (!sigla) return;

    const anterior = porSigla.get(sigla);
    if (anterior) {
      colisoes.push({ sigla, empresas: [anterior, empresa] });
    } else {
      porSigla.set(sigla, empresa);
    }
  });

  return colisoes;
}

// Só olha se PATH e SENHA estão preenchidos — nunca retorna o valor deles
// (quem chama isso é pra decidir se mostra "configurado: sim/não" pro
// financeiro, nunca pra expor a senha de volta pro navegador).
function certificadoConfigurado(sigla) {
  if (!sigla) return false;
  return Boolean(
    process.env[`NFE_CERTIFICADO_${sigla}_PATH`] &&
    process.env[`NFE_CERTIFICADO_${sigla}_SENHA`]
  );
}

module.exports = {
  normalizarSigla,
  derivarSiglaCertificado,
  resolverSiglaCertificado,
  obterCertificadoEmpresa,
  verificarColisaoDeSiglas,
  certificadoConfigurado,
};
