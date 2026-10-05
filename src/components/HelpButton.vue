<script setup>
// Botón "?" que abre la guía de la pantalla actual.
import { ref, watch } from 'vue'
import Icon from './Icon.vue'
import Sheet from './Sheet.vue'
import ArticleView from './ArticleView.vue'
import { articleById } from '../lib/help'
const props = defineProps({ topic: { type: String, required: true }, label: String })
const open = ref(false)
const current = ref(props.topic)
watch(() => props.topic, t => { current.value = t })
function show() { current.value = props.topic; open.value = true }
</script>

<template>
  <button class="btn btn-ghost btn-sm help-btn" :aria-label="'Ayuda: ' + (articleById(topic)?.title || '')" @click="show">
    <Icon name="info" /><span v-if="label">{{ label }}</span>
  </button>
  <Sheet :open="open" :title="articleById(current)?.title || 'Ayuda'" @close="open = false">
    <ArticleView :id="current" @go="current = $event" />
    <template #footer>
      <RouterLink class="btn btn-ghost" to="/ayuda" @click="open = false"><Icon name="search" />Toda la ayuda</RouterLink>
      <button class="btn btn-primary" @click="open = false">Entendido</button>
    </template>
  </Sheet>
</template>

<style>
.help-btn { color: var(--brand-600); }
</style>
