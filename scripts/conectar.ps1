# Rifalo - conectar GitHub con Firebase para que Claude publique solo (una sola vez).
# Uso (PowerShell):  irm https://raw.githubusercontent.com/bunkergrafic-png/ayudave/main/scripts/conectar.ps1 | iex
# - Guarda la llave de Firebase como secreto FIREBASE_SERVICE_ACCOUNT en GitHub (ayudave)
# - Da acceso a la app de Claude al repositorio "mano"
# - Lanza la publicacion de Rifalo
# La llave va directo de tu PC a GitHub (cifrada); no pasa por el chat.

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'
function Paso($t) { Write-Host ""; Write-Host "==> $t" -ForegroundColor Magenta }
function Bien($t) { Write-Host "    $t" -ForegroundColor Green }
function Falla($t) { Write-Host ""; Write-Host "ERROR: $t" -ForegroundColor Red; Write-Host "Toma una captura de esta ventana y enviasela a Claude."; Read-Host "Presiona Enter para cerrar"; exit 1 }
function Refrescar { $env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path', 'User') }

Write-Host ""
Write-Host "  RIFALO - conectar publicacion automatica" -ForegroundColor Yellow

Paso "Buscando la llave de Firebase en Descargas"
$key = Get-ChildItem "$HOME\Downloads" -Filter "ayudave-81546-firebase-adminsdk-*.json" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $key) { Falla "No encontre el archivo ayudave-81546-firebase-adminsdk-....json en Descargas." }
Bien "Encontrada: $($key.Name)"

Paso "Revisando la herramienta de GitHub (gh)"
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  Write-Host "    Instalando GitHub CLI (si Windows pide permiso, acepta)..."
  winget install -e --id GitHub.cli --accept-source-agreements --accept-package-agreements | Out-Host
  Refrescar
  if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    $p = "$env:ProgramFiles\GitHub CLI"
    if (Test-Path "$p\gh.exe") { $env:Path += ";$p" }
  }
  if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { Falla "No se pudo instalar GitHub CLI. Cierra y abre PowerShell y vuelve a correr el comando." }
}
Bien "gh listo"

Paso "Conectando con tu cuenta de GitHub"
& gh auth status *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host "    Se abrira el navegador. Copia el codigo de 8 letras que sale AQUI abajo," -ForegroundColor Yellow
  Write-Host "    pegalo en la pagina de GitHub y toca 'Authorize'." -ForegroundColor Yellow
  & gh auth login --hostname github.com --git-protocol https --web --scopes "repo,workflow"
  if ($LASTEXITCODE -ne 0) { Falla "No se pudo iniciar sesion en GitHub." }
}
Bien "Sesion de GitHub activa"

Paso "Guardando la llave como secreto en GitHub (ayudave)"
Get-Content $key.FullName -Raw | & gh secret set FIREBASE_SERVICE_ACCOUNT --repo bunkergrafic-png/ayudave
if ($LASTEXITCODE -ne 0) { Falla "No se pudo guardar el secreto." }
Bien "Secreto FIREBASE_SERVICE_ACCOUNT guardado"

Paso "Dando acceso a Claude al repositorio mano"
$inst = (& gh api /user/installations --jq '.installations[] | select(.app_slug | test("claude")) | .id' 2>$null | Select-Object -First 1)
$repoId = (& gh api repos/bunkergrafic-png/mano --jq .id 2>$null)
if ($inst -and $repoId) {
  & gh api -X PUT "/user/installations/$inst/repositories/$repoId" *> $null
  if ($LASTEXITCODE -eq 0) { Bien "Claude ya puede ver 'mano'" } else { Write-Host "    (La app de Claude probablemente ya tiene acceso a todos tus repositorios)" }
} else {
  Write-Host "    No pude hacerlo automatico. Se abre la pagina: en 'Claude' toca Configure, agrega 'mano' y guarda." -ForegroundColor Yellow
  Start-Process 'https://github.com/settings/installations'
}

Paso "Publicando Rifalo"
& gh workflow run deploy.yml --repo bunkergrafic-png/ayudave --ref main
if ($LASTEXITCODE -ne 0) { Falla "No se pudo lanzar la publicacion." }
Bien "Publicacion en marcha (tarda unos 3 minutos)"

Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host "  LISTO! Ya puedes cerrar esta ventana." -ForegroundColor Green
Write-Host "  Dile a Claude: 'listo'. Desde ahora el publica solo."
Write-Host "=============================================" -ForegroundColor Green
Read-Host "Presiona Enter para cerrar"
