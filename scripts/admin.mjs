#!/usr/bin/env node
// Herramientas de administración de Rifalo (se ejecutan con permisos de administrador del proyecto).
//
// Credenciales (producción): variable de entorno FIREBASE_SERVICE_ACCOUNT con el JSON de la
// cuenta de servicio, o GOOGLE_APPLICATION_CREDENTIALS con la ruta al archivo.
// Emuladores: definir FIRESTORE_EMULATOR_HOST y FIREBASE_AUTH_EMULATOR_HOST.
//
// Uso:
//   node scripts/admin.mjs wipe                 → borra TODOS los datos y usuarios del proyecto
//   node scripts/admin.mjs auth-config          → activa inicio de sesión con correo y anónimo
//   node scripts/admin.mjs bootstrap            → crea super admin, organización y la primera rifa
//   node scripts/admin.mjs demo                 → (solo emuladores) datos de prueba con vendedores y ventas

import { initializeApp, cert, applicationDefault } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { randomBytes } from 'node:crypto'

const EMU = !!process.env.FIRESTORE_EMULATOR_HOST
const PROJECT = process.env.RIFALO_PROJECT || (EMU ? 'demo-rifalo' : 'ayudave-81546')
const DOMAIN = 'rifalo.app'

function credential() {
  if (EMU) return undefined
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (raw) {
    const json = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8')
    return cert(JSON.parse(json))
  }
  return applicationDefault()
}
const app = initializeApp({ projectId: PROJECT, ...(credential() ? { credential: credential() } : {}) })
const auth = getAuth(app)
const db = getFirestore(app)

const words = ['sol', 'mar', 'rio', 'luz', 'pan', 'flor', 'luna', 'cielo', 'nube', 'roca', 'lago', 'palma']
const tempPassword = () => {
  const b = randomBytes(3)
  return words[b[0] % words.length] + words[b[1] % words.length] + (1000 + (b.readUInt16BE(1) % 9000))
}

async function wipe() {
  console.log(`⚠️  Borrando todos los datos de ${PROJECT}…`)
  const cols = await db.listCollections()
  for (const c of cols) {
    console.log(`   colección ${c.id}`)
    await db.recursiveDelete(c)
  }
  let token
  let total = 0
  try {
    do {
      const page = await auth.listUsers(1000, token)
      if (page.users.length) await auth.deleteUsers(page.users.map(u => u.uid))
      total += page.users.length
      token = page.pageToken
    } while (token)
  } catch (e) {
    console.log(`   (usuarios: ${e.message})`)
  }
  console.log(`✅ Listo: ${cols.length} colecciones y ${total} usuarios eliminados`)
}

async function accessToken() {
  const c = credential()
  const t = await c.getAccessToken()
  return t.access_token
}

async function authConfig() {
  if (EMU) return console.log('(emulador: no hace falta)')
  const token = await accessToken()
  const base = `https://identitytoolkit.googleapis.com`
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Goog-User-Project': PROJECT }
  let r = await fetch(`${base}/admin/v2/projects/${PROJECT}/config`, { headers })
  if (r.status === 404 || (await r.clone().text()).includes('CONFIGURATION_NOT_FOUND')) {
    console.log('   Inicializando Firebase Authentication…')
    const init = await fetch(`${base}/v2/projects/${PROJECT}/identityPlatform:initializeAuth`, { method: 'POST', headers, body: '{}' })
    if (!init.ok) throw new Error(`initializeAuth: ${init.status} ${await init.text()}`)
  }
  r = await fetch(`${base}/admin/v2/projects/${PROJECT}/config?updateMask=signIn.email.enabled,signIn.email.passwordRequired,signIn.anonymous.enabled`, {
    method: 'PATCH', headers,
    body: JSON.stringify({ signIn: { email: { enabled: true, passwordRequired: true }, anonymous: { enabled: true } } })
  })
  if (!r.ok) throw new Error(`updateConfig: ${r.status} ${await r.text()}`)
  console.log('✅ Inicio de sesión con usuario/clave y anónimo activado')
}

async function createUser({ username, name, role, orgId, password, phone = '', mustChange = true }) {
  const email = `${username}@${DOMAIN}`
  const u = await auth.createUser({ email, password, displayName: name })
  await db.doc(`users/${u.uid}`).set({
    mid: u.uid, name, username, phone, orgId, role, active: true, mustChangePassword: mustChange, createdAt: FieldValue.serverTimestamp()
  })
  await db.doc(`usernames/${username}`).set({ uid: u.uid, email })
  return u.uid
}

