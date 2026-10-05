<script setup>
import { ref, reactive, computed, watch, provide, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { doc, onSnapshot, collection, query, where, orderBy, limit } from 'firebase/firestore'
import { db } from '../firebase'
import Icon from '../components/Icon.vue'
import OrderSheet from '../components/OrderSheet.vue'
import BoardTab from './raffle/BoardTab.vue'
import OrdersTab from './raffle/OrdersTab.vue'
import PaymentsTab from './raffle/PaymentsTab.vue'
import InboxTab from './raffle/InboxTab.vue'
import TeamTab from './raffle/TeamTab.vue'
import DrawTab from './raffle/DrawTab.vue'
import ReportsTab from './raffle/ReportsTab.vue'
import LogTab from './raffle/LogTab.vue'
import ShareTab from './raffle/ShareTab.vue'
import { session, isRaffleAdmin, isRaffleSeller, actorFor } from '../lib/session'
import { watchBoard, boardStats, sweepExpired, isExpired, orderStatus } from '../lib/raffle'
import { setRaffleStatus } from '../lib/raffles'
import { money } from '../lib/format'
import { raffleRate } from '../lib/rates'
import { toast, toastError, confirmDialog } from '../lib/ui'

const route = useRoute()
const router = useRouter()

const ctx = reactive({
  raffle: null, board: {}, orders: [], inbox: [], payments: [], handovers: [], logs: [],
  loaded: false, error: '',
  openOrder: id => { orderId.value = id }
})
provide('ctx', ctx)
const orderId = ref('')
let unsubs = []
let boardStop = null

const isAdmin = computed(() => isRaffleAdmin(ctx.raffle))
const isSeller = computed(() => isRaffleSeller(ctx.raffle))
const mid = computed(() => session.profile?.mid)
const stats = computed(() => ctx.raffle ? boardStats(ctx.raffle, ctx.board) : null)
const pendingPayments = computed(() => ctx.payments.filter(p => p.status === 'pending').length)
const inboxCount = computed(() => ctx.inbox.filter(o => orderStatus(o) === 'reserved').length)
const collected = computed(() => ctx.payments.filter(p => p.status === 'verified').reduce((s, p) => s + p.amountBase, 0))
const pendingAmount = computed(() => ctx.payments.filter(p => p.status === 'pending').reduce((s, p) => s + p.amountBase, 0))
ctx.stats = stats

function stopAll() { unsubs.forEach(u => u()); unsubs = []; boardStop?.(); boardStop = null }
onBeforeUnmount(stopAll)

const snapList = (q, key, sortKey = 'createdAt') => onSnapshot(q, s => {
  ctx[key] = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b[sortKey]?.seconds || 0) - (a[sortKey]?.seconds || 0))
}, e => console.warn(key, e.code))

watch(() => route.params.id, id => {
  stopAll()
  Object.assign(ctx, { raffle: null, board: {}, orders: [], inbox: [], payments: [], handovers: [], logs: [], loaded: false, error: '' })
  if (!id) return
  let wired = false
  unsubs.push(onSnapshot(doc(db, 'raffles', id), snap => {
    if (!snap.exists()) { ctx.error = 'Esta rifa no existe o fue eliminada'; ctx.loaded = true; return }
    const prevSize = ctx.raffle?.size
    ctx.raffle = { id: snap.id, ...snap.data() }
    ctx.loaded = true
    if (!isRaffleAdmin(ctx.raffle) && !isRaffleSeller(ctx.raffle)) { ctx.error = 'No tienes acceso a esta rifa'; return }
    if (!boardStop || prevSize !== ctx.raffle.size) {
      boardStop?.()
      boardStop = watchBoard(ctx.raffle, b => { ctx.board = b }, e => toastError(e))
    }
    if (!wired) { wired = true; wire(id) }
  }, e => { ctx.error = e.code === 'permission-denied' ? 'No tienes acceso a esta rifa' : e.message; ctx.loaded = true }))
}, { immediate: true })

