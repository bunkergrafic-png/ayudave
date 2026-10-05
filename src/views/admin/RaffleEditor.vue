<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { doc, getDoc, getDocs, collection } from 'firebase/firestore'
import { db } from '../../firebase'
import Icon from '../../components/Icon.vue'
import PersonSheet from '../../components/PersonSheet.vue'
import { session, actorFor, isRaffleAdmin } from '../../lib/session'
import { defaultRaffle, createRaffle, saveRaffle, changeSlug } from '../../lib/raffles'
import { listOrgPeople } from '../../lib/team'
import { watchBoard, DRAW_RULES, DRAW_METHODS, chunkCount } from '../../lib/raffle'
import { BANKS } from '../../lib/payments'
import { rates, loadRates } from '../../lib/rates'
import { money, pad, round2 } from '../../lib/format'
import { compressImage } from '../../lib/image'
import { toast, toastError } from '../../lib/ui'
import { raffleLink } from '../../lib/share'

const route = useRoute()
const router = useRouter()
const editing = computed(() => !!route.params.id)
const loading = ref(true)
const busy = ref(false)
const f = reactive(defaultRaffle(''))
const original = ref(null)
const orgs = ref([])
const people = ref([])
const personSheet = ref(false)
const board = ref({})
const slugEdit = ref('')
let stopBoard = null

const isSuper = computed(() => session.profile?.role === 'super')
const isOwnerLevel = computed(() => isSuper.value || (session.profile?.role === 'owner' && session.profile.orgId === f.orgId))
const SIZES = [50, 100, 200, 500, 1000, 10000]

onMounted(async () => {
  loadRates()
  try {
    if (editing.value) {
      const snap = await getDoc(doc(db, 'raffles', route.params.id))
      if (!snap.exists()) throw new Error('La rifa no existe')
      const data = { id: snap.id, ...snap.data() }
      if (!isRaffleAdmin(data)) { router.replace(`/rifa/${data.id}`); return }
      original.value = data
      const base = defaultRaffle(data.orgId)
      Object.assign(f, base, JSON.parse(JSON.stringify(data)))
      f.methods = { ...base.methods, ...(data.methods || {}) }
      f.public = { ...base.public, ...(data.public || {}) }
      slugEdit.value = data.slug
      stopBoard = watchBoard(data, b => { board.value = b }, () => {})
    } else {
      f.orgId = session.profile.orgId || ''
      if (isSuper.value) {
        orgs.value = (await getDocs(collection(db, 'orgs'))).docs.map(d => ({ id: d.id, ...d.data() }))
        if (!f.orgId && orgs.value.length) f.orgId = orgs.value[0].id
      }
    }
    await loadPeople()
  } catch (e) { toastError(e) } finally { loading.value = false }
})
onBeforeUnmount(() => stopBoard?.())

async function loadPeople() {
  if (!f.orgId) return
  try { people.value = (await listOrgPeople(f.orgId)).filter(p => p.role === 'member') } catch { people.value = [] }
}

// ───── Equipo de la rifa ─────
function roleOf(mid) { return f.coadmins.includes(mid) ? 'coadmin' : f.sellers.includes(mid) ? 'seller' : 'none' }
function setRole(p, r) {
  f.sellers = f.sellers.filter(x => x !== p.mid)
  if (isOwnerLevel.value) f.coadmins = f.coadmins.filter(x => x !== p.mid)
  if (r === 'seller' || r === 'coadmin') f.sellers.push(p.mid)
  if (r === 'coadmin' && isOwnerLevel.value) f.coadmins.push(p.mid)
  if (r === 'none') { delete f.team[p.mid]; f.blocks = f.blocks.filter(b => b.mid !== p.mid) }
  else f.team[p.mid] = { name: p.name, code: p.username, phone: p.phone || '' }
}
const activePeople = computed(() => people.value.filter(p => p.active || f.sellers.includes(p.mid)))
const sellerList = computed(() => f.sellers.map(mid => ({ mid, name: f.team[mid]?.name || '—' })))
function onPersonCreated(p) { people.value.push(p); setRole(p, 'seller') }

