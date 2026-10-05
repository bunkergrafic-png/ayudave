// Pruebas de las reglas de seguridad (requiere el emulador de Firestore).
// npm run test:rules   (o con el emulador ya corriendo: node --test tests/rules.test.mjs)
import { test, before, after, beforeEach } from 'node:test'
import { readFileSync } from 'node:fs'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc, writeBatch, collection, getDocs, query, where, deleteField } from 'firebase/firestore'

let env
const RID = 'r1'
const ORG = 'org1'

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-rules',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 }
  })
})
after(async () => { await env?.cleanup() })

const raffleData = (over = {}) => ({
  orgId: ORG, title: 'Rifa', status: 'active', size: 200, price: 2.5, slug: 'rifa',
  public: { enabled: true, allowReserve: true, holdMinutes: 120, maxPerOrder: 5 },
  sellers: ['ana', 'luis'], coadmins: ['coa'], team: {}, cashSelfConfirm: false, ...over
})

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async c => {
    const db = c.firestore()
    const user = (role, mid, active = true) => ({ role, mid, orgId: ORG, name: mid, username: mid, active })
    await setDoc(doc(db, 'users/super'), { ...user('super', 'super'), orgId: 'other' })
    await setDoc(doc(db, 'users/owner'), user('owner', 'owner'))
    await setDoc(doc(db, 'users/ana'), user('member', 'ana'))
    await setDoc(doc(db, 'users/luis'), user('member', 'luis'))
    await setDoc(doc(db, 'users/coa'), user('member', 'coa'))
    await setDoc(doc(db, 'users/off'), user('member', 'off', false))
    await setDoc(doc(db, 'users/stranger'), { ...user('member', 'stranger'), orgId: 'org2' })
    await setDoc(doc(db, `raffles/${RID}`), raffleData())
    await setDoc(doc(db, `raffles/${RID}/chunks/0`), { 5: { s: 'v', o: 'o-old', sl: 'luis', e: 0, a: false } })
  })
})

const as = (uid, anon = false) => env.authenticatedContext(uid, anon ? { firebase: { sign_in_provider: 'anonymous' } } : {}).firestore()
const future = () => Date.now() + 60 * 60000

async function publicReserveBatch(db, uid, { n = '10', sl = '', e = future(), extra = {} } = {}) {
  const b = writeBatch(db)
  b.set(doc(db, `raffles/${RID}/orders/o1`), {
    numbers: [Number(n)], keys: [n], buyer: { name: 'Carlos', phone: '04161234567' }, sellerId: sl, sellerName: '', total: 2.5,
    paidVerified: 0, paidPending: 0, status: 'reserved', source: 'public', token: 'tok1', expiresAt: e, createdBy: uid, createdByName: 'Carlos', createdAt: new Date()
  })
  b.update(doc(db, `raffles/${RID}/chunks/0`), { _o: 'o1', [n]: { s: 'r', o: 'o1', sl, e, a: false, ...extra } })
  b.set(doc(db, `raffles/${RID}/tokens/tok1`), { rid: RID, numbers: [Number(n)] })
  b.set(doc(db, `raffles/${RID}/logs/l1`), { by: uid, action: 'public_reserve', at: new Date() })
  return b.commit()
}

test('el público puede leer una rifa pública y su tablero', async () => {
  const db = as('anon1', true)
  await assertSucceeds(getDoc(doc(db, `raffles/${RID}`)))
  await assertSucceeds(getDoc(doc(db, `raffles/${RID}/chunks/0`)))
})

test('el público NO puede leer ventas ni pagos', async () => {
  const db = as('anon1', true)
  await assertFails(getDocs(collection(db, `raffles/${RID}/orders`)))
  await assertFails(getDocs(collection(db, `raffles/${RID}/payments`)))
})

test('el público puede apartar un número libre', async () => {
  await assertSucceeds(publicReserveBatch(as('anon1', true), 'anon1'))
})

test('el público puede apartar vía enlace de un vendedor', async () => {
  await assertSucceeds(publicReserveBatch(as('anon1', true), 'anon1', { sl: 'ana' }))
})

test('el público NO puede apartar un número ya vendido', async () => {
  await assertFails(publicReserveBatch(as('anon1', true), 'anon1', { n: '5' }))
})

test('el público NO puede marcar un número como pagado', async () => {
  await assertFails(publicReserveBatch(as('anon1', true), 'anon1', { extra: { s: 'p' } }))
})

