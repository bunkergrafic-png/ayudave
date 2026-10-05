<script setup>
// Crear una persona del equipo (vendedor / co-admin) o un organizador, y compartir sus credenciales.
import { ref, reactive, watch, computed } from 'vue'
import Sheet from './Sheet.vue'
import Icon from './Icon.vue'
import { createPerson } from '../lib/team'
import { usernameToKey } from '../lib/session'
import { randomPassword, slugify, firstName } from '../lib/format'
import { copy, whatsappUrl, baseUrl } from '../lib/share'
import { toast, toastError } from '../lib/ui'

const props = defineProps({ open: Boolean, orgId: String, title: { type: String, default: 'Nueva persona' } })
const emit = defineEmits(['close', 'created'])
const f = reactive({ name: '', username: '', password: '', phone: '' })
const busy = ref(false)
const done = ref(null)
const touchedUser = ref(false)

watch(() => props.open, v => {
  if (!v) return
  Object.assign(f, { name: '', username: '', password: randomPassword(), phone: '' })
  done.value = null
  touchedUser.value = false
})
watch(() => f.name, n => {
  if (touchedUser.value) return
  const parts = slugify(n).split('-').filter(Boolean)
  f.username = parts.length > 1 ? `${parts[0]}.${parts[1]}` : (parts[0] || '')
})

async function save() {
  if (f.name.trim().length < 2) return toastError(new Error('Escribe el nombre'))
  busy.value = true
  try {
    const r = await createPerson({ name: f.name, username: f.username, password: f.password, phone: f.phone, orgId: props.orgId })
    done.value = { ...r, name: f.name.trim(), password: f.password, phone: f.phone }
    emit('created', { id: r.uid, mid: r.mid, name: f.name.trim(), username: r.username, phone: f.phone, role: 'member', active: true })
  } catch (e) { toastError(e) } finally { busy.value = false }
}

const credText = computed(() => done.value
  ? `¡Hola ${firstName(done.value.name)}! 🎟️ Ya tienes acceso a Rifalo.\n\nEntra en: ${baseUrl()}/login\nUsuario: ${done.value.username}\nClave temporal: ${done.value.password}\n\nAl entrar te pedirá crear tu propia clave.`
  : '')
async function copyCreds() { await copy(credText.value); toast('Credenciales copiadas') }
</script>

<template>
  <Sheet :open="open" :title="done ? '¡Listo! Comparte el acceso' : title" @close="emit('close')">
    <div v-if="!done" class="stack" style="--gap: 14px">
      <div class="field"><label>Nombre y apellido *</label><input v-model="f.name" class="input" placeholder="Ej. Ana Guzmán" /></div>
      <div class="grid-2">
        <div class="field">
          <label>Usuario *</label>
          <input v-model="f.username" class="input" autocapitalize="none" spellcheck="false" @input="touchedUser = true; f.username = usernameToKey(f.username)" />
          <span class="hint">Con este usuario entrará a la app</span>
        </div>
        <div class="field">
          <label>Clave temporal *</label>
          <div class="row" style="--gap: 6px">
            <input v-model="f.password" class="input mono grow" />
            <button class="btn btn-ghost btn-icon" type="button" title="Generar otra" @click="f.password = randomPassword()"><Icon name="refresh" /></button>
          </div>
        </div>
      </div>
      <div class="field"><label>Teléfono / WhatsApp</label><input v-model="f.phone" class="input" inputmode="tel" placeholder="0414-1234567" /></div>
    </div>
    <div v-else class="stack" style="--gap: 14px">
      <div class="cred-card">
        <div><span class="faint tiny">Usuario</span><b class="mono">{{ done.username }}</b></div>
        <div><span class="faint tiny">Clave temporal</span><b class="mono">{{ done.password }}</b></div>
      </div>
      <p class="small muted">La primera vez que entre, la app le pedirá crear su propia clave.</p>
      <a v-if="done.phone" class="btn btn-wa btn-block" :href="whatsappUrl(done.phone, credText)" target="_blank" rel="noopener"><Icon name="whatsapp" />Enviar por WhatsApp</a>
      <button class="btn btn-ghost btn-block" @click="copyCreds"><Icon name="copy" />Copiar credenciales</button>
    </div>
    <template #footer>
      <template v-if="!done">
        <button class="btn btn-ghost" @click="emit('close')">Cancelar</button>
        <button class="btn btn-primary" :disabled="busy" @click="save"><span v-if="busy" class="spinner" /><template v-else><Icon name="plus" />Crear acceso</template></button>
      </template>
      <button v-else class="btn btn-primary" @click="emit('close')">Listo</button>
    </template>
  </Sheet>
</template>

<style>
.cred-card { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.cred-card > div { display: flex; flex-direction: column; padding: 14px; border-radius: 14px; background: var(--brand-50); border: 1px solid var(--brand-100); }
.cred-card b { font-size: 1.1rem; word-break: break-all; }
</style>
