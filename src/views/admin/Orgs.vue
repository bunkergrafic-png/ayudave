<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { getDocs, collection, doc, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import Icon from '../../components/Icon.vue'
import Sheet from '../../components/Sheet.vue'
import { createOrg } from '../../lib/team'
import { usernameToKey } from '../../lib/session'
import { randomPassword, dateOnly, firstName } from '../../lib/format'
import { copy, whatsappUrl, baseUrl } from '../../lib/share'
import { toast, toastError, confirmDialog } from '../../lib/ui'

const orgs = ref(null)
const raffles = ref([])
const f = reactive({ open: false, name: '', ownerName: '', username: '', password: '', phone: '', busy: false, done: false })
async function load() {
  const [o, r] = await Promise.all([getDocs(collection(db, 'orgs')), getDocs(collection(db, 'raffles'))])
  orgs.value = o.docs.map(d => ({ id: d.id, ...d.data() }))
  raffles.value = r.docs.map(d => ({ id: d.id, ...d.data() }))
}
onMounted(() => load().catch(toastError))
const countOf = id => raffles.value.filter(r => r.orgId === id).length
function open() { Object.assign(f, { open: true, name: '', ownerName: '', username: '', password: randomPassword(), phone: '', busy: false, done: false }) }
async function save() {
  if (f.name.trim().length < 2 || f.ownerName.trim().length < 2) return toastError(new Error('Completa el nombre de la organización y del organizador'))
  f.busy = true
  try {
    await createOrg({ name: f.name.trim(), owner: { name: f.ownerName.trim(), username: f.username, password: f.password, phone: f.phone } })
    f.done = true
    load()
  } catch (e) { toastError(e) } finally { f.busy = false }
}
async function toggle(o) {
  if (!(await confirmDialog({ title: o.active === false ? 'Reactivar organización' : 'Suspender organización', danger: o.active !== false }))) return
  await updateDoc(doc(db, 'orgs', o.id), { active: o.active === false })
  o.active = o.active === false
}
const credText = computed(() => `¡Hola ${firstName(f.ownerName)}! Tu cuenta de organizador en Rifalo está lista 🎟️\n\nEntra en: ${baseUrl()}/login\nUsuario: ${usernameToKey(f.username)}\nClave temporal: ${f.password}`)
</script>

<template>
  <div class="container stack" style="--gap: 18px">
    <div class="row wrap between">
      <div><h1>Clientes</h1><p class="muted small">Organizaciones que usan Rifalo. Cada una ve solo sus rifas y su equipo.</p></div>
      <button class="btn btn-gold" @click="open"><Icon name="plus" />Nueva organización</button>
    </div>
    <div v-if="orgs === null" class="skeleton" style="height: 120px" />
    <div v-else class="people-grid">
      <div v-for="o in orgs" :key="o.id" class="card person" :class="{ off: o.active === false }">
        <div class="row"><span class="avatar"><Icon name="building" /></span><div class="grow"><b>{{ o.name }}</b><div class="tiny faint">Desde {{ dateOnly(o.createdAt) }}</div></div>
          <span class="badge" :class="o.active === false ? 'b-mute' : 'b-ok'">{{ o.active === false ? 'Suspendida' : 'Activa' }}</span></div>
        <div class="small muted">{{ countOf(o.id) }} rifa(s)</div>
        <button class="btn btn-ghost btn-sm" style="align-self: flex-start" @click="toggle(o)">{{ o.active === false ? 'Reactivar' : 'Suspender' }}</button>
      </div>
    </div>
    <Sheet :open="f.open" :title="f.done ? '¡Organización creada!' : 'Nueva organización'" @close="f.open = false">
      <div v-if="!f.done" class="stack" style="--gap: 14px">
        <div class="field"><label>Nombre de la organización</label><input v-model="f.name" class="input" placeholder="Ej. Fundación Esperanza" /></div>
        <div class="divider" />
        <span class="section-label">Organizador (administrador)</span>
        <div class="field"><label>Nombre</label><input v-model="f.ownerName" class="input" /></div>
        <div class="grid-2">
          <div class="field"><label>Usuario</label><input v-model="f.username" class="input" autocapitalize="none" @input="f.username = usernameToKey(f.username)" /></div>
          <div class="field"><label>Clave temporal</label><input v-model="f.password" class="input mono" /></div>
        </div>
        <div class="field"><label>WhatsApp</label><input v-model="f.phone" class="input" inputmode="tel" /></div>
      </div>
      <div v-else class="stack" style="--gap: 12px">
        <p class="muted small">Comparte el acceso con el organizador:</p>
        <a v-if="f.phone" class="btn btn-wa btn-block" :href="whatsappUrl(f.phone, credText)" target="_blank" rel="noopener"><Icon name="whatsapp" />Enviar por WhatsApp</a>
        <button class="btn btn-ghost btn-block" @click="copy(credText).then(() => toast('Copiado'))"><Icon name="copy" />Copiar credenciales</button>
      </div>
      <template #footer>
        <template v-if="!f.done"><button class="btn btn-ghost" @click="f.open = false">Cancelar</button><button class="btn btn-primary" :disabled="f.busy" @click="save"><span v-if="f.busy" class="spinner" /><template v-else>Crear</template></button></template>
        <button v-else class="btn btn-primary" @click="f.open = false">Listo</button>
      </template>
    </Sheet>
  </div>
</template>
