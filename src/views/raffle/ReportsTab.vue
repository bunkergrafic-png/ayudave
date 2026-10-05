<script setup>
import { inject, computed, ref } from 'vue'
import Icon from '../../components/Icon.vue'
import { sellerAccounts, orderStatus } from '../../lib/raffle'
import { exportExcel, exportPdf, methodLabel } from '../../lib/exporter'
import { money, toDate, round2 } from '../../lib/format'
import { raffleRate } from '../../lib/rates'
import { toastError } from '../../lib/ui'

const ctx = inject('ctx')
const busy = ref('')
const cur = computed(() => ctx.raffle.currency)
const accounts = computed(() => sellerAccounts(ctx.raffle, ctx.orders, ctx.payments, ctx.handovers))
const verified = computed(() => ctx.payments.filter(p => p.status === 'verified'))
const collected = computed(() => round2(verified.value.reduce((s, p) => s + p.amountBase, 0)))
const pending = computed(() => round2(ctx.payments.filter(p => p.status === 'pending').reduce((s, p) => s + p.amountBase, 0)))
const goal = computed(() => ctx.raffle.size * ctx.raffle.price)
const owed = computed(() => {
  let s = 0
  ctx.orders.forEach(o => { const st = orderStatus(o); if (st === 'pending' || st === 'partial') s += o.total - o.paidVerified - o.paidPending })
  return round2(s)
})
const rate = computed(() => raffleRate(ctx.raffle))

const days = computed(() => {
  const map = {}
  const today = new Date(); today.setHours(0, 0, 0, 0)
  for (let i = 13; i >= 0; i--) { const d = new Date(today); d.setDate(d.getDate() - i); map[d.toDateString()] = { d, n: 0 } }
  ctx.orders.forEach(o => {
    if (['cancelled'].includes(o.status)) return
    const d = toDate(o.createdAt); if (!d) return
    d.setHours(0, 0, 0, 0)
    if (map[d.toDateString()]) map[d.toDateString()].n += o.numbers.length
  })
  return Object.values(map)
})
const maxDay = computed(() => Math.max(1, ...days.value.map(d => d.n)))
const byMethod = computed(() => {
  const m = {}
  verified.value.forEach(p => { m[p.method] = (m[p.method] || 0) + p.amountBase })
  const total = Object.values(m).reduce((a, b) => a + b, 0) || 1
  return Object.entries(m).map(([k, v]) => ({ k, label: methodLabel(k), v: round2(v), pct: v / total * 100 })).sort((a, b) => b.v - a.v)
})
const maxSeller = computed(() => Math.max(1, ...accounts.value.map(a => a.numbers)))

async function doExport(kind) {
  busy.value = kind
  try {
    const data = { orders: ctx.orders, payments: ctx.payments, accounts: accounts.value, board: ctx.board, stats: ctx.stats }
    if (kind === 'xlsx') await exportExcel(ctx.raffle, data)
    else await exportPdf(ctx.raffle, data)
  } catch (e) { toastError(e) } finally { busy.value = '' }
}
</script>

<template>
  <div class="stack" style="--gap: 14px">
    <div class="row wrap between">
      <h2>Resumen</h2>
      <div class="row" style="--gap: 8px">
        <button class="btn btn-ghost btn-sm" :disabled="!!busy" @click="doExport('xlsx')"><span v-if="busy === 'xlsx'" class="spinner" /><Icon v-else name="download" />Excel</button>
        <button class="btn btn-ghost btn-sm" :disabled="!!busy" @click="doExport('pdf')"><span v-if="busy === 'pdf'" class="spinner" /><Icon v-else name="download" />PDF</button>
      </div>
    </div>
    <div class="grid-4">
      <div class="kpi"><span>Recaudado</span><b>{{ money(collected, cur) }}</b><small>{{ Math.round(collected / goal * 100) }}% de la meta {{ money(goal, cur) }}</small></div>
      <div class="kpi"><span>Por verificar</span><b>{{ money(pending, cur) }}</b><small>{{ ctx.payments.filter(p => p.status === 'pending').length }} pagos</small></div>
      <div class="kpi"><span>Por cobrar</span><b>{{ money(owed, cur) }}</b><small>ventas sin pagar completas</small></div>
      <div class="kpi"><span>En bolívares</span><b>{{ rate ? money(collected * rate, 'VES') : '—' }}</b><small v-if="rate">a tasa {{ rate.toLocaleString('es-VE') }}</small></div>
    </div>

    <div class="grid-2 collapse">
      <div class="card">
        <div class="card-title"><h3>Números vendidos por día</h3><span class="tiny faint">últimos 14 días</span></div>
        <div class="bars">
          <div v-for="d in days" :key="d.d" class="bar-col" :title="`${d.d.toLocaleDateString('es-VE')}: ${d.n}`">
            <span class="bar-val">{{ d.n || '' }}</span>
            <div class="bar" :style="{ height: (d.n / maxDay * 100) + '%' }" />
            <span class="bar-lbl">{{ d.d.getDate() }}</span>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-title"><h3>Cobrado por método</h3></div>
        <p v-if="!byMethod.length" class="small faint">Aún no hay pagos verificados.</p>
        <div v-for="m in byMethod" :key="m.k" class="hbar">
          <div class="row between small"><b>{{ m.label }}</b><span>{{ money(m.v, cur) }}</span></div>
          <div class="progress" style="height: 8px"><span class="paid" :style="{ width: m.pct + '%' }" /></div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-title"><h3>Ranking de vendedores</h3></div>
      <p v-if="!accounts.length" class="small faint">Sin vendedores asignados.</p>
      <div v-for="(a, i) in accounts" :key="a.mid" class="rank-row">
        <span class="rank-pos" :class="'p' + (i + 1)">{{ i + 1 }}</span>
        <div class="grow">
          <div class="row between small"><b>{{ a.name }}</b><span>{{ a.numbers }} números · {{ money(a.verified, cur) }}</span></div>
          <div class="progress" style="height: 8px"><span class="sold" :style="{ width: (a.numbers / maxSeller * 100) + '%' }" /></div>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
.bars { display: flex; align-items: flex-end; gap: 6px; height: 170px; }
.bar-col { flex: 1; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 4px; }
.bar { width: 100%; min-height: 3px; border-radius: 8px 8px 3px 3px; background: linear-gradient(180deg, var(--brand-400), var(--brand-700)); transition: height .5s; }
.bar-val { font-size: .66rem; font-weight: 800; color: var(--text-2); }
.bar-lbl { font-size: .66rem; color: var(--text-3); }
.hbar { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
.rank-row { display: flex; align-items: center; gap: 12px; padding: 8px 0; }
.rank-pos { width: 30px; height: 30px; border-radius: 10px; display: grid; place-items: center; font-weight: 800; background: var(--surface-2); flex: none; }
.rank-pos.p1 { background: linear-gradient(135deg, var(--gold-400), var(--gold-500)); color: #2A1A00; }
.rank-pos.p2 { background: #E5E7EB; color: #374151; }
.rank-pos.p3 { background: #FED7AA; color: #9A3412; }
</style>
