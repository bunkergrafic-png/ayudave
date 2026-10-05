<script setup>
import { ref, inject, computed } from 'vue'
import Icon from '../../components/Icon.vue'
import OrderItem from '../../components/OrderItem.vue'
import { isRaffleAdmin } from '../../lib/session'
import { orderStatus } from '../../lib/raffle'
import { pad } from '../../lib/format'

const ctx = inject('ctx')
const q = ref('')
const status = ref('active')
const seller = ref('')
const isAdmin = computed(() => isRaffleAdmin(ctx.raffle))
const sellers = computed(() => Object.entries(ctx.raffle.team || {}).map(([mid, t]) => ({ mid, name: t.name })))

const list = computed(() => {
  const s = q.value.trim().toLowerCase()
  return ctx.orders.filter(o => {
    const st = orderStatus(o)
    if (status.value === 'active' && ['cancelled', 'expired', 'released'].includes(st)) return false
    if (!['active', 'all'].includes(status.value) && st !== status.value) return false
    if (seller.value && o.sellerId !== seller.value) return false
    if (!s) return true
    return (o.buyer?.name || '').toLowerCase().includes(s)
      || (o.buyer?.phone || '').replace(/\D/g, '').includes(s.replace(/\D/g, '') || '§')
      || (o.buyer?.ci || '').toLowerCase().includes(s)
      || o.numbers.some(n => pad(n, ctx.raffle.size) === s.padStart(String(ctx.raffle.size).length, '0') || String(n) === s)
  })
})
const counts = computed(() => {
  const c = { active: 0, pending: 0, partial: 0, paid: 0, reserved: 0, expired: 0, cancelled: 0, all: ctx.orders.length }
  ctx.orders.forEach(o => { const st = orderStatus(o); c[st] = (c[st] || 0) + 1; if (!['cancelled', 'expired', 'released'].includes(st)) c.active++ })
  return c
})
</script>

<template>
  <div class="stack" style="--gap: 12px">
    <div class="row wrap" style="--gap: 8px">
      <div class="input-group grow" style="min-width: 200px">
        <span class="prefix"><Icon name="search" :size="18" /></span>
        <input v-model="q" class="input" placeholder="Buscar por nombre, teléfono, cédula o número" />
      </div>
      <select v-if="isAdmin && sellers.length" v-model="seller" class="select" style="width: auto; min-width: 160px">
        <option value="">Todos los vendedores</option>
        <option v-for="s in sellers" :key="s.mid" :value="s.mid">{{ s.name }}</option>
      </select>
    </div>
    <div class="segmented">
      <button :class="{ on: status === 'active' }" @click="status = 'active'">Activas {{ counts.active }}</button>
      <button :class="{ on: status === 'pending' }" @click="status = 'pending'">Por pagar {{ counts.pending }}</button>
      <button :class="{ on: status === 'partial' }" @click="status = 'partial'">Abonadas {{ counts.partial }}</button>
      <button :class="{ on: status === 'paid' }" @click="status = 'paid'">Pagadas {{ counts.paid }}</button>
      <button :class="{ on: status === 'expired' }" @click="status = 'expired'">Vencidas {{ counts.expired }}</button>
      <button :class="{ on: status === 'cancelled' }" @click="status = 'cancelled'">Anuladas {{ counts.cancelled }}</button>
    </div>
    <div class="card pad-0">
      <div v-if="!list.length" class="empty">
        <div class="ico"><Icon name="ticket" /></div>
        <p>{{ ctx.orders.length ? 'No hay ventas con este filtro' : 'Todavía no hay ventas. ¡Ve al tablero y vende el primer número!' }}</p>
      </div>
      <div v-else class="list">
        <OrderItem v-for="o in list" :key="o.id" :order="o" :raffle="ctx.raffle" :show-seller="isAdmin" @click="ctx.openOrder(o.id)" />
      </div>
    </div>
  </div>
</template>
