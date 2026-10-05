// Crear y editar rifas.
import { doc, collection, getDoc, writeBatch, serverTimestamp, updateDoc, query, where, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import { chunkCount } from './raffle'
import { slugify, randomToken } from './format'

export function defaultRaffle(orgId) {
  return {
    orgId,
    title: '',
    description: '',
    cover: '',
    status: 'draft',
    size: 100,
    price: 1,
    currency: 'USD',
    rate: { enabled: true, mode: 'bcv', value: 0 },
    prizes: [{ place: 1, title: '', value: 0, image: '' }],
    goal: 0,
    drawRule: 'all_sold',
    drawMethod: 'app',
    drawDate: '',
    lotteryName: '',
    holdHours: 48,
    allowPartial: true,
    cashSelfConfirm: false,
    assignMode: 'free',
    blocks: [],
    commission: { type: 'none', value: 0 },
    methods: {
      cash: { enabled: true, currencies: ['USD', 'VES'] },
      pm: { enabled: false, bank: '', phone: '', ci: '', holder: '' },
      transfer: { enabled: false, bank: '', account: '', ci: '', holder: '' },
      binance: { enabled: false, payId: '', email: '', holder: '' }
    },
    public: { enabled: true, allowReserve: true, holdMinutes: 120, maxPerOrder: 5, showBuyerNames: false },
    sellers: [],
    coadmins: [],
    team: {},
    winners: [],
    contactPhone: ''
  }
}

async function freeSlug(base) {
  let s = slugify(base) || 'rifa'
  for (let i = 0; i < 20; i++) {
    const cand = i === 0 ? s : `${s}-${randomToken(4)}`
    const snap = await getDoc(doc(db, 'slugs', cand))
    if (!snap.exists()) return cand
  }
  return `${s}-${randomToken(6)}`
}

export async function createRaffle(data, actor) {
  const ref = doc(collection(db, 'raffles'))
  const slug = await freeSlug(data.title)
  // 1) la rifa (las reglas de los chunks y del slug necesitan que ya exista)
  const b1 = writeBatch(db)
  b1.set(ref, { ...data, slug, createdAt: serverTimestamp(), createdBy: actor.uid, updatedAt: serverTimestamp() })
  await b1.commit()
  // 2) tablero vacío + enlace bonito
  const b2 = writeBatch(db)
  for (let i = 0; i < chunkCount(data.size); i++) b2.set(doc(db, 'raffles', ref.id, 'chunks', String(i)), {})
  b2.set(doc(db, 'slugs', slug), { rid: ref.id })
  b2.set(doc(collection(db, 'raffles', ref.id, 'logs')), {
    at: serverTimestamp(), by: actor.uid, byName: actor.name || '', action: 'raffle_create', title: data.title
  })
  await b2.commit()
  return { id: ref.id, slug }
}

export async function saveRaffle(raffle, patch, actor, prevSize) {
  const b = writeBatch(db)
  b.update(doc(db, 'raffles', raffle.id), { ...patch, updatedAt: serverTimestamp() })
  // Si aumentó la cantidad de números, crear los documentos del tablero que falten.
  if (patch.size && patch.size > prevSize) {
    for (let i = chunkCount(prevSize); i < chunkCount(patch.size); i++) {
      b.set(doc(db, 'raffles', raffle.id, 'chunks', String(i)), {}, { merge: true })
    }
  }
  b.set(doc(collection(db, 'raffles', raffle.id, 'logs')), {
    at: serverTimestamp(), by: actor.uid, byName: actor.name || '', action: 'raffle_update', fields: Object.keys(patch)
  })
  await b.commit()
}

export async function setRaffleStatus(raffle, status, actor) {
  const b = writeBatch(db)
  b.update(doc(db, 'raffles', raffle.id), { status, updatedAt: serverTimestamp() })
  b.set(doc(collection(db, 'raffles', raffle.id, 'logs')), {
    at: serverTimestamp(), by: actor.uid, byName: actor.name || '', action: 'status', status
  })
  await b.commit()
}

export async function changeSlug(raffle, newSlug) {
  const s = slugify(newSlug)
  if (!s) throw new Error('Enlace inválido')
  if (s === raffle.slug) return s
  const snap = await getDoc(doc(db, 'slugs', s))
  if (snap.exists()) throw new Error('Ese enlace ya está en uso')
  const b = writeBatch(db)
  b.set(doc(db, 'slugs', s), { rid: raffle.id })
  if (raffle.slug) b.delete(doc(db, 'slugs', raffle.slug))
  b.update(doc(db, 'raffles', raffle.id), { slug: s })
  await b.commit()
  return s
}

export async function rafflesFor(profile) {
  const col = collection(db, 'raffles')
  if (profile.role === 'super') return (await getDocs(col)).docs.map(d => ({ id: d.id, ...d.data() }))
  if (profile.role === 'owner') {
    return (await getDocs(query(col, where('orgId', '==', profile.orgId)))).docs.map(d => ({ id: d.id, ...d.data() }))
  }
  const [a, b] = await Promise.all([
    getDocs(query(col, where('orgId', '==', profile.orgId), where('sellers', 'array-contains', profile.mid))),
    getDocs(query(col, where('orgId', '==', profile.orgId), where('coadmins', 'array-contains', profile.mid)))
  ])
  const map = {}
  ;[...a.docs, ...b.docs].forEach(d => { map[d.id] = { id: d.id, ...d.data() } })
  return Object.values(map)
}

export async function setTeam(raffle, { sellers, coadmins, team }, actor) {
  await saveRaffle(raffle, { sellers, coadmins, team }, actor, raffle.size)
}

export { updateDoc }
