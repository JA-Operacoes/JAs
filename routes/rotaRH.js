// Rota do RH: holerite virtual / folha de pagamento de funcionários de salário fixo.
// Diferente do CeoMode (rentabilidade), aqui o foco é a remuneração mensal de cada
// funcionário (perfil 'Interno'/'Externo'): salário base + proventos/descontos variáveis,
// por competência (mês/ano), com controle de pagamento (Pendente/Pago) e cálculo
// automático de INSS/IRRF com base em parâmetros fiscais editáveis por ano.
const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const pool = require("../db/conexaoDB");
const { contextoEmpresa } = require("../middlewares/authMiddlewares");
const { exigirFlag } = require("../middlewares/permissaoMiddleware");

// Só master/dev pode ALTERAR comprovantes (trocar um já anexado ou remover). O primeiro
// anexo é liberado para o usuário de RH; a partir daí a mudança é restrita.
async function podeAlterarComprovante(idusuario, idempresa) {
  if (!idusuario || !idempresa) return false;
  const { rows } = await pool.query(
    `SELECT 1 FROM permissoes
      WHERE idusuario = $1 AND idempresa = $2 AND (master = true OR devs = true) LIMIT 1`,
    [idusuario, idempresa]
  );
  return rows.length > 0;
}

// ===== Upload de comprovante do holerite (imagem / PDF / JFIF) =====
// Um comprovante por holerite. Guarda só o nome do arquivo na coluna
// folhaholerite.comprovante; o arquivo fica em uploads/rh/comprovantes e é
// servido pelo static /uploads (server.js já trata .jfif como image/jpeg).
const dirComprovantesRH = path.join(__dirname, "../uploads/rh/comprovantes");
fs.mkdirSync(dirComprovantesRH, { recursive: true });

