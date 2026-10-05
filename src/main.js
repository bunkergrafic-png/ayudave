import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'
import './styles/base.css'

// Tema guardado (claro / oscuro / automático)
try {
  const t = localStorage.getItem('rifalo.theme')
  if (t) document.documentElement.dataset.theme = t
} catch { /* sin almacenamiento */ }

createApp(App).use(router).mount('#app')

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}))
}