test('el público NO puede apartar por más tiempo del permitido', async () => {
  await assertFails(publicReserveBatch(as('anon1', true), 'anon1', { e: Date.now() + 48 * 3600000 }))
})

test('el público NO puede asignarse a un vendedor inexistente', async () => {
  await assertFails(publicReserveBatch(as('anon1', true), 'anon1', { sl: 'stranger' }))
})

test('el público NO puede tocar números que no están en su orden', async () => {
  const db = as('anon1', true)
  const b = writeBatch(db)
  b.set(doc(db, `raffles/${RID}/orders/o1`), {
    numbers: [10], keys: ['10'], buyer: { name: 'Carlos', phone: '04161234567' }, sellerId: '', total: 2.5,
    paidVerified: 0, paidPending: 0, status: 'reserved', source: 'public', token: 't', expiresAt: future(), createdBy: 'anon1'
  })
  b.update(doc(db, `raffles/${RID}/chunks/0`), { _o: 'o1', 10: { s: 'r', o: 'o1', sl: '', e: future(), a: false }, 5: deleteField() })
  await assertFails(b.commit())
})

test('el público NO puede apartar si la rifa no permite apartados', async () => {
  await env.withSecurityRulesDisabled(c => updateDoc(doc(c.firestore(), `raffles/${RID}`), { 'public.allowReserve': false }))
  await assertFails(publicReserveBatch(as('anon1', true), 'anon1'))
})

test('un teléfono bloqueado no puede apartar', async () => {
  await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), `raffles/${RID}/blocked/04161234567`), { at: 1 }))
  await assertFails(publicReserveBatch(as('anon1', true), 'anon1'))
})

test('un vendedor asignado puede vender y ver solo sus ventas', async () => {
  const db = as('ana')
  const b = writeBatch(db)
  b.set(doc(db, `raffles/${RID}/orders/o2`), { numbers: [20], sellerId: 'ana', createdBy: 'ana', paidVerified: 0, paidPending: 0, total: 2.5, status: 'pending', buyer: { name: 'X', phone: '1' } })
  b.update(doc(db, `raffles/${RID}/chunks/0`), { 20: { s: 'v', o: 'o2', sl: 'ana', e: future(), a: false } })
  await assertSucceeds(b.commit())
  await assertSucceeds(getDocs(query(collection(db, `raffles/${RID}/orders`), where('sellerId', '==', 'ana'))))
  await assertFails(getDocs(query(collection(db, `raffles/${RID}/orders`), where('sellerId', '==', 'luis'))))
  await assertFails(getDocs(collection(db, `raffles/${RID}/orders`)))
})

test('un vendedor NO puede vender si la rifa está cerrada', async () => {
  await env.withSecurityRulesDisabled(c => updateDoc(doc(c.firestore(), `raffles/${RID}`), { status: 'closed' }))
  await assertFails(updateDoc(doc(as('ana'), `raffles/${RID}/chunks/0`), { 21: { s: 'v', o: 'x', sl: 'ana', e: 0, a: false } }))
})

test('un vendedor NO puede marcar su pago como verificado', async () => {
  const db = as('ana')
  await assertFails(setDoc(doc(db, `raffles/${RID}/payments/p1`), { orderId: 'o2', sellerId: 'ana', createdBy: 'ana', status: 'verified', method: 'pm', amountBase: 2.5 }))
  await assertSucceeds(setDoc(doc(db, `raffles/${RID}/payments/p2`), { orderId: 'o2', sellerId: 'ana', createdBy: 'ana', status: 'pending', method: 'pm', amountBase: 2.5 }))
})

test('con "vendedor confirma efectivo", el efectivo sí queda verificado', async () => {
  await env.withSecurityRulesDisabled(c => updateDoc(doc(c.firestore(), `raffles/${RID}`), { cashSelfConfirm: true }))
  await assertSucceeds(setDoc(doc(as('ana'), `raffles/${RID}/payments/p1`), { orderId: 'o2', sellerId: 'ana', createdBy: 'ana', status: 'verified', method: 'cash', amountBase: 2.5 }))
})

