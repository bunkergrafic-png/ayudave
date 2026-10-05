<script setup>
import { inject, ref, computed } from 'vue'
import Icon from '../../components/Icon.vue'
import { pad, dateTime, money } from '../../lib/format'
const ctx = inject('ctx')
const q = ref('')
const A = {
  sell: ['ticket', 'vendió', 'b-brand'], public_reserve: ['inbox', 'apartó desde la página', 'b-info'], claim: ['hand', 'tomó el apartado', 'b-info'],
  confirm: ['check', 'confirmó la venta', 'b-info'], pay: ['wallet', 'registró un pago', 'b-gold'], verify: ['checkCircle', 'verificó un pago', 'b-ok'],
  reject: ['x', 'rechazó un pago', 'b-danger'], cancel: ['ban', 'anuló una venta', 'b-danger'], expire: ['clock', 'liberó números vencidos', 'b-mute'],
  transfer: ['swap', 'cambió el vendedor', 'b-brand'], edit: ['edit', 'editó datos del comprador', 'b-mute'], draw: ['trophy', 'sorteó un premio', 'b-gold'],
  undo_draw: ['ban', 'anuló un resultado', 'b-danger'], handover: ['banknote', 'registró una entrega', 'b-ok'], raffle_create: ['sparkles', 'creó la rifa', 'b-brand'],
  raffle_update: ['settings', 'modificó la configuración', 'b-mute'], status: ['settings', 'cambió el estado', 'b-mute']
}
const STATUS = { active: 'En venta', closed: 'Ventas cerradas', draft: 'Borrador', drawn: 'Sorteada' }
function detail(l) {
  const nums = (l.numbers || []).map(n => pad(n, ctx.raffle.size)).join(', ')
  switch (l.action) {
    case 'sell': case 'public_reserve': return `${nums} a ${l.buyer}`
    case 'pay': return `${money(l.amount, ctx.raffle.currency)} · ${nums}${l.duplicate ? ' · ⚠ referencia repetida' : ''}`
    case 'verify': case 'reject': return `${money(l.amount, ctx.raffle.currency)} · ${nums}${l.reason ? ' · ' + l.reason : ''}`
    case 'cancel': return `${nums}${l.reason ? ' · ' + l.reason : ''}`
    case 'claim': case 'confirm': case 'transfer': return `${nums} → ${l.sellerName}`
    case 'expire': return `${l.count} venta(s)`
    case 'draw': return `${l.place}° premio: ${pad(l.number, ctx.raffle.size)} · ${l.buyer || 'no vendido'}`
    case 'handover': return `${l.sellerName} · ${money(l.amount, l.currency)}`
    case 'status': return STATUS[l.status] || l.status
    case 'raffle_update': return (l.fields || []).length + ' campos'
    default: return nums
  }
}
const list = computed(() => {
  const s = q.value.trim().toLowerCase()
  if (!s) return ctx.logs
  return ctx.logs.filter(l => `${l.byName} ${A[l.action]?.[1]} ${detail(l)}`.toLowerCase().includes(s))
})
</script>

<template>
  <div class="stack" style="--gap: 12px">
    <div class="input-group"><span class="prefix"><Icon name="search" :size="18" /></span><input v-model="q" class="input" placeholder="Buscar en el historial" /></div>
    <div class="card pad-0">
      <div v-if="!list.length" class="empty"><p>Sin movimientos.</p></div>
      <div v-for="l in list" :key="l.id" class="log-row">
        <span class="log-ico badge plain" :class="A[l.action]?.[2]"><Icon :name="A[l.action]?.[0] || 'info'" :size="16" /></span>
        <div class="grow" style="min-width: 0">
          <div class="small"><b>{{ l.byName || 'Alguien' }}</b> {{ A[l.action]?.[1] || l.action }}</div>
          <div class="tiny muted log-detail">{{ detail(l) }}</div>
        </div>
        <span class="tiny faint" style="white-space: nowrap">{{ dateTime(l.at) }}</span>
      </div>
    </div>
  </div>
</template>

<style>
.log-row { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--line); }
.log-row:last-child { border-bottom: 0; }
.log-ico { width: 34px; height: 34px; padding: 0; justify-content: center; border-radius: 10px; flex: none; }
.log-detail { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