function splitBlocks() {
  const s = sellerList.value
  if (!s.length) return toastError(new Error('Primero agrega vendedores'))
  const per = Math.floor(f.size / s.length)
  let from = 1
  f.blocks = s.map((x, i) => {
    const to = i === s.length - 1 ? f.size : from + per - 1
    const b = { mid: x.mid, from, to }
    from = to + 1
    return b
  })
}
function addBlock() { f.blocks.push({ mid: sellerList.value[0]?.mid || '', from: 1, to: Math.min(f.size, 10) }) }

// ───── Premios ─────
function addPrize() { f.prizes.push({ place: f.prizes.length + 1, title: '', value: 0, image: '' }) }
function removePrize(i) { f.prizes.splice(i, 1); f.prizes.forEach((p, j) => { p.place = j + 1 }) }
async function pickImage(e, target, key, max = 900) {
  const file = e.target.files?.[0]
  if (!file) return
  try { target[key] = await compressImage(file, max, 0.72) } catch (err) { toastError(err) }
  e.target.value = ''
}

const goal = computed(() => round2(f.size * f.price))
const rateNow = computed(() => f.rate.mode === 'manual' ? Number(f.rate.value) : (f.currency === 'EUR' ? rates.EUR : rates.USD))

function validate() {
  if (!f.orgId) return 'Escoge la organización'
  if (f.title.trim().length < 3) return 'Ponle un nombre a la rifa'
  if (!(f.size >= 10 && f.size <= 100000)) return 'La cantidad de números debe estar entre 10 y 100.000'
  if (!(f.price > 0)) return 'El precio por número debe ser mayor a 0'
  if (!f.prizes.length || f.prizes.some(p => !p.title.trim())) return 'Describe cada premio'
  if (f.drawRule === 'date' && !f.drawDate) return 'Indica la fecha del sorteo'
  if (!Object.values(f.methods).some(m => m.enabled)) return 'Activa al menos un método de pago'
  if (f.methods.pm.enabled && (!f.methods.pm.bank || !f.methods.pm.phone || !f.methods.pm.ci)) return 'Completa los datos de Pago móvil (banco, teléfono y cédula)'
  if (f.methods.transfer.enabled && (!f.methods.transfer.bank || !f.methods.transfer.account)) return 'Completa los datos de la transferencia'
  if (f.methods.binance.enabled && !f.methods.binance.payId && !f.methods.binance.email) return 'Indica el Pay ID o correo de Binance'
  if (f.rate.enabled && f.rate.mode === 'manual' && !(f.rate.value > 0)) return 'Escribe la tasa manual'
  if (f.assignMode === 'blocks') {
    for (const b of f.blocks) {
      if (!b.mid || !(b.from >= 1) || !(b.to <= f.size) || b.from > b.to) return 'Revisa los bloques de números'
    }
    const sorted = [...f.blocks].sort((a, b) => a.from - b.from)
    for (let i = 1; i < sorted.length; i++) if (sorted[i].from <= sorted[i - 1].to) return 'Hay bloques de números que se cruzan'
  }
  if (editing.value && f.size < original.value.size) {
    const max = Math.max(0, ...Object.keys(board.value).map(Number))
    if (max > f.size) return `No puedes bajar a ${f.size} números: el número ${max} ya está ocupado`
  }
  if (f.public.maxPerOrder < 1 || f.public.maxPerOrder > 5) return 'Máximo de números por apartado: entre 1 y 5'
  return ''
}

function payload() {
  const data = JSON.parse(JSON.stringify(f))
  delete data.id; delete data.createdAt; delete data.createdBy; delete data.updatedAt; delete data.slug; delete data.drawnAt
  data.size = Number(data.size); data.price = Number(data.price)
  data.holdHours = Number(data.holdHours) || 0
  data.public.holdMinutes = Number(data.public.holdMinutes) || 60
  data.public.maxPerOrder = Number(data.public.maxPerOrder) || 5
  data.goal = goal.value
  data.blocks = data.blocks.map(b => ({ mid: b.mid, from: Number(b.from), to: Number(b.to) }))
  if (!isOwnerLevel.value && original.value) data.coadmins = original.value.coadmins
  return data
}

