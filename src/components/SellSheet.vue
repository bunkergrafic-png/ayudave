<script setup>
// Vender números: datos del comprador → pago (ahora o después) → comprobante por WhatsApp.
import { ref, reactive, computed, watch } from 'vue'
import Sheet from './Sheet.vue'
import Icon from './Icon.vue'
import PaymentForm from './PaymentForm.vue'
import { money, pad, round2 } from '../lib/format'
import { sellNumbers } from '../lib/raffle'
import { newPayment, validatePayment } from '../lib/payments'
import { session, actorFor } from '../lib/session'
import { whatsappUrl, ticketMessage, emailTicket } from '../lib/share'
import { toast, toastError, celebrate } from '../lib/ui'

const props = defineProps({ open: Boolean, raffle: Object, numbers: Array })
const emit = defineEmits(['close', 'done'])

const step = ref(1)
const busy = ref(false)
const buyer = reactive({ name: '', phone: '', ci: '', city: '', email: '' })
const payNow = ref(true)
const pay = reactive({})
const sellerMid = ref('')
const result = ref(null)
const emailed = ref(false)

const total = computed(() => round2((props.numbers?.length || 0) * (props.raffle?.price || 0)))
const actor = computed(() => actorFor(props.raffle))
const team = computed(() => Object.entries(props.raffle?.team || {}).filter(([mid]) => (props.raffle.sellers || []).includes(mid)).map(([mid, t]) => ({ mid, name: t.name })))

watch(() => props.open, v => {
  if (!v) return
  step.value = 1
  result.value = null
  emailed.value = false
  Object.assign(buyer, { name: '', phone: '', ci: '', city: '', email: '' })
  Object.assign(pay, newPayment(props.raffle, total.value))
  payNow.value = true
  const me = session.profile?.mid
  sellerMid.value = (props.raffle.sellers || []).includes(me) ? me : (actor.value.isAdmin ? '' : me)
})

function next() {
  if (buyer.name.trim().length < 2) return toastError(new Error('Escribe el nombre del comprador'))
  if (String(buyer.phone).replace(/\D/g, '').length < 7) return toastError(new Error('Escribe un teléfono válido'))
  if (buyer.email && !/^\S+@\S+\.\S+$/.test(buyer.email)) return toastError(new Error('El correo no parece válido'))
  step.value = 2
}

async function submit() {
  let payment = null
  if (payNow.value) {
    const err = validatePayment(pay, props.raffle, total.value)
    if (err) return toastError(new Error(err))
    payment = { ...pay }
  }
  const seller = sellerMid.value
    ? { mid: sellerMid.value, name: props.raffle.team?.[sellerMid.value]?.name || session.profile.name }
    : { mid: session.profile.mid, name: session.profile.name }
  busy.value = true
  try {
    const order = await sellNumbers({
      raffle: props.raffle, numbers: props.numbers, actor: actor.value, seller, payment,
      buyer: { name: buyer.name.trim(), phone: buyer.phone.trim(), ci: buyer.ci.trim(), city: buyer.city.trim(), email: buyer.email.trim() }
    })
    result.value = order
    step.value = 3
    celebrate()
    emit('done', order)
    if (order.buyer.email) {
      emailTicket(session.org, props.raffle, order, order.status).then(ok => { emailed.value = ok }).catch(() => {})
    }
  } catch (e) { toastError(e) } finally { busy.value = false }
}

const waLink = computed(() => result.value ? whatsappUrl(result.value.buyer.phone, ticketMessage(props.raffle, result.value, result.value.status)) : '')
const holdText = computed(() => {
  const h = Number(props.raffle?.holdHours || 0)
  if (!h) return 'Los números quedan apartados hasta que se registre el pago.'
  return `Si no se registra un pago en ${h >= 24 && h % 24 === 0 ? `${h / 24} día(s)` : `${h} horas`}, los números se liberan solos.`
})
</script>

