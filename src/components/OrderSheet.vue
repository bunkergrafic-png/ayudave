<script setup>
// Detalle de una venta: comprador, números, pagos y acciones.
import { ref, reactive, computed, watch, onBeforeUnmount } from 'vue'
import { doc, onSnapshot, collection, query, where, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import Sheet from './Sheet.vue'
import Icon from './Icon.vue'
import PaymentForm from './PaymentForm.vue'
import { money, pad, dateTime, timeLeft, round2 } from '../lib/format'
import { orderStatus, ORDER_LABEL, claimOrder, addPayment, reviewPayment, cancelOrder, transferOrder, updateBuyer } from '../lib/raffle'
import { newPayment, validatePayment, METHODS } from '../lib/payments'
import { session, actorFor } from '../lib/session'
import { whatsappUrl, ticketMessage, ticketLink, copy } from '../lib/share'
import { toast, toastError, confirmDialog, celebrate } from '../lib/ui'

const props = defineProps({ raffle: Object, orderId: String })
const emit = defineEmits(['close'])

const order = ref(null)
const payments = ref([])
const mode = ref('view') // view | pay | edit | transfer
const busy = ref(false)
const pay = reactive({})
const edit = reactive({ name: '', phone: '', ci: '', city: '', email: '' })
const transferTo = ref('')
const receipt = ref('')
let unsubs = []

const actor = computed(() => actorFor(props.raffle))
const isAdmin = computed(() => actor.value.isAdmin)
const mine = computed(() => order.value && order.value.sellerId === session.profile?.mid)
const status = computed(() => order.value ? orderStatus(order.value) : '')
const due = computed(() => order.value ? round2(order.value.total - order.value.paidVerified - order.value.paidPending) : 0)
const active = computed(() => !['cancelled', 'expired', 'released'].includes(status.value))
const canAct = computed(() => isAdmin.value || mine.value)
const team = computed(() => Object.entries(props.raffle?.team || {}).filter(([mid]) => (props.raffle.sellers || []).includes(mid)).map(([mid, t]) => ({ mid, name: t.name })))

function stop() { unsubs.forEach(u => u()); unsubs = [] }
watch(() => props.orderId, id => {
  stop()
  order.value = null
  payments.value = []
  mode.value = 'view'
  if (!id) return
  unsubs.push(onSnapshot(doc(db, 'raffles', props.raffle.id, 'orders', id), s => {
    order.value = s.exists() ? { id: s.id, ...s.data() } : null
  }, toastError))
  const base = collection(db, 'raffles', props.raffle.id, 'payments')
  const q = isAdmin.value
    ? query(base, where('orderId', '==', id))
    : query(base, where('orderId', '==', id), where('sellerId', '==', session.profile?.mid || '-'))
  unsubs.push(onSnapshot(q, s => {
    payments.value = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0))
  }, () => {}))
}, { immediate: true })
onBeforeUnmount(stop)

const badge = s => ({ paid: 'b-ok', partial: 'b-gold', pending: 'b-warn', reserved: 'b-info', cancelled: 'b-mute', expired: 'b-mute', released: 'b-mute' }[s])

async function run(fn, okMsg) {
  busy.value = true
  try { await fn(); if (okMsg) toast(okMsg) ; return true } catch (e) { toastError(e); return false } finally { busy.value = false }
}

