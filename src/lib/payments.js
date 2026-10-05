// Métodos de pago y validación.
import { round2 } from './format'

export const BANKS = [
  'Banco de Venezuela', 'Banesco', 'Mercantil', 'BBVA Provincial', 'BNC Nacional de Crédito', 'Bancamiga',
  'Banplus', 'Bicentenario', 'Banco del Tesoro', 'Bancaribe', 'Banco Exterior', 'Venezolano de Crédito',
  'Banco Caroní', 'Sofitasa', 'Banco Plaza', 'Banco Fondo Común', '100% Banco', 'DelSur', 'Banco Activo',
  'Bancrecer', 'Mi Banco', 'Banfanb', 'Banco Agrícola', 'R4', 'Otro'
]

export const METHODS = {
  cash: { label: 'Efectivo', icon: 'banknote' },
  pm: { label: 'Pago móvil', icon: 'smartphone' },
  transfer: { label: 'Transferencia', icon: 'bank' },
  binance: { label: 'Binance / USDT', icon: 'bitcoin' }
}

export function enabledMethods(raffle) {
  return Object.keys(METHODS).filter(k => raffle.methods?.[k]?.enabled)
}

export function newPayment(raffle, due) {
  const m = enabledMethods(raffle)[0] || 'cash'
  return { method: m, currency: defaultCurrency(raffle, m), amount: round2(due), bank: '', phone: '', ci: '', ref: '', payId: '', note: '', receipt: '' }
}

export function defaultCurrency(raffle, method) {
  if (method === 'pm' || method === 'transfer') return raffle.rate?.enabled ? 'VES' : raffle.currency
  if (method === 'binance') return 'USDT'
  return raffle.currency
}

/** Convierte el monto pagado a la moneda base de la rifa. */
export function toBase(raffle, currency, amount, rate) {
  const a = Number(amount) || 0
  if (currency === 'VES' && raffle.currency !== 'VES') return rate ? round2(a / rate) : 0
  return round2(a)
}
export function fromBase(raffle, currency, base, rate) {
  if (currency === 'VES' && raffle.currency !== 'VES') return round2(base * rate)
  return round2(base)
}

export function validatePayment(p, raffle, due) {
  if (!(Number(p.amount) > 0)) return 'Escribe el monto del pago'
  if (p.currency === 'VES' && raffle.currency !== 'VES' && !p.rate) return 'No hay tasa de cambio. Actualiza la tasa BCV.'
  if (p.amountBase > due + 0.01) return `El pago supera lo que falta (${due})`
  if (!raffle.allowPartial && Math.abs(p.amountBase - due) > 0.01) return 'Esta rifa no acepta abonos: el pago debe ser por el total'
  if (p.method === 'pm' || p.method === 'transfer') {
    if (!p.bank) return 'Indica el banco desde donde se hizo el pago'
    if (!String(p.phone).replace(/\D/g, '')) return 'Indica el teléfono desde donde se hizo el pago'
    if (!String(p.ci).trim()) return 'Indica la cédula del titular'
    if (String(p.ref).replace(/\D/g, '').length < 4) return 'Indica el número de referencia (mínimo 4 dígitos)'
  }
  if (p.method === 'binance') {
    if (!String(p.ref).trim()) return 'Indica el ID de la orden o transacción de Binance'
    if (!String(p.payId).trim()) return 'Indica el Pay ID o correo de quien pagó'
  }
  return ''
}
