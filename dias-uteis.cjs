// Confere os dias úteis de 2026 (com e sem feriados) e o cadastro de VA/VT do 754.
const { Pool } = require("pg");
require("dotenv").config();
const { contarDiasUteis } = require("C:/Users/user/JAs/routes/rotaRH.js").helpersFolha;

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port: process.env.DB_PORT,
});

function semFeriados(ano, mes) {
  const ultimo = new Date(ano, mes, 0).getDate();
  let n = 0;
  for (let d = 1; d <= ultimo; d++) {
    const dow = new Date(ano, mes - 1, d).getDay();
    if (dow !== 0 && dow !== 6) n++;
  }
  return n;
}

(async () => {
  const linhas = [];
  for (let m = 1; m <= 12; m++) {
    linhas.push({
      mes: m,
      com_desconto_feriado: contarDiasUteis(2026, m),
      so_seg_a_sex: semFeriados(2026, m),
    });
  }
  console.log("== dias úteis 2026 ==");
  console.table(linhas);

  const { rows } = await pool.query(
    `SELECT idempresa, salario, valealim, valetrnsp FROM funcionarioempresas WHERE idfuncionario = 754`
  );
  console.log("== cadastro 754 (VA/VT por dia) ==");
  console.table(rows);
  rows.forEach((r) => {
    console.log(
      `empresa ${r.idempresa}: VA ${r.valealim}/dia x21 = ${(Number(r.valealim) * 21).toFixed(2)} | x22 = ${(Number(r.valealim) * 22).toFixed(2)}`,
      `| VT ${r.valetrnsp}/dia x21 = ${(Number(r.valetrnsp) * 21).toFixed(2)} | x22 = ${(Number(r.valetrnsp) * 22).toFixed(2)}`
    );
  });

  await pool.end();
})().catch((e) => {
  console.error("FALHOU:", e.message);
  process.exit(1);
});
