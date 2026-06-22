// Script de setup para novos integrantes.
// Verifica se o Python está instalado, instala as dependências do Node e do Python.
// Uso: npm run setup

const { execSync, spawnSync } = require("child_process");

function log(msg) {
  console.log(`\n\x1b[36m> ${msg}\x1b[0m`);
}
function ok(msg) {
  console.log(`\x1b[32m✓ ${msg}\x1b[0m`);
}
function fail(msg) {
  console.error(`\x1b[31m✗ ${msg}\x1b[0m`);
}

// Descobre qual comando Python existe na máquina (python ou python3)
function detectarPython() {
  for (const cmd of ["python", "python3"]) {
    const r = spawnSync(cmd, ["--version"], { encoding: "utf8" });
    if (r.status === 0) {
      const versao = (r.stdout || r.stderr || "").trim();
      return { cmd, versao };
    }
  }
  return null;
}

function run(cmd) {
  execSync(cmd, { stdio: "inherit" });
}

(function main() {
  console.log("=== Setup do projeto JAs ===");

  // 1) Verifica Python
  log("Verificando instalação do Python...");
  const py = detectarPython();
  if (!py) {
    fail("Python não encontrado!");
    console.log(
      "  Instale o Python 3 em https://www.python.org/downloads/ " +
        "(marque a opção 'Add Python to PATH') e rode 'npm run setup' novamente."
    );
    process.exit(1);
  }
  ok(`Python encontrado: ${py.versao} (comando: ${py.cmd})`);

  // 2) Dependências do Node
  log("Instalando dependências do Node (npm install)...");
  try {
    run("npm install");
    ok("Dependências do Node instaladas.");
  } catch {
    fail("Falha ao instalar dependências do Node.");
    process.exit(1);
  }

  // 3) Dependências do Python
  log("Instalando dependências do Python (requirements.txt)...");
  try {
    run(`${py.cmd} -m pip install --upgrade pip`);
    run(`${py.cmd} -m pip install -r requirements.txt`);
    ok("Dependências do Python instaladas.");
  } catch {
    fail("Falha ao instalar dependências do Python.");
    process.exit(1);
  }

  console.log("\n\x1b[32m=== Setup concluído com sucesso! ===\x1b[0m");
})();
