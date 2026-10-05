<script setup>
import { ref, inject, computed, reactive, nextTick } from 'vue'
import Icon from '../../components/Icon.vue'
import Sheet from '../../components/Sheet.vue'
import DrawStage from '../../components/DrawStage.vue'
import { session, isRaffleAdmin, actorFor } from '../../lib/session'
import { drawReadiness, drawPrize, undoDraw, eligibleNumbers, DRAW_RULES, DRAW_METHODS } from '../../lib/raffle'
import { pad, digitsFor, dateTime } from '../../lib/format'
import { toast, toastError, confirmDialog, celebrate } from '../../lib/ui'

const ctx = inject('ctx')
const isAdmin = computed(() => isRaffleAdmin(ctx.raffle))
const canUndo = computed(() => ['super', 'owner'].includes(session.profile?.role))
const ready = computed(() => drawReadiness(ctx.raffle, ctx.stats))
const winners = computed(() => ctx.raffle.winners || [])
const prizes = computed(() => (ctx.raffle.prizes || []).map(p => ({ ...p, winner: winners.value.find(w => w.place === p.place) })))
const nextPrize = computed(() => prizes.value.find(p => !p.winner))
const pool = computed(() => eligibleNumbers(ctx.raffle, ctx.board).length)

const live = reactive({ open: false, prize: null, phase: 'idle', winner: null })
const manual = reactive({ open: false, prize: null, number: '', evidence: '', busy: false })
const stage = ref(null)

async function startDraw(p) {
  if (!ready.value.ready) return toastError(new Error(ready.value.reason))
  if (ctx.raffle.drawMethod !== 'app') {
    Object.assign(manual, { open: true, prize: p, number: '', evidence: ctx.raffle.drawMethod === 'lottery' ? `${ctx.raffle.lotteryName || 'Lotería'} · ` : '', busy: false })
    return
  }
  const ok = await confirmDialog({ title: `Sortear ${p.place}° premio`, message: `Participan ${pool.value} números. El resultado queda registrado con fecha y hora y no se puede repetir.`, confirmText: '¡Sortear!' })
  if (!ok) return
  Object.assign(live, { open: true, prize: p, phase: 'spinning', winner: null })
  await nextTick()
  stage.value?.start()
  try {
    const [w] = await Promise.all([
      drawPrize({ raffle: ctx.raffle, place: p.place, actor: actorFor(ctx.raffle), board: ctx.board }),
      new Promise(r => setTimeout(r, 1800))
    ])
    await stage.value?.land(w.number)
    live.winner = w
    live.phase = 'done'
    celebrate({ particleCount: 220, spread: 110 })
    setTimeout(() => celebrate({ angle: 60, origin: { x: 0, y: .7 } }), 300)
    setTimeout(() => celebrate({ angle: 120, origin: { x: 1, y: .7 } }), 500)
  } catch (e) { live.open = false; toastError(e) }
}

async function saveManual() {
  const n = parseInt(manual.number, 10)
  if (!(n >= 1 && n <= ctx.raffle.size)) return toastError(new Error(`El número debe estar entre ${pad(1, ctx.raffle.size)} y ${pad(ctx.raffle.size, ctx.raffle.size)}`))
  manual.busy = true
  try {
    const w = await drawPrize({ raffle: ctx.raffle, place: manual.prize.place, number: n, evidence: manual.evidence, actor: actorFor(ctx.raffle), board: ctx.board })
    manual.open = false
    if (w.unsold) toast('Ojo: ese número no estaba vendido', 'error', 6000)
    else { celebrate({ particleCount: 200, spread: 100 }); toast(`🏆 Ganador: ${w.buyerName}`) }
  } catch (e) { toastError(e) } finally { manual.busy = false }
}

async function undo(p) {
  const reason = await confirmDialog({ title: 'Anular resultado', message: 'Solo hazlo si hubo un error. Quedará registrado en el historial.', input: 'Motivo', confirmText: 'Anular resultado', danger: true })
  if (reason === false) return
  try { await undoDraw({ raffle: ctx.raffle, place: p.place, actor: actorFor(ctx.raffle), reason }); toast('Resultado anulado') } catch (e) { toastError(e) }
}
</script>

