<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import Icon from './Icon.vue'
import Logo from './Logo.vue'
import Sheet from './Sheet.vue'
import CurrencyCalc from './CurrencyCalc.vue'
import { session, logout, changeMyPassword } from '../lib/session'
import { rates, loadRates } from '../lib/rates'
import { initials } from '../lib/format'
import { toast, toastError } from '../lib/ui'

const router = useRouter()
const calc = ref(false)
const menu = ref(false)
const pass = ref({ a: '', b: '', busy: false, show: false })

const role = computed(() => session.profile?.role)
const roleLabel = computed(() => ({ super: 'Super admin', owner: 'Organizador', member: 'Equipo' }[role.value] || ''))
const nav = computed(() => [
  { to: '/', icon: 'ticket', label: 'Rifas' },
  ...(role.value === 'owner' || role.value === 'super' ? [{ to: '/equipo', icon: 'users', label: 'Equipo' }] : []),
  ...(role.value === 'super' ? [{ to: '/organizaciones', icon: 'building', label: 'Clientes' }] : []),
  { to: '/ayuda', icon: 'info', label: 'Ayuda' },
  { to: '/ajustes', icon: 'settings', label: 'Ajustes' }
])

onMounted(() => loadRates())

const theme = ref(document.documentElement.dataset.theme || 'auto')
function toggleTheme() {
  const dark = theme.value === 'dark' || (theme.value === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches)
  theme.value = dark ? 'light' : 'dark'
  document.documentElement.dataset.theme = theme.value
  try { localStorage.setItem('rifalo.theme', theme.value) } catch { /* noop */ }
}

async function out() {
  menu.value = false
  await logout()
  router.replace('/login')
}

async function savePass() {
  const p = pass.value
  if (p.a.length < 6) return toastError(new Error('La clave debe tener al menos 6 caracteres'))
  if (p.a !== p.b) return toastError(new Error('Las claves no coinciden'))
  p.busy = true
  try {
    await changeMyPassword(p.a)
    toast('¡Listo! Tu clave quedó guardada')
    pass.value = { a: '', b: '', busy: false, show: false }
  } catch (e) {
    toastError(e.code === 'auth/requires-recent-login' ? new Error('Por seguridad, cierra sesión y vuelve a entrar para cambiar la clave') : e)
  } finally { p.busy = false }
}
</script>

<template>
  <div class="shell">
    <aside class="side hide-mobile">
      <RouterLink to="/" class="side-logo"><Logo /></RouterLink>
      <nav class="side-nav">
        <RouterLink v-for="n in nav" :key="n.to" :to="n.to" class="side-link" :class="{ on: n.to === '/' ? ($route.path === '/' || $route.path.startsWith('/rifa')) : $route.path.startsWith(n.to) }">
          <Icon :name="n.icon" /> {{ n.label }}
        </RouterLink>
      </nav>
      <div class="side-foot">
        <div v-if="session.org" class="org-pill"><Icon name="building" :size="16" />{{ session.org.name }}</div>
      </div>
    </aside>

    <div class="main">
      <header class="topbar">
        <RouterLink to="/" class="only-mobile"><Logo :size="30" /></RouterLink>
        <div class="grow" />
        <button class="bcv-pill" title="Calculadora de divisas" @click="calc = true">
          <Icon name="calc" :size="16" />
          <span v-if="rates.USD">BCV <b>{{ rates.USD.toLocaleString('es-VE', { maximumFractionDigits: 2 }) }}</b></span>
          <span v-else>Tasa BCV</span>
        </button>
        <button class="btn btn-ghost btn-icon btn-sm hide-mobile" title="Cambiar tema" @click="toggleTheme"><Icon name="moon" /></button>
        <button class="user-btn" @click="menu = true">
          <span class="avatar sm">{{ initials(session.profile?.name) }}</span>
          <span class="hide-mobile user-name">{{ session.profile?.name }}</span>
        </button>
      </header>
      <main class="content">
        <slot />
      </main>
    </div>

    <nav class="bottom-nav only-mobile">
      <RouterLink v-for="n in nav" :key="n.to" :to="n.to" class="bn-link" :class="{ on: n.to === '/' ? ($route.path === '/' || $route.path.startsWith('/rifa')) : $route.path.startsWith(n.to) }">
        <Icon :name="n.icon" :size="22" /><span>{{ n.label }}</span>
      </RouterLink>
    </nav>

    <CurrencyCalc :open="calc" @close="calc = false" />

    <Sheet :open="menu" :title="session.profile?.name || ''" :subtitle="`@${session.profile?.username} · ${roleLabel}`" @close="menu = false">
      <div class="stack" style="--gap: 8px">
        <button class="btn btn-ghost btn-block" @click="menu = false; pass.show = true"><Icon name="key" />Cambiar mi clave</button>
        <button class="btn btn-ghost btn-block" @click="toggleTheme"><Icon name="moon" />Modo claro / oscuro</button>
        <button class="btn btn-ghost btn-block" @click="menu = false; calc = true"><Icon name="calc" />Calculadora de divisas</button>
        <button class="btn btn-danger btn-block" @click="out"><Icon name="logout" />Cerrar sesión</button>
      </div>
    </Sheet>

    <Sheet :open="pass.show || !!session.profile?.mustChangePassword" :title="session.profile?.mustChangePassword ? '¡Bienvenido! Crea tu clave' : 'Cambiar mi clave'"
           :subtitle="session.profile?.mustChangePassword ? 'Por seguridad, cambia la clave temporal que te dieron por una que solo tú conozcas.' : ''"
           @close="session.profile?.mustChangePassword ? null : (pass.show = false)">
      <div class="stack" style="--gap: 14px">
        <div class="field"><label>Nueva clave</label><input v-model="pass.a" class="input" type="password" autocomplete="new-password" /></div>
        <div class="field"><label>Repite la clave</label><input v-model="pass.b" class="input" type="password" autocomplete="new-password" @keyup.enter="savePass" /></div>
      </div>
      <template #footer>
        <button v-if="session.profile?.mustChangePassword" class="btn btn-ghost" @click="out">Salir</button>
        <button class="btn btn-primary" :disabled="pass.busy" @click="savePass"><span v-if="pass.busy" class="spinner" /><template v-else>Guardar clave</template></button>
      </template>
    </Sheet>
  </div>
