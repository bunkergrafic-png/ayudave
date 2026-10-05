<script setup>
// Buscador del tablero: por número muestra quién lo tiene; por nombre, teléfono o cédula
// encuentra al comprador y sus números.
import { computed, inject, watch } from 'vue'
import Icon from './Icon.vue'
import { session, isRaffleAdmin } from '../lib/session'
import { effective, orderStatus, ORDER_LABEL, canSellNumber } from '../lib/raffle'
import { pad, digitsFor, money, timeLeft, dateTime } from '../lib/format'
import { whatsappUrl } from '../lib/share'

const props = defineProps({ modelValue: { type: String, default: '' } })
const emit = defineEmits(['update:modelValue', 'only', 'pick'])
const ctx = inject('ctx')

const q = computed({ get: () => props.modelValue, set: v => emit('update:modelValue', v) })
const isAdmin = computed(() => isRaffleAdmin(ctx.raffle))
const mid = computed(() => session.profile?.mid)
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

const ordersById = computed(() => {
  const m = {}
  for (const o of ctx.inbox) m[o.id] = o
  for (const o of ctx.orders) m[o.id] = o
  return m
})

// ¿Es un número de la rifa? (los teléfonos también son dígitos, pero más largos)
const numberQuery = computed(() => {
  const t = q.value.trim()
  if (!/^\d+$/.test(t) || t.length > digitsFor(ctx.raffle.size)) return null
  const n = parseInt(t, 10)
  return n >= 1 && n <= ctx.raffle.size ? n : null
})
const isNumeric = computed(() => /^\d+$/.test(q.value.trim()) && q.value.trim().length <= digitsFor(ctx.raffle.size))

const STATE = {
  free: ['Disponible', 'b-mute'], r: ['Apartado', 'b-info'], v: ['Por pagar', 'b-warn'], vA: ['Abonado', 'b-gold'], p: ['Pagado', 'b-ok']
}

const card = computed(() => {
  const n = numberQuery.value
  if (!n) return null
  const e = effective(ctx.board[String(n)])
  if (!e) {
    return { n, key: 'free', canPick: ['active', 'closed'].includes(ctx.raffle.status) && canSellNumber(ctx.raffle, n, mid.value, isAdmin.value) }
  }
  const order = ordersById.value[e.o] || null
  const canSee = isAdmin.value || e.sl === mid.value || (e.sl === '' && e.s === 'r')
  const sellerName = ctx.raffle.team?.[e.sl]?.name || order?.sellerName || (e.sl ? 'Otro vendedor' : 'Sin vendedor (bandeja)')
  return {
    n, e, order, canSee, sellerName,
    key: e.s === 'v' && e.a ? 'vA' : e.s,
    expires: e.e && e.s !== 'p' && !e.a ? e.e : 0
  }
})

const matches = computed(() => {
  const t = norm(q.value)
  if (t.length < 2 || isNumeric.value) return []
  const digits = t.replace(/\D/g, '')
  return Object.values(ordersById.value).filter(o => {
    const st = orderStatus(o)
    if (['cancelled', 'expired', 'released'].includes(st)) return false
    const b = o.buyer || {}
    return norm(b.name).includes(t)
      || (digits.length >= 4 && String(b.phone || '').replace(/\D/g, '').includes(digits))
      || (b.ci && norm(b.ci).replace(/\D/g, '').includes(digits || '§'))
      || norm(b.email).includes(t)
  }).slice(0, 30)
})

watch(matches, m => emit('only', q.value.trim().length >= 2 && !isNumeric.value ? m.flatMap(o => o.numbers) : null), { immediate: true })

const badgeOf = o => ({ paid: 'b-ok', partial: 'b-gold', pending: 'b-warn', reserved: 'b-info' }[orderStatus(o)] || 'b-mute')
</script>