<template>
  <div class="stack" style="--gap: 14px">
    <div class="card draw-rule">
      <div class="row" style="--gap: 14px">
        <div class="draw-ico" :class="{ ok: ready.ready }"><Icon :name="ready.ready ? 'checkCircle' : 'clock'" :size="26" /></div>
        <div class="grow">
          <b>{{ ready.ready ? (nextPrize ? '¡Listo para sortear!' : 'Sorteo completado') : ready.reason }}</b>
          <p class="small muted">Regla: {{ DRAW_RULES[ctx.raffle.drawRule] }} · Método: {{ DRAW_METHODS[ctx.raffle.drawMethod] }}<template v-if="ctx.raffle.drawDate"> · {{ dateTime(new Date(ctx.raffle.drawDate)) }}</template></p>
        </div>
      </div>
      <div v-if="ctx.raffle.drawRule === 'all_sold' || ctx.raffle.drawRule === 'all_paid'" class="progress" style="margin-top: 14px">
        <span class="paid" :style="{ width: ctx.stats.pctPaid + '%' }" />
        <span v-if="ctx.raffle.drawRule === 'all_sold'" class="sold" :style="{ width: (ctx.stats.v / ctx.stats.size * 100) + '%' }" />
      </div>
    </div>

    <div class="prize-list">
      <div v-for="p in prizes" :key="p.place" class="card prize-card" :class="{ won: p.winner }">
        <div class="prize-img-lg" :style="p.image ? { backgroundImage: `url(${p.image})` } : {}"><Icon v-if="!p.image" name="gift" :size="34" /></div>
        <div class="grow stack" style="--gap: 6px">
          <span class="section-label">{{ p.place }}° premio</span>
          <h3>{{ p.title }}</h3>
          <template v-if="p.winner">
            <div class="winner-line">
              <span class="win-num">{{ pad(p.winner.number, ctx.raffle.size) }}</span>
              <div>
                <b>{{ p.winner.unsold ? 'Número no vendido' : p.winner.buyerName }}</b>
                <div class="tiny faint">{{ p.winner.sellerName ? 'Vendió ' + p.winner.sellerName + ' · ' : '' }}{{ dateTime(p.winner.at) }}<template v-if="p.winner.pool"> · entre {{ p.winner.pool }} números</template></div>
                <div v-if="p.winner.evidence" class="tiny muted">{{ p.winner.evidence }}</div>
              </div>
            </div>
            <div v-if="isAdmin" class="row wrap" style="--gap: 8px">
              <button v-if="p.winner.orderId" class="btn btn-soft btn-sm" @click="ctx.openOrder(p.winner.orderId)"><Icon name="ticket" />Ver comprador</button>
              <button v-if="canUndo" class="btn btn-ghost btn-sm" @click="undo(p)"><Icon name="ban" />Anular</button>
            </div>
          </template>
          <button v-else-if="isAdmin" class="btn btn-gold" style="align-self: flex-start" :disabled="!ready.ready || nextPrize?.place !== p.place" @click="startDraw(p)">
            <Icon name="dice" />{{ ctx.raffle.drawMethod === 'app' ? 'Sortear ahora' : 'Registrar ganador' }}
          </button>
          <p v-else class="small faint">Pendiente por sortear</p>
        </div>
      </div>
    </div>

    <!-- Sorteo en vivo -->
    <Sheet :open="live.open" :title="live.prize ? `${live.prize.place}° premio · ${live.prize.title}` : ''" @close="live.phase === 'done' && (live.open = false)">
      <div class="center stack" style="--gap: 6px">
        <p class="muted small">{{ live.phase === 'done' ? '¡Tenemos ganador!' : 'Sorteando entre ' + pool + ' números…' }}</p>
        <DrawStage ref="stage" :digits="digitsFor(ctx.raffle.size)" />
        <Transition name="slide-up">
          <div v-if="live.winner" class="stack" style="--gap: 10px">
            <h2>{{ live.winner.unsold ? 'Número no vendido' : (live.winner.buyerName || 'Comprador sin datos') }}</h2>
            <p v-if="live.winner.sellerName" class="muted small">Vendedor: {{ live.winner.sellerName }}</p>
            <p class="tiny faint">Sorteado con generador aleatorio criptográfico · {{ dateTime(live.winner.at) }}</p>
          </div>
        </Transition>
      </div>
      <template v-if="live.phase === 'done'" #footer>
        <button class="btn btn-primary" @click="live.open = false">Cerrar</button>
      </template>
    </Sheet>

    <!-- Lotería / sorteo externo -->
    <Sheet :open="manual.open" :title="`Ganador del ${manual.prize?.place}° premio`" :subtitle="ctx.raffle.drawMethod === 'lottery' ? 'Escribe el resultado de la lotería' : 'Escribe el número que salió en el sorteo'" @close="manual.open = false">
      <div class="stack" style="--gap: 14px">
        <div class="field"><label>Número ganador</label><input v-model="manual.number" class="input mono" inputmode="numeric" style="font-size: 1.6rem; height: 60px; text-align: center" :placeholder="pad(1, ctx.raffle.size)" /></div>
        <div class="field"><label>Evidencia</label><textarea v-model="manual.evidence" class="textarea" placeholder="Ej. Triple Zulia 7pm del 12/10, resultado 045. Enlace del video o publicación." /></div>
      </div>
      <template #footer>
        <button class="btn btn-ghost" @click="manual.open = false">Cancelar</button>
        <button class="btn btn-gold" :disabled="manual.busy" @click="saveManual">Registrar ganador</button>
      </template>
    </Sheet>
  </div>
</template>

<style>
.draw-ico { width: 52px; height: 52px; border-radius: 16px; display: grid; place-items: center; background: var(--warn-bg); color: var(--warn); flex: none; }
.draw-ico.ok { background: var(--ok-bg); color: var(--ok); }
.prize-list { display: flex; flex-direction: column; gap: 12px; }
.prize-card { display: flex; gap: 16px; align-items: flex-start; }
.prize-card.won { border-color: var(--gold-400); background: linear-gradient(135deg, var(--surface), var(--gold-100)); }
.prize-img-lg { width: 96px; height: 96px; border-radius: 18px; background: var(--brand-100) center / cover; color: var(--brand-600); display: grid; place-items: center; flex: none; }
.winner-line { display: flex; gap: 12px; align-items: center; }
.win-num { font-family: var(--font-display); font-weight: 800; font-size: 1.6rem; padding: 6px 14px; border-radius: 14px; background: linear-gradient(135deg, var(--gold-400), var(--gold-500)); color: #2A1A00; }
@media (max-width: 480px) { .prize-img-lg { width: 64px; height: 64px; } }
</style>
