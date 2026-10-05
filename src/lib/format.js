// Utilidades de formato (es-VE).

export const CURRENCIES = {
  USD: { symbol: '$', name: 'Dólares', decimals: 2 },
  VES: { symbol: 'Bs', name: 'Bolívares', decimals: 2 },
  EUR: { symbol: '€', name: 'Euros', decimals: 2 },
  USDT: { symbol: 'USDT', name: 'Tether', decimals: 2 },
  COP: { symbol: 'COP', name: 'Pesos colombianos', decimals: 0 }
}

export function money(value, currency = 'USD') {
  const c = CURRENCIES[currency] || { symbol: currency, decimals: 2 }
  const n = Number(value || 0).toLocaleString('es-VE', {
    minimumFractionDigits: c.decimals,
    maximumFractionDigits: c.decimals
  })
  return currency === 'USD' ? `$${n}` : `${c.symbol} ${n}`
}

export function round2(n) { return Math.round((Number(n) || 0) * 100) / 100 }

/** Cantidad de cifras para mostrar los números de una rifa (200 → 3, 1000 → 4). */
export function digitsFor(size) { return Math.max(2, String(size).length) }
export function pad(n, size) { return String(n).padStart(digitsFor(size), '0') }

export function toDate(v) {
  if (!v) return null
  if (v instanceof Date) return v
  if (typeof v === 'number') return new Date(v)
  if (typeof v.toDate === 'function') return v.toDate()
  if (typeof v.seconds === 'number') return new Date(v.seconds * 1000)
  return new Date(v)
}

export function dateTime(v) {
  const d = toDate(v)
  if (!d) return '—'
  return d.toLocaleString('es-VE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function dateOnly(v) {
  const d = toDate(v)
  if (!d) return '—'
  return d.toLocaleDateString('es-VE', { day: '2-digit', month: 'long', year: 'numeric' })
}

export function timeLeft(ms) {
  const diff = ms - Date.now()
  if (diff <= 0) return 'vencido'
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  if (h < 48) return `${h} h ${m % 60} min`
  return `${Math.floor(h / 24)} días`
}

export function ago(v) {
  const d = toDate(v)
  if (!d) return ''
  const s = Math.floor((Date.now() - d.getTime()) / 1000)
  if (s < 60) return 'hace un momento'
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`
  return `hace ${Math.floor(s / 86400)} d`
}

export function slugify(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
}

export function normPhone(p) {
  let d = String(p || '').replace(/\D/g, '')
  if (d.startsWith('0')) d = '58' + d.slice(1)
  else if (d.length === 10 && d.startsWith('4')) d = '58' + d
  return d
}

export function firstName(name) { return String(name || '').trim().split(/\s+/)[0] || '' }

export function initials(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

export function randomToken(len = 12) {
  const abc = 'abcdefghijkmnpqrstuvwxyz23456789'
  const a = crypto.getRandomValues(new Uint8Array(len))
  return Array.from(a, b => abc[b % abc.length]).join('')
}

export function randomPassword() {
  const words = ['sol', 'mar', 'rio', 'luz', 'pan', 'flor', 'luna', 'cielo', 'nube', 'roca', 'lago', 'palma']
  const a = crypto.getRandomValues(new Uint32Array(3))
  return words[a[0] % words.length] + words[a[1] % words.length] + (1000 + (a[2] % 9000))
}

export function parseRanges(text, size) {
  // "1-50, 75, 80-90" → [1..50, 75, 80..90]
  const out = new Set()
  String(text || '').split(/[,\s;]+/).filter(Boolean).forEach(part => {
    const m = part.match(/^(\d+)(?:-(\d+))?$/)
    if (!m) return
    let a = parseInt(m[1], 10), b = m[2] ? parseInt(m[2], 10) : a
    if (a > b) [a, b] = [b, a]
    for (let i = Math.max(1, a); i <= Math.min(size, b); i++) out.add(i)
  })
  return [...out].sort((x, y) => x - y)
}

export function compressRanges(nums) {
  const s = [...nums].sort((a, b) => a - b)
  const out = []
  for (let i = 0; i < s.length; i++) {
    let j = i
    while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++
    out.push(i === j ? `${s[i]}` : `${s[i]}-${s[j]}`)
    i = j
  }
  return out.join(', ')
}
