<script setup>
import { computed } from 'vue'
import Icon from './Icon.vue'
import { orderStatus, ORDER_LABEL } from '../lib/raffle'
import { money, pad, initials, ago, timeLeft } from '../lib/format'
const props = defineProps({ order: Object, raffle: Object, showSeller: Boolean })
const st = computed(() => orderStatus(props.order))
const badge = { paid: 'b-ok', partial: 'b-gold', pending: 'b-warn', reserved: 'b-info', cancelled: 'b-mute', expired: 'b-mute', released: 'b-mute' }
</script>
<template>
  <div class="list-item order-item">
    <span class="avatar" :class="'av-' + st">{{ initials(order.buyer?.name) }}</span>
    <div class="grow" style="min-width: 0">
      <div class="row between" style="--gap: 8px">
        <b class="oi-name">{{ order.buyer?.name }}</b>
        <span class="badge" :class="badge[st]">{{ ORDER_LABEL[st] }}</span>
      </div>
      <div class="num-chips" style="margin: 5px 0">
        <span v-for="n in order.numbers.slice(0, 10)" :key="n" class="num-chip">{{ pad(n, raffle.size) }}</span>
        <span v-if="order.numbers.length > 10" class="num-chip">+{{ order.numbers.length - 10 }}</span>
      </div>
      <div class="tiny faint row wrap" style="--gap: 6px">
        <span>{{ money(order.total, raffle.currency) }}</span>
        <span v-if="order.paidVerified && st !== 'paid'">· pagado {{ money(order.paidVerified, raffle.currency) }}</span>
        <span v-if="order.paidPending">· por verificar {{ money(order.paidPending, raffle.currency) }}</span>
        <span v-if="showSeller">· {{ order.sellerName || 'Sin vendedor' }}</span>
        <span>· {{ ago(order.createdAt) }}</span>
        <span v-if="(st === 'pending' || st === 'reserved') && order.expiresAt" class="exp"><Icon name="clock" :size="12" /> {{ timeLeft(order.expiresAt) }}</span>
      </div>
    </div>
    <Icon name="chevronRight" :size="18" class="faint" />
  </div>
</template>
<style>
.oi-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.av-paid { background: var(--ok-bg); color: var(--ok); }
.av-partial { background: var(--gold-100); color: var(--gold-600); }
.av-pending { background: var(--warn-bg); color: var(--warn); }
.av-reserved { background: var(--info-bg); color: var(--info); }
.av-cancelled, .av-expired { background: var(--surface-2); color: var(--text-3); }
.exp { display: inline-flex; align-items: center; gap: 3px; color: var(--warn); font-weight: 700; }
</style>