async function save(publish = false) {
  const err = validate()
  if (err) return toastError(new Error(err))
  busy.value = true
  const actor = actorFor({ ...f, coadmins: f.coadmins })
  try {
    const data = payload()
    if (editing.value) {
      await saveRaffle(original.value, data, actor, original.value.size)
      if (slugEdit.value && slugEdit.value !== original.value.slug) await changeSlug(original.value, slugEdit.value)
      toast('Cambios guardados')
      router.push(`/rifa/${original.value.id}`)
    } else {
      if (publish) data.status = 'active'
      const { id } = await createRaffle(data, actor)
      toast(publish ? '¡Rifa publicada! 🎉' : 'Rifa guardada como borrador')
      router.replace(`/rifa/${id}`)
    }
  } catch (e) { toastError(e) } finally { busy.value = false }
}
</script>

<template>
  <div class="container editor">
    <div v-if="loading" class="stack"><div class="skeleton" style="height: 60px" /><div class="skeleton" style="height: 300px" /></div>
    <template v-else>
      <div class="row" style="margin-bottom: 18px">
        <button class="btn btn-ghost btn-icon btn-sm" aria-label="Volver" @click="router.back()"><Icon name="arrowLeft" /></button>
        <div class="grow">
          <h1>{{ editing ? 'Editar rifa' : 'Nueva rifa' }}</h1>
          <p class="muted small">{{ editing ? f.title : 'Configura todo a tu medida. Podrás cambiarlo después.' }}</p>
        </div>
      </div>

      <div class="stack" style="--gap: 16px">
        <!-- 1. Básico -->
        <section class="card ed-sec">
          <div class="ed-head"><span class="ed-num">1</span><div><h2>Lo básico</h2><p class="small muted">Nombre, motivo y foto de portada</p></div></div>
          <div v-if="isSuper && !editing" class="field">
            <label>Organización</label>
            <select v-model="f.orgId" class="select" @change="loadPeople">
              <option v-for="o in orgs" :key="o.id" :value="o.id">{{ o.name }}</option>
            </select>
          </div>
          <div class="field"><label>Nombre de la rifa *</label><input v-model="f.title" class="input" placeholder="Ej. Pro fondos gastos médicos" maxlength="80" /></div>
          <div class="field"><label>Descripción</label><textarea v-model="f.description" class="textarea" placeholder="Cuéntale a la gente para qué es la rifa…" maxlength="600" /></div>
          <div class="grid-2 collapse">
            <div class="field">
              <label>Foto de portada</label>
              <div v-if="f.cover" class="cover-prev" :style="{ backgroundImage: `url(${f.cover})` }"><button class="btn btn-ghost btn-sm" @click="f.cover = ''"><Icon name="trash" />Quitar</button></div>
              <label v-else class="upload"><Icon name="image" :size="22" /><span>Subir imagen</span><input type="file" accept="image/*" hidden @change="pickImage($event, f, 'cover', 1200)" /></label>
            </div>
            <div class="field">
              <label>WhatsApp de contacto</label>
              <input v-model="f.contactPhone" class="input" inputmode="tel" placeholder="0414-1234567" />
              <span class="hint">Se muestra en la página pública para dudas</span>
            </div>
          </div>
        </section>

        <!-- 2. Números y precio -->
        <section class="card ed-sec">
          <div class="ed-head"><span class="ed-num">2</span><div><h2>Números y precio</h2><p class="small muted">Cuántos números tendrá y cuánto cuesta cada uno</p></div></div>
          <div class="field">
            <label>Cantidad de números</label>
            <div class="row wrap" style="--gap: 8px">
              <button v-for="s in SIZES" :key="s" type="button" class="btn btn-sm" :class="f.size === s ? 'btn-primary' : 'btn-ghost'" @click="f.size = s">{{ s.toLocaleString('es-VE') }}</button>
              <input v-model.number="f.size" class="input mono" type="number" min="10" max="100000" style="width: 120px; height: 34px" aria-label="Cantidad personalizada" />
            </div>
            <span class="hint">Números del {{ pad(1, f.size) }} al {{ pad(f.size, f.size) }} · {{ chunkCount(f.size) }} bloque(s) de datos</span>
          </div>
          <div class="grid-2">
            <div class="field">
              <label>Precio por número *</label>
              <div class="input-group"><span class="prefix">{{ f.currency === 'VES' ? 'Bs' : f.currency === 'EUR' ? '€' : '$' }}</span><input v-model.number="f.price" class="input mono" type="number" step="0.01" min="0" inputmode="decimal" /></div>
            </div>
            <div class="field">
              <label>Moneda base</label>
              <select v-model="f.currency" class="select">
                <option value="USD">Dólares (USD)</option>
                <option value="EUR">Euros (EUR)</option>
                <option value="VES">Bolívares (Bs)</option>
              </select>
            </div>
          </div>
          <template v-if="f.currency !== 'VES'">
            <label class="switch">
              <span><b>Cobrar también en bolívares</b><br /><span class="small muted">Muestra el precio en Bs y permite pagos en Bs a la tasa del día</span></span>
              <input v-model="f.rate.enabled" type="checkbox" /><span class="track" />
            </label>
            <div v-if="f.rate.enabled" class="grid-2">
              <div class="field">
                <label>Tasa</label>
                <select v-model="f.rate.mode" class="select"><option value="bcv">Oficial BCV (automática)</option><option value="manual">Manual</option></select>
              </div>
              <div class="field">
                <label>{{ f.rate.mode === 'manual' ? 'Bs por 1 ' + f.currency : 'Tasa de hoy' }}</label>
                <input v-if="f.rate.mode === 'manual'" v-model.number="f.rate.value" class="input mono" type="number" step="0.01" />
                <div v-else class="input mono rate-ro">{{ rateNow ? 'Bs ' + rateNow.toLocaleString('es-VE') : rates.loading ? 'Consultando…' : 'Sin conexión con el BCV' }}</div>
              </div>
            </div>
          </template>
          <div class="goal-box">
            <span class="muted small">Si se venden todos, recaudas</span>
            <b>{{ money(goal, f.currency) }}</b>
            <span v-if="f.rate.enabled && rateNow" class="small faint">≈ {{ money(goal * rateNow, 'VES') }}</span>
          </div>
        </section>

        <!-- 3. Premios -->
        <section class="card ed-sec">
          <div class="ed-head"><span class="ed-num">3</span><div><h2>Premios</h2><p class="small muted">Uno o varios: 1°, 2°, 3°…</p></div></div>
          <div v-for="(p, i) in f.prizes" :key="i" class="prize-row">
            <div class="prize-place">{{ p.place }}°</div>
            <div class="grow stack" style="--gap: 8px">
              <input v-model="p.title" class="input" placeholder="Ej. Cesta de comida" />
              <div class="row" style="--gap: 8px">
                <div class="input-group grow"><span class="prefix">$</span><input v-model.number="p.value" class="input mono" type="number" step="0.01" placeholder="Valor (opcional)" /></div>
                <label v-if="!p.image" class="btn btn-ghost btn-icon" title="Foto del premio"><Icon name="camera" /><input type="file" accept="image/*" hidden @change="pickImage($event, p, 'image', 700)" /></label>
                <button v-else class="prize-img" :style="{ backgroundImage: `url(${p.image})` }" title="Quitar foto" @click="p.image = ''" />
                <button v-if="f.prizes.length > 1" class="btn btn-ghost btn-icon" title="Quitar premio" @click="removePrize(i)"><Icon name="trash" /></button>
              </div>
            </div>
          </div>
          <button class="btn btn-soft btn-sm" style="align-self: flex-start" @click="addPrize"><Icon name="plus" />Agregar premio</button>
        </section>

        <!-- 4. Sorteo -->
        <section class="card ed-sec">
          <div class="ed-head"><span class="ed-num">4</span><div><h2>Sorteo</h2><p class="small muted">Cuándo se puede sortear y cómo sale el ganador</p></div></div>
          <label class="label">¿Cuándo se habilita el sorteo?</label>
          <div class="choice-grid">
            <button v-for="(t, k) in DRAW_RULES" :key="k" type="button" class="choice" :class="{ on: f.drawRule === k }" @click="f.drawRule = k"><span class="t">{{ t }}</span></button>
          </div>
          <div v-if="f.drawRule === 'date'" class="field"><label>Fecha y hora del sorteo</label><input v-model="f.drawDate" class="input" type="datetime-local" /></div>
          <label class="label">¿Cómo se escoge el ganador?</label>
          <div class="choice-grid">
            <button v-for="(t, k) in DRAW_METHODS" :key="k" type="button" class="choice" :class="{ on: f.drawMethod === k }" @click="f.drawMethod = k">
              <span class="t">{{ t }}</span>
              <span class="d">{{ k === 'app' ? 'Animación en vivo y registro con fecha y hora' : k === 'lottery' ? 'Cargas el resultado y su evidencia' : 'Registras el número que salió' }}</span>
            </button>
          </div>
          <div v-if="f.drawMethod === 'lottery'" class="field"><label>Lotería</label><input v-model="f.lotteryName" class="input" placeholder="Ej. Triple Zulia 7:00 pm" /></div>
        </section>

        <!-- 5. Ventas y pagos -->
        <section class="card ed-sec">
          <div class="ed-head"><span class="ed-num">5</span><div><h2>Ventas y pagos</h2><p class="small muted">Plazos, abonos, métodos y comisiones</p></div></div>
          <div class="grid-2">
            <div class="field">
              <label>Plazo para pagar</label>
              <select v-model.number="f.holdHours" class="select">
                <option :value="12">12 horas</option><option :value="24">24 horas</option><option :value="48">48 horas</option>
                <option :value="72">3 días</option><option :value="168">7 días</option><option :value="0">Sin plazo</option>
              </select>
              <span class="hint">Si no se registra ningún pago, el número se libera solo</span>
            </div>
            <div class="field">
              <label>Comisión de vendedores</label>
              <div class="row" style="--gap: 6px">
                <select v-model="f.commission.type" class="select"><option value="none">Sin comisión</option><option value="percent">Porcentaje</option><option value="fixed">Monto por número</option></select>
                <input v-if="f.commission.type !== 'none'" v-model.number="f.commission.value" class="input mono" type="number" step="0.01" style="width: 90px" :placeholder="f.commission.type === 'percent' ? '%' : '$'" />
              </div>
            </div>
          </div>
          <label class="switch"><span><b>Aceptar abonos</b><br /><span class="small muted">Se puede pagar un número por partes</span></span><input v-model="f.allowPartial" type="checkbox" /><span class="track" /></label>
          <label class="switch"><span><b>El vendedor confirma el efectivo</b><br /><span class="small muted">Los pagos en efectivo quedan pagados sin esperar verificación del admin</span></span><input v-model="f.cashSelfConfirm" type="checkbox" /><span class="track" /></label>

          <div class="divider" />
          <span class="label">Métodos de pago</span>
          <div class="method-card">
            <label class="switch"><span class="row"><Icon name="banknote" /><b>Efectivo</b></span><input v-model="f.methods.cash.enabled" type="checkbox" /><span class="track" /></label>
          </div>
          <div class="method-card">
            <label class="switch"><span class="row"><Icon name="smartphone" /><b>Pago móvil</b></span><input v-model="f.methods.pm.enabled" type="checkbox" /><span class="track" /></label>
            <div v-if="f.methods.pm.enabled" class="grid-2">
              <div class="field"><label>Banco</label><select v-model="f.methods.pm.bank" class="select"><option value="" disabled>Banco</option><option v-for="b in BANKS" :key="b">{{ b }}</option></select></div>
              <div class="field"><label>Teléfono</label><input v-model="f.methods.pm.phone" class="input" inputmode="tel" /></div>
              <div class="field"><label>Cédula / RIF</label><input v-model="f.methods.pm.ci" class="input" /></div>
              <div class="field"><label>Titular</label><input v-model="f.methods.pm.holder" class="input" /></div>
            </div>
          </div>
          <div class="method-card">
            <label class="switch"><span class="row"><Icon name="bank" /><b>Transferencia</b></span><input v-model="f.methods.transfer.enabled" type="checkbox" /><span class="track" /></label>
            <div v-if="f.methods.transfer.enabled" class="grid-2">
              <div class="field"><label>Banco</label><select v-model="f.methods.transfer.bank" class="select"><option value="" disabled>Banco</option><option v-for="b in BANKS" :key="b">{{ b }}</option></select></div>
              <div class="field"><label>N° de cuenta</label><input v-model="f.methods.transfer.account" class="input mono" inputmode="numeric" /></div>
              <div class="field"><label>Cédula / RIF</label><input v-model="f.methods.transfer.ci" class="input" /></div>
              <div class="field"><label>Titular</label><input v-model="f.methods.transfer.holder" class="input" /></div>
            </div>
          </div>
          <div class="method-card">
            <label class="switch"><span class="row"><Icon name="bitcoin" /><b>Binance / USDT</b></span><input v-model="f.methods.binance.enabled" type="checkbox" /><span class="track" /></label>
            <div v-if="f.methods.binance.enabled" class="grid-2">
              <div class="field"><label>Pay ID</label><input v-model="f.methods.binance.payId" class="input mono" /></div>
              <div class="field"><label>Correo</label><input v-model="f.methods.binance.email" class="input" type="email" /></div>
              <div class="field"><label>Titular</label><input v-model="f.methods.binance.holder" class="input" /></div>
            </div>
          </div>
        </section>

        <!-- 6. Equipo -->
        <section class="card ed-sec">
          <div class="ed-head"><span class="ed-num">6</span><div><h2>Vendedores</h2><p class="small muted">Quién vende y quién ayuda a administrar esta rifa</p></div></div>
          <div v-if="!activePeople.length" class="empty small" style="padding: 18px">Aún no hay personas en tu equipo.</div>
          <div v-else class="team-list">
            <div v-for="p in activePeople" :key="p.mid" class="team-row">
              <span class="avatar">{{ p.name.split(' ').slice(0, 2).map(w => w[0]).join('') }}</span>
              <div class="grow"><b>{{ p.name }}</b><div class="tiny faint">@{{ p.username }}<template v-if="!p.active"> · desactivado</template></div></div>
              <div class="segmented">
                <button :class="{ on: roleOf(p.mid) === 'none' }" @click="setRole(p, 'none')">No</button>
                <button :class="{ on: roleOf(p.mid) === 'seller' }" @click="setRole(p, 'seller')">Vendedor</button>
                <button v-if="isOwnerLevel" :class="{ on: roleOf(p.mid) === 'coadmin' }" @click="setRole(p, 'coadmin')">Co-admin</button>
              </div>
            </div>
          </div>
          <button v-if="isOwnerLevel" class="btn btn-soft btn-sm" style="align-self: flex-start" @click="personSheet = true"><Icon name="plus" />Crear vendedor nuevo</button>

          <div class="divider" />
          <label class="label">¿Qué números puede vender cada uno?</label>
          <div class="choice-grid">
            <button type="button" class="choice" :class="{ on: f.assignMode === 'free' }" @click="f.assignMode = 'free'"><span class="t">Libres para todos</span><span class="d">Cualquiera vende cualquier número disponible</span></button>
            <button type="button" class="choice" :class="{ on: f.assignMode === 'blocks' }" @click="f.assignMode = 'blocks'"><span class="t">Bloques asignados</span><span class="d">Cada vendedor tiene su rango de números</span></button>
          </div>
          <div v-if="f.assignMode === 'blocks'" class="stack" style="--gap: 8px">
            <div v-for="(b, i) in f.blocks" :key="i" class="row block-row" style="--gap: 6px">
              <select v-model="b.mid" class="select grow"><option v-for="s in sellerList" :key="s.mid" :value="s.mid">{{ s.name }}</option></select>
              <input v-model.number="b.from" class="input mono" type="number" min="1" :max="f.size" style="width: 84px" aria-label="Desde" />
              <span class="faint">a</span>
              <input v-model.number="b.to" class="input mono" type="number" min="1" :max="f.size" style="width: 84px" aria-label="Hasta" />
              <button class="btn btn-ghost btn-icon" @click="f.blocks.splice(i, 1)"><Icon name="trash" /></button>
            </div>
            <div class="row wrap" style="--gap: 8px">
              <button class="btn btn-soft btn-sm" @click="addBlock"><Icon name="plus" />Agregar bloque</button>
              <button class="btn btn-ghost btn-sm" @click="splitBlocks"><Icon name="grid" />Repartir en partes iguales</button>
            </div>
          </div>
        </section>

        <!-- 7. Página pública -->
        <section class="card ed-sec">
          <div class="ed-head"><span class="ed-num">7</span><div><h2>Página pública</h2><p class="small muted">Un enlace para compartir en redes donde la gente escoge su número</p></div></div>
          <label class="switch"><span><b>Activar página pública</b><br /><span class="small muted">Muestra premio, precio y números libres (sin datos personales)</span></span><input v-model="f.public.enabled" type="checkbox" /><span class="track" /></label>
          <template v-if="f.public.enabled">
            <label class="switch"><span><b>Permitir apartar desde la página</b><br /><span class="small muted">Le llega al vendedor del enlace, o a la bandeja compartida</span></span><input v-model="f.public.allowReserve" type="checkbox" /><span class="track" /></label>
            <div v-if="f.public.allowReserve" class="grid-2">
              <div class="field">
                <label>El apartado dura</label>
                <select v-model.number="f.public.holdMinutes" class="select">
                  <option :value="30">30 minutos</option><option :value="60">1 hora</option><option :value="120">2 horas</option>
                  <option :value="360">6 horas</option><option :value="720">12 horas</option><option :value="1440">24 horas</option>
                </select>
              </div>
              <div class="field"><label>Máximo de números por apartado</label><input v-model.number="f.public.maxPerOrder" class="input mono" type="number" min="1" max="5" /></div>
            </div>
            <div v-if="editing" class="field">
              <label>Enlace</label>
              <div class="row" style="--gap: 6px"><span class="faint small">/r/</span><input v-model="slugEdit" class="input mono grow" /></div>
              <span class="hint">{{ raffleLink({ slug: slugEdit }) }}</span>
            </div>
          </template>
        </section>
      </div>

      <div class="save-bar">
        <button class="btn btn-ghost" :disabled="busy" @click="router.back()">Cancelar</button>
        <template v-if="editing">
          <button class="btn btn-primary" :disabled="busy" @click="save()"><span v-if="busy" class="spinner" /><template v-else><Icon name="check" />Guardar cambios</template></button>
        </template>
        <template v-else>
          <button class="btn btn-ghost" :disabled="busy" @click="save(false)">Guardar borrador</button>
          <button class="btn btn-gold" :disabled="busy" @click="save(true)"><span v-if="busy" class="spinner" /><template v-else><Icon name="sparkles" />Publicar rifa</template></button>
        </template>
      </div>
    </template>
    <PersonSheet :open="personSheet" :org-id="f.orgId" title="Nuevo vendedor" @close="personSheet = false" @created="onPersonCreated" />
  </div>
