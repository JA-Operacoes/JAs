// Consulta se um CNPJ é optante do Simples Nacional, ao vivo, via BrasilAPI
// (https://brasilapi.com.br/api/cnpj/v1/{cnpj}) — projeto open-source que
// republica os dados abertos que a própria Receita Federal já publica
// (não é scraping/dado inventado, só um jeito mais fácil de consultar sem
// captcha). Não existe API oficial gratuita e sem captcha pra isso — a
// "Consulta Optantes" oficial (receita.fazenda.gov.br) é só pelo navegador.
//
// Por ser um serviço comunitário (sem contrato/SLA), esta função NUNCA
// lança erro — sempre resolve com { optanteSimples, erro }. Quem chama
// decide o que fazer com `null` (não deu pra saber): a decisão de negócio
// é que uma falha aqui nunca deve bloquear a emissão da nota, só deixar de
// ajudar a pré-marcar a retenção automaticamente.
const https = require("https");

// Achado testando de verdade (2026-08-25): o endpoint de CNPJ da BrasilAPI
// tem limite de só 3 requisições por minuto — sem cache, uma sequência
// normal de emissões pra clientes diferentes bateria nesse limite rápido
// (cada uma cairia no fallback "não deu pra confirmar", perdendo a
// utilidade). Como a Receita só republica essa base uma vez por mês mesmo,
// cachear por 24h não perde precisão na prática — só evita o rate limit.
const cachePorCnpj = new Map(); // cnpj -> { resultado, expiraEm }
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function buscarSimplesNacional(cnpj) {
  const digitos = String(cnpj || "").replace(/\D/g, "");
  if (digitos.length !== 14) {
    return Promise.resolve({ optanteSimples: null, erro: "CNPJ inválido ou não informado." });
  }

  const emCache = cachePorCnpj.get(digitos);
  if (emCache && emCache.expiraEm > Date.now()) {
    return Promise.resolve(emCache.resultado);
  }

  return new Promise((resolve) => {
    const requisicao = https.get(
      `https://brasilapi.com.br/api/cnpj/v1/${digitos}`,
      { timeout: 5000 },
      (resposta) => {
        let corpo = "";
        resposta.on("data", (pedaco) => (corpo += pedaco));
        resposta.on("end", () => {
          if (resposta.statusCode !== 200) {
            return resolve({ optanteSimples: null, erro: `BrasilAPI retornou status ${resposta.statusCode}.` });
          }
          try {
            const dados = JSON.parse(corpo);
            const optanteSimples = typeof dados.opcao_pelo_simples === "boolean" ? dados.opcao_pelo_simples : null;
            const resultado = { optanteSimples, erro: null };
            // Só guarda em cache respostas de verdade (200 + JSON válido) —
            // falha de rede/rate-limit é transitória, não deve ficar "presa"
            // em cache fazendo a automação parecer indisponível por 24h.
            cachePorCnpj.set(digitos, { resultado, expiraEm: Date.now() + CACHE_TTL_MS });
            resolve(resultado);
          } catch (erroParse) {
            resolve({ optanteSimples: null, erro: "Resposta inválida da BrasilAPI." });
          }
        });
      }
    );
    requisicao.on("timeout", () => {
      requisicao.destroy();
      resolve({ optanteSimples: null, erro: "Tempo esgotado consultando a BrasilAPI." });
    });
    requisicao.on("error", (erroRede) => {
      resolve({ optanteSimples: null, erro: `Falha ao consultar a BrasilAPI: ${erroRede.message}` });
    });
  });
}

module.exports = { buscarSimplesNacional };
