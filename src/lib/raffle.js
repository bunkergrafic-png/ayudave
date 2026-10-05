// Lógica central de una rifa: tablero, ventas, pagos, vencimientos y sorteo.
//
// El tablero se guarda en documentos "chunk" de hasta 500 números cada uno, para
// que una rifa de 10.000 números se lea con 20 documentos y no con 10.000.
// Cada número ocupado guarda: { s: estado, o: orden, sl: vendedor, e: vence (ms), a: tiene abono }
//   s = 'r' apartado desde la página pública (sin confirmar)
//   s = 'v' vendido, pendiente de pago (total o parcial)
//   s = 'p' pagado y verificado
// Un número sin entrada, o con entrada vencida (e < ahora, sin abonos y no pagado), está libre.

import {
  collection, doc, runTransaction, writeBatch, serverTimestamp, deleteField, increment, onSnapshot
} from 'firebase/firestore'
import { db } from '../firebase'
import { randomToken, round2, firstName, pad } from './format'

export const CHUNK = 500
export const chunkCount = size => Math.ceil(size / CHUNK)
export const chunkOf = n => String(Math.floor((n - 1) / CHUNK))

const rRef = rid => doc(db, 'raffles', rid)
const chunkRef = (rid, cid) => doc(db, 'raffles', rid, 'chunks', cid)
export const ordersCol = rid => collection(db, 'raffles', rid, 'orders')
export const paymentsCol = rid => collection(db, 'raffles', rid, 'payments')

export const STATE_LABEL = { free: 'Disponible', r: 'Apartado', v: 'Por pagar', p: 'Pagado', mine: 'Mío' }

export function isExpired(entry, now = Date.now()) {
  return !!entry && entry.s !== 'p' && !entry.a && entry.e > 0 && entry.e < now
}
/** Entrada vigente de un número o null si está libre. */
export function effective(entry, now = Date.now()) {
  if (!entry || isExpired(entry, now)) return null
  return entry
}

/** Escucha el tablero completo de una rifa. Devuelve la función para dejar de escuchar. */
export function watchBoard(raffle, cb, onError) {
  const parts = {}
  const n = chunkCount(raffle.size)
  const unsubs = []
  for (let i = 0; i < n; i++) {
    unsubs.push(onSnapshot(chunkRef(raffle.id, String(i)), snap => {
      parts[i] = snap.exists() ? snap.data() : {}
      const board = {}
      for (const p in parts) for (const k in parts[p]) if (k[0] !== '_') board[k] = parts[p][k]
      cb(board)
    }, onError))
  }
  return () => unsubs.forEach(u => u())
}

export function boardStats(raffle, board, now = Date.now()) {
  const s = { size: raffle.size, free: 0, r: 0, v: 0, p: 0, abono: 0, expired: 0 }
  let taken = 0
  for (const k in board) {
    const e = board[k]
    if (isExpired(e, now)) { s.expired++; continue }
    taken++
    s[e.s]++
    if (e.s === 'v' && e.a) s.abono++
  }
  s.free = raffle.size - taken
  s.sold = s.v + s.p
  s.pctSold = raffle.size ? (s.sold / raffle.size) * 100 : 0
  s.pctPaid = raffle.size ? (s.p / raffle.size) * 100 : 0
  return s
}

export const DRAW_RULES = {
  all_sold: 'Cuando se vendan todos los números',
  all_paid: 'Cuando todos los números estén pagados',
  date: 'En una fecha y hora fija',
  manual: 'Cuando el administrador lo decida'
}
export const DRAW_METHODS = {
  app: 'Sorteo aleatorio en la app',
  lottery: 'Resultado de una lotería oficial',
  external: 'Sorteo externo (en vivo, tómbola…)'
}

