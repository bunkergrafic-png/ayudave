<script setup>
import { ref, computed, onMounted, reactive } from 'vue'
import { getDocs, collection } from 'firebase/firestore'
import { db } from '../../firebase'
import Icon from '../../components/Icon.vue'
import Sheet from '../../components/Sheet.vue'
import PersonSheet from '../../components/PersonSheet.vue'
import { session } from '../../lib/session'
import { listOrgPeople, setActive, resetPassword, updatePerson } from '../../lib/team'
import { rafflesFor } from '../../lib/raffles'
import { initials, randomPassword, dateTime, firstName } from '../../lib/format'
import { copy, whatsappUrl, baseUrl } from '../../lib/share'
import { toast, toastError, confirmDialog } from '../../lib/ui'

const isSuper = computed(() => session.profile?.role === 'super')
const orgs = ref([])
const orgId = ref(session.profile?.orgId || '')
const people = ref(null)
const raffles = ref([])
const create = ref(false)
const q = ref('')
const edit = reactive({ open: false, p: null, name: '', phone: '', busy: false })
const reset = reactive({ open: false, p: null, password: '', done: false, busy: false })

async function load() {
  people.value = null
  try {
    people.value = (await listOrgPeople(orgId.value)).filter(p => p.role !== 'super')
    raffles.value = (await rafflesFor(session.profile)).filter(r => r.orgId === orgId.value)
  } catch (e) { toastError(e); people.value = [] }
}
onMounted(async () => {
  if (isSuper.value) {
    orgs.value = (await getDocs(collection(db, 'orgs'))).docs.map(d => ({ id: d.id, ...d.data() }))
    if (!orgId.value && orgs.value.length) orgId.value = orgs.value[0].id
  }
  load()
})
const list = computed(() => (people.value || []).filter(p => !q.value || `${p.name} ${p.username}`.toLowerCase().includes(q.value.toLowerCase())))
const rafflesOf = p => raffles.value.filter(r => (r.sellers || []).includes(p.mid) || (r.coadmins || []).includes(p.mid))
  .map(r => ({ title: r.title, role: (r.coadmins || []).includes(p.mid) ? 'Co-admin' : 'Vendedor' }))

async function toggle(p) {
  const ok = await confirmDialog({ title: p.active ? `¿Desactivar a ${p.name}?` : `¿Activar a ${p.name}?`, message: p.active ? 'No podrá entrar a la app. Sus ventas se mantienen.' : 'Podrá volver a entrar con su usuario y clave.', danger: p.active })
  if (!ok) return
  try { await setActive(p, !p.active); p.active = !p.active; toast('Listo') } catch (e) { toastError(e) }
}
function openEdit(p) { Object.assign(edit, { open: true, p, name: p.name, phone: p.phone || '', busy: false }) }
async function saveEdit() {
  edit.busy = true
  try { await updatePerson(edit.p, { name: edit.name.trim(), phone: edit.phone.trim() }); Object.assign(edit.p, { name: edit.name.trim(), phone: edit.phone.trim() }); edit.open = false; toast('Guardado') }
  catch (e) { toastError(e) } finally { edit.busy = false }
}
function openReset(p) { Object.assign(reset, { open: true, p, password: randomPassword(), done: false, busy: false }) }
async function doReset() {
  reset.busy = true
  try { await resetPassword(reset.p, reset.password); reset.done = true; load() } catch (e) { toastError(e) } finally { reset.busy = false }
}
const resetText = computed(() => reset.p ? `Hola ${firstName(reset.p.name)}, tu nueva clave temporal de Rifalo es: ${reset.password}\nUsuario: ${reset.p.username}\nEntra en ${baseUrl()}/login` : '')
</script>

