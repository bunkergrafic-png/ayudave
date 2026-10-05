# Rifalo - publicar una actualizacion (NO borra datos).
# Uso (PowerShell):  irm https://raw.githubusercontent.com/bunkergrafic-png/ayudave/main/scripts/publicar.ps1 | iex

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
function Paso($t) { Write-Host ""; Write-Host "==> $t" -ForegroundColor Magenta }
function Falla($t) { Write-Host ""; Write-Host "ERROR: $t" -ForegroundColor Red; Write-Host "Toma una captura de esta ventana y enviasela a Claude."; Read-Host "Presiona Enter para cerrar"; exit 1 }

Write-Host ""
Write-Host "  RIFALO - publicar actualizacion (tus datos NO se tocan)" -ForegroundColor Yellow

Paso "Buscando la llave de Firebase en Descargas"
$key = Get-ChildItem "$HOME\Downloads" -Filter "ayudave-81546-firebase-adminsdk-*.json" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $key) { Falla "No encontre el archivo ayudave-81546-firebase-adminsdk-....json en Descargas." }
Write-Host "    Encontrada: $($key.Name)" -ForegroundColor Green
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Falla "Falta Node.js. Corre primero instalar.ps1 o instala Node desde https://nodejs.org" }

Paso "Descargando la version nueva desde GitHub"
$dir = Join-Path $env:TEMP 'rifalo-publicar'
if (Test-Path $dir) { Remove-Item $dir -Recurse -Force }
New-Item -ItemType Directory $dir | Out-Null
Invoke-WebRequest "https://github.com/bunkergrafic-png/ayudave/archive/refs/heads/main.zip?t=$(Get-Date -UFormat %s)" -OutFile "$dir\rifalo.zip"
Expand-Archive "$dir\rifalo.zip" -DestinationPath $dir
Set-Location (Join-Path $dir 'ayudave-main')

Paso "Instalando dependencias (1-3 minutos)"
& npm.cmd install --no-audit --no-fund --loglevel=error
if ($LASTEXITCODE -ne 0) { Falla "npm install fallo." }

Paso "Compilando y publicando"
$env:GOOGLE_APPLICATION_CREDENTIALS = $key.FullName
& npm.cmd run build --silent
if ($LASTEXITCODE -ne 0) { Falla "La compilacion fallo." }
& npx.cmd firebase deploy --only "hosting,firestore" --project ayudave-81546 --non-interactive
if ($LASTEXITCODE -ne 0) { Falla "No se pudo publicar." }

Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host "  LISTO! Actualizacion publicada" -ForegroundColor Green
Write-Host "  https://ayudave-81546.web.app"
Write-Host "  (Si no ves los cambios, recarga la pagina 1 o 2 veces)"
Write-Host "=============================================" -ForegroundColor Green
Read-Host "Presiona Enter para cerrar"