/** ¿Se puede sortear ya? Devuelve { ready, reason }. */
export function drawReadiness(raffle, stats) {
  const left = raffle.size - stats.sold
  switch (raffle.drawRule) {
    case 'all_sold':
      return left <= 0 ? { ready: true } : { ready: false, reason: `Faltan ${left} números por vender` }
    case 'all_paid': {
      const unpaid = raffle.size - stats.p
      return unpaid <= 0 ? { ready: true } : { ready: false, reason: `Faltan ${unpaid} números por pagar` }
    }
    case 'date': {
      const t = raffle.drawDate ? new Date(raffle.drawDate).getTime() : 0
      return t && Date.now() >= t ? { ready: true } : { ready: false, reason: 'Aún no llega la fecha del sorteo' }
    }
    default:
      return { ready: true }
  }
}

/** ¿Este vendedor puede vender este número? (modo bloques) */
export function canSellNumber(raffle, n, mid, isAdmin) {
  if (isAdmin || raffle.assignMode !== 'blocks') return true
  return (raffle.blocks || []).some(b => b.mid === mid && n >= b.from && n <= b.to)
}
export function blockOwner(raffle, n) {
  if (raffle.assignMode !== 'blocks') return null
  const b = (raffle.blocks || []).find(b => n >= b.from && n <= b.to)
  return b ? b.mid : null
}

export function orderStatus(order, now = Date.now()) {
  if (order.status === 'cancelled' || order.status === 'expired' || order.status === 'released') return order.status
  const total = order.total || 0
  if (order.paidVerified >= total - 0.001) return 'paid'
  if (order.paidVerified + order.paidPending > 0) return 'partial'
  if (order.expiresAt && order.expiresAt < now) return 'expired'
  return order.status === 'reserved' ? 'reserved' : 'pending'
}
export const ORDER_LABEL = {
  reserved: 'Apartado', pending: 'Por pagar', partial: 'Abonado', paid: 'Pagado',
  cancelled: 'Anulado', expired: 'Vencido', released: 'Liberado'
}

function statusFrom(total, verified, pending, wasReserved) {
  if (verified >= total - 0.001) return 'paid'
  if (verified + pending > 0) return 'partial'
  return wasReserved ? 'reserved' : 'pending'
}

function logWrite(tx, rid, actor, action, data = {}) {
  const ref = doc(collection(db, 'raffles', rid, 'logs'))
  tx.set(ref, {
    at: serverTimestamp(), by: actor.uid, byName: actor.name || '', action, ...data
  })
}

function groupByChunk(numbers) {
  const g = {}
  numbers.forEach(n => { (g[chunkOf(n)] ||= []).push(n) })
  return g
}

async function readChunks(tx, rid, numbers) {
  const g = groupByChunk(numbers)
  const out = {}
  for (const cid of Object.keys(g)) {
    const snap = await tx.get(chunkRef(rid, cid))
    out[cid] = snap.exists() ? snap.data() : {}
  }
  return out
}

function refKey(method, ref) {
  return `${method}_${String(ref || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}`
}

function paymentDoc(raffle, order, p, actor, status) {
  return {
    orderId: order.id,
    numbers: order.numbers,
    sellerId: order.sellerId || '',
    sellerName: order.sellerName || '',
    buyerName: order.buyer?.name || '',
    method: p.method,
    currency: p.currency,
    amount: round2(p.amount),
    rate: p.rate || 0,
    amountBase: round2(p.amountBase),
    bank: p.bank || '',
    phone: p.phone || '',
    ci: p.ci || '',
    ref: p.ref || '',
    payId: p.payId || '',
    note: p.note || '',
    hasReceipt: !!p.receipt,
    duplicate: false,
    status,
    createdBy: actor.uid,
    createdByName: actor.name || '',
    createdAt: serverTimestamp(),
    ...(status === 'verified' ? { verifiedBy: actor.uid, verifiedByName: actor.name || '', verifiedAt: serverTimestamp() } : {})
  }
}

function needsReference(method) { return method === 'pm' || method === 'transfer' || method === 'binance' }