async function claim() {
  const me = { mid: session.profile.mid, name: session.profile.name }
  await run(() => claimOrder({ raffle: props.raffle, orderId: order.value.id, seller: me, actor: actor.value }), 'Venta confirmada a tu nombre')
}
function startPay() { Object.assign(pay, newPayment(props.raffle, due.value)); mode.value = 'pay' }
async function savePay() {
  const err = validatePayment(pay, props.raffle, due.value)
  if (err) return toastError(new Error(err))
  const ok = await run(async () => {
    const r = await addPayment({ raffle: props.raffle, orderId: order.value.id, payment: { ...pay }, actor: actor.value })
    if (r.duplicate) toast('Atención: esa referencia ya se había usado en otro pago', 'error', 6000)
  }, 'Pago registrado')
  if (ok) { mode.value = 'view'; if (orderStatus(order.value) === 'paid') celebrate() }
}
async function review(p, approve) {
  let reason = ''
  if (!approve) {
    reason = await confirmDialog({ title: 'Rechazar pago', message: 'El pago no contará y el vendedor lo verá rechazado.', input: 'Motivo', confirmText: 'Rechazar', danger: true })
    if (reason === false) return
  }
  await run(() => reviewPayment({ raffle: props.raffle, paymentId: p.id, approve, reason, actor: actor.value }), approve ? 'Pago verificado' : 'Pago rechazado')
}
async function cancel() {
  const reason = await confirmDialog({
    title: 'Anular venta', danger: true, confirmText: 'Anular y liberar',
    message: `Los números ${order.value.numbers.map(n => pad(n, props.raffle.size)).join(', ')} quedarán libres otra vez.`,
    input: 'Motivo (opcional)'
  })
  if (reason === false) return
  if (await run(() => cancelOrder({ raffle: props.raffle, orderId: order.value.id, reason, actor: actor.value }), 'Venta anulada')) emit('close')
}
function startEdit() { Object.assign(edit, { name: '', phone: '', ci: '', city: '', email: '', ...order.value.buyer }); mode.value = 'edit' }
async function saveEdit() {
  if (edit.name.trim().length < 2) return toastError(new Error('Escribe el nombre'))
  if (await run(() => updateBuyer({ raffle: props.raffle, order: order.value, buyer: { ...edit }, actor: actor.value }), 'Datos actualizados')) mode.value = 'view'
}
async function saveTransfer() {
  const t = team.value.find(x => x.mid === transferTo.value)
  if (!t) return
  if (await run(() => transferOrder({ raffle: props.raffle, orderId: order.value.id, seller: t, actor: actor.value }), `Venta pasada a ${t.name}`)) mode.value = 'view'
}
async function viewReceipt(p) {
  try {
    const s = await getDoc(doc(db, 'raffles', props.raffle.id, 'receipts', p.id))
    receipt.value = s.exists() ? s.data().data : ''
    if (!receipt.value) toast('No se encontró la imagen', 'error')
  } catch (e) { toastError(e) }
}
const waLink = computed(() => order.value ? whatsappUrl(order.value.buyer.phone, ticketMessage(props.raffle, order.value, status.value)) : '')
const callLink = computed(() => order.value ? `tel:${order.value.buyer.phone}` : '')
async function copyTicket() { await copy(ticketLink(props.raffle, order.value.token)); toast('Enlace del boleto copiado') }
</script>

