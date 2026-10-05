<script setup>
import { inject, computed, ref } from 'vue'
import Icon from '../../components/Icon.vue'
import { session, isRaffleAdmin, actorFor } from '../../lib/session'
import { orderStatus, claimOrder } from '../../lib/raffle'
import { money, pad, ago, timeLeft } from '../../lib/format'
import { whatsappUrl } from '../../lib/share'
import { toast, toastError } from '../../lib/ui'

const ctx = inject('ctx')
const busy = ref('')
const isAdmin = computed(() => isRaffleAdmin(ctx.raffle))
const mid = computed(() => session.profile?.mid)
const mine = computed(() => ctx.orders.filter(o => o.sellerId && orderStatus(o) === 'reserved' && (isAdmin.value || o.sellerId === mid.value)))
const shared = computed(() => ctx.inbox.filter(o => orderStatus(o) === 'reserved'))

async function take(o) {
  busy.value = o.id
  try {
    await claimOrder({ raffle: ctx.raffle, orderId: o.id, seller: { mid: mid.value, name: session.profile.name }, actor: actorFor(ctx.raffle) })
    toast('¡Venta tomada! Ahora contacta al comprador')
  } catch (e) { toastError(e) } finally { busy.value = '' }
}
const waText = o => `Hola ${o.buyer.name.split(' ')[0]} 👋 Te escribo por tu apartado en la rifa "${ctx.raffle.title}": ${o.numbers.map(n => pad(n, ctx.raffle.size)).join(', ')}. Total ${money(o.total, ctx.raffle.currency)}. ¿Cómo deseas pagar?`
</script>

<template>
  <div class="stack" style="--gap: 18px">
    <div class="notice">
      <Icon name="info" />
      <p class="small">Aquí llegan los números que la gente aparta desde la página pública. <b>Contacta al comprador y confírmalo</b> antes de que venza el apartado.</p>
    </div>

    <section class="stack" style="--gap: 10px">
      <h3>{{ isAdmin ? 'Apartados con vendedor' : 'Desde tu enlace' }} <span class="faint">({{ mine.length }})</span></h3>
      <p v-if="!mine.length" class="small faint">No hay apartados pendientes.</p>
      <div v-for="o in mine" :key="o.id" class="card inbox-card">
        <div class="row between">
          <div><b>{{ o.buyer.name }}</b><div class="tiny faint">{{ o.buyer.phone }} · {{ ago(o.createdAt) }}<template v-if="isAdmin"> · {{ o.sellerName }}</template></div></div>
          <span class="badge b-warn"><Icon name="clock" :size="12" />{{ timeLeft(o.expiresAt) }}</span>
        </div>
        <div class="num-chips"><span v-for="n in o.numbers" :key="n" class="num-chip">{{ pad(n, ctx.raffle.size) }}</span></div>
        <div class="row" style="--gap: 8px">
          <a class="btn btn-wa btn-sm grow" :href="whatsappUrl(o.buyer.phone, waText(o))" target="_blank" rel="noopener"><Icon name="whatsapp" />Escribir</a>
          <button class="btn btn-primary btn-sm grow" @click="ctx.openOrder(o.id)"><Icon name="check" />Confirmar</button>
        </div>
      </div>
    </section>

    <section class="stack" style="--gap: 10px">
      <h3>Bandeja compartida <span class="faint">({{ shared.length }})</span></h3>
      <p class="small muted">Personas que no indicaron vendedor. El primero que lo toma, se lo queda.</p>
      <p v-if="!shared.length" class="small faint">La bandeja está vacía.</p>
      <div v-for="o in shared" :key="o.id" class="card inbox-card shared">
        <div class="row between">
          <div><b>{{ o.buyer.name }}</b><div class="tiny faint">{{ o.buyer.city || 'Sin ciudad' }} · {{ ago(o.createdAt) }}</div></div>
          <span class="badge b-warn"><Icon name="clock" :size="12" />{{ timeLeft(o.expiresAt) }}</span>
        </div>
        <div class="num-chips"><span v-for="n in o.numbers" :key="n" class="num-chip">{{ pad(n, ctx.raffle.size) }}</span></div>
        <div class="row" style="--gap: 8px">
          <span class="small bold grow">{{ money(o.total, ctx.raffle.currency) }}</span>
          <button v-if="isAdmin" class="btn btn-ghost btn-sm" @click="ctx.openOrder(o.id)">Ver</button>
          <button v-if="ctx.raffle.sellers?.includes(mid) || isAdmin" class="btn btn-gold btn-sm" :disabled="busy === o.id" @click="take(o)"><span v-if="busy === o.id" class="spinner" /><template v-else><Icon name="hand" />Tomar</template></button>
        </div>
      </div>
    </section>
  </div>
</template>

<style>
.inbox-card { display: flex; flex-direction: column; gap: 10px; padding: 14px; }
.inbox-card.shared { border-style: dashed; }
</style>
