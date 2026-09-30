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

// Quem tem "rh" (sem master/supremo) abre, edita e salva o holerite individual, calcula
// INSS/IRRF/rescisão e programa férias — decisão de 2026-09-28 (antes ficava só na lista). O
// router mount (server.js) já libera rh/master/supremo pro módulo todo.
// Continua só com Master/Supremo (`apenasMaster`): MARCAR COMO PAGO (ato financeiro) e toda a
// Folha de Proventos à parte (bônus, prêmio, PLR) — o RH nem enxerga que ela existe.
const apenasMaster = exigirFlag("master", "supremo");

// Mesmo critério de apenasMaster, mas como pergunta (pra rotas liberadas ao RH que só mostram
// ou gravam os proventos à parte quando quem chama é Master/Supremo).
async function ehMasterOuSupremo(req) {
  const idusuario = req.usuario?.idusuario;
  if (!idusuario || !req.idempresa) return false;
  const { rowCount } = await pool.query(
    `SELECT 1 FROM permissoes WHERE idusuario = $1 AND idempresa = $2 AND (master = true OR supremo = true) LIMIT 1`,
    [idusuario, req.idempresa]
  );
  return rowCount > 0;
}

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
    // Data + hora LOCAL no lugar do timestamp cru: mesmo padrão dos demais comprovantes
    // do sistema, legível e ainda único por segundo (o id do holerite já entra no nome).
    const agora = new Date();
    const p2 = n => String(n).padStart(2, "0");
    const dataHoje = `${agora.getFullYear()}${p2(agora.getMonth() + 1)}${p2(agora.getDate())}`;
    const horaAgora = `${p2(agora.getHours())}${p2(agora.getMinutes())}${p2(agora.getSeconds())}`;
    cb(null, `comprovanterh-ID${id}-${dataHoje}-${horaAgora}-${nomeLimpo}${ext}`);
  },
});

// Aceita imagens (image/*, cobre JFIF que os navegadores enviam como image/jpeg)
// e PDFs. Rejeita o resto com mensagem clara.
const fileFilterComprovanteRH = (req, file, cb) => {
  if (file.mimetype.startsWith("image/") || file.mimetype === "application/pdf") {
    cb(null, true);
  } else {
    const ext = path.extname(file.originalname || "").toLowerCase();
    cb(new Error(`Formato "${ext || file.mimetype}" não permitido. Envie uma imagem (JPG, PNG, JFIF) ou PDF.`), false);
  }
};

const uploadComprovanteRH = multer({
  storage: storageComprovanteRH,
  fileFilter: fileFilterComprovanteRH,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
}).single("comprovante");

// Perfis considerados "salário fixo" (entram na folha).
const PERFIS_FOLHA = ["Interno", "InternoH", "ExternoH"];

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

