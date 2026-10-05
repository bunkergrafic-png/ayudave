<script setup>
// Formulario de pago: efectivo, pago móvil / transferencia o Binance.
import { computed, watch, onMounted } from 'vue'
import { money, round2 } from '../lib/format'
import { raffleRate, loadRates } from '../lib/rates'
import { compressImage } from '../lib/image'
import { toastError } from '../lib/ui'
import { BANKS, METHODS, enabledMethods, defaultCurrency, toBase, fromBase } from '../lib/payments'
import Icon from './Icon.vue'

const props = defineProps({
  raffle: { type: Object, required: true },
  due: { type: Number, required: true },  // lo que falta, en la moneda de la rifa
  p: { type: Object, required: true }     // objeto reactivo del pago
})

const methods = computed(() => enabledMethods(props.raffle))
const rate = computed(() => raffleRate(props.raffle))
const currencies = computed(() => {
  const r = props.raffle
  if (props.p.method === 'cash') {
    const list = [r.currency]
    if (r.rate?.enabled && r.currency !== 'VES') list.push('VES')
    return list
  }
  return [defaultCurrency(r, props.p.method)]
})

function sync() {
  props.p.rate = props.p.currency === 'VES' ? rate.value : 0
  props.p.amountBase = toBase(props.raffle, props.p.currency, props.p.amount, rate.value)
}
watch(() => [props.p.amount, props.p.currency, rate.value], sync, { immediate: true })

function setAmount(base) {
  props.p.amount = fromBase(props.raffle, props.p.currency, base, rate.value)
}
function pickMethod(m) {
  props.p.method = m
  props.p.currency = defaultCurrency(props.raffle, m)
}
watch(() => props.p.currency, () => setAmount(Math.min(props.due, props.p.amountBase || props.due)))
watch(rate, r => { if (r && !props.p.amount) setAmount(props.due) })
onMounted(() => setAmount(props.due))

async function onFile(e) {
  const f = e.target.files?.[0]
  if (!f) return
  try { props.p.receipt = await compressImage(f) } catch (err) { toastError(err) }
  e.target.value = ''
}

const info = computed(() => props.raffle.methods?.[props.p.method] || {})
const equivalence = computed(() => {
  if (props.p.currency === 'VES' && props.raffle.currency !== 'VES') {
    return rate.value ? `≈ ${money(props.p.amountBase, props.raffle.currency)} · tasa BCV ${rate.value.toLocaleString('es-VE')}` : ''
  }
  if (props.raffle.rate?.enabled && rate.value) return `≈ ${money(round2(props.p.amountBase * rate.value), 'VES')}`
  return ''
})
</script>