/**
 * Vende uno o varios números a un comprador (opcionalmente con un pago).
 * actor: { uid, mid, name, isAdmin }
 */
export async function sellNumbers({ raffle, numbers, buyer, seller, payment, actor }) {
  const rid = raffle.id
  const now = Date.now()
  const total = round2(numbers.length * raffle.price)
  const orderRef = doc(ordersCol(rid))
  const token = randomToken()
  const hold = Number(raffle.holdHours || 0)
  const expiresAt = hold > 0 ? now + hold * 3600000 : 0

  return runTransaction(db, async tx => {
    const chunks = await readChunks(tx, rid, numbers)
    let refSnap = null
    if (payment && needsReference(payment.method) && payment.ref) {
      refSnap = await tx.get(doc(db, 'raffles', rid, 'refs', refKey(payment.method, payment.ref)))
    }
    for (const n of numbers) {
      const cur = effective(chunks[chunkOf(n)][String(n)], now)
      if (cur) throw new Error(`El número ${pad(n, raffle.size)} ya fue tomado. Escoge otro.`)
      if (!canSellNumber(raffle, n, seller.mid, actor.isAdmin)) throw new Error(`El número ${pad(n, raffle.size)} pertenece al bloque de otro vendedor.`)
    }

    let pStatus = null
    let verified = 0, pending = 0
    if (payment) {
      const selfOk = actor.isAdmin || (raffle.cashSelfConfirm && payment.method === 'cash')
      pStatus = selfOk ? 'verified' : 'pending'
      if (pStatus === 'verified') verified = round2(payment.amountBase)
      else pending = round2(payment.amountBase)
    }
    const status = statusFrom(total, verified, pending, false)
    const order = {
      id: orderRef.id, numbers: [...numbers].sort((a, b) => a - b), buyer,
      sellerId: seller.mid, sellerName: seller.name, total,
      paidVerified: verified, paidPending: pending, status,
      source: 'seller', token, expiresAt: payment ? 0 : expiresAt,
      createdBy: actor.uid, createdByName: actor.name || '', createdAt: serverTimestamp()
    }
    const g = groupByChunk(numbers)
    for (const cid of Object.keys(g)) {
      const upd = {}
      g[cid].forEach(n => {
        upd[String(n)] = { s: status === 'paid' ? 'p' : 'v', o: orderRef.id, sl: seller.mid, e: payment ? 0 : expiresAt, a: !!payment }
      })
      tx.set(chunkRef(rid, cid), upd, { merge: true })
    }
    tx.set(orderRef, order)
    if (payment) {
      const pRef = doc(paymentsCol(rid))
      const pd = paymentDoc(raffle, order, payment, actor, pStatus)
      if (refSnap?.exists()) pd.duplicate = true
      tx.set(pRef, pd)
      if (refSnap && !refSnap.exists()) tx.set(refSnap.ref, { pid: pRef.id, orderId: orderRef.id, at: serverTimestamp() })
      if (payment.receipt) tx.set(doc(db, 'raffles', rid, 'receipts', pRef.id), { data: payment.receipt, createdBy: actor.uid })
    }
    tx.set(doc(db, 'raffles', rid, 'tokens', token), tokenDoc(raffle, order))
    logWrite(tx, rid, actor, 'sell', { orderId: orderRef.id, numbers: order.numbers, buyer: buyer.name, amount: verified + pending })
    return order
  })
}

function tokenDoc(raffle, order) {
  return {
    rid: raffle.id, title: raffle.title, numbers: order.numbers, size: raffle.size,
    buyerFirst: firstName(order.buyer?.name), sellerName: order.sellerName || '',
    status: order.status, total: order.total, paid: order.paidVerified || 0,
    expiresAt: order.expiresAt || 0, updatedAt: Date.now()
  }
}

