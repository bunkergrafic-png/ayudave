// Compartir: WhatsApp, enlaces y correo (EmailJS, gratis hasta 200 correos/mes).
import { money, pad, normPhone, firstName } from './format'

export const baseUrl = () => location.origin

export function raffleLink(raffle, sellerCode) {
  return `${baseUrl()}/r/${raffle.slug}${sellerCode ? `?v=${encodeURIComponent(sellerCode)}` : ''}`
}
export function ticketLink(raffle, token) { return `${baseUrl()}/t/${raffle.id}/${token}` }

export function whatsappUrl(phone, text) {
  const p = normPhone(phone)
  return `https://wa.me/${p}?text=${encodeURIComponent(text)}`
}

export function ticketMessage(raffle, order, status) {
  const nums = order.numbers.map(n => pad(n, raffle.size)).join(', ')
  const prize = (raffle.prizes || []).map(p => `${p.place}° ${p.title}`).join(' · ')
  const lines = [
    `🎟️ *${raffle.title}*`,
    `Hola ${firstName(order.buyer?.name)}, ${order.numbers.length > 1 ? 'tus números son' : 'tu número es'}: *${nums}*`,
    prize ? `🏆 Premio: ${prize}` : '',
    `💵 Total: ${money(order.total, raffle.currency)}`,
    status === 'paid' ? '✅ Pago confirmado. ¡Mucha suerte!' : status === 'partial' ? `🟡 Abonado: ${money(order.paidVerified + order.paidPending, raffle.currency)}` : '⏳ Pendiente de pago',
    `Verifica tu boleto aquí: ${ticketLink(raffle, order.token)}`
  ]
  return lines.filter(Boolean).join('\n')
}

export function shareRaffleMessage(raffle, sellerCode) {
  const prize = (raffle.prizes || []).map(p => `${p.place}° ${p.title}`).join(' · ')
  return `🎟️ *${raffle.title}*\n🏆 ${prize}\n💵 ${money(raffle.price, raffle.currency)} por número\n\nEscoge tu número aquí 👉 ${raffleLink(raffle, sellerCode)}`
}

export async function copy(text) {
  try { await navigator.clipboard.writeText(text); return true } catch {
    const t = document.createElement('textarea')
    t.value = text; document.body.appendChild(t); t.select()
    const ok = document.execCommand('copy'); t.remove(); return ok
  }
}

export async function nativeShare({ title, text, url }) {
  if (navigator.share) {
    try { await navigator.share({ title, text, url }); return true } catch { return false }
  }
  await copy(url ? `${text}\n${url}` : text)
  return false
}

let emailjsLoaded = null
function loadEmailJs() {
  emailjsLoaded ||= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js'
    s.onload = () => resolve(window.emailjs)
    s.onerror = reject
    document.head.appendChild(s)
  })
  return emailjsLoaded
}

/** Envía el comprobante por correo si la organización configuró EmailJS. */
export async function emailTicket(org, raffle, order, status) {
  const cfg = org?.emailjs
  if (!cfg?.serviceId || !cfg?.templateId || !cfg?.publicKey || !order.buyer?.email) return false
  const ejs = await loadEmailJs()
  await ejs.send(cfg.serviceId, cfg.templateId, {
    to_email: order.buyer.email,
    to_name: order.buyer.name,
    raffle: raffle.title,
    numbers: order.numbers.map(n => pad(n, raffle.size)).join(', '),
    total: money(order.total, raffle.currency),
    status: status === 'paid' ? 'Pagado' : status === 'partial' ? 'Abonado' : 'Pendiente de pago',
    link: ticketLink(raffle, order.token),
    message: ticketMessage(raffle, order, status)
  }, { publicKey: cfg.publicKey })
  return true
}
