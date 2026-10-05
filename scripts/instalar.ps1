# Rifalo - instalacion automatica en Firebase (ayudave-81546)
# Uso (PowerShell):  irm https://raw.githubusercontent.com/bunkergrafic-png/ayudave/main/scripts/instalar.ps1 | iex
# La llave de Firebase se usa solo en esta computadora; no se envia a ningun otro lado.

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
function Paso($t) { Write-Host ""; Write-Host "==> $t" -ForegroundColor Magenta }
function Falla($t) { Write-Host ""; Write-Host "ERROR: $t" -ForegroundColor Red; Write-Host "Toma una captura de esta ventana y enviasela a Claude."; Read-Host "Presiona Enter para cerrar"; exit 1 }

Write-Host ""
Write-Host "  RIFALO - instalacion automatica" -ForegroundColor Yellow
Write-Host "  Esto BORRA los datos viejos de ayudave, crea tu cuenta y publica la app."
Write-Host ""

# 1. Llave de Firebase
Paso "Buscando la llave de Firebase en Descargas"
$key = Get-ChildItem "$HOME\Downloads" -Filter "ayudave-81546-firebase-adminsdk-*.json" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $key) { Falla "No encontre el archivo ayudave-81546-firebase-adminsdk-....json en tu carpeta Descargas." }
Write-Host "    Encontrada: $($key.Name)" -ForegroundColor Green

$user = Read-Host "    Usuario para tu cuenta de super admin (Enter = admin)"
if (-not $user) { $user = 'admin' }
$name = Read-Host "    Tu nombre (Enter = Administrador)"
if (-not $name) { $name = 'Administrador' }

# 2. Node.js
Paso "Revisando Node.js"
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "    Instalando Node.js (puede pedir permiso de Windows, acepta)..."
  winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements | Out-Host
  $env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path', 'User')
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Falla "No se pudo instalar Node.js. Instalalo desde https://nodejs.org (boton LTS) y vuelve a correr el comando." }
}
Write-Host "    Node $(node -v)" -ForegroundColor Green

# 3. Descargar Rifalo
Paso "Descargando Rifalo desde GitHub"
$dir = Join-Path $env:TEMP 'rifalo-instalar'
if (Test-Path $dir) { Remove-Item $dir -Recurse -Force }
New-Item -ItemType Directory $dir | Out-Null
Invoke-WebRequest 'https://github.com/bunkergrafic-png/ayudave/archive/refs/heads/main.zip' -OutFile "$dir\rifalo.zip"
Expand-Archive "$dir\rifalo.zip" -DestinationPath $dir
Set-Location (Join-Path $dir 'ayudave-main')

Paso "Instalando dependencias (2-4 minutos)"
& npm.cmd install --no-audit --no-fund --loglevel=error
if ($LASTEXITCODE -ne 0) { Falla "npm install fallo." }

# 4. Configurar Firebase
$env:GOOGLE_APPLICATION_CREDENTIALS = $key.FullName
$env:RIFALO_ADMIN_USER = $user.ToLower()
$env:RIFALO_ADMIN_NAME = $name

Paso "Activando inicio de sesion (usuario/clave y anonimo)"
& node scripts/admin.mjs auth-config
while ($LASTEXITCODE -eq 3) {
  Write-Host ""
  Write-Host "    Falta un clic en Firebase (gratis, sin tarjeta):" -ForegroundColor Yellow
  Write-Host "    1. Se abrio la pagina de Authentication. Toca el boton 'Comenzar' (Get started)."
  Write-Host "    2. Si te muestra proveedores, activa 'Correo electronico/contrasena' y 'Anonimo' (si no, no importa)."
  Start-Process 'https://console.firebase.google.com/project/ayudave-81546/authentication'
  Read-Host "    Cuando lo hayas hecho, vuelve aqui y presiona Enter"
  & node scripts/admin.mjs auth-config
}
if ($LASTEXITCODE -ne 0) { Falla "No se pudo configurar el inicio de sesion." }

Paso "Borrando los datos viejos de ayudave"
& node scripts/admin.mjs wipe
if ($LASTEXITCODE -ne 0) { Falla "No se pudieron borrar los datos viejos." }

Paso "Creando tu cuenta, la organizacion y la rifa de Zenaida"
$out = & node scripts/admin.mjs bootstrap 2>&1
$out | Out-Host
if ($LASTEXITCODE -ne 0) { Falla "No se pudo crear la cuenta." }

Paso "Compilando y publicando la app"
& npm.cmd run build --silent
if ($LASTEXITCODE -ne 0) { Falla "La compilacion fallo." }
& npx.cmd firebase deploy --only "hosting,firestore" --project ayudave-81546 --non-interactive
if ($LASTEXITCODE -ne 0) {
  Write-Host "    Reintentando: creando el sitio de Hosting..."
  & npx.cmd firebase hosting:sites:create ayudave-81546 --project ayudave-81546 --non-interactive
  & npx.cmd firebase deploy --only "hosting,firestore" --project ayudave-81546 --non-interactive
  if ($LASTEXITCODE -ne 0) { Falla "No se pudo publicar." }
}

$pass = ($out | Select-String 'Clave temporal:\s+(\S+)').Matches.Groups[1].Value
Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host "  LISTO! Rifalo esta publicado" -ForegroundColor Green
Write-Host "  Entra en:       https://ayudave-81546.web.app/login"
Write-Host "  Usuario:        $($user.ToLower())"
Write-Host "  Clave temporal: $pass   (la app te pedira cambiarla)"
Write-Host "  Pagina publica: https://ayudave-81546.web.app/r/zenaida"
Write-Host "=============================================" -ForegroundColor Green
Write-Host "Guarda tu clave. No hace falta enviarla a Claude; solo dile 'ya quedo'."
Start-Process 'https://ayudave-81546.web.app/login'
Read-Host "Presiona Enter para cerrar"
