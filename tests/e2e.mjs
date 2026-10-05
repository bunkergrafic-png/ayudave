// Prueba de punta a punta contra los emuladores (npm run emulators + node scripts/admin.mjs demo + vite con VITE_EMULATOR=1).
// Uso: BASE=http://127.0.0.1:5173 SHOTS=./shots node tests/e2e.mjs
import { chromium } from 'playwright-core'
import { mkdirSync, existsSync } from 'node:fs'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const BASE = process.env.BASE || 'http://127.0.0.1:5173'
const SHOTS = process.env.SHOTS || './shots'
mkdirSync(SHOTS, { recursive: true })
const exe = process.env.CHROME || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(p => existsSync(p))

process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080'
const db = getFirestore(initializeApp({ projectId: 'demo-rifalo' }))

const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] })
const errors = []
let step = 0
async function ctx(name, mobile = true) {
  const c = await browser.newContext(mobile
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-VE' }
    : { viewport: { width: 1366, height: 860 }, locale: 'es-VE' })
  const p = await c.newPage()
  p.on('console', m => { if (m.type() === 'error' && !/dolarapi|ERR_|favicon|Failed to load resource/.test(m.text())) errors.push(`[${name}] ${m.text()}`) })
  p.on('pageerror', e => errors.push(`[${name}] ${e.message}`))
  return p
}
const shot = async (p, label) => { step++; await p.waitForTimeout(500); await p.screenshot({ path: `${SHOTS}/${String(step).padStart(2, '0')}-${label}.png` }) }
const ok = (cond, msg) => { if (!cond) throw new Error('FALLÓ: ' + msg); console.log('  ✓', msg) }

async function login(p, user, pass) {
  await p.goto(`${BASE}/login`)
  await p.fill('#u', user)
  await p.fill('#p', pass)
  await p.click('button:has-text("Entrar")')
  await p.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 15000 })
}

const raffleSnap = (await db.collection('raffles').limit(1).get()).docs[0]
const RID = raffleSnap.id

