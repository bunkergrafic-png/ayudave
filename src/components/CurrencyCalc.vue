<script setup>
// Calculadora de divisas con la tasa oficial BCV.
import { ref, computed, watch } from 'vue'
import Sheet from './Sheet.vue'
import Icon from './Icon.vue'
import { rates, loadRates } from '../lib/rates'
import { copy } from '../lib/share'
import { toast } from '../lib/ui'

const props = defineProps({ open: Boolean })
const emit = defineEmits(['close'])
const usd = ref(1)
const eur = ref(0)
const ves = ref(0)
const last = ref('usd')

const fmt = (n, d = 2) => Number(n || 0).toLocaleString('es-VE', { minimumFractionDigits: d, maximumFractionDigits: d })
function fromUsd() { last.value = 'usd'; ves.value = +(usd.value * rates.USD).toFixed(2); eur.value = rates.EUR ? +(ves.value / rates.EUR).toFixed(2) : 0 }
function fromEur() { last.value = 'eur'; ves.value = +(eur.value * rates.EUR).toFixed(2); usd.value = rates.USD ? +(ves.value / rates.USD).toFixed(2) : 0 }
function fromVes() { last.value = 'ves'; usd.value = rates.USD ? +(ves.value / rates.USD).toFixed(2) : 0; eur.value = rates.EUR ? +(ves.value / rates.EUR).toFixed(2) : 0 }
watch(() => [rates.USD, rates.EUR], () => ({ usd: fromUsd, eur: fromEur, ves: fromVes })[last.value]())
watch(() => props.open, v => { if (v) { loadRates(); fromUsd() } })
const date = computed(() => rates.date ? new Date(rates.date).toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' }) : '')
async function copyAll() {
  await copy(`💱 Tasa BCV ${date.value}\n$1 = Bs ${fmt(rates.USD)}\n€1 = Bs ${fmt(rates.EUR)}\n\n$${fmt(usd.value)} = Bs ${fmt(ves.value)}`)
  toast('Copiado')
}
</script>

<template>
  <Sheet :open="open" title="Calculadora de divisas" :subtitle="date ? `Tasa oficial BCV · ${date}` : 'Tasa oficial BCV'" @close="emit('close')">
    <div class="stack" style="--gap: 14px">
      <div class="rate-cards">
        <div><span class="faint tiny">Dólar BCV</span><b>Bs {{ fmt(rates.USD) }}</b></div>
        <div><span class="faint tiny">Euro BCV</span><b>Bs {{ fmt(rates.EUR) }}</b></div>
      </div>
      <div class="calc-row"><span class="cur">🇺🇸 USD</span><input v-model.number="usd" class="input mono" type="number" inputmode="decimal" @input="fromUsd" /></div>
      <div class="calc-row"><span class="cur">🇪🇺 EUR</span><input v-model.number="eur" class="input mono" type="number" inputmode="decimal" @input="fromEur" /></div>
      <div class="calc-row"><span class="cur">🇻🇪 Bs</span><input v-model.number="ves" class="input mono" type="number" inputmode="decimal" @input="fromVes" /></div>
      <p v-if="rates.error" class="small" style="color: var(--danger)">{{ rates.error }}</p>
    </div>
    <template #footer>
      <button class="btn btn-ghost" :disabled="rates.loading" @click="loadRates({ force: true })"><span v-if="rates.loading" class="spinner" /><Icon v-else name="refresh" />Actualizar</button>
      <button class="btn btn-primary" @click="copyAll"><Icon name="copy" />Copiar</button>
    </template>
  </Sheet>
</template>

<style>
.rate-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.rate-cards > div { display: flex; flex-direction: column; padding: 14px; border-radius: 14px; background: linear-gradient(135deg, var(--brand-700), var(--brand-900)); color: #fff; }
.rate-cards > div:last-child { background: linear-gradient(135deg, var(--gold-500), var(--gold-600)); color: #2A1A00; }
.rate-cards .faint { color: inherit; opacity: .75; }
.rate-cards b { font-family: var(--font-display); font-size: 1.3rem; }
.calc-row { display: flex; align-items: center; gap: 10px; }
.calc-row .cur { width: 84px; font-weight: 800; flex: none; }
.calc-row .input { font-size: 1.2rem; font-weight: 700; }
</style>
