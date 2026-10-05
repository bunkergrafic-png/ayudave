<script setup>
// Ventana: hoja inferior en el celular, diálogo centrado en pantallas grandes.
import { watch, onBeforeUnmount } from 'vue'
import Icon from './Icon.vue'
const props = defineProps({ open: Boolean, title: String, subtitle: String, wide: Boolean })
const emit = defineEmits(['close'])
function onKey(e) { if (e.key === 'Escape' && props.open) emit('close') }
watch(() => props.open, v => {
  document.body.style.overflow = v ? 'hidden' : ''
  if (v) window.addEventListener('keydown', onKey); else window.removeEventListener('keydown', onKey)
}, { immediate: true })
onBeforeUnmount(() => { document.body.style.overflow = ''; window.removeEventListener('keydown', onKey) })
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="open" class="sheet-backdrop" @mousedown.self="emit('close')">
        <div class="sheet" :class="{ wide }" role="dialog" aria-modal="true">
          <div class="sheet-grip only-mobile" />
          <header class="sheet-head">
            <div class="grow">
              <h2>{{ title }}</h2>
              <p v-if="subtitle" class="muted small">{{ subtitle }}</p>
            </div>
            <button class="btn btn-ghost btn-icon btn-sm" aria-label="Cerrar" @click="emit('close')"><Icon name="x" /></button>
          </header>
          <div class="sheet-body"><slot /></div>
          <footer v-if="$slots.footer" class="sheet-foot"><slot name="footer" /></footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style>
.sheet-backdrop { position: fixed; inset: 0; z-index: 60; background: rgba(20, 8, 45, .55); backdrop-filter: blur(3px); display: flex; align-items: center; justify-content: center; padding: 16px; }
.sheet { width: 100%; max-width: 520px; max-height: calc(100dvh - 32px); background: var(--surface); border-radius: 22px; box-shadow: var(--shadow-lg); display: flex; flex-direction: column; overflow: hidden; }
.sheet.wide { max-width: 760px; }
.sheet-head { display: flex; align-items: flex-start; gap: 12px; padding: 18px 20px 12px; }
.sheet-body { padding: 4px 20px 20px; overflow-y: auto; overscroll-behavior: contain; }
.sheet-foot { padding: 14px 20px calc(14px + env(safe-area-inset-bottom)); border-top: 1px solid var(--line); display: flex; gap: 10px; background: var(--surface); }
.sheet-foot .btn { flex: 1; }
.sheet-grip { width: 42px; height: 5px; border-radius: 9px; background: var(--line-strong); margin: 10px auto 0; }
@media (max-width: 720px) {
  .sheet-backdrop { align-items: flex-end; padding: 0; }
  .sheet, .sheet.wide { max-width: none; border-radius: 24px 24px 0 0; max-height: 94dvh; }
}
.sheet-enter-active, .sheet-leave-active { transition: opacity .22s ease; }
.sheet-enter-active .sheet, .sheet-leave-active .sheet { transition: transform .3s cubic-bezier(.2, .8, .2, 1); }
.sheet-enter-from, .sheet-leave-to { opacity: 0; }
.sheet-enter-from .sheet, .sheet-leave-to .sheet { transform: translateY(40px) scale(.98); }
</style>
