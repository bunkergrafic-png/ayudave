<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { doc, onSnapshot, getDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import Icon from '../../components/Icon.vue'
import Logo from '../../components/Logo.vue'
import { pad, money, timeLeft } from '../../lib/format'
import { celebrate } from '../../lib/ui'

const route = useRoute()
const t = ref(null)
const raffle = ref(null)
const state = ref('loading')
let stop = null
onMounted(() => {
  stop = onSnapshot(doc(db, 'raffles', route.params.rid, 'tokens', route.params.token), s => {
    if (!s.exists()) { state.value = 'missing'; return }
    t.value = s.data()
    state.value = 'ok'
  }, () => { state.value = 'missing' })
  getDoc(doc(db, 'raffles', route.params.rid)).then(s => {
    if (s.exists()) {
      raffle.value = { id: s.id, ...s.data() }
      if (won.value.length) setTimeout(() => celebrate({ particleCount: 200, spread: 100 }), 400)
    }
  }).catch(() => {})
})
onBeforeUnmount(() => stop?.())
const S = {
  paid: ['Pagado', 'Tu boleto está confirmado. ¡Mucha suerte!', 'ok'],
  partial: ['Abonado', 'Tienes un pago registrado. Completa el total para confirmar tu boleto.', 'gold'],
  pending: ['Pendiente de pago', 'Tu número está reservado. Realiza el pago para confirmarlo.', 'warn'],
  reserved: ['Apartado', 'Tu vendedor te contactará para confirmar el pago.', 'info'],
  cancelled: ['Anulado', 'Este boleto fue anulado.', 'mute'],
  expired: ['Vencido', 'El apartado venció y los números se liberaron.', 'mute']
}
const status = computed(() => {
  if (!t.value) return 'pending'
  if (['pending', 'reserved'].includes(t.value.status) && t.value.expiresAt && t.value.expiresAt < Date.now()) return 'expired'
  return t.value.status
})
const won = computed(() => (raffle.value?.winners || []).filter(w => t.value?.numbers?.includes(w.number)))
</script>

<template>
  <div class="verify">
    <div v-if="state === 'loading'" class="spinner" style="width: 36px; height: 36px; color: #fff" />
    <div v-else-if="state === 'missing'" class="ticket-card center">
      <Icon name="alert" :size="40" /><h2>Boleto no encontrado</h2><p class="muted">Revisa que el enlace esté completo.</p>
    </div>
    <div v-else class="ticket-card" :class="'st-' + S[status][2]">
      <div class="tk-head">
        <Logo :size="28" />
        <span class="badge" :class="'b-' + S[status][2]">{{ S[status][0] }}</span>
      </div>
      <div v-if="won.length" class="won-banner"><Icon name="trophy" :size="28" /><div><b>¡GANASTE!</b><div class="small">{{ won.map(w => `${w.place}° premio: ${w.prize}`).join(' · ') }}</div></div></div>
      <h1 class="tk-title">{{ t.title }}</h1>
      <p class="muted">Boleto de <b>{{ t.buyerFirst }}</b><template v-if="t.sellerName"> · vendido por {{ t.sellerName }}</template></p>
      <div class="tk-cut" />
      <div class="tk-nums">
        <span v-for="n in t.numbers" :key="n" class="tk-num">{{ pad(n, t.size) }}</span>
      </div>
      <div class="tk-cut" />
      <p class="small">{{ S[status][1] }}</p>
      <p v-if="(status === 'pending' || status === 'reserved') && t.expiresAt" class="small" style="color: var(--warn); font-weight: 700"><Icon name="clock" :size="14" /> Vence en {{ timeLeft(t.expiresAt) }}</p>
      <div class="row between small" style="margin-top: 6px">
        <span class="muted">Total</span><b>{{ money(t.total, raffle?.currency || 'USD') }}</b>
      </div>
      <RouterLink v-if="raffle?.slug && raffle?.public?.enabled" :to="`/r/${raffle.slug}`" class="btn btn-ghost btn-block" style="margin-top: 14px">Ver la rifa</RouterLink>
      <p class="tiny faint center" style="margin-top: 10px"><Icon name="shield" :size="12" /> Verificado en tiempo real por Rifalo</p>
    </div>
  </div>
</template>

<style>
.verify { min-height: 100dvh; display: grid; place-items: center; padding: 24px 16px; background: radial-gradient(800px 400px at 50% 0%, #7C3AED, transparent), linear-gradient(160deg, #3B0F8C, #1E0A47); }
.ticket-card { width: 100%; max-width: 420px; background: var(--surface); border-radius: 26px; padding: 22px; box-shadow: var(--shadow-lg); display: flex; flex-direction: column; gap: 10px; position: relative; }
.tk-head { display: flex; align-items: center; justify-content: space-between; }
.tk-title { font-size: 1.5rem; }
.tk-cut { height: 0; border-top: 2px dashed var(--line-strong); margin: 8px -22px; position: relative; }
.tk-cut::before, .tk-cut::after { content: ''; position: absolute; top: -12px; width: 22px; height: 22px; border-radius: 50%; background: #2A0F66; }
.tk-cut::before { left: -11px; } .tk-cut::after { right: -11px; }
.tk-nums { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; padding: 6px 0; }
.tk-num { font-family: var(--font-display); font-weight: 800; font-size: 2.2rem; padding: 6px 18px; border-radius: 16px; background: linear-gradient(135deg, #FBBF24, #F5A50B); color: #2A1A00; }
.st-mute .tk-num { background: var(--surface-2); color: var(--text-3); text-decoration: line-through; }
.won-banner { display: flex; gap: 12px; align-items: center; padding: 14px; border-radius: 16px; background: linear-gradient(135deg, #FBBF24, #F5A50B); color: #2A1A00; animation: pop .5s ease; }
.won-banner b { font-family: var(--font-display); font-size: 1.4rem; }
</style>
