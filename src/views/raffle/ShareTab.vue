<script setup>
import { inject, computed, ref, watch } from 'vue'
import Icon from '../../components/Icon.vue'
import { session, isRaffleAdmin } from '../../lib/session'
import { raffleLink, shareRaffleMessage, copy, nativeShare, whatsappUrl } from '../../lib/share'
import { toast } from '../../lib/ui'

const ctx = inject('ctx')
const isAdmin = computed(() => isRaffleAdmin(ctx.raffle))
const mid = computed(() => session.profile?.mid)
const myCode = computed(() => ctx.raffle.team?.[mid.value]?.code || '')
const links = computed(() => {
  const out = []
  if (isAdmin.value) out.push({ key: 'general', name: 'Enlace general', desc: 'Los apartados llegan a la bandeja compartida o al vendedor que escoja el comprador', url: raffleLink(ctx.raffle), code: '' })
  const team = Object.entries(ctx.raffle.team || {}).filter(([m]) => (ctx.raffle.sellers || []).includes(m))
  team.forEach(([m, t]) => {
    if (isAdmin.value || m === mid.value) out.push({ key: m, name: m === mid.value ? 'Mi enlace personal' : t.name, desc: 'Lo que se aparte desde aquí te llega directo a ti', url: raffleLink(ctx.raffle, t.code), code: t.code })
  })
  if (!isAdmin.value && !myCode.value) out.push({ key: 'general', name: 'Enlace de la rifa', desc: '', url: raffleLink(ctx.raffle), code: '' })
  return out
})
const qr = ref({})
watch(links, async l => {
  const QR = await import('qrcode')
  const map = {}
  for (const x of l) map[x.key] = await QR.toDataURL(x.url, { margin: 1, width: 280, color: { dark: '#2E1065', light: '#FFFFFF' } })
  qr.value = map
}, { immediate: true })
async function cp(u) { await copy(u); toast('Enlace copiado') }
const disabled = computed(() => !ctx.raffle.public?.enabled || ctx.raffle.status === 'draft')
</script>

<template>
  <div class="stack" style="--gap: 12px">
    <div v-if="disabled" class="notice warn"><Icon name="eyeOff" /><p class="small"><b>La página pública no está visible.</b> {{ ctx.raffle.status === 'draft' ? 'Abre las ventas para que funcione.' : 'Actívala en la configuración de la rifa.' }}</p></div>
    <div class="share-grid">
      <div v-for="l in links" :key="l.key" class="card share-card">
        <img v-if="qr[l.key]" :src="qr[l.key]" class="qr" alt="Código QR" />
        <div class="grow stack" style="--gap: 6px; min-width: 0">
          <h3>{{ l.name }}</h3>
          <p v-if="l.desc" class="small muted">{{ l.desc }}</p>
          <code class="share-url">{{ l.url }}</code>
          <div class="row wrap" style="--gap: 6px">
            <a class="btn btn-wa btn-sm" :href="whatsappUrl('', shareRaffleMessage(ctx.raffle, l.code))" target="_blank" rel="noopener"><Icon name="whatsapp" />WhatsApp</a>
            <button class="btn btn-ghost btn-sm" @click="cp(l.url)"><Icon name="copy" />Copiar</button>
            <button class="btn btn-ghost btn-sm" @click="nativeShare({ title: ctx.raffle.title, text: shareRaffleMessage(ctx.raffle, l.code) })"><Icon name="share" />Compartir</button>
            <a class="btn btn-ghost btn-sm" :href="l.url" target="_blank" rel="noopener"><Icon name="eye" />Ver</a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
.share-grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); }
.share-card { display: flex; gap: 16px; align-items: flex-start; }
.qr { width: 110px; height: 110px; border-radius: 12px; border: 1px solid var(--line); flex: none; }
.share-url { font-size: .75rem; padding: 6px 8px; background: var(--surface-2); border-radius: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; }
@media (max-width: 420px) { .share-grid { grid-template-columns: 1fr; } .share-card { flex-direction: column; align-items: center; } }
</style>