/** Apartado desde la página pública (usuario anónimo). */
export async function publicReserve({ raffle, numbers, buyer, sellerMid, sellerName, uid }) {
  const rid = raffle.id
  const now = Date.now()
  const orderRef = doc(ordersCol(rid))
  const token = randomToken()
  const expiresAt = now + Number(raffle.public?.holdMinutes || 120) * 60000
  return runTransaction(db, async tx => {
    const chunks = await readChunks(tx, rid, numbers)
    for (const n of numbers) {
      if (effective(chunks[chunkOf(n)][String(n)], now)) throw new Error(`Uy, el número ${pad(n, raffle.size)} acaba de ser tomado. Escoge otro.`)
    }
    // En modo bloques, el apartado llega al dueño del bloque si no vino por un enlace de vendedor.
    let sl = sellerMid || ''
    if (!sl && raffle.assignMode === 'blocks') {
      const owners = [...new Set(numbers.map(n => blockOwner(raffle, n)))]
      if (owners.length === 1 && owners[0]) sl = owners[0]
    }
    const sName = sl ? (raffle.team?.[sl]?.name || sellerName || '') : ''
    const order = {
      id: orderRef.id, numbers: [...numbers].sort((a, b) => a - b), keys: numbers.map(String), buyer,
      sellerId: sl, sellerName: sName, total: round2(numbers.length * raffle.price),
      paidVerified: 0, paidPending: 0, status: 'reserved', source: 'public', token,
      expiresAt, createdBy: uid, createdByName: buyer.name, createdAt: serverTimestamp()
    }
    const g = groupByChunk(numbers)
    for (const cid of Object.keys(g)) {
      const upd = { _o: orderRef.id }
      g[cid].forEach(n => { upd[String(n)] = { s: 'r', o: orderRef.id, sl, e: expiresAt, a: false } })
      tx.update(chunkRef(rid, cid), upd)
    }
    tx.set(orderRef, order)
    tx.set(doc(db, 'raffles', rid, 'tokens', token), tokenDoc(raffle, order))
    logWrite(tx, rid, { uid, name: buyer.name }, 'public_reserve', { orderId: orderRef.id, numbers: order.numbers, buyer: buyer.name, sellerId: sl })
    return order
  })
}

/** Verifica que los números de la orden sigan siendo suyos y devuelve los chunks leídos. */
async function readOrderChunks(tx, raffle, order, now = Date.now(), allowExpired = false) {
  const chunks = await readChunks(tx, raffle.id, order.numbers)
  for (const n of order.numbers) {
    const raw = chunks[chunkOf(n)][String(n)]
    if (!raw || raw.o !== order.id) throw new Error(`El número ${pad(n, raffle.size)} ya no pertenece a esta venta (fue liberado).`)
    if (!allowExpired && isExpired(raw, now)) throw new Error(`El número ${pad(n, raffle.size)} venció y quedó libre. Véndelo de nuevo.`)
  }
  return chunks
}

function patchEntries(tx, rid, order, chunks, patch) {
  const g = groupByChunk(order.numbers)
  for (const cid of Object.keys(g)) {
    const upd = {}
    g[cid].forEach(n => { upd[String(n)] = { ...chunks[cid][String(n)], ...patch } })
    tx.update(chunkRef(rid, cid), upd)
  }
}

