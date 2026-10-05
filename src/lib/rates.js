// Tasas oficiales BCV (misma fuente y validaciones que la calculadora de Mano: ve.dolarapi.com).
import { reactive } from 'vue'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db, auth } from '../firebase'

const USD_URL = 'https://ve.dolarapi.com/v1/dolares/oficial'
const EUR_URL = 'https://ve.dolarapi.com/v1/euros'
const CACHE_TTL_MS = 5 * 60 * 1000
const MIN_RATE = 1
const MAX_RATE = 100000

export const rates = reactive({ USD: 0, EUR: 0, fetchedAt: null, loading: false, error: '' })

const LS_KEY = 'rifalo.rates.v2'
try {
  const c = JSON.parse(localStorage.getItem(LS_KEY) || 'null')
  if (c) Object.assign(rates, { USD: c.USD, EUR: c.EUR, fetchedAt: c.fetchedAt })
} catch { /* sin almacenamiento local */ }

const valid = r => r && !Number.isNaN(r) && r >= MIN_RATE && r <= MAX_RATE

async function fromApi() {
  const [u, e] = await Promise.all([fetch(USD_URL), fetch(EUR_URL)])
  if (!u.ok || !e.ok) throw new Error('Tasa no disponible')
  const usd = Number((await u.json())?.promedio)
  const list = await e.json()
  const eur = Number((Array.isArray(list) ? list.find(d => d.fuente === 'oficial') : list)?.promedio)
  if (!valid(usd) || !valid(eur)) throw new Error('Tasa fuera de rango')
  return { USD: usd, EUR: eur }
}

/** Carga la tasa (caché de 5 min). Si la API falla, usa la última guardada en la base de datos. */
export async function loadRates({ force = false } = {}) {
  if (rates.loading) return rates
  const fresh = rates.fetchedAt && Date.now() - new Date(rates.fetchedAt).getTime() < CACHE_TTL_MS
  if (fresh && !force && rates.USD) return rates
  rates.loading = true
  rates.error = ''
  try {
    const r = await fromApi()
    Object.assign(rates, r, { fetchedAt: new Date().toISOString() })
    try { localStorage.setItem(LS_KEY, JSON.stringify({ USD: rates.USD, EUR: rates.EUR, fetchedAt: rates.fetchedAt })) } catch { /* noop */ }
    if (auth.currentUser && !auth.currentUser.isAnonymous) {
      setDoc(doc(db, 'config', 'rates'), { ...r, fetchedAt: rates.fetchedAt, source: 'BCV', updatedAt: serverTimestamp() }).catch(() => {})
    }
  } catch {
    try {
      const snap = await getDoc(doc(db, 'config', 'rates'))
      const d = snap.exists() ? snap.data() : null
      if (d?.USD && d?.EUR) Object.assign(rates, { USD: d.USD, EUR: d.EUR, fetchedAt: d.fetchedAt || rates.fetchedAt })
      else if (!rates.USD) rates.error = 'No se pudo obtener la tasa. Verifica tu conexión.'
    } catch {
      if (!rates.USD) rates.error = 'No se pudo obtener la tasa. Verifica tu conexión.'
    }
  } finally {
    rates.loading = false
  }
  return rates
}

/** Tasa a usar en una rifa: la manual si el admin la fijó, si no la del BCV. */
export function raffleRate(raffle) {
  if (!raffle?.rate?.enabled) return 0
  if (raffle.rate.mode === 'manual' && raffle.rate.value) return Number(raffle.rate.value)
  const base = raffle.currency === 'EUR' ? rates.EUR : rates.USD
  return Number(base || raffle.rate.value || 0)
}

export function formatDateTime(d) {
  if (!d) return ''
  return new Intl.DateTimeFormat('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date(d))
}
