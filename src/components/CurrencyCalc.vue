<script setup>
// Calculadora de Divisas (misma funcionalidad que la de Mano v0.2.67):
// un monto + moneda base (Bs. / USD / EUR) → resultado en las otras dos, tasa vigente del día.
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import Icon from './Icon.vue'
import { rates, loadRates, formatDateTime } from '../lib/rates'

const props = defineProps({ open: Boolean })
const emit = defineEmits(['close'])

const LABELS = { bs: 'Bs.', usd: 'USD', eur: 'EUR' }
const input = ref('1')
const moneda = ref('usd')

const nf = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const amount = computed(() => Math.max(0, parseFloat(String(input.value).replace(',', '.')) || 0))
const ready = computed(() => rates.USD > 0 && rates.EUR > 0)

function toVes(val, from) {
  if (!ready.value) return null
  if (from === 'bs') return val
  return val * (from === 'usd' ? rates.USD : rates.EUR)
}
function fromVes(ves, to) {
  if (!ready.value) return null
  if (to === 'bs') return ves
  return ves / (to === 'usd' ? rates.USD : rates.EUR)
}
function fmt(val, cur) {
  if (val === null) return '—'
  return nf.format(val) + (cur === 'bs' ? ' Bs.' : cur === 'usd' ? ' $' : ' €')
}
const results = computed(() => {
  const ves = toVes(amount.value, moneda.value)
  if (ves === null) return []
  return ['bs', 'usd', 'eur'].filter(m => m !== moneda.value).map(m => ({ key: m, label: LABELS[m], value: fmt(fromVes(ves, m), m), highlight: m !== 'bs' }))
})

// El botón "atrás" del celular cierra la calculadora (como en Mano).
let pushed = false
function onPop() { pushed = false; emit('close') }
watch(() => props.open, v => {
  if (v) {
    loadRates()
    history.pushState({ rifaloCalc: true }, '')
    pushed = true
    window.addEventListener('popstate', onPop)
    document.body.style.overflow = 'hidden'
  } else {
    window.removeEventListener('popstate', onPop)
    if (pushed) { pushed = false; history.back() }
    document.body.style.overflow = ''
  }
})
onBeforeUnmount(() => { window.removeEventListener('popstate', onPop); document.body.style.overflow = '' })
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="open" class="cc-backdrop" @mousedown.self="emit('close')">
        <div class="cc" role="dialog" aria-modal="true" aria-label="Calculadora de Divisas">
          <header class="cc-head">
            <div>
              <h2>Calculadora de Divisas</h2>
              <p>Tasa oficial del Banco Central de Venezuela</p>
            </div>
            <button class="cc-x" aria-label="Cerrar" @click="emit('close')"><Icon name="x" :size="20" /></button>
          </header>

          <div class="cc-body">
            <!-- Monto + moneda base en una misma fila -->
            <div class="cc-row">
              <div class="cc-field">
                <label>Monto</label>
                <input v-model="input" class="cc-input" type="number" min="0" step="any" inputmode="decimal" placeholder="0" aria-label="Monto" />
              </div>
              <div class="cc-cur">
                <label>Moneda base</label>
                <button v-for="m in ['bs', 'usd', 'eur']" :key="m" :class="{ on: moneda === m }" @click="moneda = m">{{ LABELS[m] }}</button>
              </div>
            </div>

            <!-- Resultados -->
            <div v-if="rates.error && !ready" class="cc-error">
              <span>{{ rates.error }}</span>
              <button @click="loadRates({ force: true })">Reintentar</button>
            </div>
            <div v-else-if="!ready" class="cc-loading">Cargando tasas...</div>
            <div v-else class="cc-results">
              <div v-for="r in results" :key="r.key" class="cc-res">
                <span>{{ r.label }}</span>
                <b :class="{ hl: r.highlight }">{{ r.value }}</b>
              </div>
            </div>

            <!-- Tasas de referencia -->
            <div v-if="ready" class="cc-rates">
              <p class="cc-rates-title">Tasa vigente del día</p>
              <div><span>1 USD =</span><b>{{ nf.format(rates.USD) }} Bs.</b></div>
              <div><span>1 EUR =</span><b>{{ nf.format(rates.EUR) }} Bs.</b></div>
              <p v-if="rates.fetchedAt" class="cc-date">Actualizado: {{ formatDateTime(rates.fetchedAt) }}</p>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style>