function wire(id) {
  const col = n => collection(db, 'raffles', id, n)
  if (isRaffleAdmin(ctx.raffle)) {
    unsubs.push(snapList(col('orders'), 'orders'))
    unsubs.push(snapList(col('payments'), 'payments'))
    unsubs.push(snapList(col('handovers'), 'handovers'))
    unsubs.push(snapList(query(col('logs'), orderBy('at', 'desc'), limit(300)), 'logs', 'at'))
    unsubs.push(onSnapshot(query(col('orders'), where('sellerId', '==', '')), s => { ctx.inbox = s.docs.map(d => ({ id: d.id, ...d.data() })) }, () => {}))
  } else {
    const m = mid.value
    unsubs.push(snapList(query(col('orders'), where('sellerId', '==', m)), 'orders'))
    unsubs.push(onSnapshot(query(col('orders'), where('sellerId', '==', '')), s => { ctx.inbox = s.docs.map(d => ({ id: d.id, ...d.data() })) }, () => {}))
    unsubs.push(snapList(query(col('payments'), where('sellerId', '==', m)), 'payments'))
    unsubs.push(snapList(query(col('handovers'), where('sellerId', '==', m)), 'handovers'))
  }
}

// Limpieza automática de vencidos (solo la hace la app de un admin)
let lastSweep = 0
watch(() => ctx.board, b => {
  if (!isAdmin.value || !ctx.raffle || Date.now() - lastSweep < 60000) return
  if (!Object.values(b).some(e => isExpired(e))) return
  lastSweep = Date.now()
  sweepExpired({ raffle: ctx.raffle, board: b, actor: actorFor(ctx.raffle) }).catch(() => {})
})

const tabs = computed(() => {
  if (!ctx.raffle) return []
  const t = [{ k: 'board', icon: 'grid', label: 'Tablero' }]
  if (isAdmin.value) {
    t.push({ k: 'orders', icon: 'ticket', label: 'Ventas' })
    t.push({ k: 'payments', icon: 'wallet', label: 'Pagos', count: pendingPayments.value })
  } else {
    t.push({ k: 'orders', icon: 'ticket', label: 'Mis ventas' })
  }
  if (ctx.raffle.public?.allowReserve) t.push({ k: 'inbox', icon: 'inbox', label: 'Apartados', count: inboxCount.value + ctx.orders.filter(o => orderStatus(o) === 'reserved' && o.sellerId).length })
  t.push({ k: 'team', icon: 'users', label: isAdmin.value ? 'Vendedores' : 'Mi cuenta' })
  if (!isAdmin.value) t.push({ k: 'payments', icon: 'wallet', label: 'Mis pagos' })
  t.push({ k: 'draw', icon: 'trophy', label: 'Sorteo' })
  if (isAdmin.value) {
    t.push({ k: 'reports', icon: 'chart', label: 'Reportes' })
    t.push({ k: 'log', icon: 'history', label: 'Historial' })
  }
  t.push({ k: 'share', icon: 'share', label: 'Compartir' })
  return t
})
const tab = computed({
  get: () => tabs.value.some(t => t.k === route.query.tab) ? route.query.tab : 'board',
  set: v => router.replace({ query: { ...route.query, tab: v } })
})

const STATUS = { draft: ['Borrador', 'b-mute'], active: ['En venta', 'b-ok'], closed: ['Ventas cerradas', 'b-warn'], drawn: ['Sorteada', 'b-brand'] }
const statusMenu = ref(false)
async function changeStatus(s) {
  statusMenu.value = false
  const msgs = {
    active: ['¿Abrir las ventas?', 'Los vendedores podrán vender y la página pública aceptará apartados.'],
    closed: ['¿Cerrar las ventas?', 'Nadie podrá vender más números (el admin sí puede registrar pagos).'],
    draft: ['¿Pasar a borrador?', 'La rifa dejará de verse en la página pública.']
  }
  if (!(await confirmDialog({ title: msgs[s][0], message: msgs[s][1] }))) return
  try { await setRaffleStatus(ctx.raffle, s, actorFor(ctx.raffle)); toast('Estado actualizado') } catch (e) { toastError(e) }
}
const rate = computed(() => ctx.raffle ? raffleRate(ctx.raffle) : 0)
</script>

