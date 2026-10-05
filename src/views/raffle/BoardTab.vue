<script setup>
import { ref, inject, computed, watch } from 'vue'
import Icon from '../../components/Icon.vue'
import NumberGrid from '../../components/NumberGrid.vue'
import Legend from '../../components/Legend.vue'
import NumberLookup from '../../components/NumberLookup.vue'
import SellSheet from '../../components/SellSheet.vue'
import { session, isRaffleAdmin } from '../../lib/session'
import { effective, canSellNumber, secureRandomInt } from '../../lib/raffle'
import { money, pad } from '../../lib/format'
import { raffleRate } from '../../lib/rates'
import { toast } from '../../lib/ui'

const ctx = inject('ctx')
const selected = ref([])
const filter = ref('all')
const sell = ref(false)
const q = ref('')
const only = ref(null)
function pick(n) { if (!selected.value.includes(n)) toggle(n); q.value = '' }
const isAdmin = computed(() => isRaffleAdmin(ctx.raffle))
const mid = computed(() => session.profile?.mid)
const canSellNow = computed(() => isAdmin.value ? ['active', 'closed'].includes(ctx.raffle.status) : ctx.raffle.status === 'active')
const total = computed(() => selected.value.length * ctx.raffle.price)
const rate = computed(() => raffleRate(ctx.raffle))

// Si alguien más vende un número que tengo seleccionado, quitarlo de mi selección.
watch(() => ctx.board, b => {
  const before = selected.value.length
  selected.value = selected.value.filter(n => !effective(b[String(n)]))
  if (selected.value.length < before) toast('Un número que tenías seleccionado acaba de venderse', 'info')
})

function toggle(n) {
  if (!canSellNow.value) return toast(ctx.raffle.status === 'draft' ? 'La rifa está en borrador' : 'Las ventas están cerradas', 'info')
  const i = selected.value.indexOf(n)
  if (i >= 0) selected.value.splice(i, 1)
  else selected.value.push(n)
}
function open(n) {
  const e = effective(ctx.board[String(n)])
  if (!e) return
  const visible = isAdmin.value || e.sl === mid.value || (e.sl === '' && e.s === 'r')
  if (visible) ctx.openOrder(e.o)
  else toast(`El ${pad(n, ctx.raffle.size)} lo vendió ${ctx.raffle.team?.[e.sl]?.name || 'otro vendedor'}`, 'info')
}
function lucky() {
  const free = []
  for (let n = 1; n <= ctx.raffle.size; n++) {
    if (!effective(ctx.board[String(n)]) && !selected.value.includes(n) && canSellNumber(ctx.raffle, n, mid.value, isAdmin.value)) free.push(n)
  }
  if (!free.length) return toast('No quedan números libres', 'info')
  const n = free[secureRandomInt(free.length)]
  toggle(n)
  toast(`🍀 Número de la suerte: ${pad(n, ctx.raffle.size)}`, 'info')
}
function done() { selected.value = [] }
const myCount = computed(() => Object.values(ctx.board).filter(e => effective(e) && e.sl === mid.value).length)
</script>

<template>
  <div class="stack" style="--gap: 14px">
    <div class="card">
      <div class="row wrap between" style="margin-bottom: 14px">
        <div class="segmented">
          <button :class="{ on: filter === 'all' }" @click="filter = 'all'">Todos</button>
          <button :class="{ on: filter === 'free' }" @click="filter = 'free'">Libres</button>
          <button v-if="!isAdmin || ctx.raffle.sellers?.includes(mid)" :class="{ on: filter === 'mine' }" @click="filter = 'mine'">Míos ({{ myCount }})</button>
          <button v-if="ctx.raffle.public?.allowReserve" :class="{ on: filter === 'r' }" @click="filter = 'r'">Apartados</button>
          <button :class="{ on: filter === 'v' }" @click="filter = 'v'">Por pagar</button>
          <button :class="{ on: filter === 'p' }" @click="filter = 'p'">Pagados</button>
        </div>
        <button v-if="canSellNow" class="btn btn-soft btn-sm" @click="lucky"><Icon name="dice" />Al azar</button>
      </div>
      <NumberLookup v-model="q" @only="only = $event" @pick="pick" />
      <Legend :stats="ctx.stats" style="margin-bottom: 14px" />
      <p v-if="ctx.raffle.assignMode === 'blocks' && !isAdmin" class="small muted" style="margin-bottom: 10px">
        <Icon name="info" :size="14" /> Solo puedes vender los números de tu bloque; los demás se ven atenuados.
      </p>
      <NumberGrid :raffle="ctx.raffle" :board="ctx.board" :selected="selected" :my-mid="mid" :is-admin="isAdmin" :filter="filter" external :query="q" :only="only" mode="sell" @toggle="toggle" @open="open" />
    </div>

    <Transition name="slide-up">
      <div v-if="selected.length" class="sell-bar">
        <div class="grow">
          <div class="num-chips">
            <span v-for="n in selected.slice(0, 8)" :key="n" class="num-chip gold">{{ pad(n, ctx.raffle.size) }}</span>
            <span v-if="selected.length > 8" class="num-chip">+{{ selected.length - 8 }}</span>
          </div>
          <div class="small" style="margin-top: 4px"><b>{{ money(total, ctx.raffle.currency) }}</b><span v-if="rate" class="faint"> · Bs {{ (total * rate).toLocaleString('es-VE', { maximumFractionDigits: 2 }) }}</span></div>
        </div>
        <button class="btn btn-ghost btn-icon" aria-label="Limpiar" @click="selected = []"><Icon name="x" /></button>
        <button class="btn btn-gold btn-lg" @click="sell = true">Vender {{ selected.length }}</button>
      </div>
    </Transition>

    <SellSheet :open="sell" :raffle="ctx.raffle" :numbers="[...selected].sort((a, b) => a - b)" @close="sell = false" @done="done" />
  </div>
</template>

<style>
.sell-bar { position: fixed; z-index: 45; left: 12px; right: 12px; margin: 0 auto; max-width: 680px; bottom: calc(var(--nav-h) + 12px + env(safe-area-inset-bottom));
  display: flex; align-items: center; gap: 10px; padding: 12px 12px 12px 16px; border-radius: 20px; background: var(--surface); border: 1px solid var(--line); box-shadow: var(--shadow-lg); }
@media (min-width: 721px) { .sell-bar { bottom: 20px; left: 252px; } }
</style>