// Parâmetros fiscais por ano, lidos da tabela `aliquotas`.
//
// Faixas de INSS/IRRF NÃO têm fórmula: são definidas por lei/portaria a cada ano, então não dá
// pra "calcular" 2028 a partir de 2026 — o que dá é nunca mais precisar MEXER NO CÓDIGO por
// virada de ano. Por isso a busca é "o ano mais recente já cadastrado que não seja maior que o
// pedido" (ORDER BY ano DESC LIMIT 1) em vez de igualdade: enquanto a tabela do ano novo não
// sai (costuma ser publicada em dez/jan), a folha segue rodando com a última vigente — que é
// exatamente o que o RH faria na mão — e no minuto em que alguém cadastrar o ano novo por
// PUT /rh/parametros/:ano, todo mundo passa a usar sozinho, sem deploy.
//
// PARAMS_2026 continua como último recurso, pra base sem NENHUM ano cadastrado (ou tabela
// ausente): é melhor calcular com uma tabela velha e avisar do que devolver erro e travar a
// folha inteira. `origemAno` volta junto pra quem quiser exibir de que ano é a tabela usada.
async function obterParametros(ano) {
  const a = parseInt(ano, 10) || new Date().getFullYear();
  try {
    const { rows } = await pool.query(
      `SELECT ano, inssfaixas, irrffaixas, irrfdeducaodependente,
              irrfdescontosimplificado, irrfredutor, fgtsaliquota
       FROM aliquotas WHERE ano <= $1 ORDER BY ano DESC LIMIT 1`,
      [a]
    );
    if (rows.length) {
      const r = rows[0];
      if (r.ano !== a) {
        console.warn(`RH: sem parâmetros fiscais de ${a} em aliquotas; usando a tabela de ${r.ano} (última vigente).`);
      }
      // Colunas JSONB já voltam como objeto/array; NUMERIC volta como string → Number().
      return {
        origemAno: r.ano,
        inss_faixas: r.inssfaixas,
        irrf_faixas: r.irrffaixas,
        irrf_deducao_dependente: Number(r.irrfdeducaodependente),
        irrf_desconto_simplificado: Number(r.irrfdescontosimplificado),
        irrf_redutor: r.irrfredutor,
        fgts_aliquota: Number(r.fgtsaliquota),
      };
    }
    console.warn(`RH: nenhum ano <= ${a} cadastrado em aliquotas; usando fallback embutido de 2026.`);
  } catch (err) {
    console.error("RH: erro ao ler aliquotas (usando fallback embutido de 2026):", err.message);
  }
  return { origemAno: 2026, ...PARAMS_2026 };
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

// 'Interno' participa da folha (salário, VA/VT, 13º, férias) mas sem retenção de INSS/IRRF —
// só 'InternoH' e 'ExternoH' têm holerite completo com desconto de imposto (ver PERFIS_FOLHA).
function perfilTemImposto(perfil) {
  return perfil !== "Interno";
}

// Calcula os totais de um holerite a partir do salário base + itens.
// Itens: 'P' = provento tributável, 'B' = benefício não-tributável (VA/VT — fora da
// base de impostos e, por padrão, fora do líquido), 'D' = desconto.
// No 13º (tipo === "13"), "salariobase" é só a referência do cadastro (mostrada/editável na
// tela, inclusive salva de volta no cadastro do funcionário) — o valor da parcela já vem
// inteiro nos itens (preset13). Somar a referência ao total duplicaria o valor pago.
function calcularTotais(salariobase, itens, tipo) {
  const base = Number(salariobase) || 0;
  // 13º e recibo de férias trazem o valor inteiro nos itens — o salário base é só referência
  // (somar ele de novo pagaria em dobro).
  let proventos = (tipo === "13" || tipo === "ferias") ? 0 : base; // salário + proventos tributáveis (P)
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

// Extrai {y,m,d} de uma data vinda do banco (Date) ou string 'YYYY-MM-DD',
// sem depender de fuso (evita o típico off-by-one de new Date('YYYY-MM-DD')).
function partesData(v) {
  if (!v) return null;
  const s = String(v.toISOString ? v.toISOString() : v).slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return { y: +m[1], m: +m[2] - 1, d: +m[3] };
}

// Idade (anos completos) de 'nascimento' na data de referência {y,m,d}.
function idadeEmParts(nascimento, ref) {
  const n = partesData(nascimento);
  if (!n || !ref) return null;
  let idade = ref.y - n.y;
  if (ref.m < n.m || (ref.m === n.m && ref.d < n.d)) idade--;
  return Math.max(0, idade);
}

// Percentual do plano do TITULAR custeado pela empresa (o funcionário paga o resto).
// Dependentes são cobrados integralmente do funcionário.
const PLANO_EMPRESA_PCT_TITULAR = 0.40;

// Desconto de plano de saúde: soma a parte do FUNCIONÁRIO da faixa etária do titular
// (empresa paga 40%, funcionário 60%) + o valor CHEIO de cada dependente.
// Cada item traz valorFaixa (cheio), parteEmpresa e valor (o que o funcionário paga).
function calcularPlanoSaude(funcionario, faixas, ref) {
  if (!Array.isArray(faixas) || !faixas.length) return { total: 0, itens: [] };
  const valorDaFaixa = (idade) => {
    if (idade == null) return null;
    const f = faixas.find((fx) =>
      (fx.de == null || idade >= fx.de) && (fx.ate == null || idade <= fx.ate));
    return f ? (Number(f.valor) || 0) : null;
  };

  const itens = [];
  const idadeTit = idadeEmParts(funcionario.datanascimento, ref);
  const vTit = valorDaFaixa(idadeTit);
  if (vTit != null) {
    const parteEmpresa = round2(vTit * PLANO_EMPRESA_PCT_TITULAR);
    const parteFunc = round2(vTit - parteEmpresa);
    itens.push({
      nome: `${funcionario.nome} (titular)`, idade: idadeTit, titular: true,
      valorFaixa: vTit, parteEmpresa, valor: parteFunc,
    });
  }

  let deps = funcionario.dependentesdados;
  if (typeof deps === "string") { try { deps = JSON.parse(deps); } catch { deps = []; } }
  (Array.isArray(deps) ? deps : []).forEach((dep) => {
    const idade = idadeEmParts(dep.nascimento, ref);
    const v = valorDaFaixa(idade);
    if (v != null) itens.push({
      nome: dep.nome || "Dependente", idade, titular: false,
      valorFaixa: v, parteEmpresa: 0, valor: v,
    });
  });

  const total = round2(itens.reduce((s, i) => s + i.valor, 0));
  return { total, itens, empresaPctTitular: PLANO_EMPRESA_PCT_TITULAR };
}

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
  const temImposto = perfilTemImposto(input.perfil);

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
  const inssMensal = baseMensal > 0 && temImposto ? calcularINSS(baseMensal, params) : 0;
  const irMensal = baseMensal > 0 && temImposto ? calcularIRRF(baseMensal, inssMensal, dependentes, params) : { irrf: 0 };
  if (inssMensal > 0) descontos.push({ descricao: "INSS", valor: inssMensal });
  if (irMensal.irrf > 0) descontos.push({ descricao: "IRRF", valor: irMensal.irrf });

  // 13º: base separada (INSS e IRRF próprios).
  const inss13 = valor13 > 0 && temImposto ? calcularINSS(valor13, params) : 0;
  const ir13 = valor13 > 0 && temImposto ? calcularIRRF(valor13, inss13, dependentes, params) : { irrf: 0 };
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

// O mês/ano escolhido na tela (dropdown "Mês") é o VENCIMENTO — quando o salário é pago —,
// não o mês trabalhado: por decisão do financeiro (2026-09), quem trabalha em Agosto recebe
// em Setembro. Por isso dias úteis/VA/VT/INSS/IRRF do holerite MENSAL usam o mês ANTERIOR ao
// selecionado; o que fica gravado em folhaholerite.mes/ano continua sendo o vencimento (não
// muda o schema nem holerites já existentes — só a conta feita a partir de hoje em diante).
function competenciaAnterior(mesVencimento, anoVencimento) {
  return mesVencimento === 1
    ? { mes: 12, ano: anoVencimento - 1 }
    : { mes: mesVencimento - 1, ano: anoVencimento };
}

// Primeiro VENCIMENTO que a folha do sistema considera (decisão do RH, 2026-09): antes disso a
// folha não rodava por aqui, então os holerites pré-gerados de jan–jul/2026 não são dívida nem
// histórico real — não podem aparecer como vencidos em Contas a Pagar nem somar no CEO Mode.
// Eles continuam no banco (com o conferido=true herdado das migrations de 2026-09-25); só são
// IGNORADOS: não geram (garantirHolerite*), não aparecem (GET /folha, /contas-pagar) e não somam
// (rotaCeo.js, via SQL_FOLHA_A_PARTIR_DO_INICIO). Mudar o corte é só mudar esta constante.
const INICIO_FOLHA = { ano: 2026, mes: 8 };

function antesDoInicioFolha(mes, ano) {
  return ano < INICIO_FOLHA.ano || (ano === INICIO_FOLHA.ano && mes < INICIO_FOLHA.mes);
}

// Mesmo corte em SQL, pra consultas que agregam folhaholerite direto (alias `h`).
const SQL_FOLHA_A_PARTIR_DO_INICIO =
  `(h.ano > ${INICIO_FOLHA.ano} OR (h.ano = ${INICIO_FOLHA.ano} AND h.mes >= ${INICIO_FOLHA.mes}))`;

// Dias de benefício (VA/VT) do mês: TODOS os dias de segunda a sexta, SEM descontar feriado
// — regra do RH (2026-09): o crédito de VA/VT acompanha o calendário útil do mês, e um feriado
// no meio da semana não tira o dia do funcionário. Ex.: setembro/2026 são 22 dias, mesmo com a
// Independência (7/9) caindo numa segunda; antes a conta devolvia 21 e o VA/VT saía um dia a
// menos. Não confundir com ultimoDiaUtil(), que é data de PAGAMENTO e continua pulando feriado
// (banco fechado não compensa boleto).
function contarDiasBeneficio(ano, mes) {
  const ultimoDia = new Date(ano, mes, 0).getDate();
  let dias = 0;
  for (let d = 1; d <= ultimoDia; d++) {
    const dow = new Date(ano, mes - 1, d).getDay(); // 0=domingo, 6=sábado
    if (dow === 0 || dow === 6) continue;
    dias++;
  }
  return dias;
}

// Vencimento dos BENEFÍCIOS (VA/VT) — último dia útil do próprio mês vigente (sem defasagem,
// diferente do salário que vence dia 5 do mês seguinte): VT via bilhete único depende de
// boleto/compensação (por isso é programado uns dias antes, mas o alvo é entrar até o último
// dia útil); VA/VC via PIX/cartão ticket é rápido e cabe no mesmo prazo.
function ultimoDiaUtil(ano, mes) {
  const feriados = feriadosDoAno(ano);
  const ultimoDia = new Date(ano, mes, 0).getDate();
  for (let d = ultimoDia; d >= 1; d--) {
    const data = new Date(ano, mes - 1, d);
    const dow = data.getDay();
    if (dow === 0 || dow === 6) continue;
    const isoDia = `${ano}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (feriados.has(isoDia)) continue;
    return d;
  }
  return ultimoDia;
}



// GET /rh/funcionarios — funcionários de salário fixo (perfil Interno/Externo) da empresa.
router.get("/funcionarios", async (req, res) => {
  try {
    const idempresa = req.idempresa;
    if (!idempresa) return res.status(400).json({ error: "idempresa obrigatório." });

    const { rows } = await pool.query(
      `SELECT f.idfuncionario, f.nome, fe.perfil, fe.funcao, fe.cbo, fe.admissao, fe.salario, fe.dependentes
       FROM funcionarios f
       JOIN funcionarioempresas fe ON fe.idfuncionario = f.idfuncionario
       WHERE fe.idempresa = $1
         AND fe.perfil = ANY($2)
         AND COALESCE(fe.ativo, true) = true
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
// PUT /rh/funcionario/:id/salario — grava no CADASTRO do funcionário (funcionarioempresas),
// não numa competência específica: salário/dependentes já salvavam aqui; valealim/valetrnsp
// (valor/dia de VA/VT) entraram junto porque não existia nenhum jeito de corrigi-los "pra
// sempre" a partir do holerite — só editando o total de um mês, que não voltava pro cadastro.
router.put("/funcionario/:id/salario", async (req, res) => {
  try {
    const idempresa = req.idempresa;
    const idfuncionario = parseInt(req.params.id, 10);
    const salariobase = Number(req.body.salariobase ?? req.body.salario) || 0;
    const dependentes = parseInt(req.body.dependentes, 10) || 0;
    const valealim = Number(req.body.valealim) || 0;
    const valetrnsp = Number(req.body.valetrnsp) || 0;
    if (!idempresa) return res.status(400).json({ error: "idempresa obrigatório." });
    if (!idfuncionario) return res.status(400).json({ error: "idfuncionario obrigatório." });

    // Confere que o funcionário pertence à empresa antes de alterar.
    const dono = await pool.query(
      `SELECT 1 FROM funcionarioempresas WHERE idfuncionario = $1 AND idempresa = $2`,
      [idfuncionario, idempresa]
    );
    if (dono.rowCount === 0) return res.status(400).json({ error: "Funcionário não encontrado nesta empresa." });

    await pool.query(
      `UPDATE funcionarioempresas SET salario = $1, dependentes = $2, valealim = $3, valetrnsp = $4
        WHERE idfuncionario = $5 AND idempresa = $6`,
      [salariobase, dependentes, valealim, valetrnsp, idfuncionario, idempresa]
    );
    res.json({ ok: true, salariobase, dependentes, valealim, valetrnsp });
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
      `SELECT f.idfuncionario, f.nome, fe.dependentes, fe.perfil
       FROM funcionarios f
       JOIN funcionarioempresas fe ON fe.idfuncionario = f.idfuncionario
       WHERE f.idfuncionario = $1 AND fe.idempresa = $2`,
      [idfuncionario, idempresa]
    );
    if (func.rowCount === 0) return res.status(404).json({ error: "Funcionário não encontrado nesta empresa." });
    const dependentes = func.rows[0].dependentes;
    const perfilFuncionario = func.rows[0].perfil;

    const params = await obterParametros(parseInt(ano, 10) || new Date().getFullYear());
    if (!params) return res.status(404).json({ error: "Parâmetros fiscais não cadastrados." });

    // Bruto = salário base + proventos (linhas 'P'). Descontos não entram na base.
    const base = Number(salariobase) || 0;
    const proventos = itens.filter((i) => i.tipo === "P").reduce((s, i) => s + (Number(i.valor) || 0), 0);
    const bruto = base + proventos;

    const temImposto = perfilTemImposto(perfilFuncionario);
    const inss = temImposto ? calcularINSS(bruto, params) : 0;
    const ir = temImposto ? calcularIRRF(bruto, inss, dependentes, params) : { irrf: 0, baseIrrf: 0, baseIrrfSimplificada: 0, aliquota: 0 };

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
      `SELECT f.idfuncionario, f.nome, fe.salario, fe.dependentes, fe.admissao, fe.perfil
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
      perfil: f.perfil,
    }, params);

    res.json(resultado);
  } catch (error) {
    console.error("ERRO RH /rescisao/calcular:", error);
    res.status(400).json({ error: error.message });
  }
});

// O booleano `conferido` sozinho NÃO prova que alguém conferiu a competência: a migration
// 20260904_150000 criou a coluna com DEFAULT true (pra não sumir holerite antigo de Contas a
// Pagar) e, com isso, marcou como "conferida" a base inteira que já existia. Quem confere de
// verdade passa por PUT /holerite/:id/conferir, que grava conferido_em/conferido_por JUNTO com
// o flag — então é o carimbo, não o boolean, que diz se o snapshot (folhaholerite.salariobase)
// vale mais que o cadastro atual. Sem essa distinção, um holerite pré-gerado antes de o
// salário existir ficava preso em 0: o cadastro nunca chegava na tela, porque conferido=true
// mandava usar o snapshot zerado (e o backfill da migration 20260925_120000, sendo tiro único,
// não alcança salário cadastrado depois que ela rodou).
//
// Usar SÓ pra escolher entre snapshot e cadastro. O `conferido` devolvido nas respostas
// continua sendo o da coluna, porque GET /contas-pagar (routes/rotaMain.js) decide com ele se a
// linha entra como "real" ou "previsão" — mudar isso tiraria lançamentos reais de Vencimentos.
function conferidoDeFato(h) {
  return Boolean(h && h.conferido && h.conferido_em);
}

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
      `SELECT f.idfuncionario, f.nome, fe.salario, fe.dependentes, fe.funcao, fe.cbo, fe.admissao,
              fe.valealim, fe.valetrnsp, f.datanascimento, fe.dependentesdados,
              fe.adesaoplanosaude, f.idtipoplanosaude, fe.perfil
       FROM funcionarios f
       JOIN funcionarioempresas fe ON fe.idfuncionario = f.idfuncionario
       WHERE f.idfuncionario = $1 AND fe.idempresa = $2`,
      [idfuncionario, idempresa]
    );
    if (func.rowCount === 0) return res.status(404).json({ error: "Funcionário não encontrado nesta empresa." });
    const funcionario = func.rows[0];
    // Valores de VA/VT por DIA (cadastro) e dias de benefício do mês VIGENTE (seg–sex, feriado
    // NÃO desconta — ver contarDiasBeneficio) —
    // benefício é "trabalha e recebe" no mesmo mês (sem defasagem), diferente do salário, que é
    // "trabalha num mês e recebe no seguinte" (ver competenciaAnterior, usada só pra saber em
    // qual mês/ano o salário foi trabalhado e qual tabela de INSS/IRRF vale).
    const valealimDia = Number(funcionario.valealim) || 0;
    const valetrnspDia = Number(funcionario.valetrnsp) || 0;
    // Mensal: férias programadas tiram dias do VA/VT (mês vigente) e do salário (mês trabalhado)
    // — ver ajusteFeriasMensal. Os dias úteis já saem ajustados pra tela abrir com o VA/VT certo.
    const ajusteFerias = tipo === "mensal"
      ? await ajusteFeriasMensal(idempresa, idfuncionario, mes, ano)
      : { diasFerias: 0, diasUteisFerias: 0 };
    const diasUteis = diasUteisSemFerias(contarDiasBeneficio(ano, mes), ajusteFerias);
    const competencia = tipo === "mensal" ? competenciaAnterior(mes, ano) : { mes, ano };

    // Plano de saúde: desconto por faixa etária (titular + dependentes) na competência.
    let planoSaude = { total: 0, itens: [] };
    if (funcionario.adesaoplanosaude && funcionario.idtipoplanosaude) {
      const faixas = (await pool.query(
        `SELECT de, ate, valor FROM faixasplanosaude WHERE idtipoplanosaude = $1 ORDER BY de NULLS FIRST`,
        [funcionario.idtipoplanosaude]
      )).rows;
      const ref = { y: ano, m: mes - 1, d: new Date(ano, mes, 0).getDate() }; // último dia da competência
      planoSaude = calcularPlanoSaude(funcionario, faixas, ref);
    }

    // Dados do cadastro do funcionário interligados ao holerite (cabeçalho do empregado).
    const dadosFunc = {
      funcao: funcionario.funcao, cbo: funcionario.cbo,
      admissao: funcionario.admissao, dependentes: funcionario.dependentes,
      valealimDia, valetrnspDia, diasUteis, planoSaude,
      competenciaMes: competencia.mes, competenciaAno: competencia.ano,
    };

    const head = await pool.query(
      `SELECT * FROM folhaholerite
       WHERE idempresa = $1 AND idfuncionario = $2 AND mes = $3 AND ano = $4 AND COALESCE(tipo,'mensal') = $5`,
      [idempresa, idfuncionario, mes, ano, tipo]
    );

    if (head.rowCount === 0) {
      // Rascunho: salário base puxado do cadastro (funcionarios.salario), sem persistir.
      const salariobase = Number(funcionario.salario) || 0;
      // 13º: mesmo preset que garantirHolerite13 vai persistir quando a data chegar (parcela
      // pelo mês: 11=1ª, 12=2ª), incluindo INSS/IRRF da 2ª parcela — pra quem abre a aba
      // manualmente no RH antes da geração automática já ver o valor certo, não um provisório.
      let itensRascunho = [];
      if (tipo === "13") {
        const s = salariobase;
        if (mes === 11) {
          itensRascunho = [{ tipo: "P", descricao: "13º salário (1ª parcela)", valor: s / 2 }];
        } else {
          itensRascunho = [
            { tipo: "P", descricao: "13º salário", valor: s },
            { tipo: "D", descricao: "Adiantamento 1ª parcela", valor: s / 2 },
          ];
          const params = await obterParametros(ano);
          if (perfilTemImposto(funcionario.perfil)) {
            const inss = calcularINSS(s, params);
            const ir = calcularIRRF(s, inss, funcionario.dependentes, params);
            if (inss > 0) itensRascunho.push({ tipo: "D", descricao: "INSS", valor: inss });
            if (ir.irrf > 0) itensRascunho.push({ tipo: "D", descricao: "IRRF", valor: ir.irrf });
          }
        }
      }
      return res.json({
        holerite: {
          idholerite: null, idfuncionario, nome: funcionario.nome, mes, ano, tipo,
          salariobase, ...dadosFunc,
          status: "Pendente", dtpagamento: null, obs: null, comprovante: null,
          itens: itensRascunho, ...calcularTotais(salariobase, itensRascunho, tipo),
          proventosParte: tipo === "mensal" && await ehMasterOuSupremo(req)
            ? await listarProventosParte(idempresa, { idfuncionario, mes, ano }) : [],
        },
      });
    }

    const h = head.rows[0];
    const itens = (await pool.query(
      `SELECT iditem, tipo, descricao, valor FROM folhaitens WHERE idholerite = $1 ORDER BY tipo, iditem`,
      [h.idholerite]
    )).rows;

    // Mesma regra de rascunho usada por computarLinhaFolha (tela de Folha/Vencimentos): enquanto
    // NÃO conferido, o salário base vem do cadastro atual (funcionarioempresas.salario), não do
    // que ficou gravado no holerite. Sem isso, um holerite pré-gerado automaticamente
    // (garantirHoleriteMensal/garantirHolerite13, que nascem com o salário de quando rodaram —
    // 0 pra quem ainda não tinha salário cadastrado) ficava preso nesse valor: cadastrar/corrigir
    // o salário do funcionário não refletia nunca na tela do holerite. Depois de conferido, usa
    // o snapshot congelado (h.salariobase), gravado por PUT /holerite/:id/conferir.
    // "Conferido" aqui é o carimbo, não o flag — ver conferidoDeFato acima.
    const salariobase = conferidoDeFato(h)
      ? Number(h.salariobase) || 0
      : Number(funcionario.salario) || 0;

    // Rascunho (não conferido de fato) e mensal: os itens AUTOMÁTICOS também são recalculados
    // do cadastro na leitura — VA/VT por dias de benefício do mês e INSS/IRRF sobre o salário.
    // Esta rota era a única das três que ainda devolvia o que estava gravado em folhaitens: a
    // lista (computarLinhaFolha) já remonta ao vivo e o PUT /conferir regrava na hora de
    // fechar, então a tela individual mostrava outro número que as outras duas — VA/VT com a
    // contagem de dias de quando o holerite foi pré-gerado, e INSS/IRRF de um salário que na
    // época ainda era 0.
    //
    // A troca é item a item, casando pela descrição, e NÃO um montarItensDoZero substituindo a
    // lista inteira: o que foi lançado à mão (plano de saúde, adiantamento, bonificação...)
    // continua intacto. Depois de conferido, nada aqui roda — vale o snapshot.
    if (!conferidoDeFato(h) && (h.tipo || "mensal") === "mensal") {
      const paramsComp = await obterParametros(competencia.ano);
      const proventosManuais = itens
        .filter((i) => i.tipo === "P" && !DESCRICOES_AUTOMATICAS.has(i.descricao))
        .reduce((s, i) => s + (Number(i.valor) || 0), 0);
      const automaticos = montarItensDoZero(funcionario, paramsComp, diasUteis, proventosManuais, ajusteFerias.diasFerias);
      const pendentes = new Map(automaticos.map((i) => [i.descricao, i]));
      // Desconto de dias de férias gravado de uma programação que foi cancelada depois: não
      // é mais gerado, então sai (os outros automáticos sempre são gerados).
      if (!pendentes.has(FERIAS_MES_DESC)) {
        for (let k = itens.length - 1; k >= 0; k--) if (itens[k].descricao === FERIAS_MES_DESC) itens.splice(k, 1);
      }
      itens.forEach((item) => {
        const auto = pendentes.get(item.descricao);
        if (!auto) return;
        item.valor = auto.valor;
        pendentes.delete(item.descricao);
      });
      // Item automático que nem existia no holerite gravado (ex.: pré-gerado antes de o
      // funcionário ter VA/VT cadastrado) entra agora, senão a tela some com a linha.
      pendentes.forEach((auto) => itens.push({ iditem: null, ...auto }));
    }

    res.json({
      holerite: {
        idholerite: h.idholerite, idfuncionario, nome: funcionario.nome,
        mes: h.mes, ano: h.ano, tipo: h.tipo || "mensal", salariobase,
        ...dadosFunc,
        status: h.status, dtpagamento: h.dtpagamento, obs: h.obs, comprovante: h.comprovante || null,
        itens, ...calcularTotais(salariobase, itens, h.tipo),
        // Só Master/Supremo recebem — pro RH o holerite chega sem nenhum sinal deles.
        proventosParte: (h.tipo || "mensal") === "mensal" && await ehMasterOuSupremo(req)
          ? await listarProventosParte(idempresa, { idfuncionario, mes: h.mes, ano: h.ano })
          : [],
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

    // Upsert do cabeçalho (não mexe em status/dtpagamento já existentes). Qualquer edição
    // desfaz uma conferência anterior (rh-panel > lista > "Conferir") — o financeiro só deve
    // enxergar valores que já refletem o que foi de fato salvo por último.
    const up = await client.query(
      `INSERT INTO folhaholerite (idempresa, idfuncionario, mes, ano, tipo, salariobase, obs)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (idempresa, idfuncionario, mes, ano, tipo)
       DO UPDATE SET salariobase = EXCLUDED.salariobase, obs = EXCLUDED.obs,
                      conferido = false, conferido_em = NULL, conferido_por = NULL,
                      conferido_beneficios = false, conferido_beneficios_em = NULL, conferido_beneficios_por = NULL
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

    // Proventos pagos À PARTE do holerite (bônus, prêmio, PLR...) — tabela própria
    // (folhaproventos), fora de toda soma de folhaitens. Só existem no holerite MENSAL. Substitui
    // os ainda editáveis da competência; os já conferidos ou pagos ficam como estão (o front nem
    // os manda — aparecem travados na tela).
    // Só Master/Supremo mexem aqui: o RH salva o holerite sem mandar o campo, e mesmo que mande,
    // não pode apagar/regravar o que ele nem enxerga.
    if (tipo === "mensal" && Array.isArray(req.body.proventosParte) && await ehMasterOuSupremo(req)) {
      await client.query(
        `DELETE FROM folhaproventos
          WHERE idempresa = $1 AND idfuncionario = $2 AND mes = $3 AND ano = $4
            AND conferido = false AND status <> 'Pago'`,
        [idempresa, idfuncionario, mes, ano]
      );
      for (const p of req.body.proventosParte) {
        const descricao = String(p.descricao || "").trim();
        const valor = Number(p.valor) || 0;
        if (!descricao || valor <= 0) continue;
        await client.query(
          `INSERT INTO folhaproventos (idempresa, idfuncionario, mes, ano, descricao, valor, idusuariolancamento)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [idempresa, idfuncionario, mes, ano, descricao, valor, req.usuario?.idusuario || null]
        );
      }
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
router.put("/holerite/:id/pagar", apenasMaster, async (req, res) => {
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

// PUT /rh/holerite/:id/pagar-beneficios — mesma ideia do /pagar, mas separada porque
// benefícios (VA/VT) são pagos em data e por meio diferente do salário (boleto/pix, não é o
// pagamento em conta corrente do salário) — status_beneficios/dtpagamento_beneficios são
// colunas próprias, sem afetar status/dtpagamento (que continuam sendo só do salário).
router.put("/holerite/:id/pagar-beneficios", apenasMaster, async (req, res) => {
  try {
    const idempresa = req.idempresa;
    const idholerite = parseInt(req.params.id, 10);
    const pago = req.body.pago !== false; // default: marcar como pago
    if (!idempresa) return res.status(400).json({ error: "idempresa obrigatório." });
    if (!idholerite) return res.status(400).json({ error: "idholerite obrigatório." });

    const { rowCount, rows } = await pool.query(
      `UPDATE folhaholerite
         SET status_beneficios = $1,
             dtpagamento_beneficios = CASE WHEN $2 THEN CURRENT_DATE ELSE NULL END
       WHERE idholerite = $3 AND idempresa = $4
       RETURNING idholerite, status_beneficios, dtpagamento_beneficios`,
      [pago ? "Pago" : "Pendente", pago, idholerite, idempresa]
    );
    if (rowCount === 0) return res.status(404).json({ error: "Holerite não encontrado nesta empresa." });
    res.json({ ok: true, ...rows[0] });
  } catch (error) {
    console.error("ERRO RH /holerite/:id/pagar-beneficios:", error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /rh/holerite/:id/conferir — marca (ou desfaz) a conferência mensal, direto pela LISTA
// (rh-folha), sem precisar abrir a tela individual. Enquanto não conferido, o holerite não
// entra em Financeiro > Contas a Pagar (ver GET /contas-pagar em rotaMain.js) — é o jeito de
// quem só tem acesso à lista (ex.: Master) aprovar a competência antes dela virar conta a
// pagar de verdade. Qualquer edição no holerite (POST /holerite) desfaz essa marca de novo.
// Body: { conferido: true|false }. conferido=true => grava quem/quando; false => limpa.
router.put("/holerite/:id/conferir", async (req, res) => {
  try {
    const idempresa = req.idempresa;
    const idholerite = parseInt(req.params.id, 10);
    const conferido = req.body.conferido !== false; // default: confirmar
    const idusuario = req.usuario?.idusuario || null;
    if (!idempresa) return res.status(400).json({ error: "idempresa obrigatório." });
    if (!idholerite) return res.status(400).json({ error: "idholerite obrigatório." });

    // Confirmando (não desfazendo) uma competência MENSAL: grava agora o snapshot definitivo
    // de salário/itens a partir do cadastro atual — é este o momento em que ela deixa de ser
    // rascunho (computarLinhaFolha recalcula ao vivo do cadastro enquanto conferido=false;
    // depois de conferido, passa a usar o que foi congelado aqui). 13º não entra (preset
    // próprio, sem VA/VT — ver computarLinha13).
    if (conferido) {
      const linha = (await pool.query(
        `SELECT idfuncionario, mes, ano, COALESCE(tipo,'mensal') AS tipo
           FROM folhaholerite WHERE idholerite = $1 AND idempresa = $2`,
        [idholerite, idempresa]
      )).rows[0];
      if (!linha) return res.status(404).json({ error: "Holerite não encontrado nesta empresa." });

      if (linha.tipo === "mensal") {
        const func = (await pool.query(
          `SELECT f.idfuncionario, f.nome, fe.salario, fe.dependentes, fe.valealim, fe.valetrnsp, fe.perfil
             FROM funcionarios f JOIN funcionarioempresas fe ON fe.idfuncionario = f.idfuncionario
            WHERE f.idfuncionario = $1 AND fe.idempresa = $2`,
          [linha.idfuncionario, idempresa]
        )).rows[0];
        if (func) {
          // Tabela de INSS/IRRF do mês TRABALHADO (igual à lista/computarLinhaFolha) — antes usava
          // o ano do vencimento, e em janeiro o valor congelado saía diferente do que a lista mostrava.
          const params = await obterParametros(competenciaAnterior(linha.mes, linha.ano).ano);
          const ajuste = await ajusteFeriasMensal(idempresa, linha.idfuncionario, linha.mes, linha.ano);
          const diasUteis = diasUteisSemFerias(contarDiasBeneficio(linha.ano, linha.mes), ajuste);
          const salariobase = Number(func.salario) || 0;
          // Recalcula só VA/VT/INSS/IRRF (+ desconto de dias de férias) — hora extra, plano de
          // saúde e outros itens lançados à mão ficam (antes eram apagados aqui).
          const gravados = (await pool.query(
            `SELECT tipo, descricao, valor FROM folhaitens WHERE idholerite = $1`,
            [idholerite]
          )).rows;
          const itensNovos = mesclarItensAutomaticos(gravados, func, params, diasUteis, ajuste.diasFerias);
          await pool.query(`UPDATE folhaholerite SET salariobase = $1 WHERE idholerite = $2`, [salariobase, idholerite]);
          await pool.query(`DELETE FROM folhaitens WHERE idholerite = $1`, [idholerite]);
          for (const i of itensNovos) {
            await pool.query(
              `INSERT INTO folhaitens (idholerite, tipo, descricao, valor) VALUES ($1, $2, $3, $4)`,
              [idholerite, i.tipo, i.descricao, i.valor]
            );
          }
        }
      }
    }

    const { rowCount, rows } = await pool.query(
      `UPDATE folhaholerite
         SET conferido = $1,
             conferido_em = CASE WHEN $1 THEN NOW() ELSE NULL END,
             conferido_por = CASE WHEN $1 THEN $2::integer ELSE NULL END
       WHERE idholerite = $3 AND idempresa = $4
       RETURNING idholerite, conferido, conferido_em, conferido_por`,
      [conferido, idusuario, idholerite, idempresa]
    );
    if (rowCount === 0) return res.status(404).json({ error: "Holerite não encontrado nesta empresa." });
    res.json({ ok: true, ...rows[0] });
  } catch (error) {
    console.error("ERRO RH /holerite/:id/conferir:", error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /rh/holerite/:id/conferir-beneficios — mesma ideia do /conferir, mas separada porque
// salário e benefícios (VA/VT) vencem em dias diferentes (salário: dia 5 do mês de
// vencimento; benefícios: último dia útil do próprio mês vigente, sem defasagem) — conferir
// um não pode travar o outro. Body: { conferido: true|false }.
router.put("/holerite/:id/conferir-beneficios", async (req, res) => {
  try {
    const idempresa = req.idempresa;
    const idholerite = parseInt(req.params.id, 10);
    const conferido = req.body.conferido !== false; // default: confirmar
    const idusuario = req.usuario?.idusuario || null;
    if (!idempresa) return res.status(400).json({ error: "idempresa obrigatório." });
    if (!idholerite) return res.status(400).json({ error: "idholerite obrigatório." });

    const { rowCount, rows } = await pool.query(
      `UPDATE folhaholerite
         SET conferido_beneficios = $1,
             conferido_beneficios_em = CASE WHEN $1 THEN NOW() ELSE NULL END,
             conferido_beneficios_por = CASE WHEN $1 THEN $2::integer ELSE NULL END
       WHERE idholerite = $3 AND idempresa = $4
       RETURNING idholerite, conferido_beneficios, conferido_beneficios_em, conferido_beneficios_por`,
      [conferido, idusuario, idholerite, idempresa]
    );
    if (rowCount === 0) return res.status(404).json({ error: "Holerite não encontrado nesta empresa." });
    res.json({ ok: true, ...rows[0] });
  } catch (error) {
    console.error("ERRO RH /holerite/:id/conferir-beneficios:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /rh/holerite/:id/comprovante — anexa (ou substitui) o comprovante de pagamento.
// multipart/form-data, campo "comprovante" (imagem/PDF/JFIF, até 10MB).
router.post("/holerite/:id/comprovante", (req, res) => {
  uploadComprovanteRH(req, res, async (err) => {
    if (err) {
      const mensagem = err.code === "LIMIT_FILE_SIZE" ? "Arquivo maior que 10 MB. Envie um arquivo menor." : err.message;
      return res.status(400).json({ error: mensagem });
    }
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

// ===== Folha de Proventos à parte (bônus, prêmio, PLR...) =====
// Proventos que NÃO entram no holerite: ficam em folhaproventos, com conferência e pagamento
// próprios, e só são visíveis pra Master/Supremo (apenasMaster) — o usuário só de RH confere a
// folha normal sem nem saber que eles existem. Lançados na tela do holerite (Proventos com
// "Incluir no holerite" desmarcado, ver POST /holerite). mes/ano = mês de VENCIMENTO, igual ao
// holerite mensal; só entram em Contas a Pagar depois de conferidos (ver GET /contas-pagar).
async function listarProventosParte(idempresa, { idfuncionario = null, mes, ano, apenasConferidos = false }) {
  const { rows } = await pool.query(
    `SELECT p.idprovento, p.idfuncionario, f.nome, p.mes, p.ano, p.descricao, p.valor,
            p.conferido, p.conferido_em, p.status, p.dtpagamento,
            fe.funcao, fe.cbo, fe.admissao
       FROM folhaproventos p
       JOIN funcionarios f ON f.idfuncionario = p.idfuncionario
       LEFT JOIN funcionarioempresas fe ON fe.idfuncionario = p.idfuncionario AND fe.idempresa = p.idempresa
      WHERE p.idempresa = $1
        AND ($2::int IS NULL OR p.idfuncionario = $2)
        AND ($3::int IS NULL OR p.mes = $3)
        AND p.ano = $4
        AND ($5::boolean = false OR p.conferido = true)
      ORDER BY f.nome, p.mes, p.idprovento`,
    [idempresa, idfuncionario, mes ?? null, ano, apenasConferidos]
  );
  return rows.map((r) => ({ ...r, valor: Number(r.valor) || 0 }));
}

// GET /rh/proventos?mes=&ano= — Folha de Proventos à parte do mês (todos os funcionários).
router.get("/proventos", apenasMaster, async (req, res) => {
  try {
    const idempresa = req.idempresa;
    const mes = parseInt(req.query.mes, 10);
    const ano = parseInt(req.query.ano, 10);
    if (!idempresa) return res.status(400).json({ error: "idempresa obrigatório." });
    if (!mes || !ano) return res.status(400).json({ error: "mes e ano obrigatórios." });
    res.json({ proventos: await listarProventosParte(idempresa, { mes, ano }) });
  } catch (error) {
    console.error("ERRO RH GET /proventos:", error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /rh/proventos/:id/conferir — Body: { conferido: true|false }. Pago não pode ser desconferido.
router.put("/proventos/:id/conferir", apenasMaster, async (req, res) => {
  try {
    const idempresa = req.idempresa;
    const idprovento = parseInt(req.params.id, 10);
    const conferido = req.body.conferido !== false;
    if (!idempresa || !idprovento) return res.status(400).json({ error: "idempresa e idprovento obrigatórios." });

    const { rowCount, rows } = await pool.query(
      `UPDATE folhaproventos
          SET conferido = $1,
              conferido_em = CASE WHEN $1 THEN NOW() ELSE NULL END,
              conferido_por = CASE WHEN $1 THEN $2::integer ELSE NULL END
        WHERE idprovento = $3 AND idempresa = $4 AND status <> 'Pago'
        RETURNING idprovento, conferido, conferido_em`,
      [conferido, req.usuario?.idusuario || null, idprovento, idempresa]
    );
    if (rowCount === 0) return res.status(404).json({ error: "Provento não encontrado ou já pago." });
    res.json({ ok: true, ...rows[0] });
  } catch (error) {
    console.error("ERRO RH PUT /proventos/:id/conferir:", error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /rh/proventos/:id/pagar — Body: { pago: true|false }. Só paga o que já foi conferido.
router.put("/proventos/:id/pagar", apenasMaster, async (req, res) => {
  try {
    const idempresa = req.idempresa;
    const idprovento = parseInt(req.params.id, 10);
    const pago = req.body.pago !== false;
    if (!idempresa || !idprovento) return res.status(400).json({ error: "idempresa e idprovento obrigatórios." });

    const { rowCount, rows } = await pool.query(
      `UPDATE folhaproventos
          SET status = $1,
              dtpagamento = CASE WHEN $2 THEN CURRENT_DATE ELSE NULL END
        WHERE idprovento = $3 AND idempresa = $4 AND conferido = true
        RETURNING idprovento, status, dtpagamento`,
      [pago ? "Pago" : "Pendente", pago, idprovento, idempresa]
    );
    if (rowCount === 0) return res.status(404).json({ error: "Provento não encontrado ou ainda não conferido." });
    res.json({ ok: true, ...rows[0] });
  } catch (error) {
    console.error("ERRO RH PUT /proventos/:id/pagar:", error);
    res.status(500).json({ error: error.message });
  }
});

// ===== Férias: períodos aquisitivos, saldo e "férias a vencer" =====
// Períodos aquisitivos NÃO são gravados: saem da admissão (admissão + N anos). O que se grava é
// o que foi usado de cada um (feriasgozos: gozos programados + histórico de antes do sistema).
// Datas sempre como texto 'YYYY-MM-DD' e conta em UTC — sem Date local no meio, não tem o
// off-by-one de fuso que as datas do Postgres costumam trazer.
const DIAS_DIREITO_FERIAS = 30; // faltas (art. 130 CLT) ainda não reduzem — ajuste manual por ora
const DIAS_ABONO = 10;          // venda de 1/3 das férias (art. 143)

function isoParaUTC(iso) {
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function utcParaIso(dt) { return dt.toISOString().slice(0, 10); }
function somarDiasIso(iso, dias) {
  const dt = isoParaUTC(iso);
  dt.setUTCDate(dt.getUTCDate() + dias);
  return utcParaIso(dt);
}
// Aniversário em N anos; 29/02 cai em 28/02 nos anos não bissextos.
function somarAnosIso(iso, anos) {
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  const ultimoDia = new Date(Date.UTC(y + anos, m, 0)).getUTCDate();
  return utcParaIso(new Date(Date.UTC(y + anos, m - 1, Math.min(d, ultimoDia))));
}
function diferencaDias(isoA, isoB) {
  return Math.round((isoParaUTC(isoB) - isoParaUTC(isoA)) / 86400000);
}

// Períodos aquisitivos de UM vínculo até `ateIso` (inclusive o que está em andamento), já com o
// que foi usado de cada um. `gozos` = linhas de feriasgozos do funcionário.
//  - aquisitivo: 12 meses a partir da admissão (ou do aniversário dela)
//  - limite:     fim do período CONCESSIVO (12 meses depois do aquisitivo) — passou disso sem
//                gozar, a empresa paga em dobro (art. 137)
// Mesmo corte da folha (INICIO_FOLHA): período cujo prazo pra conceder já tinha acabado antes
// de o sistema começar não é controlado aqui — não aparece nem como "vencida". Sem isso, quem
// foi admitido em 2014 vinha com 11 anos de férias "em dobro" que nunca passaram pelo sistema.
const INICIO_FERIAS_ISO = `${INICIO_FOLHA.ano}-${String(INICIO_FOLHA.mes).padStart(2, "0")}-01`;

function montarPeriodosFerias(admissaoIso, ateIso, gozos, hojeIso) {
  const periodos = [];
  for (let n = 0; ; n++) {
    const inicio = somarAnosIso(admissaoIso, n);
    if (inicio > ateIso) break;
    const fim = somarDiasIso(somarAnosIso(admissaoIso, n + 1), -1);
    const limite = somarDiasIso(somarAnosIso(admissaoIso, n + 2), -1);
    if (limite < INICIO_FERIAS_ISO) continue; // antes do sistema (ver INICIO_FERIAS_ISO)
    const usados = gozos.filter((g) => g.aquisitivo_inicio === inicio);
    const diasGozados = usados.reduce((s, g) => s + (Number(g.dias) || 0), 0);
    const abono = usados.some((g) => g.abono);
    const saldo = Math.max(0, DIAS_DIREITO_FERIAS - diasGozados - (abono ? DIAS_ABONO : 0));
    let status;
    if (saldo === 0) status = "quitado";
    else if (fim >= hojeIso) status = "em_aquisicao";
    else if (limite < hojeIso) status = "vencida";
    else status = "adquirida";
    periodos.push({
      aquisitivo_inicio: inicio, aquisitivo_fim: fim, limite, saldo, diasGozados, abono, status,
      diasParaLimite: diferencaDias(hojeIso, limite),
      gozos: usados.map((g) => ({
        idferias: g.idferias, origem: g.origem, gozo_inicio: g.gozo_inicio, gozo_fim: g.gozo_fim,
        dias: g.dias, abono: g.abono, idholerite: g.idholerite,
        recibo_status: g.recibo_status || null, recibo_conferido: !!g.recibo_conferido,
      })),
    });
  }
  return periodos;
}

// Funcionários de folha ativos, com admissão e sem demissão (demitido resolve férias na
// rescisão), + os gozos de cada um — base comum da listagem e do histórico.
async function carregarBaseFerias(idempresa, idfuncionario = null) {
  const funcs = (await pool.query(
    `SELECT f.idfuncionario, f.nome, fe.funcao, to_char(fe.admissao, 'YYYY-MM-DD') AS admissao
       FROM funcionarios f
       JOIN funcionarioempresas fe ON fe.idfuncionario = f.idfuncionario
      WHERE fe.idempresa = $1 AND fe.perfil = ANY($2) AND COALESCE(fe.ativo, true) = true
        AND fe.admissao IS NOT NULL AND fe.demissao IS NULL
        AND ($3::int IS NULL OR f.idfuncionario = $3)
      ORDER BY f.nome`,
    [idempresa, PERFIS_FOLHA, idfuncionario]
  )).rows;
  const gozos = (await pool.query(
    `SELECT g.idferias, g.idfuncionario, g.origem, g.dias, g.abono, g.idholerite,
            to_char(g.aquisitivo_inicio, 'YYYY-MM-DD') AS aquisitivo_inicio,
            to_char(g.gozo_inicio, 'YYYY-MM-DD') AS gozo_inicio,
            to_char(g.gozo_fim, 'YYYY-MM-DD') AS gozo_fim,
            h.status AS recibo_status, (h.conferido AND h.conferido_em IS NOT NULL) AS recibo_conferido
       FROM feriasgozos g
       LEFT JOIN folhaholerite h ON h.idholerite = g.idholerite
      WHERE g.idempresa = $1 AND ($2::int IS NULL OR g.idfuncionario = $2)`,
    [idempresa, idfuncionario]
  )).rows;
  const gozosPorFunc = new Map();
  gozos.forEach((g) => {
    if (!gozosPorFunc.has(g.idfuncionario)) gozosPorFunc.set(g.idfuncionario, []);
    gozosPorFunc.get(g.idfuncionario).push(g);
  });
  return { funcs, gozosPorFunc };
}

// GET /rh/ferias/a-vencer?de=&ate=&filtro=limite|aquisicao&vencidas=1
//  filtro=limite    (padrão): data LIMITE pra conceder dentro de de–até — o risco de pagar em
//                   dobro. vencidas=1 (padrão) inclui também as que já passaram do limite.
//  filtro=aquisicao: períodos que COMPLETAM 12 meses (direito adquirido) dentro de de–até —
//                   pra planejar quem vai poder sair de férias.
// Só períodos com saldo > 0. Liberada pra todo o RH (mount do /rh em server.js).
router.get("/ferias/a-vencer", async (req, res) => {
  try {
    const idempresa = req.idempresa;
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    const de = String(req.query.de || "");
    const ate = String(req.query.ate || "");
    if (!idempresa) return res.status(400).json({ error: "idempresa obrigatório." });
    if (!iso.test(de) || !iso.test(ate) || de > ate) return res.status(400).json({ error: "Informe um período válido (de/até)." });
    const filtro = req.query.filtro === "aquisicao" ? "aquisicao" : "limite";
    const incluirVencidas = req.query.vencidas !== "0";
    const hojeIso = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

    const { funcs, gozosPorFunc } = await carregarBaseFerias(idempresa);
    const linhas = [];
    for (const f of funcs) {
      const periodos = montarPeriodosFerias(f.admissao, ate, gozosPorFunc.get(f.idfuncionario) || [], hojeIso);
      periodos.forEach((p) => {
        if (p.saldo === 0) return;
        const dentro = filtro === "aquisicao"
          ? p.aquisitivo_fim >= de && p.aquisitivo_fim <= ate
          : (p.limite >= de && p.limite <= ate) || (incluirVencidas && p.status === "vencida");
        if (!dentro) return;
        linhas.push({ idfuncionario: f.idfuncionario, nome: f.nome, funcao: f.funcao, admissao: f.admissao, ...p });
      });
    }
    linhas.sort((a, b) => a.limite.localeCompare(b.limite) || a.nome.localeCompare(b.nome));
    res.json({ linhas, hoje: hojeIso });
  } catch (error) {
    console.error("ERRO RH GET /ferias/a-vencer:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /rh/ferias/funcionario/:id — todos os períodos aquisitivos (até hoje) de um funcionário,
// com o que foi usado de cada um. Base do lançamento de histórico e do "Programar férias".
router.get("/ferias/funcionario/:id", async (req, res) => {
  try {
    const idempresa = req.idempresa;
    const idfuncionario = parseInt(req.params.id, 10);
    if (!idempresa || !idfuncionario) return res.status(400).json({ error: "idempresa e idfuncionario obrigatórios." });
    const hojeIso = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
    const { funcs, gozosPorFunc } = await carregarBaseFerias(idempresa, idfuncionario);
    const f = funcs[0];
    if (!f) return res.status(404).json({ error: "Funcionário sem admissão cadastrada, demitido ou fora da folha." });
    res.json({
      funcionario: f,
      periodos: montarPeriodosFerias(f.admissao, hojeIso, gozosPorFunc.get(idfuncionario) || [], hojeIso),
    });
  } catch (error) {
    console.error("ERRO RH GET /ferias/funcionario/:id:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /rh/ferias/historico — marca período(s) aquisitivo(s) como já gozados ANTES do sistema.
// Body: { idfuncionario, aquisitivo_inicio, incluirAnteriores?, gozo_inicio?, gozo_fim?, obs? }
// Lança o SALDO que falta de cada período (não duplica o que já tem), sem gerar holerite.
// incluirAnteriores quita também todos os períodos anteriores ainda com saldo — pra quem foi
// admitido há anos, sem ter que marcar um por um.
router.post("/ferias/historico", async (req, res) => {
  const client = await pool.connect();
  try {
    const idempresa = req.idempresa;
    const idfuncionario = parseInt(req.body.idfuncionario, 10);
    const alvo = String(req.body.aquisitivo_inicio || "").slice(0, 10);
    const incluirAnteriores = req.body.incluirAnteriores === true;
    const gozoInicio = req.body.gozo_inicio || null;
    const gozoFim = req.body.gozo_fim || null;
    if (!idempresa || !idfuncionario || !alvo) return res.status(400).json({ error: "idfuncionario e aquisitivo_inicio obrigatórios." });
    if (!incluirAnteriores && gozoInicio && gozoFim && gozoFim < gozoInicio) {
      return res.status(400).json({ error: "O fim do gozo não pode ser antes do início." });
    }

    const hojeIso = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
    const { funcs, gozosPorFunc } = await carregarBaseFerias(idempresa, idfuncionario);
    const f = funcs[0];
    if (!f) return res.status(404).json({ error: "Funcionário sem admissão cadastrada, demitido ou fora da folha." });
    const periodos = montarPeriodosFerias(f.admissao, hojeIso, gozosPorFunc.get(idfuncionario) || [], hojeIso);
    if (!periodos.some((p) => p.aquisitivo_inicio === alvo)) {
      return res.status(400).json({ error: "Período aquisitivo não encontrado pra esse funcionário." });
    }
    const aQuitar = periodos.filter((p) => p.saldo > 0 &&
      (p.aquisitivo_inicio === alvo || (incluirAnteriores && p.aquisitivo_inicio < alvo)));

    await client.query("BEGIN");
    for (const p of aQuitar) {
      // Datas de gozo só fazem sentido pro período escolhido (não pra quitação em lote).
      const comDatas = p.aquisitivo_inicio === alvo && !incluirAnteriores;
      await client.query(
        `INSERT INTO feriasgozos (idempresa, idfuncionario, aquisitivo_inicio, aquisitivo_fim,
                                  gozo_inicio, gozo_fim, dias, origem, obs, idusuario)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'historico', $8, $9)`,
        [idempresa, idfuncionario, p.aquisitivo_inicio, p.aquisitivo_fim,
         comDatas ? gozoInicio : null, comDatas ? gozoFim : null, p.saldo,
         req.body.obs || "Férias gozadas antes do sistema", req.usuario?.idusuario || null]
      );
    }
    await client.query("COMMIT");
    res.json({ ok: true, quitados: aQuitar.length });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("ERRO RH POST /ferias/historico:", error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// ===== Programar férias: recibo de férias + reflexo no holerite mensal =====
// Recibo de férias = folhaholerite tipo 'ferias', mes/ano = mês de INÍCIO do gozo (UNIQUE por
// mês/tipo: dois gozos que começam no mesmo mês caem no mesmo recibo). Itens calculados daqui
// (recalcularReciboFerias), sempre a partir dos gozos vinculados a ele em feriasgozos.
// Base só o salário fixo (decisão 2026-09-28 — médias de variáveis ficam pra depois).
const FERIAS_DESC = "Férias";
const FERIAS_TERCO_DESC = "1/3 constitucional de férias";
const ABONO_DESC = "Abono pecuniário (10 dias)";
const ABONO_TERCO_DESC = "1/3 sobre abono pecuniário";
// Desconto no holerite MENSAL dos dias que já foram pagos no recibo de férias.
const FERIAS_MES_DESC = "Dias de férias (pagos no recibo de férias)";

// Itens do recibo: férias + 1/3 tributáveis (INSS/IRRF próprios, IRRF em separado do mês);
// abono pecuniário + 1/3 são isentos (art. 144 CLT) — entram no líquido, fora da base.
function montarItensReciboFerias(salario, dependentes, params, diasGozo, abono, perfil) {
  const s = Number(salario) || 0;
  const ferias = round2(s / 30 * diasGozo);
  const terco = round2(ferias / 3);
  const itens = [
    { tipo: "P", descricao: `${FERIAS_DESC} (${diasGozo} dias)`, valor: ferias },
    { tipo: "P", descricao: FERIAS_TERCO_DESC, valor: terco },
  ];
  if (abono) {
    const vAbono = round2(s / 30 * DIAS_ABONO);
    itens.push({ tipo: "P", descricao: ABONO_DESC, valor: vAbono });
    itens.push({ tipo: "P", descricao: ABONO_TERCO_DESC, valor: round2(vAbono / 3) });
  }
  const baseTributavel = ferias + terco;
  if (perfilTemImposto(perfil)) {
    const inss = calcularINSS(baseTributavel, params);
    const ir = calcularIRRF(baseTributavel, inss, dependentes, params);
    if (inss > 0) itens.push({ tipo: "D", descricao: "INSS", valor: inss });
    if (ir.irrf > 0) itens.push({ tipo: "D", descricao: "IRRF", valor: ir.irrf });
  }
  return itens;
}

// Pagamento: até 2 dias antes do início (art. 145) — se cair em fim de semana/feriado, antecipa
// pro dia útil anterior (banco fechado não compensa).
function vencimentoFerias(gozoInicioIso) {
  let iso = somarDiasIso(gozoInicioIso, -2);
  for (;;) {
    const dow = isoParaUTC(iso).getUTCDay();
    if (dow !== 0 && dow !== 6 && !feriadosDoAno(Number(iso.slice(0, 4))).has(iso)) return iso;
    iso = somarDiasIso(iso, -1);
  }
}

// Dias de sobreposição entre [ini, fim] e o mês (ano, mes). `soUteis` conta só seg–sex (mesma
// regra de contarDiasBeneficio, feriado não desconta).
function diasNoMes(iniIso, fimIso, ano, mes, soUteis = false) {
  const primeiro = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const ultimo = `${ano}-${String(mes).padStart(2, "0")}-${String(new Date(Date.UTC(ano, mes, 0)).getUTCDate()).padStart(2, "0")}`;
  const a = iniIso > primeiro ? iniIso : primeiro;
  const b = fimIso < ultimo ? fimIso : ultimo;
  if (a > b) return 0;
  if (!soUteis) return diferencaDias(a, b) + 1;
  let n = 0;
  for (let d = a; d <= b; d = somarDiasIso(d, 1)) {
    const dow = isoParaUTC(d).getUTCDay();
    if (dow !== 0 && dow !== 6) n++;
  }
  return n;
}

// Reflexo das férias PROGRAMADAS no holerite mensal de vencimento mesVenc/anoVenc:
//  - diasFerias: dias de férias no mês TRABALHADO (competência = mês anterior ao vencimento) —
//    saem do salário (já pagos no recibo). Mês 100% de férias = 30 (mês comercial), senão fev
//    com 28 dias de férias deixaria 2 dias de salário.
//  - diasUteisFerias: seg–sex de férias no mês de VENCIMENTO — saem do VA/VT (benefício é do
//    mês vigente, sem defasagem).
async function ajusteFeriasMensal(idempresa, idfuncionario, mesVenc, anoVenc) {
  const comp = competenciaAnterior(mesVenc, anoVenc);
  const { rows } = await pool.query(
    `SELECT to_char(gozo_inicio, 'YYYY-MM-DD') AS ini, to_char(gozo_fim, 'YYYY-MM-DD') AS fim
       FROM feriasgozos
      WHERE idempresa = $1 AND idfuncionario = $2 AND origem = 'programada'
        AND gozo_inicio IS NOT NULL AND gozo_fim IS NOT NULL
        AND gozo_inicio <= make_date($3, $4, 1) + INTERVAL '1 month' - INTERVAL '1 day'
        AND gozo_fim >= make_date($5, $6, 1)`,
    [idempresa, idfuncionario, anoVenc, mesVenc, comp.ano, comp.mes]
  );
  let diasFerias = 0, diasUteisFerias = 0;
  const diasMesComp = new Date(Date.UTC(comp.ano, comp.mes, 0)).getUTCDate();
  rows.forEach((g) => {
    diasFerias += diasNoMes(g.ini, g.fim, comp.ano, comp.mes);
    diasUteisFerias += diasNoMes(g.ini, g.fim, anoVenc, mesVenc, true);
  });
  if (diasFerias >= diasMesComp) diasFerias = 30;
  return { diasFerias: Math.min(diasFerias, 30), diasUteisFerias };
}

// Regrava os itens de UM recibo de férias a partir dos gozos vinculados. Sem gozo nenhum, apaga
// o recibo. Chamado dentro da transação de programar/cancelar (client).
async function recalcularReciboFerias(client, idempresa, idholerite) {
  const gozos = (await client.query(
    `SELECT dias, abono, to_char(gozo_inicio, 'YYYY-MM-DD') AS ini, to_char(gozo_fim, 'YYYY-MM-DD') AS fim,
            to_char(aquisitivo_inicio, 'YYYY-MM-DD') AS aq_ini, to_char(aquisitivo_fim, 'YYYY-MM-DD') AS aq_fim
       FROM feriasgozos WHERE idholerite = $1 ORDER BY gozo_inicio`,
    [idholerite]
  )).rows;
  if (!gozos.length) {
    await client.query(`DELETE FROM folhaitens WHERE idholerite = $1`, [idholerite]);
    await client.query(`DELETE FROM folhaholerite WHERE idholerite = $1 AND idempresa = $2`, [idholerite, idempresa]);
    return;
  }
  const h = (await client.query(
    `SELECT h.idfuncionario, h.ano, fe.salario, fe.dependentes, fe.perfil
       FROM folhaholerite h JOIN funcionarioempresas fe ON fe.idfuncionario = h.idfuncionario AND fe.idempresa = h.idempresa
      WHERE h.idholerite = $1`,
    [idholerite]
  )).rows[0];
  const params = await obterParametros(h.ano);
  const diasGozo = gozos.reduce((s, g) => s + (Number(g.dias) || 0), 0);
  const itens = montarItensReciboFerias(h.salario, h.dependentes, params, diasGozo, gozos.some((g) => g.abono), h.perfil);
  const obs = `Gozo: ${gozos.map((g) => `${g.ini.split("-").reverse().join("/")} a ${g.fim.split("-").reverse().join("/")}`).join(" e ")}`
    + ` · Período aquisitivo ${gozos[0].aq_ini.split("-").reverse().join("/")} a ${gozos[0].aq_fim.split("-").reverse().join("/")}`
    + ` · Pagar até ${vencimentoFerias(gozos[0].ini).split("-").reverse().join("/")}`;
  await client.query(
    `UPDATE folhaholerite SET salariobase = $1, obs = $2 WHERE idholerite = $3`,
    [Number(h.salario) || 0, obs, idholerite]
  );
  await client.query(`DELETE FROM folhaitens WHERE idholerite = $1`, [idholerite]);
  for (const i of itens) {
    await client.query(
      `INSERT INTO folhaitens (idholerite, tipo, descricao, valor) VALUES ($1, $2, $3, $4)`,
      [idholerite, i.tipo, i.descricao, i.valor]
    );
  }
}

// Holerites MENSAIS que as férias [ini, fim] mexem: salário da competência (vencimento = mês
// seguinte) e VA/VT do próprio mês. Se algum já foi CONFERIDO de fato, programar/cancelar não
// pode seguir — o valor já foi fechado e mandado pro financeiro.
async function mensaisConferidosAfetados(idempresa, idfuncionario, gozos) {
  const alvos = new Set();
  const proximoMes = (iso) => `${somarDiasIso(iso, 32).slice(0, 7)}-01`; // iso é sempre dia 01
  gozos.forEach(({ inicio, fim }) => {
    for (let d = `${inicio.slice(0, 7)}-01`; d <= fim; d = proximoMes(d)) {
      const [a, m] = d.split("-").map(Number);
      alvos.add(`${a}-${m}`); // VA/VT do mês vigente
      const venc = m === 12 ? `${a + 1}-1` : `${a}-${m + 1}`;
      alvos.add(venc);        // salário do mês trabalhado
    }
  });
  if (!alvos.size) return [];
  const { rows } = await pool.query(
    `SELECT mes, ano FROM folhaholerite
      WHERE idempresa = $1 AND idfuncionario = $2 AND COALESCE(tipo, 'mensal') = 'mensal'
        AND ((conferido AND conferido_em IS NOT NULL) OR (conferido_beneficios AND conferido_beneficios_em IS NOT NULL))
        AND (ano::text || '-' || mes::text) = ANY($3)`,
    [idempresa, idfuncionario, [...alvos]]
  );
  return rows.map((r) => `${String(r.mes).padStart(2, "0")}/${r.ano}`);
}

// Valida e monta a programação (sem gravar). Devolve { erro } ou { periodo, gozos, recibos }.
async function prepararProgramacaoFerias(idempresa, body) {
  const idfuncionario = parseInt(body.idfuncionario, 10);
  const aquisitivo = String(body.aquisitivo_inicio || "").slice(0, 10);
  const abono = body.abono === true;
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  const gozos = (Array.isArray(body.gozos) ? body.gozos : [])
    .filter((g) => g && (g.inicio || g.fim))
    .map((g) => ({ inicio: String(g.inicio || ""), fim: String(g.fim || "") }));
  if (!idfuncionario || !aquisitivo) return { erro: "Funcionário e período aquisitivo obrigatórios." };
  if (!gozos.length) return { erro: "Informe ao menos um período de gozo (início e fim)." };
  for (const g of gozos) {
    if (!iso.test(g.inicio) || !iso.test(g.fim)) return { erro: "Cada período de gozo precisa de data de início e de fim." };
    if (g.fim < g.inicio) return { erro: "O fim do gozo não pode ser antes do início." };
    g.dias = diferencaDias(g.inicio, g.fim) + 1;
  }
  gozos.sort((a, b) => a.inicio.localeCompare(b.inicio));
  for (let i = 1; i < gozos.length; i++) {
    if (gozos[i].inicio <= gozos[i - 1].fim) return { erro: "Os períodos de gozo não podem se sobrepor." };
  }

  const hojeIso = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  const { funcs, gozosPorFunc } = await carregarBaseFerias(idempresa, idfuncionario);
  const f = funcs[0];
  if (!f) return { erro: "Funcionário sem admissão cadastrada, demitido ou fora da folha." };
  const todosGozos = gozosPorFunc.get(idfuncionario) || [];
  const periodo = montarPeriodosFerias(f.admissao, hojeIso, todosGozos, hojeIso)
    .find((p) => p.aquisitivo_inicio === aquisitivo);
  if (!periodo) return { erro: "Período aquisitivo não encontrado pra esse funcionário." };

  if (gozos[0].inicio <= periodo.aquisitivo_fim) {
    return { erro: `O gozo só pode começar depois de completado o período aquisitivo (${periodo.aquisitivo_fim.split("-").reverse().join("/")}).` };
  }
  if (gozos[0].inicio < INICIO_FERIAS_ISO) return { erro: "Férias anteriores ao início do sistema: registre como \"Já gozadas\" na listagem." };
  // Não pode bater com outras férias do funcionário (de qualquer período aquisitivo).
  const conflito = todosGozos.find((x) => x.gozo_inicio && x.gozo_fim &&
    gozos.some((g) => g.inicio <= x.gozo_fim && g.fim >= x.gozo_inicio));
  if (conflito) {
    return { erro: `Conflita com férias já lançadas de ${conflito.gozo_inicio.split("-").reverse().join("/")} a ${conflito.gozo_fim.split("-").reverse().join("/")}.` };
  }

  // Saldo e regra de fracionamento (art. 134 §1: até 3 partes, uma >= 14 dias, as outras >= 5).
  if (abono && periodo.abono) return { erro: "Esse período já tem abono (venda de 10 dias) lançado." };
  const diasNovos = gozos.reduce((s, g) => s + g.dias, 0);
  const consumo = diasNovos + (abono ? DIAS_ABONO : 0);
  if (consumo > periodo.saldo) {
    return { erro: `Saldo insuficiente: o período tem ${periodo.saldo} dia(s) e a programação usa ${consumo}${abono ? " (com os 10 dias vendidos)" : ""}.` };
  }
  const partes = [...periodo.gozos.filter((x) => x.origem === "programada").map((x) => Number(x.dias)), ...gozos.map((g) => g.dias)];
  const saldoDepois = periodo.saldo - consumo;
  if (partes.length > 3) return { erro: "A CLT permite dividir as férias em no máximo 3 períodos." };
  if (partes.some((d) => d < 5)) return { erro: "Nenhum período de férias pode ter menos de 5 dias corridos (CLT art. 134 §1º)." };
  if (!partes.some((d) => d >= 14)) {
    const aindaCabe = saldoDepois >= 14 && partes.length < 3;
    if (!aindaCabe) return { erro: "Um dos períodos de férias precisa ter pelo menos 14 dias corridos (CLT art. 134 §1º)." };
  }
  if (saldoDepois > 0 && saldoDepois < 5) {
    return { erro: `Sobrariam ${saldoDepois} dia(s) no período — menos que o mínimo de 5 pra um novo gozo. Ajuste as datas.` };
  }
  if (saldoDepois > 0 && partes.length >= 3) {
    return { erro: `Sobrariam ${saldoDepois} dia(s), mas já seriam 3 períodos (o máximo). Ajuste as datas.` };
  }

  // Recibos: um por mês de INÍCIO do gozo (ver UNIQUE de folhaholerite).
  const cadastro = (await pool.query(
    `SELECT salario, dependentes, perfil FROM funcionarioempresas WHERE idfuncionario = $1 AND idempresa = $2`,
    [idfuncionario, idempresa]
  )).rows[0] || {};
  const salario = Number(cadastro.salario) || 0;
  const dependentes = cadastro.dependentes;
  const perfilFunc = cadastro.perfil;
  if (salario <= 0) return { erro: "Funcionário sem salário no cadastro — não há como calcular as férias." };
  const porMes = new Map();
  gozos.forEach((g, i) => {
    const chave = g.inicio.slice(0, 7);
    if (!porMes.has(chave)) porMes.set(chave, { mes: Number(chave.slice(5, 7)), ano: Number(chave.slice(0, 4)), gozos: [], abono: false });
    porMes.get(chave).gozos.push(g);
    if (abono && i === 0) porMes.get(chave).abono = true; // abono vai junto do 1º gozo
  });
  const recibos = [];
  for (const r of porMes.values()) {
    const existente = (await pool.query(
      `SELECT idholerite, status, (conferido AND conferido_em IS NOT NULL) AS conferido
         FROM folhaholerite WHERE idempresa = $1 AND idfuncionario = $2 AND mes = $3 AND ano = $4 AND tipo = 'ferias'`,
      [idempresa, idfuncionario, r.mes, r.ano]
    )).rows[0];
    if (existente && (existente.status === "Pago" || existente.conferido)) {
      return { erro: `Já existe recibo de férias ${existente.status === "Pago" ? "pago" : "conferido"} com início em ${String(r.mes).padStart(2, "0")}/${r.ano}. Desfaça a conferência antes.` };
    }
    // Gozos que JÁ estão nesse recibo (mesmo mês) entram na conta junto com os novos.
    const jaNoRecibo = existente ? todosGozos.filter((x) => x.idholerite === existente.idholerite) : [];
    const diasGozo = r.gozos.reduce((s, g) => s + g.dias, 0) + jaNoRecibo.reduce((s, x) => s + (Number(x.dias) || 0), 0);
    const itens = montarItensReciboFerias(salario, dependentes, await obterParametros(r.ano), diasGozo, r.abono || jaNoRecibo.some((x) => x.abono), perfilFunc);
    const inicioRecibo = [...r.gozos.map((g) => g.inicio), ...jaNoRecibo.map((x) => x.gozo_inicio)].sort()[0];
    recibos.push({
      ...r, idholerite: existente?.idholerite || null, itens,
      ...calcularTotais(salario, itens, "ferias"),
      dtvcto: vencimentoFerias(inicioRecibo),
    });
  }

  const avisos = [];
  if (periodo.status === "vencida") avisos.push("Período já passou do limite de concessão — pela CLT (art. 137) essas férias são devidas em dobro; o cálculo aqui NÃO dobra, ajuste o recibo à mão se for o caso.");
  const conferidos = await mensaisConferidosAfetados(idempresa, idfuncionario, gozos);
  return { f, periodo, gozos, abono, recibos, avisos, mensaisConferidos: conferidos, salario };
}

// Recibos de férias (folhaholerite tipo 'ferias') com totais e vencimento (2 dias antes do 1º
// gozo). Filtra por mês/ano do recibo (mês de início do gozo) ou pelo ano inteiro.
// Usado pela lista do RH (GET /folha) e por GET /contas-pagar (rotaMain.js).
async function listarRecibosFerias(idempresa, { mes = null, ano, apenasConferidos = false }) {
  const { rows } = await pool.query(
    `SELECT h.idholerite, h.idfuncionario, f.nome, h.mes, h.ano, h.status, h.dtpagamento, h.comprovante,
            h.salariobase, h.conferido, h.conferido_em,
            to_char(MIN(g.gozo_inicio), 'YYYY-MM-DD') AS gozo_inicio,
            to_char(MAX(g.gozo_fim), 'YYYY-MM-DD') AS gozo_fim,
            COALESCE(SUM(g.dias), 0) AS dias
       FROM folhaholerite h
       JOIN funcionarios f ON f.idfuncionario = h.idfuncionario
       LEFT JOIN feriasgozos g ON g.idholerite = h.idholerite
      WHERE h.idempresa = $1 AND h.tipo = 'ferias' AND h.ano = $2
        AND ($3::int IS NULL OR h.mes = $3)
        AND ($4::boolean = false OR (h.conferido AND h.conferido_em IS NOT NULL))
      GROUP BY h.idholerite, f.nome
      ORDER BY f.nome`,
    [idempresa, ano, mes, apenasConferidos]
  );
  const recibos = [];
  for (const r of rows) {
    const itens = (await pool.query(`SELECT tipo, descricao, valor FROM folhaitens WHERE idholerite = $1`, [r.idholerite])).rows;
    const t = calcularTotais(r.salariobase, itens, "ferias");
    recibos.push({
      ...r, dias: Number(r.dias) || 0, itens,
      origem: "real", conferidoEm: r.conferido_em,
      // Recibo lançado à mão pelo tipo "Férias" antigo (sem gozo vinculado) não tem data de
      // início — vence no dia 1º do mês do recibo.
      dtvcto: r.gozo_inicio ? vencimentoFerias(r.gozo_inicio) : `${r.ano}-${String(r.mes).padStart(2, "0")}-01`,
      proventos: t.proventos, descontos: t.descontos, liquido: t.liquido,
    });
  }
  return recibos;
}

// POST /rh/ferias/programar — Body: { idfuncionario, aquisitivo_inicio, gozos:[{inicio,fim}], abono,
// simular? }. simular=true só devolve a prévia (recibos, vencimento, avisos) sem gravar.
router.post("/ferias/programar", async (req, res) => {
  const idempresa = req.idempresa;
  if (!idempresa) return res.status(400).json({ error: "idempresa obrigatório." });
  let prep;
  try {
    prep = await prepararProgramacaoFerias(idempresa, req.body);
  } catch (error) {
    console.error("ERRO RH POST /ferias/programar (preparar):", error);
    return res.status(500).json({ error: error.message });
  }
  if (prep.erro) return res.status(400).json({ error: prep.erro });
  if (req.body.simular === true) {
    return res.json({ simulacao: true, recibos: prep.recibos, avisos: prep.avisos, mensaisConferidos: prep.mensaisConferidos });
  }
  if (prep.mensaisConferidos.length) {
    return res.status(409).json({
      error: `Essas férias mudam holerite(s) mensal(is) já conferido(s): ${prep.mensaisConferidos.join(", ")}. Desfaça a conferência antes de programar.`,
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { f, periodo, gozos, abono } = prep;
    const idsRecibo = new Set();
    for (let i = 0; i < gozos.length; i++) {
      const g = gozos[i];
      const mes = Number(g.inicio.slice(5, 7)), ano = Number(g.inicio.slice(0, 4));
      await client.query(
        `INSERT INTO folhaholerite (idempresa, idfuncionario, mes, ano, salariobase, status, tipo)
         VALUES ($1, $2, $3, $4, $5, 'Pendente', 'ferias')
         ON CONFLICT (idempresa, idfuncionario, mes, ano, tipo) DO NOTHING`,
        [idempresa, f.idfuncionario, mes, ano, prep.salario]
      );
      const idholerite = (await client.query(
        `SELECT idholerite FROM folhaholerite WHERE idempresa = $1 AND idfuncionario = $2 AND mes = $3 AND ano = $4 AND tipo = 'ferias'`,
        [idempresa, f.idfuncionario, mes, ano]
      )).rows[0].idholerite;
      idsRecibo.add(idholerite);
      await client.query(
        `INSERT INTO feriasgozos (idempresa, idfuncionario, aquisitivo_inicio, aquisitivo_fim, gozo_inicio, gozo_fim,
                                  dias, abono, origem, idholerite, idusuario)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'programada', $9, $10)`,
        [idempresa, f.idfuncionario, periodo.aquisitivo_inicio, periodo.aquisitivo_fim, g.inicio, g.fim,
         g.dias, abono && i === 0, idholerite, req.usuario?.idusuario || null]
      );
    }
    for (const id of idsRecibo) await recalcularReciboFerias(client, idempresa, id);
    await client.query("COMMIT");
    res.json({ ok: true, recibos: [...idsRecibo] });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("ERRO RH POST /ferias/programar:", error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// DELETE /rh/ferias/programada/:id — cancela um gozo programado. Recibo pago/conferido ou
// holerite mensal afetado já conferido travam (desfazer a conferência primeiro).
router.delete("/ferias/programada/:id", async (req, res) => {
  const idempresa = req.idempresa;
  const idferias = parseInt(req.params.id, 10);
  const client = await pool.connect();
  try {
    const g = (await pool.query(
      `SELECT g.idferias, g.idfuncionario, g.idholerite,
              to_char(g.gozo_inicio, 'YYYY-MM-DD') AS inicio, to_char(g.gozo_fim, 'YYYY-MM-DD') AS fim,
              h.status, (h.conferido AND h.conferido_em IS NOT NULL) AS conferido
         FROM feriasgozos g LEFT JOIN folhaholerite h ON h.idholerite = g.idholerite
        WHERE g.idferias = $1 AND g.idempresa = $2 AND g.origem = 'programada'`,
      [idferias, idempresa]
    )).rows[0];
    if (!g) return res.status(404).json({ error: "Férias programadas não encontradas." });
    if (g.status === "Pago" || g.conferido) {
      return res.status(409).json({ error: `O recibo dessas férias já foi ${g.status === "Pago" ? "pago" : "conferido"}. Desfaça a conferência antes de cancelar.` });
    }
    const conferidos = await mensaisConferidosAfetados(idempresa, g.idfuncionario, [{ inicio: g.inicio, fim: g.fim }]);
    if (conferidos.length) {
      return res.status(409).json({ error: `Cancelar mudaria holerite(s) mensal(is) já conferido(s): ${conferidos.join(", ")}. Desfaça a conferência antes.` });
    }
    await client.query("BEGIN");
    await client.query(`DELETE FROM feriasgozos WHERE idferias = $1`, [idferias]);
    if (g.idholerite) await recalcularReciboFerias(client, idempresa, g.idholerite);
    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("ERRO RH DELETE /ferias/programada/:id:", error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// DELETE /rh/ferias/:id — desfaz um lançamento de HISTÓRICO (engano ao quitar). Gozo
// programado não sai por aqui: ele tem recibo de férias vinculado.
router.delete("/ferias/:id", async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM feriasgozos WHERE idferias = $1 AND idempresa = $2 AND origem = 'historico'`,
      [parseInt(req.params.id, 10), req.idempresa]
    );
    if (rowCount === 0) return res.status(404).json({ error: "Lançamento de histórico não encontrado." });
    res.json({ ok: true });
  } catch (error) {
    console.error("ERRO RH DELETE /ferias/:id:", error);
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

// Monta a linha de folha de UM funcionário numa competência: se já existe holerite mensal
// salvo, usa os valores reais; senão, monta uma PREVISÃO não persistida (réplica do último
// holerite recalculando VA/VT pelos dias úteis, ou do zero com INSS/IRRF sobre o salário
// base). Reaproveitado por GET /rh/folha e por GET /contas-pagar (routes/rotaMain.js), que
// precisa da mesma competência sempre "preenchida" (real ou prevista) pra casar com a conta
// projetada na tela de Vencimentos.
async function computarLinhaFolha(idempresa, f, mes, ano, params, diasUteis) {
  const head = (await pool.query(
    `SELECT h.idholerite, h.status, h.dtpagamento, h.comprovante, h.salariobase,
            h.conferido, h.conferido_em, h.conferido_beneficios, h.conferido_beneficios_em,
            h.status_beneficios, h.dtpagamento_beneficios
       FROM folhaholerite h
      WHERE h.idempresa = $1 AND h.idfuncionario = $2 AND h.mes = $3 AND h.ano = $4
        AND COALESCE(h.tipo,'mensal') = 'mensal'`,
    [idempresa, f.idfuncionario, mes, ano]
  )).rows[0];

  if (head) {
    // Enquanto NÃO conferido, a competência ainda é rascunho: recalcula salário/itens do
    // cadastro atual a cada leitura (mesmo já tendo idholerite gravado) — senão uma mudança de
    // salário/VA/VT no cadastro nunca aparece pra ninguém, porque a linha nasceu (e ficou presa)
    // com o valor de quando foi pré-gerada, meses atrás. Só depois de conferido é que o valor
    // vira definitivo (ver PUT /holerite/:id/conferir, que grava o snapshot na hora de confirmar).
    // Conferido = com carimbo de quem/quando (conferidoDeFato), não só o flag: a base herdou
    // conferido=true de um DEFAULT de migration e ficaria presa num snapshot que ninguém revisou.
    if (!conferidoDeFato(head)) {
      const salariobase = Number(f.salario) || 0;
      const gravados = (await pool.query(
        `SELECT tipo, descricao, valor FROM folhaitens WHERE idholerite = $1`,
        [head.idholerite]
      )).rows;
      // Férias programadas no mês: desconta os dias já pagos no recibo (salário) e tira os
      // dias de férias do VA/VT — ver ajusteFeriasMensal.
      const ajuste = await ajusteFeriasMensal(idempresa, f.idfuncionario, mes, ano);
      const itens = mesclarItensAutomaticos(gravados, f, params, diasUteisSemFerias(diasUteis, ajuste), ajuste.diasFerias);
      const t = calcularTotais(salariobase, itens);
      return {
        idfuncionario: f.idfuncionario, nome: f.nome, idholerite: head.idholerite,
        origem: "real", status: head.status, dtpagamento: head.dtpagamento, comprovante: head.comprovante,
        conferido: head.conferido, conferidoEm: head.conferido_em,
        conferidoBeneficios: head.conferido_beneficios, conferidoBeneficiosEm: head.conferido_beneficios_em,
        statusBeneficios: head.status_beneficios, dtpagamentoBeneficios: head.dtpagamento_beneficios,
        salariobase, itens,
        // Valor/dia do cadastro: a lista usa pra mostrar em quantos dias o VA/VT foi pago
        // (valor ÷ valor-dia), sem precisar abrir o holerite.
        valealimDia: Number(f.valealim) || 0, valetrnspDia: Number(f.valetrnsp) || 0,
        proventos: t.proventos, descontos: t.descontos, beneficios: t.beneficios, liquido: t.liquido,
      };
    }
    // Conferido: agora sim usa o salário CONGELADO naquele holerite (h.salariobase) — snapshot
    // gravado no momento da conferência, não muda mais se o cadastro mudar depois.
    const salariobase = Number(head.salariobase) || 0;
    const itens = (await pool.query(
      `SELECT tipo, descricao, valor FROM folhaitens WHERE idholerite = $1`,
      [head.idholerite]
    )).rows;
    const t = calcularTotais(salariobase, itens);
    return {
      idfuncionario: f.idfuncionario, nome: f.nome, idholerite: head.idholerite,
      origem: "real", status: head.status, dtpagamento: head.dtpagamento, comprovante: head.comprovante,
      conferido: head.conferido, conferidoEm: head.conferido_em,
      conferidoBeneficios: head.conferido_beneficios, conferidoBeneficiosEm: head.conferido_beneficios_em,
      statusBeneficios: head.status_beneficios, dtpagamentoBeneficios: head.dtpagamento_beneficios,
      salariobase, itens,
      valealimDia: Number(f.valealim) || 0, valetrnspDia: Number(f.valetrnsp) || 0,
      proventos: t.proventos, descontos: t.descontos, beneficios: t.beneficios, liquido: t.liquido,
    };
  }

  const salariobase = Number(f.salario) || 0;

  const itens = await montarItensPrevisaoMensal(idempresa, f, mes, ano, params, diasUteis);
  const t = calcularTotais(salariobase, itens);
  return {
    idfuncionario: f.idfuncionario, nome: f.nome, idholerite: null,
    origem: "previsao", status: "Previsão", dtpagamento: null, comprovante: null,
    conferido: false, conferidoEm: null, conferidoBeneficios: false, conferidoBeneficiosEm: null,
    statusBeneficios: "Previsão", dtpagamentoBeneficios: null,
    salariobase, itens,
    valealimDia: Number(f.valealim) || 0, valetrnspDia: Number(f.valetrnsp) || 0,
    proventos: t.proventos, descontos: t.descontos, beneficios: t.beneficios, liquido: t.liquido,
  };
}

// VA/VT + INSS/IRRF de uma competência mensal calculados do zero, só a partir do cadastro
// atual do funcionário — sem olhar histórico de mês anterior. Usado tanto por
// montarItensPrevisaoMensal (quando não há mês anterior pra replicar) quanto por
// computarLinhaFolha (enquanto a competência ainda não foi conferida — ver ali).
// `proventosTributaveis`: proventos lançados à mão NO holerite (hora extra, comissão...) — entram
// no bruto do INSS/IRRF junto com o salário, mesma conta do botão "Calcular INSS/IRRF"
// (POST /holerite/calcular). Proventos pagos à parte (folhaproventos) não passam por aqui.
// `diasFerias`: dias do mês trabalhado que já foram pagos no recibo de férias (ajusteFeriasMensal)
// — saem do salário como desconto próprio (FERIAS_MES_DESC) e da base do INSS/IRRF. O salário
// base do holerite continua o do cadastro de propósito: é esse campo que o botão "Salvar no
// cadastro" grava de volta, e ele não pode virar o salário proporcional do mês. `diasUteis`
// já chega sem os dias de férias do mês vigente (VA/VT).
function montarItensDoZero(f, params, diasUteis, proventosTributaveis = 0, diasFerias = 0) {
  const salariobase = Number(f.salario) || 0;
  const descontoFerias = diasFerias > 0 ? round2(salariobase / 30 * diasFerias) : 0;
  const bruto = salariobase - descontoFerias + (Number(proventosTributaveis) || 0);
  const va = Math.round((Number(f.valealim) || 0) * diasUteis * 100) / 100;
  const vt = Math.round((Number(f.valetrnsp) || 0) * diasUteis * 100) / 100;
  const temImposto = perfilTemImposto(f.perfil);
  const inss = temImposto ? calcularINSS(bruto, params) : 0;
  const ir = temImposto ? calcularIRRF(bruto, inss, f.dependentes, params) : { irrf: 0 };
  const itens = [
    { tipo: "B", descricao: VA_DESC, valor: va },
    { tipo: "B", descricao: VT_DESC, valor: vt },
    { tipo: "D", descricao: "INSS", valor: inss },
    { tipo: "D", descricao: "IRRF", valor: ir.irrf },
  ];
  if (descontoFerias > 0) itens.push({ tipo: "D", descricao: FERIAS_MES_DESC, valor: descontoFerias });
  return itens;
}

// Descrições dos itens que montarItensDoZero recalcula sozinho. Todo o resto em folhaitens foi
// lançado à mão (hora extra, plano de saúde, adiantamento...) e tem que sobreviver ao recálculo.
const DESCRICOES_AUTOMATICAS = new Set([VA_DESC, VT_DESC, "INSS", "IRRF", FERIAS_MES_DESC]);

// Recalcula os itens automáticos (VA/VT/INSS/IRRF) de um holerite MENSAL a partir do cadastro,
// preservando os lançados à mão. Antes disso, a lista (computarLinhaFolha) e o PUT /conferir
// usavam montarItensDoZero puro — que devolve SÓ os automáticos —, então um provento/desconto
// manual sumia da lista e era APAGADO do banco no momento da conferência.
function mesclarItensAutomaticos(itensGravados, f, params, diasUteis, diasFerias = 0) {
  const manuais = (itensGravados || []).filter((i) => !DESCRICOES_AUTOMATICAS.has(i.descricao));
  const proventosManuais = manuais
    .filter((i) => i.tipo === "P")
    .reduce((s, i) => s + (Number(i.valor) || 0), 0);
  return [...montarItensDoZero(f, params, diasUteis, proventosManuais, diasFerias), ...manuais];
}

// Dias úteis de VA/VT do mês vigente descontando os dias de férias programadas.
function diasUteisSemFerias(diasUteis, ajuste) {
  return Math.max(0, (Number(diasUteis) || 0) - (ajuste?.diasUteisFerias || 0));
}

// Monta os itens (VA/VT + INSS/IRRF) de uma competência mensal sem holerite salvo ainda —
// réplica do último holerite anterior (recalculando só VA/VT pelos dias úteis), ou do zero
// se não há histórico. Compartilhado por computarLinhaFolha (prévia, não persiste) e
// garantirHoleriteMensal (persiste de verdade).
async function montarItensPrevisaoMensal(idempresa, f, mes, ano, params, diasUteis) {
  const salariobase = Number(f.salario) || 0;
  const va = Math.round((Number(f.valealim) || 0) * diasUteis * 100) / 100;
  const vt = Math.round((Number(f.valetrnsp) || 0) * diasUteis * 100) / 100;

  const ant = (await pool.query(
    `SELECT idholerite FROM folhaholerite
      WHERE idempresa = $1 AND idfuncionario = $2 AND COALESCE(tipo,'mensal') = 'mensal'
        AND (ano < $3 OR (ano = $3 AND mes < $4))
      ORDER BY ano DESC, mes DESC LIMIT 1`,
    [idempresa, f.idfuncionario, ano, mes]
  )).rows[0];

  if (ant) {
    // Replica os itens do mês anterior; recalcula VA/VT pelos dias úteis do mês atual e
    // INSS/IRRF pela tabela de alíquotas vigente sobre o salário atual — não pode só copiar o
    // valor do mês passado, porque salário/dependentes/alíquota podem ter mudado de lá pra cá.
    // Atualiza os que já existiam (por descrição) e GARANTE que VA/VT/INSS/IRRF sempre existam
    // (insere se o mês replicado não tinha — histórico incompleto de antes desse cálculo
    // existir); descontos manuais recorrentes (ex.: plano de saúde) são replicados como estão.
    // PROVENTOS manuais (hora extra, comissão...) NÃO são replicados: são do mês em que foram
    // lançados — copiar pro mês seguinte pagaria a mesma hora extra de novo.
    const temImposto = perfilTemImposto(f.perfil);
    const inss = temImposto ? calcularINSS(salariobase, params) : 0;
    const ir = temImposto ? calcularIRRF(salariobase, inss, f.dependentes, params) : { irrf: 0 };
    const itensAnteriores = (await pool.query(
      `SELECT tipo, descricao, valor FROM folhaitens WHERE idholerite = $1`,
      [ant.idholerite]
    )).rows.filter((i) => i.tipo !== "P" && i.descricao !== FERIAS_MES_DESC).map((i) => {
      if (i.tipo === "B" && i.descricao === VA_DESC) return { ...i, valor: va };
      if (i.tipo === "B" && i.descricao === VT_DESC) return { ...i, valor: vt };
      if (i.tipo === "D" && i.descricao === "INSS") return { ...i, valor: inss };
      if (i.tipo === "D" && i.descricao === "IRRF") return { ...i, valor: ir.irrf };
      return i;
    });
    const tem = (descricao) => itensAnteriores.some((i) => i.descricao === descricao);
    if (!tem(VA_DESC)) itensAnteriores.push({ tipo: "B", descricao: VA_DESC, valor: va });
    if (!tem(VT_DESC)) itensAnteriores.push({ tipo: "B", descricao: VT_DESC, valor: vt });
    if (!tem("INSS")) itensAnteriores.push({ tipo: "D", descricao: "INSS", valor: inss });
    if (!tem("IRRF")) itensAnteriores.push({ tipo: "D", descricao: "IRRF", valor: ir.irrf });
    return itensAnteriores;
  }

  // Sem histórico: monta do zero (VA/VT + INSS/IRRF sobre o salário base).
  return montarItensDoZero(f, params, diasUteis);
}

// Garante que existe um holerite MENSAL real (persistido) pra competência — cria com o
// mesmo preset da prévia (montarItensPrevisaoMensal) se ainda não existir. Idempotente
// (ON CONFLICT DO NOTHING). Com isso, o RH não precisa mais entrar todo mês pra salvar cada
// holerite: eles já nascem prontos (réplica do mês anterior + INSS/IRRF recalculado), e só
// precisam ser abertos quando algo mudar (falta, ajuste, novo dependente etc.) — inclusive
// já dá pra pagar direto pela tela de Vencimentos, sem precisar abrir o holerite antes.
async function garantirHoleriteMensal(idempresa, f, mes, ano, params, diasUteis) {
  if (antesDoInicioFolha(mes, ano)) return; // ver INICIO_FOLHA
  const salariobase = Number(f.salario) || 0;
  const criado = await pool.query(
    `INSERT INTO folhaholerite (idempresa, idfuncionario, mes, ano, salariobase, status, tipo)
     VALUES ($1, $2, $3, $4, $5, 'Pendente', 'mensal')
     ON CONFLICT (idempresa, idfuncionario, mes, ano, tipo) DO NOTHING
     RETURNING idholerite`,
    [idempresa, f.idfuncionario, mes, ano, salariobase]
  );
  const idholerite = criado.rows[0]?.idholerite;
  if (!idholerite) return; // já existia (ou outra requisição criou primeiro)

  const itens = await montarItensPrevisaoMensal(idempresa, f, mes, ano, params, diasUteis);
  for (const i of itens) {
    await pool.query(
      `INSERT INTO folhaitens (idholerite, tipo, descricao, valor) VALUES ($1, $2, $3, $4)`,
      [idholerite, i.tipo, i.descricao, i.valor]
    );
  }
}

// Monta a linha do 13º salário (1ª ou 2ª parcela) de UM funcionário numa competência: usa o
// holerite tipo='13' já salvo no mês, se existir; senão monta a PREVISÃO com o mesmo preset
// usado na tela de RH (preset13, ver public/js/RH.js) — 1ª parcela = metade do salário sem
// descontos, 2ª parcela = 13º cheio menos o adiantamento da 1ª. Reaproveitado por
// GET /contas-pagar (routes/rotaMain.js), que gera automaticamente as 2 parcelas do ano
// (vencimentos fixos 20/11 e 30/12), diferente de férias/rescisão que só aparecem quando o
// RH já gerou o holerite manualmente na tela de RH.
async function computarLinha13(idempresa, f, mes, ano, parcela, params) {
  const salariobase = Number(f.salario) || 0;

  const head = (await pool.query(
    `SELECT h.idholerite, h.status, h.dtpagamento, h.comprovante, h.conferido, h.conferido_em
       FROM folhaholerite h
      WHERE h.idempresa = $1 AND h.idfuncionario = $2 AND h.mes = $3 AND h.ano = $4 AND h.tipo = '13'`,
    [idempresa, f.idfuncionario, mes, ano]
  )).rows[0];

  if (head) {
    const itens = (await pool.query(
      `SELECT tipo, descricao, valor FROM folhaitens WHERE idholerite = $1`,
      [head.idholerite]
    )).rows;
    const t = calcularTotais(salariobase, itens, "13");
    return {
      idfuncionario: f.idfuncionario, nome: f.nome, idholerite: head.idholerite,
      origem: "real", status: head.status, dtpagamento: head.dtpagamento, comprovante: head.comprovante,
      conferido: head.conferido, conferidoEm: head.conferido_em,
      proventos: t.proventos, descontos: t.descontos, beneficios: t.beneficios, liquido: t.liquido,
    };
  }

  const s = salariobase;
  let itens;
  if (parcela === "1") {
    itens = [{ tipo: "P", descricao: "13º salário (1ª parcela)", valor: s / 2 }];
  } else {
    itens = [
      { tipo: "P", descricao: "13º salário", valor: s },
      { tipo: "D", descricao: "Adiantamento 1ª parcela", valor: s / 2 },
    ];
    // Prévia (holerite ainda não gerado): mesma conta que garantirHolerite13 vai persistir,
    // pra não mostrar um valor em Vencimentos e gerar outro quando a data realmente chegar.
    if (params && perfilTemImposto(f.perfil)) {
      const inss = calcularINSS(s, params);
      const ir = calcularIRRF(s, inss, f.dependentes, params);
      if (inss > 0) itens.push({ tipo: "D", descricao: "INSS", valor: inss });
      if (ir.irrf > 0) itens.push({ tipo: "D", descricao: "IRRF", valor: ir.irrf });
    }
  }

  const t = calcularTotais(salariobase, itens, "13");
  return {
    idfuncionario: f.idfuncionario, nome: f.nome, idholerite: null,
    origem: "previsao", status: "Previsão", dtpagamento: null, comprovante: null,
    conferido: false, conferidoEm: null,
    proventos: t.proventos, descontos: t.descontos, beneficios: t.beneficios, liquido: t.liquido,
  };
}

// Garante que existe um holerite REAL (persistido) do 13º de um funcionário/parcela — cria
// com o preset padrão (preset13) se ainda não existir. Idempotente (ON CONFLICT DO NOTHING),
// pra suportar corrida entre requisições simultâneas. Usado por GET /contas-pagar a partir de
// 1/11 (1ª parcela) e 1/12 (2ª parcela): o 13º é geral e no mesmo período pra todo mundo, por
// isso é gerado automaticamente — diferente de férias/rescisão, que só existem quando o RH
// gera manualmente na tela de RH.
// INSS/IRRF do 13º incidem só na 2ª parcela, sobre o valor CHEIO do 13º (não sobre o salário
// mensal — por isso não reaproveita o botão "Calcular INSS/IRRF" do holerite mensal, que usa
// a base errada pra esse caso). Usa a mesma tabela progressiva (calcularINSS/calcularIRRF),
// só que aplicada isoladamente sobre `s` (o 13º cheio). Se o RH precisar ajustar pra alguém
// (rescisão no meio do ano, afastamento etc.), edita manualmente na tela de RH depois.
async function garantirHolerite13(idempresa, f, mes, ano, parcela, params) {
  if (antesDoInicioFolha(mes, ano)) return; // ver INICIO_FOLHA
  const s = Number(f.salario) || 0;
  const criado = await pool.query(
    `INSERT INTO folhaholerite (idempresa, idfuncionario, mes, ano, salariobase, status, tipo)
     VALUES ($1, $2, $3, $4, $5, 'Pendente', '13')
     ON CONFLICT (idempresa, idfuncionario, mes, ano, tipo) DO NOTHING
     RETURNING idholerite`,
    [idempresa, f.idfuncionario, mes, ano, s]
  );
  const idholerite = criado.rows[0]?.idholerite;
  if (!idholerite) return; // já existia (ou outra requisição criou primeiro)

  let itens;
  if (parcela === "1") {
    itens = [{ tipo: "P", descricao: "13º salário (1ª parcela)", valor: s / 2 }];
  } else {
    itens = [
      { tipo: "P", descricao: "13º salário", valor: s },
      { tipo: "D", descricao: "Adiantamento 1ª parcela", valor: s / 2 },
    ];
    if (params && perfilTemImposto(f.perfil)) {
      const inss = calcularINSS(s, params);
      const ir = calcularIRRF(s, inss, f.dependentes, params);
      if (inss > 0) itens.push({ tipo: "D", descricao: "INSS", valor: inss });
      if (ir.irrf > 0) itens.push({ tipo: "D", descricao: "IRRF", valor: ir.irrf });
    }
  }
  for (const i of itens) {
    await pool.query(
      `INSERT INTO folhaitens (idholerite, tipo, descricao, valor) VALUES ($1, $2, $3, $4)`,
      [idholerite, i.tipo, i.descricao, i.valor]
    );
  }
}

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

    // mes/ano aqui são o VENCIMENTO do salário (o que a tela seleciona) — a tabela de
    // INSS/IRRF usa o mês TRABALHADO do salário (o anterior, ver competenciaAnterior()), mas
    // dias úteis de VA/VT usam o mês VIGENTE direto (benefício não tem defasagem: trabalha e
    // recebe no mesmo mês).
    const { mes: mesComp, ano: anoComp } = competenciaAnterior(mes, ano);
    const params = await obterParametros(anoComp);
    const diasUteis = contarDiasBeneficio(ano, mes);

    // Antes do início da folha no sistema não há o que mostrar/conferir (ver INICIO_FOLHA).
    if (antesDoInicioFolha(mes, ano)) {
      return res.json({
        linhas: [], linhas13: [], mes, ano, mesComp, anoComp, diasUteis,
        totais: { proventos: 0, descontos: 0, liquido: 0, pagos: 0, pendentes: 0, previsoes: 0, qtd: 0 },
        antesDoInicio: true, inicioFolha: INICIO_FOLHA,
      });
    }

    const funcs = (await pool.query(
      `SELECT f.idfuncionario, f.nome, fe.salario, fe.dependentes, fe.valealim, fe.valetrnsp, fe.perfil
         FROM funcionarios f
         JOIN funcionarioempresas fe ON fe.idfuncionario = f.idfuncionario
        WHERE fe.idempresa = $1
          AND fe.perfil = ANY($2)
          AND COALESCE(fe.ativo, true) = true
        ORDER BY f.nome ASC`,
      [idempresa, PERFIS_FOLHA]
    )).rows;

    const linhas = [];
    for (const f of funcs) {
      await garantirHoleriteMensal(idempresa, f, mes, ano, params, diasUteis);
      linhas.push(await computarLinhaFolha(idempresa, f, mes, ano, params, diasUteis));
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

    // 13º só existe no mês exato de vencimento de cada parcela (20/11 = 1ª, 30/12 = 2ª) — não
    // tem defasagem vencimento×competência nem benefícios (VA/VT), por isso fica numa lista
    // separada (linhas13), fora dos totais/resumo mensal de cima. Mesmo botão "Conferir" da
    // parte de cima (PUT /holerite/:id/conferir) — só entra em Contas a Pagar depois disso
    // (ver GET /contas-pagar em rotaMain.js).
    const linhas13 = [];
    if (mes === 11 || mes === 12) {
      const parcela = mes === 11 ? "1" : "2";
      const params13 = await obterParametros(ano);
      for (const f of funcs) {
        await garantirHolerite13(idempresa, f, mes, ano, parcela, params13);
        const linha13 = await computarLinha13(idempresa, f, mes, ano, parcela, params13);
        if (linha13.idholerite) linhas13.push({ ...linha13, parcela });
      }
    }

    // Recibos de férias com INÍCIO de gozo neste mês — lista própria, fora dos totais da folha
    // mensal (igual ao 13º). Mesmo "Conferir" (PUT /holerite/:id/conferir); só depois disso vão
    // pra Contas a Pagar.
    const linhasFerias = await listarRecibosFerias(idempresa, { mes, ano });

    res.json({ linhas, linhas13, linhasFerias, totais, mes, ano, mesComp, anoComp, diasUteis });
  } catch (error) {
    console.error("ERRO RH /folha:", error);
    res.status(500).json({ error: error.message });
  }
});

// Helpers reaproveitados por routes/rotaMain.js (GET /contas-pagar) pra casar cada conta de
// funcionário projetada com a folha (real ou prevista) da mesma competência.
router.helpersFolha = {
  obterParametros, contarDiasBeneficio, ultimoDiaUtil, computarLinhaFolha, garantirHoleriteMensal, computarLinha13,
  garantirHolerite13, PERFIS_FOLHA, competenciaAnterior, calcularINSS, calcularIRRF, VA_DESC, VT_DESC,
  montarItensDoZero, INICIO_FOLHA, antesDoInicioFolha, SQL_FOLHA_A_PARTIR_DO_INICIO, listarProventosParte,
  montarPeriodosFerias, carregarBaseFerias, somarDiasIso, somarAnosIso, diferencaDias,
  listarRecibosFerias, ajusteFeriasMensal,
};

module.exports = router;