<template>
  <div class="container rview">
    <div v-if="!ctx.loaded" class="stack"><div class="skeleton" style="height: 140px" /><div class="skeleton" style="height: 360px" /></div>
    <div v-else-if="ctx.error" class="card empty">
      <div class="ico"><Icon name="alert" /></div>
      <h3>{{ ctx.error }}</h3>
      <button class="btn btn-primary" style="margin-top: 14px" @click="router.push('/')">Volver al inicio</button>
    </div>
    <template v-else-if="ctx.raffle && stats">
      <!-- Encabezado -->
      <section class="rv-hero" :style="ctx.raffle.cover ? { '--cover': `url(${ctx.raffle.cover})` } : {}">
        <div class="rv-hero-top">
          <button class="btn btn-icon btn-sm rv-back" aria-label="Volver" @click="router.push('/')"><Icon name="arrowLeft" /></button>
          <span class="badge" :class="STATUS[ctx.raffle.status][1]">{{ STATUS[ctx.raffle.status][0] }}</span>
          <div class="grow" />
          <template v-if="isAdmin">
            <button class="btn btn-sm rv-glass" @click="statusMenu = !statusMenu"><Icon name="settings" /><span class="hide-mobile">Estado</span></button>
            <button class="btn btn-sm rv-glass" @click="router.push(`/rifa/${ctx.raffle.id}/editar`)"><Icon name="edit" /><span class="hide-mobile">Editar</span></button>
          </template>
          <Transition name="fade">
            <div v-if="statusMenu" class="status-menu" @mouseleave="statusMenu = false">
              <button v-if="ctx.raffle.status !== 'active' && ctx.raffle.status !== 'drawn'" @click="changeStatus('active')"><Icon name="play" />Abrir ventas</button>
              <button v-if="ctx.raffle.status === 'active'" @click="changeStatus('closed')"><Icon name="lock" />Cerrar ventas</button>
              <button v-if="ctx.raffle.status !== 'draft' && ctx.raffle.status !== 'drawn'" @click="changeStatus('draft')"><Icon name="eyeOff" />Pasar a borrador</button>
            </div>
          </Transition>
        </div>
        <h1>{{ ctx.raffle.title }}</h1>
        <p class="rv-sub">
          <Icon name="gift" :size="16" /> {{ (ctx.raffle.prizes || []).map(p => p.title).join(' · ') }}
          <span class="dot">•</span> {{ money(ctx.raffle.price, ctx.raffle.currency) }} por número
          <template v-if="rate"><span class="dot">•</span> Bs {{ (ctx.raffle.price * rate).toLocaleString('es-VE', { maximumFractionDigits: 2 }) }}</template>
        </p>
        <div class="rv-progress">
          <div class="progress big">
            <span class="paid" :style="{ width: stats.pctPaid + '%' }" />
            <span class="sold" :style="{ width: (stats.v / stats.size * 100) + '%' }" />
            <span class="res" :style="{ width: (stats.r / stats.size * 100) + '%' }" />
          </div>
          <div class="rv-kpis">
            <div><b>{{ stats.sold }}<small>/{{ stats.size }}</small></b><span>Vendidos</span></div>
            <div><b>{{ stats.p }}</b><span>Pagados</span></div>
            <div><b>{{ stats.free }}</b><span>Libres</span></div>
            <div v-if="isAdmin"><b>{{ money(collected, ctx.raffle.currency) }}</b><span>Recaudado</span></div>
            <div v-if="isAdmin && pendingAmount"><b class="gold">{{ money(pendingAmount, ctx.raffle.currency) }}</b><span>Por verificar</span></div>
          </div>
        </div>
      </section>

      <div v-if="ctx.raffle.status === 'draft'" class="notice warn" style="margin-top: 14px">
        <Icon name="eyeOff" />
        <div class="grow"><b>Esta rifa está en borrador.</b><p class="small">Los vendedores no pueden vender hasta que abras las ventas.</p></div>
        <button v-if="isAdmin" class="btn btn-ok btn-sm" @click="changeStatus('active')">Abrir ventas</button>
      </div>

      <!-- Pestañas -->
      <nav class="rv-tabs">
        <button v-for="t in tabs" :key="t.k" class="rv-tab" :class="{ on: tab === t.k }" @click="tab = t.k">
          <Icon :name="t.icon" :size="18" /><span>{{ t.label }}</span><i v-if="t.count" class="count">{{ t.count }}</i>
        </button>
      </nav>

      <div class="rv-body">
        <BoardTab v-if="tab === 'board'" />
        <OrdersTab v-else-if="tab === 'orders'" />
        <PaymentsTab v-else-if="tab === 'payments'" />
        <InboxTab v-else-if="tab === 'inbox'" />
        <TeamTab v-else-if="tab === 'team'" />
        <DrawTab v-else-if="tab === 'draw'" />
        <ReportsTab v-else-if="tab === 'reports'" />
        <LogTab v-else-if="tab === 'log'" />
        <ShareTab v-else-if="tab === 'share'" />
      </div>

      <OrderSheet :raffle="ctx.raffle" :order-id="orderId" @close="orderId = ''" />
    </template>
  </div>