</template>

<style>
.shell { min-height: 100dvh; display: flex; }
.side { position: sticky; top: 0; height: 100dvh; width: 240px; flex: none; padding: 20px 14px; border-right: 1px solid var(--line); background: var(--surface); display: flex; flex-direction: column; gap: 24px; }
.side-logo { padding: 4px 8px; }
.side-nav { display: flex; flex-direction: column; gap: 4px; }
.side-link { display: flex; align-items: center; gap: 12px; padding: 11px 12px; border-radius: 12px; color: var(--text-2); font-weight: 700; transition: background .15s, color .15s; }
.side-link:hover { background: var(--surface-2); color: var(--text); }
.side-link.on { background: var(--brand-100); color: var(--brand-700); }
:root[data-theme="dark"] .side-link.on { color: var(--brand-400); }
.side-foot { margin-top: auto; }
.org-pill { display: flex; align-items: center; gap: 8px; font-size: .8rem; font-weight: 700; color: var(--text-2); padding: 10px 12px; background: var(--surface-2); border-radius: 12px; }
.main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.topbar { position: sticky; top: 0; z-index: 30; display: flex; align-items: center; gap: 10px; height: 62px; padding: 0 16px; padding-top: env(safe-area-inset-top); background: color-mix(in srgb, var(--bg) 82%, transparent); backdrop-filter: blur(14px); border-bottom: 1px solid var(--line); }
.content { flex: 1; padding: 20px 0 calc(var(--nav-h) + 28px); }
@media (min-width: 721px) { .content { padding-bottom: 40px; } }
.bcv-pill { display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 12px; border-radius: 99px; border: 1px solid var(--line-strong); background: var(--surface); font-size: .8rem; font-weight: 600; cursor: pointer; color: var(--text-2); }
.bcv-pill b { color: var(--text); }
.user-btn { display: flex; align-items: center; gap: 8px; background: none; border: 0; cursor: pointer; padding: 4px; border-radius: 12px; }
.user-name { font-weight: 700; font-size: .88rem; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.avatar.sm { width: 34px; height: 34px; border-radius: 11px; font-size: .78rem; background: linear-gradient(135deg, var(--brand-500), var(--brand-800)); color: #fff; }
.bottom-nav { position: fixed; z-index: 40; left: 0; right: 0; bottom: 0; height: calc(var(--nav-h) + env(safe-area-inset-bottom)); padding-bottom: env(safe-area-inset-bottom); display: flex; background: color-mix(in srgb, var(--surface) 92%, transparent); backdrop-filter: blur(14px); border-top: 1px solid var(--line); }
.bn-link { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; font-size: .68rem; font-weight: 700; color: var(--text-3); }
.bn-link.on { color: var(--brand-600); }
.bn-link.on svg { transform: translateY(-1px); }
</style>
