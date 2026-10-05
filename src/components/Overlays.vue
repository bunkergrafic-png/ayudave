<script setup>
import { toasts, dialog, closeDialog } from '../lib/ui'
import Icon from './Icon.vue'
import Sheet from './Sheet.vue'
</script>

<template>
  <div class="toasts" aria-live="polite">
    <TransitionGroup name="toast">
      <div v-for="t in toasts" :key="t.id" class="toast" :class="t.type">
        <Icon :name="t.type === 'error' ? 'alert' : t.type === 'info' ? 'info' : 'checkCircle'" :size="18" />
        <span>{{ t.message }}</span>
      </div>
    </TransitionGroup>
  </div>
  <Sheet :open="dialog.open" :title="dialog.title" @close="closeDialog(false)">
    <div class="stack">
      <p v-if="dialog.message" class="muted" style="white-space: pre-line">{{ dialog.message }}</p>
      <div v-if="dialog.input" class="field">
        <label>{{ dialog.input }}</label>
        <input v-model="dialog.value" class="input" autofocus @keyup.enter="closeDialog(dialog.value || true)" />
      </div>
    </div>
    <template #footer>
      <button class="btn btn-ghost" @click="closeDialog(false)">{{ dialog.cancelText }}</button>
      <button class="btn" :class="dialog.danger ? 'btn-danger' : 'btn-primary'" @click="closeDialog(dialog.input ? (dialog.value || '') : true)">{{ dialog.confirmText }}</button>
    </template>
  </Sheet>
</template>

<style>
.toasts { position: fixed; z-index: 90; left: 50%; transform: translateX(-50%); top: calc(12px + env(safe-area-inset-top)); display: flex; flex-direction: column; gap: 8px; width: min(440px, calc(100% - 32px)); pointer-events: none; }
.toast { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-radius: 14px; background: #1C1530; color: #fff; box-shadow: var(--shadow-lg); font-weight: 600; font-size: .9rem; pointer-events: auto; }
.toast.ok svg { color: #34D399; }
.toast.error { background: #7F1D1D; }
.toast.info svg { color: var(--gold-400); }
.toast-enter-active, .toast-leave-active { transition: all .3s cubic-bezier(.2, .8, .2, 1); }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(-12px) scale(.96); }
</style>
