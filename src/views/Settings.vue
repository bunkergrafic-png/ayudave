<script setup>
import { reactive, computed, watch } from 'vue'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import Icon from '../components/Icon.vue'
import { session } from '../lib/session'
import { toast, toastError } from '../lib/ui'

const fields = ['to_name', 'raffle', 'numbers', 'total', 'status', 'link']
const tag = t => '{' + '{' + t + '}' + '}'
const canOrg = computed(() => ['owner', 'super'].includes(session.profile?.role) && session.org)
const f = reactive({ name: '', serviceId: '', templateId: '', publicKey: '', busy: false })
watch(() => session.org, o => {
  if (!o) return
  Object.assign(f, { name: o.name || '', serviceId: o.emailjs?.serviceId || '', templateId: o.emailjs?.templateId || '', publicKey: o.emailjs?.publicKey || '' })
}, { immediate: true })
async function save() {
  f.busy = true
  try {
    await updateDoc(doc(db, 'orgs', session.org.id), { name: f.name.trim(), emailjs: { serviceId: f.serviceId.trim(), templateId: f.templateId.trim(), publicKey: f.publicKey.trim() } })
    toast('Ajustes guardados')
  } catch (e) { toastError(e) } finally { f.busy = false }
}
</script>

<template>
  <div class="container stack" style="--gap: 16px; max-width: 760px">
    <h1>Ajustes</h1>
    <div class="card stack" style="--gap: 10px">
      <span class="section-label">Mi cuenta</span>
      <div class="row between"><span class="muted">Nombre</span><b>{{ session.profile?.name }}</b></div>
      <div class="row between"><span class="muted">Usuario</span><b class="mono">@{{ session.profile?.username }}</b></div>
      <div class="row between"><span class="muted">Organización</span><b>{{ session.org?.name || '—' }}</b></div>
      <p class="small faint">Para cambiar tu clave, toca tu nombre arriba a la derecha.</p>
    </div>

    <template v-if="canOrg">
      <div class="card stack" style="--gap: 14px">
        <span class="section-label">Organización</span>
        <div class="field"><label>Nombre</label><input v-model="f.name" class="input" /></div>
      </div>
      <div class="card stack" style="--gap: 14px">
        <div class="row"><Icon name="mail" /><h3>Correos automáticos (opcional)</h3></div>
        <p class="small muted">Rifalo puede enviar el comprobante al correo del comprador usando <b>EmailJS</b>, gratis hasta 200 correos al mes y conectado a tu Gmail.</p>
        <ol class="small muted steps">
          <li>Crea una cuenta gratis en <a href="https://www.emailjs.com" target="_blank" rel="noopener">emailjs.com</a> y conecta tu Gmail (Email Services).</li>
          <li>Crea una plantilla (Email Templates). En “To email” pon <span class="kbd">{{ tag('to_email') }}</span> y en el cuerpo usa: <span v-for="t in fields" :key="t" class="kbd" style="margin: 0 2px">{{ tag(t) }}</span></li>
          <li>Copia aquí los tres códigos (Account → Public Key).</li>
        </ol>
        <div class="grid-3">
          <div class="field"><label>Service ID</label><input v-model="f.serviceId" class="input mono" placeholder="service_xxx" /></div>
          <div class="field"><label>Template ID</label><input v-model="f.templateId" class="input mono" placeholder="template_xxx" /></div>
          <div class="field"><label>Public Key</label><input v-model="f.publicKey" class="input mono" /></div>
        </div>
      </div>
      <button class="btn btn-primary" style="align-self: flex-end" :disabled="f.busy" @click="save"><Icon name="check" />Guardar ajustes</button>
    </template>
  </div>
</template>

<style>
.steps { padding-left: 18px; margin: 0; display: flex; flex-direction: column; gap: 6px; }
</style>