<template>
  <div class="stack" style="--gap: 14px">
    <div class="pm-methods">
      <button v-for="m in methods" :key="m" type="button" class="choice" :class="{ on: p.method === m }" @click="pickMethod(m)">
        <Icon :name="METHODS[m].icon" :size="22" />
        <span class="t">{{ METHODS[m].label }}</span>
      </button>
    </div>

    <div v-if="p.method !== 'cash'" class="pay-to">
      <div class="section-label">Datos para pagar</div>
      <template v-if="p.method === 'pm'">
        <div>{{ info.bank }} · {{ info.phone }} · CI {{ info.ci }}</div>
        <div v-if="info.holder" class="small muted">{{ info.holder }}</div>
      </template>
      <template v-else-if="p.method === 'transfer'">
        <div>{{ info.bank }} · {{ info.account }}</div>
        <div class="small muted">{{ info.holder }} · CI {{ info.ci }}</div>
      </template>
      <template v-else-if="p.method === 'binance'">
        <div>Pay ID: {{ info.payId }} <span v-if="info.email">· {{ info.email }}</span></div>
        <div v-if="info.holder" class="small muted">{{ info.holder }}</div>
      </template>
    </div>

    <div class="field">
      <label>Monto</label>
      <div class="row" style="--gap: 8px">
        <select v-if="currencies.length > 1" v-model="p.currency" class="select" style="width: 100px">
          <option v-for="c in currencies" :key="c" :value="c">{{ c === 'VES' ? 'Bs' : c }}</option>
        </select>
        <div class="input-group grow">
          <span class="prefix">{{ p.currency === 'VES' ? 'Bs' : p.currency === 'USDT' ? '₮' : '$' }}</span>
          <input v-model.number="p.amount" class="input mono" type="number" inputmode="decimal" step="0.01" min="0" :readonly="!raffle.allowPartial" />
        </div>
      </div>
      <div class="row wrap between">
        <span class="hint">{{ equivalence }}</span>
        <div v-if="raffle.allowPartial" class="row" style="--gap: 6px">
          <button type="button" class="btn btn-soft btn-sm" @click="setAmount(due)">Total</button>
          <button type="button" class="btn btn-soft btn-sm" @click="setAmount(round2(due / 2))">Mitad</button>
        </div>
      </div>
      <div v-if="p.currency === 'VES' && !rate" class="hint" style="color: var(--danger)">
        Sin tasa BCV. <button class="link-btn" type="button" @click="loadRates({ force: true })">Actualizar</button>
      </div>
    </div>

    <template v-if="p.method === 'pm' || p.method === 'transfer'">
      <div class="field">
        <label>Banco desde donde pagó *</label>
        <select v-model="p.bank" class="select">
          <option value="" disabled>Selecciona el banco</option>
          <option v-for="b in BANKS" :key="b">{{ b }}</option>
        </select>
      </div>
      <div class="grid-2">
        <div class="field">
          <label>Teléfono que pagó *</label>
          <input v-model="p.phone" class="input" inputmode="tel" placeholder="0414-1234567" />
        </div>
        <div class="field">
          <label>Cédula del titular *</label>
          <input v-model="p.ci" class="input" placeholder="V-12345678" />
        </div>
      </div>
      <div class="field">
        <label>Número de referencia *</label>
        <input v-model="p.ref" class="input mono" inputmode="numeric" placeholder="Ej. 004512" />
      </div>
    </template>

    <template v-if="p.method === 'binance'">
      <div class="grid-2 collapse">
        <div class="field">
          <label>ID de la orden / transacción *</label>
          <input v-model="p.ref" class="input mono" />
        </div>
        <div class="field">
          <label>Pay ID o correo de quien pagó *</label>
          <input v-model="p.payId" class="input" />
        </div>
      </div>
    </template>

    <div v-if="p.method !== 'cash'" class="field">
      <label>Captura del comprobante <span class="faint">(opcional)</span></label>
      <div v-if="p.receipt" class="receipt-prev">
        <img :src="p.receipt" alt="Comprobante" />
        <button type="button" class="btn btn-ghost btn-sm" @click="p.receipt = ''"><Icon name="trash" />Quitar</button>
      </div>
      <label v-else class="upload">
        <Icon name="camera" :size="22" />
        <span>Tomar foto o subir imagen</span>
        <input type="file" accept="image/*" hidden @change="onFile" />
      </label>
    </div>

    <div class="field">
      <label>Nota <span class="faint">(opcional)</span></label>
      <input v-model="p.note" class="input" placeholder="Ej. pagó la hermana" />
    </div>
  </div>
</template>

<style>
.pm-methods { display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 8px; }
.pm-methods .choice { align-items: center; text-align: center; padding: 12px 8px; }
.pm-methods .choice .t { font-size: .8rem; }
.pay-to { background: var(--gold-100); border-radius: 12px; padding: 12px 14px; font-weight: 600; font-size: .9rem; }
.receipt-prev { display: flex; align-items: center; gap: 12px; }
.receipt-prev img { width: 84px; height: 84px; object-fit: cover; border-radius: 12px; border: 1px solid var(--line); }
</style>