/** Un vendedor toma un apartado (de su enlace o de la bandeja compartida) y lo confirma como venta. */
export async function claimOrder({ raffle, orderId, seller, actor }) {
  const rid = raffle.id
  const oRef = doc(ordersCol(rid), orderId)
  return runTransaction(db, async tx => {
    const snap = await tx.get(oRef)
    if (!snap.exists()) throw new Error('La venta no existe')
    const order = { id: snap.id, ...snap.data() }
    if (order.sellerId && order.sellerId !== seller.mid && !actor.isAdmin) throw new Error('Otro vendedor ya tomó este apartado')
    const chunks = await readOrderChunks(tx, raffle, order)
    const hold = Number(raffle.holdHours || 0)
    const hasMoney = order.paidVerified + order.paidPending > 0
    const expiresAt = hasMoney ? 0 : (hold > 0 ? Date.now() + hold * 3600000 : 0)
    const status = statusFrom(order.total, order.paidVerified, order.paidPending, false)
    patchEntries(tx, rid, order, chunks, { s: status === 'paid' ? 'p' : 'v', sl: seller.mid, e: expiresAt })
    tx.update(oRef, { sellerId: seller.mid, sellerName: seller.name, status, expiresAt, claimedAt: serverTimestamp() })
    tx.update(doc(db, 'raffles', rid, 'tokens', order.token), { sellerName: seller.name, status, expiresAt, updatedAt: Date.now() })
    logWrite(tx, rid, actor, order.sellerId === seller.mid ? 'confirm' : 'claim', { orderId, numbers: order.numbers, sellerId: seller.mid, sellerName: seller.name })
  })
}

/** Registra un pago (total o abono) a una venta existente. */
export async function addPayment({ raffle, orderId, payment, actor }) {
  const rid = raffle.id
  const oRef = doc(ordersCol(rid), orderId)
  return runTransaction(db, async tx => {
    const snap = await tx.get(oRef)
    if (!snap.exists()) throw new Error('La venta no existe')
    const order = { id: snap.id, ...snap.data() }
    if (['cancelled', 'expired', 'released'].includes(order.status)) throw new Error('Esta venta ya no está activa')
    const chunks = await readOrderChunks(tx, raffle, order)
    let refSnap = null
    if (needsReference(payment.method) && payment.ref) {
      refSnap = await tx.get(doc(db, 'raffles', rid, 'refs', refKey(payment.method, payment.ref)))
    }
    const selfOk = actor.isAdmin || (raffle.cashSelfConfirm && payment.method === 'cash')
    const pStatus = selfOk ? 'verified' : 'pending'
    const amt = round2(payment.amountBase)
    const verified = round2(order.paidVerified + (pStatus === 'verified' ? amt : 0))
    const pending = round2(order.paidPending + (pStatus === 'pending' ? amt : 0))
    const status = statusFrom(order.total, verified, pending, false)
    const pRef = doc(paymentsCol(rid))
    const pd = paymentDoc(raffle, order, payment, actor, pStatus)
    if (refSnap?.exists()) pd.duplicate = true
    tx.set(pRef, pd)
    if (refSnap && !refSnap.exists()) tx.set(refSnap.ref, { pid: pRef.id, orderId, at: serverTimestamp() })
    if (payment.receipt) tx.set(doc(db, 'raffles', rid, 'receipts', pRef.id), { data: payment.receipt, createdBy: actor.uid })
    patchEntries(tx, rid, order, chunks, { s: status === 'paid' ? 'p' : 'v', a: true, e: 0 })
    tx.update(oRef, { paidVerified: verified, paidPending: pending, status, expiresAt: 0 })
    tx.update(doc(db, 'raffles', rid, 'tokens', order.token), { status, paid: verified, expiresAt: 0, updatedAt: Date.now() })
    logWrite(tx, rid, actor, 'pay', { orderId, numbers: order.numbers, amount: amt, method: payment.method, status: pStatus, duplicate: !!pd.duplicate })
    return { status: pStatus, duplicate: !!pd.duplicate }
  })
}