<template>
  <div class="container stack" style="--gap: 18px">
    <div class="row wrap between">
      <div><h1>Equipo</h1><p class="muted small">Personas que pueden vender o administrar tus rifas</p></div>
      <button class="btn btn-gold" :disabled="!orgId" @click="create = true"><Icon name="plus" />Nueva persona</button>
    </div>
    <div class="row wrap" style="--gap: 8px">
      <select v-if="isSuper" v-model="orgId" class="select" style="width: auto" @change="load">
        <option v-for="o in orgs" :key="o.id" :value="o.id">{{ o.name }}</option>
      </select>
      <div class="input-group grow" style="min-width: 200px"><span class="prefix"><Icon name="search" :size="18" /></span><input v-model="q" class="input" placeholder="Buscar persona" /></div>
    </div>

    <div v-if="people === null" class="stack"><div v-for="i in 3" :key="i" class="skeleton" style="height: 74px" /></div>
    <div v-else-if="!list.length" class="card empty">
      <div class="ico"><Icon name="users" /></div>
      <h3>Aún no hay personas</h3>
      <p class="small" style="margin: 6px 0 14px">Crea a tus vendedores: cada uno tendrá su usuario y clave.</p>
      <button class="btn btn-primary" @click="create = true"><Icon name="plus" />Crear la primera</button>
    </div>
    <div v-else class="people-grid">
      <div v-for="p in list" :key="p.id" class="card person" :class="{ off: !p.active }">
        <div class="row">
          <span class="avatar">{{ initials(p.name) }}</span>
          <div class="grow" style="min-width: 0">
            <b>{{ p.name }}</b>
            <div class="tiny faint">@{{ p.username }}<template v-if="p.phone"> · {{ p.phone }}</template></div>
          </div>
          <span v-if="p.role === 'owner'" class="badge b-brand plain">Organizador</span>
          <span v-else-if="!p.active" class="badge b-mute">Inactivo</span>
        </div>
        <div class="row wrap" style="--gap: 6px">
          <span v-for="r in rafflesOf(p)" :key="r.title" class="badge plain b-mute">{{ r.role }} · {{ r.title }}</span>
          <span v-if="!rafflesOf(p).length" class="tiny faint">Sin rifas asignadas</span>
        </div>
        <div class="tiny faint">Último acceso: {{ p.lastLogin ? dateTime(p.lastLogin) : 'nunca' }}</div>
        <div v-if="p.role === 'member' || isSuper" class="row wrap" style="--gap: 6px">
          <button class="btn btn-ghost btn-sm" @click="openEdit(p)"><Icon name="edit" />Editar</button>
          <button class="btn btn-ghost btn-sm" @click="openReset(p)"><Icon name="key" />Nueva clave</button>
          <button class="btn btn-ghost btn-sm" @click="toggle(p)"><Icon :name="p.active ? 'ban' : 'check'" />{{ p.active ? 'Desactivar' : 'Activar' }}</button>
        </div>
      </div>
    </div>

    <PersonSheet :open="create" :org-id="orgId" @close="create = false" @created="load" />

    <Sheet :open="edit.open" title="Editar persona" @close="edit.open = false">
      <div class="stack" style="--gap: 14px">
        <div class="field"><label>Nombre</label><input v-model="edit.name" class="input" /></div>
        <div class="field"><label>Teléfono</label><input v-model="edit.phone" class="input" inputmode="tel" /></div>
      </div>
      <template #footer><button class="btn btn-ghost" @click="edit.open = false">Cancelar</button><button class="btn btn-primary" :disabled="edit.busy" @click="saveEdit">Guardar</button></template>
    </Sheet>

    <Sheet :open="reset.open" :title="reset.done ? 'Clave nueva lista' : 'Asignar clave nueva'" :subtitle="reset.p?.name" @close="reset.open = false">
      <div v-if="!reset.done" class="stack" style="--gap: 14px">
        <p class="small muted">Se crea una clave temporal. Su usuario y sus ventas no cambian. La clave anterior deja de funcionar.</p>
        <div class="field"><label>Clave temporal</label><div class="row" style="--gap: 6px"><input v-model="reset.password" class="input mono grow" /><button class="btn btn-ghost btn-icon" @click="reset.password = randomPassword()"><Icon name="refresh" /></button></div></div>
      </div>
      <div v-else class="stack" style="--gap: 12px">
        <div class="cred-card"><div><span class="faint tiny">Usuario</span><b class="mono">{{ reset.p.username }}</b></div><div><span class="faint tiny">Clave</span><b class="mono">{{ reset.password }}</b></div></div>
        <a v-if="reset.p.phone" class="btn btn-wa btn-block" :href="whatsappUrl(reset.p.phone, resetText)" target="_blank" rel="noopener"><Icon name="whatsapp" />Enviar por WhatsApp</a>
        <button class="btn btn-ghost btn-block" @click="copy(resetText).then(() => toast('Copiado'))"><Icon name="copy" />Copiar</button>
      </div>
      <template #footer>
        <template v-if="!reset.done"><button class="btn btn-ghost" @click="reset.open = false">Cancelar</button><button class="btn btn-primary" :disabled="reset.busy" @click="doReset">Asignar clave</button></template>
        <button v-else class="btn btn-primary" @click="reset.open = false">Listo</button>
      </template>
    </Sheet>
  </div>
</template>

