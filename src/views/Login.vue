<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import Logo from '../components/Logo.vue'
import Icon from '../components/Icon.vue'
import { login } from '../lib/session'
import CurrencyCalc from '../components/CurrencyCalc.vue'
import { VERSION_LABEL } from '../lib/version'

const router = useRouter()
const route = useRoute()
const username = ref('')
const password = ref('')
const show = ref(false)
const busy = ref(false)
const error = ref('')
const calc = ref(false)

async function submit() {
  error.value = ''
  busy.value = true
  try {
    await login(username.value, password.value)
    router.replace(route.query.next || '/')
  } catch (e) {
    error.value = e.message
  } finally { busy.value = false }
}
const floaters = ['007', '128', '042', '199', '076', '153', '011', '090', '164']
</script>

<template>
  <div class="login">
    <section class="login-hero">
      <div class="floaters" aria-hidden="true">
        <span v-for="(f, i) in floaters" :key="f" :style="{ '--i': i }">{{ f }}</span>
      </div>
      <div class="hero-copy">
        <Logo light :size="44" />
        <h1>Rifas organizadas,<br /><span>sin enredos.</span></h1>
        <p>Vendedores, pagos verificados y sorteo transparente. Todo en un solo lugar, desde tu teléfono.</p>
        <ul>
          <li><Icon name="shield" :size="18" /> Ningún número se vende dos veces</li>
          <li><Icon name="wallet" :size="18" /> Pagos en Bs, dólares o USDT a tasa BCV</li>
          <li><Icon name="trophy" :size="18" /> Sorteo con registro y evidencia</li>
        </ul>
      </div>
    </section>
    <section class="login-form-wrap">
      <form class="login-form" @submit.prevent="submit">
        <div class="only-mobile" style="margin-bottom: 8px"><Logo :size="40" /></div>
        <h2>Entrar</h2>
        <p class="muted">Usa el usuario y la clave que te dio el organizador.</p>
        <div class="field">
          <label for="u">Usuario</label>
          <div class="input-group">
            <span class="prefix"><Icon name="user" :size="18" /></span>
            <input id="u" v-model="username" class="input" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="tu.usuario" required />
          </div>
        </div>
        <div class="field">
          <label for="p">Clave</label>
          <div class="input-group">
            <span class="prefix"><Icon name="lock" :size="18" /></span>
            <input id="p" v-model="password" class="input" :type="show ? 'text' : 'password'" autocomplete="current-password" required style="padding-right: 48px" />
            <button type="button" class="eye" :aria-label="show ? 'Ocultar clave' : 'Mostrar clave'" @click="show = !show"><Icon :name="show ? 'eyeOff' : 'eye'" :size="18" /></button>
          </div>
        </div>
        <Transition name="fade"><div v-if="error" class="login-error"><Icon name="alert" :size="18" />{{ error }}</div></Transition>
        <button class="btn btn-primary btn-lg btn-block" :disabled="busy">
          <span v-if="busy" class="spinner" /><template v-else>Entrar <Icon name="arrowRight" /></template>
        </button>
        <p class="tiny faint center">¿Olvidaste tu clave? Pídele al organizador que te asigne una nueva.</p>
        <button type="button" class="calc-link" @click="calc = true"><span>💱</span> Calculadora de Divisas</button>
        <p class="app-version">{{ VERSION_LABEL }}</p>
      </form>
      <CurrencyCalc :open="calc" @close="calc = false" />
    </section>
  </div>
</template>

<style>
.login { min-height: 100dvh; display: grid; grid-template-columns: 1.1fr 1fr; }
.login-hero { position: relative; overflow: hidden; color: #fff; padding: 56px; display: flex; align-items: center;
  background: radial-gradient(1200px 600px at 10% 10%, #7C3AED 0, transparent 60%), radial-gradient(800px 500px at 90% 90%, #F5A50B55 0, transparent 60%), linear-gradient(160deg, #3B0F8C, #1E0A47); }
.hero-copy { position: relative; z-index: 1; max-width: 460px; display: flex; flex-direction: column; gap: 22px; }
.hero-copy h1 { font-size: 3rem; font-weight: 800; letter-spacing: -.03em; }
.hero-copy h1 span { background: linear-gradient(90deg, #FDE68A, #F5A50B); -webkit-background-clip: text; background-clip: text; color: transparent; }
.hero-copy p { font-size: 1.05rem; opacity: .85; }
.hero-copy ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; font-weight: 600; }
.hero-copy li { display: flex; align-items: center; gap: 10px; }
.hero-copy li svg { color: #FBBF24; }
.floaters span { position: absolute; font-family: var(--font-display); font-weight: 800; font-size: 1.4rem; color: rgba(255, 255, 255, .1);
  border: 2px solid rgba(255, 255, 255, .1); border-radius: 14px; padding: 8px 14px;
  left: calc(8% + var(--i) * 10%); top: calc(10% + (var(--i) * 37 % 80) * 1%);
  animation: float 9s ease-in-out infinite; animation-delay: calc(var(--i) * -1.1s); }
@keyframes float { 0%, 100% { transform: translateY(0) rotate(-6deg) } 50% { transform: translateY(-24px) rotate(6deg) } }
.login-form-wrap { display: grid; place-items: center; padding: 32px 20px; background: var(--bg); }
.login-form { width: 100%; max-width: 380px; display: flex; flex-direction: column; gap: 16px; }
.login-form h2 { font-size: 2rem; }
.eye { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); background: none; border: 0; padding: 8px; color: var(--text-3); cursor: pointer; }
.calc-link { align-self: center; display: inline-flex; align-items: center; gap: 8px; margin-top: 4px; padding: 12px 20px; border-radius: 14px; border: 1px solid rgba(245, 165, 11, .35); background: var(--surface); color: var(--gold-600); font-weight: 700; font-size: .9rem; cursor: pointer; }
.calc-link:hover { border-color: var(--gold-500); }
.calc-link span { font-size: 1.1rem; }
.login-error { display: flex; gap: 8px; align-items: center; padding: 12px 14px; border-radius: 12px; background: var(--danger-bg); color: var(--danger); font-weight: 600; font-size: .88rem; }
@media (max-width: 900px) {
  .login { grid-template-columns: 1fr; }
  .login-hero { display: none; }
  .login-form-wrap { background: radial-gradient(600px 300px at 50% -10%, var(--brand-100), transparent 70%), var(--bg); }
}
</style>