</template>

<style>
.rview { display: flex; flex-direction: column; }
.rv-hero { position: relative; overflow: hidden; border-radius: 24px; padding: 18px 20px 20px; color: #fff; display: flex; flex-direction: column; gap: 10px;
  background: linear-gradient(160deg, rgba(46, 16, 101, .82), rgba(30, 10, 71, .95)), var(--cover, radial-gradient(600px 300px at 0% 0%, #7C3AED, transparent)), linear-gradient(135deg, #4C1D95, #1E0A47);
  background-size: cover; background-position: center; box-shadow: var(--shadow); }
.rv-hero h1 { font-size: 1.7rem; }
.rv-hero-top { position: relative; display: flex; align-items: center; gap: 8px; }
.rv-hero-top .badge { background: rgba(255, 255, 255, .92); }
.rv-back, .rv-glass { background: rgba(255, 255, 255, .14); color: #fff; border: 1px solid rgba(255, 255, 255, .18); }
.rv-back:hover, .rv-glass:hover { background: rgba(255, 255, 255, .24); }
.status-menu { position: absolute; right: 0; top: 42px; z-index: 5; background: var(--surface); color: var(--text); border-radius: 14px; box-shadow: var(--shadow-lg); padding: 6px; display: flex; flex-direction: column; min-width: 200px; }
.status-menu button { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 0; background: none; border-radius: 10px; font-weight: 600; cursor: pointer; text-align: left; }
.status-menu button:hover { background: var(--surface-2); }
.rv-sub { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; opacity: .88; font-size: .9rem; }
.rv-sub .dot { opacity: .5; }
.rv-progress { display: flex; flex-direction: column; gap: 12px; margin-top: 6px; }
.progress.big { height: 12px; background: rgba(255, 255, 255, .16); }
.rv-kpis { display: flex; flex-wrap: wrap; gap: 8px 22px; }
.rv-kpis > div { display: flex; flex-direction: column; }
.rv-kpis b { font-family: var(--font-display); font-size: 1.35rem; line-height: 1.1; }
.rv-kpis b small { font-size: .8rem; opacity: .6; }
.rv-kpis b.gold { color: var(--gold-400); }
.rv-kpis span { font-size: .72rem; opacity: .7; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; }
.rv-tabs { position: sticky; top: 62px; z-index: 20; display: flex; gap: 4px; overflow-x: auto; scrollbar-width: none; margin: 16px -16px 0; padding: 8px 16px; background: color-mix(in srgb, var(--bg) 88%, transparent); backdrop-filter: blur(12px); }
.rv-tabs::-webkit-scrollbar { display: none; }
.rv-tab { position: relative; display: flex; align-items: center; gap: 7px; padding: 9px 14px; border-radius: 12px; border: 1px solid transparent; background: transparent; font-weight: 700; font-size: .86rem; color: var(--text-2); cursor: pointer; white-space: nowrap; }
.rv-tab:hover { background: var(--surface); }
.rv-tab.on { background: var(--surface); color: var(--brand-700); border-color: var(--line); box-shadow: var(--shadow-sm); }
:root[data-theme="dark"] .rv-tab.on { color: var(--brand-400); }
.rv-tab .count { font-style: normal; min-width: 20px; height: 20px; padding: 0 6px; border-radius: 99px; background: var(--danger); color: #fff; font-size: .7rem; display: grid; place-items: center; }
.rv-body { margin-top: 12px; }
</style>
