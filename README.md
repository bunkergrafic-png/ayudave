# 🎟️ Rifalo

Aplicación web para organizar rifas con varios vendedores, pagos verificados y sorteo transparente.
Funciona desde el celular (se puede instalar como app) y usa Firebase (proyecto `ayudave-81546`).

## Qué hace

- **Rifas configurables**: 50, 100, 200, 500, 1.000, 10.000 números o la cantidad que quieras, precio, moneda, varios premios con foto.
- **Ningún número se vende dos veces**: cada venta es una transacción en la base de datos y las reglas de seguridad lo garantizan.
- **Roles**: super admin (plataforma) → organizadores (clientes) → co-admins y vendedores por rifa, cada uno con usuario y clave.
- **Ventas** desde el tablero: varios números a la vez, número al azar, datos del comprador, pago ahora o después.
- **Plazo de pago**: si no se registra ningún pago, el número se libera solo. Con abono, no se libera.
- **Pagos**: efectivo, pago móvil, transferencia y Binance/USDT. Datos obligatorios (banco, teléfono, cédula, referencia), captura opcional, detección de referencias repetidas y verificación en dos pasos.
- **Tasa BCV automática** (ve.dolarapi.com) y calculadora de divisas USD / EUR / Bs.
- **Página pública** por rifa (`/r/<enlace>`): la gente escoge y aparta números. Los apartados llegan al vendedor del enlace (`?v=usuario`), al que escoja el comprador o a la **bandeja compartida**.
- **Boleto digital** verificable (`/t/...`) por WhatsApp (y por correo con EmailJS, opcional).
- **Control de efectivo** por vendedor: cobrado, entregado, comisión y saldo.
- **Sorteo** según la regla de cada rifa (todo vendido, todo pagado, fecha o manual) y método (aleatorio criptográfico con animación, lotería oficial o sorteo externo con evidencia).
- **Reportes**: avance, ventas por día, por método, ranking de vendedores, exportar a Excel y PDF, historial completo de cambios.

## Desarrollo

```bash
npm install
npm run emulators                       # Firestore + Auth locales (requiere Java)
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 node scripts/admin.mjs demo
VITE_EMULATOR=1 npm run dev             # http://localhost:5173  (admin / admin123)
```

Pruebas:

```bash
npm run test:rules                      # reglas de seguridad (22 casos)
SHOTS=./shots node tests/e2e.mjs        # recorrido completo en el navegador (con emuladores y vite corriendo)
```

## Administración del proyecto Firebase

Con la cuenta de servicio en `FIREBASE_SERVICE_ACCOUNT` (JSON) o `GOOGLE_APPLICATION_CREDENTIALS` (ruta):

```bash
node scripts/admin.mjs wipe          # borra todos los datos y usuarios
node scripts/admin.mjs auth-config   # activa inicio de sesión con usuario/clave y anónimo
node scripts/admin.mjs bootstrap     # crea el super admin, la organización y la primera rifa
npm run deploy                       # compila y publica hosting + reglas
```

Al hacer push a `main`, GitHub Actions corre las pruebas y publica (si existe el secreto `FIREBASE_SERVICE_ACCOUNT`).

## Estructura de datos (Firestore)

| Colección | Contenido |
|---|---|
| `users/{uid}` | perfil, rol, organización (`mid` = identidad estable) |
| `usernames/{usuario}` | usuario → correo interno de acceso |
| `orgs/{id}` | organización (cliente) y ajustes (EmailJS) |
| `raffles/{id}` | configuración de la rifa, equipo, premios y ganadores |
| `raffles/{id}/chunks/{n}` | tablero compacto: 500 números por documento |
| `raffles/{id}/orders` | ventas y apartados (comprador, números, montos) |
| `raffles/{id}/payments` | pagos (pendiente / verificado / rechazado) |
| `raffles/{id}/receipts` | capturas de comprobantes (comprimidas) |
| `raffles/{id}/handovers` | entregas de efectivo de vendedores |
| `raffles/{id}/logs` | historial de cambios |
| `raffles/{id}/tokens` | boletos públicos verificables (sin datos sensibles) |
| `slugs/{enlace}` | enlace bonito → rifa |
| `config/rates` | última tasa BCV |

Todo funciona en el plan gratuito de Firebase (Spark).
