<script setup>
// Tablero de números. Para rifas grandes se pagina en bloques de 500.
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { effective, canSellNumber } from '../lib/raffle'
import { pad } from '../lib/format'
import Icon from './Icon.vue'

const props = defineProps({
  raffle: { type: Object, required: true },
  board: { type: Object, required: true },
  selected: { type: Array, default: () => [] },
  mode: { type: String, default: 'sell' }, // sell | public | view
  myMid: { type: String, default: '' },
  isAdmin: Boolean,
  filter: { type: String, default: 'all' }
})
const emit = defineEmits(['toggle', 'open'])

const PAGE = 500
const page = ref(0)
const search = ref('')
const pages = computed(() => Math.ceil(props.raffle.size / PAGE))
const tick = ref(Date.now())
const timer = setInterval(() => { tick.value = Date.now() }, 30000)
onBeforeUnmount(() => clearInterval(timer))

const selSet = computed(() => new Set(props.selected))

function stateOf(n) {
  const e = effective(props.board[String(n)], tick.value)
  if (!e) return { s: 'free' }
  return { s: e.s, mine: !!props.myMid && e.sl === props.myMid, e }
}

const visible = computed(() => {
  const size = props.raffle.size
  const q = search.value.trim()
  let nums
  if (q) {
    nums = []
    for (let n = 1; n <= size; n++) if (pad(n, size).includes(q)) nums.push(n)
    nums = nums.slice(0, 600)
  } else {
    const from = page.value * PAGE + 1
    const to = Math.min(size, from + PAGE - 1)
    nums = []
    for (let n = from; n <= to; n++) nums.push(n)
  }
  const f = props.filter
  return nums.map(n => {
    const st = stateOf(n)
    const locked = props.mode === 'sell' && st.s === 'free' && !canSellNumber(props.raffle, n, props.myMid, props.isAdmin)
    return { n, label: pad(n, size), ...st, locked }
  }).filter(c => {
    if (f === 'all') return true
    if (f === 'free') return c.s === 'free' && !c.locked
    if (f === 'mine') return c.mine
    return c.s === f
  })
})

watch(() => props.raffle.size, () => { page.value = 0 })

function click(c) {
  if (props.mode === 'view') return emit('open', c.n)
  if (c.s === 'free') {
    if (c.locked) return
    emit('toggle', c.n)
  } else if (props.mode === 'sell') emit('open', c.n)
}
function rangeLabel(i) {
  const from = i * PAGE + 1
  const to = Math.min(props.raffle.size, from + PAGE - 1)
  return `${pad(from, props.raffle.size)}–${pad(to, props.raffle.size)}`
}
</script>

<template>
  <div class="ngrid-wrap">
    <div class="row wrap ngrid-tools">
      <div class="input-group grow" style="min-width: 160px; max-width: 260px">
        <span class="prefix"><Icon name="search" :size="18" /></span>
        <input v-model="search" class="input" inputmode="numeric" placeholder="Buscar número" aria-label="Buscar número" />
      </div>
      <div v-if="pages > 1 && !search" class="segmented">
        <button v-for="i in pages" :key="i" :class="{ on: page === i - 1 }" @click="page = i - 1">{{ rangeLabel(i - 1) }}</button>
      </div>
    </div>
    <div class="ngrid" :class="['m-' + mode, { big: raffle.size > 999, huge: raffle.size > 9999 }]">
      <button
        v-for="c in visible" :key="c.n" type="button"
        class="ncell"
        :class="[
          mode === 'public' ? (c.s === 'free' ? 'free' : 'off') : c.s,
          { sel: selSet.has(c.n), mine: c.mine, locked: c.locked, abono: c.e?.a && c.s === 'v' }
        ]"
        :disabled="mode === 'public' && c.s !== 'free'"
        :aria-label="`Número ${c.label}`"
        @click="click(c)"
      >
        <span>{{ c.label }}</span>
        <i v-if="selSet.has(c.n)" class="tick"><Icon name="check" :size="12" :stroke="3.5" /></i>
      </button>
    </div>
    <p v-if="!visible.length" class="empty small">No hay números con este filtro.</p>
  </div>
</template>

<style>
.ngrid-tools { margin-bottom: 12px; }
.ngrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(50px, 1fr)); gap: 6px; }
.ngrid.big { grid-template-columns: repeat(auto-fill, minmax(58px, 1fr)); }
.ngrid.huge { grid-template-columns: repeat(auto-fill, minmax(66px, 1fr)); }
.ncell {
  position: relative; height: 44px; border-radius: 11px; border: 1.5px solid var(--n-free-line); background: var(--n-free);
  font-weight: 800; font-size: .88rem; font-variant-numeric: tabular-nums; cursor: pointer; color: var(--text);
  transition: transform .12s ease, background .15s, border-color .15s, box-shadow .15s;
}
.ncell:hover:not(:disabled) { transform: translateY(-2px); box-shadow: var(--shadow); border-color: var(--brand-400); }
.ncell:active:not(:disabled) { transform: scale(.94); }
.ncell.r { background: var(--n-r); border-color: var(--n-r-line); color: var(--n-r-text); }
.ncell.v { background: var(--n-v); border-color: var(--n-v-line); color: var(--n-v-text); }
.ncell.v.abono { background: linear-gradient(135deg, var(--n-v) 50%, #A7F3D0 50%); }
.ncell.p { background: var(--n-p); border-color: var(--n-p); color: var(--n-p-text); }
.ncell.off { background: var(--surface-2); border-color: var(--line); color: var(--text-3); text-decoration: line-through; cursor: not-allowed; opacity: .55; }
.ncell.locked { opacity: .35; cursor: not-allowed; border-style: dashed; }
.ncell.mine { box-shadow: 0 0 0 2.5px var(--brand-600); }
.ncell.sel { background: linear-gradient(135deg, var(--gold-400), var(--gold-500)); border-color: var(--gold-500); color: #2A1A00; animation: pop .25s ease; box-shadow: 0 6px 14px -6px rgba(245, 165, 11, .9); }
.ncell .tick { position: absolute; top: -6px; right: -6px; width: 18px; height: 18px; border-radius: 50%; background: var(--brand-700); color: #fff; display: grid; place-items: center; }
.m-public .ncell.free { border-color: var(--brand-400); }
@media (max-width: 420px) { .ngrid { gap: 5px; grid-template-columns: repeat(auto-fill, minmax(46px, 1fr)); } .ncell { height: 42px; font-size: .82rem; } }
</style>