function baseRaffle(orgId, uid) {
  return {
    orgId, title: 'PRO FONDOS Gastos Médicos Zenaida Guzmán', slug: 'zenaida',
    description: 'Rifa familiar para ayudar con los gastos médicos de Zenaida Guzmán. ¡Gracias por tu apoyo! 💜',
    cover: '', status: 'draft', size: 200, price: 2.5, currency: 'USD',
    rate: { enabled: true, mode: 'bcv', value: 0 },
    prizes: [{ place: 1, title: 'Cesta o bolsa de comida', value: 50, image: '' }],
    goal: 500, drawRule: 'all_sold', drawMethod: 'app', drawDate: '', lotteryName: '',
    holdHours: 48, allowPartial: true, cashSelfConfirm: false,
    assignMode: 'free', blocks: [], commission: { type: 'none', value: 0 },
    methods: {
      cash: { enabled: true, currencies: ['USD', 'VES'] },
      pm: { enabled: false, bank: '', phone: '', ci: '', holder: '' },
      transfer: { enabled: false, bank: '', account: '', ci: '', holder: '' },
      binance: { enabled: false, payId: '', email: '', holder: '' }
    },
    public: { enabled: true, allowReserve: true, holdMinutes: 120, maxPerOrder: 5, showBuyerNames: false },
    sellers: [], coadmins: [], team: {}, winners: [], contactPhone: '',
    createdAt: FieldValue.serverTimestamp(), createdBy: uid, updatedAt: FieldValue.serverTimestamp()
  }
}

async function writeRaffle(data) {
  const ref = db.collection('raffles').doc()
  await ref.set(data)
  const chunks = Math.ceil(data.size / 500)
  for (let i = 0; i < chunks; i++) await ref.collection('chunks').doc(String(i)).set({})
  await db.doc(`slugs/${data.slug}`).set({ rid: ref.id })
  await ref.collection('logs').add({ at: FieldValue.serverTimestamp(), by: data.createdBy, byName: 'Sistema', action: 'raffle_create', title: data.title })
  return ref.id
}

async function bootstrap() {
  const username = (process.env.RIFALO_ADMIN_USER || 'admin').toLowerCase()
  const password = process.env.RIFALO_ADMIN_PASSWORD || tempPassword()
  const name = process.env.RIFALO_ADMIN_NAME || 'Administrador'
  const orgName = process.env.RIFALO_ORG_NAME || 'Rifas Familia Guzmán'
  const orgRef = db.collection('orgs').doc()
  const uid = await createUser({ username, name, role: 'super', orgId: orgRef.id, password })
  await orgRef.set({ name: orgName, ownerUid: uid, active: true, brand: { color: '#6D28D9' }, createdAt: FieldValue.serverTimestamp() })
  const rid = await writeRaffle(baseRaffle(orgRef.id, uid))
  await db.doc('config/rates').set({ USD: 0, EUR: 0, source: 'BCV', updatedAt: FieldValue.serverTimestamp() })
  console.log('✅ Rifalo listo')
  console.log(`   Usuario super admin: ${username}`)
  console.log(`   Clave temporal:      ${password}`)
  console.log(`   Organización:        ${orgName} (${orgRef.id})`)
  console.log(`   Primera rifa:        ${rid} → /r/zenaida`)
  return { uid, orgId: orgRef.id, rid, username, password }
}

async function demo() {
  if (!EMU) throw new Error('El modo demo solo funciona con emuladores')
  process.env.RIFALO_ADMIN_PASSWORD ||= 'admin123'
  const { orgId, rid, uid } = await bootstrap()
  const sellers = []
  const names = ['Ana Guzmán', 'Luis Pérez', 'Carmen Rojas', 'José Díaz', 'María Torres', 'Pedro Silva']
  for (let i = 0; i < names.length; i++) {
    const username = names[i].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(' ', '.')
    const sid = await createUser({ username, name: names[i], role: 'member', orgId, password: 'clave123', phone: `0414000000${i}`, mustChange: false })
    sellers.push({ mid: sid, name: names[i], code: username })
  }
  const team = Object.fromEntries(sellers.map(s => [s.mid, { name: s.name, code: s.code, phone: '04140000000' }]))
  await db.doc(`raffles/${rid}`).update({
    status: 'active', sellers: sellers.map(s => s.mid), team,
    'methods.pm': { enabled: true, bank: 'Banesco', phone: '0414-1234567', ci: 'V-12345678', holder: 'Zenaida Guzmán' },
    'methods.binance': { enabled: true, payId: '123456789', email: 'pagos@ejemplo.com', holder: 'Zenaida G.' },
    contactPhone: '04141234567'
  })
  console.log('✅ Demo: 6 vendedores (clave: clave123):', sellers.map(s => s.code).join(', '))
}

const cmd = process.argv[2]
const run = { wipe, 'auth-config': authConfig, bootstrap, demo }[cmd]
if (!run) {
  console.log('Comandos: wipe | auth-config | bootstrap | demo')
  process.exit(1)
}
run().then(() => process.exit(0)).catch(e => { console.error('❌', e.message || e); process.exit(1) })
