<script setup>
import { ref, inject, computed, reactive } from 'vue'
import Icon from '../../components/Icon.vue'
import Sheet from '../../components/Sheet.vue'
import { session, isRaffleAdmin, actorFor } from '../../lib/session'
import { sellerAccounts, addHandover } from '../../lib/raffle'
import { money, dateTime, initials } from '../../lib/format'
import { toast, toastError } from '../../lib/ui'

const ctx = inject('ctx')
const isAdmin = computed(() => isRaffleAdmin(ctx.raffle))
const mid = computed(() => session.profile?.mid)
const accounts = computed(() => sellerAccounts(ctx.raffle, ctx.orders, ctx.payments, ctx.handovers))
const mine = computed(() => accounts.value.find(a => a.mid === mid.value) || sellerAccounts({ ...ctx.raffle, team: { [mid.value]: { name: session.profile?.name } } }, ctx.orders, ctx.payments, ctx.handovers).find(a => a.mid === mid.value))
const cur = computed(() => ctx.raffle.currency)
const commissionLabel = computed(() => {
  const c = ctx.raffle.commission || {}
  return c.type === 'percent' ? `${c.value}% de lo cobrado` : c.type === 'fixed' ? `${money(c.value, cur.value)} por número pagado` : 'Sin comisión'
})

const ho = reactive({ open: false, seller: null, amount: 0, note: '', busy: false })
function openHandover(a) { Object.assign(ho, { open: true, seller: a, amount: Math.max(0, a.balance), note: '' }) }
async function saveHandover() {
  if (!(ho.amount > 0)) return toastError(new Error('Escribe el monto entregado'))
  ho.busy = true
  try {
    await addHandover({ raffle: ctx.raffle, seller: { mid: ho.seller.mid, name: ho.seller.name }, amount: ho.amount, currency: cur.value, note: ho.note, actor: actorFor(ctx.raffle) })
    toast('Entrega registrada')
    ho.open = false
  } catch (e) { toastError(e) } finally { ho.busy = false }
}
const maxNumbers = computed(() => Math.max(1, ...accounts.value.map(a => a.numbers)))
</script>