/** El admin verifica o rechaza un pago pendiente. */
export async function reviewPayment({ raffle, paymentId, approve, reason = '', actor }) {
  const rid = raffle.id
  const pRef = doc(paymentsCol(rid), paymentId)
  return runTransaction(db, async tx => {
    const pSnap = await tx.get(pRef)
    if (!pSnap.exists()) throw new Error('El pago no existe')
    const p = pSnap.data()
    if (p.status !== 'pending') throw new Error('Este pago ya fue revisado')
    const oRef = doc(ordersCol(rid), p.orderId)
    const oSnap = await tx.get(oRef)
    const order = { id: oSnap.id, ...oSnap.data() }
    const chunks = await readOrderChunks(tx, raffle, order, Date.now(), true)
    const amt = p.amountBase
    const verified = round2(order.paidVerified + (approve ? amt : 0))
    const pending = round2(Math.max(0, order.paidPending - amt))
    const status = statusFrom(order.total, verified, pending, false)
    const hasMoney = verified + pending > 0
    const hold = Number(raffle.holdHours || 0)
    const expiresAt = hasMoney ? 0 : (hold > 0 ? Date.now() + hold * 3600000 : 0)
    patchEntries(tx, rid, order, chunks, { s: status === 'paid' ? 'p' : 'v', a: hasMoney, e: expiresAt })
    tx.update(oRef, { paidVerified: verified, paidPending: pending, status, expiresAt })
    tx.update(pRef, approve
      ? { status: 'verified', verifiedBy: actor.uid, verifiedByName: actor.name || '', verifiedAt: serverTimestamp() }
      : { status: 'rejected', rejectReason: reason, verifiedBy: actor.uid, verifiedByName: actor.name || '', verifiedAt: serverTimestamp() })
    tx.update(doc(db, 'raffles', rid, 'tokens', order.token), { status, paid: verified, expiresAt, updatedAt: Date.now() })
    logWrite(tx, rid, actor, approve ? 'verify' : 'reject', { orderId: order.id, paymentId, numbers: order.numbers, amount: amt, reason })
  })
}

/** Anula una venta y libera sus números. */
export async function cancelOrder({ raffle, orderId, reason = '', actor }) {
  const rid = raffle.id
  const oRef = doc(ordersCol(rid), orderId)
  return runTransaction(db, async tx => {
    const snap = await tx.get(oRef)
    const order = { id: snap.id, ...snap.data() }
    if (!actor.isAdmin && order.paidVerified + order.paidPending > 0) throw new Error('Solo el administrador puede anular una venta con pagos')
    const chunks = await readChunks(tx, rid, order.numbers)
    const g = groupByChunk(order.numbers)
    for (const cid of Object.keys(g)) {
      const upd = {}
      g[cid].forEach(n => { if (chunks[cid][String(n)]?.o === orderId) upd[String(n)] = deleteField() })
      if (Object.keys(upd).length) tx.update(chunkRef(rid, cid), upd)
    }
    tx.update(oRef, { status: 'cancelled', cancelReason: reason, cancelledBy: actor.uid, cancelledAt: serverTimestamp() })
    tx.update(doc(db, 'raffles', rid, 'tokens', order.token), { status: 'cancelled', updatedAt: Date.now() })
    logWrite(tx, rid, actor, 'cancel', { orderId, numbers: order.numbers, reason })
  })
}

/** El admin reasigna una venta a otro vendedor. */
export async function transferOrder({ raffle, orderId, seller, actor }) {
  const rid = raffle.id
  const oRef = doc(ordersCol(rid), orderId)
  return runTransaction(db, async tx => {
    const snap = await tx.get(oRef)
    const order = { id: snap.id, ...snap.data() }
    const chunks = await readOrderChunks(tx, raffle, order, Date.now(), true)
    patchEntries(tx, rid, order, chunks, { sl: seller.mid })
    tx.update(oRef, { sellerId: seller.mid, sellerName: seller.name })
    tx.update(doc(db, 'raffles', rid, 'tokens', order.token), { sellerName: seller.name, updatedAt: Date.now() })
    logWrite(tx, rid, actor, 'transfer', { orderId, numbers: order.numbers, sellerId: seller.mid, sellerName: seller.name })
  })
}