const storageComprovanteRH = multer.diskStorage({
  destination: (req, file, cb) => cb(null, dirComprovantesRH),
  filename: (req, file, cb) => {
    const id = req.params.id || "0";
    const nomeLimpo = path.parse(file.originalname).name
      .replace(/\s+/g, "")
      .replace(/[^a-zA-Z0-9]/g, "");
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${nomeLimpo}-${Date.now()}${ext}`);
  },
});

// Aceita imagens (image/*, cobre JFIF que os navegadores enviam como image/jpeg)
// e PDFs. Rejeita o resto com mensagem clara.
const fileFilterComprovanteRH = (req, file, cb) => {
  if (file.mimetype.startsWith("image/") || file.mimetype === "application/pdf") {
    cb(null, true);
  } else {
    cb(new Error("Apenas imagens e PDFs são permitidos."), false);
  }
};

const uploadComprovanteRH = multer({
  storage: storageComprovanteRH,
  fileFilter: fileFilterComprovanteRH,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
}).single("comprovante");

// Perfis considerados "salário fixo" (entram na folha).
const PERFIS_FOLHA = ["Interno", "Externo"];

// Parâmetros fiscais padrão de 2026 (Receita Federal / Portaria Interm. MPS-MF nº 13;
// Leis 15.191/2025 e 15.270/2025). Fixos no código (sem tabela de parâmetros).
const PARAMS_2026 = {
  inss_faixas: [
    { ate: 1621.00, aliquota: 0.075 },
    { ate: 2902.84, aliquota: 0.09 },
    { ate: 4354.27, aliquota: 0.12 },
    { ate: 8475.55, aliquota: 0.14 },
  ],
  irrf_faixas: [
    { ate: 2428.80, aliquota: 0, deduzir: 0 },
    { ate: 2826.65, aliquota: 0.075, deduzir: 182.16 },
    { ate: 3751.05, aliquota: 0.15, deduzir: 394.16 },
    { ate: 4664.68, aliquota: 0.225, deduzir: 675.49 },
    { ate: null, aliquota: 0.275, deduzir: 908.73 }, // null = última faixa (sem teto)
  ],
  irrf_deducao_dependente: 189.59,
  irrf_desconto_simplificado: 607.20,
  irrf_redutor: { isencao_ate: 5000, isencao_redutor: 312.89, phaseout_ate: 7350, coef_a: 978.62, coef_b: 0.133145 },
  fgts_aliquota: 0.08, // FGTS = 8% sobre a remuneração (custo do empregador, não desconto)
};

// Parâmetros fiscais por ano, lidos da tabela `folhaparametros` (criada manualmente —
// ver SQL no topo do projeto). PARAMS_2026 fica só como FALLBACK de segurança caso a
// tabela não exista ou o ano não esteja cadastrado.
async function obterParametros(ano) {
  const a = parseInt(ano, 10) || new Date().getFullYear();
  try {
    const { rows } = await pool.query(
      `SELECT inssfaixas, irrffaixas, irrfdeducaodependente,
              irrfdescontosimplificado, irrfredutor, fgtsaliquota
       FROM aliquotas WHERE ano = $1`,
      [a]
    );
    if (rows.length) {
      const r = rows[0];
      // Colunas JSONB já voltam como objeto/array; NUMERIC volta como string → Number().
      return {
        inss_faixas: r.inssfaixas,
        irrf_faixas: r.irrffaixas,
        irrf_deducao_dependente: Number(r.irrfdeducaodependente),
        irrf_desconto_simplificado: Number(r.irrfdescontosimplificado),
        irrf_redutor: r.irrfredutor,
        fgts_aliquota: Number(r.fgtsaliquota),
      };
    }
    console.warn(`RH: parâmetros fiscais do ano ${a} não encontrados em aliquotas; usando fallback PARAMS_2026.`);
  } catch (err) {
    console.error("RH: erro ao ler aliquotas (usando fallback PARAMS_2026):", err.message);
  }
  return PARAMS_2026;
}

// ===== Motor de cálculo (funções puras) =====
// INSS progressivo fatiado: aplica a alíquota de cada faixa só sobre a parcela dentro dela.
function calcularINSS(bruto, params) {
  const faixas = params.inss_faixas || [];
  let inss = 0, anterior = 0;
  for (const f of faixas) {
    const teto = Number(f.ate);
    if (bruto > anterior) {
      const parcela = Math.min(bruto, teto) - anterior;
      inss += parcela * Number(f.aliquota);
    }
    anterior = teto;
    if (bruto <= teto) break;
  }
  return Math.round(inss * 100) / 100;
}

// Imposto bruto de uma base segundo a tabela progressiva (faixa.ate=null => última, sem teto).
function impostoPelaTabela(base, faixas) {
  let faixa = faixas[faixas.length - 1];
  for (const f of faixas) {
    if (f.ate === null || f.ate === undefined || base <= Number(f.ate)) { faixa = f; break; }
  }
  const imp = base * Number(faixa.aliquota) - Number(faixa.deduzir);
  return Math.max(0, imp);
}

// IRRF mensal: base = bruto − inss − dependentes×dedução. Escolhe o menor imposto entre
// (tabela progressiva com deduções) e (desconto simplificado), aplica o redutor 2026.
function calcularIRRF(bruto, inss, dependentes, params) {
  const faixas = params.irrf_faixas || [];
  const dedDep = Number(params.irrf_deducao_dependente) || 0;
  const simplificado = Number(params.irrf_desconto_simplificado) || 0;
  const deps = Number(dependentes) || 0;

  const rendimentoTributavel = bruto - inss; // rendimento já líquido do INSS
  const baseCompleta = Math.max(0, rendimentoTributavel - deps * dedDep);
  const baseSimplificada = Math.max(0, rendimentoTributavel - simplificado);
  const impostoCompleto = impostoPelaTabela(baseCompleta, faixas);
  const impostoSimplificado = impostoPelaTabela(baseSimplificada, faixas);

  const usouSimplificado = impostoSimplificado < impostoCompleto;
  const baseUsada = usouSimplificado ? baseSimplificada : baseCompleta;
  let imposto = Math.min(impostoCompleto, impostoSimplificado);

  // Redutor 2026 (sobre o rendimento mensal tributável).
  const red = params.irrf_redutor || {};
  let redutor = 0;
  if (rendimentoTributavel <= Number(red.isencao_ate)) {
    redutor = Number(red.isencao_redutor) || 0;
  } else if (rendimentoTributavel <= Number(red.phaseout_ate)) {
    redutor = Number(red.coef_a) - Number(red.coef_b) * rendimentoTributavel;
  }
  redutor = Math.max(0, redutor);

  imposto = Math.max(0, imposto - redutor);
  // Faixa (alíquota) aplicada sobre a base usada — para exibição no holerite.
  const faixa = faixas.find((f) => f.ate === null || f.ate === undefined || baseUsada <= Number(f.ate)) || faixas[faixas.length - 1];
  return {
    irrf: Math.round(imposto * 100) / 100,
    baseIrrf: Math.round(baseCompleta * 100) / 100,
    baseIrrfSimplificada: Math.round(baseSimplificada * 100) / 100,
    aliquota: Number(faixa.aliquota) || 0,
    usouSimplificado,
  };
}

// Calcula os totais de um holerite a partir do salário base + itens.
// Itens: 'P' = provento tributável, 'B' = benefício não-tributável (VA/VT — fora da
// base de impostos e, por padrão, fora do líquido), 'D' = desconto.
function calcularTotais(salariobase, itens) {
  const base = Number(salariobase) || 0;
  let proventos = base; // salário + proventos tributáveis (P)
  let beneficios = 0;   // benefícios não-tributáveis (B), informativos por padrão
  let descontos = 0;
  (itens || []).forEach((i) => {
    const v = Number(i.valor) || 0;
    if (i.tipo === "D") descontos += v;
    else if (i.tipo === "B") beneficios += v;
    else proventos += v;
  });
  // Líquido NÃO inclui benefícios por padrão (pagos via cartão/vale). O front pode
  // somá-los quando o RH ativar o respectivo toggle.
  return { proventos, beneficios, descontos, liquido: proventos - descontos };
}

// ===== Motor de cálculo da rescisão =====
function round2(v) { return Math.round((Number(v) || 0) * 100) / 100; }

// Anos completos de serviço entre admissão e desligamento (p/ aviso prévio proporcional).
function anosCompletosEntre(adm, fim) {
  let anos = fim.getFullYear() - adm.getFullYear();
  const m = fim.getMonth() - adm.getMonth();
  if (m < 0 || (m === 0 && fim.getDate() < adm.getDate())) anos--;
  return Math.max(0, anos);
}

// Conta "avos" (meses com >=15 dias trabalhados) entre inicio e fim (inclusive), cap 12.
function contarAvos(inicio, fim) {
  if (fim < inicio) return 0;
  let avos = 0;
  let y = inicio.getFullYear(), m = inicio.getMonth();
  const fy = fim.getFullYear(), fm = fim.getMonth();
  while (y < fy || (y === fy && m <= fm)) {
    const ehMesInicio = (y === inicio.getFullYear() && m === inicio.getMonth());
    const ehMesFim = (y === fy && m === fm);
    const primeiroDia = ehMesInicio ? inicio.getDate() : 1;
    const ultimoDia = ehMesFim ? fim.getDate() : new Date(y, m + 1, 0).getDate();
    if (ultimoDia - primeiroDia + 1 >= 15) avos++;
    m++; if (m > 11) { m = 0; y++; }
  }
  return Math.min(12, avos);
}

// Calcula as verbas rescisórias com o tratamento tributário correto.
// Regras por motivo (sem_justa_causa | pedido | acordo | justa_causa | fim_contrato):
//  - aviso prévio indenizado e férias (vencidas/proporcionais) + 1/3 são INDENIZATÓRIOS
//    => NÃO incidem INSS nem IRRF;
//  - saldo de salário é tributável na base mensal;
//  - 13º proporcional é tributável em base SEPARADA (INSS e IRRF próprios);
//  - multa do FGTS (40% / 20%) é isenta.
function calcularRescisao(input, params) {
  const salario = Number(input.salario) || 0;
  const dependentes = Number(input.dependentes) || 0;
  const motivo = input.motivo || "sem_justa_causa";
  const aviso = input.avisoPrevio || "indenizado"; // indenizado | trabalhado | dispensado | nao_cumprido
  const feriasVencidas = Math.max(0, Number(input.feriasVencidas) || 0);
  const saldoFgts = Number(input.saldoFgts) || 0;

  const adm = input.admissao ? new Date(String(input.admissao).slice(0, 10) + "T00:00:00") : null;
  const fim = input.desligamento ? new Date(String(input.desligamento).slice(0, 10) + "T00:00:00") : null;
  if (!adm || isNaN(adm.getTime())) throw new Error("Data de admissão inválida.");
  if (!fim || isNaN(fim.getTime())) throw new Error("Data de desligamento (rescisão) é obrigatória.");
  if (fim < adm) throw new Error("Desligamento não pode ser anterior à admissão.");

  const diario = salario / 30;
  const proventos = []; // { descricao, valor, tributavel?, base13? }
  const descontos = []; // { descricao, valor }

  // Direitos por motivo.
  const direito = {
    sem_justa_causa: { prop: true, multa: 0.40 },
    acordo:          { prop: true, multa: 0.20 },
    pedido:          { prop: true, multa: 0 },
    justa_causa:     { prop: false, multa: 0 },
    fim_contrato:    { prop: true, multa: 0 },
  }[motivo] || { prop: true, multa: 0 };

  // 1) Saldo de salário (dias trabalhados no mês do desligamento). Tributável.
  const diasTrabMes = fim.getDate();
  const saldoSalario = round2(diario * diasTrabMes);
  if (saldoSalario > 0)
    proventos.push({ descricao: `Saldo de salário (${diasTrabMes} dias)`, valor: saldoSalario, tributavel: true });

  // 2) Aviso prévio proporcional: 30 dias + 3 por ano completo, máx. 90 (Lei 12.506/2011).
  const anosServico = anosCompletosEntre(adm, fim);
  const diasAviso = Math.min(30 + 3 * anosServico, 90);
  const dataProp = new Date(fim); // base p/ proporcionais (projeta com aviso indenizado/trabalhado)
  if (motivo === "sem_justa_causa") {
    if (aviso === "indenizado") {
      proventos.push({ descricao: `Aviso prévio indenizado (${diasAviso} dias)`, valor: round2(diario * diasAviso), tributavel: false });
      dataProp.setDate(dataProp.getDate() + diasAviso);
    } else if (aviso === "trabalhado") {
      dataProp.setDate(dataProp.getDate() + diasAviso); // período cumprido conta p/ proporcionais
    }
  } else if (motivo === "acordo") {
    const dias = Math.round(diasAviso / 2);
    proventos.push({ descricao: `Aviso prévio indenizado 50% — acordo (${dias} dias)`, valor: round2(diario * diasAviso / 2), tributavel: false });
    dataProp.setDate(dataProp.getDate() + dias);
  } else if (motivo === "pedido") {
    if (aviso === "nao_cumprido")
      descontos.push({ descricao: "Aviso prévio não cumprido", valor: round2(salario) });
    else if (aviso === "trabalhado")
      dataProp.setDate(dataProp.getDate() + diasAviso);
  }
  // justa_causa / fim_contrato: sem aviso indenizado.

  // 3) 13º proporcional (avos no ano do desligamento). Tributável em base própria.
  let valor13 = 0, avos13 = 0;
  if (direito.prop) {
    const inicioAno = new Date(fim.getFullYear(), 0, 1);
    const inicio13 = adm > inicioAno ? adm : inicioAno;
    avos13 = contarAvos(inicio13, dataProp);
    valor13 = round2(salario / 12 * avos13);
    if (valor13 > 0)
      proventos.push({ descricao: `13º salário proporcional (${avos13}/12)`, valor: valor13, base13: true });
  }

  // 4) Férias vencidas + 1/3 (indenizadas, isentas). Devidas em qualquer motivo.
  if (feriasVencidas > 0) {
    const vBase = round2(salario * feriasVencidas);
    proventos.push({ descricao: `Férias vencidas (${feriasVencidas} período(s))`, valor: vBase, tributavel: false });
    proventos.push({ descricao: "1/3 sobre férias vencidas", valor: round2(vBase / 3), tributavel: false });
  }

  // 5) Férias proporcionais + 1/3 (indenizadas, isentas). Não devidas em justa causa.
  let avosFerias = 0;
  if (direito.prop) {
    const aniversario = new Date(fim.getFullYear(), adm.getMonth(), adm.getDate());
    if (aniversario > fim) aniversario.setFullYear(aniversario.getFullYear() - 1);
    avosFerias = contarAvos(aniversario, dataProp);
    if (avosFerias > 0) {
      const fBase = round2(salario / 12 * avosFerias);
      proventos.push({ descricao: `Férias proporcionais (${avosFerias}/12)`, valor: fBase, tributavel: false });
      proventos.push({ descricao: "1/3 sobre férias proporcionais", valor: round2(fBase / 3), tributavel: false });
    }
  }

  // 6) Multa rescisória do FGTS sobre o saldo informado (isenta).
  let multaFgts = 0;
  if (direito.multa > 0 && saldoFgts > 0) {
    multaFgts = round2(saldoFgts * direito.multa);
    proventos.push({ descricao: `Multa FGTS ${Math.round(direito.multa * 100)}%`, valor: multaFgts, tributavel: false });
  }

  // ===== INSS / IRRF =====
  // Base mensal tributável (saldo de salário e quaisquer outros itens tributáveis mensais).
  const baseMensal = round2(proventos.filter((p) => p.tributavel).reduce((s, p) => s + p.valor, 0));
  const inssMensal = baseMensal > 0 ? calcularINSS(baseMensal, params) : 0;
  const irMensal = baseMensal > 0 ? calcularIRRF(baseMensal, inssMensal, dependentes, params) : { irrf: 0 };
  if (inssMensal > 0) descontos.push({ descricao: "INSS", valor: inssMensal });
  if (irMensal.irrf > 0) descontos.push({ descricao: "IRRF", valor: irMensal.irrf });

  // 13º: base separada (INSS e IRRF próprios).
  const inss13 = valor13 > 0 ? calcularINSS(valor13, params) : 0;
  const ir13 = valor13 > 0 ? calcularIRRF(valor13, inss13, dependentes, params) : { irrf: 0 };
  if (inss13 > 0) descontos.push({ descricao: "INSS 13º", valor: inss13 });
  if (ir13.irrf > 0) descontos.push({ descricao: "IRRF 13º", valor: ir13.irrf });

  // FGTS do mês: incide sobre saldo de salário + 13º + aviso indenizado.
  const fgtsAliquota = Number(params.fgts_aliquota) || 0.08;
  const avisoIndenizado = proventos.filter((p) => /aviso pr/i.test(p.descricao)).reduce((s, p) => s + p.valor, 0);
  const baseFgts = round2(saldoSalario + valor13 + avisoIndenizado);
  const fgtsMes = round2(baseFgts * fgtsAliquota);

  const limpar = (arr, tipo) => arr.map((i) => ({ tipo, descricao: i.descricao, valor: i.valor }));
  return {
    proventos: limpar(proventos, "P"),
    descontos: limpar(descontos, "D"),
    resumo: {
      anosServico, diasAviso, avos13, avosFerias,
      saldoSalario, valor13, multaFgts, saldoFgts,
      baseMensal, inssMensal, irrfMensal: irMensal.irrf,
      inss13, irrf13: ir13.irrf,
      baseFgts, fgtsMes,
      dataProjetada: dataProp.toISOString().slice(0, 10),
    },
  };
}

// ===== Dias úteis (para VA/VT por dia) =====
// Domingo de Páscoa (algoritmo de Computus / Gauss-Butcher), retorna {mes, dia}.
function calcularPascoa(ano) {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31); // 3=março, 4=abril
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return { mes, dia };
}

// Conjunto de feriados (nacionais + municipais de SP) do ano, como 'YYYY-MM-DD'.
// Espelha os feriados usados no relatório (rotaRelatorio.js): fixos + móveis do Carnaval
// e Corpus Christi, derivados da Páscoa.
function feriadosDoAno(ano) {
  const iso = (mes, dia) => `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  const set = new Set([
    iso(1, 1),    // Ano Novo (nacional)
    iso(1, 25),   // Aniversário de São Paulo (municipal SP)
    iso(4, 21),   // Tiradentes (nacional)
    iso(5, 1),    // Dia do Trabalho (nacional)
    iso(9, 7),    // Independência (nacional)
    iso(10, 12),  // N. Sra. Aparecida (nacional)
    iso(11, 2),   // Finados (nacional)
    iso(11, 15),  // Proclamação da República (nacional)
    iso(11, 20),  // Consciência Negra (nacional desde 2024 / municipal SP)
    iso(12, 25),  // Natal (nacional)
  ]);
  // Feriados móveis a partir do Domingo de Páscoa.
  const p = calcularPascoa(ano);
  const pascoa = new Date(ano, p.mes - 1, p.dia);
  const desloca = (dias) => {
    const d = new Date(pascoa);
    d.setDate(d.getDate() + dias);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  set.add(desloca(-48)); // Segunda de Carnaval
  set.add(desloca(-47)); // Terça de Carnaval
  set.add(desloca(60));  // Corpus Christi
  return set;
}

// Conta dias úteis (seg–sex) do mês, descontando os feriados acima.
function contarDiasUteis(ano, mes) {
  const feriados = feriadosDoAno(ano);
  const ultimoDia = new Date(ano, mes, 0).getDate();
  let dias = 0;
  for (let d = 1; d <= ultimoDia; d++) {
    const data = new Date(ano, mes - 1, d);
    const dow = data.getDay(); // 0=domingo, 6=sábado
    if (dow === 0 || dow === 6) continue;
    const isoDia = `${ano}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (feriados.has(isoDia)) continue;
    dias++;
  }
  return dias;
}



// GET /rh/funcionarios — funcionários de salário fixo (perfil Interno/Externo) da empresa.
router.get("/funcionarios", async (req, res) => {
  try {
    const idempresa = req.idempresa;
    if (!idempresa) return res.status(400).json({ error: "idempresa obrigatório." });

    const { rows } = await pool.query(
      `SELECT f.idfuncionario, f.nome, f.perfil, f.funcao, f.cbo, f.admissao, f.salario, f.dependentes
       FROM funcionarios f
       JOIN funcionarioempresas fe ON fe.idfuncionario = f.idfuncionario
       WHERE fe.idempresa = $1
         AND f.perfil = ANY($2)
         AND COALESCE(f.ativo, true) = true
       ORDER BY f.nome ASC`,
      [idempresa, PERFIS_FOLHA]
    );
    res.json(rows);
  } catch (error) {
    console.error("ERRO RH /funcionarios:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /rh/empresas — dados do empregador (empresa atual) p/ cabeçalho do holerite.
router.get("/empresas", async (req, res) => {
  try {
    const idempresa = req.idempresa;
    if (!idempresa) return res.status(400).json({ error: "idempresa obrigatório." });

    const { rows } = await pool.query(
      `SELECT idempresa, nmfantasia, razaosocial, cnpj, endereco, numero, bairro, complemento, cep, cidade, estado
       FROM empresas e
       WHERE idempresa = $1`,
      [idempresa]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Empresa não encontrada." });
    res.json(rows[0]);
  } catch (error) {
    console.error("ERRO RH /empresas:", error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /rh/funcionario/:id/salario — atualiza salário base e dependentes no cadastro.
router.put("/funcionario/:id/salario", async (req, res) => {
  try {
    const idempresa = req.idempresa;
    const idfuncionario = parseInt(req.params.id, 10);
    const salariobase = Number(req.body.salario) || 0;
    const dependentes = parseInt(req.body.dependentes, 10) || 0;
    if (!idempresa) return res.status(400).json({ error: "idempresa obrigatório." });
    if (!idfuncionario) return res.status(400).json({ error: "idfuncionario obrigatório." });

    // Confere que o funcionário pertence à empresa antes de alterar.
    const dono = await pool.query(
      `SELECT 1 FROM funcionarioempresas WHERE idfuncionario = $1 AND idempresa = $2`,
      [idfuncionario, idempresa]
    );
    if (dono.rowCount === 0) return res.status(404).json({ error: "Funcionário não encontrado nesta empresa." });

    await pool.query(
      `UPDATE funcionarios SET salario = $1, dependentes = $2 WHERE idfuncionario = $3`,
      [salariobase, dependentes, idfuncionario]
    );
    res.json({ ok: true, salariobase, dependentes });
  } catch (error) {
    console.error("ERRO RH /funcionario/:id/salario:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /rh/parametros?ano= — parâmetros fiscais do ano (lidos de folhaparametros).
router.get("/parametros", async (req, res) => {
  try {
    const ano = parseInt(req.query.ano, 10) || new Date().getFullYear();
    res.json({ ano, ...(await obterParametros(ano)) });
  } catch (error) {
    console.error("ERRO RH GET /parametros:", error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /rh/parametros/:ano — cria/atualiza os parâmetros fiscais do ano (upsert).
// Body: { inss_faixas, irrf_faixas, irrf_deducao_dependente,
//         irrf_desconto_simplificado, irrf_redutor, fgts_aliquota }
router.put("/parametros/:ano", async (req, res) => {
  try {
    const ano = parseInt(req.params.ano, 10);
    if (!ano) return res.status(400).json({ error: "Ano inválido." });
    const b = req.body || {};
    // Validação mínima das estruturas esperadas.
    if (!Array.isArray(b.inss_faixas) || !Array.isArray(b.irrf_faixas))
      return res.status(400).json({ error: "inss_faixas e irrf_faixas devem ser listas." });
    if (typeof b.irrf_redutor !== "object" || b.irrf_redutor === null)
      return res.status(400).json({ error: "irrf_redutor deve ser um objeto." });

    await pool.query(
      `INSERT INTO aliquotas
         (ano, inssfaixas, irrffaixas, irrfdeducaodependente,
          irrfdescontosimplificado, irrfredutor, fgtsaliquota)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (ano) DO UPDATE SET
         inssfaixas = EXCLUDED.inssfaixas,
         irrffaixas = EXCLUDED.irrffaixas,
         irrfdeducaodependente = EXCLUDED.irrfdeducaodependente,
         irrfdescontosimplificado = EXCLUDED.irrfdescontosimplificado,
         irrfredutor = EXCLUDED.irrfredutor,
         fgtsaliquota = EXCLUDED.fgtsaliquota`,
      [ano, JSON.stringify(b.inss_faixas), JSON.stringify(b.irrf_faixas),
       Number(b.irrf_deducao_dependente) || 0, Number(b.irrf_desconto_simplificado) || 0,
       JSON.stringify(b.irrf_redutor), Number(b.fgts_aliquota) || 0]
    );
    res.json({ ok: true, ano });
  } catch (error) {
    console.error("ERRO RH PUT /parametros:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /rh/holerite/calcular — calcula INSS/IRRF do holerite SEM persistir.
// Body: { idfuncionario, mes, ano, salariobase, itens:[{tipo,descricao,valor}] }
router.post("/holerite/calcular", async (req, res) => {
  try {
    const idempresa = req.idempresa;
    const { idfuncionario, ano, salariobase } = req.body;
    const itens = Array.isArray(req.body.itens) ? req.body.itens : [];
    if (!idempresa) return res.status(400).json({ error: "idempresa obrigatório." });
    if (!idfuncionario) return res.status(400).json({ error: "idfuncionario obrigatório." });

    const func = await pool.query(
      `SELECT *
       FROM funcionarios f
       JOIN funcionarioempresas fe ON fe.idfuncionario = f.idfuncionario
       WHERE f.idfuncionario = $1 AND fe.idempresa = $2`,
      [idfuncionario, idempresa]
    );
    if (func.rowCount === 0) return res.status(404).json({ error: "Funcionário não encontrado nesta empresa." });
    const dependentes = func.rows[0].dependentes;

    const params = await obterParametros(parseInt(ano, 10) || new Date().getFullYear());
    if (!params) return res.status(404).json({ error: "Parâmetros fiscais não cadastrados." });

    // Bruto = salário base + proventos (linhas 'P'). Descontos não entram na base.
    const base = Number(salariobase) || 0;
    const proventos = itens.filter((i) => i.tipo === "P").reduce((s, i) => s + (Number(i.valor) || 0), 0);
    const bruto = base + proventos;

    const inss = calcularINSS(bruto, params);
    const ir = calcularIRRF(bruto, inss, dependentes, params);

    // Bases informativas do rodapé do holerite.
    const fgtsAliquota = Number(params.fgts_aliquota) || 0.08;
    const baseFgts = bruto;                                   // FGTS incide sobre a remuneração
    const fgtsMes = Math.round(baseFgts * fgtsAliquota * 100) / 100;

    res.json({
      bruto, inss, irrf: ir.irrf, baseIrrf: ir.baseIrrf, dependentes,
      salContrInss: bruto,                  // salário de contribuição do INSS
      baseFgts, fgtsMes,                    // base e valor do FGTS do mês
      baseIrrfSimplificada: ir.baseIrrfSimplificada,
      aliquotaIrrf: ir.aliquota,            // faixa aplicada (ex.: 0.275)
    });
  } catch (error) {
    console.error("ERRO RH /holerite/calcular:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /rh/rescisao/calcular — calcula as verbas rescisórias SEM persistir.
// Body: { idfuncionario, ano, salariobase?, admissao?, desligamento, motivo,
//         avisoPrevio, feriasVencidas, saldoFgts }
// Devolve { proventos:[...], descontos:[...], resumo:{...} } prontos p/ o holerite.
router.post("/rescisao/calcular", async (req, res) => {
  try {
    const idempresa = req.idempresa;
    const { idfuncionario, ano } = req.body;
    if (!idempresa) return res.status(400).json({ error: "idempresa obrigatório." });
    if (!idfuncionario) return res.status(400).json({ error: "idfuncionario obrigatório." });

    const func = await pool.query(
      `SELECT f.*
       FROM funcionarios f
       JOIN funcionarioempresas fe ON fe.idfuncionario = f.idfuncionario
       WHERE f.idfuncionario = $1 AND fe.idempresa = $2`,
      [idfuncionario, idempresa]
    );
    if (func.rowCount === 0) return res.status(404).json({ error: "Funcionário não encontrado nesta empresa." });
    const f = func.rows[0];

    const params = await obterParametros(parseInt(ano, 10) || new Date().getFullYear());
    if (!params) return res.status(404).json({ error: "Parâmetros fiscais não cadastrados." });

    const resultado = calcularRescisao({
      salario: req.body.salariobase != null ? req.body.salariobase : f.salario,
      dependentes: f.dependentes,
      admissao: req.body.admissao || f.admissao,
      desligamento: req.body.desligamento,
      motivo: req.body.motivo,
      avisoPrevio: req.body.avisoPrevio,
      feriasVencidas: req.body.feriasVencidas,
      saldoFgts: req.body.saldoFgts,
    }, params);

    res.json(resultado);
  } catch (error) {
    console.error("ERRO RH /rescisao/calcular:", error);
    res.status(400).json({ error: error.message });
  }
});

// GET /rh/holerite?idfuncionario=&mes=&ano= — holerite da competência.
// Se ainda não existir, devolve um rascunho (não persistido) com o salário base atual.
router.get("/holerite", async (req, res) => {
  try {
    const idempresa = req.idempresa;
    const idfuncionario = parseInt(req.query.idfuncionario, 10);
    const mes = parseInt(req.query.mes, 10);
    const ano = parseInt(req.query.ano, 10);
    const tipo = (req.query.tipo || "mensal").toString();
    if (!idempresa) return res.status(400).json({ error: "idempresa obrigatório." });
    if (!idfuncionario || !mes || !ano) return res.status(400).json({ error: "idfuncionario, mes e ano obrigatórios." });

    const func = await pool.query(
      `SELECT f.idfuncionario, f.nome, f.salario, f.dependentes, f.funcao, f.cbo, f.admissao,
              f.valealim, f.valetrnsp
       FROM funcionarios f
       JOIN funcionarioempresas fe ON fe.idfuncionario = f.idfuncionario
       WHERE f.idfuncionario = $1 AND fe.idempresa = $2`,
      [idfuncionario, idempresa]
    );
    if (func.rowCount === 0) return res.status(404).json({ error: "Funcionário não encontrado nesta empresa." });
    const funcionario = func.rows[0];
    // Valores de VA/VT por DIA (cadastro) e dias úteis da competência (seg–sex − feriados).
    const valealimDia = Number(funcionario.valealim) || 0;
    const valetrnspDia = Number(funcionario.valetrnsp) || 0;
    const diasUteis = contarDiasUteis(ano, mes);
    // Dados do cadastro do funcionário interligados ao holerite (cabeçalho do empregado).
    const dadosFunc = {
      funcao: funcionario.funcao, cbo: funcionario.cbo,
      admissao: funcionario.admissao, dependentes: funcionario.dependentes,
      valealimDia, valetrnspDia, diasUteis,
    };

    const head = await pool.query(
      `SELECT * FROM folhaholerite
       WHERE idempresa = $1 AND idfuncionario = $2 AND mes = $3 AND ano = $4 AND COALESCE(tipo,'mensal') = $5`,
      [idempresa, idfuncionario, mes, ano, tipo]
    );

    if (head.rowCount === 0) {
      // Rascunho: salário base puxado do cadastro (funcionarios.salario), sem itens e sem persistir.
      const salariobase = Number(funcionario.salario) || 0;
      return res.json({
        holerite: {
          idholerite: null, idfuncionario, nome: funcionario.nome, mes, ano, tipo,
          salariobase, ...dadosFunc,
          status: "Pendente", dtpagamento: null, obs: null, comprovante: null,
          itens: [], ...calcularTotais(salariobase, []),
        },
      });
    }

    const h = head.rows[0];
    const itens = (await pool.query(
      `SELECT iditem, tipo, descricao, valor FROM folhaitens WHERE idholerite = $1 ORDER BY tipo, iditem`,
      [h.idholerite]
    )).rows;

    res.json({
      holerite: {
        idholerite: h.idholerite, idfuncionario, nome: funcionario.nome,
        mes: h.mes, ano: h.ano, tipo: h.tipo || "mensal", salariobase: Number(h.salariobase) || 0,
        ...dadosFunc,
        status: h.status, dtpagamento: h.dtpagamento, obs: h.obs, comprovante: h.comprovante || null,
        itens, ...calcularTotais(h.salariobase, itens),
      },
    });
  } catch (error) {
    console.error("ERRO RH /holerite:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /rh/holerite — cria/atualiza o holerite da competência e substitui seus itens.
// Body: { idfuncionario, mes, ano, salariobase, obs, itens:[{tipo:'P'|'D', descricao, valor}] }
router.post("/holerite", async (req, res) => {
  const client = await pool.connect();
  try {
    const idempresa = req.idempresa;
    const { idfuncionario, mes, ano, salariobase, obs } = req.body;
    const tipo = (req.body.tipo || "mensal").toString();
    const itens = Array.isArray(req.body.itens) ? req.body.itens : [];
    if (!idempresa) return res.status(400).json({ error: "idempresa obrigatório." });
    if (!idfuncionario || !mes || !ano) return res.status(400).json({ error: "idfuncionario, mes e ano obrigatórios." });

    // Confere vínculo com a empresa.
    const dono = await client.query(
      `SELECT 1 FROM funcionarioempresas WHERE idfuncionario = $1 AND idempresa = $2`,
      [idfuncionario, idempresa]
    );
    if (dono.rowCount === 0) return res.status(404).json({ error: "Funcionário não encontrado nesta empresa." });

    await client.query("BEGIN");

    // Upsert do cabeçalho (não mexe em status/dtpagamento já existentes).
    const up = await client.query(
      `INSERT INTO folhaholerite (idempresa, idfuncionario, mes, ano, tipo, salariobase, obs)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (idempresa, idfuncionario, mes, ano, tipo)
       DO UPDATE SET salariobase = EXCLUDED.salariobase, obs = EXCLUDED.obs
       RETURNING idholerite`,
      [idempresa, idfuncionario, mes, ano, tipo, Number(salariobase) || 0, obs || null]
    );
    const idholerite = up.rows[0].idholerite;

    // Substitui os itens.
    await client.query(`DELETE FROM folhaitens WHERE idholerite = $1`, [idholerite]);
    for (const i of itens) {
      const tipo = (i.tipo === "D" || i.tipo === "B") ? i.tipo : "P";
      const descricao = String(i.descricao || "").trim();
      if (!descricao) continue;
      await client.query(
        `INSERT INTO folhaitens (idholerite, tipo, descricao, valor) VALUES ($1,$2,$3,$4)`,
        [idholerite, tipo, descricao, Number(i.valor) || 0]
      );
    }

    await client.query("COMMIT");
    res.json({ ok: true, idholerite });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("ERRO RH POST /holerite:", error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// PUT /rh/holerite/:id/pagar — alterna o status de pagamento do holerite.
// Body: { pago: true|false }. pago=true => 'Pago' + dtpagamento (hoje); false => 'Pendente'.
router.put("/holerite/:id/pagar", async (req, res) => {
  try {
    const idempresa = req.idempresa;
    const idholerite = parseInt(req.params.id, 10);
    const pago = req.body.pago !== false; // default: marcar como pago
    if (!idempresa) return res.status(400).json({ error: "idempresa obrigatório." });
    if (!idholerite) return res.status(400).json({ error: "idholerite obrigatório." });

    // $1 = status (texto) e $2 = pago (boolean) separados: usar o mesmo $1 em "status = $1"
    // e "$1 = 'Pago'" fazia o Postgres deduzir tipos inconsistentes para o parâmetro.
    const { rowCount, rows } = await pool.query(
      `UPDATE folhaholerite
         SET status = $1,
             dtpagamento = CASE WHEN $2 THEN CURRENT_DATE ELSE NULL END
       WHERE idholerite = $3 AND idempresa = $4
       RETURNING idholerite, status, dtpagamento`,
      [pago ? "Pago" : "Pendente", pago, idholerite, idempresa]
    );
    if (rowCount === 0) return res.status(404).json({ error: "Holerite não encontrado nesta empresa." });
    res.json({ ok: true, ...rows[0] });
  } catch (error) {
    console.error("ERRO RH /holerite/:id/pagar:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /rh/holerite/:id/comprovante — anexa (ou substitui) o comprovante de pagamento.
// multipart/form-data, campo "comprovante" (imagem/PDF/JFIF, até 10MB).
router.post("/holerite/:id/comprovante", (req, res) => {
  uploadComprovanteRH(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    try {
      const idempresa = req.idempresa;
      const idholerite = parseInt(req.params.id, 10);
      if (!idempresa) return res.status(400).json({ error: "idempresa obrigatório." });
      if (!idholerite) return res.status(400).json({ error: "idholerite obrigatório." });
      if (!req.file) return res.status(400).json({ error: "Nenhum arquivo enviado." });

      // Confere que o holerite pertence à empresa e pega o comprovante antigo (p/ remover).
      const atual = await pool.query(
        `SELECT comprovante FROM folhaholerite WHERE idholerite = $1 AND idempresa = $2`,
        [idholerite, idempresa]
      );
      if (atual.rowCount === 0) {
        fs.unlink(path.join(dirComprovantesRH, req.file.filename), () => {});
        return res.status(404).json({ error: "Holerite não encontrado nesta empresa." });
      }

      // Já existe comprovante → é uma TROCA, restrita a master/dev.
      if (atual.rows[0].comprovante && !(await podeAlterarComprovante(req.usuario?.idusuario, idempresa))) {
        fs.unlink(path.join(dirComprovantesRH, req.file.filename), () => {});
        return res.status(403).json({ error: "Apenas master/dev pode trocar um comprovante já anexado." });
      }

      await pool.query(
        `UPDATE folhaholerite SET comprovante = $1 WHERE idholerite = $2 AND idempresa = $3`,
        [req.file.filename, idholerite, idempresa]
      );

      // Remove o arquivo anterior (se houver e for diferente do novo).
      const antigo = atual.rows[0].comprovante;
      if (antigo && antigo !== req.file.filename) {
        fs.unlink(path.join(dirComprovantesRH, antigo), () => {});
      }

      res.json({ ok: true, comprovante: req.file.filename, url: `/uploads/rh/comprovantes/${req.file.filename}` });
    } catch (error) {
      console.error("ERRO RH POST /holerite/:id/comprovante:", error);
      res.status(500).json({ error: error.message });
    }
  });
});

// DELETE /rh/holerite/:id/comprovante — remove o comprovante anexado (só master/dev).
router.delete("/holerite/:id/comprovante", exigirFlag("master", "devs"), async (req, res) => {
  try {
    const idempresa = req.idempresa;
    const idholerite = parseInt(req.params.id, 10);
    if (!idempresa) return res.status(400).json({ error: "idempresa obrigatório." });
    if (!idholerite) return res.status(400).json({ error: "idholerite obrigatório." });

    const atual = await pool.query(
      `SELECT comprovante FROM folhaholerite WHERE idholerite = $1 AND idempresa = $2`,
      [idholerite, idempresa]
    );
    if (atual.rowCount === 0) return res.status(404).json({ error: "Holerite não encontrado nesta empresa." });

    await pool.query(
      `UPDATE folhaholerite SET comprovante = NULL WHERE idholerite = $1 AND idempresa = $2`,
      [idholerite, idempresa]
    );
    const antigo = atual.rows[0].comprovante;
    if (antigo) fs.unlink(path.join(dirComprovantesRH, antigo), () => {});
    res.json({ ok: true });
  } catch (error) {
    console.error("ERRO RH DELETE /holerite/:id/comprovante:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /rh/resumo?mes=&ano= — folha consolidada do mês (todos os funcionários com holerite).
router.get("/resumo", async (req, res) => {
  try {
    const idempresa = req.idempresa;
    const mes = parseInt(req.query.mes, 10);
    const ano = parseInt(req.query.ano, 10);
    if (!idempresa) return res.status(400).json({ error: "idempresa obrigatório." });
    if (!mes || !ano) return res.status(400).json({ error: "mes e ano obrigatórios." });

    const { rows } = await pool.query(
      `SELECT
         h.idholerite, h.idfuncionario, f.nome, h.salariobase, h.status, h.dtpagamento,
         -- Benefícios ('B', VA/VT) são informativos: ficam fora do agregado da folha.
         COALESCE(SUM(CASE WHEN i.tipo = 'P' THEN i.valor ELSE 0 END), 0) AS proventos_itens,
         COALESCE(SUM(CASE WHEN i.tipo = 'D' THEN i.valor ELSE 0 END), 0) AS descontos
       FROM folhaholerite h
       JOIN funcionarios f ON f.idfuncionario = h.idfuncionario
       LEFT JOIN folhaitens i ON i.idholerite = h.idholerite
       WHERE h.idempresa = $1 AND h.mes = $2 AND h.ano = $3
       GROUP BY h.idholerite, f.nome
       ORDER BY f.nome ASC`,
      [idempresa, mes, ano]
    );

    const holerites = rows.map((r) => {
      const proventos = (Number(r.salariobase) || 0) + (Number(r.proventos_itens) || 0);
      const descontos = Number(r.descontos) || 0;
      return {
        idholerite: r.idholerite, idfuncionario: r.idfuncionario, nome: r.nome,
        status: r.status, dtpagamento: r.dtpagamento,
        proventos, descontos, liquido: proventos - descontos,
      };
    });

    const resumo = holerites.reduce(
      (acc, h) => {
        acc.proventos += h.proventos; acc.descontos += h.descontos; acc.liquido += h.liquido;
        if (h.status === "Pago") acc.pagos += 1; else acc.pendentes += 1;
        return acc;
      },
      { proventos: 0, descontos: 0, liquido: 0, pagos: 0, pendentes: 0, qtd: holerites.length }
    );

    res.json({ holerites, resumo, mes, ano });
  } catch (error) {
    console.error("ERRO RH /resumo:", error);
    res.status(500).json({ error: error.message });
  }
});

// Descrições dos benefícios recalculados por dias úteis na previsão (devem bater com as
// descrições usadas no front ao montar VA/VT — ver presetBeneficiosVAVT em public/js/RH.js).
const VA_DESC = "Vale-Alimentação";
const VT_DESC = "Vale-Transporte";

// GET /rh/folha?mes=&ano= — visão geral da folha do mês: TODOS os funcionários de salário
// fixo (Interno/Externo) da empresa. Quem já tem holerite mensal no mês entra com valores
// reais; quem não tem entra com uma PREVISÃO (não persistida): réplica do último holerite,
// recalculando VA/VT pelos dias úteis do mês selecionado. Sem histórico, calcula do zero
// (salário base + VA/VT por dias úteis + INSS/IRRF). Benefícios (B, VA/VT) ficam fora do
// líquido, igual ao /resumo.
router.get("/folha", async (req, res) => {
  try {
    const idempresa = req.idempresa;
    const mes = parseInt(req.query.mes, 10);
    const ano = parseInt(req.query.ano, 10);
    if (!idempresa) return res.status(400).json({ error: "idempresa obrigatório." });
    if (!mes || !ano) return res.status(400).json({ error: "mes e ano obrigatórios." });

    const params = await obterParametros(ano);
    const diasUteis = contarDiasUteis(ano, mes);

    const funcs = (await pool.query(
      `SELECT f.idfuncionario, f.nome, f.salario, f.dependentes, f.valealim, f.valetrnsp
         FROM funcionarios f
         JOIN funcionarioempresas fe ON fe.idfuncionario = f.idfuncionario
        WHERE fe.idempresa = $1
          AND f.perfil = ANY($2)
          AND COALESCE(f.ativo, true) = true
        ORDER BY f.nome ASC`,
      [idempresa, PERFIS_FOLHA]
    )).rows;

    const linhas = [];
    for (const f of funcs) {
      const salariobase = Number(f.salario) || 0;

      // 1) Já existe holerite mensal salvo neste mês? -> valores reais.
      const head = (await pool.query(
        `SELECT idholerite, status, dtpagamento FROM folhaholerite
          WHERE idempresa = $1 AND idfuncionario = $2 AND mes = $3 AND ano = $4
            AND COALESCE(tipo,'mensal') = 'mensal'`,
        [idempresa, f.idfuncionario, mes, ano]
      )).rows[0];

      if (head) {
        const itens = (await pool.query(
          `SELECT tipo, descricao, valor FROM folhaitens WHERE idholerite = $1`,
          [head.idholerite]
        )).rows;
        const t = calcularTotais(salariobase, itens);
        linhas.push({
          idfuncionario: f.idfuncionario, nome: f.nome, idholerite: head.idholerite,
          origem: "real", status: head.status, dtpagamento: head.dtpagamento,
          proventos: t.proventos, descontos: t.descontos, beneficios: t.beneficios, liquido: t.liquido,
        });
        continue;
      }

      // 2) Sem holerite no mês -> PREVISÃO. VA/VT pelos dias úteis do mês selecionado.
      const va = Math.round((Number(f.valealim) || 0) * diasUteis * 100) / 100;
      const vt = Math.round((Number(f.valetrnsp) || 0) * diasUteis * 100) / 100;

      // Último holerite mensal anterior (réplica das verbas).
      const ant = (await pool.query(
        `SELECT idholerite FROM folhaholerite
          WHERE idempresa = $1 AND idfuncionario = $2 AND COALESCE(tipo,'mensal') = 'mensal'
            AND (ano < $3 OR (ano = $3 AND mes < $4))
          ORDER BY ano DESC, mes DESC LIMIT 1`,
        [idempresa, f.idfuncionario, ano, mes]
      )).rows[0];

      let itens;
      if (ant) {
        // Replica os itens do mês anterior; recalcula só VA/VT pelos dias úteis do mês atual.
        itens = (await pool.query(
          `SELECT tipo, descricao, valor FROM folhaitens WHERE idholerite = $1`,
          [ant.idholerite]
        )).rows.map((i) => {
          if (i.tipo === "B" && i.descricao === VA_DESC) return { ...i, valor: va };
          if (i.tipo === "B" && i.descricao === VT_DESC) return { ...i, valor: vt };
          return i;
        });
      } else {
        // Sem histórico: monta do zero (VA/VT + INSS/IRRF sobre o salário base).
        const inss = calcularINSS(salariobase, params);
        const ir = calcularIRRF(salariobase, inss, f.dependentes, params);
        itens = [
          { tipo: "B", descricao: VA_DESC, valor: va },
          { tipo: "B", descricao: VT_DESC, valor: vt },
          { tipo: "D", descricao: "INSS", valor: inss },
          { tipo: "D", descricao: "IRRF", valor: ir.irrf },
        ];
      }

      const t = calcularTotais(salariobase, itens);
      linhas.push({
        idfuncionario: f.idfuncionario, nome: f.nome, idholerite: null,
        origem: "previsao", status: "Previsão", dtpagamento: null,
        proventos: t.proventos, descontos: t.descontos, beneficios: t.beneficios, liquido: t.liquido,
      });
    }

    const totais = linhas.reduce(
      (acc, l) => {
        acc.proventos += l.proventos; acc.descontos += l.descontos; acc.liquido += l.liquido;
        if (l.origem === "real") { if (l.status === "Pago") acc.pagos += 1; else acc.pendentes += 1; }
        else acc.previsoes += 1;
        return acc;
      },
      { proventos: 0, descontos: 0, liquido: 0, pagos: 0, pendentes: 0, previsoes: 0, qtd: linhas.length }
    );

    res.json({ linhas, totais, mes, ano, diasUteis });
  } catch (error) {
    console.error("ERRO RH /folha:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