<template>
  <Sheet :open="!!orderId" :title="order ? order.buyer?.name : 'Cargando…'" :subtitle="order ? `Venta del ${dateTime(order.createdAt)}` : ''" @close="emit('close')">
    <div v-if="!order" class="stack"><div class="skeleton" style="height: 80px" /><div class="skeleton" style="height: 120px" /></div>
    <div v-else class="stack" style="--gap: 16px">
      <!-- Encabezado -->
      <div class="order-head">
        <div class="num-chips"><span v-for="n in order.numbers" :key="n" class="num-chip">{{ pad(n, raffle.size) }}</span></div>
        <span class="badge" :class="badge(status)">{{ ORDER_LABEL[status] }}</span>
      </div>

      <div class="grid-3 order-kpis">
        <div><span class="faint tiny">Total</span><b>{{ money(order.total, raffle.currency) }}</b></div>
        <div><span class="faint tiny">Pagado</span><b style="color: var(--ok)">{{ money(order.paidVerified, raffle.currency) }}</b></div>
        <div><span class="faint tiny">{{ order.paidPending ? 'Por verificar' : 'Falta' }}</span><b :style="{ color: order.paidPending ? 'var(--gold-600)' : 'var(--warn)' }">{{ money(order.paidPending || due, raffle.currency) }}</b></div>
      </div>

      <div v-if="active && order.expiresAt && status !== 'paid'" class="notice warn">
        <Icon name="clock" />
        <div><b>Vence en {{ timeLeft(order.expiresAt) }}</b><p class="small">Si no se registra un pago, los números se liberan solos.</p></div>
      </div>

      <!-- Modo: registrar pago -->
      <template v-if="mode === 'pay'">
        <h3>Registrar pago</h3>
        <PaymentForm :raffle="raffle" :due="due" :p="pay" />
        <div class="row">
          <button class="btn btn-ghost grow" :disabled="busy" @click="mode = 'view'">Cancelar</button>
          <button class="btn btn-primary grow" :disabled="busy" @click="savePay"><span v-if="busy" class="spinner" /><template v-else>Guardar pago</template></button>
        </div>
      </template>

      <!-- Modo: editar comprador -->
      <template v-else-if="mode === 'edit'">
        <h3>Datos del comprador</h3>
        <div class="field"><label>Nombre</label><input v-model="edit.name" class="input" /></div>
        <div class="grid-2">
          <div class="field"><label>Teléfono</label><input v-model="edit.phone" class="input" inputmode="tel" /></div>
          <div class="field"><label>Cédula</label><input v-model="edit.ci" class="input" /></div>
        </div>
        <div class="grid-2">
          <div class="field"><label>Ciudad</label><input v-model="edit.city" class="input" /></div>
          <div class="field"><label>Correo</label><input v-model="edit.email" class="input" type="email" /></div>
        </div>
        <div class="row">
          <button class="btn btn-ghost grow" @click="mode = 'view'">Cancelar</button>
          <button class="btn btn-primary grow" :disabled="busy" @click="saveEdit">Guardar</button>
        </div>
      </template>

      <!-- Modo: transferir -->
      <template v-else-if="mode === 'transfer'">
        <h3>Pasar a otro vendedor</h3>
        <select v-model="transferTo" class="select">
          <option value="" disabled>Escoge el vendedor</option>
          <option v-for="t in team" :key="t.mid" :value="t.mid" :disabled="t.mid === order.sellerId">{{ t.name }}</option>
        </select>
        <div class="row">
          <button class="btn btn-ghost grow" @click="mode = 'view'">Cancelar</button>
          <button class="btn btn-primary grow" :disabled="busy || !transferTo" @click="saveTransfer">Pasar venta</button>
        </div>
      </template>

      <template v-else>
        <!-- Apartado sin confirmar -->
        <div v-if="status === 'reserved' && active" class="claim-box">
          <div>
            <b>{{ order.sellerId ? 'Apartado desde tu enlace' : 'Apartado sin vendedor (bandeja)' }}</b>
            <p class="small muted">Contacta al comprador y confirma la venta para que quede a tu nombre.</p>
          </div>
          <button v-if="!order.sellerId || mine || isAdmin" class="btn btn-gold" :disabled="busy" @click="claim"><Icon name="hand" />{{ order.sellerId && mine ? 'Confirmar venta' : 'Tomar venta' }}</button>
        </div>

        <!-- Comprador -->
        <div class="card flat buyer-card">
          <div class="row between">
            <div class="stack" style="--gap: 2px">
              <span class="section-label">Comprador</span>
              <b>{{ order.buyer.name }}</b>
              <span class="small muted">{{ order.buyer.phone }}<template v-if="order.buyer.ci"> · CI {{ order.buyer.ci }}</template></span>
              <span v-if="order.buyer.city || order.buyer.email" class="small faint">{{ [order.buyer.city, order.buyer.email].filter(Boolean).join(' · ') }}</span>
            </div>
            <div class="row" style="--gap: 6px">
              <a class="btn btn-ghost btn-icon btn-sm" :href="callLink" aria-label="Llamar"><Icon name="phone" /></a>
              <button v-if="canAct && active" class="btn btn-ghost btn-icon btn-sm" aria-label="Editar" @click="startEdit"><Icon name="edit" /></button>
            </div>
          </div>
          <div class="divider" />
          <div class="row between small">
            <span class="muted">Vendedor</span>
            <b>{{ order.sellerName || 'Sin asignar' }}</b>
          </div>
          <div class="row between small">
            <span class="muted">Origen</span>
            <span>{{ order.source === 'public' ? 'Página pública' : 'Vendido por ' + (order.createdByName || '—') }}</span>
          </div>
        </div>

        <!-- Acciones -->
        <div v-if="active" class="order-actions">
          <a class="btn btn-wa" :href="waLink" target="_blank" rel="noopener"><Icon name="whatsapp" />Enviar boleto</a>
          <button v-if="canAct && due > 0.009 && status !== 'reserved'" class="btn btn-primary" @click="startPay"><Icon name="wallet" />Registrar pago</button>
          <button class="btn btn-ghost" @click="copyTicket"><Icon name="link" />Copiar enlace</button>
          <button v-if="isAdmin && team.length" class="btn btn-ghost" @click="transferTo = ''; mode = 'transfer'"><Icon name="swap" />Cambiar vendedor</button>
          <button v-if="isAdmin || (mine && !order.paidVerified && !order.paidPending)" class="btn btn-ghost danger-text" @click="cancel"><Icon name="ban" />Anular</button>
        </div>

        <!-- Pagos -->
        <div class="stack" style="--gap: 8px">
          <span class="section-label">Pagos</span>
          <p v-if="!payments.length" class="small faint">Aún no hay pagos registrados.</p>
          <div v-for="p in payments" :key="p.id" class="pay-row" :class="p.status">
            <div class="grow">
              <div class="row" style="--gap: 8px">
                <b>{{ money(p.amount, p.currency) }}</b>
                <span v-if="p.currency !== raffle.currency" class="small faint">≈ {{ money(p.amountBase, raffle.currency) }}</span>
                <span class="badge" :class="p.status === 'verified' ? 'b-ok' : p.status === 'pending' ? 'b-gold' : 'b-danger'">{{ p.status === 'verified' ? 'Verificado' : p.status === 'pending' ? 'Por verificar' : 'Rechazado' }}</span>
                <span v-if="p.duplicate" class="badge b-danger">¿Duplicado?</span>
              </div>
              <div class="small muted">{{ METHODS[p.method]?.label }}<template v-if="p.bank"> · {{ p.bank }}</template><template v-if="p.ref"> · Ref {{ p.ref }}</template></div>
              <div v-if="p.phone || p.ci || p.payId" class="tiny faint">{{ [p.phone, p.ci && 'CI ' + p.ci, p.payId].filter(Boolean).join(' · ') }}</div>
              <div class="tiny faint">{{ dateTime(p.createdAt) }} · {{ p.createdByName }}<template v-if="p.verifiedByName"> · revisó {{ p.verifiedByName }}</template></div>
              <div v-if="p.rejectReason" class="tiny" style="color: var(--danger)">Motivo: {{ p.rejectReason }}</div>
            </div>
            <div class="stack" style="--gap: 6px">
              <button v-if="p.hasReceipt" class="btn btn-ghost btn-sm" @click="viewReceipt(p)"><Icon name="image" />Ver</button>
              <template v-if="isAdmin && p.status === 'pending'">
                <button class="btn btn-ok btn-sm" :disabled="busy" @click="review(p, true)"><Icon name="check" />Verificar</button>
                <button class="btn btn-ghost btn-sm" :disabled="busy" @click="review(p, false)">Rechazar</button>
              </template>
            </div>
          </div>
        </div>
      </template>
    </div>
  </Sheet>
  <Sheet :open="!!receipt" title="Comprobante" @close="receipt = ''">
    <img :src="receipt" alt="Comprobante de pago" style="border-radius: 12px; width: 100%" />
  </Sheet>
</template>

<style>
.order-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.order-kpis > div { display: flex; flex-direction: column; background: var(--surface-2); border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px; }
.order-kpis b { font-family: var(--font-display); font-size: 1.05rem; }
.claim-box { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px; border-radius: 14px; background: var(--info-bg); flex-wrap: wrap; }
.buyer-card { padding: 14px; display: flex; flex-direction: column; gap: 6px; }
.order-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.order-actions .btn { width: 100%; }
.danger-text { color: var(--danger) !important; }
.pay-row { display: flex; gap: 12px; padding: 12px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface); }
.pay-row.pending { border-color: var(--gold-400); background: var(--gold-100); }
.pay-row.rejected { opacity: .7; }
</style>