try {
  console.log('1) Admin entra y crea su clave')
  const admin = await ctx('admin', false)
  await admin.goto(`${BASE}/login`)
  await shot(admin, 'login-desktop')
  await login(admin, 'admin', 'admin123')
  await admin.waitForSelector('text=Crea tu clave')
  await shot(admin, 'admin-crear-clave')
  const passInputs = admin.locator('.sheet input[type=password]')
  await passInputs.nth(0).fill('admin1234')
  await passInputs.nth(1).fill('admin1234')
  await admin.click('.sheet button:has-text("Guardar clave")')
  await admin.waitForSelector('text=Tus rifas')
  await admin.waitForTimeout(800)
  await shot(admin, 'admin-inicio')
  ok(await admin.locator('.rcard').count() === 1, 'el admin ve la rifa')

  console.log('2) Vendedora vende 3 números con pago móvil')
  const ana = await ctx('ana')
  await login(ana, 'ana.guzman', 'clave123')
  await ana.click('.rcard')
  await ana.waitForSelector('.ncell')
  await shot(ana, 'vendedor-tablero')
  for (const n of ['007', '015', '023']) await ana.click(`.ncell:has-text("${n}")`)
  await shot(ana, 'vendedor-seleccion')
  await ana.click('.sell-bar button:has-text("Vender")')
  await ana.fill('input[placeholder="Ej. María Pérez"]', 'Rosa Martínez')
  await ana.fill('input[placeholder="0414-1234567"]', '04241112233')
  await ana.click('.sheet button:has-text("Continuar")')
  await ana.click('.choice:has-text("Pago móvil")')
  await ana.waitForTimeout(300)
  await ana.locator('.sheet input[type=number]').first().fill('7.5')
  const amt = await ana.locator('.sheet input[type=number]').first().inputValue()
  // sin tasa en el emulador → pagar en USD no es posible por pago móvil (Bs); pasar a efectivo si no hay tasa
  await ana.selectOption('.sheet select.select >> nth=0', { label: 'Banesco' }).catch(() => {})
  await shot(ana, 'vendedor-pago')
  await ana.click('.choice:has-text("Efectivo")')
  await ana.waitForTimeout(200)
  await ana.click('.sheet button:has-text("Registrar venta")')
  await ana.waitForSelector('text=¡Venta registrada!', { timeout: 15000 })
  await shot(ana, 'vendedor-venta-ok')
  ok(true, `venta registrada (monto ${amt})`)
  await ana.click('.sheet-foot button:has-text("Listo")')

  console.log('3) Público aparta 2 números desde el enlace de Luis')
  const pub = await ctx('publico')
  await pub.goto(`${BASE}/r/zenaida?v=luis.perez`)
  await pub.waitForSelector('.ncell')
  await shot(pub, 'publico-portada')
  ok(await pub.locator('text=Te invitó').count() === 1, 'muestra el vendedor que invitó')
  ok(await pub.locator('.ncell.off').count() === 3, 'los 3 números vendidos aparecen ocupados')
  await pub.click('.ncell:has-text("100")')
  await pub.click('.ncell:has-text("101")')
  await shot(pub, 'publico-seleccion')
  await pub.click('.pub-bar button:has-text("Apartar")')
  await pub.fill('.sheet input[autocomplete=name]', 'Carlos Méndez')
  await pub.fill('.sheet input[autocomplete=tel]', '04161234567')
  await shot(pub, 'publico-formulario')
  await pub.click('.sheet button:has-text("Apartar")')
  await pub.waitForSelector('text=¡Números apartados!', { timeout: 15000 })
  await shot(pub, 'publico-apartado-ok')
  ok(true, 'apartado público creado')

  console.log('4) Público sin vendedor → bandeja compartida')
  const pub2 = await ctx('publico2')
  await pub2.goto(`${BASE}/r/zenaida`)
  await pub2.waitForSelector('.ncell')
  await pub2.click('.ncell:has-text("150")')
  await pub2.click('.pub-bar button:has-text("Apartar")')
  await pub2.fill('.sheet input[autocomplete=name]', 'Elena Castro')
  await pub2.fill('.sheet input[autocomplete=tel]', '04127654321')
  await pub2.selectOption('.sheet select', '_none')
  await pub2.click('.sheet button:has-text("Apartar")')
  await pub2.waitForSelector('text=¡Números apartados!', { timeout: 15000 })
  ok(true, 'apartado sin vendedor creado')

  console.log('5) Un número ya tomado no se puede volver a vender')
  const raced = await (async () => {
    const pub3 = await ctx('publico3')
    await pub3.goto(`${BASE}/r/zenaida`)
    await pub3.waitForSelector('.ncell')
    return await pub3.locator('.ncell:has-text("100")').isDisabled()
  })()
  ok(raced, 'el 100 aparece bloqueado en otra pantalla en tiempo real')

  console.log('6) Luis confirma su apartado; Carmen toma el de la bandeja')
  const luis = await ctx('luis')
  await login(luis, 'luis.perez', 'clave123')
  await luis.goto(`${BASE}/rifa/${RID}?tab=inbox`)
  await luis.waitForSelector('text=Desde tu enlace')
  await shot(luis, 'vendedor-apartados')
  await luis.click('.inbox-card button:has-text("Confirmar")')
  await luis.click('.sheet button:has-text("Confirmar venta")')
  await luis.waitForSelector('.sheet .badge:has-text("Por pagar")', { timeout: 10000 })
  await shot(luis, 'vendedor-confirmo')
  ok(true, 'Luis confirmó la venta')
  await luis.click('.sheet button:has-text("Registrar pago")')
  await luis.click('.sheet .pm-methods .choice:has-text("Efectivo")')
  await luis.click('.sheet button:has-text("Mitad")')
  await luis.click('.sheet button:has-text("Guardar pago")')
  await luis.waitForSelector('.sheet .badge:has-text("Abonado")', { timeout: 10000 })
  ok(true, 'Luis registró un abono')
  await luis.click('.sheet-head button[aria-label=Cerrar]')

  const carmen = await ctx('carmen')
  await login(carmen, 'carmen.rojas', 'clave123')
  await carmen.goto(`${BASE}/rifa/${RID}?tab=inbox`)
  await carmen.waitForSelector('text=Bandeja compartida')
  await carmen.click('.inbox-card.shared button:has-text("Tomar")')
  await carmen.waitForSelector('text=¡Venta tomada!', { timeout: 10000 })
  ok(true, 'Carmen tomó el apartado de la bandeja')

  console.log('7) Admin verifica pagos')
  await admin.goto(`${BASE}/rifa/${RID}?tab=payments`)
  await admin.waitForSelector('.pay-card')
  await shot(admin, 'admin-pagos')
  const pending = await admin.locator('.pay-card.pending').count()
  ok(pending === 2, `hay 2 pagos por verificar (hay ${pending})`)
  await admin.locator('.pay-card.pending button:has-text("Verificar")').first().click()
  await admin.waitForTimeout(1200)
  await admin.locator('.pay-card.pending button:has-text("Verificar")').first().click()
  await admin.waitForTimeout(1200)
  ok(await admin.locator('.pay-card.pending').count() === 0, 'pagos verificados')

  await admin.goto(`${BASE}/rifa/${RID}?tab=board`)
  await admin.waitForSelector('.ncell')
  await shot(admin, 'admin-tablero')
  await admin.goto(`${BASE}/rifa/${RID}?tab=orders`)
  await admin.waitForSelector('.order-item')
  await shot(admin, 'admin-ventas')
  await admin.goto(`${BASE}/rifa/${RID}?tab=team`)
  await admin.waitForSelector('.acc-card')
  await shot(admin, 'admin-vendedores')
  await admin.goto(`${BASE}/rifa/${RID}?tab=log`)
  await admin.waitForSelector('.log-row')
  await shot(admin, 'admin-historial')
  await admin.goto(`${BASE}/rifa/${RID}?tab=share`)
  await admin.waitForSelector('.qr')
  await shot(admin, 'admin-compartir')

  console.log('8) Sorteo: no se puede hasta vender todo')
  await admin.goto(`${BASE}/rifa/${RID}?tab=draw`)
  await admin.waitForSelector('.prize-card')
  ok(await admin.locator('text=Faltan').count() >= 1, 'muestra cuántos faltan por vender')
  // Llenar el resto del tablero directamente (simula todas las ventas)
  const chunk = (await db.doc(`raffles/${RID}/chunks/0`).get()).data()
  const sellers = (await db.doc(`raffles/${RID}`).get()).data().sellers
  const fill = {}
  for (let n = 1; n <= 200; n++) if (!chunk[String(n)]) fill[String(n)] = { s: 'p', o: 'test', sl: sellers[n % sellers.length], e: 0, a: true }
  await db.doc(`raffles/${RID}/chunks/0`).set(fill, { merge: true })
  await admin.waitForSelector('text=¡Listo para sortear!', { timeout: 10000 })
  await shot(admin, 'admin-sorteo-listo')
  await admin.click('.prize-card button:has-text("Sortear ahora")')
  await admin.click('.sheet button:has-text("¡Sortear!")')
  await admin.waitForSelector('text=¡Tenemos ganador!', { timeout: 20000 })
  await admin.waitForTimeout(1500)
  await shot(admin, 'admin-sorteo-ganador')
  ok(true, 'sorteo realizado')
  await admin.click('.sheet-foot button:has-text("Cerrar")')

  console.log('9) La página pública muestra el ganador y el boleto se verifica')
  await pub.goto(`${BASE}/r/zenaida`)
  await pub.waitForSelector('.winners-card')
  await shot(pub, 'publico-ganador')
  const tok = (await db.collection(`raffles/${RID}/tokens`).limit(1).get()).docs[0].id
  await pub.goto(`${BASE}/t/${RID}/${tok}`)
  await pub.waitForSelector('.ticket-card')
  await shot(pub, 'boleto-verificado')
  ok(true, 'boleto verificado')

  console.log('10) Editor de rifas y equipo (escritorio)')
  await admin.goto(`${BASE}/rifa/${RID}/editar`)
  await admin.waitForSelector('text=Lo básico')
  await shot(admin, 'admin-editor')
  await admin.goto(`${BASE}/equipo`)
  await admin.waitForSelector('.person')
  await shot(admin, 'admin-equipo')
  await admin.goto(`${BASE}/rifa/nueva`)
  await admin.waitForSelector('text=Nueva rifa')
  await admin.fill('input[placeholder="Ej. Pro fondos gastos médicos"]', 'Rifa de prueba 1000')
  await admin.click('button:has-text("1.000")')
  await admin.fill('input[placeholder="Ej. Cesta de comida"]', 'Televisor')
  await admin.click('button:has-text("Publicar rifa")')
  await admin.waitForURL(/\/rifa\/[A-Za-z0-9]+$/, { timeout: 15000 })
  await admin.waitForSelector('.ncell')
  await shot(admin, 'admin-rifa-1000')
  ok(await admin.locator('.ngrid-tools .segmented button').count() === 2, 'rifa de 1000 números paginada en 2 bloques')
} catch (e) {
  console.error(e.message)
  errors.push('TEST: ' + e.message)
  const pages = browser.contexts().flatMap(c => c.pages())
  for (const [i, p] of pages.entries()) await p.screenshot({ path: `${SHOTS}/error-${i}.png` }).catch(() => {})
} finally {
  await browser.close()
}
if (errors.length) { console.log('\nErrores:'); errors.forEach(e => console.log(' -', e)); process.exit(1) }
console.log('\n✅ Todas las pruebas pasaron')
process.exit(0)