<template>
  <Sheet :open="open" :title="step === 3 ? '¡Venta registrada!' : 'Vender números'" :subtitle="step < 3 ? `Paso ${step} de 2` : ''" @close="emit('close')">
    <div v-if="numbers?.length" class="sell-summary">
      <div class="num-chips"><span v-for="n in numbers" :key="n" class="num-chip gold">{{ pad(n, raffle.size) }}</span></div>
      <div class="sell-total">
        <span class="faint small">{{ numbers.length }} × {{ money(raffle.price, raffle.currency) }}</span>
        <b>{{ money(total, raffle.currency) }}</b>
      </div>
    </div>

    <!-- Paso 1: comprador -->
    <div v-if="step === 1" class="stack" style="--gap: 14px">
      <div class="field">
        <label>Nombre y apellido *</label>
        <input v-model="buyer.name" class="input" autocomplete="off" placeholder="Ej. María Pérez" />
      </div>
      <div class="grid-2">
        <div class="field">
          <label>Teléfono / WhatsApp *</label>
          <input v-model="buyer.phone" class="input" inputmode="tel" placeholder="0414-1234567" />
        </div>
        <div class="field">
          <label>Cédula</label>
          <input v-model="buyer.ci" class="input" placeholder="V-12345678" />
        </div>
      </div>
      <div class="grid-2">
        <div class="field">
          <label>Ciudad / zona</label>
          <input v-model="buyer.city" class="input" placeholder="Ej. Barquisimeto" />
        </div>
        <div class="field">
          <label>Correo</label>
          <input v-model="buyer.email" class="input" type="email" inputmode="email" placeholder="opcional" />
        </div>
      </div>
      <div v-if="actor.isAdmin && team.length" class="field">
        <label>Vendedor</label>
        <select v-model="sellerMid" class="select">
          <option value="">Yo ({{ session.profile?.name }})</option>
          <option v-for="t in team" :key="t.mid" :value="t.mid">{{ t.name }}</option>
        </select>
      </div>
    </div>

    <!-- Paso 2: pago -->
    <div v-else-if="step === 2" class="stack" style="--gap: 14px">
      <div class="segmented" style="width: 100%">
        <button style="flex: 1" :class="{ on: payNow }" @click="payNow = true">Paga ahora</button>
        <button style="flex: 1" :class="{ on: !payNow }" @click="payNow = false">Paga después</button>
      </div>
      <PaymentForm v-if="payNow" :raffle="raffle" :due="total" :p="pay" />
      <div v-else class="notice">
        <Icon name="clock" />
        <div>
          <b>Se registra como “Por pagar”.</b>
          <p class="small muted">{{ holdText }}</p>
        </div>
      </div>
      <p v-if="payNow && !actor.isAdmin && !(raffle.cashSelfConfirm && pay.method === 'cash')" class="small muted">
        <Icon name="shield" :size="14" /> El administrador verificará este pago antes de marcarlo como pagado.
      </p>
    </div>

    <!-- Paso 3: listo -->
    <div v-else-if="result" class="stack center" style="--gap: 16px">
      <div class="done-badge"><Icon name="check" :size="40" :stroke="3" /></div>
      <div>
        <h3>{{ result.buyer.name }}</h3>
        <p class="muted small">
          {{ result.status === 'paid' ? 'Pago confirmado' : result.status === 'partial' ? 'Pago registrado (por verificar o abono)' : 'Pendiente de pago' }}
        </p>
      </div>
      <a class="btn btn-wa btn-lg btn-block" :href="waLink" target="_blank" rel="noopener"><Icon name="whatsapp" />Enviar comprobante por WhatsApp</a>
      <p v-if="emailed" class="small muted"><Icon name="mail" :size="14" /> También se envió al correo {{ result.buyer.email }}</p>
    </div>

    <template #footer>
      <template v-if="step === 1">
        <button class="btn btn-ghost" @click="emit('close')">Cancelar</button>
        <button class="btn btn-primary" @click="next">Continuar <Icon name="arrowRight" /></button>
      </template>
      <template v-else-if="step === 2">
        <button class="btn btn-ghost" :disabled="busy" @click="step = 1"><Icon name="arrowLeft" />Atrás</button>
        <button class="btn btn-primary" :disabled="busy" @click="submit">
          <span v-if="busy" class="spinner" /><template v-else><Icon name="check" />Registrar venta</template>
        </button>
      </template>
      <template v-else>
        <button class="btn btn-primary" @click="emit('close')">Listo</button>
      </template>
    </template>
  </Sheet>
</template>
