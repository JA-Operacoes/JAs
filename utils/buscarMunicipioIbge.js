// Resolve o código IBGE de um município a partir do nome + UF, usando a API
// pública oficial do IBGE (https://servicodados.ibge.gov.br) — não existe
// uma base de alíquota de ISS por município disponível publicamente, mas o
// código do município em si é dado estável e gratuito, então buscamos ele
// ao vivo em vez de manter uma tabela fixa (que ficaria desatualizada assim
// que um evento acontecesse numa cidade nova).
const https = require("https");

const cachePorUf = new Map(); // uf (sigla) -> lista de municípios da API

function normalizarNomeMunicipio(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .trim();
}

function buscarMunicipiosPorUf(uf) {
  if (cachePorUf.has(uf)) return Promise.resolve(cachePorUf.get(uf));

  return new Promise((resolve, reject) => {
    const url = `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`;
    https
      .get(url, (resposta) => {
        let corpo = "";
        resposta.on("data", (pedaco) => (corpo += pedaco));
        resposta.on("end", () => {
          if (resposta.statusCode !== 200) {
            return reject(new Error(`API do IBGE retornou status ${resposta.statusCode} para UF "${uf}".`));
          }
          try {
            const lista = JSON.parse(corpo);
            cachePorUf.set(uf, lista);
            resolve(lista);
          } catch (erroParse) {
            reject(new Error("Resposta inválida da API do IBGE (não veio JSON)."));
          }
        });
      })
      .on("error", (erroRede) => reject(new Error(`Falha ao consultar a API do IBGE: ${erroRede.message}`)));
  });
}

// Retorna o código IBGE (string) do município, ou null se não encontrar —
// quem chama decide se isso é um erro bloqueante ou não.
async function buscarCodigoIbge(cidade, uf) {
  if (!cidade || !uf) return null;
  const lista = await buscarMunicipiosPorUf(String(uf).trim().toUpperCase());
  const alvo = normalizarNomeMunicipio(cidade);
  const encontrado = lista.find((m) => normalizarNomeMunicipio(m.nome) === alvo);
  return encontrado ? String(encontrado.id) : null;
}

module.exports = { buscarCodigoIbge };