export async function updateBuyer({ raffle, order, buyer, actor }) {
  const b = writeBatch(db)
  b.update(doc(ordersCol(raffle.id), order.id), { buyer })
  b.update(doc(db, 'raffles', raffle.id, 'tokens', order.token), { buyerFirst: firstName(buyer.name), updatedAt: Date.now() })
  b.set(doc(collection(db, 'raffles', raffle.id, 'logs')), {
    at: serverTimestamp(), by: actor.uid, byName: actor.name || '', action: 'edit', orderId: order.id, numbers: order.numbers, buyer: buyer.name
  })
  await b.commit()
}

/**
 * Limpieza de vencidos (la hace la app del admin al abrir la rifa):
 * borra del tablero los números vencidos y marca sus órdenes como vencidas.
 */
export async function sweepExpired({ raffle, board, actor }) {
  const now = Date.now()
  const byChunk = {}
  const orders = new Set()
  for (const k in board) {
    if (isExpired(board[k], now)) {
      (byChunk[chunkOf(Number(k))] ||= {})[k] = deleteField()
      orders.add(board[k].o)
    }
  }
  if (!orders.size) return 0
  const b = writeBatch(db)
  for (const cid in byChunk) b.update(chunkRef(raffle.id, cid), byChunk[cid])
  let count = 0
  for (const oid of orders) {
    b.update(doc(ordersCol(raffle.id), oid), { status: 'expired', expiredAt: serverTimestamp() })
    count++
  }
  b.set(doc(collection(db, 'raffles', raffle.id, 'logs')), {
    at: serverTimestamp(), by: actor.uid, byName: actor.name || 'Sistema', action: 'expire', count, orders: [...orders]
  })
  await b.commit()
  return count
}

/** Número aleatorio criptográficamente seguro en [0, max). */
export function secureRandomInt(max) {
  const limit = Math.floor(0xFFFFFFFF / max) * max
  const buf = new Uint32Array(1)
  do { crypto.getRandomValues(buf) } while (buf[0] >= limit)
  return buf[0] % max
}

/** Números que entran al sorteo según la regla de la rifa. */
export function eligibleNumbers(raffle, board) {
  const winners = new Set((raffle.winners || []).map(w => w.number))
  const now = Date.now()
  const out = []
  for (const k in board) {
    const e = effective(board[k], now)
    if (!e) continue
    if (raffle.drawRule === 'all_paid' ? e.s !== 'p' : e.s === 'r') continue
    const n = Number(k)
    if (!winners.has(n)) out.push(n)
  }
  return out.sort((a, b) => a - b)
}

/**
 * Registra un ganador para un premio. En el método "app" el número se escoge aquí
 * con un generador seguro; en lotería o sorteo externo lo indica el admin.
 */
export async function drawPrize({ raffle, place, number, evidence = '', actor, board }) {
  const rid = raffle.id
  let n = number
  let pool = null
  if (raffle.drawMethod === 'app') {
    pool = eligibleNumbers(raffle, board)
    if (!pool.length) throw new Error('No hay números que puedan participar')
    n = pool[secureRandomInt(pool.length)]
  }
  if (!n || n < 1 || n > raffle.size) throw new Error('Número ganador inválido')
  return runTransaction(db, async tx => {
    const rs = await tx.get(rRef(rid))
    const r = rs.data()
    if ((r.winners || []).some(w => w.place === place)) throw new Error('Este premio ya fue sorteado')
    const cs = await tx.get(chunkRef(rid, chunkOf(n)))
    const entry = effective(cs.exists() ? cs.data()[String(n)] : null)
    let buyerName = '', sellerName = '', orderId = '', phone = ''
    if (entry) {
      const os = await tx.get(doc(ordersCol(rid), entry.o))
      if (os.exists()) {
        const o = os.data()
        buyerName = o.buyer?.name || ''
        phone = o.buyer?.phone || ''
        sellerName = o.sellerName || ''
        orderId = os.id
      }
    }
    const prize = (r.prizes || []).find(p => p.place === place) || {}
    const winner = {
      place, prize: prize.title || '', number: n, orderId, buyerName, buyerFirst: firstName(buyerName),
      sellerName, unsold: !entry, method: r.drawMethod, evidence, pool: pool ? pool.length : null,
      at: Date.now(), byName: actor.name || ''
    }
    const winners = [...(r.winners || []), winner].sort((a, b) => a.place - b.place)
    const allDone = (r.prizes || []).every(p => winners.some(w => w.place === p.place))
    tx.update(rRef(rid), { winners, status: allDone ? 'drawn' : r.status, drawnAt: allDone ? serverTimestamp() : r.drawnAt || null })
    logWrite(tx, rid, actor, 'draw', { place, number: n, buyer: buyerName, phone, method: r.drawMethod, evidence, pool: pool ? pool.length : null })
    return winner
  })
}