<template>
  <div class="stack" style="--gap: 14px">
    <!-- Vista del vendedor -->
    <template v-if="!isAdmin && mine">
      <div class="grid-2">
        <div class="kpi"><span>Números vendidos</span><b>{{ mine.numbers }}</b><small>{{ mine.paidNumbers }} pagados</small></div>
        <div class="kpi"><span>Cobrado (verificado)</span><b>{{ money(mine.verified, cur) }}</b><small v-if="mine.pending">{{ money(mine.pending, cur) }} por verificar</small></div>
        <div class="kpi"><span>Mi comisión</span><b class="ok">{{ money(mine.commission, cur) }}</b><small>{{ commissionLabel }}</small></div>
        <div class="kpi" :class="{ alert: mine.balance > 0 }"><span>Efectivo por entregar</span><b>{{ money(Math.max(0, mine.balance), cur) }}</b><small>Cobrado en efectivo {{ money(mine.cash, cur) }} · entregado {{ money(mine.delivered, cur) }}</small></div>
      </div>
      <div class="card">
        <div class="card-title"><h3>Mis entregas al organizador</h3></div>
        <p v-if="!ctx.handovers.length" class="small faint">Aún no hay entregas registradas.</p>
        <div v-for="h in ctx.handovers" :key="h.id" class="row between ho-row">
          <div><b>{{ money(h.amount, h.currency) }}</b><div class="tiny faint">{{ dateTime(h.createdAt) }} · recibió {{ h.createdByName }}<template v-if="h.note"> · {{ h.note }}</template></div></div>
          <Icon name="checkCircle" class="ok-ico" />
        </div>
      </div>
    </template>

    <!-- Vista del admin -->
    <template v-else-if="isAdmin">
      <div class="row wrap between">
        <p class="small muted">Comisión: <b>{{ commissionLabel }}</b></p>
        <RouterLink :to="`/rifa/${ctx.raffle.id}/editar`" class="btn btn-ghost btn-sm"><Icon name="users" />Asignar vendedores</RouterLink>
      </div>
      <div v-if="!accounts.length" class="card empty"><div class="ico"><Icon name="users" /></div><p>Esta rifa aún no tiene vendedores asignados.</p></div>
      <div class="acc-grid">
        <div v-for="(a, i) in accounts" :key="a.mid" class="card acc-card">
          <div class="row">
            <span class="avatar">{{ initials(a.name) }}</span>
            <div class="grow"><b>{{ a.name }}</b><div class="tiny faint">{{ a.orders }} ventas · {{ a.numbers }} números</div></div>
            <span v-if="i === 0 && a.numbers" class="badge b-gold plain">🏆 Top</span>
          </div>
          <div class="progress" style="height: 8px"><span class="sold" :style="{ width: (a.numbers / maxNumbers * 100) + '%' }" /></div>
          <div class="acc-meta">
            <div><span>Verificado</span><b>{{ money(a.verified, cur) }}</b></div>
            <div><span>Por verificar</span><b>{{ money(a.pending, cur) }}</b></div>
            <div><span>Efectivo</span><b>{{ money(a.cash, cur) }}</b></div>
            <div><span>Entregado</span><b>{{ money(a.delivered, cur) }}</b></div>
            <div><span>Comisión</span><b class="ok">{{ money(a.commission, cur) }}</b></div>
            <div><span>{{ a.balance >= 0 ? 'Debe entregar' : 'Se le debe' }}</span><b :class="a.balance > 0 ? 'warn' : ''">{{ money(Math.abs(a.balance), cur) }}</b></div>
          </div>
          <button class="btn btn-soft btn-sm" @click="openHandover(a)"><Icon name="banknote" />Registrar entrega</button>
        </div>
      </div>
      <div v-if="ctx.handovers.length" class="card">
        <div class="card-title"><h3>Entregas registradas</h3></div>
        <div v-for="h in ctx.handovers" :key="h.id" class="row between ho-row">
          <div><b>{{ h.sellerName }}</b> entregó <b>{{ money(h.amount, h.currency) }}</b><div class="tiny faint">{{ dateTime(h.createdAt) }} · recibió {{ h.createdByName }}<template v-if="h.note"> · {{ h.note }}</template></div></div>
        </div>
      </div>
    </template>

    <Sheet :open="ho.open" title="Registrar entrega de dinero" :subtitle="ho.seller ? `${ho.seller.name} te entrega efectivo` : ''" @close="ho.open = false">
      <div class="stack" style="--gap: 14px">
        <div class="field"><label>Monto ({{ cur }})</label><input v-model.number="ho.amount" class="input mono" type="number" step="0.01" inputmode="decimal" /></div>
        <div class="field"><label>Nota</label><input v-model="ho.note" class="input" placeholder="Ej. entregó en billetes de $20" /></div>
      </div>
      <template #footer>
        <button class="btn btn-ghost" @click="ho.open = false">Cancelar</button>
        <button class="btn btn-primary" :disabled="ho.busy" @click="saveHandover">Guardar</button>
      </template>
    </Sheet>
  </div>
</template>

<style>
.kpi { background: var(--surface); border: 1px solid var(--line); border-radius: 18px; padding: 16px; display: flex; flex-direction: column; gap: 2px; box-shadow: var(--shadow-sm); }
.kpi span { font-size: .74rem; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--text-3); }
.kpi b { font-family: var(--font-display); font-size: 1.6rem; }
.kpi b.ok { color: var(--ok); }
.kpi small { color: var(--text-3); font-size: .75rem; }
.kpi.alert { border-color: var(--gold-400); background: var(--gold-100); }
.acc-grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); }
.acc-card { display: flex; flex-direction: column; gap: 12px; }
.acc-meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.acc-meta > div { display: flex; flex-direction: column; }
.acc-meta span { font-size: .66rem; text-transform: uppercase; letter-spacing: .04em; color: var(--text-3); font-weight: 700; }
.acc-meta b { font-size: .9rem; }
.acc-meta b.ok { color: var(--ok); }
.acc-meta b.warn { color: var(--warn); }
.ho-row { padding: 10px 0; border-bottom: 1px solid var(--line); }
.ho-row:last-child { border-bottom: 0; }
.ok-ico { color: var(--ok); }
</style>
