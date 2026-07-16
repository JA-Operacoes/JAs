# =============================================================================
# promover-teste.ps1
# -----------------------------------------------------------------------------
# Leva o banco LOCAL (Postgres nativo) para o ambiente de TESTE (Docker).
#
# Faz os 3 passos numa tacada, pra ninguem esquecer o -v (que e obrigatorio
# para o teste reler o dump):
#   1. pg_dump do banco local  -> gera a "foto" teste_Docker.sql
#   2. down -v do teste         -> apaga o volume (banco vazio)
#   3. up do teste              -> restaura a foto nova no JA_teste
#
# ATENCAO: isso APAGA o que estiver so no teste e substitui pela copia do local.
#
# Uso (na raiz do projeto):
#   ./db/promover-teste.ps1
# =============================================================================

$ErrorActionPreference = "Stop"

# --- Configuracao ------------------------------------------------------------
$BackupDir   = "C:\Users\user\Backup Local"             # pasta com o historico
$DiaAtual    = Get-Date -Format "yyyy-MM-dd"            # ex: 2026-07-13
$DumpPath    = Join-Path $BackupDir "Backup-$DiaAtual.sql"  # foto do dia (formato -Fc)
$DbLocalUser = "postgres"
$DbLocalHost = "localhost"
$DbLocalName = "JA"

# Caminho da raiz do projeto (uma pasta acima deste script)
$Raiz = Split-Path -Parent $PSScriptRoot
Set-Location $Raiz

$ComposeArgs = @(
  "-p", "jasystem-test",
  "-f", "compose.yaml",
  "-f", "compose.test.yaml",
  "--env-file", ".env.test"
)

# --- Confirmacao -------------------------------------------------------------
Write-Host ""
Write-Host "Isso vai SUBSTITUIR todo o banco de TESTE (JA_teste) pela copia atual" -ForegroundColor Yellow
Write-Host "do banco LOCAL ($DbLocalName em $DbLocalHost)." -ForegroundColor Yellow
$resp = Read-Host "Continuar? (s/N)"
if ($resp -ne "s") { Write-Host "Cancelado."; exit 0 }

# --- 1. pg_dump do banco local ----------------------------------------------
if (-not (Test-Path $BackupDir)) { New-Item -ItemType Directory -Path $BackupDir | Out-Null }
Write-Host "`n[1/3] Gerando backup do banco local -> $DumpPath" -ForegroundColor Cyan
pg_dump -U $DbLocalUser -h $DbLocalHost -Fc $DbLocalName -f $DumpPath
Write-Host "      Backup do dia gerado (backups antigos sao mantidos)." -ForegroundColor Green

# --- 2. Resetar o teste (apaga o volume) ------------------------------------
Write-Host "`n[2/3] Derrubando o teste e apagando o volume (down -v)..." -ForegroundColor Cyan
docker compose @ComposeArgs down -v

# --- 3. Subir o teste (restaura a foto nova) --------------------------------
Write-Host "`n[3/3] Subindo o teste (vai restaurar o dump novo)..." -ForegroundColor Cyan
docker compose @ComposeArgs up -d --build

Write-Host "`nPronto. Teste atualizado com a copia do banco local." -ForegroundColor Green
Write-Host "Acesse: http://localhost:3001" -ForegroundColor Green