<template>
  <div class="lookup">
    <div class="input-group">
      <span class="prefix"><Icon name="search" :size="18" /></span>
      <input v-model="q" class="input" placeholder="Busca un número, nombre, teléfono o cédula" aria-label="Buscar" />
      <button v-if="q" class="lookup-clear" aria-label="Limpiar búsqueda" @click="q = ''"><Icon name="x" :size="16" /></button>
    </div>

    <!-- Ficha del número -->
    <Transition name="fade">
      <div v-if="card" class="lk-card" :class="'lk-' + card.key">
        <div class="lk-num">{{ pad(card.n, ctx.raffle.size) }}</div>
        <div class="grow stack" style="--gap: 4px; min-width: 0">
          <span class="badge" :class="STATE[card.key][1]" style="align-self: flex-start">{{ STATE[card.key][0] }}</span>

          <template v-if="card.key === 'free'">
            <p class="small muted">Nadie lo tiene todavía.</p>
            <button v-if="card.canPick" class="btn btn-gold btn-sm" style="align-self: flex-start" @click="emit('pick', card.n)"><Icon name="plus" />Seleccionar para vender</button>
          </template>

          <template v-else-if="card.canSee">
            <b class="lk-buyer">{{ card.order?.buyer?.name || 'Comprador' }}</b>
            <span v-if="card.order" class="small muted">
              {{ card.order.buyer?.phone }}<template v-if="card.order.buyer?.ci"> · CI {{ card.order.buyer.ci }}</template>
            </span>
            <span class="small">Vendedor: <b>{{ card.sellerName }}</b></span>
            <span v-if="card.order" class="small muted">
              Total {{ money(card.order.total, ctx.raffle.currency) }} · pagado {{ money(card.order.paidVerified, ctx.raffle.currency) }}
              <template v-if="card.order.paidPending"> · por verificar {{ money(card.order.paidPending, ctx.raffle.currency) }}</template>
              · {{ dateTime(card.order.createdAt) }}
            </span>
            <span v-if="card.expires" class="small lk-exp"><Icon name="clock" :size="13" /> Se libera en {{ timeLeft(card.expires) }} si no paga</span>
            <div class="row wrap" style="--gap: 6px; margin-top: 4px">
              <button class="btn btn-primary btn-sm" @click="ctx.openOrder(card.e.o)"><Icon name="ticket" />Ver venta</button>
              <template v-if="card.order?.buyer?.phone">
                <a class="btn btn-wa btn-sm" :href="whatsappUrl(card.order.buyer.phone, `Hola ${card.order.buyer.name.split(' ')[0]} 👋`)" target="_blank" rel="noopener"><Icon name="whatsapp" />WhatsApp</a>
                <a class="btn btn-ghost btn-sm" :href="`tel:${card.order.buyer.phone}`"><Icon name="phone" />Llamar</a>
              </template>
            </div>
          </template>

          <template v-else>
            <span class="small">Lo tiene <b>{{ card.sellerName }}</b>.</span>
            <span class="tiny faint">Los datos del comprador solo los ve su vendedor y el administrador.</span>
          </template>
        </div>
      </div>
    </Transition>

    <!-- Compradores encontrados -->
    <div v-if="q.trim().length >= 2 && !isNumeric" class="lk-results">
      <p v-if="!matches.length" class="small faint">No encontré compradores con “{{ q }}”{{ isAdmin ? '' : ' entre tus ventas' }}.</p>
      <button v-for="o in matches" :key="o.id" class="lk-row" @click="ctx.openOrder(o.id)">
        <div class="grow" style="min-width: 0">
          <div class="row between" style="--gap: 8px"><b class="lk-buyer">{{ o.buyer?.name }}</b><span class="badge" :class="badgeOf(o)">{{ ORDER_LABEL[orderStatus(o)] }}</span></div>
          <div class="num-chips" style="margin-top: 4px"><span v-for="n in o.numbers" :key="n" class="num-chip">{{ pad(n, ctx.raffle.size) }}</span></div>
          <div class="tiny faint" style="margin-top: 3px">{{ o.buyer?.phone }} · {{ o.sellerName || 'Sin vendedor' }}</div>
        </div>
        <Icon name="chevronRight" :size="18" class="faint" />
      </button>
    </div>
  </div>
</template>

<style>
.lookup { display: flex; flex-direction: column; gap: 10px; margin-bottom: 14px; }
.lookup .input { padding-right: 44px; }
.lookup-clear { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); border: 0; background: var(--surface-2); width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center; cursor: pointer; color: var(--text-2); }
.lk-card { display: flex; gap: 14px; padding: 14px; border-radius: 16px; border: 1.5px solid var(--line); background: var(--surface-2); }
.lk-num { min-width: 74px; height: 64px; padding: 0 10px; border-radius: 14px; display: grid; place-items: center; font-family: var(--font-display); font-weight: 800; font-size: 1.7rem; background: var(--n-free); border: 1.5px solid var(--n-free-line); }
.lk-r .lk-num { background: var(--n-r); border-color: var(--n-r-line); color: var(--n-r-text); }
.lk-v .lk-num { background: var(--n-v); border-color: var(--n-v-line); color: var(--n-v-text); }
.lk-vA .lk-num { background: linear-gradient(135deg, var(--n-v) 50%, #A7F3D0 50%); border-color: var(--n-v-line); color: var(--n-v-text); }
.lk-p .lk-num { background: var(--n-p); border-color: var(--n-p); color: #fff; }
.lk-buyer { font-size: 1.05rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lk-exp { color: var(--warn); font-weight: 700; display: inline-flex; gap: 4px; align-items: center; }
.lk-results { display: flex; flex-direction: column; gap: 6px; }
.lk-row { display: flex; align-items: center; gap: 10px; padding: 12px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface); text-align: left; cursor: pointer; width: 100%; }
.lk-row:hover { border-color: var(--brand-400); }
</style>