export async function undoDraw({ raffle, place, actor, reason }) {
  return runTransaction(db, async tx => {
    const rs = await tx.get(rRef(raffle.id))
    const r = rs.data()
    const winners = (r.winners || []).filter(w => w.place !== place)
    tx.update(rRef(raffle.id), { winners, status: r.status === 'drawn' ? 'closed' : r.status })
    logWrite(tx, raffle.id, actor, 'undo_draw', { place, reason })
  })
}

export async function addHandover({ raffle, seller, amount, currency, note, actor }) {
  const b = writeBatch(db)
  b.set(doc(collection(db, 'raffles', raffle.id, 'handovers')), {
    sellerId: seller.mid, sellerName: seller.name, amount: round2(amount), currency, note: note || '',
    createdBy: actor.uid, createdByName: actor.name || '', createdAt: serverTimestamp()
  })
  b.set(doc(collection(db, 'raffles', raffle.id, 'logs')), {
    at: serverTimestamp(), by: actor.uid, byName: actor.name || '', action: 'handover', sellerName: seller.name, amount: round2(amount), currency
  })
  await b.commit()
}

/** Estado de cuenta de cada vendedor. */
export function sellerAccounts(raffle, orders, payments, handovers) {
  const acc = {}
  const get = mid => (acc[mid] ||= {
    mid, name: raffle.team?.[mid]?.name || '—', numbers: 0, paidNumbers: 0, orders: 0,
    sold: 0, verified: 0, pending: 0, cash: 0, delivered: 0, commission: 0, balance: 0
  })
  Object.keys(raffle.team || {}).forEach(get)
  orders.forEach(o => {
    if (!o.sellerId) return
    const st = orderStatus(o)
    if (['cancelled', 'expired', 'released'].includes(st)) return
    const a = get(o.sellerId)
    if (a.name === '—' && o.sellerName) a.name = o.sellerName
    a.orders++
    a.numbers += o.numbers.length
    a.sold += o.total
    if (st === 'paid') a.paidNumbers += o.numbers.length
  })
  payments.forEach(p => {
    if (!p.sellerId || p.status === 'rejected') return
    const a = get(p.sellerId)
    if (p.status === 'verified') a.verified += p.amountBase
    else a.pending += p.amountBase
    if (p.method === 'cash') a.cash += p.amountBase
  })
  handovers.forEach(h => { if (h.sellerId) get(h.sellerId).delivered += h.amount })
  const c = raffle.commission || { type: 'none' }
  Object.values(acc).forEach(a => {
    if (c.type === 'percent') a.commission = round2(a.verified * (Number(c.value) || 0) / 100)
    else if (c.type === 'fixed') a.commission = round2(a.paidNumbers * (Number(c.value) || 0))
    a.balance = round2(a.cash - a.delivered - a.commission)
    a.verified = round2(a.verified); a.pending = round2(a.pending); a.cash = round2(a.cash); a.sold = round2(a.sold)
  })
  return Object.values(acc).sort((x, y) => y.numbers - x.numbers)
}

export { increment }
