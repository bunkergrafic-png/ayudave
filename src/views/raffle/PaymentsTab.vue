<script setup>
import { ref, inject, computed } from 'vue'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import Icon from '../../components/Icon.vue'
import Sheet from '../../components/Sheet.vue'
import { isRaffleAdmin, actorFor } from '../../lib/session'
import { reviewPayment } from '../../lib/raffle'
import { METHODS } from '../../lib/payments'
import { money, pad, dateTime } from '../../lib/format'
import { toast, toastError, confirmDialog } from '../../lib/ui'

const ctx = inject('ctx')
const tab = ref('pending')
const busy = ref('')
const receipt = ref('')
const isAdmin = computed(() => isRaffleAdmin(ctx.raffle))
const list = computed(() => ctx.payments.filter(p => tab.value === 'all' || p.status === tab.value))
const count = s => ctx.payments.filter(p => p.status === s).length

async function review(p, approve) {
  let reason = ''
  if (!approve) {
    reason = await confirmDialog({ title: 'Rechazar pago', message: `${money(p.amount, p.currency)} de ${p.buyerName}. No contará como pagado.`, input: 'Motivo', confirmText: 'Rechazar', danger: true })
    if (reason === false) return
  }
  busy.value = p.id
  try {
    await reviewPayment({ raffle: ctx.raffle, paymentId: p.id, approve, reason, actor: actorFor(ctx.raffle) })
    toast(approve ? 'Pago verificado ✅' : 'Pago rechazado')
  } catch (e) { toastError(e) } finally { busy.value = '' }
}
async function view(p) {
  try {
    const s = await getDoc(doc(db, 'raffles', ctx.raffle.id, 'receipts', p.id))
    receipt.value = s.exists() ? s.data().data : ''
  } catch (e) { toastError(e) }
}
</script>

<template>
  <div class="stack" style="--gap: 12px">
    <div class="segmented">
      <button :class="{ on: tab === 'pending' }" @click="tab = 'pending'">Por verificar {{ count('pending') }}</button>
      <button :class="{ on: tab === 'verified' }" @click="tab = 'verified'">Verificados {{ count('verified') }}</button>
      <button :class="{ on: tab === 'rejected' }" @click="tab = 'rejected'">Rechazados {{ count('rejected') }}</button>
      <button :class="{ on: tab === 'all' }" @click="tab = 'all'">Todos</button>
    </div>
    <div v-if="!list.length" class="card empty">
      <div class="ico"><Icon name="checkCircle" /></div>
      <p>{{ tab === 'pending' ? '¡Todo al día! No hay pagos por verificar.' : 'No hay pagos aquí.' }}</p>
    </div>
    <div v-else class="pay-grid">
      <div v-for="p in list" :key="p.id" class="card pay-card" :class="p.status">
        <div class="row between">
          <div>
            <div class="pay-amount">{{ money(p.amount, p.currency) }}</div>
            <div v-if="p.currency !== ctx.raffle.currency" class="tiny faint">≈ {{ money(p.amountBase, ctx.raffle.currency) }} · tasa {{ p.rate }}</div>
          </div>
          <span class="method-pill"><Icon :name="METHODS[p.method]?.icon" :size="16" />{{ METHODS[p.method]?.label }}</span>
        </div>
        <div class="row wrap" style="--gap: 6px">
          <span v-for="n in p.numbers" :key="n" class="num-chip">{{ pad(n, ctx.raffle.size) }}</span>
          <span v-if="p.duplicate" class="badge b-danger">Referencia repetida</span>
        </div>
        <div class="pay-meta">
          <div><span>Comprador</span><b>{{ p.buyerName }}</b></div>
          <div><span>Vendedor</span><b>{{ p.sellerName || '—' }}</b></div>
          <template v-if="p.method === 'pm' || p.method === 'transfer'">
            <div><span>Banco</span><b>{{ p.bank }}</b></div>
            <div><span>Referencia</span><b class="mono">{{ p.ref }}</b></div>
            <div><span>Teléfono</span><b>{{ p.phone }}</b></div>
            <div><span>Cédula</span><b>{{ p.ci }}</b></div>
          </template>
          <template v-if="p.method === 'binance'">
            <div><span>ID orden</span><b class="mono">{{ p.ref }}</b></div>
            <div><span>Pay ID / correo</span><b>{{ p.payId }}</b></div>
          </template>
        </div>
        <div v-if="p.note" class="small muted">“{{ p.note }}”</div>
        <div class="tiny faint">{{ dateTime(p.createdAt) }} · registró {{ p.createdByName }}<template v-if="p.verifiedByName"> · revisó {{ p.verifiedByName }}</template></div>
        <div v-if="p.rejectReason" class="tiny" style="color: var(--danger)">Motivo: {{ p.rejectReason }}</div>
        <div class="row wrap" style="--gap: 8px">
          <button v-if="p.hasReceipt" class="btn btn-ghost btn-sm" @click="view(p)"><Icon name="image" />Comprobante</button>
          <button class="btn btn-ghost btn-sm" @click="ctx.openOrder(p.orderId)"><Icon name="ticket" />Venta</button>
          <div class="grow" />
          <template v-if="isAdmin && p.status === 'pending'">
            <button class="btn btn-ghost btn-sm" :disabled="busy === p.id" @click="review(p, false)">Rechazar</button>
            <button class="btn btn-ok btn-sm" :disabled="busy === p.id" @click="review(p, true)"><span v-if="busy === p.id" class="spinner" /><template v-else><Icon name="check" />Verificar</template></button>
          </template>
          <span v-else class="badge" :class="p.status === 'verified' ? 'b-ok' : p.status === 'pending' ? 'b-gold' : 'b-danger'">{{ p.status === 'verified' ? 'Verificado' : p.status === 'pending' ? 'Por verificar' : 'Rechazado' }}</span>
        </div>
      </div>
    </div>
    <Sheet :open="!!receipt" title="Comprobante" @close="receipt = ''"><img :src="receipt" alt="Comprobante" style="border-radius: 12px; width: 100%" /></Sheet>
  </div>
</template>

<style>
.pay-grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); }
.pay-card { display: flex; flex-direction: column; gap: 10px; }
.pay-card.pending { border-color: var(--gold-400); box-shadow: 0 0 0 3px var(--gold-100); }
.pay-amount { font-family: var(--font-display); font-weight: 800; font-size: 1.4rem; }
.method-pill { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 99px; background: var(--surface-2); border: 1px solid var(--line); font-size: .78rem; font-weight: 700; }
.pay-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 12px; padding: 10px 12px; border-radius: 12px; background: var(--surface-2); }
.pay-meta > div { display: flex; flex-direction: column; min-width: 0; }
.pay-meta span { font-size: .68rem; text-transform: uppercase; letter-spacing: .05em; color: var(--text-3); font-weight: 700; }
.pay-meta b { font-size: .86rem; overflow: hidden; text-overflow: ellipsis; }
@media (max-width: 380px) { .pay-grid { grid-template-columns: 1fr; } }
</style>
