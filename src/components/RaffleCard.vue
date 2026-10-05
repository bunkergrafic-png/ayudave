<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import Icon from './Icon.vue'
import { watchBoard, boardStats } from '../lib/raffle'
import { money } from '../lib/format'
import { isRaffleAdmin, session } from '../lib/session'

const props = defineProps({ raffle: Object })
const board = ref({})
let stop = null
onMounted(() => { stop = watchBoard(props.raffle, b => { board.value = b }, () => {}) })
onBeforeUnmount(() => stop?.())
const stats = computed(() => boardStats(props.raffle, board.value))
const STATUS = { draft: ['Borrador', 'b-mute'], active: ['En venta', 'b-ok'], closed: ['Ventas cerradas', 'b-warn'], drawn: ['Sorteada', 'b-brand'] }
const roleChip = computed(() => {
  if (isRaffleAdmin(props.raffle)) return (props.raffle.coadmins || []).includes(session.profile?.mid) ? 'Co-admin' : 'Admin'
  return 'Vendedor'
})
const prize = computed(() => (props.raffle.prizes || [])[0]?.title || '')
</script>

<template>
  <RouterLink :to="`/rifa/${raffle.id}`" class="rcard">
    <div class="rcard-cover" :style="raffle.cover ? { backgroundImage: `url(${raffle.cover})` } : {}">
      <div class="rcard-top">
        <span class="badge" :class="STATUS[raffle.status]?.[1]">{{ STATUS[raffle.status]?.[0] }}</span>
        <span class="badge plain b-mute rc-role">{{ roleChip }}</span>
      </div>
      <div v-if="!raffle.cover" class="rcard-deco"><Icon name="ticket" :size="64" :stroke="1.4" /></div>
    </div>
    <div class="rcard-body">
      <h3>{{ raffle.title || 'Rifa sin nombre' }}</h3>
      <p v-if="prize" class="small muted rc-prize"><Icon name="gift" :size="15" /> {{ prize }}</p>
      <div class="progress" style="margin-top: 4px">
        <span class="paid" :style="{ width: stats.pctPaid + '%' }" />
        <span class="sold" :style="{ width: (stats.v / stats.size * 100) + '%' }" />
        <span class="res" :style="{ width: (stats.r / stats.size * 100) + '%' }" />
      </div>
      <div class="row between small">
        <span><b>{{ stats.sold }}</b><span class="faint"> / {{ raffle.size }} vendidos</span></span>
        <span class="faint">{{ money(raffle.price, raffle.currency) }} c/u</span>
      </div>
    </div>
  </RouterLink>
</template>

<style>
.rcard { display: flex; flex-direction: column; background: var(--surface); border: 1px solid var(--line); border-radius: 20px; overflow: hidden; color: var(--text); box-shadow: var(--shadow-sm); transition: transform .2s ease, box-shadow .2s ease; }
.rcard:hover { transform: translateY(-3px); box-shadow: var(--shadow); }
.rcard-cover { position: relative; height: 130px; background: radial-gradient(400px 200px at 0% 0%, #7C3AED, transparent), linear-gradient(135deg, #4C1D95, #2E1065); background-size: cover; background-position: center; }
.rcard-top { position: absolute; top: 12px; left: 12px; right: 12px; display: flex; justify-content: space-between; }
.rcard-top .badge { background: rgba(255, 255, 255, .92); }
.rcard-top .rc-role { color: var(--brand-700); }
.rcard-deco { position: absolute; right: 16px; bottom: -8px; color: rgba(251, 191, 36, .55); transform: rotate(-14deg); }
.rcard-body { padding: 16px; display: flex; flex-direction: column; gap: 8px; }
.rc-prize { display: flex; gap: 6px; align-items: center; }
</style>