</template>

<style>
.editor { max-width: 820px; padding-bottom: 90px; }
.ed-sec { display: flex; flex-direction: column; gap: 14px; }
.ed-head { display: flex; gap: 14px; align-items: center; margin-bottom: 4px; }
.ed-num { width: 36px; height: 36px; border-radius: 12px; display: grid; place-items: center; font-family: var(--font-display); font-weight: 800; background: linear-gradient(135deg, var(--brand-500), var(--brand-800)); color: #fff; flex: none; }
.cover-prev { height: 120px; border-radius: 14px; background-size: cover; background-position: center; display: flex; align-items: flex-end; justify-content: flex-end; padding: 8px; }
.cover-prev .btn { background: var(--surface); }
.goal-box { display: flex; flex-direction: column; gap: 2px; padding: 16px; border-radius: 14px; background: linear-gradient(135deg, var(--brand-50), var(--gold-100)); border: 1px solid var(--line); }
.goal-box b { font-family: var(--font-display); font-size: 1.6rem; color: var(--brand-700); }
.rate-ro { display: flex; align-items: center; background: var(--surface-2); }
.prize-row { display: flex; gap: 12px; align-items: flex-start; }
.prize-place { width: 44px; height: 46px; border-radius: 12px; display: grid; place-items: center; background: var(--gold-100); color: var(--gold-600); font-family: var(--font-display); font-weight: 800; font-size: 1.1rem; flex: none; }
.prize-img { width: 46px; height: 46px; border-radius: 12px; border: 0; background-size: cover; background-position: center; cursor: pointer; flex: none; }
.method-card { border: 1px solid var(--line); border-radius: 14px; padding: 6px 14px 10px; display: flex; flex-direction: column; gap: 10px; }
.team-list { display: flex; flex-direction: column; gap: 8px; }
.team-row { display: flex; align-items: center; gap: 10px; padding: 10px; border: 1px solid var(--line); border-radius: 14px; flex-wrap: wrap; }
.save-bar { position: fixed; z-index: 35; left: 0; right: 0; bottom: 0; display: flex; justify-content: flex-end; gap: 10px; padding: 12px 16px calc(12px + env(safe-area-inset-bottom)); background: color-mix(in srgb, var(--surface) 94%, transparent); backdrop-filter: blur(12px); border-top: 1px solid var(--line); }
@media (min-width: 721px) { .save-bar { left: 240px; } }
@media (max-width: 720px) { .save-bar { bottom: calc(var(--nav-h) + env(safe-area-inset-bottom)); } .save-bar .btn { flex: 1; padding: 0 10px; } }
</style>