test('un vendedor desactivado o de otra organización no tiene acceso', async () => {
  await assertFails(getDocs(query(collection(as('off'), `raffles/${RID}/orders`), where('sellerId', '==', 'off'))))
  await env.withSecurityRulesDisabled(c => updateDoc(doc(c.firestore(), `raffles/${RID}`), { 'public.enabled': false }))
  await assertFails(getDoc(doc(as('stranger'), `raffles/${RID}`)))
  await assertFails(getDoc(doc(as('off'), `raffles/${RID}`)))
})

test('un vendedor puede tomar un apartado de la bandeja, pero no el de otro', async () => {
  await env.withSecurityRulesDisabled(async c => {
    await setDoc(doc(c.firestore(), `raffles/${RID}/orders/inbox`), { sellerId: '', paidVerified: 0, numbers: [30] })
    await setDoc(doc(c.firestore(), `raffles/${RID}/orders/luisO`), { sellerId: 'luis', paidVerified: 0, numbers: [31] })
  })
  await assertSucceeds(updateDoc(doc(as('ana'), `raffles/${RID}/orders/inbox`), { sellerId: 'ana' }))
  await assertFails(updateDoc(doc(as('ana'), `raffles/${RID}/orders/luisO`), { sellerId: 'ana' }))
})

test('co-admin y organizador administran; el co-admin no cambia co-admins', async () => {
  await assertSucceeds(getDocs(collection(as('coa'), `raffles/${RID}/orders`)))
  await assertSucceeds(updateDoc(doc(as('coa'), `raffles/${RID}`), { title: 'Nuevo' }))
  await assertFails(updateDoc(doc(as('coa'), `raffles/${RID}`), { coadmins: ['coa', 'ana'] }))
  await assertSucceeds(updateDoc(doc(as('owner'), `raffles/${RID}`), { coadmins: ['coa', 'ana'] }))
  await assertSucceeds(getDocs(collection(as('super'), `raffles/${RID}/payments`)))
})

test('el organizador crea miembros pero no super admins; nadie se sube el rol', async () => {
  await assertSucceeds(setDoc(doc(as('owner'), 'users/new1'), { role: 'member', orgId: ORG, mid: 'new1', active: true }))
  await assertFails(setDoc(doc(as('owner'), 'users/new2'), { role: 'super', orgId: ORG, mid: 'new2', active: true }))
  await assertFails(setDoc(doc(as('owner'), 'users/new3'), { role: 'member', orgId: 'org2', mid: 'new3', active: true }))
  await assertFails(updateDoc(doc(as('ana'), 'users/ana'), { role: 'owner' }))
  await assertSucceeds(updateDoc(doc(as('ana'), 'users/ana'), { mustChangePassword: false }))
})

test('el comprobante público se lee por token pero no se listan', async () => {
  await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), `raffles/${RID}/tokens/abc`), { numbers: [1] }))
  await assertSucceeds(getDoc(doc(as('anon2', true), `raffles/${RID}/tokens/abc`)))
  await assertFails(getDocs(collection(as('anon2', true), `raffles/${RID}/tokens`)))
})

test('solo el admin puede liberar números ajenos o borrar', async () => {
  await assertSucceeds(updateDoc(doc(as('coa'), `raffles/${RID}/chunks/0`), { 5: deleteField() }))
  await assertFails(updateDoc(doc(as('anon3', true), `raffles/${RID}/chunks/0`), { 5: deleteField() }))
})

test('apartado público con números en dos bloques del tablero', async () => {
  await env.withSecurityRulesDisabled(async c => {
    await updateDoc(doc(c.firestore(), `raffles/${RID}`), { size: 1000 })
    await setDoc(doc(c.firestore(), `raffles/${RID}/chunks/1`), {})
  })
  const db = as('anon9', true)
  const e = future()
  const b = writeBatch(db)
  b.set(doc(db, `raffles/${RID}/orders/o9`), {
    numbers: [499, 501], keys: ['499', '501'], buyer: { name: 'Mixto', phone: '0414' }, sellerId: '', total: 5,
    paidVerified: 0, paidPending: 0, status: 'reserved', source: 'public', token: 't9', expiresAt: e, createdBy: 'anon9'
  })
  b.update(doc(db, `raffles/${RID}/chunks/0`), { _o: 'o9', 499: { s: 'r', o: 'o9', sl: '', e, a: false } })
  b.update(doc(db, `raffles/${RID}/chunks/1`), { _o: 'o9', 501: { s: 'r', o: 'o9', sl: '', e, a: false } })
  await assertSucceeds(b.commit())
})