.cc-backdrop { position: fixed; inset: 0; z-index: 70; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(10, 4, 24, .8); backdrop-filter: blur(4px); }
.cc { width: 100%; max-width: 384px; border-radius: 22px; overflow: hidden; background: #1A1330; border: 1px solid #2E2550; box-shadow: var(--shadow-lg); color: #fff; }
.cc-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 16px 20px; border-bottom: 1px solid #2E2550; }
.cc-head h2 { font-size: 1.05rem; color: #fff; }
.cc-head p { font-size: .74rem; color: #8A81AB; margin-top: 2px; }
.cc-x { background: none; border: 0; color: #8A81AB; cursor: pointer; padding: 2px; }
.cc-x:hover { color: #fff; }
.cc-body { padding: 20px; display: flex; flex-direction: column; gap: 16px; }
.cc-row { display: flex; gap: 12px; }
.cc-field { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.cc-field label, .cc-cur label { font-size: .7rem; text-transform: uppercase; letter-spacing: .08em; color: #8A81AB; }
.cc-cur label { text-align: center; }
.cc-input { flex: 1; width: 100%; min-height: 120px; border-radius: 14px; border: 1px solid #3D3266; background: #211839; color: #fff; font: inherit; font-size: 1.6rem; font-weight: 700; padding: 0 16px; outline: none; appearance: textfield; -moz-appearance: textfield; }
.cc-input::-webkit-outer-spin-button, .cc-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.cc-input:focus { border-color: var(--gold-500); box-shadow: 0 0 0 3px rgba(245, 165, 11, .2); }
.cc-cur { width: 112px; display: flex; flex-direction: column; gap: 6px; }
.cc-cur button { flex: 1; min-height: 36px; border: 0; border-radius: 12px; font-weight: 700; font-size: .9rem; cursor: pointer; background: #211839; color: #BDB5DA; transition: background .15s; }
.cc-cur button:hover { background: #2E2550; }
.cc-cur button.on { background: linear-gradient(135deg, var(--gold-400), var(--gold-500)); color: #1C1530; }
.cc-results { display: flex; flex-direction: column; gap: 8px; }
.cc-res { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-radius: 14px; background: rgba(33, 24, 57, .7); }
.cc-res span { color: #8A81AB; font-size: .9rem; }
.cc-res b { font-size: 1.15rem; color: #fff; font-variant-numeric: tabular-nums; }
.cc-res b.hl { color: var(--gold-400); }
.cc-loading { padding: 12px 16px; border-radius: 14px; background: rgba(33, 24, 57, .7); color: #8A81AB; font-size: .9rem; text-align: center; }
.cc-error { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px; border-radius: 14px; background: rgba(127, 29, 29, .35); border: 1px solid rgba(220, 38, 38, .35); color: #FCA5A5; font-size: .88rem; }
.cc-error button { background: none; border: 0; color: var(--gold-400); font-weight: 700; font-size: .8rem; cursor: pointer; flex: none; }
.cc-rates { border-top: 1px solid #2E2550; padding-top: 12px; display: flex; flex-direction: column; gap: 6px; }
.cc-rates-title { text-align: center; font-size: .7rem; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; margin-bottom: 4px; color: #fff; }
.cc-rates div { display: flex; justify-content: space-between; font-size: .9rem; }
.cc-rates div span { color: var(--gold-600); }
.cc-rates div b { color: var(--gold-400); font-weight: 600; font-variant-numeric: tabular-nums; }
.cc-date { text-align: center; font-size: .75rem; color: #fff; padding-top: 4px; }
@media (max-width: 720px) { .cc-backdrop { align-items: flex-end; } }
</style>
