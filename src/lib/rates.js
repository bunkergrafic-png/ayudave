// Tasas oficiales BCV (misma fuente que usamos en Bunkergraf y Renuevo: ve.dolarapi.com).
import { reactive } from 'vue'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db, auth } from '../firebase'

export const rates = reactive({ USD: 0, EUR: 0, date: null, loading: false, error: '' })

const LS_KEY = 'rifalo.rates'
try {
  const cached = JSON.parse(localStorage.getItem(LS_KEY) || 'null')
  if (cached) Object.assign(rates, cached)
} catch { /* sin almacenamiento local */ }

function remember() {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ USD: rates.USD, EUR: rates.EUR, date: rates.date })) } catch { /* noop */ }
}

async function fromApi() {
  const [u, e] = await Promise.all([
    fetch('https://ve.dolarapi.com/v1/dolares/oficial').then(r => r.json()),
    fetch('https://ve.dolarapi.com/v1/euros/oficial').then(r => r.json())
  ])
  return {
    USD: Number(u.promedio || u.venta) || 0,
    EUR: Number(e.promedio || e.venta) || 0,
    date: u.fechaActualizacion || new Date().toISOString()
  }
}

/** Carga la tasa: primero la API del BCV; si falla, la última guardada en la base de datos. */
export async function loadRates({ force = false } = {}) {
  if (rates.loading) return rates
  const fresh = rates.date && Date.now() - new Date(rates.fetchedAt || 0).getTime() < 30 * 60000
  if (fresh && !force) return rates
  rates.loading = true
  rates.error = ''
  try {
    const r = await fromApi()
    if (!r.USD) throw new Error('Tasa vacía')
    Object.assign(rates, r, { fetchedAt: new Date().toISOString() })
    remember()
    if (auth.currentUser && !auth.currentUser.isAnonymous) {
      setDoc(doc(db, 'config', 'rates'), { ...r, source: 'BCV', updatedAt: serverTimestamp() }).catch(() => {})
    }
  } catch {
    try {
      const snap = await getDoc(doc(db, 'config', 'rates'))
      if (snap.exists()) {
        const d = snap.data()
        Object.assign(rates, { USD: d.USD, EUR: d.EUR, date: d.date })
        remember()
      } else rates.error = 'No se pudo consultar la tasa BCV'
    } catch { rates.error = 'No se pudo consultar la tasa BCV' }
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
