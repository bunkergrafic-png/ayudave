// Avisos (toasts) y diálogos de confirmación.
import { reactive } from 'vue'

export const toasts = reactive([])
let tid = 0
export function toast(message, type = 'ok', ms = 3200) {
  const id = ++tid
  toasts.push({ id, message, type })
  setTimeout(() => { const i = toasts.findIndex(t => t.id === id); if (i >= 0) toasts.splice(i, 1) }, ms)
}
export const toastError = e => toast(e?.message || String(e), 'error', 5200)

export const dialog = reactive({ open: false, title: '', message: '', confirmText: 'Aceptar', cancelText: 'Cancelar', danger: false, input: null, value: '', resolve: null })
export function confirmDialog({ title, message = '', confirmText = 'Sí, continuar', cancelText = 'Cancelar', danger = false, input = null, value = '' }) {
  return new Promise(resolve => Object.assign(dialog, { open: true, title, message, confirmText, cancelText, danger, input, value, resolve }))
}
export function closeDialog(result) {
  const r = dialog.resolve
  dialog.open = false
  r?.(result)
}

export async function withBusy(state, fn) {
  state.busy = true
  try { return await fn() } catch (e) { toastError(e); return undefined } finally { state.busy = false }
}

export async function celebrate(opts = {}) {
  const { default: confetti } = await import('canvas-confetti')
  const colors = ['#7C3AED', '#FBBF24', '#F5A50B', '#A78BFA', '#10B981']
  confetti({ particleCount: 120, spread: 80, origin: { y: .7 }, colors, ...opts })
}
