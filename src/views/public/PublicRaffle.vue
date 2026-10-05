<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute } from 'vue-router'
import { doc, getDoc, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase'
import Icon from '../../components/Icon.vue'
import Logo from '../../components/Logo.vue'
import Sheet from '../../components/Sheet.vue'
import NumberGrid from '../../components/NumberGrid.vue'
import Legend from '../../components/Legend.vue'
import { watchBoard, boardStats, publicReserve, effective, secureRandomInt, DRAW_RULES } from '../../lib/raffle'
import { ensureAnonymous } from '../../lib/session'
import { loadRates, raffleRate } from '../../lib/rates'
import { money, pad, timeLeft, dateTime, firstName } from '../../lib/format'
import { whatsappUrl, ticketLink, copy } from '../../lib/share'
import { toast, toastError, celebrate } from '../../lib/ui'

const route = useRoute()
const raffle = ref(null)
const board = ref({})
const state = ref('loading') // loading | ok | missing
const selected = ref([])
const sheet = ref(false)
const busy = ref(false)
const done = ref(null)
const buyer = reactive({ name: '', phone: '', ci: '', city: '', email: '' })
const referrer = ref('')
const now = ref(Date.now())
let stopRaffle = null, stopBoard = null
const clock = setInterval(() => { now.value = Date.now() }, 1000)

const code = computed(() => String(route.query.v || '').toLowerCase())
const sellers = computed(() => Object.entries(raffle.value?.team || {}).filter(([m]) => (raffle.value.sellers || []).includes(m)).map(([mid, t]) => ({ mid, ...t })))
const viaSeller = computed(() => sellers.value.find(s => s.code === code.value) || null)
const stats = computed(() => raffle.value ? boardStats(raffle.value, board.value) : null)
const rate = computed(() => raffle.value ? raffleRate(raffle.value) : 0)
const canReserve = computed(() => raffle.value?.status === 'active' && raffle.value?.public?.allowReserve)
const max = computed(() => raffle.value?.public?.maxPerOrder || 5)
const total = computed(() => selected.value.length * (raffle.value?.price || 0))

onMounted(async () => {
  loadRates()
  try {
    const s = await getDoc(doc(db, 'slugs', route.params.slug))
    if (!s.exists()) { state.value = 'missing'; return }
    const rid = s.data().rid
    stopRaffle = onSnapshot(doc(db, 'raffles', rid), snap => {
      if (!snap.exists()) { state.value = 'missing'; return }
      const first = !raffle.value
      raffle.value = { id: snap.id, ...snap.data() }
      document.title = `${raffle.value.title} · Rifalo`
      if (first) stopBoard = watchBoard(raffle.value, b => { board.value = b }, () => {})
      state.value = 'ok'
    }, () => { state.value = 'missing' })
  } catch { state.value = 'missing' }
})
onBeforeUnmount(() => { stopRaffle?.(); stopBoard?.(); clearInterval(clock) })

watch(board, b => {
  const before = selected.value.length
  selected.value = selected.value.filter(n => !effective(b[String(n)]))
  if (before > selected.value.length && !done.value) toast('Alguien acaba de tomar un número que habías escogido', 'info')
})

function toggle(n) {
  if (!canReserve.value) return toast('Por ahora no se pueden apartar números desde aquí', 'info')
  const i = selected.value.indexOf(n)
  if (i >= 0) selected.value.splice(i, 1)
  else if (selected.value.length >= max.value) toast(`Puedes apartar hasta ${max.value} números a la vez`, 'info')
  else selected.value.push(n)
}
function lucky() {
  const free = []
  for (let n = 1; n <= raffle.value.size; n++) if (!effective(board.value[String(n)]) && !selected.value.includes(n)) free.push(n)
  if (!free.length) return
  toggle(free[secureRandomInt(free.length)])
}

function openSheet() {
  referrer.value = viaSeller.value ? viaSeller.value.mid : ''
  sheet.value = true
}
async function reserve() {
  if (buyer.name.trim().length < 3) return toastError(new Error('Escribe tu nombre y apellido'))
  if (String(buyer.phone).replace(/\D/g, '').length < 10) return toastError(new Error('Escribe tu número de WhatsApp completo'))
  if (buyer.email && !/^\S+@\S+\.\S+$/.test(buyer.email)) return toastError(new Error('El correo no parece válido'))
  busy.value = true
  try {
    const user = await ensureAnonymous()
    const sel = sellers.value.find(s => s.mid === referrer.value)
    const order = await publicReserve({
      raffle: raffle.value, numbers: [...selected.value].sort((a, b) => a - b), uid: user.uid,
      sellerMid: referrer.value === '_none' ? '' : referrer.value, sellerName: sel?.name || '',
      buyer: { name: buyer.name.trim(), phone: buyer.phone.replace(/[^\d+]/g, ''), ci: buyer.ci.trim(), city: buyer.city.trim(), email: buyer.email.trim() }
    })
    done.value = order
    selected.value = []
    celebrate()
    try { localStorage.setItem(`rifalo.mine.${raffle.value.id}`, JSON.stringify([...(JSON.parse(localStorage.getItem(`rifalo.mine.${raffle.value.id}`) || '[]')), order.token])) } catch { /* noop */ }
  } catch (e) {
    toastError(e.code === 'permission-denied' ? new Error('No se pudo apartar. Puede que el número ya no esté libre o que tu teléfono esté bloqueado.') : e)
  } finally { busy.value = false }
}

const contactPhone = computed(() => {
  const sl = done.value?.sellerId
  return (sl && raffle.value.team?.[sl]?.phone) || raffle.value?.contactPhone || ''
})
const contactName = computed(() => done.value?.sellerId ? raffle.value.team?.[done.value.sellerId]?.name : 'el organizador')
const waMsg = computed(() => done.value
  ? `Hola 👋 Soy ${done.value.buyer.name}. Aparté ${done.value.numbers.length > 1 ? 'los números' : 'el número'} ${done.value.numbers.map(n => pad(n, raffle.value.size)).join(', ')} en la rifa "${raffle.value.title}" (total ${money(done.value.total, raffle.value.currency)}). ¿Cómo hago el pago?\n${ticketLink(raffle.value, done.value.token)}`
  : '')
const doneLeft = computed(() => (now.value, done.value ? timeLeft(done.value.expiresAt) : ''))
const methods = computed(() => raffle.value?.methods || {})
const winners = computed(() => raffle.value?.winners || [])
watch(() => raffle.value?.status, (s, old) => { if (s === 'drawn' && old) celebrate({ particleCount: 250, spread: 120 }) })
async function cp(t) { await copy(t); toast('Copiado') }
</script>

<template>
  <div class="pub">
    <div v-if="state === 'loading'" class="pub-loading"><div class="spinner" style="width: 36px; height: 36px; color: var(--brand-600)" /></div>
    <div v-else-if="state === 'missing'" class="pub-missing container">
      <Logo :size="48" />
      <h1>Esta rifa no está disponible</h1>
      <p class="muted">Puede que el enlace esté mal escrito o que la rifa ya no sea pública.</p>
    </div>
    <template v-else-if="raffle">
      <!-- Hero -->
      <header class="pub-hero" :style="raffle.cover ? { '--cover': `url(${raffle.cover})` } : {}">
        <div class="container pub-hero-inner">
          <div class="pub-top"><Logo light :size="30" /><span v-if="raffle.status === 'active'" class="live"><i />En venta</span></div>
          <h1>{{ raffle.title }}</h1>
          <p v-if="raffle.description" class="pub-desc">{{ raffle.description }}</p>
          <div class="price-tag">
            <div><span>Cada número</span><b>{{ money(raffle.price, raffle.currency) }}</b></div>
            <div v-if="rate"><span>En bolívares</span><b>Bs {{ (raffle.price * rate).toLocaleString('es-VE', { maximumFractionDigits: 2 }) }}</b></div>
          </div>
          <div v-if="viaSeller" class="via"><Icon name="user" :size="16" />Te invitó <b>{{ viaSeller.name }}</b></div>
        </div>
      </header>

      <main class="container pub-main">
        <!-- Ganadores -->
        <section v-if="winners.length" class="card winners-card">
          <div class="row" style="--gap: 10px"><Icon name="trophy" :size="26" /><h2>{{ raffle.status === 'drawn' ? '¡Tenemos ganador!' : 'Ganadores' }}</h2></div>
          <div v-for="w in winners" :key="w.place" class="w-row">
            <span class="win-num">{{ pad(w.number, raffle.size) }}</span>
            <div><b>{{ w.place }}° premio · {{ w.prize }}</b><div class="small muted">{{ w.unsold ? 'Número no vendido' : `Ganó ${w.buyerFirst}` }}{{ w.sellerName ? ` · vendedor ${w.sellerName}` : '' }}</div><div v-if="w.evidence" class="tiny faint">{{ w.evidence }}</div></div>
          </div>
        </section>

        <!-- Premios -->
        <section class="prizes">
          <div v-for="p in raffle.prizes" :key="p.place" class="pz">
            <div class="pz-img" :style="p.image ? { backgroundImage: `url(${p.image})` } : {}"><Icon v-if="!p.image" name="gift" :size="40" /></div>
            <div>
              <span class="pz-place">{{ p.place }}° premio</span>
              <h3>{{ p.title }}</h3>
              <span v-if="p.value" class="small muted">Valorado en {{ money(p.value, 'USD') }}</span>
            </div>
          </div>
        </section>

        <!-- Avance -->
        <section v-if="stats" class="card">
          <div class="row between" style="margin-bottom: 10px">
            <b>{{ Math.round(stats.pctSold) }}% vendido</b>
            <span class="small muted">Quedan <b>{{ stats.free }}</b> de {{ raffle.size }}</span>
          </div>
          <div class="progress" style="height: 14px"><span class="sold" :style="{ width: ((stats.size - stats.free) / stats.size * 100) + '%' }" /></div>
          <p class="tiny faint" style="margin-top: 10px"><Icon name="info" :size="12" /> Sorteo: {{ DRAW_RULES[raffle.drawRule]?.toLowerCase() }}<template v-if="raffle.drawDate"> ({{ dateTime(new Date(raffle.drawDate)) }})</template><template v-if="raffle.drawMethod === 'lottery' && raffle.lotteryName"> · con {{ raffle.lotteryName }}</template>.</p>
        </section>

        <!-- Tablero -->
        <section v-if="raffle.status !== 'drawn'" class="card">
          <div class="row wrap between" style="margin-bottom: 12px">
            <div><h2>Escoge tu número</h2><p class="small muted">{{ canReserve ? `Toca los números que quieras (hasta ${max})` : 'Las ventas están cerradas por ahora' }}</p></div>
            <button v-if="canReserve" class="btn btn-soft btn-sm" @click="lucky"><Icon name="dice" />Número de la suerte</button>
          </div>
          <Legend public :stats="stats" style="margin-bottom: 12px" />
          <NumberGrid :raffle="raffle" :board="board" :selected="selected" mode="public" @toggle="toggle" />
        </section>

        <!-- Cómo pagar -->
        <section class="card">
          <h2 style="margin-bottom: 12px">¿Cómo pagar?</h2>
          <div class="how">
            <div v-if="methods.pm?.enabled" class="how-item"><Icon name="smartphone" /><div><b>Pago móvil</b><div class="small muted">{{ methods.pm.bank }} · {{ methods.pm.phone }} · CI {{ methods.pm.ci }}</div></div></div>
            <div v-if="methods.transfer?.enabled" class="how-item"><Icon name="bank" /><div><b>Transferencia</b><div class="small muted">{{ methods.transfer.bank }} · {{ methods.transfer.account }}</div></div></div>
            <div v-if="methods.binance?.enabled" class="how-item"><Icon name="bitcoin" /><div><b>Binance</b><div class="small muted">Pay ID {{ methods.binance.payId }} {{ methods.binance.email }}</div></div></div>
            <div v-if="methods.cash?.enabled" class="how-item"><Icon name="banknote" /><div><b>Efectivo</b><div class="small muted">Con tu vendedor</div></div></div>
          </div>
          <p class="small muted" style="margin-top: 12px">Después de apartar, tu vendedor te confirma el pago y te envía tu boleto digital.</p>
          <a v-if="raffle.contactPhone" class="btn btn-ghost btn-sm" style="margin-top: 12px" :href="whatsappUrl(raffle.contactPhone, `Hola, tengo una pregunta sobre la rifa ${raffle.title}`)" target="_blank" rel="noopener"><Icon name="whatsapp" />¿Dudas? Escríbenos</a>
        </section>

        <footer class="pub-foot"><Logo :size="22" /><span class="tiny faint">Rifa gestionada con Rifalo · números verificados en tiempo real</span></footer>
      </main>

      <Transition name="slide-up">
        <div v-if="selected.length" class="pub-bar">
          <div class="grow">
            <div class="num-chips"><span v-for="n in selected" :key="n" class="num-chip gold">{{ pad(n, raffle.size) }}</span></div>
            <div class="small" style="margin-top: 4px"><b>{{ money(total, raffle.currency) }}</b><span v-if="rate" class="faint"> · Bs {{ (total * rate).toLocaleString('es-VE', { maximumFractionDigits: 2 }) }}</span></div>
          </div>
          <button class="btn btn-gold btn-lg" @click="openSheet">Apartar <Icon name="arrowRight" /></button>
        </div>
      </Transition>

      <Sheet :open="sheet" :title="done ? '¡Números apartados! 🎉' : 'Apartar números'" @close="sheet = false; done = null">
        <template v-if="!done">
          <div class="sell-summary">
            <div class="num-chips"><span v-for="n in selected" :key="n" class="num-chip gold">{{ pad(n, raffle.size) }}</span></div>
            <div class="sell-total"><span class="faint small">Total</span><b>{{ money(total, raffle.currency) }}</b></div>
          </div>
          <div class="stack" style="--gap: 14px">
            <div class="field"><label>Nombre y apellido *</label><input v-model="buyer.name" class="input" autocomplete="name" /></div>
            <div class="grid-2">
              <div class="field"><label>WhatsApp *</label><input v-model="buyer.phone" class="input" inputmode="tel" autocomplete="tel" placeholder="0414-1234567" /></div>
              <div class="field"><label>Cédula</label><input v-model="buyer.ci" class="input" placeholder="V-12345678" /></div>
            </div>
            <div class="grid-2">
              <div class="field"><label>Ciudad</label><input v-model="buyer.city" class="input" /></div>
              <div class="field"><label>Correo</label><input v-model="buyer.email" class="input" type="email" inputmode="email" /></div>
            </div>
            <div v-if="!viaSeller && sellers.length" class="field">
              <label>¿Quién te refirió?</label>
              <select v-model="referrer" class="select">
                <option value="">Escoge una opción</option>
                <option v-for="s in sellers" :key="s.mid" :value="s.mid">{{ s.name }}</option>
                <option value="_none">No tengo vendedor</option>
              </select>
            </div>
            <p class="tiny faint">Tus números quedan apartados por {{ raffle.public.holdMinutes >= 60 ? (raffle.public.holdMinutes / 60) + ' hora(s)' : raffle.public.holdMinutes + ' minutos' }}. Si no se confirma el pago, se liberan.</p>
          </div>
        </template>
        <div v-else class="stack center" style="--gap: 14px">
          <div class="done-badge"><Icon name="check" :size="40" :stroke="3" /></div>
          <p>¡Listo, {{ firstName(done.buyer.name) }}! Apartaste:</p>
          <div class="num-chips" style="justify-content: center"><span v-for="n in done.numbers" :key="n" class="num-chip gold" style="font-size: 1.1rem; height: 36px; min-width: 56px">{{ pad(n, raffle.size) }}</span></div>
          <div class="notice warn" style="text-align: left"><Icon name="clock" /><div><b>Vence en {{ doneLeft }}</b><p class="small">Escríbele a {{ contactName }} para pagar y confirmar.</p></div></div>
          <a v-if="contactPhone" class="btn btn-wa btn-lg btn-block" :href="whatsappUrl(contactPhone, waMsg)" target="_blank" rel="noopener"><Icon name="whatsapp" />Escribir a {{ contactName }}</a>
          <p v-else class="small muted">Un vendedor te contactará pronto por WhatsApp.</p>
          <button class="btn btn-ghost btn-block" @click="cp(ticketLink(raffle, done.token))"><Icon name="link" />Copiar enlace de mi boleto</button>
        </div>
        <template v-if="!done" #footer>
          <button class="btn btn-ghost" @click="sheet = false">Volver</button>
          <button class="btn btn-gold" :disabled="busy" @click="reserve"><span v-if="busy" class="spinner" /><template v-else><Icon name="check" />Apartar</template></button>
        </template>
      </Sheet>
    </template>
  </div>
</template>

<style>
.pub { min-height: 100dvh; background: var(--bg); padding-bottom: 120px; }
.pub-loading { min-height: 100dvh; display: grid; place-items: center; }
.pub-missing { min-height: 80dvh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; text-align: center; }
.pub-hero { color: #fff; padding: 18px 0 64px; background: linear-gradient(165deg, rgba(46, 16, 101, .78), rgba(30, 10, 71, .96)), var(--cover, radial-gradient(800px 400px at 0% 0%, #7C3AED, transparent)), linear-gradient(135deg, #4C1D95, #1E0A47); background-size: cover; background-position: center; }
.pub-hero-inner { display: flex; flex-direction: column; gap: 14px; max-width: 860px; }
.pub-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
.live { display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 99px; background: rgba(16, 185, 129, .2); border: 1px solid rgba(16, 185, 129, .5); font-size: .78rem; font-weight: 800; }
.live i { width: 8px; height: 8px; border-radius: 50%; background: #34D399; animation: pulse 1.4s infinite; }
.pub-hero h1 { font-size: clamp(2rem, 6vw, 3.2rem); letter-spacing: -.03em; }
.pub-desc { opacity: .85; font-size: 1.02rem; max-width: 640px; white-space: pre-line; }
.price-tag { display: flex; gap: 10px; flex-wrap: wrap; }
.price-tag > div { display: flex; flex-direction: column; padding: 12px 18px; border-radius: 16px; background: rgba(255, 255, 255, .1); border: 1px solid rgba(255, 255, 255, .18); }
.price-tag > div:first-child { background: linear-gradient(135deg, #FBBF24, #F5A50B); color: #2A1A00; border: 0; }
.price-tag span { font-size: .7rem; text-transform: uppercase; letter-spacing: .06em; font-weight: 700; opacity: .8; }
.price-tag b { font-family: var(--font-display); font-size: 1.6rem; line-height: 1.1; }
.via { display: inline-flex; align-items: center; gap: 8px; align-self: flex-start; padding: 8px 14px; border-radius: 99px; background: rgba(255, 255, 255, .14); font-size: .88rem; }
.pub-main { max-width: 860px; margin-top: -40px; display: flex; flex-direction: column; gap: 14px; }
.prizes { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
.pz { display: flex; gap: 14px; align-items: center; padding: 14px; border-radius: 20px; background: var(--surface); border: 1px solid var(--line); box-shadow: var(--shadow); }
.pz-img { width: 84px; height: 84px; border-radius: 16px; background: linear-gradient(135deg, var(--gold-100), var(--brand-100)) center / cover; display: grid; place-items: center; color: var(--gold-600); flex: none; }
.pz-place { font-size: .7rem; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; color: var(--gold-600); }
.winners-card { border-color: var(--gold-400); background: linear-gradient(135deg, var(--surface), var(--gold-100)); display: flex; flex-direction: column; gap: 12px; }
.winners-card svg { color: var(--gold-500); }
.w-row { display: flex; gap: 14px; align-items: center; }
.how { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
.how-item { display: flex; gap: 12px; align-items: flex-start; padding: 12px; border-radius: 14px; background: var(--surface-2); }
.how-item svg { color: var(--brand-600); flex: none; margin-top: 2px; }
.pub-foot { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 24px 0; }
.pub-bar { position: fixed; z-index: 45; left: 12px; right: 12px; margin: 0 auto; max-width: 680px; bottom: calc(14px + env(safe-area-inset-bottom)); display: flex; align-items: center; gap: 10px; padding: 12px 12px 12px 16px; border-radius: 20px; background: var(--surface); border: 1px solid var(--line); box-shadow: var(--shadow-lg); }
</style>
